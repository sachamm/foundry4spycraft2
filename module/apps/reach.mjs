import { loc } from "../i18n.mjs";
export function reachContextContent(input = {}) {
  return `<fieldset><legend>${loc`Reach weapon geometry`}</legend><p>${loc`Required when the attacking weapon has RCH. The GC confirms adjacency and a legal target within this attack’s Reach; no token measurement or movement is automated.`}</p><label>${loc`Actual target adjacency`} <select name="reachAdjacency"><option value="">${loc`Choose for a Reach weapon`}</option><option value="adjacent"${input.reachAdjacent === true ? " selected" : ""}>${loc`Adjacent square`}</option><option value="nonadjacent"${input.reachAdjacent === false ? " selected" : ""}>${loc`Nonadjacent square`}</option></select></label><label><input name="reachGeometryConfirmed" type="checkbox"${input.reachGeometryConfirmed === true ? " checked" : ""} /> ${loc`The GC confirms the actual target’s adjacency and legal Reach geometry`}</label></fieldset>`;
}
export function reachContextInput(input = {}) {
  const out = {};
  if (Object.hasOwn(input, "reachAdjacent")) {
    if (typeof input.reachAdjacent !== "boolean") throw Error(loc`Declare actual Reach adjacency with a boolean.`);
    out.reachAdjacent = input.reachAdjacent;
  }
  if (Object.hasOwn(input, "reachAdjacency")) {
    if (!["", "adjacent", "nonadjacent"].includes(input.reachAdjacency))
      throw Error(loc`Choose listed Reach adjacency.`);
    if (input.reachAdjacency) {
      const value = input.reachAdjacency === "adjacent";
      if (Object.hasOwn(out, "reachAdjacent") && out.reachAdjacent !== value)
        throw Error(loc`Use one consistent Reach adjacency.`);
      out.reachAdjacent = value;
    }
  }
  if (Object.hasOwn(input, "reachGeometryConfirmed")) {
    if (typeof input.reachGeometryConfirmed !== "boolean") throw Error(loc`Confirm Reach geometry with its checkbox.`);
    out.reachGeometryConfirmed = input.reachGeometryConfirmed;
  }
  return out;
}
