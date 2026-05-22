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
});
