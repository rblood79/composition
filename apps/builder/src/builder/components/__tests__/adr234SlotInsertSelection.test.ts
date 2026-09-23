import { afterEach, describe, expect, it, vi } from "vitest";
import type { CanonicalNode, CompositionDocument } from "@composition/shared";

import { ensureReusableCompositeOrigins } from "../reusableCompositeOrigins";
import { planTabItemInsert } from "../collectionItemInsert";
import { isStaticCollectionOwner } from "../staticCollectionMigration";

/**
 * ADR-234 후속 (사용자 지적 2026-09-23):
 * ① Slot Insert — slot 의 선택 모양 후보 (origin, `metadata.variant: "selected"`) 와 휴지 후보 (`--unselected`) 가
 *   같은 항목을 넣었다. 항목은 둘 다 origin 을 ref 하고 (실행 중 선택 상태가 이기도록), 선택 후보면 새 key 를
 *   owner 의 선택 key 에 더한다 — 선택 모양은 RAC 선택 상태 → 변형 매핑으로 그려진다.
 * ② items 편집기 (Add Tag) 는 바인딩 목록 · 이관 보류된 `items` 전용 — Tag 를 다 지운 정적 목록에도 뜨면 안 된다.
 */

afterEach(() => vi.restoreAllMocks());

