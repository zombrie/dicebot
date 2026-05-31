import { storageGet, storageSet } from "./storage";

const PARTY_KEY = "party:members";

async function loadParty(): Promise<Set<string>> {
  const raw = await storageGet(PARTY_KEY);
  if (!raw) return new Set();
  try { return new Set(JSON.parse(raw) as string[]); } catch { return new Set(); }
}

async function saveParty(party: Set<string>): Promise<void> {
  await storageSet(PARTY_KEY, JSON.stringify([...party]));
}

export async function registerMember(userId: string): Promise<void> {
  const party = await loadParty();
  if (party.has(userId)) return;
  party.add(userId);
  await saveParty(party);
}

export async function getMembers(): Promise<string[]> {
  return [...(await loadParty())];
}
