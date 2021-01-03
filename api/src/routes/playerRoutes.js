import express from "express";
import Joi from "@hapi/joi";

import * as db from "../db";
import { getPlayer, getDotaPlayer } from "../player.ts";

const router = express.Router();

router.get("/:playerId", async (req, res, next) => {
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
router.get("/", async (req, res, next) => {
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
router.post("/", async (req, res, next) => {
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

export default router;
