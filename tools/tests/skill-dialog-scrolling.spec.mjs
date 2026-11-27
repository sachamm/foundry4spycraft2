import { test, expect } from "@playwright/test";
import { createAnalysisTaskPlan } from "../../module/rules/analysis-tasks.mjs";
import { taskPressureUseSpec } from "../../module/rules/task-pressure.mjs";
import { readFileSync } from "node:fs";
import { uiModuleUrl } from "../lib/ui-test-module.mjs";
import { SPYCRAFT as cfg } from "../../module/config.mjs";
import { ActorProgression } from "../../module/documents/actor/progression.mjs";
import { creationPolicyRecord } from "../../module/rules/creation-policy.mjs";
import { settleGrapple } from "../../module/apps/combat-actions.mjs";
import { reviewTriggeredAttacks } from "../../module/apps/final-attack.mjs";
import { selectCakewalkSkills } from "../../module/apps/cakewalk.mjs";
import { resolveFallingDamage } from "../../module/apps/falling-damage.mjs";
import { rollEvidence } from "../../module/rules/outcomes.mjs";
// Capture the actual skill dialog content. Rendering/geometry is exercised by Chromium below.
globalThis.Actor = class {};
globalThis.CONFIG = { SPYCRAFT: cfg };
globalThis.game = { settings: { get: () => false } };
let content = "";
globalThis.foundry = {
  utils: { escapeHTML: value => String(value) },
  applications: {
    api: {
      DialogV2: {
        input: async options => {
          content = options.content;
          return null;
        }
      }
    }
  }
};
const { SpycraftActor } = await import("../../module/documents/actor.mjs");
const actor = new SpycraftActor();
actor.items = [];
actor.system = {
  skillTotals: { electronics: { name: "Electronics", ability: "int", totals: [{ ability: "int", total: 3 }] } }
};
await actor.rollSkill("electronics");
const ordinaryContent = content,
  wheelActor = new SpycraftActor();
wheelActor.items = [];
wheelActor.system = {
  activeFeatNames: ["One Hand on the Wheel"],
  activeFeatSelections: [
    { name: "One Hand on the Wheel", tree: "chase" },
    { name: "Dash", tree: "chase" }
  ],
  resourceUses: {},
  limitedUses: [
    {
      id: "oneHandManeuver",
      name: "One Hand on the Wheel",
      workflow: "freeManeuver",
      period: "scene",
      limit: 2,
      cost: 0
    }
  ],
  skillTotals: { drive: { name: "Drive", ability: "dex", totals: [{ ability: "dex", total: 6 }] } }
};
await wheelActor.rollSkill("drive");
const wheelContent = content;
content = ordinaryContent;

const courseActor = new SpycraftActor();
courseActor.items = [];
courseActor.system = {
  activeFeatNames: ["Professional Driver - Closed Course"],
  skillTotals: { impress: { name: "Impress", ability: "cha", totals: [{ ability: "cha", total: 6 }] } }
};
await courseActor.rollSkill("impress");
const courseContent = content;
content = ordinaryContent;

const forensicActor = new SpycraftActor();
forensicActor.items = [];
forensicActor.system = {
  activeFeatNames: ["Forensic Genius"],
  skillTotals: { analysis: { name: "Analysis", ability: "int", totals: [{ ability: "int", total: 6 }] } }
};
await forensicActor.rollSkill("analysis");
const forensicContent = content;
content = ordinaryContent;

game.user = { isGM: true };
const taskActor = new SpycraftActor();
taskActor.type = "agent";
taskActor.isOwner = true;
taskActor.uuid = "Actor.layout";
taskActor.flags = {};
taskActor.system = { analysisTasks: {}, activeFeatNames: ["Forensic Genius"] };
await taskActor.manageAnalysisTasks();
const taskContent = content;
content = ordinaryContent;

const pressureTask = createAnalysisTaskPlan(
  { activeFeatNames: ["Forensic Genius"] },
  { id: "task_layout", title: "Pressure examination", baseChallenges: 6, pressuredConfirmed: true }
);
const pressureActor = new SpycraftActor();
pressureActor.items = [];
pressureActor.system = {
  activeFeatNames: ["Forensic Genius"],
  analysisTasks: { task_layout: pressureTask },
  resourceUses: {},
  limitedUses: [taskPressureUseSpec(pressureTask)],
  skillTotals: {
    resolve: {
      name: "Resolve",
      ability: "con",
      totals: [
        { ability: "con", total: 6 },
        { ability: "wis", total: 5 }
      ]
    }
  }
};
await pressureActor.rollSkill("resolve");
const pressureContent = content;
content = ordinaryContent;

const recoveryActor = new SpycraftActor();
recoveryActor.type = "agent";
recoveryActor.isOwner = true;
recoveryActor.uuid = "Actor.recoveryLayout";
recoveryActor.system = { analysisTasks: { task_layout: pressureTask }, activeFeatNames: ["Forensic Genius"] };
recoveryActor.flags = {
  spycraft2: {
    analysisTaskReview: {
      version: 1,
      actorUuid: recoveryActor.uuid,
      transaction: {
        kind: "pressurePreparation",
        before: pressureTask,
        after: pressureTask,
        hasRolled: true,
        settled: { taskPressurePreparation: { raw: 4 } }
      }
    }
  }
};
await recoveryActor.manageAnalysisTasks();
const recoveryContent = content;
content = ordinaryContent;

const css = readFileSync(new URL("../../styles/spycraft2.css", import.meta.url), "utf8");
test("the actual advancement review separates original history from a GC grant and remains usable at 720px", async ({
  page
}) => {
  const prior = content,
    oldGame = globalThis.game;
  try {
    globalThis.game = { user: { isGM: true }, settings: { get: () => ({ mission: "review-mission" }) } };
    const C = ActorProgression(class {});
    const a = Object.assign(new C(), {
      type: "agent",
      uuid: "Actor.advancement-layout",
      isOwner: true,
      flags: {},
      system: { progression: Array(5).fill({}) }
    });
    await a.reviewAdvancement();
    await render(page, 720);
    await page.setViewportSize({ width: 1280, height: 720 });
    await page.getByRole("combobox", { name: "Review type", exact: true }).selectOption("grant");
    await page.getByLabel("Approved career level ceiling", { exact: true }).fill("7");
    await page.getByLabel("Source or ruling note", { exact: true }).fill("GC-approved starting level");
    await page.locator('[name="confirmed"]').check();
    await page.locator("#confirm").scrollIntoViewIfNeeded();
    const rect = await page.locator("#confirm").boundingBox();
    expect(rect.y).toBeGreaterThanOrEqual(0);
    expect(rect.y + rect.height).toBeLessThanOrEqual(720);
  } finally {
    content = prior;
    globalThis.game = oldGame;
  }
});
test("extra-attack claim recovery shows readable choices and keeps its GC confirmation reachable at 720px", async ({
  page
}) => {
  const prior = content,
    oldGame = globalThis.game;
  try {
    globalThis.game = { user: { isGM: true } };
    await reviewTriggeredAttacks({
      isOwner: true,
      flags: {
        spycraft2: {
          triggeredAttacks: {
            claim: { source: "cleaveBasics", round: 3, state: "reserved" }
          }
        }
      }
    });
    await render(page, 720);
    await page.setViewportSize({ width: 1280, height: 720 });
    await expect(page.getByRole("combobox", { name: "Extra attack", exact: true })).toContainText(
      "Cleave — round 3 (Needs review)"
    );
    await page.getByRole("combobox", { name: "Resolution", exact: true }).selectOption("unused");
    await page.getByLabel("Review note", { exact: true }).fill("No attack rolled; checked with the player");
    await page.locator('[name="confirmed"]').check();
    await page.locator("#confirm").scrollIntoViewIfNeeded();
    const rect = await page.locator("#confirm").boundingBox();
    expect(rect.y).toBeGreaterThanOrEqual(0);
    expect(rect.y + rect.height).toBeLessThanOrEqual(720);
  } finally {
    content = prior;
    globalThis.game = oldGame;
  }
});
test("the actual Grapple settlement exposes opening Size context and keeps confirmation reachable at 720px", async ({
  page
}) => {
  const prior = content;
  try {
    await settleGrapple({ isOwner: true, uuid: "Actor.grapple-layout", system: {} });
    await render(page, 720);
    await page.setViewportSize({ width: 1280, height: 720 });
    await page.locator('[name="sizeDifference"]').fill("-1");
    await page.locator('[name="grappleContextConfirmed"]').check();
    await expect(page.locator("body")).toContainText("recorded character Sizes take precedence");
    await page.locator("#confirm").scrollIntoViewIfNeeded();
    const rect = await page.locator("#confirm").boundingBox();
    expect(rect.y).toBeGreaterThanOrEqual(0);
    expect(rect.y + rect.height).toBeLessThanOrEqual(720);
  } finally {
    content = prior;
  }
});
for (const recovery of [false, true])
  test(`Falling ${recovery ? "recovery" : "landing"} dialog keeps its final controls reachable at 720px`, async ({
    page
  }) => {
    const prior = content,
      oldGame = globalThis.game;
    try {
      globalThis.game = { user: { isGM: true }, settings: { get: () => ({}) } };
      const check = {
        actorUuid: "Actor.layout-fall",
        checkKind: "skill",
        skillKey: "acrobatics",
        checkId: "falling",
        resolved: true,
        effectiveTotal: 10,
        fallDistance: { version: 1, actualDistanceFeet: 30, damageDistanceFeet: 30 }
      };
      const message = { uuid: "ChatMessage.layout-fall", flags: { spycraft2: check } };
      const actor = { uuid: check.actorUuid, isOwner: true, flags: {} };
      if (recovery)
        actor.flags = {
          spycraft2: {
            fallingResults: {
              [encodeURIComponent(message.uuid).replaceAll(".", "%2E")]: {
                actorUuid: actor.uuid,
                evidence: rollEvidence(check),
                state: "reserved",
                context: { surface: "solid" }
              }
            }
          }
        };
      await resolveFallingDamage(actor, message);
      await render(page, 720);
      await page.setViewportSize({ width: 1280, height: 720 });
      if (recovery) {
        await page.getByLabel("Actual d6 results (comma separated)", { exact: true }).fill("6, 4, 3");
        await page.getByLabel("GC review note", { exact: true }).fill("Actual dice confirmed");
      } else {
        await page.getByRole("combobox", { name: "Landing surface" }).selectOption("fluid");
        await page.locator('[name="diving"]').check();
        await page.getByLabel("Water depth (feet)", { exact: true }).fill("10");
      }
      await page.locator('[name="confirmed"]').check();
      await page.locator("#confirm").scrollIntoViewIfNeeded();
      const rect = await page.locator("#confirm").boundingBox();
      expect(rect.y).toBeGreaterThanOrEqual(0);
      expect(rect.y + rect.height).toBeLessThanOrEqual(720);
      await page.locator("#confirm").click();
      await expect(page.locator("#confirm")).toBeFocused();
    } finally {
      content = prior;
      globalThis.game = oldGame;
    }
  });

test("Cakewalk's actual Intel dialog keeps every skill and the confirmation reachable at 720px", async ({ page }) => {
  const prior = content,
    oldGame = globalThis.game;
  try {
    globalThis.game = {
      user: { isGM: true },
      settings: { get: (_id, key) => (key === "campaign" ? { qualities: ["cakewalk"] } : { mission: "qa" }) }
    };
    await selectCakewalkSkills({ type: "agent", isOwner: true, system: { abilities: { int: { mod: 2 } } } });
    await render(page, 720);
    await page.setViewportSize({ width: 1280, height: 720 });
    for (const key of Object.keys(cfg.skills)) {
      const field = page.locator(`[name="skill-${key}"]`);
      await field.scrollIntoViewIfNeeded();
      await expect(field).toBeVisible();
    }
    await page.locator('[name="intelPhaseConfirmed"]').check();
    await page.locator('[name="review"]').check();
    await page.getByLabel("GC review note", { exact: true }).fill("Original Intel choices checked");
    await page.locator("#confirm").scrollIntoViewIfNeeded();
    const rect = await page.locator("#confirm").boundingBox();
    expect(rect.y).toBeGreaterThanOrEqual(0);
    expect(rect.y + rect.height).toBeLessThanOrEqual(720);
    await page.locator("#confirm").click();
    await expect(page.locator("#confirm")).toBeFocused();
  } finally {
    content = prior;
    globalThis.game = oldGame;
  }
});

test("Modular's actual creation trade keeps every tree, review note and confirmation reachable at 720px", async ({
  page
}) => {
  const prior = content,
    oldGame = globalThis.game;
  try {
    globalThis.game = { user: { id: "gc", isGM: true }, settings: { get: () => ({}) } };
    const C = ActorProgression(class {});
    const a = Object.assign(new C(), {
      type: "agent",
      uuid: "Actor.modular-layout",
      isOwner: true,
      system: {
        level: 1,
        abilities: Object.fromEntries(["str", "dex", "con", "int", "wis", "cha"].map(k => [k, { base: 12 }])),
        progression: [{ classId: "test", skills: {}, vitality: 8 }]
      },
      flags: {
        spycraft2: {
          creationPolicy: creationPolicyRecord(
            { modularCreation: 1 },
            { confirmed: true, note: "Original campaign checked" }
          )
        }
      },
      items: [
        {
          id: "test",
          type: "class",
          name: "Test",
          system: {
            identifier: "test",
            table: [],
            bonuses: Object.keys(cfg.featTrees).map(tree => ({ target: `featSlots.${tree}`, value: "1", level: 1 }))
          }
        }
      ]
    });
    await a.configureModularCreation();
    await render(page, 720);
    await page.setViewportSize({ width: 1280, height: 720 });
    await page.getByLabel("Additional feats", { exact: true }).fill("2");
    for (const tree of Object.keys(cfg.featTrees)) {
      const input = page.locator(`[name="surrender-${tree}"]`);
      await input.scrollIntoViewIfNeeded();
      await expect(input).toBeVisible();
    }
    await page.getByLabel("Source or review note", { exact: true }).fill("Original creation sheet checked");
    await page.locator('[name="confirmed"]').check();
    await page.locator("#confirm").scrollIntoViewIfNeeded();
    const rect = await page.locator("#confirm").boundingBox();
    expect(rect.y).toBeGreaterThanOrEqual(0);
    expect(rect.y + rect.height).toBeLessThanOrEqual(720);
    await page.locator("#confirm").focus();
    await expect(page.locator("#confirm")).toBeFocused();
  } finally {
    content = prior;
    globalThis.game = oldGame;
  }
});
async function render(page, height, markup = content) {
  await page.setViewportSize({ width: 1100, height });
  await page.setContent(
    `<style>${css}\nbody{margin:0;font:16px sans-serif}dialog{display:block;position:fixed;left:50%;top:50%;transform:translate(-50%,-50%);width:560px;max-height:none;margin:0;padding:20px}form{display:flex;flex-direction:column;gap:12px}label{display:block;margin:6px 0}select,input{font-size:16px}footer{display:flex;justify-content:end}button{padding:10px}</style><dialog open><form><h2>Electronics</h2>${markup}<footer><button type="button" id="confirm">Confirm</button></footer></form></dialog>`
  );
  // Foundry keeps the initial top position when details expand; do not recenter the taller dialog.
  const initialTop = await page.locator("dialog").evaluate(el => el.getBoundingClientRect().top);
  await page.locator("dialog").evaluate((el, top) => {
    el.style.top = `${top}px`;
    el.style.transform = "translateX(-50%)";
  }, initialTop);
  await page.locator("details").evaluateAll(details =>
    details.forEach(detail => {
      detail.open = true;
    })
  );
}
for (const height of [800, 1000])
  test(`all expanded skill options scroll while confirmation remains reachable at ${height}px`, async ({ page }) => {
    await render(page, height);
    const options = page.locator(".spycraft2-roll-options");
    await expect(options).toHaveCount(1);
    expect(await options.evaluate(el => el.scrollHeight > el.clientHeight)).toBe(true);
    await page.locator("[name=secret]").scrollIntoViewIfNeeded();
    await page.locator("#confirm").scrollIntoViewIfNeeded();
    const rect = await page.locator("#confirm").boundingBox();
    expect(rect.y).toBeGreaterThanOrEqual(0);
    expect(rect.y + rect.height).toBeLessThanOrEqual(height);
    await page.locator("#confirm").click();
  });
test("negative control reproduces inaccessible confirmation without the options height limit", async ({ page }) => {
  await render(page, 800);
  await page.locator(".spycraft2-roll-options").evaluate(el => {
    el.style.maxHeight = "none";
    el.style.overflow = "visible";
  });
  const rect = await page.locator("#confirm").boundingBox();
  expect(rect.y < 0 || rect.y + rect.height > 800).toBe(true);
});

test("Cleave target controls contain long actor names and keep classification and confirmation reachable", async ({
  page
}) => {
  const { characterTargetContent } = await import("../../module/apps/character-target.mjs"),
    previous = globalThis.game,
    target = { uuid: "Actor.longTarget", type: "npc", name: "LongTargetName".repeat(100), isOwner: true },
    source = { system: { activeFeatNames: ["Cleave Mastery"] } };
  let samples;
  try {
    globalThis.game = { ...previous, user: { isGM: true, targets: new Set() }, actors: [target], combats: [] };
    samples = [
      characterTargetContent(source),
      characterTargetContent(source, { targetActorUuid: target.uuid }, { fixedTargetUuid: target.uuid })
    ];
  } finally {
    globalThis.game = previous;
  }
  for (const sample of samples) {
    await page.setViewportSize({ width: 1100, height: 800 });
    await page.setContent(
      `<style>${css}\nbody{margin:0;font:16px sans-serif}dialog{display:block;position:fixed;left:50%;top:50%;transform:translate(-50%,-50%);width:560px;margin:0;padding:20px}form{display:flex;flex-direction:column;gap:12px}footer{display:flex;justify-content:end}</style><dialog open><form><h2>Attack target</h2><div class="spycraft2-roll-options">${sample}</div><footer><button id="confirm" type="button">Confirm</button></footer></form></dialog>`
    );
    const options = page.locator(".spycraft2-roll-options");
    expect(await options.evaluate(el => el.scrollWidth <= el.clientWidth + 1)).toBe(true);
    await page.locator("[name=targetCharacterType]").scrollIntoViewIfNeeded();
    const rect = await page.locator("#confirm").boundingBox();
    expect(rect.y).toBeGreaterThanOrEqual(0);
    expect(rect.y + rect.height).toBeLessThanOrEqual(800);
    await page.locator("#confirm").click();
  }
});

test("Hard Core Influence fields remain usable with all skill options expanded", async ({ page }) => {
  const previous = content,
    source = new SpycraftActor();
  source.items = [];
  source.system = {
    activeFeatNames: ["Hard Core"],
    skillTotals: { impress: { name: "Impress", ability: "cha", totals: [{ ability: "cha", total: 3 }] } }
  };
  try {
    await source.rollSkill("impress");
    await render(page, 800);
    await page.locator("[name=hardCore]").check();
    await page.locator("[name=hardCoreTarget]").fill("QA watch officer");
    await page.locator("[name=hardCoreDisposition]").selectOption("hostile");
    await page.locator("[name=influenceDuration]").selectOption("slow");
    await page.locator("[name=hardCoreNPCConfirmed]").check();
    const options = page.locator(".spycraft2-roll-options");
    expect(await options.evaluate(el => el.scrollWidth <= el.clientWidth + 1)).toBe(true);
    await page.locator("#confirm").scrollIntoViewIfNeeded();
    const rect = await page.locator("#confirm").boundingBox();
    expect(rect.y).toBeGreaterThanOrEqual(0);
    expect(rect.y + rect.height).toBeLessThanOrEqual(800);
    await page.locator("#confirm").click();
  } finally {
    content = previous;
  }
});

