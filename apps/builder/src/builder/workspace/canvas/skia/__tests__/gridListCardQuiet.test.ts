import { describe, expect, it } from "vitest";
import { getSkiaPrimitive } from "@composition/specs";
import type { Shape, SizeSpec } from "@composition/specs";

import { resolveSkiaVisualRule } from "../resolveSkiaVisualRule";

/**
 * design-data 감사 §1-2 축② 잔여 — GridList quiet 이 **catalog rule → Skia shape** 까지 이어지는지
 * (2026-08-22).
 *
 * 채널 정의(카드 variant / owner boolean)는 shared `gridListQuiet.test.ts` 가 본다. 여기서는
 * builder 의 실제 해석 경로(`resolveSkiaVisualRule`)를 통과시켜, rule 에 quiet 을 적어두고도
 * Skia 가 못 읽는 상태를 차단한다 — 이 저장소에서 반복된 결함 축이 정확히 "정의는 있는데
 * 소비 경로가 안 닿음" 이다.
 */

const size = {
  fontSize: 14,
  paddingX: 16,
  paddingY: 12,
  borderRadius: 8,
  borderWidth: 1,
  height: 0,
  gap: 2,
} as unknown as SizeSpec;

const draw = getSkiaPrimitive("gridlist_card")!;

const cardShapes = (variant: string, props: Record<string, unknown> = {}) =>
  draw({
    props: { children: "Documents", description: "12 files", ...props },
    size,
    visual: resolveSkiaVisualRule("GridListItem", variant),
    style: { width: 189 },
  } as never) as Array<
    Shape & { id?: string; type: string; fill?: string; color?: string }
  >;

const bgOf = (out: ReturnType<typeof cardShapes>) =>
  out.find((s) => s.id === "card-bg") as unknown as {
    fill: string;
    height: number;
  };
const borderOf = (out: ReturnType<typeof cardShapes>) =>
  out.find((s) => s.type === "border") as unknown as { color: string };

describe("GridList quiet — catalog rule 이 Skia 카드까지 닿는다", () => {
  it("default 는 채우고 quiet 은 배경·테두리를 함께 비운다", () => {
    const def = cardShapes("default");
    const quiet = cardShapes("quiet");

    expect(bgOf(def).fill).toBe("{color.layer-1}");
    expect(borderOf(def).color).toBe("{color.border}");

    expect(bgOf(quiet).fill).toBe("{color.transparent}");
    expect(borderOf(quiet).color).toBe("{color.transparent}");
  });

  it("quiet 이어도 선택된 카드는 accent 테두리를 유지한다", () => {
    expect(borderOf(cardShapes("quiet", { isSelected: true })).color).toBe(
      "{color.accent}",
    );
  });

  it("quiet 은 색 축만 바꾼다 — 카드 높이·텍스트 배치 불변", () => {
    const textYs = (variant: string) =>
      cardShapes(variant)
        .filter((s) => s.type === "text")
        .map((s) => (s as unknown as { y: number }).y);

    expect(bgOf(cardShapes("quiet")).height).toBe(
      bgOf(cardShapes("default")).height,
    );
    expect(textYs("quiet")).toEqual(textYs("default"));
  });

  it("체크박스 슬롯은 quiet 에서도 살아 있다 (선택 축은 quiet 과 직교)", () => {
    const out = cardShapes("quiet", { _showSelectionCheckbox: true });
    expect(out.some((s) => s.id === "selection-box")).toBe(true);
  });
});
