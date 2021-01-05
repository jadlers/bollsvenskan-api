import { getMatch, setPlayedDateTime, setPlayedHeroesInMatch } from "./db";
import {
  timePlayed,
  heroesPlayed,
  OpenDotaMatch,
  getMatch as getOpenDotaMatch,
} from "./external/opendota";

export async function fetchAllOpenDotaInfo(
  matchId: number,
  openDotaData: OpenDotaMatch = null
): Promise<[String, { userId: number; heroId: number }[]]> {
  if (!openDotaData) {
    try {
      const { dotaMatchId } = await getMatch(matchId);
      openDotaData = await getOpenDotaMatch(dotaMatchId);
    } catch (err) {
      console.log(err);
    }
  }

  const storedOpenDotaData = await Promise.all([
    setPlayTime(matchId, openDotaData),
    storeHeroesPlayed(matchId, openDotaData),
  ]);

  return storedOpenDotaData;
}

async function setPlayTime(
  matchId: number,
  openDotaData: OpenDotaMatch = null
): Promise<String> {
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

async function storeHeroesPlayed(
  matchId: number,
  openDotaData: OpenDotaMatch = null
): Promise<{ userId: number; heroId: number }[]> {
  const { dotaMatchId } = await getMatch(matchId);
  const heroes = await heroesPlayed(dotaMatchId, openDotaData);
  await Promise.all(
    heroes.map((h) => setPlayedHeroesInMatch(matchId, h.userId, h.heroId))
  );
  heroes.forEach((h) => delete h.steamId);
  return heroes;
}
