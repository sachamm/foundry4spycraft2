import {
  queueResourceScope,
  GC_RESOURCE_LOCK_ID,
  nativeResourceTransactionsEnabled,
  refreshWorldSetting,
  recoverResourceTransaction
} from "./transactions.mjs";
/** Session-scoped Game Control action dice, pp.397–398. They have no fixed die type. */
let queue = Promise.resolve();
const serialize = work => {
  const next = queue.then(work);
  queue = next.catch(() => {});
  return next;
};
const requireGC = () => {
  if (!game.user?.isGM) throw new Error("Only the GC can manage this action-die pool.");
};
const epoch = () => String(game.settings.get("spycraft2", "usagePeriods")?.session ?? "initial");
export function gcDiceStatus() {
  const stored = game.settings.get("spycraft2", "gcActionDice") ?? {},
    session = epoch(),
    current = stored.session === session;
  const counterReview = current && (!Number.isSafeInteger(stored.value) || stored.value < 0);
  return {
    ...stored,
    current,
    value: current && !counterReview ? stored.value : 0,
    session,
    ...(counterReview ? { counterReview: true } : {})
  };
}
export function startingGCDice(playersPresent, caliber) {
  if (
    !Number.isSafeInteger(playersPresent) ||
    playersPresent < 0 ||
    !Number.isSafeInteger(caliber) ||
    caliber < 1 ||
    caliber > 5
  )
    throw new Error("Enter the number of player characters present and a mission Caliber from I to V.");
  const value = playersPresent + 2 * caliber;
  if (!Number.isSafeInteger(value)) throw new Error("The GC starting balance exceeds a safe whole number.");
  return value;
}
const pendingSettlement = () => {
  const stored = game.settings.get("spycraft2", "gcActionDice")?.settlementReview;
  return stored?.needsReview ? stored : (game.spycraft2?.pendingGCDiceReview ?? stored);
};
const requireSettledGC = () => {
  if (pendingSettlement()?.needsReview) throw new Error("Review the interrupted GC payment before changing the pool.");
};
const requireValidBalance = (pool, { allowAwardReview = false } = {}) => {
  requireSettledGC();
  const periodReview = game.settings.get("spycraft2", "usagePeriodReview");
  if (periodReview?.needsReview || game.spycraft2?.pendingUsagePeriodReview?.needsReview)
    throw new Error("Review the interrupted start before changing the GC pool.");
  if (!allowAwardReview && [...(game.actors ?? [])].some(a => a.flags?.spycraft2?.actionDieAwardReview?.needsReview))
    throw new Error("Review the interrupted player award before changing the GC pool.");
  if (pool.counterReview)
    throw new Error(
      "Review the saved GC action-die balance before spending, awarding or adjusting it. Explicit pool replacement can correct it."
    );
};
const oldestActor = () =>
  [...(game.actors ?? [])]
    .filter(actor => !actor.isToken)
    .sort(
      (a, b) => (a._stats?.createdTime ?? 0) - (b._stats?.createdTime ?? 0) || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0)
    )[0] ?? null;
