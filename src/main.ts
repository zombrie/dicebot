import {
  rootServer,
  ChannelMessageEvent,
  type ChannelMessageCreatedEvent,
  type ChannelMessageCreateRequest,
  type ChannelGuid,
  type UserGuid,
} from "@rootsdk/server-bot";

import { loadSheet, saveSheet, defaultSheet } from "./sheet";
import { computeCheck, norm, expToLevel, pbForLevel, spellSlotsForLevel, rollD20 } from "./skills";
import { rollDice, formatDice } from "./dice";
import { parseTopLevel } from "./commands";
import { renderSheet } from "./render";
import { renderHelp } from "./help";
import { isDM, getDMs, addDM, removeDM, hasAnyDM } from "./dm";
import { getItem, addItem, delItem, listItems, calcInventoryWeight, isMagic } from "./itemlib";
import { addCalEntry, delCalEntries, listCalEntries, formatCalDate } from "./calendar";
import { fetchDDBSheet } from "./ddbimport";
import { lookupSpell, lookupSpellData, getDamageForLevel } from "./spellapi";
import { lookupWeapon, getAttackMod, isRanged } from "./weaponapi";
import { getMembers } from "./party";

async function getNickname(userId: UserGuid): Promise<string> {
  const member = await rootServer.community.communityMembers.get({ userId });
  return member.nickname || "user";
}

function mentionUser(userId: string, nickname: string): string {
  return `[@${nickname}](root://user/${userId})`;
}

async function reply(channelId: ChannelGuid, content: string) {
  const req: ChannelMessageCreateRequest = { channelId, content };
  await rootServer.community.channelMessages.create(req);
}

// Returns true if the sender may act on targetId. Replies with an error if not.
async function canTarget(channelId: ChannelGuid, senderId: string, targetId: string): Promise<boolean> {
  if (targetId === senderId) return true;
  if (await isDM(senderId)) return true;
  await reply(channelId, "⚠️ Only a DM can modify another player's sheet.");
  return false;
}

// Returns " for @mention" when targetId differs from senderId, else "".
async function forTarget(senderId: string, targetId: string): Promise<string> {
  if (targetId === senderId) return "";
  const n = await getNickname(targetId as UserGuid).catch(() => "user");
  return ` for ${mentionUser(targetId, n)}`;
}

