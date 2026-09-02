import { describe, expect, test } from "vitest";

import type { CanvasLayoutNode } from "../../layoutNode";
import {
  INTRINSIC_MEASURE_TAGS,
  calculateContentHeight,
  calculateContentWidth,
} from "../utils";

/**
 * ADR-912 (B+icon) — DisclosureHeader catalog 발효 후 Skia intrinsic 치수 회귀 게이트.
 *
 * 버그: DisclosureHeader 가 catalog generic(leading_icon append) 로 전환됐으나 layout 엔진의
 *   INTRINSIC_MEASURE_TAGS/TEXT_LEAF_TAGS 미등록 → enrichWithIntrinsicSize 가 width 미산출 →
 *   selection "0×24" (width 0). Skia 는 chevron+text 를 그리지만 layout box 가 0 폭.
 *
 * 수정: (1) INTRINSIC_MEASURE_TAGS 에 "disclosureheader" 등록 → needsWidth=true.
 *   (2) calculateContentWidth disclosureheader 분기 = paddingX + iconSize + gap + text + paddingX
 *       (buildCatalogShapes Skia 공식과 1:1 대칭). (3) calculateContentHeight = rule height 36 (line-height 20 + trigger paddingY 8*2, 2026-07-14).
 */
const makeHeader = (props: Record<string, unknown> = {}): CanvasLayoutNode =>
  ({
    id: "dh-1",
    type: "DisclosureHeader",
    props: {
      children: "Section Title",
      headingLevel: 3,
      ...props,
    },
  }) as CanvasLayoutNode;

describe("DisclosureHeader intrinsic size (ADR-912 B+icon width 회귀)", () => {
  test("INTRINSIC_MEASURE_TAGS 에 disclosureheader 등록 — width 주입 대상", () => {
    expect(INTRINSIC_MEASURE_TAGS.has("disclosureheader")).toBe(true);
  });

  test("calculateContentWidth — width 0 아님 (selection '0×24' 버그 차단)", () => {
    const w = calculateContentWidth(makeHeader());
    expect(w).toBeGreaterThan(0);
  });

  test("width 는 paddingX*2 + iconSize + gap 최소 골격 폭 이상 (chevron 공간 포함)", () => {
    // rule md: paddingX 12 + iconSize 15 + gap 6 + (우측)paddingX 12 = 45 골격.
    //   text 폭은 measure 환경 의존이지만, leading icon + 좌우 padding 골격은 항상 포함.
    const w = calculateContentWidth(makeHeader());
    expect(w).toBeGreaterThanOrEqual(12 + 15 + 6 + 12);
  });

  test("긴 텍스트가 짧은 텍스트보다 넓다 (text 폭 반영)", () => {
    const shortW = calculateContentWidth(makeHeader({ children: "A" }));
    const longW = calculateContentWidth(
      makeHeader({ children: "A much longer section header title" }),
    );
    expect(longW).toBeGreaterThan(shortW);
  });

  test("calculateContentHeight — rule box height 36 (Skia rule height 대칭)", () => {
    expect(calculateContentHeight(makeHeader())).toBe(36);
  });

  test("명시적 style.height override 우선 (rule 36 무시)", () => {
    const h = calculateContentHeight(makeHeader({ style: { height: 48 } }));
    expect(h).toBe(48);
  });

  test("명시적 style.width override 우선 (intrinsic 무시)", () => {
    const w = calculateContentWidth(makeHeader({ style: { width: 200 } }));
    expect(w).toBe(200);
  });
});
