// @vitest-environment jsdom
/**
 * R1 call site 전환 검증 — 실제 store 액션이 canonicalEvents 부착 entry 를
 * 생성하고, undo/redo 가 canonical document 를 정확히 round-trip 하는지.
 *
 * 핵심 불변식: canonical doc → mutation → undo → 원본 props deep-equal.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { CanonicalNode, CompositionDocument } from "@composition/shared";

import {
  registerCanonicalMutationStoreActions,
  resetCanonicalMutationStoreActions,
} from "@/adapters/canonical/canonicalMutations";
import { buildLegacyElementMetadata } from "@/adapters/canonical/legacyMetadata";
import type { Element } from "../../../../types/core/store.types";
import { useCanonicalDocumentStore } from "../../canonical/canonicalDocumentStore";
import { historyManager } from "../../history";
import type { HistoryEntry } from "../../history";
import { useStore } from "../../index";
import { trackBatchUpdate } from "../../utils/historyHelpers";
import {
  migrateV1EntryToV2,
  type LegacyV1SnapshotData,
} from "../historyEntryMigration";

function legacyRead(entry: HistoryEntry): LegacyV1SnapshotData {
  return entry.data as LegacyV1SnapshotData;
}

/** 테스트용 v1 fixture → IDB 경계와 같이 migrate 후 addEntry. */
function addMigratedV1Entry(
  partial: Omit<HistoryEntry, "id" | "timestamp"> & {
    data: HistoryEntry["data"] & LegacyV1SnapshotData;
  },
): void {
  const migrated = migrateV1EntryToV2({
    id: "fixture",
    timestamp: 0,
    ...partial,
  } as HistoryEntry);
  historyManager.addEntry({
    type: migrated.type,
    elementId: migrated.elementId,
    elementIds: migrated.elementIds,
    data: migrated.data,
  });
}

vi.mock("../../../../lib/db", () => ({
  getDB: vi.fn(async () => ({
    documents: {
      put: vi.fn(),
    },
  })),
}));

vi.mock("../../../../env/supabase.client", () => ({
  supabase: {
    from: vi.fn(),
  },
}));

function makeElement(
  id: string,
  props: Record<string, unknown>,
  overrides: Partial<Element> = {},
): Element {
  return {
    id,
    type: "Text",
    parent_id: null,
    page_id: null,
    order_num: 0,
    props,
    ...overrides,
  } as Element;
}

function makeDocument(elements: Element[]): CompositionDocument {
  return {
    version: "composition-1.0",
    children: elements.map((element) => ({
      id: element.id,
      type: element.type as CanonicalNode["type"],
      props: element.props as Record<string, unknown>,
      metadata: buildLegacyElementMetadata(element),
      children: [],
    })),
  };
}

function getCanonicalProps(elementId: string): Record<string, unknown> {
  const doc = useCanonicalDocumentStore
    .getState()
    .getDocument("history-project");
  const node = doc?.children.find((child) => child.id === elementId);
  return (node?.props ?? {}) as Record<string, unknown>;
}

function lastEntry() {
  const entries = historyManager.getCurrentPageEntries();
  return entries[entries.length - 1];
}

function seed(elements: Element[]): void {
  useCanonicalDocumentStore
    .getState()
    .setDocument("history-project", makeDocument(elements));
  useCanonicalDocumentStore.getState().setCurrentProject("history-project");
  useStore.setState({
    elements,
    elementsMap: new Map(elements.map((el) => [el.id, el])),
  } as never);
}

