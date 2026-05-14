import { beforeEach, describe, expect, it, vi } from "vitest";
import type {
  CanonicalNode,
  CompositionDocument,
  RefNode,
} from "@composition/shared";
import type { Element, Page } from "@/types/builder/unified.types";

import { useCanonicalDocumentStore } from "../../../builder/stores/canonical/canonicalDocumentStore";
import { applyPageFrameBindingCanonicalPrimary } from "../pageFrameBinding";

const mocks = vi.hoisted(() => ({
  db: {
    documents: {
      put: vi.fn(),
    },
  },
  getDB: vi.fn(),
  enqueuePagePersistence: vi.fn(),
}));

vi.mock("@/lib/db", () => ({
  getDB: mocks.getDB,
}));

vi.mock("@/builder/utils/pagePersistenceQueue", () => ({
  enqueuePagePersistence: mocks.enqueuePagePersistence,
}));

function makePage(id: string, layoutId: string | null): Page {
  return {
    id,
    title: id,
    project_id: "project-1",
    slug: `/${id}`,
    layout_id: layoutId,
  } as Page;
}

function makeDoc(children: CanonicalNode[]): CompositionDocument {
  return {
    version: "composition-1.0",
    children,
  };
}

function makeFill(id: string): CanonicalNode {
  return {
    id,
    type: "Card",
    props: {},
  };
}

describe("page frame binding roundtrip", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getDB.mockResolvedValue(mocks.db);
    mocks.enqueuePagePersistence.mockImplementation(
      async (task: () => Promise<void>) => {
        await task();
      },
    );
    useCanonicalDocumentStore.setState({
      documents: new Map(),
      currentProjectId: null,
      documentVersion: 0,
    });
  });

  it("preserves header/content/footer/custom descendant paths across unapply and reapply", async () => {
    const frame: CanonicalNode = {
      id: "layout-frame-1",
      type: "frame",
      reusable: true,
      metadata: { type: "legacy-layout", layoutId: "frame-1" },
      children: [
        {
          id: "frame-body",
          type: "body" as CanonicalNode["type"],
          props: {},
          children: [
            { id: "slot-header", type: "Slot", props: { name: "header" } },
            { id: "slot-content", type: "Slot", props: { name: "content" } },
            { id: "slot-footer", type: "Slot", props: { name: "footer" } },
            { id: "slot-aside", type: "Slot", props: { name: "aside" } },
          ],
        },
      ],
    };
    const pageRef: RefNode = {
      id: "page-1",
      type: "ref",
      ref: "layout-frame-1",
      metadata: {
        type: "legacy-page",
        pageId: "page-1",
        layoutId: "frame-1",
      },
      descendants: {
        "frame-body/slot-header": { children: [makeFill("header-card")] },
        "frame-body/slot-content": { children: [makeFill("content-card")] },
        "frame-body/slot-footer": { children: [makeFill("footer-card")] },
        "frame-body/slot-aside": { children: [makeFill("aside-card")] },
      },
    };

    useCanonicalDocumentStore.getState().setCurrentProject("project-1");
    useCanonicalDocumentStore
      .getState()
      .setDocument("project-1", makeDoc([frame, pageRef]));

    let pages = [makePage("page-1", "frame-1")];
    const setPages = vi.fn((nextPages: Page[]) => {
      pages = nextPages;
    });
    const elementsMap = new Map<string, Element>();
    const rebuildIndexes = vi.fn();

    await applyPageFrameBindingCanonicalPrimary({
      pageId: "page-1",
      frameId: null,
      getElementsState: () => ({
        pages,
        elementsMap,
        _rebuildIndexes: rebuildIndexes,
      }),
      setPages,
    });

    await applyPageFrameBindingCanonicalPrimary({
      pageId: "page-1",
      frameId: "frame-1",
      getElementsState: () => ({
        pages,
        elementsMap,
        _rebuildIndexes: rebuildIndexes,
      }),
      setPages,
    });

    const doc = useCanonicalDocumentStore.getState().getDocument("project-1");
    const reboundPage = doc?.children.find((node) => node.id === "page-1") as
      | RefNode
      | undefined;

    expect(Object.keys(reboundPage?.descendants ?? {}).sort()).toEqual([
      "frame-body/slot-aside",
      "frame-body/slot-content",
      "frame-body/slot-footer",
      "frame-body/slot-header",
    ]);
    expect(
      reboundPage?.descendants?.["frame-body/slot-header"]?.children?.map(
        (node) => node.id,
      ),
    ).toEqual(["header-card"]);
    expect(
      reboundPage?.descendants?.["frame-body/slot-footer"]?.children?.map(
        (node) => node.id,
      ),
    ).toEqual(["footer-card"]);
    expect(rebuildIndexes).toHaveBeenCalledTimes(2);
  });
});
