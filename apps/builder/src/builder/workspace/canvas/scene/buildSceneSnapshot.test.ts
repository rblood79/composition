// @vitest-environment node
import { describe, expect, it } from "vitest";
import {
  withFrameElementMirrorId,
  withPageFrameBinding,
} from "../../../../adapters/canonical/frameMirror";
import type { Page } from "../../../../types/core/store.types";
import { rebuildPageIndex } from "../../../stores/utils/elementIndexer";
import type { CanvasSceneNode } from "./canvasSceneNode";
import {
  buildSceneStructureSnapshot,
  createResolvedProjectionSignature,
} from "./buildSceneSnapshot";
import { buildPageDataMap } from "./buildSceneIndex";

const makePage = (partial: Partial<Page> & { id: string }): Page => ({
  project_id: "project-1",
  slug: partial.id,
  title: "Page",
  ...partial,
});

const makeNode = (
  partial: Partial<CanvasSceneNode> & { id: string; type: string },
): CanvasSceneNode =>
  ({
    ...partial,
    id: partial.id,
    type: partial.type,
    parentId: partial.parentId ?? partial.parent_id ?? null,
    parent_id: partial.parent_id ?? partial.parentId ?? null,
    pageId: partial.pageId ?? partial.page_id ?? null,
    page_id: partial.page_id ?? partial.pageId ?? null,
    layoutId: partial.layoutId ?? null,
    props: partial.props ?? {},
    sourceNode: { id: partial.id, type: partial.type },
  }) as CanvasSceneNode;

const buildSnapshot = (
  elements: CanvasSceneNode[],
  pages: Page[] = [makePage({ id: "page-1" })],
) => {
  const elementsMap = new Map(elements.map((element) => [element.id, element]));
  const pageIndex = rebuildPageIndex(elements, elementsMap);
  return buildSceneStructureSnapshot({
    containerSize: { height: 900, width: 1200 },
    currentPageId: "page-1",
    elements,
    elementsMap,
    layoutVersion: 1,
    pageHeight: 600,
    pageIndex,
    pagePositions: { "page-1": { x: 0, y: 0 } },
    pagePositionsVersion: 1,
    pageWidth: 800,
    pages,
    panOffset: { x: 0, y: 0 },
    source: "canonical",
    zoom: 1,
  });
};

describe("ADR-136 buildSceneStructureSnapshot projection version", () => {
  it("changes sceneVersion when same-count resolved projection props change", () => {
    const baseElements = [
      makeNode({ id: "body-1", type: "Body", page_id: "page-1" }),
      makeNode({
        id: "text-1",
        type: "Text",
        page_id: "page-1",
        parent_id: "body-1",
        props: { text: "Alpha" },
      }),
    ];
    const changedElements = [
      makeNode({ id: "body-1", type: "Body", page_id: "page-1" }),
      makeNode({
        id: "text-1",
        type: "Text",
        page_id: "page-1",
        parent_id: "body-1",
        props: { text: "Beta" },
      }),
    ];

    expect(buildSnapshot(changedElements).sceneVersion).not.toBe(
      buildSnapshot(baseElements).sceneVersion,
    );
  });

  it("changes sceneVersion when same-count parent/ref projection inputs change", () => {
    const baseElements = [
      makeNode({ id: "body-1", type: "Body", page_id: "page-1" }),
      makeNode({
        id: "parent-a",
        type: "div",
        page_id: "page-1",
        parent_id: "body-1",
      }),
      makeNode({
        id: "parent-b",
        type: "div",
        page_id: "page-1",
        parent_id: "body-1",
      }),
      makeNode({
        id: "instance-1",
        type: "Button",
        page_id: "page-1",
        parent_id: "parent-a",
        ref: "master-a",
      }),
    ];
    const changedElements = [
      makeNode({ id: "body-1", type: "Body", page_id: "page-1" }),
      makeNode({
        id: "parent-a",
        type: "div",
        page_id: "page-1",
        parent_id: "body-1",
      }),
      makeNode({
        id: "parent-b",
        type: "div",
        page_id: "page-1",
        parent_id: "body-1",
      }),
      makeNode({
        id: "instance-1",
        type: "Button",
        page_id: "page-1",
        parent_id: "parent-b",
        ref: "master-b",
      }),
    ];

    expect(buildSnapshot(changedElements).sceneVersion).not.toBe(
      buildSnapshot(baseElements).sceneVersion,
    );
  });

  it("changes sceneVersion when resolvePageWithFrame projection metadata changes", () => {
    const page = withPageFrameBinding(makePage({ id: "page-1" }), "frame-1");
    const baseElements = [
      makeNode({ id: "page-body", type: "Body", page_id: "page-1" }),
      withFrameElementMirrorId(
        makeNode({ id: "frame-body", type: "Body" }),
        "frame-1",
      ),
      withFrameElementMirrorId(
        makeNode({
          id: "frame-slot",
          type: "Slot",
          parent_id: "frame-body",
          props: { name: "content" },
        }),
        "frame-1",
      ),
    ];
    const changedElements = [
      makeNode({ id: "page-body", type: "Body", page_id: "page-1" }),
      withFrameElementMirrorId(
        makeNode({ id: "frame-body", type: "Body" }),
        "frame-1",
      ),
      withFrameElementMirrorId(
        makeNode({
          id: "frame-slot",
          type: "Slot",
          parent_id: "frame-body",
          props: { name: "hero" },
        }),
        "frame-1",
      ),
    ];

    const baseSnapshot = buildSnapshot(baseElements, [page]);
    const changedSnapshot = buildSnapshot(changedElements, [page]);
    const baseSlot = baseSnapshot.pageSnapshots
      .get("page-1")
      ?.pageElements.find((element) => element.type === "Slot");
    const changedSlot = changedSnapshot.pageSnapshots
      .get("page-1")
      ?.pageElements.find((element) => element.type === "Slot");

    if (baseSlot?.projection?.kind !== "page-frame-element") {
      throw new Error("expected base slot page-frame projection");
    }
    if (changedSlot?.projection?.kind !== "page-frame-element") {
      throw new Error("expected changed slot page-frame projection");
    }
    expect(baseSlot.projection.slotName).toBe("content");
    expect(changedSlot.projection.slotName).toBe("hero");
    expect(changedSnapshot.sceneVersion).not.toBe(baseSnapshot.sceneVersion);
  });
});

