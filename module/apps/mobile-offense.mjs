import { completeCharacterTarget } from "./character-target.mjs";
import { mobileOffensePlan } from "../rules/mobile-offense.mjs";
import { expertiseCombatContext } from "./combat-expertise.mjs";
import { standardAttackContextContent } from "./standard-attack-context.mjs";
import { finalAttackOptions, finalWeaponReady, limitedFinalAttack } from "./final-attack.mjs";
import { loc } from "../i18n.mjs";
import { formDialog, raw } from "./dialog-kit.mjs";
const number = v => (typeof v === "number" ? v : typeof v === "string" && v.trim() ? Number(v) : NaN);
export async function takeMobileOffense(actor, options = {}) {
  if (actor.type !== "agent" || !actor.isOwner) return null;
  finalAttackOptions(options);
  const clock = JSON.stringify(expertiseCombatContext(actor));
  let input = options;
  if (!Object.hasOwn(input, "moveConfirmed")) {
    const esc = foundry.utils.escapeHTML,
      weapons = actor.items
        .filter(i => i.type === "weapon")
        .map(i => `<option value="${esc(i.id)}">${esc(i.name)}</option>`)
        .join("");
    input = await formDialog({
      title: loc`Mobile Offense during Standard Move`,
      intro: loc`Once per round, take one free final Standard Attack at any point during a legal Standard Move. This control does not take a move or move tokens. The GC confirms the action is actually in progress, its full counted route and the attack point. A legal Standard Move granted by another ability may occur outside own Count.`,
      fields: [
        {
          text: "offCountMoveSource",
          label: loc`Source allowing Standard Move outside own Count (if applicable)`,
          maxlength: 300
        },
        {
          select: "movementKind",
          label: loc`Move source`,
          options: [
            ["standardMove", loc`Standard Move already being taken`],
            ["totalDefense", loc`Included Standard Move in already recorded Total Defense`]
          ]
        },
        {
          number: "moveDistanceFeet",
          label: loc`Full counted move distance (terrain/diagonals included, ft.)`,
          min: "0",
          step: "any",
          required: true
        },
        {
          number: "attackAtFeet",
          label: loc`Attack point along that counted move (ft. from start)`,
          min: "0",
          step: "any",
          required: true
        },
        {
          check: "adjacentThreateningOpponent",
          label: loc`The Standard Move starts adjacent to a threatening opponent`
        },
        {
          check: "passesThreateningAdjacency",
          label: loc`The route continues after entering new threatening adjacency`
        },
        {
          check: "routeConfirmed",
          label: loc`The GC confirms counted distance, terrain, route and threatening opponents`
        },
        { select: "weaponId", label: loc`Your readied weapon`, optionsHtml: raw(weapons) },
        raw(standardAttackContextContent(actor)),
        {
          check: "moveConfirmed",
          label: loc`A legal Standard Move is actually in progress and this final attack occurs at the declared point against its actual target now`
        },
        {
          note: loc`Set Single-Shot mode beforehand. No adjustments or other action combinations. Other class attack controls may be used with GC review of the Mobile Offense counter.`
        }
      ]
    });
    if (!input) return null;
  }
  const movement = {
      ...input,
      moveDistanceFeet: number(input.moveDistanceFeet),
      attackAtFeet: number(input.attackAtFeet)
    },
    plan = mobileOffensePlan(actor.system, expertiseCombatContext(actor), movement),
    opts = await completeCharacterTarget(actor, actor.items.get(input.weaponId)?.system, finalAttackOptions(input)),
    item = actor.items.get(input.weaponId);
  if (!opts) return null;
  if (JSON.stringify(expertiseCombatContext(actor)) !== clock)
    throw new Error(loc`The Initiative Count changed. Review the actual move and attack point again.`);
  if (!finalWeaponReady(item)) throw new Error(loc`Choose an owned readied weapon.`);
  const preview = actor.weaponAttack(item, opts);
  if (
    (preview.ranged && !Number.isFinite(opts.distanceFeet)) ||
    preview.blocked ||
    (preview.firearm && preview.fireMode !== "single")
  )
    throw new Error(
      preview.reason || loc`A ranged final Standard Attack requires measured target distance and Single-Shot mode.`
    );
  const signature = JSON.stringify(preview),
    receipt = { ...plan, id: foundry.utils.randomID(), weaponId: item.id, weaponUuid: item.uuid };
  return limitedFinalAttack(actor, "mobileOffense", {
    weaponId: input.weaponId,
    options: opts,
    receipt,
    check() {
      if (!actor.isOwner || JSON.stringify(expertiseCombatContext(actor)) !== clock)
        throw new Error(loc`The move’s Count or ownership changed.`);
    },
    changed() {
      const fresh = mobileOffensePlan(actor.system, expertiseCombatContext(actor), movement),
        w = actor.items.get(input.weaponId);
      return (
        JSON.stringify(fresh) !== JSON.stringify(plan) ||
        !finalWeaponReady(w) ||
        JSON.stringify(actor.weaponAttack(w, opts)) !== signature
      );
    },
    changedMessage: loc`The actual move, attack point, weapon or reserved use changed. Review it again.`
  });
}
