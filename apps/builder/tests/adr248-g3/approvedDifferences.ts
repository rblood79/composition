/**
 * ADR-248 Phase 3 G3 — old/new geometry differences the user approved per node type (2026-09-30,
 * evidence "남은 FAIL 노드 종류별 판정 목록"):
 *   - `decided`: a D3 answer made the new side canonical; the frozen old baseline keeps the old value.
 *   - `oldDefect`: the catalog declaration equals the new side; only the old Canvas departs from it.
 *   - `previewFollow`: the Preview departs from the declaration and the Phase 3 new side follows the
 *     Preview (②); Phase 4 fixes the product and the new side together.
 *   - `bothDeviate`: neither side draws the catalog value; the new side follows the Preview (②).
 *   ADR-248 4e-11 (2026-10-03) repaired every previewFollow / bothDeviate pair in the product or
 *   reclassified it (old Canvas value, or a recorded decision): no rule of those classes remains.
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
    // ADR-253 Phase 3 (사용자 결정 2026-10-06 — 레퍼런스 값이 부품의 기본값): 전 Label 의 굵기 500.
    //   old 캡처는 600 이라 글자 폭이 1.0 ~ 1.8px 넓다. 폭 차이가 1px 을 넘는 Label 만 적는다.
    id: "label-weight-500",
    class: "decided",
    owners: [
      "Checkbox",
      "ComboBox",
      "Select",
      "TagGroup",
      "TextField",
      "TimeField",
    ],
    nodes: ["Label"],
    axes: ["width"],
    reason:
      "Label weight 500 (ADR-253 — the Label rule's default; old 600 measures 1.0–1.8px wider)",
  },
  {
    // ADR-253 Phase 3 (4) (사용자 결정 2026-10-06 — 레퍼런스 값이 부품의 기본값): NumberField 의 상자는
    //   Input 원본의 instance 이고 증감 버튼은 Button 원본 (secondary) 의 instance 다 — 입력칸이 Group 을
    //   채우고 버튼은 그 높이의 정사각형. old 는 Group 이 상자 (padding 4 · 12) 를 그리고 그 안에 글자와
    //   18px glyph 두 개가 있었다.
    id: "numberfield-input-and-stepper-parts",
    class: "decided",
    owners: ["NumberField"],
    nodes: ["Input", "Button"],
    axes: ALL,
    paint: true,
    reason:
      "NumberField = Group [Input instance, Button instance × 2] (ADR-253 — old: one painted Group around a bare value and two glyphs)",
  },
  {
    // ADR-253 Phase 3 (4b): ComboBox 의 상자는 Input 원본의 instance 이고 (container 를 채운다 — 버튼 자리는
    //   끝 쪽 padding), 버튼은 FieldButton 원본의 instance 다 (control 안쪽 정사각형 · 옅은 강조색). old 는
    //   container 가 상자 (padding 4 · 12) 를 그리고 그 안에 글자와 18px glyph 가 있었다.
    id: "combobox-input-and-field-button-parts",
    class: "decided",
    owners: ["ComboBox"],
    nodes: ["Input", "Button"],
    axes: ALL,
    paint: true,
    reason:
      "ComboBox = container [Input instance, FieldButton instance] (ADR-253 — old: one painted container around a bare value and a glyph)",
  },
  {
    // ADR-253 Phase 3 (4c): SearchField 의 상자는 Input 원본의 instance 이고 (container 를 채운 알약 모양 —
    //   검색 glyph 와 지우기 버튼 자리는 양끝 padding), 지우기 버튼은 Button 원본의 instance 다 (16px 원 ·
    //   옅은 글자색 칠). old 는 container 가 상자 (padding 4 · 12, radius 6) 를 그리고 그 안에 glyph · 글자 ·
    //   18px glyph 버튼이 있었다 (SelectTrigger rule 의 icon 18 · 빈 값에도 지우기 버튼).
    id: "searchfield-glyph-input-and-clear-parts",
    class: "decided",
    owners: ["SearchField"],
    nodes: ["Icon", "Input", "Button"],
    axes: ALL,
    paint: true,
    reason:
      "SearchField = container [glyph Icon, Input instance, Button instance] (ADR-253 — old: one painted container around a glyph, a bare value and a glyph button)",
  },
  {
    // ADR-253 Phase 3 (4d): Select 의 trigger 는 Button 원본 (secondary) 의 instance 다 — 끝 쪽 padding 8
    //   (old 4) 이고 glyph 는 그 안의 Icon 노드다. old 는 입력 상자 모양의 trigger 안에 상자가 있는 chevron
    //   (배경 · 그림자) 이 있었다.
    id: "select-trigger-button-instance",
    class: "decided",
    owners: ["Select"],
    nodes: ["Button", "SelectValue", "Icon"],
    axes: ALL,
    paint: true,
    reason:
      "Select trigger = Button instance [SelectValue, Icon] (ADR-253 — old: an input-like box around the value and a boxed chevron)",
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
  {
    id: "section-generated-css-unloaded",
    class: "decided",
    owners: ["ListBoxSection", "GridListSection"],
    nodes: ["Header"],
    axes: ALL,
    reason:
      "ADR-238 Phase 2: the section layer's generated CSS stays unloaded (`UNLOADED_GENERATED_CSS` F, G5 `adr238SectionDom`) — the DOM section is a UA block; old draws the generated values (section text-base → the inline-flex header's baseline shift 2 · catalog header 24 at full width)",
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
    // ADR-251: the items wrapper is a typed node now (paired with the old `_items`), so the old
    // items gap / md items show on its box too.
    nodes: ["Radio", "Checkbox", "RadioItems", "CheckboxItems"],
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
    id: "taglist-line-distribution",
    class: "oldDefect",
    owners: ["TagGroup"],
    nodes: ["TagList", "Tag", "Text"],
    axes: ["x", "y", "height"],
    noDomBox: true,
    reason:
      "the chip wrapper fills its catalog 100% height (4e-11); its wrapped lines stretch (CSS `align-content: normal`) and center the chips in each line — old packs the lines at the top and keeps the md chip gap 4 at lg (catalog `TagList.sizes.lg.gap` 6); the wrapper height follows the label line box",
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
    id: "toggle-indicator-node",
    class: "decided",
    owners: ["Checkbox", "Radio", "Switch", "CheckboxGroup", "RadioGroup"],
    side: "new",
    nodes: ["CheckboxIndicator", "RadioIndicator", "SwitchIndicator"],
    reason:
      "toggle = [indicator node, Label] (2026-10-04 user 「1안」 — old: the toggle painted its indicator in its own box)",
  },
  {
    // ADR-253 Phase 3 (4): field 안 버튼 (Button · FieldButton instance) 의 glyph 는 그 Icon 자식이다.
    //   old 는 glyph 가 버튼 자리 노드 (SelectIcon) 자체였다.
    id: "field-button-glyph-node",
    class: "decided",
    owners: ["NumberField", "ComboBox", "SearchField"],
    side: "new",
    nodes: ["Icon"],
    reason:
      "a field's button = Button instance [Icon] (ADR-253 — old: the glyph was the button node itself)",
  },
  {
    id: "tree-item-chevron-node",
    class: "decided",
    owners: ["Tree", "TreeItem"],
    side: "new",
    nodes: ["TreeItemChevron"],
    reason:
      "TreeItem = [chevron node, label, child items] (2026-10-04 user 「1안」 — old: the item painted its chevron in its own box)",
  },
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
    // ADR-253 Phase 3: a field's FieldError is a part node hidden at rest by the presence rule
    //   (shown while the field is invalid with a message). old kept it in the tree as a
    //   `display: none` node — a zero box either way.
    id: "field-error-hidden-at-rest",
    class: "decided",
    owners: [
      "DateField",
      "Form",
      "NumberField",
      "TextArea",
      "TextField",
      "TimeField",
    ],
    side: "old",
    oldPath:
      /(^|\/)component-(datefield|numberfield|textarea|textfield|timefield)__3$/,
    reason:
      "a resting field shows no FieldError (ADR-253 presence — old: a `display: none` node)",
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

/** 2026-10-05 section closure: only the independently repeated child supplement.
 * These signatures describe the old defect / ADR-238 baseline propagation; they do not
 * relax the <=1px current Canvas/DOM leg or accept another fixture's geometry.
 */
