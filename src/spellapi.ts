export interface CastingOption {
  type: string;       // "default", "slot_level_3", "slot_level_4", etc.
  damage_roll: string | null;
}

const BASE = "https://api.open5e.com/v2/spells";

const CASTING_TIME_DISPLAY: Record<string, string> = {
  action: "1 action",
  bonus: "1 bonus action",
  reaction: "1 reaction",
  minute: "1 minute",
  hour: "1 hour",
  "10 minutes": "10 minutes",
  "8 hours": "8 hours",
  "12 hours": "12 hours",
  "24 hours": "24 hours",
  special: "Special",
};

const ORDINAL = ["", "1st", "2nd", "3rd", "4th", "5th", "6th", "7th", "8th", "9th"];

export interface Open5eSpell {
  name: string;
  level: number;
  school: { name: string; key: string } | string;
  casting_time: string;
  reaction_condition?: string | null;
  range_text?: string;
  range?: number | string;
  duration: string;
  concentration: boolean;
  ritual: boolean;
  verbal: boolean;
  somatic: boolean;
  material: boolean;
  material_specified?: string | null;
  material_cost?: string | null;
  desc: string;
  higher_level?: string | null;
  damage_roll?: string | null;
  damage_types?: string[];
  saving_throw_ability?: string | null;
  attack_roll?: boolean;
  casting_options?: CastingOption[];
}

interface Open5eResponse {
  count: number;
  results: Open5eSpell[];
}

async function fetchSpells(params: Record<string, string>): Promise<Open5eSpell[]> {
  const qs = new URLSearchParams({ limit: "5", ...params }).toString();
  let res: Response;
  try {
    res = await fetch(`${BASE}/?${qs}`, { headers: { Accept: "application/json" } });
  } catch {
    throw new Error("Could not reach the Open5e API — check your connection.");
  }
  if (!res.ok) throw new Error(`Open5e returned an error (${res.status}).`);
  const data = await res.json() as Open5eResponse;
  return data.results ?? [];
}

export async function lookupSpellData(name: string): Promise<Open5eSpell> {
  const trimmed = name.trim();

  // Try exact match first, then fall back to contains
  let results = await fetchSpells({ name__iexact: trimmed });
  if (results.length === 0) {
    results = await fetchSpells({ name__icontains: trimmed });
    if (results.length === 0) {
      throw new Error(`No spell found matching "${trimmed}". Check the spelling and try again.`);
    }
    results.sort((a, b) => a.name.length - b.name.length);
  }

  return results[0];
}

export async function lookupSpell(name: string): Promise<string> {
  return formatSpell(await lookupSpellData(name));
}

// Returns the damage roll for a given slot level, and whether it was an exact
// match from casting_options (vs. falling back to the base roll).
export function getDamageForLevel(
  spell: Open5eSpell,
  level: number,
): { roll: string; exact: boolean } | null {
  // Check for a specific casting option at this slot level
  const levelOpt = spell.casting_options?.find(o => o.type === `slot_level_${level}`);
  if (levelOpt?.damage_roll) return { roll: levelOpt.damage_roll, exact: true };

  // Check the default option
  const defOpt = spell.casting_options?.find(o => o.type === "default");
  if (defOpt?.damage_roll) return { roll: defOpt.damage_roll, exact: level === spell.level };

  // Fall back to top-level damage_roll
  if (spell.damage_roll) return { roll: spell.damage_roll, exact: level === spell.level };

  return null;
}

export function formatSpell(spell: Open5eSpell): string {
  const lines: string[] = [];

  const schoolName = typeof spell.school === "object" ? spell.school.name : spell.school;
  const levelStr = spell.level === 0
    ? `Cantrip`
    : `${ORDINAL[spell.level] ?? `${spell.level}th`}-level`;
  const tags: string[] = [];
  if (spell.ritual) tags.push("ritual");
  if (spell.concentration) tags.push("concentration");
  const tagStr = tags.length ? ` *(${tags.join(", ")})*` : "";

  lines.push(`🔮 **${spell.name}** — ${levelStr} ${schoolName}${tagStr}`);

  // Casting time
  const ctDisplay = CASTING_TIME_DISPLAY[spell.casting_time] ?? spell.casting_time;
  const reactionNote = spell.reaction_condition ? ` *(${spell.reaction_condition})*` : "";
  const range = spell.range_text ?? (spell.range != null ? `${spell.range} feet` : "—");
  lines.push(`**Cast:** ${ctDisplay}${reactionNote} | **Range:** ${range} | **Duration:** ${spell.duration}`);

  // Components
  const comps: string[] = [];
  if (spell.verbal) comps.push("V");
  if (spell.somatic) comps.push("S");
  if (spell.material) comps.push("M");
  if (comps.length > 0) {
    const matNote = spell.material_specified
      ? ` *(${spell.material_specified}${spell.material_cost ? `, worth ${spell.material_cost}` : ""})*`
      : "";
    lines.push(`**Components:** ${comps.join(", ")}${matNote}`);
  }

  // Damage / save / attack
  const extras: string[] = [];
  if (spell.damage_roll) {
    const dmgType = spell.damage_types?.length ? ` ${spell.damage_types.join("/")}` : "";
    extras.push(`**Damage:** ${spell.damage_roll}${dmgType}`);
  }
  if (spell.saving_throw_ability) extras.push(`**Save:** ${spell.saving_throw_ability.toUpperCase()}`);
  if (spell.attack_roll) extras.push("**Attack roll**");
  if (extras.length > 0) lines.push(extras.join(" | "));

  lines.push("");

  // Description — cap length to avoid hitting message limits
  const desc = spell.desc.trim();
  const maxLen = 900;
  lines.push(desc.length > maxLen ? desc.slice(0, maxLen) + "…" : desc);

  // At higher levels
  if (spell.higher_level) {
    lines.push("");
    lines.push(`**At Higher Levels:** ${spell.higher_level.trim()}`);
  }

  return lines.join("\n");
}
