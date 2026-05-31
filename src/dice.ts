// Dice rolling engine: parses notation, rolls, and formats results. No side effects.
export type DiceResult = {
    notation: string;
    rolls: number[];
    kept: number[];
    modifier: number;
    total: number;
  };
  
  function randIntInclusive(min: number, max: number): number {
    return Math.floor(Math.random() * (max - min + 1)) + min;
  }
  
  export function rollDice(rawExpr: string): DiceResult {
    const s = rawExpr.replace(/\s+/g, "").toLowerCase();
  
    const mode = s.includes("adv") ? "adv" : s.includes("dis") ? "dis" : undefined;
    const sNoMode = s.replace(/adv|dis/g, "");
  
    let keep: { which: "h" | "l"; n: number } | undefined;
    const keepMatch = sNoMode.match(/k([hl])(\d+)$/);
    const core = keepMatch ? sNoMode.slice(0, -keepMatch[0].length) : sNoMode;
    if (keepMatch) keep = { which: keepMatch[1] as "h" | "l", n: Number(keepMatch[2]) };
  
    const m = core.match(/^(\d*)d(\d+)([+-]\d+)?$/);
    if (!m) throw new Error(`Couldn't parse dice expression: "${rawExpr}"`);
  
    let count = m[1] === "" ? 1 : Number(m[1]);
    const sides = Number(m[2]);
    const modifier = m[3] ? Number(m[3]) : 0;
  
    if (count < 1 || count > 100) throw new Error("Dice count must be 1–100.");
    if (sides < 2 || sides > 1000) throw new Error("Die sides must be 2–1000.");
    if (keep && (keep.n < 1 || keep.n > count)) throw new Error("Keep must be between 1 and the number of dice.");
  
    // adv/dis is just 2d20kh1 / 2d20kl1 — reuse the keep machinery rather than special-casing
    if (mode) {
      count = 2;
      keep = { which: mode === "adv" ? "h" : "l", n: 1 };
    }
  
    const rolls = Array.from({ length: count }, () => randIntInclusive(1, sides));
  
    let kept = [...rolls];
    if (keep) {
      const sorted = [...rolls].sort((a, b) => a - b);
      kept = keep.which === "h" ? sorted.slice(sorted.length - keep.n) : sorted.slice(0, keep.n);
    }
  
    const total = kept.reduce((a, b) => a + b, 0) + modifier;
  
    const notationParts = [
      `${count}d${sides}`,
      keep ? `k${keep.which}${keep.n}` : "",
      modifier ? (modifier > 0 ? `+${modifier}` : `${modifier}`) : "",
      mode ? `(${mode})` : "",
    ].filter(Boolean);
  
    return { notation: notationParts.join(""), rolls, kept, modifier, total };
  }
  
  export function formatDice(result: DiceResult): string {
    const rollsStr =
      result.kept.length === result.rolls.length
        ? `[${result.rolls.join(", ")}]`
        : `rolls=[${result.rolls.join(", ")}], kept=[${result.kept.join(", ")}]`;
  
    const modStr = result.modifier ? ` ${result.modifier > 0 ? "+" : "-"} ${Math.abs(result.modifier)}` : "";
    return `🎲 **${result.notation}** → ${rollsStr}${modStr} = **${result.total}**`;
  }
  
  export function splitParts(rest: string): string[] {
    return rest
      .split(/(?:\s*;\s*|\n+)/)
      .map(s => s.trim())
      .filter(Boolean);
  }