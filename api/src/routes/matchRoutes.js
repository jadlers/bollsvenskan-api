import express from "express";
import Joi from "@hapi/joi";

import * as db from "../db.ts";
import { ratingDiff } from "../elo.ts";
import { recalculateEloRatingForAllPlayers } from "../quickfix.js";
import { fetchAllOpenDotaInfo } from "../match.ts";

const router = express.Router();

// Add new match
router.post("/", async (req, res, next) => {
  // 1. Validate data needed exists
  const schema = Joi.object().keys({
    teams: Joi.array()
      .items(Joi.array().items(Joi.number()).min(1))
      .min(2)
      .required(),
    score: Joi.array().items(Joi.number()).min(2).required(),
    winner: Joi.number().min(0).required(),
    leagueId: Joi.number().min(0),
    season: Joi.number().min(0),
    dotaMatchId: [Joi.number(), Joi.string()], // TODO: Make sure it's only one number
    diedFirstBlood: Joi.number().allow(null),
    claimedFirstBlood: Joi.number().allow(null),
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
    claimedFirstBlood,
  } = verifiedBody;
  const leagueId = verifiedBody.leagueId || 0; // Default to the temporary test league
  const coolStats = verifiedBody.coolaStats || []; // Not required so might be undefined

  let season = null;
  // Force the season to be 1 for the league 2 (Kung DotA)
  // TODO: Make required, for now this'll do
  if (leagueId === 2) {
    season = 7;
  } else if (verifiedBody.season !== undefined) {
    season = verifiedBody.season;
  }

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
      if (diedFirstBlood) {
        await db.setDiedFirstBlood(matchId, diedFirstBlood);
      }

      if (claimedFirstBlood) {
        await db.setClaimedFirstBlood(matchId, claimedFirstBlood);
      }

      await db.commitTransaction();
      console.log(`Updated existing match (id=${matchId})`);

      res.status(200).json({
        message: "Successfully updated match",
        matchId,
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
      season,
      dotaMatchId,
      diedFirstBlood,
      claimedFirstBlood
    );

    // Add teams to the newly created match
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

    // Randomize the firstblood phrases and add to match
    const phrases = await db.getAllFirstBloodPhrases();
    const mocks = phrases.filter((p) => p.type === "mock");
    const praises = phrases.filter((p) => p.type === "praise");
    // Using dotaMatchId as random value
    const selectedMock = mocks[dotaMatchId % mocks.length];
    const selectedPraise = praises[dotaMatchId % praises.length];
    await db.setFirstBloodMockPhrase(matchId, selectedMock.id);
    await db.setFirstBloodPraisePhrase(matchId, selectedPraise.id);

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
    console.log(`Added new match (id=${matchId})`);

    fetchAllOpenDotaInfo(matchId);

    // TODO: Fix the updating of rating above
    await recalculateEloRatingForAllPlayers();

    res.status(200).json({
      message: "Successfully added new match",
      matchId,
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

router.get("/od-fetch/all", async (req, res, next) => {
  try {
    let matchIds = await db.getMatchesMissingOpenDotaInfo();

    const initialNumMatches = matchIds.length;
    matchIds.splice(50); // Keep first 50 elements

    if (matchIds.length === 0) {
      return res.status(200).json({ msg: "No match is missing information." });
    }

    console.log(
      "Updating matches (maximum 50, 60 api calls/min limit):",
      matchIds
    );
    await Promise.all(matchIds.map((matchId) => fetchAllOpenDotaInfo(matchId)));

    res.status(200).json({
      msg: `Successfully updated open-dota data for ${
        matchIds.length
      } matches. ${Math.max(0, initialNumMatches - 50)} remain without date.`,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ msg: "Internal server error" });
  }
});

router.get("/od-fetch/:matchId", async (req, res, next) => {
  const matchId = parseInt(req.params.matchId);
  if (!matchId) {
    res.status(400).json({
      ok: false,
      message: `Invalid match id '${req.params.matchId}'. Must be the id of a stored match.`,
    });
    return next();
  }

  try {
    const [datetime, heroesPlayed] = await fetchAllOpenDotaInfo(matchId);
    res.status(200).json({
      msg: `Updated time played for match ${matchId} to: ${datetime}. Also updated the heroes for each player according to 'heroesPlayed'.`,
      heroesPlayed,
    });
  } catch (err) {
    console.log(err);
    res.status(500).json({ error: "Internal server error" });
  }
});

// Return all matches
router.get("/", async (req, res, next) => {
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
        date: match.date,
        teams,
        winner: match.winner,
        score: scoreArr,
        leagueId: match.league_id,
        season: match.season,
        diedFirstBlood: match.died_first_blood,
        claimedFirstBlood: match.claimed_first_blood,
      };

      if (match.dota_match_id) {
        obj.dotaMatchId = match.dota_match_id;

        // Add first blood phrases
        const fbPhrases = await db.getAllFirstBloodPhrases();
        obj.firstBloodMock = fbPhrases.find(
          (phrase) => phrase.id == match.first_blood_mock
        ).phrase;
        obj.firstBloodPraise = fbPhrases.find(
          (phrase) => phrase.id == match.first_blood_praise
        ).phrase;
      }

      final.push(obj);
    }

    if (final.length > 0 && Object.keys(final[0]).includes("dotaMatchId")) {
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

export default router;
