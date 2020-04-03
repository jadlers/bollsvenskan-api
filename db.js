// All communication with the database belongs here

const pgp = require("pg-promise")();
const db = pgp(process.env.DATABASE_URL);

/* TRANSACTIONS */
exports.beginTransaction = async function () {
  return db.none("BEGIN TRANSACTION");
};

exports.commitTransaction = async function () {
  return db.none("COMMIT");
};

exports.rollbackTransaction = async function () {
  return db.none("ROLLBACK");
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
  return await db.any("SELECT * FROM matches WHERE league_id = 2");
};

exports.addNewMatch = async function (
  score,
  winningTeamId,
  leagueId,
  dotaMatchId,
  diedFirstBlood
) {
  const row = await db.one(
    "INSERT INTO matches (score, winning_team_id, league_id) VALUES ($1, $2, $3) RETURNING *",
    [score, winningTeamId, leagueId]
  );
  const matchId = row.id;

  // Add optional data
  if (dotaMatchId) {
    await db.any("UPDATE matches SET dota_match_id = $1 WHERE id = $2", [
      dotaMatchId,
      matchId,
    ]);
  }

  if (diedFirstBlood) {
    await db.any("UPDATE matches SET died_first_blood = $1 WHERE id = $2", [
      diedFirstBlood,
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

exports.addStatsForUserToMatch = async function (matchId, userId, stats) {
  return await db.one(
    "INSERT INTO user_match_stats (match_id, user_id, kills, deaths, assists, observers_placed, observers_destroyed, sentries_placed, sentries_destroyed, fantasy_points) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10) ON CONFLICT (match_id, user_id) DO UPDATE SET kills = $3, deaths = $4, assists = $5, observers_placed = $6, observers_destroyed = $7, sentries_placed = $8, sentries_destroyed = $9, fantasy_points = $10 RETURNING *",
    [
      matchId,
      userId,
      stats.kills,
      stats.deaths,
      stats.assists,
      stats.obs_placed,
      stats.observer_kills,
      stats.sen_placed,
      stats.sentry_kills,
      stats.fantasyPoints,
    ]
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

/* LEAGUES */

exports.getAllMatchesFromLeague = async function (leagueId) {
  return await db.any("SELECT * FROM matches WHERE league_id = $1", [leagueId]);
};

exports.deleteAllMatchesFromLeague = async function (leagueId) {
  const rows = await db.any(
    "DELETE FROM matches WHERE league_id = $1 RETURNING *",
    [leagueId]
  );

  const deletedIds = rows.map((row) => row.id);
  return deletedIds;
};
