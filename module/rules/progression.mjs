/** Career level at which the earliest current source grants a feat.
 * Returns 0 if the feat is not granted by the supplied build.
 */
export function grantAcquisitionLevel(items, progression, name) {
  const key = String(name).trim().toLowerCase();
  if (items.some(i => i.type === "origin" && (i.system.grants ?? [])
    .some(g => String(g).trim().toLowerCase() === key))) return 1;
  let earliest = Infinity;
  for (const cls of items.filter(i => i.type === "class")) {
    const ident = cls.system.identifier || cls.name;
    for (const grant of cls.system.featGrants ?? []) {
      if (String(grant.feat).trim().toLowerCase() !== key) continue;
      let count = 0;
      for (const [idx, entry] of progression.entries()) {
        if (entry.classId !== ident) continue;
        count++;
        if (count >= grant.level) { earliest = Math.min(earliest, idx + 1); break; }
      }
    }
  }
  return Number.isFinite(earliest) ? earliest : 0;
}
