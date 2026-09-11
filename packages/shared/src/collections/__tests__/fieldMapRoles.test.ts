/**
 * ADR-152 Phase 3 — fieldMap (value / icon) 소비.
 *
 * - resolveFieldRoles: fieldId → key (schema · 색인) · v1 key 통과 · 미지정 undefined
 * - getItem* 가 roles 를 받으면 그 컬럼을 우선하고, 없으면 기존 휴리스틱 (BC)
 * - getFlatProjectionRows (Skia) 가 binding + collections 에서 roles 를 스스로 푼다
 * - interpolateCollectionRowTemplate (DOM) 의 `{value}` · `{icon}` 가 같은 roles 를 본다
 */
import { afterEach, describe, expect, it } from "vitest";
import { clearFieldIdIndex, registerFieldIds } from "@composition/specs";
import {
  compileFieldTemplate,
  getFlatProjectionRows,
  getItemAvatar,
  getItemIcon,
  getItemKey,
  getItemValue,
  getTableProjectionRows,
  interpolateCollectionRowTemplate,
  resolveFieldRoles,
  toItemProjectionRow,
} from "..";

const schema = [
  { id: "f-uid", key: "uid", type: "string" },
  { id: "f-name", key: "name", type: "string" },
  { id: "f-photo", key: "photo", type: "image" },
  { id: "f-glyph", key: "glyph", type: "string" },
];
const rows = [
  { id: "auto-1", uid: "U-1", name: "Ann", photo: "https://x/a.png", glyph: "star", icon: "heart" },
  { id: "auto-2", uid: "U-2", name: "Bob", photo: "https://x/b.png", glyph: "moon", icon: "heart" },
];
const collections = [{ id: "c1", name: "Users", schema, mockData: rows, useMockData: true }];

afterEach(() => clearFieldIdIndex());

describe("resolveFieldRoles", () => {
  it("fieldId → key (schema) · v1 key 통과 · 미지정 undefined", () => {
    expect(resolveFieldRoles({ fieldMap: { value: "f-uid", icon: "photo" } }, schema)).toEqual({ value: "uid", icon: "photo" });
    expect(resolveFieldRoles({ fieldMap: {} }, schema)).toBeUndefined();
    expect(resolveFieldRoles({ source: "dataTable", name: "Users" }, schema)).toBeUndefined();
    expect(resolveFieldRoles(null, schema)).toBeUndefined();
  });

  it("schema 없이도 색인 (렌더 resolve 지점이 등록) 으로 id → key, 미등록은 key 로 간주", () => {
    registerFieldIds(schema);
    expect(resolveFieldRoles({ fieldMap: { value: "f-name" } })).toEqual({ value: "name" });
    expect(resolveFieldRoles({ fieldMap: { icon: "glyph" } })).toEqual({ icon: "glyph" });
  });
});

describe("getItem* — roles 우선, 없으면 휴리스틱 (BC)", () => {
  it("value 역할 → itemKey · value 가 그 컬럼", () => {
    expect(getItemKey(rows[0], 0)).toBe("auto-1");
    expect(getItemKey(rows[0], 0, { value: "uid" })).toBe("U-1");
    expect(getItemValue(rows[0])).toBe("auto-1");
    expect(getItemValue(rows[0], { value: "uid" })).toBe("U-1");
    // 역할 컬럼이 비어 있으면 휴리스틱으로
    expect(getItemKey({ id: "x", uid: "" }, 3, { value: "uid" })).toBe("x");
  });

  it("icon 역할 — glyph 면 icon slot, 이미지 참조면 avatar slot (한 값이 두 slot 에 안 잡힌다)", () => {
    expect(getItemIcon(rows[0])).toBe("heart");
    expect(getItemIcon(rows[0], { icon: "glyph" })).toBe("star");
    expect(getItemAvatar(rows[0], { icon: "glyph" })).toBeNull();
    expect(getItemIcon(rows[0], { icon: "photo" })).toBeNull();
    expect(getItemAvatar(rows[0], { icon: "photo" })).toBe("https://x/a.png");
  });

  it("toItemProjectionRow 가 roles 를 실어 나른다", () => {
    const row = toItemProjectionRow(rows[1], 1, { value: "uid", icon: "photo" });
    expect(row).toMatchObject({ itemKey: "U-2", value: "U-2", icon: null, avatar: "https://x/b.png", label: "Bob" });
  });
});

describe("Skia · DOM 진입점", () => {
  it("getFlatProjectionRows — binding.fieldMap (id) 을 collections schema 로 풀어 적용", () => {
    const out = getFlatProjectionRows({
      props: {},
      dataBinding: { source: "dataTable", collectionId: "c1", name: "Users", fieldMap: { value: "f-uid", icon: "f-glyph" } },
      collections,
    });
    expect(out.map((r) => [r.itemKey, r.icon, r.avatar])).toEqual([["U-1", "star", null], ["U-2", "moon", null]]);
    // fieldMap 없음 → 휴리스틱 (BC)
    const plain = getFlatProjectionRows({ props: {}, dataBinding: { source: "dataTable", collectionId: "c1", name: "Users" }, collections });
    expect(plain.map((r) => [r.itemKey, r.icon])).toEqual([["auto-1", "heart"], ["auto-2", "heart"]]);
  });

  it("getTableProjectionRows — value 역할이 rowKey", () => {
    const out = getTableProjectionRows({
      props: { columns: [{ id: "name", label: "Name" }] },
      dataBinding: { source: "dataTable", collectionId: "c1", name: "Users", fieldMap: { value: "f-uid" } },
      collections,
    });
    expect(out.rows.slice(1).map((r) => r.rowKey)).toEqual(["U-1", "U-2"]);
  });

  it("interpolateCollectionRowTemplate — {value} · {icon} 가 roles 를 본다 (DOM = Skia)", () => {
    const compiled = compileFieldTemplate("{value}/{icon}")!;
    expect(interpolateCollectionRowTemplate(compiled, rows[0])).toBe("auto-1/heart");
    expect(interpolateCollectionRowTemplate(compiled, rows[0], { value: "uid", icon: "glyph" })).toBe("U-1/star");
  });
});
