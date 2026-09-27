import { beforeEach, describe, expect, it, vi } from "vitest";
import type {
  CanonicalNode,
  CompositionDocument,
  RefNode,
} from "@composition/shared";
import {
  mergeElementsCanonicalPrimary,
  registerCanonicalMutationStoreActions,
  resetCanonicalMutationStoreActions,
} from "@/adapters/canonical/canonicalMutations";
import {
  COMPONENT_DESCENDANTS_MIRROR_FIELD,
  COMPONENT_MASTER_ID_MIRROR_FIELD,
  COMPONENT_OVERRIDES_MIRROR_FIELD,
  COMPONENT_ROLE_MIRROR_FIELD,
  withComponentInstanceMirror,
  withComponentOriginMirror,
} from "@/adapters/canonical/componentSemanticsMirror";
import type { Element, Page } from "../../../../types/core/store.types";
import { useCanonicalDocumentStore } from "../../canonical/canonicalDocumentStore";
import {
  resolveEditingSemanticsImpactConfirmation,
  subscribeEditingSemanticsImpactConfirmation,
  type EditingSemanticsConfirmationRequest,
} from "../../../utils/editingSemanticsImpactConfirmation";
import { useStore } from "../../elements";
import { resolveCanonicalDocument } from "../../../../resolvers/canonical";
import { historyManager } from "../../history";

/**
 * Legacy-shaped element fixture overrides. canonical 모델은 `order_num` 을 제거했고
 * `reusable` / `ref` 는 canonical node 필드(CanonicalNode/RefNode)지만, instance
 * mutation 의 legacy↔canonical bridge 가 runtime 에서 이 필드들을 element 객체에서
 * 읽으므로 (Element 타입엔 미선언) fixture 가 top-level 로 주입한다. 타입만 허용.
 */
type LegacyElementOverrides = Partial<Element> & {
  order_num?: number;
  reusable?: boolean;
  ref?: string;
};

function makeElement(
  id: string,
  overrides: LegacyElementOverrides = {},
): Element {
  return {
    id,
    type: "Button",
    parent_id: null,
    page_id: "page-1",
    order_num: 0,
    props: {},
    ...overrides,
  } as Element;
}

function findCanonicalNodeById(
  nodes: CanonicalNode[],
  id: string,
): CanonicalNode | undefined {
  for (const node of nodes) {
    if (node.id === id) return node;
    const found = findCanonicalNodeById(node.children ?? [], id);
    if (found) return found;
  }
  return undefined;
}

/**
 * 실빌더 환경 정렬 helper — canonical document 시드.
 * canonical event 기반 history (replace/insert event) 의 undo/redo 는
 * active canonical document 를 요구한다 (ADR-116 primary SSOT).
 */
function seedCanonicalFromStore(): void {
  registerCanonicalMutationStoreActions({
    getCurrentProjectId: () => "instance-project",
    getCurrentLegacySnapshot: () => ({
      elements: useStore.getState().elements,
      pages: [],
      layouts: [],
    }),
  });
  useCanonicalDocumentStore.getState().setCurrentProject("instance-project");
  mergeElementsCanonicalPrimary(useStore.getState().elements);
}

