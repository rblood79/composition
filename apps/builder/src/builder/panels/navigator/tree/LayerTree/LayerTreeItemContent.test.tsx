// @vitest-environment jsdom
import type { ReactElement } from "react";
import { I18nProvider } from "@/i18n";
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
import { seedPanelElements } from "../../../../__tests__/panelFixture";
import { useStore } from "../../../../stores";
import { historyManager } from "../../../../stores/history";
import { ContextMenuProvider } from "../../../../components";
import { registerCanvasContextMenuProviders } from "../../../../workspace/canvas/contextMenu/canvasContextMenuProviders";
import type { CanvasActionElement } from "../../../../workspace/canvas/actions/canvasActions";
import { LayerTreeItemContent } from "./LayerTreeItemContent";
import type { LayerTreeNode } from "./types";
import type { TreeItemState } from "../TreeBase/types";

/**
 * ADR-200 Phase 2 — 이 트리/섹션이 마운트하는 표시 계층이 `t()` 로 라벨을
 * 만든다. 기준은 `label` 참조가 아니라 **컴포넌트 마운트** 다 (Phase 0
 * 인벤토리가 참조 기준이라 이 파일들을 놓쳤다 — evidence §4 정정).
 */
const renderWithI18n = (ui: ReactElement) =>
  render(ui, { wrapper: I18nProvider });


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
  return renderWithI18n(
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
    expect(screen.getByRole("menuitem", { name: /Copy/ })).toBeTruthy();
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
    seedPanelElements([origin, instance]);
    useStore.setState({ currentPageId: "page-1" } as never);
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
    // 확인 다이얼로그 리스너가 없으면 window.confirm 폴백을 타는데 jsdom 은
    // undefined 를 돌려줘 "취소" 로 읽힌다 — production 은 다이얼로그가 떠 있다.
    vi.spyOn(window, "confirm").mockReturnValue(true);
    fireEvent.click(screen.getByRole("menuitem", { name: /Detach instance/ }));

    await waitFor(() => {
      const detached = useStore.getState().elementsMap.get("instance");
      // 분리된 요소는 mirror 필드를 `undefined` 로 남기지 않고 **아예 제거**한다
      // (canonical 왕복 결과). 키 부재가 undefined 보다 강한 보증이다.
      expect(detached).not.toHaveProperty(COMPONENT_ROLE_MIRROR_FIELD);
      expect(detached).not.toHaveProperty(COMPONENT_MASTER_ID_MIRROR_FIELD);
      expect(detached).not.toHaveProperty(COMPONENT_OVERRIDES_MIRROR_FIELD);
      expect(detached).toMatchObject({ props: { label: "Detached" } });
    });
  });
});
