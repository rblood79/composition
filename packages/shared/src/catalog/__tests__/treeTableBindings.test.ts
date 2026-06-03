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
 *   shell 을 그려 items 소실 없음.
 * **Table — Skia generic 발효 (ADR-912 단계 4 C1 2026-06-03)**: 2D grid 를 Table 2D projection
 *   (RowsGroup → Row[i] → Cell[i][j])으로 Skia 렌더. shell 은 buildCatalogShapes.
 * **단계 5 step 1 (2026-06-04)**: skiaLegacy 필드 제거 → DOM·Skia 게이트 모두 Tree/Table 포함.
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

  it("Tree/Table entry 에 skiaLegacy 속성 0건 (단계 5 step 1 — 필드 제거)", () => {
    for (const type of TREE_TABLE_TYPES) {
      expect(
        (getCatalogEntry(type) as { skiaLegacy?: boolean })?.skiaLegacy,
        `${type} skiaLegacy undefined`,
      ).toBeUndefined();
    }
  });

  it("DOM·Skia 게이트 모두 Tree/Table 포함 (단계 4 C1 + step 1)", () => {
    const domGate = getCatalogCutoverTypes();
    const skiaGate = getCatalogSkiaCutoverTypes();
    for (const type of TREE_TABLE_TYPES) {
      expect(domGate.has(type), `${type} in DOM gate`).toBe(true);
      expect(skiaGate.has(type), `${type} in Skia gate`).toBe(true);
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
