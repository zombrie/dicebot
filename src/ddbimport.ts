import type { Sheet, Ability, CasterType, ProfLevel } from "./skills";
import { pbForLevel, spellSlotsForLevel, LVLUP_TABLE } from "./skills";

const STAT_IDS: Record<number, Ability> = {
  1: "str", 2: "dex", 3: "con", 4: "int", 5: "wis", 6: "cha",
};

const SCORE_BONUS_SUBTYPES: Record<string, Ability> = {
  "strength-score": "str",
  "dexterity-score": "dex",
  "constitution-score": "con",
  "intelligence-score": "int",
  "wisdom-score": "wis",
  "charisma-score": "cha",
};

const SAVE_SUBTYPES: Record<string, Ability> = {
  "strength-saving-throws": "str",
  "dexterity-saving-throws": "dex",
  "constitution-saving-throws": "con",
  "intelligence-saving-throws": "int",
  "wisdom-saving-throws": "wis",
  "charisma-saving-throws": "cha",
};

const SKILL_SUBTYPES: Record<string, string> = {
  "athletics": "athletics",
  "acrobatics": "acrobatics",
  "sleight-of-hand": "sleightofhand",
  "stealth": "stealth",
  "arcana": "arcana",
  "history": "history",
  "investigation": "investigation",
  "nature": "nature",
  "religion": "religion",
  "animal-handling": "animalhandling",
  "insight": "insight",
  "medicine": "medicine",
  "perception": "perception",
  "survival": "survival",
  "deception": "deception",
  "intimidation": "intimidation",
  "performance": "performance",
  "persuasion": "persuasion",
};

const CASTER_TYPES: Record<string, CasterType> = {
  Bard: "full", Cleric: "full", Druid: "full", Sorcerer: "full", Warlock: "full", Wizard: "full",
  Paladin: "half", Ranger: "half", Artificer: "half",
  Barbarian: "none", Fighter: "none", Monk: "none", Rogue: "none",
};

// Minimal types for the fields we actually use from the D&D Beyond character JSON
interface DDBStat { id: number; value: number | null; }

interface DDBModifier { type: string; subType: string; value: number | null; }

export interface DDBCharacterData {
  id: number;
  name: string;
  currentXp: number | null;
  baseHitPoints: number;
  bonusHitPoints: number | null;
  overrideHitPoints: number | null;
  removedHitPoints: number;
  temporaryHitPoints: number;
  stats: DDBStat[];
  bonusStats: DDBStat[];
  overrideStats: DDBStat[];
  classes: Array<{
    level: number;
    definition: { name: string; hitDice: number };
  }>;
  modifiers: Partial<Record<string, DDBModifier[]>>;
  // spells can be a flat array OR an object keyed by source type
  spells?: unknown;
  classSpells?: Array<{
    characterClassId?: number;
    spells?: Array<{ definition?: { name?: string; level?: number } | null }>;
  }>;
}

// Accept a bare numeric ID or any D&D Beyond character URL
export function parseDDBId(input: string): string | null {
  const urlMatch = input.match(/dndbeyond\.com\/characters?\/(\d+)/i);
  if (urlMatch) return urlMatch[1];
  if (/^\d+$/.test(input.trim())) return input.trim();
  return null;
}

export async function fetchDDBSheet(characterId: string): Promise<Sheet> {
  const url = `https://character-service.dndbeyond.com/character/v5/character/${characterId}`;
  let res: Response;
  try {
    res = await fetch(url, {
      headers: { Accept: "application/json", "User-Agent": "Mozilla/5.0" },
    });
  } catch {
    throw new Error("Could not reach D&D Beyond — check your connection.");
  }

  if (res.status === 404) throw new Error("Character not found — check the ID and make sure the character is set to **public** on D&D Beyond.");
  if (res.status === 401 || res.status === 403) throw new Error("Character is private. Set it to **public** on D&D Beyond and try again.");
  if (!res.ok) throw new Error(`D&D Beyond returned an error (${res.status}).`);

  const json = await res.json() as { data?: DDBCharacterData };
  if (!json?.data) throw new Error("Unexpected response from D&D Beyond — the API may have changed.");
  return parseDDBCharacter(json.data);
}

