# ADR-152 구현 상세 — Data 패널 ↔ Collections ↔ 컴포넌트 Collection 바인딩 통합

> 본 문서는 [ADR-152](../152-data-panel-collection-binding-integration.md)의 구현 상세(Phase, 파일 변경표, 체크리스트)를 담는다. 결정/위험/게이트는 ADR 본문이 정본.

## 1. 현행 실측 인벤토리 (2026-07-16 기준)

### 1-1. 데이터 흐름 지도

```
[Data 패널]                          [Inspector]                     [렌더러 2계]
panels/datatable/                    PropertyDataBinding.tsx          Builder Skia:
  DataTablePanel / DataTableEditor     (source/name/path 편집)          BuilderCanvas.tsx:197-205
  ColumnSelector (API 컬럼 import)          ↓ element.props.dataBinding      → buildCanonicalSceneModel({collections})
      ↓ CRUD                         CatalogInspectorFields.tsx:185       → getFlatProjectionRows / getTableProjectionRows
useDataStore (stores/data.ts)          (field.key === "dataBinding")   Preview DOM (iframe):
  collections: Map<string, DataTable>                                   messageHandler.ts:451 setCollections
  SSOT = Supabase data_tables                                            → runtimeStore.collections
  (persist 미들웨어 없음)                                                → useCollectionData → RAC wrapper
```

### 1-2. 확인된 격차 6개

| #     | 격차                       | 실측 근거                                                                                                                                                                                                                                                                                  |
| ----- | -------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| 격차1 | **name 기반 바인딩 참조**  | `useCollectionData.ts:298` `collections.find((dt) => dt.name === propertyBinding.name)` — DataTable rename 시 바인딩 silent 파손. `PropertyDataBinding` 타입에 id 필드 없음 (`collection.types.ts:207-220`)                                                                                |
| 격차2 | **읽기 경로 3중화**        | `useCollectionData.ts:202-208` — ① `dataBinding`(PropertyDataBinding) ② `datatableId`(`stores/datatable.ts` legacy `useDataTableStore`) ③ legacy `DataBinding type:"collection"`(static/api/supabase, `:392-407`)                                                                          |
| 격차3 | **column mapping 부재**    | item label 이 하드코딩 필드 휴리스틱: `packages/shared/src/collections/resolveCollectionItems.ts:169-176` (`label > textValue > children > name > title > value`). schema 기반 사용자 매핑 UI 없음 — `path` free-text 만 존재                                                              |
| 격차4 | **publish 소비 0건**       | `apps/publish/src` 에 `collections`/`useCollectionData` grep 0건 — 배포 앱에서 바인딩된 collection 이 데이터를 렌더하지 못함 (ADR-132 §scope 경계 W4 후속 지정 영역)                                                                                                                       |
| 격차5 | **store 이중화**           | `stores/data.ts`(useDataStore, Supabase SSOT) ↔ `stores/datatable.ts`(useDataTableStore — consumers/transform/status 별도 상태 기계) 공존. 격차2 ② 경로의 원천                                                                                                                             |
| 격차6 | **binding 이중 저장 위치** | `getElementDataBinding` 이 `props.dataBinding` 우선 + legacy top-level `element.dataBinding` fallback (`compositionExtensionFields.ts:74-94`). scene projection signature 는 `props` 만 포함 (`buildSceneSnapshot.ts:49-66`) → top-level 만 가진 요소는 binding 변경이 sceneVersion 미감지 |

### 1-3. dataBinding 을 노출하는 catalog binding (10종)

`packages/shared/src/catalog/bindings/` — Breadcrumbs / ComboBox / GridList / ListBox / Menu / Select / Table / Tabs / TagGroup / Tree (`dataBinding: { kind: "binding", label: "Data", section: "content" }` 필드 보유 실측 10 파일). TableCell 은 주석 언급만 — 부모 Table 이 self-compose 하므로 독립 binding 필드 없음.

### 1-4. 재사용 가능한 기존 자산

- `resolveCollectionItems` 단일 계약 (`packages/shared/src/collections/resolveCollectionItems.ts`) — Skia projector 전체 + **DOM wrapper 7/10**(GridList/ListBox/ComboBox/Breadcrumbs/TagGroup/Menu/Select)이 소비 (ADR-912 영역 B hoist). fieldMap 주입 지점으로 최적. **Table/Tree/Tabs DOM wrapper 는 useCollectionData raw 소비**(`Table.tsx:206`/`Tree.tsx:93`/`Tabs.tsx:124`) — Phase 3/4 정렬 대상.
- `ColumnSelector` (`panels/datatable/components/ColumnSelector.tsx`) — **API 응답 감지 컬럼 import UI**(`DetectedColumn[]` 체크박스 + Import 버튼)라 목적 상이, 직접 재사용 대상 아님 (참고 패턴만). fieldMap UI 는 `PropertyDataBinding` 기존 Select 패턴 위에 신규 구성.
- `getElementDataBinding` (`apps/builder/src/adapters/canonical/compositionExtensionFields.ts`) — canonical node → dataBinding 단일 추출점.
- ListBox 등의 data-bound authoring mode + template anchor (`layers/listBoxRowProjection.ts`) — item 템플릿 구조 기존재.

### 1-5. 재측정 정정 (2026-09-11 — 착수 금지 해제 + scope 확장)

| 항목                           | 실측 (경로:라인)                                                                                                                                                                                | 영향                                                                          |
| ------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------- |
| collection DI provider         | `apps/builder/src/preview/App.tsx:1412` · `apps/publish/src/App.tsx:1` — `CollectionDataProvider` + `createCollectionSnapshotServices` (ADR-209)                                                | Phase 3 선행 항목 2개 **삭제** · Phase 6 provider 항목 삭제 (snapshot 형식만) |
| name resolve                   | `packages/shared/src/hooks/useCollectionData.tsx:306` (dataTable) · `:324,338` (api)                                                                                                            | Phase 1 원안 유지                                                             |
| `DataField`                    | `apps/builder/src/types/builder/data.types.ts:31` — `{ key, type, label?, required?, defaultValue?, children? }` id 없음                                                                        | **Phase 1 에 `id` 추가** (§2-1)                                               |
| `{field}` 템플릿 저장형        | `packages/shared/src/collections/fieldTemplate.ts` (ADR-159) — 이름 문자열 파싱                                                                                                                 | 저장형 변환기 (§2-2)                                                          |
| `ApiEndpoint.targetCollection` | `data.types.ts` 이름 문자열 · sink `stores/utils/dataActions.ts` 실행기                                                                                                                         | `targetCollectionId` additive                                                 |
| History                        | `builder/stores/history.ts:108` `HistoryEntry { type: 13종, elementId 필수 }` · `useDataStore` 참조 0                                                                                           | **Phase 1c** `type:"data"` entry (§2-3)                                       |
| legacy store 소비처            | `stores/datatable.ts` · `components/data/DataTable.tsx:47-50` · `main/BuilderCore.tsx:883,1007,1085`                                                                                            | Phase 5 소비처 3 파일 대체                                                    |
| React Query 병행               | `hooks/useDataQueries.ts` (`useDataPanelQuery`) · `panels/datatable/DataTablePanel.tsx` (store fetch 3종과 동시 호출)                                                                           | Phase 5 에 포함                                                               |
| Track 0 선수리                 | `66f9cb28b` — 기본 dataPath 빈 값 + 응답 배열 자동 감지 (`utils/data/responseData.ts`) · key rename 시 행 migrate (`utils/data/schemaMigration.ts`) · 편집기 폭 560 · prompt/confirm/alert 제거 | rename 행 migrate 는 적용기의 한 op 로 흡수                                   |

