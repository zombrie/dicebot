import { describe, it, expect } from "vitest";
import {
  norm,
  abilityMod,
  profBonus,
  resolveTarget,
  computeCheck,
  pbForLevel,
  spellSlotsForLevel,
} from "../skills";
import type { Sheet } from "../skills";

function makeSheet(): Sheet {
  return {
    version: 1,
    activeForm: "irl",
    pb: 2,
    forms: {
      irl: {
        label: "In Real Life",
        abilities: { str: 16, dex: 14, con: 12, int: 10, wis: 8, cha: 18 },
      },
      ingame: {
        label: "In Game",
        abilities: { str: 10, dex: 10, con: 10, int: 10, wis: 10, cha: 10 },
      },
    },
    skillProf: { insight: 1, intimidation: 2 },
    inventory: {},
  };
}

describe("pbForLevel", () => {
  it.each([
    [1, 2], [4, 2],
    [5, 3], [8, 3],
    [9, 4], [12, 4],
    [13, 5], [16, 5],
    [17, 6], [20, 6],
  ])("level %i → PB %i", (level, pb) => {
    expect(pbForLevel(level)).toBe(pb);
  });
});

describe("spellSlotsForLevel", () => {
  it("returns empty for none caster", () => {
    expect(spellSlotsForLevel(5, "none")).toEqual({});
  });

  it("returns empty for level 0", () => {
    expect(spellSlotsForLevel(0, "full")).toEqual({});
  });

  it("full caster level 1: only 2 first-level slots", () => {
    expect(spellSlotsForLevel(1, "full")).toEqual({ "1": 2 });
  });

  it("full caster level 5: 4/3/2 slots", () => {
    expect(spellSlotsForLevel(5, "full")).toEqual({ "1": 4, "2": 3, "3": 2 });
  });

  it("full caster level 20: all nine spell levels", () => {
    const slots = spellSlotsForLevel(20, "full");
    expect(slots["9"]).toBe(1);
  });

  it("half caster level 1: 2 first-level slots", () => {
    expect(spellSlotsForLevel(1, "half")).toEqual({ "1": 2 });
  });

  it("half caster level 5: 4/2 slots", () => {
    expect(spellSlotsForLevel(5, "half")).toEqual({ "1": 4, "2": 2 });
  });

  it("half caster level 20: five spell levels (up to 5th)", () => {
    const slots = spellSlotsForLevel(20, "half");
    expect(Object.keys(slots).length).toBe(5);
    expect(slots["5"]).toBe(2);
    expect(slots["6"]).toBeUndefined();
  });
});

describe("norm", () => {
  it("lowercases and trims", () => {
    expect(norm("  Insight  ")).toBe("insight");
  });

  it("removes internal spaces", () => {
    expect(norm("Sleight of Hand")).toBe("sleightofhand");
  });

  it("handles already-normalized input", () => {
    expect(norm("stealth")).toBe("stealth");
  });
});

describe("abilityMod", () => {
  it.each([
    [10, 0],
    [11, 0],
    [12, 1],
    [8, -1],
    [20, 5],
    [1, -5],
    [30, 10],
  ])("score %i → mod %i", (score, mod) => {
    expect(abilityMod(score)).toBe(mod);
  });
});

describe("profBonus", () => {
  it("returns 0 for no proficiency", () => {
    expect(profBonus(3, 0)).toBe(0);
  });

  it("returns pb for proficiency", () => {
    expect(profBonus(3, 1)).toBe(3);
  });

  it("returns pb*2 for expertise", () => {
    expect(profBonus(3, 2)).toBe(6);
  });
});

