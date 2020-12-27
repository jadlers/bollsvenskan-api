import Joi from "@hapi/joi";
import bodyParser from "body-parser";
import cors from "cors";
import express from "express";
import http from "http";
import socketIo from "socket.io";

import logger from "./middleware/logging";
import monitoring, { monitoringEndpoint } from "./middleware/monitoring";
import webdav from "webdav";

// Import my other modules
import * as db from "./db.js";
import { SERVER_PORT, NEXTCLOUD } from "./config.ts";
import { createBalancedTeams, ratingDiff } from "./elo.ts";
import { getPlayer, getDotaPlayer } from "./player.ts";
import { recalculateEloRatingForAllPlayers } from "./quickfix.js";

// Routes
import newPhraseRouter from "./routes/fb-phrases.ts";
import matchRoutes from "./routes/matchRoutes.js";

const app = express();
const ncDotaSignupLinks = webdav.createClient(
  "https://nextcloud.jacobadlers.com/public.php/webdav",
  { username: NEXTCLOUD.signupShareCode }
);

// Add middleware
app.use(cors());
app.use(bodyParser.json());
app.use(logger);
app.use(monitoring);
app.get("/metrics", monitoringEndpoint);

let server = http.createServer(app);

app.use("/fb-phrase", newPhraseRouter);
app.use("/match", matchRoutes);

// WebSocket action
const io = socketIo(server);
io.on("connection", (socket) => {
  console.log(`New client connected`);

  socket.on("message", (msg) => {
    // Parse message and inform sender if it's not JSON
    try {
      msg = JSON.parse(msg);
    } catch (error) {
      socket.send(
        JSON.stringify({
          type: "ERROR",
          message: "Messages sent have to be JSON",
        })
      );
      return;
    }

    // Check if message which we're waiting for with teams
    if (msg.type === "BROADCAST_TEAMS") {
      console.log("Slowly revealing following teams: ", msg.teams);
      sendTeamsWithTension(msg.teams); // Should still function
    } else {
      // Broadcast all other messages sent
      socket.send(JSON.stringify({ title: `Broadcasting:`, message: msg }));
    }
  });

  socket.on("disconnect", () => {
    console.log(`Client closed connection`);
  });
});

app.get("/ping", async (req, res, next) => {
  res.status(200).json({ message: "Pong!" });
  next();
});

/** Dota signup */

/**
 * Returns the url of the document with all poll links as well as the url to the
 * current poll.
 */
app.get("/dota-signup", async (_, res, next) => {
  if (!NEXTCLOUD.signupShareCode) {
    res.status(501).json({ message: "Not configured by server" });
    return next();
  }

  try {
    const signupDocumentUrl = `https://nextcloud.jacobadlers.com/index.php/s/${NEXTCLOUD.signupShareCode}'`;
    const signupDocument = await ncDotaSignupLinks.getFileContents("/", {
      format: "text",
    });
    const lines = signupDocument.split("\n");
    const pollUrlRegex = /^\*[^~]+<(.+)>/;

    // Find the first line with a url that is not crossed out
    const linkLine = lines.find((line) => {
      let res = line.match(pollUrlRegex);
      return res !== null ? true : false;
    });
    const currentPollUrl = linkLine ? linkLine.match(pollUrlRegex)[1] : "";

    res.json({ signupDocumentUrl, currentPollUrl });
  } catch (error) {
    console.log(error);
    res.status(500).json({ message: "Could not get info from nextcloud" });
  }
});

/** PLAYERS */

app.get("/player/:playerId", async (req, res, next) => {
  // GameType: "base" | "dota"
  const type = req.query.type === "dota" ? "dota" : "base";

  const playerId = parseInt(req.params.playerId) || -1;
  if (playerId === -1) {
    res.status(400).json({
      message: `Invalid player id '${req.params.playerId}'. Must be a number of a user in the database.`,
    });
    next();
  }

  try {
    const player =
      type === "base"
        ? await getPlayer(playerId)
        : await getDotaPlayer(playerId);
    res.json(player);
  } catch (err) {
    console.error(`Could not get player with id ${playerId}:`, err);
    res.status(500).json({ error: "Internal server error" });
  }
});

// Get all players
app.get("/player", async (req, res, next) => {
  // GameType: "base" | "dota"
  const type = req.query.type === "dota" ? "dota" : "base";

  try {
    const rows = await db.getAllUsers();
    const players = await Promise.all(
      rows.map((r) => (type === "base" ? getPlayer(r.id) : getDotaPlayer(r.id)))
    );

    res.status(200).json({ players });
    next();
  } catch (err) {
    console.log(err);
    res.status(500).json({ error: "Database error" });
    next();
  }
});

// Add new player
app.post("/player", async (req, res, next) => {
  const schema = Joi.object().keys({
    username: Joi.string().required(),
  });

  const {
    value: { username },
    error,
  } = schema.validate(req.body);

  if (error) {
    console.log({
      eventType: "InvalidRequest",
      error: JSON.stringify(error),
    });
    res.status(400).json({ error: error.details[0].message });
    next();
  }

  try {
    const userId = await db.addNewUser(username);

    console.log(`Added user ${username} with id ${userId}`);

    res.status(200).json({
      message: "User added successfully",
      userId: userId,
    });
    next();
  } catch (err) {
    if (err.code === "23505") {
      console.log(`Error: User with username '${username}' already exists`);
      res.status(400).json({
        message: `A user with that name (${username}) already exists`,
      });
      next();
    } else {
      console.log(err);
      res.status(500).json({ message: "Internal server error" });
      next();
    }
  }
});

