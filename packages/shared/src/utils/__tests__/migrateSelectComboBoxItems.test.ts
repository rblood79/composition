import { describe, it, expect } from "vitest";
import {
  selectItemChildrenToItemsArray,
  comboBoxItemChildrenToItemsArray,
  applySelectComboBoxMigration,
} from "../migrateSelectComboBoxItems";

// ADR-073 P5: migration util 단위 테스트

interface ElementLike {
  id: string;
  type: string;
  parent_id: string | null;
  order_num: number;
  props: Record<string, unknown>;
}

describe("selectItemChildrenToItemsArray (ADR-073 P5)", () => {
  it("SelectItem child elements → StoredSelectItem[]", () => {
    const children: ElementLike[] = [
      {
        id: "si-1",
        type: "SelectItem",
        parent_id: "sel-1",
        order_num: 0,
        props: { label: "Apple", value: "APPLE", isDisabled: false },
      },
      {
        id: "si-2",
        type: "SelectItem",
        parent_id: "sel-1",
        order_num: 1,
        props: { label: "Banana", value: "BANANA", isDisabled: true },
      },
    ];
    const items = selectItemChildrenToItemsArray(children);
    expect(items).toHaveLength(2);
    expect(items[0]).toMatchObject({
      id: "si-1",
      label: "Apple",
      value: "APPLE",
    });
    expect(items[1]).toMatchObject({
      id: "si-2",
      label: "Banana",
      value: "BANANA",
      isDisabled: true,
    });
  });

  it("빈 배열 → 빈 배열", () => {
    expect(selectItemChildrenToItemsArray([])).toEqual([]);
  });

  it("source order 기준 정렬 보존", () => {
    const children: ElementLike[] = [
      {
        id: "b",
        type: "SelectItem",
        parent_id: "sel",
        order_num: 2,
        props: { label: "B" },
      },
      {
        id: "a",
        type: "SelectItem",
        parent_id: "sel",
        order_num: 0,
        props: { label: "A" },
      },
    ];
    const items = selectItemChildrenToItemsArray(children);
    expect(items.map((item) => item.id)).toEqual(["b", "a"]);
  });

  it("label 누락 시 id 로 fallback", () => {
    const children: ElementLike[] = [
      {
        id: "x",
        type: "SelectItem",
        parent_id: "sel",
        order_num: 0,
        props: {},
      },
    ];
    expect(selectItemChildrenToItemsArray(children)[0]).toMatchObject({
      id: "x",
      label: "x",
    });
  });
});

describe("comboBoxItemChildrenToItemsArray (ADR-073 P5)", () => {
  it("ComboBoxItem child elements → StoredComboBoxItem[]", () => {
    const children: ElementLike[] = [
      {
        id: "ci-1",
        type: "ComboBoxItem",
        parent_id: "cb-1",
        order_num: 0,
        props: { label: "Apple", value: "APPLE", isDisabled: false },
      },
      {
        id: "ci-2",
        type: "ComboBoxItem",
        parent_id: "cb-1",
        order_num: 1,
        props: { label: "Banana", value: "BANANA", isDisabled: true },
      },
    ];
    const items = comboBoxItemChildrenToItemsArray(children);
    expect(items).toHaveLength(2);
    expect(items[0]).toMatchObject({
      id: "ci-1",
      label: "Apple",
      value: "APPLE",
    });
    expect(items[1]).toMatchObject({
      id: "ci-2",
      label: "Banana",
      value: "BANANA",
      isDisabled: true,
    });
  });

  it("빈 배열 → 빈 배열", () => {
    expect(comboBoxItemChildrenToItemsArray([])).toEqual([]);
  });

  it("source order 기준 정렬 보존", () => {
    const children: ElementLike[] = [
      {
        id: "b",
        type: "ComboBoxItem",
        parent_id: "cb",
        order_num: 2,
        props: { label: "B" },
      },
      {
        id: "a",
        type: "ComboBoxItem",
        parent_id: "cb",
        order_num: 0,
        props: { label: "A" },
      },
    ];
    const items = comboBoxItemChildrenToItemsArray(children);
    expect(items.map((item) => item.id)).toEqual(["b", "a"]);
  });

  it("label 누락 시 id 로 fallback", () => {
    const children: ElementLike[] = [
      {
        id: "y",
        type: "ComboBoxItem",
        parent_id: "cb",
        order_num: 0,
        props: {},
      },
    ];
    expect(comboBoxItemChildrenToItemsArray(children)[0]).toMatchObject({
      id: "y",
      label: "y",
    });
  });
});

