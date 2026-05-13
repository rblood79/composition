# ADR-132 design breakdown — useCollectionData useAsyncList 정합 + collections sink 통일 (+ data_tables → collections rename + Transformer 제거)

> 본 문서는 [ADR-132](../completed/132-usecollectiondata-useasynclist-alignment.md) 의 구현 상세. ADR 본문에는 framing 결정 + 잔존 위험 + Gate 만, 본 문서는 Phase 분해 / 파일 목록 / 체크리스트 / 코드 예시.
>
> **2026-05-13 scope 확장**: 사용자 explicit confirm 으로 `data_tables` (snake) / `dataTables` (camel) → `collections` rename 포함. `DataTable` Pascal (UI 컴포넌트 / Editor / Panel) 유지. IndexedDB store drop 정책 (개발 단계, migration 코드 없음).
>
> **2026-05-13 scope 확장 #2**: Transformer 3-Level 변환 시스템 전체 제거 (사용자 explicit framing — "초기 over-engineering, 불필요"). `executeTransformer` 외부 caller 0건 grep 검증. IndexedDB `transformers` store + Zustand state+actions + DataTable Panel "Transformers" 탭 + `TransformerList.tsx` 전수 제거. Phase 7 sweep 신규.

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
- **Transformer 제거 baseline frozen (Phase 7 sweep 대상)**:
  - `\bTransformer\b` / `\btransformers\b` (변수 / 타입) 15 파일 — type 정의 / IndexedDB store / Zustand state+actions / UI 탭 / TransformerList 컴포넌트
  - `\bTransformLevel\|TransformContext\|FieldMapping\|ResponseMappingConfig\|JsTransformerConfig\|CustomFunctionConfig\b` — type 정의 1 파일 + import 사이트 다수
  - `executeTransformer\|fetchTransformers\|createTransformer\|updateTransformer\|deleteTransformer` — actions 5종. UI caller (TransformerList / DataTablePanel / useDataQueries) 외 events/actions 흐름 caller = **0건**
  - IndexedDB `"transformers"` object store name literal — `adapter.ts` 12 hits
  - DB_VERSION 현재값 + bump 후 값 frozen
  - **사용 흔적 grep (Phase 7 진입 전 final 검증)**:
    - `Element.actions[].action.type === "transform" / "transformer"` 사용처 — 0건 예상
    - `element.dataBinding.transformer*` 류 binding — 0건 예상
    - LLM AI prompt 안 "Transformer" 언급 — 0건 예상 (createElement.ts 검증)

### Phase 0 inventory 결과 (2026-05-13, HEAD `ad2c371b3`)

**baseline grep 5종 (useCollectionData 영역)**:

|  #  | 측정                                                                                   |   shared    | builder | total  |
| :-: | :------------------------------------------------------------------------------------- | :---------: | :-----: | :----: |
|  1  | `apiEndpointData` / `setApiEndpointData` site                                          |      5      |    6    | **11** |
|  2  | `loadStaticData` / `loadApiData` 호출                                                  |     2+2     |   2+2   |   8    |
|  3  | `isCanvasContext` / `/api/proxy` 분기                                                  |      4      |    7    |   11   |
|  4  | PropertyDataBinding `source: dataTable\|api` 분기                                      |      9      |    7    |   16   |
|  5  | `processedData` 4-tier (dataTableData / apiEndpointData / datatableState / list.items) | 4-tier 확정 |    —    |   —    |

**frozen 수치 (Phase 1+ 의 BC 수식화 의무)**:

