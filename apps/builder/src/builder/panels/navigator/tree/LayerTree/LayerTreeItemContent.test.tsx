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
import { ContextMenuProvider } from "../../../../components";
import { registerCanvasContextMenuProviders } from "../../../../workspace/canvas/contextMenu/canvasContextMenuProviders";
import type { CanvasActionElement } from "../../../../workspace/canvas/actions/canvasActions";
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

function renderItem(
  node: LayerTreeNode,
  state = makeState(),
  onDelete = vi.fn(),
) {
  return render(
    <ContextMenuProvider>
      <LayerTreeItemContent node={node} state={state} onDelete={onDelete} />
    </ContextMenuProvider>,
  );
}

let unregisterContextMenuProviders: (() => void) | null = null;

describe("LayerTreeItemContent editing semantics marker", () => {
  afterEach(() => {
    unregisterContextMenuProviders?.();
    unregisterContextMenuProviders = null;
    vi.restoreAllMocks();
    cleanup();
  });

  it("텍스트 앞의 layer 아이콘과 depth guide를 유지한다", () => {
    const { container } = renderItem(makeNode({ depth: 2 }));

    const row = container.querySelector(".elementItem");
    const indent = row?.querySelector<HTMLElement>(".elementItemIndent");
    const icon = row?.querySelector(".elementItemIcon svg");
    const label = row?.querySelector(".elementItemLabel");

    expect(indent?.style.width).toBe("16px");
    expect(icon).toBeTruthy();
    expect(label?.textContent).toContain("Origin Button");
    expect(icon?.parentElement?.nextElementSibling).toBe(label);
  });

  it("origin node renders Pencil origin semantic dot with accessible label", () => {
    renderItem(makeNode());

    const marker = screen.getByLabelText("Origin");
    expect(marker.className).toContain("editing-semantics-dot--origin");
    expect(screen.getByText("Origin Button")).toBeTruthy();
  });

  it("instance node renders Pencil instance semantic dot with accessible label", () => {
    renderItem(
      makeNode({
        name: "Instance Button",
        element: {
          id: "instance",
          type: "ref",
          // ADR-199 Phase 4 — 인스턴스 축은 `ref`/`masterId`/`componentRole` 로만
          // 판정한다 (`type` 은 사영마다 값이 달라진다). `ref` 없는 `type:"ref"`
          // 는 실제로 만들어지지 않는 모양이다 (RefNode.ref 는 스키마 required).
          ref: "origin",
          props: {},
        },
      }),
    );

    const marker = screen.getByLabelText("Instance");
    expect(marker.className).toContain("editing-semantics-dot--instance");
    expect(screen.getByText("Instance Button")).toBeTruthy();
  });

  it("plain node renders no semantic dot", () => {
    renderItem(
      makeNode({
        element: {
          id: "plain",
          type: "Button",
          props: {},
        },
      }),
    );

    expect(screen.queryByLabelText("Origin")).toBeNull();
    expect(screen.queryByLabelText("Instance")).toBeNull();
  });

  it("does not override React Aria drag slot pointer events", () => {
    renderItem(makeNode());

    expect(
      screen.getByRole("button", { name: "Drag Origin Button" }).style
        .pointerEvents,
    ).not.toBe("auto");
  });

  it("selects an unselected row and opens the shared T1 menu", () => {
    const plain = {
      id: "plain",
      type: "Button",
      props: {},
      page_id: "page-1",
    };
    useStore.setState({
      currentPageId: "page-1",
      selectedElementId: null,
      selectedElementIds: [],
      elementsMap: new Map([[plain.id, plain]]),
    } as never);
    unregisterContextMenuProviders = registerCanvasContextMenuProviders({
      getInteractiveElementsMap: () =>
        useStore.getState().elementsMap as unknown as ReadonlyMap<
          string,
          CanvasActionElement
        >,
    });

    renderItem(
      makeNode({
        id: "plain",
        name: "Plain Button",
        element: plain,
      }),
    );

    fireEvent.contextMenu(screen.getByText("Plain Button"), {
      clientX: 12,
      clientY: 34,
    });

    expect(useStore.getState().selectedElementId).toBe("plain");
    expect(screen.getByRole("menuitem", { name: /복사/ })).toBeTruthy();
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

    unregisterContextMenuProviders = registerCanvasContextMenuProviders({
      getInteractiveElementsMap: () =>
        useStore.getState().elementsMap as unknown as ReadonlyMap<
          string,
          CanvasActionElement
        >,
    });

    renderItem(
      makeNode({
        name: "Instance Button",
        element: instance,
      }),
    );

    fireEvent.contextMenu(screen.getByText("Instance Button"), {
      clientX: 12,
      clientY: 34,
    });
    fireEvent.click(screen.getByRole("menuitem", { name: /Detach instance/ }));

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
