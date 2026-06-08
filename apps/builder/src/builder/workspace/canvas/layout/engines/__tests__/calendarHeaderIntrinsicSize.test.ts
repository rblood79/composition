import { describe, expect, test } from "vitest";

import type { CanvasLayoutNode } from "../../layoutNode";
import {
  INLINE_BLOCK_TAGS,
  calculateContentHeight,
  calculateContentWidth,
} from "../utils";

/**
 * ADR-912 (B+icon) — CalendarHeader catalog 발효 후 Skia intrinsic 치수 회귀 게이트.
 *
 * 버그: CalendarHeader 가 catalog generic(inline_icon_text replace) 로 전환됐으나 layout 엔진의
 *   INLINE_BLOCK_TAGS 미등록 → enrichWithIntrinsicSize 가 width 미산출 → selection "0×30"(width 0).
 *   Skia 는 좌 chevron + center text + 우 chevron 을 그리지만 layout box 가 0 폭(DisclosureHeader 동일 회귀).
 *
 * 수정: (1) INLINE_BLOCK_TAGS 에 "calendarheader" 등록 → needsWidth=true.
 *   (2) calculateContentWidth calendarheader 분기(= calendargrid 공유) = cellSize*7 + gap*6
 *       (CalendarHeader 는 Calendar 자식이라 grid 폭과 동일 — inline_icon_text 우측 chevron 도 동일 폭 가정).
 *   (3) calculateContentHeight calendarheader 분기 = rule height(sm:24 / md:30 / lg:36, spec 의존 제거).
 */
const makeHeader = (props: Record<string, unknown> = {}): CanvasLayoutNode =>
  ({
    id: "ch-1",
    type: "CalendarHeader",
    props: {
      children: "2024년 1월",
      size: "md",
      ...props,
    },
  }) as CanvasLayoutNode;

describe("CalendarHeader intrinsic size (ADR-912 B+icon width 회귀)", () => {
  test("INLINE_BLOCK_TAGS 에 calendarheader 등록 — width 주입 대상", () => {
    expect(INLINE_BLOCK_TAGS.has("calendarheader")).toBe(true);
  });

  test("calculateContentWidth — width 0 아님 (selection '0×30' 버그 차단)", () => {
    const w = calculateContentWidth(makeHeader());
    expect(w).toBeGreaterThan(0);
  });

  test("width 는 calendar grid 폭과 동일 (cellSize*7 + gap*6, md 기준 174)", () => {
    // md: iconSize 26 → cellSize 30, gap 6 → 30*7 + 6*6 = 210 + 36 = 246.
    //   (CalendarHeader 는 Calendar 자식 → grid 폭과 동일해야 헤더가 grid 위 정렬).
    const w = calculateContentWidth(makeHeader());
    const cellSize = 26 + 4;
    expect(w).toBe(cellSize * 7 + 6 * 6);
  });

  test("size 별 width 차이 (sm < md < lg)", () => {
    const smW = calculateContentWidth(makeHeader({ size: "sm" }));
    const mdW = calculateContentWidth(makeHeader({ size: "md" }));
    const lgW = calculateContentWidth(makeHeader({ size: "lg" }));
    expect(smW).toBeLessThan(mdW);
    expect(mdW).toBeLessThan(lgW);
  });

  test("calculateContentHeight — rule box height (md=30, Skia rule height 대칭)", () => {
    expect(calculateContentHeight(makeHeader())).toBe(30);
  });

  test("calculateContentHeight — size 별 (sm=24 / md=30 / lg=36)", () => {
    expect(calculateContentHeight(makeHeader({ size: "sm" }))).toBe(24);
    expect(calculateContentHeight(makeHeader({ size: "md" }))).toBe(30);
    expect(calculateContentHeight(makeHeader({ size: "lg" }))).toBe(36);
  });
});
