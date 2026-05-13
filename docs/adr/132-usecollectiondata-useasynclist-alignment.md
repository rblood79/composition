# ADR-132: useCollectionData useAsyncList 정합 + collections sink 통일 (+ data_tables → collections rename + Transformer 제거)

## Status

Implemented — 2026-05-13

진행 로그:

- 2026-05-13 — ADR 본문 발의 (Proposed) + design breakdown land
- 2026-05-13 — scope 확장: `data_tables` → `collections` rename 포함 (사용자 explicit confirm — RSP Dynamic Collections 정통 framing 1:1 정합. 개발 단계라 user data migration 위험 0, DB drop 으로 처리)
- 2026-05-13 — scope 확장 #2: Transformer 3-Level 변환 시스템 전체 제거 (사용자 explicit framing — "초기 over-engineering, 불필요". `executeTransformer` 외부 caller 0건 grep 검증. IndexedDB `transformers` store 포함 전수 drop)
- 2026-05-13 — Phase 0~8 완결 land (commits `12d1ff833..c52fd344f`):
  - Phase 0 (`12d1ff833`): inventory baseline freeze — 11 apiEndpointData site / 9 reloadTrigger / 15 snake / 18 camel / 58 Pascal / 14 Transformer 파일 측정
  - Phase 1 (`b09e65faf`): useAsyncList load callback 단일화 — apiEndpointData useState 4 + useEffect 블록 + reloadTrigger 제거, dataTablesMap subscribe 로 list.reload trigger (-136 LOC)
  - Phase 2/3/4 (`d2b644f37`): Legacy collection (a) 유지 + Canvas 분기 잔존 + dataTables subscribe Phase 1 흡수 lock-in
  - Phase 5 (`dd2c91a38`): `data_tables` → `collections` rename 32 파일 + DB_VERSION 17 → 18 + legacy data_tables store drop migration. G6 6-way grep gate 통과
  - Phase 7 (`c52fd344f`): Transformer 3-Level 시스템 전수 제거 16 파일 (-814 LOC net) + TransformerList.tsx 파일 삭제 (사용자 explicit 승인) + transformers store drop migration. G7 5-way grep gate 통과
  - Phase 8 (현재): Status Implemented 승격 + README + CHANGELOG

## Context

### 3-domain 분류 (ADR-063 정합)

본 ADR 은 [ssot-hierarchy.md](../../.claude/rules/ssot-hierarchy.md) 의 D1 (DOM/접근성) / D2 (Props/API) / D3 (시각 스타일) 중 **어느 직접 영역에도 속하지 않는 data flow architecture layer** 결정이다. 단 D1 / D2 와 간접 연계 — RAC/RSC collection 컴포넌트 (Table / ListBox / GridList / ComboBox / Select / Tree) 의 `items` prop 흐름이 D1 (RAC 절대 권위) 의 정통 RSP `useAsyncList` 패턴을 따라야 한다는 제약.

### 문제 framing

[ADR-131 Phase 8 revert (2026-05-13)](131-events-data-actions-first-class-collections.md) 가 lock-in 한 사용자 framing — **"RAC/RSC 컴포넌트에서 사용되는 data 의 SSOT = `data_tables`. `Element.dataBinding` 은 element 별 binding reference"** — 의 직접 후속.

`useCollectionData` (read 진입점 hook) 현 코드의 PropertyDataBinding `source="api"` 분기는:

1. `useAsyncList` 정통 RSP 패턴을 **우회** — 별도 `useEffect` + `apiEndpointData` local useState 로 데이터 보관 (`packages/shared/src/hooks/useCollectionData.tsx:317-437`)
2. `data_tables` 를 **우회** — `executeApiEndpoint` 호출 후 결과를 `data_tables.runtimeData` 에 sink 하는 정합 경로 (Builder 측 `dataActions.ts:executeApiEndpoint` Line 605) 가 있는데도, useCollectionData 측은 별도 local state 에 결과 보관
3. Canvas 측은 더 강한 우회 — `/api/proxy` 직접 fetch (line 365-391), `executeApiEndpoint` 미사용, 결과는 local state

이 우회 패턴은 다음 문제를 발생시킨다:

