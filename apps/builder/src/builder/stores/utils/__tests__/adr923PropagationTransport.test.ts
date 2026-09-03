import { readdirSync, readFileSync, statSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import ts from "typescript";
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
  dispatchSemanticUpdateWithPropagation,
  type SemanticUpdateActions,
} from "../../../panels/properties/semanticUpdateDispatch";

/**
 * ADR-923 Phase 5 후속 round 4·5 (fe3m1 · fe4m1) — propagation 부분 style patch 의 **transport seam**.
 *
 * round 3 은 생산자 (`buildPropagationUpdates` 가 `mergeStyle` 을 붙인다) 와 최종 소비 helper
 * (`applyBatchStylePatch` 가 병합한다) 를 각각 단위로 고정했지만, 그 사이 — Properties 패널의
 * 매핑 → `updateSelectedPropertiesWithChildren` → `sanitizeInspectorProps` → `batchUpdateElementProps`
 * → `sanitizePropsPatch` — 을 실행하는 게이트가 없었다 (fe3m1). round 4 는 매핑을 helper 로 뽑았지만
 * 테스트가 그 helper 를 **직접 주입**해, 패널이 helper 반환값을 버리고 원본을 넘기는 변형도 통과했다
 * (fe4m1). 그래서 패널 콜백의 store 호출 흐름 전체를 `dispatchSemanticUpdateWithPropagation` 으로
 * 뽑고 여기서는 **그 함수 자체**를 실제 inspector slice 위에서 돌린다. 패널이 그 함수를 거치는지는
 * 아래 AST 게이트가 잠근다.
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
 * 실제 store 를 세운다 — mock 은 db · history · save 세 모듈뿐이고, inspector slice 와
 * `batchUpdateElementProps` 는 production 팩토리 그대로다.
 */
function setUpStore() {
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
  const inspectorActions = createInspectorActionsSlice(set, get, {} as never);
  return { fixture, state, inspectorActions };
}

function readChildStyle(state: MockState) {
  return (state.elementsMap.get("field-error")?.props as Record<string, unknown>)
    .style;
}

async function readCanonicalChild(): Promise<CanonicalNode> {
  await vi.waitFor(() => {
    expect(mocks.db.documents.put).toHaveBeenCalled();
  });
  const doc = useCanonicalDocumentStore.getState().getDocument("project-1");
  return JSON.parse(JSON.stringify(doc)).children[0].children[0].children[0]
    .children[1] as CanonicalNode;
}

const PANEL_PATH = resolve(
  __dirname,
  "../../../panels/properties/PropertiesPanel.tsx",
);
const DISPATCH_PATH = resolve(
  __dirname,
  "../../../panels/properties/semanticUpdateDispatch.ts",
);

/** `apps/builder/src` 의 production 파일 (테스트 제외) 을 재귀로 모은다. */
function listProductionSources(root: string): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(root)) {
    const full = join(root, entry);
    if (statSync(full).isDirectory()) {
      if (entry === "__tests__" || entry === "node_modules") continue;
      out.push(...listProductionSources(full));
      continue;
    }
    if (!/\.(ts|tsx)$/.test(entry) || /\.test\.tsx?$/.test(entry)) continue;
    out.push(full);
  }
  return out;
}

