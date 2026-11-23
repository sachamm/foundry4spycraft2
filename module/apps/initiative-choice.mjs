import { loc } from "../i18n.mjs";
import { formDialog, raw } from "./dialog-kit.mjs";
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
      if (rolls.some(r => !Number.isFinite(r.total))) throw new Error(loc`Review the Initiative roll results.`);
      // The higher result starts selected, and closing the dialog keeps it: a higher Count is almost always wanted.
      const best = rolls[1].total > rolls[0].total ? 1 : 0;
      const input = await formDialog({
        title: loc`Lightning Reflexes — Initiative`,
        intro: loc`Choose your preferred Initiative result. Closing keeps the higher roll.`,
        fields: [
          {
            select: "chosen",
            label: loc`Result`,
            optionsHtml: raw(
              rolls
                .map(
                  (r, i) =>
                    `<option value="${i}"${i === best ? " selected" : ""}>${loc`Roll ${i + 1}: ${r.total}`}</option>`
                )
                .join("")
            )
          }
        ]
      });
      const index =
        input === null || input === undefined
          ? best
          : [0, 1].find(i => input.chosen === i || input.chosen === String(i));
      if (index === undefined) throw new Error(loc`Choose one of the two original Initiative results.`);
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
          throw new Error(
            loc`Lightning Reflexes Initiative requires asynchronous rolling and a preferred-result choice.`
          );
        };
      if (key === "toMessage")
        return async (data = {}, options = {}) => {
          await evaluate();
          validate();
          return selected.toMessage(
            {
              ...data,
              flavor: `${data.flavor ?? ""}<br><small>${loc`Lightning Reflexes: kept roll ${audit.chosenIndex + 1} of 2.`}</small>`,
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
