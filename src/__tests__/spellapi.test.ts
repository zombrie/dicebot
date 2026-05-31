import { describe, it, expect } from "vitest";
import { formatSpell, getDamageForLevel, type Open5eSpell } from "../spellapi";

function makeSpell(overrides: Partial<Open5eSpell> = {}): Open5eSpell {
  return {
    name: "Fireball",
    level: 3,
    school: { name: "Evocation", key: "evocation" },
    casting_time: "action",
    range_text: "150 feet",
    duration: "Instantaneous",
    concentration: false,
    ritual: false,
    verbal: true,
    somatic: true,
    material: true,
    material_specified: "A tiny ball of bat guano and sulfur",
    material_cost: null,
    desc: "A bright streak flashes from your pointing finger to a point you choose within range and then blossoms with a low roar into an explosion of flame.",
    higher_level: "When you cast this spell using a slot of 4th level or higher, the damage increases by 1d6 for each slot level above 3rd.",
    damage_roll: "8d6",
    damage_types: ["fire"],
    saving_throw_ability: "dexterity",
    attack_roll: false,
    ...overrides,
  };
}

describe("formatSpell", () => {
  it("includes the spell name", () => {
    expect(formatSpell(makeSpell())).toContain("Fireball");
  });

  it("shows level and school", () => {
    const out = formatSpell(makeSpell());
    expect(out).toContain("3rd-level");
    expect(out).toContain("Evocation");
  });

  it("handles cantrip level 0", () => {
    const out = formatSpell(makeSpell({ name: "Fire Bolt", level: 0 }));
    expect(out).toContain("Cantrip");
    expect(out).not.toContain("0th");
  });

  it("maps 'action' casting time to '1 action'", () => {
    expect(formatSpell(makeSpell())).toContain("1 action");
  });

  it("maps 'bonus' casting time to '1 bonus action'", () => {
    expect(formatSpell(makeSpell({ casting_time: "bonus" }))).toContain("1 bonus action");
  });

  it("shows range", () => {
    expect(formatSpell(makeSpell())).toContain("150 feet");
  });

  it("shows duration", () => {
    expect(formatSpell(makeSpell())).toContain("Instantaneous");
  });

  it("shows concentration tag when true", () => {
    expect(formatSpell(makeSpell({ concentration: true }))).toContain("concentration");
  });

  it("does not show concentration tag when false", () => {
    expect(formatSpell(makeSpell({ concentration: false }))).not.toContain("concentration");
  });

  it("shows ritual tag when true", () => {
    expect(formatSpell(makeSpell({ ritual: true }))).toContain("ritual");
  });

  it("shows V, S, M components", () => {
    const out = formatSpell(makeSpell());
    expect(out).toContain("V");
    expect(out).toContain("S");
    expect(out).toContain("M");
  });

  it("shows material description", () => {
    expect(formatSpell(makeSpell())).toContain("bat guano");
  });

  it("omits M component when material is false", () => {
    const out = formatSpell(makeSpell({ material: false, material_specified: null }));
    expect(out).not.toContain("bat guano");
  });

  it("shows damage roll and type", () => {
    const out = formatSpell(makeSpell());
    expect(out).toContain("8d6");
    expect(out).toContain("fire");
  });

  it("shows saving throw ability uppercased", () => {
    expect(formatSpell(makeSpell())).toContain("DEXTERITY");
  });

  it("shows the description", () => {
    expect(formatSpell(makeSpell())).toContain("bright streak");
  });

  it("shows higher level text", () => {
    expect(formatSpell(makeSpell())).toContain("At Higher Levels");
    expect(formatSpell(makeSpell())).toContain("4th level or higher");
  });

  it("omits higher level section when not present", () => {
    const out = formatSpell(makeSpell({ higher_level: null }));
    expect(out).not.toContain("At Higher Levels");
  });

  it("handles school as plain string", () => {
    const out = formatSpell(makeSpell({ school: "transmutation" }));
    expect(out).toContain("transmutation");
  });

  it("shows attack roll note when no damage and attack_roll is true", () => {
    const out = formatSpell(makeSpell({ damage_roll: null, damage_types: [], saving_throw_ability: null, attack_roll: true }));
    expect(out).not.toContain("8d6");
  });
});

describe("getDamageForLevel", () => {
  it("returns base damage_roll at minimum level", () => {
    const spell = makeSpell({ damage_roll: "8d6", level: 3 });
    const result = getDamageForLevel(spell, 3);
    expect(result?.roll).toBe("8d6");
    expect(result?.exact).toBe(true);
  });

  it("returns base roll at higher level when no casting_options", () => {
    const spell = makeSpell({ damage_roll: "8d6", level: 3 });
    const result = getDamageForLevel(spell, 5);
    expect(result?.roll).toBe("8d6");
    expect(result?.exact).toBe(false);
  });

  it("uses specific casting_option when available", () => {
    const spell = makeSpell({
      damage_roll: "8d6",
      level: 3,
      casting_options: [
        { type: "default", damage_roll: "8d6" },
        { type: "slot_level_5", damage_roll: "10d6" },
      ],
    });
    const result = getDamageForLevel(spell, 5);
    expect(result?.roll).toBe("10d6");
    expect(result?.exact).toBe(true);
  });

  it("falls back to default casting_option when no exact level match", () => {
    const spell = makeSpell({
      damage_roll: "8d6",
      level: 3,
      casting_options: [
        { type: "default", damage_roll: "8d6" },
        { type: "slot_level_9", damage_roll: "14d6" },
      ],
    });
    const result = getDamageForLevel(spell, 5);
    expect(result?.roll).toBe("8d6");
    expect(result?.exact).toBe(false);
  });

  it("returns null when spell has no damage", () => {
    const spell = makeSpell({ damage_roll: null, casting_options: [] });
    expect(getDamageForLevel(spell, 1)).toBeNull();
  });

  it("truncates very long descriptions", () => {
    const longDesc = "x".repeat(2000);
    const out = formatSpell(makeSpell({ desc: longDesc }));
    expect(out).toContain("…");
    expect(out.length).toBeLessThan(1800);
  });
});
