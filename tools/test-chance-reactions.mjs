import test from "node:test";
import assert from "node:assert/strict";
import {
  chanceReactionSpecs,
  reactableHit,
  peculiarDodgeMisses,
  misfortuneEligible,
  fortunesFoolEligible
} from "../module/rules/chance-reactions.mjs";
import { rollPipeline } from "../module/rules/roll-pipeline.mjs";

const chance = names => ({
  activeFeatNames: names,
  activeFeatSelections: names.map(name => ({ name, tree: "Chance" }))
});

test("Lucky Break once per scene; Peculiar Dodge and Misfortune once per Chance feat each session", () => {
  const specs = chanceReactionSpecs(chance(["Lucky Break", "Misfortune", "Peculiar Dodge"]));
  assert.deepEqual(
    specs.map(s => [s.id, s.period, s.limit]),
    [
      ["luckyBreak", "scene", 1],
      ["peculiarDodge", "session", 3],
      ["misfortune", "session", 3]
    ]
  );
});

test("only an unactivated, unturned resolved hit can be answered", () => {
  const hit = patch => ({ checkKind: "attack", resolved: true, successConfirmed: true, ...patch });
  assert.ok(reactableHit(hit()));
  assert.equal(reactableHit(hit({ criticalSuccess: true })), false, "after a threat is activated");
  assert.equal(reactableHit(hit({ luckyBreak: "x" })), false);
  assert.equal(reactableHit(hit({ successConfirmed: false })), false);
  assert.deepEqual([1, 2, 3, 4].map(peculiarDodgeMisses), [true, false, true, false]);
});

test("Misfortune needs an unactivated threat against a recorded target; Fortune's Fool an activated error", () => {
  const threat = patch => ({
    checkKind: "attack",
    resolved: true,
    threatConfirmed: true,
    attackContext: { targetActorUuid: "Actor.t" },
    ...patch
  });
  assert.ok(misfortuneEligible(threat()));
  assert.equal(misfortuneEligible(threat({ criticalSuccess: true })), false);
  assert.equal(misfortuneEligible(threat({ attackContext: {} })), false);
  assert.ok(fortunesFoolEligible({ criticalFailure: true, criticalActivation: { kind: "failure", payerUuid: "GC" } }));
  assert.equal(
    fortunesFoolEligible({
      criticalFailure: true,
      criticalActivation: { kind: "failure", payerUuid: "GC" },
      fortunesFool: "GC"
    }),
    false
  );
});

test("the controls are the GC's and name the feat's owner", () => {
  const target = { uuid: "Actor.t", name: "Lucky", system: chance(["Lucky Break", "Peculiar Dodge"]) };
  globalThis.fromUuidSync = uuid => (uuid === target.uuid ? target : null);
  const check = {
    checkKind: "attack",
    resolved: true,
    successConfirmed: true,
    attackContext: { targetActorUuid: "Actor.t" }
  };
  const labels = isGM =>
    (
      rollPipeline.chatControls({
        message: { flags: { spycraft2: check } },
        check,
        actor: { name: "A", system: {} },
        user: { isGM },
        checkKind: "attack"
      }) ?? []
    ).map(c => c.label);
  return import("../module/apps/chance-reactions.mjs").then(() => {
    assert.ok(labels(true).some(l => /Lucky Break \(Lucky\)/.test(l)));
    assert.ok(labels(true).some(l => /Peculiar Dodge \(Lucky\)/.test(l)));
    assert.equal(
      labels(false).some(l => /Lucky Break|Peculiar Dodge/.test(l)),
      false
    );
  });
});
