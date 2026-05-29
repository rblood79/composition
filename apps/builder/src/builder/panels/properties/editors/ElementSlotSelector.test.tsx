// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  withFrameElementMirrorId,
  withPageFrameBinding,
} from "../../../../adapters/canonical/frameMirror";
import { withSlotMirrorName } from "../../../../adapters/canonical/slotMirror";
import type { Element, Page } from "../../../../types/core/store.types";
import { useStore } from "../../../stores";
import { ElementSlotSelector } from "./ElementSlotSelector";

function makeElement(
  id: string,
  // Canonical migration: `order_num` was removed from Element (ADR-125) but runtime
  // fixtures still carry the value. Keep it as an optional override field.
  overrides: Partial<Element> & {
    frameId?: string | null;
    propsSlotMirrorName?: string | null;
    order_num?: number;
  } = {},
): Element {
  const { frameId, propsSlotMirrorName, ...elementOverrides } = overrides;
  const element = {
    id,
    type: "Text",
    parent_id: null,
    page_id: "page-1",
    order_num: 0,
    props: {},
    ...elementOverrides,
  } as Element;

  const withProps =
    propsSlotMirrorName === undefined
      ? element
      : {
          ...element,
          props: withSlotMirrorName(element.props ?? {}, propsSlotMirrorName),
        };

  return frameId === undefined
    ? withProps
    : withFrameElementMirrorId(withProps, frameId);
}

function makePage(
  overrides: Partial<Page> & { frameId?: string | null } = {},
): Page {
  const { frameId = "frame-1", ...pageOverrides } = overrides;
  return withPageFrameBinding(
    {
      id: "page-1",
      title: "Page",
      project_id: "project-1",
      slug: "/",
      ...pageOverrides,
    },
    frameId,
  );
}

describe("ElementSlotSelector", () => {
  beforeEach(() => {
    useStore.setState({
      currentPageId: "page-1",
      elements: [],
      elementsMap: new Map(),
      pages: [],
      selectedElementId: null,
      selectedElementProps: {},
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
    cleanup();
  });

  it("shows layout slots immediately from frame mirror after preset apply", () => {
    const page = makePage();
    const element = makeElement("headline", {
      propsSlotMirrorName: "header",
    });
    const headerSlot = makeElement("slot-header", {
      type: "Slot",
      frameId: "frame-1",
      page_id: null,
      order_num: 2,
      props: { name: "header", required: true },
    });
    const contentSlot = makeElement("slot-content", {
      type: "Slot",
      frameId: "frame-1",
      page_id: null,
      order_num: 1,
      props: { name: "content" },
    });
    const otherFrameSlot = makeElement("slot-other", {
      type: "Slot",
      frameId: "frame-2",
      page_id: null,
      props: { name: "footer" },
    });

    useStore.setState({
      pages: [page],
      elements: [element, headerSlot, contentSlot, otherFrameSlot],
      elementsMap: new Map([
        ["headline", element],
        ["slot-header", headerSlot],
        ["slot-content", contentSlot],
        ["slot-other", otherFrameSlot],
      ]),
    });

    render(
      <ElementSlotSelector
        elementId="headline"
        currentSlotName="header"
        onSlotChange={vi.fn()}
      />,
    );

    expect(screen.getByText("Slot Assignment")).toBeTruthy();
    expect(screen.getAllByText("header *").length).toBeGreaterThan(0);
    expect(screen.queryByText("footer")).toBeNull();
  });
});
