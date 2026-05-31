function code(s: string) {
  return `\`${s}\``;
}

export function renderHelp(topic?: string): string {
  const t = topic?.toLowerCase().trim();

  if (!t) return generalHelp();
  if (["r", "roll", "dice"].includes(t)) return rollHelp();
  if (["check", "checks"].includes(t)) return checkHelp();
  if (["char", "character", "sheet", "stats"].includes(t)) return charHelp();
  if (["dm", "dungeon master"].includes(t)) return dmHelp();
  if (["inv", "inventory"].includes(t)) return invHelp();
  if (["lib", "library", "items"].includes(t)) return libHelp();
  if (["exp", "experience", "level"].includes(t)) return expHelp();
  if (["cal", "calendar", "date", "dates"].includes(t)) return calHelp();
  if (["rest", "cast", "casting", "slots"].includes(t)) return restHelp();
  if (["spell", "spells", "spellbook", "known"].includes(t)) return spellHelp();

  return (
    `I don't recognize the help topic ${code(topic!)}.\n` +
    `Try: ${code("!help")} ${code("!help roll")} ${code("!help check")} ${code("!help char")} ${code("!help dm")} ${code("!help inv")} ${code("!help lib")} ${code("!help exp")} ${code("!help cal")} ${code("!help rest")}`
  );
}

function generalHelp(): string {
  return [
    `🤖 **Dice & Character Bot Help**`,
    ``,
    `**Rolling dice**`,
    `• ${code("!r d20")}`,
    `• ${code("!r 2d6+3")}`,
    `• ${code("!r 4d6kh3")} (keep highest 3)`,
    `• ${code("!r d20adv")} / ${code("!r d20dis")}`,
    `• Multiple: ${code("!r 1d20+5; 2d6+3")}`,
    ``,
    `**Checks**`,
    `• ${code("!check str")} / ${code("!check insight")}`,
    `• ${code("!check stealth; perception; str ingame")}`,
    ``,
    `**Character setup**`,
    `• ${code("!char set pb 3")}`,
    `• ${code("!char set ability str irl 16")}`,
    `• ${code("!char use irl")} or ${code("!char use ingame")}`,
    `• ${code("!sheet")} / ${code("!sheet @user")}`,
    ``,
    `**Inventory**`,
    `• ${code("!inv")} / ${code("!inv @user")}`,
    `• ${code("!inv add Sword of Fire")} / ${code("!inv add Arrows 20")}`,
    `• ${code("!inv remove Sword of Fire")}`,
    ``,
    `**Item library** (DM manages, anyone can look up)`,
    `• ${code("!lib check longsword")} / ${code("!lib list")}`,
    ``,
    `**HP & EXP**`,
    `• ${code("!char set hp 30")} / ${code("!char set maxhp 30")}`,
    `• ${code("!char adjust hp -5")} (damage) / ${code("!char adjust hp 3")} (heal)`,
    `• ${code("!exp 300")} — award experience (DM for others)`,
    `• ${code("!exprank")} — show all party members sorted by exp`,
    ``,
    `**Spells**`,
    `• ${code("!spell fireball")} — look up any spell from Open5e`,
    `• ${code("!cast fireball")} — cast a spell (rolls damage, deducts slot)`,
    `• ${code("!cast fireball 5")} — upcast to level 5`,
    `• ${code("!cast blind 2")} — deduct a slot with no spell lookup`,
    `• ${code("!attack longsword")} — melee/ranged attack (checks inventory)`,
    `• ${code("!attack crossbow adv")} — with advantage`,
    ``,
    `**Rests**`,
    `• ${code("!rest long")} — restore HP + spell slots`,
    `• ${code("!rest short [N]")} — roll N hit dice for HP`,
    ``,
    `**Calendar** (DM manages)`,
    `• ${code("!cal")} — view upcoming events`,
    `• ${code("!cal add 20260115 Winter Solstice Festival")}`,
    `• ${code("!cal del 20260115")}`,
    ``,
    `**DM commands**`,
    `• ${code("!dm claim")} (first-run setup)`,
    `• ${code("!dm add @user")} / ${code("!dm remove @user")}`,
    `• ${code("!dm list")}`,
    ``,
    `**D&D Beyond import**`,
    `• ${code("!import 12345678")} or ${code("!import https://www.dndbeyond.com/characters/12345678")}`,
    `  Imports abilities, class, HP, spell slots, proficiencies. Character must be set to public.`,
    ``,
    `More topics: ${code("!help roll")} • ${code("!help check")} • ${code("!help char")} • ${code("!help dm")} • ${code("!help inv")} • ${code("!help lib")} • ${code("!help exp")} • ${code("!help cal")} • ${code("!help rest")}`,
  ].join("\n");
}

