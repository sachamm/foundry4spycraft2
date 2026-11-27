/** Contacts' consultants and specialists (pp.458–459): introduce them on the sheet and summon them in play. */
import { esc } from "../html.mjs";
import { refuse } from "../error-notices.mjs";
import { formDialog, raw } from "./dialog-kit.mjs";
import { SKILLS } from "../rules/tables.mjs";
import {
  consultantBonus,
  newContactPerson,
  personNpcGrade,
  reviewContactPeople,
  sharedContactPeople,
  specialistLevels,
  summonPlan
} from "../rules/contact-people.mjs";
import { missionEpoch } from "../rules/gear-acquisition.mjs";
import { missionThreatLevel } from "./gc/state.mjs";
import { loc } from "../i18n.mjs";
import { queueRuleState } from "./rule-resource-scope.mjs";
import { withUndo } from "./undo.mjs";

const GRADES = ["Acquaintance", "Associate", "Confederate", "Partner"];
const ROMAN = ["I", "II", "III", "IV", "V", "VI", "VII", "VIII"];
const contactsOf = actor => (actor.system.contacts ?? []).map(row => ({ ...row, people: [...(row.people ?? [])] }));
/** The same contact on other agents' sheets, for shared contacts (p.459). */
const otherContacts = actor =>
  [...(globalThis.game?.actors ?? [])]
    .filter(other => other.type === "agent" && other.id !== actor.id)
    .flatMap(other => (other.system.contacts ?? []).map(contact => ({ owner: other.name, contact })));
const personLabel = person =>
  person.kind === "specialist"
    ? loc`${GRADES[person.grade - 1]} specialist: ${person.ability || loc`ability not chosen`}`
    : loc`${GRADES[person.grade - 1]} consultant: ${person.skill || loc`skill not chosen`}`;

/** Introduce a consultant or specialist, or remove one entered by mistake. */
export async function editContactPeople(actor, index) {
  if (!actor?.isOwner) return refuse(loc`Only the character's owner or the GC can change their contacts.`);
  const contacts = contactsOf(actor),
    contact = contacts[index];
  if (!contact) return refuse(loc`That contact is no longer listed. Close the dialog and try again.`);
  const shared = sharedContactPeople(contact, otherContacts(actor));
  // Offer the introducer's people while this sheet lacks some within reach or differs from them; once they match,
  // either character may introduce the next one as the relationship grows.
  const key = person => `${person.kind}|${person.grade}|${person.skill}|${person.ability}`,
    mine = new Set(contact.people.map(key));
  if (shared && (shared.problems.length || shared.reachable.some(person => !mine.has(key(person)))))
    return shareContactPeople(actor, contacts, index, shared);
  const { room } = reviewContactPeople(contact);
  const existing = contact.people
    .map(
      (person, i) =>
        `<label><input type="checkbox" name="remove-${i}" /> ${esc(loc`Remove ${personLabel(person)}`)}</label>`
    )
    .join("");
  const levels = specialistLevels(contact.rank);
  const skills = SKILLS.map(skill => `<option value="${esc(skill.name)}">${esc(skill.name)}</option>`).join("");
  const add = room
    ? `<fieldset><legend>${esc(loc`Introduce one at ${GRADES[contact.rank - 1]} grade (fixed from now on)`)}</legend>
      <label>${loc`Kind`} <select name="kind"><option value="">${loc`None now`}</option><option value="consultant">${loc`Consultant (one skill)`}</option><option value="specialist">${loc`Specialist (one class ability)`}</option></select></label>
      <label data-when="kind=consultant">${loc`Skill it is adept with`} <select name="skill">${skills}</select></label>
      <label data-when="kind=specialist">${loc`Class ability`} <input name="ability" maxlength="120" placeholder="${loc`e.g. Behind the Scenes I`}" /></label>
      <p data-when="kind=specialist">${esc(loc`From base class levels 1–${levels.base} or expert class levels 1–${levels.expert}.`)}</p></fieldset>`
    : `<p>${esc(loc`${contact.name || loc`This contact`} already knows one person per grade. Improve the relationship to add another.`)}</p>`;
  const input = await formDialog({
    title: loc`${contact.name || loc`Contact`}: consultants and specialists`,
    intro: loc`A contact knows one consultant or specialist per grade (p.458). Each keeps its grade, skill or ability for good.`,
    fields: [raw(`${existing}${add}`)],
    ok: loc`Save the contact`
  });
  if (!input) return null;
  const removed = new Set(contact.people.filter((_, i) => input[`remove-${i}`] === true).map(personKey));
  let added = null;
  if (room && input.kind) {
    added = { ...newContactPerson(contact, input.kind), skill: input.kind === "consultant" ? input.skill : "" };
    added.ability = input.kind === "specialist" ? String(input.ability ?? "").trim() : "";
    if (added.kind === "specialist" && !added.ability)
      return refuse(loc`Name the specialist's class ability, then save again.`);
  }
  try {
    return await saveContactPeople(actor, index, contact.name, current => [
      ...current.people.filter(person => !removed.has(personKey(person))),
      ...(added && !current.people.some(person => personKey(person) === personKey(added)) ? [added] : [])
    ]);
  } catch (error) {
    return refuse(error.message);
  }
}