- `apiEndpointData` / `setApiEndpointData` / `apiEndpointLoading` / `apiEndpointError` site: 11 (shared 5 + builder 6) — Phase 1 sweep 대상
- `reloadTrigger` 호출처: 9 site (모두 useCollectionData hook 내부) — `list.reload()` 치환 대상
- `loadStaticData` / `loadApiData` 호출: 8 site (useAsyncList load callback 내부) — Legacy collection 흐름 유지
- **Legacy collection (`type:"collection"`) 사용 element**: factory `DataComponents.ts` 1건 + AI tool `createElement.ts` 1건 + test fixture 4건 + 8 RAC 컴포넌트 (Select/RadioGroup/ListBox/ComboBox/GridList/Menu/TagGroup/CheckboxGroup) 의 hook 분기 = 사용자 데이터 element 측정 결과 **0건 (별 ADR fork 불필요, Phase 2 (a) 채택 lock-in)**
- RAC renderer read 진입점: 8 컴포넌트 (Table / ListBox / GridList / ComboBox / Select / Tree / Breadcrumbs / Menu)
- `apiEndpointService` DI Context 주입 site: `packages/shared/src/types/collection.types.ts:174` 에 `apiEndpointService?` optional 정의. Canvas 측 주입 보장 안 됨 → **R2 잠재 위험 — Phase 3 분기 잔존 가능성**
- `executeApiEndpoint` 의 `signal: AbortSignal` 파라미터 지원 여부: `dataActions.ts:587 signal: controller.signal` 내부 사용 있음, 그러나 caller-supplied signal 받는 interface 아님 → Phase 1 에서 interface 확장 필요 (or signal 전파 deferred)

**rename baseline frozen (Phase 5 sweep 대상, code .ts/.tsx 만)**:

- `\bdata_tables\b` (snake): **15 파일**
- `\bdataTables\b` (camel): **18 파일**
- `\bDataTable\b` (Pascal): **58 파일** — UI surface allowlist 보존 (Component / Editor / Panel / Action / 파일명 / 디렉토리)
- DB_VERSION 현재값 측정 (adapter.ts) 후 Phase 5 에서 bump

**Transformer 제거 baseline frozen (Phase 7 sweep 대상)**:

- `\bTransformer\b` / `\btransformers\b` (변수 / 타입): **14 파일** (예측 15 파일 중 13 + AI prompt 0 + others)
- 14 파일 상세 hit count:
  - `apps/builder/src/types/builder/data.types.ts:17` (type 정의 중심)
  - `apps/builder/src/lib/db/types.ts:11`
  - `apps/builder/src/builder/stores/inspectorActions.ts:1`
  - `apps/builder/src/lib/db/indexedDB/adapter.ts:35` (transformers store)
  - `apps/builder/src/builder/stores/data.ts:14`
  - `apps/builder/src/builder/hooks/useDataQueries.ts:14`
  - `apps/builder/src/builder/panels/datatable/components/TransformerList.tsx:14` (파일 삭제 대상)
  - `apps/builder/src/builder/panels/datatable/DataTablePanel.tsx:3`
  - `apps/builder/src/builder/panels/datatable/stores/dataTableEditorStore.ts:1`
  - `apps/builder/src/builder/panels/datatable/DataTableEditorPanel.tsx:9`
  - `apps/builder/src/dashboard/index.tsx:3`
  - `apps/builder/src/builder/stores/utils/dataActions.ts:40`
  - `apps/builder/src/builder/panels/core/panelConfigs.ts:1`
  - `apps/builder/src/builder/panels/datatable/types/editorTypes.ts:2`
- **Phase 7 진입 전 final 검증 grep 3-way (2026-05-13 측정)**:
  - `executeTransformer` / `action.type === "transform"` events/actions 흐름 caller — `apps/builder/src/types/builder/data.types.ts:562` (interface 선언) + `apps/builder/src/builder/stores/data.ts:161,295` (action factory) + `TransformerList.tsx:34,71` (UI 자체) = **외부 caller 0건 ✓**
  - `Element.dataBinding.transformer*` 류 binding — `data.types.ts` (type 정의 자체) 외 caller 0건 ✓
  - LLM AI prompt 안 "Transformer" 언급 (`services/ai/`) — **0건 ✓**

