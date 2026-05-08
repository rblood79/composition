# ADR-121 Breakdown: IndexedDB legacy surface cleanup

## Goal

`composition` IndexedDB에서 ADR-120 이후 남은 dormant legacy store/API와 stale schema
documentation을 제거한다. Project document state primary는 계속 `documents`이다.

## Implementation Status

Implemented — 2026-05-08.

| Phase   | Status      | Result                                                                     |
| ------- | ----------- | -------------------------------------------------------------------------- |
| Phase 0 | Implemented | active/dormant/API-only/doc-drift bucket 재확인                            |
| Phase 1 | Implemented | `metadata` store/API/type/batch payload 제거                               |
| Phase 2 | Implemented | duplicate `composition.history` store/API와 dashboard clear-only call 제거 |
| Phase 3 | Implemented | consumer 0건인 `designVariables` adapter API 제거, store 생성 금지 유지    |
| Phase 4 | Implemented | `DB_VERSION` 15 + delete-only cleanup allowlist 확장                       |
| Phase 5 | Implemented | `docs/reference/schemas/INDEXDB.md` v15 current schema 재작성              |
| Phase 6 | Implemented | grep gates, targeted vitest, browser smoke, preflight 검증                 |

## Execution Prompt

구현에 사용한 cleanup 프롬프트:

```text
ADR-121을 실행해.

목표:
- IndexedDB `composition` DB에서 dormant legacy surface를 제거한다.
- `documents`는 project document state primary로 유지한다.
- `metadata` sync store/API, `composition.history` duplicate store/API, consumer 없는
  `designVariables` adapter mismatch를 정리한다.
- `composition-history` 별도 DB는 current undo/redo persistence이므로 삭제하지 않는다.
- active stores(`projects`, `documents`, `design_tokens`, `design_themes`,
  `data_tables`, `api_endpoints`, `variables`, `transformers`)는 유지한다.

필수 읽기:
- docs/adr/completed/121-indexeddb-legacy-surface-cleanup.md
- docs/adr/design/121-indexeddb-legacy-surface-cleanup-breakdown.md
- docs/adr/design/121-indexeddb-legacy-surface-inventory.md
- apps/builder/src/lib/db/indexedDB/adapter.ts
- apps/builder/src/lib/db/types.ts
- apps/builder/src/builder/stores/history/historyIndexedDB.ts
- docs/reference/schemas/INDEXDB.md

작업 순서:
1. Phase 0 grep으로 inventory를 갱신하고 active/dormant/API-only/doc-drift bucket을 확정한다.
2. `metadata` 제거:
   - `SyncMetadata`, `DatabaseAdapter.metadata`, `batch.export/import` metadata payload 제거.
   - IndexedDB `metadata` objectStore create path 제거.
   - DB upgrade delete-only allowlist에 `metadata` 추가.
3. `composition.history` 제거:
   - `DatabaseAdapter.history`, `HistoryEntry` DB adapter type, `history` objectStore create path 제거.
   - `dashboard/index.tsx`의 `db.history.clear(page.id)` 제거.
   - `historyIndexedDB.clearPageHistory(page.id)`는 유지한다.
   - DB upgrade delete-only allowlist에 `history` 추가.
4. `designVariables` adapter mismatch 정리:
   - production `db.designVariables.*` consumer가 여전히 0건이면 `DatabaseAdapter.designVariables`
     및 `IndexedDBAdapter.designVariables` 구현을 제거한다.
   - `design_variables` objectStore를 새로 만들지 않는다.
   - 혹시 기존 dev DB에 store가 있으면 delete-only allowlist로 삭제한다.
5. `DB_VERSION`을 15로 올리고 `metadata`/`history`/`design_variables` stale store 삭제를
   테스트로 고정한다.
6. `docs/reference/schemas/INDEXDB.md`를 current schema로 재작성한다.
   - `pages`/`elements`/`layouts`, `order_num`, `layout_id`, `metadata`, `composition.history`
     설명을 current reference에서 제거하거나 historical note로 격리한다.
   - `composition-history`는 별도 DB로 문서화한다.
7. `docs/adr/121...`, breakdown, inventory, `docs/adr/README.md`, `docs/CHANGELOG.md`,
   필요 시 `.agents/skills/composition-patterns` rule을 sync한다.

검증:
- rg -n "SyncMetadata|\\bmetadata\\s*[:=]\\s*\\{|\\.metadata\\.(get|set|update)|metadata\\??: SyncMetadata" apps/builder/src/lib/db -g '*.ts'
- rg -n "\\bhistory\\s*[:=]\\s*\\{|db\\.history|HistoryEntry|createObjectStore\\(\\\"history\\\"|objectStore\\(\\\"history\\\"" apps/builder/src/lib/db apps/builder/src/dashboard -g '*.ts' -g '*.tsx'
- rg -n "db\\.designVariables|\\.designVariables\\.(insert|insertMany|update|delete|getById|getByProject|getByName|getAll)" apps/builder/src packages/shared/src -g '*.ts' -g '*.tsx' -g '!apps/builder/src/lib/db/**'
- rg -n "\\bdesignVariables\\b|design_variables|DesignVariable" apps/builder/src/lib/db -g '*.ts'
- rg -n "createObjectStore\\(\\\"(metadata|history|design_variables)\\\"|objectStore\\(\\\"(metadata|history|design_variables)\\\"" apps/builder/src/lib/db/indexedDB/adapter.ts
- pnpm -F @composition/builder exec vitest run src/lib/db/__tests__/metaStore.test.ts
- pnpm run codex:preflight
- Browser smoke on the current builder URL: IndexedDB `composition` DB version 15, objectStores exclude
  `pages`, `elements`, `layouts`, `metadata`, `history`, `design_variables`; `documents` record exists.

완료 조건:
- `composition` DB current objectStore list가 active stores만 포함한다.
- `composition-history` DB는 유지되고 history restore/save path가 깨지지 않는다.
- stale schema docs가 current DB와 일치한다.
- ADR/README/CHANGELOG에 검증 결과가 반영되어 있다.
```

