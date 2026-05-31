import { storageGet, storageSet } from "./storage";
export { formatCalDate } from "./dateUtils";

export type CalEntry = {
  date: number;  // YYYYMMDD as integer
  event: string;
};

const CAL_KEY = "calendar:global";

function loadCal(): CalEntry[] {
  const raw = storageGet(CAL_KEY);
  if (!raw) return [];
  try { return JSON.parse(raw) as CalEntry[]; } catch { return []; }
}

function saveCal(entries: CalEntry[]): void {
  storageSet(CAL_KEY, JSON.stringify(entries));
}

export async function addCalEntry(date: number, event: string): Promise<void> {
  const entries = loadCal();
  entries.push({ date, event });
  saveCal(entries);
}

export async function delCalEntries(date: number): Promise<number> {
  const entries = loadCal();
  const remaining = entries.filter(e => e.date !== date);
  saveCal(remaining);
  return entries.length - remaining.length;
}

export async function listCalEntries(): Promise<CalEntry[]> {
  const entries = loadCal();
  return entries.slice().sort((a, b) => a.date - b.date);
}
