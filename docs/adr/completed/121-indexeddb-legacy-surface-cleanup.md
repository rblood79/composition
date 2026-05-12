# ADR-121: IndexedDB legacy surface cleanup

## Status

Implemented — 2026-05-08

> **Superseded in part by [ADR-128](128-supabase-backend-decommission.md) (cloud transport boundary 부분, 2026-05-12)** — IndexedDB surface cleanup 결과 자체는 유효, 본 ADR 본문이 명시한 "cloud sync 호환 보존" 명분은 stale.

## Context

ADR-116/118/119/120 이후 local project document state의 primary는
IndexedDB `composition.documents`에 저장되는 `CompositionDocument`로 닫혔다.
ADR-120은 `pages`/`elements`/`layouts` objectStore와
`DatabaseAdapter.pages/elements/layouts` surface를 제거했다.

그러나 현재 `composition` IndexedDB schema에는 project document state mirror는 아니지만
정리되지 않은 legacy/dormant surface가 남아 있다.

- `metadata` objectStore는 sync metadata 용도로 생성되고
  `DatabaseAdapter.metadata` API가 남아 있으나, production consumer는 adapter 내부
  `batch.export/import` 외에 발견되지 않았다.
- `history` objectStore는 `DatabaseAdapter.history` API와 함께 생성되지만, 실제 Builder
  undo/redo persistence는 별도 IndexedDB DB인 `composition-history`의
  `history-entries`/`page-meta`를 사용한다. `composition.history`의 production 사용은
  project delete 시 clear 호출뿐이다.
- `designVariables` adapter API는 `design_variables` objectStore를 사용하도록 구현돼
  있지만, 현재 `IndexedDBAdapter` upgrade path에는 `design_variables` store 생성이 없고
  production `db.designVariables.*` consumer도 없다.
- `docs/reference/schemas/INDEXDB.md`는 여전히 `pages`/`elements`/`layouts`,
  `order_num`, `layout_id`, `metadata` 중심의 pre-ADR-120 schema를 정본처럼 설명한다.

이번 ADR은 canonical format이나 cloud compatibility를 다시 설계하지 않는다. 목표는
`composition` IndexedDB 안에 남은 dormant legacy store/API/documentation drift를 제거해
현재 DB schema와 문서/adapter surface를 일치시키는 것이다.

**Hard Constraints**:

1. `composition.documents`는 계속 project document state의 primary persistence이다.
2. `projects`, `documents`, `design_tokens`, `design_themes`, `data_tables`,
   `api_endpoints`, `variables`, `transformers`는 현재 consumer가 있는 active store로
   유지한다.
3. 별도 DB `composition-history`는 현재 undo/redo history persistence path이므로 이 ADR의
   삭제 대상이 아니다.
4. `variables.page_id`는 Data Panel page-scoped variable 기능의 current model이므로
   `pages` mirror 제거와 혼동해 삭제하지 않는다.
5. Supabase `pages`/`elements` compatibility API와 canonical export/import adapter는
   ADR-120의 cloud transport boundary로 유지한다.
6. IndexedDB objectStore 삭제는 production consumer 0건과 adapter type surface 제거를
   확인한 뒤 `DB_VERSION` bump에서 delete-only cleanup으로 수행한다.
7. stale documentation은 현재 adapter schema와 browser-observed objectStore 목록을 기준으로
   갱신한다. 과거 schema 설명을 정본처럼 남기지 않는다.

**Soft Constraints**:

- 삭제는 `metadata`, `composition.history`, `designVariables` API mismatch, schema docs 순서로
  나누어 검증한다.
- code cleanup과 documentation cleanup은 같은 ADR 아래에서 관리하되, Supabase physical
  schema drop은 별도 승인 전까지 포함하지 않는다.
- legacy 문자열 전체 0건을 목표로 삼지 않는다. canonical compatibility metadata와
  export/import bridge는 allowlist로 분리한다.

## Alternatives Considered

### 대안 A: 현 상태 유지

- 설명: `metadata`, `composition.history`, `designVariables` adapter surface, stale schema
  docs를 그대로 둔다.
- 근거: 코드 변경량이 0이고 당장 runtime에서 깨지는 사용자 flow는 적다.
- 위험:
  - 기술: M — `designVariables`는 objectStore 생성이 없어 호출 시 실패할 수 있다.
  - 성능: L — dormant store 자체의 비용은 작다.
  - 유지보수: H — `composition` DB에 실제 primary가 아닌 store/API가 남아 다음 cleanup의
    판단 비용이 계속 증가한다.
  - 마이그레이션: L — schema 변화가 없다.

### 대안 B: `composition` DB를 `documents` 중심으로만 급진 축소

