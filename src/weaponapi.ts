// Open5e weapon lookup (~500 weapons) with STR/DEX/finesse ability selection for attack rolls.
import type { Sheet } from "./skills";
import { abilityMod } from "./skills";

const BASE = "https://api.open5e.com/v2/weapons";

interface WeaponProperty {
  property: { name: string; type: string | null; desc: string };
  detail: string | null;
}

export interface Open5eWeapon {
  name: string;
  damage_dice: string;
  damage_type: { name: string; key: string };
  range: number;
  long_range: number;
  is_simple: boolean;
  properties: WeaponProperty[];
}

async function fetchWeapons(params: Record<string, string>): Promise<Open5eWeapon[]> {
  const qs = new URLSearchParams({ limit: "5", ...params }).toString();
  let res: Response;
  try {
    res = await fetch(`${BASE}/?${qs}`, { headers: { Accept: "application/json" } });
  } catch {
    throw new Error("Could not reach the Open5e API — check your connection.");
  }
  if (!res.ok) throw new Error(`Open5e returned an error (${res.status}).`);
  const data = await res.json() as { results?: Open5eWeapon[] };
  return data.results ?? [];
}

export async function lookupWeapon(name: string): Promise<Open5eWeapon> {
  const trimmed = name.trim();
  let results = await fetchWeapons({ name__iexact: trimmed });
  if (results.length === 0) {
    results = await fetchWeapons({ name__icontains: trimmed });
    if (results.length === 0) {
      throw new Error(
        `"${trimmed}" not found in the weapons database. ` +
        `Make sure your inventory item uses a standard weapon name (e.g. "longsword", "hand crossbow"). ` +
        `Use \`!r\` to roll manually for custom weapons.`
      );
    }
    results.sort((a, b) => a.name.length - b.name.length); // shortest match = best fit
  }
  return results[0];
}

export function hasProperty(weapon: Open5eWeapon, propName: string): boolean {
  return weapon.properties.some(p => p.property.name.toLowerCase() === propName.toLowerCase());
}

export function isRanged(weapon: Open5eWeapon): boolean {
  return weapon.range > 0;
}

export function getAbilityToUse(weapon: Open5eWeapon, sheet: Sheet): "str" | "dex" {
  if (isRanged(weapon)) return "dex";
  if (hasProperty(weapon, "finesse")) {
    const str = sheet.forms[sheet.activeForm].abilities.str;
    const dex = sheet.forms[sheet.activeForm].abilities.dex;
    return str >= dex ? "str" : "dex";
  }
  return "str";
}

export function getAttackMod(weapon: Open5eWeapon, sheet: Sheet): { ability: "str" | "dex"; mod: number } {
  const ability = getAbilityToUse(weapon, sheet);
  const mod = abilityMod(sheet.forms[sheet.activeForm].abilities[ability]);
  return { ability, mod };
}
