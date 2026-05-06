// @vitest-environment jsdom
import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { CompositionDocument } from "@composition/shared";
import { useStore } from "../../../stores";
import { useCanonicalDocumentStore } from "../../../stores/canonical/canonicalDocumentStore";
import { LayoutBodyEditor } from "./LayoutBodyEditor";

vi.mock("./LayoutPresetSelector", () => ({
  LayoutPresetSelector: ({
    bodyElementId,
    layoutId,
  }: {
    bodyElementId: string;
    layoutId: string;
  }) => <div>{`preset:${layoutId}:${bodyElementId}`}</div>,
}));

describe("LayoutBodyEditor", () => {
  beforeEach(() => {
    useStore.setState({
      elements: [],
      elementsMap: new Map(),
      selectedElementId: null,
      selectedElementProps: {},
    } as never);
    useCanonicalDocumentStore.setState({
      currentProjectId: null,
      documents: new Map(),
      documentVersion: 0,
    });
  });

  it("shows Frame Preset for canonical-only frame body elements", () => {
    const doc: CompositionDocument = {
      version: "composition-1.0",
      children: [
        {
          id: "layout-frame-1",
          type: "frame",
          reusable: true,
          metadata: { type: "legacy-layout", layoutId: "frame-1" },
          children: [
            {
              id: "frame-body",
              type: "Body",
              props: { style: { display: "flex" } },
            },
          ],
        },
      ],
    } as never;

    useCanonicalDocumentStore.setState({
      currentProjectId: "project-1",
      documents: new Map([["project-1", doc]]),
      documentVersion: 1,
    });

    render(
      <LayoutBodyEditor
        currentProps={{}}
        elementId="frame-body"
        onUpdate={vi.fn()}
      />,
    );

    expect(screen.getByText("Frame Preset")).toBeTruthy();
    expect(screen.getByText("preset:frame-1:frame-body")).toBeTruthy();
  });
});
