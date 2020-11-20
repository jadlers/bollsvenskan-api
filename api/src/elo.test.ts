import { allCombinations, ratingDiff } from "./elo";

describe("allCombinations", () => {
  it("generates all 4 choose 2 combinations", () => {
    const correct = [
      [0, 1],
      [0, 2],
      [0, 3],
      [1, 2],
      [1, 3],
      [2, 3],
    ];

    const generated = allCombinations(4, 2);
    expect(generated.length).toEqual(6);
    generated.forEach((g) => expect(correct).toContainEqual(g));
  });

  it("generates all 5 choose 3 combinations", () => {
    const correct = [
      [0, 1, 2],
      [0, 1, 3],
      [0, 1, 4],
      [0, 2, 3],
      [0, 2, 4],
      [0, 3, 4],
      [1, 2, 3],
      [1, 2, 4],
      [1, 3, 4],
      [2, 3, 4],
    ];

    const generated = allCombinations(5, 3);
    expect(generated.length).toEqual(10);
    generated.forEach((g) => expect(correct).toContainEqual(g));
  });
});

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
