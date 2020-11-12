import {
  getUser,
  getUserMatches,
  getUserStatsFromMatch,
  getUserLeagueSeasons,
  getMatch,
} from "./db.js";
import { removeNullEntries } from "./util";

export type Player = {
  id: number;
  username: string;
  fullName?: string;
  eloRating?: number;
  steam32id?: string;
  discordId?: string;
  discordUsername?: string;
};

type DotaBasicStats = {
  kills: number;
  deaths: number;
  assists: number;
  matches?: number;
  numFirstBloods?: number;
};

export type DotaPlayer = Player & {
  stats: Array<
    {
      leagueId: number;
      season?: number;
    } & DotaBasicStats
  >;
};

type Match = {
  matchId: number;
  leagueId: number;
  season?: number;
};

type DotaMatchBasicStats = Match & DotaBasicStats;

// TODO: This infomation should be available in the DB
const DOTA_LEAGUE_IDS = [2];

/**
 * Returns the basic information about a player. Null values are stripped from
 * the object before returned.
 */
export function getPlayer(playerId: number): Promise<Player> {
  return new Promise(async (resolve, reject) => {
    try {
      const {
        id,
        username,
        full_name: fullName,
        elo_rating: eloRating,
        steam32id,
        discord_id: discordId,
        discord_username: discordUsername,
      } = await getUser(playerId);

      let player: Player = {
        id: id as number,
        username: username as string,
        fullName: fullName as string,
        eloRating: eloRating as number,
        steam32id: steam32id as string,
        discordId: discordId as string,
        discordUsername: discordUsername as string,
      };

      player = removeNullEntries(player) as Player;
      resolve(player);
    } catch (err) {
      reject(err);
    }
  });
}

/**
 * Combines the basic information about a player with DotA specific information.
 * Summarised stats for DotA leagues and seasons which the player participated
 * in.
 */
export function getDotaPlayer(playerId: number): Promise<DotaPlayer> {
  return new Promise(async (resolve, reject) => {
    try {
      let basePlayer = await getPlayer(playerId);
      const leagueId = 2; // TODO: Collect over all dota leagues
      const leagueStats = await getPlayerDotaLeagueStats(playerId, leagueId);
      const seasonStats = await getPlayerDotaLeagueSeasonStats(
        playerId,
        leagueId
      );
      resolve({
        ...basePlayer,
        stats: [{ leagueId, ...leagueStats }, ...seasonStats],
      });
    } catch (err) {
      reject(err);
    }
  });
}

/*******************************
 * Unexported helper functions *
 *******************************/

/**
 * Returns an array of all DotA-matches the player played along with the league
 * and season in which the match was played.
 */
function getPlayerDotaMatches(
  playerId: number
): Promise<{ matchId: number; leagueId: number; season: number }[]> {
  return new Promise(async (resolve, reject) => {
    try {
      let matches: {
        matchId: number;
        leagueId: number;
        season: number;
      }[] = await getUserMatches(playerId);
      // Filter out only matches in dota leagues
      matches = matches.filter((m) => DOTA_LEAGUE_IDS.includes(m.leagueId));
      resolve(matches);
    } catch (err) {
      reject(err);
    }
  });
}

/**
 * Returns an array of all DotA-matches the player played in a specific league.
 */
async function getPlayerDotaLeaugeMatches(
  playerId: number,
  leagueId: number
): Promise<{ matchId: number; leagueId: number; season: number }[]> {
  const allMatches = await getPlayerDotaMatches(playerId);
  return allMatches.filter((m) => m.leagueId === leagueId);
}

/**
 * Returns the aggregated stats from matches the player played in a league.
 */
function getPlayerDotaLeagueStats(
  playerId: number,
  leagueId: number
): Promise<DotaBasicStats> {
  return new Promise(async (resolve, reject) => {
    try {
      const matches = await getPlayerDotaLeaugeMatches(playerId, leagueId);
      const matchesWithStats = await getBasicStatsForMatches(playerId, matches);
      const aggregateStats = aggregateBasicDotaStats(matchesWithStats);
      const fbMatches = (await getPlayersFirstBloodMatches(playerId)).filter(
        (m) => m.leagueId === leagueId
      );

      resolve({
        matches: matches.length,
        ...aggregateStats,
        numFirstBloods: fbMatches.length,
      });
    } catch (err) {
      reject(err);
    }
  });
}

/**
 * Returns an array of the aggregated stats from matches the player played in a
 * league. One entry per season in the league.
 */
function getPlayerDotaLeagueSeasonStats(
  playerId: number,
  leagueId: number
): Promise<
  Array<
    {
      leagueId: number;
      season: number;
    } & DotaBasicStats
  >
