import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Canvas, CanvasKit, FontMgr } from "canvaskit-wasm";
import {
  acquireOverlayFont,
  clearOverlayFontCache,
  renderDimensionLabels,
  renderPageTitle,
} from "./selectionRenderer";

/**
 * Overlay Font 캐시 계약 (simplify 효율 항목, 2026-08-14) — 실 CanvasKit 없이 mock 으로
 * 인스턴스 재사용/무효화만 잠근다. 구 per-call `resolveOverlayTypeface + new ck.Font →
 * delete`(팬 중 ≈360회/초) 를 (fontMgr 참조, weight, embolden) 키 캐시 + `setSize` 로
 * 대체한 계약:
 * - 같은 (fontMgr, weight, embolden) → 같은 Font 인스턴스 재사용, setSize 로 크기만 갱신
 * - weight 또는 embolden 여부가 다르면 별도 인스턴스
 * - fontMgr 참조 교체 → 전체 재구축 (이전 Font/Typeface delete)
 * - typeface 미해소(폰트 로드 전) → null 반환, 미캐시 (다음 호출 재시도)
 */

class MockFont {
  size: number;
  deleted = false;
  emboldened = false;
  constructor(
    public typeface: unknown,
    size: number,
  ) {
    this.size = size;
  }
  setSubpixel(): void {}
  setEmbolden(embolden: boolean): void {
    this.emboldened = embolden;
  }
  setSize(size: number): void {
    this.size = size;
  }
  getGlyphIDs(text: string): number[] {
    return [...text].map((_, index) => index);
  }
  getGlyphWidths(glyphIds: number[]): number[] {
    return glyphIds.map(() => 6);
  }
  getMetrics(): { ascent: number; descent: number } {
    return { ascent: -9, descent: 3 };
  }
  delete(): void {
    this.deleted = true;
  }
}

class MockPaint {
  setAntiAlias(): void {}
  setStyle(): void {}
  setColor(): void {}
  setStrokeWidth(): void {}
  setStrokeCap(): void {}
  setStrokeJoin(): void {}
  setBlendMode(): void {}
  setPathEffect(): void {}
  setShader(): void {}
  setImageFilter(): void {}
  setColorFilter(): void {}
  delete(): void {}
}

class MockCanvas {
  scales: Array<[number, number]> = [];
  translations: Array<[number, number]> = [];
  rrects: unknown[] = [];
  texts: Array<{ text: string; x: number; y: number; fontSize: number }> = [];

  save(): void {}
  restore(): void {}
  scale(x: number, y: number): void {
    this.scales.push([x, y]);
  }
  translate(x: number, y: number): void {
    this.translations.push([x, y]);
  }
  drawRRect(rrect: unknown): void {
    this.rrects.push(rrect);
  }
  drawText(
    text: string,
    x: number,
    y: number,
    _paint: unknown,
    font: MockFont,
  ): void {
    this.texts.push({ text, x, y, fontSize: font.size });
  }
}

function mockCk(): CanvasKit {
  return {
    FontWeight: { Normal: { value: 400 }, Medium: { value: 500 } },
    FontWidth: { Normal: { value: 5 } },
    FontSlant: { Upright: { value: 0 } },
    Font: MockFont,
    Paint: MockPaint,
    PaintStyle: { Fill: { value: 0 } },
    StrokeCap: { Butt: { value: 0 } },
    StrokeJoin: { Miter: { value: 0 } },
    BlendMode: { SrcOver: { value: 0 } },
    BLACK: [0, 0, 0, 1],
    Color4f: (r: number, g: number, b: number, a: number) => [r, g, b, a],
    LTRBRect: (left: number, top: number, right: number, bottom: number) => ({
      left,
      top,
      right,
      bottom,
    }),
    RRectXY: (rect: unknown, rx: number, ry: number) => ({ rect, rx, ry }),
  } as unknown as CanvasKit;
}

function mockFontMgr(resolves = true): FontMgr {
  return {
    matchFamilyStyle: vi.fn(() => (resolves ? { delete: vi.fn() } : null)),
  } as unknown as FontMgr;
}

