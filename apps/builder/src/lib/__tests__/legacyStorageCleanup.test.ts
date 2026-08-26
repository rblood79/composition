import { describe, it, expect, beforeEach, vi, afterEach } from "vitest";
import {
  cleanupLegacyStorage,
  REMOVED_STORAGE_KEYS,
} from "../legacyStorageCleanup";

describe("cleanupLegacyStorage", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("목록에 있는 키를 지우고 지운 키를 돌려준다", () => {
    localStorage.setItem("composition-settings", '{"syncMode":"manual"}');

    expect(cleanupLegacyStorage()).toEqual(["composition-settings"]);
    expect(localStorage.getItem("composition-settings")).toBeNull();
  });

  it("키가 없으면 아무것도 지우지 않는다 (idempotent)", () => {
    expect(cleanupLegacyStorage()).toEqual([]);
    expect(cleanupLegacyStorage()).toEqual([]);
  });

  it("목록에 없는 키는 건드리지 않는다", () => {
    localStorage.setItem("composition-ui", '{"themeMode":"dark"}');
    localStorage.setItem("composition-locale", "ko-KR");

    cleanupLegacyStorage();

    expect(localStorage.getItem("composition-ui")).toBe('{"themeMode":"dark"}');
    expect(localStorage.getItem("composition-locale")).toBe("ko-KR");
  });

  it("저장소 접근이 throw 해도 앱 시작을 막지 않는다", () => {
    vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
      throw new Error("SecurityError: storage disabled");
    });

    expect(() => cleanupLegacyStorage()).not.toThrow();
    expect(cleanupLegacyStorage()).toEqual([]);
  });

  it("제거 목록에 죽은 키만 담겨 있다 (살아 있는 키 오염 방지)", () => {
    // 2026-08-26 라이브 빌더 localStorage 실측. 새 키가 생기면 여기도 갱신한다.
    const LIVE_KEYS = [
      "builder-breakpoint",
      "builder.workspace.breakpoint-viewports.v1",
      "builder.workspace.compare-split.v1",
      "composition-auth-dev",
      "composition-locale",
      "composition-panel-layout",
      "composition-ui",
      "composition_favorite_components",
      "composition_recent_components",
      "composition_recent_searches",
      "styles-panel-collapse",
      "theme",
    ];

    for (const key of REMOVED_STORAGE_KEYS) {
      expect(LIVE_KEYS).not.toContain(key);
    }
  });
});
