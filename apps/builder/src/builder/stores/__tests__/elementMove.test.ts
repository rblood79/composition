import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  registerCanonicalMutationStoreActions,
  resetCanonicalMutationStoreActions,
} from "../../../adapters/canonical/canonicalMutations";
import { useCanonicalDocumentStore } from "../canonical/canonicalDocumentStore";
import type { CompositionDocument } from "@composition/shared";
import type { Element } from "../../../types/core/store.types";
import { useStore } from "../index";

vi.mock("../../../lib/db", () => ({
  getDB: vi.fn(async () => ({
    documents: {
      put: vi.fn(async () => undefined),
    },
  })),
}));

function makeElement(
  id: string,
  pageId: string,
  // `order_num` 은 canonical 에서 제거됐으나 본 테스트는 legacy ordering 시맨틱을
  // fixture/assertion 으로 검증한다 → 로컬 타입에서만 허용 (값 보존).
  overrides: Partial<Element> & {
    order_num?: number;
    reusable?: boolean;
    ref?: string;
  } = {},
): Element {
  return {
    id,
    type: "div",
    page_id: pageId,
    parent_id: null,
    order_num: 0,
    props: {},
    deleted: false,
    ...overrides,
  } as Element;
}

function resetStoreState(): void {
  resetCanonicalMutationStoreActions();
  useStore.getState().setElements([]);
  useStore.setState({
    pages: [],
    currentPageId: null,
    selectedElementId: null,
    selectedElementIds: [],
    selectedElementIdsSet: new Set<string>(),
    selectedElementProps: {},
    editingContextId: null,
    selectedTab: null,
    multiSelectMode: false,
  });
}

