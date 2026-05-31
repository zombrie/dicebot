# Dice Bot

A Root community bot for D&D-style play. Handles dice rolling, skill/saving throw checks, full character sheets (ability scores, HP, spell slots, proficiencies, exp/level), per-character inventories backed by a shared item library, an in-game calendar, and an exp leaderboard. A DM permission system controls who can modify other players' sheets.

---

## Setup

```bash
npm install
npm run rebuild   # build + start dev host
```

Requires Node ≥ 22 and a valid `DEV_TOKEN` for the Root SDK.

---

## Commands

### Rolling Dice — `!r`

| Example | Description |
|---------|-------------|
| `!r d20` | Single die |
| `!r 2d6+3` | Multiple dice with modifier |
| `!r 4d6kh3` | Roll 4d6, keep highest 3 |
| `!r 4d6kl3` | Roll 4d6, keep lowest 3 |
| `!r d20adv` | Advantage (2d20, keep highest) |
| `!r d20dis` | Disadvantage (2d20, keep lowest) |
| `!r d20adv+5` | Advantage with modifier |
| `!r d20; 2d6+3` | Multiple rolls (`;` or newline separator) |

Limits: 1–100 dice, 2–1000 sides. Advantage/disadvantage only works on d20.

---

### Ability, Skill & Saving Throw Checks — `!check`

Uses your active stat-set (irl or ingame) by default. Override inline with `irl` or `ingame` at the end.

```
!check str                        # ability check
!check charisma                   # full ability names work
!check insight                    # skill check (adds PB if proficient)
!check intimidation exp           # — (expertise = 2× PB)
!check str save                   # saving throw
!check constitution saving throw  # full form also accepted
!check insight irl                # override stat-set for this roll
!check stealth; perception; con save ingame   # multiple checks, semicolon-separated
```

Saving throw checks apply your proficiency bonus if you have save proficiency in that ability (`!char prof save`).

---

### Character Sheet — `!char` / `!sheet`

Each user has two stat-sets: **irl** (real-life stats) and **ingame** (character stats). Checks use whichever is active.

#### View / reset

```
!sheet            # your own sheet
!sheet @user      # anyone can view anyone's sheet
!sheet reset      # wipe your sheet back to default (clears everything)
!sheet reset @user  ← DM only
```

#### Class & caster type

```
!char set class Wizard
!char set caster full       # full, half, or none
!char set class Paladin @user
!char set caster half @user
```

Caster type determines which spell slot table is used when `!exp` triggers a level-up.

#### Proficiency bonus

```
!char set pb 3
!char set pb 3 @user        ← DM only
```

PB is also updated automatically when `!exp` causes a level change, if you've set your caster type.

#### Ability scores

```
!char set ability str irl 16
!char set ability cha ingame 18
!char set abilities irl str 16 dex 14 con 12 int 10 wis 8 cha 18   # bulk
!char set ability str irl 16 @user                                   # DM only
```

Valid stat-sets: `irl`, `ingame`. Valid range: 1–30.

#### Switch active stat-set

```
!char use irl
!char use ingame
!char use ingame @user      ← DM only
```

#### Skill proficiency

```
!char prof skill insight               # proficient (+PB)
!char prof skill intimidation exp      # expertise (+2×PB)
!char prof skill stealth none          # remove
!char prof skill perception @user      ← DM only
```

#### Saving throw proficiency

```
!char prof save con                    # proficient in CON saves
!char prof save wisdom                 # full ability names work
!char prof save con none               # remove
!char prof save str @user              ← DM only
```

#### HP, hit die & temp HP

```
!char set maxhp 45           # set max HP
!char set hp 30              # set current HP
!char set hd 8               # hit die size (e.g. d8)
!char set temphp 10          # grant temp HP (absorbed before regular HP)

!char adjust hp -8           # take 8 damage (temp HP absorbed first)
!char adjust hp 5            # heal 5 HP
!char adjust hp -8 @user     ← DM only
```

#### Spell slots

```
!char set maxslot 1 4        # set level 1 max to 4 (also initialises current if unset)
!char set maxslot 2 3
!char set slot 1 2           # manually set current level 1 slots to 2
!char set maxslot 3 2 @user  ← DM only
```

Spell slots are auto-updated when `!exp` triggers a level-up (requires caster type to be set).

---

### Experience & Levels — `!exp` / `!exprank`

```
!exp 300                     # award 300 exp to yourself
!exp -100                    # deduct exp
!exp 500 @user               ← DM only — award to a player
!exprank                     # leaderboard: all party members sorted by exp
```

