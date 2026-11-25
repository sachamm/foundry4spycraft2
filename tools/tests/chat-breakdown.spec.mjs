import { test, expect } from "@playwright/test";
import { systemCss } from "../lib/system-css.mjs";
import { uiModuleUrl } from "../lib/ui-test-module.mjs";

// A roll card as Foundry v14 renders it, before the system's hooks run.
const card = `
  <ol id="chat-log" style="width:300px;list-style:none;padding:0">
  <li class="chat-message message flexcol sc2-card" data-message-id="m1">
    <header class="message-header flexrow">
      <h4 class="message-sender">Rook</h4>
      <span class="flavor-text">Attack: Stun gun, melee</span>
    </header>
    <div class="message-content">
      <div class="dice-roll"><div class="dice-result"><div class="dice-formula">1d20 + 6</div><h4 class="dice-total">21</h4></div></div>
    </div>
  </li></ol>`;

const attack = {
  checkKind: "attack",
  actorUuid: "Actor.a1",
  naturalDie: 14,
  rawTotal: 21,
  breakdown: [
    { label: "Base attack bonus", value: 3 },
    { label: "STR", value: 2 },
    { label: "Size <small>", value: 1 }
  ],
  pipelineModifiers: [{ id: "x", label: "Point blank", value: 1 }]
};

async function render(page, { check = attack, user = { isGM: false }, isAuthor = true, actor = null, blind = false }) {
  await page.setContent(`<style>${systemCss()}</style><div class="theme-light">${card}</div>`);
  return page.evaluate(
    async ({ url, check, user, isAuthor, actor, blind }) => {
      window.fromUuidSync = () => actor;
      const html = document.querySelector(".chat-message");
      const { renderCheckBreakdown } = await import(url);
      const message = { isAuthor, blind, flags: { spycraft2: check } };
      renderCheckBreakdown(message, html, user);
      renderCheckBreakdown(message, html, user);
      const result = html.querySelector(".dice-result");
      return {
        text: result.dataset.tooltip ?? null,
        html: result.dataset.tooltipHtml ?? null,
        tabIndex: result.getAttribute("tabindex"),
        description: result.getAttribute("aria-description"),
        height: html.getBoundingClientRect().height
      };
    },
    { url: uiModuleUrl("module/rolls/chat-breakdown.mjs"), check, user, isAuthor, actor, blind }
  );
}

test("the result of a roll card explains its total without making the card taller", async ({ page }) => {
  const plain = await render(page, { check: { checkKind: "note" } });
  expect(plain.text).toBeNull();
  const shown = await render(page, {});
  expect(shown.text).toBe("Die 14 · Base attack bonus +3 · STR +2 · Size <small> +1 · Point blank +1 · Total 21");
  expect(shown.html).toBe(
    "Die 14<br>Base attack bonus +3<br>STR +2<br>Size &lt;small&gt; +1<br>Point blank +1<br><strong>Total 21</strong>"
  );
  expect(shown.tabIndex).toBe("0");
  expect(shown.description).toBe(shown.text);
  expect(shown.height).toBe(plain.height);
});

test("an NPC's parts stay with those who may open it; an agent's are open to the table", async ({ page }) => {
  const onlooker = { isGM: false };
  expect(
    (await render(page, { isAuthor: false, user: onlooker, actor: { type: "npc", isOwner: false } })).text
  ).toBeNull();
  expect((await render(page, { isAuthor: false, user: onlooker, actor: null })).text).toBeNull();
  expect(
    (await render(page, { isAuthor: false, user: onlooker, actor: { type: "agent", isOwner: false } })).text
  ).toContain("Total 21");
  expect((await render(page, { isAuthor: false, user: { isGM: true }, actor: { type: "npc" } })).text).toContain(
    "Total 21"
  );
  // A secret roll explains nothing to the player who made it.
  expect((await render(page, { blind: true, user: onlooker })).text).toBeNull();
});
