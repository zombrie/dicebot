import { describe, it, expect } from "vitest";
import { renderSheet } from "../render";
import type { Sheet } from "../skills";

function makeSheet(): Sheet {
  return {
    version: 1,
    activeForm: "irl",
    pb: 3,
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
    skillProf: {},
    inventory: {},
  };
}

describe("renderSheet", () => {
  it("includes the proficiency bonus", () => {
    expect(renderSheet(makeSheet())).toContain("+3");
  });

  it("marks the active form with a star", () => {
    const lines = renderSheet(makeSheet()).split("\n");
    const irlLine = lines.find(l => l.includes("In Real Life"));
    expect(irlLine).toContain("⭐");
  });

  it("does not star the inactive form", () => {
    const lines = renderSheet(makeSheet()).split("\n");
    const ingameLine = lines.find(l => l.includes("In Game"));
    expect(ingameLine).not.toContain("⭐");
  });

  it("uses form labels instead of raw keys", () => {
    const out = renderSheet(makeSheet());
    expect(out).toContain("In Real Life");
    expect(out).toContain("In Game");
    expect(out).not.toContain("**IRL");
    expect(out).not.toContain("**INGAME");
  });

  it("displays all six abilities for each form", () => {
    const out = renderSheet(makeSheet());
    for (const ab of ["STR", "DEX", "CON", "INT", "WIS", "CHA"]) {
      expect(out).toContain(ab);
    }
  });

  it("shows modifier signs correctly", () => {
    const out = renderSheet(makeSheet());
    expect(out).toContain("+3"); // STR 16
    expect(out).toContain("-1"); // WIS 8
  });

  it("shows proficient skills", () => {
    const sheet = makeSheet();
    sheet.skillProf["insight"] = 1;
    sheet.skillProf["intimidation"] = 2;
    const out = renderSheet(sheet);
    expect(out).toContain("insight");
    expect(out).toContain("intimidation");
    expect(out).toContain("(EXP)");
  });

  it("shows fallback message when no proficiencies", () => {
    expect(renderSheet(makeSheet())).toContain("No skill proficiencies set.");
  });

  it("falls back gracefully when form has no label", () => {
    const sheet = makeSheet();
    delete sheet.forms.irl.label;
    expect(renderSheet(sheet)).toContain("IRL");
  });

  describe("inventory", () => {
    it("shows empty inventory placeholder", () => {
      expect(renderSheet(makeSheet())).toContain("*(empty)*");
    });

    it("lists inventory items with numbering", () => {
      const sheet = makeSheet();
      sheet.inventory = { "Sword of Fire": 1, "Health Potion": 1, "Rope (50ft)": 1 };
      const out = renderSheet(sheet);
      expect(out).toContain("1. **Sword of Fire**");
      expect(out).toContain("2. **Health Potion**");
      expect(out).toContain("3. **Rope (50ft)**");
    });

    it("shows quantity when greater than 1", () => {
      const sheet = makeSheet();
      sheet.inventory = { Arrows: 20 };
      expect(renderSheet(sheet)).toContain("Arrows** ×20");
    });

    it("does not show × 1 for single items", () => {
      const sheet = makeSheet();
      sheet.inventory = { Shield: 1 };
      const out = renderSheet(sheet);
      expect(out).toContain("1. **Shield**");
      expect(out).not.toContain("×1");
    });

    it("shows Inventory header when items are present", () => {
      const sheet = makeSheet();
      sheet.inventory = { Shield: 1 };
      expect(renderSheet(sheet)).toContain("**Inventory:**");
    });

    it("does not show empty placeholder when items are present", () => {
      const sheet = makeSheet();
      sheet.inventory = { Shield: 1 };
      expect(renderSheet(sheet)).not.toContain("*(empty)*");
    });

    it("shows HP when set", () => {
      const sheet = makeSheet();
      sheet.hp = 25;
      sheet.maxHp = 30;
      const out = renderSheet(sheet);
      expect(out).toContain("25 / 30");
    });

    it("shows level and exp when exp is set", () => {
      const sheet = makeSheet();
      sheet.exp = 60; // level 2
      const out = renderSheet(sheet);
      expect(out).toContain("Level **2**");
      expect(out).toContain("60");
    });

    it("shows class when set", () => {
      const sheet = makeSheet();
      sheet.class = "Wizard";
      expect(renderSheet(sheet)).toContain("Wizard");
    });

    it("shows caster type alongside class", () => {
      const sheet = makeSheet();
      sheet.class = "Paladin";
      sheet.casterType = "half";
      const out = renderSheet(sheet);
      expect(out).toContain("Paladin");
      expect(out).toContain("half caster");
    });

    it("does not show caster label when casterType is none", () => {
      const sheet = makeSheet();
      sheet.class = "Fighter";
      sheet.casterType = "none";
      expect(renderSheet(sheet)).not.toContain("caster)");
    });

    it("shows temp HP alongside regular HP", () => {
      const sheet = makeSheet();
      sheet.hp = 20;
      sheet.maxHp = 30;
      sheet.tempHp = 5;
      const out = renderSheet(sheet);
      expect(out).toContain("20 / 30");
      expect(out).toContain("+5 temp");
    });

    it("does not show temp HP line when tempHp is 0 or unset", () => {
      const sheet = makeSheet();
      sheet.hp = 20;
      sheet.maxHp = 30;
      expect(renderSheet(sheet)).not.toContain("temp");
    });

    it("shows save proficiencies", () => {
      const sheet = makeSheet();
      sheet.saveProf = { con: true, wis: true };
      const out = renderSheet(sheet);
      expect(out).toContain("Save Proficiencies");
      expect(out).toContain("CON");
      expect(out).toContain("WIS");
    });

    it("does not show save proficiencies section when none set", () => {
      expect(renderSheet(makeSheet())).not.toContain("Save Proficiencies");
    });

    it("shows spell slots when maxSpellSlots is set", () => {
      const sheet = makeSheet();
      sheet.maxSpellSlots = { "1": 4, "2": 3 };
      sheet.spellSlots = { "1": 2, "2": 3 };
      const out = renderSheet(sheet);
      expect(out).toContain("Spell Slots");
      expect(out).toContain("L1: 2/4");
      expect(out).toContain("L2: 3/3");
    });

    it("shows 0 as current when spellSlots not set for a level", () => {
      const sheet = makeSheet();
      sheet.maxSpellSlots = { "3": 2 };
      expect(renderSheet(sheet)).toContain("L3: 0/2");
    });
  });
});
