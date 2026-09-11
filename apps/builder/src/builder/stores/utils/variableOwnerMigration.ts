/**
 * ADR-214 Phase 1 — `Variable.owner` additive + 결정적 변환 (HC3 · R4 · Round 1 m4).
 *
 * 규칙 (전량 결정적, 사용자 입력 없음):
 * - `global`              → `{ kind: "project" }`
 * - `page` + `page_id`    → `{ kind: "page", pageId }`
 * - `component`           → `{ kind: "project" }` + `migrationStatus: "owner-unresolved"`
 * - `page` without `page_id` → `{ kind: "project" }` + `owner-unresolved` — HC3 가 다루지 않는
 *   사례. 현행 UI 는 `page_id` 를 한 번도 쓰지 않아 (Phase 0 evidence §1 · §5) 실 데이터의
 *   `page` 는 대부분 이 형태다. 페이지를 알 수 없으니 page 소유자를 지어내지 않고 project 로
 *   올리되 표식을 남긴다.
 *
 * **로드 재직렬화 0** (G1): 변환 결과는 메모리 Map 에만 들어간다. IndexedDB 원본은 그 변수를
 * 다음에 저장할 때 (`define_variable` 적용기) 비로소 `owner` 를 갖는다.
 * **조용한 변환 0**: unresolved 가 1건이라도 있으면 프로젝트당 로그 1회 + 배지 (`migrationStatus`).
 */
import { OWNER_UNRESOLVED, type VariableOwner } from "@composition/shared";
import type {
  Variable,
  VariableScope,
} from "../../../types/builder/data.types";

export interface ResolvedVariableOwner {
  owner: VariableOwner;
  /** project 승격이 사용자 의도와 어긋날 수 있는 항목 (component · page without page_id) */
  unresolved: boolean;
}

export function resolveVariableOwner(
  variable: Variable,
): ResolvedVariableOwner {
  if (variable.owner) {
    return {
      owner: variable.owner,
      unresolved: variable.migrationStatus === OWNER_UNRESOLVED,
    };
  }
  switch (variable.scope) {
    case "page":
      if (typeof variable.page_id === "string" && variable.page_id.length > 0) {
        return {
          owner: { kind: "page", pageId: variable.page_id },
          unresolved: false,
        };
      }
      return { owner: { kind: "project" }, unresolved: true };
    case "component":
      return { owner: { kind: "project" }, unresolved: true };
    case "global":
    default:
      return { owner: { kind: "project" }, unresolved: false };
  }
}

export interface MigratedVariable {
  variable: Variable;
  changed: boolean;
}

/** owner 가 없으면 붙인 새 객체 (원본 불변). 있으면 같은 참조. */
export function migrateVariableOwner(variable: Variable): MigratedVariable {
  if (variable.owner) return { variable, changed: false };
  const { owner, unresolved } = resolveVariableOwner(variable);
  return {
    variable: unresolved
      ? { ...variable, owner, migrationStatus: OWNER_UNRESOLVED }
      : { ...variable, owner },
    changed: true,
  };
}

export interface VariableOwnerMigrationReport {
  projectId: string | null;
  total: number;
  byScope: Record<VariableScope, number>;
  unresolved: Array<{ id: string; name: string; scope: VariableScope }>;
  /** unresolved / total (total 0 이면 0) — G0 "프로젝트별·전체 비율" */
  unresolvedRatio: number;
}

/**
 * G0 계수기 — builder 콘솔:
 * `countVariableOwnerMigration([...useDataStore.getState().variables.values()], projectId)`
 */
export function countVariableOwnerMigration(
  variables: readonly Variable[],
  projectId: string | null = null,
): VariableOwnerMigrationReport {
  const byScope: Record<VariableScope, number> = {
    global: 0,
    page: 0,
    component: 0,
  };
  const unresolved: VariableOwnerMigrationReport["unresolved"] = [];
  for (const variable of variables) {
    const scope: VariableScope =
      variable.scope === "page" || variable.scope === "component"
        ? variable.scope
        : "global";
    byScope[scope] += 1;
    if (resolveVariableOwner(variable).unresolved) {
      unresolved.push({ id: variable.id, name: variable.name, scope });
    }
  }
  const total = variables.length;
  return {
    projectId,
    total,
    byScope,
    unresolved,
    unresolvedRatio: total === 0 ? 0 : unresolved.length / total,
  };
}

/** 로드 경계 진입점 — 변환 + 계수 + (unresolved > 0 이면) 로그 1회 */
export function migrateVariableOwners(
  variables: readonly Variable[],
  options: { projectId: string | null },
): { variables: Variable[]; report: VariableOwnerMigrationReport } {
  const migrated = variables.map(
    (variable) => migrateVariableOwner(variable).variable,
  );
  const report = countVariableOwnerMigration(migrated, options.projectId);
  if (report.unresolved.length > 0) {
    console.warn(
      `[ADR-214] Variable owner-unresolved ${report.unresolved.length}/${report.total} (project ${options.projectId ?? "?"}) — component / page-without-page_id 를 project 로 승격했습니다:`,
      report.unresolved,
    );
  }
  return { variables: migrated, report };
}
