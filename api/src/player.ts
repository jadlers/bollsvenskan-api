import {
  getUser,
  getUserMatches,
  getUserStatsFromMatch,
  getUserLeagueSeasons,
} from "./db.js";
import { removeNullEntries } from "./util";

export type Player = {
  id: number;
  username: string;
  fullName?: string;
  steam32id?: string;
  discordId?: string;
  discordUsername?: string;
};

type DotaBasicStats = {
  kills: number;
  deaths: number;
  assists: number;
  matches?: number;
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

      resolve({ matches: matches.length, ...aggregateStats });
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
      const [matchesWithStats, leagueSeasons] = await Promise.all([
        getBasicStatsForMatches(playerId, matches),
        getUserLeagueSeasons(playerId, leagueId),
      ]);

      const perSeasonStats = leagueSeasons.map((season) => {
        const seasonMatches = matchesWithStats.filter(
          (m) => m.season === season
        );
        return {
          leagueId,
          season,
          matches: seasonMatches.length,
          ...aggregateBasicDotaStats(seasonMatches),
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
