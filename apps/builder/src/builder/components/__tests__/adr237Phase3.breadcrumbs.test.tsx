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
import { resolveCanonicalDocument } from "../../../resolvers/canonical";
import { CanonicalNodeRenderer } from "../../../preview/components/CanonicalNodeRenderer";
import type { RenderContext } from "../../../preview/types/index";
import { ensureReusableCompositeOrigins } from "../reusableCompositeOrigins";
import { planTabItemInsert } from "../collectionItemInsert";
import { isStaticCollectionOwner } from "../staticCollectionMigration";
import { isSlotHostElement, resolveSlotInsertAction } from "../slotHostPolicy";
import { BREADCRUMB_ITEM_DEFAULT_ORIGIN_ID } from "../breadcrumbs/breadcrumbsTemplateOrigins";

/**
 * ADR-237 Phase 3 — G3 (breakdown §4 Phase 3): Breadcrumbs 항목 origin · `--current` · slot · 정적 목록 이관 (바인딩
 * 목록은 `items`) · 두 leg 가 자식을 그림 · 마지막 = current (위치 규칙 → 현재 층) · Slot "+".
 */

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

const RED = "#ff0000";
const RED_RGB = "rgb(255, 0, 0)";
const CURRENT_ID = `${BREADCRUMB_ITEM_DEFAULT_ORIGIN_ID}--current`;

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
  fn: (node: CanonicalNode) => CanonicalNode | null,
): CompositionDocument {
  const visit = (nodes: readonly CanonicalNode[]): CanonicalNode[] => {
    const out: CanonicalNode[] = [];
    for (const node of nodes) {
      const next = fn(node);
      if (!next) continue;
      out.push(
        next.children ? { ...next, children: visit(next.children) } : next,
      );
    }
    return out;
  };
  return { ...document, children: visit(document.children) };
}

function countNodes(nodes: readonly CanonicalNode[]): number {
  return nodes.reduce((n, node) => n + 1 + countNodes(node.children ?? []), 0);
}

