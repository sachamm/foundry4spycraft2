// GENERATED from src/data/gc-core.json, gc-tables.json, conflicts.json and campaign-qualities.json by tools/build-packs.mjs.
export const GC_DATA = {
 "core": {
  "source": "Spycraft 2.0, printed pages 323–324, 331–332, 397–398, 423–424, 429–431, 435, 439–440, 452, 457–458. Numbers only; wording is original.",
  "fluidInitiative": {
   "page": 324,
   "roundCap": 10,
   "reelAt": 0,
   "reelRecovery": 20,
   "reelMinimum": 1,
   "pressAt": 50,
   "pressCost": 20,
   "pressMinimumCount": 25,
   "delayFloor": 5,
   "events": [
    {
     "id": "aim",
     "group": "Actions",
     "label": "Aim",
     "amount": 1
    },
    {
     "id": "brace",
     "group": "Actions",
     "label": "Brace",
     "amount": 1
    },
    {
     "id": "calledShot",
     "group": "Actions",
     "label": "Called Shot trick",
     "amount": -5
    },
    {
     "id": "delay",
     "group": "Actions",
     "label": "Delay (per Count given up)",
     "amount": -1,
     "immediate": true
    },
    {
     "id": "kick",
     "group": "Actions",
     "label": "Kick",
     "amount": -2
    },
    {
     "id": "press",
     "group": "Actions",
     "label": "Press",
     "amount": -20,
     "uncapped": true,
     "immediate": true,
     "oncePerRound": true
    },
    {
     "id": "ready",
     "group": "Actions",
     "label": "Readied action triggered (Count reset to current)",
     "amount": null,
     "immediate": true,
     "setCount": true
    },
    {
     "id": "regroup",
     "group": "Actions",
     "label": "Regroup (5 + Int bonus)",
     "amount": null,
     "variable": "regroup"
    },
    {
     "id": "standOff",
     "group": "Actions",
     "label": "Stand Off",
     "amount": -5
    },
    {
     "id": "terrain",
     "group": "Attacks and Movement",
     "label": "Movement penalty from terrain",
     "amount": -2
    },
    {
     "id": "oneHandedTwoHands",
     "group": "Attacks and Movement",
     "label": "Fire a 1-handed weapon with 2 hands",
     "amount": -2
    },
    {
     "id": "tactical",
     "group": "Attacks and Movement",
     "label": "Fire a tactical weapon",
     "amount": -2
    },
    {
     "id": "unproficient",
     "group": "Attacks and Movement",
     "label": "Use a weapon without proficiency (once per weapon)",
     "amount": -4
    },
    {
     "id": "finalAttack",
     "group": "Attacks and Movement",
     "label": "Final attack (each)",
     "amount": -2
    },
    {
     "id": "criticalMiss",
     "group": "Attacks and Movement",
     "label": "Critical miss or failure (per action die spent)",
     "amount": -2
    },
    {
     "id": "triumph",
     "group": "Attacks and Movement",
     "label": "Score a Triumph",
     "amount": 10
    },
    {
     "id": "bleeding",
     "group": "Conditions",
     "label": "Bleeding",
     "amount": -1,
     "oncePerRound": true
    },
    {
     "id": "fatigued",
     "group": "Conditions",
     "label": "Fatigued this round",
     "amount": -3,
     "oncePerRound": true
    },
    {
     "id": "exhausted",
     "group": "Conditions",
     "label": "Exhausted this round",
     "amount": -10,
     "oncePerRound": true
    },
    {
     "id": "shaken2",
     "group": "Conditions",
     "label": "Shaken II this round",
     "amount": -2,
     "oncePerRound": true
    },
    {
     "id": "criticalInjury",
     "group": "Conditions",
     "label": "Suffer a critical injury",
     "amount": -10,
     "oncePerRound": true
    },
    {
     "id": "woundLoss",
     "group": "Injuries",
     "label": "Lose 1 or more wounds (per injury)",
     "amount": -2
    },
    {
     "id": "criticalWoundLoss",
     "group": "Injuries",
     "label": "Critical hit that costs wounds (per injury; replaces the wound-loss modifier)",
     "amount": -5
    },
    {
     "id": "electrical",
     "group": "Injuries",
     "label": "Electrical damage (per point)",
     "amount": -1
    },
    {
     "id": "diversion",
     "group": "Skill Checks and Saving Throws",
     "label": "Fail Sense Motive against a Diversion (1d4, or 2d4 with a critical)",
     "amount": null,
     "variable": "diversion"
    },
    {
     "id": "failedSave",
     "group": "Skill Checks and Saving Throws",
     "label": "Fail a saving throw",
     "amount": -2
    },
    {
     "id": "failedStressSave",
     "group": "Skill Checks and Saving Throws",
     "label": "Fail a save against stress damage",
     "amount": -5
    },
    {
     "id": "failedExplosiveSave",
     "group": "Skill Checks and Saving Throws",
     "label": "Fail a save to reduce explosive damage",
     "amount": -5
    }
   ]
  },
  "npcDamageSave": {
   "page": 331,
   "baseDC": 10,
   "blastStep": 10,
   "woundsPerBonus": 1,
   "vitalityPerBonus": 2
  },
  "gcDice": {
   "page": 397,
   "dieByRole": {
    "none": 4,
    "minion": 6,
    "henchman": 8,
    "mastermind": 10
   },
   "dieSteps": [
    4,
    6,
    8,
    10,
    12
   ],
   "dcBoostDie": 12,
   "dcBoostLimit": 1,
   "dramaticDcBoostLimit": 3,
   "saveDiscount": {
    "henchman": 1,
    "mastermind": 2
   },
   "spends": [
    {
     "id": "boostRoll",
     "label": "Boost an NPC die roll",
     "cost": 1,
     "rolls": "npc",
     "needsNpc": true,
     "page": 397
    },
    {
     "id": "boostDefense",
     "label": "Boost an NPC's Defense (+2 for the die result in rounds)",
     "cost": 1,
     "rolls": "npc",
     "needsNpc": true,
     "page": 397
    },
    {
     "id": "boostDefenseAfterHit",
     "label": "Dramatic scene: boost an NPC's Defense against one attack that hit",
     "cost": 1,
     "rolls": "npc",
     "needsNpc": true,
     "dramaticOnly": true,
     "repeatable": true,
     "page": 424
    },
    {
     "id": "boostDC",
     "label": "Boost a skill check DC (d12, before the check)",
     "cost": 1,
     "rolls": "d12",
     "page": 397
    },
    {
     "id": "boostInitiative",
     "label": "Dramatic scene: raise an opponent's Initiative Count",
     "cost": 1,
     "rolls": "npc",
     "needsNpc": true,
     "dramaticOnly": true,
     "repeatable": true,
     "page": 424
    },
    {
     "id": "activateThreat",
     "label": "Activate an NPC threat",
     "cost": 1,
     "variableCost": true,
     "needsNpc": true,
     "page": 397
    },
    {
     "id": "activateError",
     "label": "Activate an error suffered by an NPC's opponent",
     "cost": 1,
     "variableCost": true,
     "page": 398
    },
    {
     "id": "healNpc",
     "label": "Heal an NPC",
     "cost": 1,
     "rolls": "npc",
     "needsNpc": true,
     "repeatable": true,
     "page": 398
    },
    {
     "id": "promote",
     "label": "Promote a standard NPC to special for this mission",
     "cost": 2,
     "needsNpc": true,
     "page": 398
    },
    {
     "id": "saveNpc",
     "label": "Save a special NPC from death or capture",
     "cost": 4,
     "needsNpc": true,
     "page": 398
    },
    {
     "id": "campaignQuality",
     "label": "Add a campaign quality for this mission (Intel Phase)",
     "cost": null,
     "page": 398
    },
    {
     "id": "dramaticScene",
     "label": "Make the current scene dramatic",
     "cost": 4,
     "page": 398
    },
    {
     "id": "event",
     "label": "Prompt an event (1–4 dice, 1 less with a listed trigger)",
     "cost": null,
     "page": 399
    },
    {
     "id": "knowsNothing",
     "label": "Decide a questioned NPC knows nothing (1 standard/minion, 2 special/henchman)",
     "cost": null,
     "needsNpc": true,
     "page": 459
    }
   ]
  },
  "dramaticScene": {
   "page": 424,
   "initiativeMultiplier": 2,
   "initiativeMaximum": 50,
   "cost": 4
  },
  "mission": {
   "threatLevel": {
    "page": 423,
    "divisor": 5,
    "minimum": 1,
    "maximum": 20,
    "maxAdjust": 2,
    "reputationPerStep": 1,
    "netWorthPerStep": 50000,
    "bonusDiePerLevels": 2
   },
   "objectiveGradeXP": 25,
   "criticalObjectives": {
    "page": 435,
    "free": 1,
    "extraXP": 25,
    "noneXP": -50
   },
   "dramaticScenes": {
    "page": 435,
    "free": 1,
    "extraXP": 100,
    "noneXP": -50
   },
   "bundle": {
    "page": 429,
    "xpPerCaliber": -10,
    "commonItemXP": -1
   },
   "timeLimitXP": 50,
   "ignoredComplicationFraction": 0.5,
   "fullSpecialXPPerScene": 300,
   "specialMultiplier": 4,
   "promotedXPPerScene": 300,
   "actionDieAwardXP": 25,
   "sceneXPTarget": 500,
   "sceneXPMaximum": 750,
   "reputationByCaliber": [
    {
     "caliber": 1,
     "reputation": 2,
     "netWorth": 100000
    },
    {
     "caliber": 2,
     "reputation": 5,
     "netWorth": 250000
    },
    {
     "caliber": 3,
     "reputation": 10,
     "netWorth": 500000
    },
    {
     "caliber": 4,
     "reputation": 15,
     "netWorth": 750000
    },
    {
     "caliber": 5,
     "reputation": 20,
     "netWorth": 1000000
    }
   ]
  },
  "disposition": {
   "page": 458,
   "maxShiftPerMission": 2,
   "default": "neutral",
   "grades": [
    {
     "id": "helpful",
     "name": "Helpful",
     "intimacy": -8,
     "intimacyError": 3,
     "fondness": 6,
     "fondnessThreat": 3,
     "fondnessError": 0,
     "loyalty": 18,
     "joinDC": 10,
     "joinRoll": 10,
     "priority": 0.25
    },
    {
     "id": "supportive",
     "name": "Supportive",
     "intimacy": -6,
     "intimacyError": 2,
     "fondness": 4,
     "fondnessThreat": 2,
     "fondnessError": 0,
     "loyalty": 16,
     "joinDC": 15,
     "joinRoll": 8,
     "priority": 0.3333
    },
    {
     "id": "friendly",
     "name": "Friendly",
     "intimacy": -4,
     "intimacyError": 1,
     "fondness": 2,
     "fondnessThreat": 1,
     "fondnessError": 0,
     "loyalty": 14,
     "joinDC": 20,
     "joinRoll": 6,
     "priority": 0.5
    },
    {
     "id": "intrigued",
     "name": "Intrigued",
     "intimacy": -2,
     "intimacyError": 0,
     "fondness": 1,
     "fondnessThreat": 0,
     "fondnessError": 0,
     "loyalty": 12,
     "joinDC": 25,
     "joinRoll": 4,
     "priority": 0.75
    },
    {
     "id": "neutral",
     "name": "Neutral",
     "intimacy": 0,
     "intimacyError": 0,
     "fondness": 0,
     "fondnessThreat": 0,
     "fondnessError": 0,
     "loyalty": 10,
     "joinDC": 30,
     "joinRoll": 2,
     "priority": 1
    },
    {
     "id": "aloof",
     "name": "Aloof",
     "intimacy": -2,
     "intimacyError": 0,
     "fondness": -1,
     "fondnessThreat": 0,
     "fondnessError": 0,
     "loyalty": 8,
     "joinDC": 40,
     "joinRoll": 4,
     "priority": 1.5
    },
    {
     "id": "unfriendly",
     "name": "Unfriendly",
     "intimacy": -4,
     "intimacyError": 1,
     "fondness": -2,
     "fondnessThreat": 0,
     "fondnessError": 1,
     "loyalty": 6,
     "joinDC": 50,
     "joinRoll": 6,
     "priority": 2
    },
    {
     "id": "hostile",
     "name": "Hostile",
     "intimacy": -6,
     "intimacyError": 2,
     "fondness": -4,
     "fondnessThreat": 0,
     "fondnessError": 2,
     "loyalty": 4,
     "joinDC": 60,
     "joinRoll": 8,
     "priority": 3
    },
    {
     "id": "adversarial",
     "name": "Adversarial",
     "intimacy": -8,
     "intimacyError": 3,
     "fondness": -6,
     "fondnessThreat": 0,
     "fondnessError": 3,
     "loyalty": 2,
     "joinDC": null,
     "joinRoll": 10,
     "priority": 4
    }
   ],
   "intimacyChecks": [
    "Blend/Stealth",
    "Bluff/Deception",
    "Impress/Influence",
    "Impress/Performance",
    "Intimidate/Coercion",
    "Intimidate/Domination",
    "Networking/Endorsement"
   ],
   "fondnessChecks": [
    "Bureaucracy/Bribe",
    "Cultures/Communication",
    "Impress/Persuasion",
    "Medicine/Therapy",
    "Networking/Mediation",
    "Sense Motive/Innuendo",
    "Streetwise/Bribe",
    "Streetwise/Haggle",
    "Tactics/Rally"
   ]
  }
 },
 "tables": {
  "events": [
   {
    "id": "endangered-bystanders",
    "name": "Endangered Bystanders",
    "page": 399,
    "costMin": 1,
    "costMax": 4,
    "triggers": [
     "Earlier in this mission the team completed every listed objective"
    ],
    "summary": "Bystanders are put in peril. Each die buys 1d12 bystanders (or a flat 5), or lowers their stat tier by 1 from Tier IV (min Tier I). A bystander death usually causes exposure.",
    "perDie": [
     "1d12 bystanders (or 5)",
     "-1 bystander tier from base Tier IV (min Tier I)"
    ]
   },
   {
    "id": "hazards",
    "name": "Hazards",
    "page": 399,
    "costMin": 1,
    "costMax": 4,
    "triggers": [
     "This scene: error on a Knowledge check to navigate a war zone or other dangerous area",
     "This scene: error on a ranged attack"
    ],
    "summary": "A dangerous interruption: contagion, explosion, crossfire, runaway vehicle or security device. Effect by dice spent is in lookups.hazards (contagion alone can exceed 4 dice).",
    "lookup": "hazards"
   },
   {
    "id": "marked-for-death",
    "name": "Marked for Death",
    "page": 399,
    "costMin": 1,
    "costMax": 4,
    "triggers": [
     "This mission: target erred on a Computers/Access System, Investigation/Canvass Area, Networking/Contact, Streetwise/Black Market or Streetwise/Bribe check"
    ],
    "summary": "An assassin makes one attempt on a chosen character, following normal rules including morale. Assassin tier equals dice spent.",
    "intensities": [
     {
      "cost": 1,
      "summary": "Tier I assassin"
     },
     {
      "cost": 2,
      "summary": "Tier II assassin"
     },
     {
      "cost": 3,
      "summary": "Tier III assassin"
     },
     {
      "cost": 4,
      "summary": "Tier IV assassin"
     }
    ]
   },
   {
    "id": "mistaken-identity",
    "name": "Mistaken Identity",
    "page": 399,
    "costMin": 1,
    "costMax": 4,
    "triggers": [
     "This mission: target erred on any Cultures, Impress, Intimidate, Manipulate or Networking check"
    ],
    "summary": "A character is taken for someone else. Clearing it up is a Complex Impress/Persuasion Task: 1 Challenge + 1 per die (max 5); first DC 10 + Threat Level, +2 per later Challenge. After failure a retry needs both people present and DCs +5.",
    "intensities": [
     {
      "cost": 1,
      "summary": "2 Challenges"
     },
     {
      "cost": 2,
      "summary": "3 Challenges"
     },
     {
      "cost": 3,
      "summary": "4 Challenges"
     },
     {
      "cost": 4,
      "summary": "5 Challenges (maximum)"
     }
    ]
   },
   {
    "id": "natures-fury",
    "name": "Nature's Fury",
    "page": 400,
    "costMin": 1,
    "costMax": 4,
    "triggers": [],
    "summary": "Weather or natural disaster strikes: earthquake, fog, landslide, lightning, rain/snow, volcanic eruption or wind. Effect by dice spent is in lookups.naturesFury.",
    "lookup": "naturesFury"
   },
   {
    "id": "responsibility",
    "name": "Responsibility",
    "page": 400,
    "costMin": 1,
    "costMax": 4,
    "triggers": [],
    "summary": "The team is saddled with a Tier II NPC or a fragile item (Damage save bonus +10 or less). Dice buy duration or enemies; losing it usually causes exposure.",
    "perDie": [
     "Responsibility lingers 1 scene (min 1)",
     "1 Tier III NPC wants it killed, captured or destroyed (min 1)"
    ]
   },
   {
    "id": "rival-approach",
    "name": "Rival Approach",
    "page": 402,
    "costMin": 1,
    "costMax": 4,
    "triggers": [
     "Previous mission: any character erred on a Profession/Accomplishment check",
     "Previous mission: any character lost 2+ Reputation or $100,000+ Net Worth to exposure"
    ],
    "summary": "A special NPC (tier = dice spent) bribes the team to throw an objective (a one-use contact each) or to defect (+1 Reputation or +$50,000 Net Worth each per die). All must accept.",
    "intensities": [
     {
      "cost": 1,
      "summary": "Tier I NPC; acquaintance contact, or +1 Reputation/+$50,000"
     },
     {
      "cost": 2,
      "summary": "Tier II NPC; associate contact, or +2 Reputation/+$100,000"
     },
     {
      "cost": 3,
      "summary": "Tier III NPC; confederate contact, or +3 Reputation/+$150,000"
     },
     {
      "cost": 4,
      "summary": "Tier IV NPC; partner contact, or +4 Reputation/+$200,000"
     }
    ]
   },
   {
    "id": "shoddy-worthless-item",
    "name": "Shoddy/Worthless Item",
    "page": 403,
    "costMin": 1,
    "costMax": 4,
    "triggers": [
     "This mission: the character erred while using the target item"
    ],
    "summary": "One item a character carries turns out flawed. 1-3 dice raise the error range of checks with it by 2 per die; 4 dice make it unusable. Cannot be sprung mid-use.",
    "intensities": [
     {
      "cost": 1,
      "summary": "Error range +2"
     },
     {
      "cost": 2,
      "summary": "Error range +4"
     },
     {
      "cost": 3,
      "summary": "Error range +6"
     },
     {
      "cost": 4,
      "summary": "Item worthless and unusable"
     }
    ]
   },
   {
    "id": "surprise-chase",
    "name": "Surprise Chase",
    "page": 403,
    "costMin": 1,
    "costMax": 4,
    "triggers": [
     "Previous or current scene: the characters let an opponent escape a chase or combat"
    ],
    "summary": "A chase starts while the group is moving. Each die adds 1 Tier II hunter (matching vehicle, 1d4 Tier I hired-gun passengers, weapons 1 Caliber below the vehicle) or raises all NPC tiers by 1.",
    "perDie": [
     "+1 pursuer (Tier II hunter, min 1)",
     "+1 Tier to all NPCs in the chase"
    ]
   },
   {
    "id": "surprise-combat",
    "name": "Surprise Combat",
    "page": 403,
    "costMin": 1,
    "costMax": 4,
    "triggers": [
     "Previous or current scene: the characters let an opponent escape a chase or combat"
    ],
    "summary": "A fight starts while the group is stationary. Each die adds 1 Tier II soldier-for-hire leading 1d4 Tier I hired guns (armed to match the PCs, else unarmed fighters) or raises all NPC tiers by 1.",
    "perDie": [
     "+1 Tier II soldier-for-hire with 1d4 Tier I hired guns (min 1)",
     "+1 Tier to all NPCs involved"
    ]
   },
   {
    "id": "thief",
    "name": "Thief",
    "page": 403,
    "costMin": 1,
    "costMax": 4,
    "triggers": [
     "Previous or current mission, after and outside the Intel Phase: the team acquired a Caliber III+ item or one costing over $50,000"
    ],
    "summary": "A Tier III thief with 3 Caliber II items goes after the team's valuables. Each die adds +1 Tier (max V), +1 item, or +1 Caliber to all the thief's items.",
    "perDie": [
     "+1 thief Tier (base III, max V)",
     "+1 item (base 3 Caliber II items)",
     "+1 Caliber to all thief items"
    ]
   },
   {
    "id": "under-review",
    "name": "Under Review",
    "page": 403,
    "costMin": 1,
    "costMax": 4,
    "triggers": [
     "Previous mission: the team willfully ignored a mission objective",
     "Previous mission: the team brought home no more than 1/2 its gear picks (rounded down)",
     "Previous mission: team members lost a combined 10+ Reputation or $500,000+ Net Worth to exposure"
    ],
    "summary": "Only at the start of the Intel Phase, not if already under review. Per die: max gear Caliber -1 (min II), -2 and +1 error range on Profession/Accomplishment. A Tier III observer tags along until the team completes consecutive objectives equal to dice spent.",
    "intensities": [
     {
      "cost": 1,
      "summary": "Max gear Caliber -1; Profession/Accomplishment -2, error +1; 1 consecutive objective to clear"
     },
     {
      "cost": 2,
      "summary": "Max gear Caliber -2; Profession/Accomplishment -4, error +2; 2 consecutive objectives to clear"
     },
     {
      "cost": 3,
      "summary": "Max gear Caliber -3; Profession/Accomplishment -6, error +3; 3 consecutive objectives to clear"
     },
     {
      "cost": 4,
      "summary": "Max gear Caliber -4; Profession/Accomplishment -8, error +4; 4 consecutive objectives to clear"
     }
    ]
   },
   {
    "id": "undesired-attention",
    "name": "Undesired Attention",
    "page": 404,
    "costMin": 1,
    "costMax": 4,
    "triggers": [
     "This mission: team within 1 mile of a public explosion dealing 20+ damage, front-page news, or public tumult involving 100+ people",
     "This mission: team members lost a combined 4+ Reputation or $200,000+ Net Worth to incident, noise or anonymity exposure"
    ],
    "summary": "A journalist or similar NPC threatens to expose the team. Complex Task: 1 Challenge + 1 per die (max 5); first DC 10 + Threat Level, +2 each after; skills must vary. Failure costs 3 Reputation or $150,000 per die and forces new names.",
    "intensities": [
     {
      "cost": 1,
      "summary": "2 Challenges; failure costs 3 Reputation/$150,000"
     },
     {
      "cost": 2,
      "summary": "3 Challenges; failure costs 6 Reputation/$300,000"
     },
     {
      "cost": 3,
      "summary": "4 Challenges; failure costs 9 Reputation/$450,000"
     },
     {
      "cost": 4,
      "summary": "5 Challenges; failure costs 12 Reputation/$600,000"
     }
    ]
   },
   {
    "id": "wanted",
    "name": "Wanted",
    "page": 404,
    "costMin": 1,
    "costMax": 4,
    "triggers": [
     "This mission: the team commits any felony, noticed or not"
    ],
    "summary": "A Tier II detective runs a manhunt with Tier II officers (one per known team member). Each violent escape raises the next team a tier (III, IV, then V). Being sprung from custody costs 10 Reputation/$1,000,000, or 20/$2,000,000 if police were attacked."
   }
  ],
  "rollTables": [
   {
    "id": "random-possessions-civilian",
    "name": "Random Possessions: Uninvolved Civilian/Non-Villain Antagonist",
    "source": "Table 7.16",
    "page": 460,
    "formula": "1d20",
    "columns": [
     "Result",
     "Possessions"
    ],
    "results": [
     {
      "range": [
       1,
       1
      ],
      "text": "Nothing (hole in pocket), or lint",
      "data": {}
     },
     {
      "range": [
       2,
       2
      ],
      "text": "Pocket book (appropriate to genre)",
      "data": {}
     },
     {
      "range": [
       3,
       3
      ],
      "text": "Club business card with a \"hot date\" number",
      "data": {}
     },
     {
      "range": [
       4,
       4
      ],
      "text": "Portable music recorder and earbud headphones",
      "data": {}
     },
     {
      "range": [
       5,
       7
      ],
      "text": "Cell phone (1d12 random numbers, including family and friends)",
      "data": {
       "numbers": "1d12"
      }
     },
     {
      "range": [
       8,
       10
      ],
      "text": "Keys: Caliber I or II vehicle within 1d4 blocks, and house within 2d20 miles (Lifestyle 1d6)",
      "data": {
       "vehicleCaliber": "I or II",
       "vehicleBlocks": "1d4",
       "houseMiles": "2d20",
       "lifestyle": "1d6"
      }
     },
     {
      "range": [
       11,
       18
      ],
      "text": "Wallet: ID, personal photos, scribbled paper scraps, cash and credit cards worth 2d6 x $50",
      "data": {
       "cash": "2d6 * 50"
      }
     },
     {
      "range": [
       19,
       19
      ],
      "text": "Detective shield (undercover police officer); team becomes Wanted (p.404) if implicated in violence against this civilian",
      "data": {
       "event": "wanted"
      }
     },
     {
      "range": [
       20,
       20
      ],
      "text": "1 Caliber I melee weapon or firearm (GC choice or random)",
      "data": {
       "caliber": "I"
      }
     }
    ]
   },
   {
    "id": "random-possessions-minion",
    "name": "Random Possessions: Minion",
    "source": "Table 7.16",
    "page": 460,
    "formula": "1d20",
    "columns": [
     "Result",
     "Possessions"
    ],
    "results": [
     {
      "range": [
       1,
       1
      ],
      "text": "Suicide tooth (recently removed) in a bloody handkerchief",
      "data": {}
     },
     {
      "range": [
       2,
       3
      ],
      "text": "Pack of foreign cigarettes",
      "data": {}
     },
     {
      "range": [
       4,
       5
      ],
      "text": "Deck of cards picturing people on the villain organization's hit list",
      "data": {}
     },
     {
      "range": [
       6,
       6
      ],
      "text": "Pocket video game console with an espionage stealth action game",
      "data": {}
     },
     {
      "range": [
       7,
       7
      ],
      "text": "\"Lucky\" double-headed quarter",
      "data": {}
     },
     {
      "range": [
       8,
       8
      ],
      "text": "Ear plugs and a tape player with a self-help audio book for low-ranking minions",
      "data": {}
     },
     {
      "range": [
       9,
       9
      ],
      "text": "\"Authentication\" kit (to-scale picture and tape measure)",
      "data": {}
     },
     {
      "range": [
       10,
       10
      ],
      "text": "\"Climbing\" kit (Velcro and a low-opening parachute)",
      "data": {}
     },
     {
      "range": [
       11,
       11
      ],
      "text": "\"Disguise\" kit (Groucho glasses and yesterday's newspaper)",
      "data": {}
     },
     {
      "range": [
       12,
       12
      ],
      "text": "\"Electronics\" kit (blunt scissors and a magnet)",
      "data": {}
     },
     {
      "range": [
       13,
       13
      ],
      "text": "\"Forgery\" kit (pocket scanner and number of the nearest copy shop)",
      "data": {}
     },
     {
      "range": [
       14,
       14
      ],
      "text": "\"Mechanics\" kit (Swiss army knife and a hammer)",
      "data": {}
     },
     {
      "range": [
       15,
       15
      ],
      "text": "PDA with stock portfolio, paid-up life insurance plan and a 5-year retirement business plan",
      "data": {}
     },
     {
      "range": [
       16,
       18
      ],
      "text": "Code name ID (e.g. uniform patch, subdermal ID chip)",
      "data": {}
     },
     {
      "range": [
       19,
       20
      ],
      "text": "Real name ID (e.g. day-job business card, training notes)",
      "data": {}
     },
     {
      "range": [
       20,
       20
      ],
      "text": "Clue leading to a henchman in the same organization",
      "data": {
       "clue": "henchman"
      }
     }
    ]
   },
   {
    "id": "random-possessions-henchman",
    "name": "Random Possessions: Henchman",
    "source": "Table 7.16",
    "page": 461,
    "formula": "1d20",
    "columns": [
     "Result",
     "Possessions"
    ],
    "results": [
     {
      "range": [
       1,
       1
      ],
      "text": "Beeper",
      "data": {}
     },
     {
      "range": [
       2,
       2
      ],
      "text": "Ominous-looking capsules in an unmarked tin (actually designer candies)",
      "data": {}
     },
     {
      "range": [
       3,
       3
      ],
      "text": "Designer flask bearing a real-world military branch emblem",
      "data": {}
     },
     {
      "range": [
       4,
       4
      ],
      "text": "Matchbook from a faraway bar or cafe with a foil's name and number inside",
      "data": {}
     },
     {
      "range": [
       5,
       5
      ],
      "text": "Bullet engraved \"Not today\" (owner has a gunshot scar in a vital area)",
      "data": {}
     },
     {
      "range": [
       6,
       6
      ],
      "text": "Dead drop spike holding 1 freshly severed finger in cellophane",
      "data": {}
     },
     {
      "range": [
       7,
       7
      ],
      "text": "Two identical clear bottles: one vintage vodka, the other inflicts 2d10 acid damage",
      "data": {
       "damage": "2d10",
       "damageType": "acid"
      }
     },
     {
      "range": [
       8,
       8
      ],
      "text": "A Chinese fortune slip",
      "data": {}
     },
     {
      "range": [
       9,
       9
      ],
      "text": "1 can of gold body paint",
      "data": {}
     },
     {
      "range": [
       10,
       10
      ],
      "text": "Half-whittled wooden caricature of the mastermind or another superior",
      "data": {}
     },
     {
      "range": [
       11,
       11
      ],
      "text": "\"Lockpicking\" kit (steel-toed boots)",
      "data": {}
     },
     {
      "range": [
       12,
       12
      ],
      "text": "\"Surgery\" kit (needle, thread and an ice pack)",
      "data": {}
     },
     {
      "range": [
       13,
       13
      ],
      "text": "Organization watch, ring, pin or other jewelry (worn)",
      "data": {}
     },
     {
      "range": [
       14,
       14
      ],
      "text": "Pistol, rifle, SMG or shotgun firing pin, or grenade pin",
      "data": {}
     },
     {
      "range": [
       15,
       16
      ],
      "text": "Code name ID (e.g. bar code tattoo, sub-dermal ID chip)",
      "data": {}
     },
     {
      "range": [
       17,
       17
      ],
      "text": "Real name ID (e.g. written threat from another henchman, annotated photo)",
      "data": {}
     },
     {
      "range": [
       18,
       18
      ],
      "text": "Clue leading to another henchman in the same organization",
      "data": {
       "clue": "henchman"
      }
     },
     {
      "range": [
       19,
       19
      ],
      "text": "Clue leading to the mastermind of the same organization",
      "data": {
       "clue": "mastermind"
      }
     },
     {
      "range": [
       20,
       20
      ],
      "text": "Minor clue about the current mission (GC choice)",
      "data": {
       "clue": "mission-minor"
      }
     }
    ]
   },
   {
    "id": "random-possessions-mastermind",
    "name": "Random Possessions: Mastermind",
    "source": "Table 7.16",
    "page": 461,
    "formula": "1d20",
    "columns": [
     "Result",
     "Possessions"
    ],
    "results": [
     {
      "range": [
       1,
       1
      ],
      "text": "Dossier and photos of 1 player character, including recent private shots",
      "data": {}
     },
     {
      "range": [
       2,
       2
      ],
      "text": "Photos of recently AWOL operatives, each gruesomely slain",
      "data": {}
     },
     {
      "range": [
       3,
       3
      ],
      "text": "Two tickets to a social event this evening",
      "data": {}
     },
     {
      "range": [
       4,
       4
      ],
      "text": "Blackmail photos of 1 local police official",
      "data": {}
     },
     {
      "range": [
       5,
       5
      ],
      "text": "Name of 1 contact (will not work with the team but may have information)",
      "data": {}
     },
     {
      "range": [
       6,
       6
      ],
      "text": "Medication for a nervous tic or mental disorder",
      "data": {}
     },
     {
      "range": [
       7,
       7
      ],
      "text": "Micro-cassette recorder with a tape of the mastermind rehearsing an evil laugh",
      "data": {}
     },
     {
      "range": [
       8,
       8
      ],
      "text": "Unfinished sketch of his latest slow death mechanism",
      "data": {}
     },
     {
      "range": [
       9,
       9
      ],
      "text": "Unfinished monologue meant for that mechanism's victim",
      "data": {}
     },
     {
      "range": [
       10,
       10
      ],
      "text": "Hardback how-to manual on executions for masterminds",
      "data": {}
     },
     {
      "range": [
       11,
       11
      ],
      "text": "Action figure of himself",
      "data": {}
     },
     {
      "range": [
       12,
       12
      ],
      "text": "Bank receipts for black-market purchase of 1 exotic animal and 1 piece of military hardware",
      "data": {}
     },
     {
      "range": [
       13,
       13
      ],
      "text": "Holographic recording: inconclusive proof of a conspiracy cover-up",
      "data": {}
     },
     {
      "range": [
       14,
       14
      ],
      "text": "Pocket-sized poisonous \"pet\" (Tier II attack bonus + poison chosen by GC or random)",
      "data": {
       "attackTier": "II"
      }
     },
     {
      "range": [
       15,
       15
      ],
      "text": "\"To Do\" list mixing villainy and mundane chores",
      "data": {}
     },
     {
      "range": [
       16,
       16
      ],
      "text": "List of 1d6 cities targeted for destruction",
      "data": {
       "count": "1d6"
      }
     },
     {
      "range": [
       17,
       17
      ],
      "text": "List of 1d6 henchmen who displeased him, each Marked for Death (p.399)",
      "data": {
       "count": "1d6",
       "event": "marked-for-death"
      }
     },
     {
      "range": [
       18,
       18
      ],
      "text": "1 Caliber I gadget (GC choice or random)",
      "data": {
       "caliber": "I"
      }
     },
     {
      "range": [
       19,
       19
      ],
      "text": "Single-button remote with a random effect (e.g. teleport to safe house, trap door, detonation for 6d6 explosive damage)",
      "data": {
       "damage": "6d6",
       "damageType": "explosive"
      }
     },
     {
      "range": [
       20,
       20
      ],
      "text": "Major clue about the current or next mission (GC choice)",
      "data": {
       "clue": "mission-major"
      }
     }
    ]
   }
  ],
  "lookups": {
   "hazards": {
    "title": "Table 7.2: Hazards",
    "page": 400,
    "keyedBy": "GC action dice spent (not rolled)",
    "columns": [
     "Hazard",
     "Action Die Cost",
     "Effect"
    ],
    "rows": [
     [
      "Contagion",
      "1",
      "Exposure to 1 sample of any basic poison, or a disease with Complexity DC up to 50"
     ],
     [
      "Contagion",
      "2",
      "Exposure to 1 sample of any improved poison, or a disease with Complexity DC 55-60"
     ],
     [
      "Contagion",
      "3",
      "Exposure to 1 sample of advanced dementia, fear, necrotizing, neurotoxin, psychotropic, truth serum or weakening poison, or a disease with Complexity DC 65-70"
     ],
     [
      "Contagion",
      "4",
      "Exposure to 1 sample of advanced blister, hallucinogen, knockout, lethal, paralytic or radiation poison, or a disease with Complexity DC 75-80"
     ],
     [
      "Contagion",
      "5*",
      "Exposure to 1 sample of Encephalitis/Meningitis, or a disease with Complexity DC 85-90"
     ],
     [
      "Contagion",
      "6*",
      "Exposure to 1 sample of Tuberculosis, or a disease with Complexity DC 95-105"
     ],
     [
      "Contagion",
      "7*",
      "Exposure to 1 sample of Bubonic plague, or a disease with Complexity DC 110-125"
     ],
     [
      "Contagion",
      "8*",
      "Exposure to 1 sample of Ebola, or a disease with Complexity DC 130+"
     ],
     [
      "Explosion",
      "1",
      "Ground Zero 3d4 squares from 1 chosen character; 2d10 explosive damage; blast increment 1 square"
     ],
     [
      "Explosion",
      "2",
      "Ground Zero 2d4 squares from 1 chosen character; 4d10 explosive damage; blast increment 1 square"
     ],
     [
      "Explosion",
      "3",
      "Ground Zero 1d4 squares from 1 chosen character; 6d10 explosive damage; blast increment 2 squares"
     ],
     [
      "Explosion",
      "4",
      "1 chosen character is Ground Zero; 8d10 explosive damage; blast increment 2 squares"
     ],
     [
      "Random Fire/Crossfire",
      "1",
      "1 character targeted with a grade II NPC attack bonus, using any Caliber I firearm"
     ],
     [
      "Random Fire/Crossfire",
      "2",
      "1 character targeted with a grade IV NPC attack bonus, using any Caliber II firearm"
     ],
     [
      "Random Fire/Crossfire",
      "3",
      "1 character targeted with a grade VI NPC attack bonus, using any Caliber III firearm"
     ],
     [
      "Random Fire/Crossfire",
      "4",
      "1 character targeted with a grade VIII NPC attack bonus, using any Caliber IV firearm"
     ],
     [
      "Runaway Vehicle",
      "1",
      "1d4 characters targeted with a grade II NPC skill bonus, using any Caliber I vehicle"
     ],
     [
      "Runaway Vehicle",
      "2",
      "1d4 characters targeted with a grade IV NPC skill bonus, using any Caliber II vehicle"
     ],
     [
      "Runaway Vehicle",
      "3",
      "1d4 characters targeted with a grade VI NPC skill bonus, using any Caliber III vehicle"
     ],
     [
      "Runaway Vehicle",
      "4",
      "1d4 characters targeted with a grade VIII NPC skill bonus, using any Caliber IV vehicle"
     ],
     [
      "Security",
      "1",
      "Characters impeded by a security device with a Power Rating of 2"
     ],
     [
      "Security",
      "2",
      "Characters impeded by a security device with a Power Rating of 4"
     ],
     [
      "Security",
      "3",
      "Characters impeded by a security device with a Power Rating of 6"
     ],
     [
      "Security",
      "4",
      "Characters impeded by a security device with a Power Rating of 8"
     ]
    ],
    "rowData": [
     {
      "cost": 1,
      "poison": "basic",
      "diseaseComplexityDC": "up to 50"
     },
     {
      "cost": 2,
      "poison": "improved",
      "diseaseComplexityDC": "55-60"
     },
     {
      "cost": 3,
      "poison": "advanced (dementia, fear, necrotizing, neurotoxin, psychotropic, truth serum, weakening)",
      "diseaseComplexityDC": "65-70"
     },
     {
      "cost": 4,
      "poison": "advanced (blister, hallucinogen, knockout, lethal, paralytic, radiation)",
      "diseaseComplexityDC": "75-80"
     },
     {
      "cost": 5,
      "exceedsLimit": true,
      "disease": "Encephalitis/Meningitis",
      "diseaseComplexityDC": "85-90"
     },
     {
      "cost": 6,
      "exceedsLimit": true,
      "disease": "Tuberculosis",
      "diseaseComplexityDC": "95-105"
     },
     {
      "cost": 7,
      "exceedsLimit": true,
      "disease": "Bubonic plague",
      "diseaseComplexityDC": "110-125"
     },
     {
      "cost": 8,
      "exceedsLimit": true,
      "disease": "Ebola",
      "diseaseComplexityDC": "130+"
     },
     {
      "cost": 1,
      "distanceSquares": "3d4",
      "damage": "2d10",
      "damageType": "explosive",
      "blastIncrementSquares": 1
     },
     {
      "cost": 2,
      "distanceSquares": "2d4",
      "damage": "4d10",
      "damageType": "explosive",
      "blastIncrementSquares": 1
     },
     {
      "cost": 3,
      "distanceSquares": "1d4",
      "damage": "6d10",
      "damageType": "explosive",
      "blastIncrementSquares": 2
     },
     {
      "cost": 4,
      "distanceSquares": "0",
      "damage": "8d10",
      "damageType": "explosive",
      "blastIncrementSquares": 2
     },
     {
      "cost": 1,
      "targets": "1",
      "npcGrade": "II",
      "caliber": "I"
     },
     {
      "cost": 2,
      "targets": "1",
      "npcGrade": "IV",
      "caliber": "II"
     },
     {
      "cost": 3,
      "targets": "1",
      "npcGrade": "VI",
      "caliber": "III"
     },
     {
      "cost": 4,
      "targets": "1",
      "npcGrade": "VIII",
      "caliber": "IV"
     },
     {
      "cost": 1,
      "targets": "1d4",
      "npcGrade": "II",
      "caliber": "I"
     },
     {
      "cost": 2,
      "targets": "1d4",
      "npcGrade": "IV",
      "caliber": "II"
     },
     {
      "cost": 3,
      "targets": "1d4",
      "npcGrade": "VI",
      "caliber": "III"
     },
     {
      "cost": 4,
      "targets": "1d4",
      "npcGrade": "VIII",
      "caliber": "IV"
     },
     {
      "cost": 1,
      "powerRating": 2
     },
     {
      "cost": 2,
      "powerRating": 4
     },
     {
      "cost": 3,
      "powerRating": 6
     },
     {
      "cost": 4,
      "powerRating": 8
     }
    ],
    "notes": [
     "* Contagion costs of 5-8 dice exceed the normal 4-dice cap per hazard; reserve them for plot-critical use when the team is ready."
    ]
   },
   "naturesFury": {
    "title": "Table 7.3: Nature's Fury",
    "page": 401,
    "keyedBy": "GC action dice spent (not rolled)",
    "columns": [
     "Type",
     "Action Die Cost",
     "Intensity",
     "Effect"
    ],
    "rows": [
     [
      "Earthquake",
      "1",
      "Tremor",
      "Duration 1 round; -2 to attack and Dex-based skill checks; Ref save (DC 10) or 1d4 lethal and stress damage and sprawled"
     ],
     [
      "Earthquake",
      "2",
      "Minor quake",
      "Duration 1d4 rounds; -4 to attack and Dex-based skill checks; each round Ref save (DC 15) or 1d4 lethal and stress damage and sprawled"
     ],
     [
      "Earthquake",
      "3",
      "Moderate quake",
      "Duration 2d4 rounds; -6 to attack and Dex-based skill checks; each round Ref save (DC 20) or 1d4 lethal and stress damage and sprawled"
     ],
     [
      "Earthquake",
      "4",
      "Major quake",
      "Duration 3d4 rounds; -8 to attack and Dex-based skill checks; each round Ref save (DC 25) or 1d4 lethal and stress damage and sprawled"
     ],
     [
      "Fog",
      "1",
      "Light",
      "Duration 1d4 hours; vision effects only (see p.350); halfway through GC rolls 1d10, on 1 becomes moderate"
     ],
     [
      "Fog",
      "2",
      "Moderate",
      "Duration 2d4 hours; vision effects only (see p.350); halfway through GC rolls 1d10, on 1 becomes dense"
     ],
     [
      "Fog",
      "3",
      "Dense",
      "Duration 3d4 hours; vision effects only (see p.350)"
     ],
     [
      "Landslide",
      "1",
      "Indirect slide zone††",
      "Ref save (DC 15) or 3d6 lethal and stress damage and buried"
     ],
     [
      "Landslide",
      "2",
      "Direct slide zone††",
      "Ref save (DC 20) or 6d6 lethal and stress damage and buried"
     ],
     [
      "Landslide",
      "3",
      "Indirect bury zone††",
      "Buried; 4d6 lethal and stress damage, Ref save (DC 15) for 1/2 (rounded down)"
     ],
     [
      "Landslide",
      "4",
      "Direct bury zone††",
      "Buried; 8d6 lethal and stress damage, Ref save (DC 20) for 1/2 (rounded down)"
     ],
     [
      "Lightning",
      "1",
      "Distant strike",
      "This round: +20 ft. visual range, visual Awareness/Perception penalties reduced by 2 (min +0). Next round (thunder): -20 ft. hearing range, -2 to hearing Awareness/Perception"
     ],
     [
      "Lightning",
      "2",
      "Local strike",
      "This round: 1d6 stress damage; +40 ft. visual range, visual Awareness/Perception penalties reduced by 4 (min +0). Next round (thunder): -40 ft. hearing range, -4 to hearing Awareness/Perception"
     ],
     [
      "Lightning",
      "3",
      "Near strike",
      "This round: 2d6 flash, bang and stress damage; Fort save (DC 10) or sprawled; 1 object or scenery piece within 100 ft. takes 4d10+20 electrical and fire damage; +60 ft. visual range, visual penalties reduced by 6 (min +0). Next round (thunder): -60 ft. hearing range, -6 to hearing Awareness/Perception"
     ],
     [
      "Lightning",
      "4",
      "Direct strike",
      "This round: 3d6 flash, bang and stress damage; Fort save (DC 20) or sprawled; 1 character takes 4d10+20 electrical and fire damage and is sprawled; +80 ft. visual range, visual penalties reduced by 8 (min +0). Next round (thunder): -80 ft. hearing range, -8 to hearing Awareness/Perception"
     ],
     [
      "Rain/Snow",
      "1",
      "Light",
      "Duration 3d20 minutes; like 1 gallon of water per minute on each unprotected flame; halfway through GC rolls 1d10, on 1 becomes moderate"
     ],
     [
      "Rain/Snow",
      "2",
      "Moderate",
      "Duration 1d4 hours; like 2 gallons of water per minute on each unprotected flame; halfway through GC rolls 1d10, on 1 becomes heavy"
     ],
     [
      "Rain/Snow",
      "3",
      "Heavy",
      "Duration 2d4 hours; like 3 gallons of water per minute on each unprotected flame; halfway through GC rolls 1d10, on 1 becomes a storm"
     ],
     [
      "Rain/Snow",
      "4",
      "Thunderstorm/Snowstorm",
      "Duration 3d4 hours; like 4 gallons of water per minute on each unprotected flame; halfway through GC rolls 1d10: on 1 becomes hurricane or blizzard, on 2 a flash flood or flash freeze occurs"
     ],
     [
      "Rain/Snow",
      "—",
      "Flash Flood",
      "3d6 subdual damage; Ref save (DC 15) or sprawled and pushed 3d6 x 10 ft., taking 1d6 lethal damage per 30 ft. pushed"
     ],
     [
      "Rain/Snow",
      "—",
      "Flash Freeze",
      "3d6 cold damage and exposure to cold contagion (see p.231)"
     ],
     [
      "Rain/Snow",
      "—",
      "Hurricane",
      "Duration 3d4 hours; as severe wind; puts out any unprotected flame; halfway through GC rolls 1d10, on 1-4 a flash flood occurs"
     ],
     [
      "Rain/Snow",
      "—",
      "Blizzard",
      "Duration 3d4 hours; as strong wind; puts out any unprotected flame; 1d6 cold damage per hour; halfway through GC rolls 1d10, on 1-4 a flash freeze occurs"
     ],
     [
      "Volcanic Eruption",
      "1",
      "Gentle",
      "Duration 1d6 hours, within 1/4 mile; 1d6 stress damage; vision and hearing ranges x 3/4 (rounded down); Fort save (DC 10) or deafened until 1d6 hours after the eruption ends; GC may spend 1 action die to hit 1 character with a volcanic bomb for 1d10 fire and stress damage"
     ],
     [
      "Volcanic Eruption",
      "2",
      "Minor",
      "Duration 2d6 hours, within 1/2 mile; 2d6 stress damage; vision and hearing ranges x 1/2 (rounded down); Fort save (DC 15) or deafened until 2d6 hours after the eruption ends; GC may spend 2 action dice to hit 1 character with a volcanic bomb for 1d10 fire and stress damage per die"
     ],
     [
      "Volcanic Eruption",
      "3",
      "Moderate",
      "Duration 3d6 hours, within 1 mile; 3d6 stress damage; vision and hearing ranges x 1/4 (rounded down); Fort save (DC 20) or deafened until 3d6 hours after [text garbled in source]; volcanic bomb 1d10 fire and stress damage per action die spent; halfway through GC rolls 1d10, on 1 poison gas rises at the team's location"
     ],
     [
      "Volcanic Eruption",
      "4",
      "Major",
      "Duration 4d6 hours, within 2 miles; 4d6 stress damage; vision and hearing ranges [multiplier, save and deafness text missing in source]; GC may spend 4 action dice to hit 1 character with a volcanic bomb for 1d10 fire and stress damage per die; halfway through GC rolls 1d10, on 1 poison gas rises at the team's location"
     ],
     [
      "Volcanic Eruption",
      "—",
      "Poison gas",
      "Acts as a contagion: Primary Onset 1d4 rounds, Primary Save DC 15, Primary Effect 1d2 Con damage + fatigued; Secondary Onset 1d4 minutes, Secondary Save DC 20, Secondary Effect 1d4 Con damage + fatigued"
     ],
     [
      "Wind",
      "1",
      "Light",
      "Duration 3d20 minutes; -2 to Damage saves to stop fire spreading; -2 to hurled attack checks; halfway through GC rolls 1d10, on 1 becomes moderate"
     ],
     [
      "Wind",
      "2",
      "Moderate",
      "Duration 1d4 hours; -4 to Damage saves to stop fire spreading; -4 to hurled attack and hearing Awareness/Perception checks; -5 ft. Speed; halfway through GC rolls 1d10, on 1 becomes strong"
     ],
     [
      "Wind",
      "3",
      "Strong",
      "Duration 2d4 hours; -6 to Damage saves to stop fire spreading; -6 to hurled attacks; -2 to other ranged attacks; -10 ft. Speed; Fort save (DC 15) or sprawled and pushed 1d6 x 5 ft., taking 1d6 lethal damage per 10 ft. pushed; halfway through GC rolls 1d10, on 1 becomes severe"
     ],
     [
      "Wind",
      "4",
      "Severe",
      "Duration 3d4 hours; -8 to Damage saves to stop fire spreading; -8 to hurled attacks; -4 to other ranged attacks; -15 ft. Speed; Fort save (DC 20) or sprawled and pushed 1d6 x 10 ft., taking 1d6 lethal damage per 10 ft. pushed; halfway through GC rolls 1d10, on 1 becomes a dust storm or spawns a tornado (by terrain)"
     ],
     [
      "Wind",
      "—",
      "Dust storm",
      "Duration 3d4 hours; as severe wind, plus vision effects (see p.350)"
     ],
     [
      "Wind",
      "—",
      "Tornado",
      "Duration 1d12 minutes; puts out any unprotected flame; hurled attacks impossible; -8 to other ranged attacks; only movement is a 5-ft. bonus step; within 100 ft. Fort save (DC 30) or sucked in for 2d6 rounds, taking 1d10 lethal damage per round, then expelled 1d4 miles away at a height of 2d20+20 ft. (falling damage, p.336)"
     ]
    ],
    "rowData": [
     {
      "cost": 1,
      "duration": "1 round",
      "penalty": -2,
      "save": "Ref",
      "dc": 10,
      "damage": "1d4",
      "damageType": "lethal and stress",
      "condition": "sprawled",
      "perRound": false
     },
     {
      "cost": 2,
      "duration": "1d4 rounds",
      "penalty": -4,
      "save": "Ref",
      "dc": 15,
      "damage": "1d4",
      "damageType": "lethal and stress",
      "condition": "sprawled",
      "perRound": true
     },
     {
      "cost": 3,
      "duration": "2d4 rounds",
      "penalty": -6,
      "save": "Ref",
      "dc": 20,
      "damage": "1d4",
      "damageType": "lethal and stress",
      "condition": "sprawled",
      "perRound": true
     },
     {
      "cost": 4,
      "duration": "3d4 rounds",
      "penalty": -8,
      "save": "Ref",
      "dc": 25,
      "damage": "1d4",
      "damageType": "lethal and stress",
      "condition": "sprawled",
      "perRound": true
     },
     {
      "cost": 1,
      "duration": "1d4 hours",
      "escalation": {
       "roll": "1d10",
       "on": [
        1,
        1
       ],
       "becomes": "moderate"
      }
     },
     {
      "cost": 2,
      "duration": "2d4 hours",
      "escalation": {
       "roll": "1d10",
       "on": [
        1,
        1
       ],
       "becomes": "dense"
      }
     },
     {
      "cost": 3,
      "duration": "3d4 hours",
      "escalation": null
     },
     {
      "cost": 1,
      "save": "Ref",
      "dc": 15,
      "damage": "3d6",
      "damageType": "lethal and stress",
      "condition": "buried"
     },
     {
      "cost": 2,
      "save": "Ref",
      "dc": 20,
      "damage": "6d6",
      "damageType": "lethal and stress",
      "condition": "buried"
     },
     {
      "cost": 3,
      "save": "Ref",
      "dc": 15,
      "damage": "4d6",
      "damageType": "lethal and stress",
      "condition": "buried (automatic)",
      "saveEffect": "half damage"
     },
     {
      "cost": 4,
      "save": "Ref",
      "dc": 20,
      "damage": "8d6",
      "damageType": "lethal and stress",
      "condition": "buried (automatic)",
      "saveEffect": "half damage"
     },
     {
      "cost": 1,
      "visualRangeFt": 20,
      "hearingRangeFt": -20,
      "penaltyShift": 2
     },
     {
      "cost": 2,
      "damage": "1d6",
      "damageType": "stress",
      "visualRangeFt": 40,
      "hearingRangeFt": -40,
      "penaltyShift": 4
     },
     {
      "cost": 3,
      "damage": "2d6",
      "damageType": "flash, bang and stress",
      "save": "Fort",
      "dc": 10,
      "condition": "sprawled",
      "strikeDamage": "4d10+20",
      "strikeDamageType": "electrical and fire",
      "strikeTarget": "1 object or scenery within 100 ft.",
      "visualRangeFt": 60,
      "hearingRangeFt": -60,
      "penaltyShift": 6
     },
     {
      "cost": 4,
      "damage": "3d6",
      "damageType": "flash, bang and stress",
      "save": "Fort",
      "dc": 20,
      "condition": "sprawled",
      "strikeDamage": "4d10+20",
      "strikeDamageType": "electrical and fire",
      "strikeTarget": "1 character (also sprawled)",
      "visualRangeFt": 80,
      "hearingRangeFt": -80,
      "penaltyShift": 8
     },
     {
      "cost": 1,
      "duration": "3d20 minutes",
      "gallonsPerMinute": 1,
      "escalation": {
       "roll": "1d10",
       "on": [
        1,
        1
       ],
       "becomes": "moderate"
      }
     },
     {
      "cost": 2,
      "duration": "1d4 hours",
      "gallonsPerMinute": 2,
      "escalation": {
       "roll": "1d10",
       "on": [
        1,
        1
       ],
       "becomes": "heavy"
      }
     },
     {
      "cost": 3,
      "duration": "2d4 hours",
      "gallonsPerMinute": 3,
      "escalation": {
       "roll": "1d10",
       "on": [
        1,
        1
       ],
       "becomes": "thunderstorm/snowstorm"
      }
     },
     {
      "cost": 4,
      "duration": "3d4 hours",
      "gallonsPerMinute": 4,
      "escalation": [
       {
        "roll": "1d10",
        "on": [
         1,
         1
        ],
        "becomes": "hurricane or blizzard"
       },
       {
        "roll": "1d10",
        "on": [
         2,
         2
        ],
        "becomes": "flash flood or flash freeze"
       }
      ]
     },
     {
      "cost": null,
      "damage": "3d6",
      "damageType": "subdual",
      "save": "Ref",
      "dc": 15,
      "condition": "sprawled",
      "pushFt": "3d6 x 10",
      "pushDamage": "1d6 lethal per 30 ft."
     },
     {
      "cost": null,
      "damage": "3d6",
      "damageType": "cold",
      "contagion": "cold"
     },
     {
      "cost": null,
      "duration": "3d4 hours",
      "as": "Wind/Severe",
      "escalation": {
       "roll": "1d10",
       "on": [
        1,
        4
       ],
       "becomes": "flash flood"
      }
     },
     {
      "cost": null,
      "duration": "3d4 hours",
      "as": "Wind/Strong",
      "damage": "1d6",
      "damageType": "cold",
      "damageInterval": "hour",
      "escalation": {
       "roll": "1d10",
       "on": [
        1,
        4
       ],
       "becomes": "flash freeze"
      }
     },
     {
      "cost": 1,
      "duration": "1d6 hours",
      "radius": "1/4 mile",
      "damage": "1d6",
      "damageType": "stress",
      "rangeMultiplier": "3/4",
      "save": "Fort",
      "dc": 10,
      "condition": "deafened",
      "deafenedHoursAfter": "1d6",
      "bombDice": 1,
      "bombDamage": "1d10 fire and stress per action die"
     },
     {
      "cost": 2,
      "duration": "2d6 hours",
      "radius": "1/2 mile",
      "damage": "2d6",
      "damageType": "stress",
      "rangeMultiplier": "1/2",
      "save": "Fort",
      "dc": 15,
      "condition": "deafened",
      "deafenedHoursAfter": "2d6",
      "bombDice": 2,
      "bombDamage": "1d10 fire and stress per action die"
     },
     {
      "cost": 3,
      "duration": "3d6 hours",
      "radius": "1 mile",
      "damage": "3d6",
      "damageType": "stress",
      "rangeMultiplier": "1/4",
      "save": "Fort",
      "dc": 20,
      "condition": "deafened",
      "deafenedHoursAfter": "3d6",
      "bombDice": null,
      "bombDamage": "1d10 fire and stress per action die",
      "escalation": {
       "roll": "1d10",
       "on": [
        1,
        1
       ],
       "becomes": "poison gas"
      }
     },
     {
      "cost": 4,
      "duration": "4d6 hours",
      "radius": "2 miles",
      "damage": "4d6",
      "damageType": "stress",
      "rangeMultiplier": null,
      "save": null,
      "dc": null,
      "bombDice": 4,
      "bombDamage": "1d10 fire and stress per action die",
      "escalation": {
       "roll": "1d10",
       "on": [
        1,
        1
       ],
       "becomes": "poison gas"
      }
     },
     {
      "cost": null,
      "contagion": {
       "primaryOnset": "1d4 rounds",
       "primarySaveDC": 15,
       "primaryEffect": "1d2 Con damage + fatigued",
       "secondaryOnset": "1d4 minutes",
       "secondarySaveDC": 20,
       "secondaryEffect": "1d4 Con damage + fatigued"
      }
     },
     {
      "cost": 1,
      "duration": "3d20 minutes",
      "fireSpreadSavePenalty": -2,
      "hurledAttackPenalty": -2,
      "escalation": {
       "roll": "1d10",
       "on": [
        1,
        1
       ],
       "becomes": "moderate"
      }
     },
     {
      "cost": 2,
      "duration": "1d4 hours",
      "fireSpreadSavePenalty": -4,
      "hurledAttackPenalty": -4,
      "hearingPenalty": -4,
      "speedFt": -5,
      "escalation": {
       "roll": "1d10",
       "on": [
        1,
        1
       ],
       "becomes": "strong"
      }
     },
     {
      "cost": 3,
      "duration": "2d4 hours",
      "fireSpreadSavePenalty": -6,
      "hurledAttackPenalty": -6,
      "rangedAttackPenalty": -2,
      "speedFt": -10,
      "save": "Fort",
      "dc": 15,
      "condition": "sprawled",
      "pushFt": "1d6 x 5",
      "pushDamage": "1d6 lethal per 10 ft.",
      "escalation": {
       "roll": "1d10",
       "on": [
        1,
        1
       ],
       "becomes": "severe"
      }
     },
     {
      "cost": 4,
      "duration": "3d4 hours",
      "fireSpreadSavePenalty": -8,
      "hurledAttackPenalty": -8,
      "rangedAttackPenalty": -4,
      "speedFt": -15,
      "save": "Fort",
      "dc": 20,
      "condition": "sprawled",
      "pushFt": "1d6 x 10",
      "pushDamage": "1d6 lethal per 10 ft.",
      "escalation": {
       "roll": "1d10",
       "on": [
        1,
        1
       ],
       "becomes": "dust storm or tornado"
      }
     },
     {
      "cost": null,
      "duration": "3d4 hours",
      "as": "Wind/Severe"
     },
     {
      "cost": null,
      "duration": "1d12 minutes",
      "rangedAttackPenalty": -8,
      "save": "Fort",
      "dc": 30,
      "withinFt": 100,
      "heldRounds": "2d6",
      "damage": "1d10",
      "damageType": "lethal",
      "damageInterval": "round",
      "expelledMiles": "1d4",
      "expelledHeightFt": "2d20+20"
     }
    ],
    "notes": [
     "* Intensity is as felt at the characters' location.",
     "** Each character suffers the effect individually unless stated; separate groups in different areas need separate events.",
     "† Some conditions add effects from Table 5.14: Vision and Hearing (p.350).",
     "†† Slide zone = area the debris slides across; bury zone = area directly in the debris path.",
     "Rows with cost \"—\" cannot be bought directly; they arise from the escalation rolls of other rows.",
     "Earthquake through Rain/Snow are on p.401; Volcanic Eruption and Wind on p.402."
    ]
   },
   "randomPossessionsNotes": {
    "title": "Table 7.16: Random Possessions - footnotes",
    "page": 460,
    "columns": [
     "Mark",
     "Note"
    ],
    "rows": [
     [
      "*",
      "Any category can also be used for a foil involved with that kind of NPC."
     ],
     [
      "**",
      "Civilian result 19: if implicated in violence against this civilian, the characters become Wanted (p.404)."
     ]
    ],
    "notes": [
     "GC rolls 1d20 on the sub-table for the NPC type; results are in addition to gear in the stat block."
    ]
   },
   "exposureRules": {
    "title": "Exposure rules (text, pp.435-436)",
    "page": 435,
    "columns": [
     "Rule",
     "Value"
    ],
    "rows": [
     [
      "Penalty applies",
      "Immediately, each time a character commits a listed infraction; mission Reputation/Net Worth reward unaffected"
     ],
     [
      "Infraction committed to prevent/stop an equal or worse infraction",
      "1/2 listed penalty (rounded up)"
     ],
     [
      "Critical objectives",
      "First is free; +25 XP per additional; -50 XP if the mission has none"
     ],
     [
      "Dramatic scenes",
      "First is free; +100 XP per additional scripted; -50 XP if the mission has none"
     ],
     [
      "Complication ignored/bypassed",
      "Its XP reward is 1/2 (rounded up)"
     ]
    ],
    "notes": []
   },
   "securityNotes": {
    "title": "Table 7.9: Security Options - footnotes and general rules",
    "page": 438,
    "columns": [
     "Mark",
     "Note"
    ],
    "rows": [
     [
      "*",
      "PR = device Power Rating, chosen by the GC unless another rule sets it."
     ],
     [
      "**",
      "Skill checks to avoid a sensor carry the Armor Check Penalty tag."
     ],
     [
      "†",
      "Breaking this lock does not open the portal/container; it only prevents further skill checks to open it."
     ],
     [
      "††",
      "Check gains a Computers synergy bonus when a computer is used to forge the access item."
     ],
     [
      "∆",
      "If a device is deliberately hidden, Detect DC = the hider's Stash Item (Scenery) result."
     ],
     [
      "∆∆",
      "Sensor trips automatically unless disabled (e.g. pressure plate at 20+ lbs.)."
     ],
     [
      "Ω",
      "Awareness bonus applies only to an automated eye; a remote human observer uses their own bonus."
     ],
     [
      "ΩΩ",
      "Tripwire: Reflex save DC 10 + PR. Laser tripwire: Reflex save DC 15 + PR."
     ],
     [
      "§",
      "Attacks 1 character in its area each round until disabled or out of ammunition; ranged weapons hold PR × 5 shots unless stated."
     ],
     [
      "§§",
      "Per die of explosive damage (maximum +10)."
     ],
     [
      "∞",
      "Effects apply after 1d4+1 rounds."
     ],
     [
      "∞∞",
      "PR multiplier doubles as range increment; error range 1, threat range = 1/2 PR rounded up (e.g. PR 5 = 18-20)."
     ],
     [
      "◊",
      "Rarely linked to locks or sensors; used to catch animals or people in the wild."
     ],
     [
      "◊◊",
      "Victim is caged; cage Damage save bonus PR × 3, Security/Disable DC 10 + (PR × 2)."
     ]
    ],
    "notes": [
     "XP for a device counts once per time the team must overcome it; identical duplicate devices on alternate entrances count once.",
     "Devices are found with Notice/Awareness or Search/Perception vs. Detect DC and neutralized with Security/Disable vs. Disable DC.",
     "A device that can be attacked has Defense equal to its Detect DC.",
     "Traps with an attack bonus have error range 1 and threat range 20 and make a Standard Attack on whoever tripped the sensor; traps with a save DC deal 1/2 damage (rounded down) on a successful Reflex save.",
     "Sensor Awareness checks are never subject to a result cap."
    ]
   }
  },
  "objectives": [
   {
    "category": "Crucial Skill Check",
    "name": "Standard skill check (DC 10 + Threat Level); opposed check (skill bonus up to 1/2 highest in team)",
    "grade": 1,
    "xp": 25,
    "page": 431,
    "note": ""
   },
   {
    "category": "Crucial Skill Check",
    "name": "Standard skill check (DC 15 + Threat Level); opposed check (skill bonus over 1/2 highest, up to highest in team)",
    "grade": 2,
    "xp": 50,
    "page": 431,
    "note": ""
   },
   {
    "category": "Crucial Skill Check",
    "name": "Standard skill check (DC 20 + Threat Level); Complex Task (2-4 Challenges, DC 10 + Threat Level); opposed check (skill bonus over highest in team)",
    "grade": 3,
    "xp": 75,
    "page": 431,
    "note": ""
   },
   {
    "category": "Crucial Skill Check",
    "name": "Standard skill check (DC 25 + Threat Level); Complex Task (5-7 Challenges, DC 15 + Threat Level); Dramatic Conflict (Lead 2-6, opposing bonus up to highest in team)",
    "grade": 4,
    "xp": 100,
    "page": 431,
    "note": ""
   },
   {
    "category": "Crucial Skill Check",
    "name": "Complex Task (8-10 Challenges, DC 20 + Threat Level); Dramatic Conflict (Lead 7-10, opposing bonus over highest in team)",
    "grade": 5,
    "xp": 125,
    "page": 431,
    "note": ""
   },
   {
    "category": "Aid/Advise",
    "name": "See a delicate but not very dangerous transaction through; help mediate a warmly contested point with a shaky ally",
    "grade": 1,
    "xp": 25,
    "page": 431,
    "note": ""
   },
   {
    "category": "Aid/Advise",
    "name": "See a delicate and dangerous transaction through; help mediate a hotly contested point with a bitter enemy",
    "grade": 2,
    "xp": 50,
    "page": 431,
    "note": ""
   },
   {
    "category": "Aid/Advise",
    "name": "Clear a character of minor crimes or mild slander; help root out a single well-placed mole",
    "grade": 3,
    "xp": 75,
    "page": 431,
    "note": ""
   },
   {
    "category": "Aid/Advise",
    "name": "Clear a character of a single felony or severe slander; help root out a new or unstable mole network",
    "grade": 4,
    "xp": 100,
    "page": 431,
    "note": ""
   },
   {
    "category": "Aid/Advise",
    "name": "Clear a character of multiple felonies; help root out an entrenched, well-informed mole network",
    "grade": 5,
    "xp": 125,
    "page": 431,
    "note": ""
   },
   {
    "category": "Acquire",
    "name": "Recover a single obscure artifact; hijack a poorly armed civilian transport; steal a poorly defended object (owner interest mild)",
    "grade": 1,
    "xp": 25,
    "page": 431,
    "note": ""
   },
   {
    "category": "Acquire",
    "name": "Recover several obscure artifacts lost under a year; hijack a well-armed private transport; steal a well-defended object (owner interest moderate)",
    "grade": 2,
    "xp": 50,
    "page": 431,
    "note": ""
   },
   {
    "category": "Acquire",
    "name": "Recover many obscure artifacts lost up to a decade; hijack a well-armed government transport; steal an intensely defended object (owner interest moderate)",
    "grade": 3,
    "xp": 75,
    "page": 431,
    "note": ""
   },
   {
    "category": "Acquire",
    "name": "Recover many obscure artifacts lost up to a century; hijack a well-armed villain transport; steal a well-defended object (owner interest fanatic)",
    "grade": 4,
    "xp": 100,
    "page": 431,
    "note": ""
   },
   {
    "category": "Acquire",
    "name": "Recover many obscure artifacts lost for millennia; hijack several well-armed transports; steal an intensely defended object (owner interest fanatic)",
    "grade": 5,
    "xp": 125,
    "page": 431,
    "note": ""
   },
   {
    "category": "Capture",
    "name": "Arrest an unarmed but elusive minor criminal; abduct a civilian authority backing the enemy",
    "grade": 1,
    "xp": 25,
    "page": 432,
    "note": ""
   },
   {
    "category": "Capture",
    "name": "Arrest an armed minor criminal; abduct a trained non-military authority backing the enemy",
    "grade": 2,
    "xp": 50,
    "page": 432,
    "note": ""
   },
   {
    "category": "Capture",
    "name": "Arrest an armed felon; abduct a trained military authority backing the enemy",
    "grade": 3,
    "xp": 75,
    "page": 432,
    "note": ""
   },
   {
    "category": "Capture",
    "name": "Arrest several armed felons; abduct a trained military combatant backing the enemy",
    "grade": 4,
    "xp": 100,
    "page": 432,
    "note": ""
   },
   {
    "category": "Capture",
    "name": "Arrest a criminal mastermind; abduct several trained military combatants backing the enemy",
    "grade": 5,
    "xp": 125,
    "page": 432,
    "note": ""
   },
   {
    "category": "Confirm",
    "name": "Verify one defined piece of information, or the motives of one unwitting character",
    "grade": 1,
    "xp": 25,
    "page": 432,
    "note": ""
   },
   {
    "category": "Confirm",
    "name": "Verify several obviously linked, defined pieces of information, or motives of several obviously linked unwitting characters",
    "grade": 2,
    "xp": 50,
    "page": 432,
    "note": ""
   },
   {
    "category": "Confirm",
    "name": "Verify several seemingly linked, poorly researched pieces of information, or motives of several seemingly linked unwitting characters",
    "grade": 3,
    "xp": 75,
    "page": 432,
    "note": ""
   },
   {
    "category": "Confirm",
    "name": "Verify several seemingly unlinked, poorly researched pieces of information, or motives of several seemingly unlinked unwitting characters",
    "grade": 4,
    "xp": 100,
    "page": 432,
    "note": ""
   },
   {
    "category": "Confirm",
    "name": "Verify several seemingly unlinked, unresearched pieces of information, or motives of several seemingly unlinked characters who know they are being evaluated",
    "grade": 5,
    "xp": 125,
    "page": 432,
    "note": ""
   },
   {
    "category": "Contain",
    "name": "Contain 1 minor secret in a small group; cover up a minor botch in a sparsely populated area",
    "grade": 1,
    "xp": 25,
    "page": 432,
    "note": ""
   },
   {
    "category": "Contain",
    "name": "Contain several minor secrets in a small group; cover up a minor botch in a well-populated area",
    "grade": 2,
    "xp": 50,
    "page": 432,
    "note": ""
   },
   {
    "category": "Contain",
    "name": "Contain several minor secrets in a large group; cover up a moderate botch in a well-populated area",
    "grade": 3,
    "xp": 75,
    "page": 432,
    "note": ""
   },
   {
    "category": "Contain",
    "name": "Contain several moderate secrets in a large group; cover up a major botch in a well-populated area",
    "grade": 4,
    "xp": 100,
    "page": 432,
    "note": ""
   },
   {
    "category": "Contain",
    "name": "Contain one or more major secrets in a large group; cover up a publicized major botch",
    "grade": 5,
    "xp": 125,
    "page": 432,
    "note": ""
   },
   {
    "category": "Defend",
    "name": "Defend 1 easily protected location or 1 attentive NPC vs. enemies with lower than recommended statistics",
    "grade": 1,
    "xp": 25,
    "page": 432,
    "note": ""
   },
   {
    "category": "Defend",
    "name": "Defend 1 hard-to-protect location or 1 inattentive NPC vs. enemies with lower than recommended statistics",
    "grade": 2,
    "xp": 50,
    "page": 432,
    "note": ""
   },
   {
    "category": "Defend",
    "name": "Defend 1 hard-to-protect location or 1 inattentive NPC vs. enemies with recommended statistics",
    "grade": 3,
    "xp": 75,
    "page": 432,
    "note": ""
   },
   {
    "category": "Defend",
    "name": "Defend 1 easily protected location or 1 attentive NPC vs. enemies with higher than recommended statistics",
    "grade": 4,
    "xp": 100,
    "page": 432,
    "note": ""
   },
   {
    "category": "Defend",
    "name": "Defend 1 hard-to-protect location or 1 inattentive NPC vs. enemies with higher than recommended statistics",
    "grade": 5,
    "xp": 125,
    "page": 432,
    "note": ""
   },
   {
    "category": "Destroy",
    "name": "Destroy an undefended civilian location, or sabotage an undefended civilian vehicle or gear item",
    "grade": 1,
    "xp": 25,
    "page": 432,
    "note": ""
   },
   {
    "category": "Destroy",
    "name": "Destroy a poorly defended civilian location, or sabotage a poorly defended civilian vehicle or gear item",
    "grade": 2,
    "xp": 50,
    "page": 432,
    "note": ""
   },
   {
    "category": "Destroy",
    "name": "Destroy a well-defended civilian location, or sabotage a well-defended civilian vehicle or gear item",
    "grade": 3,
    "xp": 75,
    "page": 432,
    "note": ""
   },
   {
    "category": "Destroy",
    "name": "Destroy a well-defended military location, or sabotage a well-defended military vehicle or gear item",
    "grade": 4,
    "xp": 100,
    "page": 432,
    "note": ""
   },
   {
    "category": "Destroy",
    "name": "Destroy a well-defended villain location, or sabotage a well-defended villain vehicle or gear item",
    "grade": 5,
    "xp": 125,
    "page": 432,
    "note": ""
   },
   {
    "category": "Distract",
    "name": "Keep 1 person from noticing a quiet incident",
    "grade": 1,
    "xp": 25,
    "page": 432,
    "note": ""
   },
   {
    "category": "Distract",
    "name": "Keep 1 person from noticing a noisy incident",
    "grade": 2,
    "xp": 50,
    "page": 432,
    "note": ""
   },
   {
    "category": "Distract",
    "name": "Keep several people from noticing a quiet incident",
    "grade": 3,
    "xp": 75,
    "page": 432,
    "note": ""
   },
   {
    "category": "Distract",
    "name": "Keep several people from noticing a noisy incident",
    "grade": 4,
    "xp": 100,
    "page": 432,
    "note": ""
   },
   {
    "category": "Distract",
    "name": "Keep everyone from noticing an obvious incident",
    "grade": 5,
    "xp": 125,
    "page": 432,
    "note": ""
   },
   {
    "category": "Evade",
    "name": "Escape or avoid capture by an inferior force in familiar territory",
    "grade": 1,
    "xp": 25,
    "page": 432,
    "note": ""
   },
   {
    "category": "Evade",
    "name": "Escape or avoid capture by an inferior force in unfamiliar territory",
    "grade": 2,
    "xp": 50,
    "page": 432,
    "note": ""
   },
   {
    "category": "Evade",
    "name": "Escape or avoid capture by an equal force in unfamiliar territory",
    "grade": 3,
    "xp": 75,
    "page": 432,
    "note": ""
   },
   {
    "category": "Evade",
    "name": "Escape or avoid capture by a superior force in unfamiliar territory",
    "grade": 4,
    "xp": 100,
    "page": 432,
    "note": ""
   },
   {
    "category": "Evade",
    "name": "Escape or avoid capture by a superior force in enemy territory",
    "grade": 5,
    "xp": 125,
    "page": 432,
    "note": ""
   },
   {
    "category": "Infiltrate",
    "name": "Infiltrate an undefended civilian location",
    "grade": 1,
    "xp": 25,
    "page": 432,
    "note": ""
   },
   {
    "category": "Infiltrate",
    "name": "Infiltrate a poorly defended civilian location",
    "grade": 2,
    "xp": 50,
    "page": 432,
    "note": ""
   },
   {
    "category": "Infiltrate",
    "name": "Infiltrate a well-defended civilian location",
    "grade": 3,
    "xp": 75,
    "page": 432,
    "note": ""
   },
   {
    "category": "Infiltrate",
    "name": "Infiltrate a well-defended military location",
    "grade": 4,
    "xp": 100,
    "page": 432,
    "note": ""
   },
   {
    "category": "Infiltrate",
    "name": "Infiltrate a well-defended villain location",
    "grade": 5,
    "xp": 125,
    "page": 432,
    "note": ""
   },
   {
    "category": "Investigate",
    "name": "1 clue, minor research, or a minutes-long search or scouting mission",
    "grade": 1,
    "xp": 25,
    "page": 432,
    "note": ""
   },
   {
    "category": "Investigate",
    "name": "2-4 clues, 1 simple puzzle, moderate research, or an hour-long search or scouting mission",
    "grade": 2,
    "xp": 50,
    "page": 432,
    "note": ""
   },
   {
    "category": "Investigate",
    "name": "5-6 clues, 1 tricky puzzle, extensive research, or an hours-long search or scouting mission",
    "grade": 3,
    "xp": 75,
    "page": 432,
    "note": ""
   },
   {
    "category": "Investigate",
    "name": "7-9 clues, 1 complicated puzzle, exhaustive research, or a day-long search or scouting mission",
    "grade": 4,
    "xp": 100,
    "page": 432,
    "note": ""
   },
   {
    "category": "Investigate",
    "name": "10 clues, 1 nearly impossible puzzle, impeccable research, or a days-long search or scouting mission",
    "grade": 5,
    "xp": 125,
    "page": 432,
    "note": ""
   },
   {
    "category": "Neutralize",
    "name": "Liquidate or force-retire a civilian authority",
    "grade": 1,
    "xp": 25,
    "page": 433,
    "note": ""
   },
   {
    "category": "Neutralize",
    "name": "Liquidate or force-retire a trained non-military authority or several civilian authorities",
    "grade": 2,
    "xp": 50,
    "page": 433,
    "note": ""
   },
   {
    "category": "Neutralize",
    "name": "Liquidate or force-retire a trained military authority or several trained non-military authorities",
    "grade": 3,
    "xp": 75,
    "page": 433,
    "note": ""
   },
   {
    "category": "Neutralize",
    "name": "Liquidate or force-retire a trained military combatant or several trained military authorities",
    "grade": 4,
    "xp": 100,
    "page": 433,
    "note": ""
   },
   {
    "category": "Neutralize",
    "name": "Liquidate or force-retire several trained military combatants",
    "grade": 5,
    "xp": 125,
    "page": 433,
    "note": ""
   },
   {
    "category": "Observe",
    "name": "Detect 1 activity at a busy/easy-to-navigate location with heavy concealment",
    "grade": 1,
    "xp": 25,
    "page": 433,
    "note": ""
   },
   {
    "category": "Observe",
    "name": "Detect 1 activity at a quiet/hard-to-navigate location with moderate concealment; or 2+ activities at a busy/easy location with heavy concealment",
    "grade": 2,
    "xp": 50,
    "page": 433,
    "note": ""
   },
   {
    "category": "Observe",
    "name": "Detect 1 activity at a silent/near-impossible location with little or no concealment; or 2+ activities at a quiet/hard location with moderate concealment",
    "grade": 3,
    "xp": 75,
    "page": 433,
    "note": ""
   },
   {
    "category": "Observe",
    "name": "Detect 1 activity while evading enemy surveillance or guards; or 2+ activities at a silent/near-impossible location with little or no concealment",
    "grade": 4,
    "xp": 100,
    "page": 433,
    "note": ""
   },
   {
    "category": "Observe",
    "name": "Detect 2+ activities while evading enemy surveillance or guards",
    "grade": 5,
    "xp": 125,
    "page": 433,
    "note": ""
   },
   {
    "category": "Recruit",
    "name": "Convince an uninvolved, reticent NPC to join a cause with no obvious risk",
    "grade": 1,
    "xp": 25,
    "page": 433,
    "note": ""
   },
   {
    "category": "Recruit",
    "name": "Convince an uninvolved, opposed NPC to join a cause with no obvious risk",
    "grade": 2,
    "xp": 50,
    "page": 433,
    "note": ""
   },
   {
    "category": "Recruit",
    "name": "Convince an uninvolved NPC to join a cause with minor risk; or an enemy to betray weak masters",
    "grade": 3,
    "xp": 75,
    "page": 433,
    "note": ""
   },
   {
    "category": "Recruit",
    "name": "Convince an uninvolved NPC to join a cause with moderate risk; or an enemy to betray strong masters",
    "grade": 4,
    "xp": 100,
    "page": 433,
    "note": ""
   },
   {
    "category": "Recruit",
    "name": "Convince an uninvolved NPC to join a cause with major risk; or an enemy to betray fearsome masters",
    "grade": 5,
    "xp": 125,
    "page": 433,
    "note": ""
   },
   {
    "category": "Repair",
    "name": "Fix a simple object with a short time frame or under enemy fire",
    "grade": 1,
    "xp": 25,
    "page": 433,
    "note": ""
   },
   {
    "category": "Repair",
    "name": "Fix a simple object with a short time frame and under enemy fire",
    "grade": 2,
    "xp": 50,
    "page": 433,
    "note": ""
   },
   {
    "category": "Repair",
    "name": "Fix a complex object with a short time frame or under enemy fire",
    "grade": 3,
    "xp": 75,
    "page": 433,
    "note": ""
   },
   {
    "category": "Repair",
    "name": "Fix a complex object with a short time frame and under enemy fire",
    "grade": 4,
    "xp": 100,
    "page": 433,
    "note": ""
   },
   {
    "category": "Repair",
    "name": "Fix several complex objects with a short time frame and under threatening enemy fire",
    "grade": 5,
    "xp": 125,
    "page": 433,
    "note": ""
   },
   {
    "category": "Rescue",
    "name": "Rescue 1 uninjured character or salvage 1 undamaged vehicle/item from minor environmental danger or enemies with lower than recommended statistics",
    "grade": 1,
    "xp": 25,
    "page": 433,
    "note": ""
   },
   {
    "category": "Rescue",
    "name": "Rescue 1 slightly injured character or salvage 1 slightly damaged vehicle/item from minor environmental danger or enemies with lower than recommended statistics",
    "grade": 2,
    "xp": 50,
    "page": 433,
    "note": ""
   },
   {
    "category": "Rescue",
    "name": "Rescue 1 moderately injured character or salvage 1 moderately damaged vehicle/item from moderate environmental danger or enemies with recommended statistics",
    "grade": 3,
    "xp": 75,
    "page": 433,
    "note": ""
   },
   {
    "category": "Rescue",
    "name": "Rescue 1 moderately injured character or salvage 1 moderately damaged vehicle/item from moderate environmental danger or enemies with higher than recommended statistics",
    "grade": 4,
    "xp": 100,
    "page": 433,
    "note": ""
   },
   {
    "category": "Rescue",
    "name": "Rescue 1 severely injured character or salvage 1 highly damaged vehicle/item from major environmental danger or enemies with higher than recommended statistics",
    "grade": 5,
    "xp": 125,
    "page": 433,
    "note": ""
   },
   {
    "category": "Sting",
    "name": "Execute a thorough pre-planned operation targeting 1 mark",
    "grade": 1,
    "xp": 25,
    "page": 433,
    "note": ""
   },
   {
    "category": "Sting",
    "name": "Execute a shaky pre-planned operation targeting 1 mark; or concoct and execute an original plan targeting 1 mark",
    "grade": 2,
    "xp": 50,
    "page": 433,
    "note": ""
   },
   {
    "category": "Sting",
    "name": "Execute a crazy pre-planned operation targeting 1 mark; or concoct and execute an original plan targeting 2+ marks",
    "grade": 3,
    "xp": 75,
    "page": 433,
    "note": ""
   },
   {
    "category": "Sting",
    "name": "Concoct and execute an original plan targeting 2+ marks in short time or with few resources",
    "grade": 4,
    "xp": 100,
    "page": 433,
    "note": ""
   },
   {
    "category": "Sting",
    "name": "Concoct and execute an original plan targeting 2+ marks in short time and with few resources",
    "grade": 5,
    "xp": 125,
    "page": 433,
    "note": ""
   },
   {
    "category": "Test",
    "name": "Intentionally test gear with unexpected but non-threatening side effects",
    "grade": 1,
    "xp": 25,
    "page": 433,
    "note": ""
   },
   {
    "category": "Test",
    "name": "Intentionally test gear with side effects that threaten the user",
    "grade": 2,
    "xp": 50,
    "page": 433,
    "note": ""
   },
   {
    "category": "Test",
    "name": "Intentionally test gear with side effects that threaten the whole team; or unwittingly test gear with unexpected but non-threatening side effects",
    "grade": 3,
    "xp": 75,
    "page": 433,
    "note": ""
   },
   {
    "category": "Test",
    "name": "Unwittingly test gear with side effects that threaten the user",
    "grade": 4,
    "xp": 100,
    "page": 433,
    "note": ""
   },
   {
    "category": "Test",
    "name": "Unwittingly test gear with side effects that threaten the whole team",
    "grade": 5,
    "xp": 125,
    "page": 433,
    "note": ""
   },
   {
    "category": "Transport",
    "name": "Publicly move an easily carried item/information a short distance with little danger",
    "grade": 1,
    "xp": 25,
    "page": 433,
    "note": ""
   },
   {
    "category": "Transport",
    "name": "Publicly move an easily carried item/information a moderate distance with mild danger; or secretly a short distance with little danger",
    "grade": 2,
    "xp": 50,
    "page": 433,
    "note": ""
   },
   {
    "category": "Transport",
    "name": "Publicly move a difficult-to-carry item/information a moderate distance with mild danger; or secretly move an easily carried one a moderate distance with mild danger",
    "grade": 3,
    "xp": 75,
    "page": 433,
    "note": ""
   },
   {
    "category": "Transport",
    "name": "Publicly move an easily carried item/information a great distance with substantial danger; or secretly move a difficult-to-carry one a moderate distance with mild danger",
    "grade": 4,
    "xp": 100,
    "page": 433,
    "note": ""
   },
   {
    "category": "Transport",
    "name": "Publicly move a difficult-to-carry item/information a great distance with substantial danger; or secretly move any item/information a great distance with substantial danger",
    "grade": 5,
    "xp": 125,
    "page": 433,
    "note": ""
   }
  ],
  "exposure": [
   {
    "id": "adhere-to-honor-code",
    "objective": "Adhere to Honor Code",
    "page": 436,
    "xp": 0,
    "xpPrinted": "+0",
    "note": "Footnoted as recommended for all missions in all games.",
    "infractions": [
     {
      "name": "Character steals from any bystander",
      "reputation": -2,
      "netWorth": -100000
     },
     {
      "name": "Character intentionally allows bystanders or responsibilities to be harmed/damaged, captured, or killed/destroyed",
      "reputation": -4,
      "netWorth": -200000
     },
     {
      "name": "Character intentionally harms/damages bystanders or responsibilities",
      "reputation": -6,
      "netWorth": -300000
     },
     {
      "name": "Character intentionally allows someone to use brutal force (e.g. mutilation, torture)",
      "reputation": -8,
      "netWorth": -400000
     },
     {
      "name": "Character intentionally kills/destroys bystanders or responsibilities",
      "reputation": -10,
      "netWorth": -500000
     },
     {
      "name": "Character intentionally uses brutal force for any reason",
      "reputation": -10,
      "netWorth": -500000
     }
    ]
   },
   {
    "id": "avoid-incidents",
    "objective": "Avoid \"Incidents\"",
    "page": 436,
    "xp": 25,
    "xpPrinted": "+25",
    "note": "",
    "infractions": [
     {
      "name": "Character responsible for isolated incident (e.g. public brawl, rumors on a sensitive topic)",
      "reputation": -1,
      "netWorth": -50000
     },
     {
      "name": "Character responsible for localized incident (e.g. wanted (1 action die), gang battle, college newspaper story)",
      "reputation": -2,
      "netWorth": -100000
     },
     {
      "name": "Character responsible for citywide incident (e.g. wanted (2 action dice), gang war, city newspaper story)",
      "reputation": -4,
      "netWorth": -200000
     },
     {
      "name": "Character responsible for national incident (e.g. wanted (3 action dice), military battle, national newspaper story)",
      "reputation": -6,
      "netWorth": -300000
     },
     {
      "name": "Character responsible for international incident (e.g. wanted (4 action dice), military war, international newspaper story)",
      "reputation": -8,
      "netWorth": -400000
     }
    ]
   },
   {
    "id": "avoid-noise",
    "objective": "Avoid \"Noise\"",
    "page": 436,
    "xp": 50,
    "xpPrinted": "+50",
    "note": "",
    "infractions": [
     {
      "name": "Suspicious activity noticed by up to 10 people",
      "reputation": -1,
      "netWorth": -50000
     },
     {
      "name": "Suspicious activity noticed by 11–100 people",
      "reputation": -2,
      "netWorth": -100000
     },
     {
      "name": "Suspicious activity noticed by 100–500 people",
      "reputation": -3,
      "netWorth": -150000
     },
     {
      "name": "Suspicious activity noticed by 501–1,000 people",
      "reputation": -4,
      "netWorth": -200000
     },
     {
      "name": "Suspicious activity noticed by 1,001+ people",
      "reputation": -6,
      "netWorth": -300000
     },
     {
      "name": "Suspicious activity recorded by civilian",
      "reputation": -2,
      "netWorth": -100000
     },
     {
      "name": "Suspicious activity recorded by college or city news agency",
      "reputation": -4,
      "netWorth": -200000
     },
     {
      "name": "Suspicious activity recorded by national or international news agency",
      "reputation": -6,
      "netWorth": -300000
     },
     {
      "name": "Character draws a Small or smaller weapon in public",
      "reputation": -1,
      "netWorth": -50000
     },
     {
      "name": "Character draws a Medium or smaller weapon in public",
      "reputation": -2,
      "netWorth": -100000
     },
     {
      "name": "Character draws a Large or bigger weapon in public",
      "reputation": -4,
      "netWorth": -200000
     },
     {
      "name": "Character attacks with a 1-handed melee weapon in public's visual or hearing range",
      "reputation": 0,
      "netWorth": 0
     },
     {
      "name": "Character attacks with a 2-handed melee weapon, or any ranged weapon, in public's visual or hearing range",
      "reputation": -4,
      "netWorth": -200000
     },
     {
      "name": "Character attacks with an explosive or tactical weapon in public's visual or hearing range",
      "reputation": -8,
      "netWorth": -400000
     },
     {
      "name": "Character breaks or destroys public vehicle or item of up to Large size",
      "reputation": -4,
      "netWorth": -200000
     },
     {
      "name": "Character breaks or destroys public building or item of Huge or bigger size",
      "reputation": -8,
      "netWorth": -400000
     }
    ]
   },
   {
    "id": "complete-critical-objective-complication",
    "objective": "Complete Critical Objective (Complication)",
    "page": 436,
    "xp": 25,
    "xpPrinted": "+25 per add. objective",
    "note": "XP is +25 per critical objective beyond the first; the first is free, and a mission with none loses 50 XP (p.435).",
    "infractions": [
     {
      "name": "Character fails to complete Grade I mission objective",
      "reputation": -1,
      "netWorth": -50000
     },
     {
      "name": "Character fails to complete Grade II mission objective",
      "reputation": -2,
      "netWorth": -100000
     },
     {
      "name": "Character fails to complete Grade III mission objective",
      "reputation": -3,
      "netWorth": -100000
     },
     {
      "name": "Character fails to complete Grade IV mission objective",
      "reputation": -4,
      "netWorth": -200000
     },
     {
      "name": "Character fails to complete Grade V mission objective",
      "reputation": -5,
      "netWorth": -250000
     }
    ]
   },
   {
    "id": "cooperation-with-others",
    "objective": "Cooperation With Others",
    "page": 436,
    "xp": 0,
    "xpPrinted": "+0",
    "note": "Footnoted as recommended for all missions in all games.",
    "infractions": [
     {
      "name": "Character betrays assigned teammate",
      "reputation": -2,
      "netWorth": -100000
     },
     {
      "name": "Character attacks assigned teammate",
      "reputation": -4,
      "netWorth": -200000
     },
     {
      "name": "Character refuses assignment from Faction or Freelance network",
      "reputation": -5,
      "netWorth": -250000
     },
     {
      "name": "Character betrays Faction or Freelance network",
      "reputation": -10,
      "netWorth": -500000
     },
     {
      "name": "Character attacks Faction or Freelance network",
      "reputation": -15,
      "netWorth": -750000
     }
    ]
   },
   {
    "id": "maintain-anonymity",
    "objective": "Maintain Anonymity",
    "page": 436,
    "xp": 25,
    "xpPrinted": "+25",
    "note": "Infraction list continues on p.437.",
    "infractions": [
     {
      "name": "Character identified by up to 10 people",
      "reputation": -2,
      "netWorth": -100000
     },
     {
      "name": "Character identified by 11–100 people",
      "reputation": -4,
      "netWorth": -200000
     },
     {
      "name": "Character identified by 100–500 people",
      "reputation": -6,
      "netWorth": -300000
     },
     {
      "name": "Character identified by 501–1,000 people",
      "reputation": -8,
      "netWorth": -400000
     },
     {
      "name": "Character identified by 1,001+ people",
      "reputation": -10,
      "netWorth": -500000
     },
     {
      "name": "Character identified by enemy operative",
      "reputation": -12,
      "netWorth": -600000
     },
     {
      "name": "Character identified by enemy organization or nation",
      "reputation": -15,
      "netWorth": -750000,
      "page": 437
     },
     {
      "name": "Character linked to suspicious activity",
      "reputation": -4,
      "netWorth": -200000,
      "page": 437
     },
     {
      "name": "Character linked to criminal activity",
      "reputation": -8,
      "netWorth": -400000,
      "page": 437
     },
     {
      "name": "Character responsible for teammate being identified",
      "reputation": -2,
      "netWorth": -100000,
      "page": 437
     },
     {
      "name": "Character responsible for teammate being linked to suspicious activity",
      "reputation": -4,
      "netWorth": -200000,
      "page": 437
     },
     {
      "name": "Character responsible for teammate being linked to criminal activity",
      "reputation": -6,
      "netWorth": -300000,
      "page": 437
     },
     {
      "name": "Character responsible for Faction or Freelance network being identified",
      "reputation": -5,
      "netWorth": -250000,
      "page": 437
     },
     {
      "name": "Character responsible for organization being linked to suspicious activity",
      "reputation": -10,
      "netWorth": -500000,
      "page": 437
     },
     {
      "name": "Character responsible for organization being linked to criminal activity",
      "reputation": -15,
      "netWorth": -750000,
      "page": 437
     },
     {
      "name": "Character allows prototype or unique item to fall into enemy hands",
      "reputation": -5,
      "netWorth": -250000,
      "page": 437
     },
     {
      "name": "Character leaves minor evidence of presence (e.g. issued shell casings; rental under cover identity with Power Rating +1 to +4)",
      "reputation": -2,
      "netWorth": -100000,
      "page": 437
     },
     {
      "name": "Character leaves moderate evidence of presence (e.g. issued weapon; rental under cover identity with Power Rating +5 to +8)",
      "reputation": -4,
      "netWorth": -200000,
      "page": 437
     },
     {
      "name": "Character leaves major evidence of presence (e.g. issued vehicle; rental without cover identity)",
      "reputation": -8,
      "netWorth": -400000,
      "page": 437
     },
     {
      "name": "Character incarcerated for minor crime",
      "reputation": -10,
      "netWorth": -500000,
      "page": 437
     },
     {
      "name": "Character incarcerated for felony",
      "reputation": -15,
      "netWorth": -750000,
      "page": 437
     }
    ]
   }
  ],
  "gearRestrictions": [
   {
    "id": "minus-1-gear-pick-players-choice",
    "name": "-1 gear pick (player’s choice)",
    "xp": 25,
    "page": 437,
    "summary": "Each character loses 1 mission gear pick, chosen by the player.",
    "data": {
     "picks": -1,
     "chooser": "player"
    }
   },
   {
    "id": "minus-1-gear-pick-gcs-choice",
    "name": "-1 gear pick (GC’s choice)",
    "xp": 50,
    "page": 437,
    "summary": "Each character loses 1 mission gear pick, chosen by the GC.",
    "data": {
     "picks": -1,
     "chooser": "gc"
    }
   },
   {
    "id": "minus-2-gear-picks-players-choice",
    "name": "-2 gear picks (player’s choice)",
    "xp": 75,
    "page": 437,
    "summary": "Each character loses 2 mission gear picks, chosen by the player.",
    "data": {
     "picks": -2,
     "chooser": "player"
    }
   },
   {
    "id": "minus-2-gear-picks-gcs-choice",
    "name": "-2 gear picks (GC’s choice)",
    "xp": 100,
    "page": 437,
    "summary": "Each character loses 2 mission gear picks, chosen by the GC.",
    "data": {
     "picks": -2,
     "chooser": "gc"
    }
   },
   {
    "id": "minus-3-gear-picks-players-choice",
    "name": "-3 gear picks (player’s choice)",
    "xp": 125,
    "page": 437,
    "summary": "Each character loses 3 mission gear picks, chosen by the player.",
    "data": {
     "picks": -3,
     "chooser": "player"
    }
   },
   {
    "id": "minus-3-gear-picks-gcs-choice",
    "name": "-3 gear picks (GC’s choice)",
    "xp": 150,
    "page": 437,
    "summary": "Each character loses 3 mission gear picks, chosen by the GC.",
    "data": {
     "picks": -3,
     "chooser": "gc"
    }
   },
   {
    "id": "restricted-weapon-options",
    "name": "Restricted weapon options (12 specific weapons available, chosen by GC)",
    "xp": 75,
    "page": 437,
    "summary": "Weapon picks limited to a GC-chosen list of 12 specific weapons.",
    "data": {
     "category": "weapons",
     "allowed": 12
    }
   },
   {
    "id": "restricted-gadget-options",
    "name": "Restricted gadget options (12 specific Mechanisms available, chosen by GC)",
    "xp": 75,
    "page": 437,
    "summary": "Gadget picks limited to a GC-chosen list of 12 specific Mechanisms.",
    "data": {
     "category": "gadgets",
     "allowed": 12
    }
   }
  ],
  "security": [
   {
    "id": "badge-card-strip-reader",
    "name": "Badge/card/strip reader",
    "kind": "lock",
    "page": 438,
    "xp": "PR × 2",
    "detectDC": null,
    "disableDC": null,
    "damageSave": "+(PR)",
    "bypass": "Security/Disable or Falsify/Forgery DC 10 + (PR × 2)",
    "awareness": null,
    "opposedBy": "",
    "attack": null,
    "saveDC": null,
    "damage": "",
    "repeats": false,
    "targetArea": "1 portal or container",
    "openSkill": "Security/Disable or Falsify/Forgery",
    "openDC": "10 + (PR × 2)",
    "breakingOpens": false,
    "summary": "Secures 1 portal or container. Opened with Security/Disable or Falsify/Forgery against DC 10 + (PR × 2); Damage save +(PR). Breaking it does not open the portal, it only blocks further open checks. Forgery route gets a Computers synergy bonus when a computer forges the access item.",
    "raw": {
     "Lock": "Badge/card/strip reader",
     "Target Area*": "1 portal or container",
     "Damage Save Bonus*": "+(PR) †",
     "Open Skill*": "Security/Disable or Falsify/Forgery ††",
     "Open DC*": "10 + (PR × 2)",
     "XP Reward*": "PR × 2"
    }
   },
   {
    "id": "car-door-lock",
    "name": "Car door lock",
    "kind": "lock",
    "page": 438,
    "xp": "PR × 3",
    "detectDC": null,
    "disableDC": null,
    "damageSave": "+(PR × 2)",
    "bypass": "Security/Disable DC 10 + (PR × 2)",
    "awareness": null,
    "opposedBy": "",
    "attack": null,
    "saveDC": null,
    "damage": "",
    "repeats": false,
    "targetArea": "1 portal or container",
    "openSkill": "Security/Disable",
    "openDC": "10 + (PR × 2)",
    "breakingOpens": true,
    "summary": "Secures 1 portal or container. Opened with Security/Disable against DC 10 + (PR × 2); Damage save +(PR × 2).",
    "raw": {
     "Lock": "Car door lock",
     "Target Area*": "1 portal or container",
     "Damage Save Bonus*": "+(PR × 2)",
     "Open Skill*": "Security/Disable",
     "Open DC*": "10 + (PR × 2)",
     "XP Reward*": "PR × 3"
    }
   },
   {
    "id": "combination-lock",
    "name": "Combination lock",
    "kind": "lock",
    "page": 438,
    "xp": "PR × 2",
    "detectDC": null,
    "disableDC": null,
    "damageSave": "+(PR × 2)",
    "bypass": "Security/Disable DC 10 + (PR × 2)",
    "awareness": null,
    "opposedBy": "",
    "attack": null,
    "saveDC": null,
    "damage": "",
    "repeats": false,
    "targetArea": "1 portal or container",
    "openSkill": "Security/Disable",
    "openDC": "10 + (PR × 2)",
    "breakingOpens": true,
    "summary": "Secures 1 portal or container. Opened with Security/Disable against DC 10 + (PR × 2); Damage save +(PR × 2).",
    "raw": {
     "Lock": "Combination lock",
     "Target Area*": "1 portal or container",
     "Damage Save Bonus*": "+(PR × 2)",
     "Open Skill*": "Security/Disable",
     "Open DC*": "10 + (PR × 2)",
     "XP Reward*": "PR × 2"
    }
   },
   {
    "id": "dead-bolt-lock",
    "name": "Dead bolt lock",
    "kind": "lock",
    "page": 438,
    "xp": "PR × 6",
    "detectDC": null,
    "disableDC": null,
    "damageSave": "+(PR × 3)",
    "bypass": "Security/Disable DC 10 + (PR × 3)",
    "awareness": null,
    "opposedBy": "",
    "attack": null,
    "saveDC": null,
    "damage": "",
    "repeats": false,
    "targetArea": "1 portal or container",
    "openSkill": "Security/Disable",
    "openDC": "10 + (PR × 3)",
    "breakingOpens": true,
    "summary": "Secures 1 portal or container. Opened with Security/Disable against DC 10 + (PR × 3); Damage save +(PR × 3).",
    "raw": {
     "Lock": "Dead bolt lock",
     "Target Area*": "1 portal or container",
     "Damage Save Bonus*": "+(PR × 3)",
     "Open Skill*": "Security/Disable",
     "Open DC*": "10 + (PR × 3)",
     "XP Reward*": "PR × 6"
    }
   },
   {
    "id": "door-hinge",
    "name": "Door hinge",
    "kind": "lock",
    "page": 438,
    "xp": "PR × 1",
    "detectDC": null,
    "disableDC": null,
    "damageSave": "+(PR × 2)",
    "bypass": "Security/Disable DC 10 + (PR × 1)",
    "awareness": null,
    "opposedBy": "",
    "attack": null,
    "saveDC": null,
    "damage": "",
    "repeats": false,
    "targetArea": "1 portal or container",
    "openSkill": "Security/Disable",
    "openDC": "10 + (PR × 1)",
    "breakingOpens": true,
    "summary": "Secures 1 portal or container. Opened with Security/Disable against DC 10 + (PR × 1); Damage save +(PR × 2).",
    "raw": {
     "Lock": "Door hinge",
     "Target Area*": "1 portal or container",
     "Damage Save Bonus*": "+(PR × 2)",
     "Open Skill*": "Security/Disable",
     "Open DC*": "10 + (PR × 1)",
     "XP Reward*": "PR × 1"
    }
   },
   {
    "id": "electronic-keypad-lock",
    "name": "Electronic keypad lock",
    "kind": "lock",
    "page": 438,
    "xp": "PR × 2",
    "detectDC": null,
    "disableDC": null,
    "damageSave": "+(PR)",
    "bypass": "Security/Disable DC 10 + (PR × 2)",
    "awareness": null,
    "opposedBy": "",
    "attack": null,
    "saveDC": null,
    "damage": "",
    "repeats": false,
    "targetArea": "1 portal or container",
    "openSkill": "Security/Disable",
    "openDC": "10 + (PR × 2)",
    "breakingOpens": false,
    "summary": "Secures 1 portal or container. Opened with Security/Disable against DC 10 + (PR × 2); Damage save +(PR). Breaking it does not open the portal, it only blocks further open checks.",
    "raw": {
     "Lock": "Electronic keypad lock",
     "Target Area*": "1 portal or container",
     "Damage Save Bonus*": "+(PR) †",
     "Open Skill*": "Security/Disable",
     "Open DC*": "10 + (PR × 2)",
     "XP Reward*": "PR × 2"
    }
   },
   {
    "id": "finger-palm-print-scanner",
    "name": "Finger/palm print scanner",
    "kind": "lock",
    "page": 438,
    "xp": "PR × 4",
    "detectDC": null,
    "disableDC": null,
    "damageSave": "+(PR)",
    "bypass": "Security/Disable or Falsify/Forgery DC 10 + (PR × 3)",
    "awareness": null,
    "opposedBy": "",
    "attack": null,
    "saveDC": null,
    "damage": "",
    "repeats": false,
    "targetArea": "1 portal or container",
    "openSkill": "Security/Disable or Falsify/Forgery",
    "openDC": "10 + (PR × 3)",
    "breakingOpens": false,
    "summary": "Secures 1 portal or container. Opened with Security/Disable or Falsify/Forgery against DC 10 + (PR × 3); Damage save +(PR). Breaking it does not open the portal, it only blocks further open checks. Forgery route gets a Computers synergy bonus when a computer forges the access item.",
    "raw": {
     "Lock": "Finger/palm print scanner",
     "Target Area*": "1 portal or container",
     "Damage Save Bonus*": "+(PR) †",
     "Open Skill*": "Security/Disable or Falsify/Forgery ††",
     "Open DC*": "10 + (PR × 3)",
     "XP Reward*": "PR × 4"
    }
   },
   {
    "id": "maglock",
    "name": "Maglock",
    "kind": "lock",
    "page": 438,
    "xp": "PR × 7",
    "detectDC": null,
    "disableDC": null,
    "damageSave": "+(PR × 3)",
    "bypass": "Security/Disable DC 10 + (PR × 3)",
    "awareness": null,
    "opposedBy": "",
    "attack": null,
    "saveDC": null,
    "damage": "",
    "repeats": false,
    "targetArea": "1 portal or container",
    "openSkill": "Security/Disable",
    "openDC": "10 + (PR × 3)",
    "breakingOpens": true,
    "summary": "Secures 1 portal or container. Opened with Security/Disable against DC 10 + (PR × 3); Damage save +(PR × 3).",
    "raw": {
     "Lock": "Maglock",
     "Target Area*": "1 portal or container",
     "Damage Save Bonus*": "+(PR × 3)",
     "Open Skill*": "Security/Disable",
     "Open DC*": "10 + (PR × 3)",
     "XP Reward*": "PR × 7"
    }
   },
   {
    "id": "padlock",
    "name": "Padlock",
    "kind": "lock",
    "page": 438,
    "xp": "PR × 1",
    "detectDC": null,
    "disableDC": null,
    "damageSave": "+(PR × 2)",
    "bypass": "Security/Disable DC 10 + (PR × 1)",
    "awareness": null,
    "opposedBy": "",
    "attack": null,
    "saveDC": null,
    "damage": "",
    "repeats": false,
    "targetArea": "1 portal or container",
    "openSkill": "Security/Disable",
    "openDC": "10 + (PR × 1)",
    "breakingOpens": true,
    "summary": "Secures 1 portal or container. Opened with Security/Disable against DC 10 + (PR × 1); Damage save +(PR × 2).",
    "raw": {
     "Lock": "Padlock",
     "Target Area*": "1 portal or container",
     "Damage Save Bonus*": "+(PR × 2)",
     "Open Skill*": "Security/Disable",
     "Open DC*": "10 + (PR × 1)",
     "XP Reward*": "PR × 1"
    }
   },
   {
    "id": "puzzle-box",
    "name": "Puzzle box",
    "kind": "lock",
    "page": 438,
    "xp": "PR × 6",
    "detectDC": null,
    "disableDC": null,
    "damageSave": "+(PR × 2)",
    "bypass": "Analysis (Int) DC 10 + (PR × 4)",
    "awareness": null,
    "opposedBy": "",
    "attack": null,
    "saveDC": null,
    "damage": "",
    "repeats": false,
    "targetArea": "1 portal or container",
    "openSkill": "Analysis (Int)",
    "openDC": "10 + (PR × 4)",
    "breakingOpens": true,
    "summary": "Secures 1 portal or container. Opened with Analysis (Int) against DC 10 + (PR × 4); Damage save +(PR × 2).",
    "raw": {
     "Lock": "Puzzle box",
     "Target Area*": "1 portal or container",
     "Damage Save Bonus*": "+(PR × 2)",
     "Open Skill*": "Analysis (Int)",
     "Open DC*": "10 + (PR × 4)",
     "XP Reward*": "PR × 6"
    }
   },
   {
    "id": "retinal-dna-scanner",
    "name": "Retinal/DNA scanner",
    "kind": "lock",
    "page": 438,
    "xp": "PR × 8",
    "detectDC": null,
    "disableDC": null,
    "damageSave": "+(PR)",
    "bypass": "Security/Disable or Falsify/Forgery DC 10 + (PR × 5)",
    "awareness": null,
    "opposedBy": "",
    "attack": null,
    "saveDC": null,
    "damage": "",
    "repeats": false,
    "targetArea": "1 portal or container",
    "openSkill": "Security/Disable or Falsify/Forgery",
    "openDC": "10 + (PR × 5)",
    "breakingOpens": false,
    "summary": "Secures 1 portal or container. Opened with Security/Disable or Falsify/Forgery against DC 10 + (PR × 5); Damage save +(PR). Breaking it does not open the portal, it only blocks further open checks. Forgery route gets a Computers synergy bonus when a computer forges the access item.",
    "raw": {
     "Lock": "Retinal/DNA scanner",
     "Target Area*": "1 portal or container",
     "Damage Save Bonus*": "+(PR) †",
     "Open Skill*": "Security/Disable or Falsify/Forgery ††",
     "Open DC*": "10 + (PR × 5)",
     "XP Reward*": "PR × 8"
    }
   },
   {
    "id": "safe-lock",
    "name": "Safe lock",
    "kind": "lock",
    "page": 438,
    "xp": "PR × 7",
    "detectDC": null,
    "disableDC": null,
    "damageSave": "+(PR × 4)",
    "bypass": "Security/Disable DC 10 + (PR × 3)",
    "awareness": null,
    "opposedBy": "",
    "attack": null,
    "saveDC": null,
    "damage": "",
    "repeats": false,
    "targetArea": "1 portal or container",
    "openSkill": "Security/Disable",
    "openDC": "10 + (PR × 3)",
    "breakingOpens": true,
    "summary": "Secures 1 portal or container. Opened with Security/Disable against DC 10 + (PR × 3); Damage save +(PR × 4).",
    "raw": {
     "Lock": "Safe lock",
     "Target Area*": "1 portal or container",
     "Damage Save Bonus*": "+(PR × 4)",
     "Open Skill*": "Security/Disable",
     "Open DC*": "10 + (PR × 3)",
     "XP Reward*": "PR × 7"
    }
   },
   {
    "id": "signature-analyzer",
    "name": "Signature analyzer",
    "kind": "lock",
    "page": 438,
    "xp": "PR × 6",
    "detectDC": null,
    "disableDC": null,
    "damageSave": "+(PR)",
    "bypass": "Security/Disable or Falsify/Forgery DC 10 + (PR × 3)",
    "awareness": null,
    "opposedBy": "",
    "attack": null,
    "saveDC": null,
    "damage": "",
    "repeats": false,
    "targetArea": "1 portal or container",
    "openSkill": "Security/Disable or Falsify/Forgery",
    "openDC": "10 + (PR × 3)",
    "breakingOpens": false,
    "summary": "Secures 1 portal or container. Opened with Security/Disable or Falsify/Forgery against DC 10 + (PR × 3); Damage save +(PR). Breaking it does not open the portal, it only blocks further open checks. Forgery route gets a Computers synergy bonus when a computer forges the access item.",
    "raw": {
     "Lock": "Signature analyzer",
     "Target Area*": "1 portal or container",
     "Damage Save Bonus*": "+(PR) †",
     "Open Skill*": "Security/Disable or Falsify/Forgery ††",
     "Open DC*": "10 + (PR × 3)",
     "XP Reward*": "PR × 6"
    }
   },
   {
    "id": "tumbler-lock",
    "name": "Tumbler lock",
    "kind": "lock",
    "page": 438,
    "xp": "PR × 3",
    "detectDC": null,
    "disableDC": null,
    "damageSave": "+(PR × 3)",
    "bypass": "Security/Disable DC 10 + (PR × 2)",
    "awareness": null,
    "opposedBy": "",
    "attack": null,
    "saveDC": null,
    "damage": "",
    "repeats": false,
    "targetArea": "1 portal or container",
    "openSkill": "Security/Disable",
    "openDC": "10 + (PR × 2)",
    "breakingOpens": true,
    "summary": "Secures 1 portal or container. Opened with Security/Disable against DC 10 + (PR × 2); Damage save +(PR × 3).",
    "raw": {
     "Lock": "Tumbler lock",
     "Target Area*": "1 portal or container",
     "Damage Save Bonus*": "+(PR × 3)",
     "Open Skill*": "Security/Disable",
     "Open DC*": "10 + (PR × 2)",
     "XP Reward*": "PR × 3"
    }
   },
   {
    "id": "vault-lock",
    "name": "Vault lock",
    "kind": "lock",
    "page": 438,
    "xp": "PR × 10",
    "detectDC": null,
    "disableDC": null,
    "damageSave": "+(PR × 5)",
    "bypass": "Security/Disable DC 10 + (PR × 5)",
    "awareness": null,
    "opposedBy": "",
    "attack": null,
    "saveDC": null,
    "damage": "",
    "repeats": false,
    "targetArea": "1 portal or container",
    "openSkill": "Security/Disable",
    "openDC": "10 + (PR × 5)",
    "breakingOpens": true,
    "summary": "Secures 1 portal or container. Opened with Security/Disable against DC 10 + (PR × 5); Damage save +(PR × 5).",
    "raw": {
     "Lock": "Vault lock",
     "Target Area*": "1 portal or container",
     "Damage Save Bonus*": "+(PR × 5)",
     "Open Skill*": "Security/Disable",
     "Open DC*": "10 + (PR × 5)",
     "XP Reward*": "PR × 10"
    }
   },
   {
    "id": "voice-print-scanner",
    "name": "Voice print scanner",
    "kind": "lock",
    "page": 438,
    "xp": "PR × 6",
    "detectDC": null,
    "disableDC": null,
    "damageSave": "+(PR)",
    "bypass": "Security/Disable or Bluff/Deception DC 10 + (PR × 4)",
    "awareness": null,
    "opposedBy": "",
    "attack": null,
    "saveDC": null,
    "damage": "",
    "repeats": false,
    "targetArea": "1 portal or container",
    "openSkill": "Security/Disable or Bluff/Deception",
    "openDC": "10 + (PR × 4)",
    "breakingOpens": false,
    "summary": "Secures 1 portal or container. Opened with Security/Disable or Bluff/Deception against DC 10 + (PR × 4); Damage save +(PR). Breaking it does not open the portal, it only blocks further open checks.",
    "raw": {
     "Lock": "Voice print scanner",
     "Target Area*": "1 portal or container",
     "Damage Save Bonus*": "+(PR)†",
     "Open Skill*": "Security/Disable or Bluff/Deception",
     "Open DC*": "10 + (PR × 4)",
     "XP Reward*": "PR × 6"
    }
   },
   {
    "id": "chemical-sniffer",
    "name": "Chemical sniffer",
    "kind": "sensor",
    "page": 438,
    "xp": "PR × 8",
    "detectDC": "10 + (PR × 3)",
    "disableDC": "10 + (PR × 3)",
    "damageSave": null,
    "bypass": "",
    "awareness": null,
    "opposedBy": "",
    "attack": null,
    "saveDC": null,
    "damage": "",
    "repeats": false,
    "targetArea": "PR × 5 ft. radius",
    "autoTrigger": true,
    "autoDetected": false,
    "summary": "Covers PR × 5 ft. radius. Trips automatically unless disabled. Detect DC 10 + (PR × 3); Disable DC 10 + (PR × 3).",
    "raw": {
     "Sensor": "Chemical sniffer",
     "Target Area*": "PR × 5 ft. radius",
     "Awareness Bonus*": "None ∆∆",
     "Opposed Skill**": "None ∆∆",
     "Detect DC*∆": "10 + (PR × 3)",
     "Disable DC*": "10 + (PR × 3)",
     "XP Reward*": "PR × 8"
    }
   },
   {
    "id": "circuit-wires-embedded",
    "name": "Circuit wires (embedded)",
    "kind": "sensor",
    "page": 438,
    "xp": "PR × 8",
    "detectDC": "10 + (PR × 2)",
    "disableDC": "10 + (PR × 4)",
    "damageSave": null,
    "bypass": "",
    "awareness": null,
    "opposedBy": "",
    "attack": null,
    "saveDC": null,
    "damage": "",
    "repeats": false,
    "targetArea": "1 window or door",
    "autoTrigger": true,
    "autoDetected": false,
    "summary": "Covers 1 window or door. Trips automatically unless disabled. Detect DC 10 + (PR × 2); Disable DC 10 + (PR × 4).",
    "raw": {
     "Sensor": "Circuit wires (embedded)",
     "Target Area*": "1 window or door",
     "Awareness Bonus*": "None ∆∆",
     "Opposed Skill**": "None ∆∆",
     "Detect DC*∆": "10 + (PR × 2)",
     "Disable DC*": "10 + (PR × 4)",
     "XP Reward*": "PR × 8"
    }
   },
   {
    "id": "contact-plate",
    "name": "Contact plate",
    "kind": "sensor",
    "page": 438,
    "xp": "PR × 4",
    "detectDC": "10 + (PR × 2)",
    "disableDC": "10 + (PR × 2)",
    "damageSave": null,
    "bypass": "",
    "awareness": null,
    "opposedBy": "",
    "attack": null,
    "saveDC": null,
    "damage": "",
    "repeats": false,
    "targetArea": "1 lock",
    "autoTrigger": true,
    "autoDetected": false,
    "summary": "Covers 1 lock. Trips automatically unless disabled. Detect DC 10 + (PR × 2); Disable DC 10 + (PR × 2).",
    "raw": {
     "Sensor": "Contact plate",
     "Target Area*": "1 lock",
     "Awareness Bonus*": "None ∆∆",
     "Opposed Skill**": "None ∆∆",
     "Detect DC*∆": "10 + (PR × 2)",
     "Disable DC*": "10 + (PR × 2)",
     "XP Reward*": "PR × 4"
    }
   },
   {
    "id": "heat-sensor",
    "name": "Heat sensor",
    "kind": "sensor",
    "page": 438,
    "xp": "PR × 10",
    "detectDC": "10 + (PR × 4)",
    "disableDC": "10 + (PR × 3)",
    "damageSave": null,
    "bypass": "",
    "awareness": null,
    "opposedBy": "",
    "attack": null,
    "saveDC": null,
    "damage": "",
    "repeats": false,
    "targetArea": "PR × 5 ft. radius",
    "autoTrigger": true,
    "autoDetected": false,
    "summary": "Covers PR × 5 ft. radius. Trips automatically unless disabled. Detect DC 10 + (PR × 4); Disable DC 10 + (PR × 3).",
    "raw": {
     "Sensor": "Heat sensor",
     "Target Area*": "PR × 5 ft. radius",
     "Awareness Bonus*": "None ∆∆",
     "Opposed Skill**": "None ∆∆",
     "Detect DC*∆": "10 + (PR × 4)",
     "Disable DC*": "10 + (PR × 3)",
     "XP Reward*": "PR × 10"
    }
   },
   {
    "id": "metal-detector",
    "name": "Metal detector",
    "kind": "sensor",
    "page": 438,
    "xp": "PR × 6",
    "detectDC": null,
    "disableDC": "10 + (PR × 3)",
    "damageSave": null,
    "bypass": "",
    "awareness": null,
    "opposedBy": "",
    "attack": null,
    "saveDC": null,
    "damage": "",
    "repeats": false,
    "targetArea": "1 entry point",
    "autoTrigger": true,
    "autoDetected": true,
    "summary": "Covers 1 entry point. Trips automatically unless disabled. Obvious, no check to detect; Disable DC 10 + (PR × 3).",
    "raw": {
     "Sensor": "Metal detector",
     "Target Area*": "1 entry point",
     "Awareness Bonus*": "None ∆∆",
     "Opposed Skill**": "None ∆∆",
     "Detect DC*∆": "None (automatic)",
     "Disable DC*": "10 + (PR × 3)",
     "XP Reward*": "PR × 6"
    }
   },
   {
    "id": "motion-sensor",
    "name": "Motion sensor",
    "kind": "sensor",
    "page": 438,
    "xp": "PR × 8",
    "detectDC": "10 + (PR × 4)",
    "disableDC": "10 + (PR × 3)",
    "damageSave": null,
    "bypass": "",
    "awareness": "+(PR × 2)",
    "opposedBy": "Acrobatics (Dex)",
    "attack": null,
    "saveDC": null,
    "damage": "",
    "repeats": false,
    "targetArea": "PR × 25 ft. cone",
    "autoTrigger": false,
    "autoDetected": false,
    "summary": "Covers PR × 25 ft. cone. Awareness +(PR × 2) opposed by the intruder's Acrobatics (Dex) (Armor Check Penalty applies). Detect DC 10 + (PR × 4); Disable DC 10 + (PR × 3).",
    "raw": {
     "Sensor": "Motion sensor",
     "Target Area*": "PR × 25 ft. cone",
     "Awareness Bonus*": "+(PR × 2)",
     "Opposed Skill**": "Acrobatics (Dex)",
     "Detect DC*∆": "10 + (PR × 4)",
     "Disable DC*": "10 + (PR × 3)",
     "XP Reward*": "PR × 8"
    }
   },
   {
    "id": "noise-sensor",
    "name": "Noise sensor",
    "kind": "sensor",
    "page": 438,
    "xp": "PR × 8",
    "detectDC": "10 + (PR × 4)",
    "disableDC": "10 + (PR × 3)",
    "damageSave": null,
    "bypass": "",
    "awareness": "+(PR × 3)",
    "opposedBy": "Blend (Dex) or Sneak (Dex)",
    "attack": null,
    "saveDC": null,
    "damage": "",
    "repeats": false,
    "targetArea": "PR × 10 ft. radius",
    "autoTrigger": false,
    "autoDetected": false,
    "summary": "Covers PR × 10 ft. radius. Awareness +(PR × 3) opposed by the intruder's Blend (Dex) or Sneak (Dex) (Armor Check Penalty applies). Detect DC 10 + (PR × 4); Disable DC 10 + (PR × 3).",
    "raw": {
     "Sensor": "Noise sensor",
     "Target Area*": "PR × 10 ft. radius",
     "Awareness Bonus*": "+(PR × 3)",
     "Opposed Skill**": "Blend (Dex) or Sneak (Dex)",
     "Detect DC*∆": "10 + (PR × 4)",
     "Disable DC*": "10 + (PR × 3)",
     "XP Reward*": "PR × 8"
    }
   },
   {
    "id": "pressure-plate",
    "name": "Pressure plate",
    "kind": "sensor",
    "page": 438,
    "xp": "PR × 8",
    "detectDC": "10 + (PR × 3)",
    "disableDC": "10 + (PR × 4)",
    "damageSave": null,
    "bypass": "",
    "awareness": null,
    "opposedBy": "",
    "attack": null,
    "saveDC": null,
    "damage": "",
    "repeats": false,
    "targetArea": "(PR) 5-ft. squares",
    "autoTrigger": true,
    "autoDetected": false,
    "summary": "Covers (PR) 5-ft. squares. Trips automatically unless disabled. Detect DC 10 + (PR × 3); Disable DC 10 + (PR × 4).",
    "raw": {
     "Sensor": "Pressure plate",
     "Target Area*": "(PR) 5-ft. squares",
     "Awareness Bonus*": "None ∆∆",
     "Opposed Skill**": "None ∆∆",
     "Detect DC*∆": "10 + (PR × 3)",
     "Disable DC*": "10 + (PR × 4)",
     "XP Reward*": "PR × 8"
    }
   },
   {
    "id": "tripwire",
    "name": "Tripwire",
    "kind": "sensor",
    "page": 438,
    "xp": "PR × 4",
    "detectDC": "10 + (PR × 2)",
    "disableDC": "10 + (PR × 2)",
    "damageSave": null,
    "bypass": "",
    "awareness": null,
    "opposedBy": "Reflex save DC 10 + PR",
    "attack": null,
    "saveDC": null,
    "damage": "",
    "repeats": false,
    "targetArea": "(PR) 5-ft. squares in a line",
    "autoTrigger": false,
    "autoDetected": false,
    "summary": "Covers (PR) 5-ft. squares in a line. Avoided with a Reflex save DC 10 + PR. Detect DC 10 + (PR × 2); Disable DC 10 + (PR × 2).",
    "raw": {
     "Sensor": "Tripwire",
     "Target Area*": "(PR) 5-ft. squares in a line",
     "Awareness Bonus*": "—",
     "Opposed Skill**": "Special ΩΩ",
     "Detect DC*∆": "10 + (PR × 2)",
     "Disable DC*": "10 + (PR × 2)",
     "XP Reward*": "PR × 4"
    }
   },
   {
    "id": "tripwire-laser",
    "name": "Tripwire, laser",
    "kind": "sensor",
    "page": 438,
    "xp": "PR × 6",
    "detectDC": "10 + (PR × 3)",
    "disableDC": "10 + (PR × 3)",
    "damageSave": null,
    "bypass": "",
    "awareness": null,
    "opposedBy": "Reflex save DC 15 + PR",
    "attack": null,
    "saveDC": null,
    "damage": "",
    "repeats": false,
    "targetArea": "(PR × 2) 5-ft. squares in a line",
    "autoTrigger": false,
    "autoDetected": false,
    "summary": "Covers (PR × 2) 5-ft. squares in a line. Avoided with a Reflex save DC 15 + PR. Detect DC 10 + (PR × 3); Disable DC 10 + (PR × 3).",
    "raw": {
     "Sensor": "Tripwire, laser",
     "Target Area*": "(PR × 2) 5-ft. squares in a line",
     "Awareness Bonus*": "—",
     "Opposed Skill**": "Special ΩΩ",
     "Detect DC*∆": "10 + (PR × 3)",
     "Disable DC*": "10 + (PR × 3)",
     "XP Reward*": "PR × 6"
    }
   },
   {
    "id": "vibration-sensor",
    "name": "Vibration sensor",
    "kind": "sensor",
    "page": 438,
    "xp": "PR × 8",
    "detectDC": "10 + (PR × 4)",
    "disableDC": "10 + (PR × 3)",
    "damageSave": null,
    "bypass": "",
    "awareness": "+(PR × 4)",
    "opposedBy": "Blend (Dex) or Sneak (Dex)",
    "attack": null,
    "saveDC": null,
    "damage": "",
    "repeats": false,
    "targetArea": "PR × 5 ft. radius",
    "autoTrigger": false,
    "autoDetected": false,
    "summary": "Covers PR × 5 ft. radius. Awareness +(PR × 4) opposed by the intruder's Blend (Dex) or Sneak (Dex) (Armor Check Penalty applies). Detect DC 10 + (PR × 4); Disable DC 10 + (PR × 3).",
    "raw": {
     "Sensor": "Vibration sensor",
     "Target Area*": "PR × 5 ft. radius",
     "Awareness Bonus*": "+(PR × 4)",
     "Opposed Skill**": "Blend (Dex) or Sneak (Dex)",
     "Detect DC*∆": "10 + (PR × 4)",
     "Disable DC*": "10 + (PR × 3)",
     "XP Reward*": "PR × 8"
    }
   },
   {
    "id": "video-camera",
    "name": "Video camera",
    "kind": "sensor",
    "page": 438,
    "xp": "PR × 6",
    "detectDC": "10 + (PR × 2)",
    "disableDC": "10 + (PR × 3)",
    "damageSave": null,
    "bypass": "",
    "awareness": "+(PR × 2)",
    "opposedBy": "Blend (Dex) or Sneak (Dex)",
    "attack": null,
    "saveDC": null,
    "damage": "",
    "repeats": false,
    "targetArea": "PR × 25 ft. cone",
    "autoTrigger": false,
    "autoDetected": false,
    "summary": "Covers PR × 25 ft. cone. Awareness +(PR × 2) opposed by the intruder's Blend (Dex) or Sneak (Dex) (Armor Check Penalty applies). Detect DC 10 + (PR × 2); Disable DC 10 + (PR × 3). Awareness bonus is for an automated eye; a human watching the feed uses their own bonus.",
    "raw": {
     "Sensor": "Video camera Ω",
     "Target Area*": "PR × 25 ft. cone",
     "Awareness Bonus*": "+(PR × 2)",
     "Opposed Skill**": "Blend (Dex) or Sneak (Dex)",
     "Detect DC*∆": "10 + (PR × 2)",
     "Disable DC*": "10 + (PR × 3)",
     "XP Reward*": "PR × 6"
    }
   },
   {
    "id": "x-ray-checkpoint",
    "name": "X-ray checkpoint",
    "kind": "sensor",
    "page": 438,
    "xp": "PR × 6",
    "detectDC": null,
    "disableDC": "10 + (PR × 3)",
    "damageSave": null,
    "bypass": "",
    "awareness": null,
    "opposedBy": "",
    "attack": null,
    "saveDC": null,
    "damage": "",
    "repeats": false,
    "targetArea": "1 entry point",
    "autoTrigger": true,
    "autoDetected": true,
    "summary": "Covers 1 entry point. Trips automatically unless disabled. Obvious, no check to detect; Disable DC 10 + (PR × 3).",
    "raw": {
     "Sensor": "X-ray checkpoint",
     "Target Area*": "1 entry point",
     "Awareness Bonus*": "None ∆∆",
     "Opposed Skill**": "None ∆∆",
     "Detect DC*∆": "None (automatic)",
     "Disable DC*": "10 + (PR × 3)",
     "XP Reward*": "PR × 6"
    }
   },
   {
    "id": "acid-jet",
    "name": "Acid jet",
    "kind": "trap",
    "page": 438,
    "xp": "PR × 10",
    "detectDC": "10 + (PR × 4)",
    "disableDC": "10 + (PR × 2)",
    "damageSave": null,
    "bypass": "",
    "awareness": null,
    "opposedBy": "",
    "attack": null,
    "saveDC": "10 + PR",
    "damage": "(PR)d6 acid",
    "repeats": false,
    "targetArea": "(PR) ft. (min. 5 ft.)",
    "autoHit": false,
    "delayRounds": null,
    "rangeIncrementFromPR": true,
    "summary": "Area/range: (PR) ft. (min. 5 ft.). Reflex save DC 10 + PR for half damage (rounded down). Damage: (PR)d6 acid. Its PR multiplier is also its range increment; error 1, threat range 1/2 PR (rounded up). Detect DC 10 + (PR × 4); Disable DC 10 + (PR × 2).",
    "raw": {
     "Trap": "Acid jet",
     "Target Area/Range*": "(PR) ft. (min. 5 ft.) ∞∞",
     "Attack Bonus/Save DC*": "DC 10 + PR",
     "Damage*": "(PR)d6 acid",
     "Detect DC*∆": "10 + (PR × 4)",
     "Disable DC*": "10 + (PR × 2)",
     "XP Reward*": "PR × 10"
    }
   },
   {
    "id": "automated-weapon-explosive",
    "name": "Automated weapon, explosive",
    "kind": "trap",
    "page": 438,
    "xp": "PR × 8",
    "detectDC": "10 + (PR × 3)",
    "disableDC": "10 + (PR × 3)",
    "damageSave": null,
    "bypass": "",
    "awareness": null,
    "opposedBy": "",
    "attack": null,
    "saveDC": "per explosive",
    "damage": "Per explosive",
    "repeats": false,
    "targetArea": "Per Blast (see page 343)",
    "autoHit": false,
    "delayRounds": null,
    "rangeIncrementFromPR": false,
    "summary": "Area/range: Per Blast (see page 343). Reflex save DC per explosive for half damage (rounded down). Damage: Per explosive. XP is per die of explosive damage (max +10). Detect DC 10 + (PR × 3); Disable DC 10 + (PR × 3).",
    "raw": {
     "Trap": "Automated weapon, explosive",
     "Target Area/Range*": "Per Blast (see page 343)",
     "Attack Bonus/Save DC*": "DC per explosive",
     "Damage*": "Per explosive",
     "Detect DC*∆": "10 + (PR × 3)",
     "Disable DC*": "10 + (PR × 3)",
     "XP Reward*": "PR × 8 §§"
    }
   },
   {
    "id": "automated-weapon-handgun",
    "name": "Automated weapon, handgun",
    "kind": "trap",
    "page": 438,
    "xp": "PR × 5",
    "detectDC": "10 + (PR × 4)",
    "disableDC": "10 + (PR × 3)",
    "damageSave": null,
    "bypass": "",
    "awareness": null,
    "opposedBy": "",
    "attack": "+(PR × 2)",
    "saveDC": null,
    "damage": "Per weapon",
    "repeats": true,
    "targetArea": "Per weapon",
    "autoHit": false,
    "delayRounds": null,
    "rangeIncrementFromPR": false,
    "summary": "Area/range: Per weapon. Attacks at +(PR × 2) (error 1, threat 20), once per round at 1 target until disabled or out of ammo (PR × 5 shots if ranged). Damage: Per weapon. Detect DC 10 + (PR × 4); Disable DC 10 + (PR × 3).",
    "raw": {
     "Trap": "Automated weapon, handgun",
     "Target Area/Range*": "Per weapon",
     "Attack Bonus/Save DC*": "+(PR × 2) §",
     "Damage*": "Per weapon",
     "Detect DC*∆": "10 + (PR × 4)",
     "Disable DC*": "10 + (PR × 3)",
     "XP Reward*": "PR × 5"
    }
   },
   {
    "id": "automated-weapon-rifle",
    "name": "Automated weapon, rifle",
    "kind": "trap",
    "page": 438,
    "xp": "PR × 8",
    "detectDC": "10 + (PR × 3)",
    "disableDC": "10 + (PR × 3)",
    "damageSave": null,
    "bypass": "",
    "awareness": null,
    "opposedBy": "",
    "attack": "+(PR × 2)",
    "saveDC": null,
    "damage": "Per weapon",
    "repeats": true,
    "targetArea": "Per weapon",
    "autoHit": false,
    "delayRounds": null,
    "rangeIncrementFromPR": false,
    "summary": "Area/range: Per weapon. Attacks at +(PR × 2) (error 1, threat 20), once per round at 1 target until disabled or out of ammo (PR × 5 shots if ranged). Damage: Per weapon. Detect DC 10 + (PR × 3); Disable DC 10 + (PR × 3).",
    "raw": {
     "Trap": "Automated weapon, rifle",
     "Target Area/Range*": "Per weapon",
     "Attack Bonus/Save DC*": "+(PR × 2) §",
     "Damage*": "Per weapon",
     "Detect DC*∆": "10 + (PR × 3)",
     "Disable DC*": "10 + (PR × 3)",
     "XP Reward*": "PR × 8"
    }
   },
   {
    "id": "automated-weapon-tactical",
    "name": "Automated weapon, tactical",
    "kind": "trap",
    "page": 438,
    "xp": "PR × 10",
    "detectDC": "10 + (PR × 2)",
    "disableDC": "10 + (PR × 3)",
    "damageSave": null,
    "bypass": "",
    "awareness": null,
    "opposedBy": "",
    "attack": "+(PR × 2)",
    "saveDC": null,
    "damage": "Per weapon",
    "repeats": true,
    "targetArea": "Per weapon",
    "autoHit": false,
    "delayRounds": null,
    "rangeIncrementFromPR": false,
    "summary": "Area/range: Per weapon. Attacks at +(PR × 2) (error 1, threat 20), once per round at 1 target until disabled or out of ammo (PR × 5 shots if ranged). Damage: Per weapon. Detect DC 10 + (PR × 2); Disable DC 10 + (PR × 3).",
    "raw": {
     "Trap": "Automated weapon, tactical",
     "Target Area/Range*": "Per weapon",
     "Attack Bonus/Save DC*": "+(PR × 2) §",
     "Damage*": "Per weapon",
     "Detect DC*∆": "10 + (PR × 2)",
     "Disable DC*": "10 + (PR × 3)",
     "XP Reward*": "PR × 10"
    }
   },
   {
    "id": "bear-trap",
    "name": "Bear trap",
    "kind": "trap",
    "page": 438,
    "xp": "PR × 6",
    "detectDC": "10 + (PR × 2)",
    "disableDC": "10 + (PR × 2)",
    "damageSave": null,
    "bypass": "",
    "awareness": null,
    "opposedBy": "",
    "attack": null,
    "saveDC": "10 + PR",
    "damage": "(PR)d4 lethal",
    "repeats": false,
    "targetArea": "1 square",
    "autoHit": false,
    "delayRounds": null,
    "rangeIncrementFromPR": false,
    "summary": "Area/range: 1 square. Reflex save DC 10 + PR for half damage (rounded down). Damage: (PR)d4 lethal. Usually set in the wild rather than linked to locks or sensors. Detect DC 10 + (PR × 2); Disable DC 10 + (PR × 2).",
    "raw": {
     "Trap": "Bear trap ◊",
     "Target Area/Range*": "1 square",
     "Attack Bonus/Save DC*": "DC 10 + PR",
     "Damage*": "(PR)d4 lethal",
     "Detect DC*∆": "10 + (PR × 2)",
     "Disable DC*": "10 + (PR × 2)",
     "XP Reward*": "PR × 6"
    }
   },
   {
    "id": "cage-trap",
    "name": "Cage trap",
    "kind": "trap",
    "page": 438,
    "xp": "PR × 4",
    "detectDC": "10 + (PR × 2)",
    "disableDC": "10 + (PR × 2)",
    "damageSave": null,
    "bypass": "",
    "awareness": null,
    "opposedBy": "",
    "attack": null,
    "saveDC": "10 + PR",
    "damage": "",
    "repeats": false,
    "targetArea": "1 square",
    "autoHit": false,
    "delayRounds": null,
    "rangeIncrementFromPR": false,
    "summary": "Area/range: 1 square. Reflex save DC 10 + PR for half damage (rounded down). No damage; victim is caged (cage Damage save PR × 3, Security/Disable DC 10 + (PR × 2)). Usually set in the wild rather than linked to locks or sensors. Detect DC 10 + (PR × 2); Disable DC 10 + (PR × 2).",
    "raw": {
     "Trap": "Cage trap ◊",
     "Target Area/Range*": "1 square",
     "Attack Bonus/Save DC*": "DC 10 + PR",
     "Damage*": "None ◊◊",
     "Detect DC*∆": "10 + (PR × 2)",
     "Disable DC*": "10 + (PR × 2)",
     "XP Reward*": "PR × 4"
    }
   },
   {
    "id": "crushing-wall",
    "name": "Crushing wall",
    "kind": "trap",
    "page": 438,
    "xp": "PR × 4",
    "detectDC": "10 + (PR × 3)",
    "disableDC": "10 + (PR × 2)",
    "damageSave": null,
    "bypass": "",
    "awareness": null,
    "opposedBy": "",
    "attack": null,
    "saveDC": null,
    "damage": "(PR × 2)d6 lethal",
    "repeats": false,
    "targetArea": "Up to (10 + PR) squares",
    "autoHit": true,
    "delayRounds": "1d4+1",
    "rangeIncrementFromPR": false,
    "summary": "Area/range: Up to (10 + PR) squares. Hits automatically. Effect applies after 1d4+1 rounds. Damage: (PR × 2)d6 lethal. Detect DC 10 + (PR × 3); Disable DC 10 + (PR × 2).",
    "raw": {
     "Trap": "Crushing wall",
     "Target Area/Range*": "Up to (10 + PR) squares",
     "Attack Bonus/Save DC*": "Automatic hit ∞",
     "Damage*": "(PR × 2)d6 lethal",
     "Detect DC*∆": "10 + (PR × 3)",
     "Disable DC*": "10 + (PR × 2)",
     "XP Reward*": "PR × 4"
    }
   },
   {
    "id": "crushing-wall-spiked",
    "name": "Crushing wall, spiked",
    "kind": "trap",
    "page": 438,
    "xp": "PR × 4",
    "detectDC": "10 + (PR × 3)",
    "disableDC": "10 + (PR × 2)",
    "damageSave": null,
    "bypass": "",
    "awareness": null,
    "opposedBy": "",
    "attack": null,
    "saveDC": null,
    "damage": "(PR × 2)d8 lethal",
    "repeats": false,
    "targetArea": "Up to (10 + PR) squares",
    "autoHit": true,
    "delayRounds": "1d4+1",
    "rangeIncrementFromPR": false,
    "summary": "Area/range: Up to (10 + PR) squares. Hits automatically. Effect applies after 1d4+1 rounds. Damage: (PR × 2)d8 lethal. Detect DC 10 + (PR × 3); Disable DC 10 + (PR × 2).",
    "raw": {
     "Trap": "Crushing wall, spiked",
     "Target Area/Range*": "Up to (10 + PR) squares",
     "Attack Bonus/Save DC*": "Automatic hit ∞",
     "Damage*": "(PR × 2)d8 lethal",
     "Detect DC*∆": "10 + (PR × 3)",
     "Disable DC*": "10 + (PR × 2)",
     "XP Reward*": "PR × 4"
    }
   },
   {
    "id": "electrified-surface",
    "name": "Electrified surface",
    "kind": "trap",
    "page": 438,
    "xp": "PR × 4",
    "detectDC": "10 + (PR × 3)",
    "disableDC": "10 + (PR × 3)",
    "damageSave": null,
    "bypass": "",
    "awareness": null,
    "opposedBy": "",
    "attack": null,
    "saveDC": null,
    "damage": "(PR)d10 electrical",
    "repeats": false,
    "targetArea": "Up to (10 + PR) squares",
    "autoHit": true,
    "delayRounds": null,
    "rangeIncrementFromPR": false,
    "summary": "Area/range: Up to (10 + PR) squares. Hits automatically. Damage: (PR)d10 electrical. Detect DC 10 + (PR × 3); Disable DC 10 + (PR × 3).",
    "raw": {
     "Trap": "Electrified surface",
     "Target Area/Range*": "Up to (10 + PR) squares",
     "Attack Bonus/Save DC*": "Automatic hit",
     "Damage*": "(PR)d10 electrical",
     "Detect DC*∆": "10 + (PR × 3)",
     "Disable DC*": "10 + (PR × 3)",
     "XP Reward*": "PR × 4"
    }
   },
   {
    "id": "fire-jet",
    "name": "Fire jet",
    "kind": "trap",
    "page": 438,
    "xp": "PR × 10",
    "detectDC": "10 + (PR × 4)",
    "disableDC": "10 + (PR × 2)",
    "damageSave": null,
    "bypass": "",
    "awareness": null,
    "opposedBy": "",
    "attack": null,
    "saveDC": "10 + PR",
    "damage": "(PR)d6 fire",
    "repeats": false,
    "targetArea": "(PR) ft. (min. 5 ft.)",
    "autoHit": false,
    "delayRounds": null,
    "rangeIncrementFromPR": true,
    "summary": "Area/range: (PR) ft. (min. 5 ft.). Reflex save DC 10 + PR for half damage (rounded down). Damage: (PR)d6 fire. Its PR multiplier is also its range increment; error 1, threat range 1/2 PR (rounded up). Detect DC 10 + (PR × 4); Disable DC 10 + (PR × 2).",
    "raw": {
     "Trap": "Fire jet",
     "Target Area/Range*": "(PR) ft. (min. 5 ft.) ∞∞",
     "Attack Bonus/Save DC*": "DC 10 + PR",
     "Damage*": "(PR)d6 fire",
     "Detect DC*∆": "10 + (PR × 4)",
     "Disable DC*": "10 + (PR × 2)",
     "XP Reward*": "PR × 10"
    }
   },
   {
    "id": "flooding-chamber",
    "name": "Flooding chamber",
    "kind": "trap",
    "page": 438,
    "xp": "PR × 4",
    "detectDC": "10 + (PR × 2)",
    "disableDC": "10 + (PR × 2)",
    "damageSave": null,
    "bypass": "",
    "awareness": null,
    "opposedBy": "",
    "attack": null,
    "saveDC": null,
    "damage": "Per drowning",
    "repeats": false,
    "targetArea": "Up to (10 + PR) squares",
    "autoHit": false,
    "delayRounds": "1d4+1",
    "rangeIncrementFromPR": false,
    "summary": "Area/range: Up to (10 + PR) squares. No attack roll or save listed. Effect applies after 1d4+1 rounds. Damage: Per drowning. Detect DC 10 + (PR × 2); Disable DC 10 + (PR × 2).",
    "raw": {
     "Trap": "Flooding chamber",
     "Target Area/Range*": "Up to (10 + PR) squares",
     "Attack Bonus/Save DC*": "None ∞",
     "Damage*": "Per drowning",
     "Detect DC*∆": "10 + (PR × 2)",
     "Disable DC*": "10 + (PR × 2)",
     "XP Reward*": "PR × 4"
    }
   },
   {
    "id": "gas-vent",
    "name": "Gas vent",
    "kind": "trap",
    "page": 438,
    "xp": "PR × 4",
    "detectDC": "10 + (PR × 4)",
    "disableDC": "10 + (PR × 2)",
    "damageSave": null,
    "bypass": "",
    "awareness": null,
    "opposedBy": "",
    "attack": null,
    "saveDC": null,
    "damage": "Per contagion",
    "repeats": false,
    "targetArea": "(PR × 5) ft. radius",
    "autoHit": false,
    "delayRounds": null,
    "rangeIncrementFromPR": false,
    "summary": "Area/range: (PR × 5) ft. radius. No attack roll or save listed. Damage: Per contagion. Detect DC 10 + (PR × 4); Disable DC 10 + (PR × 2).",
    "raw": {
     "Trap": "Gas vent",
     "Target Area/Range*": "(PR × 5) ft. radius",
     "Attack Bonus/Save DC*": "None",
     "Damage*": "Per contagion",
     "Detect DC*∆": "10 + (PR × 4)",
     "Disable DC*": "10 + (PR × 2)",
     "XP Reward*": "PR × 4"
    }
   },
   {
    "id": "hydraulic-buzz-saw",
    "name": "Hydraulic buzz-saw",
    "kind": "trap",
    "page": 438,
    "xp": "PR × 6",
    "detectDC": "10 + (PR × 3)",
    "disableDC": "10 + (PR × 3)",
    "damageSave": null,
    "bypass": "",
    "awareness": null,
    "opposedBy": "",
    "attack": "+(PR × 2)",
    "saveDC": null,
    "damage": "(PR + 2)d6 lethal",
    "repeats": true,
    "targetArea": "Same or adjacent square",
    "autoHit": false,
    "delayRounds": null,
    "rangeIncrementFromPR": false,
    "summary": "Area/range: Same or adjacent square. Attacks at +(PR × 2) (error 1, threat 20), once per round at 1 target until disabled or out of ammo (PR × 5 shots if ranged). Damage: (PR + 2)d6 lethal. Detect DC 10 + (PR × 3); Disable DC 10 + (PR × 3).",
    "raw": {
     "Trap": "Hydraulic buzz-saw",
     "Target Area/Range*": "Same or adjacent square",
     "Attack Bonus/Save DC*": "+(PR × 2) §",
     "Damage*": "(PR + 2)d6 lethal",
     "Detect DC*∆": "10 + (PR × 3)",
     "Disable DC*": "10 + (PR × 3)",
     "XP Reward*": "PR × 6"
    }
   },
   {
    "id": "klaxon",
    "name": "Klaxon",
    "kind": "trap",
    "page": 438,
    "xp": "PR × 6",
    "detectDC": "10 + (PR × 3)",
    "disableDC": "10 + (PR × 2)",
    "damageSave": null,
    "bypass": "",
    "awareness": null,
    "opposedBy": "",
    "attack": null,
    "saveDC": null,
    "damage": "",
    "repeats": false,
    "targetArea": "(PR × 10) ft. radius",
    "autoHit": false,
    "delayRounds": null,
    "rangeIncrementFromPR": false,
    "summary": "Area/range: (PR × 10) ft. radius. No attack roll or save listed. Detect DC 10 + (PR × 3); Disable DC 10 + (PR × 2).",
    "raw": {
     "Trap": "Klaxon",
     "Target Area/Range*": "(PR × 10) ft. radius",
     "Attack Bonus/Save DC*": "None",
     "Damage*": "None",
     "Detect DC*∆": "10 + (PR × 3)",
     "Disable DC*": "10 + (PR × 2)",
     "XP Reward*": "PR × 6"
    }
   },
   {
    "id": "laser-mesh",
    "name": "Laser mesh",
    "kind": "trap",
    "page": 439,
    "xp": "PR × 10",
    "detectDC": "10 + (PR × 3)",
    "disableDC": "10 + (PR × 3)",
    "damageSave": null,
    "bypass": "",
    "awareness": null,
    "opposedBy": "",
    "attack": null,
    "saveDC": "12 + PR",
    "damage": "(PR × 2)d6 laser",
    "repeats": false,
    "targetArea": "Room’s entire height and width (up to PR in squares)",
    "autoHit": false,
    "delayRounds": null,
    "rangeIncrementFromPR": false,
    "summary": "Area/range: Room’s entire height and width (up to PR in squares). Reflex save DC 12 + PR for half damage (rounded down). Damage: (PR × 2)d6 laser. Detect DC 10 + (PR × 3); Disable DC 10 + (PR × 3).",
    "raw": {
     "Trap": "Laser mesh",
     "Target Area/Range*": "Room’s entire height and width (up to PR in squares)",
     "Attack Bonus/Save DC*": "DC 12 + PR",
     "Damage*": "(PR × 2)d6 laser",
     "Detect DC*∆": "10 + (PR × 3)",
     "Disable DC*": "10 + (PR × 3)",
     "XP Reward*": "PR × 10"
    }
   },
   {
    "id": "laser-turret",
    "name": "Laser Turret",
    "kind": "trap",
    "page": 439,
    "xp": "PR × 10",
    "detectDC": "10 + (PR × 3)",
    "disableDC": "10 + (PR × 4)",
    "damageSave": null,
    "bypass": "",
    "awareness": null,
    "opposedBy": "",
    "attack": "+(PR × 2)",
    "saveDC": null,
    "damage": "(PR)d6 laser",
    "repeats": true,
    "targetArea": "(PR × 25) ft.",
    "autoHit": false,
    "delayRounds": null,
    "rangeIncrementFromPR": true,
    "summary": "Area/range: (PR × 25) ft.. Attacks at +(PR × 2) (error 1, threat 20), once per round at 1 target until disabled or out of ammo (PR × 5 shots if ranged). Damage: (PR)d6 laser. Its PR multiplier is also its range increment; error 1, threat range 1/2 PR (rounded up). Detect DC 10 + (PR × 3); Disable DC 10 + (PR × 4).",
    "raw": {
     "Trap": "Laser Turret",
     "Target Area/Range*": "(PR × 25) ft. ∞∞",
     "Attack Bonus/Save DC*": "+(PR × 2) §",
     "Damage*": "(PR)d6 laser",
     "Detect DC*∆": "10 + (PR × 3)",
     "Disable DC*": "10 + (PR × 4)",
     "XP Reward*": "PR × 10"
    }
   },
   {
    "id": "net-gun",
    "name": "Net gun",
    "kind": "trap",
    "page": 439,
    "xp": "PR × 6",
    "detectDC": "10 + (PR × 2)",
    "disableDC": "10 + (PR × 3)",
    "damageSave": null,
    "bypass": "",
    "awareness": null,
    "opposedBy": "",
    "attack": "+(PR × 3)",
    "saveDC": null,
    "damage": "Entangled",
    "repeats": false,
    "targetArea": "(PR × 10) ft.",
    "autoHit": false,
    "delayRounds": null,
    "rangeIncrementFromPR": true,
    "summary": "Area/range: (PR × 10) ft.. Attacks at +(PR × 3) (error 1, threat 20). Damage: Entangled. Its PR multiplier is also its range increment; error 1, threat range 1/2 PR (rounded up). Detect DC 10 + (PR × 2); Disable DC 10 + (PR × 3).",
    "raw": {
     "Trap": "Net gun",
     "Target Area/Range*": "(PR × 10) ft. ∞∞",
     "Attack Bonus/Save DC*": "+(PR × 3)",
     "Damage*": "Entangled",
     "Detect DC*∆": "10 + (PR × 2)",
     "Disable DC*": "10 + (PR × 3)",
     "XP Reward*": "PR × 6"
    }
   },
   {
    "id": "pit",
    "name": "Pit",
    "kind": "trap",
    "page": 439,
    "xp": "PR × 4",
    "detectDC": "10 + (PR × 3)",
    "disableDC": "10 + (PR × 3)",
    "damageSave": null,
    "bypass": "",
    "awareness": null,
    "opposedBy": "",
    "attack": null,
    "saveDC": "12 + PR",
    "damage": "(PR)d6 falling",
    "repeats": false,
    "targetArea": "Up to (PR) squares",
    "autoHit": false,
    "delayRounds": null,
    "rangeIncrementFromPR": false,
    "summary": "Area/range: Up to (PR) squares. Reflex save DC 12 + PR for half damage (rounded down). Damage: (PR)d6 falling. Detect DC 10 + (PR × 3); Disable DC 10 + (PR × 3).",
    "raw": {
     "Trap": "Pit",
     "Target Area/Range*": "Up to (PR) squares",
     "Attack Bonus/Save DC*": "DC 12 + PR",
     "Damage*": "(PR)d6 falling",
     "Detect DC*∆": "10 + (PR × 3)",
     "Disable DC*": "10 + (PR × 3)",
     "XP Reward*": "PR × 4"
    }
   },
   {
    "id": "pit-spiked",
    "name": "Pit, spiked",
    "kind": "trap",
    "page": 439,
    "xp": "PR × 4",
    "detectDC": "10 + (PR × 3)",
    "disableDC": "10 + (PR × 3)",
    "damageSave": null,
    "bypass": "",
    "awareness": null,
    "opposedBy": "",
    "attack": null,
    "saveDC": "12 + PR",
    "damage": "(PR)d8 falling",
    "repeats": false,
    "targetArea": "Up to (PR) squares",
    "autoHit": false,
    "delayRounds": null,
    "rangeIncrementFromPR": false,
    "summary": "Area/range: Up to (PR) squares. Reflex save DC 12 + PR for half damage (rounded down). Damage: (PR)d8 falling. Detect DC 10 + (PR × 3); Disable DC 10 + (PR × 3).",
    "raw": {
     "Trap": "Pit, spiked",
     "Target Area/Range*": "Up to (PR) squares",
     "Attack Bonus/Save DC*": "DC 12 + PR",
     "Damage*": "(PR)d8 falling",
     "Detect DC*∆": "10 + (PR × 3)",
     "Disable DC*": "10 + (PR × 3)",
     "XP Reward*": "PR × 4"
    }
   },
   {
    "id": "poison-dart",
    "name": "Poison dart",
    "kind": "trap",
    "page": 439,
    "xp": "PR × 6",
    "detectDC": "10 + (PR × 3)",
    "disableDC": "10 + (PR × 2)",
    "damageSave": null,
    "bypass": "",
    "awareness": null,
    "opposedBy": "",
    "attack": "+(PR × 2)",
    "saveDC": null,
    "damage": "Per contagion",
    "repeats": true,
    "targetArea": "(PR × 5) ft.",
    "autoHit": false,
    "delayRounds": null,
    "rangeIncrementFromPR": true,
    "summary": "Area/range: (PR × 5) ft.. Attacks at +(PR × 2) (error 1, threat 20), once per round at 1 target until disabled or out of ammo (PR × 5 shots if ranged). Damage: Per contagion. Its PR multiplier is also its range increment; error 1, threat range 1/2 PR (rounded up). Detect DC 10 + (PR × 3); Disable DC 10 + (PR × 2).",
    "raw": {
     "Trap": "Poison dart",
     "Target Area/Range*": "(PR × 5) ft. ∞∞",
     "Attack Bonus/Save DC*": "+(PR × 2) §",
     "Damage*": "Per contagion",
     "Detect DC*∆": "10 + (PR × 3)",
     "Disable DC*": "10 + (PR × 2)",
     "XP Reward*": "PR × 6"
    }
   },
   {
    "id": "spring-loaded-blade",
    "name": "Spring-loaded blade",
    "kind": "trap",
    "page": 439,
    "xp": "PR × 4",
    "detectDC": "10 + (PR × 2)",
    "disableDC": "10 + (PR × 2)",
    "damageSave": null,
    "bypass": "",
    "awareness": null,
    "opposedBy": "",
    "attack": null,
    "saveDC": "12 + PR",
    "damage": "(PR)d8 lethal",
    "repeats": false,
    "targetArea": "1 adjacent square",
    "autoHit": false,
    "delayRounds": null,
    "rangeIncrementFromPR": false,
    "summary": "Area/range: 1 adjacent square. Reflex save DC 12 + PR for half damage (rounded down). Damage: (PR)d8 lethal. Detect DC 10 + (PR × 2); Disable DC 10 + (PR × 2).",
    "raw": {
     "Trap": "Spring-loaded blade",
     "Target Area/Range*": "1 adjacent square",
     "Attack Bonus/Save DC*": "DC 12 + PR",
     "Damage*": "(PR)d8 lethal",
     "Detect DC*∆": "10 + (PR × 2)",
     "Disable DC*": "10 + (PR × 2)",
     "XP Reward*": "PR × 4"
    }
   },
   {
    "id": "spring-loaded-ram",
    "name": "Spring-loaded ram",
    "kind": "trap",
    "page": 439,
    "xp": "PR × 4",
    "detectDC": "10 + (PR × 2)",
    "disableDC": "10 + (PR × 2)",
    "damageSave": null,
    "bypass": "",
    "awareness": null,
    "opposedBy": "",
    "attack": null,
    "saveDC": "12 + PR",
    "damage": "(PR)d8 subdual",
    "repeats": false,
    "targetArea": "1 adjacent square",
    "autoHit": false,
    "delayRounds": null,
    "rangeIncrementFromPR": false,
    "summary": "Area/range: 1 adjacent square. Reflex save DC 12 + PR for half damage (rounded down). Damage: (PR)d8 subdual. Detect DC 10 + (PR × 2); Disable DC 10 + (PR × 2).",
    "raw": {
     "Trap": "Spring-loaded ram",
     "Target Area/Range*": "1 adjacent square",
     "Attack Bonus/Save DC*": "DC 12 + PR",
     "Damage*": "(PR)d8 subdual",
     "Detect DC*∆": "10 + (PR × 2)",
     "Disable DC*": "10 + (PR × 2)",
     "XP Reward*": "PR × 4"
    }
   },
   {
    "id": "steam-jet",
    "name": "Steam jet",
    "kind": "trap",
    "page": 439,
    "xp": "PR × 6",
    "detectDC": "10 + (PR × 4)",
    "disableDC": "10 + (PR × 2)",
    "damageSave": null,
    "bypass": "",
    "awareness": null,
    "opposedBy": "",
    "attack": null,
    "saveDC": "10 + PR",
    "damage": "(PR)d4 heat",
    "repeats": false,
    "targetArea": "Same or adjacent square",
    "autoHit": false,
    "delayRounds": null,
    "rangeIncrementFromPR": false,
    "summary": "Area/range: Same or adjacent square. Reflex save DC 10 + PR for half damage (rounded down). Damage: (PR)d4 heat. Detect DC 10 + (PR × 4); Disable DC 10 + (PR × 2).",
    "raw": {
     "Trap": "Steam jet",
     "Target Area/Range*": "Same or adjacent square",
     "Attack Bonus/Save DC*": "DC 10 + PR",
     "Damage*": "(PR)d4 heat",
     "Detect DC*∆": "10 + (PR × 4)",
     "Disable DC*": "10 + (PR × 2)",
     "XP Reward*": "PR × 6"
    }
   },
   {
    "id": "strobe-flash",
    "name": "Strobe flash",
    "kind": "trap",
    "page": 439,
    "xp": "PR × 8",
    "detectDC": "10 + (PR × 2)",
    "disableDC": "10 + (PR × 3)",
    "damageSave": null,
    "bypass": "",
    "awareness": null,
    "opposedBy": "",
    "attack": null,
    "saveDC": "12 + PR",
    "damage": "(PR)d6 flash",
    "repeats": false,
    "targetArea": "(PR × 5) ft. radius",
    "autoHit": false,
    "delayRounds": null,
    "rangeIncrementFromPR": false,
    "summary": "Area/range: (PR × 5) ft. radius. Reflex save DC 12 + PR for half damage (rounded down). Damage: (PR)d6 flash. Detect DC 10 + (PR × 2); Disable DC 10 + (PR × 3).",
    "raw": {
     "Trap": "Strobe flash",
     "Target Area/Range*": "(PR × 5) ft. radius",
     "Attack Bonus/Save DC*": "DC 12 + PR",
     "Damage*": "(PR)d6 flash",
     "Detect DC*∆": "10 + (PR × 2)",
     "Disable DC*": "10 + (PR × 3)",
     "XP Reward*": "PR × 8"
    }
   },
   {
    "id": "ultrasonic-siren",
    "name": "Ultrasonic siren",
    "kind": "trap",
    "page": 439,
    "xp": "PR × 8",
    "detectDC": "10 + (PR × 2)",
    "disableDC": "10 + (PR × 3)",
    "damageSave": null,
    "bypass": "",
    "awareness": null,
    "opposedBy": "",
    "attack": null,
    "saveDC": null,
    "damage": "(PR)d6 bang",
    "repeats": false,
    "targetArea": "(PR × 5) ft. radius",
    "autoHit": true,
    "delayRounds": null,
    "rangeIncrementFromPR": false,
    "summary": "Area/range: (PR × 5) ft. radius. Hits automatically. Damage: (PR)d6 bang. Detect DC 10 + (PR × 2); Disable DC 10 + (PR × 3).",
    "raw": {
     "Trap": "Ultrasonic siren",
     "Target Area/Range*": "(PR × 5) ft. radius",
     "Attack Bonus/Save DC*": "Automatic hit",
     "Damage*": "(PR)d6 bang",
     "Detect DC*∆": "10 + (PR × 2)",
     "Disable DC*": "10 + (PR × 3)",
     "XP Reward*": "PR × 8"
    }
   }
  ],
  "reputation": {
   "page": 440,
   "textPage": 439,
   "startingReputation": 2,
   "startingNetWorth": 100000,
   "byCaliber": [
    {
     "caliber": 1,
     "caliberPrinted": "I",
     "reputation": 2,
     "netWorth": 100000
    },
    {
     "caliber": 2,
     "caliberPrinted": "II",
     "reputation": 5,
     "netWorth": 250000
    },
    {
     "caliber": 3,
     "caliberPrinted": "III",
     "reputation": 10,
     "netWorth": 500000
    },
    {
     "caliber": 4,
     "caliberPrinted": "IV",
     "reputation": 15,
     "netWorth": 750000
    },
    {
     "caliber": 5,
     "caliberPrinted": "V",
     "reputation": 20,
     "netWorth": 1000000
    }
   ],
   "burnedBelow": {
    "reputation": 0,
    "netWorth": 0
   },
   "liquidationBelow": {
    "reputation": -20,
    "netWorth": -1000000,
    "roll": "1d20",
    "targetBase": 4,
    "targetPerConsecutiveMission": 1,
    "event": "marked-for-death"
   },
   "summary": "Faction characters track Reputation, Freelance ones Net Worth (Hybrid: one or the other). Start at 2 or $100,000 at any level. Each completed mission pays the Caliber reward per character regardless of success (unless critical objectives apply), and a Profession/Accomplishment check can raise it. Spent on extra gear and favors; spending does not refresh. Lost through exposure. Below 0/$0 the character is burned: no mission gear or resources until back above 0. Below -20/-$1,000,000 he is also targeted for liquidation: each mission start the GC rolls 1d20, and on a result of 4 + 1 per consecutive targeted mission (counting the first) or less, a Marked for Death event hits him. GC may rescale Net Worth (e.g. 1/100 or 1/1,000)."
  },
  "timeLimit": {
   "xp": 50,
   "page": 439
  },
  "anomalies": [
   {
    "where": "Table 7.2 Hazards / Table 7.3 Nature's Fury (schema)",
    "printed": "Rows are keyed by \"Action Die Cost\" (1-4, contagion 1-8*), with no dice ranges",
    "comment": "Neither table is rolled; both are placed under lookups (hazards, naturesFury) instead of rollTables. Only Table 7.16 is a rolled table."
   },
   {
    "where": "Table 7.2 Hazards, Contagion cost 3",
    "printed": "any disease with a Complexity DC up to 65–70",
    "comment": "\"up to\" combined with a range; other rows say \"of 55–60\" etc. Transcribed as 65-70."
   },
   {
    "where": "Table 7.2 Hazards, Contagion costs 5*-8*",
    "printed": "5*, 6*, 7*, 8*",
    "comment": "Costs above the general 1-4 dice event cap, allowed by footnote. Event costMax left at 4; rows flagged exceedsLimit."
   },
   {
    "where": "Table 7.3 Nature's Fury, Volcanic Eruption cost 3 (Moderate), p.402",
    "printed": "Fort save (DC 20) or become deafened until 3d6 hours after inflicting 1d10 fire and stress damage per action die spent",
    "comment": "Text lines swapped with the cost 4 row in the source. \"after end of eruption; GC may spend 3 action dice to hit 1 character with 1 volcanic bomb\" is presumably intended but the bomb cost is not printed here; bombDice left null."
   },
   {
    "where": "Table 7.3 Nature's Fury, Volcanic Eruption cost 4 (Major), p.402",
    "printed": "vision and hearing ranges end of eruption; GC may spend 4 action dice ...",
    "comment": "Range multiplier, Fort save DC and deafness duration are missing from the source (pattern would suggest DC 25 and 4d6 hours, but not printed). Fields left null."
   },
   {
    "where": "Table 7.3 Nature's Fury footnotes",
    "printed": "† Some natural conditions prompt additional effects, as shown on Table 5.14",
    "comment": "The single-dagger footnote has no visible reference mark in the table header or rows."
   },
   {
    "where": "Table 7.3 Nature's Fury, Fog",
    "printed": "Only costs 1-3 listed",
    "comment": "Fog has no 4-dice row; other types have 4."
   },
   {
    "where": "Table 7.16 Random Possessions, Minion",
    "printed": "19–20 Real name ID; 20 Clue leading to a henchman",
    "comment": "Overlap on 20 (two rows claim it). Kept as printed; likely intended 19 = Real name ID, 20 = Clue (matching the Henchman sub-table pattern)."
   },
   {
    "where": "Table 7.7 Exposure, Complete Critical Objective, Grade III",
    "printed": "–3/–$100,000",
    "comment": "Breaks the $50,000-per-point pattern (expected -$150,000). Kept as printed."
   },
   {
    "where": "Table 7.7 Exposure, Avoid \"Noise\" and Maintain Anonymity crowd bands",
    "printed": "11–100 people, then 100–500 people",
    "comment": "Bands overlap at exactly 100 (probably 101-500). Kept as printed."
   },
   {
    "where": "Table 7.7 Exposure, Avoid \"Noise\"",
    "printed": "Character attacks with a 1-handed melee weapon ... –0/–$0",
    "comment": "Zero penalty row; stored as reputation 0, netWorth 0."
   },
   {
    "where": "Table 7.7 Exposure, Avoid \"Noise\"",
    "printed": "draws a Small or smaller weapon ... –1; draws a Medium or smaller weapon ... –2",
    "comment": "\"Medium or smaller\" overlaps \"Small or smaller\"; probably means Medium. Kept as printed."
   },
   {
    "where": "Table 7.7 Exposure, Maintain Anonymity",
    "printed": "–10/–$500,000t",
    "comment": "Stray \"t\" after the Net Worth value (OCR/typo); stored as -500000."
   },
   {
    "where": "Table 7.7 Exposure, objective header",
    "printed": "Complete Critical Objective (Complicaton)**  +25 per add. objective",
    "comment": "Typo \"Complicaton\" corrected in the name. XP is per additional critical objective, stored as xp 25 with xpPrinted and note. Footnote ** cites page 437 for critical objectives but the rule is on p.435."
   },
   {
    "where": "Table 7.7 Exposure, column header",
    "printed": "XP Reward Worth | Reputation/Net Penalty*",
    "comment": "Header words appear shuffled (should read \"XP Reward\" and \"Reputation/Net Worth Penalty\")."
   },
   {
    "where": "Table 7.9 Security Options, sensor header",
    "printed": "Target Area* Awareness / Sensor Bonus* Skill** Opposed",
    "comment": "Header cells garbled by layout; interpreted as Sensor | Target Area* | Awareness Bonus* | Opposed Skill** | Detect DC*∆ | Disable DC* | XP Reward*."
   },
   {
    "where": "Table 7.9 Security Options, all rows",
    "printed": "Values such as +(PR × 2), 10 + (PR × 3), PR × 8",
    "comment": "Every numeric cell scales with Power Rating, so xp, DCs, bonuses and damage are stored as the printed formula strings (with the \"×\" sign), not numbers."
   },
   {
    "where": "Table 7.9 Security Options, Tripwire / Tripwire, laser",
    "printed": "Awareness Bonus \"—\", Opposed Skill \"Special ΩΩ\"",
    "comment": "Resolved from the footnote to opposedBy \"Reflex save DC 10 + PR\" / \"Reflex save DC 15 + PR\"."
   },
   {
    "where": "Table 7.9 Security Options, Metal detector / X-ray checkpoint",
    "printed": "Detect DC \"None (automatic)\"",
    "comment": "detectDC stored as null with autoDetected true."
   },
   {
    "where": "Table 7.9 Security Options, Flooding chamber",
    "printed": "P er drowning",
    "comment": "Stray space; stored as \"Per drowning\"."
   },
   {
    "where": "Table 7.9 Security Options, Steam jet",
    "printed": "Same or adjacent sqaure",
    "comment": "Typo; stored as \"square\"."
   },
   {
    "where": "Table 7.9 Security Options, Automated weapon, explosive",
    "printed": "DC per explosive / Per explosive / PR × 8 §§",
    "comment": "Save DC and damage defer to the explosive used; XP footnote says per die of explosive damage (maximum +10), whose interaction with \"PR × 8\" is unclear."
   },
   {
    "where": "Table 7.9 Security Options, Net gun",
    "printed": "+(PR × 3) with no § mark",
    "comment": "Unlike other attack-bonus traps it lacks the repeating-attack footnote; repeats false as printed."
   },
   {
    "where": "Table 7.9 Security Options, traps with \"Automatic hit\" or \"None\"",
    "printed": "Automatic hit / Automatic hit ∞ / None / None ∞",
    "comment": "No attack bonus or save DC; attack and saveDC are null, with extra fields autoHit and delayRounds."
   },
   {
    "where": "Table 7.9 Security Options, save-DC traps",
    "printed": "DC 10 + PR on p.438 traps vs DC 12 + PR on p.439 traps",
    "comment": "Two different base DCs are printed (acid/fire/steam jets, bear and cage traps use 10; laser mesh, pits, spring traps, strobe use 12). Kept as printed."
   },
   {
    "where": "Table 7.6 Sample Objectives",
    "printed": "20 categories x grades 1-5; most cells list 2-3 alternative samples separated by semicolons",
    "comment": "One objectives entry per printed row (category + grade), with the alternatives condensed into one name string. No row has a grade range, so grade is never null."
   },
   {
    "where": "Events: Wanted (p.404) vs Table 7.7",
    "printed": "Table 7.7 refers to \"becomes wanted (1-4 action dice)\"",
    "comment": "The Wanted event text gives no per-die scaling, so no intensities are recorded for it."
   },
   {
    "where": "Events: Surprise Combat (p.403)",
    "printed": "increase the Tier of all NPCs involved in the chase by 1",
    "comment": "Says \"chase\" in the combat event; apparent copy-paste from Surprise Chase."
   },
   {
    "where": "Events: Endangered Bystanders (p.399)",
    "printed": "spend and roll any number of d12 action dice",
    "comment": "Bystander count uses a d12 regardless of the GC action die type; overall limit is still 4 dice."
   }
  ]
 },
 "conflicts": {
  "leadMin": 0,
  "leadMax": 10,
  "basics": {
   "pages": [
    363,
    364
   ],
   "summary": "Predator pushes Lead down to 0; Prey pushes it up to 10. Each round both secretly pick a Strategy, make an opposed check with the Strategy modifier, and the winner takes Advantages.",
   "advantagesPerWin": {
    "base": 1,
    "extraPerMargin": 4
   },
   "criticalSuccessLeadShift": 1,
   "criticalFailureLeadShift": 1,
   "steps": [
    "Step 1: Choose Strategies (secretly; requirements must be met)",
    "Step 2: Opposed Skill Check (reveal, apply modifiers; winner crit or loser crit failure shifts Lead 1 toward the winner)",
    "Step 3: Resolution (winner picks 1 Advantage from his Strategy, +1 per 4 by which he won; check Lead for victory)",
    "Step 4: Outside Actions (per Conflict type)"
   ],
   "notes": [
    "Conflict continues while Lead is 1 to 9.",
    "Several characters on one side make cooperative checks and gain a synergy bonus from Tactics.",
    "A Strategy cannot be withdrawn once chosen; a participant may concede, giving the opponent his victory result.",
    "Threats and errors have no effect beyond what each Conflict specifies; criticals only affect Lead and Conflict conditions."
   ]
  },
  "types": {
   "chase": {
    "name": "Chase",
    "pages": [
     364,
     367
    ],
    "predator": "Pursuing character(s) or vehicle(s)",
    "prey": "Fleeing character(s) or vehicle(s)",
    "predatorSkills": [
     "Acrobatics/Maneuver (personal vehicle)",
     "Athletics/Maneuver (foot)",
     "Drive/Maneuver (non-personal vehicle)",
     "Survival/Maneuver (animal)",
     "Tactics/Maneuver (any vehicle with the crew quality)"
    ],
    "preySkills": [
     "Acrobatics/Maneuver (personal vehicle)",
     "Athletics/Maneuver (foot)",
     "Drive/Maneuver (non-personal vehicle)",
     "Survival/Maneuver (animal)",
     "Tactics/Maneuver (any vehicle with the crew quality)"
    ],
    "roundTime": "6 seconds (2 minutes for Ship vs. Ship)",
    "powerRatings": [
     "Acceleration",
     "Turning"
    ],
    "startingLead": {
     "default": 5,
     "summary": "Compare Acceleration (Open/Close room) or Turning (Crowded/Tight room); a side 2+ higher shifts starting Lead 1 its way.",
     "rules": [
      {
       "when": "Predator's relevant Power Rating is 2+ higher than Prey's",
       "lead": 4
      },
      {
       "when": "Prey's relevant Power Rating is 2+ higher than Predator's",
       "lead": 6
      },
      {
       "when": "Otherwise",
       "lead": 5
      }
     ]
    },
    "strategies": [
     {
      "id": "buy-time",
      "name": "Buy Time",
      "side": "general",
      "requirements": "",
      "leadMin": null,
      "leadMax": null,
      "ratings": [],
      "ratingsMode": null,
      "other": "",
      "modifier": -4,
      "advantages": [
       "Pause"
      ],
      "summary": "Stall and shadow the opponent until conditions improve.",
      "note": ""
     },
     {
      "id": "clip",
      "name": "Clip",
      "side": "general",
      "requirements": "Lead 1–2",
      "leadMin": 1,
      "leadMax": 2,
      "ratings": [],
      "ratingsMode": null,
      "other": "",
      "modifier": -4,
      "advantages": [
       "Defense",
       "Impact"
      ],
      "summary": "Sideswipe the opponent at close quarters.",
      "note": ""
     },
     {
      "id": "eat-my-dust",
      "name": "Eat My Dust",
      "side": "general",
      "requirements": "Acceleration 5+ or Turning 5+",
      "leadMin": null,
      "leadMax": null,
      "ratings": [
       {
        "rating": "Acceleration",
        "min": 5
       },
       {
        "rating": "Turning",
        "min": 5
       }
      ],
      "ratingsMode": "any",
      "other": "",
      "modifier": -2,
      "advantages": [
       "Lead",
       "Stress"
      ],
      "summary": "Open the throttle and leave the opponent rattled.",
      "note": ""
     },
     {
      "id": "go-go-go",
      "name": "“Go, Go, Go!”",
      "side": "general",
      "requirements": "",
      "leadMin": null,
      "leadMax": null,
      "ratings": [],
      "ratingsMode": null,
      "other": "",
      "modifier": -4,
      "advantages": [
       "Lead",
       "Crisis"
      ],
      "summary": "Reckless all-out push that invites disaster.",
      "note": ""
     },
     {
      "id": "parting-shot",
      "name": "Parting Shot",
      "side": "general",
      "requirements": "Lead 8–9",
      "leadMin": 8,
      "leadMax": 9,
      "ratings": [],
      "ratingsMode": null,
      "other": "",
      "modifier": -2,
      "advantages": [
       "Attack",
       "Crisis"
      ],
      "summary": "With the chase nearly over, take a moment for violence.",
      "note": ""
     },
     {
      "id": "quick-reverse",
      "name": "Quick Reverse",
      "side": "general",
      "requirements": "Lead 2–6",
      "leadMin": 2,
      "leadMax": 6,
      "ratings": [],
      "ratingsMode": null,
      "other": "",
      "modifier": -8,
      "advantages": [
       "Lead",
       "Swap"
      ],
      "summary": "Turn on the opponent to shake him or flip the roles.",
      "note": ""
     },
     {
      "id": "ram",
      "name": "Ram",
      "side": "general",
      "requirements": "Lead 1–4",
      "leadMin": 1,
      "leadMax": 4,
      "ratings": [],
      "ratingsMode": null,
      "other": "",
      "modifier": -2,
      "advantages": [
       "Attack",
       "Impact"
      ],
      "summary": "Use the vehicle itself as a weapon against the opponent.",
      "note": ""
     },
     {
      "id": "set-up",
      "name": "Set Up",
      "side": "general",
      "requirements": "",
      "leadMin": null,
      "leadMax": null,
      "ratings": [],
      "ratingsMode": null,
      "other": "",
      "modifier": -4,
      "advantages": [
       "Stress",
       "Twist"
      ],
      "summary": "Prepare an unexpected change of tack for next round.",
      "note": "Printed as \"Set up\" in Table 6.3 and \"Set Up\" in the description."
     },
     {
      "id": "stunt",
      "name": "Stunt",
      "side": "general",
      "requirements": "Acceleration 6+ or Turning 6+†",
      "leadMin": null,
      "leadMax": null,
      "ratings": [
       {
        "rating": "Acceleration",
        "min": 6
       },
       {
        "rating": "Turning",
        "min": 6
       }
      ],
      "ratingsMode": "any",
      "other": "Daredevil feat (see page 192)",
      "modifier": -8,
      "advantages": [
       "Room",
       "Swap"
      ],
      "summary": "Daredevil maneuver to change positions or venue.",
      "note": ""
     },
     {
      "id": "tactical-ploy",
      "name": "Tactical Ploy",
      "side": "general",
      "requirements": "Acceleration 8+ or Turning 8+",
      "leadMin": null,
      "leadMax": null,
      "ratings": [
       {
        "rating": "Acceleration",
        "min": 8
       },
       {
        "rating": "Turning",
        "min": 8
       }
      ],
      "ratingsMode": "any",
      "other": "",
      "modifier": -6,
      "advantages": [
       "Attack",
       "Defense",
       "Room"
      ],
      "summary": "Use the surroundings cleverly for an edge.",
      "note": ""
     },
     {
      "id": "thats-impossible",
      "name": "“That’s Impossible!”",
      "side": "general",
      "requirements": "††",
      "leadMin": null,
      "leadMax": null,
      "ratings": [],
      "ratingsMode": null,
      "other": "“That’s Impossible!” class ability (see page 52)",
      "modifier": 0,
      "advantages": [
       "*"
      ],
      "summary": "Physics-defying driving; winner spends 1 use of the class ability to pick any Advantages except Victory.",
      "note": "Printed as \"Any except Victory\"."
     },
     {
      "id": "weave",
      "name": "Weave",
      "side": "general",
      "requirements": "Lead 6–9",
      "leadMin": 6,
      "leadMax": 9,
      "ratings": [],
      "ratingsMode": null,
      "other": "",
      "modifier": -4,
      "advantages": [
       "Defense",
       "Crisis"
      ],
      "summary": "Use terrain, traffic and bystanders as cover.",
      "note": ""
     },
     {
      "id": "attack-run",
      "name": "Attack Run",
      "side": "predator",
      "requirements": "Acceleration 5+ and Turning 4+",
      "leadMin": null,
      "leadMax": null,
      "ratings": [
       {
        "rating": "Acceleration",
        "min": 5
       },
       {
        "rating": "Turning",
        "min": 4
       }
      ],
      "ratingsMode": "all",
      "other": "",
      "modifier": 0,
      "advantages": [
       "Attack",
       "Lead"
      ],
      "summary": "Level out and close in to line up a shot.",
      "note": ""
     },
     {
      "id": "close-in",
      "name": "Close In",
      "side": "predator",
      "requirements": "Turning 5+",
      "leadMin": null,
      "leadMax": null,
      "ratings": [
       {
        "rating": "Turning",
        "min": 5
       }
      ],
      "ratingsMode": "all",
      "other": "",
      "modifier": -2,
      "advantages": [
       "Pause",
       "Stress"
      ],
      "summary": "Tailgate to pressure the Prey into a mistake.",
      "note": ""
     },
     {
      "id": "cut-off",
      "name": "Cut Off",
      "side": "predator",
      "requirements": "Acceleration 7+ or Turning 7+",
      "leadMin": null,
      "leadMax": null,
      "ratings": [
       {
        "rating": "Acceleration",
        "min": 7
       },
       {
        "rating": "Turning",
        "min": 7
       }
      ],
      "ratingsMode": "any",
      "other": "",
      "modifier": -12,
      "advantages": [
       "Attack",
       "Victory"
      ],
      "summary": "Attempt to block and trap the Prey in one move.",
      "note": ""
     },
     {
      "id": "redline",
      "name": "Redline",
      "side": "predator",
      "requirements": "Acceleration 6+",
      "leadMin": null,
      "leadMax": null,
      "ratings": [
       {
        "rating": "Acceleration",
        "min": 6
       }
      ],
      "ratingsMode": "all",
      "other": "",
      "modifier": 2,
      "advantages": [
       "Lead"
      ],
      "summary": "Dangerous burst of raw speed to catch up.",
      "note": ""
     },
     {
      "id": "shortcut",
      "name": "Shortcut",
      "side": "predator",
      "requirements": "Acceleration 4+ and Turning 6+",
      "leadMin": null,
      "leadMax": null,
      "ratings": [
       {
        "rating": "Acceleration",
        "min": 4
       },
       {
        "rating": "Turning",
        "min": 6
       }
      ],
      "ratingsMode": "all",
      "other": "",
      "modifier": -4,
      "advantages": [
       "Lead",
       "Room"
      ],
      "summary": "Drive the Prey through hazardous terrain.",
      "note": ""
     },
     {
      "id": "stalk",
      "name": "Stalk",
      "side": "predator",
      "requirements": "Acceleration 6+ or Turning 3+",
      "leadMin": null,
      "leadMax": null,
      "ratings": [
       {
        "rating": "Acceleration",
        "min": 6
       },
       {
        "rating": "Turning",
        "min": 3
       }
      ],
      "ratingsMode": "any",
      "other": "",
      "modifier": -4,
      "advantages": [
       "Defense",
       "Stress"
      ],
      "summary": "Follow warily from a safe distance, keeping the Prey guessing.",
      "note": ""
     },
     {
      "id": "careful-timing",
      "name": "Careful Timing",
      "side": "prey",
      "requirements": "Acceleration 5+",
      "leadMin": null,
      "leadMax": null,
      "ratings": [
       {
        "rating": "Acceleration",
        "min": 5
       }
      ],
      "ratingsMode": "all",
      "other": "",
      "modifier": -2,
      "advantages": [
       "Lead",
       "Pause"
      ],
      "summary": "Wait for the right instant to surge ahead.",
      "note": ""
     },
     {
      "id": "chicken",
      "name": "Chicken",
      "side": "prey",
      "requirements": "Acceleration 3+ or Turning 6+",
      "leadMin": null,
      "leadMax": null,
      "ratings": [
       {
        "rating": "Acceleration",
        "min": 3
       },
       {
        "rating": "Turning",
        "min": 6
       }
      ],
      "ratingsMode": "any",
      "other": "",
      "modifier": -4,
      "advantages": [
       "Attack",
       "Stress"
      ],
      "summary": "Swing around and charge the pursuer head-on.",
      "note": ""
     },
     {
      "id": "detour",
      "name": "Detour",
      "side": "prey",
      "requirements": "Acceleration 6+ and Turning 4+",
      "leadMin": null,
      "leadMax": null,
      "ratings": [
       {
        "rating": "Acceleration",
        "min": 6
       },
       {
        "rating": "Turning",
        "min": 4
       }
      ],
      "ratingsMode": "all",
      "other": "",
      "modifier": -4,
      "advantages": [
       "Lead",
       "Room"
      ],
      "summary": "Sudden turn to drag the chase somewhere new.",
      "note": ""
     },
     {
      "id": "double-back",
      "name": "Double Back",
      "side": "prey",
      "requirements": "Acceleration 4+ and Turning 5+",
      "leadMin": null,
      "leadMax": null,
      "ratings": [
       {
        "rating": "Acceleration",
        "min": 4
       },
       {
        "rating": "Turning",
        "min": 5
       }
      ],
      "ratingsMode": "all",
      "other": "",
      "modifier": 0,
      "advantages": [
       "Defense",
       "Lead"
      ],
      "summary": "Whip around to put scenery between the vehicles.",
      "note": ""
     },
     {
      "id": "long-gone",
      "name": "Long Gone",
      "side": "prey",
      "requirements": "Acceleration 7+ or Turning 7+",
      "leadMin": null,
      "leadMax": null,
      "ratings": [
       {
        "rating": "Acceleration",
        "min": 7
       },
       {
        "rating": "Turning",
        "min": 7
       }
      ],
      "ratingsMode": "any",
      "other": "",
      "modifier": -12,
      "advantages": [
       "Defense",
       "Victory"
      ],
      "summary": "One decisive dash to lose the tail for good.",
      "note": ""
     },
     {
      "id": "outfox",
      "name": "Outfox",
      "side": "prey",
      "requirements": "Turning 6+",
      "leadMin": null,
      "leadMax": null,
      "ratings": [
       {
        "rating": "Turning",
        "min": 6
       }
      ],
      "ratingsMode": "all",
      "other": "",
      "modifier": 2,
      "advantages": [
       "Lead"
      ],
      "summary": "Force the pursuer into turns he cannot make.",
      "note": ""
     }
    ],
    "advantages": [
     {
      "id": "attack",
      "name": "Attack",
      "leadShift": 0,
      "victory": false,
      "summary": "Winner gets +4 on attack checks against other chase participants for 1 full round.",
      "repeat": "Each further pick: +2 more and +1 threat range on those attacks.",
      "repeatEvery": 1
     },
     {
      "id": "crisis",
      "name": "Crisis",
      "leadShift": 0,
      "victory": false,
      "summary": "An obstacle appears: every participant makes a Maneuver check vs. the current Crisis DC (Table 6.1) or crashes. A participant may skip the check, giving the opponent 3 Lead.",
      "repeat": "Each further pick lowers the winner's own Crisis DC by 5 (minimum 10).",
      "repeatEvery": 1,
      "skipLeadShift": 3
     },
     {
      "id": "defense",
      "name": "Defense",
      "leadShift": 0,
      "victory": false,
      "summary": "Winner gets +4 Defense against attacks from other chase participants for 1 full round.",
      "repeat": "Each further pick: +2 more and +1 error range on attacks against the winner.",
      "repeatEvery": 1
     },
     {
      "id": "impact",
      "name": "Impact",
      "leadShift": 0,
      "victory": false,
      "summary": "Winner and one chosen opponent both take collision damage (vehicle: equal to the opponent's check result; both on foot: 1d4 lethal). With GC approval passengers may attempt an Acrobatics/Jump (5 ft.) onto the target vehicle.",
      "repeat": "Each further pick reduces the winner's own damage by 4 (on foot vs. foot: +1d4 lethal each).",
      "repeatEvery": 1
     },
     {
      "id": "lead",
      "name": "Lead",
      "leadShift": 1,
      "victory": false,
      "summary": "Lead moves 1 point toward the winner.",
      "repeat": "Every 2 further picks in the round move Lead 1 more point toward the winner, or instead remove 1 Smash point from an opponent.",
      "repeatEvery": 2
     },
     {
      "id": "pause",
      "name": "Pause",
      "leadShift": 0,
      "victory": false,
      "summary": "Conflict freezes: Lead stays put and no steps resolve next round, though Step 4 actions still happen.",
      "repeat": "Each further pick adds 1 more paused round.",
      "repeatEvery": 1
     },
     {
      "id": "room",
      "name": "Room",
      "leadShift": 0,
      "victory": false,
      "summary": "Maneuvering Room shifts 1 grade in the direction the winner chooses.",
      "repeat": "Chosen 3 times in a round: winner sets Maneuvering Room to any grade."
     },
     {
      "id": "stress",
      "name": "Stress",
      "leadShift": 0,
      "victory": false,
      "summary": "Everyone except the winner takes 1d4 stress damage that cannot be recovered until the chase ends.",
      "repeat": "Each further pick adds +1d4 stress damage.",
      "repeatEvery": 1
     },
     {
      "id": "swap",
      "name": "Swap",
      "leadShift": 0,
      "victory": false,
      "summary": "Predator and Prey trade roles, then Lead increases by 1.",
      "repeat": "",
      "swapRoles": true,
      "absoluteLeadChange": 1
     },
     {
      "id": "twist",
      "name": "Twist",
      "leadShift": 0,
      "victory": false,
      "summary": "Winner may use Blend (Dex), Bluff (Cha), Impress (Cha), Intimidate (Cha), Mechanics (Int), Sense Motive (Wis) or Streetwise (Wis), without tags, for the next opposed check.",
      "repeat": "",
      "twistSkills": [
       "Blend (Dex)",
       "Bluff (Cha)",
       "Impress (Cha)",
       "Intimidate (Cha)",
       "Mechanics (Int)",
       "Sense Motive (Wis)",
       "Streetwise (Wis)"
      ]
     },
     {
      "id": "victory",
      "name": "Victory",
      "leadShift": 0,
      "victory": true,
      "summary": "Conflict ends immediately in the winner's favor.",
      "repeat": ""
     }
    ],
    "victory": {
     "predator": "Leaders stop adjacent; Prey vehicle is immobilized; Predator side gets a half-action surprise round and may first apply 1 Impact Advantage to the Prey.",
     "prey": "Prey and team get away and cannot be found for the rest of the scene; Prey may apply 1 Crisis Advantage to the Predator."
    },
    "outsideActions": "Each driver or runner gets 1 half action; every passenger gets a full action or 2 half actions. Run alongside combat, these fall on each character's Initiative Count.",
    "tables": {
     "maneuveringRoom": {
      "title": "Table 6.1: Maneuvering Room",
      "page": 364,
      "columns": [
       "Grade",
       "Chase Speed*",
       "Top MPH Bonus**",
       "Crisis DC†"
      ],
      "rows": [
       [
        "Open (e.g. light traffic, open skies, calm seas, etc.)",
        "×1",
        "+6",
        15
       ],
       [
        "Close (e.g. moderate traffic, canyon flying, rough seas, etc.)",
        "×3/4",
        "+4",
        20
       ],
       [
        "Crowded (e.g. heavy traffic, canyon flying with many intervening ledges, turbulent seas, etc.)",
        "×1/2",
        "+2",
        30
       ],
       [
        "Tight (e.g. rush hour traffic, aerial dogfight, tsunami seas, etc.)",
        "×1/4",
        "+0",
        40
       ]
      ],
      "notes": [
       "* Everyone travels at this fraction of the slowest vehicle's top MPH (rounded down); mostly matters for crashes.",
       "** Bonus to all chase Maneuver checks for whoever pilots the vehicle with the highest top MPH.",
       "† DC of the Maneuver check required each time a crisis occurs."
      ]
     },
     "chaseLead": {
      "title": "Table 6.2: Chase Lead",
      "page": 365,
      "columns": [
       "Vehicle Type",
       "Distance Per Lead Point"
      ],
      "rows": [
       [
        "Aircraft, Heavy",
        "100 ft."
       ],
       [
        "Aircraft, Light",
        "200 ft."
       ],
       [
        "Aircraft, Performance*",
        "1,000 ft."
       ],
       [
        "Aircraft, Personal",
        "40 ft."
       ],
       [
        "Aircraft, Rotor-Wing",
        "100 ft."
       ],
       [
        "Foot",
        "20 ft."
       ],
       [
        "Ground, Commercial",
        "20 ft."
       ],
       [
        "Ground, Heavy",
        "30 ft."
       ],
       [
        "Ground, Personal",
        "40 ft."
       ],
       [
        "Ground, Standard",
        "50 ft."
       ],
       [
        "Mounts and Animal-Drawn Vehicles",
        "30 ft."
       ],
       [
        "Ships**",
        "1 mile"
       ],
       [
        "Space",
        "1 mile"
       ],
       [
        "Submarines",
        "30 ft."
       ],
       [
        "Watercraft, Personal",
        "40 ft."
       ],
       [
        "Watercraft, Standard",
        "50 ft."
       ]
      ],
      "notes": [
       "* May voluntarily drop to as little as 200 ft. per point to engage other aircraft.",
       "** Ships can only effectively chase or fight other ships; Ship vs. Ship rounds last 2 minutes."
      ]
     }
    },
    "notes": [
     "On foot, Acceleration = Strength modifier and Turning = Dexterity modifier (each minimum 0); otherwise the vehicle supplies both ratings.",
     "GC sets Maneuvering Room (Open/Close/Crowded/Tight) at the start; it can change via the Room Advantage.",
     "Chained chases: track a separate Lead per Predator/Prey pair and resolve each step pair by pair from front to back.",
     "Mismatched vehicles: distance per Lead point is the shortest of those involved; if one vehicle's distance is more than double another's, resolve with a single opposed check instead.",
     "Each chase round burns 1 minute of fuel. A pilot firing vehicle weapons uses the multi-tasking rules.",
     "With simultaneous combat: Step 1 before the first Initiative Count, Steps 2-3 at the (first) Predator's count, Step 4 spread across the round.",
     "Smash points (powered aircraft only): the single pilot 200+ ft. above the nearest opponent with no enemy above holds 1 per Lead point to the next highest opponent; +1 when he wins an opposed check or scores a Maneuver threat, -1 when another participant does; lost entirely at 0 or when conditions lapse.",
     "Spending Smash after winning an opposed check: Predator spends 1 to reduce Lead by 1; Prey spends 1 for +4 Defense until his next Initiative Count. Attacks on a Smash holder add his Smash points to Lead when working out range.",
     "Crash: on foot 1d4 lethal; vehicles take collision damage by size and speed, occupants make a Reflex save (DC half that damage) or take half. Crashed participants leave the chase.",
     "“That’s Impossible!” winner spends 1 use of the class ability to choose any 1 Advantage, +1 per 4 margin, never Victory."
    ]
   },
   "brainwashing": {
    "name": "Brainwashing",
    "pages": [
     368,
     370
    ],
    "predator": "Character(s) trying to break a captive's will",
    "prey": "Captive character(s)",
    "predatorSkills": [
     "Manipulate (Wis)"
    ],
    "preySkills": [
     "Resolve (Wis)"
    ],
    "predatorSkillTags": [
     "Concentration",
     "Grasp",
     "Hearing",
     "Language"
    ],
    "preySkillTags": [],
    "roundTime": "4 hours (mental approach) or 2 days (physical approach); see brainwashingApproaches table",
    "powerRatings": [
     "Base Will save bonus",
     "Base Will/Fortitude save bonus"
    ],
    "startingLead": {
     "default": null,
     "summary": "Half the Prey's base Fortitude or base Will save bonus, whichever is lower (minimum 2). A result of 10+ means the Prey cannot be brainwashed.",
     "rules": [
      {
       "when": "Always: 1/2 of the lower of Prey's base Fortitude / base Will save bonus",
       "lead": null,
       "formula": "max(2, min(baseFort, baseWill) / 2)"
      },
      {
       "when": "Computed starting Lead is 10 or more",
       "lead": null,
       "result": "Prey is immune; no Conflict"
      }
     ]
    },
    "strategies": [
     {
      "id": "chip-away",
      "name": "Chip Away",
      "side": "predator",
      "requirements": "Lead 1–3",
      "leadMin": 1,
      "leadMax": 3,
      "ratings": [],
      "ratingsMode": null,
      "other": "",
      "modifier": 0,
      "advantages": [
       "Alter Memory",
       "Stress"
      ],
      "summary": "Wear down the victim's mind or test how firm the hold is.",
      "note": "",
      "skill": "Manipulate (Wis)"
     },
     {
      "id": "false-hope",
      "name": "False Hope",
      "side": "predator",
      "requirements": "Base Will save bonus 4+",
      "leadMin": null,
      "leadMax": null,
      "ratings": [
       {
        "rating": "Base Will save bonus",
        "min": 4
       }
      ],
      "ratingsMode": "all",
      "other": "",
      "modifier": -4,
      "advantages": [
       "Haste",
       "Revelation"
      ],
      "summary": "Dangle a glimmer of hope to slip past the victim's defenses.",
      "note": "",
      "skill": "Manipulate (Wis)"
     },
     {
      "id": "fluster",
      "name": "Fluster",
      "side": "predator",
      "requirements": "Base Will save bonus 6+",
      "leadMin": null,
      "leadMax": null,
      "ratings": [
       {
        "rating": "Base Will save bonus",
        "min": 6
       }
      ],
      "ratingsMode": "all",
      "other": "",
      "modifier": -2,
      "advantages": [
       "Lead",
       "Shred"
      ],
      "summary": "Catch the victim in his own lies.",
      "note": "",
      "skill": "Sense Motive (Wis)"
     },
     {
      "id": "mind-games",
      "name": "Mind Games",
      "side": "predator",
      "requirements": "Base Will save bonus 7+",
      "leadMin": null,
      "leadMax": null,
      "ratings": [
       {
        "rating": "Base Will save bonus",
        "min": 7
       }
      ],
      "ratingsMode": "all",
      "other": "",
      "modifier": -4,
      "advantages": [
       "Pause",
       "Slip"
      ],
      "summary": "Idle-seeming talk to kill time or get under the victim's skin.",
      "note": "",
      "skill": "Manipulate (Wis)"
     },
     {
      "id": "new-tactic",
      "name": "New Tactic",
      "side": "predator",
      "requirements": "Lead 6–9",
      "leadMin": 6,
      "leadMax": 9,
      "ratings": [],
      "ratingsMode": null,
      "other": "",
      "modifier": -6,
      "advantages": [
       "Crisis",
       "New Approach"
      ],
      "summary": "Switch methods or unsettle the victim with something unorthodox.",
      "note": "",
      "skill": "Manipulate (Wis)"
     },
     {
      "id": "patience",
      "name": "Patience",
      "side": "predator",
      "requirements": "Lead 3–7",
      "leadMin": 3,
      "leadMax": 7,
      "ratings": [],
      "ratingsMode": null,
      "other": "",
      "modifier": -2,
      "advantages": [
       "Lead",
       "Stress"
      ],
      "summary": "Wait and let the victim's own fears do the work.",
      "note": "",
      "skill": "Resolve (Wis)"
     },
     {
      "id": "seeds-of-doubt",
      "name": "Seeds of Doubt",
      "side": "predator",
      "requirements": "",
      "leadMin": null,
      "leadMax": null,
      "ratings": [],
      "ratingsMode": null,
      "other": "",
      "modifier": 0,
      "advantages": [
       "Lead",
       "Splinter"
      ],
      "summary": "Turn the victim against his comrades.",
      "note": "",
      "skill": "Manipulate (Wis)"
     },
     {
      "id": "turn-the-screws",
      "name": "Turn the Screws",
      "side": "predator",
      "requirements": "Base Will save bonus 5+",
      "leadMin": null,
      "leadMax": null,
      "ratings": [
       {
        "rating": "Base Will save bonus",
        "min": 5
       }
      ],
      "ratingsMode": "all",
      "other": "",
      "modifier": -8,
      "advantages": [
       "Haste",
       "Lead"
      ],
      "summary": "Resort to physical violence.",
      "note": "",
      "skill": "Medicine (Wis)"
     },
     {
      "id": "ultimatum",
      "name": "Ultimatum",
      "side": "predator",
      "requirements": "Base Will save bonus 8+",
      "leadMin": null,
      "leadMax": null,
      "ratings": [
       {
        "rating": "Base Will save bonus",
        "min": 8
       }
      ],
      "ratingsMode": "all",
      "other": "",
      "modifier": -12,
      "advantages": [
       "Slip",
       "Victory"
      ],
      "summary": "Threaten far worse to come in a bid to end it now.",
      "note": "",
      "skill": "Manipulate (Wis)"
     },
     {
      "id": "cling-to-hope",
      "name": "Cling to Hope",
      "side": "prey",
      "requirements": "Base Will/Fortitude save bonus 5+**",
      "leadMin": null,
      "leadMax": null,
      "ratings": [
       {
        "rating": "Base Will/Fortitude save bonus",
        "min": 5
       }
      ],
      "ratingsMode": "all",
      "other": "Uses the Prey's base Will save bonus against a mental approach, base Fortitude save bonus against a physical approach",
      "modifier": -2,
      "advantages": [
       "Lead",
       "Pause"
      ],
      "summary": "Draw strength from belief that friends will come.",
      "note": "",
      "skill": "Networking (Wis)"
     },
     {
      "id": "concede",
      "name": "Concede",
      "side": "prey",
      "requirements": "",
      "leadMin": null,
      "leadMax": null,
      "ratings": [],
      "ratingsMode": null,
      "other": "",
      "modifier": 0,
      "advantages": [
       "Lead",
       "Revelation"
      ],
      "summary": "Give up some information in exchange for relief.",
      "note": "",
      "skill": "Resolve (Wis)"
     },
     {
      "id": "hold-fast",
      "name": "Hold Fast",
      "side": "prey",
      "requirements": "Base Will/Fortitude save bonus 7+**",
      "leadMin": null,
      "leadMax": null,
      "ratings": [
       {
        "rating": "Base Will/Fortitude save bonus",
        "min": 7
       }
      ],
      "ratingsMode": "all",
      "other": "Uses the Prey's base Will save bonus against a mental approach, base Fortitude save bonus against a physical approach",
      "modifier": -2,
      "advantages": [
       "Lead",
       "Pause"
      ],
      "summary": "Openly resist with the strongest front possible.",
      "note": "",
      "skill": "Resolve (Wis)"
     },
     {
      "id": "last-stand",
      "name": "Last Stand",
      "side": "prey",
      "requirements": "Lead 1–3",
      "leadMin": 1,
      "leadMax": 3,
      "ratings": [],
      "ratingsMode": null,
      "other": "",
      "modifier": -6,
      "advantages": [
       "Crisis",
       "New Approach"
      ],
      "summary": "Nearly broken, make a final act of resistance.",
      "note": "",
      "skill": "Resolve (Wis)"
     },
     {
      "id": "misdirect",
      "name": "Misdirect",
      "side": "prey",
      "requirements": "Base Will/Fortitude save bonus 4+**",
      "leadMin": null,
      "leadMax": null,
      "ratings": [
       {
        "rating": "Base Will/Fortitude save bonus",
        "min": 4
       }
      ],
      "ratingsMode": "all",
      "other": "Uses the Prey's base Will save bonus against a mental approach, base Fortitude save bonus against a physical approach",
      "modifier": -4,
      "advantages": [
       "Revelation",
       "Twist"
      ],
      "summary": "Time a disclosure to fool the captor.",
      "note": "",
      "skill": "Resolve (Wis)"
     },
     {
      "id": "never-surrender",
      "name": "Never Surrender",
      "side": "prey",
      "requirements": "Base Will/Fortitude save bonus 8+**",
      "leadMin": null,
      "leadMax": null,
      "ratings": [
       {
        "rating": "Base Will/Fortitude save bonus",
        "min": 8
       }
      ],
      "ratingsMode": "all",
      "other": "Uses the Prey's base Will save bonus against a mental approach, base Fortitude save bonus against a physical approach",
      "modifier": -12,
      "advantages": [
       "Haste",
       "Victory"
      ],
      "summary": "Burn remaining reserves in one great burst of defiance.",
      "note": "",
      "skill": "Resolve (Wis)"
     },
     {
      "id": "rebel",
      "name": "Rebel",
      "side": "prey",
      "requirements": "Lead 7–9",
      "leadMin": 7,
      "leadMax": 9,
      "ratings": [],
      "ratingsMode": null,
      "other": "",
      "modifier": 0,
      "advantages": [
       "Haste",
       "Lead"
      ],
      "summary": "Press the advantage against captors who seem to be faltering.",
      "note": "",
      "skill": "Resolve (Wis)"
     },
     {
      "id": "still-in-the-game",
      "name": "Still in the Game",
      "side": "prey",
      "requirements": "Lead 3–7",
      "leadMin": 3,
      "leadMax": 7,
      "ratings": [],
      "ratingsMode": null,
      "other": "",
      "modifier": -8,
      "advantages": [
       "Slip",
       "Twist"
      ],
      "summary": "Play mind games back at the captor.",
      "note": "",
      "skill": "Bluff (Cha)"
     },
     {
      "id": "worrisome-smile",
      "name": "Worrisome Smile",
      "side": "prey",
      "requirements": "Base Will/Fortitude save bonus 6+**",
      "leadMin": null,
      "leadMax": null,
      "ratings": [
       {
        "rating": "Base Will/Fortitude save bonus",
        "min": 6
       }
      ],
      "ratingsMode": "all",
      "other": "Uses the Prey's base Will save bonus against a mental approach, base Fortitude save bonus against a physical approach",
      "modifier": -4,
      "advantages": [
       "Lead",
       "Stress"
      ],
      "summary": "Unnerve the captor with calm amusement.",
      "note": "",
      "skill": "Manipulate (Wis)"
     }
    ],
    "advantages": [
     {
      "id": "alter-memory",
      "name": "Alter Memory",
      "leadShift": 0,
      "victory": false,
      "summary": "Prey gains or loses all memory of 1 event of up to 1 hour, chosen by the Predator.",
      "repeat": "Each further pick affects 1 more event of up to 1 hour.",
      "repeatEvery": 1
     },
     {
      "id": "crisis",
      "name": "Crisis",
      "leadShift": 0,
      "victory": false,
      "summary": "Both sides make a Fortitude or Will save (DC 10 + half opponent's career level, rounded up). Failure: 1d3 temporary Wis and 1d3 temporary Cha damage; if only one side fails, the other wins. A side may skip the save, giving the opponent 3 Lead.",
      "repeat": "Each further pick lowers the winner's own Crisis DC by 2 (minimum 5).",
      "repeatEvery": 1,
      "skipLeadShift": 3,
      "canEndConflict": true
     },
     {
      "id": "haste",
      "name": "Haste",
      "leadShift": 0,
      "victory": false,
      "summary": "Next Conflict round takes half the standard time (rounded down, minimum 5 minutes).",
      "repeat": "Each further pick halves the duration again.",
      "repeatEvery": 1
     },
     {
      "id": "lead",
      "name": "Lead",
      "leadShift": 1,
      "victory": false,
      "summary": "Lead moves 1 point toward the winner.",
      "repeat": "Every 2 further picks in the round move Lead 1 more point toward the winner.",
      "repeatEvery": 2
     },
     {
      "id": "new-approach",
      "name": "New Approach",
      "leadShift": 0,
      "victory": false,
      "summary": "Predator's approach flips between mental and physical.",
      "repeat": ""
     },
     {
      "id": "pause",
      "name": "Pause",
      "leadShift": 0,
      "victory": false,
      "summary": "Conflict freezes: Lead stays put and no steps resolve next round.",
      "repeat": "Each further pick adds 1 more paused round.",
      "repeatEvery": 1
     },
     {
      "id": "revelation",
      "name": "Revelation",
      "leadShift": 0,
      "victory": false,
      "summary": "Winner may voluntarily disclose 1 fact about his organization (full history, an unknown goal, an unknown Rating, or an unknown Site) to gain 1 bonus action die.",
      "repeat": "Each further pick: 1 more disclosure for 1 more bonus action die.",
      "repeatEvery": 1
     },
     {
      "id": "shred",
      "name": "Shred",
      "leadShift": 0,
      "victory": false,
      "summary": "The Prey's lowest-rated cover identity loses 1 Power Rating; at 0 the identity is blown.",
      "repeat": "Every 2 further picks remove 1 more point, rolling over to the next-lowest identity if one hits 0.",
      "repeatEvery": 2
     },
     {
      "id": "slip",
      "name": "Slip",
      "leadShift": 0,
      "victory": false,
      "summary": "Winner either pulls 1 clue/secret from an opponent or passes off 1 lie as if a Bluff/Deception check with up to -6 penalty had succeeded.",
      "repeat": "Every 2 further picks: 1 more clue/secret, or lie penalty cap rises by 2 (-8, -10...).",
      "repeatEvery": 2
     },
     {
      "id": "splinter",
      "name": "Splinter",
      "leadShift": 0,
      "victory": false,
      "summary": "Next round the Prey group must make a team check using its lowest skill bonus.",
      "repeat": "Each further pick extends this by 1 more round.",
      "repeatEvery": 1
     },
     {
      "id": "stress",
      "name": "Stress",
      "leadShift": 0,
      "victory": false,
      "summary": "Everyone except the winner takes 1d4 stress damage that cannot be recovered until the brainwashing attempt ends.",
      "repeat": "Each further pick adds +1d4 stress damage.",
      "repeatEvery": 1
     },
     {
      "id": "twist",
      "name": "Twist",
      "leadShift": 0,
      "victory": false,
      "summary": "Winner may use Analysis (Wis), Cultures (Int), Falsify (Wis), Intimidate (Cha), Investigation (Cha), Science (Int) or Tactics (Int), without tags, for the next opposed check.",
      "repeat": "",
      "twistSkills": [
       "Analysis (Wis)",
       "Cultures (Int)",
       "Falsify (Wis)",
       "Intimidate (Cha)",
       "Investigation (Cha)",
       "Science (Int)",
       "Tactics (Int)"
      ]
     },
     {
      "id": "victory",
      "name": "Victory",
      "leadShift": 0,
      "victory": true,
      "summary": "Conflict ends immediately in the winner's favor.",
      "repeat": ""
     }
    ],
    "victory": {
     "predator": "Prey forgets the brainwashing itself; Predator either permanently erases 1 event of up to 24 hours, or compels 1 action as if an Impress/Persuasion check with up to -18 penalty succeeded (never one that would expose the Prey).",
     "prey": "Prey proves resistant: the same Predator (or his group) cannot brainwash him again this mission."
    },
    "outsideActions": "",
    "tables": {
     "brainwashingApproaches": {
      "title": "Table 6.4: Brainwashing Approaches",
      "page": 368,
      "columns": [
       "Approach",
       "Conflict Round Duration",
       "Check Modifiers*",
       "Error Range Modifiers*"
      ],
      "rows": [
       [
        "Mental Techniques",
        "4 hours",
        "+0/+0",
        "+3/+0"
       ],
       [
        "Physical Techniques",
        "2 days",
        "+0/-2",
        "+0/+0"
       ]
      ],
      "notes": [
       "* Left of slash applies to the Predator's opposed check / error range; right of slash applies to the Prey's."
      ]
     }
    },
    "notes": [
     "Predator picks a mental or physical approach at the start; it changes only through the New Approach Advantage.",
     "Predator must be present for at least half of each round; the Prey is present throughout.",
     "Several participants form a Predator group and a Prey group; each group makes one cooperative opposed check per round.",
     "Each strategy names the skill used for that round's opposed check (\"skill\" field); alternate skill checks have no tags.",
     "Prey save-bonus requirements use base Will vs. a mental approach and base Fortitude vs. a physical approach.",
     "NPC career level, where a DC needs it, defaults to the team's current Threat Level.",
     "Altered memories can be undone by a Medicine/Therapy Complex Task: 5 Challenges, 1 hour each, DC 20 + brainwasher's Manipulate bonus; failure blocks further attempts this mission."
    ]
   },
   "hacking": {
    "name": "Hacking",
    "pages": [
     371,
     374
    ],
    "predator": "Invading user (hacker)",
    "prey": "Defending user / system operator",
    "predatorSkills": [
     "Computers (Int)"
    ],
    "preySkills": [
     "Computers (Int)"
    ],
    "predatorSkillTags": [
     "Concentration",
     "Hands-On",
     "Vision"
    ],
    "preySkillTags": [
     "Concentration",
     "Hands-On",
     "Vision"
    ],
    "roundTime": "Variable: set by current Lead, External vs. Internal Access and relative computer Power Ratings (see hackTiming tables)",
    "powerRatings": [
     "Computer Power Rating",
     "Security Power Rating"
    ],
    "startingLead": {
     "default": null,
     "summary": "Equal to the target system's Security Power Rating (maximum 9); with a previously installed back door, the Lead at which it was installed + 1.",
     "rules": [
      {
       "when": "Normal hack",
       "lead": null,
       "formula": "min(9, system Security Power Rating)"
      },
      {
       "when": "Predator has a back door in the system",
       "lead": null,
       "formula": "back door Lead + 1"
      }
     ]
    },
    "strategies": [
     {
      "id": "code-slinging",
      "name": "Code Slinging",
      "side": "general",
      "requirements": "",
      "leadMin": null,
      "leadMax": null,
      "ratings": [],
      "ratingsMode": null,
      "other": "",
      "modifier": 0,
      "advantages": [
       "Lead"
      ],
      "summary": "Standard techniques to erode or shore up security.",
      "note": "",
      "skill": ""
     },
     {
      "id": "l337-moves",
      "name": "'L337 Moves",
      "side": "general",
      "requirements": "Computer Power Rating 7+",
      "leadMin": null,
      "leadMax": null,
      "ratings": [
       {
        "rating": "Computer Power Rating",
        "min": 7
       }
      ],
      "ratingsMode": "all",
      "other": "",
      "modifier": 2,
      "advantages": [
       "Lead",
       "Stress"
      ],
      "summary": "Lean on superior hardware to grind the opponent down.",
      "note": "",
      "skill": ""
     },
     {
      "id": "master-cracker",
      "name": "Master Cracker",
      "side": "general",
      "requirements": "†",
      "leadMin": null,
      "leadMax": null,
      "ratings": [],
      "ratingsMode": null,
      "other": "master cracker class ability (see page 36)",
      "modifier": 0,
      "advantages": [
       "*"
      ],
      "summary": "Expert insight; winner spends 1 use of the class ability to pick any Advantages except Victory.",
      "note": "Printed as \"Any except Victory\".",
      "skill": ""
     },
     {
      "id": "phone-phreak",
      "name": "Phone Phreak",
      "side": "general",
      "requirements": "Trace software",
      "leadMin": null,
      "leadMax": null,
      "ratings": [],
      "ratingsMode": null,
      "other": "Trace software",
      "modifier": -4,
      "advantages": [
       "Lead",
       "Trace"
      ],
      "summary": "Study communications traffic to read the situation.",
      "note": "",
      "skill": "Electronics (Int)"
     },
     {
      "id": "play-through",
      "name": "Play Through",
      "side": "general",
      "requirements": "",
      "leadMin": null,
      "leadMax": null,
      "ratings": [],
      "ratingsMode": null,
      "other": "",
      "modifier": 0,
      "advantages": [
       "Elude"
      ],
      "summary": "Bounce through routing tricks to hide one's location.",
      "note": "",
      "skill": ""
     },
     {
      "id": "shall-we-play-a-game",
      "name": "“Shall We Play A Game?”",
      "side": "general",
      "requirements": "Computer Power Rating 3+, Probe software",
      "leadMin": null,
      "leadMax": null,
      "ratings": [
       {
        "rating": "Computer Power Rating",
        "min": 3
       }
      ],
      "ratingsMode": "all",
      "other": "Probe software",
      "modifier": -4,
      "advantages": [
       "Pause",
       "Probe"
      ],
      "summary": "Tie the opponent up in loops while trying a gambit elsewhere.",
      "note": "Requirement is split across two lines in the printed table.",
      "skill": "Tactics (Wis)"
     },
     {
      "id": "social-engineering",
      "name": "Social Engineering",
      "side": "general",
      "requirements": "Probe software",
      "leadMin": null,
      "leadMax": null,
      "ratings": [],
      "ratingsMode": null,
      "other": "Probe software",
      "modifier": -4,
      "advantages": [
       "Probe",
       "Stress"
      ],
      "summary": "Target the human operator instead of the machine.",
      "note": "",
      "skill": "Bureaucracy (Cha)"
     },
     {
      "id": "index-snatch",
      "name": "Index Snatch",
      "side": "predator",
      "requirements": "Lead 1–4",
      "leadMin": 1,
      "leadMax": 4,
      "ratings": [],
      "ratingsMode": null,
      "other": "",
      "modifier": -6,
      "advantages": [
       "Extract File",
       "Stress"
      ],
      "summary": "Pull a file out through an indirect, legitimate-looking request.",
      "note": "",
      "skill": ""
     },
     {
      "id": "insert-packet",
      "name": "Insert Packet",
      "side": "predator",
      "requirements": "Lead 1–3",
      "leadMin": 1,
      "leadMax": 3,
      "ratings": [],
      "ratingsMode": null,
      "other": "",
      "modifier": -8,
      "advantages": [
       "Pause",
       "Seize Control"
      ],
      "summary": "Plant a payload in an unused corner of the system.",
      "note": "",
      "skill": ""
     },
     {
      "id": "kernel-interrupt",
      "name": "Kernel Interrupt",
      "side": "predator",
      "requirements": "Lead 1–2",
      "leadMin": 1,
      "leadMax": 2,
      "ratings": [],
      "ratingsMode": null,
      "other": "",
      "modifier": -8,
      "advantages": [
       "Core Command",
       "Elude"
      ],
      "summary": "Grab brief control, then jump elsewhere in the system.",
      "note": "",
      "skill": ""
     },
     {
      "id": "magic-bullet",
      "name": "Magic Bullet",
      "side": "predator",
      "requirements": "Computer Power Rating 7+",
      "leadMin": null,
      "leadMax": null,
      "ratings": [
       {
        "rating": "Computer Power Rating",
        "min": 7
       }
      ],
      "ratingsMode": "all",
      "other": "",
      "modifier": -12,
      "advantages": [
       "Trace",
       "Victory"
      ],
      "summary": "Exploit a spotted weakness to find or beat the defender.",
      "note": "",
      "skill": ""
     },
     {
      "id": "trojan-file-marker",
      "name": "Trojan File Marker",
      "side": "predator",
      "requirements": "Computer Power Rating 4+",
      "leadMin": null,
      "leadMax": null,
      "ratings": [
       {
        "rating": "Computer Power Rating",
        "min": 4
       }
      ],
      "ratingsMode": "all",
      "other": "",
      "modifier": -4,
      "advantages": [
       "Back Door",
       "Lead"
      ],
      "summary": "Forge a quasi-legitimate entry point for later use.",
      "note": "",
      "skill": "Falsify (Int)"
     },
     {
      "id": "core-counter-measures",
      "name": "Core Counter-Measures",
      "side": "prey",
      "requirements": "Lead: 1–2",
      "leadMin": 1,
      "leadMax": 2,
      "ratings": [],
      "ratingsMode": null,
      "other": "",
      "modifier": -8,
      "advantages": [
       "Core Command",
       "Pause"
      ],
      "summary": "Throw the system's full strength at the intruder.",
      "note": "",
      "skill": ""
     },
     {
      "id": "hard-reboot",
      "name": "Hard Reboot",
      "side": "prey",
      "requirements": "Computer Power Rating 7+",
      "leadMin": null,
      "leadMax": null,
      "ratings": [
       {
        "rating": "Computer Power Rating",
        "min": 7
       }
      ],
      "ratingsMode": "all",
      "other": "",
      "modifier": -12,
      "advantages": [
       "Trace",
       "Victory"
      ],
      "summary": "Shut down all access before a breach lands.",
      "note": "",
      "skill": ""
     },
     {
      "id": "inverse-query",
      "name": "Inverse Query",
      "side": "prey",
      "requirements": "Lead: 6–9",
      "leadMin": 6,
      "leadMax": 9,
      "ratings": [],
      "ratingsMode": null,
      "other": "",
      "modifier": -6,
      "advantages": [
       "Extract File",
       "Lead"
      ],
      "summary": "Bait the intruder into trading information for continued access.",
      "note": "",
      "skill": ""
     },
     {
      "id": "security-alert",
      "name": "Security Alert",
      "side": "prey",
      "requirements": "Security Power Rating 4+",
      "leadMin": null,
      "leadMax": null,
      "ratings": [
       {
        "rating": "Security Power Rating",
        "min": 4
       }
      ],
      "ratingsMode": "all",
      "other": "",
      "modifier": -4,
      "advantages": [
       "Silhouette",
       "Stress"
      ],
      "summary": "Spread the intruder's profile across the system to harass him.",
      "note": "",
      "skill": "Security (Int)"
     },
     {
      "id": "virus-salvo",
      "name": "Virus Salvo",
      "side": "prey",
      "requirements": "Lead: 7–9",
      "leadMin": 7,
      "leadMax": 9,
      "ratings": [],
      "ratingsMode": null,
      "other": "",
      "modifier": -8,
      "advantages": [
       "Lead",
       "Seize Control"
      ],
      "summary": "Fire viruses to cripple or commandeer the intruder's machine.",
      "note": "",
      "skill": ""
     }
    ],
    "advantages": [
     {
      "id": "back-door",
      "name": "Back Door",
      "leadShift": 0,
      "victory": false,
      "summary": "Predator either removes one of the Prey's silhouettes or installs a back door at the current Lead.",
      "repeat": ""
     },
     {
      "id": "core-command",
      "name": "Core Command",
      "leadShift": 0,
      "victory": false,
      "summary": "Winner executes 1 core command on the target computer (not system purge, power down, or a network change that locks a user out).",
      "repeat": "Each further pick: 1 more core command.",
      "repeatEvery": 1
     },
     {
      "id": "elude",
      "name": "Elude",
      "leadShift": 0,
      "victory": false,
      "summary": "Trace software aimed at the winner has its Power Rating cut by 3 until the end of next round (never more than 3 total).",
      "repeat": "Each further pick extends the effect 1 more round.",
      "repeatEvery": 1
     },
     {
      "id": "extract-file",
      "name": "Extract File",
      "leadShift": 0,
      "victory": false,
      "summary": "Winner pulls 1 chosen file from an opponent's target computer; an unknown file name/location needs an Investigation/Research check, and overruns give -4 to hacking checks.",
      "repeat": "Every 2 further picks: 1 more file.",
      "repeatEvery": 2
     },
     {
      "id": "lead",
      "name": "Lead",
      "leadShift": 1,
      "victory": false,
      "summary": "Lead moves 1 point toward the winner.",
      "repeat": "Every 2 further picks in the round move Lead 1 more point toward the winner.",
      "repeatEvery": 2
     },
     {
      "id": "pause",
      "name": "Pause",
      "leadShift": 0,
      "victory": false,
      "summary": "Conflict freezes: Lead stays put and no steps resolve next round.",
      "repeat": "Each further pick adds 1 more paused round.",
      "repeatEvery": 1
     },
     {
      "id": "probe",
      "name": "Probe",
      "leadShift": 0,
      "victory": false,
      "summary": "A chosen opponent makes a Computers (Int) check, DC 10 + 5 x winner's Probe software Power Rating; on failure the winner runs 1 core command. Opponent may skip the check, giving the winner 2 Lead.",
      "repeat": "Each further pick raises the DC by 5.",
      "repeatEvery": 1,
      "skipLeadShift": 2
     },
     {
      "id": "seize-control",
      "name": "Seize Control",
      "leadShift": 0,
      "victory": false,
      "summary": "Winner makes the target computer run or stop 1 program stored on either machine, or takes over 1 controlled device until Step 2 of next round.",
      "repeat": "Each further pick: control of 1 more program or device.",
      "repeatEvery": 1
     },
     {
      "id": "silhouette",
      "name": "Silhouette",
      "leadShift": 0,
      "victory": false,
      "summary": "Prey either deletes one of the Predator's back doors or builds a profile silhouette; each silhouette gives a cumulative +1 on hacking opposed checks against that Predator for the mission.",
      "repeat": ""
     },
     {
      "id": "stress",
      "name": "Stress",
      "leadShift": 0,
      "victory": false,
      "summary": "Everyone except the winner takes 1d4 stress damage that cannot be recovered until the hacking attempt ends.",
      "repeat": "Each further pick adds +1d4 stress damage.",
      "repeatEvery": 1
     },
     {
      "id": "trace",
      "name": "Trace",
      "leadShift": 0,
      "victory": false,
      "summary": "A chosen opponent makes a Computers (Int) check, DC 10 + 5 x winner's Trace software Power Rating; on failure his physical location is found and a winning Prey may end the hack in his favor. Skipping gives the winner 2 Lead.",
      "repeat": "Each further pick raises the DC by 5.",
      "repeatEvery": 1,
      "skipLeadShift": 2,
      "canEndConflict": true
     },
     {
      "id": "victory",
      "name": "Victory",
      "leadShift": 0,
      "victory": true,
      "summary": "Conflict ends immediately in the winner's favor.",
      "repeat": ""
     }
    ],
    "victory": {
     "predator": "Hacker gains full control and may use any core command freely; the former defender must hack the system back as Predator to retake it.",
     "prey": "Intruder is locked out and cannot hack this system again this mission."
    },
    "outsideActions": "Not detailed separately; when run alongside combat, Step 4 is spread over the combat round with each participant acting on his Initiative Count.",
    "tables": {
     "hackTiming": {
      "title": "Table 6.6: Hack Timing",
      "page": 371,
      "columns": [
       "Lead",
       "External Access",
       "Internal Access"
      ],
      "rows": [
       [
        1,
        "1 round",
        "1 round"
       ],
       [
        2,
        "5 rounds",
        "2 rounds"
       ],
       [
        3,
        "2 minutes",
        "5 rounds"
       ],
       [
        4,
        "8 minutes",
        "1 minute"
       ],
       [
        5,
        "30 minutes",
        "2 minutes"
       ],
       [
        6,
        "2 hours",
        "5 minutes"
       ],
       [
        7,
        "1 day",
        "10 minutes"
       ],
       [
        8,
        "4 days",
        "20 minutes"
       ],
       [
        9,
        "15 days",
        "1 hour"
       ]
      ],
      "notes": [
       "Round duration by current Lead and access type; multiply by the Relative Power Ratings factor (hackTimingRelativePower). Both sides must be involved for at least half this time (rounded down, minimum 1 round)."
      ]
     },
     "hackTimingRelativePower": {
      "title": "Table 6.6: Hack Timing (Relative Power Ratings)",
      "page": 371,
      "columns": [
       "Relative Power Ratings",
       "External Access",
       "Internal Access"
      ],
      "rows": [
       [
        "Predator +5 or more",
        "×1/5*",
        "×1/5*"
       ],
       [
        "Predator +4",
        "×1/4*",
        "×1/4*"
       ],
       [
        "Predator +3",
        "×1/3*",
        "×1/3*"
       ],
       [
        "Predator +2",
        "×1/2*",
        "×1/2*"
       ],
       [
        "Predator +1",
        "×2/3*",
        "×2/3*"
       ],
       [
        "Equal",
        "×1",
        "×1"
       ],
       [
        "Prey +1",
        "×1.5*",
        "×1.5*"
       ],
       [
        "Prey +2",
        "×2",
        "×2"
       ],
       [
        "Prey +3",
        "×3",
        "×3"
       ],
       [
        "Prey +4",
        "×4",
        "×4"
       ],
       [
        "Prey +5 or more",
        "×5",
        "×5"
       ]
      ],
      "notes": [
       "* Rounded up (minimum 1 half action)."
      ]
     },
     "coreCommands": {
      "title": "Core Commands (text list, not a numbered table)",
      "page": 374,
      "columns": [
       "Core Command",
       "Time"
      ],
      "rows": [
       [
        "Alter/Delete Records",
        "Per Falsify/Forgery"
       ],
       [
        "Authorize/Restrict User",
        "1 full action"
       ],
       [
        "Change Network Structure",
        "1 full action"
       ],
       [
        "Delete Program",
        "1 full action"
       ],
       [
        "Execute Program",
        "1 full action"
       ],
       [
        "Extract File",
        "Varies"
       ],
       [
        "Initiate System Purge",
        "Varies"
       ],
       [
        "Power Down",
        "1 full action"
       ],
       [
        "Search System",
        "Varies"
       ],
       [
        "Upload Program",
        "Varies"
       ],
       [
        "Use Peripheral",
        "Per Device Use"
       ],
       [
        "View File",
        "Varies"
       ]
      ],
      "notes": [
       "Extract File / Upload Program: full rounds = Complexity DC / lowest Power Rating of the two computers (rounded down, minimum 1); unknown Complexity DC is GC-assigned, 10 to 60.",
       "Initiate System Purge: 1 minute + 1 minute per foreign program whose Power Rating exceeds the system's.",
       "Search System: 1 full action to start, then time per Table 2.33: Research Checks; no check needed; one system per use.",
       "Use Peripheral: -4 on any separate skill check for remote operation.",
       "View File: 1 half action to open; read 1 page per full round + 1 per point of Intelligence and of Wisdom above 10."
      ]
     }
    },
    "notes": [
     "Unmonitored system (or streamlined variant at GC option): a Complex Task with Challenges = system Power Rating, Computers (Int) DC = known Sys-Op's Computers bonus + 10, or Threat Level + 15 if none.",
     "External Access is any indirect connection; Internal Access is a terminal wired straight into the system and is much faster.",
     "A terminal on the target system is assumed to have Power Rating = system's - 2 (minimum 1) unless stated otherwise.",
     "Several participants form a Predator group and a Prey group; each makes one cooperative opposed check per round.",
     "A blank \"skill\" means the default Computers (Int); alternate skill checks have no tags.",
     "Software requirements (Trace, Probe) are recorded in \"other\". Probe/Trace DCs scale with the winner's software Power Rating.",
     "Back doors set the starting Lead of later hacks; silhouettes give the defender a cumulative +1 per silhouette against that hacker for the mission. Each can be spent to erase the other.",
     "A successful trace by the Prey can end the hack in his favor and is enough to start a manhunt.",
     "With simultaneous combat: Step 1 before the first Initiative Count, Steps 2-3 at the Predator's count.",
     "Master Cracker winner spends 1 use of the class ability to choose any 1 Advantage, +1 per 4 margin, never Victory."
    ]
   },
   "infiltration": {
    "name": "Infiltration",
    "pages": [
     375,
     379
    ],
    "predator": "Infiltrating character(s)",
    "prey": "Target organization (its security)",
    "predatorSkills": [
     "Bureaucracy (Int)"
    ],
    "preySkills": [
     "Security (Int)"
    ],
    "predatorSkillTags": [
     "Bribe",
     "Disposition",
     "Language"
    ],
    "preySkillTags": [],
    "roundTime": "4 hours (high profile approach) or 2 days (low profile approach); see infiltrationApproaches table",
    "powerRatings": [
     "Cover Identity Power Rating",
     "Organization Goals Rating"
    ],
    "startingLead": {
     "default": null,
     "summary": "Organization's Image Rating if the Predator opens low profile; its History Rating if he opens high profile.",
     "rules": [
      {
       "when": "Predator opens with a low profile approach",
       "lead": null,
       "formula": "organization Image Rating"
      },
      {
       "when": "Predator opens with a high profile approach",
       "lead": null,
       "formula": "organization History Rating"
      }
     ]
    },
    "strategies": [
     {
      "id": "after-hours",
      "name": "After Hours",
      "side": "predator",
      "requirements": "Cover Identity Power Rating 3+",
      "leadMin": null,
      "leadMax": null,
      "ratings": [
       {
        "rating": "Cover Identity Power Rating",
        "min": 3
       }
      ],
      "ratingsMode": "all",
      "other": "",
      "modifier": -4,
      "advantages": [
       "Access Point",
       "Reconnaissance"
      ],
      "summary": "Slip into the facilities during a quiet period.",
      "note": "",
      "skill": "Sneak (Dex)"
     },
     {
      "id": "bald-faced-lie",
      "name": "Bald-Faced Lie",
      "side": "predator",
      "requirements": "†",
      "leadMin": null,
      "leadMax": null,
      "ratings": [],
      "ratingsMode": null,
      "other": "bald-faced lie class ability (see page 35)",
      "modifier": 0,
      "advantages": [
       "*"
      ],
      "summary": "Outrageous but convincing lies; winner spends 1 use of the class ability to pick any Advantages except Victory.",
      "note": "Printed as \"Any except Victory\".",
      "skill": ""
     },
     {
      "id": "break-in",
      "name": "Break-In",
      "side": "predator",
      "requirements": "Lead 1–3∆",
      "leadMin": 1,
      "leadMax": 3,
      "ratings": [],
      "ratingsMode": null,
      "other": "Predator must currently be using a high profile approach",
      "modifier": -6,
      "advantages": [
       "Raid"
      ],
      "summary": "Use inside knowledge to hit the organization's guarded assets.",
      "note": "",
      "skill": "Security (Int)"
     },
     {
      "id": "change-of-pace",
      "name": "Change of Pace",
      "side": "predator",
      "requirements": "Lead 7–9",
      "leadMin": 7,
      "leadMax": 9,
      "ratings": [],
      "ratingsMode": null,
      "other": "",
      "modifier": -4,
      "advantages": [
       "Extraction",
       "New Approach"
      ],
      "summary": "Drop out of sight after a showy stint, or step into the spotlight.",
      "note": "",
      "skill": ""
     },
     {
      "id": "data-run",
      "name": "Data Run",
      "side": "predator",
      "requirements": "Cover Identity Power Rating 4+",
      "leadMin": null,
      "leadMax": null,
      "ratings": [
       {
        "rating": "Cover Identity Power Rating",
        "min": 4
       }
      ],
      "ratingsMode": "all",
      "other": "",
      "modifier": -8,
      "advantages": [
       "Access Point",
       "Intelligence"
      ],
      "summary": "Risky grab for more information about the organization.",
      "note": "",
      "skill": ""
     },
     {
      "id": "haven",
      "name": "Haven",
      "side": "predator",
      "requirements": "Cover Identity Power Rating 3+",
      "leadMin": null,
      "leadMax": null,
      "ratings": [
       {
        "rating": "Cover Identity Power Rating",
        "min": 3
       }
      ],
      "ratingsMode": "all",
      "other": "",
      "modifier": -4,
      "advantages": [
       "Fade",
       "Pause"
      ],
      "summary": "Retreat to a prepared bolt-hole or routine to lie low.",
      "note": "",
      "skill": ""
     },
     {
      "id": "murder-scheme",
      "name": "Murder Scheme",
      "side": "predator",
      "requirements": "Cover Identity Power Rating 5+",
      "leadMin": null,
      "leadMax": null,
      "ratings": [
       {
        "rating": "Cover Identity Power Rating",
        "min": 5
       }
      ],
      "ratingsMode": "all",
      "other": "",
      "modifier": -6,
      "advantages": [
       "Conspiracy",
       "Showdown"
      ],
      "summary": "Use position and inside allies to set up a hit on a key figure.",
      "note": "",
      "skill": ""
     },
     {
      "id": "quick-peek",
      "name": "Quick Peek",
      "side": "predator",
      "requirements": "Lead 4–6",
      "leadMin": 4,
      "leadMax": 6,
      "ratings": [],
      "ratingsMode": null,
      "other": "",
      "modifier": -2,
      "advantages": [
       "Extraction",
       "Reconnaissance"
      ],
      "summary": "Gather a little intelligence and get out.",
      "note": "",
      "skill": ""
     },
     {
      "id": "risky-declaration",
      "name": "Risky Declaration",
      "side": "predator",
      "requirements": "Cover Identity Power Rating 4+∆",
      "leadMin": null,
      "leadMax": null,
      "ratings": [
       {
        "rating": "Cover Identity Power Rating",
        "min": 4
       }
      ],
      "ratingsMode": "all",
      "other": "Predator must currently be using a high profile approach",
      "modifier": -8,
      "advantages": [
       "Crisis"
      ],
      "summary": "Stage a scene to prove devotion and earn deep trust.",
      "note": "",
      "skill": "Impress (Cha)"
     },
     {
      "id": "rotten-apples",
      "name": "Rotten Apples",
      "side": "predator",
      "requirements": "Cover Identity Power Rating 6+",
      "leadMin": null,
      "leadMax": null,
      "ratings": [
       {
        "rating": "Cover Identity Power Rating",
        "min": 6
       }
      ],
      "ratingsMode": "all",
      "other": "",
      "modifier": -2,
      "advantages": [
       "Lead",
       "Conspiracy"
      ],
      "summary": "Cultivate disloyal members into an inside power base.",
      "note": "",
      "skill": "Manipulate (Cha)"
     },
     {
      "id": "rush-job",
      "name": "Rush Job",
      "side": "predator",
      "requirements": "Cover Identity Power Rating 5+",
      "leadMin": null,
      "leadMax": null,
      "ratings": [
       {
        "rating": "Cover Identity Power Rating",
        "min": 5
       }
      ],
      "ratingsMode": "all",
      "other": "",
      "modifier": -6,
      "advantages": [
       "Lead",
       "Haste"
      ],
      "summary": "Speed things up to gain ground fast.",
      "note": "",
      "skill": ""
     },
     {
      "id": "show-of-loyalty",
      "name": "Show of Loyalty",
      "side": "predator",
      "requirements": "",
      "leadMin": null,
      "leadMax": null,
      "ratings": [],
      "ratingsMode": null,
      "other": "",
      "modifier": 0,
      "advantages": [
       "Lead",
       "Transfer"
      ],
      "summary": "Curry favor with the leadership to rise through the ranks.",
      "note": "",
      "skill": ""
     },
     {
      "id": "step-out",
      "name": "Step Out",
      "side": "predator",
      "requirements": "Cover Identity Power Rating 2+",
      "leadMin": null,
      "leadMax": null,
      "ratings": [
       {
        "rating": "Cover Identity Power Rating",
        "min": 2
       }
      ],
      "ratingsMode": "all",
      "other": "",
      "modifier": -4,
      "advantages": [
       "Free Time",
       "Lead"
      ],
      "summary": "Shake any watchers to meet allies outside.",
      "note": "",
      "skill": ""
     },
     {
      "id": "background-checks",
      "name": "Background Checks",
      "side": "prey",
      "requirements": "Organization Goals Rating 3+",
      "leadMin": null,
      "leadMax": null,
      "ratings": [
       {
        "rating": "Organization Goals Rating",
        "min": 3
       }
      ],
      "ratingsMode": "all",
      "other": "",
      "modifier": -6,
      "advantages": [
       "Lead",
       "Shred"
      ],
      "summary": "Vet recent recruits, attacking the infiltrator's cover.",
      "note": "",
      "skill": ""
     },
     {
      "id": "before-i-kill-you",
      "name": "“Before I Kill You…”",
      "side": "prey",
      "requirements": "††",
      "leadMin": null,
      "leadMax": null,
      "ratings": [],
      "ratingsMode": null,
      "other": "big brother or global search class ability (see pages 46 and 48)",
      "modifier": 0,
      "advantages": [
       "*"
      ],
      "summary": "Security toys with the intruder; winner spends 1 use of the class ability to pick any Advantages except Victory.",
      "note": "Printed as \"Any except Victory\".",
      "skill": ""
     },
     {
      "id": "counter-intelligence",
      "name": "Counter-Intelligence",
      "side": "prey",
      "requirements": "",
      "leadMin": null,
      "leadMax": null,
      "ratings": [],
      "ratingsMode": null,
      "other": "",
      "modifier": 0,
      "advantages": [
       "Lead"
      ],
      "summary": "Security experts pick up the scent and build a file.",
      "note": "",
      "skill": ""
     },
     {
      "id": "heightened-security",
      "name": "Heightened Security",
      "side": "prey",
      "requirements": "Organization Goals Rating 2+",
      "leadMin": null,
      "leadMax": null,
      "ratings": [
       {
        "rating": "Organization Goals Rating",
        "min": 2
       }
      ],
      "ratingsMode": "all",
      "other": "",
      "modifier": -2,
      "advantages": [
       "Haste",
       "Stress"
      ],
      "summary": "Tighten measures to flush out moles.",
      "note": "",
      "skill": ""
     },
     {
      "id": "inner-circle-trial",
      "name": "Inner Circle Trial",
      "side": "prey",
      "requirements": "Lead 1–3**",
      "leadMin": 1,
      "leadMax": 3,
      "ratings": [],
      "ratingsMode": null,
      "other": "",
      "modifier": -8,
      "advantages": [
       "Crisis",
       "Stress"
      ],
      "summary": "A final loyalty test before admission to the core.",
      "note": "Printed footnote mark ** only points to the organization Ratings reference; it may be a misprint for the high-profile mark. See anomalies.",
      "skill": "Manipulate (Wis)"
     },
     {
      "id": "lockdown",
      "name": "Lockdown",
      "side": "prey",
      "requirements": "Organization Goals Rating 4+",
      "leadMin": null,
      "leadMax": null,
      "ratings": [
       {
        "rating": "Organization Goals Rating",
        "min": 4
       }
      ],
      "ratingsMode": "all",
      "other": "",
      "modifier": -4,
      "advantages": [
       "Lead",
       "Pause"
      ],
      "summary": "Suspend non-essential activity to limit access.",
      "note": "",
      "skill": "Search (Int)"
     },
     {
      "id": "mantrap",
      "name": "Mantrap",
      "side": "prey",
      "requirements": "Lead 7-9",
      "leadMin": 7,
      "leadMax": 9,
      "ratings": [],
      "ratingsMode": null,
      "other": "",
      "modifier": -6,
      "advantages": [
       "Crisis",
       "Showdown"
      ],
      "summary": "Engineer an incident aimed at a specific suspect.",
      "note": "",
      "skill": ""
     },
     {
      "id": "new-procedures",
      "name": "New Procedures",
      "side": "prey",
      "requirements": "Organization Goals Rating 6+",
      "leadMin": null,
      "leadMax": null,
      "ratings": [
       {
        "rating": "Organization Goals Rating",
        "min": 6
       }
      ],
      "ratingsMode": "all",
      "other": "",
      "modifier": -8,
      "advantages": [
       "New Approach",
       "Pause"
      ],
      "summary": "Change routines, possibly forcing the infiltrator into a new role.",
      "note": "",
      "skill": ""
     },
     {
      "id": "restructuring",
      "name": "Restructuring",
      "side": "prey",
      "requirements": "Organization Goals Rating 5+",
      "leadMin": null,
      "leadMax": null,
      "ratings": [
       {
        "rating": "Organization Goals Rating",
        "min": 5
       }
      ],
      "ratingsMode": "all",
      "other": "",
      "modifier": -6,
      "advantages": [
       "Relocate"
      ],
      "summary": "Reorganize, potentially undoing the infiltrator's progress.",
      "note": "",
      "skill": ""
     },
     {
      "id": "rising-quotas",
      "name": "Rising Quotas",
      "side": "prey",
      "requirements": "Organization Goals Rating 4+",
      "leadMin": null,
      "leadMax": null,
      "ratings": [
       {
        "rating": "Organization Goals Rating",
        "min": 4
       }
      ],
      "ratingsMode": "all",
      "other": "",
      "modifier": -2,
      "advantages": [
       "Stress"
      ],
      "summary": "Increase workload so members have little spare time.",
      "note": "",
      "skill": ""
     },
     {
      "id": "run-of-the-house",
      "name": "Run of the House",
      "side": "prey",
      "requirements": "Organization Goals Rating 3+∆",
      "leadMin": null,
      "leadMax": null,
      "ratings": [
       {
        "rating": "Organization Goals Rating",
        "min": 3
       }
      ],
      "ratingsMode": "all",
      "other": "Predator must currently be using a high profile approach",
      "modifier": -4,
      "advantages": [
       "Convert",
       "Revelation"
      ],
      "summary": "Give suspected infiltrators free rein, hoping they slip.",
      "note": "",
      "skill": "Impress (Cha)"
     },
     {
      "id": "security-sweep",
      "name": "Security Sweep",
      "side": "prey",
      "requirements": "Lead 4–6",
      "leadMin": 4,
      "leadMax": 6,
      "ratings": [],
      "ratingsMode": null,
      "other": "",
      "modifier": -4,
      "advantages": [
       "Showdown"
      ],
      "summary": "Routine sweep that may catch the infiltrator off guard.",
      "note": "",
      "skill": ""
     },
     {
      "id": "show-of-strength",
      "name": "Show of Strength",
      "side": "prey",
      "requirements": "Organization Goals Rating 5+",
      "leadMin": null,
      "leadMax": null,
      "ratings": [
       {
        "rating": "Organization Goals Rating",
        "min": 5
       }
      ],
      "ratingsMode": "all",
      "other": "",
      "modifier": -4,
      "advantages": [
       "Convert",
       "Stress"
      ],
      "summary": "Display of money, ideology, leverage and flattery that may win the infiltrator over.",
      "note": "",
      "skill": "Bluff (Cha)"
     }
    ],
    "advantages": [
     {
      "id": "access-point",
      "name": "Access Point",
      "leadShift": 0,
      "victory": false,
      "summary": "Predator finds an unwatched terminal and may hack the organization's system with Internal Access for up to 1 hour.",
      "repeat": "Every 2 further picks: 1 more hour (maximum 4 hours).",
      "repeatEvery": 2
     },
     {
      "id": "conspiracy",
      "name": "Conspiracy",
      "leadShift": 0,
      "victory": false,
      "summary": "Predator makes an Impress (Cha) check, DC 10 + 5 x organization History Rating, to turn 1 standard NPC or minion squad neutral so it sits out fights and chases this mission. On failure Lead increases by 1.",
      "repeat": "Each further pick: 1 more target, or shift an already neutral target to Friendly (it then fights alongside the Predator).",
      "repeatEvery": 1
     },
     {
      "id": "convert",
      "name": "Convert",
      "leadShift": 0,
      "victory": false,
      "summary": "Prey starts or advances a seduction Conflict against the Predator by 1 round per pick, using 2 x its higher of Image/Tools Rating as skill bonus. If it wins, the Predator serves it until he passes an end-of-scene Will save (DC = Prey's Impress bonus).",
      "repeat": "",
      "nestedConflict": "seduction"
     },
     {
      "id": "crisis",
      "name": "Crisis",
      "leadShift": 0,
      "victory": false,
      "summary": "Predator rolls Impress (Cha) vs. DC 25 + organization's two highest Ratings; Prey rolls Security (Int) vs. DC 25 + Predator's career level. If exactly one fails, the other wins. A side may skip its check, giving the opponent 3 Lead.",
      "repeat": "Each further pick lowers the winner's own Crisis DC by 4 (minimum 20).",
      "repeatEvery": 1,
      "skipLeadShift": 3,
      "canEndConflict": true
     },
     {
      "id": "extraction",
      "name": "Extraction",
      "leadShift": 0,
      "victory": false,
      "summary": "Predator leaves the organization cleanly; the Prey cannot trigger any events in response.",
      "repeat": ""
     },
     {
      "id": "fade",
      "name": "Fade",
      "leadShift": 0,
      "victory": false,
      "summary": "Predator's lowest cover identity gains 1 Power Rating (maximum 7); with no cover identity he gains one at Power Rating 2.",
      "repeat": "Every 2 further picks: +1 more to the lowest identity.",
      "repeatEvery": 2
     },
     {
      "id": "free-time",
      "name": "Free Time",
      "leadShift": 0,
      "victory": false,
      "summary": "Predator is unobserved for 1 hour. If he leaves and is late back, he needs Bluff (Cha) DC 20 + 4 x Goals Rating or the Prey wins and gains action dice equal to Lead for hostile events.",
      "repeat": "Every 2 further picks: 1 more hour (maximum 3 hours).",
      "repeatEvery": 2,
      "canEndConflict": true
     },
     {
      "id": "haste",
      "name": "Haste",
      "leadShift": 0,
      "victory": false,
      "summary": "Next Conflict round takes half the standard time (rounded down, minimum 5 minutes).",
      "repeat": "Each further pick halves the duration again.",
      "repeatEvery": 1
     },
     {
      "id": "intelligence",
      "name": "Intelligence",
      "leadShift": 0,
      "victory": false,
      "summary": "Predator learns 1 item: an unknown goal (Prey's pick), the full history, or the Origin, attributes, qualities, feats and class abilities of 1 player/special character (Prey's pick).",
      "repeat": "Every 2 further picks: 1 more item.",
      "repeatEvery": 2
     },
     {
      "id": "lead",
      "name": "Lead",
      "leadShift": 1,
      "victory": false,
      "summary": "Lead moves 1 point toward the winner.",
      "repeat": "Every 2 further picks in the round move Lead 1 more point toward the winner.",
      "repeatEvery": 2
     },
     {
      "id": "new-approach",
      "name": "New Approach",
      "leadShift": 0,
      "victory": false,
      "summary": "Predator's approach flips between high profile and low profile.",
      "repeat": ""
     },
     {
      "id": "pause",
      "name": "Pause",
      "leadShift": 0,
      "victory": false,
      "summary": "Conflict freezes: Lead stays put and no steps resolve next round, though Step 4 actions still happen.",
      "repeat": "Each further pick adds 1 more paused round.",
      "repeatEvery": 1
     },
     {
      "id": "raid",
      "name": "Raid",
      "leadShift": 0,
      "victory": false,
      "summary": "Predator steals or destroys 1 Site benefit at his location, then must escape; Prey gains action dice equal to current Lead usable only for Surprise Chase, Surprise Combat or Wanted events against him.",
      "repeat": ""
     },
     {
      "id": "reconnaissance",
      "name": "Reconnaissance",
      "leadShift": 0,
      "victory": false,
      "summary": "Predator learns 1 item (Prey chooses which): an unknown Site's location and nature, an unknown Rating, or the full stat block of 1 standard character.",
      "repeat": "Every 2 further picks: 1 more item.",
      "repeatEvery": 2
     },
     {
      "id": "relocate",
      "name": "Relocate",
      "leadShift": 0,
      "victory": false,
      "summary": "Prey moves 1 of its Sites to a location the Predator does not know.",
      "repeat": "Every 2 further picks: 1 more Site moved.",
      "repeatEvery": 2
     },
     {
      "id": "revelation",
      "name": "Revelation",
      "leadShift": 0,
      "victory": false,
      "summary": "Prey may voluntarily disclose 1 fact (history, unknown goal, unknown Rating, unknown Site, a special character's details, or a standard character's stat block) to gain 1 bonus action die.",
      "repeat": "Each further pick: 1 more disclosure for 1 more bonus action die.",
      "repeatEvery": 1
     },
     {
      "id": "showdown",
      "name": "Showdown",
      "leadShift": 0,
      "victory": false,
      "summary": "Predator fights 1 special NPC (plus 1 minion squad if available). If all are captured or killed the infiltration continues with Lead +2; otherwise the Prey wins, the Predator must flee, and the Prey gains action dice equal to Lead for hostile events.",
      "repeat": "",
      "canEndConflict": true
     },
     {
      "id": "shred",
      "name": "Shred",
      "leadShift": 0,
      "victory": false,
      "summary": "The Predator's lowest-rated cover identity loses 1 Power Rating; at 0 the identity is blown.",
      "repeat": "Every 2 further picks remove 1 more point, rolling over to the next-lowest identity if one hits 0.",
      "repeatEvery": 2
     },
     {
      "id": "stress",
      "name": "Stress",
      "leadShift": 0,
      "victory": false,
      "summary": "Everyone except the winner takes 1d4 stress damage that cannot be recovered until the infiltration ends.",
      "repeat": "Each further pick adds +1d4 stress damage.",
      "repeatEvery": 1
     },
     {
      "id": "transfer",
      "name": "Transfer",
      "leadShift": 0,
      "victory": false,
      "summary": "Predator learns the location of 1 known Site (or the HQ if all are located) and may arrange a transfer to any known Site.",
      "repeat": "Every 3 further picks: location of 1 more known Site.",
      "repeatEvery": 3
     }
    ],
    "victory": {
     "predator": "Predator learns all Ratings, goals, standard NPC stats and special NPC code names, then picks one: stay embedded with ongoing access (new Conflicts restart at Lead 2), steal/destroy a Site benefit and escape (cover blown), or ambush the mastermind (quick) or another special NPC (slow).",
     "prey": "All the Predator's cover identities are blown and he cannot re-infiltrate this mission. Prey picks one: eject him (with possible legal action: -4 Reputation or -$200,000 Net Worth), string him along (Lead reset to 8, +1 error range, 2 action dice; cumulative), or launch a slow ambush with 4 free action dice."
    },
    "outsideActions": "At the end of each round the Predator may contact the outside world; each 5 minutes (or part) of contact gives the Prey +4 on next round's opposed check.",
    "tables": {
     "infiltrationApproaches": {
      "title": "Table 6.8: Infiltration Approaches",
      "page": 375,
      "columns": [
       "Approach",
       "Conflict Round Duration",
       "Check Modifiers*",
       "Error Range Modifiers*"
      ],
      "rows": [
       [
        "High Profile",
        "4 hours",
        "-2/+0",
        "+1/+0"
       ],
       [
        "Low Profile",
        "2 days",
        "+0/-2",
        "+0/+0"
       ]
      ],
      "notes": [
       "* Left of slash applies to the Predator's opposed check / error range; right of slash applies to the Prey's."
      ]
     }
    },
    "notes": [
     "Organization's Security skill bonus = 2 x its Sites or Tools Rating, whichever is higher.",
     "Predator picks a high or low profile approach at the start; it changes only through the New Approach Advantage. Strategies with the high-profile restriction list it in \"other\".",
     "Predator must be present for the whole round; the Prey only for half of it.",
     "Multiple infiltrators form one Predator group and multiple defenders one Prey group; each group makes one cooperative opposed check per round.",
     "A blank \"skill\" means the default skill (Bureaucracy for Predator, Security for Prey); alternate skill checks have no tags.",
     "Lead here measures the organization's suspicion: it rises toward discovery and falls as the infiltrator burrows deeper.",
     "This Conflict has no Victory Advantage; it ends only by Lead, Crisis, Showdown, Free Time failure, Extraction or Raid.",
     "Bald-Faced Lie and “Before I Kill You…” winners spend 1 use of the relevant class ability to choose any 1 Advantage, +1 per 4 margin.",
     "The book suggests expanding rounds into full roleplayed scenes rather than streamlining this Conflict."
    ]
   },
   "interrogation": {
    "name": "Interrogation",
    "pages": [
     380,
     382
    ],
    "predator": "Interrogator(s)",
    "prey": "Subject(s) holding the information",
    "predatorSkills": [
     "Intimidate (Str or Wis)"
    ],
    "preySkills": [
     "Resolve (Wis)"
    ],
    "predatorSkillTags": [
     "Bribe",
     "Disposition",
     "Language"
    ],
    "preySkillTags": [],
    "roundTime": "Set by the Predator's Strategy (5 minutes to 1 hour), multiplied by the situation factor in interrogationModifiers",
    "powerRatings": [
     "Base Will Save"
    ],
    "startingLead": {
     "default": 5,
     "summary": "Set by how risky answering is for the Prey (Table 6.10): 3 for no risk up to 7 for deadly risk.",
     "rules": [
      {
       "when": "Risk of answering: None",
       "lead": 3
      },
      {
       "when": "Risk: Slight",
       "lead": 4
      },
      {
       "when": "Risk: Moderate",
       "lead": 5
      },
      {
       "when": "Risk: Extreme",
       "lead": 6
      },
      {
       "when": "Risk: Deadly",
       "lead": 7
      },
      {
       "when": "Same Predator previously beat this Prey this mission",
       "lead": null,
       "formula": "table value - 2 (minimum 1)"
      }
     ]
    },
    "strategies": [
     {
      "id": "head-fake",
      "name": "Head Fake",
      "side": "general",
      "requirements": "Base Will Save +6†",
      "leadMin": null,
      "leadMax": null,
      "ratings": [
       {
        "rating": "Base Will Save",
        "min": 6
       }
      ],
      "ratingsMode": "all",
      "other": "Predator's base Will save bonus counts as +1 higher per clue he holds showing the Prey has vital information",
      "modifier": -2,
      "advantages": [
       "Lead",
       "Slip"
      ],
      "summary": "Elaborate mind game meant to trip the opponent up.",
      "note": "Listed duration applies only when the Predator chooses this Strategy.",
      "skill": "Manipulate (Wis)",
      "roundDuration": "30 minutes"
     },
     {
      "id": "moment-of-crisis",
      "name": "Moment of Crisis",
      "side": "general",
      "requirements": "Lead 1–3",
      "leadMin": 1,
      "leadMax": 3,
      "ratings": [],
      "ratingsMode": null,
      "other": "",
      "modifier": -6,
      "advantages": [
       "Crisis"
      ],
      "summary": "High-pressure push to force an outcome.",
      "note": "Listed duration applies only when the Predator chooses this Strategy.",
      "skill": "",
      "roundDuration": "5 minutes"
     },
     {
      "id": "waiting-game",
      "name": "Waiting Game",
      "side": "general",
      "requirements": "",
      "leadMin": null,
      "leadMax": null,
      "ratings": [],
      "ratingsMode": null,
      "other": "",
      "modifier": 0,
      "advantages": [
       "Pause",
       "Stress"
      ],
      "summary": "Settle in for a long session, waiting on outside developments.",
      "note": "Listed duration applies only when the Predator chooses this Strategy.",
      "skill": "",
      "roundDuration": "1 hour"
     },
     {
      "id": "were-done-here",
      "name": "“We’re Done Here”",
      "side": "general",
      "requirements": "Base Will Save +7†",
      "leadMin": null,
      "leadMax": null,
      "ratings": [
       {
        "rating": "Base Will Save",
        "min": 7
       }
      ],
      "ratingsMode": "all",
      "other": "Predator's base Will save bonus counts as +1 higher per clue he holds showing the Prey has vital information",
      "modifier": -12,
      "advantages": [
       "Stress",
       "Victory"
      ],
      "summary": "Angrily push past the limit for an immediate finish.",
      "note": "Listed duration applies only when the Predator chooses this Strategy.",
      "skill": "",
      "roundDuration": "15 minutes"
     },
     {
      "id": "bad-cop",
      "name": "Bad Cop",
      "side": "predator",
      "requirements": "Base Will Save +4†",
      "leadMin": null,
      "leadMax": null,
      "ratings": [
       {
        "rating": "Base Will Save",
        "min": 4
       }
      ],
      "ratingsMode": "all",
      "other": "Predator's base Will save bonus counts as +1 higher per clue he holds showing the Prey has vital information",
      "modifier": 0,
      "advantages": [
       "Lead",
       "Stress"
      ],
      "summary": "Lean on authority or menace to rattle the subject.",
      "note": "",
      "skill": "",
      "roundDuration": "15 minutes"
     },
     {
      "id": "goad",
      "name": "Goad",
      "side": "predator",
      "requirements": "",
      "leadMin": null,
      "leadMax": null,
      "ratings": [],
      "ratingsMode": null,
      "other": "",
      "modifier": -4,
      "advantages": [
       "Slip"
      ],
      "summary": "Repeat questions and pick apart inconsistencies.",
      "note": "",
      "skill": "Investigation (Wis)",
      "roundDuration": "1 hour"
     },
     {
      "id": "good-cop",
      "name": "Good Cop",
      "side": "predator",
      "requirements": "Base Will Save +5",
      "leadMin": null,
      "leadMax": null,
      "ratings": [
       {
        "rating": "Base Will Save",
        "min": 5
       }
      ],
      "ratingsMode": "all",
      "other": "",
      "modifier": -6,
      "advantages": [
       "Lead",
       "Charm"
      ],
      "summary": "Friendly overtures to win the subject over.",
      "note": "Printed without the † mark carried by the other Predator Will Save requirements.",
      "skill": "Networking (Cha)",
      "roundDuration": "30 minutes"
     },
     {
      "id": "worse-cop",
      "name": "Worse Cop",
      "side": "predator",
      "requirements": "Base Will Save +8†",
      "leadMin": null,
      "leadMax": null,
      "ratings": [
       {
        "rating": "Base Will Save",
        "min": 8
       }
      ],
      "ratingsMode": "all",
      "other": "Predator's base Will save bonus counts as +1 higher per clue he holds showing the Prey has vital information",
      "modifier": -8,
      "advantages": [
       "Crisis",
       "Stress"
      ],
      "summary": "Go beyond intimidation into genuinely frightening behavior.",
      "note": "",
      "skill": "",
      "roundDuration": "5 minutes"
     },
     {
      "id": "the-5th",
      "name": "The 5th",
      "side": "prey",
      "requirements": "Base Will Save +8",
      "leadMin": null,
      "leadMax": null,
      "ratings": [
       {
        "rating": "Base Will Save",
        "min": 8
       }
      ],
      "ratingsMode": "all",
      "other": "",
      "modifier": -8,
      "advantages": [
       "Crisis",
       "Pause"
      ],
      "summary": "Stay coolly detached, answering with logic and legal loopholes.",
      "note": "",
      "skill": "",
      "roundDuration": "—"
     },
     {
      "id": "im-no-rat",
      "name": "“I’m No Rat”",
      "side": "prey",
      "requirements": "",
      "leadMin": null,
      "leadMax": null,
      "ratings": [],
      "ratingsMode": null,
      "other": "",
      "modifier": -4,
      "advantages": [
       "Lead"
      ],
      "summary": "Hold to loyalties, knowing a slip endangers loved ones.",
      "note": "",
      "skill": "Networking (Wis)",
      "roundDuration": "—"
     },
     {
      "id": "nothing-to-say",
      "name": "“Nothing to Say”",
      "side": "prey",
      "requirements": "Base Will Save +4",
      "leadMin": null,
      "leadMax": null,
      "ratings": [
       {
        "rating": "Base Will Save",
        "min": 4
       }
      ],
      "ratingsMode": "all",
      "other": "",
      "modifier": 0,
      "advantages": [
       "Lead",
       "Stress"
      ],
      "summary": "Clam up completely.",
      "note": "",
      "skill": "",
      "roundDuration": "—"
     },
     {
      "id": "story-time",
      "name": "Story Time",
      "side": "prey",
      "requirements": "Base Will Save +5",
      "leadMin": null,
      "leadMax": null,
      "ratings": [
       {
        "rating": "Base Will Save",
        "min": 5
       }
      ],
      "ratingsMode": "all",
      "other": "",
      "modifier": -6,
      "advantages": [
       "Lead",
       "Charm"
      ],
      "summary": "Ingratiate and distract with talk.",
      "note": "",
      "skill": "Bluff (Cha)",
      "roundDuration": "—"
     }
    ],
    "advantages": [
     {
      "id": "charm",
      "name": "Charm",
      "leadShift": 0,
      "victory": false,
      "summary": "Opponent's disposition toward the winner improves 1 grade until the scene ends (maximum Friendly).",
      "repeat": "Every 3 further picks: 1 more grade.",
      "repeatEvery": 3
     },
     {
      "id": "crisis",
      "name": "Crisis",
      "leadShift": 0,
      "victory": false,
      "summary": "Both sides make a Sense Motive (Wis) check, DC 25 + opponent's career level; whoever fails cracks and loses (if both fail, the Conflict continues). A side may skip its check, giving the opponent 2 Lead.",
      "repeat": "Each further pick lowers the winner's own Crisis DC by 4 (minimum 20).",
      "repeatEvery": 1,
      "skipLeadShift": 2,
      "canEndConflict": true
     },
     {
      "id": "lead",
      "name": "Lead",
      "leadShift": 1,
      "victory": false,
      "summary": "Lead moves 1 point toward the winner.",
      "repeat": "Every 2 further picks in the round move Lead 1 more point toward the winner.",
      "repeatEvery": 2
     },
     {
      "id": "pause",
      "name": "Pause",
      "leadShift": 0,
      "victory": false,
      "summary": "Conflict freezes: Lead stays put and no steps resolve next round.",
      "repeat": "Each further pick adds 1 more paused round.",
      "repeatEvery": 1
     },
     {
      "id": "slip",
      "name": "Slip",
      "leadShift": 0,
      "victory": false,
      "summary": "Winner either pulls 1 clue/secret from an opponent or passes off 1 lie as if a Bluff/Deception check with up to -6 penalty had succeeded.",
      "repeat": "Every 2 further picks: 1 more clue/secret, or lie penalty cap rises by 2 (-8, -10...).",
      "repeatEvery": 2
     },
     {
      "id": "stress",
      "name": "Stress",
      "leadShift": 0,
      "victory": false,
      "summary": "Everyone except the winner takes 1d4 stress damage that cannot be recovered until the interrogation ends.",
      "repeat": "Each further pick adds +1d4 stress damage.",
      "repeatEvery": 1
     },
     {
      "id": "victory",
      "name": "Victory",
      "leadShift": 0,
      "victory": true,
      "summary": "Conflict ends immediately in the winner's favor.",
      "repeat": ""
     }
    ],
    "victory": {
     "predator": "Prey truthfully gives up everything he knows about 1 event or topic the Predator names; later interrogations of him by this Predator this mission start 2 Lead lower (minimum 1).",
     "prey": "Prey shuts down or sells a believable story; this Predator cannot interrogate him again this mission."
    },
    "outsideActions": "",
    "tables": {
     "startingInterrogationLead": {
      "title": "Table 6.10: Starting Interrogation Lead",
      "page": 380,
      "columns": [
       "Risk of Answering",
       "Starting Lead"
      ],
      "rows": [
       [
        "None",
        3
       ],
       [
        "Slight (may prompt ridicule or social sanction)",
        4
       ],
       [
        "Moderate (may prompt mild retribution or minor criminal charges)",
        5
       ],
       [
        "Extreme (may prompt a personal vendetta or moderate criminal charges)",
        6
       ],
       [
        "Deadly (may prompt attacks or major criminal charges on self, friends, and family)",
        7
       ]
      ],
      "notes": []
     },
     "interrogationModifiers": {
      "title": "Table 6.11: Interrogation Modifiers",
      "page": 381,
      "columns": [
       "Category",
       "Circumstance",
       "Conflict Round Duration",
       "Check Modifier*",
       "Error Range*"
      ],
      "rows": [
       [
        "Situation",
        "Prey may voluntarily leave**",
        "×1/2",
        "-6/+0",
        "+2/+0"
       ],
       [
        "Situation",
        "Prey is imprisoned or cannot leave",
        "×1",
        "+0/+0",
        "+0/+0"
       ],
       [
        "Situation",
        "Prey has legal counsel present",
        "×1.5",
        "-6/+0",
        "+2/+0"
       ],
       [
        "Situation",
        "Prey expects to be released or rescued in the current interval",
        "—",
        "+0/+2",
        "+0/+0"
       ],
       [
        "Situation",
        "Prey has no hope of rescue",
        "—",
        "+0/-4",
        "+0/+1"
       ],
       [
        "Duress",
        "Threat of minor injury or inconvenience",
        "—",
        "+0/+0",
        "+0/+0"
       ],
       [
        "Duress",
        "Threat of incarceration or violence",
        "—",
        "+0/-2",
        "+0/+0"
       ],
       [
        "Duress",
        "Threat of death",
        "—",
        "+0/-4",
        "+0/+1"
       ],
       [
        "Duress",
        "Threat of torture",
        "—",
        "+0/-6",
        "+1/+2"
       ],
       [
        "Duress",
        "Act of incarceration or violence (the target or a second character)†",
        "—",
        "+0/-6",
        "+1/+2"
       ],
       [
        "Duress",
        "Act of killing (a second character)†",
        "—",
        "+0/-8",
        "+2/+3"
       ],
       [
        "Duress",
        "Act of torture (the target or a second character)†",
        "—",
        "+0/-10",
        "+3/+4"
       ],
       [
        "Incentive†",
        "Offers of money††",
        "—",
        "+2/+0",
        "+0/+0"
       ],
       [
        "Incentive†",
        "Offers of reduced penalty (legal, financial, etc.)",
        "—",
        "+4/+0",
        "+1/+0"
       ],
       [
        "Incentive†",
        "Offers of protection (from prosecution, injury, etc.)",
        "—",
        "+6/+0",
        "+2/+0"
       ],
       [
        "Incentive†",
        "Offers of immunity (from prosecution, injury, etc.)",
        "—",
        "+8/+0",
        "+3/+0"
       ]
      ],
      "notes": [
       "* Left of slash applies to the Predator's opposed check / error range; right of slash applies to the Prey's.",
       "** The Prey may technically leave but cannot actually do so until he wins the Conflict.",
       "† A Prey free to leave never willingly submits to this; most such acts also cause exposure.",
       "†† Minimum sum equals a bribe; each doubling of that base adds +2 more.",
       "\"Category\" column is added here to preserve the printed sub-headings (Situation, Duress, Incentive†)."
      ]
     }
    },
    "notes": [
     "Predator uses Intimidate with Str for physical force or Wis for mental pressure.",
     "Streamlined variant: one Intimidate (Str or Wis) check, DC = target's Bluff bonus + 10, with Table 6.11 modifiers still applying.",
     "Round length comes from the Predator's Strategy (\"roundDuration\"); Prey strategies list no duration, and General strategy durations count only when the Predator picks them. Both sides must be present for half the round (rounded up).",
     "A blank \"skill\" means the default skill; alternate skill checks have no tags.",
     "For † requirements the Predator adds +1 to his base Will save bonus per clue showing the Prey holds vital information.",
     "\"Act of violence\" needs at least 5 lethal damage or 1/4 of the target's wound points (lower of the two); \"act of torture\" needs a critical injury, or 10 lethal damage / 1/3 of wound points (lower).",
     "Several participants form a Predator group and a Prey group; each makes one cooperative opposed check per round."
    ]
   },
   "manhunt": {
    "name": "Manhunt",
    "pages": [
     382,
     386
    ],
    "predator": "Hunter(s) searching for a missing target",
    "prey": "Fugitive(s) whose location was known within the last 24 hours",
    "predatorSkills": [
     "Investigation (Wis)"
    ],
    "preySkills": [
     "Blend (Cha)"
    ],
    "predatorSkillTags": [
     "Bribe",
     "Language"
    ],
    "preySkillTags": [],
    "roundTime": "1 day (each side involved at least 4 hours per day)",
    "powerRatings": [
     "Spending Cash",
     "Tools Rating"
    ],
    "startingLead": {
     "default": 5,
     "summary": "Set by the size of the starting search radius, from 4 (neighborhood) to 8 (continent). No manhunt if the area cannot be narrowed to one continent.",
     "rules": [
      {
       "when": "Starting radius: neighborhood",
       "lead": 4
      },
      {
       "when": "Starting radius: city or county",
       "lead": 5
      },
      {
       "when": "Starting radius: state or small country",
       "lead": 6
      },
      {
       "when": "Starting radius: large country",
       "lead": 7
      },
      {
       "when": "Starting radius: entire continent",
       "lead": 8
      }
     ]
    },
    "strategies": [
     {
      "id": "out-of-bounds",
      "name": "Out of Bounds",
      "side": "general",
      "requirements": "",
      "leadMin": null,
      "leadMax": null,
      "ratings": [],
      "ratingsMode": null,
      "other": "",
      "modifier": 0,
      "advantages": [
       "Lead",
       "Stress"
      ],
      "summary": "Drag the hunt off the streets into wild or wooded ground.",
      "note": "",
      "skill": "Survival (Wis)",
      "publicityOnChoose": 0
     },
     {
      "id": "set-up",
      "name": "Set Up",
      "side": "general",
      "requirements": "Lead 5–9",
      "leadMin": 5,
      "leadMax": 9,
      "ratings": [],
      "ratingsMode": null,
      "other": "",
      "modifier": -4,
      "advantages": [
       "Twist"
      ],
      "summary": "Prepare an unexpected change of tack for next round.",
      "note": "",
      "skill": "",
      "publicityOnChoose": 0
     },
     {
      "id": "take-him",
      "name": "“Take Him!”",
      "side": "general",
      "requirements": "†",
      "leadMin": null,
      "leadMax": null,
      "ratings": [],
      "ratingsMode": null,
      "other": "master tracker class ability (see page 44)",
      "modifier": 0,
      "advantages": [
       "*"
      ],
      "summary": "Pin the opponent down or slip the net; winner spends 1 use of the class ability to pick any Advantages except Victory.",
      "note": "Printed as \"Any except Victory\".",
      "skill": "",
      "publicityOnChoose": 0
     },
     {
      "id": "all-points-bulletin",
      "name": "All Points Bulletin",
      "side": "predator",
      "requirements": "Spending Cash or Tools Rating 4+",
      "leadMin": null,
      "leadMax": null,
      "ratings": [
       {
        "rating": "Spending Cash",
        "min": 4
       },
       {
        "rating": "Tools Rating",
        "min": 4
       }
      ],
      "ratingsMode": "any",
      "other": "",
      "modifier": -4,
      "advantages": [
       "Lead",
       "Twist"
      ],
      "summary": "Broadcast the alert to flush the fugitive out.",
      "note": "Choosing this Strategy raises publicity by 1, win or lose (†† mark on the strategy name).",
      "skill": "",
      "publicityOnChoose": 1
     },
     {
      "id": "checkpoints",
      "name": "Checkpoints",
      "side": "predator",
      "requirements": "Spending Cash or Tools Rating 7+",
      "leadMin": null,
      "leadMax": null,
      "ratings": [
       {
        "rating": "Spending Cash",
        "min": 7
       },
       {
        "rating": "Tools Rating",
        "min": 7
       }
      ],
      "ratingsMode": "any",
      "other": "",
      "modifier": -6,
      "advantages": [
       "Chase"
      ],
      "summary": "Man transit hubs and exit routes to catch a move.",
      "note": "Choosing this Strategy raises publicity by 1, win or lose (†† mark on the strategy name).",
      "skill": "",
      "publicityOnChoose": 1
     },
     {
      "id": "desk-jockey",
      "name": "Desk Jockey",
      "side": "predator",
      "requirements": "Lead 1–4",
      "leadMin": 1,
      "leadMax": 4,
      "ratings": [],
      "ratingsMode": null,
      "other": "",
      "modifier": -4,
      "advantages": [
       "Lead",
       "Shred"
      ],
      "summary": "Mine the data on hand for patterns.",
      "note": "",
      "skill": "Analysis (Int)",
      "publicityOnChoose": 0
     },
     {
      "id": "dial-it-back",
      "name": "Dial It Back",
      "side": "predator",
      "requirements": "",
      "leadMin": null,
      "leadMax": null,
      "ratings": [],
      "ratingsMode": null,
      "other": "",
      "modifier": -2,
      "advantages": [
       "Pause",
       "Public Support"
      ],
      "summary": "Pull back from public view to let things cool.",
      "note": "",
      "skill": "",
      "publicityOnChoose": 0
     },
     {
      "id": "gotcha",
      "name": "“Gotcha!”",
      "side": "predator",
      "requirements": "Spending Cash or Tools Rating 6+",
      "leadMin": null,
      "leadMax": null,
      "ratings": [
       {
        "rating": "Spending Cash",
        "min": 6
       },
       {
        "rating": "Tools Rating",
        "min": 6
       }
      ],
      "ratingsMode": "any",
      "other": "",
      "modifier": -12,
      "advantages": [
       "Profile",
       "Victory"
      ],
      "summary": "Stake everything on a hunch to catch the fugitive unawares.",
      "note": "",
      "skill": "",
      "publicityOnChoose": 0
     },
     {
      "id": "intense-scrutiny",
      "name": "Intense Scrutiny",
      "side": "predator",
      "requirements": "",
      "leadMin": null,
      "leadMax": null,
      "ratings": [],
      "ratingsMode": null,
      "other": "",
      "modifier": 0,
      "advantages": [
       "Shred",
       "Stress"
      ],
      "summary": "Re-examine past sighting locations in minute detail.",
      "note": "Choosing this Strategy raises publicity by 1, win or lose (†† mark on the strategy name).",
      "skill": "Search (Int)",
      "publicityOnChoose": 1
     },
     {
      "id": "legwork",
      "name": "Legwork",
      "side": "predator",
      "requirements": "",
      "leadMin": null,
      "leadMax": null,
      "ratings": [],
      "ratingsMode": null,
      "other": "",
      "modifier": 2,
      "advantages": [
       "Lead"
      ],
      "summary": "Hit the streets, chase leads and question locals.",
      "note": "Choosing this Strategy raises publicity by 1, win or lose (†† mark on the strategy name).",
      "skill": "",
      "publicityOnChoose": 1
     },
     {
      "id": "media-blitz",
      "name": "Media Blitz",
      "side": "predator",
      "requirements": "Spending Cash or Tools Rating 6+",
      "leadMin": null,
      "leadMax": null,
      "ratings": [
       {
        "rating": "Spending Cash",
        "min": 6
       },
       {
        "rating": "Tools Rating",
        "min": 6
       }
      ],
      "ratingsMode": "any",
      "other": "",
      "modifier": -6,
      "advantages": [
       "Lead",
       "Public Support"
      ],
      "summary": "Ask the public for help finding the fugitive.",
      "note": "Choosing this Strategy raises publicity by 1, win or lose (†† mark on the strategy name).",
      "skill": "Impress (Cha)",
      "publicityOnChoose": 1
     },
     {
      "id": "mind-of-a-killer",
      "name": "Mind of a Killer",
      "side": "predator",
      "requirements": "Lead 1–5",
      "leadMin": 1,
      "leadMax": 5,
      "ratings": [],
      "ratingsMode": null,
      "other": "",
      "modifier": -4,
      "advantages": [
       "Lead",
       "Profile"
      ],
      "summary": "Get inside the fugitive's head to predict his next step.",
      "note": "",
      "skill": "Manipulate (Wis)",
      "publicityOnChoose": 0
     },
     {
      "id": "surveillance",
      "name": "Surveillance",
      "side": "predator",
      "requirements": "Spending Cash or Tools Rating 5+",
      "leadMin": null,
      "leadMax": null,
      "ratings": [
       {
        "rating": "Spending Cash",
        "min": 5
       },
       {
        "rating": "Tools Rating",
        "min": 5
       }
      ],
      "ratingsMode": "any",
      "other": "",
      "modifier": -4,
      "advantages": [
       "Fade",
       "Lead"
      ],
      "summary": "Track the fugitive electronically with taps and bugs.",
      "note": "",
      "skill": "",
      "publicityOnChoose": 0
     },
     {
      "id": "the-usual-suspects",
      "name": "The Usual Suspects",
      "side": "predator",
      "requirements": "Spending Cash or Tools Rating 3+",
      "leadMin": null,
      "leadMax": null,
      "ratings": [
       {
        "rating": "Spending Cash",
        "min": 3
       },
       {
        "rating": "Tools Rating",
        "min": 3
       }
      ],
      "ratingsMode": "any",
      "other": "",
      "modifier": -2,
      "advantages": [
       "Lead",
       "Slip"
      ],
      "summary": "Round up and squeeze known associates for information.",
      "note": "Choosing this Strategy raises publicity by 1, win or lose (†† mark on the strategy name).",
      "skill": "Intimidate (Str)",
      "publicityOnChoose": 1
     },
     {
      "id": "act-casual",
      "name": "Act Casual",
      "side": "prey",
      "requirements": "",
      "leadMin": null,
      "leadMax": null,
      "ratings": [],
      "ratingsMode": null,
      "other": "",
      "modifier": 0,
      "advantages": [
       "Lead"
      ],
      "summary": "Adopt a plain, unremarkable routine.",
      "note": "",
      "skill": "",
      "publicityOnChoose": 0
     },
     {
      "id": "disgrace",
      "name": "Disgrace",
      "side": "prey",
      "requirements": "Spending Cash or Tools Rating 5+",
      "leadMin": null,
      "leadMax": null,
      "ratings": [
       {
        "rating": "Spending Cash",
        "min": 5
       },
       {
        "rating": "Tools Rating",
        "min": 5
       }
      ],
      "ratingsMode": "any",
      "other": "",
      "modifier": -8,
      "advantages": [
       "Outcry",
       "Shred"
      ],
      "summary": "Stage a display of the hunter's bungling or overreach.",
      "note": "Choosing this Strategy raises publicity by 1, win or lose (†† mark on the strategy name).",
      "skill": "",
      "publicityOnChoose": 1
     },
     {
      "id": "go-to-ground",
      "name": "Go to Ground",
      "side": "prey",
      "requirements": "",
      "leadMin": null,
      "leadMax": null,
      "ratings": [],
      "ratingsMode": null,
      "other": "",
      "modifier": -2,
      "advantages": [
       "Pause",
       "Stress"
      ],
      "summary": "Stay hidden and buy time.",
      "note": "",
      "skill": "",
      "publicityOnChoose": 0
     },
     {
      "id": "interference",
      "name": "Interference",
      "side": "prey",
      "requirements": "Spending Cash or Tools Rating 4+",
      "leadMin": null,
      "leadMax": null,
      "ratings": [
       {
        "rating": "Spending Cash",
        "min": 4
       },
       {
        "rating": "Tools Rating",
        "min": 4
       }
      ],
      "ratingsMode": "any",
      "other": "",
      "modifier": -4,
      "advantages": [
       "Lead",
       "Slip"
      ],
      "summary": "Feed the hunters false leads to bog them down.",
      "note": "",
      "skill": "",
      "publicityOnChoose": 0
     },
     {
      "id": "new-face-new-man",
      "name": "New Face, New Man",
      "side": "prey",
      "requirements": "Lead 6–9",
      "leadMin": 6,
      "leadMax": 9,
      "ratings": [],
      "ratingsMode": null,
      "other": "",
      "modifier": -6,
      "advantages": [
       "Fade",
       "Lead"
      ],
      "summary": "Build a fresh cover identity.",
      "note": "",
      "skill": "Falsify (Int)",
      "publicityOnChoose": 0
     },
     {
      "id": "no-witnesses",
      "name": "No Witnesses",
      "side": "prey",
      "requirements": "Spending Cash or Tools Rating 3+",
      "leadMin": null,
      "leadMax": null,
      "ratings": [
       {
        "rating": "Spending Cash",
        "min": 3
       },
       {
        "rating": "Tools Rating",
        "min": 3
       }
      ],
      "ratingsMode": "any",
      "other": "",
      "modifier": -2,
      "advantages": [
       "Confront",
       "Slip"
      ],
      "summary": "Go back and silence bystanders who could talk.",
      "note": "",
      "skill": "Intimidate (Str)",
      "publicityOnChoose": 0
     },
     {
      "id": "random-acts",
      "name": "Random Acts",
      "side": "prey",
      "requirements": "Lead 1–5",
      "leadMin": 1,
      "leadMax": 5,
      "ratings": [],
      "ratingsMode": null,
      "other": "",
      "modifier": -4,
      "advantages": [
       "Fake Out",
       "Stress"
      ],
      "summary": "Break routine unpredictably to throw off the hunter.",
      "note": "Choosing this Strategy lowers publicity by 1, win or lose (∆ mark on the strategy name).",
      "skill": "Manipulate (Wis)",
      "publicityOnChoose": -1
     },
     {
      "id": "run-for-the-border",
      "name": "Run for the Border",
      "side": "prey",
      "requirements": "Spending Cash or Tools Rating 6+",
      "leadMin": null,
      "leadMax": null,
      "ratings": [
       {
        "rating": "Spending Cash",
        "min": 6
       },
       {
        "rating": "Tools Rating",
        "min": 6
       }
      ],
      "ratingsMode": "any",
      "other": "",
      "modifier": -8,
      "advantages": [
       "Chase"
      ],
      "summary": "Make a bold dash out of the search area.",
      "note": "",
      "skill": "",
      "publicityOnChoose": 0
     },
     {
      "id": "sanitize",
      "name": "Sanitize",
      "side": "prey",
      "requirements": "",
      "leadMin": null,
      "leadMax": null,
      "ratings": [],
      "ratingsMode": null,
      "other": "",
      "modifier": -2,
      "advantages": [
       "Fade",
       "Pause"
      ],
      "summary": "Retrace the trail and erase traces.",
      "note": "",
      "skill": "Search (Int)",
      "publicityOnChoose": 0
     },
     {
      "id": "take-it-public",
      "name": "Take It Public",
      "side": "prey",
      "requirements": "Spending Cash or Tools Rating 7+",
      "leadMin": null,
      "leadMax": null,
      "ratings": [
       {
        "rating": "Spending Cash",
        "min": 7
       },
       {
        "rating": "Tools Rating",
        "min": 7
       }
      ],
      "ratingsMode": "any",
      "other": "",
      "modifier": -8,
      "advantages": [
       "Outcry",
       "Twist"
      ],
      "summary": "Appeal to the public for sympathy.",
      "note": "Printed \"Take it Public\" in Table 6.16 and \"Take It Public\" in the description.",
      "skill": "Impress (Cha)",
      "publicityOnChoose": 0
     },
     {
      "id": "without-a-trace",
      "name": "Without a Trace",
      "side": "prey",
      "requirements": "Spending Cash or Tools Rating 7+",
      "leadMin": null,
      "leadMax": null,
      "ratings": [
       {
        "rating": "Spending Cash",
        "min": 7
       },
       {
        "rating": "Tools Rating",
        "min": 7
       }
      ],
      "ratingsMode": "any",
      "other": "",
      "modifier": -12,
      "advantages": [
       "Pause",
       "Victory"
      ],
      "summary": "Execute an elaborate plan to disappear completely.",
      "note": "",
      "skill": "",
      "publicityOnChoose": 0
     }
    ],
    "advantages": [
     {
      "id": "chase",
      "name": "Chase",
      "leadShift": 0,
      "victory": false,
      "summary": "A chase Conflict starts with vehicles chosen by the GC, starting Lead equal to the manhunt's Lead; Predator gets 2 bonus action dice for chase skill checks. If the Prey wins the chase he wins the manhunt.",
      "repeat": "",
      "nestedConflict": "chase",
      "canEndConflict": true
     },
     {
      "id": "confront",
      "name": "Confront",
      "leadShift": 0,
      "victory": false,
      "summary": "Combat breaks out with both sides carrying only personal gear and the Prey getting a quick ambush; whoever defeats the other wins the manhunt.",
      "repeat": "",
      "canEndConflict": true
     },
     {
      "id": "fade",
      "name": "Fade",
      "leadShift": 0,
      "victory": false,
      "summary": "Winner's lowest cover identity gains 1 Power Rating (maximum 7); with no cover identity he gains one at Power Rating 2.",
      "repeat": "Every 2 further picks: +1 more to the lowest identity.",
      "repeatEvery": 2
     },
     {
      "id": "fake-out",
      "name": "Fake Out",
      "leadShift": 0,
      "victory": false,
      "summary": "Prey plants false clues: the Predator's next Profile Advantage treats Lead as 2 higher.",
      "repeat": "Every 2 further picks: affects 1 more later Profile Advantage (the +2 does not grow).",
      "repeatEvery": 2
     },
     {
      "id": "lead",
      "name": "Lead",
      "leadShift": 1,
      "victory": false,
      "summary": "Lead moves 1 point toward the winner.",
      "repeat": "Every 2 further picks in the round move Lead 1 more point toward the winner.",
      "repeatEvery": 2
     },
     {
      "id": "outcry",
      "name": "Outcry",
      "leadShift": 0,
      "victory": false,
      "summary": "Manhunt publicity increases by 1.",
      "repeat": "Every 2 further picks: publicity +1 more.",
      "repeatEvery": 2,
      "publicity": 1
     },
     {
      "id": "pause",
      "name": "Pause",
      "leadShift": 0,
      "victory": false,
      "summary": "Conflict freezes: Lead stays put and no steps resolve next round and publicity drops by 1; Step 4 actions still happen.",
      "repeat": "Each further pick adds 1 more paused round and lowers publicity by 1 more.",
      "repeatEvery": 1,
      "publicity": -1
     },
     {
      "id": "profile",
      "name": "Profile",
      "leadShift": 0,
      "victory": false,
      "summary": "Predator reaches a scene tied to the Prey with timing per Table 6.15 (Lead counts +1 if the Prey has a cover identity); an Investigation/Canvass Area or Search/Perception check at the listed DC yields 1 clue, each worth +2 on later manhunt checks.",
      "repeat": "Every 2 further picks: treat Lead as 1 lower for the table (actual Lead unchanged).",
      "repeatEvery": 2
     },
     {
      "id": "public-support",
      "name": "Public Support",
      "leadShift": 0,
      "victory": false,
      "summary": "Manhunt publicity decreases by 2.",
      "repeat": "Every 2 further picks: publicity -1 more.",
      "repeatEvery": 2,
      "publicity": -2
     },
     {
      "id": "shred",
      "name": "Shred",
      "leadShift": 0,
      "victory": false,
      "summary": "The Prey's lowest-rated cover identity loses 1 Power Rating; at 0 the identity is blown.",
      "repeat": "Every 2 further picks remove 1 more point, rolling over to the next-lowest identity if one hits 0.",
      "repeatEvery": 2
     },
     {
      "id": "slip",
      "name": "Slip",
      "leadShift": 0,
      "victory": false,
      "summary": "Winner either pulls 1 clue/secret from an opponent or passes off 1 lie as if a Bluff/Deception check with up to -6 penalty had succeeded.",
      "repeat": "Every 2 further picks: 1 more clue/secret, or lie penalty cap rises by 2 (-8, -10...).",
      "repeatEvery": 2
     },
     {
      "id": "stress",
      "name": "Stress",
      "leadShift": 0,
      "victory": false,
      "summary": "Everyone except the winner takes 1d4 stress damage that cannot be recovered until the manhunt ends.",
      "repeat": "Each further pick adds +1d4 stress damage.",
      "repeatEvery": 1
     },
     {
      "id": "twist",
      "name": "Twist",
      "leadShift": 0,
      "victory": false,
      "summary": "Winner may use Athletics (Str), Bureaucracy (Cha), Computers (Int), Drive (Dex), Networking (Cha), Search (Int), Sneak (Dex) or Streetwise (Wis), without tags, for the next opposed check.",
      "repeat": "",
      "twistSkills": [
       "Athletics (Str)",
       "Bureaucracy (Cha)",
       "Computers (Int)",
       "Drive (Dex)",
       "Networking (Cha)",
       "Search (Int)",
       "Sneak (Dex)",
       "Streetwise (Wis)"
      ]
     },
     {
      "id": "victory",
      "name": "Victory",
      "leadShift": 0,
      "victory": true,
      "summary": "Conflict ends immediately in the winner's favor.",
      "repeat": ""
     }
    ],
    "victory": {
     "predator": "Prey's exact location is known; Predator may move in (usually combat or chase with a slow ambush) or keep watching, resetting Lead to 1 and continuing next day.",
     "prey": "Prey and team slip away and cannot be found for the rest of the scene."
    },
    "outsideActions": "",
    "tables": {
     "publicityLimits": {
      "title": "Table 6.13: Publicity Limits",
      "page": 383,
      "columns": [
       "Category",
       "Circumstance",
       "Maximum Publicity"
      ],
      "rows": [
       [
        "Predator Organization’s Authority",
        "Shadowy conspiracy that fears the light of day",
        3
       ],
       [
        "Predator Organization’s Authority",
        "Little-known group that wants to stay that way",
        5
       ],
       [
        "Predator Organization’s Authority",
        "Official faction whose motives are easily questioned",
        7
       ],
       [
        "Predator Organization’s Authority",
        "Faction lead by well-known or feared public figures",
        9
       ],
       [
        "Predator Organization’s Authority",
        "Public faction whose primary function is to pursue criminals",
        "No limit*"
       ],
       [
        "Prey Notoriety",
        "Inconsequential (e.g. petty criminal, minor witness)",
        "+0"
       ],
       [
        "Prey Notoriety",
        "Interesting (e.g. mastermind or witness linked to minor organization)",
        "+1"
       ],
       [
        "Prey Notoriety",
        "Significant (e.g. mastermind or witness linked to major organization)",
        "+2"
       ],
       [
        "Prey Notoriety",
        "Urgent (e.g. established long-term threat or witness linked to global organization)",
        "+4"
       ],
       [
        "Prey Notoriety",
        "Vital (e.g. tangible threat to faction’s survival or witness linked to distribution of weapons of mass destruction)",
        "No limit*"
       ]
      ],
      "notes": [
       "* Overrides all other publicity modifiers; the hunt continues whatever disruption it causes.",
       "Limit = authority base + notoriety modifier. \"Category\" column is added here to preserve the printed sub-headings."
      ]
     },
     "manhuntModifiers": {
      "title": "Table 6.14: Manhunt Modifiers",
      "page": 384,
      "columns": [
       "Category",
       "Circumstance",
       "Check Modifier*",
       "Error Range*"
      ],
      "rows": [
       [
        "Situation",
        "Predator assisted by organization that cannot or may not operate in public",
        "-6/+0",
        "+2/+0"
       ],
       [
        "Situation",
        "Per member of Prey group above 3",
        "+0/-1",
        "+0/+0"
       ],
       [
        "Public Opinion",
        "Local citizens and/or press hate the Predator",
        "-2/+0",
        "+0/+0"
       ],
       [
        "Public Opinion",
        "Local citizens and/or press fear the Predator",
        "-4/+0",
        "+0/-2"
       ],
       [
        "Public Opinion",
        "Local citizens and/or press approve of the Predator",
        "+0/-2",
        "+0/+0"
       ],
       [
        "Public Opinion",
        "Local citizens and/or press are used to living under scrutiny",
        "+0/-4",
        "-2/+0"
       ],
       [
        "Public Opinion",
        "Local citizens and/or press would recognize the Prey prior to the manhunt",
        "+0/-4",
        "+0/+1"
       ],
       [
        "Prey Actions in Last 24 Hours",
        "Attempted to use mass or public transportation or rental vehicle",
        "+0/-4",
        "+0/+1"
       ],
       [
        "Prey Actions in Last 24 Hours",
        "Made 1 or more traceable calls",
        "+0/-2",
        "+0/+0"
       ],
       [
        "Prey Actions in Last 24 Hours",
        "Presented any traceable (non-cover) ID",
        "+0/-2",
        "+0/+0"
       ],
       [
        "Prey Actions in Last 24 Hours",
        "Sought medical assistance (per person treated)",
        "+0/-4",
        "+0/+1"
       ],
       [
        "Prey Actions in Last 24 Hours",
        "Spent more than $1,000, up to $10,000",
        "+0/-2",
        "+0/+0"
       ],
       [
        "Prey Actions in Last 24 Hours",
        "Spent more than $10,000, up to $50,000",
        "+0/-4",
        "+0/+0"
       ],
       [
        "Prey Actions in Last 24 Hours",
        "Spent more than $50,000",
        "+0/-6",
        "+0/+0"
       ],
       [
        "Prey Actions in Last 24 Hours",
        "Traveled more than (5 × Lead) miles",
        "+0/-2",
        "+0/+0"
       ]
      ],
      "notes": [
       "* Left of slash applies to the Predator's opposed check / error range; right of slash applies to the Prey's.",
       "\"Category\" column is added here to preserve the printed sub-headings."
      ]
     },
     "profilingDelay": {
      "title": "Table 6.15: Profiling Delay",
      "page": 385,
      "columns": [
       "Lead",
       "Profiler’s Arrival",
       "Canvass Area/Perception Check DC"
      ],
      "rows": [
       [
        "0",
        "1d4 hours before the Prey",
        15
       ],
       [
        "1",
        "At roughly the same time as the Prey (per GC discretion)",
        20
       ],
       [
        "2",
        "4d4 minutes after the Prey",
        25
       ],
       [
        "3",
        "2d4 × 10 minutes after the Prey",
        30
       ],
       [
        "4",
        "1d6 hours after the Prey",
        35
       ],
       [
        "5",
        "4d6 hours after the Prey",
        40
       ],
       [
        "6+",
        "More than 1 day after the Prey",
        "Impossible"
       ]
      ],
      "notes": [
       "Lead column uses the modified Lead from the Profile Advantage (cover identity +1, Fake Out +2, repeat picks -1), not the actual Lead."
      ]
     }
    },
    "notes": [
     "A manhunt needs the Prey's whereabouts to have been known within the last 24 hours and the search area to be one continent or smaller.",
     "Streamlined variant: a Complex Task with Challenges = starting Lead, Investigation (Wis) DC = Prey's Blend bonus + 10.",
     "Track a publicity score. Limit = Predator organization's authority base + Prey notoriety modifier (Table 6.13). At or above the limit the hunt is called off (Prey wins) and the Predator cannot start another manhunt this mission.",
     "Strategies with \"publicityOnChoose\" change publicity when chosen regardless of the check result; Outcry, Pause and Public Support also move it.",
     "Requirements written \"Spending Cash or Tools Rating N+\" are parsed as two ratings in \"any\" mode: the participant's Spending Cash or his organization's Tools Rating.",
     "Several hunting groups after one Prey: separate Lead per pair, resolved from lowest to highest Lead; the Prey may pick a different Strategy per pairing. Chains resolve front to back.",
     "A blank \"skill\" means the default skill; alternate skill checks have no tags.",
     "“Take Him!” winner spends 1 use of the master tracker ability to choose any 1 Advantage, +1 per 4 margin, never Victory."
    ]
   },
   "seduction": {
    "name": "Seduction",
    "pages": [
     387,
     388
    ],
    "predator": "Character trying to subvert another's loyalties",
    "prey": "Target of the seduction",
    "predatorSkills": [
     "Impress (Cha)"
    ],
    "preySkills": [
     "Sense Motive (Wis)"
    ],
    "predatorSkillTags": [
     "Bribe",
     "Disposition",
     "Hearing",
     "Language"
    ],
    "preySkillTags": [
     "Disposition",
     "Hearing",
     "Language"
    ],
    "roundTime": "Set by the Predator's Strategy (1 minute to 1 day); both must be present for half of it (rounded up)",
    "powerRatings": [
     "Spending Cash",
     "Image Rating",
     "Lifestyle",
     "History Rating"
    ],
    "startingLead": {
     "default": 5,
     "summary": "Compare career levels: a side 2+ levels higher shifts starting Lead 1 its way.",
     "rules": [
      {
       "when": "Predator's career level is 2+ higher than Prey's",
       "lead": 4
      },
      {
       "when": "Prey's career level is 2+ higher than Predator's",
       "lead": 6
      },
      {
       "when": "Otherwise",
       "lead": 5
      }
     ]
    },
    "strategies": [
     {
      "id": "call-me",
      "name": "“Call Me”",
      "side": "general",
      "requirements": "",
      "leadMin": null,
      "leadMax": null,
      "ratings": [],
      "ratingsMode": null,
      "other": "",
      "modifier": 0,
      "advantages": [
       "Lead",
       "Pause"
      ],
      "summary": "Keep the other party at arm's length to stay in control.",
      "note": "",
      "roundDuration": "1 day"
     },
     {
      "id": "love-is-blind",
      "name": "Love is Blind",
      "side": "general",
      "requirements": "Lead 4–6",
      "leadMin": 4,
      "leadMax": 6,
      "ratings": [],
      "ratingsMode": null,
      "other": "",
      "modifier": -4,
      "advantages": [
       "Twist"
      ],
      "summary": "Bring unexpected talents into play.",
      "note": "",
      "roundDuration": "1 hour"
     },
     {
      "id": "show-of-good-faith",
      "name": "Show of Good Faith",
      "side": "general",
      "requirements": "Lead 3–5",
      "leadMin": 3,
      "leadMax": 5,
      "ratings": [],
      "ratingsMode": null,
      "other": "",
      "modifier": -6,
      "advantages": [
       "Favor",
       "Lead"
      ],
      "summary": "Demand proof of the other's commitment.",
      "note": "If this Strategy succeeds, the time needed to complete the favor is added to the round's duration (** mark).",
      "roundDuration": "10 minutes"
     },
     {
      "id": "compromising-position",
      "name": "Compromising Position",
      "side": "predator",
      "requirements": "Spending Cash 5+ or Image Rating 4+",
      "leadMin": null,
      "leadMax": null,
      "ratings": [
       {
        "rating": "Spending Cash",
        "min": 5
       },
       {
        "rating": "Image Rating",
        "min": 4
       }
      ],
      "ratingsMode": "any",
      "other": "",
      "modifier": -6,
      "advantages": [
       "Crisis",
       "Stress"
      ],
      "summary": "Press with veiled threats of embarrassment or loss.",
      "note": "",
      "roundDuration": "1 day"
     },
     {
      "id": "extra-incentive",
      "name": "Extra Incentive",
      "side": "predator",
      "requirements": "Spending Cash 4+ or Image Rating 6+",
      "leadMin": null,
      "leadMax": null,
      "ratings": [
       {
        "rating": "Spending Cash",
        "min": 4
       },
       {
        "rating": "Image Rating",
        "min": 6
       }
      ],
      "ratingsMode": "any",
      "other": "",
      "modifier": 0,
      "advantages": [
       "Lead"
      ],
      "summary": "Sweeten the offer with kindnesses and gifts.",
      "note": "",
      "roundDuration": "10 minutes"
     },
     {
      "id": "hard-sell",
      "name": "Hard Sell",
      "side": "predator",
      "requirements": "Lead 1–4",
      "leadMin": 1,
      "leadMax": 4,
      "ratings": [],
      "ratingsMode": null,
      "other": "",
      "modifier": -4,
      "advantages": [
       "Stress",
       "Favor"
      ],
      "summary": "Make a bold, sudden play for the target's affections.",
      "note": "If this Strategy succeeds, the time needed to complete the favor is added to the round's duration (** mark).",
      "roundDuration": "1 minute"
     },
     {
      "id": "seal-the-deal",
      "name": "Seal the Deal",
      "side": "predator",
      "requirements": "Spending Cash 7+ or Image Rating 6+",
      "leadMin": null,
      "leadMax": null,
      "ratings": [
       {
        "rating": "Spending Cash",
        "min": 7
       },
       {
        "rating": "Image Rating",
        "min": 6
       }
      ],
      "ratingsMode": "any",
      "other": "",
      "modifier": -12,
      "advantages": [
       "Victory"
      ],
      "summary": "All-in attempt to close the seduction.",
      "note": "No descriptive entry for this Strategy appears in the printed strategy list.",
      "roundDuration": "1 hour"
     },
     {
      "id": "we-had-some-good-times",
      "name": "“We Had Some Good Times”",
      "side": "predator",
      "requirements": "Lead 6–9",
      "leadMin": 6,
      "leadMax": 9,
      "ratings": [],
      "ratingsMode": null,
      "other": "",
      "modifier": -8,
      "advantages": [
       "Favor",
       "Halt"
      ],
      "summary": "Break things off without giving up influence already gained.",
      "note": "If this Strategy succeeds, the time needed to complete the favor is added to the round's duration (** mark).",
      "roundDuration": "4 hours"
     },
     {
      "id": "wine-and-dine",
      "name": "Wine and Dine",
      "side": "predator",
      "requirements": "Spending Cash 4+ or Image Rating 3+",
      "leadMin": null,
      "leadMax": null,
      "ratings": [
       {
        "rating": "Spending Cash",
        "min": 4
       },
       {
        "rating": "Image Rating",
        "min": 3
       }
      ],
      "ratingsMode": "any",
      "other": "",
      "modifier": -6,
      "advantages": [
       "Charm",
       "Lead"
      ],
      "summary": "Turn on the charm while quietly steering emotions.",
      "note": "",
      "roundDuration": "2 hours"
     },
     {
      "id": "i-just-cant",
      "name": "“I Just Can’t”",
      "side": "prey",
      "requirements": "Lifestyle 7+ or History Rating 6+",
      "leadMin": null,
      "leadMax": null,
      "ratings": [
       {
        "rating": "Lifestyle",
        "min": 7
       },
       {
        "rating": "History Rating",
        "min": 6
       }
      ],
      "ratingsMode": "any",
      "other": "",
      "modifier": -12,
      "advantages": [
       "Victory"
      ],
      "summary": "Dig in and refuse outright.",
      "note": "",
      "roundDuration": "—"
     },
     {
      "id": "in-too-deep",
      "name": "In Too Deep",
      "side": "prey",
      "requirements": "Lead 1–3",
      "leadMin": 1,
      "leadMax": 3,
      "ratings": [],
      "ratingsMode": null,
      "other": "",
      "modifier": -8,
      "advantages": [
       "Stress",
       "Swap"
      ],
      "summary": "As the bond deepens, find a way to turn the tables.",
      "note": "",
      "roundDuration": "—"
     },
     {
      "id": "its-not-right",
      "name": "“It’s Not Right!”",
      "side": "prey",
      "requirements": "Lifestyle 4+ or History Rating 3+",
      "leadMin": null,
      "leadMax": null,
      "ratings": [
       {
        "rating": "Lifestyle",
        "min": 4
       },
       {
        "rating": "History Rating",
        "min": 3
       }
      ],
      "ratingsMode": "any",
      "other": "",
      "modifier": -6,
      "advantages": [
       "Lead",
       "Disappoint"
      ],
      "summary": "Raise moral objections, causing arguments and hurt.",
      "note": "",
      "roundDuration": "—"
     },
     {
      "id": "its-not-you-its-me",
      "name": "“It’s Not You, It’s Me”",
      "side": "prey",
      "requirements": "Lifestyle 4+ or History Rating 5+",
      "leadMin": null,
      "leadMax": null,
      "ratings": [
       {
        "rating": "Lifestyle",
        "min": 4
       },
       {
        "rating": "History Rating",
        "min": 5
       }
      ],
      "ratingsMode": "any",
      "other": "",
      "modifier": -6,
      "advantages": [
       "Crisis",
       "Favor"
      ],
      "summary": "Pull the seducer into the target's messy life and extract favors.",
      "note": "If this Strategy succeeds, the time needed to complete the favor is added to the round's duration (** mark). Duration cell is printed as only the ** mark.",
      "roundDuration": "**"
     },
     {
      "id": "people-will-talk",
      "name": "“People Will Talk”",
      "side": "prey",
      "requirements": "Lifestyle 6+ or History Rating 4+",
      "leadMin": null,
      "leadMax": null,
      "ratings": [
       {
        "rating": "Lifestyle",
        "min": 6
       },
       {
        "rating": "History Rating",
        "min": 4
       }
      ],
      "ratingsMode": "any",
      "other": "",
      "modifier": 0,
      "advantages": [
       "Lead"
      ],
      "summary": "Back away over concern for appearances.",
      "note": "",
      "roundDuration": "—"
     },
     {
      "id": "tell-me-more",
      "name": "“Tell Me More”",
      "side": "prey",
      "requirements": "Lead 6–9",
      "leadMin": 6,
      "leadMax": 9,
      "ratings": [],
      "ratingsMode": null,
      "other": "",
      "modifier": -4,
      "advantages": [
       "Stress",
       "Favor"
      ],
      "summary": "Feign interest to test the seducer's intentions.",
      "note": "If this Strategy succeeds, the time needed to complete the favor is added to the round's duration (** mark). Duration cell is printed as only the ** mark.",
      "roundDuration": "**"
     }
    ],
    "advantages": [
     {
      "id": "charm",
      "name": "Charm",
      "leadShift": 0,
      "victory": false,
      "summary": "Prey's disposition toward the Predator improves 1 grade until the mission ends (maximum Supportive).",
      "repeat": "Every 3 further picks: 1 more grade.",
      "repeatEvery": 3
     },
     {
      "id": "crisis",
      "name": "Crisis",
      "leadShift": 0,
      "victory": false,
      "summary": "Both sides make a Cultures (Cha) check, DC 25 + opponent's career level; whoever fails commits a faux pas and loses (if both fail, the Conflict continues). A side may skip its check, giving the opponent 2 Lead.",
      "repeat": "Each further pick lowers the winner's own Crisis DC by 4 (minimum 20).",
      "repeatEvery": 1,
      "skipLeadShift": 2,
      "canEndConflict": true
     },
     {
      "id": "disappoint",
      "name": "Disappoint",
      "leadShift": 0,
      "victory": false,
      "summary": "Prey's disposition toward the Predator worsens 1 grade until the mission ends (minimum Hostile).",
      "repeat": "Every 3 further picks: 1 more grade.",
      "repeatEvery": 3
     },
     {
      "id": "favor",
      "name": "Favor",
      "leadShift": 0,
      "victory": false,
      "summary": "Winner may have the loser perform 1 action as if a Persuasion check with up to -6 penalty had succeeded; actually demanding it moves Lead 1 toward the opponent.",
      "repeat": "Each further pick raises the penalty cap by 2 (-8, -10...).",
      "repeatEvery": 1,
      "leadCostIfUsed": 1
     },
     {
      "id": "halt",
      "name": "Halt",
      "leadShift": 0,
      "victory": false,
      "summary": "Seduction ends with no winner; both keep their current dispositions.",
      "repeat": "",
      "endsConflictNoWinner": true
     },
     {
      "id": "lead",
      "name": "Lead",
      "leadShift": 1,
      "victory": false,
      "summary": "Lead moves 1 point toward the winner.",
      "repeat": "Every 2 further picks in the round move Lead 1 more point toward the winner.",
      "repeatEvery": 2
     },
     {
      "id": "pause",
      "name": "Pause",
      "leadShift": 0,
      "victory": false,
      "summary": "Conflict freezes: Lead stays put and no steps resolve next round, though Step 4 actions still happen.",
      "repeat": "Each further pick adds 1 more paused round.",
      "repeatEvery": 1
     },
     {
      "id": "stress",
      "name": "Stress",
      "leadShift": 0,
      "victory": false,
      "summary": "Everyone except the winner takes 1d4 stress damage that cannot be recovered until the seduction ends.",
      "repeat": "Each further pick adds +1d4 stress damage.",
      "repeatEvery": 1
     },
     {
      "id": "swap",
      "name": "Swap",
      "leadShift": 0,
      "victory": false,
      "summary": "Predator and Prey trade roles, then Lead increases by 1.",
      "repeat": "",
      "swapRoles": true,
      "absoluteLeadChange": 1
     },
     {
      "id": "twist",
      "name": "Twist",
      "leadShift": 0,
      "victory": false,
      "summary": "Winner may use Bluff (Cha), Cultures (Int), Drive (Dex), Manipulate (Cha), Networking (Cha), Profession (Cha) or Resolve (Wis), without tags, for the next opposed check.",
      "repeat": "",
      "twistSkills": [
       "Bluff (Cha)",
       "Cultures (Int)",
       "Drive (Dex)",
       "Manipulate (Cha)",
       "Networking (Cha)",
       "Profession (Cha)",
       "Resolve (Wis)"
      ]
     },
     {
      "id": "victory",
      "name": "Victory",
      "leadShift": 0,
      "victory": true,
      "summary": "Conflict ends immediately in the winner's favor.",
      "repeat": ""
     }
    ],
    "victory": {
     "predator": "Prey's disposition toward the Predator becomes Helpful and stays there until something else changes it.",
     "prey": "Prey's disposition becomes Adversarial; it cannot improve, and this Predator cannot seduce him again, for the rest of the mission."
    },
    "outsideActions": "",
    "tables": {},
    "notes": [
     "One Predator against one Prey; no group rules are given for this Conflict.",
     "Round length comes from the Predator's Strategy (\"roundDuration\"); Prey strategies list none.",
     "Predator rating requirements use his Spending Cash or his organization's Image Rating; Prey requirements use his Lifestyle or his organization's History Rating.",
     "No alternate skill column: all strategies use Impress (Predator) or Sense Motive (Prey) unless a Twist applies.",
     "An infiltrated organization can run this Conflict against the infiltrator through the infiltration Convert Advantage."
    ]
   }
  },
  "anomalies": [
   {
    "type": "basics",
    "where": "Step 3: Resolution (p.363)",
    "printed": "\"...to a newlict round\"",
    "comment": "Extraction garble for \"new Conflict round\"; no data impact."
   },
   {
    "type": "chase",
    "where": "Prey Skill line (p.364)",
    "printed": "\"Athletics Maneuver (foot)\" and \"Survival Maneuver (animal)\"",
    "comment": "Slash missing in the Prey list only; transcribed as Athletics/Maneuver and Survival/Maneuver to match the Predator list."
   },
   {
    "type": "chase",
    "where": "Table 6.3, Set Up row",
    "printed": "\"Set up\"",
    "comment": "Capitalized \"Set Up\" in the description; name stored as \"Set Up\"."
   },
   {
    "type": "brainwashing",
    "where": "Twist Advantage (p.370)",
    "printed": "\"next opposed check during the same chase\"",
    "comment": "Says \"chase\" in a brainwashing rule; copy-paste slip in the book."
   },
   {
    "type": "brainwashing",
    "where": "Table 6.5 skill column",
    "printed": "Patience (Predator) uses Resolve (Wis); Worrisome Smile (Prey) uses Manipulate (Wis)",
    "comment": "Skills look swapped relative to each side's default but are transcribed as printed."
   },
   {
    "type": "hacking",
    "where": "Table 6.7, “Shall We Play A Game?” row",
    "printed": "\"Computer Power Rating 3+,\" / continuation line \"Probe software\"",
    "comment": "Requirement wraps over two lines; merged as \"Computer Power Rating 3+, Probe software\"."
   },
   {
    "type": "hacking",
    "where": "Table 6.7 Prey rows",
    "printed": "\"Lead: 1–2\", \"Lead: 6–9\", \"Lead: 7–9\"",
    "comment": "Colon after Lead only in the Prey section; kept in \"requirements\", parsed normally."
   },
   {
    "type": "hacking",
    "where": "Silhouette Advantage (p.373)",
    "printed": "\"establish a profile silhouette of the Prey\"",
    "comment": "Context (bonus applies against the target Predator) implies the silhouette is of the Predator."
   },
   {
    "type": "hacking",
    "where": "Seize Control Advantage (p.373)",
    "printed": "\"gains control of 1 program or device\"",
    "comment": "Repeat clause lacks \"additional\"; interpreted as 1 more per pick."
   },
   {
    "type": "infiltration",
    "where": "Table 6.9, Inner Circle Trial row",
    "printed": "\"Lead 1–3**\"",
    "comment": "** is only the Ratings cross-reference from the column header; possibly meant to be the high-profile mark. Left with no extra requirement."
   },
   {
    "type": "infiltration",
    "where": "Table 6.9, Mantrap row",
    "printed": "\"Lead 7-9\"",
    "comment": "Hyphen instead of en dash; parsed as 7 to 9."
   },
   {
    "type": "infiltration",
    "where": "Conspiracy Advantage (p.377)",
    "printed": "\"the Prey may target 1 additional character or squad\"",
    "comment": "Should read Predator, who is the one using this Advantage."
   },
   {
    "type": "infiltration",
    "where": "Table 6.9, “Any except Victory” rows",
    "printed": "\"Any except Victory\"",
    "comment": "Infiltration has no Victory Advantage at all (the book says so on p.379); \"*\" still used."
   },
   {
    "type": "infiltration",
    "where": "Reconnaissance Advantage (p.378)",
    "printed": "\"standard character s.of the Prey’s choice\"",
    "comment": "Extraction/typo garble; no data impact."
   },
   {
    "type": "interrogation",
    "where": "Interrogation Timing (p.380)",
    "printed": "\"During an infiltration, each Conflict round...\"",
    "comment": "Says infiltration in the interrogation section."
   },
   {
    "type": "interrogation",
    "where": "Table 6.12 requirements",
    "printed": "\"Base Will Save +6†\" etc.",
    "comment": "Format differs from other tables (\"+N\" rather than \"N+\"); parsed as minimum N. Good Cop \"+5\" lacks the † the other Predator rows carry."
   },
   {
    "type": "interrogation",
    "where": "Table 6.11, Incentive sub-heading",
    "printed": "\"Incentive†\"",
    "comment": "The † footnote (Prey never submits willingly; exposure) fits the Duress acts; its attachment to the Incentive heading looks like a misprint."
   },
   {
    "type": "interrogation",
    "where": "Crisis Advantage (p.382)",
    "printed": "\"If either participant fails this check, he cracks... ending the interrogation in his opponent’s favor; otherwise... (this is the case even if both participants crack...)\"",
    "comment": "Internally inconsistent; summarized as: exactly one failure ends it, both failing continues."
   },
   {
    "type": "manhunt",
    "where": "Manhunt Strategies intro (p.384)",
    "printed": "\"Table 6.14: Manhunt Strategies (see above)\"",
    "comment": "The strategies table is Table 6.16 on p.386."
   },
   {
    "type": "manhunt",
    "where": "Outcry Advantage (p.385)",
    "printed": "\"during the same Challenge\"",
    "comment": "Other Advantages say \"round\"."
   },
   {
    "type": "manhunt",
    "where": "Table 6.16, Take It Public row",
    "printed": "\"Take it Public\"",
    "comment": "Description uses \"Take It Public\"; stored with capital I."
   },
   {
    "type": "manhunt",
    "where": "Table 6.15 header",
    "printed": "\"Lead / Profiler’s Arrival / Canvass Area/ / Perception Check DC\" (4 header cells, 3 data cells)",
    "comment": "Header split by extraction; merged to \"Canvass Area/Perception Check DC\"."
   },
   {
    "type": "manhunt",
    "where": "Ending a Manhunt (p.386)",
    "printed": "\"or the chase otherwise ends in the Prey’s favor\"",
    "comment": "Says chase where manhunt is meant."
   },
   {
    "type": "seduction",
    "where": "Table 6.17, Seal the Deal",
    "printed": "Row present in table",
    "comment": "No matching entry in the Seduction Strategies description list."
   },
   {
    "type": "seduction",
    "where": "“It’s Not You, It’s Me” (p.387 vs Table 6.17)",
    "printed": "Description speaks of the Predator; table lists it under Prey Only",
    "comment": "Transcribed per the table (Prey)."
   },
   {
    "type": "seduction",
    "where": "Table 6.17 duration cells",
    "printed": "\"**\" alone for “It’s Not You, It’s Me” and “Tell Me More”",
    "comment": "Footnote mark with no duration; kept as \"**\"."
   },
   {
    "type": "seduction",
    "where": "Twist and Victory Advantages (p.388)",
    "printed": "\"during the same chase\"; \"The interrogation ends in the opposed check winner’s favor\"",
    "comment": "Wrong Conflict names; copy-paste slips."
   },
   {
    "type": "seduction",
    "where": "Favor Advantage (p.387)",
    "printed": "\"Influence/Persuasion check\"",
    "comment": "Elsewhere the check is Impress/Persuasion; no such skill as Influence in this chapter."
   },
   {
    "type": "seduction",
    "where": "Charm vs. Ending a Seduction",
    "printed": "Charm maximum \"Supportive\"; Predator victory sets \"Helpful\"; Prey victory sets \"Adversarial\"; Disappoint minimum \"Hostile\"",
    "comment": "Disposition grade names transcribed as printed; verify against the disposition scale."
   }
  ]
 },
 "campaignQualities": [
  {
   "id": "big-budget",
   "name": "Big Budget",
   "page": 406,
   "seasonOnly": true,
   "xp": 0,
   "gcDice": null,
   "summary": "Every gear pick for any character, NPCs included, rises 1 Caliber; a pick pushed past Caliber V also yields 1 extra Caliber I item of that type. Player and special characters start with +4 Wealth.",
   "effects": {
    "gearCaliberShift": 1
   }
  },
  {
   "id": "black-and-white",
   "name": "Black & White",
   "page": 406,
   "seasonOnly": false,
   "xp": 0,
   "gcDice": null,
   "summary": "Every character and NPC is labelled Good or Evil. At GC discretion, actions or attacks meant to harm or hinder the opposite side gain +2, and an exemplary act fitting one's nature earns 1 action die.",
   "effects": {}
  },
  {
   "id": "bleak",
   "name": "Bleak",
   "page": 406,
   "seasonOnly": false,
   "xp": 75,
   "gcDice": null,
   "summary": "Player characters start each session with 2 fewer action dice (minimum 0) and their action dice never explode. Class abilities with uses tied to starting action dice are not reduced.",
   "effects": {
    "startingActionDice": -2,
    "actionDiceExplode": false
   }
  },
  {
   "id": "blockbuster",
   "name": "Blockbuster",
   "page": 406,
   "seasonOnly": false,
   "xp": 0,
   "gcDice": 2,
   "summary": "Explosion blast increments are tripled. A player character whose successful save would halve damage or an effect ignores it completely instead. Interrupted range increments no longer raise explosion damage.",
   "effects": {
    "blastIncrementMultiplier": 3
   }
  },
  {
   "id": "bloodbath",
   "name": "Bloodbath",
   "page": 406,
   "seasonOnly": false,
   "xp": 0,
   "gcDice": 2,
   "summary": "Any threat scored on a successful attack by a player or special character becomes a critical hit automatically unless the attacker pays 1 action die to prevent it.",
   "effects": {
    "autoActivateThreats": true
   }
  },
  {
   "id": "bottomless-clip",
   "name": "Bottomless Clip",
   "page": 406,
   "seasonOnly": false,
   "xp": -25,
   "gcDice": 1,
   "summary": "Weapons that normally hold 5 or more shots never run out of ammunition.",
   "effects": {}
  },
  {
   "id": "bulletproof",
   "name": "Bulletproof",
   "page": 406,
   "seasonOnly": false,
   "xp": -75,
   "gcDice": 1,
   "summary": "Activating a critical injury on a player or special character costs 1 more action die. Critical injury saves apply at 36-60 damage and the drop to -9 wounds at 61+. Medicine DCs fall by 5 and error ranges by 2.",
   "effects": {
    "criticalInjuryActivationCost": 1,
    "criticalInjuryRange": [
     36,
     60
    ],
    "massiveDamageThreshold": 61,
    "medicineDC": -5,
    "medicineError": -2
   }
  },
  {
   "id": "cakewalk",
   "name": "Cakewalk",
   "page": 406,
   "seasonOnly": false,
   "xp": -75,
   "gcDice": 1,
   "summary": "All skill DCs drop by 5 (minimum 10). In the Intel Phase each player character picks skills up to his Intelligence modifier; for the mission those get error range -2 (minimum 1) and taking 10 needs no doubled time.",
   "effects": {
    "skillDC": -5,
    "skillDCMinimum": 10
   }
  },
  {
   "id": "catch-phrase",
   "name": "Catch Phrase",
   "page": 406,
   "seasonOnly": false,
   "xp": -25,
   "gcDice": 1,
   "summary": "Once per session, on a threat with an attack or skill check, a player or special character may use a free action to voice a signature line: morale bonus to Defense and Resist checks of 2x Charisma bonus (minimum +1) for half career level rounds, rounded up.",
   "effects": {}
  },
  {
   "id": "the-circuit",
   "name": "The Circuit",
   "page": 406,
   "seasonOnly": true,
   "xp": 0,
   "gcDice": null,
   "summary": "Whenever a player character earns a feat choice outside the Chase tree, a Chase feat may be taken in its place.",
   "effects": {
    "bonusFeatTree": "Chase"
   }
  },
  {
   "id": "clandestine",
   "name": "Clandestine",
   "page": 406,
   "seasonOnly": true,
   "xp": 0,
   "gcDice": null,
   "summary": "Whenever a player character earns a feat choice outside the Covert tree, a Covert feat may be taken in its place.",
   "effects": {
    "bonusFeatTree": "Covert"
   }
  },
  {
   "id": "comedy-of-errors",
   "name": "Comedy of Errors",
   "page": 406,
   "seasonOnly": false,
   "xp": 75,
   "gcDice": 3,
   "summary": "For everyone, NPCs included: skill DCs rise by 5; error range +2 on skills keyed to a character's lowest attribute; at most 2 action dice may be spent activating a skill error; taking 10 takes 4x standard time instead of 2x.",
   "effects": {
    "skillDC": 5
   }
  },
  {
   "id": "common-spectacle",
   "name": "Common Spectacle",
   "page": 406,
   "seasonOnly": true,
   "xp": -25,
   "gcDice": null,
   "summary": "A Triumph happens on any skill check result of 60 or more, but the XP bonus for a Triumph falls to 5%.",
   "effects": {
    "triumphResult": 60,
    "triumphXPPercent": 5
   }
  },
  {
   "id": "corrupt",
   "name": "Corrupt",
   "page": 406,
   "seasonOnly": false,
   "xp": -25,
   "gcDice": 1,
   "summary": "The GC cannot spend action dice to mark characters as honorable during bribes. Reputation and Net Worth exposure penalties for breaking an honor code are halved, rounded down.",
   "effects": {}
  },
  {
   "id": "diplomatic",
   "name": "Diplomatic",
   "page": 406,
   "seasonOnly": false,
   "xp": -25,
   "gcDice": 1,
   "summary": "Skill check bonuses a player or special character receives from a target's positive disposition are 1 higher.",
   "effects": {}
  },
  {
   "id": "elite-ops",
   "name": "Elite Ops",
   "page": 406,
   "seasonOnly": true,
   "xp": 0,
   "gcDice": null,
   "summary": "Whenever a player character earns a feat choice outside the Skill tree, a Basic Skill feat may be taken in its place.",
   "effects": {
    "bonusFeatTree": "Basic Skill"
   }
  },
  {
   "id": "faction",
   "name": "Faction",
   "page": 407,
   "seasonOnly": true,
   "xp": 0,
   "gcDice": null,
   "summary": "All player characters serve one large organization and use the Faction gear rules. They earn only Reputation, never Net Worth. Cannot be combined with Freelance.",
   "effects": {
    "gearRules": "faction"
   }
  },
  {
   "id": "fast-attributes",
   "name": "Fast Attributes",
   "page": 407,
   "seasonOnly": true,
   "xp": -75,
   "gcDice": null,
   "summary": "Player characters gain 1 attribute point every 3 career levels instead of every 4.",
   "effects": {
    "attributeInterval": 3
   }
  },
  {
   "id": "fast-feats",
   "name": "Fast Feats",
   "page": 407,
   "seasonOnly": true,
   "xp": -50,
   "gcDice": null,
   "summary": "Player characters gain 1 feat every 2 career levels instead of every 3.",
   "effects": {
    "featInterval": 2
   }
  },
  {
   "id": "fast-growth",
   "name": "Fast Growth",
   "page": 407,
   "seasonOnly": true,
   "xp": 0,
   "gcDice": null,
   "summary": "XP needed for each level is halved (rounded down), and up to 2 levels may be gained between missions.",
   "effects": {
    "xpToLevelFraction": 0.5
   }
  },
  {
   "id": "fast-interests",
   "name": "Fast Interests",
   "page": 407,
   "seasonOnly": true,
   "xp": -25,
   "gcDice": null,
   "summary": "Player characters gain 1 Interest every 3 career levels instead of every 4.",
   "effects": {
    "interestInterval": 3
   }
  },
  {
   "id": "fast-proficiencies",
   "name": "Fast Proficiencies",
   "page": 407,
   "seasonOnly": true,
   "xp": -25,
   "gcDice": null,
   "summary": "Player characters gain 1 proficiency every career level instead of every 2.",
   "effects": {
    "proficiencyInterval": 1
   }
  },
  {
   "id": "feat-purchase",
   "name": "Feat Purchase",
   "page": 407,
   "seasonOnly": true,
   "xp": 0,
   "gcDice": null,
   "summary": "After each mission a player character may trade 1,000 XP x career level for 1 extra feat, but cannot drop below the XP minimum for his current career level.",
   "effects": {}
  },
  {
   "id": "fragile",
   "name": "Fragile",
   "page": 407,
   "seasonOnly": true,
   "xp": 0,
   "gcDice": null,
   "summary": "After Level 1, player and special characters gain fixed vitality per career level: 2 with a d8 vitality die, 3 with a d10, 4 with a d12.",
   "effects": {}
  },
  {
   "id": "freelance",
   "name": "Freelance",
   "page": 407,
   "seasonOnly": true,
   "xp": 0,
   "gcDice": null,
   "summary": "All player characters work through a network of supporters and use the Freelance gear rules. They earn only Net Worth, never Reputation. Cannot be combined with Faction.",
   "effects": {
    "gearRules": "freelance"
   }
  },
  {
   "id": "gladiators",
   "name": "Gladiators",
   "page": 407,
   "seasonOnly": true,
   "xp": 0,
   "gcDice": null,
   "summary": "CQB range runs from Melee Range out to 20 ft. Every character, NPCs included, gets a Defense bonus against ranged attacks equal to his count of Melee and Unarmed Combat feats. Nobody may interrupt or join a Stand Off.",
   "effects": {}
  },
  {
   "id": "the-great-game",
   "name": "The Great Game",
   "page": 407,
   "seasonOnly": true,
   "xp": 0,
   "gcDice": null,
   "summary": "Whenever a player character earns a feat choice outside the Tradecraft tree, a Tradecraft feat may be taken in its place.",
   "effects": {
    "bonusFeatTree": "Tradecraft"
   }
  },
  {
   "id": "gritty",
   "name": "Gritty",
   "page": 407,
   "seasonOnly": false,
   "xp": 100,
   "gcDice": 4,
   "summary": "Activating a critical injury on a player or special character costs 1 fewer action die (minimum 0). Critical injury saves apply at 16-25 damage and the drop to -9 wounds at 26+. Medicine DCs rise by 5 and error ranges by 2.",
   "effects": {
    "criticalInjuryActivationCost": -1,
    "criticalInjuryRange": [
     16,
     25
    ],
    "massiveDamageThreshold": 26,
    "medicineDC": 5,
    "medicineError": 2
   }
  },
  {
   "id": "guerilla-warfare",
   "name": "Guerilla Warfare",
   "page": 407,
   "seasonOnly": true,
   "xp": 0,
   "gcDice": null,
   "summary": "Whenever a player character earns a feat choice outside the Terrain tree, a Terrain feat may be taken in its place.",
   "effects": {
    "bonusFeatTree": "Terrain"
   }
  },
  {
   "id": "gunmen",
   "name": "Gunmen",
   "page": 407,
   "seasonOnly": true,
   "xp": 0,
   "gcDice": null,
   "summary": "For everyone, NPCs included: CQB range runs from Melee Range out to 60 ft.; range increments are doubled; Aim and Brace benefits survive movement by shooter or target unless either Runs or the target leaves line of sight.",
   "effects": {
    "rangeIncrementMultiplier": 2
   }
  },
  {
   "id": "historical",
   "name": "Historical",
   "page": 407,
   "seasonOnly": true,
   "xp": 0,
   "gcDice": null,
   "summary": "The season is set in a chosen year. Items not yet introduced count as gadget Housings or effects at +1 Caliber (maximum V). Money values and actual costs are multiplied per Table 7.4, from x0.01 (1875-1900) up to x1 (1990 onward).",
   "effects": {}
  },
  {
   "id": "hybrid",
   "name": "Hybrid",
   "page": 407,
   "seasonOnly": true,
   "xp": 0,
   "gcDice": null,
   "summary": "Each player character is either a Faction character (Faction gear rules, Reputation only) or a Freelancer (Freelance gear rules, Net Worth only).",
   "effects": {
    "gearRules": "hybrid"
   }
  },
  {
   "id": "jack-of-all-trades",
   "name": "Jack-of-All-Trades",
   "page": 407,
   "seasonOnly": true,
   "xp": 0,
   "gcDice": null,
   "summary": "Every skill counts as a class skill for every class. Skill points gained do not change.",
   "effects": {}
  },
  {
   "id": "the-market",
   "name": "The Market",
   "page": 407,
   "seasonOnly": true,
   "xp": 0,
   "gcDice": null,
   "summary": "Whenever a player character earns a feat choice outside the Gear tree, a Gear feat may be taken in its place.",
   "effects": {
    "bonusFeatTree": "Gear"
   }
  },
  {
   "id": "mellow",
   "name": "Mellow",
   "page": 407,
   "seasonOnly": false,
   "xp": -75,
   "gcDice": null,
   "summary": "All stress damage is halved (rounded down, minimum 1).",
   "effects": {}
  },
  {
   "id": "mercenary",
   "name": "Mercenary",
   "page": 408,
   "seasonOnly": true,
   "xp": 0,
   "gcDice": null,
   "summary": "Whenever a player character earns a feat choice outside the Combat tree, a Basic Combat feat may be taken in its place.",
   "effects": {
    "bonusFeatTree": "Basic Combat"
   }
  },
  {
   "id": "modular",
   "name": "Modular",
   "page": 408,
   "seasonOnly": true,
   "xp": 0,
   "gcDice": null,
   "summary": "At character creation a player may buy extra feats for 2 attribute-purchase points each, or surrender feat choices to gain 2 extra attribute-purchase points per feat given up.",
   "effects": {}
  },
  {
   "id": "omni-competent",
   "name": "Omni-Competent",
   "page": 408,
   "seasonOnly": false,
   "xp": -100,
   "gcDice": 1,
   "summary": "Skill check result caps are removed, all checks count as active, and every skill check penalty is halved (rounded down, minimum -1).",
   "effects": {}
  },
  {
   "id": "paranoid",
   "name": "Paranoid",
   "page": 408,
   "seasonOnly": false,
   "xp": 0,
   "gcDice": 2,
   "summary": "Player and special characters get +4 morale on Blend/Stealth and Sneak/Hide checks that decide surprise rounds. All characters take -4 morale on skill checks to shift disposition or persuade a target into an action.",
   "effects": {}
  },
  {
   "id": "rare-spectacle",
   "name": "Rare Spectacle",
   "page": 408,
   "seasonOnly": false,
   "xp": 25,
   "gcDice": 4,
   "summary": "A Triumph happens only on a skill check result of 90 or more.",
   "effects": {
    "triumphResult": 90
   }
  },
  {
   "id": "revolving-door",
   "name": "Revolving Door",
   "page": 408,
   "seasonOnly": true,
   "xp": 0,
   "gcDice": null,
   "summary": "A player character who dies in a standard scene with his body intact may come back at the start of the next mission, at a cost of 200 Reputation or $10,000,000.",
   "effects": {}
  },
  {
   "id": "routine",
   "name": "Routine",
   "page": 408,
   "seasonOnly": true,
   "xp": 0,
   "gcDice": null,
   "summary": "Characters can never take on Crossroads Subplots.",
   "effects": {}
  },
  {
   "id": "shoe-string-budget",
   "name": "Shoe String Budget",
   "page": 408,
   "seasonOnly": true,
   "xp": 0,
   "gcDice": null,
   "summary": "Every gear pick for any character, NPCs included, drops 1 Caliber; a pick pushed below Caliber I is lost. Each PC starts with a Debt Subplot.",
   "effects": {
    "gearCaliberShift": -1
   }
  },
  {
   "id": "slow-attributes",
   "name": "Slow Attributes",
   "page": 408,
   "seasonOnly": true,
   "xp": 75,
   "gcDice": null,
   "summary": "Player characters gain 1 attribute point every 5 career levels instead of every 4.",
   "effects": {
    "attributeInterval": 5
   }
  },
  {
   "id": "slow-feats",
   "name": "Slow Feats",
   "page": 408,
   "seasonOnly": true,
   "xp": 50,
   "gcDice": null,
   "summary": "Player characters gain 1 feat every 4 career levels instead of every 3.",
   "effects": {
    "featInterval": 4
   }
  },
  {
   "id": "slow-growth",
   "name": "Slow Growth",
   "page": 408,
   "seasonOnly": true,
   "xp": 0,
   "gcDice": null,
   "summary": "XP needed for each level is doubled.",
   "effects": {
    "xpToLevelFraction": 2
   }
  },
  {
   "id": "slow-interests",
   "name": "Slow Interests",
   "page": 408,
   "seasonOnly": true,
   "xp": 25,
   "gcDice": null,
   "summary": "Player characters gain 1 Interest every 5 career levels instead of every 4.",
   "effects": {
    "interestInterval": 5
   }
  },
  {
   "id": "slow-proficiencies",
   "name": "Slow Proficiencies",
   "page": 408,
   "seasonOnly": true,
   "xp": 25,
   "gcDice": null,
   "summary": "Player characters gain 1 proficiency every 4 career levels instead of every 2.",
   "effects": {
    "proficiencyInterval": 4
   }
  },
  {
   "id": "small-screen",
   "name": "Small Screen",
   "page": 408,
   "seasonOnly": true,
   "xp": 25,
   "gcDice": null,
   "summary": "Player characters get 32 points for starting attributes instead of 36, and no starting attribute may exceed 18, Origin benefits included.",
   "effects": {}
  },
  {
   "id": "soap",
   "name": "Soap",
   "page": 408,
   "seasonOnly": true,
   "xp": 0,
   "gcDice": null,
   "summary": "Each character may be involved in 1 more Subplot at a time than normal.",
   "effects": {}
  },
  {
   "id": "speed-frame",
   "name": "Speed-Frame",
   "page": 408,
   "seasonOnly": false,
   "xp": -25,
   "gcDice": 1,
   "summary": "Complex Tasks need 1 fewer Challenge (minimum 1). In Dramatic Conflicts, every Lead Advantage has its effect raised by 1.",
   "effects": {}
  },
  {
   "id": "spirited",
   "name": "Spirited",
   "page": 408,
   "seasonOnly": false,
   "xp": -50,
   "gcDice": null,
   "summary": "Player characters start each session with 2 extra action dice (class ability uses tied to starting dice unchanged). Their action dice also explode on a natural 1, and every action die type steps up 1 size (d4 to d6, d6 to d8, and so on).",
   "effects": {
    "startingActionDice": 2
   }
  },
  {
   "id": "strange-providence",
   "name": "Strange Providence",
   "page": 408,
   "seasonOnly": true,
   "xp": 0,
   "gcDice": null,
   "summary": "Whenever a player character earns a feat choice outside the Chance tree, a Chance feat may be taken in its place.",
   "effects": {
    "bonusFeatTree": "Chance"
   }
  },
  {
   "id": "style-over-substance",
   "name": "Style Over Substance",
   "page": 408,
   "seasonOnly": true,
   "xp": 0,
   "gcDice": null,
   "summary": "Whenever a player character earns a feat choice outside the Style tree, a Style feat may be taken in its place.",
   "effects": {
    "bonusFeatTree": "Style"
   }
  },
  {
   "id": "subtle",
   "name": "Subtle",
   "page": 408,
   "seasonOnly": false,
   "xp": -50,
   "gcDice": 2,
   "summary": "Every attack check by any character, NPCs included, takes a -1 penalty.",
   "effects": {}
  },
  {
   "id": "tense",
   "name": "Tense",
   "page": 408,
   "seasonOnly": false,
   "xp": 75,
   "gcDice": 3,
   "summary": "All stress damage is doubled, and no character of any type may take 10 on a skill check.",
   "effects": {}
  },
  {
   "id": "thriller",
   "name": "Thriller",
   "page": 408,
   "seasonOnly": false,
   "xp": 25,
   "gcDice": null,
   "summary": "Complex Tasks need 1 more Challenge (may exceed 10). In Dramatic Conflicts, every Lead result has its effect lowered by 1 (minimum 0).",
   "effects": {}
  },
  {
   "id": "violent",
   "name": "Violent",
   "page": 408,
   "seasonOnly": false,
   "xp": 50,
   "gcDice": 2,
   "summary": "Threat ranges of all attack checks by any character, NPCs included, widen by 2.",
   "effects": {}
  },
  {
   "id": "virtuous",
   "name": "Virtuous",
   "page": 408,
   "seasonOnly": false,
   "xp": 25,
   "gcDice": 1,
   "summary": "Reputation and Net Worth exposure penalties for breaking an honor code are doubled.",
   "effects": {}
  },
  {
   "id": "wire-fu",
   "name": "Wire Fu",
   "page": 408,
   "seasonOnly": false,
   "xp": -25,
   "gcDice": 1,
   "summary": "Player and special characters may move in any direction, including straight up or along walls. Ending movement off a stable surface triggers the falling rules, but falling damage is halved (rounded down).",
   "effects": {}
  }
 ]
};
