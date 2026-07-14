import { describe, expect, test } from "vitest";

import type { CanvasLayoutNode } from "../../layoutNode";
import {
  calculateContentHeight,
  calculateContentWidth,
  enrichWithIntrinsicSize,
} from "../utils";

/**
 * 정원형 leaf(ProgressCircle / Avatar) — size 변경 → layout bounds(=selection 영역) 반영 회귀 게이트
 * (2026-07-14).
 *
 * 버그: factory(DisplayComponents.ts)가 `props.style.width/height` 를 **32 숫자로 하드코딩**해
 *   저장했다. 그러면 `enrichWithIntrinsicSize` 가 `needsWidth/needsHeight=false` 로 판정하여
 *   **early return** → size→diameter 분기(circleLeafDiameter)가 아예 호출되지 않는다 →
 *   size 를 sm/lg 로 바꿔도 layout bounds 가 32 에 고정 → **selection 박스가 안 바뀌고 CSS/Skia
 *   양쪽 모두 크기 미반영**. md 에서만 우연히 catalog 값(32)과 일치해 정상으로 보였다.
 *
 * 수정: (1) factory inline width/height 제거(크기 SSOT = catalog `sizes.{...}.height`).
 *   (2) 기존 프로젝트는 hydration migration(circleLeafInlineSizeMigration)이 stale inline strip.
 *   (3) avatar 는 IMAGE_INTRINSIC_TAGS 소속이라 needsWidth 조건(문자열 키워드 한정)에 안 걸렸다 →
 *       CIRCLE_LEAF_TAGS 분기를 needsWidth + childResolvedWidth 양쪽에 추가.
 *
 * catalog SSOT: ProgressCircle sizes {sm:24, md:32, lg:64} / Avatar sizes {xs:24, sm:28, md:32,
 *   lg:40, xl:48} — 정원형이라 diameter = height.
 */

const makeNode = (
  type: string,
  size: string,
  style: Record<string, unknown> = {},
): CanvasLayoutNode =>
  ({
    id: `${type}-1`,
    type,
    props: { size, value: 75, initials: "A", style },
  }) as unknown as CanvasLayoutNode;

/** enrich 후 주입된 border-box width/height. */
function enrichedSize(node: CanvasLayoutNode): {
  width: unknown;
  height: unknown;
} {
  const out = enrichWithIntrinsicSize(
    node,
    390,
    800,
    undefined,
    undefined,
    undefined,
    false,
  );
  const style = (out.props as { style?: Record<string, unknown> }).style ?? {};
  return { width: style.width, height: style.height };
}

const PROGRESS_CIRCLE_DIAMETER: Record<string, number> = {
  sm: 24,
  md: 32,
  lg: 64,
};
const AVATAR_DIAMETER: Record<string, number> = {
  xs: 24,
  sm: 28,
  md: 32,
  lg: 40,
  xl: 48,
};

describe("ProgressCircle — size → diameter", () => {
  test.each(Object.entries(PROGRESS_CIRCLE_DIAMETER))(
    "size=%s → contentWidth/Height = %i (catalog sizes.height)",
    (size, diameter) => {
      const node = makeNode("ProgressCircle", size);
      expect(calculateContentWidth(node)).toBe(diameter);
      expect(calculateContentHeight(node, 390)).toBe(diameter);
    },
  );

  test.each(Object.entries(PROGRESS_CIRCLE_DIAMETER))(
    "size=%s → enrich 가 layout bounds %i 주입 (selection 영역)",
    (size, diameter) => {
      expect(enrichedSize(makeNode("ProgressCircle", size))).toEqual({
        width: diameter,
        height: diameter,
      });
    },
  );
});

describe("Avatar — size → diameter", () => {
  test.each(Object.entries(AVATAR_DIAMETER))(
    "size=%s → contentWidth/Height = %i (catalog sizes.height)",
    (size, diameter) => {
      const node = makeNode("Avatar", size);
      expect(calculateContentWidth(node)).toBe(diameter);
      expect(calculateContentHeight(node, 390)).toBe(diameter);
    },
  );

  test.each(Object.entries(AVATAR_DIAMETER))(
    "size=%s → enrich 가 layout bounds %i 주입 (selection 영역)",
    (size, diameter) => {
      expect(enrichedSize(makeNode("Avatar", size))).toEqual({
        width: diameter,
        height: diameter,
      });
    },
  );

  test("width 미주입(0/undefined) 회귀 차단 — avatar 는 IMAGE_INTRINSIC_TAGS 소속이라 과거 누락됐다", () => {
    const { width } = enrichedSize(makeNode("Avatar", "lg"));
    expect(width).toBeGreaterThan(0);
  });
});

describe("selection 미반영 회귀 재발 차단", () => {
  test("size 를 바꾸면 layout bounds 도 바뀐다 (factory inline 32 고정 버그 차단)", () => {
    // 회귀 시나리오: sm ≠ lg 인데 둘 다 32 로 나오면 factory inline 이 부활한 것.
    const sm = enrichedSize(makeNode("ProgressCircle", "sm"));
    const lg = enrichedSize(makeNode("ProgressCircle", "lg"));
    expect(sm.width).not.toBe(lg.width);
    expect(sm).toEqual({ width: 24, height: 24 });
    expect(lg).toEqual({ width: 64, height: 64 });
  });

  test("Avatar 도 동일 — xs ≠ xl", () => {
    const xs = enrichedSize(makeNode("Avatar", "xs"));
    const xl = enrichedSize(makeNode("Avatar", "xl"));
    expect(xs).toEqual({ width: 24, height: 24 });
    expect(xl).toEqual({ width: 48, height: 48 });
  });

  test("사용자가 명시한 inline 크기는 여전히 존중된다 (override 보존)", () => {
    // migration 이 strip 하지 않는 사용자 조정값(48)은 layout 에서도 그대로 쓰여야 한다.
    const node = makeNode("Avatar", "md", { width: 48, height: 48 });
    expect(enrichedSize(node)).toEqual({ width: 48, height: 48 });
  });
});
