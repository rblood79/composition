/**
 * ADR-248 Phase 3 — root boxes whose DOM geometry is declared outside the rule's generated CSS:
 * a manual stylesheet or the DOM renderer's inline style. The typed definition reads these facts
 * so the Rust input matches the DOM box; each entry cites the declaration it mirrors. The legacy
 * Canvas keeps equivalent constants in `implicitStyles.ts` until its removal.
 *
 * `replace`: the DOM root box ignores the rule's generated box (the element has no rule class or
 * the manual sheet overrides every declared axis), so the typed box is this entry alone.
 * `omit`: rule box keys no stylesheet reads for that element (removed from the base and every
 * size); the rest of the rule box stays.
 * `rootSizeAttribute`: the DOM root does not carry `data-size` (`null`: no size attribute), so the
 * generated `[data-size="…"]` blocks never match — every size resolves the generated values of the
 * default size. Size facts keyed on the real attribute are declared in `parts` with `size`.
 */
import { resolveToken, type TokenRef } from "@composition/specs";
import { COMPONENT_RULES_TABLE } from "../generated/componentRulesTable";
import type { ComponentRule } from "../../types/composition-document.types";
import type { CompiledPartRule } from "./rulePartRules";
import type { Scalar } from "./types";

export interface ManualBoxRule {
  replace?: boolean;
  omit?: readonly string[];
  rootSizeAttribute?: string | null;
  layout?: Record<string, string>;
  visual?: Record<string, Scalar>;
  /** Ordered like `ConditionalRule`: every `when` prop equals the resolved value. */
  conditional?: Array<{
    when: Record<string, Scalar>;
    layout?: Record<string, string>;
    visual?: Record<string, Scalar>;
  }>;
  parts?: CompiledPartRule[];
}

const sizesOf = (type: string) =>
  (COMPONENT_RULES_TABLE as Record<string, ComponentRule>)[type]?.sizes ?? {};

/** `Separator.css` size margins (`--spacing-xs/sm/lg`) on the axis across the line. */
const SEPARATOR_MARGIN: Readonly<Record<string, number>> = {
  sm: 4,
  md: 8,
  lg: 16,
};

/** `renderButtonGroup` inline style (`LayoutRenderers.tsx`): gap by size, justify by align. */
const BUTTON_GROUP_GAP: Readonly<Record<string, number>> = {
  xs: 4,
  sm: 6,
  md: 8,
  lg: 10,
  xl: 12,
};
const BUTTON_GROUP_JUSTIFY: Readonly<Record<string, string>> = {
  start: "flex-start",
  center: "center",
  end: "flex-end",
};

/** A `{typography.text-*}` font size in px. */
/** A rule size value (token ref or number) in px. */
const px = (value: unknown): number | undefined => {
  const resolved =
    typeof value === "string" ? resolveToken(value as TokenRef) : value;
  return typeof resolved === "number" ? resolved : undefined;
};
const textPx = (name: string): number | undefined => {
  const resolved = resolveToken(`{typography.${name}}` as TokenRef);
  return typeof resolved === "number" ? resolved : undefined;
};

/**
 * Group Label font per group size from a manual sheet keyed on the component's own size attribute
 * (`--label-font-size: var(--text-*)` on `.react-aria-X[data-<x>-size="…"]`).
 */
const groupLabelFontParts = (
  fonts: Readonly<Record<string, string>>,
): CompiledPartRule[] =>
  Object.entries(fonts).flatMap(([size, name]): CompiledPartRule[] => {
    const fontSize = textPx(name);
    return fontSize
      ? [{ childType: "Label", size, layout: {}, visual: { fontSize } }]
      : [];
  });

/**
 * A child the owner's DOM renderer does not render: the owner draws its own `children` text in
 * that place, which inherits the owner's manual size font (`font-size: var(--text-*)` +
 * `line-height: var(--text-*--line-height)`, weight 400) instead of the child's own defaults.
 */
const ownerTextParts = (
  childType: string,
  fonts: Readonly<Record<string, string>>,
): CompiledPartRule[] =>
  Object.entries(fonts).flatMap(([size, name]): CompiledPartRule[] => {
    const fontSize = textPx(name);
    const lineHeight = textPx(`${name}--line-height`);
    return fontSize && lineHeight
      ? [
          {
            childType,
            size,
            layout: {},
            visual: {
              fontSize,
              lineHeight: lineHeight / fontSize,
              fontWeight: 400,
            },
          },
        ]
      : [];
  });