**Fork 4 질문 lock-in (사용자 confirm 2026-09-11 — 리서치 §5 판정 ①·③)**: ① 본 ADR = **base** (참조 계약 + 적용기), ADR-212 (편집기 UI) · 213 (tool 계약) · 214 (Variables) = 응용. ② schema 직교 — 본 ADR 은 `PropertyDataBinding` · `DataField` · `DataChange`, 응용은 이를 소비만. ③ 의존 방향: 152 → 212/213, 214 는 canonical 문서 (요소 소유 변수) 축이라 152 와 직교, `Data` 패널 표면만 212 와 공유. ④ codex 1차 진입 전 본 lock-in 완료.

### 1-6. Phase 0 Inventory freeze (2026-09-11 실측 — G0 판정)

**저장 문서 실사용 (로컬 IndexedDB `composition`, Chrome MCP 로 `document_parts` 121 node · `documents_backup` 10 · `collections` 1 전수 스캔)**:

| 항목                                           | 건수  | 근거                                                                                                   |
| ---------------------------------------------- | :---: | ------------------------------------------------------------------------------------------------------ |
| ① `props.datatableId` 보유 element             | **0** | 프로젝트 2 (`2bb0f2f4…` RRR · `5a82d62a…`) node 121 전수                                               |
| ② `dataBinding.type === "collection"` element  | **0** | 동상                                                                                                   |
| ③ legacy top-level `element.dataBinding`       | **0** | 동상 (`x-composition*` 확장 안의 dataBinding 도 0)                                                     |
| `props.dataBinding` (PropertyDataBinding) 보유 | **0** | 동상 — backup 10 건에도 `dataBinding` 문자열 0                                                         |
| collection 정의                                | **1** | `Users` (schema 10 필드 · mockData 11 · runtimeData 0) — `DataField.id` **없음** (write-back 대상 1건) |
| Chart 노드 3                                   |   —   | 전부 인라인 `data` (static) + `dimension/metric` 이름 참조 — collection 바인딩 없음                    |

→ **G0 = 0건 → Phase 5 흡수 진행** (마이그레이션 단계 불요). 2026-08-17 실측의 프로젝트 `148ccd1e…` (바인딩 8건) 은 로컬 DB 에 더 이상 없다 — G1 live 는 Phase 1 에서 name 기반 바인딩을 **새로 만들어** (구 형식 fixture) 검증한다.

**`PropertyDataBinding` 소비처 (grep `asPropertyBinding|getElementDataBinding|propertyBinding.name|PropertyDataBinding`, test 제외 — 파일 43)**: resolve 지점은 `packages/shared/src/hooks/useCollectionData.tsx:306` (dataTable — `dt.name === propertyBinding.name || dt.id === propertyBinding.name`) · `:324,338` (api — name 만) **2곳뿐**. 나머지는 타입 import · prop 전달 (`SelectionRenderers.tsx` 19 · `useIframeMessenger.ts` 15 · `canvasSceneNode.ts` 8 · `CollectionRenderers.tsx` 7 · `LayoutRenderers.tsx` 7 · `TableRenderer.tsx` 5 · `PropertyDataBinding.tsx` 5 …). legacy `type:"collection"` 판독 잔존: `TableRenderer.tsx:110-255` (6) · `ListBox/ComboBox/GridList/Table/Tabs/TagGroup.tsx` 의 이중 형식 허용 분기 · `useOwnerCollectionColumns.ts:67` · `chartPresentationPatch.ts:66` · AI tool `bindCollection.ts:104` (legacy 형식으로 **쓴다** — Phase 5 정렬 대상).

**`useDataStore.collections` name 키 소비처 (R11 전수)**:

| 위치                                                                     | 연산                                                           | Phase 1 처리                                   |
| ------------------------------------------------------------------------ | -------------------------------------------------------------- | ---------------------------------------------- |
| `stores/utils/dataActions.ts:105`                                        | `dataTablesMap.set(dt.name, dt)` (fetch)                       | id 키                                          |
| `:156`                                                                   | `newMap.set(newDataTable.name, …)` (create)                    | id 키                                          |
| `:198-223`                                                               | update — `forEach` 로 name 키 찾기 + rename 시 re-key          | id 키 `set(id)` — re-key 삭제                  |
| `:264-273`                                                               | delete — `forEach` 로 id 매치 후 `delete(key)`                 | `delete(id)`                                   |
| `:295, :317`                                                             | `collections.get(name)` (loadDataTable · setRuntimeData)       | `resolveBoundCollection` 경유                  |
| `:325`                                                                   | `newMap.set(name, …)` (setRuntimeData)                         | id 키                                          |
| `:654`                                                                   | `collections.get(endpoint.targetCollection)` (실행기 sink)     | `targetCollectionId` 우선 + 이름 fallback      |
| `stores/data.ts:315`                                                     | `useCollection(name)` 공개 hook — **호출자 0**                 | `useCollectionById` 신설 + name wrapper 유지   |
| `utils/importCollectionEnvelope.ts:10`                                   | `store.collections.get(source.name)`                           | name resolve 헬퍼 경유 (envelope 은 name 정본) |
| `panels/datatable/DataTableList.tsx:52` · `DataTableEditorPanel.tsx:134` | `Array.from(dataTablesMap.values())`                           | 무변경 (키 무관)                               |
| `stores/utils/dataActions.ts:49`                                         | `syncCollectionsToCanvas(Map)` → `Array.from(values())`        | 무변경                                         |
| `stores/datatable.ts:340,366,482,615`                                    | legacy store 자체 Map (`get(dataTableId)` — 이미 id 키)        | Phase 5 제거                                   |
| `hooks/useDataQueries.ts:343`                                            | `db.collections.delete(tableId)` (IndexedDB adapter, Map 아님) | 무변경                                         |

**10 binding 컴포넌트 items 소비 방식**:

| 경로                                                    | 컴포넌트                                                                   | fieldMap 주입 지점 (Phase 3/4)                  |
| ------------------------------------------------------- | -------------------------------------------------------------------------- | ----------------------------------------------- |
| `useResolvedCollectionItems` → `resolveCollectionItems` | Breadcrumbs · ComboBox · GridList · ListBox · Menu · Select · TagGroup (7) | shared 함수 내부 1곳                            |
| `useCollectionData` raw                                 | Table (`Table.tsx`) · Tabs (`Tabs.tsx`) · Tree (`Tree.tsx`) (3)            | Phase 3 (Table) · Phase 4 (Tabs/Tree) 정렬 대상 |

