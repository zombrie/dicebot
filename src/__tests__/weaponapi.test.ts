import { describe, it, expect } from "vitest";
import { hasProperty, isRanged, getAbilityToUse, type Open5eWeapon } from "../weaponapi";
import type { Sheet } from "../skills";

function makeWeapon(overrides: Partial<Open5eWeapon> = {}): Open5eWeapon {
  return {
    name: "Longsword",
    damage_dice: "1d8",
    damage_type: { name: "Slashing", key: "slashing" },
    range: 0,
    long_range: 0,
    is_simple: false,
    properties: [
      { property: { name: "Versatile", type: null, desc: "" }, detail: "1d10" },
    ],
    ...overrides,
  };
}

function makeSheet(str = 16, dex = 12): Sheet {
  return {
    version: 1,
    activeForm: "ingame",
    pb: 3,
    forms: {
      irl: { label: "IRL", abilities: { str: 10, dex: 10, con: 10, int: 10, wis: 10, cha: 10 } },
      ingame: { label: "In Game", abilities: { str, dex, con: 14, int: 10, wis: 10, cha: 10 } },
    },
    skillProf: {},
    inventory: {},
  };
}

describe("hasProperty", () => {
  it("returns true when property exists (case-insensitive)", () => {
    const w = makeWeapon({ properties: [{ property: { name: "Finesse", type: null, desc: "" }, detail: null }] });
    expect(hasProperty(w, "finesse")).toBe(true);
    expect(hasProperty(w, "Finesse")).toBe(true);
  });

  it("returns false when property is absent", () => {
    expect(hasProperty(makeWeapon(), "finesse")).toBe(false);
  });
});

describe("isRanged", () => {
  it("returns false for melee weapons (range 0)", () => {
    expect(isRanged(makeWeapon({ range: 0 }))).toBe(false);
  });

  it("returns true when range > 0", () => {
    expect(isRanged(makeWeapon({ range: 30, long_range: 120 }))).toBe(true);
  });
});

describe("getAbilityToUse", () => {
  it("uses STR for standard melee weapons", () => {
    expect(getAbilityToUse(makeWeapon(), makeSheet())).toBe("str");
  });

  it("uses DEX for ranged weapons", () => {
    const w = makeWeapon({ range: 30, long_range: 120 });
    expect(getAbilityToUse(w, makeSheet())).toBe("dex");
  });

  it("uses higher stat for finesse — STR when STR > DEX", () => {
    const w = makeWeapon({
      properties: [{ property: { name: "Finesse", type: null, desc: "" }, detail: null }],
    });
    expect(getAbilityToUse(w, makeSheet(16, 12))).toBe("str");
  });

  it("uses higher stat for finesse — DEX when DEX > STR", () => {
    const w = makeWeapon({
      properties: [{ property: { name: "Finesse", type: null, desc: "" }, detail: null }],
    });
    expect(getAbilityToUse(w, makeSheet(10, 18))).toBe("dex");
  });

  it("uses STR when both are equal and finesse", () => {
    const w = makeWeapon({
      properties: [{ property: { name: "Finesse", type: null, desc: "" }, detail: null }],
    });
    expect(getAbilityToUse(w, makeSheet(14, 14))).toBe("str");
  });
});