/**
 * `TabsIndicator.css` `.react-aria-Tab .react-aria-Text.react-aria-Text` / `TagGroup.css`
 * `.react-aria-Tag .react-aria-Text.react-aria-Text` { font-size · font-weight · line-height:
 * inherit }: the item's label Text takes the item's own size font, not the Text rule's. A line
 * height the item rule does not declare is the root's inherited 1.5 (`:root { line-height: 1.5 }`).
 */
const itemLabelFontParts = (itemType: string): CompiledPartRule[] => {
  const rule = (COMPONENT_RULES_TABLE as Record<string, ComponentRule>)[
    itemType
  ];
  const weight =
    rule?.defaultVariant !== undefined
      ? rule.variants[rule.defaultVariant]?.textWeight
      : undefined;
  return Object.entries(rule?.sizes ?? {}).flatMap(
    ([size, values]): CompiledPartRule[] => {
      const fontSize = px(values.fontSize);
      if (!fontSize) return [];
      const lineHeight = px(values.lineHeight);
      const fontWeight =
        typeof values.fontWeight === "number" ? values.fontWeight : weight;
      return [
        {
          childType: "Text",
          size,
          layout: {},
          visual: {
            fontSize,
            lineHeight: lineHeight ? lineHeight / fontSize : 1.5,
            ...(fontWeight !== undefined ? { fontWeight } : {}),
          },
        },
      ];
    },
  );
};

/**
 * Items of a group whose manual sheet sizes the item indicator by the group size
 * (`.react-aria-RadioGroup[data-radio-size] .react-aria-Radio:before` / `.react-aria-CheckboxGroup
 * [data-checkbox-size] .react-aria-Checkbox .checkbox`), while the gap after it stays the item's own
 * generated `[data-size]` gap (higher specificity than the manual `var(--radio-gap)`). The item row
 * is at least as tall as the indicator; its Label starts after indicator + gap.
 */
const groupItemIndicatorParts = (
  itemType: string,
  indicators: Readonly<Record<string, string>>,
): CompiledPartRule[] => {
  const itemSizes = sizesOf(itemType);
  return Object.entries(indicators).flatMap(
    ([size, name]): CompiledPartRule[] => {
      const indicator = textPx(name);
      if (!indicator) return [];
      return [
        {
          childType: itemType,
          size,
          layout: {},
          visual: { minHeight: indicator },
        },
        ...Object.entries(itemSizes).flatMap(
          ([itemSize, values]): CompiledPartRule[] =>
            typeof values.gap === "number"
              ? [
                  {
                    childType: "Label",
                    via: itemType,
                    viaProps: { size: itemSize },
                    size,
                    layout: { marginLeft: `${indicator + values.gap}px` },
                    visual: {},
                  },
                ]
              : [],
        ),
      ];
    },
  );
};

/** The Link sheet's default-size unitless `line-height` (a Breadcrumb crumb's text line box). */
const linkLineHeightRatio = (): number | undefined => {
  const link = (COMPONENT_RULES_TABLE as Record<string, ComponentRule>).Link;
  const size = link?.defaultSize ? link.sizes[link.defaultSize] : undefined;
  const fontSize = px(size?.fontSize);
  const lineHeight = px(size?.lineHeight);
  return fontSize && lineHeight ? lineHeight / fontSize : undefined;
};

/** Column counts `GridList.tsx` writes as `repeat(n, minmax(0, 1fr))` (typed conditions). */
const GRID_LIST_COLUMNS = [1, 2, 3, 4, 5, 6];

