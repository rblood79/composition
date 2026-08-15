/**
 * ADR-185 G-1 수리 — page-lifecycle entry 의 페이지 간 스택 이관.
 *
 * history 는 페이지별 스택 (`pageHistories`) 이라, 적용이 활성 페이지를
 * 바꾸는 page-lifecycle entry 는 적용 후 새 활성 페이지 스택으로 이관하지
 * 않으면 반대 방향 (undo 후 redo / redo 후 undo) 이 항상 도달 불가가 된다.
 * 여기서는 `migrateEntryToPage` 의 배치 의미론 (done/redoable) 과 index
 * 산술, 그리고 undo↔redo 왕복 도달성을 확인한다.
 */

import { describe, expect, it } from "vitest";

import {
  HistoryManager,
  type PageLifecycleHistoryPayload,
} from "../../history";

function lifecyclePayload(pageId: string): PageLifecycleHistoryPayload {
  return {
    action: "create",
    pageIndex: 0,
    page: {
      id: pageId,
      project_id: "project-1",
      title: "Page",
      slug: "/page",
      parent_id: null,
      created_at: "",
      updated_at: "",
    },
    subtreeElements: [],
    detach: [],
    positions: [],
    prevCurrentPageId: "page-A",
    nextCurrentPageId: pageId,
  };
}

function addLifecycleEntry(manager: HistoryManager, pageId: string): string {
  manager.addEntry({
    type: "page-lifecycle",
    elementId: pageId,
    data: { pageLifecycleEvent: lifecyclePayload(pageId) },
  });
  const entries = manager.getCurrentPageEntries();
  return entries[entries.length - 1].id;
}

function addUpdateEntry(manager: HistoryManager, elementId: string): string {
  manager.addEntry({
    type: "update",
    elementId,
    data: {
      canonicalEvents: [
        {
          type: "update",
          nodeId: elementId,
          prevProps: { v: 0 },
          nextProps: { v: 1 },
        } as never,
      ],
    },
  });
  const entries = manager.getCurrentPageEntries();
  return entries[entries.length - 1].id;
}

describe("HistoryManager.migrateEntryToPage (ADR-185 G-1)", () => {
  it("redoable 배치: undo 된 entry 가 대상 스택의 다음 redo 가 된다", () => {
    const manager = new HistoryManager();
    // 페이지 A 스택에 선행 entry 1건
    manager.setCurrentPage("page-A");
    addUpdateEntry(manager, "el-A1");
    // 페이지 B (생성됨) 스택에 lifecycle entry
    manager.setCurrentPage("page-B");
    const entryId = addLifecycleEntry(manager, "page-B");

    // B 에서 undo (생성 취소) → 활성이 A 로 — entry 를 A 로 이관 (redoable)
    const undone = manager.undo();
    expect(undone?.id).toBe(entryId);
    manager.migrateEntryToPage(entryId, "page-B", "page-A", "redoable");

    // B 스택에서는 사라짐
    manager.setCurrentPage("page-B");
    expect(manager.getCurrentPageEntries()).toHaveLength(0);
    expect(manager.redo()).toBeNull();

    // A 스택의 다음 redo 로 도달 가능 — 기존 완료 entry (el-A1) 는 그대로
    manager.setCurrentPage("page-A");
    const entries = manager.getCurrentPageEntries();
    expect(entries.map((entry) => entry.id)).toContain(entryId);
    const redone = manager.redo();
    expect(redone?.id).toBe(entryId);
    // redo 후에는 마지막 완료 entry — undo 하면 다시 같은 entry
    expect(manager.undo()?.id).toBe(entryId);
    // 그 아래에 A 의 기존 entry 가 남아 있다
    expect(manager.undo()?.elementId).toBe("el-A1");
  });

  it("done 배치: redo 된 entry 가 대상 스택의 마지막 완료 entry 가 된다", () => {
    const manager = new HistoryManager();
    manager.setCurrentPage("page-A");
    const entryId = addLifecycleEntry(manager, "page-B");

    // A 에서 redo 형태로 적용됐다고 가정하고 B 로 이관 (done)
    manager.migrateEntryToPage(entryId, "page-A", "page-B", "done");

    manager.setCurrentPage("page-B");
    const undone = manager.undo();
    expect(undone?.id).toBe(entryId);

    manager.setCurrentPage("page-A");
    expect(
      manager.getCurrentPageEntries().map((entry) => entry.id),
    ).not.toContain(entryId);
  });

  it("대상 스택의 기존 redo tail 은 잘린다 (선형 truncation)", () => {
    const manager = new HistoryManager();
    manager.setCurrentPage("page-A");
    addUpdateEntry(manager, "el-A1");
    const staleRedoId = addUpdateEntry(manager, "el-A2");
    manager.undo(); // el-A2 가 A 의 redo tail 로 남음

    manager.setCurrentPage("page-B");
    const entryId = addLifecycleEntry(manager, "page-B");
    manager.undo();
    manager.migrateEntryToPage(entryId, "page-B", "page-A", "redoable");

    manager.setCurrentPage("page-A");
    const ids = manager.getCurrentPageEntries().map((entry) => entry.id);
    expect(ids).not.toContain(staleRedoId);
    expect(manager.redo()?.id).toBe(entryId);
  });

  it("출발 스택에서 완료 entry 위치보다 앞의 entry 를 빼면 currentIndex 가 보정된다", () => {
    const manager = new HistoryManager();
    manager.setCurrentPage("page-A");
    const lifecycleId = addLifecycleEntry(manager, "page-B");
    const laterId = addUpdateEntry(manager, "el-A1");

    // lifecycle (index 0) 을 이관 — 완료 상태의 later entry (index 1) 가
    // index 0 으로 당겨지고 currentIndex 도 따라와야 undo 가 그 entry 를 준다
    manager.migrateEntryToPage(lifecycleId, "page-A", "page-B", "done");
    expect(manager.undo()?.id).toBe(laterId);
  });

  it("같은 페이지 / 미존재 entry 는 no-op", () => {
    const manager = new HistoryManager();
    manager.setCurrentPage("page-A");
    const entryId = addLifecycleEntry(manager, "page-B");

    manager.migrateEntryToPage(entryId, "page-A", "page-A", "done");
    manager.migrateEntryToPage("history_missing", "page-A", "page-B", "done");
    expect(manager.getCurrentPageEntries().map((entry) => entry.id)).toContain(
      entryId,
    );
  });
});
