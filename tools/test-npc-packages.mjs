import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { buildPacks } from "./lib/pack-docs.mjs";
import {
  npcPackageBands,
  recommendedNpcPackage,
  planNpcPackage,
  npcPackageStamp
} from "../module/rules/npc-packages.mjs";
import { computeNpcProfile } from "../module/rules/npcs.mjs";
import { validateNpcFeats } from "../module/rules/npc-feats.mjs";
import { applyNpcPackage, manageNpcPackages, npcPackagePreview } from "../module/apps/npc-packages.mjs";

const built = buildPacks();
const data = JSON.parse(built.generated["module/data/npc-packages.json"]);
const snapshots = built.packs["core-npcs"].docs.map(doc => ({
  ...structuredClone(doc),
  items: structuredClone(doc.embedded.items)
}));
const civilian = () => structuredClone(snapshots.find(a => a.name === "Ordinary Civilian"));
const applied = (snapshot, plan) => ({
  ...structuredClone(snapshot),
  items: plan.items,
  system: { ...snapshot.system, npcProfile: plan.profile, biography: plan.biography },
  flags: { ...snapshot.flags, spycraft2: { ...snapshot.flags.spycraft2, npcPackage: plan.receipt } }
});

test("all twenty roles have three valid authored packages and the fixed default", () => {
  assert.equal(Object.keys(data.roles).length, 20);
  for (const snapshot of snapshots) {
    const role = data.roles[snapshot.flags.spycraft2.npcTemplate];
    assert.deepEqual(
      role.packages.map(p => p.id),
      ["fixed", "basic", "established", "veteran"]
    );
    assert.equal(snapshot.flags.spycraft2.npcPackage, undefined);
    assert.deepEqual(role.packages[0].items, snapshot.items);
    assert.deepEqual(role.packages[0].profile, role.packages[2].profile);
    for (const p of role.packages) {
      for (let tl = 1; tl <= 20; tl++) {
        const plan = planNpcPackage(snapshot, data, p.id, { threatLevel: tl });
        assert.equal(plan.after.complete, true, `${snapshot.name}/${p.id}/${tl}`);
        assert.deepEqual(plan.after.warnings, []);
        assert.equal(plan.after.effectiveLevel, tl);
        const feats = plan.items.filter(i => i.type === "feat");
        assert.ok(feats.length <= 5);
        assert.equal(
          validateNpcFeats(
            feats.map(i => ({ name: i.name, choice: i.system.choice })),
            data.featCatalog
          ).ok,
          true
        );
        const without = { ...plan.profile, qualities: plan.profile.qualities.filter(q => q.id !== "feat") };
        const plain = computeNpcProfile(without, "standard", tl, snapshot.system.abilities);
        assert.equal(plan.after.xp - plain.xp, feats.length * 2);
        assert.equal(
          plan.after.equipmentXP,
          computeNpcProfile(p.profile, "standard", tl, snapshot.system.abilities).equipmentXP
        );
        const stockpiles = plan.items.filter(i => i.flags.spycraft2?.npcEquipment?.kind === "ammunition");
        const extras = stockpiles.reduce((sum, i) => sum + i.system.quantity - 1, 0);
        assert.equal(extras / 2, plan.profile.extraAmmoPairs);
      }
    }
  }
});

test("applying repeatedly or returning to fixed neither duplicates feats nor accumulates XP", () => {
  for (const original of snapshots) {
    const before = structuredClone(original);
    let snapshot = original;
    for (const packageId of ["basic", "veteran", "veteran", "established", "basic", "fixed"]) {
      const plan = planNpcPackage(snapshot, data, packageId, { threatLevel: 10 });
      assert.equal(new Set(plan.items.map(i => i._id)).size, plan.items.length);
      snapshot = applied(snapshot, plan);
    }
    assert.deepEqual(snapshot.system.npcProfile, before.system.npcProfile);
    assert.deepEqual(snapshot.items, before.items);
    assert.deepEqual(original, before, "planning must not mutate its input");
  }
});

