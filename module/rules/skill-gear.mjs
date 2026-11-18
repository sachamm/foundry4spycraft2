import { toolShedKitState } from "./tool-shed.mjs";
const normalize = value =>
  String(value ?? "")
    .trim()
    .toLowerCase()
    .replaceAll("’", "'")
    .replace(/\s+/g, " ");
/** Gear/Gear Only p.101; kit grades p.213. Availability may be confirmed for gear supplied outside inventory. */
export function skillGearPlan(
  check,
  {
    gearStatus = "unknown",
    gearItem = null,
    kitAtLocation = false,
    system = gearItem?.actor?.system ?? gearItem?.parent?.system ?? {}
  } = {}
) {
  const tags = [...String(check.tags ?? "").matchAll(/Gear( Only)? \(([^)]*)\)/g)].map(m => ({
    only: !!m[1],
    requirement: m[2]
  }));
  if (!tags.length) return { required: false, bonuses: [], capIncrease: 0, blockedReason: "", notes: [] };
  const allowed = ["available", "missing", "unknown"],
    reasons = [];
  if (!allowed.includes(gearStatus)) reasons.push("Choose whether all required gear is available.");
  const tool = toolShedKitState(system, gearItem);
  if (tool.applicable && tool.blockedReason) reasons.push(tool.blockedReason);
  const s = gearItem?.system ?? {},
    uses = [{ type: s.kitType, grade: s.kitGrade }];
  // First Aid III explicitly includes field tools treated as Surgery I (p.214).
  if (normalize(s.kitType) === "first aid kit" && s.kitGrade === 3) uses.push({ type: "Surgery Kit", grade: 1 });
  const matching = uses.find(
    use =>
      use.type &&
      tags.some(t => {
        const alternatives = t.requirement.split(/\s+or\s+/i),
          kitSuffix = /kit$/i.test(t.requirement);
        return alternatives.some(
          value => normalize(/kit$/i.test(value) || !kitSuffix ? value : value + " Kit") === normalize(use.type)
        );
      })
  );
  const kit = matching ? gearItem : null,
    grade = matching?.grade;
  const inferred = gearStatus === "unknown" && kit && tags.length === 1 ? "available" : gearStatus;
  if (inferred === "unknown")
    reasons.push("Confirm whether all gear required by this named check is available before rolling.");
  if (inferred === "missing" && tags.some(t => t.only))
    reasons.push("Gear Only: this check automatically fails without all required gear (p.101); no roll is made.");
  if (kit && (!Number.isSafeInteger(grade) || grade < 1 || grade > 3))
    reasons.push("Review the selected kit’s grade before using it.");
  if (kit && s.kitNonPortable && (!String(s.kitLocation ?? "").trim() || kitAtLocation !== true))
    reasons.push("Use the non-portable kit at its recorded location and confirm that location.");
  const useKit = !!kit && inferred === "available" && !reasons.length,
    bonuses =
      inferred === "missing" && !tags.some(t => t.only)
        ? [{ type: "gear", value: -4, source: "Missing required gear" }]
        : [];
  if (useKit && grade >= 2) bonuses.push({ type: "gear", value: 1, source: kit.name });
  const capIncrease = useKit && grade === 3 ? 5 : 0,
    requirements = tags.map(t => t.requirement),
    notes = [
      `Required gear: ${requirements.join("; ")}; ${inferred}.${inferred === "missing" && !tags.some(t => t.only) ? " Missing gear: −4 gear penalty." : ""}${useKit ? ` ${kit.name}: Grade ${grade}${grade >= 2 ? ", +1 gear bonus" : ""}${capIncrease ? ", cap +5" : ""}${s.kitNonPortable ? " at " + s.kitLocation : ""}.` : ""}`
    ];
  return {
    toolShedKit: useKit && tool.valid ? tool.evidence : null,
    required: true,
    requirements,
    only: tags.some(t => t.only),
    status: inferred,
    kitUuid: useKit ? (kit.uuid ?? kit.id ?? "") : null,
    kitType: useKit ? matching.type : "",
    kitGrade: useKit ? grade : 0,
    kitLocation: useKit && s.kitNonPortable ? s.kitLocation : "",
    bonuses,
    capIncrease,
    blockedReason: reasons.join(" "),
    notes
  };
}
