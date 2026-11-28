import {
  npcDrainedApplicationPlan,
  npcDrainedProjection,
  ownedNpcProfile,
  readNpcDrained
} from "../rules/npc-drained.mjs";
import { NPC_RULES, defaultNpcProfile } from "../rules/npcs.mjs";
import { npcIsSpecial } from "../rules/gc/npc-state.mjs";
import { queueResources } from "../services/transactions.mjs";
import { sameValues, stable } from "../rules/equal.mjs";
import { formDialog } from "./dialog-kit.mjs";
import { snapshot, undoEntry, postUndo } from "./undo.mjs";
import { loc } from "../i18n.mjs";
import { drainedRecoveryView } from "./drained.mjs";

const recordOf = actor => actor.flags?.spycraft2?.drained ?? null;
const profileOf = actor => ownedNpcProfile(actor) ?? defaultNpcProfile();
const itemsOf = actor => [...actor.items];
const baseSystem = actor => ({ ...actor.system, npcProfile: profileOf(actor) });
function requireGC(actor) {
  if (actor?.type !== "npc" || !actor.isOwner || !game.user.isGM)
    throw Error(loc`An owning GC must record NPC Drained losses and corrections.`);
}
const proof = actor => ({
  record: structuredClone(recordOf(actor)),
  signature: stable({
    profile: profileOf(actor),
    role: npcIsSpecial(actor),
    baseLevel: actor.system.undrainedThreatLevel ?? actor.system.effectiveThreatLevel,
    items: itemsOf(actor)
      .filter(i => ["feat", "class", "origin"].includes(i.type))
      .map(i => ({
        id: i.id,
        name: i.name,
        type: i.type,
        system: i.system.toObject?.() ?? i.system
      }))
  })
});
function unchanged(actor, expected) {
  if (!sameValues(proof(actor), expected))
    throw Error(loc`The NPC's build, role, level or Drained history changed. Reopen the review.`);
}
function picture(actor, qualities) {
  const value = snapshot(actor);
  value.data = Object.fromEntries(
    Object.entries(value.data).filter(
      ([k]) => k.startsWith("flags.spycraft2.drained") || (qualities && k === "system.npcProfile.qualities")
    )
  );
  value.data.flags = {};
  value.data["flags.spycraft2"] = {};
  value.data.system = {};
  value.data["system.npcProfile"] = {};
  value.effects = new Map();
  value.combatants = [];
  return value;
}
async function write(actor, record, label, profile = null) {
  const before = picture(actor, !!profile),
    patch = { "flags.spycraft2.==drained": record };
  if (profile) patch["system.npcProfile.qualities"] = profile.qualities;
  const applied = () =>
    sameValues(recordOf(actor), record) && (!profile || sameValues(profileOf(actor).qualities, profile.qualities));
  try {
    await actor.update(patch);
  } catch (error) {
    if (!applied()) throw error;
  }
  if (!applied()) throw Error(loc`Review the actual NPC Drained receipt before retrying.`);
  const entry = undoEntry(actor, before, picture(actor, !!profile));
  if (entry) await postUndo(label, [entry]);
  return record;
}
const qualityLabel = row => {
  row ??= {};
  const rule = NPC_RULES.qualities.find(q => q.id === row.id);
  return `${rule?.name ?? row.id ?? loc`Quality`}${row.details ? `: ${row.details}` : ""}${row.units > 1 ? ` (${row.units})` : ""}`;
};