test("bands are editable suggestions with complete, unambiguous TL coverage", () => {
  const role = data.roles["ordinary-civilian"];
  for (let tl = 1; tl <= 20; tl++)
    assert.equal(recommendedNpcPackage(role, tl), tl <= 5 ? "basic" : tl <= 12 ? "established" : "veteran");
  const custom = {
    basic: { minTL: 1, maxTL: 3 },
    established: { minTL: 4, maxTL: 8 },
    veteran: { minTL: 9, maxTL: 20 }
  };
  assert.equal(recommendedNpcPackage(role, 10, custom), "veteran");
  for (const maxTL of [0, 6, 4, 5.5])
    assert.throws(() => npcPackageBands(role, { basic: { minTL: 1, maxTL } }), /whole Threat Levels|gaps or overlaps/);
});

test("custom purchases, grades, skills, biography and unrelated items survive when priced", () => {
  const snapshot = civilian();
  snapshot.system.npcProfile.grades.attack = 7;
  snapshot.system.npcProfile.skills = [{ key: "notice", grade: 2 }];
  const feat = structuredClone(data.roles["security-guard"].packages[0].items.find(i => i.name === "Combat Mobility"));
  feat._id = "customfeat000001";
  delete feat.flags.spycraft2.npcPackageManaged;
  snapshot.items.push(feat);
  snapshot.system.npcProfile.qualities.push({ id: "feat", units: 1, details: "Combat Mobility" });
  const gear = structuredClone(data.roles["security-guard"].packages[0].items.find(i => i.type === "weapon"));
  gear._id = "customgear000001";
  delete gear.flags.spycraft2.npcPackageManaged;
  snapshot.items.push(gear);
  snapshot.system.npcProfile.equipment.weapons.push(gear.system.caliber);
  snapshot.system.biography = "<p>Campaign notes</p>" + snapshot.system.biography;
  const plan = planNpcPackage(snapshot, data, "veteran");
  assert.equal(plan.profile.grades.attack, 7);
  assert.deepEqual(plan.profile.skills, snapshot.system.npcProfile.skills);
  assert.deepEqual(plan.retained, [feat, gear]);
  assert.ok(plan.biography.startsWith("<p>Campaign notes</p>"));
  assert.match(plan.biography, /Current package: Veteran/);
  assert.equal(plan.items.filter(i => i.type === "feat").length, 4);
});

test("unpriced inventory, broken prerequisite chains and mismatched prior allowances are rejected", () => {
  const snapshot = civilian();
  const mobility = structuredClone(
    data.roles["security-guard"].packages[0].items.find(i => i.name === "Combat Mobility")
  );
  mobility._id = "unpricedfeat0001";
  delete mobility.flags.spycraft2.npcPackageManaged;
  snapshot.items.push(mobility);
  assert.throws(() => planNpcPackage(snapshot, data, "basic"), /matching Feat quality/);
  const bodyguard = structuredClone(snapshots.find(a => a.name === "Bodyguard"));
  const mobile = structuredClone(
    data.roles.bodyguard.packages.find(p => p.id === "veteran").items.find(i => i.name === "Mobile Offense")
  );
  mobile._id = "customfeat000002";
  delete mobile.flags.spycraft2.npcPackageManaged;
  bodyguard.items.push(mobile);
  bodyguard.system.npcProfile.qualities.push({ id: "feat", units: 1, details: "Mobile Offense" });
  // Basic Bodyguard retains Combat Mobility, so this dependent feat is still eligible.
  assert.doesNotThrow(() => planNpcPackage(bodyguard, data, "basic"));
  const police = structuredClone(snapshots.find(a => a.name === "Police Officer"));
  police.items.push(mobile);
  police.system.npcProfile.qualities.push({ id: "feat", units: 1, details: "Mobile Offense" });
  assert.throws(() => planNpcPackage(police, data, "basic"), /missing feat prerequisite/);
  const missing = civilian();
  missing.system.npcProfile.qualities = [];
  assert.throws(() => planNpcPackage(missing, data, "basic"), /no longer match/);
  const soldier = structuredClone(snapshots.find(a => a.name === "Soldier"));
  soldier.system.npcProfile.equipment.weapons = [];
  assert.throws(() => planNpcPackage(soldier, data, "veteran"), /no longer matches/);
  const wrong = civilian();
  wrong.system.npcType = "special";
  assert.throws(() => planNpcPackage(wrong, data, "basic"), /standard NPC/);
  assert.throws(() => planNpcPackage(civilian(), data, "missing"), /Unknown NPC package/);
});

