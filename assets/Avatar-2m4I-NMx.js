var e=`/* ============================================================
 * AUTO-GENERATED from catalog Avatar — DO NOT EDIT MANUALLY
 * Source: packages/shared/src/catalog/generated/componentRulesTable.ts
 * Archetype: simple
 * ============================================================ */

@layer components {

.react-aria-Avatar {
  /* Base styles — archetype: simple */
    display: inline-flex;
    align-items: center;
    box-sizing: border-box;

  /* Container styles (ADR-071 + ADR-083 Phase 1) */
  display: flex;
  align-items: center;

  /* Default variant */
  background: var(--bg-muted);
  color: var(--fg);
  border: none;

  /* Default size */
  height: 32px;
  padding: 0px 0px;
  font-size: var(--catalog-token-text-sm);
  border-radius: var(--catalog-token-radius-full);
}

.react-aria-Avatar:where([data-variant="default"]) {
  background: var(--bg-muted);
  color: var(--fg);
}

.react-aria-Avatar:where([data-variant="default"][data-hovered]) {
  background: var(--bg-muted);
}

.react-aria-Avatar:where([data-variant="default"][data-pressed]) {
  background: var(--bg-muted);
}

.react-aria-Avatar[data-size="XS"] {
  height: 24px;
  padding: 0px 0px;
  font-size: var(--catalog-token-text-2xs);
  border-radius: var(--catalog-token-radius-full);
}

.react-aria-Avatar[data-size="S"] {
  height: 28px;
  padding: 0px 0px;
  font-size: var(--catalog-token-text-xs);
  border-radius: var(--catalog-token-radius-full);
}

.react-aria-Avatar[data-size="M"] {
  height: 32px;
  padding: 0px 0px;
  font-size: var(--catalog-token-text-sm);
  border-radius: var(--catalog-token-radius-full);
}

.react-aria-Avatar[data-size="L"] {
  height: 40px;
  padding: 0px 0px;
  font-size: var(--catalog-token-text-base);
  border-radius: var(--catalog-token-radius-full);
}

.react-aria-Avatar[data-size="XL"] {
  height: 48px;
  padding: 0px 0px;
  font-size: var(--catalog-token-text-lg);
  border-radius: var(--catalog-token-radius-full);
}

.react-aria-Avatar.react-aria-Avatar:where([data-disabled]) {
  opacity: 0.38;
}

@media (forced-colors: active) {
  .react-aria-Avatar {
    forced-color-adjust: auto;
  }
}


} /* @layer components */`;export{e as default};