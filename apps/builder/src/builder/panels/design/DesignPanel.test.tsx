// @vitest-environment jsdom
import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
} from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { I18nProvider } from "../../../i18n";
import {
  resolveCommand,
  resetCommandRegistry,
} from "../../stores/commandRegistry";
import { useBuilderUiStore } from "../../stores/builderUiStore";
import {
  openStylesFixture,
  type StylesFixture,
} from "../styles/__tests__/support/catalogStylesFixture";
import { useSectionCollapse } from "../styles/hooks/useSectionCollapse";
import { DesignPanelView } from "./DesignPanel";
import {
  openDesignPanel,
  toggleDesignPanelView,
  useDesignPanelView,
} from "./designPanelView";

const setVisibility = vi.hoisted(() => vi.fn());
vi.mock("../../layout/panelWorkspaceVisibility", () => ({
  setPanelWorkspacePanelVisibility: setVisibility,
}));

/**
 * ADR-252 — the Design panel: one tab row of six, the Property tab's body or a Styles view, and
 * the exclusive registration of the tab's copy / paste pair (G2: the dispatcher stops at the first
 * match of a scope, so the inactive tab's pair must not be registered at all).
 */
let fixture: StylesFixture;
let clipboardText = "";
Object.defineProperty(navigator, "clipboard", {
  configurable: true,
  value: {
    writeText: async (text: string) => {
      clipboardText = text;
    },
    readText: async () => clipboardText,
  },
});
const cmdAlt = (key: string) => ({
  key,
  altKey: true,
  ...(navigator.platform.includes("Mac")
    ? { metaKey: true }
    : { ctrlKey: true }),
});

function renderDesign() {
  return render(
    <I18nProvider initialLocale="en-US">
      <div data-panel-id="properties" tabIndex={-1} data-testid="panel">
        <DesignPanelView />
      </div>
    </I18nProvider>,
    { wrapper: fixture.wrapper },
  );
}

beforeEach(async () => {
  vi.stubGlobal("CSS", { escape: (value: string) => value });
  resetCommandRegistry();
  useDesignPanelView.setState({ view: "property" });
  useSectionCollapse.setState({
    collapsedSections: new Set(),
    focusMode: false,
    activeFocusSection: null,
  });
  fixture = await openStylesFixture(
    [
      {
        id: "button-1",
        type: "Button",
        style: { width: "200px", color: "#00ff00" },
        props: { children: "Save" },
      },
    ],
    { select: "button-1" },
  );
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  setVisibility.mockReset();
});

describe("ADR-252 Design panel", () => {
  it("one tab row of five (no Modified); the Property tab is the default and shows the Properties body", () => {
    renderDesign();
    expect(screen.getAllByRole("tab").map((tab) => tab.textContent)).toEqual([
      "Property",
      "",
      "",
      "",
      "",
    ]);
    expect(screen.getByRole("tab", { name: "Property" })).toBeTruthy();
    // A Styles section is not rendered on the Property tab.
    expect(screen.queryByText("Spacing")).toBeNull();
    fireEvent.click(screen.getByRole("tab", { name: "Layout" }));
    expect(useDesignPanelView.getState().view).toBe("layout");
    expect(screen.getByText("Spacing")).toBeTruthy();
  });

  it("the tab row stays on an empty selection — only the tab body becomes the notice", () => {
    fixture.workspace.selectRecords([]);
    renderDesign();
    expect(screen.getAllByRole("tab")).toHaveLength(5);
    expect(screen.getByText(/^Select an element/)).toBeTruthy();
    act(() => useDesignPanelView.setState({ view: "style" }));
    expect(screen.getAllByRole("tab")).toHaveLength(5);
    // The style tab's own notice (its body), the tab row unchanged.
    expect(screen.getByText(/^Select an element/)).toBeTruthy();
    expect(screen.getByRole("tab", { name: "Style" })).toBeTruthy();
  });

  it("registers only the active tab's copy / paste pair — switching the tab swaps it at once", () => {
    renderDesign();
    expect(resolveCommand("copyProperties")).toBeDefined();
    expect(resolveCommand("pasteProperties")).toBeDefined();
    expect(resolveCommand("copyStyles")).toBeUndefined();
    expect(resolveCommand("pasteStyles")).toBeUndefined();
    expect(resolveCommand("toggleFocusMode")).toBeUndefined();
    expect(resolveCommand("toggleSections")).toBeUndefined();

    act(() => useDesignPanelView.setState({ view: "text" }));
    expect(resolveCommand("copyProperties")).toBeUndefined();
    expect(resolveCommand("pasteProperties")).toBeUndefined();
    expect(resolveCommand("copyStyles")).toBeDefined();
    expect(resolveCommand("pasteStyles")).toBeDefined();
    expect(resolveCommand("toggleFocusMode")).toBeDefined();
    expect(resolveCommand("toggleSections")).toBeDefined();

    act(() => useDesignPanelView.setState({ view: "property" }));
    expect(resolveCommand("copyProperties")).toBeDefined();
    expect(resolveCommand("copyStyles")).toBeUndefined();
  });

  it("⌘⌥C copies what the active tab shows — properties on Property, the style on a style tab", async () => {
    renderDesign();
    const panel = screen.getByTestId("panel");
    act(() => panel.focus());
    fireEvent.focusIn(panel);
    await act(async () => {
      fireEvent.keyDown(panel, cmdAlt("c"));
    });
    expect(JSON.parse(clipboardText)).toMatchObject({ children: "Save" });
    expect(JSON.parse(clipboardText)).not.toHaveProperty("color");

    act(() => useDesignPanelView.setState({ view: "layout" }));
    await act(async () => {
      fireEvent.keyDown(panel, cmdAlt("c"));
    });
    expect(JSON.parse(clipboardText)).toMatchObject({ color: "#00ff00" });
    expect(JSON.parse(clipboardText)).not.toHaveProperty("children");
  });
});

describe("ADR-252 Design panel opening", () => {
  const showPanel = (visible: boolean) =>
    useBuilderUiStore.setState({
      panelWorkspaceLayout: {
        visibility: { properties: visible },
      } as never,
    });

  it("openDesignPanel selects the tab and opens the panel", () => {
    showPanel(false);
    useDesignPanelView.setState({ view: "style" });
    openDesignPanel("property");
    expect(useDesignPanelView.getState().view).toBe("property");
    expect(setVisibility).toHaveBeenCalledWith("properties", true);
  });

  it("⌥6 opens on the Layout tab; on the Layout tab already open it closes", () => {
    showPanel(true);
    useDesignPanelView.setState({ view: "property" });
    toggleDesignPanelView("layout");
    expect(useDesignPanelView.getState().view).toBe("layout");
    expect(setVisibility).toHaveBeenLastCalledWith("properties", true);

    toggleDesignPanelView("layout");
    expect(setVisibility).toHaveBeenLastCalledWith("properties", false);
    expect(useDesignPanelView.getState().view).toBe("layout");

    showPanel(false);
    toggleDesignPanelView("layout");
    expect(setVisibility).toHaveBeenLastCalledWith("properties", true);
  });
});
