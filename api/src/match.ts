import { getMatch, setPlayedDateTime } from "./db";
import { timePlayed } from "./external/opendota";

export async function setPlayTime(matchId: number): Promise<String> {
  try {
    const match = await getMatch(matchId);
    const datetime = await timePlayed(match.dota_match_id);
    await setPlayedDateTime(matchId, datetime);
    return datetime;
  } catch (err) {
    console.error(err);
    return null;
  }
}
