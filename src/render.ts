import type { Sheet, Ability } from "./skills";
import { abilityMod, expToLevel } from "./skills";

const ABIL_ORDER: Ability[] = ["str", "dex", "con", "int", "wis", "cha"];

function fmtMod(mod: number): string {
  return mod >= 0 ? `+${mod}` : `${mod}`;
}

export function renderSheet(sheet: Sheet): string {
  const lines: string[] = [];

  lines.push(`📜 **Character Sheet**`);
  if (sheet.name) lines.push(`**${sheet.name}**`);

  if (sheet.class) {
    const casterLabel = sheet.casterType && sheet.casterType !== "none"
      ? ` (${sheet.casterType} caster)`
      : "";
    lines.push(`Class: **${sheet.class}**${casterLabel}`);
  }

  lines.push(`Proficiency Bonus: **+${sheet.pb}**`);

  if (sheet.hp !== undefined || sheet.maxHp !== undefined) {
    const cur = sheet.hp ?? "?";
    const max = sheet.maxHp ?? "?";
    const tempPart = sheet.tempHp ? ` +${sheet.tempHp} temp` : "";
    lines.push(`HP: **${cur} / ${max}**${tempPart}${sheet.hitDice ? ` (d${sheet.hitDice})` : ""}`);
  }

  if (sheet.exp !== undefined) {
    lines.push(`Level **${expToLevel(sheet.exp)}** — EXP: **${sheet.exp}**`);
  }

  lines.push("");

  for (const formKey of ["irl", "ingame"] as const) {
    const form = sheet.forms[formKey];
    const activeMarker = sheet.activeForm === formKey ? " ⭐ (active)" : "";

    lines.push(`**${form.label ?? formKey.toUpperCase()}${activeMarker}**`);

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

  const saveProfList = ABIL_ORDER.filter(a => sheet.saveProf?.[a]);
  if (saveProfList.length > 0) {
    lines.push(`**Save Proficiencies:** ${saveProfList.map(a => a.toUpperCase()).join(", ")}`);
  }

  const slotLevels = Array.from({ length: 9 }, (_, i) => String(i + 1))
    .filter(l => (sheet.maxSpellSlots?.[l] ?? 0) > 0);
  if (slotLevels.length > 0) {
    lines.push(`**Spell Slots:** ${slotLevels.map(l => {
      const cur = sheet.spellSlots?.[l] ?? 0;
      const max = sheet.maxSpellSlots![l];
      return `L${l}: ${cur}/${max}`;
    }).join(" | ")}`);
  }

  lines.push("");
  const invEntries = Object.entries(sheet.inventory);
  if (invEntries.length > 0) {
    lines.push(`**Inventory:**`);
    invEntries.forEach(([item, qty], i) => {
      lines.push(`${i + 1}. ${item}${qty !== 1 ? ` × ${qty}` : ""}`);
    });
  } else {
    lines.push(`**Inventory:** *(empty)*`);
  }

  return lines.join("\n");
}