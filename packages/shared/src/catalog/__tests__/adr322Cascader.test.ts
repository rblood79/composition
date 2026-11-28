import { describe, expect, it } from "vitest";
import { getPrimitiveBinding } from "../bindings";
import { CASCADER_TEMPLATES } from "../document/cascaderOrigins";
import { CATALOG_D2_COMPOSITION_TYPES } from "../document/d2Provenance";
import { checkCapabilityConstraints } from "../../interactions/constraints";
import {
  cascaderDescriptionText,
  cascaderNotice,
  cascaderTable,
  cascaderValueMatch,
  cascaderValueRefusal,
  cascaderValueText,
  type CascaderSourceItem,
} from "../runtime/cascader";
import { cascaderSearch } from "../runtime/cascaderSearch.components";

/**
 * ADR-322 Phase 1 — the item table (breakdown §4.2) and the closed field's text (decision 7). The
 * expected path ids · texts are written out by hand from the inputs, not from the functions.
 */
const leaf = (key: string, name = key): CascaderSourceItem => ({ key, name });
const REGIONS: CascaderSourceItem[] = [
  {
    key: "11",
    name: "서울",
    children: [
      {
        key: "680",
        name: "강남구",
        children: [leaf("6801", "역삼동"), leaf("6802", "삼성동")],
      },
      { key: "140", name: "중구", children: [leaf("1401", "명동")] },
    ],
  },
  {
    key: "26",
    name: "부산",
    children: [
      { key: "110", name: "중구", children: [leaf("1101", "남포동")] },
    ],
  },
  leaf("36", "세종"),
];
const SEP = "\u001f";

describe("ADR-322 — the item table", () => {
  it("one walk: path ids are the ancestors' keys, names the path, depth · children", () => {
    const table = cascaderTable(REGIONS);
    expect(table.entries.map((entry) => entry.pathId)).toEqual([
      "11",
      `11${SEP}680`,
      `11${SEP}680${SEP}6801`,
      `11${SEP}680${SEP}6802`,
      `11${SEP}140`,
      `11${SEP}140${SEP}1401`,
      "26",
      `26${SEP}110`,
      `26${SEP}110${SEP}1101`,
      "36",
    ]);
    const myeongdong = table.byPathId.get(`11${SEP}140${SEP}1401`)!;
    expect(myeongdong.names).toEqual(["서울", "중구", "명동"]);
    expect(myeongdong.depth).toBe(2);
    expect(table.byPathId.get("11")!.hasChildren).toBe(true);
    expect(table.duplicatePathIds.size).toBe(0);
  });

  it("a key under two parents (A/01 · B/01) — both items cannot be picked, the value is refused", () => {
    const table = cascaderTable([
      { key: "A", name: "A", children: [leaf("01", "a1")] },
      { key: "B", name: "B", children: [leaf("01", "b1")] },
    ]);
    expect([...table.duplicatePathIds].sort()).toEqual([
      `A${SEP}01`,
      `B${SEP}01`,
    ]);
    expect(cascaderValueMatch(table, "01")).toEqual({
      kind: "duplicate",
      key: "01",
    });
    // (A branch is no value while the field picks leaves — Phase 5, 사용자 결정 2.)
    expect(cascaderValueMatch(table, "A").kind).toBe("branch");
    expect(cascaderValueMatch(table, "zz")).toEqual({
      kind: "missing",
      key: "zz",
    });
  });

  it("two siblings with one key (A/01 twice) — separate path ids before RAC sees them, both duplicates", () => {
    const table = cascaderTable([
      {
        key: "A",
        name: "A",
        children: [leaf("01", "first"), leaf("01", "second")],
      },
    ]);
    const ids = table.entries.map((entry) => entry.pathId);
    expect(ids).toEqual(["A", `A${SEP}01`, `A${SEP}01#1`]);
    expect(new Set(ids).size).toBe(ids.length);
    expect([...table.duplicatePathIds].sort()).toEqual([
      `A${SEP}01`,
      `A${SEP}01#1`,
    ]);
  });
  it("keeps raw key characters separate from generated sibling, level and status ids", () => {
    const keys = ["07", "07", "07#1", "07%231", "A\u001fB", "x\u001eall"];
    const table = cascaderTable([
      ...keys.map((key) => leaf(key)),
      { key: "A", name: "A", children: [leaf("B")] },
    ]);
    expect(table.byPathId.size).toBe(table.entries.length);
    expect(
      table.entries
        .filter((entry) => entry.duplicate)
        .map((entry) => entry.key),
    ).toEqual(["07", "07"]);
    expect(
      table.entries.some((entry) => entry.pathId.endsWith("\u001eall")),
    ).toBe(false);
  });
});

