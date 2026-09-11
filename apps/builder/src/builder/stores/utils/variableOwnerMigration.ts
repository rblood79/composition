/**
 * ADR-214 Phase 1 — `Variable.owner` additive + 결정적 변환 (HC3 · R4 · Round 1 m4).
 *
 * 규칙 (전량 결정적, 사용자 입력 없음):
 * - `global`              → `{ kind: "project" }`
 * - `page` + `page_id`    → `{ kind: "page", pageId }`
 * - `component`           → `{ kind: "project" }` + `migrationStatus: "owner-unresolved"`
 * - `page` without `page_id` → HC3 가 다루지 않는 사례. 현행 UI 는 `page_id` 를 한 번도
 *   쓰지 않아 (Phase 0 evidence §1 · §5) 실 데이터의 `page` 는 대부분 이 형태다.
 *   **사용자 판정 C (2026-09-11)**: 프로젝트 페이지가 **1개뿐이면 그 페이지** — 유일하게
 *   결정적인 경우라 지어내는 것이 아니다. 페이지 목록을 모르거나 2개 이상이면
 *   `{ kind: "project" }` + `owner-unresolved` (페이지를 알 수 없으니 지어내지 않는다).
 *
 * **로드 재직렬화 0** (G1): 변환 결과는 메모리 Map 에만 들어간다. IndexedDB 원본은 그 변수를
 * 다음에 저장할 때 (`define_variable` 적용기) 비로소 `owner` 를 갖는다. 예외 하나 — C 자동
 * 귀속은 `fetchVariables` 가 그 변수의 `page_id` 만 1회 write-back 해 고정한다 (사용자 지시
 * 2026-09-11; ADR-152 의 id 없는 collection 1회 write-back 과 같은 한정 예외). 그래서 페이지가
 * 늘어도 귀속이 유지된다.
 * **조용한 변환 0**: unresolved 가 1건이라도 있으면 프로젝트당 warn 1회 + 배지
 * (`migrationStatus`), C 자동 귀속이 1건이라도 있으면 info 1회.
 */
import { OWNER_UNRESOLVED, type VariableOwner } from "@composition/shared";
import { isComponentsPageMirror } from "../../pages/systemComponentsPage";
import type {
  Variable,
  VariableScope,
} from "../../../types/builder/data.types";

export interface VariableOwnerMigrationContext {
  /** 프로젝트의 페이지 id 목록 — 모르면 생략 (C 자동 귀속 없음) */
  pageIds?: readonly string[];
}

export interface ResolvedVariableOwner {
  owner: VariableOwner;
  /** project 승격이 사용자 의도와 어긋날 수 있는 항목 (component · page without page_id) */
  unresolved: boolean;
  /** 판정 C — page_id 없는 page 변수를 유일한 페이지로 귀속한 경우 */
  pageAssigned?: true;
}

function hasPageId(variable: Variable): variable is Variable & {
  page_id: string;
} {
  return typeof variable.page_id === "string" && variable.page_id.length > 0;
}