test("Charmer and Hard Core declarations use distinct controls and keep confirmation reachable together", async ({
  page
}) => {
  const previous = content,
    source = new SpycraftActor();
  source.items = [];
  source.system = {
    activeFeatNames: ["Charmer", "Hard Core"],
    skillTotals: { impress: { name: "Impress", ability: "cha", totals: [{ ability: "cha", total: 3 }] } }
  };
  try {
    await source.rollSkill("impress");
    await render(page, 800);
    await page.locator("[name=charmer]").check();
    await page.locator("[name=charmerTarget]").fill("QA merchant");
    await page.locator("[name=charmerDisposition]").selectOption("friendly");
    await page.locator("[name=charmerDuration]").selectOption("slow");
    await page.locator("[name=charmerNPCConfirmed]").check();
    await expect(page.locator("[name=influenceDuration]")).toHaveCount(1);
    await expect(page.locator("[name=charmerDuration]")).toHaveCount(1);
    const options = page.locator(".spycraft2-roll-options");
    expect(await options.evaluate(el => el.scrollWidth <= el.clientWidth + 1)).toBe(true);
    await page.locator("#confirm").scrollIntoViewIfNeeded();
    const rect = await page.locator("#confirm").boundingBox();
    expect(rect.y).toBeGreaterThanOrEqual(0);
    expect(rect.y + rect.height).toBeLessThanOrEqual(800);
    await page.locator("#confirm").click();
  } finally {
    content = previous;
  }
});

test("pursuit role selectors remain distinct and reachable with every skill option expanded", async ({ page }) => {
  const previous = content,
    source = new SpycraftActor();
  source.items = [];
  source.system = {
    activeFeatNames: ["Escape and Evasion Training", "Always Get Your Man"],
    skillTotals: { survival: { name: "Survival", ability: "wis", totals: [{ ability: "wis", total: 3 }] } }
  };
  try {
    await source.rollSkill("survival");
    await render(page, 800);
    await expect(page.locator("[name=manhuntRole]")).toHaveCount(1);
    await expect(page.locator("[name=chaseRole]")).toHaveCount(1);
    await page.locator("[name=manhuntRole]").selectOption("prey");
    await page.locator("[name=chaseRole]").selectOption("predator");
    const options = page.locator(".spycraft2-roll-options");
    expect(await options.evaluate(el => el.scrollWidth <= el.clientWidth + 1)).toBe(true);
    await page.locator("#confirm").scrollIntoViewIfNeeded();
    const rect = await page.locator("#confirm").boundingBox();
    expect(rect.y).toBeGreaterThanOrEqual(0);
    expect(rect.y + rect.height).toBeLessThanOrEqual(800);
    await page.locator("#confirm").click();
  } finally {
    content = previous;
  }
});

test("free Maneuver and legal-action controls remain distinct, show the scene allowance and leave confirmation reachable", async ({
  page
}) => {
  await render(page, 800, wheelContent);
  await expect(page.locator("[name=wheelFreeManeuver]")).toHaveCount(1);
  await expect(page.locator("[name=wheelFreeActionConfirmed]")).toHaveCount(1);
  await expect(page.locator("body")).toContainText("2 / 2 uses this scene");
  await page.locator("[name=wheelFreeManeuver]").check();
  await page.locator("[name=wheelFreeActionConfirmed]").check();
  await page.locator("[name=oneHanded]").check();
  await page.locator("#confirm").scrollIntoViewIfNeeded();
  const b = await page.locator("#confirm").boundingBox();
  expect(b.y).toBeGreaterThanOrEqual(0);
  expect(b.y + b.height).toBeLessThanOrEqual(800);
});

test("Closed Course requires two distinct sight-line declarations with reachable synergy and confirmation controls", async ({
  page
}) => {
  await render(page, 800, courseContent);
  await expect(page.locator("[name=closedCourseSeesYou]")).toHaveCount(1);
  await expect(page.locator("[name=closedCourseSeesVehicle]")).toHaveCount(1);
  await page.locator("[name=closedCourseSeesYou]").check();
  await expect(page.locator("[name=closedCourseSeesVehicle]")).not.toBeChecked();
  await page.locator("[name=closedCourseSeesVehicle]").check();
  await page.locator("[name=synergySkill]").selectOption("drive");
  await page.locator("#confirm").scrollIntoViewIfNeeded();
  const b = await page.locator("#confirm").boundingBox();
  expect(b.y).toBeGreaterThanOrEqual(0);
  expect(b.y + b.height).toBeLessThanOrEqual(800);
});

test("Forensic Genius task declarations preserve challenge bounds and reachable confirmation", async ({ page }) => {
  await render(page, 800, forensicContent);
  await page.locator("[name=complexAnalysisTask]").check();
  const n = page.locator("[name=analysisBaseChallenges]");
  await expect(n).toHaveAttribute("min", "2");
  await expect(n).not.toHaveAttribute("max");
  await n.fill("16");
  await page.locator("#confirm").scrollIntoViewIfNeeded();
  const b = await page.locator("#confirm").boundingBox();
  expect(b.y).toBeGreaterThanOrEqual(0);
  expect(b.y + b.height).toBeLessThanOrEqual(800);
});

test("Complex Analysis Task controls keep creation, receipt settlement and confirmation reachable", async ({
  page
}) => {
  await render(page, 800, taskContent);
  await page.locator("[name=action]").selectOption("create");
  await page.locator("[name=title]").fill("Examine the recovered evidence");
  await page.locator("[name=baseChallenges]").fill("16");
  await expect(page.locator("[name=baseChallenges]")).not.toHaveAttribute("max");
  await page.locator("[name=unpressuredConfirmed]").check();
  await page.locator("[name=timeLimitSeconds]").fill("3600");
  await expect(page.locator("[name=deadlineElapsedConfirmed]")).toHaveCount(1);
  await page.locator("#confirm").scrollIntoViewIfNeeded();
  const b = await page.locator("#confirm").boundingBox();
  expect(b.y).toBeGreaterThanOrEqual(0);
  expect(b.y + b.height).toBeLessThanOrEqual(800);
  await expect(page.locator("[name=sourceEffectsResolved]")).toHaveCount(1);
  await expect(page.locator("[name=errorActivationDeclinedConfirmed]")).toHaveCount(1);
  await page.locator("[name=errorActivationDeclinedConfirmed]").check();
  await expect(page.locator("[name=sourceEffectsResolved]")).not.toBeChecked();
});

test("the real Resolve pressure dialog has a separate task section, Con check, actual DC and reachable confirmation", async ({
  page
}) => {
  await render(page, 800, pressureContent);
  await page.locator("[name=check]").selectOption("task-pressure");
  await page.locator("[name=analysisTaskId]").selectOption("task_layout");
  await page.locator("[name=taskChallengeDC]").fill("12");
  await page.locator("[name=taskChallengeDCConfirmed]").check();
  await expect(page.locator("summary").filter({ hasText: "Complex Analysis Task" })).toHaveCount(1);
  await page.locator("#confirm").scrollIntoViewIfNeeded();
  const b = await page.locator("#confirm").boundingBox();
  expect(b.y).toBeGreaterThanOrEqual(0);
  expect(b.y + b.height).toBeLessThanOrEqual(800);
});

test("frozen stress recovery displays the retained die and keeps the valid choice and confirmation reachable", async ({
  page
}) => {
  await render(page, 800, recoveryContent);
  await expect(page.locator("body")).toContainText("Frozen stress die: 4");
  await expect(page.locator("[name=action] option[value=reviewUndo]")).toHaveCount(0);
  await page.locator("[name=action]").selectOption("reviewKeep");
  await page.locator("[name=reason]").fill("Retain the actual stress die after checking the receipt.");
  await page.locator("[name=confirmed]").check();
  await page.locator("#confirm").scrollIntoViewIfNeeded();
  const b = await page.locator("#confirm").boundingBox();
  expect(b.y).toBeGreaterThanOrEqual(0);
  expect(b.y + b.height).toBeLessThanOrEqual(800);
});

test("Old School target qualification keeps its actual fields and confirmation reachable", async ({ page }) => {
  const previous = content;
  try {
    const { oldSchoolContext } = await import("../../module/apps/old-school.mjs");
    await oldSchoolContext({ system: { activeFeatNames: ["Old School"] } }, { ability: "cha", checkKind: "ability" });
    await render(page, 800, content);
    await page.locator("[name=apply]").check();
    await page.locator("[name=target]").fill("Veteran agent");
    await page.locator("[name=targetLevel]").fill("6");
    await page.locator("[name=missionThreatLevel]").fill("6");
    await page.locator("[name=sharedClassAbility]").fill("Accurate");
    await page.locator("[name=sharedFeats]").fill("Training\nCharmer\nCareer Agent");
    await page.locator("[name=confirmed]").check();
    const o = page.locator(".spycraft2-roll-options");
    expect(await o.evaluate(e => e.scrollWidth <= e.clientWidth + 1)).toBe(true);
    await page.locator("#confirm").scrollIntoViewIfNeeded();
    const b = await page.locator("#confirm").boundingBox();
    expect(b.y).toBeGreaterThanOrEqual(0);
    expect(b.y + b.height).toBeLessThanOrEqual(800);
  } finally {
    content = previous;
  }
});

test("Mark lists three independent skill choices and its GC disclosure keeps confirmation reachable", async ({
  page
}) => {
  const previous = content;
  try {
    const { useMark, discloseMark } = await import("../../module/apps/mark.mjs"),
      actor = { type: "agent", isOwner: true, flags: {}, system: {}, uuid: "Actor.markLayout" };
    await useMark(actor);
    const declaration = content;
    const record = {
      id: "mark_layout",
      version: 1,
      source: "Mark",
      target: "A veteran character",
      skills: ["athletics", "drive", "resolve"],
      lineOfSightConfirmed: true,
      freeActionConfirmed: true,
      session: "s",
      limitAtUse: 1,
      use: { epoch: "s", used: 1 },
      at: 126,
      disclosure: null
    };
    actor.flags = { spycraft2: { markObservations: { mark_layout: record } } };
    await discloseMark(actor, record.id);
    const disclosure = content;
    await render(page, 800, declaration);
    for (const [i, k] of ["athletics", "drive", "resolve"].entries())
      await page.locator("[name=skill" + (i + 1) + "]").selectOption(k);
    await page.locator("[name=target]").fill("Veteran character");
    await page.locator("[name=lineOfSightConfirmed]").check();
    await page.locator("[name=freeActionConfirmed]").check();
    await render(page, 800, disclosure);
    for (const k of record.skills) {
      await page.locator("[name=bonus_" + k + "]").fill("5");
      await page.locator("[name=context_" + k + "]").fill("Current normal total");
    }
    await page.locator("[name=confirmed]").check();
    await page.locator("#confirm").scrollIntoViewIfNeeded();
    const b = await page.locator("#confirm").boundingBox();
    expect(b.y).toBeGreaterThanOrEqual(0);
    expect(b.y + b.height).toBeLessThanOrEqual(800);
  } finally {
    content = previous;
  }
});

test("fire-stress mode and the existing defense controls keep the full damage dialog scrollable", async ({ page }) => {
  const previous = content;
  try {
    const { applyAccumulatedDamage } = await import("../../module/apps/damage-ledger.mjs");
    await applyAccumulatedDamage({
      type: "agent",
      isOwner: true,
      system: {
        activeFeatNames: ["Firefighter Training"],
        accumulatedDamage: { version: 1, revision: 1, stress: 0, subdual: 0, pending: [] },
        survivalStats: { resistances: { stress: 2 }, resistanceSources: [] }
      },
      flags: {}
    });
    await render(page, 800, content);
    await page.locator("[name=damageMode]").selectOption("fireStressBeforeDefenses");
    await page.locator("[name=newDamage]").fill("13");
    await expect(page.locator("body")).toContainText("not the underlying fire damage");
    await page.locator("[name=confirmed]").check();
    await page.locator("#confirm").scrollIntoViewIfNeeded();
    const b = await page.locator("#confirm").boundingBox();
    expect(b.y).toBeGreaterThanOrEqual(0);
    expect(b.y + b.height).toBeLessThanOrEqual(800);
  } finally {
    content = previous;
  }
});

test("Jinx activation choice, payer funding and final confirmation stay reachable in the actual critical dialog", async ({
  page
}) => {
  const previous = content,
    actors = game.actors;
  try {
    const a = new SpycraftActor(),
      b = new SpycraftActor();
    for (const [x, id] of [
      [a, "actingLayout"],
      [b, "payerLayout"]
    ]) {
      x.uuid = "Actor." + id;
      x.id = id;
      x.name = id;
      x.type = "agent";
      x.isOwner = true;
      x.flags = {};
      x.items = [];
      x.system = {
        activeFeatNames: ["Jinx"],
        activeFeatSelections: [{ tree: "chance" }, { tree: "chance" }],
        actionDice: { value: 0, max: 3, die: 4 },
        resourceUses: {}
      };
    }
    game.actors = [a, b];
    await a.activateCritical({
      uuid: "ChatMessage.layout",
      flags: {
        spycraft2: {
          actorUuid: a.uuid,
          checkKind: "skill",
          skillKey: "mechanics",
          checkId: "repair",
          errorConfirmed: true
        }
      }
    });
    await render(page, 800, content);
    await page.locator("[name=jinx]").check();
    await page.locator("[name=payerId]").selectOption(b.id);
    await page.locator("[name=baseCost]").fill("1");
    await page.locator("[name=effect]").fill("GC-confirmed failure effect");
    await page.locator("[name=effectConfirmed]").check();
    await page.locator("[name=opponent]").check();
    await page.locator("[name=lineOfSight]").check();
    await page.locator("#confirm").scrollIntoViewIfNeeded();
    const bnd = await page.locator("#confirm").boundingBox();
    expect(bnd.y).toBeGreaterThanOrEqual(0);
    expect(bnd.y + bnd.height).toBeLessThanOrEqual(800);
  } finally {
    content = previous;
    game.actors = actors;
  }
});

test("Forensics task scope remains explicit beside the pressure and deadline choices", async ({ page }) => {
  await render(page, 800, taskContent);
  await page.locator("[name=forensicsOnlyConfirmed]").check();
  await page.locator("[name=baseChallenges]").fill("6");
  await page.locator("[name=unpressuredConfirmed]").check();
  await expect(page.locator("body")).toContainText("every recorded Challenge uses Forensics");
  await expect(page.locator("body")).toContainText("Apply both reductions before the minimum 1");
  await page.locator("#confirm").scrollIntoViewIfNeeded();
  const b = await page.locator("#confirm").boundingBox();
  expect(b.y).toBeGreaterThanOrEqual(0);
  expect(b.y + b.height).toBeLessThanOrEqual(800);
});

test("both actual Complex Analysis inputs reject one unmodified Challenge and accept two before reductions", async ({
  page
}) => {
  for (const [html, name] of [
    [forensicContent, "analysisBaseChallenges"],
    [taskContent, "baseChallenges"]
  ]) {
    await render(page, 800, html);
    const n = page.locator("[name=" + name + "]");
    await n.fill("1");
    expect(await n.evaluate(e => e.validity.rangeUnderflow)).toBe(true);
    await n.fill("2");
    expect(await n.evaluate(e => e.checkValidity())).toBe(true);
    await n.fill("100");
    expect(await n.evaluate(e => e.checkValidity())).toBe(true);
  }
});

test("disease and poison resistance controls on the actual save dialog keep confirmation reachable", async ({
  page
}) => {
  const previous = content,
    locale = game.i18n;
  game.i18n = { localize: s => s };
  try {
    for (const key of ["fort", "ref", "will"]) {
      const a = new SpycraftActor();
      a.system = {
        activeFeatNames: ["Disease Basics", "Poison Basics", "Swamp Training", "Firefighter Training"],
        conditionContext: { baffled: true },
        mentalLeapState: { fatigueSaveBonus: 2 }
      };
      await a.rollSave(key, { askContext: true });
      await render(page, 800, content);
      await page.locator("[name=disease]").check();
      await page.locator("[name=poison]").check();
      await page.locator("#confirm").scrollIntoViewIfNeeded();
      const b = await page.locator("#confirm").boundingBox();
      expect(b.y).toBeGreaterThanOrEqual(0);
      expect(b.y + b.height).toBeLessThanOrEqual(800);
    }
  } finally {
    content = previous;
    game.i18n = locale;
  }
});

test("Superior Documentation cover-identity declaration remains usable with all Bluff options expanded", async ({
  page
}) => {
  const previous = content,
    a = new SpycraftActor();
  a.items = [];
  a.system = {
    activeFeatNames: ["Superior Documentation"],
    skillTotals: { bluff: { name: "Bluff", ability: "cha", totals: [{ ability: "cha", total: 5 }] } }
  };
  try {
    await a.rollSkill("bluff");
    await render(page, 800, content);
    await page.locator("[name=usingCoverIdentity]").check();
    await page.locator("[name=coverIdentityName]").fill("Dr. Jane Carter");
    await page.locator("[name=coverIdentityConfirmed]").check();
    await page.locator("#confirm").scrollIntoViewIfNeeded();
    const b = await page.locator("#confirm").boundingBox();
    expect(b.y).toBeGreaterThanOrEqual(0);
    expect(b.y + b.height).toBeLessThanOrEqual(800);
    expect(await page.locator(".spycraft2-roll-options").evaluate(el => el.scrollWidth <= el.clientWidth + 1)).toBe(
      true
    );
  } finally {
    content = previous;
  }
});

test("both Bug Basics Stash Item declarations remain usable with expanded skill options", async ({ page }) => {
  const previous = content;
  try {
    for (const key of ["sleightOfHand", "sneak"]) {
      const a = new SpycraftActor();
      a.items = [];
      a.system = {
        activeFeatNames: ["Bug Basics"],
        skillTotals: { [key]: { name: cfg.skills[key].name, ability: "dex", totals: [{ ability: "dex", total: 5 }] } }
      };
      await a.rollSkill(key);
      await render(page, 800, content);
      await page.locator("[name=check]").selectOption("stash-item");
      await page.locator("[name=concealingBug]").check();
      await page.locator("[name=bugName]").fill("Button microphone");
      await page.locator("[name=bugConcealmentConfirmed]").check();
      await page.locator("#confirm").scrollIntoViewIfNeeded();
      const b = await page.locator("#confirm").boundingBox();
      expect(b.y).toBeGreaterThanOrEqual(0);
      expect(b.y + b.height).toBeLessThanOrEqual(800);
    }
  } finally {
    content = previous;
  }
});

test("distinct Threaten action and response controls keep participants, range, ready weapon and confirmation reachable", async ({
  page
}) => {
  const previous = content;
  try {
    for (const [key, id] of [
      ["intimidate", "threaten"],
      ["resolve", "resist-threaten"]
    ]) {
      const a = new SpycraftActor();
      a.items = [];
      a.system = {
        activeFeatNames: ["CQB Basics", "CQB Mastery"],
        readiedRangedWeapons: [{ id: "gun", name: "Readied pistol" }],
        skillTotals: {
          [key]: {
            name: cfg.skills[key].name,
            ability: "wis",
            totals: cfg.skills[key].abilities.map(ability => ({ ability, total: 5 }))
          }
        }
      };
      await a.rollSkill(key);
      await render(page, 800, content);
      await page.locator("[name=check]").selectOption(id);
      await page.locator("[name=threatenOpponentName]").fill("Opposing guard");
      await page.locator("[name=threatenOpponentConfirmed]").check();
      await page.locator("[name=threatenContextConfirmed]").check();
      await page.locator("[name=threatenWeaponId]").selectOption("gun");
      if (key === "intimidate") {
        await page.locator("[name=threatenDistanceFeet]").fill("30");
        await page.locator("[name=threatenVitalityLoss]").fill("5");
        await page.locator("[name=threatenInjuryFromYourAttacksConfirmed]").check();
      } else await page.locator("[name=threatenIncomingLegalConfirmed]").check();
      await page.locator("#confirm").scrollIntoViewIfNeeded();
      const b = await page.locator("#confirm").boundingBox();
      expect(b.y).toBeGreaterThanOrEqual(0);
      expect(b.y + b.height).toBeLessThanOrEqual(800);
    }
  } finally {
    content = previous;
  }
});

