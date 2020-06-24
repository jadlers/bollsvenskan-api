import Joi from "@hapi/joi";
import bodyParser from "body-parser";
import cors from "cors";
import dotenv from "dotenv";
import express from "express";
import fs from "fs";
import http from "http";
import Prometheus from "prom-client";
import socketIo from "socket.io";

// Import my other modules
import * as db from "./db.js";
import { createBalancedTeams, ratingDiff } from "./elo.ts";

// Initialise dotenv
dotenv.config();

const app = express();

// Add middleware
app.use(cors());
app.use(bodyParser.json());

let server;
if (process.env.NODE_ENV === "development") {
  console.log("Development build");
  server = http.createServer(app);
} else {
  console.log("Production build");
  const options = {
    key: fs.readFileSync(process.env.KEY_FILE),
    cert: fs.readFileSync(process.env.CERT_FILE),
  };
  // TODO: Look over this (http(s)). Temporary solution?
  server = http.createServer(options, app);
}

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

// Monitoring
Prometheus.collectDefaultMetrics();

const httpRequestDurationMicroseconds = new Prometheus.Histogram({
  name: "http_request_duration_ms",
  help: "Duration of HTTP requests in ms",
  labelNames: ["method", "route", "status_code"],
  buckets: [0.1, 5, 15, 50, 100, 200, 500, 1000, 2000, 5000],
});

const httpRequestTotal = new Prometheus.Counter({
  name: "http_request_total",
  help: "Number of HTTP requests processed",
  labelNames: ["method", "route", "status_code"],
});

// Start monitoring
app.use((req, res, next) => {
  res.locals.startEpoch = Date.now();
  next();
});

// Add endpoint for metrics
app.get("/metrics", (req, res) => {
  res.set("Content-Type", Prometheus.register.contentType);
  res.end(Prometheus.register.metrics());
});

const PORT = process.env.API_SERVER_PORT;

app.get("/ping", async (req, res, next) => {
  res.status(200).json({ message: "Pong!" });
  next();
});

/** PLAYERS */

app.get("/player/:playerId", async (req, res, next) => {
  const playerId = parseInt(req.params.playerId) || -1;
  if (playerId === -1) {
    res.status(400).json({
      message: `Invalid player id '${req.params.playerId}'. Should be a number of a user in the database.`,
    });
    next();
  }

  try {
    const {
      id,
      username,
      full_name: fullName,
      elo_rating: eloRating,
    } = await db.getUser(playerId);
    res.status(200).json({ id, username, fullName, eloRating });
    next();
  } catch (error) {
    res.status(500).json({ message: "Database error" });
    next();
  }
});

// Get all players
app.get("/player", async (req, res, next) => {
  try {
    const rows = await db.getAllUsers();
    const players = rows.map((player) => {
      const {
        id,
        username,
        password,
        full_name: fullName,
        elo_rating: eloRating,
      } = player;
      return { id, username, fullName, eloRating };
    });
    res.status(200).json({ players });
    next();
  } catch (err) {
    console.log({
      eventType: "DB",
      function: "getAllUsers",
      error: JSON.stringify(err),
    });
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

    console.log({
      eventType: "DB",
      function: "addNewUser",
      message: `Added user ${username} with id ${userId}`,
    });

    res.status(200).json({
      message: "User added successfully",
      userId: userId,
    });
    next();
  } catch (err) {
    if (err.code === "23505") {
      console.log({
        eventType: "DB",
        function: "addNewUser",
        message: `Error: User with username '${username}' already exists`,
      });
      res.status(400).json({ message: `A user with that name already exists` });
      next();
    } else {
      console.log({
        eventType: "DB",
        function: "addNewUser",
        err,
      });
      res.status(500).json({ message: "Internal server error" });
      next();
    }
  }
});

/** MATCHES */

