import { restraintActionBlock } from "./restraints.mjs";
import { attributeActionBlock } from "./attributes.mjs";
import { computeAgent } from "./engine.mjs";
/** I Can Swim p.200: only current-level points can still be deferred legally. */
export function deferredSkillPools(system, items) {
  if (
    !system.activeFeatNames?.includes("I Can Swim") ||
    !Number.isSafeInteger(system.level) ||
    system.level < 1 ||
    system.level > 20
  )
    return null;
  const current = system.skillPoints?.find(p => p.level === system.level),
    training = items
      .filter(
        f =>
          f.type === "feat" &&
          f.name === "Training" &&
          system.featStatus?.[f.id]?.ok &&
          (f.system.acquiredAtLevel || 1) === system.level
      )
      .map(f => ({
        id: f.id,
        name: f.name,
        remaining: 5 - Object.values(f.system.trainingSkills ?? {}).reduce((n, v) => n + v, 0)
      }));
  return {
    level: system.level,
    careerPoints: Number.isSafeInteger(current?.remaining) && current.remaining > 0 ? current.remaining : 0,
    training: training.filter(p => Number.isSafeInteger(p.remaining) && p.remaining > 0)
  };
}
export function deferredSkillPlan(
  system,
  items,
  cfg,
  key,
  {
    points = 0,
    trainingPoints = {},
    level = system.level,
    freeActionConfirmed = false,
    beforeSkillCheckConfirmed = false
  } = {}
) {
  const incapacity =
    restraintActionBlock(system, { free: true }) || attributeActionBlock(system, { kind: "mentalAbility" });
  if (incapacity) throw new Error(incapacity);
  const pools = deferredSkillPools(system, items);
  if (!pools) throw new Error("An eligible I Can Swim feat is required.");
  if (level !== system.level) throw new Error("The career level changed while choosing deferred points.");
  if (freeActionConfirmed !== true || beforeSkillCheckConfirmed !== true)
    throw new Error("Declare the free action before this skill check.");
  if (!Object.hasOwn(cfg.skills, key)) throw new Error("Choose an existing skill.");
  const priority = (system.skillPurchaseIssues ?? []).find(
    i => i.code === "unlocked-potential" && i.level === level && i.skill !== key
  );
  if (priority) throw new Error(priority.message);
  if (!Number.isSafeInteger(points) || points < 0 || points > pools.careerPoints)
    throw new Error("Choose available whole current-level skill points.");
  if (!trainingPoints || typeof trainingPoints !== "object" || Array.isArray(trainingPoints))
    throw new Error("Review the Training point allocations.");
  const progression = structuredClone(system.progression),
    updates = [];
  let totalPoints = points;
  if (points)
    progression.at(-1).skills = {
      ...progression.at(-1).skills,
      [key]: (progression.at(-1).skills?.[key] ?? 0) + points
    };
  for (const [id, amount] of Object.entries(trainingPoints)) {
    const pool = pools.training.find(p => p.id === id);
    if (!pool || !Number.isSafeInteger(amount) || amount < 0 || amount > pool.remaining)
      throw new Error("Choose available whole points from a current-level Training source.");
    if (!amount) continue;
    const feat = items.find(i => i.id === id);
    updates.push({
      _id: id,
      "system.trainingSkills": {
        ...feat.system.trainingSkills,
        [key]: (feat.system.trainingSkills?.[key] ?? 0) + amount
      }
    });
    totalPoints += amount;
  }
  if (!totalPoints) throw new Error("Choose at least one deferred skill point.");
  const candidate = structuredClone(system);
  candidate.progression = progression;
  const data = items.map(i => ({
    ...i,
    system: {
      ...i.system,
      ...(updates.some(u => u._id === i.id)
        ? { trainingSkills: updates.find(u => u._id === i.id)["system.trainingSkills"] }
        : {})
    }
  }));
  computeAgent(candidate, data, cfg);
  if (candidate.skillPoints.at(-1).remaining < 0) throw new Error("These purchases exceed current-level skill points.");
  if (candidate.warnings.some(w => w.startsWith(`Level ${level}: ${cfg.skills[key].name} cross-class ranks cost`)))
    throw new Error("Spend whole-rank point costs; cross-class ranks ordinarily cost two points each.");
  for (const [skill, total] of Object.entries(candidate.skillTotals))
    if (total.ranks > (system.skillTotals?.[skill]?.ranks ?? 0) && total.ranks > total.maxRanks)
      throw new Error(`The purchase exceeds ${cfg.skills[skill].name}’s current maximum rank.`);
  const ranks = candidate.skillTotals[key].ranks - system.skillTotals[key].ranks;
  if (!Number.isSafeInteger(ranks) || ranks < 1)
    throw new Error("These points must purchase at least one whole rank in the skill being checked.");
  return {
    level,
    skill: key,
    points,
    trainingPoints: structuredClone(trainingPoints),
    totalPoints,
    ranks,
    progression,
    updates
  };
}
/** Deadline includes Training: a new level cannot carry this deferred balance forward. */
export function deferredSkillDeadline(system, items) {
  if (!system.activeFeatNames?.includes("I Can Swim")) return [];
  const pending = (system.skillPoints ?? [])
    .filter(p => p.remaining > 0)
    .map(p => `level ${p.level}: ${p.remaining} skill point(s)`);
  for (const feat of items.filter(f => f.type === "feat" && f.name === "Training" && system.featStatus?.[f.id]?.ok)) {
    const remaining = 5 - Object.values(feat.system.trainingSkills ?? {}).reduce((n, v) => n + v, 0);
    if (remaining > 0) pending.push(`Training (${feat.id}): ${remaining} skill point(s)`);
  }
  return pending;
}