test("terrain cover controls remain usable in the actual Reflex, incoming Defense and Superior Cover dialogs", async ({
  page
}) => {
  const previous = content,
    locale = game.i18n;
  game.i18n = { localize: s => s };
  try {
    const a = new SpycraftActor();
    a.items = [];
    a.flags = {};
    a.type = "agent";
    a.isOwner = true;
    a.system = { activeFeatNames: ["Home Turf", "Aquatic Training", "Superior Cover"], superiorCover: null };
    const { checkIncomingDefense } = await import("../../module/apps/incoming-defense.mjs"),
      { declareSuperiorCover } = await import("../../module/apps/superior-cover.mjs");
    for (const open of [
      () => a.rollSave("ref", { askContext: true }),
      () => checkIncomingDefense(a),
      () => declareSuperiorCover(a)
    ]) {
      await open();
      await render(page, 800, content);
      await page.locator("[name=sceneryCover]").selectOption("1");
      await page.locator("[name=homeTurfCover]").check();
      await page.locator("[name=partialSubmersionCover]").check();
      await page.locator("[name=terrainCoverConfirmed]").check();
      await page.locator("#confirm").scrollIntoViewIfNeeded();
      const b = await page.locator("#confirm").boundingBox();
      expect(b.y).toBeGreaterThanOrEqual(0);
      expect(b.y + b.height).toBeLessThanOrEqual(800);
    }
  } finally {
    content = previous;
    game.i18n = locale;
  }
});

test("opposing character source controls keep target selection and confirmation reachable on all three skill tabs", async ({
  page
}) => {
  const previous = content,
    actors = game.actors,
    user = game.user;
  game.user = { isGM: true };
  game.actors = [
    {
      id: "target",
      uuid: "Actor.target",
      name: "Observed target",
      type: "agent",
      isOwner: true,
      system: {
        activeFeatNames: ["Silver Tongue", "Zeroed"],
        abilities: { cha: { mod: 3 } },
        activeFeatSelections: [{ name: "Zeroed", tree: "covert" }]
      }
    }
  ];
  try {
    for (const key of ["senseMotive", "analysis", "investigation"]) {
      const a = new SpycraftActor();
      a.items = [];
      a.system = {
        skillTotals: {
          [key]: {
            name: cfg.skills[key].name,
            ability: cfg.skills[key].abilities[0],
            totals: cfg.skills[key].abilities.map(ability => ({ ability, total: 5 }))
          }
        }
      };
      await a.rollSkill(key);
      await render(page, 800, content);
      await page.locator("[name=targetSkillActorUuid]").selectOption("Actor.target");
      await page.locator("[name=targetSkillConfirmed]").check();
      await page.locator("#confirm").scrollIntoViewIfNeeded();
      const b = await page.locator("#confirm").boundingBox();
      expect(b.y).toBeGreaterThanOrEqual(0);
      expect(b.y + b.height).toBeLessThanOrEqual(800);
    }
  } finally {
    content = previous;
    game.actors = actors;
    game.user = user;
  }
});

test("Faceless target purpose and confirmation stay reachable on a general skill dialog", async ({ page }) => {
  const previous = content,
    actors = game.actors,
    user = game.user;
  game.user = { isGM: true };
  game.actors = [
    {
      id: "target",
      uuid: "Actor.target",
      name: "Faceless target",
      type: "agent",
      isOwner: true,
      system: { activeFeatNames: ["Faceless"] }
    }
  ];
  try {
    const key = "bureaucracy",
      a = new SpycraftActor();
    a.items = [];
    a.system = {
      skillTotals: {
        [key]: {
          name: cfg.skills[key].name,
          ability: cfg.skills[key].abilities[0],
          totals: cfg.skills[key].abilities.map(ability => ({ ability, total: 5 }))
        }
      }
    };
    await a.rollSkill(key);
    await render(page, 768, content);
    await page.locator("[name=targetSkillActorUuid]").selectOption("Actor.target");
    await page.locator("[name=targetSkillPurpose]").selectOption("past");
    await page.locator("[name=targetSkillConfirmed]").check();
    await page.locator("#confirm").scrollIntoViewIfNeeded();
    const b = await page.locator("#confirm").boundingBox();
    expect(b.y).toBeGreaterThanOrEqual(0);
    expect(b.y + b.height).toBeLessThanOrEqual(768);
  } finally {
    content = previous;
    game.actors = actors;
    game.user = user;
  }
});

test("Silver Tongue victory, correction and mission-end recovery dialogs keep their declarations and confirmation reachable", async ({
  page
}) => {
  const previous = content,
    actors = game.actors,
    user = game.user;
  game.user = { id: "GC", isGM: true };
  const source = {
      type: "agent",
      isOwner: true,
      uuid: "Actor.source",
      name: "Silver source",
      flags: {},
      system: { activeFeatNames: ["Silver Tongue"], usagePeriods: { mission: "mission1" } }
    },
    target = {
      type: "agent",
      isOwner: true,
      uuid: "Actor.target",
      name: "Target",
      flags: {},
      system: { abilities: { wis: { value: 8 } }, usagePeriods: { mission: "mission1" } }
    };
  game.actors = [source, target];
  try {
    const { silverVictoryPlan } = await import("../../module/rules/silver-tongue.mjs"),
      { settleSilverTongueVictory, correctSilverTongueVictory, recoverSilverTongueAtMissionEnd } =
        await import("../../module/apps/silver-tongue.mjs");
    await settleSilverTongueVictory(source);
    await render(page, 768, content);
    await page.locator("[name=targetActorUuid]").selectOption(target.uuid);
    await page.locator("[name=conflictId]").fill("mission1-seduction1");
    await page.locator("[name=victoryConfirmed]").check();
    await page.locator("[name=sourceAtVictoryConfirmed]").check();
    await page.locator("#confirm").scrollIntoViewIfNeeded();
    let b = await page.locator("#confirm").boundingBox();
    expect(b.y).toBeGreaterThanOrEqual(0);
    expect(b.y + b.height).toBeLessThanOrEqual(768);
    const p = silverVictoryPlan(source.system, target.system, {
      sourceActorUuid: source.uuid,
      targetActorUuid: target.uuid,
      targetName: target.name,
      conflictId: "seduction1",
      victoryConfirmed: true,
      sourceAtVictoryConfirmed: true,
      confirmedBy: "GC",
      worldTime: 126
    });
    source.flags = { spycraft2: { silverTongueVictories: { [p.record.id]: p.record } } };
    for (const open of [
      () => correctSilverTongueVictory(source, p.record.id),
      () => recoverSilverTongueAtMissionEnd(target)
    ]) {
      await open();
      await render(page, 768, content);
      await page.locator("[name=confirmed]").check();
      await page.locator("#confirm").scrollIntoViewIfNeeded();
      b = await page.locator("#confirm").boundingBox();
      expect(b.y).toBeGreaterThanOrEqual(0);
      expect(b.y + b.height).toBeLessThanOrEqual(768);
    }
  } finally {
    content = previous;
    game.actors = actors;
    game.user = user;
  }
});

test("Ghost Basics Hide target types and GC confirmation remain usable in the expanded actual Sneak dialog", async ({
  page
}) => {
  const previous = content;
  try {
    const a = new SpycraftActor();
    a.items = [];
    a.system = {
      activeFeatNames: ["Ghost Basics"],
      skillTotals: {
        sneak: {
          name: cfg.skills.sneak.name,
          ability: "dex",
          totals: cfg.skills.sneak.abilities.map(ability => ({ ability, total: 5 }))
        }
      }
    };
    await a.rollSkill("sneak");
    await render(page, 768, content);
    await page.locator("[name=check]").selectOption("hide");
    await page.locator("[name=ghostHideTargetKind]").selectOption("both");
    await page.locator("[name=ghostHideTargetName]").fill("Security camera and living guard");
    await page.locator("[name=ghostHideConfirmed]").check();
    await page.locator("#confirm").scrollIntoViewIfNeeded();
    const b = await page.locator("#confirm").boundingBox();
    expect(b.y).toBeGreaterThanOrEqual(0);
    expect(b.y + b.height).toBeLessThanOrEqual(768);
  } finally {
    content = previous;
  }
});

test("ordinary and Ghost Hide ground movement controls keep counted route and legal-action confirmations reachable", async ({
  page
}) => {
  const previous = content;
  try {
    for (const activeFeatNames of [[], ["Ghost Basics", "Ghost Mastery", "Ghost Supremacy"]]) {
      const a = new SpycraftActor();
      a.items = [];
      a.system = {
        activeFeatNames,
        skillTotals: {
          sneak: {
            name: cfg.skills.sneak.name,
            ability: "dex",
            totals: cfg.skills.sneak.abilities.map(ability => ({ ability, total: 5 }))
          }
        }
      };
      await a.rollSkill("sneak");
      await render(page, 768, content);
      await page.locator("[name=check]").selectOption("hide");
      await page.locator("[name=hideMovement]").check();
      await page.locator("[name=hideDistanceFeet]").fill(activeFeatNames.length ? "60" : "30");
      await page.locator("[name=hideRouteConfirmed]").check();
      await page.locator("[name=hideActionConfirmed]").check();
      await page.locator("#confirm").scrollIntoViewIfNeeded();
      const b = await page.locator("#confirm").boundingBox();
      expect(b.y).toBeGreaterThanOrEqual(0);
      expect(b.y + b.height).toBeLessThanOrEqual(768);
    }
  } finally {
    content = previous;
  }
});

test("both actual observer-distraction dialogs keep target, grade and GC confirmation reachable", async ({ page }) => {
  const previous = content,
    actors = game.actors,
    user = game.user;
  game.user = { id: "GC", isGM: true };
  game.actors = [
    {
      type: "agent",
      isOwner: true,
      uuid: "Actor.target",
      name: "Covert target",
      system: { activeFeatNames: ["Ghost Mastery"] }
    }
  ];
  try {
    for (const key of ["notice", "search"]) {
      const a = new SpycraftActor();
      a.items = [];
      a.system = {
        skillTotals: {
          [key]: {
            name: cfg.skills[key].name,
            ability: cfg.skills[key].abilities[0],
            totals: cfg.skills[key].abilities.map(ability => ({ ability, total: 5 }))
          }
        }
      };
      await a.rollSkill(key);
      await render(page, 768, content);
      await page.locator("[name=check]").selectOption(key === "notice" ? "awareness" : "perception");
      await page.locator("[name=detectionDistraction]").selectOption("major");
      await page.locator("[name=detectionActorUuid]").selectOption("Actor.target");
      await page.locator("[name=detectionConfirmed]").check();
      await page.locator("#confirm").scrollIntoViewIfNeeded();
      const b = await page.locator("#confirm").boundingBox();
      expect(b.y).toBeGreaterThanOrEqual(0);
      expect(b.y + b.height).toBeLessThanOrEqual(768);
    }
  } finally {
    content = previous;
    game.actors = actors;
    game.user = user;
  }
});

test("Ghost attacker cover stays distinct from defender cover and all incoming-Defense controls remain reachable", async ({
  page
}) => {
  const previous = content,
    actors = game.actors,
    user = game.user;
  game.user = { id: "GC", isGM: true };
  const defender = {
      id: "defender",
      uuid: "Actor.defender",
      name: "Defender",
      type: "agent",
      isOwner: true,
      system: {}
    },
    ghost = {
      id: "ghost",
      uuid: "Actor.ghost",
      name: "Ghost attacker",
      type: "agent",
      isOwner: true,
      items: [],
      system: { activeFeatNames: ["Ghost Mastery", "Ghost Supremacy"] }
    };
  game.actors = [ghost, defender];
  try {
    const { checkIncomingDefense } = await import("../../module/apps/incoming-defense.mjs");
    await checkIncomingDefense(defender);
    await render(page, 768, content);
    await page.locator("[name=ghostCoverDeclared]").check();
    await page.locator("[name=ghostActorUuid]").selectOption(ghost.uuid);
    await page.locator("[name=ghostHidden]").check();
    await page.locator("[name=ghostSceneryCover]").selectOption("2");
    await page.locator("[name=ghostVisibleMaterial]").fill("24.9");
    await page.locator("[name=ghostDisturbingMovement]").fill("5");
    await page.locator("[name=ghostCoverConfirmed]").check();
    await expect(page.locator("body")).toContainText("separate from this character’s defensive cover");
    await page.locator("[name=sceneryCover]").selectOption("1");
    await page.locator("[name=coupDeGraceExceptionSource]").fill("GC-confirmed ability");
    await page.locator("#confirm").scrollIntoViewIfNeeded();
    const b = await page.locator("#confirm").boundingBox();
    expect(b.y).toBeGreaterThanOrEqual(0);
    expect(b.y + b.height).toBeLessThanOrEqual(768);
    expect(await page.locator(".spycraft2-roll-options").evaluate(el => el.scrollWidth <= el.clientWidth + 1)).toBe(
      true
    );
  } finally {
    content = previous;
    game.actors = actors;
    game.user = user;
  }
});

test("Hide crowd and hiding-place declarations keep confirmation reachable alongside all expanded Sneak options", async ({
  page
}) => {
  const previous = content;
  try {
    const a = new SpycraftActor();
    a.items = [];
    a.system = {
      activeFeatNames: ["Ghost Supremacy"],
      skillTotals: {
        sneak: {
          name: cfg.skills.sneak.name,
          ability: "dex",
          totals: cfg.skills.sneak.abilities.map(ability => ({ ability, total: 5 }))
        }
      }
    };
    await a.rollSkill("sneak");
    await render(page, 768, content);
    await page.locator("[name=check]").selectOption("hide");
    await page.locator("[name=hideCircumstances]").check();
    await page.locator("[name=hideAreaPeople]").fill("10");
    await page.locator("[name=hideApparentPlace]").uncheck();
    await page.locator("[name=hideLocationKnown]").check();
    await page.locator("[name=hideDistractionOpportunity]").check();
    await page.locator("[name=hideCircumstancesConfirmed]").check();
    await expect(page.locator("body")).toContainText("chooses the normal key attribute automatically");
    await page.locator("#confirm").scrollIntoViewIfNeeded();
    const b = await page.locator("#confirm").boundingBox();
    expect(b.y).toBeGreaterThanOrEqual(0);
    expect(b.y + b.height).toBeLessThanOrEqual(768);
  } finally {
    content = previous;
  }
});

test("Balance surface row, movement and cumulative modifiers remain reachable with all Acrobatics options expanded", async ({
  page
}) => {
  const previous = content;
  try {
    const a = new SpycraftActor();
    a.items = [];
    a.system = {
      activeFeatNames: ["Equilibrium Basics", "Equilibrium Mastery"],
      skillTotals: {
        acrobatics: {
          name: cfg.skills.acrobatics.name,
          ability: "dex",
          totals: cfg.skills.acrobatics.abilities.map(ability => ({ ability, total: 5 }))
        }
      }
    };
    await a.rollSkill("acrobatics");
    await render(page, 768, content);
    await page.locator("[name=check]").selectOption("balance");
    await page.locator("[name=balanceCircumstances]").check();
    await page.locator("[name=balanceSurface]").selectOption("narrowUnder1");
    await page.locator("[name=balanceDistanceFeet]").fill("30");
    await page.locator("[name=balanceBuckled]").check();
    await page.locator("[name=balanceSlippery]").check();
    await page.locator("[name=balanceConfirmed]").check();
    await expect(page.locator("body")).toContainText("receipt lists the DC and number of checks");
    await page.locator("#confirm").scrollIntoViewIfNeeded();
    const b = await page.locator("#confirm").boundingBox();
    expect(b.y).toBeGreaterThanOrEqual(0);
    expect(b.y + b.height).toBeLessThanOrEqual(768);
  } finally {
    content = previous;
  }
});

test("Falling distance and soft-landing declarations remain reachable with expanded Acrobatics options", async ({
  page
}) => {
  const previous = content;
  try {
    const a = new SpycraftActor();
    a.items = [];
    a.system = {
      activeFeatNames: ["Equilibrium Basics"],
      skillTotals: {
        acrobatics: {
          name: cfg.skills.acrobatics.name,
          ability: "dex",
          totals: cfg.skills.acrobatics.abilities.map(ability => ({ ability, total: 5 }))
        }
      }
    };
    await a.rollSkill("acrobatics");
    await render(page, 768, content);
    await page.locator("[name=check]").selectOption("falling");
    await page.locator("[name=fallDeclared]").check();
    await page.locator("[name=fallDistanceFeet]").fill("50");
    await page.locator("[name=fallSoftSurface]").check();
    await page.locator("[name=fallConfirmed]").check();
    await expect(page.locator("body")).toContainText("post impact and stress cards");
    await page.locator("#confirm").scrollIntoViewIfNeeded();
    const b = await page.locator("#confirm").boundingBox();
    expect(b.y).toBeGreaterThanOrEqual(0);
    expect(b.y + b.height).toBeLessThanOrEqual(768);
  } finally {
    content = previous;
  }
});

test("the distinct Resist Trip response keeps opponent, actual Size and legality confirmation reachable", async ({
  page
}) => {
  const previous = content;
  try {
    const a = new SpycraftActor();
    a.items = [];
    a.system = {
      activeFeatNames: ["Equilibrium Mastery"],
      skillTotals: {
        acrobatics: {
          name: cfg.skills.acrobatics.name,
          ability: "dex",
          totals: cfg.skills.acrobatics.abilities.map(ability => ({ ability, total: 5 }))
        }
      }
    };
    await a.rollSkill("acrobatics");
    await render(page, 768, content);
    await page.locator("[name=check]").selectOption("resist-trip");
    await page.locator("[name=tripOpponentName]").fill("Adjacent attacker");
    await page.locator("[name=tripAdjacent]").check();
    await page.locator("[name=tripSizeDifference]").fill("1");
    await page.locator("[name=tripIncomingConfirmed]").check();
    await expect(page.locator("body")).toContainText("current Covert-count dodge bonus unless you are vulnerable");
    await page.locator("#confirm").scrollIntoViewIfNeeded();
    const b = await page.locator("#confirm").boundingBox();
    expect(b.y).toBeGreaterThanOrEqual(0);
    expect(b.y + b.height).toBeLessThanOrEqual(768);
  } finally {
    content = previous;
  }
});

test("Tumble path counts, movement and route confirmation remain reachable with all Acrobatics options expanded", async ({
  page
}) => {
  const previous = content;
  try {
    const a = new SpycraftActor();
    a.items = [];
    a.system = {
      activeFeatNames: ["Equilibrium Mastery"],
      skillTotals: {
        acrobatics: {
          name: cfg.skills.acrobatics.name,
          ability: "dex",
          totals: cfg.skills.acrobatics.abilities.map(ability => ({ ability, total: 5 }))
        }
      }
    };
    await a.rollSkill("acrobatics");
    await render(page, 768, content);
    await page.locator("[name=check]").selectOption("tumble");
    await page.locator("[name=tumbleCircumstances]").check();
    await page.locator("[name=tumbleDistanceFeet]").fill("30");
    await page.locator("[name=tumbleAdjacentEnemySquares]").fill("2");
    await page.locator("[name=tumbleOccupiedSquares]").fill("3");
    await page.locator("[name=tumbleRouteConfirmed]").check();
    await expect(page.locator("body")).toContainText("enemy suppressive fire");
    await page.locator("#confirm").scrollIntoViewIfNeeded();
    const b = await page.locator("#confirm").boundingBox();
    expect(b.y).toBeGreaterThanOrEqual(0);
    expect(b.y + b.height).toBeLessThanOrEqual(768);
  } finally {
    content = previous;
  }
});

