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
import {
  cssVarToTokenRef,
  resolveToken,
  type TokenRef,
} from "@composition/rendering";
import { COMPONENT_RULES_TABLE } from "../generated/componentRulesTable";
import type { ComponentRule } from "../../types/catalog-style.types";
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

/**
 * ADR-256 Phase 6b — the range picker's Group box paint, the `DateRangePicker` rule's own bridge
 * values (`.react-aria-Group` `background` · `border` color).
 */
export const DATE_RANGE_GROUP_PAINT = {
  fill: "var(--bg-inset)",
  borderColor: "var(--border)",
} as const;

/** `TabsIndicator.css` `.react-aria-Tab .react-aria-SelectionIndicator` thickness (every size). */
const TAB_INDICATOR = 3;
/** `TagGroup.css` `.react-aria-Tag[data-allows-removing] { padding-right: var(--spacing-xs) }`. */
const TAG_REMOVE_PADDING_RIGHT = 4;

const sizesOf = (type: string) =>
  (COMPONENT_RULES_TABLE as Record<string, ComponentRule>)[type]?.sizes ?? {};
/** The DateRangePicker rule's `.react-aria-Group` delegation variables, by size. */
const DATE_RANGE_GROUP_VARIABLES = () =>
  (
    (COMPONENT_RULES_TABLE as Record<string, ComponentRule>).DateRangePicker
      ?.structure?.composition?.delegation as
      Array<{ prefix?: string; variables?: unknown }> | undefined
  )?.find((entry) => entry.prefix === "drp-group")?.variables as
    Record<string, Record<string, unknown> | undefined> | undefined;

/**
 * ADR-256 Phase 9 — a calendar header's nav Button side · heading font (`CalendarCommon.css`). The
 * calendar has no size (사용자 2026-10-13 — RAC · S2 take none): the header is fixed.
 */
const CALENDAR_HEADER = { nav: "text-3xl", font: "text-sm" } as const;

/**
 * A calendar month block's own width: 7 cells (`CalendarGrid` rule `iconSize + 4`) plus the tds' 2px
 * padding each side (`CalendarCommon.css` `.month`) — a calendar given a width stretches it.
 */
const calendarMonthWidth = (): number | undefined => {
  const icon = px(sizesOf("CalendarGrid").M?.iconSize);
  return icon === undefined ? undefined : 7 * (icon + 4 + 4);
};

/** RAC reference header gap (Calendar.md 「Month and year pickers」 `gap: 4`) — `CalendarCommon.css`. */
const CALENDAR_HEADER_GAP = 4;

/** `Separator.css` size margins (`--spacing-xs/sm/lg`) on the axis across the line. */
const SEPARATOR_MARGIN: Readonly<Record<string, number>> = {
  S: 4,
  M: 8,
  L: 16,
};

/** `renderButtonGroup` inline style (`LayoutRenderers.tsx`): gap by size, justify by align. */
const BUTTON_GROUP_GAP: Readonly<Record<string, number>> = {
  XS: 4,
  S: 6,
  M: 8,
  L: 10,
  XL: 12,
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
 * A child the owner's DOM renderer does not render: the owner draws its own `children` text in
 * that place, which inherits the owner's manual size font (`font-size: var(--text-*)` +
 * `line-height: var(--text-*--line-height)`, weight 400) instead of the child's own defaults.
 */
