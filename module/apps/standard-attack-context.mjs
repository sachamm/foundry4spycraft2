import { reachContextContent, reachContextInput } from "./reach.mjs";
import { MELEE_ATTACK_TRICKS } from "../rules/melee-tricks.mjs";
import { CHEAP_SHOT_CHOICES } from "../rules/cheap-shot.mjs";
import {
  characterTargetContent,
  attackCharacterTargetChoices,
  observedAttackTargetContent
} from "./character-target.mjs";
import { AMBIENT_LIGHT, FOG_SMOKE } from "../rules/senses.mjs";
import { rollPipeline } from "../rules/roll-pipeline.mjs";
import { loc } from "../i18n.mjs";
const booleanFields = {
  targetOpponentConfirmed: "This attack targets an opponent (CQB Mastery threat benefit)",
  targetAnimal: "The target is an animal (Game Hunter)",
  targetFlanked: "I am flanking this opponent; position, ready weapon and Reach/CQB requirements are met",
  targetPinnedAdjacent: "The target is pinned and I am adjacent",
  targetCrouchedNonAdjacent: "The target is crouched and I am not adjacent",
  targetProneNonAdjacent: "The target is prone and I am not adjacent",
  targetVulnerable: "The target is vulnerable against this attack",
  targetFlatFooted: "The target is flat-footed against this attack",
  aimed: "Aim was already taken separately and remains valid for this target; the target has not moved more than 5 ft.",
  braced:
    "Brace was already taken separately and remains valid; I have not moved and the target is within the chosen 90° cone",
  stableSurface: "A stable bracing surface is available (unnecessary with Marksmanship Basics)",
  blinded: "Additional blindness applies to this attack",
  deafened: "Additional deafness applies to this attack",
  targetCharacter: "The target is a character (nearby hearing exceptions)"
};
export function meleeFireContextContent(input = {}) {
  return `<fieldset><legend>${loc`Ranged fire and melee`}</legend><label><input name="firingOutOfMelee" type="checkbox"${input.firingOutOfMelee === true ? " checked" : ""} /> ${loc`I am engaged in melee while making this ranged attack (out of melee)`}</label><label><input name="firingIntoMelee" type="checkbox"${input.firingIntoMelee === true ? " checked" : ""} /> ${loc`My target is engaged in melee (into melee)`}</label><p>${loc`Check both when shooting the opponent you are engaged with. Each normally applies −4 attack and +2 error; the applicable CQB feat waives its own pair of penalties.`}</p></fieldset>`;
}
export function standardAttackContextContent(actor, { includeCharacterTarget = true, includeCheapShot = true } = {}) {
  const esc = foundry.utils.escapeHTML;
  return `${actor.items?.some(w => w.type === "weapon" && /\bRCH\b/i.test(w.system?.qualities ?? "")) ? reachContextContent() : ""}${meleeTrickContent(actor)}${bullseyeContent(actor)}${allOutAttackContent(actor)}${includeCheapShot ? cheapShotTrickContent(actor) : ""}${includeCharacterTarget ? (actor.system.activeFeatNames?.some(n => ["Cleave Mastery", "Cleave Supremacy"].includes(n)) ? characterTargetContent(actor) : observedAttackTargetContent(actor)) : ""}<label>${loc`Target distance in feet (required for ranged attacks)`} <input name="distanceFeet" type="number" min="0" step="any" /></label><details><summary>${loc`Target, prior Aim/Brace, light and sensory circumstances`}</summary><p>${loc`These declarations apply existing circumstances. They do not take Aim, Brace or another action, or resolve the target’s Defense.`}</p>${meleeFireContextContent()}${Object.entries(
    booleanFields
  )
    .map(([key, label]) => `<label><input name="${key}" type="checkbox" /> ${esc(label)}</label>`)
    .join(
      ""
    )}<label>${loc`Fog/smoke`} <select name="obscurant"><option value="">${loc`Unspecified`}</option><option value="fog">${loc`Fog`}</option><option value="smoke">${loc`Smoke`}</option></select></label><label>${loc`Density`} <select name="obscurantDensity"><option value="">${loc`Unspecified`}</option>${Object.entries(
    FOG_SMOKE
  )
    .map(([id, row]) => `<option value="${id}">${esc(row.label)}</option>`)
    .join(
      ""
    )}</select></label><label>${loc`Ambient light`} <select name="ambientLight"><option value="">${loc`Unspecified / resolve at table`}</option>${Object.entries(
    AMBIENT_LIGHT
  )
    .map(([id, row]) => `<option value="${id}">${esc(row.label)}</option>`)
    .join("")}</select></label></details>`;
}
export function standardAttackContextInput(input = {}) {
  const out = {
    targetAnimal: false,
    ...reachContextInput(input),
    ...allOutAttackInput(input),
    ...bullseyeInput(input),
    ...meleeTrickInput(input)
  };
  if (Object.hasOwn(input, "declareCheapShot") && typeof input.declareCheapShot !== "boolean")
    throw Error(loc`Declare Cheap Shot with its checkbox.`);
  if (input.declareCheapShot === false) out.cheapShot = null;
  if (input.declareCheapShot === true || input.cheapShot) {
    const raw = input.cheapShot ?? {
        choice: input.cheapShotChoice,
        targetUuid: input.cheapShotTargetUuid,
        confirmed: input.cheapShotLegalConfirmed,
        eligibleConfirmed: input.cheapShotEligibleConfirmed
      },
      target = attackCharacterTargetChoices().find(a => a.uuid === raw.targetUuid);
    if (!target || !CHEAP_SHOT_CHOICES.includes(raw.choice) || raw.confirmed !== true || raw.eligibleConfirmed !== true)
      throw Error(
        loc`Choose the actual Cheap Shot opponent and weakness, and confirm legal action and scene eligibility.`
      );
    out.cheapShot = {
      choice: raw.choice,
      targetUuid: target.uuid,
      targetName: target.name,
      confirmed: true,
      eligibleConfirmed: true
    };
  }

  for (const key of ["targetActorUuid", "targetName"])
    if (Object.hasOwn(input, key)) {
      if (typeof input[key] !== "string") throw new Error(loc`Choose the actual character target and its name.`);
      out[key] = input[key];
    }
  if (Object.hasOwn(input, "targetCharacterType")) {
    if (!["", "standard", "special", "object"].includes(input.targetCharacterType))
      throw new Error(loc`Choose the GC-confirmed target type.`);
    out.targetCharacterType = input.targetCharacterType;
  }
  for (const key of [...Object.keys(booleanFields), "firingOutOfMelee", "firingIntoMelee", "vehicleMounted"])
    if (Object.hasOwn(input, key)) {
      if (typeof input[key] !== "boolean")
        throw new Error(loc`Declare attack circumstance ` + key + loc` with its checkbox.`);
      out[key] = input[key];
    }
  if (
    input.distanceFeet !== undefined &&
    input.distanceFeet !== null &&
    !(typeof input.distanceFeet === "string" && !input.distanceFeet.trim())
  ) {
    const n =
      typeof input.distanceFeet === "number"
        ? input.distanceFeet
        : typeof input.distanceFeet === "string"
          ? Number(input.distanceFeet)
          : NaN;
    if (!Number.isFinite(n) || n < 0) throw new Error(loc`Enter a finite nonnegative target distance.`);
    out.distanceFeet = n;
  }
  for (const [key, allowed] of Object.entries({
    obscurant: ["", "fog", "smoke"],
    obscurantDensity: ["", ...Object.keys(FOG_SMOKE)],
    ambientLight: ["", ...Object.keys(AMBIENT_LIGHT)]
  }))
    if (Object.hasOwn(input, key)) {
      if (!allowed.includes(input[key])) throw new Error(loc`Choose a listed ` + key + " circumstance.");
      out[key] = input[key];
    }
  return out;
}

