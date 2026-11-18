/**
 * Grapple tricks granted by Unarmed and Melee Combat feats (pp.176–189). The grapple card lists the ones the winner
 * owns, with the numbers worked out from the character, for the players and GC to apply; the summaries are our own,
 * and the page has the full terms.
 */
import { loc } from "../i18n.mjs";

const has = (system, name) => system?.activeFeatNames?.includes(name) === true;
const strMod = system => Number(system?.abilities?.str?.mod) || 0;

export const GRAPPLE_TRICKS = Object.freeze([
  {
    id: "clobber",
    feat: "Battering Blows",
    page: 176,
    text: system => {
      const repeats = 1 + (has(system, "Darting Weapon") ? 1 : 0) + (has(system, "Flashing Weapon") ? 1 : 0);
      return loc`Clobber: holding a readied melee weapon, roll Athletics (Str) at −2 (1-handed) or −4 (2-handed). Success deals unarmed damage, then the weapon’s damage ${repeats} time(s), each with takedown, and moves the opponent to an adjacent open square. Either way the grapple ends and you cannot attack that opponent again this round.`;
    }
  },
  {
    id: "tightenTheNoose",
    feat: "Garrote Basics",
    page: 178,
    text: () =>
      loc`Tighten the Noose: a threat or critical hit on a held opponent starts their suffocation saves as though they had held their breath for twice their Constitution in rounds, until released, escaped or dead.`
  },
  {
    id: "headButt",
    feat: "Brawling Basics",
    page: 185,
    text: () =>
      loc`Head Butt: unarmed damage on an opponent you hold or pin adds twice as much flash damage; while pinned, a full action deals flash damage of twice your unarmed damage to your grappler.`
  },
  {
    id: "sleeperHold",
    feat: "Brawling Supremacy",
    page: 185,
    text: system =>
      loc`Sleeper Hold: free action; an opponent you hold or pin makes a Fortitude save, DC 15 + 1 per consecutive round of use, or sleeps for 1d6 + ${strMod(system)} minutes.`
  },
  {
    id: "snap",
    feat: "Submission Basics",
    page: 188,
    text: () =>
      loc`Snap!: when your unarmed damage hits an opponent you pin, try to break a limb of your choice; they make a Fortitude save (DC 10 + half the damage) or suffer a broken limb critical injury (p.332).`
  },
  {
    id: "boneGrind",
    feat: "Submission Moves",
    page: 188,
    text: () =>
      loc`Bone Grind: 1 point of temporary Strength or Dexterity damage to an opponent you hold or pin, never taking the score below half (rounded up).`
  },
  {
    id: "jointLock",
    feat: "Submission Moves",
    page: 188,
    text: () => loc`Joint Lock: an opponent you hold or pin takes −4 on skill checks to escape.`
  },
  {
    id: "reversal",
    feat: "Submission Moves",
    page: 188,
    text: () => loc`Reversal: while pinned, become held instead and pin your opponent.`
  },
  {
    id: "deathGrip",
    feat: "Submission Supremacy",
    page: 188,
    text: () => loc`Death Grip: Coup de Grace against an opponent you pin.`
  },
  {
    id: "breathtakingHold",
    feat: "Submission Supremacy",
    page: 188,
    text: () =>
      loc`Breathtaking Hold: free action; an opponent you pin suffocates until released, out of the pin or dead.`
  },
  {
    id: "backBreaker",
    feat: "Wrestling Supremacy",
    page: 189,
    text: () => loc`Back Breaker: free action; Coup de Grace against an opponent you pin.`
  },
  {
    id: "fling",
    feat: "Wrestling Moves",
    page: 189,
    text: () =>
      loc`Fling: as the first benefit of a grapple, throw a held opponent up to 15 ft. into an open square for double your unarmed damage; they become sprawled.`
  }
]);

/** The grapple tricks a character owns, as lines for the grapple card. */
export function grappleTrickLines(system) {
  return GRAPPLE_TRICKS.filter(t => has(system, t.feat)).map(t => `${t.text(system)} (${t.feat}, p.${t.page})`);
}