const ownerTextParts = (
  childType: string,
  fonts: Readonly<Record<string, string>>,
  via?: string,
): CompiledPartRule[] =>
  Object.entries(fonts).flatMap(([size, name]): CompiledPartRule[] => {
    const fontSize = textPx(name);
    const lineHeight = textPx(`${name}--line-height`);
    return fontSize && lineHeight
      ? [
          {
            childType,
            ...(via ? { via } : {}),
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
 *
 * ADR-251: the items sit in the group's items wrapper (RadioItems / CheckboxItems); the group
 * reaches them through it (`via`). The item's Label offset needs no group rule: the group size
 * reaches the item (`CATALOG_SIZE_PROPAGATION`), so the item's own rule gives the same offset.
 */
const GROUP_ITEM_INDICATORS: Readonly<Record<string, string>> = {
  S: "text-base",
  M: "text-xl",
  L: "text-2xl",
  XL: "text-3xl",
};
const groupItemIndicatorParts = (
  itemType: string,
  wrapperType: string,
): CompiledPartRule[] =>
  Object.entries(GROUP_ITEM_INDICATORS).flatMap(
    ([size, name]): CompiledPartRule[] => {
      const indicator = textPx(name);
      return indicator
        ? [
            {
              childType: itemType,
              via: wrapperType,
              size,
              layout: {},
              visual: { minHeight: indicator },
            },
          ]
        : [];
    },
  );
/** The Link sheet's default-size unitless `line-height` (a Breadcrumb crumb's text line box). */
const linkLineHeightRatio = (): number | undefined => {
  const link = (COMPONENT_RULES_TABLE as Record<string, ComponentRule>).Link;
  const size = link?.defaultSize ? link.sizes[link.defaultSize] : undefined;
  const fontSize = px(size?.fontSize);
  const lineHeight = px(size?.lineHeight);
  return fontSize && lineHeight ? lineHeight / fontSize : undefined;
};

/** The reference GridList's card columns (`GridList.css` `--grid-item-size` 200). */
const GRID_LIST_TRACKS = "repeat(auto-fit, minmax(100px, 200px))";

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
    // The typed root becomes the DOM inline box; retain its catalog intrinsic height.
    visual: {
      height:
        COMPONENT_RULES_TABLE.ButtonGroup.structure!.containerStyles!.height!,
    },
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
  // 2026-10-13 (사용자 「gridlist 를 RAC 레퍼런스 테마 기준으로」 · 「이미지 카드로」) — the RAC
  // reference `GridList.css` (the manual sheet — only catalog GridLists carry its classes): a grid
  // padded 8, 16 between cards, `grid` = `repeat(auto-fit, minmax(100px, 200px))` centred rows,
  // `stack` = one centred `auto` column. A section is the same grid with its header across.
  GridList: () => ({
    replace: true,
    layout: {
      display: "grid",
      justifyContent: "center",
      // (The sheet's `grid-auto-rows: min-content` — the implicit `auto` rows are the same in a
      // list without a set height.)
      gridTemplateColumns: GRID_LIST_TRACKS,
    },
    visual: { width: "100%", gap: 16, paddingX: 8, paddingY: 8, radius: 8 },
    conditional: [
      {
        when: { layout: "stack" },
        // (The sheet's one column — the cards' 250 cap.)
        layout: {
          gridTemplateColumns: "minmax(0, 250px)",
          alignItems: "center",
        },
      },
    ],
    parts: <CompiledPartRule[]>[
      {
        childType: "GridListSection",
        layout: {
          display: "grid",
          justifyContent: "center",
          gridTemplateColumns: GRID_LIST_TRACKS,
        },
        visual: { width: "100%", gap: 16 },
      },
      // `.react-aria-GridListHeader` (RAC `GridListHeader` — no Header sheet reaches it): across the
      // section's columns, `--text-base` 500, `padding: 4 16`, the overlay surface in a hairline
      // border, radius 8 (line-height inherited from the Preview body, 1.5).
      {
        childType: "Header",
        via: "GridListSection",
        layout: { display: "block", gridColumnStart: "1", gridColumnEnd: "-1" },
        visual: {
          fontSize: textPx("text-base") ?? 16,
          fontWeight: 500,
          lineHeight: 1.5,
          paddingX: 16,
          paddingY: 4,
          radius: 8,
          fill: "var(--bg-overlay)",
          color: "{color.neutral}",
          borderStyle: "solid",
          borderColor: "var(--border)",
          borderWidth: Number(
            resolveToken("{border.width.hairline}" as TokenRef),
          ),
        } as CompiledPartRule["visual"],
      },
    ],
  }),
  // 2026-10-13 (사용자 「listbox 를 RAC 레퍼런스 테마 기준으로」) — the ListBox rule's item
  // selectors (`rootSelectors["&:not(.react-aria-Popover *)"]`, the reference `ListBox.css`) over
  // the generated Header · Text sheets:
  // - a section header: sticky, `--text-xs` 600, `padding: 4 16`, the overlay surface between two
  //   0.5px lines (line-height inherited from the Preview body, 1.5);
  // - the label: the item's text (14 · its line height · its color — `MANUAL_ITEM_LABEL_COLORS`),
  //   weight 500; the description `--text-xs` / `--text-xs--line-height` in the item's color.
  // Item slot roles: the Preview puts `slot` on an item child only inside a ListBox
  // (`itemSlotAttr`), hence the owner is the ListBox, through the item. The icon (`ListBox.css`
  // `[slot="icon"]`) absolutely placed at `left: --spacing-md`, vertically centred (`top: 50%;
  // translateY(-50%)`), `--lb-icon-size` 16px square. The item's matching `padding-left`
  // (`:has([slot=icon])`) is the presence value `catalogItemSlotInset`.
  ListBox: () => {
    const descSize = textPx("text-xs");
    const hairline = Number(resolveToken("{border.width.hairline}" as TokenRef));
    const parts: CompiledPartRule[] = [
      ...(descSize
        ? [
            {
              childType: "Header",
              via: "ListBoxSection",
              layout: { display: "block" },
              visual: {
                fontSize: descSize,
                fontWeight: 600,
                lineHeight: 1.5,
                paddingX: 16,
                paddingY: 4,
                fill: "var(--bg-overlay)",
                color: "{color.neutral}",
                borderStyle: "solid",
                borderColor: "var(--border)",
                borderTopWidth: hairline,
                borderRightWidth: 0,
                borderLeftWidth: 0,
                borderBottomWidth: hairline,
              } as CompiledPartRule["visual"],
            },
          ]
        : []),
      ...listBoxItemParts(),
    ];
    return { parts };
  },
  // A section's items take the same item parts (the sheet's descendant selectors reach them).
  ListBoxSection: () => ({ parts: listBoxItemParts() }),
  // `TagGroup.css` `.react-aria-TagList { display: contents }`: the visible box is
  // `.tag-list-wrapper` (flex wrap, centered, catalog `TagList` size gap/min-height) with the
  // catalog `height: 100%` — the RAC TagGroup fills the styled outer div (4e-11), so the wrapper
  // fills what the label leaves (a flex item shrinking to the column, floored by min-height).
  // The wrapper's size values follow the group's `data-tag-size` (TagGroup parts below), not the
  // TagList's own size prop.
  TagList: () => ({
    replace: true,
    layout: { display: "flex", flexWrap: "wrap", alignItems: "center" },
    visual: { height: "100%" },
  }),
  // The reference card (`GridList.css` — 2026-10-13 「이미지 카드로」): padded only at its bottom
  // (16), at most 250 wide, clipped. Its photo (an Image child) the card's width, 200 high, 8 above
  // the texts; its texts inset 16 a side — the label 500, the description `--text-xs`, both in the
  // card's color (`MANUAL_ITEM_LABEL_COLORS`); the selection checkbox over the photo, 16 in.
  GridListItem: () => {
    const fontSize = textPx("text-sm");
    const lineHeight = textPx("text-sm--line-height");
    const descSize = textPx("text-xs");
    const descLine = textPx("text-xs--line-height");
    return {
      layout: { maxWidth: "250px" },
      visual: { paddingTop: 0, paddingBottom: 16, overflow: "clip" },
      parts: <CompiledPartRule[]>[
        {
          childType: "Image",
          layout: { flexShrink: "0", marginBottom: "8px" },
          visual: { width: "100%", height: 200 },
        },
        {
          childType: "Text",
          layout: {},
          visual: {
            fontWeight: 500,
            paddingX: 16,
            ...(fontSize && lineHeight
              ? { fontSize, lineHeight: lineHeight / fontSize }
              : {}),
          },
        },
        {
          childType: "Text",
          childProps: { slot: "description" },
          layout: {},
          visual: {
            fontWeight: 400,
            paddingX: 16,
            ...(descSize && descLine
              ? { fontSize: descSize, lineHeight: descLine / descSize }
              : {}),
          },
        },
        {
          childType: "Checkbox",
          childProps: { slot: "selection" },
          layout: { position: "absolute", insetTop: "16px", insetLeft: "16px" },
          visual: {},
        },
      ],
    };
  },
  // ADR-256 Phase 9 — a calendar month block's header row (`generated/CalendarHeader.css` is not
  // loaded, `UNLOADED_GENERATED_CSS` D): `CalendarCommon.css` `.react-aria-Calendar header` — a flex
  // row (space-between, centered, 4 apart) around the author's parts. Its nav Buttons
  // (`Button[slot=previous|next]` — plain RAC Buttons) are `header > .react-aria-Button` boxes:
  // `--text-3xl` squares, no padding, border or fill, `--fg` glyph. Its RAC `CalendarHeading` fills
  // the rest (`flex: 1`) — `--text-sm`, bold, centered, `--text-base--line-height`.
  // ADR-256 Phase 9 — a calendar's month block (`CalendarCommon.css` `.month`): its header over its
  // grid, 6 apart.
  // ADR-256 Phase 9 — RAC's month · year pickers render no element: their Select is the header's
  // item (`display: contents` — the engine lays their children out in the parent's flow).
  CalendarMonthPicker: () => ({ replace: true, layout: { display: "contents" } }),
  CalendarYearPicker: () => ({ replace: true, layout: { display: "contents" } }),
  // (No size — 2026-10-13: 7 cells of 30 wide unless the calendar is given a width, which it then
  // fills, wider or narrower — the DOM's `.month` `width: 238px; flex: 1 1 auto; max-width: 100%`
  // with no intrinsic minimum (`container-type` — `min-width: 0` here); its grid's cells follow its
  // width — `catalogCalendarGridSize`.)
  CalendarMonth: () => {
    const width = calendarMonthWidth();
    return {
      replace: true,
      layout: {
        display: "flex",
        flexDirection: "column",
        flexGrow: "1",
        flexShrink: "1",
        maxWidth: "100%",
      },
      visual: { gap: 6, ...(width ? { width, minWidth: 0 } : {}) },
    };
  },
  CalendarHeader: () => ({
    replace: true,
    layout: {
      display: "flex",
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
    },
    // RAC reference (Calendar.md 「Month and year pickers」 — `header style={{display: 'flex', gap:
    // 4}}`): 4px between the header's parts (`CalendarCommon.css`, 2026-10-13).
    visual: { gap: CALENDAR_HEADER_GAP },
    parts: ((): CompiledPartRule[] => {
      const navHeight = textPx(CALENDAR_HEADER.nav);
      const fontSize = textPx(CALENDAR_HEADER.font);
      const triggerY = px(sizesOf("Button").M?.paddingY);
      const ratio =
        (px("{typography.text-base--line-height}") ?? 0) /
        (textPx("text-base") ?? 1);
      if (navHeight === undefined || fontSize === undefined) return [];
      const button = (slot: string): CompiledPartRule => ({
        childType: "Button",
        childProps: { slot },
        // (The reference starter's Buttons do not shrink — `Button.css` `flex-shrink: 0`.)
        layout: { flexShrink: "0" },
        // A square (사용자 2026-10-13 「높이가 30 이면 넓이도 30」 — the reference starter's
        // icon-only Button: `width: var(--spacing-8)` = its height).
        visual: {
          width: navHeight,
          height: navHeight,
          minWidth: 0,
          paddingTop: 0,
          paddingRight: 0,
          paddingBottom: 0,
          paddingLeft: 0,
          fill: "transparent",
          borderWidth: 0,
          color: "{color.neutral}",
        },
      });
      // A month · year picker's Select (through the picker — RAC renders no element for it): the
      // two share what the nav Buttons leave equally — the reference's equal-width Selects
      // (starter `Select.css` `width: 200px`, shrunk alike; the trigger `width: 100%; min-width:
      // 0`, the value ellipsized).
      const picker = (via: string): CompiledPartRule => ({
        childType: "Select",
        via,
        layout: { flexGrow: "1", flexShrink: "1", flexBasis: "0%" },
        visual: { width: "auto", minWidth: 0 },
      });
      return [
        button("previous"),
        button("next"),
        picker("CalendarMonthPicker"),
        picker("CalendarYearPicker"),
        // A picker's Select trigger starts twice the Button's paddingY in (사용자 2026-10-13 — 8;
        // through the picker — `PART_RULE_PASS_HOSTS`; `CalendarCommon.css`).
        ...(triggerY !== undefined
          ? [
              {
                childType: "Button",
                via: "Select",
                layout: {},
                visual: { paddingLeft: 2 * triggerY },
              } satisfies CompiledPartRule,
            ]
          : []),
        // (Their chevron Icon takes the Button's `--fg` — `currentColor`.)
        {
          childType: "Icon",
          via: "Button",
          layout: { flexShrink: "0" },
          visual: { color: "{color.neutral}" },
        },
        {
          childType: "CalendarHeading",
          layout: {
            display: "block",
            flexGrow: "1",
            flexShrink: "1",
            flexBasis: "0%",
          },
          visual: {
            fontSize,
            fontWeight: 700,
            ...(ratio > 0 ? { lineHeight: ratio } : {}),
            textAlign: "center",
            color: "{color.neutral}",
          },
        },
      ];
    })(),
  }),
  // `generated/ProgressBarValue.css` / `MeterValue.css` are not loaded (`UNLOADED_GENERATED_CSS`
  // D): the owner's `.value` span sets only its font size, so its line height is the root's
  // (inherited).
  ProgressBarValue: () => ({ omit: ["lineHeight"] }),
  MeterValue: () => ({ omit: ["lineHeight"] }),
  SelectValue: () => ({ omit: ["height"] }),
  // `Label.css` (generated CSS disabled): a fit-content inline box that does not stretch.
  Label: () => ({
    layout: { display: "inline-flex", alignItems: "center" },
    visual: { width: "fit-content", height: "fit-content" },
  }),
  // ADR-256 Phase 6b — a range picker's control Group paints the box (`DateRangePicker` rule
  // delegation `.react-aria-Group`: `background: var(--bg-inset)` · `border: … var(--border)` ·
  // `border-radius: var(--drp-group-radius)` = the size's radius token, read from the same
  // delegation's `variables`). The part rule compiler carries only its box geometry (padding ·
  // border width); the paint is stated here with the same values (`adr256FieldControlGroup` checks
  // the bridges still say so).
  DateRangePicker: () => ({
    parts: Object.keys(sizesOf("DateRangePicker")).map(
      (name): CompiledPartRule => {
        const radius = px(
          cssVarToTokenRef(
            String(
              DATE_RANGE_GROUP_VARIABLES()?.[name]?.["--drp-group-radius"],
            ),
          ),
        );
        return {
          childType: "Group",
          size: name,
          layout: {},
          visual: {
            fill: DATE_RANGE_GROUP_PAINT.fill,
            borderColor: DATE_RANGE_GROUP_PAINT.borderColor,
            ...(radius !== undefined ? { radius } : {}),
          },
        };
      },
    ),
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
          // ADR-256 Phase 5a: the crumb's label is the reference's RAC `Link` node — the same font
          // and color (`.react-aria-Breadcrumbs .react-aria-Link`; its resting underline is off —
          // the derived `_noUnderline`, Canvas only: the Preview's hover underline stays the sheet's).
          {
            childType: "Link",
            via: "Breadcrumb",
            size: name,
            layout: {},
            visual: {
              fontSize: crumbFont,
              ...(linkLineHeightRatio()
                ? { lineHeight: linkLineHeightRatio()! }
                : {}),
              fontWeight: 400,
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
        // ADR-256 Phase 5a: the label Link takes the crumb's font (a Text label inherited it) and
        // color — inside Breadcrumbs the owner's per-size parts take over.
        {
          childType: "Link",
          layout: {},
          visual: {
            ...(px(base?.fontSize) ? { fontSize: px(base?.fontSize)! } : {}),
            ...(ratio ? { lineHeight: ratio } : {}),
            fontWeight: 400,
            ...(rule?.variants.default?.colors?.text
              ? { color: rule.variants.default.colors.text }
              : {}),
          } as CompiledPartRule["visual"],
        },
      ],
    };
  },
  // ADR-256 후속 15: a node tree Table's paint — the data table's (`Table.css`): the header row on
  // `--bg-raised`, a 1px `--border-hover` line under the header cells, a 1px `--border` line under
  // each body row. Stated as the Table's part values, so both consumers read them (the parts have
  // no generated sheet — their resolved values go inline in the DOM). Every side's width is
  // stated: an inline `border-style: solid` alone would give the others the medium width.
  Table: () => ({
    parts: [
      {
        childType: "TableHeader",
        layout: {},
        visual: { fill: "var(--bg-raised)" },
      },
      {
        childType: "Column",
        via: "TableHeader",
        layout: {},
        visual: {
          borderStyle: "solid",
          borderColor: "var(--border-hover)",
          borderTopWidth: 0,
          borderRightWidth: 0,
          borderLeftWidth: 0,
          borderBottomWidth: 1,
        } as CompiledPartRule["visual"],
      },
      {
        childType: "Row",
        via: "TableBody",
        layout: {},
        visual: {
          borderStyle: "solid",
          borderColor: "var(--border)",
          borderTopWidth: 0,
          borderRightWidth: 0,
          borderLeftWidth: 0,
          borderBottomWidth: 1,
        } as CompiledPartRule["visual"],
      },
    ],
  }),
  // ADR-256 Phase 5b: a picker item is the sheet's `.react-aria-ColorSwatchPicker >
  // .react-aria-ColorSwatchPickerItem { display: flex }` box, `width: fit-content` (manual
  // `ColorSwatchPicker.css`) around its ColorSwatch.
  ColorSwatchPicker: () => ({
    parts: [
      {
        childType: "ColorSwatchPickerItem",
        layout: { display: "flex" },
        visual: { width: "fit-content" },
      },
    ],
  }),
  // `Tree.css` row (`:where(.react-aria-Tree[data-composition-tree]) .react-aria-TreeItem`): flex,
  // centered, `gap: --spacing-2xs`, `min-height: 32px`, `padding: --spacing-xs --spacing-sm`. Its
  // chevron button is an owner-composed part (`catalogComposedParts`).
  TreeItem: (): ManualBoxRule => ({
    layout: { display: "flex", flexDirection: "row", alignItems: "center" },
    visual: { gap: 2, minHeight: 32, paddingY: 4, paddingX: 8 },
    parts: [
      // ADR-256 Phase 5h: the row content (RAC `TreeItemContent` — no element: its children sit in
      // the row's `display: contents` cell, so they are the row's flex items). The Canvas lays it
      // out as the row itself — the `Tree.css` row box above, while the item is a column holding
      // the row and then its child items (`catalogTreeItemLayout` — RAC draws them as the next
      // rows, ADR-256 후속 14). The chevron's `height: 100%` reads an indefinite row height: its own.
      {
        childType: "TreeItemContent",
        layout: {
          display: "flex",
          flexDirection: "row",
          alignItems: "center",
        },
        visual: {
          gap: 2,
          minWidth: 0,
          minHeight: 32,
          paddingY: 4,
          paddingX: 8,
        },
      },
      // Its chevron button: the sheet's `.react-aria-Button[slot=chevron]` (`all: unset` — a bare
      // box around the svg). Its width and level indent are `catalogTreeChevronLayout` on the
      // Canvas and the sheet's in the DOM.
      {
        childType: "Button",
        via: "TreeItemContent",
        childProps: { slot: "chevron" },
        layout: {},
        visual: {
          minWidth: 0,
          minHeight: 0,
          paddingRight: 0,
          paddingY: 0,
          borderWidth: 0,
          radius: 0,
          fill: "transparent",
        },
      },
    ],
  }),
  // The Switch's text (a Label node in its RAC SwitchButton — ADR-256 Phase 3) takes the
  // `Switch.css` size font the old `label.react-aria-Switch` gave its own `children` text.
  Switch: () => ({
    parts: ownerTextParts(
      "Label",
      {
        S: "text-xs",
        M: "text-sm",
        L: "text-base",
        XL: "text-lg",
      },
      "SwitchButton",
    ),
  }),
  // ADR-256 Phase 5e: the Tab's SelectionIndicator node is `TabsIndicator.css` `.react-aria-Tab
  // .react-aria-SelectionIndicator` — an accent 3px bar along the bottom, out of the Tab's flow. It
  // anchors the bottom-right corner, so a vertical TabList's bar (the right edge, Tab height —
  // `catalogSelectionIndicatorLayout`) only swaps its size.
  Tab: () => ({
    parts: [
      ...itemLabelFontParts("Tab"),
      {
        childType: "SelectionIndicator",
        layout: {
          position: "absolute",
          insetRight: "0px",
          insetBottom: "0px",
        },
        visual: {
          width: "100%",
          height: TAB_INDICATOR,
          fill: "var(--accent)",
        },
      },
    ],
  }),
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
      // ADR-256 Phase 5d: the remove button (RAC `Button[slot=remove]`, the reference's) is the
      // sheet's `.tag-remove-btn` — a bare round 18px box around the 14px glyph, 2px after the
      // label — and the chip's `[data-allows-removing] { padding-right: --spacing-xs }`: the button
      // takes back the chip's right padding beyond 4px (per chip size).
      ...Object.entries(sizesOf("Tag")).map(
        ([size, values]): CompiledPartRule => ({
          childType: "Button",
          childProps: { slot: "remove" },
          size,
          layout: {
            flexShrink: "0",
            marginLeft: "2px",
            marginRight: `${TAG_REMOVE_PADDING_RIGHT - (px(values.paddingX) ?? 0)}px`,
          },
          visual: {
            width: 18,
            height: 18,
            minWidth: 0,
            paddingX: 2,
            paddingY: 2,
            borderWidth: 0,
            radius: 9,
            fill: "transparent",
          },
        }),
      ),
      {
        childType: "Icon",
        via: "Button",
        viaProps: { slot: "remove" },
        layout: {},
        visual: { width: 14, height: 14, iconSize: 14 },
      },
    ],
  }),
  // `Radio.css` `.react-aria-Radio { width: fit-content }` (the generated sheet sets no width): a
  // radio keeps its content width inside the group's stretching `.radio-items` column.
  Radio: () => ({ visual: { width: "fit-content" } }),
  // `RadioGroup.tsx` / `CheckboxGroup.tsx` also carry `data-size` (4e-11 — the generated
  // `[data-size]` blocks apply); `TagGroup.tsx` puts the size on `data-tag-size` only. The group
  // Label is an instance of the Label origin, sized by the Label rule at the group's size
  // (ADR-253 — `CATALOG_SIZE_PROPAGATION`).
  RadioGroup: () => ({
    parts: [...groupItemIndicatorParts("Radio", "RadioItems")],
  }),
  CheckboxGroup: () => ({
    parts: [...groupItemIndicatorParts("Checkbox", "CheckboxItems")],
  }),
  // The chip wrapper (`.tag-list-wrapper`, typed TagList) takes the catalog `TagList` size gap and
  // min-height by the same group size (`TagGroup.tsx` writes `data-tag-size` on both).
  TagGroup: () => ({
    rootSizeAttribute: "data-tag-size",
    parts: [
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
  // (Form: `Form.tsx` carries `data-size` since 2026-10-14 — the generated `[data-size]` gap ·
  //  font · radius blocks apply, so the Form's size reaches the Canvas too. Before, neither drew it.)
};

/**
 * A ListBox item's slot children (the ListBox rule's item selectors — the RAC reference): the label
 * is the item's text (14 · its line height — `MANUAL_ITEM_LABEL_COLORS` its color), weight 500; the
 * description `--text-xs` / `--text-xs--line-height`; the icon absolutely placed at `left:
 * --spacing-md`, vertically centred, 16 square (`ListBox.css` `[slot="icon"]`). Reached through the
 * item from the list and from a section.
 */
function listBoxItemParts(): CompiledPartRule[] {
  const fontSize = textPx("text-sm");
  const lineHeight = textPx("text-sm--line-height");
  const descSize = textPx("text-xs");
  const descLine = textPx("text-xs--line-height");
  return [
    ...(fontSize && lineHeight
      ? [
          {
            childType: "Text",
            via: "ListBoxItem",
            childProps: { slot: "label" },
            layout: {},
            visual: {
              fontSize,
              lineHeight: lineHeight / fontSize,
              fontWeight: 500,
            },
          },
        ]
      : []),
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
}

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
  // The reference ListBox item's label · description inherit its color (the selected white).
  ListBoxItem: {},
  // The reference GridList card's label · description inherit its color.
  GridListItem: {},
};

export function manualBoxRule(type: string): ManualBoxRule | undefined {
  return RULES[type]?.();
}
