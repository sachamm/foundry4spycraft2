/**
 * The "skill" roll dialog as ordered parts. Each part is one piece of the form; a rule adds its own piece by
 * registering a `dialog` contributor for "skill" with an `at` between the parts it belongs with.
 * SKILL_DIALOG.anchors gives the position just inside the end of each named section.
 */
import { rollPipeline } from "../../rules/roll-pipeline.mjs";
import { combatStanceState } from "../../rules/combat-stance.mjs";
import { isResourceLock } from "../../rules/transactions.mjs";
import { possessionUnavailable } from "../../rules/gear.mjs";
import { FOG_SMOKE, AMBIENT_LIGHT } from "../../rules/senses.mjs";
import { LOCAL_HERO_OPPOSITION_SKILLS, TERRAIN_TYPES } from "../../rules/terrain.mjs";
import { TRACKING_SURFACES } from "../../rules/tracking.mjs";
import { attributeCollapsePlan } from "../../rules/attributes.mjs";

/** [position, render(context)] — context holds the acting character and the values the roll has worked out so far. */
const parts = [
  [10, () => `<div class="spycraft2-roll-options">`],
  [
    20,
    ({ actor, key }) =>
      key === "athletics" && (actor.system.conditionContext?.held || actor.system.conditionContext?.pinned)
        ? '<fieldset><legend>Opposed Grapple escape</legend><label>Applicable proficiency <select name="grappleProficient"><option value="">Choose for this Grapple</option><option value="true">Proficient</option><option value="false">Not proficient: two full actions, error +2</option></select></label><label>My Size categories minus opponent Size categories <input name="grappleSizeDifference" type="number" step="1" min="-20" max="20" value="0" /></label><label><input name="grappleContextConfirmed" type="checkbox" /> The GC confirms the participants, applicable proficiency and Size difference</label><p>Each larger participant gains +4 per Size category on their own check. This check uses Grasp and Armor Check Penalty; static-restraint Escape has separate rules.</p></fieldset>'
        : ""
  ],
  [
    30,
    ({ esc, key, restraintRollSource }) =>
      key === "athletics" && restraintRollSource.sources.length
        ? `<p>Current restraint sources: ${restraintRollSource.sources.map(s => esc(s.name ?? s.id)).join(", ")}.</p>`
        : ""
  ],
  [
    40,
    ({ key, restraintRollSource }) =>
      key === "athletics" && restraintRollSource.sources.length > 1
        ? '<label><input name="grappleAllSourcesConfirmed" type="checkbox" /> The GC confirms all current Held/Pinned sources belong to this same grapple; unrelated sources require separate adjudication</label>'
        : ""
  ],
  [50, () => `<label>Skill check <select name="check">`],
  [60, ({ choices }) => choices],
  [
    70,
    () => `</select></label>
          <label>Attribute (when permitted) <select name="ability">`
  ],
  [80, ({ abilities }) => abilities],
  [
    90,
    () => `</select></label>
          `
  ],
  [
    100,
    ({ actor, key }) =>
      key === "analysis" ||
      (key === "resolve" &&
        Object.values(actor.system.analysisTasks ?? {}).some(t => t.pressured && t.status === "active"))
        ? "<details><summary>Complex Analysis Task</summary>"
        : ""
  ],
  [
    110,
    () => `
            `
  ],
  [
    120,
    ({ actor, key }) =>
      key === "analysis" && actor.system.activeFeatNames?.some(n => ["Forensic Genius", "Tracking Mastery"].includes(n))
        ? `<fieldset><legend>Complex Analysis challenge count</legend><label><input type="checkbox" name="complexAnalysisTask" /> Declare an unrecorded Complex Analysis Task</label><label>GC’s unmodified number of Challenges <input name="analysisBaseChallenges" type="number" min="2" step="1" /></label><p>Forensic Genius reduces the required count by2; Tracking Mastery reduces an Analysis/Forensics task by1(minimum1 after all reductions). A selected recorded task supplies its own count; use this declaration only for an unrecorded task (pp.207,209).</p></fieldset>`
        : ""
  ],
  [
    130,
    () => `
            `
  ],
  [
    140,
    ({ actor, esc, key }) =>
      key === "analysis" ||
      (key === "resolve" &&
        Object.values(actor.system.analysisTasks ?? {}).some(t => t.pressured && t.status === "active"))
        ? `<label>Recorded Complex Analysis Task <select name="analysisTaskId"><option value="">None</option>${Object.entries(
            actor.system.analysisTasks ?? {}
          )
            .filter(([, t]) => t.status === "active" && (key === "analysis" || t.pressured))
            .map(
              ([id, t]) =>
                `<option value="${esc(id)}">${esc(t.title)} (${esc(t.completed)}/${esc(t.requiredChallenges)})</option>`
            )
            .join("")}</select></label>`
        : ""
  ],
  [
    150,
    () => `
            `
  ],
  [
    160,
    ({ actor, key }) =>
      key === "resolve" &&
      Object.values(actor.system.analysisTasks ?? {}).some(t => t.pressured && t.status === "active")
        ? `<label>Upcoming Challenge DC (Task Pressure only)<input name="taskChallengeDC" type="number" step="1" min="0" /></label><label><input name="taskChallengeDCConfirmed" type="checkbox" /> The GC confirms this is the actual upcoming Challenge DC</label>`
        : ""
  ],
  [
    170,
    () => `
          `
  ],
  [
    180,
    ({ actor, key }) =>
      key === "analysis" ||
      (key === "resolve" &&
        Object.values(actor.system.analysisTasks ?? {}).some(t => t.pressured && t.status === "active"))
        ? "</details>"
        : ""
  ],
  [
    190,
    () => `
          `
  ],
  [
    200,
    ({ actor, esc, key }) =>
      ["intimidate", "resolve"].includes(key)
        ? `<details><summary>Threaten action / response (pp.180,361)</summary><p>Choose Threaten (Intimidate/Wis) or Resist Threaten (Resolve/Wis) above. These are opposed checks with Hearing and Language tags; taking10/20 is unavailable. The GC resolves the opposed outcome, stress/fright and next-attack effects.</p><label>Opposing character name <input name="threatenOpponentName" maxlength="200" /></label><label><input name="threatenOpponentConfirmed" type="checkbox" /> The named character is my opponent</label><label><input name="threatenContextConfirmed" type="checkbox" /> The GC confirms these Threaten circumstances and participants</label><label>Held/readied ranged weapon for CQB benefits <select name="threatenWeaponId"><option value="">None</option>${(actor.system.readiedRangedWeapons ?? []).map(w => `<option value="${esc(w.id)}">${esc(w.name)}</option>`).join("")}</select></label>${key === "intimidate" ? '<label>Measured target distance (ft.) <input name="threatenDistanceFeet" type="number" min="0" step="any" /></label><label>Vitality lost to my attacks <input name="threatenVitalityLoss" type="number" min="0" step="1" value="0" /></label><label>Wounds lost to my attacks <input name="threatenWoundLoss" type="number" min="0" step="1" value="0" /></label><label><input name="threatenInjuryFromYourAttacksConfirmed" type="checkbox" /> The GC confirms these losses were caused by my attacks</label><p>The target must have lost5vitality or1wound to your attacks. CQB Mastery waives this requirement while you hold a readied ranged weapon. Glint of Madness waives it without requiring a weapon. Use your own Initiative Count.</p>' : '<label><input name="threatenIncomingLegalConfirmed" type="checkbox" /> The GC confirms this responds to a legal incoming Threaten action, including the attacker’s CQB Range and prior-injury requirement or exception</label>'}</details>`
        : ""
  ],
  [
    210,
    () => `
          `
  ],
  [
    240,
    () => `
          `
  ],
  [
    350,
    () => `
          `
  ],
  [
    360,
    ({ actor, key }) =>
      key === "sneak" && ["side", "stalking"].includes(combatStanceState(actor.system)?.key)
        ? '<label>Combat stance: distance this Hide route adds toward the 20 ft. round limit (ft.; required only for included movement) <input name="stanceDistanceFeet" type="number" min="0" step="any" /></label><p>Check the recorded total on Main; record the completed round total after moving.</p>'
        : ""
  ],
  [
    370,
    () => `
          `
  ],
  [
    380,
    ({ key }) =>
      key === "sneak"
        ? '<details><summary>Included Hide ground movement</summary><p>For a rolled Sneak/Hide check. This includes the ground movement check modifier and separate error increase. Ghost Basics doubles the included current-Speed allowance. Resolve other movement modes separately.</p><label><input name="hideMovement" type="checkbox" /> Declare movement included in this Hide action</label><label>Counted movement (ft.) <input name="hideDistanceFeet" type="number" min="0" step="any" value="0" /></label><label><input name="hideAdjacentThreat" type="checkbox" /> Starting adjacent to a threatening opponent</label><label><input name="hidePassesThreat" type="checkbox" /> Continuing after entering threatening adjacency</label><label><input name="hideRouteConfirmed" type="checkbox" /> The GC confirms this ordinary ground route, counted distance and terrain costs; no balancing, climbing, swimming or water entry/exit</label><label><input name="hideActionConfirmed" type="checkbox" /> I take the legal action required for this Hide check (normally one full action)</label></details>'
        : ""
  ],
  [
    390,
    () => `
          `
  ],
  [
    400,
    ({ actor, key }) =>
      key === "sneak" && actor.system.activeFeatNames?.includes("Ghost Basics")
        ? '<details><summary>Ghost Basics Hide targets</summary><p>Only Sneak/Hide. Normal strongest-positive synergy stacking applies.</p><label>Hide target type <select name="ghostHideTargetKind"><option value="">No Ghost Basics target synergy</option><option value="sensor">Security sensor</option><option value="living">Living opponent</option><option value="both">Both security sensors and living opponents</option></select></label><label>Actual sensor / living opponent <input name="ghostHideTargetName" maxlength="200" /></label><label><input name="ghostHideConfirmed" type="checkbox" /> The GC confirms this Hide check evades the named target types</label></details>'
        : ""
  ],
  [
    410,
    () => `
          <details><summary>Focus, forte and synergy</summary>
            <label>Applicable focus (blank uses the check name) <input name="focus" /></label>
            <label><input type="checkbox" name="forte" /> An owned forte applies</label>
            <label>Synergy skill <select name="synergySkill"><option value="auto">Best listed unconditional synergy</option><option value="none">None</option>`
  ],
  [
    420,
    ({ esc, key, skill }) =>
      Object.entries(CONFIG.SPYCRAFT.skills)
        .map(([key, skill]) => `<option value="${key}">${esc(skill.name)}</option>`)
        .join("")
  ],
  [
    430,
    () => `</select></label>
            `
  ],
  [
    440,
    ({ actor, key }) =>
      key === "impress" && actor.system.activeFeatNames?.includes("Professional Driver - Closed Course")
        ? `<fieldset><legend>Professional Driver — Closed Course</legend><label><input type="checkbox" name="closedCourseSeesYou" /> The target has line of sight to you</label><label><input type="checkbox" name="closedCourseSeesVehicle" /> The target has line of sight to your vehicle</label><p>Both are required for Acrobatics or Drive synergy (p.193).</p></fieldset>`
        : ""
  ],
  [
    450,
    () => `
            <label>Synergy focus <input name="synergyFocus" /></label>
            <label><input type="checkbox" name="synergyConditionMet" /> Listed synergy circumstances apply</label>
            <label><input type="checkbox" name="gcApprovedSynergy" /> GC approved an additional synergy</label>
          `
  ],
  [
    460,
    () => `</details>
          <details><summary>Weapon work — Weapon Focus</summary>
            <label><input name="weaponWork" type="checkbox" /> Apply Weapon Focus to this weapon Build, Modify or Repair DC</label>
            <label>Owned target weapon/model <select name="weaponWorkItemId"><option value="">GC-confirmed model or other target below</option>`
  ],
  [
    470,
    ({ actor, esc }) =>
      (actor.items?.filter(i => i.type === "weapon") ?? [])
        .map(i => `<option value="${esc(i.id)}">${esc(i.name)}</option>`)
        .join("")
  ],
  [
    480,
    () => `</select></label>
            <label>Other target weapon/model <input name="weaponWorkName" /></label>
            <label>Other target proficiency <select name="weaponWorkProficiency">`
  ],
  [
    490,
    ({ esc }) =>
      Object.entries(CONFIG.SPYCRAFT.proficiencies)
        .filter(([k]) => k !== "unarmed")
        .map(([k, n]) => `<option value="${esc(k)}">${esc(n.label ?? n)}</option>`)
        .join("")
  ],
  [
    500,
    () => `</select></label>
            <label>DC before Weapon Focus <input name="weaponWorkDC" type="number" min="0" step="1" /></label>
            <label><input name="weaponWorkConfirmed" type="checkbox" /> The GC confirms the target weapon, proficiency and unmodified DC</label>
            <p>The selected owned weapon supplies its actual proficiency. For an unowned or not-yet-built model, confirm its specifications with the GC. Weapon Focus changes the DC, not the roll total.</p>
          `
  ],
  [
    510,
    () => `</details>
          <details><summary>Required gear and kits</summary>
            <label>Required gear <select name="gearStatus"><option value="unknown">Confirm for Gear / Gear Only checks</option><option value="available">All required gear is available</option><option value="missing">Required gear is missing</option></select></label>
            <label><input type="checkbox" name="kitAtLocation" /> I am at the selected non-portable kit’s recorded location</label>
            <label>Gear being used <select name="gearItem"><option value="">None</option>`
  ],
  [
    520,
    ({ actor, esc }) =>
      (
        actor.items?.filter(
          item =>
            ["weapon", "armor", "gear"].includes(item.type) &&
            !isResourceLock(item) &&
            !item.system.reserve &&
            !item.system.destroyed &&
            item.system.quantity !== 0 &&
            !possessionUnavailable(item.system)
        ) ?? []
      )
        .map(item => `<option value="${item.id}">${esc(item.name)}</option>`)
        .join("")
  ],
  [
    530,
    () => `</select></label>
          `
  ],
  [
    540,
    () => `</details>
          `
  ],
  [
    550,
    ({ actor, esc, key }) =>
      key === "networking"
        ? `<label>Contact being called <select name="contactName"><option value="">Unspecified / not a Contact check</option>${(
            actor.system.contacts ?? []
          )
            .filter(c => c.name?.trim())
            .map(c => `<option value="${esc(c.name)}">${esc(c.name)}</option>`)
            .join(
              ""
            )}</select></label><label>Current mission Threat Level (for the selected Contact check) <input name="contactThreatLevel" type="number" min="1" max="20" step="1" /></label><p>For a contact feat’s initial associate, select their uniquely named Training record and configure that feat’s primary contact and GC-approved theme.</p>`
        : ""
  ],
  [
    560,
    () => `
          <details><summary>Time and class circumstances</summary>
            <label><input type="checkbox" name="inCombat" /> Additional combat for this Medicine check</label>
            <label><input type="checkbox" name="combatInSight" /> Surgery: combat occurred within line of sight at any time during the check</label>
            <label><input type="checkbox" name="complexTaskNearby" /> Therapy: someone is performing a Complex Task in my presence</label>
            <label><input type="checkbox" name="dramaticConflictNearby" /> Therapy: someone is performing a Dramatic Conflict in my presence</label>
            `
  ],
  [
    570,
    ({ actor }) =>
      (actor.system.originEffects ?? []).some(effect => effect.qualityKey === "seductive")
        ? '<label><input type="checkbox" name="shiftingDisposition" /> Seductive: this check actually shifts disposition</label><label><input type="checkbox" name="seductionConflict" /> Seductive: this check is part of a seduction Dramatic Conflict</label>'
        : ""
  ],
  [
    580,
    () => `
            <label><input type="checkbox" name="oneHanded" /> Only one hand available for this Hands-On check</label>
            <label><input type="checkbox" name="noSharedLanguage" /> No shared language or relevant local tongue for this Language check</label>
            <label><input type="checkbox" name="bound" /> Additional bound condition for this check</label>
            <label><input type="checkbox" name="conveyingMessage" /> Innuendo: I am conveying a message (adds Hands-On)</label>
            <label>Ambush preparation (Tactics/Ambush only) <select name="ambushPreparation"><option value="slow">Slow: 10 minutes, no quick-check error increase</option><option value="quick">Quick: 1 minute, error range +2</option></select></label>
            <label>Ambush role <select name="ambushRole"><option value="">Unspecified</option><option value="leader">Leader</option><option value="helper">Helper</option></select></label>
            <label>Method <select name="method"><option value="roll">Roll</option><option value="take10">Take 10</option><option value="take20">Take 20</option></select></label>
            <label><input type="checkbox" name="safeToTake" /> Neither distracted nor endangered</label>
            <label><input type="checkbox" name="gcTakingPermissionConfirmed" /> GC permits taking 10/20 when this named check requires permission</label>
            `
  ],
  [
    590,
    ({ actor, key }) =>
      key === "blend" &&
      actor.system.activeFeatNames?.some(n => ["Gorgeous", "The Look", "Simply Irresistible"].includes(n))
        ? '<label><input type="checkbox" name="manhuntPrey" /> This Blend check is made as the Prey during a manhunt (Gorgeous/The Look/Simply Irresistible)</label>'
        : ""
  ],
  [
    600,
    () => `
            `
  ],
  [
    610,
    ({ actor, key }) =>
      key === "impress" && actor.system.activeFeatNames?.includes("Charmer")
        ? `<fieldset><legend>Charmer — Influence timing (p.202)</legend><label><input type="checkbox" name="charmer" /> Use Charmer</label><label>NPC name <input type="text" name="charmerTarget" maxlength="200" /></label><label>Disposition toward you <select name="charmerDisposition"><option value="">Choose disposition</option><option value="neutral">Neutral</option><option value="intrigued">Intrigued</option><option value="friendly">Friendly</option></select></label><label>Influence duration <select name="charmerDuration"><option value="quick">Quick: scene benefit (normally 1 minute)</option><option value="slow">Slow: mission benefit (normally 10 minutes)</option></select></label><label><input type="checkbox" name="charmerNPCConfirmed" /> GC confirms this named NPC and their disposition toward me</label><p>Select one Influence timing feat. Actions and resulting disposition remain resolved at the table.</p></fieldset>`
        : ""
  ],
  [
    620,
    () => `
            `
  ],
  [
    630,
    ({ actor, key }) =>
      key === "impress" && actor.system.activeFeatNames?.includes("Hard Core")
        ? `<fieldset><legend>Hard Core — Influence timing (p.203)</legend><label><input type="checkbox" name="hardCore" /> Use Hard Core</label><label>NPC name <input type="text" name="hardCoreTarget" maxlength="200" /></label><label>Disposition toward you <select name="hardCoreDisposition"><option value="">Choose disposition</option><option value="aloof">Aloof</option><option value="unfriendly">Unfriendly</option><option value="hostile">Hostile</option></select></label><label>Influence duration <select name="influenceDuration"><option value="quick">Quick: scene benefit (normally 1 minute)</option><option value="slow">Slow: mission benefit (normally 10 minutes)</option></select></label><label><input type="checkbox" name="hardCoreNPCConfirmed" /> GC confirms this named NPC and their disposition toward me</label><p>The single chosen time reduction applies before taking 10/20 or Cross-Check. Actions and resulting disposition remain resolved at the table.</p></fieldset>`
        : ""
  ],
  [
    640,
    () => `
            `
  ],
  [
    650,
    ({ actor }) =>
      actor.system.activeFeatNames?.includes("One Hand on the Wheel")
        ? `<fieldset><legend>One Hand on the Wheel</legend><label><input type="checkbox" name="wheelFreeManeuver" /> Use a free Maneuver (${actor.limitedUseStatus.find(s => s.id === "oneHandManeuver")?.remaining ?? 0} / ${actor.limitedUseStatus.find(s => s.id === "oneHandManeuver")?.limit ?? 0} uses this scene; Maneuver checks only)</label><label><input type="checkbox" name="wheelFreeActionConfirmed" /> The GC confirms this legal Maneuver may be a free action now (my Initiative Count in combat)</label></fieldset>`
        : ""
  ],
  [
    660,
    () => `
            <label>Time reduction (one source, p.102) <select name="timingReduction"><option value="auto">Choose fastest available (review minima for variable times)</option><option value="none">No reduction</option><option value="take10">Normal-time take 10 (class ability / forte)</option><option value="falseStart">False Start (take 20)</option><option value="professional">Mark of a Professional (unopposed)</option><option value="class">Applicable class time reduction</option><option value="ambushMastery">Ambush Mastery (quick ambush; error +2)</option><option value="ambushSupremacy">Ambush Supremacy (slow ambush; error +2)</option><option value="irresistible">Simply Irresistible (Impress/Networking)</option><option value="contactMission">Lower-Threat mission Contact time</option><option value="contactFeat">Initial contact feat (chosen contact)</option><option value="charmer">Charmer (confirmed Influence NPC)</option><option value="hardCore">Hard Core (confirmed Influence NPC)</option><option value="solution">10-Second Solution (declare below)</option><option value="questionsI">All the Right Questions I (Field Analyst 3; error +1)</option><option value="questionsII">All the Right Questions II (Field Analyst 7; error +2)</option></select></label>
            <label><input type="checkbox" name="unopposed" /> Unopposed check</label>
            `
  ],
  [
    670,
    ({ actor }) =>
      actor.system.activeFeatNames?.some(n => ["Always Get Your Man", "Escape and Evasion Training"].includes(n))
        ? '<label>Role for this manhunt check <select name="manhuntRole"><option value="">Not a manhunt</option><option value="predator">Predator</option><option value="prey">Prey</option></select></label><label>Role for this chase Maneuver <select name="chaseRole"><option value="">Not a chase Maneuver</option><option value="predator">Predator</option><option value="prey">Prey</option></select></label>'
        : ""
  ],
  [
    680,
    () => `
            <label><input type="checkbox" name="crossCheckActive" /> Cross-Check: triple time for an active check</label>
            `
  ],
  [
    690,
    ({ actor, key }) =>
      key === "bluff" && actor.system.activeFeatNames?.includes("Superior Documentation")
        ? '<fieldset><legend>Superior Documentation</legend><label><input name="usingCoverIdentity" type="checkbox" /> Use the +1 gear bonus while using a cover identity</label><label>Cover identity name <input name="coverIdentityName" maxlength="200" /></label><label><input name="coverIdentityConfirmed" type="checkbox" /> The GC confirms I am using this cover identity for this Bluff check</label></fieldset>'
        : ""
  ],
  [
    700,
    () => `
            `
  ],
  [
    710,
    ({ actor, key }) =>
      ["sleightOfHand", "sneak"].includes(key) && actor.system.activeFeatNames?.includes("Bug Basics")
        ? '<fieldset><legend>Bug Basics — Stash Item only</legend><label><input name="concealingBug" type="checkbox" /> Use the +2 gear bonus to conceal a bug</label><label>Bug name <input name="bugName" maxlength="200" /></label><label><input name="bugConcealmentConfirmed" type="checkbox" /> The GC confirms this Stash Item check conceals this bug</label></fieldset>'
        : ""
  ],
  [
    720,
    () => `
            <label><input type="checkbox" name="usingComputer" /> Research is being performed using a computer</label>
            <label><input type="checkbox" name="installingTrap" /> Installation is setting a trap</label>
            <label><input type="checkbox" name="surprise" /> This check determines surprise</label>
            <label><input type="checkbox" name="deafened" /> Additional deafness for this check (Improved hearing cannot apply)</label>
            <label><input type="checkbox" name="blinded" /> Additional blindness for this check</label>
            <label><input type="checkbox" name="targetDeafened" /> This check targets a deafened character (Language cap −20)</label>
            <label><input type="checkbox" name="requiresEyesight" /> The GC confirms this check requires eyesight or eye-hand coordination</label>
            <label><input type="checkbox" name="requiresHearing" /> The GC confirms this check requires hearing</label>
            <label><input type="checkbox" name="targetCharacter" /> Night Training: this check targets a character</label>
            <label>Distance to that character (ft., Night Training) <input name="distanceFeet" type="number" min="0" step="any" /></label>
            <label><input type="checkbox" name="scentUsable" /> I can rely on scent for this Tracking check (Improved scent)</label>
            <label>Fog/smoke <select name="obscurant"><option value="">Unspecified</option><option value="fog">Fog</option><option value="smoke">Smoke</option></select></label>
            <label>Fog/smoke density <select name="obscurantDensity"><option value="">Unspecified</option>`
  ],
  [
    730,
    () =>
      Object.entries(FOG_SMOKE)
        .map(([id, row]) => `<option value="${id}">${row.label}</option>`)
        .join("")
  ],
  [
    740,
    () => `</select></label>
            <label>Ambient light <select name="ambientLight"><option value="">Unspecified / resolve at table</option>`
  ],
  [
    750,
    () =>
      Object.entries(AMBIENT_LIGHT)
        .map(([id, row]) => `<option value="${id}">${row.label}</option>`)
        .join("")
  ],
  [
    760,
    () => `</select></label>
          `
  ],
  [
    770,
    () => `</details>
          <details><summary>Terrain feat circumstances</summary>
            <label><input type="checkbox" name="homeTurf" /> Within my home turf: five-block urban radius or one-mile wilderness radius of home</label>
            <label>Local Hero: opposing skill <select name="opposingSkill"><option value="">Choose only for Local Hero opposition</option>`
  ],
  [
    780,
    ({ esc, key }) =>
      LOCAL_HERO_OPPOSITION_SKILLS.map(
        key => `<option value="${key}">${esc(CONFIG.SPYCRAFT.skills[key].name)}</option>`
      ).join("")
  ],
  [
    790,
    () => `</select></label>
            <label><input type="checkbox" name="targetingYou" /> The opposing check targets me (Local Hero)</label>
            <label>Terrain <select name="terrain"><option value="">Unspecified</option>`
  ],
  [
    800,
    () =>
      Object.entries(TERRAIN_TYPES)
        .map(([id, label]) => `<option value="${id}">${label}</option>`)
        .join("")
  ],
  [
    810,
    () => `</select></label>
            <label><input type="checkbox" name="underwater" /> I am underwater (general check penalty; Aquatic Training circumstances)</label>
            <label><input type="checkbox" name="navigating" /> This check is made to navigate</label>
            <label><input type="checkbox" name="naturalSurface" /> This footing/climbing check uses a natural surface</label>
            <label><input type="checkbox" name="hearingCheck" /> This Notice check uses hearing (Swamp Training)</label>
            <label>City population here (0 outside a city) <input type="number" name="cityPopulation" min="0" step="1" value="0" /></label>
            <label><input type="checkbox" name="nightAmbush" /> This ambush is planned at night or in darkness (Night Training)</label>
          `
  ],
  [
    820,
    () => `</details>
          <details><summary>Tracking circumstances</summary>
            <label>Surface (required for Survival/Tracking) <select name="trackingSurface"><option value="">Choose the trail surface</option>`
  ],
  [
    830,
    () =>
      Object.entries(TRACKING_SURFACES)
        .map(([id, row]) => `<option value="${id}">${row.label}</option>`)
        .join("")
  ],
  [
    840,
    () => `</select></label>
            <label>Hours since tracks were left <input type="number" name="trackingAgeHours" min="0" step="any" value="0" /></label>
            <label>Hours of rain/snow since tracks were left <input type="number" name="trackingWeatherHours" min="0" step="any" value="0" /></label>
            <label><input type="checkbox" name="trackingLargeGroup" /> Target group has more than three characters</label>
            <label>Tracking pace <select name="trackingPace"><option value="half">Up to half Speed</option><option value="full">Up to full Speed</option><option value="faster">Faster than full Speed</option></select></label>
            <label><input type="checkbox" name="followingPhysicalTrail" /> I am following a physical trail (Tracking Mastery surprise bonus)</label>
          `
  ],
  [
    850,
    () => `</details>
          <details><summary>Nest — Sniper Perfect Killer</summary>
            <label><input type="checkbox" name="nest" /> Substitute Tactics skill bonus for Hide to avoid being spotted</label>
            <label><input type="checkbox" name="nestHalfCoverConfirmed" /> I benefit from at least half cover and this check avoids being spotted</label>
            <label>Tactics attribute <select name="nestAbility"><option value="">Tactics default</option><option value="wis">WIS</option><option value="cha">CHA</option></select></label>
          `
  ],
  [
    860,
    () => `</details>
          `
  ],
  [
    870,
    ({ actor }) =>
      actor.system.activeFeatNames?.includes("I Can Swim")
        ? '<label><input type="checkbox" name="iCanSwim" /> I Can Swim: spend saved skill points in this skill as a free action before this check</label>'
        : ""
  ],
  [
    880,
    () => `
          <details><summary>Limited abilities and action dice</summary>
            <label><input type="checkbox" name="cunningPlan" /> Cunning Plan: Schemer 2, free action to reduce this error range by INT modifier (once/scene; twice at 7)</label>
            <label><input type="checkbox" name="allAccordingToPlan" /> All According to Plan: Schemer 4, use Intelligence for this check (session uses equal starting action dice)</label>
            <label><input type="checkbox" name="iKnowWhatDoing" /> …I Know What I’m Doing.: Stuntman 8, required bonus d10 for this STR/DEX check (once/scene)</label><label>DC for this bonus <input type="number" name="difficultyClass" step="1" placeholder="Must exceed Career Level +20" /></label>
            <label><input type="checkbox" name="tenSecondSolution" /> 10-Second Solution: Scientist 14, natural 20 on this Intelligence skill (once/session)</label><label><input type="checkbox" name="standaloneCheckConfirmed" /> This check is outside any Complex Task or Dramatic Conflict</label>
            <label><input type="checkbox" name="littleDetails" /> Little Details: Athletics/Smash as a free action (shared session and round limits)</label>
            <label><input type="checkbox" name="oneInAMillion" /> One in a Million: Soldier 14, natural 20 on a STR/CON skill check (once/session)</label>
            <label><input type="checkbox" name="breakthrough" /> Breakthrough: Virtuoso 10, substitute the key skill’s total bonus (once/scene)</label><label>Key skill attribute <select name="breakthroughAbility"><option value="">Key skill default</option>`
  ],
  [
    890,
    () =>
      ["str", "dex", "con", "int", "wis", "cha"].map(a => `<option value="${a}">${a.toUpperCase()}</option>`).join("")
  ],
  [
    900,
    () => `</select></label>
            <label>Bright Idea source <select name="brightIdeaSource"><option value="">Automatic available source</option>`
  ],
  [
    910,
    ({ actor, esc }) =>
      actor.limitedUseStatus
        .filter(s => s.workflow === "brightIdea")
        .map(s => `<option value="${esc(s.id)}">${esc(s.name)}: ${s.remaining} remaining</option>`)
        .join("")
  ],
  [
    920,
    () => `</select></label>
            <label><input type="checkbox" name="brightIdea" /> Bright Idea: roll twice and choose (INT/WIS skill checks)</label>
            `
  ],
  [930, ({ actor }) => actor.actionDiceFundingControl()],
  [940, ({ actor }) => actor.actionDiceSurchargeControl({ perBenefit: true, unrolled: true })],
  [
    950,
    () => `<label><input type="checkbox" name="hailMaryUntrained" /> Hail Mary: remove untrained error increase (1 die)</label>
            <label><input type="checkbox" name="hailMaryUncap" /> Hail Mary: lift the result cap (3 dice)</label>
            <label><input type="checkbox" name="hailMaryActive" /> Hail Mary: make passive/secret check active (4 dice)</label>
          `
  ],
  [
    960,
    () => `</details>
          `
  ],
  [
    970,
    ({ actor }) =>
      attributeCollapsePlan(actor.system).conditions.includes("Paralyzed") || actor.system.conditionContext?.paralyzed
        ? '<label><input type="checkbox" name="purelyMentalConfirmed" /> The GC confirmed this is a purely mental action (paralysis)</label>'
        : ""
  ],
  [
    980,
    () => `
          <label>Situational modifier <input type="number" name="modifier" value="0" /></label>
          <label><input type="checkbox" name="secret" /> Secret when the check permits either type</label></div>`
  ]
];