> {
  return new Promise(async (resolve, reject) => {
    try {
      const matches = await getPlayerDotaLeaugeMatches(playerId, leagueId);
      const [
        matchesWithStats,
        leagueSeasons,
        firstBloodMatches,
        seasonElos,
      ] = await Promise.all([
        getBasicStatsForMatches(playerId, matches),
        getUserLeagueSeasons(playerId, leagueId),
        (await getPlayersFirstBloodMatches(playerId)).filter(
          (m) => m.leagueId === leagueId
        ),
        getEloPerSeason(playerId, matches),
      ]);

      const perSeasonStats = leagueSeasons.map((season: number) => {
        const seasonMatches = matchesWithStats.filter(
          (m) => m.season === season
        );
        const numFirstBloods = firstBloodMatches.filter(
          (m) => m.season === season
        ).length;
        const seasonElo = seasonElos.find((se) => se.season === season)
          .eloRating;
        return {
          leagueId,
          season,
          seasonElo,
          matches: seasonMatches.length,
          ...aggregateBasicDotaStats(seasonMatches),
          numFirstBloods,
        };
      });

      resolve(perSeasonStats);
    } catch (err) {
      reject(err);
    }
  });
}

/**
 * Fetches the players KDA for each DotA-match and attaches the values to the
 * match objects.
 */
function getBasicStatsForMatches(
  playerId: number,
  matches: Match[]
): Promise<DotaMatchBasicStats[]> {
  const combinedPromises: Promise<DotaMatchBasicStats>[] = matches.map(
    (match) => {
      return new Promise(async (resolve, reject) => {
        try {
          const stats = await getPlayerDotaMatchStats(playerId, match.matchId);
          const combined: DotaMatchBasicStats = { ...match, ...stats };
          resolve(combined);
        } catch (err) {
          reject(err);
        }
      });
    }
  );

  return Promise.all(combinedPromises);
}

/**
 * Get the KDA for a player in one specific match.
 */
function getPlayerDotaMatchStats(
  playerId: number,
  matchId: number
): Promise<DotaBasicStats> {
  return new Promise(async (resolve, reject) => {
    try {
      const matchData = await getUserStatsFromMatch(playerId, matchId);
      resolve({
        kills: matchData.kills as number,
        assists: matchData.assists as number,
        deaths: matchData.deaths as number,
      });
    } catch (err) {
      reject(err);
    }
  });
}

/**
 * Returns all the matches in which the playerId died first blood.
 */
async function getPlayersFirstBloodMatches(playerId: number) {
  const matches = await getPlayerDotaMatches(playerId);
  const matchesData = await Promise.all(
    matches.map((m) => getMatch(m.matchId))
  );
  const firstBloodMatches = matchesData
    .filter((m) => m.died_first_blood === playerId)
    .map((m) => {
      return {
        matchId: m.id as number,
        leagueId: m.league_id as number,
        season: m.season as number,
        firstBloodPlayerId: m.died_first_blood as number,
      };
    });
  return firstBloodMatches;
}

/**
 * Sums up the KDA for the given matches.
 */
function aggregateBasicDotaStats(
  matches: DotaMatchBasicStats[]
): DotaBasicStats {
  const accumulatedStats = matches.reduce(
    (acc, cur) => {
      acc.kills += cur.kills;
      acc.assists += cur.assists;
      acc.deaths += cur.deaths;
      return acc;
    },
    { kills: 0, assists: 0, deaths: 0 } // Inital value
  );

  return {
    kills: accumulatedStats.kills,
    assists: accumulatedStats.assists,
    deaths: accumulatedStats.deaths,
  };
}

/**
 * Gets the elo which the player ended each season with
 */
function getEloPerSeason(
  playerId: number,
  matches: {
    matchId: number;
    leagueId: number;
    season: number;
  }[]
): Promise<{ season: number; eloRating: number }[]> {
  return new Promise(async (resolve, reject) => {
    try {
      // Get dota_match_id for each match
      const matchesWithDotaId = await Promise.all(
        matches.map(async (m) => {
          const matchInfo = await getMatch(m.matchId);
          const dotaMatchId: number = parseInt(matchInfo.dota_match_id);
          return { ...m, dotaMatchId };
        })
      );

      // Find last match in each season
      const lastMatchEachSeason = matchesWithDotaId.reduce((acc, val) => {
        if (!acc[val.season]) {
          // Not in the accumulated value, add it
          acc[val.season] = {
            matchId: val.matchId,
            dotaMatchId: val.dotaMatchId,
          };

          // TODO: Find last match based on time *not* id
        } else if (acc[val.season].dotaMatchId < val.dotaMatchId) {
          acc[val.season].matchId = val.matchId;
          acc[val.season].dotaMatchId = val.dotaMatchId;
        }
        return acc;
      }, {});

      console.log(lastMatchEachSeason);

      const endOfSeasonElos = await Promise.all(
        Object.keys(lastMatchEachSeason)
          .map((k) => parseInt(k))
          .map(async (season) => {
            const matchId = lastMatchEachSeason[season].matchId;
            const matchStats = await getUserStatsFromMatch(playerId, matchId);
            return { season, eloRating: matchStats.elo_rating };
          })
      );

      resolve(endOfSeasonElos);
    } catch (err) {
      reject(err);
    }
  });
}
