import { afterEach, describe, expect, it, vi } from "vitest";

import {
  resolveSectionItemKey,
  type CanonicalNode,
  type CompositionDocument,
} from "@composition/shared";

import { resolveCanonicalRefTree } from "../../../adapters/canonical/canonicalRefResolution";
import { ensureReusableCompositeOrigins } from "../reusableCompositeOrigins";
import { ensureMenuTemplateOrigins } from "../menu/menuTemplateOrigins";
import { indexNodes, resolveChainEnd } from "../staticCollectionMigration";
import { buildItemRoleSurface, planItemRoleChild } from "../itemSlotRoles";

/**
 * ADR-238 Phase 0 — 진단 RED (breakdown §4 Phase 0 (a)~(e)).
 * `it` = 닫힌 결함 (닫은 Phase 가 `it.fails` → `it` 으로 바꿨다) · `it.fails` = 아직 열린 결함:
 *   (a) (e) → Phase 1 · (b) (c) → Phase 2 · (d) → Phase 3 — 전부 닫힘 (`it`).
 */

afterEach(() => vi.restoreAllMocks());

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

function childrenMap(byId: ReadonlyMap<string, CanonicalNode>) {
  const map = new Map<string, CanonicalNode[]>();
  for (const node of byId.values()) {
    if (node.children?.length) map.set(node.id, [...node.children]);
  }
  return map;
}

// ── (a) 항목 instance 역할 on/off 표면 (F3) ─────────────────────────────────
describe("ADR-238 진단 (a) — 항목 instance 에 역할 on/off 가 없다 (F3)", () => {
  it("ListBox instance 상속 항목의 역할 표면에 description on/off (optional) 가 있다", () => {
    const doc = seededDoc([
      { id: "lb-1", type: "ref", ref: "component-listbox", props: {} },
    ] as unknown as CanonicalNode[]);
    const byId = indexNodes(doc);
    const tree = resolveCanonicalRefTree<CanonicalNode>({
      elements: [byId.get("lb-1")!],
      elementsMap: byId,
      childrenMap: childrenMap(byId),
    });
    const surface = buildItemRoleSurface(
      resolveChainEnd("component-listbox-item-default", byId),
      tree.childrenMap.get("lb-1/component-listbox__item-1"),
      true,
    );
    const description = surface?.rows.find((r) => r.role === "description");
    expect(description).toMatchObject({ required: false, enabled: true });
  });
});

// ── (b) section 이 섞인 정적 목록은 이관되지 않는다 (F7 · F11) ────────────────
describe("ADR-238 진단 (b) — section entry 가 섞인 정적 ListBox · Menu 는 `items` 로 남는다 (F7)", () => {
  it(
    "section 이 섞인 정적 ListBox → 자식 (section 노드) 으로 이관된다",
    () => {
      const doc = seededDoc([
        {
          id: "sec-lb",
          type: "ListBox",
          props: {
            items: [
              {
                id: "s1",
                type: "section",
                header: "Fruit",
                items: [{ id: "apple", label: "Apple" }],
              },
            ],
          },
        },
      ] as unknown as CanonicalNode[]);
      const lb = indexNodes(doc).get("sec-lb")!;
      expect(lb.props?.items).toBeUndefined();
      expect((lb.children ?? []).length).toBeGreaterThan(0);
    },
  );
});

// ── (c) 같은 section origin instance 둘의 상속 항목 key 충돌 (F8 · R4) ────────
describe("ADR-238 진단 (c) — section instance 둘의 상속 항목이 같은 RAC key (F8 · R4 · r1 h1)", () => {
  /** reusable 묶음 origin (항목 ref 1 · `props.id` 있음 — Slot "+" 모양) 의 instance 둘을 한 목록에. */
  function twoInstancesDoc(): CompositionDocument {
    return seededDoc([
      {
        id: "sec-origin",
        type: "ListBoxSection",
        reusable: true,
        props: {},
        children: [
          {
            id: "sec-origin__item-a",
            type: "ref",
            ref: "component-listbox-item-default",
            props: { id: "item-a" },
          },
        ],
      },
      {
        id: "lb-2",
        type: "ListBox",
        props: {},
        children: [
          { id: "sec-x", type: "ref", ref: "sec-origin", props: {} },
          { id: "sec-y", type: "ref", ref: "sec-origin", props: {} },
        ],
      },
    ] as unknown as CanonicalNode[]);
  }

  it(
    "상속 항목 key 가 목록 안에서 유일하다 (`props.id` 가 있어도)",
    () => {
      const doc = twoInstancesDoc();
      const byId = indexNodes(doc);
      const tree = resolveCanonicalRefTree<CanonicalNode>({
        elements: [byId.get("sec-x")!, byId.get("sec-y")!],
        elementsMap: byId,
        childrenMap: childrenMap(byId),
      });
      // Phase 2 — section instance 안 항목은 section key 접두 (`resolveSectionItemKey`).
      const keys = ["sec-x", "sec-y"].flatMap((sec) => {
        const section = tree.elementsMap.get(sec)!;
        return (tree.childrenMap.get(sec) ?? []).map((item) =>
          resolveSectionItemKey(
            item.props as Record<string, unknown> | undefined,
            item.id,
            {
              id: section.id,
              props: section.props as Record<string, unknown> | undefined,
              ref: (section as { ref?: unknown }).ref,
            },
          ),
        );
      });
      expect(keys).toHaveLength(2);
      expect(new Set(keys).size).toBe(2);
    },
  );
});

// ── (d) Select · ComboBox 항목 = `items` 배열뿐 (F9) ──────────────────────────
describe("ADR-238 진단 (d) — Select · ComboBox 항목에 ListBoxItem origin 이 닿지 않는다 (F9)", () => {
  it(
    "Select · ComboBox origin 의 정적 항목 = ListBoxItem origin instance 자식",
    () => {
      const doc = seededDoc();
      const byId = indexNodes(doc);
      for (const id of ["component-select", "component-combobox"]) {
        const origin = byId.get(id)!;
        const itemRefs = (origin.children ?? []).filter(
          (child) => resolveChainEnd(child.id, byId)?.type === "ListBoxItem",
        );
        expect(itemRefs.length, id).toBeGreaterThan(0);
      }
    },
  );
});

// ── (e) 역할 표 밖 slot 이름 (F5) ────────────────────────────────────────────
describe('ADR-238 진단 (e) — GridListItem 역할 자식에 `slot:"label"` (F5 Invalid slot)', () => {
  it("origin 역할 추가 경로는 RAC 가 받지 않는 slot 이름을 싣지 않는다", () => {
    const doc = seededDoc();
    const origin = indexNodes(doc).get("component-gridlist-item-default")!;
    // label 을 지운 origin 에서 label 역할을 다시 더해도 `slot` 없음 (DEFAULT_SLOT).
    const withoutLabel = {
      ...origin,
      children: (origin.children ?? []).filter(
        (c) =>
          (c.metadata as Record<string, unknown> | undefined)?.slotRole !==
          "label",
      ),
    } as CanonicalNode;
    const plan = planItemRoleChild(withoutLabel, "label")!;
    expect((plan.node.props as Record<string, unknown>).slot).toBeUndefined();
    const desc = planItemRoleChild(
      { ...origin, children: [] } as CanonicalNode,
      "description",
    )!;
    expect((desc.node.props as Record<string, unknown>).slot).toBe(
      "description",
    );
  });
});
