import bodyParser from "body-parser";
import cors from "cors";
import compression from "compression";
import express from "express";
import http from "http";

import logger from "./middleware/logging";
import monitoring, { monitoringEndpoint } from "./middleware/monitoring";

// Import my other modules
import { SERVER_PORT } from "./config.ts";

// Routes
import matchRoutes from "./routes/matchRoutes.js";
import playerRoutes from "./routes/playerRoutes.js";
import leagueRoutes from "./routes/leagueRoutes.js";
import variousDotaRoutes from "./routes/variousDotaRoutes.ts";

const app = express();
let server = http.createServer(app);

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

app.use((err, _req, res, _next) => {
  if (res.statusCode === 200) {
    res.status(500); // Add generic error
  }
  res.json({ error: err });
});

server.listen(SERVER_PORT, () =>
  console.log(`Server started on port: ${SERVER_PORT}`),
);
