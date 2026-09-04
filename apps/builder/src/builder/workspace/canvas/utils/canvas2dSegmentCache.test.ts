/**
 * canvas2dSegmentCache.ts 유닛 테스트
 *
 * 테스트 범위:
 *   - preprocessTokens: 순수 함수, 브라우저 API 불필요
 *   - tokenize: Intl.Segmenter 기반, Node.js에서도 동작
 *   - buildFontKey / buildFontString: 순수 변환 함수
 *   - needsFallback: 순수 판별 함수
 *   - buildHintedText: 순수 변환 함수
 *   - getOrMeasureWidth: Canvas 2D mock 필요
 *   - clearSegmentCaches: 캐시 상태 초기화
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import type { Token } from "./canvas2dSegmentCache";

// ============================================
// Canvas 2D mock 설정
// ============================================

const mockMeasureText = vi.fn((text: string) => ({ width: text.length * 8 }));
const mockCtx = {
  font: "",
  measureText: mockMeasureText,
};

// OffscreenCanvas mock
vi.stubGlobal(
  "OffscreenCanvas",
  class {
    getContext() {
      return mockCtx;
    }
  },
);

// document.fonts mock
const mockFontsCheck = vi.fn(() => true);
const mockFontsLoad = vi.fn(() => Promise.resolve([]));
const mockFontsReadyPromise = Promise.resolve();
const mockFontsAddEventListener = vi.fn();

Object.defineProperty(globalThis, "document", {
  value: {
    fonts: {
      check: mockFontsCheck,
      load: mockFontsLoad,
      ready: mockFontsReadyPromise,
      addEventListener: mockFontsAddEventListener,
    },
    createElement: vi.fn(() => ({
      getContext: () => mockCtx,
    })),
  },
  writable: true,
  configurable: true,
});

// window.dispatchEvent mock (notifyFontsReady 내부 사용)
vi.stubGlobal("window", {
  dispatchEvent: vi.fn(),
});

// ============================================
// 모듈 임포트 — mock 설정 후 임포트해야 함
// ============================================

import {
  preprocessTokens,
  tokenize,
  buildFontKey,
  buildFontString,
  needsFallback,
  buildHintedText,
  getOrMeasureWidth,
  clearSegmentCaches,
  computeLines,
} from "./canvas2dSegmentCache";

// ============================================
// preprocessTokens 테스트
// ============================================

describe("preprocessTokens", () => {
  it("빈 배열 입력 → 빈 배열 반환", () => {
    expect(preprocessTokens([])).toEqual([]);
  });

  it("병합 없는 일반 토큰은 그대로 통과", () => {
    const tokens: Token[] = [
      { text: "Hello", breakable: true },
      { text: " ", breakable: false },
      { text: "World", breakable: true },
    ];
    expect(preprocessTokens(tokens)).toEqual(tokens);
  });

  it("라틴 trailing 구두점(.)은 선행 단어에 병합", () => {
    const tokens: Token[] = [
      { text: "Hello", breakable: true },
      { text: ".", breakable: false },
      { text: " ", breakable: false },
      { text: "World", breakable: true },
    ];
    const result = preprocessTokens(tokens);
    expect(result[0]).toEqual({ text: "Hello.", breakable: true });
    expect(result.length).toBe(3); // "Hello.", " ", "World"
  });

  it("라틴 trailing 구두점(,)은 선행 단어에 병합", () => {
    const tokens: Token[] = [
      { text: "one", breakable: true },
      { text: ",", breakable: false },
      { text: " ", breakable: false },
      { text: "two", breakable: true },
    ];
    const result = preprocessTokens(tokens);
    expect(result[0].text).toBe("one,");
    expect(result[0].breakable).toBe(true);
  });

  it("라틴 trailing 구두점이 첫 토큰이면 병합하지 않음", () => {
    const tokens: Token[] = [{ text: ".", breakable: false }];
    const result = preprocessTokens(tokens);
    expect(result).toEqual([{ text: ".", breakable: false }]);
  });

  it("행두 금칙(。)은 선행 토큰에 병합", () => {
    // 。 = \u3002 는 KINSOKU_HEAD, non-breakable 단일 문자
    const tokens: Token[] = [
      { text: "日本語", breakable: true },
      { text: "\u3002", breakable: false }, // 。
    ];
    const result = preprocessTokens(tokens);
    expect(result.length).toBe(1);
    expect(result[0].text).toBe("日本語\u3002");
    expect(result[0].breakable).toBe(true);
  });

  it("행두 금칙(、)은 선행 토큰에 병합", () => {
    const tokens: Token[] = [
      { text: "text", breakable: true },
      { text: "\u3001", breakable: false }, // 、
      { text: " ", breakable: false },
      { text: "next", breakable: true },
    ];
    const result = preprocessTokens(tokens);
    expect(result[0].text).toBe("text\u3001");
  });

  it("행두 금칙이 첫 토큰이면 병합하지 않고 그대로 출력", () => {
    const tokens: Token[] = [{ text: "\u3002", breakable: false }];
    const result = preprocessTokens(tokens);
    expect(result).toEqual([{ text: "\u3002", breakable: false }]);
  });

  it("forward-sticky(「)는 후속 토큰에 병합 — tokenize 실경로 fixture", () => {
    // 손으로 만든 breakable:true fixture 금지 (§B5-1). Intl.Segmenter 는
    // 「 를 isWordLike:false 로 내므로 구 breakable 조건은 실경로에서 dead 였다.
    const result = preprocessTokens(tokenize("\u300C\u672C\u6587", "keep-all"));
    expect(result.length).toBe(1);
    expect(result[0].text).toBe("\u300C\u672C\u6587");
    expect(result[0].breakable).toBe(true);
  });

  it("forward-sticky 문자가 마지막 토큰이면 병합 대상 없이 그대로", () => {
    const result = preprocessTokens(tokenize("text\u300C"));
    expect(result[result.length - 1].text).toBe("\u300C");
  });

  it("연속 구두점 병합 — 여러 trailing punct 연달아 처리", () => {
    const tokens: Token[] = [
      { text: "word", breakable: true },
      { text: "!", breakable: false },
      { text: "?", breakable: false },
    ];
    const result = preprocessTokens(tokens);
    // "!" → "word!" 병합, "?" → KINSOKU_HEAD에도 있어 추가 병합
    expect(result[0].text).toContain("word");
    // 두 구두점 모두 선행 토큰에 누적
    expect(result[0].text.length).toBeGreaterThanOrEqual(5);
  });

  it("원본 배열을 변경하지 않음 (불변성 보장)", () => {
    const tokens: Token[] = [
      { text: "Hello", breakable: true },
      { text: ".", breakable: false },
    ];
    const original = tokens.map((t) => ({ ...t }));
    preprocessTokens(tokens);
    expect(tokens).toEqual(original);
  });
});

// ============================================
// tokenize 테스트
// ============================================

describe("tokenize", () => {
  it("기본 영문 문장 토큰화", () => {
    const tokens = tokenize("Hello World");
    expect(tokens.length).toBeGreaterThan(0);
    const texts = tokens.map((t) => t.text);
    expect(texts).toContain("Hello");
    expect(texts).toContain("World");
  });

  it("공백은 breakable:false 토큰", () => {
    const tokens = tokenize("a b");
    const space = tokens.find((t) => t.text === " ");
    expect(space).toBeDefined();
    expect(space!.breakable).toBe(false);
  });

  it("단어는 breakable:true 토큰", () => {
    const tokens = tokenize("Hello");
    expect(tokens[0].breakable).toBe(true);
    expect(tokens[0].text).toBe("Hello");
  });

  it("CJK 문자는 word-break:normal에서 개별 토큰으로 분리", () => {
    const tokens = tokenize("한글", "normal");
    // 각 문자 개별 토큰
    expect(tokens.every((t) => t.breakable)).toBe(true);
    // 각 문자 길이 1
    expect(tokens.every((t) => t.text.length === 1)).toBe(true);
  });

  it("CJK 문자는 word-break:keep-all에서 단어 단위 유지", () => {
    const tokens = tokenize("한글", "keep-all");
    // keep-all → 분리하지 않음 → 하나의 토큰
    expect(tokens.length).toBe(1);
    expect(tokens[0].text).toBe("한글");
  });

  it("빈 문자열 → 빈 배열", () => {
    expect(tokenize("")).toEqual([]);
  });
});

// ============================================
// buildFontKey 테스트
// ============================================

describe("buildFontKey", () => {
  it("기본 스타일로 키 생성", () => {
    const key = buildFontKey({
      fontSize: 16,
      fontFamily: "Arial",
    });
    expect(key).toContain("16");
    expect(key).toContain("Arial");
  });

  it("같은 스타일은 동일한 키 생성", () => {
    const style = { fontSize: 14, fontFamily: "sans-serif", fontWeight: 400 };
    expect(buildFontKey(style)).toBe(buildFontKey(style));
  });

  it("다른 fontSize는 다른 키 생성", () => {
    const k1 = buildFontKey({ fontSize: 14, fontFamily: "Arial" });
    const k2 = buildFontKey({ fontSize: 16, fontFamily: "Arial" });
    expect(k1).not.toBe(k2);
  });

  it("다른 fontFamily는 다른 키 생성", () => {
    const k1 = buildFontKey({ fontSize: 14, fontFamily: "Arial" });
    const k2 = buildFontKey({ fontSize: 14, fontFamily: "Georgia" });
    expect(k1).not.toBe(k2);
  });
});

// ============================================
// buildFontString 테스트
// ============================================

describe("buildFontString", () => {
  it("기본 스타일 → 표준 CSS font shorthand 생성", () => {
    const fs = buildFontString({ fontSize: 16, fontFamily: "Arial" });
    expect(fs).toBe("400 16px Arial");
  });

  it("fontWeight 700 반영", () => {
    const fs = buildFontString({
      fontSize: 16,
      fontFamily: "Arial",
      fontWeight: 700,
    });
    expect(fs).toContain("700");
  });

  it("italic 스타일 반영 (숫자 1)", () => {
    const fs = buildFontString({
      fontSize: 14,
      fontFamily: "Georgia",
      fontStyle: 1,
    });
    expect(fs).toMatch(/^italic /);
  });

  it("italic 스타일 반영 (문자열 'italic')", () => {
    const fs = buildFontString({
      fontSize: 14,
      fontFamily: "Georgia",
      fontStyle: "italic",
    });
    expect(fs).toMatch(/^italic /);
  });

  it("oblique 스타일 반영 (숫자 2)", () => {
    const fs = buildFontString({
      fontSize: 14,
      fontFamily: "Georgia",
      fontStyle: 2,
    });
    expect(fs).toMatch(/^oblique /);
  });
});

// ============================================
// needsFallback 테스트
// ============================================

describe("needsFallback", () => {
  it("기본 스타일은 fallback 불필요", () => {
    expect(needsFallback({ fontSize: 16, fontFamily: "Arial" })).toBe(false);
  });

  it("letterSpacing 있으면 fallback 필요", () => {
    expect(
      needsFallback({ fontSize: 16, fontFamily: "Arial", letterSpacing: 2 }),
    ).toBe(true);
  });

  it("letterSpacing 0이면 fallback 불필요", () => {
    expect(
      needsFallback({ fontSize: 16, fontFamily: "Arial", letterSpacing: 0 }),
    ).toBe(false);
  });

  it("wordSpacing 있으면 fallback 필요", () => {
    expect(
      needsFallback({ fontSize: 16, fontFamily: "Arial", wordSpacing: 4 }),
    ).toBe(true);
  });

  it("whiteSpace: nowrap이면 fallback 필요", () => {
    expect(
      needsFallback({
        fontSize: 16,
        fontFamily: "Arial",
        whiteSpace: "nowrap",
      }),
    ).toBe(true);
  });

  it("whiteSpace: normal이면 fallback 불필요", () => {
    expect(
      needsFallback({
        fontSize: 16,
        fontFamily: "Arial",
        whiteSpace: "normal",
      }),
    ).toBe(false);
  });

  it("wordBreak: break-all이면 fallback 필요", () => {
    expect(
      needsFallback({
        fontSize: 16,
        fontFamily: "Arial",
        wordBreak: "break-all",
      }),
    ).toBe(true);
  });

  it("fontVariant: small-caps면 fallback 필요 (ADR-151 B18 — buildFontString 미포함, CanvasKit 렌더는 적용)", () => {
    expect(
      needsFallback({
        fontSize: 16,
        fontFamily: "Arial",
        fontVariant: "small-caps",
      }),
    ).toBe(true);
  });

  it("fontVariant: normal이면 fallback 불필요", () => {
    expect(
      needsFallback({
        fontSize: 16,
        fontFamily: "Arial",
        fontVariant: "normal",
      }),
    ).toBe(false);
  });
});

// ============================================
// buildHintedText 테스트
// ============================================

describe("buildHintedText", () => {
  it("단일 줄은 개행 없이 반환", () => {
    expect(buildHintedText([["Hello", " ", "World"]])).toBe("Hello World");
  });

  it("복수 줄은 \\n으로 구분", () => {
    expect(buildHintedText([["Hello"], ["World"]])).toBe("Hello\nWorld");
  });

  it("빈 줄 배열 → 빈 문자열", () => {
    expect(buildHintedText([])).toBe("");
  });

  it("빈 토큰 배열 포함 줄 처리", () => {
    expect(buildHintedText([[], ["text"]])).toBe("\ntext");
  });
});

// ============================================
// getOrMeasureWidth 테스트
// ============================================

describe("getOrMeasureWidth", () => {
  beforeEach(() => {
    clearSegmentCaches();
    mockMeasureText.mockClear();
    mockFontsCheck.mockReturnValue(true); // 폰트 로드됨 상태
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it("기본 측정값 반환 — 텍스트 길이 × 8", () => {
    const width = getOrMeasureWidth("Hi", "Arial\x00400", "400 16px Arial");
    // mockMeasureText: text.length * 8 = 2 * 8 = 16
    expect(width).toBe(16);
  });

  it("동일 토큰 두 번 호출 시 캐시 히트 → measureText 한 번만 호출", () => {
    mockFontsCheck.mockReturnValue(true);
    getOrMeasureWidth("hello", "Arial\x00400", "400 16px Arial");
    getOrMeasureWidth("hello", "Arial\x00400", "400 16px Arial");
    // 두 번째는 캐시에서 반환 → measureText 총 1회
    expect(mockMeasureText).toHaveBeenCalledTimes(1);
  });

  it("다른 fontKey는 별도 캐시 → 각각 measureText 호출", () => {
    mockFontsCheck.mockReturnValue(true);
    getOrMeasureWidth("hello", "Arial\x00400", "400 16px Arial");
    getOrMeasureWidth("hello", "Georgia\x00400", "400 16px Georgia");
    expect(mockMeasureText).toHaveBeenCalledTimes(2);
  });

  it("폰트 미로드 시 캐시 없이 측정 — clearSegmentCaches 후 재측정 가능", () => {
    mockFontsCheck.mockReturnValue(false); // 폰트 미로드
    mockFontsLoad.mockResolvedValue([]);

    getOrMeasureWidth("abc", "Arial\x00400", "400 16px Arial");
    getOrMeasureWidth("abc", "Arial\x00400", "400 16px Arial");
    // 폰트 미로드 → 캐싱 없음 → measureText 2번 호출
    expect(mockMeasureText).toHaveBeenCalledTimes(2);
  });

  it("ctx.font이 fontString으로 설정됨", () => {
    mockFontsCheck.mockReturnValue(true);
    getOrMeasureWidth("x", "key", "700 24px Roboto");
    expect(mockCtx.font).toBe("700 24px Roboto");
  });
});


// ============================================
// Chrome 오라클 16 케이스 — Tier 3 preprocessing + computeLines
//
// EXTERNAL_PATTERN_DELTA_2026-09.md §B3 / §B4-11 이 Chrome 152 (macOS) 의
// Range.getClientRects() 로 추출한 줄 경계를 기대값으로 고정한다.
//
// fixture 는 반드시 tokenize() 실경로로 만든다 — 손으로 만든 breakable:true
// 구두점 fixture 가 행말 금칙 dead 규칙을 5개월간 가렸다 (§B3 G/H).
// 폭은 fake 등폭 (grapheme 당 10px) — "어디서 끊을 수 있는가" 만 보므로 폰트 무관.
// maxWidth = graphemes(접두어) × 10 + 1.5 (§B7 오라클 스크립트와 같은 규약).
// ============================================

const FAKE_GRAPHEME_W = 10;

function simulate(
  text: string,
  prefix: string,
  opts: { wordBreak?: string; delta?: number } = {},
): { lines: string[]; maxLineWidth: number } {
  const wordBreak = opts.wordBreak ?? "normal";
  const tokens = preprocessTokens(tokenize(text, wordBreak), wordBreak);
  const widths = tokens.map((t) => Array.from(t.text).length * FAKE_GRAPHEME_W);
  const maxWidth =
    Array.from(prefix).length * FAKE_GRAPHEME_W + (opts.delta ?? 1.5);
  const { lines, maxLineWidth } = computeLines(
    tokens,
    widths,
    maxWidth,
    "normal",
    "fake\x00400",
    "400 16px Arial",
  );
  // 줄 끝 hang 공백은 CSS 에서 줄 폭에 기여하지 않으므로 비교에서 제외한다.
  return { lines: lines.map((l) => l.join("").trim()), maxLineWidth };
}

describe("Tier 3 — Chrome 오라클 케이스 고정", () => {
  it("A. `$` 는 뒤 숫자에 붙는다 (numeric prefix affix)", () => {
    expect(simulate("Price $100 today", "Price $").lines).toEqual([
      "Price",
      "$100",
      "today",
    ]);
  });

  it("B. `%` 는 앞 숫자에 붙는다 (numeric postfix affix)", () => {
    const { lines, maxLineWidth } = simulate("50% off", "50%");
    expect(lines).toEqual(["50%", "off"]);
    // "50%" 3 grapheme = 30px — `%` 가 hang 되면 20px 로 과소 측정된다
    expect(maxLineWidth).toBe(30);
  });

  it("C. 라틴 여는 괄호는 후속 토큰에 붙는다", () => {
    expect(simulate("call (주)회사 now", "call (").lines).toEqual([
      "call",
      "(주)회사",
      "now",
    ]);
  });

  it("E. 이메일은 공백 없는 한 단위", () => {
    expect(
      simulate("mail support@example.com now", "mail support@").lines,
    ).toEqual(["mail", "support@example.com", "now"]);
  });

  it("F. 경로·식별자는 공백 없는 한 단위", () => {
    expect(simulate("see foo_bar/baz_qux here", "see foo_bar/").lines).toEqual([
      "see",
      "foo_bar/baz_qux",
      "here",
    ]);
  });

  it("F2. URL 은 공백 없는 한 단위", () => {
    expect(
      simulate(
        "go https://example.com/path/to",
        "go https://example.com/",
      ).lines,
    ).toEqual(["go", "https://example.com/path/to"]);
  });

  it("G. CJK 여는 괄호 「 는 줄 끝에 남지 않는다", () => {
    expect(simulate("彼は「こんにちは」と言った", "彼は「").lines).toEqual([
      "彼は",
      "「こん",
      "にち",
      "は」と",
      "言った",
    ]);
  });

  it("H. 전각 여는 괄호 （ 는 줄 끝에 남지 않는다", () => {
    expect(simulate("漢字（注）です", "漢字（").lines).toEqual([
      "漢字",
      "（注）",
      "です",
    ]);
  });

  it("L. 여는 곧은 따옴표는 줄 끝에 남지 않는다", () => {
    expect(simulate('he said "hello world" ok', 'he said "').lines).toEqual([
      "he said",
      '"hello',
      'world" ok',
    ]);
  });

  it("O. 여는 아포스트로피는 줄 끝에 남지 않는다", () => {
    expect(simulate("it's 'quoted' text here", "it's '").lines).toEqual([
      "it's",
      "'quoted'",
      "text",
      "here",
    ]);
  });

  it("N. keep-all — 공백 없이 인접한 CJK 포함 그룹은 한 단위", () => {
    expect(
      simulate("한글abc123 다음", "한글", { wordBreak: "keep-all" }).lines,
    ).toEqual(["한글abc123", "다음"]);
  });

  it("N2. keep-all — CJK+숫자 혼합도 한 단위", () => {
    expect(
      simulate("価格1200円です", "価格1200", { wordBreak: "keep-all" }).lines,
    ).toEqual(["価格1200円です"]);
  });

  it("D. computeLines — 연속 non-breakable 토큰의 폭이 누락되지 않는다", () => {
    // 컨테이너 = 실폭(130) − 0.5 → Chrome 은 줄바꿈. Before 는 "/" 와 공백 하나가
    // pendingSpace 덮어쓰기로 사라져 fits 로 오판했다 (Tier 2 가 가림).
    const { lines, maxLineWidth } = simulate("Save / Cancel", "Save / Cancel", {
      delta: -0.5,
    });
    expect(lines).toEqual(["Save /", "Cancel"]);
    expect(maxLineWidth).toBe(60);
  });

  it("P. `Save /` — SY 앞에서는 공백 뒤에도 끊지 않는다 (폭은 정확)", () => {
    const { lines, maxLineWidth } = simulate("Save /", "Save");
    expect(lines).toEqual(["Save /"]);
    expect(maxLineWidth).toBe(60);
  });

  it("M. 하이픈은 앞에 붙고 뒤에서 끊는다 (전화번호 오적용 방지)", () => {
    expect(simulate("well-known word", "well-").lines).toEqual([
      "well-",
      "known",
      "word",
    ]);
  });

  it("M2. 전화번호는 하이픈 뒤에서만 끊는다", () => {
    expect(simulate("010-1234-5678", "010-1234-").lines).toEqual([
      "010-1234-",
      "5678",
    ]);
  });

  it("Q. `Wait...` 는 한 단위", () => {
    expect(simulate("Wait...", "Wait...").lines).toEqual(["Wait..."]);
  });

  it("R. `(note)` 는 한 단위", () => {
    expect(simulate("(note)", "(note)").lines).toEqual(["(note)"]);
  });
});