async function handleMessage(evt: ChannelMessageCreatedEvent) {
  const parsed = parseTopLevel(evt.messageContent);
  if (!parsed) return;

  let nick = "user";
  try { nick = await getNickname(evt.userId); } catch {}
  const who = mentionUser(evt.userId, nick);

  // ROLL
  if (parsed.kind === "roll") {
    const lines: string[] = [];
    for (const raw of parsed.parts) {
      try {
        const res = rollDice(raw);
        lines.push(formatDice(res));
      } catch (e) {
        const msg = e instanceof Error ? e.message : "Unknown error";
        lines.push(`⚠️ ${msg}`);
      }
    }
    await reply(evt.channelId, `${who} rolled:\n${lines.map(l => `• ${l}`).join("\n")}`);
    return;
  }

  // CHECK
  if (parsed.kind === "check") {
    const sheet = await loadSheet(evt.userId);
    const lines: string[] = [];
    for (const part of parsed.parts) {
      try {
        const out = computeCheck(sheet, part.target, part.form);
        lines.push(`🎲 **${out.title}** → ${out.breakdown}`);
      } catch (e) {
        const msg = e instanceof Error ? e.message : "Unknown error";
        lines.push(`⚠️ ${msg}`);
      }
    }
    await reply(evt.channelId, `${who} rolled:\n${lines.map(l => `• ${l}`).join("\n")}`);
    return;
  }

  // CHAR MGMT
  if (parsed.kind === "char_use") {
    const targetId = (parsed.targetUserId ?? evt.userId) as UserGuid;
    if (!(await canTarget(evt.channelId, evt.userId, targetId))) return;
    const sheet = await loadSheet(targetId);
    sheet.activeForm = parsed.form;
    await saveSheet(targetId, sheet);
    const label = sheet.forms[parsed.form].label ?? parsed.form.toUpperCase();
    const ft = await forTarget(evt.userId, targetId);
    await reply(evt.channelId, `${who} set active stats to **${label}**${ft}.`);
    return;
  }

  if (parsed.kind === "char_set_pb") {
    const pb = parsed.pb;
    if (!Number.isFinite(pb) || pb < 0 || pb > 20) {
      await reply(evt.channelId, `⚠️ PB must be between 0 and 20.`);
      return;
    }
    const targetId = (parsed.targetUserId ?? evt.userId) as UserGuid;
    if (!(await canTarget(evt.channelId, evt.userId, targetId))) return;
    const sheet = await loadSheet(targetId);
    sheet.pb = pb;
    await saveSheet(targetId, sheet);
    const ft = await forTarget(evt.userId, targetId);
    await reply(evt.channelId, `${who} set proficiency bonus to **${pb}**${ft}.`);
    return;
  }

  if (parsed.kind === "char_set_ability") {
    const { ability, form, score } = parsed;
    if (!Number.isFinite(score) || score < 1 || score > 30) {
      await reply(evt.channelId, `⚠️ Ability score must be 1–30.`);
      return;
    }
    const targetId = (parsed.targetUserId ?? evt.userId) as UserGuid;
    if (!(await canTarget(evt.channelId, evt.userId, targetId))) return;
    const sheet = await loadSheet(targetId);
    sheet.forms[form].abilities[ability] = score;
    await saveSheet(targetId, sheet);
    const formLabel = sheet.forms[form].label ?? form.toUpperCase();
    const ft = await forTarget(evt.userId, targetId);
    await reply(evt.channelId, `${who} set **${ability.toUpperCase()}** (${formLabel}) to **${score}**${ft}.`);
    return;
  }

  if (parsed.kind === "char_set_abilities") {
    const { form, pairs } = parsed;
    const targetId = (parsed.targetUserId ?? evt.userId) as UserGuid;
    if (!(await canTarget(evt.channelId, evt.userId, targetId))) return;
    const sheet = await loadSheet(targetId);
    for (const { ability, score } of pairs) {
      if (!Number.isFinite(score) || score < 1 || score > 30) continue;
      sheet.forms[form].abilities[ability] = score;
    }
    await saveSheet(targetId, sheet);
    const formLabel = sheet.forms[form].label ?? form.toUpperCase();
    const summary = pairs.map(p => `${p.ability.toUpperCase()} ${p.score}`).join(", ");
    const ft = await forTarget(evt.userId, targetId);
    await reply(evt.channelId, `${who} updated **${formLabel}** abilities: ${summary}${ft}.`);
    return;
  }

  if (parsed.kind === "char_prof_skill") {
    const key = norm(parsed.skill);
    const targetId = (parsed.targetUserId ?? evt.userId) as UserGuid;
    if (!(await canTarget(evt.channelId, evt.userId, targetId))) return;
    const sheet = await loadSheet(targetId);
    sheet.skillProf[key] = parsed.level;
    await saveSheet(targetId, sheet);
    const lvl =
      parsed.level === 0 ? "not proficient" :
      parsed.level === 1 ? "proficient" :
      "expertise";
    const ft = await forTarget(evt.userId, targetId);
    await reply(evt.channelId, `${who} set **${parsed.skill.trim()}** to **${lvl}**${ft}.`);
    return;
  }

  // SHEET
  if (parsed.kind === "sheet") {
    const targetId = (parsed.targetUserId ?? evt.userId) as UserGuid;
    const sheet = await loadSheet(targetId);
    await reply(evt.channelId, renderSheet(sheet));
    return;
  }

  if (parsed.kind === "sheet_reset") {
    const targetId = (parsed.targetUserId ?? evt.userId) as UserGuid;
    if (!(await canTarget(evt.channelId, evt.userId, targetId))) return;
    await saveSheet(targetId, defaultSheet());
    const isSelf = targetId === evt.userId;
    const subject = isSelf
      ? `${who}'s`
      : `${mentionUser(targetId, await getNickname(targetId as UserGuid).catch(() => "user"))}'s`;
    await reply(evt.channelId, `🗑️ ${subject} sheet has been reset to default.`);
    return;
  }

  // DM MANAGEMENT
  if (parsed.kind === "dm_claim") {
    if (await hasAnyDM()) {
      await reply(evt.channelId, "⚠️ DMs already exist. Ask a DM to add you with `!dm add @you`.");
      return;
    }
    await addDM(evt.userId);
    await reply(evt.channelId, `${who} is now the DM! 🎲`);
    return;
  }

  if (parsed.kind === "dm_add") {
    if (!(await isDM(evt.userId))) {
      await reply(evt.channelId, "⚠️ Only a DM can add other DMs.");
      return;
    }
    await addDM(parsed.targetUserId);
    const n = await getNickname(parsed.targetUserId as UserGuid).catch(() => "user");
    await reply(evt.channelId, `${mentionUser(parsed.targetUserId, n)} is now a DM.`);
    return;
  }

  if (parsed.kind === "dm_remove") {
    if (!(await isDM(evt.userId))) {
      await reply(evt.channelId, "⚠️ Only a DM can remove DMs.");
      return;
    }
    await removeDM(parsed.targetUserId);
    const n = await getNickname(parsed.targetUserId as UserGuid).catch(() => "user");
    await reply(evt.channelId, `${mentionUser(parsed.targetUserId, n)} is no longer a DM.`);
    return;
  }

  if (parsed.kind === "dm_list") {
    const dmIds = await getDMs();
    if (dmIds.length === 0) {
      await reply(evt.channelId, "No DMs set. Use `!dm claim` to become the DM.");
      return;
    }
    const mentions = await Promise.all(
      dmIds.map(async id => {
        const n = await getNickname(id as UserGuid).catch(() => id);
        return mentionUser(id, n);
      })
    );
    await reply(evt.channelId, `**DMs:** ${mentions.join(", ")}`);
    return;
  }

  // INVENTORY
  if (parsed.kind === "inv_show") {
    const targetId = (parsed.targetUserId ?? evt.userId) as UserGuid;
    const sheet = await loadSheet(targetId);
    const label = targetId === evt.userId
      ? `${who}'s`
      : `${mentionUser(targetId, await getNickname(targetId).catch(() => "user"))}'s`;

    const invEntries = Object.entries(sheet.inventory);
    if (invEntries.length === 0) {
      await reply(evt.channelId, `${label} inventory is empty.`);
    } else {
      const { used, lib } = await calcInventoryWeight(sheet.inventory);
      const strScore = sheet.forms[sheet.activeForm].abilities.str;
      const capacity = strScore * 15;
      const weightStr = used > 0 ? ` (${used.toFixed(1)} / ${capacity} lbs)` : "";
      const lines = [`${label} inventory${weightStr}:`];
      invEntries.forEach(([item, qty], i) => {
        const entry = lib[item] ?? Object.entries(lib).find(([k]) => k.toLowerCase() === item.toLowerCase())?.[1];
        const weightPart = entry ? ` — ${(entry.weight * qty).toFixed(1)} lb` : "";
        const magicTag = entry && isMagic(entry) ? " ✨" : "";
        lines.push(`${i + 1}. **${item}**${magicTag}${qty !== 1 ? ` × ${qty}` : ""}${weightPart}`);
      });
      await reply(evt.channelId, lines.join("\n"));
    }
    return;
  }

  if (parsed.kind === "inv_add") {
    const targetId = (parsed.targetUserId ?? evt.userId) as UserGuid;
    if (!(await canTarget(evt.channelId, evt.userId, targetId))) return;
    const sheet = await loadSheet(targetId);

    // Weight check: sum total added weight for all library-known items
    const strScore = sheet.forms[sheet.activeForm].abilities.str;
    const capacity = strScore * 15;
    const { used } = await calcInventoryWeight(sheet.inventory);
    let addedWeight = 0;
    for (const { item, qty } of parsed.items) {
      const libEntry = await getItem(item);
      if (libEntry) addedWeight += libEntry.weight * qty;
    }
    if (addedWeight > 0 && used + addedWeight > capacity) {
      await reply(evt.channelId,
        `⚠️ That would exceed carrying capacity! (${used.toFixed(1)} + ${addedWeight.toFixed(1)} > ${capacity} lbs)`
      );
      return;
    }

    const summary: string[] = [];
    for (const { item, qty } of parsed.items) {
      const existingKey = Object.keys(sheet.inventory).find(k => k.toLowerCase() === item.toLowerCase());
      const key = existingKey ?? item;
      sheet.inventory[key] = (sheet.inventory[key] ?? 0) + qty;
      summary.push(`**${item}**${qty !== 1 ? ` ×${qty}` : ""}`);
    }
    await saveSheet(targetId, sheet);
    const ft = await forTarget(evt.userId, targetId);

    if (summary.length === 1) {
      await reply(evt.channelId, `${who} added ${summary[0]} to inventory${ft}.`);
    } else {
      await reply(evt.channelId, `${who} added ${summary.length} items to inventory${ft}: ${summary.join(", ")}.`);
    }
    return;
  }

  if (parsed.kind === "inv_remove") {
    const targetId = (parsed.targetUserId ?? evt.userId) as UserGuid;
    if (!(await canTarget(evt.channelId, evt.userId, targetId))) return;
    const sheet = await loadSheet(targetId);
    const key = Object.keys(sheet.inventory).find(k => k.toLowerCase() === parsed.item.toLowerCase());
    if (!key) {
      await reply(evt.channelId, `⚠️ **${parsed.item}** not found in inventory.`);
      return;
    }
    const qty = parsed.qty;
    if (sheet.inventory[key] <= qty) {
      delete sheet.inventory[key];
    } else {
      sheet.inventory[key] -= qty;
    }
    await saveSheet(targetId, sheet);
    const ft = await forTarget(evt.userId, targetId);
    const qtyStr = qty !== 1 ? ` ×${qty}` : "";
    await reply(evt.channelId, `${who} removed **${parsed.item}**${qtyStr} from inventory${ft}.`);
    return;
  }

  if (parsed.kind === "inv_clear") {
    const targetId = (parsed.targetUserId ?? evt.userId) as UserGuid;
    if (!(await canTarget(evt.channelId, evt.userId, targetId))) return;
    const sheet = await loadSheet(targetId);
    sheet.inventory = {};
    await saveSheet(targetId, sheet);
    const ft = await forTarget(evt.userId, targetId);
    await reply(evt.channelId, `${who} cleared inventory${ft}.`);
    return;
  }

  // ITEM LIBRARY
  if (parsed.kind === "lib_add") {
    if (!(await isDM(evt.userId))) {
      await reply(evt.channelId, "⚠️ Only a DM can modify the item library.");
      return;
    }
    for (const { name, weight, price, color, description } of parsed.items) {
      await addItem(name, { weight, price, color, description });
    }
    if (parsed.items.length === 1) {
      const { name, weight, price, color } = parsed.items[0];
      const magicTag = color !== 37 ? " ✨" : "";
      await reply(evt.channelId, `📦 **${name}**${magicTag} added to library (${weight} lbs, ${price} gp, color ${color}).`);
    } else {
      const summary = parsed.items.map(({ name, color }) => `**${name}**${color !== 37 ? " ✨" : ""}`).join(", ");
      await reply(evt.channelId, `📦 Added ${parsed.items.length} items to library: ${summary}.`);
    }
    return;
  }

  if (parsed.kind === "lib_del") {
    if (!(await isDM(evt.userId))) {
      await reply(evt.channelId, "⚠️ Only a DM can modify the item library.");
      return;
    }
    const removed = await delItem(parsed.name);
    if (!removed) {
      await reply(evt.channelId, `⚠️ **${parsed.name}** not found in library.`);
      return;
    }
    await reply(evt.channelId, `🗑️ **${parsed.name}** removed from library.`);
    return;
  }

  if (parsed.kind === "lib_check") {
    const entry = await getItem(parsed.name);
    if (!entry) {
      await reply(evt.channelId, `⚠️ **${parsed.name}** not found in library.`);
      return;
    }
    const magicTag = isMagic(entry) ? " ✨" : "";
    let msg = `📦 **${parsed.name}**${magicTag}\nWeight: ${entry.weight} lbs | Price: ${entry.price} gp | Color: ${entry.color ?? 37}`;
    if (entry.description) msg += `\n${entry.description}`;
    await reply(evt.channelId, msg);
    return;
  }

  if (parsed.kind === "lib_list") {
    const entries = await listItems(parsed.filter);
    if (entries.length === 0) {
      const filterNote = parsed.filter ? ` matching "${parsed.filter}"` : "";
      await reply(evt.channelId, `Library is empty${filterNote}.`);
      return;
    }
    const lines = [`📚 **Item Library${parsed.filter ? ` — "${parsed.filter}"` : ""}:**`];
    for (const [name, entry] of entries) {
      const magicTag = isMagic(entry) ? " ✨" : "";
      lines.push(`• **${name}**${magicTag} — ${entry.weight} lbs, ${entry.price} gp`);
    }
    await reply(evt.channelId, lines.join("\n"));
    return;
  }

  // HP
  if (parsed.kind === "char_set_class") {
    const targetId = (parsed.targetUserId ?? evt.userId) as UserGuid;
    if (!(await canTarget(evt.channelId, evt.userId, targetId))) return;
    const sheet = await loadSheet(targetId);
    sheet.class = parsed.value;
    await saveSheet(targetId, sheet);
    const ft = await forTarget(evt.userId, targetId);
    await reply(evt.channelId, `${who} set class to **${parsed.value}**${ft}.`);
    return;
  }

  if (parsed.kind === "char_set_caster") {
    const targetId = (parsed.targetUserId ?? evt.userId) as UserGuid;
    if (!(await canTarget(evt.channelId, evt.userId, targetId))) return;
    const sheet = await loadSheet(targetId);
    sheet.casterType = parsed.casterType;
    await saveSheet(targetId, sheet);
    const ft = await forTarget(evt.userId, targetId);
    await reply(evt.channelId, `${who} set caster type to **${parsed.casterType}**${ft}.`);
    return;
  }

  if (parsed.kind === "char_set_slot") {
    const targetId = (parsed.targetUserId ?? evt.userId) as UserGuid;
    if (!(await canTarget(evt.channelId, evt.userId, targetId))) return;
    const sheet = await loadSheet(targetId);
    if (!sheet.spellSlots) sheet.spellSlots = {};
    sheet.spellSlots[String(parsed.level)] = parsed.value;
    await saveSheet(targetId, sheet);
    const ft = await forTarget(evt.userId, targetId);
    await reply(evt.channelId, `${who} set level ${parsed.level} spell slots to **${parsed.value}**${ft}.`);
    return;
  }

  if (parsed.kind === "char_set_maxslot") {
    const targetId = (parsed.targetUserId ?? evt.userId) as UserGuid;
    if (!(await canTarget(evt.channelId, evt.userId, targetId))) return;
    const sheet = await loadSheet(targetId);
    if (!sheet.maxSpellSlots) sheet.maxSpellSlots = {};
    sheet.maxSpellSlots[String(parsed.level)] = parsed.value;
    if (!sheet.spellSlots) sheet.spellSlots = {};
    if (sheet.spellSlots[String(parsed.level)] === undefined) {
      sheet.spellSlots[String(parsed.level)] = parsed.value;
    }
    await saveSheet(targetId, sheet);
    const ft = await forTarget(evt.userId, targetId);
    await reply(evt.channelId, `${who} set level ${parsed.level} max spell slots to **${parsed.value}**${ft}.`);
    return;
  }

  if (parsed.kind === "char_prof_save") {
    const targetId = (parsed.targetUserId ?? evt.userId) as UserGuid;
    if (!(await canTarget(evt.channelId, evt.userId, targetId))) return;
    const sheet = await loadSheet(targetId);
    if (!sheet.saveProf) sheet.saveProf = {};
    sheet.saveProf[parsed.ability] = parsed.proficient;
    await saveSheet(targetId, sheet);
    const ft = await forTarget(evt.userId, targetId);
    const state = parsed.proficient ? "proficient in" : "no longer proficient in";
    await reply(evt.channelId, `${who} is now ${state} **${parsed.ability.toUpperCase()} saves**${ft}.`);
    return;
  }

  if (parsed.kind === "char_set_temphp") {
    const targetId = (parsed.targetUserId ?? evt.userId) as UserGuid;
    if (!(await canTarget(evt.channelId, evt.userId, targetId))) return;
    const sheet = await loadSheet(targetId);
    sheet.tempHp = parsed.value;
    await saveSheet(targetId, sheet);
    const ft = await forTarget(evt.userId, targetId);
    await reply(evt.channelId, `${who} set temp HP to **${parsed.value}**${ft}.`);
    return;
  }

  if (parsed.kind === "char_set_hp") {
    const targetId = (parsed.targetUserId ?? evt.userId) as UserGuid;
    if (!(await canTarget(evt.channelId, evt.userId, targetId))) return;
    const sheet = await loadSheet(targetId);
    sheet.hp = parsed.value;
    await saveSheet(targetId, sheet);
    const ft = await forTarget(evt.userId, targetId);
    await reply(evt.channelId, `${who} set HP to **${parsed.value}**${ft}.`);
    return;
  }

  if (parsed.kind === "char_set_maxhp") {
    const targetId = (parsed.targetUserId ?? evt.userId) as UserGuid;
    if (!(await canTarget(evt.channelId, evt.userId, targetId))) return;
    const sheet = await loadSheet(targetId);
    sheet.maxHp = parsed.value;
    await saveSheet(targetId, sheet);
    const ft = await forTarget(evt.userId, targetId);
    await reply(evt.channelId, `${who} set max HP to **${parsed.value}**${ft}.`);
    return;
  }

  if (parsed.kind === "char_adjust_hp") {
    const targetId = (parsed.targetUserId ?? evt.userId) as UserGuid;
    if (!(await canTarget(evt.channelId, evt.userId, targetId))) return;
    const sheet = await loadSheet(targetId);
    const ft = await forTarget(evt.userId, targetId);

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
    await reply(evt.channelId, msg);
    return;
  }

  if (parsed.kind === "char_set_hd") {
    const targetId = (parsed.targetUserId ?? evt.userId) as UserGuid;
    if (!(await canTarget(evt.channelId, evt.userId, targetId))) return;
    const sheet = await loadSheet(targetId);
    sheet.hitDice = parsed.value;
    await saveSheet(targetId, sheet);
    const ft = await forTarget(evt.userId, targetId);
    await reply(evt.channelId, `${who} set hit die to **d${parsed.value}**${ft}.`);
    return;
  }

  // EXP
  if (parsed.kind === "exp_add") {
    const targetId = (parsed.targetUserId ?? evt.userId) as UserGuid;
    if (!(await canTarget(evt.channelId, evt.userId, targetId))) return;
    const sheet = await loadSheet(targetId);

    const oldExp = sheet.exp ?? 0;
    const oldLevel = expToLevel(oldExp);
    sheet.exp = Math.max(0, oldExp + parsed.amount);
    const newLevel = expToLevel(sheet.exp);

    const isSelf = targetId === evt.userId;
    const targetMention = isSelf ? who : mentionUser(targetId, await getNickname(targetId as UserGuid).catch(() => "user"));

    let msg: string;
    if (parsed.amount > 0) {
      msg = `✨ ${targetMention} earned **${parsed.amount}** exp! *(${sheet.exp} total)*`;
    } else if (parsed.amount < 0) {
      msg = `${targetMention} lost **${-parsed.amount}** exp. *(${sheet.exp} total)*`;
    } else {
      msg = `${targetMention}'s exp is unchanged. *(${sheet.exp} total)*`;
    }

    if (newLevel !== oldLevel) {
      const details: string[] = [];

      // PB
      const oldPb = sheet.pb;
      sheet.pb = pbForLevel(newLevel);
      if (sheet.pb !== oldPb) details.push(`PB now +${sheet.pb}`);

      // HP (only if hit die is configured)
      if (sheet.hitDice !== undefined) {
        const conMod = Math.floor((sheet.forms[sheet.activeForm].abilities.con - 10) / 2);
        const hpChange = (sheet.hitDice + conMod) * (newLevel - oldLevel);
        sheet.maxHp = (sheet.maxHp ?? 0) + hpChange;
        sheet.hp = (sheet.hp ?? 0) + hpChange;
        details.push(`${hpChange > 0 ? "+" : ""}${hpChange} max HP`);
      }

      // Spell slots (only if caster type is configured)
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
          if (newMax === 0) {
            delete sheet.spellSlots[key];
          } else {
            sheet.spellSlots[key] = Math.max(0, Math.min(newMax, cur + (newMax - oldMax)));
          }
        }
        details.push("spell slots updated");
      }

      const detailStr = details.length ? ` *(${details.join(", ")})*` : "";
      if (newLevel > oldLevel) {
        msg += `\n🎉 **Level up! Reached level ${newLevel}!**${detailStr}`;
      } else {
        msg += `\n📉 Dropped to level ${newLevel}.${detailStr}`;
      }
    }

    await saveSheet(targetId, sheet);
    await reply(evt.channelId, msg);
    return;
  }

  // WEAPON ATTACK
  if (parsed.kind === "attack") {
    const sheet = await loadSheet(evt.userId as UserGuid);

    // Check inventory
    const inventoryKey = Object.keys(sheet.inventory).find(
      k => k.toLowerCase() === parsed.weapon.toLowerCase()
    );
    if (!inventoryKey) {
      await reply(evt.channelId, `⚠️ **${parsed.weapon}** is not in your inventory.`);
      return;
    }

    // Look up weapon stats
    let weapon;
    try {
      weapon = await lookupWeapon(inventoryKey);
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Unknown error";
      await reply(evt.channelId, `⚠️ ${msg}`);
      return;
    }

    // Ability modifier and attack bonus
    const { ability, mod } = getAttackMod(weapon, sheet);
    const pb = sheet.pb;
    const modStr = mod >= 0 ? `+${mod}` : `${mod}`;

    // Roll d20 (with advantage / disadvantage)
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

    // Roll damage
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

    await reply(evt.channelId, [
      `⚔️ ${who} attacks with **${displayName}**${rangeNote}!`,
      `Attack: ${d20Display}${modStr} ${ability.toUpperCase()} + PB(${pb}) = **${atkTotal}**`,
      `Damage: ${dmgLine}`,
    ].join("\n"));
    return;
  }

  // KNOWN SPELLS MANAGEMENT
  if (parsed.kind === "spells_show") {
    const sheet = await loadSheet(evt.userId as UserGuid);
    const spells = sheet.knownSpells;
    if (!spells || spells.length === 0) {
      await reply(evt.channelId,
        `📖 ${who} has no known spells set. Import from D&D Beyond with \`!import\`, or add with \`!spells add <name>\`.`
      );
    } else {
      const sorted = [...spells].sort();
      await reply(evt.channelId, `📖 **${who}'s known spells (${spells.length}):**\n${sorted.join(", ")}`);
    }
    return;
  }

  if (parsed.kind === "spells_add") {
    const sheet = await loadSheet(evt.userId as UserGuid);
    if (!sheet.knownSpells) sheet.knownSpells = [];
    if (!sheet.knownSpells.includes(parsed.spell)) {
      sheet.knownSpells.push(parsed.spell);
      sheet.knownSpells.sort();
    }
    await saveSheet(evt.userId as UserGuid, sheet);
    await reply(evt.channelId, `📖 **${parsed.spell}** added to ${who}'s known spells.`);
    return;
  }

  if (parsed.kind === "spells_remove") {
    const sheet = await loadSheet(evt.userId as UserGuid);
    const idx = sheet.knownSpells?.indexOf(parsed.spell) ?? -1;
    if (idx === -1) {
      await reply(evt.channelId, `⚠️ **${parsed.spell}** not found in your known spells.`);
      return;
    }
    sheet.knownSpells!.splice(idx, 1);
    await saveSheet(evt.userId as UserGuid, sheet);
    await reply(evt.channelId, `📖 **${parsed.spell}** removed from ${who}'s known spells.`);
    return;
  }

  if (parsed.kind === "spells_clear") {
    const sheet = await loadSheet(evt.userId as UserGuid);
    sheet.knownSpells = [];
    await saveSheet(evt.userId as UserGuid, sheet);
    await reply(evt.channelId, `📖 ${who}'s known spells list cleared.`);
    return;
  }

  // SPELL LOOKUP
  if (parsed.kind === "spell_lookup") {
    let result: string;
    try {
      result = await lookupSpell(parsed.name);
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Unknown error";
      await reply(evt.channelId, `⚠️ ${msg}`);
      return;
    }
    await reply(evt.channelId, result);
    return;
  }

  // RESTS & CASTING
  if (parsed.kind === "rest_long") {
    const targetId = (parsed.targetUserId ?? evt.userId) as UserGuid;
    if (!(await canTarget(evt.channelId, evt.userId, targetId))) return;
    const sheet = await loadSheet(targetId);
    const ft = await forTarget(evt.userId, targetId);
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
    await reply(evt.channelId, lines.join("\n"));
    return;
  }

  if (parsed.kind === "rest_short") {
    const targetId = (parsed.targetUserId ?? evt.userId) as UserGuid;
    if (!(await canTarget(evt.channelId, evt.userId, targetId))) return;
    const sheet = await loadSheet(targetId);
    const ft = await forTarget(evt.userId, targetId);

    if (!sheet.hitDice) {
      await reply(evt.channelId, "⚠️ Set your hit die first: `!char set hd 8`");
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
    await reply(evt.channelId,
      `🌙 Short rest${ft}! Rolled ${rollStr}${conStr} = **+${recovered} HP** *(${sheet.hp}${sheet.maxHp !== undefined ? `/${sheet.maxHp}` : ""})*`
    );
    return;
  }

  if (parsed.kind === "cast") {
    const sheet = await loadSheet(evt.userId as UserGuid);
    const key = String(parsed.level);
    const cur = sheet.spellSlots?.[key] ?? 0;
    if (cur <= 0) {
      await reply(evt.channelId, `⚠️ No level ${parsed.level} spell slots remaining!`);
      return;
    }
    if (!sheet.spellSlots) sheet.spellSlots = {};
    sheet.spellSlots[key] = cur - 1;
    await saveSheet(evt.userId as UserGuid, sheet);
    const remaining = sheet.spellSlots[key];
    await reply(evt.channelId,
      `🪄 ${who} expended a level ${parsed.level} slot. *(${remaining} slot${remaining !== 1 ? "s" : ""} remaining)*`
    );
    return;
  }

  if (parsed.kind === "spell_cast") {
    const sheet = await loadSheet(evt.userId as UserGuid);

    // Look up the spell
    let spell;
    try {
      spell = await lookupSpellData(parsed.spell);
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Unknown error";
      await reply(evt.channelId, `⚠️ ${msg}`);
      return;
    }

    // Enforce known spells list if populated
    if (sheet.knownSpells && sheet.knownSpells.length > 0) {
      const spellLower = parsed.spell.toLowerCase();
      const resolvedLower = spell.name.toLowerCase();
      const isKnown = sheet.knownSpells.some(s => s === spellLower || s === resolvedLower);
      if (!isKnown) {
        await reply(evt.channelId,
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
      await reply(evt.channelId, `⚠️ **${spell.name}** requires at least a level ${minLevel} slot.`);
      return;
    }

    // Deduct slot (cantrips free) — sheet already loaded above
    if (!isCantrip) {
      const key = String(slotLevel);
      const cur = sheet.spellSlots?.[key] ?? 0;
      if (cur <= 0) {
        await reply(evt.channelId, `⚠️ No level ${slotLevel} spell slots remaining!`);
        return;
      }
      if (!sheet.spellSlots) sheet.spellSlots = {};
      sheet.spellSlots[key] = cur - 1;
      await saveSheet(evt.userId as UserGuid, sheet);
    }

    // Build output
    const schoolName = typeof spell.school === "object" ? spell.school.name : spell.school;
    const levelStr = isCantrip ? `${schoolName} cantrip *(no slot used)*`
      : slotLevel === minLevel ? `level ${slotLevel} ${schoolName}`
      : `${schoolName} upcast to level ${slotLevel}`;
    const lines = [`🪄 ${who} cast **${spell.name}** — ${levelStr}!`];

    // Damage
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

    // Save / attack note
    if (spell.saving_throw_ability) {
      lines.push(`*Targets make a ${spell.saving_throw_ability.toUpperCase()} save.*`);
    }

    // Remaining slots
    if (!isCantrip) {
      const remaining = sheet.spellSlots?.[String(slotLevel)] ?? 0;
      lines.push(`*(${remaining} level ${slotLevel} slot${remaining !== 1 ? "s" : ""} remaining)*`);
    }

    await reply(evt.channelId, lines.join("\n"));
    return;
  }

  // CALENDAR
  if (parsed.kind === "cal_show") {
    const entries = await listCalEntries();
    if (entries.length === 0) {
      await reply(evt.channelId, "📅 The calendar is empty.");
      return;
    }
    const lines = ["📅 **Calendar**", ""];
    for (const e of entries) {
      lines.push(`**${formatCalDate(e.date)}:** ${e.event}`);
    }
    await reply(evt.channelId, lines.join("\n"));
    return;
  }

  if (parsed.kind === "cal_add") {
    if (!(await isDM(evt.userId))) {
      await reply(evt.channelId, "⚠️ Only a DM can add calendar events.");
      return;
    }
    await addCalEntry(parsed.date, parsed.event);
    await reply(evt.channelId, `📅 Added: **${formatCalDate(parsed.date)}** — ${parsed.event}`);
    return;
  }

  if (parsed.kind === "cal_del") {
    if (!(await isDM(evt.userId))) {
      await reply(evt.channelId, "⚠️ Only a DM can remove calendar events.");
      return;
    }
    const removed = await delCalEntries(parsed.date);
    if (removed === 0) {
      await reply(evt.channelId, `⚠️ No events found on **${formatCalDate(parsed.date)}**.`);
      return;
    }
    await reply(evt.channelId, `🗑️ Removed ${removed} event${removed !== 1 ? "s" : ""} on **${formatCalDate(parsed.date)}**.`);
    return;
  }

  // EXP LEADERBOARD
  if (parsed.kind === "exp_rank") {
    const memberIds = await getMembers();
    if (memberIds.length === 0) {
      await reply(evt.channelId, "No party members yet — sheets register automatically when first saved.");
      return;
    }
    const entries = await Promise.all(
      memberIds.map(async id => {
        const sheet = await loadSheet(id as UserGuid);
        const name = await getNickname(id as UserGuid).catch(() => id);
        return { id, name, exp: sheet.exp ?? 0, hasExp: sheet.exp !== undefined };
      })
    );
    entries.sort((a, b) => b.exp - a.exp);
    const lines = ["📊 **Experience Rankings**", ""];
    entries.forEach((e, i) => {
      if (e.hasExp) {
        lines.push(`${i + 1}. **${e.name}** — Level ${expToLevel(e.exp)}, ${e.exp} EXP`);
      } else {
        lines.push(`${i + 1}. **${e.name}** — no exp tracked`);
      }
    });
    await reply(evt.channelId, lines.join("\n"));
    return;
  }

  // D&D BEYOND IMPORT
  if (parsed.kind === "ddb_import") {
    const targetId = (parsed.targetUserId ?? evt.userId) as UserGuid;
    if (!(await canTarget(evt.channelId, evt.userId, targetId))) return;

    await reply(evt.channelId, `⏳ Fetching character from D&D Beyond…`);

    let imported;
    try {
      imported = await fetchDDBSheet(parsed.characterId);
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Unknown error";
      await reply(evt.channelId, `⚠️ Import failed: ${msg}`);
      return;
    }

    // Merge: overwrite mechanical fields, preserve irl form and inventory.
    // Always switch to ingame — that's what we just imported.
    const existing = await loadSheet(targetId);
    const merged = {
      ...imported,
      forms: { irl: existing.forms.irl, ingame: imported.forms.ingame },
      inventory: existing.inventory,
    };

    await saveSheet(targetId, merged);
    const ft = await forTarget(evt.userId, targetId);

    const slotSummary = imported.maxSpellSlots && Object.keys(imported.maxSpellSlots).length > 0
      ? `\nSpell slots: ${Object.entries(imported.maxSpellSlots).map(([l, n]) => `L${l}: ${n}`).join(", ")}`
      : "";
    const skillCount = Object.values(imported.skillProf).filter(v => v > 0).length;
    const saveCount = Object.values(imported.saveProf ?? {}).filter(Boolean).length;

    await reply(evt.channelId, [
      `✅ Imported **${imported.name}** (${imported.class}, Level ${expToLevel(imported.exp ?? 0)})${ft}!`,
      `HP: ${imported.hp}/${imported.maxHp} | PB: +${imported.pb} | Hit die: d${imported.hitDice}`,
      `${skillCount} skill prof${skillCount !== 1 ? "s" : ""}, ${saveCount} save prof${saveCount !== 1 ? "s" : ""}${slotSummary}`,
      `Run \`!sheet\` to see the full character.`,
    ].join("\n"));
    return;
  }

  // HELP
  if (parsed.kind === "help") {
    await reply(evt.channelId, renderHelp(parsed.topic));
    return;
  }
}

(async () => {
  rootServer.community.channelMessages.on(ChannelMessageEvent.ChannelMessageCreated, handleMessage);
  await rootServer.lifecycle.start();
})();
