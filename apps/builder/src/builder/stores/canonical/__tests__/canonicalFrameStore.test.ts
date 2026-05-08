import { beforeEach, describe, expect, it } from "vitest";
import type { CompositionDocument, FrameNode } from "@composition/shared";
import type { Layout } from "@/types/builder/layout.types";
import { useCanonicalDocumentStore } from "../canonicalDocumentStore";
import {
  getCanonicalReusableFrameLayouts,
  seedCanonicalReusableFrameLayouts,
} from "../canonicalFrameStore";

function resetStore(): void {
  useCanonicalDocumentStore.setState({
    documents: new Map(),
    currentProjectId: null,
    documentVersion: 0,
  });
}

function makeDoc(children: CompositionDocument["children"] = []) {
  return {
    version: "composition-1.0",
    children,
  } satisfies CompositionDocument;
}

describe("canonicalFrameStore", () => {
  beforeEach(() => {
    resetStore();
  });

  it("DB layout mirror snapshot 을 canonical reusable frame shell 로 seed 한다", () => {
    const layouts: Layout[] = [
      {
        id: "footer",
        name: "Footer",
        project_id: "proj-1",
        description: "footer frame",
        slug: "/footer",
      },
      {
        id: "header",
        name: "Header",
        project_id: "proj-1",
        description: "header frame",
        slug: "/header",
      },
    ];

    seedCanonicalReusableFrameLayouts(layouts, "proj-1");

    const canonical = useCanonicalDocumentStore.getState();
    const doc = canonical.getDocument("proj-1");
    expect(canonical.currentProjectId).toBe("proj-1");
    expect(doc?.children.map((node) => node.id)).toEqual([
      "layout-footer",
      "layout-header",
    ]);
    expect(getCanonicalReusableFrameLayouts()).toEqual([
      {
        id: "footer",
        name: "Footer",
        project_id: "proj-1",
        description: "footer frame",
        slug: "/footer",
      },
      {
        id: "header",
        name: "Header",
        project_id: "proj-1",
        description: "header frame",
        slug: "/header",
      },
    ]);
  });

  it("기존 reusable frame 의 children 과 slot 을 보존하고 metadata 만 갱신한다", () => {
    const nestedFrame: FrameNode = {
      id: "nested-frame",
      type: "frame",
      children: [],
    };
    const existingFrame: FrameNode = {
      id: "layout-main",
      type: "frame",
      reusable: true,
      name: "Old Main",
      metadata: {
        type: "legacy-layout",
        layoutId: "main",
        slug: "/old",
      },
      slot: ["content"],
      children: [nestedFrame],
    };
    useCanonicalDocumentStore
      .getState()
      .setDocument("proj-1", makeDoc([existingFrame]));

    seedCanonicalReusableFrameLayouts(
      [
        {
          id: "main",
          name: "Main",
          project_id: "proj-1",
          description: "main frame",
          slug: "/main",
        },
      ],
      "proj-1",
    );

    const doc = useCanonicalDocumentStore.getState().getDocument("proj-1");
    const frame = doc?.children[0] as FrameNode;
    expect(frame.name).toBe("Main");
    expect(frame.slot).toEqual(["content"]);
    expect(frame.children).toEqual([nestedFrame]);
    expect(frame.metadata).toMatchObject({
      type: "legacy-layout",
      layoutId: "main",
      project_id: "proj-1",
      description: "main frame",
      slug: "/main",
    });
    expect(frame.metadata).not.toHaveProperty("order_num");
  });
});
