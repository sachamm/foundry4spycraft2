/** Conditions and their recovery: restraint, Shaken, Baffled, sleep, drunkenness, fatigue and combat outcomes that apply them. */
import { refuse } from "../../error-notices.mjs";
import { systemDialog } from "../../apps/dialog-theme.mjs";
import { manageTakedown, rollTakedown, settleTakedown } from "../../apps/takedown.mjs";
import { manageMeleeTradeoff } from "../../apps/melee-tradeoff-outcomes.mjs";
import {
  manageCheapShots,
  settleCheapShot,
  rollCheapShotRecovery,
  settleCheapShotRecovery
} from "../../apps/cheap-shot-effects.mjs";
import { rollCriticalInjury, reviewCriticalInjury } from "../../apps/critical-injuries.mjs";
import { applyShaken, reviewShakenApplication } from "../../apps/shaken-application.mjs";
import {
  shakenInitiativeReviews,
  reviewShakenInitiative,
  changeInitiativeCountPreservingShaken
} from "../../apps/shaken-initiative.mjs";
import { getShakenApplicationReview, shakenSourceEntries } from "../../rules/shaken.mjs";
import {
  applyRestraintEscape,
  reviewRestraintRelease,
  confirmRestraintEscapeMove
} from "../../apps/restraint-release.mjs";
import { applyBaffled, reviewBaffledApplication } from "../../apps/baffled-application.mjs";
import {
  drunkRepositionPlan,
  freezeDrunkReposition,
  drunkRepositionCompletion,
  drunkTokenMovementPlan
} from "../../rules/condition-movement.mjs";
import {
  fatigueApplicationPlan,
  fatigueStateSignature,
  fatigueRestRecord,
  fatigueRestCompletionPlan
} from "../../rules/fatigue.mjs";
import { setConditionStatus } from "../../rules/condition-status.mjs";
import { initiativeLossPlan } from "../../rules/defense.mjs";
import {
  mentalLeapFatigueEvent,
  unconsciousSleepPlan,
  unconsciousSleepCompletionPlan
} from "../../rules/mental-leap.mjs";
import { sleepingSourceSnapshot, sleepWakePlan } from "../../rules/sleeping.mjs";
import { attributeCollapsePlan, wisdomCollapseEpisode } from "../../rules/attributes.mjs";
import { queueResources } from "../../services/transactions.mjs";
import { loc } from "../../i18n.mjs";