function seed(user: unknown[] = []): CompositionDocument {
  vi.spyOn(console, "warn").mockImplementation(() => {});
  return ensureReusableCompositeOrigins({
    version: "composition-1.0",
    children: [
      {
        id: "page-1",
        type: "frame",
        metadata: { type: "legacy-page", pageId: "page-1", slug: "/x" },
        children: [{ id: "body-1", type: "body", children: user }],
      },
    ],
  } as unknown as CompositionDocument);
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

/** Canvas 선택 판정과 같은 읽기 (`selectedKeys ?? defaultSelectedKeys` · `selectedKey ?? defaultSelectedKey`). */
function selects(props: Record<string, unknown>, key: string): boolean {
  const keys = props.selectedKeys ?? props.defaultSelectedKeys;
  if (Array.isArray(keys)) return keys.map(String).includes(key);
  if (keys === "all") return true;
  const single = props.selectedKey ?? props.defaultSelectedKey;
  return single != null && String(single) === key;
}

const FAMILIES = [
  {
    owner: "component-taggroup",
    host: "component-taggroup__2",
    selected: "component-tag-item-default",
    rest: "component-tag-item-default--unselected",
  },
  {
    owner: "component-tabs",
    host: "component-tabs__1",
    selected: "component-tab-item-default",
    rest: "component-tab-item-default--unselected",
  },
  {
    owner: "component-listbox",
    host: "component-listbox",
    selected: "component-listbox-item-default",
    rest: "component-listbox-item-default--unselected",
  },
];

describe("ADR-234 Slot Insert — 선택 모양 후보는 owner 선택 key 까지", () => {
  it.each(FAMILIES)(
    "$owner origin: 휴지 후보 = 항목만 · 선택 후보 = 항목 + owner 선택 key",
    ({ owner, host, selected, rest }) => {
      const doc = seed();
      const ownerProps = (find(doc.children, owner)!.props ?? {}) as Record<
        string,
        unknown
      >;
      const restPlan = planTabItemInsert({
        document: doc,
        hostId: host,
        candidateId: rest,
        newKey: "NEW",
      });
      const selectedPlan = planTabItemInsert({
        document: doc,
        hostId: host,
        candidateId: selected,
        newKey: "NEW",
      });
      expect(restPlan?.kind).toBe("plain");
      expect(selectedPlan?.kind).toBe("plain");
      if (restPlan?.kind !== "plain" || selectedPlan?.kind !== "plain") return;
      expect((restPlan.tab as { ref?: string }).ref).toBe(selected);
      expect((selectedPlan.tab as { ref?: string }).ref).toBe(selected);
      expect(restPlan.selection).toBeNull();
      expect(selectedPlan.selection?.ownerId).toBe(owner);
      expect(
        selects({ ...ownerProps, ...selectedPlan.selection!.props }, "NEW"),
      ).toBe(true);
    },
  );

  it.each(FAMILIES.filter((f) => f.host !== f.owner))(
    "$owner instance (synthetic 목록 틀): 선택 후보 = instance 선택 key",
    ({ owner, host, selected, rest }) => {
      const doc = seed([{ id: "inst", type: "ref", ref: owner, props: {} }]);
      const ownerProps = (find(doc.children, owner)!.props ?? {}) as Record<
        string,
        unknown
      >;
      const restPlan = planTabItemInsert({
        document: doc,
        hostId: `inst/${host}`,
        candidateId: rest,
        newKey: "NEW",
      });
      const selectedPlan = planTabItemInsert({
        document: doc,
        hostId: `inst/${host}`,
        candidateId: selected,
        newKey: "NEW",
      });
      if (restPlan?.kind !== "instance" || selectedPlan?.kind !== "instance") {
        throw new Error("instance plan expected");
      }
      expect(restPlan.props).toBeNull();
      expect(selects({ ...ownerProps, ...selectedPlan.props }, "NEW")).toBe(
        true,
      );
    },
  );

  it("ListBox instance (자기 자식 항목): 선택 후보 = instance 선택 key", () => {
    const doc = seed([
      { id: "lb", type: "ref", ref: "component-listbox", props: {} },
    ]);
    const plan = planTabItemInsert({
      document: doc,
      hostId: "lb",
      candidateId: "component-listbox-item-default",
      newKey: "NEW",
    });
    if (plan?.kind !== "plain") throw new Error("plain plan expected");
    expect(plan.selection?.ownerId).toBe("lb");
    expect(selects(plan.selection!.props, "NEW")).toBe(true);
  });

  it("선택 key 는 이어 붙인다 (single 은 교체)", () => {
    const doc = seed([
      {
        id: "tg",
        type: "ref",
        ref: "component-taggroup",
        props: { selectedKeys: ["a"] },
      },
    ]);
    const plan = planTabItemInsert({
      document: doc,
      hostId: "tg/component-taggroup__2",
      candidateId: "component-tag-item-default",
      newKey: "NEW",
    });
    if (plan?.kind !== "instance") throw new Error("instance plan expected");
    expect(plan.props).toEqual({ selectedKeys: ["a", "NEW"] });
  });
});

describe("ADR-234 items 편집기 노출 = 바인딩 · 이관 보류 items 한정", () => {
  it("정적 목록 (자식 0 포함) 은 정적 · 바인딩 · items 덮어쓰기는 편집기", () => {
    const doc = seed([
      {
        id: "plain-empty",
        type: "TagGroup",
        props: {},
        children: [
          { id: "plain-empty-list", type: "TagList", props: {}, children: [] },
        ],
      },
      {
        id: "inst-emptied",
        type: "ref",
        ref: "component-taggroup",
        props: {},
        descendants: { "component-taggroup__2": { children: [] } },
      },
      {
        id: "bound",
        type: "TagGroup",
        props: { dataBinding: { source: "dataTable", collectionId: "x" } },
        children: [{ id: "bound-list", type: "TagList", props: {} }],
      },
      {
        id: "inst-items",
        type: "ref",
        ref: "component-taggroup",
        props: { items: [{ id: "a", label: "A" }] },
        descendants: {
          "component-taggroup__2": { props: { style: { gap: 3 } } },
        },
      },
    ]);
    expect(isStaticCollectionOwner(doc, "component-taggroup")).toBe(true);
    expect(isStaticCollectionOwner(doc, "plain-empty")).toBe(true);
    expect(isStaticCollectionOwner(doc, "inst-emptied")).toBe(true);
    expect(isStaticCollectionOwner(doc, "bound")).toBe(false);
    expect(isStaticCollectionOwner(doc, "inst-items")).toBe(false);
  });
});