When exp crosses a level threshold, **`!exp` automatically:**
- Updates proficiency bonus (from the standard PB table)
- Adds/subtracts `hitDice + CON mod` HP per level (requires `!char set hd` first)
- Recalculates spell slots from the full/half caster table (requires `!char set caster` first)

Level thresholds (same as the original Python bot):

| Level | EXP | Level | EXP |
|-------|-----|-------|-----|
| 1 | 0 | 11 | 17,000 |
| 2 | 60 | 12 | 20,000 |
| 3 | 180 | 13 | 24,000 |
| 4 | 540 | 14 | 28,000 |
| 5 | 1,300 | 15 | 33,000 |
| 6 | 2,800 | 16 | 38,000 |
| 7 | 4,600 | 17 | 44,000 |
| 8 | 6,800 | 18 | 50,000 |
| 9 | 9,600 | 19 | 57,000 |
| 10 | 12,800 | 20 | 65,525 |

Party members are registered automatically the first time their sheet is saved.

---

### Rests — `!rest`

```
!rest long               # restore HP to max, refill all spell slots, clear temp HP
!rest long @user         ← DM only

!rest short              # spend 1 hit die: roll d(hd) + CON mod, add to HP
!rest short 3            # spend 3 hit dice
!rest short @user        ← DM only
```

`!rest short` requires `!char set hd` to be configured. `!rest long` only restores what's set — if `maxHp` isn't configured, HP is left alone; if `maxSpellSlots` isn't configured, slots are left alone.

---

### Known Spells — `!spells`

Each character has a known spells list. `!cast` enforces it — if the list is populated, you can only cast spells on it. If it's empty, there's no restriction.

The list is populated automatically by `!import`. It can also be managed manually.

```
!spells                  # view your known spell list
!spells add fireball     # add a spell (stored lowercase)
!spells remove fireball  # remove a spell
!spells clear            # wipe the list (useful before re-importing)
```

---

### Casting Spells — `!cast`

Looks up the spell from Open5e, checks your known spells list, rolls damage, and deducts the appropriate slot.

```
!cast fireball           # cast at minimum level (3rd), rolls 8d6, deducts slot
!cast fireball 5         # upcast to 5th level
!cast fire bolt          # cantrip — rolls damage, no slot consumed
!cast cure wounds        # deducts slot, no damage roll (healing — check description)

!cast blind 2            # deduct a level 2 slot with no spell lookup (bypasses known spells check)
```

If Open5e has explicit damage values for a higher slot level (via `casting_options`), those are used. Otherwise the base damage roll is used and the output notes to check `!spell <name>` for the upcasting details.

---

### Weapon Attacks — `!attack`

Checks the character's inventory for the weapon, looks it up in Open5e for stats, rolls the attack and damage.

```
!attack longsword        # melee attack — uses STR
!attack rapier           # finesse — uses whichever of STR/DEX is higher
!attack crossbow         # ranged — uses DEX, shows range
!atk longsword           # shorter alias

!attack longsword adv    # with advantage
!attack longsword dis    # with disadvantage
!attack longsword advantage    # full keyword also works
```

Proficiency bonus is always added. The command errors if the weapon is not in inventory.

---

### Inventory — `!inv`

```
!inv                           # your inventory (shows weight used/capacity)
!inv @user                     # view anyone's inventory

!inv add Sword of Fire         # add 1 item
!inv add Arrows 20             # add 20 (trailing integer = quantity)
!inv add Arrows 20; Rations 5; Rope   # add multiple items at once (semicolon-separated)
!inv add Rations 5 @user       ← DM only

!inv remove Arrows 5           # remove 5
!inv remove Sword of Fire      # remove all of that item
!inv remove Rations @user      ← DM only

!inv clear                     # clear your inventory
!inv clear @user               ← DM only
```

**Weight & carrying capacity:** If the item is in the library, adding it checks carrying capacity (STR × 15 lbs). If adding would exceed capacity, the add is blocked and the max addable quantity is reported. `!inv` shows per-item weights and used/capacity when library data is available.

**Magic items** appear with a ✨ marker in `!inv` if their color code is set to anything other than 37 in the library.

---

### Item Library — `!lib`

A shared library of items with weight, price, description, and color (magic marker). Anyone can look up items; only DMs can add or remove them.

