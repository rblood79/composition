/**
 * ADR-248 Phase 3 G3 — old/new geometry differences the user approved per node type (2026-09-30,
 * evidence "남은 FAIL 노드 종류별 판정 목록"):
 *   - `decided`: a D3 answer made the new side canonical; the frozen old baseline keeps the old value.
 *   - `oldDefect`: the catalog declaration equals the new side; only the old Canvas departs from it.
 *   - `previewFollow`: the Preview departs from the declaration and the Phase 3 new side follows the
 *     Preview (②); Phase 4 fixes the product and the new side together.
 *   - `bothDeviate`: neither side draws the catalog value; the new side follows the Preview (②).
 * A rule approves an over-1px pair only when the pair's owner (the case's type) and node type match
 * and every axis that differs by more than 1 CSS px is listed in `axes`. The pair must also hold the
 * Canvas ↔ isolated DOM contract (the row's DOM leg), unless `noDomBox` names a node the DOM leg
 * has no box for. Unlisted pairs (new-side defects, unexplained cases) keep the geometry leg failing.
 */
export type ApprovedDifferenceClass =
  "decided" | "oldDefect" | "previewFollow" | "bothDeviate";
export type GeometryAxis = "x" | "y" | "width" | "height";

export interface ApprovedDifference {
  id: string;
  class: ApprovedDifferenceClass;
  owners: readonly string[];
  nodes: readonly string[];
  axes: readonly GeometryAxis[];
  /** The node has no isolated DOM box (the DOM leg cannot arbitrate it). */
  noDomBox?: boolean;
  /**
   * The node's own drawing follows the approved size (a sized control's indicator): L3 attributes
   * its whole old ∪ new box, not only the swept edges.
   */
  paint?: true;
  reason: string;
}

const ALL: readonly GeometryAxis[] = ["x", "y", "width", "height"];
/** Field family whose Label line box follows the catalog `text-*--line-height` at xs/sm. */
const FIELD_OWNERS = [
  "CheckboxGroup",
  "ColorField",
  "ComboBox",
  "DateField",
  "NumberField",
  "RadioGroup",
  "SearchField",
  "Select",
  "TagGroup",
  "TextArea",
  "TextField",
  "TimeField",
] as const;