describe("applySelectComboBoxMigration (ADR-073 P6-e)", () => {
  it("Select/ComboBox 자식 없음 → 원본 그대로, orphanIds 빈 배열", () => {
    const elements: ElementLike[] = [
      { id: "body", type: "body", parent_id: null, order_num: 0, props: {} },
      { id: "sel", type: "Select", parent_id: "body", order_num: 1, props: {} },
    ];
    const result = applySelectComboBoxMigration(elements);
    expect(result.orphanIds).toEqual([]);
    expect(result.migratedElements).toEqual(elements);
  });

  it("Select + SelectItem 자식 2개 → items[] 주입 + orphan 2건 반환", () => {
    const elements: ElementLike[] = [
      { id: "sel", type: "Select", parent_id: null, order_num: 0, props: {} },
      {
        id: "si-1",
        type: "SelectItem",
        parent_id: "sel",
        order_num: 0,
        props: { label: "A" },
      },
      {
        id: "si-2",
        type: "SelectItem",
        parent_id: "sel",
        order_num: 1,
        props: { label: "B" },
      },
    ];
    const result = applySelectComboBoxMigration(elements);
    expect(result.orphanIds).toEqual(["si-1", "si-2"]);
    expect(result.migratedElements).toHaveLength(1);
    const sel = result.migratedElements[0];
    expect(sel.id).toBe("sel");
    expect((sel.props.items as Array<{ id: string }>).map((i) => i.id)).toEqual(
      ["si-1", "si-2"],
    );
  });

  it("ComboBox + ComboBoxItem 혼합 — 각 부모별 독립 items 주입", () => {
    const elements: ElementLike[] = [
      { id: "cb1", type: "ComboBox", parent_id: null, order_num: 0, props: {} },
      { id: "cb2", type: "ComboBox", parent_id: null, order_num: 1, props: {} },
      {
        id: "ci-1",
        type: "ComboBoxItem",
        parent_id: "cb1",
        order_num: 0,
        props: { label: "X" },
      },
      {
        id: "ci-2",
        type: "ComboBoxItem",
        parent_id: "cb2",
        order_num: 0,
        props: { label: "Y" },
      },
    ];
    const result = applySelectComboBoxMigration(elements);
    expect(result.orphanIds.sort()).toEqual(["ci-1", "ci-2"]);
    expect(result.migratedElements).toHaveLength(2);
    const cb1 = result.migratedElements.find((el) => el.id === "cb1")!;
    const cb2 = result.migratedElements.find((el) => el.id === "cb2")!;
    expect((cb1.props.items as Array<{ label: string }>)[0].label).toBe("X");
    expect((cb2.props.items as Array<{ label: string }>)[0].label).toBe("Y");
  });

  it("기존 부모 props 보존 + items 주입", () => {
    const elements: ElementLike[] = [
      {
        id: "sel",
        type: "Select",
        parent_id: null,
        order_num: 0,
        props: { label: "Pick", placeholder: "..." },
      },
      {
        id: "si",
        type: "SelectItem",
        parent_id: "sel",
        order_num: 0,
        props: { label: "A" },
      },
    ];
    const result = applySelectComboBoxMigration(elements);
    const sel = result.migratedElements[0];
    expect(sel.props.label).toBe("Pick");
    expect(sel.props.placeholder).toBe("...");
    expect((sel.props.items as unknown[]).length).toBe(1);
  });
});
