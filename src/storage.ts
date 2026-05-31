// File-based JSON key/value store. Used instead of the Root SDK's appData, which doesn't persist for dev bots.
import { readFile, writeFile } from "fs/promises";
import { mkdirSync, existsSync } from "fs";
import { join } from "path";

const DATA_DIR = join(process.cwd(), "data");
if (!existsSync(DATA_DIR)) mkdirSync(DATA_DIR, { recursive: true });

function keyToPath(key: string): string {
  return join(DATA_DIR, key.replace(/[^a-zA-Z0-9._-]/g, "_") + ".json");
}

export async function storageGet(key: string): Promise<string | undefined> {
  try {
    return await readFile(keyToPath(key), "utf-8");
  } catch {
    return undefined;
  }
}

export async function storageSet(key: string, value: string): Promise<void> {
  await writeFile(keyToPath(key), value, "utf-8");
}
