// Handlers for all !npc commands. All operations are DM-only.
import type { HandlerContext } from "./context";
import type { ParsedCommand } from "../commands";
import {
  listNPCs, findNPCName, loadNPCSheet, saveNPCSheet, createNPC, deleteNPC,
} from "../npclib";
import { defaultSheet } from "../sheet";
import { isDM } from "../dm";
import { renderSheet, renderInventoryRow } from "../render";
import { calcInventoryWeight, getItem, isMagic } from "../itemlib";
import {
  norm, expToLevel, pbForLevel, spellSlotsForLevel, rollD20,
} from "../skills";
import type { Sheet } from "../skills";
import { rollDice } from "../dice";
import { lookupSpell, lookupSpellData, getDamageForLevel } from "../spellapi";
import { lookupWeapon, getAttackMod, isRanged } from "../weaponapi";

// Returns false and replies if the sender is not a DM.
async function requireDM(ctx: HandlerContext): Promise<boolean> {
  if (await isDM(ctx.evt.userId)) return true;
  await ctx.reply("⚠️ Only a DM can manage NPC sheets.");
  return false;
}

// DM check + case-insensitive NPC lookup + sheet load. fn is only called when both pass.
async function withNPC(
  ctx: HandlerContext,
  name: string,
  fn: (sheet: Sheet, canonicalName: string) => Promise<void>
): Promise<void> {
  if (!(await requireDM(ctx))) return;
  const canonical = await findNPCName(name);
  if (!canonical) {
    await ctx.reply(`⚠️ NPC "${name}" not found. Use \`!npc create ${name}\` to create it.`);
    return;
  }
  const sheet = await loadNPCSheet(canonical);
  await fn(sheet, canonical);
}

export async function handleNPCCreate(ctx: HandlerContext, parsed: Extract<ParsedCommand, { kind: "npc_create" }>): Promise<void> {
  if (!(await requireDM(ctx))) return;
  const created = await createNPC(parsed.name);
  if (!created) {
    await ctx.reply(`⚠️ An NPC named "${parsed.name}" already exists.`);
    return;
  }
  await ctx.reply(`✅ NPC **${parsed.name}** created! Use \`!npc ${parsed.name} sheet\` to view.`);
}

export async function handleNPCList(ctx: HandlerContext, _parsed: Extract<ParsedCommand, { kind: "npc_list" }>): Promise<void> {
  if (!(await requireDM(ctx))) return;
  const names = await listNPCs();
  if (names.length === 0) {
    await ctx.reply("No NPCs created yet. Use `!npc create <name>` to add one.");
    return;
  }
  await ctx.reply(`📋 **NPCs:**\n${names.map(n => `• ${n}`).join("\n")}`);
}

export async function handleNPCDelete(ctx: HandlerContext, parsed: Extract<ParsedCommand, { kind: "npc_delete" }>): Promise<void> {
  if (!(await requireDM(ctx))) return;
  const canonical = await deleteNPC(parsed.name);
  if (!canonical) {
    await ctx.reply(`⚠️ NPC "${parsed.name}" not found.`);
    return;
  }
  await ctx.reply(`🗑️ NPC **${canonical}** has been deleted.`);
}

export async function handleNPCSheet(ctx: HandlerContext, parsed: Extract<ParsedCommand, { kind: "npc_sheet" }>): Promise<void> {
  if (!(await requireDM(ctx))) return;
  const canonical = await findNPCName(parsed.name);
  if (!canonical) {
    await ctx.reply(`⚠️ NPC "${parsed.name}" not found.`);
    return;
  }
  await ctx.reply(renderSheet(await loadNPCSheet(canonical)));
}

export async function handleNPCReset(ctx: HandlerContext, parsed: Extract<ParsedCommand, { kind: "npc_reset" }>): Promise<void> {
  await withNPC(ctx, parsed.name, async (_sheet, canonical) => {
    await saveNPCSheet(canonical, { ...defaultSheet(), name: canonical });
    await ctx.reply(`🗑️ **${canonical}**'s sheet has been reset to default.`);
  });
}

