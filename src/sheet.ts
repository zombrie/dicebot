import type { UserGuid } from "@rootsdk/server-bot";
import type { Sheet } from "./skills";
import { registerMember } from "./party";
import { storageGet, storageSet } from "./storage";

export function defaultSheet(): Sheet {
  return {
    version: 1,
    activeForm: "irl",
    pb: 2,
    forms: {
      irl: { label: "In Real Life", abilities: { str: 10, dex: 10, con: 10, int: 10, wis: 10, cha: 10 } },
      ingame: { label: "In Game", abilities: { str: 10, dex: 10, con: 10, int: 10, wis: 10, cha: 10 } },
    },
    skillProf: {},
    inventory: {},
  };
}

function keyFor(userId: UserGuid) {
  return `sheet:${userId}`;
}

export async function loadSheet(userId: UserGuid): Promise<Sheet> {
  const key = keyFor(userId);
  const raw = storageGet(key);

  if (!raw) {
    const sheet = defaultSheet();
    await saveSheet(userId, sheet);
    return sheet;
  }
  try {
    const sheet = JSON.parse(raw) as Sheet;
    if (Array.isArray(sheet.inventory)) {
      // migrate from old string[] format
      sheet.inventory = Object.fromEntries((sheet.inventory as unknown as string[]).map(s => [s, 1]));
    } else if (!sheet.inventory) {
      sheet.inventory = {};
    }
    return sheet;
  } catch (error) {
    console.error(error);
    const sheet = defaultSheet();
    await saveSheet(userId, sheet);
    return sheet;
  }
}

export async function saveSheet(userId: UserGuid, sheet: Sheet): Promise<void> {
  try {
    await registerMember(userId);
  } catch (e) {
    console.error("[saveSheet] registerMember failed:", e);
  }
  storageSet(keyFor(userId), JSON.stringify(sheet));
}
