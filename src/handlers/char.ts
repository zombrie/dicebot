// Handlers for !char and !sheet commands: ability scores, HP, proficiencies, spell slots, and sheet display.
import { resolveUserGuid, npcName } from "./context";
import type { HandlerContext } from "./context";
import type { ParsedCommand } from "../commands";
import { loadSheet, defaultSheet } from "../sheet";
import { findNPCName, loadNPCSheet } from "../npclib";
import { norm } from "../skills";
import { renderSheet } from "../render";
import type { UserGuid } from "@rootsdk/server-bot";

export async function handleCharUse(ctx: HandlerContext, parsed: Extract<ParsedCommand, { kind: "char_use" }>): Promise<void> {
  const { who, reply, withTargetSheet } = ctx;
  await withTargetSheet(parsed.targetUserId, async (sheet, ft, save) => {
    sheet.activeForm = parsed.form;
    await save(sheet);
    const label = sheet.forms[parsed.form].label ?? parsed.form.toUpperCase();
    await reply(`${who} set active stats to **${label}**${ft}.`);
  });
}

export async function handleCharSetPB(ctx: HandlerContext, parsed: Extract<ParsedCommand, { kind: "char_set_pb" }>): Promise<void> {
  const { who, reply, withTargetSheet } = ctx;
  if (!Number.isFinite(parsed.pb) || parsed.pb < 0 || parsed.pb > 20) {
    await reply("⚠️ PB must be between 0 and 20.");
    return;
  }
  await withTargetSheet(parsed.targetUserId, async (sheet, ft, save) => {
    sheet.pb = parsed.pb;
    await save(sheet);
    await reply(`${who} set proficiency bonus to **${parsed.pb}**${ft}.`);
  });
}

export async function handleCharSetAbility(ctx: HandlerContext, parsed: Extract<ParsedCommand, { kind: "char_set_ability" }>): Promise<void> {
  const { who, reply, withTargetSheet } = ctx;
  if (!Number.isFinite(parsed.score) || parsed.score < 1 || parsed.score > 30) {
    await reply("⚠️ Ability score must be 1–30.");
    return;
  }
  await withTargetSheet(parsed.targetUserId, async (sheet, ft, save) => {
    sheet.forms[parsed.form].abilities[parsed.ability] = parsed.score;
    await save(sheet);
    const formLabel = sheet.forms[parsed.form].label ?? parsed.form.toUpperCase();
    await reply(`${who} set **${parsed.ability.toUpperCase()}** (${formLabel}) to **${parsed.score}**${ft}.`);
  });
}

export async function handleCharSetAbilities(ctx: HandlerContext, parsed: Extract<ParsedCommand, { kind: "char_set_abilities" }>): Promise<void> {
  const { who, reply, withTargetSheet } = ctx;
  await withTargetSheet(parsed.targetUserId, async (sheet, ft, save) => {
    const applied = parsed.pairs.filter(({ score }) => Number.isFinite(score) && score >= 1 && score <= 30);
    if (applied.length === 0) {
      await reply("⚠️ No valid ability scores provided (must be 1–30).");
      return;
    }
    for (const { ability, score } of applied) {
      sheet.forms[parsed.form].abilities[ability] = score;
    }
    await save(sheet);
    const formLabel = sheet.forms[parsed.form].label ?? parsed.form.toUpperCase();
    const summary = applied.map(p => `${p.ability.toUpperCase()} ${p.score}`).join(", ");
    await reply(`${who} updated **${formLabel}** abilities: ${summary}${ft}.`);
  });
}

export async function handleCharProfSkill(ctx: HandlerContext, parsed: Extract<ParsedCommand, { kind: "char_prof_skill" }>): Promise<void> {
  const { who, reply, withTargetSheet } = ctx;
  const key = norm(parsed.skill);
  await withTargetSheet(parsed.targetUserId, async (sheet, ft, save) => {
    sheet.skillProf[key] = parsed.level;
    await save(sheet);
    const lvl =
      parsed.level === 0 ? "not proficient" :
      parsed.level === 1 ? "proficient" :
      "expertise";
    await reply(`${who} set **${parsed.skill.trim()}** to **${lvl}**${ft}.`);
  });
}