**publish 직렬화 현황**: `BuilderCore.tsx:1153-1158` (preview 탭) · `:1185-1190` (`downloadProjectAsJson` export) 둘 다 `collections: Array.from(useDataStore.collections.values())` **전체 객체** (schema · mockData · **runtimeData 포함**) + `apiEndpoints` (`toRuntimeApiEndpoint`). publish 는 `apps/publish/src/App.tsx:47,317,394` `ProjectData.collections: DataTableDefinition[]` 로 받아 `createCollectionSnapshotServices` (`packages/shared/src/collections/collectionSnapshot.ts`) 에 넘긴다 — Phase 6 잔여 = runtimeData 제외 + `fieldId` 통과 확인 2건.

**기타 확정 사실**: `DataField` (`apps/builder/src/types/builder/data.types.ts:31`) 에 `id` 없음 · `ApiEndpoint.targetCollection?: string` (`:212,238`) 이름 참조 · `HistoryEntry.type` 12종 (`history.ts:109-121`, "13종" 은 stale — 실측 12) · `useCollection(name)` 호출자 0.

## 2. Binding 계약 v2 (Phase 1 산출물)

```ts
// packages/shared/src/types/collection.types.ts — 확장 (BREAKING 아님, additive)
export interface PropertyDataBinding {
  source: "dataTable" | "api" | "variable" | "route";
  /** v2: 안정 참조 — DataTable.id / ApiEndpoint.id */
  collectionId?: string;
  /** v1 잔존 — collectionId 부재 시에만 fallback resolve. 저장 시 v2 로 upgrade */
  name: string;
  /** v2: 역할별 컬럼 매핑 — 미지정 시 기존 휴리스틱 fallback.
   *  개정 2026-07-21 (ADR-159 경계 재획정): label/description 텍스트 표시는
   *  ADR-159 {field} 템플릿이 정본 — 신규 오소링 UI 는 아래 두 텍스트 필드를
   *  노출하지 않는다 (legacy 판독 호환만). fieldMap 은 비텍스트 역할 한정. */
  fieldMap?: {
    label?: string; // (159 이관 — legacy 판독만, 신규 오소링 미노출)
    value?: string; // item value/key 컬럼
    description?: string; // (159 이관 — legacy 판독만, 신규 오소링 미노출)
    icon?: string; // 아이콘 컬럼
  };
  path?: string; // 고급 (free-text) — 유지
  defaultValue?: unknown;
  refreshMode?: RefreshMode;
  refreshInterval?: number;
}
```

resolve 규칙 (단일 헬퍼 `resolveBoundCollection(binding, collections)` 신설, shared):

1. `collectionId` 매치 우선
2. 실패 시 `name` 매치 (v1 fallback)
3. 둘 다 실패 → null (기존 "DataTable을 찾을 수 없습니다" 경로 유지)

저장 시점 upgrade: Inspector 에서 binding 편집 commit 시 `collectionId` 를 항상 채움 — 기존 프로젝트는 로드만으로 재직렬화 0건 (lazy).

### 2-1. `DataField.id` (v2.1, 2026-09-11)

```ts
// apps/builder/src/types/builder/data.types.ts — additive
export interface DataField {
  /** v2.1: 안정 참조 — store 진입 경계 정규화 함수 `normalizeCollection` 이 부여 (7 경로 전부), id 없던 collection 은 hydrate 직후 1회 write-back (round 3 정정) */
  id?: string;
  key: string; // 행 key · 표시 이름 (rename 은 key 만 바꾼다)
  // … 기존 필드
}
// fieldMap 값 · 차트 시리즈 필드 · targetCollection 은 id 를 담는다:
fieldMap?: { value?: string /* fieldId */; icon?: string /* fieldId */ };
// ApiEndpoint
targetCollectionId?: string; // v2.1 — targetCollection(이름) 은 read fallback
```

resolve: `resolveField(schema, ref)` — `id` 매치 → `key` 매치 (v1 fallback) → null. **직접 `schema.find(f => f.key === …)` 패턴은 grep 가드** (Phase 1 정적 가드에 추가).

**부여 · 영속 규칙 (round 3 정정 — 사용자 선택 (a))**: `normalizeCollection(dt)` 하나가 `dataActions.ts` 의 collections set 6곳 (`:109 fetch · :158 create · :223 update · :273 delete · :327 setRuntimeData · :661 실행기 sink`) 과 `importCollectionEnvelope.ts:9` 를 지난다. `fetchCollections` 직후 id 가 새로 부여된 collection 목록을 모아 `db.collections.update` 1회 (프로젝트당 1회, 이후 0). preview snapshot · export envelope 은 store 의 정규화된 schema 만 받는다. 템플릿 저장형 변환기는 id 없는 필드를 만나면 이름 저장형으로 두지 않고 정규화 누락으로 **throw** (개발 중 검출).

**Map 재키잉 (round 3 추가)**: `useDataStore.collections` 는 name 키 (`dataActions.ts:105`) → Phase 1 에서 **id 키** 로. `useCollection(name)` (`data.ts:315`) 은 `useCollectionById(id)` 신설 + 기존 시그니처는 name fallback wrapper 로 유지. `.get(name)` 소비처 (`dataActions.ts:295,317,654,657` · `importCollectionEnvelope.ts:10`) 는 `resolveBoundCollection` 경유. rename re-key (`:200-215`) 삭제.

### 2-2. `{field}` 템플릿 저장형 (v2.1)

사용자 문법은 ADR-159 그대로 `{name}` · `{name.first}` — 편집기가 보여주는 것도 이름. 저장형만 `{#<fieldId>}` (ADR-159 파서에 `#` prefix 분기 1개). 변환기 `templateToStored(template, schema)` / `storedToTemplate(stored, schema)` 는 `packages/shared/src/collections/fieldTemplate.ts` 옆 1개 모듈. 렌더 경로 (`resolveFieldTemplate`) 는 저장형을 받아 id 로 행을 읽는다 — rename 시 렌더가 바뀔 것이 없다. id 가 없는 필드 (구 문서) 는 이름 그대로 통과.

### 2-3. `DataChange` 적용기 (v2.1)

```ts
// packages/shared/src/schemas/dataChange.ts (ADR-213 tool input_schema · export envelope 검증과 같은 스키마)
type DataOp =
  | { op: "create_collection"; name; schema: DataField[]; rows?; source? }
  | { op: "add_field"; collectionId; field: DataField; index? }
  | { op: "update_field"; collectionId; fieldId; patch: Partial<DataField> } // key 변경 = rename
  | { op: "remove_field"; collectionId; fieldId } // 사람 UI 전용 (213 tool 은 노출 안 함)
  | { op: "set_cell"; collectionId; rowIndex; fieldId; value }
  | { op: "insert_rows"; collectionId; rows; at? }
  | { op: "remove_rows"; collectionId; rowIndexes }
  | { op: "replace_rows"; collectionId; rows } // CSV replace
  | { op: "set_source"; collectionId; source: "manual" | "api"; endpointId? }
  | { op: "define_endpoint"; endpoint: ApiEndpointDraft }
  | { op: "bind_element"; elementId; collectionId; fieldMap? };
interface DataChange {
  ops: DataOp[];
  origin: "user" | "import" | "ai" | "agent";
  label?: string;
}
```

