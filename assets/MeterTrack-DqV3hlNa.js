var e=`/* ============================================================
 * AUTO-GENERATED from catalog MeterTrack — DO NOT EDIT MANUALLY
 * Source: packages/shared/src/catalog/generated/componentRulesTable.ts
 * Archetype: progress
 * ============================================================ */

@layer components {

.react-aria-MeterTrack {
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
  border-radius: var(--catalog-token-radius-sm);
}

.react-aria-MeterTrack:where([data-variant="informative"]) {
  background: var(--bg-muted);
  color: var(--fg);
}

.react-aria-MeterTrack:where([data-variant="informative"][data-hovered]) {
  background: var(--bg-muted);
}

.react-aria-MeterTrack:where([data-variant="informative"][data-pressed]) {
  background: var(--bg-muted);
}

.react-aria-MeterTrack:where([data-variant="informative"][data-static-color="black"]) {
  background: #000000;
  color: #000000;
}

.react-aria-MeterTrack:where([data-variant="informative"][data-static-color="black"][data-hovered]) {
  background: #000000;
  color: #000000;
}

.react-aria-MeterTrack:where([data-variant="informative"][data-static-color="black"][data-pressed]) {
  background: #000000;
  color: #000000;
}

.react-aria-MeterTrack:where([data-variant="informative"][data-static-color="white"]) {
  background: #ffffff;
  color: #ffffff;
}

.react-aria-MeterTrack:where([data-variant="informative"][data-static-color="white"][data-hovered]) {
  background: #ffffff;
  color: #ffffff;
}

.react-aria-MeterTrack:where([data-variant="informative"][data-static-color="white"][data-pressed]) {
  background: #ffffff;
  color: #ffffff;
}

.react-aria-MeterTrack:where([data-variant="positive"]) {
  background: var(--bg-muted);
  color: var(--fg);
}

.react-aria-MeterTrack:where([data-variant="positive"][data-hovered]) {
  background: var(--bg-muted);
}

.react-aria-MeterTrack:where([data-variant="positive"][data-pressed]) {
  background: var(--bg-muted);
}

.react-aria-MeterTrack:where([data-variant="positive"][data-static-color="black"]) {
  background: #000000;
  color: #000000;
}

.react-aria-MeterTrack:where([data-variant="positive"][data-static-color="black"][data-hovered]) {
  background: #000000;
  color: #000000;
}

.react-aria-MeterTrack:where([data-variant="positive"][data-static-color="black"][data-pressed]) {
  background: #000000;
  color: #000000;
}

.react-aria-MeterTrack:where([data-variant="positive"][data-static-color="white"]) {
  background: #ffffff;
  color: #ffffff;
}

.react-aria-MeterTrack:where([data-variant="positive"][data-static-color="white"][data-hovered]) {
  background: #ffffff;
  color: #ffffff;
}

.react-aria-MeterTrack:where([data-variant="positive"][data-static-color="white"][data-pressed]) {
  background: #ffffff;
  color: #ffffff;
}

.react-aria-MeterTrack:where([data-variant="notice"]) {
  background: var(--bg-muted);
  color: var(--fg);
}

.react-aria-MeterTrack:where([data-variant="notice"][data-hovered]) {
  background: var(--bg-muted);
}

.react-aria-MeterTrack:where([data-variant="notice"][data-pressed]) {
  background: var(--bg-muted);
}

.react-aria-MeterTrack:where([data-variant="notice"][data-static-color="black"]) {
  background: #000000;
  color: #000000;
}

.react-aria-MeterTrack:where([data-variant="notice"][data-static-color="black"][data-hovered]) {
  background: #000000;
  color: #000000;
}

.react-aria-MeterTrack:where([data-variant="notice"][data-static-color="black"][data-pressed]) {
  background: #000000;
  color: #000000;
}

.react-aria-MeterTrack:where([data-variant="notice"][data-static-color="white"]) {
  background: #ffffff;
  color: #ffffff;
}

.react-aria-MeterTrack:where([data-variant="notice"][data-static-color="white"][data-hovered]) {
  background: #ffffff;
  color: #ffffff;
}

.react-aria-MeterTrack:where([data-variant="notice"][data-static-color="white"][data-pressed]) {
  background: #ffffff;
  color: #ffffff;
}

.react-aria-MeterTrack:where([data-variant="negative"]) {
  background: var(--bg-muted);
  color: var(--fg);
}

.react-aria-MeterTrack:where([data-variant="negative"][data-hovered]) {
  background: var(--bg-muted);
}

.react-aria-MeterTrack:where([data-variant="negative"][data-pressed]) {
  background: var(--bg-muted);
}

.react-aria-MeterTrack:where([data-variant="negative"][data-static-color="black"]) {
  background: #000000;
  color: #000000;
}

.react-aria-MeterTrack:where([data-variant="negative"][data-static-color="black"][data-hovered]) {
  background: #000000;
  color: #000000;
}

.react-aria-MeterTrack:where([data-variant="negative"][data-static-color="black"][data-pressed]) {
  background: #000000;
  color: #000000;
}

.react-aria-MeterTrack:where([data-variant="negative"][data-static-color="white"]) {
  background: #ffffff;
  color: #ffffff;
}

.react-aria-MeterTrack:where([data-variant="negative"][data-static-color="white"][data-hovered]) {
  background: #ffffff;
  color: #ffffff;
}

.react-aria-MeterTrack:where([data-variant="negative"][data-static-color="white"][data-pressed]) {
  background: #ffffff;
  color: #ffffff;
}

.react-aria-MeterTrack[data-size="S"] {
  padding: 0px 0px;
  font-size: var(--catalog-token-text-xs);
  border-radius: var(--catalog-token-radius-sm);
}

.react-aria-MeterTrack[data-size="M"] {
  padding: 0px 0px;
  font-size: var(--catalog-token-text-sm);
  border-radius: var(--catalog-token-radius-sm);
}

.react-aria-MeterTrack[data-size="L"] {
  padding: 0px 0px;
  font-size: var(--catalog-token-text-base);
  border-radius: var(--catalog-token-radius-lg);
}

.react-aria-MeterTrack[data-size="XL"] {
  padding: 0px 0px;
  font-size: var(--catalog-token-text-lg);
  border-radius: var(--catalog-token-radius-lg);
}

.react-aria-MeterTrack.react-aria-MeterTrack:where([data-disabled]) {
  opacity: 0.38;
  pointer-events: none;
}

@media (forced-colors: active) {
  .react-aria-MeterTrack {
    forced-color-adjust: auto;
  }
}

@media (prefers-reduced-motion: reduce) {
  .react-aria-MeterTrack {
    transition-duration: 0s !important;
  }
}

} /* @layer components */`;export{e as default};