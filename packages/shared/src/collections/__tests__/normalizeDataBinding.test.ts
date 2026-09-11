/**
 * ADR-152 Phase 5 — legacy `DataBinding { type:"collection" }` → v2 `PropertyDataBinding` 변환.
 * collection 을 가리키는 legacy 형식 (config.collectionId / datatableId / name) 만 v2 로 올리고,
 * inline static · api · 그 밖은 그대로 (변환 불가 — 소비처가 legacy 경로로 읽는다).
 */
import { describe, expect, it } from "vitest";
import { normalizeDataBinding } from "../normalizeDataBinding";

describe("normalizeDataBinding", () => {
  it("v2 는 그대로 (같은 참조)", () => {
    const v2 = { source: "dataTable", collectionId: "c1", name: "Users" };
    expect(normalizeDataBinding(v2)).toBe(v2);
  });
  it("legacy collection 참조 → v2 (collectionId · datatableId · name)", () => {
    expect(normalizeDataBinding({ type: "collection", source: "static", config: { collectionId: "c1", name: "Users" } })).toEqual({ source: "dataTable", collectionId: "c1", name: "Users" });
    expect(normalizeDataBinding({ type: "collection", source: "state", config: { datatableId: "c1" } })).toEqual({ source: "dataTable", collectionId: "c1", name: "c1" });
    expect(normalizeDataBinding({ type: "collection", source: "state", config: { name: "Users" } })).toEqual({ source: "dataTable", name: "Users" });
  });
  it("inline static · api · 비-collection 은 그대로", () => {
    const stat = { type: "collection", source: "static", config: { data: [{ id: 1 }] } };
    expect(normalizeDataBinding(stat)).toBe(stat);
    const api = { type: "collection", source: "api", config: { endpoint: "/x" } };
    expect(normalizeDataBinding(api)).toBe(api);
    expect(normalizeDataBinding(null)).toBeNull();
    expect(normalizeDataBinding("x")).toBe("x");
  });
});