- **중복 호출**: 같은 endpoint 를 2개 element 가 참조 시 element 별 useCollectionData hook 인스턴스 2회 fetch (LRU cache 보조하지만 mount 시점 race)
- **Staleness**: `data_tables.runtimeData` 갱신이 useCollectionData 측 local state 에 반영 안 됨 (reload trigger 명시 호출 시만)
- **mental model 분기**: source="dataTable" 분기는 dataTables 경유, source="api" 분기는 우회 — 같은 hook 안 2 패턴
- **RSP 정통 패턴과의 괴리**: RSP `useAsyncList` 의 load callback 안에서 모든 분기를 처리하는 정합이 흐트러져, 코드 추적 비용 ↑ + 신규 source 추가 시 어디에 박을지 모호

### Hard Constraints

1. **RAC/RSC read 진입점 단일**: collection 컴포넌트가 `useCollectionData` 한 hook 으로 모든 source (`dataTable` / `api` / Legacy `static` / Legacy `api` / `supabase` deferred) 를 동일 인터페이스로 read 가능
2. **collections sink 통일**: API endpoint 실행 결과는 반드시 `collections.runtimeData` 거쳐 read (사용자 framing — [[project-data-tables-ssot-framing]])
3. **RSP `useAsyncList` 정통 패턴**: `useAsyncList.load` callback 안에서 모든 분기 종결, `list.items` 단일 read 진입점
4. **rename 정합 (UI vs internal 구분 rule)**:
   - `data_tables` (DB snake) / `dataTables` (store camel) → `collections` (canonical document / IndexedDB store / Zustand action API 단일 어휘)
   - **rule lock-in**: `DataTable` Pascal 은 **사용자 노출 (UI component / Editor / Panel / Action 이름 / 디렉토리)** 만 유지. **internal data structure type** 은 `Collection` 으로 rename
   - **UI surface 유지** (Pascal `DataTable`): `DataTable.tsx` / `DataTableComponent.tsx` / `DataTableEditor.tsx` / `DataTableEditorPanel.tsx` / `DataTableList.tsx` / `ApiEndpointEditor.tsx` / `datatable.types.ts` (파일명) / `LoadDataTableActionEditor.tsx` / `SaveToDataTableActionEditor.tsx` (Action 이름 사용자 노출) / 디렉토리 `panels/datatable/` / DataPanel UI label / "Table 추가" 텍스트
   - **internal type rename** (Pascal): `DataTablesMap` → `CollectionsMap` / `DataTableState` → `CollectionState` / `DataTableConfig` → `CollectionConfig` / `DataTableData` → `CollectionData` / `DataTableRow` → `CollectionRow` / `targetDataTable` → `targetCollection` (endpoint property)
5. **DB drop 정책**: 개발 단계 — IndexedDB `data_tables` store 는 drop 후 `collections` 신규 생성 (migration 코드 작성 금지, user data 손실 없음). 동시에 IndexedDB `transformers` store 도 drop (Transformer 제거)
6. **Canvas iframe 호환**: Builder ↔ Canvas 양쪽 동일 fetcher 사용 (DI 가능하면) 또는 분기 명시 lock-in. postMessage payload schema (`dataTables` → `collections`) 양쪽 동시 deploy
7. **Transformer 제거** (사용자 explicit framing 2026-05-13 — "초기 over-engineering, 불필요"):
   - **dead infrastructure 검증**: `executeTransformer` 외부 caller (events/actions 흐름) **0건** (grep 결과 2026-05-13 HEAD). UI 자체 (`TransformerList.tsx` 의 `Play` 버튼) 만 trigger
   - **제거 영역 (전수)**:
     - **Types**: `Transformer / TransformLevel / FieldMapping / ResponseMappingConfig / JsTransformerConfig / CustomFunctionConfig / TransformContext / TransformerCreate / TransformerUpdate / isTransformer` (`data.types.ts`)
     - **DB**: IndexedDB `transformers` store + `adapter.ts` `transformers` CRUD 블록 + `lib/db/types.ts` Transformer type
     - **Zustand store**: `useDataStore.transformers` Map state + 5 actions (`fetchTransformers / createTransformer / updateTransformer / deleteTransformer / executeTransformer`) + `createFetchTransformersAction` 류 5 action creator
     - **Hook**: `useDataQueries.ts` Transformer query (`fetchTransformers` / TanStack Query key)
     - **UI**: DataTable Panel 의 "Transformers" 탭 + `TransformerList.tsx` 파일 + `DataTablePanel.tsx` 의 `transformers` tab enum + `BuilderCore.tsx` fetch + `dataTableEditorStore.ts` Transformer state + `editorTypes.ts` Transformer type + `panelConfigs.ts` Transformer 항목 + `DataTableEditorPanel.tsx` Transformer 영역
   - **DB drop 정책 동일 적용**: DB_VERSION bump 한 번에 (a) `data_tables` drop + `collections` create + (b) `transformers` store drop. migration 코드 없음

