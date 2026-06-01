// Handlers for !npc structural commands: create, list, delete.
// Sheet operations use standard player commands with a #NPC-name target (e.g. !char set hp 30 #Brother Aldric).
import type { HandlerContext } from "./context";
import type { ParsedCommand } from "../commands";
import { listNPCs, createNPC, deleteNPC } from "../npclib";
import { isDM } from "../dm";

async function requireDM(ctx: HandlerContext): Promise<boolean> {
  if (await isDM(ctx.evt.userId)) return true;
  await ctx.reply("⚠️ Only a DM can manage NPC sheets.");
  return false;
}

export async function handleNPCCreate(ctx: HandlerContext, parsed: Extract<ParsedCommand, { kind: "npc_create" }>): Promise<void> {
  if (!(await requireDM(ctx))) return;
  const created = await createNPC(parsed.name);
  if (!created) {
    await ctx.reply(`⚠️ An NPC named "${parsed.name}" already exists.`);
    return;
  }
  await ctx.reply(`✅ NPC **${parsed.name}** created! Use \`!sheet #${parsed.name}\` to view.`);
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
