// @vitest-environment jsdom
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  COMPONENT_MASTER_ID_MIRROR_FIELD,
  COMPONENT_OVERRIDES_MIRROR_FIELD,
  COMPONENT_ROLE_MIRROR_FIELD,
  withComponentInstanceMirror,
  withComponentOriginMirror,
} from "@/adapters/canonical/componentSemanticsMirror";
import { useStore } from "../../../../stores";
import { historyManager } from "../../../../stores/history";
import { LayerTreeItemContent } from "./LayerTreeItemContent";
import type { LayerTreeNode } from "./types";
import type { TreeItemState } from "../TreeBase/types";

function makeNode(overrides: Partial<LayerTreeNode> = {}): LayerTreeNode {
  return {
    id: "origin",
    name: "Origin Button",
    type: "Button",
    parentId: null,
    orderNum: 0,
    depth: 0,
    hasChildren: false,
    isLeaf: true,
    element: {
      id: "origin",
      type: "Button",
      props: {},
      reusable: true,
    },
    ...overrides,
  } as LayerTreeNode;
}

function makeState(overrides: Partial<TreeItemState> = {}): TreeItemState {
  return {
    isDisabled: false,
    isExpanded: false,
    isFocusVisible: false,
    isSelected: false,
    ...overrides,
  };
}

describe("LayerTreeItemContent editing semantics marker", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    cleanup();
  });

  it("origin node renders Pencil origin semantic dot with accessible label", () => {
    render(
      <LayerTreeItemContent
        node={makeNode()}
        state={makeState()}
        onDelete={vi.fn()}
      />,
    );

    const marker = screen.getByLabelText("Origin");
    expect(marker.className).toContain("editing-semantics-dot--origin");
    expect(screen.getByText("Origin Button")).toBeTruthy();
  });

  it("instance node renders Pencil instance semantic dot with accessible label", () => {
    render(
      <LayerTreeItemContent
        node={makeNode({
          name: "Instance Button",
          element: {
            id: "instance",
            type: "ref",
            props: {},
          },
        })}
        state={makeState()}
        onDelete={vi.fn()}
      />,
    );

    const marker = screen.getByLabelText("Instance");
    expect(marker.className).toContain("editing-semantics-dot--instance");
    expect(screen.getByText("Instance Button")).toBeTruthy();
  });

  it("plain node renders no semantic dot", () => {
    render(
      <LayerTreeItemContent
        node={makeNode({
          element: {
            id: "plain",
            type: "Button",
            props: {},
          },
        })}
        state={makeState()}
        onDelete={vi.fn()}
      />,
    );

    expect(screen.queryByLabelText("Origin")).toBeNull();
    expect(screen.queryByLabelText("Instance")).toBeNull();
  });

  it("does not override React Aria drag slot pointer events", () => {
    render(
      <LayerTreeItemContent
        node={makeNode()}
        state={makeState()}
        onDelete={vi.fn()}
      />,
    );

    expect(
      screen.getByRole("button", { name: "Drag Origin Button" }).style
        .pointerEvents,
    ).not.toBe("auto");
  });

  it("legacy instance node exposes detach through row context menu", async () => {
    vi.spyOn(window, "confirm").mockReturnValue(true);
    const origin = withComponentOriginMirror({
      id: "origin",
      type: "Button",
      props: { label: "Origin" },
      page_id: "page-1",
    });
    const instance = withComponentInstanceMirror(
      {
        id: "instance",
        type: "Button",
        props: {},
        page_id: "page-1",
      },
      "origin",
      { overrideProps: { label: "Detached" } },
    );
    historyManager.setCurrentPage("page-1");
    useStore.setState({
      currentPageId: "page-1",
      elements: [origin, instance],
      elementsMap: new Map([
        ["origin", origin],
        ["instance", instance],
      ]),
    } as never);
    useStore.getState()._rebuildIndexes();

    render(
      <LayerTreeItemContent
        node={makeNode({
          name: "Instance Button",
          element: instance,
        })}
        state={makeState()}
        onDelete={vi.fn()}
      />,
    );

    fireEvent.contextMenu(screen.getByText("Instance Button"), {
      clientX: 12,
      clientY: 34,
    });
    fireEvent.click(screen.getByRole("menuitem", { name: "Detach instance" }));

    await waitFor(() => {
      expect(useStore.getState().elementsMap.get("instance")).toMatchObject({
        [COMPONENT_ROLE_MIRROR_FIELD]: undefined,
        [COMPONENT_MASTER_ID_MIRROR_FIELD]: undefined,
        [COMPONENT_OVERRIDES_MIRROR_FIELD]: undefined,
        props: { label: "Detached" },
      });
    });
  });
});
