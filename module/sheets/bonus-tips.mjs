/**
 * Tooltip rows for the bonuses on a sheet's roll buttons: each part of the bonus on its own line, then the total,
 * which is the figure on the button (style guide 4.7 and 6.2). The `sc2tip` helper prints the rows.
 */
import { loc } from "../i18n.mjs";
import { readSetting } from "../settings.mjs";
import { signed } from "../handlebars-helpers.mjs";
import {
  abilityBreakdown,
  attackBreakdown,
  baseAttackBreakdown,
  breakdownRows,
  gearCheckBreakdown,
  initiativeBreakdown,
  knowledgeBreakdown,
  requestBreakdown,
  saveBreakdown,
  skillBreakdown,
  weaponAttackBreakdown
} from "../rules/bonus-breakdown.mjs";

/** Parts and the total they reach, as tooltip rows. A bonus with no parts at all still states its total. */
export const bonusTip = (rows, total) => [
  ...rows.map(row => [row.label, row.value]),
  [loc`Total`, Number(total) || 0, "total"]
];

/**
 * An attribute button: the attribute's full name (the button may show only its abbreviation), what the score is
 * made of, then the modifier that score gives.
 */
export function abilityTip(system, key, name) {
  const { base, score, value, mod } = abilityBreakdown(system, key);
  return [
    ...(name ? [[name]] : []),
    ...(base === null ? [] : [[loc`Base`, base, "plain"]]),
    ...score.map(row => [row.label, row.value]),
    [loc`Score ${value}: modifier ${signed(mod)}`, null, "total"]
  ];
}

/**
 * The last line of a roll button's tooltip: what Shift does on it, as the player's "Roll without the dialog" setting
 * has it (module/apps/remembered-choices.mjs).
 */
export function shiftLine(kind = "roll", swapped = readSetting("skipRollDialogs", false) === true) {
  if (swapped) return [loc`Shift-click opens the dialog`, null, "plain"];
  return kind === "attack"
    ? [loc`Shift-click: attack at once, with one token targeted`, null, "plain"]
    : [loc`Shift-click: roll at once with your last choices`, null, "plain"];
}

/** A weapon's Attack button: the parts the attack plan lists (module/rules/gear.mjs, weaponAttack). */
export const weaponAttackTip = attack =>
  Number.isFinite(attack?.total)
    ? [...bonusTip(weaponAttackBreakdown(attack), attack.total), shiftLine("attack")]
    : null;

/** A skill button that shows several totals (one per attribute): each total with its parts, one after another. */
export function skillTip(system, key, abilities) {
  const skill = system.skillTotals?.[key];
  const several = abilities.length > 1;
  return abilities.flatMap(ability => {
    const total = skill?.totals?.find(row => row.ability === ability)?.total;
    const rows = bonusTip(skillBreakdown(system, key, ability), total);
    if (several) rows.at(-1)[0] = loc`Total with ${ability.toUpperCase()}`;
    return rows;
  });
}

/** An NPC's skill button: its graded bonus, and the reminder that the roll adds the attribute. */
export function npcSkillTip(resolved) {
  const bonus = Number(resolved?.bonus) || 0;
  const listed = Number.isFinite(resolved?.listed) && resolved.listed >= (resolved?.competence ?? 0);
  return [
    [loc`Roll this skill now (Skill check opens the full dialog)`],
    ...bonusTip(
      breakdownRows(
        [{ label: listed ? loc`Skill grade` : loc`Competence`, value: resolved?.normalBonus ?? bonus, keep: true }],
        bonus,
        loc`Baffled/Incompetent`
      ),
      bonus
    ),
    [loc`The roll adds the attribute modifier.`]
  ];
}

/** Every fixed roll bonus on an agent's sheet, keyed as the templates read them. */
export function agentBonusTips(system) {
  return {
    initiative: bonusTip(initiativeBreakdown(system), system.initiative?.total),
    knowledge: bonusTip(knowledgeBreakdown(system), system.knowledge),
    request: bonusTip(requestBreakdown(system), system.requestCheck),
    gearCheck: bonusTip(gearCheckBreakdown(system), system.gearCheck),
    bab: bonusTip(baseAttackBreakdown(system), system.bab),
    attackUnarmed: bonusTip(attackBreakdown(system, "unarmed"), system.attack?.unarmed),
    attackMelee: bonusTip(attackBreakdown(system, "melee"), system.attack?.melee),
    attackRanged: bonusTip(attackBreakdown(system, "ranged"), system.attack?.ranged)
  };
}

export const saveTip = (system, key, ability) =>
  bonusTip(saveBreakdown(system, key, ability), system.saves?.[key]?.total);
