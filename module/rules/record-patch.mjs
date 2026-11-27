/** Replace an owned record exactly even when the document backend recursively merges update objects. */
export function recordReplacementPatch(path, value, current) {
  if (value === undefined) {
    const keys = path.split("."),
      last = keys.pop();
    return { [keys.join(".") + ".-=" + last]: null };
  }
  const patch = { [path]: structuredClone(value) };
  const removeOmitted = (at, next, previous) => {
    if (
      !next ||
      !previous ||
      typeof next !== "object" ||
      typeof previous !== "object" ||
      Array.isArray(next) ||
      Array.isArray(previous)
    )
      return;
    for (const key of Object.keys(previous)) {
      if (!Object.hasOwn(next, key)) patch[at + ".-=" + key] = null;
      else removeOmitted(at + "." + key, next[key], previous[key]);
    }
  };
  removeOmitted(path, value, current);
  return patch;
}