적용기 `applyDataChange(change)` (`apps/builder/src/builder/stores/utils/dataChange.ts`) 순서: (a) 스키마 검증 (zod, 같은 스키마) → (b) 파급 — `update_field.key` 는 `renameRowsKey` 로 행 migrate (Track 0 자산), 참조는 id 라 무변경; `remove_field` 는 사용처 수 반환 (UI 가 확인) → (c) `HistoryEntry { type: "data", elementId: collectionId, data: { dataChange, inverse } }` 1개 → (d) `useDataStore` 갱신 + IndexedDB → (e) `syncCollectionsToCanvas`. undo = `inverse` ops 를 origin `"user"` 로 재적용 (History 기록 없이).

기존 액션 (`updateCollection` · `createDataTable` · `deleteDataTable` · `createApiEndpoint` …) 은 적용기의 얇은 wrapper 로 남긴다 — 호출부 변경 0.

## 3. Phase 계획

### Phase 0 — Inventory freeze (착수 게이트 G0)

> **Implemented 2026-09-11** — 결과 §1-6. G0 = 0건 (Phase 5 흡수).

- [x] legacy 경로 실사용 실측: ① `datatableId` 0 ② `dataBinding.type === "collection"` 0 ③ legacy top-level `element.dataBinding` 0 (§1-6)
- [x] `PropertyDataBinding` 소비처 전수 grep — resolve 지점 2곳 (`useCollectionData.tsx:306,324/338`)
- [x] `apps/publish` 의 ProjectData 직렬화 현황 — collections 전체 객체 (runtimeData 포함) + apiEndpoints
- [x] (round 3) `useDataStore.collections` name 키 소비처 전수 표 (R11) — §1-6
- [x] 10 binding 컴포넌트별 items 소비 방식 표 — 7 (`useResolvedCollectionItems`) / 3 raw (Table/Tabs/Tree)

### Phase 1 — Binding 계약 v2 + resolve 단일화

> **Implemented 2026-09-11** — commit (본 phase). live: `apps/builder/scripts/adr152-p1-live.mjs` 10/10 PASS (headed Playwright, 실제 빌더) + DOM leg `collectionRuntime/collectionApi.browser.test.tsx` 6/6 (browser vitest). 실측 정정 2건은 아래 각 항목에.

- [x] `collection.types.ts` PropertyDataBinding 확장 (additive — `collectionId?` · `fieldMap?`) + `SchemaField.id?`
- [x] `resolveBoundCollection` / `resolveCollectionByName` / `resolveStoreCollection` / `resolveField` 헬퍼 신설 (`packages/shared/src/collections/resolveBoundCollection.ts`, 단위 테스트 11)
- [x] `useCollectionData.tsx` dataTable (`:306`) + api (`:324,338`) 3곳 헬퍼 경유
- [x] Skia 측 — `readDataBindingRows` (shared, Skia projector · DOM wrapper 공통 primitive) 헬퍼 경유 → 호출부 변경 0. Properties 패널 `chartPresentationPatch.ts` · `useOwnerCollectionColumns.ts` (`collectionsByName` Map 인자 → `readonly DataTable[]`) · `chartFieldOptions.ts` 도 헬퍼 경유
- [x] Inspector commit 시 `collectionId` upgrade — `PropertyDataBinding.tsx` 옵션 키 = collection id · 저장 `{ collectionId, name }` · 표시는 `resolveBoundCollection` (v1 바인딩도 선택 상태 표시). **실측**: 같은 옵션 재선택은 RAC Select 가 change 를 내지 않아 upgrade 가 일어나지 않는다 — 로드/열람만으로 재직렬화 0 (HC4) 과 정합, upgrade 지점은 실제 편집 commit
- [x] binding write 저장 위치 — **실측 결과 이미 단일**: Inspector 쓰기는 `GenericFieldRenderer` / `CatalogInspectorFields` 의 `update(v)` → `props.dataBinding` 뿐. legacy top-level writer `updateSelectedDataBinding` (`inspectorActions.ts:1316`) 은 호출자 0 (`useUpdateDataBinding` 소비처 0) — 삭제는 원본 삭제 승인 규칙에 따라 Phase 5 에서 별도 확인. AI tool `bindCollection.ts:104` 는 extension (`x-composition.dataBinding`, legacy `type:"collection"`) 에 쓴다 — Phase 5 정렬 대상 (§1-6)
- [x] (v2.1) `DataField.id` additive + `normalizeCollection` (`apps/builder/src/utils/data/normalizeCollection.ts`) — store 진입 경로: fetch (`normalizeCollectionMap`) · create · update (`updates.schema` 정규화 후 DB write) · import envelope (create/update 경유) · delete / setRuntimeData / 실행기 sink 는 schema 무변경이라 정규화 대상 없음. hydrate 직후 `writeBackAssignedFieldIds` 1회 — test: 부여된 것만 write 1 · 두 번째 로드 write 0 · **write-back 실패 주입 → throw 0** (round 4 hate first_nail). live: 3 필드 id 부여 + `updated_at` 무변경 재로드 확인
- [x] (round 3) collections Map **id 키** 재키잉 (fetch/create/update/delete/setRuntimeData/sink 6곳) + `useCollectionById` 신설 + `useCollection(name)` 은 name fallback wrapper 유지 (호출자 0) + `collections.get(` 직접 호출 grep 가드 (`collectionResolve.static.test.ts` ②, legacy `stores/datatable.ts` 는 Phase 5 까지 제외)
- [x] (v2.1) `resolveField` 헬퍼 + `schema.find(key ===)` 직접 패턴 grep 가드 (③)
- [x] (v2.1) `ApiEndpoint.targetCollectionId` additive — 실행기 sink id 우선 · 이름 fallback (test 2) · `ApiEndpointEditor` Target DataTable 입력 시 이름 → id 같이 기록 · `DataTableList.getLinkedApi` id 우선
- [x] 정적 가드: 바인딩 `name` 으로 collection find 하는 직접 패턴 0건 (①)

**G1 live (2026-09-11, headed Playwright `adr152-p1-live.mjs`, 새 프로젝트 · IndexedDB 에 id 없는 collection 2건 저장 형태로 시드)**: ① write-back 3/3 · ② 재로드 write 0 · ③ v1 (`{source:"dataTable", name:"Users"}`) ListBox → Skia `projection:listbox-row` 5 · ④ Inspector Roles 선택 → `{collectionId, name:"Roles"}` + 행 2 · ⑤ Users 복귀 → collectionId 갱신 · ⑥ v1 바인딩도 Inspector 선택 표시 "Users" · ⑦ IndexedDB rename Users → People + 재로드 → v2 행 5 유지 (rename-safe) · ⑧ Inspector 표시 "People" · ⑨ page error 0.

