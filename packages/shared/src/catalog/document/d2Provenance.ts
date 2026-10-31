/**
 * D2 provenance of the binding props the installed S2 (`@react-spectrum/s2`) does not declare
 * (2026-10-14 — the D2 order of 2026-10-09: S2 → design-data → v3 → composition extension).
 *
 * The gate (`d2S2Alignment.static.test.ts`) reads every visible `accepts` key against the S2
 * component's props (its TypeScript types — the RAC props it inherits included). A key S2 has
 * passes by itself; every other key must be named here with where it comes from, so a prop that
 * is neither S2's nor declared is a drift. A declared key S2 turns out to have is stale here.
 *
 * Sources —
 * - `v3`: `@adobe/react-spectrum` 3.x declares it (the order's third step — S2 dropped the axis).
 * - `rac`: `react-aria-components` declares it and S2 omits it (an extension RAC makes possible).
 * - `composition`: nothing upstream declares it (the order's fourth step).
 */

export type CatalogD2Source = "v3" | "rac" | "composition";

/**
 * Keys that mean the same on every type they appear on.
 * - `dataBinding`: the collection binding (ADR-132 · 152) — composition's data layer.
 * - `size`: the catalog size axis carried to parts and texts whose S2 counterpart has no size (D3).
 * - `children`: a text type's own text (RAC `children`).
 * - `isSelected`: a collection item's initial selection → the collection's `defaultSelectedKeys`
 *   (사용자 결정 2026-10-13 — `ITEM_SELECTED_PROP_CONTRACT`).
 * - `locale` · `calendarSystem`: the date types' locale (`dateLocaleProps.ts`).
 * - `iconName`: a glyph picked from the icon set (the Icon node's · a field's leading icon).
 */
export const CATALOG_D2_COMMON_PROVENANCE: Readonly<
  Record<string, CatalogD2Source>
> = {
  dataBinding: "composition",
  size: "composition",
  children: "rac",
  isSelected: "composition",
  locale: "composition",
  calendarSystem: "composition",
  iconName: "composition",
};

/** Types with no S2 · RAC counterpart at all — every prop is composition's. */
export const CATALOG_D2_COMPOSITION_TYPES: ReadonlySet<string> = new Set([
  "Chart",
  "FileUpload",
  "Field",
  "Icon",
  "Illustration",
  "Nav",
  "Pagination",
  "DialogFooter",
  // (S2 toasts are queued (`ToastQueue`), not nodes — the placed Toast takes S2's `variant` values, no size.)
  "Toast",
  // (The Meter · ProgressBar parts the reference draws as elements — their own variant · size.)
  "MeterValue",
  "ProgressBarValue",
]);

/** Per-type keys — the S2 type lacks the axis; the source says where composition took it from. */
export const CATALOG_D2_PROVENANCE: Readonly<
  Record<string, Readonly<Record<string, CatalogD2Source>>>
> = {
  // ADR-281 Decision 3 — v3 Provider's cascade (S2's Provider dropped it; RAC Provider carries it).
  body: { isDisabled: "v3", isReadOnly: "v3", isRequired: "v3" },
  Avatar: { initials: "composition", isDisabled: "v3" },
  AvatarGroup: { isDisabled: "composition" },
  // (S2 has a separate NotificationBadge for the dot — composition keeps it an axis of Badge.)
  Badge: {
    isDot: "composition",
    isPulsing: "composition",
    isDisabled: "composition",
  },
  // ADR-256 Phase 9: RAC `visibleDuration` (days · weeks · months) is a superset of S2
  //   `visibleMonths` (months only) — kept for the reference's Display options; `weeksInMonth` is
  //   RAC's (S2 omits it).
  Calendar: { visibleDuration: "rac", weeksInMonth: "rac" },
  RangeCalendar: { visibleDuration: "rac", weeksInMonth: "rac" },
  ColorField: { isQuiet: "v3" },
  ColorSwatchPicker: { layout: "rac", isDisabled: "composition" },
  ComboBox: { isQuiet: "v3" },
  DateField: { isQuiet: "v3" },
  DatePicker: { isQuiet: "v3" },
  // (A field part's disabled state — carried from its field.)
  DateInput: { isDisabled: "composition" },
  // ADR-254 Decision 5: the Heading's `{title}` text is the Disclosure's (template binding).
  Disclosure: { title: "composition" },
  DropZone: {
    label: "composition",
    description: "composition",
    isDisabled: "rac",
  },
  FileTrigger: { isDisabled: "composition" },
  GridList: { layout: "rac" },
  Link: { isDisabled: "rac" },
  Meter: { showValueLabel: "v3" },
  NumberField: { isQuiet: "v3" },
  ProgressBar: { showValueLabel: "v3" },
  SearchField: { isQuiet: "v3" },
  Slider: { showValueLabel: "v3" },
  StatusLight: { isDisabled: "v3" },
  // (The RAC Table takes S2's table axes — `d2S2Alignment` reads it against S2's table type; the
  // height axes are composition's. ADR-277: the table is one type.)
  Table: { heightMode: "composition", height: "composition" },
  // (S2 removes by `onRemove` being set — composition's boolean shows the remove button.)
  TagGroup: { allowsRemoving: "composition" },
  TextArea: { isQuiet: "v3", rows: "composition" },
  TextField: { isQuiet: "v3" },
  TimeField: { isQuiet: "v3" },
  Tooltip: { variant: "v3" },
  // (S2 fixes a tooltip's offset at arrow + 4 — composition keeps RAC's prop on the trigger.)
  TooltipTrigger: { offset: "rac" },
  Tree: { isEmphasized: "composition" },
};