/** Small quick-attack controls share the ranged attack's existing Aim/Brace/action semantics. */
export function quickRangedAimContent(input = {}) {
  const action = input.attackAction;
  return `<fieldset><legend>${loc`Aim, Brace and attack action`}</legend><label>${loc`Attack action`} <select name="attackAction"><option value="other"${!["standard", "autofire"].includes(action) ? " selected" : ""}>${loc`Other attack (resolve its action modifiers at the table)`}</option><option value="standard"${action === "standard" ? " selected" : ""}>${loc`Standard Attack (Single-Shot for firearms)`}</option>${action === "autofire" ? `<option value="autofire" selected>${loc`Autofire`}</option>` : ""}</select></label><label><input name="aimed" type="checkbox"${input.aimed === true ? " checked" : ""} /> ${loc`Aim was already taken separately and remains valid for this target; it has not moved more than 5 ft.`}</label><label><input name="braced" type="checkbox"${input.braced === true ? " checked" : ""} /> ${loc`Brace was already taken separately and remains valid; I have not moved and the target is within the chosen 90° cone.`}</label><label><input name="stableSurface" type="checkbox"${input.stableSurface === true ? " checked" : ""} /> ${loc`A stable bracing surface is available (unnecessary with Marksmanship Basics).`}</label></fieldset>`;
}
export function quickRangedAimInput(input = {}) {
  const out = {};
  for (const [key, label] of Object.entries({ aimed: "Aim", braced: "Brace", stableSurface: "bracing surface" }))
    if (Object.hasOwn(input, key)) {
      if (typeof input[key] !== "boolean") throw Error(loc`Declare valid ` + label + loc` with its checkbox.`);
      out[key] = input[key];
    }
  if (Object.hasOwn(input, "attackAction")) {
    if (!["other", "standard", "autofire"].includes(input.attackAction))
      throw Error(loc`Choose a supported attack action.`);
    out.attackAction = input.attackAction;
  }
  return out;
}