### Phase 1b — `{field}` 템플릿 저장형 + 차트 시리즈 fieldId (게이트 G4)

> **Implemented 2026-09-11** — live: `apps/builder/scripts/adr152-p1b-live.mjs` 14/14 PASS (headed Playwright, 실제 빌더 + Preview iframe compare 모드). 설계 정정 1건 (아래 색인 방식) · 범위 밖 발견 1건 (publish leg).

- [x] `fieldTemplate.ts` 파서 `{#<id>[.path][|fmt]}` 분기 (`fieldId` part) + `templateToStored` / `storedToTemplate` (`fieldTemplateStorage.ts`) — 첫 세그먼트만 치환, 경로·포맷·literal·`{{` 보존. schema 밖 key (가상 필드 label/description/icon/value · 정적 items) 는 이름 그대로. **정정**: key 는 있는데 id 가 없으면 throw 대신 이름 유지 + `console.warn` — 편집 UI 를 세우지 않고 정규화 누락은 store 진입 경계 test (Phase 1) 가 지킨다
- [x] **id → key 색인 (`packages/specs/src/data/fieldIdIndex.ts`) — 설계 정정**: 렌더 소비처 (Skia projection · DOM wrapper · 차트 기하 — compile 7곳 · `readField` 1곳) 는 schema 를 들고 있지 않으므로, collection 이 렌더용으로 resolve 되는 두 지점 (`readDataBindingRows` · `useCollectionData.dataTableResult`) 이 schema 를 등록하고 보간·차트 read 는 색인만 본다 → **소비처 호출부 변경 0**. id 는 UUID 라 평면 Map 으로 충분, rename 은 같은 등록 지점을 다시 지나 갱신. specs 에 두는 이유: shared → specs 의존 방향 (차트 `readField` 가 specs 안). 미등록 id 는 빈 문자열 / undefined (throw 0)
- [x] `PropertyFieldTemplateInput` — `fields` (key + id, `useOwnerCollectionFields` 신설 · `resolveOwnerCollectionFields` 순수 함수) 를 받아 표시는 `storedToTemplate`, commit 은 `templateToStored`. `GenericFieldRenderer` · `CatalogInspectorFields` 양쪽 mount. 사용자는 id 를 보지 않는다 (live: 편집기 `{name} <{email}>` ↔ 문서 `{#…} <{#…}>`)
- [x] `resolveFieldTemplate` 렌더 경로 — `interpolateFieldTemplate` 가 `fieldId` part 를 색인으로 읽음 (Skia projection · DOM wrapper 같은 함수, 호출부 변경 0)
- [x] ADR-210 차트 시리즈 — `packages/specs/src/chart/series.ts` `readField` (dimension/metric/color/valueFields 단일 접근점) 가 `#id` 를 색인으로 해석 · Properties `chartFieldOptions.ts` 는 collection 필드를 `#id` 값 · key 라벨로 (정적 items 출처는 key), 구 형식 현재 값은 같은 필드의 `#id` 항목으로 접음 (test `chartFieldOptions.fieldId.test.ts` · specs `adr152FieldIdRef.test.ts` — id 격자 == key 격자 · rename 유지 · 미등록 빈 범주)
- [x] G4 live (아래)

**G4 live (2026-09-11, `adr152-p1b-live.mjs`)**: 새 프로젝트 · IndexedDB 에 id 없는 Users (id/name/email/age, 3행) 시드 → 재로드 write-back 4/4 · 페이지 인스턴스 ListBox (ref) v2 바인딩 Skia 행 3 · Bar Chart `dimension/metric = #id` · 대조군 (key 참조 차트 Preview 렌더 · Preview 가 master slot `{label}!` 보간) · Components 페이지 seed label Text 를 Properties 에서 `{name} <{email}>` 로 편집 → 문서 `{#name} <{#email}>` · 편집기 이름 표시 · Preview DOM 행 `User 1 <u1@x.test>` · Preview 차트 범주 `User 1..3` · **템플릿만 저장 · collection 편집 0 · 재로드 → 저장형 유지** · IndexedDB 에서 `name → fullName` rename (행 migrate 포함, 저장 형태) + 재로드 → Skia 행 3 · 문서 저장형 불변 · 편집기 `{fullName} <{email}>` · Preview 행 · 차트 범주 값 유지 · 차트 props `#id` 불변 · page error 0 — 14/14. Skia 행 **텍스트**는 픽셀에서 못 읽는다 (memory `reference-skia-canvas-pixels-unreadable-in-page`) — Skia 는 행 수 + DOM 과 같은 shared 함수 (`interpolateFieldTemplate` 단위 테스트) 로 판정.

**범위 밖 발견 (기록만)**: publish 런타임 (`/publish/`, sessionStorage 전달) 은 ref ListBox 인스턴스의 master slot 템플릿을 **이름 문법 (`{label}!`) 에서도 보간하지 않는다** (행 텍스트 = 휴리스틱 label) — 1b 이전부터의 ADR-159/162 publish leg 잔여. Preview iframe 은 보간한다. Phase 6 (publish 연동) 에서 다룬다.

**dist 신선도 함정 (실측)**: `packages/specs/src` 변경 후 dist 를 다시 빌드하지 않으면 shared·앱은 옛 `readField` 를 읽는다 — 차트 `#id` 가 Preview 에서 "No data" 로 보였다 (unit test 는 source 를 읽어 PASS). `pnpm -F @composition/specs build` 후 재실행으로 해소.

### Phase 1c — `DataChange` 적용기 + History (게이트 G5)

> **Implemented 2026-09-11** — G5 14/14 (`apps/builder/scripts/adr152-p1c-live.mjs`, ADR 본문 §Live Exercise).

