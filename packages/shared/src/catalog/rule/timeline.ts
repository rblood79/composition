import type { TokenRef } from "@composition/rendering";
import type { ComponentRule } from "../../types/catalog-style.types";

/**
 * ADR-323 Phase 2 — Timeline · TimelineItem 의 rule (D3). S2 · design-data · v3 에 없는 컴포넌트라
 * (breakdown §9 Phase 0 — D2 정본 순서 4) 값은 저장소 사다리에서 고른다: 글자 = StepList 와 같은
 * `text-xs · sm · base`, 표식 · 간격 = S2 spacing 단, 색 = StepList 의 상태 색 (사용자 결정 1 「항목마다
 * 상태」 — 완료 · 진행 중 · 예정이 같은 뜻이다).
 *
 * 모양 (breakdown §5.3): 목록 = 항목의 열 (가로면 줄). 항목 = 제목 · 날짜 · 설명 Text (와 작성자가 넣은
 * 자유 내용) 옆에 표식과 다음 항목으로 가는 연결선. 표식 · 선은 노드가 아니라 항목이 자기 여백 안에
 * 그린다 (StepList 의 방식 — `rule/stepList.ts`). 자리 · 색은 이 파일의 함수 하나씩
 * (`catalogTimelineItemPadding` · `catalogTimelineChromeAnchors` · `catalogTimelineChromeColors`) 이고 두
 * consumer 가 같이 읽는다 — DOM 은 `span.timeline-marker` · `span.timeline-connector` 의 inline 값
 * (`runtime/timeline.ts` · `delegatedDom.runtime.ts`), Canvas 는 상자 (`catalogBoxModel`) 와 도형
 * (`ruleShapes.ts` `catalogTimelineChromeShapes`). 생성 CSS 는 바뀌지 않는 모양만 든다.
 *
 * 배치 (prop `position` — MUI Timeline 의 이름): `end` = 내용이 선 뒤 (세로 — 선의 오른쪽, 가로 — 선 아래), `start` = 앞 (세로 —
 * 왼쪽, 끝 맞춤 · 가로 — 위), `alternate` = 세로에서 항목마다 번갈아 (선은 가운데 — 항목은 목록 폭의
 * 절반). 가로의 `alternate` 는 `end` 로 그린다 — 항목 높이가 내용마다 달라 선의 높이를 맞출 수 없다
 * (G2 의 실패 시 대안 「번갈아 배치를 빼고 보고」 를 가로에만 적용, breakdown §9 Phase 2).
 */

export const TIMELINE_TYPE = "Timeline";
export const TIMELINE_ITEM_TYPE = "TimelineItem";

export const TIMELINE_SIZES = ["S", "M", "L"] as const;
export type TimelineSize = (typeof TIMELINE_SIZES)[number];
export type TimelineOrientation = "vertical" | "horizontal";
export type TimelinePlacement = "start" | "end" | "alternate";
/** 사용자 결정 1 (2026-11-28 「항목마다 상태」) — 항목 하나의 상태. */
export const TIMELINE_STATUSES = ["completed", "current", "upcoming"] as const;
export type TimelineStatus = (typeof TIMELINE_STATUSES)[number];
/** 그려지는 쪽 — `alternate` 는 항목마다 `end` · `start` 로 풀린다. */
export type TimelineSide = "start" | "end";

/**
 * 크기별 값 — `marker` = 표식 지름, `markerGap` = 표식과 글자 간격, `spacing` = 다음 항목까지 (항목의
 * 끝 여백 — 선이 이 안을 지난다), `secondary` = 날짜 · 설명 글자 (제목보다 한 단계 아래 — Step 설명과
 * 같은 값). 제목 글자 = `text-xs · sm · base`.
 */
const sizeBlock = (
  font: string,
  marker: number,
  markerGap: number,
  spacing: number,
  secondary: number,
) => ({
  height: 0,
  fontSize: `{typography.${font}}`,
  lineHeight: `{typography.${font}--line-height}`,
  borderRadius: "{radius.none}",
  iconSize: marker,
  iconGap: markerGap,
  spacing,
  secondary,
});
const SIZE_VALUES = {
  S: sizeBlock("text-xs", 8, 8, 12, 11),
  M: sizeBlock("text-sm", 12, 12, 16, 12),
  L: sizeBlock("text-base", 16, 12, 20, 14),
} as const;