## Phase 0: Inventory Freeze

Status: Implemented.

### Tasks

1. Actual adapter schema를 `createObjectStore`, `createIndex`, `objectStore` grep으로 고정한다.
2. `metadata`, `history`, `designVariables`, `design_variables` consumer를 production scope로
   다시 확인한다.
3. active feature stores와 삭제 후보를 inventory table에 반영한다.

### Commands

```bash
rg -n "createObjectStore\\(|createIndex\\(|deleteObjectStore\\(|objectStore\\(" apps/builder/src/lib/db/indexedDB/adapter.ts
rg -n "\\.metadata\\.(get|set|update)|\\.batch\\.(export|import|clear)|SyncMetadata|sync_enabled|sync_status" apps/builder/src/lib/db -g '*.ts'
rg -n "db\\.history|historyIndexedDB|HistoryEntry|history\\.insert|history\\.getByPage|history\\.clear" apps/builder/src/lib/db apps/builder/src/dashboard apps/builder/src/builder/stores/history apps/builder/src/builder/stores/history.ts -g '*.ts' -g '*.tsx'
rg -n "db\\.designVariables|\\.designVariables\\.(insert|insertMany|update|delete|getById|getByProject|getByName|getAll)" apps/builder/src packages/shared/src -g '*.ts' -g '*.tsx' -g '!apps/builder/src/lib/db/**'
rg -n "\\bdesignVariables\\b|design_variables|DesignVariable" apps/builder/src/lib/db -g '*.ts'
```

### Exit Criteria

- `docs/adr/design/121-indexeddb-legacy-surface-inventory.md`가 current scan과 일치한다.
- active store와 deletion candidate가 같은 bucket에 섞이지 않는다.

## Phase 1: Metadata Store/API Removal

Status: Implemented.

### Tasks

1. `SyncMetadata` type 제거.
2. `DatabaseAdapter.metadata` group 제거.
3. `batch.export/import` payload에서 `metadata` 제거.
4. `IndexedDBAdapter.metadata` implementation 제거.
5. `metadata` objectStore create path 제거.
6. DB upgrade cleanup allowlist에 `metadata` 추가.

### Tests

- `src/lib/db/__tests__/metaStore.test.ts` 또는 신규 static test에 다음을 추가한다.
  - `createObjectStore("metadata")` 없음.
  - `DatabaseAdapter.metadata` 없음.
  - `SyncMetadata` 없음.
  - `batch.export/import`에 metadata payload 없음.

## Phase 2: Composition History Store/API Removal

Status: Implemented.

### Tasks

1. `DatabaseAdapter.history` group과 adapter-local `HistoryEntry` type 제거.
2. `composition` DB `history` objectStore create path 제거.
3. `dashboard/index.tsx`의 `db.history.clear(page.id)` 제거.
4. `historyIndexedDB.clearPageHistory(page.id)`는 유지한다.
5. `composition-history` DB는 untouched로 유지한다.
6. DB upgrade cleanup allowlist에 `history` 추가.

