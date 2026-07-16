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

  test("width 는 calendar grid 폭과 동일 (cellBox*7, md 기준 238)", () => {
    // ADR-151 B1/B2 (2026-07-16): DOM table `td { padding: 2px }` 박스 모델 정렬 —
    //   md: iconSize 26 → cellSize 30 → cellBox 34 → 34*7 = 238 (DOM 실측 동일).
    //   (CalendarHeader 는 Calendar 자식 → grid 폭과 동일해야 헤더가 grid 위 정렬).
    const w = calculateContentWidth(makeHeader());
    const cellBox = 26 + 4 + 4;
    expect(w).toBe(cellBox * 7);
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

/**
 * ADR-912 Phase 6 (2026-06-20) — CalendarGrid / DateInput size-value mirror 흡수 회귀 게이트.
 *
 * 흡수: 인라인 미러(gridDims iconSize/gap · inputHeights height) → resolveSkiaRule(type).sizes read-through.
 *   catalog 와 byte-identical (CalendarGrid sm 20/4·md 26/6·lg 32/8 / DateInput xs20·sm22·md30·lg42·xl54).
 *   동적 row 계산(new Date() dayOffset/totalDays)은 결정적 입력 주입으로 절대값 고정.
 */
const makeGrid = (props: Record<string, unknown> = {}): CanvasLayoutNode =>
  ({
    id: "cg-1",
    type: "CalendarGrid",
    // dayOffset/totalDays 고정 → new Date() 비결정성 제거 (2024-02: offset 4, 29일 → totalRows 5)
    props: { size: "md", dayOffset: 4, totalDays: 29, ...props },
  }) as CanvasLayoutNode;

const makeDateInput = (props: Record<string, unknown> = {}): CanvasLayoutNode =>
  ({
    id: "di-1",
    type: "DateInput",
    props: { size: "md", ...props },
  }) as CanvasLayoutNode;

describe("CalendarGrid intrinsic size (ADR-912 Phase 6 read-through)", () => {
  test("width — calendar grid 폭 (cellBox*7, md=238 — DOM td padding 계약)", () => {
    // ADR-151 B1/B2 (2026-07-16): DOM 실측 golden — md 238 (구 gap 오용 식은 246 발산).
    const cellBox = 26 + 4 + 4;
    expect(calculateContentWidth(makeGrid())).toBe(cellBox * 7);
    expect(calculateContentWidth(makeGrid())).toBe(238);
  });

  test("height — totalRows 기반 (md, offset4/29일 → 5행)", () => {
    // ADR-151 B1/B2 (2026-07-16): DOM = 요일 th 행(cellSize) + 행 pitch cellBox(cellSize+4).
    //   cellSize 30, cellBox 34, totalRows 5 → 30 + 5*34 = 200 (DOM 실측 golden — 구 식은 204).
    const cellSize = 26 + 4;
    const cellBox = cellSize + 4;
    const totalRows = Math.ceil((29 + 4) / 7);
    expect(calculateContentHeight(makeGrid())).toBe(
      cellSize + totalRows * cellBox,
    );
    expect(calculateContentHeight(makeGrid())).toBe(200);
  });

  test("height — size 별 cellSize/gap 반영 (sm < md < lg, 동일 행수)", () => {
    const sm = calculateContentHeight(makeGrid({ size: "sm" }));
    const md = calculateContentHeight(makeGrid({ size: "md" }));
    const lg = calculateContentHeight(makeGrid({ size: "lg" }));
    expect(sm).toBeLessThan(md);
    expect(md).toBeLessThan(lg);
  });
});

describe("DateInput intrinsic height (ADR-912 Phase 6 read-through)", () => {
  test("height — size 별 (xs20 / sm22 / md30 / lg42 / xl54)", () => {
    expect(calculateContentHeight(makeDateInput({ size: "xs" }))).toBe(20);
    expect(calculateContentHeight(makeDateInput({ size: "sm" }))).toBe(22);
    expect(calculateContentHeight(makeDateInput({ size: "md" }))).toBe(30);
    expect(calculateContentHeight(makeDateInput({ size: "lg" }))).toBe(42);
    expect(calculateContentHeight(makeDateInput({ size: "xl" }))).toBe(54);
  });
});
