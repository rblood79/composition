var e=`/* ============================================================
 * AUTO-GENERATED from catalog DateInput — DO NOT EDIT MANUALLY
 * Source: packages/shared/src/catalog/generated/componentRulesTable.ts
 * Archetype: input-base
 * ============================================================ */

@layer components {

.react-aria-DateInput {
  /* Base styles — archetype: input-base */
    display: flex;
    align-items: center;
    box-sizing: border-box;
    font-family: var(--font-sans);

  /* Container styles (ADR-071 + ADR-083 Phase 1) */
  width: 100%;
  display: inline-flex;

  /* Default variant */
  background: var(--bg-inset);
  color: var(--fg);
  border: var(--border-width-thin) solid var(--border);

  /* Default size */
  height: auto;
  padding: calc((var(--catalog-token-size-height-M) - var(--catalog-token-text-sm) * var(--catalog-token-text-sm--line-height) - 2 * var(--border-width-thin)) / 2) var(--catalog-token-date-input-padding-x-M, calc(var(--catalog-token-size-height-M) * 3 / 8));
  font-size: var(--catalog-token-text-sm);
  border-radius: 8px;
  line-height: var(--catalog-token-text-sm--line-height);
  border-width: var(--border-width-thin);
  min-height: var(--catalog-token-size-height-M);
}

.react-aria-DateInput:where([data-variant="default"]) {
  background: var(--bg-inset);
  color: var(--fg);
  border-color: var(--border);
}

.react-aria-DateInput:where([data-variant="default"][data-hovered]) {
  background: var(--bg-inset);
  border-color: var(--border-hover);
}

.react-aria-DateInput:where([data-variant="default"][data-pressed]) {
  background: var(--bg-inset);
}

.react-aria-DateInput:where([data-variant="accent"]) {
  background: var(--bg-inset);
  color: var(--fg);
  border-color: var(--accent-content);
}

.react-aria-DateInput:where([data-variant="accent"][data-hovered]) {
  background: var(--bg-inset);
  border-color: var(--accent-content-hover);
}

.react-aria-DateInput:where([data-variant="accent"][data-pressed]) {
  background: var(--bg-inset);
}

.react-aria-DateInput:where([data-variant="negative"]) {
  background: var(--bg-inset);
  color: var(--fg);
  border-color: var(--negative);
}

.react-aria-DateInput:where([data-variant="negative"][data-hovered]) {
  background: var(--bg-inset);
  border-color: var(--negative-hover, color-mix(in srgb, var(--negative) 85%, black));
}

.react-aria-DateInput:where([data-variant="negative"][data-pressed]) {
  background: var(--bg-inset);
}

.react-aria-DateInput[data-size="XS"] {
  height: auto;
  padding: calc((var(--catalog-token-size-height-XS) - var(--catalog-token-text-2xs) * var(--catalog-token-text-2xs--line-height) - 2 * var(--border-width-thin)) / 2) var(--catalog-token-date-input-padding-x-XS, calc(var(--catalog-token-size-height-XS) * 3 / 8));
  font-size: var(--catalog-token-text-2xs);
  border-radius: var(--catalog-token-radius-xs);
  line-height: var(--catalog-token-text-2xs--line-height);
  border-width: var(--border-width-thin);
  min-height: var(--catalog-token-size-height-XS);
}

.react-aria-DateInput[data-size="S"] {
  height: auto;
  padding: calc((var(--catalog-token-size-height-S) - var(--catalog-token-text-xs) * var(--catalog-token-text-xs--line-height) - 2 * var(--border-width-thin)) / 2) var(--catalog-token-date-input-padding-x-S, calc(var(--catalog-token-size-height-S) * 3 / 8));
  font-size: var(--catalog-token-text-xs);
  border-radius: 7px;
  line-height: var(--catalog-token-text-xs--line-height);
  border-width: var(--border-width-thin);
  min-height: var(--catalog-token-size-height-S);
}

.react-aria-DateInput[data-size="M"] {
  height: auto;
  padding: calc((var(--catalog-token-size-height-M) - var(--catalog-token-text-sm) * var(--catalog-token-text-sm--line-height) - 2 * var(--border-width-thin)) / 2) var(--catalog-token-date-input-padding-x-M, calc(var(--catalog-token-size-height-M) * 3 / 8));
  font-size: var(--catalog-token-text-sm);
  border-radius: 8px;
  line-height: var(--catalog-token-text-sm--line-height);
  border-width: var(--border-width-thin);
  min-height: var(--catalog-token-size-height-M);
}

.react-aria-DateInput[data-size="L"] {
  height: auto;
  padding: calc((var(--catalog-token-size-height-L) - var(--catalog-token-text-base) * var(--catalog-token-text-base--line-height) - 2 * var(--border-width-thin)) / 2) var(--catalog-token-date-input-padding-x-L, calc(var(--catalog-token-size-height-L) * 3 / 8));
  font-size: var(--catalog-token-text-base);
  border-radius: 9px;
  line-height: var(--catalog-token-text-base--line-height);
  border-width: var(--border-width-thin);
  min-height: var(--catalog-token-size-height-L);
}

.react-aria-DateInput[data-size="XL"] {
  height: auto;
  padding: calc((var(--catalog-token-size-height-XL) - var(--catalog-token-text-lg) * var(--catalog-token-text-lg--line-height) - 2 * var(--border-width-thin)) / 2) var(--catalog-token-date-input-padding-x-XL, calc(var(--catalog-token-size-height-XL) * 3 / 8));
  font-size: var(--catalog-token-text-lg);
  border-radius: 10px;
  line-height: var(--catalog-token-text-lg--line-height);
  border-width: var(--border-width-thin);
  min-height: var(--catalog-token-size-height-XL);
}

.react-aria-DateInput.react-aria-DateInput:where([data-focus-visible]) {
  outline: var(--focus-ring-width) solid var(--focus-ring);
}

.react-aria-DateInput.react-aria-DateInput:where([data-focus-visible]) {
  outline-offset: var(--focus-ring-offset);
}

.react-aria-DateInput.react-aria-DateInput:where([data-disabled]) {
  opacity: 1;
}

.react-aria-DateInput.react-aria-DateInput:where([data-disabled]) {
  cursor: not-allowed;
}

.react-aria-DateInput.react-aria-DateInput:where([data-disabled]) {
  pointer-events: none;
}

.react-aria-DateInput.react-aria-DateInput:where([data-quiet]) {
  background: transparent;
}

.react-aria-DateInput.react-aria-DateInput:where([data-hovered]) {
  border-color: var(--border-hover);
}

.react-aria-DateInput.react-aria-DateInput:where([data-invalid]) {
  border-color: var(--negative);
}

.react-aria-DateInput.react-aria-DateInput:where([data-focus-within]) {
  border-color: var(--accent-content);
}

.react-aria-DateInput.react-aria-DateInput:where([data-focus-within][data-invalid]) {
  border-color: var(--negative);
}

.react-aria-DateInput.react-aria-DateInput:where([data-quiet]) {
  border-color: transparent;
}

.react-aria-DateInput.react-aria-DateInput:where([data-quiet]) {
  box-shadow: none;
}

.react-aria-DateInput.react-aria-DateInput:where([data-quiet]) {
  border-radius: 0;
}

.react-aria-DateInput.react-aria-DateInput:where([data-quiet]) {
  border-bottom: 1px solid var(--border);
}

.react-aria-DateInput.react-aria-DateInput:where([data-quiet][data-hovered]) {
  border-bottom-color: var(--border-hover);
}

.react-aria-DateInput.react-aria-DateInput:where([data-quiet][data-invalid]) {
  border-bottom-color: var(--negative);
}

.react-aria-DateInput.react-aria-DateInput:where([data-quiet][data-focus-within]) {
  border-bottom-color: var(--accent-content);
}

.react-aria-DateInput.react-aria-DateInput:where([data-quiet][data-focus-within][data-invalid]) {
  border-bottom-color: var(--negative);
}

.react-aria-DateInput.react-aria-DateInput:where([data-focus-within]) {
  outline: 2px solid var(--accent-content);
}

.react-aria-DateInput.react-aria-DateInput:where([data-quiet][data-focus-within]) {
  outline: none;
}

.react-aria-DateInput.react-aria-DateInput:where([data-focus-within][data-invalid]) {
  outline-color: var(--negative);
}

.react-aria-DateInput.react-aria-DateInput:where([data-quiet][data-focus-within]) {
  outline-color: currentcolor;
}

.react-aria-DateInput.react-aria-DateInput:where([data-focus-within]) {
  outline-offset: -1px;
}

/* ── Tier 2: Composite Delegation ── */

.react-aria-DateInput .react-aria-DateSegment {
  padding: 0 2px;
  border: none;
  background: transparent;
  height: auto;
  font-variant-numeric: tabular-nums;
  text-align: end;
  color: var(--fg);
  border-radius: var(--catalog-token-radius-xs);
  transition: all 150ms ease;
}

.react-aria-DateInput .react-aria-DateSegment:where([data-type="literal"]) {
  padding: 0;
}

.react-aria-DateInput .react-aria-DateSegment:where([data-placeholder]) {
  color: var(--fg-muted);
  opacity: 0.6;
}

.react-aria-DateInput .react-aria-DateSegment:where(:focus) {
  color: var(--fg);
  background: var(--accent-subtle);
  outline: none;
  border-radius: var(--catalog-token-radius-xs);
  caret-color: transparent;
}

.react-aria-DateInput .react-aria-DateSegment:where([data-invalid]) {
  color: var(--negative);
}

.react-aria-DateInput .react-aria-DateSegment:where([data-invalid]:focus) {
  background: var(--negative);
  color: var(--color-white);
}

.react-aria-DateInput .react-aria-DateSegment:where([data-disabled]) {
  color: color-mix(in srgb, var(--fg) 38%, transparent);
  cursor: not-allowed;
}


@media (forced-colors: active) {
  .react-aria-DateInput {
    forced-color-adjust: auto;
  }
}


  .react-aria-DateInput {
    white-space: nowrap;
    forced-color-adjust: none;
    transition: border-color 200ms ease, color 200ms ease;
  }


} /* @layer components */`;export{e as default};