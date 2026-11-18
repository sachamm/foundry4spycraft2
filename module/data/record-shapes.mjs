/**
 * The shape of each record the system stores in an open object field on an actor.
 *
 * Derived from every update the test suite makes (about 2,600 observations), then kept by hand: when a workflow
 * starts storing a new key, add it here. Five round-clock records and `disposition` were written from their rules.
 *
 * Grammar
 *   "number|null"      one of these types: null, boolean, number, string, object, array, any
 *   { key: shape }     a record; every key is optional. "*" gives the shape of any key not listed (a map by id).
 *                      "$also" lists other types the value may be instead (for example "null").
 *                      "$list" gives the element shape when the value may also be a list.
 *   [shape]            a list of that shape
 *
 * Shapes are checked softly (module/data/record-field.mjs): a mismatch is reported in the console and never blocks
 * or alters an update, because a shape learnt from tests can be incomplete.
 */
export const RECORD_SHAPES = {
  accumulatedDamage: {
    // Seen in stored worlds, not in the tests: the GC's last review of the track.
    lastReview: { $also: "null", "*": "any" },
    pending: ["string"],
    revision: "number",
    stress: "number",
    subdual: "number",
    version: "number"
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
    penalty: "number",
    startRound: "number"
  },
  combatStance: {
    $also: "null",
    enteredAt: "number",
    id: "string",
    key: "string",
    version: "number"
  },
  dartingStyle: {
    "*": "any",
    combatId: "string",
    combatantId: "string",
    dueRound: "number",
    startRound: "number"
  },
  defenseBoost: {
    $also: "null",
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
  refreshAction: {
    combatId: "string",
    combatantId: "string",
    dueRound: "number",
    startRound: "number",
    state: "string",
    targeted: "boolean"
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
  stanceRoundMovement: {
    feet: "number",
    key: "string",
    version: "number"
  },
  superiorCover: {
    "*": "any",
    combatId: "string",
    combatantId: "string",
    dueRound: "number",
    startRound: "number"
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
    combatId: "string",
    combatantId: "string",
    dueRound: "number",
    startRound: "number"
  },
  twoWeaponStyle: {
    "*": "any",
    combatId: "string",
    combatantId: "string",
    dueRound: "number",
    startRound: "number"
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