test("earned Still Standing shows a Fortitude-only attack-takedown purpose and GC confirmation", async ({ page }) => {
  const previous = content,
    locale = game.i18n;
  game.i18n = { localize: s => s };
  try {
    const a = new SpycraftActor();
    a.system = {
      classLevels: { brawler: 3 },
      classOptionSelections: [{ classId: "brawler", name: "Still Standing", level: 3 }],
      activeFeatNames: [],
      conditionContext: {}
    };
    await a.rollSave("fort", { askContext: true });
    await render(page, 768, content);
    await page.locator("[name=resistingTakedown]").check();
    await page.locator("[name=takedownAttackConfirmed]").check();
    await expect(page.locator("body")).toContainText("takedown-quality attack");
    await page.locator("#confirm").scrollIntoViewIfNeeded();
    const b = await page.locator("#confirm").boundingBox();
    expect(b.y).toBeGreaterThanOrEqual(0);
    expect(b.y + b.height).toBeLessThanOrEqual(768);
  } finally {
    content = previous;
    game.i18n = locale;
  }
});

test("the on-foot Bull Rush response keeps named opponent, contact, Size and legality controls reachable", async ({
  page
}) => {
  const previous = content;
  try {
    const a = new SpycraftActor();
    a.items = [];
    a.system = {
      activeFeatNames: [],
      skillTotals: {
        athletics: {
          name: cfg.skills.athletics.name,
          ability: "str",
          totals: cfg.skills.athletics.abilities.map(ability => ({ ability, total: 5 }))
        }
      }
    };
    await a.rollSkill("athletics");
    await render(page, 768, content);
    await page.locator("[name=check]").selectOption("resist-bull-rush");
    await page.locator("[name=bullRushOpponentName]").fill("Rushing opponent");
    await page.locator("[name=bullRushSizeDifference]").fill("1");
    await page.locator("[name=bullRushOnFootConfirmed]").check();
    await page.locator("[name=bullRushContactConfirmed]").check();
    await page.locator("[name=bullRushIncomingConfirmed]").check();
    await expect(page.locator("body")).toContainText("chosen target with both characters on foot");
    await page.locator("#confirm").scrollIntoViewIfNeeded();
    const b = await page.locator("#confirm").boundingBox();
    expect(b.y).toBeGreaterThanOrEqual(0);
    expect(b.y + b.height).toBeLessThanOrEqual(768);
  } finally {
    content = previous;
  }
});

test("the reachable on-foot Bull Rush attack keeps route, full-action and contact confirmations reachable", async ({
  page
}) => {
  const previous = content;
  try {
    const a = new SpycraftActor();
    a.items = [];
    a.system = {
      activeFeatNames: [],
      skillTotals: {
        athletics: {
          name: cfg.skills.athletics.name,
          ability: "str",
          totals: cfg.skills.athletics.abilities.map(ability => ({ ability, total: 5 }))
        }
      }
    };
    await a.rollSkill("athletics");
    await render(page, 768, content);
    await page.locator("[name=check]").selectOption("bull-rush");
    await page.locator("[name=bullRushAttackOpponentName]").fill("Non-threatening target");
    await page.locator("[name=bullRushAttackSizeDifference]").fill("1");
    await page.locator("[name=bullRushAttackDistanceFeet]").fill("30");
    for (const name of [
      "bullRushAttackOnFootConfirmed",
      "bullRushAttackRouteConfirmed",
      "bullRushAttackContactConfirmed",
      "bullRushAttackFullActionConfirmed"
    ])
      await page.locator("[name=" + name + "]").check();
    await expect(page.locator("body")).toContainText("chosen target’s threatening adjacency does not stop");
    await page.locator("#confirm").scrollIntoViewIfNeeded();
    const b = await page.locator("#confirm").boundingBox();
    expect(b.y).toBeGreaterThanOrEqual(0);
    expect(b.y + b.height).toBeLessThanOrEqual(768);
  } finally {
    content = previous;
  }
});

test("all four conveyance Bull Rush profiles keep current Size/allowance and control confirmations reachable", async ({
  page
}) => {
  const previous = content;
  try {
    for (const key of ["acrobatics", "drive", "survival", "tactics"]) {
      const a = new SpycraftActor();
      a.items = [];
      a.system = {
        activeFeatNames: [],
        skillTotals: {
          [key]: {
            name: cfg.skills[key].name,
            ability: cfg.skills[key].abilities[0],
            totals: cfg.skills[key].abilities.map(ability => ({ ability, total: 5 }))
          }
        }
      };
      await a.rollSkill(key);
      await render(page, 768, content);
      await page.locator("[name=check]").selectOption("conveyance-bull-rush");
      await page.locator("[name=focus]").fill("Standard Ground Vehicles");
      await page.locator("[name=conveyanceBullRushName]").fill("GC conveyance");
      await page.locator("[name=conveyanceBullRushTargetName]").fill("GC target");
      await page.locator("[name=conveyanceBullRushSize]").selectOption("Large");
      await page.locator("[name=conveyanceBullRushTargetSize]").selectOption("Medium");
      await page.locator("[name=conveyanceBullRushAllowanceFeet]").fill("50");
      await page.locator("[name=conveyanceBullRushDistanceFeet]").fill("50");
      await page.locator("[name=conveyanceBullRushTargetThreatening]").check();
      for (const suffix of ["Control", "Stats", "Route", "Contact", "FullAction"])
        await page.locator("[name=conveyanceBullRush" + suffix + "Confirmed]").check();
      await expect(page.locator("body")).toContainText("Armor Check Penalty is ignored");
      await page.locator("#confirm").scrollIntoViewIfNeeded();
      const b = await page.locator("#confirm").boundingBox();
      expect(b.y).toBeGreaterThanOrEqual(0);
      expect(b.y + b.height).toBeLessThanOrEqual(768);
    }
  } finally {
    content = previous;
  }
});

test("actual quick ranged Aim, Brace and action controls remain unique and reachable at768px", async ({ page }) => {
  const previous = content,
    source = new SpycraftActor();
  source.items = [];
  source.system = { activeFeatNames: [], classLevels: {} };
  try {
    await source.rollAttack(
      { id: "quick-layout", name: "Quick ranged layout", type: "weapon", system: { proficiency: "rifle" } },
      { askContext: true }
    );
    const markup = content;
    await render(page, 768, markup);
    await expect(page.locator("[name=aimed]")).toHaveCount(1);
    await expect(page.locator("[name=attackAction]")).toHaveCount(1);
    await page.locator("[name=attackAction]").selectOption("standard");
    await page.locator("[name=aimed]").check();
    for (const name of ["braced", "stableSurface"]) {
      await expect(page.locator("[name=" + name + "]")).toHaveCount(1);
      await page.locator("[name=" + name + "]").check();
    }
    expect(await page.locator(".spycraft2-roll-options").evaluate(el => el.scrollWidth <= el.clientWidth + 1)).toBe(
      true
    );
    await page.locator("#confirm").scrollIntoViewIfNeeded();
    const b = await page.locator("#confirm").boundingBox();
    expect(b.y).toBeGreaterThanOrEqual(0);
    expect(b.y + b.height).toBeLessThanOrEqual(768);
    await page.locator("#confirm").click();
  } finally {
    content = previous;
  }
});

test("targeted Resist Disarm keeps source, incoming proficiency, Size and confirmation controls usable at768px", async ({
  page
}) => {
  const { disarmResponseContent } = await import("../../module/apps/disarm-response.mjs"),
    source = {
      system: { size: "Medium", activeFeatNames: [] },
      items: [
        {
          id: "target",
          name: "Target sword",
          type: "weapon",
          system: {
            proficiency: "edged",
            sizeHands: "T/1h",
            qualities: "SUR",
            equipped: true,
            carried: true,
            quantity: 1
          }
        }
      ]
    };
  await render(page, 768, disarmResponseContent(source, "target"));
  for (const name of [
    "weaponId",
    "opponentLabel",
    "opponentWeaponSize",
    "opponentCharacterSize",
    "incomingRanged",
    "incomingProficient",
    "lineOfSightConfirmed",
    "rangeConfirmed",
    "confirmed"
  ])
    await expect(page.locator("[name=" + name + "]")).toHaveCount(1);
  await page.locator("[name=opponentLabel]").fill("Adjacent attacker");
  await page.locator("[name=opponentWeaponSize]").selectOption("Unarmed");
  await page.locator("[name=opponentCharacterSize]").selectOption("Medium");
  for (const name of ["incomingProficient", "lineOfSightConfirmed", "rangeConfirmed", "confirmed"])
    await page.locator("[name=" + name + "]").check();
  expect(await page.locator(".spycraft2-roll-options").evaluate(el => el.scrollWidth <= el.clientWidth + 1)).toBe(true);
  await page.locator("#confirm").scrollIntoViewIfNeeded();
  const b = await page.locator("#confirm").boundingBox();
  expect(b.y).toBeGreaterThanOrEqual(0);
  expect(b.y + b.height).toBeLessThanOrEqual(768);
});

test("ordinary Feint and response dialogs keep eligibility, hand controls and confirmation reachable at768px", async ({
  page
}) => {
  const previous = content;
  try {
    for (const key of ["sleightOfHand", "notice"]) {
      const source = new SpycraftActor();
      source.items = [];
      source.system = {
        activeFeatNames: [],
        skillTotals: {
          [key]: {
            name: cfg.skills[key].name,
            ability: key === "notice" ? "wis" : "dex",
            totals: cfg.skills[key].abilities.map(ability => ({ ability, total: 3 }))
          }
        }
      };
      await source.rollSkill(key);
      await render(page, 768);
      await page.locator("[name=check]").selectOption(key === "notice" ? "resist-feint" : "feint");
      for (const name of ["feintOpponentName", "feintAdjacent", "feintTargetEligibleConfirmed", "feintLegalConfirmed"])
        await expect(page.locator(`[name=${name}]`)).toHaveCount(1);
      await page.locator("[name=feintOpponentName]").fill("Adjacent QA opponent");
      for (const name of ["feintAdjacent", "feintTargetEligibleConfirmed", "feintLegalConfirmed"]) {
        await page.locator(`[name=${name}]`).scrollIntoViewIfNeeded();
        await page.locator(`[name=${name}]`).check();
      }
      await page.locator("[name=oneHanded]").scrollIntoViewIfNeeded();
      await page.locator("[name=oneHanded]").check();
      const options = page.locator(".spycraft2-roll-options");
      expect(await options.evaluate(el => el.scrollWidth <= el.clientWidth + 1)).toBe(true);
      await page.locator("#confirm").scrollIntoViewIfNeeded();
      const rect = await page.locator("#confirm").boundingBox();
      expect(rect.y).toBeGreaterThanOrEqual(0);
      expect(rect.y + rect.height).toBeLessThanOrEqual(768);
      await page.locator("#confirm").click();
    }
  } finally {
    content = previous;
  }
});

test("Cheap Shot attack and outcome controls keep target, weakness and confirmation reachable at768px", async ({
  page
}) => {
  const previous = content,
    oldGame = globalThis.game;
  try {
    const { rollCheapShot } = await import("../../module/apps/cheap-shot.mjs"),
      { manageCheapShots } = await import("../../module/apps/cheap-shot-effects.mjs");
    const source = {
      uuid: "Actor.attacker",
      type: "agent",
      isOwner: true,
      items: [{ id: "flail", type: "weapon", name: "Reviewed flail", system: { equipped: true } }],
      system: { activeFeatNames: [], cheapShots: [] },
      usagePeriods: { scene: "sceneA" }
    };
    globalThis.game = {
      ...oldGame,
      user: { isGM: true },
      actors: [{ uuid: "Actor.target", type: "agent", name: "Actual opponent", isOwner: true }],
      messages: []
    };
    await rollCheapShot(source);
    await render(page, 768);
    await page.locator("[name=cheapShotTargetUuid]").selectOption("Actor.target");
    await page.locator("[name=cheapShotChoice]").selectOption("speed");
    for (const name of ["eligibleConfirmed", "confirmed"]) {
      await page.locator(`[name=${name}]`).scrollIntoViewIfNeeded();
      await page.locator(`[name=${name}]`).check();
    }
    await expect(page.locator("[name=cheapShotChoice] option")).toHaveCount(7);
    const rect = await page.locator("#confirm").boundingBox();
    expect(rect.y).toBeGreaterThanOrEqual(0);
    expect(rect.y + rect.height).toBeLessThanOrEqual(768);
    await manageCheapShots(source);
    await render(page, 768);
    await expect(page.locator("[name=operation]")).toHaveCount(1);
    await page.locator("#confirm").scrollIntoViewIfNeeded();
    const outcome = await page.locator("#confirm").boundingBox();
    expect(outcome.y + outcome.height).toBeLessThanOrEqual(768);
  } finally {
    content = previous;
    globalThis.game = oldGame;
  }
});

test("miss-triggered Double Twirl/Remiss control keeps source, same opponent and timing confirmations reachable at768px", async ({
  page
}) => {
  const previous = content,
    oldGame = game;
  try {
    const { takeMissTrick } = await import("../../module/apps/miss-tricks.mjs"),
      source = {
        uuid: "Actor.source",
        type: "agent",
        isOwner: true,
        system: { activeFeatNames: ["Flail Basics", "Fencing Basics"] },
        mentalLeapCombatContext: () => ({
          id: "combat",
          round: 1,
          started: true,
          turn: 0,
          combatantId: "own",
          ownTurnIndex: 0
        })
      };
    globalThis.game = {
      ...oldGame,
      user: { isGM: true },
      actors: [{ uuid: "Actor.target", type: "npc", name: "Same actual opponent", isOwner: true }],
      messages: [],
      combats: []
    };
    await takeMissTrick(source);
    await render(page, 768);
    await page.locator("[name=trick]").selectOption("remiss");
    await page.locator("[name=opponentUuid]").selectOption("Actor.target");
    for (const name of ["sameTargetConfirmed", "immediateConfirmed", "attackLegalConfirmed", "legacySourceConfirmed"]) {
      await page.locator(`[name=${name}]`).scrollIntoViewIfNeeded();
      await page.locator(`[name=${name}]`).check();
    }
    await expect(page.locator("[name=trick] option")).toHaveCount(2);
    await page.locator("#confirm").scrollIntoViewIfNeeded();
    const rect = await page.locator("#confirm").boundingBox();
    expect(rect.y).toBeGreaterThanOrEqual(0);
    expect(rect.y + rect.height).toBeLessThanOrEqual(768);
  } finally {
    content = previous;
    globalThis.game = oldGame;
  }
});

test("ordinary melee Gear quick dialog offers one actual target and Standard Attack choice without ranged Aim/Brace controls", async ({
  page
}) => {
  const previous = content,
    oldGame = game;
  try {
    const source = new SpycraftActor();
    source.uuid = "Actor.quickMelee";
    source.system = {
      activeFeatNames: [],
      proficiencyTotals: { edged: { proficient: true } },
      size: "Medium",
      classLevels: {},
      abilities: { str: { value: 12, mod: 1 }, dex: { value: 12, mod: 1 } }
    };
    source.items = [];
    const w = {
      id: "sword",
      type: "weapon",
      name: "Actual sword",
      system: {
        proficiency: "edged",
        equipped: true,
        carried: true,
        sizeHands: "T/1h",
        qualities: "",
        range: 0,
        error: 1,
        threat: 20
      }
    };
    globalThis.game = {
      ...oldGame,
      user: { isGM: true },
      actors: [{ uuid: "Actor.actualTarget", type: "npc", name: "Observed opponent", isOwner: true }],
      combats: []
    };
    await source.rollAttack(w, { askContext: true });
    await render(page, 768);
    await expect(page.locator("[name=targetActorUuid]")).toHaveCount(1);
    await expect(page.locator("[name=attackAction]")).toHaveCount(1);
    await expect(page.locator("[name=aimed],[name=braced]")).toHaveCount(0);
    await page.locator("[name=targetActorUuid]").selectOption("Actor.actualTarget");
    await page.locator("[name=attackAction]").selectOption("standard");
    await page.locator("#confirm").scrollIntoViewIfNeeded();
    const rect = await page.locator("#confirm").boundingBox();
    expect(rect.y).toBeGreaterThanOrEqual(0);
    expect(rect.y + rect.height).toBeLessThanOrEqual(768);
  } finally {
    content = previous;
    globalThis.game = oldGame;
  }
});

test("combat stance and fixed Punishing damage dialogs keep confirmation reachable at768px", async ({ page }) => {
  const previous = content,
    oldGame = game;
  try {
    const { declareCombatStance, managePunishingDamage } = await import("../../module/apps/combat-stance.mjs"),
      source = { uuid: "Actor.stance", type: "agent", isOwner: true, system: { activeFeatNames: ["Flail Basics"] } };
    await declareCombatStance(source);
    await render(page, 768);
    await page.locator("[name=stance]").selectOption("punishing");
    for (const name of ["halfActionConfirmed", "legalConfirmed"]) await page.locator(`[name=${name}]`).check();
    await page.locator("#confirm").scrollIntoViewIfNeeded();
    let rect = await page.locator("#confirm").boundingBox();
    expect(rect.y + rect.height).toBeLessThanOrEqual(768);
    globalThis.game = {
      ...oldGame,
      messages: [
        {
          uuid: "ChatMessage.punishingLayout",
          flags: {
            spycraft2: {
              actorUuid: source.uuid,
              checkKind: "attack",
              resolved: true,
              successConfirmed: true,
              attackContext: {
                ranged: false,
                combatStance: {
                  version: 1,
                  stance: { version: 1, key: "punishing", id: "punishingLayout", feat: "Flail Basics" }
                }
              }
            }
          }
        }
      ],
      user: { isGM: true }
    };
    await managePunishingDamage(source);
    await render(page, 768);
    await page.locator("[name=damageConfirmed]").check();
    await page.locator("#confirm").scrollIntoViewIfNeeded();
    rect = await page.locator("#confirm").boundingBox();
    expect(rect.y + rect.height).toBeLessThanOrEqual(768);
  } finally {
    content = previous;
    globalThis.game = oldGame;
  }
});

test("paired Feint outcome control keeps both receipts and opposed/tie confirmations reachable at768px", async ({
  page
}) => {
  const previous = content,
    oldGame = game;
  try {
    const { manageFeintOutcomes } = await import("../../module/apps/feint-outcomes.mjs");
    globalThis.game = { ...oldGame, messages: [], user: { isGM: true } };
    await manageFeintOutcomes({ uuid: "Actor.feint", isOwner: true });
    await render(page, 768);
    for (const name of ["actingMessage", "defendingMessage"])
      await expect(page.locator(`[name=${name}]`)).toHaveCount(1);
    for (const name of ["opposedConfirmed", "tieResolvedConfirmed"]) {
      await page.locator(`[name=${name}]`).scrollIntoViewIfNeeded();
      await page.locator(`[name=${name}]`).check();
    }
    await page.locator("#confirm").scrollIntoViewIfNeeded();
    const rect = await page.locator("#confirm").boundingBox();
    expect(rect.y + rect.height).toBeLessThanOrEqual(768);
  } finally {
    content = previous;
    globalThis.game = oldGame;
  }
});

test("interrupted Feint attack review uses opponent/round labels and keeps the GC confirmation reachable at768px", async ({
  page
}) => {
  const previous = content,
    oldGame = game;
  try {
    const { reviewFeintBonuses } = await import("../../module/apps/feint-bonus.mjs");
    globalThis.game = {
      ...oldGame,
      user: { isGM: true },
      actors: [{ uuid: "Actor.opponent", type: "npc", isOwner: true, name: "Recorded opponent" }]
    };
    await reviewFeintBonuses({
      uuid: "Actor.owner",
      isOwner: true,
      system: {
        feintBonuses: [
          {
            version: 1,
            sourceMessage: "ChatMessage.source",
            defenderMessage: "ChatMessage.defender",
            targetUuid: "Actor.opponent",
            combatId: "combat",
            madeRound: 3,
            dueRound: 4,
            sourceEvidence: ["a", "b"],
            usedBy: "internal-attempt",
            receiptUuid: null
          }
        ]
      }
    });
    await render(page, 768);
    await expect(page.locator("[name=attemptId] option")).toHaveText("Recorded opponent · Feint round 3");
    await page.locator("[name=confirmed]").check();
    await page.locator("#confirm").scrollIntoViewIfNeeded();
    const rect = await page.locator("#confirm").boundingBox();
    expect(rect.y + rect.height).toBeLessThanOrEqual(768);
  } finally {
    content = previous;
    globalThis.game = oldGame;
  }
});

