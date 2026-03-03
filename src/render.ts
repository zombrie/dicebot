import type { Sheet, Ability } from "./skills";
import { abilityMod } from "./skills";

const ABIL_ORDER: Ability[] = ["str", "dex", "con", "int", "wis", "cha"];

function fmtMod(mod: number): string {
  return mod >= 0 ? `+${mod}` : `${mod}`;
}

export function renderSheet(sheet: Sheet): string {
  const lines: string[] = [];

  lines.push(`📜 **Character Sheet**`);
  lines.push(`Proficiency Bonus: **+${sheet.pb}**`);
  lines.push("");

  for (const formKey of ["irl", "ingame"] as const) {
    const form = sheet.forms[formKey];
    const activeMarker = sheet.activeForm === formKey ? " ⭐ (active)" : "";

    lines.push(`**Form ${formKey.toUpperCase()}${activeMarker}**`);

    const abilityLine = ABIL_ORDER
      .map(a => {
        const score = form.abilities[a];
        const mod = abilityMod(score);
        return `${a.toUpperCase()} ${score} (${fmtMod(mod)})`;
      })
      .join(" | ");

    lines.push(abilityLine);
    lines.push("");
  }

  const profSkills = Object.entries(sheet.skillProf)
    .filter(([, lvl]) => lvl > 0)
    .map(([skill, lvl]) =>
      lvl === 2
        ? `${skill} (EXP)`
        : `${skill}`
    );

  if (profSkills.length > 0) {
    lines.push(`**Proficiencies:**`);
    lines.push(profSkills.join(", "));
  } else {
    lines.push(`No skill proficiencies set.`);
  }

  return lines.join("\n");
}