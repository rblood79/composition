import {
  resolveToken,
  tokenToCSSVar,
  type TokenRef,
} from "@composition/rendering";
import {
  catalogTimelineChromeAnchors,
  catalogTimelineChromeColors,
  catalogTimelineItemMinMain,
  catalogTimelineItemPadding,
  catalogTimelineOrientation,
  catalogTimelinePlacement,
  catalogTimelineSide,
  catalogTimelineSize,
  catalogTimelineStatus,
  TIMELINE_ITEM_RULE,
  TIMELINE_MARKER_BORDER,
  type TimelineChromeAnchor,
  type TimelineOrientation,
  type TimelinePlacement,
  type TimelineSide,
  type TimelineSize,
  type TimelineStatus,
} from "../rule/timeline";

/**
 * ADR-323 Phase 2 — Timeline 의 파생 값 · 배치 · DOM inline 값. 두 consumer 가 같은 함수를 읽는다:
 * Canvas 는 record 의 파생 값 (`presence.ts`) 을 `styleOf` · `catalogBoxModel` · `ruleShapes.ts` 로,
 * DOM 은 같은 파생 값을 inline (`domBinding.runtime.ts` `authoredStyle`) 과 표식 · 선 `span`
 * (`delegatedDom.runtime.ts` `timelineitem`) 으로. 상호작용이 없어 실행 상태도 없다 — 상태는 항목의
 * 작성값 (또는 연결된 행의 상태 필드, resolver) 이다.
 */

/** The px a size's title line is (the TimelineItem rule's `lineHeight` token — the device set's). */
export function catalogTimelineLineHeight(size: TimelineSize): number {
  const ref = TIMELINE_ITEM_RULE.sizes[size]?.lineHeight;
  const value = typeof ref === "string" ? resolveToken(ref as TokenRef) : ref;
  return typeof value === "number"
    ? value
    : Number.parseFloat(String(value)) || 0;
}

/** The list's derived values (its direction · placement for `styleOf` and the DOM inline). */
export function catalogTimelineDerived(
  props: Readonly<Record<string, unknown>>,
): Record<string, string> {
  return {
    _timelineOrientation: catalogTimelineOrientation(props.orientation),
    _timelinePlacement: catalogTimelinePlacement(props.position),
  };
}

/**
 * An item's derived values in its list: its status, its place (index · last · side), the list's
 * orientation · placement and size, and the room it keeps for its marker · connector (the Canvas's
 * `catalogBoxModel` reads the pads under an authored side; the DOM writes the same ones inline).
 */
export function catalogTimelineItemDerived(input: {
  index: number;
  count: number;
  list: Readonly<Record<string, unknown>>;
  status: unknown;
  size: unknown;
}): Record<string, string | number | boolean> {
  const orientation = catalogTimelineOrientation(input.list.orientation);
  const placement = catalogTimelinePlacement(input.list.position);
  const side = catalogTimelineSide(orientation, placement, input.index);
  const size = catalogTimelineSize(input.size);
  const pad = catalogTimelineItemPadding({
    orientation,
    placement,
    side,
    size,
    lineHeight: catalogTimelineLineHeight(size),
  });
  return {
    _timelineItemOrientation: orientation,
    _timelineItemPlacement: placement,
    _timelineItemSide: side,
    _timelineItemStatus: catalogTimelineStatus(input.status),
    _timelineItemLast: input.index === input.count - 1,
    _timelineItemSize: size,
    _timelinePadTop: pad.top,
    _timelinePadRight: pad.right,
    _timelinePadBottom: pad.bottom,
    _timelinePadLeft: pad.left,
  };
}

/**
 * The layout values of a Timeline · TimelineItem record (both consumers — Canvas `styleOf`, DOM
 * inline; an authored item layout written after it wins):
 * - the list: a horizontal one is a row, its items' markers on one line (`start` → their bottoms);
 * - an item: a horizontal one takes an equal share, never under its marker + connector minimum; a
 *   vertical `start` one aligns its texts to its end; a vertical `alternate` one is half the list wide
 *   on its side (the line runs down the middle).
 */
