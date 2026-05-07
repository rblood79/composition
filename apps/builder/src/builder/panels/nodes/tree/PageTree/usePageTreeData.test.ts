import { describe, expect, it } from "vitest";
import type { CompositionDocument } from "@composition/shared";
import type { Page } from "../../../../../types/builder/unified.types";
import {
  applyPageTreeUpdates,
  buildPageTree,
  syncCanonicalPageTreeMetadata,
} from "./usePageTreeData";

function makePage(
  id: string,
  title: string,
  slug: string,
  orderNum: number,
  parentId: string | null = null,
): Page {
  return {
    id,
    title,
    slug,
    project_id: "project-1",
    parent_id: parentId,
    order_num: orderNum,
  } as Page;
}

describe("buildPageTree", () => {
  it("renders pages in ascending order_num while keeping Home first", () => {
    const { treeNodes } = buildPageTree([
      makePage("page-three", "Page 3", "/page-3", 2),
      makePage("page-home", "Home", "/", 0),
      makePage("page-two", "Page 2", "/page-2", 1),
    ]);

    expect(treeNodes.map((node) => node.id)).toEqual([
      "page-home",
      "page-two",
      "page-three",
    ]);
  });

  it("marks the slash slug Home page as non-deletable even when another page has order 0", () => {
    const { nodeMap } = buildPageTree([
      makePage("page-latest", "Page 3", "/page-3", 0),
      makePage("page-home", "Home", "/", 1),
    ]);

    expect(nodeMap.get("page-home")?.isRoot).toBe(true);
    expect(nodeMap.get("page-home")?.isDraggable).toBe(false);
    expect(nodeMap.get("page-latest")?.isRoot).toBe(false);
    expect(nodeMap.get("page-latest")?.isDraggable).toBe(true);
  });

  it("applies page drag/drop updates to the tree source pages", () => {
    const pages = [
      makePage("page-home", "Home", "/", 0),
      makePage("page-one", "Page 1", "/page-1", 1),
      makePage("page-two", "Page 2", "/page-2", 2),
    ];

    const updatedPages = applyPageTreeUpdates(pages, [
      { id: "page-two", parentId: "page-one", orderNum: 0 },
    ]);
    const { nodeMap } = buildPageTree(updatedPages);

    expect(updatedPages).not.toBe(pages);
    expect(nodeMap.get("page-two")?.parentId).toBe("page-one");
    expect(nodeMap.get("page-one")?.children.map((node) => node.id)).toEqual([
      "page-two",
    ]);
  });

  it("syncs page tree metadata into the active canonical document", () => {
    const document: CompositionDocument = {
      version: "composition-1.0",
      children: [
        {
          id: "page-one",
          type: "frame",
          name: "Old Page 1",
          metadata: {
            type: "legacy-page",
            pageId: "page-one",
            slug: "/old-page-1",
            order_num: 3,
          },
          children: [],
        },
        {
          id: "page-two",
          type: "frame",
          name: "Page 2",
          metadata: {
            type: "legacy-page",
            pageId: "page-two",
            slug: "/page-2",
            order_num: 4,
          },
          children: [],
        },
      ],
    };

    const updatedDocument = syncCanonicalPageTreeMetadata(document, [
      makePage("page-one", "Page 1", "/page-1", 1),
      makePage("page-two", "Page 2", "/page-2", 0, "page-one"),
    ]);

    const pageOne = updatedDocument.children.find(
      (node) => node.id === "page-one",
    );
    const pageTwo = updatedDocument.children.find(
      (node) => node.id === "page-two",
    );

    expect(pageOne?.name).toBe("Page 1");
    expect(pageOne?.metadata).toMatchObject({
      order_num: 1,
      parent_id: null,
      slug: "/page-1",
    });
    expect(pageTwo?.metadata).toMatchObject({
      order_num: 0,
      parent_id: "page-one",
      slug: "/page-2",
    });
  });
});
