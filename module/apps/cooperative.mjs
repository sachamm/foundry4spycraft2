/** Cooperative skill checks in play: the roll dialog's section, what it records, and the leader's tally button. */
import { esc } from "../html.mjs";
import { refuse } from "../error-notices.mjs";
import { rollPipeline } from "../rules/roll-pipeline.mjs";
import { HELPER_BASE_DC, applyCooperativeBonus, helperDC, helperLimit, helperResult } from "../rules/cooperative.mjs";
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
  const checks = globalThis.CONFIG.SPYCRAFT.skills[key]?.checks ?? [];
  if (!checks.some(check => check.cooperative)) return "";
  const leaders = openLeaderChecks(key).filter(message => message.flags.spycraft2.actorUuid !== actor?.uuid);
  const options = leaders
    .map(message => {
      const check = message.flags.spycraft2,
        dc = helperDC({ setDC: check.cooperative.setDC, leaderResult: check.effectiveTotal });
      return `<option value="${esc(message.id)}">${esc(message.speaker?.alias ?? loc`Leader`)}: ${esc(check.focus || check.checkId)} — ${loc`DC ${dc}`}</option>`;
    })
    .join("");
  return `<details class="spycraft2-cooperative"><summary>${loc`Cooperative check`}</summary><label>${loc`Your part`} <select name="cooperativeRole"><option value="">${loc`Working alone`}</option><option value="leader">${loc`Leader: I roll first, helpers add to my result`}</option><option value="helper">${loc`Helper: I roll to help the leader`}</option></select></label><label><input type="checkbox" name="cooperativeSetDC" /> ${loc`Leader: the task has a set DC (helpers roll against DC ${HELPER_BASE_DC})`}</label><label>${loc`Helper: the leader's check`} <select name="cooperativeLeader"><option value="">${loc`Not posted here — enter the DC`}</option>${options}</select></label><label>${loc`Helper: DC, when the leader's check is not listed`} <input type="number" name="cooperativeDC" min="${HELPER_BASE_DC}" step="1" /></label><p class="hint">${loc`Nobody takes 10 or 20. The leader's own check shows how many helpers it allows; apply the helpers' results from the leader's posted check.`}</p></details>`;
}

/** What the section's fields mean for the roll. */
export function cooperativeInput(input = {}, { actor, key } = {}) {
  if (Object.hasOwn(input, "cooperative") || !input.cooperativeRole) return null;
  if (input.cooperativeRole === "leader") {
    const check = (globalThis.CONFIG.SPYCRAFT.skills[key]?.checks ?? []).find(c => c.id === input.check);
    const limit = helperLimit(check, { charismaMod: actor?.system?.abilities?.cha?.mod ?? 0 });
    return {
      cooperative: {
        role: "leader",
        setDC: input.cooperativeSetDC === true,
        max: limit.max,
        smallItem: limit.smallItem,
        special: limit.special
      }
    };
  }
  if (input.cooperativeRole !== "helper") throw new Error(loc`Choose leader or helper.`);
  const leader = input.cooperativeLeader ? globalThis.game.messages.get(input.cooperativeLeader) : null,
    leaderCheck = leader?.flags?.spycraft2;
  if (input.cooperativeLeader && leaderCheck?.cooperative?.role !== "leader")
    throw new Error(loc`The leader's check is no longer available.`);
  if (leaderCheck && leaderCheck.checkId !== input.check)
    throw new Error(loc`A helper makes the same named check as the leader.`);
  const entered = Number(input.cooperativeDC);
  const dc = leaderCheck
    ? helperDC({ setDC: leaderCheck.cooperative.setDC, leaderResult: leaderCheck.effectiveTotal })
    : Number.isFinite(entered) && input.cooperativeDC !== "" && input.cooperativeDC !== null
      ? Math.trunc(entered)
      : NaN;
  return {
    cooperative: {
      role: "helper",
      leaderId: leader?.id ?? "",
      leaderName: leader?.speaker?.alias ?? "",
      dc
    }
  };
}

/** Add up the helpers' posted checks and raise the leader's result. */
export async function applyHelpers(message) {
  const check = message.flags?.spycraft2;
  if (check?.cooperative?.role !== "leader") return null;
  const helpers = helperChecks(message).map(helper => ({
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
