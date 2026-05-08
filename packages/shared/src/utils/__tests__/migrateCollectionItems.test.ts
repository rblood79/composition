import { describe, it, expect } from "vitest";
import {
  applyCollectionItemsMigration,
  listBoxItemChildrenToItemsArray,
  tagChildrenToItemsArray,
} from "../migrateCollectionItems";

/**
 * ADR-076 Phase 5 — 컬렉션 items SSOT 마이그레이션 (ListBox 확장)
 *
 * 부모 단위 원자 판정:
 *   - 자식 ListBoxItem 중 하나라도 Field 자식 보유 → 부모 전체 템플릿 유지
 *   - 전부 Field 없음 → 부모 전체 items[] 흡수 (ListBoxItem + subtree orphan)
 *
 * Text/Description subtree 직렬화:
 *   - Text (slot 없음 / slot="title" / slot="label") → label
 *   - Description 또는 Text[slot="description"] → description
 *
 * legacy selectedIndex/Indices → selectedKey/Keys 변환 (canonical 없을 때만)
 */

interface E {
  id: string;
  type: string;
  parent_id?: string | null;
  order_num?: number;
  props: Record<string, unknown>;
}

function el(
  id: string,
  type: string,
  parent_id: string | null,
  order_num: number,
  props: Record<string, unknown> = {},
): E {
  return { id, type, parent_id, order_num, props };
}

describe("listBoxItemChildrenToItemsArray (ADR-076 P5)", () => {
  it("props.label 우선, Text/Description 자식 무시 가능", () => {
    const lbi = el("lb-1", "ListBoxItem", "parent", 0, {
      label: "Apple",
      value: "A",
      isDisabled: true,
    });
    const childrenByParent = new Map<string, E[]>();
    const items = listBoxItemChildrenToItemsArray([lbi], childrenByParent);
    expect(items[0]).toMatchObject({
      id: "lb-1",
      label: "Apple",
      value: "A",
      isDisabled: true,
    });
  });

  it("props.label 부재 시 Text 자식(slot 없음) children 사용", () => {
    const lbi = el("lb-1", "ListBoxItem", "parent", 0, {});
    const txt = el("txt-1", "Text", "lb-1", 0, { children: "From Child" });
    const childrenByParent = new Map<string, E[]>([["lb-1", [txt]]]);
    const items = listBoxItemChildrenToItemsArray([lbi], childrenByParent);
    expect(items[0].label).toBe("From Child");
  });

  it("Text[slot='description'] 또는 Description element → description", () => {
    const lbi = el("lb-1", "ListBoxItem", "parent", 0, { label: "Apple" });
    const desc = el("d-1", "Text", "lb-1", 0, {
      slot: "description",
      children: "빨간 과일",
    });
    const childrenByParent = new Map<string, E[]>([["lb-1", [desc]]]);
    const items = listBoxItemChildrenToItemsArray([lbi], childrenByParent);
    expect(items[0].description).toBe("빨간 과일");
  });

  it("Description element (tag) 도 description 으로 인식", () => {
    const lbi = el("lb-1", "ListBoxItem", "parent", 0, { label: "Apple" });
    const desc = el("d-1", "Description", "lb-1", 0, {
      children: "과일 설명",
    });
    const childrenByParent = new Map<string, E[]>([["lb-1", [desc]]]);
    const items = listBoxItemChildrenToItemsArray([lbi], childrenByParent);
    expect(items[0].description).toBe("과일 설명");
  });

  it("source order 기준 정렬", () => {
    const a = el("lb-a", "ListBoxItem", "p", 2, { label: "Third" });
    const b = el("lb-b", "ListBoxItem", "p", 0, { label: "First" });
    const c = el("lb-c", "ListBoxItem", "p", 1, { label: "Second" });
    const items = listBoxItemChildrenToItemsArray(
      [a, b, c],
      new Map<string, E[]>(),
    );
    expect(items.map((it) => it.label)).toEqual(["Third", "First", "Second"]);
  });
});

