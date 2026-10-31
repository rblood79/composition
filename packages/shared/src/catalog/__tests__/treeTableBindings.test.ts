import { describe, expect, it } from "vitest";

import { getPrimitiveBinding } from "../bindings";
import { getCatalogCutoverTypes, getCatalogEntry } from "../componentCatalog";
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
 * (옛 둘째 표 type 은 inventory §2-1 primitive 에 없었고, ADR-277 에서 Table 로 통합됐다.)
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

  it("cutover 게이트가 Tree/Table 포함 (단계 4 C1 + step 1)", () => {
    const gate = getCatalogCutoverTypes();
    for (const type of TREE_TABLE_TYPES) {
      expect(gate.has(type), `${type} in cutover gate`).toBe(true);
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

  // ADR-277 (2026-10-21): 표는 Table 하나 — 옛 둘째 표 type 은 catalog · binding · rule 에서 사라졌다.
  it("옛 둘째 표 type (S2 이름) 은 catalog 에 없다 — Table 하나 (ADR-277)", () => {
    expect(getCatalogEntry("TableView")).toBeUndefined();
    expect(getCatalogEntry("Table")?.kind).toBe("primitive");
  });

  // ADR-295 후속 C1 (2026-10-31): S2 TableView 에 size 축이 없다 — Table 은 size 를 받지 않는다 (data-size 없음).
  it("toRacProps: dataBinding(kind:binding) 통과 · size 는 받지 않음 (S2 축 없음)", () => {
    const dataBinding = { source: "rows", name: "userRows" };
    const result = toRacProps(
      {
        id: "tbl1",
        type: "Table",
        props: { dataBinding, size: "L", selectionMode: "multiple" },
      },
      getPrimitiveBinding("Table")!,
    );
    expect(result.dataBinding).toEqual(dataBinding);
    expect(result.selectionMode).toBe("multiple");
    expect(result["data-size"]).toBeUndefined();
  });
});
