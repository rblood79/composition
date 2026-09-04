/**
 * textMeasure.ts + canvas2dSegmentCache.ts 회귀 테스트
 *
 * 대상:
 *   - Canvas2DTextMeasurer.measureWrapped() — trailing space hang 수정
 *   - verifyLines() — overflow trailing space 수정
 *
 * @since 2026-04-09
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

// ============================================
// Canvas 2D mock 설정
// (canvas2dSegmentCache.test.ts 동일 패턴)
// ============================================

/**
 * 각 글자를 8px 고정 폭으로 측정하는 mock.
 * 공백도 동일하게 8px.
 *
 * 예: "Button" = 6글자 = 48px, " " = 1글자 = 8px
 */
const mockMeasureText = vi.fn((text: string) => {
  const spacing = parseFloat(mockCtx.letterSpacing) || 0;
  return { width: text.length * 8 + spacing * Array.from(text).length };
});
const mockCtx = {
  font: "",
  letterSpacing: "0px",
  measureText: mockMeasureText,
};

// OffscreenCanvas mock — canvas2dSegmentCache.ts의 getCtx() 가로채기
vi.stubGlobal(
  "OffscreenCanvas",
  class {
    getContext() {
      return mockCtx;
    }
  },
);

// document mock — getMeasureCtx() (textMeasure.ts) + getCtx() (segmentCache.ts)
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

vi.stubGlobal("window", {
  dispatchEvent: vi.fn(),
});

// ============================================
// 모듈 임포트 — mock 설정 완료 후
// ============================================

import { Canvas2DTextMeasurer, measureWrappedTextHeight } from "./textMeasure";
import { verifyLines, clearSegmentCaches } from "./canvas2dSegmentCache";

// ============================================
// Canvas2DTextMeasurer.measureWrapped 테스트
//
// mock: text.length * 8 px per character
// "Hello"=40px, "World"=40px, " "=8px, "Button"=48px
// ============================================

describe("Canvas2DTextMeasurer.measureWrapped — trailing space hang 수정", () => {
  const measurer = new Canvas2DTextMeasurer();
  const baseStyle = { fontSize: 16, fontFamily: "Arial" };

  beforeEach(() => {
    mockMeasureText.mockClear();
  });

  it("TC1: 정상 줄바꿈 — maxWidth 충분 시 1줄", () => {
    // "Hello World" = 11자 = 88px, maxWidth=200 → 1줄
    const result = measurer.measureWrapped("Hello World", baseStyle, 200);
    expect(result.height).toBe(result.height); // 실행 오류 없음
    // 줄 수 = height / lineHeight. lineHeight ≈ fontSize * 1.2 = 19.2
    // 1줄이면 height < 30
    expect(result.height).toBeLessThan(30);
  });

  it("TC2: 공백이 추가 줄을 생성하지 않음 — 'Button Button' maxWidth=50 → 2줄", () => {
    // "Button"=48px, " "=8px, "Button"=48px
    // maxWidth=50: 첫 "Button"(48) fit, " "(8) → hang, 두 번째 "Button"(48) 새 줄
    // 수정 전: 공백이 overflow를 트리거 → 3줄
    // 수정 후: 공백은 hang → 정확히 2줄
    const result = measurer.measureWrapped("Button Button", baseStyle, 50);
    // lineHeight 근사: fontSize * 1.2 = 19.2 → 2줄 ≈ 38.4px
    // 3줄이면 57.6px 이상
    const lineHeight = result.height / Math.round(result.height / 19.2);
    const lineCount = Math.round(result.height / lineHeight);
    expect(lineCount).toBe(2);
  });

  it("TC3: 단일 긴 단어 — break-word 없이 1줄 유지", () => {
    // "Superlongword" = 13자 = 104px, maxWidth=50
    // wordBreak:normal, overflowWrap:normal → 단어 분리 안 함 → 1줄
    const result = measurer.measureWrapped("Superlongword", baseStyle, 50);
    const approxLineHeight = 19.2;
    const lineCount = Math.round(result.height / approxLineHeight);
    expect(lineCount).toBe(1);
  });

  it("TC4: break-word 줄바꿈 — 선행 단어 다음에 긴 단어가 오면 문자 단위 분할됨", () => {
    // "Hi Superlongword" — "Hi"(16px) fit, " "(8) hang,
    // 다음 단어 "Superlongword"(104px): currentLineWidth=16 > 0, wordWidth=104 > maxWidth=40
    // → break-word 분할 발동 → 3줄 이상
    const result = measurer.measureWrapped(
      "Hi Superlongword",
      {
        ...baseStyle,
        overflowWrap: "break-word",
      },
      40,
    );
    const approxLineHeight = 19.2;
    const lineCount = Math.round(result.height / approxLineHeight);
    expect(lineCount).toBeGreaterThan(1);
  });

  it("TC5: 다중 공백 — 'A  B  C' (이중 공백) 가 추가 줄을 만들지 않음", () => {
    // "A"=8px, "  "=16px, "B"=8px, "  "=16px, "C"=8px = 56px
    // maxWidth=100 → 1줄에 모두 들어가야 함
    // 수정 전: 이중 공백이 overflow 판단에 포함될 수 있었음
    const result = measurer.measureWrapped("A  B  C", baseStyle, 100);
    const approxLineHeight = 19.2;
    const lineCount = Math.round(result.height / approxLineHeight);
    expect(lineCount).toBe(1);
  });

  it("TC6: 래핑 불필요 — 'Hi' wide maxWidth → 1줄", () => {
    const result = measurer.measureWrapped("Hi", baseStyle, 500);
    const approxLineHeight = 19.2;
    const lineCount = Math.round(result.height / approxLineHeight);
    expect(lineCount).toBe(1);
  });

  it("TC7: 빈 문자열 → height = lineHeight (0줄 아님)", () => {
    const result = measurer.measureWrapped("", baseStyle, 200);
    expect(result.height).toBeGreaterThan(0);
    expect(result.width).toBe(0);
  });

  it("TC8: maxWidth=0 → height = lineHeight 반환 (예외 없음)", () => {
    const result = measurer.measureWrapped("Hello", baseStyle, 0);
    expect(result.height).toBeGreaterThan(0);
  });
});

