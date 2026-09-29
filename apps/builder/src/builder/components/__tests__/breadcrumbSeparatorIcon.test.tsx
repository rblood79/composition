import { cleanup, render } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import {
  getCatalogCutoverTypes,
  type CanonicalNode,
  type CompositionDocument,
  type ResolvedNode,
} from "@composition/shared";

import { createInitialProjectDocument } from "../../../dashboard/createInitialProjectDocument";
import { buildCanonicalSceneModel } from "../../workspace/canvas/scene/canonicalSceneModel";
import { resolveItemLabelTypography } from "../../workspace/canvas/skia/itemLabelInheritance";
import { resolveCanonicalDocument } from "../../../resolvers/canonical";
import { CanonicalNodeRenderer } from "../../../preview/components/CanonicalNodeRenderer";
import type { RenderContext } from "../../../preview/types/index";
import { ensureReusableCompositeOrigins } from "../reusableCompositeOrigins";
import {
  BREADCRUMB_ITEM_DEFAULT_ORIGIN_ID,
  migrateBreadcrumbLabelsToSlot,
} from "../breadcrumbs/breadcrumbsTemplateOrigins";

/**
 * 2026-09-29 (사용자 결정) — Breadcrumb 구분자 = 편집 가능한 Icon 자식 (종전 `::after` "›"). 조각 =
 * [label Text, 구분자 Icon] · DOM `li[Link(label), Icon]` · 현재 조각 (마지막 · `--current`) 은 구분자를 그리지
 * 않는다 · 이관은 사용자 글자를 보존하고 지운 구분자를 되살리지 않는다.
 */

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

const ORIGIN = BREADCRUMB_ITEM_DEFAULT_ORIGIN_ID;

function seedDocument(): CompositionDocument {
  vi.spyOn(console, "warn").mockImplementation(() => {});
  return createInitialProjectDocument(
    { id: "page-1", title: "P", slug: "/" },
    { id: "body-1", type: "body" },
  ) as CompositionDocument;
}

function find(
  nodes: readonly CanonicalNode[],
  id: string,
): CanonicalNode | undefined {
  for (const node of nodes) {
    if (node.id === id) return node;
    const hit = find(node.children ?? [], id);
    if (hit) return hit;
  }
  return undefined;
}

function mapNodes(
  document: CompositionDocument,
  fn: (node: CanonicalNode) => CanonicalNode,
): CompositionDocument {
  const visit = (nodes: readonly CanonicalNode[]): CanonicalNode[] =>
    nodes.map((node) => {
      const next = fn(node);
      return next.children ? { ...next, children: visit(next.children) } : next;
    });
  return { ...document, children: visit(document.children) };
}

function withUser(
  base: CompositionDocument,
  userChildren: CanonicalNode[],
): CompositionDocument {
  return mapNodes(base, (node) =>
    node.id === "body-1" ? { ...node, children: userChildren } : node,
  );
}

function findResolved(
  nodes: readonly ResolvedNode[],
  id: string,
): ResolvedNode | undefined {
  for (const node of nodes) {
    if (node.id === id) return node;
    const hit = findResolved((node.children ?? []) as ResolvedNode[], id);
    if (hit) return hit;
  }
  return undefined;
}

function renderResolved(document: CompositionDocument, id: string) {
  const node = findResolved(
    resolveCanonicalDocument(document) as ResolvedNode[],
    id,
  )!;
  return render(
    <CanonicalNodeRenderer
      node={node}
      cutoverPrimitives={getCatalogCutoverTypes()}
      renderContext={
        {
          childrenByParent: new Map(),
          renderElement: () => null,
          updateElementProps: () => {},
        } as unknown as RenderContext
      }
    />,
  );
}

const descendantsOf = (node: CanonicalNode | undefined) =>
  (
    node as
      { descendants?: Record<string, Record<string, unknown>> } | undefined
  )?.descendants;

