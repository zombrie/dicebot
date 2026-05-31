// In-game event calendar. Dates are stored as YYYYMMDD integers for cheap lexicographic sorting.
import { storageGet, storageSet } from "./storage";
export { formatCalDate } from "./dateUtils";

export type CalEntry = {
  date: number; // YYYYMMDD as integer
  event: string;
};

const CAL_KEY = "calendar:global";

async function loadCal(): Promise<CalEntry[]> {
  const raw = await storageGet(CAL_KEY);
  if (!raw) return [];
  try { return JSON.parse(raw) as CalEntry[]; } catch { return []; }
}

async function saveCal(entries: CalEntry[]): Promise<void> {
  await storageSet(CAL_KEY, JSON.stringify(entries));
}

export async function addCalEntry(date: number, event: string): Promise<void> {
  const entries = await loadCal();
  entries.push({ date, event });
  await saveCal(entries);
}

export async function delCalEntries(date: number): Promise<number> {
  const entries = await loadCal();
  const remaining = entries.filter(e => e.date !== date);
  await saveCal(remaining);
  return entries.length - remaining.length;
}

export async function listCalEntries(): Promise<CalEntry[]> {
  const entries = await loadCal();
  return entries.slice().sort((a, b) => a.date - b.date);
}