- 설명: project document 외 store를 모두 canonical document로 흡수하거나 삭제한다.
- 근거: 최종 local persistence를 가장 단순하게 만든다.
- 위험:
  - 기술: H — theme/data panel/runtime variable store는 현재 consumer가 있고 canonical
    document에 아직 완전 흡수되지 않았다.
  - 성능: M — canonical document 단일 record가 커지고 feature별 lazy load가 어려워질 수
    있다.
  - 유지보수: M — 완료 후 단순하지만 theme/data 기능 migration 설계가 필요하다.
  - 마이그레이션: H — active feature data 이전이 필요하다.

### 대안 C: dormant legacy surface만 제거하고 active feature stores 유지

- 설명: `metadata`, `composition.history`, `designVariables` dead/mismatch surface를
  제거하고, `projects/documents/theme/data` active stores는 유지한다. `composition-history`
  별도 DB는 current history persistence로 유지한다. stale IndexedDB schema docs는 현재
  adapter/browser schema에 맞게 재작성한다.
- 근거: ADR-120 이후 남은 IndexedDB legacy debt를 줄이면서 active theme/data/history
  기능의 migration 위험을 분리한다.
- 위험:
  - 기술: M — `composition.history` clear 호출과 `batch` metadata payload 제거가 누락되면
    타입/테스트가 깨질 수 있다.
  - 성능: L — dormant store 제거라 runtime 성능 영향은 제한적이다.
  - 유지보수: L — DB adapter surface와 문서가 실제 사용 경로에 맞게 줄어든다.
  - 마이그레이션: M — 기존 dev DB에 남은 objectStore 삭제 upgrade가 필요하다.

### 대안 D: `design_variables` store를 새로 생성하고 sync/history surface는 보존

- 설명: 누락된 `design_variables` objectStore를 추가해 adapter mismatch만 고치고,
  `metadata`와 `composition.history`는 future compatibility로 보존한다.
- 근거: 기능 복원 가능성을 열어 둔다.
- 위험:
  - 기술: M — consumer가 없는 store를 새로 늘려 실제 사용 여부가 불명확한 schema를 확장한다.
  - 성능: L — store 추가 비용은 작다.
  - 유지보수: H — 사용하지 않는 future surface를 current API처럼 유지한다.
  - 마이그레이션: M — 신규 store version bump가 필요하지만 기능 증거가 없다.

### Risk Threshold Check

| 대안 | 기술 | 성능 | 유지보수 | 마이그레이션 | HIGH+ 개수 |
| ---- | ---- | ---- | -------- | ------------ | :--------: |
| A    | M    | L    | H        | L            |     1      |
| B    | H    | M    | M        | H            |     2      |
| C    | M    | L    | L        | M            |     0      |
| D    | M    | L    | H        | M            |     1      |

루프 판정: A/B/D는 HIGH 위험이 1개 이상이므로 primary plan으로 채택하지 않는다. 대안 C는
모든 축이 MEDIUM 이하이고 active feature migration을 분리하므로 실행 가능한 cleanup
단위다.

## Decision

**대안 C: dormant legacy surface만 제거하고 active feature stores 유지**를 선택한다.

선택 근거:

1. ADR-120 이후 `composition` DB에 남은 legacy/dormant surface를 제거하면서
   `documents` primary 결정을 유지한다.
2. 현재 consumer가 있는 theme/data stores와 `composition-history` DB는 별도 migration 없이
   유지한다.
3. `metadata`와 `composition.history`는 consumer 0 또는 clear-only surface이므로 adapter/API
   cleanup 대상이다.
4. `designVariables`는 physical store 없이 API만 남은 mismatch이므로, consumer가 없는 한
   store를 새로 만들지 않고 API를 제거한다.
5. `docs/reference/schemas/INDEXDB.md`를 current schema reference로 복구해 향후 cleanup의
   기준을 코드와 일치시킨다.

기각 사유:

- **대안 A 기각**: dormant store/API와 stale docs가 다음 IndexedDB 판단을 계속 흐린다.
- **대안 B 기각**: active theme/data store까지 묶으면 canonical document scope를 새로
  설계해야 한다.
- **대안 D 기각**: consumer가 없는 `design_variables` store를 새로 만드는 것은 cleanup이
  아니라 dead surface 확장이다.

> 구현 상세:
> [121-indexeddb-legacy-surface-cleanup-breakdown.md](../design/121-indexeddb-legacy-surface-cleanup-breakdown.md)
> 인벤토리:
> [121-indexeddb-legacy-surface-inventory.md](../design/121-indexeddb-legacy-surface-inventory.md)

## Implementation Summary

2026-05-08 구현으로 Phase 0-6을 닫았다.

- `IndexedDBAdapter`는 `DB_VERSION` 15로 상승했고, v15 upgrade에서
  `pages`/`elements`/`layouts`와 함께 `metadata`/`history`/`design_variables`를
  delete-only cleanup allowlist로 삭제한다.
