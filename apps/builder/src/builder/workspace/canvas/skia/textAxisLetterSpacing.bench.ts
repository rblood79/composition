/**
 * ADR-205 G2 — 자간(letterSpacing) 결선의 **불리 케이스** 벤치.
 *
 * 기존 600 요소 문서에는 `letterSpacing ≠ 0` 이 0건이라(ADR-205 §영향 범위 — factory·
 * import·theme 모두 0건) 파이프라인 baseline 만으로는 새 경로가 한 번도 실행되지 않는다.
 * 그러면 G2 는 vacuous 다 (`measurement-validity.md` §1 Q2 · §2 패턴 6).
 *
 * 그래서 **같은 텍스트·같은 파이프라인**을 두 arm 으로 잰다:
 *   - 대조군 (ls 0)  — 종전 경로
 *   - 불리 arm (ls 0.5) — `ctx.letterSpacing` set + `buildFontKey` 분기로 세그먼트 캐시가
 *     별도 버킷을 쓰는 경로
 *
 * 여기에 seam(`resolveTextRenderStyle`) 자체의 호출 비용을 따로 잰다 — R2 가 "레이아웃
 * 소비자는 추가 조회가 아니라 읽기 한 번" 이라고 주장하는 그 비용이다.
 *
 * 실행: apps/builder 에서
 *   pnpm exec vitest bench --run src/builder/workspace/canvas/skia/textAxisLetterSpacing.bench.ts
 *
 * jsdom 제약은 기존 `textMeasure.bench.ts` 와 같다 — `measureText` 는 스텁이라 폭은
 * 부정확하지만 **JS 파이프라인 오버헤드와 캐시 버킷 분기**는 정확히 계측된다. 두 arm 이
 * 같은 스텁을 쓰므로 **arm 간 비교**가 이 벤치의 판정축이다 (절대값 아님).
 */
import { bench, describe, vi } from "vitest";

import type { TextMeasureStyle } from "../utils/textMeasure";
import {
  buildFontKey,
  buildFontString,
  computeLines,
  preprocessTokens,
  tokenize,
  verifyLines,
} from "../utils/canvas2dSegmentCache";
import { resolveTextRenderStyle } from "../utils/textRenderStyle";

// jsdom 에는 2D context 가 없어 `verifyLines` 가 `ctx.font` 에서 터진다.
// `textMeasure.test.ts` 와 같은 mock 을 깐다 — 글자당 8px + 자간×grapheme 수로,
// Chrome 실측 규칙(`base + grapheme 수 × spacing`)을 그대로 흉내낸다.
const mockCtx = {
  font: "",
  letterSpacing: "0px",
  measureText(text: string) {
    const spacing = Number.parseFloat(mockCtx.letterSpacing) || 0;
    return { width: text.length * 8 + spacing * Array.from(text).length };
  },
};
vi.stubGlobal(
  "OffscreenCanvas",
  class {
    getContext() {
      return mockCtx;
    }
  },
);

const MAX_WIDTH = 200;

const BASE: TextMeasureStyle = {
  fontSize: 16,
  fontFamily: "Pretendard",
  fontWeight: 400,
  lineHeight: 24,
  wordBreak: "normal",
  overflowWrap: "normal",
};

const CONTROL: TextMeasureStyle = { ...BASE, letterSpacing: 0 };
const SPACED: TextMeasureStyle = { ...BASE, letterSpacing: 0.5 };

/** 다줄 wrap 이 나는 본문 — 줄 수 판정이 자간에 반응하는 구간. */
const BODY =
  "The quick brown fox jumps over the lazy dog while the builder measures every glyph twice.";

const segCache = new Map<string, Map<string, number>>();

function measureStub(token: string, fontKey: string): number {
  let cache = segCache.get(fontKey);
  if (!cache) {
    cache = new Map();
    segCache.set(fontKey, cache);
  }
  const cached = cache.get(token);
  if (cached !== undefined) return cached;
  const w = token.length * 8;
  cache.set(token, w);
  return w;
}

function replay(text: string, style: TextMeasureStyle): number {
  const ls = style.letterSpacing ?? 0;
  const tokens = preprocessTokens(
    tokenize(text, style.wordBreak ?? "normal"),
    style.wordBreak ?? "normal",
  );
  const fontKey = buildFontKey(style);
  const fontString = buildFontString(style);
  const widths = tokens.map((t) => measureStub(t.text, fontKey));
  const { lines } = computeLines(
    tokens,
    widths,
    MAX_WIDTH,
    style.overflowWrap ?? "normal",
    fontKey,
    fontString,
    ls,
  );
  return verifyLines(lines, MAX_WIDTH, fontString, ls).length;
}

describe("ADR-205 G2 — 자간 결선 arm 대조 (같은 텍스트·같은 파이프라인)", () => {
  bench("대조군 — letterSpacing 0", () => {
    replay(BODY, CONTROL);
  });

  bench("불리 arm — letterSpacing 0.5 (fontKey 분기 + 자간 가산)", () => {
    replay(BODY, SPACED);
  });
});

describe("ADR-205 G2 — seam 호출 비용", () => {
  const inlineStyle = { letterSpacing: "2px", fontSize: 16 };
  const computed = { letterSpacing: 1.5 };

  bench("resolveTextRenderStyle — 인라인 적중", () => {
    resolveTextRenderStyle(inlineStyle, computed);
  });

  bench("resolveTextRenderStyle — computed 폴백", () => {
    resolveTextRenderStyle(undefined, computed);
  });
});
