import { beforeEach, describe, expect, it, vi } from "vitest";
import type { CompositionDocument } from "@composition/shared";
import type { Element, Page } from "@/types/builder/unified.types";
import type { ReusableFrameLayoutInput } from "../types";
import { useCanonicalDocumentStore } from "../../../builder/stores/canonical/canonicalDocumentStore";
import { applyDeleteReusableFrameCanonicalPrimary } from "../frameLayoutCascade";

const mocks = vi.hoisted(() => ({
  db: {
    documents: {
      put: vi.fn(),
    },
  },
  getDB: vi.fn(),
}));

vi.mock("@/lib/db", () => ({
  getDB: mocks.getDB,
}));

function makeDoc(
  children: CompositionDocument["children"],
): CompositionDocument {
  return {
    version: "composition-1.0",
    children,
  };
}

describe("frameLayoutCascade page-frame unbinding", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getDB.mockResolvedValue(mocks.db);
    useCanonicalDocumentStore.setState({
      documents: new Map(),
      currentProjectId: null,
      documentVersion: 0,
    });
  });

  it("keeps direct page body children when deleting a reusable frame clears page binding", async () => {
    const page = {
      id: "page-1",
      title: "Page 1",
      project_id: "project-1",
      slug: "/page-1",
      layout_id: "frame-1",
    } as Page;
    const layout = {
      id: "frame-1",
      name: "Frame 1",
      project_id: "project-1",
    } as ReusableFrameLayoutInput;
    useCanonicalDocumentStore.getState().setCurrentProject("project-1");
    useCanonicalDocumentStore.getState().setDocument(
      "project-1",
      makeDoc([
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
      ] as CompositionDocument["children"]),
    );

    await applyDeleteReusableFrameCanonicalPrimary({
      frameId: "frame-1",
      layouts: [layout],
      getElementsState: () => ({
        pages: [page],
        elementsMap: new Map<string, Element>(),
      }),
      setPages: vi.fn(),
    });

    const doc = useCanonicalDocumentStore.getState().getDocument("project-1");
    const pageNode = doc?.children.find((node) => node.id === "page-1");
    expect(pageNode).toEqual(
      expect.objectContaining({
        type: "frame",
        metadata: expect.objectContaining({
          type: "legacy-page",
          pageId: "page-1",
        }),
        children: [
          expect.objectContaining({
            id: "page-1-body",
            children: [
              expect.objectContaining({ id: "page-1-button" }),
              expect.objectContaining({ id: "page-1-instance" }),
            ],
          }),
        ],
      }),
    );
  });
});
