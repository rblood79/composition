// @vitest-environment jsdom
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Element } from "../../../types/core/store.types";
import {
  mergeElementsCanonicalPrimary,
  registerCanonicalMutationStoreActions,
  resetCanonicalMutationStoreActions,
} from "@/adapters/canonical/canonicalMutations";
import { withComponentInstanceMirror } from "@/adapters/canonical/componentSemanticsMirror";
import { seedPanelElements } from "../../panels/styles/hooks/__tests__/panelFixture";
import { useStore } from "../../stores";
import { useCanonicalDocumentStore } from "../../stores/canonical/canonicalDocumentStore";
import { PropertyCustomId } from "./PropertyCustomId";

function makeElement(id: string, overrides: Partial<Element> = {}): Element {
  return {
    id,
    type: "Button",
    props: {},
    parent_id: null,
    page_id: "page-1",
    order_num: 0,
    ...overrides,
  } as Element;
}

function seedCanonicalFromStore(): void {
  registerCanonicalMutationStoreActions({
    getCurrentProjectId: () => "property-custom-id-project",
    getCurrentLegacySnapshot: () => ({
      elements: useStore.getState().elements,
      pages: [],
      layouts: [],
    }),
  });
  useCanonicalDocumentStore
    .getState()
    .setCurrentProject("property-custom-id-project");
  mergeElementsCanonicalPrimary(useStore.getState().elements);
}

describe("PropertyCustomId", () => {
  afterEach(() => {
    resetCanonicalMutationStoreActions();
    cleanup();
  });

  beforeEach(() => {
    resetCanonicalMutationStoreActions();
    useStore.setState({
      elements: [],
      elementsMap: new Map(),
      selectedElementId: null,
      selectedElementProps: {},
    } as never);
    useCanonicalDocumentStore.setState({
      documents: new Map(),
      currentProjectId: null,
      documentVersion: 0,
    });
  });

  it("updates the explicit elementId instead of the selected origin", async () => {
    const origin = makeElement("origin", { customId: "origin-id" });
    const instance = withComponentInstanceMirror(
      makeElement("instance", {
        customId: "instance-id",
      } as never),
      "origin",
    );

    useStore.setState({
      elements: [origin, instance],
      elementsMap: new Map([
        [origin.id, origin],
        [instance.id, instance],
      ]),
      selectedElementId: "origin",
      selectedElementProps: origin.props,
    } as never);
    seedCanonicalFromStore();

    render(
      <PropertyCustomId elementId="instance" label="ID" value="instance-id" />,
    );

    const input = screen.getByRole("textbox");
    fireEvent.change(input, { target: { value: "instance-new" } });
    fireEvent.blur(input);

    await waitFor(() => {
      expect(useStore.getState().elementsMap.get("instance")?.customId).toBe(
        "instance-new",
      );
    });
    expect(useStore.getState().elementsMap.get("origin")?.customId).toBe(
      "origin-id",
    );
  });

  it("commits an Enter-confirmed ID exactly once", () => {
    const onChange = vi.fn();
    render(
      <PropertyCustomId
        elementId="target"
        label="ID"
        value="before"
        onChange={onChange}
      />,
    );

    const input = screen.getByRole("textbox");
    fireEvent.focus(input);
    fireEvent.change(input, { target: { value: "after" } });
    fireEvent.keyDown(input, { key: "Enter" });
    // Browser Enter path calls input.blur(), which then dispatches blur.
    fireEvent.blur(input);

    expect(onChange).toHaveBeenCalledTimes(1);
    expect(onChange).toHaveBeenCalledWith("after");
  });

  it("renders duplicate customId FieldError inside the properties fieldset", async () => {
    const existing = makeElement("existing", { customId: "button_1" });
    const target = makeElement("target", { customId: "button_2" });

    seedPanelElements([existing, target]);

    render(<PropertyCustomId elementId="target" label="ID" value="button_2" />);

    const input = screen.getByRole("textbox");
    fireEvent.change(input, { target: { value: "button_1" } });
    fireEvent.blur(input);

    const error = await screen.findByRole("alert");
    expect(error.classList.contains("react-aria-FieldError")).toBe(true);
    const fieldset = error.closest("fieldset");
    const controlGroup = fieldset?.querySelector(
      ".react-aria-control.react-aria-Group",
    );
    expect(fieldset?.classList.contains("properties-aria")).toBe(true);
    expect(error.parentElement).toBe(fieldset);
    expect(controlGroup?.nextElementSibling).toBe(error);
    expect(input.getAttribute("aria-describedby")).toBe(error.id);
  });
});
