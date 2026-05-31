// Builds HandlerContext from a message event; shared utilities for all command handlers.
import {
  rootServer,
  type ChannelGuid,
  type UserGuid,
  type ChannelMessageCreatedEvent,
  type ChannelMessageCreateRequest,
} from "@rootsdk/server-bot";
import { isDM } from "../dm";
import { loadSheet } from "../sheet";
import type { Sheet } from "../skills";

export type HandlerContext = {
  evt: ChannelMessageCreatedEvent;
  who: string;
  reply: (content: string) => Promise<void>;
  getNickname: (userId: UserGuid) => Promise<string>;
  mentionUser: (userId: string, nickname: string) => string;
  withTargetSheet: (
    targetUserId: string | undefined,
    fn: (sheet: Sheet, ft: string, targetId: UserGuid) => Promise<void>
  ) => Promise<void>;
};

export function mentionUser(userId: string, nickname: string): string {
  return `[@${nickname}](root://user/${userId})`;
}

export async function getNickname(userId: UserGuid): Promise<string> {
  const member = await rootServer.community.communityMembers.get({ userId });
  return member.nickname || "user";
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

  // Checks DM auth for cross-player edits, loads the sheet, and computes the "for @user" suffix.
  // fn is only called when auth passes; fn is responsible for saving the sheet after mutation.
  const withTargetSheet = async (
    targetUserId: string | undefined,
    fn: (sheet: Sheet, ft: string, targetId: UserGuid) => Promise<void>
  ): Promise<void> => {
    const targetId = (targetUserId ?? evt.userId) as UserGuid;
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
    await fn(sheet, ft, targetId);
  };

  return { evt, who, reply, getNickname, mentionUser, withTargetSheet };
}
