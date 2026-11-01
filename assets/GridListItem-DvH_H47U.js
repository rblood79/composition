var e=`/* ============================================================
 * AUTO-GENERATED from catalog GridListItem — DO NOT EDIT MANUALLY
 * Source: packages/shared/src/catalog/generated/componentRulesTable.ts
 * Archetype: default
 * ============================================================ */

@layer components {

.react-aria-GridListItem {
  /* Base styles — archetype: default */
    display: block;
    box-sizing: border-box;
    font-family: var(--font-sans);

  /* Container styles (ADR-071 + ADR-083 Phase 1) */
  display: grid;
  position: relative;

  /* Default variant */
  background: transparent;
  color: var(--fg);
  border: var(--border-width-none) solid var(--border);

  /* Default size */
  height: auto;
  padding: 8px 12px;
  font-size: var(--catalog-token-text-sm);
  border-radius: var(--catalog-token-radius-none);
  line-height: var(--catalog-token-text-sm--line-height);
  border-width: var(--border-width-none);
  gap: 2px;
}

.react-aria-GridListItem:where([data-variant="default"]) {
  background: transparent;
  color: var(--fg);
  border-color: var(--border);
}

.react-aria-GridListItem:where([data-variant="default"][data-hovered]) {
  background: var(--bg-muted);
}

.react-aria-GridListItem:where([data-variant="default"][data-pressed]) {
  background: var(--bg-muted);
}

.react-aria-GridListItem:where([data-variant="default"][data-selected]) {
  background: var(--accent-subtle);
  color: inherit;
  border-color: transparent;
}

.react-aria-GridListItem:where([data-variant="quiet"]) {
  background: transparent;
  color: var(--fg);
  border-color: var(--border);
}

.react-aria-GridListItem:where([data-variant="quiet"][data-hovered]) {
  background: var(--bg-muted);
}

.react-aria-GridListItem:where([data-variant="quiet"][data-pressed]) {
  background: var(--neutral-hover, color-mix(in srgb, var(--bg-muted) 85%, black));
}

.react-aria-GridListItem:where([data-variant="quiet"][data-selected]) {
  background: transparent;
  color: inherit;
  border-color: transparent;
}

.react-aria-GridListItem.react-aria-GridListItem:where([data-focus-visible]) {
  outline: 2px solid var(--focus-ring);
}

.react-aria-GridListItem.react-aria-GridListItem:where([data-focus-visible]) {
  outline-offset: -2px;
}

.react-aria-GridListItem.react-aria-GridListItem:where([data-disabled]) {
  opacity: 0.38;
}

.react-aria-GridListItem.react-aria-GridListItem {
  cursor: default;
}

.react-aria-GridListItem.react-aria-GridListItem:where([data-disabled]) {
  cursor: not-allowed;
}

.react-aria-GridListItem.react-aria-GridListItem:where([data-disabled]) {
  pointer-events: none;
}

.react-aria-GridListItem.react-aria-GridListItem .react-aria-Button[slot="drag"]:where([data-focus-visible]) {
  border-radius: 4px;
  outline: 2px solid var(--focus-ring);
}

@media (forced-colors: active) {
  .react-aria-GridListItem {
    forced-color-adjust: auto;
  }
}


} /* @layer components */`;export{e as default};