// @vitest-environment jsdom
import { cleanup, render, screen, within } from "@testing-library/react";
import type {
  CanonicalNode,
  CompositionDocument,
  RefNode,
  ResolvedNode,
} from "@composition/shared";
import { afterEach, describe, expect, it } from "vitest";

import { resolveCanonicalDocument } from "../../resolvers/canonical";
import type { RenderContext } from "../types";
import { CanonicalNodeRenderer } from "../components/CanonicalNodeRenderer";

function makeRenderContext(): RenderContext {
  return {
    elements: [],
    elementsById: new Map(),
    childrenByParent: new Map(),
    updateElementProps: () => {},
    batchUpdateElementProps: () => {},
    setElements: () => {},
    eventEngine: {} as RenderContext["eventEngine"],
    renderElement: () => null,
  };
}

function renderResolved(node: ResolvedNode) {
  return render(
    <CanonicalNodeRenderer node={node} renderContext={makeRenderContext()} />,
  );
}

describe("ADR-142 canonical preview ref/slot fixture", () => {
  afterEach(cleanup);

  it("F1 renders a reusable origin through the canonical renderer", () => {
    const origin: ResolvedNode = {
      id: "origin-button",
      type: "Button",
      reusable: true,
      props: { children: "Origin button" },
    };

    renderResolved(origin);

    expect(
      screen.getByRole("button", { name: "Origin button" }).dataset.canonicalId,
    ).toBe("origin-button");
  });

  it("F2/F3 renders ref descendants modes A/B/C including slot fill", () => {
    const allowedButton: CanonicalNode = {
      id: "allowed-button",
      type: "Button",
      reusable: true,
      props: { children: "Allowed default" },
    };
    const cardOrigin: CanonicalNode = {
      id: "card-origin",
      type: "frame",
      reusable: true,
      children: [
        {
          id: "cta",
          type: "Button",
          props: { label: "Default action" },
        },
        {
          id: "headline",
          type: "Text",
          props: { children: "Default headline" },
        },
        {
          id: "content-slot",
          type: "frame",
          slot: ["allowed-button"],
          children: [],
        },
      ],
    };
    const instance: RefNode = {
      id: "card-instance",
      type: "ref",
      ref: "card-origin",
      descendants: {
        cta: { label: "Instance action" },
        headline: {
          id: "replacement-heading",
          type: "Heading",
          props: { children: "Replacement heading" },
        },
        "content-slot": {
          children: [
            {
              id: "slotted-button",
              type: "ref",
              ref: "allowed-button",
              props: { children: "Slotted button" },
            } as RefNode,
          ],
        },
      },
    };
    const doc: CompositionDocument = {
      version: "composition-1.0",
      children: [allowedButton, cardOrigin, instance],
    };

    const resolved = resolveCanonicalDocument(doc).find(
      (node) => node.id === "card-instance",
    );
    expect(resolved).toBeDefined();
    const { container } = renderResolved(resolved!);

    expect(
      screen.getByRole("button", { name: "Instance action" }),
    ).toBeTruthy();
    expect(
      screen.getByRole("heading", { name: "Replacement heading" }),
    ).toBeTruthy();
    const slot = container.querySelector("[data-canonical-id='content-slot']");
    expect(slot).toBeTruthy();
    expect(
      within(slot as HTMLElement).getByRole("button", {
        name: "Slotted button",
      }),
    ).toBeTruthy();
  });

  it("F4 preserves resolved children on generic fallback nodes", () => {
    const node: ResolvedNode = {
      id: "fallback-shell",
      type: "frame",
      children: [
        {
          id: "fallback-child",
          type: "Button",
          props: { children: "Fallback child" },
        },
      ],
    };

    const { container } = renderResolved(node);

    const shell = container.querySelector(
      "[data-canonical-id='fallback-shell']",
    );
    expect(shell).toBeTruthy();
    expect(
      within(shell as HTMLElement).getByRole("button", {
        name: "Fallback child",
      }),
    ).toBeTruthy();
  });
});
