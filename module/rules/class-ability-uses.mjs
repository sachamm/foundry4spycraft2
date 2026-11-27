import { classFeatureLevels } from "./class-features.mjs";
/**
 * Counted class abilities.
 *
 * A class ability that may be used a set number of times in a session, mission or combat, and that the rules do not
 * otherwise carry out, is counted here: the Classes tab lists it with its uses left and a Use button, which records
 * the use and posts a card. What the ability does is applied at the table.
 *
 * Each row is [class key, ability name, period, [[class level, uses], …]]; the last step reached sets the limit.
 * Names and numbers only.
 */
export const CLASS_ABILITY_USES = [
  [
    "advocate",
    "Crusade",
    "session",
    [
      [10, 1],
      [20, 2]
    ]
  ],
  ["advocate", "True Believer", "session", [[14, 1]]],
  [
    "explorer",
    "The Notebook",
    "session",
    [
      [10, 1],
      [20, 2]
    ]
  ],
  [
    "faceman",
    "Cold Read",
    "session",
    [
      [2, 1],
      [11, 2],
      [19, 3]
    ]
  ],
  [
    "faceman",
    "Quick Change",
    "session",
    [
      [3, 2],
      [7, 4],
      [11, 6],
      [15, 8],
      [19, 10]
    ]
  ],
  [
    "faceman",
    "Bald-Faced Lie",
    "session",
    [
      [10, 1],
      [20, 2]
    ]
  ],
  ["faceman", "Doppelganger", "mission", [[14, 1]]],
  [
    "hacker",
    "Trap Door",
    "mission",
    [
      [3, 1],
      [7, 2],
      [11, 3],
      [15, 4],
      [19, 5]
    ]
  ],
  [
    "hacker",
    "Master Cracker",
    "session",
    [
      [5, 1],
      [9, 2],
      [13, 3],
      [17, 4]
    ]
  ],
  [
    "intruder",
    "Wildcard Gear",
    "session",
    [
      [10, 1],
      [20, 2]
    ]
  ],
  ["pointman", "Serendipity", "session", [[14, 1]]],
  [
    "scout",
    "Master Tracker",
    "session",
    [
      [10, 1],
      [20, 2]
    ]
  ],
  ["scout", "Overrun", "session", [[14, 1]]],
  [
    "snoop",
    "Intercept Communication",
    "session",
    [
      [3, 1],
      [7, 2],
      [11, 3],
      [15, 4],
      [19, 5]
    ]
  ],
  [
    "snoop",
    "Abort!",
    "session",
    [
      [9, 1],
      [15, 2]
    ]
  ],
  [
    "snoop",
    "Big Brother",
    "mission",
    [
      [10, 1],
      [20, 2]
    ]
  ],
  [
    "wheelman",
    "That's Impossible!",
    "session",
    [
      [10, 1],
      [20, 2]
    ]
  ],
  ["brawler", "Fight Club", "combat", [[8, 1]]],
  [
    "cleaner",
    "Status Quo",
    "mission",
    [
      [3, 1],
      [5, 2],
      [7, 3],
      [9, 4]
    ]
  ],
  ["counterterrorist", "Tactical Commander", "combat", [[8, 1]]],
  ["counterterrorist", "First Strike", "combat", [[10, 1]]],
  ["fieldAnalyst", "Sum Up", "mission", [[10, 1]]],
  ["grunt", "Battle Cry", "session", [[10, 1]]],
  [
    "inventor",
    "Wildcard Gadget",
    "session",
    [
      [6, 1],
      [10, 2]
    ]
  ],
  [
    "stuntman",
    "Insane Stunt",
    "session",
    [
      [5, 1],
      [9, 2]
    ]
  ],
  ["stuntman", "Cheat Death", "session", [[10, 1]]],
  [
    "tactician",
    "Orders",
    "session",
    [
      [4, 1],
      [8, 2]
    ]
  ],
  ["tactician", "Seize the Moment", "combat", [[10, 1]]],
  [
    "transporter",
    "The Getaway",
    "session",
    [
      [4, 1],
      [8, 2]
    ]
  ],
  ["transporter", "The Switcheroo", "session", [[10, 1]]]
];

const idOf = (classKey, name) => `classUse_${classKey}_${name.replace(/[^A-Za-z0-9]/g, "")}`;

// The cross-class list sets its own Trap Door period (p.40); the native Hacker entry remains per mission (p.36).
const INHERITED_USES = [
  ["Faceman:Cold read (1/session)", "faceman", "Cold Read", "session", 2, 1],
  ["Faceman:Quick change (2/session)", "faceman", "Quick Change", "session", 3, 2],
  ["Hacker:Trap door (1/session)", "hacker", "Trap Door", "session", 3, 1],
  ["Snoop:Intercept communication (1/session)", "snoop", "Intercept Communication", "session", 3, 1]
];

/** The counted class abilities a character has reached, as limited-use entries with the manual workflow. */
export function classAbilityUseSpecs(system, table = CLASS_ABILITY_USES) {
  const out = [];
  for (const [classKey, name, period, steps] of table) {
    const level = Number(classFeatureLevels(system)?.[classKey]) || 0;
    let limit = 0;
    for (const [at, uses] of steps) if (level >= at) limit = uses;
    if (!limit) continue;
    out.push({
      id: idOf(classKey, name),
      name,
      period,
      limit,
      cost: 0,
      workflow: "manual",
      ...(period === "combat" ? { combatScoped: true } : {})
    });
  }
  const present = new Set(out.map(spec => spec.id));
  for (const entry of system.inheritedClassChoices ?? []) {
    const definition = INHERITED_USES.find(([abilityId]) => abilityId === entry.abilityId);
    if (!definition) continue;
    const [, classKey, name, period, assumedLevel, limit] = definition;
    if (
      entry.emulatedClass !== classKey ||
      entry.assumedLevel !== assumedLevel ||
      (classFeatureLevels(system)?.[classKey] ?? 0) >= assumedLevel
    )
      continue;
    const id = idOf(classKey, name);
    if (present.has(id)) continue;
    present.add(id);
    out.push({ id, name, period, limit, cost: 0, workflow: "manual" });
  }
  return out;
}
