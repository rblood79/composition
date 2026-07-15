# ADR-151 구현 상세 — Data 패널 ↔ Collections ↔ 컴포넌트 Collection 바인딩 통합

> 본 문서는 [ADR-151](../151-data-panel-collection-binding-integration.md)의 구현 상세(Phase, 파일 변경표, 체크리스트)를 담는다. 결정/위험/게이트는 ADR 본문이 정본.

## 1. 현행 실측 인벤토리 (2026-07-16 기준)

### 1-1. 데이터 흐름 지도

```
[Data 패널]                          [Inspector]                     [렌더러 2계]
panels/datatable/                    PropertyDataBinding.tsx          Builder Skia:
  DataTablePanel / DataTableEditor     (source/name/path 편집)          BuilderCanvas.tsx:197-205
  ColumnSelector (schema 편집용)          ↓ element.props.dataBinding      → buildCanonicalSceneModel({collections})
      ↓ CRUD                         CatalogInspectorFields.tsx:185       → getFlatProjectionRows / getTableProjectionRows
useDataStore (stores/data.ts)          (field.key === "dataBinding")   Preview DOM (iframe):
  collections: Map<string, DataTable>                                   messageHandler.ts:451 setCollections
  SSOT = Supabase data_tables                                            → runtimeStore.collections
  (persist 미들웨어 없음)                                                → useCollectionData → RAC wrapper
```

### 1-2. 확인된 격차 5개

| #     | 격차                      | 실측 근거                                                                                                                                                                                                                     |
| ----- | ------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 격차1 | **name 기반 바인딩 참조** | `useCollectionData.ts:298` `collections.find((dt) => dt.name === propertyBinding.name)` — DataTable rename 시 바인딩 silent 파손. `PropertyDataBinding` 타입에 id 필드 없음 (`collection.types.ts:207-220`)                   |
| 격차2 | **읽기 경로 3중화**       | `useCollectionData.ts:202-208` — ① `dataBinding`(PropertyDataBinding) ② `datatableId`(`stores/datatable.ts` legacy `useDataTableStore`) ③ legacy `DataBinding type:"collection"`(static/api/supabase, `:392-407`)             |
| 격차3 | **column mapping 부재**   | item label 이 하드코딩 필드 휴리스틱: `packages/shared/src/collections/resolveCollectionItems.ts:169-176` (`label > textValue > children > name > title > value`). schema 기반 사용자 매핑 UI 없음 — `path` free-text 만 존재 |
| 격차4 | **publish 소비 0건**      | `apps/publish/src` 에 `collections`/`useCollectionData` grep 0건 — 배포 앱에서 바인딩된 collection 이 데이터를 렌더하지 못함 (ADR-132 §scope 경계 W4 후속 지정 영역)                                                          |
| 격차5 | **store 이중화**          | `stores/data.ts`(useDataStore, Supabase SSOT) ↔ `stores/datatable.ts`(useDataTableStore — consumers/transform/status 별도 상태 기계) 공존. 격차2 ② 경로의 원천                                                                |

### 1-3. dataBinding 을 노출하는 catalog binding (11종)

`packages/shared/src/catalog/bindings/` — Breadcrumbs / ComboBox / GridList / ListBox / Menu / Select / Table / TableCell / Tabs / TagGroup / Tree (`dataBinding: { kind: "binding", label: "Data", section: "content" }`).

### 1-4. 재사용 가능한 기존 자산

- `resolveCollectionItems` 단일 계약 (`packages/shared/src/collections/resolveCollectionItems.ts`) — Skia projector 와 DOM wrapper 가 **이미 동일 함수**를 소비 (ADR-912 영역 B hoist). fieldMap 주입 지점으로 최적.
- `ColumnSelector` (`panels/datatable/components/ColumnSelector.tsx`) — schema 컬럼 선택 UI. Inspector 매핑 UI 에 재사용.
- `getElementDataBinding` (`apps/builder/src/adapters/canonical/compositionExtensionFields.ts`) — canonical node → dataBinding 단일 추출점.
- ListBox 등의 data-bound authoring mode + template anchor (`layers/listBoxRowProjection.ts`) — item 템플릿 구조 기존재.

