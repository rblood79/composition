// @vitest-environment jsdom
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it } from "vitest";
import type { Element } from "../../../types/core/store.types";
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
    const instance = makeElement("instance", {
      componentRole: "instance",
      customId: "instance-id",
      masterId: "origin",
    } as never);

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
});
