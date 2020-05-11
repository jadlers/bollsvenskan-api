// All communication with the database belongs here. Should only contain CRUD
// operation and no logic.

const {
  POSTGRES_USER,
  POSTGRES_PASSWORD,
  POSTGRES_HOST,
  POSTGRES_DB,
} = process.env;

// NOTE: When hosting on heroku they expose a DATABASE_URL to connect to their DB.
// This check can be removed once the sever is no longer hosted on heroku.
const dbConnectionString =
  process.env.DATABASE_URL ||
  `postgres://${POSTGRES_USER}:${POSTGRES_PASSWORD}@${POSTGRES_HOST}:5432/${POSTGRES_DB}`;

const pgp = require("pg-promise")();
const db = pgp(dbConnectionString);

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
exports.getAllUsers = function () {
  return db.any("SELECT * FROM users");
};

exports.getUser = function (userId) {
  return db.one("SELECT * FROM users WHERE id = $1", [userId]);
};

exports.setUserEloRating = function (userId, newRating) {
  return db.any("UPDATE users SET elo_rating = $2 WHERE id = $1", [
    userId,
    newRating,
  ]);
};

exports.getNumberOfMatchesInLeague = function (userId, leagueId) {
  return db.one(
    "SELECT COUNT(m.id) FROM matches m JOIN match_teams mt ON m.id = mt.match_id JOIN team_players tp ON mt.team_id = tp.team_id WHERE m.league_id = $2 AND user_id = $1",
    [userId, leagueId]
  );
};

/**
 * Adds a new player to the database and return its created id.
 */
exports.addNewUser = function (username) {
  return new Promise((resolve, reject) => {
    db.one("INSERT INTO users (username) VALUES ($1) RETURNING *", [username])
      .then((row) => resolve(row.id))
      .catch((err) => reject(err));
  });
};

exports.getUserStatsFromMatch = function (userId, matchId) {
  return db.one(
    "SELECT * FROM user_match_stats WHERE user_id = $1 AND match_id = $2",
    [userId, matchId]
  );
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
  return new Promise(async (resolve, reject) => {
    try {
      const data = await db.many(
        "SELECT team_id FROM match_teams WHERE match_id = $1",
        matchId
      );

      const teamIds = data.map((m) => m.team_id);
      resolve(teamIds);
    } catch (error) {
      console.log(error);
      reject([]);
    }
  });
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
  return new Promise(async (resolve, reject) => {
    try {
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

      resolve(matchId);
    } catch (error) {
      reject(error);
    }
  });
};

exports.addUserToTeam = async function (teamId, userId) {
  return await db.one(
    "INSERT INTO team_players (team_id, user_id) VALUES ($1, $2) RETURNING *",
    [teamId, userId]
  );
};

exports.addStatsForUserToMatch = async function (
  matchId,
  userId,
  eloRating,
  stats
) {
  return await db.one(
    "INSERT INTO user_match_stats (match_id, user_id, kills, deaths, assists, observers_placed, observers_destroyed, sentries_placed, sentries_destroyed, fantasy_points, elo_rating) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11) ON CONFLICT (match_id, user_id) DO UPDATE SET kills = $3, deaths = $4, assists = $5, observers_placed = $6, observers_destroyed = $7, sentries_placed = $8, sentries_destroyed = $9, fantasy_points = $10, elo_rating = $11 RETURNING *",
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
      eloRating,
    ]
  );
};

exports.setUserEloRatingForMatch = async function (matchId, userId, eloRating) {
  return db.any(
    "UPDATE user_match_stats SET elo_rating = $3 WHERE match_id = $1 AND user_id = $2",
    [matchId, userId, eloRating]
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

exports.getLastDotaMatchIdFromLeague = async function (leagueId) {
  return new Promise(async (resolve, reject) => {
    try {
      const rows = await db.any(
        "SELECT dota_match_id FROM matches WHERE league_id = $1 ORDER BY dota_match_id",
        [leagueId]
      );
      const matchIds = rows.map((row) => parseInt(row.dota_match_id));
      resolve(Math.max(...matchIds));
    } catch (error) {
      reject(error);
    }
  });
};

exports.deleteAllMatchesFromLeague = async function (leagueId) {
  const rows = await db.any(
    "DELETE FROM matches WHERE league_id = $1 RETURNING *",
    [leagueId]
  );

  const deletedIds = rows.map((row) => row.id);
  return deletedIds;
};