function withUser(
  base: CompositionDocument,
  userChildren: CanonicalNode[],
  patches: Record<string, Partial<CanonicalNode>> = {},
): CompositionDocument {
  return mapNodes(base, (node) => {
    if (node.id === "body-1") return { ...node, children: userChildren };
    const patch = patches[node.id];
    return patch ? ({ ...node, ...patch } as CanonicalNode) : node;
  });
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

const sceneColor = (
  model: ReturnType<typeof buildCanonicalSceneModel>,
  id: string,
) =>
  ((model.sceneNodesMap.get(id)?.props?.style ?? {}) as Record<string, unknown>)
    .color;

describe("ADR-237 G3 — seed · 이관", () => {
  it("Breadcrumbs origin = Breadcrumb instance 자식 3 (label · href, 마지막은 href 없음) · items 없음 · slot [항목, 현재] · 재hydration Δ0", () => {
    const doc = seedDocument();
    const origin = find(doc.children, "component-breadcrumbs")!;
    expect((origin.props as Record<string, unknown>).items).toBeUndefined();
    expect((origin as { slot?: unknown }).slot).toEqual([
      BREADCRUMB_ITEM_DEFAULT_ORIGIN_ID,
      CURRENT_ID,
    ]);
    const items = origin.children ?? [];
    expect(items.map((c) => [c.type, (c as { ref?: string }).ref])).toEqual([
      ["ref", BREADCRUMB_ITEM_DEFAULT_ORIGIN_ID],
      ["ref", BREADCRUMB_ITEM_DEFAULT_ORIGIN_ID],
      ["ref", BREADCRUMB_ITEM_DEFAULT_ORIGIN_ID],
    ]);
    expect(
      items.map((c) => (c.props as Record<string, unknown>).children),
    ).toEqual(["Home", "Category", "Page"]);
    expect(items.map((c) => (c.props as Record<string, unknown>).href)).toEqual(
      ["/", "/category", null],
    );
    expect(find(doc.children, CURRENT_ID)).toMatchObject({
      type: "ref",
      ref: BREADCRUMB_ITEM_DEFAULT_ORIGIN_ID,
      props: {},
      metadata: { variant: "current" },
    });
    expect(isSlotHostElement(origin as never)).toBe(true);
    expect(isStaticCollectionOwner(doc, "component-breadcrumbs")).toBe(true);
    expect(JSON.stringify(ensureReusableCompositeOrigins(doc))).toBe(
      JSON.stringify(doc),
    );
  });

  it("기존 문서 (items 모양) → 이관 Δnode 5 (항목 3 + 항목 origin + 현재 변형) · 새 문서와 같은 모양", () => {
    const seeded = seedDocument();
    const origin = find(seeded.children, "component-breadcrumbs")!;
    const rows = (origin.children ?? []).map((c) => {
      const p = c.props as Record<string, unknown>;
      return {
        id: String(p.id),
        label: String(p.children),
        ...(typeof p.href === "string" ? { href: p.href } : {}),
      };
    });
    const pre = mapNodes(seeded, (node) => {
      if (
        node.id === BREADCRUMB_ITEM_DEFAULT_ORIGIN_ID ||
        node.id === CURRENT_ID
      ) {
        return null;
      }
      if (node.id === "component-breadcrumbs") {
        const {
          slot: _slot,
          children: _children,
          ...rest
        } = node as CanonicalNode & {
          slot?: unknown;
        };
        return {
          ...rest,
          props: { ...(node.props ?? {}), items: rows },
        } as CanonicalNode;
      }
      return node;
    });
    const post = ensureReusableCompositeOrigins(pre);
    expect(countNodes(post.children) - countNodes(pre.children)).toBe(5);
    expect(JSON.stringify(post)).toBe(JSON.stringify(seeded));
  });

  it("바인딩 목록은 items 그대로 (정적 자식으로 옮기지 않는다)", () => {
    const binding = {
      source: "collection",
      name: "crumbs",
    };
    const doc = withUser(seedDocument(), [
      {
        id: "bc-bound",
        type: "Breadcrumbs",
        props: {
          items: [{ id: "x", label: "X" }],
          dataBinding: binding,
        },
      } as unknown as CanonicalNode,
    ]);
    const post = ensureReusableCompositeOrigins(doc);
    const bound = find(post.children, "bc-bound")!;
    expect((bound.props as Record<string, unknown>).items).toEqual([
      { id: "x", label: "X" },
    ]);
    expect(bound.children ?? []).toEqual([]);
  });
});

describe("ADR-237 G3 — 바인딩 instance 는 origin 정적 항목을 그리지 않는다 (공용 표)", () => {
  it("Canvas · Preview resolver 모두 바인딩 Breadcrumbs instance 의 정적 Breadcrumb 자식 0", () => {
    const doc = withUser(seedDocument(), [
      {
        id: "bc-bound-inst",
        type: "ref",
        ref: "component-breadcrumbs",
        props: { dataBinding: { source: "collection", name: "crumbs" } },
      } as unknown as CanonicalNode,
    ]);
    const model = buildCanonicalSceneModel(doc);
    expect(
      (model.sceneChildrenByParent.get("bc-bound-inst") ?? []).filter(
        (k) => k.type === "Breadcrumb" && !String(k.id).includes("::"),
      ),
    ).toEqual([]);
    const resolved = findResolved(
      resolveCanonicalDocument(doc) as ResolvedNode[],
      "bc-bound-inst",
    )!;
    expect(
      (resolved.children ?? []).filter((c) => c.type === "Breadcrumb"),
    ).toEqual([]);
  });
});

describe("ADR-237 G3 — 두 leg 가 자식을 그리고 마지막 = 현재 층", () => {
  const current = { props: { style: { color: RED } } };

  it("Canvas: origin (plain 자식) · instance (합성 자식) 모두 마지막 항목만 현재 층", () => {
    const doc = withUser(
      seedDocument(),
      [
        {
          id: "bc-inst",
          type: "ref",
          ref: "component-breadcrumbs",
          props: {},
        } as unknown as CanonicalNode,
      ],
      { [CURRENT_ID]: current },
    );
    const model = buildCanonicalSceneModel(doc);
    for (const parent of ["component-breadcrumbs", "bc-inst"]) {
      const kids = model.sceneChildrenByParent.get(parent) ?? [];
      expect(
        kids.map((k) => k.type),
        parent,
      ).toEqual(["Breadcrumb", "Breadcrumb", "Breadcrumb"]);
      expect(
        kids.map((k) => sceneColor(model, k.id) === RED),
        parent,
      ).toEqual([false, false, true]);
    }
  });

  it("Canvas: 정적 crumb 에 projection 과 같은 layout 입력 (`_isLast` 마지막만 · `_separator` · owner size) — 자동 폭 측정이 이관 전과 같다", () => {
    const doc = withUser(seedDocument(), [
      {
        id: "bc-s",
        type: "ref",
        ref: "component-breadcrumbs",
        props: { size: "L", separator: "/" },
      } as unknown as CanonicalNode,
    ]);
    const model = buildCanonicalSceneModel(doc);
    for (const parent of ["component-breadcrumbs", "bc-s"]) {
      const kids = model.sceneChildrenByParent.get(parent) ?? [];
      const props = kids.map((k) => model.sceneNodesMap.get(k.id)!.props as Record<string, unknown>);
      // 측정기 기본값 (부재 = 마지막 아님 · "›" · "M") 은 싣지 않는다.
      expect(props.map((p) => p._isLast === true), parent).toEqual([
        false,
        false,
        true,
      ]);
      expect(
        props.map((p) => p._separator ?? "›"),
        parent,
      ).toEqual(Array(3).fill(parent === "bc-s" ? "/" : "›"));
      if (parent === "bc-s") expect(props.every((p) => p.size === "L")).toBe(true);
    }
  });

  it("Preview: 정적 자식이 RAC Breadcrumb 으로 그려지고 (무한 갱신 없음) 마지막만 data-current · 현재 층 · href", () => {
    const doc = withUser(
      seedDocument(),
      [
        {
          id: "bc-inst",
          type: "ref",
          ref: "component-breadcrumbs",
          props: {},
        } as unknown as CanonicalNode,
      ],
      { [CURRENT_ID]: current },
    );
    const { container } = renderResolved(doc, "bc-inst");
    const crumbs = Array.from(
      container.querySelectorAll<HTMLElement>("li.react-aria-Breadcrumb"),
    );
    expect(crumbs.map((c) => c.textContent)).toEqual([
      "Home",
      "Category",
      "Page",
    ]);
    expect(crumbs.map((c) => c.hasAttribute("data-current"))).toEqual([
      false,
      false,
      true,
    ]);
    expect(crumbs.map((c) => c.style.color === RED_RGB)).toEqual([
      false,
      false,
      true,
    ]);
    expect(crumbs[0]!.querySelector("a")?.getAttribute("href")).toBe("/");
  });

  it("Components 페이지 단독 항목 origin · 현재 변형 (Breadcrumbs 밖) — Preview 크래시 없이 origin 은 링크 · 변형은 현재", () => {
    const doc = seedDocument();
    const origin = renderResolved(doc, BREADCRUMB_ITEM_DEFAULT_ORIGIN_ID);
    const originCrumb = origin.container.querySelector<HTMLElement>(
      `li.react-aria-Breadcrumb[data-element-id="${BREADCRUMB_ITEM_DEFAULT_ORIGIN_ID}"]`,
    );
    expect(originCrumb?.hasAttribute("data-current")).toBe(false);
    cleanup();
    const variant = renderResolved(doc, CURRENT_ID);
    const variantCrumb = variant.container.querySelector<HTMLElement>(
      `li.react-aria-Breadcrumb[data-element-id="${CURRENT_ID}"]`,
    );
    expect(variantCrumb?.hasAttribute("data-current")).toBe(true);
  });
});

describe("ADR-237 G3 — instance 자기 자식은 상속 자식 뒤 (Canvas layout 입력 순서 = Preview 순서)", () => {
  it('scene 노드 배열의 형제 순서 = 자식 목록 (Breadcrumbs · CheckboxGroup instance 의 Slot "+" 항목)', () => {
    const doc = withUser(seedDocument(), [
      {
        id: "bc-inst",
        type: "ref",
        ref: "component-breadcrumbs",
        props: {},
        children: [
          {
            id: "bc-own",
            type: "ref",
            ref: BREADCRUMB_ITEM_DEFAULT_ORIGIN_ID,
            props: { id: "own", children: "Own" },
          },
        ],
      } as unknown as CanonicalNode,
      {
        id: "cg-inst",
        type: "ref",
        ref: "component-checkboxgroup",
        props: {},
        children: [
          {
            id: "cg-own",
            type: "ref",
            ref: "component-checkbox",
            props: { isSelected: true },
          },
        ],
      } as unknown as CanonicalNode,
    ]);
    const model = buildCanonicalSceneModel(doc);
    for (const parent of ["bc-inst", "cg-inst"]) {
      const listed = (model.sceneChildrenByParent.get(parent) ?? []).map(
        (n) => n.id,
      );
      const arrayOrder = model.sceneNodes
        .filter((n) => (n as { parentId?: string }).parentId === parent)
        .map((n) => n.id);
      expect(arrayOrder, parent).toEqual(listed);
      expect(listed.at(-1), parent).toBe(
        parent === "bc-inst" ? "bc-own" : "cg-own",
      );
    }
    const { container } = renderResolved(doc, "bc-inst");
    expect(
      Array.from(container.querySelectorAll("li.react-aria-Breadcrumb")).map(
        (c) => c.textContent,
      ),
    ).toEqual(["Home", "Category", "Page", "Own"]);
  });
});

describe('ADR-237 G3 — Slot "+" = 항목 instance', () => {
  it("origin (plain) · instance (ref — instance 자기 자식) 모두 Breadcrumb 항목 instance 를 끝에 넣는다", () => {
    const doc = withUser(seedDocument(), [
      {
        id: "bc-inst",
        type: "ref",
        ref: "component-breadcrumbs",
        props: {},
      } as unknown as CanonicalNode,
    ]);
    const origin = find(doc.children, "component-breadcrumbs")!;
    expect(
      resolveSlotInsertAction(origin as never, {
        id: CURRENT_ID,
        type: "ref",
        ref: BREADCRUMB_ITEM_DEFAULT_ORIGIN_ID,
      }),
    ).toEqual({ kind: "list-item" });
    for (const hostId of ["component-breadcrumbs", "bc-inst"]) {
      const plan = planTabItemInsert({
        document: doc,
        hostId,
        candidateId: CURRENT_ID,
        newKey: "k-new",
      });
      expect(plan?.kind, hostId).toBe("plain");
      if (plan?.kind !== "plain") continue;
      expect(plan.tabListId).toBe(hostId);
      expect(plan.tab).toMatchObject({
        type: "ref",
        ref: BREADCRUMB_ITEM_DEFAULT_ORIGIN_ID,
        props: { id: "k-new", children: "Breadcrumb 4" },
      });
      expect(plan.selection).toBeNull();
    }
  });
});
