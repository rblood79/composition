import { describe, expect, it } from "vitest";
import type { Element } from "../../../types/builder/unified.types";
import {
  buildLayerSectionElementMap,
  resolveLayerTreeEditingContext,
} from "./LayersSection";

function makeElement(id: string, overrides: Partial<Element> = {}): Element {
  return {
    id,
    type: "Box",
    parent_id: null,
    page_id: "page-1",
    order_num: 0,
    props: {},
    ...overrides,
  } as Element;
}

describe("LayersSection canonical read helpers", () => {
  it("keeps canonical elements authoritative over stale page snapshots", () => {
    const staleBody = makeElement("body", {
      type: "body",
      props: { style: { display: "flex" } },
    });
    const canonicalBody = makeElement("body", {
      type: "body",
      props: { style: { display: "grid" } },
    });
    const snapshotOnly = makeElement("live-child", {
      parent_id: "body",
    });

    const map = buildLayerSectionElementMap(
      [staleBody, snapshotOnly],
      [canonicalBody],
    );

    expect(map.get("body")?.props.style).toEqual({ display: "grid" });
    expect(map.get("live-child")).toBe(snapshotOnly);
  });

  it("resolves editing context from the canonical layer map instead of store mirror", () => {
    const body = makeElement("body", { type: "body" });
    const group = makeElement("group", { type: "Group", parent_id: "body" });
    const child = makeElement("child", {
      type: "Button",
      parent_id: "group",
    });

    const context = resolveLayerTreeEditingContext(
      child,
      new Map([
        ["body", body],
        ["group", group],
        ["child", child],
      ]),
    );

    expect(context).toBe("group");
  });
});