export const APPROVED_DIFFERENCES: readonly ApprovedDifference[] = [
  // ── A. decided (user D3 answers 2026-09-29) ─────────────────────────────
  {
    id: "label-fit-content",
    class: "decided",
    owners: ["ProgressBar", "Meter", "Slider"],
    nodes: ["Label"],
    axes: ["height", "width"],
    reason: "② Label height fit-content (69 → 20)",
  },
  {
    id: "form-necessity-indicator",
    class: "decided",
    owners: ["Form"],
    nodes: ["Label"],
    axes: ["width", "y", "height"],
    reason: "⑤ empty necessityIndicator = icon (`*` widens the label)",
  },
  {
    id: "value-family-weight",
    class: "decided",
    owners: ["Nav", "Link", "ProgressBar", "Slider", "Toolbar"],
    nodes: ["Link", "ProgressBarValue", "SliderOutput", "Separator"],
    axes: ["x", "width"],
    reason: "① Link · value text weight 400 (1–2px width and the following x)",
  },
  {
    id: "select-trigger-gap",
    class: "decided",
    owners: ["Select"],
    nodes: ["SelectValue"],
    axes: ["width", "y"],
    reason: "④ Select trigger gap 4",
  },
  {
    id: "disclosure-chevron",
    class: "decided",
    owners: ["Disclosure", "DisclosureGroup"],
    nodes: ["DisclosureHeader", "Disclosure"],
    axes: ["width", "height", "y"],
    reason: "⑧ Disclosure chevron 18 · gap 4 inside the header padding",
  },
  {
    id: "item-label-font",
    class: "decided",
    owners: ["Tabs"],
    nodes: ["Text", "Tab"],
    axes: ALL,
    reason: "⑨ Tab label font = the item rule's",
  },
  {
    id: "breadcrumb-separator-icon",
    class: "decided",
    owners: ["Breadcrumb"],
    nodes: ["Breadcrumb"],
    axes: ["width"],
    reason: "⑦ separator = editable Icon (16 + gap 2)",
  },
  {
    id: "dropzone-content",
    class: "decided",
    owners: ["FileUpload"],
    nodes: ["DropZone"],
    axes: ["height"],
    reason:
      "user decision A 2026-10-02: the DropZone content follows the catalog delegation and the FileUpload drop zone fits it (old empty box 52 → 165)",
  },
  {
    id: "fileupload-rows-below-input",
    class: "decided",
    owners: ["FileUpload"],
    nodes: ["ProgressBar", "Label", "ProgressBarValue", "ProgressBarTrack"],
    axes: ["x", "y", "width"],
    reason:
      "the sample rows move below the content-sized drop zone and the trigger box; value text weight 400 (①)",
  },
  // ── B. old Canvas defects (catalog = new) ───────────────────────────────
  {
    id: "filetrigger-box",
    class: "oldDefect",
    owners: ["FileUpload"],
    nodes: ["FileTrigger"],
    axes: ["y", "width", "height"],
    noDomBox: true,
    reason:
      "old draws no FileTrigger box (0×0); the catalog size box (height 40 · paddingX 24) is the button's — 4e-10-2",
  },
  {
    id: "field-label-line-height",
    class: "oldDefect",
    owners: FIELD_OWNERS,
    nodes: ["Label"],
    axes: ["height", "y"],
    reason:
      "old fixes the Label line box at 16; catalog `text-2xs/xs--line-height` (14.3 · 17.1)",
  },
  {
    id: "field-label-line-height-cascade",
    class: "oldDefect",
    owners: [...FIELD_OWNERS, "Form"],
    nodes: [
      "SelectTrigger",
      "SelectValue",
      "Input",
      "DateInput",
      "SelectIcon",
      "Button",
      "ButtonGroup",
      "TextField",
      "FieldError",
    ],
    axes: ["y"],
    noDomBox: true,
    reason: "rows below the Label move by its line-box difference",
  },
  {
    id: "textarea-label-line-height-fill",
    class: "oldDefect",
    owners: ["TextArea"],
    nodes: ["Input"],
    axes: ["y", "height"],
    reason:
      "the fixed-height TextArea's Input absorbs the Label line-box difference",
  },
  {
    id: "colorfield-input-size",
    class: "oldDefect",
    owners: ["ColorField"],
    nodes: ["Input"],
    axes: ["y", "height"],
    reason:
      "old keeps the md Input box (30) at every size; the owner's per-size `--cf-input-*` delegation sizes it",
  },
  {
    id: "calendar-header",
    class: "oldDefect",
    owners: ["Calendar", "RangeCalendar"],
    nodes: ["CalendarHeader", "CalendarGrid"],
    axes: ALL,
    noDomBox: true,
    reason:
      "old draws the header row 0 tall at the grid width (238); the DOM header row = the nav buttons (height + spacing-xs, 4e-11 min-width reset) · gaps · heading, as tall as the catalog 30",
  },
  {
    id: "group-items-old-size",
    class: "oldDefect",
    owners: ["RadioGroup", "CheckboxGroup"],
    nodes: ["Radio", "Checkbox"],
    axes: ALL,
    paint: true,
    reason:
      "old paints the items at md (indicator · label) inside the group size's box, keeps the items gap 12 (catalog `--radio-items-gap` sm 8 · lg 16) and the xl item box at its label line 28 (indicator text-3xl 30) — 4e-11 group size reaches the items",
  },
  {
    id: "group-item-label-old-font",
    class: "oldDefect",
    owners: ["RadioGroup", "CheckboxGroup"],
    nodes: ["Label"],
    axes: ALL,
    reason:
      "old keeps the item Label at the md font (lg/xl: catalog text-base · text-lg) and moves it with the items gap",
  },
  {
    id: "togglebuttongroup-xl-shrink",
    class: "oldDefect",
    owners: ["ToggleButtonGroup"],
    nodes: ["ToggleButton"],
    axes: ALL,
    reason:
      "xl items wider than the 220 group: old keeps max-content and overflows; flex items shrink to min-content and the label wraps (no nowrap declared) — the DOM box",
  },
  {
    id: "slider-track-row-center",
    class: "oldDefect",
    owners: ["Slider"],
    nodes: ["SliderTrack", "SliderThumb"],
    axes: ["y"],
    reason:
      "old pins the track top where the md 8 track sits (103) at every size; the DOM centers the size's track (sm 4 · xl 16, 4e-11 size reaches the track) in its grid row",
  },
  {
    id: "tree-collapsed-row-label",
    class: "oldDefect",
    owners: ["Tree"],
    nodes: ["Text"],
    axes: ["x", "width"],
    reason:
      "the old row paired with the second item is the collapsed first item's child, a level deeper (+16); the DOM's second row is level 1 (chevron 20 kept — 4e-11)",
  },
  {
    id: "field-button-size",
    class: "oldDefect",
    owners: ["ComboBox", "NumberField"],
    nodes: ["SelectIcon", "SelectValue"],
    axes: ALL,
    reason:
      "old draws the trigger buttons at the SelectIcon scale (xs 14 · sm 16); catalog `--combo-btn-size` / `--nf-btn-size` xs 10 · sm 14",
  },
  {
    id: "searchfield-icon-clear",
    class: "oldDefect",
    owners: ["SearchField"],
    nodes: ["SelectIcon", "SelectValue"],
    axes: ALL,
    reason:
      "old: SelectTrigger rule icon 18 · empty value keeps the clear button",
  },
  {
    id: "checkboxgroup-items-width",
    class: "oldDefect",
    owners: ["CheckboxGroup"],
    nodes: ["Checkbox"],
    axes: ["width"],
    reason: "old: items wrapper flex-start hard-coded",
  },
  {
    id: "switch-label-weight",
    class: "oldDefect",
    owners: ["Switch"],
    nodes: ["Label", "Switch"],
    axes: ["width"],
    noDomBox: true,
    reason:
      "old measures the Switch text with the Label rule 600 (product: Switch 400 text node)",
  },
  {
    id: "slider-output-height",
    class: "oldDefect",
    owners: ["Slider"],
    nodes: ["SliderOutput"],
    axes: ["height", "width", "x"],
    reason: "old: catalog md height 20 not injected",
  },
  {
    id: "daterangepicker-label-measure",
    class: "oldDefect",
    owners: ["DateRangePicker"],
    nodes: ["Label"],
    axes: ["width"],
    reason: "old measuring by-product",
  },
  {
    id: "card-image-zero",
    class: "oldDefect",
    owners: ["Card"],
    nodes: ["Image"],
    axes: ["height"],
    reason: "old engine reads a definite 0 height as unset (200)",
  },
  {
    id: "breadcrumbs-authored-height",
    class: "oldDefect",
    owners: ["Breadcrumbs"],
    nodes: ["Breadcrumbs", "Breadcrumb"],
    axes: ALL,
    reason:
      "old overrides the authored height with the size height (24 → 130; crumbs center in it)",
  },
  {
    id: "disclosure-content-padding",
    class: "oldDefect",
    owners: ["Disclosure", "DisclosureGroup"],
    nodes: ["DisclosureContent"],
    axes: ["height", "y", "width"],
    reason: "old: staticSelector padding 8 not consumed",
  },
  {
    id: "border-reservation",
    class: "oldDefect",
    owners: ["Table", "Popover"],
    nodes: ["TableHeader", "TableBody", "Heading", "Description"],
    axes: ALL,
    noDomBox: true,
    reason: "old reserves no inner border (1px)",
  },
  {
    id: "tabs-list-panels",
    class: "oldDefect",
    owners: ["Tabs"],
    nodes: ["TabList", "TabPanels", "TabPanel"],
    axes: ["width", "height", "y"],
    noDomBox: true,
    reason: "old: TabList width 100% · TabPanels flexGrow hard-coded",
  },
  {
    id: "listbox-item-slot-font",
    class: "oldDefect",
    owners: ["ListBoxItem"],
    nodes: ["ListBoxItem", "Text"],
    axes: ALL,
    reason: "old: slot font without a collection ancestor",
  },
  {
    id: "menu-item-empty-icon",
    class: "oldDefect",
    owners: ["MenuItem"],
    nodes: ["MenuItem", "Text"],
    axes: ALL,
    reason: "old flows an empty `{icon}` as a 24 box",
  },
  {
    id: "datepicker-trigger-padding-right",
    class: "oldDefect",
    owners: ["DatePicker", "DateRangePicker"],
    nodes: ["DateInput", "SelectIcon"],
    axes: ["width", "x"],
    reason:
      "old trigger right padding = size paddingX 12; catalog `--dp-group-padding` / `--drp-group-padding` right = spacing-xs 4 (md)",
  },
  // ── C. Preview defects the new side follows (Phase 4 fixes) ─────────────
  {
    id: "taglist-wrapper",
    class: "previewFollow",
    owners: ["TagGroup"],
    nodes: ["TagList", "Tag", "Text"],
    axes: ALL,
    noDomBox: true,
    reason:
      "product wrapper outside the RAC structure: TagList 100% unresolved",
  },
  {
    id: "listbox-section-header",
    class: "previewFollow",
    owners: ["ListBoxSection"],
    nodes: ["Header"],
    axes: ["y"],
    reason: "generated CSS not loaded",
  },
  // ── D. neither side draws the catalog value (new follows the Preview) ───
  {
    id: "gridlist-section-header",
    class: "bothDeviate",
    owners: ["GridListSection"],
    nodes: ["Header"],
    axes: ALL,
    reason: "both sides depart from the catalog header",
  },
];

