import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { CanonicalNode, CompositionDocument } from "@composition/shared";
import type { Element, Page } from "../../../../types/builder/unified.types";
import { saveService } from "../../../../services/save";
import { historyManager } from "../../history";
import { useCanonicalDocumentStore } from "../../canonical/canonicalDocumentStore";
import {
  registerCanonicalMutationStoreActions,
  resetCanonicalMutationStoreActions,
} from "@/adapters/canonical/canonicalMutations";
import { buildLegacyElementMetadata } from "@/adapters/canonical/legacyMetadata";
import { createInspectorActionsSlice } from "../../inspectorActions";
import { createBatchUpdateElementPropsAction } from "../elementUpdate";
import type { BatchPropsUpdate } from "../elementUpdate";
import {
  buildPropagationUpdates,
  toBatchPropsUpdates,
} from "../../../utils/propagationEngine";
import { getPropagationRules } from "../../../utils/propagationRegistry";

/**
 * ADR-923 Phase 5 후속 round 4 (fe3m1) — propagation 부분 style patch 의 **transport seam**.
 *
 * round 3 은 생산자 (`buildPropagationUpdates` 가 `mergeStyle` 을 붙인다) 와 최종 소비 helper
 * (`applyBatchStylePatch` 가 병합한다) 를 각각 단위로 고정했지만, 그 사이 구간 —
 * Inspector 화면의 매핑 → `updateSelectedPropertiesWithChildren` → `sanitizeInspectorProps` →
 * `batchUpdateElementProps` → `sanitizePropsPatch` — 을 실행하는 게이트가 없었다. 중간에서
 * 플래그가 빠져도 두 단위 테스트는 통과한다.
 *
 * 여기서는 그 체인을 실제로 실행해 자식의 나머지 style (fill 파생 키 포함) 이 store · canonical
 * document · history next props 세 곳에서 모두 살아 있는지 본다.
 */

const mocks = vi.hoisted(() => ({
  db: {
    elements: {
      deleteMany: vi.fn(async () => {}),
      insertMany: vi.fn(async () => {}),
      update: vi.fn(async (_id: string) => {}),
    },
    documents: { put: vi.fn(async () => {}) },
  },
}));

vi.mock("../../../../lib/db", () => ({
  getDB: vi.fn(async () => mocks.db),
}));

vi.mock("../../history", () => ({
  historyManager: {
    addEntry: vi.fn(),
    addBatchDiffEntry: vi.fn(),
  },
}));

vi.mock("../../../../services/save", () => ({
  saveService: { savePropertyChange: vi.fn(async () => {}) },
}));

type MockState = {
  elements: Element[];
  elementsMap: Map<string, Element>;
  childrenMap: Map<string, Element[]>;
  currentPageId: string | null;
  pages: Page[];
  selectedElementId: string | null;
  selectedElementIds: string[];
  selectedElementIdsSet: Set<string>;
  selectedElementProps: Record<string, unknown>;
  editingContextId: string | null;
  dirtyElementIds: Set<string>;
  layoutVersion: number;
  activeBreakpoint: "desktop" | "tablet" | "mobile";
  _cancelHydrateSelectedProps: ReturnType<typeof vi.fn>;
  updateElement: ReturnType<typeof vi.fn>;
  batchUpdateElementProps: (updates: BatchPropsUpdate[]) => Promise<void>;
};

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

/** FieldError 자식의 저작 style — fill 파생 키 (backgroundColor) 를 포함한다. */
const AUTHORED_CHILD_STYLE = {
  display: "none",
  fontSize: 13,
  color: "rgb(1, 2, 3)",
  backgroundColor: "rgb(9, 9, 9)",
};

