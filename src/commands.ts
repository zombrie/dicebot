// Parses raw message text into typed ParsedCommand values. Pattern order matters: more specific patterns must come before general ones.
import type { Ability, Form, ProfLevel, CasterType } from "./skills";
import { ABILITY_ALIASES } from "./skills";
import { parseDDBId } from "./ddbimport";
import { splitParts } from "./dice";
import { extractTrailingMention, parseMentionId } from "./mentions";

type AbilityPair = { ability: Ability; score: number };

// Regex fragment: captures the user ID from a Root @mention
const M = String.raw`\[@[^\]]*\]\(root://user/([^)]+)\)`;

export type ParsedCommand =
  | { kind: "roll"; parts: string[] }
  | { kind: "check"; parts: Array<{ target: string; form?: Form }> }
  | { kind: "char_use"; form: Form; targetUserId?: string }
  | { kind: "char_set_pb"; pb: number; targetUserId?: string }
  | { kind: "char_set_ability"; ability: Ability; form: Form; score: number; targetUserId?: string }
  | { kind: "char_set_abilities"; form: Form; pairs: AbilityPair[]; targetUserId?: string }
  | { kind: "char_prof_skill"; skill: string; level: ProfLevel; targetUserId?: string }
  | { kind: "sheet"; targetUserId?: string }
  | { kind: "sheet_reset"; targetUserId?: string }
  | { kind: "help"; topic?: string }
  | { kind: "dm_claim" }
  | { kind: "dm_add"; targetUserId: string }
  | { kind: "dm_remove"; targetUserId: string }
  | { kind: "dm_list" }
  | { kind: "inv_show"; targetUserId?: string }
  | { kind: "inv_add"; items: Array<{ item: string; qty: number }>; targetUserId?: string }
  | { kind: "inv_remove"; item: string; qty: number; targetUserId?: string }
  | { kind: "inv_clear"; targetUserId?: string }
  | { kind: "lib_add"; items: Array<{ name: string; weight: number; price: number; color: number; description: string }> }
  | { kind: "lib_del"; name: string }
  | { kind: "lib_check"; name: string }
  | { kind: "lib_list"; filter?: string }
  | { kind: "char_set_hp"; value: number; targetUserId?: string }
  | { kind: "char_set_maxhp"; value: number; targetUserId?: string }
  | { kind: "char_adjust_hp"; delta: number; targetUserId?: string }
  | { kind: "char_set_hd"; value: number; targetUserId?: string }
  | { kind: "char_set_class"; value: string; targetUserId?: string }
  | { kind: "char_set_caster"; casterType: CasterType; targetUserId?: string }
  | { kind: "char_set_slot"; level: number; value: number; targetUserId?: string }
  | { kind: "char_set_maxslot"; level: number; value: number; targetUserId?: string }
  | { kind: "char_prof_save"; ability: Ability; proficient: boolean; targetUserId?: string }
  | { kind: "char_set_temphp"; value: number; targetUserId?: string }
  | { kind: "exp_add"; amount: number; targetUserId?: string }
  | { kind: "exp_rank" }
  | { kind: "cal_show" }
  | { kind: "cal_add"; date: number; event: string }
  | { kind: "cal_del"; date: number }
  | { kind: "spell_lookup"; name: string }
  | { kind: "rest_long"; targetUserId?: string }
  | { kind: "rest_short"; dice: number; targetUserId?: string }
  | { kind: "cast"; level: number }
  | { kind: "spell_cast"; spell: string; level?: number }
  | { kind: "attack"; weapon: string; advantage?: "adv" | "dis" }
  | { kind: "spells_show" }
  | { kind: "spells_add"; spell: string }
  | { kind: "spells_remove"; spell: string }
  | { kind: "spells_clear" }
  | { kind: "ddb_import"; characterId: string; targetUserId?: string }
  | { kind: "npc_create"; name: string }
  | { kind: "npc_list" }
  | { kind: "npc_delete"; name: string }
  | { kind: "npc_sheet"; name: string }
  | { kind: "npc_reset"; name: string }
  | { kind: "npc_use"; name: string; form: Form }
  | { kind: "npc_set_pb"; name: string; pb: number }
  | { kind: "npc_set_ability"; name: string; ability: Ability; form: Form; score: number }
  | { kind: "npc_set_abilities"; name: string; form: Form; pairs: AbilityPair[] }
  | { kind: "npc_prof_skill"; name: string; skill: string; level: ProfLevel }
  | { kind: "npc_prof_save"; name: string; ability: Ability; proficient: boolean }
  | { kind: "npc_set_class"; name: string; value: string }
  | { kind: "npc_set_caster"; name: string; casterType: CasterType }
  | { kind: "npc_set_slot"; name: string; level: number; value: number }
  | { kind: "npc_set_maxslot"; name: string; level: number; value: number }
  | { kind: "npc_set_hp"; name: string; value: number }
  | { kind: "npc_set_maxhp"; name: string; value: number }
  | { kind: "npc_set_temphp"; name: string; value: number }
  | { kind: "npc_adjust_hp"; name: string; delta: number }
  | { kind: "npc_set_hd"; name: string; value: number }
  | { kind: "npc_rest_long"; name: string }
  | { kind: "npc_rest_short"; name: string; dice: number }
  | { kind: "npc_exp"; name: string; amount: number }
  | { kind: "npc_inv_show"; name: string }
  | { kind: "npc_inv_add"; name: string; items: Array<{ item: string; qty: number }> }
  | { kind: "npc_inv_remove"; name: string; item: string; qty: number }
  | { kind: "npc_inv_clear"; name: string }
  | { kind: "npc_cast"; name: string; level: number }
  | { kind: "npc_spell_cast"; name: string; spell: string; level?: number }
  | { kind: "npc_spells_show"; name: string }
  | { kind: "npc_spells_add"; name: string; spell: string }
  | { kind: "npc_spells_remove"; name: string; spell: string }
  | { kind: "npc_spells_clear"; name: string };