- [x] `packages/shared/src/schemas/dataChange.ts` — zod 정본 + `dataChangeJsonSchema({ excludeOps })` (`z.toJSONSchema`, 재귀 `children` 은 `$defs`). op 13종 = §2-3 의 11 + `delete_collection` · `update_collection` (deleteDataTable · rename 을 wrapper 로 올리려면 필요 — undo 가 **같은 id** 로 되살려야 바인딩 `collectionId` 가 산다). `HUMAN_ONLY_DATA_OPS` (`remove_field` · `remove_rows`) 를 ADR-213 이 뺀다. `DataFieldPatch` 의 `null` = 키 제거 (undo 를 직렬화 뒤에도 정확히 — `undefined` 는 JSON 에서 사라진다)
- [x] `apps/builder/src/builder/stores/utils/dataChange.ts` — `reduceDataOps` (순수, all-or-nothing, op 별 역연산 · 왕복 불변식 테스트) + `createApplyDataChangeAction` (순서: 검증·파급 → IndexedDB → 메모리 → History → Canvas; `record:false` = undo/redo 재적용). `update_field.key` 는 `renameRowsKey` 로 mockData · runtimeData 를 옮긴다. `add_field` 는 id 를 부여해 **applied op 에 싣는다** — redo 가 같은 id 를 만든다. `remove_field` 는 schema 만 (행 값 유지 — 편집기 기존 동작, inverse = `add_field {index}`), `remove_rows` inverse 는 오름차순 `insert_rows` N개
- [x] `HistoryEntry.type` `"data"` + `data.dataChangeEvent { change, inverse }` — `historyActions.ts` undo/redo/goToIndex early-branch (`applyDataHistoryEntry` → `useDataStore.applyDataChange(…, { record:false })`) · `syncDatabaseForEntries` skip · DEV guard 면제 · `isCanonicalHistoryEntry` 영속 · 패널 아이콘 `Database` · 라벨 (op 1개면 종류별 — rename 은 inverse 의 이전 key 로 `name → fullName`). R9: `historyActions.static.test.ts` 6곳 + `historyActions.data.test.ts` (`applyCanonicalHistoryEventsToActiveDocument` 미호출 · 4종 편집 ⌘Z×4/⌘⇧Z×4 · goToIndex)
- [x] `dataActions.ts` create/update/deleteCollection 이 적용기 wrapper — 호출부 변경 0. `updateCollection(id, partial)` 은 `dataChangeDiff.ts` `collectionUpdateToOps` 가 patch → op: schema 는 필드 id 대조 (id 없는 대상 = 새 필드 · 순서 변경은 remove+add 쌍) → 그 중간 상태에 대해 행 diff (같은 길이 + 1행 1키 → `set_cell` · 부분열 → `remove_rows` · 접두 → `insert_rows` · 그 밖 → `replace_rows`, 같은 값 재입력은 op 0). `runtimeData` 는 History 밖 (메모리 전용, rename 이면 적용기가 옮긴다)
- [x] G5 live 14/14 — 셀 · 행 삭제 · CSV · rename → History data 4 / element 0 → ⌘Z×4 원상 (IndexedDB + 편집기 DOM) → ⌘⇧Z×4 → ListBox 추가 섞어 ⌘Z×5 / ⌘⇧Z×5 각자
- 범위 밖 (기록): `define_endpoint` · `bind_element` · `set_source.endpointId` 는 스키마에만 있고 적용기는 검증 단계에서 거부 (`DataChangeError`, 아무것도 안 바꿈) — ADR-213 이 배선. `remove_field` 사용처 수 반환 (UI 확인) 은 ADR-212 편집기 몫. API endpoint · Variable 액션은 적용기 밖 (collection 축만). History 는 페이지 스택이라 data entry 도 현재 페이지에 실린다 — 데이터 패널 포커스 시 스택 라우팅은 ADR-212

### Phase 2 — Inspector column mapping UI

> 개정 2026-07-21 (ADR-159 경계 재획정): 텍스트 표시(label/description) 매핑 UI 는 ADR-159 오소링(slot Text ComboBox 피커+`{field}` 입력)으로 이관. 본 Phase 의 fieldMap UI 는 **비텍스트 역할(icon/value) 한정**. 또한 159 P4b(SOURCE_OPTIONS → dataTable 단일)가 선행하면 본 Phase 는 축소된 표면 위에서 진행.

> **Implemented 2026-09-11** — live 10/10 (`apps/builder/scripts/adr152-p2-live.mjs`, ADR 본문 §Live Exercise).

- [x] `PropertyDataBinding.tsx` — 선택 collection 에 id 있는 필드가 있을 때만 `FieldMapSelect` × 2 (value · icon) 노출 (`.binding-fieldmap-select[data-role]`, 옵션 = 자동 + schema 필드, 키 = **fieldId** · 표시 = key). 저장 `fieldMap.value/icon = fieldId`; v1 key 저장값은 `resolveField` 가 id 로 올려 표시 · 자동 선택은 키 제거 (fieldMap 이 비면 `undefined`). collection 변경 시 fieldMap 은 같은 collection 일 때만 유지 (Phase 1). i18n `propertiesPanel.fieldMap{Value,Icon,Auto}`
- [x] ~~`path` free-text 는 "고급" 접힘 영역으로 격하~~ → path · refreshMode 오소링은 2026-07-24 에 이미 제거됨 (read 호환만, `PropertyDataBinding.test.tsx` 계약) — "고급" 영역 신설 없음 (죽은 표면 부활 금지)
- [x] Data 패널 쪽 "이 테이블을 사용하는 요소" 역참조 표시는 **범위 외** — ADR-212 편집기 몫으로 기록

### Phase 3 — fieldMap 소비 + 대표 3종 live 검증

> **선행 조건 (2026-08-17 추가 — ADR 본문 격차 7 / R7)**: 아래 fieldMap 작업 **전에** collection DI provider 를 preview 에 마운트해야 한다. 현재 `CollectionDataProvider` 는 repo 어디에도 렌더되지 않아 `dataTableService` 가 항상 `undefined` 이고, 그 결과 `source:"dataTable"` 바인딩이 DOM 에서 **0행 + 영구 loading** 이다 (Skia 는 같은 바인딩을 100행으로 투영 — 실측 대조는 본문 §격차 7 실측 근거). 이 상태로 G2 `/cross-check` 를 돌리면 fieldMap 과 무관한 이유로 실패하므로 **fieldMap 을 고치는 오진**으로 이어진다.

> **Implemented 2026-09-11** (Table wrapper 정렬 1건 deferred — 아래) — G2 9/9 (`apps/builder/scripts/adr152-p3-live.mjs`, ADR 본문 §Live Exercise).

