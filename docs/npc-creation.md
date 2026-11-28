# NPC creation

For the GC. Where the data lives, how it is built and how it was checked is in
[maintaining-gc-data.md](maintaining-gc-data.md).

Open an NPC actor and choose **Use graded NPC creation**. Existing NPCs remain in manual mode until explicitly enabled; their stored manual statistics are not migrated or deleted. Turning graded mode off restores those source statistics. Legacy `villain` selections resolve as special NPCs; Minion, Henchman and Mastermind are qualities in new profiles.

## What the builder works out

What the builder works out, with printed page numbers:

- Table 7.11 (pp.444–445): independent Initiative, Attack, Defense, Resilience, Damage Save, vitality/wounds and Competence lookups for grades I–X and TL 1–20.
- Table 7.13 (p.450) and p.452: use the higher of Competence and the individually purchased Skilled bonus. That bonus is the effective skill rank for result caps (existing Table 2.4). Listed skills cost their grade in XP, limited to three for standard NPCs and five for special NPCs. Animals have no Competence and use their restricted skills.
- Equipment (pp.443–445): standard/special NPCs start with one Caliber I weapon and gear pick; a standard group shares one Caliber I vehicle, while a special NPC has its own. Extra picks cost +1 XP each, Caliber upgrades +1 per step, and removal of a starting pick −2. Equipment does not scale with TL; Wealth does not grant picks. Standard/special weapons start with one/three ammunition stockpiles respectively; each additional pair costs +1 XP.
- Qualities (pp.446–451): 71 cost records with type/group restrictions, costs per unit, and parameter controls for class level, Caliber, Foil, limited movement and Removable Quality. Skilled and superior/inferior attributes use dedicated controls to avoid charging twice. Feat and Class Ability acquisition limits are validated; the GC checks their eligibility and target choices.
- Tiers (p.452): I/II/III/IV/V shift effective TL by −4/−2/0/+2/+4, bounded to 1–20. Tier III is the default; other Tiers are for specific rules, not ordinary mission difficulty adjustment. No independent Tier XP surcharge is invented.
- XP (pp.446,452): add numerical statistic grades, including Wealth (None = 0). Apply Skilled, attribute and other quality costs; negative quality adjustments cannot lower this statistic base below half, rounded up. Apply equipment adjustments and clamp the reward to at least zero. Special NPCs contribute four times the displayed NPC reward to the mission; standard NPCs and animals contribute once. Each antagonist type is counted once, not once per individual or appearance. Mission-wide XP scaling remains outside this actor calculator.

The quality floor is applied to the statistic base before equipment adjustment, so removing baseline equipment can still reduce a small NPC reward to zero. The UI shows each component and the floor adjustment. Published worked examples on p.452 (37 XP, and 41 XP after an extra Caliber II weapon plus Minion) are regression tests. Invalid inputs retain their selections but suppress final XP until corrected.

## Printed anomalies

Both supplied PDFs and the markdown show `26/14` at vitality/wounds grade I, TL12, and `45/10` at grade V, TL9. These values are preserved exactly and the affected builds display a GC source note. They have not been silently changed to inferred values.

## Implementation boundaries

The builder resolves the creation tables, base statistics and cost accounting. Attribute modifiers are applied once by the NPC model. It does not execute the other play effects of every quality, selected feat, specialty, talent or class ability. The sheet lists those effects by reference for GC adjudication. Actual equipment documents are managed in the existing item lists; allowances describe authorized picks and do not automatically create, remove or police those documents.

Animal command/action restrictions, complex movement modes, Removable Quality linkage, and feat/class eligibility require GC review. Full special NPCs built with PC rules and their 300-XP-per-scene rule are outside the graded builder. Combat automation, NPC critical activation rules, mission encounter accounting and automatic rest/healing are separate work.

## Core NPC Templates
The **Core NPC Templates** Actor compendium contains twenty original campaign starting points. Import or duplicate one, then change its name, faction and circumstances. Each starts as a standard NPC at Tier III and follows the active mission’s Threat Level; its fallback Threat Level is 1.
Equipment is embedded from the existing item catalogs. The graded allowance matches each included pick, and a group’s vehicle is shared. One primary weapon is equipped; other carried weapons can be readied when needed. Each firearm includes an ordinary ammunition stockpile and a selected supplied ammunition code. Stockpile inventory quantity counts stockpiles; its weight is per stockpile. Weapon and stockpile flags link the records; expenditure still uses the existing inventory and ammunition workflows.
The pack does not populate a world automatically. A newly added compendium becomes available after the world is relaunched.
## Feat selections

Each template now includes one to five feats. The pack builder creates a Feat quality and an embedded catalog item for each purchase. Every selection costs 2 XP, including prerequisite feats; any special-NPC multiplier is applied afterward by the usual calculator.

Feat descriptions remain available from the NPC inventory. Benefits outside the NPC workflows still need GC adjudication; adding a feat does not imply that all of its play effects have been automated. These changes do not replace already imported world actors; import a fresh template to use the new selection.

