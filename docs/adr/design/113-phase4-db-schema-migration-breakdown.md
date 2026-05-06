# ADR-113 Phase 4 Implementation Breakdown — Direct Cutover `tag → type`

> **2026-05-02 direct cutover 정정**: 기존 사용자/데이터 보존 의무가 없는 개발 단계이므로 본 문서의 DB migration / backup / env flag / rollback 계획은 superseded 됐다. `runTagTypeMigration`, `normalizeLegacyElement`, dry-run entry 는 제거됐고, 현행 format 은 `Element.type` 단일 기준이다.

## 1. 목표 + Gate G5-E

ADR-113 line 135 G5-E:

| 조건 | 정의                                     |
| ---- | ---------------------------------------- |
| (a)  | `Element.type` 단일 기준 유지            |
| (b)  | `tag` read-through/migration helper 제거 |
| (c)  | 신규 write/read path type-only           |
| (d)  | runtime DB migration/backup 없음         |
| (e)  | targeted test/type-check 검증            |

실패 시 fallback/rollback 은 두지 않고 runtime path 를 수정한다.

## 2. 인프라 재사용 (ADR-903 P3-E 결과)

기존 land 된 자산을 그대로 재사용. 신규 구축 0.

| 자산                                | 위치                                 | 역할                                            |
| ----------------------------------- | ------------------------------------ | ----------------------------------------------- |
| `_meta` object store + `MetaRecord` | `apps/builder/src/lib/db/types.ts`   | `schemaVersion` 추적 (composition-1.0 / legacy) |
| `createMigrationBackup`             | 제거됨                               | direct cutover 로 불필요                        |
| `runLegacyToCanonicalMigration`     | 제거됨                               | direct cutover 로 불필요                        |
| migration test fixtures             | `apps/builder/src/lib/db/__tests__/` | 50+ fixture (round-trip baseline)               |

본 Phase 4 는 동일 패턴을 `tag → type` 변환으로 확장.

## 3. Sub-step 분해 (4-3-1, 4-3-2 ... 형식)

ADR-903 P3-E 의 E-1~E-6 모델을 그대로 답습. 각 step 은 독립 commit/PR 가능 단위.

### Sub-step 진행 상태 (2026-04-27 기준)

| Step | 산출물                                                            |        상태        | 검증                                                                                |
| ---- | ----------------------------------------------------------------- | :----------------: | ----------------------------------------------------------------------------------- |
| 4-1  | DB_VERSION 8→9 bump + `composition-1.1` enum                      | ✅ Land 2026-04-27 | metaStore.test.ts 5 PASS / commit `0e9b5101`                                        |
| 4-2  | `runTagTypeMigration` dry-run (READ-ONLY)                         | ✅ Land 2026-04-27 | `migrationTagType.test.ts` 16 PASS (50 fixture round-trip 포함) / commit `79aaf808` |
| 4-3  | `usePageManager.initializeProject` dry-run entry 연결 (READ-ONLY) | ✅ Land 2026-04-27 | type-check 3/3 + db 142/142 + usePageManager.canonical 회귀 0 / commit `19864dfe`   |
| 4-4  | write-through 활성화 / env flag                                   |        폐기        | direct cutover 로 불필요                                                            |
| 4-5  | `normalizeLegacyElement` helper 제거                              |   ✅ 2026-05-02    | direct cutover                                                                      |
| 4-6  | Validation + cleanup                                              |   ✅ 2026-05-02    | targeted vitest 포함                                                                |

### Step 4-1 — DB_VERSION bump + onupgradeneeded 분기 (READ-ONLY land) — ✅ Land 2026-04-27 `0e9b5101`

**산출물**:

- `apps/builder/src/lib/db/indexedDB/adapter.ts:33` — `DB_VERSION 8 → 9`
- `onupgradeneeded` handler 에 `oldVersion < 9` 분기 추가:
  - 기존 8→9 schema 변경 (예: `tag` index 가 있으면 제거 후 `type` index 추가, 또는 둘 다 유지)
  - **현재 elements store 에 `tag` index 미존재** (확인 필요 — adapter.ts grep 결과 미존재) → schema 변경 최소화
