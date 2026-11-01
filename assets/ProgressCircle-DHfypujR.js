var e=`/* ============================================================
 * AUTO-GENERATED from catalog ProgressCircle — DO NOT EDIT MANUALLY
 * Source: packages/shared/src/catalog/generated/componentRulesTable.ts
 * Archetype: progress
 * ============================================================ */

@layer components {

.react-aria-ProgressCircle {
  /* Base styles — archetype: progress */
    display: grid;
    grid-template-areas: "label value" "track track";
    grid-template-columns: 1fr auto;
    box-sizing: border-box;

    .react-aria-Label { grid-area: label; }
    [slot="value"] { grid-area: value; }
    .bar { grid-area: track; }

  /* Container styles (ADR-071 + ADR-083 Phase 1) */
  display: grid;

  /* Default variant */
  background: var(--bg-muted);
  color: var(--fg);
  border: none;

  /* Default size */
  padding: 0px 0px;
  font-size: var(--catalog-token-text-sm);
  border-radius: var(--catalog-token-radius-full);
}

.react-aria-ProgressCircle:where([data-variant="default"]) {
  background: var(--bg-muted);
  color: var(--fg);
}

.react-aria-ProgressCircle:where([data-variant="default"][data-hovered]) {
  background: var(--bg-muted);
}

.react-aria-ProgressCircle:where([data-variant="default"][data-pressed]) {
  background: var(--bg-muted);
}

.react-aria-ProgressCircle:where([data-variant="default"][data-static-color="black"]) {
  background: #000000;
  color: #ffffff;
}

.react-aria-ProgressCircle:where([data-variant="default"][data-static-color="black"][data-hovered]) {
  background: #000000;
  color: #ffffff;
}

.react-aria-ProgressCircle:where([data-variant="default"][data-static-color="black"][data-pressed]) {
  background: #000000;
  color: #ffffff;
}

.react-aria-ProgressCircle:where([data-variant="default"][data-static-color="white"]) {
  background: #ffffff;
  color: #000000;
}

.react-aria-ProgressCircle:where([data-variant="default"][data-static-color="white"][data-hovered]) {
  background: #ffffff;
  color: #000000;
}

.react-aria-ProgressCircle:where([data-variant="default"][data-static-color="white"][data-pressed]) {
  background: #ffffff;
  color: #000000;
}

.react-aria-ProgressCircle[data-size="S"] {
  padding: 0px 0px;
  font-size: var(--catalog-token-text-xs);
  border-radius: var(--catalog-token-radius-full);
}

.react-aria-ProgressCircle[data-size="M"] {
  padding: 0px 0px;
  font-size: var(--catalog-token-text-sm);
  border-radius: var(--catalog-token-radius-full);
}

.react-aria-ProgressCircle[data-size="L"] {
  padding: 0px 0px;
  font-size: var(--catalog-token-text-base);
  border-radius: var(--catalog-token-radius-full);
}

.react-aria-ProgressCircle[data-focus-visible] {
  outline: var(--focus-ring-width) solid var(--focus-ring);
  outline-offset: var(--focus-ring-offset);
}

.react-aria-ProgressCircle[data-disabled] {
  opacity: 0.38;
  cursor: not-allowed;
  pointer-events: none;
}

@media (forced-colors: active) {
  .react-aria-ProgressCircle {
    forced-color-adjust: auto;
  }
}

@media (prefers-reduced-motion: reduce) {
  .react-aria-ProgressCircle {
    transition-duration: 0s !important;
  }
}

} /* @layer components */`;export{e as default};