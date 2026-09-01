import { beforeEach, describe, expect, it, vi } from "vitest";
import type { CanonicalNode, CompositionDocument } from "@composition/shared";

import { useCanonicalDocumentStore } from "../../canonical/canonicalDocumentStore";
import { applySnapshotDocument } from "../snapshotRestore";

/**
 * ADR-923 r18m2 (2026-09-01) — 전체 문서 교체 경계 (`applySnapshotDocument`: 과거 snapshot 복원 ·
 * undo/redo 재적용 · 프로젝트 JSON 파일 가져오기) 가 boot hydrate 와 같은 정규화 체인 (origin 시드 +
 * 형태 migration) 을 통과하는지. 종전엔 어느 migration 도 안 거쳐 legacy ColorField (parent label 부재)
 * 가 store·IndexedDB 에 그대로 실렸다.
 */
const mocks = vi.hoisted(() => ({
  db: { documents: { put: vi.fn() } },
  getDB: vi.fn(),
}));

vi.mock("@/lib/db", () => ({
  getDB: mocks.getDB,
}));

function node(
  type: string,
  id: string,
  props: Record<string, unknown> = {},
  children?: CanonicalNode[],
): CanonicalNode {
  return {
    type,
    id,
    props,
    ...(children ? { children } : {}),
  } as CanonicalNode;
}

const legacyColorFieldDoc = (): CompositionDocument =>
  ({
    version: "composition-1.0",
    children: [
      node("body", "body", {}, [
        node("ColorField", "cf", { labelPosition: "top" }, [
          node("Label", "cf-l", { children: "Legacy Color" }),
          node("Input", "cf-i", { placeholder: "#000000" }),
        ]),
      ]),
    ],
  }) as CompositionDocument;

function findNode(
  nodes: readonly CanonicalNode[],
  id: string,
): CanonicalNode | undefined {
  for (const n of nodes) {
    if (n.id === id) return n;
    const f = findNode(n.children ?? [], id);
    if (f) return f;
  }
  return undefined;
}

function fakeStore() {
  const store = {
    pageGap: 100,
    pageLayoutDirection: "horizontal" as const,
    pages: [] as { id: string }[],
    currentPageId: null as string | null,
    hydrateProjectSnapshot: vi.fn(),
    initializePagePositions: vi.fn(),
    setPages: vi.fn((pages: { id: string }[]) => {
      store.pages = pages;
    }),
    activatePage: vi.fn((id: string) => {
      store.currentPageId = id;
    }),
  };
  return store;
}

describe("applySnapshotDocument (r18m2) — 전체 문서 교체도 정규화 체인을 통과한다", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getDB.mockResolvedValue(mocks.db);
    useCanonicalDocumentStore.setState({
      documents: new Map(),
      currentProjectId: null,
      documentVersion: 0,
    });
  });

  it("legacy ColorField 가 store 와 persist 양쪽에 parent label 을 가진 채 실린다 · 입력 객체는 불변", async () => {
    const store = fakeStore();
    const get = (() => store) as unknown as Parameters<
      typeof applySnapshotDocument
    >[0];
    const input = legacyColorFieldDoc();
    const inputJson = JSON.stringify(input);

    await applySnapshotDocument(get, "p1", input);

    const stored = useCanonicalDocumentStore.getState().documents.get("p1");
    expect(stored).toBeDefined();
    expect(stored).not.toBe(input);
    expect(findNode(stored!.children, "cf")!.props).toMatchObject({
      label: "Legacy Color",
    });
    // 캐시본 격리 — 입력 (snapshot 캐시 / 파일 payload) 은 손대지 않는다
    expect(JSON.stringify(input)).toBe(inputJson);

    expect(mocks.db.documents.put).toHaveBeenCalledTimes(1);
    const [projectId, persisted, options] = mocks.db.documents.put.mock
      .calls[0] as [string, CompositionDocument, Record<string, unknown>];
    expect(projectId).toBe("p1");
    expect(persisted).toBe(stored);
    expect(findNode(persisted.children, "cf")!.props).toMatchObject({
      label: "Legacy Color",
    });
    expect(options).toMatchObject({
      allowShrink: true,
      reason: "snapshot-restore",
    });

    // 파생 재구축은 정규화된 문서로 (boot hydrate 동형)
    expect(store.hydrateProjectSnapshot).toHaveBeenCalledTimes(1);
    expect(store.setPages).toHaveBeenCalledTimes(1);
  });
});
