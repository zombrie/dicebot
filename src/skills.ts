// D&D 5e game mechanics: ability scores, proficiency, checks, XP tables, and spell slot tables.
export type Ability = "str" | "dex" | "con" | "int" | "wis" | "cha";
export type Form = "irl" | "ingame";
export type ProfLevel = 0 | 1 | 2;

export type CasterType = "full" | "half" | "none";

export type Sheet = {
  version: 1;
  name?: string;
  activeForm: Form;
  pb: number;
  forms: Record<Form, { label?: string; abilities: Record<Ability, number> }>;
  skillProf: Record<string, ProfLevel>; // normalized skill name -> level
  saveProf?: Partial<Record<Ability, boolean>>; // saving throw proficiencies
  inventory: Record<string, number>; // item name -> quantity
  hp?: number;
  maxHp?: number;
  tempHp?: number;
  hitDice?: number; // die size, e.g. 8 for d8
  exp?: number;
  class?: string;
  casterType?: CasterType;
  spellSlots?: Record<string, number>; // current slots by level "1"–"9"
  maxSpellSlots?: Record<string, number>; // max slots by level "1"–"9"
  knownSpells?: string[]; // lowercase spell names; undefined = no restriction
};

export const ABILITY_ALIASES: Record<string, Ability> = {
  str: "str",
  strength: "str",
  dex: "dex",
  dexterity: "dex",
  con: "con",
  constitution: "con",
  int: "int",
  intelligence: "int",
  wis: "wis",
  wisdom: "wis",
  cha: "cha",
  charisma: "cha",
};

export const SKILL_TO_ABILITY: Record<string, Ability> = {
  athletics: "str",

  acrobatics: "dex",
  sleightofhand: "dex",
  stealth: "dex",

  arcana: "int",
  history: "int",
  investigation: "int",
  nature: "int",
  religion: "int",

  animalhandling: "wis",
  insight: "wis",
  medicine: "wis",
  perception: "wis",
  survival: "wis",

  deception: "cha",
  intimidation: "cha",
  performance: "cha",
  persuasion: "cha",
};

// Normalizes a skill/save name to a whitespace-free lowercase key for storage lookups.
export function norm(s: string) {
  return s.toLowerCase().trim().replace(/\s+/g, "");
}

export function abilityMod(score: number): number {
  return Math.floor((score - 10) / 2);
}

export function profBonus(pb: number, level: ProfLevel): number {
  if (level === 1) return pb;
  if (level === 2) return pb * 2;
  return 0;
}

export type CheckTarget =
  | { kind: "ability"; ability: Ability; label: string }
  | { kind: "skill"; skillKey: string; ability: Ability; label: string }
  | { kind: "save"; ability: Ability; label: string };

export function resolveTarget(input: string): CheckTarget {
  const key = norm(input);

  // Saving throws: "str save", "constitution save", "dex saving throw", etc.
  const saveMatch = key.match(/^(.+?)(savingthrows?|saves?)$/);
  if (saveMatch) {
    const ability = ABILITY_ALIASES[saveMatch[1]];
    if (ability) return { kind: "save", ability, label: `${ability.toUpperCase()} Save` };
  }

  const ability = ABILITY_ALIASES[key];
  if (ability) return { kind: "ability", ability, label: ability.toUpperCase() };

  const skillAbility = SKILL_TO_ABILITY[key];
  if (skillAbility) {
    const nice = input.trim().replace(/\s+/g, " ");
    return { kind: "skill", skillKey: key, ability: skillAbility, label: nice };
  }

  throw new Error(`Unknown check "${input}"`);
}

export type CheckOutcome = {
  title: string;
  bonus: number;
  total: number;
  d20: number;
  breakdown: string;
};

export function rollD20(): number {
  return Math.floor(Math.random() * 20) + 1;
}

