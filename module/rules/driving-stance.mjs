import { conditionRollPenalties } from "./attributes.mjs";
import { loc } from "../i18n.mjs";
export const drivingPenalty = actor => conditionRollPenalties(actor.system).damage;
export const drivingFormula = penalty => (penalty ? "max(0, (1d4) + (" + penalty + "))" : "1d4");
export const stableDriving = v =>
  JSON.stringify(v, (_k, x) =>
    x && typeof x === "object" && !Array.isArray(x)
      ? Object.fromEntries(
          Object.keys(x)
            .sort()
            .map(k => [k, x[k]])
        )
      : x
  );
export const drivingMessages = () =>
  typeof game.messages?.values === "function" ? [...game.messages.values()] : [...(game.messages ?? [])];
export const drivingMessage = id =>
  globalThis.fromUuidSync?.(id) ?? drivingMessages().find(m => m.uuid === id || m.id === id);
const visible = m => m && m.visible !== false && m.isContentVisible !== false && (!m.blind || game.user.isGM);
function hitFacts(c) {
  return {
    actorUuid: c.actorUuid,
    checkKind: c.checkKind,
    resolved: c.resolved,
    successConfirmed: c.successConfirmed,
    superseded: c.superseded ?? null,
    weaponUuid: c.weaponUuid ?? null,
    attackContext: {
      ranged: c.attackContext?.ranged,
      combatStance: c.attackContext?.combatStance,
      disarm: c.attackContext?.disarm ?? null,
      targetActorUuid: c.attackContext?.targetActorUuid ?? null,
      characterTarget: c.attackContext?.characterTarget ?? null
    }
  };
}
function attackRoot(actor, m) {
  const initial = m.flags.spycraft2,
    seen = new Set();
  let current = m;
  while (current && !seen.has(current.uuid)) {
    seen.add(current.uuid);
    const c = current.flags?.spycraft2;
    if (
      c?.actorUuid !== actor.uuid ||
      c.checkKind !== "attack" ||
      (c.weaponUuid ?? null) !== (initial.weaponUuid ?? null) ||
      c.attackContext?.ranged !== false ||
      stableDriving(c.attackContext?.combatStance) !== stableDriving(initial.attackContext.combatStance)
    )
      throw Error(loc`The original Driving Stance attack changed.`);
    if (!c.rerollOf) return current.uuid;
    const p = drivingMessage(c.rerollOf);
    if (p?.flags?.spycraft2?.superseded !== current.uuid)
      throw Error(loc`Use the actually adopted original Driving Stance hit.`);
    current = p;
  }
  throw Error(loc`The original Driving Stance hit is missing or cyclic.`);
}
export function drivingHit(actor, reference) {
  const m = drivingMessage(typeof reference === "string" ? reference : reference?.uuid),
    c = m?.flags?.spycraft2,
    s = c?.attackContext?.combatStance?.stance;
  if (!actor.isOwner || !visible(m) || c?.actorUuid !== actor.uuid)
    throw Error(loc`Choose your own readable Driving Stance attack; the GC resolves secret hits.`);
  if (
    c.checkKind !== "attack" ||
    c.resolved !== true ||
    c.successConfirmed !== true ||
    c.superseded ||
    c.attackContext?.ranged !== false ||
    c.attackContext?.disarm?.role === "defender" ||
    c.attackContext?.combatStance?.version !== 1 ||
    s?.version !== 1 ||
    s.key !== "driving" ||
    s.feat !== "Hammer Basics" ||
    typeof s.id !== "string" ||
    !s.id ||
    c.attackContext?.characterTarget?.object === true
  )
    throw Error(loc`Choose a finished successful melee hit made in Driving Stance against an opponent.`);
  const targetUuid = c.attackContext?.targetActorUuid ?? c.attackContext?.characterTarget?.actorUuid,
    target = targetUuid && globalThis.fromUuidSync?.(targetUuid);
  if (!targetUuid || !["agent", "npc"].includes(target?.type) || target.uuid === actor.uuid)
    throw Error(loc`The Driving Stance hit must identify its actual character opponent.`);
  return {
    version: 1,
    actorUuid: actor.uuid,
    sourceMessage: m.uuid,
    rootAttackUuid: attackRoot(actor, m),
    targetUuid,
    stanceId: s.id,
    sourceEvidence: stableDriving(hitFacts(c)),
    visibility: {
      blind: m.blind === true,
      whisper: [...(m.whisper ?? [])].map(u => (typeof u === "string" ? u : u.id)).sort()
    }
  };
}
export function drivingFacts(actor, reference, input = {}) {
  const hit = drivingHit(actor, reference);
  if (
    input.outcomeConfirmed !== true ||
    !["push", "blocked"].includes(input.outcome) ||
    input.routeConfirmed !== true ||
    typeof input.follow !== "boolean" ||
    (input.outcome === "blocked" && input.follow)
  )
    throw Error(
      loc`Confirm the actual push route or occupied/blocked destination; following is available only after a push.`
    );
  return {
    ...hit,
    outcome: input.outcome,
    pushFeet: input.outcome === "push" ? 5 : 0,
    followFeet: input.follow ? 5 : 0,
    damagePenalty: input.outcome === "blocked" ? drivingPenalty(actor) : 0,
    damageFormula: input.outcome === "blocked" ? drivingFormula(drivingPenalty(actor)) : null,
    damageType: input.outcome === "blocked" ? "subdual" : null
  };
}
export function drivingRows(actor) {
  const rows = actor.flags?.spycraft2?.drivingStanceUses ?? [],
    roots = new Set();
  if (!Array.isArray(rows)) throw Error(loc`Review recorded Driving Stance outcomes.`);
  for (const r of rows) {
    const p = r?.proof;
    if (
      r?.version !== 1 ||
      typeof r.id !== "string" ||
      !r.id ||
      p?.version !== 1 ||
      p.outcomeId !== r.id ||
      p.actorUuid !== actor.uuid ||
      typeof p.rootAttackUuid !== "string" ||
      !p.rootAttackUuid ||
      roots.has(p.rootAttackUuid) ||
      typeof p.sourceEvidence !== "string" ||
      !p.sourceEvidence ||
      !["push", "blocked"].includes(p.outcome) ||
      p.pushFeet !== (p.outcome === "push" ? 5 : 0) ||
      ![0, 5].includes(p.followFeet) ||
      (p.outcome === "blocked" &&
        (p.followFeet !== 0 ||
          ![-2, 0].includes(p.damagePenalty) ||
          p.damageFormula !== drivingFormula(p.damagePenalty) ||
          p.damageType !== "subdual")) ||
      (p.outcome === "push" && (p.damageFormula !== null || p.damageType !== null)) ||
      (r.receiptUuid != null && (typeof r.receiptUuid !== "string" || !r.receiptUuid))
    )
      throw Error(loc`Review the recorded Driving Stance outcome references.`);
    roots.add(p.rootAttackUuid);
  }
  return rows;
}
export function validateDrivingSource(actor, proof) {
  const fresh = drivingHit(actor, proof.sourceMessage),
    { outcomeId, outcome, pushFeet, followFeet, damagePenalty, damageFormula, damageType, ...old } = proof;
  if (stableDriving(fresh) !== stableDriving(old)) throw Error(loc`The actual Driving Stance hit or target changed.`);
  const expected = drivingFacts(actor, proof.sourceMessage, {
    outcome,
    outcomeConfirmed: true,
    routeConfirmed: true,
    follow: followFeet === 5
  });
  if (outcome === "blocked") {
    expected.damagePenalty = damagePenalty;
    expected.damageFormula = drivingFormula(damagePenalty);
  }
  if (![-2, 0].includes(damagePenalty) || stableDriving({ ...expected, outcomeId }) !== stableDriving(proof))
    throw Error(loc`The recorded Driving Stance route or damage changed.`);
  return fresh;
}
export function currentDrivingReceipt(actor, row) {
  const p = row.proof,
    matches = drivingMessages().filter(
      m => m.flags?.spycraft2?.actorUuid === actor.uuid && m.flags.spycraft2.drivingStance?.outcomeId === p.outcomeId
    );
  if (!matches.length) return null;
  const finals = matches.filter(m => !m.flags.spycraft2.superseded);
  if (finals.length !== 1) throw Error(loc`Review duplicate Driving Stance outcome results.`);
  let current = finals[0],
    seen = new Set();
  while (current && !seen.has(current.uuid)) {
    seen.add(current.uuid);
    const c = current.flags?.spycraft2;
    if (
      c?.actorUuid !== actor.uuid ||
      stableDriving(c.drivingStance) !== stableDriving(p) ||
      (p.outcome === "blocked" &&
        (c.checkKind !== "damage" ||
          c.checkId !== "drivingStance" ||
          c.formula !== p.damageFormula ||
          c.weaponUuid ||
          c.checkMethod !== "roll")) ||
      (p.outcome === "push" && (c.checkKind !== "drivingStance" || c.actionDiceAllowed !== false || c.rerollOf))
    )
      throw Error(loc`The Driving Stance outcome receipt changed.`);
    if (!c.rerollOf) {
      if (row.receiptUuid && current.uuid !== row.receiptUuid)
        throw Error(loc`The original Driving Stance outcome receipt changed.`);
      return finals[0];
    }
    const previous = drivingMessage(c.rerollOf);
    if (previous?.flags?.spycraft2?.superseded !== current.uuid)
      throw Error(loc`Use the actually adopted Driving Stance damage replacement.`);
    current = previous;
  }
  throw Error(loc`The original Driving Stance outcome is missing or cyclic.`);
}
