/**
 * ADR-903 P3-D-2 — elementCreation.ts canonical parent context 전환 검증
 *
 * 본 test 는 factoryOwnership.test.ts 에서 P3-D-2 부분만 분리한 것.
 * 분리 이유: vitest path resolution 이 다른 directory tree 의 test 파일
 * (apps/builder/src/builder/factories/__tests__/) 에서 elementCreation.ts 의
 * store bridge import 경로와 mock path 를 다른 module ID 로 cache 할 수 있어
 * 같은 directory tree (stores/utils/__tests__/) 로 유지한다.
 *
 * 범위: elementCreation.ts L74 + L191 + L108-126 (히스토리 조건 + reorder 분기)
 * 목표: frame ownership mirror / state.currentPageId 기반 → canonical parent context 기반
 *
 * 참조:
 * - docs/adr/design/903-phase3d-runtime-breakdown.md §4.2
 * - docs/adr/design/903-p3d1-p3d2-inventory.md
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

import * as historyModule from "../../history";

import {
  createAddElementAction,
  createAddComplexElementAction,
} from "../elementCreation";
import type { Element } from "../../../../types/core/store.types";
import type { Page } from "../../../../types/builder/unified.types";
import type { CompositionDocument, FrameNode } from "@composition/shared";
import { useCanonicalDocumentStore } from "../../canonical/canonicalDocumentStore";
import {
  registerCanonicalMutationStoreActions,
  resetCanonicalMutationStoreActions,
} from "@/adapters/canonical/canonicalMutations";

// ─── helpers ────────────────────────────────────────────────────────────────

function makeElement(
  id: string,
  type: string,
  opts: Partial<Element> = {},
): Element {
  return {
    id,
    type,
    parent_id: null,
    page_id: null,
    order_num: 0,
    props: {},
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    ...opts,
  } as Element;
}

function makePageRefFrame(id: string, pageId: string): FrameNode {
  return {
    id,
    type: "frame",
    name: `page-${pageId}`,
    children: [],
    metadata: { type: "page", pageId },
  } as FrameNode;
}

function makeReusableFrame(id: string): FrameNode {
  return {
    id,
    type: "frame",
    reusable: true,
    name: `reusable-${id}`,
    children: [],
  };
}

function makeDoc(frames: FrameNode[]): CompositionDocument {
  return {
    version: "composition-1.0",
    children: frames,
  };
}

// ─── mocks ──────────────────────────────────────────────────────────────────

const mockGetActiveCanonicalDocument = vi.fn();

vi.mock("@/builder/stores/canonical/canonicalElementsBridge", () => ({
  getActiveCanonicalDocument: () => mockGetActiveCanonicalDocument(),
}));

vi.mock("../../history", () => ({
  historyManager: {
    addEntry: vi.fn(),
  },
}));

vi.mock("../../../../lib/db", () => {
  const mockDb = {
    elements: {
      insert: vi.fn(async (el: Element) => el),
      insertMany: vi.fn(async () => {}),
      delete: vi.fn(async () => {}),
      getAll: vi.fn(async () => [] as Element[]),
    },
    documents: {
      put: vi.fn(async (_projectId: string, doc: CompositionDocument) => doc),
    },
  };
  return { getDB: vi.fn(async () => mockDb) };
});

vi.mock("../elementReorder", () => ({
  reorderElements: vi.fn(),
}));

vi.mock("../../../panels/styles/utils/fillExternalIngress", () => ({
  normalizeExternalFillIngress: vi.fn((el: Element) => el),
}));

vi.mock("../elementTagNormalizer", () => ({
  normalizeElementTagInElement: vi.fn((el: Element) => el),
  normalizeElementTags: vi.fn((els: Element[]) => ({
    elements: els,
    updatedElements: [],
  })),
}));

vi.mock("../../../../adapters/canonical/legacyElementSanitizer", () => ({
  sanitizeElement: vi.fn((el: Element) => el),
}));

vi.mock("../../../utils/propagationEngine", () => ({
  applyFactoryPropagation: vi.fn(
    (_parent: Element, children: Element[]) => children,
  ),
}));

// ─── shared mock state factory ─────────────────────────────────────────────

interface MockStateOpts {
  currentPageId?: string | null;
  childrenMap?: Map<string, Element[]>;
  elementsMap?: Map<string, Element>;
  pages?: Page[];
  doc?: CompositionDocument;
}

function setupStateMocks(opts: MockStateOpts = {}) {
  const state = {
    elements: [] as Element[],
    elementsMap: opts.elementsMap ?? new Map<string, Element>(),
    childrenMap: opts.childrenMap ?? new Map<string, Element[]>(),
    currentPageId: opts.currentPageId ?? null,
    pages: opts.pages ?? [],
    layoutVersion: 0,
    batchUpdateElementOrders: vi.fn(),
    _rebuildIndexes: vi.fn(),
  };

  const getMock = vi.fn(() => state);
  const setMock = vi.fn(
    (updater: object | ((prev: typeof state) => Partial<typeof state>)) => {
      if (typeof updater === "function") {
        const patch = updater(state);
        Object.assign(state, patch);
      } else {
        Object.assign(state, updater);
      }
    },
  );

  mockGetActiveCanonicalDocument.mockReturnValue(opts.doc ?? null);

  return { state, getMock, setMock };
}

// ─────────────────────────────────────────────────────────────────────────────
// P3-D-2: elementCreation.ts 히스토리 조건 교체
// 범위: elementCreation.ts L74 + L191 + L108-126
// 목표: frame ownership mirror 기반 조건 → canonical parent context 기반 조건
// ─────────────────────────────────────────────────────────────────────────────

describe("P3-D-2: elementCreation 히스토리 조건 교체 (RED phase)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resetCanonicalMutationStoreActions();
    useCanonicalDocumentStore.setState({
      currentProjectId: null,
      documents: new Map(),
      documentVersion: 0,
    });
  });

  describe("createAddElementAction — 히스토리 조건", () => {
    // [RED] current code: state.currentPageId || frame mirror 기준 → 둘 다 없으면 미기록
    // GREEN: parent_id 가 canonical doc 의 page-context frame 안에 있으면 기록
    it("canonical parent 가 page context(metadata.type=page) 면 historyManager.addEntry 호출된다", async () => {
      const pageId = "page-1";
      const pageFrame = makePageRefFrame("frame-page-1", pageId);
      const doc = makeDoc([pageFrame]);
      const element = makeElement("el-1", "Button", {
        parent_id: "frame-page-1",
      });

      const { setMock, getMock } = setupStateMocks({
        currentPageId: null, // ownership marker 없음
        doc,
      });

      await createAddElementAction(setMock, getMock)(element);

      expect(historyModule.historyManager.addEntry).toHaveBeenCalledWith(
        expect.objectContaining({ type: "add", elementId: "el-1" }),
      );
    });

    // [RED] current code: frame mirror 없으면 미기록. GREEN: reusable frame parent 면 기록
    it("canonical parent 가 reusable frame context(reusable=true) 면 historyManager.addEntry 호출된다", async () => {
      const frame = makeReusableFrame("frame-reusable-1");
      const doc = makeDoc([frame]);
      const element = makeElement("el-2", "Button", {
        parent_id: "frame-reusable-1",
      });

      const { setMock, getMock } = setupStateMocks({
        currentPageId: null,
        doc,
      });

      await createAddElementAction(setMock, getMock)(element);

      expect(historyModule.historyManager.addEntry).toHaveBeenCalledWith(
        expect.objectContaining({ type: "add", elementId: "el-2" }),
      );
    });

    // [RED] current code: currentPageId 있으면 무조건 기록 → orphan 도 기록됨.
    // GREEN: parent_id 가 canonical doc 에 없으면 orphan 으로 판정 → 미기록
    it("parent 가 orphan (canonical tree 에 없음) 시 historyManager.addEntry 호출되지 않는다", async () => {
      const doc = makeDoc([]); // 빈 document
      const element = makeElement("el-orphan", "Button", {
        parent_id: "missing-frame-id",
      });

      const { setMock, getMock } = setupStateMocks({
        currentPageId: "page-X", // currentPageId 있어도 orphan 이면 미기록
        doc,
      });

      await createAddElementAction(setMock, getMock)(element);

      expect(historyModule.historyManager.addEntry).not.toHaveBeenCalled();
    });

    // [Regression] page context + ownership marker 없는 조합 — GREEN 후에도 동작 보장
    it("page context + frame mirror undefined 조합에서도 히스토리 기록된다", async () => {
      const pageId = "page-2";
      const pageFrame = makePageRefFrame("frame-page-2", pageId);
      const doc = makeDoc([pageFrame]);
      const element = makeElement("el-3", "Text", {
        parent_id: "frame-page-2",
        // page_id, frame mirror 모두 undefined (P3-D-1 후 ownership 제거 상태)
      });

      const { setMock, getMock } = setupStateMocks({
        currentPageId: null,
        doc,
      });

      await createAddElementAction(setMock, getMock)(element);

      expect(historyModule.historyManager.addEntry).toHaveBeenCalled();
    });

    it("추가 element 의 customId 가 기존 element 와 중복되면 fresh customId 로 교체된다", async () => {
      const existing = makeElement("button-existing", "Button", {
        customId: "button_1",
      });
      const duplicate = makeElement("button-copy", "Button", {
        customId: "button_1",
      });
      const { state, setMock, getMock } = setupStateMocks({
        elementsMap: new Map([[existing.id, existing]]),
      });
      state.elements = [existing];

      await createAddElementAction(setMock, getMock)(duplicate);

      expect(
        state.elements.find((element) => element.id === "button-copy"),
      ).toMatchObject({
        customId: "button_2",
      });
    });

    it("ref instance 추가 시 customId 가 없으면 master type 기준 fresh customId 를 부여한다", async () => {
      const origin = makeElement("origin", "Button", {
        customId: "button_1",
      });
      const instance = makeElement("instance", "ref", {
        ref: "origin",
      } as never);
      const { state, setMock, getMock } = setupStateMocks({
        elementsMap: new Map([[origin.id, origin]]),
      });
      state.elements = [origin];

      await createAddElementAction(setMock, getMock)(instance);

      expect(
        state.elements.find((element) => element.id === "instance"),
      ).toMatchObject({
        customId: "button_2",
      });
    });
  });

  describe("createAddComplexElementAction — 히스토리 조건", () => {
    // [RED] current code: frame mirror/currentPageId 없으면 미기록. GREEN: page context → 기록
    it("canonical parent 가 page context 면 부모+자식 모두 포함한 historyManager.addEntry 호출된다", async () => {
      const pageFrame = makePageRefFrame("frame-page-3", "page-3");
      const doc = makeDoc([pageFrame]);
      const parent = makeElement("parent-1", "Tabs", {
        parent_id: "frame-page-3",
      });
      const children = [
        makeElement("child-1", "Tab", { parent_id: "parent-1" }),
        makeElement("child-2", "Tab", { parent_id: "parent-1" }),
      ];

      const { setMock, getMock } = setupStateMocks({
        currentPageId: null,
        doc,
      });

      await createAddComplexElementAction(setMock, getMock)(parent, children);

      expect(historyModule.historyManager.addEntry).toHaveBeenCalledWith(
        expect.objectContaining({
          type: "add",
          elementId: "parent-1",
          data: expect.objectContaining({
            childElements: expect.arrayContaining([
              expect.objectContaining({ id: "child-1" }),
              expect.objectContaining({ id: "child-2" }),
            ]),
          }),
        }),
      );
    });

    // [RED] reusable frame context (currentPageId/frame mirror 없음) → 현재 미기록
    it("canonical parent 가 reusable frame context 면 historyManager.addEntry 호출된다", async () => {
      const frame = makeReusableFrame("frame-reusable-2");
      const doc = makeDoc([frame]);
      const parent = makeElement("parent-2", "Tabs", {
        parent_id: "frame-reusable-2",
      });
      const children = [
        makeElement("child-3", "Tab", { parent_id: "parent-2" }),
      ];

      const { setMock, getMock } = setupStateMocks({
        currentPageId: null,
        doc,
      });

      await createAddComplexElementAction(setMock, getMock)(parent, children);

      expect(historyModule.historyManager.addEntry).toHaveBeenCalled();
    });

    // [RED] orphan parent + currentPageId — current 무조건 기록, GREEN 미기록
    it("orphan parent 시 historyManager.addEntry 호출되지 않는다", async () => {
      const doc = makeDoc([]);
      const parent = makeElement("parent-orphan", "Tabs", {
        parent_id: "missing-frame-id",
      });
      const children = [makeElement("child-orphan", "Tab")];

      const { setMock, getMock } = setupStateMocks({
        currentPageId: "page-X",
        doc,
      });

      await createAddComplexElementAction(setMock, getMock)(parent, children);

      expect(historyModule.historyManager.addEntry).not.toHaveBeenCalled();
    });

    it("복합 element 추가 시 부모와 자식 customId 를 batch 내부에서도 중복 없이 부여한다", async () => {
      const existing = makeElement("tabs-existing", "Tabs", {
        customId: "tabs_1",
      });
      const parent = makeElement("tabs-copy", "Tabs", {
        customId: "tabs_1",
      });
      const children = [
        makeElement("tab-copy-1", "Tab", { customId: "tab_1" }),
        makeElement("tab-copy-2", "Tab", { customId: "tab_1" }),
      ];
      const { state, setMock, getMock } = setupStateMocks();
      state.elements = [existing];

      await createAddComplexElementAction(setMock, getMock)(parent, children);

      expect(
        state.elements.find((element) => element.id === "tabs-copy"),
      ).toMatchObject({
        customId: "tabs_2",
      });
      expect(
        state.elements.find((element) => element.id === "tab-copy-1"),
      ).toMatchObject({
        customId: "tab_1",
      });
      expect(
        state.elements.find((element) => element.id === "tab-copy-2"),
      ).toMatchObject({
        customId: "tab_2",
      });
    });
  });

  describe("order_num 재정렬 — reusable frame 기반", () => {
    // [RED] current: frame mirror 없으면 reorder 미호출. GREEN: reusable frame parent 면 호출
    it("reusable frame 자식 추가 시 해당 frame 의 siblings 대상으로 재정렬된다", async () => {
      const frame = makeReusableFrame("frame-reusable-3");
      const doc = makeDoc([frame]);
      const element = makeElement("el-frame-child", "Button", {
        parent_id: "frame-reusable-3",
      });

      const { setMock, getMock } = setupStateMocks({
        currentPageId: null,
        doc,
      });

      const elementReorderModule = await import("../elementReorder");

      await createAddElementAction(setMock, getMock)(element);
      // queueMicrotask flush
      await new Promise((r) => queueMicrotask(() => r(null)));

      expect(elementReorderModule.reorderElements).toHaveBeenCalledWith(
        expect.any(Array),
        "frame-reusable-3",
        expect.any(Function),
      );
    });

    // [Regression] page reorder 경로 보존 — currentPageId + element.page_id 일치 시 reorder 동작
    it("page element 추가 시 기존 currentPageId 기반 재정렬 경로가 동작한다", async () => {
      const pageFrame = makePageRefFrame("frame-page-reorder", "page-reorder");
      const doc = makeDoc([pageFrame]);
      const pageId = "page-reorder";
      const element = makeElement("el-page", "Button", {
        page_id: pageId, // legacy ownership 유지 (currentPageId 매칭 경로)
        parent_id: "frame-page-reorder",
      });

      const { setMock, getMock } = setupStateMocks({
        currentPageId: pageId,
        doc,
      });

      const elementReorderModule = await import("../elementReorder");

      await createAddElementAction(setMock, getMock)(element);
      await new Promise((r) => queueMicrotask(() => r(null)));

      expect(elementReorderModule.reorderElements).toHaveBeenCalledWith(
        expect.any(Array),
        pageId,
        expect.any(Function),
      );
    });

    // [Regression] orphan + currentPageId 없음 + frame mirror 없음 — reorder 미호출
    it("orphan element 추가 시 재정렬 호출되지 않는다", async () => {
      const doc = makeDoc([]);
      const element = makeElement("el-orphan-reorder", "Button", {
        parent_id: "missing-frame-id",
      });

      const { setMock, getMock } = setupStateMocks({
        currentPageId: null,
        doc,
      });

      const elementReorderModule = await import("../elementReorder");

      await createAddElementAction(setMock, getMock)(element);
      await new Promise((r) => queueMicrotask(() => r(null)));

      expect(elementReorderModule.reorderElements).not.toHaveBeenCalled();
    });

    // [Static] dead code 제거 — GREEN 후 elementsMap.forEach + direct frame mirror compare
    // 패턴이 elementCreation.ts 에서 제거됐는지 grep 검증
    it("frame mirror 기반 elementsMap.forEach 순회 코드가 제거된다 (dead code 없음)", async () => {
      const fs = await import("node:fs/promises");
      const path = await import("node:path");
      const filePath = path.resolve(__dirname, "../elementCreation.ts");
      const source = await fs.readFile(filePath, "utf-8");
      // 정확한 패턴: elementsMap.forEach 안에서 direct frame mirror 비교
      const pattern = new RegExp(
        "elementsMap\\.forEach[\\s\\S]{0,200}el\\." + "layout_id\\s*===",
      );
      expect(source).not.toMatch(pattern);
    });
  });

  describe("P3-D-1 후 통합 — ownership 없는 element 처리", () => {
    // [RED] ownership 없는 element + page context — current 미기록, GREEN 기록
    it("page_id / frame mirror 없는 element 추가 시 히스토리 조건이 canonical parent 기반으로만 판정된다", async () => {
      const pageFrame = makePageRefFrame("frame-pure-1", "page-pure");
      const doc = makeDoc([pageFrame]);
      const element = makeElement("el-pure", "Button", {
        parent_id: "frame-pure-1",
        // page_id, frame mirror 모두 null (P3-D-1 ownership 제거 후)
      });

      const { setMock, getMock } = setupStateMocks({
        currentPageId: null,
        doc,
      });

      await createAddElementAction(setMock, getMock)(element);

      expect(historyModule.historyManager.addEntry).toHaveBeenCalled();
    });

    // [Static] P3-A dev assert 가 land 안 된 경우 grep 결과 0 — 회귀 방지
    it("P3-A dev-only assert(ownership 없음 경고) 가 P3-D-2 에서 제거된다", async () => {
      const fs = await import("node:fs/promises");
      const path = await import("node:path");
      const filePath = path.resolve(__dirname, "../elementCreation.ts");
      const source = await fs.readFile(filePath, "utf-8");
      // P3-A safe guard 패턴: warn("[elementCreation] ownership 없음", ...)
      expect(source).not.toMatch(/ownership 없음/);
    });

    // [Smoke] sanitizeElement 가 ownership 없는 element 도 정상 처리
    it("ownership 제거 후 IndexedDB 저장(sanitizeElement) 은 정상 동작한다", async () => {
      const pageFrame = makePageRefFrame("frame-smoke-1", "page-smoke");
      const doc = makeDoc([pageFrame]);
      const element = makeElement("el-smoke", "Button", {
        parent_id: "frame-smoke-1",
      });

      const { setMock, getMock } = setupStateMocks({
        currentPageId: null,
        doc,
      });

      const sanitizerModule =
        await import("../../../../adapters/canonical/legacyElementSanitizer");
      const dbModule = await import("../../../../lib/db");
      const db = await (dbModule.getDB as ReturnType<typeof vi.fn>)();

      await createAddElementAction(setMock, getMock)(element);

      expect(sanitizerModule.sanitizeElement).toHaveBeenCalled();
      expect(db.elements.insert).toHaveBeenCalled();
    });
  });

  describe("ADR-116 direct cutover — canonical primary persistence", () => {
    function registerCanonicalActionsForState(
      state: ReturnType<typeof setupStateMocks>["state"],
    ) {
      registerCanonicalMutationStoreActions({
        mergeElements: vi.fn(),
        setElements: vi.fn(),
        getCurrentLegacySnapshot: () => ({
          elements: state.elements,
          pages: [
            {
              id: "page-1",
              project_id: "project-1",
              title: "Home",
              slug: "/",
              parent_id: null,
              order_num: 0,
            } as Page,
          ],
          layouts: [
            {
              id: "frame-1",
              name: "Frame 1",
              project_id: "project-1",
              order_num: 0,
            },
          ],
        }),
        getCurrentProjectId: () => "project-1",
      });
    }

    it("page element 추가 시 canonical document 에 즉시 upsert 하고 document store 를 저장한다", async () => {
      const doc = makeDoc([
        {
          id: "page-1",
          type: "frame",
          name: "Home",
          metadata: { type: "legacy-page", pageId: "page-1" },
          children: [{ id: "body-page-1", type: "body", props: {} }],
        } as FrameNode,
      ]);
      const element = makeElement("button-1", "Button", {
        page_id: "page-1",
        parent_id: "body-page-1",
      });
      const { state, setMock, getMock } = setupStateMocks({
        currentPageId: "page-1",
        doc,
      });
      useCanonicalDocumentStore.getState().setCurrentProject("project-1");
      useCanonicalDocumentStore.getState().setDocument("project-1", doc);
      registerCanonicalActionsForState(state);

      await createAddElementAction(setMock, getMock)(element);

      const persistedDoc = useCanonicalDocumentStore
        .getState()
        .getDocument("project-1");
      const pageBody = (persistedDoc?.children[0] as FrameNode).children?.[0];
      expect(pageBody?.children?.map((node) => node.id)).toContain("button-1");

      const dbModule = await import("../../../../lib/db");
      const db = await (dbModule.getDB as ReturnType<typeof vi.fn>)();
      expect(db.documents.put).toHaveBeenCalledWith(
        "project-1",
        expect.objectContaining({ version: "composition-1.0" }),
      );
    });

    it("frame Slot 추가 시 canonical frame scope 에 즉시 포함된다", async () => {
      const doc = makeDoc([
        {
          id: "layout-frame-1",
          type: "frame",
          reusable: true,
          name: "Frame 1",
          metadata: { type: "legacy-layout", layoutId: "frame-1" },
          children: [{ id: "body-frame-1", type: "body", props: {} }],
        } as FrameNode,
      ]);
      const slot = makeElement("slot-1", "Slot", {
        layout_id: "frame-1",
        page_id: null,
        parent_id: "body-frame-1",
        props: { name: "content" },
      });
      const { state, setMock, getMock } = setupStateMocks({
        currentPageId: null,
        doc,
      });
      useCanonicalDocumentStore.getState().setCurrentProject("project-1");
      useCanonicalDocumentStore.getState().setDocument("project-1", doc);
      registerCanonicalActionsForState(state);

      await createAddElementAction(setMock, getMock)(slot);

      const persistedDoc = useCanonicalDocumentStore
        .getState()
        .getDocument("project-1");
      const frameBody = (persistedDoc?.children[0] as FrameNode).children?.[0];
      expect(frameBody?.children?.map((node) => node.id)).toContain("slot-1");
    });
  });
});
