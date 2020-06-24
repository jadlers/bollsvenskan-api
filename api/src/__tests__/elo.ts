import { ratingDiff } from "../elo";

describe("ratingDiff", () => {
  it("win and loss are equal distance from 1", () => {
    const own: number = 15;
    const opponent: number = 12;
    const numGames: number = 2;

    const winDiff: number = ratingDiff(own, opponent, true, numGames);
    const lossDiff: number = ratingDiff(own, opponent, false, numGames);

    expect(winDiff.toFixed()).toEqual((lossDiff * -1).toFixed());
  });
});