export async function applyNpcDrained(actor, options = {}) {
  requireGC(actor);
  const expected = proof(actor),
    original = profileOf(actor),
    items = itemsOf(actor),
    state = readNpcDrained(expected.record),
    special = npcIsSpecial(actor),
    lostQualities = new Set(state.losses.filter(l => l.forfeit?.kind === "quality").map(l => l.forfeit.id)),
    lostFeats = new Set(state.losses.filter(l => l.forfeit?.kind === "feat").map(l => l.forfeit.id));
  if (options.id && Object.hasOwn(expected.record?.applications ?? {}, options.id)) return expected.record;
  const choices = [
    ...(original.enabled
      ? original.qualities.flatMap((q, index) =>
          lostQualities.has(q.entryId) ? [] : [[`quality:${index}`, qualityLabel(q)]]
        )
      : []),
    ...items.filter(i => i.type === "feat" && !lostFeats.has(i.id)).map(i => [`feat:${i.id}`, i.name]),
    ["manual", loc`GC handled another quality separately`],
    ["none", loc`No quality remains to forfeit`]
  ];
  const external =
    items.some(i => ["class", "origin"].includes(i.type)) ||
    original.qualities.some(q => ["classAbility", "talented", "specialty"].includes(q.id));
  let input = { ...options, levels: options.levels ?? 1 };
  if (input.confirmed !== true) {
    input = await formDialog({
      title: loc`GC: apply NPC Drained`,
      ok: loc`Apply Drained`,
      intro: special
        ? loc`This special NPC loses effective career levels, stopping at level 1. Its original profile remains saved. The mission's Threat Level is shared and stays separate (pp.341,452).`
        : loc`This standard NPC loses one selected quality and one step from every stat and named skill grade, stopping at grade I. Equipment Calibers stay separate. The original build remains saved (pp.341,441–444).`,
      fields: [
        { text: "source", label: loc`Resolved source or check`, value: options.source ?? "", maxlength: 1000 },
        ...(special
          ? [
              {
                number: "levels",
                label: loc`Incoming lost levels`,
                min: 1,
                max: 20,
                step: 1,
                value: options.levels ?? 1,
                required: true
              }
            ]
          : [{ select: "forfeitChoice", label: loc`Quality to forfeit`, options: choices }]),
        ...(!original.enabled
          ? [{ check: "manualStatsHandled", label: loc`The GC separately adjusted this manual NPC's lost statistics` }]
          : []),
        ...(external
          ? [
              {
                check: "classOptionsReviewed",
                label: loc`The GC separately resolved any class and Origin benefits affected by this loss`
              }
            ]
          : []),
        ...(!special
          ? [
              {
                check: "manualQualityHandled",
                label: loc`For a separately handled quality, the GC applied its actual loss`
              },
              { check: "noQualityConfirmed", label: loc`For an empty quality list, the GC verified that none remains` }
            ]
          : []),
        { text: "note", label: loc`Other affected benefits or history note`, maxlength: 1000 },
        {
          check: "confirmed",
          label: loc`The GC confirmed the actual Drained source and resolved any existing, awarded or timed benefits separately`
        }
      ]
    });
    if (!input) return null;
    const [kind, value] = String(input.forfeitChoice ?? "").split(":");
    input = {
      ...input,
      levels: special ? Number(input.levels) : 1,
      forfeit: kind === "quality" ? { kind, index: Number(value) } : kind === "feat" ? { kind, id: value } : { kind }
    };
  }
  return queueResources([actor], async () => {
    requireGC(actor);
    unchanged(actor, expected);
    await options.validateSource?.();
    const seen = new Set(),
      ids = original.qualities.map(q => {
        let id =
          typeof q.entryId === "string" &&
          /^[A-Za-z0-9_-]{1,80}$/.test(q.entryId) &&
          !["__proto__", "prototype", "constructor"].includes(q.entryId)
            ? q.entryId
            : "";
        if (!id || seen.has(id)) id = foundry.utils.randomID();
        seen.add(id);
        return id;
      }),
      plan = npcDrainedApplicationPlan(
        baseSystem(actor),
        itemsOf(actor),
        recordOf(actor),
        {
          ...input,
          id: options.id ?? foundry.utils.randomID(),
          reviewer: game.user.id,
          at: game.time.worldTime
        },
        ids
      );
    if (plan.duplicate) return plan.record;
    return write(actor, plan.record, loc`NPC Drained: ${actor.name}`, plan.profile);
  });
}

