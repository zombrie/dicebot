function ordinal(n: number): string {
  if (n % 100 >= 10 && n % 100 <= 20) return `${n}th`;
  const suffix: Record<number, string> = { 1: "st", 2: "nd", 3: "rd" };
  return `${n}${suffix[n % 10] ?? "th"}`;
}

export function formatCalDate(yyyymmdd: number): string {
  const s = String(yyyymmdd).padStart(8, "0");
  const date = new Date(`${s.slice(0, 4)}-${s.slice(4, 6)}-${s.slice(6, 8)}T12:00:00Z`);
  const dayName = date.toLocaleDateString("en-US", { weekday: "long", timeZone: "UTC" });
  const monthName = date.toLocaleDateString("en-US", { month: "long", timeZone: "UTC" });
  return `${dayName} ${monthName} ${ordinal(parseInt(s.slice(6, 8), 10))}, ${s.slice(0, 4)}`;
}