function rollHelp(): string {
  return [
    `🎲 **Roll Help**`,
    ``,
    `• ${code("!r d20")}`,
    `• ${code("!r 2d6+3")}`,
    `• ${code("!r 4d6kh3")} (keep highest 3)`,
    `• ${code("!r d20adv")} / ${code("!r d20dis")}`,
    ``,
    `Multiple rolls: separate with ";" or newlines`,
    `• ${code("!r 1d20+5; 2d6+3")}`,
  ].join("\n");
}

function checkHelp(): string {
  return [
    `✅ **Check Help**`,
    ``,
    `Ability checks:`,
    `• ${code("!check str")} ${code("!check dex")} ${code("!check cha")} ...`,
    ``,
    `Skill checks (apply proficiency if set):`,
    `• ${code("!check insight")} ${code("!check intimidation")} ${code("!check stealth")} ...`,
    ``,
    `Override stat-set:`,
    `• ${code("!check insight irl")} or ${code("!check insight ingame")}`,
    ``,
    `Multiple checks:`,
    `• ${code("!check insight; intimidation; str ingame")}`,
  ].join("\n");
}

function charHelp(): string {
  return [
    `📜 **Character Help**`,
    ``,
    `Set proficiency bonus:`,
    `• ${code("!char set pb 3")}`,
    ``,
    `Set ability scores (per stat-set):`,
    `• ${code("!char set ability str irl 16")}`,
    `• ${code("!char set ability cha ingame 18")}`,
    `• Bulk: ${code("!char set abilities irl str 16 dex 14 con 12")}`,
    ``,
    `Choose active stat-set:`,
    `• ${code("!char use irl")} or ${code("!char use ingame")}`,
    ``,
    `Set skill proficiency:`,
    `• ${code("!char prof skill insight")} (proficient)`,
    `• ${code("!char prof skill intimidation exp")} (expertise)`,
    `• ${code("!char prof skill stealth none")} (remove)`,
    ``,
    `Class & caster type:`,
    `• ${code("!char set class Wizard")}`,
    `• ${code("!char set caster full")} / ${code("half")} / ${code("none")}`,
    ``,
    `HP & temp HP:`,
    `• ${code("!char set hp 30")} / ${code("!char set maxhp 30")}`,
    `• ${code("!char set hd 8")} (hit die size, e.g. d8)`,
    `• ${code("!char set temphp 10")} (temp HP, absorbed before regular HP)`,
    `• ${code("!char adjust hp -5")} (damage) / ${code("!char adjust hp 3")} (heal)`,
    ``,
    `Saving throw proficiencies:`,
    `• ${code("!char prof save con")} (proficient)`,
    `• ${code("!char prof save con none")} (remove)`,
    ``,
    `Spell slots (current / max per level):`,
    `• ${code("!char set maxslot 1 4")} — set level 1 max to 4`,
    `• ${code("!char set slot 1 3")} — set level 1 current to 3`,
    ``,
    `View / reset sheet:`,
    `• ${code("!sheet")} / ${code("!sheet @user")}`,
    `• ${code("!sheet reset")} — wipe your sheet back to default`,
    `• ${code("!sheet reset @user")} — DM only`,
    ``,
    `DMs can append ${code("@user")} to any of these to target a player's sheet.`,
  ].join("\n");
}

function dmHelp(): string {
  return [
    `🎲 **DM Help**`,
    ``,
    `First-run setup:`,
    `• ${code("!dm claim")} — become the DM if none exist yet`,
    ``,
    `Manage DMs:`,
    `• ${code("!dm add @user")}`,
    `• ${code("!dm remove @user")}`,
    `• ${code("!dm list")}`,
    ``,
    `DMs can target any player's sheet by appending ${code("@user")}:`,
    `• ${code("!char set ability str irl 16 @user")}`,
    `• ${code("!char set pb 4 @user")}`,
    `• ${code("!char set hp 30 @user")} / ${code("!char adjust hp -5 @user")}`,
    `• ${code("!exp 300 @user")} — award experience`,
    `• ${code("!inv add Sword of Fire @user")}`,
    `• ${code("!inv clear @user")}`,
    ``,
    `Item library (DM only — all players can read):`,
    `• ${code("!lib add longsword 3 15 37 A sturdy longsword.")}`,
    `  (name weight-lbs price-gp color description) — color 37 = mundane, anything else = magic ✨`,
    `• ${code("!lib del longsword")}`,
  ].join("\n");
}

function libHelp(): string {
  return [
    `📚 **Item Library Help**`,
    ``,
    `Look up an item:`,
    `• ${code("!lib check longsword")}`,
    ``,
    `List items:`,
    `• ${code("!lib list")} — all items`,
    `• ${code("!lib list s")} — items starting with "s"`,
    ``,
    `DM only — add / remove:`,
    `• ${code("!lib add longsword 3 15 37 A sturdy longsword.")}`,
    `  Format: ${code("!lib add <name> <weight-lbs> <price-gp> [color] [description]")}`,
    `  Color is an ANSI code (37 = mundane/white). Omit to default to 37.`,
    `• ${code("!lib list magic")} — show only magic (non-white) items`,
    `• ${code("!lib del longsword")}`,
    ``,
    `Items in the library track weight and price.`,
    `When adding a known item to inventory, the bot checks carry capacity (STR × 15 lbs).`,
  ].join("\n");
}

