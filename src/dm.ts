import { storageGet, storageSet } from "./storage";

const DM_KEY = "dms";

async function load(): Promise<Set<string>> {
  const raw = await storageGet(DM_KEY);
  if (!raw) return new Set();
  try { return new Set(JSON.parse(raw)); } catch { return new Set(); }
}

async function save(dms: Set<string>): Promise<void> {
  await storageSet(DM_KEY, JSON.stringify([...dms]));
}

export async function isDM(userId: string): Promise<boolean> {
  return (await load()).has(userId);
}

export async function getDMs(): Promise<string[]> {
  return [...(await load())];
}

export async function hasAnyDM(): Promise<boolean> {
  return (await load()).size > 0;
}

export async function addDM(userId: string): Promise<void> {
  const dms = await load();
  dms.add(userId);
  await save(dms);
}

export async function removeDM(userId: string): Promise<void> {
  const dms = await load();
  dms.delete(userId);
  await save(dms);
}
