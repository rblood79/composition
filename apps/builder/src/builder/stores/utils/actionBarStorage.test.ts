import { describe, expect, it } from "vitest";
import {
  ACTION_BAR_STORAGE_KEY,
  DEFAULT_ACTION_BAR_SETTINGS,
  normalizeActionBarSettings,
  readActionBarSettings,
  writeActionBarSettings,
} from "./actionBarStorage";

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

describe("actionBarStorage — ADR-192 Phase 3", () => {
  it("저장소 없음 → 기본값 (숨김 X · 고정 X · 기본 위치)", () => {
    expect(readActionBarSettings(null)).toEqual(DEFAULT_ACTION_BAR_SETTINGS);
  });

  it("round-trip: write 후 read 가 같은 값", () => {
    const storage = memoryStorage();
    const settings = {
      hidden: true,
      pinned: true,
      offset: { dx: -40, dy: -12 },
    };
    expect(writeActionBarSettings(settings, storage)).toBe(true);
    expect(readActionBarSettings(storage)).toEqual(settings);
  });

  it("파싱 실패·스키마 불일치는 필드 단위로 기본값 대체", () => {
    expect(
      readActionBarSettings(
        memoryStorage({ [ACTION_BAR_STORAGE_KEY]: "{oops" }),
      ),
    ).toEqual(DEFAULT_ACTION_BAR_SETTINGS);
    expect(
      normalizeActionBarSettings({
        hidden: "yes",
        pinned: 1,
        offset: { dx: "a" },
      }),
    ).toEqual({ hidden: false, pinned: false, offset: null });
    expect(
      normalizeActionBarSettings({ offset: { dx: Infinity, dy: 0 } }).offset,
    ).toBeNull();
  });

  it("setItem 이 throw 하면 false — 호출부는 메모리 상태만 유지", () => {
    const throwing = {
      setItem: () => {
        throw new Error("quota");
      },
    };
    expect(writeActionBarSettings(DEFAULT_ACTION_BAR_SETTINGS, throwing)).toBe(
      false,
    );
  });
});
