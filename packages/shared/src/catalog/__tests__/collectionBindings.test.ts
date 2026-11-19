import { describe, expect, it } from "vitest";

import { getPrimitiveBinding } from "../bindings";
import { getCatalogCutoverTypes, getCatalogEntry } from "../componentCatalog";
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

  it("cutover 게이트(getCatalogCutoverTypes)는 7 collection 전부 포함", () => {
    const gate = getCatalogCutoverTypes();
    for (const type of COLLECTION_TYPES) {
      // ADR-912 단계 4 + 5 step 1: 7 collection 전부 generic 발효 (단일 게이트).
      expect(gate.has(type), `${type} in cutover gate`).toBe(true);
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
        props: { dataBinding, size: "L", selectionMode: "multiple" },
      },
      getPrimitiveBinding("ListBox")!,
    );
    // dataBinding 은 RAC props 아님(kind:binding) → 그대로 통과(wrapper useCollectionData 소비)
    expect(result.dataBinding).toEqual(dataBinding);
    expect(result.selectionMode).toBe("multiple");
    expect(result["data-size"]).toBe("L");
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

  it.each(["Select", "ComboBox"])(
    "%s: 옛 정적 items[] 는 통과하지 않는다 — 항목은 slot 노드 또는 dataBinding (2026-10-09)",
    (type) => {
      // 사용자 「slot 방식과 data binding 방식만 사용하는것이 레퍼런스에 맞는 방법」: RAC collection
      //   은 정적 (JSX 자식) · 동적 (items + 그리는 함수) 둘뿐 — 옛 inline items-manager 는 삭제.
      const result = toRacProps(
        {
          id: "c1",
          type,
          props: { items: [{ id: "a", label: "A" }], placeholder: "Pick" },
        },
        getPrimitiveBinding(type)!,
      );
      expect(result).not.toHaveProperty("items");
      expect(result.placeholder).toBe("Pick");
    },
  );

  it("Tabs: orientation 라우팅 — variant 축 없음 (S2 · RAC · v3 Tabs 에 없음, 2026-10-12)", () => {
    const result = toRacProps(
      {
        id: "t1",
        type: "Tabs",
        props: { variant: "default", orientation: "vertical" },
      },
      getPrimitiveBinding("Tabs")!,
    );
    expect(result).not.toHaveProperty("data-variant");
    expect(result.orientation).toBe("vertical");
  });

  it("TagGroup: labelPosition accepts 노출, orientation 은 제거됨 (D2)", () => {
    // 그룹↔라벨 배치는 RSP 표준 labelPosition(top/side)만 사용. orientation 은
    //   RAC/RSP TagGroup 어디에도 없는 non-standard prop(DOM RAC 무시 → Skia 만 vertical
    //   반영해 CSS↔Skia 비대칭)이라 2026-07-01 전수 제거(binding accepts / TagGroup.tsx
    //   타입 / implicitStyles override / CollectionRenderers 전달). chip 배치는 항상 row+wrap.
    const binding = getPrimitiveBinding("TagGroup")!;
    // (1) binding accepts 에 labelPosition 노출 (Property 패널 편집 surface)
    expect(binding.props.accepts.labelPosition).toBeDefined();
    expect(binding.props.accepts.labelPosition?.label).toBe("Label Position");
    // (2) orientation accepts 제거 — Property 패널에 dead 편집 UI 없음 (D2 위반 해소)
    expect(binding.props.accepts.orientation).toBeUndefined();
    // (3) toRacProps 는 labelPosition 을 data-* 로 라우팅(label-layout hint, raw 누출 차단,
    //   2026-07-22), orientation 은 accepts 미선언이라 drop
    const result = toRacProps(
      {
        id: "tg1",
        type: "TagGroup",
        props: { labelPosition: "side", orientation: "vertical" },
      },
      binding,
    );
    expect(result["data-label-position"]).toBe("side");
    expect(result.labelPosition).toBeUndefined();
    expect(result.orientation).toBeUndefined();
  });

  it("TagGroup: maxRows accepts 노출 (RSP number, Property 패널 편집 surface)", () => {
    // maxRows(RSP TagGroup 표준 — 지정 행 수 초과 tag 접기 + "Show all")는 factory default
    //   maxRows:2 로 store 에 저장되나 accepts 부재로 Property 패널 편집 UI 가 없었다(2026-07-01
    //   전 누락). number accepts 추가로 편집 진입점 노출. DOM(TagGroup.tsx)은 이미 maxRows 소비.
    const binding = getPrimitiveBinding("TagGroup")!;
    expect(binding.props.accepts.maxRows).toBeDefined();
    expect(binding.props.accepts.maxRows?.kind).toBe("number");
    expect(binding.props.accepts.maxRows?.label).toBe("Max Rows");
    // toRacProps 는 maxRows 를 wrapper 로 통과 (TagGroup.tsx 가 소비).
    const result = toRacProps(
      { id: "tg2", type: "TagGroup", props: { maxRows: 3 } },
      binding,
    );
    expect(result.maxRows).toBe(3);
  });
});

/**
 * 사용자 결정 2026-11-19 — the Table has no height props: its height is the Styles height (S2 takes
 * it by `styles`). ADR-923 r21m1 had declared `heightMode` (fixed · auto · viewport · full) ×
 * `height`; only "fixed" was ever read, and an authored Styles height already won over `height`.
 */
describe("Table 높이 prop 없음 — 높이는 Styles 높이 하나", () => {
  it("binding accepts 에 heightMode · height 가 없고 toRacProps 도 채우지 않는다", () => {
    const binding = getPrimitiveBinding("Table")!;
    expect(binding.props.accepts.heightMode).toBeUndefined();
    expect(binding.props.accepts.height).toBeUndefined();
    const result = toRacProps(
      { id: "tbl1", type: "Table", props: {} } as never,
      binding,
    ) as Record<string, unknown>;
    expect(result.heightMode).toBeUndefined();
    expect(result.height).toBeUndefined();
  });
});
