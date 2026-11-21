/** The Kick action's card controls: its Initiative Count cost and its damage roll (see module/rules/kick.mjs). */
import { shiftCount } from "./dueling.mjs";
import { rollPipeline } from "../rules/roll-pipeline.mjs";
import { setConditionStatus } from "../rules/condition-status.mjs";
import { boxingTrickDamageNote } from "../rules/boxing.mjs";
import { UNARMED_TRICKS, unarmedTrickDamageNote } from "../rules/unarmed-tricks.mjs";
import { loc } from "../i18n.mjs";

rollPipeline.register({
  id: "kickControls",
  kinds: ["attack"],
  order: 9761,
  chatControls({ message, check, actor }) {
    const kick = check.attackContext?.kick,
      trick = check.attackContext?.kickTrick,
      jab = check.attackContext?.doubleJab,
      boxing = check.attackContext?.boxingTrick,
      unarmed = check.attackContext?.unarmedTrick;
    if ((!kick && !trick && !jab && !boxing && !unarmed) || check.superseded) return null;
    const controls = [];
    // Unarmed tricks with a save on a hit, or Clothesline's takedown: roll the damage from the hit.
    const unarmedWeaponItem = unarmed && check.weaponUuid ? fromUuidSync(check.weaponUuid) : null;
    if (
      unarmed &&
      check.successConfirmed === true &&
      unarmedWeaponItem &&
      !check.unarmedTrickDamage &&
      (UNARMED_TRICKS[unarmed.key]?.hitSave ||
        UNARMED_TRICKS[unarmed.key]?.damage ||
        UNARMED_TRICKS[unarmed.key]?.doubleMargin ||
        UNARMED_TRICKS[unarmed.key]?.damageMultiplier ||
        unarmed.key === "clothesline")
    )
      controls.push({
        label: loc`Roll ${unarmed.name} damage`,
        run: async () => {
          const rolled = await actor.rollDamage(unarmedWeaponItem, {
            unarmedTrick: unarmed.key,
            kick: !!kick,
            includeSneakAttack: false
          });
          if (!rolled) return rolled;
          await message.update({ "flags.spycraft2.unarmedTrickDamage": rolled.uuid ?? true });
          const total = rolled.rolls?.[0]?.total ?? rolled.flags?.spycraft2?.effectiveTotal,
            note = unarmedTrickDamageNote(unarmed.key, total);
          return note
            ? ChatMessage.create({
                speaker: ChatMessage.getSpeaker({ actor }),
                content: foundry.utils.escapeHTML(note)
              })
            : rolled;
        }
      });
    // Back Flip: a miss leaves the character flat-footed.
    if (trick?.key === "backFlip" && check.successConfirmed === false && !check.backFlipMiss)
      controls.push({
        label: loc`Back Flip miss: become flat-footed`,
        run: async () => {
          await message.update({ "flags.spycraft2.backFlipMiss": true });
          return setConditionStatus(actor, "flat-footed", true, { label: loc`Flat-footed`, aliases: ["flatFooted"] });
        }
      });
    // Driving Punch: a miss leaves the character flat-footed.
    if (UNARMED_TRICKS[unarmed?.key]?.missFlatFooted && check.successConfirmed === false && !check.unarmedTrickMiss)
      controls.push({
        label: loc`${unarmed.name}: flat-footed`,
        hint: loc`${unarmed.name} miss: become flat-footed`,
        run: async () => {
          await message.update({ "flags.spycraft2.unarmedTrickMiss": true });
          return setConditionStatus(actor, "flat-footed", true, { label: loc`Flat-footed`, aliases: ["flatFooted"] });
        }
      });
    // Double Jab: each hit's damage loses 2 per die.
    const jabWeapon = jab && check.weaponUuid ? fromUuidSync(check.weaponUuid) : null;
    if (jab && check.successConfirmed === true && jabWeapon)
      controls.push({
        label: loc`Roll Double Jab damage`,
        run: () => actor.rollDamage(jabWeapon, { doubleJab: true })
      });
    // Knock Out and Wallop: the damage roll states the threshold for this hit.
    const boxingWeapon = boxing && check.weaponUuid ? fromUuidSync(check.weaponUuid) : null;
    if (boxing && check.successConfirmed === true && boxingWeapon && !check.boxingDamage)
      controls.push({
        label: loc`Roll ${boxing.name} damage`,
        run: async () => {
          const rolled = await actor.rollDamage(boxingWeapon, { doubleJab: !!jab, includeSneakAttack: false });
          if (!rolled) return rolled;
          await message.update({ "flags.spycraft2.boxingDamage": rolled.uuid ?? true });
          const target = check.attackContext?.targetActorUuid
              ? fromUuidSync(check.attackContext.targetActorUuid)
              : null,
            total = rolled.rolls?.[0]?.total ?? rolled.flags?.spycraft2?.effectiveTotal;
          return ChatMessage.create({
            speaker: ChatMessage.getSpeaker({ actor }),
            content: foundry.utils.escapeHTML(boxingTrickDamageNote(boxing.key, total, target))
          });
        }
      });
    if (!kick) return controls.length ? controls : null;
    if (kick.countCost && !check.kickCount)
      controls.push({
        label: loc`Kick: Initiative Count −2`,
        run: () => shiftCount(message, actor, -kick.countCost, "kickCount", "Kick")
      });
    const weapon = check.weaponUuid ? fromUuidSync(check.weaponUuid) : null,
      trickRollsDamage = controls.some(c => unarmed && c.label === loc`Roll ${unarmed.name} damage`);
    if (check.successConfirmed === true && weapon && !trickRollsDamage)
      controls.push({
        label: loc`Roll Kick damage`,
        run: () => actor.rollDamage(weapon, { kick: true, kickTrick: trick?.key ?? null, includeSneakAttack: false })
      });
    return controls.length ? controls : null;
  }
});