test("Side Stance entry, round-total review and capped route controls remain reachable at768px", async ({ page }) => {
  const previous = content,
    oldGame = game;
  try {
    const { declareCombatStance } = await import("../../module/apps/combat-stance.mjs"),
      { reviewStanceMovement } = await import("../../module/apps/stance-movement.mjs"),
      { checkCombatMovement } = await import("../../module/apps/combat-movement.mjs"),
      clock = { id: "combat", combatantId: "own", started: true, round: 3, turn: 0, ownTurnIndex: 0 },
      source = {
        uuid: "Actor.side",
        type: "agent",
        isOwner: true,
        system: {
          activeFeatNames: ["Fencing Basics"],
          speed: 30,
          canRun: true,
          wounds: { value: 12 },
          abilities: Object.fromEntries(["str", "dex", "con", "int", "wis", "cha"].map(k => [k, { value: 12, mod: 1 }]))
        },
        mentalLeapCombatContext: () => clock
      };
    globalThis.game = { ...oldGame, time: { worldTime: 126 } };
    await declareCombatStance(source);
    await render(page, 768);
    await page.locator("[name=stance]").selectOption("side");
    await page.locator("[name=roundMovementFeet]").fill("5");
    for (const name of ["roundMovementConfirmed", "halfActionConfirmed", "legalConfirmed"]) {
      await page.locator(`[name=${name}]`).scrollIntoViewIfNeeded();
      await page.locator(`[name=${name}]`).check();
    }
    await page.locator("#confirm").scrollIntoViewIfNeeded();
    let rect = await page.locator("#confirm").boundingBox();
    expect(rect.y + rect.height).toBeLessThanOrEqual(768);
    source.system.combatStance = { version: 1, key: "side", id: "side" };
    source.system.stanceRoundMovement = { version: 1, key: "combat:3", feet: 5 };
    await reviewStanceMovement(source);
    await render(page, 768);
    await page.locator("[name=roundMovementFeet]").fill("15");
    await page.locator("[name=roundMovementConfirmed]").check();
    await page.locator("#confirm").scrollIntoViewIfNeeded();
    rect = await page.locator("#confirm").boundingBox();
    expect(rect.y + rect.height).toBeLessThanOrEqual(768);
    await checkCombatMovement(source);
    await render(page, 768);
    await page.locator("[name=distanceFeet]").fill("20");
    await page.locator("[name=stanceDistanceFeet]").fill("10");
    await page.locator("[name=routeConfirmed]").check();
    await page.locator("#confirm").scrollIntoViewIfNeeded();
    rect = await page.locator("#confirm").boundingBox();
    expect(rect.y + rect.height).toBeLessThanOrEqual(768);
  } finally {
    content = previous;
    globalThis.game = oldGame;
  }
});

test("recorded Side Stance hit is selected in the actual damage dialog with combined sneak controls accessible at768px", async ({
  page
}) => {
  const previous = content,
    oldGame = game;
  try {
    const { rollEvidence } = await import("../../module/rules/outcomes.mjs"),
      source = new SpycraftActor();
    source.uuid = "Actor.sideDamage";
    source.isOwner = true;
    const weapon = {
        id: "sword",
        uuid: source.uuid + ".Item.sword",
        type: "weapon",
        name: "Sword",
        system: { proficiency: "edged", damage: "1d6" }
      },
      target = { uuid: "Actor.opponent", type: "agent", isOwner: true, name: "Recorded Feint opponent", system: {} };
    source.items = [weapon];
    source.items.get = id => source.items.find(i => i.id === id);
    const stance = { version: 1, id: "oldSide", key: "side", name: "Side Stance", feat: "Fencing Basics" },
      a = {
        actorUuid: source.uuid,
        checkKind: "skill",
        resolved: true,
        successConfirmed: true,
        feint: { version: 3, combatStance: { version: 1, stance } }
      },
      b = { actorUuid: target.uuid, checkKind: "skill", resolved: true, successConfirmed: false },
      settlement = {
        sideBenefitVersion: 1,
        attackerWon: true,
        winnerUuid: source.uuid,
        defenderUuid: target.uuid,
        sourceMessage: "ChatMessage.feint",
        defenderMessage: "ChatMessage.notice",
        sourceEvidence: [rollEvidence(a), rollEvidence(b)]
      };
    a.feintSettlement = settlement;
    b.feintSettlement = settlement;
    const proof = {
        version: 1,
        stanceId: "oldSide",
        targetUuid: target.uuid,
        sourceMessages: ["ChatMessage.feint"],
        dice: 1,
        attemptId: "attack"
      },
      hit = {
        uuid: "ChatMessage.hit",
        flags: {
          spycraft2: {
            actorUuid: source.uuid,
            checkKind: "attack",
            resolved: true,
            successConfirmed: true,
            weaponUuid: weapon.uuid,
            weaponProficiency: "edged",
            rollCombat: { id: "combat", round: 3 },
            attackContext: { sideStance: proof, ranged: false, attackAction: "standard", targetActorUuid: target.uuid }
          }
        }
      };
    source.system = {
      activeFeatNames: ["Fencing Basics"],
      sideStanceDamageUses: [],
      sideStanceFeints: [
        {
          version: 1,
          sourceMessage: "ChatMessage.feint",
          defenderMessage: "ChatMessage.notice",
          stanceId: "oldSide",
          targetUuid: target.uuid,
          sourceEvidence: settlement.sourceEvidence,
          usedBy: "attack",
          receiptUuid: hit.uuid
        }
      ]
    };
    globalThis.game = {
      ...oldGame,
      user: { isGM: true },
      actors: [target],
      messages: [
        { uuid: "ChatMessage.feint", flags: { spycraft2: a } },
        { uuid: "ChatMessage.notice", flags: { spycraft2: b } },
        hit
      ]
    };
    await source.rollDamage(weapon);
    await render(page, 768);
    await expect(page.locator("[name=sideStanceSourceUuid]")).toHaveValue(hit.uuid);
    await expect(page.locator("[name=includeSneakAttack]")).toBeChecked();
    await expect(page.locator("[name=successfulStandardAttack]")).toBeChecked();
    await expect(page.locator("[name=targetCharacter]")).toBeChecked();
    await page.locator("[name=targetVulnerable]").check();
    await page.locator("[name=targetVitalsConfirmed]").check();
    await page.locator("#confirm").scrollIntoViewIfNeeded();
    const rect = await page.locator("#confirm").boundingBox();
    expect(rect.y + rect.height).toBeLessThanOrEqual(768);
  } finally {
    content = previous;
    globalThis.game = oldGame;
  }
});

test("unified Feint review distinguishes Side attack and damage reservations without exposing raw IDs at768px", async ({
  page
}) => {
  const previous = content,
    oldGame = game;
  try {
    const { reviewFeintBenefits } = await import("../../module/apps/feint-review.mjs");
    globalThis.game = {
      ...oldGame,
      user: { isGM: true },
      actors: [{ uuid: "Actor.opponent", type: "agent", isOwner: true, name: "Recorded opponent" }]
    };
    await reviewFeintBenefits({
      uuid: "Actor.owner",
      isOwner: true,
      system: {
        sideStanceFeints: [
          {
            version: 1,
            sourceMessage: "ChatMessage.feint",
            defenderMessage: "ChatMessage.notice",
            stanceId: "stance",
            targetUuid: "Actor.opponent",
            sourceEvidence: ["a", "b"],
            usedBy: "sideAttempt",
            receiptUuid: null
          }
        ],
        sideStanceDamageUses: [
          {
            version: 1,
            rootAttackUuid: "ChatMessage.hit",
            attackUuid: "ChatMessage.hit",
            reservationId: "damageAttempt",
            targetUuid: "Actor.opponent",
            weaponUuid: "Actor.owner.Item.sword",
            sourceEvidence: "proof",
            receiptUuid: null
          }
        ]
      }
    });
    await render(page, 768);
    await expect(page.locator("[name=attemptId] option")).toHaveCount(2);
    await expect(page.locator("[name=attemptId] option").first()).toHaveText("Side Stance attack — Recorded opponent");
    await page.locator("[name=attemptId]").selectOption("damage:damageAttempt");
    await page.locator("[name=confirmed]").check();
    await page.locator("#confirm").scrollIntoViewIfNeeded();
    const rect = await page.locator("#confirm").boundingBox();
    expect(rect.y + rect.height).toBeLessThanOrEqual(768);
  } finally {
    content = previous;
    globalThis.game = oldGame;
  }
});

test("Stalking Stance exposes its actual combat bonus and reviewed cap controls at768px", async ({ page }) => {
  const previous = content,
    oldGame = game;
  try {
    const { declareCombatStance } = await import("../../module/apps/combat-stance.mjs"),
      source = {
        type: "agent",
        isOwner: true,
        system: { activeFeatNames: ["Garrote Basics"] },
        mentalLeapCombatContext: () => null
      };
    globalThis.game = { ...oldGame, time: { worldTime: 126 } };
    await declareCombatStance(source);
    await render(page, 768);
    await page.locator("[name=stance]").selectOption("stalking");
    await expect(page.locator("body")).toContainText("+3 to Sneak checks made while participating in started combat");
    await page.locator("[name=roundMovementFeet]").fill("15");
    for (const name of ["roundMovementConfirmed", "halfActionConfirmed", "legalConfirmed"]) {
      await page.locator(`[name=${name}]`).scrollIntoViewIfNeeded();
      await page.locator(`[name=${name}]`).check();
    }
    await page.locator("#confirm").scrollIntoViewIfNeeded();
    const rect = await page.locator("#confirm").boundingBox();
    expect(rect.y + rect.height).toBeLessThanOrEqual(768);
  } finally {
    content = previous;
    globalThis.game = oldGame;
  }
});

test("Gripping Stance entry and its ranged-exit explanation remain reachable at768px", async ({ page }) => {
  const previous = content,
    oldGame = game;
  try {
    const { declareCombatStance } = await import("../../module/apps/combat-stance.mjs"),
      source = {
        type: "agent",
        isOwner: true,
        system: { activeFeatNames: ["Spear Basics"] },
        mentalLeapCombatContext: () => null
      };
    globalThis.game = { ...oldGame, time: { worldTime: 126 } };
    await declareCombatStance(source);
    await render(page, 768);
    await page.locator("[name=stance]").selectOption("gripping");
    await expect(page.locator("body")).toContainText("use a two-handed weapon in one hand, with −2 on attack checks");
    await expect(page.locator("[name=roundMovementFeet]")).toHaveCount(0);
    for (const name of ["halfActionConfirmed", "legalConfirmed"]) {
      await page.locator(`[name=${name}]`).scrollIntoViewIfNeeded();
      await page.locator(`[name=${name}]`).check();
    }
    await page.locator("#confirm").scrollIntoViewIfNeeded();
    const rect = await page.locator("#confirm").boundingBox();
    expect(rect.y + rect.height).toBeLessThanOrEqual(768);
  } finally {
    content = previous;
    globalThis.game = oldGame;
  }
});

test("Sharpshooter incoming preview exposes an actual ranged source and reachable cover/Size result at768px", async ({
  page
}) => {
  const previous = content,
    oldGame = game,
    oldInput = foundry.applications.api.DialogV2.input,
    oldUI = globalThis.ui;
  let result = "";
  try {
    const { checkIncomingDefense } = await import("../../module/apps/incoming-defense.mjs"),
      weapon = { id: "gun", type: "weapon", name: "Pistol", system: { proficiency: "handgun" } },
      attacker = {
        id: "sharp",
        uuid: "Actor.sharp",
        isOwner: true,
        name: "Sharpshooter",
        system: { activeFeatNames: ["Sharpshooter Basics"] },
        items: [weapon]
      },
      target = {
        type: "agent",
        isOwner: true,
        system: {
          sizeModifier: 1,
          classLevels: {},
          defense: { total: 15, dexterity: 3 },
          abilities: { dex: { mod: 3 } }
        }
      };
    attacker.items.get = id => attacker.items.find(i => i.id === id);
    const actors = [attacker];
    actors.get = id => actors.find(a => a.id === id);
    globalThis.game = { ...oldGame, user: { isGM: true }, actors };
    globalThis.ui = {
      notifications: {
        warn: m => {
          throw Error(m);
        }
      }
    };
    foundry.applications.api.DialogV2.input = async o => {
      if (o.window.title === "Incoming attack — Defense") {
        content = o.content;
        return { ranged: true, coverAttacker: "sharp:gun", coverOpponent: true, personalCover: "2", sceneryCover: "0" };
      }
      result = o.content;
      return null;
    };
    const p = await checkIncomingDefense(target);
    expect(p.total).toBe(16);
    await render(page, 768);
    await page.locator("[name=coverAttacker]").selectOption("sharp:gun");
    await page.locator("[name=coverOpponent]").scrollIntoViewIfNeeded();
    await page.locator("[name=coverOpponent]").check();
    await page.locator("#confirm").scrollIntoViewIfNeeded();
    let rect = await page.locator("#confirm").boundingBox();
    expect(rect.y + rect.height).toBeLessThanOrEqual(768);
    content = result;
    await render(page, 768);
    await expect(page.locator("body")).toContainText("Size Defense bonus +1 becomes +0");
    await page.locator("#confirm").scrollIntoViewIfNeeded();
    rect = await page.locator("#confirm").boundingBox();
    expect(rect.y + rect.height).toBeLessThanOrEqual(768);
  } finally {
    content = previous;
    globalThis.game = oldGame;
    foundry.applications.api.DialogV2.input = oldInput;
    globalThis.ui = oldUI;
  }
});

test("All-out Attack quick melee declaration keeps its bounded penalty and target visible at768px", async ({
  page
}) => {
  const previous = content,
    oldGame = game;
  try {
    const a = new SpycraftActor();
    a.uuid = "Actor.allOut";
    a.items = [];
    a.system = { activeFeatNames: ["All-out Attack"], abilities: { str: { mod: 2 } } };
    globalThis.game = { ...oldGame, actors: [] };
    await a.rollAttack({ system: { proficiency: "edged" } }, { askContext: true });
    await render(page, 768);
    await page.locator("[name=allOutPenalty]").fill("3");
    expect(await page.locator("[name=allOutPenalty]").getAttribute("max")).toBe("4");
    await page.locator("#confirm").scrollIntoViewIfNeeded();
    const r = await page.locator("#confirm").boundingBox();
    expect(r.y + r.height).toBeLessThanOrEqual(768);
  } finally {
    content = previous;
    globalThis.game = oldGame;
  }
});

test("recorded All-Out hit is selected in the actual damage dialog and keeps the exact target and bonus controls reachable", async ({
  page
}) => {
  const previous = content,
    oldGame = game;
  try {
    const a = new SpycraftActor();
    a.uuid = "Actor.allOutDamage";
    a.isOwner = true;
    const w = {
        id: "sword",
        uuid: a.uuid + ".Item.sword",
        type: "weapon",
        name: "Sword",
        system: { proficiency: "edged", damage: "1d6" }
      },
      target = { uuid: "Actor.opponent", type: "agent", isOwner: true, name: "Recorded target", system: {} },
      m = {
        uuid: "ChatMessage.allOut",
        flags: {
          spycraft2: {
            actorUuid: a.uuid,
            checkKind: "attack",
            resolved: true,
            successConfirmed: true,
            weaponUuid: w.uuid,
            weaponProficiency: "edged",
            attackContext: {
              ranged: false,
              targetActorUuid: target.uuid,
              meleeTradeoff: {
                version: 1,
                source: "All-out Attack",
                weaponId: w.id,
                targetUuid: target.uuid,
                penalty: 2,
                maximum: 4,
                attackPenalty: -2,
                damageBonus: 4
              }
            }
          }
        }
      };
    a.items = [w];
    a.items.get = id => a.items.find(i => i.id === id);
    a.system = { activeFeatNames: ["All-out Attack"] };
    globalThis.game = { ...oldGame, user: { isGM: true }, actors: [target], messages: [m] };
    await a.rollDamage(w);
    await render(page, 768);
    await expect(page.locator("[name=attackDamageSourceUuid]")).toHaveValue(m.uuid);
    await expect(page.locator("[name=targetActorUuid]")).toHaveValue(target.uuid);
    await expect(page.locator("body")).toContainText("All-out Attack +4");
    await page.locator("#confirm").scrollIntoViewIfNeeded();
    const r = await page.locator("#confirm").boundingBox();
    expect(r.y + r.height).toBeLessThanOrEqual(768);
  } finally {
    content = previous;
    globalThis.game = oldGame;
  }
});

test("All-Out miss and interrupted damage review controls keep confirmation reachable without exposing raw identifiers as labels", async ({
  page
}) => {
  const previous = content,
    oldGame = game;
  try {
    const { manageMeleeTradeoff } = await import("../../module/apps/melee-tradeoff-outcomes.mjs"),
      a = {
        uuid: "Actor.allOut",
        isOwner: true,
        system: {
          attackDamageUses: [
            {
              version: 1,
              rootAttackUuid: "ChatMessage.hit",
              attackUuid: "ChatMessage.hit",
              reservationId: "privateId",
              targetUuid: "Actor.target",
              weaponUuid: "Actor.allOut.Item.sword",
              sourceEvidence: "evidence",
              receiptUuid: null
            }
          ]
        }
      },
      m = {
        uuid: "ChatMessage.miss",
        flags: {
          spycraft2: {
            actorUuid: a.uuid,
            checkKind: "attack",
            resolved: true,
            successConfirmed: false,
            attackContext: { ranged: false, meleeTradeoff: { source: "All-out Attack", penalty: 2 } },
            rollCombat: { round: 2 }
          }
        }
      };
    globalThis.game = { ...oldGame, user: { isGM: true }, messages: [m] };
    await manageMeleeTradeoff(a);
    await render(page, 768);
    await expect(page.locator("body")).toContainText("Apply flat-footed: All-out Attack miss in round 2");
    await expect(page.locator("body")).not.toContainText("privateId");
    await page.locator("[name=confirmed]").check();
    await page.locator("#confirm").scrollIntoViewIfNeeded();
    const r = await page.locator("#confirm").boundingBox();
    expect(r.y + r.height).toBeLessThanOrEqual(768);
  } finally {
    content = previous;
    globalThis.game = oldGame;
  }
});

test("Bullseye quick ranged declaration keeps its exact one-shot confirmation and bounded penalty reachable at768px", async ({
  page
}) => {
  const previous = content,
    oldGame = game;
  try {
    const a = new SpycraftActor();
    a.uuid = "Actor.bullseye";
    a.items = [];
    a.system = { activeFeatNames: ["Bullseye"], abilities: { dex: { mod: 2 } } };
    globalThis.game = { ...oldGame, actors: [] };
    await a.rollAttack({ system: { proficiency: "handgun" } }, { askContext: true });
    await render(page, 768);
    await page.locator("[name=attackAction]").selectOption("standard");
    await page.locator("[name=bullseyePenalty]").fill("3");
    expect(await page.locator("[name=bullseyePenalty]").getAttribute("max")).toBe("4");
    await page.locator("[name=bullseyeSingleShotConfirmed]").scrollIntoViewIfNeeded();
    await page.locator("[name=bullseyeSingleShotConfirmed]").check();
    await page.locator("#confirm").scrollIntoViewIfNeeded();
    const r = await page.locator("#confirm").boundingBox();
    expect(r.y + r.height).toBeLessThanOrEqual(768);
  } finally {
    content = previous;
    globalThis.game = oldGame;
  }
});

