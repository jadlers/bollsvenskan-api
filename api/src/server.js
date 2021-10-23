import bodyParser from "body-parser";
import cors from "cors";
import compression from "compression";
import express from "express";
import http from "http";
import webdav from "webdav";
import Joi from "@hapi/joi";

import { isAuthorized } from "./auth.ts";
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

/**
 * Updates the markdown file with links to the polls used for signup. The new
 * link will be added to the top of the list and the previous will be crossed
 * out.
 *
 * The `link` (link to new poll) and `date` (ISO date of game) properties are
 * required. `week` is optional and will not be added if omitted.
 */
app.post("/dota/signup", isAuthorized, async (req, res, next) => {
  // Validate data
  const schema = Joi.object().keys({
    date: Joi.date().required(),
    link: Joi.string().required(),
    week: Joi.number(),
  });

  const {
    value: { date, link, week },
    error,
  } = schema.validate(req.body);
  if (error) {
    res.status(400).json({ error: error.message });
    return next();
  }

  try {
    const file = await ncDotaSignupLinks.getFileContents("/", {
      format: "text",
    });
    const lines = file.split("\n");
    const pollUrlRegex = /^[\*-][^~]+<(.+)>/;

    // Create new link list item
    const weekStr = week ? `Vecka ${week} ` : "";
    const year = date.getFullYear();
    const datePart = `${year} (${date.getDate()}/${date.getMonth() + 1})`;
    const newLinkLine = `* ${weekStr}${datePart}: <${link}>`;

    // Find the first line with a url that is not crossed out
    const linkLine = lines.findIndex((line) => {
      let res = line.match(pollUrlRegex);
      return res !== null ? true : false;
    });

    if (linkLine === -1) {
      lines.push(newLinkLine);
    } else {
      const commentedLastLink = `* ~~${lines[linkLine].replace("* ", "")}~~`;
      lines.splice(linkLine, 1, newLinkLine, commentedLastLink);
    }

    // Write new content to file
    const written = await ncDotaSignupLinks.putFileContents(
      "/",
      lines.join("\n")
    );
    if (!written) throw new Error("Could not write to file.");

    res.status(201).json({ message: "Signup link updated" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
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
