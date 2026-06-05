import { describe, expect, it } from "vitest";

import { getPrimitiveBinding } from "../bindings";
import {
  getCatalogCutoverTypes,
  getCatalogEntry,
  getCatalogSkiaCutoverTypes,
} from "../componentCatalog";
import { toRacProps } from "../outputs/toRacProps";

/**
 * ADR-142 family ④(collections) — ListBox/Menu/Select/ComboBox/Tabs/TagGroup/GridList 계약 검증.
 *
 * collection 은 composition wrapper(useCollectionData, ADR-132)가 D1 담당 → `source.kind:"internal"`.
 * **DOM cutover (catalog generic)**: DOM/Inspector 는 catalog generic(wrapper + items) 전부 발효.
 *
 * **ADR-912 단계 4 + 5 step 1 (2026-06-04) — Skia generic 전부 발효 (skiaLegacy 0건)**:
 * ListBox proof(2026-06-03) → 나머지 6(Menu/Select/ComboBox/Tabs/TagGroup/GridList) + Table 동형
 * projection 으로 발효. shell 은 buildCatalogShapes, data row 는 row projection(canvasSceneNode)
 * 별도 경로. skiaLegacy 필드는 단계 5 step 1 에서 제거됨 → Skia 게이트 = DOM 게이트.
 */

/** family ④ 전체 — DOM·Skia cutover + internal source 공통 검증. */
const COLLECTION_TYPES = [
  "ListBox",
  "Menu",
  "Select",
  "ComboBox",
  "Tabs",
  "TagGroup",
  "GridList",
] as const;

describe("family ④ collections — catalog 등록 + DOM cutover", () => {
  it("7 collection 이 모두 catalog primitive entry (family=collections, cutover=catalog)", () => {
    for (const type of COLLECTION_TYPES) {
      const entry = getCatalogEntry(type);
      expect(entry, `${type} catalog entry`).toBeDefined();
      expect(entry?.kind).toBe("primitive");
      expect(entry?.family).toBe("collections");
      expect((entry as { cutover?: string } | undefined)?.cutover).toBe(
        "catalog",
      );
    }
  });

  it("7 collection entry 에 skiaLegacy 속성 0건 (단계 5 step 1 — 필드 제거)", () => {
    for (const type of COLLECTION_TYPES) {
      expect(
        (getCatalogEntry(type) as { skiaLegacy?: boolean })?.skiaLegacy,
        `${type} skiaLegacy undefined`,
      ).toBeUndefined();
    }
  });

  it("DOM·Skia 게이트(getCatalogCutoverTypes/SkiaCutoverTypes)는 7 collection 전부 포함", () => {
    const domGate = getCatalogCutoverTypes();
    const skiaGate = getCatalogSkiaCutoverTypes();
    for (const type of COLLECTION_TYPES) {
      expect(domGate.has(type), `${type} in DOM gate`).toBe(true);
      // ADR-912 단계 4 + 5 step 1: 7 collection 전부 Skia generic 발효.
      expect(skiaGate.has(type), `${type} in Skia gate`).toBe(true);
    }
  });

  it("collection binding 은 internal source (composition wrapper) + skiaPrimitive 없음", () => {
    for (const type of COLLECTION_TYPES) {
      const binding = getPrimitiveBinding(type);
      expect(binding?.source.kind, `${type} source`).toBe("internal");
      expect(
        binding?.skiaPrimitive,
        `${type} no skiaPrimitive`,
      ).toBeUndefined();
    }
  });
});

describe("family ④ collections — toRacProps 변환 (dataBinding 통과)", () => {
  it("ListBox: dataBinding(kind:binding)을 wrapper 에 통과 + size data-* 라우팅", () => {
    const dataBinding = { source: "users", name: "userList" };
    const result = toRacProps(
      {
        id: "lb1",
        type: "ListBox",
        props: { dataBinding, size: "lg", selectionMode: "multiple" },
      },
      getPrimitiveBinding("ListBox")!,
    );
    // dataBinding 은 RAC props 아님(kind:binding) → 그대로 통과(wrapper useCollectionData 소비)
    expect(result.dataBinding).toEqual(dataBinding);
    expect(result.selectionMode).toBe("multiple");
    expect(result["data-size"]).toBe("lg");
  });

  it("Select: label/placeholder 통과 + dataBinding 통과", () => {
    const result = toRacProps(
      {
        id: "sel1",
        type: "Select",
        props: {
          label: "Country",
          placeholder: "Pick one",
          dataBinding: { source: "c", name: "countries" },
        },
      },
      getPrimitiveBinding("Select")!,
    );
    expect(result.label).toBe("Country");
    expect(result.placeholder).toBe("Pick one");
    expect(result.dataBinding).toEqual({ source: "c", name: "countries" });
  });

  it("Select: 정적 items[](StoredSelectItem[]) pass-through (ADR-912 Task 6)", () => {
    // items 미선언 시 toRacProps 가 props.items 를 drop → wrapper 가 정적 source 못 봄.
    // Select.binding.ts items accepts 추가로 GridList/ListBox 와 동형 통과 검증.
    const items = [
      { id: "a", label: "A" },
      { id: "b", label: "B" },
    ];
    const result = toRacProps(
      {
        id: "sel2",
        type: "Select",
        props: { items, placeholder: "Pick" },
      },
      getPrimitiveBinding("Select")!,
    );
    expect(result.items).toEqual(items);
    expect(result.placeholder).toBe("Pick");
  });

  it("ComboBox: 정적 items[](StoredComboBoxItem[]) pass-through (ADR-912 Task 7)", () => {
    // items 미선언 시 toRacProps 가 props.items 를 drop → wrapper 가 정적 source 못 봄.
    // ComboBox.binding.ts items accepts 추가로 Select/GridList/ListBox 와 동형 통과 검증.
    const items = [
      { id: "x", label: "X" },
      { id: "y", label: "Y" },
    ];
    const result = toRacProps(
      {
        id: "cb1",
        type: "ComboBox",
        props: { items, placeholder: "Search" },
      },
      getPrimitiveBinding("ComboBox")!,
    );
    expect(result.items).toEqual(items);
    expect(result.placeholder).toBe("Search");
  });

  it("Tabs: orientation/variant data-* 라우팅", () => {
    const result = toRacProps(
      {
        id: "t1",
        type: "Tabs",
        props: { variant: "default", orientation: "vertical" },
      },
      getPrimitiveBinding("Tabs")!,
    );
    expect(result["data-variant"]).toBe("default");
    expect(result.orientation).toBe("vertical");
  });
});
