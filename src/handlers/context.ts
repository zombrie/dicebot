// Builds HandlerContext from a message event; shared utilities for all command handlers.
import {
  rootServer,
  type ChannelGuid,
  type UserGuid,
  type ChannelMessageCreatedEvent,
  type ChannelMessageCreateRequest,
} from "@rootsdk/server-bot";
import { isDM } from "../dm";
import { loadSheet, saveSheet } from "../sheet";
import { findNPCName, loadNPCSheet, saveNPCSheet } from "../npclib";
import type { Sheet } from "../skills";

export type Save = (sheet: Sheet) => Promise<void>;

export type HandlerContext = {
  evt: ChannelMessageCreatedEvent;
  who: string;
  reply: (content: string) => Promise<void>;
  getNickname: (userId: UserGuid) => Promise<string>;
  mentionUser: (userId: string, nickname: string) => string;
  // fn receives the loaded sheet, a formatted "for @target" suffix, and a pre-bound save function.
  // For #NPC-name targets, save routes to NPC storage; for player targets, to player storage.
  // fn is only called when DM auth passes; fn is responsible for calling save after mutation.
  withTargetSheet: (
    targetUserId: string | undefined,
    fn: (sheet: Sheet, ft: string, save: Save) => Promise<void>
  ) => Promise<void>;
};

export function mentionUser(userId: string, nickname: string): string {
  return `[@${nickname}](root://user/${userId})`;
}

export async function getNickname(userId: UserGuid): Promise<string> {
  const member = await rootServer.community.communityMembers.get({ userId });
  return member.nickname || "user";
}

// Root mention URLs use a different ID format (UUID) than evt.userId (UserGuid).
// Call this before using any mention-extracted ID as a storage key or for equality checks.
export async function resolveUserGuid(userId: string): Promise<UserGuid> {
  try {
    const member = await rootServer.community.communityMembers.get({ userId: userId as UserGuid });
    return member.userId;
  } catch {
    return userId as UserGuid;
  }
}

// Returns the bold display name for an NPC target (e.g. "**Brother Aldric**"), or null for player/self.
export function npcName(targetUserId: string | undefined): string | null {
  return targetUserId?.startsWith('#') ? `**${targetUserId.slice(1).trim()}**` : null;
}

export async function makeContext(evt: ChannelMessageCreatedEvent): Promise<HandlerContext> {
  let nick = "user";
  try { nick = await getNickname(evt.userId); } catch (e) {
    console.error("[makeContext] getNickname failed:", e);
  }
  const who = mentionUser(evt.userId, nick);

  const reply = async (content: string): Promise<void> => {
    const req: ChannelMessageCreateRequest = { channelId: evt.channelId as ChannelGuid, content };
    await rootServer.community.channelMessages.create(req);
  };

  const withTargetSheet = async (
    targetUserId: string | undefined,
    fn: (sheet: Sheet, ft: string, save: Save) => Promise<void>
  ): Promise<void> => {
    if (targetUserId?.startsWith('#')) {
      // NPC target — always requires DM
      if (!(await isDM(evt.userId))) {
        await reply("⚠️ Only a DM can modify NPC sheets.");
        return;
      }
      const name = targetUserId.slice(1).trim();
      const canonical = await findNPCName(name);
      if (!canonical) {
        await reply(`⚠️ NPC "${name}" not found. Use \`!npc create ${name}\` to create it.`);
        return;
      }
      const sheet = await loadNPCSheet(canonical);
      await fn(sheet, ` for **${canonical}**`, (s) => saveNPCSheet(canonical, s));
    } else {
      // Player target (or self)
      const targetId = targetUserId ? await resolveUserGuid(targetUserId) : evt.userId as UserGuid;
      const isSelf = targetId === evt.userId;
      if (!isSelf && !(await isDM(evt.userId))) {
        await reply("⚠️ Only a DM can modify another player's sheet.");
        return;
      }
      const sheet = await loadSheet(targetId);
      let ft = "";
      if (!isSelf) {
        const n = await getNickname(targetId).catch(() => "user");
        ft = ` for ${mentionUser(targetId, n)}`;
      }
      await fn(sheet, ft, (s) => saveSheet(targetId, s));
    }
  };

  return { evt, who, reply, getNickname, mentionUser, withTargetSheet };
}