export function computeCheck(sheet: Sheet, input: string, formOverride?: Form): CheckOutcome {
  const form = formOverride ?? sheet.activeForm;
  const tgt = resolveTarget(input);

  const score = sheet.forms[form].abilities[tgt.ability];
  const mod = abilityMod(score);

  let prof = 0;
  if (tgt.kind === "skill") {
    const level = sheet.skillProf[tgt.skillKey] ?? 0;
    prof = profBonus(sheet.pb, level);
  } else if (tgt.kind === "save") {
    if (sheet.saveProf?.[tgt.ability]) prof = sheet.pb;
  }

  const bonus = mod + prof;
  const d20 = rollD20();
  const total = d20 + bonus;

  const formLabel = sheet.forms[form].label ?? form.toUpperCase();

  const profPart =
    tgt.kind === "skill"
      ? prof === 0
        ? ""
        : prof === sheet.pb
          ? ` + PB(${sheet.pb})`
          : ` + EXP(${sheet.pb * 2})`
      : tgt.kind === "save" && prof > 0
        ? ` + PB(${sheet.pb})`
        : "";

  const title =
    tgt.kind === "skill"
      ? `${tgt.label} (${tgt.ability.toUpperCase()}) — ${formLabel}`
      : tgt.kind === "save"
        ? `${tgt.label} — ${formLabel}`
        : `${tgt.label} check — ${formLabel}`;

  const breakdown = `d20(${d20}) + MOD(${mod >= 0 ? "+" : ""}${mod})${profPart} = ${total}`;

  return { title, bonus, total, d20, breakdown };
}

// Homebrew XP thresholds (not standard 5e) — edit here to adjust levelling pace.
export const LVLUP_TABLE = [0, 60, 180, 540, 1300, 2800, 4600, 6800, 9600, 12800, 17000, 20000, 24000, 28000, 33000, 38000, 44000, 50000, 57000, 65525];

export function expToLevel(exp: number): number {
  let level = 0;
  while (level < LVLUP_TABLE.length && LVLUP_TABLE[level] <= exp) level++;
  return level;
}

// Spell slot counts per level (index = level - 1)
export const CASTER_TABLE_FULL: number[][] = [
  [2], [3], [4, 2], [4, 3], [4, 3, 2], [4, 3, 3], [4, 3, 3, 1], [4, 3, 3, 2],
  [4, 3, 3, 3, 1], [4, 3, 3, 3, 2], [4, 3, 3, 3, 2, 1], [4, 3, 3, 3, 2, 1],
  [4, 3, 3, 3, 2, 1, 1], [4, 3, 3, 3, 2, 1, 1], [4, 3, 3, 3, 2, 1, 1, 1],
  [4, 3, 3, 3, 2, 1, 1, 1], [4, 3, 3, 3, 2, 1, 1, 1, 1], [4, 3, 3, 3, 3, 1, 1, 1, 1],
  [4, 3, 3, 3, 3, 2, 1, 1, 1], [4, 3, 3, 3, 3, 2, 2, 1, 1],
];

export const CASTER_TABLE_HALF: number[][] = [
  [2], [2], [3], [3], [4, 2], [4, 2], [4, 2], [4, 3], [4, 3], [4, 3, 2],
  [4, 3, 2], [4, 3, 3], [4, 3, 3], [4, 3, 3, 1], [4, 3, 3, 1], [4, 3, 3, 2],
  [4, 3, 3, 2], [4, 3, 3, 3, 1], [4, 3, 3, 3, 1], [4, 3, 3, 3, 2],
];

export const PROF_TABLE = [2, 2, 2, 2, 3, 3, 3, 3, 4, 4, 4, 4, 5, 5, 5, 5, 6, 6, 6, 6];

export function pbForLevel(level: number): number {
  if (level < 1) return 2;
  if (level > 20) return 6;
  return PROF_TABLE[level - 1];
}

export function spellSlotsForLevel(level: number, casterType: CasterType): Record<string, number> {
  if (casterType === "none" || level < 1 || level > 20) return {};
  const table = casterType === "full" ? CASTER_TABLE_FULL : CASTER_TABLE_HALF;
  const row = table[level - 1] ?? [];
  const slots: Record<string, number> = {};
  for (let i = 0; i < row.length; i++) {
    if (row[i] > 0) slots[String(i + 1)] = row[i];
  }
  return slots;
}