/**
 * 고정 값 — `connectorThickness` = 선 두께 (Step 의 선과 같은 2), `connectorGap` = 표식과 선 끝 사이
 * (Step 의 `trackGap` 과 같은 4), `minTrack` = 가로 항목의 선이 줄지 않는 최소 (Step 과 같은 16),
 * `textGap` = 제목 · 날짜 · 설명 사이.
 */
export const TIMELINE_LAYOUT = {
  connectorThickness: 2,
  connectorGap: 4,
  minTrack: 16,
  textGap: 2,
} as const;

/** 예정 표식의 테두리 폭 (Step 의 남음 표식과 같은 폭 토큰). */
export const TIMELINE_MARKER_BORDER = "{border.width.thick}" as const;

/** 색 — StepList 의 상태 색 (`STEP_COLORS`) 과 같은 TokenRef (새 테마 토큰을 만들지 않는다). */
export const TIMELINE_COLORS = {
  markerCompleted: "{color.gray}",
  markerCurrent: "{color.accent}",
  markerUpcomingBorder: "{color.field-placeholder}",
  connectorCompleted: "{color.gray}",
  connectorRest: "{color.field-placeholder}",
  secondaryText: "{color.neutral-subdued}",
} as const satisfies Record<string, TokenRef>;

export const catalogTimelineSize = (value: unknown): TimelineSize =>
  (TIMELINE_SIZES as readonly string[]).includes(String(value))
    ? (value as TimelineSize)
    : "M";

export const catalogTimelineOrientation = (
  value: unknown,
): TimelineOrientation => (value === "horizontal" ? "horizontal" : "vertical");

export const catalogTimelinePlacement = (value: unknown): TimelinePlacement =>
  value === "start" || value === "alternate" ? value : "end";

/**
 * 사용자 결정 1 — 항목의 상태 값 (작성값 또는 연결된 행의 상태 필드). 대소문자 · 앞뒤 공백은 보지 않고,
 * 세 값 밖 (빈 값 포함) 은 완료 — 이력 데이터의 기본 모양이다.
 */
export function catalogTimelineStatus(value: unknown): TimelineStatus {
  const text = typeof value === "string" ? value.trim().toLowerCase() : "";
  return (TIMELINE_STATUSES as readonly string[]).includes(text)
    ? (text as TimelineStatus)
    : "completed";
}

/** 항목 하나가 그려지는 쪽 — 세로 `alternate` 는 첫 항목부터 `end` · `start` 번갈아, 가로는 `end`. */
export function catalogTimelineSide(
  orientation: TimelineOrientation,
  placement: TimelinePlacement,
  index: number,
): TimelineSide {
  if (placement === "start") return "start";
  if (placement === "alternate" && orientation === "vertical")
    return index % 2 === 0 ? "end" : "start";
  return "end";
}

/** 세로 방향 — 제목 첫 줄과 표식의 가운데를 맞추는 두 offset (표식 top · 글자 top). */
function verticalOffsets(size: TimelineSize, lineHeight: number) {
  const marker = SIZE_VALUES[size].iconSize;
  return {
    markerTop: Math.max(0, (lineHeight - marker) / 2),
    textTop: Math.max(0, (marker - lineHeight) / 2),
  };
}

export interface TimelineItemGeometryInput {
  orientation: TimelineOrientation;
  placement: TimelinePlacement;
  side: TimelineSide;
  size: TimelineSize;
  /** 제목 글자의 행간 px (세로 방향의 맞춤에만 쓴다). */
  lineHeight: number;
}

/** 세로 `alternate` — 선이 항목 상자의 가장자리 (= 목록 가운데) 에 선다. */
const straddles = (input: TimelineItemGeometryInput) =>
  input.orientation === "vertical" && input.placement === "alternate";

/**
 * 항목이 표식 · 선을 그리려고 비우는 여백 — 두 consumer 가 같이 읽는다 (Canvas `catalogBoxModel`, DOM
 * inline).
 */
export function catalogTimelineItemPadding(input: TimelineItemGeometryInput): {
  top: number;
  right: number;
  bottom: number;
  left: number;
} {
  const { iconSize: marker, iconGap: gap, spacing } = SIZE_VALUES[input.size];
  if (input.orientation === "horizontal") {
    const room = marker + gap;
    return input.side === "start"
      ? { top: 0, right: spacing, bottom: room, left: 0 }
      : { top: room, right: spacing, bottom: 0, left: 0 };
  }
  const room = straddles(input) ? marker / 2 + gap : marker + gap;
  const { textTop } = verticalOffsets(input.size, input.lineHeight);
  return input.side === "start"
    ? { top: textTop, right: room, bottom: spacing, left: 0 }
    : { top: textTop, right: 0, bottom: spacing, left: room };
}

