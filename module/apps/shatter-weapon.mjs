/** Shatter Weapon (Spirit Moves, p.187): once per round in Total Defense, Smash the weapon an adjacent opponent used. */
import { rollPipeline } from "../rules/roll-pipeline.mjs";
import { loc } from "../i18n.mjs";

export const shatterWeaponEligible = (system, check) =>
  system?.activeFeatNames?.includes("Spirit Moves") === true &&
  system.totalDefenseState?.active === true &&
  check?.checkKind === "attack" &&
  check.resolved === true &&
  !check.superseded &&
  !check.shatterWeapon &&
  check.ranged !== true &&
  check.attackContext?.ranged !== true;

rollPipeline.register({
  id: "shatterWeaponControl",
  kinds: ["attack"],
  order: 9771,
  chatControls({ message, check, user }) {
    const target = check.attackContext?.targetActorUuid ? fromUuidSync(check.attackContext.targetActorUuid) : null;
    if (!target || !(user?.isGM || target.isOwner) || !shatterWeaponEligible(target.system, check)) return null;
    return [
      {
        label: loc`Shatter Weapon (${target.name}): Smash the attacker’s weapon`,
        run: () =>
          target.useLimitedAbility(
            "shatterWeapon",
            async () => {
              await message.update({ "flags.spycraft2.shatterWeapon": target.uuid });
              return target.rollSkill("athletics", null, { check: "smash" });
            },
            { workflow: "shatterWeapon" }
          )
      }
    ];
  }
});
