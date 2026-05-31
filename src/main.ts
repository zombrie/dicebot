// Bot entry point: wires the Root SDK message event to the command router.
import { rootServer, ChannelMessageEvent } from "@rootsdk/server-bot";
import type { ChannelMessageCreatedEvent } from "@rootsdk/server-bot";
import { parseTopLevel } from "./commands";
import { renderHelp } from "./help";
import { makeContext } from "./handlers/context";
import { handleRoll, handleCheck } from "./handlers/roll";
import {
  handleCharUse, handleCharSetPB, handleCharSetAbility, handleCharSetAbilities,
  handleCharProfSkill, handleSheet, handleSheetReset, handleCharSetClass,
  handleCharSetCaster, handleCharSetSlot, handleCharSetMaxSlot, handleCharProfSave,
  handleCharSetTempHP, handleCharSetHP, handleCharSetMaxHP, handleCharAdjustHP, handleCharSetHD,
} from "./handlers/char";
import {
  handleInvShow, handleInvAdd, handleInvRemove, handleInvClear,
  handleLibAdd, handleLibDel, handleLibCheck, handleLibList,
} from "./handlers/inventory";
import {
  handleSpellsShow, handleSpellsAdd, handleSpellsRemove, handleSpellsClear,
  handleSpellLookup, handleCast, handleSpellCast, handleRestLong, handleRestShort, handleAttack,
} from "./handlers/spells";
import { handleExpAdd, handleExpRank } from "./handlers/exp";
import {
  handleDMClaim, handleDMAdd, handleDMRemove, handleDMList,
  handleCalShow, handleCalAdd, handleCalDel, handleDDBImport,
} from "./handlers/admin";
import {
  handleNPCCreate, handleNPCList, handleNPCDelete, handleNPCSheet, handleNPCReset,
  handleNPCUse, handleNPCSetPB, handleNPCSetAbility, handleNPCSetAbilities,
  handleNPCProfSkill, handleNPCProfSave, handleNPCSetClass, handleNPCSetCaster,
  handleNPCSetSlot, handleNPCSetMaxSlot, handleNPCSetHP, handleNPCSetMaxHP,
  handleNPCSetTempHP, handleNPCAdjustHP, handleNPCSetHD,
  handleNPCRestLong, handleNPCRestShort, handleNPCExp,
  handleNPCInvShow, handleNPCInvAdd, handleNPCInvRemove, handleNPCInvClear,
  handleNPCCast, handleNPCSpellCast,
  handleNPCSpellsShow, handleNPCSpellsAdd, handleNPCSpellsRemove, handleNPCSpellsClear,
} from "./handlers/npc";