describe("acquireOverlayFont — (fontMgr, weight, embolden) 키 캐시 계약", () => {
  beforeEach(() => {
    clearOverlayFontCache();
  });

  it("같은 (fontMgr, weight) 는 같은 Font 인스턴스를 재사용하고 setSize 만 갱신", () => {
    const ck = mockCk();
    const fontMgr = mockFontMgr();
    const a = acquireOverlayFont(ck, fontMgr, ck.FontWeight.Medium, 12);
    const b = acquireOverlayFont(ck, fontMgr, ck.FontWeight.Medium, 24);
    expect(a).toBe(b);
    expect((b as unknown as MockFont).size).toBe(24);
    // typeface 조회(WASM matchFamilyStyle)는 최초 1회만.
    expect(
      (fontMgr.matchFamilyStyle as ReturnType<typeof vi.fn>).mock.calls.length,
    ).toBe(1);
  });

  it("weight 가 다르면 별도 인스턴스", () => {
    const ck = mockCk();
    const fontMgr = mockFontMgr();
    const normal = acquireOverlayFont(ck, fontMgr, ck.FontWeight.Normal, 12);
    const medium = acquireOverlayFont(ck, fontMgr, ck.FontWeight.Medium, 12);
    expect(normal).not.toBe(medium);
  });

  it("같은 weight라도 embolden 여부가 다르면 Font를 분리해 다른 overlay를 오염시키지 않는다", () => {
    const ck = mockCk();
    const fontMgr = mockFontMgr();
    const regular = acquireOverlayFont(
      ck,
      fontMgr,
      ck.FontWeight.Medium,
      12,
    ) as unknown as MockFont;
    const emboldened = acquireOverlayFont(
      ck,
      fontMgr,
      ck.FontWeight.Medium,
      12,
      { embolden: true },
    ) as unknown as MockFont;

    expect(emboldened).not.toBe(regular);
    expect(regular.emboldened).toBe(false);
    expect(emboldened.emboldened).toBe(true);
  });

  it("fontMgr 참조 교체 시 전체 재구축 — 이전 Font 는 delete", () => {
    const ck = mockCk();
    const first = acquireOverlayFont(
      ck,
      mockFontMgr(),
      ck.FontWeight.Medium,
      12,
    ) as unknown as MockFont;
    const second = acquireOverlayFont(
      ck,
      mockFontMgr(),
      ck.FontWeight.Medium,
      12,
    );
    expect(second).not.toBe(first);
    expect(first.deleted).toBe(true);
  });

  it("typeface 미해소면 null 반환 + 미캐시 (다음 호출 재시도)", () => {
    const ck = mockCk();
    const fontMgr = mockFontMgr(false);
    expect(
      acquireOverlayFont(ck, fontMgr, ck.FontWeight.Medium, 12),
    ).toBeNull();
    expect(
      acquireOverlayFont(ck, fontMgr, ck.FontWeight.Medium, 12),
    ).toBeNull();
    // 두 호출 모두 재시도 (negative 캐시 없음) — 6단계 fallback × 2회.
    expect(
      (fontMgr.matchFamilyStyle as ReturnType<typeof vi.fn>).mock.calls.length,
    ).toBe(12);
  });
});

describe("Skia overlay text — 화면 픽셀 크기 고정 계약", () => {
  beforeEach(() => {
    clearOverlayFontCache();
  });

  it("zoom이 달라도 같은 12px Font와 local label geometry를 사용한다", () => {
    const ck = mockCk();
    const fontMgr = mockFontMgr();
    const bounds = { x: 10, y: 20, width: 180, height: 120 };
    const at100 = new MockCanvas();
    const at200 = new MockCanvas();

    renderDimensionLabels(ck, at100 as unknown as Canvas, bounds, 1, fontMgr);
    renderDimensionLabels(ck, at200 as unknown as Canvas, bounds, 2, fontMgr);

    expect(at100.scales).toEqual([[1, 1]]);
    expect(at200.scales).toEqual([[0.5, 0.5]]);
    expect(at100.rrects).toEqual(at200.rrects);
    expect(at100.texts).toEqual(at200.texts);
    expect(at100.texts[0]?.fontSize).toBe(12);
  });

  it("Page title도 zoom과 무관하게 같은 12px glyph geometry를 유지한다", () => {
    const ck = mockCk();
    const fontMgr = mockFontMgr();
    const at100 = new MockCanvas();
    const at200 = new MockCanvas();

    const metrics100 = renderPageTitle(
      ck,
      at100 as unknown as Canvas,
      "Page title",
      1,
      fontMgr,
      true,
    );
    const metrics200 = renderPageTitle(
      ck,
      at200 as unknown as Canvas,
      "Page title",
      2,
      fontMgr,
      true,
    );

    expect(at100.scales).toEqual([[1, 1]]);
    expect(at200.scales).toEqual([[0.5, 0.5]]);
    expect(at100.texts).toEqual(at200.texts);
    expect(at100.texts[0]?.fontSize).toBe(12);
    expect(metrics100).toEqual(metrics200);
  });
});
