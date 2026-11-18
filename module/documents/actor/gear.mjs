/** Gear in play: mission picks, reserves, acquisitions and class gear abilities. */
import { systemDialog } from "../../apps/dialog-theme.mjs";
import { useSafeHouse, placeSafeHouse, correctSafeHouseRecord } from "../../apps/safe-house.mjs";
import { useCareerAgentReward, reviewCareerAgentReward } from "../../apps/career-agent.mjs";
import { useWellFunded } from "../../apps/well-funded.mjs";
import { useToolShed } from "../../apps/tool-shed.mjs";
import {
  improvisedSearchPlan,
  improvisedMasterySpec,
  IMPROVISED_WEAPON_ROWS
} from "../../rules/improvised-weapons.mjs";
import { surchargeFundingInput, unrolledPaymentFundingInput } from "../../apps/action-die-benefits.mjs";
import { shakenRules } from "../../rules/shaken.mjs";
import { reviewReserveTransaction } from "../../apps/reserve-review.mjs";
import { improvisationPlan } from "../../rules/class-gear.mjs";
import { missionCaliberOptions, missionCaliberPlan } from "../../rules/mission-gear.mjs";
import { masterThiefPlan } from "../../rules/class-checks.mjs";
import { queueResources, isResourceLock } from "../../rules/transactions.mjs";
import { allocateMissionReserves, rollGearAcquisition, claimGearAcquisition } from "../../apps/gear-acquisition.mjs";
import { armorGrantPlan, bigStickPlan } from "../../rules/gear.mjs";
import { loc } from "../../i18n.mjs";

