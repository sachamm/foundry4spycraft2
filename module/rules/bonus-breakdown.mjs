/**
 * How a bonus is made up, as labelled parts that add up to the figure shown (style guide 4.7). The sheets use these
 * for the tooltips on their roll buttons, and a roll records the same parts so its chat card can show them.
 *
 * A part is `{ label, value, keep? }`. A zero part is left out unless `keep` is set, which the parts every character
 * has (class, attribute) use so that a bonus of +0 still says what it is made of.
 *
 * This module is pure: it reads the derived system data and knows nothing about Foundry.
 */
import { loc } from "../i18n.mjs";

const num = value => (Number.isFinite(Number(value)) ? Number(value) : 0);
const sum = rows => rows.reduce((total, row) => total + row.value, 0);

/**
 * The parts that count, and one more for any difference from `total`, so the rows always add up to it.
 * @param {Array<{label: string, value: number, keep?: boolean}|null>} parts
 * @param {number} [total]  the figure the rows must reach; left out, the rows are only tidied
 * @param {string} [restLabel]  what to call the difference
 * @returns {Array<{label: string, value: number}>}
 */
export function breakdownRows(parts, total, restLabel = loc`Other modifiers`) {
  const rows = (parts ?? [])
    .filter(part => part && typeof part.label === "string" && (num(part.value) || part.keep))
    .map(part => ({ label: part.label, value: num(part.value) }));
  if (Number.isFinite(total)) {
    const rest = total - sum(rows);
    if (rest) rows.push({ label: restLabel, value: rest });
  }
  return rows;
}

/** One row replaced by its own parts, when those parts add up to it; otherwise the rows are returned as they are. */
export function expandRow(rows, label, parts) {
  const index = rows.findIndex(row => row.label === label);
  if (index < 0) return rows;
  const expanded = breakdownRows(parts);
  if (!expanded.length || sum(expanded) !== rows[index].value) return rows;
  return [...rows.slice(0, index), ...expanded, ...rows.slice(index + 1)];
}

const recorded = (system, ...targets) =>
  targets.flatMap(target =>
    (system.bonusSources?.[target] ?? []).map(entry => ({ label: String(entry.source), value: entry.value }))
  );
const attribute = (system, key) => ({ label: key.toUpperCase(), value: system.abilities?.[key]?.mod, keep: true });
const misc = (system, key) => ({ label: loc`Misc`, value: system.misc?.[key] });
const classPart = value => ({ label: loc`Class`, value, keep: true });

/** The attribute each save uses. */
const SAVE_ABILITIES = { fort: "con", ref: "dex", will: "wis" };

export function saveBreakdown(system, key, ability = SAVE_ABILITIES[key]) {
  const save = system.saves?.[key] ?? {};
  return breakdownRows(
    [
      classPart(save.base),
      attribute(system, ability),
      // Reflex takes the worse of the armor check penalty and the load carried (the engine's own rule).
      key === "ref"
        ? {
            label: loc`Armor or load`,
            value: Math.min(0, num(system.armor?.check), num(system.encumbrance?.check))
          }
        : null,
      ...recorded(system, `saves.${key}`),
      misc(system, key)
    ],
    save.total
  );
}

export function initiativeBreakdown(system) {
  return breakdownRows(
    [
      classPart(system.initiative?.base),
      attribute(system, "dex"),
      ...recorded(system, "initiative"),
      misc(system, "initiative")
    ],
    system.initiative?.total
  );
}

export function knowledgeBreakdown(system) {
  return breakdownRows(
    [
      { label: loc`Career Level`, value: system.level, keep: true },
      attribute(system, "int"),
      ...recorded(system, "knowledge"),
      misc(system, "knowledge"),
      { label: loc`Baffled/Incompetent`, value: system.knowledgeSkillBonusCondition?.adjustment }
    ],
    system.knowledge
  );
}

export function requestBreakdown(system) {
  return breakdownRows(
    [{ label: loc`Career Level`, value: system.level, keep: true }, attribute(system, "cha"), misc(system, "request")],
    system.requestCheck
  );
}

export function gearCheckBreakdown(system) {
  return breakdownRows(
    [
      { label: loc`Career Level`, value: system.level, keep: true },
      attribute(system, "wis"),
      misc(system, "gearCheck")
    ],
    system.gearCheck
  );
}

export function baseAttackBreakdown(system) {
  return breakdownRows([classPart(num(system.bab) - num(system.misc?.bab)), misc(system, "bab")], system.bab);
}

/** The sheet's unarmed, melee and ranged attack figures (before a weapon adds its own parts). */
export function attackBreakdown(system, kind) {
  const ability = kind === "ranged" ? "dex" : "str";
  return breakdownRows(
    [
      { label: loc`Base attack bonus`, value: system.bab, keep: true },
      attribute(system, ability),
      { label: loc`Size`, value: system.sizeModifier },
      { label: loc`Subtle campaign quality`, value: system.campaignEffects?.attackModifier },
      ...(kind === "unarmed" ? recorded(system, "unarmedAttack") : [])
    ],
    system.attack?.[kind],
    loc`Conditions`
  );
}

/**
 * A weapon's attack bonus (module/rules/gear.mjs, weaponAttack): the plan's own rows, with the attribute row named
 * for the attribute used and the base attack bonus and attribute always stated, even at +0.
 */
export function weaponAttackBreakdown(attack) {
  if (!attack || !Number.isFinite(attack.total)) return [];
  const rows = breakdownRows(attack.modifiers ?? []);
  const base = loc`Base attack bonus`,
    attributeLabel = loc`Attribute`;
  const take = label => rows.find(row => row.label === label)?.value ?? 0;
  return breakdownRows(
    [
      { label: base, value: take(base), keep: true },
      { label: String(attack.ability ?? "").toUpperCase() || attributeLabel, value: take(attributeLabel), keep: true },
      ...rows.filter(row => row.label !== base && row.label !== attributeLabel)
    ],
    attack.total
  );
}

