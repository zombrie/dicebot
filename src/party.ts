import { storageGet, storageSet } from "./storage";

const PARTY_KEY = "party:members";

function loadParty(): Set<string> {
  const raw = storageGet(PARTY_KEY);
  if (!raw) return new Set();
  try { return new Set(JSON.parse(raw) as string[]); } catch { return new Set(); }
}

function saveParty(party: Set<string>): void {
  storageSet(PARTY_KEY, JSON.stringify([...party]));
}

export async function registerMember(userId: string): Promise<void> {
  const party = loadParty();
  if (party.has(userId)) return;
  party.add(userId);
  saveParty(party);
}

export async function getMembers(): Promise<string[]> {
  return [...loadParty()];
}
