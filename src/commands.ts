// server/src/commands.ts
import type { Ability, Form, ProfLevel } from "./skills";
import { ABILITY_ALIASES } from "./skills";
import { splitParts } from "./dice";

type AbilityPair = { ability: Ability; score: number };

export type ParsedCommand =
  | { kind: "roll"; parts: string[] }
  | { kind: "check"; parts: Array<{ target: string; form?: Form }> }
  | { kind: "char_use"; form: Form }
  | { kind: "char_set_pb"; pb: number }
  | { kind: "char_set_ability"; ability: Ability; form: Form; score: number }
  | { kind: "char_set_abilities"; form: Form; pairs: AbilityPair[] }
  | { kind: "char_prof_skill"; skill: string; level: ProfLevel }
  | {kind: "sheet"}
  | { kind: "help"; topic?: string };

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
  console.log("trimmed command: ", trimmed)

  // !r ...
  {
    const m = trimmed.match(/^!r\s*(.*)$/i);
    if (m) {
      const rest = (m[1] ?? "").trim();
      if (!rest) return null;
      return { kind: "roll", parts: splitParts(rest) };
    }
  }

  // !check ...
  {
    // allow multiple checks separated by ; or newlines after !check
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

  // !char use irl|ingame
  {
    const m = trimmed.match(/^!char\s+use\s+(irl|ingame)\s*$/i);
    if (m) return { kind: "char_use", form: m[1].toLowerCase() as Form };
  }

  // !char set pb N
  {
    const m = trimmed.match(/^!char\s+set\s+pb\s+(-?\d+)\s*$/i);
    if (m) return { kind: "char_set_pb", pb: Number(m[1]) };
  }

  // !char set ability str a 16
  {
    const m = trimmed.match(/^!char\s+set\s+ability\s+([a-zA-Z]+)\s+(irl|ingame)\s+(-?\d+)\s*$/i);
    if (m) {
      const abilKey = m[1].toLowerCase();
      const ability = ABILITY_ALIASES[abilKey];
      if (!ability) return null;
      return {
        kind: "char_set_ability",
        ability,
        form: parseForm(m[2].toLowerCase()),
        score: Number(m[3]),
      };
    }
  }

  // !char set abilities <form> (<ability> <score>)+
  {
    const m = trimmed.match(/^!char\s+set\s+abilities\s+(.+)$/i);
    if (m) {
      const tokens = m[1].trim().split(/\s+/);
      console.log(`tokens: ${tokens}`);
      const form = parseForm(tokens[0]);
      console.log(`form: ${form}`)
      if (!form) return null;
  
      const rest = tokens.slice(1);
      if (rest.length < 2 || rest.length % 2 !== 0) {
        return { kind: "help", topic: "char" }; // or return null / error; your call
      }
  
      const pairs: AbilityPair[] = [];
      for (let i = 0; i < rest.length; i += 2) {
        const abil = parseAbility(rest[i]);
        const score = Number(rest[i + 1]);
        if (!abil) continue; // skip unknown tokens
        if (!Number.isFinite(score)) continue;
  
        pairs.push({ ability: abil, score });
      }
      console.log(`kind char_set_abilities form ${form} pairs ${pairs}`)
      if (pairs.length === 0) return null;
      return { kind: "char_set_abilities", form, pairs };
    }
  }

  // !char prof skill insight [none|exp]
  {
    const m = trimmed.match(/^!char\s+prof\s+skill\s+(.+?)(?:\s+(exp|expertise|none|0|1|2))?\s*$/i);
    if (m) {
      const skill = m[1].trim();
      const mode = (m[2] ?? "1").toLowerCase();
      const level: ProfLevel =
        mode === "none" || mode === "0" ? 0 :
        mode === "exp" || mode === "expertise" || mode === "2" ? 2 :
        1;
      return { kind: "char_prof_skill", skill, level };
    }
  }

  // !sheet
  {
    const m = trimmed.match(/^!sheet\s*$/i);
    if (m) return { kind: "sheet" };
  }

  // !help [topic]
  {
    const m = trimmed.match(/^!help(?:\s+(.+))?\s*$/i);
    if (m) return { kind: "help", topic: m[1]?.trim() || undefined };
  }

  return null;
}