**Phase 7 진입 가능 lock-in**: 3-way 검증 모두 통과 → Phase 7 sweep 진입 가능.

**Phase 2 (a) lock-in**: Legacy collection (`type:"collection", source:"api"`) 사용 데이터 element 0건 → R4 위험 해소, 흐름 유지 (별 ADR fork 불필요).

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

**Phase 2 확정 (2026-05-13 Phase 0 inventory)**: **(a) 흐름 유지 lock-in**. Phase 0 grep 결과 — Legacy collection (`type:"collection", source:"api"`) 사용 데이터 element **0건** 확정. factory `DataComponents.ts` / AI tool `createElement.ts` / test fixture 외 실 사용 없음. 별 ADR fork 불필요. `loadStaticData` / `loadApiData` 헬퍼 함수 유지 (Phase 1 변경에서 그대로 보존됨).

**Phase 2 commit**: 결정 lock-in 만, 코드 변경 없음. Phase 3/4 와 단일 commit 통합.

### Phase 3 — Canvas vs Builder isCanvasContext 분기 통합

**목표**: Canvas 측 직접 proxy fetch (line 365-391) 와 Builder 측 `executeApiEndpoint` (line 393-395) 의 분기를 단일 경로 (`executeApiEndpoint`) 로 통합.

**전제**: Canvas iframe 에서 `executeApiEndpoint` 호출 가능한가 — `apiEndpointService` DI Context 가 Canvas 측에서도 주입되어 있는가 확인 (Phase 0 inventory 항목).

**기대**: Canvas 측에서도 동일 fetcher → `data_tables.runtimeData` sink. 양쪽 동시 호출 cache 충돌 없음 (`data_tables.runtimeData` 가 single source).

**Phase 3 Gate**:

- G3-1: Canvas 측 read 가 `data_tables.runtimeData` 에서 가져오는지 확인 (`syncDataTablesToCanvas` postMessage 경유)
- G3-2: `isCanvasContext` 분기 제거 또는 단순화

**Phase 3 확정 (2026-05-13 Phase 0 inventory)**: **분기 잔존 lock-in (G3 실패 시 대안 채택)**. Phase 0 grep — `apiEndpointService?` 가 optional 정의 (`packages/shared/src/types/collection.types.ts:174`), Canvas 측 주입 보장 안 됨. Canvas iframe 안 `useDataStore` instance 의 `executeApiEndpoint` action 자체는 호출 가능하나 endpoint.id 매칭 + runtimeStore.dataTables sink 양쪽 정합 보강 작업 추가 필요 → 본 ADR scope 안 추가 작업은 오버엔지니어링. Phase 1 단일화 시 `isCanvasContext` 분기를 `useAsyncList.load` callback 안으로 옮겨 보존했으므로 Phase 3 의 단일화 목적 (load callback 단일 진입점) 부분 충족. Canvas 측 sink 정합 완성은 후속 ADR 발의 영역.

**Phase 3 commit**: 결정 lock-in 만, 코드 변경 없음. Phase 2/4 와 단일 commit 통합.

### Phase 4 — collectionDataCache 의 data_tables 정합 검증

**목표**: `collectionDataCache` LRU 가 `data_tables.runtimeData` 와 staleness 충돌 없는지 검증. dataTables Zustand subscribe → 변경 시 cache invalidate 필요.

**의문**: data_tables.runtimeData 가 갱신될 때 useCollectionData hook 의 `list` 가 reload 되는가? — useDataStore 의 dataTables Map 이 selector 로 subscribed 되어 있고 변경 시 hook re-render → useAsyncList load 재실행되어야 함.