- [x] ~~**(선행)** preview 에 collection DI provider 마운트~~ → **ADR-209 로 완료 (2026-09-11 확인, `preview/App.tsx:1412`)**. 대칭 재확인: ListBox Skia 행 3 = DOM 3 · Table Skia data 행 3 = DOM `aria-rowcount` 3 (G2 하니스)
- [x] `resolveCollectionItems.ts` — `CollectionFieldRoles { value?; icon? }` (역할 → **행 key**) + `resolveFieldRoles(dataBinding, schema?)` (fieldId → key: schema 의 `resolveField`, 없으면 렌더 resolve 지점이 등록한 `fieldIdIndex`, 둘 다 miss 면 v1 key 로 간주). `getItemKey/Value/Icon/Avatar` · `toItemProjectionRow` 에 `roles?` 인자 — 지정 역할 컬럼 우선, 미지정은 기존 휴리스틱 (BC). value 역할 = itemKey (선택 키) + `{value}`, icon 역할 = glyph 면 icon slot · 이미지 참조면 avatar slot (한 값이 두 slot 에 안 잡힌다). label/description 은 인자 없음 (ADR-159 템플릿 정본)
- [x] 호출부 2 + DOM 보간 4 — Skia `getFlatProjectionRows` · `getTableProjectionRows` (binding + collections 에서 table schema 로 roles) · DOM `useResolvedCollectionItems` (`useCollectionData` 의 schema) · `interpolateCollectionRowTemplate(compiled, item, roles?)` 를 `SelectionRenderers` (ListBox 템플릿 행 · GridList 카드) · `ListBox.tsx` · `GridList.tsx` 가 호출 시점에 `resolveFieldRoles(dataBinding)` 로 (id 색인은 같은 wrapper 의 resolve 가 등록)
- [x] G2 live 9/9 — ListBox Skia 행 key (layout map `projection:listbox-row:<id>:<itemKey>`) = DOM `data-key` = uid 컬럼 · Select DOM option value · Table Skia 행 key · `{label} [{icon}] {value}` 템플릿이 DOM 행 `User 1 [star] U-1` · 이미지 컬럼 → `{icon}` 빈 문자열 · rename + 재로드 양 leg 유지 · 대조군 (fieldMap 없음) 양 leg `id` 컬럼. 팔레트 ListBox master 는 icon slot 을 구성하지 않아 아이콘 자체는 두 leg 다 안 그린다 — icon 역할 소비는 가상 필드로 잰다
- [x] Table 은 fieldMap 대신 columns 경로 — `readTableColumns(props.columns)` (TableHeader > Column) 가 컬럼 차원, value 역할은 rowKey 에만 적용. columns 없는 바인딩은 Skia 가 빈 셀 행 · DOM 이 데이터에서 컬럼 자동 감지 (행 수 대칭, 셀 차원은 다름 — 기존)
- [ ] **deferred** — Table DOM wrapper (`packages/shared/src/components/Table.tsx`, 2003줄: pagination · 가상화 · async 경로) 를 `useResolvedCollectionItems` 로 옮기는 정렬. 행 source 는 이미 shared resolve (`useCollectionData` → `resolveBoundCollection` · `resolveCollectionSnapshot`) 라 Skia 와 같은 행을 읽고, fieldMap 은 Table 에 해당 없음 — 사용자-가시 변경 0 인 wrapper 리팩터라 production 재현 시나리오 없음 (review-loop-closure §2, LOW deferred). Phase 4 의 Tree/Tabs raw 소비 정렬과 같은 판정 대상

### Phase 4 — 패밀리 sweep (나머지 7종)

> **Implemented 2026-09-11** — sweep 12/12 (`apps/builder/scripts/adr152-p4-live.mjs`, ADR 본문 §Live Exercise).

- [x] 7종 sweep (live 하니스 = parallel-verify 의 key 대조 판) — Skia 투영 (gridlist · tag · breadcrumb 는 `getListBoxProjectionRows(binding+collections)` 로 roles 자동) · Preview DOM (GridList · TagGroup · Tabs · Menu popover · ComboBox popover · Tree `data-key`, Breadcrumbs 는 `<li>` 가 key 를 안 내 라벨) 전부 uid 컬럼. **실측 결함 1 수리**: `TagGroup.tsx` 두 items 경로가 `{ id: row.itemKey, ...row.item }` 순서라 raw `id` 가 정규화 key 를 덮어 Skia 와 갈렸다 → raw 먼저 · id/label 뒤 (ListBox 와 같은 순서), RED 원복 확인
- [x] Tree childrenKey 판정: **이 Phase 에서는 불필요** — Tree 자식은 `children` 고정 key (DataField.children 중첩 스키마 규약과 같은 이름) 로 재귀하고, 같은 `toItemProjectionRow` + hook 이 돌려주는 `fieldRoles` 로 정규화한다 (자식 key 도 value 역할). `fieldMap.children` 은 Inspector 에 역할 Select 가 하나 더 붙고 (Tree 외 가족엔 잡음) 수요가 없어 additive 후보로만 기록
- [x] Tabs · Tree DOM wrapper → `useResolvedCollectionItems` (raw `useCollectionData` 제거): 항목 key = `row.itemKey`, 라벨 = `row.label` (Tabs 패널 본문 content/description/body 는 raw item — Tabs 고유 축). Tree `dataBinding` prop 타입을 `DataBinding | DataBindingValue` 로 (Tabs 동형). hook 결과에 `fieldRoles` 추가 (행 밖 데이터 정규화용)
- 기존 가족 격차 (ADR-152 범위 밖, 기록): Tabs Skia 투영은 items SSOT 만 (dataBinding 미투영 — `resolveDataBoundTabProjection` 주석) · Tree 는 data-bound Skia 투영 없음 · Menu/ComboBox/Select 는 popover 라 캔버스 행 없음. Table wrapper 정렬은 Phase 3 deferred 그대로

### Phase 5 — legacy 경로 흡수 (G0 결과 조건부)

> **Implemented 2026-09-11** (파일 삭제 3건은 별도 승인 대기 — 아래) — live 6/6 (`apps/builder/scripts/adr152-p5-live.mjs`, ADR 본문 §Live Exercise).

- [x] `datatableId` 경로 (G0 = 0): `useCollectionData` 에서 상태 조회 · consumer 등록 effect · load/reload/loading/error 분기 제거, `UseCollectionDataOptions.datatableId/elementId` · `useResolvedCollectionItems` 옵션 · `DataTableService.addConsumer/removeConsumer/loadDataTable` 제거 (Chart 의 `elementId` 전달 1건 정리). `importCollectionEnvelope` 의 `datatableId` 키 remap 은 구 문서 read 호환으로 유지
- [x] legacy `{ type:"collection" }` 분기: `normalizeDataBinding` (`packages/shared/src/collections/normalizeDataBinding.ts`) — `config.collectionId / datatableId / name` 이 있으면 v2 `{ source:"dataTable", collectionId, name }` 로 (DOM `useCollectionData` 안정화 지점 · Skia `readDataBindingRows` 입구 둘 다), inline static (`config.data`) · api (`config.endpoint`) 는 변환 불가라 legacy loader 유지 · `supabase` 분기 (throw 뿐) 제거
- [x] `useDataTableStore` 소비처: `BuilderCore.tsx` `LOAD_DATA_TABLE` → `useDataStore` (이름 resolve 헬퍼 → 연결 endpoint `targetCollectionId`·이름 → `executeApiEndpoint`, mock 전용은 no-op) · `SAVE_TO_DATA_TABLE` → `getDataTableData` + `setRuntimeData` (Canvas 동기화 포함 — R10: syncCollectionsToCanvas 단일). `components/data/DataTable.tsx` 는 렌더 소비처 0 (export 만) — 대체 없이 삭제 대상
- [x] React Query 병행 제거: `DataTablePanel.tsx` 가 `useDataStore.isLoading` + store fetch 만 (새로고침 1회 = fetch 1회), `hooks/index.ts` 의 `useDataPanelQuery` export 제거 → `useDataQueries.ts` 소비처 0
- [ ] **원본 삭제 (별도 승인)**: `apps/builder/src/builder/stores/datatable.ts` · `apps/builder/src/builder/components/data/DataTable.tsx` (+ `components/data/index.ts` · `components/index.ts` export 행) · `apps/builder/src/builder/hooks/useDataQueries.ts` — 전부 소비처 0. 승인 후 별도 커밋 + 정적 가드 ② 의 `ALLOW_LEGACY_STORE` 예외 제거

### Phase 6 — publish 연동