describe("ADR-322 — the closed field's text (decision 7)", () => {
  const table = cascaderTable(REGIONS);
  it("the whole path by default · the leaf · an authored separator", () => {
    expect(cascaderValueText(table, { defaultValue: "1401" })).toBe(
      "서울 / 중구 / 명동",
    );
    expect(
      cascaderValueText(table, { defaultValue: "1401", displayMode: "leaf" }),
    ).toBe("명동");
    expect(
      cascaderValueText(table, { defaultValue: "1101", separator: " > " }),
    ).toBe("부산 > 중구 > 남포동");
  });
  it("`value` (the run's) wins over `defaultValue`; nothing picked = no text (the placeholder shows)", () => {
    expect(
      cascaderValueText(table, { value: "36", defaultValue: "1401" }),
    ).toBe("세종");
    expect(cascaderValueText(table, {})).toBeUndefined();
    expect(cascaderValueText(table, { defaultValue: "" })).toBeUndefined();
  });
  it("a key no single item carries is shown as stored — never matched to another", () => {
    expect(cascaderValueText(table, { defaultValue: "9999" })).toBe("9999");
    const repeated = cascaderTable([
      { key: "A", name: "A", children: [leaf("01")] },
      { key: "B", name: "B", children: [leaf("01")] },
    ]);
    expect(cascaderValueText(repeated, { defaultValue: "01" })).toBe("01");
  });
});

describe("ADR-322 — registration", () => {
  it("a composition type (no S2 · design-data · v3 cascader — Phase 0)", () => {
    expect(CATALOG_D2_COMPOSITION_TYPES.has("Cascader")).toBe(true);
    expect(CATALOG_D2_COMPOSITION_TYPES.has("CascaderItem")).toBe(true);
  });
  it("field props carry Select's (S2 Picker's) names; the mode starts at `columns` (decision 1), the display at the path (decision 7)", () => {
    const select = getPrimitiveBinding("Select")!.props.accepts;
    const cascader = getPrimitiveBinding("Cascader")!.props.accepts;
    for (const key of [
      "label",
      "description",
      "placeholder",
      "size",
      "labelPosition",
      "isRequired",
      "isDisabled",
      "isInvalid",
      "errorMessage",
      "name",
    ])
      expect([key, cascader[key]?.kind]).toEqual([key, select[key]?.kind]);
    // (사용자 결정 2026-11-29 — the reference's default; 사용자 결정 1 `columns` 대체.)
    expect(cascader.mode?.default).toBe("drill");
    expect(cascader.searchScope?.default).toBe("level");
    expect(cascader.displayMode?.default).toBe("path");
  });
  it("the origin's items have unique keys (11 items, three levels)", () => {
    // (ADR-326 사용자 결정 2 — the items are the item origin's instances.)
    const keys = CASCADER_TEMPLATES.filter((node) =>
      node.definitionId.endsWith("origin-component-cascaderitem"),
    ).map((node) => String(node.props.id));
    expect(keys).toHaveLength(11);
    expect(new Set(keys).size).toBe(11);
  });
});

describe("ADR-322 G4 — refused value writes and the field's notice", () => {
  const repeated = cascaderTable([
    { key: "A", name: "A", children: [leaf("01"), leaf("02")] },
    { key: "B", name: "B", children: [leaf("01")] },
    {
      key: "C",
      name: "C",
      children: [{ key: "09", name: "9", isDisabled: true }],
    },
  ]);

  it("a write of a repeated · missing · branch · disabled key is refused, a unique leaf and clearing are not", () => {
    expect(cascaderValueRefusal(repeated, "01")).toBe(
      "여러 항목이 가진 key: 01",
    );
    expect(cascaderValueRefusal(repeated, "zz")).toBe("없는 key: zz");
    expect(cascaderValueRefusal(repeated, "A")).toBe(
      "가지 항목: A — 끝 항목이 값이다 (「어느 단계든」 꺼짐)",
    );
    expect(cascaderValueRefusal(repeated, "09")).toBe("비활성 항목: 09");
    expect(cascaderValueRefusal(repeated, "02")).toBeUndefined();
    expect(cascaderValueRefusal(repeated, null)).toBeUndefined();
    expect(cascaderValueRefusal(repeated, "")).toBeUndefined();
  });

  it("the dispatcher's constraint check reports the target's own refusal (a rule's 「값 넣기」)", () => {
    const context = {
      props: {},
      current: null,
      refuseValue: (prop: string | undefined, next: unknown) =>
        prop === "value" ? cascaderValueRefusal(repeated, next) : undefined,
    };
    const setValue = { prop: "value", value: "!param" } as never;
    expect(checkCapabilityConstraints(setValue, "01", "01", context)).toBe(
      "여러 항목이 가진 key: 01",
    );
    expect(
      checkCapabilityConstraints(setValue, "02", "02", context),
    ).toBeUndefined();
  });

  it("the notice counts the items that cannot be picked, after the author's description, in the locale", () => {
    expect(cascaderNotice(repeated)).toBe(
      "2 items can't be picked — the key repeats",
    );
    expect(cascaderNotice(repeated, "ko-KR")).toBe(
      "고를 수 없는 항목 2 개 — key 가 겹친다",
    );
    expect(
      cascaderDescriptionText(repeated, { description: "Pick a region" }, "ko"),
    ).toBe("Pick a region · 고를 수 없는 항목 2 개 — key 가 겹친다");
    expect(cascaderNotice(cascaderTable(REGIONS))).toBeUndefined();
    expect(
      cascaderDescriptionText(cascaderTable(REGIONS), { description: "x" }),
    ).toBeUndefined();
  });
});