/* LEAGUE */

app.delete("/league/:leagueId", async (req, res, next) => {
  const protectedLeagues = [1, 2];
  const leagueId = parseInt(req.params.leagueId);

  if (protectedLeagues.includes(leagueId)) {
    res.status(403).json({
      message: `Leagues: ${protectedLeagues} are protected and cannot be deleted`,
    });
    next();
  }

  try {
    const deletedIds = await db.deleteAllMatchesFromLeague(leagueId);
    res.status(200).json({
      message: `Deleted all matches in league: ${leagueId}`,
      deletedIds: deletedIds,
    });
    next();
  } catch (error) {
    console.log(error);
    res.status(500).json({ message: "Internal server error" });
    next();
  }
});

app.get("/league/:leagueId/last-dota-match-id", async (req, res, next) => {
  const leagueId = parseInt(req.params.leagueId);
  try {
    const dotaMatchId = await db.getLastDotaMatchIdFromLeague(leagueId);
    res.status(200).json({ dotaMatchId: dotaMatchId });
    next();
  } catch (error) {
    console.log(error);
    res.status(500).json({ message: "Database error" });
    next();
  }
});

app.post("/league/:leagueId/create-teams", async (req, res, next) => {
  const schema = Joi.object().keys({
    players: Joi.array().items(Joi.number()).min(2).required(),
  });
  const {
    value: { players: playerIds },
    error,
  } = schema.validate(req.body);

  if (error) {
    console.log(
      `Error in body of POST request to ${req.originalUrl}`,
      req.body
    );
    res.status(400).json({ error: error.details[0].message });
    next();
    return;
  }

  try {
    // Get name and rating for each player
    let players = await Promise.all(
      playerIds.map((playerId) => db.getUser(playerId))
    );
    players = players.map((player) => {
      return {
        id: player.id,
        name: player.username,
        rating: player.elo_rating,
      };
    });

    // Create balanced teams
    const teams = createBalancedTeams(players);

    res.status(200).json({ team1: teams[0], team2: teams[1] });
    next();
  } catch (err) {
    console.log(err);
    res.status(500).send();
  }
});

/**
 * One player at a time will be moved from the `playersLeft` array to it's team.
 * Some timeout between each sent player.
 *
 * @param {Object} finalTeams Teams to be revealed
 */
function sendTeamsWithTension(finalTeams) {
  const timeout = 2000;
  // The JSON object updated and sent
  let broadcast = {
    type: "BROADCAST_TEAM_PLAYERS_ONE_BY_ONE",
    team1: {
      players: [],
      numPlayers: finalTeams.team1.players.length,
      rating: null,
    },
    team2: {
      players: [],
      numPlayers: finalTeams.team2.players.length,
      rating: null,
    },
    playersLeft: shuffle(
      Object.entries(finalTeams)
        .map(([_, team]) => team.players)
        .flat()
    ),
  };

  const intervalId = setInterval(() => {
    if (broadcast.playersLeft.length === 0) {
      clearInterval(intervalId);
      return;
    }

    const [nextPlayer, ...remaining] = broadcast.playersLeft;
    const playerTeam = finalTeams.team1.players.includes(nextPlayer)
      ? "team1"
      : "team2";
    broadcast[playerTeam].players = [
      ...broadcast[playerTeam].players,
      nextPlayer,
    ];
    broadcast.playersLeft = remaining;

    // Reveal ELO rating when last player has been assign a team
    if (remaining.length === 0) {
      broadcast.team1.rating = finalTeams.team1.rating;
      broadcast.team2.rating = finalTeams.team2.rating;
    }

    // Send to all connected socket.io clients
    io.emit("message", JSON.stringify(broadcast));
  }, timeout);
}

// Taken from here: https://bost.ocks.org/mike/shuffle/
function shuffle(array) {
  let m = array.length;

  // While there remain elements to shuffle…
  while (m) {
    // Pick a remaining element…
    let i = Math.floor(Math.random() * m--);

    // And swap it with the current element.
    let t = array[m];
    array[m] = array[i];
    array[i] = t;
  }

  return array;
}

// NOTE: Careful, this should be locked and only available for admins
app.get("/recalculate-elo-for-all-players", async (req, res, next) => {
  try {
    const updatedData = await recalculateEloRatingForAllPlayers();
    updatedData.sort((a, b) => a.id - b.id);
    res.status(200).json({ message: "Success!", data: updatedData });
    next();
  } catch (error) {
    console.log(error);
    res.status(500).send("Nope");
    next();
  }
});

// Respond 404 for routes not specified
app.use((req, res, next) => {
  if (!res.headersSent) {
    res.status(404).send("Sorry can't find that!");
  }

  next();
});

server.listen(SERVER_PORT, () =>
  console.log(`Server started on port: ${SERVER_PORT}`)
);

// TODO Get matches from a single league
// app.get("/league/:leagueId", async (req, res, next) => {
//   const leagueId = req.params.leagueId;
//   console.log(leagueId);

//   try {
//     const matches = await getMatchesFromLeague(leagueId);
//     res.status(200).json({ matches });
//   } catch (error) {
//     res.status(500).json({ message: "Internal server error" });
//   }
// });