// ============================================
// verifyLines 테스트
//
// mock: text.length * 8 px per character
// LINE_FIT_EPSILON = 0.015 (canvas2dSegmentCache.ts 내부 상수)
// ============================================

describe("verifyLines — overflow trailing space 수정", () => {
  const fontString = "400 16px Arial";

  beforeEach(() => {
    clearSegmentCaches();
    mockMeasureText.mockClear();
  });

  it("TC1: 정상 2줄 — 변경 없이 2줄 유지", () => {
    // [["Hello","World"],["Foo"]]
    // "HelloWorld" = 10자 = 80px → maxWidth=100 fit
    // "Foo" = 3자 = 24px → fit
    const lines = [["Hello", "World"], ["Foo"]];
    const result = verifyLines(lines, 100, fontString);
    expect(result.length).toBe(2);
  });

  it("TC2: trailing space overflow — 공백이 다음 줄로 분리되지 않음", () => {
    // lines=[["Button"," "],["Button"]]
    // "Button " = 7자 = 56px, maxWidth=50
    // overflow → fit 탐색: "Button"=48px ≤ 50 → kept=["Button"," "], rest=[]
    // 수정 후: 공백은 kept에 유지, carry=[] → 2줄 그대로 (3줄 안 됨)
    const lines = [["Button", " "], ["Button"]];
    const result = verifyLines(lines, 50, fontString);

    // 결과는 2줄이어야 함 (공백이 carry에 남아 추가 줄 생성하면 안 됨)
    expect(result.length).toBe(2);

    // 첫 번째 줄은 "Button"을 포함
    expect(result[0].join("")).toContain("Button");

    // 공백이 첫 번째 줄 끝에 hang되어 있어야 함
    // (두 번째 줄로 분리되면 안 됨)
    const secondLine = result[1].join("");
    expect(secondLine).not.toBe(" "); // 공백만 있는 줄이면 안 됨
  });

  it("TC3: 단일 줄 — verifyLines는 1줄이면 그대로 반환", () => {
    const lines = [["Hello", " ", "World"]];
    const result = verifyLines(lines, 200, fontString);
    expect(result).toEqual(lines);
  });

  it("TC4: pull 동작 — fit인 줄에서 다음 줄 첫 토큰 당겨오기", () => {
    // line1: ["Hi"] = 2자 = 16px, maxWidth=50
    // line2: ["OK"] = 2자 = 16px
    // "HiOK" = 32px ≤ 50 → OK를 당겨서 line1에 합침 → 1줄
    const lines = [["Hi"], ["OK"]];
    const result = verifyLines(lines, 50, fontString);
    expect(result.length).toBe(1);
    expect(result[0].join("")).toBe("HiOK");
  });

  it("TC5: overflow 보정 — 첫 줄 overflow 시 마지막 토큰 다음 줄로 이동", () => {
    // line1: ["Hello","World"] = "HelloWorld" = 80px, maxWidth=50
    // 80px > 50px → overflow → fit 탐색
    // "Hello" = 40px ≤ 50 → kept=["Hello"], rest=["World"]
    // 결과: 2줄 이상
    const lines = [["Hello", "World"], ["Foo"]];
    const result = verifyLines(lines, 50, fontString);
    expect(result.length).toBeGreaterThan(1);
    // "Hello"는 첫 줄에
    expect(result[0].join("")).toBe("Hello");
  });
});

