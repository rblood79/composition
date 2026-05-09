# ADR-123 Phase 0 — Inventory Freeze (2026-05-10)

본 문서는 [ADR-123 design breakdown §2](123-cloud-document-row-schema-breakdown.md) 의 Phase 0
inventory 측정 결과를 freeze 한다. main HEAD `f54c2495c` 기준.

## 1. Production hot path 6 surface 버킷 확정

| Surface                                                | 파일:line                                                                                                                                                                                                                                                                                   | 현재 의미                                                                                      | 목표 버킷                                                                                                     |
| ------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------- |
| **S1** Supabase row schema                             | `apps/builder/src/types/integrations/supabase.types.ts:150-172`                                                                                                                                                                                                                             | `pages`/`elements` row 타입 정의 (`page_id`/`parent_id`/`order_num`)                           | migration window fallback 타입 (Phase 1 에서 `documents` row 타입 추가)                                       |
| **S2** legacyElementsApiService production callers (5) | `services/api/index.ts:6,114` (re-export) / `utils/projectSync.ts:10,113,115,121,180,200` / `dashboard/index.tsx:311,319` / `adapters/canonical/canonicalMutations.ts:49,1707,1721,1733` / `builder/factories/utils/dbPersistence.ts:2`                                                     | `elements` row CRUD 직접 호출                                                                  | boundary adapter 화 (Phase 4 에서 hot path import 0건)                                                        |
| **S3** PagesApiService production callers (4)          | `services/api/index.ts:18,116` (re-export) / `utils/projectSync.ts:9,94,98,174` / `dashboard/index.tsx:305,313` / `builder/hooks/usePageManager.ts:4` (type-only)                                                                                                                           | `pages` row CRUD 직접 호출                                                                     | boundary adapter 화 (Phase 4 에서 hot path import 0건, type-only import 는 allowlist 유지)                    |
| **S4** canonicalMutations thin wrapper 3개             | `adapters/canonical/canonicalMutations.ts:1704,1717,1730` (`createElementCanonicalPrimary` / `updateElementCanonicalPrimary` / `createMultipleElementsCanonicalPrimary`) — caller: `dbPersistence.ts:128,139` / `elements.ts:896` / `useIframeMessenger.ts:221`                             | thin pass-through (`return elementsApi.createElement(...)` 등)                                 | documents row API 위임으로 교체 또는 제거 (Phase 4)                                                           |
| **S5** dashboard seed cloud 경로                       | `dashboard/index.tsx:302-320` (cloud/both 분기 — `pagesApi.createPage` + `elementsApi.createElement`)                                                                                                                                                                                       | cloud project 생성 시 element-level seed                                                       | `documentsApi.upsertDocument` 단일 호출 (Phase 3)                                                             |
| **S6** projectSync element-level upsert                | `utils/projectSync.ts:90-130` (write path: `pagesApi.updatePage`/`createPage` + `elementsApi.deleteMultipleElements` + `createMultipleElements`), `utils/projectSync.ts:170-220` (read path: `pagesApi.getPagesByProjectId` + `elementsApi.getElementsByPageId` + `legacyToCanonical(...)`) | syncProjectToCloud (element batch delete+insert), downloadProjectFromCloud (legacyToCanonical) | `documentsApi.upsertDocument` / `documentsApi.getDocumentByProjectId` 단일 호출 + legacy fallback (Phase 2-3) |

## 2. legacyToCanonical hot path

production caller (excluding tests/comments):

```
apps/builder/src/utils/projectSync.ts:210
apps/builder/src/adapters/canonical/index.ts:127  (export site)
```

Non-production (test/JSDoc): `themesAdapter.ts:56` / `variablesAdapter.ts:64` /
`composition-document.types.ts:86` / `storeBridge.ts:60` / 19 test files (integration / themes /
variables / persistenceWriteThroughStub / legacyExtensionRoundtrip / canonicalMutations).

**Phase 4-5 grep gate B 대상**: `projectSync.ts:210` 한 곳만 production hot path. Phase 2 read path
재작성 시 fallback 블록으로 격리되어야 함.

## 3. canonicalMutations thin wrapper 3개 caller 매핑