export function resolveVariableOwner(
  variable: Variable,
  context: VariableOwnerMigrationContext = {},
): ResolvedVariableOwner {
  if (variable.owner) {
    return {
      owner: variable.owner,
      unresolved: variable.migrationStatus === OWNER_UNRESOLVED,
    };
  }
  switch (variable.scope) {
    case "page": {
      if (hasPageId(variable)) {
        return {
          owner: { kind: "page", pageId: variable.page_id },
          unresolved: false,
        };
      }
      const pageIds = context.pageIds;
      if (pageIds && pageIds.length === 1) {
        return {
          owner: { kind: "page", pageId: pageIds[0] },
          unresolved: false,
          pageAssigned: true,
        };
      }
      return { owner: { kind: "project" }, unresolved: true };
    }
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
export function migrateVariableOwner(
  variable: Variable,
  context: VariableOwnerMigrationContext = {},
): MigratedVariable {
  if (variable.owner) return { variable, changed: false };
  const { owner, unresolved } = resolveVariableOwner(variable, context);
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
  /** 판정 C 로 유일한 페이지에 귀속된 page 변수 */
  pageAssigned: Array<{ id: string; name: string; pageId: string }>;
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
  context: VariableOwnerMigrationContext = {},
): VariableOwnerMigrationReport {
  const byScope: Record<VariableScope, number> = {
    global: 0,
    page: 0,
    component: 0,
  };
  const unresolved: VariableOwnerMigrationReport["unresolved"] = [];
  const pageAssigned: VariableOwnerMigrationReport["pageAssigned"] = [];
  for (const variable of variables) {
    const scope: VariableScope =
      variable.scope === "page" || variable.scope === "component"
        ? variable.scope
        : "global";
    byScope[scope] += 1;
    const resolved = resolveVariableOwner(variable, context);
    if (resolved.unresolved) {
      unresolved.push({ id: variable.id, name: variable.name, scope });
    } else if (resolved.pageAssigned && resolved.owner.kind === "page") {
      pageAssigned.push({
        id: variable.id,
        name: variable.name,
        pageId: resolved.owner.pageId,
      });
    }
  }
  const total = variables.length;
  return {
    projectId,
    total,
    byScope,
    unresolved,
    pageAssigned,
    unresolvedRatio: total === 0 ? 0 : unresolved.length / total,
  };
}

/** 로드 경계 진입점 — 변환 + 계수 + (unresolved > 0 이면) warn 1회 · (자동 귀속 > 0 이면) info 1회 */
export function migrateVariableOwners(
  variables: readonly Variable[],
  options: { projectId: string | null } & VariableOwnerMigrationContext,
): { variables: Variable[]; report: VariableOwnerMigrationReport } {
  const context: VariableOwnerMigrationContext = { pageIds: options.pageIds };
  // 계수는 변환 전 원본으로 (변환 뒤에는 pageAssigned 표식이 owner 에 흡수된다)
  const report = countVariableOwnerMigration(
    variables,
    options.projectId,
    context,
  );
  const migrated = variables.map(
    (variable) => migrateVariableOwner(variable, context).variable,
  );
  if (report.pageAssigned.length > 0) {
    console.info(
      `[ADR-214] Variable page 귀속 ${report.pageAssigned.length}건 (project ${options.projectId ?? "?"}) — page_id 없는 page 변수를 유일한 페이지로 귀속했습니다 (판정 C):`,
      report.pageAssigned,
    );
  }
  if (report.unresolved.length > 0) {
    console.warn(
      `[ADR-214] Variable owner-unresolved ${report.unresolved.length}/${report.total} (project ${options.projectId ?? "?"}) — component / page-without-page_id (페이지 2개 이상) 를 project 로 승격했습니다:`,
      report.unresolved,
    );
  }
  return { variables: migrated, report };
}

// ─────────────────────────────────────────────
// 페이지 목록 공급자 — data store 가 elements store 를 import 하면 순환이라
// `stores/index.ts` 가 등록한다 (ADR-213 `registerDataBindingConsumer` 와 같은 패턴).
// ─────────────────────────────────────────────

let pageIdsSource: (() => readonly string[]) | null = null;

/**
 * 판정 C 의 "프로젝트 페이지" = 사용자 페이지만. 시스템 Components 페이지 (`page-components`,
 * 스토어 `pages` 에 항상 같이 실린다 — live 실측 2026-09-11) 를 세면 Home 뿐인 프로젝트도
 * 2개가 되어 C 가 한 번도 동작하지 않는다.
 */
export function selectUserPageIds(
  pages: readonly { id: string; slug?: string | null }[],
): string[] {
  return pages
    .filter((page) => !isComponentsPageMirror(page))
    .map((page) => page.id);
}

export function registerVariableOwnerPageSource(
  source: (() => readonly string[]) | null,
): void {
  pageIdsSource = source;
}

/** 등록된 공급자가 없으면 `undefined` (C 자동 귀속 없음 — 모르면 지어내지 않는다). */
export function readVariableOwnerPageIds(): readonly string[] | undefined {
  return pageIdsSource ? pageIdsSource() : undefined;
}