export async function handleSheet(ctx: HandlerContext, parsed: Extract<ParsedCommand, { kind: "sheet" }>): Promise<void> {
  const { evt, reply } = ctx;
  if (parsed.targetUserId?.startsWith('#')) {
    const name = parsed.targetUserId.slice(1).trim();
    const canonical = await findNPCName(name);
    if (!canonical) { await reply(`⚠️ NPC "${name}" not found.`); return; }
    await reply(renderSheet(await loadNPCSheet(canonical)));
  } else {
    const targetId = parsed.targetUserId ? await resolveUserGuid(parsed.targetUserId) : evt.userId as UserGuid;
    await reply(renderSheet(await loadSheet(targetId)));
  }
}

export async function handleSheetReset(ctx: HandlerContext, parsed: Extract<ParsedCommand, { kind: "sheet_reset" }>): Promise<void> {
  const { evt, who, reply, getNickname, mentionUser, withTargetSheet } = ctx;
  // Compute subject before entering withTargetSheet since the callback no longer receives targetId.
  let subject: string;
  if (!parsed.targetUserId) {
    subject = `${who}'s`;
  } else if (parsed.targetUserId.startsWith('#')) {
    subject = `**${parsed.targetUserId.slice(1).trim()}**'s`;
  } else {
    const resolvedId = await resolveUserGuid(parsed.targetUserId);
    subject = `${mentionUser(resolvedId, await getNickname(resolvedId).catch(() => "user"))}'s`;
  }
  await withTargetSheet(parsed.targetUserId, async (_sheet, _ft, save) => {
    await save(defaultSheet());
    await reply(`🗑️ ${subject} sheet has been reset to default.`);
  });
}

export async function handleCharSetClass(ctx: HandlerContext, parsed: Extract<ParsedCommand, { kind: "char_set_class" }>): Promise<void> {
  const { who, reply, withTargetSheet } = ctx;
  await withTargetSheet(parsed.targetUserId, async (sheet, ft, save) => {
    sheet.class = parsed.value;
    await save(sheet);
    await reply(`${who} set class to **${parsed.value}**${ft}.`);
  });
}

export async function handleCharSetCaster(ctx: HandlerContext, parsed: Extract<ParsedCommand, { kind: "char_set_caster" }>): Promise<void> {
  const { who, reply, withTargetSheet } = ctx;
  await withTargetSheet(parsed.targetUserId, async (sheet, ft, save) => {
    sheet.casterType = parsed.casterType;
    await save(sheet);
    await reply(`${who} set caster type to **${parsed.casterType}**${ft}.`);
  });
}

export async function handleCharSetSlot(ctx: HandlerContext, parsed: Extract<ParsedCommand, { kind: "char_set_slot" }>): Promise<void> {
  const { who, reply, withTargetSheet } = ctx;
  await withTargetSheet(parsed.targetUserId, async (sheet, ft, save) => {
    if (!sheet.spellSlots) sheet.spellSlots = {};
    // No max-slot guard — intentional DM override to correct slot counts mid-session.
    sheet.spellSlots[String(parsed.level)] = parsed.value;
    await save(sheet);
    await reply(`${who} set level ${parsed.level} spell slots to **${parsed.value}**${ft}.`);
  });
}

