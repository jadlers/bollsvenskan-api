// All communication with the database belongs here

const pgp = require("pg-promise")();
const db = pgp(process.env.DATABASE_URL);

/* TRANSACTIONS */
exports.startTransaction = async function () {
  await db.none("START TRANSACTION");
};

exports.commitTransaction = async function () {
  await db.none("COMMIT");
};

exports.rollbackTransaction = async function () {
  await db.none("ROLLBACK");
};

/* USERS */
exports.getAllUsers = async function () {
  return await db.any("SELECT * FROM users");
};

exports.getNameOfUser = async function (userId) {
  const { username } = await db.one(
    "SELECT username FROM users WHERE id = $1",
    [userId]
  );
  return username;
};

/**
 * Adds a new player to the database and return its created id.
 */
exports.addNewUser = async function (username) {
  const inserted = await db.one(
    "INSERT INTO users (username) VALUES ($1) RETURNING *",
    [username]
  );
  return inserted.id;
};

exports.getUsersInTeam = async function (teamId) {
  const rows = await db.any(
    "SELECT user_id FROM team_players WHERE team_id = $1",
    [teamId]
  );
  return rows.map((r) => r.user_id);
};

/* TEAMS */

// Returns the ids of the teams which are in the given match
exports.getTeamsInMatch = async function (matchId) {
  const data = await db.many(
    "SELECT team_id FROM match_teams WHERE match_id = $1",
    matchId
  );

  return data.map((m) => m.team_id);
};

exports.addTeamToMatch = async function (matchId, teamId) {
  return await db.one(
    "INSERT INTO match_teams (match_id, team_id) VALUES ($1, $2) RETURNING *",
    [matchId, teamId]
  );
};

/* MATCHES */

exports.getAllMatches = async function () {
  return await db.any("SELECT * FROM matches");
};

exports.addNewMatch = async function (
  score,
  winningTeamId,
  leagueId,
  dotaMatchId
) {
  const row = await db.one(
    "INSERT INTO matches (score, winning_team_id, league_id) VALUES ($1, $2, $3) RETURNING *",
    [`${score[0]} - ${score[1]}`, winningTeamId, leagueId]
  );
  const matchId = row.id;

  // Add optional data
  if (dotaMatchId) {
    await db.any("UPDATE matches SET dota_match_id = $1 WHERE id = $2", [
      dotaMatchId,
      matchId,
    ]);
  }
  return matchId;
};

exports.addUserToTeam = async function (teamId, userId) {
  return await db.one(
    "INSERT INTO team_players (team_id, user_id) VALUES ($1, $2) RETURNING *",
    [teamId, userId]
  );
};

/* TEAMS */

// Add new team without name and return its id
exports.addNewTeam = async function () {
  const row = await db.one(
    "INSERT INTO teams (name) VALUES (NULL) RETURNING *"
  );
  return row.id;
};
