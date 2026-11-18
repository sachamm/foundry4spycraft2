import { rollEvidence } from "./outcomes.mjs";
export const stableTakedown = v =>
  JSON.stringify(v, (_k, x) =>
    x && typeof x === "object" && !Array.isArray(x)
      ? Object.fromEntries(
          Object.keys(x)
            .sort()
            .map(k => [k, x[k]])
        )
      : x
  );
export const takedownMessages = () =>
  typeof globalThis.game?.messages?.values === "function"
    ? [...game.messages.values()]
    : [...(globalThis.game?.messages ?? [])];
export const takedownMessage = id =>
  globalThis.fromUuidSync?.(id) ?? takedownMessages().find(m => m.uuid === id || m.id === id);
const readable = m =>
  m && m.visible !== false && m.isContentVisible !== false && (!m.blind || globalThis.game?.user?.isGM === true);
/** Only the adopted replacement chain represents one actual original damage event. */
export function takedownRollRoot(m, kind) {
  const seen = new Set();
  let current = m;
  while (current && !seen.has(current.uuid)) {
    seen.add(current.uuid);
    const c = current.flags?.spycraft2;
    if (
      !c ||
      c.checkKind !== kind ||
      c.actorUuid !== m.flags.spycraft2.actorUuid ||
      c.weaponUuid !== m.flags.spycraft2.weaponUuid
    )
      throw Error("Review the original takedown source roll chain.");
    if (!c.rerollOf) return current.uuid;
    const prior = takedownMessage(c.rerollOf);
    if (prior?.flags?.spycraft2?.superseded !== current.uuid)
      throw Error("Use the actually adopted original takedown source replacement.");
    current = prior;
  }
  throw Error("The original takedown source is missing or cyclic.");
}
export function takedownDC({ preDRDamage, netDamage, woundsLost, confirmed, targetConfirmed } = {}) {
  if (confirmed !== true || targetConfirmed !== true || typeof woundsLost !== "boolean")
    throw Error(
      "The GC must confirm this actual character, applied damage before/after DR and whether the attack lost any wounds."
    );
  if (
    !Number.isSafeInteger(preDRDamage) ||
    preDRDamage < 1 ||
    !Number.isSafeInteger(netDamage) ||
    netDamage < 1 ||
    !Number.isSafeInteger(preDRDamage + (woundsLost ? 10 : 0))
  )
    throw Error(
      "Takedown requires positive whole damage actually sustained; enter its reviewed pre-DR and net amounts."
    );
  return preDRDamage + (woundsLost ? 10 : 0);
}
function sourceEvidence(c) {
  return stableTakedown({
    roll: JSON.parse(rollEvidence(c)),
    weaponUuid: c.weaponUuid,
    weaponQualities: c.weaponQualities ?? "",
    actorUuid: c.actorUuid,
    target: c.attackContext?.targetActorUuid ?? null,
    classification: c.attackContext?.characterTarget ?? null
  });
}
/** Reviewed application facts bind actual finished receipts; this does not apply health damage. */
export function takedownSource(
  actor,
  { attackUuid, damageUuid, preDRDamage, netDamage, woundsLost, confirmed, targetConfirmed } = {}
) {
  const dc = takedownDC({ preDRDamage, netDamage, woundsLost, confirmed, targetConfirmed }),
    attack = takedownMessage(attackUuid),
    damage = takedownMessage(damageUuid),
    a = attack?.flags?.spycraft2,
    d = damage?.flags?.spycraft2;
  if (
    typeof attack?.uuid !== "string" ||
    !attack.uuid ||
    typeof damage?.uuid !== "string" ||
    !damage.uuid ||
    typeof a?.actorUuid !== "string" ||
    !a.actorUuid ||
    !actor?.isOwner ||
    !["agent", "npc"].includes(actor.type) ||
    typeof actor.uuid !== "string" ||
    !readable(attack) ||
    !readable(damage) ||
    a?.checkKind !== "attack" ||
    a.resolved !== true ||
    a.successConfirmed !== true ||
    !Number.isFinite(a.effectiveTotal) ||
    a.superseded ||
    a.attackContext?.disarm?.active === true ||
    d?.checkKind !== "damage" ||
    d.resolved !== true ||
    d.superseded ||
    !Number.isFinite(d.effectiveTotal) ||
    d.effectiveTotal <= 0 ||
    a.actorUuid !== d.actorUuid ||
    typeof a.weaponUuid !== "string" ||
    !a.weaponUuid ||
    a.weaponUuid !== d.weaponUuid ||
    !/\bTKD\b/.test(a.weaponQualities ?? "") ||
    !/\bTKD\b/.test(d.weaponQualities ?? "") ||
    a.attackContext?.characterTarget?.characterType === "object"
  )
    throw Error(
      "Choose the actual finished successful takedown attack and its finished positive damage result with the same weapon."
    );
  const target =
      a.attackContext?.targetActorUuid ||
      a.attackContext?.characterTarget?.actorUuid ||
      a.attackContext?.cheapShot?.targetUuid ||
      a.finalAttack?.opponentUuid ||
      a.finalAttack?.targetUuid ||
      null,
    linked = d.attackDamageBenefit ?? d.sideStanceDamage;
  if (
    (target && target !== actor.uuid) ||
    (linked?.targetUuid && linked.targetUuid !== actor.uuid && linked.targetUuid !== "manual:" + actor.name) ||
    (linked?.attackUuid && linked.attackUuid !== attack.uuid)
  )
    throw Error("Use the actual recorded takedown target and damage from this exact attack.");
  const named =
    a.attackContext?.characterTarget?.source === "gcManual"
      ? a.attackContext.characterTarget.name
      : (a.attackContext?.meleeTradeoff?.manualTargetName ??
        a.attackContext?.bullseye?.manualTargetName ??
        a.attackContext?.meleeTrick?.manualTargetName);
  if (!target && named && named !== actor.name)
    throw Error("The recorded unrecorded target name must match this actual character.");
  return {
    version: 1,
    targetUuid: actor.uuid,
    attackUuid: attack.uuid,
    attackRootUuid: takedownRollRoot(attack, "attack"),
    damageUuid: damage.uuid,
    damageRootUuid: takedownRollRoot(damage, "damage"),
    sourceActorUuid: a.actorUuid,
    weaponUuid: a.weaponUuid,
    sourceEvidence: [sourceEvidence(a), sourceEvidence(d)],
    preDRDamage,
    netDamage,
    woundsLost,
    confirmed: true,
    targetConfirmed: true,
    ...(!target && named ? { targetNameAtReview: actor.name } : {}),
    dc
  };
}
export function takedownRows(actor) {
  const rows = actor.flags?.spycraft2?.takedownEvents ?? [],
    ids = new Set(),
    roots = new Set();
  if (!Array.isArray(rows)) throw Error("Review the recorded takedown events.");
  for (const r of rows) {
    if (
      r?.version !== 1 ||
      typeof r.id !== "string" ||
      !r.id ||
      ids.has(r.id) ||
      r.proof?.eventId !== r.id ||
      r.proof.version !== 1 ||
      !Number.isSafeInteger(r.proof.dc) ||
      r.proof.dc < 1 ||
      !Array.isArray(r.proof.sourceEvidence) ||
      r.proof.sourceEvidence.length !== 2 ||
      r.proof.sourceEvidence.some(s => typeof s !== "string") ||
      typeof r.proof.receiptId !== "string" ||
      !r.proof.receiptId ||
      r.proof.targetUuid !== actor.uuid ||
      typeof r.proof.damageRootUuid !== "string" ||
      !r.proof.damageRootUuid ||
      (r.settlement != null &&
        (r.settlement.version !== 1 ||
          r.settlement.eventId !== r.id ||
          !["prepared", "applied"].includes(r.settlement.state) ||
          typeof r.settlement.succeeded !== "boolean" ||
          typeof r.settlement.wasSprawled !== "boolean" ||
          r.settlement.operationId !== "takedown-" + r.id ||
          typeof r.settlement.evidence !== "string" ||
          typeof r.settlement.saveUuid !== "string")) ||
      roots.has(r.proof.damageRootUuid) ||
      (r.saveUuid != null && (typeof r.saveUuid !== "string" || !r.saveUuid))
    )
      throw Error("Review the recorded takedown event references.");
    ids.add(r.id);
    roots.add(r.proof.damageRootUuid);
  }
  return rows;
}
export function validateTakedownSource(actor, proof) {
  const { eventId, receiptId, ...facts } = proof ?? {},
    current = takedownSource(
      proof?.targetNameAtReview
        ? { type: actor.type, isOwner: actor.isOwner, uuid: actor.uuid, name: proof.targetNameAtReview }
        : actor,
      facts
    );
  if (
    typeof eventId !== "string" ||
    !eventId ||
    typeof receiptId !== "string" ||
    !receiptId ||
    stableTakedown(facts) !== stableTakedown(current)
  )
    throw Error("The recorded takedown attack, damage, target or reviewed application facts changed.");
  return current;
}
export function currentTakedownSave(actor, row) {
  const roots = takedownMessages().filter(
    m =>
      m.flags?.spycraft2?.actorUuid === actor.uuid &&
      m.flags.spycraft2.checkKind === "save" &&
      m.flags.spycraft2.checkId === "fort" &&
      m.flags.spycraft2.takedown?.eventId === row.id &&
      m.flags.spycraft2.takedown?.receiptId === row.proof.receiptId &&
      !m.flags.spycraft2.rerollOf
  );
  if (roots.length > 1) throw Error("Multiple original takedown saves require GC review.");
  if (
    roots[0] &&
    (stableTakedown(roots[0].flags.spycraft2.takedown) !== stableTakedown(row.proof) ||
      (row.saveUuid && row.saveUuid !== roots[0].uuid))
  )
    throw Error("The original takedown save receipt changed.");
  let current = roots[0],
    seen = new Set();
  while (current?.flags.spycraft2.superseded) {
    if (seen.has(current.uuid)) throw Error("Review the cyclic takedown save chain.");
    seen.add(current.uuid);
    const next = takedownMessage(current.flags.spycraft2.superseded);
    if (
      next?.flags?.spycraft2?.rerollOf !== current.uuid ||
      next.flags.spycraft2.actorUuid !== actor.uuid ||
      stableTakedown(next.flags.spycraft2.takedown) !== stableTakedown(row.proof)
    )
      throw Error("Review the actually adopted takedown save replacement.");
    current = next;
  }
  return current ?? null;
}