export const ActorConditions = Base =>
  class ActorConditions extends Base {
    applyRestraintEscape(message, options = {}) {
      return applyRestraintEscape(this, message, options);
    }

    confirmRestraintEscapeMove(message, options = {}) {
      return confirmRestraintEscapeMove(this, message, options);
    }

    async reviewRestraintRelease(options = {}) {
      const review = this.system.restraintReleaseReview;
      if (!review?.needsReview) return null;
      const message = await fromUuid(review.messageUuid);
      if (!message) throw new Error(loc`The original grapple message is unavailable.`);
      return reviewRestraintRelease(this, message, options);
    }

    rollCriticalInjury(options = {}) {
      return rollCriticalInjury(this, options);
    }

    reviewCriticalInjury(id, options = {}) {
      return reviewCriticalInjury(this, id, options);
    }

    applyShaken(options = {}) {
      return applyShaken(this, options);
    }

    reviewShakenApplication(options = {}) {
      return reviewShakenApplication(this, options);
    }

    get shakenSourceEntries() {
      return shakenSourceEntries(this);
    }

    get shakenApplicationReview() {
      return getShakenApplicationReview(this);
    }

    async editShakenSource(uuid) {
      const effect = await fromUuid(uuid);
      if (!effect || !effect.isOwner) throw new Error(loc`Choose an editable Shaken source effect.`);
      if (![...this.appliedEffects, ...this.effects].some(e => e.uuid === effect.uuid))
        throw new Error(loc`This effect no longer supplies this character.`);
      return effect.sheet.render({ force: true });
    }

    applyBaffled(options = {}) {
      return applyBaffled(this, options);
    }

    reviewBaffledApplication(options = {}) {
      return reviewBaffledApplication(this, options);
    }

    setSickened(options = {}) {
      return this.setReviewedCondition("sickened", options);
    }

    async setReviewedCondition(condition, options = {}) {
      const rules = {
        nauseated: {
          label: loc`Nauseated`,
          text: loc`No Concentration skill checks and at most one final attack per round across all sources. Only one half action per round; the GC tracks that action budget at the table (p.342).`
        },
        held: {
          label: loc`Held`,
          text: loc`Vulnerable; no movement or non-free actions except a full-action Athletics (STR) Escape check with Armor Check Penalty (p.342). Escape success is adjudicated with the holder; this control reviews the current state.`
        },
        pinned: {
          label: loc`Pinned`,
          text: loc`Held and vulnerable; no movement or actions except a full-action Athletics (STR) Escape check with Armor Check Penalty. Adjacent melee/unarmed attackers gain +4. The holder controls speech and receives half cover; the GC resolves those interactions (p.342).`
        },
        baffled: {
          label: loc`Baffled`,
          text: loc`Skill bonuses are halved, rounded up; saves resisting further Baffled gain +8. A second new application replaces Baffled with Incompetent (p.340). This control reviews the current state.`
        },
        incompetent: {
          label: loc`Incompetent`,
          text: loc`Skill bonuses become +0; ranks, caps and separate check modifiers remain (p.342). This control reviews the current state.`
        },
        prone: {
          label: loc`Prone`,
          text: loc`No Standard Move, Bull Rush, Run or Withdraw. May crawl with ordinary 5-ft. bonus steps and Brace as a free action. Melee attacks −2; non-adjacent ranged attackers −2 (p.342).`
        },
        sprawled: {
          label: loc`Sprawled`,
          text: loc`Vulnerable; attack checks −2. Movement actions are limited to Crouch, Drop Prone or Stand Up (p.342).`
        },
        mute: { label: loc`Mute`, text: loc`Cannot speak, shout, or make skill checks with the Language tag (p.342).` },
        crouched: {
          aliases: ["crouching"],
          label: loc`Crouched`,
          text: loc`Half base Speed, rounded down. Non-adjacent attackers suffer −1 with ranged attacks against you (p.340).`
        },
        sleeping: {
          id: "sleep",
          aliases: ["sleeping", "asleep"],
          label: loc`Sleeping`,
          text: loc`Only passive actions; blinded and helpless. Wakes upon a new touch, any damage, or a successful Notice/Awareness check (p.342). Confirm waking with the GC; other sources of blindness or unconsciousness remain separate.`
        },
        drunk: {
          label: loc`Drunk`,
          text: loc`−2 Dexterity-/Wisdom-based checks. At each round start while standing, reposition 5 ft. randomly without counting against allowed movement. Recovery requires four full hours asleep (p.341); the GC resolves random repositioning.`
        },
        blinded: {
          id: "blind",
          aliases: ["blinded"],
          label: loc`Blinded`,
          text: loc`Vulnerable; half Speed. Vision checks −8 and cap −20; targets gain +8 Defense and opponents gain +2 attacks against you. Cannot make checks requiring eyesight or eye-hand coordination (pp.340,351).`
        },
        deafened: {
          id: "deaf",
          aliases: ["deafened"],
          label: loc`Deafened`,
          text: loc`Hearing checks −8 and cap −10; Language checks targeting you have cap −20. Cannot make checks requiring hearing (pp.340,351).`
        },
        sickened: { label: loc`Sickened`, text: loc`−2 to attacks, skills, damage rolls and saves (p.342).` },
        entangled: {
          label: loc`Entangled`,
          text: loc`−2 attacks; −4 Dexterity skill checks; half Speed; no Run, Refresh, Regroup, Jump or Tumble (p.341).`
        },
        bound: {
          label: loc`Bound`,
          text: loc`Entangled and helpless; cannot move or take Grasp/Hands-On actions (p.340).`
        }
      };
      if (
        !this.isOwner ||
        !Object.hasOwn(rules, condition) ||
        (this.type !== "agent" && !(this.type === "npc" && ["baffled", "incompetent"].includes(condition)))
      )
        return null;
      const rule = rules[condition];
      let input = options;
      if (!Object.keys(input).length) {
        input = await systemDialog.input({
          window: { title: rule.label + " condition" },
          rejectClose: false,
          content: `<label>${loc`Condition`} <select name="active"><option value="true"${this.system.conditionContext?.[condition] ? "" : " selected"}>${loc`Apply ${rule.label}`}</option><option value="false"${this.system.conditionContext?.[condition] ? " selected" : ""}>${loc`Clear ${rule.label}`}</option></select></label><label><input name="confirmed" type="checkbox" /> ${loc`The GC confirms the condition applies or its cause has ended`}</label><p>${rule.text}</p>`
        });
        if (!input) return null;
        input = { ...input, active: input.active === "true" ? true : input.active === "false" ? false : null };
      }
      if (input.confirmed !== true || typeof input.active !== "boolean")
        return refuse(loc`Confirm whether ` + rule.label + " applies.");
      try {
        return await queueResources([this], () =>
          setConditionStatus(this, rule.id ?? condition, input.active, {
            label: rule.label,
            aliases: rule.aliases ?? []
          })
        );
      } catch (error) {
        ui.notifications.warn(error.message);
        throw error;
      }
    }

    async settleSleepWake(event, { cause, confirmed = false, check = null } = {}) {
      if (this.type !== "agent" || !this.isOwner) throw new Error(loc`Choose an owned character to resolve waking.`);
      const plan = sleepWakePlan(sleepingSourceSnapshot(this), event, { cause, confirmed, check });
      if (plan.blocked) throw new Error(plan.reason);
      if (!plan.changed) return { state: "awake", changed: false, cause };
      await setConditionStatus(this, "sleep", false, { label: loc`Sleeping`, aliases: ["sleeping", "asleep"] });
      return { state: "awake", changed: true, cause };
    }

    async wakeFromSleep(options = {}) {
      if (this.type !== "agent" || !this.isOwner) return null;
      const event = sleepingSourceSnapshot(this);
      if (event.state === "awake") return { state: "awake", changed: false };
      let input = options;
      if (!Object.keys(input).length) {
        input = await systemDialog.input({
          window: { title: loc`Wake from sleep` },
          rejectClose: false,
          content: `<label>${loc`New event`} <select name="cause"><option value="newTouch">${loc`New touch`}</option><option value="damage">${loc`Damage received`}</option></select></label><label><input name="confirmed" type="checkbox" /> ${loc`The GC confirms this new event occurred after this sleep began`}</label><p>${loc`Ongoing contact is not a new touch. Successful Notice/Awareness wakes through its recorded outcome. Source-specific effects remain subject to their own rules (p.342).`}</p>`
        });
        if (!input) return null;
      }
      if (!["newTouch", "damage"].includes(input.cause) || input.confirmed !== true)
        return refuse(loc`Confirm the new waking event with the GC.`);
      return queueResources([this], () => this.settleSleepWake(event, { cause: input.cause, confirmed: true }));
    }

    /** Resolve an incoming initiative loss, distinct from penalties inflicted by the character's own actions. */
    async sufferInitiativeLoss(options = {}) {
      if (this.type !== "agent" || !this.isOwner) return null;
      let input = options;
      if (!Object.keys(input).length) {
        const combat = game.combat,
          own = [...(combat?.combatants ?? [])].filter(c => c.actor?.uuid === this.uuid),
          esc = foundry.utils.escapeHTML;
        if (!combat?.started || !own.length) return refuse(loc`Choose this character in a started combat.`);
        input = await systemDialog.input({
          window: { title: loc`Apply Initiative Count loss` },
          rejectClose: false,
          content: `<div class="spycraft2-roll-options"><label>${loc`Combatant`} <select name="combatantId">${own.map(c => `<option value="${c.id}">${esc(c.name)}</option>`).join("")}</select></label><label>${loc`Listed loss`} <input name="loss" type="number" min="0" step="1" value="1" /></label><label><input name="selfInflicted" type="checkbox" /> ${loc`This penalty is inflicted by my own action (Uncanny Dodge does not halve it)`}</label><label><input name="confirmed" type="checkbox" /> ${loc`The GC confirms this loss and its source`}</label><p>${loc`Incoming losses are halved, rounded down, with Uncanny Dodge IV. No action die is spent.`}</p></div>`
        });
        if (!input) return null;
        input = {
          ...input,
          loss: typeof input.loss === "string" && input.loss.trim() === "" ? NaN : Number(input.loss),
          selfInflicted: input.selfInflicted === true
        };
      }
      if (input.confirmed !== true) return refuse(loc`Confirm the Initiative Count loss and its source.`);
      return queueResources([this], async () => {
        const combat = game.combat,
          own = [...(combat?.combatants ?? [])].filter(c => c.actor?.uuid === this.uuid),
          c = own.find(c => c.id === input.combatantId) ?? (own.length === 1 && !input.combatantId ? own[0] : null);
        if (!combat?.started || !c || !Number.isFinite(c.initiative))
          throw new Error(
            loc`Select this character’s combatant with a numeric Initiative Count in the current started combat.`
          );
        const plan = initiativeLossPlan(this.system, input),
          before = c.initiative,
          after = before - plan.loss,
          initiativeLossReceiptId = foundry.utils.randomID();
        if (!Number.isFinite(after)) throw new Error(loc`The resulting Initiative Count is invalid.`);
        if (plan.loss) await changeInitiativeCountPreservingShaken(c, after);
        try {
          await ChatMessage.create({
            speaker: ChatMessage.getSpeaker({ actor: this }),
            content: foundry.utils.escapeHTML(
              loc`${this.name}: Initiative Count ${before} → ${after}; listed loss ${plan.listedLoss}${plan.halved ? loc` halved by Uncanny Dodge IV (round down)` : ""}${plan.selfInflicted ? loc` from own action` : ""}.`
            ),
            flags: {
              spycraft2: {
                actorUuid: this.uuid,
                checkKind: "initiativeLoss",
                initiativeLossReceiptId,
                initiativeLoss: { ...plan, combatId: combat.id, combatantId: c.id, before, after },
                actionDiceAllowed: false
              }
            }
          });
        } catch (error) {
          const posted = [...(game.messages?.values?.() ?? game.messages ?? [])].find(
            m =>
              m.flags?.spycraft2?.actorUuid === this.uuid &&
              m.flags?.spycraft2?.initiativeLossReceiptId === initiativeLossReceiptId
          );
          if (posted) return { ...plan, before, after };
          if (plan.loss) {
            if (c.initiative !== after) {
              ui.notifications.warn(loc`Initiative changed again; review the unposted loss before applying another.`);
              throw error;
            }
            try {
              await changeInitiativeCountPreservingShaken(c, before);
            } catch (rollback) {
              ui.notifications.warn(
                loc`Initiative rollback failed; review the current Initiative Count before retrying.`
              );
              throw new AggregateError([error, rollback], loc`Initiative loss requires review.`);
            }
          }
          throw error;
        }
        return { ...plan, before, after };
      });
    }

    manageTakedown(input = {}) {
      return manageTakedown(this, input);
    }

    rollTakedown(input = {}) {
      return rollTakedown(this, input);
    }

    settleTakedown(message) {
      return settleTakedown(this, message);
    }

    manageMeleeTradeoff() {
      return manageMeleeTradeoff(this);
    }

    manageCheapShots() {
      return manageCheapShots(this);
    }

    settleCheapShot(message) {
      return settleCheapShot(this, message);
    }

    rollCheapShotRecovery(source) {
      return rollCheapShotRecovery(this, source);
    }

    settleCheapShotRecovery(message) {
      return settleCheapShotRecovery(this, message);
    }

    get shakenInitiativeReviews() {
      return shakenInitiativeReviews(this);
    }

    reviewShakenInitiative(combatId, combatantId, options = {}) {
      return reviewShakenInitiative(this, combatId, combatantId, options);
    }

    async rollDrunkReposition(options = {}) {
      if (this.type !== "agent" || !this.isOwner) return null;
      const combat = this.participatingCombat,
        expected = combat?.id + ":" + combat?.round;
      let input = options;
      if (!combat)
        return refuse(
          loc`Use this round-start tracker in a started participating combat. The GC resolves rounds outside combat.`
        );
      if (!Object.keys(input).length) {
        input = await systemDialog.input({
          window: { title: loc`Drunk round-start reposition` },
          rejectClose: false,
          content: `<div class="spycraft2-roll-options"><label>${loc`At the start of this round`} <select name="standing"><option value="true">${loc`Standing — roll the five-foot reposition`}</option><option value="false">${loc`Not standing — no reposition this round`}</option></select></label><label><input name="roundStartConfirmed" type="checkbox" /> ${loc`The GC confirms this round-start condition and posture`}</label><p>${loc`Direction 1 points to the top of the scene; 2–8 proceed clockwise. This involuntary movement does not count against allowed movement. The GC resolves the actual position, walls and hazards; recording a roll alone does not move a token.`}</p></div>`
        });
        if (!input) return null;
        input = { ...input, standing: input.standing === "true" ? true : input.standing === "false" ? false : null };
      }
      return queueResources([this], async () => {
        const current = this.participatingCombat;
        if (current?.id + ":" + current?.round !== (input.expectedRound ?? expected))
          throw new Error(loc`The combat round changed while confirming the reposition.`);
        const system = () => ({ ...this.system, ...this.attributeRuleContext }),
          plan = drunkRepositionPlan(system(), current, input);
        let record = plan.record;
        if (!plan.reused) {
          // Reserve this round before drawing. An interrupted draw requires review, never another random result.
          await this.update({ "system.drunkRepositions": [...(this.system.drunkRepositions ?? []), record] });
          if (record.standing) {
            const roll = await new Roll("1d8").evaluate();
            record = freezeDrunkReposition(record, { die: roll.total, rollJSON: JSON.stringify(roll.toJSON()) });
            await this.update({
              "system.drunkRepositions": this.system.drunkRepositions.map(r => (r.id === record.id ? record : r))
            });
          }
        }
        const existing = [...(game.messages ?? [])].find(
          m => m.flags?.spycraft2?.actorUuid === this.uuid && m.flags?.spycraft2?.drunkRepositionId === record.id
        );
        if (!existing) {
          const message = {
            speaker: ChatMessage.getSpeaker({ actor: this }),
            flags: {
              spycraft2: {
                actorUuid: this.uuid,
                checkKind: "drunkReposition",
                drunkRepositionId: record.id,
                actionDiceAllowed: false
              }
            },
            flavor: record.standing
              ? loc`Drunk: reposition 5 ft. ${record.direction} (d8 ${record.die}); no allowed movement is spent. The GC applies the position and resolves obstacles/hazards.`
              : loc`Drunk: not standing at round start; no reposition this round.`
          };
          if (record.standing) await Roll.fromJSON(record.rollJSON).toMessage(message);
          else await ChatMessage.create({ ...message, content: message.flavor });
        }
        return record;
      });
    }

    get drunkMovementTokens() {
      return this.isToken
        ? [this.token]
        : [...(game.scenes ?? [])].flatMap(scene =>
            [...scene.tokens].filter(token => token.actor?.uuid === this.uuid && token.isOwner)
          );
    }

    drunkTokenSnapshot(token) {
      const scene = token.parent,
        grid = scene.toObject().grid,
        d = scene.dimensions;
      return {
        uuid: token.uuid,
        actorUuid: token.actor?.uuid,
        isOwner: token.isOwner === true,
        x: token.x,
        y: token.y,
        width: token.width,
        height: token.height,
        sceneUuid: scene.uuid,
        grid: { type: grid.type, size: grid.size, distance: grid.distance, units: grid.units },
        sceneRect: { x: d.sceneX, y: d.sceneY, width: d.sceneWidth, height: d.sceneHeight }
      };
    }

    async applyDrunkReposition(options = {}) {
      if (this.type !== "agent" || !this.isOwner) return null;
      let input = options;
      const signature = r =>
          JSON.stringify(r ? { id: r.id, die: r.die, direction: r.direction, rollJSON: r.rollJSON } : null),
        expected = signature(this.system.drunkRepositions?.find(r => r.id === input.id)),
        tokens = this.drunkMovementTokens,
        positions = new Map(tokens.map(t => [t.uuid, JSON.stringify(this.drunkTokenSnapshot(t))]));
      if (input.routeConfirmed === undefined) {
        const esc = foundry.utils.escapeHTML,
          answer = await systemDialog.input({
            window: { title: loc`Apply Drunk five-foot reposition` },
            rejectClose: false,
            content: `<div class="spycraft2-roll-options"><label>${loc`Token`} <select name="tokenUuid">${tokens.map(t => `<option value="${esc(t.uuid)}">${esc(t.name)} (${esc(t.parent.name)})</option>`).join("")}</select></label><label><input name="routeConfirmed" type="checkbox" /> ${loc`The GC confirms the recorded direction and forced movement path; obstacles and hazards are resolved`}</label><p>${loc`The selected token moves exactly five feet in the frozen direction without spending allowed movement. Other grids and unresolved paths use manual reposition confirmation.`}</p></div>`
          });
        if (!answer) return null;
        input = { ...input, ...answer };
      }
      return queueResources([this], async () => {
        let record = this.system.drunkRepositions?.find(r => r.id === input.id);
        if (signature(record) !== expected)
          throw new Error(loc`The frozen direction changed during movement confirmation.`);
        if (record?.state === "applied") return record;
        const token = this.drunkMovementTokens.find(t => t.uuid === input.tokenUuid);
        if (!token) throw new Error(loc`Choose an owned token for this character.`);
        if (
          record?.state !== "moving" &&
          JSON.stringify(this.drunkTokenSnapshot(token)) !== (input.expectedTokenSnapshot ?? positions.get(token.uuid))
        )
          throw new Error(loc`The token position or scene grid changed during confirmation. Review its new position.`);
        const plan = drunkTokenMovementPlan(
          { ...this.system, ...this.attributeRuleContext, actorUuid: this.uuid },
          this.participatingCombat,
          { ...input, token: this.drunkTokenSnapshot(token) }
        );
        if (plan.reused) return plan.record;
        record = plan.record;
        if (this.system.drunkRepositions.find(r => r.id === record.id)?.state !== "moving")
          await this.update({
            "system.drunkRepositions": this.system.drunkRepositions.map(r => (r.id === record.id ? record : r))
          });
        const destination = plan.movementPlan.to;
        if (plan.moveRequired) {
          try {
            await token.update({ x: destination.x, y: destination.y });
          } catch (error) {
            if (token.x !== destination.x || token.y !== destination.y) throw error;
          }
        }
        if (token.x !== destination.x || token.y !== destination.y)
          throw new Error(
            loc`The token position changed during movement. Preserve it and review the pending reposition.`
          );
        const completed = { ...record, state: "applied", movementConfirmed: true, appliedAt: game.time.worldTime };
        await this.update({
          "system.drunkRepositions": this.system.drunkRepositions.map(r => (r.id === record.id ? completed : r))
        });
        return completed;
      });
    }

    async confirmDrunkReposition(options = {}) {
      if (this.type !== "agent" || !this.isOwner) return null;
      let input = options;
      const signature = r =>
          JSON.stringify(
            r
              ? { id: r.id, die: r.die, direction: r.direction, rollJSON: r.rollJSON, movementPlan: r.movementPlan }
              : null
          ),
        expected = signature(this.system.drunkRepositions?.find(r => r.id === input.id));
      if (input.movementConfirmed === undefined) {
        const answer = await systemDialog.input({
          window: { title: loc`Confirm Drunk reposition` },
          rejectClose: false,
          content: `${this.system.drunkRepositions?.find(r => r.id === input.id)?.state === "moving" ? `<label><input name="interruptedMovementReviewed" type="checkbox" /> ${loc`The GC reviewed the interrupted token movement and its actual resolution`}</label>` : ""}<label><input name="movementConfirmed" type="checkbox" /> ${loc`The GC confirms the recorded five-foot movement actually occurred and did not reduce allowed movement; obstacles and hazards were resolved`}</label>`
        });
        if (!answer) return null;
        input = { ...input, ...answer };
      }
      return queueResources([this], async () => {
        if (signature(this.system.drunkRepositions?.find(r => r.id === input.id)) !== expected)
          throw new Error(loc`The recorded direction changed during movement confirmation. Review the frozen roll.`);
        const plan = drunkRepositionCompletion({ ...this.system, ...this.attributeRuleContext }, input);
        if (!plan.reused)
          await this.update({
            "system.drunkRepositions": this.system.drunkRepositions.map(r =>
              r.id === plan.record.id ? plan.record : r
            )
          });
        return plan.record;
      });
    }

    beginDrunkSleep(options = {}) {
      return this.beginFatigueRest(options, "drunk");
    }

    completeDrunkSleep(options = {}) {
      return this.completeFatigueRest(options, "drunk");
    }

    ordinaryFatigueSources(condition) {
      if (!["fatigued", "exhausted", "drunk"].includes(condition))
        throw new Error(loc`Choose ordinary Fatigued, Exhausted or Drunk recovery.`);
      const own = [...this.effects];
      if ((this.appliedEffects ?? []).some(e => e.statuses.has(condition) && !own.includes(e)))
        throw new Error(
          loc`This condition is still supplied by an item or another source. Review that source before ordinary recovery.`
        );
      return own
        .filter(e => e.active && e.statuses.has(condition))
        .map(e => e.id)
        .sort();
    }

    async beginFatigueRest(options = {}, restKind = "fatigue") {
      if (this.type !== "agent" || !this.isOwner) return null;
      if (!["fatigue", "drunk"].includes(restKind)) return null;
      const restKey = restKind === "drunk" ? "drunkSleep" : "fatigueRest";
      const available =
        restKind === "drunk"
          ? this.system.conditionContext?.drunk
            ? ["drunk"]
            : []
          : this.system.conditionContext?.exhausted
            ? ["exhausted"]
            : this.system.conditionContext?.fatigued
              ? ["fatigued"]
              : [];
      if (!available.length)
        return refuse(
          loc`No matching ordinary condition applies. A condition with its own duration follows its source recovery rule.`
        );
      const expectedSources = Object.fromEntries(
        available.map(condition => [
          condition,
          [...this.effects]
            .filter(e => e.active && e.statuses.has(condition))
            .map(e => e.id)
            .sort()
        ])
      );
      let input = options;
      if (!Object.keys(input).length) {
        input = await systemDialog.input({
          window: { title: restKind === "drunk" ? loc`Begin Drunk sleep` : loc`Begin fatigue recovery` },
          rejectClose: false,
          content: `<div class="spycraft2-roll-options"><label>${loc`Recovery`} <select name="condition">${available.map(c => `<option value="${c}">${c === "drunk" ? loc`Drunk — 4 full hours asleep` : c === "exhausted" ? loc`Exhausted — 1 full hour asleep` : loc`Fatigued — 8 hours of inactive rest`}</option>`).join("")}</select></label><label><input name="ordinaryRuleConfirmed" type="checkbox" /> ${loc`This condition uses its ordinary recovery rule; any special source restrictions are met`}</label><label><input name="confirmed" type="checkbox" /> ${loc`The GC confirms the required sleep/rest begins now`}</label>${this.system[restKey]?.completedAt === null ? `<label><input name="restart" type="checkbox" /> ${loc`Restart the tracked rest period from now`}</label>` : ""}<p>${loc`Actual sleep/rest must be confirmed after enough game time has passed. Natural healing is separate.`}</p></div>`
        });
        if (!input) return null;
        input = { ...input, restart: input.restart === true };
      }
      try {
        return await queueResources([this], async () => {
          const condition = input.condition ?? available[0];
          if (!available.includes(condition)) throw new Error(loc`Choose a condition in this recovery family.`);
          const ids = this.ordinaryFatigueSources(condition);
          if (JSON.stringify(ids) !== JSON.stringify(input.expectedSourceIds ?? expectedSources[condition]))
            throw new Error(
              loc`The condition sources changed while recovery was being started. Review the current condition.`
            );
          const plan = fatigueRestRecord(
            { ...this.system, ...this.attributeRuleContext, fatigueRest: this.system[restKey] ?? null },
            { ...input, condition, ids, restKind }
          );
          if (plan.reused) return plan.record;
          await this.update({ ["system." + restKey]: plan.record });
          return plan.record;
        });
      } catch (error) {
        ui.notifications.warn(error.message);
        throw error;
      }
    }

    async completeFatigueRest(options = {}, restKind = "fatigue") {
      if (this.type !== "agent" || !this.isOwner) return null;
      if (!["fatigue", "drunk"].includes(restKind)) return null;
      const restKey = restKind === "drunk" ? "drunkSleep" : "fatigueRest";
      const expectedRest = JSON.stringify(this.system[restKey] ?? null);
      let input = options;
      if (!Object.keys(input).length) {
        input = await systemDialog.input({
          window: { title: restKind === "drunk" ? loc`Confirm Drunk recovery` : loc`Confirm fatigue recovery` },
          rejectClose: false,
          content: `<div class="spycraft2-roll-options"><label><input name="fullRecoveryConfirmed" type="checkbox" /> ${loc`The GC confirms the full required period of actual sleep or inactive rest was completed`}</label><p>${loc`The game clock must also reach the required duration. This clears only the tracked ordinary condition; other conditions and health remain unchanged.`}</p></div>`
        });
        if (!input) return null;
      }
      try {
        return await queueResources([this], async () => {
          if (JSON.stringify(this.system[restKey] ?? null) !== (input.expectedRest ?? expectedRest))
            throw new Error(loc`The rest record changed while recovery was being confirmed. Review the current rest.`);
          const before = foundry.utils.deepClone(this.system[restKey] ?? null),
            ids = before ? this.ordinaryFatigueSources(before.condition) : [],
            plan = fatigueRestCompletionPlan(
              { ...this.system, ...this.attributeRuleContext, fatigueRest: this.system[restKey] ?? null },
              { ...input, ids, restKind }
            );
          if (plan.duplicate) return plan.record;
          const sources = plan.alreadyAbsent
            ? []
            : [...this.effects]
                .filter(e => e.active && e.statuses.has(before.condition))
                .map(e => ({ data: e.toObject(), after: null }));
          try {
            if (!plan.alreadyAbsent) {
              await setConditionStatus(this, before.condition, false, { label: before.condition });
              for (const row of sources) row.after = this.effects.get(row.data._id)?.toObject() ?? null;
            }
            await this.update({ ["system." + restKey]: plan.record });
            return plan.record;
          } catch (error) {
            const failures = [];
            for (const row of sources) {
              const current = this.effects.get(row.data._id);
              if (row.after === null) {
                if (!current)
                  try {
                    await this.createEmbeddedDocuments("ActiveEffect", [row.data], { keepId: true });
                  } catch (e) {
                    failures.push(e);
                  }
                else if (JSON.stringify(current.toObject()) !== JSON.stringify(row.data))
                  failures.push(new Error(loc`The original condition source changed; review it.`));
              } else if (current) {
                const statuses = [...current.statuses];
                if (JSON.stringify(statuses) === JSON.stringify(row.after.statuses))
                  try {
                    await this.updateEmbeddedDocuments("ActiveEffect", [
                      { _id: current.id, statuses: row.data.statuses }
                    ]);
                  } catch (e) {
                    failures.push(e);
                  }
                else if (JSON.stringify(statuses) !== JSON.stringify(row.data.statuses))
                  failures.push(new Error(loc`Condition statuses changed again; preserve them for review.`));
              } else failures.push(new Error(loc`The condition source was removed; review it.`));
            }
            const current = JSON.stringify(this.system[restKey] ?? null);
            if (![JSON.stringify(before), JSON.stringify(plan.record)].includes(current))
              failures.push(new Error(loc`Rest history changed again; preserve it for review.`));
            if (!failures.length)
              try {
                await this.update({ ["system." + restKey]: before });
              } catch (e) {
                failures.push(e);
              }
            if (failures.length || error instanceof AggregateError) {
              try {
                if (
                  [JSON.stringify(before), JSON.stringify(plan.record)].includes(
                    JSON.stringify(this.system[restKey] ?? null)
                  )
                )
                  await this.update({ ["system." + restKey]: { ...before, needsReview: true } });
              } catch (e) {
                failures.push(e);
              }
              throw new AggregateError(
                [error, ...failures],
                loc`Condition recovery needs review after incomplete restoration.`
              );
            }
            throw error;
          }
        });
      } catch (error) {
        ui.notifications.warn(error.message);
        throw error;
      }
    }

    async applyFatigue(options = {}) {
      if (this.type !== "agent" || !this.isOwner) return null;
      let input = options;
      const expectedState = fatigueStateSignature({ ...this.system, ...this.attributeRuleContext });
      if (!Object.keys(input).length) {
        input = await systemDialog.input({
          window: { title: loc`Apply fatigue or exhaustion` },
          rejectClose: false,
          content: `<div class="spycraft2-roll-options"><label>${loc`Incoming condition`} <select name="kind"><option value="fatigued">${loc`Fatigued`}</option><option value="exhausted">${loc`Exhausted`}</option></select></label><label>${loc`Source of this application`} <input name="source" required /></label><label><input name="confirmed" type="checkbox" /> ${loc`The GC confirms this is a new application of the selected condition`}</label><p>${loc`A second fatigue replaces Fatigued with Exhausted. Fatigue or exhaustion received while already Exhausted causes unconsciousness (pp.340–342). No action die is spent.`}</p></div>`
        });
        if (!input) return null;
      }
      const id = input.id ?? foundry.utils.randomID(),
        request = { ...input, id, expectedState: input.expectedState ?? expectedState };
      try {
        return await queueResources([this], async () => {
          const plan = fatigueApplicationPlan({ ...this.system, ...this.attributeRuleContext }, request);
          if (plan.duplicate) return plan.record;
          const history = foundry.utils.deepClone(this.system.fatigueApplications ?? []),
            events = foundry.utils.deepClone(this.system.mentalLeapFatigueEvents ?? []),
            nextHistory = [...history, plan.record],
            nextEvents = plan.event ? [...events, plan.event] : events;
          const beforeSources = plan.clearFatigued
            ? [...this.effects]
                .filter(e => e.active && e.statuses.has("fatigued"))
                .map(e => ({ data: e.toObject(), after: null }))
            : [];
          let created = null;
          try {
            if (plan.clearFatigued) {
              await setConditionStatus(this, "fatigued", false, { label: loc`Fatigued` });
              for (const row of beforeSources) row.after = this.effects.get(row.data._id)?.toObject() ?? null;
            }
            if (plan.applyStatus) {
              const changed = await setConditionStatus(this, plan.applyStatus, true, {
                label: plan.applyStatus === "fatigued" ? loc`Fatigued` : loc`Exhausted`
              });
              if (changed.effectId) created = this.effects.get(changed.effectId)?.toObject() ?? null;
            }
            await this.update({
              "system.fatigueApplications": nextHistory,
              ...(plan.event ? { "system.mentalLeapFatigueEvents": nextEvents } : {})
            });
            return plan.record;
          } catch (error) {
            const failures = [];
            if (created) {
              const current = this.effects.get(created._id);
              if (current) {
                if (JSON.stringify(current.toObject()) === JSON.stringify(created))
                  try {
                    await this.deleteEmbeddedDocuments("ActiveEffect", [created._id]);
                  } catch (e) {
                    failures.push(e);
                  }
                else failures.push(new Error(loc`The new condition source changed again; preserve it for review.`));
              }
            }
            for (const row of beforeSources) {
              const current = this.effects.get(row.data._id);
              if (row.after === null) {
                if (!current)
                  try {
                    await this.createEmbeddedDocuments("ActiveEffect", [row.data], { keepId: true });
                  } catch (e) {
                    failures.push(e);
                  }
                else if (JSON.stringify(current.toObject()) !== JSON.stringify(row.data))
                  failures.push(new Error(loc`The original fatigue source changed; review it.`));
              } else if (current) {
                const statuses = [...current.statuses];
                if (JSON.stringify(statuses) === JSON.stringify(row.after.statuses))
                  try {
                    await this.updateEmbeddedDocuments("ActiveEffect", [
                      { _id: current.id, statuses: row.data.statuses }
                    ]);
                  } catch (e) {
                    failures.push(e);
                  }
                else if (JSON.stringify(statuses) !== JSON.stringify(row.data.statuses))
                  failures.push(new Error(loc`Fatigue statuses changed again; review them.`));
              } else failures.push(new Error(loc`The original fatigue source was removed; review it.`));
            }
            const currentHistory = this.system.fatigueApplications ?? [],
              currentEvents = this.system.mentalLeapFatigueEvents ?? [];
            if (
              ![JSON.stringify(history), JSON.stringify(nextHistory)].includes(JSON.stringify(currentHistory)) ||
              ![JSON.stringify(events), JSON.stringify(nextEvents)].includes(JSON.stringify(currentEvents))
            )
              failures.push(new Error(loc`Fatigue history changed again; preserve it for review.`));
            if (!failures.length)
              try {
                await this.update({ "system.fatigueApplications": history, "system.mentalLeapFatigueEvents": events });
              } catch (e) {
                failures.push(e);
              }
            if (failures.length || error instanceof AggregateError) {
              try {
                if (!(this.system.fatigueApplications ?? []).some(r => r.id === id))
                  await this.update({
                    "system.fatigueApplications": [
                      ...(this.system.fatigueApplications ?? []),
                      { ...plan.record, needsReview: true }
                    ]
                  });
                else
                  await this.update({
                    "system.fatigueApplications": this.system.fatigueApplications.map(r =>
                      r.id === id ? { ...r, needsReview: true } : r
                    )
                  });
              } catch (e) {
                failures.push(e);
              }
              throw new AggregateError(
                [error, ...failures],
                loc`Fatigue application needs review after incomplete restoration.`
              );
            }
            throw error;
          }
        });
      } catch (error) {
        ui.notifications.warn(error.message);
        throw error;
      }
    }

    async recordFatigueEscalation(options = {}) {
      if (this.type !== "agent" || !this.isOwner) return null;
      let input = options;
      if (input.confirmed === undefined) {
        input = await systemDialog.input({
          window: { title: loc`Repeated fatigue / exhaustion` },
          rejectClose: false,
          content: `<div class="spycraft2-roll-options"><p>${loc`Receiving fatigue or exhaustion while already exhausted causes unconsciousness (p.341).`}</p><label><input name="confirmed" type="checkbox" /> ${loc`The GC confirmed another application while this character is already exhausted`}</label></div>`
        });
        if (!input) return null;
      }
      return queueResources([this], async () => {
        const before = foundry.utils.deepClone(this.system.mentalLeapFatigueEvents ?? []),
          event = mentalLeapFatigueEvent(
            { ...this.system, ...this.attributeRuleContext },
            { ...input, id: foundry.utils.randomID() }
          );
        try {
          await this.update({ "system.mentalLeapFatigueEvents": [...before, event] });
          await ChatMessage.create({
            speaker: ChatMessage.getSpeaker({ actor: this }),
            content: loc`Fatigued or exhausted again while already exhausted: unconscious. The GC resolves the required sleep recovery (p.341).`,
            flags: {
              spycraft2: {
                actorUuid: this.uuid,
                checkKind: "fatigueEscalation",
                eventId: event.id,
                actionDiceAllowed: false
              }
            }
          });
          return event;
        } catch (error) {
          await this.update({ "system.mentalLeapFatigueEvents": before });
          throw error;
        }
      });
    }

    async startMentalLeapSleep(options = {}) {
      if (this.type !== "agent" || !this.isOwner || !this.system.mentalLeapState?.recoveryAvailable) return null;
      const causes = this.system.mentalLeapState.unconsciousCauses ?? [],
        expected = JSON.stringify(causes.map(c => c.key).sort()),
        beforeInput = this.system.mentalLeapSleep,
        known = beforeInput?.completedAt === null && Array.isArray(beforeInput.causeKeys) ? beforeInput.causeKeys : [],
        newCauses = causes.filter(c => !known.includes(c.key)),
        esc = foundry.utils.escapeHTML;
      let input = options;
      if (input.confirmed === undefined) {
        input = await systemDialog.input({
          window: { title: loc`Unconsciousness sleep requirements` },
          rejectClose: false,
          content: `<div class="spycraft2-roll-options"><p>${loc`Each applicable new cause receives a frozen 2d4-hour sleep requirement. The GC decides whether another application can affect an already unconscious character (p.340). Existing rolled requirements remain in force.`}</p>${newCauses.map((c, i) => `<label><input name="cause${i}" type="checkbox" checked /> ${loc`${esc(c.label)} — apply a new sleep duration`}</label>`).join("")}${beforeInput?.completedAt === null && !Array.isArray(beforeInput.causeKeys) ? `<label><input name="reviewLegacyNoNewCause" type="checkbox" /> ${loc`The GC confirms all current causes were already covered when the earlier tracked sleep began`}</label>` : ""}${beforeInput?.completedAt === null ? `<label><input name="restart" type="checkbox" /> ${loc`Restart the current tracked sleep period from now`}</label>` : ""}<label><input name="confirmed" type="checkbox" /> ${loc`The GC confirms these causes and the beginning or continuation of actual sleep`}</label></div>`
        });
        if (!input) return null;
        input = {
          ...input,
          restart: input.restart === true,
          ignoredCauseKeys:
            input.reviewLegacyNoNewCause === true
              ? []
              : newCauses.filter((c, i) => input["cause" + i] !== true).map(c => c.key)
        };
      }
      if (input.confirmed !== true) return refuse(loc`Confirm the sleep requirement with the GC.`);
      return queueResources([this], async () => {
        const current = JSON.stringify((this.system.mentalLeapState.unconsciousCauses ?? []).map(c => c.key).sort());
        if (current !== (input.expectedCauses ?? expected))
          throw new Error(
            loc`Unconsciousness causes changed while sleep was being confirmed. Review the current causes.`
          );
        const before = foundry.utils.deepClone(this.system.mentalLeapSleep ?? null),
          request = {
            confirmed: true,
            restart: input.restart ?? false,
            reviewLegacyNoNewCause: input.reviewLegacyNoNewCause === true,
            ignoredCauseKeys: input.ignoredCauseKeys ?? []
          },
          rollHoursByCause = {},
          rolls = [];
        let plan = unconsciousSleepPlan(
          { ...this.system, ...this.attributeRuleContext },
          { ...request, rollHoursByCause }
        );
        for (const cause of plan.needsRoll) {
          const roll = await new Roll("2d4").evaluate();
          rolls.push(roll);
          rollHoursByCause[cause.key] = roll.total;
        }
        if (JSON.stringify((this.system.mentalLeapState.unconsciousCauses ?? []).map(c => c.key).sort()) !== current)
          throw new Error(loc`Unconsciousness causes changed during the rolls. Review them before tracking sleep.`);
        plan = unconsciousSleepPlan({ ...this.system, ...this.attributeRuleContext }, { ...request, rollHoursByCause });
        if (!plan.record) throw new Error(loc`All new applicable causes need their sleep rolls.`);
        try {
          await this.update({ "system.mentalLeapSleep": plan.record });
          const text = loc`Sleep requirements retained: ${plan.record.requirements.map(r => r.requiredHours + " full hours").join("; ")}. Confirm actual sleep for every retained requirement after its deadline.`,
            message = {
              speaker: ChatMessage.getSpeaker({ actor: this }),
              flags: {
                spycraft2: {
                  actorUuid: this.uuid,
                  checkKind: "unconsciousSleep",
                  requiredHours: plan.record.requiredHours,
                  newRequirementCount: rolls.length,
                  requirements: plan.record.requirements,
                  reusedRequirement: !rolls.length,
                  actionDiceAllowed: false
                }
              }
            };
          await ChatMessage.create({ ...message, ...(rolls.length ? { rolls, flavor: text } : { content: text }) });
          return plan.record;
        } catch (error) {
          await this.update({ "system.mentalLeapSleep": before });
          throw error;
        }
      });
    }

    async completeMentalLeapSleep(options = {}) {
      if (this.type !== "agent" || !this.isOwner) return null;
      let input = options;
      if (input.fullSleepConfirmed === undefined) {
        const sleep = this.system.mentalLeapSleep,
          requirements = Array.isArray(sleep?.requirements) ? sleep.requirements : [];
        input = await systemDialog.input({
          window: { title: loc`Confirm full sleep recovery` },
          rejectClose: false,
          content: `<div class="spycraft2-roll-options">${requirements.map(r => `<p>${loc`Retained requirement: ${r.requiredHours} full hours asleep.`}</p>`).join("")}<label><input name="fullSleepConfirmed" type="checkbox" /> ${loc`The GC confirms all required actual sleep for every retained requirement was completed`}</label>${sleep && !Array.isArray(sleep.causeKeys) ? `<label><input name="reviewLegacyNoNewCause" type="checkbox" /> ${loc`The GC confirms no additional cause was omitted from this earlier sleep record`}</label>` : ""}${sleep?.legacyReviewRequired || (sleep && !Array.isArray(sleep.requirements) && sleep.previousDueAt > sleep.at + sleep.requiredHours * 3600) ? `<label><input name="earlierRequirementsConfirmed" type="checkbox" /> ${loc`The GC reviewed and satisfied all earlier retained sleep requirements`}</label>` : ""}<p>${loc`The game clock must also reach every deadline. Other conditions and health remain separate.`}</p></div>`
        });
        if (!input) return null;
      }
      return queueResources([this], async () => {
        const plan = unconsciousSleepCompletionPlan({ ...this.system, ...this.attributeRuleContext }, input),
          before = foundry.utils.deepClone(this.system.mentalLeapRecovery ?? null),
          oldSleep = foundry.utils.deepClone(this.system.mentalLeapSleep);
        try {
          await this.update({
            "system.mentalLeapRecovery": plan.record,
            "system.mentalLeapSleep": plan.completedSleep
          });
          await ChatMessage.create({
            speaker: ChatMessage.getSpeaker({ actor: this }),
            content: loc`Recovered from the recorded unconsciousness causes after all retained GC-confirmed sleep requirements were satisfied. Other conditions remain separate.`,
            flags: {
              spycraft2: {
                actorUuid: this.uuid,
                checkKind: "unconsciousRecovery",
                requiredHours: plan.record.requiredHours,
                requirements: plan.completedSleep.requirements,
                actionDiceAllowed: false
              }
            }
          });
          return plan.record;
        } catch (error) {
          await this.update({ "system.mentalLeapRecovery": before, "system.mentalLeapSleep": oldSleep });
          throw error;
        }
      });
    }

    async rollWisdomCollapse(options = {}) {
      if (this.type !== "agent" || !this.isOwner || !attributeCollapsePlan(this.system).wisdomEpisode) return null;
      let input = options;
      if (!input.confirmed) {
        input = await systemDialog.input({
          window: { title: loc`Wisdom-collapse episode` },
          rejectClose: false,
          content: `<div class="spycraft2-roll-options"><p>${loc`The GC determines a new Frenzied/Terrified episode with equal probability every 2d10 minutes while Wisdom is zero or lower. This records the roll; the GC applies the condition and tracks the next episode.`}</p><label><input type="checkbox" name="sleeping" /> ${loc`Currently asleep`}</label><label><input type="checkbox" name="stunned" /> ${loc`Currently stunned`}</label><label><input type="checkbox" name="unconscious" /> ${loc`Currently unconscious`}</label><label><input type="checkbox" name="confirmed" /> ${loc`The GC confirmed a new episode is due now`}</label></div>`
        });
        if (!input) return null;
      }
      if (input.confirmed !== true) return refuse(loc`Confirm with the GC that a new Wisdom-collapse episode is due.`);
      const choice = await new Roll("1d2").evaluate(),
        duration = await new Roll("2d10").evaluate(),
        values = duration.dice[0]?.results.filter(d => d.active !== false).map(d => d.result);
      const episode = wisdomCollapseEpisode(this.system, {
        choiceDie: choice.total,
        durationDice: values,
        sleeping:
          input.sleeping === true ||
          !!this.statuses?.has("sleeping") ||
          !!this.statuses?.has("sleep") ||
          !!this.statuses?.has("asleep"),
        stunned:
          input.stunned === true ||
          this.system.conditionContext?.stunned === true ||
          !!this.statuses?.has("stunned") ||
          !!this.statuses?.has("stun"),
        unconscious: input.unconscious === true || !!this.statuses?.has("unconscious")
      });
      await ChatMessage.create({
        speaker: ChatMessage.getSpeaker({ actor: this }),
        content: loc`Wisdom collapse: ${episode.condition} for ${episode.minutes} minutes${episode.doubleDuration ? loc` (duration doubled for sleep/stun/unconsciousness)` : ""}. The GC applies the condition and determines when the next episode is due (p.15). No action die spent.`,
        rolls: [choice, duration],
        flags: {
          spycraft2: { actorUuid: this.uuid, checkKind: "attributeCollapse", ...episode, actionDiceAllowed: false }
        }
      });
      return episode;
    }
  };
