/**
 * Comparing values by their JSON text. Many workflows keep a snapshot of a record, do some work and then ask
 * whether the record is still what it was; these are the two comparisons they use.
 */

/**
 * JSON text with every object's keys in sorted order, so two records with the same content give the same text
 * whatever order their keys were written in. Arrays keep their order.
 * @param {*} value
 * @returns {string}
 */
export const stable = value =>
  JSON.stringify(value, (_key, part) =>
    part && typeof part === "object" && !Array.isArray(part)
      ? Object.fromEntries(
          Object.keys(part)
            .sort()
            .map(key => [key, part[key]])
        )
      : part
  );

/**
 * Whether two values have the same JSON text as written: the same content with keys in the same order. Use it for
 * records built or stored the same way on both sides; use stable() where the key order may differ.
 */
export const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);
