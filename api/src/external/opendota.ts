import fetch from "node-fetch";

import { OPENDOTA_API_KEY } from "../config";
import { getPlayerBySteamId } from "../player";

interface OpenDotaMatch {
  start_time: number;
  players: { account_id: number; hero_id: number }[];
  [x: string]: any;
}

export async function getMatch(matchId: number): Promise<OpenDotaMatch> {
  const url = new URL(`api/matches/${matchId}`, "https://api.opendota.com");
  url.searchParams.append("api_key", OPENDOTA_API_KEY);
  const res = await fetch(url.href);
  if (res.ok) {
    const parsed = await res.json();
    return parsed;
  }
  return Promise.reject(await res.json());
}

/**
 * Get the time when the match was played. Returns a string on the format
 * YYYY-MM-DD HH:MM:SS.
 */
export async function timePlayed(
  matchId: number,
  odData: OpenDotaMatch = null
): Promise<String> {
  odData = await fetchMatchIfMissing(matchId, odData);

  // Extract the date
  const unixtime = odData.start_time * 1000;
  const date = new Date(unixtime);
  return dateTimeFormat(date);
}

export function dateTimeFormat(d: Date): String {
  const date = `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`;
  const time = `${d.getHours()}:${d.getMinutes()}:${d.getSeconds()}`;

  return `${date} ${time}`;
}

/**
 * Extracts the hero played by each player in the match.
 */
export async function heroesPlayed(
  matchId: number,
  odData: OpenDotaMatch = null
): Promise<{ userId: number; steamId: number; heroId: number }[]> {
  odData = await fetchMatchIfMissing(matchId, odData);

  const heroData = await Promise.all(
    odData.players.map(async (p) => {
      try {
        const user = await getPlayerBySteamId(p.account_id);
        return {
          userId: user.id,
          steamId: p.account_id,
          heroId: p.hero_id,
        };
      } catch (err) {
        return { userId: 25, steamId: p.account_id, heroId: p.hero_id };
      }
    })
  );

  return heroData;
}

async function fetchMatchIfMissing(
  matchId: number,
  obj: OpenDotaMatch | null
): Promise<OpenDotaMatch> {
  if (!obj) {
    try {
      obj = await getMatch(matchId);
    } catch (err) {
      console.error("Could not fetch match from opendota", err);
      return Promise.reject();
    }
  }
  return obj;
}
