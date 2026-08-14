import { beforeEach, describe, expect, it, vi } from "vitest";
import type { CanvasKit, FontMgr } from "canvaskit-wasm";
import { acquireOverlayFont, clearOverlayFontCache } from "./selectionRenderer";

/**
 * Overlay Font 캐시 계약 (simplify 효율 항목, 2026-08-14) — 실 CanvasKit 없이 mock 으로
 * 인스턴스 재사용/무효화만 잠근다. 구 per-call `resolveOverlayTypeface + new ck.Font →
 * delete`(팬 중 ≈360회/초) 를 (fontMgr 참조, weight) 키 캐시 + `setSize` 로 대체한 계약:
 * - 같은 (fontMgr, weight) → 같은 Font 인스턴스 재사용, setSize 로 크기만 갱신
 * - weight 가 다르면 별도 인스턴스
 * - fontMgr 참조 교체 → 전체 재구축 (이전 Font/Typeface delete)
 * - typeface 미해소(폰트 로드 전) → null 반환, 미캐시 (다음 호출 재시도)
 */

class MockFont {
  size: number;
  deleted = false;
  constructor(
    public typeface: unknown,
    size: number,
  ) {
    this.size = size;
  }
  setSubpixel(): void {}
  setSize(size: number): void {
    this.size = size;
  }
  delete(): void {
    this.deleted = true;
  }
}

function mockCk(): CanvasKit {
  return {
    FontWeight: { Normal: { value: 400 }, Medium: { value: 500 } },
    FontWidth: { Normal: { value: 5 } },
    FontSlant: { Upright: { value: 0 } },
    Font: MockFont,
  } as unknown as CanvasKit;
}

function mockFontMgr(resolves = true): FontMgr {
  return {
    matchFamilyStyle: vi.fn(() => (resolves ? { delete: vi.fn() } : null)),
  } as unknown as FontMgr;
}

describe("acquireOverlayFont — (fontMgr, weight) 키 캐시 계약", () => {
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
