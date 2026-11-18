import js from "@eslint/js";
import globals from "globals";

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
    "Actor",
    "Item",
    "ActiveEffect",
    "Combat",
    "Combatant",
    "fromUuid",
    "fromUuidSync",
    "Dialog",
    "TextEditor",
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
      "no-empty": ["error", { allowEmptyCatch: true }]
    }
  },
  {
    files: ["tools/**/*.mjs", "eslint.config.mjs"],
    languageOptions: { globals: { ...globals.node, ...globals.browser, ...foundryGlobals } },
    rules: { "no-global-assign": "off", "no-import-assign": "off" }
  }
];
