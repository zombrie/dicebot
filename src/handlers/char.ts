import type { HandlerContext } from "./context";
import type { ParsedCommand } from "../commands";
import { saveSheet, loadSheet, defaultSheet } from "../sheet";
import { norm } from "../skills";
import { renderSheet } from "../render";
import type { UserGuid } from "@rootsdk/server-bot";

export async function handleCharUse(ctx: HandlerContext, parsed: Extract<ParsedCommand, { kind: "char_use" }>): Promise<void> {
  const { who, reply, withTargetSheet } = ctx;
  await withTargetSheet(parsed.targetUserId, async (sheet, ft, targetId) => {
    sheet.activeForm = parsed.form;
    await saveSheet(targetId, sheet);
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
  await withTargetSheet(parsed.targetUserId, async (sheet, ft, targetId) => {
    sheet.pb = parsed.pb;
    await saveSheet(targetId, sheet);
    await reply(`${who} set proficiency bonus to **${parsed.pb}**${ft}.`);
  });
}

export async function handleCharSetAbility(ctx: HandlerContext, parsed: Extract<ParsedCommand, { kind: "char_set_ability" }>): Promise<void> {
  const { who, reply, withTargetSheet } = ctx;
  if (!Number.isFinite(parsed.score) || parsed.score < 1 || parsed.score > 30) {
    await reply("⚠️ Ability score must be 1–30.");
    return;
  }
  await withTargetSheet(parsed.targetUserId, async (sheet, ft, targetId) => {
    sheet.forms[parsed.form].abilities[parsed.ability] = parsed.score;
    await saveSheet(targetId, sheet);
    const formLabel = sheet.forms[parsed.form].label ?? parsed.form.toUpperCase();
    await reply(`${who} set **${parsed.ability.toUpperCase()}** (${formLabel}) to **${parsed.score}**${ft}.`);
  });
}

export async function handleCharSetAbilities(ctx: HandlerContext, parsed: Extract<ParsedCommand, { kind: "char_set_abilities" }>): Promise<void> {
  const { who, reply, withTargetSheet } = ctx;
  await withTargetSheet(parsed.targetUserId, async (sheet, ft, targetId) => {
    for (const { ability, score } of parsed.pairs) {
      if (!Number.isFinite(score) || score < 1 || score > 30) continue;
      sheet.forms[parsed.form].abilities[ability] = score;
    }
    await saveSheet(targetId, sheet);
    const formLabel = sheet.forms[parsed.form].label ?? parsed.form.toUpperCase();
    const summary = parsed.pairs.map(p => `${p.ability.toUpperCase()} ${p.score}`).join(", ");
    await reply(`${who} updated **${formLabel}** abilities: ${summary}${ft}.`);
  });
}

export async function handleCharProfSkill(ctx: HandlerContext, parsed: Extract<ParsedCommand, { kind: "char_prof_skill" }>): Promise<void> {
  const { who, reply, withTargetSheet } = ctx;
  const key = norm(parsed.skill);
  await withTargetSheet(parsed.targetUserId, async (sheet, ft, targetId) => {
    sheet.skillProf[key] = parsed.level;
    await saveSheet(targetId, sheet);
    const lvl =
      parsed.level === 0 ? "not proficient" :
      parsed.level === 1 ? "proficient" :
      "expertise";
    await reply(`${who} set **${parsed.skill.trim()}** to **${lvl}**${ft}.`);
  });
}

export async function handleSheet(ctx: HandlerContext, parsed: Extract<ParsedCommand, { kind: "sheet" }>): Promise<void> {
  const { evt, reply } = ctx;
  const targetId = (parsed.targetUserId ?? evt.userId) as UserGuid;
  const sheet = await loadSheet(targetId);
  await reply(renderSheet(sheet));
}

export async function handleSheetReset(ctx: HandlerContext, parsed: Extract<ParsedCommand, { kind: "sheet_reset" }>): Promise<void> {
  const { evt, who, reply, getNickname, mentionUser, withTargetSheet } = ctx;
  await withTargetSheet(parsed.targetUserId, async (_sheet, _ft, targetId) => {
    await saveSheet(targetId, defaultSheet());
    const subject = targetId === evt.userId
      ? `${who}'s`
      : `${mentionUser(targetId, await getNickname(targetId).catch(() => "user"))}'s`;
    await reply(`🗑️ ${subject} sheet has been reset to default.`);
  });
}

export async function handleCharSetClass(ctx: HandlerContext, parsed: Extract<ParsedCommand, { kind: "char_set_class" }>): Promise<void> {
  const { who, reply, withTargetSheet } = ctx;
  await withTargetSheet(parsed.targetUserId, async (sheet, ft, targetId) => {
    sheet.class = parsed.value;
    await saveSheet(targetId, sheet);
    await reply(`${who} set class to **${parsed.value}**${ft}.`);
  });
}

export async function handleCharSetCaster(ctx: HandlerContext, parsed: Extract<ParsedCommand, { kind: "char_set_caster" }>): Promise<void> {
  const { who, reply, withTargetSheet } = ctx;
  await withTargetSheet(parsed.targetUserId, async (sheet, ft, targetId) => {
    sheet.casterType = parsed.casterType;
    await saveSheet(targetId, sheet);
    await reply(`${who} set caster type to **${parsed.casterType}**${ft}.`);
  });
}

export async function handleCharSetSlot(ctx: HandlerContext, parsed: Extract<ParsedCommand, { kind: "char_set_slot" }>): Promise<void> {
  const { who, reply, withTargetSheet } = ctx;
  await withTargetSheet(parsed.targetUserId, async (sheet, ft, targetId) => {
    if (!sheet.spellSlots) sheet.spellSlots = {};
    // No max-slot guard — intentional DM override to correct slot counts mid-session.
    sheet.spellSlots[String(parsed.level)] = parsed.value;
    await saveSheet(targetId, sheet);
    await reply(`${who} set level ${parsed.level} spell slots to **${parsed.value}**${ft}.`);
  });
}

export async function handleCharSetMaxSlot(ctx: HandlerContext, parsed: Extract<ParsedCommand, { kind: "char_set_maxslot" }>): Promise<void> {
  const { who, reply, withTargetSheet } = ctx;
  await withTargetSheet(parsed.targetUserId, async (sheet, ft, targetId) => {
    if (!sheet.maxSpellSlots) sheet.maxSpellSlots = {};
    sheet.maxSpellSlots[String(parsed.level)] = parsed.value;
    if (!sheet.spellSlots) sheet.spellSlots = {};
    if (sheet.spellSlots[String(parsed.level)] === undefined) {
      sheet.spellSlots[String(parsed.level)] = parsed.value;
    }
    await saveSheet(targetId, sheet);
    await reply(`${who} set level ${parsed.level} max spell slots to **${parsed.value}**${ft}.`);
  });
}

export async function handleCharProfSave(ctx: HandlerContext, parsed: Extract<ParsedCommand, { kind: "char_prof_save" }>): Promise<void> {
  const { who, reply, withTargetSheet } = ctx;
  await withTargetSheet(parsed.targetUserId, async (sheet, ft, targetId) => {
    if (!sheet.saveProf) sheet.saveProf = {};
    sheet.saveProf[parsed.ability] = parsed.proficient;
    await saveSheet(targetId, sheet);
    const state = parsed.proficient ? "proficient in" : "no longer proficient in";
    await reply(`${who} is now ${state} **${parsed.ability.toUpperCase()} saves**${ft}.`);
  });
}

export async function handleCharSetTempHP(ctx: HandlerContext, parsed: Extract<ParsedCommand, { kind: "char_set_temphp" }>): Promise<void> {
  const { who, reply, withTargetSheet } = ctx;
  await withTargetSheet(parsed.targetUserId, async (sheet, ft, targetId) => {
    sheet.tempHp = parsed.value;
    await saveSheet(targetId, sheet);
    await reply(`${who} set temp HP to **${parsed.value}**${ft}.`);
  });
}

export async function handleCharSetHP(ctx: HandlerContext, parsed: Extract<ParsedCommand, { kind: "char_set_hp" }>): Promise<void> {
  const { who, reply, withTargetSheet } = ctx;
  await withTargetSheet(parsed.targetUserId, async (sheet, ft, targetId) => {
    sheet.hp = parsed.value;
    await saveSheet(targetId, sheet);
    await reply(`${who} set HP to **${parsed.value}**${ft}.`);
  });
}

export async function handleCharSetMaxHP(ctx: HandlerContext, parsed: Extract<ParsedCommand, { kind: "char_set_maxhp" }>): Promise<void> {
  const { who, reply, withTargetSheet } = ctx;
  await withTargetSheet(parsed.targetUserId, async (sheet, ft, targetId) => {
    sheet.maxHp = parsed.value;
    await saveSheet(targetId, sheet);
    await reply(`${who} set max HP to **${parsed.value}**${ft}.`);
  });
}

export async function handleCharAdjustHP(ctx: HandlerContext, parsed: Extract<ParsedCommand, { kind: "char_adjust_hp" }>): Promise<void> {
  const { who, reply, withTargetSheet } = ctx;
  await withTargetSheet(parsed.targetUserId, async (sheet, ft, targetId) => {
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
    await saveSheet(targetId, sheet);
    await reply(msg);
  });
}

export async function handleCharSetHD(ctx: HandlerContext, parsed: Extract<ParsedCommand, { kind: "char_set_hd" }>): Promise<void> {
  const { who, reply, withTargetSheet } = ctx;
  await withTargetSheet(parsed.targetUserId, async (sheet, ft, targetId) => {
    sheet.hitDice = parsed.value;
    await saveSheet(targetId, sheet);
    await reply(`${who} set hit die to **d${parsed.value}**${ft}.`);
  });
}