### Soft Constraints

- Legacy collection (`type:"collection"`) 사용 element 의 마이그레이션 cost — Phase 0 inventory 시 사용 빈도 측정 후 결정
- `apiEndpointData` 류 local state 제거 시 reload UX 동등성 (`list.reload()` 대체 가능 검증)
- `collectionDataCache` LRU 가 `data_tables.runtimeData` 갱신과 staleness 충돌 가능성 — Phase 4 영역
- `executeApiEndpoint` 의 `signal: AbortSignal` 지원 여부 — Phase 0 inventory 시 확인, 미지원 시 추가

### baseline grep (Phase 0 inventory 시 commit hash 와 함께 frozen 예정)

- `apiEndpointData|setApiEndpointData` direct site count
- `loadStaticData|loadApiData` 호출 path (useAsyncList load callback 내부 vs 외부)
- `isCanvasContext|/api/proxy` 분기 site
- `binding\.source === "api"|"dataTable"` 분기 site
- 컴포넌트 read 진입점 (Table / ListBox / GridList / ComboBox / Select / Tree / Breadcrumbs) → useCollectionData 호출 chain
- **rename baseline** (frozen 예정 — code .ts/.tsx 만, docs .md 별도):
  - `data_tables` (snake) 13 파일 — 전수 rename
  - `dataTables` (camel) 18 파일 — 전수 rename
  - `targetDataTable` (endpoint nested property) 6 파일 — `targetCollection` rename
  - `DataTablesMap` / `DataTableState` / `DataTableConfig` / `DataTableData` / `DataTableRow` (internal Pascal type) — `Collection*` rename
  - `DataTable` Pascal **UI surface 유지** (변경 제외): `DataTable.tsx` / `DataTableComponent.tsx` / `DataTableEditor.tsx` / `DataTableEditorPanel.tsx` / `DataTableList.tsx` / `ApiEndpointEditor.tsx` / `LoadDataTableActionEditor.tsx` / `SaveToDataTableActionEditor.tsx` / `datatable.types.ts` 파일명 / 디렉토리 `panels/datatable/`
  - **docs (.md) 30 파일**: ADR-132 본문/breakdown/reviews/README ✅ 갱신. 현 schema reference (`docs/reference/schemas/INDEXDB.md`) 갱신 필수. Historical ADR (116/120/121/122/131 + completed/) 보존. `docs/legacy/` 보존. `docs/features/completed/DATA_PANEL.md` 보존
