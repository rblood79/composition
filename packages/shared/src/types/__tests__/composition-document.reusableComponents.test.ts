import { describe, it, expect } from "vitest";
import type {
  CompositionDocument,
  CanonicalNode,
} from "../composition-document.types";

describe("CompositionDocument.reusableComponents (ADR-144 Wave D)", () => {
  it("accepts reusableComponents array of CanonicalNode", () => {
    const master: CanonicalNode = {
      id: "cmp_listbox_1",
      type: "ListBox",
      reusable: true,
      props: { items: [] },
      children: [],
    };
    const doc: CompositionDocument = {
      version: "composition-1.0",
      children: [],
      reusableComponents: [master],
    };
    expect(doc.reusableComponents).toHaveLength(1);
    expect(doc.reusableComponents?.[0].id).toBe("cmp_listbox_1");
    expect(doc.reusableComponents?.[0].reusable).toBe(true);
  });

  it("accepts CompositionDocument without reusableComponents (backward compat read)", () => {
    const doc: CompositionDocument = {
      version: "composition-1.0",
      children: [],
    };
    expect(doc.reusableComponents).toBeUndefined();
  });

  it("preserves existing root fields alongside reusableComponents", () => {
    const doc: CompositionDocument = {
      version: "composition-1.0",
      children: [],
      reusableComponents: [],
      events: [],
      actions: [],
    };
    expect(doc.events).toEqual([]);
    expect(doc.actions).toEqual([]);
    expect(doc.reusableComponents).toEqual([]);
  });
});
