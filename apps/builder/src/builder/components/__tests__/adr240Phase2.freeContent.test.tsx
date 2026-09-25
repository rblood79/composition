import { beforeEach, describe, expect, it, vi } from "vitest";

import type {
  CanonicalNode,
  CompositionDocument,
  RefNode,
  ResolvedNode,
} from "@composition/shared";

import { createInitialProjectDocument } from "../../../dashboard/createInitialProjectDocument";
import { buildCanonicalSceneModel } from "../../workspace/canvas/scene/canonicalSceneModel";
import { resolveCanonicalDocument } from "../../../resolvers/canonical";
import {
  applyCanonicalHistoryEventsToDocument,
  buildCanonicalMoveEvents,
  buildCanonicalMoveIntoRefDescendantsEvents,
  captureCanonicalNodeLocations,
  captureCanonicalReplaceSources,
} from "../../stores/history/canonicalHistoryEvents";
import { useCanonicalDocumentStore } from "../../stores/canonical/canonicalDocumentStore";
import {
  moveElementToCanonicalTarget,
  registerCanonicalMutationStoreActions,
  resetCanonicalMutationStoreActions,
} from "../../../adapters/canonical/canonicalMutations";
import { withComponentInstanceMirror } from "../../../adapters/canonical/componentSemanticsMirror";
import { createInspectorActionsSlice } from "../../stores/inspectorActions";
import { resolveCanonicalMoveTarget } from "../../workspace/canvas/interaction/resolveCanonicalMutationTarget";
import { resolveMoveTarget } from "../../domain/resolveMoveTarget";
import {
  acceptsDraggedElement,
  type DropTargetReadModel,
} from "../../workspace/canvas/selection/dropTargetResolver";
import type { Element, Page } from "../../../types/builder/unified.types";
import { CARD_ORIGIN_ID } from "../card/cardTemplateOrigins";
import { applyEditToSlotFill } from "../slotFillEdit";
import { writeSlotFill } from "../slotFillPath";
import {
  SLOT_FILL_PRIMITIVE_TYPES,
  buildSlotFillNodeForType,
} from "../slotFillNodes";
import {
  planSlotRegionInsert,
  resolveSlotRegionTarget,
} from "../slotRegionInsert";
import { getPaletteItems } from "../../panels/components/paletteItems";
import { getReusableCompositeOriginId } from "../reusableCompositeOrigins";

/**
 * ADR-240 Phase 2 (G2) — 자유 내용 채우기.
 *   - 채운 노드 편집 (리뷰 r1 h3 · 진단 (e) (e2)): 실제 inspector 쓰기 (`updateSelectedProperties` ·
 *     `updateSelectedFills`) → mode C 배열 노드 · 두 leg (Preview resolver · Canvas scene) · Undo/Redo.
 *   - 자유 내용 노드 (primitive) · 팔레트 영역 삽입 (F18) · Canvas drop 판정 · 이동 (F20) · fills (F19).
 */

const mocks = vi.hoisted(() => ({
  db: {
    elements: {
      update: vi.fn(async () => {}),
      insertMany: vi.fn(async () => {}),
      deleteMany: vi.fn(async () => {}),
    },
    documents: { put: vi.fn(async () => {}) },
  },
  addEntry: vi.fn(),
}));

vi.mock("../../../lib/db", () => ({
  getDB: vi.fn(async () => mocks.db),
}));
vi.mock("../../stores/history", () => ({
  historyManager: {
    addEntry: mocks.addEntry,
    addBatchDiffEntry: vi.fn(),
    getCurrentPageId: () => "page-1",
  },
}));
vi.mock("../../../services/save", () => ({
  saveService: { savePropertyChange: vi.fn(async () => {}) },
}));

const PROJECT = "project-1";
const INST = "card-inst";

function seedDocument(): CompositionDocument {
  vi.spyOn(console, "warn").mockImplementation(() => {});
  return createInitialProjectDocument(
    { id: "page-1", title: "P", slug: "/" },
    { id: "body-1", type: "body" },
  ) as CompositionDocument;
}