/** Skills that add the Appearance modifier of the character's lifestyle. */
const APPEARANCE_SKILLS = ["cultures", "impress", "networking", "profession"];

/**
 * One of a skill's totals: the skill with the attribute it is rolled with. With `checkPenalty: false` the rows stop
 * at the skill bonus itself, before the penalty a condition puts on checks with that attribute.
 */
export function skillBreakdown(system, key, ability, { checkPenalty = true } = {}) {
  const skill = system.skillTotals?.[key];
  if (!skill) return [];
  const row = skill.totals?.find(total => total.ability === ability) ?? skill.totals?.[0];
  return breakdownRows(
    [
      { label: loc`Ranks`, value: skill.ranks, keep: true },
      attribute(system, row?.ability ?? ability),
      ...recorded(system, `skills.${key}.misc`),
      { label: loc`Appearance`, value: APPEARANCE_SKILLS.includes(key) ? system.lifestyleAppearance : 0 },
      { label: loc`Misc`, value: skill.misc },
      { label: loc`Conditions`, value: -num(system.conditionPenalties?.skill) },
      { label: loc`Baffled/Incompetent`, value: row?.conditionBonusAdjustment },
      checkPenalty ? { label: loc`Attribute-based condition penalty`, value: row?.checkPenalty } : null
    ],
    checkPenalty ? row?.total : row?.skillBonus
  );
}

/**
 * The parts of a planned skill check (module/rules/skills.mjs, resolveSkillCheck): its "Skill bonus" row is replaced
 * by the skill's own parts, and the modifier typed in the dialog is named on its own row.
 */
export function skillCheckBreakdown(system, key, plan, modifier = 0) {
  let rows = breakdownRows(plan?.modifiers ?? []);
  // The named check can change the skill bonus itself (a missing focus, a class ability): the difference from the
  // sheet's figure gets a row of its own, so the skill's parts are always listed.
  const bonus = rows.find(row => row.label === loc`Skill bonus`);
  if (bonus)
    rows = expandRow(
      rows,
      bonus.label,
      breakdownRows(skillBreakdown(system, key, plan?.ability, { checkPenalty: false }), bonus.value)
    );
  const typed = Math.trunc(num(modifier));
  const adjustments = rows.find(row => row.label === loc`Check adjustments`);
  if (typed && adjustments)
    rows = expandRow(rows, adjustments.label, [
      { label: loc`Situational modifier`, value: typed },
      { label: adjustments.label, value: adjustments.value - typed }
    ]);
  return rows;
}

/** The parts of a Knowledge check: the sheet's Knowledge bonus, synergy, and the modifier typed in the dialog. */
export function knowledgeCheckBreakdown(system, plan, modifier = 0) {
  return breakdownRows([
    ...knowledgeBreakdown(system),
    { label: loc`Synergy`, value: plan?.synergy },
    { label: loc`Situational modifier`, value: Math.trunc(num(modifier)) }
  ]);
}

/**
 * An attribute's score and the modifier it gives. The score's parts are listed first; the modifier is not a sum,
 * so it is stated with the score it comes from.
 * @returns {{score: Array<{label: string, value: number}>, value: number, mod: number}}
 */
export function abilityBreakdown(system, key) {
  const ability = system.abilities?.[key] ?? {};
  const known = Number.isFinite(Number(ability.base));
  return {
    score: known
      ? breakdownRows(
          [
            { label: loc`Level increases`, value: ability.increase },
            ...(ability.bonusSources ?? []).map(entry => ({ label: String(entry.source), value: entry.value })),
            { label: loc`Misc`, value: ability.misc },
            { label: loc`Temporary`, value: ability.temporaryBonus },
            { label: loc`Attribute damage`, value: -num(ability.damage) }
          ],
          num(ability.value) - num(ability.base)
        )
      : [],
    base: known ? num(ability.base) : null,
    value: num(ability.value),
    mod: num(ability.mod)
  };
}

/**
 * What a posted d20 check adds up to: the die, the recorded parts of its bonus, anything a rule added to the dice
 * afterwards, and a row for whatever is left, so the rows reach the card's total.
 * @param {object} check  the check record on the chat message
 * @returns {{die: number|null, rows: Array<{label: string, value: number}>, total: number, damage?: boolean}|null}
 */
export function checkBreakdown(check) {
  if (!check || !Number.isFinite(check.rawTotal)) return null;
  // A damage roll states the parts of its flat bonus; its dice are in the formula above.
  if (check.checkKind === "damage") {
    const parts = breakdownRows(Array.isArray(check.breakdown) ? check.breakdown : []);
    return parts.length ? { die: null, rows: parts, total: sum(parts), damage: true } : null;
  }
  const method = check.checkMethod ?? "roll";
  const die = Number.isFinite(check.naturalDie)
    ? check.naturalDie
    : method === "take10"
      ? 10
      : method === "take20"
        ? 20
        : null;
  if (die === null) return null;
  const stated = Array.isArray(check.breakdown) && check.breakdown.length > 0;
  const rows = breakdownRows(
    [
      ...(stated ? check.breakdown : []),
      ...(check.pipelineModifiers ?? []),
      { label: loc`Minimum roll of 10`, value: check.minimumAdjustment },
      { label: loc`Old School`, value: check.oldSchool?.bonus }
    ],
    check.rawTotal - die,
    stated ? loc`Other modifiers` : loc`Bonus`
  );
  return { die, rows, total: check.rawTotal };
}
