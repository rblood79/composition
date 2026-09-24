import { afterEach, describe, expect, it, vi } from "vitest";
import type { CanonicalNode, CompositionDocument } from "@composition/shared";

import { createInitialProjectDocument } from "../../../dashboard/createInitialProjectDocument";
import {
  buildCanonicalSceneModel,
  resetSceneRefResolutionReuse,
} from "../../workspace/canvas/scene/canonicalSceneModel";

/**
 * ADR-237 G4 — 해석 증분화: 문서가 바뀌어도 읽은 canonical 노드 (자기 · origin 체인 · 상태 변형 · 조상 3) 가 같은
 * leaf ref instance 는 이전 해석 결과를 쓴다. 재사용 결과 = 새 해석 (differential) · 무효화 조건.
 */

afterEach(() => {
  vi.restoreAllMocks();
  resetSceneRefResolutionReuse();
});

function seed(): CompositionDocument {
  vi.spyOn(console, "warn").mockImplementation(() => {});
  const base = createInitialProjectDocument(
    { id: "page-1", title: "P", slug: "/" },
    { id: "body-1", type: "body" },
  ) as CompositionDocument;
  const owners = Array.from({ length: 3 }, (_, i) => ({
    id: `bc${i}`,
    type: "Breadcrumbs",
    props: {},
    children: Array.from({ length: 3 }, (_, k) => ({
      id: `bc${i}-${k}`,
      type: "ref",
      ref: "component-breadcrumb-item-default",
      props: { id: `k${k}`, children: `C${i}${k}`, href: k < 2 ? "/x" : null },
    })),
  }));
  return mapNodes(base, (node) =>
    node.id === "body-1"
      ? ({ ...node, children: owners } as unknown as CanonicalNode)
      : node,
  );
}

/** store 편집과 같이 바뀐 경로만 새 객체 (안 바뀐 subtree 는 같은 객체). */
function mapNodes(
  doc: CompositionDocument,
  fn: (node: CanonicalNode) => CanonicalNode,
): CompositionDocument {
  const visit = (nodes: readonly CanonicalNode[]): CanonicalNode[] =>
    nodes.map((node) => {
      const next = fn(node);
      if (!next.children) return next;
      const children = visit(next.children);
      return children.every((c, i) => c === next.children![i])
        ? next
        : { ...next, children };
    });
  return { ...doc, children: visit(doc.children) };
}

const edit = (
  doc: CompositionDocument,
  id: string,
  props: Record<string, unknown>,
) =>
  mapNodes(doc, (node) =>
    node.id === id
      ? ({ ...node, props: { ...(node.props ?? {}), ...props } } as CanonicalNode)
      : node,
  );

/** scene 결과의 비교용 직렬화 (sourceNode 제외 — 객체 동일성 무관). */
function snapshot(model: ReturnType<typeof buildCanonicalSceneModel>) {
  return JSON.stringify(
    model.sceneNodes.map((n) => {
      const { sourceNode: _s, ...rest } = n as unknown as Record<string, unknown>;
      return rest;
    }),
  );
}

function fresh(doc: CompositionDocument) {
  resetSceneRefResolutionReuse();
  return buildCanonicalSceneModel(doc);
}

describe("ADR-237 G4 — leaf instance 재사용", () => {
  it("owner 편집 — 항목 해석 입력이 아니라 (크기 · 위치 상태는 해석 뒤) 모든 항목이 이전 해석 객체 · 결과는 새 해석과 같다", () => {
    const doc = seed();
    const first = buildCanonicalSceneModel(doc);
    const edited = edit(doc, "bc0", { style: { paddingTop: 6 } });
    const second = buildCanonicalSceneModel(edited);
    // 마지막 항목은 scene 후처리 (`_isLast` 주입) 가 매 build 새 객체 — 가운데 항목으로 본다.
    for (const id of ["bc0-1", "bc1-1"]) {
      expect(second.sceneNodesMap.get(id), id).toBe(first.sceneNodesMap.get(id));
    }
    expect(snapshot(second)).toBe(snapshot(fresh(edited)));
  });

  it("상태를 읽는 조상 (disabled 그룹) 편집은 그 아래 leaf 를 다시 해석한다", () => {
    const base = seed();
    const doc = mapNodes(base, (node) =>
      node.id === "body-1"
        ? ({
            ...node,
            children: [
              ...(node.children ?? []),
              {
                id: "cg",
                type: "CheckboxGroup",
                props: {},
                children: [
                  { id: "cg-b", type: "ref", ref: "component-button", props: {} },
                ],
              },
            ],
          } as unknown as CanonicalNode)
        : node,
    );
    const first = buildCanonicalSceneModel(doc);
    const edited = edit(doc, "cg", { isDisabled: true });
    const next = buildCanonicalSceneModel(edited);
    expect(next.sceneNodesMap.get("cg-b")).not.toBe(first.sceneNodesMap.get("cg-b"));
    expect(snapshot(next)).toBe(snapshot(fresh(edited)));
  });

  it("origin · 상태 변형 · 자기 편집은 다시 해석한다 (결과 = 새 해석)", () => {
    const doc = seed();
    const first = buildCanonicalSceneModel(doc);
    for (const [id, props] of [
      ["component-breadcrumb-item-default", { style: { width: "fit-content", color: "#ff0000" } }],
      ["component-breadcrumb-item-default--current", { style: { color: "#00ff00" } }],
      ["bc2-1", { children: "Changed" }],
    ] as const) {
      buildCanonicalSceneModel(doc);
      const edited = edit(doc, id, props);
      const next = buildCanonicalSceneModel(edited);
      expect(next.sceneNodesMap.get("bc2-1"), id).not.toBe(first.sceneNodesMap.get("bc2-1"));
      expect(snapshot(next), id).toBe(snapshot(fresh(edited)));
    }
  });

  it("상태 변형 편집 (`--disabled`) 은 그 상태의 leaf 를 다시 해석한다 (결과 = 새 해석)", () => {
    const base = seed();
    const doc = mapNodes(base, (node) =>
      node.id === "body-1"
        ? ({
            ...node,
            children: [
              ...(node.children ?? []),
              { id: "btn-off", type: "ref", ref: "component-button", props: { isDisabled: true } },
            ],
          } as unknown as CanonicalNode)
        : node,
    );
    const first = buildCanonicalSceneModel(doc);
    const edited = edit(doc, "component-button--disabled", {
      style: { color: "#ff0000" },
    });
    const next = buildCanonicalSceneModel(edited);
    expect(next.sceneNodesMap.get("btn-off")).not.toBe(first.sceneNodesMap.get("btn-off"));
    expect(
      (next.sceneNodesMap.get("btn-off")?.props?.style as Record<string, unknown>)?.color,
    ).toBe("#ff0000");
    expect(snapshot(next)).toBe(snapshot(fresh(edited)));
  });

  it("같은 문서 재빌드 사이에도 leaf 기록이 이어진다 (다음 편집에서 재사용)", () => {
    const doc = seed();
    const first = buildCanonicalSceneModel(doc);
    buildCanonicalSceneModel(doc);
    const edited = edit(doc, "bc0", { style: { paddingTop: 6 } });
    const next = buildCanonicalSceneModel(edited);
    expect(next.sceneNodesMap.get("bc2-1")).toBe(first.sceneNodesMap.get("bc2-1"));
  });
});