**Phase 4 확정 (2026-05-13)**: **Phase 1 변경에 이미 흡수 완료**. Builder hook 의 `dataTablesMap = useDataStore((s) => s.dataTables)` selector 가 Map immutable update 시에만 새 reference 생산 → `useEffect([dataTablesMap, propertyBindingFormat, ...])` 가 api binding 일 때 `list.reload()` trigger. cache invalidation 은 `list.reload()` 호출 시 `reloadTrigger === 0` 캐시 hit 조건이 자연 회피 (Phase 1 단일화로 reloadTrigger state 자체 삭제). Shared hook 도 동일 패턴 (`useEffect([dataTables, ...])` — DI Context 로부터 받은 array 가 Map snapshot 변경 시 새 reference).

cache key 에 dataTables version 포함하는 강한 격리 방안은 본 ADR scope 안 추가 작업이며 staleness 실측 회귀 발생 시 추가 ADR 으로 처리.

**Phase 4 commit**: 결정 lock-in 만, 코드 변경 없음. Phase 2/3 와 단일 commit 통합.

### Phase 5 — rename sweep (`data_tables` / `dataTables` → `collections`)

**목표**: Phase 1-4 완료 후 single PR 로 mechanical rename land. Builder + Publish + Shared + Preview 동시 변경 (R8 — postMessage schema 양쪽 동시 deploy 필요).

**rename 매핑 (rule: UI surface 유지 + internal data 어휘 rename)**:

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
| `DataTablesMap`                      | `CollectionsMap`                      | internal Pascal type (data structure)                                    |
| `DataTableState`                     | `CollectionState`                     | internal Pascal type (store state)                                       |
| `DataTableConfig`                    | `CollectionConfig`                    | internal Pascal type (config)                                            |
| `DataTableData`                      | `CollectionData`                      | internal Pascal type (row data)                                          |
| `DataTableRow`                       | `CollectionRow`                       | internal Pascal type (row)                                               |

**유지 (UI/UX surface — Pascal `DataTable` 사용자 노출만)**:

- **Component** (사용자 컴포넌트 / renderer): `DataTable.tsx` / `DataTableComponent.tsx`
- **Editor** (Inspector / Panel editor): `DataTableEditor.tsx` / `DataTableEditorPanel.tsx` / `DataTableList.tsx` / `ApiEndpointEditor.tsx`
- **Action editor** (사용자 노출 action 이름): `LoadDataTableActionEditor.tsx` / `SaveToDataTableActionEditor.tsx`
- **파일명 + 디렉토리**: `datatable.types.ts` / `panels/datatable/` 디렉토리
- **UI 텍스트**: DataPanel label / "Table 추가" 버튼 텍스트 / Action 이름 ("Load DataTable" / "Save to DataTable")

**rule lock-in (옵션 1 — 사용자 explicit confirm 2026-05-13)**:

> `DataTable` Pascal 은 **사용자 노출 (UI component / Editor / Panel / Action 이름 / 디렉토리)** 만 유지. **internal data structure type** (Map / State / Config / Data / Row / nested property like `targetDataTable`) 은 `Collection` 으로 rename.

근거: type 이름만으로 "UI surface 인가 internal data 인가" 즉시 구분. RSP Dynamic Collections 정통 어휘 정합 (internal). 사용자 RDB 친숙도 유지 (UI).

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

**검증** (Phase 5 grep gate — 6-way):