function find(
  nodes: readonly CanonicalNode[],
  id: string,
): CanonicalNode | undefined {
  for (const node of nodes) {
    if (node.id === id) return node;
    const hit = find(node.children ?? [], id);
    if (hit) return hit;
  }
  return undefined;
}

function findResolved(
  nodes: readonly ResolvedNode[],
  id: string,
): ResolvedNode | undefined {
  for (const node of nodes) {
    if (node.id === id) return node;
    const hit = findResolved((node.children ?? []) as ResolvedNode[], id);
    if (hit) return hit;
  }
  return undefined;
}

function withBodyChildren(
  doc: CompositionDocument,
  added: CanonicalNode[],
): CompositionDocument {
  const visit = (nodes: CanonicalNode[]): CanonicalNode[] =>
    nodes.map((node) =>
      node.id === "body-1"
        ? { ...node, children: [...(node.children ?? []), ...added] }
        : node.children
          ? { ...node, children: visit(node.children) }
          : node,
    );
  return { ...doc, children: visit(doc.children) };
}

type SceneNodeLike = {
  id: string;
  type: string;
  parent_id?: string | null;
  props?: Record<string, unknown>;
  fills?: unknown;
  slot?: unknown;
  metadata?: Record<string, unknown>;
};

function scene(doc: CompositionDocument) {
  const model = buildCanonicalSceneModel(doc);
  return {
    node: (id: string) =>
      model.sceneNodesMap.get(id) as SceneNodeLike | undefined,
    childIds: (id: string) =>
      (model.sceneChildrenByParent.get(id) ?? []).map((n) => n.id),
    model,
  };
}

/** Preview: instance 의 CardContent 자식 (mode C 결과). */
function previewContent(doc: CompositionDocument, instanceId = INST) {
  const inst = findResolved(
    resolveCanonicalDocument(doc) as ResolvedNode[],
    instanceId,
  )!;
  const content = (inst.children ?? []).find(
    (child) => child.type === "CardContent",
  ) as ResolvedNode;
  return (content.children ?? []) as ResolvedNode[];
}

function cardInstance(
  fill: unknown[],
  extra: Record<string, unknown> = {},
  id = INST,
): CanonicalNode {
  return {
    id,
    type: "ref",
    ref: CARD_ORIGIN_ID,
    props: {},
    descendants: { Content: { children: fill }, ...extra },
  } as unknown as CanonicalNode;
}

function instanceNode(doc: CompositionDocument, id = INST): RefNode {
  return find(doc.children, id) as RefNode;
}

// ── store 하니스 (syntheticDescendantLookup.test 와 같은 모양) ────────────────
function makeElement(
  id: string,
  type: string,
  patch: Partial<Element> & Record<string, unknown> = {},
): Element {
  return {
    id,
    type,
    props: {},
    parent_id: null,
    page_id: "page-1",
    order_num: 0,
    ...patch,
  } as Element;
}

function setUpStore(doc: CompositionDocument, selectedElementId: string) {
  useCanonicalDocumentStore.getState().setCurrentProject(PROJECT);
  useCanonicalDocumentStore.getState().setDocument(PROJECT, doc);
  const body = makeElement("body-1", "body");
  const instance = withComponentInstanceMirror(
    makeElement(INST, "ref", { parent_id: "body-1", ref: CARD_ORIGIN_ID }),
    CARD_ORIGIN_ID,
  );
  const elements = [body, instance];
  const state: Record<string, unknown> = {
    elements,
    elementsMap: new Map(elements.map((el) => [el.id, el])),
    childrenMap: new Map([["body-1", [instance]]]),
    currentPageId: "page-1",
    pages: [
      {
        id: "page-1",
        project_id: PROJECT,
        title: "page-1",
        slug: "/page-1",
        parent_id: null,
        order_num: 0,
      } as Page,
    ],
    selectedElementId,
    selectedElementIds: [selectedElementId],
    selectedElementIdsSet: new Set([selectedElementId]),
    selectedElementProps: {},
    editingContextId: null,
    dirtyElementIds: new Set(),
    layoutVersion: 0,
    activeBreakpoint: "desktop",
    _cancelHydrateSelectedProps: vi.fn(),
    updateElement: vi.fn(),
  };
  registerCanonicalMutationStoreActions({
    getCurrentLegacySnapshot: () => ({
      elements: state.elements as Element[],
      pages: state.pages as Page[],
      layouts: [],
    }),
    getCurrentProjectId: () => PROJECT,
  });
  const set = vi.fn(
    (
      patch:
        | Record<string, unknown>
        | ((current: Record<string, unknown>) => Record<string, unknown>),
    ) => {
      Object.assign(state, typeof patch === "function" ? patch(state) : patch);
    },
  ) as never;
  const get = (() => state) as never;
  return createInspectorActionsSlice(set, get, {} as never);
}