function actorFixture() {
  const state = civilian();
  const calls = [];
  return {
    state,
    calls,
    isOwner: true,
    get system() {
      return state.system;
    },
    get flags() {
      return state.flags;
    },
    toObject() {
      return structuredClone(state);
    },
    async update(patch) {
      calls.push(patch);
      return this;
    }
  };
}
class ForcedReplacement {
  static create(value) {
    return new this(value);
  }
  constructor(value) {
    this.value = value;
  }
}
globalThis.foundry = { data: { operators: { ForcedReplacement } } };
globalThis.game = { user: { isGM: true } };
globalThis.ui = { notifications: { warn: () => {}, info: () => {} } };

test("a confirmed package uses one document update for inventory, profile and receipt", async () => {
  const actor = actorFixture();
  const stamp = npcPackageStamp(actor.toObject(), actor.system.threatLevel);
  await applyNpcPackage(actor, data, "veteran", stamp);
  assert.equal(actor.calls.length, 1);
  const patch = actor.calls[0];
  assert.ok(patch.items instanceof ForcedReplacement);
  assert.equal(patch["flags.spycraft2.npcPackage"].id, "veteran");
  assert.equal(patch.items.value.filter(i => i.type === "feat").length, 3);
  assert.equal(patch["system.npcProfile"].qualities.filter(q => q.id === "feat").length, 3);
});

test("stale previews, changed mission TL, missing authority and failed updates cannot partly apply", async () => {
  const actor = actorFixture();
  const stamp = npcPackageStamp(actor.toObject(), 1);
  actor.state.system.threatLevel = 2;
  await assert.rejects(applyNpcPackage(actor, data, "basic", stamp), /changed/);
  actor.state.system.threatLevel = 1;
  actor.state.items[0].name = "Edited";
  await assert.rejects(applyNpcPackage(actor, data, "basic", stamp), /changed/);
  assert.equal(actor.calls.length, 0);
  const fresh = actorFixture();
  fresh.system.effectiveThreatLevel = 15;
  await assert.rejects(applyNpcPackage(fresh, data, "basic", npcPackageStamp(fresh.toObject(), 1)), /changed/);
  game.user.isGM = false;
  await assert.rejects(applyNpcPackage(fresh, data, "basic", stamp), /Only the GC/);
  game.user.isGM = true;
  fresh.update = async () => {
    throw Error("database failure");
  };
  await assert.rejects(
    applyNpcPackage(fresh, data, "basic", npcPackageStamp(fresh.toObject(), 15)),
    /database failure/
  );
});

test("canceling either dialog leaves inventory and costs untouched", async () => {
  const actor = actorFixture();
  foundry.applications = { api: { DialogV2: { input: async () => null } } };
  assert.equal(await manageNpcPackages(actor, { data }), null);
  foundry.applications.api.DialogV2.input = async () => ({ packageId: "basic" });
  foundry.applications.api.DialogV2.confirm = async () => false;
  assert.equal(await manageNpcPackages(actor, { data }), null);
  assert.equal(actor.calls.length, 0);
  const preview = npcPackagePreview(planNpcPackage(civilian(), data, "veteran"));
  assert.match(preview, /Resulting XP calculation/);
  assert.match(preview, /Replace current template items/);
});

test("the sheet exposes preview and band controls without a TL-change application hook", () => {
  const template = readFileSync(new URL("../templates/actor/npc-builder.hbs", import.meta.url), "utf8");
  assert.match(template, /data-action="npcPackages"/);
  assert.match(template, /data-action="npcPackageBands"/);
  const app = readFileSync(new URL("../module/apps/npc-packages.mjs", import.meta.url), "utf8");
  assert.doesNotMatch(app, /Hooks\.(on|once)/);
});
