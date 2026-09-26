import { beforeEach, describe, expect, it, vi } from "vitest";
import type { CanonicalNode, CompositionDocument } from "@composition/shared";
import type { Element, Page } from "../../../../types/builder/unified.types";
import { useCanonicalDocumentStore } from "../canonicalDocumentStore";
import {
  registerCanonicalMutationStoreActions,
  resetCanonicalMutationStoreActions,
} from "@/adapters/canonical/canonicalMutations";
import { createInspectorActionsSlice } from "../../inspectorActions";
import { withComponentInstanceMirror } from "@/adapters/canonical/componentSemanticsMirror";
import {
  getSyntheticDescendantChildren,
  getSyntheticDescendantLookup,
  getSyntheticDescendantPathKey,
  getSyntheticDescendantRootId,
  isSyntheticDescendantId,
} from "../syntheticDescendantLookup";

/**
 * ADR-229 Phase 2 (F15) — synthetic 자식 (`<instance>/<path>`) 의 Properties 표면.
 * 읽기 = 해소된 노드 (origin ⊕ 조합 자식 patch ⊕ 바깥 instance descendants) · 쓰기 = 바깥 instance
 * 의 `descendants[path]` 하나 (조합 origin · 자식 origin 무오염).
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
}));

vi.mock("../../../../lib/db", () => ({
  getDB: vi.fn(async () => mocks.db),
}));
vi.mock("../../history", () => ({
  historyManager: { addEntry: vi.fn(), addBatchDiffEntry: vi.fn() },
}));
vi.mock("../../../../services/save", () => ({
  saveService: { savePropertyChange: vi.fn(async () => {}) },
}));

const INSTANCE_ID = "form-1";
const ACTION_ID = "component-form__action";
const SYNTHETIC_ID = `${INSTANCE_ID}/${ACTION_ID}`;

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

function makeDocument(
  instanceDescendants?: Record<string, Record<string, unknown>>,
  actionStyle?: Record<string, unknown>,
): CompositionDocument {
  return {
    version: "composition-1.0",
    children: [
      {
        id: "page-components",
        type: "frame",
        metadata: { type: "legacy-page", pageId: "page-components" },
        children: [
          {
            id: "page-components-body",
            type: "body",
            props: {},
            children: [
              {
                id: "component-button",
                type: "Button",
                reusable: true,
                props: { children: "Button", variant: "primary", size: "md" },
                children: [
                  {
                    id: "component-button__1",
                    type: "Text",
                    props: { children: "Button" },
                  },
                ],
              },
              {
                id: "component-form",
                type: "Form",
                reusable: true,
                props: { labelPosition: "top" },
                children: [
                  {
                    id: ACTION_ID,
                    type: "ref",
                    ref: "component-button",
                    props: {
                      children: "Save",
                      variant: "accent",
                      ...(actionStyle ? { style: actionStyle } : {}),
                    },
                  },
                ],
              },
            ],
          },
        ],
      },
      {
        id: "page-1",
        type: "frame",
        metadata: { type: "legacy-page", pageId: "page-1" },
        children: [
          {
            id: "body",
            type: "body",
            props: {},
            children: [
              {
                id: INSTANCE_ID,
                type: "ref",
                ref: "component-form",
                props: {},
                ...(instanceDescendants
                  ? { descendants: instanceDescendants }
                  : {}),
              },
            ],
          },
        ],
      },
    ],
  } as unknown as CompositionDocument;
}

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
};

function setUpStore(selectedElementId: string) {
  const body = makeElement("body", "body");
  const instance = withComponentInstanceMirror(
    makeElement(INSTANCE_ID, "ref", {
      parent_id: "body",
      ref: "component-form",
    }),
    "component-form",
  );
  const elements = [body, instance];
  const state: MockState = {
    elements,
    elementsMap: new Map(elements.map((el) => [el.id, el])),
    childrenMap: new Map([["body", [instance]]]),
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
      elements: state.elements,
      pages: state.pages,
      layouts: [],
    }),
    getCurrentProjectId: () => "project-1",
  });
  const set = vi.fn(
    (
      patch: Partial<MockState> | ((current: MockState) => Partial<MockState>),
    ) => {
      Object.assign(state, typeof patch === "function" ? patch(state) : patch);
    },
  ) as never;
  const get = (() => state) as never;
  const inspectorActions = createInspectorActionsSlice(set, get, {} as never);
  return { state, inspectorActions };
}

function readInstanceNode():
  | (CanonicalNode & { descendants?: Record<string, Record<string, unknown>> })
  | undefined {
  const doc = useCanonicalDocumentStore.getState().getDocument("project-1");
  const page = doc?.children.find((node) => node.id === "page-1");
  const body = page?.children?.find((node) => node.id === "body");
  return body?.children?.find((node) => node.id === INSTANCE_ID) as
    | (CanonicalNode & {
        descendants?: Record<string, Record<string, unknown>>;
      })
    | undefined;
}

function readOriginNode(id: string): CanonicalNode | undefined {
  const doc = useCanonicalDocumentStore.getState().getDocument("project-1");
  const page = doc?.children.find((node) => node.id === "page-components");
  const body = page?.children?.find(
    (node) => node.id === "page-components-body",
  );
  return body?.children?.find((node) => node.id === id);
}

describe("ADR-229 Phase 2 (F15) — synthetic 자식 lookup", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resetCanonicalMutationStoreActions();
    useCanonicalDocumentStore.setState({
      documents: new Map(),
      currentProjectId: "project-1",
      documentVersion: 0,
    });
    (globalThis as { indexedDB?: unknown }).indexedDB = {};
  });

  it("id 판정 — `<instance>/<path>` 만, projection · page-frame 은 아님", () => {
    expect(isSyntheticDescendantId(SYNTHETIC_ID)).toBe(true);
    expect(isSyntheticDescendantId(INSTANCE_ID)).toBe(false);
    expect(isSyntheticDescendantId("projection:tag-row:x/y")).toBe(false);
    expect(isSyntheticDescendantId("a::page-frame::b/c")).toBe(false);
    expect(getSyntheticDescendantRootId(SYNTHETIC_ID)).toBe(INSTANCE_ID);
    expect(getSyntheticDescendantPathKey(`${INSTANCE_ID}/a/b`)).toBe("a/b");
  });

  it("해소된 노드 = Button origin ⊕ 조합 자식 patch ⊕ 바깥 instance descendants · 자식도 해소", () => {
    useCanonicalDocumentStore.getState().setCurrentProject("project-1");
    useCanonicalDocumentStore.getState().setDocument(
      "project-1",
      makeDocument({
        [ACTION_ID]: { children: "Go", style: { borderRadius: 14 } },
      }),
    );
    const lookup = getSyntheticDescendantLookup(SYNTHETIC_ID);
    expect(lookup?.node.id).toBe(SYNTHETIC_ID);
    expect(lookup?.node.type).toBe("Button");
    expect(lookup?.parentId).toBe(INSTANCE_ID);
    expect(lookup?.pageId).toBe("page-1");
    expect(lookup?.node.props).toMatchObject({
      children: "Go",
      variant: "accent",
      size: "md",
      style: { borderRadius: 14 },
    });
    // 자식 (Button 의 Text) 도 synthetic id 로.
    expect(
      getSyntheticDescendantChildren(SYNTHETIC_ID).map((child) => child.id),
    ).toEqual([`${SYNTHETIC_ID}/component-button__1`]);
    // plain id · 없는 path 는 null.
    expect(getSyntheticDescendantLookup(INSTANCE_ID)).toBeNull();
    expect(getSyntheticDescendantLookup(`${INSTANCE_ID}/nope`)).toBeNull();
  });

  it("inspector 쓰기 — synthetic 선택의 updateSelectedProperties 는 바깥 instance descendants 로만 간다", async () => {
    useCanonicalDocumentStore.getState().setCurrentProject("project-1");
    useCanonicalDocumentStore
      .getState()
      .setDocument("project-1", makeDocument());
    const { state, inspectorActions } = setUpStore(SYNTHETIC_ID);

    inspectorActions.updateSelectedProperties({
      children: "Go",
      variant: "secondary",
    });
    await vi.waitFor(() => {
      expect(readInstanceNode()?.descendants).toBeDefined();
    });
    expect(readInstanceNode()?.descendants).toEqual({
      [ACTION_ID]: { children: "Go", variant: "secondary" },
    });
    expect(
      (state.elementsMap.get(INSTANCE_ID) as { descendants?: unknown })
        ?.descendants,
    ).toEqual({ [ACTION_ID]: { children: "Go", variant: "secondary" } });
    // 조합 origin · Button origin 무오염, synthetic id 노드는 생기지 않는다.
    expect(readOriginNode("component-form")?.children?.[0]?.props).toEqual({
      children: "Save",
      variant: "accent",
    });
    expect(readOriginNode("component-button")?.props).toEqual({
      children: "Button",
      variant: "primary",
      size: "md",
    });
    expect(state.elementsMap.has(SYNTHETIC_ID)).toBe(false);
    // F22 (live 실측): props 가 빈 descendants 쓰기도 재레이아웃 대상 — 아니면 Skia 가 stale rect.
    expect(state.layoutVersion).toBeGreaterThan(0);
    // 두 번째 편집은 기존 patch 위에 병합 (style deep).
    inspectorActions.updateSelectedProperties({ style: { borderRadius: 14 } });
    await vi.waitFor(() => {
      expect(readInstanceNode()?.descendants?.[ACTION_ID]).toMatchObject({
        style: { borderRadius: 14 },
      });
    });
    expect(readInstanceNode()?.descendants).toEqual({
      [ACTION_ID]: {
        children: "Go",
        variant: "secondary",
        style: { borderRadius: 14 },
      },
    });
    // 읽기는 즉시 새 patch 를 본다.
    expect(
      getSyntheticDescendantLookup(SYNTHETIC_ID)?.node.props,
    ).toMatchObject({
      children: "Go",
      variant: "secondary",
      style: { borderRadius: 14 },
    });
  });

  describe("tier (tablet · mobile) override — synthetic 도 descendants patch 의 responsive 로", () => {
    const readPatch = () =>
      readInstanceNode()?.descendants?.[ACTION_ID] as
        Record<string, unknown> | undefined;

    it("tablet override 켜기 → patch.responsive 에 그 키 · tier 만, desktop style 은 그대로", async () => {
      useCanonicalDocumentStore.getState().setCurrentProject("project-1");
      useCanonicalDocumentStore
        .getState()
        .setDocument("project-1", makeDocument(undefined, { paddingTop: 8 }));
      const { state, inspectorActions } = setUpStore(SYNTHETIC_ID);
      state.activeBreakpoint = "tablet";

      inspectorActions.setResponsiveStyleOverrideEnabled("paddingTop", true);
      await vi.waitFor(() => {
        expect(readPatch()?.responsive).toBeDefined();
      });
      expect(readPatch()).toEqual({
        responsive: { styles: { paddingTop: { tablet: 8 } } },
      });

      // 켠 뒤 tablet 편집은 tier 로 — desktop (style) 은 바뀌지 않는다
      inspectorActions.updateSelectedStyle("paddingTop", "24px");
      await vi.waitFor(() => {
        expect(
          (readPatch()?.responsive as { styles: Record<string, unknown> })
            ?.styles?.paddingTop,
        ).toEqual({ tablet: 24 });
      });
      expect(readPatch()?.style).toBeUndefined();
      expect(
        (
          getSyntheticDescendantLookup(SYNTHETIC_ID)?.node.props?.style as
            Record<string, unknown> | undefined
        )?.paddingTop,
      ).toBe(8);

      // 끄기 → patch 에서 tier 키가 빠진다 (origin 복귀)
      inspectorActions.setResponsiveStyleOverrideEnabled("paddingTop", false);
      await vi.waitFor(() => {
        expect(readPatch()?.responsive).toBeUndefined();
      });
    });

    it("켤 때 인라인이 없으면 메뉴가 넘긴 catalog 기본값을 seed 로 (CSS 초기값 row 가 아니다)", async () => {
      useCanonicalDocumentStore.getState().setCurrentProject("project-1");
      useCanonicalDocumentStore
        .getState()
        .setDocument("project-1", makeDocument(undefined, { paddingTop: 8 }));
      const { state, inspectorActions } = setUpStore(SYNTHETIC_ID);
      state.activeBreakpoint = "tablet";

      inspectorActions.setResponsiveStyleOverrideEnabled(
        "flexDirection",
        true,
        {
          flexDirection: "column",
          paddingTop: "4",
        },
      );
      await vi.waitFor(() => {
        expect(readPatch()?.responsive).toBeDefined();
      });
      expect(readPatch()?.responsive).toEqual({
        styles: { flexDirection: { tablet: "column" } },
      });

      // 인라인 (origin 자식의 paddingTop 8) 이 있으면 catalog 값보다 인라인
      inspectorActions.setResponsiveStyleOverrideEnabled("paddingTop", true, {
        paddingTop: "4",
      });
      await vi.waitFor(() => {
        expect(
          (readPatch()?.responsive as { styles: Record<string, unknown> })
            ?.styles?.paddingTop,
        ).toEqual({ tablet: 8 });
      });
    });

    it("origin 자식의 tier 값은 patch 로 복사되지 않고 해석에서 함께 보인다", async () => {
      useCanonicalDocumentStore.getState().setCurrentProject("project-1");
      const doc = makeDocument(undefined, { paddingTop: 8, gap: 4 });
      const action = (
        doc.children[0].children![0].children![1].children as unknown as Array<
          Record<string, unknown>
        >
      )[0];
      action.responsive = { styles: { gap: { tablet: 12 } } };
      useCanonicalDocumentStore.getState().setDocument("project-1", doc);
      const { state, inspectorActions } = setUpStore(SYNTHETIC_ID);
      state.activeBreakpoint = "tablet";

      inspectorActions.setResponsiveStyleOverrideEnabled("paddingTop", true);
      await vi.waitFor(() => {
        expect(readPatch()?.responsive).toBeDefined();
      });
      expect(readPatch()).toEqual({
        responsive: { styles: { paddingTop: { tablet: 8 } } },
      });
      const resolved = getSyntheticDescendantLookup(SYNTHETIC_ID)?.node as {
        responsive?: { styles?: Record<string, unknown> };
      };
      expect(resolved.responsive?.styles).toEqual({
        gap: { tablet: 12 },
        paddingTop: { tablet: 8 },
      });
    });
  });

  describe("style 쓰기 — 바뀐 키만 patch 에 (해석 style 전체를 굳히지 않는다)", () => {
    const fill = {
      id: "fill-1",
      type: "color",
      color: "#ff0000ff",
      enabled: true,
      opacity: 1,
      blendMode: "normal",
    };

    it("updateSelectedFills 는 fills 만 쓴다 — origin style (width) 이 patch 로 복사되지 않는다", async () => {
      useCanonicalDocumentStore.getState().setCurrentProject("project-1");
      useCanonicalDocumentStore
        .getState()
        .setDocument(
          "project-1",
          makeDocument(undefined, { width: "100%", borderRadius: 4 }),
        );
      const { inspectorActions } = setUpStore(SYNTHETIC_ID);

      inspectorActions.updateSelectedFills([fill] as never);
      await vi.waitFor(() => {
        expect(readInstanceNode()?.descendants?.[ACTION_ID]).toBeDefined();
      });
      expect(readInstanceNode()?.descendants).toEqual({
        [ACTION_ID]: { fills: [fill] },
      });
    });

    it("updateSelectedStyle 는 그 키만 쓴다 — origin 값은 patch 에 없다", async () => {
      useCanonicalDocumentStore.getState().setCurrentProject("project-1");
      useCanonicalDocumentStore
        .getState()
        .setDocument("project-1", makeDocument(undefined, { width: "100%" }));
      const { inspectorActions } = setUpStore(SYNTHETIC_ID);

      inspectorActions.updateSelectedStyle("borderRadius", "8px");
      await vi.waitFor(() => {
        expect(readInstanceNode()?.descendants?.[ACTION_ID]).toBeDefined();
      });
      const style = readInstanceNode()?.descendants?.[ACTION_ID]?.style as
        Record<string, unknown> | undefined;
      expect(style && "width" in style).toBe(false);
      expect(style?.borderRadius).toBeDefined();
    });

    it('키 지우기 (reset 의 "") 는 patch 에서 그 키를 빼 origin 값으로 돌아간다', async () => {
      useCanonicalDocumentStore.getState().setCurrentProject("project-1");
      useCanonicalDocumentStore
        .getState()
        .setDocument(
          "project-1",
          makeDocument(
            { [ACTION_ID]: { children: "Go", style: { borderRadius: 14 } } },
            { borderRadius: 4 },
          ),
        );
      const { inspectorActions } = setUpStore(SYNTHETIC_ID);

      inspectorActions.updateSelectedStyles({ borderRadius: "" });
      await vi.waitFor(() => {
        expect(
          readInstanceNode()?.descendants?.[ACTION_ID]?.style,
        ).toBeUndefined();
      });
      expect(readInstanceNode()?.descendants).toEqual({
        [ACTION_ID]: { children: "Go" },
      });
      expect(
        (
          getSyntheticDescendantLookup(SYNTHETIC_ID)?.node.props as {
            style?: Record<string, unknown>;
          }
        )?.style?.borderRadius,
      ).toBe(4);
    });

    it("updateSelectedFills(null) 은 patch 의 fills override 를 지운다 (origin fills 복귀)", async () => {
      useCanonicalDocumentStore.getState().setCurrentProject("project-1");
      useCanonicalDocumentStore.getState().setDocument(
        "project-1",
        makeDocument({
          [ACTION_ID]: { fills: [fill], style: { borderRadius: 14 } },
        }),
      );
      const { inspectorActions } = setUpStore(SYNTHETIC_ID);

      inspectorActions.updateSelectedFills(null);
      await vi.waitFor(() => {
        expect(
          readInstanceNode()?.descendants?.[ACTION_ID]?.fills,
        ).toBeUndefined();
      });
      expect(readInstanceNode()?.descendants).toEqual({
        [ACTION_ID]: { style: { borderRadius: 14 } },
      });
      // 마지막 키를 지우면 경로째 빠진다 (reset 뒤 빈 `{}` 잔재 없음).
      inspectorActions.updateSelectedStyles({ borderRadius: "" });
      await vi.waitFor(() => {
        expect(readInstanceNode()?.descendants?.[ACTION_ID]).toBeUndefined();
      });
    });

    it("origin 에만 있는 키의 초기화는 patch 가 그대로라 쓰지 않는다 (빈 history · 재레이아웃 없음)", async () => {
      useCanonicalDocumentStore.getState().setCurrentProject("project-1");
      useCanonicalDocumentStore
        .getState()
        .setDocument("project-1", makeDocument(undefined, { width: "100%" }));
      const { state, inspectorActions } = setUpStore(SYNTHETIC_ID);

      inspectorActions.updateSelectedStyles({ width: "" });
      await new Promise((resolve) => setTimeout(resolve, 50));
      expect(readInstanceNode()?.descendants).toBeUndefined();
      expect(state.layoutVersion).toBe(0);
    });

    it("Slot 으로 채운 노드 (mode C) 의 Fill 초기화는 그 노드의 fills 를 지운다", async () => {
      const FILL_ID = "fill-a";
      useCanonicalDocumentStore.getState().setCurrentProject("project-1");
      useCanonicalDocumentStore.getState().setDocument(
        "project-1",
        makeDocument({
          [ACTION_ID]: {
            children: [
              {
                id: FILL_ID,
                type: "Text",
                props: { children: "x" },
                fills: [fill],
              },
            ],
          },
        }),
      );
      const { inspectorActions } = setUpStore(
        `${INSTANCE_ID}/${ACTION_ID}/${FILL_ID}`,
      );

      inspectorActions.updateSelectedFills(null);
      await vi.waitFor(() => {
        const host = readInstanceNode()?.descendants?.[ACTION_ID] as
          { children?: Array<Record<string, unknown>> } | undefined;
        expect(host?.children?.[0]?.fills).toBeUndefined();
      });
    });
  });
});