export async function handleCharSetMaxSlot(ctx: HandlerContext, parsed: Extract<ParsedCommand, { kind: "char_set_maxslot" }>): Promise<void> {
  const { who, reply, withTargetSheet } = ctx;
  await withTargetSheet(parsed.targetUserId, async (sheet, ft, save) => {
    if (!sheet.maxSpellSlots) sheet.maxSpellSlots = {};
    sheet.maxSpellSlots[String(parsed.level)] = parsed.value;
    if (!sheet.spellSlots) sheet.spellSlots = {};
    if (sheet.spellSlots[String(parsed.level)] === undefined) {
      sheet.spellSlots[String(parsed.level)] = parsed.value;
    }
    await save(sheet);
    await reply(`${who} set level ${parsed.level} max spell slots to **${parsed.value}**${ft}.`);
  });
}

export async function handleCharProfSave(ctx: HandlerContext, parsed: Extract<ParsedCommand, { kind: "char_prof_save" }>): Promise<void> {
  const { who, reply, withTargetSheet } = ctx;
  await withTargetSheet(parsed.targetUserId, async (sheet, ft, save) => {
    if (!sheet.saveProf) sheet.saveProf = {};
    sheet.saveProf[parsed.ability] = parsed.proficient;
    await save(sheet);
    const state = parsed.proficient ? "proficient in" : "no longer proficient in";
    await reply(`${who} is now ${state} **${parsed.ability.toUpperCase()} saves**${ft}.`);
  });
}

export async function handleCharSetTempHP(ctx: HandlerContext, parsed: Extract<ParsedCommand, { kind: "char_set_temphp" }>): Promise<void> {
  const { who, reply, withTargetSheet } = ctx;
  await withTargetSheet(parsed.targetUserId, async (sheet, ft, save) => {
    sheet.tempHp = parsed.value;
    await save(sheet);
    await reply(`${who} set temp HP to **${parsed.value}**${ft}.`);
  });
}

export async function handleCharSetHP(ctx: HandlerContext, parsed: Extract<ParsedCommand, { kind: "char_set_hp" }>): Promise<void> {
  const { who, reply, withTargetSheet } = ctx;
  await withTargetSheet(parsed.targetUserId, async (sheet, ft, save) => {
    sheet.hp = parsed.value;
    await save(sheet);
    await reply(`${who} set HP to **${parsed.value}**${ft}.`);
  });
}

export async function handleCharSetMaxHP(ctx: HandlerContext, parsed: Extract<ParsedCommand, { kind: "char_set_maxhp" }>): Promise<void> {
  const { who, reply, withTargetSheet } = ctx;
  await withTargetSheet(parsed.targetUserId, async (sheet, ft, save) => {
    sheet.maxHp = parsed.value;
    await save(sheet);
    await reply(`${who} set max HP to **${parsed.value}**${ft}.`);
  });
}

export async function handleCharAdjustHP(ctx: HandlerContext, parsed: Extract<ParsedCommand, { kind: "char_adjust_hp" }>): Promise<void> {
  const { who, reply, withTargetSheet } = ctx;
  await withTargetSheet(parsed.targetUserId, async (sheet, ft, save) => {
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
      msg = `${who} took **${-parsed.delta}** damage${ft}.`;
      if (tempConsumed > 0) msg += ` *(${tempConsumed} absorbed by temp HP)*`;
      msg += ` *(HP: ${sheet.hp}${sheet.tempHp ? `, ${sheet.tempHp} temp remaining` : ""})*`;
    } else {
      sheet.hp = (sheet.hp ?? 0) + parsed.delta;
      msg = `${who} healed **${parsed.delta}** HP${ft}. *(now ${sheet.hp})*`;
    }
    await save(sheet);
    await reply(msg);
  });
}

export async function handleCharSetHD(ctx: HandlerContext, parsed: Extract<ParsedCommand, { kind: "char_set_hd" }>): Promise<void> {
  const { who, reply, withTargetSheet } = ctx;
  await withTargetSheet(parsed.targetUserId, async (sheet, ft, save) => {
    sheet.hitDice = parsed.value;
    await save(sheet);
    await reply(`${who} set hit die to **d${parsed.value}**${ft}.`);
  });
}
