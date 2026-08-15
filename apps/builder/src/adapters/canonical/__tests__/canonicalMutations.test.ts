import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { CompositionDocument } from "@composition/shared";
import type { Element, Page } from "@/types/builder/unified.types";
import type { Layout } from "@/types/builder/layout.types";
import { useCanonicalDocumentStore } from "../../../builder/stores/canonical/canonicalDocumentStore";
import { canonicalDocumentToElements } from "../../../builder/stores/canonical/canonicalElementsView";
import {
  applyElementOrderCanonicalPrimary,
  mergeElementsCanonicalPrimary,
  moveElementCanonicalPrimary,
  registerCanonicalMutationStoreActions,
  resetCanonicalMutationStoreActions,
  setElementsCanonicalPrimary,
} from "../canonicalMutations";
import { exportLegacyDocument } from "../exportLegacyDocument";

/**
 * Legacy roundtrip fixture types.
 *
 * `exportLegacyDocument` 가 보존해야 할 legacy JSON shape (`order_num` /
 * `layout_id` / `slot_name` / `componentRole` / `masterId`) 를 검증하기 위한
 * test-only 확장 타입. ADR-126 Phase 6 에서 `Element` interface 가 canonical-
 * native 로 정리되면서 이 필드들은 runtime 타입에서 제거되었으나, JSON export/
 * import boundary 에서는 외부 호환을 위해 metadata.legacyProps 에 보존된다.
 */
type LegacyTestElement = Element & {
  order_num?: number;
  layout_id?: string | null;
  slot_name?: string | null;
  componentRole?: string | null;
  masterId?: string | null;
  overrides?: Record<string, unknown>;
  descendants?: Record<string, unknown>;
};

type LegacyTestPage = Page & { order_num?: number };

function makeElement(
  id: string,
  type: string,
  patch: Partial<LegacyTestElement> = {},
): LegacyTestElement {
  return {
    id,
    type,
    props: {},
    parent_id: null,
    page_id: null,
    layout_id: null,
    order_num: 0,
    ...patch,
  } as LegacyTestElement;
}

function makePage(id: string): LegacyTestPage {
  return {
    id,
    title: id,
    project_id: "project-1",
    slug: `/${id}`,
    order_num: 0,
  } as LegacyTestPage;
}

function makeLayout(id: string): Layout {
  return {
    id,
    name: id,
    project_id: "project-1",
  };
}

/**
 * makeDocument — test fixture 용 CompositionDocument builder.
 *
 * `children` 의 타입을 의도적으로 `Array<Record<string, unknown>>` 로 느슨하게
 * 받는다. canonical `CompositionDocument["children"]` 은 `FrameNode | RefNode`
 * union 이지만, fixture 가 inline literal 로 union 의 한 member (`ref` /
 * `placeholder` 등) 를 작성할 때 TypeScript 가 narrow 하지 못해 excess
 * property check 가 발동한다. legacy roundtrip 검증 의도상 type 강제는
 * `exportLegacyDocument` 실행 시점에 충분히 보장되므로, fixture builder 는
 * loose-typed object 를 받고 결과만 satisfies 로 검증한다.
 */
function makeDocument(
  children: Array<Record<string, unknown>> = [],
): CompositionDocument {
  return {
    version: "composition-1.0",
    children: children as unknown as CompositionDocument["children"],
  } satisfies CompositionDocument;
}

function makeCanonicalElementNode(
  element: LegacyTestElement,
  children: CompositionDocument["children"] = [],
): CompositionDocument["children"][number] {
  return {
    id: element.id,
    type: element.type as CompositionDocument["children"][number]["type"],
    props: element.props as Record<string, unknown>,
    metadata: {
      type: "legacy-element-props",
      sourceParentId: element.parent_id,
      sourceSlotName: element.slot_name,
      sourceComponentRole: element.componentRole,
      sourceMasterId: element.masterId,
      sourceElementType: element.type,
      sourceOrderNum: element.order_num,
      legacyProps: {
        ...element.props,
        id: element.id,
        parent_id: element.parent_id,
        page_id: element.page_id,
        layout_id: element.layout_id,
        order_num: element.order_num,
        type: element.type,
      },
    },
    ...(children.length > 0 ? { children } : {}),
  };
}

