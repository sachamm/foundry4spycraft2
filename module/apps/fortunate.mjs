/** Fortunate on the Main tab: the GC grants the requested d4 and its match (see module/rules/fortunate.mjs). */
import { fortunatePool, fortunateMatchNote, FORTUNATE_MATCH } from "../rules/fortunate.mjs";
import { adjustGCDice, gcDiceStatus } from "../services/gc-dice.mjs";
import { restraintActionBlock } from "../rules/restraints.mjs";
import { loc } from "../i18n.mjs";

export async function grantFortunate(actor, options = {}) {
  if (!game.user?.isGM) throw new Error(loc`The GC grants a Fortunate die when the player asks for it.`);
  let input = options;
  if (!Object.hasOwn(input, "match")) {
    input = await foundry.applications.api.DialogV2.input({
      window: { title: loc`Fortunate` },
      rejectClose: false,
      content: `<div class="spycraft2-roll-options"><p>${loc`${foundry.utils.escapeHTML(actor.name)} takes 1 bonus d4 action die as a free action; it expires at the end of the scene if unspent. The GC also gains 1 d4 action die, or hands it to an opponent of their choosing (p.189).`}</p><label>${loc`Matching die goes to`} <select name="match"><option value="gc">${loc`The GC’s pool`}</option><option value="opponent">${loc`An opponent`}</option></select></label><label>${loc`Opponent (if chosen)`} <input name="opponentName" maxlength="200" /></label></div>`
    });
    if (!input) return null;
  }
  if (!FORTUNATE_MATCH.includes(input.match)) throw new Error(loc`Choose who gains the matching die.`);
  const opponentName = typeof input.opponentName === "string" ? input.opponentName.trim().slice(0, 200) : "";
  if (input.match === "gc" && !gcDiceStatus().current)
    throw new Error(loc`Initialize the GC pool for this session first.`);
  const blocked = restraintActionBlock(actor.system, { free: true });
  if (blocked) throw new Error(blocked);
  return actor.useLimitedAbility(
    "fortunate",
    async () => {
      const id = foundry.utils.randomID(),
        pool = fortunatePool(
          { ...actor.system, ...(actor.attributeRuleContext ?? {}) },
          { id, periods: actor.usagePeriods }
        );
      await actor.update({ ["system.bonusActionDice." + id]: pool });
      let matchNote = fortunateMatchNote(input.match, opponentName);
      if (input.match === "gc")
        try {
          await adjustGCDice(1, loc`Fortunate: ${actor.name}`);
        } catch (error) {
          matchNote = loc`The GC’s matching d4 could not be added (${error.message}); add it from the GC dice console.`;
          ui.notifications.warn(matchNote);
        }
      await ChatMessage.create({
        speaker: ChatMessage.getSpeaker({ actor }),
        content: loc`Fortunate: ${foundry.utils.escapeHTML(actor.name)} gains ${pool.granted} bonus d${pool.die} action die, lost if unused by the end of the scene. ${foundry.utils.escapeHTML(matchNote)}`,
        flags: {
          spycraft2: {
            actorUuid: actor.uuid,
            checkKind: "fortunate",
            fortunatePoolId: id,
            fortunateMatch: input.match,
            actionDiceAllowed: false
          }
        }
      });
      return pool;
    },
    { workflow: "fortunate" }
  );
}
