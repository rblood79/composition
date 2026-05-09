# ADR-123 구현 상세 — Cloud document-level row schema 단일화

본 문서는 [ADR-123](../123-cloud-document-row-schema.md)의 phase plan, inventory,
gate 측정 방법을 정의한다. Phase 0 inventory freeze에서 6개 legacy surface의 버킷을 확정하고,
Phase 1~6을 순서대로 진행한다. 핵심은 cloud transport schema를 `CompositionDocument` 단일로
통일하는 것이다.

## 1. Target State

| Layer              | Target                                                             | 금지 대상                                                             |
| ------------------ | ------------------------------------------------------------------ | --------------------------------------------------------------------- |
| Cloud read         | `documents` row → `CompositionDocument` 직접 hydrate               | `pages`/`elements` row → `legacyToCanonical()` 재조립                 |
| Cloud write        | `documents` row upsert (CompositionDocument JSON)                  | element-level `createMultipleElements`/`deleteMultipleElements` batch |
| Dashboard seed     | cloud project 생성 시 `documents` row seed                         | `pagesApi.createPage` + `elementsApi.createElement` 직접 호출         |
| Boundary adapter   | `legacyElementsApiService.ts` / `PagesApiService.ts` boundary-only | Builder hot path에서 직접 import                                      |
| canonicalMutations | cloud persistence wrapper 명확화 (documents row API 위임)          | thin pass-through의 의미 불분명 유지                                  |

## 2. Current Legacy Surface Inventory Seed

Phase 0에서 아래 6개 surface를 실제 코드 기준으로 재측정하고 버킷을 확정한다.

| Surface                               | 파일                                                                  | 현재 의미                                                                                      | 목표 버킷                                                          |
| ------------------------------------- | --------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------- | ------------------------------------------------------------------ |
| S1 — Supabase row schema              | `apps/builder/src/types/integrations/supabase.types.ts:150-172`       | `pages`/`elements` row 타입 정의 (`page_id`/`parent_id`/`order_num`)                           | migration window fallback 타입으로 유지, `documents` row 타입 추가 |
| S2 — legacyElementsApiService         | `apps/builder/src/adapters/canonical/legacyElementsApiService.ts`     | `elements` row CRUD (createElement/updateElement/...)                                          | boundary adapter (Builder hot path 제거)                           |
| S3 — PagesApiService                  | `apps/builder/src/services/api/PagesApiService.ts`                    | `pages` row CRUD (createPage/updatePage/getPagesByProjectId)                                   | boundary adapter (Builder hot path 제거)                           |
| S4 — canonicalMutations thin wrapper  | `apps/builder/src/adapters/canonical/canonicalMutations.ts:1699-1733` | `createElementCanonicalPrimary` 등 3개 thin pass-through                                       | documents row API wrapper로 교체 또는 제거                         |
| S5 — dashboard seed cloud 경로        | `apps/builder/src/dashboard/index.tsx:302-320`                        | cloud project 생성 시 pagesApi.createPage + elementsApi.createElement                          | documents row seed로 전환                                          |
| S6 — projectSync element-level upsert | `apps/builder/src/utils/projectSync.ts`                               | syncProjectToCloud (element batch delete+insert), downloadProjectFromCloud (legacyToCanonical) | documents row upsert/fetch로 전환                                  |

Inventory grep seed:

```bash
# 6 surface 전수 확인
rg -n "from.*legacyElementsApiService|elementsApi\.(createElement|updateElement|createMultipleElements|getElementsByPageId|deleteMultipleElements)" \
  apps/builder/src -g '*.ts' -g '*.tsx'

rg -n "from.*PagesApiService|pagesApi\.(createPage|updatePage|getPagesByProjectId)" \
  apps/builder/src -g '*.ts' -g '*.tsx'

rg -n "createElementCanonicalPrimary|updateElementCanonicalPrimary|createMultipleElementsCanonicalPrimary" \
  apps/builder/src -g '*.ts' -g '*.tsx'

rg -n "legacyToCanonical\(" \
  apps/builder/src apps/publish/src packages/shared/src -g '*.ts' -g '*.tsx'
```

## 3. Phase Plan

