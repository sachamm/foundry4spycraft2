import { classFeatureLevels } from "../rules/class-features.mjs";
import { completeCharacterTarget } from "./character-target.mjs";
import { standardAttackContextContent, standardAttackContextInput } from "./standard-attack-context.mjs";
import { twoWeaponDeclarationPlan, twoWeaponFinalAttackPlan } from "../rules/two-weapon.mjs";
import { twoWeaponStyleState } from "../rules/two-weapon-state.mjs";
import { expertiseCombatContext } from "./combat-expertise.mjs";
import { queueResources } from "../services/transactions.mjs";
import { loc } from "../i18n.mjs";
import { postedReceipt } from "../services/message-lookup.mjs";
import { formDialog, raw } from "./dialog-kit.mjs";
const isMap = v => v !== null && typeof v === "object" && !Array.isArray(v);
const roundKey = c => `${encodeURIComponent(c.id).replaceAll(".", "%2E")}:${c.round}`;
const matches = (a, b) =>
  Array.isArray(b)
    ? Array.isArray(a) && a.length === b.length && b.every((v, i) => matches(a[i], v))
    : b && typeof b === "object"
      ? a && Object.entries(b).every(([k, v]) => matches(a[k], v))
      : a === b;
export async function declareTwoWeapon(actor, options = {}) {
  if (actor.type !== "agent" || !actor.isOwner) return null;
  const expected = JSON.stringify(expertiseCombatContext(actor));
  let input = options;
  if (!Object.hasOwn(input, "extraAttacks")) {
    const esc = foundry.utils.escapeHTML,
      weapons = actor.items.filter(i => i.type === "weapon"),
      choices = weapons
        .map(i => `<option value="${esc(i.id)}">${esc(i.name)} (${esc(i.system.sizeHands ?? "")})</option>`)
        .join("");
    input = await formDialog({
      title: loc`Declare two-weapon combat`,
      intro: loc`At the start of your Initiative Count, choose the full-round tradeoff. Mark the two actual one-handed weapons equipped and carried on Gear first. Each final attack is one free-action Standard Attack; tricks may apply, but adjustments and action combinations do not (p.329). Use Main to take each final attack; the GC counts attacks to determine the least-used weapon.`,
      fields: [
        { select: "firstWeaponId", label: loc`First weapon`, optionsHtml: raw(choices) },
        { select: "secondWeaponId", label: loc`Second weapon`, optionsHtml: raw(choices) },
        {
          select: "extraAttacks",
          label: loc`Choice`,
          options: [
            ["1", loc`Basics: 1 final attack; −2 attack/skill checks`],
            ["2", loc`Mastery: 2 final attacks; −4 attack/skill checks`]
          ]
        },
        { check: "atStartOfInitiative", label: loc`This is the start of my Initiative Count` },
        { check: "armedConfirmed", label: loc`The GC confirms both weapons are actually readied in separate hands` }
      ]
    });
    if (!input) return null;
  }
  return queueResources([actor], async () => {
    if (!actor.isOwner) throw new Error(loc`You must own the character.`);
    const combat = expertiseCombatContext(actor);
    if (JSON.stringify(combat) !== expected)
      throw new Error(loc`The Initiative Count changed. Declare the two-weapon choice again.`);
    const extraAttacks =
      typeof input.extraAttacks === "string" && input.extraAttacks.trim()
        ? Number(input.extraAttacks)
        : input.extraAttacks;
    const plan = twoWeaponDeclarationPlan(actor.system, combat, actor.items, {
        weaponIds: input.weaponIds ?? [input.firstWeaponId, input.secondWeaponId],
        extraAttacks,
        atStartOfInitiative: input.atStartOfInitiative,
        armedConfirmed: input.armedConfirmed
      }),
      key = roundKey(combat),
      history =
        actor.flags?.spycraft2?.twoWeaponDeclarations === undefined ? {} : actor.flags.spycraft2.twoWeaponDeclarations;
    if (
      !isMap(history) ||
      (actor.flags?.spycraft2?.twoWeaponReviews !== undefined && !isMap(actor.flags.spycraft2.twoWeaponReviews))
    )
      throw new Error(loc`The GC must review the saved two-weapon declaration history.`);
    if (
      Object.hasOwn(history, key) ||
      Object.values(actor.flags?.spycraft2?.twoWeaponReviews ?? {}).some(
        r => r?.combatRound === key || r?.blockedRounds?.includes(key)
      )
    )
      throw new Error(loc`A two-weapon declaration has already been recorded for this combat round.`);
    const record = {
        ...plan,
        id: foundry.utils.randomID(),
        previousAttackCounter: structuredClone(actor.system.resourceUses?.twoWeaponFinalAttack ?? null)
      },
      updates = {
        "system.twoWeaponStyle": record,
        "system.resourceUses.twoWeaponFinalAttack": { epoch: record.id, used: 0 },
        [`flags.spycraft2.twoWeaponDeclarations.${key}`]: record.id
      };
    const settled = () =>
      matches(actor.system.twoWeaponStyle, record) &&
      actor.flags?.spycraft2?.twoWeaponDeclarations?.[key] === record.id &&
      actor.system.resourceUses?.twoWeaponFinalAttack?.epoch === record.id &&
      actor.system.resourceUses.twoWeaponFinalAttack.used === 0;
    try {
      await actor.update(updates);
    } catch (error) {
      if (!settled()) throw error;
    }
    if (!settled()) throw new Error(loc`The two-weapon declaration needs GC review.`);
    const state = twoWeaponStyleState(actor.system);
    try {
      await ChatMessage.create({
        speaker: ChatMessage.getSpeaker({ actor }),
        content: loc`Two-weapon declaration: ${record.extraAttacks} final Standard Attack(s), using the least-used of the two declared weapons (choose in a tie). Attack/skill penalty −${record.penalty} until the start of own Count in round ${record.dueRound}.${state.handgunSkillWaiver ? loc` Both Guns Blazing waives the two-weapon skill penalty and the penalty on handgun attacks.` : ""} Main tracks the granted final attacks; confirm normal action requirements and least-used weapon at the table.`,
        flags: {
          spycraft2: {
            actorUuid: actor.uuid,
            checkKind: "twoWeaponDeclaration",
            actionDiceAllowed: false,
            twoWeaponStyle: record
          }
        }
      });
    } catch (error) {
      ui.notifications.warn(
        loc`The two-weapon tradeoff is active, but its chat notice could not be confirmed. Review Main before declaring another use.`
      );
    }
    return record;
  });
}
export async function reviewTwoWeapon(actor, options = {}) {
  if (!game.user.isGM || !actor.isOwner) throw new Error(loc`Only an owning GC can review a two-weapon tradeoff.`);
  const snapshot = () =>
      JSON.stringify({
        record: actor.system.twoWeaponStyle,
        combat: expertiseCombatContext(actor),
        triggerman: classFeatureLevels(actor.system)?.triggerman,
        declarations: actor.flags?.spycraft2?.twoWeaponDeclarations,
        reviews: actor.flags?.spycraft2?.twoWeaponReviews
      }),
    before = snapshot();
  let input = options;
  if (!Object.hasOwn(input, "confirmed")) {
    input = await formDialog({
      title: loc`Review two-weapon tradeoff`,
      intro: loc`Review the actual remaining penalty and final attacks at the table before clearing this declaration. Clearing preserves the declared round’s use and never grants more final attacks. A new round’s legitimate choice remains separate.`,
      fields: [
        { text: "resolution", label: loc`Resolution` },
        {
          check: "confirmed",
          label: loc`The GC has resolved the remaining tradeoff and confirms clearing this saved record`
        }
      ]
    });
    if (!input) return null;
  }
  return queueResources([actor], async () => {
    if (!game.user.isGM || !actor.isOwner) throw new Error(loc`Only an owning GC can clear this record.`);
    if (snapshot() !== before) throw new Error(loc`The tradeoff or Count changed. Review it again.`);
    if (
      input.confirmed !== true ||
      typeof input.resolution !== "string" ||
      !input.resolution.trim() ||
      input.resolution.length > 500
    )
      throw new Error(loc`Confirm the GC resolution before clearing a tradeoff.`);
    const id = foundry.utils.randomID(),
      previous = structuredClone(actor.system.twoWeaponStyle ?? null),
      combat = expertiseCombatContext(actor),
      oldDeclarations = actor.flags?.spycraft2?.twoWeaponDeclarations,
      oldReviews = actor.flags?.spycraft2?.twoWeaponReviews,
      unknownHistory =
        (oldDeclarations !== undefined && !isMap(oldDeclarations)) || (oldReviews !== undefined && !isMap(oldReviews)),
      originalKey =
        typeof previous?.combatId === "string" &&
        previous.combatId &&
        Number.isSafeInteger(previous.startRound) &&
        previous.startRound >= 1
          ? roundKey({ id: previous.combatId, round: previous.startRound })
          : null,
      currentKey = combat?.started && Number.isSafeInteger(combat.round) && combat.round >= 1 ? roundKey(combat) : null,
      blockedRounds = [
        ...new Set([originalKey, ...(unknownHistory || !originalKey ? [currentKey] : [])].filter(Boolean))
      ],
      audit = {
        id,
        previous,
        combatRound: originalKey ?? currentKey,
        blockedRounds,
        resolution: input.resolution.trim(),
        userId: game.user.id,
        ...(unknownHistory
          ? {
              historyBefore: {
                declarations: structuredClone(oldDeclarations ?? null),
                reviews: structuredClone(oldReviews ?? null)
              }
            }
          : {})
      },
      declarations = {
        ...(isMap(oldDeclarations) ? oldDeclarations : {}),
        ...Object.fromEntries(blockedRounds.map(k => [k, id]))
      },
      reviews = { ...(isMap(oldReviews) ? oldReviews : {}), [id]: audit },
      updates = {
        "system.twoWeaponStyle": null,
        "flags.spycraft2.twoWeaponDeclarations": declarations,
        "flags.spycraft2.twoWeaponReviews": reviews
      };
    const settled = () =>
      actor.system.twoWeaponStyle === null &&
      matches(actor.flags?.spycraft2?.twoWeaponReviews?.[id], audit) &&
      blockedRounds.every(k => actor.flags?.spycraft2?.twoWeaponDeclarations?.[k] === id);
    try {
      await actor.update(updates);
    } catch (error) {
      if (!settled()) throw error;
    }
    if (!settled()) throw new Error(loc`The two-weapon review needs confirmation of its saved history.`);
    return audit;
  });
}