function currentDoc(): CompositionDocument {
  return useCanonicalDocumentStore.getState().getDocument(PROJECT)!;
}

function lastHistoryEvents() {
  const call = mocks.addEntry.mock.calls.at(-1)?.[0] as
    { data: { canonicalEvents: never[] } } | undefined;
  return call?.data.canonicalEvents ?? [];
}

beforeEach(() => {
  vi.clearAllMocks();
  resetCanonicalMutationStoreActions();
  useCanonicalDocumentStore.setState({
    documents: new Map(),
    currentProjectId: PROJECT,
    documentVersion: 0,
  });
  (globalThis as { indexedDB?: unknown }).indexedDB = {};
});

// ── 채운 노드 편집 (진단 (e) (e2) 닫힘) ──────────────────────────────────────
describe("ADR-240 G2 — 채운 노드 편집이 mode C 배열 노드에 쓰인다", () => {
  const textFill = () =>
    withBodyChildren(seedDocument(), [
      cardInstance([
        { id: "t", type: "Text", props: { children: "A", size: "md" } },
      ]),
    ]);

  it("primitive Text — Properties 쓰기 → 배열 노드 props · 바깥 `Content/t` 키 없음 · 두 leg B", async () => {
    const actions = setUpStore(textFill(), `${INST}/Content/t`);
    actions.updateSelectedProperties({ children: "B" });
    await vi.waitFor(() =>
      expect(
        (
          instanceNode(currentDoc()).descendants?.Content as {
            children: CanonicalNode[];
          }
        ).children[0]?.props?.children,
      ).toBe("B"),
    );
    const doc = currentDoc();
    expect(Object.keys(instanceNode(doc).descendants ?? {})).toEqual([
      "Content",
    ]);
    expect(previewContent(doc)[0]?.props?.children).toBe("B");
    expect(scene(doc).node(`${INST}/Content/t`)?.props?.children).toBe("B");
    // 나머지 props 보존.
    expect(scene(doc).node(`${INST}/Content/t`)?.props?.size).toBe("md");
  });

  it("style 편집은 배열 노드 style 에 심층 병합 · `null` 은 지운다", async () => {
    const actions = setUpStore(textFill(), `${INST}/Content/t`);
    actions.updateSelectedProperties({ style: { color: "red" } });
    await vi.waitFor(() =>
      expect(previewContent(currentDoc())[0]?.props?.style).toMatchObject({
        color: "red",
      }),
    );
    actions.updateSelectedProperties({ style: { fontSize: 20 } });
    await vi.waitFor(() =>
      expect(
        scene(currentDoc()).node(`${INST}/Content/t`)?.props?.style,
      ).toMatchObject({ color: "red", fontSize: 20 }),
    );
    expect(previewContent(currentDoc())[0]?.props?.style).toMatchObject({
      color: "red",
      fontSize: 20,
    });
    const next = applyEditToSlotFill(
      instanceNode(currentDoc()).descendants ?? {},
      "Content/t",
      { style: { color: null } },
    )!;
    const node = (next.Content as { children: CanonicalNode[] }).children[0]!;
    expect(node.props?.style).toEqual({ fontSize: 20 });
  });

  it('ref 자식 (234 Slot "+" 모양) — 쓰기 → 배열 노드 props · 두 leg B', async () => {
    const actions = setUpStore(
      withBodyChildren(seedDocument(), [
        cardInstance([
          { id: "b", type: "ref", ref: "component-button", props: {} },
        ]),
      ]),
      `${INST}/Content/b`,
    );
    actions.updateSelectedProperties({ children: "B" });
    await vi.waitFor(() =>
      expect(
        scene(currentDoc()).node(`${INST}/Content/b`)?.props?.children,
      ).toBe("B"),
    );
    const doc = currentDoc();
    expect(
      findResolved(resolveCanonicalDocument(doc) as ResolvedNode[], "b")?.props
        ?.children,
    ).toBe("B");
    expect(Object.keys(instanceNode(doc).descendants ?? {})).toEqual([
      "Content",
    ]);
  });

  it("채운 ref 안쪽 (Button 의 Text) 편집 → 그 ref 노드의 자기 descendants", () => {
    const next = applyEditToSlotFill(
      {
        Content: {
          children: [{ id: "b", type: "ref", ref: "component-button" }],
        },
      },
      "Content/b/component-button__1",
      { children: "Inner" },
    )!;
    const b = (next.Content as { children: CanonicalNode[] })
      .children[0] as RefNode;
    expect(b.descendants).toEqual({
      "component-button__1": { children: "Inner" },
    });
  });

  it("mode C 조상이 없으면 null (호출자 = 종전 mode A patch) · 배열에 없는 노드도 null", () => {
    expect(applyEditToSlotFill({}, "Header/Title", { children: "x" })).toBe(
      null,
    );
    expect(
      applyEditToSlotFill(
        { Content: { children: [{ id: "t", type: "Text" }] } },
        "Content/nope",
        { children: "x" },
      ),
    ).toBe(null);
  });

  it("Undo/Redo — 편집 history (instance replace event) 재생이 두 leg 에서 A ↔ B", async () => {
    const actions = setUpStore(textFill(), `${INST}/Content/t`);
    actions.updateSelectedProperties({ children: "B" });
    await vi.waitFor(() =>
      expect(previewContent(currentDoc())[0]?.props?.children).toBe("B"),
    );
    const events = lastHistoryEvents();
    expect(events.length).toBeGreaterThan(0);
    const undone = applyCanonicalHistoryEventsToDocument(
      currentDoc(),
      events,
      "undo",
    );
    expect(previewContent(undone)[0]?.props?.children).toBe("A");
    expect(scene(undone).node(`${INST}/Content/t`)?.props?.children).toBe("A");
    const redone = applyCanonicalHistoryEventsToDocument(
      undone,
      events,
      "redo",
    );
    expect(previewContent(redone)[0]?.props?.children).toBe("B");
    expect(scene(redone).node(`${INST}/Content/t`)?.props?.children).toBe("B");
  });
});

