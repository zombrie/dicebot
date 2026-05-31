import { readFileSync, writeFileSync, existsSync, mkdirSync } from "fs";
import { join } from "path";

const DATA_DIR = join(process.cwd(), "data");
if (!existsSync(DATA_DIR)) mkdirSync(DATA_DIR, { recursive: true });

function keyToPath(key: string): string {
  return join(DATA_DIR, key.replace(/[^a-zA-Z0-9._-]/g, "_") + ".json");
}

export function storageGet(key: string): string | undefined {
  const file = keyToPath(key);
  if (!existsSync(file)) return undefined;
  return readFileSync(file, "utf-8");
}

export function storageSet(key: string, value: string): void {
  writeFileSync(keyToPath(key), value, "utf-8");
}
