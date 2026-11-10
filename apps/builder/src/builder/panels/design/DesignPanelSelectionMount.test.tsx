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
import { catalogPropertySelection } from "../../catalogRuntime/propertySelection";
import { PropertySelectionContext } from "../../components/property/propertySelection";
import { useSectionCollapse } from "../../components/panel/useSectionCollapse";
import { resetCommandRegistry } from "../../stores/commandRegistry";
import {
  openStylesFixture,
  type StylesFixture,
} from "../styles/__tests__/support/catalogStylesFixture";
import { DesignPanelView } from "./DesignPanel";
import { useDesignPanelView } from "./designPanelView";

vi.mock("../../layout/panelWorkspaceVisibility", () => ({
  setPanelWorkspacePanelVisibility: vi.fn(),
}));

/**
 * CANVAS_PERF_SCALING_2026-11 C1: the Property tab's fields are keyed by the selection's type, not
 * the element — selecting another element of the same type keeps them mounted (it mounted the
 * whole body again: ~420 fibers per Button → Button) and they show the new element's values.
 */
let fixture: StylesFixture;

function renderDesign() {
  return render(
    <I18nProvider initialLocale="en-US">
      <PropertySelectionContext.Provider
        value={catalogPropertySelection(fixture.workspace)}
      >
        <div data-panel-id="properties" tabIndex={-1}>
          <DesignPanelView />
        </div>
      </PropertySelectionContext.Provider>
    </I18nProvider>,
    { wrapper: fixture.wrapper },
  );
}
const labelInput = () =>
  screen
    .getAllByRole("textbox")
    .find((input) =>
      ["Save", "Cancel"].includes((input as HTMLInputElement).value),
    ) as HTMLInputElement;

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
      { id: "button-1", type: "Button", props: { label: "Save" } },
      { id: "button-2", type: "Button", props: { label: "Cancel" } },
    ],
    { select: "button-1" },
  );
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe("Design panel fields across a selection of the same type (C1)", () => {
  it("keeps the field mounted and shows the new element's value", () => {
    renderDesign();
    const first = labelInput();
    expect(first.value).toBe("Save");
    act(() => fixture.select("button-2"));
    const second = labelInput();
    expect(second).toBe(first);
    expect(second.value).toBe("Cancel");
  });

  it("a value typed on one element is not written to the next one selected", () => {
    renderDesign();
    const input = labelInput();
    act(() => input.focus());
    fireEvent.change(input, { target: { value: "Typed" } });
    act(() => fixture.select("button-2"));
    act(() => input.blur());
    const label = (id: string) =>
      (
        fixture.workspace.runtime.graph.getEntry(`project:node:${id}`) as {
          props: { label: { value: unknown } };
        }
      ).props.label.value;
    expect(label("button-2")).toBe("Cancel");
    expect(label("button-1")).toBe("Save");
    expect(labelInput().value).toBe("Cancel");
  });
});
