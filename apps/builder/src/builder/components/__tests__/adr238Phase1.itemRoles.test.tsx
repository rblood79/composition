import { cleanup, render } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import {
  getCatalogCutoverTypes,
  isItemRoleSlotNameAllowed,
  resolveItemRoleSlotName,
  type CanonicalNode,
  type CompositionDocument,
  type ResolvedNode,
} from "@composition/shared";

import { resolveCanonicalRefTree } from "../../../adapters/canonical/canonicalRefResolution";
import { buildCanonicalSceneModel } from "../../workspace/canvas/scene/canonicalSceneModel";
import { resolveCanonicalDocument } from "../../../resolvers/canonical";
import { CanonicalNodeRenderer } from "../../../preview/components/CanonicalNodeRenderer";
import type { RenderContext } from "../../../preview/types/index";
import { ensureReusableCompositeOrigins } from "../reusableCompositeOrigins";
import { ensureMenuTemplateOrigins } from "../menu/menuTemplateOrigins";
import { indexNodes, resolveChainEnd } from "../staticCollectionMigration";
import {
  buildItemRoleSurface,
  planItemRoleChild,
  planItemRoleToggle,
} from "../itemSlotRoles";

/**
 * ADR-238 Phase 1 — 항목 안 slot (breakdown §4 Phase 1 · G1).
 * - 역할 표: RAC slot 이름만 `slot` 으로 (GridListItem label 은 DEFAULT) · 표 밖 이름 저장 거부.
 * - instance 표면: optional 역할 on/off = `descendants[역할 경로].enabled` · label 은 끌 수 없다 · 두 leg 반영.
 * - origin 표면: 없는 역할 추가 (GridListItem icon) — Preview 크래시 0.
 */

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

function stubResizeObserver() {
  (globalThis as { ResizeObserver?: unknown }).ResizeObserver ??= class {
    observe() {}
    unobserve() {}
    disconnect() {}
  };
}