- `MetaRecord.schemaVersion` 신규 enum 값 `"composition-1.1"` 추가 (composition-1.0 = tag 기반 / composition-1.1 = type 기반)

**비파괴**: `_meta.set("composition-1.0")` 인 기존 프로젝트는 그대로 read-through 동작 (tag 기반). 새 프로젝트만 1.1 로 진입.

**검증**:

- `pnpm vitest run apps/builder/src/lib/db/__tests__/metaStore.test.ts` PASS
- DB_VERSION 8 IndexedDB 가 있는 dev 환경에서 새로고침 → 9 로 자동 upgrade + status=skipped (기존 데이터 영향 0)

### Step 4-2 — `runTagTypeMigration` dry-run (READ-ONLY) — ✅ Land 2026-04-27 `79aaf808`

**Land 시 변경**: design 의 `apps/builder/src/lib/db/migration.ts` 내 추가 가이드 → 실제로는 **신규 파일 `apps/builder/src/lib/db/migrationTagType.ts` 분리** (ADR-903 P3-E `runLegacyToCanonicalMigration` 과 독립 schema 차원, 책임 분리). 산출물:

- `transformElementTagToType(el)` pure transformer 추출 (테스트 친화)
- `runTagTypeMigration(adapter, projectId, { dryRun=true })` — composition-1.1 already-migrated → `skipped` / `dryRun=false` → throw (Step 4-4 미구현 안내)
- `__tests__/migrationTagType.test.ts` 16 tests (TC-T1~T5 transformer + TC-M1~M11 integration, 50 fixture round-trip 포함)

**원본 design 산출물** (`apps/builder/src/lib/db/migration.ts` 내 추가):

```ts
export async function runTagTypeMigration(
  projectId: string,
  options: { dryRun?: boolean } = {},
): Promise<MigrationResult> {
  const { dryRun = true } = options;

  // 1. _meta.get — 이미 composition-1.1 이면 skip
  const existing = await adapter.meta.get(projectId);
  if (existing?.schemaVersion === "composition-1.1") {
    return { status: "skipped", reason: "already-1.1" };
  }

  // 2. backup (dry-run 도 backup 생성 — fallback 안전망)
  await createMigrationBackup(projectId, "tag-to-type");

  // 3. elements.getAll — read-only
  const elements = await adapter.elements.getAll();

  // 4. transform: tag 필드 → type 필드 (값 동일, 키만 rename)
  const transformed = elements.map((el) => {
    if ((el as any).tag !== undefined && el.type === undefined) {
      return { ...el, type: (el as any).tag, tag: undefined };
    }
    return el;
  });

  // 5. dry-run: 결과 검증만 + status return
  if (dryRun) {
    return {
      status: "success",
      transformedCount: transformed.length,
      dryRun: true,
    };
  }

  // 6. write-through (Step 4-4 에서 활성화)
  // ... (Step 4-4)
}
```

**검증 fixture**:

- 50+ legacy elements (`{ tag: "Button", ... }`) → transformed 결과 검증 (`{ type: "Button", ... }`)
- migration round-trip: legacy → tag-to-type → 결과 = canonical schema (`type` 필드만)
- edge case: `tag` 와 `type` 동시 존재 → `type` 우선 보존

### Step 4-3 — `initializeProject` migration entry 연결 (READ-ONLY dry-run) — ✅ Land 2026-04-27 `19864dfe`

**Land 시 변경**: 실 entry 위치는 `apps/builder/src/services/project/initialization.ts` 가 아닌 **`apps/builder/src/builder/hooks/usePageManager.ts::initializeProject`** (ADR-903 P3-E `runLegacyToCanonicalMigration` 호출 site 와 동일). P3-E migration 호출 직후에 P4 dry-run 추가.

**산출물**:

