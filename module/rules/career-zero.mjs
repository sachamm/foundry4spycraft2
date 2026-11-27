/** Ordinary sheets guide creation to level 1; advanced Origin-only games and classless lieutenants can finish at 0. */
export const isCareerZeroCreation = system =>
  (system.level ?? system.progression?.length ?? 0) === 0 &&
  (system.originOnlyCreation === true || system.companionOf?.feat === "Personal Lieutenant");

/** An explicit record distinguishes real level-0 acquisition from the old unknown-level value of 0. */
export const featAcquisitionLevel = system =>
  system?.acquiredAtCareerZero === true && system.acquiredAtLevel === 0 ? 0 : system?.acquiredAtLevel || 1;