- `metadata` objectStore create path, `SyncMetadata`, `DatabaseAdapter.metadata`,
  `IndexedDBAdapter.metadata`, `batch.export/import` metadata payload를 제거했다.
- duplicate `composition.history` objectStore create path, `DatabaseAdapter.history`,
  adapter-local `HistoryEntry`, dashboard `db.history.clear(page.id)` 호출을 제거했다.
  별도 `composition-history` DB와 `historyIndexedDB.clearPageHistory(page.id)`는 유지했다.
- consumer 0건을 확인한 `designVariables` adapter API와 `IndexedDBAdapter.designVariables`
  구현을 제거했고, `design_variables` store는 새로 만들지 않는다.
- `docs/reference/schemas/INDEXDB.md`를 v15 current schema로 재작성해 active stores와
  removed legacy stores를 분리했다.
- `.agents` canonical format/order 규칙에 removed local DB surface 재도입 금지
  규칙을 추가했다.

## Risks

| Risk                               | Impact                                                                  | Mitigation                                                                                      |
| ---------------------------------- | ----------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------- |
| hidden metadata consumer           | sync metadata 삭제 후 export/import tooling이 깨질 수 있다              | `metadata`/`SyncMetadata`/`batch.metadata` grep gate와 test compile gate를 먼저 통과한다        |
| wrong history store deletion       | undo/redo history persistence가 사라질 수 있다                          | `composition.history`와 별도 DB `composition-history`를 분리하고 latter는 삭제하지 않는다       |
| design variable future scope drift | future canonical theme variable work와 dead adapter API 제거가 충돌한다 | consumer 0을 근거로 API만 제거하고 future write-through는 별도 ADR 또는 explicit feature로 연다 |
| stale docs after cleanup           | reference schema가 다시 실제 DB와 어긋날 수 있다                        | adapter `createObjectStore/createIndex` grep과 browser objectStore smoke를 docs gate로 둔다     |
| DB upgrade cleanup failure         | 기존 dev DB에 stale store가 남을 수 있다                                | `DB_VERSION` bump와 `deleteObjectStore` allowlist, browser IndexedDB smoke로 확인한다           |

## Gates

| Gate                         | 시점         | 통과 조건                                                                                | 실패 시 대안                                 |
| ---------------------------- | ------------ | ---------------------------------------------------------------------------------------- | -------------------------------------------- |
| G0: inventory freeze         | Phase 0 종료 | active store, dormant store, API-only mismatch, docs drift bucket 확정                   | 삭제 착수 금지                               |
| G1: metadata removal         | Phase 1 종료 | `SyncMetadata`, `DatabaseAdapter.metadata`, `metadata` objectStore/API/batch payload 0건 | metadata만 defer하고 inventory에 잔존 기록   |
| G2: composition history cut  | Phase 2 종료 | `DatabaseAdapter.history`와 `composition.history` store 제거, `composition-history` 유지 | history clear-only call 제거 전 rollback     |
| G3: designVariables decision | Phase 3 종료 | consumer 0이면 adapter API 제거, store 생성 금지 또는 explicit separate feature로 분리   | feature owner 확인 전 API 제거 보류          |
| G4: DB/version cleanup       | Phase 4 종료 | DB_VERSION bump, delete-only cleanup, stale store create/read path 0건                   | deleteObjectStore allowlist 재검토 후 재시도 |
| G5: schema docs sync         | Phase 5 종료 | `docs/reference/schemas/INDEXDB.md`가 v15/current objectStore list와 일치                | docs를 stale로 표시하고 cleanup 완료 보류    |
| G6: final verification       | Phase 6 종료 | targeted tests, grep gates, browser objectStore smoke, `pnpm run codex:preflight` 완료   | 실패 bucket 재분류 후 phase 재실행           |

Gate 결과: G0-G6 Implemented. Browser smoke는
`http://localhost:5173/builder/9115e0fe-81b7-4a57-a996-19e62fec3eaa`에서
fresh Playwright context + seeded dev auth session으로 확인했다. `composition` DB는
v15, active objectStores만 포함했고 `documents` record와 `composition-history` DB가
유지됐다. filtered console/page errors는 0건이었다.

## Consequences

### Positive

- `composition` IndexedDB schema가 current runtime source와 일치한다.
- `metadata`/`history`/`designVariables`의 dead API surface가 새 기능 구현의 혼선을 줄인다.
- reference schema 문서가 ADR-120 이후 실제 DB 상태를 다시 반영한다.

### Negative

- 기존 dev IndexedDB의 dormant rows는 `DB_VERSION` upgrade에서 삭제된다.
- future sync metadata 또는 design variable persistence가 필요하면 새 feature 설계로 다시 열어야
  한다.
- browser smoke와 docs sync까지 포함하므로 단순 코드 삭제보다 작업 범위가 크다.