export function cheapShotTrickContent(actor) {
  const esc = foundry.utils.escapeHTML,
    targets = attackCharacterTargetChoices().filter(a => a.uuid !== actor.uuid);
  return `<details><summary>${loc`Optional Cheap Shot trick`}</summary><label><input name="declareCheapShot" type="checkbox" /> ${loc`Apply Cheap Shot to this Standard Attack (attack−4, error+1)`}</label><label>${loc`Same actual opponent`} <select name="cheapShotTargetUuid"><option value="">${loc`Choose opponent`}</option>${targets.map(a => `<option value="${esc(a.uuid)}">${esc(a.name)}</option>`).join("")}</select></label><label>${loc`Chosen weakness`} <select name="cheapShotChoice">${CHEAP_SHOT_CHOICES.map(k => `<option value="${k}">${k.toUpperCase()}</option>`).join("")}</select></label><label><input name="cheapShotEligibleConfirmed" type="checkbox" /> ${loc`The opponent has suffered no successful Cheap Shot this scene`}</label><label><input name="cheapShotLegalConfirmed" type="checkbox" /> ${loc`The GC confirms this legal trick and actual opponent`}</label><p>${loc`May accompany a final Standard Attack (p.329); it never creates an additional attack opportunity. Flail Basics grants+2gear only on a qualifying melee check.`}</p></details>`;
}

/** Action declaration for quick attacks without the ranged Aim/Brace controls. */
export function quickAttackActionContent(input = {}) {
  return `<label>${loc`Attack action`} <select name="attackAction"><option value="other"${input.attackAction !== "standard" ? " selected" : ""}>${loc`Other attack (resolve its action modifiers at the table)`}</option><option value="standard"${input.attackAction === "standard" ? " selected" : ""}>${loc`Standard Attack (permits eligible miss tricks)`}</option></select></label>`;
}
export function quickAttackActionInput(input = {}) {
  if (!Object.hasOwn(input, "attackAction")) return {};
  if (!["other", "standard"].includes(input.attackAction)) throw Error(loc`Choose a supported quick attack action.`);
  return { attackAction: input.attackAction };
}

