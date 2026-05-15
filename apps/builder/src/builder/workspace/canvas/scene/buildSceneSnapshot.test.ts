// @vitest-environment node
import { describe, expect, it } from "vitest";
import {
  withFrameElementMirrorId,
  withPageFrameBinding,
} from "../../../../adapters/canonical/frameMirror";
import type { Page } from "../../../../types/core/store.types";
import { rebuildPageIndex } from "../../../stores/utils/elementIndexer";
import type { CanvasSceneNode } from "./canvasSceneNode";
import { buildSceneStructureSnapshot } from "./buildSceneSnapshot";

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
    layoutId: partial.layoutId ?? partial.layout_id ?? null,
    layout_id: partial.layout_id ?? partial.layoutId ?? null,
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

    expect(baseSlot?.projection?.kind).toBe("page-frame-element");
    expect(baseSlot?.projection?.slotName).toBe("content");
    expect(changedSlot?.projection?.slotName).toBe("hero");
    expect(changedSnapshot.sceneVersion).not.toBe(baseSnapshot.sceneVersion);
  });
});