- `rg '\bdata_tables\b' -g '*.{ts,tsx}' -g '!*.test.*' -g '!node_modules'` = **0 hit** (코드 .ts/.tsx 만, docs .md 는 별도)
- `rg '\bdataTables\b' -g '*.{ts,tsx}' -g '!*.test.*' -g '!node_modules'` = **0 hit**
- `rg '\btargetDataTable\b' -g '*.{ts,tsx}' -g '!node_modules'` = **0 hit** (endpoint nested property)
- `rg '\b(DataTablesMap|DataTableState|DataTableConfig|DataTableData|DataTableRow)\b' -g '*.{ts,tsx}' -g '!node_modules'` = **0 hit** (internal Pascal type)
- `rg '"dataTables"' -g '*.{ts,tsx}' -g '!node_modules'` = **0 hit** (postMessage type literal)
- `rg '\bDataTable\b' -g '*.{ts,tsx}' -g '!node_modules'` = **baseline 보존** — UI surface allowlist:
  - `DataTable.tsx` (Component) / `DataTableComponent.tsx` (renderer)
  - `DataTableEditor.tsx` / `DataTableEditorPanel.tsx` / `DataTableList.tsx` / `ApiEndpointEditor.tsx`
  - `LoadDataTableActionEditor.tsx` / `SaveToDataTableActionEditor.tsx`
  - `datatable.types.ts` (파일명) / `panels/datatable/` 디렉토리
  - UI label / 버튼 텍스트 / Action 이름 (사용자 노출)
- type-check 3/3 PASS
- vitest 기존 PASS 유지
- Chrome MCP smoke — DataTable 패널 / API endpoint 실행 / RAC collection 컴포넌트 read 정상

**docs (.md) 갱신 정책**:

- ADR-132 본문 / breakdown / reviews / README ✅ 갱신
- 현 schema reference (`docs/reference/schemas/INDEXDB.md`) **갱신 필수** (현 schema 반영)
- `docs/reference/components/TRANSFORMER_SECURITY.md` / `docs/how-to/development/PANEL_OPTIMIZATION.md` **검토 후 결정** (현 문서 vs historical)
- Historical ADR (116/120/121/122/131 본문 + completed/, design breakdown) **historical 보존** (Status 시점 어휘)
- `docs/legacy/DATA_SYNC.md` / `docs/legacy/DATASET_RENAME.md` **legacy 보존**
- `docs/features/completed/DATA_PANEL.md` / `docs/features/completed/NESTED_ROUTES.md` **completed historical 보존**

**Phase 5 Gate**: G6 (rename sweep grep gate — ADR 본문 §Gates 참조)

**Phase 5 commit**: `feat(adr-132): Phase 5 — data_tables → collections rename sweep + DB_VERSION bump`

### Phase 7 — Transformer 제거 sweep (dead infrastructure cleanup)

**목표**: Transformer 3-Level 변환 시스템 (type + IndexedDB store + Zustand state+actions + UI 탭 + TransformerList) 전수 제거. 단일 commit (or 작은 묶음 2-3 commit) 로 land.

**진입 전 final 검증** (Phase 6 codex review N차 이후):

```bash
# 1. events/actions 흐름 caller — 0건이어야 진입 가능
rg "executeTransformer|action\.type === \"transform\"" apps/builder/src --type ts --type tsx

# 2. Element.dataBinding 안 transformer 참조 — 0건이어야 진입 가능
rg "transformer" apps/builder/src/types/builder apps/builder/src/builder/components/property --type ts --type tsx -i

# 3. AI tool prompt 안 Transformer 언급 — 0건이어야 진입 가능
rg "Transformer" apps/builder/src/services/ai --type ts
```

진입 전 검증에서 caller 발견 시 — 별 ADR fork (Transformer 사용 흐름이 실재한다는 framing 검증 후 본 ADR scope 에서 빼고 별 ADR 발의).

**제거 영역**:

1. **Type definitions** (`apps/builder/src/types/builder/data.types.ts`):
   - `Transformer / TransformLevel / FieldMapping / ResponseMappingConfig / JsTransformerConfig / CustomFunctionConfig / TransformContext / TransformerCreate / TransformerUpdate / isTransformer` 전수 제거
   - `DataPanelStore` interface 의 `transformers: Map<string, Transformer>` state + 5 actions signature 제거
2. **DB layer**:
   - `apps/builder/src/lib/db/types.ts` — Transformer type 제거
   - `apps/builder/src/lib/db/indexedDB/adapter.ts`:
     - `transformers` object store create 블록 제거 (line 298-318)
     - `this.transformers = { ... }` CRUD 블록 제거 (line 894-972 영역)
     - `transformers` 사용 cleanup 블록 제거 (line 1163 등)
     - **DB_VERSION bump** (한 번에 `data_tables` drop + `transformers` drop + `collections` create)
