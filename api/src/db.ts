// All communication with the database belongs here. Should only contain CRUD
// operation and no logic.
import pgp from "pg-promise";

import { Player } from "./player";
import { MatchEntity, UserEntity } from "./db/entities";

import { DATABASE_CONNECTION_URL } from "./config";
const db = pgp(/* initialization options */)(DATABASE_CONNECTION_URL);

export function endDbConnection() {
  db.$pool.end();
}

/* TRANSACTIONS */
export async function beginTransaction() {
  return db.none("BEGIN TRANSACTION");
}

export async function commitTransaction() {
  return db.none("COMMIT");
}

export async function rollbackTransaction() {
  return db.none("ROLLBACK");
}

/* USERS */

function userRowToObj(row: any): UserEntity {
  return {
    id: row.id as number,
    username: row.username as string,
    password: row.password as string,
    apiKey: row.api_key as string,
    fullName: row.full_name as string,
    eloRating: row.elo_rating as number,
    steam32id: row.steam32id as string,
    discordId: row.discord_id as string,
    discordUsername: row.discord_username as string,
  };
}

export async function getAllUsers(): Promise<UserEntity[]> {
  const rows = await db.many("SELECT * FROM users");
  const users = rows.map((r) => userRowToObj(r));
  return users;
}

export async function getUser(userId: number): Promise<UserEntity> {
  const row = await db.one("SELECT * FROM users WHERE id = $1", [userId]);
  return userRowToObj(row);
}

export async function getUserBySteamId(steamId: number): Promise<UserEntity> {
  const row = await db.oneOrNone(
    "SELECT * FROM users WHERE steam32id = $1",
    `${steamId}`
  );

  if (!row) {
    throw new Error(`No user with steam32id=${steamId} exist`);
  }

  return userRowToObj(row);
}

export async function getUserByApiKey(apiKey: string): Promise<UserEntity> {
  const row = await db.one("SELECT * FROM users WHERE api_key = $1", apiKey);
  return userRowToObj(row);
}

export function setUserEloRating(userId, newRating) {
  return db.any("UPDATE users SET elo_rating = $2 WHERE id = $1", [
    userId,
    newRating,
  ]);
}

export function getNumberOfMatchesInLeague(userId, leagueId) {
  return db.one(
    `SELECT COUNT(m.id)
     FROM matches m
     JOIN match_teams mt ON m.id = mt.match_id
     JOIN team_players tp ON mt.team_id = tp.team_id
     WHERE m.league_id = $2
       AND user_id = $1
       AND NOT m.is_deleted`,
    [userId, leagueId]
  );
}

export async function updatePlayer(player: Player) {
  await db.none(
    `UPDATE users SET
       username = $2,
       full_name = $3,
       elo_rating = $4,
       steam32id = $5,
       discord_id = $6,
       discord_username = $7
     WHERE id = $1`,
    [
      player.id,
      player.username,
      player.fullName,
      player.eloRating,
      player.steam32id,
      player.discordId,
      player.discordUsername,
    ]
  );
}

/**
 * Returns a list of matches the user has played in.
 */
export async function getUserMatches(
  userId: number
): Promise<{ matchId: number; leagueId: number; season: number }[]> {
  const res = await db.manyOrNone(
    `SELECT m.id, m.league_id, m.season
     FROM matches m
     JOIN match_teams mt ON m.id = mt.match_id
     JOIN team_players tp ON mt.team_id = tp.team_id
     WHERE user_id = $1
       AND NOT is_deleted`,
    [userId]
  );
  const arr = res.map((match) => {
    return {
      matchId: match.id as number,
      leagueId: match.league_id as number,
      season: match.season as number,
    };
  });
  return arr;
}

/**
 * Returns a list of the seasons in the league which the user participated in.
 */
export async function getUserLeagueSeasons(
  userId: number,
  leagueId: number
): Promise<number[]> {
  const rows: { season: number }[] = await db.manyOrNone(
    `SELECT DISTINCT m.season
        FROM matches m
        JOIN match_teams mt ON m.id = mt.match_id
        JOIN team_players tp ON mt.team_id = tp.team_id
        WHERE user_id = $1
          AND league_id = $2
          AND NOT is_deleted`,
    [userId, leagueId]
  );
  if (!rows) {
    return Promise.reject();
  }
  return rows.map((r) => r.season);
}