describe("ADR-322 Phase 5 — pickable items (사용자 결정 2 · 5 값 모양) and several values (결정 3)", () => {
  // Tables per level restart their ids: category 1 · subcategory 1.
  const levels: CascaderSourceItem[] = [
    {
      key: "1",
      name: "Food",
      children: [leaf("1", "Bread"), leaf("2", "Rice")],
    },
    { key: "2", name: "Drink", children: [leaf("3", "Tea")] },
  ];

  it("leaves only (default): a branch and a leaf share a key without a clash — the key is the leaf", () => {
    const table = cascaderTable(levels);
    expect(table.duplicatePathIds.size).toBe(0);
    expect(cascaderValueMatch(table, "1")).toMatchObject({
      kind: "item",
      entry: { names: ["Food", "Bread"] },
    });
    // ("2" is the branch Drink and the leaf Rice — the leaf.)
    expect(cascaderValueText(table, { value: "2" })).toBe("Food / Rice");
  });

  it("any level: a branch is a value, and the shared keys clash — both items cannot be picked", () => {
    const table = cascaderTable(levels, { anyLevel: true });
    expect([...table.duplicatePathIds].sort()).toEqual(
      ["1", `1${SEP}1`, "2", `1${SEP}2`].sort(),
    );
    expect(cascaderValueMatch(table, "3")).toMatchObject({
      kind: "item",
      entry: { names: ["Drink", "Tea"] },
    });
    const branches = cascaderTable(
      [{ key: "A", name: "A", children: [leaf("01")] }],
      {
        anyLevel: true,
      },
    );
    expect(cascaderValueText(branches, { value: "A" })).toBe("A");
    expect(cascaderValueRefusal(branches, "A")).toBeUndefined();
  });

  it("several values: one shows its path, two or more their count; a write refuses any bad key", () => {
    const table = cascaderTable(REGIONS);
    expect(cascaderValueText(table, { value: ["6801"] })).toBe(
      "서울 / 강남구 / 역삼동",
    );
    expect(cascaderValueText(table, { value: ["6801", "1401"] })).toBe(
      "2 selected",
    );
    expect(
      cascaderValueText(table, { value: ["6801", "1401"] }, undefined, "ko-KR"),
    ).toBe("2개 선택됨");
    expect(cascaderValueText(table, { value: [] })).toBeUndefined();
    expect(cascaderValueRefusal(table, ["6801", "zz"])).toBe("없는 key: zz");
    expect(cascaderValueRefusal(table, ["6801", "1401"])).toBeUndefined();
  });
});

describe("ADR-322 Phase 5 — search (breakdown §4.4)", () => {
  const names = (list: { names: readonly string[] }[]) =>
    list.map((entry) => entry.names.join(" / "));

  it("only pickable items: a branch name is not a result while leaves are the value", () => {
    const table = cascaderTable(REGIONS);
    expect(names(cascaderSearch(table, "강남", "ko-KR"))).toEqual([]);
    expect(names(cascaderSearch(table, "동", "ko-KR"))).toEqual([
      "서울 / 강남구 / 역삼동",
      "서울 / 강남구 / 삼성동",
      "서울 / 중구 / 명동",
      "부산 / 중구 / 남포동",
    ]);
    // (Any level: the branch is a result.)
    expect(
      names(cascaderSearch(cascaderTable(REGIONS, { anyLevel: true }), "강남", "ko-KR")),
    ).toEqual(["서울 / 강남구"]);
  });

  it("syllables, not letters (가 ≠ 각) · an empty query is no search", () => {
    const table = cascaderTable([leaf("a", "각남"), leaf("b", "가남")]);
    expect(names(cascaderSearch(table, "가남", "ko-KR"))).toEqual(["가남"]);
    expect(cascaderSearch(table, "", "ko-KR")).toEqual([]);
  });
  it("판독 1 #10 — under a level (`deep`): the walk up the levels is only for the names that hold the query", () => {
    const table = cascaderTable(REGIONS, { anyLevel: true });
    let walks = 0;
    const counted = {
      ...table,
      byPathId: {
        get: (id: string) => {
          walks++;
          return table.byPathId.get(id);
        },
      },
    } as unknown as typeof table;
    const under = table.entries.find((entry) => entry.hasChildren)!.pathId;
    expect(cascaderSearch(counted, "없는 이름", "ko-KR", under)).toEqual([]);
    expect(walks).toBe(0);
  });
});
