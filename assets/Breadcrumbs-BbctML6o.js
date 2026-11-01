var e=`/* ============================================================
 * AUTO-GENERATED from catalog Breadcrumbs — DO NOT EDIT MANUALLY
 * Source: packages/shared/src/catalog/generated/componentRulesTable.ts
 * Archetype: simple
 * ============================================================ */

@layer components {

.react-aria-Breadcrumbs {
  /* Base styles — archetype: simple */
    display: inline-flex;
    align-items: center;
    box-sizing: border-box;

  /* Container styles (ADR-071 + ADR-083 Phase 1) */
  display: flex;
  flex-direction: row;
  flex-wrap: nowrap;
  align-items: center;

  /* Default variant */
  background: var(--bg);
  color: var(--fg-muted);
  border: none;

  /* Default size */
  height: auto;
  padding: 0px 0px;
  font-size: var(--catalog-token-text-sm);
  border-radius: var(--catalog-token-radius-none);
  min-height: var(--catalog-token-size-height-M);
  gap: 2px;
}

.react-aria-Breadcrumbs:where([data-variant="default"]) {
  background: var(--bg);
  color: var(--fg-muted);
}

.react-aria-Breadcrumbs:where([data-variant="default"][data-hovered]) {
  background: var(--bg);
  color: var(--fg);
}

.react-aria-Breadcrumbs:where([data-variant="default"][data-pressed]) {
  background: var(--bg);
}

.react-aria-Breadcrumbs[data-size="S"] {
  height: auto;
  padding: 0px 0px;
  font-size: var(--catalog-token-text-xs);
  border-radius: var(--catalog-token-radius-none);
  min-height: var(--catalog-token-size-height-S);
}

.react-aria-Breadcrumbs[data-size="M"] {
  height: auto;
  padding: 0px 0px;
  font-size: var(--catalog-token-text-sm);
  border-radius: var(--catalog-token-radius-none);
  min-height: var(--catalog-token-size-height-M);
  gap: 2px;
}

.react-aria-Breadcrumbs[data-size="L"] {
  height: auto;
  padding: 0px 0px;
  font-size: var(--catalog-token-text-base);
  border-radius: var(--catalog-token-radius-none);
  min-height: var(--catalog-token-size-height-L);
  gap: 4px;
}

.react-aria-Breadcrumbs.react-aria-Breadcrumbs:where([data-focus-visible]) {
  outline: var(--focus-ring-width) solid var(--focus-ring);
  outline-offset: var(--focus-ring-offset);
}

.react-aria-Breadcrumbs.react-aria-Breadcrumbs:where([data-disabled]) {
  opacity: 1;
  cursor: default;
  pointer-events: auto;
}

.react-aria-Breadcrumbs.react-aria-Breadcrumbs .react-aria-Link:where([data-focus-visible])::after {
  content: "";
  position: absolute;
  inset: -2px -4px;
  border-radius: var(--catalog-token-radius-xs);
  border: 2px solid var(--breadcrumb-accent);
}

@media (forced-colors: active) {
  .react-aria-Breadcrumbs {
    forced-color-adjust: auto;
  }
}


} /* @layer components */`;export{e as default};