| Template | Feats | Added feat XP | NPC reward |
| --- | --- | ---: | ---: |
| Security Guard | Observer, Combat Mobility | +4 | 47 |
| Police Officer | CQB Basics, Combat Mobility, Officer | +6 | 62 |
| Detective | Private Eye, Observer, Advanced Skill Mastery (Private Eye) | +6 | 74 |
| Bodyguard | Combat Mobility, CQB Basics, Iron Will | +6 | 85 |
| Soldier | Marksmanship Basics, CQB Basics, Survivalist | +6 | 72 |
| Commando | Marksmanship Basics, Marksmanship Mastery, CQB Basics, Combat Mobility, Ghost Basics | +10 | 112 |
| Mercenary | Marksmanship Basics, Marksmanship Mastery, CQB Basics | +6 | 84 |
| Street Tough | Brawling Basics, Dirty Fighting Basics | +4 | 49 |
| Criminal Enforcer | Brawling Basics, Brawling Moves, Officer | +6 | 77 |
| Burglar | Burglar, Ghost Basics, Ghost Mastery | +6 | 67 |
| Contract Killer | Marksmanship Basics, Marksmanship Mastery, Concealed Carry, Ghost Basics | +8 | 85 |
| Enemy Agent | Actor, Concealed Carry, Ghost Basics, Charmer | +8 | 85 |
| Analyst | Examiner, Scholar, Advanced Skill Mastery (Examiner) | +6 | 59 |
| Hacker | Techie, Advanced Skill Mastery (Techie), False Start (Techie) | +6 | 63 |
| Scientist | Scholar, Advanced Skill Mastery (Scholar), False Start (Scholar) | +6 | 60 |
| Medic | Bandage, Examiner, Advanced Skill Mastery (Examiner) | +6 | 61 |
| Driver | Defensive Driving, Driving Instincts, Speed Demon, Need for Speed | +8 | 66 |
| Executive | Diplomat, Hustler, Charmer | +6 | 58 |
| Journalist | Private Eye, Diplomat, Charmer | +6 | 59 |
| Ordinary Civilian | Advisor | +2 | 15 |

## Template loadouts

Role-specific weapons, armor, kits, communications, recording tools and vehicles are embedded from the item catalogs. Each paid item contributes its actual Caliber to the profile; added picks and Caliber upgrades feed the final reward shown above. Wealth does not grant extra equipment. Vehicles marked as group equipment are shared when placing several copies.

Common Items come from a separate list. Phones, lights, notebooks and other ordinary supplies do not consume full equipment picks or add XP. Their entries grant no automatic bonus, and their unspecified weights require GC review when tracking load. Clothing and personal keys appear as personal effects in the biography. Kits retain their catalog contents without charging for those contents again.

Standard NPC weapons receive one included ammunition stockpile; special NPC weapons receive three. Additional stockpiles must be purchased in pairs, adding 1 XP per pair. The twenty current templates use only the standard included allowance. Already imported world actors keep their current inventories; import fresh templates for these loadouts.

## Optional Threat Level packages

Each of the twenty core templates has three authored packages: **Basic** (suggested TL 1–5), **Established** (6–12) and **Veteran** (13–20). These ranges are module conveniences, not a rulebook progression. Established reproduces the fixed template. Basic uses fewer feats and simpler professional equipment; Veteran expands training and role-appropriate tools. Civilian packages retain civilian equipment. Fixed loadouts remain the default, and neither mission changes nor Threat Level changes replace items.

On a core template's graded NPC sheet, the GC can choose **Preview a package**. The selector marks the recommendation using effective TL, including Tier, but initially selects the actor's current package. The preview lists template items to replace, package items to include, other items to retain, and the complete resulting XP breakdown. Apply explicitly to replace the package; select **Fixed loadout** to restore the original selection. Reapplying a package resets its template items, including edited ammunition quantities. Apply between encounters; active effects are retained.

**Edit TL bands** changes suggestions for that actor. Bands must cover TL 1–20 without overlaps or gaps. Saving bands does not alter feats, inventory or reward.

Package application retains grades, listed skills, other qualities and additional purchases. It removes the previous package's feat purchases and equipment allowances, adds the new ones, and validates the resulting inventory. Every feat must have a matching priced Feat quality, prerequisite feats must remain present, and the applicable feat limit is enforced. Each priced inventory item needs a matching Caliber allowance. Ammunition extras use the same stockpile-pair accounting as fixed templates. Unpriced custom items, incompatible extra feats or manually altered prior package allowances prevent application until the GC reconciles the actor. The feature currently supports the twenty standard graded NPC templates; conversion to special/animal or manual creation requires ordinary GC editing.

The preview is checked again before application. A changed NPC or mission TL requires a fresh preview. Import fresh templates if an older copy lacks the matching purchases and allowances.

## Template artwork

All twenty core templates include an original AI-generated painted portrait and a matching circular token. 

These are illustrative appearances for reusable roles, not required identities. The GC can replace either image on an imported actor. Applying a TL package preserves the actor portrait and token settings. Existing world actors keep their current artwork; import a fresh template to use these defaults.