/**
 * A within-tolerance pair whose vertical edge still paints differently: the old Canvas rounds a
 * fit-content box's intrinsic width up to a whole pixel (`layout/engines/utils.ts` `Math.ceil
 * (injectWidth)` · text widths), the new Canvas keeps the measured width, which is the DOM box.
 * Only the moved vertical edges are attributed.
 */
export const SUBPIXEL_INTRINSIC_WIDTH_CEIL = {
  id: "subpixel-intrinsic-width-ceil",
  class: "oldDefect",
  reason: "old Canvas rounds the intrinsic width up (Math.ceil); new = DOM box",
} as const satisfies {
  id: string;
  class: ApprovedDifferenceClass;
  reason: string;
};

export function subpixelIntrinsicWidthCeil(
  oldRect: { x: number; y: number; width: number; height: number },
  newRect: { x: number; y: number; width: number; height: number },
  dom: { x: number; y: number; width: number; height: number },
): boolean {
  const wider = oldRect.width - newRect.width;
  return (
    wider > 0.01 &&
    wider < 1 &&
    Math.abs(oldRect.height - newRect.height) <= 0.01 &&
    Math.abs(dom.width - newRect.width) <= 0.05 &&
    // The old box never grew by a whole pixel or more: exactly a round-up of the new width.
    Math.ceil(newRect.width - 1e-6) - newRect.width >= wider - 0.05 &&
    Math.abs(oldRect.y - newRect.y) <= 1
  );
}

