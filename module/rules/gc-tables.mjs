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
     "group": "Attacks, movement",
     "label": "Terrain slowed movement",
     "amount": -2
    },
    {
     "id": "oneHandedTwoHands",
     "group": "Attacks, movement",
     "label": "Two-handed grip on a one-handed firearm",
     "amount": -2
    },
    {
     "id": "tactical",
     "group": "Attacks, movement",
     "label": "Tactical weapon fired",
     "amount": -2
    },
    {
     "id": "unproficient",
     "group": "Attacks, movement",
     "label": "Unproficient weapon (once per weapon)",
     "amount": -4
    },
    {
     "id": "finalAttack",
     "group": "Attacks, movement",
     "label": "Final attack (each)",
     "amount": -2
    },
    {
     "id": "criticalMiss",
     "group": "Attacks, movement",
     "label": "Critical miss/failure (per die spent on it)",
     "amount": -2
    },
    {
     "id": "triumph",
     "group": "Attacks, movement",
     "label": "Triumph",
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
     "label": "Critical injury taken",
     "amount": -10,
     "oncePerRound": true
    },
    {
     "id": "woundLoss",
     "group": "Injuries",
     "label": "Wound loss (per injury)",
     "amount": -2
    },
    {
     "id": "criticalWoundLoss",
     "group": "Injuries",
     "label": "Critical hit with wound loss (per injury; instead of the wound-loss modifier)",
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
     "group": "Checks and saves",
     "label": "Diversion: failed Sense Motive (1d4; 2d4 on a critical)",
     "amount": null,
     "variable": "diversion"
    },
    {
     "id": "failedSave",
     "group": "Checks and saves",
     "label": "Failed save",
     "amount": -2
    },
    {
     "id": "failedStressSave",
     "group": "Checks and saves",
     "label": "Failed save vs. stress damage",
     "amount": -5
    },
    {
     "id": "failedExplosiveSave",
     "group": "Checks and saves",
     "label": "Failed save vs. explosive damage",
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
     "label": "NPC roll boost",
     "cost": 1,
     "rolls": "npc",
     "needsNpc": true,
     "page": 397
    },
    {
     "id": "boostDefense",
     "label": "NPC Defense boost (+2, rounds = die result)",
     "cost": 1,
     "rolls": "npc",
     "needsNpc": true,
     "page": 397
    },
    {
     "id": "boostDefenseAfterHit",
     "label": "Dramatic scene: NPC Defense boost against one landed attack",
     "cost": 1,
     "rolls": "npc",
     "needsNpc": true,
     "dramaticOnly": true,
     "repeatable": true,
     "page": 424
    },
    {
     "id": "boostDC",
     "label": "DC boost (d12, declared before the check)",
     "cost": 1,
     "rolls": "d12",
     "page": 397
    },
    {
     "id": "boostInitiative",
     "label": "Dramatic scene: opponent Initiative Count boost",
     "cost": 1,
     "rolls": "npc",
     "needsNpc": true,
     "dramaticOnly": true,
     "repeatable": true,
     "page": 424
    },
    {
     "id": "activateThreat",
     "label": "NPC threat activation",
     "cost": 1,
     "variableCost": true,
     "needsNpc": true,
     "page": 397
    },
    {
     "id": "activateError",
     "label": "Error activation against an NPC's opponent",
     "cost": 1,
     "variableCost": true,
     "page": 398
    },
    {
     "id": "healNpc",
     "label": "NPC healing",
     "cost": 1,
     "rolls": "npc",
     "needsNpc": true,
     "repeatable": true,
     "page": 398
    },
    {
     "id": "promote",
     "label": "Standard NPC promotion (special until mission end)",
     "cost": 2,
     "needsNpc": true,
     "page": 398
    },
    {
     "id": "saveNpc",
     "label": "Special NPC escape from death or capture",
     "cost": 4,
     "needsNpc": true,
     "page": 398
    },
    {
     "id": "campaignQuality",
     "label": "Campaign quality added in the Intel Phase",
     "cost": null,
     "page": 398
    },
    {
     "id": "dramaticScene",
     "label": "Dramatic scene declared",
     "cost": 4,
     "page": 398
    },
    {
     "id": "event",
     "label": "Event (1–4 dice; 1 less with a trigger)",
     "cost": null,
     "page": 399
    },
    {
     "id": "knowsNothing",
     "label": "Questioned NPC knows nothing (1 standard or minion; 2 special or henchman)",
     "cost": null,
     "needsNpc": true,
     "page": 459
    },
    {
     "id": "terminalSituation",
     "label": "Terminal Situation: a trapped character is knocked out or left dying",
     "cost": 1,
     "page": 350
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
     "This mission: the team has already finished all of its listed objectives"
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
     "This scene: error on a Knowledge check made to navigate a war zone or similarly hazardous area",
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
     "This mission: target erred on any Networking, Manipulate, Intimidate, Impress or Cultures check"
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
     "+1 Tier III NPC out to kill, capture or destroy it (min 1)"
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
     "This or the previous mission, once the Intel Phase is over: the team gained an item of Caliber III+ or worth over $50,000"
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
     "This mission: team no more than 1 mile from a public explosion dealing 20+ damage, front-page news, or public tumult involving 100+ people",
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
      "text": "Nothing of note",
      "data": {}
     },
     {
      "range": [
       2,
       2
      ],
      "text": "Reading matter",
      "data": {}
     },
     {
      "range": [
       3,
       3
      ],
      "text": "Social contact detail",
      "data": {}
     },
     {
      "range": [
       4,
       4
      ],
      "text": "Personal music player",
      "data": {}
     },
     {
      "range": [
       5,
       7
      ],
      "text": "Phone with 1d12 stored contacts",
      "data": {
       "numbers": "1d12"
      }
     },
     {
      "range": [
       8,
       10
      ],
      "text": "Keys: Caliber I–II vehicle within 1d4 blocks; home within 2d20 miles (Lifestyle 1d6)",
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
      "text": "Wallet: ID, personal papers, 2d6 × $50",
      "data": {
       "cash": "2d6 * 50"
      }
     },
     {
      "range": [
       19,
       19
      ],
      "text": "Police badge: harming this person can bring the Wanted event (p.404)",
      "data": {
       "event": "wanted"
      }
     },
     {
      "range": [
       20,
       20
      ],
      "text": "1 Caliber I firearm or melee weapon (GC's choice or roll)",
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
      "text": "Grim personal keepsake",
      "data": {}
     },
     {
      "range": [
       2,
       3
      ],
      "text": "Tobacco",
      "data": {}
     },
     {
      "range": [
       4,
       5
      ],
      "text": "Organization-themed pastime item",
      "data": {}
     },
     {
      "range": [
       6,
       6
      ],
      "text": "Handheld game",
      "data": {}
     },
     {
      "range": [
       7,
       7
      ],
      "text": "Lucky charm",
      "data": {}
     },
     {
      "range": [
       8,
       8
      ],
      "text": "Motivational recording",
      "data": {}
     },
     {
      "range": [
       9,
       9
      ],
      "text": "Joke kit: Authentication",
      "data": {}
     },
     {
      "range": [
       10,
       10
      ],
      "text": "Joke kit: Climbing",
      "data": {}
     },
     {
      "range": [
       11,
       11
      ],
      "text": "Joke kit: Disguise",
      "data": {}
     },
     {
      "range": [
       12,
       12
      ],
      "text": "Joke kit: Electronics",
      "data": {}
     },
     {
      "range": [
       13,
       13
      ],
      "text": "Joke kit: Forgery",
      "data": {}
     },
     {
      "range": [
       14,
       14
      ],
      "text": "Joke kit: Mechanics",
      "data": {}
     },
     {
      "range": [
       15,
       15
      ],
      "text": "Personal financial records",
      "data": {}
     },
     {
      "range": [
       16,
       18
      ],
      "text": "Code-name ID",
      "data": {}
     },
     {
      "range": [
       19,
       20
      ],
      "text": "Real-name ID",
      "data": {}
     },
     {
      "range": [
       20,
       20
      ],
      "text": "Clue: one of this organization's henchmen",
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
      "text": "Pager",
      "data": {}
     },
     {
      "range": [
       2,
       2
      ],
      "text": "Unlabelled pills (harmless)",
      "data": {}
     },
     {
      "range": [
       3,
       3
      ],
      "text": "Engraved flask",
      "data": {}
     },
     {
      "range": [
       4,
       4
      ],
      "text": "Note with a foil's name and number",
      "data": {}
     },
     {
      "range": [
       5,
       5
      ],
      "text": "Memento of an old wound",
      "data": {}
     },
     {
      "range": [
       6,
       6
      ],
      "text": "Grisly dead-drop item",
      "data": {}
     },
     {
      "range": [
       7,
       7
      ],
      "text": "Two identical bottles: one a drink, one dealing 2d10 acid damage",
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
      "text": "Scrap of paper with a saying",
      "data": {}
     },
     {
      "range": [
       9,
       9
      ],
      "text": "Odd cosmetic item",
      "data": {}
     },
     {
      "range": [
       10,
       10
      ],
      "text": "Unfinished likeness of a superior",
      "data": {}
     },
     {
      "range": [
       11,
       11
      ],
      "text": "Joke kit: Lockpicking",
      "data": {}
     },
     {
      "range": [
       12,
       12
      ],
      "text": "Joke kit: Surgery",
      "data": {}
     },
     {
      "range": [
       13,
       13
      ],
      "text": "Organization insignia, worn",
      "data": {}
     },
     {
      "range": [
       14,
       14
      ],
      "text": "Weapon part",
      "data": {}
     },
     {
      "range": [
       15,
       16
      ],
      "text": "Code-name ID",
      "data": {}
     },
     {
      "range": [
       17,
       17
      ],
      "text": "Real-name ID",
      "data": {}
     },
     {
      "range": [
       18,
       18
      ],
      "text": "Clue: a different henchman of this organization",
      "data": {
       "clue": "henchman"
      }
     },
     {
      "range": [
       19,
       19
      ],
      "text": "Clue to the organization's mastermind",
      "data": {
       "clue": "mastermind"
      }
     },
     {
      "range": [
       20,
       20
      ],
      "text": "Minor clue to the current mission (GC's choice)",
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
      "text": "Dossier on 1 player character",
      "data": {}
     },
     {
      "range": [
       2,
       2
      ],
      "text": "Evidence of punished deserters",
      "data": {}
     },
     {
      "range": [
       3,
       3
      ],
      "text": "Tickets to an event tonight",
      "data": {}
     },
     {
      "range": [
       4,
       4
      ],
      "text": "Blackmail material on a local official",
      "data": {}
     },
     {
      "range": [
       5,
       5
      ],
      "text": "Name of 1 uncooperative but informed contact",
      "data": {}
     },
     {
      "range": [
       6,
       6
      ],
      "text": "Prescription medication",
      "data": {}
     },
     {
      "range": [
       7,
       7
      ],
      "text": "Private vanity recording",
      "data": {}
     },
     {
      "range": [
       8,
       8
      ],
      "text": "Design sketch for a new deathtrap",
      "data": {}
     },
     {
      "range": [
       9,
       9
      ],
      "text": "Draft speech for a captive",
      "data": {}
     },
     {
      "range": [
       10,
       10
      ],
      "text": "Reference book on his trade",
      "data": {}
     },
     {
      "range": [
       11,
       11
      ],
      "text": "Vanity collectible",
      "data": {}
     },
     {
      "range": [
       12,
       12
      ],
      "text": "Receipts for black-market purchases (1 exotic animal, 1 military hardware item)",
      "data": {}
     },
     {
      "range": [
       13,
       13
      ],
      "text": "Inconclusive conspiracy evidence",
      "data": {}
     },
     {
      "range": [
       14,
       14
      ],
      "text": "Small venomous pet: Tier II attack bonus, poison by GC's choice or roll",
      "data": {
       "attackTier": "II"
      }
     },
     {
      "range": [
       15,
       15
      ],
      "text": "Personal task list",
      "data": {}
     },
     {
      "range": [
       16,
       16
      ],
      "text": "List of 1d6 targeted cities",
      "data": {
       "count": "1d6"
      }
     },
     {
      "range": [
       17,
       17
      ],
      "text": "List of 1d6 henchmen out of favour, each Marked for Death (p.399)",
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
      "text": "1 Caliber I gadget (GC's choice or roll)",
      "data": {
       "caliber": "I"
      }
     },
     {
      "range": [
       19,
       19
      ],
      "text": "Single-button remote, random effect (GC's choice; e.g. escape route or 6d6 explosive)",
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
      "text": "Major clue to this or the next mission (GC's choice)",
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
      "1 dose: any basic poison, or any disease of Complexity DC 50 or less"
     ],
     [
      "Contagion",
      "2",
      "1 dose: any improved poison, or any disease of Complexity DC 55-60"
     ],
     [
      "Contagion",
      "3",
      "1 dose: an advanced poison (weakening, truth serum, psychotropic, neurotoxin, necrotizing, fear, dementia), or any disease of Complexity DC 65-70"
     ],
     [
      "Contagion",
      "4",
      "1 dose: an advanced poison (radiation, paralytic, lethal, knockout, hallucinogen, blister), or any disease of Complexity DC 75-80"
     ],
     [
      "Contagion",
      "5*",
      "1 dose: Encephalitis/Meningitis, or any disease of Complexity DC 85-90"
     ],
     [
      "Contagion",
      "6*",
      "1 dose: Tuberculosis, or any disease of Complexity DC 95-105"
     ],
     [
      "Contagion",
      "7*",
      "1 dose: Bubonic plague, or any disease of Complexity DC 110-125"
     ],
     [
      "Contagion",
      "8*",
      "1 dose: Ebola, or any disease of Complexity DC 130+"
     ],
     [
      "Explosion",
      "1",
      "Centered 3d4 squares from a chosen character; 2d10 explosive; blast increment 1 square"
     ],
     [
      "Explosion",
      "2",
      "Centered 2d4 squares from a chosen character; 4d10 explosive; blast increment 1 square"
     ],
     [
      "Explosion",
      "3",
      "Centered 1d4 squares from a chosen character; 6d10 explosive; blast increment 2 squares"
     ],
     [
      "Explosion",
      "4",
      "Centered on a chosen character; 8d10 explosive; blast increment 2 squares"
     ],
     [
      "Random Fire/Crossfire",
      "1",
      "Attack on 1 character: grade II NPC attack bonus, any Caliber I firearm"
     ],
     [
      "Random Fire/Crossfire",
      "2",
      "Attack on 1 character: grade IV NPC attack bonus, any Caliber II firearm"
     ],
     [
      "Random Fire/Crossfire",
      "3",
      "Attack on 1 character: grade VI NPC attack bonus, any Caliber III firearm"
     ],
     [
      "Random Fire/Crossfire",
      "4",
      "Attack on 1 character: grade VIII NPC attack bonus, any Caliber IV firearm"
     ],
     [
      "Runaway Vehicle",
      "1",
      "Runs at 1d4 characters: grade II NPC skill bonus, any Caliber I vehicle"
     ],
     [
      "Runaway Vehicle",
      "2",
      "Runs at 1d4 characters: grade IV NPC skill bonus, any Caliber II vehicle"
     ],
     [
      "Runaway Vehicle",
      "3",
      "Runs at 1d4 characters: grade VI NPC skill bonus, any Caliber III vehicle"
     ],
     [
      "Runaway Vehicle",
      "4",
      "Runs at 1d4 characters: grade VIII NPC skill bonus, any Caliber IV vehicle"
     ],
     [
      "Security",
      "1",
      "Blocked by a Power Rating 2 security device"
     ],
     [
      "Security",
      "2",
      "Blocked by a Power Rating 4 security device"
     ],
     [
      "Security",
      "3",
      "Blocked by a Power Rating 6 security device"
     ],
     [
      "Security",
      "4",
      "Blocked by a Power Rating 8 security device"
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
      "poison": "advanced (weakening, truth serum, psychotropic, neurotoxin, necrotizing, fear, dementia)",
      "diseaseComplexityDC": "65-70"
     },
     {
      "cost": 4,
      "poison": "advanced (radiation, paralytic, lethal, knockout, hallucinogen, blister)",
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
     "* Contagion at 5-8 dice breaks the usual 4-dice ceiling for a hazard; keep it for plot-critical moments the team can handle."
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
      "1 round; -2 attack and Dex skills; Ref DC 10 or 1d4 lethal + stress and sprawled"
     ],
     [
      "Earthquake",
      "2",
      "Minor quake",
      "1d4 rounds; -4 attack and Dex skills; each round Ref DC 15 or 1d4 lethal + stress and sprawled"
     ],
     [
      "Earthquake",
      "3",
      "Moderate quake",
      "2d4 rounds; -6 attack and Dex skills; each round Ref DC 20 or 1d4 lethal + stress and sprawled"
     ],
     [
      "Earthquake",
      "4",
      "Major quake",
      "3d4 rounds; -8 attack and Dex skills; each round Ref DC 25 or 1d4 lethal + stress and sprawled"
     ],
     [
      "Fog",
      "1",
      "Light",
      "1d4 hours; vision effects only (p.350); at the midpoint GC rolls 1d10: 1 = turns moderate"
     ],
     [
      "Fog",
      "2",
      "Moderate",
      "2d4 hours; vision effects only (p.350); at the midpoint GC rolls 1d10: 1 = turns dense"
     ],
     [
      "Fog",
      "3",
      "Dense",
      "3d4 hours; vision effects only (p.350)"
     ],
     [
      "Landslide",
      "1",
      "Indirect slide zone††",
      "Ref DC 15 or 3d6 lethal + stress and buried"
     ],
     [
      "Landslide",
      "2",
      "Direct slide zone††",
      "Ref DC 20 or 6d6 lethal + stress and buried"
     ],
     [
      "Landslide",
      "3",
      "Indirect bury zone††",
      "Buried; 4d6 lethal + stress, Ref DC 15 halves (round down)"
     ],
     [
      "Landslide",
      "4",
      "Direct bury zone††",
      "Buried; 8d6 lethal + stress, Ref DC 20 halves (round down)"
     ],
     [
      "Lightning",
      "1",
      "Distant strike",
      "Flash round: sight range +20 ft., sight-based Awareness/Perception penalties eased by 2 (to +0 at best). Thunder next round: hearing range -20 ft., hearing-based Awareness/Perception -2"
     ],
     [
      "Lightning",
      "2",
      "Local strike",
      "Flash round: 1d6 stress; sight range +40 ft., sight-based Awareness/Perception penalties eased by 4 (to +0 at best). Thunder next round: hearing range -40 ft., hearing-based Awareness/Perception -4"
     ],
     [
      "Lightning",
      "3",
      "Near strike",
      "Flash round: 2d6 flash + bang + stress; Fort DC 10 or sprawled; 1 object or scenery piece within 100 ft. takes 4d10+20 electrical + fire; sight range +60 ft., sight-based penalties eased by 6 (to +0 at best). Thunder next round: hearing range -60 ft., hearing-based Awareness/Perception -6"
     ],
     [
      "Lightning",
      "4",
      "Direct strike",
      "Flash round: 3d6 flash + bang + stress; Fort DC 20 or sprawled; 1 character takes 4d10+20 electrical + fire and is sprawled; sight range +80 ft., sight-based penalties eased by 8 (to +0 at best). Thunder next round: hearing range -80 ft., hearing-based Awareness/Perception -8"
     ],
     [
      "Rain/Snow",
      "1",
      "Light",
      "3d20 minutes; douses each open flame like 1 gal. of water/minute; at the midpoint GC rolls 1d10: 1 = turns moderate"
     ],
     [
      "Rain/Snow",
      "2",
      "Moderate",
      "1d4 hours; douses each open flame like 2 gal. of water/minute; at the midpoint GC rolls 1d10: 1 = turns heavy"
     ],
     [
      "Rain/Snow",
      "3",
      "Heavy",
      "2d4 hours; douses each open flame like 3 gal. of water/minute; at the midpoint GC rolls 1d10: 1 = turns to a storm"
     ],
     [
      "Rain/Snow",
      "4",
      "Thunderstorm/Snowstorm",
      "3d4 hours; douses each open flame like 4 gal. of water/minute; at the midpoint GC rolls 1d10: 1 = hurricane or blizzard, 2 = flash flood or flash freeze"
     ],
     [
      "Rain/Snow",
      "—",
      "Flash Flood",
      "3d6 subdual; Ref DC 15 or sprawled and swept 3d6 x 10 ft., 1d6 lethal per 30 ft. swept"
     ],
     [
      "Rain/Snow",
      "—",
      "Flash Freeze",
      "3d6 cold, plus exposure to the cold contagion (p.231)"
     ],
     [
      "Rain/Snow",
      "—",
      "Hurricane",
      "3d4 hours; treat as severe wind; open flames go out; at the midpoint GC rolls 1d10: 1-4 = flash flood"
     ],
     [
      "Rain/Snow",
      "—",
      "Blizzard",
      "3d4 hours; treat as strong wind; open flames go out; 1d6 cold per hour; at the midpoint GC rolls 1d10: 1-4 = flash freeze"
     ],
     [
      "Volcanic Eruption",
      "1",
      "Gentle",
      "1d6 hours, 1/4-mile radius; 1d6 stress; sight and hearing ranges x 3/4 (round down); Fort DC 10 or deafened through the eruption and 1d6 hours beyond; GC may pay 1 action die for a volcanic bomb on 1 character: 1d10 fire + stress"
     ],
     [
      "Volcanic Eruption",
      "2",
      "Minor",
      "2d6 hours, 1/2-mile radius; 2d6 stress; sight and hearing ranges x 1/2 (round down); Fort DC 15 or deafened through the eruption and 2d6 hours beyond; GC may pay 2 action dice for a volcanic bomb on 1 character: 1d10 fire + stress per die"
     ],
     [
      "Volcanic Eruption",
      "3",
      "Moderate",
      "3d6 hours, 1-mile radius; 3d6 stress; sight and hearing ranges x 1/4 (round down); Fort DC 20 or deafened for 3d6 hours beyond [source text garbled]; volcanic bomb: 1d10 fire + stress per action die; at the midpoint GC rolls 1d10: 1 = poison gas at the team's position"
     ],
     [
      "Volcanic Eruption",
      "4",
      "Major",
      "4d6 hours, 2-mile radius; 4d6 stress; sight and hearing ranges [multiplier, save and deafness missing in source]; GC may pay 4 action dice for a volcanic bomb on 1 character: 1d10 fire + stress per die; at the midpoint GC rolls 1d10: 1 = poison gas at the team's position"
     ],
     [
      "Volcanic Eruption",
      "—",
      "Poison gas",
      "Contagion. Primary: onset 1d4 rounds, save DC 15, 1d2 Con damage + fatigued. Secondary: onset 1d4 minutes, save DC 20, 1d4 Con damage + fatigued"
     ],
     [
      "Wind",
      "1",
      "Light",
      "3d20 minutes; -2 on Damage saves against fire spread; -2 hurled attacks; at the midpoint GC rolls 1d10: 1 = turns moderate"
     ],
     [
      "Wind",
      "2",
      "Moderate",
      "1d4 hours; -4 on Damage saves against fire spread; -4 hurled attacks and hearing-based Awareness/Perception; Speed -5 ft.; at the midpoint GC rolls 1d10: 1 = turns strong"
     ],
     [
      "Wind",
      "3",
      "Strong",
      "2d4 hours; -6 on Damage saves against fire spread; -6 hurled attacks, -2 other ranged attacks; Speed -10 ft.; Fort DC 15 or sprawled and blown 1d6 x 5 ft., 1d6 lethal per 10 ft. blown; at the midpoint GC rolls 1d10: 1 = turns severe"
     ],
     [
      "Wind",
      "4",
      "Severe",
      "3d4 hours; -8 on Damage saves against fire spread; -8 hurled attacks, -4 other ranged attacks; Speed -15 ft.; Fort DC 20 or sprawled and blown 1d6 x 10 ft., 1d6 lethal per 10 ft. blown; at the midpoint GC rolls 1d10: 1 = dust storm or tornado, by terrain"
     ],
     [
      "Wind",
      "—",
      "Dust storm",
      "3d4 hours; treat as severe wind and add vision effects (p.350)"
     ],
     [
      "Wind",
      "—",
      "Tornado",
      "1d12 minutes; open flames go out; no hurled attacks; -8 other ranged attacks; movement limited to the 5-ft. bonus step; within 100 ft., Fort DC 30 or pulled in for 2d6 rounds at 1d10 lethal per round, then thrown out 1d4 miles away, 2d20+20 ft. up (falling damage, p.336)"
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
     "* Intensity is measured where the characters are.",
     "** Effects hit each character separately unless noted; groups in different places each need their own event.",
     "† Table 5.14: Vision and Hearing (p.350) adds effects for some conditions.",
     "†† Slide zone: ground the debris crosses. Bury zone: ground squarely in the debris path.",
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
      "Civilian result 19: violence against this civilian traced to the team makes it Wanted (p.404)."
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
      "At once, whenever a listed infraction is committed; end-of-mission Reputation/Net Worth pay is not reduced"
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
      "Skill checks to slip past a sensor take the Armor Check Penalty."
     ],
     [
      "†",
      "A broken lock of this kind stays shut; breaking it just rules out more skill attempts to open it."
     ],
     [
      "††",
      "Forging the access item with a computer adds a Computers synergy bonus to the check."
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
      "Each round it attacks 1 character in its area, stopping when disabled or empty; a ranged weapon carries PR × 5 shots unless noted."
     ],
     [
      "§§",
      "XP counts each die of explosive damage (cap +10)."
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
      "Seldom wired to locks or sensors; meant for catching animals or people outdoors."
     ],
     [
      "◊◊",
      "Victim is caged; cage Damage save bonus PR × 3, Security/Disable DC 10 + (PR × 2)."
     ]
    ],
    "notes": [
     "XP for a device counts once per time the team must overcome it; identical duplicate devices on alternate entrances count once.",
     "Devices are found with Notice/Awareness or Search/Perception vs. Detect DC and neutralized with Security/Disable vs. Disable DC.",
     "Where a device can be attacked, use its Detect DC as its Defense.",
     "Traps with an attack bonus have error range 1 and threat range 20 and make a Standard Attack on whoever tripped the sensor; traps with a save DC deal 1/2 damage (rounded down) on a successful Reflex save.",
     "No result cap ever applies to a sensor's Awareness check."
    ]
   }
  },
  "objectives": [
   {
    "category": "Crucial Skill Check",
    "name": "Plain check at DC 10 + Threat Level, or opposed check against a bonus no higher than half the team's best",
    "grade": 1,
    "xp": 25,
    "page": 431,
    "note": ""
   },
   {
    "category": "Crucial Skill Check",
    "name": "Plain check at DC 15 + Threat Level, or opposed check against a bonus above half the team's best but not beyond it",
    "grade": 2,
    "xp": 50,
    "page": 431,
    "note": ""
   },
   {
    "category": "Crucial Skill Check",
    "name": "Plain check at DC 20 + Threat Level; Complex Task of 2-4 Challenges at DC 10 + Threat Level; or opposed check against a bonus beyond the team's best",
    "grade": 3,
    "xp": 75,
    "page": 431,
    "note": ""
   },
   {
    "category": "Crucial Skill Check",
    "name": "Plain check at DC 25 + Threat Level; Complex Task of 5-7 Challenges at DC 15 + Threat Level; or Dramatic Conflict at Lead 2-6 against a bonus no higher than the team's best",
    "grade": 4,
    "xp": 100,
    "page": 431,
    "note": ""
   },
   {
    "category": "Crucial Skill Check",
    "name": "Complex Task of 8-10 Challenges at DC 20 + Threat Level; or Dramatic Conflict at Lead 7-10 against a bonus beyond the team's best",
    "grade": 5,
    "xp": 125,
    "page": 431,
    "note": ""
   },
   {
    "category": "Aid/Advise",
    "name": "Oversee a touchy, low-danger deal; or mediate a mild dispute with an uncertain ally",
    "grade": 1,
    "xp": 25,
    "page": 431,
    "note": ""
   },
   {
    "category": "Aid/Advise",
    "name": "Oversee a touchy, high-danger deal; or mediate a heated dispute with a sworn enemy",
    "grade": 2,
    "xp": 50,
    "page": 431,
    "note": ""
   },
   {
    "category": "Aid/Advise",
    "name": "Clear someone of petty crimes or light slander; or expose one highly placed mole",
    "grade": 3,
    "xp": 75,
    "page": 431,
    "note": ""
   },
   {
    "category": "Aid/Advise",
    "name": "Clear someone of one felony or serious slander; or expose a young or shaky mole ring",
    "grade": 4,
    "xp": 100,
    "page": 431,
    "note": ""
   },
   {
    "category": "Aid/Advise",
    "name": "Clear someone of several felonies; or expose an established, well-informed mole ring",
    "grade": 5,
    "xp": 125,
    "page": 431,
    "note": ""
   },
   {
    "category": "Acquire",
    "name": "Recover 1 little-known artifact; hijack a lightly armed civilian transport; or steal a weakly guarded object (owner mildly interested)",
    "grade": 1,
    "xp": 25,
    "page": 431,
    "note": ""
   },
   {
    "category": "Acquire",
    "name": "Recover a few little-known artifacts missing under 1 year; hijack a heavily armed private transport; or steal a well-guarded object (owner moderately interested)",
    "grade": 2,
    "xp": 50,
    "page": 431,
    "note": ""
   },
   {
    "category": "Acquire",
    "name": "Recover many little-known artifacts missing up to 10 years; hijack a heavily armed government transport; or steal a heavily guarded object (owner moderately interested)",
    "grade": 3,
    "xp": 75,
    "page": 431,
    "note": ""
   },
   {
    "category": "Acquire",
    "name": "Recover many little-known artifacts missing up to 100 years; hijack a heavily armed villain transport; or steal a well-guarded object (owner fanatical)",
    "grade": 4,
    "xp": 100,
    "page": 431,
    "note": ""
   },
   {
    "category": "Acquire",
    "name": "Recover many little-known artifacts missing for thousands of years; hijack several heavily armed transports; or steal a heavily guarded object (owner fanatical)",
    "grade": 5,
    "xp": 125,
    "page": 431,
    "note": ""
   },
   {
    "category": "Capture",
    "name": "Arrest an elusive, unarmed petty criminal; or abduct a civilian official who supports the enemy",
    "grade": 1,
    "xp": 25,
    "page": 432,
    "note": ""
   },
   {
    "category": "Capture",
    "name": "Arrest an armed petty criminal; or abduct a trained non-military official who supports the enemy",
    "grade": 2,
    "xp": 50,
    "page": 432,
    "note": ""
   },
   {
    "category": "Capture",
    "name": "Arrest 1 armed felon; or abduct a trained military official who supports the enemy",
    "grade": 3,
    "xp": 75,
    "page": 432,
    "note": ""
   },
   {
    "category": "Capture",
    "name": "Arrest a group of armed felons; or abduct 1 trained enemy-side soldier",
    "grade": 4,
    "xp": 100,
    "page": 432,
    "note": ""
   },
   {
    "category": "Capture",
    "name": "Arrest a mastermind; or abduct a group of trained enemy-side soldiers",
    "grade": 5,
    "xp": 125,
    "page": 432,
    "note": ""
   },
   {
    "category": "Confirm",
    "name": "Verify 1 well-defined fact, or the motives of 1 unaware person",
    "grade": 1,
    "xp": 25,
    "page": 432,
    "note": ""
   },
   {
    "category": "Confirm",
    "name": "Verify a few well-defined, clearly related facts, or the motives of a few clearly related unaware people",
    "grade": 2,
    "xp": 50,
    "page": 432,
    "note": ""
   },
   {
    "category": "Confirm",
    "name": "Verify a few apparently related, thinly researched facts, or the motives of a few apparently related unaware people",
    "grade": 3,
    "xp": 75,
    "page": 432,
    "note": ""
   },
   {
    "category": "Confirm",
    "name": "Verify a few apparently unrelated, thinly researched facts, or the motives of a few apparently unrelated unaware people",
    "grade": 4,
    "xp": 100,
    "page": 432,
    "note": ""
   },
   {
    "category": "Confirm",
    "name": "Verify a few apparently unrelated facts with no research, or the motives of a few apparently unrelated people aware of the scrutiny",
    "grade": 5,
    "xp": 125,
    "page": 432,
    "note": ""
   },
   {
    "category": "Contain",
    "name": "Keep 1 small secret within a small group; or hide a small blunder in a thinly populated area",
    "grade": 1,
    "xp": 25,
    "page": 432,
    "note": ""
   },
   {
    "category": "Contain",
    "name": "Keep a few small secrets within a small group; or hide a small blunder in a populous area",
    "grade": 2,
    "xp": 50,
    "page": 432,
    "note": ""
   },
   {
    "category": "Contain",
    "name": "Keep a few small secrets within a large group; or hide a medium blunder in a populous area",
    "grade": 3,
    "xp": 75,
    "page": 432,
    "note": ""
   },
   {
    "category": "Contain",
    "name": "Keep a few medium secrets within a large group; or hide a big blunder in a populous area",
    "grade": 4,
    "xp": 100,
    "page": 432,
    "note": ""
   },
   {
    "category": "Contain",
    "name": "Keep 1+ big secrets within a large group; or hide a big blunder already made public",
    "grade": 5,
    "xp": 125,
    "page": 432,
    "note": ""
   },
   {
    "category": "Defend",
    "name": "Guard 1 easy-to-hold site or 1 alert NPC; enemy stats below the recommended level",
    "grade": 1,
    "xp": 25,
    "page": 432,
    "note": ""
   },
   {
    "category": "Defend",
    "name": "Guard 1 hard-to-hold site or 1 careless NPC; enemy stats below the recommended level",
    "grade": 2,
    "xp": 50,
    "page": 432,
    "note": ""
   },
   {
    "category": "Defend",
    "name": "Guard 1 hard-to-hold site or 1 careless NPC; enemy stats at the recommended level",
    "grade": 3,
    "xp": 75,
    "page": 432,
    "note": ""
   },
   {
    "category": "Defend",
    "name": "Guard 1 easy-to-hold site or 1 alert NPC; enemy stats above the recommended level",
    "grade": 4,
    "xp": 100,
    "page": 432,
    "note": ""
   },
   {
    "category": "Defend",
    "name": "Guard 1 hard-to-hold site or 1 careless NPC; enemy stats above the recommended level",
    "grade": 5,
    "xp": 125,
    "page": 432,
    "note": ""
   },
   {
    "category": "Destroy",
    "name": "Demolish an unguarded civilian site, or sabotage unguarded civilian gear or a vehicle",
    "grade": 1,
    "xp": 25,
    "page": 432,
    "note": ""
   },
   {
    "category": "Destroy",
    "name": "Demolish a weakly guarded civilian site, or sabotage weakly guarded civilian gear or a vehicle",
    "grade": 2,
    "xp": 50,
    "page": 432,
    "note": ""
   },
   {
    "category": "Destroy",
    "name": "Demolish a well-guarded civilian site, or sabotage well-guarded civilian gear or a vehicle",
    "grade": 3,
    "xp": 75,
    "page": 432,
    "note": ""
   },
   {
    "category": "Destroy",
    "name": "Demolish a well-guarded military site, or sabotage well-guarded military gear or a vehicle",
    "grade": 4,
    "xp": 100,
    "page": 432,
    "note": ""
   },
   {
    "category": "Destroy",
    "name": "Demolish a well-guarded villain site, or sabotage well-guarded villain gear or a vehicle",
    "grade": 5,
    "xp": 125,
    "page": 432,
    "note": ""
   },
   {
    "category": "Distract",
    "name": "Stop 1 person spotting a quiet event",
    "grade": 1,
    "xp": 25,
    "page": 432,
    "note": ""
   },
   {
    "category": "Distract",
    "name": "Stop 1 person spotting a loud event",
    "grade": 2,
    "xp": 50,
    "page": 432,
    "note": ""
   },
   {
    "category": "Distract",
    "name": "Stop a group spotting a quiet event",
    "grade": 3,
    "xp": 75,
    "page": 432,
    "note": ""
   },
   {
    "category": "Distract",
    "name": "Stop a group spotting a loud event",
    "grade": 4,
    "xp": 100,
    "page": 432,
    "note": ""
   },
   {
    "category": "Distract",
    "name": "Stop anyone at all spotting a blatant event",
    "grade": 5,
    "xp": 125,
    "page": 432,
    "note": ""
   },
   {
    "category": "Evade",
    "name": "Elude a weaker force on home ground",
    "grade": 1,
    "xp": 25,
    "page": 432,
    "note": ""
   },
   {
    "category": "Evade",
    "name": "Elude a weaker force on unknown ground",
    "grade": 2,
    "xp": 50,
    "page": 432,
    "note": ""
   },
   {
    "category": "Evade",
    "name": "Elude an evenly matched force on unknown ground",
    "grade": 3,
    "xp": 75,
    "page": 432,
    "note": ""
   },
   {
    "category": "Evade",
    "name": "Elude a stronger force on unknown ground",
    "grade": 4,
    "xp": 100,
    "page": 432,
    "note": ""
   },
   {
    "category": "Evade",
    "name": "Elude a stronger force on enemy ground",
    "grade": 5,
    "xp": 125,
    "page": 432,
    "note": ""
   },
   {
    "category": "Infiltrate",
    "name": "Enter an unguarded civilian site",
    "grade": 1,
    "xp": 25,
    "page": 432,
    "note": ""
   },
   {
    "category": "Infiltrate",
    "name": "Enter a weakly guarded civilian site",
    "grade": 2,
    "xp": 50,
    "page": 432,
    "note": ""
   },
   {
    "category": "Infiltrate",
    "name": "Enter a well-guarded civilian site",
    "grade": 3,
    "xp": 75,
    "page": 432,
    "note": ""
   },
   {
    "category": "Infiltrate",
    "name": "Enter a well-guarded military site",
    "grade": 4,
    "xp": 100,
    "page": 432,
    "note": ""
   },
   {
    "category": "Infiltrate",
    "name": "Enter a well-guarded villain site",
    "grade": 5,
    "xp": 125,
    "page": 432,
    "note": ""
   },
   {
    "category": "Investigate",
    "name": "1 clue; light research; or a search/scouting job lasting minutes",
    "grade": 1,
    "xp": 25,
    "page": 432,
    "note": ""
   },
   {
    "category": "Investigate",
    "name": "2-4 clues; 1 easy puzzle; medium research; or a search/scouting job lasting an hour",
    "grade": 2,
    "xp": 50,
    "page": 432,
    "note": ""
   },
   {
    "category": "Investigate",
    "name": "5-6 clues; 1 awkward puzzle; heavy research; or a search/scouting job lasting hours",
    "grade": 3,
    "xp": 75,
    "page": 432,
    "note": ""
   },
   {
    "category": "Investigate",
    "name": "7-9 clues; 1 complex puzzle; near-complete research; or a search/scouting job lasting a day",
    "grade": 4,
    "xp": 100,
    "page": 432,
    "note": ""
   },
   {
    "category": "Investigate",
    "name": "10 clues; 1 almost unsolvable puzzle; flawless research; or a search/scouting job lasting days",
    "grade": 5,
    "xp": 125,
    "page": 432,
    "note": ""
   },
   {
    "category": "Neutralize",
    "name": "Kill or forcibly retire a civilian official",
    "grade": 1,
    "xp": 25,
    "page": 433,
    "note": ""
   },
   {
    "category": "Neutralize",
    "name": "Kill or forcibly retire a trained non-military official, or several civilian officials",
    "grade": 2,
    "xp": 50,
    "page": 433,
    "note": ""
   },
   {
    "category": "Neutralize",
    "name": "Kill or forcibly retire a trained military official, or several trained non-military officials",
    "grade": 3,
    "xp": 75,
    "page": 433,
    "note": ""
   },
   {
    "category": "Neutralize",
    "name": "Kill or forcibly retire a trained soldier, or several trained military officials",
    "grade": 4,
    "xp": 100,
    "page": 433,
    "note": ""
   },
   {
    "category": "Neutralize",
    "name": "Kill or forcibly retire several trained soldiers",
    "grade": 5,
    "xp": 125,
    "page": 433,
    "note": ""
   },
   {
    "category": "Observe",
    "name": "Spot 1 activity at a busy, easily navigated site with plenty of cover",
    "grade": 1,
    "xp": 25,
    "page": 433,
    "note": ""
   },
   {
    "category": "Observe",
    "name": "Spot 1 activity at a quiet, awkward site with some cover; or 2+ at a busy, easily navigated site with plenty of cover",
    "grade": 2,
    "xp": 50,
    "page": 433,
    "note": ""
   },
   {
    "category": "Observe",
    "name": "Spot 1 activity at a silent, nearly impassable site with almost no cover; or 2+ at a quiet, awkward site with some cover",
    "grade": 3,
    "xp": 75,
    "page": 433,
    "note": ""
   },
   {
    "category": "Observe",
    "name": "Spot 1 activity while dodging enemy watchers or guards; or 2+ at a silent, nearly impassable site with almost no cover",
    "grade": 4,
    "xp": 100,
    "page": 433,
    "note": ""
   },
   {
    "category": "Observe",
    "name": "Spot 2+ activities while dodging enemy watchers or guards",
    "grade": 5,
    "xp": 125,
    "page": 433,
    "note": ""
   },
   {
    "category": "Recruit",
    "name": "Win over a reluctant outsider NPC; the cause carries no visible risk",
    "grade": 1,
    "xp": 25,
    "page": 433,
    "note": ""
   },
   {
    "category": "Recruit",
    "name": "Win over an outsider NPC who opposes the cause; the cause carries no visible risk",
    "grade": 2,
    "xp": 50,
    "page": 433,
    "note": ""
   },
   {
    "category": "Recruit",
    "name": "Win over an outsider NPC to a cause with small risk; or turn an enemy against weak masters",
    "grade": 3,
    "xp": 75,
    "page": 433,
    "note": ""
   },
   {
    "category": "Recruit",
    "name": "Win over an outsider NPC to a cause with medium risk; or turn an enemy against strong masters",
    "grade": 4,
    "xp": 100,
    "page": 433,
    "note": ""
   },
   {
    "category": "Recruit",
    "name": "Win over an outsider NPC to a cause with large risk; or turn an enemy against terrifying masters",
    "grade": 5,
    "xp": 125,
    "page": 433,
    "note": ""
   },
   {
    "category": "Repair",
    "name": "Fix 1 simple object, either on a tight deadline or while being shot at",
    "grade": 1,
    "xp": 25,
    "page": 433,
    "note": ""
   },
   {
    "category": "Repair",
    "name": "Fix 1 simple object on a tight deadline while being shot at",
    "grade": 2,
    "xp": 50,
    "page": 433,
    "note": ""
   },
   {
    "category": "Repair",
    "name": "Fix 1 complex object, either on a tight deadline or while being shot at",
    "grade": 3,
    "xp": 75,
    "page": 433,
    "note": ""
   },
   {
    "category": "Repair",
    "name": "Fix 1 complex object on a tight deadline while being shot at",
    "grade": 4,
    "xp": 100,
    "page": 433,
    "note": ""
   },
   {
    "category": "Repair",
    "name": "Fix several complex objects on a tight deadline under dangerous fire",
    "grade": 5,
    "xp": 125,
    "page": 433,
    "note": ""
   },
   {
    "category": "Rescue",
    "name": "Save 1 unhurt person or 1 intact vehicle/item; small environmental danger or enemy stats below recommended",
    "grade": 1,
    "xp": 25,
    "page": 433,
    "note": ""
   },
   {
    "category": "Rescue",
    "name": "Save 1 lightly hurt person or 1 lightly damaged vehicle/item; small environmental danger or enemy stats below recommended",
    "grade": 2,
    "xp": 50,
    "page": 433,
    "note": ""
   },
   {
    "category": "Rescue",
    "name": "Save 1 moderately hurt person or 1 moderately damaged vehicle/item; medium environmental danger or enemy stats as recommended",
    "grade": 3,
    "xp": 75,
    "page": 433,
    "note": ""
   },
   {
    "category": "Rescue",
    "name": "Save 1 moderately hurt person or 1 moderately damaged vehicle/item; medium environmental danger or enemy stats above recommended",
    "grade": 4,
    "xp": 100,
    "page": 433,
    "note": ""
   },
   {
    "category": "Rescue",
    "name": "Save 1 badly hurt person or 1 badly damaged vehicle/item; large environmental danger or enemy stats above recommended",
    "grade": 5,
    "xp": 125,
    "page": 433,
    "note": ""
   },
   {
    "category": "Sting",
    "name": "Run a solid ready-made plan against 1 mark",
    "grade": 1,
    "xp": 25,
    "page": 433,
    "note": ""
   },
   {
    "category": "Sting",
    "name": "Run a flimsy ready-made plan against 1 mark; or devise and run a new plan against 1 mark",
    "grade": 2,
    "xp": 50,
    "page": 433,
    "note": ""
   },
   {
    "category": "Sting",
    "name": "Run a wild ready-made plan against 1 mark; or devise and run a new plan against 2+ marks",
    "grade": 3,
    "xp": 75,
    "page": 433,
    "note": ""
   },
   {
    "category": "Sting",
    "name": "Devise and run a new plan against 2+ marks, short on either time or resources",
    "grade": 4,
    "xp": 100,
    "page": 433,
    "note": ""
   },
   {
    "category": "Sting",
    "name": "Devise and run a new plan against 2+ marks, short on both time and resources",
    "grade": 5,
    "xp": 125,
    "page": 433,
    "note": ""
   },
   {
    "category": "Test",
    "name": "Knowingly trial gear whose surprise side effects are harmless",
    "grade": 1,
    "xp": 25,
    "page": 433,
    "note": ""
   },
   {
    "category": "Test",
    "name": "Knowingly trial gear whose side effects endanger the user",
    "grade": 2,
    "xp": 50,
    "page": 433,
    "note": ""
   },
   {
    "category": "Test",
    "name": "Knowingly trial gear whose side effects endanger the team; or unknowingly trial gear whose surprise side effects are harmless",
    "grade": 3,
    "xp": 75,
    "page": 433,
    "note": ""
   },
   {
    "category": "Test",
    "name": "Unknowingly trial gear whose side effects endanger the user",
    "grade": 4,
    "xp": 100,
    "page": 433,
    "note": ""
   },
   {
    "category": "Test",
    "name": "Unknowingly trial gear whose side effects endanger the team",
    "grade": 5,
    "xp": 125,
    "page": 433,
    "note": ""
   },
   {
    "category": "Transport",
    "name": "Openly carry a portable item/data a short way, low danger",
    "grade": 1,
    "xp": 25,
    "page": 433,
    "note": ""
   },
   {
    "category": "Transport",
    "name": "Openly carry a portable item/data a medium way, mild danger; or covertly a short way, low danger",
    "grade": 2,
    "xp": 50,
    "page": 433,
    "note": ""
   },
   {
    "category": "Transport",
    "name": "Openly carry a bulky item/data a medium way, mild danger; or covertly carry a portable one a medium way, mild danger",
    "grade": 3,
    "xp": 75,
    "page": 433,
    "note": ""
   },
   {
    "category": "Transport",
    "name": "Openly carry a portable item/data a long way, serious danger; or covertly carry a bulky one a medium way, mild danger",
    "grade": 4,
    "xp": 100,
    "page": 433,
    "note": ""
   },
   {
    "category": "Transport",
    "name": "Openly carry a bulky item/data a long way, serious danger; or covertly carry anything a long way, serious danger",
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
    "note": "Suggested for every mission in every game (table footnote).",
    "infractions": [
     {
      "name": "Theft from a bystander",
      "reputation": -2,
      "netWorth": -100000
     },
     {
      "name": "Knowingly lets a bystander or responsibility come to harm, capture or death/destruction",
      "reputation": -4,
      "netWorth": -200000
     },
     {
      "name": "Deliberately hurts or damages a bystander or responsibility",
      "reputation": -6,
      "netWorth": -300000
     },
     {
      "name": "Knowingly lets another person use brutality (torture, mutilation, etc.)",
      "reputation": -8,
      "netWorth": -400000
     },
     {
      "name": "Deliberately kills or destroys a bystander or responsibility",
      "reputation": -10,
      "netWorth": -500000
     },
     {
      "name": "Personally uses brutality, whatever the reason",
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
      "name": "Isolated incident (public fight, rumors about a sensitive subject, etc.)",
      "reputation": -1,
      "netWorth": -50000
     },
     {
      "name": "Local incident (Wanted at 1 die, gang fight, campus paper story, etc.)",
      "reputation": -2,
      "netWorth": -100000
     },
     {
      "name": "Citywide incident (Wanted at 2 dice, gang war, city paper story, etc.)",
      "reputation": -4,
      "netWorth": -200000
     },
     {
      "name": "National incident (Wanted at 3 dice, military battle, national press story, etc.)",
      "reputation": -6,
      "netWorth": -300000
     },
     {
      "name": "International incident (Wanted at 4 dice, war, international press story, etc.)",
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
      "name": "Suspicious act seen by 1–10 people",
      "reputation": -1,
      "netWorth": -50000
     },
     {
      "name": "Suspicious act seen by 11–100 people",
      "reputation": -2,
      "netWorth": -100000
     },
     {
      "name": "Suspicious act seen by 100–500 people",
      "reputation": -3,
      "netWorth": -150000
     },
     {
      "name": "Suspicious act seen by 501–1,000 people",
      "reputation": -4,
      "netWorth": -200000
     },
     {
      "name": "Suspicious act seen by 1,001+ people",
      "reputation": -6,
      "netWorth": -300000
     },
     {
      "name": "Suspicious act recorded by a civilian",
      "reputation": -2,
      "netWorth": -100000
     },
     {
      "name": "Suspicious act recorded by campus or city news",
      "reputation": -4,
      "netWorth": -200000
     },
     {
      "name": "Suspicious act recorded by a national or international news outlet",
      "reputation": -6,
      "netWorth": -300000
     },
     {
      "name": "Public weapon draw: Small or smaller",
      "reputation": -1,
      "netWorth": -50000
     },
     {
      "name": "Public weapon draw: Medium or smaller",
      "reputation": -2,
      "netWorth": -100000
     },
     {
      "name": "Public weapon draw: Large or bigger",
      "reputation": -4,
      "netWorth": -200000
     },
     {
      "name": "Attack within public sight or earshot: 1-handed melee weapon",
      "reputation": 0,
      "netWorth": 0
     },
     {
      "name": "Attack within public sight or earshot: 2-handed melee weapon or any ranged weapon",
      "reputation": -4,
      "netWorth": -200000
     },
     {
      "name": "Attack within public sight or earshot: explosive or tactical weapon",
      "reputation": -8,
      "netWorth": -400000
     },
     {
      "name": "Wrecks a public vehicle or item, Large or smaller",
      "reputation": -4,
      "netWorth": -200000
     },
     {
      "name": "Wrecks a public building or item, Huge or bigger",
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
      "name": "Grade I mission objective not completed",
      "reputation": -1,
      "netWorth": -50000
     },
     {
      "name": "Grade II mission objective not completed",
      "reputation": -2,
      "netWorth": -100000
     },
     {
      "name": "Grade III mission objective not completed",
      "reputation": -3,
      "netWorth": -100000
     },
     {
      "name": "Grade IV mission objective not completed",
      "reputation": -4,
      "netWorth": -200000
     },
     {
      "name": "Grade V mission objective not completed",
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
    "note": "Suggested for every mission in every game (table footnote).",
    "infractions": [
     {
      "name": "Betrays an assigned teammate",
      "reputation": -2,
      "netWorth": -100000
     },
     {
      "name": "Attacks an assigned teammate",
      "reputation": -4,
      "netWorth": -200000
     },
     {
      "name": "Turns down a Faction/Freelance network assignment",
      "reputation": -5,
      "netWorth": -250000
     },
     {
      "name": "Betrays own Faction/Freelance network",
      "reputation": -10,
      "netWorth": -500000
     },
     {
      "name": "Attacks own Faction/Freelance network",
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
      "name": "Identified by 1–10 people",
      "reputation": -2,
      "netWorth": -100000
     },
     {
      "name": "Identified by 11–100 people",
      "reputation": -4,
      "netWorth": -200000
     },
     {
      "name": "Identified by 100–500 people",
      "reputation": -6,
      "netWorth": -300000
     },
     {
      "name": "Identified by 501–1,000 people",
      "reputation": -8,
      "netWorth": -400000
     },
     {
      "name": "Identified by 1,001+ people",
      "reputation": -10,
      "netWorth": -500000
     },
     {
      "name": "Identified by an enemy operative",
      "reputation": -12,
      "netWorth": -600000
     },
     {
      "name": "Identified by an enemy organization or country",
      "reputation": -15,
      "netWorth": -750000,
      "page": 437
     },
     {
      "name": "Tied to suspicious activity",
      "reputation": -4,
      "netWorth": -200000,
      "page": 437
     },
     {
      "name": "Tied to criminal activity",
      "reputation": -8,
      "netWorth": -400000,
      "page": 437
     },
     {
      "name": "Causes a teammate to be identified",
      "reputation": -2,
      "netWorth": -100000,
      "page": 437
     },
     {
      "name": "Causes a teammate to be tied to suspicious activity",
      "reputation": -4,
      "netWorth": -200000,
      "page": 437
     },
     {
      "name": "Causes a teammate to be tied to criminal activity",
      "reputation": -6,
      "netWorth": -300000,
      "page": 437
     },
     {
      "name": "Causes own Faction/Freelance network to be identified",
      "reputation": -5,
      "netWorth": -250000,
      "page": 437
     },
     {
      "name": "Causes own organization to be tied to suspicious activity",
      "reputation": -10,
      "netWorth": -500000,
      "page": 437
     },
     {
      "name": "Causes own organization to be tied to criminal activity",
      "reputation": -15,
      "netWorth": -750000,
      "page": 437
     },
     {
      "name": "Lets the enemy obtain a prototype or one-of-a-kind item",
      "reputation": -5,
      "netWorth": -250000,
      "page": 437
     },
     {
      "name": "Minor evidence left behind (issued shell casings; rental on a cover identity of Power Rating +1 to +4)",
      "reputation": -2,
      "netWorth": -100000,
      "page": 437
     },
     {
      "name": "Moderate evidence left behind (issued weapon; rental on a cover identity of Power Rating +5 to +8)",
      "reputation": -4,
      "netWorth": -200000,
      "page": 437
     },
     {
      "name": "Major evidence left behind (issued vehicle; rental with no cover identity)",
      "reputation": -8,
      "netWorth": -400000,
      "page": 437
     },
     {
      "name": "Jailed for a minor crime",
      "reputation": -10,
      "netWorth": -500000,
      "page": 437
     },
     {
      "name": "Jailed for a felony",
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
    "name": "-1 gear pick, player picks",
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
    "name": "-1 gear pick, GC picks",
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
    "name": "-2 gear picks, player picks",
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
    "name": "-2 gear picks, GC picks",
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
    "name": "-3 gear picks, player picks",
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
    "name": "-3 gear picks, GC picks",
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
    "name": "Weapons limited to 12 GC-picked models",
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
    "name": "Gadgets limited to 12 GC-picked Mechanisms",
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
    "summary": "Secures 1 portal or container. Opened with Security/Disable or Falsify/Forgery against DC 10 + (PR × 2); Damage save +(PR). Breaking it does not open the portal, it only blocks further open checks. Forgery route gets a Computers synergy bonus when a computer forges the access item."
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
    "summary": "Secures 1 portal or container. Opened with Security/Disable against DC 10 + (PR × 2); Damage save +(PR × 2)."
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
    "summary": "Secures 1 portal or container. Opened with Security/Disable against DC 10 + (PR × 2); Damage save +(PR × 2)."
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
    "summary": "Secures 1 portal or container. Opened with Security/Disable against DC 10 + (PR × 3); Damage save +(PR × 3)."
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
    "summary": "Secures 1 portal or container. Opened with Security/Disable against DC 10 + (PR × 1); Damage save +(PR × 2)."
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
    "summary": "Secures 1 portal or container. Opened with Security/Disable against DC 10 + (PR × 2); Damage save +(PR). Breaking it does not open the portal, it only blocks further open checks."
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
    "summary": "Secures 1 portal or container. Opened with Security/Disable or Falsify/Forgery against DC 10 + (PR × 3); Damage save +(PR). Breaking it does not open the portal, it only blocks further open checks. Forgery route gets a Computers synergy bonus when a computer forges the access item."
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
    "summary": "Secures 1 portal or container. Opened with Security/Disable against DC 10 + (PR × 3); Damage save +(PR × 3)."
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
    "summary": "Secures 1 portal or container. Opened with Security/Disable against DC 10 + (PR × 1); Damage save +(PR × 2)."
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
    "summary": "Secures 1 portal or container. Opened with Analysis (Int) against DC 10 + (PR × 4); Damage save +(PR × 2)."
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
    "summary": "Secures 1 portal or container. Opened with Security/Disable or Falsify/Forgery against DC 10 + (PR × 5); Damage save +(PR). Breaking it does not open the portal, it only blocks further open checks. Forgery route gets a Computers synergy bonus when a computer forges the access item."
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
    "summary": "Secures 1 portal or container. Opened with Security/Disable against DC 10 + (PR × 3); Damage save +(PR × 4)."
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
    "summary": "Secures 1 portal or container. Opened with Security/Disable or Falsify/Forgery against DC 10 + (PR × 3); Damage save +(PR). Breaking it does not open the portal, it only blocks further open checks. Forgery route gets a Computers synergy bonus when a computer forges the access item."
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
    "summary": "Secures 1 portal or container. Opened with Security/Disable against DC 10 + (PR × 2); Damage save +(PR × 3)."
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
    "summary": "Secures 1 portal or container. Opened with Security/Disable against DC 10 + (PR × 5); Damage save +(PR × 5)."
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
    "summary": "Secures 1 portal or container. Opened with Security/Disable or Bluff/Deception against DC 10 + (PR × 4); Damage save +(PR). Breaking it does not open the portal, it only blocks further open checks."
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
    "summary": "Covers PR × 5 ft. radius. Trips automatically unless disabled. Detect DC 10 + (PR × 3); Disable DC 10 + (PR × 3)."
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
    "summary": "Covers 1 window or door. Trips automatically unless disabled. Detect DC 10 + (PR × 2); Disable DC 10 + (PR × 4)."
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
    "summary": "Covers 1 lock. Trips automatically unless disabled. Detect DC 10 + (PR × 2); Disable DC 10 + (PR × 2)."
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
    "summary": "Covers PR × 5 ft. radius. Trips automatically unless disabled. Detect DC 10 + (PR × 4); Disable DC 10 + (PR × 3)."
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
    "summary": "Covers 1 entry point. Trips automatically unless disabled. Obvious, no check to detect; Disable DC 10 + (PR × 3)."
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
    "summary": "Covers PR × 25 ft. cone. Awareness +(PR × 2) opposed by the intruder's Acrobatics (Dex) (Armor Check Penalty applies). Detect DC 10 + (PR × 4); Disable DC 10 + (PR × 3)."
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
    "summary": "Covers PR × 10 ft. radius. Awareness +(PR × 3) opposed by the intruder's Blend (Dex) or Sneak (Dex) (Armor Check Penalty applies). Detect DC 10 + (PR × 4); Disable DC 10 + (PR × 3)."
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
    "summary": "Covers (PR) 5-ft. squares. Trips automatically unless disabled. Detect DC 10 + (PR × 3); Disable DC 10 + (PR × 4)."
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
    "targetArea": "Line of (PR) 5-ft. squares",
    "autoTrigger": false,
    "autoDetected": false,
    "summary": "Covers a line of (PR) 5-ft. squares. Avoided with a Reflex save DC 10 + PR. Detect DC 10 + (PR × 2); Disable DC 10 + (PR × 2)."
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
    "targetArea": "Line of (PR × 2) 5-ft. squares",
    "autoTrigger": false,
    "autoDetected": false,
    "summary": "Covers a line of (PR × 2) 5-ft. squares. Avoided with a Reflex save DC 15 + PR. Detect DC 10 + (PR × 3); Disable DC 10 + (PR × 3)."
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
    "summary": "Covers PR × 5 ft. radius. Awareness +(PR × 4) opposed by the intruder's Blend (Dex) or Sneak (Dex) (Armor Check Penalty applies). Detect DC 10 + (PR × 4); Disable DC 10 + (PR × 3)."
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
    "summary": "Covers PR × 25 ft. cone. Awareness +(PR × 2) opposed by the intruder's Blend (Dex) or Sneak (Dex) (Armor Check Penalty applies). Detect DC 10 + (PR × 2); Disable DC 10 + (PR × 3). Awareness bonus is for an automated eye; a human watching the feed uses their own bonus."
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
    "summary": "Covers 1 entry point. Trips automatically unless disabled. Obvious, no check to detect; Disable DC 10 + (PR × 3)."
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
    "summary": "Area/range: (PR) ft. (min. 5 ft.). Reflex save DC 10 + PR for half damage (rounded down). Damage: (PR)d6 acid. Its PR multiplier is also its range increment; error 1, threat range 1/2 PR (rounded up). Detect DC 10 + (PR × 4); Disable DC 10 + (PR × 2)."
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
    "targetArea": "As the explosive's blast (p.343)",
    "autoHit": false,
    "delayRounds": null,
    "rangeIncrementFromPR": false,
    "summary": "Area/range: As the explosive's blast (p.343). Reflex save DC per explosive for half damage (rounded down). Damage: Per explosive. XP counts each die of explosive damage (cap +10). Detect DC 10 + (PR × 3); Disable DC 10 + (PR × 3)."
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
    "summary": "Area/range: Per weapon. Attacks at +(PR × 2) (error 1, threat 20), once per round at 1 target until disabled or out of ammo (PR × 5 shots if ranged). Damage: Per weapon. Detect DC 10 + (PR × 4); Disable DC 10 + (PR × 3)."
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
    "summary": "Area/range: Per weapon. Attacks at +(PR × 2) (error 1, threat 20), once per round at 1 target until disabled or out of ammo (PR × 5 shots if ranged). Damage: Per weapon. Detect DC 10 + (PR × 3); Disable DC 10 + (PR × 3)."
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
    "summary": "Area/range: Per weapon. Attacks at +(PR × 2) (error 1, threat 20), once per round at 1 target until disabled or out of ammo (PR × 5 shots if ranged). Damage: Per weapon. Detect DC 10 + (PR × 2); Disable DC 10 + (PR × 3)."
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
    "summary": "Area/range: 1 square. Reflex save DC 10 + PR for half damage (rounded down). Damage: (PR)d4 lethal. Usually set in the wild rather than linked to locks or sensors. Detect DC 10 + (PR × 2); Disable DC 10 + (PR × 2)."
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
    "summary": "Area/range: 1 square. Reflex save DC 10 + PR for half damage (rounded down). No damage; victim is caged (cage Damage save PR × 3, Security/Disable DC 10 + (PR × 2)). Usually set in the wild rather than linked to locks or sensors. Detect DC 10 + (PR × 2); Disable DC 10 + (PR × 2)."
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
    "targetArea": "(10 + PR) squares at most",
    "autoHit": true,
    "delayRounds": "1d4+1",
    "rangeIncrementFromPR": false,
    "summary": "Area/range: (10 + PR) squares at most. Hits automatically. Effect applies after 1d4+1 rounds. Damage: (PR × 2)d6 lethal. Detect DC 10 + (PR × 3); Disable DC 10 + (PR × 2)."
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
    "targetArea": "(10 + PR) squares at most",
    "autoHit": true,
    "delayRounds": "1d4+1",
    "rangeIncrementFromPR": false,
    "summary": "Area/range: (10 + PR) squares at most. Hits automatically. Effect applies after 1d4+1 rounds. Damage: (PR × 2)d8 lethal. Detect DC 10 + (PR × 3); Disable DC 10 + (PR × 2)."
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
    "targetArea": "(10 + PR) squares at most",
    "autoHit": true,
    "delayRounds": null,
    "rangeIncrementFromPR": false,
    "summary": "Area/range: (10 + PR) squares at most. Hits automatically. Damage: (PR)d10 electrical. Detect DC 10 + (PR × 3); Disable DC 10 + (PR × 3)."
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
    "summary": "Area/range: (PR) ft. (min. 5 ft.). Reflex save DC 10 + PR for half damage (rounded down). Damage: (PR)d6 fire. Its PR multiplier is also its range increment; error 1, threat range 1/2 PR (rounded up). Detect DC 10 + (PR × 4); Disable DC 10 + (PR × 2)."
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
    "targetArea": "(10 + PR) squares at most",
    "autoHit": false,
    "delayRounds": "1d4+1",
    "rangeIncrementFromPR": false,
    "summary": "Area/range: (10 + PR) squares at most. No attack roll or save listed. Effect applies after 1d4+1 rounds. Damage: Per drowning. Detect DC 10 + (PR × 2); Disable DC 10 + (PR × 2)."
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
    "summary": "Area/range: (PR × 5) ft. radius. No attack roll or save listed. Damage: Per contagion. Detect DC 10 + (PR × 4); Disable DC 10 + (PR × 2)."
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
    "summary": "Area/range: Same or adjacent square. Attacks at +(PR × 2) (error 1, threat 20), once per round at 1 target until disabled or out of ammo (PR × 5 shots if ranged). Damage: (PR + 2)d6 lethal. Detect DC 10 + (PR × 3); Disable DC 10 + (PR × 3)."
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
    "summary": "Area/range: (PR × 10) ft. radius. No attack roll or save listed. Detect DC 10 + (PR × 3); Disable DC 10 + (PR × 2)."
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
    "targetArea": "Full cross-section of a room (PR squares at most)",
    "autoHit": false,
    "delayRounds": null,
    "rangeIncrementFromPR": false,
    "summary": "Area/range: Full cross-section of a room (PR squares at most). Reflex save DC 12 + PR for half damage (rounded down). Damage: (PR × 2)d6 laser. Detect DC 10 + (PR × 3); Disable DC 10 + (PR × 3)."
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
    "summary": "Area/range: (PR × 25) ft. Attacks at +(PR × 2) (error 1, threat 20), once per round at 1 target until disabled or out of ammo (PR × 5 shots if ranged). Damage: (PR)d6 laser. Its PR multiplier is also its range increment; error 1, threat range 1/2 PR (rounded up). Detect DC 10 + (PR × 3); Disable DC 10 + (PR × 4)."
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
    "summary": "Area/range: (PR × 10) ft. Attacks at +(PR × 3) (error 1, threat 20). Damage: Entangled. Its PR multiplier is also its range increment; error 1, threat range 1/2 PR (rounded up). Detect DC 10 + (PR × 2); Disable DC 10 + (PR × 3)."
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
    "targetArea": "(PR) squares at most",
    "autoHit": false,
    "delayRounds": null,
    "rangeIncrementFromPR": false,
    "summary": "Area/range: (PR) squares at most. Reflex save DC 12 + PR for half damage (rounded down). Damage: (PR)d6 falling. Detect DC 10 + (PR × 3); Disable DC 10 + (PR × 3)."
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
    "targetArea": "(PR) squares at most",
    "autoHit": false,
    "delayRounds": null,
    "rangeIncrementFromPR": false,
    "summary": "Area/range: (PR) squares at most. Reflex save DC 12 + PR for half damage (rounded down). Damage: (PR)d8 falling. Detect DC 10 + (PR × 3); Disable DC 10 + (PR × 3)."
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
    "summary": "Area/range: (PR × 5) ft. Attacks at +(PR × 2) (error 1, threat 20), once per round at 1 target until disabled or out of ammo (PR × 5 shots if ranged). Damage: Per contagion. Its PR multiplier is also its range increment; error 1, threat range 1/2 PR (rounded up). Detect DC 10 + (PR × 3); Disable DC 10 + (PR × 2)."
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
    "summary": "Area/range: 1 adjacent square. Reflex save DC 12 + PR for half damage (rounded down). Damage: (PR)d8 lethal. Detect DC 10 + (PR × 2); Disable DC 10 + (PR × 2)."
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
    "summary": "Area/range: 1 adjacent square. Reflex save DC 12 + PR for half damage (rounded down). Damage: (PR)d8 subdual. Detect DC 10 + (PR × 2); Disable DC 10 + (PR × 2)."
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
    "summary": "Area/range: Same or adjacent square. Reflex save DC 10 + PR for half damage (rounded down). Damage: (PR)d4 heat. Detect DC 10 + (PR × 4); Disable DC 10 + (PR × 2)."
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
    "summary": "Area/range: (PR × 5) ft. radius. Reflex save DC 12 + PR for half damage (rounded down). Damage: (PR)d6 flash. Detect DC 10 + (PR × 2); Disable DC 10 + (PR × 3)."
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
    "summary": "Area/range: (PR × 5) ft. radius. Hits automatically. Damage: (PR)d6 bang. Detect DC 10 + (PR × 2); Disable DC 10 + (PR × 3)."
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
    "comment": "Both tables are keyed by action dice spent (1-4; contagion up to 8), with no dice ranges. Neither is rolled; both are placed under lookups (hazards, naturesFury) instead of rollTables. Only Table 7.16 is a rolled table."
   },
   {
    "where": "Table 7.2 Hazards, Contagion cost 3",
    "comment": "The source combines \"up to\" with a DC range in this row, unlike the neighbouring rows. Stored as 65-70."
   },
   {
    "where": "Table 7.2 Hazards, Contagion costs 5*-8*",
    "comment": "Costs 5-8 are above the general 1-4 dice event cap, allowed by footnote. Event costMax left at 4; rows flagged exceedsLimit."
   },
   {
    "where": "Table 7.3 Nature's Fury, Volcanic Eruption cost 3 (Moderate), p.402",
    "comment": "Source lines for this row are scrambled with the cost 4 row: the deafness clause runs straight into the volcanic bomb damage. An until-the-eruption-ends duration and a 3-dice bomb are presumably intended, but the bomb cost does not appear here; bombDice left null."
   },
   {
    "where": "Table 7.3 Nature's Fury, Volcanic Eruption cost 4 (Major), p.402",
    "comment": "Range multiplier, Fort save DC and deafness duration are absent from the source (the pattern would suggest DC 25 and 4d6 hours). Fields left null."
   },
   {
    "where": "Table 7.3 Nature's Fury footnotes",
    "comment": "The single-dagger footnote (extra effects from Table 5.14) has no visible reference mark in the table header or rows."
   },
   {
    "where": "Table 7.3 Nature's Fury, Fog",
    "comment": "Fog has only costs 1-3; other types have 4."
   },
   {
    "where": "Table 7.16 Random Possessions, Minion",
    "comment": "Results 19-20 (real-name ID) and 20 (henchman clue) overlap on 20. Kept as in the source; likely intended 19 and 20 respectively, matching the Henchman sub-table pattern."
   },
   {
    "where": "Table 7.7 Exposure, Complete Critical Objective, Grade III",
    "comment": "Grade III row: -3 Reputation but only -$100,000, breaking the $50,000-per-point pattern (expected -$150,000). Kept as in the source."
   },
   {
    "where": "Table 7.7 Exposure, Avoid \"Noise\" and Maintain Anonymity crowd bands",
    "comment": "Crowd bands 11-100 and 100-500 overlap at exactly 100 (probably 101-500). Kept as in the source."
   },
   {
    "where": "Table 7.7 Exposure, Avoid \"Noise\"",
    "comment": "The 1-handed melee attack row carries a zero penalty; stored as reputation 0, netWorth 0."
   },
   {
    "where": "Table 7.7 Exposure, Avoid \"Noise\"",
    "comment": "The Medium weapon-draw row says \"or smaller\", overlapping the Small row; probably means Medium only. Kept as in the source."
   },
   {
    "where": "Table 7.7 Exposure, Maintain Anonymity",
    "comment": "Stray letter after the -$500,000 Net Worth value (OCR/typo); stored as -500000."
   },
   {
    "where": "Table 7.7 Exposure, objective header",
    "comment": "Source misspells \"Complication\"; corrected in the name. XP is per additional critical objective, stored as xp 25 with xpPrinted and note. The footnote cites page 437 for critical objectives but the rule is on p.435."
   },
   {
    "where": "Table 7.7 Exposure, column header",
    "comment": "Header words appear shuffled in the source (should read \"XP Reward\" and \"Reputation/Net Worth Penalty\")."
   },
   {
    "where": "Table 7.9 Security Options, sensor header",
    "comment": "Sensor header cells garbled by layout; interpreted as Sensor | Target Area | Awareness Bonus | Opposed Skill | Detect DC | Disable DC | XP Reward."
   },
   {
    "where": "Table 7.9 Security Options, all rows",
    "comment": "Every numeric cell scales with Power Rating, so xp, DCs, bonuses and damage are stored as formula strings in PR (with the \"×\" sign), not numbers."
   },
   {
    "where": "Table 7.9 Security Options, Tripwire / Tripwire, laser",
    "comment": "Awareness bonus is blank and the opposed skill is \"Special\" with a footnote; resolved from the footnote to opposedBy \"Reflex save DC 10 + PR\" / \"Reflex save DC 15 + PR\"."
   },
   {
    "where": "Table 7.9 Security Options, Metal detector / X-ray checkpoint",
    "comment": "Detect DC is none (automatic); detectDC stored as null with autoDetected true."
   },
   {
    "where": "Table 7.9 Security Options, Flooding chamber",
    "comment": "Stray space inside \"Per drowning\" in the source; stored corrected."
   },
   {
    "where": "Table 7.9 Security Options, Steam jet",
    "comment": "\"square\" is misspelled in the source; stored corrected."
   },
   {
    "where": "Table 7.9 Security Options, Automated weapon, explosive",
    "comment": "Save DC and damage defer to the explosive used. The XP footnote counts each die of explosive damage (cap +10); how that interacts with the PR × 8 XP cell is unclear."
   },
   {
    "where": "Table 7.9 Security Options, Net gun",
    "comment": "Attack bonus +(PR × 3) without the repeating-attack footnote that other attack-bonus traps carry; repeats false as in the source."
   },
   {
    "where": "Table 7.9 Security Options, traps with \"Automatic hit\" or \"None\"",
    "comment": "Traps listed as automatic hits or with no attack entry have no attack bonus or save DC; attack and saveDC are null, with extra fields autoHit and delayRounds."
   },
   {
    "where": "Table 7.9 Security Options, save-DC traps",
    "comment": "Two base save DCs appear: 10 + PR on the p.438 traps (acid/fire/steam jets, bear and cage traps) and 12 + PR on the p.439 traps (laser mesh, pits, spring traps, strobe). Kept as in the source."
   },
   {
    "where": "Table 7.6 Sample Objectives",
    "comment": "20 categories x grades 1-5; most source cells give 2-3 alternative samples. One objectives entry per row (category + grade), with the alternatives summarised in this file's own wording in one name string. No row has a grade range, so grade is never null."
   },
   {
    "where": "Events: Wanted (p.404) vs Table 7.7",
    "comment": "Table 7.7 mentions Wanted at 1-4 action dice, but the Wanted event text gives no per-die scaling, so no intensities are recorded for it."
   },
   {
    "where": "Events: Surprise Combat (p.403)",
    "comment": "The per-die Tier increase in this combat event mentions a chase; apparent copy-paste from Surprise Chase."
   },
   {
    "where": "Events: Endangered Bystanders (p.399)",
    "comment": "Bystander count is rolled on d12s regardless of the GC action die type; overall limit is still 4 dice."
   }
  ],
  "organizations": {
   "page": 389,
   "pages": [
    389,
    395
   ],
   "ratings": [
    "goals",
    "history",
    "image",
    "sites",
    "tools"
   ],
   "goalDicePerGoal": 2,
   "turningPointMorale": 2,
   "siteRequestBonus": 4,
   "toolsBaseCaliber": 2,
   "toolsIncreasesPerPoint": 2,
   "maxCaliber": 5,
   "gearCategories": [
    "E",
    "G",
    "R",
    "S",
    "T",
    "V",
    "W"
   ],
   "goals": [
    {
     "id": "anarchy",
     "name": "Anarchy",
     "supports": {
      "kind": "event",
      "event": "thief"
     }
    },
    {
     "id": "conquest",
     "name": "Conquest",
     "supports": {
      "kind": "event",
      "event": "surprise-combat"
     }
    },
    {
     "id": "counter",
     "name": "Counter",
     "supports": {
      "kind": "event",
      "event": "shoddy-worthless-item"
     }
    },
    {
     "id": "credibility",
     "name": "Credibility",
     "supports": {
      "kind": "check",
      "label": "Persuasion checks"
     }
    },
    {
     "id": "destruction",
     "name": "Destruction",
     "supports": {
      "kind": "event",
      "event": "endangered-bystanders"
     }
    },
    {
     "id": "enlightened-evolution",
     "name": "Enlightened Evolution",
     "supports": {
      "kind": "other",
      "label": "Critical successes"
     }
    },
    {
     "id": "genocide",
     "name": "Genocide",
     "supports": {
      "kind": "event",
      "event": "hazards"
     }
    },
    {
     "id": "grail",
     "name": "Grail",
     "supports": {
      "kind": "event",
      "event": "surprise-chase"
     }
    },
    {
     "id": "greed",
     "name": "Greed",
     "supports": {
      "kind": "check",
      "label": "Bribe checks"
     }
    },
    {
     "id": "meddling",
     "name": "Meddling",
     "supports": {
      "kind": "event",
      "event": "under-review"
     }
    },
    {
     "id": "megalomania",
     "name": "Megalomania",
     "supports": {
      "kind": "check",
      "label": "Opposed skill checks"
     }
    },
    {
     "id": "protection",
     "name": "Protection",
     "supports": {
      "kind": "event",
      "event": "wanted"
     }
    },
    {
     "id": "reconstruction",
     "name": "Reconstruction",
     "supports": {
      "kind": "event",
      "event": "rival-approach"
     }
    },
    {
     "id": "redemption",
     "name": "Redemption",
     "supports": {
      "kind": "event",
      "event": "responsibility"
     }
    },
    {
     "id": "revelation",
     "name": "Revelation",
     "supports": {
      "kind": "event",
      "event": "undesired-attention"
     }
    },
    {
     "id": "secrecy",
     "name": "Secrecy",
     "supports": {
      "kind": "check",
      "label": "Falsify checks"
     }
    },
    {
     "id": "stability",
     "name": "Stability",
     "supports": {
      "kind": "other",
      "label": "Defense bonuses"
     }
    },
    {
     "id": "takeover",
     "name": "Takeover",
     "supports": {
      "kind": "check",
      "label": "Intimidate checks"
     }
    },
    {
     "id": "terrorism",
     "name": "Terrorism",
     "supports": {
      "kind": "event",
      "event": "marked-for-death"
     }
    },
    {
     "id": "visionaries",
     "name": "Visionaries",
     "supports": {
      "kind": "check",
      "label": "Impress checks"
     }
    }
   ],
   "turningPoints": [
    {
     "id": "accomplishment",
     "name": "Accomplishment",
     "check": "Resolve/Morale"
    },
    {
     "id": "allies",
     "name": "Allies",
     "check": "Networking/Contact"
    },
    {
     "id": "betrayal",
     "name": "Betrayal",
     "check": "Sense Motive/Detect Lie"
    },
    {
     "id": "changing-of-the-guard",
     "name": "Changing of the Guard",
     "check": "Networking/Mediation"
    },
    {
     "id": "coup",
     "name": "Coup",
     "check": "Sense Motive/Resist Manipulate"
    },
    {
     "id": "dark-days",
     "name": "Dark Days",
     "check": "Resolve/Resist Intimidate"
    },
    {
     "id": "decline",
     "name": "Decline",
     "check": "Tactics/Ambush"
    },
    {
     "id": "enemies",
     "name": "Enemies",
     "check": "Networking/Slander"
    },
    {
     "id": "foolishness",
     "name": "Foolishness",
     "check": "Resolve/Resist Impress"
    },
    {
     "id": "golden-age",
     "name": "Golden Age",
     "check": "Profession/Accomplishment"
    },
    {
     "id": "great-leader",
     "name": "Great Leader",
     "check": "Tactics/Rally"
    },
    {
     "id": "growth",
     "name": "Growth",
     "check": "Science (Economy)"
    },
    {
     "id": "prophecy",
     "name": "Prophecy",
     "check": "Investigation/Research"
    },
    {
     "id": "persecuted",
     "name": "Persecuted",
     "check": "Bluff/Deception"
    },
    {
     "id": "rise-from-the-ashes",
     "name": "Rise from the Ashes",
     "check": "Resolve/R&R"
    },
    {
     "id": "respected",
     "name": "Respected",
     "check": "Impress/Influence"
    },
    {
     "id": "revolt",
     "name": "Revolt",
     "check": "Intimidate/Domination"
    },
    {
     "id": "rivals",
     "name": "Rivals",
     "check": "Impress/Performance"
    },
    {
     "id": "triumphant",
     "name": "Triumphant",
     "check": "",
     "chooseCheck": true
    },
    {
     "id": "victory",
     "name": "Victory",
     "check": "Resolve/Concentration"
    }
   ],
   "image": {
    "levels": [
     {
      "id": "renowned",
      "name": "Renowned",
      "cost": 2,
      "canvass": {
       "dc": 25,
       "error": 4
      },
      "research": {
       "dc": 0,
       "error": 0
      },
      "cover": {
       "leaders": 0,
       "members": 0
      },
      "immunity": {
       "leaders": 7,
       "members": 6
      }
     },
     {
      "id": "prominent",
      "name": "Prominent",
      "cost": 1,
      "canvass": {
       "dc": 15,
       "error": 2
      },
      "research": {
       "dc": 5,
       "error": 0
      },
      "cover": {
       "leaders": 0,
       "members": 0
      },
      "immunity": {
       "leaders": 3,
       "members": 2
      }
     },
     {
      "id": "recorded",
      "name": "On Record",
      "cost": 0,
      "canvass": {
       "dc": 10,
       "error": 0
      },
      "research": {
       "dc": 10,
       "error": 0
      },
      "cover": {
       "leaders": 0,
       "members": 0
      },
      "immunity": {
       "leaders": 0,
       "members": 0
      }
     },
     {
      "id": "secretive",
      "name": "Secretive",
      "cost": 1,
      "canvass": {
       "dc": 5,
       "error": 0
      },
      "research": {
       "dc": 15,
       "error": 2
      },
      "cover": {
       "leaders": 3,
       "members": 2
      },
      "immunity": {
       "leaders": 0,
       "members": 0
      }
     },
     {
      "id": "mysterious",
      "name": "Mysterious",
      "cost": 2,
      "canvass": {
       "dc": 0,
       "error": 0
      },
      "research": {
       "dc": 25,
       "error": 4
      },
      "cover": {
       "leaders": 7,
       "members": 5
      },
      "immunity": {
       "leaders": 0,
       "members": 0
      }
     }
    ],
    "facets": [
     {
      "id": "goals",
      "name": "Goals"
     },
     {
      "id": "methods",
      "name": "Methods"
     },
     {
      "id": "leaders",
      "name": "Leaders"
     },
     {
      "id": "members",
      "name": "Members"
     },
     {
      "id": "sites",
      "name": "Sites"
     }
    ],
    "default": "recorded"
   },
   "sites": [
    {
     "id": "advanced-garage",
     "name": "Advanced Garage",
     "request": "Gadget requests (vehicle Housings)",
     "category": "G"
    },
    {
     "id": "advanced-lab",
     "name": "Advanced Lab",
     "request": "Gadget requests (non-vehicle Housings)",
     "category": "G"
    },
    {
     "id": "airstrip",
     "name": "Airstrip",
     "request": "Aircraft requests",
     "category": "V"
    },
    {
     "id": "armory",
     "name": "Armory",
     "request": "Armor requests",
     "category": "S"
    },
    {
     "id": "classroom",
     "name": "Classroom",
     "request": "Skill training requests",
     "category": "R"
    },
    {
     "id": "cloning-lab",
     "name": "Cloning Lab",
     "request": "Cloning requests",
     "category": "R"
    },
    {
     "id": "comsec-center",
     "name": "COMSEC Center",
     "request": "Code requests",
     "category": "T"
    },
    {
     "id": "dojo",
     "name": "Dojo",
     "request": "Close range weapon requests",
     "category": "W"
    },
    {
     "id": "firing-range",
     "name": "Firing Range",
     "request": "Firearm requests",
     "category": "W"
    },
    {
     "id": "harbor",
     "name": "Harbor",
     "request": "Watercraft requests",
     "category": "V"
    },
    {
     "id": "hospital",
     "name": "Hospital",
     "request": "Medical assistance requests",
     "category": "R"
    },
    {
     "id": "hot-lab",
     "name": "Hot Lab",
     "request": "Contagion requests",
     "category": "T"
    },
    {
     "id": "law-offices",
     "name": "Law Offices",
     "request": "Legal requests",
     "category": "T"
    },
    {
     "id": "media-studio",
     "name": "Media Studio",
     "request": "Invitation requests",
     "category": "R"
    },
    {
     "id": "military-depot",
     "name": "Military Depot",
     "request": "Heavy and vehicle weapon requests",
     "category": "W/V"
    },
    {
     "id": "motor-pool",
     "name": "Motor Pool",
     "request": "Ground vehicle requests",
     "category": "V"
    },
    {
     "id": "prison",
     "name": "Prison",
     "request": "Detention requests",
     "category": "T"
    },
    {
     "id": "records-office",
     "name": "Records Office",
     "request": "Dossier requests",
     "category": "T"
    },
    {
     "id": "satellite-network",
     "name": "Satellite Network",
     "request": "Reconnaissance requests",
     "category": "R"
    },
    {
     "id": "training-ground",
     "name": "Training Ground",
     "request": "Feat training requests",
     "category": "R"
    }
   ],
   "ratingPools": [
    {
     "min": 11,
     "max": 20,
     "summary": "A fledgling agency, or a big one cut off and surrounded"
    },
    {
     "min": 21,
     "max": 30,
     "summary": "A small nation's front-line service, or a great power's support agency"
    },
    {
     "min": 31,
     "max": 40,
     "summary": "A great power's front-line service, or a well-backed multinational one"
    },
    {
     "min": 41,
     "max": null,
     "summary": "A worldwide agency or conspiracy with near-limitless reach"
    }
   ],
   "growth": {
    "summary": "One Rating goes up by 1 for each quarter to half-year that passes in the campaign",
    "page": 395
   }
  },
  "npcKnowledge": {
   "page": 460,
   "rulesPage": 458,
   "nonVillainMax": 3,
   "villainMax": 7,
   "knowsNothingCost": {
    "standard": 1,
    "minion": 1,
    "special": 2,
    "henchman": 2
   },
   "footnotes": [
    "Each grade includes everything below it.",
    "Grades I–III may be wrong or a red herring, as the GC decides."
   ],
   "rows": [
    {
     "grade": 1,
     "min": 0,
     "max": 4,
     "ratings": 0,
     "needs": null,
     "label": "A description of one suspicious person seen within 10 miles in the last day"
    },
    {
     "grade": 2,
     "min": 5,
     "max": 8,
     "ratings": 0,
     "needs": null,
     "label": "Where one suspicious event took place within 10 miles in the last day"
    },
    {
     "grade": 3,
     "min": 9,
     "max": 12,
     "ratings": 0,
     "needs": null,
     "label": "The name and outline of the organization thought to be behind a recent nearby event"
    },
    {
     "grade": 4,
     "min": 13,
     "max": 16,
     "ratings": 1,
     "needs": "villain",
     "label": "The nearest enemy installation (within 25 miles)"
    },
    {
     "grade": 5,
     "min": 17,
     "max": 20,
     "ratings": 2,
     "needs": "villain",
     "label": "Their immediate superior's Career Level and classes"
    },
    {
     "grade": 6,
     "min": 21,
     "max": 25,
     "ratings": 3,
     "needs": "villain",
     "label": "Where the nearest enemy henchman is (within 50 miles)"
    },
    {
     "grade": 7,
     "min": 26,
     "max": 30,
     "ratings": 4,
     "needs": "villain",
     "label": "Their immediate superior's full statistics"
    },
    {
     "grade": 8,
     "min": 31,
     "max": 35,
     "ratings": 4,
     "needs": "henchman",
     "label": "Every enemy installation within 100 miles, and the mastermind's Career Level and classes"
    },
    {
     "grade": 9,
     "min": 36,
     "max": 40,
     "ratings": 5,
     "needs": "henchman",
     "label": "The mastermind's full statistics"
    },
    {
     "grade": 10,
     "min": 41,
     "max": null,
     "ratings": 5,
     "needs": "henchman",
     "label": "Access codes for every enemy installation within 100 miles"
    }
   ]
  },
  "historicalMoney": {
   "page": 407,
   "rows": [
    {
     "from": 1875,
     "to": 1900,
     "modifier": 0.01
    },
    {
     "from": 1901,
     "to": 1909,
     "modifier": 0.025
    },
    {
     "from": 1910,
     "to": 1919,
     "modifier": 0.03
    },
    {
     "from": 1920,
     "to": 1929,
     "modifier": 0.05
    },
    {
     "from": 1930,
     "to": 1949,
     "modifier": 0.06
    },
    {
     "from": 1950,
     "to": 1959,
     "modifier": 0.1
    },
    {
     "from": 1960,
     "to": 1969,
     "modifier": 0.2
    },
    {
     "from": 1970,
     "to": 1979,
     "modifier": 0.3
    },
    {
     "from": 1980,
     "to": 1989,
     "modifier": 0.6
    },
    {
     "from": 1990,
     "to": null,
     "modifier": 1
    }
   ]
  }
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
    "Step 1: Strategies — each side picks in secret from those it qualifies for",
    "Step 2: Opposed check — reveal Strategies and add modifiers; a critical success by the winner or a critical failure by the loser moves Lead 1 the winner's way",
    "Step 3: Resolve — winner takes 1 Advantage listed for his Strategy, plus 1 per full 4 points of margin; then test Lead for victory",
    "Step 4: Outside Actions (per Conflict type)"
   ],
   "notes": [
    "No winner yet while Lead sits anywhere from 1 through 9.",
    "Groups: one cooperative check per side, with Tactics supplying synergy.",
    "A Strategy cannot be withdrawn once chosen; a participant may concede, giving the opponent his victory result.",
    "Threats/errors: nothing extra unless a Conflict type says so. Criticals only move Lead or alter Conflict state."
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
     "Maneuver check: Acrobatics (personal vehicle)",
     "Maneuver check: Athletics (on foot)",
     "Maneuver check: Drive (other vehicles)",
     "Maneuver check: Survival (mounted)",
     "Maneuver check: Tactics (crewed vehicle)"
    ],
    "preySkills": [
     "Maneuver check: Acrobatics (personal vehicle)",
     "Maneuver check: Athletics (on foot)",
     "Maneuver check: Drive (other vehicles)",
     "Maneuver check: Survival (mounted)",
     "Maneuver check: Tactics (crewed vehicle)"
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
      "requirements": "Acceleration 5+ / Turning 5+ (either)",
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
      "requirements": "Acceleration 6+ / Turning 6+ (either)†",
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
      "other": "Feat required: Daredevil (p.192)",
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
      "requirements": "Acceleration 8+ / Turning 8+ (either)",
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
      "other": "Class ability required: “That’s Impossible!” (p.52)",
      "modifier": 0,
      "advantages": [
       "*"
      ],
      "summary": "Physics-defying driving. On a win, 1 use of the class ability buys free choice of Advantages (Victory excluded).",
      "note": "Advantage column allows anything but Victory."
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
      "summary": "Hide behind scenery, traffic and crowds.",
      "note": ""
     },
     {
      "id": "attack-run",
      "name": "Attack Run",
      "side": "predator",
      "requirements": "Acceleration 5+ + Turning 4+ (both)",
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
      "summary": "Steady the ride and draw near for a clean shot.",
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
      "requirements": "Acceleration 7+ / Turning 7+ (either)",
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
      "requirements": "Acceleration 4+ + Turning 6+ (both)",
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
      "requirements": "Acceleration 6+ / Turning 3+ (either)",
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
      "requirements": "Acceleration 3+ / Turning 6+ (either)",
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
      "requirements": "Acceleration 6+ + Turning 4+ (both)",
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
      "requirements": "Acceleration 4+ + Turning 5+ (both)",
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
      "requirements": "Acceleration 7+ / Turning 7+ (either)",
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
      "summary": "Attack bonus: +4 for the winner vs. anyone else in the chase, lasting 1 full round.",
      "repeat": "Each further pick: +2 more and +1 threat range on those attacks.",
      "repeatEvery": 1
     },
     {
      "id": "crisis",
      "name": "Crisis",
      "leadShift": 0,
      "victory": false,
      "summary": "Obstacle: all participants roll Maneuver against the Crisis DC for the current room (Table 6.1); failure = crash. Declining the roll hands the other side 3 Lead.",
      "repeat": "Extra picks: winner's own Crisis DC -5 each (floor 10).",
      "repeatEvery": 1,
      "skipLeadShift": 3
     },
     {
      "id": "defense",
      "name": "Defense",
      "leadShift": 0,
      "victory": false,
      "summary": "Defense bonus: +4 for the winner vs. attacks by anyone else in the chase, lasting 1 full round.",
      "repeat": "Each further pick: +2 more and +1 error range on attacks against the winner.",
      "repeatEvery": 1
     },
     {
      "id": "impact",
      "name": "Impact",
      "leadShift": 0,
      "victory": false,
      "summary": "Collision: the winner picks 1 opponent and both are damaged (vehicles: amount = that opponent's check result; foot vs. foot: 1d4 lethal). GC permitting, passengers can try an Acrobatics/Jump (5 ft.) across to the struck vehicle.",
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
      "repeat": "3 picks in one round: winner names any Maneuvering Room grade outright."
     },
     {
      "id": "stress",
      "name": "Stress",
      "leadShift": 0,
      "victory": false,
      "summary": "1d4 stress damage to all but the winner; it stays until the chase is over.",
      "repeat": "Each further pick adds +1d4 stress damage.",
      "repeatEvery": 1
     },
     {
      "id": "swap",
      "name": "Swap",
      "leadShift": 0,
      "victory": false,
      "summary": "Sides swap Predator/Prey roles; Lead then goes up 1.",
      "repeat": "",
      "swapRoles": true,
      "absoluteLeadChange": 1
     },
     {
      "id": "twist",
      "name": "Twist",
      "leadShift": 0,
      "victory": false,
      "summary": "Next opposed check: winner may swap in Blend/Dex, Bluff/Cha, Impress/Cha, Intimidate/Cha, Mechanics/Int, Sense Motive/Wis or Streetwise/Wis (tags ignored).",
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
     "predator": "Lead vehicles/runners end side by side with the Prey's ride disabled. Predator's side acts in a surprise round (half action each), optionally after hitting the Prey with 1 Impact Advantage.",
     "prey": "Prey's side escapes; no locating them again this scene. Optionally the Prey first inflicts 1 Crisis Advantage on the Predator."
    },
    "outsideActions": "Drivers/runners: 1 half action. Passengers: 1 full or 2 half actions. During combat, taken on the acting character's own Initiative Count.",
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
        "Open — little in the way",
        "×1",
        "+6",
        15
       ],
       [
        "Close — some obstacles",
        "×3/4",
        "+4",
        20
       ],
       [
        "Crowded — many obstacles",
        "×1/2",
        "+2",
        30
       ],
       [
        "Tight — barely room to move",
        "×1/4",
        "+0",
        40
       ]
      ],
      "notes": [
       "* Chase pace = slowest participant's top MPH × this factor, rounded down. Chiefly used for crash damage.",
       "** Added to chase Maneuver checks of the pilot whose vehicle has the best top MPH.",
       "† Maneuver DC whenever a Crisis comes up."
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
       "* Can choose a shorter scale, down to 200 ft. per point, when engaging other aircraft.",
       "** Ship-on-ship only; such rounds run 2 minutes each."
      ]
     }
    },
    "notes": [
     "On foot, Acceleration = Strength modifier and Turning = Dexterity modifier (each minimum 0); otherwise the vehicle supplies both ratings.",
     "GC sets Maneuvering Room (Open/Close/Crowded/Tight) at the start; it can change via the Room Advantage.",
     "Chained chases: track a separate Lead per Predator/Prey pair and resolve each step pair by pair from front to back.",
     "Mixed vehicle types: use the smallest per-point distance among them. Where one type's distance exceeds twice another's, skip the Conflict and settle it with one opposed check.",
     "Fuel: 1 minute per chase round. Driving and shooting vehicle weapons together falls under multi-tasking.",
     "With simultaneous combat: Step 1 before the first Initiative Count, Steps 2-3 at the (first) Predator's count, Step 4 spread across the round.",
     "Smash (powered aircraft only): held by the one pilot who is 200+ ft. higher than the closest opponent with nobody hostile above him. Starts at 1 per Lead point separating him from the next-highest opponent; +1 for each opposed check he wins and each Maneuver threat he rolls, -1 each time someone else does either. Gone at 0 or once the altitude conditions fail.",
     "Using Smash (only after winning the opposed check): 1 point = Lead -1 for a Predator, or +4 Defense through the Prey's next Initiative Count. Range to a Smash holder is figured as Lead + his Smash total.",
     "Crash: 1d4 lethal on foot. A vehicle suffers collision damage from its size and speed; each occupant takes half of it unless he passes a Reflex save (DC = half the damage). A crash removes that participant from the pursuit.",
     "“That’s Impossible!”: a win costs 1 class-ability use and grants free choice of Advantages (1, +1 per 4 points of margin; Victory excluded)."
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
     "summary": "Take the lower of the Prey's base Fortitude and base Will bonuses and halve it; floor 2. At 10+ the Prey is immune to brainwashing.",
     "rules": [
      {
       "when": "Standard: half the Prey's weaker base save (Fort or Will)",
       "lead": null,
       "formula": "max(2, min(baseFort, baseWill) / 2)"
      },
      {
       "when": "Result reaches 10+",
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
      "requirements": "Will (base) 4+",
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
      "requirements": "Will (base) 6+",
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
      "requirements": "Will (base) 7+",
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
      "requirements": "Will (base) 5+",
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
      "requirements": "Will (base) 8+",
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
      "requirements": "Will/Fort (base) 5+**",
      "leadMin": null,
      "leadMax": null,
      "ratings": [
       {
        "rating": "Base Will/Fortitude save bonus",
        "min": 5
       }
      ],
      "ratingsMode": "all",
      "other": "Prey's base Will if the approach is mental, base Fortitude if physical",
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
      "summary": "Trade a scrap of information for a respite.",
      "note": "",
      "skill": "Resolve (Wis)"
     },
     {
      "id": "hold-fast",
      "name": "Hold Fast",
      "side": "prey",
      "requirements": "Will/Fort (base) 7+**",
      "leadMin": null,
      "leadMax": null,
      "ratings": [
       {
        "rating": "Base Will/Fortitude save bonus",
        "min": 7
       }
      ],
      "ratingsMode": "all",
      "other": "Prey's base Will if the approach is mental, base Fortitude if physical",
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
      "requirements": "Will/Fort (base) 4+**",
      "leadMin": null,
      "leadMax": null,
      "ratings": [
       {
        "rating": "Base Will/Fortitude save bonus",
        "min": 4
       }
      ],
      "ratingsMode": "all",
      "other": "Prey's base Will if the approach is mental, base Fortitude if physical",
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
      "requirements": "Will/Fort (base) 8+**",
      "leadMin": null,
      "leadMax": null,
      "ratings": [
       {
        "rating": "Base Will/Fortitude save bonus",
        "min": 8
       }
      ],
      "ratingsMode": "all",
      "other": "Prey's base Will if the approach is mental, base Fortitude if physical",
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
      "requirements": "Will/Fort (base) 6+**",
      "leadMin": null,
      "leadMax": null,
      "ratings": [
       {
        "rating": "Base Will/Fortitude save bonus",
        "min": 6
       }
      ],
      "ratingsMode": "all",
      "other": "Prey's base Will if the approach is mental, base Fortitude if physical",
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
      "summary": "Predator picks 1 event (1 hour at most) to implant in or wipe from the Prey's memory.",
      "repeat": "Each further pick: +1 event (1 hour at most).",
      "repeatEvery": 1
     },
     {
      "id": "crisis",
      "name": "Crisis",
      "leadShift": 0,
      "victory": false,
      "summary": "Crisis save: each side rolls Fortitude or Will, DC 10 + half the other side's career level (round up). A failure costs 1d3 temporary Wis and 1d3 temporary Cha; a lone failure also loses the Conflict. Declining the save hands the other side 3 Lead.",
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
      "summary": "Halve the length of the following round (round down; never under 5 minutes).",
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
      "summary": "Optional trade: winner gives away 1 thing about his own organization (its history, or a goal, Rating or Site the other side lacks) and gets 1 bonus action die.",
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
      "summary": "Prey group's check next round is a team check made at its worst member's skill bonus.",
      "repeat": "Each further pick extends this by 1 more round.",
      "repeatEvery": 1
     },
     {
      "id": "stress",
      "name": "Stress",
      "leadShift": 0,
      "victory": false,
      "summary": "1d4 stress damage to all but the winner; it stays until the brainwashing attempt is over.",
      "repeat": "Each further pick adds +1d4 stress damage.",
      "repeatEvery": 1
     },
     {
      "id": "twist",
      "name": "Twist",
      "leadShift": 0,
      "victory": false,
      "summary": "Next opposed check: winner may swap in Analysis/Wis, Cultures/Int, Falsify/Wis, Intimidate/Cha, Investigation/Cha, Science/Int or Tactics/Int (tags ignored).",
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
     "predator": "Prey retains no memory of being brainwashed. Predator chooses: wipe 1 event (24 hours at most) for good, or dictate 1 action as though Impress/Persuasion had succeeded at a penalty no worse than -18 (not an action that exposes the Prey).",
     "prey": "Prey holds out; that Predator or group gets no further brainwashing attempts on him this mission."
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
       "* Predator value / Prey value."
      ]
     }
    },
    "notes": [
     "Predator picks a mental or physical approach at the start; it changes only through the New Approach Advantage.",
     "Attendance: Predator for 50%+ of every round, Prey for all of it.",
     "Several participants form a Predator group and a Prey group; each group makes one cooperative opposed check per round.",
     "Each strategy names the skill used for that round's opposed check (\"skill\" field); alternate skill checks have no tags.",
     "Prey save-bonus requirements use base Will vs. a mental approach and base Fortitude vs. a physical approach.",
     "For DCs keyed to career level, an NPC counts as the current Threat Level.",
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
     "summary": "System's Security Power Rating, capped at 9. Using an existing back door instead: the Lead recorded when it was planted, +1.",
     "rules": [
      {
       "when": "Normal hack",
       "lead": null,
       "formula": "min(9, system Security Power Rating)"
      },
      {
       "when": "Entering via back door",
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
      "requirements": "Computer PR 7+",
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
      "other": "Class ability required: master cracker (p.36)",
      "modifier": 0,
      "advantages": [
       "*"
      ],
      "summary": "Expert insight. On a win, 1 use of the class ability buys free choice of Advantages (Victory excluded).",
      "note": "Advantage column allows anything but Victory.",
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
      "requirements": "Computer PR 3+, Probe software",
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
      "note": "The book's table wraps this requirement over two lines.",
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
      "summary": "Take over for a moment, then hop to another part of the network.",
      "note": "",
      "skill": ""
     },
     {
      "id": "magic-bullet",
      "name": "Magic Bullet",
      "side": "predator",
      "requirements": "Computer PR 7+",
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
      "requirements": "Computer PR 4+",
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
      "requirements": "Computer PR 7+",
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
      "requirements": "Security PR 4+",
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
      "summary": "Predator's choice: wipe 1 silhouette held by the Prey, or plant a back door (record current Lead).",
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
      "summary": "Trace software used on the winner: Power Rating -3 through the close of next round; the reduction never stacks past 3.",
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
      "summary": "Winner names an opponent, who rolls Computers (Int) vs. DC 10 + (5 x PR of the winner's Probe software). Fail: winner issues 1 core command. Declining the roll gives the winner 2 Lead.",
      "repeat": "Each further pick raises the DC by 5.",
      "repeatEvery": 1,
      "skipLeadShift": 2
     },
     {
      "id": "seize-control",
      "name": "Seize Control",
      "leadShift": 0,
      "victory": false,
      "summary": "Winner starts or halts 1 program (held on either computer) on the target machine, or commandeers 1 device it controls up to next round's Step 2.",
      "repeat": "Each further pick: control of 1 more program or device.",
      "repeatEvery": 1
     },
     {
      "id": "silhouette",
      "name": "Silhouette",
      "leadShift": 0,
      "victory": false,
      "summary": "Prey's choice: erase 1 back door left by the Predator, or record a silhouette of him. Silhouettes stack: +1 apiece to the Prey's opposed hacking checks vs. that Predator, all mission.",
      "repeat": ""
     },
     {
      "id": "stress",
      "name": "Stress",
      "leadShift": 0,
      "victory": false,
      "summary": "1d4 stress damage to all but the winner; it stays until the hacking attempt is over.",
      "repeat": "Each further pick adds +1d4 stress damage.",
      "repeatEvery": 1
     },
     {
      "id": "trace",
      "name": "Trace",
      "leadShift": 0,
      "victory": false,
      "summary": "Winner names an opponent, who rolls Computers (Int) vs. DC 10 + (5 x PR of the winner's Trace software). Fail: his real-world location is pinpointed, and if the winner is the Prey he may close out the hack as a win. Declining the roll gives the winner 2 Lead.",
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
    "outsideActions": "No special rules. In combat, Step 4 happens piecemeal as each participant's Initiative Count comes up.",
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
       "Round length from current Lead and access type, times the hackTimingRelativePower factor. Each side has to take part for 50%+ of it (round down, 1 round at least)."
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
        "Predator +5 and up",
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
        "Prey +5 and up",
        "×5",
        "×5"
       ]
      ],
      "notes": [
       "* Round up; never under 1 half action."
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
       "Extract File / Upload Program: takes (Complexity DC ÷ the weaker computer's Power Rating) full rounds, round down, 1 at least. GC sets an unlisted Complexity DC between 10 and 60.",
       "Initiate System Purge: 1 minute, +1 minute for every intruding program with a higher Power Rating than the system.",
       "Search System: 1 full action to launch; duration as a Research check (Table 2.33) but no roll; covers a single system.",
       "Use Peripheral: -4 on any separate skill check for remote operation.",
       "View File: half action to open. Reading speed per full round: 1 page, +1 per Int point over 10, +1 per Wis point over 10."
      ]
     }
    },
    "notes": [
     "No live defender (or GC wants it quick): run a Complex Task instead. Challenges = system Power Rating; Computers (Int) DC = 10 + the Sys-Op's Computers bonus when known, else 15 + Threat Level.",
     "External Access is any indirect connection; Internal Access is a terminal wired straight into the system and is much faster.",
     "Default terminal Power Rating: host system's rating - 2, floor 1.",
     "Several participants form a Predator group and a Prey group; each makes one cooperative opposed check per round.",
     "A blank \"skill\" means the default Computers (Int); alternate skill checks have no tags.",
     "Software requirements (Trace, Probe) are recorded in \"other\". Probe/Trace DCs scale with the winner's software Power Rating.",
     "Back door: fixes starting Lead for later hacks. Silhouette: +1 each (stacking) for the defender vs. that hacker all mission. Gaining one may instead be used to cancel one of the other kind.",
     "A successful trace by the Prey can end the hack in his favor and is enough to start a manhunt.",
     "With simultaneous combat: Step 1 before the first Initiative Count, Steps 2-3 at the Predator's count.",
     "Master Cracker: a win costs 1 class-ability use and grants free choice of Advantages (1, +1 per 4 points of margin; Victory excluded)."
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
     "summary": "Low profile opening: organization's Image Rating. High profile opening: its History Rating.",
     "rules": [
      {
       "when": "Opening approach: low profile",
       "lead": null,
       "formula": "organization Image Rating"
      },
      {
       "when": "Opening approach: high profile",
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
      "requirements": "Cover Identity PR 3+",
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
      "other": "Class ability required: bald-faced lie (p.35)",
      "modifier": 0,
      "advantages": [
       "*"
      ],
      "summary": "Outrageous but convincing lies. On a win, 1 use of the class ability buys free choice of Advantages (Victory excluded).",
      "note": "Advantage column allows anything but Victory.",
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
      "other": "High profile approach only",
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
      "requirements": "Cover Identity PR 4+",
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
      "summary": "Take chances to dig up extra facts on the group.",
      "note": "",
      "skill": ""
     },
     {
      "id": "haven",
      "name": "Haven",
      "side": "predator",
      "requirements": "Cover Identity PR 3+",
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
      "requirements": "Cover Identity PR 5+",
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
      "summary": "Leverage rank and turned insiders to arrange a strike at someone important.",
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
      "summary": "Quick look around, then leave.",
      "note": "",
      "skill": ""
     },
     {
      "id": "risky-declaration",
      "name": "Risky Declaration",
      "side": "predator",
      "requirements": "Cover Identity PR 4+∆",
      "leadMin": null,
      "leadMax": null,
      "ratings": [
       {
        "rating": "Cover Identity Power Rating",
        "min": 4
       }
      ],
      "ratingsMode": "all",
      "other": "High profile approach only",
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
      "requirements": "Cover Identity PR 6+",
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
      "requirements": "Cover Identity PR 5+",
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
      "requirements": "Cover Identity PR 2+",
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
      "requirements": "Goals 3+",
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
      "other": "Class ability required: big brother (p.46) / global search (p.48)",
      "modifier": 0,
      "advantages": [
       "*"
      ],
      "summary": "Security toys with the intruder. On a win, 1 use of the class ability buys free choice of Advantages (Victory excluded).",
      "note": "Advantage column allows anything but Victory.",
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
      "requirements": "Goals 2+",
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
      "note": "The ** mark here leads only to the Ratings cross-reference; possibly intended as the high-profile mark. See anomalies.",
      "skill": "Manipulate (Wis)"
     },
     {
      "id": "lockdown",
      "name": "Lockdown",
      "side": "prey",
      "requirements": "Goals 4+",
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
      "requirements": "Goals 6+",
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
      "requirements": "Goals 5+",
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
      "requirements": "Goals 4+",
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
      "requirements": "Goals 3+∆",
      "leadMin": null,
      "leadMax": null,
      "ratings": [
       {
        "rating": "Organization Goals Rating",
        "min": 3
       }
      ],
      "ratingsMode": "all",
      "other": "High profile approach only",
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
      "requirements": "Goals 5+",
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
      "summary": "Predator gets 1 hour (at most) alone at a terminal: Internal Access for a hack on the organization's system.",
      "repeat": "Every 2 further picks: +1 hour, 4 hours tops.",
      "repeatEvery": 2
     },
     {
      "id": "conspiracy",
      "name": "Conspiracy",
      "leadShift": 0,
      "victory": false,
      "summary": "Predator rolls Impress (Cha), DC 10 + (5 x organization History Rating). Success: 1 standard NPC or 1 minion squad goes neutral and stays out of combats and chases all mission. Failure: Lead +1.",
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
      "summary": "Clean exit for the Predator: the Prey gets no events in reply.",
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
      "summary": "1 hour with nobody watching the Predator. Returning late from an outing calls for Bluff (Cha), DC 20 + (4 x Goals Rating); fail and the Prey wins, banking action dice = Lead to spend on hostile events.",
      "repeat": "Every 2 further picks: +1 hour, 3 hours tops.",
      "repeatEvery": 2,
      "canEndConflict": true
     },
     {
      "id": "haste",
      "name": "Haste",
      "leadShift": 0,
      "victory": false,
      "summary": "Halve the length of the following round (round down; never under 5 minutes).",
      "repeat": "Each further pick halves the duration again.",
      "repeatEvery": 1
     },
     {
      "id": "intelligence",
      "name": "Intelligence",
      "leadShift": 0,
      "victory": false,
      "summary": "Predator gains 1 piece of intel: a goal he lacks (Prey selects), the organization's whole history, or a profile (Origin, attributes, qualities, feats, class abilities) of 1 player or special character the Prey selects.",
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
      "summary": "Predator's approach switches: high profile <-> low profile.",
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
      "summary": "Predator takes or wrecks 1 Site benefit where he is and has to get out. Prey banks action dice = current Lead, spendable solely on Surprise Chase, Surprise Combat or Wanted events aimed at him.",
      "repeat": ""
     },
     {
      "id": "reconnaissance",
      "name": "Reconnaissance",
      "leadShift": 0,
      "victory": false,
      "summary": "Predator gains 1 piece of intel, Prey selecting: where and what 1 undiscovered Site is, 1 Rating he lacks, or complete stats for 1 standard character.",
      "repeat": "Every 2 further picks: 1 more item.",
      "repeatEvery": 2
     },
     {
      "id": "relocate",
      "name": "Relocate",
      "leadShift": 0,
      "victory": false,
      "summary": "Prey shifts 1 Site somewhere new; the Predator no longer knows where it is.",
      "repeat": "Every 2 further picks: 1 more Site moved.",
      "repeatEvery": 2
     },
     {
      "id": "revelation",
      "name": "Revelation",
      "leadShift": 0,
      "victory": false,
      "summary": "Optional trade: Prey gives away 1 thing (history; a goal, Rating or Site the Predator lacks; details of a special character; stats of a standard character) and gets 1 bonus action die.",
      "repeat": "Each further pick: 1 more disclosure for 1 more bonus action die.",
      "repeatEvery": 1
     },
     {
      "id": "showdown",
      "name": "Showdown",
      "leadShift": 0,
      "victory": false,
      "summary": "Combat: Predator vs. 1 special NPC, with 1 minion squad too when the organization has one. Beat them all (dead or taken) and play goes on at Lead +2. Anything less: Prey wins, Predator runs, and the Prey banks action dice = Lead for hostile events.",
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
      "summary": "1d4 stress damage to all but the winner; it stays until the infiltration is over.",
      "repeat": "Each further pick adds +1d4 stress damage.",
      "repeatEvery": 1
     },
     {
      "id": "transfer",
      "name": "Transfer",
      "leadShift": 0,
      "victory": false,
      "summary": "Predator pinpoints 1 Site he knows of (the HQ once every Site is pinpointed) and can get himself reassigned to any Site he knows of.",
      "repeat": "Every 3 further picks: location of 1 more known Site.",
      "repeatEvery": 3
     }
    ],
    "victory": {
     "predator": "Predator learns all Ratings, goals, standard NPC stats and special NPC code names, then picks one: stay embedded with ongoing access (new Conflicts restart at Lead 2), steal/destroy a Site benefit and escape (cover blown), or ambush the mastermind (quick) or another special NPC (slow).",
     "prey": "Every cover identity the Predator has is burned; no new infiltration by him this mission. Prey chooses: throw him out (optionally with legal trouble costing -4 Reputation or -$200,000 Net Worth); play him along (Lead back to 8, +1 error range, 2 action dice; stacks); or spring a slow ambush backed by 4 free action dice."
    },
    "outsideActions": "Round's end: Predator may reach people outside. Every 5 minutes of contact, or fraction, = Prey +4 on next round's opposed check.",
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
       "* Predator value / Prey value."
      ]
     }
    },
    "notes": [
     "Prey's Security bonus: double the better of its Sites and Tools Ratings.",
     "Predator picks a high or low profile approach at the start; it changes only through the New Approach Advantage. Strategies with the high-profile restriction list it in \"other\".",
     "Attendance: Predator all round, Prey 50% of it.",
     "Multiple infiltrators form one Predator group and multiple defenders one Prey group; each group makes one cooperative opposed check per round.",
     "A blank \"skill\" means the default skill (Bureaucracy for Predator, Security for Prey); alternate skill checks have no tags.",
     "Lead here measures the organization's suspicion: it rises toward discovery and falls as the infiltrator burrows deeper.",
     "This Conflict has no Victory Advantage; it ends only by Lead, Crisis, Showdown, Free Time failure, Extraction or Raid.",
     "Bald-Faced Lie / “Before I Kill You…”: a win costs 1 use of the matching class ability and grants free choice of Advantages (1, +1 per 4 points of margin).",
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
    "roundTime": "Per Predator Strategy (5 minutes-1 hour) x situation factor from interrogationModifiers",
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
      "requirements": "Will (base) 6+†",
      "leadMin": null,
      "leadMax": null,
      "ratings": [
       {
        "rating": "Base Will Save",
        "min": 6
       }
      ],
      "ratingsMode": "all",
      "other": "Predator: +1 effective base Will per clue in hand proving the Prey knows something vital",
      "modifier": -2,
      "advantages": [
       "Lead",
       "Slip"
      ],
      "summary": "Elaborate mind game meant to trip the opponent up.",
      "note": "Duration counts only if it is the Predator who picks this.",
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
      "note": "Duration counts only if it is the Predator who picks this.",
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
      "summary": "Dig in for the long haul until something changes elsewhere.",
      "note": "Duration counts only if it is the Predator who picks this.",
      "skill": "",
      "roundDuration": "1 hour"
     },
     {
      "id": "were-done-here",
      "name": "“We’re Done Here”",
      "side": "general",
      "requirements": "Will (base) 7+†",
      "leadMin": null,
      "leadMax": null,
      "ratings": [
       {
        "rating": "Base Will Save",
        "min": 7
       }
      ],
      "ratingsMode": "all",
      "other": "Predator: +1 effective base Will per clue in hand proving the Prey knows something vital",
      "modifier": -12,
      "advantages": [
       "Stress",
       "Victory"
      ],
      "summary": "Angrily push past the limit for an immediate finish.",
      "note": "Duration counts only if it is the Predator who picks this.",
      "skill": "",
      "roundDuration": "15 minutes"
     },
     {
      "id": "bad-cop",
      "name": "Bad Cop",
      "side": "predator",
      "requirements": "Will (base) 4+†",
      "leadMin": null,
      "leadMax": null,
      "ratings": [
       {
        "rating": "Base Will Save",
        "min": 4
       }
      ],
      "ratingsMode": "all",
      "other": "Predator: +1 effective base Will per clue in hand proving the Prey knows something vital",
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
      "requirements": "Will (base) 5+",
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
      "note": "Lacks the † mark that the other Predator Will Save requirements carry.",
      "skill": "Networking (Cha)",
      "roundDuration": "30 minutes"
     },
     {
      "id": "worse-cop",
      "name": "Worse Cop",
      "side": "predator",
      "requirements": "Will (base) 8+†",
      "leadMin": null,
      "leadMax": null,
      "ratings": [
       {
        "rating": "Base Will Save",
        "min": 8
       }
      ],
      "ratingsMode": "all",
      "other": "Predator: +1 effective base Will per clue in hand proving the Prey knows something vital",
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
      "requirements": "Will (base) 8+",
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
      "requirements": "Will (base) 4+",
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
      "requirements": "Will (base) 5+",
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
      "summary": "Until end of scene, the loser's disposition to the winner is 1 grade better (cap: Friendly).",
      "repeat": "Every 3 further picks: 1 more grade.",
      "repeatEvery": 3
     },
     {
      "id": "crisis",
      "name": "Crisis",
      "leadShift": 0,
      "victory": false,
      "summary": "Crisis check: each side rolls Sense Motive (Wis), DC 25 + the other's career level. A lone failure cracks and loses; a double failure changes nothing. Declining the roll hands the other side 2 Lead.",
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
      "summary": "1d4 stress damage to all but the winner; it stays until the interrogation is over.",
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
     "predator": "Prey tells the truth, in full, about 1 event or subject of the Predator's choosing. Further interrogations of him by the same Predator this mission begin at Lead -2 (floor 1).",
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
        "Slight — embarrassment",
        4
       ],
       [
        "Moderate — minor legal trouble or payback",
        5
       ],
       [
        "Extreme — a vendetta or serious charges",
        6
       ],
       [
        "Deadly — lethal danger or gravest charges, extending to loved ones",
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
        "Prey free to go**",
        "×1/2",
        "-6/+0",
        "+2/+0"
       ],
       [
        "Situation",
        "Prey held / no exit",
        "×1",
        "+0/+0",
        "+0/+0"
       ],
       [
        "Situation",
        "Lawyer present",
        "×1.5",
        "-6/+0",
        "+2/+0"
       ],
       [
        "Situation",
        "Release or rescue expected this round",
        "—",
        "+0/+2",
        "+0/+0"
       ],
       [
        "Situation",
        "Rescue ruled out",
        "—",
        "+0/-4",
        "+0/+1"
       ],
       [
        "Duress",
        "Threat: minor harm/hassle",
        "—",
        "+0/+0",
        "+0/+0"
       ],
       [
        "Duress",
        "Threat: jail or violence",
        "—",
        "+0/-2",
        "+0/+0"
       ],
       [
        "Duress",
        "Threat: death",
        "—",
        "+0/-4",
        "+0/+1"
       ],
       [
        "Duress",
        "Threat: torture",
        "—",
        "+0/-6",
        "+1/+2"
       ],
       [
        "Duress",
        "Act: jail or violence (Prey or another person)†",
        "—",
        "+0/-6",
        "+1/+2"
       ],
       [
        "Duress",
        "Act: killing (another person)†",
        "—",
        "+0/-8",
        "+2/+3"
       ],
       [
        "Duress",
        "Act: torture (Prey or another person)†",
        "—",
        "+0/-10",
        "+3/+4"
       ],
       [
        "Incentive†",
        "Offer: money††",
        "—",
        "+2/+0",
        "+0/+0"
       ],
       [
        "Incentive†",
        "Offer: lighter penalty",
        "—",
        "+4/+0",
        "+1/+0"
       ],
       [
        "Incentive†",
        "Offer: protection",
        "—",
        "+6/+0",
        "+2/+0"
       ],
       [
        "Incentive†",
        "Offer: immunity",
        "—",
        "+8/+0",
        "+3/+0"
       ]
      ],
      "notes": [
       "* Predator value / Prey value.",
       "** Free to go in principle, yet stuck there until he wins.",
       "† Never accepted willingly by a Prey who could walk out; usually counts as exposure too.",
       "†† Minimum sum equals a bribe; each doubling of that base adds +2 more.",
       "\"Category\" column is added here to carry the table's sub-headings (Situation, Duress, Incentive†)."
      ]
     }
    },
    "notes": [
     "Predator uses Intimidate with Str for physical force or Wis for mental pressure.",
     "Quick version: a single Intimidate (Str or Wis) roll vs. DC = 10 + Bluff bonus of the subject; Table 6.11 modifiers apply.",
     "Round length comes from the Predator's Strategy (\"roundDuration\"); Prey strategies list no duration, and General strategy durations count only when the Predator picks them. Both sides must be present for half the round (rounded up).",
     "A blank \"skill\" means the default skill; alternate skill checks have no tags.",
     "† requirements: each clue proving the Prey knows something vital raises the Predator's effective base Will by 1.",
     "Thresholds — violence: lethal damage of 5 or 1/4 of the victim's wound points, whichever is less. Torture: a critical injury, or lethal damage of 10 or 1/3 of wound points, whichever is less.",
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
    "prey": "Fugitive(s) last located under 24 hours ago",
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
    "roundTime": "1 day; 4+ hours of it spent on the hunt by each side",
    "powerRatings": [
     "Spending Cash",
     "Tools Rating"
    ],
    "startingLead": {
     "default": 5,
     "summary": "Depends on how wide the initial search area is: 4 (neighborhood) through 8 (continent). Wider than a single continent = no manhunt possible.",
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
       "when": "Starting radius: state / small nation",
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
      "other": "Class ability required: master tracker (p.44)",
      "modifier": 0,
      "advantages": [
       "*"
      ],
      "summary": "Pin the opponent down or slip the net. On a win, 1 use of the class ability buys free choice of Advantages (Victory excluded).",
      "note": "Advantage column allows anything but Victory.",
      "skill": "",
      "publicityOnChoose": 0
     },
     {
      "id": "all-points-bulletin",
      "name": "All Points Bulletin",
      "side": "predator",
      "requirements": "Cash or Tools 4+",
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
      "requirements": "Cash or Tools 7+",
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
      "requirements": "Cash or Tools 6+",
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
      "requirements": "Cash or Tools 6+",
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
      "summary": "Think like the fugitive to guess where he goes next.",
      "note": "",
      "skill": "Manipulate (Wis)",
      "publicityOnChoose": 0
     },
     {
      "id": "surveillance",
      "name": "Surveillance",
      "side": "predator",
      "requirements": "Cash or Tools 5+",
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
      "requirements": "Cash or Tools 3+",
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
      "requirements": "Cash or Tools 5+",
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
      "requirements": "Cash or Tools 4+",
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
      "requirements": "Cash or Tools 3+",
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
      "requirements": "Cash or Tools 6+",
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
      "summary": "Bolt for the edge of the dragnet.",
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
      "requirements": "Cash or Tools 7+",
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
      "requirements": "Cash or Tools 7+",
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
      "summary": "Launch a chase: GC assigns vehicles, chase Lead begins at the manhunt's current Lead, and the Predator receives 2 bonus action dice usable on the chase's skill checks. A Prey win in the chase also wins the manhunt.",
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
      "summary": "Publicity +1.",
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
      "summary": "Predator turns up somewhere the Prey has been; Table 6.15 gives when (treat Lead as +1 if the Prey uses a cover identity). Passing Investigation/Canvass Area or Search/Perception at that row's DC finds 1 clue; every clue = +2 to his manhunt checks from then on.",
      "repeat": "Every 2 further picks: read the table 1 Lead lower (real Lead stays).",
      "repeatEvery": 2
     },
     {
      "id": "public-support",
      "name": "Public Support",
      "leadShift": 0,
      "victory": false,
      "summary": "Publicity -2.",
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
      "summary": "1d4 stress damage to all but the winner; it stays until the manhunt is over.",
      "repeat": "Each further pick adds +1d4 stress damage.",
      "repeatEvery": 1
     },
     {
      "id": "twist",
      "name": "Twist",
      "leadShift": 0,
      "victory": false,
      "summary": "Next opposed check: winner may swap in Athletics/Str, Bureaucracy/Cha, Computers/Int, Drive/Dex, Networking/Cha, Search/Int, Sneak/Dex or Streetwise/Wis (tags ignored).",
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
     "predator": "Prey pinpointed. Predator either closes in (typically a fight or chase opened by a slow ambush) or holds back to observe: Lead becomes 1 and the hunt resumes the following day.",
     "prey": "Prey's side vanishes; no locating them again this scene."
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
        "Secret conspiracy",
        3
       ],
       [
        "Predator Organization’s Authority",
        "Obscure group avoiding attention",
        5
       ],
       [
        "Predator Organization’s Authority",
        "Official body of doubtful standing",
        7
       ],
       [
        "Predator Organization’s Authority",
        "Body with famous or feared leaders",
        9
       ],
       [
        "Predator Organization’s Authority",
        "Open law-enforcement body",
        "No limit*"
       ],
       [
        "Prey Notoriety",
        "Inconsequential — small-time",
        "+0"
       ],
       [
        "Prey Notoriety",
        "Interesting — tied to a small organization",
        "+1"
       ],
       [
        "Prey Notoriety",
        "Significant — tied to a large organization",
        "+2"
       ],
       [
        "Prey Notoriety",
        "Urgent — standing menace, or tied to a worldwide organization",
        "+4"
       ],
       [
        "Prey Notoriety",
        "Vital — existential danger or WMD link",
        "No limit*"
       ]
      ],
      "notes": [
       "* Overrides all other publicity modifiers; the hunt continues whatever disruption it causes.",
       "Limit = authority base + notoriety modifier. \"Category\" column is added here to carry the table's sub-headings."
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
        "Predator's backers must stay covert",
        "-6/+0",
        "+2/+0"
       ],
       [
        "Situation",
        "Each Prey beyond the 3rd",
        "+0/-1",
        "+0/+0"
       ],
       [
        "Public Opinion",
        "Locals/media: hostile to Predator",
        "-2/+0",
        "+0/+0"
       ],
       [
        "Public Opinion",
        "Locals/media: afraid of Predator",
        "-4/+0",
        "+0/-2"
       ],
       [
        "Public Opinion",
        "Locals/media: back the Predator",
        "+0/-2",
        "+0/+0"
       ],
       [
        "Public Opinion",
        "Locals/media: accustomed to surveillance",
        "+0/-4",
        "-2/+0"
       ],
       [
        "Public Opinion",
        "Locals/media: Prey already a familiar face",
        "+0/-4",
        "+0/+1"
       ],
       [
        "Prey, Past 24 Hours",
        "Tried public transit or a rental",
        "+0/-4",
        "+0/+1"
       ],
       [
        "Prey, Past 24 Hours",
        "Traceable call(s)",
        "+0/-2",
        "+0/+0"
       ],
       [
        "Prey, Past 24 Hours",
        "Showed real (non-cover) ID",
        "+0/-2",
        "+0/+0"
       ],
       [
        "Prey, Past 24 Hours",
        "Medical care, each patient",
        "+0/-4",
        "+0/+1"
       ],
       [
        "Prey, Past 24 Hours",
        "Spending $1,001-$10,000",
        "+0/-2",
        "+0/+0"
       ],
       [
        "Prey, Past 24 Hours",
        "Spending $10,001-$50,000",
        "+0/-4",
        "+0/+0"
       ],
       [
        "Prey, Past 24 Hours",
        "Spending over $50,000",
        "+0/-6",
        "+0/+0"
       ],
       [
        "Prey, Past 24 Hours",
        "Moved over 5 × Lead miles",
        "+0/-2",
        "+0/+0"
       ]
      ],
      "notes": [
       "* Predator value / Prey value.",
       "\"Category\" column is added here to carry the table's sub-headings."
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
        "Ahead of Prey by 1d4 hours",
        15
       ],
       [
        "1",
        "Simultaneous, more or less (GC's call)",
        20
       ],
       [
        "2",
        "Behind Prey by 4d4 minutes",
        25
       ],
       [
        "3",
        "Behind Prey by 2d4 × 10 minutes",
        30
       ],
       [
        "4",
        "Behind Prey by 1d6 hours",
        35
       ],
       [
        "5",
        "Behind Prey by 4d6 hours",
        40
       ],
       [
        "6+",
        "Behind Prey by over 1 day",
        "Impossible"
       ]
      ],
      "notes": [
       "Lead column uses the modified Lead from the Profile Advantage (cover identity +1, Fake Out +2, repeat picks -1), not the actual Lead."
      ]
     }
    },
    "notes": [
     "Preconditions: a fix on the Prey less than 24 hours old, and a search area no bigger than a continent.",
     "Quick version: Complex Task, Challenges = starting Lead, Investigation (Wis) vs. DC 10 + Prey's Blend bonus.",
     "Track a publicity score. Limit = Predator organization's authority base + Prey notoriety modifier (Table 6.13). At or above the limit the hunt is called off (Prey wins) and the Predator cannot start another manhunt this mission.",
     "Strategies with \"publicityOnChoose\" change publicity when chosen regardless of the check result; Outcry, Pause and Public Support also move it.",
     "\"Cash or Tools N+\" requirements are stored as two ratings in \"any\" mode: the participant's own Spending Cash, or his organization's Tools.",
     "Multiple Predator groups on one Prey: each pairing has its own Lead and is handled in ascending Lead order; the Prey can use a separate Strategy against each. Chained hunts go front to back.",
     "A blank \"skill\" means the default skill; alternate skill checks have no tags.",
     "“Take Him!”: a win costs 1 master tracker use and grants free choice of Advantages (1, +1 per 4 points of margin; Victory excluded)."
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
    "roundTime": "Per Predator Strategy (1 minute-1 day); both parties attend 50% of it, round up",
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
      "note": "** mark: on a win, extend the round by however long the favor takes.",
      "roundDuration": "10 minutes"
     },
     {
      "id": "compromising-position",
      "name": "Compromising Position",
      "side": "predator",
      "requirements": "Cash 5+ / Image 4+ (either)",
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
      "summary": "Hint at scandal or ruin to apply pressure.",
      "note": "",
      "roundDuration": "1 day"
     },
     {
      "id": "extra-incentive",
      "name": "Extra Incentive",
      "side": "predator",
      "requirements": "Cash 4+ / Image 6+ (either)",
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
      "note": "** mark: on a win, extend the round by however long the favor takes.",
      "roundDuration": "1 minute"
     },
     {
      "id": "seal-the-deal",
      "name": "Seal the Deal",
      "side": "predator",
      "requirements": "Cash 7+ / Image 6+ (either)",
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
      "note": "The book's strategy descriptions have no entry for this one.",
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
      "note": "** mark: on a win, extend the round by however long the favor takes.",
      "roundDuration": "4 hours"
     },
     {
      "id": "wine-and-dine",
      "name": "Wine and Dine",
      "side": "predator",
      "requirements": "Cash 4+ / Image 3+ (either)",
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
      "requirements": "Lifestyle 7+ / History 6+ (either)",
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
      "summary": "Use the growing closeness to reverse who is working whom.",
      "note": "",
      "roundDuration": "—"
     },
     {
      "id": "its-not-right",
      "name": "“It’s Not Right!”",
      "side": "prey",
      "requirements": "Lifestyle 4+ / History 3+ (either)",
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
      "requirements": "Lifestyle 4+ / History 5+ (either)",
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
      "note": "** mark: on a win, extend the round by however long the favor takes. The book's duration cell holds nothing but the ** mark.",
      "roundDuration": "**"
     },
     {
      "id": "people-will-talk",
      "name": "“People Will Talk”",
      "side": "prey",
      "requirements": "Lifestyle 6+ / History 4+ (either)",
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
      "note": "** mark: on a win, extend the round by however long the favor takes. The book's duration cell holds nothing but the ** mark.",
      "roundDuration": "**"
     }
    ],
    "advantages": [
     {
      "id": "charm",
      "name": "Charm",
      "leadShift": 0,
      "victory": false,
      "summary": "Until the mission is over, the Prey's disposition to the Predator is 1 grade better (cap: Supportive).",
      "repeat": "Every 3 further picks: 1 more grade.",
      "repeatEvery": 3
     },
     {
      "id": "crisis",
      "name": "Crisis",
      "leadShift": 0,
      "victory": false,
      "summary": "Crisis check: each side rolls Cultures (Cha), DC 25 + the other's career level. A lone failure is a faux pas that loses the Conflict; a double failure changes nothing. Declining the roll hands the other side 2 Lead.",
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
      "summary": "Until the mission is over, the Prey's disposition to the Predator is 1 grade worse (floor: Hostile).",
      "repeat": "Every 3 further picks: 1 more grade.",
      "repeatEvery": 3
     },
     {
      "id": "favor",
      "name": "Favor",
      "leadShift": 0,
      "victory": false,
      "summary": "Winner can call in 1 action from the loser, treated as a successful Persuasion check at a penalty no worse than -6. Cashing it in shifts Lead 1 the loser's way.",
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
      "summary": "1d4 stress damage to all but the winner; it stays until the seduction is over.",
      "repeat": "Each further pick adds +1d4 stress damage.",
      "repeatEvery": 1
     },
     {
      "id": "swap",
      "name": "Swap",
      "leadShift": 0,
      "victory": false,
      "summary": "Sides swap Predator/Prey roles; Lead then goes up 1.",
      "repeat": "",
      "swapRoles": true,
      "absoluteLeadChange": 1
     },
     {
      "id": "twist",
      "name": "Twist",
      "leadShift": 0,
      "victory": false,
      "summary": "Next opposed check: winner may swap in Bluff/Cha, Cultures/Int, Drive/Dex, Manipulate/Cha, Networking/Cha, Profession/Cha or Resolve/Wis (tags ignored).",
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
     "predator": "Prey is now Helpful to the Predator, lasting until some later event moves it.",
     "prey": "Prey is now Adversarial to the Predator. Through mission's end that grade cannot rise and the same Predator gets no further seduction attempts."
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
    "comment": "A garbled word in the source text where \"new Conflict round\" is meant; no data impact."
   },
   {
    "type": "chase",
    "where": "Prey Skill line (p.364)",
    "comment": "The slash between skill and check is missing for the foot and animal entries in the Prey list only; treated the same as the Predator list."
   },
   {
    "type": "chase",
    "where": "Table 6.3, Set Up row",
    "comment": "Table uses a lower-case \"up\"; the description capitalizes it. Name stored as \"Set Up\"."
   },
   {
    "type": "brainwashing",
    "where": "Twist Advantage (p.370)",
    "comment": "The brainwashing Twist text refers to a chase; copy-paste slip in the book."
   },
   {
    "type": "brainwashing",
    "where": "Table 6.5 skill column",
    "comment": "Patience (Predator) lists Resolve (Wis) and Worrisome Smile (Prey) lists Manipulate (Wis): the skills look swapped relative to each side's default, but are kept as the book has them."
   },
   {
    "type": "hacking",
    "where": "Table 6.7, “Shall We Play A Game?” row",
    "comment": "Requirement wraps over two table lines (rating, then software); stored as one requirement."
   },
   {
    "type": "hacking",
    "where": "Table 6.7 Prey rows",
    "comment": "Prey rows put a colon after \"Lead\" in the range requirement, unlike other tables; kept in \"requirements\", parsed normally."
   },
   {
    "type": "hacking",
    "where": "Silhouette Advantage (p.373)",
    "comment": "The text says the silhouette is of the Prey, but the bonus applies against the Predator, so the silhouette must be of the Predator."
   },
   {
    "type": "hacking",
    "where": "Seize Control Advantage (p.373)",
    "comment": "Repeat clause omits the word for \"additional\"; read as 1 more program or device per pick."
   },
   {
    "type": "infiltration",
    "where": "Table 6.9, Inner Circle Trial row",
    "comment": "The ** mark on this Lead 1-3 requirement is only the Ratings cross-reference from the column header; possibly meant to be the high-profile mark. Left with no extra requirement."
   },
   {
    "type": "infiltration",
    "where": "Table 6.9, Mantrap row",
    "comment": "Range written with a hyphen instead of an en dash; parsed as 7 to 9."
   },
   {
    "type": "infiltration",
    "where": "Conspiracy Advantage (p.377)",
    "comment": "The repeat clause names the Prey as choosing the extra target; it should be the Predator, who uses this Advantage."
   },
   {
    "type": "infiltration",
    "where": "Table 6.9, “Any except Victory” rows",
    "comment": "These rows allow any Advantage but Victory, yet infiltration has no Victory Advantage at all (the book says so on p.379); \"*\" still used."
   },
   {
    "type": "infiltration",
    "where": "Reconnaissance Advantage (p.378)",
    "comment": "Garbled characters in the standard-character clause; no data impact."
   },
   {
    "type": "interrogation",
    "where": "Interrogation Timing (p.380)",
    "comment": "The timing paragraph says infiltration in the interrogation section."
   },
   {
    "type": "interrogation",
    "where": "Table 6.12 requirements",
    "comment": "Will Save requirements are written with the plus before the number, unlike other tables; stored as minimum N. Good Cop lacks the † the other Predator rows carry."
   },
   {
    "type": "interrogation",
    "where": "Table 6.11, Incentive sub-heading",
    "comment": "The † footnote (Prey never submits willingly; exposure) fits the Duress acts; its attachment to the Incentive sub-heading looks like a misprint."
   },
   {
    "type": "interrogation",
    "where": "Crisis Advantage (p.382)",
    "comment": "Text is internally inconsistent about what happens when both crack; summarized as: exactly one failure ends it, both failing continues."
   },
   {
    "type": "manhunt",
    "where": "Manhunt Strategies intro (p.384)",
    "comment": "The intro cites the strategies table as Table 6.14; it is Table 6.16 on p.386."
   },
   {
    "type": "manhunt",
    "where": "Outcry Advantage (p.385)",
    "comment": "This Advantage's repeat clause says Challenge where other Advantages say round."
   },
   {
    "type": "manhunt",
    "where": "Table 6.16, Take It Public row",
    "comment": "Table uses a lower-case \"it\"; the description capitalizes it. Stored with capital I."
   },
   {
    "type": "manhunt",
    "where": "Table 6.15 header",
    "comment": "Header split into 4 cells by extraction against 3 data cells; the last two are merged into one column heading."
   },
   {
    "type": "manhunt",
    "where": "Ending a Manhunt (p.386)",
    "comment": "Says chase where manhunt is meant."
   },
   {
    "type": "seduction",
    "where": "Table 6.17, Seal the Deal",
    "comment": "Row present in the table but no matching entry in the Seduction Strategies description list."
   },
   {
    "type": "seduction",
    "where": "“It’s Not You, It’s Me” (p.387 vs Table 6.17)",
    "comment": "Description speaks of the Predator; the table lists it under Prey Only. Stored per the table (Prey)."
   },
   {
    "type": "seduction",
    "where": "Table 6.17 duration cells",
    "comment": "Two Prey duration cells hold only the footnote mark, no duration; kept as \"**\"."
   },
   {
    "type": "seduction",
    "where": "Twist and Victory Advantages (p.388)",
    "comment": "Twist text names a chase and Victory text names an interrogation; wrong Conflict names, copy-paste slips."
   },
   {
    "type": "seduction",
    "where": "Favor Advantage (p.387)",
    "comment": "The check is named with an Influence skill here; elsewhere it is Impress/Persuasion and no Influence skill exists in this chapter."
   },
   {
    "type": "seduction",
    "where": "Charm vs. Ending a Seduction",
    "comment": "Disposition grades as given in the book (Charm cap Supportive, Predator victory Helpful, Prey victory Adversarial, Disappoint floor Hostile); verify against the disposition scale."
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
    "gearCaliberShift": 1,
    "wealthBonus": 4
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
   "effects": {
    "goodAndEvil": true
   }
  },
  {
   "id": "bleak",
   "name": "Bleak",
   "page": 406,
   "seasonOnly": false,
   "xp": 75,
   "gcDice": null,
   "summary": "PCs open every session 2 action dice short (floor 0), and PC action dice do not explode. Class ability use counts based on starting dice ignore the reduction.",
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
   "summary": "Threats on hits by player and special characters become critical hits free of charge; the attacker pays 1 action die only if he wants to decline.",
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
   "effects": {
    "bottomlessClip": true
   }
  },
  {
   "id": "bulletproof",
   "name": "Bulletproof",
   "page": 406,
   "seasonOnly": false,
   "xp": -75,
   "gcDice": 1,
   "summary": "Critical injuries against player and special characters cost 1 extra action die to activate. The critical injury save band becomes 36-60 damage, with the fall to -9 wounds at 61+. Medicine: DCs -5, error ranges -2.",
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
   "summary": "1/session, on rolling a threat (attack or skill), a player/special character may deliver a signature line as a free action. Effect: morale bonus on Defense and Resist checks = 2x Charisma bonus (at least +1), lasting half his career level in rounds (round up).",
   "effects": {
    "catchPhrase": true
   }
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
    "skillDC": 5,
    "lowestAttributeErrorIncrease": 2,
    "errorActivationDiceMaximum": 2,
    "take10TimeMultiplier": 4
   }
  },
  {
   "id": "common-spectacle",
   "name": "Common Spectacle",
   "page": 406,
   "seasonOnly": true,
   "xp": -25,
   "gcDice": null,
   "summary": "Triumph threshold: skill result 60+. Triumph XP bonus: only 5%.",
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
   "summary": "No GC action dice may be spent to flag characters as honorable in bribes. Honor-code breaches cost half the usual Reputation / Net Worth exposure penalty (round down).",
   "effects": {
    "honorExposureMultiplier": 0.5
   }
  },
  {
   "id": "diplomatic",
   "name": "Diplomatic",
   "page": 406,
   "seasonOnly": false,
   "xp": -25,
   "gcDice": 1,
   "summary": "Player and special characters get +1 on top of any skill bonus granted by a target's favorable disposition.",
   "effects": {
    "favorableDispositionBonus": 1
   }
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
   "effects": {
    "featPurchase": true
   }
  },
  {
   "id": "fragile",
   "name": "Fragile",
   "page": 407,
   "seasonOnly": true,
   "xp": 0,
   "gcDice": null,
   "summary": "After Level 1, player and special characters gain fixed vitality per career level: 2 with a d8 vitality die, 3 with a d10, 4 with a d12.",
   "effects": {
    "fixedVitality": true
   }
  },
  {
   "id": "freelance",
   "name": "Freelance",
   "page": 407,
   "seasonOnly": true,
   "xp": 0,
   "gcDice": null,
   "summary": "PCs are independents backed by a web of supporters and use the Freelance gear rules. They earn only Net Worth, never Reputation. Cannot be combined with Faction.",
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
   "summary": "CQB range covers Melee Range through 20 ft. All characters (NPCs too) gain +1 Defense vs. ranged attacks per Melee or Unarmed Combat feat they hold. Stand Offs cannot be interrupted or joined.",
   "effects": {
    "cqbRange": 20,
    "meleeFeatRangedDefense": true,
    "closedStandOffs": true
   }
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
   "summary": "Critical injuries against player and special characters cost 1 less action die to activate (floor 0). The critical injury save band becomes 16-25 damage, with the fall to -9 wounds at 26+. Medicine: DCs +5, error ranges +2.",
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
   "summary": "Pick a year for the season. Gear that did not exist yet is available only as a gadget (Housing or effect), at +1 Caliber (cap V). Table 7.4 scales monetary values and actual costs by era: x0.01 for 1875-1900 rising to x1 from 1990.",
   "effects": {
    "historicalMoney": true
   }
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
   "effects": {
    "allClassSkills": true
   }
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
   "effects": {
    "stressMultiplier": 0.5
   }
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
   "effects": {
    "modularFeats": true
   }
  },
  {
   "id": "omni-competent",
   "name": "Omni-Competent",
   "page": 408,
   "seasonOnly": false,
   "xp": -100,
   "gcDice": 1,
   "summary": "No result caps on skill checks; every check is treated as active; skill penalties are cut in half (round down, never better than -1).",
   "effects": {
    "noSkillResultCaps": true,
    "halveSkillPenalties": true,
    "allChecksActive": true
   }
  },
  {
   "id": "paranoid",
   "name": "Paranoid",
   "page": 408,
   "seasonOnly": false,
   "xp": 0,
   "gcDice": 2,
   "summary": "Player and special characters get +4 morale on Blend/Stealth and Sneak/Hide checks that decide surprise rounds. All characters take -4 morale on skill checks to shift disposition or persuade a target into an action.",
   "effects": {
    "surpriseHideBonus": 4,
    "dispositionCheckModifier": -4
   }
  },
  {
   "id": "rare-spectacle",
   "name": "Rare Spectacle",
   "page": 408,
   "seasonOnly": false,
   "xp": 25,
   "gcDice": 4,
   "summary": "Triumph threshold: skill result 90+.",
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
   "summary": "A PC killed in a standard scene, body still whole, can return when the next mission begins for 200 Reputation or $10,000,000.",
   "effects": {
    "revolvingDoor": true
   }
  },
  {
   "id": "routine",
   "name": "Routine",
   "page": 408,
   "seasonOnly": true,
   "xp": 0,
   "gcDice": null,
   "summary": "Characters can never take on Crossroads Subplots.",
   "effects": {
    "noCrossroads": true
   }
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
   "effects": {
    "pointBuy": 32
   }
  },
  {
   "id": "soap",
   "name": "Soap",
   "page": 408,
   "seasonOnly": true,
   "xp": 0,
   "gcDice": null,
   "summary": "Each character may be involved in 1 more Subplot at a time than normal.",
   "effects": {
    "subplotLimitBonus": 1
   }
  },
  {
   "id": "speed-frame",
   "name": "Speed-Frame",
   "page": 408,
   "seasonOnly": false,
   "xp": -25,
   "gcDice": 1,
   "summary": "Complex Tasks need 1 fewer Challenge (minimum 1). In Dramatic Conflicts, every Lead Advantage has its effect raised by 1.",
   "effects": {
    "complexTaskChallenges": -1,
    "leadAdvantageShift": 1
   }
  },
  {
   "id": "spirited",
   "name": "Spirited",
   "page": 408,
   "seasonOnly": false,
   "xp": -50,
   "gcDice": null,
   "summary": "PCs open every session with +2 action dice (class ability use counts based on starting dice unchanged). PC action dice explode on a natural 1 as well, and each die type is 1 step bigger (d4 becomes d6, d6 becomes d8, etc.).",
   "effects": {
    "startingActionDice": 2,
    "actionDiceExplodeLow": true,
    "actionDieStep": 1
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
   "effects": {
    "attackModifier": -1
   }
  },
  {
   "id": "tense",
   "name": "Tense",
   "page": 408,
   "seasonOnly": false,
   "xp": 75,
   "gcDice": 3,
   "summary": "Stress damage x2. Taking 10 on skill checks is off the table for everybody.",
   "effects": {
    "stressMultiplier": 2,
    "noTakeTen": true
   }
  },
  {
   "id": "thriller",
   "name": "Thriller",
   "page": 408,
   "seasonOnly": false,
   "xp": 25,
   "gcDice": null,
   "summary": "Complex Tasks need 1 more Challenge (may exceed 10). In Dramatic Conflicts, every Lead result has its effect lowered by 1 (minimum 0).",
   "effects": {
    "complexTaskChallenges": 1,
    "leadAdvantageShift": -1
   }
  },
  {
   "id": "violent",
   "name": "Violent",
   "page": 408,
   "seasonOnly": false,
   "xp": 50,
   "gcDice": 2,
   "summary": "Threat ranges of all attack checks by any character, NPCs included, widen by 2.",
   "effects": {
    "attackThreatIncrease": 2
   }
  },
  {
   "id": "virtuous",
   "name": "Virtuous",
   "page": 408,
   "seasonOnly": false,
   "xp": 25,
   "gcDice": 1,
   "summary": "Honor-code breaches cost double the usual Reputation / Net Worth exposure penalty.",
   "effects": {
    "honorExposureMultiplier": 2
   }
  },
  {
   "id": "wire-fu",
   "name": "Wire Fu",
   "page": 408,
   "seasonOnly": false,
   "xp": -25,
   "gcDice": 1,
   "summary": "Player and special characters may move in any direction, including straight up or along walls. Ending movement off a stable surface triggers the falling rules, but falling damage is halved (rounded down).",
   "effects": {
    "fallingDamageMultiplier": 0.5
   }
  }
 ]
};
