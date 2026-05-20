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

const {
  legacyButtonRenderer,
  legacyLinkRenderer,
  legacySeparatorRenderer,
  legacyToggleButtonRenderer,
  legacyToggleButtonGroupRenderer,
  legacyToolbarRenderer,
} = vi.hoisted(() => ({
  legacyButtonRenderer: vi.fn(() => (
    <button data-legacy-renderer="Button">legacy</button>
  )),
  legacyLinkRenderer: vi.fn(() => <a data-legacy-renderer="Link">legacy</a>),
  legacySeparatorRenderer: vi.fn(() => (
    <div data-legacy-renderer="Separator">legacy</div>
  )),
  legacyToggleButtonRenderer: vi.fn(() => (
    <button data-legacy-renderer="ToggleButton">legacy</button>
  )),
  legacyToggleButtonGroupRenderer: vi.fn(() => (
    <div data-legacy-renderer="ToggleButtonGroup">legacy</div>
  )),
  legacyToolbarRenderer: vi.fn(() => (
    <div data-legacy-renderer="Toolbar">legacy</div>
  )),
}));

vi.mock("@composition/shared/renderers", () => ({
  rendererMap: {
    Button: legacyButtonRenderer,
    Link: legacyLinkRenderer,
    Separator: legacySeparatorRenderer,
    ToggleButton: legacyToggleButtonRenderer,
    ToggleButtonGroup: legacyToggleButtonGroupRenderer,
    Toolbar: legacyToolbarRenderer,
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
    legacyLinkRenderer.mockClear();
    legacySeparatorRenderer.mockClear();
    legacyToggleButtonRenderer.mockClear();
    legacyToggleButtonGroupRenderer.mockClear();
    legacyToolbarRenderer.mockClear();
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

  it("renders Link through PrimitiveBinding before rendererMap fallback", () => {
    const node: ResolvedNode = {
      id: "link-1",
      type: "Link",
      props: {
        children: "Open docs",
        href: "https://example.com/docs",
        variant: "secondary",
        size: "lg",
      },
    };

    const { container } = render(
      <CanonicalNodeRenderer node={node} renderContext={makeRenderContext()} />,
    );

    const link = screen.getByRole("link", { name: "Open docs" });
    expect(link.getAttribute("href")).toBe("https://example.com/docs");
    expect(link.dataset.variant).toBe("secondary");
    expect(link.dataset.size).toBe("lg");
    expect(container.querySelector("[data-canonical-id='link-1']")).toBe(link);
    expect(legacyLinkRenderer).not.toHaveBeenCalled();
  });

  it("renders ToggleButton through PrimitiveBinding before rendererMap fallback", () => {
    const node: ResolvedNode = {
      id: "toggle-button-1",
      type: "ToggleButton",
      props: {
        children: "Pinned",
        isSelected: true,
        isEmphasized: true,
        size: "lg",
      },
    };

    const { container } = render(
      <CanonicalNodeRenderer node={node} renderContext={makeRenderContext()} />,
    );

    const toggle = screen.getByRole("button", { name: "Pinned" });
    expect(toggle.dataset.size).toBe("lg");
    expect(toggle.dataset.emphasized).toBe("true");
    expect(
      container.querySelector("[data-canonical-id='toggle-button-1']"),
    ).toBe(toggle);
    expect(legacyToggleButtonRenderer).not.toHaveBeenCalled();
  });

  it("renders ToggleButtonGroup and children through PrimitiveBinding before rendererMap fallback", () => {
    const node: ResolvedNode = {
      id: "toggle-group-1",
      type: "ToggleButtonGroup",
      props: {
        orientation: "vertical",
        selectionMode: "multiple",
        isEmphasized: true,
        size: "lg",
      },
      children: [
        {
          id: "toggle-child-1",
          type: "ToggleButton",
          props: {
            children: "Grid",
            isSelected: true,
            size: "lg",
          },
        },
      ],
    };

    const { container } = render(
      <CanonicalNodeRenderer node={node} renderContext={makeRenderContext()} />,
    );

    const group = screen.getByRole("toolbar");
    const child = screen.getByRole("button", { name: "Grid" });
    expect(group.dataset.orientation).toBe("vertical");
    expect(group.dataset.size).toBe("lg");
    expect(
      container.querySelector("[data-canonical-id='toggle-group-1']"),
    ).toBe(group);
    expect(child.dataset.size).toBe("lg");
    expect(legacyToggleButtonGroupRenderer).not.toHaveBeenCalled();
    expect(legacyToggleButtonRenderer).not.toHaveBeenCalled();
  });

  it("renders Toolbar and action children through PrimitiveBinding before rendererMap fallback", () => {
    const node: ResolvedNode = {
      id: "toolbar-1",
      type: "Toolbar",
      props: {
        "aria-label": "Actions",
        orientation: "vertical",
      },
      children: [
        {
          id: "toolbar-button-1",
          type: "Button",
          props: {
            children: "Add",
            variant: "secondary",
            size: "sm",
          },
        },
        {
          id: "toolbar-separator-1",
          type: "Separator",
          props: {
            orientation: "horizontal",
            size: "sm",
          },
        },
      ],
    };

    const { container } = render(
      <CanonicalNodeRenderer node={node} renderContext={makeRenderContext()} />,
    );

    const toolbar = screen.getByRole("toolbar", { name: "Actions" });
    const button = screen.getByRole("button", { name: "Add" });
    expect(toolbar.dataset.orientation).toBe("vertical");
    expect(container.querySelector("[data-canonical-id='toolbar-1']")).toBe(
      toolbar,
    );
    expect(button.dataset.size).toBe("sm");
    expect(legacyToolbarRenderer).not.toHaveBeenCalled();
    expect(legacyButtonRenderer).not.toHaveBeenCalled();
    expect(legacySeparatorRenderer).not.toHaveBeenCalled();
  });
});
