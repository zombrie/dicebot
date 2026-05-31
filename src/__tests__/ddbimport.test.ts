import { describe, it, expect } from "vitest";
import { parseDDBId, parseDDBCharacter, type DDBCharacterData } from "../ddbimport";

// Baseline fixture: a level 5 High Elf Wizard
function makeFixture(overrides: Partial<DDBCharacterData> = {}): DDBCharacterData {
  return {
    id: 12345,
    name: "Alaric",
    currentXp: 1300,
    baseHitPoints: 28,
    bonusHitPoints: null,
    overrideHitPoints: null,
    removedHitPoints: 5,
    temporaryHitPoints: 0,
    stats: [
      { id: 1, value: 10 }, // STR
      { id: 2, value: 14 }, // DEX
      { id: 3, value: 14 }, // CON
      { id: 4, value: 16 }, // INT base
      { id: 5, value: 12 }, // WIS base
      { id: 6, value: 8  }, // CHA
    ],
    bonusStats: [
      { id: 1, value: null }, { id: 2, value: null }, { id: 3, value: null },
      { id: 4, value: null }, { id: 5, value: null }, { id: 6, value: null },
    ],
    overrideStats: [
      { id: 1, value: null }, { id: 2, value: null }, { id: 3, value: null },
      { id: 4, value: null }, { id: 5, value: null }, { id: 6, value: null },
    ],
    classes: [{ level: 5, definition: { name: "Wizard", hitDice: 6 } }],
    modifiers: {
      race: [
        { type: "bonus", subType: "intelligence-score", value: 2 }, // High Elf +2 INT
        { type: "bonus", subType: "dexterity-score", value: 1 },    // High Elf +1 DEX
        { type: "proficiency", subType: "perception", value: null },
      ],
      class: [
        { type: "proficiency", subType: "intelligence-saving-throws", value: null },
        { type: "proficiency", subType: "wisdom-saving-throws", value: null },
        { type: "proficiency", subType: "arcana", value: null },
        { type: "proficiency", subType: "investigation", value: null },
      ],
      background: [
        { type: "proficiency", subType: "history", value: null },
        { type: "proficiency", subType: "religion", value: null },
      ],
      feat: [],
      item: [],
      condition: [],
      global: [],
      override: [],
    },
    ...overrides,
  };
}

describe("parseDDBId", () => {
  it("parses a bare numeric ID", () => {
    expect(parseDDBId("12345678")).toBe("12345678");
  });

  it("parses a full D&D Beyond URL", () => {
    expect(parseDDBId("https://www.dndbeyond.com/characters/12345678")).toBe("12345678");
  });

  it("parses without www", () => {
    expect(parseDDBId("https://dndbeyond.com/characters/12345678")).toBe("12345678");
  });

  it("parses without https prefix", () => {
    expect(parseDDBId("dndbeyond.com/characters/12345678")).toBe("12345678");
  });

  it("parses a URL with query params", () => {
    expect(parseDDBId("https://www.dndbeyond.com/characters/12345678?source=share")).toBe("12345678");
  });

  it("returns null for non-ID non-URL input", () => {
    expect(parseDDBId("not-an-id")).toBeNull();
    expect(parseDDBId("some random text")).toBeNull();
  });
});

