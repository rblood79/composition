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

  it("행말 금칙(「)은 후속 토큰에 병합", () => {
    // 「 = \u300C 는 KINSOKU_TAIL, breakable 단일 문자
    const tokens: Token[] = [
      { text: "\u300C", breakable: true }, // 「
      { text: "本文", breakable: true },
    ];
    const result = preprocessTokens(tokens);
    expect(result.length).toBe(1);
    expect(result[0].text).toBe("\u300C本文");
    expect(result[0].breakable).toBe(true);
  });

  it("행말 금칙이 마지막 토큰이면 후속 없이 스킵", () => {
    // i + 1 < toks.length 조건 미충족 → 그냥 push
    const tokens: Token[] = [
      { text: "text", breakable: true },
      { text: "\u300C", breakable: true }, // 「 at end
    ];
    const result = preprocessTokens(tokens);
    // \u300C 는 마지막이라 후속 토큰 없음 → 그대로 push
    expect(result[1].text).toBe("\u300C");
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
