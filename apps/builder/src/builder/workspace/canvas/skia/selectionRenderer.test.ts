import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Canvas, CanvasKit, FontMgr } from "canvaskit-wasm";

// 페이지 타이틀은 Paragraph 경로 (실제 bold) — 공유 FontCollection 은 mock 으로 대체.
vi.mock("./fontManager", () => ({
  skiaFontManager: { getFontCollection: () => ({ __mockCollection: true }) },
}));
import {
  acquireOverlayFont,
  clearOverlayFontCache,
  renderDimensionLabels,
  renderPageHeader,
  renderPageTitle,
  PAGE_HEADER_GAP,
  PAGE_HEADER_HEIGHT,
  PAGE_HEADER_PADDING_X,
  PAGE_TITLE_FONT_WEIGHT,
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
  color: unknown = null;
  setAntiAlias(): void {}
  setStyle(): void {}
  setColor(color: unknown): void {
    this.color = color;
  }
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
  rects: Array<{ rect: unknown; color: unknown }> = [];
  texts: Array<{ text: string; x: number; y: number; fontSize: number }> = [];
  paragraphs: Array<{
    text: string;
    x: number;
    y: number;
    fontSize: number;
    weight: number | undefined;
  }> = [];

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
  drawRect(rect: unknown, paint: MockPaint): void {
    this.rects.push({ rect, color: paint.color });
  }
  drawParagraph(para: MockParagraph, x: number, y: number): void {
    this.paragraphs.push({
      text: para.text,
      x,
      y,
      fontSize: para.fontSize,
      weight: para.weight,
    });
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

class MockParagraph {
  constructor(
    public text: string,
    public fontSize: number,
    public weight: number | undefined,
  ) {}
  layout(): void {}
  getHeight(): number {
    return this.fontSize;
  }
  getLongestLine(): number {
    return this.text.length * 6;
  }
  delete(): void {}
}

class MockParagraphBuilder {
  private text = "";
  private fontSize = 0;
  private weight: number | undefined;
  pushStyle(style: {
    fontSize: number;
    fontVariations?: Array<{ axis: string; value: number }>;
  }): void {
    this.fontSize = style.fontSize;
    this.weight = style.fontVariations?.find((v) => v.axis === "wght")?.value;
  }
  addText(text: string): void {
    this.text += text;
  }
  build(): MockParagraph {
    return new MockParagraph(this.text, this.fontSize, this.weight);
  }
  delete(): void {}
}

function mockCk(): CanvasKit {
  return {
    ParagraphStyle: class {
      constructor(public opts: unknown) {}
    },
    TextStyle: class {
      constructor(opts: object) {
        Object.assign(this, opts);
      }
    },
    ParagraphBuilder: {
      MakeFromFontCollection: () => new MockParagraphBuilder(),
    },
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
    XYWHRect: (x: number, y: number, w: number, h: number) => ({ x, y, w, h }),
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
    expect(at100.paragraphs).toEqual(at200.paragraphs);
    expect(at100.paragraphs[0]?.fontSize).toBe(12);
    expect(metrics100).toEqual(metrics200);
  });

  it("Page title 은 Paragraph + wght 700 (실제 bold) 로 조판된다", () => {
    const ck = mockCk();
    const fontMgr = mockFontMgr();
    const canvas = new MockCanvas();
    renderPageTitle(ck, canvas as unknown as Canvas, "Bold", 1, fontMgr);
    expect(canvas.paragraphs[0]?.weight).toBe(PAGE_TITLE_FONT_WEIGHT);
    expect(PAGE_TITLE_FONT_WEIGHT).toBe(700);
    expect(canvas.texts).toHaveLength(0);
  });
});

describe("renderPageHeader — 페이지 상단 32px 헤더 띠", () => {
  beforeEach(() => {
    clearOverlayFontCache();
  });

  it("높이는 화면 32px 고정(scene 은 32/zoom), 폭은 page width 그대로, 페이지와 1px 간격", () => {
    const ck = mockCk();
    const at100 = new MockCanvas();
    const at200 = new MockCanvas();
    const color = [0.1, 0.2, 0.3] as const;

    renderPageHeader(ck, at100 as unknown as Canvas, 390, 1, color, 1);
    renderPageHeader(ck, at200 as unknown as Canvas, 390, 2, color, 1);

    expect(at100.rects[0]?.rect).toEqual({
      x: 0,
      y: -(PAGE_HEADER_GAP + PAGE_HEADER_HEIGHT),
      w: 390,
      h: PAGE_HEADER_HEIGHT,
    });
    expect(at200.rects[0]?.rect).toEqual({
      x: 0,
      y: -(PAGE_HEADER_GAP + PAGE_HEADER_HEIGHT) / 2,
      w: 390,
      h: PAGE_HEADER_HEIGHT / 2,
    });
    expect(PAGE_HEADER_HEIGHT).toBe(32);
    expect(PAGE_HEADER_GAP).toBe(1);
  });

  it("alpha 는 paint 색상 4번째 채널로 전달된다 (활성 = focus-ring 30%)", () => {
    const ck = mockCk();
    const canvas = new MockCanvas();
    renderPageHeader(
      ck,
      canvas as unknown as Canvas,
      100,
      1,
      [0.5, 0.6, 0.7],
      0.3,
    );
    expect(canvas.rects[0]?.color).toEqual([0.5, 0.6, 0.7, 0.3]);
  });

  it("타이틀 텍스트는 헤더 안에 세로 중앙 + 좌측 패딩으로 놓인다", () => {
    const ck = mockCk();
    const fontMgr = mockFontMgr();
    const canvas = new MockCanvas();
    const metrics = renderPageTitle(
      ck,
      canvas as unknown as Canvas,
      "Page",
      1,
      fontMgr,
      false,
    );
    expect(metrics?.textX).toBe(PAGE_HEADER_PADDING_X);
    expect(metrics?.textTop).toBe(
      -(PAGE_HEADER_GAP + (PAGE_HEADER_HEIGHT + 12) / 2),
    );
    // 띠 안 (−33 ~ −1) 에 들어간다
    expect(metrics!.textTop).toBeGreaterThanOrEqual(
      -(PAGE_HEADER_GAP + PAGE_HEADER_HEIGHT),
    );
    expect(metrics!.textTop + metrics!.textHeight).toBeLessThanOrEqual(
      -PAGE_HEADER_GAP,
    );
  });
});