```
!lib check longsword           # show weight, price, description, color
!lib list                      # list all items
!lib list s                    # list items starting with "s"
!lib list magic                # list only magic (non-white) items

# DM only:
!lib add longsword 3 15 37 A sturdy longsword.
#          name   wt  gp  color  description
!lib add mithral 2 500 35 A shimmering magical blade.
!lib add longsword 3 15 37 A blade; dagger 1 5 37; torch 1 0.01   # bulk add (semicolons)
!lib del longsword
```

**Color codes** are ANSI integers. `37` = white (mundane). Anything else = magic (✨). Common codes: 35 = magenta, 36 = cyan, 33 = yellow. Color is cosmetic metadata — it powers the `!lib list magic` filter.

**Item names are single-word** for library entries (no spaces). Inventory items can have multi-word names; they just won't have library data for weight checking.

---

### D&D Beyond Import — `!import`

Imports a public D&D Beyond character directly into the bot. Accepts a bare character ID or the full URL.

```
!import 12345678
!import https://www.dndbeyond.com/characters/12345678
!import 12345678 @user     ← DM only
```

**What gets imported:** ingame ability scores (base + racial/ASI bonuses), class name, caster type, hit die, max HP, current HP, temp HP, proficiency bonus, skill proficiencies (including expertise), saving throw proficiencies, spell slots (set to max — D&D Beyond doesn't track current slots server-side), known spells list, and EXP.

**What is preserved:** your irl form, inventory, and active stat-set.

Re-importing after a level-up on D&D Beyond will update all mechanical fields without touching inventory or irl stats.

**Requirements:** the character must be set to **public** on D&D Beyond (Privacy → Public). Private characters will return a 403 error.

**Milestone leveling:** if `currentXp` is 0 on the character (campaign uses milestone advancement rather than XP), the bot floors EXP to the minimum for the character's actual class level so `!exprank` and `!sheet` display the right level.

---

### Spell Lookup — `!spell`

Look up any D&D 5e spell from the Open5e database (1,900+ spells, no auth required).

```
!spell fireball
!spell cure wounds
!spell counterspell
```

Returns: spell level, school, ritual/concentration tags, casting time, range, duration, components (with material description), damage roll and type, saving throw, description, and upcasting info.

Exact name matches are tried first; partial matches are used as a fallback (e.g. `!spell fire` will find Fireball). Case-insensitive.

---

### Calendar — `!cal`

An in-game calendar of events, sorted by date.

```
!cal                                           # view all events
!cal add 20260115 Winter Solstice Festival     # DM only (YYYYMMDD)
!cal del 20260115                              # DM only — removes all events on that date
```

Dates display as `Thursday January 15th, 2026`. Multiple events on the same date are all shown; `!cal del` removes all events on that date.

---

### DM Management — `!dm`

```
!dm claim           # become the DM if none exist yet (anyone; first-come, first-served)
!dm list            # anyone can see who the DMs are
!dm add @user       ← DM only
!dm remove @user    ← DM only
```

Once a DM exists, `!dm claim` is locked. Ask an existing DM to add you with `!dm add`.

---

### Help — `!help`

```
!help               # general overview
!help roll
!help check
!help char
!help dm
!help inv
!help lib
!help exp
!help cal
!help rest
```

---

## Permission Model

| Action | Who |
|--------|-----|
| Roll dice | Anyone |
| `!check`, `!sheet`, `!inv`, `!lib check/list`, `!cal`, `!exprank`, `!spell`, `!spells` | Anyone |
| Modify **your own** sheet / inventory / rest / cast / import | Anyone |
| Modify **another player's** sheet / inventory | DM only |
| `!import @user` | DM only |
| `!lib add`, `!lib del` | DM only |
| `!cal add`, `!cal del` | DM only |
| `!dm add`, `!dm remove` | DM only |
| `!dm claim` | Anyone (only if no DMs exist) |

The `@user` suffix on any `!char`, `!inv`, `!exp`, `!rest`, or `!import` command targets that user. Non-DMs targeting someone else get an error. `!cast` and `!attack` always apply to the sender's own sheet.

---

## Sheet Data Reference

Everything stored on a character sheet:

| Field | Set with | Notes |
|-------|----------|-------|
| Ability scores (×12) | `!char set ability/abilities` | 6 abilities × 2 forms (irl/ingame) |
| Active form | `!char use` | `irl` or `ingame` |
| Proficiency bonus | `!char set pb` | Also auto-set by `!exp` level changes |
| Skill proficiencies | `!char prof skill` | Proficient or expertise per skill |
| Save proficiencies | `!char prof save` | Per ability |
| Class | `!char set class` | Label only |
| Caster type | `!char set caster` | `full`, `half`, or `none` |
| HP / max HP | `!char set hp/maxhp`, `!char adjust hp` | |
| Temp HP | `!char set temphp` | Absorbed before regular HP |
| Hit die | `!char set hd` | Die size, e.g. `8` for d8 |
| Spell slots (current) | `!char set slot`, `!cast`, `!cast blind`, `!rest` | Per level 1–9 |
| Spell slots (max) | `!char set maxslot` | Per level 1–9 |
| Known spells | `!spells add/remove/clear`, `!import` | Enforced by `!cast`; empty = no restriction |
| EXP | `!exp`, `!import` | Level derived automatically |
| Inventory | `!inv add/remove/clear` | Item name → quantity |

---

## Gotchas

- **`!exp` auto-updates only work if the sheet is configured.** HP adjustment on level-up requires `!char set hd`. Spell slot adjustment requires `!char set caster`. PB always updates.

- **`!rest long` only restores what exists.** If `maxHp` isn't set, HP is untouched. If `maxSpellSlots` is empty, slots are untouched.

- **Bulk `!inv add` and `!lib add` use `;` as the separator.** Semicolons cannot appear inside item names or descriptions when using bulk mode.

- **Inventory quantities — trailing integer is the quantity.** `!inv add Iron Rations 5` adds 5 Iron Rations. If your item name ends in a number (e.g. "Potion 2"), add a quantity explicitly: `!inv add Potion 2 1` gives you 1× "Potion 2".

- **Item library names are single-word.** `!lib add` treats the first token after the command as the name, so multi-word names aren't supported there. Inventory items can have spaces in their names; they just won't have library data.

- **`!check` uses the active stat-set unless overridden.** Switch with `!char use irl/ingame`; override a single roll with `!check str ingame`.

- **Saving throws use the active stat-set.** `!check con save` rolls CON from whichever form is active. Override inline: `!check con save ingame`.

- **`!dm claim` is first-come, first-served.** After that it's locked. If you're stuck, a DM must be removed via the data store.

- **Old `string[]` inventories are migrated automatically.** If a sheet was saved before the inventory rework, it's converted to `Record<string, number>` on first load.

- **`!import` uses the unofficial D&D Beyond character service API.** It's undocumented and could break if D&D Beyond changes their internals. If an import fails unexpectedly, the error message will say so — you can always set fields manually with `!char set`.

- **`!attack` requires inventory names to match Open5e weapon names.** "longsword", "rapier", "hand crossbow" all work. Custom names like "Ackten's Crossbow" won't be found — add the weapon with its standard name (e.g. "hand crossbow") and use `!r` for any custom modifiers.

- **Known spells from `!import` include all spells in the DDB spell list regardless of prepared status.** For prepared casters (Wizard, Cleric), all spellbook entries are imported — not just today's prepared spells. Re-import to refresh after changing your spell list in DDB.

- **`!import` ability scores may occasionally be off by a point.** Unusual feat interactions or "choose your bonus" racial options that aren't fully resolved in the JSON may not parse correctly. Verify with `!sheet` and correct any outliers with `!char set ability`.

---

## Development

```bash
npm run build       # compile TypeScript → dist/
npm run bot         # start dev host (requires build first)
npm run rebuild     # build + start in one step
npm run clean       # wipe dist/
npm test            # single test run (342 tests)
npm run test:watch  # watch mode
```

### Test coverage

Pure modules with full unit test coverage: `dice`, `skills` (save checks, exp/level tables, caster slot tables), `commands` (all parse rules), `render`, `help`, `mentions`, `dateUtils` (calendar date formatting), `ddbimport` (D&D Beyond JSON parsing and ID extraction), `spellapi` (Open5e spell formatting and damage-at-level logic), `weaponapi` (weapon property detection and ability selection).

SDK-dependent modules (`main`, `sheet`, `dm`, `itemlib`, `calendar`, `party`) and the `ddbimport` network fetch are not unit tested — verify against the dev host.

### Adding a new command

1. Add a variant to `ParsedCommand` in `commands.ts`
2. Add a regex branch in `parseTopLevel` — more specific patterns first. Watch for prefix collisions (e.g. `!r` vs `!rest`)
3. Add a handler block in `main.ts`
4. Add help text in `help.ts`
5. Add parse tests in `src/__tests__/commands.test.ts`