function extractQty(s: string): [string, number] {
  const m = s.match(/^(.*\S)\s+(\d+)\s*$/);
  if (m) {
    const qty = parseInt(m[2], 10);
    if (qty > 0) return [m[1].trim(), qty];
  }
  return [s.trim(), 1];
}

function parseForm(value: unknown): Form {
  if (typeof value !== "string") return "irl";
  const v = value.toLowerCase();
  return v === "irl" || v === "ingame" ? v : "irl";
}

function parseAbility(value: string): Ability | undefined {
  return ABILITY_ALIASES[value.toLowerCase()];
}

export function parseTopLevel(text: string): ParsedCommand | null {
  const trimmed = text.trim();

  // !r ...
  {
    const m = trimmed.match(/^!r(?:\s+(.+))?\s*$/i);
    if (m) {
      const rest = (m[1] ?? "").trim();
      if (!rest) return null;
      return { kind: "roll", parts: splitParts(rest) };
    }
  }

  // !check ...
  {
    const m = trimmed.match(/^!check\s+(.+)$/i);
    if (m) {
      const chunks = splitParts(m[1]);
      const parts = chunks.map(chunk => {
        const mm = chunk.match(/^(.+?)(?:\s+(irl|ingame))?\s*$/i);
        return { target: (mm?.[1] ?? chunk).trim(), form: (mm?.[2]?.toLowerCase() as Form | undefined) };
      });
      return { kind: "check", parts };
    }
  }

  // !char use irl|ingame [@user]?
  {
    const m = trimmed.match(new RegExp(String.raw`^!char\s+use\s+(irl|ingame)(?:\s+${M})?\s*$`, "i"));
    if (m) return { kind: "char_use", form: m[1].toLowerCase() as Form, targetUserId: m[2] };
  }

  // !char set pb N [@user]?
  {
    const m = trimmed.match(new RegExp(String.raw`^!char\s+set\s+pb\s+(-?\d+)(?:\s+${M})?\s*$`, "i"));
    if (m) return { kind: "char_set_pb", pb: Number(m[1]), targetUserId: m[2] };
  }

  // !char set ability <ab> <form> <score> [@user]?
  {
    const m = trimmed.match(new RegExp(String.raw`^!char\s+set\s+ability\s+([a-zA-Z]+)\s+(irl|ingame)\s+(-?\d+)(?:\s+${M})?\s*$`, "i"));
    if (m) {
      const ability = parseAbility(m[1]);
      if (!ability) return null;
      return { kind: "char_set_ability", ability, form: parseForm(m[2]), score: Number(m[3]), targetUserId: m[4] };
    }
  }

  // !char set abilities <form> (<ab> <score>)+ [@user]?
  {
    const m = trimmed.match(/^!char\s+set\s+abilities\s+(.+)$/i);
    if (m) {
      const [payload, targetUserId] = extractTrailingMention(m[1]);
      const tokens = payload.split(/\s+/);
      const form = parseForm(tokens[0]);
      const rest = tokens.slice(1);
      if (rest.length < 2 || rest.length % 2 !== 0) return { kind: "help", topic: "char" };
      const pairs: AbilityPair[] = [];
      for (let i = 0; i < rest.length; i += 2) {
        const ability = parseAbility(rest[i]);
        const score = Number(rest[i + 1]);
        if (!ability || !Number.isFinite(score)) continue;
        pairs.push({ ability, score });
      }
      if (pairs.length === 0) return null;
      return { kind: "char_set_abilities", form, pairs, targetUserId };
    }
  }

  // !char prof skill <skill> [level] [@user]?
  {
    const m = trimmed.match(/^!char\s+prof\s+skill\s+(.+)$/i);
    if (m) {
      const [payload, targetUserId] = extractTrailingMention(m[1]);
      const mm = payload.match(/^(.+?)(?:\s+(exp|expertise|none|0|1|2))?\s*$/i);
      if (!mm) return null;
      const skill = mm[1].trim();
      const mode = (mm[2] ?? "1").toLowerCase();
      const level: ProfLevel =
        mode === "none" || mode === "0" ? 0 :
        mode === "exp" || mode === "expertise" || mode === "2" ? 2 :
        1;
      return { kind: "char_prof_skill", skill, level, targetUserId };
    }
  }

  // !sheet reset [@user]?  — must come before bare !sheet
  {
    const m = trimmed.match(new RegExp(String.raw`^!sheet\s+reset(?:\s+${M})?\s*$`, "i"));
    if (m) return { kind: "sheet_reset", targetUserId: m[1] };
  }

  // !sheet [@user]?
  {
    const m = trimmed.match(new RegExp(String.raw`^!sheet(?:\s+${M})?\s*$`, "i"));
    if (m) return { kind: "sheet", targetUserId: m[1] };
  }

  // !dm claim
  if (/^!dm\s+claim\s*$/i.test(trimmed)) return { kind: "dm_claim" };

  // !dm add [@user]
  {
    const m = trimmed.match(new RegExp(String.raw`^!dm\s+add\s+${M}\s*$`, "i"));
    if (m) return { kind: "dm_add", targetUserId: m[1] };
  }

  // !dm remove [@user]
  {
    const m = trimmed.match(new RegExp(String.raw`^!dm\s+remove\s+${M}\s*$`, "i"));
    if (m) return { kind: "dm_remove", targetUserId: m[1] };
  }

  // !dm list
  if (/^!dm\s+list\s*$/i.test(trimmed)) return { kind: "dm_list" };

  // !inv add <item> [qty] [; <item> [qty] ...]* [@user]?  — must come before bare !inv
  {
    const m = trimmed.match(/^!inv\s+add\s+(.+)$/i);
    if (m) {
      const [raw, targetUserId] = extractTrailingMention(m[1]);
      const items = raw.split(";")
        .map(s => s.trim())
        .filter(Boolean)
        .map(part => { const [item, qty] = extractQty(part); return { item, qty }; })
        .filter(({ item }) => item.length > 0);
      if (items.length === 0) return null;
      return { kind: "inv_add", items, targetUserId };
    }
  }

  // !inv remove <item> [qty] [@user]?
  {
    const m = trimmed.match(/^!inv\s+remove\s+(.+)$/i);
    if (m) {
      const [raw, targetUserId] = extractTrailingMention(m[1]);
      const [item, qty] = extractQty(raw);
      if (!item) return null;
      return { kind: "inv_remove", item, qty, targetUserId };
    }
  }

  // !inv clear [@user]?
  {
    const m = trimmed.match(/^!inv\s+clear\s*(.*)$/i);
    if (m) return { kind: "inv_clear", targetUserId: parseMentionId(m[1]) };
  }

  // !inv [@user]?
  {
    const m = trimmed.match(new RegExp(String.raw`^!inv(?:\s+${M})?\s*$`, "i"));
    if (m) return { kind: "inv_show", targetUserId: m[1] };
  }

  // !char set class <name> [@user]?
  {
    const m = trimmed.match(/^!char\s+set\s+class\s+(.+)$/i);
    if (m) {
      const [value, targetUserId] = extractTrailingMention(m[1]);
      if (!value) return null;
      return { kind: "char_set_class", value: value.trim(), targetUserId };
    }
  }

  // !char set caster full|half|none [@user]?
  {
    const m = trimmed.match(new RegExp(String.raw`^!char\s+set\s+caster\s+(full|half|none)(?:\s+${M})?\s*$`, "i"));
    if (m) return { kind: "char_set_caster", casterType: m[1].toLowerCase() as CasterType, targetUserId: m[2] };
  }

  // !char set slot <1-9> <value> [@user]?
  {
    const m = trimmed.match(new RegExp(String.raw`^!char\s+set\s+slot\s+([1-9])\s+(\d+)(?:\s+${M})?\s*$`, "i"));
    if (m) return { kind: "char_set_slot", level: Number(m[1]), value: Number(m[2]), targetUserId: m[3] };
  }

  // !char set maxslot <1-9> <value> [@user]?
  {
    const m = trimmed.match(new RegExp(String.raw`^!char\s+set\s+maxslot\s+([1-9])\s+(\d+)(?:\s+${M})?\s*$`, "i"));
    if (m) return { kind: "char_set_maxslot", level: Number(m[1]), value: Number(m[2]), targetUserId: m[3] };
  }

  // !char prof save <ability> [none] [@user]?
  {
    const m = trimmed.match(/^!char\s+prof\s+save\s+(.+)$/i);
    if (m) {
      const [payload, targetUserId] = extractTrailingMention(m[1]);
      const tokens = payload.trim().split(/\s+/);
      const removing = tokens[tokens.length - 1]?.toLowerCase() === "none";
      const abilityStr = (removing ? tokens.slice(0, -1) : tokens).join(" ");
      const ability = parseAbility(abilityStr.trim());
      if (!ability) return null;
      return { kind: "char_prof_save", ability, proficient: !removing, targetUserId };
    }
  }

  // !char set temphp N [@user]?
  {
    const m = trimmed.match(new RegExp(String.raw`^!char\s+set\s+temphp\s+(\d+)(?:\s+${M})?\s*$`, "i"));
    if (m) return { kind: "char_set_temphp", value: Number(m[1]), targetUserId: m[2] };
  }

  // !char set hp N [@user]?
  {
    const m = trimmed.match(new RegExp(String.raw`^!char\s+set\s+hp\s+(\d+)(?:\s+${M})?\s*$`, "i"));
    if (m) return { kind: "char_set_hp", value: Number(m[1]), targetUserId: m[2] };
  }

  // !char set maxhp N [@user]?
  {
    const m = trimmed.match(new RegExp(String.raw`^!char\s+set\s+maxhp\s+(\d+)(?:\s+${M})?\s*$`, "i"));
    if (m) return { kind: "char_set_maxhp", value: Number(m[1]), targetUserId: m[2] };
  }

  // !char set hd N [@user]?
  {
    const m = trimmed.match(new RegExp(String.raw`^!char\s+set\s+hd\s+(\d+)(?:\s+${M})?\s*$`, "i"));
    if (m) return { kind: "char_set_hd", value: Number(m[1]), targetUserId: m[2] };
  }

  // !char adjust hp N [@user]?  (N may be negative)
  {
    const m = trimmed.match(new RegExp(String.raw`^!char\s+adjust\s+hp\s+(-?\d+)(?:\s+${M})?\s*$`, "i"));
    if (m) return { kind: "char_adjust_hp", delta: Number(m[1]), targetUserId: m[2] };
  }

  // !exp N [@user]?  (N may be negative)
  {
    const m = trimmed.match(new RegExp(String.raw`^!exp\s+(-?\d+)(?:\s+${M})?\s*$`, "i"));
    if (m) return { kind: "exp_add", amount: Number(m[1]), targetUserId: m[2] };
  }

  // !spell <name>
  {
    const m = trimmed.match(/^!spell\s+(.+)$/i);
    if (m) return { kind: "spell_lookup", name: m[1].trim() };
  }

  // !rest long [@user]?
  {
    const m = trimmed.match(new RegExp(String.raw`^!rest\s+long(?:\s+${M})?\s*$`, "i"));
    if (m) return { kind: "rest_long", targetUserId: m[1] };
  }

  // !rest short [N] [@user]?
  {
    const m = trimmed.match(/^!rest\s+short(?:\s+(.+))?\s*$/i);
    if (m) {
      const rest = m[1]?.trim() ?? "";
      // If the entire rest is just a mention (anchored check — no dice before it)
      const pureMention = rest.match(/^\[@[^\]]*\]\(root:\/\/user\/([^)]+)\)\s*$/);
      if (pureMention) return { kind: "rest_short", dice: 1, targetUserId: pureMention[1] };
      const [payload, targetUserId] = extractTrailingMention(rest);
      const n = parseInt(payload.trim(), 10);
      return { kind: "rest_short", dice: Number.isFinite(n) && n >= 1 ? n : 1, targetUserId };
    }
  }

  // !spells add/remove/clear/show — must come before bare !spells
  {
    const m = trimmed.match(/^!spells\s+add\s+(.+)$/i);
    if (m) return { kind: "spells_add", spell: m[1].trim().toLowerCase() };
  }
  {
    const m = trimmed.match(/^!spells\s+remove\s+(.+)$/i);
    if (m) return { kind: "spells_remove", spell: m[1].trim().toLowerCase() };
  }
  if (/^!spells\s+clear\s*$/i.test(trimmed)) return { kind: "spells_clear" };
  if (/^!spells?\s*$/i.test(trimmed)) return { kind: "spells_show" };

  // !attack <weapon> [adv|dis]  /  !atk <weapon> [adv|dis]
  {
    const m = trimmed.match(/^!(?:attack|atk)\s+(.+)$/i);
    if (m) {
      const advMatch = m[1].trim().match(/^(.*\S)\s+(adv(?:antage)?|dis(?:adv(?:antage)?)?)\s*$/i);
      const weapon = (advMatch ? advMatch[1] : m[1]).trim();
      const advStr = advMatch?.[2].toLowerCase();
      const advantage = advStr
        ? (advStr.startsWith("adv") ? "adv" as const : "dis" as const)
        : undefined;
      if (!weapon) return null;
      return { kind: "attack", weapon, advantage };
    }
  }

  // !cast blind <1-9>  — deduct a slot with no spell lookup
  {
    const m = trimmed.match(/^!cast\s+blind\s+([1-9])\s*$/i);
    if (m) return { kind: "cast", level: Number(m[1]) };
  }

  // !cast <spell name> [level]  — must come after blind check
  {
    const m = trimmed.match(/^!cast\s+(.+)$/i);
    if (m) {
      const raw = m[1].trim();
      const levelMatch = raw.match(/^(.*\S)\s+([1-9])\s*$/);
      const spell = (levelMatch ? levelMatch[1] : raw).trim();
      const level = levelMatch ? parseInt(levelMatch[2], 10) : undefined;
      if (!spell) return null;
      return { kind: "spell_cast", spell, level };
    }
  }

  // !exprank
  if (/^!exprank\s*$/i.test(trimmed)) return { kind: "exp_rank" };

  // !cal add <YYYYMMDD> <event...>
  {
    const m = trimmed.match(/^!cal\s+add\s+(\d{8})\s+(.+)$/i);
    if (m) return { kind: "cal_add", date: Number(m[1]), event: m[2].trim() };
  }

  // !cal del <YYYYMMDD>
  {
    const m = trimmed.match(/^!cal\s+del\s+(\d{8})\s*$/i);
    if (m) return { kind: "cal_del", date: Number(m[1]) };
  }

  // !cal  (must come after !cal add / !cal del)
  if (/^!cal\s*$/i.test(trimmed)) return { kind: "cal_show" };

  // !lib add <name> <weight> <price> [color] [desc] [; ...]* (DM only)
  // Multiple entries separated by semicolons. color is an ANSI integer (37 = white);
  // if the token after price is a plain integer it is treated as the color.
  {
    const m = trimmed.match(/^!lib\s+add\s+(.+)$/i);
    if (m) {
      const items = m[1].split(";").map(s => s.trim()).filter(Boolean).flatMap(entry => {
        const em = entry.match(/^(\S+)\s+([\d.]+)\s+([\d.]+)(?:\s+(.+))?\s*$/i);
        if (!em) return [];
        const rest = em[4]?.trim() ?? "";
        const colorMatch = rest.match(/^(\d+)(?:\s+(.+))?$/);
        const color = colorMatch ? parseInt(colorMatch[1], 10) : 37;
        const description = (colorMatch ? colorMatch[2]?.trim() : rest) ?? "";
        return [{ name: em[1], weight: Number(em[2]), price: Number(em[3]), color, description }];
      });
      if (items.length === 0) return null;
      return { kind: "lib_add", items };
    }
  }

  // !lib del <name>
  {
    const m = trimmed.match(/^!lib\s+del\s+(.+)\s*$/i);
    if (m) return { kind: "lib_del", name: m[1].trim() };
  }

  // !lib check <name>
  {
    const m = trimmed.match(/^!lib\s+check\s+(.+)\s*$/i);
    if (m) return { kind: "lib_check", name: m[1].trim() };
  }

  // !lib list [filter]?
  {
    const m = trimmed.match(/^!lib\s+list(?:\s+(\S+))?\s*$/i);
    if (m) return { kind: "lib_list", filter: m[1] };
  }

  // !import <ddb-url-or-id> [@user]?
  {
    const m = trimmed.match(/^!import\s+(.+)$/i);
    if (m) {
      const [raw, targetUserId] = extractTrailingMention(m[1]);
      const characterId = parseDDBId(raw.trim());
      if (!characterId) return null;
      return { kind: "ddb_import", characterId, targetUserId };
    }
  }

  // !help [topic]
  {
    const m = trimmed.match(/^!help(?:\s+(.+))?\s*$/i);
    if (m) return { kind: "help", topic: m[1]?.trim() || undefined };
  }

  // NPC COMMANDS
  // Structural (keyword first): !npc create/list/delete
  if (/^!npc\s+list\s*$/i.test(trimmed)) return { kind: "npc_list" };
  {
    const m = trimmed.match(/^!npc\s+create\s+(.+)$/i);
    if (m) return { kind: "npc_create", name: m[1].trim() };
  }
  {
    const m = trimmed.match(/^!npc\s+delete\s+(.+)$/i);
    if (m) return { kind: "npc_delete", name: m[1].trim() };
  }

  // Sheet operations (name first): more specific subcommands before general ones.
  // Name captured with (.+?) non-greedy — stops at first occurrence of the subcommand keyword.
  {
    const m = trimmed.match(/^!npc\s+(.+?)\s+set\s+abilities\s+(.+)$/i);
    if (m) {
      const tokens = m[2].trim().split(/\s+/);
      const form = parseForm(tokens[0]);
      const rest = tokens.slice(1);
      if (rest.length >= 2 && rest.length % 2 === 0) {
        const pairs: AbilityPair[] = [];
        for (let i = 0; i < rest.length; i += 2) {
          const ability = parseAbility(rest[i]);
          const score = Number(rest[i + 1]);
          if (ability && Number.isFinite(score)) pairs.push({ ability, score });
        }
        if (pairs.length > 0) return { kind: "npc_set_abilities", name: m[1].trim(), form, pairs };
      }
    }
  }
  {
    const m = trimmed.match(/^!npc\s+(.+?)\s+set\s+ability\s+([a-zA-Z]+)\s+(irl|ingame)\s+(-?\d+)\s*$/i);
    if (m) {
      const ability = parseAbility(m[2]);
      if (!ability) return null;
      return { kind: "npc_set_ability", name: m[1].trim(), ability, form: parseForm(m[3]), score: Number(m[4]) };
    }
  }
  {
    const m = trimmed.match(/^!npc\s+(.+?)\s+set\s+maxslot\s+([1-9])\s+(\d+)\s*$/i);
    if (m) return { kind: "npc_set_maxslot", name: m[1].trim(), level: Number(m[2]), value: Number(m[3]) };
  }
  {
    const m = trimmed.match(/^!npc\s+(.+?)\s+set\s+maxhp\s+(\d+)\s*$/i);
    if (m) return { kind: "npc_set_maxhp", name: m[1].trim(), value: Number(m[2]) };
  }
  {
    const m = trimmed.match(/^!npc\s+(.+?)\s+set\s+temphp\s+(\d+)\s*$/i);
    if (m) return { kind: "npc_set_temphp", name: m[1].trim(), value: Number(m[2]) };
  }
  {
    const m = trimmed.match(/^!npc\s+(.+?)\s+set\s+caster\s+(full|half|none)\s*$/i);
    if (m) return { kind: "npc_set_caster", name: m[1].trim(), casterType: m[2].toLowerCase() as CasterType };
  }
  {
    const m = trimmed.match(/^!npc\s+(.+?)\s+set\s+class\s+(.+)$/i);
    if (m) return { kind: "npc_set_class", name: m[1].trim(), value: m[2].trim() };
  }
  {
    const m = trimmed.match(/^!npc\s+(.+?)\s+set\s+slot\s+([1-9])\s+(\d+)\s*$/i);
    if (m) return { kind: "npc_set_slot", name: m[1].trim(), level: Number(m[2]), value: Number(m[3]) };
  }
  {
    const m = trimmed.match(/^!npc\s+(.+?)\s+set\s+hd\s+(\d+)\s*$/i);
    if (m) return { kind: "npc_set_hd", name: m[1].trim(), value: Number(m[2]) };
  }
  {
    const m = trimmed.match(/^!npc\s+(.+?)\s+set\s+pb\s+(-?\d+)\s*$/i);
    if (m) return { kind: "npc_set_pb", name: m[1].trim(), pb: Number(m[2]) };
  }
  {
    const m = trimmed.match(/^!npc\s+(.+?)\s+set\s+hp\s+(\d+)\s*$/i);
    if (m) return { kind: "npc_set_hp", name: m[1].trim(), value: Number(m[2]) };
  }
  {
    const m = trimmed.match(/^!npc\s+(.+?)\s+adjust\s+hp\s+(-?\d+)\s*$/i);
    if (m) return { kind: "npc_adjust_hp", name: m[1].trim(), delta: Number(m[2]) };
  }
  {
    const m = trimmed.match(/^!npc\s+(.+?)\s+prof\s+skill\s+(.+)$/i);
    if (m) {
      const mm = m[2].trim().match(/^(.+?)(?:\s+(exp|expertise|none|0|1|2))?\s*$/i);
      if (!mm) return null;
      const skill = mm[1].trim();
      const mode = (mm[2] ?? "1").toLowerCase();
      const level: ProfLevel = mode === "none" || mode === "0" ? 0 : mode === "exp" || mode === "expertise" || mode === "2" ? 2 : 1;
      return { kind: "npc_prof_skill", name: m[1].trim(), skill, level };
    }
  }
  {
    const m = trimmed.match(/^!npc\s+(.+?)\s+prof\s+save\s+(.+)$/i);
    if (m) {
      const tokens = m[2].trim().split(/\s+/);
      const removing = tokens[tokens.length - 1]?.toLowerCase() === "none";
      const abilityStr = (removing ? tokens.slice(0, -1) : tokens).join(" ");
      const ability = parseAbility(abilityStr.trim());
      if (!ability) return null;
      return { kind: "npc_prof_save", name: m[1].trim(), ability, proficient: !removing };
    }
  }
  {
    const m = trimmed.match(/^!npc\s+(.+?)\s+use\s+(irl|ingame)\s*$/i);
    if (m) return { kind: "npc_use", name: m[1].trim(), form: m[2].toLowerCase() as Form };
  }
  {
    const m = trimmed.match(/^!npc\s+(.+?)\s+rest\s+short(?:\s+(\d+))?\s*$/i);
    if (m) {
      const n = m[2] ? parseInt(m[2], 10) : 1;
      return { kind: "npc_rest_short", name: m[1].trim(), dice: Number.isFinite(n) && n >= 1 ? n : 1 };
    }
  }
  {
    const m = trimmed.match(/^!npc\s+(.+?)\s+rest\s+long\s*$/i);
    if (m) return { kind: "npc_rest_long", name: m[1].trim() };
  }
  {
    const m = trimmed.match(/^!npc\s+(.+?)\s+exp\s+(-?\d+)\s*$/i);
    if (m) return { kind: "npc_exp", name: m[1].trim(), amount: Number(m[2]) };
  }
  {
    const m = trimmed.match(/^!npc\s+(.+?)\s+inv\s+add\s+(.+)$/i);
    if (m) {
      const items = m[2].split(";")
        .map(s => s.trim()).filter(Boolean)
        .map(part => { const [item, qty] = extractQty(part); return { item, qty }; })
        .filter(({ item }) => item.length > 0);
      if (items.length === 0) return null;
      return { kind: "npc_inv_add", name: m[1].trim(), items };
    }
  }
  {
    const m = trimmed.match(/^!npc\s+(.+?)\s+inv\s+remove\s+(.+)$/i);
    if (m) {
      const [item, qty] = extractQty(m[2].trim());
      if (!item) return null;
      return { kind: "npc_inv_remove", name: m[1].trim(), item, qty };
    }
  }
  {
    const m = trimmed.match(/^!npc\s+(.+?)\s+inv\s+clear\s*$/i);
    if (m) return { kind: "npc_inv_clear", name: m[1].trim() };
  }
  {
    const m = trimmed.match(/^!npc\s+(.+?)\s+inv\s*$/i);
    if (m) return { kind: "npc_inv_show", name: m[1].trim() };
  }
  {
    // !npc <name> cast blind <1-9> — must come before general cast
    const m = trimmed.match(/^!npc\s+(.+?)\s+cast\s+blind\s+([1-9])\s*$/i);
    if (m) return { kind: "npc_cast", name: m[1].trim(), level: Number(m[2]) };
  }
  {
    const m = trimmed.match(/^!npc\s+(.+?)\s+cast\s+(.+)$/i);
    if (m) {
      const raw = m[2].trim();
      const levelMatch = raw.match(/^(.*\S)\s+([1-9])\s*$/);
      const spell = (levelMatch ? levelMatch[1] : raw).trim();
      const level = levelMatch ? parseInt(levelMatch[2], 10) : undefined;
      if (!spell) return null;
      return { kind: "npc_spell_cast", name: m[1].trim(), spell, level };
    }
  }
  {
    const m = trimmed.match(/^!npc\s+(.+?)\s+spells\s+add\s+(.+)$/i);
    if (m) return { kind: "npc_spells_add", name: m[1].trim(), spell: m[2].trim().toLowerCase() };
  }
  {
    const m = trimmed.match(/^!npc\s+(.+?)\s+spells\s+remove\s+(.+)$/i);
    if (m) return { kind: "npc_spells_remove", name: m[1].trim(), spell: m[2].trim().toLowerCase() };
  }
  {
    const m = trimmed.match(/^!npc\s+(.+?)\s+spells\s+clear\s*$/i);
    if (m) return { kind: "npc_spells_clear", name: m[1].trim() };
  }
  {
    const m = trimmed.match(/^!npc\s+(.+?)\s+spells\s*$/i);
    if (m) return { kind: "npc_spells_show", name: m[1].trim() };
  }
  {
    const m = trimmed.match(/^!npc\s+(.+?)\s+reset\s*$/i);
    if (m) return { kind: "npc_reset", name: m[1].trim() };
  }
  {
    // Bare sheet view — must come last among name-first patterns
    const m = trimmed.match(/^!npc\s+(.+?)\s+sheet\s*$/i);
    if (m) return { kind: "npc_sheet", name: m[1].trim() };
  }

  return null;
}
