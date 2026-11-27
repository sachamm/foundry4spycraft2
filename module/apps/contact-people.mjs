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
  specialistLevels,
  summonPlan
} from "../rules/contact-people.mjs";
import { missionEpoch } from "../rules/gear-acquisition.mjs";
import { missionThreatLevel } from "./gc/state.mjs";
import { loc } from "../i18n.mjs";

const GRADES = ["Acquaintance", "Associate", "Confederate", "Partner"];
const ROMAN = ["I", "II", "III", "IV", "V", "VI", "VII", "VIII"];
const contactsOf = actor => (actor.system.contacts ?? []).map(row => ({ ...row, people: [...(row.people ?? [])] }));
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
  contact.people = contact.people.filter((_, i) => input[`remove-${i}`] !== true);
  if (room && input.kind) {
    const person = { ...newContactPerson(contact, input.kind), skill: input.kind === "consultant" ? input.skill : "" };
    person.ability = input.kind === "specialist" ? String(input.ability ?? "").trim() : "";
    if (person.kind === "specialist" && !person.ability)
      return refuse(loc`Name the specialist's class ability, then save again.`);
    contact.people.push(person);
  }
  contacts[index] = contact;
  return actor.update({ "system.contacts": contacts });
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
  let plan;
  try {
    plan = summonPlan(contact, personIndex, {
      mission: missionEpoch(actor.system),
      threatLevel: missionThreatLevel(),
      checkSucceeded: input.checkSucceeded === true
    });
  } catch (error) {
    return refuse(error.message);
  }
  contact.people[personIndex] = plan.after;
  contacts[index] = contact;
  await actor.update({ "system.contacts": contacts });
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