export const SKILL_DIALOG = Object.freeze({
  id: "skill",
  anchors: Object.freeze({
    "Focus, forte and synergy": 455,
    "Weapon work \u2014 Weapon Focus": 505,
    "Required gear and kits": 535,
    "Time and class circumstances": 765,
    "Terrain feat circumstances": 815,
    "Tracking circumstances": 845,
    "Nest \u2014 Sniper Perfect Killer": 855,
    "Limited abilities and action dice": 955
  })
});

rollPipeline.register({
  id: "skillDialog",
  dialogs: ["skill"],
  dialog: context => parts.map(([at, render]) => ({ at, html: render(context) }))
});

/** Form fields that arrive as text and are numbers: blank means "not given". */
const NUMBER_FIELDS = [
  "stanceDistanceFeet",
  "conveyanceBullRushAllowanceFeet",
  "conveyanceBullRushDistanceFeet",
  "bullRushAttackSizeDifference",
  "bullRushAttackDistanceFeet",
  "bullRushSizeDifference",
  "tumbleDistanceFeet",
  "tumbleAdjacentEnemySquares",
  "tumbleOccupiedSquares",
  "tripAttackSizeDifference",
  "tripSizeDifference",
  "fallDistanceFeet",
  "balanceDistanceFeet",
  "hideAreaPeople",
  "hideDistanceFeet",
  "threatenDistanceFeet",
  "threatenVitalityLoss",
  "threatenWoundLoss"
];

rollPipeline.register({
  id: "skillDialogInput",
  dialogs: ["skill"],
  read(context, input) {
    const patch = {};
    for (const field of [...NUMBER_FIELDS, "grappleSizeDifference"]) {
      if (typeof input[field] === "string") patch[field] = input[field].trim() ? Number(input[field]) : null;
    }
    if (typeof input.grappleProficient === "string") {
      patch.grappleProficient =
        input.grappleProficient === "true" ? true : input.grappleProficient === "false" ? false : null;
    }
    return patch;
  }
});
