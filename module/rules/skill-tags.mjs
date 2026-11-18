/** Hands-On/Language p.101; transmitting Innuendo p.158; Two-Weapon Basics p.176; Bound p.340. */
export function skillTagPlan(
  system,
  key,
  check,
  { oneHanded = false, noSharedLanguage = false, bound = false, conveyingMessage = false } = {}
) {
  bound = bound === true || system.conditionContext?.bound === true;
  const tags = String(check.tags ?? "").replace(/Hands\s*[-–—]?\s*On/gi, "Hands-On");
  const addedHandsOn = key === "senseMotive" && check.id === "innuendo" && conveyingMessage === true,
    handsOn = tags.includes("Hands-On") || addedHandsOn,
    grasp = /\bGrasp\b/i.test(tags),
    language = check.tags.includes("Language"),
    twoWeapon = system.activeFeatNames?.includes("Two-Weapon Basics") === true;
  const mute = system.conditionContext?.mute === true;
  const nauseated = system.conditionContext?.nauseated === true,
    concentration = tags.includes("Concentration");
  const handPenaltyBeforeWheel = handsOn && oneHanded === true ? (twoWeapon ? -2 : -4) : 0,
    wheelWaiver =
      handPenaltyBeforeWheel !== 0 &&
      check.id === "maneuver" &&
      /Gear(?: Only)? \(Vehicle\)/.test(tags) &&
      system.activeFeatNames?.includes("One Hand on the Wheel") === true;
  const silverTongueLanguage =
    language &&
    noSharedLanguage === true &&
    key === "impress" &&
    check.id === "persuasion" &&
    system.activeFeatNames?.includes("Silver Tongue") === true;
  const handPenalty = wheelWaiver ? 0 : handPenaltyBeforeWheel,
    capAdjustment = language && noSharedLanguage === true ? (silverTongueLanguage ? -5 : -20) : 0,
    blockedReason = [
      ...(nauseated && concentration
        ? ["Nauseated: skill checks with the Concentration tag are unavailable (p.342)."]
        : []),
      ...(bound === true && (handsOn || grasp)
        ? ["Bound: actions with the Grasp or Hands-On tags are unavailable (p.340)."]
        : []),
      ...(mute && language ? ["Mute: skill checks with the Language tag are unavailable (p.342)."] : [])
    ].join(" ");
  const notes = [];
  if (wheelWaiver) notes.push("One Hand on the Wheel: no one-handed penalty with this vehicle Maneuver.");
  if (addedHandsOn) notes.push("Transmitting Innuendo adds the Hands-On tag (p.158).");
  if (handPenalty) notes.push(`Hands-On with one hand: ${handPenalty}${twoWeapon ? " (Two-Weapon Basics)" : ""}.`);
  if (capAdjustment)
    notes.push(
      silverTongueLanguage
        ? "Silver Tongue: no shared language reduces the Impress/Persuasion result cap by5instead of20(p.205)."
        : "No shared language or relevant local tongue: Language-tag result cap −20 (p.101)."
    );
  return {
    ...(silverTongueLanguage ? { silverTongueLanguage: true } : {}),
    wheelWaiver,
    handPenaltyBeforeWheel,
    nauseated,
    concentration,
    mute,
    oneHanded: oneHanded === true,
    noSharedLanguage: noSharedLanguage === true,
    bound: bound === true,
    conveyingMessage: conveyingMessage === true,
    addedHandsOn,
    handsOn,
    grasp,
    language,
    twoWeapon: handPenalty !== 0 && twoWeapon,
    handPenalty,
    capAdjustment,
    blockedReason,
    notes
  };
}