function makeFixture() {
  const body = makeElement("body", "body");
  const field = makeElement("field", "TextField", {
    parent_id: "body",
    props: {
      label: "Name",
      size: "md",
      isInvalid: false,
      errorMessage: "",
    },
  });
  const label = makeElement("field-label", "Label", {
    parent_id: "field",
    props: { children: "Name" },
  });
  const fieldError = makeElement("field-error", "FieldError", {
    parent_id: "field",
    order_num: 1,
    props: { children: "", style: { ...AUTHORED_CHILD_STYLE } },
  });
  return { body, field, label, fieldError };
}

function makeState(elements: Element[]): MockState {
  const elementsMap = new Map(elements.map((el) => [el.id, el]));
  const childrenMap = new Map<string, Element[]>();
  for (const element of elements) {
    const parentId = element.parent_id ?? "root";
    childrenMap.set(parentId, [...(childrenMap.get(parentId) ?? []), element]);
  }
  return {
    elements,
    elementsMap,
    childrenMap,
    currentPageId: "page-1",
    pages: [
      {
        id: "page-1",
        project_id: "project-1",
        title: "page-1",
        slug: "/page-1",
        parent_id: null,
        order_num: 0,
      } as Page,
    ],
    selectedElementId: "field",
    selectedElementIds: ["field"],
    selectedElementIdsSet: new Set(["field"]),
    selectedElementProps: {},
    editingContextId: null,
    dirtyElementIds: new Set(),
    layoutVersion: 0,
    activeBreakpoint: "desktop",
    _cancelHydrateSelectedProps: vi.fn(),
    updateElement: vi.fn(),
    batchUpdateElementProps: async () => {},
  };
}

function createSetMock(state: MockState) {
  return vi.fn(
    (
      patch: Partial<MockState> | ((current: MockState) => Partial<MockState>),
    ) => {
      const nextPatch = typeof patch === "function" ? patch(state) : patch;
      Object.assign(state, nextPatch);
    },
  );
}

function canonicalNode(element: Element): CanonicalNode {
  return {
    id: element.id,
    type: element.type,
    props: element.props as Record<string, unknown>,
    metadata: buildLegacyElementMetadata(element),
  } as CanonicalNode;
}

function makeDocument(fixture: ReturnType<typeof makeFixture>) {
  return {
    version: "composition-1.0",
    children: [
      {
        id: "page-1",
        type: "frame",
        metadata: { type: "legacy-page", pageId: "page-1" },
        children: [
          {
            ...canonicalNode(fixture.body),
            type: "body" as CanonicalNode["type"],
            children: [
              {
                ...canonicalNode(fixture.field),
                children: [
                  canonicalNode(fixture.label),
                  canonicalNode(fixture.fieldError),
                ],
              },
            ],
          },
        ],
      },
    ],
  } as unknown as CompositionDocument;
}

/**
 * 실제 체인 실행 — Inspector 화면이 하는 일을 그대로 한다.
 *
 * `transport` 로 매핑 함수를 주입해, 정본 (`toBatchPropsUpdates`) 과 `mergeStyle` 을 떨어뜨린
 * 매핑을 같은 체인에서 대조한다.
 */
async function runPropagationChain(
  transport: (
    updates: ReturnType<typeof buildPropagationUpdates>,
  ) => BatchPropsUpdate[],
  changedProps: Record<string, unknown> = { isInvalid: true },
) {
  const fixture = makeFixture();
  const state = makeState([
    fixture.body,
    fixture.field,
    fixture.label,
    fixture.fieldError,
  ]);
  registerCanonicalMutationStoreActions({
    getCurrentLegacySnapshot: () => ({
      elements: state.elements,
      pages: state.pages,
      layouts: [],
    }),
    getCurrentProjectId: () => "project-1",
  });
  useCanonicalDocumentStore.getState().setCurrentProject("project-1");
  useCanonicalDocumentStore
    .getState()
    .setDocument("project-1", makeDocument(fixture));

  const set = createSetMock(state) as never;
  const get = (() => state) as never;
  state.batchUpdateElementProps = createBatchUpdateElementPropsAction(set, get);

  const rules = getPropagationRules("TextField");
  expect(rules).toBeTruthy();
  const childUpdates = buildPropagationUpdates(
    fixture.field as never,
    changedProps,
    rules!,
    state.childrenMap as never,
    state.elementsMap as never,
  );
  expect(childUpdates.length).toBeGreaterThan(0);

  const inspectorActions = createInspectorActionsSlice(set, get, {} as never);
  inspectorActions.updateSelectedPropertiesWithChildren(
    changedProps,
    transport(childUpdates),
  );
  await vi.waitFor(() => {
    expect(mocks.db.documents.put).toHaveBeenCalled();
  });

  const doc = useCanonicalDocumentStore.getState().getDocument("project-1");
  const canonicalChild = JSON.parse(JSON.stringify(doc)).children[0].children[0]
    .children[0].children[1] as CanonicalNode;
  return { state, canonicalChild };
}

