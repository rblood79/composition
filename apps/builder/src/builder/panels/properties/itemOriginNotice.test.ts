// @vitest-environment node
import { describe, expect, it } from "vitest";
import type { CanonicalNode } from "@composition/shared";
import { resolveEnclosingItemTemplateOrigin } from "./itemOriginNotice";

const nodes: CanonicalNode[] = [
  {
    id: "card-origin",
    type: "GridListItem",
    reusable: true,
    children: [{ id: "heading", type: "Text" } as CanonicalNode],
  } as CanonicalNode,
  { id: "heading", type: "Text" } as CanonicalNode,
  // 변형 origin (reusable ref) — 체인 끝 type 으로 판정.
  {
    id: "card-origin--selected",
    type: "ref",
    ref: "card-origin",
    reusable: true,
  } as unknown as CanonicalNode,
  { id: "badge-ref", type: "ref", ref: "badge" } as unknown as CanonicalNode,
  { id: "button-origin", type: "Button", reusable: true } as CanonicalNode,
  { id: "plain-text", type: "Text" } as CanonicalNode,
];
const nodeMap = new Map(nodes.map((n) => [n.id, n]));
const parents: Record<string, string> = {
  heading: "card-origin",
  "badge-ref": "card-origin",
};
const ancestorsOf = (id: string) => {
  const out: CanonicalNode[] = [];
  for (let p = parents[id]; p; p = parents[p]) out.push(nodeMap.get(p)!);
  return out;
};

describe("resolveEnclosingItemTemplateOrigin (ADR-150 A3' 안내)", () => {
  it.each([
    ["origin 자체", "card-origin", "card-origin"],
    ["origin 안 자식", "heading", "card-origin"],
    ["origin 안 ref 의 synthetic 자식", "badge-ref/label", "card-origin"],
    [
      "변형 origin (reusable ref)",
      "card-origin--selected",
      "card-origin--selected",
    ],
  ])("%s → 안내", (_, id, expected) => {
    expect(
      resolveEnclosingItemTemplateOrigin(id, nodeMap, ancestorsOf)?.id,
    ).toBe(expected);
  });
  it.each([
    ["항목 템플릿이 아닌 origin (Button)", "button-origin"],
    ["origin 밖 요소", "plain-text"],
    ["문서에 없는 id", "missing"],
  ])("%s → 안내 없음", (_, id) => {
    expect(
      resolveEnclosingItemTemplateOrigin(id, nodeMap, ancestorsOf),
    ).toBeNull();
  });
});
