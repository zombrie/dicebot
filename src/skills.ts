// server/src/skills.ts
export type Ability = "str" | "dex" | "con" | "int" | "wis" | "cha";
export type Form = "irl" | "ingame";
export type ProfLevel = 0 | 1 | 2;

export type Sheet = {
  version: 1;
  name?: string;
  activeForm: Form;
  pb: number;
  forms: Record<Form, { label?: string; abilities: Record<Ability, number> }>;
  skillProf: Record<string, ProfLevel>; // normalized skill name -> level
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
  | { kind: "skill"; skillKey: string; ability: Ability; label: string };

export function resolveTarget(input: string): CheckTarget {
  const key = norm(input);

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
      : "";

  const title =
    tgt.kind === "skill"
      ? `${tgt.label} (${tgt.ability.toUpperCase()}) — ${formLabel}`
      : `${tgt.label} check — ${formLabel}`;

  const breakdown = `d20(${d20}) + MOD(${mod >= 0 ? "+" : ""}${mod})${profPart} = ${total}`;

  return { title, bonus, total, d20, breakdown };
}