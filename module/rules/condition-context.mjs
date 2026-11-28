/** Shared status aliases for prepared PCs and NPCs. Conditions remain explicit actor state. */
const aliases = {
  nauseated: ["nauseated"],
  dazed: ["dazed"],
  stunned: ["stunned", "stun"],
  dead: ["dead"],
  paralyzed: ["paralyzed", "paralysis"],
  fatigued: ["fatigued"],
  exhausted: ["exhausted"],
  unconscious: ["unconscious"],
  helpless: ["helpless"],
  vulnerable: ["vulnerable"],
  sickened: ["sickened"],
  drunk: ["drunk"],
  crouched: ["crouched", "crouching"],
  mute: ["mute"],
  baffled: ["baffled"],
  incompetent: ["incompetent"],
  entangled: ["entangled"],
  bound: ["bound"],
  blinded: ["blinded", "blind"],
  deafened: ["deafened", "deaf"],
  flatFooted: ["flat-footed", "flatFooted"],
  sprawled: ["sprawled"],
  prone: ["prone"],
  held: ["held"],
  pinned: ["pinned"],
  sleeping: ["sleeping", "sleep", "asleep"]
};
export function actorConditionContext(actor) {
  const statuses = actor?.statuses ?? new Set(),
    context = Object.fromEntries(Object.entries(aliases).map(([key, ids]) => [key, ids.some(id => statuses.has(id))]));
  if (actor?.type === "npc" && ["dead", "unconscious"].includes(actor.system?.damageTrack?.state))
    context[actor.system.damageTrack.state] = true;
  return context;
}
