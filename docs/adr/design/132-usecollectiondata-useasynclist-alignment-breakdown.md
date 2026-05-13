# ADR-132 design breakdown — useCollectionData useAsyncList 정합 + collections sink 통일 (+ data_tables → collections rename)

> 본 문서는 [ADR-132](../132-usecollectiondata-useasynclist-alignment.md) 의 구현 상세. ADR 본문에는 framing 결정 + 잔존 위험 + Gate 만, 본 문서는 Phase 분해 / 파일 목록 / 체크리스트 / 코드 예시.
>
> **2026-05-13 scope 확장**: 사용자 explicit confirm 으로 `data_tables` (snake) / `dataTables` (camel) → `collections` rename 포함. `DataTable` Pascal (UI 컴포넌트 / Editor / Panel) 유지. IndexedDB store drop 정책 (개발 단계, migration 코드 없음).

## §1 framing checkpoint 4 질문 lock-in (M2 — 사용자 explicit confirm 2026-05-13)

| #   | 질문                              | 답변                                                                                                                                                                                                                                                                                                                                                              |
| --- | --------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | **base / 응용 분류**              | **응용 ADR**. `data_tables` (Zustand `useDataStore.state.dataTables`) + `api_endpoints` (fetcher 정의) + `Element.dataBinding` (binding reference) 의 SSOT 는 이미 코드 자연 발생 (명시 base ADR 없음, ADR-131 Phase 8 revert framing 으로 lock-in). 본 ADR 은 read 경로 (`useCollectionData`) 가 그 SSOT 를 우회한 분기를 RSP `useAsyncList` 정통 패턴으로 정합. |
| 2   | **schema 직교성**                 | 본 ADR 은 read 흐름 정합만. `data_tables` / `api_endpoints` / `Element.dataBinding` 의 type / schema 변경 없음. `apiEndpointData` 류 local useState 삭제 + `loadStaticData` / `loadApiData` 내부 흐름 재배선만. ADR-131 events/actions root collection 과 직교 (schema 겹침 0).                                                                                   |
| 3   | **baseline framing reverse 검증** | ADR-131 Phase 8 revert framing ("data_tables = 데이터 단일 SSOT, RAC/RSC read 진입점은 `useCollectionData({ datatableId \| dataBinding })`") 의 **직접 후속**. 의존 방향 정방향 (ADR-131 prerequisite → 본 ADR 후속). reverse 검토: ADR-131 보다 본 ADR 이 선행했어야 할 가능성 = 0 (Phase 8 revert 가 본 framing 의 trigger).                                    |
| 4   | **codex 3차 미루지 말 것**        | scaffold 단계에서 본 4 질문 lock-in + 사용자 explicit confirm 통과. codex 1차 review 진입은 Phase 1 본문 land 시점.                                                                                                                                                                                                                                               |

**차단 메모리 평가** (메모리 충돌 우선순위 표 — MEMORY.md):

- [[feedback-no-derived-adr-mid-execution]] **N/A** — ADR-131 Implemented 상태, mid-execution 아님
- [[feedback-adr-consolidation-burden-not-essence]] **통과** — 사용자가 scope W1 only 로 명시 (AI tool W3 / publish W4 는 별 ADR 분리 권장)
- [[feedback-pr-vs-direct-push]] **준수** — 각 Phase 는 main 직접 push
- [[feedback-external-reference-first]] **통과** — RSP Dynamic Collections + `useAsyncList` 외부 reference (vendor 자체) 기반, self-contained 해법 회피
- [[feedback-adr-revert-after-review-fatigue]] **차단 적용** — Phase 1 land 시점부터 codex review N차 신 HIGH 결함 발견 시 3 질문 자기 차단 (impl 시점 ad-hoc 가능? / lock-in hard 가치? / 원본 framing scope 동일?)

## §2 Phase 0 — inventory baseline freeze

### 대상 파일

- `packages/shared/src/hooks/useCollectionData.tsx` (메인 hook, shared layer)
- `apps/builder/src/builder/hooks/useCollectionData.ts` (builder layer, 거의 mirror — DI 측면 차이)
- `packages/shared/src/hooks/collectionDataContext.tsx` (DI Context)
- `packages/shared/src/hooks/useCollectionDataCache.ts` (LRU cache)
- `packages/shared/src/types/dataBinding.types.ts` (관련 type)

