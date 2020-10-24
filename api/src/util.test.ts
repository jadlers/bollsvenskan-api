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
    let o = { ...obj };
    o.b = null;
    expect(removeNullEntries(o)).toEqual({
      a: "test",
      "long-key": { c: true },
    });
  });

  it("Removes nested null", () => {
    let o = { ...obj };
    o["long-key"].c = null;
    expect(removeNullEntries(o)).toEqual({
      a: obj.a,
      b: obj.b,
      "long-key": {},
    });
  });
});