// Add new match
app.post("/match", async (req, res, next) => {
  // 1. Validate data needed exists
  const schema = Joi.object().keys({
    teams: Joi.array()
      .items(Joi.array().items(Joi.number()).min(1))
      .min(2)
      .required(),
    score: Joi.array().items(Joi.number()).min(2).required(),
    winner: Joi.number().min(0).required(),
    leagueId: Joi.number().min(0),
    dotaMatchId: [Joi.number(), Joi.string()],
    diedFirstBlood: Joi.number(),
    coolaStats: Joi.array().items(Joi.object()),
  });

  const { value: verifiedBody, error } = schema.validate(req.body, {
    abortEarly: false,
  });

  if (error) {
    const errorInformation = error.details.map(
      (d) => d.message.replace(/\"/g, `'`) + " "
    );

    // Bad request, abort and give information about what has to change
    console.log(`Error in POST to /match:\n${error}`);
    res.status(400).json({
      error: `${error.name}: ${errorInformation}`,
    });
    next();
  }

  // All data needed is valid
  const {
    teams,
    score,
    winner,
    dotaMatchId,
    diedFirstBlood,
    coolaStats: coolStats,
  } = verifiedBody;
  const leagueId = verifiedBody.leagueId || 0; // Default to the temporary test league

  // Map stats to players
  for (let i = 0; i < coolStats.length; i++) {
    coolStats[i].userId = teams.flat()[i];
  }

  const playersInMatchPromise = new Promise(async (resolve, reject) => {
    try {
      const userIds = teams.flat();
      const userInfoPromises = userIds.map(async (userId) => {
        const { username, elo_rating: eloRating } = await db.getUser(userId);
        return { userId, username, eloRating };
      });

      const userInfo = await Promise.all(userInfoPromises);
      resolve(userInfo);
    } catch (err) {
      console.log(err);
      reject([]);
    }
  });

  // If dotaMatchId is set and already exist then update instead
  const existingMatch = await db.getMatchByDotaMatchId(dotaMatchId);
  if (existingMatch !== null) {
    const matchId = existingMatch.id;
    try {
      await db.beginTransaction();

      let playersInMatch = await playersInMatchPromise;
      // Update stats
      for (let i = 0; i < coolStats.length; i++) {
        const { userId, ...stats } = coolStats[i];
        const userInfo = playersInMatch.find(
          (player) => player.userId === userId
        );
        await db.addStatsForUserToMatch(
          matchId,
          userId,
          userInfo.eloRating,
          stats
        );
      }

      // Update first blood
      await db.setFirstBlood(matchId, diedFirstBlood);

      await db.commitTransaction();
      console.log({
        eventType: "DB",
        function: "addNewMatch",
        message: "Updated match with information shown in data",
        data: JSON.stringify(verifiedBody),
      });

      res.status(200).json({
        message: "Successfully updated new match",
      });
      next();
      return;
    } catch (error) {
      await db.rollbackTransaction();
      console.log(error);
      res.status(500).json({ message: "Internal error adding new match" });
      next();
      return;
    }
  }

  // 2. Add to DB
  try {
    // Start a transaction
    await db.beginTransaction();

    // Add players to teams
    let teamIds = [];
    for (let i = 0; i < teams.length; i++) {
      const team = teams[i];
      const teamId = await db.addNewTeam();
      teamIds[i] = teamId;

      // Add all users to team
      for (let j = 0; j < team.length; j++) {
        const userId = team[j];
        await db.addUserToTeam(teamId, userId);
      }
    }

    // Add match information
    const matchId = await db.addNewMatch(
      `${score[0]} - ${score[1]}`,
      teamIds[winner],
      leagueId,
      dotaMatchId,
      diedFirstBlood
    );

    // Add tams to the newly created match
    for (let i = 0; i < teamIds.length; i++) {
      const teamId = teamIds[i];
      await db.addTeamToMatch(matchId, teamId);
    }

    let playersInMatch = await playersInMatchPromise;

    // Add "cool" stats
    for (let i = 0; i < coolStats.length; i++) {
      const { userId, ...stats } = coolStats[i];
      const userInfo = playersInMatch.find(
        (player) => player.userId === userId
      );
      await db.addStatsForUserToMatch(
        matchId,
        userId,
        userInfo.eloRating,
        stats
      );
    }

    // Update each players elo rating
    // 1. Get team average rating
    const teamRatings = teams.map((team) => {
      const ratings = playersInMatch.filter((player) =>
        team.includes(player.userId)
      );
      const sumRating = ratings.reduce((acc, cur) => acc + cur.eloRating, 0);
      return sumRating / ratings.length;
    });

    // 2. Get number of matches for each player
    for (let i = 0; i < playersInMatch.length; i++) {
      const { count: numMatches } = await db.getNumberOfMatchesInLeague(
        playersInMatch[i].userId,
        leagueId
      );
      playersInMatch[i].numberOfGamesPlayed = parseInt(numMatches);
    }

    for (let teamIdx = 0; teamIdx < teams.length; teamIdx++) {
      const team = teams[teamIdx];
      for (let userIdx = 0; userIdx < team.length; userIdx++) {
        const player = playersInMatch.find((p) => p.userId === team[userIdx]);
        // 3. Calculate new rating for each player
        const newRatingChange = ratingDiff(
          teamRatings[teamIdx],
          teamRatings[teamIdx === 0 ? 1 : 0],
          teamIdx === winner ? true : false,
          player.numberOfGamesPlayed
        );
        const newRating = Math.round(player.eloRating + newRatingChange);
        // 4. Update DB with new rating
        await db.setUserEloRating(player.userId, newRating);
      }
    }

    await db.commitTransaction();
    console.log({
      eventType: "DB",
      function: "addNewMatch",
      message: "Added match with information shown in data",
      data: JSON.stringify(verifiedBody),
    });

    // TODO: Fix the updating of rating above
    recalculateEloRatingForAllPlayers();

    res.status(200).json({
      message: "Successfully added new match",
    });
    next();
  } catch (error) {
    await db.rollbackTransaction();
    console.log(error);
    res.status(500).json({ message: "Internal error adding new match" });
    next();
  }
});

// TODO: Return a single match
// app.get("/match/:matchId", async (req, res, next) => {

// Return all matches
app.get("/match", async (req, res, next) => {
  let response;

  const schema = Joi.object().keys({ leagueId: Joi.number().min(0) });
  const { value: validatedBody, error } = schema.validate(req.body);

  if (error) {
    const errorInformation = error.details.map(
      (d) => d.message.replace(/\"/g, `'`) + " "
    );
    res.status(400).json({ error: errorInformation });
    next();
  }

  try {
    const matches = await db.getAllMatchesFromLeague(2);

    const final = [];
    for (let i = 0; i < matches.length; i++) {
      const match = matches[i];

      const scoreArr = match.score.split("-").map((n) => parseInt(n));

      // Get all teams in the match
      const teamIds = await db.getTeamsInMatch(match.id);
      let teams = [];

      for (let j = 0; j < teamIds.length; j++) {
        const teamId = teamIds[j];
        const userIds = await db.getUsersInTeam(teamId);
        let teamPlayers = [];
        for (let k = 0; k < userIds.length; k++) {
          const userId = userIds[k];
          const { username: name } = await db.getUser(userId);
          const {
            user_id,
            match_id,
            elo_rating: eloRating,
            ...stats // Destructure to remove user_id and match_id from object
          } = await db.getUserStatsFromMatch(userId, match.id);
          teamPlayers.push({ id: userId, name, eloRating, stats });
        }
        teams.push(teamPlayers);

        if (teamId === match.winning_team_id) {
          match.winner = teams.indexOf(teamPlayers);
        }
      }

      let obj = {
        matchId: match.id,
        teams,
        winner: match.winner,
        score: scoreArr,
        leagueId: match.league_id,
        diedFirstBlood: match.died_first_blood,
      };

      if (match.dota_match_id) {
        obj.dotaMatchId = match.dota_match_id;
      }

      final.push(obj);
    }

    if (Object.keys(final[0]).includes("dotaMatchId")) {
      final.sort((a, b) => a.dotaMatchId - b.dotaMatchId);
    }

    response = { matches: final };
    res.status(200).json(response);
    next();
  } catch (error) {
    console.log(error);
    res.status(500).json({ error: "Database error" });
    next();
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

/**
 * WARNING: this resets the rating for all players
 * Utility function which should not need to be run more than once.
 *
 * Recalculates the ELO rating for each user and updates all matches they've
 * played with their ELO at the time of playing the match.
 */
async function recalculateEloRatingForAllPlayers() {
  try {
    const matches = await db.getAllMatchesFromLeague(2); // NOTE: Hardcoded league
    // Make sure the matches are sorted in order since we're rewriting the ELO
    // advancments of each player from the beginning
    matches.forEach((match) => {
      match.dota_match_id = parseInt(match.dota_match_id);
    });
    matches.sort((a, b) => a.dota_match_id - b.dota_match_id);

    // Get data needed for each player: userId, eloRating, matchesPlayed
    const users = await db.getAllUsers();
    const playerData = users.map((user) => {
      return {
        id: user.id,
        username: user.username,
        eloRating: 1500,
        matchesPlayed: 0,
      };
    });

    // Loop over matches.
    for (const match of matches) {
      // Needed for each match: playerIds, winningTeamPlayerIds, averageTeamRatings
      const teamIds = await db.getTeamsInMatch(match.id);
      const teams = await Promise.all(
        teamIds.map(async (teamId) => {
          return { id: teamId, playerIds: await db.getUsersInTeam(teamId) };
        })
      );

      const playersIdsInMatch = teams.map((team) => team.playerIds).flat();

      // Calculate both teams average ELO (ELO for each player in the team)
      teams.forEach((team) => {
        const totalRating = team.playerIds.reduce((acc, playerId) => {
          const currentPlayerData = playerData.find(
            (player) => player.id === playerId
          );
          return acc + currentPlayerData.eloRating;
        }, 0);
        team.averageEloRating = totalRating / team.playerIds.length;
      });

      // DB: Update the ELO for each player in the match
      await Promise.all(
        teams.map(async (team) => {
          // Find out which players are in the winning team
          const winner = team.id === match.winning_team_id;
          // Calculate diff for each player
          team.playerIds.forEach(async (playerId) => {
            const currentPlayerInfo = playerData.find(
              (player) => player.id === playerId
            );
            const eloRatingDiff = ratingDiff(
              team.averageEloRating,
              teams.filter((t) => t.id !== team.id)[0].averageEloRating,
              winner,
              currentPlayerInfo.matchesPlayed
            );
            currentPlayerInfo.eloRating += Math.round(eloRatingDiff);
            currentPlayerInfo.matchesPlayed++;
            await db.setUserEloRating(playerId, currentPlayerInfo.eloRating);
          });
        })
      );

      // DB: Add players current ELO to match in user_match_stats
      await Promise.all(
        playersIdsInMatch.map((playerId) => {
          const currentElo = playerData.find((player) => player.id === playerId)
            .eloRating;
          return db.setUserEloRatingForMatch(match.id, playerId, currentElo);
        })
      );
    }

    // Log all users with updated eloRating
    console.log(
      playerData
        .filter((player) => player.matchesPlayed > 0)
        .sort((a, b) => a.id - b.id)
    );
    return playerData;
  } catch (err) {
    console.log(err);
  }
}

// Respond 404 for routes not specified
app.use((req, res, next) => {
  if (!res.headersSent) {
    res.status(404).send("Sorry can't find that!");
  }

  next();
});

// Register time taken for request before responding
app.use((req, res, next) => {
  const responseTimeInMs = Date.now() - res.locals.startEpoch;
  httpRequestDurationMicroseconds
    .labels(req.method, req.path, res.statusCode)
    .observe(responseTimeInMs);

  httpRequestTotal.labels(req.method, req.path, res.statusCode).inc();

  next();
});

server.listen(PORT, () => console.log(`Server started on port: ${PORT}`));

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