3. **Zustand store**:
   - `apps/builder/src/builder/stores/data.ts` — Transformer import / state slice / 5 actions (`fetchTransformers / createTransformer / updateTransformer / deleteTransformer / executeTransformer`) / `useTransformers` selector / `useTransformer` selector 전수 제거
   - `apps/builder/src/builder/stores/utils/dataActions.ts` — 5 action creator (`createFetchTransformersAction / createCreateTransformerAction / createUpdateTransformerAction / createDeleteTransformerAction / createExecuteTransformerAction`) 전수 제거 (~250 LOC)
   - `apps/builder/src/builder/stores/inspectorActions.ts` — Transformer 참조 (있으면) 제거
4. **Hook layer**:
   - `apps/builder/src/builder/hooks/useDataQueries.ts`:
     - `fetchTransformers` function 제거 (line 113-)
     - `useTransformers` TanStack Query hook 제거 (line 196 / line 419 영역)
     - `dataQueryKeys.transformers` query key 제거 (line 57)
5. **UI 영역**:
   - `apps/builder/src/builder/panels/datatable/DataTablePanel.tsx`:
     - `DataTableTab` enum 의 `"transformers"` 제거 (line 43)
     - `TABS` 배열의 Transformers tab 제거 (line 55 — `{ id: "transformers", label: "Transformers", icon: Workflow }`)
     - `activeTab === "transformers"` conditional rendering 제거 (line 211)
     - `fetchTransformers` 호출 제거 (line 82, 95, 101, 135)
   - `apps/builder/src/builder/panels/datatable/DataTableEditorPanel.tsx` — Transformer 영역 제거
   - `apps/builder/src/builder/panels/datatable/components/TransformerList.tsx` — **파일 삭제** (사용자 explicit 승인 필요. ADR commit 직전 별도 확인)
   - `apps/builder/src/builder/panels/datatable/index.ts` — `TransformerList` export 제거
   - `apps/builder/src/builder/panels/datatable/types/editorTypes.ts` — Transformer 관련 type 제거
   - `apps/builder/src/builder/panels/datatable/stores/dataTableEditorStore.ts` — Transformer state 제거
   - `apps/builder/src/builder/panels/datatable/editors/ApiEndpointEditor.tsx` — Transformer 연계 (있을 경우) 제거
   - `apps/builder/src/builder/panels/core/panelConfigs.ts` — Transformer 관련 panel 항목 제거
6. **외부 사용 (예상 0건, 진입 전 final 검증)**:
   - `apps/builder/src/builder/main/BuilderCore.tsx` — fetchTransformers 호출 제거
   - `apps/builder/src/dashboard/index.tsx` — Transformer 참조 (있을 경우) 제거

**파일 삭제 정책 (composition CLAUDE.md §"마이그레이션/리네임/삭제 작업 원칙")**:

> 원본 파일 삭제는 명시적 승인 필요. ADR 본문 commit 후 Phase 7 land 직전 별도 사용자 확인 — "원본 파일 `TransformerList.tsx` 를 삭제해도 되나요?"

**검증** (Phase 7 grep gate — 5-way, ADR 본문 G7 참조):

