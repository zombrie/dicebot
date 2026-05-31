// NPC sheet storage: named character sheets managed by the DM, separate from player sheets.
import type { Sheet } from "./skills";
import { storageGet, storageSet, storageDelete } from "./storage";
import { defaultSheet } from "./sheet";

const NPC_INDEX_KEY = "npc:index";

// Storage key for an individual NPC sheet. Lowercased + underscored so the filename is safe.
function nameToKey(name: string): string {
  return "npc:" + name.toLowerCase().replace(/\s+/g, "_");
}

async function loadIndex(): Promise<string[]> {
  const raw = await storageGet(NPC_INDEX_KEY);
  if (!raw) return [];
  try { return JSON.parse(raw) as string[]; } catch { return []; }
}

async function saveIndex(names: string[]): Promise<void> {
  await storageSet(NPC_INDEX_KEY, JSON.stringify(names));
}

export async function listNPCs(): Promise<string[]> {
  return loadIndex();
}

// Case-insensitive lookup; returns the canonical (original-case) name or undefined.
export async function findNPCName(input: string): Promise<string | undefined> {
  const names = await loadIndex();
  const lower = input.toLowerCase();
  return names.find(n => n.toLowerCase() === lower);
}

export async function loadNPCSheet(canonicalName: string): Promise<Sheet> {
  const raw = await storageGet(nameToKey(canonicalName));
  if (!raw) return { ...defaultSheet(), name: canonicalName };
  try { return JSON.parse(raw) as Sheet; } catch { return { ...defaultSheet(), name: canonicalName }; }
}

export async function saveNPCSheet(canonicalName: string, sheet: Sheet): Promise<void> {
  await storageSet(nameToKey(canonicalName), JSON.stringify(sheet));
}

// Returns false if name already exists (case-insensitive).
export async function createNPC(name: string): Promise<boolean> {
  const names = await loadIndex();
  if (names.some(n => n.toLowerCase() === name.toLowerCase())) return false;
  names.push(name);
  await saveIndex(names);
  const sheet: Sheet = { ...defaultSheet(), name };
  await saveNPCSheet(name, sheet);
  return true;
}

// Returns the canonical name of the deleted NPC, or undefined if not found.
export async function deleteNPC(name: string): Promise<string | undefined> {
  const names = await loadIndex();
  const canonical = names.find(n => n.toLowerCase() === name.toLowerCase());
  if (!canonical) return undefined;
  await saveIndex(names.filter(n => n !== canonical));
  await storageDelete(nameToKey(canonical));
  return canonical;
}