// ============================================
// letterSpacing — Chrome 실측 규칙 (grapheme 마다, trailing 포함)
// ============================================

describe("Canvas2DTextMeasurer.measureWidth — letterSpacing", () => {
  it("grapheme 마다 가산하고 마지막 글자 뒤 간격도 포함한다", () => {
    // Chrome 152 실측 (16px Arial): "abc" letter-spacing 2px → base + 3×2.
    // 구현은 `text.length - 1` (문자 사이만) 이었다 — 마지막 간격 누락 + surrogate
    // pair 를 2로 세는 두 결함.
    const m = new Canvas2DTextMeasurer();
    const w = m.measureWidth("abc", {
      fontSize: 16,
      fontFamily: "Arial",
      letterSpacing: 2,
    });
    expect(w).toBe(3 * 8 + 3 * 2);
  });

  it("letterSpacing 0 이면 base 폭 그대로", () => {
    const m = new Canvas2DTextMeasurer();
    expect(m.measureWidth("abc", { fontSize: 16, fontFamily: "Arial" })).toBe(
      24,
    );
  });

  it("서로게이트 페어는 grapheme 1개로 센다", () => {
    const m = new Canvas2DTextMeasurer();
    // "😀" 는 UTF-16 길이 2, grapheme 1 → spacing 은 1회만
    const w = m.measureWidth("😀", {
      fontSize: 16,
      fontFamily: "Arial",
      letterSpacing: 2,
    });
    expect(w).toBe(2 * 8 + 1 * 2);
  });
});

// ============================================
// ADR-205 Phase 1 — wrap/height leg 의 letterSpacing 결선
// ============================================

describe("measureWrappedTextHeight — letterSpacing (ADR-205)", () => {
  beforeEach(() => {
    mockCtx.letterSpacing = "0px";
    mockMeasureText.mockClear();
  });

  // mock 은 글자당 8px + letterSpacing×글자수.
  //   "abc def" → abc 24 · 공백 8 · def 24 = 56  (ls 0)
  //              → abc 30 · 공백 10 · def 30 = 70 (ls 2)
  // maxWidth 60 이면 ls 0 은 한 줄, ls 2 는 두 줄이다.
  const TEXT = "abc def";
  const MAX_WIDTH = 60;
  const LINE_HEIGHT = 20;

  it("ls 0 은 한 줄 — 종전 동작 유지", () => {
    expect(
      measureWrappedTextHeight(
        TEXT,
        8,
        400,
        "Pretendard",
        MAX_WIDTH,
        LINE_HEIGHT,
        undefined,
        undefined,
        0,
      ),
    ).toBe(LINE_HEIGHT);
  });

  it("ls 2 는 줄 수가 늘어난다 — 인자가 측정기까지 도달해야 성립", () => {
    expect(
      measureWrappedTextHeight(
        TEXT,
        8,
        400,
        "Pretendard",
        MAX_WIDTH,
        LINE_HEIGHT,
        undefined,
        undefined,
        2,
      ),
    ).toBe(LINE_HEIGHT * 2);
  });

  it("인자 생략은 ls 0 과 같다 — 기존 호출 지점 하위 호환", () => {
    expect(
      measureWrappedTextHeight(
        TEXT,
        8,
        400,
        "Pretendard",
        MAX_WIDTH,
        LINE_HEIGHT,
      ),
    ).toBe(LINE_HEIGHT);
  });
});
