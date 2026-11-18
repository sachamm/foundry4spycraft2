/** Hand of God (Spirit Supremacy, p.187): once per round in Total Defense, an adjacent opponent who misses suffers their own damage. */
import { loc } from "../i18n.mjs";

export const handOfGodEligible = (system, check) =>
  system?.activeFeatNames?.includes("Spirit Supremacy") === true &&
  system.totalDefenseState?.active === true &&
  check?.checkKind === "attack" &&
  check.resolved === true &&
  check.successConfirmed === false &&
  !check.superseded &&
  !check.handOfGod &&
  check.ranged !== true &&
  check.attackContext?.ranged !== true;

export const handOfGodSpec = system =>
  system?.activeFeatNames?.includes("Spirit Supremacy")
    ? {
        id: "handOfGod",
        name: loc`Hand of God (a missing adjacent opponent suffers their own damage)`,
        period: "round",
        limit: 1,
        workflow: "handOfGod",
        combatScoped: true,
        manualReviewable: true,
        hidden: true
      }
    : null;
