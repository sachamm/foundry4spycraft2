/**
 * The shape of each record the system stores in an open object field on an actor or item.
 *
 * Learnt from three sources and then kept by hand: every update the test suite makes (about 6,000 observations),
 * the compendium documents built from src/data, and the actors and items stored in a played test world. A record
 * that none of them ever wrote lists the keys the code reads and is otherwise left open ("*": "any"). When a
 * workflow starts storing a new key, add it here.
 *
 * Grammar
 *   "number|null"      one of these types: null, boolean, number, string, object, array, any
 *   { key: shape }     a record; every key is optional. "*" gives the shape of any key not listed (a map by id).
 *                      "$also" lists other types the value may be instead (for example "null").
 *                      "$list" gives the element shape when the value may also be a list.
 *   [shape]            a list of that shape
 *
 * Shapes are checked softly (module/data/record-field.mjs): a mismatch is reported in the console and never blocks
 * or alters an update, because a shape learnt from examples can be incomplete.
 */
export const RECORD_SHAPES = {
  cakewalkSkills: {
    version: "number",
    epoch: "string",
    intelligenceModifier: "number",
    skills: ["string"],
    note: "string"
  },
  accumulatedDamage: {
    lastReview: {
      $also: "null",
      "*": "any",
      at: "number",
      before: {
        $also: "null",
        stress: "number",
        subdual: "number"
      },
      id: "string",
      note: "string",
      reviewer: "string",
      stress: "number",
      subdual: "number"
    },
    pending: ["string"],
    revision: "number",
    stress: "number",
    subdual: "number",
    version: "number"
  },
  acquisitionCheck: {
    "*": "any",
    level: "number",
    ok: "boolean",
    signature: "string",
    unmet: ["any"]
  },
  actionDieAwards: {
    "*": {
      count: "number",
      events: ["object"],
      mission: "string"
    }
  },
  analysisTasks: {
    "*": {
      baseChallenges: "number",
      completed: "number",
      createdAt: "number",
      events: ["object"],
      forensicGenius: "boolean",
      forensicsOnly: "boolean",
      id: "string",
      pressureAttempts: ["object"],
      pressured: "boolean",
      requiredChallenges: "number",
      revision: "number",
      status: "string",
      timedOutAt: "number",
      timing: {
        deadline: "number",
        limitSeconds: "number",
        startedAt: "number"
      },
      title: "string",
      trackingMastery: "boolean",
      version: "number"
    }
  },
  armorMissionGrant: {
    "*": "any",
    epoch: "any"
  },
  assistantGroups: [
    {
      city: "string",
      count: "number",
      expiresAtSceneSequence: "number",
      id: "string",
      kitGrade: "number",
      mission: "string",
      name: "string",
      population: "number",
      scene: "string",
      sceneSequence: "number",
      source: "string",
      status: "string",
      template: "string",
      tier: "number",
      withdrawal: {
        event: "string",
        reason: "string",
        scene: "string",
        sceneSequence: "number"
      }
    }
  ],
  attackDamageUses: [
    {
      attackUuid: "string",
      receiptUuid: "null|string",
      reservationId: "string",
      rootAttackUuid: "string",
      sourceEvidence: "string",
      targetUuid: "string",
      version: "number",
      weaponUuid: "string"
    }
  ],
  hazards: {
    contagions: {
      "*": {
        id: "string",
        label: "string",
        name: "string",
        grade: "string",
        kind: "string",
        notes: ["string"],
        doses: "number",
        phase: "string",
        saves: "number",
        exposedAt: "number",
        dueAt: "number",
        primary: { onset: "string", saveDC: "number", effect: "string" },
        secondary: { onset: "string", saveDC: "number", effect: "string" }
      }
    },
    recovered: ["string"],
    fire: {
      $also: "null",
      damage: "number",
      ap: "number",
      suffered: "number",
      scarChecked: "boolean",
      sourceId: "string",
      startedAt: "null|number"
    },
    fireSources: {
      "*": {
        label: "string",
        suffered: "number",
        scarChecked: "boolean",
        needsReview: "boolean",
        startedAt: "null|number",
        scarRoll: { attempt: "string", state: "string", messageUuid: "null|string" },
        review: { note: "string", reviewer: "string", at: "number" }
      }
    },
    acid: {
      $also: "null",
      version: "number",
      sourceIds: ["string"],
      damage: "number",
      suffered: "number",
      injuryChecked: "boolean",
      startedAt: "null|number"
    },
    acidSources: {
      "*": {
        version: "number",
        provenSingleAttack: "boolean",
        label: "string",
        damage: "number",
        suffered: "number",
        phase: "string",
        rounds: "number",
        injuryChecked: "boolean",
        needsReview: "boolean",
        startedAt: "null|number",
        lastCombat: { $also: "null", id: "string", round: "number" },
        hitContext: {
          critical: "boolean",
          criticalDice: "number",
          blast: "boolean",
          attackKind: "string",
          weaponProficiency: "string"
        },
        protection: {
          $also: "null",
          ap: "number",
          reduction: "number",
          unarmoredReduction: "number",
          armorHit: "boolean",
          armorPresent: "boolean",
          armorSaveVerified: "boolean",
          armorUuid: "string"
        },
        roundAttempt: {
          attempt: "string",
          resistanceSource: "any",
          bruiseResistanceSource: "any",
          state: "string",
          damage: "number",
          reduction: "number",
          net: "number",
          suffered: "number",
          combat: { $also: "null", id: "string", round: "number" }
        },
        injuryRoll: { attempt: "string", state: "string", messageUuid: "null|string" },
        review: { note: "string", reviewer: "string", at: "number" }
      }
    },
    exposure: {
      $also: "null",
      type: "string",
      source: "string",
      suffered: "number",
      interval: "null|number",
      startedAt: "null|number",
      injuriesChecked: ["number"],
      lastDamage: "number"
    },
    survival: {
      "*": { saves: "number", lastAt: "null|number" }
    }
  },
  attributeDamage: {
    "*": "any",
    events: [
      {
        ability: "string",
        amount: "number",
        before: "number",
        floor: "null|number",
        id: "string",
        kind: "string",
        missionId: "string",
        requested: "number",
        resistance: "number",
        resistanceSource: "string",
        source: "string",
        version: "number",
        worldTime: "number"
      }
    ],
    recoveries: [
      {
        allocations: "array",
        eventId: "string",
        id: "string",
        kind: "string",
        missionId: "string",
        reason: "string",
        version: "number",
        worldTime: "number"
      }
    ],
    version: "number"
  },
  bigStickMissionPick: {
    "*": "any",
    epoch: "any",
    missionCaliber: "any"
  },
  bonusActionDice: {
    "*": {
      ability: "string",
      at: "number",
      baseCount: "number",
      baseDie: "number",
      bold: "boolean",
      combatId: "string",
      combatRound: "number",
      combatantId: "string",
      die: "number",
      forfeited: "boolean",
      granted: "number",
      id: "string",
      label: "string",
      mandatory: "boolean",
      messageUuid: "string",
      mission: "string",
      needsReview: "boolean",
      nextHalfActionConfirmed: "boolean",
      originalMessageUuid: "string",
      remaining: "number",
      scene: "string",
      session: "string",
      skillKey: "string",
      source: "string",
      unrestricted: "boolean",
      woundEventKey: "string"
    }
  },
  candidateBasis: {
    "*": "any",
    choice: "string",
    confirmed: "boolean",
    level: "number",
    reason: "string",
    reviewedAt: "number",
    reviewedBy: "string",
    scores: {
      $also: "any",
      cha: "number",
      con: "number",
      dex: "number",
      int: "number",
      str: "number",
      wis: "number"
    },
    source: "string"
  },
  careerAgentRewards: {
    "*": {
      activeAtMissionEndConfirmed: "boolean",
      affiliation: "string",
      after: "number",
      amount: "number",
      at: "number",
      before: "number",
      epoch: "string",
      field: "string",
      id: "string",
      missionCompleteConfirmed: "boolean",
      reviewReason: "string",
      reviewedAt: "number",
      reviewedBy: "string",
      source: "string",
      version: "number"
    }
  },
  cheapShots: [
    {
      $also: "any",
      attackerUuid: "string",
      attemptId: "null|string",
      attemptResolved: "boolean",
      attemptReview: {
        at: "number",
        resolution: "string"
      },
      choice: "string",
      doubled: "boolean",
      lastSaveAt: "null|number",
      madeAt: "number",
      recovered: "boolean",
      recoveryMessage: "string",
      repeat: "boolean",
      scene: "string",
      sourceMessage: "string",
      version: "number"
    }
  ],
  choiceLists: [
    {
      key: "string",
      kind: "string",
      name: "string",
      options: ["object"]
    }
  ],
  choices: {
    "*": "any"
  },
  classGearGrant: {
    "*": "any",
    epoch: "any",
    id: "any",
    source: "any"
  },
  classGearGrants: {
    "*": {
      at: "number",
      epoch: "string",
      fingerprint: "string",
      home: "string",
      hourCompletedConfirmed: "boolean",
      itemId: "string",
      name: "string",
      source: "string"
    }
  },
  combatExpertise: {
    "*": "any",
    combatId: "string",
    combatantId: "string",
    dueRound: "number",
    id: "string",
    penalty: "number",
    startRound: "number"
  },
  berserkerRage: {
    $also: "null",
    bonus: "number",
    combatId: "string",
    id: "string",
    rounds: "number",
    startRound: "number",
    tier: "string",
    version: "number"
  },
  companionOf: {
    $also: "null",
    feat: "string",
    ownerUuid: "string",
    ownerLevelAtAcquisition: "number",
    historyReview: { reviewer: "string", note: "string", at: "number" }
  },
  identities: [
    {
      id: "string",
      interests: ["string"],
      name: "string",
      professionFocus: "string"
    }
  ],
  snakeStrikes: [
    {
      combatId: "string",
      id: "string",
      round: "number",
      targetUuid: "string",
      version: "number",
      weaponId: "string"
    }
  ],
  woundDrops: {
    $also: "null",
    combatId: "string",
    count: "number",
    version: "number"
  },
  intenseStance: {
    $also: "null",
    combatId: "string",
    combatantId: "string",
    id: "string",
    startRound: "number",
    version: "number"
  },
  fightDefensively: {
    $also: "null",
    combatId: "string",
    combatantId: "string",
    dueRound: "number",
    id: "string",
    startRound: "number",
    version: "number"
  },
  duelingBasics: {
    $also: "null",
    combatId: "string",
    combatantId: "string",
    dueRound: "number",
    opponentName: "string",
    opponentUuid: "string",
    startRound: "number",
    version: "number"
  },
  combatStance: {
    $also: "null",
    enteredAt: "number",
    id: "string",
    key: "string",
    version: "number"
  },
  damageTrack: {
    "*": "any"
  },
  dartingStyle: {
    $also: "null",
    "*": "any",
    atStartOfInitiative: "boolean",
    combatId: "string",
    combatantId: "string",
    confirmed: "boolean",
    dueRound: "number",
    extraAttacks: "number",
    id: "string",
    penalty: "number",
    startRound: "number"
  },
  defenseBoost: {
    $also: "null",
    gcFunded: "boolean",
    actionDiceReceiptId: "string",
    combatId: "string",
    custom: {
      preserve: "boolean"
    },
    expiresAtRound: "number",
    funding: {
      allocations: ["object"],
      bonusPoolId: "string",
      count: "number",
      die: "number",
      paymentId: "string",
      surcharge: "number",
      totalCost: "number"
    },
    oldOnly: "string",
    rounds: "number",
    startRound: "number"
  },
  disposition: {
    base: "string",
    toward: {
      "*": "any"
    }
  },
  drunkRepositions: [
    {
      appliedAt: "null|number",
      at: "number",
      combatId: "string",
      die: "null|number",
      direction: "null|string",
      distanceFeet: "number",
      id: "string",
      interruptedMovementReviewed: "boolean",
      movementAllowanceCost: "number",
      movementConfirmed: "boolean",
      movementPlan: {
        actorUuid: "string",
        frame: "object",
        from: "object",
        reservedAt: "number",
        routeConfirmed: "boolean",
        to: "object",
        tokenUuid: "string"
      },
      needsReview: "boolean",
      receiptUuid: "null",
      rollJSON: "null|string",
      round: "number",
      roundStartConfirmed: "boolean",
      standing: "boolean",
      state: "string"
    }
  ],
  drunkSleep: {
    completedAt: "null|number",
    condition: "string",
    fullRecoveryConfirmed: "boolean",
    mode: "string",
    needsReview: "boolean",
    ordinaryRuleConfirmed: "boolean",
    requiredHours: "number",
    sourceIds: ["string"],
    startedAt: "number"
  },
  eagleEyeBoost: {
    $also: "null",
    actionDiceReceiptId: "string",
    bonus: "number",
    custom: {
      keep: "number"
    },
    die: "number",
    explodeAt: "number",
    funding: {
      allocations: ["object"],
      bonusPoolId: "string",
      count: "number",
      die: "number",
      paymentId: "string",
      surcharge: "number",
      totalCost: "number"
    },
    rangeIncrease: "number",
    result: "number",
    rolled: "number",
    scene: "string",
    source: "string"
  },
  expertEntry: {
    "*": "any",
    ok: "any",
    unmet: "any"
  },
  fatigueApplications: [
    {
      after: "string",
      at: "number",
      before: "string",
      eventId: "string",
      id: "string",
      kind: "string",
      needsReview: "boolean",
      source: "string"
    }
  ],
  fatigueRest: {
    completedAt: "null|number",
    condition: "string",
    fullRecoveryConfirmed: "boolean",
    mode: "string",
    needsReview: "boolean",
    ordinaryRuleConfirmed: "boolean",
    requiredHours: "number",
    sourceIds: ["string"],
    startedAt: "number"
  },
  tauntBonuses: [
    {
      bonus: "number",
      combatId: "string",
      sourceMessage: "string",
      targetUuid: "string",
      untilRound: "number",
      version: "number"
    }
  ],
  undermined: {
    $also: "null",
    combatId: "string",
    penalty: "number",
    rounds: "number",
    sourceMessage: "string",
    sourceUuid: "string",
    startRound: "number",
    startTurn: "number",
    version: "number"
  },
  feintBonuses: [
    {
      combatId: "string",
      defenderMessage: "string",
      dueRound: "number",
      madeRound: "number",
      receiptUuid: "null|string",
      sourceEvidence: ["string"],
      sourceMessage: "string",
      targetUuid: "string",
      usedBy: "null|string",
      version: "number"
    }
  ],
  feintHistory: [
    {
      attackerUuid: "string",
      combatId: "string",
      defenderMessage: "string",
      round: "number",
      sourceMessage: "string",
      version: "number"
    }
  ],
  fortunesOfWarBoost: {
    combatId: "string",
    combatantId: "string",
    dueRound: "number",
    session: "string",
    startRound: "number"
  },
  gearPickLosses: {
    "*": "any"
  },
  inheritedChoices: {
    "*": "any"
  },
  mentalLeapFatigueEvents: [
    {
      at: "number",
      id: "string",
      reason: "string"
    }
  ],
  mentalLeapRecovery: {
    at: "number",
    causeKeys: ["string"],
    completedHours: "number",
    confirmed: "boolean",
    requiredHours: "number",
    resolvedFrom: "number"
  },
  mentalLeapSleep: {
    at: "number",
    causeKeys: ["string"],
    completedAt: "null|number",
    currentCauseKeys: ["string"],
    dueAt: "number",
    earlierRequirementsConfirmed: "boolean",
    fullSleepConfirmed: "boolean",
    ignoredCauseKeys: ["string"],
    latestOnset: "number",
    legacyCoveredCauseKeys: ["string"],
    legacyReviewRequired: "boolean",
    previousDueAt: "null|number",
    requiredHours: "number",
    requirements: [
      {
        at: "number",
        causeKey: "string",
        dueAt: "number",
        requiredHours: "number"
      }
    ],
    reviewedLegacyNoNewCause: "boolean"
  },
  mentalLeaps: [
    {
      ability: "string",
      bonus: "number",
      combatId: "string",
      combatantId: "string",
      detached: {
        at: "number",
        elapsed: "number"
      },
      ended: {
        at: "number",
        elapsed: "number",
        rounds: "number"
      },
      id: "string",
      session: "string",
      sourceLevel: "number",
      startRound: "number",
      startedAt: "number"
    }
  ],
  missionCaliberGrant: {
    "*": "any",
    epoch: "any"
  },
  missionCaliberPicks: {
    "*": "any"
  },
  missionReserveHistory: [
    {
      attempts: {
        14: "object",
        old: "object"
      },
      caliber: "number",
      charismaPicks: {
        E: "number",
        G: "number",
        R: "number",
        S: "number",
        T: "number",
        V: "number",
        W: "number"
      },
      common: "number",
      epoch: "string",
      initializationSource: "string",
      initialized: "boolean",
      picks: {
        CHA: "number",
        E: "number",
        G: "number",
        R: "number",
        S: "number",
        T: "number",
        V: "number",
        W: "number"
      },
      procureAtIntel: "boolean",
      spent: {
        CHA: "number",
        E: "number",
        G: "number",
        R: "number",
        S: "number",
        T: "number",
        V: "number",
        W: "number"
      },
      spentCommon: "number"
    }
  ],
  missionReserves: {
    attempts: {
      "*": {
        abilityId: "string",
        abilityName: "null|string",
        automatic: "boolean",
        baseCost: "number",
        bonusSources: "array",
        caliber: "number",
        category: "string",
        claimedItemId: "string",
        commonCost: "null|number",
        cost: "number",
        dc: "number",
        delivery: "null|object",
        deliveryMultiplier: "number",
        epoch: "string",
        funding: "array",
        gearAbility: "null|string",
        gearCheckContext: "null|object",
        homeTurf: "boolean",
        id: "string",
        kind: "string",
        localHeroFeats: "array",
        location: "string",
        messageUuid: "string",
        name: "string",
        outsideFaction: "boolean",
        pick: "string",
        preparationHours: "number",
        requestAbility: "string",
        requestLevel: "null|number",
        reserveReview: "object",
        settlementId: "string",
        sourcesOption: "string",
        status: "string",
        success: "boolean|null",
        surcharge: "number"
      }
    },
    caliber: "number",
    charismaPicks: {
      E: "number",
      G: "number",
      R: "number",
      S: "number",
      T: "number",
      V: "number",
      W: "number"
    },
    common: "number",
    epoch: "string",
    initializationSource: "string",
    initialized: "boolean",
    picks: {
      CHA: "number",
      E: "number",
      G: "number",
      R: "number",
      S: "number",
      T: "number",
      V: "number",
      W: "number"
    },
    procureAtIntel: "boolean",
    spent: {
      CHA: "number",
      E: "number",
      G: "number",
      R: "number",
      S: "number",
      T: "number",
      V: "number",
      W: "number"
    },
    spentCommon: "number"
  },
  missionXPRewards: {
    "*": {
      additionalXP: "number",
      at: "number",
      awardBaseBonus: "number",
      awardedDice: "number",
      baseXP: "number",
      combinedBase: "number",
      coreXP: "number",
      level: "number",
      mission: "string",
      modifierReason: "string",
      multiplier: "number",
      settlementId: "string",
      source: "string",
      threatLevel: "number",
      totalXP: "number"
    }
  },
  noFearBoost: {
    $also: "null",
    combatId: "string",
    combatantId: "string",
    dueRound: "number",
    resistance: "number",
    rounds: "number",
    session: "string",
    startRound: "number"
  },
  npcProfile: {
    "*": "any",
    enabled: "boolean",
    equipment: {
      "*": "any",
      gear: ["number"],
      vehicles: ["number"],
      weapons: ["number"]
    },
    extraAmmoPairs: "number",
    grades: {
      "*": "number"
    },
    group: "boolean",
    qualities: ["any"],
    skills: [
      {
        "*": "any",
        grade: "number",
        key: "string"
      }
    ],
    tier: "number"
  },
  originChoices: {
    "*": "any",
    down: "any",
    grantedFocus: "any",
    up: "any"
  },
  prerequisites: {
    eq: "number",
    key: "string",
    min: "number",
    name: "string",
    of: [
      {
        any: "array",
        choice: "string",
        group: "string",
        key: "string",
        min: "number",
        name: "string",
        skill: "string",
        tree: "string",
        type: "string"
      }
    ],
    tree: "string",
    type: "string"
  },
  progressionSkills: {
    "*": "number"
  },
  skillPurchasePolicy: {
    version: "number",
    careerLevel: "number",
    allSkillsClass: "boolean",
    confirmed: "boolean",
    reviewerId: "string",
    note: "string",
    source: "string",
    at: "number"
  },
  promotion: {
    "*": "any",
    mission: "any"
  },
  refreshAction: {
    combatId: "string",
    combatantId: "string",
    dueRound: "number",
    startRound: "number",
    state: "string",
    targeted: "boolean"
  },
  requirements: {
    of: [
      {
        key: "string",
        min: "number",
        name: "string",
        of: "array",
        tree: "string",
        type: "string"
      }
    ],
    type: "string"
  },
  reserveAcquisition: {
    "*": "any",
    attemptId: "any",
    bonusQuantity: "any",
    epoch: "any"
  },
  resourceUses: {
    "*": {
      epoch: "string",
      history: ["object"],
      used: "number|string"
    }
  },
  safeHouses: {
    "*": {
      at: "number",
      atSceneStartConfirmed: "boolean",
      currentLocation: "string",
      epoch: "string",
      houseRank: "number",
      id: "string",
      lifestyle: "number",
      limitAtGrant: "number",
      locationConfirmed: "boolean",
      missionUse: {
        epoch: "string",
        used: "number"
      },
      placement: {
        $also: "null",
        address: "string",
        at: "number",
        city: "string",
        cityPopulation: "number",
        currentCityConfirmed: "boolean",
        description: "string",
        gcConfirmed: "boolean",
        natureConfirmed: "boolean",
        nearestCityConfirmed: "boolean",
        reviewedBy: "string",
        withinTenMilesConfirmed: "boolean"
      },
      population: "number",
      route: "string",
      scene: "string",
      sceneUse: {
        epoch: "string",
        used: "number"
      },
      source: "string",
      version: "number"
    }
  },
  sideStanceDamageUses: [
    {
      attackUuid: "string",
      receiptUuid: "null|string",
      reservationId: "string",
      rootAttackUuid: "string",
      sourceEvidence: "string",
      targetUuid: "string",
      version: "number",
      weaponUuid: "string"
    }
  ],
  sideStanceFeints: [
    {
      defenderMessage: "string",
      receiptUuid: "null|string",
      sourceEvidence: ["string"],
      sourceMessage: "string",
      stanceId: "string",
      targetUuid: "string",
      usedBy: "null|string",
      version: "number"
    }
  ],
  skillChoices: {
    "*": "any"
  },
  stanceRoundMovement: {
    feet: "number",
    key: "string",
    version: "number"
  },
  superiorCover: {
    "*": "any",
    at: "number",
    by: "string",
    combatId: "string",
    combatantId: "string",
    coverLost: "boolean",
    dueRound: "number",
    id: "string",
    note: "string",
    personalCover: "number",
    reflexBonus: "number",
    sceneryCover: "number",
    startRound: "number",
    terrainCover: {
      beforeGrade: "number",
      context: {
        homeTurfCover: "boolean",
        homeTurfCoverSource: "string",
        partialSubmersionCover: "boolean",
        personalCover: "number",
        sceneryCover: "number",
        terrainCoverConfirmed: "boolean"
      },
      grade: "number",
      increase: "number",
      personalCover: "number",
      sceneryCover: "number",
      sources: ["object"],
      version: "number"
    },
    version: "number"
  },
  table: [
    {
      bab: "number",
      defense: "number",
      fort: "number",
      gearE: "number",
      gearG: "number",
      gearR: "number",
      gearS: "number",
      gearT: "number",
      gearV: "number",
      gearW: "number",
      initiative: "number",
      level: "number",
      ref: "number",
      wealth: "number",
      will: "number"
    }
  ],
  temporaryGrant: {
    "*": "any"
  },
  temporaryShares: {
    "*": {
      epoch: "string",
      featIds: ["string"],
      recipients: ["string"]
    }
  },
  totalDefense: {
    "*": "any",
    actionConfirmed: "boolean",
    combatId: "string",
    combatantId: "string",
    dueRound: "number",
    equilibrium: {
      bonus: "number",
      covertFeats: ["object"],
      source: "string",
      version: "number"
    },
    id: "string",
    movement: {
      distanceFeet: "number",
      maximumFeet: "number",
      routeConfirmed: "boolean"
    },
    startRound: "number"
  },
  trainingSkills: {
    "*": "any"
  },
  twoWeaponStyle: {
    $also: "null",
    "*": "any",
    armedConfirmed: "boolean",
    atStartOfInitiative: "boolean",
    combatId: "string",
    combatantId: "string",
    dueRound: "number",
    extraAttacks: "number",
    id: "string",
    penalty: "number",
    previousAttackCounter: {
      $also: "null",
      epoch: "string",
      used: "number"
    },
    startRound: "number",
    weaponIds: ["string"],
    weaponProficiencies: ["string"]
  },
  weaponSpecialist: {
    "*": "any",
    abilities: "any",
    fields: "any",
    pending: "any",
    proficiencies: "any",
    warnings: "any"
  },
  wellFundedGrants: {
    "*": {
      amount: "number",
      at: "number",
      atHome: "boolean",
      epoch: "string",
      home: "string",
      source: "string",
      version: "number",
      wealth: "number"
    }
  }
};
