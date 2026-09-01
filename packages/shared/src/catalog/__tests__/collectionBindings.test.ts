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
 * ADR-923 r21m1 (2026-09-02) — Table 높이 축의 registry 다리.
 *
 * `Table.tsx` 는 `heightMode`(fixed/auto/viewport/full) × `height` 로 가상화 영역 높이를 정하고
 * layout(`implicitStyles` Table 분기)도 같은 두 prop 을 읽는데, binding accepts 선언이 없어 cutover
 * 렌더러가 둘 다 전달하지 않았다 → live Preview 는 항상 컴포넌트 기본값(fixed 400 → border-box 402)
 * 이라 Inspector·AI writer 가 써도 화면이 안 바뀌고(dead writer), `heightMode: "auto"` 로 둔 빈
 * Table 이 DOM 402 vs layout 40(수동 `Table.css min-height: 40px`) 으로 갈렸다. r18m1 Disclosure
 * `title` 과 같은 형태 — 선언 없는 prop 은 소비 경로가 없다.
 */
describe("ADR-923 r21m1 — Table 높이 prop 이 cutover 렌더러에 도달한다", () => {
  it("binding accepts 에 heightMode/height 선언 (Inspector writer + Preview 소비 경로)", () => {
    const binding = getPrimitiveBinding("Table")!;
    expect(binding.props.accepts.heightMode).toBeDefined();
    expect(binding.props.accepts.heightMode?.default).toBe("fixed");
    expect(
      binding.props.accepts.heightMode?.options?.map((o) => o.value),
    ).toEqual(["fixed", "auto", "viewport", "full"]);
    expect(binding.props.accepts.height).toBeDefined();
    expect(binding.props.accepts.height?.kind).toBe("number");
  });

  it("toRacProps: heightMode/height 를 그대로 전달 (컴포넌트 기본값 fixed 400 고정 해소)", () => {
    const result = toRacProps(
      {
        id: "tbl1",
        type: "Table",
        props: { heightMode: "auto", height: 240 },
      } as never,
      getPrimitiveBinding("Table")!,
    ) as Record<string, unknown>;
    expect(result.heightMode).toBe("auto");
    expect(result.height).toBe(240);
  });
});
