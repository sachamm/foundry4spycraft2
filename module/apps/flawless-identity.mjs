/** Flawless Identity on the Main tab: recording identities and slipping in and out of them (p.209). */
import { esc } from "../html.mjs";
import { refuse } from "../error-notices.mjs";
import { enterIdentityPlan, identityLimit, IDENTITY_POWER_RATING } from "../rules/flawless-identity.mjs";
import { loc } from "../i18n.mjs";

/** Add or edit an identity. */
export async function editIdentity(actor, id = "") {
  if (!actor.isOwner) return null;
  const list = [...(actor.system.identities ?? [])],
    current = list.find(r => r.id === id);
  if (!current && list.length >= identityLimit(actor.system))
    return refuse(loc`Your starting action dice limit how many identities you keep.`);
  const input = await foundry.applications.api.DialogV2.input({
    window: { title: current ? loc`Edit identity` : loc`New identity` },
    rejectClose: false,
    content: `<div class="spycraft2-roll-options"><p>${loc`Identities are set when the feat is gained and replaced only during an Intel Phase. Each is documented like a cover identity of Power Rating ${IDENTITY_POWER_RATING} (p.209).`}</p><label>${loc`Name`} <input name="name" maxlength="200" value="${esc(current?.name)}" /></label><label>${loc`Profession focus`} <input name="professionFocus" maxlength="200" value="${esc(current?.professionFocus)}" /></label><label>${loc`Interest`} <input name="interest1" maxlength="200" value="${esc(current?.interests?.[0])}" /></label><label>${loc`Interest`} <input name="interest2" maxlength="200" value="${esc(current?.interests?.[1])}" /></label></div>`
  });
  if (!input) return null;
  const row = {
    id: current?.id ?? foundry.utils.randomID(),
    name: String(input.name ?? "").trim(),
    professionFocus: String(input.professionFocus ?? "").trim(),
    interests: [input.interest1, input.interest2].map(v => String(v ?? "").trim())
  };
  const next = current ? list.map(r => (r.id === row.id ? row : r)) : [...list, row];
  return actor.update({ "system.identities": next });
}

export async function removeIdentity(actor, id) {
  if (!actor.isOwner) return null;
  return actor.update({
    "system.identities": (actor.system.identities ?? []).filter(r => r.id !== id),
    ...(actor.system.activeIdentity === id ? { "system.activeIdentity": "" } : {})
  });
}

/** Getting into character: 1 minute and 1 action die. */
export async function enterIdentity(actor, id) {
  if (!actor.isOwner) return null;
  const plan = enterIdentityPlan(actor.system, id);
  return actor.spendActionDice(plan.cost, async () => {
    await actor.update({ "system.activeIdentity": id });
    return ChatMessage.create({
      speaker: ChatMessage.getSpeaker({ actor }),
      content: esc(
        loc`${actor.name} spends a minute and an action die getting into character as ${plan.identity.name} (Flawless Identity, p.209).`
      )
    });
  });
}

/** Returning to the character's own identity is a free action. */
export async function leaveIdentity(actor) {
  if (!actor.isOwner || !actor.system.activeIdentity) return null;
  await actor.update({ "system.activeIdentity": "" });
  return ChatMessage.create({
    speaker: ChatMessage.getSpeaker({ actor }),
    content: esc(loc`${actor.name} drops the act and is themself again.`)
  });
}
