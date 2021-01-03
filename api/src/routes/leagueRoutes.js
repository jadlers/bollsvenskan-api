import express from "express";
import Joi from "@hapi/joi";

import * as db from "../db";

const router = express.Router();

router.delete("/:leagueId", async (req, res, next) => {
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

router.get("/:leagueId/last-dota-match-id", async (req, res, next) => {
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

router.post("/:leagueId/create-teams", async (req, res, next) => {
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

export default router;