/** 항목 상자의 모서리에서 잰 자리 — 준 모서리 · 크기만 있다 (CSS 의 절대 배치 값 그대로). */
export interface TimelineChromeAnchor {
  left?: number;
  right?: number;
  top?: number;
  bottom?: number;
  width?: number;
  height?: number;
}

export interface TimelineChromeRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

/**
 * 표식과 선의 자리 (항목 상자 모서리 기준). 선은 마지막 항목에 없다. 다음 항목은 목록 gap 없이 바로
 * 붙는다 (항목 사이 간격은 항목의 끝 여백 `spacing`).
 * - 세로: 표식은 제목 첫 줄의 가운데 높이, 선은 표식 아래 `connectorGap` 에서 다음 표식 `connectorGap`
 *   위까지 (다음 표식은 다음 상자 top + markerTop — 선이 상자 아래로 넘어갈 수 있다).
 * - 세로 `alternate`: 표식 · 선의 가운데가 상자 가장자리 (선 쪽) 에 선다 — 상자 밖으로 절반 나간다.
 * - 가로: 표식은 왼쪽 위 (`start` 는 왼쪽 아래), 선은 표식 오른쪽 `connectorGap` 에서 상자 끝
 *   `connectorGap` 앞까지 · 표식의 가운데 높이.
 */
export function catalogTimelineChromeAnchors(
  input: TimelineItemGeometryInput & { last: boolean },
): { marker: TimelineChromeAnchor; connector?: TimelineChromeAnchor } {
  const marker = SIZE_VALUES[input.size].iconSize;
  const { connectorThickness: thick, connectorGap: cg } = TIMELINE_LAYOUT;
  if (input.orientation === "horizontal") {
    const markerAnchor: TimelineChromeAnchor =
      input.side === "start"
        ? { left: 0, bottom: 0, width: marker, height: marker }
        : { left: 0, top: 0, width: marker, height: marker };
    const lineAt = (marker - thick) / 2;
    return {
      marker: markerAnchor,
      ...(input.last
        ? {}
        : {
            connector: {
              left: marker + cg,
              right: cg,
              ...(input.side === "start"
                ? { bottom: lineAt }
                : { top: lineAt }),
              height: thick,
            },
          }),
    };
  }
  const { markerTop } = verticalOffsets(input.size, input.lineHeight);
  const edge = straddles(input) ? -marker / 2 : 0;
  const lineEdge = straddles(input) ? -thick / 2 : (marker - thick) / 2;
  const horizontal = (offset: number) =>
    input.side === "start" ? { right: offset } : { left: offset };
  return {
    marker: {
      ...horizontal(edge),
      top: markerTop,
      width: marker,
      height: marker,
    },
    ...(input.last
      ? {}
      : {
          connector: {
            ...horizontal(lineEdge),
            top: markerTop + marker + cg,
            bottom: cg - markerTop,
            width: thick,
          },
        }),
  };
}

const anchorRect = (
  anchor: TimelineChromeAnchor,
  width: number,
  height: number,
): TimelineChromeRect => {
  const w =
    anchor.width ??
    Math.max(0, width - (anchor.left ?? 0) - (anchor.right ?? 0));
  const h =
    anchor.height ??
    Math.max(0, height - (anchor.top ?? 0) - (anchor.bottom ?? 0));
  return {
    x: anchor.left ?? width - (anchor.right ?? 0) - w,
    y: anchor.top ?? height - (anchor.bottom ?? 0) - h,
    width: w,
    height: h,
  };
};

/** 항목 상자 (`width` × `height`) 안의 표식과 선의 rect — Canvas 도형의 자리 (같은 anchor 를 푼 값). */
export function catalogTimelineChromeRects(
  input: Parameters<typeof catalogTimelineChromeAnchors>[0] & {
    width: number;
    height: number;
  },
): { marker: TimelineChromeRect; connector?: TimelineChromeRect } {
  const { marker, connector } = catalogTimelineChromeAnchors(input);
  return {
    marker: anchorRect(marker, input.width, input.height),
    ...(connector
      ? { connector: anchorRect(connector, input.width, input.height) }
      : {}),
  };
}

