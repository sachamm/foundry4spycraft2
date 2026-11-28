/** Cooperative skill checks in play: the roll dialog's section, what it records, and the leader's tally button. */
import { esc } from "../html.mjs";
import { refuse } from "../error-notices.mjs";
import { rollPipeline } from "../rules/roll-pipeline.mjs";
import {
  helperBaseDC,
  applyCooperativeBonus,
  helperDC,
  helperLimit,
  helperResult,
  cooperativeChecks,
  validateCooperative
} from "../rules/cooperative.mjs";
import { checkFlavor } from "../rules/outcomes.mjs";
import { loc } from "../i18n.mjs";

const messages = () => [...(globalThis.game?.messages ?? [])];

/** Leaders' cooperative checks for a skill that are still open, newest first. */
export function openLeaderChecks(skillKey, list = messages()) {
  return list
    .filter(message => {
      const check = message.flags?.spycraft2;
      return (
        check?.checkKind === "skill" &&
        check.skillKey === skillKey &&
        check.cooperative?.role === "leader" &&
        !check.resolved &&
        !check.superseded &&
        !check.cooperative.result?.ruined
      );
    })
    .reverse();
}

/** The helpers' checks posted for a leader's check, oldest first; one per helper (the latest that still stands). */
export function helperChecks(leaderMessage, list = messages()) {
  const byActor = new Map();
  for (const message of list) {
    const check = message.flags?.spycraft2;
    if (check?.cooperative?.role !== "helper" || check.cooperative.leaderId !== leaderMessage.id) continue;
    if (check.superseded) continue;
    byActor.set(check.actorUuid ?? message.id, message);
  }
  return [...byActor.values()];
}

/** The skill dialog's cooperative section. */
export function cooperativeContent(key, actor) {
  const keys = key ? [key] : Object.keys(globalThis.CONFIG?.SPYCRAFT?.skills ?? {});
  const checks = keys.flatMap(k => cooperativeChecks(k, actor));
  if (!checks.some(check => check.cooperative)) return "";
  const leaders = keys
    .flatMap(k => openLeaderChecks(k))
    .filter(message => message.flags.spycraft2.actorUuid !== actor?.uuid);
  const options = leaders
    .map(message => {
      const check = message.flags.spycraft2,
        dc = helperDC({ setDC: check.cooperative.setDC, leaderResult: check.effectiveTotal });
      return `<option value="${esc(message.id)}">${esc(message.speaker?.alias ?? loc`Leader`)}: ${esc(check.focus || check.checkId)} — ${loc`DC ${dc}`}</option>`;
    })
    .join("");
  const grappleContent =
    !key || key === "athletics"
      ? `<fieldset><legend>${loc`Grapple group (p.357)`}</legend><label>${loc`New or unlisted leader: participation`} <select name="cooperativeGrappleMode"><option value="opening">${loc`Opening together at the same Count`}</option><option value="joined">${loc`Already joined this grapple with the required full action`}</option></select></label><label>${loc`New or unlisted leader: maximum helpers, excluding the leader`} <select name="cooperativeGrappleMax"><option value="">${loc`Choose from actual Sizes…`}</option><option value="1">${loc`1 helper: target smaller (2 participants)`}</option><option value="3">${loc`3 helpers: same Size (4 participants)`}</option><option value="7">${loc`7 helpers: target one Size larger (8 participants)`}</option></select></label><label><input name="cooperativeGrappleConfirmed" type="checkbox" /> ${loc`The GC confirms every participant, actual positions and Size limit: opening together requires the same Count and an adjacent target; an existing helper must have joined with the full action. A listed leader supplies its recorded mode and limit.`}</label><p class="hint">${loc`For mixed Sizes, review every participant. Joining without helping another participant resolves in Initiative order instead of as a helper.`}</p></fieldset>`
      : "";
  return `<details class="spycraft2-cooperative"><summary>${loc`Cooperative check`}</summary><label>${loc`Your part`} <select name="cooperativeRole"><option value="">${loc`Working alone`}</option><option value="leader">${loc`Leader: I roll first, helpers add to my result`}</option><option value="helper">${loc`Helper: I roll to help the leader`}</option></select></label><label><input type="checkbox" name="cooperativeSetDC" /> ${loc`Leader: the task has a set DC (helpers roll against DC ${helperBaseDC()})`}</label><label>${loc`Helper: the leader's check`} <select name="cooperativeLeader"><option value="">${loc`Not posted here — enter the DC`}</option>${options}</select></label><label>${loc`Helper: DC, when the leader's check is not listed`} <input type="number" name="cooperativeDC" min="${helperBaseDC()}" step="1" /></label><p class="hint">${loc`Nobody takes 10 or 20. The leader's own check shows how many helpers it allows; apply the helpers' results from the leader's posted check.`}</p>${grappleContent}</details>`;
}