describe("applyCollectionItemsMigration — ListBox 정적 모드 (ADR-076 P5)", () => {
  it("ListBoxItem 전부 정적 → items[] 흡수 + orphan + subtree DFS", () => {
    const elements: E[] = [
      el("lb-parent", "ListBox", null, 0, {}),
      el("lbi-1", "ListBoxItem", "lb-parent", 0, { label: "Apple" }),
      el("lbi-2", "ListBoxItem", "lb-parent", 1, {}),
      // lbi-2 자식: Text + Description
      el("txt-2", "Text", "lbi-2", 0, { children: "Banana" }),
      el("desc-2", "Description", "lbi-2", 1, { children: "노란 과일" }),
    ];
    const { migratedElements, orphanIds } =
      applyCollectionItemsMigration(elements);

    // 부모만 살아있음
    expect(migratedElements.map((e) => e.id)).toEqual(["lb-parent"]);
    // items[] 복원
    const parent = migratedElements[0];
    const items = parent.props.items as Array<{
      id: string;
      label: string;
      description?: string;
    }>;
    expect(items).toHaveLength(2);
    expect(items[0]).toMatchObject({ id: "lbi-1", label: "Apple" });
    expect(items[1]).toMatchObject({
      id: "lbi-2",
      label: "Banana",
      description: "노란 과일",
    });
    // orphan: ListBoxItem + 자식 subtree 전부
    expect(orphanIds.sort()).toEqual(["desc-2", "lbi-1", "lbi-2", "txt-2"]);
  });

  it("selectedIndex → selectedKey 변환 (canonical 없을 때)", () => {
    const elements: E[] = [
      el("lb", "ListBox", null, 0, { selectedIndex: 1 }),
      el("lbi-0", "ListBoxItem", "lb", 0, { label: "A" }),
      el("lbi-1", "ListBoxItem", "lb", 1, { label: "B" }),
    ];
    const { migratedElements } = applyCollectionItemsMigration(elements);
    const parent = migratedElements[0];
    expect(parent.props.selectedKey).toBe("lbi-1");
    // legacy 필드는 그대로 유지 (BC)
    expect(parent.props.selectedIndex).toBe(1);
  });

  it("selectedIndices → selectedKeys 변환 + out-of-range 필터", () => {
    const elements: E[] = [
      el("lb", "ListBox", null, 0, { selectedIndices: [0, 2, 99] }),
      el("lbi-0", "ListBoxItem", "lb", 0, { label: "A" }),
      el("lbi-1", "ListBoxItem", "lb", 1, { label: "B" }),
      el("lbi-2", "ListBoxItem", "lb", 2, { label: "C" }),
    ];
    const { migratedElements } = applyCollectionItemsMigration(elements);
    const parent = migratedElements[0];
    expect(parent.props.selectedKeys).toEqual(["lbi-0", "lbi-2"]);
  });

  it("canonical selectedKey 있으면 legacy selectedIndex 무시", () => {
    const elements: E[] = [
      el("lb", "ListBox", null, 0, {
        selectedKey: "lbi-custom",
        selectedIndex: 0,
      }),
      el("lbi-0", "ListBoxItem", "lb", 0, { label: "A" }),
    ];
    const { migratedElements } = applyCollectionItemsMigration(elements);
    const parent = migratedElements[0];
    expect(parent.props.selectedKey).toBe("lbi-custom");
  });
});

