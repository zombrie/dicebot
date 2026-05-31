# Manual Testing Guide

End-to-end verification steps for the live dev host. Run these after any significant change or before a session. Unit tests cover pure logic; these steps cover the network layer, SDK integration, and anything that requires real state.

**Prerequisites:** two accounts — one DM, one player. Run `!dm claim` as the DM account if the server is fresh.

---

## 0. Help sanity check

```
!help
!help char
!help rest
!help lib
!help npc
```

- [ ] All topics render without errors
- [ ] `!help` shows the D&D Beyond import blurb
- [ ] `!help rest` covers `!rest long`, `!rest short`, `!cast <spell>`, and `!cast blind`
- [ ] `!help npc` lists create/list/delete, sheet ops, stat commands, rests, and inventory

---

## 1. D&D Beyond import

Highest-risk area — hits a live external API and parses real character data.

### Happy path

```
!import https://www.dndbeyond.com/characters/YOUR_ID
```

Expected: an immediate "⏳ Fetching…" reply, then a summary with name, class, level, HP, PB, and spell slot counts.

```
!sheet
```

Cross-reference against the actual D&D Beyond sheet:

- [ ] All six ability scores match (ingame form)
- [ ] Class name and caster type correct
- [ ] Max HP matches
- [ ] PB matches the character's level
- [ ] Skill proficiencies — spot-check 2–3
- [ ] Saving throw proficiencies — spot-check class saves
- [ ] Spell slots per level are correct
- [ ] Level is correct (especially for milestone campaigns where DDB XP is 0)

After import, check known spells:

```
!spells
```

- [ ] List is non-empty and contains spells matching the character's DDB spell list
- [ ] All names are lowercase

### Import preserves existing data

```
!inv add Test Item
!import YOUR_ID
!inv
```

- [ ] "Test Item" is still in inventory after re-import
- [ ] IRL ability scores are unchanged

### Error handling

```
!import 00000001
```
- [ ] "Character not found" error, not a crash

```
!import notanid
```
- [ ] Bot ignores it silently (no response)

```
!import https://www.dndbeyond.com/characters/PRIVATE_ID
```
- [ ] "Character is private" error with instructions

---

## 2. Dice rolling

```
!r d20
!r 2d6+3
!r d20adv
!r d20dis
!r 4d6kh3
!r d20; 2d6+3
```

- [ ] All produce results in the expected format
- [ ] Multi-roll separates results with bullets

**Regression check** — `!rest` must not be caught by the `!r` parser:

```
!rest long
```

- [ ] Triggers a long rest, does not attempt to roll "est long"

---

## 3. Checks

```
!check str
!check insight
!check con save
!check constitution saving throw
!check stealth; perception; str save ingame
```

- [ ] Ability check: shows `d20 + MOD`
- [ ] Skill check: PB added if proficient, doubled if expertise
- [ ] Saving throw: PB added only if save proficiency is set for that ability
- [ ] Multi-check: all parts resolve, semicolons work
- [ ] `ingame` override: uses ingame form for that roll only

---

## 4. Manual sheet setup

Run through these as a player (no `@user` targeting needed):

```
!char set class Wizard
!char set caster full
!char set pb 3
!char set ability str irl 14
!char set abilities irl str 14 dex 12 con 13 int 16 wis 10 cha 8
!char set hd 6
!char set maxhp 28
!char set hp 20
!char set temphp 5
!char set maxslot 1 4
!char set slot 1 2
!char prof save int
!char prof save wis
!char prof skill arcana exp
!sheet
```

- [ ] Class and caster type appear
- [ ] HP shows `20 / 28 +5 temp`
- [ ] Spell slots show `L1: 2/4`
- [ ] Save proficiencies list INT and WIS
- [ ] Arcana shows `(EXP)`
- [ ] IRL form shows the bulk-set scores

---

## 5. Experience and level-up automation

Set up a low-level state first so the level-up is cheap to trigger:

```
!char set hd 8
!char set caster full
!char set maxhp 10
!char set hp 10
!exp 60
```

Expected: level-up message mentioning level 2, HP change, and "spell slots updated".

```
!sheet
```

- [ ] Level shows as 2
- [ ] Max HP increased by `8 + CON mod`
- [ ] Current HP increased by the same amount
- [ ] Spell slots updated to the level 2 full-caster row (3 first-level slots)
- [ ] PB still 2 (no change until level 5)

