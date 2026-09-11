/**
 * ADR-214 Phase 1 — `Variable.owner` additive + 결정적 변환 (HC3 · R4).
 *
 * global → project · page+page_id → page · component → project + owner-unresolved ·
 * page without page_id (UI 가 page_id 를 쓰지 않아 실 데이터의 흔한 형태 — Phase 0 §5) →
 * project + owner-unresolved. 조용한 변환 0: unresolved 는 status + 로그.
 */
import { afterEach, describe, expect, it, vi } from "vitest";
import type { Variable } from "../../../types/builder/data.types";
import {
  countVariableOwnerMigration,
  migrateVariableOwner,
  migrateVariableOwners,
  resolveVariableOwner,
} from "./variableOwnerMigration";

const base = (patch: Partial<Variable>): Variable => ({
  id: "v",
  name: "x",
  project_id: "p",
  type: "string",
  persist: false,
  scope: "global",
  ...patch,
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("resolveVariableOwner — 결정적", () => {
  it("global → project", () => {
    expect(resolveVariableOwner(base({ scope: "global" }))).toEqual({
      owner: { kind: "project" },
      unresolved: false,
    });
  });
  it("page + page_id → page", () => {
    expect(
      resolveVariableOwner(base({ scope: "page", page_id: "pg" })),
    ).toEqual({
      owner: { kind: "page", pageId: "pg" },
      unresolved: false,
    });
  });
  it("component → project + unresolved", () => {
    expect(resolveVariableOwner(base({ scope: "component" }))).toEqual({
      owner: { kind: "project" },
      unresolved: true,
    });
  });
  it("page without page_id → project + unresolved (HC3 미정의 사례의 가장 좁은 결정)", () => {
    expect(resolveVariableOwner(base({ scope: "page" }))).toEqual({
      owner: { kind: "project" },
      unresolved: true,
    });
    expect(resolveVariableOwner(base({ scope: "page", page_id: "" }))).toEqual({
      owner: { kind: "project" },
      unresolved: true,
    });
  });
  it("이미 owner 가 있으면 그대로 (재변환 없음 · status 유지)", () => {
    const v = base({
      scope: "component",
      owner: { kind: "project" },
      migrationStatus: "owner-unresolved",
    });
    expect(resolveVariableOwner(v)).toEqual({
      owner: { kind: "project" },
      unresolved: true,
    });
    const w = base({ scope: "component", owner: { kind: "project" } });
    expect(resolveVariableOwner(w)).toEqual({
      owner: { kind: "project" },
      unresolved: false,
    });
  });
});

describe("migrateVariableOwner — additive · 원본 불변 · 재직렬화 0", () => {
  it("owner 없는 변수는 owner 를 붙인 새 객체, 나머지 필드 그대로 (scope/page_id 유지)", () => {
    const v = base({ scope: "page", page_id: "pg" });
    const out = migrateVariableOwner(v);
    expect(out.changed).toBe(true);
    expect(out.variable).toEqual({
      ...v,
      owner: { kind: "page", pageId: "pg" },
    });
    expect(out.variable).not.toHaveProperty("migrationStatus");
    expect(v).not.toHaveProperty("owner");
  });
  it("component 는 migrationStatus 를 남긴다", () => {
    const out = migrateVariableOwner(base({ scope: "component" }));
    expect(out.variable.owner).toEqual({ kind: "project" });
    expect(out.variable.migrationStatus).toBe("owner-unresolved");
  });
  it("이미 owner 가 있으면 같은 참조 · changed=false", () => {
    const v = base({ owner: { kind: "project" } });
    const out = migrateVariableOwner(v);
    expect(out.variable).toBe(v);
    expect(out.changed).toBe(false);
  });
});

describe("migrateVariableOwners + countVariableOwnerMigration — G0 계수 + 로그", () => {
  it("건수 · unresolved 목록 · 비율을 세고, unresolved 가 있으면 로그 1회 (조용한 변환 0)", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const list = [
      base({ id: "a", name: "a", scope: "global" }),
      base({ id: "b", name: "b", scope: "page", page_id: "pg" }),
      base({ id: "c", name: "c", scope: "component" }),
      base({ id: "d", name: "d", scope: "page" }),
    ];
    const { variables, report } = migrateVariableOwners(list, {
      projectId: "p",
    });
    expect(variables.map((v) => v.owner)).toEqual([
      { kind: "project" },
      { kind: "page", pageId: "pg" },
      { kind: "project" },
      { kind: "project" },
    ]);
    expect(report).toEqual({
      projectId: "p",
      total: 4,
      byScope: { global: 1, page: 2, component: 1 },
      unresolved: [
        { id: "c", name: "c", scope: "component" },
        { id: "d", name: "d", scope: "page" },
      ],
      unresolvedRatio: 0.5,
    });
    expect(warn).toHaveBeenCalledTimes(1);
    expect(String(warn.mock.calls[0][0])).toContain("owner-unresolved");
  });

  it("unresolved 0 이면 로그 0", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    migrateVariableOwners([base({ scope: "global" })], { projectId: "p" });
    expect(warn).not.toHaveBeenCalled();
    expect(countVariableOwnerMigration([]).total).toBe(0);
  });
});
