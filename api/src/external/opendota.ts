import fetch from "node-fetch";

import { OPENDOTA_API_KEY } from "../config";

interface OpenDotaMatch {
  start_time: number;
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
