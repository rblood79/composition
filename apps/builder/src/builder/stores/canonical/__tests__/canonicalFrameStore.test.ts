import { beforeEach, describe, expect, it } from "vitest";
import type { CompositionDocument, FrameNode } from "@composition/shared";
import { useCanonicalDocumentStore } from "../canonicalDocumentStore";
import { getCanonicalReusableFrameLayouts } from "../canonicalFrameStore";

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

  it("canonical reusable FrameNode에서 UI summary를 직접 투영한다", () => {
    const nestedFrame: FrameNode = {
      id: "nested-frame",
      type: "frame",
      children: [],
    };
    const reusableFrame: FrameNode = {
      id: "layout-main",
      type: "frame",
      reusable: true,
      name: "Main",
      metadata: {
        type: "legacy-layout",
        layoutId: "main",
        project_id: "proj-1",
        description: "main frame",
        slug: "/main",
      },
      slot: ["content"],
      children: [nestedFrame],
    };
    const nonReusableFrame: FrameNode = {
      id: "page-1",
      type: "frame",
      name: "Page",
      children: [],
    };
    const canonical = useCanonicalDocumentStore.getState();
    canonical.setCurrentProject("proj-1");
    canonical.setDocument("proj-1", makeDoc([reusableFrame, nonReusableFrame]));

    expect(getCanonicalReusableFrameLayouts()).toEqual([
      {
        id: "main",
        name: "Main",
        project_id: "proj-1",
        description: "main frame",
        slug: "/main",
      },
    ]);
  });
});