### baseline grep (Phase 0 lock-in 시 HEAD hash 와 함께 frozen)

```bash
# 1. PropertyDataBinding api source 직접 fetch 분기 위치
grep -n "apiEndpointData\|setApiEndpointData" packages/shared/src/hooks/useCollectionData.tsx apps/builder/src/builder/hooks/useCollectionData.ts

# 2. useAsyncList load callback 안 loadApiData / loadStaticData 호출
grep -n "loadStaticData\|loadApiData" packages/shared/src/hooks/useCollectionData.tsx apps/builder/src/builder/hooks/useCollectionData.ts

# 3. isCanvasContext 분기 (Canvas direct fetch vs Builder executeApiEndpoint)
grep -n "isCanvasContext\|/api/proxy" packages/shared/src/hooks/useCollectionData.tsx apps/builder/src/builder/hooks/useCollectionData.ts

# 4. PropertyDataBinding source enum 사용처 ("dataTable" / "api" string literal)
grep -rn 'source: ["\x27]\(dataTable\|api\)["\x27]\|binding\.source ===' packages/shared/src/hooks apps/builder/src/builder/hooks

# 5. processedData 우선순위 4-tier (dataTableData / apiEndpointData / datatableState / list.items)
grep -n "processedData\|dataTableData\|apiEndpointData\|datatableState" packages/shared/src/hooks/useCollectionData.tsx
```

### Phase 0 산출물