- `apps/builder/src/builder/hooks/usePageManager.ts` import + 진입 조건 분기:
  - `metaRecord` 미존재 또는 `schemaVersion ∈ {legacy, composition-1.0}` → `runTagTypeMigration(db, projectId, { dryRun: true })`
  - composition-1.1 이미 진입 시 함수 내부에서 skipped 반환 (entry 호출은 발생하지만 단순 skip)
- dev console.log 으로 결과 로깅:
  - skipped: `[ADR-113 P4 dry-run] skipped: ${reason}`
  - 일반: `[ADR-113 P4 dry-run] status=${status}, transformedCount=N/M, errors=K`
  - transformedCount > 0 시: `${N} elements need tag→type migration`
- try/catch — measurement 실패는 `console.warn` 로 graceful degrade (BC 보장)
- write-through 미진입 — Step 4-4 까지 read-only

**검증**:

- dev 환경 새로고침 → console 에 dry-run 결과 표시
- `_meta.schemaVersion` 그대로 유지 (composition-1.0 또는 unset)
- type-check 3/3 PASS / db 영역 vitest 142/142 PASS

### Step 4-4 — write-through 활성화 (`dryRun=false`)

**산출물**:

- `runTagTypeMigration` write-through branch 활성화:

```ts
if (!dryRun) {
  try {
    await adapter.elements.updateMany(transformed);
    await adapter.meta.set({
      projectId,
      schemaVersion: "composition-1.1",
      migratedAt: Date.now(),
    });
    return { status: "success", transformedCount: transformed.length };
  } catch (err) {
    // fallback: schemaVersion = legacy (read-through 유지)
    await adapter.meta.set({
      projectId,
      schemaVersion: "legacy",
      lastError: String(err),
    });
    console.warn("[ADR-113 P4] migration failed, falling back to legacy:", err);
    return { status: "failure", error: err };
  }
}
```

- `initializeProject` 의 dry-run 호출을 `dryRun: false` 로 전환 (env flag 으로 제어)

**환경 변수 control**:

- `VITE_ADR113_P4_WRITE_THROUGH=true` 일 때만 write-through 진입 (rollback 경로 보장)
- prod build 진입 전 dev 환경 충분 검증 (1주+ monitoring 권장)

### Step 4-5 — `normalizeLegacyElement` helper 제거 (cutover)

**산출물**:

- `apps/builder/src/lib/db/indexedDB/adapter.ts:46` 의 `(el as { tag?: string }).tag !== undefined` 검사 분기 제거
- `normalizeLegacyElement` (Phase 1+2 에서 backward compat 으로 추가된 helper) 호출 site 전수 grep + 제거
- `Element.tag` 타입 (legacy stub) 제거 → `Element.type` 만 SSOT

**진입 조건**:

- write-through 1주+ 안정 동작 (회귀 0건 사용자 보고)
- `_meta.schemaVersion` 분포 측정 — composition-1.1 비율 ≥ 95% (legacy fallback 5% 미만)

### Step 4-6 — Validation + cleanup

**산출물**:

- `apps/builder/src/lib/db/__tests__/migration-tag-type.test.ts` 신규 — 50+ fixture round-trip + edge case
- ADR-113 본문 Phase 4 진행 로그 entry
- CHANGELOG entry

## 4. localStorage backup 3중 안전망 (R3 매핑)

ADR-903 P3-E 의 패턴 재사용:

| 안전망                                    | 위치                                    | 역할                                      |
| ----------------------------------------- | --------------------------------------- | ----------------------------------------- |
| 1. localStorage backup                    | `migrationBackup.createMigrationBackup` | DB 변환 전 raw elements 직렬화            |
| 2. `_meta.schemaVersion: legacy` fallback | `runTagTypeMigration` catch 분기        | write 실패 시 자동 read-through 모드 복귀 |
| 3. IndexedDB ACID                         | `adapter.elements.updateMany` 트랜잭션  | partial 실패 시 전체 롤백                 |

복구 절차:

1. localStorage backup → `restoreMigrationBackup(projectId, "tag-to-type")` (수동 또는 자동)
2. `_meta.set({ schemaVersion: "legacy" })` 로 강제 read-through
3. dev 환경에서 dry-run 재진입