### Tests

- Static test:
  - `createObjectStore("history")` 없음.
  - `objectStore("history")` 없음.
  - `DatabaseAdapter.history` 없음.
  - `historyIndexedDB` import와 `composition-history` constants는 남아 있음.

## Phase 3: DesignVariables Adapter Mismatch Removal

Status: Implemented.

### Tasks

1. `db.designVariables.*` production consumer가 0건인지 재확인한다.
2. consumer 0이면 `DatabaseAdapter.designVariables`와 `IndexedDBAdapter.designVariables`
   implementation을 제거한다.
3. `design_variables` objectStore를 새로 만들지 않는다.
4. 기존 dev DB에 stale `design_variables` store가 있을 가능성만 delete-only allowlist로
   처리한다.

### Decision Rule

- consumer 0: remove API.
- consumer 발견: API 제거 중단, `design_variables` store creation feature ADR로 분리.

## Phase 4: DB Version + Delete-Only Upgrade

Status: Implemented.

### Tasks

1. `DB_VERSION`을 15로 올린다.
2. 기존 `pages`/`elements`/`layouts` deletion allowlist에
   `metadata`/`history`/`design_variables`를 추가한다.
3. `stripLegacyOrderPayloads`는 `documents` cleanup 전용으로 유지하거나 현재 필요성을
   재검토한다.

### Exit Criteria

```bash
rg -n "createObjectStore\\(\\\"(metadata|history|design_variables)\\\"" apps/builder/src/lib/db/indexedDB/adapter.ts
rg -n "objectStore\\(\\\"(metadata|history|design_variables)\\\"" apps/builder/src/lib/db/indexedDB/adapter.ts
rg -n "\\bdesignVariables\\b|design_variables|DesignVariable" apps/builder/src/lib/db -g '*.ts'
```

위 명령은 delete-only helper를 제외하고 0건이어야 한다.

## Phase 5: Reference Docs Sync

Status: Implemented.

### Tasks

1. `docs/reference/schemas/INDEXDB.md`를 ADR-120/121 이후 schema로 갱신한다.
2. `pages`/`elements`/`layouts`와 `order_num` 예제는 current reference에서 제거한다.
3. `metadata`/`composition.history`는 removed legacy note로만 남긴다.
4. `composition-history` 별도 DB를 current undo/redo persistence로 문서화한다.

## Phase 6: Verification

Status: Implemented.

### Required Commands

```bash
pnpm -F @composition/builder exec vitest run src/lib/db/__tests__/metaStore.test.ts src/dashboard/__tests__/dashboardLocalMirror.static.test.ts
pnpm run codex:preflight
```

### Browser Smoke

현재 Builder URL을 사용해 확인한다.

```text
http://localhost:5173/builder/9115e0fe-81b7-4a57-a996-19e62fec3eaa
```

확인 항목:

- `composition` DB version 15.
- objectStores:
  - present: `projects`, `documents`, `design_tokens`, `design_themes`,
    `data_tables`, `api_endpoints`, `variables`, `transformers`
  - absent: `pages`, `elements`, `layouts`, `metadata`, `history`, `design_variables`
- `composition-history` DB exists or can be initialized by history manager.
- active `documents` record exists.
- console error/warning 0.

Result:

- Fresh Playwright context with seeded dev auth session stayed on the Builder URL.
- `composition` DB version: 15.
- `composition` objectStores: `api_endpoints`, `data_tables`, `design_themes`,
  `design_tokens`, `documents`, `projects`, `transformers`, `variables`.
- absent legacy stores: `pages`, `elements`, `layouts`, `metadata`, `history`,
  `design_variables`.
- `documents` record exists for `9115e0fe-81b7-4a57-a996-19e62fec3eaa`.
- `composition-history` DB version 1 exists with `history-entries`, `page-meta`.
- Builder rendered one canvas; filtered console/page errors 0. Chromium emitted only
  GPU `ReadPixels` performance warnings.

## Documentation Sync

완료 시 다음 파일을 갱신한다.

- `docs/adr/completed/121-indexeddb-legacy-surface-cleanup.md`
- `docs/adr/design/121-indexeddb-legacy-surface-cleanup-breakdown.md`
- `docs/adr/design/121-indexeddb-legacy-surface-inventory.md`
- `docs/reference/schemas/INDEXDB.md`
- `docs/adr/README.md`
- `docs/CHANGELOG.md`
- 필요 시 `.agents/skills/composition-patterns/rules/domain-canonical-format-order.md`
