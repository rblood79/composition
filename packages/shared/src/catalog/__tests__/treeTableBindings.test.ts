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
 * family ④와 동일 패턴 — composition wrapper(useCollectionData, ADR-132)가 D1 담당
 * (internal source), 재귀(Tree)/2D(Table) collection 렌더는 RAC. DOM-only cutover(skiaLegacy:true):
 * DOM/Inspector 는 catalog generic, Skia 만 legacy render.shapes 유지.
 * TableView 는 inventory §2-1 primitive 에 없음(LayoutRenderer 전용) → catalog 미등록.
 */

const TREE_TABLE_TYPES = ["Tree", "Table"] as const;

describe("family ⑤ Tree·Table — catalog 등록 + DOM-only cutover", () => {
  it("Tree/Table 이 catalog primitive entry (family=tree-table, cutover=catalog, skiaLegacy)", () => {
    for (const type of TREE_TABLE_TYPES) {
      const entry = getCatalogEntry(type);
      expect(entry, `${type} catalog entry`).toBeDefined();
      expect(entry?.kind).toBe("primitive");
      expect(entry?.family).toBe("tree-table");
      expect(entry?.cutover).toBe("catalog");
      expect(
        (entry as { skiaLegacy?: boolean })?.skiaLegacy,
        `${type} skiaLegacy`,
      ).toBe(true);
    }
  });

  it("DOM 게이트는 Tree/Table 포함, Skia 게이트는 제외", () => {
    const domGate = getCatalogCutoverTypes();
    const skiaGate = getCatalogSkiaCutoverTypes();
    for (const type of TREE_TABLE_TYPES) {
      expect(domGate.has(type), `${type} in DOM gate`).toBe(true);
      expect(skiaGate.has(type), `${type} NOT in Skia gate`).toBe(false);
    }
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
