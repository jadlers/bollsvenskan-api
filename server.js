require("dotenv").config();
const express = require("express");
const bodyParser = require("body-parser");
const cors = require("cors");
const Joi = require("@hapi/joi");
const pgp = require("pg-promise")();

const db = pgp(process.env.DATABASE_URL);
const PORT = process.env.PORT || 5000;

const app = express();
app.use(bodyParser.json());
app.use(cors());

const server = app.listen(PORT);

app.get("/player", async (req, res) => {
  let conn, response;
  try {
    const res = await db.any("SELECT * FROM users");
    response = {
      statusCode: 200,
      body: {
        players: res,
      },
    };
  } catch (err) {
    console.log({
      eventType: "DB",
      function: "getAllPlayers",
      err,
    });
    res.send(err);
  }

  res.send(response);
});

app.post("/player", async (req, res) => {
  let response;

  const { username } = req.body;
  if (!username) {
    return res.status(400).json({
      message: "missing key 'username' in request body",
    });
  }

  try {
    const res = await db.one(
      "INSERT INTO users(username) VALUES ($1) RETURNING *",
      [username]
    );

    console.log({
      eventType: "DB",
      function: "addNewPlayer",
      message: `Added user ${username} with id ${res.id}`,
    });

    response = {
      message: "User added successfully",
      userId: res.id,
    };
  } catch (err) {
    if (err.code === "23505") {
      console.log({
        eventType: "DB",
        function: "addNewPlayer",
        message: `Error: User with username '${username}' already exists`,
      });
      return res
        .status(400)
        .json({ message: `A user with that name already exists` });
    } else {
      console.log({
        eventType: "DB",
        function: "addNewPlayer",
        err,
      });
      return res.status(500).json({ message: "Internal server error" });
    }
  }

  res.send(response);
});

app.post("/match", async (req, respond) => {
  let response;
  const body = req.body;

  response = {
    statusCode: 200,
    body: JSON.stringify({
      message: "Under development",
    }),
  };

  // 1. Validate data needed exists
  const schema = Joi.object().keys({
    teams: Joi.array()
      .items(
        Joi.array()
          .items(Joi.number())
          .min(1)
      )
      .min(2)
      .required(),
    score: Joi.array()
      .items(Joi.number())
      .min(2)
      .required(),
    winner: Joi.number()
      .min(0)
      .required(),
  });

  try {
    await Joi.validate(body, schema, { abortEarly: false });
  } catch (error) {
    const errorInformation = error.details.map(
      d => d.message.replace(/\"/g, `'`) + " "
    );

    return respond.status(400).json({
      message: `${error.name}: ${errorInformation}`,
    });
  }

  // All data needed is valid
  const { teams, score, winner } = body;

  // 2. Add to DB
  try {
    // Open a transaction
    db.any("START TRANSACTION");

    // Add players to teams
    let teamIds = [];
    for (let i = 0; i < teams.length; i++) {
      const team = teams[i];
      const res = await db.one(
        "INSERT INTO teams(name) VALUES (NULL) RETURNING *"
      );
      teamIds[i] = res.id;

      for (let j = 0; j < team.length; j++) {
        const player = team[j];
        await db.any(
          "INSERT INTO team_players(team_id, user_id) VALUES ($1, $2)",
          [teamIds[i], player]
        );
      }
    }

    // Add match information
    const res = await db.one(
      "INSERT INTO matches (score, winning_team_id) VALUES ($1, $2) RETURNING *",
      [`${score[0]} - ${score[1]}`, teamIds[winner]]
    );
    const matchId = res.id;

    // Dbect match with teams using match_teams
    await teamIds.forEach(
      async teamId =>
        await db.query(
          "INSERT INTO match_teams (match_id, team_id) VALUES ($1, $2)",
          [matchId, teamId]
        )
    );

    db.query("COMMIT");
    console.log({
      eventType: "DB",
      function: "addNewMatch",
      message: "Added match with information shown in data",
      data: body,
    });

    return respond.status(200).json({
      message: "Successfully added new match",
    });
  } catch (error) {
    if (db) {
      db.query("ROLLBACK");
    }
    console.log(error);
    return respond
      .status(500)
      .json({ message: "Internal error adding new match" });
  }

  return respond.json(response);
});

app.get("/match", async (req, res) => {
  let response;
  response = { message: "In development" };

  try {
    const matches = await db.any("SELECT * FROM matches");

    const final = [];
    for (let i = 0; i < matches.length; i++) {
      const match = matches[i];

      const matchObj = { matchId: match.id, teams: [] };

      // Format the score
      const { id, score, winning_team_id } = match;
      const score_arr = score.split("-").map(n => parseInt(n));
      matchObj.score = score_arr;

      // Get all teams in the match
      const teamIds = await db.any(
        "SELECT team_id FROM match_teams WHERE match_id = $1",
        id
      );

      const teams = [];

      for (let j = 0; j < teamIds.length; j++) {
        const row = teamIds[j];
        // Get names
        const teamId = row.team_id;
        const playerNames = await getPlayerNamesFromTeamId(teamId);
        matchObj.teams.push(playerNames);
        if (teamId === winning_team_id) {
          matchObj.winner = matchObj.teams.indexOf(playerNames);
        }
      }

      final.push(matchObj);
    }
    response = { matches: final };
  } catch (error) {
    console.log(error);
  }

  return res.json(response);
});

const getPlayerNamesFromTeamId = async teamId => {
  try {
    const res = await db.any(
      "SELECT user_id FROM team_players WHERE team_id = $1",
      teamId
    );
    const userIds = res.map(row => parseInt(row.user_id));
    let players = [];

    const nameData = await db.query(
      `SELECT username FROM users WHERE id IN (${userIds.toString()})`
    ); // TODO: Safe?
    const names = nameData.map(p => p.username);
    return names;
  } catch (error) {
    console.log(error);
  }
  return [];
};