const RULES: Readonly<Record<string, () => ManualBoxRule>> = {
  Separator: () => ({
    conditional: Object.entries(SEPARATOR_MARGIN).flatMap(
      ([size, margin]): NonNullable<ManualBoxRule["conditional"]> => [
        {
          when: { size, orientation: "horizontal" },
          layout: { marginTop: `${margin}px`, marginBottom: `${margin}px` },
        },
        {
          when: { size, orientation: "vertical" },
          layout: { marginLeft: `${margin}px`, marginRight: `${margin}px` },
        },
      ],
    ),
  }),
  // The renderer's div has no rule class: its inline flex box is the whole DOM box.
  ButtonGroup: () => ({
    replace: true,
    layout: {
      display: "flex",
      flexDirection: "row",
      justifyContent: "flex-end",
    },
    conditional: [
      ...Object.entries(BUTTON_GROUP_GAP).map(([size, gap]) => ({
        when: { size },
        visual: { gap },
      })),
      ...Object.entries(BUTTON_GROUP_JUSTIFY).map(([align, justify]) => ({
        when: { align },
        layout: { justifyContent: justify },
      })),
      {
        when: { orientation: "vertical" },
        layout: { flexDirection: "column" },
      },
    ],
  }),
  // `GridList.css` base grid (1fr, gap `--spacing-md`) and `[data-layout="grid"]` columns from the
  // component's inline `repeat(columns, minmax(0, 1fr))`; its items start-align (0,3,0 selector).
  GridList: () => ({
    replace: true,
    layout: { display: "grid", gridTemplateColumns: "1fr" },
    visual: { width: "100%", gap: 12 },
    conditional: [
      // `GridList.tsx` default `columns = 2`.
      {
        when: { layout: "grid" },
        layout: { gridTemplateColumns: "minmax(0, 1fr) minmax(0, 1fr)" },
      },
      ...GRID_LIST_COLUMNS.map((columns) => ({
        when: { layout: "grid", columns },
        layout: {
          gridTemplateColumns: Array(columns).fill("minmax(0, 1fr)").join(" "),
        },
      })),
    ],
    parts: [
      {
        childType: "GridListItem",
        layout: { justifyContent: "flex-start" },
        visual: {},
      },
      // A GridList section's Header is RAC `GridListHeader` (`div.react-aria-GridListHeader`):
      // no Header sheet reaches it — a block box with the GridList's font (line-height inherited
      // from the Preview body, 1.5).
      ...Object.entries(sizesOf("GridList")).flatMap(
        ([size, values]): CompiledPartRule[] => {
          const fontSize = px(values.fontSize);
          return fontSize
            ? [
                {
                  childType: "Header",
                  via: "GridListSection",
                  size,
                  layout: { display: "block" },
                  visual: {
                    fontSize,
                    fontWeight: 400,
                    lineHeight: 1.5,
                    paddingX: 0,
                    paddingY: 0,
                    width: "100%",
                  },
                },
              ]
            : [];
        },
      ),
    ],
  }),
  // `ListBox.css` `.react-aria-ListBox .react-aria-Header` over the generated Header sheet: a
  // section header at `--text-sm`, weight 700, `padding: 0 --spacing-md`, `margin-bottom:
  // --spacing-xs` (line-height inherited from the Preview body, 1.5).
  //
  // Item slot roles (`ListBox.css` `.react-aria-ListBoxItem [slot=…]`): the Preview puts `slot` on
  // an item child only inside a ListBox (`itemSlotAttr`), hence the owner is the ListBox, through
  // the item. Label weight 600; description `--lb-desc-size` / `--lb-desc-line-height`
  // (`--text-xs`); the icon absolutely placed at `left: --spacing-md`, vertically centred
  // (`top: 50%; translateY(-50%)`), `--lb-icon-size` 16px square. The item's matching
  // `padding-left` (`:has([slot=icon])`) is the presence value `catalogItemSlotInset`.
  ListBox: () => {
    const fontSize = textPx("text-sm");
    const descSize = textPx("text-xs");
    const descLine = textPx("text-xs--line-height");
    const parts: CompiledPartRule[] = [
      ...(fontSize
        ? [
            {
              childType: "Header",
              via: "ListBoxSection",
              layout: { marginBottom: "4px" },
              visual: {
                fontSize,
                fontWeight: 700,
                lineHeight: 1.5,
                paddingX: 12,
                paddingY: 0,
              },
            },
          ]
        : []),
      {
        childType: "Text",
        via: "ListBoxItem",
        childProps: { slot: "label" },
        layout: {},
        visual: { fontWeight: 600 },
      },
      ...(descSize && descLine
        ? [
            {
              childType: "Text",
              via: "ListBoxItem",
              childProps: { slot: "description" },
              layout: {},
              visual: { fontSize: descSize, lineHeight: descLine / descSize },
            },
          ]
        : []),
      {
        childType: "Icon",
        via: "ListBoxItem",
        childProps: { slot: "icon" },
        layout: {
          position: "absolute",
          insetLeft: "12px",
          insetTop: "50%",
          marginTop: "-8px",
        },
        visual: { width: 16, height: 16, iconSize: 16 },
      },
    ];
    return { parts };
  },
  // `TagGroup.css` `.react-aria-TagList { display: contents }`: the visible box is
  // `.tag-list-wrapper` (flex wrap, centered, catalog `TagList` size gap/min-height). Its
  // `height: 100%` resolves against the RAC TagGroup, which `TagGroup.tsx` renders at auto height
  // inside the `div` carrying the element style, so the percentage never applies.
  // The wrapper's size values follow the group's `data-tag-size` (TagGroup parts below), not the
  // TagList's own size prop.
  TagList: () => ({
    replace: true,
    layout: { display: "flex", flexWrap: "wrap", alignItems: "center" },
  }),
  // `.react-aria-GridListItem .react-aria-Text:not([slot="description"])`: weight 600 for an item's
  // Text children; a description keeps the item's weight and is muted. The Preview marks the slot in a GridList
  // and in a standalone item's GridList host (4e-11).
  GridListItem: () => ({
    parts: <CompiledPartRule[]>[
      { childType: "Text", layout: {}, visual: { fontWeight: 600 } },
      // `GridList.css` `[slot="description"] { color: var(--fg-muted) }`.
      {
        childType: "Text",
        childProps: { slot: "description" },
        layout: {},
        visual: { fontWeight: 400, color: "{color.neutral-subdued}" },
      },
    ],
  }),
  // `generated/Input.css` is not loaded (`UNLOADED_GENERATED_CSS` B): the box is the manual
  // `base.css` `.react-aria-Input` — `width: 100%`, 1px border, `padding: var(--input-padding,
  // var(--spacing))`, no height (content = line box). The owner's delegation variables
  // (`--input-padding` …, compiled part rules) replace the padding per owner size; the Input's own
  // `sizes[*].height` is read by no stylesheet.
  Input: () => ({
    replace: true,
    layout: { display: "block" },
    visual: { width: "100%", borderWidth: 1, paddingY: 4, paddingX: 4 },
  }),
  // No generated CSS (no `structure`) and no DOM element with its class: the field's trigger wrapper
  // is the owner's delegation box (`.react-aria-Group` / `.combobox-container` /
  // `.searchfield-container` / Select's `.react-aria-Button`) and the value is the owner's input or
  // `SelectValue` span. Their height is the content line box plus the owner's padding; the rule's
  // `sizes[*].height` is read by no stylesheet.
  SelectTrigger: () => ({ omit: ["height"] }),
  // `generated/DisclosureHeader.css` is not loaded (`UNLOADED_GENERATED_CSS` E): the header is the
  // Disclosure's trigger button, as tall as its content (Disclosure part rules).
  DisclosureHeader: () => ({ omit: ["height"] }),
  // `generated/CalendarHeader.css` is not loaded (`UNLOADED_GENERATED_CSS` D): the header row is
  // the Calendar's own `<header>` composition — nav buttons and heading at the Calendar's size
  // (`catalogCalendarHeaderParts`, read through the owner).
  CalendarHeader: () => ({ omit: ["height"] }),
  // `generated/ProgressBarValue.css` / `MeterValue.css` are not loaded (`UNLOADED_GENERATED_CSS`
  // D): the owner's `.value` span sets only its font size, so its line height is the root's
  // (inherited).
  ProgressBarValue: () => ({ omit: ["lineHeight"] }),
  MeterValue: () => ({ omit: ["lineHeight"] }),
  SelectValue: () => ({ omit: ["height"] }),
  // No generated CSS (no `structure`): the DOM DateInput is the RAC segment row, boxed only by the
  // owning field's delegation (padding/border); `sizes.height` is read by no stylesheet.
  DateInput: () => ({ replace: true, layout: { display: "inline-flex" } }),
  // `Label.css` (generated CSS disabled): a fit-content inline box that does not stretch.
  Label: () => ({
    layout: { display: "inline-flex", alignItems: "center" },
    visual: { width: "fit-content", height: "fit-content" },
  }),
  // The crumb's own sheet is not loaded (below): its text inherits the Breadcrumbs size font.
  // `Breadcrumbs.css` `[data-size]` also sets `--breadcrumb-gap` (the crumb row's and the list's gap —
  // catalog `Breadcrumb.sizes[size].gap`) and `--breadcrumb-icon-size` (the separator Icon after the
  // Link, `.react-aria-Breadcrumb > .react-aria-Icon svg`). A crumb's label Text sits in the RAC
  // `Link` and inherits its font (`.react-aria-Link .react-aria-Text { inherit }`): the size font at
  // the Link sheet's line-height ratio, regular weight (the current crumb's weight is the root's).
  Breadcrumbs: () => ({
    parts: Object.entries(sizesOf("Breadcrumbs")).flatMap(
      ([name, values]): CompiledPartRule[] => {
        const crumbFont = px(values.fontSize);
        if (!crumbFont) return [];
        const crumb = sizesOf("Breadcrumb")[name];
        const gap = typeof crumb?.gap === "number" ? crumb.gap : 0;
        const iconSize = px(crumb?.iconSize) ?? 16;
        const crumbText = (
          COMPONENT_RULES_TABLE as Record<string, ComponentRule>
        ).Breadcrumb?.variants.default?.colors?.text;
        return [
          {
            childType: "Breadcrumb",
            size: name,
            layout: {},
            visual: { fontSize: crumbFont, gap },
          },
          {
            childType: "Text",
            via: "Breadcrumb",
            size: name,
            layout: {},
            visual: {
              fontSize: crumbFont,
              ...(linkLineHeightRatio()
                ? { lineHeight: linkLineHeightRatio()! }
                : {}),
              fontWeight: 400,
              // The Link's color (`.react-aria-Link { color: var(--fg-muted) }`) = catalog
              // `Breadcrumb.colors.text`; the current crumb's accent is `catalogTextMetrics`'.
              ...(crumbText ? { color: crumbText } : {}),
            },
          },
          {
            childType: "Icon",
            via: "Breadcrumb",
            childProps: { slot: "separator" },
            size: name,
            layout: {},
            visual: { width: iconSize, height: iconSize, iconSize },
          },
        ];
      },
    ),
  }),
  // `generated/Breadcrumb.css` is not loaded (`UNLOADED_GENERATED_CSS` B): the crumb box is the
  // manual `Breadcrumbs.css` `.react-aria-Breadcrumb { display: inline-flex; align-items: center }`
  // (no size height/padding), sized by its Link's line box. The crumb's text is always a RAC
  // `Link` (`renderBreadcrumbs`, and the orphan host alike): its line box is the Link sheet's
  // default-size `line-height` ratio (unitless `--text-sm--line-height`) at the crumb font.
  // `Breadcrumbs.css` base `--breadcrumb-gap` / `--breadcrumb-icon-size` (the default size's values —
  // a crumb outside Breadcrumbs is hosted without `data-size`); inside Breadcrumbs the owner's
  // per-size parts (above, applied after these) take over.
  Breadcrumb: () => {
    const ratio = linkLineHeightRatio();
    const rule = (COMPONENT_RULES_TABLE as Record<string, ComponentRule>)
      .Breadcrumb;
    const base = rule?.defaultSize ? rule.sizes[rule.defaultSize] : undefined;
    const gap = typeof base?.gap === "number" ? base.gap : 0;
    const iconSize = px(base?.iconSize) ?? 16;
    return {
      replace: true,
      layout: { display: "inline-flex", alignItems: "center" },
      visual: { ...(ratio ? { lineHeight: ratio } : {}), gap },
      parts: [
        {
          childType: "Icon",
          childProps: { slot: "separator" },
          layout: {},
          visual: { width: iconSize, height: iconSize, iconSize },
        },
      ],
    };
  },
  // `Tree.css` row (`:where(.react-aria-Tree[data-composition-tree]) .react-aria-TreeItem`): flex,
  // centered, `gap: --spacing-2xs`, `min-height: 32px`, `padding: --spacing-xs --spacing-sm`. Its
  // chevron button is an owner-composed part (`catalogComposedParts`).
  TreeItem: () => ({
    layout: { display: "flex", flexDirection: "row", alignItems: "center" },
    visual: { gap: 2, minHeight: 32, paddingY: 4, paddingX: 8 },
  }),
  // `renderSwitch` draws the Switch's own `children` text in `label.react-aria-Switch`; the
  // template's Label child has no DOM element, so its text takes the `Switch.css` size font.
  Switch: () => ({
    parts: ownerTextParts("Label", {
      sm: "text-xs",
      md: "text-sm",
      lg: "text-base",
      xl: "text-lg",
    }),
  }),
  Tab: () => ({ parts: itemLabelFontParts("Tab") }),
  // `TagGroup.css` `.react-aria-Tag > .react-aria-Icon[slot=icon]` (14px) and
  // `> .react-aria-Avatar[slot=avatar]` (16px, no shrink); the label gap is the Tag's flex gap
  // (catalog leading gap 4). The Preview marks the slots in a TagGroup and in a standalone Tag's
  // TagGroup host (4e-11).
  Tag: () => ({
    parts: [
      ...itemLabelFontParts("Tag"),
      {
        childType: "Icon",
        childProps: { slot: "icon" },
        layout: {},
        visual: { width: 14, height: 14, iconSize: 14 },
      },
      {
        childType: "Avatar",
        childProps: { slot: "avatar" },
        layout: { flexShrink: "0" },
        visual: { width: 16, height: 16 },
      },
    ],
  }),
  // `Radio.css` `.react-aria-Radio { width: fit-content }` (the generated sheet sets no width): a
  // radio keeps its content width inside the group's stretching `.radio-items` column.
  Radio: () => ({ visual: { width: "fit-content" } }),
  // `RadioGroup.tsx` / `CheckboxGroup.tsx` also carry `data-size` (4e-11 — the generated
  // `[data-size]` blocks apply); `TagGroup.tsx` puts the size on `data-tag-size` only. The manual
  // sheets (`Radio.css` / `Checkbox.css` / `TagGroup.css`) set the group Label font.
  RadioGroup: () => ({
    parts: [
      ...groupLabelFontParts({
        sm: "text-xs",
        md: "text-sm",
        lg: "text-base",
        xl: "text-lg",
      }),
      ...groupItemIndicatorParts("Radio", {
        sm: "text-base",
        md: "text-xl",
        lg: "text-2xl",
        xl: "text-3xl",
      }),
    ],
  }),
  CheckboxGroup: () => ({
    parts: [
      ...groupLabelFontParts({
        sm: "text-xs",
        md: "text-sm",
        lg: "text-base",
        xl: "text-lg",
      }),
      ...groupItemIndicatorParts("Checkbox", {
        sm: "text-base",
        md: "text-xl",
        lg: "text-2xl",
        xl: "text-3xl",
      }),
    ],
  }),
  // The chip wrapper (`.tag-list-wrapper`, typed TagList) takes the catalog `TagList` size gap and
  // min-height by the same group size (`TagGroup.tsx` writes `data-tag-size` on both).
  TagGroup: () => ({
    rootSizeAttribute: "data-tag-size",
    parts: [
      ...groupLabelFontParts({
        xs: "text-2xs",
        sm: "text-xs",
        md: "text-sm",
        lg: "text-base",
        xl: "text-lg",
      }),
      ...Object.entries(sizesOf("TagList")).map(
        ([size, values]): CompiledPartRule => ({
          childType: "TagList",
          size,
          layout: {},
          visual: {
            ...(typeof values.gap === "number" ? { gap: values.gap } : {}),
            ...(typeof values.minHeight === "number"
              ? { minHeight: values.minHeight }
              : {}),
          },
        }),
      ),
    ],
  }),
  // `Form.tsx` renders RAC Form with label/necessity data attributes only (no size): the generated
  // `.react-aria-Form[data-size]` gap blocks never match.
  Form: () => ({ rootSizeAttribute: null }),
};

/**
 * Item types whose label Text takes the item's color: `TabsIndicator.css` / `TagGroup.css`
 * `.react-aria-Tab/Tag .react-aria-Text.react-aria-Text { color: inherit }` (the Text rule's own
 * color does not apply). Each entry holds the item colors a manual sheet declares over the rule's
 * variant colors: `TabsIndicator.css` `.react-aria-Tab[data-selected] { color: var(--fg) }`.
 */
export const MANUAL_ITEM_LABEL_COLORS: Readonly<
  Record<string, { readonly selectedText?: string }>
> = {
  Tab: { selectedText: "{color.neutral}" },
  Tag: {},
};

export function manualBoxRule(type: string): ManualBoxRule | undefined {
  return RULES[type]?.();
}
