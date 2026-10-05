/**
 * 2026-10-05 감사 L3 — DB open 이 한 번 실패해도 (예: 새 빌드 탭이 버전을 올린 뒤 옛 탭의
 * VersionError) 다음 `getDB()` 는 다시 연다. 실패한 promise 를 그대로 돌려주면 그 세션 내내
 * 데이터 저장 · 삭제가 전부 실패했다.
 */
import { describe, expect, it, vi } from "vitest";

const init = vi.fn();
vi.mock("../indexedDB/adapter", () => ({
  IndexedDBAdapter: class {
    init = init;
  },
}));

const { getDB } = await import("../index");

describe("getDB — 초기화 실패 뒤 재시도", () => {
  it("첫 open 이 실패하면 다음 호출이 새로 연다", async () => {
    init.mockRejectedValueOnce(new Error("VersionError"));
    init.mockResolvedValueOnce(undefined);
    await expect(getDB()).rejects.toThrow("VersionError");
    await expect(getDB()).resolves.toBeDefined();
    expect(init).toHaveBeenCalledTimes(2);
  });
});
