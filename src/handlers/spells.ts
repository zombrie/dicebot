import type { HandlerContext } from "./context";
import type { ParsedCommand } from "../commands";
import { saveSheet, loadSheet } from "../sheet";
import { lookupSpell, lookupSpellData, getDamageForLevel } from "../spellapi";
import { lookupWeapon, getAttackMod, isRanged } from "../weaponapi";
import { rollDice } from "../dice";
import { rollD20 } from "../skills";
import type { UserGuid } from "@rootsdk/server-bot";

export async function handleSpellsShow(ctx: HandlerContext, _parsed: Extract<ParsedCommand, { kind: "spells_show" }>): Promise<void> {
  const { evt, who, reply } = ctx;
  const sheet = await loadSheet(evt.userId as UserGuid);
  const spells = sheet.knownSpells;
  if (!spells || spells.length === 0) {
    await reply(`📖 ${who} has no known spells set. Import from D&D Beyond with \`!import\`, or add with \`!spells add <name>\`.`);
    return;
  }
  await reply(`📖 **${who}'s known spells (${spells.length}):**\n${[...spells].sort().join(", ")}`);
}

export async function handleSpellsAdd(ctx: HandlerContext, parsed: Extract<ParsedCommand, { kind: "spells_add" }>): Promise<void> {
  const { evt, who, reply } = ctx;
  const sheet = await loadSheet(evt.userId as UserGuid);
  if (!sheet.knownSpells) sheet.knownSpells = [];
  if (!sheet.knownSpells.includes(parsed.spell)) {
    sheet.knownSpells.push(parsed.spell);
    sheet.knownSpells.sort();
  }
  await saveSheet(evt.userId as UserGuid, sheet);
  await reply(`📖 **${parsed.spell}** added to ${who}'s known spells.`);
}

export async function handleSpellsRemove(ctx: HandlerContext, parsed: Extract<ParsedCommand, { kind: "spells_remove" }>): Promise<void> {
  const { evt, who, reply } = ctx;
  const sheet = await loadSheet(evt.userId as UserGuid);
  const idx = sheet.knownSpells?.indexOf(parsed.spell) ?? -1;
  if (idx === -1) {
    await reply(`⚠️ **${parsed.spell}** not found in your known spells.`);
    return;
  }
  sheet.knownSpells!.splice(idx, 1);
  await saveSheet(evt.userId as UserGuid, sheet);
  await reply(`📖 **${parsed.spell}** removed from ${who}'s known spells.`);
}

export async function handleSpellsClear(ctx: HandlerContext, _parsed: Extract<ParsedCommand, { kind: "spells_clear" }>): Promise<void> {
  const { evt, who, reply } = ctx;
  const sheet = await loadSheet(evt.userId as UserGuid);
  sheet.knownSpells = [];
  await saveSheet(evt.userId as UserGuid, sheet);
  await reply(`📖 ${who}'s known spells list cleared.`);
}

export async function handleSpellLookup(ctx: HandlerContext, parsed: Extract<ParsedCommand, { kind: "spell_lookup" }>): Promise<void> {
  const { reply } = ctx;
  try {
    await reply(await lookupSpell(parsed.name));
  } catch (e) {
    await reply(`⚠️ ${e instanceof Error ? e.message : "Unknown error"}`);
  }
}

export async function handleCast(ctx: HandlerContext, parsed: Extract<ParsedCommand, { kind: "cast" }>): Promise<void> {
  const { evt, who, reply } = ctx;
  const sheet = await loadSheet(evt.userId as UserGuid);
  const key = String(parsed.level);
  const cur = sheet.spellSlots?.[key] ?? 0;
  if (cur <= 0) {
    await reply(`⚠️ No level ${parsed.level} spell slots remaining!`);
    return;
  }
  if (!sheet.spellSlots) sheet.spellSlots = {};
  sheet.spellSlots[key] = cur - 1;
  await saveSheet(evt.userId as UserGuid, sheet);
  const remaining = sheet.spellSlots[key];
  await reply(`🪄 ${who} expended a level ${parsed.level} slot. *(${remaining} slot${remaining !== 1 ? "s" : ""} remaining)*`);
}