export const SECTION_SUPPLEMENT_HASH =
  "62debe8d5c1e89649b4297e7520fb41e2142ab001e2818ea02e917ea4a922e11";
type SectionRect = { x: number; y: number; width: number; height: number };
export function approvedSectionDifference(
  hash: string,
  owner: string,
  node: string,
  oldRect: SectionRect,
  newRect: SectionRect,
  hasDomBox: boolean,
): ApprovedDifference | undefined {
  if (hash !== SECTION_SUPPLEMENT_HASH || !hasDomBox) return;
  const signatures: Array<[string, string, number[], number[]]> = [
    [
      "GridListSection",
      "GridListSection",
      [30, 30, 220, 124],
      [30, 30, 104, 130],
    ],
    ["GridListSection", "GridListItem", [30, 54, 220, 50], [30, 51, 104, 50]],
    ["GridListSection", "GridListItem", [30, 104, 220, 50], [30, 101, 104, 50]],
    ["GridListSection", "Text", [47, 67, 186, 24], [47, 64, 70, 24]],
    ["GridListSection", "Text", [47, 117, 186, 24], [47, 114, 70, 24]],
    [
      "ListBoxSection",
      "ListBoxSection",
      [35, 35, 210, 90.9824],
      [35, 35, 210, 89],
    ],
    [
      "ListBoxSection",
      "ListBoxItem",
      [35, 61.9824, 210, 32],
      [35, 60, 210, 32],
    ],
    [
      "ListBoxSection",
      "ListBoxItem",
      [35, 93.9824, 210, 32],
      [35, 92, 210, 32],
    ],
    ["ListBoxSection", "Text", [47, 65.9824, 186, 24], [47, 64, 186, 24]],
    ["ListBoxSection", "Text", [47, 97.9824, 186, 24], [47, 96, 186, 24]],
  ];
  const matches = (rect: SectionRect, values: number[]) =>
    ALL.every((axis, i) => Math.abs(rect[axis] - values[i]) < 0.02);
  if (
    !signatures.some(
      ([o, n, a, b]) =>
        o === owner && n === node && matches(oldRect, a) && matches(newRect, b),
    )
  )
    return;
  return {
    id:
      owner === "GridListSection"
        ? "section-grid-two-column-host"
        : "section-header-baseline-cascade",
    class: owner === "GridListSection" ? "oldDefect" : "decided",
    owners: [owner],
    nodes: [node],
    axes: ALL,
    reason:
      owner === "GridListSection"
        ? "catalog GridList two columns / gap 12: old flex host used full width; current Canvas equals DOM"
        : "ADR-238 unloaded section CSS: Header baseline difference propagates to section height and following rows",
  };
}

