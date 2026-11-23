import js from "@eslint/js";
import globals from "globals";

/**
 * Foundry v1 and deprecated globals: they still resolve at runtime in v14 but warn or disappear, so the system reaches
 * the namespaced versions instead (foundry.applications.api.DialogV2, foundry.utils.mergeObject, …).
 */
const legacyGlobals = [
  ["Dialog", "Use foundry.applications.api.DialogV2 (or systemDialog from apps/dialog-theme.mjs)."],
  ["TextEditor", "Use foundry.applications.ux.TextEditor.implementation (or enrich() from sheets/enrich.mjs)."],
  ["renderTemplate", "Use foundry.applications.handlebars.renderTemplate."],
  ["loadTemplates", "List partials in the sheet part's templates instead."],
  ["mergeObject", "Use foundry.utils.mergeObject."],
  ["getProperty", "Use foundry.utils.getProperty."],
  ["setProperty", "Use foundry.utils.setProperty."],
  ["duplicate", "Use foundry.utils.deepClone."],
  ["$", "Foundry v14 has no jQuery; use the DOM."],
  ["jQuery", "Foundry v14 has no jQuery; use the DOM."]
].map(([name, message]) => ({ name, message }));

/** Globals Foundry provides to the system at runtime. */
const foundryGlobals = Object.fromEntries(
  [
    "foundry",
    "game",
    "ui",
    "canvas",
    "CONFIG",
    "CONST",
    "Hooks",
    "Handlebars",
    "Roll",
    "ChatMessage",
    "Macro",
    "Actor",
    "Item",
    "ActiveEffect",
    "Combat",
    "Combatant",
    "fromUuid",
    "fromUuidSync",
    "DOMParser"
  ].map(name => [name, "readonly"])
);

export default [
  { ignores: ["node_modules/", "packs/", "test-results/", "playwright-report/", "module/rules/*tables.mjs"] },
  js.configs.recommended,
  {
    files: ["**/*.mjs"],
    languageOptions: {
      ecmaVersion: "latest",
      sourceType: "module",
      globals: { ...globals.browser, ...foundryGlobals }
    },
    rules: {
      // Reported, not failed: the older modules have many leftovers that are being cleared as files are split.
      "no-unused-vars": [
        "warn",
        { args: "none", caughtErrors: "none", varsIgnorePattern: "^_", ignoreRestSiblings: true }
      ],
      "no-empty": ["error", { allowEmptyCatch: true }],
      "no-restricted-globals": ["error", ...legacyGlobals]
    }
  },
  {
    files: ["module/**/*.mjs", "spycraft2.mjs"],
    rules: {
      "no-restricted-syntax": [
        "error",
        {
          selector: "ReturnStatement > CallExpression[callee.object.property.name='notifications']",
          message:
            "A notification is truthy, so the caller reads this as done. Return refuse(…), refuseStep(…) or decline(…) from error-notices.mjs."
        }
      ]
    }
  },
  {
    files: ["tools/**/*.mjs", "eslint.config.mjs"],
    languageOptions: { globals: { ...globals.node, ...globals.browser, ...foundryGlobals } },
    rules: { "no-global-assign": "off", "no-import-assign": "off" }
  }
];