describe("resolveTarget", () => {
  it("resolves short ability names", () => {
    const t = resolveTarget("str");
    expect(t.kind).toBe("ability");
    expect(t.ability).toBe("str");
  });

  it("resolves full ability names", () => {
    const t = resolveTarget("charisma");
    expect(t.kind).toBe("ability");
    expect(t.ability).toBe("cha");
  });

  it("resolves skill names", () => {
    const t = resolveTarget("insight");
    expect(t.kind).toBe("skill");
    if (t.kind === "skill") {
      expect(t.ability).toBe("wis");
      expect(t.skillKey).toBe("insight");
    }
  });

  it("is case-insensitive", () => {
    const t = resolveTarget("PERCEPTION");
    expect(t.kind).toBe("skill");
  });

  it("handles spaced skill names", () => {
    const t = resolveTarget("Sleight of Hand");
    expect(t.kind).toBe("skill");
    if (t.kind === "skill") expect(t.ability).toBe("dex");
  });

  it("throws for unknown input", () => {
    expect(() => resolveTarget("bananas")).toThrow("Unknown check");
  });

  describe("saving throws", () => {
    it("resolves 'str save' as a save target", () => {
      const t = resolveTarget("str save");
      expect(t.kind).toBe("save");
      if (t.kind === "save") expect(t.ability).toBe("str");
    });

    it("resolves 'constitution save' by full name", () => {
      const t = resolveTarget("constitution save");
      expect(t.kind).toBe("save");
      if (t.kind === "save") expect(t.ability).toBe("con");
    });

    it("resolves 'dex saving throw'", () => {
      const t = resolveTarget("dex saving throw");
      expect(t.kind).toBe("save");
      if (t.kind === "save") expect(t.ability).toBe("dex");
    });

    it("label reads '<AB> Save'", () => {
      const t = resolveTarget("wis save");
      if (t.kind === "save") expect(t.label).toBe("WIS Save");
    });
  });
});

describe("computeCheck", () => {
  it("total always equals d20 + bonus", () => {
    const sheet = makeSheet();
    const result = computeCheck(sheet, "str");
    expect(result.total).toBe(result.d20 + result.bonus);
  });

  it("ability check has correct modifier (STR 16 → +3)", () => {
    const sheet = makeSheet();
    const result = computeCheck(sheet, "str");
    expect(result.bonus).toBe(3); // abilityMod(16) = +3, no prof for raw ability
  });

  it("skill check with proficiency adds pb", () => {
    const sheet = makeSheet();
    // insight: wis=8 → mod=-1, pb=2, level=1 → bonus = -1 + 2 = +1
    const result = computeCheck(sheet, "insight");
    expect(result.bonus).toBe(1);
  });

  it("skill check with expertise doubles pb", () => {
    const sheet = makeSheet();
    // intimidation: cha=18 → mod=+4, pb=2, level=2 → bonus = 4 + 4 = +8
    const result = computeCheck(sheet, "intimidation");
    expect(result.bonus).toBe(8);
  });

  it("unproficient skill check has no pb contribution", () => {
    const sheet = makeSheet();
    // stealth: dex=14 → mod=+2, no prof → bonus = +2
    const result = computeCheck(sheet, "stealth");
    expect(result.bonus).toBe(2);
  });

  it("respects form override", () => {
    const sheet = makeSheet();
    // ingame str=10 → mod=0
    const result = computeCheck(sheet, "str", "ingame");
    expect(result.bonus).toBe(0);
  });

  it("falls back to activeForm when no override given", () => {
    const sheet = makeSheet();
    sheet.activeForm = "ingame";
    const result = computeCheck(sheet, "str");
    expect(result.bonus).toBe(0); // ingame str=10
  });

  it("d20 result is always 1–20", () => {
    const sheet = makeSheet();
    for (let i = 0; i < 20; i++) {
      const result = computeCheck(sheet, "str");
      expect(result.d20).toBeGreaterThanOrEqual(1);
      expect(result.d20).toBeLessThanOrEqual(20);
    }
  });

  it("breakdown string contains the d20 roll", () => {
    const sheet = makeSheet();
    const result = computeCheck(sheet, "str");
    expect(result.breakdown).toContain(`d20(${result.d20})`);
  });

  describe("saving throw checks", () => {
    it("unproficient save has no pb contribution", () => {
      const sheet = makeSheet();
      // str=16 → mod=+3, no save prof → bonus = +3
      const result = computeCheck(sheet, "str save");
      expect(result.bonus).toBe(3);
    });

    it("proficient save adds pb", () => {
      const sheet = makeSheet();
      sheet.saveProf = { con: true };
      // con=12 → mod=+1, pb=2, proficient → bonus = +3
      const result = computeCheck(sheet, "con save");
      expect(result.bonus).toBe(3);
    });

    it("save breakdown includes PB when proficient", () => {
      const sheet = makeSheet();
      sheet.saveProf = { wis: true };
      const result = computeCheck(sheet, "wis save");
      expect(result.breakdown).toContain("PB(2)");
    });

    it("save title includes 'Save'", () => {
      const sheet = makeSheet();
      const result = computeCheck(sheet, "dex save");
      expect(result.title).toContain("DEX Save");
    });
  });
});
