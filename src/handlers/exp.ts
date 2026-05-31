import type { HandlerContext } from "./context";
import type { ParsedCommand } from "../commands";
import { saveSheet, loadSheet } from "../sheet";
import { expToLevel, pbForLevel, spellSlotsForLevel } from "../skills";
import { getMembers } from "../party";
import type { UserGuid } from "@rootsdk/server-bot";

export async function handleExpAdd(ctx: HandlerContext, parsed: Extract<ParsedCommand, { kind: "exp_add" }>): Promise<void> {
  const { evt, who, reply, getNickname, mentionUser, withTargetSheet } = ctx;
  await withTargetSheet(parsed.targetUserId, async (sheet, _ft, targetId) => {
    const oldExp = sheet.exp ?? 0;
    const oldLevel = expToLevel(oldExp);
    sheet.exp = Math.max(0, oldExp + parsed.amount);
    const newLevel = expToLevel(sheet.exp);

    const isSelf = targetId === evt.userId;
    const targetMention = isSelf
      ? who
      : mentionUser(targetId, await getNickname(targetId).catch(() => "user"));

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

    await saveSheet(targetId, sheet);
    await reply(msg);
  });
}

export async function handleExpRank(ctx: HandlerContext, _parsed: Extract<ParsedCommand, { kind: "exp_rank" }>): Promise<void> {
  const { reply, getNickname } = ctx;
  const memberIds = await getMembers();
  if (memberIds.length === 0) {
    await reply("No party members yet — sheets register automatically when first saved.");
    return;
  }
  const entries = await Promise.all(
    memberIds.map(async id => {
      const sheet = await loadSheet(id as UserGuid);
      const name = await getNickname(id as UserGuid).catch(() => id);
      return { name, exp: sheet.exp ?? 0, hasExp: sheet.exp !== undefined };
    })
  );
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