- `rg '\bTransformer\b' -g '*.{ts,tsx}' -g '!node_modules'` = **0 hit**
- `rg '\btransformers\b' -g '*.{ts,tsx}' -g '!node_modules'` = **0 hit** (object store name literal 포함)
- `rg '\b(TransformLevel|TransformContext|FieldMapping|ResponseMappingConfig|JsTransformerConfig|CustomFunctionConfig)\b' -g '*.{ts,tsx}' -g '!node_modules'` = **0 hit**
- `rg 'executeTransformer|fetchTransformers|createTransformer|updateTransformer|deleteTransformer' -g '*.{ts,tsx}' -g '!node_modules'` = **0 hit**
- `apps/builder/src/builder/panels/datatable/components/TransformerList.tsx` 파일 부재
- type-check 3/3 PASS
- vitest 기존 PASS 유지
- Chrome MCP smoke — DataTable 패널의 Tables / API / Var 3개 탭만 존재 + 정상 작동, Transformer 탭 사라짐 확인

**Phase 7 commit**: `feat(adr-132): Phase 7 — Transformer 3-Level 시스템 전수 제거 (dead infrastructure cleanup)`

### Phase 8 — Status Implemented + README + CHANGELOG

- ADR Status `Proposed → Implemented`
- `docs/adr/README.md` ADR-132 entry 갱신
- `docs/CHANGELOG.md` 신 엔트리 (rename + sink 통일 + Transformer 제거 3건 명시)

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
| R10 (Transformer 제거 시 외부 caller 가 늦게 발견되어 runtime crash)                                                  |   7   | G7   | Phase 7 진입 전 final 검증 grep 3-way (events/actions / Element.dataBinding / AI prompt) = 0건. type-check 3/3 PASS              | caller 발견 시 별 ADR fork (Transformer 사용 흐름 실재 framing 검증 후 본 ADR scope 에서 제외)                           |

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
| R10 | Transformer 제거 시 외부 caller (events/actions / Element.dataBinding / AI prompt) 늦게 발견    | **LOW** | Phase 7 진입 전 final 검증 grep 3-way = 0건 확인 후 진입. 검증에서 caller 발견 시 별 ADR fork (본 ADR scope 에서 제외). UI 자체 caller (TransformerList.tsx) 만 존재하므로 위험 LOW                                                                                        |

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
- **Phase 5 rename sweep — `data_tables` / `dataTables` → `collections` 전수 (코드 .ts/.tsx 31 파일 + targetDataTable 6 파일 + internal Pascal type 약 10 파일)**:
  - DB layer: `apps/builder/src/lib/db/indexedDB/adapter.ts` / `types.ts`
  - Zustand store: `apps/builder/src/builder/stores/datatable.ts` (store 이름 변경, 파일명 유지) / `data.ts` / `utils/dataActions.ts` / `inspectorActions.ts`
  - Hook layer: `useDataQueries.ts` / `useIframeMessenger.ts` / `useCollectionData.tsx` / `useCollectionData.ts`
  - Canonical document: `packages/shared/src/types/composition-document.types.ts` (`dataTables` field → `collections`) / `composition-document-actions.types.ts`
  - Canonical adapters: `apps/builder/src/adapters/canonical/rootCollectionMigration.ts` / `canonical/canonicalDocumentStore.ts` / `canonical/canonicalElementsBridge.ts`
  - Preview / Publish: `apps/builder/src/preview/messaging/messageHandler.ts` / `runtimeStore.ts` / `preview/store/types.ts`
  - Type definitions: `apps/builder/src/types/builder/data.types.ts` / `apps/builder/src/types/datatable.types.ts` (파일명 유지) / `packages/shared/src/types/collection.types.ts`
  - Events / Action types: `apps/builder/src/builder/panels/events/types/eventTypes.ts` / `events.types.ts` / `actions/ActionEditor.tsx`
  - AI tool prompt: `apps/builder/src/services/ai/tools/createElement.ts`
  - Dashboard: `apps/builder/src/dashboard/index.tsx`
  - Property binding: `apps/builder/src/builder/components/property/PropertyDataBinding.tsx`
  - Builder core: `apps/builder/src/builder/main/BuilderCore.tsx`
