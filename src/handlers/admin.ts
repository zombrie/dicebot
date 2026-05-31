// Handlers for !dm (roster), !cal (calendar), and !import (D&D Beyond character import).
import type { HandlerContext } from "./context";
import type { ParsedCommand } from "../commands";
import { saveSheet, loadSheet } from "../sheet";
import { isDM, getDMs, addDM, removeDM, hasAnyDM } from "../dm";
import { addCalEntry, delCalEntries, listCalEntries, formatCalDate } from "../calendar";
import { fetchDDBSheet } from "../ddbimport";
import { expToLevel } from "../skills";
import type { UserGuid } from "@rootsdk/server-bot";

export async function handleDMClaim(ctx: HandlerContext, _parsed: Extract<ParsedCommand, { kind: "dm_claim" }>): Promise<void> {
  const { evt, who, reply } = ctx;
  if (await hasAnyDM()) {
    await reply("⚠️ DMs already exist. Ask a DM to add you with `!dm add @you`.");
    return;
  }
  await addDM(evt.userId);
  await reply(`${who} is now the DM! 🎲`);
}

export async function handleDMAdd(ctx: HandlerContext, parsed: Extract<ParsedCommand, { kind: "dm_add" }>): Promise<void> {
  const { evt, reply, getNickname, mentionUser } = ctx;
  if (!(await isDM(evt.userId))) {
    await reply("⚠️ Only a DM can add other DMs.");
    return;
  }
  await addDM(parsed.targetUserId);
  const n = await getNickname(parsed.targetUserId as UserGuid).catch(() => "user");
  await reply(`${mentionUser(parsed.targetUserId, n)} is now a DM.`);
}

export async function handleDMRemove(ctx: HandlerContext, parsed: Extract<ParsedCommand, { kind: "dm_remove" }>): Promise<void> {
  const { evt, reply, getNickname, mentionUser } = ctx;
  if (!(await isDM(evt.userId))) {
    await reply("⚠️ Only a DM can remove DMs.");
    return;
  }
  await removeDM(parsed.targetUserId);
  const n = await getNickname(parsed.targetUserId as UserGuid).catch(() => "user");
  await reply(`${mentionUser(parsed.targetUserId, n)} is no longer a DM.`);
}

export async function handleDMList(ctx: HandlerContext, _parsed: Extract<ParsedCommand, { kind: "dm_list" }>): Promise<void> {
  const { reply, getNickname, mentionUser } = ctx;
  const dmIds = await getDMs();
  if (dmIds.length === 0) {
    await reply("No DMs set. Use `!dm claim` to become the DM.");
    return;
  }
  const mentions = await Promise.all(
    dmIds.map(async id => {
      const n = await getNickname(id as UserGuid).catch(() => id);
      return mentionUser(id, n);
    })
  );
  await reply(`**DMs:** ${mentions.join(", ")}`);
}

export async function handleCalShow(ctx: HandlerContext, _parsed: Extract<ParsedCommand, { kind: "cal_show" }>): Promise<void> {
  const { reply } = ctx;
  const entries = await listCalEntries();
  if (entries.length === 0) {
    await reply("📅 The calendar is empty.");
    return;
  }
  const lines = ["📅 **Calendar**", ""];
  for (const e of entries) {
    lines.push(`**${formatCalDate(e.date)}:** ${e.event}`);
  }
  await reply(lines.join("\n"));
}

export async function handleCalAdd(ctx: HandlerContext, parsed: Extract<ParsedCommand, { kind: "cal_add" }>): Promise<void> {
  const { evt, reply } = ctx;
  if (!(await isDM(evt.userId))) {
    await reply("⚠️ Only a DM can add calendar events.");
    return;
  }
  await addCalEntry(parsed.date, parsed.event);
  await reply(`📅 Added: **${formatCalDate(parsed.date)}** — ${parsed.event}`);
}

export async function handleCalDel(ctx: HandlerContext, parsed: Extract<ParsedCommand, { kind: "cal_del" }>): Promise<void> {
  const { evt, reply } = ctx;
  if (!(await isDM(evt.userId))) {
    await reply("⚠️ Only a DM can remove calendar events.");
    return;
  }
  const removed = await delCalEntries(parsed.date);
  if (removed === 0) {
    await reply(`⚠️ No events found on **${formatCalDate(parsed.date)}**.`);
    return;
  }
  await reply(`🗑️ Removed ${removed} event${removed !== 1 ? "s" : ""} on **${formatCalDate(parsed.date)}**.`);
}

export async function handleDDBImport(ctx: HandlerContext, parsed: Extract<ParsedCommand, { kind: "ddb_import" }>): Promise<void> {
  const { evt, reply, getNickname, mentionUser } = ctx;

  // Check auth manually — we need to send "fetching…" before we do the heavy network call,
  // which means we can't use withTargetSheet (it loads the sheet before we get control back).
  const targetId = (parsed.targetUserId ?? evt.userId) as UserGuid;
  const isSelf = targetId === evt.userId;
  if (!isSelf && !(await isDM(evt.userId))) {
    await reply("⚠️ Only a DM can modify another player's sheet.");
    return;
  }

  await reply("⏳ Fetching character from D&D Beyond…");

  let imported;
  try {
    imported = await fetchDDBSheet(parsed.characterId);
  } catch (e) {
    await reply(`⚠️ Import failed: ${e instanceof Error ? e.message : "Unknown error"}`);
    return;
  }

  const existing = await loadSheet(targetId);
  const merged = {
    ...imported,
    forms: { irl: existing.forms.irl, ingame: imported.forms.ingame },
    inventory: existing.inventory,
  };
  await saveSheet(targetId, merged);

  let ft = "";
  if (!isSelf) {
    const n = await getNickname(targetId).catch(() => "user");
    ft = ` for ${mentionUser(targetId, n)}`;
  }

  const slotSummary = imported.maxSpellSlots && Object.keys(imported.maxSpellSlots).length > 0
    ? `\nSpell slots: ${Object.entries(imported.maxSpellSlots).map(([l, n]) => `L${l}: ${n}`).join(", ")}`
    : "";
  const skillCount = Object.values(imported.skillProf).filter(v => v > 0).length;
  const saveCount = Object.values(imported.saveProf ?? {}).filter(Boolean).length;

  await reply([
    `✅ Imported **${imported.name}** (${imported.class}, Level ${expToLevel(imported.exp ?? 0)})${ft}!`,
    `HP: ${imported.hp}/${imported.maxHp} | PB: +${imported.pb} | Hit die: d${imported.hitDice}`,
    `${skillCount} skill prof${skillCount !== 1 ? "s" : ""}, ${saveCount} save prof${saveCount !== 1 ? "s" : ""}${slotSummary}`,
    `Run \`!sheet\` to see the full character.`,
  ].join("\n"));
}