/** What the section's fields mean for the roll. */
export function cooperativeInput(input = {}, { actor, key } = {}) {
  if (Object.hasOwn(input, "cooperative") || !input.cooperativeRole) return null;
  const check = cooperativeChecks(key, actor).find(c => c.id === input.check);
  const grapple = input.check === "grapple";
  if (input.cooperativeRole === "leader") {
    const limit = helperLimit(check, { charismaMod: actor?.system?.abilities?.cha?.mod ?? 0 });
    const cooperative = {
      role: "leader",
      setDC: input.cooperativeSetDC === true,
      max: grapple ? Number(input.cooperativeGrappleMax) : limit.max,
      smallItem: limit.smallItem,
      special: limit.special,
      ...(grapple
        ? { grappleConfirmed: input.cooperativeGrappleConfirmed === true, grappleMode: input.cooperativeGrappleMode }
        : {})
    };
    if (grapple) validateCooperative(cooperative, { check });
    return { cooperative };
  }
  if (input.cooperativeRole !== "helper") throw new Error(loc`Choose leader or helper.`);
  const leader = input.cooperativeLeader ? globalThis.game.messages.get(input.cooperativeLeader) : null,
    leaderCheck = leader?.flags?.spycraft2;
  if (
    input.cooperativeLeader &&
    (leaderCheck?.cooperative?.role !== "leader" ||
      leaderCheck.resolved ||
      leaderCheck.superseded ||
      leaderCheck.cooperative.result?.ruined)
  )
    throw new Error(loc`The leader's check is no longer available.`);
  if (leaderCheck && (leaderCheck.checkId !== input.check || leaderCheck.skillKey !== key))
    throw new Error(loc`A helper makes the same named check as the leader.`);
  if (grapple && leaderCheck?.actorUuid === actor?.uuid)
    throw Error(loc`A grapple leader cannot count as its own helper.`);
  const entered = Number(input.cooperativeDC);
  const dc = leaderCheck
    ? helperDC({ setDC: leaderCheck.cooperative.setDC, leaderResult: leaderCheck.effectiveTotal })
    : Number.isFinite(entered) && input.cooperativeDC !== "" && input.cooperativeDC !== null
      ? Math.trunc(entered)
      : NaN;
  const cooperative = {
    role: "helper",
    leaderId: leader?.id ?? "",
    leaderName: leader?.speaker?.alias ?? "",
    dc,
    ...(grapple
      ? {
          max: leaderCheck?.cooperative?.max ?? Number(input.cooperativeGrappleMax),
          grappleConfirmed: input.cooperativeGrappleConfirmed === true,
          grappleMode: leaderCheck?.cooperative?.grappleMode ?? input.cooperativeGrappleMode,
          setDC: leaderCheck?.cooperative?.setDC === true
        }
      : {})
  };
  if (grapple) validateCooperative(cooperative, { check });
  return { cooperative };
}

/** Add up the helpers' posted checks and raise the leader's result. */
export async function applyHelpers(message) {
  const check = message.flags?.spycraft2;
  if (check?.cooperative?.role !== "leader") return null;
  if (check.resolved || check.superseded || check.cooperative.result?.ruined)
    return refuse(loc`This cooperative check is finished, replaced or already failed. Keep its recorded result.`);
  const cards = helperChecks(message);
  if (check.checkId === "grapple") {
    validateCooperative(check.cooperative, {
      check: cooperativeChecks("athletics", fromUuidSync(check.actorUuid)).find(c => c.id === "grapple")
    });
    if (
      cards.length > check.cooperative.max ||
      cards.some(
        m =>
          m.flags.spycraft2.actorUuid === check.actorUuid ||
          m.flags.spycraft2.skillKey !== "athletics" ||
          m.flags.spycraft2.checkId !== "grapple" ||
          m.flags.spycraft2.cooperative?.grappleConfirmed !== true ||
          m.flags.spycraft2.cooperative?.max !== check.cooperative.max ||
          m.flags.spycraft2.cooperative?.grappleMode !== check.cooperative.grappleMode
      )
    )
      return refuse(loc`Review the actual grapple leader, helpers and Size limit before adding their results.`);
  }
  const helpers = cards.map(helper => ({
    name: helper.speaker?.alias ?? "",
    messageId: helper.id,
    ...helperResult(helper.flags.spycraft2)
  }));
  if (!helpers.length) return refuse(loc`No helper has posted a check for this leader yet.`);
  const next = applyCooperativeBonus(check, helpers, { max: check.cooperative.max ?? null });
  await message.update({ "flags.spycraft2": next, flavor: checkFlavor(next) });
  return next;
}

rollPipeline.register({
  id: "cooperativeContent:skill",
  dialogs: ["skill"],
  order: 9710,
  dialog: ({ key, actor }) => [{ at: 965, html: cooperativeContent(key, actor) }],
  read: (context, input) => cooperativeInput(input, context)
});

rollPipeline.register({
  id: "cooperativeControl",
  kinds: ["skill"],
  order: 9720,
  chatControls({ message, check, user }) {
    if (check.cooperative?.role !== "leader" || check.superseded || check.cooperative.result?.ruined) return null;
    // The tally rewrites the leader's card, which only its author or the GC may do.
    if (!(message.isAuthor || user?.isGM)) return null;
    return [{ label: loc`Apply helpers' results`, run: () => applyHelpers(message) }];
  }
});