export async function handleNPCUse(ctx: HandlerContext, parsed: Extract<ParsedCommand, { kind: "npc_use" }>): Promise<void> {
  await withNPC(ctx, parsed.name, async (sheet, canonical) => {
    sheet.activeForm = parsed.form;
    await saveNPCSheet(canonical, sheet);
    const label = sheet.forms[parsed.form].label ?? parsed.form.toUpperCase();
    await ctx.reply(`**${canonical}** set active stats to **${label}**.`);
  });
}

export async function handleNPCSetPB(ctx: HandlerContext, parsed: Extract<ParsedCommand, { kind: "npc_set_pb" }>): Promise<void> {
  if (!Number.isFinite(parsed.pb) || parsed.pb < 0 || parsed.pb > 20) {
    await ctx.reply("⚠️ PB must be between 0 and 20.");
    return;
  }
  await withNPC(ctx, parsed.name, async (sheet, canonical) => {
    sheet.pb = parsed.pb;
    await saveNPCSheet(canonical, sheet);
    await ctx.reply(`**${canonical}** set proficiency bonus to **${parsed.pb}**.`);
  });
}

export async function handleNPCSetAbility(ctx: HandlerContext, parsed: Extract<ParsedCommand, { kind: "npc_set_ability" }>): Promise<void> {
  if (!Number.isFinite(parsed.score) || parsed.score < 1 || parsed.score > 30) {
    await ctx.reply("⚠️ Ability score must be 1–30.");
    return;
  }
  await withNPC(ctx, parsed.name, async (sheet, canonical) => {
    sheet.forms[parsed.form].abilities[parsed.ability] = parsed.score;
    await saveNPCSheet(canonical, sheet);
    const formLabel = sheet.forms[parsed.form].label ?? parsed.form.toUpperCase();
    await ctx.reply(`**${canonical}** set **${parsed.ability.toUpperCase()}** (${formLabel}) to **${parsed.score}**.`);
  });
}

export async function handleNPCSetAbilities(ctx: HandlerContext, parsed: Extract<ParsedCommand, { kind: "npc_set_abilities" }>): Promise<void> {
  await withNPC(ctx, parsed.name, async (sheet, canonical) => {
    const applied = parsed.pairs.filter(({ score }) => Number.isFinite(score) && score >= 1 && score <= 30);
    if (applied.length === 0) {
      await ctx.reply("⚠️ No valid ability scores provided (must be 1–30).");
      return;
    }
    for (const { ability, score } of applied) {
      sheet.forms[parsed.form].abilities[ability] = score;
    }
    await saveNPCSheet(canonical, sheet);
    const formLabel = sheet.forms[parsed.form].label ?? parsed.form.toUpperCase();
    const summary = applied.map(p => `${p.ability.toUpperCase()} ${p.score}`).join(", ");
    await ctx.reply(`**${canonical}** updated **${formLabel}** abilities: ${summary}.`);
  });
}

export async function handleNPCProfSkill(ctx: HandlerContext, parsed: Extract<ParsedCommand, { kind: "npc_prof_skill" }>): Promise<void> {
  const key = norm(parsed.skill);
  await withNPC(ctx, parsed.name, async (sheet, canonical) => {
    sheet.skillProf[key] = parsed.level;
    await saveNPCSheet(canonical, sheet);
    const lvl = parsed.level === 0 ? "not proficient" : parsed.level === 1 ? "proficient" : "expertise";
    await ctx.reply(`**${canonical}** set **${parsed.skill.trim()}** to **${lvl}**.`);
  });
}

export async function handleNPCProfSave(ctx: HandlerContext, parsed: Extract<ParsedCommand, { kind: "npc_prof_save" }>): Promise<void> {
  await withNPC(ctx, parsed.name, async (sheet, canonical) => {
    if (!sheet.saveProf) sheet.saveProf = {};
    sheet.saveProf[parsed.ability] = parsed.proficient;
    await saveNPCSheet(canonical, sheet);
    const state = parsed.proficient ? "proficient in" : "no longer proficient in";
    await ctx.reply(`**${canonical}** is now ${state} **${parsed.ability.toUpperCase()} saves**.`);
  });
}

