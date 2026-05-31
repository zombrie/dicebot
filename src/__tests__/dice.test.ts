import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { rollDice, formatDice, splitParts } from "../dice";

// Mock Math.random so we can control roll outcomes.
// randIntInclusive(min, max) = Math.floor(random() * (max - min + 1)) + min
// random() = 0.0  → min
// random() = 0.99 → max (for any reasonable die size)
function mockRandom(...values: number[]) {
  const spy = vi.spyOn(Math, "random");
  values.forEach(v => spy.mockReturnValueOnce(v));
  return spy;
}

afterEach(() => vi.restoreAllMocks());

describe("rollDice", () => {
  describe("basic rolls", () => {
    it("rolls a single die with no count prefix", () => {
      mockRandom(0.0); // floor(0 * 20) + 1 = 1
      const r = rollDice("d20");
      expect(r.rolls).toEqual([1]);
      expect(r.kept).toEqual([1]);
      expect(r.modifier).toBe(0);
      expect(r.total).toBe(1);
    });

    it("rolls multiple dice and sums them", () => {
      mockRandom(0.0, 0.5, 0.99); // d6: 1, 4, 6
      const r = rollDice("3d6");
      expect(r.rolls).toHaveLength(3);
      expect(r.kept).toEqual(r.rolls);
      expect(r.total).toBe(r.rolls.reduce((a, b) => a + b, 0));
    });

    it("applies a positive modifier", () => {
      mockRandom(0.0); // d20 → 1
      const r = rollDice("d20+5");
      expect(r.modifier).toBe(5);
      expect(r.total).toBe(6);
    });

    it("applies a negative modifier", () => {
      mockRandom(0.99); // d6 → 6
      const r = rollDice("d6-2");
      expect(r.modifier).toBe(-2);
      expect(r.total).toBe(4);
    });
  });

  describe("keep highest / lowest", () => {
    it("kh keeps the highest N dice", () => {
      // 4d6 → [1, 2, 5, 6], keep highest 3 → [2, 5, 6] = 13
      mockRandom(0.0, 0.16, 0.66, 0.83); // 1, 2, 5, 6 on d6
      const r = rollDice("4d6kh3");
      expect(r.rolls).toHaveLength(4);
      expect(r.kept).toHaveLength(3);
      expect(r.total).toBe(r.kept.reduce((a, b) => a + b, 0));
    });

    it("kl keeps the lowest N dice", () => {
      mockRandom(0.0, 0.16, 0.66, 0.83); // 1, 2, 5, 6 on d6
      const r = rollDice("4d6kl1");
      expect(r.kept).toHaveLength(1);
    });
  });

  describe("advantage and disadvantage", () => {
    it("adv rolls 2d20 and keeps the higher", () => {
      mockRandom(0.0, 0.95); // 1 and 20
      const r = rollDice("d20adv");
      expect(r.rolls).toHaveLength(2);
      expect(r.kept).toEqual([20]);
      expect(r.total).toBe(20);
    });

    it("dis rolls 2d20 and keeps the lower", () => {
      mockRandom(0.0, 0.95); // 1 and 20
      const r = rollDice("d20dis");
      expect(r.rolls).toHaveLength(2);
      expect(r.kept).toEqual([1]);
      expect(r.total).toBe(1);
    });

    it("adv with a modifier applies to the kept roll", () => {
      mockRandom(0.0, 0.95); // 1 and 20
      const r = rollDice("d20adv+3");
      expect(r.total).toBe(23);
    });

    it("adv works on non-d20 dice", () => {
      mockRandom(0.0, 0.99); // 1 and 6 on d6
      const r = rollDice("d6adv");
      expect(r.rolls).toHaveLength(2);
      expect(r.kept).toEqual([6]);
    });

    it("dis works on non-d20 dice", () => {
      mockRandom(0.0, 0.99); // 1 and 6 on d6
      const r = rollDice("d6dis");
      expect(r.rolls).toHaveLength(2);
      expect(r.kept).toEqual([1]);
    });
  });

  describe("notation output", () => {
    it("includes the die expression", () => {
      mockRandom(0.5);
      const r = rollDice("2d8");
      expect(r.notation).toContain("2d8");
    });

    it("includes keep suffix when present", () => {
      mockRandom(0.0, 0.5);
      const r = rollDice("2d20kh1");
      expect(r.notation).toContain("kh1");
    });

    it("includes (adv)/(dis) label", () => {
      mockRandom(0.0, 0.5);
      expect(rollDice("d20adv").notation).toContain("(adv)");
      mockRandom(0.0, 0.5);
      expect(rollDice("d20dis").notation).toContain("(dis)");
    });
  });

  describe("validation errors", () => {
    it("throws on unparseable expression", () => {
      expect(() => rollDice("bananas")).toThrow();
    });

    it("throws when dice count exceeds 100", () => {
      expect(() => rollDice("101d6")).toThrow("Dice count");
    });

    it("throws when die sides exceed 1000", () => {
      expect(() => rollDice("1d1001")).toThrow("sides");
    });

    it("throws when keep count exceeds dice count", () => {
      expect(() => rollDice("2d6kh5")).toThrow("Keep");
    });
  });
});

describe("formatDice", () => {
  it("shows all rolls when nothing is kept separately", () => {
    const result = {
      notation: "2d6",
      rolls: [3, 4],
      kept: [3, 4],
      modifier: 0,
      total: 7,
    };
    const out = formatDice(result);
    expect(out).toContain("[3, 4]");
    expect(out).toContain("**7**");
  });

  it("shows both rolls and kept when they differ", () => {
    const result = {
      notation: "4d6kh3",
      rolls: [1, 3, 5, 6],
      kept: [3, 5, 6],
      modifier: 0,
      total: 14,
    };
    const out = formatDice(result);
    expect(out).toContain("rolls=");
    expect(out).toContain("kept=");
  });

  it("includes modifier in output", () => {
    const result = {
      notation: "d20+5",
      rolls: [10],
      kept: [10],
      modifier: 5,
      total: 15,
    };
    const out = formatDice(result);
    expect(out).toContain("+ 5");
  });
});

describe("splitParts", () => {
  it("splits on semicolon", () => {
    expect(splitParts("d20; 2d6+3")).toEqual(["d20", "2d6+3"]);
  });

  it("splits on newlines", () => {
    expect(splitParts("d20\n2d6")).toEqual(["d20", "2d6"]);
  });

  it("trims whitespace around parts", () => {
    expect(splitParts("  d20 ;  2d6  ")).toEqual(["d20", "2d6"]);
  });

  it("filters empty parts", () => {
    expect(splitParts("d20;;d4")).toEqual(["d20", "d4"]);
  });
});