| Phase   | Goal                                 | Main output                                              | Gate | Status                                                           |
| ------- | ------------------------------------ | -------------------------------------------------------- | ---- | ---------------------------------------------------------------- |
| Phase 0 | inventory freeze + payload 크기 측정 | 6 surface 버킷 확정 + `documents` table 설계             | G0   | **Done — 2026-05-10** ([123-inventory.md](123-inventory.md))     |
| Phase 1 | `documents` Supabase table 생성      | migration tooling + RLS policy + 타입 정의               | G1   | **Done — 2026-05-10** (migration 002 + DocumentsApiService)      |
| Phase 2 | cloud read path canonicalization     | download = `documents` row → CompositionDocument hydrate | G2   | **Done — 2026-05-10** (read path + seed + 6/6 G2 static test)    |
| Phase 3 | cloud write path canonicalization    | upload = CompositionDocument → `documents` row upsert    | G3   | **Done — 2026-05-10** (upsertDocument primary + dashboard seed)  |
| Phase 4 | legacy boundary quarantine           | row-level API hot path 제거 + boundary adapter 격리      | G4   | **Done — 2026-05-10** (boundary marker JSDoc + 5/5 G4 grep gate) |
| Phase 5 | stale tests/gates 재정렬             | ADR-123 aligned test suite + grep gate 0                 | G5   | Pending                                                          |
| Phase 6 | final verification                   | browser smoke + preflight + docs/rules sync              | G6   | Pending                                                          |

## 4. Phase 상세

### Phase 0 — Inventory freeze + payload 크기 측정

**목표**: 6개 legacy surface 버킷 확정. `CompositionDocument` payload 크기가 Supabase column
제약 내에 있는지 확인. `documents` Supabase table 스키마 설계 완료.

**작업**:

1. 6개 surface grep 실측 (§2 seed 명령 실행, 실제 caller 파일 목록 추출)
2. 상위 10개 프로젝트 `CompositionDocument` JSON 크기 측정:

   ```bash
   # IndexedDB documents 중 가장 큰 10개 JSON 크기 (browser DevTools)
   # 또는 test fixture 기반 추정
   ```

3. Supabase `documents` table DDL 설계:

   ```sql
   create table documents (
     id          uuid primary key default gen_random_uuid(),
     project_id  text not null references projects(id) on delete cascade,
     content     jsonb not null,
     created_at  timestamptz default now(),
     updated_at  timestamptz default now()
   );
   create index on documents (project_id);
   ```

4. RLS policy 설계 (project_id 기반):

   ```sql
   alter table documents enable row level security;
   create policy "owner can read"
     on documents for select
     using (project_id in (
       select id from projects where created_by = auth.uid()::text
     ));
   create policy "owner can write"
     on documents for all
     using (project_id in (
       select id from projects where created_by = auth.uid()::text
     ));
   ```

5. `DocumentsApiService` 인터페이스 스텁 설계 (Phase 1 구현 전 타입 확정).

**Gate G0 통과 조건**:

- 6 surface 버킷 표 확정 (forbidden / boundary / migration fallback 분류)
- JSON 크기 측정 결과: `max(10개 프로젝트 document size) < Supabase jsonb 제약 (기본 1GB)`
- DDL + RLS 설계 문서화 완료

---

### Phase 1 — `documents` Supabase table 생성

**목표**: Supabase에 `documents` table 생성 + RLS policy 적용. TypeScript 타입 추가.
`DocumentsApiService` 구현.

**작업**:

1. Supabase migration file 생성 (Phase 0 DDL 기반):

   ```
   supabase/migrations/YYYYMMDD_create_documents_table.sql
   ```

2. `apps/builder/src/types/integrations/supabase.types.ts`에 `documents` row 타입 추가:

   ```typescript
   documents: {
     Row: {
       id: string;
       project_id: string;
       content: CompositionDocument;
       created_at?: string;
       updated_at?: string;
     };
   };
   ```

3. `apps/builder/src/services/api/DocumentsApiService.ts` 신규 구현:

   ```typescript
   // getDocumentByProjectId(projectId: string): Promise<CompositionDocument | null>
   // upsertDocument(projectId: string, doc: CompositionDocument): Promise<void>
   ```

4. `apps/builder/src/adapters/canonical/legacyElementsApiService.ts`에
   "boundary-only" JSDoc 주석 추가 (hot path import 차단 의도 명확화).

**Gate G1 통과 조건**:

- `supabase/migrations/` 파일 존재
- `DocumentsApiService` 타입 체크 PASS
- Supabase local dev에서 `documents` table + RLS 생성 확인
- `pnpm run codex:typecheck` PASS

---

### Phase 2 — Cloud read path canonicalization

