import { describe, it, expect } from "vitest";
import { parseTopLevel } from "../commands";

const MENTION = "[@Alice](root://user/user-abc)";
const UID = "user-abc";

describe("parseTopLevel", () => {
  describe("!r — roll", () => {
    it("parses a single die expression", () => {
      const r = parseTopLevel("!r d20");
      expect(r?.kind).toBe("roll");
      if (r?.kind === "roll") expect(r.parts).toEqual(["d20"]);
    });

    it("parses multiple parts separated by semicolon", () => {
      const r = parseTopLevel("!r d20; 2d6+3");
      expect(r?.kind).toBe("roll");
      if (r?.kind === "roll") expect(r.parts).toEqual(["d20", "2d6+3"]);
    });

    it("is case-insensitive", () => {
      expect(parseTopLevel("!R 2d6")?.kind).toBe("roll");
    });

    it("returns null when no expression follows", () => {
      expect(parseTopLevel("!r")).toBeNull();
      expect(parseTopLevel("!r   ")).toBeNull();
    });
  });

  describe("!check — skill/ability checks", () => {
    it("parses a single ability check", () => {
      const r = parseTopLevel("!check str");
      expect(r?.kind).toBe("check");
      if (r?.kind === "check") {
        expect(r.parts[0].target).toBe("str");
        expect(r.parts[0].form).toBeUndefined();
      }
    });

    it("parses a check with form override", () => {
      const r = parseTopLevel("!check insight ingame");
      if (r?.kind === "check") {
        expect(r.parts[0].target).toBe("insight");
        expect(r.parts[0].form).toBe("ingame");
      }
    });

    it("parses multiple checks separated by semicolons", () => {
      const r = parseTopLevel("!check stealth; perception; str ingame");
      if (r?.kind === "check") {
        expect(r.parts).toHaveLength(3);
        expect(r.parts[2].form).toBe("ingame");
      }
    });
  });

  describe("!char use — set active form", () => {
    it("sets form to irl", () => {
      const r = parseTopLevel("!char use irl");
      expect(r?.kind).toBe("char_use");
      if (r?.kind === "char_use") {
        expect(r.form).toBe("irl");
        expect(r.targetUserId).toBeUndefined();
      }
    });

    it("sets form to ingame", () => {
      const r = parseTopLevel("!char use ingame");
      if (r?.kind === "char_use") expect(r.form).toBe("ingame");
    });

    it("parses target mention for DM use", () => {
      const r = parseTopLevel(`!char use irl ${MENTION}`);
      expect(r?.kind).toBe("char_use");
      if (r?.kind === "char_use") expect(r.targetUserId).toBe(UID);
    });

    it("is case-insensitive", () => {
      expect(parseTopLevel("!char use IRL")?.kind).toBe("char_use");
    });
  });

  describe("!char set pb — proficiency bonus", () => {
    it("parses a valid pb value", () => {
      const r = parseTopLevel("!char set pb 4");
      if (r?.kind === "char_set_pb") {
        expect(r.pb).toBe(4);
        expect(r.targetUserId).toBeUndefined();
      }
    });

    it("parses target mention", () => {
      const r = parseTopLevel(`!char set pb 4 ${MENTION}`);
      if (r?.kind === "char_set_pb") expect(r.targetUserId).toBe(UID);
    });
  });

  describe("!char set ability — single ability", () => {
    it("parses ability, form, and score", () => {
      const r = parseTopLevel("!char set ability str irl 16");
      if (r?.kind === "char_set_ability") {
        expect(r.ability).toBe("str");
        expect(r.form).toBe("irl");
        expect(r.score).toBe(16);
        expect(r.targetUserId).toBeUndefined();
      }
    });

    it("parses target mention", () => {
      const r = parseTopLevel(`!char set ability cha ingame 18 ${MENTION}`);
      if (r?.kind === "char_set_ability") {
        expect(r.ability).toBe("cha");
        expect(r.targetUserId).toBe(UID);
      }
    });

    it("returns null for unknown ability", () => {
      expect(parseTopLevel("!char set ability bananas irl 10")).toBeNull();
    });
  });

  describe("!char set abilities — bulk ability update", () => {
    it("parses multiple ability/score pairs", () => {
      const r = parseTopLevel("!char set abilities irl str 16 dex 14 con 12");
      if (r?.kind === "char_set_abilities") {
        expect(r.form).toBe("irl");
        expect(r.pairs).toContainEqual({ ability: "str", score: 16 });
        expect(r.pairs).toContainEqual({ ability: "dex", score: 14 });
        expect(r.targetUserId).toBeUndefined();
      }
    });

    it("parses target mention at the end", () => {
      const r = parseTopLevel(`!char set abilities irl str 16 dex 14 ${MENTION}`);
      if (r?.kind === "char_set_abilities") {
        expect(r.pairs).toHaveLength(2);
        expect(r.targetUserId).toBe(UID);
      }
    });
  });

  describe("!char prof skill — skill proficiency", () => {
    it("defaults to proficient (level 1)", () => {
      const r = parseTopLevel("!char prof skill insight");
      if (r?.kind === "char_prof_skill") {
        expect(r.skill).toBe("insight");
        expect(r.level).toBe(1);
        expect(r.targetUserId).toBeUndefined();
      }
    });

    it("sets expertise", () => {
      const r = parseTopLevel("!char prof skill intimidation exp");
      if (r?.kind === "char_prof_skill") expect(r.level).toBe(2);
    });

    it("removes proficiency with 'none'", () => {
      const r = parseTopLevel("!char prof skill stealth none");
      if (r?.kind === "char_prof_skill") expect(r.level).toBe(0);
    });

    it("parses target mention", () => {
      const r = parseTopLevel(`!char prof skill insight exp ${MENTION}`);
      if (r?.kind === "char_prof_skill") {
        expect(r.level).toBe(2);
        expect(r.targetUserId).toBe(UID);
      }
    });
  });

  describe("!sheet", () => {
    it("parses sheet command with no target", () => {
      const r = parseTopLevel("!sheet");
      expect(r?.kind).toBe("sheet");
      if (r?.kind === "sheet") expect(r.targetUserId).toBeUndefined();
    });

    it("parses sheet command with target mention", () => {
      const r = parseTopLevel(`!sheet ${MENTION}`);
      expect(r?.kind).toBe("sheet");
      if (r?.kind === "sheet") expect(r.targetUserId).toBe(UID);
    });

    it("parses !sheet reset with no target", () => {
      const r = parseTopLevel("!sheet reset");
      expect(r?.kind).toBe("sheet_reset");
      if (r?.kind === "sheet_reset") expect(r.targetUserId).toBeUndefined();
    });

    it("parses !sheet reset with target mention", () => {
      const r = parseTopLevel(`!sheet reset ${MENTION}`);
      expect(r?.kind).toBe("sheet_reset");
      if (r?.kind === "sheet_reset") expect(r.targetUserId).toBe(UID);
    });
  });

  describe("!dm — dungeon master management", () => {
    it("parses dm claim", () => {
      expect(parseTopLevel("!dm claim")?.kind).toBe("dm_claim");
    });

    it("parses dm list", () => {
      expect(parseTopLevel("!dm list")?.kind).toBe("dm_list");
    });

    it("parses dm add with mention", () => {
      const r = parseTopLevel(`!dm add ${MENTION}`);
      expect(r?.kind).toBe("dm_add");
      if (r?.kind === "dm_add") expect(r.targetUserId).toBe(UID);
    });

    it("parses dm remove with mention", () => {
      const r = parseTopLevel(`!dm remove ${MENTION}`);
      expect(r?.kind).toBe("dm_remove");
      if (r?.kind === "dm_remove") expect(r.targetUserId).toBe(UID);
    });

    it("returns null for dm add without a mention", () => {
      expect(parseTopLevel("!dm add Alice")).toBeNull();
    });
  });

  describe("!inv — inventory", () => {
    it("parses bare !inv", () => {
      const r = parseTopLevel("!inv");
      expect(r?.kind).toBe("inv_show");
      if (r?.kind === "inv_show") expect(r.targetUserId).toBeUndefined();
    });

    it("parses !inv with target mention", () => {
      const r = parseTopLevel(`!inv ${MENTION}`);
      expect(r?.kind).toBe("inv_show");
      if (r?.kind === "inv_show") expect(r.targetUserId).toBe(UID);
    });

    it("parses !inv add with single-word item", () => {
      const r = parseTopLevel("!inv add Sword");
      expect(r?.kind).toBe("inv_add");
      if (r?.kind === "inv_add") {
        expect(r.items).toHaveLength(1);
        expect(r.items[0].item).toBe("Sword");
        expect(r.items[0].qty).toBe(1);
        expect(r.targetUserId).toBeUndefined();
      }
    });

    it("parses !inv add with multi-word item", () => {
      const r = parseTopLevel("!inv add Sword of Fire");
      if (r?.kind === "inv_add") {
        expect(r.items[0].item).toBe("Sword of Fire");
        expect(r.items[0].qty).toBe(1);
      }
    });

    it("parses !inv add with quantity", () => {
      const r = parseTopLevel("!inv add Arrows 20");
      if (r?.kind === "inv_add") {
        expect(r.items[0].item).toBe("Arrows");
        expect(r.items[0].qty).toBe(20);
      }
    });

    it("parses !inv add with multi-word item and quantity", () => {
      const r = parseTopLevel("!inv add Iron Rations 5");
      if (r?.kind === "inv_add") {
        expect(r.items[0].item).toBe("Iron Rations");
        expect(r.items[0].qty).toBe(5);
      }
    });

    it("parses !inv add with item and target mention", () => {
      const r = parseTopLevel(`!inv add Potion of Healing ${MENTION}`);
      if (r?.kind === "inv_add") {
        expect(r.items[0].item).toBe("Potion of Healing");
        expect(r.items[0].qty).toBe(1);
        expect(r.targetUserId).toBe(UID);
      }
    });

    it("parses !inv add with quantity and target mention", () => {
      const r = parseTopLevel(`!inv add Arrows 10 ${MENTION}`);
      if (r?.kind === "inv_add") {
        expect(r.items[0].item).toBe("Arrows");
        expect(r.items[0].qty).toBe(10);
        expect(r.targetUserId).toBe(UID);
      }
    });

    it("parses multiple items separated by semicolons", () => {
      const r = parseTopLevel("!inv add Arrows 20; Rations 5; Rope");
      expect(r?.kind).toBe("inv_add");
      if (r?.kind === "inv_add") {
        expect(r.items).toHaveLength(3);
        expect(r.items[0]).toEqual({ item: "Arrows", qty: 20 });
        expect(r.items[1]).toEqual({ item: "Rations", qty: 5 });
        expect(r.items[2]).toEqual({ item: "Rope", qty: 1 });
        expect(r.targetUserId).toBeUndefined();
      }
    });

    it("parses bulk add with target mention", () => {
      const r = parseTopLevel(`!inv add Sword; Shield ${MENTION}`);
      if (r?.kind === "inv_add") {
        expect(r.items).toHaveLength(2);
        expect(r.items[0].item).toBe("Sword");
        expect(r.items[1].item).toBe("Shield");
        expect(r.targetUserId).toBe(UID);
      }
    });

    it("parses !inv remove", () => {
      const r = parseTopLevel("!inv remove Sword of Fire");
      expect(r?.kind).toBe("inv_remove");
      if (r?.kind === "inv_remove") {
        expect(r.item).toBe("Sword of Fire");
        expect(r.qty).toBe(1);
      }
    });

    it("parses !inv remove with quantity", () => {
      const r = parseTopLevel("!inv remove Arrows 5");
      if (r?.kind === "inv_remove") {
        expect(r.item).toBe("Arrows");
        expect(r.qty).toBe(5);
      }
    });

    it("parses !inv remove with target mention", () => {
      const r = parseTopLevel(`!inv remove Shield ${MENTION}`);
      if (r?.kind === "inv_remove") expect(r.targetUserId).toBe(UID);
    });

    it("parses !inv clear with no target", () => {
      const r = parseTopLevel("!inv clear");
      expect(r?.kind).toBe("inv_clear");
      if (r?.kind === "inv_clear") expect(r.targetUserId).toBeUndefined();
    });

    it("parses !inv clear with target mention", () => {
      const r = parseTopLevel(`!inv clear ${MENTION}`);
      expect(r?.kind).toBe("inv_clear");
      if (r?.kind === "inv_clear") expect(r.targetUserId).toBe(UID);
    });
  });

  describe("!help", () => {
    it("parses help with no topic", () => {
      const r = parseTopLevel("!help");
      if (r?.kind === "help") expect(r.topic).toBeUndefined();
    });

    it("parses help with a topic", () => {
      const r = parseTopLevel("!help roll");
      if (r?.kind === "help") expect(r.topic).toBe("roll");
    });

    it("parses help for dm topic", () => {
      const r = parseTopLevel("!help dm");
      if (r?.kind === "help") expect(r.topic).toBe("dm");
    });

    it("parses help for inv topic", () => {
      const r = parseTopLevel("!help inv");
      if (r?.kind === "help") expect(r.topic).toBe("inv");
    });
  });

  describe("!lib — item library", () => {
    it("parses !lib add with weight, price, and description (no color)", () => {
      const r = parseTopLevel("!lib add longsword 3 15 A sturdy blade.");
      expect(r?.kind).toBe("lib_add");
      if (r?.kind === "lib_add") {
        expect(r.items).toHaveLength(1);
        expect(r.items[0].name).toBe("longsword");
        expect(r.items[0].weight).toBe(3);
        expect(r.items[0].price).toBe(15);
        expect(r.items[0].color).toBe(37);
        expect(r.items[0].description).toBe("A sturdy blade.");
      }
    });

    it("parses !lib add with explicit color before description", () => {
      const r = parseTopLevel("!lib add mithral 2 500 35 A shimmering blade.");
      if (r?.kind === "lib_add") {
        expect(r.items[0].color).toBe(35);
        expect(r.items[0].description).toBe("A shimmering blade.");
      }
    });

    it("parses !lib add with color and no description", () => {
      const r = parseTopLevel("!lib add mithral 2 500 35");
      if (r?.kind === "lib_add") {
        expect(r.items[0].color).toBe(35);
        expect(r.items[0].description).toBe("");
      }
    });

    it("defaults color to 37 when not provided", () => {
      const r = parseTopLevel("!lib add dagger 1.5 2");
      if (r?.kind === "lib_add") {
        expect(r.items[0].color).toBe(37);
        expect(r.items[0].weight).toBe(1.5);
        expect(r.items[0].description).toBe("");
      }
    });

    it("parses multiple items separated by semicolons", () => {
      const r = parseTopLevel("!lib add longsword 3 15 37 A blade; dagger 1 5 37; torch 1 0.01");
      expect(r?.kind).toBe("lib_add");
      if (r?.kind === "lib_add") {
        expect(r.items).toHaveLength(3);
        expect(r.items[0].name).toBe("longsword");
        expect(r.items[0].description).toBe("A blade");
        expect(r.items[1].name).toBe("dagger");
        expect(r.items[1].price).toBe(5);
        expect(r.items[2].name).toBe("torch");
        expect(r.items[2].weight).toBe(1);
      }
    });

    it("parses !lib del", () => {
      const r = parseTopLevel("!lib del longsword");
      expect(r?.kind).toBe("lib_del");
      if (r?.kind === "lib_del") expect(r.name).toBe("longsword");
    });

    it("parses !lib check", () => {
      const r = parseTopLevel("!lib check longsword");
      expect(r?.kind).toBe("lib_check");
      if (r?.kind === "lib_check") expect(r.name).toBe("longsword");
    });

    it("parses !lib list with no filter", () => {
      const r = parseTopLevel("!lib list");
      expect(r?.kind).toBe("lib_list");
      if (r?.kind === "lib_list") expect(r.filter).toBeUndefined();
    });

    it("parses !lib list with filter", () => {
      const r = parseTopLevel("!lib list s");
      if (r?.kind === "lib_list") expect(r.filter).toBe("s");
    });
  });

  describe("!char set hp / maxhp / hd / adjust hp", () => {
    it("parses !char set hp", () => {
      const r = parseTopLevel("!char set hp 25");
      expect(r?.kind).toBe("char_set_hp");
      if (r?.kind === "char_set_hp") {
        expect(r.value).toBe(25);
        expect(r.targetUserId).toBeUndefined();
      }
    });

    it("parses !char set hp with target", () => {
      const r = parseTopLevel(`!char set hp 25 ${MENTION}`);
      if (r?.kind === "char_set_hp") expect(r.targetUserId).toBe(UID);
    });

    it("parses !char set maxhp", () => {
      const r = parseTopLevel("!char set maxhp 30");
      expect(r?.kind).toBe("char_set_maxhp");
      if (r?.kind === "char_set_maxhp") expect(r.value).toBe(30);
    });

    it("parses !char set hd", () => {
      const r = parseTopLevel("!char set hd 8");
      expect(r?.kind).toBe("char_set_hd");
      if (r?.kind === "char_set_hd") expect(r.value).toBe(8);
    });

    it("parses !char adjust hp with positive delta", () => {
      const r = parseTopLevel("!char adjust hp 5");
      expect(r?.kind).toBe("char_adjust_hp");
      if (r?.kind === "char_adjust_hp") expect(r.delta).toBe(5);
    });

    it("parses !char adjust hp with negative delta", () => {
      const r = parseTopLevel("!char adjust hp -8");
      expect(r?.kind).toBe("char_adjust_hp");
      if (r?.kind === "char_adjust_hp") expect(r.delta).toBe(-8);
    });

    it("parses !char adjust hp with target", () => {
      const r = parseTopLevel(`!char adjust hp -3 ${MENTION}`);
      if (r?.kind === "char_adjust_hp") {
        expect(r.delta).toBe(-3);
        expect(r.targetUserId).toBe(UID);
      }
    });
  });

  describe("!exp — experience", () => {
    it("parses positive exp award", () => {
      const r = parseTopLevel("!exp 300");
      expect(r?.kind).toBe("exp_add");
      if (r?.kind === "exp_add") {
        expect(r.amount).toBe(300);
        expect(r.targetUserId).toBeUndefined();
      }
    });

    it("parses negative exp", () => {
      const r = parseTopLevel("!exp -100");
      if (r?.kind === "exp_add") expect(r.amount).toBe(-100);
    });

    it("parses exp with target mention", () => {
      const r = parseTopLevel(`!exp 500 ${MENTION}`);
      if (r?.kind === "exp_add") {
        expect(r.amount).toBe(500);
        expect(r.targetUserId).toBe(UID);
      }
    });
  });

  describe("!char set class / caster / slot / save / temphp", () => {
    it("parses !char set class", () => {
      const r = parseTopLevel("!char set class Wizard");
      expect(r?.kind).toBe("char_set_class");
      if (r?.kind === "char_set_class") expect(r.value).toBe("Wizard");
    });

    it("parses !char set class with target", () => {
      const r = parseTopLevel(`!char set class Sorcerer ${MENTION}`);
      if (r?.kind === "char_set_class") {
        expect(r.value).toBe("Sorcerer");
        expect(r.targetUserId).toBe(UID);
      }
    });

    it("parses !char set caster full", () => {
      const r = parseTopLevel("!char set caster full");
      expect(r?.kind).toBe("char_set_caster");
      if (r?.kind === "char_set_caster") expect(r.casterType).toBe("full");
    });

    it("parses !char set caster half", () => {
      const r = parseTopLevel("!char set caster half");
      if (r?.kind === "char_set_caster") expect(r.casterType).toBe("half");
    });

    it("parses !char set caster none", () => {
      const r = parseTopLevel("!char set caster none");
      if (r?.kind === "char_set_caster") expect(r.casterType).toBe("none");
    });

    it("parses !char set slot", () => {
      const r = parseTopLevel("!char set slot 3 2");
      expect(r?.kind).toBe("char_set_slot");
      if (r?.kind === "char_set_slot") {
        expect(r.level).toBe(3);
        expect(r.value).toBe(2);
      }
    });

    it("parses !char set maxslot", () => {
      const r = parseTopLevel("!char set maxslot 1 4");
      expect(r?.kind).toBe("char_set_maxslot");
      if (r?.kind === "char_set_maxslot") {
        expect(r.level).toBe(1);
        expect(r.value).toBe(4);
      }
    });

    it("parses !char set maxslot with target", () => {
      const r = parseTopLevel(`!char set maxslot 2 3 ${MENTION}`);
      if (r?.kind === "char_set_maxslot") expect(r.targetUserId).toBe(UID);
    });

    it("parses !char prof save — proficient", () => {
      const r = parseTopLevel("!char prof save con");
      expect(r?.kind).toBe("char_prof_save");
      if (r?.kind === "char_prof_save") {
        expect(r.ability).toBe("con");
        expect(r.proficient).toBe(true);
      }
    });

    it("parses !char prof save — remove with none", () => {
      const r = parseTopLevel("!char prof save con none");
      if (r?.kind === "char_prof_save") {
        expect(r.ability).toBe("con");
        expect(r.proficient).toBe(false);
      }
    });

    it("parses !char prof save with full ability name", () => {
      const r = parseTopLevel("!char prof save wisdom");
      if (r?.kind === "char_prof_save") expect(r.ability).toBe("wis");
    });

    it("parses !char prof save with target", () => {
      const r = parseTopLevel(`!char prof save str ${MENTION}`);
      if (r?.kind === "char_prof_save") {
        expect(r.ability).toBe("str");
        expect(r.proficient).toBe(true);
        expect(r.targetUserId).toBe(UID);
      }
    });

    it("parses !char set temphp", () => {
      const r = parseTopLevel("!char set temphp 10");
      expect(r?.kind).toBe("char_set_temphp");
      if (r?.kind === "char_set_temphp") expect(r.value).toBe(10);
    });

    it("parses !char set temphp with target", () => {
      const r = parseTopLevel(`!char set temphp 5 ${MENTION}`);
      if (r?.kind === "char_set_temphp") expect(r.targetUserId).toBe(UID);
    });
  });

  describe("!rest — long and short rest", () => {
    it("parses !rest long", () => {
      expect(parseTopLevel("!rest long")?.kind).toBe("rest_long");
    });

    it("parses !rest long with target", () => {
      const r = parseTopLevel(`!rest long ${MENTION}`);
      if (r?.kind === "rest_long") expect(r.targetUserId).toBe(UID);
    });

    it("parses !rest short with default 1 die", () => {
      const r = parseTopLevel("!rest short");
      expect(r?.kind).toBe("rest_short");
      if (r?.kind === "rest_short") {
        expect(r.dice).toBe(1);
        expect(r.targetUserId).toBeUndefined();
      }
    });

    it("parses !rest short with explicit dice count", () => {
      const r = parseTopLevel("!rest short 3");
      if (r?.kind === "rest_short") expect(r.dice).toBe(3);
    });

    it("parses !rest short with target and no dice", () => {
      const r = parseTopLevel(`!rest short ${MENTION}`);
      if (r?.kind === "rest_short") {
        expect(r.dice).toBe(1);
        expect(r.targetUserId).toBe(UID);
      }
    });

    it("parses !rest short with dice and target", () => {
      const r = parseTopLevel(`!rest short 2 ${MENTION}`);
      if (r?.kind === "rest_short") {
        expect(r.dice).toBe(2);
        expect(r.targetUserId).toBe(UID);
      }
    });

    it("returns null for unknown rest type", () => {
      expect(parseTopLevel("!rest medium")).toBeNull();
    });
  });

  describe("!cast blind — slot deduction without spell lookup", () => {
    it("parses !cast blind with a valid level", () => {
      const r = parseTopLevel("!cast blind 3");
      expect(r?.kind).toBe("cast");
      if (r?.kind === "cast") expect(r.level).toBe(3);
    });

    it("accepts !cast blind 9", () => {
      const r = parseTopLevel("!cast blind 9");
      if (r?.kind === "cast") expect(r.level).toBe(9);
    });

    it("!cast blind 0 falls through to spell_cast (0 not a valid slot level)", () => {
      // "blind 0" gets treated as a spell name — will fail at API lookup
      expect(parseTopLevel("!cast blind 0")?.kind).toBe("spell_cast");
    });

    it("old !cast <level> no longer matches", () => {
      expect(parseTopLevel("!cast 3")?.kind).not.toBe("cast");
    });
  });

  describe("!cast <spell> — spell casting", () => {
    it("parses spell name with no level", () => {
      const r = parseTopLevel("!cast fireball");
      expect(r?.kind).toBe("spell_cast");
      if (r?.kind === "spell_cast") {
        expect(r.spell).toBe("fireball");
        expect(r.level).toBeUndefined();
      }
    });

    it("parses multi-word spell name", () => {
      const r = parseTopLevel("!cast cure wounds");
      if (r?.kind === "spell_cast") {
        expect(r.spell).toBe("cure wounds");
        expect(r.level).toBeUndefined();
      }
    });

    it("parses spell name with slot level", () => {
      const r = parseTopLevel("!cast fireball 5");
      if (r?.kind === "spell_cast") {
        expect(r.spell).toBe("fireball");
        expect(r.level).toBe(5);
      }
    });

    it("parses multi-word spell with slot level", () => {
      const r = parseTopLevel("!cast cure wounds 3");
      if (r?.kind === "spell_cast") {
        expect(r.spell).toBe("cure wounds");
        expect(r.level).toBe(3);
      }
    });

    it("blind keyword with level routes to cast, not spell_cast", () => {
      const r = parseTopLevel("!cast blind 3");
      expect(r?.kind).toBe("cast");
    });
  });

  describe("!spells — known spells management", () => {
    it("parses !spells show", () => {
      expect(parseTopLevel("!spells")?.kind).toBe("spells_show");
    });

    it("parses !spell (singular) as show", () => {
      expect(parseTopLevel("!spell")?.kind).toBe("spells_show");
    });

    it("parses !spells add", () => {
      const r = parseTopLevel("!spells add fireball");
      expect(r?.kind).toBe("spells_add");
      if (r?.kind === "spells_add") expect(r.spell).toBe("fireball");
    });

    it("lowercases the spell name on add", () => {
      const r = parseTopLevel("!spells add Cure Wounds");
      if (r?.kind === "spells_add") expect(r.spell).toBe("cure wounds");
    });

    it("parses !spells remove", () => {
      const r = parseTopLevel("!spells remove fireball");
      expect(r?.kind).toBe("spells_remove");
      if (r?.kind === "spells_remove") expect(r.spell).toBe("fireball");
    });

    it("parses !spells clear", () => {
      expect(parseTopLevel("!spells clear")?.kind).toBe("spells_clear");
    });
  });

  describe("!attack — weapon attack", () => {
    it("parses !attack with a single-word weapon", () => {
      const r = parseTopLevel("!attack longsword");
      expect(r?.kind).toBe("attack");
      if (r?.kind === "attack") {
        expect(r.weapon).toBe("longsword");
        expect(r.advantage).toBeUndefined();
      }
    });

    it("parses !atk as an alias", () => {
      expect(parseTopLevel("!atk longsword")?.kind).toBe("attack");
    });

    it("parses multi-word weapon name", () => {
      const r = parseTopLevel("!attack hand crossbow");
      if (r?.kind === "attack") expect(r.weapon).toBe("hand crossbow");
    });

    it("parses advantage suffix", () => {
      const r = parseTopLevel("!attack longsword adv");
      if (r?.kind === "attack") {
        expect(r.weapon).toBe("longsword");
        expect(r.advantage).toBe("adv");
      }
    });

    it("parses full 'advantage' keyword", () => {
      const r = parseTopLevel("!attack longsword advantage");
      if (r?.kind === "attack") expect(r.advantage).toBe("adv");
    });

    it("parses disadvantage suffix", () => {
      const r = parseTopLevel("!attack longsword dis");
      if (r?.kind === "attack") expect(r.advantage).toBe("dis");
    });

    it("parses full 'disadvantage' keyword", () => {
      const r = parseTopLevel("!attack longsword disadvantage");
      if (r?.kind === "attack") expect(r.advantage).toBe("dis");
    });

    it("parses multi-word weapon with advantage", () => {
      const r = parseTopLevel("!attack hand crossbow adv");
      if (r?.kind === "attack") {
        expect(r.weapon).toBe("hand crossbow");
        expect(r.advantage).toBe("adv");
      }
    });
  });

  describe("!exprank", () => {
    it("parses !exprank", () => {
      expect(parseTopLevel("!exprank")?.kind).toBe("exp_rank");
    });

    it("is case-insensitive", () => {
      expect(parseTopLevel("!EXPRANK")?.kind).toBe("exp_rank");
    });

    it("returns null for !exprank with extra args", () => {
      expect(parseTopLevel("!exprank foo")).toBeNull();
    });
  });

  describe("!cal — calendar", () => {
    it("parses !cal show", () => {
      expect(parseTopLevel("!cal")?.kind).toBe("cal_show");
    });

    it("parses !cal add with date and event", () => {
      const r = parseTopLevel("!cal add 20260115 Winter Solstice Festival");
      expect(r?.kind).toBe("cal_add");
      if (r?.kind === "cal_add") {
        expect(r.date).toBe(20260115);
        expect(r.event).toBe("Winter Solstice Festival");
      }
    });

    it("parses !cal add with multi-word event", () => {
      const r = parseTopLevel("!cal add 20260601 The Battle of Thornwood begins");
      if (r?.kind === "cal_add") {
        expect(r.date).toBe(20260601);
        expect(r.event).toBe("The Battle of Thornwood begins");
      }
    });

    it("requires exactly 8 digits for date", () => {
      expect(parseTopLevel("!cal add 2026115 Short date")).toBeNull();
      expect(parseTopLevel("!cal add 202601150 Long date")).toBeNull();
    });

    it("parses !cal del", () => {
      const r = parseTopLevel("!cal del 20260115");
      expect(r?.kind).toBe("cal_del");
      if (r?.kind === "cal_del") expect(r.date).toBe(20260115);
    });

    it("returns null for !cal del without date", () => {
      expect(parseTopLevel("!cal del")).toBeNull();
    });
  });

  describe("unrecognized input", () => {
    it("returns null for empty string", () => expect(parseTopLevel("")).toBeNull());
    it("returns null for plain text", () => expect(parseTopLevel("hello there")).toBeNull());
    it("returns null for unknown command", () => expect(parseTopLevel("!unknown")).toBeNull());
  });
});