## 2. Binding 계약 v2 (Phase 1 산출물)

```ts
// packages/shared/src/types/collection.types.ts — 확장 (BREAKING 아님, additive)
export interface PropertyDataBinding {
  source: "dataTable" | "api" | "variable" | "route";
  /** v2: 안정 참조 — DataTable.id / ApiEndpoint.id */
  collectionId?: string;
  /** v1 잔존 — collectionId 부재 시에만 fallback resolve. 저장 시 v2 로 upgrade */
  name: string;
  /** v2: 역할별 컬럼 매핑 — 미지정 시 기존 휴리스틱 fallback */
  fieldMap?: {
    label?: string; // item 표시 텍스트 컬럼
    value?: string; // item value/key 컬럼
    description?: string; // 보조 텍스트 컬럼
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

## 3. Phase 계획

### Phase 0 — Inventory freeze (착수 게이트 G0)

- [ ] legacy 경로 실사용 실측: 프로젝트 DB/저장 문서에서 ① `datatableId` prop 보유 element ② `dataBinding.type === "collection"` element 건수 집계
- [ ] `PropertyDataBinding` 소비처 전수 grep (`asPropertyBinding` / `getElementDataBinding` / `propertyBinding.name` 직접 접근)
- [ ] `apps/publish` 의 ProjectData 직렬화 현황 확인 (elements 외 데이터 포함 여부)
- [ ] 11 binding 컴포넌트별 items 소비 방식 표 (useCollectionData 직접 / useResolvedCollectionItems 경유 구분 — GridList/ComboBox 는 후자)

### Phase 1 — Binding 계약 v2 + resolve 단일화

- [ ] `collection.types.ts` PropertyDataBinding 확장 (additive)
- [ ] `resolveBoundCollection` 헬퍼 신설 (`packages/shared/src/collections/`) — id 우선 + name fallback
- [ ] `useCollectionData.ts:292-316` (dataTableResult) 를 헬퍼 경유로 교체
- [ ] Skia 측 소비 (`getElementDataBinding` 하류 — `resolveCollectionItems` 입력 정규화 지점) 동일 헬퍼 경유
- [ ] Inspector commit 시 collectionId upgrade 반영 (`PropertyDataBinding.tsx` onChange)
- [ ] 정적 가드: `propertyBinding.name` 으로 collections find 하는 직접 패턴 grep 0건 test

### Phase 2 — Inspector column mapping UI

- [ ] `PropertyDataBinding.tsx` — source=dataTable 선택 시 해당 DataTable schema 를 읽어 fieldMap(label/value/description/icon) Select 노출 (ColumnSelector 패턴 재사용)
- [ ] `path` free-text 는 "고급" 접힘 영역으로 격하
- [ ] Data 패널 쪽 진입 동선: DataTableEditor 에 "이 테이블을 사용하는 요소" 역참조 표시는 **범위 외** (후속 UX 과제로 기록만)

### Phase 3 — fieldMap 소비 + 대표 3종 live 검증

- [ ] `resolveCollectionItems.ts` — `getItemLabel/Value/Description/Icon` 에 fieldMap 인자 추가 (미지정 시 기존 휴리스틱 그대로 — 시그니처 BC 유지 방식은 options 객체)
- [ ] Skia projector 경로 + DOM wrapper 경로 양쪽이 fieldMap 을 동일 지점에서 전달하는지 확인 (단일 계약이므로 호출부 2곳)
- [ ] ListBox / Table / Select 3종: mockData + fieldMap 지정 → Builder Skia ↔ Preview DOM label 동일 — `/cross-check` PASS (G2)
- [ ] Table 은 fieldMap 대신 columns(schema 파생) 경로 — `getTableProjectionRows` 에 schema 컬럼 순서/표시명 반영 확인

### Phase 4 — 패밀리 sweep (나머지 8종)

- [ ] Breadcrumbs / ComboBox / GridList / Menu / TableCell / Tabs / TagGroup / Tree 에 동일 fieldMap 전달 확인 + `/sweep` (parallel-verify)
- [ ] Tree 는 계층 컬럼 (childrenKey) 필요 여부 판정 — 필요 시 fieldMap.children 추가는 이 Phase 안에서 additive

### Phase 5 — legacy 경로 흡수 (G0 결과 조건부)

- [ ] `datatableId` 경로: 실사용 0~4건이면 `useCollectionData` 에서 deprecate 주석 + 신규 진입 차단 (호출부 제거), 5건+ 이면 데이터 마이그레이션 단계 추가 (사용자 확인 후)
- [ ] legacy `DataBinding type:"collection"` static/api 분기: PropertyDataBinding 형식으로 변환 헬퍼 제공 후 load callback 분기 축소
- [ ] `stores/datatable.ts` (useDataTableStore): 소비처 0 도달 시 제거는 **별도 커밋** — 원본 삭제 승인 규칙 준수 (CLAUDE.md §마이그레이션 원칙)

### Phase 6 — publish 연동

- [ ] 프로젝트 publish 시 data snapshot 직렬화: `collections`(schema+mockData, `runtimeData` 제외) + `api_endpoints` 정의를 publish payload 에 포함
- [ ] `apps/publish` 에 read-only collections provider + 동일 `resolveCollectionItems` 소비 (shared 계약 재사용 — 신규 로직 최소화)
- [ ] live 게이트 G3: publish 된 프로젝트에서 dataTable 바인딩 ListBox/Table 이 snapshot 데이터 렌더 확인
- [ ] API source 는 publish 런타임에서 직접 fetch (proxy 경로 재사용 판정 — Phase 0 인벤토리 결과 반영)

### Phase 7 — closure

- [ ] CHANGELOG (Features + Architecture) / ADR README Status 갱신
- [ ] `.claude/rules/state-management.md` §Collections read 진입점에 v2 계약 반영

## 4. 파일 변경표 (추정 — Phase 0 에서 freeze)

| 파일                                                                   | Phase | 변경                               |
| ---------------------------------------------------------------------- | :---: | ---------------------------------- |
| `packages/shared/src/types/collection.types.ts`                        |   1   | PropertyDataBinding v2 (additive)  |
| `packages/shared/src/collections/resolveBoundCollection.ts` (신규)     |   1   | id 우선 resolve 헬퍼               |
| `apps/builder/src/builder/hooks/useCollectionData.ts`                  |  1,5  | 헬퍼 경유 + legacy 분기 축소       |
| `apps/builder/src/builder/components/property/PropertyDataBinding.tsx` |  1,2  | collectionId upgrade + fieldMap UI |
| `packages/shared/src/collections/resolveCollectionItems.ts`            |   3   | fieldMap options 소비              |
| `apps/builder/src/builder/workspace/canvas/scene/canvasSceneNode.ts`   |   3   | fieldMap 전달 (projection 호출부)  |
| `packages/shared/src/components/*` (collection wrapper 11종 호출부)    |  3,4  | fieldMap 전달                      |
| `apps/builder/src/builder/stores/datatable.ts`                         |   5   | deprecate → (승인 후) 제거         |
| `apps/publish/src/*` (provider + renderer 소비)                        |   6   | snapshot read 경로 신설            |

## 5. 검증 전략

- 정적: `resolveBoundCollection` 단위 테스트 (id/name/부재 3분기) + name 직접 find 금지 grep 가드
- 대칭: `/cross-check` (Phase 3 대표 3종) + `/sweep` (Phase 4 패밀리)
- live behavior: 각 Phase 게이트에 실제 builder 1회 exercise 명시 (test PASS 단독 종결 금지 — CLAUDE.md 완료 기준)
