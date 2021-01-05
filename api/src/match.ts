import { getMatch, setPlayedDateTime } from "./db";
import { timePlayed } from "./external/opendota";

export async function setPlayTime(matchId: number): Promise<String> {
  try {
    const { dotaMatchId } = await getMatch(matchId);
    const datetime = await timePlayed(dotaMatchId, openDotaData);
    await setPlayedDateTime(matchId, datetime);
    return datetime;
  } catch (err) {
    console.error(err);
    return null;
  }
}
