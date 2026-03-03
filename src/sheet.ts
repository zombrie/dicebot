import { rootServer, type UserGuid } from "@rootsdk/server-bot";
import type { Sheet } from "./skills";

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
  };
}

function keyFor(userId: UserGuid) {
  return `sheet:${userId}`;
}

export async function loadSheet(userId: UserGuid): Promise<Sheet> {
  const key = keyFor(userId);

  const raw = await rootServer.dataStore.appData.get(key) as string;

  if (!raw) {
    const sheet = defaultSheet();
    await saveSheet(userId, sheet);
    return sheet;
  }
  try {
    return JSON.parse(raw) as Sheet;
  } catch (error) {
    console.error(error);
    const sheet = defaultSheet();
    await saveSheet(userId, sheet);
    return sheet;
  }
}

export async function saveSheet(userId: UserGuid, sheet: Sheet): Promise<void> {
  await rootServer.dataStore.appData.set({key:keyFor(userId), value: JSON.stringify(sheet)});
}