describe("moveElementToContainer", () => {
  beforeEach(resetStoreState);

  it("cross-page reparent는 root와 subtree page_id를 target container 기준으로 갱신한다", () => {
    const page1Body = makeElement("page-1-body", "page-1", {
      type: "body",
    });
    const page2Body = makeElement("page-2-body", "page-2", {
      type: "body",
    });
    const sourceCard = makeElement("card-1", "page-1", {
      type: "Card",
      parent_id: page1Body.id,
      order_num: 0,
    });
    const sourceHeading = makeElement("heading-1", "page-1", {
      type: "Heading",
      parent_id: sourceCard.id,
      order_num: 0,
    });
    const targetButton = makeElement("button-2", "page-2", {
      type: "Button",
      parent_id: page2Body.id,
      order_num: 0,
    });

    useStore
      .getState()
      .setElements([
        page1Body,
        sourceCard,
        sourceHeading,
        page2Body,
        targetButton,
      ]);

    useStore.getState().moveElementToContainer(sourceCard.id, page2Body.id, 1);

    const state = useStore.getState();
    const movedCard = state.elementsMap.get(sourceCard.id);
    const movedHeading = state.elementsMap.get(sourceHeading.id);
    const retainedTargetButton = state.elementsMap.get(targetButton.id);

    expect(movedCard).toMatchObject({
      id: sourceCard.id,
      page_id: "page-2",
      parent_id: page2Body.id,
    });
    expect(movedHeading).toMatchObject({
      id: sourceHeading.id,
      page_id: "page-2",
      parent_id: sourceCard.id,
    });
    expect(retainedTargetButton).toMatchObject({
      id: targetButton.id,
      page_id: "page-2",
      parent_id: page2Body.id,
    });

    // 순서 SSOT 는 canonical children[] (ADR-118) — `order_num` 은 export mirror 로만
    // 파생되고 runtime 에서는 유지되지 않는다. 따라서 삽입 위치는 children 배열 순서로
    // 단언한다 (Set 비교는 순서를 못 보므로 삽입 index 회귀를 놓친다).
    expect(
      (state.childrenMap.get(page1Body.id) ?? []).map((el) => el.id),
    ).toEqual([]);
    expect(
      (state.childrenMap.get(page2Body.id) ?? []).map((el) => el.id),
    ).toEqual([targetButton.id, sourceCard.id]);

    const page1Ids = new Set(
      state.pageElementsSnapshot["page-1"]?.map((element) => element.id) ?? [],
    );
    const page2Ids = new Set(
      state.pageElementsSnapshot["page-2"]?.map((element) => element.id) ?? [],
    );
    expect(page1Ids.has(sourceCard.id)).toBe(false);
    expect(page1Ids.has(sourceHeading.id)).toBe(false);
    expect(page2Ids.has(sourceCard.id)).toBe(true);
    expect(page2Ids.has(sourceHeading.id)).toBe(true);
  });

  it("target siblings의 order_num이 중복되어도 기존 형제 순서를 기준으로 삽입한다", () => {
    const page1Body = makeElement("page-1-body", "page-1", {
      type: "body",
    });
    const page2Body = makeElement("page-2-body", "page-2", {
      type: "body",
    });
    const source = makeElement("source", "page-1", {
      parent_id: page1Body.id,
      order_num: 0,
    });
    const targetFirst = makeElement("target-first", "page-2", {
      parent_id: page2Body.id,
      order_num: 0,
    });
    const targetSecond = makeElement("target-second", "page-2", {
      parent_id: page2Body.id,
      order_num: 0,
    });

    useStore
      .getState()
      .setElements([page1Body, source, page2Body, targetFirst, targetSecond]);

    useStore.getState().moveElementToContainer(source.id, page2Body.id, 1);

    const state = useStore.getState();
    expect(state.elementsMap.get(source.id)).toMatchObject({
      page_id: page2Body.page_id,
      parent_id: page2Body.id,
    });
    // 형제들의 order_num 이 둘 다 0 으로 중복이어도 기존 children[] 순서를 기준으로
    // index 1 에 삽입되어야 한다. 순서 SSOT 는 canonical children[] (ADR-118) —
    // order_num 은 runtime 에서 유지되지 않으므로 배열 순서로 검증한다.
    expect(
      (state.childrenMap.get(page2Body.id) ?? []).map((el) => el.id),
    ).toEqual([targetFirst.id, source.id, targetSecond.id]);
  });

  // 회귀 — canonical mutation 이 등록된 상태(실제 빌더)에서 move 후 store mirror
  //   (elements/childrenMap/elementsMap)가 canonical 과 정합해야 한다 (2026-06-29).
  //
  // **버그**: moveElementToContainer 는 canonical 등록 시 moveElementCanonicalPrimary
  //   성공 후 `if (result.changed) return` 으로 store mirror 갱신과 layoutVersion 증가를
  //   누락한다. canonical 만 갱신되고 store.elements/childrenMap 은 stale 로 남아
  //   (1) 같은 턴에 store 를 읽는 consumer 가 옛 위치를 보고 (2) 연속 move 시 두 번째가
  //   stale store 기준으로 동작해 store↔canonical split-brain 이 된다. 기존 테스트는
  //   resetCanonicalMutationStoreActions() 로 canonical 미등록(fallback 경로)만 검증해
  //   이 경로를 못 잡았다.
  //
  // **수정**: canonical 성공 분기에서 return 대신 _rebuildIndexes()(canonical 우선 derive)
  //   + layoutVersion 증가 (addElement 등 다른 mutation 과 동일 패턴).
  describe("canonical 등록 상태 (실제 빌더 경로)", () => {
    const PROJECT_ID = "project-move";

    function makeCanonicalNode(
      el: Element,
      children: CompositionDocument["children"] = [],
    ): CompositionDocument["children"][number] {
      return {
        id: el.id,
        type: el.type as CompositionDocument["children"][number]["type"],
        props: el.props as Record<string, unknown>,
        metadata: {
          type: "legacy-element-props",
          sourceParentId: el.parent_id,
          sourceElementType: el.type,
          legacyProps: {
            ...el.props,
            id: el.id,
            parent_id: el.parent_id,
            page_id: el.page_id,
            type: el.type,
          },
        },
        ...(children.length > 0 ? { children } : {}),
      };
    }

    function registerCanonical(
      doc: CompositionDocument,
      snapshotElements: Element[],
    ): void {
      useCanonicalDocumentStore.setState({
        documents: new Map(),
        currentProjectId: null,
        documentVersion: 0,
      });
      useCanonicalDocumentStore.getState().setCurrentProject(PROJECT_ID);
      useCanonicalDocumentStore.getState().setDocument(PROJECT_ID, doc);
      registerCanonicalMutationStoreActions({
        getCurrentLegacySnapshot: () => ({
          elements: snapshotElements,
          pages: [],
          layouts: [],
        }),
        getCurrentProjectId: () => PROJECT_ID,
      });
    }

    it("move 후 store mirror(childrenMap/elements)가 canonical 과 정합한다", () => {
      const body = makeElement("body", "page-1", { type: "body" });
      const containerA = makeElement("container-a", "page-1", {
        type: "div",
        parent_id: body.id,
      });
      const containerB = makeElement("container-b", "page-1", {
        type: "div",
        parent_id: body.id,
      });
      const child = makeElement("child", "page-1", {
        type: "div",
        parent_id: containerA.id,
      });
      const elements = [body, containerA, containerB, child];

      const doc: CompositionDocument = {
        version: "composition-1.0",
        children: [
          makeCanonicalNode(body, [
            makeCanonicalNode(containerA, [makeCanonicalNode(child)]),
            makeCanonicalNode(containerB),
          ]),
        ],
      };
      registerCanonical(doc, elements);
      // store mirror 를 canonical 과 동일하게 초기화
      useStore.getState().setElements(elements);

      // move 1: child 를 containerA → containerB
      useStore.getState().moveElementToContainer(child.id, containerB.id, 0);

      const state = useStore.getState();
      // store childrenMap 이 갱신되어야 한다 (canonical 은 갱신됨)
      expect(
        (state.childrenMap.get(containerA.id) ?? []).map((c) => c.id),
      ).toEqual([]);
      expect(
        (state.childrenMap.get(containerB.id) ?? []).map((c) => c.id),
      ).toEqual([child.id]);
      // store element.parent_id 도 갱신
      expect(state.elementsMap.get(child.id)?.parent_id).toBe(containerB.id);
    });

    it("연속 move(A→B→다시 A) 시 store↔canonical split-brain 이 없다", () => {
      const body = makeElement("body", "page-1", { type: "body" });
      const containerA = makeElement("container-a", "page-1", {
        type: "div",
        parent_id: body.id,
      });
      const containerB = makeElement("container-b", "page-1", {
        type: "div",
        parent_id: body.id,
      });
      const child = makeElement("child", "page-1", {
        type: "div",
        parent_id: containerA.id,
      });
      const elements = [body, containerA, containerB, child];

      const doc: CompositionDocument = {
        version: "composition-1.0",
        children: [
          makeCanonicalNode(body, [
            makeCanonicalNode(containerA, [makeCanonicalNode(child)]),
            makeCanonicalNode(containerB),
          ]),
        ],
      };
      registerCanonical(doc, elements);
      useStore.getState().setElements(elements);

      // 연속 move: A → B → 다시 A
      useStore.getState().moveElementToContainer(child.id, containerB.id, 0);
      useStore.getState().moveElementToContainer(child.id, containerA.id, 0);

      const state = useStore.getState();
      // 최종적으로 child 는 containerA 에 정확히 있어야 한다 (split-brain 없음)
      expect(state.elementsMap.get(child.id)?.parent_id).toBe(containerA.id);
      expect(
        (state.childrenMap.get(containerA.id) ?? []).map((c) => c.id),
      ).toEqual([child.id]);
      expect(
        (state.childrenMap.get(containerB.id) ?? []).map((c) => c.id),
      ).toEqual([]);
    });

    it("같은 부모 안의 임의 insertionIndex 이동을 canonical children 순서에 반영한다", () => {
      const body = makeElement("body", "page-1", { type: "body" });
      const first = makeElement("first", "page-1", {
        parent_id: body.id,
      });
      const second = makeElement("second", "page-1", {
        parent_id: body.id,
      });
      const third = makeElement("third", "page-1", {
        parent_id: body.id,
      });
      const elements = [body, first, second, third];

      const doc: CompositionDocument = {
        version: "composition-1.0",
        children: [
          makeCanonicalNode(body, [
            makeCanonicalNode(first),
            makeCanonicalNode(second),
            makeCanonicalNode(third),
          ]),
        ],
      };
      registerCanonical(doc, elements);
      useStore.getState().setElements(elements);

      useStore.getState().moveElementToContainer(third.id, body.id, 0);

      const state = useStore.getState();
      expect(
        (state.childrenMap.get(body.id) ?? []).map((child) => child.id),
      ).toEqual([third.id, first.id, second.id]);
      expect(state.elementsMap.get(third.id)?.parent_id).toBe(body.id);
    });

    it("같은 부모의 현재 insertionIndex에 다시 드롭하면 no-op으로 유지한다", () => {
      const body = makeElement("body", "page-1", { type: "body" });
      const first = makeElement("first", "page-1", {
        parent_id: body.id,
      });
      const second = makeElement("second", "page-1", {
        parent_id: body.id,
      });
      const third = makeElement("third", "page-1", {
        parent_id: body.id,
      });
      const elements = [body, first, second, third];

      const doc: CompositionDocument = {
        version: "composition-1.0",
        children: [
          makeCanonicalNode(body, [
            makeCanonicalNode(first),
            makeCanonicalNode(second),
            makeCanonicalNode(third),
          ]),
        ],
      };
      registerCanonical(doc, elements);
      useStore.getState().setElements(elements);
      const beforeLayoutVersion = useStore.getState().layoutVersion;

      useStore.getState().moveElementToContainer(second.id, body.id, 1);

      const state = useStore.getState();
      expect(
        (state.childrenMap.get(body.id) ?? []).map((child) => child.id),
      ).toEqual([first.id, second.id, third.id]);
      expect(state.layoutVersion).toBe(beforeLayoutVersion);
    });
  });
});
