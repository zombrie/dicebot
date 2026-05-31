import { storageGet, storageSet } from "./storage";

const DM_KEY = "dms";

function load(): Set<string> {
  const raw = storageGet(DM_KEY);
  if (!raw) return new Set();
  try { return new Set(JSON.parse(raw)); } catch { return new Set(); }
}

function save(dms: Set<string>): void {
  storageSet(DM_KEY, JSON.stringify([...dms]));
}

export async function isDM(userId: string): Promise<boolean> {
  return load().has(userId);
}

export async function getDMs(): Promise<string[]> {
  return [...load()];
}

export async function hasAnyDM(): Promise<boolean> {
  return load().size > 0;
}

export async function addDM(userId: string): Promise<void> {
  const dms = load();
  dms.add(userId);
  save(dms);
}

export async function removeDM(userId: string): Promise<void> {
  const dms = load();
  dms.delete(userId);
  save(dms);
}