async function handleMessage(evt: ChannelMessageCreatedEvent): Promise<void> {
  const parsed = parseTopLevel(evt.messageContent);
  if (!parsed) return;

  const ctx = await makeContext(evt);

  switch (parsed.kind) {
    case "roll":    return handleRoll(ctx, parsed);
    case "check":   return handleCheck(ctx, parsed);

    case "char_use":           return handleCharUse(ctx, parsed);
    case "char_set_pb":        return handleCharSetPB(ctx, parsed);
    case "char_set_ability":   return handleCharSetAbility(ctx, parsed);
    case "char_set_abilities": return handleCharSetAbilities(ctx, parsed);
    case "char_prof_skill":    return handleCharProfSkill(ctx, parsed);
    case "sheet":              return handleSheet(ctx, parsed);
    case "sheet_reset":        return handleSheetReset(ctx, parsed);
    case "char_set_class":     return handleCharSetClass(ctx, parsed);
    case "char_set_caster":    return handleCharSetCaster(ctx, parsed);
    case "char_set_slot":      return handleCharSetSlot(ctx, parsed);
    case "char_set_maxslot":   return handleCharSetMaxSlot(ctx, parsed);
    case "char_prof_save":     return handleCharProfSave(ctx, parsed);
    case "char_set_temphp":    return handleCharSetTempHP(ctx, parsed);
    case "char_set_hp":        return handleCharSetHP(ctx, parsed);
    case "char_set_maxhp":     return handleCharSetMaxHP(ctx, parsed);
    case "char_adjust_hp":     return handleCharAdjustHP(ctx, parsed);
    case "char_set_hd":        return handleCharSetHD(ctx, parsed);

    case "inv_show":   return handleInvShow(ctx, parsed);
    case "inv_add":    return handleInvAdd(ctx, parsed);
    case "inv_remove": return handleInvRemove(ctx, parsed);
    case "inv_clear":  return handleInvClear(ctx, parsed);
    case "lib_add":    return handleLibAdd(ctx, parsed);
    case "lib_del":    return handleLibDel(ctx, parsed);
    case "lib_check":  return handleLibCheck(ctx, parsed);
    case "lib_list":   return handleLibList(ctx, parsed);

    case "spells_show":   return handleSpellsShow(ctx, parsed);
    case "spells_add":    return handleSpellsAdd(ctx, parsed);
    case "spells_remove": return handleSpellsRemove(ctx, parsed);
    case "spells_clear":  return handleSpellsClear(ctx, parsed);
    case "spell_lookup":  return handleSpellLookup(ctx, parsed);
    case "cast":          return handleCast(ctx, parsed);
    case "spell_cast":    return handleSpellCast(ctx, parsed);
    case "rest_long":     return handleRestLong(ctx, parsed);
    case "rest_short":    return handleRestShort(ctx, parsed);
    case "attack":        return handleAttack(ctx, parsed);

    case "exp_add":  return handleExpAdd(ctx, parsed);
    case "exp_rank": return handleExpRank(ctx, parsed);

    case "dm_claim":   return handleDMClaim(ctx, parsed);
    case "dm_add":     return handleDMAdd(ctx, parsed);
    case "dm_remove":  return handleDMRemove(ctx, parsed);
    case "dm_list":    return handleDMList(ctx, parsed);
    case "cal_show":   return handleCalShow(ctx, parsed);
    case "cal_add":    return handleCalAdd(ctx, parsed);
    case "cal_del":    return handleCalDel(ctx, parsed);
    case "ddb_import": return handleDDBImport(ctx, parsed);

    case "help": return ctx.reply(renderHelp(parsed.topic));

    case "npc_create":       return handleNPCCreate(ctx, parsed);
    case "npc_list":         return handleNPCList(ctx, parsed);
    case "npc_delete":       return handleNPCDelete(ctx, parsed);
    case "npc_sheet":        return handleNPCSheet(ctx, parsed);
    case "npc_reset":        return handleNPCReset(ctx, parsed);
    case "npc_use":          return handleNPCUse(ctx, parsed);
    case "npc_set_pb":       return handleNPCSetPB(ctx, parsed);
    case "npc_set_ability":  return handleNPCSetAbility(ctx, parsed);
    case "npc_set_abilities": return handleNPCSetAbilities(ctx, parsed);
    case "npc_prof_skill":   return handleNPCProfSkill(ctx, parsed);
    case "npc_prof_save":    return handleNPCProfSave(ctx, parsed);
    case "npc_set_class":    return handleNPCSetClass(ctx, parsed);
    case "npc_set_caster":   return handleNPCSetCaster(ctx, parsed);
    case "npc_set_slot":     return handleNPCSetSlot(ctx, parsed);
    case "npc_set_maxslot":  return handleNPCSetMaxSlot(ctx, parsed);
    case "npc_set_hp":       return handleNPCSetHP(ctx, parsed);
    case "npc_set_maxhp":    return handleNPCSetMaxHP(ctx, parsed);
    case "npc_set_temphp":   return handleNPCSetTempHP(ctx, parsed);
    case "npc_adjust_hp":    return handleNPCAdjustHP(ctx, parsed);
    case "npc_set_hd":       return handleNPCSetHD(ctx, parsed);
    case "npc_rest_long":    return handleNPCRestLong(ctx, parsed);
    case "npc_rest_short":   return handleNPCRestShort(ctx, parsed);
    case "npc_exp":          return handleNPCExp(ctx, parsed);
    case "npc_inv_show":     return handleNPCInvShow(ctx, parsed);
    case "npc_inv_add":      return handleNPCInvAdd(ctx, parsed);
    case "npc_inv_remove":   return handleNPCInvRemove(ctx, parsed);
    case "npc_inv_clear":    return handleNPCInvClear(ctx, parsed);
    case "npc_cast":         return handleNPCCast(ctx, parsed);
    case "npc_spell_cast":   return handleNPCSpellCast(ctx, parsed);
    case "npc_spells_show":  return handleNPCSpellsShow(ctx, parsed);
    case "npc_spells_add":   return handleNPCSpellsAdd(ctx, parsed);
    case "npc_spells_remove": return handleNPCSpellsRemove(ctx, parsed);
    case "npc_spells_clear": return handleNPCSpellsClear(ctx, parsed);

    default: parsed satisfies never;
  }
}

(async () => {
  rootServer.community.channelMessages.on(ChannelMessageEvent.ChannelMessageCreated, handleMessage);
  await rootServer.lifecycle.start();
})();