export async function handleSpellCast(ctx: HandlerContext, parsed: Extract<ParsedCommand, { kind: "spell_cast" }>): Promise<void> {
  const { evt, who, reply } = ctx;
  const sheet = await loadSheet(evt.userId as UserGuid);

  let spell;
  try {
    spell = await lookupSpellData(parsed.spell);
  } catch (e) {
    await reply(`⚠️ ${e instanceof Error ? e.message : "Unknown error"}`);
    return;
  }

  if (sheet.knownSpells && sheet.knownSpells.length > 0) {
    const spellLower = parsed.spell.toLowerCase();
    const resolvedLower = spell.name.toLowerCase();
    if (!sheet.knownSpells.some(s => s === spellLower || s === resolvedLower)) {
      await reply(
        `⚠️ **${spell.name}** is not in your known spells. ` +
        `Use \`!spells add ${resolvedLower}\` to add it, or \`!spells\` to see your list.`
      );
      return;
    }
  }

  const isCantrip = spell.level === 0;
  const minLevel = spell.level;
  const slotLevel = parsed.level ?? minLevel;

  if (!isCantrip && slotLevel < minLevel) {
    await reply(`⚠️ **${spell.name}** requires at least a level ${minLevel} slot.`);
    return;
  }

  if (!isCantrip) {
    const key = String(slotLevel);
    const cur = sheet.spellSlots?.[key] ?? 0;
    if (cur <= 0) {
      await reply(`⚠️ No level ${slotLevel} spell slots remaining!`);
      return;
    }
    if (!sheet.spellSlots) sheet.spellSlots = {};
    sheet.spellSlots[key] = cur - 1;
    await saveSheet(evt.userId as UserGuid, sheet);
  }

  const schoolName = typeof spell.school === "object" ? spell.school.name : spell.school;
  const levelStr = isCantrip
    ? `${schoolName} cantrip *(no slot used)*`
    : slotLevel === minLevel
      ? `level ${slotLevel} ${schoolName}`
      : `${schoolName} upcast to level ${slotLevel}`;
  const lines = [`🪄 ${who} cast **${spell.name}** — ${levelStr}!`];

  const dmgInfo = getDamageForLevel(spell, slotLevel);
  if (dmgInfo) {
    try {
      const result = rollDice(dmgInfo.roll);
      const dmgType = spell.damage_types?.length ? ` ${spell.damage_types.join("/")}` : "";
      const upcastNote = !dmgInfo.exact && slotLevel > minLevel
        ? ` *(base damage — check \`!spell ${spell.name}\` for upcasting)*`
        : "";
      lines.push(`${dmgInfo.roll}${dmgType} → **${result.total}**${upcastNote}`);
    } catch {
      lines.push(`Damage: ${dmgInfo.roll} *(roll manually)*`);
    }
  } else if (spell.attack_roll) {
    lines.push(`*Make a spell attack roll.*`);
  } else {
    lines.push(`*No damage roll — see spell description for effect.*`);
  }

  if (spell.saving_throw_ability) {
    lines.push(`*Targets make a ${spell.saving_throw_ability.toUpperCase()} save.*`);
  }
  if (!isCantrip) {
    const remaining = sheet.spellSlots?.[String(slotLevel)] ?? 0;
    lines.push(`*(${remaining} level ${slotLevel} slot${remaining !== 1 ? "s" : ""} remaining)*`);
  }

  await reply(lines.join("\n"));
}

export async function handleRestLong(ctx: HandlerContext, parsed: Extract<ParsedCommand, { kind: "rest_long" }>): Promise<void> {
  const { who, reply, withTargetSheet } = ctx;
  await withTargetSheet(parsed.targetUserId, async (sheet, ft, targetId) => {
    const lines: string[] = [`🌙 **Long rest complete**${ft}!`];

    if (sheet.maxHp !== undefined) {
      sheet.hp = sheet.maxHp;
      lines.push(`HP restored to **${sheet.hp} / ${sheet.maxHp}**.`);
    }
    if (sheet.maxSpellSlots && Object.keys(sheet.maxSpellSlots).length > 0) {
      sheet.spellSlots = { ...sheet.maxSpellSlots };
      const slotStr = Object.entries(sheet.maxSpellSlots).map(([l, n]) => `L${l}: ${n}`).join(", ");
      lines.push(`Spell slots restored: ${slotStr}.`);
    }
    if (sheet.tempHp) {
      sheet.tempHp = undefined;
      lines.push("Temp HP cleared.");
    }

    await saveSheet(targetId, sheet);
    await reply(lines.join("\n"));
  });
}