## 5. 회귀 위험 측정

ADR-113 line 121 R3 (DB schema 전환 시 데이터 손실) → **HIGH** mitigation:

| 위험                            | 측정                                                  | 수용 임계              |
| ------------------------------- | ----------------------------------------------------- | ---------------------- |
| migration write 실패            | `_meta.schemaVersion: legacy` 자동 fallback 호출 횟수 | < 5% (95% 성공)        |
| `tag`/`type` 동시 존재 elements | grep + transformer 우선순위 (`type` 우선)             | 0건 (transformer test) |
| backup restore 실패             | `restoreMigrationBackup` round-trip test              | 100% PASS              |
| dev 환경 수동 검증              | 50+ fixture 로 cycle (load → migrate → save → load)   | 회귀 0                 |

## 6. 검증 명령

### 단위 테스트

```bash
# Phase 4 직접 영향 영역
cd apps/builder
pnpm vitest run src/lib/db/__tests__/migration-tag-type.test.ts        # 신규
pnpm vitest run src/lib/db/__tests__/migration.test.ts                  # ADR-903 P3-E baseline 회귀 0
pnpm vitest run src/lib/db/__tests__/migrationBackup.test.ts            # backup 회귀 0
pnpm vitest run src/lib/db/__tests__/metaStore.test.ts                  # _meta store 회귀 0
```

### Type-check

```bash
pnpm type-check  # 3/3 PASS
```

### dev 환경 수동 검증 (Step 4-3 / 4-4)

1. dev 서버 시작 (`pnpm dev`)
2. 기존 프로젝트 (DB_VERSION 8, schemaVersion: composition-1.0) 로드
3. console 에서 `[ADR-113 P4 dry-run]` 로그 확인 — `tag → type` 변환 N 건
4. (Step 4-4 진입 후) `_meta.schemaVersion` 변경 확인
5. 새로고침 → dev console 에 `legacyToCanonicalRoundTrip` 정상 동작
6. legacy fallback 시 `_meta.schemaVersion: legacy` 표시 + console.warn

### 광역 회귀 sweep

```bash
# Skia 렌더링 회귀
pnpm vitest run packages/specs

# Builder integration
pnpm vitest run apps/builder/src/adapters/canonical
pnpm vitest run apps/builder/src/lib/db
```

목표: baseline 동일 또는 회귀 0건.

## 7. 진입 prerequisite

- ADR-113 Phase 1 + 2 + 3 land (✅ 본 세션 종결)
- ADR-903 P3-E E-6 패턴 재사용 (✅ Implemented 2026-04-26)
- ADR-116 G2 canonical store/API + canonical→legacy export adapter API 확정
- dev 환경 수동 검증 1주+ 가능 (사용자 동의)

## 8. 진입 비권장 시점

- ADR-116 Phase 0/1 이전 — canonical primary/shadow write 방향이 확정되지 않아 Step 4-4 write-through 의미가 바뀔 수 있음
- ADR-110 Phase 2 write-through 진입 시기와 겹침 — schema 동시 변경 위험
- prod 빌드 임박 시점 — write-through 활성화 후 1주+ 안정성 마진 필요

## 9. 종결 후 후속

- Phase 5 (Hybrid 6 cleanup, HIGH 2d, 313+ ref) 진입 prerequisite 충족
- ADR-113 Status `In Progress → Implemented` 승격 시점 = Phase 5 까지 완결
- `Element.tag` 타입 영구 제거 → SSOT 단일화 완료

## 관련 문서

- ADR-113: `docs/adr/completed/113-tag-type-rename-hybrid-cleanup.md`
- ADR-903 P3-E breakdown: `docs/adr/design/903-phase3e-persistence-breakdown.md` (620 LOC, 본 Phase 4 의 baseline 패턴)
- ADR-113 inventory: `docs/adr/design/113-tag-type-rename-inventory.md`
- ADR-116: `docs/adr/completed/116-canonical-document-ssot-transition.md`
- ADR-903: `docs/adr/completed/903-ref-descendants-slot-composition-format-migration-plan.md`
