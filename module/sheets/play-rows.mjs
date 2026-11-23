/** Small view helpers for rows shared by the agent's Play tab and the NPC sheet. */
import { loc } from "../i18n.mjs";
import { formatRange } from "../rules/outcome-labels.mjs";

/** The facts a weapon row shows after its rolls: threat and error ranges, then the range increment. */
export function weaponFacts(attack = {}) {
  const facts = [loc`threat ${formatRange("threat", attack.threat)}`, loc`error ${formatRange("error", attack.error)}`];
  if (Number(attack.range) > 0) facts.push(loc`range ${attack.range} ft.`);
  return facts.join(" · ");
}
