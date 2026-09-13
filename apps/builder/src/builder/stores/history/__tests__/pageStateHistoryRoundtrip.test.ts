// @vitest-environment jsdom
/**
 * ADR-214 Phase 5 — 페이지 변수 정의 (`setPageState`) 가 `page-state` History entry 로
 * undo/redo 된다 (page-title 과 같은 비-element 축 early-branch).
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { CompositionDocument, VariableDef } from "@composition/shared";

import { useCanonicalDocumentStore } from "../../canonical/canonicalDocumentStore";
import { historyManager } from "../../history";
import { useStore } from "../../elements";

vi.mock("../../../../lib/db", () => ({
  getDB: vi.fn(async () => ({ documents: { put: vi.fn() } })),
}));

const PROJECT_ID = "page-state-project";
const PAGE_ID = "page-1";

function currentPageState(): VariableDef[] | undefined {
  return useCanonicalDocumentStore
    .getState()
    .getDocument(PROJECT_ID)
    ?.children.find((node) => node.id === PAGE_ID)?.state;
}

function seed(): void {
  const doc: CompositionDocument = {
    version: "composition-1.0",
    children: [
      {
        id: PAGE_ID,
        type: "frame",
        name: "Home",
        metadata: { type: "legacy-page", slug: "/" },
        children: [],
      },
    ],
  };
  useCanonicalDocumentStore.getState().setDocument(PROJECT_ID, doc);
  useCanonicalDocumentStore.getState().setCurrentProject(PROJECT_ID);
  useStore.setState({
    pages: [
      { id: PAGE_ID, title: "Home", slug: "/", project_id: PROJECT_ID, parent_id: null },
    ],
    currentPageId: PAGE_ID,
    elements: [],
    elementsMap: new Map(),
  } as never);
}

const filter: VariableDef = { id: "v-filter", name: "filter", type: "string", defaultValue: "" };

describe("page state history roundtrip (ADR-214 Phase 5)", () => {
  beforeEach(() => {
    historyManager.clearAllHistory();
    historyManager.setCurrentPage(PAGE_ID);
    useCanonicalDocumentStore.setState({
      documents: new Map(),
      currentProjectId: null,
      documentVersion: 0,
    });
    seed();
  });

  afterEach(() => {
    historyManager.clearAllHistory();
  });

  it("추가 → undo (정의 제거) → redo (복원) · 같은 정의 재쓰기는 entry 0", async () => {
    expect(useStore.getState().setPageState(PAGE_ID, [filter])).toBe(true);
    expect(currentPageState()).toEqual([filter]);
    expect(historyManager.getCurrentPageEntries()).toHaveLength(1);
    expect(historyManager.getCurrentPageEntries()[0]?.type).toBe("page-state");

    expect(useStore.getState().setPageState(PAGE_ID, [filter])).toBe(false);
    expect(historyManager.getCurrentPageEntries()).toHaveLength(1);

    await useStore.getState().undo();
    expect(currentPageState()).toBeUndefined();

    await useStore.getState().redo();
    expect(currentPageState()).toEqual([filter]);
  });

  it("skipHistory 옵션 (런타임 · 하니스 경로) 은 entry 를 남기지 않는다", () => {
    expect(useStore.getState().setPageState(PAGE_ID, [filter], { skipHistory: true })).toBe(true);
    expect(historyManager.getCurrentPageEntries()).toHaveLength(0);
  });
});
