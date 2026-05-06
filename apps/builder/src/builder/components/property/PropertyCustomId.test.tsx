// @vitest-environment jsdom
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import type { Element } from "../../../types/core/store.types";
import { withComponentInstanceMirror } from "@/adapters/canonical/componentSemanticsMirror";
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

describe("PropertyCustomId", () => {
  afterEach(() => {
    cleanup();
  });

  beforeEach(() => {
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

  it("renders duplicate customId FieldError inside the properties fieldset", async () => {
    const existing = makeElement("existing", { customId: "button_1" });
    const target = makeElement("target", { customId: "button_2" });

    useStore.setState({
      elements: [existing, target],
      elementsMap: new Map([
        [existing.id, existing],
        [target.id, target],
      ]),
    } as never);

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