- **Internal Pascal type rename** (옵션 1 lock-in — 사용자 explicit confirm 2026-05-13):
  - `DataTablesMap` → `CollectionsMap` / `DataTableState` → `CollectionState` / `DataTableConfig` → `CollectionConfig` / `DataTableData` → `CollectionData` / `DataTableRow` → `CollectionRow`
  - `targetDataTable` nested property → `targetCollection` (6 파일: `dataActions.ts` / `ApiEndpointEditor.tsx` / `data.types.ts` / `indexedDB/adapter.ts` / `events.types.ts` / `DataTableList.tsx`)
- **UI/UX 어휘는 유지** (Pascal `DataTable` — 사용자 노출만):
  - Component / Renderer: `DataTable.tsx` / `DataTableComponent.tsx`
  - Editor: `DataTableEditor.tsx` / `DataTableEditorPanel.tsx` / `DataTableList.tsx` / `ApiEndpointEditor.tsx`
  - Action editor (사용자 노출 action 이름): `LoadDataTableActionEditor.tsx` / `SaveToDataTableActionEditor.tsx`
  - 파일명 / 디렉토리: `datatable.types.ts` / `panels/datatable/`
  - UI 텍스트: DataPanel label / "Table 추가" 버튼 / Action 이름 ("Load DataTable" / "Save to DataTable")
- **Phase 7 Transformer 제거 sweep — 영향 15 파일 (외부 caller 0건 검증 후 진입)**:
  - Type definitions: `apps/builder/src/types/builder/data.types.ts` (Transformer 관련 10개 type / interface 전수 제거)
  - DB layer: `apps/builder/src/lib/db/types.ts` (Transformer type) / `apps/builder/src/lib/db/indexedDB/adapter.ts` (transformers store create + CRUD 블록 + DB_VERSION bump)
  - Zustand store: `apps/builder/src/builder/stores/data.ts` (state slice + 5 actions) / `apps/builder/src/builder/stores/utils/dataActions.ts` (5 action creator ~250 LOC) / `apps/builder/src/builder/stores/inspectorActions.ts` (있을 경우)
  - Hook layer: `apps/builder/src/builder/hooks/useDataQueries.ts` (fetchTransformers / useTransformers / query key)
  - UI 영역:
    - `apps/builder/src/builder/panels/datatable/DataTablePanel.tsx` (Transformers 탭 + tab enum + fetch 호출)
    - `apps/builder/src/builder/panels/datatable/DataTableEditorPanel.tsx` (Transformer 영역)
    - `apps/builder/src/builder/panels/datatable/components/TransformerList.tsx` (**파일 삭제** — 사용자 explicit 승인 필요)
    - `apps/builder/src/builder/panels/datatable/index.ts` (export 제거)
    - `apps/builder/src/builder/panels/datatable/types/editorTypes.ts` (Transformer type)
    - `apps/builder/src/builder/panels/datatable/stores/dataTableEditorStore.ts` (Transformer state)
    - `apps/builder/src/builder/panels/datatable/editors/ApiEndpointEditor.tsx` (Transformer 연계, 있을 경우)
    - `apps/builder/src/builder/panels/core/panelConfigs.ts` (Transformer panel 항목)
  - 외부 (예상 0건): `apps/builder/src/builder/main/BuilderCore.tsx` (fetchTransformers) / `apps/builder/src/dashboard/index.tsx` (Transformer 참조)

**본 ADR scope 밖** (별 ADR 발의):

- AI tool `createElement.ts` 의 `element.dataBinding.config` 직접 endpoint 박는 패턴 정정 (W3) — string rename 만 본 ADR 안, dataBinding 구조 변경은 별 ADR
- apps/publish 의 `ProjectData` 직렬화 정합 (W4) — string rename 만 본 ADR 안, 직렬화 schema 정합은 별 ADR
- DataPanel UI 의 정적 입력 / API 결과 표시 UX 개선
- Element.dataBinding type 의 source enum 정합 (현 `static/api/supabase/state/parent` 5종 enum 의 valid 여부 재평가)