function expHelp(): string {
  return [
    `✨ **Experience & Level Help**`,
    ``,
    `Award or remove experience:`,
    `• ${code("!exp 300")} — give yourself 300 exp`,
    `• ${code("!exp -100")} — remove 100 exp`,
    `• ${code("!exp 300 @user")} — DM awards exp to a player`,
    ``,
    `Leaderboard:`,
    `• ${code("!exprank")} — all party members sorted by exp`,
    ``,
    `The bot automatically detects level-ups and level-downs.`,
    `Level thresholds: 1→2 at 60 exp, 2→3 at 180, 3→4 at 540, …`,
    ``,
    `Level is shown on ${code("!sheet")} whenever exp is set.`,
  ].join("\n");
}

function spellHelp(): string {
  return [
    `🔮 **Spell Help**`,
    ``,
    `Look up any spell:`,
    `• ${code("!spell fireball")} — full spell info from Open5e`,
    ``,
    `Cast a spell (checks known spells if set, rolls damage, deducts slot):`,
    `• ${code("!cast fireball")} — minimum level`,
    `• ${code("!cast fireball 5")} — upcast to level 5`,
    `• ${code("!cast fire bolt")} — cantrip, no slot`,
    `• ${code("!cast blind 2")} — deduct a slot without spell lookup`,
    ``,
    `Manage your known spell list:`,
    `• ${code("!spells")} — view your list`,
    `• ${code("!spells add fireball")} — add a spell`,
    `• ${code("!spells remove fireball")} — remove a spell`,
    `• ${code("!spells clear")} — wipe the list`,
    ``,
    `Spells are imported automatically from D&D Beyond with ${code("!import")}.`,
    `If ${code("knownSpells")} is empty, ${code("!cast")} has no restriction.`,
  ].join("\n");
}

function restHelp(): string {
  return [
    `🌙 **Rest & Casting Help**`,
    ``,
    `Long rest — restores HP to max, refills all spell slots, clears temp HP:`,
    `• ${code("!rest long")}`,
    `• ${code("!rest long @user")} — DM only`,
    ``,
    `Short rest — roll hit dice to recover HP:`,
    `• ${code("!rest short")} — spend 1 hit die`,
    `• ${code("!rest short 3")} — spend 3 hit dice`,
    `• Requires hit die to be set: ${code("!char set hd 8")}`,
    ``,
    `Cast a spell (looks up the spell, rolls damage, deducts slot):`,
    `• ${code("!cast fireball")} — cast at minimum level`,
    `• ${code("!cast fireball 5")} — upcast to level 5`,
    `• ${code("!cast fire bolt")} — cantrip, no slot consumed`,
    ``,
    `Expend a slot without a spell lookup:`,
    `• ${code("!cast blind 2")} — deduct a level 2 slot`,
    ``,
    `Check remaining slots with ${code("!sheet")}`,
  ].join("\n");
}

function calHelp(): string {
  return [
    `📅 **Calendar Help**`,
    ``,
    `View the calendar (anyone):`,
    `• ${code("!cal")} — show all events sorted by date`,
    ``,
    `DM only — add / remove events:`,
    `• ${code("!cal add 20260115 Winter Solstice Festival")}`,
    `  Format: ${code("!cal add <YYYYMMDD> <description>")}`,
    `• ${code("!cal del 20260115")} — removes all events on that date`,
    ``,
    `Dates use in-game calendar dates, not real dates.`,
  ].join("\n");
}

function invHelp(): string {
  return [
    `🎒 **Inventory Help**`,
    ``,
    `View inventory:`,
    `• ${code("!inv")} — your own`,
    `• ${code("!inv @user")} — anyone's`,
    ``,
    `Add / remove items (your own, or DM targeting any player):`,
    `• ${code("!inv add Sword of Fire")} — adds 1`,
    `• ${code("!inv add Arrows 20")} — adds 20`,
    `• ${code("!inv add Arrows 20; Rations 5; Rope")} — add multiple at once`,
    `• ${code("!inv add Potion of Healing @user")}`,
    `• ${code("!inv remove Arrows 5")} — removes 5`,
    `• ${code("!inv remove Sword of Fire")} — removes all`,
    `• ${code("!inv remove Potion of Healing @user")}`,
    ``,
    `If the item is in the library, the add will be blocked if it exceeds carry capacity (STR × 15 lbs).`,
    ``,
    `Clear all items:`,
    `• ${code("!inv clear")} — your own`,
    `• ${code("!inv clear @user")} — DM only`,
  ].join("\n");
}