export const ActorGear = Base =>
  class ActorGear extends Base {
    async useMasterThief(options = {}) {
      if (this.type !== "agent" || !this.isOwner) throw new Error(loc`You must own the agent using Master Thief.`);
      let input = options;
      if (!Object.keys(input).length) {
        const esc = foundry.utils.escapeHTML,
          skills = CONFIG.SPYCRAFT.classFeatures.intruder.classSkills.filter(
            key => (this.system.skillTotals?.[key]?.ranks ?? 0) >= 4
          );
        input = await systemDialog.input({
          window: { title: loc`Master Thief: replace an opposed skill roll` },
          rejectClose: false,
          content: `<div class="spycraft2-roll-options"><p>${loc`Once per session, set one opposed Intruder class-skill result to the opponent’s final result +1. Requires at least four ranks in that skill. No die is rolled, so no action-die boost applies. This result cannot be an error or threat.`}</p><label>${loc`Skill`} <select name="skillKey">${skills.map(key => `<option value="${key}">${esc(CONFIG.SPYCRAFT.skills[key].name)}</option>`).join("")}</select></label><label>${loc`Focus / check, if applicable`} <input name="focus" /></label><label>${loc`Opponent’s final result`} <input type="number" name="opponentResult" step="1" required /></label><label><input type="checkbox" name="opposedConfirmed" /> ${loc`This is an opposed skill check`}</label><label><input type="checkbox" name="opponentFinalConfirmed" /> ${loc`The GC confirms this opponent’s final result`}</label><label><input type="checkbox" name="declaredBeforeRolling" /> ${loc`I declare Master Thief instead of rolling this check`}</label><label><input type="checkbox" name="secret" /> ${loc`Secret result (resolved by the GC)`}</label></div>`
        });
        if (!input) return null;
      }
      masterThiefPlan(this.system, CONFIG.SPYCRAFT, input);
      if (input.secret && !game.user?.isGM) throw new Error(loc`The GC resolves a secret Master Thief result.`);
      return this.useLimitedAbility(
        "masterThief",
        async () => {
          const plan = masterThiefPlan(this.system, CONFIG.SPYCRAFT, input),
            esc = foundry.utils.escapeHTML;
          return this.rollCheck(
            "@total",
            { total: plan.total },
            {
              ...plan,
              checkKind: "skill",
              resultSource: "masterThief",
              rollMode: input.secret ? "blindroll" : undefined,
              flavor: loc`Master Thief: ${esc(CONFIG.SPYCRAFT.skills[plan.skillKey].name)}${plan.focus ? ` / ${esc(plan.focus)}` : ""}`
            }
          );
        },
        { workflow: "masterThief" }
      );
    }

    useSafeHouse(options = {}) {
      return useSafeHouse(this, options);
    }

    correctSafeHouseRecord(id, options = {}) {
      return correctSafeHouseRecord(this, id, options);
    }

    placeSafeHouse(id, options = {}) {
      return placeSafeHouse(this, id, options);
    }

    useCareerAgentReward(options = {}) {
      return useCareerAgentReward(this, options);
    }

    reviewCareerAgentReward(options = {}) {
      return reviewCareerAgentReward(this, options);
    }

    useWellFunded(options = {}) {
      return useWellFunded(this, options);
    }

    useToolShed(options = {}) {
      return useToolShed(this, options);
    }

    async improviseCommonItem(options = {}) {
      if (this.type !== "agent" || !this.isOwner) throw new Error(loc`You must own the agent improvising an item.`);
      let input = options;
      if (!Object.keys(input).length) {
        input = await systemDialog.input({
          window: { title: loc`Improvisation: make one Common Item` },
          rejectClose: false,
          content: `<div class="spycraft2-roll-options"><p>${loc`Use one Improvisation mission use to make a Common Item from materials at hand. No Gear check, Reserve Item or action die is spent. The full action is resolved at the table.`}</p><label>${loc`Common Item`} <input name="name" required /></label><label>${loc`Weight in pounds`} <input type="number" name="weight" value="0" min="0" step="any" /></label><label>${loc`Description`} <textarea name="description"></textarea></label><label><input type="checkbox" name="commonConfirmed" /> ${loc`The GC confirms this object qualifies as a Common Item`}</label><label><input type="checkbox" name="fullActionConfirmed" /> ${loc`I spend the required full action`}</label></div>`
        });
        if (!input) return null;
      }
      // Validate before charging, then repeat against fresh actor state inside the native queue.
      const id = foundry.utils.randomID();
      improvisationPlan(this.system, { ...input, id });
      return this.useLimitedAbility(
        "improvisation",
        async () => {
          const plan = improvisationPlan(
              { ...this.system, usagePeriods: this.usagePeriods },
              { ...input, id, at: Date.now() }
            ),
            esc = foundry.utils.escapeHTML;
          let item,
            recorded = false;
          try {
            [item] = await this.createEmbeddedDocuments("Item", [
              {
                name: plan.name,
                type: "gear",
                system: {
                  common: true,
                  quantity: 1,
                  weight: plan.weight,
                  caliber: 0,
                  pick: "",
                  classGearGrant: plan.stamp,
                  description: `<p>${esc(plan.description)}</p>`
                }
              }
            ]);
            await this.update({ [`system.classGearGrants.${id}`]: { ...plan.record, itemId: item.id } });
            recorded = true;
            await ChatMessage.create({
              speaker: ChatMessage.getSpeaker({ actor: this }),
              content: loc`Improvisation: ${esc(plan.name)} created with one full action and one mission use. No Gear check, reserve or action die spent.`,
              flags: {
                spycraft2: {
                  actorUuid: this.uuid,
                  checkKind: "improvisation",
                  actionDiceAllowed: false,
                  grantId: id,
                  itemUuid: item.uuid
                }
              }
            });
            return item;
          } catch (error) {
            if (item) {
              try {
                await this.deleteEmbeddedDocuments("Item", [item.id]);
              } catch (cleanupError) {
                ui.notifications.warn(
                  loc`The improvised item may still exist after a technical failure. Its mission use remains spent; ask the GC to review the item and grant before retrying.`
                );
                return item;
              }
            }
            if (recorded) await this.update({ [`system.classGearGrants.-=${id}`]: null });
            throw error;
          }
        },
        { workflow: "improvisation" }
      );
    }

    async selectMissionCaliberGear(options = {}) {
      if (this.type !== "agent" || !this.isOwner) throw new Error(loc`You must own the agent to select mission gear.`);
      let input = options;
      if (!input.itemId) {
        const sources = missionCaliberOptions(this.system, [...this.items]).options,
          esc = foundry.utils.escapeHTML;
        if (!sources.length) throw new Error(loc`No reviewed mission-Caliber ability is available.`);
        input = await systemDialog.input({
          window: { title: loc`Higher-Caliber mission pick` },
          rejectClose: false,
          content: `<div class="spycraft2-roll-options"><p>${loc`Record mission Caliber in reserve setup first. Import the item and assign its ordinary paid mission pick. This ability permits one higher-Caliber pick; it does not grant an extra pick. Caliber V grants upgrades instead, with purchasing/effects adjudicated separately.`}</p><label>${loc`Ability`} <select name="source">${sources.map(s => `<option value="${s.key}" ${input.source === s.key ? "selected" : ""}>${esc(s.name)}</option>`).join("")}</select></label><label>${loc`Item`} <select name="itemId">${this.items
            .filter(i => ["weapon", "armor", "gear"].includes(i.type) && !isResourceLock(i))
            .map(i => `<option value="${i.id}">${loc`${esc(i.name)} (Caliber ${i.system.caliber})`}</option>`)
            .join(
              ""
            )}</select></label><label><input type="checkbox" name="intelConfirmed" /> ${loc`Chosen as mission gear during Intel`}</label></div>`
        });
        if (!input) return null;
      }
      return queueResources([this], async () => {
        const plan = missionCaliberPlan(this.system, [...this.items], input),
          item = this.items.get(input.itemId),
          oldStamp = structuredClone(item.system.missionCaliberGrant ?? null);
        await item.update({ "system.missionCaliberGrant": plan.stamp });
        try {
          await this.update({ [`system.missionCaliberPicks.${plan.key}`]: plan.record });
        } catch (error) {
          await item.update({ "system.missionCaliberGrant": oldStamp });
          throw error;
        }
        return plan.record;
      });
    }

    async selectBigStickGear(options = {}) {
      if (this.type !== "agent" || !this.isOwner)
        throw new Error(loc`You must own the agent to select Big Stick gear.`);
      let input = options;
      if (!input.itemId) {
        const esc = foundry.utils.escapeHTML;
        input = await systemDialog.input({
          window: { title: loc`Big Stick: mission weapon` },
          rejectClose: false,
          content: `<div class="spycraft2-roll-options"><p>${loc`Record mission Caliber in the reserve setup first. Import the weapon and assign its normal paid Weapon pick. Big Stick permits one covered pick at one higher Caliber; it does not grant another pick. At Caliber V it grants extra upgrades instead; upgrade purchasing still requires separate adjudication.`}</p><label>${loc`Weapon`} <select name="itemId">${this.items
            .filter(i => i.type === "weapon")
            .map(
              item => `<option value="${item.id}">${loc`${esc(item.name)} (Caliber ${item.system.caliber})`}</option>`
            )
            .join(
              ""
            )}</select></label><label><input type="checkbox" name="intelConfirmed" /> ${loc`This was chosen as mission gear during Intel`}</label></div>`
        });
        if (!input) return null;
      }
      return queueResources([this], async () => {
        const plan = bigStickPlan(this.system, [...this.items], input),
          item = this.items.get(input.itemId),
          oldStamp = structuredClone(item.system.bigStickMissionPick ?? null);
        await item.update({ "system.bigStickMissionPick": plan.stamp });
        try {
          await this.update({ "system.bigStickMissionPick": plan.record });
        } catch (error) {
          await item.update({ "system.bigStickMissionPick": oldStamp });
          throw error;
        }
        return plan.record;
      });
    }

    async selectArmorUseGear(options = {}) {
      if (this.type !== "agent" || !this.isOwner)
        throw new Error(loc`You must own the agent to select Armor Use gear.`);
      let input = options;
      if (!input.itemId) {
        const esc = foundry.utils.escapeHTML;
        const armor = this.items.filter(item => item.type === "armor");
        input = await systemDialog.input({
          window: { title: loc`Armor Use: mission armor` },
          rejectClose: false,
          content: `<div class="spycraft2-roll-options"><p>${loc`Import the desired armor first, leaving its acquisition fields unassigned. Armor Use grants one piece within your earned grade, once per mission, without spending a mission pick. Existing selections cannot be replaced by deleting their item.`}</p><label>${loc`Armor`} <select name="itemId">${armor.map(item => `<option value="${item.id}">${loc`${esc(item.name)} (Caliber ${item.system.caliber})`}</option>`).join("")}</select></label><label><input type="checkbox" name="intelConfirmed" /> ${loc`This selection was made during the Intel Phase`}</label></div>`
        });
        if (!input) return null;
      }
      return queueResources([this], async () => {
        const plan = armorGrantPlan(this.system, [...this.items], input),
          item = this.items.get(input.itemId);
        const oldStamp = structuredClone(item.system.armorMissionGrant ?? null);
        await item.update({ "system.armorMissionGrant": plan.stamp });
        try {
          await this.update({ "system.armorMissionGrant": plan.record });
        } catch (error) {
          await item.update({ "system.armorMissionGrant": oldStamp });
          throw error;
        }
        return plan.record;
      });
    }

    reviewReserveTransaction(options = {}) {
      return reviewReserveTransaction(this, options);
    }

    allocateMissionReserves(options = {}) {
      return allocateMissionReserves(this, options);
    }

    rollGearAcquisition(options = {}) {
      return rollGearAcquisition(this, options);
    }

    claimGearAcquisition(options = {}) {
      return claimGearAcquisition(this, options);
    }

    async findImprovisedWeapon(options = {}) {
      if (this.type !== "agent" || !this.isOwner) return null;
      const expectedShaken = JSON.stringify(shakenRules(this.actionDiceFundingSystem));
      let input = options;
      if (!Object.keys(input).length) {
        input = await systemDialog.input({
          window: { title: loc`Find an improvised weapon` },
          rejectClose: false,
          content: `<div class="spycraft2-roll-options"><p>${loc`Spend one action die on a Gear check to turn up an improvised weapon no more than 4 squares away (pp.346–347). Improvised Weapon Basics adds +3. The GC describes the object and its exact location. Choose weapon statistics from your final result's Table 5.12 row or a lower row.`}</p><label><input name="nonBarrenConfirmed" type="checkbox" /> ${loc`This location is not barren`}</label>${this.system.activeFeatNames?.includes("Personal Stash") ? `<label><input name="atHome" type="checkbox" /> ${loc`I am inside my home (Personal Stash)`}</label>` : ""}${this.system.activeFeatNames?.includes("Improvised Weapon Mastery") ? `<p>${loc`Mastery: the object is adjacent and you choose the type of improvised weapon found. One search payment may be waived per combat; Shaken surcharges still apply.`}</p><label><input name="useMastery" type="checkbox" /> ${loc`Use Mastery's once-per-combat payment waiver (${this.participatingCombat ? (this.limitedUseStatus.find(s => s.id === improvisedMasterySpec(this.system, this.participatingCombat?.id)?.id)?.remaining ?? 0) : 0} remaining)`}</label>` : ""}${this.actionDiceFundingControl()}${this.actionDiceSurchargeControl({ unrolled: true })}</div>`
        });
        if (!input) return null;
      }
      const plan = () => improvisedSearchPlan(this.system, { ...input, combatId: this.participatingCombat?.id ?? "" }),
        first = plan();
      const perform = async payment => {
        const fresh = plan();
        if (JSON.stringify(fresh) !== JSON.stringify(first))
          throw new Error(loc`The improvised search source changed before payment completed.`);
        const waiverReceipt = fresh.useMastery ? structuredClone(this.system.resourceUses?.[fresh.waiverId]) : null;
        if (fresh.useMastery && (waiverReceipt?.epoch !== fresh.combatId || waiverReceipt?.used !== 1))
          throw new Error(loc`The Mastery combat allowance changed before this search.`);
        const snapshot = { ...fresh, waiverReceipt };
        return this.rollCheck(
          "1d20 + @total",
          { total: fresh.bonus },
          {
            flavor: `${loc`Find an improvised weapon: Gear bonus ${fresh.baseGearBonus}${fresh.homeGearBonus ? loc` +${fresh.homeGearBonus} Personal Stash (inside home)` : ""}${fresh.basics ? loc` +3 Improvised Weapon Basics` : ""}. ${fresh.mastery ? loc`Adjacent object (Mastery); player and GC confirm the object and location` : loc`Within 4 squares; GC determines the exact object and location`}.${fresh.useMastery ? loc` Mastery waives the base action-die payment.` : ""}`}<br>${loc`Table 5.12 — ${IMPROVISED_WEAPON_ROWS.map((row, i) => `${row.minimum}${i === 4 ? "+" : "–" + (IMPROVISED_WEAPON_ROWS[i + 1].minimum - 1)}: ${row.weapons.join(" or ")}`).join("; ")}. Choose a listed weapon from the final result's row or a lower row.`}`,
            checkKind: "gear",
            checkId: "find-improvised-weapon",
            threat: 0,
            error: 0,
            cap: null,
            improvisedSearch: snapshot,
            preRollFunding: this.preRollPaymentReceipt(payment),
            validateSkillContext: () => {
              if (
                JSON.stringify(plan()) !== JSON.stringify(fresh) ||
                (fresh.useMastery &&
                  JSON.stringify(this.system.resourceUses?.[fresh.waiverId]) !== JSON.stringify(waiverReceipt))
              )
                throw new Error(
                  loc`The improvised search source or combat allowance changed before the check was posted.`
                );
            }
          }
        );
      };
      const paymentOptions = {
        benefitCount: 1,
        bonusPoolId: input.bonusPoolId ?? "",
        ...surchargeFundingInput(input),
        ...unrolledPaymentFundingInput(input),
        purpose: loc`Find an improvised weapon`,
        benefit: "improvisedSearch",
        expectedShaken
      };
      if (first.useMastery)
        return this.useLimitedAbility(
          first.waiverId,
          async () => {
            let started = false;
            const result = await this.payActionDiceBenefitLocked(
              0,
              payment => {
                started = true;
                return perform(payment);
              },
              paymentOptions
            );
            return started ? result : null;
          },
          { workflow: "improvisedSearch" }
        );
      return this.spendActionDiceBenefit(1, perform, paymentOptions);
    }
  };
