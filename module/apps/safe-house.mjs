import {
  safeHouseSource,
  safeHouseDeclarationPlan,
  safeHouseGrant,
  safeHouseState,
  safeHousePlacementPlan
} from "../rules/safe-house.mjs";
import { queueResources } from "../services/transactions.mjs";
import { loc } from "../i18n.mjs";
const state = a => ({ ...a.system, usagePeriods: a.usagePeriods }),
  same = (a, b) => JSON.stringify(a) === JSON.stringify(b),
  num = v => (typeof v === "number" ? v : typeof v === "string" && v.trim() ? Number(v) : NaN);
const recipients = actor =>
  game.users?.filter?.(u => u.isGM || actor.testUserPermission?.(u, "OWNER")).map(u => u.id) ?? [game.user.id];
export async function useSafeHouse(actor, options = {}) {
  if (actor.type !== "agent" || !actor.isOwner) return null;
  const source = safeHouseSource(state(actor));
  if (!source) throw new Error(loc`An active Safe House feat and Lifestyle 3+ are required.`);
  let input = options;
  if (!Object.keys(input).length) {
    input = await foundry.applications.api.DialogV2.input({
      window: { title: loc`Safe House: scene-opening declaration` },
      rejectClose: false,
      content: `<div class="spycraft2-roll-options"><label>${loc`Current location`} <input name="currentLocation" maxlength="200" /></label><label>${loc`Current city population (0 outside a city)`} <input name="population" type="number" min="0" step="1" /></label><label><input name="locationConfirmed" type="checkbox" /> ${loc`The GC confirms this location and population`}</label><label><input name="atSceneStartConfirmed" type="checkbox" /> ${loc`This is the declaration at the start of this scene`}</label><p>${loc`In a city of 10,000+, the house is within 10 miles. Otherwise, the GC chooses its exact location in the nearest city of 10,000+. Its home quality is Lifestyle −2; all houses are lost at mission end.`}</p></div>`
    });
    if (!input) return null;
    input = { ...input, population: num(input.population) };
  }
  safeHouseDeclarationPlan(state(actor), input);
  return actor.useLimitedAbility(
    "safeHouseMission",
    async () => {
      const guard = () => {
        if (!same(safeHouseSource(state(actor)), source))
          throw new Error(loc`The Safe House source, Lifestyle, mission or scene changed before posting.`);
      };
      guard();
      const plan = safeHouseDeclarationPlan(state(actor), input),
        id = "house_" + foundry.utils.randomID(),
        record = safeHouseGrant(plan, {
          id,
          missionUse: actor.system.resourceUses.safeHouseMission,
          sceneUse: actor.system.resourceUses.safeHouseScene,
          at: game.time?.worldTime ?? 0
        }),
        path = "system.safeHouses." + id;
      if (Object.hasOwn(actor.system.safeHouses ?? {}, id))
        throw new Error(loc`A unique Safe House declaration identifier is required.`);
      let saved = false;
      try {
        await actor.update({ [path]: record });
        saved = true;
        guard();
        if (!same(actor.system.safeHouses?.[id], record))
          throw new Error(loc`The saved Safe House declaration is incomplete.`);
        const s = safeHouseState(state(actor), record, CONFIG.SPYCRAFT);
        if (!s.active) throw new Error(s.reason);
        await ChatMessage.create({
          speaker: ChatMessage.getSpeaker({ actor }),
          whisper: recipients(actor),
          content: loc`Safe House declared: ${foundry.utils.escapeHTML(record.currentLocation)}; ${record.route === "withinTenMiles" ? loc`within 10 miles in this city` : loc`in the nearest city with 10,000+ people, exact location chosen by the GC`}. Home tier ${record.houseRank}: ${foundry.utils.escapeHTML(s.home)}. GC placement pending; lost at mission end.`,
          flags: {
            spycraft2: {
              actorUuid: actor.uuid,
              safeHouseDeclaration: structuredClone(record),
              actionDiceAllowed: false
            }
          }
        });
        return record;
      } catch (error) {
        const posted = game.messages?.find?.(
          m => m.flags?.spycraft2?.actorUuid === actor.uuid && m.flags.spycraft2.safeHouseDeclaration?.id === id
        );
        if (posted) return record;
        if (saved || actor.system.safeHouses?.[id]) {
          try {
            await actor.update({ ["system.safeHouses.-=" + id]: null });
          } catch {
            ui.notifications.warn(
              loc`The Safe House declaration may still exist; its uses remain spent. Review the record and counters before retrying.`
            );
            return record;
          }
        }
        throw error;
      }
    },
    { workflow: "safeHouseDeclaration", additionalUses: [{ id: "safeHouseScene", workflow: "safeHouseScene" }] }
  );
}
export async function placeSafeHouse(actor, id, options = {}) {
  if (!game.user?.isGM || !actor.isOwner) throw new Error(loc`Only an owning GC can place the Safe House.`);
  const original = actor.system.safeHouses?.[id],
    s = safeHouseState(state(actor), { ...original, placement: null }, CONFIG.SPYCRAFT);
  if (original?.id !== id || !s.active) throw new Error(s.reason || loc`Choose a valid current-mission Safe House.`);
  const expected = JSON.stringify(original);
  let input = options;
  if (!Object.keys(input).length) {
    input = await foundry.applications.api.DialogV2.input({
      window: { title: loc`GC: place the declared Safe House` },
      rejectClose: false,
      content: `<div class="spycraft2-roll-options"><p>${loc`Home tier ${s.rank}: ${foundry.utils.escapeHTML(s.home)}. Declaration: ${foundry.utils.escapeHTML(original.currentLocation)}.`}</p><label>${loc`City`} <input name="city" maxlength="200" value="${foundry.utils.escapeHTML(String(original.placement?.city ?? ""))}" /></label><label>${loc`City population`} <input name="cityPopulation" type="number" min="10000" step="1" value="${Number.isSafeInteger(original.placement?.cityPopulation) ? original.placement.cityPopulation : 10000}" /></label><label>${loc`Exact location`} <input name="address" maxlength="1000" value="${foundry.utils.escapeHTML(String(original.placement?.address ?? ""))}" /></label><label>${loc`Home description`} <input name="description" maxlength="1000" value="${foundry.utils.escapeHTML(String(original.placement?.description ?? ""))}" /></label>${original.route === "withinTenMiles" ? `<label><input name="currentCityConfirmed" type="checkbox" /> ${loc`This is the declaration’s current city`}</label><label><input name="withinTenMilesConfirmed" type="checkbox" /> ${loc`The house is within 10 miles`}</label>` : `<label><input name="nearestCityConfirmed" type="checkbox" /> ${loc`This is the nearest city with 10,000+ people`}</label>`}<label><input name="natureConfirmed" type="checkbox" /> ${loc`The home matches the listed Lifestyle tier`}</label><label><input name="gcConfirmed" type="checkbox" /> ${loc`I confirm the exact location and description`}</label></div>`
    });
    if (!input) return null;
    input = { ...input, cityPopulation: num(input.cityPopulation) };
  }
  return queueResources([actor], async () => {
    if (!game.user?.isGM || !actor.isOwner || JSON.stringify(actor.system.safeHouses?.[id]) !== expected)
      throw new Error(loc`The Safe House or ownership changed during placement.`);
    const r = actor.system.safeHouses[id],
      current = safeHouseState(state(actor), { ...r, placement: null }, CONFIG.SPYCRAFT);
    if (!current.active) throw new Error(current.reason);
    const placement = {
      ...safeHousePlacementPlan(state(actor), r, input),
      reviewedBy: game.user.id,
      at: game.time?.worldTime ?? 0
    };
    await actor.update({ ["system.safeHouses." + id + ".placement"]: placement });
    return placement;
  });
}

