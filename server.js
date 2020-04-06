require("dotenv").config();
const express = require("express");
const bodyParser = require("body-parser");
const cors = require("cors");
const Joi = require("@hapi/joi");

const PORT = process.env.PORT || 5000;

// Import database functions
const db = require("./db.js");

const app = express();
app.use(bodyParser.json());
app.use(cors());

const server = app.listen(PORT);

app.get("/ping", async (req, res) =>
  res.status(200).send({ message: "Pong!" })
);

/** PLAYERS */

// Get all players
app.get("/player", async (req, res) => {
  try {
    const players = await db.getAllUsers();
    return res.status(200).json({ players });
  } catch (err) {
    console.log({
      eventType: "DB",
      function: "getAllUsers",
      err,
    });
    return res.status(500).send(err);
  }
});

// Add new player
app.post("/player", async (req, res) => {
  const schema = Joi.object().keys({
    username: Joi.string().required(),
  });

  const {
    value: { username },
    error,
  } = schema.validate(req.body);

  if (error) {
    return res.status(400).json({ error: error.details[0].message });
  }

  try {
    const userId = await db.addNewUser(username);

    console.log({
      eventType: "DB",
      function: "addNewUser",
      message: `Added user ${username} with id ${userId}`,
    });

    return res.status(200).json({
      message: "User added successfully",
      userId: userId,
    });
  } catch (err) {
    if (err.code === "23505") {
      console.log({
        eventType: "DB",
        function: "addNewUser",
        message: `Error: User with username '${username}' already exists`,
      });
      return res
        .status(400)
        .json({ message: `A user with that name already exists` });
    } else {
      console.log({
        eventType: "DB",
        function: "addNewUser",
        err,
      });
      return res.status(500).json({ message: "Internal server error" });
    }
  }
});

/** MATCHES */

// Add new match
app.post("/match", async (req, respond) => {
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
    return respond.status(400).json({
      error: `${error.name}: ${errorInformation}`,
    });
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

    // Add "cool" stats
    for (let i = 0; i < coolStats.length; i++) {
      const { userId, ...stats } = coolStats[i];
      await db.addStatsForUserToMatch(matchId, userId, stats);
    }

    await db.commitTransaction();
    console.log({
      eventType: "DB",
      function: "addNewMatch",
      message: "Added match with information shown in data",
      data: verifiedBody,
    });

    return respond.status(200).json({
      message: "Successfully added new match",
    });
  } catch (error) {
    await db.rollbackTransaction();
    console.log(error);
    return respond
      .status(500)
      .json({ message: "Internal error adding new match" });
  }

  return respond.json(response);
});

// TODO: Return a single match
// app.get("/match/:matchId", async (req, res) => {

// Return all matches
app.get("/match", async (req, res) => {
  let response;

  const schema = Joi.object().keys({ leagueId: Joi.number().min(0) });
  const { value: validatedBody, error } = schema.validate(req.body);

  if (error) {
    const errorInformation = error.details.map(
      (d) => d.message.replace(/\"/g, `'`) + " "
    );
    return res.status(400).json({ error: errorInformation });
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
          const name = await db.getNameOfUser(userId);
          const {
            user_id,
            match_id,
            ...stats // Destructure to remove user_id and match_id from object
          } = await db.getUserStatsFromMatch(userId, match.id);
          teamPlayers.push({ id: userId, name, stats });
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

    response = { matches: final };
  } catch (error) {
    console.log(error);
  }

  return res.json(response);
});

/* LEAGUE */

app.delete("/league/:leagueId", async (req, res) => {
  const protectedLeagues = [1, 2];
  const leagueId = parseInt(req.params.leagueId);

  if (protectedLeagues.includes(leagueId)) {
    return res.status(403).json({
      message: `Leagues: ${protectedLeagues} are protected and cannot be deleted`,
    });
  }

  try {
    const deletedIds = await db.deleteAllMatchesFromLeague(leagueId);
    return res.status(200).json({
      message: `Deleted all matches in league: ${leagueId}`,
      deletedIds: deletedIds,
    });
  } catch (error) {
    console.log(error);
    return res.status(500).json({ message: "Internal server error" });
  }
});

app.get("/league/:leagueId/last-dota-match-id", async (req, res) => {
  const leagueId = parseInt(req.params.leagueId);
  try {
    const dotaMatchId = await db.getLastDotaMatchIdFromLeague(leagueId);
    return res.json({ dotaMatchId: dotaMatchId });
  } catch (error) {
    console.log(error);
    return res.status(500).json({ message: error });
  }
});

// TODO Get matches from a single league
// app.get("/league/:leagueId", async (req, res) => {
//   const leagueId = req.params.leagueId;
//   console.log(leagueId);

//   try {
//     const matches = await getMatchesFromLeague(leagueId);
//     res.status(200).json({ matches });
//   } catch (error) {
//     res.status(500).json({ message: "Internal server error" });
//   }
// });