export async function handleNPCSetClass(ctx: HandlerContext, parsed: Extract<ParsedCommand, { kind: "npc_set_class" }>): Promise<void> {
  await withNPC(ctx, parsed.name, async (sheet, canonical) => {
    sheet.class = parsed.value;
    await saveNPCSheet(canonical, sheet);
    await ctx.reply(`**${canonical}** set class to **${parsed.value}**.`);
  });
}

export async function handleNPCSetCaster(ctx: HandlerContext, parsed: Extract<ParsedCommand, { kind: "npc_set_caster" }>): Promise<void> {
  await withNPC(ctx, parsed.name, async (sheet, canonical) => {
    sheet.casterType = parsed.casterType;
    await saveNPCSheet(canonical, sheet);
    await ctx.reply(`**${canonical}** set caster type to **${parsed.casterType}**.`);
  });
}

export async function handleNPCSetSlot(ctx: HandlerContext, parsed: Extract<ParsedCommand, { kind: "npc_set_slot" }>): Promise<void> {
  await withNPC(ctx, parsed.name, async (sheet, canonical) => {
    if (!sheet.spellSlots) sheet.spellSlots = {};
    // No max-slot guard — intentional DM override to correct slot counts mid-session.
    sheet.spellSlots[String(parsed.level)] = parsed.value;
    await saveNPCSheet(canonical, sheet);
    await ctx.reply(`**${canonical}** set level ${parsed.level} spell slots to **${parsed.value}**.`);
  });
}

export async function handleNPCSetMaxSlot(ctx: HandlerContext, parsed: Extract<ParsedCommand, { kind: "npc_set_maxslot" }>): Promise<void> {
  await withNPC(ctx, parsed.name, async (sheet, canonical) => {
    if (!sheet.maxSpellSlots) sheet.maxSpellSlots = {};
    sheet.maxSpellSlots[String(parsed.level)] = parsed.value;
    if (!sheet.spellSlots) sheet.spellSlots = {};
    if (sheet.spellSlots[String(parsed.level)] === undefined) {
      sheet.spellSlots[String(parsed.level)] = parsed.value;
    }
    await saveNPCSheet(canonical, sheet);
    await ctx.reply(`**${canonical}** set level ${parsed.level} max spell slots to **${parsed.value}**.`);
  });
}

export async function handleNPCSetHP(ctx: HandlerContext, parsed: Extract<ParsedCommand, { kind: "npc_set_hp" }>): Promise<void> {
  await withNPC(ctx, parsed.name, async (sheet, canonical) => {
    sheet.hp = parsed.value;
    await saveNPCSheet(canonical, sheet);
    await ctx.reply(`**${canonical}** set HP to **${parsed.value}**.`);
  });
}

export async function handleNPCSetMaxHP(ctx: HandlerContext, parsed: Extract<ParsedCommand, { kind: "npc_set_maxhp" }>): Promise<void> {
  await withNPC(ctx, parsed.name, async (sheet, canonical) => {
    sheet.maxHp = parsed.value;
    await saveNPCSheet(canonical, sheet);
    await ctx.reply(`**${canonical}** set max HP to **${parsed.value}**.`);
  });
}

export async function handleNPCSetTempHP(ctx: HandlerContext, parsed: Extract<ParsedCommand, { kind: "npc_set_temphp" }>): Promise<void> {
  await withNPC(ctx, parsed.name, async (sheet, canonical) => {
    sheet.tempHp = parsed.value;
    await saveNPCSheet(canonical, sheet);
    await ctx.reply(`**${canonical}** set temp HP to **${parsed.value}**.`);
  });
}