> **Implemented 2026-09-11** — G3 5/5 (`apps/builder/scripts/adr152-p6-live.mjs`, ADR 본문 §Live Exercise).

- [x] snapshot 직렬화: `toRuntimeCollection` (`packages/shared/src/collections/collectionSnapshot.ts`) — `{ id, name, schema (id 포함), mockData, useMockData }` 만, `runtimeData` · 저장소 메타 제외. `BuilderCore` 의 헤더 Preview payload (sessionStorage) 와 export JSON (`downloadProjectAsJson`) 둘 다 경유. **fieldId 통과 결함 수리**: `ExportedProjectSchema` 의 schema 필드가 `{ key, type, label }` 만 허용해 import (`validateExportedProject` → `result.data`) 에서 `id` 가 strip 됐다 → `id` · `required` · `defaultValue` 추가 (unit: 검증 결과에 id 잔존)
- [x] ~~`apps/publish` 에 read-only collections provider~~ → **ADR-209 로 마운트 완료** (`apps/publish/src/App.tsx:1`) — 남은 것은 snapshot 에 `fieldId` 가 실리는지 확인뿐. **2026-08-17**: Phase 3 선행 조건에서 preview 에 붙이는 provider 와 **같은 부품**(`CollectionDataProvider` + `dataTableService`)이다 — snapshot 을 소스로 삼는 것만 다르므로 Phase 3 배선을 재사용하고 여기서 새로 만들지 말 것
- [x] G3 live 5/5 — publish 탭 ListBox 행 3 (key = fieldMap value 역할 uid) · Table `aria-rowcount` 3 + 셀 snapshot 값 · payload 키 검사. **범위 밖 (기록)**: publish 는 ref ListBox 의 master slot 템플릿을 (이름 문법 · `{#id}` 둘 다) 보간하지 않는다 — 원인은 `apps/publish/src/App.tsx` 가 builder preview 의 `resolveCanonicalRefTree` (ref → master subtree 확장) 를 돌리지 않아 `SelectionRenderers` 에 ListBoxItem 템플릿 자식이 없는 것 (ADR-162/159 publish leg · 메모리 `project-publish-link-only-defer-until-builder-stable`) — ADR-152 데이터 계약과 무관
- [x] ~~API source 는 publish 런타임에서 직접 fetch~~ → 소멸 확정 (159 P4b 로 dataTable 단일; publish 는 `createCollectionSnapshotServices` 의 executor 가 endpoint 를 실행하고 그 전엔 `resolveCollectionSnapshot` 이 mockData 폴백) → 개정 2026-07-21: ADR-159 dataTable 단일 방향 — api/variable/route 오소링 제거(159 P4c, G4 소비처 0 확증 게이트) 확정 시 본 항목 소멸, publish 는 collections snapshot 만 소비. 159 G4 실패(잔존 소비처 발견) 시에만 본 항목 원안 복귀 판정

### Phase 7 — closure

- [ ] CHANGELOG (Features + Architecture) / ADR README Status 갱신
- [ ] `.claude/rules/state-management.md` §Collections read 진입점에 v2 계약 반영

## 4. 파일 변경표 (추정 — Phase 0 에서 freeze)

| 파일                                                                             | Phase | 변경                                                          |
| -------------------------------------------------------------------------------- | :---: | ------------------------------------------------------------- |
| `packages/shared/src/schemas/dataChange.ts` (신규)                               |  1c   | DataChange zod + JSON Schema (`z.toJSONSchema`)               |
| `apps/builder/src/builder/stores/utils/dataChange.ts` (신규)                     |  1c   | reduceDataOps + applyDataChange (History `data` entry)        |
| `apps/builder/src/builder/stores/utils/dataChangeDiff.ts` (신규)                 |  1c   | partial patch → DataOp[] (updateCollection wrapper)           |
| `apps/builder/src/builder/stores/history/historyActions.ts`                      |  1c   | `data` early-branch ×3 + sync skip                            |
| `packages/shared/src/types/collection.types.ts`                                  |   1   | PropertyDataBinding v2 (additive)                             |
| `packages/shared/src/collections/resolveBoundCollection.ts` (신규)               |   1   | id 우선 resolve 헬퍼                                          |
| `apps/builder/src/builder/hooks/useCollectionData.ts`                            |  1,5  | 헬퍼 경유 + legacy 분기 축소                                  |
| `apps/builder/src/builder/components/property/PropertyDataBinding.tsx`           |  1,2  | collectionId upgrade + fieldMap UI                            |
| `packages/shared/src/collections/resolveCollectionItems.ts`                      |   3   | fieldMap options 소비                                         |
| `apps/builder/src/builder/workspace/canvas/scene/canvasSceneNode.ts`             |   3   | fieldMap 전달 (projection 호출부)                             |
| `packages/shared/src/components/*` (collection wrapper 10종 호출부)              |  3,4  | fieldMap 전달                                                 |
| `apps/builder/src/builder/stores/datatable.ts`                                   |   5   | deprecate → (승인 후) 제거                                    |
| `apps/builder/src/preview/App.tsx`                                               |   3   | collection DI provider 마운트 (선행 조건 — 격차 7)            |
| `apps/publish/src/*` (provider + renderer 소비)                                  |   6   | snapshot read 경로 신설 (Phase 3 provider 재사용)             |
| `apps/builder/src/types/builder/data.types.ts`                                   |   1   | (v2.1) `DataField.id` · `targetCollectionId` additive         |
| `packages/shared/src/collections/fieldTemplate.ts` (+ `fieldTemplateStorage.ts`) |  1b   | (v2.1) `{#id}` 저장형 + 이름 ↔ id 변환기                      |
| `packages/specs/src/data/fieldIdIndex.ts` (신규)                                 |  1b   | (v2.1) id → key 색인 — resolve 지점 등록, 보간·차트 read 소비 |
| `packages/specs/src/chart/series.ts` · `apps/builder/.../chartFieldOptions.ts`   |  1b   | (v2.1) 차트 `#id` 참조 read · Properties `#id` 저장           |
| `packages/shared/src/schemas/dataChange.ts` (신규)                               |  1c   | (v2.1) `DataOp` / `DataChange` zod + JSON Schema              |
| `apps/builder/src/builder/stores/utils/dataChange.ts` (신규)                     |  1c   | (v2.1) 적용기 + inverse                                       |
| `apps/builder/src/builder/stores/history.ts`                                     |  1c   | (v2.1) `type:"data"` entry + dispatcher 분기                  |
| `apps/builder/src/builder/hooks/useDataQueries.ts` · `DataTablePanel.tsx`        |   5   | (v2.1) React Query 병행 제거                                  |

## 5. 검증 전략

- 정적: `resolveBoundCollection` 단위 테스트 (id/name/부재 3분기) + name 직접 find 금지 grep 가드
- 대칭: `/cross-check` (Phase 3 대표 3종) + `/sweep` (Phase 4 패밀리)
- live behavior: 각 Phase 게이트에 실제 builder 1회 exercise 명시 (test PASS 단독 종결 금지 — CLAUDE.md 완료 기준)
