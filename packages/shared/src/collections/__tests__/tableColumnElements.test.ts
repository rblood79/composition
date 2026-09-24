import { describe, expect, it } from "vitest";
import {
  createColumnHelper,
  getCoreRowModel,
  createTable,
} from "@tanstack/react-table";

import {
  TABLE_COLUMN_DEFAULT_WIDTH,
  readTableColumnElements,
  resolveTableColumnEffectiveWidth,
  resolveTableColumnKey,
} from "../resolveCollectionItems";

/**
 * ADR-241 Phase 1 (G1) — 열 원천 = Column 요소, 두 leg 한 reader. 폭 oracle = Preview 가 실제로 쓰는 TanStack `getSize()`
 * (`components/Table.tsx` 의 columnDef 모양 그대로 — `size: width ?? 150` · `minSize: minWidth` · `maxSize: maxWidth`).
 */
function tanstackSizes(
  columns: Array<{ width?: number; minWidth?: number; maxWidth?: number }>,
): number[] {
  const helper = createColumnHelper<Record<string, unknown>>();
  const table = createTable({
    data: [],
    columns: columns.map((c, i) =>
      helper.accessor((row) => row[`k${i}`], {
        id: `k${i}`,
        size: c.width ?? 150,
        minSize: c.minWidth,
        maxSize: c.maxWidth,
      }),
    ),
    getCoreRowModel: getCoreRowModel(),
    state: { columnSizing: {}, columnSizingInfo: {} as never },
    onStateChange: () => {},
    renderFallbackValue: null,
  });
  return table.getAllLeafColumns().map((column) => column.getSize());
}

const CASES = [
  { width: 80, minWidth: 120 },
  {},
  { width: 500, maxWidth: 300 },
  { width: 5 },
  { minWidth: 200 },
  { width: 90, minWidth: 100, maxWidth: 95 },
  { width: 240 },
];

describe("ADR-241 G1 — 유효 열 폭 = TanStack getSize", () => {
  it("clamp(width ?? 150, minWidth ?? 20, maxWidth) 가 TanStack 과 열마다 같다", () => {
    expect(CASES.map((c) => resolveTableColumnEffectiveWidth(c))).toEqual(
      tanstackSizes(CASES),
    );
    // 리뷰 r1 m1 반례
    expect(resolveTableColumnEffectiveWidth({ width: 80, minWidth: 120 })).toBe(
      120,
    );
    expect(TABLE_COLUMN_DEFAULT_WIDTH).toBe(150);
  });
});

describe("ADR-241 G1 — Column 요소 reader", () => {
  it("key 규칙 = Preview dataKey (key · 글자 소문자 · props.id · col<index>)", () => {
    expect(resolveTableColumnKey({ key: "email", children: "E" }, 0)).toBe(
      "email",
    );
    expect(resolveTableColumnKey({ children: "Name" }, 0)).toBe("name");
    expect(resolveTableColumnKey({ id: "c9" }, 0)).toBe("c9");
    expect(resolveTableColumnKey({}, 3)).toBe("col3");
  });

  it("삭제 표시 · Column 밖 type 제외, index 는 남은 열 기준 · 글자 = text source", () => {
    const columns = readTableColumnElements([
      { type: "Column", props: { key: "a", children: "A", width: 80 } },
      { type: "Column", deleted: true, props: { key: "gone" } },
      { type: "Text", props: { children: "x" } },
      { type: "Column", props: { children: "" } },
    ]);
    expect(columns).toEqual([
      { id: "a", label: "A", width: 80 },
      { id: "col1", label: "", width: 150 },
    ]);
  });
});
