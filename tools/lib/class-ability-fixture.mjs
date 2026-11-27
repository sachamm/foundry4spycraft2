import { computeAgent } from "../../module/rules/engine.mjs";

/** Isolate ability calculations on partial class fixtures; entry and ongoing qualification have separate integration tests. */
export function isolatedClassAbilityCalculation(system, items, cfg, options = {}) {
  return computeAgent(
    system,
    items.map(item =>
      item.type === "class" && item.system.expert ? { ...item, system: { ...item.system, requirements: null } } : item
    ),
    cfg,
    options
  );
}
