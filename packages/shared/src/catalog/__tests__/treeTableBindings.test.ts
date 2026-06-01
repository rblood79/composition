import { describe, expect, it } from "vitest";

import { getPrimitiveBinding } from "../bindings";
import {
  getCatalogCutoverTypes,
  getCatalogEntry,
  getCatalogSkiaCutoverTypes,
} from "../componentCatalog";
import { toRacProps } from "../outputs/toRacProps";

/**
 * ADR-142 family ⑤(Tree·Table) — Tree/Table 계약 검증.
 *
 * composition wrapper(useCollectionData, ADR-132)가 D1 담당(internal source).
 *
 * **Tree — Skia generic 발효 (G2(a) 2026-06-01)**: render.shapes 가 shell-only 이고 TreeItem 이
 *   canonical 자식 element(factory 생성) → 독립 Skia 노드로 행 렌더. buildCatalogShapes 가 동일
 *   shell 을 그려 items 소실 없음. DOM·Skia 게이트 모두 열림(skiaLegacy 없음).
 * **Table — DOM-only cutover (skiaLegacy:true)**: render.shapes 가 props.rows/columns 2D grid 를
 *   직접 cell shape 로 렌더(데이터-시각 결합형) → buildCatalogShapes 로 대체 불가. Skia 만 legacy.
 * TableView 는 inventory §2-1 primitive 에 없음(LayoutRenderer 전용) → catalog 미등록.
 */

const TREE_TABLE_TYPES = ["Tree", "Table"] as const;

describe("family ⑤ Tree·Table — catalog 등록 + cutover gate", () => {
  it("Tree/Table 이 catalog primitive entry (family=tree-table, cutover=catalog)", () => {
    for (const type of TREE_TABLE_TYPES) {
      const entry = getCatalogEntry(type);
      expect(entry, `${type} catalog entry`).toBeDefined();
      expect(entry?.kind).toBe("primitive");
      expect(entry?.family).toBe("tree-table");
      expect((entry as { cutover?: string } | undefined)?.cutover).toBe(
        "catalog",
      );
    }
  });

  it("Tree 는 skiaLegacy 없음(Skia generic), Table 은 skiaLegacy:true(2D grid legacy)", () => {
    expect(
      (getCatalogEntry("Tree") as { skiaLegacy?: boolean })?.skiaLegacy,
    ).toBeUndefined();
    expect(
      (getCatalogEntry("Table") as { skiaLegacy?: boolean })?.skiaLegacy,
    ).toBe(true);
  });

  it("DOM 게이트는 Tree/Table 포함, Skia 게이트는 Tree 만 포함(Table 제외)", () => {
    const domGate = getCatalogCutoverTypes();
    const skiaGate = getCatalogSkiaCutoverTypes();
    for (const type of TREE_TABLE_TYPES) {
      expect(domGate.has(type), `${type} in DOM gate`).toBe(true);
    }
    expect(skiaGate.has("Tree"), "Tree in Skia gate").toBe(true);
    expect(skiaGate.has("Table"), "Table NOT in Skia gate").toBe(false);
  });

  it("Tree/Table binding 은 internal source (composition wrapper) + skiaPrimitive 없음", () => {
    for (const type of TREE_TABLE_TYPES) {
      const binding = getPrimitiveBinding(type);
      expect(binding?.source.kind, `${type} source`).toBe("internal");
      expect(
        binding?.skiaPrimitive,
        `${type} no skiaPrimitive`,
      ).toBeUndefined();
    }
  });

  it("TableView 는 catalog 미등록 (inventory primitive 아님)", () => {
    expect(getCatalogEntry("TableView")).toBeUndefined();
  });

  it("toRacProps: dataBinding(kind:binding) 통과 + size data-* 라우팅", () => {
    const dataBinding = { source: "rows", name: "userRows" };
    const result = toRacProps(
      {
        id: "tbl1",
        type: "Table",
        props: { dataBinding, size: "lg", selectionMode: "multiple" },
      },
      getPrimitiveBinding("Table")!,
    );
    expect(result.dataBinding).toEqual(dataBinding);
    expect(result.selectionMode).toBe("multiple");
    expect(result["data-size"]).toBe("lg");
  });
});
