import { getMatch, timePlayed, dateTimeFormat } from "./opendota";
import mockMatch from "../../lastmatch-opendota.json";

describe("getMatch", () => {
  it("fetches mock correctly", async () => {
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
