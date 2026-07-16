/**
 * @fileoverview SkiaFontManager.warmFontMgr() — 프레임 밖 FontMgr 선재구축 계약
 *
 * getFontMgr() 의 lazy 재구축(FromData 전체 재파싱, 수백 ms)이 rAF 프레임
 * 안에서 지불되는 것을 방지하기 위해, 폰트 배치 로드 종료 지점에서
 * warmFontMgr() 로 선재구축한다. 이 테스트는 다음 계약을 고정한다:
 *
 * 1. warmFontMgr() 후 getFontMgr() 는 FromData 를 다시 호출하지 않는다 (캐시 히트)
 * 2. 폰트 미로드 상태의 warmFontMgr() 는 아무것도 하지 않는다 (throw 금지)
 * 3. 재구축 후 폰트 추가 → dirty 재세팅 → warmFontMgr() 가 다시 재구축한다
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

const { fromDataMock } = vi.hoisted(() => {
  const makeFontMgr = () => ({
    countFamilies: () => 1,
    getFamilyName: () => "MockEmbeddedName",
    delete: vi.fn(),
  });
  return { fromDataMock: vi.fn(() => makeFontMgr()) };
});

vi.mock("../initCanvasKit", () => ({
  getCanvasKit: () => ({
    Typeface: {
      MakeFreeTypeFaceFromData: () => ({ delete: vi.fn() }),
    },
    FontMgr: { FromData: fromDataMock },
  }),
}));

import { SkiaFontManager } from "../fontManager";

describe("SkiaFontManager.warmFontMgr", () => {
  beforeEach(() => {
    fromDataMock.mockClear();
  });

  it("선재구축 후 getFontMgr() 는 FromData 재호출 없이 캐시를 반환한다", () => {
    const fm = new SkiaFontManager();
    fm.loadFontFromBuffer("TestFont", new ArrayBuffer(8));

    fm.warmFontMgr();
    const callsAfterWarm = fromDataMock.mock.calls.length;
    expect(callsAfterWarm).toBeGreaterThan(0);

    // 렌더 루프의 프레임 내 호출을 모사 — 재구축이 일어나면 안 된다
    const mgr1 = fm.getFontMgr();
    const mgr2 = fm.getFontMgr();
    expect(fromDataMock.mock.calls.length).toBe(callsAfterWarm);
    expect(mgr1).toBe(mgr2);
  });

  it("폰트 미로드 상태에서는 no-op (throw 하지 않는다)", () => {
    const fm = new SkiaFontManager();
    expect(() => fm.warmFontMgr()).not.toThrow();
    expect(fromDataMock).not.toHaveBeenCalled();
  });

  it("폰트 추가로 dirty 재세팅 시 warmFontMgr() 가 다시 재구축한다", () => {
    const fm = new SkiaFontManager();
    fm.loadFontFromBuffer("FontA", new ArrayBuffer(8));
    fm.warmFontMgr();
    const afterFirstWarm = fromDataMock.mock.calls.length;

    fm.loadFontFromBuffer("FontB", new ArrayBuffer(8));
    fm.warmFontMgr();
    // FontB 로드의 이름 추출(temp FromData) + 재구축으로 호출 수 증가
    expect(fromDataMock.mock.calls.length).toBeGreaterThan(afterFirstWarm);

    // 재구축 완료 후 프레임 내 getFontMgr() 는 캐시 히트
    const stable = fromDataMock.mock.calls.length;
    fm.getFontMgr();
    expect(fromDataMock.mock.calls.length).toBe(stable);
  });
});
