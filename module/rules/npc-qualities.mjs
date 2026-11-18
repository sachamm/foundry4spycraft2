/**
 * NPC qualities in play (pp.446–452).
 *
 * The NPC builder prices qualities; this module says what the ones an NPC holds do at the table:
 *   - numbers the sheet shows and other rules use (Speed, Size, damage reduction, senses, save DCs, …)
 *   - modifiers that always apply to a kind of check (Fearless on Morale, Strong-Minded on Resist checks)
 *   - modifiers that depend on the situation, offered as boxes on the NPC's skill check
 *   - a one-line note for everything else, with its page, so nothing is only a name
 *
 * Summaries are our own wording. This module is pure.
 */
import { loc } from "../i18n.mjs";

const SIZES = ["Nuisance", "Fine", "Diminutive", "Tiny", "Small", "Medium", "Large", "Huge", "Gargantuan", "Colossal"];
const ACTION_DICE = ["d4", "d6", "d8", "d10", "d12"];
const clamp = (value, low, high) => Math.max(low, Math.min(high, value));

/** Skill checks the Strong-Minded bonus applies to: the "Resist" checks. */
const RESIST_CHECKS = { resolve: ["resist-impress", "resist-intimidate"], senseMotive: ["resist-manipulate"] };

/** Total units of a quality across an NPC's entries, and the details typed beside them. */
function held(profile, id) {
  const entries = (profile?.qualities ?? []).filter(entry => entry?.id === id);
  return {
    count: entries.reduce((total, entry) => total + Math.max(1, Math.trunc(Number(entry.units) || 1)), 0),
    entries,
    details: entries.map(entry => String(entry.details ?? "").trim()).filter(Boolean)
  };
}

/**
 * What an NPC's qualities do.
 * @param {object} profile   the NPC profile (its `qualities` are [{ id, units, details, … }])
 * @param {object} context   { type, threatLevel, abilities: { wis: { value } } }
 */
