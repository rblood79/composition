var e=`/* ============================================================
 * AUTO-GENERATED from catalog Table — DO NOT EDIT MANUALLY
 * Source: packages/shared/src/catalog/generated/componentRulesTable.ts
 * State styles only — the rest of its DOM visuals is a manual sheet (skipCSSGeneration)
 * ============================================================ */

@layer components {

.react-aria-Table.react-aria-Table:where([data-drop-target]) {
  background: color-mix(in srgb, var(--accent) 8%, transparent);
}

.react-aria-Table.react-aria-Table:where([data-focus-visible]) {
  outline: 2px solid var(--accent);
}

.react-aria-Table.react-aria-Table:where([data-drop-target]) {
  outline: 2px solid var(--accent);
}

.react-aria-Table.react-aria-Table:where([data-focus-visible]) {
  outline-offset: -1px;
}

.react-aria-Table.react-aria-Table:where([data-drop-target]) {
  outline-offset: -1px;
}

.react-aria-Table.react-aria-Table .react-aria-Row:where([data-hovered]) {
  background: var(--bg-muted);
}

.react-aria-Table.react-aria-Table .react-aria-Row:where([data-pressed]) {
  background: var(--bg-overlay);
}

.react-aria-Table.react-aria-Table .react-aria-Row:where([data-selected]) {
  background: var(--tbl-selected-bg);
}

.react-aria-Table.react-aria-Table .react-aria-Row:where([data-drop-target]) {
  background: color-mix(in srgb, var(--accent) 12%, transparent);
}

.react-aria-Table.react-aria-Table .react-aria-Row:where([data-selected]) {
  color: var(--tbl-selected-color);
}

.react-aria-Table.react-aria-Table .react-aria-Row:where([data-focus-visible]) {
  outline: 2px solid var(--accent);
}

.react-aria-Table.react-aria-Table .react-aria-Row:where([data-drop-target]) {
  outline: 2px solid var(--accent);
}

.react-aria-Table.react-aria-Table .react-aria-Row:where([data-focus-visible]) {
  outline-offset: -2px;
}

.react-aria-Table.react-aria-Table .react-aria-Row:where([data-focus-visible][data-selected]) {
  outline-offset: -4px;
}

.react-aria-Table.react-aria-Table .react-aria-Row[data-selected] .react-aria-Cell:where([data-focus-visible]) {
  outline-color: var(--accent);
  outline-offset: -4px;
}

.react-aria-Table.react-aria-Table .react-aria-Row:where([data-selected]):has(+ [data-selected]) {
  --radius-bottom: 0px;
}

.react-aria-Table.react-aria-Table .react-aria-Row:where([data-selected]):has(+ .react-aria-DropIndicator + [data-selected]) {
  --radius-bottom: 0px;
}

.react-aria-Table.react-aria-Table .react-aria-Row[data-selected] + .react-aria-Row:where([data-selected]) {
  --radius-top: 0px;
}

.react-aria-Table.react-aria-Table .react-aria-Row[data-selected] + .react-aria-DropIndicator + .react-aria-Row:where([data-selected]) {
  --radius-top: 0px;
}

.react-aria-Table.react-aria-Table .react-aria-Row:where([data-selected]) .react-aria-Checkbox {
  --selected-color: var(--tbl-cb-selected-on);
  --checkmark-color: var(--tbl-cb-checkmark-on);
}

.react-aria-Table.react-aria-Table .react-aria-Cell:where([data-focus-visible]) {
  outline: 2px solid var(--accent);
  outline-offset: -2px;
}

.react-aria-Table.react-aria-Table .react-aria-Column:where([data-focus-visible]) {
  outline: 2px solid var(--accent);
  outline-offset: -2px;
}

.react-aria-Table.react-aria-Table .react-aria-Row [slot="drag"]:where([data-focus-visible]) {
  border-radius: 4px;
  outline: 2px solid var(--accent);
}

.react-aria-Table.react-aria-Table[data-node-table] .react-aria-Cell[data-drag-cell] > .catalog-drag-handle:where([data-focus-visible]) {
  outline: 2px solid var(--focus-ring);
}

.react-aria-Table.react-aria-Table .react-aria-ColumnResizer:where([data-focus-visible]) {
  display: block;
}

.react-aria-Table.react-aria-Table .react-aria-ColumnResizer:where([data-focus-visible])::before {
  width: 2px;
  background: var(--informative);
}

.react-aria-Table.react-aria-Table[data-selection-style="highlight"] .react-aria-Row:where([data-selected]) {
  --row-highlight-top: inset 0 1px var(--accent);
  --row-highlight-bottom: inset 0 -1px var(--accent);
  background: color-mix(in srgb, var(--accent) 10%, var(--bg));
  color: var(--fg);
  box-shadow: inset 1px 0 var(--accent), inset -1px 0 var(--accent), var(--row-highlight-top), var(--row-highlight-bottom);
}

.react-aria-Table.react-aria-Table[data-selection-style="highlight"] .react-aria-Row:where([data-selected][data-hovered]) {
  background: color-mix(in srgb, var(--accent) 15%, var(--bg));
}

.react-aria-Table.react-aria-Table[data-selection-style="highlight"] .react-aria-Row:where([data-selected][data-pressed]) {
  background: color-mix(in srgb, var(--accent) 15%, var(--bg));
}

.react-aria-Table.react-aria-Table[data-selection-style="highlight"] .react-aria-Row:where([data-selected]):has(+ [data-selected]) {
  --row-highlight-bottom: 0 0 transparent;
}

.react-aria-Table.react-aria-Table[data-selection-style="highlight"] .react-aria-Row[data-selected] + .react-aria-Row:where([data-selected]) {
  --row-highlight-top: 0 0 transparent;
}

} /* @layer components */`;export{e as default};