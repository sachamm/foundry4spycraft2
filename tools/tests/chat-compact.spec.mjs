import { test, expect } from "@playwright/test";
import { systemCss } from "../lib/system-css.mjs";
import { uiModuleUrl } from "../lib/ui-test-module.mjs";

// A pending attack card as Foundry v14 renders it, before the system's hooks run.
const card = `
  <ol id="chat-log" style="width:300px;list-style:none;padding:0">
  <li class="chat-message message flexcol sc2-card" data-message-id="m1">
    <header class="message-header flexrow">
      <h4 class="message-sender">Luka Petrov — Soldier 1 (Close protection)</h4>
      <span class="message-metadata"><time class="message-timestamp">1m ago</time></span>
      <span class="flavor-text">Attack: Stun gun, melee<br><small>Point blank: +1</small><br>Error range 1; threat range 18–20.</span>
    </header>
    <div class="message-content">
      <div class="dice-roll"><div class="dice-result"><div class="dice-formula">1d20 + 6</div><h4 class="dice-total">21</h4></div></div>
    </div>
    <div class="spycraft2 roll-controls"><button type="button" class="sc2-primary-action">Resolve vs Defense 11: hit</button></div>
  </li></ol>`;

async function render(page, { codename = "" } = {}) {
  await page.setContent(`<style>${systemCss()}</style><div class="theme-light">${card}</div>`);
  await page.evaluate(
    async ({ guidance, compact, codename }) => {
      window.game = {
        scenes: { get: () => null },
        actors: { get: id => (id === "a1" ? { system: { codename } } : null) }
      };
      const message = {
        isAuthor: true,
        speaker: { actor: "a1" },
        flags: { spycraft2: { checkKind: "attack", rawTotal: 21, actorUuid: "Actor.a1" } }
      };
      const html = document.querySelector(".chat-message");
      (await import(guidance)).renderCheckGuidance(message, message.flags.spycraft2, html, { isGM: false });
      const { compactChatCard } = await import(compact);
      compactChatCard(message, html);
      compactChatCard(message, html);
    },
    {
      guidance: uiModuleUrl("module/rolls/chat-guidance.mjs"),
      compact: uiModuleUrl("module/rolls/chat-compact.mjs"),
      codename
    }
  );
}

test("an attack card shows a short name and one header line, with the notes and guide behind Details", async ({
  page
}) => {
  await render(page);
  const sender = page.locator(".message-sender");
  await expect(sender).toHaveText("Luka Petrov");
  await expect(sender).toHaveAttribute("data-tooltip", "Luka Petrov — Soldier 1 (Close protection)");
  await expect(page.locator(".flavor-text")).toHaveText("Attack: Stun gun, melee");
  await expect(page.locator(".sc2-guide-title")).toHaveText(/Pending/);
  await expect(page.locator(".sc2-result-guide")).not.toContainText("Spend any action dice first");
  await expect(page.getByRole("img", { name: /Spend any action dice first/ })).toHaveAttribute("tabindex", "0");
  await expect(page.locator(".sc2-resolution-guide")).toHaveCount(0);
  const details = page.locator(".sc2-card-details");
  await expect(details).toHaveCount(1);
  await expect(details.locator(".sc2-card-notes p")).toHaveText([
    "Point blank: +1",
    "Error range 1; threat range 18–20."
  ]);
  await expect(details.getByText("Point blank: +1")).toBeHidden();
  await details.locator("summary").click();
  await expect(details.getByText("Point blank: +1")).toBeVisible();
  await expect(details.getByText("System:")).toBeVisible();
});

test("the header uses the code name when the agent has one", async ({ page }) => {
  await render(page, { codename: "Rook" });
  await expect(page.locator(".message-sender")).toHaveText("Rook");
});