export async function takeTwoWeaponFinalAttack(actor, options = {}) {
  if (actor.type !== "agent" || !actor.isOwner) return null;
  if (options.disarm) throw new Error(loc`A final attack cannot combine with a Disarm action.`);
  for (const key of [
    "oneInAMillion",
    "millionDollarSkill",
    "cunningPlan",
    "tenSecondSolution",
    "brightIdea",
    "additionalUses",
    "additionalCost"
  ])
    if (options[key])
      throw new Error(
        loc`Resolve combined class declarations through their normal attack controls, then ask the GC to update this final-attack counter.`
      );
  const before = JSON.stringify({ record: actor.system.twoWeaponStyle, combat: expertiseCombatContext(actor) });
  let input = options;
  if (!Object.hasOwn(input, "leastUsedConfirmed")) {
    const esc = foundry.utils.escapeHTML,
      choices = (actor.system.twoWeaponStyle?.weaponIds ?? [])
        .map(id => actor.items.get(id))
        .filter(Boolean)
        .map(i => `<option value="${esc(i.id)}">${esc(i.name)}</option>`)
        .join("");
    input = await formDialog({
      title: loc`Two-weapon final attack`,
      intro: loc`One free-action Standard Attack. The GC counts all attacks this round and confirms the least-used original weapon (choose in a tie). Set Single-Shot mode beforehand. Tricks and normal Standard Attack benefits apply; adjustments and action combinations do not. Use other class attack controls and GC counter review for combined class declarations.`,
      fields: [
        { select: "weaponId", label: loc`Weapon`, optionsHtml: raw(choices) },
        raw(standardAttackContextContent(actor)),
        {
          check: "leastUsedConfirmed",
          label: loc`The GC confirms this is the least-used weapon and this free final attack is legal now`
        }
      ]
    });
    if (!input) return null;
  }
  if (JSON.stringify({ record: actor.system.twoWeaponStyle, combat: expertiseCombatContext(actor) }) !== before)
    throw new Error(loc`The declaration or Initiative Count changed. Review the final attack again.`);
  const attackOptions = await completeCharacterTarget(actor, actor.items.get(input.weaponId)?.system, {
    ...standardAttackContextInput(input),
    attackAction: "standard",
    freeFinalAttack: true
  });
  if (!attackOptions) return null;
  const plan = twoWeaponFinalAttackPlan(actor.system, expertiseCombatContext(actor), actor.items, input),
    weapon = actor.items.get(plan.weaponId),
    preview = actor.weaponAttack(weapon, attackOptions);
  if (preview.ranged && !Number.isFinite(attackOptions.distanceFeet))
    throw new Error(loc`Enter the actual target distance for the final ranged attack.`);
  if (preview.blocked || (preview.firearm && preview.fireMode !== "single"))
    throw new Error(preview.reason || loc`A final Standard Attack requires Single-Shot mode.`);
  const signature = JSON.stringify(preview),
    receipt = { ...plan, id: foundry.utils.randomID() };
  return actor.useLimitedAbility(
    "twoWeaponFinalAttack",
    async status => {
      const validate = () => {
        if (!actor.isOwner) throw new Error(loc`You must own the character.`);
        const fresh = twoWeaponFinalAttackPlan(actor.system, expertiseCombatContext(actor), actor.items, input),
          counter = actor.system.resourceUses?.twoWeaponFinalAttack,
          current = actor.items.get(plan.weaponId);
        if (JSON.stringify(fresh) !== JSON.stringify(plan)) throw new Error(loc`The final attack declaration changed.`);
        if (
          JSON.stringify(actor.system.twoWeaponStyle) !== JSON.stringify(JSON.parse(before).record) ||
          counter?.epoch !== plan.declarationId ||
          counter.used !== status.used + 1 ||
          JSON.stringify(actor.weaponAttack(current, attackOptions)) !== signature
        )
          throw new Error(loc`The final attack or its reserved use changed. Review it again.`);
      };
      validate();
      const posted = () => postedReceipt(actor, "twoWeaponFinalAttack", receipt.id);
      try {
        const message = await actor.rollAttack(actor.items.get(plan.weaponId), {
          ...attackOptions,
          twoWeaponFinalAttack: { ...receipt, sequence: status.used + 1 },
          validateFinalAttack: validate
        });
        if (!message) throw new Error(loc`The final attack was cancelled before posting.`);
        return message;
      } catch (error) {
        const message = posted();
        if (message) return message;
        throw error;
      }
    },
    { workflow: "twoWeaponFinalAttack" }
  );
}
