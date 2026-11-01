var e=`/* ============================================================
 * AUTO-GENERATED from catalog Link — DO NOT EDIT MANUALLY
 * Source: packages/shared/src/catalog/generated/componentRulesTable.ts
 * Archetype: button
 * ============================================================ */

@layer components {

.react-aria-Link {
  /* Base styles — archetype: button */
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: fit-content;
    box-sizing: border-box;
    cursor: pointer;
    user-select: none;
    transition: background 0.15s ease, border-color 0.15s ease, transform 0.15s ease;
    font-family: var(--font-sans);

  /* Container styles (ADR-071 + ADR-083 Phase 1) */
  width: fit-content;
  display: inline-flex;
  align-items: center;
  justify-content: center;

  /* Default variant */
  background: var(--bg);
  color: var(--accent-content);
  border: none;

  /* Default size */
  height: auto;
  padding: 0px 0px;
  font-size: var(--catalog-token-text-sm);
  border-radius: var(--catalog-token-radius-none);
  line-height: var(--catalog-token-text-sm--line-height);
  font-weight: 400;
}

.react-aria-Link:where([data-variant="primary"]) {
  background: transparent;
}

.react-aria-Link:where([data-variant="secondary"]) {
  background: transparent;
}

.react-aria-Link:where([data-variant="primary"]) {
  color: var(--accent-content);
}

.react-aria-Link:where([data-variant="primary"][data-hovered]) {
  color: var(--accent-content-hover);
}

.react-aria-Link:where([data-variant="primary"][data-static-color="black"]) {
  color: #000000;
}

.react-aria-Link:where([data-variant="primary"][data-static-color="black"][data-hovered]) {
  color: #000000;
}

.react-aria-Link:where([data-variant="primary"][data-static-color="black"][data-pressed]) {
  color: #000000;
}

.react-aria-Link:where([data-variant="primary"][data-static-color="white"]) {
  color: #ffffff;
}

.react-aria-Link:where([data-variant="primary"][data-static-color="white"][data-hovered]) {
  color: #ffffff;
}

.react-aria-Link:where([data-variant="primary"][data-static-color="white"][data-pressed]) {
  color: #ffffff;
}

.react-aria-Link:where([data-variant="secondary"]) {
  color: var(--fg);
}

.react-aria-Link:where([data-variant="secondary"][data-hovered]) {
  color: var(--accent-content);
}

.react-aria-Link:where([data-variant="secondary"][data-static-color="black"]) {
  color: #000000;
}

.react-aria-Link:where([data-variant="secondary"][data-static-color="black"][data-hovered]) {
  color: #000000;
}

.react-aria-Link:where([data-variant="secondary"][data-static-color="black"][data-pressed]) {
  color: #000000;
}

.react-aria-Link:where([data-variant="secondary"][data-static-color="white"]) {
  color: #ffffff;
}

.react-aria-Link:where([data-variant="secondary"][data-static-color="white"][data-hovered]) {
  color: #ffffff;
}

.react-aria-Link:where([data-variant="secondary"][data-static-color="white"][data-pressed]) {
  color: #ffffff;
}

.react-aria-Link[data-icon-only] {
  padding: 0;
  aspect-ratio: 1;
}

.react-aria-Link[data-size="XS"] {
  height: auto;
  padding: 0px 0px;
  font-size: var(--catalog-token-text-2xs);
  border-radius: var(--catalog-token-radius-none);
  line-height: var(--catalog-token-text-2xs--line-height);
  font-weight: 400;
}

.react-aria-Link[data-size="S"] {
  height: auto;
  padding: 0px 0px;
  font-size: var(--catalog-token-text-xs);
  border-radius: var(--catalog-token-radius-none);
  line-height: var(--catalog-token-text-xs--line-height);
  font-weight: 400;
}

.react-aria-Link[data-size="M"] {
  height: auto;
  padding: 0px 0px;
  font-size: var(--catalog-token-text-sm);
  border-radius: var(--catalog-token-radius-none);
  line-height: var(--catalog-token-text-sm--line-height);
  font-weight: 400;
}

.react-aria-Link[data-size="L"] {
  height: auto;
  padding: 0px 0px;
  font-size: var(--catalog-token-text-base);
  border-radius: var(--catalog-token-radius-none);
  line-height: var(--catalog-token-text-base--line-height);
  font-weight: 400;
}

.react-aria-Link[data-size="XL"] {
  height: auto;
  padding: 0px 0px;
  font-size: var(--catalog-token-text-lg);
  border-radius: var(--catalog-token-radius-none);
  line-height: var(--catalog-token-text-lg--line-height);
  font-weight: 400;
}

.react-aria-Link.react-aria-Link:where([data-focus-visible]) {
  outline: var(--focus-ring-width) solid var(--focus-ring);
  outline-offset: var(--focus-ring-offset);
}

.react-aria-Link.react-aria-Link:where([data-disabled]) {
  opacity: 0.38;
  cursor: not-allowed;
  pointer-events: none;
}

.react-aria-Link.react-aria-Link:where([data-quiet]) {
  text-decoration: none;
}

.react-aria-Link.react-aria-Link:where([data-quiet][data-hovered]) {
  text-decoration: underline;
}

.react-aria-Link.react-aria-Link:where([data-hovered]) {
  text-decoration-thickness: 1.5px;
}

/* ── Tier 2: Composite Delegation ── */


@media (forced-colors: active) {
  .react-aria-Link {
    forced-color-adjust: auto;
  }
}

@media (prefers-reduced-motion: reduce) {
  .react-aria-Link {
    transition-duration: 0s !important;
  }
}

  .react-aria-Link {
    text-decoration: underline;
  }


} /* @layer components */`;export{e as default};