test("Bullseye recorded-hit damage picker supplies its actual target and equal bonus at768px", async ({ page }) => {
  const previous = content,
    oldGame = game;
  try {
    const { bullseyeDamageSourceFacts } = await import("../../module/rules/bullseye.mjs"),
      a = new SpycraftActor();
    a.uuid = "Actor.bullseyeDamage";
    a.isOwner = true;
    a.type = "agent";
    const w = {
        id: "pistol",
        uuid: a.uuid + ".Item.pistol",
        type: "weapon",
        name: "Pistol",
        system: { proficiency: "handgun", weaponCategory: "servicePistol", damage: "2d6" }
      },
      target = { uuid: "Actor.opponent", type: "agent", isOwner: true, name: "Recorded opponent", system: {} },
      p = {
        version: 1,
        source: "Bullseye",
        weaponId: w.id,
        targetUuid: target.uuid,
        penalty: 2,
        maximum: 4,
        attackPenalty: -2,
        damageBonus: 2,
        attackAction: "standard",
        singleShotConfirmed: true,
        firearm: true,
        fireMode: "single",
        grip: { hands: 1 },
        weaponSource: {
          weaponId: w.id,
          sourceProficiency: "handgun",
          sourceCategory: "servicePistol",
          operatingProficiency: "handgun"
        },
        damageSource: bullseyeDamageSourceFacts({ ...w.system, name: w.name })
      },
      m = {
        uuid: "ChatMessage.bullseye",
        flags: {
          spycraft2: {
            actorUuid: a.uuid,
            checkKind: "attack",
            resolved: true,
            successConfirmed: true,
            weaponUuid: w.uuid,
            weaponProficiency: "handgun",
            attackContext: {
              ranged: true,
              attackAction: "standard",
              fireMode: "single",
              targetActorUuid: target.uuid,
              bullseye: p
            }
          }
        }
      };
    a.items = [w];
    a.items.get = id => a.items.find(i => i.id === id);
    a.system = { activeFeatNames: ["Bullseye"], proficiencyTotals: { handgun: { proficient: true } } };
    globalThis.game = { ...oldGame, user: { isGM: true }, actors: [target], messages: [m] };
    await a.rollDamage(w);
    await render(page, 768);
    await expect(page.locator("[name=attackDamageSourceUuid]")).toHaveValue(m.uuid);
    await expect(page.locator("[name=targetActorUuid]")).toHaveValue(target.uuid);
    await expect(page.locator("body")).toContainText("Bullseye +2");
    await page.locator("#confirm").scrollIntoViewIfNeeded();
    const r = await page.locator("#confirm").boundingBox();
    expect(r.y + r.height).toBeLessThanOrEqual(768);
  } finally {
    content = previous;
    globalThis.game = oldGame;
  }
});

test("Bullseye miss outcome uses the common recorded-attack control with confirmation reachable at768px", async ({
  page
}) => {
  const previous = content,
    oldGame = game;
  try {
    const { manageMeleeTradeoff } = await import("../../module/apps/melee-tradeoff-outcomes.mjs"),
      a = { uuid: "Actor.bullseye", isOwner: true, system: {} },
      m = {
        uuid: "ChatMessage.miss",
        flags: {
          spycraft2: {
            actorUuid: a.uuid,
            checkKind: "attack",
            resolved: true,
            successConfirmed: false,
            attackContext: {
              ranged: true,
              attackAction: "standard",
              bullseye: { source: "Bullseye", penalty: 2, singleShotConfirmed: true }
            },
            rollCombat: { round: 3 }
          }
        }
      };
    globalThis.game = { ...oldGame, user: { isGM: true }, messages: [m] };
    await manageMeleeTradeoff(a);
    await render(page, 768);
    await expect(page.locator("body")).toContainText("Apply flat-footed: Bullseye miss in round 3");
    await page.locator("[name=confirmed]").check();
    await page.locator("#confirm").scrollIntoViewIfNeeded();
    const r = await page.locator("#confirm").boundingBox();
    expect(r.y + r.height).toBeLessThanOrEqual(768);
  } finally {
    content = previous;
    globalThis.game = oldGame;
  }
});

test("Hack full-action quick melee declaration keeps its feat-trick and named-target confirmations reachable at768px", async ({
  page
}) => {
  const previous = content,
    oldGame = game;
  try {
    const a = new SpycraftActor();
    a.uuid = "Actor.hack";
    a.items = [];
    a.system = { activeFeatNames: ["Great Sword Basics", "All-out Attack"], abilities: { str: { mod: 2 } } };
    globalThis.game = { ...oldGame, actors: [] };
    await a.rollAttack({ system: { proficiency: "exoticEdged" } }, { askContext: true });
    await render(page, 768);
    await page.locator("[name=attackAction]").selectOption("standard");
    await page.locator("[name=meleeTrick]").selectOption("hack");
    for (const key of ["meleeTrickFullActionConfirmed", "meleeTrickOnlyConfirmed", "meleeTrickTargetConfirmed"]) {
      await page.locator(`[name=${key}]`).scrollIntoViewIfNeeded();
      await page.locator(`[name=${key}]`).check();
    }
    await page.locator("[name=meleeTrickTargetName]").fill("Vault door");
    await page.locator("#confirm").scrollIntoViewIfNeeded();
    const r = await page.locator("#confirm").boundingBox();
    expect(r.y + r.height).toBeLessThanOrEqual(768);
  } finally {
    content = previous;
    globalThis.game = oldGame;
  }
});

test("combined Hack and All-out hit has one selected damage source with its combined bonus at768px", async ({
  page
}) => {
  const previous = content,
    oldGame = game;
  try {
    const { bullseyeDamageSourceFacts } = await import("../../module/rules/bullseye.mjs"),
      a = new SpycraftActor();
    a.uuid = "Actor.hackDamage";
    a.isOwner = true;
    a.type = "agent";
    const w = {
        id: "sword",
        uuid: a.uuid + ".Item.sword",
        type: "weapon",
        name: "Great sword",
        system: { proficiency: "exoticEdged", damage: "2d6", sizeHands: "M/2h" }
      },
      target = { uuid: "Actor.opponent", type: "agent", isOwner: true, name: "Recorded opponent", system: {} },
      p = {
        version: 1,
        key: "hack",
        source: "Hack!",
        feat: "Great Sword Basics",
        weaponId: w.id,
        targetUuid: target.uuid,
        attackBonus: 1,
        damageBonus: 4,
        threatIncrease: 1,
        attackAction: "standard",
        fullActionConfirmed: true,
        onlyFeatTrickConfirmed: true,
        grip: { hands: 2, required: 2 },
        weaponSource: {
          weaponId: w.id,
          sourceProficiency: "exoticEdged",
          sourceCategory: "",
          operatingProficiency: "exoticEdged"
        },
        damageSource: bullseyeDamageSourceFacts({ ...w.system, name: w.name })
      },
      m = {
        uuid: "ChatMessage.hack",
        flags: {
          spycraft2: {
            actorUuid: a.uuid,
            checkKind: "attack",
            resolved: true,
            successConfirmed: true,
            weaponUuid: w.uuid,
            weaponProficiency: "exoticEdged",
            attackContext: {
              ranged: false,
              attackAction: "standard",
              meleeFeatTrick: "hack",
              meleeTrick: p,
              targetActorUuid: target.uuid,
              meleeTradeoff: {
                version: 1,
                source: "All-out Attack",
                weaponId: w.id,
                targetUuid: target.uuid,
                penalty: 2,
                damageBonus: 4
              }
            }
          }
        }
      };
    a.items = [w];
    a.items.get = id => a.items.find(i => i.id === id);
    a.system = { activeFeatNames: [], proficiencyTotals: { exoticEdged: { proficient: true } } };
    globalThis.game = { ...oldGame, user: { isGM: true }, actors: [target], messages: [m] };
    await a.rollDamage(w);
    await render(page, 768);
    await expect(page.locator("[name=attackDamageSourceUuid]")).toHaveValue(m.uuid);
    await expect(page.locator("[name=targetActorUuid]")).toHaveValue(target.uuid);
    await expect(page.locator("body")).toContainText("All-out Attack + Hack! +8");
    await page.locator("#confirm").scrollIntoViewIfNeeded();
    const r = await page.locator("#confirm").boundingBox();
    expect(r.y + r.height).toBeLessThanOrEqual(768);
  } finally {
    content = previous;
    globalThis.game = oldGame;
  }
});

test("Crush quick melee declaration offers the earned hammer trick and keeps confirmation reachable at768px", async ({
  page
}) => {
  const previous = content,
    oldGame = game;
  try {
    const a = new SpycraftActor();
    a.uuid = "Actor.crush";
    a.items = [];
    a.system = { activeFeatNames: ["Hammer Basics", "All-out Attack"], abilities: { str: { mod: 2 } } };
    globalThis.game = { ...oldGame, actors: [] };
    await a.rollAttack({ system: { proficiency: "blunt" } }, { askContext: true });
    await render(page, 768);
    await page.locator("[name=attackAction]").selectOption("standard");
    await page.locator("[name=meleeTrick]").selectOption("crush");
    await expect(page.locator("[name=meleeTrick] option[value=hack]")).toHaveCount(0);
    await expect(page.locator("[name=meleeTrick]")).toContainText("Crush! — hammer, +2 attack, +5 damage");
    for (const key of ["meleeTrickFullActionConfirmed", "meleeTrickOnlyConfirmed"]) {
      await page.locator(`[name=${key}]`).scrollIntoViewIfNeeded();
      await page.locator(`[name=${key}]`).check();
    }
    await page.locator("#confirm").scrollIntoViewIfNeeded();
    const r = await page.locator("#confirm").boundingBox();
    expect(r.y + r.height).toBeLessThanOrEqual(768);
  } finally {
    content = previous;
    globalThis.game = oldGame;
  }
});

test("Chop quick melee declaration offers the earned hammer trick and keeps confirmation reachable at768px", async ({
  page
}) => {
  const previous = content,
    oldGame = game;
  try {
    const a = new SpycraftActor();
    a.uuid = "Actor.chop";
    a.items = [];
    a.system = { activeFeatNames: ["Axe Basics", "All-out Attack"], abilities: { str: { mod: 2 } } };
    globalThis.game = { ...oldGame, actors: [] };
    await a.rollAttack({ system: { proficiency: "edged" } }, { askContext: true });
    await render(page, 768);
    await page.locator("[name=attackAction]").selectOption("standard");
    await page.locator("[name=meleeTrick]").selectOption("chop");
    await expect(page.locator("[name=meleeTrick] option[value=hack]")).toHaveCount(0);
    await expect(page.locator("[name=meleeTrick]")).toContainText("Chop! — axe, +3 attack, +3 damage, takedown");
    for (const key of ["meleeTrickFullActionConfirmed", "meleeTrickOnlyConfirmed"]) {
      await page.locator(`[name=${key}]`).scrollIntoViewIfNeeded();
      await page.locator(`[name=${key}]`).check();
    }
    await page.locator("#confirm").scrollIntoViewIfNeeded();
    const r = await page.locator("#confirm").boundingBox();
    expect(r.y + r.height).toBeLessThanOrEqual(768);
  } finally {
    content = previous;
    globalThis.game = oldGame;
  }
});

test("actual Takedown declaration keeps applied-damage, wound-loss and GC target controls reachable at768px", async ({
  page
}) => {
  const previous = content,
    oldGame = game;
  try {
    const a = new SpycraftActor();
    a.uuid = "Actor.takedown";
    a.type = "agent";
    a.isOwner = true;
    a.flags = {};
    const attack = {
        uuid: "ChatMessage.attack",
        flags: {
          spycraft2: {
            actorUuid: "Actor.foe",
            checkKind: "attack",
            resolved: true,
            successConfirmed: true,
            effectiveTotal: 17,
            weaponQualities: "TKD",
            attackContext: { targetActorUuid: a.uuid }
          }
        }
      },
      damage = {
        uuid: "ChatMessage.damage",
        flags: {
          spycraft2: {
            actorUuid: "Actor.foe",
            checkKind: "damage",
            resolved: true,
            effectiveTotal: 6,
            weaponQualities: "TKD"
          }
        }
      };
    globalThis.game = { ...oldGame, user: { isGM: true }, actors: [], messages: [attack, damage] };
    await a.manageTakedown();
    await render(page, 768);
    await page.locator("[name=operation]").selectOption("new");
    await page.locator("[name=attackUuid]").selectOption(attack.uuid);
    await page.locator("[name=damageUuid]").selectOption(damage.uuid);
    for (const key of ["preDRDamage", "netDamage"]) await page.locator("[name=" + key + "]").fill("6");
    for (const key of ["woundsLost", "targetConfirmed", "confirmed"]) {
      await page.locator("[name=" + key + "]").scrollIntoViewIfNeeded();
      await page.locator("[name=" + key + "]").check();
    }
    await expect(page.locator("body")).toContainText("plus 10");
    await expect(page.locator("[name=attackUuid]")).not.toContainText(attack.uuid);
    await page.locator("#confirm").scrollIntoViewIfNeeded();
    const r = await page.locator("#confirm").boundingBox();
    expect(r.y + r.height).toBeLessThanOrEqual(768);
  } finally {
    content = previous;
    globalThis.game = oldGame;
  }
});

test("Takedown interrupted save and outcome reviews use readable labels with confirmation reachable at768px", async ({
  page
}) => {
  const previous = content,
    oldGame = game;
  try {
    const a = new SpycraftActor();
    a.uuid = "Actor.takedownReview";
    a.type = "npc";
    a.isOwner = true;
    const proof = n => ({
        version: 1,
        eventId: "event" + n,
        receiptId: "nonce" + n,
        targetUuid: a.uuid,
        damageRootUuid: "ChatMessage.damage" + n,
        sourceEvidence: ["attack", "damage"],
        dc: 16
      }),
      p = proof(1),
      q = proof(2),
      save = {
        uuid: "ChatMessage.save2",
        flags: { spycraft2: { actorUuid: a.uuid, checkKind: "save", checkId: "fort", resolved: true, takedown: q } }
      };
    a.flags = {
      spycraft2: {
        takedownEvents: [
          { version: 1, id: p.eventId, proof: p, saveUuid: null, settlement: null },
          {
            version: 1,
            id: q.eventId,
            proof: q,
            saveUuid: save.uuid,
            settlement: {
              version: 1,
              eventId: q.eventId,
              saveUuid: save.uuid,
              evidence: "saved evidence",
              succeeded: false,
              wasSprawled: false,
              operationId: "takedown-" + q.eventId,
              state: "prepared"
            }
          }
        ]
      }
    };
    globalThis.game = { ...oldGame, user: { isGM: true }, actors: [], messages: [save] };
    await a.manageTakedown();
    await render(page, 768);
    await expect(page.locator("[name=operation]")).toContainText("GC review interrupted takedown save DC 16");
    await expect(page.locator("[name=operation]")).toContainText("GC review interrupted takedown outcome DC 16");
    await expect(page.locator("[name=operation]")).not.toContainText("event1");
    await page.locator("[name=operation]").selectOption("outcome|" + save.uuid);
    await page.locator("[name=resolution]").selectOption("alreadyApplied");
    await page.locator("[name=confirmed]").scrollIntoViewIfNeeded();
    await page.locator("[name=confirmed]").check();
    await page.locator("#confirm").scrollIntoViewIfNeeded();
    const r = await page.locator("#confirm").boundingBox();
    expect(r.y + r.height).toBeLessThanOrEqual(768);
  } finally {
    content = previous;
    globalThis.game = oldGame;
  }
});

test("recorded takedown Fortitude context automatically states Still Standing purpose without optional unchecked purpose controls", async ({
  page
}) => {
  const previous = content,
    oldGame = game;
  try {
    const a = new SpycraftActor();
    a.type = "agent";
    a.uuid = "Actor.standingTKD";
    a.isOwner = true;
    a.items = [];
    a.flags = {};
    a.effects = [];
    a.statuses = new Set();
    a.system = {
      classLevels: { brawler: 3 },
      classOptionSelections: [{ classId: "brawler", name: "Still Standing", level: 3 }],
      activeFeatNames: [],
      conditionContext: {},
      abilities: Object.fromEntries(["str", "dex", "con", "int", "wis", "cha"].map(k => [k, { value: 12, mod: 1 }]))
    };
    globalThis.game = {
      ...oldGame,
      user: { isGM: true },
      i18n: { localize: String },
      messages: [],
      actors: [],
      combats: [],
      time: { worldTime: 126 }
    };
    await a.rollSave("fort", { askContext: true, takedown: { dc: 16 } });
    await render(page, 768);
    await expect(page.locator("body")).toContainText("Earned Still Standing applies automatically");
    await expect(page.locator("[name=resistingTakedown]")).toHaveCount(0);
    await page.locator("#confirm").scrollIntoViewIfNeeded();
    const r = await page.locator("#confirm").boundingBox();
    expect(r.y + r.height).toBeLessThanOrEqual(768);
  } finally {
    content = previous;
    globalThis.game = oldGame;
  }
});

test("earned Menacing stance entry exposes its fixed stress rule with reachable legal half-action confirmation", async ({
  page
}) => {
  const previous = content,
    oldGame = game;
  try {
    const { declareCombatStance } = await import("../../module/apps/combat-stance.mjs"),
      a = new SpycraftActor();
    a.type = "agent";
    a.uuid = "Actor.menacingEntry";
    a.isOwner = true;
    a.system = { activeFeatNames: ["Axe Basics"], combatStance: null };
    globalThis.game = { ...oldGame, combats: [], user: { isGM: true }, time: { worldTime: 126 } };
    await declareCombatStance(a);
    await render(page, 768);
    await page.locator("[name=stance]").selectOption("menacing");
    await expect(page.locator("body")).toContainText("additional 2 stress");
    await expect(page.locator("[name=roundMovementFeet]")).toHaveCount(0);
    for (const key of ["halfActionConfirmed", "legalConfirmed"]) {
      await page.locator("[name=" + key + "]").scrollIntoViewIfNeeded();
      await page.locator("[name=" + key + "]").check();
    }
    await page.locator("#confirm").scrollIntoViewIfNeeded();
    const r = await page.locator("#confirm").boundingBox();
    expect(r.y + r.height).toBeLessThanOrEqual(768);
  } finally {
    content = previous;
    globalThis.game = oldGame;
  }
});

test("Menacing fixed component and GC recovery labels remain readable with confirmation reachable at768px", async ({
  page
}) => {
  const previous = content,
    oldGame = game;
  try {
    const { manageStanceDamage } = await import("../../module/apps/stance-damage.mjs"),
      a = {
        uuid: "Actor.menacingCard",
        isOwner: true,
        flags: {
          spycraft2: {
            stanceDamageUses: [
              {
                version: 1,
                rootAttackUuid: "ChatMessage.pending",
                reservationId: "privateNonce",
                proof: {
                  version: 1,
                  actorUuid: "Actor.menacingCard",
                  rootAttackUuid: "ChatMessage.pending",
                  reservationId: "privateNonce",
                  stanceKey: "menacing",
                  amount: 2,
                  damageType: "stress",
                  sourceEvidence: "eligibility"
                },
                receiptUuid: null
              }
            ]
          }
        }
      },
      m = {
        uuid: "ChatMessage.hitMenacing",
        flags: {
          spycraft2: {
            actorUuid: a.uuid,
            checkKind: "attack",
            resolved: true,
            successConfirmed: true,
            attackContext: {
              ranged: false,
              combatStance: { version: 1, stance: { version: 1, key: "menacing", id: "stanceM", feat: "Axe Basics" } }
            },
            rollCombat: { round: 3 }
          }
        }
      };
    globalThis.game = { ...oldGame, user: { isGM: true }, messages: [m] };
    await manageStanceDamage(a);
    await render(page, 768);
    await expect(page.locator("[name=operation]")).toContainText("Menacing Stance: melee hit 1 in round 3 — 2 stress");
    await expect(page.locator("[name=operation]")).toContainText("GC review interrupted Menacing Stance component");
    await expect(page.locator("body")).not.toContainText("privateNonce");
    await page.locator("[name=operation]").selectOption("review|privateNonce");
    await page.locator("[name=damageConfirmed]").check();
    await page.locator("#confirm").scrollIntoViewIfNeeded();
    const r = await page.locator("#confirm").boundingBox();
    expect(r.y + r.height).toBeLessThanOrEqual(768);
  } finally {
    content = previous;
    globalThis.game = oldGame;
  }
});