/**
 * Adds a new player to the database and return its created id.
 */
export function addNewUser(username) {
  return new Promise((resolve, reject) => {
    db.one("INSERT INTO users (username) VALUES ($1) RETURNING *", [username])
      .then((row) => resolve(row.id))
      .catch((err) => reject(err));
  });
}

export function getUserStatsFromMatch(userId, matchId) {
  return db.one(
    "SELECT * FROM user_match_stats WHERE user_id = $1 AND match_id = $2",
    [userId, matchId]
  );
}

export async function getUsersInTeam(teamId) {
  const rows = await db.any(
    "SELECT user_id FROM team_players WHERE team_id = $1",
    [teamId]
  );
  return rows.map((r) => r.user_id);
}

/* TEAMS */

// Returns the ids of the teams which are in the given match
export async function getTeamsInMatch(matchId) {
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
}

export async function addTeamToMatch(matchId, teamId) {
  return await db.one(
    "INSERT INTO match_teams (match_id, team_id) VALUES ($1, $2) RETURNING *",
    [matchId, teamId]
  );
}

/* MATCHES */

function matchRowToObj(row: any): MatchEntity {
  return {
    id: row.id,
    isDeleted: row.is_deleted,
    date: row.date,
    score: row.score,
    winningTeamId: row.winning_team_id,
    leagueId: row.league_id,
    season: row.season,
    dotaMatchId: row.dota_match_id,
    diedFirstBlood: row.died_first_blood,
    claimedFirstBlood: row.claimed_first_blood,
    firstBloodMock: row.first_blood_mock,
    firstBloodPraise: row.first_blood_praise,
  };
}

export async function getAllMatches() {
  return await db.any(
    "SELECT * FROM matches WHERE league_id = 2 AND NOT is_deleted"
  );
}

export async function getMatch(matchId: number) {
  const row = await db.one(
    "SELECT * FROM matches WHERE id = $1 AND NOT is_deleted",
    matchId
  );
  return {
    id: row.id as number,
    date: row.date as number,
    score: row.score as string,
    winningTeamId: row.winning_team_id as number,
    leagueId: row.winning_team_id as number,
    dotaMatchId: parseInt(row.dota_match_id),
    season: row.season as number,
    claimedFirstBlood: row.claimed_first_blood as number,
    diedFirstBlood: row.died_first_blood as number,
    firstBloodMock: row.first_blood_mock as number,
    firstBloodPraise: row.first_blood_praise as number,
  };
}

export async function addNewMatch(
  score,
  winningTeamId,
  leagueId,
  season,
  dotaMatchId,
  diedFirstBlood,
  claimedFirstBlood
) {
  return new Promise(async (resolve, reject) => {
    try {
      const row = await db.one(
        "INSERT INTO matches (score, winning_team_id, league_id, season) VALUES ($1, $2, $3, $4) RETURNING *",
        [score, winningTeamId, leagueId, season]
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
        await setDiedFirstBlood(matchId, diedFirstBlood);
      }
      if (claimedFirstBlood) {
        await setClaimedFirstBlood(matchId, claimedFirstBlood);
      }

      resolve(matchId);
    } catch (error) {
      reject(error);
    }
  });
}

export async function setDiedFirstBlood(matchId, userId) {
  return db.any("UPDATE matches SET died_first_blood = $1 WHERE id = $2", [
    userId,
    matchId,
  ]);
}

export async function setClaimedFirstBlood(matchId, userId) {
  return db.any("UPDATE matches SET claimed_first_blood = $1 WHERE id = $2", [
    userId,
    matchId,
  ]);
}

export async function setFirstBloodPraisePhrase(matchId, phraseId) {
  return db.none("UPDATE matches SET first_blood_praise = $2 WHERE id = $1", [
    matchId,
    phraseId,
  ]);
}

