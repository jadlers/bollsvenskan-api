require("dotenv").config();
const express = require("express");
const bodyParser = require("body-parser");
const pgp = require("pg-promise")();

const db = pgp(process.env.DATABASE_URL);
const PORT = process.env.PORT || 5000;

const app = express();
app.use(bodyParser.json());

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
      message: `Added user ${username} with id ${res.insertId}`,
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