test("earned Driving stance exposes push, blocked damage and follow rules with own-turn entry confirmation reachable", async ({
  page
}) => {
  const previous = content,
    oldGame = game;
  try {
    const { declareCombatStance } = await import("../../module/apps/combat-stance.mjs"),
      a = new SpycraftActor();
    a.uuid = "Actor.drivingEntry";
    a.type = "agent";
    a.isOwner = true;
    a.system = { activeFeatNames: ["Hammer Basics"], combatStance: null };
    globalThis.game = { ...oldGame, user: { isGM: true }, combats: [] };
    await declareCombatStance(a);
    await render(page, 768);
    await page.locator("[name=stance]").selectOption("driving");
    await expect(page.locator("body")).toContainText("occupied or blocked destination causes 1d4 subdual");
    for (const name of ["halfActionConfirmed", "legalConfirmed"]) {
      await page.locator("[name=" + name + "]").scrollIntoViewIfNeeded();
      await page.locator("[name=" + name + "]").check();
    }
    await page.locator("#confirm").scrollIntoViewIfNeeded();
    const r = await page.locator("#confirm").boundingBox();
    expect(r.y + r.height).toBeLessThanOrEqual(768);
  } finally {
    content = previous;
    globalThis.game = oldGame;
  }
});

test("Driving push and blocked outcome control names its actual opponent and keeps route confirmations reachable", async ({
  page
}) => {
  const previous = content,
    oldGame = game,
    oldFrom = globalThis.fromUuidSync;
  try {
    const { manageDrivingStance } = await import("../../module/apps/driving-stance.mjs"),
      a = { uuid: "Actor.drivingUI", isOwner: true, flags: {} },
      target = { uuid: "Actor.drivingTarget", type: "npc", name: "Actual driving opponent" },
      m = {
        uuid: "ChatMessage.drivingHitUI",
        flags: {
          spycraft2: {
            actorUuid: a.uuid,
            checkKind: "attack",
            resolved: true,
            successConfirmed: true,
            attackContext: {
              ranged: false,
              targetActorUuid: target.uuid,
              combatStance: {
                version: 1,
                stance: { version: 1, key: "driving", feat: "Hammer Basics", id: "drivingUI" }
              }
            },
            rollCombat: { round: 4 }
          }
        }
      };
    globalThis.fromUuidSync = id => [a, target, m].find(x => x.uuid === id);
    globalThis.game = { ...oldGame, user: { isGM: true }, messages: [m] };
    await manageDrivingStance(a);
    await render(page, 768);
    await expect(page.locator("[name=operation]")).toContainText("Actual driving opponent · round 4");
    await page.locator("[name=outcome]").selectOption("blocked");
    await expect(page.locator("body")).toContainText("1d4 subdual");
    for (const name of ["routeConfirmed", "outcomeConfirmed"]) {
      await page.locator("[name=" + name + "]").scrollIntoViewIfNeeded();
      await page.locator("[name=" + name + "]").check();
    }
    await page.locator("#confirm").scrollIntoViewIfNeeded();
    const r = await page.locator("#confirm").boundingBox();
    expect(r.y + r.height).toBeLessThanOrEqual(768);
  } finally {
    content = previous;
    globalThis.game = oldGame;
    globalThis.fromUuidSync = oldFrom;
  }
});

test("Driving interrupted GC review uses human labels and keeps recovery confirmation reachable", async ({ page }) => {
  const previous = content,
    oldGame = game;
  try {
    const { manageDrivingStance } = await import("../../module/apps/driving-stance.mjs"),
      a = {
        uuid: "Actor.drivingRecovery",
        isOwner: true,
        flags: {
          spycraft2: {
            drivingStanceUses: [
              {
                version: 1,
                id: "privateDriving",
                receiptUuid: null,
                proof: {
                  version: 1,
                  actorUuid: "Actor.drivingRecovery",
                  outcomeId: "privateDriving",
                  rootAttackUuid: "ChatMessage.original",
                  sourceEvidence: "proof",
                  outcome: "blocked",
                  pushFeet: 0,
                  followFeet: 0,
                  damagePenalty: 0,
                  damageFormula: "1d4",
                  damageType: "subdual"
                }
              }
            ]
          }
        }
      };
    globalThis.game = { ...oldGame, user: { isGM: true }, messages: [] };
    await manageDrivingStance(a);
    await render(page, 768);
    await expect(page.locator("[name=operation]")).toContainText("GC review interrupted blocked damage");
    await expect(page.locator("body")).not.toContainText("privateDriving");
    await page.locator("[name=outcomeConfirmed]").check();
    await page.locator("#confirm").scrollIntoViewIfNeeded();
    const r = await page.locator("#confirm").boundingBox();
    expect(r.y + r.height).toBeLessThanOrEqual(768);
  } finally {
    content = previous;
    globalThis.game = oldGame;
  }
});

test("Power entry exposes ten-foot round cap and explicit first legacy Count inclusion confirmation with reachable action controls", async ({
  page
}) => {
  const previous = content,
    oldGame = game;
  try {
    const { declareCombatStance } = await import("../../module/apps/combat-stance.mjs"),
      a = new SpycraftActor();
    a.uuid = "Actor.powerEntryUI";
    a.type = "agent";
    a.isOwner = true;
    a.system = { activeFeatNames: ["Great Sword Basics"], combatStance: null, abilities: { str: { value: 14 } } };
    const combat = { id: "powerCombatUI", combatants: [] },
      c = { id: "powerCombatantUI", parent: combat, actor: a, initiative: 20, flags: {} };
    combat.combatants = [c];
    globalThis.game = { ...oldGame, combats: [combat], user: { isGM: true }, time: { worldTime: 126 } };
    await declareCombatStance(a);
    await render(page, 768);
    await page.locator("[name=stance]").selectOption("power");
    await expect(page.locator("body")).toContainText("at most 10 ft. movement");
    await expect(page.locator("[name=powerCountConfirmed]")).toHaveCount(1);
    await page.locator("[name=roundMovementFeet]").fill("10");
    for (const key of ["powerCountConfirmed", "roundMovementConfirmed", "halfActionConfirmed", "legalConfirmed"]) {
      await page.locator("[name=" + key + "]").scrollIntoViewIfNeeded();
      await page.locator("[name=" + key + "]").check();
    }
    await page.locator("#confirm").scrollIntoViewIfNeeded();
    const r = await page.locator("#confirm").boundingBox();
    expect(r.y + r.height).toBeLessThanOrEqual(768);
  } finally {
    content = previous;
    globalThis.game = oldGame;
  }
});

test("Power Count GC inclusion review explains historical Strength and keeps numeric choice and note reachable", async ({
  page
}) => {
  const previous = content,
    oldGame = game;
  try {
    const { reviewPowerStanceInitiative } = await import("../../module/apps/power-stance.mjs"),
      a = {
        uuid: "Actor.powerReviewUI",
        name: "Actual Power agent",
        isOwner: true,
        system: {
          activeFeatNames: ["Great Sword Basics"],
          combatStance: { version: 1, key: "power", id: "powerUI" },
          abilities: { str: { value: 14 } },
          conditionContext: {}
        }
      },
      combat = { id: "combatPowerReview", name: "Actual combat" },
      c = {
        id: "actorPowerReview",
        parent: combat,
        actor: a,
        initiative: 34,
        flags: {
          spycraft2: {
            powerStanceInitiative: {
              version: 1,
              count: 34,
              includedBonus: null,
              stanceId: null,
              needsReview: true,
              reason: "Confirm the old stance bonus"
            }
          }
        }
      };
    combat.combatants = new Map([[c.id, c]]);
    const combats = [combat];
    combats.get = id => (id === combat.id ? combat : null);
    globalThis.game = { ...oldGame, user: { isGM: true }, combats };
    await reviewPowerStanceInitiative(a, combat.id, c.id);
    await render(page, 768);
    await expect(page.locator("body")).toContainText("current Count 34");
    await expect(page.locator("body")).toContainText("earlier Strength score");
    await page.locator("[name=includedBonus]").fill("14");
    await page.locator("[name=resolution]").fill("Verified original Power bonus already included");
    await page.locator("#confirm").scrollIntoViewIfNeeded();
    const r = await page.locator("#confirm").boundingBox();
    expect(r.y + r.height).toBeLessThanOrEqual(768);
  } finally {
    content = previous;
    globalThis.game = oldGame;
  }
});

test("Power Count review selector labels combat and Count without exposing internal document references", async ({
  page
}) => {
  const previous = content,
    oldGame = game;
  try {
    const { managePowerStanceInitiative } = await import("../../module/apps/power-stance.mjs"),
      a = {
        uuid: "Actor.powerSelector",
        name: "Actual Power agent",
        type: "agent",
        isOwner: true,
        system: {
          activeFeatNames: ["Great Sword Basics"],
          combatStance: { version: 1, key: "power", id: "stance-private" },
          abilities: { str: { value: 14 } },
          conditionContext: {}
        }
      },
      combat = { id: "private-combat-id", name: "Actual scene combat" },
      c = {
        id: "private-combatant-id",
        actor: a,
        parent: combat,
        initiative: 34,
        flags: {
          spycraft2: {
            powerStanceInitiative: {
              version: 1,
              count: 34,
              includedBonus: null,
              needsReview: true,
              reason: "Unknown component"
            }
          }
        }
      };
    combat.combatants = [c];
    globalThis.game = { ...oldGame, combats: [combat], user: { isGM: true } };
    await managePowerStanceInitiative(a);
    await render(page, 768);
    await expect(page.locator("[name=combatant]")).toContainText("Actual scene combat — Count 34");
    await expect(page.locator("body")).not.toContainText("private-combatant-id");
    await page.locator("#confirm").scrollIntoViewIfNeeded();
    const r = await page.locator("#confirm").boundingBox();
    expect(r.y + r.height).toBeLessThanOrEqual(768);
  } finally {
    content = previous;
    globalThis.game = oldGame;
  }
});

for (const height of [768, 1000])
  test(
    "ordinary Trip attack keeps observed opponent, Size and legal half-action controls reachable at " + height + "px",
    async ({ page }) => {
      const previous = content,
        oldGame = game;
      try {
        const a = new SpycraftActor();
        a.uuid = "Actor.tripAttackLayout";
        a.type = "agent";
        a.isOwner = true;
        a.items = [];
        a.system = {
          activeFeatNames: ["Axe Basics"],
          skillTotals: { acrobatics: { name: "Acrobatics", totals: [{ ability: "dex", total: 6 }] } }
        };
        const target = {
          uuid: "Actor.tripObservedLayout",
          type: "npc",
          name: "Actual adjacent opponent with a long descriptive designation ".repeat(3),
          isOwner: true,
          system: { size: "Medium" }
        };
        globalThis.game = { ...oldGame, actors: [target], combats: [], user: { isGM: true } };
        await a.rollSkill("acrobatics");
        await render(page, height);
        await page.locator("[name=check]").selectOption("trip");
        await page.locator("[name=tripAttackOpponentUuid]").selectOption(target.uuid);
        await page.locator("[name=tripAttackSizeDifference]").fill("-1");
        await expect(page.locator("[name=check] option[value=trip]")).toHaveCount(1);
        await expect(page.locator("[name=check] option[value=resist-trip]")).toHaveCount(1);
        for (const key of ["tripAttackAdjacent", "tripAttackParticipantsConfirmed", "tripAttackHalfActionConfirmed"]) {
          await page.locator("[name=" + key + "]").scrollIntoViewIfNeeded();
          await page.locator("[name=" + key + "]").check();
        }
        await expect(page.locator("body")).toContainText("Armor Check Penalty and action error+1");
        await page.locator("#confirm").scrollIntoViewIfNeeded();
        const r = await page.locator("#confirm").boundingBox();
        expect(r.y).toBeGreaterThanOrEqual(0);
        expect(r.y + r.height).toBeLessThanOrEqual(height);
      } finally {
        content = previous;
        globalThis.game = oldGame;
      }
    }
  );

test("incoming Trip response retains independent defender confirmations alongside expanded attacking Trip controls", async ({
  page
}) => {
  const previous = content,
    oldGame = game;
  try {
    const a = new SpycraftActor();
    a.uuid = "Actor.tripResponseLayout";
    a.type = "agent";
    a.isOwner = true;
    a.items = [];
    a.system = {
      activeFeatNames: ["Great Sword Basics"],
      skillTotals: { acrobatics: { name: "Acrobatics", totals: [{ ability: "dex", total: 6 }] } }
    };
    globalThis.game = { ...oldGame, actors: [], combats: [], user: { isGM: true } };
    await a.rollSkill("acrobatics");
    await render(page, 768);
    await page.locator("[name=check]").selectOption("resist-trip");
    await expect(page.locator("[name=tripSizeDifference]")).toHaveCount(1);
    await expect(page.locator("[name=tripAttackSizeDifference]")).toHaveCount(1);
    await page.locator("[name=tripOpponentName]").fill("Actual incoming Trip opponent");
    await page.locator("[name=tripSizeDifference]").fill("0");
    for (const key of ["tripAdjacent", "tripIncomingConfirmed"]) {
      await page.locator("[name=" + key + "]").scrollIntoViewIfNeeded();
      await page.locator("[name=" + key + "]").check();
    }
    await expect(page.locator("[name=tripAttackHalfActionConfirmed]")).not.toBeChecked();
    await page.locator("#confirm").scrollIntoViewIfNeeded();
    const r = await page.locator("#confirm").boundingBox();
    expect(r.y + r.height).toBeLessThanOrEqual(768);
  } finally {
    content = previous;
    globalThis.game = oldGame;
  }
});

for (const height of [768, 1000])
  test("recorded Trip response exposes observed attacker identity and Size at " + height + "px", async ({ page }) => {
    const previous = content,
      oldGame = game;
    try {
      const a = new SpycraftActor();
      a.uuid = "Actor.responseBound";
      a.type = "agent";
      a.isOwner = true;
      a.items = [];
      a.system = {
        size: "Medium",
        activeFeatNames: ["Great Sword Basics"],
        skillTotals: { acrobatics: { name: "Acrobatics", totals: [{ ability: "dex", total: 6 }] } }
      };
      const target = {
        uuid: "Actor.sameNameAttacker",
        type: "npc",
        name: "Same named adjacent attacker with a long designation ".repeat(3),
        isOwner: true,
        system: { size: "Large" }
      };
      globalThis.game = { ...oldGame, actors: [target], combats: [], user: { isGM: true } };
      await a.rollSkill("acrobatics");
      await render(page, height);
      await page.locator("[name=check]").selectOption("resist-trip");
      await page.locator("[name=tripOpponentUuid]").selectOption(target.uuid);
      await expect(page.locator("[name=tripOpponentUuid] option:checked")).toContainText("Size Large");
      await page.locator("[name=tripSizeDifference]").fill("-1");
      for (const key of ["tripAdjacent", "tripIncomingConfirmed"]) {
        await page.locator("[name=" + key + "]").scrollIntoViewIfNeeded();
        await page.locator("[name=" + key + "]").check();
      }
      await expect(page.locator("[name=tripAttackHalfActionConfirmed]")).not.toBeChecked();
      await page.locator("#confirm").scrollIntoViewIfNeeded();
      const b = await page.locator("#confirm").boundingBox();
      expect(b.y).toBeGreaterThanOrEqual(0);
      expect(b.y + b.height).toBeLessThanOrEqual(height);
    } finally {
      content = previous;
      globalThis.game = oldGame;
    }
  });

for (const height of [768, 1000])
  test("ordinary Trip settlement and GC interruption review fit at " + height + "px", async ({ page }) => {
    const previous = content,
      oldGame = game;
    try {
      const { manageTripOutcomes } = await import("../../module/apps/trip-outcomes.mjs"),
        a = { uuid: "Actor.tripOutcomeLayout", isOwner: true },
        target = {
          uuid: "Actor.tripOutcomeDefender",
          type: "npc",
          name: "Recorded opposing character ".repeat(8),
          isOwner: true,
          system: {}
        };
      const m = (id, uuid, p) => ({
        uuid: "ChatMessage." + id,
        flags: { spycraft2: { actorUuid: uuid, resolved: true, effectiveTotal: 18, ...p } }
      });
      globalThis.game = {
        ...oldGame,
        user: { isGM: true },
        actors: [target],
        messages: [
          m("attack", a.uuid, { tripAttack: { version: 1, combat: { round: 3 } } }),
          m("defense", target.uuid, { tripDefense: { version: 3, combat: { round: 3 } } })
        ]
      };
      await manageTripOutcomes(a);
      await render(page, height);
      await expect(page.locator("[name=actingMessage] option")).toHaveCount(1);
      await expect(page.locator("[name=defendingMessage] option")).toHaveCount(1);
      await page.locator("[name=opposedConfirmed]").check();
      await page.locator("[name=reviewResolution]").selectOption("alreadyApplied");
      await page.locator("[name=reviewConfirmed]").scrollIntoViewIfNeeded();
      await page.locator("[name=reviewConfirmed]").check();
      await page.locator("#confirm").scrollIntoViewIfNeeded();
      const b = await page.locator("#confirm").boundingBox();
      expect(b.y).toBeGreaterThanOrEqual(0);
      expect(b.y + b.height).toBeLessThanOrEqual(height);
    } finally {
      content = previous;
      globalThis.game = oldGame;
    }
  });
for (const height of [768, 1000])
  test("critical Trip final attack and interrupted review remain reachable at " + height + "px", async ({ page }) => {
    const previous = content,
      oldGame = game;
    try {
      const { takeTripFinalAttack, reviewTripFinalAttack } = await import("../../module/apps/trip-final-attack.mjs"),
        target = {
          uuid: "Actor.tripCriticalOpponent",
          type: "npc",
          isOwner: true,
          name: "Actual critical Trip opponent ".repeat(8),
          system: { size: "Medium" }
        },
        a = {
          uuid: "Actor.tripCriticalLayout",
          type: "agent",
          isOwner: true,
          system: { activeFeatNames: [] },
          items: [{ id: "weapon", type: "weapon", name: "Actual owned weapon ".repeat(8), system: { equipped: true } }]
        },
        m = {
          uuid: "ChatMessage.tripCriticalLayout",
          flags: {
            spycraft2: {
              actorUuid: a.uuid,
              tripFinalUse: { id: "interrupted" },
              tripAttack: { version: 1 },
              tripSettlement: {
                state: "applied",
                criticalOpportunity: "finalAttack",
                round: 3,
                attackerUuid: a.uuid,
                defenderUuid: target.uuid
              }
            }
          }
        };
      globalThis.game = { ...oldGame, user: { isGM: true }, actors: [target], messages: [m] };
      for (const kind of ["attack", "review"]) {
        if (kind === "attack") await takeTripFinalAttack(a);
        else await reviewTripFinalAttack(a);
        await render(page, height);
        await expect(page.locator("[name=sourceMessage] option")).toHaveCount(1);
        if (kind === "attack") {
          await page.locator("[name=weaponId]").selectOption("weapon");
          for (const key of ["immediateConfirmed", "attackLegalConfirmed"]) {
            await page.locator("[name=" + key + "]").scrollIntoViewIfNeeded();
            await page.locator("[name=" + key + "]").check();
          }
        } else {
          await page.locator("[name=confirmed]").check();
          await page.locator("[name=closeUnused]").check();
        }
        await page.locator("#confirm").scrollIntoViewIfNeeded();
        const b = await page.locator("#confirm").boundingBox();
        expect(b.y).toBeGreaterThanOrEqual(0);
        expect(b.y + b.height).toBeLessThanOrEqual(height);
      }
    } finally {
      content = previous;
      globalThis.game = oldGame;
    }
  });