describe("ADR-923 fe3m1·fe4m1 — propagation 부분 style patch 의 transport 체인", () => {
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

  it("패널의 dispatch 함수 → inspector slice → batch 저장까지 자식의 나머지 style 이 살아남는다", async () => {
    const { fixture, state, inspectorActions } = setUpStore();

    const result = dispatchSemanticUpdateWithPropagation({
      changedProps: { isInvalid: true },
      propagationElement: fixture.field as never,
      childrenMap: state.childrenMap as never,
      elementsMap: state.elementsMap as never,
      // 패널이 넘기는 것과 같은 형태 — store 액션 객체 그대로
      actions: inspectorActions as unknown as SemanticUpdateActions,
    });
    expect(result).toBe("with-children");

    const expected = { ...AUTHORED_CHILD_STYLE, display: "block" };
    // store
    expect(readChildStyle(state)).toEqual(expected);
    // canonical document (persist 대상)
    const canonicalChild = await readCanonicalChild();
    expect((canonicalChild.props as Record<string, unknown>).style).toEqual(
      expected,
    );
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
    // 부모 자신의 변경도 같은 batch 에 실린다
    expect(state.elementsMap.get("field")?.props).toMatchObject({
      isInvalid: true,
    });
  });

  it("규칙이 안 걸리는 prop 은 자식을 건드리지 않고 updateSelectedProperties 로 간다", () => {
    const { fixture, state, inspectorActions } = setUpStore();
    const result = dispatchSemanticUpdateWithPropagation({
      changedProps: { placeholder: "x" },
      propagationElement: fixture.field as never,
      childrenMap: state.childrenMap as never,
      elementsMap: state.elementsMap as never,
      actions: inspectorActions as unknown as SemanticUpdateActions,
    });
    expect(result).toBe("plain");
    expect(readChildStyle(state)).toEqual(AUTHORED_CHILD_STYLE);
  });

  it("mergeStyle 없이 slice 에 직접 넣으면 자식 style 이 통째 교체된다 (계약 대조)", () => {
    const { state, inspectorActions } = setUpStore();
    inspectorActions.updateSelectedPropertiesWithChildren({ isInvalid: true }, [
      { elementId: "field-error", props: { style: { display: "block" } } },
    ]);
    expect(readChildStyle(state)).toEqual({ display: "block" });
  });

  it("PropertiesPanel.handleSemanticUpdate 는 store 액션을 직접 부르지 않고 dispatch 함수에 state 를 넘긴다 (AST)", async () => {
    const source = await readFile(PANEL_PATH, "utf-8");
    const sf = ts.createSourceFile(
      PANEL_PATH,
      source,
      ts.ScriptTarget.Latest,
      true,
      ts.ScriptKind.TSX,
    );

    // 1) `const handleSemanticUpdate = useCallback((key, value) => { ... }, deps)` 의 콜백 본문
    let callback: ts.ArrowFunction | ts.FunctionExpression | undefined;
    const findCallback = (node: ts.Node) => {
      if (
        ts.isVariableDeclaration(node) &&
        ts.isIdentifier(node.name) &&
        node.name.text === "handleSemanticUpdate" &&
        node.initializer &&
        ts.isCallExpression(node.initializer) &&
        ts.isIdentifier(node.initializer.expression) &&
        node.initializer.expression.text === "useCallback"
      ) {
        const first = node.initializer.arguments[0];
        if (first && (ts.isArrowFunction(first) || ts.isFunctionExpression(first))) {
          callback = first;
        }
      }
      ts.forEachChild(node, findCallback);
    };
    findCallback(sf);
    expect(callback, "handleSemanticUpdate useCallback").toBeDefined();

    // 2) 본문 안: `dispatchSemanticUpdateWithPropagation({ ..., actions: state })` 정확히 1회,
    //    `state` 는 같은 본문에서 `useStore.getState()` 로 선언
    const dispatchCalls: ts.CallExpression[] = [];
    const directStoreCalls: string[] = [];
    let stateFromStore = false;
    const walk = (node: ts.Node) => {
      if (ts.isCallExpression(node)) {
        const callee = node.expression;
        if (
          ts.isIdentifier(callee) &&
          callee.text === "dispatchSemanticUpdateWithPropagation"
        ) {
          dispatchCalls.push(node);
        }
        if (
          ts.isPropertyAccessExpression(callee) &&
          [
            "updateSelectedProperties",
            "updateSelectedPropertiesWithChildren",
            "batchUpdateElementProps",
          ].includes(callee.name.text)
        ) {
          directStoreCalls.push(callee.getText(sf));
        }
      }
      if (
        ts.isVariableDeclaration(node) &&
        ts.isIdentifier(node.name) &&
        node.name.text === "state" &&
        node.initializer &&
        node.initializer.getText(sf) === "useStore.getState()"
      ) {
        stateFromStore = true;
      }
      ts.forEachChild(node, walk);
    };
    walk(callback!.body);

    expect(directStoreCalls).toEqual([]);
    expect(dispatchCalls).toHaveLength(1);
    expect(stateFromStore).toBe(true);
    const arg = dispatchCalls[0].arguments[0];
    expect(arg && ts.isObjectLiteralExpression(arg)).toBe(true);
    const props = new Map(
      (arg as ts.ObjectLiteralExpression).properties.map((p) => [
        p.name && ts.isIdentifier(p.name) ? p.name.text : "",
        p,
      ]),
    );
    for (const key of [
      "changedProps",
      "propagationElement",
      "childrenMap",
      "elementsMap",
      "actions",
    ]) {
      expect(props.has(key), `dispatch arg.${key}`).toBe(true);
    }
    const actions = props.get("actions")!;
    expect(
      ts.isPropertyAssignment(actions) && actions.initializer.getText(sf),
    ).toBe("state");
  });

  it("propagation → batch 변환의 production 호출자는 semanticUpdateDispatch 하나다", () => {
    const srcRoot = resolve(__dirname, "../../../..");
    const callers = listProductionSources(srcRoot).filter((file) => {
      if (file === DISPATCH_PATH) return false;
      const text = readFileSync(file, "utf-8");
      return (
        /\btoBatchPropsUpdates\s*\(/.test(text) &&
        !file.endsWith("/utils/propagationEngine.ts")
      );
    });
    expect(callers).toEqual([]);
    const dispatchSource = readFileSync(DISPATCH_PATH, "utf-8");
    expect(dispatchSource).toMatch(
      /updateSelectedPropertiesWithChildren\(\s*changedProps,\s*toBatchPropsUpdates\(childUpdates\),?\s*\)/,
    );
  });
});
