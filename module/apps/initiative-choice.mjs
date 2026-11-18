/** Preserve Foundry's Roll API while letting Lightning Reflexes choose either complete Initiative roll (p.174). */
export function preferredInitiativeRoll(first, { validate = () => {}, actorUuid = "", combatantUuid = "" } = {}) {
  let selected = first,
    pending = null,
    audit = null,
    proxy;
  const evaluate = options =>
    (pending ??= (async () => {
      validate();
      const second = first.clone();
      await first.evaluate(options);
      validate();
      await second.evaluate(options);
      validate();
      const rolls = [first, second];
      if (rolls.some(r => !Number.isFinite(r.total))) throw new Error("Review the Initiative roll results.");
      const input = await foundry.applications.api.DialogV2.input({
        window: { title: "Lightning Reflexes — Initiative" },
        rejectClose: false,
        content: `<div class="spycraft2-roll-options"><p>Choose your preferred Initiative result. Closing keeps the first roll.</p><label>Result <select name="chosen">${rolls.map((r, i) => `<option value="${i}">Roll ${i + 1}: ${r.total}</option>`).join("")}</select></label></div>`
      });
      const index =
        input === null || input === undefined ? 0 : [0, 1].find(i => input.chosen === i || input.chosen === String(i));
      if (index === undefined) throw new Error("Choose one of the two original Initiative results.");
      validate();
      selected = rolls[index];
      audit = {
        source: "Lightning Reflexes",
        actorUuid,
        combatantUuid,
        chosenIndex: index,
        alternatives: rolls.map(r => r.toJSON())
      };
      return proxy;
    })());
  proxy = new Proxy(first, {
    get(_target, key) {
      if (key === "evaluate") return evaluate;
      if (key === "evaluateSync")
        return () => {
          throw new Error("Lightning Reflexes Initiative requires asynchronous rolling and a preferred-result choice.");
        };
      if (key === "toMessage")
        return async (data = {}, options = {}) => {
          await evaluate();
          validate();
          return selected.toMessage(
            {
              ...data,
              flavor: `${data.flavor ?? ""}<br><small>Lightning Reflexes: kept roll ${audit.chosenIndex + 1} of 2.</small>`,
              flags: { ...data.flags, spycraft2: { ...data.flags?.spycraft2, initiativeChoice: audit } }
            },
            options
          );
        };
      const value = Reflect.get(selected, key, selected);
      return typeof value === "function" ? value.bind(selected) : value;
    }
  });
  return proxy;
}
