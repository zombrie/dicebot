// Handlers for !exp (award/deduct XP with auto level-up) and !exprank (party leaderboard).
import type { HandlerContext } from "./context";
import type { ParsedCommand } from "../commands";
import { loadSheet } from "../sheet";
import { npcName } from "./context";
import { expToLevel, pbForLevel, spellSlotsForLevel } from "../skills";
import { getMembers } from "../party";
import { listNPCs, loadNPCSheet } from "../npclib";
import type { UserGuid } from "@rootsdk/server-bot";

export async function handleExpAdd(ctx: HandlerContext, parsed: Extract<ParsedCommand, { kind: "exp_add" }>): Promise<void> {
  const { evt, who, reply, getNickname, mentionUser, withTargetSheet } = ctx;
  // Compute the display name before entering withTargetSheet (callback no longer receives targetId).
  let targetMention: string;
  if (!parsed.targetUserId) {
    targetMention = who;
  } else if (parsed.targetUserId.startsWith('#')) {
    targetMention = npcName(parsed.targetUserId)!;
  } else {
    const { resolveUserGuid } = await import("./context");
    const resolvedId = await resolveUserGuid(parsed.targetUserId);
    targetMention = mentionUser(resolvedId, await getNickname(resolvedId).catch(() => "user"));
  }
  await withTargetSheet(parsed.targetUserId, async (sheet, _ft, save) => {
    const oldExp = sheet.exp ?? 0;
    const oldLevel = expToLevel(oldExp);
    sheet.exp = Math.max(0, oldExp + parsed.amount);
    const newLevel = expToLevel(sheet.exp);

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

    await save(sheet);
    await reply(msg);
  });
}

export async function handleExpRank(ctx: HandlerContext, _parsed: Extract<ParsedCommand, { kind: "exp_rank" }>): Promise<void> {
  const { reply, getNickname } = ctx;
  const [memberIds, npcNames] = await Promise.all([getMembers(), listNPCs()]);

  const playerEntries = await Promise.all(
    memberIds.map(async id => {
      const sheet = await loadSheet(id as UserGuid);
      const name = sheet.name || await getNickname(id as UserGuid).catch(() => id);
      return { name, exp: sheet.exp ?? 0, hasExp: sheet.exp !== undefined };
    })
  );

  const npcEntries = await Promise.all(
    npcNames.map(async name => {
      const sheet = await loadNPCSheet(name);
      return { name, exp: sheet.exp ?? 0, hasExp: sheet.exp !== undefined };
    })
  );

  const entries = [...playerEntries, ...npcEntries].filter(e => e.hasExp);
  if (entries.length === 0) {
    await reply("No party members yet — sheets register automatically when first saved.");
    return;
  }
  entries.sort((a, b) => b.exp - a.exp);
  const lines = ["📊 **Experience Rankings**", ""];
  entries.forEach((e, i) => {
    lines.push(e.hasExp
      ? `${i + 1}. **${e.name}** — Level ${expToLevel(e.exp)}, ${e.exp} EXP`
      : `${i + 1}. **${e.name}** — no exp tracked`
    );
  });
  await reply(lines.join("\n"));
}
