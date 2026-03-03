// server/src/main.ts
import {
  rootServer,
  ChannelMessageEvent,
  type ChannelMessageCreatedEvent,
  type ChannelMessageCreateRequest,
  type ChannelGuid,
  type UserGuid,
} from "@rootsdk/server-bot";

import { loadSheet, saveSheet } from "./sheet";
import { computeCheck, norm } from "./skills";
import { rollDice, formatDice } from "./dice";
import { parseTopLevel } from "./commands";
import { renderSheet } from "./render";

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

async function handleMessage(evt: ChannelMessageCreatedEvent) {
  const parsed = parseTopLevel(evt.messageContent);
  if (!parsed) return;

  // load sheet for any command that needs it
  const sheet = await loadSheet(evt.userId);
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
    sheet.activeForm = parsed.form;
    await saveSheet(evt.userId, sheet);
    const label = sheet.forms[parsed.form].label ?? parsed.form.toUpperCase();
    await reply(evt.channelId, `${who} active stats set to **${label}**.`);
    return;
  }

  if (parsed.kind === "char_set_pb") {
    const pb = parsed.pb;
    if (!Number.isFinite(pb) || pb < 0 || pb > 20) {
      await reply(evt.channelId, `⚠️ PB must be between 0 and 20.`);
      return;
    }
    sheet.pb = pb;
    await saveSheet(evt.userId, sheet);
    await reply(evt.channelId, `${who} proficiency bonus set to **${pb}**.`);
    return;
  }

  if (parsed.kind === "char_set_ability") {
    const { ability, form, score } = parsed;
    if (!Number.isFinite(score) || score < 1 || score > 30) {
      await reply(evt.channelId, `⚠️ Ability score must be 1–30.`);
      return;
    }
    sheet.forms[form].abilities[ability] = score;
    await saveSheet(evt.userId, sheet);
    const formLabel = sheet.forms[form].label ?? form.toUpperCase();
    await reply(evt.channelId, `${who} set **${ability.toUpperCase()}** (${formLabel}) to **${score}**.`);
    return;
  }

  if (parsed.kind === "char_prof_skill") {
    const key = norm(parsed.skill);
    sheet.skillProf[key] = parsed.level;
    await saveSheet(evt.userId, sheet);

    const lvl =
      parsed.level === 0 ? "not proficient" :
      parsed.level === 1 ? "proficient" :
      "expertise";

    await reply(evt.channelId, `${who} is now **${lvl}** in **${parsed.skill.trim()}**.`);
    return;
  }

  // sheet render
  if (parsed.kind === "sheet") {
    const content = renderSheet(sheet);
    await reply(evt.channelId, content);
    return;
  }
}

(async () => {
  rootServer.community.channelMessages.on(ChannelMessageEvent.ChannelMessageCreated, handleMessage);
  await rootServer.lifecycle.start();
})();