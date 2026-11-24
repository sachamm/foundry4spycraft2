/** Serialized into the adventure's GM macro; keep this function independent of imports and closures. */
export async function configureGlassWakeMission({ mission, emptyMission, participants }) {
  if (!game.user.isGM) return ui.notifications.warn("Only the GM can configure this mission.");
  if (game.system.id !== "spycraft2")
    return ui.notifications.error("Operation Glass Wake requires The Field Agent's Handbook system.");
  const same = (a, b) => {
    if (a === b) return true;
    if (!a || !b || typeof a !== "object" || typeof b !== "object") return false;
    const keys = Object.keys(a);
    return keys.length === Object.keys(b).length && keys.every(key => Object.hasOwn(b, key) && same(a[key], b[key]));
  };
  const empty = () => same({ ...emptyMission, ...game.settings.get("spycraft2", "mission") }, emptyMission);
  const imported = () =>
    participants.every(({ id, key, type }) => {
      const actor = game.actors.get(id);
      return actor?.type === type && actor.flags?.spycraft2?.glassWake === key;
    });
  if (!imported())
    return ui.notifications.warn("Import all Operation Glass Wake adventure content before configuring its mission.");
  if (!empty())
    return ui.notifications.warn(
      "A mission record already exists. Glass Wake will not replace it. Use a new world or deliberately archive and clear that record through GC Console first."
    );
  const accepted = await foundry.applications.api.DialogV2.confirm({
    window: { title: "Configure Operation Glass Wake" },
    content:
      '<div class="spycraft2-roll-options"><p>Create an inactive TL 1 / Caliber II mission with four agents, two objectives and two planned antagonist types? Action dice, XP, world time and the active scene will be unchanged.</p></div>'
  });
  if (!accepted) return;
  if (!empty() || !imported())
    return ui.notifications.warn(
      "The mission or imported actors changed while the dialog was open. Nothing was replaced."
    );
  await game.settings.set("spycraft2", "mission", structuredClone(mission));
  ui.notifications.info(
    "Glass Wake mission prepared. Review it in GC Console, Start mission, then initialize four players at Caliber II for eight GC dice."
  );
  await game.spycraft2.gc.open();
}