export async function setFirstBloodMockPhrase(matchId, phraseId) {
  return db.none("UPDATE matches SET first_blood_mock = $2 WHERE id = $1", [
    matchId,
    phraseId,
  ]);
}

export async function addUserToTeam(teamId, userId) {
  return await db.one(
    "INSERT INTO team_players (team_id, user_id) VALUES ($1, $2) RETURNING *",
    [teamId, userId]
  );
}

export async function addStatsForUserToMatch(
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
}

export async function setPlayedHeroesInMatch(
  matchId: number,
  userId: number,
  heroId: number
) {
  await db.oneOrNone(
    "UPDATE user_match_stats SET dota_hero_id = $3 WHERE match_id = $1 AND user_id = $2",
    [matchId, userId, heroId]
  );
}

export async function setUserEloRatingForMatch(matchId, userId, eloRating) {
  return db.any(
    "UPDATE user_match_stats SET elo_rating = $3 WHERE match_id = $1 AND user_id = $2",
    [matchId, userId, eloRating]
  );
}

export async function getMatchByDotaMatchId(dotaMatchId: number) {
  return db.oneOrNone(
    "SELECT * FROM matches WHERE dota_match_id = '$1' AND NOT is_deleted",
    [dotaMatchId]
  );
}

export async function getMatchesMissingOpenDotaInfo() {
  const rows: { id: number }[] = await db.manyOrNone(`
    SELECT DISTINCT m.id
    FROM matches m
    JOIN user_match_stats ums
      ON m.id = ums.match_id
    WHERE league_id = 2
      AND NOT is_deleted
      AND (
        m.date IS NULL OR
        ums.dota_hero_id IS NULL
      )
    ORDER BY m.id`);
  return rows.map((r) => r.id);
}

export async function setPlayedDateTime(matchId, datetime) {
  return db.none("UPDATE matches SET date = $2 WHERE id = $1", [
    matchId,
    datetime,
  ]);
}

/* FIRST BLOOD PHRASES */

export async function addNewFirstBloodPhrase(phrase, type) {
  const res = await db.one(
    "INSERT INTO first_blood_phrases (phrase, type) VALUES ($1, $2) RETURNING id",
    [phrase, type]
  );
  return res.id;
}

export async function getAllFirstBloodPhrases() {
  const res = await db.many("SELECT * FROM first_blood_phrases");
  return res.map((row) => ({ id: row.id, phrase: row.phrase, type: row.type }));
}

/* TEAMS */

// Add new team without name and return its id
export async function addNewTeam() {
  const row = await db.one(
    "INSERT INTO teams (name) VALUES (NULL) RETURNING *"
  );
  return row.id;
}

/* LEAGUES */

export async function getAllMatchesFromLeague(leagueId) {
  return await db.any(
    "SELECT * FROM matches WHERE league_id = $1 AND NOT is_deleted",
    [leagueId]
  );
}

export async function getLastDotaMatchIdFromLeague(leagueId) {
  return new Promise(async (resolve, reject) => {
    try {
      const rows = await db.any(
        `SELECT dota_match_id
         FROM matches
         WHERE league_id = $1
           AND NOT is_deleted
         ORDER BY dota_match_id`,
        [leagueId]
      );
      const matchIds = rows.map((row) => parseInt(row.dota_match_id));
      resolve(Math.max(...matchIds));
    } catch (error) {
      reject(error);
    }
  });
}

export async function getDeletedMatchesFromLeague(leagueId: number) {
  const rows = await db.manyOrNone(
    `SELECT * FROM matches WHERE league_id = $1 AND is_deleted`,
    leagueId
  );
  return rows.map((row) => matchRowToObj(row));
}

// TODO: The temporary league should be deleted but for "real" leagues
// `is_deleted` should be set to true. For now there is a block in the endpoint
// handler.
export async function deleteAllMatchesFromLeague(leagueId) {
  const rows = await db.any(
    "DELETE FROM matches WHERE league_id = $1 RETURNING *",
    [leagueId]
  );

  const deletedIds = rows.map((row) => row.id);
  return deletedIds;
}