- **Transformer 제거 baseline** (frozen 예정 — Phase 7 sweep 대상):
  - `\bTransformer\b` / `\btransformers\b` / `\bTransformLevel\b` / `\bTransformContext\b` / `\bResponseMappingConfig\b` / `\bJsTransformerConfig\b` / `\bCustomFunctionConfig\b` / `\bFieldMapping\b` / `\bisTransformer\b` — 15 파일 영향
  - `executeTransformer` / `fetchTransformers` / `createTransformer` / `updateTransformer` / `deleteTransformer` 호출 — 외부 caller (events/actions 흐름) **0건** 검증 완료 (Phase 7 sweep 시 재검증)
  - IndexedDB `"transformers"` object store name literal — `adapter.ts` 12 hits + 다수
  - 영향 파일 15개 (HEAD `c108021fa` 기준 grep):
    - `apps/builder/src/types/builder/data.types.ts` — type 전수 제거
    - `apps/builder/src/lib/db/types.ts` — Transformer type 제거
    - `apps/builder/src/lib/db/indexedDB/adapter.ts` — `transformers` store 생성 블록 제거 + CRUD 블록 제거 + DB_VERSION bump
    - `apps/builder/src/builder/stores/data.ts` — state slice + 5 actions 제거 + `Transformer` import 제거
    - `apps/builder/src/builder/stores/utils/dataActions.ts` — 5 action creator 제거
    - `apps/builder/src/builder/stores/inspectorActions.ts` — Transformer 참조 (있을 경우) 제거
    - `apps/builder/src/builder/hooks/useDataQueries.ts` — fetchTransformers / TanStack Query key 제거
    - `apps/builder/src/builder/main/BuilderCore.tsx` — fetchTransformers 호출 제거
    - `apps/builder/src/dashboard/index.tsx` — Transformer 참조 (있을 경우) 제거
    - `apps/builder/src/builder/panels/core/panelConfigs.ts` — Transformer 항목 제거
    - `apps/builder/src/builder/panels/datatable/DataTablePanel.tsx` — `transformers` tab + 해당 conditional rendering 제거
    - `apps/builder/src/builder/panels/datatable/DataTableEditorPanel.tsx` — Transformer 영역 제거
    - `apps/builder/src/builder/panels/datatable/types/editorTypes.ts` — Transformer type 제거
    - `apps/builder/src/builder/panels/datatable/editors/ApiEndpointEditor.tsx` — Transformer 연계 (있을 경우) 제거
    - `apps/builder/src/builder/panels/datatable/stores/dataTableEditorStore.ts` — Transformer state 제거
  - **파일 삭제** (사용자 explicit 승인 후): `apps/builder/src/builder/panels/datatable/components/TransformerList.tsx`

## Alternatives Considered

### 대안 A: useAsyncList load callback 단일화 + collections sink 통일 + rename (사용자 framing 정합)