// ── 채운 영역 host 자체의 스타일 (두 leg 대칭 · 채우기/비우기/drop 보존) ────────────
describe("ADR-240 G2 — 채운 영역 host 의 스타일", () => {
  const STYLE = { paddingTop: "40px", backgroundColor: "red" };

  it("`{ children, style }` 항목 — Preview 도 영역 style 을 싣는다 (Canvas 와 같은 값)", () => {
    const doc = withBodyChildren(seedDocument(), [
      cardInstance([{ id: "t", type: "Text", props: { children: "A" } }]),
    ]);
    (instanceNode(doc).descendants!.Content as Record<string, unknown>).style =
      STYLE;
    const resolved = findResolved(
      resolveCanonicalDocument(doc) as ResolvedNode[],
      INST,
    )!;
    const content = (resolved.children ?? []).find(
      (c) => c.type === "CardContent",
    );
    expect(content?.props?.style).toMatchObject(STYLE);
    expect(content?.children?.map((c) => c.props?.children)).toEqual(["A"]);
    expect(scene(doc).node(`${INST}/Content`)?.props?.style).toMatchObject(
      STYLE,
    );
  });

  it("Slot 채우기 · 비우기는 영역 host 편집 (style) 을 보존한다 (옛 id 키 항목 포함)", () => {
    const host = { path: "Content", legacyPath: "component-card__content" };
    const filled = writeSlotFill(
      { "component-card__content": { style: STYLE } },
      host,
      [{ id: "t", type: "Text" }],
    );
    expect(filled).toEqual({
      Content: { style: STYLE, children: [{ id: "t", type: "Text" }] },
    });
    expect(writeSlotFill(filled, host, null)).toEqual({
      Content: { style: STYLE },
    });
    expect(writeSlotFill({ Content: { children: [] } }, host, null)).toEqual(
      {},
    );
  });

  it("스타일만 준 영역 (mode A) 에 drop → style 보존 + children 추가 (조용히 무시되지 않는다)", () => {
    const doc = withBodyChildren(seedDocument(), [
      {
        id: INST,
        type: "ref",
        ref: CARD_ORIGIN_ID,
        props: {},
        descendants: { Footer: { style: STYLE } },
      } as unknown as CanonicalNode,
      { id: "page-text", type: "Text", props: { children: "Moved" } },
    ]);
    setUpStore(doc, "page-text");
    const result = moveElementToCanonicalTarget("page-text", {
      kind: "ref-descendants",
      refNodeId: INST,
      descendantPath: "Footer",
      insertionIndex: 0,
    });
    expect(result.changed).toBe(true);
    const footer = instanceNode(currentDoc()).descendants?.Footer as Record<
      string,
      unknown
    >;
    expect(footer.style).toEqual(STYLE);
    expect((footer.children as CanonicalNode[]).map((n) => n.id)).toEqual([
      "page-text",
    ]);
  });
});

