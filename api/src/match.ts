import * as db from "./db.js";
import { timePlayed } from "./external/opendota";

export async function setPlayTime(matchId: number): Promise<String> {
  try {
    const match = await db.getMatch(matchId);
    const datetime = await timePlayed(match.dota_match_id);
    await db.setPlayedDateTime(matchId, datetime);
    return datetime;
  } catch (err) {
    console.error(err);
    return null;
  }
}