describe("ADR-916 2-C 안 A — precomputedProjectionSignature 주입 정합성", () => {
  const setup = (
    elements: CanvasSceneNode[],
    pages: Page[] = [makePage({ id: "page-1" })],
  ) => {
    const elementsMap = new Map(
      elements.map((element) => [element.id, element]),
    );
    const pageIndex = rebuildPageIndex(elements, elementsMap);
    return { elementsMap, pageIndex, pages };
  };

  const baseInput = (
    elements: CanvasSceneNode[],
    ctx: ReturnType<typeof setup>,
  ) => ({
    containerSize: { height: 900, width: 1200 },
    currentPageId: "page-1",
    elements,
    elementsMap: ctx.elementsMap,
    layoutVersion: 1,
    pageHeight: 600,
    pageIndex: ctx.pageIndex,
    pagePositions: { "page-1": { x: 0, y: 0 } },
    pagePositionsVersion: 1,
    pageWidth: 800,
    pages: ctx.pages,
    panOffset: { x: 0, y: 0 },
    source: "canonical" as const,
    zoom: 1,
  });

  const sampleElements = () => [
    makeNode({ id: "body-1", type: "Body", page_id: "page-1" }),
    makeNode({
      id: "text-1",
      type: "Text",
      page_id: "page-1",
      parent_id: "body-1",
      props: { text: "Alpha" },
    }),
  ];

  it("주입 signature 로 계산한 sceneVersion == 내부 계산 sceneVersion", () => {
    const elements = sampleElements();
    const ctx = setup(elements);

    // 내부 계산 (미주입)
    const internal = buildSceneStructureSnapshot(baseInput(elements, ctx));

    // 호출측 pageDataMap → signature 를 미리 계산해 주입 (안 A 경로)
    const pageDataMap = buildPageDataMap(
      ctx.pages,
      ctx.pageIndex,
      ctx.elementsMap,
    );
    const precomputed = createResolvedProjectionSignature({
      elements,
      pageSnapshots: pageDataMap,
    });
    const injected = buildSceneStructureSnapshot({
      ...baseInput(elements, ctx),
      precomputedProjectionSignature: precomputed,
    });

    expect(injected.sceneVersion).toBe(internal.sceneVersion);
  });

  it("pan/zoom 만 바뀌면 signature 는 동일 (안 A 분리 근거)", () => {
    const elements = sampleElements();
    const ctx = setup(elements);
    const pageDataMap = buildPageDataMap(
      ctx.pages,
      ctx.pageIndex,
      ctx.elementsMap,
    );

    // 동일 elements/pageDataMap → pan/zoom 은 signature 입력이 아님
    const sigA = createResolvedProjectionSignature({
      elements,
      pageSnapshots: pageDataMap,
    });
    const sigB = createResolvedProjectionSignature({
      elements,
      pageSnapshots: pageDataMap,
    });
    expect(sigA).toBe(sigB);
  });

  it("잘못된 signature 주입 시 내부 계산과 다른 sceneVersion (주입이 실제 소비됨을 확증)", () => {
    const elements = sampleElements();
    const ctx = setup(elements);
    const internal = buildSceneStructureSnapshot(baseInput(elements, ctx));
    const wrong = buildSceneStructureSnapshot({
      ...baseInput(elements, ctx),
      precomputedProjectionSignature: 999999999,
    });
    expect(wrong.sceneVersion).not.toBe(internal.sceneVersion);
  });
});
