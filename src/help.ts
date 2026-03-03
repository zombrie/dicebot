// server/src/help.ts
function code(s: string) {
    return `\`${s}\``;
  }
  
  export function renderHelp(topic?: string): string {
    const t = topic?.toLowerCase().trim();
  
    // Quick topic routing
    if (!t) return generalHelp();
    if (["r", "roll", "dice"].includes(t)) return rollHelp();
    if (["check", "checks"].includes(t)) return checkHelp();
    if (["char", "character", "sheet", "stats"].includes(t)) return charHelp();
  
    return (
      `I don't recognize the help topic ${code(topic!)}.\n` +
      `Try: ${code("!help")} ${code("!help roll")} ${code("!help check")} ${code("!help char")}`
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
      `• ${code("!r 2d20adv+7")} / ${code("!r 2d20dis+7")}`,
      `• Multiple in one message: ${code("!r 1d20+5; 2d6+3")}`,
      ``,
      `**Checks (abilities + skills w/ proficiency)**`,
      `• ${code("!check str")} or ${code("!check strength")}`,
      `• ${code("!check insight")} / ${code("!check intimidation")}`,
      `• Override stat-set: ${code("!check insight b")}`,
      `• Multiple: ${code("!check stealth; perception; str b")}`,
      ``,
      `**Character setup**`,
      `• ${code("!char set pb 3")}`,
      `• ${code("!char set ability str a 16")}`,
      `• ${code("!char use a")} (set active stat-set)`,
      `• ${code("!char prof skill intimidation exp")} (expertise)`,
      `• View sheet: ${code("!sheet")}`,
      ``,
      `More topics: ${code("!help roll")} • ${code("!help check")} • ${code("!help char")}`,
    ].join("\n");
  }
  
  function rollHelp(): string {
    return [
      `🎲 **Roll Help**`,
      ``,
      `Examples:`,
      `• ${code("!r d20")}`,
      `• ${code("!r 2d6+3")}`,
      `• ${code("!r 4d6kh3")} (keep highest 3)`,
      `• ${code("!r 2d20adv+7")} / ${code("!r 2d20dis+7")}`,
      ``,
      `Multiple rolls: separate with ";" or new lines`,
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
      `• ${code("!check insight a")} or ${code("!check insight b")}`,
      ``,
      `Multiple checks:`,
      `• ${code("!check insight; intimidation; str b")}`,
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
      `• ${code("!char set ability str a 16")}`,
      `• ${code("!char set ability cha b 18")}`,
      ``,
      `Choose active stat-set:`,
      `• ${code("!char use a")} or ${code("!char use b")}`,
      ``,
      `Set skill proficiency:`,
      `• ${code("!char prof skill insight")} (proficient)`,
      `• ${code("!char prof skill intimidation exp")} (expertise)`,
      `• ${code("!char prof skill stealth none")} (remove)`,
      ``,
      `View your sheet:`,
      `• ${code("!sheet")}`,
    ].join("\n");
  }