// @vitest-environment jsdom
/**
 * ADR-152 Phase 1c R9 — `type:"data"` entry 는 undo/redo/goToIndex 에서 element
 * 경로에 도달하지 않는다 (early-branch). collection 은 되돌아가고 element 축
 * (elements · canonical 문서) 은 무변경. 요소 편집 entry 와 섞여도 각자 되돌아간다.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { DataTable } from "../../../types/builder/data.types";
import { historyManager } from "../history";
import { useStore } from "../index";
import { useDataStore } from "../data";
import * as canonicalHistoryEvents from "./canonicalHistoryEvents";

vi.mock("../../../lib/db", () => ({
  getDB: vi.fn(async () => ({
    documents: { put: vi.fn() },
    collections: {
      insert: vi.fn(async (dt: DataTable) => dt),
      update: vi.fn(async () => ({})),
      delete: vi.fn(async () => undefined),
    },
  })),
}));
const users = (): DataTable => ({
  id: "c1",
  name: "Users",
  project_id: "p",
  schema: [{ id: "f_name", key: "name", type: "string" }],
  mockData: [{ name: "a" }, { name: "b" }],
  useMockData: true,
});

const rows = () => useDataStore.getState().collections.get("c1")?.mockData;

describe("historyActions — data entry early-branch (R9)", () => {
  let applyCanonical: ReturnType<typeof vi.spyOn>;
  beforeEach(() => {
    historyManager.clearAllHistory();
    historyManager.setCurrentPage("page-1");
    useStore.setState({
      elements: [],
      elementsMap: new Map(),
      selectedElementId: null,
      selectedElementProps: {},
      currentPageId: "page-1",
    } as never);
    useDataStore.setState({ collections: new Map([["c1", users()]]) } as never);
    applyCanonical = vi.spyOn(
      canonicalHistoryEvents,
      "applyCanonicalHistoryEventsToActiveDocument",
    );
    vi.spyOn(console, "warn").mockImplementation(() => undefined);
  });
  afterEach(() => {
    vi.restoreAllMocks();
    historyManager.clearAllHistory();
  });

  it("셀 편집 → undo 원상 → redo 재적용; element 경로 · elements 무변경", async () => {
    await useDataStore.getState().updateCollection("c1", {
      mockData: [{ name: "A" }, { name: "b" }],
    });
    expect(rows()).toEqual([{ name: "A" }, { name: "b" }]);
    const entries = historyManager.getCurrentPageEntries();
    expect(entries).toHaveLength(1);
    expect(entries[0].type).toBe("data");

    await useStore.getState().undo();
    expect(rows()).toEqual([{ name: "a" }, { name: "b" }]);
    await useStore.getState().redo();
    expect(rows()).toEqual([{ name: "A" }, { name: "b" }]);

    expect(applyCanonical).not.toHaveBeenCalled();
    expect(useStore.getState().elements).toEqual([]);
    expect(useStore.getState().historyOperationInProgress).toBe(false);
  });

  it("4종 편집 (셀 · 행 삭제 · CSV 교체 · rename) → ⌘Z 4회 원상 · ⌘⇧Z 4회 재적용 (G5 unit 판)", async () => {
    const store = useDataStore.getState();
    await store.updateCollection("c1", {
      mockData: [{ name: "A" }, { name: "b" }],
    });
    await store.updateCollection("c1", { mockData: [{ name: "A" }] });
    await store.updateCollection("c1", {
      mockData: [{ name: "x" }, { name: "y" }, { name: "z" }],
    });
    await store.updateCollection("c1", {
      schema: [{ id: "f_name", key: "fullName", type: "string" }],
      mockData: [{ fullName: "x" }, { fullName: "y" }, { fullName: "z" }],
    });
    const final = useDataStore.getState().collections.get("c1")!;
    expect(final.schema[0].key).toBe("fullName");
    expect(historyManager.getCurrentPageEntries().map((e) => e.type)).toEqual([
      "data",
      "data",
      "data",
      "data",
    ]);

    for (let i = 0; i < 4; i++) await useStore.getState().undo();
    const restored = useDataStore.getState().collections.get("c1")!;
    expect(restored.schema[0].key).toBe("name");
    expect(restored.mockData).toEqual([{ name: "a" }, { name: "b" }]);

    for (let i = 0; i < 4; i++) await useStore.getState().redo();
    const again = useDataStore.getState().collections.get("c1")!;
    expect(again.schema[0].key).toBe("fullName");
    expect(again.mockData).toEqual([
      { fullName: "x" },
      { fullName: "y" },
      { fullName: "z" },
    ]);
    expect(applyCanonical).not.toHaveBeenCalled();
  });

  it("goToIndex 로 data entry 를 건너뛰어도 collection 만 움직인다", async () => {
    const store = useDataStore.getState();
    await store.updateCollection("c1", {
      mockData: [{ name: "A" }, { name: "b" }],
    });
    await store.updateCollection("c1", { name: "People" });
    await useStore.getState().goToHistoryIndex(-1);
    expect(useDataStore.getState().collections.get("c1")).toMatchObject({
      name: "Users",
      mockData: [{ name: "a" }, { name: "b" }],
    });
    await useStore.getState().goToHistoryIndex(1);
    expect(useDataStore.getState().collections.get("c1")).toMatchObject({
      name: "People",
      mockData: [{ name: "A" }, { name: "b" }],
    });
    expect(applyCanonical).not.toHaveBeenCalled();
  });

  // ADR-013 Phase 2 — Table 컬럼: data entry 가 canonicalEvents 를 같이 실으면 (생성+연결 +
  //   Column 삽입 = 한 사용자 실행) undo/redo/goToIndex 가 collection 축 **과** element 축을
  //   함께 되돌린다. canonicalEvents 없는 data entry 는 종전 early-branch 그대로.
  it("canonicalEvents 를 실은 data entry 는 두 축을 함께 — undo/redo/goToIndex 모두 element 경로 진입", async () => {
    await useDataStore.getState().updateCollection("c1", {
      mockData: [{ name: "A" }, { name: "b" }],
    });
    // 두 번째 entry: data 역연산 + canonical insert 이벤트 (요소는 mock — 적용기는 spy)
    const events = [
      {
        type: "insert",
        nodeId: "col-1",
        parentId: "th-1",
        index: 0,
        node: { id: "col-1", type: "Column", props: {} },
      },
    ] as unknown as canonicalHistoryEvents.CanonicalHistoryNodeEvent[];
    applyCanonical.mockReturnValue(null as never);
    historyManager.addEntry({
      type: "data",
      elementId: "c1",
      elementIds: ["c1", "col-1"],
      data: {
        dataChangeEvent: {
          change: {
            ops: [
              {
                op: "update_collection",
                collectionId: "c1",
                patch: { name: "People" },
              },
            ],
            origin: "user",
          },
          inverse: [
            {
              op: "update_collection",
              collectionId: "c1",
              patch: { name: "Users" },
            },
          ],
        },
        canonicalEvents: events,
      },
    });
    await useDataStore
      .getState()
      .applyDataChange(
        {
          ops: [
            {
              op: "update_collection",
              collectionId: "c1",
              patch: { name: "People" },
            },
          ],
          origin: "user",
        },
        { record: false },
      );

    await useStore.getState().undo();
    expect(useDataStore.getState().collections.get("c1")?.name).toBe("Users");
    expect(applyCanonical).toHaveBeenCalledWith(events, "undo");

    await useStore.getState().redo();
    expect(useDataStore.getState().collections.get("c1")?.name).toBe("People");
    expect(applyCanonical).toHaveBeenCalledWith(events, "redo");

    applyCanonical.mockClear();
    await useStore.getState().goToHistoryIndex(0);
    expect(useDataStore.getState().collections.get("c1")?.name).toBe("Users");
    expect(applyCanonical).toHaveBeenCalledWith(events, "undo");
    // 첫 entry (canonicalEvents 없음) 는 여전히 element 경로 미진입
    await useStore.getState().goToHistoryIndex(-1);
    expect(applyCanonical).toHaveBeenCalledTimes(1);
    expect(useStore.getState().historyOperationInProgress).toBe(false);
  });
});
