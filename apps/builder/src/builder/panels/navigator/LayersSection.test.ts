import { describe, expect, it } from "vitest";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import type { Element } from "../../../types/builder/unified.types";
import {
  buildLayerSectionElementMap,
  collectAutoExpandedParents,
  resolveLayerTreeEditingContext,
  resolveLayerTreeSelectionIntent,
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
  it("uses canonical panel read helper instead of useCanonicalElements", async () => {
    const source = await readFile(
      resolve(__dirname, "LayersSection.tsx"),
      "utf-8",
    );

    expect(source).toContain("useCanonicalPanelElements");
    expect(source).not.toContain("useCanonicalElements");
  });

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

describe("LayersSection 다중 선택", () => {
  it("단일 선택만 editingContext 조정 경로로 보낸다", () => {
    const one = makeElement("one");
    expect(resolveLayerTreeSelectionIntent([one])).toEqual({
      element: one,
      kind: "single",
    });
  });

  it("둘 이상은 editingContext 를 건드리지 않는 다중 경로다", () => {
    const one = makeElement("one");
    const two = makeElement("two");
    expect(resolveLayerTreeSelectionIntent([one, two])).toEqual({
      elementIds: ["one", "two"],
      kind: "multiple",
    });
  });

  it("빈 선택은 해제다", () => {
    expect(resolveLayerTreeSelectionIntent([])).toEqual({ kind: "clear" });
  });

  it("선택된 요소 전부의 조상을 펼친다", () => {
    const body = makeElement("body", { type: "body" });
    const groupA = makeElement("group-a", { parent_id: "body" });
    const groupB = makeElement("group-b", { parent_id: "body" });
    const childA = makeElement("child-a", { parent_id: "group-a" });
    const childB = makeElement("child-b", { parent_id: "group-b" });
    const map = new Map(
      [body, groupA, groupB, childA, childB].map((element) => [
        element.id,
        element,
      ]),
    );

    // 한쪽 조상만 펼치면 나머지 선택이 접힌 채 남아 표시가 반만 보인다.
    expect([
      ...collectAutoExpandedParents(["child-a", "child-b"], map),
    ]).toEqual(["group-a", "body", "group-b"]);
  });

  it("순환 parent 참조에도 멈춘다", () => {
    const a = makeElement("a", { parent_id: "b" });
    const b = makeElement("b", { parent_id: "a" });
    const map = new Map([
      ["a", a],
      ["b", b],
    ]);

    expect([...collectAutoExpandedParents(["a"], map)].sort()).toEqual([
      "a",
      "b",
    ]);
  });
});
