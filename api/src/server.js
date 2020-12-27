import Joi from "@hapi/joi";
import bodyParser from "body-parser";
import cors from "cors";
import express from "express";
import http from "http";

import logger from "./middleware/logging";
import monitoring, { monitoringEndpoint } from "./middleware/monitoring";
import webdav from "webdav";

// Import my other modules
import * as db from "./db.js";
import { SERVER_PORT, NEXTCLOUD } from "./config.ts";
import connectSocketIo from "./socketio.js";
import { getPlayer, getDotaPlayer } from "./player.ts";
import { recalculateEloRatingForAllPlayers } from "./quickfix.js";

// Routes
import newPhraseRouter from "./routes/fb-phrases.ts";
import matchRoutes from "./routes/matchRoutes.js";
import playerRoutes from "./routes/playerRoutes.js";
import leagueRoutes from "./routes/leagueRoutes.js";

const app = express();
let server = http.createServer(app);
const io = connectSocketIo(server);

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

app.use("/fb-phrase", newPhraseRouter);
app.use("/match", matchRoutes);
app.use("/player", playerRoutes);
app.use("/league", leagueRoutes);

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
