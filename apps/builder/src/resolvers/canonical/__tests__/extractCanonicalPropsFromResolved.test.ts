/**
 * @fileoverview extractCanonicalPropsFromResolved — ADR-116 direct cutover.
 */

import { describe, it, expect } from "vitest";
import type { ResolvedNode } from "@composition/shared";

import { extractCanonicalPropsFromResolved } from "../extractCanonicalProps";

describe("extractCanonicalPropsFromResolved", () => {
  it("returns a shallow copy of ResolvedNode.props", () => {
    const node: ResolvedNode = {
      id: "canonical-btn",
      type: "Button",
      props: { variant: "primary", children: "Click me" },
    };

    const props = extractCanonicalPropsFromResolved(node);

    expect(props).toEqual({ variant: "primary", children: "Click me" });
    expect(props).not.toBe(node.props);
  });

  it("ignores metadata payloads and returns an empty object when props is absent", () => {
    const node: ResolvedNode = {
      id: "n1",
      type: "Button",
      metadata: { type: "adapter-quarantine", label: "ignored" },
    };

    expect(extractCanonicalPropsFromResolved(node)).toEqual({});
  });

  it("returns an empty object for nodes without props", () => {
    const node: ResolvedNode = { id: "n1", type: "Button" };
    expect(extractCanonicalPropsFromResolved(node)).toEqual({});
  });

  it("projects x-composition dataBinding as render-only component props", () => {
    const node = {
      id: "tree-1",
      type: "Tree",
      props: { items: undefined },
      "x-composition": {
        dataBinding: {
          type: "collection",
          source: "dataTable",
          name: "navigation",
          config: {},
        },
      },
    } as ResolvedNode;

    expect(extractCanonicalPropsFromResolved(node)).toMatchObject({
      dataBinding: {
        type: "collection",
        source: "dataTable",
        name: "navigation",
        config: {},
      },
    });
    expect(node.props).not.toHaveProperty("dataBinding");
  });

  it("materializes static collection dataBinding as render-only items", () => {
    const node = {
      id: "tree-1",
      type: "Tree",
      props: {},
      "x-composition": {
        dataBinding: {
          type: "collection",
          source: "static",
          config: {
            data: [{ id: "docs", label: "Docs" }],
          },
        },
      },
    } as ResolvedNode;

    expect(extractCanonicalPropsFromResolved(node)).toMatchObject({
      dataBinding: {
        type: "collection",
        source: "static",
      },
      items: [{ id: "docs", label: "Docs" }],
    });
    expect(node.props).not.toHaveProperty("items");
  });
});