**목표**: `downloadProjectFromCloud`가 `documents` row를 먼저 시도한다. `documents` row가
없으면 legacy `pages`/`elements` fallback으로 `legacyToCanonical()` 변환을 수행한다 (migration
window 보호). Builder hot path에서 `legacyToCanonical()` 직접 호출 제거.

**작업**:

1. `apps/builder/src/utils/projectSync.ts`의 `downloadProjectFromCloud` 재작성:

   ```typescript
   // 1. documentsApi.getDocumentByProjectId(projectId) 시도
   // 2. documents row 존재 → db.documents.put(projectId, doc) → 완료
   // 3. documents row 없음 (migration fallback):
   //    - pages + elements row fetch
   //    - legacyToCanonical() 변환
   //    - db.documents.put(projectId, canonicalDoc) → 완료
   //    - (선택) documents row seed: documentsApi.upsertDocument(projectId, canonicalDoc)
   ```

2. 기존 `legacyToCanonical()` 직접 호출 경로를 fallback 블록으로 격리.

3. static guard test 작성:
   `apps/builder/src/utils/__tests__/projectSync.download.static.test.ts`
   - `documentsApi.getDocumentByProjectId` mock → documents row 반환 시 `legacyToCanonical` 미호출 검증
   - documents row null 반환 시 legacy fallback 진입 검증

**Gate G2 통과 조건**:

- `downloadProjectFromCloud`: documents row primary → legacy fallback 순서 동작 확인
- static guard test PASS
- `pnpm run codex:typecheck` PASS

---

### Phase 3 — Cloud write path canonicalization

**목표**: `syncProjectToCloud`가 `documents` row upsert 전용으로 전환. element-level
batch delete+insert 제거. dashboard seed cloud 경로가 `documents` row seed로 전환.

**작업**:

1. `apps/builder/src/utils/projectSync.ts`의 `syncProjectToCloud` 재작성:

   ```typescript
   // 1. db.documents.get(projectId) → CompositionDocument
   // 2. documentsApi.upsertDocument(projectId, document) 단일 upsert
   // 3. project metadata update (projects row) 유지
   // 4. pages/elements batch delete+insert 제거
   ```

2. `apps/builder/src/dashboard/index.tsx`의 cloud project 생성 경로 수정:

   ```typescript
   // cloud/both 분기에서:
   // - pagesApi.createPage() 제거
   // - elementsApi.createElement() 제거
   // + documentsApi.upsertDocument(newProject.id, initialDoc) 추가
   ```

3. static guard test 작성:
   `apps/builder/src/utils/__tests__/projectSync.upload.static.test.ts`
   - `syncProjectToCloud` 호출 시 `elementsApi.createMultipleElements` 미호출 검증
   - `documentsApi.upsertDocument` 호출 검증

4. dashboard seed test:
   `apps/builder/src/dashboard/__tests__/dashboardCloudSeed.static.test.ts`
   - cloud 분기에서 `pagesApi.createPage` 미호출 검증
   - `documentsApi.upsertDocument` 호출 검증

**Gate G3 통과 조건**:

- static guard tests PASS
- browser smoke: cloud project 생성 → sync → download → 재개 동작 확인
- `elementsApi.createMultipleElements` 호출 0건 (grep gate)
- `pnpm run codex:typecheck` PASS

---

### Phase 4 — Legacy boundary quarantine

**목표**: `legacyElementsApiService.ts`가 Builder hot path에서 import 0건. `PagesApiService`가
boundary adapter로만 참조됨. `canonicalMutations` thin wrapper 3개를 명확화 또는 제거.

**작업**:

1. `canonicalMutations.ts` wrapper 3개 (`createElementCanonicalPrimary` / `updateElementCanonicalPrimary` /
   `createMultipleElementsCanonicalPrimary`) 처리:
   - Phase 3 완료 후 실제 caller가 0건인지 확인 → 0건이면 제거
   - caller 존재 시 → documents row API 위임으로 재작성 또는 제거 계획 수립

2. `legacyElementsApiService.ts` import 경로 grep:

   ```bash
   rg -n "from.*legacyElementsApiService" apps/builder/src -g '*.ts' -g '*.tsx' \
     -g '!**/__tests__/**' -g '!**/*.test.ts'
   ```

   → `projectSync.ts`(Phase 3 이후 제거됨) 외 hot path 0건 목표.

