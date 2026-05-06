/**
 * @fileoverview canonicalDocumentSync unit tests — ADR-116 direct cutover
 *
 * direct cutover 이후 이 모듈은 legacy snapshot projection sync 를 수행하지 않고
 * canonical store 의 active project lifecycle 만 관리한다.
 */

import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { useCanonicalDocumentStore } from "../canonicalDocumentStore";
import {
  isSyncScheduled,
  resetSyncScheduler,
  setSyncScheduler,
  startCanonicalDocumentSync,
} from "../canonicalDocumentSync";

// ─────────────────────────────────────────────
// Test setup
// ─────────────────────────────────────────────

let stopSync: (() => void) | null = null;

function resetCanonicalStore(): void {
  useCanonicalDocumentStore.setState({
    documents: new Map(),
    currentProjectId: null,
    documentVersion: 0,
  });
}

beforeEach(() => {
  resetCanonicalStore();
  // immediate scheduler — microtask flush 대기 없이 결과 검증.
  setSyncScheduler((cb) => cb());
});

afterEach(() => {
  if (stopSync) {
    stopSync();
    stopSync = null;
  }
  resetSyncScheduler();
  resetCanonicalStore();
});

// ─────────────────────────────────────────────
// A. Lifecycle
// ─────────────────────────────────────────────

describe("startCanonicalDocumentSync(projectId) — lifecycle", () => {
  it("start 시 projectId 즉시 set, projection document 는 생성하지 않는다", () => {
    stopSync = startCanonicalDocumentSync("proj-a");

    const canonical = useCanonicalDocumentStore.getState();
    expect(canonical.currentProjectId).toBe("proj-a");
    expect(canonical.documents.has("proj-a")).toBe(false);
  });

  it("이미 같은 projectId 면 documentVersion 변경 없음", () => {
    useCanonicalDocumentStore.getState().setCurrentProject("proj-a");
    const versionBefore = useCanonicalDocumentStore.getState().documentVersion;

    stopSync = startCanonicalDocumentSync("proj-a");

    const canonical = useCanonicalDocumentStore.getState();
    expect(canonical.currentProjectId).toBe("proj-a");
    expect(canonical.documentVersion).toBe(versionBefore);
  });

  it("stop 후 canonical store currentProjectId reset 외 변경 없음", () => {
    const stop = startCanonicalDocumentSync("proj-a");
    const versionBefore = useCanonicalDocumentStore.getState().documentVersion;
    stop();

    const versionAfter = useCanonicalDocumentStore.getState().documentVersion;
    expect(versionAfter).toBe(versionBefore);
  });

  it("stop 시 canonical store currentProjectId reset (null)", () => {
    const stop = startCanonicalDocumentSync("proj-a");
    expect(useCanonicalDocumentStore.getState().currentProjectId).toBe(
      "proj-a",
    );

    stop();
    expect(useCanonicalDocumentStore.getState().currentProjectId).toBeNull();
  });

  it("isSyncScheduled — immediate scheduler 로 schedule 즉시 false", () => {
    stopSync = startCanonicalDocumentSync("proj-a");
    expect(isSyncScheduled()).toBe(false);
  });
});

// ─────────────────────────────────────────────
// B. Projection sync removed
// ─────────────────────────────────────────────

describe("projection sync removed", () => {
  it("start 만으로 documents map 을 채우지 않는다", () => {
    stopSync = startCanonicalDocumentSync("proj-a");
    const canonical = useCanonicalDocumentStore.getState();
    expect(canonical.documents.size).toBe(0);
    expect(canonical.documentVersion).toBe(0);
  });

  it("scheduler diagnostics surface 는 no-op 으로 유지된다", () => {
    resetSyncScheduler();
    stopSync = startCanonicalDocumentSync("proj-a");
    expect(isSyncScheduled()).toBe(false);
  });
});