/** Correct verified history; this never generates dice or releases an original recovery attempt for another roll. */
export async function reviewNpcDrainedHistory(actor, options = {}) {
  requireGC(actor);
  const expected = proof(actor),
    old = expected.record;
  if (!old) return null;
  let state;
  try {
    state = readNpcDrained(old);
  } catch {
    state = null;
  }
  let input = options;
  if (input.confirmed !== true) {
    const rows = state?.losses ?? [];
    input = await formDialog({
      title: loc`GC: correct NPC Drained history`,
      ok: loc`Record verified history`,
      intro: loc`Use this for a verified table resolution or imported history. Keep every loss that still applies. Existing recovery dice and actual manual changes must be resolved first; this correction rolls nothing.`,
      fields: [
        ...rows.map((row, index) => ({
          check: `keep${index}`,
          label: `${row.source} — ${row.role === "standard" ? loc`standard loss` : loc`lost career level`}`,
          checked: true
        })),
        ...(!state
          ? [
              {
                check: "unknownHistoryResolved",
                label: loc`The GC resolved all effects in this unreadable history before clearing it`
              }
            ]
          : []),
        { text: "reference", label: loc`Original result or table ruling reference`, maxlength: 1000 },
        { text: "note", label: loc`Verified current effects and correction reason`, maxlength: 1000 },
        {
          check: "confirmed",
          label: loc`The GC verified the remaining losses, actual statistics and all original recovery dice; no replacement roll is authorized`
        }
      ]
    });
    if (!input) return null;
    input = { ...input, retained: rows.flatMap((row, index) => (input[`keep${index}`] ? [row.id] : [])) };
  }
  if (
    input.confirmed !== true ||
    !input.reference?.trim() ||
    !input.note?.trim() ||
    (!state && input.unknownHistoryResolved !== true) ||
    !Array.isArray(input.retained) ||
    new Set(input.retained).size !== input.retained.length ||
    input.retained.some(id => !state?.stack.includes(id))
  )
    throw Error(loc`Verify the original result, actual remaining losses and history correction.`);
  return queueResources([actor], async () => {
    requireGC(actor);
    unchanged(actor, expected);
    const kept = new Set(input.retained),
      stack = (state?.stack ?? []).filter(id => kept.has(id)),
      review = {
        reviewer: game.user.id,
        at: game.time.worldTime,
        reference: input.reference.trim(),
        note: input.note.trim(),
        previousLevels: old.levels ?? null,
        kept: stack
      },
      recoveries = Object.fromEntries(
        Object.entries(old.recoveries ?? {}).map(([id, row]) => [
          id,
          row?.state === "completed" ? row : { ...row, state: "completed", historyReview: review }
        ])
      ),
      next = {
        ...old,
        version: 1,
        kind: "npc",
        levels: stack.length,
        stack,
        recoveries,
        reviews: [...(Array.isArray(old.reviews) ? old.reviews : []), review]
      };
    npcDrainedProjection(baseSystem(actor), itemsOf(actor), next);
    return write(actor, next, loc`NPC Drained history review: ${actor.name}`);
  });
}

export function npcDrainedView(actor) {
  if (actor?.type !== "npc") return null;
  const record = recordOf(actor),
    canControl = actor.isOwner && game.user.isGM;
  if (!record?.levels && !actor.system.drainedState?.needsReview && !canControl) return null;
  const state = actor.system.drainedState;
  return {
    ...drainedRecoveryView(actor),
    count: state?.levels ?? record?.levels ?? 0,
    canApply: canControl && !state?.needsReview,
    canReview: canControl && !!record,
    needsReview: state?.needsReview,
    manualStats: state?.manualStats,
    specialLosses: state?.losses?.some(l => l.role === "special"),
    gradeLosses: state?.gradeLosses,
    effectiveLevel: state?.effectiveLevel,
    baseLevel: state?.baseLevel,
    buildNote: !!state?.levels || state?.needsReview,
    losses: (state?.losses ?? []).map(l => ({
      id: l.id,
      source: l.source,
      quality:
        l.forfeit?.kind === "quality"
          ? qualityLabel(l.forfeit.before)
          : l.forfeit?.kind === "feat"
            ? l.forfeit.name
            : l.forfeit?.kind === "manual"
              ? l.forfeit.note
              : ""
    }))
  };
}