3. `PagesApiService` import grep:

   ```bash
   rg -n "from.*PagesApiService|pagesApi\." apps/builder/src -g '*.ts' -g '*.tsx' \
     -g '!**/__tests__/**' -g '!**/*.test.ts'
   ```

   → `projectSync.ts`(boundary only) 외 hot path 0건 목표.

4. 잔존 hot path import 발견 시 해당 caller를 `DocumentsApiService` 경유로 전환.

**Gate G4 통과 조건**:

- `legacyElementsApiService` hot path import grep 0건
- `PagesApiService` hot path import grep 0건 (boundary allowlist 제외)
- `canonicalMutations` thin wrapper 3개 제거 또는 documents row API 위임 완료
- `pnpm run codex:typecheck` PASS

---

### Phase 5 — Stale tests/gates 재정렬

**목표**: Phase 2-4 변경으로 stale화된 기존 테스트 재정렬. ADR-123 aligned grep gate 확정.
`pnpm run codex:typecheck` PASS.

**작업**:

1. 기존 `projectSync` 관련 테스트 재확인 + stale 테스트 업데이트:

   ```bash
   pnpm -F @composition/builder exec vitest run \
     src/utils/__tests__/projectSync.download.static.test.ts \
     src/utils/__tests__/projectSync.upload.static.test.ts \
     src/dashboard/__tests__/dashboardCloudSeed.static.test.ts
   ```

2. `legacyElementsApiService` / `PagesApiService` 관련 기존 테스트 중 stale 항목 정리.

3. ADR-123 최종 grep gate 확정:

   ```bash
   # Gate A: Builder hot path에서 elements row 직접 호출 0건
   rg -n "\.from\(['\"]elements['\"]|\.from\(['\"]pages['\"]" \
     apps/builder/src -g '*.ts' -g '*.tsx' \
     -g '!**/__tests__/**' -g '!**/*.test.ts' \
     -g '!**/legacyElementsApiService*' -g '!**/PagesApiService*'

   # Gate B: legacyToCanonical hot path 호출 0건
   rg -n "legacyToCanonical\(" \
     apps/builder/src -g '*.ts' -g '*.tsx' \
     -g '!**/__tests__/**' -g '!**/*.test.ts' \
     -g '!**/projectSync*'
   ```

**Gate G5 통과 조건**:

- static guard tests PASS
- grep gate A, B 모두 0건
- `pnpm run codex:typecheck` PASS

---

### Phase 6 — Final verification

**목표**: browser smoke 전체 경로 확인. `pnpm run codex:preflight` PASS.
docs/rules/CHANGELOG sync. ADR Implemented 승격.

**Browser smoke 체크리스트**:

- [ ] cloud project 신규 생성 → `documents` row seed 확인 (Supabase dashboard)
- [ ] `syncProjectToCloud` 실행 → `documents` row upsert 확인, `elements` row 미변경
- [ ] `downloadProjectFromCloud` 실행 → `documents` row primary hydrate 확인
- [ ] 기존 `pages`/`elements` row만 있는 프로젝트 → fallback download 동작 확인
- [ ] Builder 편집 → sync → download → 재개 후 편집 내용 보존 확인

**Gate G6 통과 조건**:

```bash
# 최종 type check
pnpm run codex:typecheck

# 최종 grep gate (A + B)
rg -n "\.from\(['\"]elements['\"]|\.from\(['\"]pages['\"]" \
  apps/builder/src -g '*.ts' -g '*.tsx' \
  -g '!**/__tests__/**' -g '!**/*.test.ts' \
  -g '!**/legacyElementsApiService*' -g '!**/PagesApiService*'

rg -n "legacyToCanonical\(" \
  apps/builder/src -g '*.ts' -g '*.tsx' \
  -g '!**/__tests__/**' -g '!**/*.test.ts' \
  -g '!**/projectSync*'

# preflight
pnpm run codex:preflight
```

## 5. ADR-123 의존 관계

```
ADR-116 (canonical primary) ─────┐
ADR-120/121 (local cleanup) ─────┤──→ ADR-122 (runtime cleanup) ──→ ADR-123 (cloud cleanup)
                                  │                                         │
                                  └─────────────────────────────────────────┘
                                                                            ↓
                                                                     ADR-126 (Element type deprecate)
```

ADR-123은 ADR-122 boundary allowlist의 cloud side를 정리한다.
ADR-126은 ADR-123 G6 완료 후 착수 가능 (cloud row schema cleanup이 prerequisite).