export async function handleRestShort(ctx: HandlerContext, parsed: Extract<ParsedCommand, { kind: "rest_short" }>): Promise<void> {
  const { who, reply, withTargetSheet } = ctx;
  await withTargetSheet(parsed.targetUserId, async (sheet, ft, targetId) => {
    if (!sheet.hitDice) {
      await reply("⚠️ Set your hit die first: `!char set hd 8`");
      return;
    }
    const conMod = Math.floor((sheet.forms[sheet.activeForm].abilities.con - 10) / 2);
    const rolls: number[] = [];
    for (let i = 0; i < parsed.dice; i++) {
      rolls.push(Math.floor(Math.random() * sheet.hitDice) + 1);
    }
    const heal = Math.max(1, rolls.reduce((a, b) => a + b, 0) + conMod * parsed.dice);
    const oldHp = sheet.hp ?? 0;
    sheet.hp = sheet.maxHp !== undefined ? Math.min(sheet.maxHp, oldHp + heal) : oldHp + heal;
    const recovered = sheet.hp - oldHp;
    await saveSheet(targetId, sheet);

    const rollStr = rolls.length === 1 ? `d${sheet.hitDice}(${rolls[0]})` : `[${rolls.join(", ")}]`;
    const conStr = conMod !== 0 ? ` + CON(${conMod >= 0 ? "+" : ""}${conMod})×${parsed.dice}` : "";
    await reply(`🌙 Short rest${ft}! Rolled ${rollStr}${conStr} = **+${recovered} HP** *(${sheet.hp}${sheet.maxHp !== undefined ? `/${sheet.maxHp}` : ""})*`);
  });
}

export async function handleAttack(ctx: HandlerContext, parsed: Extract<ParsedCommand, { kind: "attack" }>): Promise<void> {
  const { evt, who, reply } = ctx;
  const sheet = await loadSheet(evt.userId as UserGuid);

  const inventoryKey = Object.keys(sheet.inventory).find(
    k => k.toLowerCase() === parsed.weapon.toLowerCase()
  );
  if (!inventoryKey) {
    await reply(`⚠️ **${parsed.weapon}** is not in your inventory.`);
    return;
  }

  let weapon;
  try {
    weapon = await lookupWeapon(inventoryKey);
  } catch (e) {
    await reply(`⚠️ ${e instanceof Error ? e.message : "Unknown error"}`);
    return;
  }

  const { ability, mod } = getAttackMod(weapon, sheet);
  const pb = sheet.pb;
  const modStr = mod >= 0 ? `+${mod}` : `${mod}`;

  const r1 = rollD20();
  let d20Total: number;
  let d20Display: string;
  if (parsed.advantage) {
    const r2 = rollD20();
    d20Total = parsed.advantage === "adv" ? Math.max(r1, r2) : Math.min(r1, r2);
    const dropped = parsed.advantage === "adv" ? Math.min(r1, r2) : Math.max(r1, r2);
    const label = parsed.advantage === "adv" ? "advantage" : "disadvantage";
    d20Display = `d20(${d20Total}, ${dropped} → ${label}) `;
  } else {
    d20Total = r1;
    d20Display = `d20(${r1}) `;
  }
  const atkTotal = d20Total + mod + pb;

  let dmgLine: string;
  try {
    const dmgResult = rollDice(weapon.damage_dice);
    const dmgTotal = dmgResult.total + mod;
    const dmgType = weapon.damage_type.name.toLowerCase();
    dmgLine = `${weapon.damage_dice}(${dmgResult.total}) ${modStr} = **${dmgTotal}** ${dmgType}`;
  } catch {
    dmgLine = `Damage: ${weapon.damage_dice} *(roll manually)*`;
  }

  const rangeNote = isRanged(weapon) ? ` *(ranged — ${weapon.range}/${weapon.long_range} ft)*` : "";
  const displayName = weapon.name.toLowerCase() !== inventoryKey.toLowerCase()
    ? `${inventoryKey} (${weapon.name})`
    : weapon.name;

  await reply([
    `⚔️ ${who} attacks with **${displayName}**${rangeNote}!`,
    `Attack: ${d20Display}${modStr} ${ability.toUpperCase()} + PB(${pb}) = **${atkTotal}**`,
    `Damage: ${dmgLine}`,
  ].join("\n"));
}