/**
 * State origins whose old paint follows an old input the new model does not carry (user decision
 * 2026-09-30, option 1): the old Tab/Tag origin keeps a legacy `_isSelected: true` prop (the
 * pre-migration selected template) that its hover · pressed · focus · disabled variants inherit,
 * so the old Canvas draws them selected; ListBoxItem · GridListItem · TreeItem · ToggleButton
 * variants draw unselected. The new model draws every family's interaction/disabled variant
 * unselected (display states are one layer), as the RAC reference draws a hovered Tab without the
 * indicator.
 */
export interface ApprovedStatePaint {
  id: string;
  class: ApprovedDifferenceClass;
  owners: readonly string[];
  states: readonly string[];
  reason: string;
}

export const APPROVED_STATE_PAINT: readonly ApprovedStatePaint[] = [
  {
    id: "item-variant-inherited-selection",
    class: "oldDefect",
    owners: ["Tab", "Tag"],
    states: ["hover", "pressed", "focus-visible", "disabled"],
    reason:
      "old Tab/Tag origin's legacy `_isSelected` is inherited by its interaction/disabled variants (selected look); the new model draws them unselected like the other item families",
  },
];

export function approvedStatePaint(
  owner: string,
  state: string,
): ApprovedStatePaint | undefined {
  return APPROVED_STATE_PAINT.find(
    (rule) => rule.owners.includes(owner) && rule.states.includes(state),
  );
}