describe("ADR-923 fe3m1 — propagation 부분 style patch 의 transport 체인", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.db.elements.update.mockImplementation(async () => {});
    mocks.db.documents.put.mockImplementation(async () => {});
    vi.mocked(saveService.savePropertyChange).mockResolvedValue(undefined);
    resetCanonicalMutationStoreActions();
    useCanonicalDocumentStore.setState({
      documents: new Map(),
      currentProjectId: "project-1",
      documentVersion: 0,
    });
    (globalThis as { indexedDB?: unknown }).indexedDB = {};
  });

  it("Panel 매핑 → inspector slice → batch 저장까지 자식의 나머지 style 이 살아남는다", async () => {
    const { state, canonicalChild } = await runPropagationChain((updates) =>
      toBatchPropsUpdates<BatchPropsUpdate>(updates),
    );

    const expected = {
      ...AUTHORED_CHILD_STYLE,
      display: "block",
    };
    // store
    expect(
      (state.elementsMap.get("field-error")?.props as Record<string, unknown>)
        .style,
    ).toEqual(expected);
    // canonical document (persist 대상)
    expect(
      (canonicalChild.props as Record<string, unknown>).style,
    ).toEqual(expected);
    // history nextProps — undo/redo 가 복원하는 값 (merged 전체 props 계약)
    const entry = vi.mocked(historyManager.addEntry).mock.calls.at(-1)?.[0] as {
      data?: {
        canonicalEvents?: {
          nodeId: string;
          nextProps?: Record<string, unknown>;
        }[];
      };
    };
    const childEvent = entry?.data?.canonicalEvents?.find(
      (event) => event.nodeId === "field-error",
    );
    expect(childEvent?.nextProps?.style).toEqual(expected);
    // errorMessage → children 규칙은 style 밖 필드라 같은 batch 에서 그대로 실린다
    expect(
      (state.elementsMap.get("field-error")?.props as Record<string, unknown>)
        .children,
    ).toBe("");
  });

  it("transport 가 mergeStyle 을 떨어뜨리면 자식 style 이 통째 교체된다 (계약 대조)", async () => {
    const { state } = await runPropagationChain((updates) =>
      updates.map((u) => ({
        elementId: u.elementId,
        props: u.props as BatchPropsUpdate["props"],
      })),
    );

    expect(
      (state.elementsMap.get("field-error")?.props as Record<string, unknown>)
        .style,
    ).toEqual({ display: "block" });
  });

  it("Inspector 화면은 매핑을 재작성하지 않고 toBatchPropsUpdates 를 쓴다", async () => {
    const source = await readFile(
      resolve(__dirname, "../../../panels/properties/PropertiesPanel.tsx"),
      "utf-8",
    );
    expect(source).toContain("toBatchPropsUpdates<BatchPropsUpdate>(");
    // 인라인 재작성 (`...(u.mergeStyle ? ...)`) 이 되살아나면 seam 이 다시 게이트 밖으로 나간다
    expect(source).not.toMatch(/mergeStyle\s*\?\s*\{\s*mergeStyle/);
  });
});