describe("parseDDBCharacter", () => {
  it("imports character name", () => {
    expect(parseDDBCharacter(makeFixture()).name).toBe("Alaric");
  });

  it("applies base ability scores to ingame form", () => {
    const sheet = parseDDBCharacter(makeFixture());
    expect(sheet.forms.ingame.abilities.str).toBe(10);
    expect(sheet.forms.ingame.abilities.con).toBe(14);
  });

  it("applies racial bonus modifiers to ability scores", () => {
    const sheet = parseDDBCharacter(makeFixture());
    expect(sheet.forms.ingame.abilities.int).toBe(18); // 16 + 2 racial
    expect(sheet.forms.ingame.abilities.dex).toBe(15); // 14 + 1 racial
  });

  it("applies bonusStats when non-null", () => {
    const fixture = makeFixture();
    fixture.bonusStats[0] = { id: 1, value: 2 }; // +2 manual STR bonus
    const sheet = parseDDBCharacter(fixture);
    expect(sheet.forms.ingame.abilities.str).toBe(12);
  });

  it("overrideStats replace the computed total", () => {
    const fixture = makeFixture();
    fixture.overrideStats[0] = { id: 1, value: 20 }; // override STR to 20
    const sheet = parseDDBCharacter(fixture);
    expect(sheet.forms.ingame.abilities.str).toBe(20);
  });

  it("leaves irl form at default 10s", () => {
    const sheet = parseDDBCharacter(makeFixture());
    for (const score of Object.values(sheet.forms.irl.abilities)) {
      expect(score).toBe(10);
    }
  });

  it("sets class name and caster type", () => {
    const sheet = parseDDBCharacter(makeFixture());
    expect(sheet.class).toBe("Wizard");
    expect(sheet.casterType).toBe("full");
  });

  it("sets caster type to half for Paladin", () => {
    const fixture = makeFixture();
    fixture.classes = [{ level: 5, definition: { name: "Paladin", hitDice: 10 } }];
    expect(parseDDBCharacter(fixture).casterType).toBe("half");
  });

  it("sets caster type to none for Fighter", () => {
    const fixture = makeFixture();
    fixture.classes = [{ level: 5, definition: { name: "Fighter", hitDice: 10 } }];
    expect(parseDDBCharacter(fixture).casterType).toBe("none");
  });

  it("derives PB from level", () => {
    expect(parseDDBCharacter(makeFixture()).pb).toBe(3); // level 5 → PB 3
  });

  it("computes hit die from class definition", () => {
    expect(parseDDBCharacter(makeFixture()).hitDice).toBe(6); // Wizard d6
  });

  it("computes max HP from baseHitPoints + bonusHitPoints", () => {
    const fixture = makeFixture();
    fixture.bonusHitPoints = 5;
    expect(parseDDBCharacter(fixture).maxHp).toBe(33); // 28 + 5
  });

  it("uses overrideHitPoints for max HP when set", () => {
    expect(parseDDBCharacter(makeFixture({ overrideHitPoints: 50 })).maxHp).toBe(50);
  });

  it("computes current HP as max minus removed", () => {
    expect(parseDDBCharacter(makeFixture()).hp).toBe(23); // 28 - 5 removed
  });

  it("floors current HP at 0 when damage exceeds max", () => {
    expect(parseDDBCharacter(makeFixture({ removedHitPoints: 999 })).hp).toBe(0);
  });

  it("imports exp from currentXp", () => {
    expect(parseDDBCharacter(makeFixture()).exp).toBe(1300);
  });

  it("floors exp to level minimum when currentXp is zero (milestone leveling)", () => {
    const sheet = parseDDBCharacter(makeFixture({ currentXp: 0 }));
    expect(sheet.exp).toBe(1300); // min XP for level 5
  });

  it("sets spell slots from level + caster type", () => {
    const sheet = parseDDBCharacter(makeFixture());
    expect(sheet.maxSpellSlots?.["1"]).toBe(4);
    expect(sheet.maxSpellSlots?.["2"]).toBe(3);
    expect(sheet.maxSpellSlots?.["3"]).toBe(2);
    expect(sheet.maxSpellSlots?.["4"]).toBeUndefined();
  });

  it("sets current spell slots equal to max on import", () => {
    const sheet = parseDDBCharacter(makeFixture());
    expect(sheet.spellSlots).toEqual(sheet.maxSpellSlots);
  });

  it("does not set spell slots for non-casters", () => {
    const fixture = makeFixture();
    fixture.classes = [{ level: 5, definition: { name: "Barbarian", hitDice: 12 } }];
    const sheet = parseDDBCharacter(fixture);
    expect(sheet.maxSpellSlots).toBeUndefined();
    expect(sheet.spellSlots).toBeUndefined();
  });

  it("imports skill proficiencies", () => {
    const sheet = parseDDBCharacter(makeFixture());
    expect(sheet.skillProf["arcana"]).toBe(1);
    expect(sheet.skillProf["history"]).toBe(1);
    expect(sheet.skillProf["perception"]).toBe(1);
  });

  it("imports expertise as level 2", () => {
    const fixture = makeFixture();
    (fixture.modifiers.class as typeof fixture.modifiers.class) = [
      ...(fixture.modifiers.class ?? []),
      { type: "expertise", subType: "arcana", value: null },
    ];
    const sheet = parseDDBCharacter(fixture);
    expect(sheet.skillProf["arcana"]).toBe(2);
  });

  it("expertise takes precedence over proficiency", () => {
    const fixture = makeFixture();
    fixture.modifiers.feat = [
      { type: "proficiency", subType: "stealth", value: null },
      { type: "expertise", subType: "stealth", value: null },
    ];
    expect(parseDDBCharacter(fixture).skillProf["stealth"]).toBe(2);
  });

  it("imports saving throw proficiencies", () => {
    const sheet = parseDDBCharacter(makeFixture());
    expect(sheet.saveProf?.int).toBe(true);
    expect(sheet.saveProf?.wis).toBe(true);
    expect(sheet.saveProf?.str).toBeUndefined();
  });

  it("starts with empty inventory", () => {
    expect(parseDDBCharacter(makeFixture()).inventory).toEqual({});
  });

  it("sets activeForm to ingame", () => {
    expect(parseDDBCharacter(makeFixture()).activeForm).toBe("ingame");
  });

  it("sets tempHp when temporaryHitPoints > 0", () => {
    expect(parseDDBCharacter(makeFixture({ temporaryHitPoints: 8 })).tempHp).toBe(8);
  });

  it("does not set tempHp when zero", () => {
    expect(parseDDBCharacter(makeFixture({ temporaryHitPoints: 0 })).tempHp).toBeUndefined();
  });

  describe("known spells", () => {
    it("extracts known spell names from the spells array", () => {
      const fixture = makeFixture({
        spells: [
          { definition: { name: "Fireball", level: 3 }, prepared: true },
          { definition: { name: "Cure Wounds", level: 1 }, prepared: false },
          { definition: { name: "Fire Bolt", level: 0 }, prepared: null },
        ],
      });
      const sheet = parseDDBCharacter(fixture);
      expect(sheet.knownSpells).toContain("fireball");
      expect(sheet.knownSpells).toContain("cure wounds");
      expect(sheet.knownSpells).toContain("fire bolt");
    });

    it("stores spell names in lowercase", () => {
      const fixture = makeFixture({
        spells: [{ definition: { name: "Counterspell", level: 3 }, prepared: true }],
      });
      expect(parseDDBCharacter(fixture).knownSpells).toContain("counterspell");
    });

    it("does not set knownSpells when spells array is empty", () => {
      expect(parseDDBCharacter(makeFixture({ spells: [] })).knownSpells).toBeUndefined();
    });

    it("does not set knownSpells when spells field is absent", () => {
      expect(parseDDBCharacter(makeFixture()).knownSpells).toBeUndefined();
    });

    it("handles entries with null definition gracefully", () => {
      const fixture = makeFixture({
        spells: [
          { definition: null, prepared: true },
          { definition: { name: "Fireball", level: 3 }, prepared: true },
        ],
      });
      const sheet = parseDDBCharacter(fixture);
      expect(sheet.knownSpells).toEqual(["fireball"]);
    });
  });
});