export async function correctSafeHouseRecord(actor, id, options = {}) {
  if (
    !game.user?.isGM ||
    !actor.isOwner ||
    !Object.hasOwn(actor.system.safeHouses ?? {}, id) ||
    !/^[A-Za-z0-9_-]+$/.test(id)
  )
    throw new Error(loc`Only an owning GC can correct a recorded Safe House declaration.`);
  const record = structuredClone(actor.system.safeHouses[id]),
    previous = structuredClone(actor.flags?.spycraft2?.safeHouseCorrections ?? []),
    expected = JSON.stringify([record, previous]);
  let input = options;
  if (!Object.keys(input).length) {
    input = await foundry.applications.api.DialogV2.input({
      window: { title: loc`Correct erroneous Safe House history` },
      rejectClose: false,
      content: `<div class="spycraft2-roll-options"><p>${loc`This archives an erroneous declaration. It does not refund mission or scene uses; review the actual counters separately if needed.`}</p><label>${loc`Reason`} <input name="reason" maxlength="1000" required /></label><label><input name="confirmed" type="checkbox" /> ${loc`The GC confirms this declaration is erroneous and should be archived`}</label></div>`
    });
    if (!input) return null;
  }
  if (
    input.confirmed !== true ||
    typeof input.reason !== "string" ||
    !input.reason.trim() ||
    input.reason.length > 1000
  )
    throw new Error(loc`Confirm the erroneous declaration and explain the correction.`);
  return queueResources([actor], async () => {
    if (
      !game.user?.isGM ||
      !actor.isOwner ||
      JSON.stringify([actor.system.safeHouses?.[id], actor.flags?.spycraft2?.safeHouseCorrections ?? []]) !== expected
    )
      throw new Error(loc`Safe House history or ownership changed during correction.`);
    await actor.update({
      ["system.safeHouses.-=" + id]: null,
      "flags.spycraft2.safeHouseCorrections": [
        ...previous,
        { id, record, reason: input.reason.trim(), reviewedBy: game.user.id, at: game.time?.worldTime ?? 0 }
      ]
    });
    return record;
  });
}