**PB bump — cross levels 4→5:**

```
!exp 760
```

- [ ] "PB now +3" in the level-up details

**Level-down:**

```
!exp -1000
```

- [ ] "Dropped to level X" with negative HP and slot changes reported

**Milestone campaign edge case:**

Import a character whose D&D Beyond XP is 0, then run `!exprank`.

- [ ] Their level shows correctly (not level 1)

---

## 6. Rests and casting

### Damage and temp HP absorption

```
!char set temphp 5
!char adjust hp -8
```

- [ ] Message says "3 absorbed by temp HP"
- [ ] Temp HP cleared, regular HP reduced by remaining 3

### Long rest

```
!rest long
```

- [ ] HP restored to max
- [ ] Temp HP cleared (if any)
- [ ] Spell slots back to max
- [ ] Message lists each thing that was restored

### Spell casting

```
!cast fireball
!sheet
```

- [ ] Level 3 slot decremented by 1
- [ ] Output shows attack roll, 8d6 fire damage total, DEX save note

```
!cast fireball 5
```

- [ ] Level 5 slot decremented
- [ ] Damage reflects upcasted value if available, or notes base damage with upcasting reminder

```
!cast fire bolt
!sheet
```

- [ ] No slot consumed (cantrip)
- [ ] Damage rolled (1d10 fire)

```
!cast cure wounds
!sheet
```

- [ ] Level 1 slot consumed
- [ ] No damage roll in output — notes to check spell description

Exhaust all level 1 slots, then:

```
!cast cure wounds
```

- [ ] "No level 1 spell slots remaining!" error

Known spells enforcement:

```
!cast sleep
```

- [ ] If "sleep" is not in your known spells list, blocked with a helpful error and suggestion to `!spells add`
- [ ] If known spells list is empty, cast proceeds normally (no restriction)

Blind slot deduction (bypasses known spells check):

```
!cast blind 2
!sheet
```

- [ ] Level 2 slot decremented, no spell info shown, no known spells check performed

### Short rest

```
!char adjust hp -10
!rest short
```

- [ ] Reports the die roll and CON modifier
- [ ] HP increases (capped at max)
- [ ] Roll format: `d8(5) + CON(+2)×1 = +7 HP`

```
!rest short 2
```

- [ ] Rolls two dice, adds CON mod twice, shows both rolls

### Known spells management

```
!spells
```

- [ ] Shows the spell list (populated after `!import`)

```
!spells add misty step
!spells
```

- [ ] "misty step" appears in the list (lowercase)

```
!spells remove misty step
!spells
```

- [ ] "misty step" removed from list

```
!spells remove notaspell
```

- [ ] "not found in your known spells" error

```
!spells clear
!spells
```

- [ ] List is empty; `!cast` no longer restricted

---

### Weapon attacks

Add a weapon to inventory first:

```
!inv add longsword
!attack longsword
```

- [ ] Output shows weapon name, attack roll with STR mod + PB, damage roll
- [ ] Damage type shown (slashing)

```
!attack longsword adv
```

- [ ] Two d20 values shown, higher one used

```
!attack longsword dis
```

- [ ] Two d20 values shown, lower one used

Ranged weapon — uses DEX:

```
!inv add crossbow
!attack crossbow
```

- [ ] DEX modifier used (not STR)
- [ ] Range shown in output (e.g. 80/320 ft)

Weapon not in inventory:

```
!attack dagger
```

- [ ] "dagger is not in your inventory" error

Weapon not in Open5e database:

```
!inv add HombrewSword
!attack HombrewSword
```

- [ ] Helpful error suggesting `!r` for manual rolls

---

## 7. Inventory and item library

### Library setup (DM account)

Single-item add:

```
!lib add longsword 3 15 37 A standard longsword.
!lib add healingpotion 0.5 50 37 Restores 2d4+2 HP.
!lib add mithral 2 500 35 A shimmering magical blade.
!lib list
!lib list magic
!lib check mithral
```

- [ ] `!lib list magic` shows only mithral (✨ marker)
- [ ] `!lib check` shows weight, price, color code, and description
- [ ] `!lib list` shows all three items

Bulk add:

```
!lib add torch 1 0.01 37 Provides bright light; rope 10 1 37 50 feet of hempen rope; arrows 0.05 0.05 37
!lib list
```

- [ ] All three items appear in library
- [ ] Reply confirms "Added 3 items to library"

### Inventory with weight

```
!inv add longsword 1
!inv add healingpotion 3
!inv
```

- [ ] Weight used / capacity shown (e.g. `4.5 / 120 lbs`)
- [ ] Per-item weights listed
- [ ] mithral would show ✨ if added

### Carry capacity enforcement

Set STR low enough that a big add gets blocked:

```
!char set ability str ingame 8
!inv add longsword 50
```

- [ ] Add blocked with message showing max addable quantity
- [ ] Inventory unchanged

### Quantity tracking

```
!inv add healingpotion 3
!inv remove healingpotion 1
!inv
```

- [ ] Count is correct after add and partial remove

```
!inv remove healingpotion 999
!inv
```

- [ ] All healing potions removed (quantity floored at 0, key deleted)

### Bulk add

```
!inv add longsword 1; healingpotion 3; rope
!inv
```

- [ ] All three items appear in inventory
- [ ] Quantities correct (1 longsword, 3 potions, 1 rope)
- [ ] Single reply listing all added items

Bulk weight check — if any item in the batch would push over capacity, the whole add is blocked:

```
!char set ability str ingame 8
!inv add longsword 50; mithral 1
```

- [ ] Entire batch blocked with capacity message
- [ ] Neither item added

---

## 8. Sheet reset

```
!sheet reset
!sheet
```

- [ ] Sheet shows default values (all 10s, PB 2, no class, empty inventory)

DM reset of another player's sheet:

```
!sheet reset @player
```

- [ ] Player's sheet wiped, message names the target

Non-DM targeting another player:

```
# from player account
!sheet reset @dm
```

- [ ] "Only a DM can modify another player's sheet" error

---

## 9. Spell lookup

```
!spell fireball
```

- [ ] Returns spell card with name, level, school
- [ ] Shows casting time as "1 action" (not raw "action")
- [ ] Shows range, duration, components
- [ ] Shows damage (8d6 fire) and save (DEXTERITY)
- [ ] Description present
- [ ] "At Higher Levels" section present

```
!spell cure wounds
```

- [ ] No damage line (healing spell)
- [ ] Shows V, S components, no M

```
!spell mage armor
```

- [ ] Duration shows correctly (8 hours)
- [ ] M component shown with material description

Partial match fallback:

```
!spell healing word
```

- [ ] Finds the correct spell (not a partial match artifact)

Unknown spell:

```
!spell xyzzy
```

- [ ] Error: "No spell found matching..."

---

## 10. Calendar

```
!cal add 20260115 Winter Solstice Festival
!cal add 20260601 Battle of Thornwood
!cal add 20260115 Second event same day
!cal
```

- [ ] Events sorted by date (January before June)
- [ ] Both January 15th events appear
- [ ] Date format: "Thursday January 15th, 2026"

```
!cal del 20260115
!cal
```

- [ ] Both January 15th events removed
- [ ] June event remains

---

## 11. Exp leaderboard

Ensure at least two players have sheets saved, then:

```
!exprank
```

- [ ] All party members listed
- [ ] Sorted highest exp first
- [ ] Level shown correctly for each player

---

## 12. DM targeting

From the DM account:

```
!char set ability str ingame 18 @player
!exp 500 @player
!inv add Flame Tongue Sword @player
!sheet @player
```

- [ ] All three commands succeed
- [ ] `!sheet @player` reflects all three changes

From the player account:

```
!char set ability str ingame 18 @dm
```

- [ ] "Only a DM can modify another player's sheet" error

---

## 13. NPC sheets

**Prerequisites:** DM account. Use a multi-word NPC name to exercise the name-parsing logic.

### Roster management

```
!npc create Brother Aldric
!npc list
```

- [ ] Confirmed creation message
- [ ] `!npc list` shows "Brother Aldric"

Duplicate create:

```
!npc create Brother Aldric
```

- [ ] "already exists" error, not a second entry in the list

Non-DM attempt:

```
# from player account
!npc create Test NPC
```

- [ ] "Only a DM can manage NPC sheets" error