export function allOutAttackContent(actor, input = {}) {
  if (!actor?.system.activeFeatNames?.includes("All-out Attack")) return "";
  const maximum = Math.max(0, (actor.system.abilities?.str?.mod ?? 0) + 2);
  return `<label>${loc`All-out Attack penalty (melee only; 0 for none)`} <input name="allOutPenalty" type="number" min="0" max="${maximum}" step="1" value="${Number.isSafeInteger(input.allOutPenalty) ? input.allOutPenalty : 0}" /></label><p>${loc`Choose before rolling: the attack suffers this penalty, its damage gains twice that amount, and a miss makes you flat-footed. Use the recorded hit when rolling its damage.`}</p><label>${loc`Name of unrecorded target (only when no target sheet is selected)`} <input name="allOutTargetName" maxlength="200" value="${foundry.utils.escapeHTML(input.allOutTargetName ?? "")}" /></label><label><input type="checkbox" name="allOutTargetConfirmed" /> ${loc`The GC confirms this is the named unrecorded target, including an object if applicable`}</label>`;
}
export function allOutAttackInput(input = {}) {
  if (!Object.hasOwn(input, "allOutPenalty")) return {};
  const raw = input.allOutPenalty,
    n = typeof raw === "number" ? raw : typeof raw === "string" && /^\d+$/.test(raw.trim()) ? Number(raw) : NaN;
  if (!Number.isSafeInteger(n) || n < 0) throw Error(loc`Choose a nonnegative whole All-out Attack penalty.`);
  const out = { allOutPenalty: n };
  if (Object.hasOwn(input, "allOutTargetName")) {
    if (typeof input.allOutTargetName !== "string" || input.allOutTargetName.length > 200)
      throw Error(loc`Keep the unrecorded target name within200 characters.`);
    out.allOutTargetName = input.allOutTargetName.trim();
  }
  if (Object.hasOwn(input, "allOutTargetConfirmed")) {
    if (typeof input.allOutTargetConfirmed !== "boolean") throw Error(loc`Confirm the named target with its checkbox.`);
    out.allOutTargetConfirmed = input.allOutTargetConfirmed;
  }
  return out;
}

export function bullseyeContent(actor, input = {}) {
  if (!actor?.system.activeFeatNames?.includes("Bullseye")) return "";
  const maximum = Math.max(0, (actor.system.abilities?.dex?.mod ?? 0) + 2);
  return `<label>${loc`Bullseye penalty (ranged Standard Attack only; 0 for none)`} <input name="bullseyePenalty" type="number" min="0" max="${maximum}" step="1" value="${Number.isSafeInteger(input.bullseyePenalty) ? input.bullseyePenalty : 0}" /></label><label><input type="checkbox" name="bullseyeSingleShotConfirmed" /> ${loc`The GC confirms exactly one shot is used; no burst or additional-shot trick applies`}</label><p>${loc`Choose before rolling. The attack suffers this penalty and its recorded damage gains the same amount once. A miss makes you flat-footed.`}</p><label>${loc`Name of unrecorded target (only when no target sheet is selected)`} <input name="bullseyeTargetName" maxlength="200" value="${foundry.utils.escapeHTML(input.bullseyeTargetName ?? "")}" /></label><label><input type="checkbox" name="bullseyeTargetConfirmed" /> ${loc`The GC confirms this named unrecorded target, including an object if applicable`}</label>`;
}
export function bullseyeInput(input = {}) {
  if (!Object.hasOwn(input, "bullseyePenalty")) return {};
  const raw = input.bullseyePenalty,
    n = typeof raw === "number" ? raw : typeof raw === "string" && /^\d+$/.test(raw.trim()) ? Number(raw) : NaN;
  if (!Number.isSafeInteger(n) || n < 0) throw Error(loc`Choose a nonnegative whole Bullseye penalty.`);
  const out = { bullseyePenalty: n };
  for (const key of ["bullseyeSingleShotConfirmed", "bullseyeTargetConfirmed"])
    if (Object.hasOwn(input, key)) {
      if (typeof input[key] !== "boolean")
        throw Error(loc`Confirm the Bullseye shot and named target with their checkboxes.`);
      out[key] = input[key];
    }
  if (Object.hasOwn(input, "bullseyeTargetName")) {
    if (typeof input.bullseyeTargetName !== "string" || input.bullseyeTargetName.length > 200)
      throw Error(loc`Keep the unrecorded target name within200 characters.`);
    out.bullseyeTargetName = input.bullseyeTargetName.trim();
  }
  return out;
}

