/**
 * People who know people (pp.458–459): each contact knows one consultant or specialist per grade of the relationship.
 * A consultant or specialist keeps the grade the contact had when it was introduced, and its skill or class ability
 * never changes. After a successful Contact check (p.144) the character may summon each one once per mission:
 *
 * - a consultant makes one check with its skill, ignoring result caps, at Threat Level +8, +12, +16 or +20 by grade;
 * - a specialist uses its class ability once, at a Career Level equal to the Threat Level.
 *
 * Either leaves at the end of the scene if not used. Other numbers follow NPC Grade II, IV, VI or VIII.
 */
import { loc } from "../i18n.mjs";

export const CONTACT_PEOPLE = Object.freeze({
  page: 458,
  consultantBonus: [8, 12, 16, 20],
  npcGrade: [2, 4, 6, 8],
  baseClassLevels: [6, 8, 10, 12],
  expertClassLevels: [2, 4, 6, 8]
});
const ROMAN = ["I", "II", "III", "IV", "V", "VI", "VII", "VIII", "IX", "X"];
const grade = value => Math.max(1, Math.min(4, Math.trunc(Number(value) || 1)));

/** The consultant's bonus with its skill: the team's Threat Level plus 8, 12, 16 or 20. */
export const consultantBonus = (personGrade, threatLevel) =>
  (Number.isSafeInteger(threatLevel) ? threatLevel : 0) + CONTACT_PEOPLE.consultantBonus[grade(personGrade) - 1];

/** The NPC grade for any number the book does not give: II, IV, VI or VIII. */
export const personNpcGrade = personGrade => CONTACT_PEOPLE.npcGrade[grade(personGrade) - 1];

/** The class levels a specialist's ability may come from. */
export const specialistLevels = personGrade => ({
  base: CONTACT_PEOPLE.baseClassLevels[grade(personGrade) - 1],
  expert: CONTACT_PEOPLE.expertClassLevels[grade(personGrade) - 1]
});

/** A new consultant or specialist: its grade is the contact's grade now, fixed from then on. */
export const newContactPerson = (contact, kind = "consultant") => ({
  kind: kind === "specialist" ? "specialist" : "consultant",
  grade: grade(contact?.rank),
  skill: "",
  ability: "",
  summoned: ""
});

/** Problems with a contact's people: too many for the relationship, a grade above it, or no skill or ability. */
export function reviewContactPeople(contact) {
  const people = contact?.people ?? [],
    rank = grade(contact?.rank),
    problems = [];
  if (people.length > rank)
    problems.push(
      loc`${contact?.name || loc`This contact`} knows ${rank} consultant(s) or specialist(s) at this grade, not ${people.length}.`
    );
  people.forEach((person, i) => {
    const label = loc`${person.kind === "specialist" ? loc`Specialist` : loc`Consultant`} ${i + 1}`;
    if (grade(person.grade) > rank) problems.push(loc`${label}: its grade cannot be above the contact's.`);
    if (person.kind === "specialist" ? !String(person.ability ?? "").trim() : !String(person.skill ?? "").trim())
      problems.push(
        person.kind === "specialist"
          ? loc`${label}: choose the class ability it has.`
          : loc`${label}: choose the skill it is adept with.`
      );
  });
  return { problems, room: Math.max(0, rank - people.length) };
}

/**
 * Summon one consultant or specialist. `mission` is the current mission period; each may come once per mission.
 * Returns what the card shows and the person as stored afterwards.
 */
export function summonPlan(contact, index, { mission, threatLevel, checkSucceeded = false } = {}) {
  const person = contact?.people?.[index];
  if (!person) throw new Error(loc`That consultant or specialist is no longer listed. Open the contact again.`);
  if (!checkSucceeded)
    throw new Error(
      loc`Summoning needs a successful Contact check with ${contact.name || loc`this contact`} first (p.144).`
    );
  if (person.summoned && person.summoned === String(mission))
    throw new Error(loc`Each consultant and specialist comes once per mission; this one has already been called.`);
  if (!Number.isSafeInteger(threatLevel) || threatLevel < 1)
    throw new Error(loc`Start the mission first: the summoned person works at the team's Threat Level.`);
  const g = grade(person.grade);
  const base = {
    kind: person.kind,
    grade: g,
    npcGrade: personNpcGrade(g),
    npcGradeLabel: ROMAN[personNpcGrade(g) - 1],
    after: { ...person, summoned: String(mission) }
  };
  if (person.kind === "specialist")
    return { ...base, ability: person.ability, careerLevel: threatLevel, levels: specialistLevels(g) };
  return {
    ...base,
    skill: person.skill,
    bonus: consultantBonus(g, threatLevel),
    formula: `1d20 + ${consultantBonus(g, threatLevel)}`
  };
}

const sameContact = (a, b) =>
  String(a ?? "")
    .trim()
    .toLowerCase() ===
    String(b ?? "")
      .trim()
      .toLowerCase() && String(a ?? "").trim() !== "";

/**
 * Shared contacts (p.459): when two characters have the same contact, the people one introduces are fixed for both.
 * `others` lists [{ owner, contact }] from the other characters' sheets. Their people for a contact of the same name
 * are pooled; a person only this sheet has is its own introduction and is kept, unless the pooled list and this
 * sheet's extras together exceed what the best relationship allows, in which case the earlier introductions stand.
 * A character reaches only the people at or below the grade of their own relationship.
 * @returns {null|{owner: string, people: object[], reachable: object[], extras: object[], problems: string[]}}
 */
export function sharedContactPeople(contact, others = []) {
  const sources = others.filter(
    other => sameContact(other.contact?.name, contact?.name) && other.contact?.people?.length
  );
  if (!sources.length) return null;
  const key = person => `${person.kind}|${grade(person.grade)}|${person.skill ?? ""}|${person.ability ?? ""}`,
    pooled = new Map();
  for (const source of sources)
    for (const person of source.contact.people) if (!pooled.has(key(person))) pooled.set(key(person), person);
  const rank = grade(contact?.rank),
    people = [...pooled.values()],
    reachable = people.filter(person => grade(person.grade) <= rank).map(person => ({ ...person, summoned: "" })),
    extras = (contact?.people ?? []).filter(person => !pooled.has(key(person))),
    most = Math.max(rank, ...sources.map(source => grade(source.contact.rank))),
    problems = [];
  if (extras.length && people.length + extras.length > most)
    problems.push(
      loc`${contact.name} is shared with ${sources[0].owner}, who introduced its consultants and specialists first. Use theirs (p.459).`
    );
  return { owner: sources.map(source => source.owner).join(", "), people, reachable, extras, problems };
}