/** A shared contact's people come from whoever introduced them first; this copies the ones within reach. */
async function shareContactPeople(actor, contacts, index, shared) {
  const contact = contacts[index];
  const list = shared.people
    .map(
      person =>
        `<li>${esc(personLabel(person))}${shared.reachable.some(r => r.grade === person.grade && r.kind === person.kind && r.skill === person.skill && r.ability === person.ability) ? "" : esc(loc` (above this relationship's grade)`)}</li>`
    )
    .join("");
  const ok = await formDialog({
    title: loc`${contact.name || loc`Contact`}: consultants and specialists`,
    intro: loc`${shared.owner} introduced this contact's people first, so they are fixed (p.459). This character can call the ones at or below their own grade with the contact.`,
    fields: [raw(`<ul>${list}</ul>`)],
    ok: loc`Use the shared people`
  });
  if (!ok) return null;
  // People only this sheet introduced are kept, unless they clash with the earlier introductions.
  try {
    return await saveContactPeople(actor, index, contact.name, () => [
      ...shared.reachable,
      ...(shared.problems.length ? [] : shared.extras)
    ]);
  } catch (error) {
    return refuse(error.message);
  }
}

/** Summon a consultant or specialist after a successful Contact check: once per mission, at the Threat Level. */
export async function summonContactPerson(actor, index, personIndex) {
  if (!actor?.isOwner) return refuse(loc`Only the character's owner or the GC can call their contacts.`);
  const contacts = contactsOf(actor),
    contact = contacts[index],
    person = contact?.people?.[personIndex];
  if (!person) return refuse(loc`That consultant or specialist is no longer listed. Open the sheet again.`);
  const input = await formDialog({
    title: loc`Summon: ${personLabel(person)}`,
    intro: loc`Make the Contact check with ${contact.name || loc`this contact`} first (p.144). The person arrives after its response time and leaves at the end of the scene if not used.`,
    fields: [
      { check: "checkSucceeded", label: loc`My Contact check with ${contact.name || loc`this contact`} succeeded` }
    ],
    ok: loc`Summon`
  });
  if (!input) return null;
  // Planned again from the sheet as it is now, one summon at a time, so a second dialog left open cannot call the
  // same person twice in a mission. The write leaves an Undo note that gives the use back.
  let plan;
  try {
    plan = await queueRuleState(actor, async () => {
      const now = contactsOf(actor),
        current = now[index];
      if (!current?.people?.[personIndex] || personLabel(current.people[personIndex]) !== personLabel(person))
        throw new Error(loc`That consultant or specialist is no longer listed. Open the sheet again.`);
      const planned = summonPlan(current, personIndex, {
        mission: missionEpoch(actor.system),
        threatLevel: missionThreatLevel(),
        checkSucceeded: input.checkSucceeded === true
      });
      current.people[personIndex] = planned.after;
      now[index] = current;
      await withUndo([actor], loc`Summon: ${personLabel(person)}`, () => actor.update({ "system.contacts": now }));
      return planned;
    });
  } catch (error) {
    return refuse(error.message);
  }
  const who = esc(contact.name || loc`A contact`),
    npc = loc`Other numbers as an NPC of Grade ${ROMAN[personNpcGrade(plan.grade) - 1]}.`;
  if (plan.kind === "specialist")
    return ChatMessage.create({
      speaker: ChatMessage.getSpeaker({ actor }),
      content: `<p><b>${esc(loc`${contact.name || loc`A contact`}'s specialist`)}</b></p><p>${esc(loc`Uses ${plan.ability} once, as directed, at Career Level ${plan.careerLevel}, then leaves. ${npc}`)}</p>`
    });
  const roll = await new Roll(plan.formula).evaluate();
  return roll.toMessage({
    speaker: ChatMessage.getSpeaker({ actor }),
    flavor: `<b>${who}</b>: ${esc(loc`consultant's ${plan.skill} check (Threat Level +${consultantBonus(plan.grade, 0)}; no result cap). ${npc}`)}`
  });
}

/** The people each contact knows, with a Summon button when one is ready, for the sheet. */
export function contactPeopleRows(system) {
  const mission = missionEpoch(system);
  return (system.contacts ?? []).map((contact, index) => ({
    index,
    people: (contact.people ?? []).map((person, i) => ({
      index: i,
      label: personLabel(person),
      used: person.summoned === mission
    }))
  }));
}