function seededDoc(user: CanonicalNode[] = []): CompositionDocument {
  vi.spyOn(console, "warn").mockImplementation(() => {});
  return ensureReusableCompositeOrigins(
    ensureMenuTemplateOrigins({
      version: "composition-1.0",
      children: [
        {
          id: "page-home",
          type: "frame",
          metadata: { type: "legacy-page", pageId: "page-home", slug: "/" },
          children: [
            {
              id: "body-home",
              type: "body" as CanonicalNode["type"],
              children: user,
            },
          ],
        },
      ],
    } as CompositionDocument),
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

function renderResolved(node: ResolvedNode) {
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

/** 선택 노드 (instance / synthetic) 의 해석된 자식 — 패널 `getResolvedRefChildren` 과 같은 해석기. */
function resolvedChildren(
  doc: CompositionDocument,
  rootId: string,
  itemId: string,
): CanonicalNode[] {
  const byId = indexNodes(doc);
  const children = new Map<string, CanonicalNode[]>();
  for (const node of byId.values()) {
    if (node.children?.length) children.set(node.id, [...node.children]);
  }
  const tree = resolveCanonicalRefTree<CanonicalNode>({
    elements: [byId.get(rootId)!],
    elementsMap: byId,
    childrenMap: children,
  });
  return tree.childrenMap.get(itemId) ?? [];
}

/** store `buildInstanceDescendantPatches` 와 같은 매핑 — `<root>/<path>` → root.descendants[path]. */
function applyToggle(
  doc: CompositionDocument,
  rootId: string,
  update: { elementId: string; props: Record<string, unknown> },
): CompositionDocument {
  const path = update.elementId.slice(rootId.length + 1);
  const visit = (nodes: CanonicalNode[]): CanonicalNode[] =>
    nodes.map((node) => {
      if (node.id === rootId) {
        const descendants = {
          ...((node as { descendants?: Record<string, unknown> }).descendants ??
            {}),
        };
        descendants[path] = {
          ...((descendants[path] as Record<string, unknown>) ?? {}),
          ...update.props,
        };
        return { ...node, descendants } as CanonicalNode;
      }
      return node.children
        ? ({ ...node, children: visit(node.children) } as CanonicalNode)
        : node;
    });
  return { ...doc, children: visit(doc.children) };
}

const listBoxInstance = {
  id: "lb-1",
  type: "ref",
  ref: "component-listbox",
  props: {},
} as unknown as CanonicalNode;

describe("ADR-238 Phase 1 — 역할 표 (RAC slot 이름)", () => {
  it("RAC slot context 를 읽는 Text 는 provider 이름만 · Icon · Avatar 는 역할 이름 (CSS 훅)", () => {
    expect(resolveItemRoleSlotName("ListBoxItem", "label", "Text")).toBe(
      "label",
    );
    expect(resolveItemRoleSlotName("GridListItem", "label", "Text")).toBe(
      undefined,
    );
    expect(resolveItemRoleSlotName("GridListItem", "description", "Text")).toBe(
      "description",
    );
    expect(resolveItemRoleSlotName("GridListItem", "icon", "Icon")).toBe(
      "icon",
    );
    expect(resolveItemRoleSlotName("MenuItem", "shortcut", "Text")).toBe(
      undefined,
    );
  });

  it('표 밖 slot 이름 저장 거부 — GridListItem Text 에 `slot:"label"` (F5 Invalid slot) · 표에 없는 역할', () => {
    expect(
      isItemRoleSlotNameAllowed("GridListItem", "label", "Text", "label"),
    ).toBe(false);
    expect(
      isItemRoleSlotNameAllowed("GridListItem", "label", "Text", undefined),
    ).toBe(true);
    expect(
      isItemRoleSlotNameAllowed("GridListItem", "shortcut", "Text", undefined),
    ).toBe(false);
    expect(
      isItemRoleSlotNameAllowed("ListBoxItem", "description", "Text", "label"),
    ).toBe(false);
    // 표에 없는 항목 type 은 판정하지 않는다.
    expect(isItemRoleSlotNameAllowed("Button", "label", "Text", "x")).toBe(
      true,
    );
  });
});

describe("ADR-238 Phase 1 — instance 역할 on/off", () => {
  it("synthetic 항목 (ListBox instance 의 상속 항목) — description 끄기 → Canvas scene · Preview DOM 둘 다 빠진다", () => {
    stubResizeObserver();
    const doc = seededDoc([listBoxInstance]);
    const byId = indexNodes(doc);
    const itemId = "lb-1/component-listbox__item-1";
    const origin = resolveChainEnd("component-listbox-item-default", byId);
    const surface = buildItemRoleSurface(
      origin,
      resolvedChildren(doc, "lb-1", itemId),
      true,
    )!;
    expect(surface.rows.map((r) => [r.role, r.enabled, r.required])).toEqual([
      ["icon", true, false],
      ["label", true, true],
      ["description", true, false],
    ]);
    const update = planItemRoleToggle(itemId, surface, "description", false)!;
    expect(update).toEqual({
      elementId: "lb-1/component-listbox__item-1/Description",
      props: { enabled: false },
    });
    const next = applyToggle(doc, "lb-1", update);

    // 패널 표면이 꺼진 상태를 읽는다.
    const after = buildItemRoleSurface(
      origin,
      resolvedChildren(next, "lb-1", itemId),
      true,
    )!;
    expect(after.rows.find((r) => r.role === "description")!.enabled).toBe(
      false,
    );

    // Canvas: 첫 항목의 scene 자식에 description 이 없다 (둘째 항목은 그대로).
    const model = buildCanonicalSceneModel(next);
    const roleIds = (id: string) =>
      (model.sceneChildrenByParent.get(id) ?? []).map((n) =>
        n.id.split("/").pop(),
      );
    expect(roleIds(itemId)).toEqual(["Icon", "Label"]);
    expect(roleIds("lb-1/component-listbox__item-2")).toEqual([
      "Icon",
      "Label",
      "Description",
    ]);

    // Preview: 첫 option 에 description slot 이 없다.
    const resolved = findResolved(
      resolveCanonicalDocument(next) as ResolvedNode[],
      "lb-1",
    )!;
    const { container } = renderResolved(resolved);
    const options = Array.from(container.querySelectorAll('[role="option"]'));
    expect(options[0]!.querySelector('[slot="description"]')).toBeNull();
    expect(options[1]!.querySelector('[slot="description"]')).not.toBeNull();
  });

  it("instance 자기 자식 항목 (Slot + · 이관) — 끈 역할을 다시 켠다 (이관이 쓴 enabled:false 를 뒤집는다)", () => {
    const plain = {
      id: "plain-lb",
      type: "ListBox",
      props: { items: [{ id: "a", label: "Alpha" }] },
    } as CanonicalNode;
    const doc = seededDoc([plain]);
    const byId = indexNodes(doc);
    const item = byId.get("plain-lb")!.children![0]!;
    expect(item.type).toBe("ref");
    const origin = resolveChainEnd(item.id, byId);
    const surface = buildItemRoleSurface(
      origin,
      resolvedChildren(doc, item.id, item.id),
      true,
    )!;
    expect(surface.rows.find((r) => r.role === "description")!.enabled).toBe(
      false,
    );
    const update = planItemRoleToggle(item.id, surface, "description", true)!;
    expect(update.elementId).toBe(`${item.id}/Description`);
    const next = applyToggle(doc, item.id, update);
    const again = buildItemRoleSurface(
      origin,
      resolvedChildren(next, item.id, item.id),
      true,
    )!;
    expect(again.rows.find((r) => r.role === "description")!.enabled).toBe(
      true,
    );
  });

  it("label 은 끌 수 없다 (필수 — 접근 가능한 이름) · origin 에 없는 역할은 instance 표면에 없다", () => {
    const doc = seededDoc([listBoxInstance]);
    const byId = indexNodes(doc);
    const itemId = "lb-1/component-listbox__item-1";
    const surface = buildItemRoleSurface(
      resolveChainEnd("component-listbox-item-default", byId),
      resolvedChildren(doc, "lb-1", itemId),
      true,
    )!;
    expect(planItemRoleToggle(itemId, surface, "label", false)).toBeNull();
    const gridSurface = buildItemRoleSurface(
      byId.get("component-gridlist-item-default"),
      [],
      true,
    )!;
    expect(gridSurface.rows.map((r) => r.role)).toEqual([
      "label",
      "description",
    ]);
  });
});

describe("ADR-238 Phase 1 — origin 역할 추가", () => {
  it("GridListItem origin 에 icon 추가 — 표 순서 (label 앞) · slot = CSS 훅 · optional · Preview 크래시 0", () => {
    stubResizeObserver();
    const doc = seededDoc([
      { id: "gl-1", type: "ref", ref: "component-gridlist", props: {} },
    ] as unknown as CanonicalNode[]);
    const byId = indexNodes(doc);
    const origin = byId.get("component-gridlist-item-default")!;
    const surface = buildItemRoleSurface(origin, undefined, false)!;
    expect(surface.mode).toBe("origin");
    expect(surface.rows.map((r) => [r.role, r.present])).toEqual([
      ["icon", false],
      ["label", true],
      ["description", true],
    ]);
    const plan = planItemRoleChild(origin, "icon")!;
    expect(plan.index).toBe(0);
    expect(plan.node).toMatchObject({
      type: "Icon",
      props: { slot: "icon", iconName: "{icon}" },
      metadata: { slotRole: "icon", optional: true },
    });
    // label 추가는 이미 있으니 null.
    expect(planItemRoleChild(origin, "label")).toBeNull();

    // origin 에 icon 자식을 넣은 문서 — Preview 가 크래시 없이 GridList row 를 그린다.
    const withIcon = {
      ...doc,
      children: doc.children.map(function visit(node): CanonicalNode {
        if (node.id === origin.id) {
          const kids = [...(node.children ?? [])];
          kids.splice(plan.index, 0, plan.node);
          return { ...node, children: kids };
        }
        return node.children
          ? { ...node, children: node.children.map(visit) }
          : node;
      }),
    } as CompositionDocument;
    const resolved = findResolved(
      resolveCanonicalDocument(withIcon) as ResolvedNode[],
      "gl-1",
    )!;
    const { container } = renderResolved(resolved);
    expect(
      container.querySelectorAll(".react-aria-GridListItem").length,
    ).toBeGreaterThan(0);
  });
});
