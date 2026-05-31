import type { HandlerContext } from "./context";
import type { ParsedCommand } from "../commands";
import { rollDice, formatDice } from "../dice";
import { computeCheck } from "../skills";
import { loadSheet } from "../sheet";
import type { UserGuid } from "@rootsdk/server-bot";

export async function handleRoll(ctx: HandlerContext, parsed: Extract<ParsedCommand, { kind: "roll" }>): Promise<void> {
  const { who, reply } = ctx;
  const lines: string[] = [];
  for (const raw of parsed.parts) {
    try {
      lines.push(formatDice(rollDice(raw)));
    } catch (e) {
      lines.push(`⚠️ ${e instanceof Error ? e.message : "Unknown error"}`);
    }
  }
  await reply(`${who} rolled:\n${lines.map(l => `• ${l}`).join("\n")}`);
}

export async function handleCheck(ctx: HandlerContext, parsed: Extract<ParsedCommand, { kind: "check" }>): Promise<void> {
  const { evt, who, reply } = ctx;
  const sheet = await loadSheet(evt.userId as UserGuid);
  const lines: string[] = [];
  for (const part of parsed.parts) {
    try {
      const out = computeCheck(sheet, part.target, part.form);
      lines.push(`🎲 **${out.title}** → ${out.breakdown}`);
    } catch (e) {
      lines.push(`⚠️ ${e instanceof Error ? e.message : "Unknown error"}`);
    }
  }
  await reply(`${who} rolled:\n${lines.map(l => `• ${l}`).join("\n")}`);
}