describe("canonical mutation wrappers", () => {
  beforeEach(() => {
    resetCanonicalMutationStoreActions();
    useCanonicalDocumentStore.setState({
      documents: new Map(),
      currentProjectId: null,
      documentVersion: 0,
    });
  });

  it("mergeElementsCanonicalPrimary upserts frame-owned elements into active canonical document", () => {
    const setElements = vi.fn();
    const layout = makeLayout("frame-1");
    const doc = makeDocument([
      {
        id: "layout-frame-1",
        type: "frame",
        reusable: true,
        metadata: { type: "legacy-layout", layoutId: "frame-1" },
        children: [],
      },
    ]);
    useCanonicalDocumentStore.getState().setCurrentProject("project-1");
    useCanonicalDocumentStore.getState().setDocument("project-1", doc);
    registerCanonicalMutationStoreActions({
      getCurrentLegacySnapshot: () => ({
        elements: [],
        pages: [],
        layouts: [layout],
      }),
      getCurrentProjectId: () => "project-1",
    });

    mergeElementsCanonicalPrimary([
      makeElement("body-1", "body", {
        layout_id: "frame-1",
        props: { role: "body" },
      }),
    ]);

    const nextDoc = useCanonicalDocumentStore
      .getState()
      .getDocument("project-1");
    const frame = nextDoc?.children.find(
      (node) => node.id === "layout-frame-1",
    );
    expect(frame?.children).toEqual([
      expect.objectContaining({
        id: "body-1",
        type: "body",
        metadata: expect.objectContaining({
          legacyProps: expect.objectContaining({ id: "body-1" }),
        }),
      }),
    ]);
    expect(setElements).not.toHaveBeenCalled();
  });

  it("setElementsCanonicalPrimary preserves page shell order metadata", () => {
    const setElements = vi.fn();
    const pages = [
      { ...makePage("page-home"), title: "Home", slug: "/", order_num: 0 },
      { ...makePage("page-two"), title: "Page 2", order_num: 1 },
      { ...makePage("page-three"), title: "Page 3", order_num: 2 },
    ] as unknown as Page[];
    useCanonicalDocumentStore.getState().setCurrentProject("project-1");
    registerCanonicalMutationStoreActions({
      getCurrentLegacySnapshot: () => ({
        elements: [],
        pages,
        layouts: [],
      }),
      getCurrentProjectId: () => "project-1",
    });

    setElementsCanonicalPrimary([]);

    const nextDoc = useCanonicalDocumentStore
      .getState()
      .getDocument("project-1");
    const pageNodes = nextDoc?.children.filter(
      (node) =>
        (node.metadata as { type?: unknown } | undefined)?.type ===
        "legacy-page",
    );
    expect(pageNodes?.map((node) => node.id)).toEqual([
      "page-home",
      "page-two",
      "page-three",
    ]);
    expect(
      pageNodes?.every(
        (node) => !("order_num" in ((node.metadata ?? {}) as object)),
      ),
    ).toBe(true);
  });

  /**
   * 프레임이 적용된 페이지는 canonical 상 `ref` 노드이고, 그 페이지의 최상위
   * 요소는 hydrate 가 `children` 에 둔다. 런타임 추가도 같은 자리여야 한다 —
   * 슬롯 override 로 보내면 같은 조건의 형제가 두 곳으로 갈린다.
   *
   * **Why (2026-08-16 실측)**: `parent_id: null` + `slot_name` 없는 두 ListBox 가
   * legacy 속성이 완전히 같은데 하나는 `children`, 다른 하나는
   * `descendants[slot].children` 에 있었다. 그 상태에서 페이지 최상위 요소를
   * 그룹화하면 새 frame 이 override 로 들어가고, 이어지는 자식 reparent 가
   * `children` 트리에서 frame 을 못 찾아 자식들까지 canonical 에서 사라졌다.
   */
  function setupFramedPage() {
    const page = makePage("page-1");
    useCanonicalDocumentStore.getState().setCurrentProject("project-1");
    useCanonicalDocumentStore.getState().setDocument(
      "project-1",
      makeDocument([
        {
          id: "layout-1",
          type: "frame",
          reusable: true,
          children: [
            {
              id: "frame-body",
              type: "body",
              children: [
                {
                  id: "frame-slot",
                  type: "frame",
                  metadata: {
                    type: "legacy-slot-hoisted",
                    slotName: "content",
                  },
                  children: [],
                },
              ],
            },
          ],
        },
        {
          id: "page-1",
          type: "ref",
          ref: "layout-1",
          metadata: { type: "legacy-page", pageId: "page-1" },
          children: [makeCanonicalElementNode(makeElement("existing-1", "Nav"))],
        },
      ]),
    );
    registerCanonicalMutationStoreActions({
      getCurrentLegacySnapshot: () => ({
        elements: [],
        pages: [page],
        layouts: [],
      }),
      getCurrentProjectId: () => "project-1",
    });
  }

  function readPageRef() {
    const doc = useCanonicalDocumentStore.getState().getDocument("project-1");
    const pageNode = doc?.children.find((node) => node.id === "page-1");
    const descendants =
      (pageNode as { descendants?: Record<string, { children?: { id: string }[] }> })
        .descendants ?? {};
    return {
      children: (pageNode?.children ?? []).map((child) => child.id),
      descendantChildren: Object.values(descendants).flatMap((override) =>
        (override.children ?? []).map((child) => child.id),
      ),
    };
  }

  it("attaches slot-less page children to a framed page's children (not the slot override)", () => {
    setupFramedPage();

    mergeElementsCanonicalPrimary([
      makeElement("added-1", "frame", { page_id: "page-1" }),
    ]);

    const pageRef = readPageRef();
    expect(pageRef.children).toEqual(["existing-1", "added-1"]);
    expect(pageRef.descendantChildren).toEqual([]);
  });

  it("still routes slot-named elements into the framed page's slot override", () => {
    setupFramedPage();

    mergeElementsCanonicalPrimary([
      makeElement("slotted-1", "Card", {
        page_id: "page-1",
        slot_name: "content",
      }),
    ]);

    const pageRef = readPageRef();
    expect(pageRef.children).toEqual(["existing-1"]);
    expect(pageRef.descendantChildren).toEqual(["slotted-1"]);
  });

  it("mergeElementsCanonicalPrimary preserves parent-child ordering in page-owned batches", () => {
    const setElements = vi.fn();
    const page = makePage("page-1");
    useCanonicalDocumentStore.getState().setCurrentProject("project-1");
    useCanonicalDocumentStore.getState().setDocument(
      "project-1",
      makeDocument([
        {
          id: "page-1",
          type: "frame",
          metadata: { type: "legacy-page", pageId: "page-1" },
          children: [],
        },
      ]),
    );
    registerCanonicalMutationStoreActions({
      getCurrentLegacySnapshot: () => ({
        elements: [],
        pages: [page],
        layouts: [],
      }),
      getCurrentProjectId: () => "project-1",
    });

    mergeElementsCanonicalPrimary([
      makeElement("child-1", "Text", {
        parent_id: "parent-1",
        page_id: "page-1",
        order_num: 1,
      }),
      makeElement("parent-1", "Box", {
        page_id: "page-1",
        order_num: 0,
      }),
    ]);

    const nextDoc = useCanonicalDocumentStore
      .getState()
      .getDocument("project-1");
    const pageNode = nextDoc?.children.find((node) => node.id === "page-1");
    expect(pageNode?.children).toEqual([
      expect.objectContaining({
        id: "parent-1",
        children: [expect.objectContaining({ id: "child-1" })],
      }),
    ]);
    expect(setElements).not.toHaveBeenCalled();
  });

  it("mergeElementsCanonicalPrimary preserves existing sibling order for legacy-order-only batches", () => {
    const setElements = vi.fn();
    const page = makePage("page-1");
    const body = makeElement("body", "body", {
      page_id: "page-1",
      order_num: 0,
    });
    const childA = makeElement("child-a", "Button", {
      parent_id: body.id,
      page_id: "page-1",
      order_num: 0,
    });
    const childB = makeElement("child-b", "Heading", {
      parent_id: body.id,
      page_id: "page-1",
      order_num: 1,
    });
    const childC = makeElement("child-c", "Text", {
      parent_id: body.id,
      page_id: "page-1",
      order_num: 2,
    });
    const childD = makeElement("child-d", "Image", {
      parent_id: body.id,
      page_id: "page-1",
      order_num: 3,
    });

    useCanonicalDocumentStore.getState().setCurrentProject("project-1");
    useCanonicalDocumentStore.getState().setDocument(
      "project-1",
      makeDocument([
        {
          id: "page-1",
          type: "frame",
          metadata: { type: "legacy-page", pageId: "page-1" },
          children: [
            makeCanonicalElementNode(body, [
              makeCanonicalElementNode(childA),
              makeCanonicalElementNode(childB),
              makeCanonicalElementNode(childC),
              makeCanonicalElementNode(childD),
            ]),
          ],
        },
      ]),
    );
    registerCanonicalMutationStoreActions({
      getCurrentLegacySnapshot: () => ({
        elements: [body, childA, childB, childC, childD],
        pages: [page],
        layouts: [],
      }),
      getCurrentProjectId: () => "project-1",
    });

    mergeElementsCanonicalPrimary([
      { ...childC, order_num: 0 },
      { ...childA, order_num: 1 },
      { ...childB, order_num: 2 },
      childD,
    ]);

    const nextDoc = useCanonicalDocumentStore
      .getState()
      .getDocument("project-1");
    const pageNode = nextDoc?.children.find((node) => node.id === "page-1");
    const bodyNode = pageNode?.children?.find((node) => node.id === body.id);
    expect(bodyNode?.children?.map((node) => node.id)).toEqual([
      "child-a",
      "child-b",
      "child-c",
      "child-d",
    ]);
    expect(setElements).not.toHaveBeenCalled();
  });

  // 회귀 — element 에 stale `metadata.sourceParentId`(과거 부모 잔재)가 붙어 있어도
  //   prop 수정 시 형제 순서가 보존되어야 한다 (2026-06-29).
  //
  // **버그**: RadioGroup 을 컨테이너 X 에서 body 로 이동(move)하면 element.parent_id 는
  //   body 로 갱신되지만 element.metadata.sourceParentId 는 과거 X 로 남는다(stale).
  //   이후 임의의 prop 수정 → legacyElementToCanonicalNode → buildCanonicalMutationMetadata
  //   에서 `...incomingMetadata`(stale element.metadata) 가 신규 legacyMetadata.sourceParentId
  //   를 덮어써 canonical node 의 sourceParentId 가 stale 로 재기록된다. 다음 prop 수정 시
  //   upsertElementIntoDocument 의 legacyPositionMatches 가 sourceParentId(X) ≠ parent_id(body)
  //   로 위치 불일치 판정 → 빠른 경로(제자리 replace) skip → remove + append → body children
  //   맨 뒤로 재삽입(형제 순서 변경). 사용자 증상: "RadioGroup prop 수정 시 페이지 내 다른
  //   요소와 순서 바뀜".
  //
  // **수정**: buildCanonicalMutationMetadata 가 legacy position 권위 필드
  //   (sourceParentId/sourceSlotName/sourceComponentRole/sourceMasterId/sourceElementType)
  //   를 항상 현재 element 기준 신규 legacyMetadata 로 강제(legacyProps 와 동일 보호).
  it("mergeElementsCanonicalPrimary keeps sibling order when an element carries a stale metadata.sourceParentId", () => {
    const page = makePage("page-1");
    const body = makeElement("body", "body", {
      page_id: "page-1",
      order_num: 0,
    });
    const childA = makeElement("child-a", "Button", {
      parent_id: body.id,
      page_id: "page-1",
      order_num: 0,
    });
    // RadioGroup 은 과거 다른 컨테이너("stale-parent")의 자식이었다가 body 로 이동됨.
    //   element.parent_id 는 body 이지만 element.metadata.sourceParentId 는 옛 부모로 stale.
    const radioGroup = makeElement("radiogroup-1", "RadioGroup", {
      parent_id: body.id,
      page_id: "page-1",
      order_num: 1,
      metadata: {
        type: "legacy-element-props",
        sourceParentId: "stale-parent",
        sourceElementType: "RadioGroup",
        legacyProps: { parent_id: body.id, type: "RadioGroup" },
      },
    } as Partial<LegacyTestElement>);
    const childB = makeElement("child-b", "Heading", {
      parent_id: body.id,
      page_id: "page-1",
      order_num: 2,
    });

    useCanonicalDocumentStore.getState().setCurrentProject("project-1");
    useCanonicalDocumentStore.getState().setDocument(
      "project-1",
      makeDocument([
        {
          id: "page-1",
          type: "frame",
          metadata: { type: "legacy-page", pageId: "page-1" },
          children: [
            makeCanonicalElementNode(body, [
              makeCanonicalElementNode(childA),
              makeCanonicalElementNode(radioGroup),
              makeCanonicalElementNode(childB),
            ]),
          ],
        },
      ]),
    );
    registerCanonicalMutationStoreActions({
      getCurrentLegacySnapshot: () => ({
        elements: [body, childA, radioGroup, childB],
        pages: [page],
        layouts: [],
      }),
      getCurrentProjectId: () => "project-1",
    });

    // RadioGroup 의 prop 한 개 수정 (size 변경) — 위치(parent_id/page_id)는 그대로.
    mergeElementsCanonicalPrimary([
      { ...radioGroup, props: { ...radioGroup.props, size: "lg" } },
    ]);

    const nextDoc = useCanonicalDocumentStore
      .getState()
      .getDocument("project-1");
    const pageNode = nextDoc?.children.find((node) => node.id === "page-1");
    const bodyNode = pageNode?.children?.find((node) => node.id === body.id);
    // 형제 순서가 보존되어야 한다 (RadioGroup 이 맨 뒤로 밀리지 않음).
    expect(bodyNode?.children?.map((node) => node.id)).toEqual([
      "child-a",
      "radiogroup-1",
      "child-b",
    ]);
    // canonical node 의 sourceParentId 가 현재 부모(body)로 치유되어야 한다 (stale 재기록 금지).
    const rgNode = bodyNode?.children?.find(
      (node) => node.id === "radiogroup-1",
    );
    expect(
      (rgNode?.metadata as { sourceParentId?: unknown } | undefined)
        ?.sourceParentId,
    ).toBe(body.id);
  });

  // 위 버그는 RadioGroup 특정이 아니라 move 된 적 있는 **모든 element 타입** 공통이다
  //   (stale 을 만드는 canonical→element 역변환 + buildCanonicalMutationMetadata 는 타입
  //   무관). 일반 leaf 타입(Box)도 동일하게 보호됨을 못박는다.
  it("mergeElementsCanonicalPrimary keeps sibling order for a non-RadioGroup element with stale metadata.sourceParentId", () => {
    const page = makePage("page-1");
    const body = makeElement("body", "body", {
      page_id: "page-1",
      order_num: 0,
    });
    const childA = makeElement("child-a", "Text", {
      parent_id: body.id,
      page_id: "page-1",
      order_num: 0,
    });
    const box = makeElement("box-1", "Box", {
      parent_id: body.id,
      page_id: "page-1",
      order_num: 1,
      metadata: {
        type: "legacy-element-props",
        sourceParentId: "stale-parent",
        sourceElementType: "Box",
        legacyProps: { parent_id: body.id, type: "Box" },
      },
    } as Partial<LegacyTestElement>);
    const childB = makeElement("child-b", "Image", {
      parent_id: body.id,
      page_id: "page-1",
      order_num: 2,
    });

    useCanonicalDocumentStore.getState().setCurrentProject("project-1");
    useCanonicalDocumentStore.getState().setDocument(
      "project-1",
      makeDocument([
        {
          id: "page-1",
          type: "frame",
          metadata: { type: "legacy-page", pageId: "page-1" },
          children: [
            makeCanonicalElementNode(body, [
              makeCanonicalElementNode(childA),
              makeCanonicalElementNode(box),
              makeCanonicalElementNode(childB),
            ]),
          ],
        },
      ]),
    );
    registerCanonicalMutationStoreActions({
      getCurrentLegacySnapshot: () => ({
        elements: [body, childA, box, childB],
        pages: [page],
        layouts: [],
      }),
      getCurrentProjectId: () => "project-1",
    });

    mergeElementsCanonicalPrimary([
      { ...box, props: { ...box.props, foo: "bar" } },
    ]);

    const nextDoc = useCanonicalDocumentStore
      .getState()
      .getDocument("project-1");
    const pageNode = nextDoc?.children.find((node) => node.id === "page-1");
    const bodyNode = pageNode?.children?.find((node) => node.id === body.id);
    expect(bodyNode?.children?.map((node) => node.id)).toEqual([
      "child-a",
      "box-1",
      "child-b",
    ]);
    const boxNode = bodyNode?.children?.find((node) => node.id === "box-1");
    expect(
      (boxNode?.metadata as { sourceParentId?: unknown } | undefined)
        ?.sourceParentId,
    ).toBe(body.id);
  });

  // 위치 권위(sourceParentId/sourceSlotName)만 신규 강제하고, import/export roundtrip
  //   metadata(ref/template anchor 식별 등)는 incomingMetadata 로 보존해야 한다
  //   (ADR-145 ListBox template anchor 회귀 방지). element.metadata 의 비-위치 필드가
  //   merge 후에도 살아남는지 검증.
  it("mergeElementsCanonicalPrimary preserves non-position incoming metadata while healing position fields", () => {
    const page = makePage("page-1");
    const body = makeElement("body", "body", {
      page_id: "page-1",
      order_num: 0,
    });
    const node = makeElement("node-1", "Box", {
      parent_id: body.id,
      page_id: "page-1",
      order_num: 0,
      metadata: {
        type: "legacy-element-props",
        sourceParentId: "stale-parent",
        // import/export roundtrip 식별 metadata — 보존되어야 함
        templateRole: "some-anchor",
        compositionType: "MyComponent",
        legacyProps: { parent_id: body.id, type: "Box" },
      },
    } as Partial<LegacyTestElement>);

    useCanonicalDocumentStore.getState().setCurrentProject("project-1");
    useCanonicalDocumentStore.getState().setDocument(
      "project-1",
      makeDocument([
        {
          id: "page-1",
          type: "frame",
          metadata: { type: "legacy-page", pageId: "page-1" },
          children: [makeCanonicalElementNode(body, [])],
        },
      ]),
    );
    registerCanonicalMutationStoreActions({
      getCurrentLegacySnapshot: () => ({
        elements: [body, node],
        pages: [page],
        layouts: [],
      }),
      getCurrentProjectId: () => "project-1",
    });

    mergeElementsCanonicalPrimary([node]);

    const nextDoc = useCanonicalDocumentStore
      .getState()
      .getDocument("project-1");
    const pageNode = nextDoc?.children.find((node) => node.id === "page-1");
    const bodyNode = pageNode?.children?.find((n) => n.id === body.id);
    const nodeOut = bodyNode?.children?.find((n) => n.id === "node-1");
    const md = nodeOut?.metadata as Record<string, unknown> | undefined;
    // 위치 필드는 치유
    expect(md?.sourceParentId).toBe(body.id);
    // 비-위치 roundtrip metadata 는 보존
    expect(md?.templateRole).toBe("some-anchor");
    expect(md?.compositionType).toBe("MyComponent");
  });

  it("moveElementCanonicalPrimary reorders siblings by canonical children splice", () => {
    const setElements = vi.fn();
    const page = makePage("page-1");
    const body = makeElement("body", "body", {
      page_id: "page-1",
      order_num: 0,
    });
    const childA = makeElement("child-a", "Button", {
      parent_id: body.id,
      page_id: "page-1",
      order_num: 0,
    });
    const childB = makeElement("child-b", "Heading", {
      parent_id: body.id,
      page_id: "page-1",
      order_num: 1,
    });
    const childC = makeElement("child-c", "Text", {
      parent_id: body.id,
      page_id: "page-1",
      order_num: 2,
    });

    useCanonicalDocumentStore.getState().setCurrentProject("project-1");
    useCanonicalDocumentStore.getState().setDocument(
      "project-1",
      makeDocument([
        {
          id: "page-1",
          type: "frame",
          metadata: { type: "legacy-page", pageId: "page-1" },
          children: [
            makeCanonicalElementNode(body, [
              makeCanonicalElementNode(childA),
              makeCanonicalElementNode(childB),
              makeCanonicalElementNode(childC),
            ]),
          ],
        },
      ]),
    );
    registerCanonicalMutationStoreActions({
      getCurrentLegacySnapshot: () => ({
        elements: [body, childA, childB, childC],
        pages: [page],
        layouts: [],
      }),
      getCurrentProjectId: () => "project-1",
    });

    const result = moveElementCanonicalPrimary(childC.id, body.id, 0);

    const nextDoc = useCanonicalDocumentStore
      .getState()
      .getDocument("project-1");
    const pageNode = nextDoc?.children.find((node) => node.id === "page-1");
    const bodyNode = pageNode?.children?.find((node) => node.id === body.id);
    expect(bodyNode?.children?.map((node) => node.id)).toEqual([
      childC.id,
      childA.id,
      childB.id,
    ]);
    expect(result.changed).toBe(true);
    expect(result.document).toBe(nextDoc);
    expect(setElements).not.toHaveBeenCalled();
  });

  it("applyElementOrderCanonicalPrimary applies structural batch intent without legacy sibling bridge", () => {
    const setElements = vi.fn();
    const page = makePage("page-1");
    const body = makeElement("body", "body", {
      page_id: "page-1",
      order_num: 0,
    });
    const childA = makeElement("child-a", "Button", {
      parent_id: body.id,
      page_id: "page-1",
      order_num: 0,
    });
    const childB = makeElement("child-b", "Heading", {
      parent_id: body.id,
      page_id: "page-1",
      order_num: 1,
    });

    useCanonicalDocumentStore.getState().setCurrentProject("project-1");
    useCanonicalDocumentStore.getState().setDocument(
      "project-1",
      makeDocument([
        {
          id: "page-1",
          type: "frame",
          metadata: { type: "legacy-page", pageId: "page-1" },
          children: [
            makeCanonicalElementNode(body, [
              makeCanonicalElementNode(childA),
              makeCanonicalElementNode(childB),
            ]),
          ],
        },
      ]),
    );
    registerCanonicalMutationStoreActions({
      getCurrentLegacySnapshot: () => ({
        elements: [body, childA, childB],
        pages: [page],
        layouts: [],
      }),
      getCurrentProjectId: () => "project-1",
    });

    const result = applyElementOrderCanonicalPrimary([
      { ...childB, order_num: 0 },
      { ...childA, order_num: 1 },
    ] as unknown as Element[]);

    const nextDoc = useCanonicalDocumentStore
      .getState()
      .getDocument("project-1");
    const pageNode = nextDoc?.children.find((node) => node.id === "page-1");
    const bodyNode = pageNode?.children?.find((node) => node.id === body.id);
    expect(bodyNode?.children?.map((node) => node.id)).toEqual([
      childB.id,
      childA.id,
    ]);
    expect(result.changed).toBe(true);
    expect(result.document).toBe(nextDoc);
    expect(setElements).not.toHaveBeenCalled();
  });

  it("moveElementCanonicalPrimary reparents across page bodies and derives legacy page scope from canonical position", () => {
    const setElements = vi.fn();
    const page1 = makePage("page-1");
    const page2 = makePage("page-2");
    const page1Body = makeElement("page-1-body", "body", {
      page_id: "page-1",
      order_num: 0,
    });
    const page2Body = makeElement("page-2-body", "body", {
      page_id: "page-2",
      order_num: 0,
    });
    const source = makeElement("source", "Card", {
      parent_id: page1Body.id,
      page_id: "page-1",
      order_num: 0,
    });
    const sourceChild = makeElement("source-child", "Heading", {
      parent_id: source.id,
      page_id: "page-1",
      order_num: 0,
    });
    const target = makeElement("target", "Button", {
      parent_id: page2Body.id,
      page_id: "page-2",
      order_num: 0,
    });

    useCanonicalDocumentStore.getState().setCurrentProject("project-1");
    useCanonicalDocumentStore.getState().setDocument(
      "project-1",
      makeDocument([
        {
          id: "page-1",
          type: "frame",
          metadata: { type: "legacy-page", pageId: "page-1" },
          children: [
            makeCanonicalElementNode(page1Body, [
              makeCanonicalElementNode(source, [
                makeCanonicalElementNode(sourceChild),
              ]),
            ]),
          ],
        },
        {
          id: "page-2",
          type: "frame",
          metadata: { type: "legacy-page", pageId: "page-2" },
          children: [
            makeCanonicalElementNode(page2Body, [
              makeCanonicalElementNode(target),
            ]),
          ],
        },
      ]),
    );
    registerCanonicalMutationStoreActions({
      getCurrentLegacySnapshot: () => ({
        elements: [page1Body, source, sourceChild, page2Body, target],
        pages: [page1, page2],
        layouts: [],
      }),
      getCurrentProjectId: () => "project-1",
    });

    const result = moveElementCanonicalPrimary(source.id, page2Body.id, 1);
    const mirror = canonicalDocumentToElements(result.document!);

    const sourceMirror = mirror.find((element) => element.id === source.id);
    const sourceChildMirror = mirror.find(
      (element) => element.id === sourceChild.id,
    );
    expect(sourceMirror).toMatchObject({
      parent_id: page2Body.id,
      page_id: "page-2",
    });
    expect(sourceChildMirror).toMatchObject({
      parent_id: source.id,
      page_id: "page-2",
    });
    expect(
      mirror
        .filter((element) => element.parent_id === page2Body.id)
        .map((element) => element.id),
    ).toEqual([target.id, source.id]);
    expect(setElements).not.toHaveBeenCalled();
  });

  it("mergeElementsCanonicalPrimary does not reorder siblings for props-only batches", () => {
    const setElements = vi.fn();
    const page = makePage("page-1");
    const body = makeElement("body", "body", {
      page_id: "page-1",
      order_num: 0,
    });
    const childA = makeElement("child-a", "Button", {
      parent_id: body.id,
      page_id: "page-1",
      order_num: 0,
      props: { label: "A" },
    });
    const childB = makeElement("child-b", "Button", {
      parent_id: body.id,
      page_id: "page-1",
      order_num: 0,
      props: { label: "B" },
    });

    useCanonicalDocumentStore.getState().setCurrentProject("project-1");
    useCanonicalDocumentStore.getState().setDocument(
      "project-1",
      makeDocument([
        {
          id: "page-1",
          type: "frame",
          metadata: { type: "legacy-page", pageId: "page-1" },
          children: [
            makeCanonicalElementNode(body, [
              makeCanonicalElementNode(childB),
              makeCanonicalElementNode(childA),
            ]),
          ],
        },
      ]),
    );
    registerCanonicalMutationStoreActions({
      getCurrentLegacySnapshot: () => ({
        elements: [body, childB, childA],
        pages: [page],
        layouts: [],
      }),
      getCurrentProjectId: () => "project-1",
    });

    mergeElementsCanonicalPrimary([
      { ...childA, props: { label: "A updated" } },
      childB,
    ]);

    const nextDoc = useCanonicalDocumentStore
      .getState()
      .getDocument("project-1");
    const pageNode = nextDoc?.children.find((node) => node.id === "page-1");
    const bodyNode = pageNode?.children?.find((node) => node.id === body.id);
    expect(bodyNode?.children?.map((node) => node.id)).toEqual([
      "child-b",
      "child-a",
    ]);
  });

  it("mergeElementsCanonicalPrimary preserves canonical order when props-only updates carry refreshed mirror order", () => {
    const setElements = vi.fn();
    const page = makePage("page-1");
    const body = makeElement("body", "body", {
      page_id: "page-1",
      order_num: 0,
    });
    const childA = makeElement("child-a", "Button", {
      parent_id: body.id,
      page_id: "page-1",
      order_num: 0,
      props: { label: "A" },
    });
    const childB = makeElement("child-b", "Button", {
      parent_id: body.id,
      page_id: "page-1",
      order_num: 1,
      props: { label: "B" },
    });
    const childC = makeElement("child-c", "Button", {
      parent_id: body.id,
      page_id: "page-1",
      order_num: 2,
      props: { label: "C" },
    });
    const childD = makeElement("child-d", "Button", {
      parent_id: body.id,
      page_id: "page-1",
      order_num: 3,
      props: { label: "D" },
    });

    useCanonicalDocumentStore.getState().setCurrentProject("project-1");
    useCanonicalDocumentStore.getState().setDocument(
      "project-1",
      makeDocument([
        {
          id: "page-1",
          type: "frame",
          metadata: { type: "legacy-page", pageId: "page-1" },
          children: [
            makeCanonicalElementNode(body, [
              makeCanonicalElementNode(childA),
              makeCanonicalElementNode({ ...childB, order_num: 0 }),
              makeCanonicalElementNode(childC),
              makeCanonicalElementNode(childD),
            ]),
          ],
        },
      ]),
    );
    registerCanonicalMutationStoreActions({
      getCurrentLegacySnapshot: () => ({
        elements: [body, childA, childB, childC, childD],
        pages: [page],
        layouts: [],
      }),
      getCurrentProjectId: () => "project-1",
    });

    mergeElementsCanonicalPrimary([
      { ...childB, props: { label: "B updated" } },
    ]);

    const nextDoc = useCanonicalDocumentStore
      .getState()
      .getDocument("project-1");
    const pageNode = nextDoc?.children.find((node) => node.id === "page-1");
    const bodyNode = pageNode?.children?.find((node) => node.id === body.id);
    expect(bodyNode?.children?.map((node) => node.id)).toEqual([
      "child-a",
      "child-b",
      "child-c",
      "child-d",
    ]);
    expect(bodyNode?.children?.[1]?.props).toEqual({ label: "B updated" });
  });

  it("mergeElementsCanonicalPrimary can nest children inside page ref descendants", () => {
    const setElements = vi.fn();
    const page = makePage("page-1");
    useCanonicalDocumentStore.getState().setCurrentProject("project-1");
    useCanonicalDocumentStore.getState().setDocument(
      "project-1",
      makeDocument([
        {
          id: "layout-frame-1",
          type: "frame",
          reusable: true,
          metadata: { type: "legacy-layout", layoutId: "frame-1" },
          children: [],
        },
        {
          id: "page-1",
          type: "ref",
          ref: "layout-frame-1",
          metadata: {
            type: "legacy-page",
            pageId: "page-1",
            layoutId: "frame-1",
          },
          descendants: {},
        },
      ]),
    );
    registerCanonicalMutationStoreActions({
      getCurrentLegacySnapshot: () => ({
        elements: [],
        pages: [page],
        layouts: [makeLayout("frame-1")],
      }),
      getCurrentProjectId: () => "project-1",
    });

    mergeElementsCanonicalPrimary([
      makeElement("child-1", "Text", {
        parent_id: "parent-1",
        page_id: "page-1",
        order_num: 1,
      }),
      makeElement("parent-1", "Box", {
        page_id: "page-1",
        slot_name: "content",
        order_num: 0,
      }),
    ]);

    const nextDoc = useCanonicalDocumentStore
      .getState()
      .getDocument("project-1");
    const pageNode = nextDoc?.children.find((node) => node.id === "page-1");
    expect(pageNode).toEqual(
      expect.objectContaining({
        type: "ref",
        descendants: {
          content: {
            children: [
              expect.objectContaining({
                id: "parent-1",
                children: [expect.objectContaining({ id: "child-1" })],
              }),
            ],
          },
        },
      }),
    );
  });

  it("slot 노드도 responsive override 를 canonical 로 옮긴다 (ADR-168)", () => {
    // slot 분기는 필드를 직접 나열하며 early return 하므로 baseNode 의 1차 필드 스프레드에
    // 도달하지 않는다. 실측 회귀: Frame preset 이 슬롯에 breakpoint override 를 썼는데
    // body 만 반영되고 슬롯은 base 값으로 남아, mobile 에서 사이드바가 250px 그대로였다.
    const setElements = vi.fn();
    const page = { ...makePage("page-1"), layout_id: "frame-1" } as Page;
    useCanonicalDocumentStore.getState().setCurrentProject("project-1");
    useCanonicalDocumentStore
      .getState()
      .setDocument("project-1", makeDocument());
    registerCanonicalMutationStoreActions({
      getCurrentLegacySnapshot: () => ({
        elements: [],
        pages: [page],
        layouts: [makeLayout("frame-1")],
      }),
      getCurrentProjectId: () => "project-1",
    });

    const responsive = {
      styles: { width: { tablet: "200px", mobile: "100%" } },
    } as Element["responsive"];

    setElementsCanonicalPrimary([
      makeElement("frame-body", "body", { layout_id: "frame-1" }),
      {
        ...makeElement("slot-sidebar", "Slot", {
          parent_id: "frame-body",
          layout_id: "frame-1",
          props: { name: "sidebar" },
          slot_name: "sidebar",
        }),
        responsive,
      } as Element,
    ]);

    const doc = useCanonicalDocumentStore.getState().getDocument("project-1");
    const slotNode = doc!.children
      .flatMap((n) => n.children ?? [])
      .flatMap((n) => n.children ?? [])
      .find((n) => n.id === "slot-sidebar");

    expect(slotNode?.responsive).toEqual(responsive);
    expect(setElements).not.toHaveBeenCalled();
  });

  it("setElementsCanonicalPrimary rebuilds canonical shell without legacy projection", () => {
    const setElements = vi.fn();
    const page = {
      ...makePage("page-1"),
      layout_id: "frame-1",
    } as Page;
    const layout = makeLayout("frame-1");
    useCanonicalDocumentStore.getState().setCurrentProject("project-1");
    useCanonicalDocumentStore
      .getState()
      .setDocument("project-1", makeDocument());
    registerCanonicalMutationStoreActions({
      getCurrentLegacySnapshot: () => ({
        elements: [],
        pages: [page],
        layouts: [layout],
      }),
      getCurrentProjectId: () => "project-1",
    });

    setElementsCanonicalPrimary([
      makeElement("frame-body", "body", {
        layout_id: "frame-1",
      }),
      makeElement("slot-content", "Slot", {
        parent_id: "frame-body",
        layout_id: "frame-1",
        props: { name: "content" },
        slot_name: "content",
      }),
      makeElement("page-box", "Box", {
        page_id: "page-1",
        slot_name: "content",
      }),
    ]);

    const nextDoc = useCanonicalDocumentStore
      .getState()
      .getDocument("project-1");
    expect(nextDoc?.children).toEqual([
      expect.objectContaining({
        id: "layout-frame-1",
        type: "frame",
        reusable: true,
        children: [
          expect.objectContaining({
            id: "frame-body",
            children: [
              expect.objectContaining({
                id: "slot-content",
                metadata: expect.objectContaining({
                  type: "legacy-slot-hoisted",
                  slotName: "content",
                }),
              }),
            ],
          }),
        ],
      }),
      expect.objectContaining({
        id: "page-1",
        type: "ref",
        ref: "layout-frame-1",
        descendants: {
          "frame-body/slot-content": {
            children: [expect.objectContaining({ id: "page-box" })],
          },
        },
      }),
    ]);
    expect(canonicalDocumentToElements(nextDoc!)).toEqual([
      expect.objectContaining({ id: "frame-body", page_id: null }),
      expect.objectContaining({ id: "slot-content", page_id: null }),
      expect.objectContaining({ id: "page-box", page_id: "page-1" }),
    ]);
    expect(setElements).not.toHaveBeenCalled();
  });

  it("setElementsCanonicalPrimary keeps bound page direct body children during shell rebuild", () => {
    const setElements = vi.fn();
    const page = {
      ...makePage("page-1"),
      layout_id: "frame-1",
    } as Page;
    const layout = makeLayout("frame-1");
    useCanonicalDocumentStore.getState().setCurrentProject("project-1");
    useCanonicalDocumentStore.getState().setDocument(
      "project-1",
      makeDocument([
        {
          id: "layout-frame-1",
          type: "frame",
          reusable: true,
          metadata: { type: "legacy-layout", layoutId: "frame-1" },
          children: [],
        },
        {
          id: "page-1",
          type: "ref",
          ref: "layout-frame-1",
          metadata: {
            type: "legacy-page",
            pageId: "page-1",
            layoutId: "frame-1",
          },
          children: [
            {
              id: "page-1-body",
              type: "Body",
              props: {},
              children: [
                { id: "page-1-button", type: "Button", props: {} },
                {
                  id: "page-1-instance",
                  type: "ref",
                  ref: "origin",
                  props: {},
                },
              ],
            },
          ],
        },
      ]),
    );
    registerCanonicalMutationStoreActions({
      getCurrentLegacySnapshot: () => ({
        elements: [],
        pages: [page],
        layouts: [layout],
      }),
      getCurrentProjectId: () => "project-1",
    });

    setElementsCanonicalPrimary([
      makeElement("page-1-body", "Body", {
        page_id: "page-1",
        props: {},
      }),
      makeElement("page-1-button", "Button", {
        page_id: "page-1",
        parent_id: "page-1-body",
      }),
      makeElement("page-1-instance", "ref", {
        page_id: "page-1",
        parent_id: "page-1-body",
        ref: "origin",
      } as Partial<LegacyTestElement>),
    ]);

    const nextDoc = useCanonicalDocumentStore
      .getState()
      .getDocument("project-1");
    expect(JSON.stringify(nextDoc)).toContain("page-1-button");
    expect(JSON.stringify(nextDoc)).toContain("page-1-instance");
    expect(exportLegacyDocument(nextDoc!)).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: "page-1-button",
          page_id: "page-1",
          parent_id: "page-1-body",
        }),
        expect.objectContaining({
          id: "page-1-instance",
          page_id: "page-1",
          parent_id: "page-1-body",
        }),
      ]),
    );
    expect(setElements).not.toHaveBeenCalled();
  });

  it("setElementsCanonicalPrimary preserves an unbound page body during page-shell rebuild", () => {
    const setElements = vi.fn();
    const page = makePage("page-1") as Page;
    const layout = makeLayout("frame-1");
    useCanonicalDocumentStore.getState().setCurrentProject("project-1");
    useCanonicalDocumentStore.getState().setDocument(
      "project-1",
      makeDocument([
        {
          id: "layout-frame-1",
          type: "frame",
          reusable: true,
          metadata: { type: "legacy-layout", layoutId: "frame-1" },
          children: [],
        },
        {
          id: "page-1",
          type: "frame",
          metadata: {
            type: "legacy-page",
            pageId: "page-1",
          },
          children: [
            {
              id: "page-body",
              type: "body",
              props: { className: "react-aria-Body" },
            },
          ],
        },
      ]),
    );
    registerCanonicalMutationStoreActions({
      getCurrentLegacySnapshot: () => ({
        elements: [],
        pages: [page],
        layouts: [layout],
      }),
      getCurrentProjectId: () => "project-1",
    });

    setElementsCanonicalPrimary([
      makeElement("frame-body", "body", {
        layout_id: "frame-1",
      }),
    ]);

    const nextDoc = useCanonicalDocumentStore
      .getState()
      .getDocument("project-1");
    expect(nextDoc?.children).toEqual([
      expect.objectContaining({
        id: "layout-frame-1",
        children: [expect.objectContaining({ id: "frame-body" })],
      }),
      expect.objectContaining({
        id: "page-1",
        type: "frame",
        children: [expect.objectContaining({ id: "page-body" })],
      }),
    ]);
    expect(exportLegacyDocument(nextDoc!)).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: "page-body", page_id: "page-1" }),
        expect.objectContaining({ id: "frame-body", page_id: null }),
      ]),
    );
    expect(setElements).not.toHaveBeenCalled();
  });

  it("setElementsCanonicalPrimary prunes omitted page-owned siblings during full replace", () => {
    const setElements = vi.fn();
    const page = makePage("page-1") as Page;
    const keptButton = makeElement("button-1", "Button", {
      page_id: "page-1",
      props: { children: "Kept" },
    });
    const removedButton = makeElement("button-2", "Button", {
      page_id: "page-1",
      props: { children: "Removed" },
    });
    useCanonicalDocumentStore.getState().setCurrentProject("project-1");
    useCanonicalDocumentStore.getState().setDocument(
      "project-1",
      makeDocument([
        {
          id: "page-1",
          type: "frame",
          metadata: {
            type: "legacy-page",
            pageId: "page-1",
          },
          children: [
            makeCanonicalElementNode(keptButton),
            makeCanonicalElementNode(removedButton),
          ],
        },
      ]),
    );
    registerCanonicalMutationStoreActions({
      getCurrentLegacySnapshot: () => ({
        elements: [keptButton],
        pages: [page],
        layouts: [],
      }),
      getCurrentProjectId: () => "project-1",
    });

    setElementsCanonicalPrimary([keptButton]);

    const nextDoc = useCanonicalDocumentStore
      .getState()
      .getDocument("project-1");
    const pageNode = nextDoc?.children.find((node) => node.id === "page-1");
    expect(pageNode?.children?.map((node) => node.id)).toEqual(["button-1"]);
    expect(canonicalDocumentToElements(nextDoc!)).toEqual([
      expect.objectContaining({ id: "button-1", page_id: "page-1" }),
    ]);
    expect(setElements).not.toHaveBeenCalled();
  });

  it("setElementsCanonicalPrimary clears omitted page-owned origin children during full replace", () => {
    const setElements = vi.fn();
    const page = makePage("page-1") as Page;
    const body = makeElement("page-body", "body", {
      page_id: "page-1",
      props: { className: "react-aria-Body" },
    });
    useCanonicalDocumentStore.getState().setCurrentProject("project-1");
    useCanonicalDocumentStore.getState().setDocument(
      "project-1",
      makeDocument([
        {
          id: "page-1",
          type: "frame",
          metadata: {
            type: "legacy-page",
            pageId: "page-1",
          },
          children: [
            {
              id: "page-body",
              type: "body",
              props: body.props as Record<string, unknown>,
              children: [
                {
                  id: "origin",
                  type: "Button",
                  reusable: true,
                  props: { label: "Origin" },
                  children: [
                    {
                      id: "origin-label",
                      type: "Label",
                      props: { text: "Origin" },
                    },
                  ],
                },
              ],
            },
          ],
        },
      ]),
    );
    registerCanonicalMutationStoreActions({
      getCurrentLegacySnapshot: () => ({
        elements: [body],
        pages: [page],
        layouts: [],
      }),
      getCurrentProjectId: () => "project-1",
    });

    setElementsCanonicalPrimary([body]);

    const pageNode = useCanonicalDocumentStore
      .getState()
      .getDocument("project-1")?.children[0];
    const pageBody = pageNode?.children?.find(
      (node) => node.id === "page-body",
    );
    expect(pageBody?.children ?? []).toEqual([]);
    expect(
      canonicalDocumentToElements(
        useCanonicalDocumentStore.getState().getDocument("project-1")!,
      ),
    ).toEqual([
      expect.objectContaining({ id: "page-body", page_id: "page-1" }),
    ]);
    expect(setElements).not.toHaveBeenCalled();
  });

  it("mergeElementsCanonicalPrimary appends repeated slot fills in order", () => {
    const setElements = vi.fn();
    const page = {
      ...makePage("page-1"),
      layout_id: "frame-1",
    } as Page;
    useCanonicalDocumentStore.getState().setCurrentProject("project-1");
    useCanonicalDocumentStore.getState().setDocument(
      "project-1",
      makeDocument([
        {
          id: "layout-frame-1",
          type: "frame",
          reusable: true,
          metadata: { type: "legacy-layout", layoutId: "frame-1" },
          children: [
            {
              id: "frame-body",
              type: "body",
              metadata: { legacyProps: { id: "frame-body", order_num: 0 } },
              children: [
                {
                  id: "content",
                  type: "frame",
                  placeholder: true,
                  metadata: {
                    type: "legacy-slot-hoisted",
                    slotName: "content",
                  },
                  children: [],
                },
              ],
            },
          ],
        },
        {
          id: "page-1",
          type: "ref",
          ref: "layout-frame-1",
          metadata: {
            type: "legacy-page",
            pageId: "page-1",
            layoutId: "frame-1",
          },
          descendants: {},
        },
      ]),
    );
    registerCanonicalMutationStoreActions({
      getCurrentLegacySnapshot: () => ({
        elements: [],
        pages: [page],
        layouts: [makeLayout("frame-1")],
      }),
      getCurrentProjectId: () => "project-1",
    });

    mergeElementsCanonicalPrimary([
      makeElement("slot-fill-a", "Button", {
        page_id: "page-1",
        slot_name: "content",
        order_num: 0,
      }),
      makeElement("slot-fill-b", "Text", {
        page_id: "page-1",
        slot_name: "content",
        order_num: 1,
      }),
    ]);

    const nextDoc = useCanonicalDocumentStore
      .getState()
      .getDocument("project-1");
    const pageNode = nextDoc?.children.find((node) => node.id === "page-1");
    expect(pageNode).toEqual(
      expect.objectContaining({
        descendants: {
          "frame-body/content": {
            children: [
              expect.objectContaining({ id: "slot-fill-a" }),
              expect.objectContaining({ id: "slot-fill-b" }),
            ],
          },
        },
      }),
    );
    expect(exportLegacyDocument(nextDoc!)).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: "slot-fill-a", page_id: "page-1" }),
        expect.objectContaining({ id: "slot-fill-b", page_id: "page-1" }),
      ]),
    );
    expect(setElements).not.toHaveBeenCalled();
  });

  it("mergeElementsCanonicalPrimary preserves existing slot descendant order for legacy-order-only batches", () => {
    const setElements = vi.fn();
    const page = {
      ...makePage("page-1"),
      layout_id: "frame-1",
    } as Page;
    const slotFillA = makeElement("slot-fill-a", "Button", {
      page_id: "page-1",
      slot_name: "content",
      order_num: 0,
    } as never);
    const slotFillB = makeElement("slot-fill-b", "Heading", {
      page_id: "page-1",
      slot_name: "content",
      order_num: 1,
    } as never);
    const slotFillC = makeElement("slot-fill-c", "Text", {
      page_id: "page-1",
      slot_name: "content",
      order_num: 2,
    } as never);
    const slotFillD = makeElement("slot-fill-d", "Image", {
      page_id: "page-1",
      slot_name: "content",
      order_num: 3,
    } as never);

    useCanonicalDocumentStore.getState().setCurrentProject("project-1");
    useCanonicalDocumentStore.getState().setDocument(
      "project-1",
      makeDocument([
        {
          id: "layout-frame-1",
          type: "frame",
          reusable: true,
          metadata: { type: "legacy-layout", layoutId: "frame-1" },
          children: [
            {
              id: "frame-body",
              type: "body",
              props: {},
              metadata: { legacyProps: { id: "frame-body", order_num: 0 } },
              children: [
                {
                  id: "content",
                  type: "frame",
                  placeholder: true,
                  metadata: {
                    type: "legacy-slot-hoisted",
                    slotName: "content",
                  },
                  children: [],
                },
              ],
            },
          ],
        },
        {
          id: "page-1",
          type: "ref",
          ref: "layout-frame-1",
          metadata: {
            type: "legacy-page",
            pageId: "page-1",
            layoutId: "frame-1",
          },
          descendants: {
            "frame-body/content": {
              children: [
                makeCanonicalElementNode(slotFillA),
                makeCanonicalElementNode(slotFillB),
                makeCanonicalElementNode(slotFillC),
                makeCanonicalElementNode(slotFillD),
              ],
            },
          },
        },
      ]),
    );
    registerCanonicalMutationStoreActions({
      getCurrentLegacySnapshot: () => ({
        elements: [slotFillA, slotFillB, slotFillC, slotFillD],
        pages: [page],
        layouts: [makeLayout("frame-1")],
      }),
      getCurrentProjectId: () => "project-1",
    });

    mergeElementsCanonicalPrimary([
      { ...slotFillC, order_num: 0 },
      { ...slotFillA, order_num: 1 },
      { ...slotFillB, order_num: 2 },
      slotFillD,
    ]);

    const nextDoc = useCanonicalDocumentStore
      .getState()
      .getDocument("project-1");
    const pageNode = nextDoc?.children.find((node) => node.id === "page-1");
    const descendants = (pageNode as { descendants?: unknown })?.descendants as
      | Record<string, { children?: CompositionDocument["children"] }>
      | undefined;
    expect(
      descendants?.["frame-body/content"]?.children?.map((node) => node.id),
    ).toEqual(["slot-fill-a", "slot-fill-b", "slot-fill-c", "slot-fill-d"]);
    expect(setElements).not.toHaveBeenCalled();
  });

  it("setElementsCanonicalPrimary clears omitted slot fills during full replace", () => {
    const setElements = vi.fn();
    const page = {
      ...makePage("page-1"),
      layout_id: "frame-1",
    } as Page;
    useCanonicalDocumentStore.getState().setCurrentProject("project-1");
    useCanonicalDocumentStore.getState().setDocument(
      "project-1",
      makeDocument([
        {
          id: "layout-frame-1",
          type: "frame",
          reusable: true,
          metadata: { type: "legacy-layout", layoutId: "frame-1" },
          children: [],
        },
        {
          id: "page-1",
          type: "ref",
          ref: "layout-frame-1",
          metadata: {
            type: "legacy-page",
            pageId: "page-1",
            layoutId: "frame-1",
          },
          descendants: {
            "frame-body/content": {
              children: [
                {
                  id: "old-fill",
                  type: "Button",
                  props: {},
                  metadata: {
                    legacyProps: {
                      id: "old-fill",
                      page_id: "page-1",
                      slot_name: "content",
                    },
                  },
                },
              ],
            },
          },
        },
      ]),
    );
    registerCanonicalMutationStoreActions({
      getCurrentLegacySnapshot: () => ({
        elements: [],
        pages: [page],
        layouts: [makeLayout("frame-1")],
      }),
      getCurrentProjectId: () => "project-1",
    });

    setElementsCanonicalPrimary([
      makeElement("frame-body", "body", {
        layout_id: "frame-1",
      }),
      makeElement("slot-content", "Slot", {
        parent_id: "frame-body",
        layout_id: "frame-1",
        props: { name: "content" },
        slot_name: "content",
      }),
    ]);

    const nextDoc = useCanonicalDocumentStore
      .getState()
      .getDocument("project-1");
    const pageNode = nextDoc?.children.find((node) => node.id === "page-1");
    expect(pageNode).toEqual(
      expect.objectContaining({
        type: "ref",
        descendants: {},
      }),
    );
    expect(exportLegacyDocument(nextDoc!)).toEqual(
      expect.not.arrayContaining([expect.objectContaining({ id: "old-fill" })]),
    );
    expect(setElements).not.toHaveBeenCalled();
  });

  it("mergeElementsCanonicalPrimary preserves ref and descendants mirror fields for legacy export", () => {
    const setElements = vi.fn();
    const page = makePage("page-1");
    useCanonicalDocumentStore.getState().setCurrentProject("project-1");
    useCanonicalDocumentStore.getState().setDocument(
      "project-1",
      makeDocument([
        {
          id: "page-1",
          type: "frame",
          metadata: { type: "legacy-page", pageId: "page-1" },
          children: [],
        },
      ]),
    );
    registerCanonicalMutationStoreActions({
      getCurrentLegacySnapshot: () => ({
        elements: [],
        pages: [page],
        layouts: [],
      }),
      getCurrentProjectId: () => "project-1",
    });

    mergeElementsCanonicalPrimary([
      makeElement("master", "Button", {
        componentRole: "master",
        componentName: "Master Button",
        order_num: 0,
      }),
      makeElement("master-label", "Text", {
        parent_id: "master",
        order_num: 1,
      }),
      makeElement("instance", "Button", {
        page_id: "page-1",
        componentRole: "instance",
        masterId: "master",
        overrides: { children: "Override" },
        descendants: { "master-label": { children: "Child Override" } },
        order_num: 2,
      }),
    ]);

    const nextDoc = useCanonicalDocumentStore
      .getState()
      .getDocument("project-1");
    const pageNode = nextDoc?.children.find((node) => node.id === "page-1");
    expect(pageNode?.children).toEqual([
      expect.objectContaining({
        id: "instance",
        type: "ref",
        ref: "master",
        props: { children: "Override" },
        descendants: {
          "master-label": { children: "Child Override" },
        },
      }),
    ]);
    expect(exportLegacyDocument(nextDoc!)).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: "master",
          componentRole: "master",
          componentName: "Master Button",
        }),
        expect.objectContaining({
          id: "instance",
          componentRole: "instance",
          masterId: "master",
          overrides: { children: "Override" },
          descendants: { "master-label": { children: "Child Override" } },
        }),
      ]),
    );
    expect(setElements).not.toHaveBeenCalled();
  });

  it("mergeElementsCanonicalPrimary preserves canonical ref fields from pasted component instances", () => {
    const setElements = vi.fn();
    const page = makePage("page-1");
    useCanonicalDocumentStore.getState().setCurrentProject("project-1");
    useCanonicalDocumentStore.getState().setDocument(
      "project-1",
      makeDocument([
        {
          id: "page-1",
          type: "frame",
          metadata: { type: "legacy-page", pageId: "page-1" },
          children: [
            {
              id: "origin",
              type: "Button",
              reusable: true,
              name: "Primary Button",
              props: { children: "Origin" },
              children: [
                {
                  id: "origin-label",
                  type: "Text",
                  props: { children: "Label" },
                },
              ],
            },
          ],
        },
      ]),
    );
    registerCanonicalMutationStoreActions({
      getCurrentLegacySnapshot: () => ({
        elements: [],
        pages: [page],
        layouts: [],
      }),
      getCurrentProjectId: () => "project-1",
    });

    mergeElementsCanonicalPrimary([
      makeElement("instance", "ref", {
        page_id: "page-1",
        ref: "origin",
        props: { style: { left: "24px" } },
        order_num: 1,
      } as never),
    ]);

    const nextDoc = useCanonicalDocumentStore
      .getState()
      .getDocument("project-1");
    const pageNode = nextDoc?.children.find((node) => node.id === "page-1");
    expect(pageNode?.children).toEqual([
      expect.objectContaining({
        id: "origin",
        reusable: true,
      }),
      expect.objectContaining({
        id: "instance",
        type: "ref",
        ref: "origin",
        props: { style: { left: "24px" } },
      }),
    ]);
    expect(exportLegacyDocument(nextDoc!)).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: "instance",
          type: "ref",
          ref: "origin",
          componentRole: "instance",
          masterId: "origin",
          overrides: { style: { left: "24px" } },
        }),
      ]),
    );
    expect(setElements).not.toHaveBeenCalled();
  });

  it("mergeElementsCanonicalPrimary stores origin-shaped ref mirrors as RefNode overrides", () => {
    const setElements = vi.fn();
    const page = makePage("page-1");
    useCanonicalDocumentStore.getState().setCurrentProject("project-1");
    useCanonicalDocumentStore.getState().setDocument(
      "project-1",
      makeDocument([
        {
          id: "page-1",
          type: "frame",
          metadata: { type: "legacy-page", pageId: "page-1" },
          children: [
            {
              id: "origin",
              type: "Button",
              reusable: true,
              props: {
                children: "Origin",
                size: "md",
                style: { color: "red", minWidth: 120 },
              },
            },
          ],
        },
      ]),
    );
    registerCanonicalMutationStoreActions({
      getCurrentLegacySnapshot: () => ({
        elements: [],
        pages: [page],
        layouts: [],
      }),
      getCurrentProjectId: () => "project-1",
    });

    mergeElementsCanonicalPrimary([
      makeElement("instance", "Button", {
        page_id: "page-1",
        ref: "origin",
        props: {
          children: "Instance",
          size: "md",
          style: { color: "red", minWidth: 240 },
        },
        order_num: 1,
      } as never),
    ]);

    const nextDoc = useCanonicalDocumentStore
      .getState()
      .getDocument("project-1");
    const pageNode = nextDoc?.children.find((node) => node.id === "page-1");
    expect(pageNode?.children).toEqual([
      expect.objectContaining({
        id: "origin",
        reusable: true,
      }),
      expect.objectContaining({
        id: "instance",
        type: "ref",
        ref: "origin",
        props: {
          children: "Instance",
          style: { minWidth: 240 },
        },
        metadata: expect.objectContaining({
          legacyProps: expect.objectContaining({
            overrides: {
              children: "Instance",
              style: { minWidth: 240 },
            },
          }),
        }),
      }),
    ]);
  });

  it("mergeElementsCanonicalPrimary preserves reusable page origins across export round-trip", () => {
    const setElements = vi.fn();
    const page = makePage("page-1");
    useCanonicalDocumentStore.getState().setCurrentProject("project-1");
    useCanonicalDocumentStore.getState().setDocument(
      "project-1",
      makeDocument([
        {
          id: "page-1",
          type: "frame",
          metadata: { type: "legacy-page", pageId: "page-1" },
          children: [],
        },
      ]),
    );
    registerCanonicalMutationStoreActions({
      getCurrentLegacySnapshot: () => ({
        elements: [],
        pages: [page],
        layouts: [],
      }),
      getCurrentProjectId: () => "project-1",
    });

    mergeElementsCanonicalPrimary([
      makeElement("origin", "Button", {
        page_id: "page-1",
        componentName: "primary-action",
        reusable: true,
        order_num: 0,
      } as never),
    ]);

    const firstDoc = useCanonicalDocumentStore
      .getState()
      .getDocument("project-1");
    const firstPageNode = firstDoc?.children.find(
      (node) => node.id === "page-1",
    );
    expect(firstPageNode?.children).toEqual([
      expect.objectContaining({
        id: "origin",
        reusable: true,
        metadata: expect.objectContaining({
          legacyProps: expect.objectContaining({
            componentRole: "master",
            page_id: "page-1",
          }),
        }),
      }),
    ]);

    const derivedElements = exportLegacyDocument(firstDoc!);
    const exportedOrigin = derivedElements.find(
      (element) => element.id === "origin",
    );
    expect(exportedOrigin).toMatchObject({
      id: "origin",
      page_id: "page-1",
      parent_id: null,
      componentRole: "master",
      reusable: true,
    });

    mergeElementsCanonicalPrimary([exportedOrigin as Element]);

    const roundTripDoc = useCanonicalDocumentStore
      .getState()
      .getDocument("project-1");
    const roundTripPageNode = roundTripDoc?.children.find(
      (node) => node.id === "page-1",
    );
    expect(
      roundTripDoc?.children.filter((node) => node.id === "origin"),
    ).toHaveLength(0);
    expect(roundTripPageNode?.children).toEqual([
      expect.objectContaining({
        id: "origin",
        reusable: true,
      }),
    ]);
    expect(setElements).not.toHaveBeenCalled();
  });

  it("merge path does not rebuild via legacyToCanonical", async () => {
    const source = await readFile(
      resolve(__dirname, "../canonicalMutations.ts"),
      "utf-8",
    );
    const mergeBody = source.slice(
      source.indexOf("function applyCanonicalPrimaryMerge"),
      source.indexOf("function applyCanonicalPrimarySet"),
    );

    expect(mergeBody).not.toContain("legacyToCanonical(");
  });

  it("set path does not rebuild via legacyToCanonical", async () => {
    const source = await readFile(
      resolve(__dirname, "../canonicalMutations.ts"),
      "utf-8",
    );
    const setBody = source.slice(
      source.indexOf("function applyCanonicalPrimarySet"),
      source.indexOf(
        "// ─────────────────────────────────────────────\n// In-memory store wrapper API",
      ),
    );

    expect(setBody).not.toContain("legacyToCanonical(");
  });
});