// ── fills (F19) ──────────────────────────────────────────────────────────────
describe("ADR-240 G2 — 채운 노드 배경 (fills)", () => {
  const FILL = [
    { id: "f1", type: "color", color: "#ff0000", enabled: true, opacity: 1 },
  ];

  it("Styles fills 쓰기 (`updateSelectedFills`) → 배열 노드 `fills` · Preview · Canvas 둘 다 싣는다", async () => {
    const actions = setUpStore(
      withBodyChildren(seedDocument(), [
        cardInstance([{ id: "f", type: "frame", props: { style: {} } }]),
      ]),
      `${INST}/Content/f`,
    );
    actions.updateSelectedFills(FILL as never);
    await vi.waitFor(() =>
      expect(
        (
          instanceNode(currentDoc()).descendants?.Content as {
            children: CanonicalNode[];
          }
        ).children[0]?.fills,
      ).toEqual(FILL),
    );
    const doc = currentDoc();
    expect(previewContent(doc)[0]?.fills).toEqual(FILL);
    expect(scene(doc).node(`${INST}/Content/f`)?.fills).toEqual(FILL);
  });
});

// ── 자유 내용 노드 · 팔레트 영역 삽입 (F18) ─────────────────────────────────
describe("ADR-240 G2 — 자유 내용 (primitive) 채우기", () => {
  it("자유 내용 type 은 팔레트 항목 중 reusable origin 이 없는 것", () => {
    type PaletteEntry = {
      items?: PaletteEntry[];
      componentType?: string;
      type?: string;
      name?: string;
    };
    const paletteTypes = new Set(
      (getPaletteItems() as unknown as PaletteEntry[])
        .flatMap((group) => group.items ?? [group])
        .map((item) => item.componentType ?? item.type ?? item.name),
    );
    for (const type of SLOT_FILL_PRIMITIVE_TYPES) {
      expect(paletteTypes.has(type), type).toBe(true);
      expect(getReusableCompositeOriginId(type), type).toBe(null);
    }
  });

  it("채움 노드 — primitive = plain (팔레트 생성 props) · reusable = ref · 복합 factory type = null · 형제 id 유일", () => {
    const text = buildSlotFillNodeForType("Text", [])!;
    expect(text).toMatchObject({
      id: "text",
      type: "Text",
      props: { children: "Text", style: { whiteSpace: "pre-wrap" } },
    });
    expect(buildSlotFillNodeForType("Text", [text])?.id).toBe("text-2");
    expect(buildSlotFillNodeForType("Button", [])).toEqual({
      id: "component-button",
      type: "ref",
      ref: "component-button",
    });
    expect(buildSlotFillNodeForType("IllustratedMessage", [])).toBe(null);
  });

  for (const type of SLOT_FILL_PRIMITIVE_TYPES) {
    it(`${type} 를 Card Content 에 채우면 두 leg 에 같은 노드`, () => {
      const node = buildSlotFillNodeForType(type, [])!;
      const doc = withBodyChildren(seedDocument(), [cardInstance([node])]);
      expect(previewContent(doc).map((c) => c.type)).toEqual([type]);
      expect(scene(doc).childIds(`${INST}/Content`)).toEqual([
        `${INST}/Content/${node.id}`,
      ]);
      expect(scene(doc).node(`${INST}/Content/${node.id}`)?.type).toBe(type);
    });
  }

  it("팔레트 삽입 대상 — 영역 host · 영역 안 노드 = 그 영역 · 영역 밖 (Dialog 제목 · Close · instance root) = null", () => {
    const doc = withBodyChildren(seedDocument(), [
      cardInstance([]),
      {
        id: "dlg",
        type: "ref",
        ref: "component-dialog",
        props: {},
      } as unknown as CanonicalNode,
    ]);
    const region = (id: string) =>
      resolveSlotRegionTarget(doc, id)?.regionPath ?? null;
    expect(region(`${INST}/Content`)).toBe("Content");
    expect(region(`${INST}/Content/Description`)).toBe("Content");
    expect(region(`${INST}/Header/Title`)).toBe("Header");
    expect(region("dlg/component-dialog__2/Content")).toBe(
      "component-dialog__2/Content",
    );
    expect(
      region("dlg/component-dialog__2/component-dialog__2_3/Actions"),
    ).toBe("component-dialog__2/component-dialog__2_3/Actions");
    // 고정 부품 · 영역 밖
    expect(region("dlg/component-dialog__2/component-dialog__2_1")).toBe(null);
    expect(
      region(
        "dlg/component-dialog__2/component-dialog__2_3/component-dialog__2_3_1",
      ),
    ).toBe(null);
    expect(region("dlg/component-dialog__2")).toBe(null);
    expect(region(INST)).toBe(null);
  });

  it("팔레트 Text 클릭 (Card Content 선택) → Content mode C 끝에 추가 · 두 leg · 선택 id", () => {
    const doc = withBodyChildren(seedDocument(), [
      cardInstance([
        { id: "component-button", type: "ref", ref: "component-button" },
      ]),
    ]);
    const plan = planSlotRegionInsert({
      document: doc,
      targetId: `${INST}/Content`,
      type: "Text",
    })!;
    expect(plan.syntheticId).toBe(`${INST}/Content/text`);
    const next = withBodyChildren(seedDocument(), [
      {
        ...cardInstance([]),
        descendants: plan.nextDescendantMap,
      } as CanonicalNode,
    ]);
    expect(previewContent(next).map((c) => c.type)).toEqual(["Button", "Text"]);
    expect(scene(next).childIds(`${INST}/Content`)).toEqual([
      `${INST}/Content/component-button`,
      `${INST}/Content/text`,
    ]);
    // 영역 밖 선택이면 계획 없음 (종전 경로).
    expect(
      planSlotRegionInsert({ document: doc, targetId: INST, type: "Text" }),
    ).toBe(null);
  });
});