export async function handleNPCAdjustHP(ctx: HandlerContext, parsed: Extract<ParsedCommand, { kind: "npc_adjust_hp" }>): Promise<void> {
  await withNPC(ctx, parsed.name, async (sheet, canonical) => {
    let msg: string;
    if (parsed.delta < 0) {
      let dmg = -parsed.delta;
      let tempConsumed = 0;
      if (sheet.tempHp && sheet.tempHp > 0) {
        tempConsumed = Math.min(sheet.tempHp, dmg);
        sheet.tempHp -= tempConsumed;
        dmg -= tempConsumed;
      }
      sheet.hp = (sheet.hp ?? 0) - dmg;
      msg = `**${canonical}** took **${-parsed.delta}** damage.`;
      if (tempConsumed > 0) msg += ` *(${tempConsumed} absorbed by temp HP)*`;
      msg += ` *(HP: ${sheet.hp}${sheet.tempHp ? `, ${sheet.tempHp} temp remaining` : ""})*`;
    } else {
      sheet.hp = (sheet.hp ?? 0) + parsed.delta;
      msg = `**${canonical}** healed **${parsed.delta}** HP. *(now ${sheet.hp})*`;
    }
    await saveNPCSheet(canonical, sheet);
    await ctx.reply(msg);
  });
}

export async function handleNPCSetHD(ctx: HandlerContext, parsed: Extract<ParsedCommand, { kind: "npc_set_hd" }>): Promise<void> {
  await withNPC(ctx, parsed.name, async (sheet, canonical) => {
    sheet.hitDice = parsed.value;
    await saveNPCSheet(canonical, sheet);
    await ctx.reply(`**${canonical}** set hit die to **d${parsed.value}**.`);
  });
}

export async function handleNPCRestLong(ctx: HandlerContext, parsed: Extract<ParsedCommand, { kind: "npc_rest_long" }>): Promise<void> {
  await withNPC(ctx, parsed.name, async (sheet, canonical) => {
    const lines: string[] = [`🌙 **${canonical}** took a long rest!`];
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
    await saveNPCSheet(canonical, sheet);
    await ctx.reply(lines.join("\n"));
  });
}