### Stat setup and sheet view

```
!npc Brother Aldric set class Paladin
!npc Brother Aldric set caster half
!npc Brother Aldric set hd 10
!npc Brother Aldric set maxhp 55
!npc Brother Aldric set hp 55
!npc Brother Aldric set pb 3
!npc Brother Aldric set ability str ingame 18
!npc Brother Aldric set abilities ingame str 18 dex 10 con 16 int 8 wis 12 cha 14
!npc Brother Aldric prof skill Athletics
!npc Brother Aldric prof save str
!npc Brother Aldric prof save cha
!npc Brother Aldric sheet
```

- [ ] Sheet displays name, class, PB, HP, ability scores
- [ ] Athletics shows as proficient; STR and CHA shows in save proficiencies
- [ ] Half-caster label appears on class line

### HP and damage

```
!npc Brother Aldric set temphp 8
!npc Brother Aldric adjust hp -12
```

- [ ] Message says 8 absorbed by temp HP, regular HP reduced by 4

```
!npc Brother Aldric adjust hp 10
```

- [ ] HP increases (capped at max)

### Rests

```
!npc Brother Aldric set maxslot 1 4
!npc Brother Aldric set maxslot 2 2
!npc Brother Aldric cast cure wounds
!npc Brother Aldric rest long
!npc Brother Aldric sheet
```

- [ ] Slot decremented by cast
- [ ] Long rest restores HP to max, slots to max, clears temp HP
- [ ] Sheet confirms

```
!npc Brother Aldric adjust hp -20
!npc Brother Aldric rest short 2
```

- [ ] Reports two hit die rolls + CON modifier, HP increased

### Inventory

```
!npc Brother Aldric inv add Longsword
!npc Brother Aldric inv add Rations 5; Torch
!npc Brother Aldric inv
```

- [ ] Inventory shows all three items with correct quantities

```
!npc Brother Aldric inv remove Rations 2
!npc Brother Aldric inv
```

- [ ] Rations count is 3

### Experience and level-up

```
!npc Brother Aldric exp 60
```

- [ ] Level-up message fires (level 2), PB and HP changes noted

```
!exprank
```

- [ ] Brother Aldric does **not** appear in the leaderboard

### Spells

```
!npc Brother Aldric spells add cure wounds
!npc Brother Aldric spells add bless
!npc Brother Aldric spells
!npc Brother Aldric cast cure wounds
!npc Brother Aldric spells remove bless
!npc Brother Aldric spells
```

- [ ] Known spells list reflects adds and remove
- [ ] Cast succeeds and deducts slot
- [ ] After remove, bless is gone from the list

Casting a spell not in known list (when list is non-empty):

```
!npc Brother Aldric cast fireball
```

- [ ] Blocked with helpful error referencing `!npc Brother Aldric spells add fireball`

### Delete

```
!npc delete Brother Aldric
!npc list
!npc Brother Aldric sheet
```

- [ ] List is empty (or no longer shows Brother Aldric)
- [ ] Sheet command returns "not found" error

---

## 14. Known limitations and failure modes

These are the areas most likely to surface issues in a live environment. They are not bugs to fix now — just things to be aware of.

**DDB import: ability score edge cases.** Unusual feat interactions or racial "choose your bonus" options (e.g. Half-Elf's two free +1s assigned in the UI) may not parse correctly, since the resolved choice isn't always in the modifiers the bot reads. If scores are off by 1–2 points, correct manually with `!char set ability`.

**DDB import: Warlock spell slots.** Warlocks use Pact Magic — they get a small number of slots that all refresh on short rest, not the standard full-caster table. The bot will assign the standard Wizard-style slot progression instead, which is wrong. Fix manually with `!char set maxslot` after importing a Warlock.

**Level-up HP math requires hit die to be configured.** If `!exp` triggers a level-up before `!char set hd` has been run, HP won't auto-update. Set the hit die and adjust HP manually to catch up.

**Long rest requires max values to be set.** If `maxHp` or `maxSpellSlots` were never configured (e.g. no import, no manual setup), `!rest long` silently skips restoring those fields.

**D&D Beyond API changes.** The character service endpoint is unofficial and undocumented. If an import fails with an unexpected error (not a 404 or 403), the response shape may have changed. Check the error message and report it.
