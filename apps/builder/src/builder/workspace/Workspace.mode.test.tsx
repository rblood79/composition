// @vitest-environment jsdom

import { render } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const featureFlags = vi.hoisted(() => ({
  compare: false,
  webgl: false,
}));

vi.mock("../../utils/featureFlags", () => ({
  isCanvasCompareMode: () => featureFlags.compare,
  isWebGLCanvas: () => featureFlags.webgl,
}));

vi.mock("./hooks/useWorkspaceCanvasSizing", () => ({
  useWorkspaceCanvasSizing: () => ({
    canvasSize: { width: 390, height: 844 },
  }),
}));

vi.mock("./hooks/useWorkspaceCompareSplit", () => ({
  useWorkspaceCompareSplit: () => ({
    compareSplit: 50,
    splitter: { value: 500, minValue: 200, maxValue: 800 },
    handleResizeEnd: vi.fn(),
    handleResize: vi.fn(),
    handleResizeStart: vi.fn(),
  }),
}));

vi.mock("./canvas/BuilderCanvas", () => ({
  BuilderCanvas: () => <div data-testid="skia-canvas" />,
}));

vi.mock("./scrollbar", () => ({
  CanvasScrollbar: () => null,
}));

vi.mock("./components/WorkflowCanvasToggles", () => ({
  WorkflowCanvasToggles: () => null,
}));

vi.mock("./components/WorkspaceStatusIndicator", () => ({
  WorkspaceStatusIndicator: () => null,
}));

// ADR-192 액션 바는 I18nProvider · ContextMenuProvider 를 요구한다 (프로덕션은
// BuilderViewport 가 둘 다 감싼다). 이 테스트의 관심사는 main.workspace DOM
// 동일성이라 다른 자식들과 같은 방식으로 대체한다.
vi.mock("../components/overlay/actionBar", () => ({
  ContextualActionBar: () => null,
}));

import { useCompareModeStore } from "./canvas/stores";
import { Workspace } from "./Workspace";

describe("ADR-922 common Workspace main slot", () => {
  beforeEach(() => {
    featureFlags.compare = false;
    featureFlags.webgl = false;
    useCompareModeStore.getState().setCompareMode(false);
  });

  it("WebGL-off → WebGL → compare 전환에서 동일한 main.workspace DOM을 유지한다", () => {
    const fallback = <div data-testid="fallback-canvas" />;
    const rendered = render(<Workspace fallbackCanvas={fallback} />);
    const mainSlot = rendered.container.querySelector("main.workspace");

    expect(mainSlot).not.toBeNull();
    expect(rendered.getByTestId("fallback-canvas")).not.toBeNull();

    featureFlags.webgl = true;
    rendered.rerender(<Workspace fallbackCanvas={fallback} />);
    expect(rendered.container.querySelector("main.workspace")).toBe(mainSlot);
    expect(rendered.getByTestId("skia-canvas")).not.toBeNull();

    useCompareModeStore.getState().setCompareMode(true);
    rendered.rerender(<Workspace fallbackCanvas={fallback} />);
    expect(rendered.container.querySelector("main.workspace")).toBe(mainSlot);
    expect(rendered.getByTestId("fallback-canvas")).not.toBeNull();
    expect(rendered.getByTestId("skia-canvas")).not.toBeNull();
    expect(
      rendered.container.querySelector(
        ".workspace-mode-content.workspace--compare-mode",
      ),
    ).not.toBeNull();
  });
});
