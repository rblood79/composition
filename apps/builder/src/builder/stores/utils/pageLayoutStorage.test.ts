import { describe, expect, it } from "vitest";
import { PAGE_STACK_GAP } from "../../workspace/canvas/pageLayoutConstants";
import {
  DEFAULT_PAGE_LAYOUT_SETTINGS,
  PAGE_LAYOUT_STORAGE_KEY,
  normalizePageLayoutSettings,
  readPageLayoutSettings,
  writePageLayoutSettings,
} from "./pageLayoutStorage";

function memoryStorage(initial: Record<string, string> = {}) {
  const map = new Map(Object.entries(initial));
  return {
    getItem: (key: string) => map.get(key) ?? null,
    setItem: (key: string, value: string) => {
      map.set(key, value);
    },
    dump: () => Object.fromEntries(map),
  };
}

describe("pageLayoutStorage — Settings Page layout · Page gap 영속", () => {
  it("저장소 없음 → 기본값 (auto · PAGE_STACK_GAP)", () => {
    expect(readPageLayoutSettings(null)).toEqual(DEFAULT_PAGE_LAYOUT_SETTINGS);
    expect(DEFAULT_PAGE_LAYOUT_SETTINGS).toEqual({
      direction: "auto",
      gap: PAGE_STACK_GAP,
    });
  });

  it("round-trip: write 후 read 가 같은 값", () => {
    const storage = memoryStorage();
    const settings = { direction: "vertical", gap: 200 } as const;
    expect(writePageLayoutSettings(settings, storage)).toBe(true);
    expect(readPageLayoutSettings(storage)).toEqual(settings);
    expect(storage.dump()[PAGE_LAYOUT_STORAGE_KEY]).toBe(
      JSON.stringify(settings),
    );
  });

  it("파싱 실패·스키마 불일치는 필드 단위로 기본값 대체", () => {
    expect(
      readPageLayoutSettings(
        memoryStorage({ [PAGE_LAYOUT_STORAGE_KEY]: "{oops" }),
      ),
    ).toEqual(DEFAULT_PAGE_LAYOUT_SETTINGS);
    // 구 zigzag 는 auto 로 (normalizePageLayoutDirection) · 음수/NaN gap 은 기본값
    expect(
      normalizePageLayoutSettings({ direction: "zigzag", gap: -5 }),
    ).toEqual({ direction: "auto", gap: PAGE_STACK_GAP });
    expect(
      normalizePageLayoutSettings({ direction: "horizontal", gap: "12" }),
    ).toEqual({ direction: "horizontal", gap: PAGE_STACK_GAP });
    expect(normalizePageLayoutSettings({ gap: 0 })).toEqual({
      direction: "auto",
      gap: 0,
    });
  });

  it("setItem 이 던지면 false — 호출자는 메모리 값을 유지한다", () => {
    const storage = {
      setItem: () => {
        throw new Error("quota");
      },
    };
    expect(
      writePageLayoutSettings({ direction: "auto", gap: 80 }, storage),
    ).toBe(false);
  });
});
