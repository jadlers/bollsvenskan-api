import bodyParser from "body-parser";
import cors from "cors";
import compression from "compression";
import express from "express";
import http from "http";
import webdav from "webdav";

import logger from "./middleware/logging";
import monitoring, { monitoringEndpoint } from "./middleware/monitoring";

// Import my other modules
import { SERVER_PORT, NEXTCLOUD } from "./config.ts";
import connectSocketIo from "./socketio.js";

// Routes
import matchRoutes from "./routes/matchRoutes.js";
import playerRoutes from "./routes/playerRoutes.js";
import leagueRoutes from "./routes/leagueRoutes.js";
import variousDotaRoutes from "./routes/variousDotaRoutes.ts";

const app = express();
let server = http.createServer(app);
connectSocketIo(server);

// Add middleware
app.use(cors());
app.use(bodyParser.json());
app.use(compression());
app.use(logger);
app.use(monitoring);
app.get("/metrics", monitoringEndpoint);

// Add routes
app.use("/match", matchRoutes);
app.use("/player", playerRoutes);
app.use("/league", leagueRoutes);
app.use("/dota", variousDotaRoutes);

app.get("/ping", async (req, res, next) => {
  res.status(200).json({ message: "Pong!" });
  next();
});

/** Dota signup */
const ncDotaSignupLinks = webdav.createClient(
  "https://nextcloud.jacobadlers.com/public.php/webdav",
  { username: NEXTCLOUD.signupShareCode }
);

/**
 * Returns the url of the document with all poll links as well as the url to the
 * current poll.
 *
 * TODO: Move this into the variousDotaRoutes file, not really compatible with
 * typescript atm so couldn not make it compile now.
 */
app.get("/dota/signup", async (_, res, next) => {
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
    const pollUrlRegex = /^[\*-][^~]+<(.+)>/;

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

// Respond 404 for routes not specified
app.use((req, res, next) => {
  if (!res.headersSent) {
    res.status(404).send("Sorry can't find that!");
  }

  next();
});

app.use((err, _req, res, _next) => {
  if (res.statusCode === 200) {
    res.status(500); // Add generic error
  }
  res.json({ error: err });
});

server.listen(SERVER_PORT, () =>
  console.log(`Server started on port: ${SERVER_PORT}`)
);