- `docs/adr/132-baseline.md` (또는 design 문서 §2 inline) 에 grep 결과 + 라인 표 + HEAD hash freeze
- 통계: PropertyDataBinding api source 분기 LOC, useAsyncList load callback LOC, local useState 개수
- 컴포넌트 read 진입점 dependency 다이어그램 1장
- **frozen 수치 lock-in (adr-writing.md 동적 seed #3 BC 수식화 충족 의무)**:
  - `apiEndpointData` / `setApiEndpointData` / `apiEndpointLoading` / `apiEndpointError` site count (예상 shared 5 + builder 6 = 11 site)
  - `reloadTrigger` 호출처 site count (예상 0-3 site, grep 후 확정)
  - `loadStaticData` / `loadApiData` 사용 element 측정 (Legacy collection 사용 빈도 — R4 평가용)
  - RAC renderer 측 useCollectionData caller site count (Table / ListBox / GridList / ComboBox / Select / Tree / Breadcrumbs)
  - `apiEndpointService` DI Context Canvas 측 주입 site (R2 검증용)
  - `executeApiEndpoint` 의 `signal: AbortSignal` 파라미터 지원 여부 (Soft Constraint line 47)
- **rename baseline frozen (Phase 5 sweep 대상)**:
  - `\bdata_tables\b` (snake) 13 파일 — DB schema / canonical document / IndexedDB adapter / dataActions / inspectorActions / rootCollectionMigration / 외
  - `\bdataTables\b` (camel) 15+ 파일 — Zustand store API / hook / postMessage / panel / messageHandler / 외
  - `\bDataTable\b` (Pascal) 30+ 파일 — **변경 제외 baseline 보존** (UI 컴포넌트 / Editor / Panel / Type 이름 유지)
  - postMessage type literal: `"dataTables"` / `"SYNC_DATA_TABLES"` / `"DATA_TABLES_*"` (Builder ↔ Canvas iframe payload)
  - canonical document field name: `composition-document.types.ts` 의 `dataTables` field
  - AI tool prompt 어휘 (`createElement.ts`)

### Phase 0 commit

`docs(adr-132): Phase 0 inventory baseline freeze`

## §3 Phase 1+ 분해

### Phase 1 — useAsyncList load callback 단일화 (sink read 통일)

**목표**: PropertyDataBinding `source="api"` 분기를 `useAsyncList.load` callback **안으로 흡수**. 별도 `useEffect` + `apiEndpointData` useState 삭제.

**핵심 변경**:

```ts
// Before — useEffect + setApiEndpointData (Line 317-437)
useEffect(() => {
  if (binding.source !== "api") return;
  // ... isCanvasContext 분기 → fetch / executeApiEndpoint
  setApiEndpointData(items);
}, [...]);

// After — useAsyncList load callback 단일화 + error surface 패턴
const list = useAsyncList({
  async load({ signal }) {
    // throw 시 useAsyncList 가 list.error 에 자동 sink, list.isLoading false 로 전환
    // RAC collection 컴포넌트는 list.error / list.isLoading 을 prop binding (Table renderState / ListBox renderEmpty 등)
    if (propertyBindingFormat) {
      const binding = stableDataBinding;
      if (binding.source === "dataTable") {
        const rows = resolveDataTableRows(binding.name);
        if (rows === null) throw new Error(`DataTable not found: ${binding.name}`);
        return { items: rows };
      }
      if (binding.source === "api") {
        const endpoint = apiEndpoints.find(ep => ep.name === binding.name);
        if (!endpoint) throw new Error(`endpoint not found: ${binding.name}`);
        if (!endpoint.targetDataTable) throw new Error(`endpoint.targetDataTable missing: ${binding.name}`);
        // signal: AbortSignal 전파 (Phase 0 inventory 에서 executeApiEndpoint 지원 확인 후)
        await apiEndpointService.executeApiEndpoint(endpoint.id, { signal });
        const rows = resolveDataTableRows(endpoint.targetDataTable);
        if (rows === null) throw new Error(`targetDataTable not found after execute: ${endpoint.targetDataTable}`);
        return { items: rows };
      }
    }
    // Legacy collection 흐름 유지
    if (dataBinding?.type === "collection") {
      if (dataBinding.source === "static") return { items: await loadStaticData(dataBinding) };
      if (dataBinding.source === "api") {
        // Legacy api collection 도 data_tables sink 거치도록 정합
        return { items: await loadLegacyApiData(dataBinding, signal) };
      }
    }
    return { items: [] };
  },
});

// RAC consumer 측 error UX binding (예시)
// <Table ... renderState={list.error ? <ErrorRow message={list.error.message} /> : null}
//        renderEmptyState={() => list.isLoading ? <Spinner /> : <Empty />}>
```

**삭제 대상**:

- `apiEndpointData` / `apiEndpointLoading` / `apiEndpointError` useState 3개 (line 310-314)
- PropertyDataBinding api 분기의 `useEffect` 블록 (line 317-437)
- `processedData` 우선순위 chain 중 `apiEndpointData` tier (line 502-514)
- `reloadTrigger` useState (대신 `list.reload()` 사용)

**유지**:

- `dataTableData` useMemo (line 277-304) — `source="dataTable"` direct read, useAsyncList 거치지 않아도 OK (sync read). 단, `processedData` 우선순위 chain 도 함께 단순화 — 사용자 framing "read 진입점은 data_tables" 충족
- `collectionDataCache` LRU — useAsyncList load 안에서 cache hit 시 즉시 반환

**검증**:

- type-check 3/3 PASS (apps/builder baseline 변동 가능, 측정)
- vitest 기존 PASS 유지
- Storybook / Chrome MCP smoke — Table / ListBox / GridList / ComboBox / Select 의 api source binding element 5종 read 정상
- **error surface smoke (R6 대응)**: 3 케이스 검증 — (1) `endpoint not found` (잘못된 binding.name), (2) `fetch fail` (네트워크 에러 mock), (3) `abort` (component unmount mid-fetch). 각 케이스에 RAC `list.error` / `list.isLoading` 이 collection 컴포넌트 error UX prop 으로 적절히 binding 되는지 확인

**Phase 1 Gate**:

- G1: `grep apiEndpointData packages/shared apps/builder` = **0건**
- G2: `useEffect` 안 fetch 호출 = **0건** (useAsyncList load callback 안만)
- G3: useAsyncList load callback 의 api 분기가 `executeApiEndpoint` 거친 후 targetDataTable.runtimeData read

### Phase 2 — Legacy collection api source 의 data_tables sink 정합

**목표**: `type:"collection", source:"api"` 의 `loadApiData()` 가 결과를 `list.items` 에 직접 반환하는 대신, `data_tables` 의 ephemeral row 에 sink 후 read 하도록 정합.

**문제**: Legacy collection 은 `endpoint` 개념이 없고 `config.baseUrl + endpoint + dataMapping` 인라인 정의. `data_tables` row 가 없으므로 sink 대상 부재.

**대안**:

- (a) Legacy collection api source 사용 element 의 `dataBinding` 을 PropertyDataBinding 형식으로 마이그레이션 권장 (사용자 UI 가이드), 본 ADR scope 에서는 기존 흐름 유지
- (b) Legacy collection api 결과를 ephemeral data*tables row (예: `\_\_legacy*${elementId}`) 로 sink — 임시 SSOT 정합

**Phase 2 잠정 결정**: (a) — Legacy collection 은 사용 element 0건 또는 적은 수 가정 (Phase 0 inventory 에서 grep `type: "collection"` 카운트 확정 후 재평가). (b) 가 필요하면 별 ADR.

**Phase 2 commit**: `feat(adr-132): Phase 2 — legacy collection sink decision lock-in`

### Phase 3 — Canvas vs Builder isCanvasContext 분기 통합

**목표**: Canvas 측 직접 proxy fetch (line 365-391) 와 Builder 측 `executeApiEndpoint` (line 393-395) 의 분기를 단일 경로 (`executeApiEndpoint`) 로 통합.

**전제**: Canvas iframe 에서 `executeApiEndpoint` 호출 가능한가 — `apiEndpointService` DI Context 가 Canvas 측에서도 주입되어 있는가 확인 (Phase 0 inventory 항목).

**기대**: Canvas 측에서도 동일 fetcher → `data_tables.runtimeData` sink. 양쪽 동시 호출 cache 충돌 없음 (`data_tables.runtimeData` 가 single source).

**Phase 3 Gate**:

- G3-1: Canvas 측 read 가 `data_tables.runtimeData` 에서 가져오는지 확인 (`syncDataTablesToCanvas` postMessage 경유)
- G3-2: `isCanvasContext` 분기 제거 또는 단순화

### Phase 4 — collectionDataCache 의 data_tables 정합 검증

**목표**: `collectionDataCache` LRU 가 `data_tables.runtimeData` 와 staleness 충돌 없는지 검증. dataTables Zustand subscribe → 변경 시 cache invalidate 필요.

**의문**: data_tables.runtimeData 가 갱신될 때 useCollectionData hook 의 `list` 가 reload 되는가? — useDataStore 의 dataTables Map 이 selector 로 subscribed 되어 있고 변경 시 hook re-render → useAsyncList load 재실행되어야 함.

**Phase 4 commit**: `feat(adr-132): Phase 4 — collectionDataCache + dataTables subscribe 정합`

### Phase 5 — rename sweep (`data_tables` / `dataTables` → `collections`)

**목표**: Phase 1-4 완료 후 single PR 로 mechanical rename land. Builder + Publish + Shared + Preview 동시 변경 (R8 — postMessage schema 양쪽 동시 deploy 필요).

**rename 매핑**:

| Before                               | After                                 | 영역                                                                     |
| ------------------------------------ | ------------------------------------- | ------------------------------------------------------------------------ |
| `data_tables`                        | `collections`                         | IndexedDB store name / DB type / canonical document                      |
| `dataTables`                         | `collections`                         | Zustand store property / action API / postMessage                        |
| `setDataTables` / `addDataTable` 등  | `setCollections` / `addCollection` 등 | Zustand actions                                                          |
| `syncDataTablesToCanvas`             | `syncCollectionsToCanvas`             | postMessage helper                                                       |
| `SYNC_DATA_TABLES` / `DATA_TABLES_*` | `SYNC_COLLECTIONS` / `COLLECTIONS_*`  | postMessage type literal                                                 |
| `dataTablesVersion`                  | `collectionsVersion`                  | Zustand counter                                                          |
| `useDataStore.dataTables`            | `useDataStore.collections`            | store API                                                                |
| `endpoint.targetDataTable`           | `endpoint.targetCollection`           | api_endpoints type (이름은 `data_tables` row 가리키는 reference, rename) |

**유지 (UI/UX surface — 사용자 framing 명시)**:

- `DataTable` Pascal: Component (`DataTable.tsx` / `DataTableComponent.tsx`) / Editor (`DataTableEditor.tsx` / `DataTableEditorPanel.tsx` / `ApiEndpointEditor.tsx`) / Panel (`datatable/`) / Type 이름 (`datatable.types.ts`)
- DataPanel UI label / "Table 추가" 버튼 / "DataTable 패널" 등 사용자 노출 텍스트
- 사용자 framing: "UI 는 `DataTable` 이 직관 (RDB 친숙도) — 내부 데이터 구조만 `collections` 정합"

**핵심 변경 영역 (단일 commit)**:

1. **DB schema layer** (`apps/builder/src/lib/db/`):
   - `adapter.ts` 18 hits — IndexedDB store name `data_tables` → `collections`. **DB_VERSION bump + drop + create** (migration 코드 없음)
   - `types.ts` 3 + 7 hits — DB type rename
2. **Zustand store layer** (`apps/builder/src/builder/stores/`):
   - `datatable.ts` (23 + 28 hits) → 파일 rename 검토 (`collections.ts`?). 또는 store 이름만 변경, 파일명 유지
   - `data.ts` 7 + 10 hits — store interface
   - `utils/dataActions.ts` 9 + 29 + 18 hits — actions API rename
3. **Hook layer**:
   - `useCollectionData.tsx` 4 + 7 hits — Phase 1 와 동시 변경 (단일 commit 권장)
   - `useDataQueries.ts` 8 + 11 + 12 hits
   - `useIframeMessenger.ts` 7 hits — postMessage payload schema
4. **Canonical document** (`packages/shared/src/types/composition-document.types.ts` 2 hits):
   - canonical document `dataTables` field → `collections`
   - ADR-116/122 framing 정합 (canonical SSOT 어휘 통일)
5. **Preview/Publish**:
   - `apps/builder/src/preview/messaging/messageHandler.ts` 3 hits
   - `apps/builder/src/preview/store/runtimeStore.ts` 2 hits
   - `apps/publish/` 측 — `ProjectData` 직렬화 path 동시 정합 (W4 scope 일부 포함, 단순 string rename 만)
6. **AI tool prompt** (`apps/builder/src/services/ai/tools/createElement.ts` 1 hit):
   - LLM 에게 전달하는 system prompt 어휘 갱신

**삭제 / 자동 생성**:

- IndexedDB 기존 `data_tables` object store 자동 drop (DB_VERSION bump 시)
- `collections` object store 신규 생성
- 사용자 본인 dev DB export 권고 (R9 — commit message 안 명시)

**검증**:

- `rg '\bdata_tables\b' -t ts -g '!*.test.*' -g '!node_modules'` = **0 hit** (theme/legacy 주석 허용 list 명시 — 본 ADR scope 밖 영역)
- `rg '\bdataTables\b' -t ts -g '!*.test.*' -g '!node_modules'` = **0 hit**
- `rg '"dataTables"' -t ts -g '!node_modules'` = **0 hit** (postMessage type literal)
- `rg '\bDataTable\b' -t ts -g '!node_modules'` = **baseline 보존** (Pascal UI 어휘 유지)
- type-check 3/3 PASS
- vitest 기존 PASS 유지
- Chrome MCP smoke — DataTable 패널 / API endpoint 실행 / RAC collection 컴포넌트 read 정상

**Phase 5 Gate**: G6 (rename sweep grep gate — ADR 본문 §Gates 참조)

**Phase 5 commit**: `feat(adr-132): Phase 5 — data_tables → collections rename sweep + DB_VERSION bump`

### Phase 6 — Status Implemented + README + CHANGELOG

- ADR Status `Proposed → Implemented`
- `docs/adr/README.md` ADR-132 entry 갱신
- `docs/CHANGELOG.md` 신 엔트리 (rename + sink 통일 양쪽 명시)

## §4 Gate matrix (Risk ↔ Gate 1:1 매핑)

| Risk                                                                                                                  | Phase | Gate | 통과 조건                                                                                                                        | 실패 시 대안                                                                                                             |
| :-------------------------------------------------------------------------------------------------------------------- | :---: | :--- | :------------------------------------------------------------------------------------------------------------------------------- | :----------------------------------------------------------------------------------------------------------------------- |
| R1 (useAsyncList load 안에서 dataTables Zustand selector subscribe 가능한가 — load 는 async fn 안이라 hook 호출 불가) |   1   | G1   | dataTables / apiEndpoints / endpointService 모두 useAsyncList 바깥에서 hook subscribe + load callback 안에서는 closure 로 access | dataTables 변경 시 `list.reload()` 명시 trigger (useEffect 1 line)                                                       |
| R2 (executeApiEndpoint 가 Canvas 측에서 호출 가능한가 — DI Context 격리)                                              |   3   | G3-1 | `apiEndpointService` DI Context 가 Canvas 측 useCollectionData provider 에 주입되어 있음                                         | Canvas 측은 기존 proxy fetch 유지, Builder 측만 정합 (분기 잔존)                                                         |
| R3 (collectionDataCache 가 data_tables 갱신 시 stale 가능)                                                            |   4   | G4   | dataTables Zustand selector subscribe → 변경 시 cache invalidate or list.reload                                                  | cache key 에 dataTables version 포함                                                                                     |
| R4 (Legacy collection api source 사용 element 가 0건이라는 가정 깨질 경우 mass migration 필요)                        |   2   | G2   | Phase 0 inventory grep `type: "collection"` AND `source: "api"` element 사용 빈도 측정, 0건 또는 < 5건 시 (a) 유지               | (b) ephemeral data_tables sink 또는 별 ADR fork                                                                          |
| R5 (PropertyDataBinding api source element 가 reload UX 회귀 — 기존 reloadTrigger 사용자 노출 surface 어디)           |   1   | G1-2 | reload UX 가 `list.reload()` 로 동작 동등                                                                                        | `reloadTrigger` 호출처 모두 `list.reload()` 로 치환                                                                      |
| R6 (useAsyncList load callback throw 시 RAC/RSC error surface 처리 — happy path 외 검증 누락 가능성)                  |   1   | G1-3 | error surface 3 케이스 (endpoint not found / fetch fail / abort) Storybook + Chrome MCP smoke PASS                               | RAC `list.error` / `list.isLoading` 미binding 시 collection 컴포넌트 error UX 미작동 — Phase 1 land 차단 후 binding 보강 |
| R7 (rename mechanical 누락 — string literal selector / DB store name / postMessage type 잔존 시 runtime crash)        |   5   | G6   | `\bdata_tables\b` / `\bdataTables\b` / `"dataTables"` literal grep 3-way 모두 0 hit. `DataTable` Pascal baseline 보존            | 누락 site 보강 후 재검증, type-check baseline 갱신                                                                       |
| R8 (Builder ↔ Canvas postMessage payload schema 양쪽 동시 deploy 필요 — 한쪽만 land 시 iframe silent fail)            |   5   | G6   | rename land 시 `apps/builder` + `apps/publish` + preview iframe messageHandler **3-way 단일 commit**                             | rollback 후 단일 commit 재구성                                                                                           |
| R9 (IndexedDB `data_tables` store drop 시 dev 환경 in-progress 데이터 손실)                                           |   5   | G6   | DB_VERSION bump 한 번에 drop + create 묶음. commit message 안 본인 dev DB export 권고 명시                                       | dev 환경 재시작 후 데이터 재생성 (개발 단계 user data 손실 허용)                                                         |

## §5 잔존 운영 위험 (Risks)

| ID  | 위험                                                                                            | 심각도  | 대응                                                                                                                                                                                                                                                                       |
| :-: | :---------------------------------------------------------------------------------------------- | :-----: | :------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| R1  | useAsyncList load 안 dataTables selector 접근 패턴 fragile (closure cache + subscribe fallback) | **MED** | hook subscribe + closure read 패턴 표준화. [[feedback-zustand-selector-cache]] (selector cache 함정) + [[feedback-zustand-subscribe-with-selector-fragility]] (subscribeWithSelector middleware fallback) 양쪽 검토. useDataStore 는 subscribeWithSelector middleware 사용 |
| R2  | Canvas iframe 측 executeApiEndpoint DI 미주입 가능성                                            | **MED** | Phase 0 inventory 에서 DI Context 주입 site 확인 후 Phase 3 진입                                                                                                                                                                                                           |
| R3  | collectionDataCache staleness + Canvas postMessage timing race                                  | **LOW** | dataTables subscribe + list.reload 패턴. Canvas 측은 `syncDataTablesToCanvas` postMessage 수신 후 list.reload trigger                                                                                                                                                      |
| R4  | Legacy collection 사용 element mass migration burden                                            | **LOW** | Phase 0 inventory 확정 후 평가, 본 ADR scope 내 단일 결정 lock-in                                                                                                                                                                                                          |
| R5  | reloadTrigger UX 회귀                                                                           | **LOW** | 사용처 grep + list.reload 치환                                                                                                                                                                                                                                             |
| R6  | useAsyncList load throw 시 RAC/RSC error surface 처리 (list.error / list.isLoading binding)     | **MED** | Phase 1 핵심 변경 시 error surface 패턴 명시 (§3 Phase 1 code 예시 참조) + 3 케이스 smoke (endpoint not found / fetch fail / abort)                                                                                                                                        |
| R7  | rename mechanical 누락 — string literal selector / DB store name / postMessage type 잔존        | **MED** | Phase 5 sweep grep gate 3-way (`\bdata_tables\b` / `\bdataTables\b` / `"dataTables"` literal) = 0 hit. type-check baseline 동시 갱신. AI tool `createElement.ts` prompt 어휘 갱신                                                                                          |
| R8  | Builder ↔ Canvas postMessage payload schema 양쪽 동시 deploy 필요 — 한쪽만 land 시 silent fail  | **MED** | rename land 시 `apps/builder` + `apps/publish` + preview iframe `messageHandler.ts` / `useIframeMessenger.ts` / `runtimeStore.ts` 동시 단일 commit                                                                                                                         |
| R9  | IndexedDB `data_tables` store drop 시 dev 환경 in-progress 데이터 손실                          | **LOW** | DB_VERSION bump 한 번에 drop + create 묶음. commit message 안 본인 dev DB export 권고. 개발 단계 user data 손실 허용                                                                                                                                                       |

잔존 HIGH 위험 0건.

## §6 검증 흐름

각 Phase 마다:

1. type-check 3/3 (apps/builder + packages/shared + apps/publish)
2. vitest 관련 영역 PASS (`packages/shared/src/hooks/__tests__/useCollectionData.test.tsx` 신규 또는 기존)
3. Chrome MCP smoke — Table / ListBox / GridList / Select / ComboBox 의 dataBinding element 실 동작 (data_tables UI 편집 → canvas 반영 / API endpoint 실행 → canvas 반영)
4. codex review N차 — 통과 시 main 직접 push

## §7 scope 경계 명시

**본 ADR 안**:

- `packages/shared/src/hooks/useCollectionData.tsx` 전수 (Phase 1-4 정합)
- `apps/builder/src/builder/hooks/useCollectionData.ts` 전수 (Phase 1-4 정합)
- `packages/shared/src/hooks/collectionDataContext.tsx` (DI 영향만)
- `packages/shared/src/hooks/useCollectionDataCache.ts` (Phase 4 영향만)
- **Phase 5 rename sweep — `data_tables` / `dataTables` → `collections` 전수 (50+ 파일)**:
  - DB layer: `apps/builder/src/lib/db/indexedDB/adapter.ts` / `types.ts`
  - Zustand store: `apps/builder/src/builder/stores/datatable.ts` / `data.ts` / `utils/dataActions.ts` / `inspectorActions.ts`
  - Hook layer: `useDataQueries.ts` / `useIframeMessenger.ts`
  - Canonical document: `packages/shared/src/types/composition-document.types.ts` (`dataTables` field → `collections`)
  - Canonical adapters: `apps/builder/src/adapters/canonical/rootCollectionMigration.ts` / `canonical/canonicalDocumentStore.ts` / `canonical/canonicalElementsBridge.ts`
  - Preview / Publish: `apps/builder/src/preview/messaging/messageHandler.ts` / `runtimeStore.ts` + `apps/publish` 측 string rename
  - AI tool prompt: `apps/builder/src/services/ai/tools/createElement.ts`
  - Dashboard: `apps/builder/src/dashboard/index.tsx`
- **UI/UX 어휘는 유지** (`DataTable` Pascal): `DataTable.tsx` / `DataTableEditor.tsx` / `DataTableEditorPanel.tsx` / `DataTableList.tsx` / `DataTableComponent.tsx` / `ApiEndpointEditor.tsx` / `datatable.types.ts` / DataPanel label / "Table 추가" 버튼 텍스트

**본 ADR scope 밖** (별 ADR 발의):

- AI tool `createElement.ts` 의 `element.dataBinding.config` 직접 endpoint 박는 패턴 정정 (W3) — string rename 만 본 ADR 안, dataBinding 구조 변경은 별 ADR
- apps/publish 의 `ProjectData` 직렬화 정합 (W4) — string rename 만 본 ADR 안, 직렬화 schema 정합은 별 ADR
- DataPanel UI 의 정적 입력 / API 결과 표시 UX 개선
- Element.dataBinding type 의 source enum 정합 (현 `static/api/supabase/state/parent` 5종 enum 의 valid 여부 재평가)