for (const height of [768, 1000])
  test(
    "earned counter-Trip and interrupted review keep free-action and Size confirmations reachable at " + height + "px",
    async ({ page }) => {
      const previous = content,
        oldGame = game;
      try {
        const { takeCounterTrip, reviewCounterTrip } = await import("../../module/apps/counter-trip.mjs"),
          a = { uuid: "Actor.counterLayout", type: "agent", isOwner: true, system: { size: "Medium" } },
          target = {
            uuid: "Actor.counterOriginalLayout",
            type: "npc",
            isOwner: true,
            name: "Actual original attacker ".repeat(10),
            system: { size: "Large" }
          },
          m = {
            uuid: "ChatMessage.counterLayout",
            flags: {
              spycraft2: {
                actorUuid: a.uuid,
                tripDefense: { version: 3 },
                tripSettlement: {
                  version: 3,
                  state: "applied",
                  criticalOpportunity: "counterTrip",
                  round: 3,
                  attackerUuid: target.uuid,
                  defenderUuid: a.uuid
                },
                tripCounterUse: { id: "interrupted" }
              }
            }
          };
        globalThis.game = { ...oldGame, user: { isGM: true }, actors: [target], messages: [m] };
        for (const kind of ["counter", "review"]) {
          if (kind === "counter") await takeCounterTrip(a);
          else await reviewCounterTrip(a);
          await render(page, height);
          await expect(page.locator("[name=sourceMessage] option")).toHaveCount(1);
          if (kind === "counter") {
            await page.locator("[name=tripAttackSizeDifference]").fill("-1");
            for (const key of ["tripAttackAdjacent", "tripAttackParticipantsConfirmed", "immediateConfirmed"]) {
              await page.locator("[name=" + key + "]").scrollIntoViewIfNeeded();
              await page.locator("[name=" + key + "]").check();
            }
            await expect(page.locator("body")).toContainText("The second Trip cannot grant a third Trip");
          } else {
            await page.locator("[name=confirmed]").check();
            await page.locator("[name=closeUnused]").check();
          }
          await page.locator("#confirm").scrollIntoViewIfNeeded();
          const b = await page.locator("#confirm").boundingBox();
          expect(b.y).toBeGreaterThanOrEqual(0);
          expect(b.y + b.height).toBeLessThanOrEqual(height);
        }
      } finally {
        content = previous;
        globalThis.game = oldGame;
      }
    }
  );

for (const height of [768, 1000])
  test(`Spear Charge route and completed-movement confirmations remain reachable at ${height}px`, async ({ page }) => {
    const oldGame = globalThis.game,
      oldContent = content;
    try {
      const a = new SpycraftActor();
      a.uuid = "Actor.charge";
      a.items = [];
      a.system = { activeFeatNames: ["Spear Basics", "All-out Attack"], abilities: { str: { mod: 2 } } };
      globalThis.game = { ...oldGame, actors: [] };
      await a.rollAttack({ system: { proficiency: "exoticEdged" } }, { askContext: true });
      await render(page, height);
      await page.locator("[name=attackAction]").selectOption("standard");
      await page.locator("[name=meleeTrick]").selectOption("spearCharge");
      await expect(page.locator("[name=meleeTrick]")).toContainText(
        "Spear Charge — spear, -2 attack, +3 damage, +3 threat range"
      );
      for (const [key, value] of [
        ["spearChargeDistanceFeet", "15"],
        ["spearChargeTowardFeet", "10"]
      ]) {
        await page.locator(`[name=${key}]`).scrollIntoViewIfNeeded();
        await page.locator(`[name=${key}]`).fill(value);
      }
      for (const key of [
        "meleeTrickFullActionConfirmed",
        "meleeTrickOnlyConfirmed",
        "spearChargeRouteConfirmed",
        "spearChargeMovementCompleted"
      ]) {
        await page.locator(`[name=${key}]`).scrollIntoViewIfNeeded();
        await page.locator(`[name=${key}]`).check();
      }
      await page.locator("#confirm").scrollIntoViewIfNeeded();
      const r = await page.locator("#confirm").boundingBox();
      expect(r.y).toBeGreaterThanOrEqual(0);
      expect(r.y + r.height).toBeLessThanOrEqual(height);
    } finally {
      globalThis.game = oldGame;
      content = oldContent;
    }
  });

for (const height of [768, 1000])
  test(`Whirling incoming Defense actual-attacker and GC level controls remain reachable at ${height}px`, async ({
    page
  }) => {
    const oldGame = globalThis.game,
      oldContent = content;
    try {
      const { checkIncomingDefense } = await import("../../module/apps/incoming-defense.mjs");
      const a = {
          uuid: "Actor.whirlingLayout",
          type: "agent",
          isOwner: true,
          name: "Whirling defender",
          system: {
            level: 5,
            activeFeatNames: ["Staff Basics"],
            combatStance: { version: 1, key: "whirling", id: "layoutWhirl" }
          }
        },
        enemy = {
          uuid: "Actor.whirlingEnemy",
          type: "agent",
          isOwner: true,
          name: "Observed attacker",
          system: { level: 3 }
        };
      globalThis.game = { ...oldGame, user: { isGM: true }, actors: [a, enemy] };
      await checkIncomingDefense(a);
      await render(page, height);
      await page.locator("[name=flanked]").scrollIntoViewIfNeeded();
      await page.locator("[name=flanked]").check();
      await page.locator("[name=whirlingAttackerUuid]").scrollIntoViewIfNeeded();
      await page.locator("[name=whirlingAttackerUuid]").selectOption(enemy.uuid);
      await page.locator("[name=whirlingAttackerLevel]").fill("3");
      await page.locator("[name=whirlingLevelConfirmed]").check();
      await expect(page.locator("body")).toContainText("not its Tier-adjusted statistics");
      await page.locator("#confirm").scrollIntoViewIfNeeded();
      const r = await page.locator("#confirm").boundingBox();
      expect(r.y).toBeGreaterThanOrEqual(0);
      expect(r.y + r.height).toBeLessThanOrEqual(height);
    } finally {
      globalThis.game = oldGame;
      content = oldContent;
    }
  });

for (const height of [768, 1000])
  test(`Fend declaration keeps its ordinary Standard Attack and one-trick confirmation reachable at ${height}px`, async ({
    page
  }) => {
    const oldGame = globalThis.game,
      oldContent = content;
    try {
      const a = new SpycraftActor();
      a.uuid = "Actor.fendAttackLayout";
      a.items = [];
      a.system = { activeFeatNames: ["Polearm Basics"], abilities: { str: { mod: 2 } } };
      globalThis.game = { ...oldGame, actors: [] };
      await a.rollAttack({ system: { proficiency: "exoticEdged" } }, { askContext: true });
      await render(page, height);
      await page.locator("[name=attackAction]").selectOption("standard");
      await page.locator("[name=meleeTrick]").selectOption("fend");
      await expect(page.locator("[name=meleeTrick]")).toContainText("optional5ft move after hit or miss");
      await expect(page.locator("[name=meleeTrickFullActionConfirmed]")).not.toBeChecked();
      await page.locator("[name=meleeTrickOnlyConfirmed]").scrollIntoViewIfNeeded();
      await page.locator("[name=meleeTrickOnlyConfirmed]").check();
      await page.locator("#confirm").scrollIntoViewIfNeeded();
      const b = await page.locator("#confirm").boundingBox();
      expect(b.y).toBeGreaterThanOrEqual(0);
      expect(b.y + b.height).toBeLessThanOrEqual(height);
    } finally {
      globalThis.game = oldGame;
      content = oldContent;
    }
  });
for (const height of [768, 1000])
  test(`Fend completed-movement source, total and immediate confirmations remain reachable at ${height}px`, async ({
    page
  }) => {
    const oldGame = globalThis.game,
      oldContent = content;
    try {
      const { recordFendMovement } = await import("../../module/apps/fend.mjs"),
        clock = { id: "fendCombat", combatantId: "fendParticipant", started: true, round: 1, turn: 0, ownTurnIndex: 0 },
        a = {
          uuid: "Actor.fendMoveLayout",
          type: "agent",
          isOwner: true,
          flags: {},
          system: { activeFeatNames: [] },
          mentalLeapCombatContext: () => clock
        },
        p = {
          version: 1,
          key: "fend",
          source: "Fend",
          feat: "Polearm Basics",
          weaponId: "polearm",
          attackAction: "standard",
          fullActionConfirmed: false,
          onlyFeatTrickConfirmed: true,
          attackBonus: 0,
          damageBonus: 0,
          threatIncrease: 0,
          grip: { hands: 2, required: 2 },
          timing: { version: 1, combat: clock, activeCombatantId: clock.combatantId, worldTime: null }
        },
        m = {
          id: "fendLayout",
          uuid: "ChatMessage.fendLayout",
          flags: {
            spycraft2: {
              actorUuid: a.uuid,
              checkKind: "attack",
              resolved: true,
              successConfirmed: false,
              weaponUuid: a.uuid + ".Item.polearm",
              baseFlavor: "Fend Standard Attack ".repeat(20),
              rollCombat: { id: clock.id, round: clock.round, combatantId: clock.combatantId },
              attackContext: { meleeTrick: p, meleeFeatTrick: "fend", attackAction: "standard", ranged: false }
            }
          }
        };
      globalThis.game = { ...oldGame, user: { isGM: true }, actors: [a], messages: [m] };
      await recordFendMovement(a);
      await render(page, height);
      await page.locator("[name=sourceMessage]").selectOption(m.uuid);
      await page.locator("[name=totalFeet]").fill("5");
      for (const key of ["routeConfirmed", "movementCompleted", "immediateConfirmed"]) {
        await page.locator("[name=" + key + "]").scrollIntoViewIfNeeded();
        await page.locator("[name=" + key + "]").check();
      }
      await page.locator("#confirm").scrollIntoViewIfNeeded();
      const b = await page.locator("#confirm").boundingBox();
      expect(b.y).toBeGreaterThanOrEqual(0);
      expect(b.y + b.height).toBeLessThanOrEqual(height);
    } finally {
      globalThis.game = oldGame;
      content = oldContent;
    }
  });

for (const height of [768, 1000])
  test(`Striking adjacent-entry reaction keeps its actual opponent, melee weapon and confirmations reachable at ${height}px`, async ({
    page
  }) => {
    const oldGame = globalThis.game,
      oldContent = content;
    try {
      const { takeStrikingAttack } = await import("../../module/apps/striking-stance.mjs"),
        a = {
          uuid: "Actor.strikingLayout",
          type: "agent",
          isOwner: true,
          flags: {},
          system: {
            activeFeatNames: ["Polearm Basics", "All-out Attack"],
            combatStance: { version: 1, key: "striking", id: "layoutStriking", enteredAt: 0 },
            abilities: { str: { mod: 2 } }
          },
          items: [
            { id: "polearm", type: "weapon", name: "Actual readied polearm", system: { equipped: true, carried: true } }
          ]
        },
        opponent = {
          uuid: "Actor.strikingOpponent",
          type: "agent",
          isOwner: true,
          name: "The actual approaching opponent",
          system: {}
        };
      globalThis.game = { ...oldGame, user: { isGM: true }, actors: [a, opponent], messages: [] };
      await takeStrikingAttack(a);
      await render(page, height);
      await page.locator("[name=reactionId]").selectOption("");
      await page.locator("[name=opponentUuid]").selectOption(opponent.uuid);
      await page.locator("[name=weaponId]").selectOption("polearm");
      await page.locator("[name=meleeTrick]").selectOption("fend");
      await page.locator("[name=meleeTrickOnlyConfirmed]").check();
      for (const key of [
        "entryConfirmed",
        "alreadyInStanceConfirmed",
        "roundMovementConfirmed",
        "immediateConfirmed",
        "attackLegalConfirmed"
      ]) {
        await page.locator("[name=" + key + "]").scrollIntoViewIfNeeded();
        await page.locator("[name=" + key + "]").check();
      }
      await page.locator("#confirm").scrollIntoViewIfNeeded();
      const b = await page.locator("#confirm").boundingBox();
      expect(b.y).toBeGreaterThanOrEqual(0);
      expect(b.y + b.height).toBeLessThanOrEqual(height);
      await expect(page.locator("body")).toContainText("shared final-attack allowance");
    } finally {
      globalThis.game = oldGame;
      content = oldContent;
    }
  });
for (const height of [768, 1000])
  test(`Striking missing-result GC review keeps its inactive-attempt and no-new-attack closure reachable at ${height}px`, async ({
    page
  }) => {
    const oldGame = globalThis.game,
      oldContent = content;
    try {
      const { reviewStrikingAttack } = await import("../../module/apps/striking-stance.mjs");
      const a = {
        uuid: "Actor.strikingReviewLayout",
        type: "agent",
        isOwner: true,
        flags: {},
        system: { activeFeatNames: [] }
      };
      globalThis.game = { ...oldGame, user: { isGM: true }, actors: [a], messages: [] };
      await reviewStrikingAttack(a);
      await render(page, height);
      await page.locator("[name=confirmed]").check();
      await page.locator("[name=closeUnused]").check();
      await page.locator("#confirm").scrollIntoViewIfNeeded();
      const b = await page.locator("#confirm").boundingBox();
      expect(b.y).toBeGreaterThanOrEqual(0);
      expect(b.y + b.height).toBeLessThanOrEqual(height);
      await expect(page.locator("body")).toContainText("grants no new attack");
    } finally {
      globalThis.game = oldGame;
      content = oldContent;
    }
  });

for (const height of [768, 1000])
  test(`Reach geometry keeps explicit adjacency and GC confirmation accessible at ${height}px`, async ({ page }) => {
    const previous = content;
    try {
      const { reachContextContent } = await import("../../module/apps/reach.mjs");
      content = '<div class="spycraft2-roll-options">' + reachContextContent() + "</div>";
      await render(page, height);
      await page.locator("[name=reachAdjacency]").selectOption("adjacent");
      await page.locator("[name=reachGeometryConfirmed]").check();
      await page.locator("#confirm").scrollIntoViewIfNeeded();
      const b = await page.locator("#confirm").boundingBox();
      expect(b.y).toBeGreaterThanOrEqual(0);
      expect(b.y + b.height).toBeLessThanOrEqual(height);
      await expect(page.locator("body")).toContainText("no token measurement");
    } finally {
      content = previous;
    }
  });

for (const height of [768, 1000])
  test(`Thread the Needle source outcome and release geometry remain reachable at ${height}px`, async ({ page }) => {
    const previous = content,
      oldGame = game;
    try {
      const { manageThreadNeedle, threadNeedleSource } = await import("../../module/apps/thread-needle.mjs"),
        a = { uuid: "Actor.threadLayout", type: "agent", isOwner: true, name: "Actual staff user" },
        target = {
          uuid: "Actor.threadTargetLayout",
          type: "agent",
          isOwner: true,
          name: "Actual held target ".repeat(10)
        },
        p = {
          version: 1,
          key: "threadNeedle",
          source: "Thread the Needle",
          feat: "Staff Basics",
          weaponId: "staff",
          targetUuid: target.uuid,
          attackAction: "standard",
          fullActionConfirmed: false,
          onlyFeatTrickConfirmed: true,
          attackBonus: 0,
          damageBonus: 0,
          threatIncrease: 0,
          grip: { hands: 2, required: 2, attackPenalty: 0 }
        },
        m = {
          id: "threadLayoutHit",
          uuid: "ChatMessage.threadLayoutHit",
          flags: {
            spycraft2: {
              actorUuid: a.uuid,
              checkKind: "attack",
              weaponUuid: a.uuid + ".Item.staff",
              resolved: true,
              successConfirmed: true,
              rawTotal: 15,
              effectiveTotal: 15,
              naturalDie: 12,
              rollData: { total: 3 },
              attackContext: {
                meleeTrick: p,
                meleeFeatTrick: p.key,
                targetActorUuid: target.uuid,
                attackAction: "standard",
                ranged: false
              }
            }
          }
        };
      globalThis.game = { ...oldGame, user: { isGM: true }, actors: [a, target], messages: [m] };
      m.flags.spycraft2.threadNeedleHold = {
        version: 1,
        state: "active",
        operationId: "layoutHold",
        effectId: "heldLayout",
        proof: threadNeedleSource(a, m).proof
      };
      await manageThreadNeedle(a);
      await render(page, height);
      await expect(page.locator("[name=sourceMessage] option")).toHaveCount(1);
      await expect(page.locator("[name=sourceMessage] option")).toContainText("active");
      await page.locator("[name=operation]").selectOption("escape");
      await page.locator("[name=escapeMessage]").fill("ChatMessage.actualEscape");
      await expect(page.locator("body")).toContainText("required immediate Standard Move");
      await page.locator("[name=operation]").selectOption("movedBeyond");
      await page.locator("[name=separationFeet]").fill("10");
      for (const key of ["holderMovedConfirmed", "confirmed"]) {
        await page.locator("[name=" + key + "]").scrollIntoViewIfNeeded();
        await page.locator("[name=" + key + "]").check();
      }
      await page.locator("#confirm").scrollIntoViewIfNeeded();
      const b = await page.locator("#confirm").boundingBox();
      expect(b.y).toBeGreaterThanOrEqual(0);
      expect(b.y + b.height).toBeLessThanOrEqual(height);
      await expect(page.locator("body")).toContainText("preserves independent holds");
    } finally {
      content = previous;
      globalThis.game = oldGame;
    }
  });

test("routine attack shows target, action and range while retaining every optional form value", async ({ page }) => {
  const previous = content;
  const source = new SpycraftActor();
  source.items = [];
  source.system = { activeFeatNames: [], classLevels: {} };
  try {
    await source.rollAttack(
      { id: "compact", type: "weapon", name: "Test pistol", system: { proficiency: "handgun", range: 25 } },
      { askContext: true }
    );
    await render(page, 768, content);
    const before = await page.locator("form").evaluate(form => [...new FormData(form)].sort());
    const i18nUrl = `data:text/javascript;base64,${Buffer.from(readFileSync(new URL("../../module/i18n.mjs", import.meta.url), "utf8")).toString("base64")}`;
    const uxSource = readFileSync(new URL("../../module/apps/attack-dialog-ux.mjs", import.meta.url), "utf8")
      .replace('"../i18n.mjs"', JSON.stringify(i18nUrl))
      .replace('"./dialog-sections.mjs"', JSON.stringify(uiModuleUrl("module/apps/dialog-sections.mjs")))
      .replace('"./resolution-guide.mjs"', JSON.stringify(uiModuleUrl("module/apps/resolution-guide.mjs")));
    await page.evaluate(
      async url => {
        const { enhanceAttackDialog } = await import(url);
        enhanceAttackDialog(null, { element: document.querySelector("dialog") });
        enhanceAttackDialog(null, { element: document.querySelector("dialog") });
      },
      `data:text/javascript;base64,${Buffer.from(uxSource).toString("base64")}`
    );
    expect(await page.locator("form").evaluate(form => [...new FormData(form)].sort())).toEqual(before);
    await expect(page.locator('[name="attackAction"]')).toHaveValue("standard");
    await expect(page.locator('[name="targetActorUuid"]')).toBeVisible();
    await expect(page.locator('[name="distanceFeet"]')).toBeVisible();
    await expect(page.locator('[name="aimed"]')).toBeHidden();
    await expect(page.locator(".sc2-attack-circumstances")).not.toHaveAttribute("open");
    await page.getByText("Special circumstances", { exact: true }).click();
    await page.getByText("Aim and Brace", { exact: true }).click();
    await page.locator('[name="aimed"]').check();
    await expect(page.locator(".sc2-attack-circumstances > summary")).toContainText("1 set");
    await page.locator(".sc2-attack-circumstances > summary").click();
    expect(await page.locator("form").evaluate(form => new FormData(form).get("aimed"))).toBe("on");
  } finally {
    content = previous;
  }
});