- **설명**: (1) PropertyDataBinding `source="api"` 분기를 `useAsyncList.load` 안으로 흡수. `useEffect` + `apiEndpointData` useState 삭제. load callback 안에서 source 별 분기 처리 → `source="api"` 시 `executeApiEndpoint` 호출 → `targetCollection.runtimeData` read. `source="dataTable"` 시 directly `collections.find(name).runtimeData` read. 결과 모두 `list.items` 단일 출구. (2) `data_tables` (snake) / `dataTables` (camel) → `collections` mechanical rename. `DataTable` Pascal (UI 컴포넌트 / Editor / Panel) 유지. (3) IndexedDB `data_tables` store drop + `collections` 신규 생성 (개발 단계, migration 코드 없음). (4) **Transformer 3-Level 변환 시스템 전체 제거** — dead infrastructure (외부 caller 0건). type / IndexedDB store / Zustand state+actions / UI 탭 / TransformerList 컴포넌트 전수 제거. DB_VERSION bump 한 번에 `data_tables` drop + `transformers` drop + `collections` create
- **근거**:
  - RSP `useAsyncList` 정통 패턴 ([react-aria.adobe.com/collections](https://react-aria.adobe.com/collections) 의 Asynchronous loading 섹션) 정합
  - 사용자 framing 명시 lock-in ([[project-data-tables-ssot-framing]] + 2026-05-13 본 세션 explicit confirm — sink 통일 + rename 양쪽)
  - `executeApiEndpoint` 가 이미 `targetDataTable.runtimeData` sink 하므로 useCollectionData 측은 read 만 하면 자연 정합
  - mental model 단순화 — read 진입점은 모든 source 에 대해 `useAsyncList.list.items`
  - rename = RSP Dynamic Collections 용어 1:1 매칭 (`useAsyncList` / Collection 컴포넌트 / `items` prop)
- **위험**:
  - 기술: **LOW** — RSP 정통 패턴 검증 완료, 흡수 패턴은 표준. rename 은 mechanical
  - 성능: **LOW** — local useState 삭제로 re-render trigger 감소. cache 는 LRU 유지
  - 유지보수: **LOW** — 단일 hook 인터페이스, 신규 source 추가 시 load callback 안 분기만. `collections` 어휘로 후속 ADR / 신규 contributor 가독성 ↑
  - 마이그레이션: **MEDIUM** — `apiEndpointData` 의존하는 외부 caller + `data_tables`/`dataTables` 참조 50+ 파일 mechanical rename. **Phase 0 inventory frozen 수치 lock-in 의무**: caller 개수 / LOC / 영향 site count + rename grep baseline (snake 13 / camel 15+ / Pascal 30+ baseline 보존) 를 본 ADR 본문 또는 breakdown §2 Phase 0 산출물 에 명시 (adr-writing.md 동적 seed #3 BC 수식화 충족)

### 대안 B: PropertyDataBinding api source 분기를 dataTables direct read 로 (useAsyncList 거치지 않음)

- **설명**: PropertyDataBinding api source 의 useEffect 를 유지하되, 결과를 local state 가 아닌 dataTables Zustand store 의 `setRuntimeData` 로 push. useCollectionData 의 final read 는 dataTables.runtimeData direct (현재 source="dataTable" 분기 패턴 확장)
- **근거**: data_tables sink 정합만 충족, useAsyncList 자체는 손대지 않음
- **위험**:
  - 기술: LOW
  - 성능: LOW
  - 유지보수: **MEDIUM** — 두 분기 (source="dataTable" / source="api") 가 같은 직접 read 패턴 — 정합. 단 useAsyncList load callback 의 dual purpose (Legacy collection 만 처리 vs PropertyDataBinding 도 처리) 모호
  - 마이그레이션: LOW
  - **본질 한계**: RSP `useAsyncList` 정통 패턴과의 괴리 잔존 — Legacy collection 흐름만 useAsyncList 거치고 PropertyDataBinding 흐름은 우회. 사용자 framing 의 "RSP 레퍼런스 방식 사용" 충족 약함

### 대안 C: 현 상태 유지 (no-op) + 외부 cache layer 만 보강

- **설명**: useEffect + apiEndpointData useState 패턴 유지, collectionDataCache LRU 만 강화하여 중복 호출 / staleness 완화
- **근거**: 변경 minimal, 회귀 위험 0
- **위험**:
  - 기술: LOW
  - 성능: LOW
  - 유지보수: **HIGH** — 본질 mental model 분기 잔존, 신규 source 추가 시 useEffect / useAsyncList 어디에 박을지 매번 결정. RSP 정통 패턴 ↔ composition 패턴 영구 괴리
  - 마이그레이션: LOW
  - **본질 한계**: 사용자 framing 정합 부재 — "RAC/RSC read 진입점은 data_tables 통일" 미충족. ADR-131 Phase 8 revert 의 후속 framing 정합 약속 무산

### Risk Threshold Check

| 대안 | 기술 | 성능 | 유지보수 | 마이그레이션 | HIGH+ 개수 | 본질 한계             |
| :--: | :--: | :--: | :------: | :----------: | :--------: | :-------------------- |
|  A   |  L   |  L   |    L     |      M       |     0      | 없음                  |
|  B   |  L   |  L   |    M     |      L       |     0      | RSP 정통 괴리         |
|  C   |  L   |  L   |    H     |      L       |     1      | 사용자 framing 미충족 |

- HIGH+ 보유: 대안 C 만 (유지보수 HIGH)
- 모든 대안이 HIGH+ 1개 이상이 아님 → 위험 회피용 신 대안 추가 불필요
- 대안 A 가 HIGH+ 0개 + 본질 한계 없음 → 채택

## Decision

**대안 A 채택** — useAsyncList load callback 단일화 + data_tables sink 통일.

> 구현 상세: [132-usecollectiondata-useasynclist-alignment-breakdown.md](design/132-usecollectiondata-useasynclist-alignment-breakdown.md)

### framing checkpoint 4 질문 lock-in (M2 — 사용자 explicit confirm 2026-05-13)

| #   | 질문                          | 답변                                                                                                                                                                                      |
| --- | ----------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | base / 응용 분류              | **응용 ADR**. `data_tables` / `api_endpoints` / `Element.dataBinding` SSOT 는 코드 자연 발생 (명시 base ADR 없음, ADR-131 Phase 8 revert framing 으로 lock-in). 본 ADR 은 read 경로 정합. |
| 2   | schema 직교성                 | type / schema 변경 없음, read 흐름만 정합. ADR-131 events/actions root collection 과 직교 (schema 겹침 0).                                                                                |
| 3   | baseline framing reverse 검증 | ADR-131 Phase 8 revert framing 의 직접 후속. 의존 방향 정방향 (ADR-131 prerequisite → 본 ADR 후속). reverse 검토 시 본 ADR 이 선행했어야 할 가능성 = 0.                                   |
| 4   | codex 3차 미루지 말 것        | scaffold 단계 4 질문 lock-in + 사용자 explicit confirm 통과. codex 1차 review 진입은 Phase 1 본문 land 시점.                                                                              |

### 기각된 대안의 기각 사유

- **대안 B**: data_tables sink 만 정합되고 RSP `useAsyncList` 정통 패턴 괴리 잔존. 사용자 framing "RSP 레퍼런스 방식 사용" 충족 약함.
- **대안 C**: 사용자 framing (data_tables 통일 + RSP 정합) 미충족. 본질 mental model 분기 영구 잔존, 신규 source 추가 시 매번 위치 결정 burden.

## Risks

| ID  | 위험                                                                                                                                                              | 심각도 | 대응                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| :-: | :---------------------------------------------------------------------------------------------------------------------------------------------------------------- | :----: | :------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| R1  | useAsyncList load 안 dataTables Zustand selector 접근 패턴 fragile (closure 캡처 stale 가능 + subscribeWithSelector middleware fallback 함정)                     |  MED   | hook subscribe + closure read 표준화. [[feedback-zustand-selector-cache]] (selector cache 함정 — selector 안 새 객체 반환 금지) + [[feedback-zustand-subscribe-with-selector-fragility]] (subscribeWithSelector middleware fallback 함정 — `subscribe(listener)` 단일 인자 fallback 미작동, selector-aware `(selector, listener)` 호출 필수) 양쪽 모두 적용. useDataStore 는 subscribeWithSelector middleware 사용. dataTables 변경 시 `useEffect(() => list.reload(), [dataTablesVersion])` |
| R2  | Canvas iframe 측 `executeApiEndpoint` DI 미주입 가능성                                                                                                            |  MED   | Phase 0 inventory 에서 `apiEndpointService` DI Context 주입 site 확인. 미주입 시 Phase 3 에서 Canvas 측 분기 잔존 또는 DI 추가                                                                                                                                                                                                                                                                                                                                                               |
| R3  | `collectionDataCache` 가 `data_tables.runtimeData` 갱신과 staleness 충돌 + Canvas iframe postMessage timing race (`syncDataTablesToCanvas` 수신 전 read 시 stale) |  LOW   | dataTables Zustand subscribe + cache invalidate or list.reload. Canvas 측은 postMessage 수신 후 list.reload trigger (`THEME_BASE_TYPOGRAPHY` 패턴 참조)                                                                                                                                                                                                                                                                                                                                      |
| R4  | Legacy collection (`type:"collection"`) 사용 element 의 mass migration burden                                                                                     |  LOW   | Phase 0 inventory 에서 사용 빈도 측정. 0 또는 < 5건 시 (a) 흐름 유지, 그 외 시 별 ADR fork                                                                                                                                                                                                                                                                                                                                                                                                   |
| R5  | `reloadTrigger` 호출처의 UX 회귀                                                                                                                                  |  LOW   | grep + `list.reload()` 치환                                                                                                                                                                                                                                                                                                                                                                                                                                                                  |
| R6  | useAsyncList `load` callback throw 시 RAC/RSC 컴포넌트 error surface 처리 (RAC `list.error` / `list.isLoading` state 의 collection 컴포넌트 binding)              |  MED   | Phase 1 핵심 변경 시 error surface 패턴 명시 — Storybook / Chrome MCP smoke 에서 endpoint 미발견 / fetch fail / abort 3 케이스 검증 항목 추가. RAC `list.isLoading` / `list.error` 을 collection 컴포넌트 (Table / ListBox / GridList / ComboBox / Select) error UX prop 으로 binding                                                                                                                                                                                                        |
| R7  | rename mechanical 누락 (snake/camel mixed 잔존) — type-check 통과해도 string literal (selector / DB store name / postMessage type) 잔존 시 runtime crash          |  MED   | Phase 5 rename sweep 에서 grep gate 3-way 검증 (`\bdata_tables\b` / `\bdataTables\b` literal / postMessage type literal). type-check baseline 도 동시 갱신. AI tool `createElement.ts` prompt 어휘 갱신                                                                                                                                                                                                                                                                                      |
| R8  | Builder ↔ Canvas postMessage payload schema (`dataTables` → `collections`) 양쪽 동시 deploy 필요. 한쪽만 land 시 iframe 통신 silent fail                          |  MED   | rename land 시 `apps/builder` + `apps/publish` + preview iframe 측 messageHandler 3-way 단일 commit. `useIframeMessenger.ts` / `messageHandler.ts` / `runtimeStore.ts` 동시 변경 lock-in                                                                                                                                                                                                                                                                                                     |
| R9  | IndexedDB `data_tables` store drop 시 dev 환경 user (개발자 본인) 의 in-progress 작업 데이터 손실                                                                 |  LOW   | DB_VERSION bump 한 번에 두 작업 (drop + 신규 create) 묶음. dev 환경 안내 + 본 ADR commit 직전 사용자 자신의 dev DB export 권고                                                                                                                                                                                                                                                                                                                                                               |
| R10 | Transformer 제거 시 외부 caller (events/actions 흐름 / element factory) 가 늦게 발견되면 runtime crash                                                            |  LOW   | Phase 7 sweep 전 재검증 grep (`executeTransformer` / `fetchTransformers` / `transformers` map access) = 0건 확인 후 진행. `isTransformer` 타입 가드 호출처 / `useTransformer` selector 호출처 동시 grep. 발견 시 caller 부터 제거 후 type / store 제거                                                                                                                                                                                                                                       |

잔존 HIGH 위험 0건.

## Gates

| Gate         |                    시점                     | 통과 조건                                                                                                                                                                                                                                                                                                                                                                                                                                           | 실패 시 대안                                                                                     |
| :----------- | :-----------------------------------------: | :-------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | :----------------------------------------------------------------------------------------------- |
| G1 (Phase 1) |        useAsyncList 단일화 land 직후        | `grep apiEndpointData packages/shared apps/builder` = 0건 + useEffect 안 fetch 호출 0건 + useAsyncList load callback 안 api 분기가 `executeApiEndpoint` → `targetDataTable.runtimeData` read                                                                                                                                                                                                                                                        | useAsyncList 안 load 안에서 dataTables selector 접근 패턴 검증, 실패 시 list.reload trigger 패턴 |
| G2 (Phase 2) |     Legacy collection 사용 빈도 측정 후     | `type:"collection"` AND `source:"api"` 사용 element grep = 0 또는 < 5건 → 흐름 유지 결정 lock-in                                                                                                                                                                                                                                                                                                                                                    | ephemeral data_tables sink 또는 별 ADR fork (Phase 0 inventory 결과 기반)                        |
| G3 (Phase 3) |         Canvas 분기 통합 land 직후          | Canvas / Builder 양쪽 `executeApiEndpoint` 거친 후 data_tables.runtimeData read 정합                                                                                                                                                                                                                                                                                                                                                                | Canvas 분기 잔존 lock-in (DI 미주입 시)                                                          |
| G4 (Phase 4) | cache + dataTables subscribe 정합 land 직후 | dataTables.runtimeData 변경 시 useCollectionData hook list 가 reload 되거나 cache invalidate 됨 (실 동작 smoke)                                                                                                                                                                                                                                                                                                                                     | cache key 에 dataTables version 포함                                                             |
| G5 (Phase 5) |           Status Implemented 직전           | 모든 G1-G4 + G6 통과 + type-check 3/3 + vitest PASS + Chrome MCP smoke 5 컴포넌트 PASS                                                                                                                                                                                                                                                                                                                                                              | 미해결 Gate 실패 시 Phase 별 rollback                                                            |
| G6 (Phase 5) |           rename sweep land 직후            | **6-way grep gate**: (1) `\bdata_tables\b` = 0 / (2) `\bdataTables\b` = 0 / (3) `\btargetDataTable\b` = 0 / (4) `\b(DataTablesMap\|DataTableState\|DataTableConfig\|DataTableData\|DataTableRow)\b` = 0 / (5) `"dataTables"` literal = 0 / (6) `\bDataTable\b` = UI surface allowlist hit만 (Component / Editor / Action editor / 파일명 / 디렉토리)                                                                                                | rename 누락 site 보강 후 재검증                                                                  |
| G7 (Phase 7) |      Transformer 제거 sweep land 직후       | **5-way grep gate**: (1) `\bTransformer\b` = 0 / (2) `\btransformers\b` = 0 (object store name literal 포함) / (3) `\bTransformLevel\|TransformContext\|FieldMapping\|ResponseMappingConfig\|JsTransformerConfig\|CustomFunctionConfig\b` = 0 / (4) `executeTransformer\|fetchTransformers\|createTransformer\|updateTransformer\|deleteTransformer` = 0 / (5) `apps/builder/src/builder/panels/datatable/components/TransformerList.tsx` 파일 부재 | 누락 site 보강 후 재검증. type-check 3/3 + vitest PASS                                           |

## Consequences

### Positive

- `useCollectionData` 단일 hook 안 source 별 분기가 `useAsyncList.load` 한 곳으로 수렴 → 추적 / 신규 source 추가 비용 ↓
- `collections.runtimeData` 단일 sink → 같은 endpoint 의 다중 element 참조 시 중복 호출 LRU + Zustand subscribe 두 layer 로 자연 차단
- 사용자 framing ("RAC/RSC read 진입점은 collections 통일") 정합 → ADR-131 Phase 8 revert framing 의 후속 약속 land
- RSP `useAsyncList` 정통 패턴 정합 → 향후 RAC/RSC 버전 upgrade 시 정합 비용 ↓
- **rename 으로 RSP Dynamic Collections 용어 1:1 정합** — 신규 contributor 가 RSP 문서를 그대로 매핑 가능. 향후 ADR 들이 `collections` 단일 어휘로 작성 가능
- **Transformer 제거로 dead infrastructure 정리** — 외부 caller 0건이던 3-Level 변환 시스템 (~700 LOC type+store+DB+UI) 전수 제거. `Element.dataBinding.source` enum / `events / actions` 흐름 단순화 시 신규 contributor 가 Transformer 존재 인지 비용 없음. ApiEndpoint 의 `responseMapping` 필드가 Level 1 (노코드 mapping) 기능 흡수 — 기능 손실 없음

### Negative

- 기존 `apiEndpointData` 의존 caller 가 있을 경우 surface 변경 (Phase 0 inventory 측정)
- useAsyncList load callback 안 collections selector closure 패턴이 fragile 한 경우 list.reload trigger useEffect 추가 (1-2 line cost)
- Canvas 측 `executeApiEndpoint` DI 미주입 시 Phase 3 분기 잔존 가능성 (Phase 0 inventory 후 결정)
- Legacy collection 사용 element 가 예상보다 많을 경우 별 ADR fork 의무 (consolidation-burden 차단 카테고리 적용)
- **rename 으로 50+ 파일 mechanical 변경** — Phase 5 sweep 시 단일 commit 으로 land (Builder + Publish + Preview + Shared 동시). 한쪽만 land 시 iframe postMessage silent fail (R8 대응)
- **IndexedDB `data_tables` store drop** — 개발 환경에서 본인 in-progress 데이터 손실. DB_VERSION bump 시 자동 drop, 사용자 본인 dev DB export 권고 (R9 대응)
- **Transformer 탭 / API 사라짐** — DataTable Panel 의 "Transformers" 탭 + `useDataStore.transformers` Map state + 5 actions (`fetchTransformers / createTransformer / updateTransformer / deleteTransformer / executeTransformer`) 즉시 사라짐. UI 사용 흔적 (Panel 탭 + Workflow icon) 사용자 노출 영역에서 제거 — 사용자 explicit confirm 2026-05-13. 향후 변환 로직 필요 시 ApiEndpoint `responseMapping` (Level 1) / Actions 시스템 / 별 ADR 발의로 재도입
- **scope 경계 (별 ADR 분리 영역)**: AI tool `createElement` 의 `element.dataBinding.config` 직접 endpoint 박는 패턴 정정 (W3) / `apps/publish` 의 `ProjectData` 직렬화 정합 (W4) / DataPanel UI 정적 입력 + API 결과 표시 UX / `Element.dataBinding.source` enum 정합 (`static/api/supabase/state/parent` 5종 valid 재평가) — 본 ADR scope 밖, 후속 ADR 발의 필요. 상세: [design breakdown §7 scope 경계 명시](design/132-usecollectiondata-useasynclist-alignment-breakdown.md#7-scope-경계-명시)
