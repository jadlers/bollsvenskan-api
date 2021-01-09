import { getPlayerBySteamId } from "./player";

import { endDbConnection } from "./db";
afterAll(() => endDbConnection());

describe("Get player with steam32id", () => {
  it("fetches correct existing player", async () => {
    const jacobSteam32id = 75463477;
    const res = await getPlayerBySteamId(jacobSteam32id);

    expect(res.id).toEqual(1);
    expect(res.username).toEqual("Jacob");
  });

  it("fetches non-existing player as standin", async (done) => {
    const missingId = 123;
    try {
      await getPlayerBySteamId(missingId);
    } catch (err) {
      expect(err).toMatch(`No user`);
    }
    done();
  });
});