describe("Breadcrumb 구분자 Icon — origin repair · instance 이관", () => {
  it("이관 전 leaf origin (자기 글자) → [label Text (사용자 글자), 구분자 Icon] · 다시 돌려도 같다", () => {
    const legacy = mapNodes(seedDocument(), (node) =>
      node.id === ORIGIN
        ? ({
            id: node.id,
            type: node.type,
            name: node.name,
            reusable: true,
            props: {
              children: "Custom",
              href: "#",
              style: { width: "fit-content" },
            },
            metadata: {
              type: "breadcrumb-template-origin",
              systemOwned: true,
              componentFamily: "Breadcrumbs",
              variant: "default",
            },
          } as unknown as CanonicalNode)
        : node,
    );
    const repaired = ensureReusableCompositeOrigins(legacy);
    const origin = find(repaired.children, ORIGIN)!;
    expect((origin.props as Record<string, unknown>).children).toBeUndefined();
    expect(
      (origin.children ?? []).map((c) => [
        c.type,
        (c.props as Record<string, unknown>).children ??
          (c.props as Record<string, unknown>).iconName,
      ]),
    ).toEqual([
      ["Text", "Custom"],
      ["Icon", "chevron-right"],
    ]);
    expect((origin.metadata as Record<string, unknown>).itemSlots).toBe(1);
    expect(JSON.stringify(ensureReusableCompositeOrigins(repaired))).toBe(
      JSON.stringify(repaired),
    );
  });

  it("사용자가 지운 구분자는 되살리지 않는다 (repair 는 자식을 건드리지 않는다)", () => {
    const edited = mapNodes(seedDocument(), (node) =>
      node.id === ORIGIN
        ? {
            ...node,
            children: (node.children ?? []).filter((c) => c.type !== "Icon"),
          }
        : node,
    );
    const repaired = ensureReusableCompositeOrigins(edited);
    expect(
      (find(repaired.children, ORIGIN)!.children ?? []).map((c) => c.type),
    ).toEqual(["Text"]);
  });

  it("instance 자기 글자 → label patch · 이미 있는 label patch 가 이긴다 · 멱등", () => {
    const doc = withUser(seedDocument(), [
      {
        id: "bc",
        type: "Breadcrumbs",
        props: {},
        children: [
          {
            id: "old",
            type: "ref",
            ref: ORIGIN,
            props: { id: "old", children: "Old" },
          },
          {
            id: "kept",
            type: "ref",
            ref: `${ORIGIN}--current`,
            props: { id: "kept", children: "Stale" },
            descendants: { Label: { children: "Kept" } },
          },
        ],
      } as unknown as CanonicalNode,
    ]);
    const migrated = migrateBreadcrumbLabelsToSlot(doc);
    const old = find(migrated.children, "old")!;
    const kept = find(migrated.children, "kept")!;
    expect((old.props as Record<string, unknown>).children).toBeUndefined();
    expect(descendantsOf(old)?.Label?.children).toBe("Old");
    expect((kept.props as Record<string, unknown>).children).toBeUndefined();
    expect(descendantsOf(kept)?.Label?.children).toBe("Kept");
    expect(migrateBreadcrumbLabelsToSlot(migrated)).toBe(migrated);
  });
});

describe("Breadcrumb 구분자 Icon — 두 소비자", () => {
  const userDoc = () =>
    withUser(seedDocument(), [
      {
        id: "bc-inst",
        type: "ref",
        ref: "component-breadcrumbs",
        props: { size: "L" },
      } as unknown as CanonicalNode,
    ]);

  it("Preview: li[Link(label), Icon] — Icon 은 Link 밖 · 뒤, 마지막 (현재) 조각에는 없다", () => {
    const { container } = renderResolved(userDoc(), "bc-inst");
    const crumbs = Array.from(
      container.querySelectorAll<HTMLElement>("li.react-aria-Breadcrumb"),
    );
    expect(crumbs).toHaveLength(3);
    expect(
      crumbs.map((li) =>
        Array.from(li.children).map((el) =>
          el.classList.contains("react-aria-Icon") ? "Icon" : "Link",
        ),
      ),
    ).toEqual([["Link", "Icon"], ["Link", "Icon"], ["Link"]]);
    // label 은 Link 안 Text.
    expect(crumbs.map((li) => li.firstElementChild?.textContent)).toEqual([
      "Home",
      "Category",
      "Page",
    ]);
  });

  it("Canvas: label Text 는 조각 글자 (size L 18 · 보통 400 · 현재 700 accent), 구분자 Icon = catalog iconSize 18", () => {
    const model = buildCanonicalSceneModel(userDoc());
    const crumbs = model.sceneChildrenByParent.get("bc-inst") ?? [];
    const typography = crumbs.map((crumb) =>
      (model.sceneChildrenByParent.get(crumb.id) ?? []).map((child) => {
        const t = resolveItemLabelTypography(
          model.sceneNodesMap.get(child.id)!,
          model.sceneNodesMap,
        );
        return child.type === "Icon"
          ? ["Icon", t?.fontSize]
          : ["Text", t?.fontSize, t?.fontWeight, t?.color];
      }),
    );
    expect(typography).toEqual([
      [
        ["Text", 18, 400, "{color.neutral-subdued}"],
        ["Icon", 18],
      ],
      [
        ["Text", 18, 400, "{color.neutral-subdued}"],
        ["Icon", 18],
      ],
      [["Text", 18, 700, "{color.accent}"]],
    ]);
  });
});

describe("Breadcrumb 구분자 Icon — 데이터 행 (문서 노드 없음)", () => {
  // items 가 아직 정적 자식으로 옮겨지지 않은 목록 = projection 행 (바인딩 행과 같은 경로).
  const boundDoc = (base: CompositionDocument) =>
    withUser(base, [
      {
        id: "bc-bound",
        type: "Breadcrumbs",
        props: {
          items: [
            { id: "x", label: "X" },
            { id: "y", label: "Y" },
          ],
        },
      } as unknown as CanonicalNode,
    ]);
  const projected = (doc: CompositionDocument) =>
    buildCanonicalSceneModel(doc)
      .sceneNodes.filter(
        (n) => n.type === "Breadcrumb" && String(n.id).includes("bc-bound"),
      )
      .map((n) => (n.props as Record<string, unknown>)._separatorIcon);

  it("origin 구분자 그대로 → 이름 · origin 에서 지우면 → null (구분자 없음)", () => {
    const seeded = seedDocument();
    expect(projected(boundDoc(seeded))).toEqual([
      "chevron-right",
      "chevron-right",
    ]);
    const removed = mapNodes(seeded, (node) =>
      node.id === ORIGIN
        ? {
            ...node,
            children: (node.children ?? []).filter((c) => c.type !== "Icon"),
          }
        : node,
    );
    expect(projected(boundDoc(removed))).toEqual([null, null]);
  });
});
