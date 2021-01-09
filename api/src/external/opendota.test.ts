import { getMatch, timePlayed, heroesPlayed } from "./opendota";
import mockMatch from "./match.mock.json";

import { endDbConnection } from "../db";
afterAll(() => endDbConnection());

describe("getMatch", () => {
  // TODO: Stub the fetch call with mock data
  it.skip("fetches mock correctly", async () => {
    const matchId = 5760754589;
    const res = await getMatch(matchId);
    expect(res).toEqual(mockMatch);
  });
});

describe("Getting match play time", () => {
  it("returns with passed opendota data", async () => {
    const matchId = 5760754589;
    const odData = await getMatch(matchId);
    const res = await timePlayed(matchId, odData);

    expect(res).toEqual("2020-12-27 20:26:22");
  });

  it("returns when only match id passed", async () => {
    const matchId = 5760754589;
    const res = await timePlayed(matchId);

    expect(res).toEqual("2020-12-27 20:26:22");
  });

  // E2E test, don't waste API calls
  it.skip("get's summer time correct (during winter)", async () => {
    const matchId = 5662578910;
    const res = await timePlayed(matchId);
    expect(res).toEqual("2020-10-18 21:15:46");
  });

  // E2E test, don't waste API calls
  it.skip("get's winter time correct (during winter)", async () => {
    const matchId = 5751025193;
    const res = await timePlayed(matchId);
    expect(res).toEqual("0020-12-20 20:57:18");
  });
});

describe("heroesPlayed", () => {
  it("finds the account_id and hero_id for existing hero", async () => {
    const playedHeroes = await heroesPlayed(null, mockMatch);
    // {userId: 23, heroId: 52}
    expect(playedHeroes).toContainEqual({
      steamId: 41691912,
      userId: 23,
      heroId: 52,
    });
  });

  it("gives standin userId for non-found users", async () => {
    const playedHeroes = await heroesPlayed(null, mockMatch);

    expect(playedHeroes).toContainEqual({
      steamId: 92698518,
      userId: 25,
      heroId: 43,
    });
  });
});
