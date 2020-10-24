import { removeNullEntries } from "./util";

describe("removeNullEntries", () => {
  let obj = {
    a: "test",
    b: 23,
    "long-key": {
      c: true,
    },
  };

  it("doesn't alter object without null entries", () => {
    expect(removeNullEntries(obj)).toBe(obj);
  });

  it("removes single null value", () => {
    const oldB = obj.b;
    obj.b = null;
    expect(removeNullEntries(obj)).toEqual({
      a: "test",
      "long-key": { c: true },
    });
    obj.b = oldB;
  });

  it("Removes nested null", () => {
    const oldC = obj["long-key"].c;
    obj["long-key"].c = null;
    expect(removeNullEntries(obj)).toEqual({
      a: obj.a,
      b: obj.b,
      "long-key": {},
    });
  });
});