export function npcQualityEffects(profile, { type = "standard", threatLevel = 1, abilities = {} } = {}) {
  const has = id => held(profile, id).count > 0,
    units = id => held(profile, id).count,
    details = id => held(profile, id).details;
  const wisdom = Number(abilities?.wis?.value ?? abilities?.wis ?? 10) || 10,
    tl = clamp(Math.trunc(Number(threatLevel) || 1), 1, 20);
  const notes = [],
    note = (id, name, text, page) => notes.push({ id, name, text, page });

  // Movement and Size
  const fleet = Math.min(6, units("fleet")),
    sluggish = units("sluggish");
  const speed = Math.max(10, 30 + 10 * fleet - 10 * sluggish),
    flySpeed = Math.min(100, 20 * units("flight"));
  const sizeIndex = clamp(SIZES.indexOf("Medium") + units("hulking") - units("undersized"), 0, SIZES.length - 1);
  if (fleet) note("fleet", loc`Fleet`, loc`Speed +${10 * fleet} ft.`, 447);
  if (sluggish) note("sluggish", loc`Sluggish`, loc`Speed –${10 * sluggish} ft., never below 10 ft.`, 451);
  if (flySpeed)
    note("flight", loc`Flight`, loc`Flies at ${flySpeed} ft.; turns are limited and Maneuver uses Acrobatics.`, 447);
  if (units("hulking")) note("hulking", loc`Hulking`, loc`Size raised ${units("hulking")} step(s).`, 448);
  if (units("undersized")) note("undersized", loc`Undersized`, loc`Size lowered ${units("undersized")} step(s).`, 452);

  // Damage
  const damageReduction = Math.min(8, units("damage-reduction"));
  const resistances = held(profile, "damage-resistance").entries.map(entry => ({
    type: String(entry.details ?? "").trim() || loc`unspecified type`,
    value: Math.min(8, Math.max(1, Math.trunc(Number(entry.units) || 1)))
  }));
  const susceptibilities = details("achilles-heel");
  if (damageReduction)
    note("damage-reduction", loc`Damage Reduction`, loc`Damage reduction ${damageReduction} against all damage.`, 447);
  for (const resistance of resistances)
    note(
      "damage-resistance",
      loc`Damage Resistance`,
      loc`Resistance ${resistance.value} against ${resistance.type} damage.`,
      447
    );
  if (has("achilles-heel"))
    note(
      "achilles-heel",
      loc`Achilles Heel`,
      loc`Damage of these types counts double: ${susceptibilities.join(", ") || loc`type not recorded`}.`,
      446
    );
  const toughPerScene = Math.min(5, units("tough"));
  if (toughPerScene) note("tough", loc`Tough`, loc`Ignores ${toughPerScene} failed Damage save(s) each scene.`, 452);
  const unnervingDice = Math.min(3, units("unnerving"));
  if (unnervingDice)
    note(
      "unnerving",
      loc`Unnerving`,
      loc`An unarmed or melee attack that does damage also does ${unnervingDice}d4 stress damage.`,
      452
    );
  if (has("fast-healing"))
    note("fast-healing", loc`Fast Healing`, loc`Heals every kind of damage at twice the rate.`, 447);
  if (has("construct"))
    note(
      "construct",
      loc`Construct`,
      loc`Immune to stress, subdual, contagion, sneak attack and mental attribute damage and to most conditions; saves against damage as an item; needs no Morale checks.`,
      447
    );

  // Checks that always take a modifier
  const moraleModifier = clamp(4 * (Math.min(5, units("fearless")) - Math.min(5, units("meek"))), -20, 20),
    resistModifier = Math.min(20, 4 * Math.min(5, units("strong-minded")));
  if (units("fearless"))
    note("fearless", loc`Fearless`, loc`+${4 * Math.min(5, units("fearless"))} to Resolve/Morale checks.`, 447);
  if (units("meek")) note("meek", loc`Meek`, loc`–${4 * Math.min(5, units("meek"))} to Resolve/Morale checks.`, 448);
  if (resistModifier) note("strong-minded", loc`Strong-Minded`, loc`+${resistModifier} to Resist skill checks.`, 451);

  // Checks that take a modifier when the situation fits: offered on the NPC's skill check
  const skillOptions = [];
  const option = (id, label, effect, skills = null) => skillOptions.push({ id, label, skills, ...effect });
  for (const terrain of details("camouflaged"))
    option(`camouflaged:${terrain}`, loc`Camouflaged in ${terrain} terrain: +4`, { modifier: 4 }, ["blend", "sneak"]);
  if (has("camouflaged"))
    note(
      "camouflaged",
      loc`Camouflaged`,
      loc`+4 to Blend/Stealth and Sneak/Hide in: ${details("camouflaged").join(", ") || loc`terrain not recorded`}.`,
      446
    );
  if (has("seductive")) {
    option("seductive", loc`Seductive, shifting disposition or in a seduction: +4`, { modifier: 4 });
    note("seductive", loc`Seductive`, loc`+4 to checks that shift disposition and in a seduction conflict.`, 451);
  }
  if (has("improved-hearing")) {
    option("improved-hearing", loc`Improved Hearing, checking for surprise: +6`, { modifier: 6 }, ["notice", "search"]);
    note(
      "improved-hearing",
      loc`Improved Hearing`,
      loc`Hearing range ${wisdom * 10} ft.; +6 to Notice and Search checks for surprise unless deafened.`,
      448
    );
  }
  if (has("improved-scent")) {
    option("improved-scent", loc`Improved Scent, tracking by smell: +6`, { modifier: 6 }, ["survival"]);
    note("improved-scent", loc`Improved Scent`, loc`Scent range ${wisdom * 10} ft.; +6 to Tracking by smell.`, 448);
  }
  if (has("all-thumbs")) {
    option("all-thumbs", loc`All Thumbs, with a weapon or tool in hand, or on a Grasp or Hands-On check: error +2`, {
      errorIncrease: 2
    });
    note("all-thumbs", loc`All Thumbs`, loc`Error range +2 with weapons, tools and Grasp or Hands-On checks.`, 446);
  }
  if (has("clumsy")) {
    option("clumsy", loc`Clumsy, having moved this round: error +2`, { errorIncrease: 2 });
    note("clumsy", loc`Clumsy`, loc`Error range +2 on attacks and skill checks in a round the NPC moves.`, 446);
  }
  if (has("diurnal")) {
    option("diurnal", loc`Diurnal, at night or in darkness: –4`, { modifier: -4 });
    note("diurnal", loc`Diurnal`, loc`–4 to attack and skill checks at night and in darkness.`, 447);
  }
  if (has("nocturnal")) {
    option("nocturnal", loc`Nocturnal, by day or in bright light: –4`, { modifier: -4 });
    note("nocturnal", loc`Nocturnal`, loc`–4 to attack and skill checks by day and in bright light.`, 449);
  }

  // Senses
  const senses = {
    hearing: has("improved-hearing") ? wisdom * 10 : null,
    scent: has("improved-scent") ? wisdom * 10 : null,
    vision: has("improved-vision") ? wisdom * 20 : null,
    lowLight: has("low-light-vision")
  };
  const rangePenaltyReduction = has("improved-vision") ? 2 : 0;
  if (has("improved-vision"))
    note(
      "improved-vision",
      loc`Improved Vision`,
      loc`Visual range ${wisdom * 20} ft.; each range penalty on its attacks is 2 less unless blinded.`,
      448
    );
  if (senses.lowLight)
    note("low-light-vision", loc`Low-Light Vision`, loc`No vision penalties at dawn, dusk or night.`, 448);
  if (has("aquatic"))
    note("aquatic", loc`Aquatic`, loc`Full Speed underwater, cannot drown, no underwater penalties.`, 446);

  // Saves the NPC forces on those who meet it
  const dc = 10 + tl;
  const saveCalls = [];
  if (has("captivating"))
    saveCalls.push({
      id: "captivating",
      name: loc`Captivating`,
      dc,
      text: loc`Will DC ${dc} on first meeting each mission, or as a full action once per opponent per scene within CQB Range. Success: lose the next half action. Failure: fixated on the NPC.`,
      page: 446
    });
  if (has("fearsome"))
    saveCalls.push({
      id: "fearsome",
      name: loc`Fearsome`,
      dc,
      text: loc`Will DC ${dc} on first meeting each scene. Success: 1d4+1 stress damage. Failure: frightened.`,
      page: 447
    });
  if (has("horrific"))
    saveCalls.push({
      id: "horrific",
      name: loc`Horrific`,
      dc,
      text: loc`Will DC ${dc} on each meeting in a scene. Success: 2d4+2 stress damage. Failure: terrified.`,
      page: 448
    });
  for (const call of saveCalls) note(call.id, call.name, call.text, call.page);

  // Villain roles and the GC's dice
  const roleId = ["mastermind", "henchman", "minion"].find(id => has(id)) ?? null;
  const baseDie = roleId === "mastermind" ? 3 : roleId === "henchman" ? 2 : roleId === "minion" ? 1 : null;
  const dieIndex = baseDie === null ? null : Math.min(ACTION_DICE.length - 1, baseDie + units("story-critical"));
  const role = roleId
    ? {
        id: roleId,
        actionDie: ACTION_DICE[dieIndex],
        // Attacks and skill checks aimed at the villain threaten on a narrower range and cost more to confirm.
        threatRangeReduction: roleId === "mastermind" ? 2 : roleId === "henchman" ? 1 : 0,
        extraDiceToActivate: roleId === "mastermind" ? 2 : roleId === "henchman" ? 1 : 0,
        saveFromDeathDiscount: roleId === "mastermind" ? 2 : roleId === "henchman" ? 1 : 0,
        featLimit: roleId === "mastermind" ? 15 : roleId === "henchman" ? 10 : 5
      }
    : null;
  if (roleId === "mastermind")
    note(
      "mastermind",
      loc`Mastermind`,
      loc`GC action die ${role.actionDie}. Threat ranges against this NPC shrink by 2 and a critical against it costs 2 more action dice. Saved from death for 2 dice fewer.`,
      448
    );
  if (roleId === "henchman")
    note(
      "henchman",
      loc`Henchman`,
      loc`GC action die ${role.actionDie}. Threat ranges against this NPC shrink by 1 and a critical against it costs 1 more action die. Saved from death for 1 die fewer.`,
      447
    );
  if (roleId === "minion")
    note("minion", loc`Minion`, loc`GC action die ${role.actionDie}. Met in squads the size of the team.`, 448);
  if (units("story-critical") && !roleId)
    note(
      "story-critical",
      loc`Story-Critical`,
      loc`The GC's action die for this NPC is ${units("story-critical")} type(s) larger, d12 at most.`,
      451
    );

  // Everything else is a rule the GC applies; say what it is rather than only naming it.
  const plain = {
    "alternate-identity-form": [
      loc`Alternate Identity/Form`,
      loc`A second form with grade I statistics; +10 to DCs to see through it.`,
      446
    ],
    "attack-on-command": [loc`Attack on Command`, loc`The trainer orders an attack as a free action.`, 446],
    augmented: [
      loc`Augmented`,
      loc`Built-in gear or weapons: always proficient, readied freely, cannot be disarmed.`,
      446
    ],
    burrow: [loc`Burrow`, loc`Tunnels through soft material; cannot Run while burrowing.`, 446],
    "carry-on-command": [loc`Carry on Command`, loc`Carries a small item to a familiar place on command.`, 446],
    "class-ability": [
      loc`Class Ability`,
      loc`Uses a chosen class ability once per scene; constant abilities always apply.`,
      446
    ],
    commander: [loc`Commander`, loc`One squad member leads; figure its statistics at Threat Level +2.`, 447],
    "disarm-on-command": [loc`Disarm on Command`, loc`The trainer orders a disarm as a free action.`, 447],
    diving: [loc`Diving`, loc`Holds its breath for 15 minutes per point of Constitution.`, 447],
    "entertain-on-command": [loc`Entertain on Command`, loc`Performs a Diversion on command, rolling Acrobatics.`, 447],
    "extended-training": [
      loc`Extended Training`,
      loc`One more weapon proficiency and Drive focus per application.`,
      447
    ],
    feat: [loc`Feat`, loc`Holds the feats named beside it; only feat prerequisites apply.`, 447],
    feral: [loc`Feral`, loc`Once per combat the GC may have it become enraged.`, 447],
    foil: [loc`Foil`, loc`Loyalty rolls shift by the chosen modifier; may hold up to 10 feats.`, 447],
    "guard-on-command": [loc`Guard on Command`, loc`Guards a place on command, attacking strangers within 20 ft.`, 447],
    horde: [loc`Horde`, loc`Squad size is doubled; members count as teammates.`, 448],
    mount: [loc`Mount`, loc`Can be ridden; handled as a vehicle with Survival/Maneuver.`, 448],
    "natural-attack": [
      loc`Natural Attack`,
      loc`A body weapon from Table 7.12 at the chosen Caliber; always proficient.`,
      448
    ],
    "non-combatant": [loc`Non-Combatant`, loc`Has no weapon proficiencies.`, 449],
    "open-doors": [loc`Open Doors`, loc`Opens any unlocked door it can work.`, 449],
    prodigy: [loc`Prodigy`, loc`The GC may activate its skill threats as critical successes.`, 449],
    "removable-quality": [loc`Removable Quality`, loc`A quality tied to an item, lost when the item is.`, 449],
    rescue: [loc`Rescue`, loc`Drags its unconscious trainer to safety, or another on command.`, 449],
    "retrieve-on-command": [loc`Retrieve on Command`, loc`Fetches an item on command.`, 451],
    "seek-on-command": [loc`Seek on Command`, loc`Finds trained target types within scent range on command.`, 451],
    specialty: [loc`Specialty`, loc`Has one Specialty, with its bonus feat.`, 451],
    "squad-item": [loc`Squad Item`, loc`The group shares an extra gear pick.`, 451],
    "squad-weapon": [loc`Squad Weapon`, loc`The group shares an extra weapon pick.`, 451],
    steadfast: [loc`Steadfast`, loc`Cannot be made to give up its masters; immune to snitching.`, 451],
    swarm: [loc`Swarm`, loc`Massed animals hit automatically, damage multiplied by squares filled.`, 451],
    synchronized: [loc`Synchronized`, loc`Easier Joint Actions; team checks use the better bonus.`, 452],
    talented: [loc`Talented`, loc`Has one Talent, with its attribute modifiers.`, 452],
    treacherous: [loc`Treacherous`, loc`The GC may activate its attack threats as critical hits.`, 452],
    uncoordinated: [
      loc`Uncoordinated`,
      loc`No Joint Actions, cooperative or directed checks; team checks use the worse bonus.`,
      452
    ],
    "subdue-on-command": [loc`Subdue on Command`, loc`The trainer orders it to hold a target.`, 451]
  };
  for (const [id, [name, text, page]] of Object.entries(plain)) {
    if (!has(id)) continue;
    const extra = details(id);
    note(id, name, extra.length ? `${text} (${extra.join("; ")})` : text, page);
  }

  return {
    speed,
    flySpeed,
    size: SIZES[sizeIndex],
    sizeSteps: sizeIndex - SIZES.indexOf("Medium"),
    damageReduction,
    resistances,
    susceptibilities,
    toughPerScene,
    unnervingDice,
    moraleModifier,
    resistModifier,
    skillOptions,
    senses,
    rangePenaltyReduction,
    saveCalls,
    role,
    canCriticalWithoutDice: {
      skill: has("prodigy") && type === "standard",
      attack: has("treacherous") && type !== "special"
    },
    notes
  };
}