/** 표식 · 선의 색 (TokenRef) — 항목의 상태에서. 선은 그 항목에서 다음 항목으로 가는 길이다. */
export function catalogTimelineChromeColors(status: TimelineStatus): {
  markerFill?: TokenRef;
  markerBorder?: TokenRef;
  connector: TokenRef;
} {
  const c = TIMELINE_COLORS;
  if (status === "upcoming")
    return { markerBorder: c.markerUpcomingBorder, connector: c.connectorRest };
  if (status === "current")
    return { markerFill: c.markerCurrent, connector: c.connectorRest };
  return { markerFill: c.markerCompleted, connector: c.connectorCompleted };
}

/** 항목의 주축 최소 (가로 = 최소 폭) — 표식 + 선의 최소. */
export const catalogTimelineItemMinMain = (size: TimelineSize): number =>
  SIZE_VALUES[size].iconSize +
  TIMELINE_LAYOUT.connectorGap * 2 +
  TIMELINE_LAYOUT.minTrack;

const timelineBox = {
  display: "flex",
  flexDirection: "column",
  alignItems: "stretch",
};

const ruleSizes = (keep: "list" | "item") =>
  Object.fromEntries(
    TIMELINE_SIZES.map((size) => {
      const { spacing: _s, secondary: _d, ...block } = SIZE_VALUES[size];
      return [
        size,
        keep === "item"
          ? block
          : {
              height: 0,
              fontSize: block.fontSize,
              borderRadius: "{radius.none}",
            },
      ];
    }),
  ) as ComponentRule["sizes"];

export const TIMELINE_RULE: ComponentRule = {
  defaultVariant: "default",
  defaultSize: "M",
  variants: { default: { paint: {} } },
  sizes: ruleSizes("list"),
  containerStyles: timelineBox,
  structure: {
    archetype: "container",
    // (The DOM root is the `ol` itself — an ordered list, no RAC part: Timeline has no interaction.)
    element: "ol",
    containerStyles: timelineBox,
    composition: {
      delegation: [],
      rootSelectors: {
        "&": {
          styles: { "list-style": "none", margin: "0" },
        },
      },
    },
  },
};

// (The title · date · description stack `textGap` apart — the rule's box, both consumers.)
const itemBox = {
  display: "flex",
  flexDirection: "column",
  alignItems: "stretch",
  gap: `${TIMELINE_LAYOUT.textGap}px`,
};

/**
 * 날짜 · 설명 Text — 제목보다 한 단계 작은 글자 (두 consumer 가 읽는 part rule · 생성 CSS, Step 설명과
 * 같은 값). 제목은 글자 값을 주지 않는다 — 문서 글자를 그대로 받는다 (`text-font.md` — S2 owner 값이
 * 없는 글자 값은 만들지 않는다; 크기 단계는 size 전파의 몫).
 */
const SECONDARY_TEXTS = [
  '.react-aria-Text[slot="date"]',
  '.react-aria-Text[slot="description"]',
] as const;

export const TIMELINE_ITEM_RULE: ComponentRule = {
  defaultVariant: "default",
  defaultSize: "M",
  variants: { default: { paint: {} } },
  sizes: ruleSizes("item"),
  containerStyles: itemBox,
  structure: {
    archetype: "container",
    element: "li",
    containerStyles: itemBox,
    composition: {
      delegation: [],
      sizeSelectors: Object.fromEntries(
        TIMELINE_SIZES.map((size) => [
          size,
          Object.fromEntries(
            SECONDARY_TEXTS.map((selector) => [
              selector,
              { "font-size": `${SIZE_VALUES[size].secondary}px` },
            ]),
          ),
        ]),
      ),
      // 표식 · 선의 바뀌지 않는 모양 (자리 · 색은 inline — `catalogTimelineChromeAnchors` · `Colors`).
      rootSelectors: {
        "&": {
          styles: { position: "relative", "list-style": "none", margin: "0" },
        },
        "& > .timeline-marker": {
          styles: {
            position: "absolute",
            "box-sizing": "border-box",
            "border-radius": "50%",
            "pointer-events": "none",
          },
        },
        "& > .timeline-connector": {
          styles: { position: "absolute", "pointer-events": "none" },
        },
      },
    },
  },
};
