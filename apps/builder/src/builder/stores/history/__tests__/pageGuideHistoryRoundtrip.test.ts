// @vitest-environment jsdom
/**
 * ADR-181 Phase 3 — `page-guide` entry 의 undo/redo/goToIndex 왕복.
 *
 * 여기서 확인하는 것은 **실제 store 액션**이 분기를 타는가다. 정적 가드
 * (`historyActions.static.test.ts`)가 분기의 *존재*를 잠근다면, 이 파일은 그
 * 분기가 문서를 맞게 되돌리는지를 본다.
 *
 * `page-position` 과 갈리는 지점 두 가지를 특히 본다:
 * - 스토어 미러가 없다 → canonical `pageGuides` 만 왕복한다
 * - 목록 **전체**가 before/after 라 생성·이동·삭제가 한 어법으로 처리된다
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { CompositionDocument, PageGuideLine } from "@composition/shared";

import {
  registerCanonicalMutationStoreActions,
  resetCanonicalMutationStoreActions,
} from "@/adapters/canonical/canonicalMutations";
import { useCanonicalDocumentStore } from "../../canonical/canonicalDocumentStore";
import { historyManager } from "../../history";
import { useStore } from "../../index";
import {
  getPageGuideRevision,
  resetPageGuideRevisionForTest,
} from "../../../workspace/canvas/interaction/pageGuideRevision";
import { commitPageGuideChanges } from "../../../workspace/canvas/viewport/pageGuideActions";

vi.mock("../../../../lib/db", () => ({
  getDB: vi.fn(async () => ({ documents: { put: vi.fn() } })),
}));

vi.mock("../../../../env/supabase.client", () => ({
  supabase: { from: vi.fn() },
}));

const PROJECT_ID = "guide-project";

const g = (id: string, axis: "x" | "y", position: number): PageGuideLine => ({
  id,
  axis,
  position,
});

function currentGuides(
  pageId: string,
  breakpoint = "desktop",
): PageGuideLine[] | undefined {
  const doc = useCanonicalDocumentStore.getState().getDocument(PROJECT_ID);
  return doc?.pageGuides?.[pageId]?.[breakpoint as "desktop"];
}

function seed(pageIds: string[]): void {
  const doc: CompositionDocument = {
    version: "composition-1.0",
    children: [],
  };
  useCanonicalDocumentStore.getState().setDocument(PROJECT_ID, doc);
  useCanonicalDocumentStore.getState().setCurrentProject(PROJECT_ID);
  useStore.setState({
    elements: [],
    elementsMap: new Map(),
    currentPageId: pageIds[0],
    pages: pageIds.map((id) => ({ id, title: id, project_id: PROJECT_ID })),
  } as never);
}

describe("ADR-181: page-guide entry undo/redo 왕복", () => {
  beforeEach(() => {
    historyManager.clearAllHistory();
    historyManager.setCurrentPage("page-1");
    useCanonicalDocumentStore.setState({
      documents: new Map(),
      currentProjectId: null,
      documentVersion: 0,
    });
    resetPageGuideRevisionForTest();
    registerCanonicalMutationStoreActions({
      getCurrentProjectId: () => PROJECT_ID,
      getCurrentLegacySnapshot: () => ({
        elements: useStore.getState().elements,
        pages: [],
        layouts: [],
      }),
    });
  });

  afterEach(() => {
    resetCanonicalMutationStoreActions();
    historyManager.clearAllHistory();
  });

  it("생성 → undo 로 목록이 비고 → redo 로 되살아난다", async () => {
    seed(["page-1"]);
    commitPageGuideChanges([
      {
        pageId: "page-1",
        breakpoint: "desktop",
        before: [],
        after: [g("a", "x", 100)],
      },
    ]);
    expect(currentGuides("page-1")).toEqual([g("a", "x", 100)]);

    await useStore.getState().undo();
    // 빈 목록은 entry 제거로 표현된다 (C9 — 부재 == 빈 목록)
    expect(currentGuides("page-1")).toBeUndefined();

    await useStore.getState().redo();
    expect(currentGuides("page-1")).toEqual([g("a", "x", 100)]);
  });

  it("이동 → undo 가 이전 좌표를 복원 (목록 전체 교체)", async () => {
    seed(["page-1"]);
    commitPageGuideChanges([
      {
        pageId: "page-1",
        breakpoint: "desktop",
        before: [],
        after: [g("a", "x", 100), g("b", "y", 40)],
      },
    ]);
    commitPageGuideChanges([
      {
        pageId: "page-1",
        breakpoint: "desktop",
        before: [g("a", "x", 100), g("b", "y", 40)],
        after: [g("a", "x", 260), g("b", "y", 40)],
      },
    ]);

    await useStore.getState().undo();
    expect(currentGuides("page-1")).toEqual([
      g("a", "x", 100),
      g("b", "y", 40),
    ]);

    await useStore.getState().redo();
    expect(currentGuides("page-1")).toEqual([
      g("a", "x", 260),
      g("b", "y", 40),
    ]);
  });

  it("삭제 → undo 가 목록을 되살린다", async () => {
    seed(["page-1"]);
    commitPageGuideChanges([
      {
        pageId: "page-1",
        breakpoint: "desktop",
        before: [],
        after: [g("a", "x", 100)],
      },
    ]);
    commitPageGuideChanges([
      {
        pageId: "page-1",
        breakpoint: "desktop",
        before: [g("a", "x", 100)],
        after: [],
      },
    ]);
    expect(currentGuides("page-1")).toBeUndefined();

    await useStore.getState().undo();
    expect(currentGuides("page-1")).toEqual([g("a", "x", 100)]);
  });

  it("breakpoint 가 다르면 서로 건드리지 않는다 (C9)", async () => {
    seed(["page-1"]);
    commitPageGuideChanges([
      {
        pageId: "page-1",
        breakpoint: "desktop",
        before: [],
        after: [g("a", "x", 100)],
      },
    ]);
    commitPageGuideChanges([
      {
        pageId: "page-1",
        breakpoint: "mobile",
        before: [],
        after: [g("m", "x", 20)],
      },
    ]);

    await useStore.getState().undo(); // mobile 만 되돌린다
    expect(currentGuides("page-1", "mobile")).toBeUndefined();
    expect(currentGuides("page-1", "desktop")).toEqual([g("a", "x", 100)]);
  });

  it("삭제된 페이지 항목만 건너뛴다 (같은 entry 의 생존 페이지는 되돌린다)", async () => {
    seed(["page-1", "page-2"]);
    commitPageGuideChanges([
      {
        pageId: "page-1",
        breakpoint: "desktop",
        before: [],
        after: [g("a", "x", 100)],
      },
      {
        pageId: "page-2",
        breakpoint: "desktop",
        before: [],
        after: [g("b", "y", 40)],
      },
    ]);

    // page-2 를 없앤 뒤 undo — 생존 페이지는 되돌아가고 삭제 페이지는 그대로
    // (되살리면 소유자 없는 데이터가 남는다)
    useStore.setState({
      pages: [{ id: "page-1", title: "page-1", project_id: PROJECT_ID }],
    } as never);
    await useStore.getState().undo();
    expect(currentGuides("page-1")).toBeUndefined();
    expect(currentGuides("page-2")).toEqual([g("b", "y", 40)]);
  });

  it("undo/redo 도 개정 카운터를 올린다 (C11 (c) — 오버레이 재렌더)", async () => {
    seed(["page-1"]);
    commitPageGuideChanges([
      {
        pageId: "page-1",
        breakpoint: "desktop",
        before: [],
        after: [g("a", "x", 100)],
      },
    ]);
    expect(getPageGuideRevision()).toBe(1);

    await useStore.getState().undo();
    expect(getPageGuideRevision()).toBe(2);

    await useStore.getState().redo();
    expect(getPageGuideRevision()).toBe(3);
  });

  it("goToHistoryIndex 로 여러 단계를 건너뛰어도 최종 상태가 맞는다", async () => {
    seed(["page-1"]);
    commitPageGuideChanges([
      {
        pageId: "page-1",
        breakpoint: "desktop",
        before: [],
        after: [g("a", "x", 10)],
      },
    ]);
    commitPageGuideChanges([
      {
        pageId: "page-1",
        breakpoint: "desktop",
        before: [g("a", "x", 10)],
        after: [g("a", "x", 20)],
      },
    ]);
    commitPageGuideChanges([
      {
        pageId: "page-1",
        breakpoint: "desktop",
        before: [g("a", "x", 20)],
        after: [g("a", "x", 30)],
      },
    ]);

    await useStore.getState().goToHistoryIndex(0);
    expect(currentGuides("page-1")).toEqual([g("a", "x", 10)]);

    await useStore.getState().goToHistoryIndex(2);
    expect(currentGuides("page-1")).toEqual([g("a", "x", 30)]);
  });
});