describe("applyCollectionItemsMigration — ListBox 템플릿 모드 (ADR-076 P5)", () => {
  it("자식 ListBoxItem 중 하나라도 Field 보유 → 부모 전체 skip", () => {
    const elements: E[] = [
      el("lb", "ListBox", null, 0, { columnMapping: { columns: ["c1"] } }),
      el("lbi-template", "ListBoxItem", "lb", 0, {}),
      el("field-1", "Field", "lbi-template", 0, { key: "c1" }),
    ];
    const { migratedElements, orphanIds } =
      applyCollectionItemsMigration(elements);
    // element tree 전부 유지
    expect(migratedElements.map((e) => e.id).sort()).toEqual(
      ["field-1", "lb", "lbi-template"].sort(),
    );
    expect(orphanIds).toEqual([]);
    // 부모 props 에 items 주입 안 됨
    const parent = migratedElements.find((e) => e.id === "lb")!;
    expect(parent.props.items).toBeUndefined();
  });

  it("혼합 부모 (정적 + 템플릿 공존) → 부모 단위 원자 skip", () => {
    const elements: E[] = [
      el("lb", "ListBox", null, 0, {}),
      // 정적 ListBoxItem
      el("lbi-static", "ListBoxItem", "lb", 0, { label: "Static" }),
      // 템플릿 ListBoxItem (Field 자식)
      el("lbi-template", "ListBoxItem", "lb", 1, {}),
      el("field-x", "Field", "lbi-template", 0, { key: "x" }),
    ];
    const { migratedElements, orphanIds } =
      applyCollectionItemsMigration(elements);
    // 전부 유지 — 정적 자식도 흡수되지 않음 (부모 원자성)
    expect(migratedElements).toHaveLength(4);
    expect(orphanIds).toEqual([]);
    const parent = migratedElements.find((e) => e.id === "lb")!;
    expect(parent.props.items).toBeUndefined();
  });
});

describe("applyCollectionItemsMigration — Idempotency + 3종 공존", () => {
  it("재실행 시 no-op (자식 없음)", () => {
    const elements: E[] = [
      el("lb", "ListBox", null, 0, {
        items: [{ id: "x", label: "X" }],
      }),
    ];
    const result1 = applyCollectionItemsMigration(elements);
    expect(result1.orphanIds).toEqual([]);
    expect(result1.migratedElements[0].props.items).toEqual([
      { id: "x", label: "X" },
    ]);

    const result2 = applyCollectionItemsMigration(result1.migratedElements);
    expect(result2.orphanIds).toEqual([]);
    expect(result2.migratedElements).toEqual(result1.migratedElements);
  });

  it("Select + ComboBox + ListBox 3종 단일 pass 에 공존", () => {
    const elements: E[] = [
      el("sel", "Select", null, 0, {}),
      el("sel-i", "SelectItem", "sel", 0, { label: "S1" }),
      el("cb", "ComboBox", null, 1, {}),
      el("cb-i", "ComboBoxItem", "cb", 0, { label: "C1" }),
      el("lb", "ListBox", null, 2, {}),
      el("lb-i", "ListBoxItem", "lb", 0, { label: "L1" }),
    ];
    const { migratedElements, orphanIds } =
      applyCollectionItemsMigration(elements);
    expect(migratedElements.map((e) => e.id).sort()).toEqual(
      ["cb", "lb", "sel"].sort(),
    );
    expect(orphanIds.sort()).toEqual(["cb-i", "lb-i", "sel-i"]);
    const selEl = migratedElements.find((e) => e.id === "sel")!;
    const cbEl = migratedElements.find((e) => e.id === "cb")!;
    const lbEl = migratedElements.find((e) => e.id === "lb")!;
    expect((selEl.props.items as Array<{ id: string }>)[0].id).toBe("sel-i");
    expect((cbEl.props.items as Array<{ id: string }>)[0].id).toBe("cb-i");
    expect((lbEl.props.items as Array<{ id: string }>)[0].id).toBe("lb-i");
  });

  it("마이그레이션 대상 없음 → 원본 그대로 반환", () => {
    const elements: E[] = [el("div", "div", null, 0, {})];
    const result = applyCollectionItemsMigration(elements);
    expect(result.migratedElements).toBe(elements);
    expect(result.orphanIds).toEqual([]);
  });
});

