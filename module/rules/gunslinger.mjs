/**
 * Gunslinger’s Eye, p.182: as a free action, the character sizes up another character, learning their ranged attack
 * bonus, Initiative bonus and number of Ranged Combat feats; the target may spend 1 action die per detail to keep it
 * hidden (the GC asks). Uses per session: the character’s Ranged Combat feats. The same character can be sized up
 * once per mission.
 */
import { loc } from "../i18n.mjs";

const rangedFeats = system =>
  new Set((system?.activeFeatSelections ?? []).filter(f => f?.tree === "Ranged Combat").map(f => f.name)).size;

export function gunslingerSpec(system) {
  return system?.activeFeatNames?.includes("Gunslinger's Eye")
    ? {
        id: "gunslingersEye",
        name: loc`Gunslinger’s Eye`,
        period: "session",
        limit: rangedFeats(system),
        workflow: "gunslingersEye"
      }
    : null;
}

/** What the character learns, or an error if this target was already sized up this mission. */
export function gunslingerReading(target, { history = {}, mission = "initial" } = {}) {
  if (!target?.uuid) throw new Error(loc`Choose a character to size up.`);
  if ((history[mission] ?? []).includes(target.uuid))
    throw new Error(loc`${target.name} was already sized up this mission.`);
  const s = target.system ?? {};
  return {
    rangedAttack: s.attack?.ranged ?? null,
    initiative: s.initiative?.total ?? null,
    rangedFeats: rangedFeats(s)
  };
}

export const gunslingerNote = (target, r) =>
  loc`Gunslinger’s Eye on ${target.name}: ranged attack bonus ${r.rangedAttack ?? "?"}, Initiative bonus ${r.initiative ?? "?"}, ${r.rangedFeats} Ranged Combat feats. The target may spend 1 action die per detail to keep it hidden (p.182).`;