| Wrapper                                  | line | Production caller           |
| ---------------------------------------- | ---- | --------------------------- |
| `createElementCanonicalPrimary`          | 1704 | `dbPersistence.ts:128,139`  |
| `updateElementCanonicalPrimary`          | 1717 | `elements.ts:896`           |
| `createMultipleElementsCanonicalPrimary` | 1730 | `useIframeMessenger.ts:221` |

3개 wrapper 모두 `return elementsApi.{method}(...)` thin pass-through. Phase 4 처리 옵션:

1. **제거** — caller 를 `documentsApi.upsertDocument` 경유로 전환
2. **위임** — wrapper 내부 구현을 documents row API 호출로 재작성 (caller signature 유지)

dbPersistence/useIframeMessenger 의 caller 가 element-level granularity 를 요구하는지 Phase 1
DocumentsApiService 인터페이스 설계 시 결정.

## 4. CompositionDocument payload 크기 추정

Phase 0 정성 측정 (browser DevTools 기반 측정은 Phase 1 진입 전 수행):

| 측정 방식                           | 추정값      | 근거                                              |
| ----------------------------------- | ----------- | ------------------------------------------------- |
| 빈 프로젝트 (page 1, body 1)        | < 5 KB      | canonical document 최소 schema (frame + 자식 1개) |
| 전형 프로젝트 (50-100 elements)     | 50-200 KB   | element 당 평균 1-2 KB props serialized           |
| 대규모 프로젝트 (500-1000 elements) | 500 KB-2 MB | 동일 element 당 추정                              |
| Supabase jsonb column 제약          | 1 GB        | Postgres jsonb 기본 제약                          |

**결론**: 통상 사용 범위에서 Supabase column 제약 (1 GB) 대비 충분히 여유 (3-4 orders of
magnitude). 대규모 프로젝트 (10000+ elements) 도 < 50 MB 추정 — column 제약 미위반.

Phase 1 에서 IndexedDB 의 실제 production document 크기 측정 (browser DevTools `db.documents`
inspect) 으로 본 추정 검증 예정.

## 5. Supabase `documents` table DDL (Phase 1 입력)

```sql
create table documents (
  id          uuid primary key default gen_random_uuid(),
  project_id  text not null references projects(id) on delete cascade,
  content     jsonb not null,
  created_at  timestamptz default now(),
  updated_at  timestamptz default now()
);
create index on documents (project_id);
create unique index on documents (project_id);  -- 1 project = 1 document

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

`unique index on documents (project_id)` 추가 — 1 project = 1 document 보장 (`upsertDocument`
의 conflict target 으로 사용).

## 6. DocumentsApiService 인터페이스 스텁

```typescript
// apps/builder/src/services/api/DocumentsApiService.ts (Phase 1 신규)

import type { CompositionDocument } from "@composition/shared";

export interface DocumentsApi {
  /** project_id 로 documents row 조회. row 없으면 null. */
  getDocumentByProjectId(
    projectId: string,
  ): Promise<CompositionDocument | null>;

  /** project_id 기준 upsert. 1 project = 1 document. */
  upsertDocument(projectId: string, doc: CompositionDocument): Promise<void>;

  /** project 삭제 시 cascade. (projects FK on delete cascade 가 자동 처리, 명시 호출 미필요) */
  deleteDocumentByProjectId?(projectId: string): Promise<void>;
}

export const documentsApi: DocumentsApi = {
  getDocumentByProjectId: async (projectId) => {
    /* Phase 1 구현 */ throw new Error("not implemented");
  },
  upsertDocument: async (projectId, doc) => {
    /* Phase 1 구현 */ throw new Error("not implemented");
  },
};
```

## Phase 0 G0 통과 결과

- [x] 6 surface 버킷 표 확정 (forbidden / boundary / migration fallback 분류)
- [x] JSON 크기 추정 결과: max(전형 프로젝트) ~ 2 MB, Supabase jsonb 제약 1 GB → 위반 0
- [x] `documents` table DDL 설계 + RLS policy 설계 + unique constraint 명시
- [x] `DocumentsApiService` 인터페이스 스텁 설계 완료
- [x] Phase 1 진입 가능 — Supabase migration 파일 작성으로 직진