describe("tagChildrenToItemsArray (ADR-097 Phase 2)", () => {
  it("Tag props.children → label + source order 정렬 + boolean 플래그", () => {
    const a = el("t-a", "Tag", "tl", 2, { children: "Third" });
    const b = el("t-b", "Tag", "tl", 0, {
      children: "First",
      isDisabled: true,
    });
    const c = el("t-c", "Tag", "tl", 1, {
      children: "Second",
      allowsRemoving: false,
    });
    const items = tagChildrenToItemsArray([a, b, c]);
    expect(items).toEqual([
      {
        id: "t-a",
        label: "Third",
        isDisabled: undefined,
        allowsRemoving: undefined,
      },
      {
        id: "t-b",
        label: "First",
        isDisabled: true,
        allowsRemoving: undefined,
      },
      {
        id: "t-c",
        label: "Second",
        isDisabled: undefined,
        allowsRemoving: false,
      },
    ]);
  });

  it("props.children 부재 → id 를 label fallback", () => {
    const tag = el("tag-no-children", "Tag", "tl", 0, {});
    const items = tagChildrenToItemsArray([tag]);
    expect(items[0].label).toBe("tag-no-children");
  });
});

describe("applyCollectionItemsMigration — TagGroup 2단 이전 (ADR-097 P2)", () => {
  it("TagGroup > TagList > Tag[3] → TagGroup.items[3] 흡수 + Tag orphan + TagList 유지", () => {
    const elements: E[] = [
      el("tg-parent", "TagGroup", null, 0, {}),
      el("tl-mid", "TagList", "tg-parent", 0, {}),
      el("tag-1", "Tag", "tl-mid", 0, { children: "Primary" }),
      el("tag-2", "Tag", "tl-mid", 1, {
        children: "Secondary",
        isDisabled: true,
      }),
      el("tag-3", "Tag", "tl-mid", 2, { children: "Tertiary" }),
    ];

    const { migratedElements, orphanIds } =
      applyCollectionItemsMigration(elements);

    // TagGroup props.items 3 건 주입 확인
    const tgEl = migratedElements.find((e) => e.id === "tg-parent")!;
    expect(tgEl).toBeDefined();
    const items = tgEl.props.items as Array<{
      id: string;
      label: string;
      isDisabled?: boolean;
    }>;
    expect(items).toHaveLength(3);
    expect(items.map((i) => i.label)).toEqual([
      "Primary",
      "Secondary",
      "Tertiary",
    ]);
    expect(items[1].isDisabled).toBe(true);

    // TagList 는 유지, Tag 3 건 orphan
    const tlEl = migratedElements.find((e) => e.id === "tl-mid")!;
    expect(tlEl).toBeDefined();
    expect(orphanIds.sort()).toEqual(["tag-1", "tag-2", "tag-3"].sort());
    expect(migratedElements.find((e) => e.id === "tag-1")).toBeUndefined();

    // ADR-097 Phase 4A: TagList 에도 items propagation 주입 확인 (Skia 경로 필수)
    const tlItems = tlEl.props.items as Array<{ id: string; label: string }>;
    expect(tlItems).toBeDefined();
    expect(tlItems).toHaveLength(3);
    expect(tlItems.map((i) => i.label)).toEqual([
      "Primary",
      "Secondary",
      "Tertiary",
    ]);
  });

  it("TagGroup > TagList (Tag 없음) → items 주입 skip + TagList 유지 + orphan 0", () => {
    const elements: E[] = [
      el("tg-empty", "TagGroup", null, 0, {}),
      el("tl-empty", "TagList", "tg-empty", 0, {}),
    ];

    const { migratedElements, orphanIds } =
      applyCollectionItemsMigration(elements);

    // TagGroup / TagList 전부 유지, items 미주입
    expect(migratedElements).toHaveLength(2);
    const tgEl = migratedElements.find((e) => e.id === "tg-empty")!;
    expect(tgEl.props.items).toBeUndefined();
    expect(orphanIds).toEqual([]);
  });

  it("TagList 부재 + Tag 가 직접 TagGroup 자식 → Tag 유지 + items 미주입 (BC 보호)", () => {
    // 기존 프로젝트에 이 형태는 없으나 defensive programming 방어 테스트.
    //   Tag parent_id 가 TagList ID 가 아닌 경우 (deformed data):
    //   - tagListIdToTagGroupId 에 parent_id 없음 → orphan 수집 skip
    //   - tagGroupItemsById 에 "tg-odd" 없음 → items 미주입
    //   - Tag element 는 migratedElements 에 유지되어 데이터 손실 없음.
    const elements: E[] = [
      el("tg-odd", "TagGroup", null, 0, {}),
      el("tag-odd", "Tag", "tg-odd", 0, { children: "Orphan Tag" }),
    ];

    const { migratedElements, orphanIds } =
      applyCollectionItemsMigration(elements);

    // Tag 는 orphan 되지 않음 — BC 보호
    expect(orphanIds).not.toContain("tag-odd");
    // TagGroup / Tag 모두 migratedElements 에 유지
    expect(migratedElements).toHaveLength(2);
    expect(migratedElements.find((e) => e.id === "tag-odd")).toBeDefined();
    // TagGroup items 미주입 (TagList 부재로 수집 대상 없음)
    const tgEl = migratedElements.find((e) => e.id === "tg-odd")!;
    expect(tgEl.props.items).toBeUndefined();
  });

  // ADR-097 Phase 4A: 이미 마이그레이션된 프로젝트 재로드 — TagGroup.items 는 존재하지만
  // TagList.items 가 비어있는 상태. 이전 버전 migration 은 TagList 에 items propagation
  // 을 수행하지 않았으므로, 재로드 시 이 상태로 들어옴. 새 로직은 short-circuit 직전
  // 2차 pass 로 TagList 에 items propagation 을 주입해야 함 (Skia chip 렌더 필수).
  it("이미 마이그레이션 완료 (Tag 없음 + TagGroup.items 존재) → TagList 에 items propagation 주입", () => {
    const preMigratedItems = [
      { id: "t1", label: "Already" },
      { id: "t2", label: "Migrated" },
    ];
    const elements: E[] = [
      el("tg-done", "TagGroup", null, 0, { items: preMigratedItems }),
      el("tl-done", "TagList", "tg-done", 0, {}),
    ];

    const { migratedElements, orphanIds } =
      applyCollectionItemsMigration(elements);

    expect(orphanIds).toEqual([]);
    expect(migratedElements).toHaveLength(2);

    const tgEl = migratedElements.find((e) => e.id === "tg-done")!;
    expect(tgEl.props.items).toEqual(preMigratedItems);

    const tlEl = migratedElements.find((e) => e.id === "tl-done")!;
    const tlItems = tlEl.props.items as Array<{ id: string; label: string }>;
    expect(tlItems).toBeDefined();
    expect(tlItems).toHaveLength(2);
    expect(tlItems.map((i) => i.label)).toEqual(["Already", "Migrated"]);
  });

  // 이미 TagList 에 items 가 있는 상태 (신버전에서 저장된 프로젝트) 는 그대로 유지.
  it("TagList.items 이미 존재 → 중복 주입 없이 원본 유지", () => {
    const existingTlItems = [{ id: "t1", label: "Existing TL" }];
    const tgItems = [{ id: "t1", label: "Different TG" }];
    const elements: E[] = [
      el("tg-x", "TagGroup", null, 0, { items: tgItems }),
      el("tl-x", "TagList", "tg-x", 0, { items: existingTlItems }),
    ];

    const { migratedElements } = applyCollectionItemsMigration(elements);
    const tlEl = migratedElements.find((e) => e.id === "tl-x")!;
    // 기존 items 유지 (deformed/intentional override 보호).
    expect(tlEl.props.items).toEqual(existingTlItems);
  });
});
