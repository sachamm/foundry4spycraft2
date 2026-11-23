/**
 * Catches mistakes in the stylesheets that the layout tests cannot see. Formatting is Prettier's job.
 *
 * Two rules are warnings because the stylesheets already break them (25 repeated selectors, 7 `!important`).
 * Merging a repeated selector can change which rule wins, so each needs a look; `npm run lint:css` caps the count
 * with --max-warnings so it can only go down.
 */
export default {
  rules: {
    "no-duplicate-selectors": [true, { severity: "warning" }],
    "declaration-block-no-duplicate-properties": [true, { ignore: ["consecutive-duplicates-with-different-values"] }],
    "declaration-block-no-shorthand-property-overrides": true,
    "property-no-unknown": true,
    "unit-no-unknown": true,
    "color-no-invalid-hex": true,
    "function-calc-no-unspaced-operator": true,
    "selector-pseudo-class-no-unknown": true,
    "selector-pseudo-element-no-unknown": true,
    "block-no-empty": true,
    "no-invalid-double-slash-comments": true,
    "declaration-no-important": [true, { severity: "warning" }]
  }
};