/** The frozen md Switch painted its track at the owner's y=0; the typed indicator now
 * occupies the catalog padding box y=4, as the current DOM does. Only this frozen state
 * fixture is recognized. Returning a paint pair requests a translated pixel comparison,
 * never a whole-box paint waiver. The old track's dimensions come from the frozen primitive
 * (`2a5c97099` packages/specs/src/renderers/skiaPrimitives.ts, switchToggle).
 */
export function switchIndicatorPaintPair(
  scenarioHash: string,
  state: string,
  oldRoot: SectionRect | null,
  newRoot: SectionRect | undefined,
  indicator: SectionRect | undefined,
  dom: SectionRect | undefined,
): { oldRect: SectionRect; newRect: SectionRect } | undefined {
  if (
    scenarioHash !==
      "d931e8b953058c38cf568b774261cf0a0977961cc5c075a673fa1eaf633ce46c" ||
    ![
      "selected",
      "unselected",
      "disabled",
      "hover",
      "pressed",
      "focus-visible",
    ].includes(state) ||
    !oldRoot ||
    !newRoot ||
    !indicator ||
    !dom
  )
    return;
  const near = (a: number, b: number) => Math.abs(a - b) < 0.02;
  if (
    !near(oldRoot.width, 91) ||
    !near(oldRoot.height, 28) ||
    !near(newRoot.width, 88.4) ||
    !near(newRoot.height, 28) ||
    !near(oldRoot.x, newRoot.x) ||
    !near(oldRoot.y, newRoot.y) ||
    !near(indicator.x, newRoot.x) ||
    !near(indicator.y, newRoot.y + 4) ||
    !near(indicator.width, 36) ||
    !near(indicator.height, 20) ||
    !ALL.every((axis) => Math.abs(indicator[axis] - dom[axis]) <= 1)
  )
    return;
  return {
    oldRect: { x: oldRoot.x, y: oldRoot.y, width: 36, height: 20 },
    newRect: indicator,
  };
}
