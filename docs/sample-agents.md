# Sample level-1 agents

The **Sample Level-1 Agents** Actor compendium includes 16 ready-to-import characters, covering all 12 base classes. Faceman, Scout, Soldier and Wheelman each have two different builds. The compendium is included in the standard install ZIP and is visible to players for browsing; the GC imports and assigns the chosen character.

| Character / codename | Class | Talent / Specialty | Role |
| --- | --- | --- | --- |
| Nadia Rahman / Charter | Advocate | Convincing / Authority | Institutional negotiator |
| Elena Marquez / Meridian | Explorer | Brainy / Outdoorsman | Field researcher |
| Luc Moreau / Velvet | Faceman | Graceful / Grifter | Social infiltrator |
| Samira Haddad / Ledger | Faceman | Shrewd / Journalist | Investigative cover specialist |
| Jun Park / Patch | Hacker | Brainy / Geek | Network intrusion specialist |
| Mara Voss / Latch | Intruder | Agile / Criminal | Covert entry specialist |
| Gabriel Okafor / Anchor | Pointman | Reliable / Instructor | Team coordinator |
| Dr. Priya Raman / Remedy | Scientist | Brainy / Doctor | Field physician |
| Tomas Aalto / Kestrel | Scout | Vigilant / Outdoorsman | Tracker and animal handler |
| Amina Diallo / Drift | Scout | Fit / Hunter | Mobile reconnaissance |
| Sofia Rossi / Mosaic | Sleuth | Shrewd / Investigator | Case-building detective |
| Daniel Chen / Relay | Snoop | Clever / Journalist | Signals and surveillance |
| Luka Petrov / Breakwater | Soldier | Burly / Warrior | Close protection |
| Inez Duarte / Vector | Soldier | Fit / Mercenary | Ranged security |
| Mateo Silva / Apex | Wheelman | Daring / Hot Rodder | Ground extraction driver |
| Noor Al-Masri / Skylark | Wheelman | Agile / Pilot | Air rescue pilot |

## Creation assumptions

Each is a faction agent of the original **Lantern Office**, with 36-point attributes, one base-class level, maximum first-level vitality, full wounds and starting action dice, 0 XP and 2 Reputation. No mission reward has been awarded. Demographics include age, gender, homeland, nationality, height, weight, eyes and hair. Original biographies supply a reason to work with the team and an unfinished personal case.

Every creation allocation is explicit: Talent choices, Specialty focus and forte grants, class ability choices, permanent feats and their acquisition level, skill points and historical Intelligence, weapon proficiencies and fortes, skill focuses and fortes, Interests, Contacts and relationship grades, a Subplot, and Wealth allocation. Cultures and Science use the printed focus lists. Cultural fortes name countries, Drive fortes name vehicle types, Science fortes name gear types and Profession fortes name tasks.

Both Facemen have their full initial Flawless Identity rosters, with a named Profession focus and two Interests per identity. Their class-granted feat is legal despite its ordinary Career Level requirement. The Wheelmen likewise receive the class-granted Daredevil. Paid feats meet their own prerequisites; they do not use the NPC prerequisite waiver.

## Gear assumptions

The inventory includes an **example Caliber-II mission**. Mission Caliber is a campaign choice independent of Career Level. Personal Possessions use their own Wealth allowance. Every mission pick, starting Possessions slot and initial Common Item choice is allocated. The normal per-mission Common Item replacements remain available later. Common Item weights are sample estimates, since many ordinary supplies have no catalog weight.

Kits may consume a pick from any category at the appropriate Caliber (p.213). Faction Charisma picks use permitted categories, and kit funding records its category. Vehicles and bulky kits are marked as stowed at the support vehicle or safe house. Only one body armor and one primary weapon are readied. Firearms have an explicit supplied ammunition code and a separate included ordinary stockpile with correct weight; no extra ammunition is granted. Optional upgrades are deliberately declined, as permitted on p.213, and grant no bonus.

Noor's observation helicopter is a paid Vehicle pick raised from the example mission's Caliber II to III by Custom Ride. Its stamped item and mission record use the same validation as ordinary play. Other optional class abilities remain available for play rather than being spent in advance.

## Animal partner import

Tomas has Animal Partner, four purchased Survival ranks and a complete companion blueprint for **Bracken**, a working German Shepherd. Her counted animal XP is 39 against a cap of 40, before the two free trained qualities, Rescue and Seek on Command. She has a Caliber-II bite, improved scent, extra movement and the free Medium-size Wolfpack Mastery grant. Companion health is one grade higher; Threat Level follows the owner's level minus two, with the system's minimum of one. She has no separate action-die pool.

Import Tomas normally. The elected GM's import hook creates Bracken with the imported world's owner UUID and matching ownership. It preserves existing companions, resumes an interrupted import, supports separate copies of Tomas, and remembers completed delivery so a deliberately deleted dog is not recreated. The complete dog data ships in `module/data/sample-agent-companions.mjs`; it is not an extra sample agent in the compendium. Other characters have no companion entitlement selected. Personal Lieutenant is not granted at first level.

Samples stay in the compendium until selected; startup does not fill the Actors directory with every character.

## Artwork and validation

`assets/agents/catalog.html` previews all 17 identities, including Bracken. Portraits are 512-pixel WebP; matching tokens are 256-pixel WebP. The built-in image generator produced the artwork, and `assets/agents/generation-prompts.json` records the prompts and asset hashes.

`src/data/sample-agents.json` is the creation-plan source. The builder refuses unfinished choices, overspending and illegal feats. Tests additionally verify the printed focus domains, every initial gear budget, grants and identities, included ammunition, companion XP and import recovery. Native Foundry validation checks every actor and embedded item and prepares the schema-cleaned agents again.
