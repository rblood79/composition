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
  parentId: string | null = null,
): Page {
  return {
    id,
    title,
    slug,
    project_id: "project-1",
    parent_id: parentId,
  } as Page;
}

describe("buildPageTree", () => {
  it("preserves incoming canonical page order without Home/order_num re-sort", () => {
    const { treeNodes } = buildPageTree([
      makePage("page-three", "Page 3", "/page-3"),
      makePage("page-home", "Home", "/"),
      makePage("page-two", "Page 2", "/page-2"),
    ]);

    expect(treeNodes.map((node) => node.id)).toEqual([
      "page-three",
      "page-home",
      "page-two",
    ]);
  });

  it("marks the slash slug Home page as non-deletable even when another page has order 0", () => {
    const { nodeMap } = buildPageTree([
      makePage("page-latest", "Page 3", "/page-3"),
      makePage("page-home", "Home", "/"),
    ]);

    expect(nodeMap.get("page-home")?.isRoot).toBe(true);
    expect(nodeMap.get("page-home")?.isDraggable).toBe(false);
    expect(nodeMap.get("page-latest")?.isRoot).toBe(false);
    expect(nodeMap.get("page-latest")?.isDraggable).toBe(true);
  });

  it("applies page drag/drop updates to the tree source pages", () => {
    const pages = [
      makePage("page-home", "Home", "/"),
      makePage("page-one", "Page 1", "/page-1"),
      makePage("page-two", "Page 2", "/page-2"),
    ];

    const updatedPages = applyPageTreeUpdates(pages, [
      { id: "page-two", parentId: "page-one" },
    ]);
    const { nodeMap } = buildPageTree(updatedPages);

    expect(updatedPages).not.toBe(pages);
    expect(nodeMap.get("page-two")?.parentId).toBe("page-one");
    expect(nodeMap.get("page-one")?.children.map((node) => node.id)).toEqual([
      "page-two",
    ]);
  });

  it("reorders updated pages into canonical preorder after drag/drop", () => {
    const pages = [
      makePage("page-home", "Home", "/"),
      makePage("page-one", "Page 1", "/page-1"),
      makePage("page-two", "Page 2", "/page-2"),
    ];

    const updatedPages = applyPageTreeUpdates(pages, [
      { id: "page-home" },
      { id: "page-two", parentId: null },
      { id: "page-one" },
    ]);

    expect(updatedPages.map((page) => page.id)).toEqual([
      "page-home",
      "page-two",
      "page-one",
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
      makePage("page-one", "Page 1", "/page-1"),
      makePage("page-two", "Page 2", "/page-2", "page-one"),
    ]);

    const pageOne = updatedDocument.children.find(
      (node) => node.id === "page-one",
    );
    const pageTwo = updatedDocument.children.find(
      (node) => node.id === "page-two",
    );

    expect(pageOne?.name).toBe("Page 1");
    expect(pageOne?.metadata).toMatchObject({
      parent_id: null,
      slug: "/page-1",
    });
    expect(pageTwo?.metadata).toMatchObject({
      parent_id: "page-one",
      slug: "/page-2",
    });
    expect(pageOne?.metadata).not.toHaveProperty("order_num");
    expect(pageTwo?.metadata).not.toHaveProperty("order_num");
  });

  it("syncs Pages tree source reorder into canonical document children while preserving reusable roots", () => {
    const document: CompositionDocument = {
      version: "composition-1.0",
      children: [
        {
          id: "layout-card",
          type: "frame",
          reusable: true,
          children: [],
        },
        {
          id: "page-home",
          type: "frame",
          name: "Home",
          metadata: { type: "legacy-page", pageId: "page-home", slug: "/" },
          children: [],
        },
        {
          id: "page-one",
          type: "frame",
          name: "Page 1",
          metadata: {
            type: "legacy-page",
            pageId: "page-one",
            slug: "/page-1",
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
          },
          children: [],
        },
      ],
    };

    const updatedDocument = syncCanonicalPageTreeMetadata(document, [
      makePage("page-two", "Page 2", "/page-2"),
      makePage("page-one", "Page 1", "/page-1"),
      makePage("page-home", "Home", "/"),
    ]);

    expect(updatedDocument.children.map((node) => node.id)).toEqual([
      "layout-card",
      "page-two",
      "page-one",
      "page-home",
    ]);
    expect(
      updatedDocument.children
        .filter((node) => node.id.startsWith("page-"))
        .every((node) => !("order_num" in ((node.metadata ?? {}) as object))),
    ).toBe(true);
  });

  it("ignores stale page order_num when no drag update rank is provided", () => {
    const document: CompositionDocument = {
      version: "composition-1.0",
      children: [
        {
          id: "page-home",
          type: "frame",
          metadata: { type: "legacy-page", pageId: "page-home", slug: "/" },
          children: [],
        },
        {
          id: "page-one",
          type: "frame",
          metadata: {
            type: "legacy-page",
            pageId: "page-one",
            slug: "/page-1",
          },
          children: [],
        },
        {
          id: "page-two",
          type: "frame",
          metadata: {
            type: "legacy-page",
            pageId: "page-two",
            slug: "/page-2",
          },
          children: [],
        },
      ],
    };

    const updatedDocument = syncCanonicalPageTreeMetadata(document, [
      makePage("page-home", "Home", "/"),
      makePage("page-one", "Page 1", "/page-1"),
      makePage("page-two", "Page 2", "/page-2"),
    ]);

    expect(updatedDocument.children.map((node) => node.id)).toEqual([
      "page-home",
      "page-one",
      "page-two",
    ]);
  });

  it("merges nested sibling reorder back into root page source order", () => {
    const pages = [
      makePage("page-home", "Home", "/"),
      makePage("child-one", "Child 1", "/child-1", "page-one"),
      makePage("page-one", "Page 1", "/page-1"),
      makePage("child-two", "Child 2", "/child-2", "page-one"),
      makePage("page-two", "Page 2", "/page-2"),
    ];

    const updatedPages = applyPageTreeUpdates(pages, [
      { id: "child-two", parentId: "page-one" },
      { id: "child-one" },
    ]);

    expect(updatedPages.map((page) => page.id)).toEqual([
      "page-home",
      "child-two",
      "page-one",
      "child-one",
      "page-two",
    ]);
    expect(
      buildPageTree(updatedPages)
        .nodeMap.get("page-one")
        ?.children?.map((node) => node.id),
    ).toEqual(["child-two", "child-one"]);
  });
});