describe("R1 call site → canonicalEvents 부착 + roundtrip", () => {
  beforeEach(() => {
    historyManager.clearAllHistory();
    historyManager.setCurrentPage("page-1");
    useCanonicalDocumentStore.setState({
      documents: new Map(),
      currentProjectId: null,
      documentVersion: 0,
    });
    useStore.setState({
      elements: [],
      elementsMap: new Map(),
      selectedElementId: null,
      selectedElementProps: {},
      currentPageId: "page-1",
    } as never);
    registerCanonicalMutationStoreActions({
      getCurrentProjectId: () => "history-project",
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

  it("updateElementProps: full-merged update event 부착 + undo/redo roundtrip", async () => {
    const original = makeElement("text-1", {
      children: "before",
      keep: "stay",
    });
    seed([original]);

    await useStore
      .getState()
      .updateElementProps("text-1", { children: "after" });

    // entry 검증: canonicalEvents 부착 + full merged props (patch 아님)
    const entry = lastEntry();
    expect(entry.type).toBe("update");
    const events = entry.data.canonicalEvents;
    expect(events).toHaveLength(1);
    if (!events || events[0].type !== "update") {
      throw new Error("update event expected");
    }
    expect(events[0].prevProps).toEqual({ children: "before", keep: "stay" });
    expect(events[0].nextProps).toEqual({ children: "after", keep: "stay" });
    // deprecated legacy snapshot field 미기록
    expect(legacyRead(entry).props).toBeUndefined();
    expect(legacyRead(entry).prevProps).toBeUndefined();
    expect(legacyRead(entry).prevElement).toBeUndefined();

    expect(getCanonicalProps("text-1")).toEqual({
      children: "after",
      keep: "stay",
    });

    await useStore.getState().undo();
    expect(getCanonicalProps("text-1")).toEqual({
      children: "before",
      keep: "stay",
    });

    await useStore.getState().redo();
    expect(getCanonicalProps("text-1")).toEqual({
      children: "after",
      keep: "stay",
    });
  });

  it("updateElement customId: one replace entry preserves selection through undo/redo", async () => {
    const original = makeElement(
      "text-1",
      { children: "label" },
      { customId: "before" },
    );
    seed([original]);
    useStore.setState({
      selectedElementId: original.id,
      selectedElementIds: [original.id],
      selectedElementIdsSet: new Set([original.id]),
      selectedElementProps: original.props,
    } as never);

    await useStore.getState().updateElement(original.id, { customId: "after" });

    expect(historyManager.getCurrentPageEntries()).toHaveLength(1);
    expect(
      lastEntry().data.canonicalEvents?.map((event) => event.type),
    ).toEqual(["remove", "insert"]);
    expect(useStore.getState().elementsMap.get(original.id)?.customId).toBe(
      "after",
    );

    await useStore.getState().undo();
    expect(useStore.getState().selectedElementId).toBe(original.id);
    expect(useStore.getState().selectedElementIds).toEqual([original.id]);
    expect(useStore.getState().elementsMap.get(original.id)?.customId).toBe(
      "before",
    );

    await useStore.getState().redo();
    expect(useStore.getState().selectedElementId).toBe(original.id);
    expect(useStore.getState().selectedElementIds).toEqual([original.id]);
    expect(useStore.getState().elementsMap.get(original.id)?.customId).toBe(
      "after",
    );
  });

  it("batchUpdateElementProps: 요소별 full-merged update events + roundtrip", async () => {
    const a = makeElement("text-a", { children: "A0", size: "md" });
    const b = makeElement("text-b", { children: "B0" });
    seed([a, b]);

    await useStore.getState().batchUpdateElementProps([
      { elementId: "text-a", props: { children: "A1" } },
      { elementId: "text-b", props: { children: "B1" } },
    ]);

    const entry = lastEntry();
    expect(entry.type).toBe("batch");
    expect(entry.elementIds).toEqual(["text-a", "text-b"]);
    const events = entry.data.canonicalEvents ?? [];
    expect(events).toHaveLength(2);
    if (events[0].type !== "update") throw new Error("update event expected");
    expect(events[0].nextProps).toEqual({ children: "A1", size: "md" });
    expect(legacyRead(entry).batchUpdates).toBeUndefined();

    await useStore.getState().undo();
    expect(getCanonicalProps("text-a")).toEqual({
      children: "A0",
      size: "md",
    });
    expect(getCanonicalProps("text-b")).toEqual({ children: "B0" });

    await useStore.getState().redo();
    expect(getCanonicalProps("text-a")).toEqual({
      children: "A1",
      size: "md",
    });
    expect(getCanonicalProps("text-b")).toEqual({ children: "B1" });
  });

  it("HC#2 flip: v1 legacy entry undo 후 canonical ↔ store elements 발산 0", async () => {
    const before = makeElement("text-1", { children: "v1-before" });
    const after = makeElement("text-1", { children: "v1-after" });
    seed([after]);

    // v1 IndexedDB 스타일 entry — IDB 경계와 같이 migrate 후 스택에 넣는다
    addMigratedV1Entry({
      type: "batch",
      elementId: "text-1",
      elementIds: ["text-1"],
      data: {
        prevElements: [before],
        elements: [after],
      },
    });

    await useStore.getState().undo();

    // canonical 이 먼저 갱신되고 store 는 canonical 재파생 — 발산 0
    expect(getCanonicalProps("text-1")).toMatchObject({
      children: "v1-before",
    });
    const storeElement = useStore.getState().elementsMap.get("text-1");
    expect(storeElement?.props).toMatchObject({ children: "v1-before" });

    const doc = useCanonicalDocumentStore
      .getState()
      .getDocument("history-project");
    const canonicalIds = (doc?.children ?? []).map((child) => child.id);
    const storeIds = useStore.getState().elements.map((el) => el.id);
    expect(storeIds).toEqual(canonicalIds);
  });

  it("goToHistoryIndex: v2/v1 혼합 시퀀스 cross-jump 정합", async () => {
    const original = makeElement("text-1", { children: "step0" });
    seed([original]);

    // entry 1 (v2): step0 → step1
    await useStore.getState().updateElementProps("text-1", {
      children: "step1",
    });
    // entry 2 (v1 스타일): step1 → step2
    const step1 = makeElement("text-1", { children: "step1" });
    const step2 = makeElement("text-1", { children: "step2" });
    addMigratedV1Entry({
      type: "batch",
      elementId: "text-1",
      elementIds: ["text-1"],
      data: {
        prevElements: [step1],
        elements: [step2],
      },
    });
    useCanonicalDocumentStore
      .getState()
      .setDocument("history-project", makeDocument([step2]));
    useStore.setState({
      elements: [step2],
      elementsMap: new Map([[step2.id, step2]]),
    } as never);

    // index -1 (시작 상태) 로 jump → 두 entry 모두 역방향 적용
    await useStore.getState().goToHistoryIndex(-1);
    expect(getCanonicalProps("text-1")).toMatchObject({ children: "step0" });
    expect(useStore.getState().elementsMap.get("text-1")?.props).toMatchObject({
      children: "step0",
    });

    // index 1 (끝) 로 jump → 두 entry 모두 정방향 재적용
    await useStore.getState().goToHistoryIndex(1);
    expect(getCanonicalProps("text-1")).toMatchObject({ children: "step2" });
    expect(useStore.getState().elementsMap.get("text-1")?.props).toMatchObject({
      children: "step2",
    });
  });

  it("trackBatchUpdate: full-merged update events 부착 (batchUpdates 미기록)", () => {
    const a = makeElement("el-a", { color: "red", size: "md" });
    const elementsMap = new Map([[a.id, a]]);

    trackBatchUpdate(["el-a"], { color: "blue" }, elementsMap);

    const entry = lastEntry();
    expect(entry.type).toBe("batch");
    const events = entry.data.canonicalEvents ?? [];
    expect(events).toHaveLength(1);
    if (events[0].type !== "update") throw new Error("update event expected");
    expect(events[0].prevProps).toEqual({ color: "red", size: "md" });
    expect(events[0].nextProps).toEqual({ color: "blue", size: "md" });
    expect(legacyRead(entry).batchUpdates).toBeUndefined();
  });
});