export function catalogTimelineLayout(
  derived: Readonly<Record<string, unknown>> | undefined,
): Record<string, string | number> {
  if (typeof derived?._timelineOrientation === "string") {
    if (derived._timelineOrientation !== "horizontal") return {};
    return {
      flexDirection: "row",
      alignItems:
        derived._timelinePlacement === "start" ? "flex-end" : "flex-start",
    };
  }
  if (typeof derived?._timelineItemOrientation !== "string") return {};
  if (derived._timelineItemOrientation === "horizontal")
    return {
      flexGrow: 1,
      flexShrink: 1,
      flexBasis: "0px",
      minWidth: `${catalogTimelineItemMinMain(catalogTimelineSize(derived._timelineItemSize))}px`,
    };
  const start = derived._timelineItemSide === "start";
  return {
    ...(start ? { alignItems: "flex-end" } : {}),
    ...(derived._timelineItemPlacement === "alternate"
      ? { width: "50%", alignSelf: start ? "flex-start" : "flex-end" }
      : {}),
  };
}

const px = (value: number) => `${value}px`;

/** A Timeline · TimelineItem's DOM inline style: its layout and an item's room for its chrome. */
export function catalogTimelineDomStyle(
  derived: Readonly<Record<string, unknown>> | undefined,
): Record<string, string | number> {
  const layout = catalogTimelineLayout(derived);
  if (typeof derived?._timelineItemOrientation !== "string") return layout;
  return {
    ...layout,
    paddingTop: px(Number(derived._timelinePadTop)),
    paddingRight: px(Number(derived._timelinePadRight)),
    paddingBottom: px(Number(derived._timelinePadBottom)),
    paddingLeft: px(Number(derived._timelinePadLeft)),
  };
}

/** An item's geometry input from its derived values. */
export function catalogTimelineGeometryOf(
  derived: Readonly<Record<string, unknown>>,
): {
  orientation: TimelineOrientation;
  placement: TimelinePlacement;
  side: TimelineSide;
  size: TimelineSize;
  lineHeight: number;
  last: boolean;
  status: TimelineStatus;
} {
  const size = catalogTimelineSize(derived._timelineItemSize);
  return {
    orientation: catalogTimelineOrientation(derived._timelineItemOrientation),
    placement: catalogTimelinePlacement(derived._timelineItemPlacement),
    side: derived._timelineItemSide === "start" ? "start" : "end",
    size,
    lineHeight: catalogTimelineLineHeight(size),
    last: derived._timelineItemLast === true,
    status: catalogTimelineStatus(derived._timelineItemStatus),
  };
}

/**
 * An item's marker · connector as the DOM draws them: each `span`'s inline place (the anchors the
 * Canvas resolves into its shapes' rects) and paint (the same TokenRefs, as the theme's variables).
 * Undefined outside a Timeline.
 */
export function catalogTimelineChromeDom(
  derived: Readonly<Record<string, unknown>> | undefined,
):
  | { marker: Record<string, string>; connector?: Record<string, string> }
  | undefined {
  if (typeof derived?._timelineItemStatus !== "string") return undefined;
  const geometry = catalogTimelineGeometryOf(derived);
  const anchors = catalogTimelineChromeAnchors(geometry);
  const colors = catalogTimelineChromeColors(geometry.status);
  const place = (anchor: TimelineChromeAnchor) =>
    Object.fromEntries(
      Object.entries(anchor).flatMap(([key, value]) =>
        value === undefined ? [] : [[key, px(value)]],
      ),
    );
  return {
    marker: {
      ...place(anchors.marker),
      ...(colors.markerFill
        ? { background: tokenToCSSVar(colors.markerFill) }
        : {}),
      ...(colors.markerBorder
        ? {
            border: `${tokenToCSSVar(TIMELINE_MARKER_BORDER)} solid ${tokenToCSSVar(colors.markerBorder)}`,
          }
        : {}),
    },
    ...(anchors.connector
      ? {
          connector: {
            ...place(anchors.connector),
            background: tokenToCSSVar(colors.connector),
          },
        }
      : {}),
  };
}

/**
 * A date text's machine-readable value (the `time` element's `dateTime`): an ISO day · day and time
 * (· offset) as written, the space between day and time as `T`; undefined for any other text (the
 * element stays a `span` — a `time` with an invalid value is not one).
 */
export function catalogTimelineDateTime(value: unknown): string | undefined {
  if (typeof value !== "string") return undefined;
  const text = value.trim().replace(/^(\d{4}-\d{2}-\d{2}) (?=\d)/, "$1T");
  return /^\d{4}-\d{2}-\d{2}(T\d{2}:\d{2}(:\d{2}(\.\d+)?)?(Z|[+-]\d{2}:?\d{2})?)?$/.test(
    text,
  )
    ? text
    : undefined;
}