/**
 * The quality modifiers of one NPC skill check.
 * @param {object} effects   npcQualityEffects(...)
 * @param {object} check     { skillKey, checkId, chosen: ids of the situational options ticked }
 * @returns {{modifier: number, errorIncrease: number, rows: {label: string, value: number}[]}}
 */
export function npcSkillQualityPlan(effects, { skillKey = "", checkId = "", chosen = [] } = {}) {
  const rows = [];
  let errorIncrease = 0;
  if (effects.moraleModifier && skillKey === "resolve" && checkId === "morale")
    rows.push({ label: effects.moraleModifier > 0 ? loc`Fearless` : loc`Meek`, value: effects.moraleModifier });
  if (effects.resistModifier && (RESIST_CHECKS[skillKey] ?? []).includes(checkId))
    rows.push({ label: loc`Strong-Minded`, value: effects.resistModifier });
  for (const option of effects.skillOptions) {
    if (!chosen.includes(option.id)) continue;
    if (option.skills && !option.skills.includes(skillKey)) continue;
    if (option.modifier) rows.push({ label: option.label, value: option.modifier });
    if (option.errorIncrease) errorIncrease += option.errorIncrease;
  }
  return { modifier: rows.reduce((total, row) => total + row.value, 0), errorIncrease, rows };
}

/** The situational options that can apply to a skill, for the NPC skill check dialog. */
export function npcSkillOptionsFor(effects, skillKey = "") {
  return effects.skillOptions.filter(option => !option.skills || !skillKey || option.skills.includes(skillKey));
}
