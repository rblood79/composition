/**
 * ADR-214 Phase 1 — `Variable.owner` additive + 결정적 변환 (HC3 · R4).
 *
 * global → project · page+page_id → page · component → project + owner-unresolved ·
 * page without page_id (UI 가 page_id 를 쓰지 않아 실 데이터의 흔한 형태 — Phase 0 §5) →
 * 프로젝트 페이지가 **1개뿐이면 그 페이지** (유일하게 결정적인 경우 — 사용자 판정 C,
 * 2026-09-11), 아니면 project + owner-unresolved. 조용한 변환 0: unresolved 는 status +
 * 로그, 자동 귀속도 로그 1회.
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
  it("page without page_id → 페이지 목록을 모르거나 2개 이상이면 project + unresolved", () => {
    expect(resolveVariableOwner(base({ scope: "page" }))).toEqual({
      owner: { kind: "project" },
      unresolved: true,
    });
    expect(resolveVariableOwner(base({ scope: "page", page_id: "" }))).toEqual({
      owner: { kind: "project" },
      unresolved: true,
    });
    expect(
      resolveVariableOwner(base({ scope: "page" }), { pageIds: ["p1", "p2"] }),
    ).toEqual({ owner: { kind: "project" }, unresolved: true });
    expect(
      resolveVariableOwner(base({ scope: "page" }), { pageIds: [] }),
    ).toEqual({ owner: { kind: "project" }, unresolved: true });
  });
  it("page without page_id + 프로젝트 페이지 1개 → 그 페이지 (판정 C — 결정적)", () => {
    expect(
      resolveVariableOwner(base({ scope: "page" }), { pageIds: ["only"] }),
    ).toEqual({
      owner: { kind: "page", pageId: "only" },
      unresolved: false,
      pageAssigned: true,
    });
    // page_id 가 있으면 페이지 목록과 무관하게 그 값
    expect(
      resolveVariableOwner(base({ scope: "page", page_id: "pg" }), {
        pageIds: ["only"],
      }),
    ).toEqual({ owner: { kind: "page", pageId: "pg" }, unresolved: false });
    // component 는 페이지가 1개여도 승격 안 함 (소유 요소를 알 수 없다)
    expect(
      resolveVariableOwner(base({ scope: "component" }), { pageIds: ["only"] }),
    ).toEqual({ owner: { kind: "project" }, unresolved: true });
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
      pageAssigned: [],
      unresolvedRatio: 0.5,
    });
    expect(warn).toHaveBeenCalledTimes(1);
    expect(String(warn.mock.calls[0][0])).toContain("owner-unresolved");
  });

  it("페이지 1개 프로젝트: page without page_id 는 그 페이지로 귀속 · 자동 귀속 로그 1회 (warn 아님)", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const info = vi.spyOn(console, "info").mockImplementation(() => {});
    const { variables, report } = migrateVariableOwners(
      [base({ id: "d", name: "d", scope: "page" })],
      { projectId: "p", pageIds: ["only"] },
    );
    expect(variables[0].owner).toEqual({ kind: "page", pageId: "only" });
    expect(variables[0]).not.toHaveProperty("migrationStatus");
    expect(report.unresolved).toEqual([]);
    expect(report.pageAssigned).toEqual([
      { id: "d", name: "d", pageId: "only" },
    ]);
    expect(warn).not.toHaveBeenCalled();
    expect(info).toHaveBeenCalledTimes(1);
  });

  it("unresolved 0 이면 로그 0", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    migrateVariableOwners([base({ scope: "global" })], { projectId: "p" });
    expect(warn).not.toHaveBeenCalled();
    expect(countVariableOwnerMigration([]).total).toBe(0);
  });
});