export function parseDDBCharacter(data: DDBCharacterData): Sheet {
  // --- Ability scores ---
  const abilities: Record<Ability, number> = { str: 10, dex: 10, con: 10, int: 10, wis: 10, cha: 10 };

  for (const stat of data.stats) {
    const ab = STAT_IDS[stat.id];
    if (ab && stat.value !== null) abilities[ab] = stat.value;
  }

  // Manual bonus stat additions (set in DDB UI, usually null)
  for (const stat of data.bonusStats) {
    const ab = STAT_IDS[stat.id];
    if (ab && stat.value !== null) abilities[ab] += stat.value;
  }

  // Racial bonuses, ASI choices, feats — all come through as type="bonus" modifiers
  const allMods: DDBModifier[] = Object.values(data.modifiers).flat().filter(Boolean) as DDBModifier[];
  for (const mod of allMods) {
    if (mod.type === "bonus" && mod.value !== null) {
      const ab = SCORE_BONUS_SUBTYPES[mod.subType];
      if (ab) abilities[ab] += mod.value;
    }
  }

  // Override stats replace the computed total entirely
  for (const stat of data.overrideStats) {
    const ab = STAT_IDS[stat.id];
    if (ab && stat.value !== null) abilities[ab] = stat.value;
  }

  // --- Class ---
  const cls = data.classes[0];
  const className = cls?.definition.name ?? "Unknown";
  const level = data.classes.reduce((s, c) => s + c.level, 0);
  const hitDice = cls?.definition.hitDice ?? 8;
  const casterType: CasterType = CASTER_TYPES[className] ?? "none";

  // --- HP ---
  const maxHp = data.overrideHitPoints !== null
    ? data.overrideHitPoints
    : (data.baseHitPoints + (data.bonusHitPoints ?? 0));
  const hp = Math.max(0, maxHp - (data.removedHitPoints ?? 0));
  const tempHp = data.temporaryHitPoints > 0 ? data.temporaryHitPoints : undefined;

  // --- EXP ---
  // Floor to the minimum XP for the actual class level so expToLevel() agrees,
  // which handles milestone campaigns where currentXp is 0.
  const minExp = LVLUP_TABLE[Math.min(level - 1, LVLUP_TABLE.length - 1)] ?? 0;
  const exp = Math.max(data.currentXp ?? 0, minExp);

  // --- Proficiency bonus ---
  const pb = pbForLevel(level);

  // --- Skill proficiencies (expertise beats proficiency) ---
  const skillProf: Record<string, ProfLevel> = {};
  for (const mod of allMods) {
    const key = SKILL_SUBTYPES[mod.subType];
    if (!key) continue;
    if (mod.type === "expertise") {
      skillProf[key] = 2;
    } else if (mod.type === "proficiency" && skillProf[key] !== 2) {
      skillProf[key] = 1;
    }
  }

  // --- Saving throw proficiencies ---
  const saveProf: Partial<Record<Ability, boolean>> = {};
  for (const mod of allMods) {
    const ab = SAVE_SUBTYPES[mod.subType];
    if (ab && mod.type === "proficiency") saveProf[ab] = true;
  }

  // --- Spell slots (D&D Beyond doesn't track current slots server-side; start at max) ---
  const maxSpellSlots = spellSlotsForLevel(level, casterType);
  const spellSlots = Object.keys(maxSpellSlots).length > 0 ? { ...maxSpellSlots } : undefined;

  // --- Known spells ---
  // data.spells can be a flat array OR an object with source-type keys (like modifiers).
  // data.classSpells is an array of per-class spell lists.
  type SpellEntry = { definition?: { name?: string; level?: number } | null };

  function extractSpellEntries(raw: unknown): SpellEntry[] {
    if (!raw) return [];
    if (Array.isArray(raw)) return raw as SpellEntry[];
    if (typeof raw === "object") {
      return Object.values(raw as Record<string, SpellEntry[]>).flat();
    }
    return [];
  }

  const spellEntries: SpellEntry[] = [
    ...extractSpellEntries(data.spells),
    ...(data.classSpells ?? []).flatMap(cs => cs.spells ?? []),
  ];

  const seen = new Set<string>();
  const knownSpells = spellEntries
    .filter((s): s is SpellEntry => s != null)
    .map(s => s.definition?.name)
    .filter((n): n is string => typeof n === "string" && n.length > 0)
    .map(n => n.toLowerCase())
    .filter(n => { if (seen.has(n)) return false; seen.add(n); return true; });

  return {
    version: 1,
    name: data.name,
    activeForm: "ingame",
    pb,
    forms: {
      irl: { label: "In Real Life", abilities: { str: 10, dex: 10, con: 10, int: 10, wis: 10, cha: 10 } },
      ingame: { label: "In Game", abilities },
    },
    skillProf,
    saveProf,
    inventory: {},
    hp,
    maxHp,
    hitDice,
    exp,
    class: className,
    casterType,
    ...(tempHp !== undefined ? { tempHp } : {}),
    ...(maxSpellSlots && Object.keys(maxSpellSlots).length > 0 ? { maxSpellSlots, spellSlots } : {}),
    ...(knownSpells.length > 0 ? { knownSpells } : {}),
  };
}
