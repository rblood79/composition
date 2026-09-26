// @vitest-environment node
/**
 * ADR-235 Phase 6 — 연결 복원 crash sentinel: 직전 복원이 끝나지 않았으면 (브라우저가 복원 중 종료)
 * 복원을 건너뛰고 연결을 해제한다 — 열 때마다 죽는 루프 금지.
 */
import { IDBFactory } from "fake-indexeddb";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const storage = new Map<string, string>();
beforeEach(() => {
  (globalThis as { indexedDB?: IDBFactory }).indexedDB = new IDBFactory();
  storage.clear();
  vi.stubGlobal("localStorage", {
    getItem: (k: string) => storage.get(k) ?? null,
    setItem: (k: string, v: string) => void storage.set(k, v),
    removeItem: (k: string) => void storage.delete(k),
  });
  vi.stubGlobal("window", {
    dispatchEvent: () => true,
    addEventListener: () => {},
    removeEventListener: () => {},
  });
  vi.stubGlobal(
    "CustomEvent",
    class extends Event {
      detail: unknown;
      constructor(type: string, init?: { detail?: unknown }) {
        super(type);
        this.detail = init?.detail;
      }
    },
  );
});
afterEach(() => vi.unstubAllGlobals());

describe("resumeProjectDirectoryLink — crash sentinel", () => {
  it("표식이 남아 있으면 복원을 건너뛰고 연결 · 표식을 지운다", async () => {
    const { resumeProjectDirectoryLink, directoryLinkFlagKey } =
      await import("../projectDirectoryLink");
    storage.set(directoryLinkFlagKey("p1"), "1");
    storage.set("composition.dir-link.resuming.p1", "1");
    const state = await resumeProjectDirectoryLink("p1", {
      collectContent: () => null,
    });
    expect(state).toMatchObject({ status: "error", error: "relink" });
    expect(storage.has(directoryLinkFlagKey("p1"))).toBe(false);
    expect(storage.has("composition.dir-link.resuming.p1")).toBe(false);
  });

  it("기록이 없으면 null · 표식은 복원 뒤 지워진다", async () => {
    const { resumeProjectDirectoryLink, directoryLinkFlagKey } =
      await import("../projectDirectoryLink");
    storage.set(directoryLinkFlagKey("p2"), "1");
    expect(
      await resumeProjectDirectoryLink("p2", { collectContent: () => null }),
    ).toBeNull();
    expect(storage.has("composition.dir-link.resuming.p2")).toBe(false);
    expect(storage.has(directoryLinkFlagKey("p2"))).toBe(false);
  });
});
