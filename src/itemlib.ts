import { storageGet, storageSet } from "./storage";

export type ItemEntry = {
  weight: number; // lbs
  price: number;  // gp
  color: number;  // ANSI color code; 37 = white (mundane), anything else = magic
  description: string;
};

export function isMagic(entry: ItemEntry): boolean {
  return (entry.color ?? 37) !== 37;
}

const LIB_KEY = "itemlib:global";

function loadLib(): Record<string, ItemEntry> {
  const raw = storageGet(LIB_KEY);
  if (!raw) return {};
  try { return JSON.parse(raw) as Record<string, ItemEntry>; } catch { return {}; }
}

function saveLib(lib: Record<string, ItemEntry>): void {
  storageSet(LIB_KEY, JSON.stringify(lib));
}

function findKey(lib: Record<string, ItemEntry>, name: string): string | undefined {
  if (name in lib) return name;
  const lower = name.toLowerCase();
  return Object.keys(lib).find(k => k.toLowerCase() === lower);
}

export async function getItem(name: string): Promise<ItemEntry | undefined> {
  const lib = loadLib();
  const key = findKey(lib, name);
  return key ? lib[key] : undefined;
}

export async function addItem(name: string, entry: ItemEntry): Promise<void> {
  const lib = loadLib();
  lib[name] = entry;
  saveLib(lib);
}

export async function delItem(name: string): Promise<boolean> {
  const lib = loadLib();
  const key = findKey(lib, name);
  if (!key) return false;
  delete lib[key];
  saveLib(lib);
  return true;
}

export async function listItems(filter?: string): Promise<Array<[string, ItemEntry]>> {
  const lib = loadLib();
  const entries = Object.entries(lib);
  if (!filter) return entries;
  if (filter.toLowerCase() === "magic") return entries.filter(([, e]) => isMagic(e));
  const f = filter.toLowerCase();
  return entries.filter(([k]) => k.toLowerCase().startsWith(f));
}

export async function calcInventoryWeight(inventory: Record<string, number>): Promise<{ used: number; lib: Record<string, ItemEntry> }> {
  const lib = loadLib();
  let used = 0;
  for (const [item, qty] of Object.entries(inventory)) {
    const key = findKey(lib, item);
    if (key) used += lib[key].weight * qty;
  }
  return { used, lib };
}