describe("instance store actions", () => {
  const addEntrySpy = vi.spyOn(historyManager, "addEntry");

  beforeEach(() => {
    resetCanonicalMutationStoreActions();
    useCanonicalDocumentStore.setState({
      documents: new Map(),
      currentProjectId: null,
      documentVersion: 0,
    });
    addEntrySpy.mockClear();
    historyManager.setCurrentPage("page-1");
    useStore.setState({
      currentPageId: "page-1",
      pages: [],
      elements: [],
      elementsMap: new Map(),
      childrenMap: new Map(),
      selectedElementId: null,
      selectedElementProps: {},
      selectedElementIds: [],
      selectedElementIdsSet: new Set<string>(),
      multiSelectMode: false,
    } as never);
  });

  it("creates an instance from canonical source with a fresh customId", () => {
    const body = makeElement("body", {
      type: "body",
      customId: "body_1",
      parent_id: null,
      order_num: 0,
    });
    const origin = withComponentOriginMirror(
      makeElement("origin", {
        customId: "button_1",
        parent_id: body.id,
        order_num: 1,
      }),
    );

    useStore.setState({
      elements: [body, origin],
      elementsMap: new Map([
        [body.id, body],
        [origin.id, origin],
      ]),
    } as never);
    useStore.getState()._rebuildIndexes();
    seedCanonicalFromStore();

    const instance = useStore
      .getState()
      .createInstance(origin.id, body.id, "page-1");

    expect(instance).toEqual(
      expect.objectContaining({
        customId: "button_2",
        [COMPONENT_ROLE_MIRROR_FIELD]: "instance",
        [COMPONENT_MASTER_ID_MIRROR_FIELD]: origin.id,
      }),
    );
    expect(instance?.customId).not.toBe(origin.customId);
    expect(
      useStore.getState().elementsMap.get(instance?.id ?? "")?.customId,
    ).toBe("button_2");
  });

  it("does not create an instance from legacy-only store elements", () => {
    const origin = withComponentOriginMirror(
      makeElement("origin", { customId: "button_1" }),
    );
    useStore.setState({
      elements: [origin],
      elementsMap: new Map([[origin.id, origin]]),
    } as never);
    useStore.getState()._rebuildIndexes();

    const instance = useStore
      .getState()
      .createInstance(origin.id, "body", "page-1");

    expect(instance).toBeNull();
    expect(useStore.getState().elements).toEqual([origin]);
    expect(addEntrySpy).not.toHaveBeenCalled();
  });

  it("creates an instance customId after existing ref instance IDs with the same base", () => {
    const body = makeElement("body", {
      type: "body",
      customId: "body_1",
      parent_id: null,
      order_num: 0,
    });
    const origin = withComponentOriginMirror(
      makeElement("origin", {
        customId: "button_1",
        parent_id: body.id,
        order_num: 1,
      }),
    );
    const existingInstance = makeElement("existing-instance", {
      type: "ref",
      customId: "button_2",
      parent_id: body.id,
      order_num: 2,
    });

    useStore.setState({
      elements: [body, origin, existingInstance],
      elementsMap: new Map([
        [body.id, body],
        [origin.id, origin],
        [existingInstance.id, existingInstance],
      ]),
    } as never);
    useStore.getState()._rebuildIndexes();
    seedCanonicalFromStore();

    const instance = useStore
      .getState()
      .createInstance(origin.id, body.id, "page-1");

    expect(instance?.customId).toBe("button_3");
  });

  it("syncs a created instance customId into the active canonical document for refresh", () => {
    const page = {
      id: "page-1",
      title: "Home",
      project_id: "project-1",
      slug: "/",
      order_num: 0,
    } as Page;
    const body = makeElement("body", {
      type: "body",
      customId: "body_1",
      parent_id: null,
      order_num: 0,
    });
    const origin = withComponentOriginMirror(
      makeElement("origin", {
        customId: "button_1",
        parent_id: body.id,
        order_num: 1,
      }),
    );
    const doc = {
      version: "composition-1.0",
      children: [
        {
          id: "page-1",
          type: "frame",
          metadata: { type: "legacy-page", pageId: "page-1" },
          children: [
            {
              id: "body",
              // canonical body 는 runtime 에서 lowercase "body" 로 판정되지만
              // (elementUtils 의 strict `=== "body"`), ComponentTag 타입은 "Body" 만
              // 선언 → 소스(pageFrameBinding.ts) 와 동일하게 token cast 로 정합.
              type: "body" as CanonicalNode["type"],
              props: {},
              metadata: {
                type: "legacy-element-props",
                customId: "body_1",
              },
              children: [
                {
                  id: "origin",
                  type: "Button",
                  reusable: true,
                  props: {},
                  metadata: {
                    type: "legacy-element-props",
                    customId: "button_1",
                  },
                },
              ],
            },
          ],
        },
      ],
    } satisfies CompositionDocument;

    useStore.setState({
      currentPageId: "page-1",
      pages: [page],
      elements: [body, origin],
      elementsMap: new Map([
        [body.id, body],
        [origin.id, origin],
      ]),
    } as never);
    useStore.getState()._rebuildIndexes();
    useCanonicalDocumentStore.getState().setCurrentProject("project-1");
    useCanonicalDocumentStore.getState().setDocument("project-1", doc);
    registerCanonicalMutationStoreActions({
      getCurrentLegacySnapshot: () => ({
        elements: useStore.getState().elements,
        pages: [page],
        layouts: [],
      }),
      getCurrentProjectId: () => "project-1",
    });

    const instance = useStore
      .getState()
      .createInstance(origin.id, body.id, "page-1");

    expect(instance?.customId).toBe("button_2");
    const nextDoc = useCanonicalDocumentStore
      .getState()
      .getDocument("project-1");
    const instanceNode = findCanonicalNodeById(
      nextDoc?.children ?? [],
      instance?.id ?? "",
    );
    expect(instanceNode).toMatchObject({
      id: instance?.id,
      type: "ref",
      ref: origin.id,
      metadata: expect.objectContaining({
        customId: "button_2",
        legacyProps: expect.objectContaining(
          withComponentInstanceMirror({ customId: "button_2" }, origin.id),
        ),
      }),
    });
  });

  it("detaches a canonical ref into a standalone element", () => {
    const master = withComponentOriginMirror(
      makeElement("master", {
        props: { label: "Master", style: { color: "red", padding: "8px" } },
      }),
    );
    const instance = withComponentInstanceMirror(
      makeElement("instance", {
        props: { ignored: true },
      }),
      "master",
      { overrideProps: { label: "Instance", style: { color: "blue" } } },
    );

    useStore.setState({
      elements: [master, instance],
      selectedElementId: "instance",
      elementsMap: new Map([
        ["master", master],
        ["instance", instance],
      ]),
    } as never);
    useStore.getState()._rebuildIndexes();
    seedCanonicalFromStore();

    const result = useStore.getState().detachInstance("instance");
    const detached = useStore.getState().elementsMap.get("instance");

    expect(result?.previousState).toMatchObject({
      type: "ref",
      ref: "master",
      props: { label: "Instance", style: { color: "blue" } },
    });
    expect(detached).toMatchObject({
      id: "instance",
      props: { label: "Instance", style: { color: "blue", padding: "8px" } },
    });
    const detachedSemantics = detached as
      | (Element & {
          [COMPONENT_ROLE_MIRROR_FIELD]?: unknown;
          [COMPONENT_MASTER_ID_MIRROR_FIELD]?: unknown;
          [COMPONENT_OVERRIDES_MIRROR_FIELD]?: unknown;
          [COMPONENT_DESCENDANTS_MIRROR_FIELD]?: unknown;
        })
      | undefined;
    expect(detachedSemantics?.[COMPONENT_ROLE_MIRROR_FIELD]).toBeUndefined();
    expect(
      detachedSemantics?.[COMPONENT_MASTER_ID_MIRROR_FIELD],
    ).toBeUndefined();
    expect(
      detachedSemantics?.[COMPONENT_OVERRIDES_MIRROR_FIELD],
    ).toBeUndefined();
    expect(
      detachedSemantics?.[COMPONENT_DESCENDANTS_MIRROR_FIELD],
    ).toBeUndefined();
    expect(
      useStore.getState().componentIndex.masterToInstances.get("master"),
    ).toBeUndefined();
    expect(useStore.getState().selectedElementProps.label).toBe("Instance");
    expect(addEntrySpy).toHaveBeenCalledWith(
      expect.objectContaining({
        type: "batch",
        elementId: "instance",
        data: expect.objectContaining({
          canonicalEvents: expect.arrayContaining([
            expect.objectContaining({ type: "remove" }),
            expect.objectContaining({ type: "insert" }),
          ]),
        }),
      }),
    );
  });

  it("resets a legacy instance root override field with history", async () => {
    const master = withComponentOriginMirror(
      makeElement("master", {
        props: { label: "Master", style: { color: "red" } },
      }),
    );
    const instance = withComponentInstanceMirror(
      makeElement("instance"),
      "master",
      { overrideProps: { label: "Instance", style: { color: "blue" } } },
    );

    useStore.setState({
      elements: [master, instance],
      selectedElementId: "instance",
      elementsMap: new Map([
        ["master", master],
        ["instance", instance],
      ]),
    } as never);
    useStore.getState()._rebuildIndexes();

    // 실빌더 환경 정렬: canonical document 시드 (replace event undo 경로가
    // canonical doc 을 요구 — ADR-116 primary SSOT)
    registerCanonicalMutationStoreActions({
      getCurrentProjectId: () => "instance-project",
      getCurrentLegacySnapshot: () => ({
        elements: useStore.getState().elements,
        pages: [],
        layouts: [],
      }),
    });
    useCanonicalDocumentStore.getState().setCurrentProject("instance-project");
    mergeElementsCanonicalPrimary([master, instance]);

    const result = useStore
      .getState()
      .resetInstanceOverrideField("instance", "label");

    // canonical 시드 후 source 는 canonical-derived 형태 (ref 의 overrides 는
    // props 로 노출) — 핵심 필드만 비교
    expect(result?.previousState).toMatchObject({
      id: "instance",
      props: {
        label: "Instance",
        style: { color: "blue" },
      },
    });
    const afterReset = useStore.getState().elementsMap.get("instance");
    expect(afterReset).toMatchObject({
      props: { style: { color: "blue" } },
    });
    expect(
      (afterReset?.props as Record<string, unknown> | undefined)?.label,
    ).toBeUndefined();
    // canonical replace event 쌍 (remove prev + insert next) 부착 검증
    expect(addEntrySpy).toHaveBeenCalledWith(
      expect.objectContaining({
        type: "update",
        elementId: "instance",
        data: expect.objectContaining({
          canonicalEvents: [
            expect.objectContaining({ type: "remove" }),
            expect.objectContaining({ type: "insert" }),
          ],
        }),
      }),
    );

    await useStore.getState().undo();
    expect(useStore.getState().elementsMap.get("instance")).toMatchObject({
      props: {
        label: "Instance",
        style: { color: "blue" },
      },
    });

    await useStore.getState().redo();
    const afterRedo = useStore.getState().elementsMap.get("instance");
    expect(afterRedo).toMatchObject({
      props: { style: { color: "blue" } },
    });
    expect(
      (afterRedo?.props as Record<string, unknown> | undefined)?.label,
    ).toBeUndefined();
  });

  it("resets a canonical ref props override field", () => {
    const ref = makeElement("ref", {
      type: "ref",
      ref: "master",
      props: { label: "Instance", style: { color: "blue" } },
    } as never);

    useStore.setState({
      elements: [ref],
      elementsMap: new Map([["ref", ref]]),
    } as never);
    useStore.getState()._rebuildIndexes();
    seedCanonicalFromStore();

    useStore.getState().resetInstanceOverrideField("ref", "label");

    expect(useStore.getState().elementsMap.get("ref")).toMatchObject({
      props: { style: { color: "blue" } },
    });
  });

  it("resets a canonical ref descendant override field with history", async () => {
    const ref = makeElement("ref", {
      type: "ref",
      ref: "master",
      descendants: {
        "slot/label": { text: "Custom label", tone: "accent" },
        icon: {
          props: { name: "check", size: "sm" },
        },
      },
    } as never);

    useStore.setState({
      elements: [ref],
      elementsMap: new Map([["ref", ref]]),
    } as never);
    useStore.getState()._rebuildIndexes();

    // 실빌더 환경 정렬: canonical document 시드
    registerCanonicalMutationStoreActions({
      getCurrentProjectId: () => "instance-project",
      getCurrentLegacySnapshot: () => ({
        elements: useStore.getState().elements,
        pages: [],
        layouts: [],
      }),
    });
    useCanonicalDocumentStore.getState().setCurrentProject("instance-project");
    mergeElementsCanonicalPrimary([ref]);

    const result = useStore
      .getState()
      .resetInstanceOverrideField("ref", "text", "slot/label");

    // canonical 시드 후 source 는 canonical-derived 형태 — 핵심 필드만 비교
    expect(result?.previousState).toMatchObject({
      id: "ref",
      descendants: {
        "slot/label": { text: "Custom label", tone: "accent" },
      },
    });
    expect(useStore.getState().elementsMap.get("ref")).toMatchObject({
      descendants: {
        "slot/label": { tone: "accent" },
        icon: {
          props: { name: "check", size: "sm" },
        },
      },
    });
    // canonical replace event 쌍 (remove prev + insert next) 부착 검증
    expect(addEntrySpy).toHaveBeenCalledWith(
      expect.objectContaining({
        type: "update",
        elementId: "ref",
        data: expect.objectContaining({
          canonicalEvents: [
            expect.objectContaining({ type: "remove" }),
            expect.objectContaining({ type: "insert" }),
          ],
        }),
      }),
    );

    await useStore.getState().undo();
    expect(useStore.getState().elementsMap.get("ref")).toMatchObject({
      descendants: {
        "slot/label": { text: "Custom label", tone: "accent" },
      },
    });
  });

  it("syncs reset canonical ref descendants into the active canonical document", () => {
    const page = {
      id: "page-1",
      title: "Home",
      project_id: "project-1",
      slug: "/",
      order_num: 0,
    } as Page;
    const body = makeElement("body", {
      type: "body",
      parent_id: null,
      order_num: 0,
    });
    const master = makeElement("master", {
      type: "Card",
      parent_id: body.id,
      reusable: true,
      props: { title: "Origin title" },
      order_num: 0,
    });
    const heading = makeElement("heading", {
      type: "Heading",
      parent_id: master.id,
      customId: "heading",
      props: { children: "Origin title" },
      order_num: 0,
    });
    const ref = makeElement("ref", {
      type: "ref",
      ref: master.id,
      parent_id: body.id,
      props: { title: "Instance title" },
      descendants: {
        heading: { children: "Instance title", tone: "accent" },
      },
      order_num: 1,
    } as never);
    const doc = {
      version: "composition-1.0",
      children: [
        {
          id: "page-1",
          type: "frame",
          metadata: { type: "legacy-page", pageId: "page-1" },
          children: [
            {
              id: "body",
              // canonical lowercase "body" ↔ ComponentTag "Body" 정합 (위 동일 사유).
              type: "body" as CanonicalNode["type"],
              props: {},
              metadata: { type: "legacy-element-props" },
              children: [
                {
                  id: "master",
                  type: "Card",
                  reusable: true,
                  props: { title: "Origin title" },
                  metadata: { type: "legacy-element-props" },
                  children: [
                    {
                      id: "heading",
                      type: "Heading",
                      props: { children: "Origin title" },
                      metadata: {
                        type: "legacy-element-props",
                        customId: "heading",
                      },
                    },
                  ],
                },
                {
                  id: "ref",
                  type: "ref",
                  ref: "master",
                  props: { title: "Instance title" },
                  descendants: {
                    heading: { children: "Instance title", tone: "accent" },
                  },
                  metadata: { type: "legacy-element-props" },
                  // RefNode 전용 필드(ref/descendants)는 base CanonicalNode 에 없어
                  // children 배열(CanonicalNode[]) 검사 시 excess → RefNode 로 명시.
                  // descendants override 값은 minimal fixture 라 RefNode 와 부분 overlap
                  // → unknown 경유 (runtime 이 구조 처리, 본 테스트 green).
                } as unknown as RefNode,
              ],
            },
          ],
        },
      ],
    } satisfies CompositionDocument;

    useStore.setState({
      currentPageId: "page-1",
      pages: [page],
      elements: [body, master, heading, ref],
      elementsMap: new Map([
        [body.id, body],
        [master.id, master],
        [heading.id, heading],
        [ref.id, ref],
      ]),
      selectedElementId: ref.id,
      selectedElementProps: ref.props,
    } as never);
    useStore.getState()._rebuildIndexes();
    useCanonicalDocumentStore.getState().setCurrentProject("project-1");
    useCanonicalDocumentStore.getState().setDocument("project-1", doc);
    registerCanonicalMutationStoreActions({
      getCurrentLegacySnapshot: () => ({
        elements: useStore.getState().elements,
        pages: [page],
        layouts: [],
      }),
      getCurrentProjectId: () => "project-1",
    });

    useStore
      .getState()
      .resetInstanceOverrideField(ref.id, "children", "heading");

    const nextDoc = useCanonicalDocumentStore
      .getState()
      .getDocument("project-1");
    const refNode = findCanonicalNodeById(nextDoc?.children ?? [], ref.id) as
      RefNode | undefined;

    expect(refNode?.descendants).toEqual({
      heading: { tone: "accent" },
    });
  });

  it("resets a canonical ref descendant props field", () => {
    const ref = makeElement("ref", {
      type: "ref",
      ref: "master",
      descendants: {
        icon: {
          props: { name: "check", size: "sm" },
        },
      },
    } as never);

    useStore.setState({
      elements: [ref],
      elementsMap: new Map([["ref", ref]]),
    } as never);
    useStore.getState()._rebuildIndexes();
    seedCanonicalFromStore();

    useStore.getState().resetInstanceOverrideField("ref", "name", "icon");

    expect(useStore.getState().elementsMap.get("ref")).toMatchObject({
      descendants: {
        icon: {
          props: { size: "sm" },
        },
      },
    });
  });

  it("materializes a canonical ref into a standalone subtree", async () => {
    const logSpy = vi.spyOn(console, "log").mockImplementation(() => {});
    const master = makeElement("master", {
      reusable: true,
      props: { label: "Master", style: { color: "red", padding: "8px" } },
    });
    const child = makeElement("label", {
      type: "Text",
      parent_id: "master",
      customId: "label",
      props: { text: "OK" },
    });
    const ref = makeElement("ref", {
      type: "ref",
      ref: "master",
      props: { label: "Instance", style: { color: "blue" } },
      descendants: { label: { text: "Cancel" } },
    } as never);

    useStore.setState({
      elements: [master, child, ref],
      selectedElementId: "ref",
      elementsMap: new Map([
        ["master", master],
        ["label", child],
        ["ref", ref],
      ]),
    } as never);
    useStore.getState()._rebuildIndexes();
    seedCanonicalFromStore();

    const result = useStore.getState().detachInstance("ref");
    const detachedRoot = useStore.getState().elementsMap.get("ref") as
      (Element & { ref?: string; reusable?: boolean }) | undefined;
    const materializedChildren = useStore
      .getState()
      .elements.filter((element) => element.parent_id === "ref");

    expect(result?.previousState).toMatchObject({ type: "ref" });
    expect(detachedRoot).toMatchObject({
      id: "ref",
      type: "Button",
      props: { label: "Instance", style: { color: "blue", padding: "8px" } },
    });
    expect(detachedRoot?.reusable).toBeUndefined();
    expect(detachedRoot?.ref).toBeUndefined();
    expect(materializedChildren).toHaveLength(1);
    expect(materializedChildren[0]).toMatchObject({
      type: "Text",
      props: { text: "Cancel" },
    });
    expect(useStore.getState().selectedElementProps.label).toBe("Instance");
    expect(addEntrySpy).toHaveBeenCalledWith(
      expect.objectContaining({
        type: "batch",
        elementId: "ref",
        data: expect.objectContaining({
          canonicalEvents: expect.arrayContaining([
            expect.objectContaining({ type: "remove" }),
            expect.objectContaining({ type: "insert" }),
          ]),
        }),
      }),
    );

    await useStore.getState().undo();
    expect(useStore.getState().elementsMap.get("ref")).toMatchObject({
      type: "ref",
    });
    expect(
      useStore
        .getState()
        .elements.filter((element) => element.parent_id === "ref"),
    ).toHaveLength(0);

    await useStore.getState().redo();
    expect(useStore.getState().elementsMap.get("ref")).toMatchObject({
      type: "Button",
    });
    expect(
      useStore
        .getState()
        .elements.filter((element) => element.parent_id === "ref"),
    ).toHaveLength(1);
    logSpy.mockRestore();
  });

  it("materializes canonical descendants mode C children recursively", () => {
    const master = makeElement("layout", {
      type: "frame",
      reusable: true,
      props: { role: "layout" },
    });
    const slot = makeElement("main-slot", {
      type: "frame",
      parent_id: "layout",
      customId: "main-slot",
      props: { slot: true },
    });
    const ref = makeElement("page-ref", {
      type: "ref",
      ref: "layout",
      descendants: {
        "main-slot": {
          children: [
            {
              id: "card",
              type: "Card",
              props: { title: "Card title" },
              children: [
                {
                  id: "card-label",
                  type: "Text",
                  props: { text: "Nested label" },
                },
              ],
            },
          ],
        },
      },
    } as never);

    useStore.setState({
      elements: [master, slot, ref],
      elementsMap: new Map([
        ["layout", master],
        ["main-slot", slot],
        ["page-ref", ref],
      ]),
    } as never);
    useStore.getState()._rebuildIndexes();
    seedCanonicalFromStore();

    useStore.getState().detachInstance("page-ref");
    const detachedSlot = useStore
      .getState()
      .elements.find((element) => element.parent_id === "page-ref");
    const materializedCard = useStore
      .getState()
      .elements.find((element) => element.parent_id === detachedSlot?.id);
    const materializedLabel = useStore
      .getState()
      .elements.find((element) => element.parent_id === materializedCard?.id);

    expect(detachedSlot).toMatchObject({ type: "frame" });
    expect(materializedCard).toMatchObject({
      id: "card",
      type: "Card",
      props: { title: "Card title" },
    });
    expect(materializedLabel).toMatchObject({
      id: "card-label",
      type: "Text",
      props: { text: "Nested label" },
    });
  });

  it("materializes origin children by canonical source order, not stale order_num", () => {
    const master = makeElement("master", {
      type: "Card",
      reusable: true,
      props: { title: "Master" },
    });
    const first = makeElement("first", {
      type: "Heading",
      parent_id: master.id,
      order_num: 9,
      props: { label: "First in source" },
    });
    const second = makeElement("second", {
      type: "Text",
      parent_id: master.id,
      order_num: 0,
      props: { label: "Second in source" },
    });
    const ref = makeElement("ref", {
      type: "ref",
      ref: master.id,
      props: {},
    });

    useStore.setState({
      elements: [master, first, second, ref],
      elementsMap: new Map([
        [master.id, master],
        [first.id, first],
        [second.id, second],
        [ref.id, ref],
      ]),
    } as never);
    useStore.getState()._rebuildIndexes();
    seedCanonicalFromStore();

    useStore.getState().detachInstance(ref.id);

    expect(
      useStore
        .getState()
        .elements.filter((element) => element.parent_id === ref.id)
        .map((element) => element.props.label),
    ).toEqual(["First in source", "Second in source"]);
  });

  // ADR-150 detach 노드 필드 판독 LOW-1 — mode B 교체 노드는 origin 자식의 숨김 · fills 를 물려받지 않는다.
  it("does not inherit hidden origin child fields into a mode B replacement", () => {
    const els = [
      makeElement("m", { type: "Card", reusable: true, customId: "card_1" }),
      makeElement("hidden", {
        type: "Text",
        parent_id: "m",
        customId: "text_1",
        enabled: false,
        fills: [
          {
            id: "f",
            type: "color",
            color: "#00ff00",
            opacity: 1,
            enabled: true,
          },
        ],
      } as never),
      makeElement("inst", {
        type: "ref",
        ref: "m",
        customId: "card_2",
        descendants: {
          text_1: { id: "swap", type: "Button", props: { children: "Go" } },
        },
      } as never),
    ];
    useStore.setState({
      elements: els,
      elementsMap: new Map(els.map((e) => [e.id, e])),
    } as never);
    useStore.getState()._rebuildIndexes();
    seedCanonicalFromStore();

    const resolved = () => {
      const doc = useCanonicalDocumentStore
        .getState()
        .documents.get("instance-project")!;
      const inst = findCanonicalNodeById(
        resolveCanonicalDocument(doc) as CanonicalNode[],
        "inst",
      );
      return (inst?.children ?? []).map((child) => ({
        type: child.type,
        fills: (child as CanonicalNode & { fills?: unknown }).fills,
      }));
    };
    const before = resolved();
    expect(before).toEqual([{ type: "Button", fills: undefined }]);
    useStore.getState().detachInstance("inst");
    expect(resolved()).toEqual(before);
  });

  it("materializes canonical descendants mode B as subtree replacement", () => {
    const master = makeElement("master", { reusable: true });
    const child = makeElement("label", {
      type: "Text",
      parent_id: "master",
      customId: "label",
      props: { text: "Original" },
    });
    const grandchild = makeElement("icon", {
      type: "Icon",
      parent_id: "label",
      props: { name: "check" },
    });
    const ref = makeElement("ref", {
      type: "ref",
      ref: "master",
      descendants: {
        label: {
          id: "replacement",
          type: "Heading",
          props: { text: "Replacement" },
        },
      },
    } as never);

    useStore.setState({
      elements: [master, child, grandchild, ref],
      elementsMap: new Map([
        ["master", master],
        ["label", child],
        ["icon", grandchild],
        ["ref", ref],
      ]),
    } as never);
    useStore.getState()._rebuildIndexes();
    seedCanonicalFromStore();

    useStore.getState().detachInstance("ref");
    const materializedChildren = useStore
      .getState()
      .elements.filter((element) => element.parent_id === "ref");

    expect(materializedChildren).toHaveLength(1);
    expect(materializedChildren[0]).toMatchObject({
      id: "replacement",
      type: "Heading",
      props: { text: "Replacement" },
    });
    expect(
      useStore
        .getState()
        .elements.filter((element) => element.parent_id === "replacement"),
    ).toHaveLength(0);
  });

  it("materializes nested canonical refs recursively", () => {
    // master 는 자식을 가질 수 있는 타입이어야 한다 — `Icon` 은 Pen 스키마의 잎
    //   (`toPencilType` → icon_font) 이라 중첩 guard 가 자식을 걸러낸다 (2026-09-08).
    //   재귀 실체화라는 테스트 의도는 타입과 무관하므로 Badge 로 둔다.
    const iconMaster = makeElement("icon-master", {
      type: "Badge",
      reusable: true,
      props: { name: "default-icon" },
    });
    const iconLabel = makeElement("icon-label", {
      type: "Text",
      parent_id: "icon-master",
      customId: "label",
      props: { text: "Default label" },
    });
    const buttonMaster = makeElement("button-master", {
      type: "Button",
      reusable: true,
      props: { label: "Button" },
    });
    const nestedIconRef = makeElement("nested-icon-ref", {
      type: "ref",
      ref: "icon-master",
      parent_id: "button-master",
      props: { name: "override-icon" },
      descendants: { label: { text: "Nested label" } },
    } as never);
    const buttonRef = makeElement("button-ref", {
      type: "ref",
      ref: "button-master",
    } as never);

    useStore.setState({
      elements: [iconMaster, iconLabel, buttonMaster, nestedIconRef, buttonRef],
      elementsMap: new Map([
        ["icon-master", iconMaster],
        ["icon-label", iconLabel],
        ["button-master", buttonMaster],
        ["nested-icon-ref", nestedIconRef],
        ["button-ref", buttonRef],
      ]),
    } as never);
    useStore.getState()._rebuildIndexes();
    seedCanonicalFromStore();

    useStore.getState().detachInstance("button-ref");
    const materializedIcon = useStore
      .getState()
      .elements.find((element) => element.parent_id === "button-ref");
    const materializedLabel = useStore
      .getState()
      .elements.find((element) => element.parent_id === materializedIcon?.id);

    expect(materializedIcon).toMatchObject({
      type: "Badge",
      props: { name: "override-icon" },
    });
    expect(
      (materializedIcon as Element & { ref?: string })?.ref,
    ).toBeUndefined();
    expect(materializedLabel).toMatchObject({
      type: "Text",
      props: { text: "Nested label" },
    });
  });

  // ADR-150 LOW 재확인 (2026-09-27) — detach 경로는 편집기 segment 규칙 (형제 목록 · `~N`) 을 따른다.
  it("applies same-segment sibling overrides to their own sibling on detach", () => {
    const master = makeElement("tags", {
      type: "frame",
      reusable: true,
    });
    const first = makeElement("tag-a", {
      type: "Text",
      parent_id: "tags",
      componentName: "Tag",
      props: { text: "a" },
    });
    const second = makeElement("tag-b", {
      type: "Text",
      parent_id: "tags",
      componentName: "Tag",
      props: { text: "b" },
    });
    // 자기 override 가 없는 세 번째 형제 — componentName 대체 조회로 첫 형제 patch 를 받으면 안 된다.
    const third = makeElement("tag-c", {
      type: "Text",
      parent_id: "tags",
      componentName: "Tag",
      props: { text: "c" },
    });
    const ref = makeElement("ref", {
      type: "ref",
      ref: "tags",
      descendants: {
        Tag: { text: "first" },
        "Tag~2": { text: "second" },
      },
    } as never);

    useStore.setState({
      elements: [master, first, second, third, ref],
      elementsMap: new Map([
        ["tags", master],
        ["tag-a", first],
        ["tag-b", second],
        ["tag-c", third],
        ["ref", ref],
      ]),
    } as never);
    useStore.getState()._rebuildIndexes();
    seedCanonicalFromStore();

    useStore.getState().detachInstance("ref");

    expect(
      useStore
        .getState()
        .elements.filter((element) => element.parent_id === "ref")
        .map((element) => element.props.text),
    ).toEqual(["first", "second", "c"]);
  });

  // ADR-150 detach 후보 (2026-09-27) — 중첩 ref 자식의 descendants 는 Preview 해석기 (`resolveNestedRefChild`) 와
  //   같이 ref 자신의 map 위에 바깥 instance 의 `<ref segment>/…` 키를 좁혀 얹는다. 바깥 root 키는 새어 들지 않는다.
  it.each([
    [
      "바깥 깊은 키 badge_2/Label 을 중첩 자식에 적용",
      { "badge_2/Label": { text: "deep" } },
      ["card-origin", "deep"],
    ],
    [
      "바깥 root 키 Label 은 중첩 ref 자식에 새지 않음",
      { Label: { text: "top" } },
      ["top", "badge-origin"],
    ],
    [
      "ref 자신의 override 위에 바깥 깊은 키를 합침",
      { "badge_2/Label": { style: { color: "red" } } },
      ["card-origin", "badge-own"],
    ],
  ])("detach nested ref descendants — %s", (_name, descendants, texts) => {
    const withOwn = Boolean(
      (descendants as Record<string, { style?: unknown } | undefined>)[
        "badge_2/Label"
      ]?.style,
    );
    const els = [
      makeElement("badge-master", {
        type: "Badge",
        reusable: true,
        customId: "badge_1",
      }),
      makeElement("badge-label", {
        type: "Text",
        parent_id: "badge-master",
        componentName: "Label",
        props: { text: "badge-origin" },
      }),
      makeElement("card-master", {
        type: "Card",
        reusable: true,
        customId: "card_1",
      }),
      makeElement("card-label", {
        type: "Text",
        parent_id: "card-master",
        componentName: "Label",
        props: { text: "card-origin" },
      }),
      makeElement("badge-ref", {
        type: "ref",
        ref: "badge-master",
        parent_id: "card-master",
        customId: "badge_2",
        ...(withOwn ? { descendants: { Label: { text: "badge-own" } } } : {}),
      } as never),
      makeElement("card-ref", {
        type: "ref",
        ref: "card-master",
        customId: "card_2",
        descendants,
      } as never),
    ];
    useStore.setState({
      elements: els,
      elementsMap: new Map(els.map((e) => [e.id, e])),
    } as never);
    useStore.getState()._rebuildIndexes();
    seedCanonicalFromStore();

    useStore.getState().detachInstance("card-ref");

    const elements = useStore.getState().elements;
    const detachedTexts: Element[] = [];
    const visit = (parentId: string) =>
      elements
        .filter((element) => element.parent_id === parentId)
        .forEach((element) => {
          if (element.type === "Text") detachedTexts.push(element);
          visit(element.id);
        });
    visit("card-ref");
    expect(detachedTexts.map((element) => element.props.text)).toEqual(texts);
    if (withOwn) {
      expect(detachedTexts[1]?.props.style).toEqual({ color: "red" });
    }
  });

  // ADR-150 detach 공백 (2026-09-27) — 영역 채움 (mode C) 항목의 host 편집 (`{ children, style }`) 도 적용한다
  //   (Preview `applyOverrideToNode` mode C host patch · ADR-240 P2).
  it("applies the host patch of a mode C region fill on detach", () => {
    const els = [
      makeElement("m", { type: "Card", reusable: true, customId: "card_1" }),
      makeElement("region", {
        type: "frame",
        parent_id: "m",
        customId: "region_1",
        props: { style: { padding: 4 } },
      }),
      makeElement("inst", {
        type: "ref",
        ref: "m",
        customId: "card_2",
        descendants: {
          region_1: {
            children: [{ id: "fill", type: "Text", props: { text: "fill" } }],
            style: { color: "red" },
          },
        },
      } as never),
    ];
    useStore.setState({
      elements: els,
      elementsMap: new Map(els.map((e) => [e.id, e])),
    } as never);
    useStore.getState()._rebuildIndexes();
    seedCanonicalFromStore();

    useStore.getState().detachInstance("inst");

    const elements = useStore.getState().elements;
    const region = elements.find((element) => element.parent_id === "inst");
    expect(region?.props.style).toEqual({ padding: 4, color: "red" });
    expect(
      elements
        .filter((element) => element.parent_id === region?.id)
        .map((element) => element.props.text),
    ).toEqual(["fill"]);
  });

  // ADR-150 detach 공백 (2026-09-27) — origin 안 중첩 ref 의 자기 자식 (TableView Row ref 의 Cell) 도 실체화한다.
  //   순서는 master 자식 뒤, patch 는 바깥 instance 의 `<ref>/<자기 자식>` 키 (Preview `resolvedInstanceChildren`).
  it("materializes a nested ref's own children after its master children", () => {
    const els = [
      makeElement("row-m", { type: "Row", reusable: true, customId: "row_1" }),
      makeElement("row-m-cell", {
        type: "Cell",
        parent_id: "row-m",
        componentName: "Base",
        props: { text: "master cell" },
      }),
      makeElement("t-m", {
        type: "Table",
        reusable: true,
        customId: "table_1",
      }),
      makeElement("row-ref", {
        type: "ref",
        ref: "row-m",
        parent_id: "t-m",
        customId: "row_2",
        // `cell_1` 은 ref 자신의 map — master 자식 몫이라 자기 자식 Cell 에는 적용되지 않는다 (Preview 와 같음).
        descendants: {
          Base: { text: "ref-own patch" },
          cell_1: { text: "leak" },
        },
      } as never),
      makeElement("cell-a", {
        type: "Cell",
        parent_id: "row-ref",
        customId: "cell_1",
        props: { text: "a" },
      }),
      makeElement("cell-b", {
        type: "Cell",
        parent_id: "row-ref",
        customId: "cell_2",
        props: { text: "b" },
      }),
      makeElement("inst", {
        type: "ref",
        ref: "t-m",
        customId: "table_2",
        descendants: { "row_2/cell_2": { text: "B" } },
      } as never),
    ];
    useStore.setState({
      elements: els,
      elementsMap: new Map(els.map((e) => [e.id, e])),
    } as never);
    useStore.getState()._rebuildIndexes();
    seedCanonicalFromStore();

    useStore.getState().detachInstance("inst");

    const elements = useStore.getState().elements;
    const row = elements.find((element) => element.parent_id === "inst");
    expect(row?.type).toBe("Row");
    expect(
      elements
        .filter((element) => element.parent_id === row?.id)
        .map((element) => element.props.text),
    ).toEqual(["ref-own patch", "a", "B"]);
  });

  // ADR-150 detach 노드 필드 (2026-09-27) — descendants patch 의 노드 필드 (fills · enabled · sizing · responsive) 와
  //   문자열 children (Text 본문) 을 Canvas · Preview 와 같이 적용한다. 기준 = detach 전 Preview 해석 결과와 detach
  //   뒤 문서 재해석 결과가 같다.
  const FILL = [
    { id: "f", type: "color", color: "#ff0000", opacity: 1, enabled: true },
  ];
  it.each([
    ["fills", { fills: FILL }],
    ["enabled false", { enabled: false }],
    ["sizing", { sizing: { width: "fill" } }],
    ["responsive", { responsive: { styles: { mobile: { color: "red" } } } }],
    ["string children", { children: "edited body" }],
  ])("detach keeps descendant node-field patch — %s", (_name, patch) => {
    const els = [
      makeElement("m", { type: "Card", reusable: true, customId: "card_1" }),
      makeElement("a", {
        type: "Text",
        parent_id: "m",
        customId: "text_a",
        props: { children: "origin body" },
      }),
      makeElement("b", {
        type: "Text",
        parent_id: "m",
        customId: "text_b",
        props: { children: "b" },
      }),
      makeElement("inst", {
        type: "ref",
        ref: "m",
        customId: "card_2",
        descendants: { text_a: patch },
      } as never),
    ];
    useStore.setState({
      elements: els,
      elementsMap: new Map(els.map((e) => [e.id, e])),
    } as never);
    useStore.getState()._rebuildIndexes();
    seedCanonicalFromStore();

    const resolvedChildren = () => {
      const doc = useCanonicalDocumentStore
        .getState()
        .documents.get("instance-project")!;
      const inst = findCanonicalNodeById(
        resolveCanonicalDocument(doc) as CanonicalNode[],
        "inst",
      );
      return (inst?.children ?? []).map((child) => {
        const node = child as CanonicalNode & Record<string, unknown>;
        return {
          type: node.type,
          children: node.props?.children,
          fills: node.fills,
          sizing: node.sizing,
          responsive: node.responsive,
        };
      });
    };
    const before = resolvedChildren();
    useStore.getState().detachInstance("inst");
    expect(resolvedChildren()).toEqual(before);
  });

  // ADR-150 detach 관찰 1 · 2 (2026-09-27) — 변형 (origin 의 reusable ref, ADR-234) 을 가리키는 instance 는 체인
  //   끝 origin 으로 실체화하고 변형의 root props · descendants 를 instance 값 아래에 깐다 (root · 중첩 ref 둘 다).
  //   root 의 sizing · responsive 는 축 · tier 단위로 합친다. 기준 = detach 전 Preview 해석 == detach 뒤 재해석.
  const resolvedSnapshot = () => {
    const doc = useCanonicalDocumentStore
      .getState()
      .documents.get("instance-project")!;
    const shape = (node: CanonicalNode & Record<string, unknown>): unknown => ({
      type: node.type,
      // `_stateLayers` 같은 해석기 메타는 instance 에만 붙는다 (사본은 상태 전환을 갖지 않는다)
      props: Object.fromEntries(
        Object.entries(node.props ?? {}).filter(([key]) => !key.startsWith("_")),
      ),
      sizing: node.sizing,
      responsive: node.responsive,
      children: ((node.children ?? []) as never[]).map(shape),
    });
    return shape(
      findCanonicalNodeById(
        resolveCanonicalDocument(doc) as CanonicalNode[],
        "inst",
      ) as CanonicalNode & Record<string, unknown>,
    );
  };
  const seedElements = (els: Element[]) => {
    useStore.setState({
      elements: els,
      elementsMap: new Map(els.map((e) => [e.id, e])),
    } as never);
    useStore.getState()._rebuildIndexes();
    seedCanonicalFromStore();
  };
  const variantOrigin = (): Element[] => [
    makeElement("btn", {
      type: "Card",
      reusable: true,
      customId: "card_1",
      props: { tone: "base" },
    }),
    makeElement("btn-label", {
      type: "Text",
      parent_id: "btn",
      customId: "text_1",
      props: { children: "Go" },
    }),
    makeElement("btn--hover", {
      type: "ref",
      ref: "btn",
      reusable: true,
      customId: "card_hover",
      props: { tone: "hover" },
      descendants: { text_1: { children: "Hover" } },
    } as never),
  ];

  it("detaches an instance of a variant through the chain to its origin", () => {
    seedElements([
      ...variantOrigin(),
      makeElement("inst", {
        type: "ref",
        ref: "btn--hover",
        customId: "card_2",
      } as never),
    ]);
    const before = resolvedSnapshot();

    useStore.getState().detachInstance("inst");

    const root = useStore
      .getState()
      .elements.find((element) => element.id === "inst")!;
    expect(root.type).toBe("Card");
    expect((root as { ref?: string }).ref).toBeUndefined();
    expect(root.props.tone).toBe("hover");
    expect(resolvedSnapshot()).toEqual(before);
  });

  it("detaches a nested ref that points at a variant", () => {
    seedElements([
      ...variantOrigin(),
      makeElement("bar", { type: "frame", reusable: true, customId: "bar_1" }),
      makeElement("bar-item", {
        type: "ref",
        ref: "btn--hover",
        parent_id: "bar",
        customId: "card_3",
      } as never),
      makeElement("inst", {
        type: "ref",
        ref: "bar",
        customId: "bar_2",
      } as never),
    ]);
    const before = resolvedSnapshot();

    useStore.getState().detachInstance("inst");

    const elements = useStore.getState().elements;
    const item = elements.find((element) => element.parent_id === "inst")!;
    expect(item.type).toBe("Card");
    expect(
      elements.find((element) => element.parent_id === item.id)?.props.children,
    ).toBe("Hover");
    expect(resolvedSnapshot()).toEqual(before);
  });

  it("merges root sizing · responsive per axis and tier on detach", () => {
    seedElements([
      makeElement("m", {
        type: "Card",
        reusable: true,
        customId: "card_1",
        sizing: { width: "fill" },
        responsive: {
          styles: { mobile: { fontSize: 12 } },
          sizing: { mobile: { width: "fill" } },
        },
      } as never),
      makeElement("inst", {
        type: "ref",
        ref: "m",
        customId: "card_2",
        sizing: { height: "fill" },
        responsive: { styles: { mobile: { color: "red" } } },
      } as never),
    ]);
    const before = resolvedSnapshot();

    useStore.getState().detachInstance("inst");

    expect(before).toMatchObject({
      sizing: { width: "fill", height: "fill" },
    });
    expect(resolvedSnapshot()).toEqual(before);
  });

  // ADR-150 detach 템플릿 (2026-09-27) — origin propsSchema 템플릿 (`{label}`) 은 detach 시점 instance 값으로
  //   굳힌다 (Preview `substituteTemplateBindingsInChildren` 결과와 같게 — instance 가 사라지면 값 출처가 없다).
  //   중첩 ref 아래는 그 ref 의 값으로.
  it("substitutes template bindings into detached copies per ref level", () => {
    const schema = {
      label: { kind: "string", default: "Item" },
    };
    const els = [
      makeElement("item-m", {
        type: "Badge",
        reusable: true,
        customId: "item_1",
        props: { label: "origin label" },
      }),
      makeElement("item-text", {
        type: "Text",
        parent_id: "item-m",
        customId: "text_1",
        props: { children: "{label}" },
      }),
      makeElement("list-m", {
        type: "Card",
        reusable: true,
        customId: "list_1",
        props: { title: "origin title" },
      }),
      makeElement("list-title", {
        type: "Text",
        parent_id: "list-m",
        customId: "text_2",
        props: { children: "Title: {title}" },
      }),
      makeElement("item-ref", {
        type: "ref",
        ref: "item-m",
        parent_id: "list-m",
        customId: "item_2",
        props: { label: "first item" },
      } as never),
      makeElement("inst", {
        type: "ref",
        ref: "list-m",
        customId: "list_2",
        props: { title: "My list" },
      } as never),
    ];
    useStore.setState({
      elements: els,
      elementsMap: new Map(els.map((e) => [e.id, e])),
    } as never);
    useStore.getState()._rebuildIndexes();
    seedCanonicalFromStore();

    // propsSchema 는 canonical origin 의 metadata 에 산다 (seed 경로와 같게 문서에 직접 싣는다).
    const seeded = useCanonicalDocumentStore
      .getState()
      .documents.get("instance-project")!;
    for (const [id, propsSchema] of [
      ["item-m", schema],
      ["list-m", { title: { kind: "string" } }],
    ] as const) {
      const node = findCanonicalNodeById(seeded.children, id)!;
      node.metadata = {
        type: "legacy-element-props",
        ...(node.metadata ?? {}),
        propsSchema,
      };
    }

    const texts = () => {
      const doc = useCanonicalDocumentStore
        .getState()
        .documents.get("instance-project")!;
      const out: unknown[] = [];
      const walk = (node: CanonicalNode) => {
        if (node.type === "Text") out.push(node.props?.children);
        (node.children ?? []).forEach(walk);
      };
      const inst = findCanonicalNodeById(
        resolveCanonicalDocument(doc) as CanonicalNode[],
        "inst",
      );
      (inst?.children ?? []).forEach(walk);
      return out;
    };
    const before = texts();
    expect(before).toEqual(["Title: My list", "first item"]);
    useStore.getState().detachInstance("inst");
    expect(texts()).toEqual(before);
  });

  // ADR-150 LOW 재확인 (2026-09-27) — detach 사본은 origin 과 형제 사본의 customId 를 그대로 가져가지 않는다.
  it("issues fresh unique customIds to detached children", () => {
    const badgeMaster = makeElement("badge-master", {
      type: "Badge",
      reusable: true,
      customId: "badge_1",
    });
    const cardMaster = makeElement("card-master", {
      type: "Card",
      reusable: true,
      customId: "card_1",
    });
    const heading = makeElement("heading", {
      type: "Heading",
      parent_id: "card-master",
      customId: "heading_1",
    });
    const badgeA = makeElement("badge-a", {
      type: "ref",
      ref: "badge-master",
      parent_id: "card-master",
      customId: "badge_2",
    } as never);
    const badgeB = makeElement("badge-b", {
      type: "ref",
      ref: "badge-master",
      parent_id: "card-master",
      customId: "badge_3",
    } as never);
    const ref = makeElement("card-ref", {
      type: "ref",
      ref: "card-master",
      customId: "card_2",
    } as never);

    useStore.setState({
      elements: [badgeMaster, cardMaster, heading, badgeA, badgeB, ref],
      elementsMap: new Map(
        [badgeMaster, cardMaster, heading, badgeA, badgeB, ref].map((e) => [
          e.id,
          e,
        ]),
      ),
    } as never);
    useStore.getState()._rebuildIndexes();
    seedCanonicalFromStore();

    useStore.getState().detachInstance("card-ref");

    const customIds = useStore
      .getState()
      .elements.map((element) => element.customId)
      .filter((customId): customId is string => Boolean(customId));
    expect(new Set(customIds).size).toBe(customIds.length);
    const detached = useStore
      .getState()
      .elements.filter((element) => element.parent_id === "card-ref");
    expect(detached.map((element) => element.type)).toEqual([
      "Heading",
      "Badge",
      "Badge",
    ]);
    expect(detached.map((element) => element.customId)).toEqual([
      "heading_2",
      "badge_4",
      "badge_5",
    ]);
  });

  it("creates a component origin from a standard element with undo", async () => {
    const button = makeElement("button", {
      customId: "primary-action",
      page_id: "page-1",
    });

    useStore.setState({
      currentPageId: "page-1",
      elements: [button],
      elementsMap: new Map([["button", button]]),
    } as never);
    useStore.getState()._rebuildIndexes();
    seedCanonicalFromStore();

    const result = await useStore.getState().toggleComponentOrigin("button");

    // canonical 시드 후 source 는 canonical-derived 형태 — 핵심 필드만 비교
    expect(result?.previousElements).toMatchObject([
      { id: "button", customId: "primary-action" },
    ]);
    expect(useStore.getState().elementsMap.get("button")).toMatchObject({
      componentName: "primary-action",
      reusable: true,
    });
    expect(addEntrySpy).toHaveBeenCalledWith(
      expect.objectContaining({
        type: "batch",
        elementId: "button",
      }),
    );

    await useStore.getState().undo();
    expect(
      // `reusable` 은 canonical 전용 필드(Element 타입 미선언) — runtime element 에서
      // accessor cast 로 읽는다. undo 후 instance→일반 element 복귀를 검증.
      (
        useStore.getState().elementsMap.get("button") as
          { reusable?: boolean } | undefined
      )?.reusable,
    ).toBeUndefined();
  });

  it("syncs a created component origin into the active canonical document for refresh", async () => {
    const button = makeElement("button", {
      customId: "primary-action",
      page_id: "page-1",
      props: { children: "Click" },
    });
    const page = {
      id: "page-1",
      title: "Home",
      project_id: "project-1",
      slug: "/",
      order_num: 0,
    } as Page;
    const doc = {
      version: "composition-1.0",
      children: [
        {
          id: "page-1",
          type: "frame",
          metadata: { type: "legacy-page", pageId: "page-1" },
          children: [
            {
              id: "button",
              type: "Button",
              props: { children: "Click" },
              metadata: {
                type: "legacy-element-props",
                customId: "primary-action",
                legacyProps: {
                  id: "button",
                  page_id: "page-1",
                  type: "Button",
                  order_num: 0,
                },
              },
            },
          ],
        },
      ],
    } satisfies CompositionDocument;

    useStore.setState({
      currentPageId: "page-1",
      elements: [button],
      elementsMap: new Map([["button", button]]),
      pages: [page],
    } as never);
    useStore.getState()._rebuildIndexes();
    useCanonicalDocumentStore.getState().setCurrentProject("project-1");
    useCanonicalDocumentStore.getState().setDocument("project-1", doc);
    registerCanonicalMutationStoreActions({
      getCurrentLegacySnapshot: () => ({
        elements: useStore.getState().elements,
        pages: [page],
        layouts: [],
      }),
      getCurrentProjectId: () => "project-1",
    });

    await useStore.getState().toggleComponentOrigin("button");

    const nextDoc = useCanonicalDocumentStore
      .getState()
      .getDocument("project-1");
    const pageNode = nextDoc?.children.find((node) => node.id === "page-1");
    expect(pageNode?.children).toEqual([
      expect.objectContaining({
        id: "button",
        reusable: true,
        metadata: expect.objectContaining({
          legacyProps: expect.objectContaining({
            page_id: "page-1",
          }),
        }),
      }),
    ]);
  });

  it("removes component origin silently when no instances exist", async () => {
    const confirmSpy = vi.spyOn(window, "confirm").mockReturnValue(true);
    const origin = makeElement("origin", {
      componentName: "CTA",
      reusable: true,
    });

    useStore.setState({
      elements: [origin],
      elementsMap: new Map([["origin", origin]]),
    } as never);
    useStore.getState()._rebuildIndexes();
    seedCanonicalFromStore();

    await useStore.getState().toggleComponentOrigin("origin");

    const updatedOrigin = useStore.getState().elementsMap.get("origin") as
      (Element & { reusable?: boolean }) | undefined;
    expect(updatedOrigin).toMatchObject({ componentName: "CTA" });
    expect(updatedOrigin?.reusable).toBeFalsy();
    expect(confirmSpy).not.toHaveBeenCalled();
  });

  it("removes component origin and materializes impacted instances with single undo", async () => {
    const confirmSpy = vi.spyOn(window, "confirm").mockReturnValue(true);
    const origin = makeElement("origin", {
      reusable: true,
      props: { label: "Origin", style: { padding: "8px" } },
    });
    const child = makeElement("label", {
      type: "Text",
      parent_id: "origin",
      customId: "label",
      props: { text: "Default" },
    });
    const instance = makeElement("instance", {
      type: "ref",
      ref: "origin",
      props: { label: "Instance" },
      descendants: { label: { text: "Custom" } },
    } as never);

    useStore.setState({
      currentPageId: "page-1",
      elements: [origin, child, instance],
      elementsMap: new Map([
        ["origin", origin],
        ["label", child],
        ["instance", instance],
      ]),
    } as never);
    useStore.getState()._rebuildIndexes();
    seedCanonicalFromStore();

    await useStore.getState().toggleComponentOrigin("origin");
    const detachedInstance = useStore.getState().elementsMap.get("instance") as
      (Element & { ref?: string }) | undefined;
    const materializedChild = useStore
      .getState()
      .elements.find((element) => element.parent_id === "instance");

    expect(confirmSpy).toHaveBeenCalled();
    // canonical-derived element 는 reusable=false 시 키 자체를 생략 — falsy 검사
    expect(
      (
        useStore.getState().elementsMap.get("origin") as
          { reusable?: boolean } | undefined
      )?.reusable,
    ).toBeFalsy();
    expect(detachedInstance).toMatchObject({
      id: "instance",
      type: "Button",
      props: { label: "Instance", style: { padding: "8px" } },
    });
    expect(detachedInstance?.ref).toBeUndefined();
    expect(materializedChild).toMatchObject({
      type: "Text",
      props: { text: "Custom" },
    });

    await useStore.getState().undo();
    expect(useStore.getState().elementsMap.get("origin")).toMatchObject({
      reusable: true,
    });
    expect(useStore.getState().elementsMap.get("instance")).toMatchObject({
      type: "ref",
      ref: "origin",
    });
    expect(
      useStore
        .getState()
        .elements.filter((element) => element.parent_id === "instance"),
    ).toHaveLength(0);
  });

  // ADR-150 LOW 재확인 (2026-09-27) — 한 batch 로 detach 되는 instance 들도 서로 customId 가 겹치지 않는다.
  it("issues distinct customIds across instances auto-detached in one batch", async () => {
    const origin = makeElement("origin", {
      reusable: true,
      customId: "button_1",
    });
    const child = makeElement("label", {
      type: "Text",
      parent_id: "origin",
      customId: "text_1",
    });
    const first = makeElement("instance-1", {
      type: "ref",
      ref: "origin",
      customId: "button_2",
    } as never);
    const second = makeElement("instance-2", {
      type: "ref",
      ref: "origin",
      customId: "button_3",
    } as never);

    useStore.setState({
      currentPageId: "page-1",
      elements: [origin, child, first, second],
      elementsMap: new Map(
        [origin, child, first, second].map((e) => [e.id, e]),
      ),
    } as never);
    useStore.getState()._rebuildIndexes();
    seedCanonicalFromStore();

    await useStore.getState().removeElement("origin");

    const textIds = useStore
      .getState()
      .elements.filter((element) => element.type === "Text")
      .map((element) => element.customId);
    expect(textIds).toHaveLength(2);
    expect(new Set(textIds).size).toBe(2);
  });

  it("auto-detaches canonical instances when deleting their origin", async () => {
    const origin = makeElement("origin", {
      reusable: true,
      props: { label: "Origin", style: { padding: "8px" } },
    });
    const child = makeElement("label", {
      type: "Text",
      parent_id: "origin",
      customId: "label",
      props: { text: "Default" },
    });
    const instance = makeElement("instance", {
      type: "ref",
      ref: "origin",
      props: { label: "Instance" },
      descendants: { label: { text: "Custom" } },
    } as never);

    useStore.setState({
      currentPageId: "page-1",
      elements: [origin, child, instance],
      elementsMap: new Map([
        ["origin", origin],
        ["label", child],
        ["instance", instance],
      ]),
    } as never);
    useStore.getState()._rebuildIndexes();
    seedCanonicalFromStore();

    await useStore.getState().removeElement("origin");

    const detachedInstance = useStore.getState().elementsMap.get("instance") as
      (Element & { ref?: string }) | undefined;
    const materializedChild = useStore
      .getState()
      .elements.find((element) => element.parent_id === "instance");

    expect(useStore.getState().elementsMap.has("origin")).toBe(false);
    expect(useStore.getState().elementsMap.has("label")).toBe(false);
    expect(detachedInstance).toMatchObject({
      id: "instance",
      type: "Button",
      props: { label: "Instance", style: { padding: "8px" } },
    });
    expect(detachedInstance?.ref).toBeUndefined();
    expect(materializedChild).toMatchObject({
      type: "Text",
      props: { text: "Custom" },
    });

    await useStore.getState().undo();
    expect(useStore.getState().elementsMap.get("origin")).toMatchObject({
      reusable: true,
    });
    expect(useStore.getState().elementsMap.get("instance")).toMatchObject({
      type: "ref",
      ref: "origin",
    });
  });

  it("removes component origin across 1000 canonical instances", async () => {
    const confirmSpy = vi.spyOn(window, "confirm").mockReturnValue(true);
    confirmSpy.mockClear();
    const origin = makeElement("origin", {
      reusable: true,
      props: { label: "Origin" },
    });
    const instances = Array.from({ length: 1000 }, (_, index) =>
      makeElement(`instance-${index}`, {
        type: "ref",
        ref: "origin",
        props: { label: `Instance ${index}` },
      } as never),
    );

    useStore.setState({
      currentPageId: "page-1",
      elements: [origin, ...instances],
      elementsMap: new Map(
        [origin, ...instances].map((element) => [element.id, element]),
      ),
    } as never);
    useStore.getState()._rebuildIndexes();
    seedCanonicalFromStore();

    const result = await useStore.getState().toggleComponentOrigin("origin");

    expect(confirmSpy).toHaveBeenCalledTimes(1);
    expect(result?.previousElements).toHaveLength(1001);
    expect(result?.elements).toHaveLength(1001);
    expect(
      (
        useStore.getState().elementsMap.get("origin") as
          (Element & { reusable?: boolean }) | undefined
      )?.reusable,
    ).toBeFalsy();
    expect(useStore.getState().elementsMap.get("instance-999")).toMatchObject({
      type: "Button",
      props: { label: "Instance 999" },
    });
    expect(
      (
        useStore.getState().elementsMap.get("instance-999") as Element & {
          ref?: string;
        }
      )?.ref,
    ).toBeUndefined();
  });

  it("falls back to the impact dialog path when T1 finds a new instance", async () => {
    const confirmSpy = vi.spyOn(window, "confirm").mockReturnValue(true);
    confirmSpy.mockClear();
    const origin = makeElement("origin", {
      reusable: true,
      props: { label: "Origin" },
    });

    useStore.setState({
      elements: [origin],
      elementsMap: new Map([["origin", origin]]),
    } as never);
    useStore.getState()._rebuildIndexes();
    seedCanonicalFromStore();

    await useStore.getState().toggleComponentOrigin("origin", {
      beforeMutation: () => {
        const raceInstance = makeElement("race-instance", {
          type: "ref",
          ref: "origin",
        } as never);
        useStore.setState({
          elements: [...useStore.getState().elements, raceInstance],
          elementsMap: new Map(useStore.getState().elementsMap).set(
            "race-instance",
            raceInstance,
          ),
        } as never);
        mergeElementsCanonicalPrimary([raceInstance]);
        useStore.getState()._rebuildIndexes();
      },
    });

    expect(confirmSpy).toHaveBeenCalledTimes(1);
    const raceInstance = useStore
      .getState()
      .elementsMap.get("race-instance") as
      (Element & { ref?: string }) | undefined;
    expect(raceInstance).toMatchObject({ type: "Button" });
    expect(raceInstance?.ref).toBeUndefined();
  });

  it("waits for the impact dialog confirmation when TOCTOU changes instance count", async () => {
    const origin = makeElement("origin", {
      reusable: true,
      props: { label: "Origin" },
    });

    useStore.setState({
      elements: [origin],
      elementsMap: new Map([["origin", origin]]),
    } as never);
    useStore.getState()._rebuildIndexes();
    seedCanonicalFromStore();

    // subscribe listener 는 union(Impact | Detach)을 emit → 배열도 union 으로.
    // (impact-specific 필드 단언은 toMatchObject 런타임 구조 검사로 수행)
    const requests: EditingSemanticsConfirmationRequest[] = [];
    const unsubscribe = subscribeEditingSemanticsImpactConfirmation(
      (request) => {
        if (request) {
          requests.push(request);
        }
      },
    );

    try {
      const togglePromise = useStore
        .getState()
        .toggleComponentOrigin("origin", {
          beforeMutation: () => {
            const raceInstance = makeElement("race-instance", {
              type: "ref",
              ref: "origin",
            } as never);
            useStore.setState({
              elements: [...useStore.getState().elements, raceInstance],
              elementsMap: new Map(useStore.getState().elementsMap).set(
                "race-instance",
                raceInstance,
              ),
            } as never);
            mergeElementsCanonicalPrimary([raceInstance]);
            useStore.getState()._rebuildIndexes();
          },
        });

      await vi.waitFor(() => {
        expect(requests).toHaveLength(1);
      });

      expect(requests[0]).toMatchObject({
        impactedInstanceIds: ["race-instance"],
        instanceCount: 1,
        originId: "origin",
        originLabel: "Button component",
      });
      expect(useStore.getState().elementsMap.get("origin")).toMatchObject({
        reusable: true,
      });

      resolveEditingSemanticsImpactConfirmation(true);
      await togglePromise;

      const raceInstance = useStore
        .getState()
        .elementsMap.get("race-instance") as
        (Element & { ref?: string }) | undefined;
      expect(
        (
          useStore.getState().elementsMap.get("origin") as
            (Element & { reusable?: boolean }) | undefined
        )?.reusable,
      ).toBeFalsy();
      expect(raceInstance).toMatchObject({ type: "Button" });
      expect(raceInstance?.ref).toBeUndefined();
    } finally {
      unsubscribe();
      resolveEditingSemanticsImpactConfirmation(false);
    }
  });
});
