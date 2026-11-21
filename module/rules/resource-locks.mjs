/** The fixed ids of the lock items module/services/transactions.mjs creates on a character, one per lock scope. */
export const RESOURCE_LOCK_ID = "sc2ResourceLock1";
export const RULE_RESOURCE_LOCK_ID = "sc2RuleStateLk01";
export const GC_RESOURCE_LOCK_ID = "sc2GCResourceLk1";

/** A live lock item (it carries a token), as opposed to an ordinary item that happens to reuse an id. */
export const isResourceLock = item =>
  [RESOURCE_LOCK_ID, GC_RESOURCE_LOCK_ID, RULE_RESOURCE_LOCK_ID].includes(item?.id ?? item?._id) &&
  !!item.flags?.spycraft2?.resourceLock?.token;