/** The fixed bookkeeping parent avoids introducing a dummy Actor or privileged socket handler. */
export function gcDiceController({ required = true } = {}) {
  if (!nativeResourceTransactionsEnabled()) return null;
  const id = gcDiceStatus().controllerId,
    actor = id ? game.actors.get(id) : oldestActor();
  if (!actor && required)
    throw new Error(
      id
        ? "The GC resource bookkeeping actor was removed. Recover GC bookkeeping before spending."
        : "Create a character before initializing tracked GC resources."
    );
  return actor ?? null;
}
export async function refreshGCDiceTransaction(controller, { allowRebind = false } = {}) {
  if (!nativeResourceTransactionsEnabled()) return;
  await refreshWorldSetting("spycraft2", "usagePeriods");
  await refreshWorldSetting("spycraft2", "usagePeriodReview");
  await refreshWorldSetting("spycraft2", "gcActionDice");
  const id = gcDiceStatus().controllerId;
  if (!allowRebind && id && controller && id !== controller.id)
    throw new Error("GC resource bookkeeping changed; retry using the current controller.");
}
async function guarded(work) {
  requireGC();
  if (game.ready && !nativeResourceTransactionsEnabled())
    throw new Error("The GC resource transaction service is unavailable. Reload the world before spending.");
  if (!nativeResourceTransactionsEnabled()) return serialize(() => work(null));
  const controller = gcDiceController();
  return queueResourceScope(controller, GC_RESOURCE_LOCK_ID, async () => {
    await refreshGCDiceTransaction(controller);
    return work(controller);
  });
}
export async function withGCPeriodLock(work) {
  const run = async controller => {
    await refreshGCDiceTransaction(controller);
    requireSettledGC();
    return work();
  };
  if (!nativeResourceTransactionsEnabled()) return run(null);
  const controller = gcDiceController({ required: false });
  return controller ? queueResourceScope(controller, GC_RESOURCE_LOCK_ID, () => run(controller)) : run(null);
}
/** Run a character award and its one-for-one GC gain under the shared-pool lock. */
export function withGCDicePool(work, { allowAwardReview = false } = {}) {
  return guarded(async controller => {
    const pool = withController(gcDiceStatus(), controller);
    requireValidBalance(pool, { allowAwardReview });
    if (!pool.current) throw new Error("Initialize the GC pool for this session before awarding dice.");
    delete pool.current;
    return work(pool, controller);
  });
}
const withController = (pool, controller) => (controller ? { ...pool, controllerId: controller.id } : pool);
export function initializeGCDice({ playersPresent, caliber, replaceExisting = false } = {}) {
  return guarded(async controller => {
    requireSettledGC();
    const periodReview = game.settings.get("spycraft2", "usagePeriodReview");
    if (periodReview?.needsReview || game.spycraft2?.pendingUsagePeriodReview?.needsReview)
      throw new Error("Review the interrupted start before changing the GC pool.");
    const before = gcDiceStatus();
    if (before.current && !replaceExisting)
      throw new Error(
        "This session’s pool is already initialized. Explicitly replace it to correct the starting pool."
      );
    const value = startingGCDice(playersPresent, caliber),
      pool = withController(
        { value, session: epoch(), playersPresent, caliber, lastReason: "Session start" },
        controller
      );
    await game.settings.set("spycraft2", "gcActionDice", pool);
    return pool;
  });
}
export function adjustGCDice(amount, reason) {
  return guarded(async controller => {
    const before = gcDiceStatus();
    requireValidBalance(before);
    if (!before.current) throw new Error("Initialize the GC pool for this session first.");
    if (!Number.isSafeInteger(amount) || !amount || !String(reason ?? "").trim())
      throw new Error("Enter a whole-number adjustment and its rules reason.");
    if (before.value + amount < 0) throw new Error("Not enough GC action dice remain.");
    if (!Number.isSafeInteger(before.value + amount)) throw new Error("The GC balance exceeds a safe whole number.");
    const pool = withController(
      { ...before, value: before.value + amount, lastReason: String(reason).trim() },
      controller
    );
    delete pool.current;
    await game.settings.set("spycraft2", "gcActionDice", pool);
    return pool;
  });
}
const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);
const rawPool = () => game.settings.get("spycraft2", "gcActionDice") ?? {};
async function writePool(pool) {
  try {
    await game.settings.set("spycraft2", "gcActionDice", pool);
  } catch (error) {
    if (!same(rawPool(), pool)) throw error;
  }
}
async function holdPayment(review, reason) {
  const held = { ...review, needsReview: true, reason: String(reason) };
  if (game.spycraft2) game.spycraft2.pendingGCDiceReview = held;
  try {
    await writePool({ ...rawPool(), settlementReview: held });
  } catch (error) {
    globalThis.ui?.notifications?.warn("GC payment recovery could not be saved. Resolve it before reloading.");
  }
}
export function spendGCDice(count, perform, { purpose = "Critical activation", messageUuid = null } = {}) {
  return guarded(async controller => {
    const before = gcDiceStatus();
    requireValidBalance(before);
    if (!before.current) throw new Error("Initialize the GC pool for this session first.");
    if (!Number.isSafeInteger(count) || count < 1 || count > before.value)
      throw new Error("Choose an available positive whole number of GC action dice.");
    const original = structuredClone(rawPool());
    const id = globalThis.foundry?.utils?.randomID?.() ?? "gc-" + Date.now() + "-" + Math.random();
    const review = {
      id,
      needsReview: true,
      session: before.session,
      before: before.value,
      count,
      purpose: String(purpose),
      messageUuid,
      at: Date.now()
    };
    const reserved = withController(
      { ...before, value: before.value - count, lastReason: purpose, settlementReview: review },
      controller
    );
    delete reserved.current;
    try {
      await writePool(reserved);
    } catch (error) {
      if (!same(rawPool(), original)) await holdPayment(review, error.message);
      throw error;
    }
    let result;
    try {
      result = await perform();
    } catch (error) {
      const current = gcDiceStatus();
      if (
        error.actionDiceSettlementReview ||
        !current.current ||
        current.session !== before.session ||
        current.counterReview ||
        !Number.isSafeInteger(current.value + count) ||
        current.settlementReview?.id !== id
      ) {
        await holdPayment(review, error.message);
        throw error;
      }
      const refund = {
        ...current,
        value: current.value + count,
        lastReason: "Refund failed transaction",
        settlementReview: { ...review, needsReview: false, outcome: "refunded" }
      };
      delete refund.current;
      try {
        await writePool(refund);
      } catch (refundError) {
        await holdPayment(review, "Refund could not be confirmed: " + refundError.message);
        throw new AggregateError([error, refundError], "GC payment needs review.");
      }
      throw error;
    }
    const current = gcDiceStatus();
    if (
      !current.current ||
      current.session !== before.session ||
      current.counterReview ||
      current.settlementReview?.id !== id
    ) {
      await holdPayment(review, "Effect completed but payment evidence changed.");
      throw new Error("The effect completed; review its GC payment before further activity.");
    }
    const settled = { ...current, settlementReview: { ...review, needsReview: false, outcome: "spent" } };
    delete settled.current;
    try {
      await writePool(settled);
    } catch (error) {
      await holdPayment(review, "Effect completed but final payment record could not be confirmed.");
      throw error;
    }
    return result;
  });
}
/** p.398: a helpful ordinary hint grants the GC one die and changes no character resources. */
export async function recordGCHint(options = {}) {
  requireGC();
  let input = options;
  if (!Object.keys(input).length) {
    input = await foundry.applications.api.DialogV2.input({
      window: { title: "Offer a helpful GC hint" },
      rejectClose: false,
      content:
        '<p>A helpful ordinary hint grants the GC one action die (p.398). Use the character’s free-hint response for origin or Intuition benefits instead.</p><label>Hint <textarea name="text"></textarea></label><label><input type="checkbox" name="helpfulConfirmed" /> The GC confirms this hint is helpful</label>'
    });
    if (!input) return null;
  }
  const text = String(input.text ?? "").trim();
  if (!text || input.helpfulConfirmed !== true) throw new Error("Enter a helpful hint and confirm it.");
  return withGCDicePool(async pool => {
    if (!Number.isSafeInteger(pool.value + 1)) throw new Error("The GC balance exceeds a safe whole number.");
    const original = structuredClone(rawPool()),
      id = foundry.utils.randomID?.() ?? "hint-" + Date.now() + "-" + Math.random();
    const receipt = {
        id,
        needsReview: true,
        session: pool.session,
        before: pool.value,
        units: 1,
        direction: "gain",
        purpose: "GC hint",
        text,
        at: Date.now()
      },
      credited = { ...pool, value: pool.value + 1, lastReason: "Helpful hint", settlementReview: receipt };
    try {
      await writePool(credited);
    } catch (error) {
      if (!same(rawPool(), original)) await holdPayment(receipt, error.message);
      throw error;
    }
    let message;
    try {
      requireGC();
      message = await ChatMessage.create({
        content: "<p>" + foundry.utils.escapeHTML(text) + "</p>",
        flags: { spycraft2: { checkKind: "gcHint", receiptId: id, session: pool.session, actionDiceAllowed: false } }
      });
    } catch (error) {
      message = [...(game.messages ?? [])].find(
        m => m.flags?.spycraft2?.checkKind === "gcHint" && m.flags.spycraft2.receiptId === id
      );
      if (!message) {
        const current = gcDiceStatus();
        if (
          !current.current ||
          current.session !== pool.session ||
          current.counterReview ||
          current.value < 1 ||
          current.settlementReview?.id !== id
        ) {
          await holdPayment(receipt, error.message);
          throw error;
        }
        const restored = {
          ...current,
          value: current.value - 1,
          lastReason: "Cancelled hint",
          settlementReview: { ...receipt, needsReview: false, outcome: "cancelled" }
        };
        delete restored.current;
        try {
          await writePool(restored);
        } catch (rollback) {
          await holdPayment(receipt, "Hint credit restoration could not be confirmed.");
          throw new AggregateError([error, rollback], "The GC hint needs review.");
        }
        throw error;
      }
    }
    const current = gcDiceStatus();
    if (
      !current.current ||
      current.session !== pool.session ||
      current.counterReview ||
      current.settlementReview?.id !== id
    ) {
      await holdPayment(
        { ...receipt, messageUuid: message.uuid ?? message.id },
        "Hint was posted but its credit evidence changed."
      );
      throw new Error("The hint was posted; review its GC credit.");
    }
    const settled = {
      ...current,
      settlementReview: { ...receipt, needsReview: false, outcome: "credited", messageUuid: message.uuid ?? message.id }
    };
    delete settled.current;
    try {
      await writePool(settled);
    } catch (error) {
      await holdPayment(
        { ...receipt, messageUuid: message.uuid ?? message.id },
        "Hint was posted but its final credit record could not be confirmed."
      );
      throw error;
    }
    return message;
  });
}
export function reviewGCDiceSettlement(options = {}) {
  return guarded(async () => {
    const review = structuredClone(pendingSettlement());
    if (!review?.needsReview) throw new Error("There is no interrupted GC payment to review.");
    const before = structuredClone(rawPool()),
      session = epoch(),
      message = () =>
        game.messages?.get?.(
          String(review.messageUuid ?? "")
            .split(".")
            .at(-1)
        )?.flags?.spycraft2 ?? null,
      messageBefore = structuredClone(message());
    let input = options;
    if (!Object.keys(input).length) {
      const esc = foundry.utils.escapeHTML;
      input = await foundry.applications.api.DialogV2.input({
        window: { title: "Review interrupted GC payment" },
        rejectClose: false,
        content: `<p>${esc(String(review.purpose ?? "GC payment"))}: ${esc(String(review.reason ?? "Payment was interrupted."))}</p><p>Review the actual effect and current session pool. This sets the confirmed balance without adding a refund.</p><label>Confirmed current GC dice <input type="number" min="0" name="value" value="${Number.isSafeInteger(before.value) ? before.value : 0}" /></label><label>Resolution <input name="resolution" /></label><label><input type="checkbox" name="confirmed" /> The GC reviewed the effect, session and actual pool</label>`
      });
      if (!input) return null;
    }
    requireGC();
    if (
      !same(rawPool(), before) ||
      !same(pendingSettlement(), review) ||
      !same(message(), messageBefore) ||
      epoch() !== session
    )
      throw new Error("GC payment evidence changed; reopen the review.");
    const value =
      typeof input.value === "number"
        ? input.value
        : typeof input.value === "string" && input.value.trim()
          ? Number(input.value)
          : NaN;
    if (input.confirmed !== true || !Number.isSafeInteger(value) || value < 0 || !String(input.resolution ?? "").trim())
      throw new Error("Confirm the reviewed whole-die balance and resolution.");
    const pool = {
      ...before,
      value,
      session,
      settlementReview: {
        ...review,
        needsReview: false,
        outcome: "reviewed",
        resolution: String(input.resolution).trim(),
        reviewedBy: game.user.id,
        reviewedAt: Date.now()
      }
    };
    await writePool(pool);
    if (game.spycraft2) delete game.spycraft2.pendingGCDiceReview;
    return pool;
  });
}
export async function recoverGCBookkeeping({ confirmed = false } = {}) {
  requireGC();
  if (!confirmed) throw new Error("Confirm that all GC resource actions have stopped before recovery.");
  const previous = gcDiceController({ required: false }),
    controller = oldestActor();
  if (!controller) throw new Error("Create a character before recovering GC bookkeeping.");
  if (previous?.items.has(GC_RESOURCE_LOCK_ID))
    await recoverResourceTransaction(previous, { confirmed: true, scope: GC_RESOURCE_LOCK_ID });
  return queueResourceScope(controller, GC_RESOURCE_LOCK_ID, async () => {
    await refreshGCDiceTransaction(controller, { allowRebind: true });
    const pool = { ...(game.settings.get("spycraft2", "gcActionDice") ?? {}) };
    delete pool.current;
    pool.controllerId = controller.id;
    await game.settings.set("spycraft2", "gcActionDice", pool);
    return pool;
  });
}
export async function manageGCDice() {
  requireGC();
  const status = gcDiceStatus();
  const input = await foundry.applications.api.DialogV2.input({
    window: { title: "Game Control action dice" },
    rejectClose: false,
    content: `
 <p>${pendingSettlement()?.needsReview ? "An interrupted GC payment needs review before further pool changes. " : ""}Current session: ${status.counterReview ? "saved balance needs review" : status.current ? status.value + " dice" : "pool not initialized"}. Starting dice = player characters present + twice mission Caliber (p.397).</p>
 <label>Action <select name="action"><option value="initialize">Initialize this session</option><option value="adjust">Adjust current pool</option><option value="hint">Offer a helpful hint</option><option value="review">Review interrupted GC payment</option><option value="recover">Recover interrupted GC bookkeeping</option></select></label>
 <label>Player characters present <input type="number" name="playersPresent" min="0" value="${status.playersPresent ?? 1}" /></label>
 <label>Mission Caliber <input type="number" name="caliber" min="1" max="5" value="${status.caliber ?? 1}" /></label>
 <label><input type="checkbox" name="replaceExisting" /> Replace an already initialized pool</label>
 <label>Adjustment (positive gain or negative spend) <input type="number" name="amount" value="1" /></label>
 <label>Adjustment reason <input name="reason" /></label>
 <label><input type="checkbox" name="confirmed" /> Recovery only: all GC resource actions have stopped</label>
 <p>Examples: helpful hint +1; a player action-die award +1; each mission Caliber increase +2. Record other Subplot, event or NPC costs from their rules. Starting a new session expires the old pool.</p>`
  });
  if (!input) return null;
  if (input.action === "hint") return recordGCHint();
  if (input.action === "review") return reviewGCDiceSettlement();
  if (input.action === "recover") return recoverGCBookkeeping({ confirmed: !!input.confirmed });
  return input.action === "initialize"
    ? initializeGCDice({
        playersPresent: Number(input.playersPresent),
        caliber: Number(input.caliber),
        replaceExisting: !!input.replaceExisting
      })
    : adjustGCDice(Number(input.amount), input.reason);
}
