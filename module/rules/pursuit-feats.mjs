import { loc } from "../i18n.mjs";
/** Terrain feats, p.206. The declared role describes this check, not a persistent combat stance. */
export function pursuitSkillPlan(system, key, check, { manhuntRole = "", chaseRole = "", manhuntPrey = false } = {}) {
  if (!["", "predator", "prey"].includes(manhuntRole) || !["", "predator", "prey"].includes(chaseRole))
    throw new Error(loc`Choose a listed manhunt or chase role.`);
  if (manhuntPrey === true && manhuntRole === "predator")
    throw new Error(loc`A manhunt check cannot be both Predator and Prey.`);
  const role = manhuntPrey === true ? "prey" : manhuntRole,
    feats = new Set(system.activeFeatNames ?? []),
    source =
      role === "predator" && feats.has("Always Get Your Man")
        ? "Always Get Your Man"
        : role === "prey" && feats.has("Escape and Evasion Training")
          ? "Escape and Evasion Training"
          : null;
  const maneuver = check.id === "maneuver",
    chaseSource =
      maneuver && chaseRole === "predator" && feats.has("Always Get Your Man")
        ? "Always Get Your Man"
        : maneuver && chaseRole === "prey" && feats.has("Escape and Evasion Training")
          ? "Escape and Evasion Training"
          : null;
  if (!source && !chaseSource) return { bonuses: [], synergies: [], maximum: 5, evidence: null, notes: [] };
  const terrainFeats = (system.activeFeatSelections ?? [])
    .filter(f => f.tree === "terrain")
    .map(f => ({ name: f.name, choice: f.choice ?? "" }))
    .sort((a, b) => a.name.localeCompare(b.name) || a.choice.localeCompare(b.choice));
  const maximum = source ? 5 + terrainFeats.length : 5,
    bonuses = [],
    synergies = [];
  if (source && ((role === "predator" && key === "investigation") || (role === "prey" && key === "blend")))
    bonuses.push({ type: "synergy", value: 3, source });
  if (source && role === "prey") synergies.push({ skill: "falsify", focusSkill: false, focus: "", condition: "" });
  if (chaseSource)
    synergies.push({
      skill: chaseRole === "predator" ? "investigation" : "bluff",
      focusSkill: false,
      focus: "",
      condition: ""
    });
  const ranks = Object.fromEntries(
    [...new Set(synergies.map(s => s.skill))].map(k => [k, system.skillTotals?.[k]?.ranks ?? 0])
  );
  return {
    bonuses,
    synergies,
    maximum,
    evidence: {
      version: 1,
      source,
      chaseSource,
      manhuntRole: source ? role : "",
      chaseRole: chaseSource ? chaseRole : "",
      skillKey: key,
      checkId: check.id,
      maximum,
      terrainFeats,
      synergyRanks: ranks,
      featSynergy: bonuses.length ? 3 : 0
    },
    notes: [
      loc`${[source, chaseSource].filter((n, i, a) => n && a.indexOf(n) === i).join("; ")}: ${source ? loc`declared ${role} in a manhunt; maximum synergy +${maximum}. ` : ""}${chaseSource ? loc`declared ${chaseRole} Maneuver in a chase. ` : ""}Named synergy bonuses compete; skill-derived synergy is unavailable for passive checks (pp.92,96,206). Conflict actions and outcomes are resolved separately.`
    ]
  };
}
