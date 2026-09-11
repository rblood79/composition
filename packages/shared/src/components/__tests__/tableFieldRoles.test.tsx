/**
 * ADR-152 Phase 3 deferred → 후속: Table DOM wrapper 가 raw `useCollectionData` 대신 shared
 * 정규화 (`useResolvedCollectionItems` → `toItemProjectionRow`) 를 지나 fieldMap value 역할이
 * 행 id (TanStack `getRowId` → `<tr data-key>`) 에 반영되는지 — Skia `getTableProjectionRows`
 * (`getItemKey(item, i, roles)`) 와 동형.
 *
 * Table 본체는 virtualizer 가 SSR 에서 행을 내지 않아 (scroll element 없음) 행 id 해석기와
 * 배선을 나눠 잰다: (1) `buildTableRowIdResolver` 순수 · (2) Table.tsx 정적 배선 · (3) live
 * 는 `apps/builder/scripts/adr152-p3-live.mjs` (Preview DOM `tr[data-key]`).
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

import { resolveFieldRoles, toItemProjectionRow } from "../../collections";
import { buildTableRowIdResolver } from "../Table";

const schema = [
  { id: "f-uid", key: "uid", type: "string" as const },
  { id: "f-name", key: "name", type: "string" as const },
];
const items = [
  { id: "auto-1", uid: "U-1", name: "User 1" },
  { id: "auto-2", uid: "U-2", name: "User 2" },
];
const binding = (fieldMap?: Record<string, string>) => ({
  source: "dataTable" as const,
  collectionId: "c1",
  name: "Users",
  ...(fieldMap ? { fieldMap } : {}),
});
const rowsFor = (fieldMap?: Record<string, string>) => {
  const roles = resolveFieldRoles(binding(fieldMap), schema);
  return items.map((item, i) => toItemProjectionRow(item, i, roles));
};

describe("buildTableRowIdResolver — 행 id = shared itemKey", () => {
  it("fieldMap 없음: id 컬럼 휴리스틱 (Skia 와 같은 getItemKey)", () => {
    const resolveId = buildTableRowIdResolver(rowsFor());
    expect(items.map((it, i) => resolveId(it, i))).toEqual([
      "auto-1",
      "auto-2",
    ]);
  });

  it("fieldMap.value = uid → uid 컬럼", () => {
    const resolveId = buildTableRowIdResolver(rowsFor({ value: "f-uid" }));
    expect(items.map((it, i) => resolveId(it, i))).toEqual(["U-1", "U-2"]);
  });

  it("정렬·페이지 slice 뒤 index 가 달라도 item 참조로 같은 id · 미등록 행은 index 폴백", () => {
    const resolveId = buildTableRowIdResolver(rowsFor({ value: "f-uid" }));
    expect(resolveId(items[1], 0)).toBe("U-2");
    expect(resolveId({ id: "x" }, 7)).toBe("7");
    expect(resolveId("scalar", 3)).toBe("3");
  });
});

describe("Table.tsx 배선 (정적)", () => {
  const src = readFileSync(resolve(__dirname, "../Table.tsx"), "utf8");

  it("raw useCollectionData 를 쓰지 않고 useResolvedCollectionItems 를 지난다", () => {
    expect(src).not.toMatch(/\buseCollectionData\(/);
    expect(src).toMatch(/useResolvedCollectionItems\(\{/);
  });

  it("바인딩 행 id 를 TanStack getRowId 로 넘기고 <tr data-key> 로 노출한다", () => {
    expect(src).toMatch(
      /getRowId: hasDataBinding \? resolveBoundRowId : undefined/,
    );
    expect(src).toMatch(/data-key=\{row\.id\}/);
  });

  it('wrapper 안 legacy 바인딩 분류 (`type === "collection"`) 를 다시 두지 않는다', () => {
    expect(src).not.toMatch(/dataBinding\.type === "collection"/);
  });
});
