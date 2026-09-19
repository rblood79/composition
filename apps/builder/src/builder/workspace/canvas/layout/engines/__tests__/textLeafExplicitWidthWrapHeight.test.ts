import { afterAll, beforeAll, describe, expect, test } from "vitest";

import type { CanvasLayoutNode } from "../../layoutNode";
import {
  getTextMeasurer,
  setTextMeasurer,
  type TextMeasurer,
} from "../../../utils/textMeasure";
import { enrichWithIntrinsicSize } from "../utils";

/**
 * 고정 px 폭 텍스트 leaf 의 줄바꿈 높이는 **자기 폭**에서 잰다 (ADR-027 D3 하니스가 발견, 2026-09-20).
 *
 * 결함: block 부모 (body 1920) 안의 `Text { width: 300px }` 긴 문장 — 1차 enrich 가 부모 content
 *   폭 (1920) 으로 줄바꿈을 재 1줄 (24) 을 명시 height 로 주입하고, Step 4.5 2-pass 는 "px 폭이면
 *   enrich 도 그 폭을 썼다" 고 가정해 (`enrichedWidth = 300` == layout 300) 재측정을 건너뛴다.
 *   결과: 엔진 상자 300×24 ↔ Skia paragraph 3줄 (72) 이 상자 밖으로 넘친다 — 편집 오버레이도
 *   그 상자를 받아 1줄 높이. INTRINSIC_MEASURE_TAGS (Button 등) 는 이미 자기 px 폭으로 쟀다.
 */
// jsdom 에는 canvas 2D context 가 없어 기본 측정기가 항상 1줄을 돌려준다 — 폭에 비례해 줄을
//   나누는 결정적 측정기로 바꿔 "어느 폭으로 쟀는가" 만 본다 (글리프 0.5em 고정폭).
// `\n` 은 CanvasKit paragraph 처럼 white-space 가 pre 계열일 때만 hard break (normal/nowrap 은 공백).
const PRE_FAMILY = new Set(["pre", "pre-wrap", "pre-line"]);
const fakeMeasurer: TextMeasurer = {
  measureWidth: (text, style) => text.length * style.fontSize * 0.5,
  measureWrapped: (text, style, maxWidth) => {
    const lineHeight = style.lineHeight ?? style.fontSize * 1.5;
    const segments = PRE_FAMILY.has(style.whiteSpace ?? "normal")
      ? text.split("\n")
      : [text.replace(/\n/g, " ")];
    let lines = 0;
    let width = 0;
    for (const seg of segments) {
      const w = seg.length * style.fontSize * 0.5;
      lines += Math.max(1, Math.ceil(w / maxWidth));
      width = Math.max(width, Math.min(maxWidth, w));
    }
    return { width, height: lines * lineHeight };
  },
};
let previous: TextMeasurer;
beforeAll(() => {
  previous = getTextMeasurer();
  setTextMeasurer(fakeMeasurer);
});
afterAll(() => setTextMeasurer(previous));

const LONG =
  "캔버스에서 텍스트를 직접 편집할 때 오버레이와 Skia 렌더링이 얼마나 일치하는지 확인하는 긴 문장입니다. The quick brown fox jumps over the lazy dog.";

const makeText = (style: Record<string, unknown>): CanvasLayoutNode =>
  ({
    id: "t-1",
    type: "Text",
    props: { size: "md", children: LONG, style },
  }) as CanvasLayoutNode;

const enrichedHeight = (style: Record<string, unknown>) => {
  const s = (
    enrichWithIntrinsicSize(makeText(style), 1920, 1080).props as Record<
      string,
      unknown
    >
  ).style as Record<string, unknown>;
  return s.height;
};

describe("텍스트 leaf 고정 폭 줄바꿈 높이", () => {
  test("width 300px (block 자식, 부모 1920) → 여러 줄 높이가 주입된다", () => {
    const h = enrichedHeight({ width: "300px" });
    expect(typeof h).toBe("number");
    // 104자 × 8px = 832 → 300px 에서 3줄 = 72.
    expect(h).toBe(72);
  });

  test("숫자 width 300 도 같다", () => {
    expect(enrichedHeight({ width: 300 })).toBe(72);
  });

  test("폭 미지정이면 부모 폭 기준 (1줄) — 종전 동작 유지", () => {
    expect(enrichedHeight({})).toBe(24);
  });

  // 사용자 live (2026-09-20, `width: 50%` Text): 엔진 상자 2줄 ↔ Skia 3줄. enrich 가 % 를 거부해
  //   부모 폭으로 쟀고, Step 4.5 는 "% 면 enrich 도 availableWidth × % 로 쟀다" 고 추정해
  //   (960 == 960) 재측정을 건너뛰었다 — 둘의 가정이 갈렸다. enrich 도 같은 식으로 푼다.
  test("width 30% (부모 1920 → 576) → 832px 문장이 2줄", () => {
    expect(enrichedHeight({ width: "30%" })).toBe(48);
  });
});

describe("텍스트 leaf 명시 줄바꿈 (`\\n`) 높이 — white-space 를 측정기에 넘긴다", () => {
  const THREE = "first\nsecond\nthird";
  const heightOf = (style: Record<string, unknown>) =>
    (
      (
        enrichWithIntrinsicSize(
          {
            id: "t-2",
            type: "Text",
            props: { size: "md", children: THREE, style },
          } as CanvasLayoutNode,
          1920,
          1080,
        ).props as Record<string, unknown>
      ).style as Record<string, unknown>
    ).height;

  test("pre-wrap: 3줄 (Skia 는 \\n 을 hard break 로 그린다 — 오버레이 Enter = 줄바꿈 경로)", () => {
    expect(heightOf({ width: "320px", whiteSpace: "pre-wrap" })).toBe(72);
  });

  test("pre: 줄바꿈 없이 \\n 만 — 3줄", () => {
    expect(heightOf({ width: "320px", whiteSpace: "pre" })).toBe(72);
  });

  test("normal: CSS 가 \\n 을 접는다 — 1줄 (종전 동작)", () => {
    expect(heightOf({ width: "320px" })).toBe(24);
  });
});