/** The approving rule of one over-1px pair, or undefined. */
export function approvedDifference(
  owner: string,
  node: string,
  oldRect: { x: number; y: number; width: number; height: number },
  newRect: { x: number; y: number; width: number; height: number },
  hasDomBox: boolean,
): ApprovedDifference | undefined {
  const differing = (["x", "y", "width", "height"] as const).filter(
    (axis) => Math.abs(oldRect[axis] - newRect[axis]) > 1,
  );
  return APPROVED_DIFFERENCES.find(
    (rule) =>
      rule.owners.includes(owner) &&
      rule.nodes.includes(node) &&
      (hasDomBox || rule.noDomBox === true) &&
      differing.every((axis) => rule.axes.includes(axis)),
  );
}

/**
 * Nodes one side has and the other does not (structural pairing leaves them unpaired), approved
 * per owner: the new side's node type, or the old side's path pattern.
 */
export interface ApprovedUnpaired {
  id: string;
  class: ApprovedDifferenceClass;
  owners: readonly string[];
  side: "new" | "old";
  /** New side: node types. */
  nodes?: readonly string[];
  /** Old side: the old node path (last segment) pattern. */
  oldPath?: RegExp;
  reason: string;
}

export const APPROVED_UNPAIRED: readonly ApprovedUnpaired[] = [
  {
    id: "breadcrumb-separator-icon-children",
    class: "decided",
    owners: ["Breadcrumbs", "Breadcrumb"],
    side: "new",
    nodes: ["Text", "Icon"],
    reason:
      "⑦ crumb = [label Text, separator Icon] (old: a leaf crumb with `::after`)",
  },
  {
    id: "searchfield-empty-clear-button",
    class: "oldDefect",
    owners: ["SearchField"],
    side: "old",
    oldPath: /^component-searchfield__2(\/component-searchfield__2)?_3$/,
    reason: "old keeps the clear button for an empty value (RAC hides it)",
  },
  {
    id: "tree-collapsed-row",
    class: "oldDefect",
    owners: ["Tree"],
    side: "old",
    oldPath: /^component-tree__item-2$/,
    reason: "old draws the collapsed item's row",
  },
  {
    id: "item-empty-icon-box",
    class: "oldDefect",
    owners: ["ListBoxItem", "MenuItem"],
    side: "old",
    // Origin `_icon`; a state variant names the same slot by its instance segment (`Icon`).
    oldPath: /^(_icon|Icon)$/,
    reason: "old flows an empty `{icon}` as a 24 box",
  },
];

/** The approving rule of one unpaired node (`new:<id>` / `old:<path>`), or undefined. */
export function approvedUnpaired(
  owner: string,
  entry: string,
  newNodeType: (id: string) => string,
): ApprovedUnpaired | undefined {
  const [side, ...rest] = entry.split(":");
  const key = rest.join(":");
  return APPROVED_UNPAIRED.find(
    (rule) =>
      rule.side === side &&
      rule.owners.includes(owner) &&
      (side === "new"
        ? (rule.nodes ?? []).includes(newNodeType(key))
        : (rule.oldPath?.test(key) ?? false)),
  );
}
