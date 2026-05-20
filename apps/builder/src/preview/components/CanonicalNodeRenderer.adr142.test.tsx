// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import type {
  CompositionDocument,
  RefNode,
  ResolvedNode,
} from "@composition/shared";
import { afterEach, describe, expect, it, vi } from "vitest";

import { resolveCanonicalDocument } from "../../resolvers/canonical";
import type { RenderContext } from "../types";
import { CanonicalNodeRenderer } from "./CanonicalNodeRenderer";

const { legacyButtonRenderer, legacySeparatorRenderer } = vi.hoisted(() => ({
  legacyButtonRenderer: vi.fn(() => (
    <button data-legacy-renderer="Button">legacy</button>
  )),
  legacySeparatorRenderer: vi.fn(() => (
    <div data-legacy-renderer="Separator">legacy</div>
  )),
}));

vi.mock("@composition/shared/renderers", () => ({
  rendererMap: {
    Button: legacyButtonRenderer,
    Separator: legacySeparatorRenderer,
  },
}));

function makeRenderContext(): RenderContext {
  return {
    elements: [],
    elementsById: new Map(),
    childrenByParent: new Map(),
    updateElementProps: vi.fn(),
    batchUpdateElementProps: vi.fn(),
    setElements: vi.fn(),
    eventEngine: {} as RenderContext["eventEngine"],
    renderElement: vi.fn(),
  };
}

describe("CanonicalNodeRenderer ADR-142 primitive binding proof", () => {
  afterEach(() => {
    cleanup();
    legacyButtonRenderer.mockClear();
    legacySeparatorRenderer.mockClear();
  });

  it("renders Button through PrimitiveBinding before rendererMap fallback", () => {
    const node: ResolvedNode = {
      id: "button-1",
      type: "Button",
      props: {
        children: "Save changes",
        variant: "accent",
        fillStyle: "outline",
        size: "sm",
      },
    };

    const { container } = render(
      <CanonicalNodeRenderer node={node} renderContext={makeRenderContext()} />,
    );

    const button = screen.getByRole("button", { name: "Save changes" });
    expect(button.dataset.variant).toBe("accent");
    expect(button.dataset.fillStyle).toBe("outline");
    expect(button.dataset.size).toBe("sm");
    expect(container.querySelector("[data-canonical-id='button-1']")).toBe(
      button,
    );
    expect(legacyButtonRenderer).not.toHaveBeenCalled();
  });

  it("renders a resolved reusable Button ref through the same primitive branch", () => {
    const doc: CompositionDocument = {
      version: "composition-1.0",
      children: [
        {
          id: "origin-button",
          type: "Button",
          reusable: true,
          props: {
            children: "Origin label",
            variant: "primary",
            size: "md",
          },
        },
        {
          id: "page-1",
          type: "frame",
          metadata: { type: "page", pageId: "page-1" },
          props: { style: { width: 400, height: 200 } },
          children: [
            {
              id: "button-instance",
              type: "ref",
              ref: "origin-button",
              props: {
                children: "Instance label",
                variant: "negative",
              },
            } as RefNode,
          ],
        },
      ],
    };
    const [, page] = resolveCanonicalDocument(doc);

    render(
      <CanonicalNodeRenderer node={page} renderContext={makeRenderContext()} />,
    );

    const button = screen.getByRole("button", { name: "Instance label" });
    expect(button.dataset.canonicalId).toBe("button-instance");
    expect(button.dataset.variant).toBe("negative");
    expect(legacyButtonRenderer).not.toHaveBeenCalled();
  });

  it("renders Separator through PrimitiveBinding before rendererMap fallback", () => {
    const node: ResolvedNode = {
      id: "separator-1",
      type: "Separator",
      props: {
        orientation: "vertical",
        variant: "dashed",
        size: "lg",
      },
    };

    const { container } = render(
      <CanonicalNodeRenderer node={node} renderContext={makeRenderContext()} />,
    );

    const separator = screen.getByRole("separator");
    expect(separator.dataset.orientation).toBe("vertical");
    expect(separator.dataset.variant).toBe("dashed");
    expect(separator.dataset.size).toBe("lg");
    expect(container.querySelector("[data-canonical-id='separator-1']")).toBe(
      separator,
    );
    expect(legacySeparatorRenderer).not.toHaveBeenCalled();
  });
});