// ── Canvas drop (F20) ────────────────────────────────────────────────────────
describe("ADR-240 G2 — Canvas drop 대상 = 영역 host 만", () => {
  function readModel(doc: CompositionDocument): DropTargetReadModel {
    const { model } = scene(doc);
    return {
      elementsById: model.sceneNodesMap as never,
      childrenByParent: model.sceneChildrenByParent as never,
    };
  }

  it("synthetic 영역 host 는 받고 · inherited 노드 · 고정 부품 · 영역 아닌 synthetic 은 거부", () => {
    const doc = withBodyChildren(seedDocument(), [
      cardInstance([]),
      {
        id: "dlg",
        type: "ref",
        ref: "component-dialog",
        props: { defaultOpen: true },
      } as unknown as CanonicalNode,
    ]);
    const store = readModel(doc);
    const accepts = (id: string) => {
      const node = store.elementsById.get(id);
      expect(node, id).toBeDefined();
      return acceptsDraggedElement(node!, store);
    };
    expect(accepts(`${INST}/Content`)).toBe(true);
    expect(accepts(`${INST}/Footer`)).toBe(true);
    expect(accepts(`${INST}/Preview/Image`)).toBe(false);
    expect(
      accepts("dlg/component-dialog__2/Content/component-dialog__2_2"),
    ).toBe(false);
    expect(accepts(`${INST}/Header/Title`)).toBe(false);
    expect(accepts("dlg/component-dialog__2/Content")).toBe(true);
    expect(
      accepts("dlg/component-dialog__2/component-dialog__2_3/Actions"),
    ).toBe(true);
    expect(accepts("dlg/component-dialog__2/component-dialog__2_1")).toBe(
      false,
    );
    expect(
      accepts(
        "dlg/component-dialog__2/component-dialog__2_3/component-dialog__2_3_1",
      ),
    ).toBe(false);
    expect(accepts("dlg/component-dialog__2/component-dialog__2_3")).toBe(
      false,
    );
    // 목록 틀 (TabList — 항목 instance 를 넣는 host) 은 slot 이 있어도 자유 내용 drop 대상이 아니다.
    const tabsDoc = withBodyChildren(seedDocument(), [
      {
        id: "tabs-inst",
        type: "ref",
        ref: "component-tabs",
        props: {},
      } as unknown as CanonicalNode,
    ]);
    const tabsStore = readModel(tabsDoc);
    const tabList = [...tabsStore.elementsById.values()].find(
      (node) => node.id.startsWith("tabs-inst/") && node.type === "TabList",
    );
    expect(
      Array.isArray((tabList as { slot?: unknown } | undefined)?.slot),
    ).toBe(true);
    expect(acceptsDraggedElement(tabList!, tabsStore)).toBe(false);
  });

  it("드래그 대상 판정 (ADR-236 resolveMoveTarget) — 영역 host 는 통과 · 영역 아닌 synthetic 은 거부", () => {
    const doc = withBodyChildren(seedDocument(), [
      cardInstance([]),
      {
        id: "dlg",
        type: "ref",
        ref: "component-dialog",
        props: { defaultOpen: true },
      } as unknown as CanonicalNode,
    ]);
    const store = readModel(doc);
    const judge = (targetParentId: string) =>
      resolveMoveTarget({
        targetParentId,
        insertionIndex: 0,
        movingTypes: ["Text"],
        nodes: store.elementsById as never,
        policy: "nearest-ancestor",
        doc,
      });
    expect(judge(`${INST}/Content`)).toMatchObject({
      ok: true,
      parentId: `${INST}/Content`,
    });
    // 영역 안 노드는 그 영역으로 옮겨진다 (resolveCanonicalMoveTarget) — 거부하지 않는다.
    expect(judge(`${INST}/Header/Title`)).toMatchObject({ ok: true });
    // 영역 밖 고정 부품 (Dialog 제목) 은 거부.
    expect(judge("dlg/component-dialog__2/component-dialog__2_1")).toEqual({
      ok: false,
      reason: "synthetic",
    });
  });

  it("영역 drop → `ref-descendants` 이동 대상 · 페이지 Text 가 Content mode C 로 · 두 leg · 원래 자리에서 빠진다", () => {
    const doc = withBodyChildren(seedDocument(), [
      cardInstance([]),
      { id: "page-text", type: "Text", props: { children: "Moved" } },
    ]);
    setUpStore(doc, "page-text");
    const store = readModel(doc);
    const target = resolveCanonicalMoveTarget({
      renderTargetId: `${INST}/Content`,
      insertionIndex: 0,
      elementsMap: store.elementsById as never,
    });
    expect(target).toEqual({
      kind: "ref-descendants",
      refNodeId: INST,
      descendantPath: "Content",
      insertionIndex: 0,
    });
    const result = moveElementToCanonicalTarget("page-text", target!);
    expect(result.changed).toBe(true);
    const moved = currentDoc();
    expect(find(moved.children, "page-text")).toBeUndefined();
    expect(previewContent(moved).map((c) => c.props?.children)).toEqual([
      "Moved",
    ]);
    expect(
      scene(moved).node(`${INST}/Content/page-text`)?.props?.children,
    ).toBe("Moved");
    // 영역 안 노드를 대상으로 받아도 (drop 판정은 영역 host 만 고르지만) 가장 가까운 영역으로 간다.
    expect(
      resolveCanonicalMoveTarget({
        renderTargetId: `${INST}/Content/Description`,
        insertionIndex: 0,
        elementsMap: store.elementsById as never,
      }),
    ).toEqual({
      kind: "ref-descendants",
      refNodeId: INST,
      descendantPath: "Content",
      insertionIndex: 0,
    });
  });

  function bodyIds(doc: CompositionDocument) {
    return (find(doc.children, "body-1")?.children ?? []).map((n) => n.id);
  }
  function footerIds(doc: CompositionDocument) {
    return (
      (instanceNode(doc).descendants?.Footer as { children?: CanonicalNode[] })
        ?.children ?? []
    ).map((n) => n.id);
  }

  it("영역 이동 history — Undo 는 Text 를 원래 자리 (instance 앞) 로 · Redo 는 다시 영역 (instance 자기 자식 아님)", () => {
    // Text 가 instance **앞** 형제 — instance prev index 보정 (shift) 이 필요한 모양.
    const doc = withBodyChildren(seedDocument(), [
      { id: "page-text", type: "Text", props: { children: "Moved" } },
      cardInstance([]),
      { id: "after", type: "Text", props: { children: "After" } },
    ]);
    setUpStore(doc, "page-text");
    const before = bodyIds(currentDoc());
    const target = {
      kind: "ref-descendants" as const,
      refNodeId: INST,
      descendantPath: "Footer",
      insertionIndex: 0,
    };
    const captures = captureCanonicalReplaceSources(["page-text", INST]);
    const locations = captureCanonicalNodeLocations(["page-text"]);
    expect(moveElementToCanonicalTarget("page-text", target).changed).toBe(
      true,
    );
    const moved = currentDoc();
    expect(footerIds(moved)).toEqual(["page-text"]);

    // 반례 — 종전 move event 는 Redo 가 instance 자기 자식으로 넣는다 (live 실측 결함).
    const legacy = buildCanonicalMoveEvents([
      { nodeId: "page-text", from: locations.get("page-text")! },
    ]);
    const legacyRedo = applyCanonicalHistoryEventsToDocument(
      applyCanonicalHistoryEventsToDocument(moved, legacy, "undo"),
      legacy,
      "redo",
    );
    expect(footerIds(legacyRedo)).toEqual([]);

    const events = buildCanonicalMoveIntoRefDescendantsEvents(
      ["page-text"],
      captures,
      INST,
    );
    const undone = applyCanonicalHistoryEventsToDocument(moved, events, "undo");
    expect(bodyIds(undone)).toEqual(before);
    expect(footerIds(undone)).toEqual([]);
    const redone = applyCanonicalHistoryEventsToDocument(
      undone,
      events,
      "redo",
    );
    expect(footerIds(redone)).toEqual(["page-text"]);
    expect(bodyIds(redone)).toEqual(bodyIds(moved));
    expect(find(redone.children, INST)?.children ?? []).toEqual([]);
    expect(
      scene(redone).node(`${INST}/Footer/page-text`)?.props?.children,
    ).toBe("Moved");
  });
});