export async function handleNPCRestShort(ctx: HandlerContext, parsed: Extract<ParsedCommand, { kind: "npc_rest_short" }>): Promise<void> {
  await withNPC(ctx, parsed.name, async (sheet, canonical) => {
    if (!sheet.hitDice) {
      await ctx.reply(`⚠️ Set **${canonical}**'s hit die first: \`!npc ${canonical} set hd 8\``);
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
    await saveNPCSheet(canonical, sheet);
    const rollStr = rolls.length === 1 ? `d${sheet.hitDice}(${rolls[0]})` : `[${rolls.join(", ")}]`;
    const conStr = conMod !== 0 ? ` + CON(${conMod >= 0 ? "+" : ""}${conMod})×${parsed.dice}` : "";
    await ctx.reply(`🌙 **${canonical}** short rest! Rolled ${rollStr}${conStr} = **+${recovered} HP** *(${sheet.hp}${sheet.maxHp !== undefined ? `/${sheet.maxHp}` : ""})*`);
  });
}

export async function handleNPCExp(ctx: HandlerContext, parsed: Extract<ParsedCommand, { kind: "npc_exp" }>): Promise<void> {
  await withNPC(ctx, parsed.name, async (sheet, canonical) => {
    const oldExp = sheet.exp ?? 0;
    const oldLevel = expToLevel(oldExp);
    sheet.exp = Math.max(0, oldExp + parsed.amount);
    const newLevel = expToLevel(sheet.exp);

    let msg = parsed.amount > 0
      ? `✨ **${canonical}** earned **${parsed.amount}** exp! *(${sheet.exp} total)*`
      : parsed.amount < 0
        ? `**${canonical}** lost **${-parsed.amount}** exp. *(${sheet.exp} total)*`
        : `**${canonical}**'s exp is unchanged. *(${sheet.exp} total)*`;

    if (newLevel !== oldLevel) {
      const details: string[] = [];
      const oldPb = sheet.pb;
      sheet.pb = pbForLevel(newLevel);
      if (sheet.pb !== oldPb) details.push(`PB now +${sheet.pb}`);

      if (sheet.hitDice !== undefined) {
        const conMod = Math.floor((sheet.forms[sheet.activeForm].abilities.con - 10) / 2);
        const hpChange = (sheet.hitDice + conMod) * (newLevel - oldLevel);
        sheet.maxHp = (sheet.maxHp ?? 0) + hpChange;
        sheet.hp = (sheet.hp ?? 0) + hpChange;
        details.push(`${hpChange > 0 ? "+" : ""}${hpChange} max HP`);
      }
      if (sheet.casterType && sheet.casterType !== "none") {
        const oldSlots = spellSlotsForLevel(oldLevel, sheet.casterType);
        const newSlots = spellSlotsForLevel(newLevel, sheet.casterType);
        sheet.maxSpellSlots = newSlots;
        if (!sheet.spellSlots) sheet.spellSlots = {};
        for (let i = 1; i <= 9; i++) {
          const key = String(i);
          const newMax = newSlots[key] ?? 0;
          const oldMax = oldSlots[key] ?? 0;
          const cur = sheet.spellSlots[key] ?? 0;
          if (newMax === 0) delete sheet.spellSlots[key];
          else sheet.spellSlots[key] = Math.max(0, Math.min(newMax, cur + (newMax - oldMax)));
        }
        details.push("spell slots updated");
      }
      const detailStr = details.length ? ` *(${details.join(", ")})*` : "";
      msg += newLevel > oldLevel
        ? `\n🎉 **Level up! ${canonical} reached level ${newLevel}!**${detailStr}`
        : `\n📉 ${canonical} dropped to level ${newLevel}.${detailStr}`;
    }

    await saveNPCSheet(canonical, sheet);
    await ctx.reply(msg);
  });
}

export async function handleNPCInvShow(ctx: HandlerContext, parsed: Extract<ParsedCommand, { kind: "npc_inv_show" }>): Promise<void> {
  if (!(await requireDM(ctx))) return;
  const canonical = await findNPCName(parsed.name);
  if (!canonical) { await ctx.reply(`⚠️ NPC "${parsed.name}" not found.`); return; }
  const sheet = await loadNPCSheet(canonical);

  const invEntries = Object.entries(sheet.inventory);
  if (invEntries.length === 0) {
    await ctx.reply(`**${canonical}**'s inventory is empty.`);
    return;
  }
  const { used, lib } = await calcInventoryWeight(sheet.inventory);
  const strScore = sheet.forms[sheet.activeForm].abilities.str;
  const capacity = strScore * 15;
  const weightStr = used > 0 ? ` (${used.toFixed(1)} / ${capacity} lbs)` : "";
  const lines = [`**${canonical}**'s inventory${weightStr}:`];
  invEntries.forEach(([item, qty], i) => {
    const entry = lib[item] ?? Object.entries(lib).find(([k]) => k.toLowerCase() === item.toLowerCase())?.[1];
    lines.push(renderInventoryRow(i, item, qty, entry));
  });
  await ctx.reply(lines.join("\n"));
}

export async function handleNPCInvAdd(ctx: HandlerContext, parsed: Extract<ParsedCommand, { kind: "npc_inv_add" }>): Promise<void> {
  await withNPC(ctx, parsed.name, async (sheet, canonical) => {
    const strScore = sheet.forms[sheet.activeForm].abilities.str;
    const capacity = strScore * 15;
    const { used } = await calcInventoryWeight(sheet.inventory);
    let addedWeight = 0;
    for (const { item, qty } of parsed.items) {
      const libEntry = await getItem(item);
      if (libEntry) addedWeight += libEntry.weight * qty;
    }
    if (addedWeight > 0 && used + addedWeight > capacity) {
      await ctx.reply(`⚠️ That would exceed **${canonical}**'s carrying capacity! (${used.toFixed(1)} + ${addedWeight.toFixed(1)} > ${capacity} lbs)`);
      return;
    }
    const summary: string[] = [];
    for (const { item, qty } of parsed.items) {
      const existingKey = Object.keys(sheet.inventory).find(k => k.toLowerCase() === item.toLowerCase());
      const key = existingKey ?? item;
      sheet.inventory[key] = (sheet.inventory[key] ?? 0) + qty;
      summary.push(`**${item}**${qty !== 1 ? ` ×${qty}` : ""}`);
    }
    await saveNPCSheet(canonical, sheet);
    await ctx.reply(summary.length === 1
      ? `Added ${summary[0]} to **${canonical}**'s inventory.`
      : `Added ${summary.length} items to **${canonical}**'s inventory: ${summary.join(", ")}.`
    );
  });
}

export async function handleNPCInvRemove(ctx: HandlerContext, parsed: Extract<ParsedCommand, { kind: "npc_inv_remove" }>): Promise<void> {
  await withNPC(ctx, parsed.name, async (sheet, canonical) => {
    const key = Object.keys(sheet.inventory).find(k => k.toLowerCase() === parsed.item.toLowerCase());
    if (!key) { await ctx.reply(`⚠️ **${parsed.item}** not found in **${canonical}**'s inventory.`); return; }
    if (sheet.inventory[key] <= parsed.qty) delete sheet.inventory[key];
    else sheet.inventory[key] -= parsed.qty;
    await saveNPCSheet(canonical, sheet);
    const qtyStr = parsed.qty !== 1 ? ` ×${parsed.qty}` : "";
    await ctx.reply(`Removed **${parsed.item}**${qtyStr} from **${canonical}**'s inventory.`);
  });
}

export async function handleNPCInvClear(ctx: HandlerContext, parsed: Extract<ParsedCommand, { kind: "npc_inv_clear" }>): Promise<void> {
  await withNPC(ctx, parsed.name, async (sheet, canonical) => {
    sheet.inventory = {};
    await saveNPCSheet(canonical, sheet);
    await ctx.reply(`Cleared **${canonical}**'s inventory.`);
  });
}

export async function handleNPCCast(ctx: HandlerContext, parsed: Extract<ParsedCommand, { kind: "npc_cast" }>): Promise<void> {
  await withNPC(ctx, parsed.name, async (sheet, canonical) => {
    const key = String(parsed.level);
    const cur = sheet.spellSlots?.[key] ?? 0;
    if (cur <= 0) { await ctx.reply(`⚠️ **${canonical}** has no level ${parsed.level} spell slots remaining!`); return; }
    if (!sheet.spellSlots) sheet.spellSlots = {};
    sheet.spellSlots[key] = cur - 1;
    await saveNPCSheet(canonical, sheet);
    const remaining = sheet.spellSlots[key];
    await ctx.reply(`🪄 **${canonical}** expended a level ${parsed.level} slot. *(${remaining} slot${remaining !== 1 ? "s" : ""} remaining)*`);
  });
}

export async function handleNPCSpellCast(ctx: HandlerContext, parsed: Extract<ParsedCommand, { kind: "npc_spell_cast" }>): Promise<void> {
  await withNPC(ctx, parsed.name, async (sheet, canonical) => {
    let spell;
    try {
      spell = await lookupSpellData(parsed.spell);
    } catch (e) {
      await ctx.reply(`⚠️ ${e instanceof Error ? e.message : "Unknown error"}`);
      return;
    }

    if (sheet.knownSpells && sheet.knownSpells.length > 0) {
      const spellLower = parsed.spell.toLowerCase();
      const resolvedLower = spell.name.toLowerCase();
      if (!sheet.knownSpells.some(s => s === spellLower || s === resolvedLower)) {
        await ctx.reply(`⚠️ **${spell.name}** is not in **${canonical}**'s known spells. Use \`!npc ${canonical} spells add ${resolvedLower}\` to add it.`);
        return;
      }
    }

    const isCantrip = spell.level === 0;
    const minLevel = spell.level;
    const slotLevel = parsed.level ?? minLevel;

    if (!isCantrip && slotLevel < minLevel) {
      await ctx.reply(`⚠️ **${spell.name}** requires at least a level ${minLevel} slot.`);
      return;
    }

    if (!isCantrip) {
      const key = String(slotLevel);
      const cur = sheet.spellSlots?.[key] ?? 0;
      if (cur <= 0) { await ctx.reply(`⚠️ **${canonical}** has no level ${slotLevel} spell slots remaining!`); return; }
      if (!sheet.spellSlots) sheet.spellSlots = {};
      sheet.spellSlots[key] = cur - 1;
      await saveNPCSheet(canonical, sheet);
    }

    const schoolName = typeof spell.school === "object" ? spell.school.name : spell.school;
    const levelStr = isCantrip
      ? `${schoolName} cantrip *(no slot used)*`
      : slotLevel === minLevel ? `level ${slotLevel} ${schoolName}`
      : `${schoolName} upcast to level ${slotLevel}`;
    const lines = [`🪄 **${canonical}** cast **${spell.name}** — ${levelStr}!`];

    const dmgInfo = getDamageForLevel(spell, slotLevel);
    if (dmgInfo) {
      try {
        const result = rollDice(dmgInfo.roll);
        const dmgType = spell.damage_types?.length ? ` ${spell.damage_types.join("/")}` : "";
        const upcastNote = !dmgInfo.exact && slotLevel > minLevel
          ? ` *(base damage — check \`!spell ${spell.name}\` for upcasting)*` : "";
        lines.push(`${dmgInfo.roll}${dmgType} → **${result.total}**${upcastNote}`);
      } catch {
        lines.push(`Damage: ${dmgInfo.roll} *(roll manually)*`);
      }
    } else if (spell.attack_roll) {
      lines.push(`*Make a spell attack roll.*`);
    } else {
      lines.push(`*No damage roll — see spell description for effect.*`);
    }

    if (spell.saving_throw_ability) lines.push(`*Targets make a ${spell.saving_throw_ability.toUpperCase()} save.*`);
    if (!isCantrip) {
      const remaining = sheet.spellSlots?.[String(slotLevel)] ?? 0;
      lines.push(`*(${remaining} level ${slotLevel} slot${remaining !== 1 ? "s" : ""} remaining)*`);
    }
    await ctx.reply(lines.join("\n"));
  });
}

export async function handleNPCSpellsShow(ctx: HandlerContext, parsed: Extract<ParsedCommand, { kind: "npc_spells_show" }>): Promise<void> {
  if (!(await requireDM(ctx))) return;
  const canonical = await findNPCName(parsed.name);
  if (!canonical) { await ctx.reply(`⚠️ NPC "${parsed.name}" not found.`); return; }
  const sheet = await loadNPCSheet(canonical);
  const spells = sheet.knownSpells;
  if (!spells || spells.length === 0) {
    await ctx.reply(`📖 **${canonical}** has no known spells set. Use \`!npc ${canonical} spells add <name>\` to add one.`);
    return;
  }
  await ctx.reply(`📖 **${canonical}'s known spells (${spells.length}):**\n${[...spells].sort().join(", ")}`);
}

export async function handleNPCSpellsAdd(ctx: HandlerContext, parsed: Extract<ParsedCommand, { kind: "npc_spells_add" }>): Promise<void> {
  await withNPC(ctx, parsed.name, async (sheet, canonical) => {
    if (!sheet.knownSpells) sheet.knownSpells = [];
    if (!sheet.knownSpells.includes(parsed.spell)) {
      sheet.knownSpells.push(parsed.spell);
      sheet.knownSpells.sort();
    }
    await saveNPCSheet(canonical, sheet);
    await ctx.reply(`📖 **${parsed.spell}** added to **${canonical}**'s known spells.`);
  });
}

export async function handleNPCSpellsRemove(ctx: HandlerContext, parsed: Extract<ParsedCommand, { kind: "npc_spells_remove" }>): Promise<void> {
  await withNPC(ctx, parsed.name, async (sheet, canonical) => {
    const idx = sheet.knownSpells?.indexOf(parsed.spell) ?? -1;
    if (idx === -1) { await ctx.reply(`⚠️ **${parsed.spell}** not found in **${canonical}**'s known spells.`); return; }
    sheet.knownSpells!.splice(idx, 1);
    await saveNPCSheet(canonical, sheet);
    await ctx.reply(`📖 **${parsed.spell}** removed from **${canonical}**'s known spells.`);
  });
}

export async function handleNPCSpellsClear(ctx: HandlerContext, parsed: Extract<ParsedCommand, { kind: "npc_spells_clear" }>): Promise<void> {
  await withNPC(ctx, parsed.name, async (sheet, canonical) => {
    sheet.knownSpells = [];
    await saveNPCSheet(canonical, sheet);
    await ctx.reply(`📖 **${canonical}**'s known spells list cleared.`);
  });
}
