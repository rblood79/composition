var e=`/* ============================================================
 * AUTO-GENERATED from catalog Tree — DO NOT EDIT MANUALLY
 * Source: packages/shared/src/catalog/generated/componentRulesTable.ts
 * State styles only — the rest of its DOM visuals is a manual sheet (skipCSSGeneration)
 * ============================================================ */

@layer components {

.react-aria-Tree.react-aria-Tree:where([data-focus-visible]) {
  outline: 2px solid var(--accent);
  outline-offset: -1px;
}

.react-aria-Tree.react-aria-Tree .react-aria-TreeItem:where([data-hovered]) {
  background: color-mix(in srgb, var(--fg) 8%, transparent);
}

.react-aria-Tree.react-aria-Tree .react-aria-TreeItem:where([data-pressed]) {
  background: color-mix(in srgb, var(--fg) 12%, transparent);
}

.react-aria-Tree.react-aria-Tree .react-aria-TreeItem:where([data-selected]) {
  background: var(--accent-subtle);
}

.react-aria-Tree.react-aria-Tree .react-aria-TreeItem:where([data-drop-target]) {
  background: color-mix(in srgb, var(--accent) 8%, transparent);
}

@media (forced-colors: active) {
.react-aria-Tree.react-aria-Tree .react-aria-TreeItem:where([data-selected]) {
  background: Highlight;
}
}

.react-aria-Tree.react-aria-Tree .react-aria-TreeItem:where([data-selected]) {
  color: var(--fg-on-accent);
}

.react-aria-Tree.react-aria-Tree .react-aria-TreeItem:where([data-disabled]) {
  color: color-mix(in srgb, var(--fg) 38%, transparent);
}

@media (forced-colors: active) {
.react-aria-Tree.react-aria-Tree .react-aria-TreeItem:where([data-selected]) {
  color: HighlightText;
}
}

.react-aria-Tree.react-aria-Tree .react-aria-TreeItem:where([data-disabled]) {
  cursor: not-allowed;
}

.react-aria-Tree.react-aria-Tree .react-aria-TreeItem:where([data-disabled]) {
  pointer-events: none;
}

.react-aria-Tree.react-aria-Tree .react-aria-TreeItem:where([data-focus-visible]) {
  outline: 2px solid var(--accent);
}

.react-aria-Tree.react-aria-Tree .react-aria-TreeItem:where([data-drop-target]) {
  outline: 2px solid var(--accent);
}

.react-aria-Tree.react-aria-Tree .react-aria-TreeItem:where([data-focus-visible]) {
  outline-offset: -2px;
}

.react-aria-Tree.react-aria-Tree .react-aria-TreeItem:where([data-focus-visible][data-selected]) {
  outline-offset: -4px;
}

@media (forced-colors: active) {
.react-aria-Tree.react-aria-Tree .react-aria-TreeItem:where([data-focus-visible]) {
  outline-color: Highlight;
}
}

.react-aria-Tree.react-aria-Tree .react-aria-TreeItem:where([data-selected]) .react-aria-Button {
  color: var(--fg-on-accent);
}

.react-aria-Tree.react-aria-Tree .react-aria-TreeItem [slot="drag"]:where([data-focus-visible]) {
  border-radius: var(--radius-xs);
  outline: 2px solid var(--accent);
}

.react-aria-Tree.react-aria-Tree .react-aria-TreeItem:where([data-selected]):has(+ [data-selected]) {
  border-end-start-radius: 0;
  border-end-end-radius: 0;
}

.react-aria-Tree.react-aria-Tree .react-aria-TreeItem[data-selected] + .react-aria-TreeItem:where([data-selected]) {
  border-start-start-radius: 0;
  border-start-end-radius: 0;
}

} /* @layer components */`;export{e as default};