export function meleeTrickContent(actor, input = {}) {
  const tricks = Object.entries(MELEE_ATTACK_TRICKS).filter(([, d]) => actor?.system.activeFeatNames?.includes(d.feat));
  if (!tricks.length) return "";
  return `<fieldset><legend>${loc`Melee feat trick`}</legend><label>${loc`Trick`} <select name="meleeTrick"><option value="">${loc`None`}</option>${tricks.map(([k, d]) => `<option value="${k}"${input.meleeTrick === k ? " selected" : ""}>${d.source} — ${d.weaponLabel}${k === "threadNeedle" ? loc`, hit holds the actual target` : k === "fend" ? loc`, optional5ft move after hit or miss` : k === "betweenRibs" ? loc`, full action, hit inflicts 1 die of sneak attack damage` : `, ${d.attackBonus >= 0 ? "+" : ""}${d.attackBonus} attack, +${d.damageBonus} damage${d.threatIncrease ? `, +${d.threatIncrease} threat range` : ""}${d.grantedQuality ? ", takedown" : ""}`}</option>`).join("")}</select></label><label><input type="checkbox" name="meleeTrickFullActionConfirmed" /> ${loc`For a full-action trick, the GC confirms this is a full-action Standard Attack with the actual readied weapon`}</label><label><input type="checkbox" name="meleeTrickOnlyConfirmed" /> ${loc`This is the only Melee/Unarmed Combat feat trick applied to this action`}</label>${tricks.some(([key]) => key === "spearCharge") ? `<fieldset><legend>${loc`Spear Charge movement (only for Spear Charge)`}</legend><p>${loc`Before attacking, use Main’s Record round movement for the total already moved, including this charge. Confirm the legal route, terrain and any movement exceptions with the GC. This control does not move tokens or spend movement again.`}</p><label>${loc`Completed counted route (ft.)`} <input name="spearChargeDistanceFeet" type="number" min="10" step="any" /></label><label>${loc`Distance moved toward this actual target (ft.)`} <input name="spearChargeTowardFeet" type="number" min="10" step="any" /></label><label><input name="spearChargeRouteConfirmed" type="checkbox" /> ${loc`The GC confirms this legal route toward the target, including terrain and threatening opponents`}</label><label><input name="spearChargeMovementCompleted" type="checkbox" /> ${loc`I completed this movement immediately before this attack as part of its full action`}</label></fieldset>` : ""}<p>${loc`This declaration does not spend an action. Use the recorded hit for its damage. Thread the Needle requires no full action or numeric damage bonus; after its finished hit, use Main’s Thread the Needle outcome for the source-specific hold. Fend requires no full action: after finishing its Standard Attack, hit or miss, use Main’s Fend movement to record the completed5ft move.`}</p><label>${loc`Name of unrecorded target (when no target sheet is selected)`} <input name="meleeTrickTargetName" maxlength="200" /></label><label><input type="checkbox" name="meleeTrickTargetConfirmed" /> ${loc`The GC confirms this named unrecorded target, including an object`}</label></fieldset>`;
}
export function meleeTrickInput(input = {}) {
  if (!Object.hasOwn(input, "meleeTrick")) return {};
  if (input.meleeTrick !== "" && !Object.hasOwn(MELEE_ATTACK_TRICKS, input.meleeTrick))
    throw Error(loc`Choose a listed melee feat trick.`);
  const out = { meleeTrick: input.meleeTrick };
  if (input.meleeTrick === "spearCharge")
    for (const key of ["spearChargeDistanceFeet", "spearChargeTowardFeet"]) {
      const value =
        typeof input[key] === "number"
          ? input[key]
          : typeof input[key] === "string" && input[key].trim()
            ? Number(input[key])
            : NaN;
      if (!Number.isFinite(value) || value < 10)
        throw Error(loc`Enter finite Spear Charge distances of at least10 ft.`);
      out[key] = value;
    }
  for (const key of [
    "meleeTrickFullActionConfirmed",
    "meleeTrickOnlyConfirmed",
    "meleeTrickTargetConfirmed",
    "spearChargeRouteConfirmed",
    "spearChargeMovementCompleted"
  ])
    if (Object.hasOwn(input, key)) {
      if (typeof input[key] !== "boolean") throw Error(loc`Confirm melee trick declarations with their checkboxes.`);
      out[key] = input[key];
    }
  if (Object.hasOwn(input, "meleeTrickTargetName")) {
    if (typeof input.meleeTrickTargetName !== "string" || input.meleeTrickTargetName.length > 200)
      throw Error(loc`Keep the unrecorded melee trick target within200 characters.`);
    out.meleeTrickTargetName = input.meleeTrickTargetName.trim();
  }
  return out;
}

// Roll pipeline: this rule's section of the "rangedAttack" dialog.
rollPipeline.register({
  id: "meleeFireContextContent:rangedAttack",
  dialogs: ["rangedAttack"],
  dialog: ({ options }) => [{ at: 130, html: meleeFireContextContent(options) }]
});
