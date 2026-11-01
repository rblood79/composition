var e=`/* ============================================================
 * AUTO-GENERATED from catalog ProgressBarValue — DO NOT EDIT MANUALLY
 * Source: packages/shared/src/catalog/generated/componentRulesTable.ts
 * Archetype: progress
 * ============================================================ */

@layer components {

.react-aria-ProgressBarValue {
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
  background: transparent;
  color: var(--fg);
  border: none;

  /* Default size */
  padding: 0px 0px;
  font-size: var(--catalog-token-text-sm);
  border-radius: var(--catalog-token-radius-none);
  line-height: var(--catalog-token-text-sm--line-height);
}

.react-aria-ProgressBarValue:where([data-variant="default"]) {
  background: transparent;
  color: var(--fg);
}

.react-aria-ProgressBarValue:where([data-variant="default"][data-hovered]) {
  background: transparent;
}

.react-aria-ProgressBarValue:where([data-variant="default"][data-pressed]) {
  background: transparent;
}

.react-aria-ProgressBarValue:where([data-variant="default"][data-static-color="black"]) {
  background: transparent;
  color: #000000;
}

.react-aria-ProgressBarValue:where([data-variant="default"][data-static-color="black"][data-hovered]) {
  background: transparent;
  color: #000000;
}

.react-aria-ProgressBarValue:where([data-variant="default"][data-static-color="black"][data-pressed]) {
  background: transparent;
  color: #000000;
}

.react-aria-ProgressBarValue:where([data-variant="default"][data-static-color="white"]) {
  background: transparent;
  color: #ffffff;
}

.react-aria-ProgressBarValue:where([data-variant="default"][data-static-color="white"][data-hovered]) {
  background: transparent;
  color: #ffffff;
}

.react-aria-ProgressBarValue:where([data-variant="default"][data-static-color="white"][data-pressed]) {
  background: transparent;
  color: #ffffff;
}

.react-aria-ProgressBarValue[data-size="S"] {
  padding: 0px 0px;
  font-size: var(--catalog-token-text-xs);
  border-radius: var(--catalog-token-radius-none);
  line-height: var(--catalog-token-text-xs--line-height);
}

.react-aria-ProgressBarValue[data-size="M"] {
  padding: 0px 0px;
  font-size: var(--catalog-token-text-sm);
  border-radius: var(--catalog-token-radius-none);
  line-height: var(--catalog-token-text-sm--line-height);
}

.react-aria-ProgressBarValue[data-size="L"] {
  padding: 0px 0px;
  font-size: var(--catalog-token-text-base);
  border-radius: var(--catalog-token-radius-none);
  line-height: var(--catalog-token-text-base--line-height);
}

.react-aria-ProgressBarValue[data-size="XL"] {
  padding: 0px 0px;
  font-size: var(--catalog-token-text-lg);
  border-radius: var(--catalog-token-radius-none);
  line-height: var(--catalog-token-text-lg--line-height);
}

.react-aria-ProgressBarValue[data-focus-visible] {
  outline: var(--focus-ring-width) solid var(--focus-ring);
  outline-offset: var(--focus-ring-offset);
}

.react-aria-ProgressBarValue[data-disabled] {
  opacity: 0.38;
  cursor: not-allowed;
  pointer-events: none;
}

@media (forced-colors: active) {
  .react-aria-ProgressBarValue {
    forced-color-adjust: auto;
  }
}

@media (prefers-reduced-motion: reduce) {
  .react-aria-ProgressBarValue {
    transition-duration: 0s !important;
  }
}

} /* @layer components */`;export{e as default};