// Handlers for !inv (player inventory) and !lib (DM-only item library).
import type { HandlerContext } from "./context";
import type { ParsedCommand } from "../commands";
import { saveSheet, loadSheet } from "../sheet";
import { getItem, addItem, delItem, listItems, calcInventoryWeight, isMagic } from "../itemlib";
import { renderInventoryRow } from "../render";
import { isDM } from "../dm";
import type { UserGuid } from "@rootsdk/server-bot";

export async function handleInvShow(ctx: HandlerContext, parsed: Extract<ParsedCommand, { kind: "inv_show" }>): Promise<void> {
  const { evt, who, reply, getNickname, mentionUser } = ctx;
  const targetId = (parsed.targetUserId ?? evt.userId) as UserGuid;
  const sheet = await loadSheet(targetId);
  const label = targetId === evt.userId
    ? `${who}'s`
    : `${mentionUser(targetId, await getNickname(targetId).catch(() => "user"))}'s`;

  const invEntries = Object.entries(sheet.inventory);
  if (invEntries.length === 0) {
    await reply(`${label} inventory is empty.`);
    return;
  }
  const { used, lib } = await calcInventoryWeight(sheet.inventory);
  const strScore = sheet.forms[sheet.activeForm].abilities.str;
  const capacity = strScore * 15;
  const weightStr = used > 0 ? ` (${used.toFixed(1)} / ${capacity} lbs)` : "";
  const lines = [`${label} inventory${weightStr}:`];
  invEntries.forEach(([item, qty], i) => {
    const entry = lib[item] ?? Object.entries(lib).find(([k]) => k.toLowerCase() === item.toLowerCase())?.[1];
    lines.push(renderInventoryRow(i, item, qty, entry));
  });
  await reply(lines.join("\n"));
}

export async function handleInvAdd(ctx: HandlerContext, parsed: Extract<ParsedCommand, { kind: "inv_add" }>): Promise<void> {
  const { who, reply, withTargetSheet } = ctx;
  await withTargetSheet(parsed.targetUserId, async (sheet, ft, targetId) => {
    const strScore = sheet.forms[sheet.activeForm].abilities.str;
    const capacity = strScore * 15;
    const { used } = await calcInventoryWeight(sheet.inventory);
    let addedWeight = 0;
    for (const { item, qty } of parsed.items) {
      const libEntry = await getItem(item);
      if (libEntry) addedWeight += libEntry.weight * qty;
    }
    if (addedWeight > 0 && used + addedWeight > capacity) {
      await reply(`⚠️ That would exceed carrying capacity! (${used.toFixed(1)} + ${addedWeight.toFixed(1)} > ${capacity} lbs)`);
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
    if (summary.length === 1) {
      await reply(`${who} added ${summary[0]} to inventory${ft}.`);
    } else {
      await reply(`${who} added ${summary.length} items to inventory${ft}: ${summary.join(", ")}.`);
    }
  });
}

export async function handleInvRemove(ctx: HandlerContext, parsed: Extract<ParsedCommand, { kind: "inv_remove" }>): Promise<void> {
  const { who, reply, withTargetSheet } = ctx;
  await withTargetSheet(parsed.targetUserId, async (sheet, ft, targetId) => {
    const key = Object.keys(sheet.inventory).find(k => k.toLowerCase() === parsed.item.toLowerCase());
    if (!key) {
      await reply(`⚠️ **${parsed.item}** not found in inventory.`);
      return;
    }
    if (sheet.inventory[key] <= parsed.qty) {
      delete sheet.inventory[key];
    } else {
      sheet.inventory[key] -= parsed.qty;
    }
    await saveSheet(targetId, sheet);
    const qtyStr = parsed.qty !== 1 ? ` ×${parsed.qty}` : "";
    await reply(`${who} removed **${parsed.item}**${qtyStr} from inventory${ft}.`);
  });
}

export async function handleInvClear(ctx: HandlerContext, parsed: Extract<ParsedCommand, { kind: "inv_clear" }>): Promise<void> {
  const { who, reply, withTargetSheet } = ctx;
  await withTargetSheet(parsed.targetUserId, async (sheet, ft, targetId) => {
    sheet.inventory = {};
    await saveSheet(targetId, sheet);
    await reply(`${who} cleared inventory${ft}.`);
  });
}

export async function handleLibAdd(ctx: HandlerContext, parsed: Extract<ParsedCommand, { kind: "lib_add" }>): Promise<void> {
  const { evt, reply } = ctx;
  if (!(await isDM(evt.userId))) {
    await reply("⚠️ Only a DM can modify the item library.");
    return;
  }
  for (const { name, weight, price, color, description } of parsed.items) {
    await addItem(name, { weight, price, color, magic: color !== 37, description });
  }
  if (parsed.items.length === 1) {
    const { name, weight, price, color } = parsed.items[0];
    const magicTag = color !== 37 ? " ✨" : "";
    await reply(`📦 **${name}**${magicTag} added to library (${weight} lbs, ${price} gp, color ${color}).`);
  } else {
    const summary = parsed.items.map(({ name, color }) => `**${name}**${color !== 37 ? " ✨" : ""}`).join(", ");
    await reply(`📦 Added ${parsed.items.length} items to library: ${summary}.`);
  }
}

export async function handleLibDel(ctx: HandlerContext, parsed: Extract<ParsedCommand, { kind: "lib_del" }>): Promise<void> {
  const { evt, reply } = ctx;
  if (!(await isDM(evt.userId))) {
    await reply("⚠️ Only a DM can modify the item library.");
    return;
  }
  const removed = await delItem(parsed.name);
  if (!removed) {
    await reply(`⚠️ **${parsed.name}** not found in library.`);
    return;
  }
  await reply(`🗑️ **${parsed.name}** removed from library.`);
}

export async function handleLibCheck(ctx: HandlerContext, parsed: Extract<ParsedCommand, { kind: "lib_check" }>): Promise<void> {
  const { reply } = ctx;
  const entry = await getItem(parsed.name);
  if (!entry) {
    await reply(`⚠️ **${parsed.name}** not found in library.`);
    return;
  }
  const magicTag = isMagic(entry) ? " ✨" : "";
  let msg = `📦 **${parsed.name}**${magicTag}\nWeight: ${entry.weight} lbs | Price: ${entry.price} gp | Color: ${entry.color ?? 37}`;
  if (entry.description) msg += `\n${entry.description}`;
  await reply(msg);
}

export async function handleLibList(ctx: HandlerContext, parsed: Extract<ParsedCommand, { kind: "lib_list" }>): Promise<void> {
  const { reply } = ctx;
  const entries = await listItems(parsed.filter);
  if (entries.length === 0) {
    const filterNote = parsed.filter ? ` matching "${parsed.filter}"` : "";
    await reply(`Library is empty${filterNote}.`);
    return;
  }
  const lines = [`📚 **Item Library${parsed.filter ? ` — "${parsed.filter}"` : ""}:**`];
  for (const [name, entry] of entries) {
    const magicTag = isMagic(entry) ? " ✨" : "";
    lines.push(`• **${name}**${magicTag} — ${entry.weight} lbs, ${entry.price} gp`);
  }
  await reply(lines.join("\n"));
}
