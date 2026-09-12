# ADR-152: Data 패널 ↔ Collections ↔ 컴포넌트 Collection 바인딩 통합

## Status

Implemented — 2026-09-11 (Proposed 2026-07-16 · Accepted 2026-09-11 · 리뷰 round 4 승인 2026-09-11, 개정안 이슈 0 — `../reviews/152.md` · 사용자 착수 승인 `/execute-adr 152` · Phase 0 ~ 7 전부 반영, 같은 날 closure)

**Phase 진행 로그**: Phase 0 Inventory freeze — Implemented 2026-09-11 (G0 = 0건, breakdown §1-6) · Phase 1 계약 v2 + resolve 단일화 + `DataField.id` + Map id 키 — Implemented 2026-09-11 (G1 PASS, breakdown §Phase 1) · Phase 1b `{#id}` 템플릿 저장형 + 차트 `#id` — Implemented 2026-09-11 (G4 PASS 14/14, breakdown §Phase 1b) · Phase 1c `DataChange` 적용기 + History `type:"data"` — Implemented 2026-09-11 (G5 PASS 14/14, breakdown §Phase 1c) · Phase 2 Inspector fieldMap (value/icon) Select — Implemented 2026-09-11 (live 10/10, breakdown §Phase 2) · Phase 3 fieldMap 소비 (Skia · DOM 단일 resolver) — Implemented 2026-09-11 (G2 PASS 9/9, breakdown §Phase 3 — Table wrapper 정렬은 같은 날 후속 커밋으로 해소, 10/10) · Phase 4 패밀리 sweep 7종 (Tabs · Tree 정렬 + TagGroup key 결함 수리) — Implemented 2026-09-11 (sweep 12/12, breakdown §Phase 4) · Phase 5 legacy 경로 흡수 (datatableId · legacy binding normalize · useDataTableStore/React Query 소비처 0) — Implemented 2026-09-11 (live 6/6, legacy 파일 3건 삭제 완료 — 사용자 승인, breakdown §Phase 5) · Phase 6 publish snapshot (`toRuntimeCollection` · export schema fieldId 통과) — Implemented 2026-09-11 (G3 PASS 5/5, breakdown §Phase 6) · Phase 7 closure — Implemented 2026-09-11 (CHANGELOG Features + Architecture · README Implemented 이관 · `.claude/rules/state-management.md` §Collections read 진입점 v2 계약 · 본문 `completed/` 이동 + 참조 경로 9 파일 정합화, 코드 변경 0)

> **개정 2026-07-21 (사용자 confirm — ADR-159 와 경계 재획정)**: 텍스트 표시 축(label/description 컬럼 선택)은 [ADR-159](159-collection-field-template-binding.md)(`{field}` 템플릿 바인딩)로 이관 — 본 ADR 의 fieldMap 은 **비텍스트 역할(icon/value) 한정**으로 축소. 데이터 소스는 ADR-159 의 dataTable 단일 방향(api/variable/route 오소링 표면 제거, 159 P4)을 전제로 개정 — 본 ADR 의 API source 관련 항목(R3, breakdown Phase 6)은 159 G4 게이트 결과에 종속. **scope 변경이므로 착수 전 재리뷰 대상** (기존 round 1 승인은 구 scope 기준).

> **실측 추가 2026-08-17 (scope 무변경 — 근거 보강 + 사실 정정)**: `source:"dataTable"` 바인딩이 **빌더 캔버스에서는 렌더되고 preview 에서는 0행**인 것을 양축 대조로 확인했다 (격차 7). 원인은 `CollectionDataProvider` 가 repo 어디에도 마운트되지 않는 것이고, ADR-132 가 R2/G3-1 로 식별·이연한 바로 그 항목이되 범위가 더 넓다 (`dataTableService` 축 포함, 전 앱). 이에 따라 **Hard Constraint 3(Skia↔DOM 대칭)은 보존 대상이 아니라 복구 대상으로 정정**했고, provider 배선을 Phase 3 선행 조건으로 올렸다 (R7 / G2 전제 / breakdown Phase 3). 대안·Decision·Phase 구성은 변경하지 않았다 — 재리뷰 시 이 결함을 본 ADR 안에서 처리할지 선행 수리로 분리할지가 판정 대상.

> **착수 금지 해제 + scope 확장 (사용자 결정 2026-09-11)**: 2026-07-16 의 "생성까지만 — 착수 금지" 지시를 해제하고, 계약 v2 를 `collectionId` 에 더해 **`fieldId` (안정 field 참조 — `DataField.id` 신설)** 까지 넓힌다. 근거는 [DATA_PANEL_REDESIGN_RESEARCH_2026-09](../../explanation/research/DATA_PANEL_REDESIGN_RESEARCH_2026-09.md) §4-0 ① · §5 Track 1 (D2 key rename 고아 · D3 이름 참조 파손 · M7 Framer 교훈). 같은 Track 1 에 store 통합 (`useDataTableStore` · React Query 병행 제거 — 격차 5 · 2) 과 `DataChange` 적용기 + History 연결 (UX-4) 이 들어온다. **scope 변경이므로 Accepted 전 Risk-First 개정 (Phase 0 inventory 재측정 포함) → 재리뷰** 순. relation 타입은 로드맵 밖 (같은 날 결정) — `DataField.type` 확장 여지만 둔다.

## Context

빌더 Data 패널(`panels/datatable/`)에서 정의한 DataTable(collections)과 컴포넌트 collection(ListBox/Table/Select 등 10종 catalog binding)의 연동은 ADR-131(데이터 SSOT = `data_tables` 확정) / ADR-132(read 진입점 `useCollectionData` 단일화)로 골격이 완성됐으나, ADR-132 가 scope 밖으로 명시한 후속 영역(Data 패널 UX / publish 직렬화 / binding 계약 정합)이 미해결로 남아 있다. 본 ADR 은 그 후속으로, 바인딩 계약과 소비 경로를 완결한다.

**Domain 분류**: 본 결정은 **D2(Props/API — `dataBinding` prop 계약)** 중심이며, 데이터 자체의 SSOT 는 3-domain 밖의 데이터 도메인(ADR-131 이 `data_tables` 로 확정)이다. D3 는 소비 대칭(Builder Skia projector ↔ Preview DOM wrapper 가 동일 row/label 산출)으로만 관여하고, D1(RAC DOM/접근성)은 무변경. CSS Generator emit 과 무관한 ADR 이다 (inspector `kind:"binding"` 필드만 관여).

**후속 응용 ADR**: [ADR-013](../013-quick-connect-data-binding.md)(Quick Connect — 바인딩 생성 1클릭 UX)은 본 ADR 의 계약 v2 write 경로(`collectionId`+`fieldMap`, `props.dataBinding` 정규화)를 소비하는 응용이며, 본 ADR 완료가 선행 조건이다. 병합 여부는 2026-07-16 사용자 확인으로 **분리 유지** 확정 — 계약 layer(본 ADR)와 UX 자동화 layer(013)는 직교하고, 합치면 실패 시 원인 분리가 불가한 위험 누적 구조가 된다.

**실측 현행 격차 (2026-07-16)**:

1. **name 기반 바인딩 참조** — `useCollectionData.ts:298` 이 `collections.find((dt) => dt.name === propertyBinding.name)` 로 resolve. DataTable rename 시 바인딩이 silent 파손된다. `PropertyDataBinding` 타입(`packages/shared/src/types/collection.types.ts:207-220`)에 id 필드 자체가 없다.
2. **읽기 경로 3중화** — `useCollectionData.ts:202-208` 에 ① `dataBinding`(PropertyDataBinding) ② `datatableId`(legacy `useDataTableStore`, `stores/datatable.ts`) ③ legacy `DataBinding type:"collection"` 세 입력 경로가 공존한다.
3. **column mapping 부재** — item label 이 하드코딩 필드 휴리스틱(`packages/shared/src/collections/resolveCollectionItems.ts:169-176`, `label > textValue > children > name > title > value`)으로만 결정된다. schema 가 `{ email, age }` 인 테이블은 어떤 컬럼을 표시할지 사용자가 선택할 수 없다. → **개정 2026-07-21**: 텍스트 표시(label/description)는 ADR-159 `{field}` 템플릿이 해결(다중 필드+literal 혼합 — 단일 컬럼 fieldMap 으로는 표현 불가가 확인됨). 본 ADR 잔존분은 비텍스트 역할(icon/value) 매핑만.
4. **publish 소비 0건** — `apps/publish/src` 에 collections 소비 코드가 없어, 배포된 앱에서 바인딩된 collection 이 데이터를 렌더하지 못한다 (ADR-132 §scope 경계 W4 지정 영역). → **개정 2026-08-17**: 원인이 publish 고유가 아니다. 아래 격차 7 의 provider 부재가 **preview 에도 동일하게** 걸린다 — publish 는 소비 코드가 없고 preview 는 소비 코드가 있는데 공급자가 없는 형태로, 증상(0행)은 같다.
5. **store 이중화** — `useDataStore`(`stores/data.ts`, Cloud SSOT) 와 `useDataTableStore`(`stores/datatable.ts`, 별도 상태 기계) 공존.
6. **binding 이중 저장 위치** — `getElementDataBinding` 이 `props.dataBinding` 우선 + legacy top-level `element.dataBinding` fallback 의 2 위치를 읽는다 (`apps/builder/src/adapters/canonical/compositionExtensionFields.ts:74-94`). scene projection signature 는 `props` 만 포함하므로 (`buildSceneSnapshot.ts:49-66`) legacy top-level 위치만 가진 요소는 binding 변경이 sceneVersion 에 미감지되는 사각이 있다.
7. **DI provider 부재 → Skia ↔ DOM 대칭이 이미 깨져 있다 (실측 2026-08-17)** — `CollectionDataProvider` / `CollectionDataContext.Provider` 가 **repo 어디에도 렌더되지 않는다** (전 확장자 grep 0건 + `git log -S --all` 결과 2건 모두 ADR 문서의 코드 예시 — 한 번도 마운트된 적 없음). 따라서 `useCollectionDataServices()` 는 항상 context 기본값 `{}` 를 반환하고 `dataTableService` / `apiEndpointService` / `mockApiService` 가 영구히 `undefined` 다. 상세는 아래 §"격차 7 실측 근거".

**재측정 (2026-09-11, 개정 근거 — [리서치](../../explanation/research/DATA_PANEL_REDESIGN_RESEARCH_2026-09.md) §1 · §2)**:

| 격차 | 2026-08-17 상태                         | 2026-09-11 실측                                                                                                                                                                                                                                                                                                   | 본 ADR 처리                                                          |
| ---- | --------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------- |
| 1    | name 참조                               | 그대로 — `packages/shared/src/hooks/useCollectionData.tsx:306` `dt.name === propertyBinding.name \|\| dt.id === propertyBinding.name` (id 도 `name` 필드에 실려야 맞는다) · `:324,338` api 도 name. `PropertyDataBinding` (`collection.types.ts:233`) 에 `collectionId` 없음                                      | Phase 1 (원안)                                                       |
| 4·7  | provider 미마운트 → preview/publish 0행 | **해소** — ADR-209 가 `preview/App.tsx:1412` · `apps/publish/src/App.tsx:1` 에 `CollectionDataProvider` + `createCollectionSnapshotServices` 를 마운트했다. R7 · G2 전제 · breakdown Phase 3 선행 조건은 **충족 상태**로 바뀐다. Phase 6 의 publish provider 도 이미 있다 — 남는 것은 snapshot 직렬화 형식 확인뿐 | R7 종결, Phase 3 선행 항목 삭제, Phase 6 축소                        |
| 5    | store 이중화                            | `useDataTableStore` 소비처 3 파일 (`stores/datatable.ts` 자신 · `components/data/DataTable.tsx` · `main/BuilderCore.tsx:883,1007,1085`) + **React Query 병행** (`useDataPanelQuery`, `DataTablePanel.tsx` 가 store fetch 3종과 같이 호출) — 3중                                                                   | Phase 5 확장 (React Query 포함)                                      |
| 8    | (신규) **field 이름 참조**              | `DataField` (`data.types.ts:31`) 에 id 없음 — `{field}` 템플릿 (ADR-159) · fieldMap · mockData/runtimeData 행 key · `ColumnSelector` 가 전부 `key` 문자열. key 변경 시 행 값 고아 (Track 0 D2 로 행 migrate 만 수리 `66f9cb28b`) · 템플릿은 옛 key 로 남는다                                                      | **scope 확장 — `fieldId`** (사용자 결정 2026-09-11)                  |
| 9    | (신규) 데이터 편집이 History 밖         | `stores/history.ts` `HistoryEntry.type` 13종이 전부 element/page 계열, `elementId` 필수 — `useDataStore` 참조 0. 셀 편집 · CSV 전량 교체 (`DataTableEditor.tsx:480` `Papa.parse`) 가 undo 불가. 사람 편집 · import · AI 제안 · agent tool 이 각자 store 를 직접 만진다                                            | **scope 확장 — `DataChange` 적용기 + History** (리서치 4-0 ③ · UX-4) |
| 10   | (신규) `targetCollection` 이름 참조     | `ApiEndpoint.targetCollection?: string` 이 collection **이름** — sink 는 `dataActions.ts` 실행기가 이름으로 찾는다. 격차 1 과 같은 병                                                                                                                                                                             | Phase 1 에 포함 (`targetCollectionId`)                               |

**격차 7 실측 근거 (2026-08-17, 양축 대조)**

같은 프로젝트(`148ccd1e…`)·같은 바인딩으로 두 축을 실행해 대조했다. 대상 데이터: IndexedDB `collections` 3건(`Users` mock 100행 / `Roles` 5 / `Invitations` 5), 라이브 store 에 `source:"dataTable"` 바인딩 **8건**(전부 `ref` 노드).

| 축                     | 결과                                                                                                                                                                                                      |
| ---------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Skia (빌더 캔버스)** | ✅ 행 투영됨. `projection:listbox-rows:{Users owner}` = 340×**3398px**(100행 분량), `projection:gridlist-rows:{Invitations owner}` = 350×174, `Roles` 는 mock 5건의 **실제 itemKey** 로 row 노드 5/5 존재 |
| **DOM (preview)**      | ❌ 0행. preview 페이지에 React 루트를 띄워 `useCollectionData` 직접 렌더 — `Roles`/`Users` 모두 `rows: 0`, `loading: true`(4초 후에도), `error: null`                                                     |
| 대조군 (`static`)      | ✅ `rows: 3`, `loading: false` — DI 를 안 거치는 경로는 정상. 프로브 자체는 유효                                                                                                                          |

같은 렌더에서 `useCollectionDataServices()` 반환값이 `{}` 임(`serviceKeys: []`)도 함께 관측됐다.

- **Skia 가 되는 이유**: DI 를 안 거친다 — `BuilderCanvas.tsx:280-283` (2026-08-17 당시 `:234`) 가 `useDataStore.collections` 를 직접 읽어 `buildCanonicalSceneModel({ collections, … })` 로 넘긴다 (Hard Constraint 2 가 적어 둔 "별도 경로").
- **DOM 이 안 되는 이유**: `useCollectionData` 의 `source:"dataTable"` 분기는 `collections = dataTableService?.getDataTables() ?? []` 로만 목록을 얻어 항상 `[]` → `find(name)` 이 항상 `undefined`. `source:"api"` 도 `apiEndpoints` 로 동형. **비-DI 우회 경로는 없다**.
- **에러가 아니라 조용한 영구 로딩**이다. `useResolvedCollectionItems` 는 `boundData.length > 0` 로 판정해 정적 `items` 로 폴백하므로 화면에는 단서가 남지 않고, `loading` 은 상위로 그대로 전달돼 이를 소비하는 컴포넌트는 스피너가 멈추지 않는다.
- **선행 ADR 의 기록과 대조**: ADR-132 는 이 위험을 R2 로 식별하고 G3-1 게이트("DI Context 가 Canvas 측 provider 에 주입되어 있음")를 걸었으나 **게이트가 실패했고** 문서화된 대안(분기 잔존 lock-in)을 채택해 후속(=본 ADR)으로 이관했다 (`132-…-breakdown.md:104,254,453`). 즉 회귀가 아니라 **기록된 이연**이다. 다만 그 기록은 범위를 `apiEndpointService` × Canvas 측으로 좁게 적었고, 실측 결과는 (a) provider 자체가 전 앱 부재라 `dataTableService` 축도 포함되며 (b) 캔버스는 되고 DOM 만 안 되는 **비대칭**이라는 점에서 더 넓다.

**Hard Constraints**:

1. **데이터 SSOT = `data_tables`(collections) 유지** — ADR-131 Phase 8 에서 사용자가 확정한 전제 (canonical document 에 `data` root field 미도입). 본 ADR 은 이 경계를 변경하지 않는다.
2. **빌더 DOM RAC collection 의 items read = `useCollectionData` 단일 경유 유지** (ADR-132 Implemented — 원 scope 는 RAC collection 컴포넌트의 items read). Builder Skia 는 scene model 이 collections 를 직접 구독하는 기존 별도 경로(`BuilderCanvas.tsx:280-283`, 2026-07 당시 `:197-205`)이고, 본 ADR Phase 6 의 publish read 경로 신설은 이 constraint 의 scope 밖이다 — 단 두 경로 모두 `resolveBoundCollection` / `resolveCollectionItems` shared 계약을 공유해야 한다.
3. **Skia ↔ DOM 대칭** — 동일 collections 스냅샷에서 Builder Skia projection 과 Preview DOM wrapper 가 동일 row/label 을 산출해야 한다 (`/cross-check` 검증 가능). → **정정 2026-08-17**: 이 제약은 **보존 대상이 아니라 복구 대상**이다. 격차 7 실측대로 `source:"dataTable"` 에서 이미 깨져 있다 (Skia 100행 ↔ DOM 0행). 따라서 Decision §선택 근거 2 의 "D3 대칭을 **구조적으로 보존**" 은 fieldMap 축에 한해 성립하는 서술이고, 대칭 자체는 provider 배선으로 **먼저 복구**되어야 그 위에서 유효하다.
4. **하위 호환** — 저장된 name 기반 `dataBinding` 을 가진 기존 프로젝트는 로드만으로 파손 0건이어야 한다 (lazy resolve — 로드 시점 재직렬화 0 파일, 저장 시에만 upgrade).
5. **성능** — collections 변경 → scene rebuild 는 기존 구독 구조(`BuilderCanvas.tsx:280-283` useMemo) 유지. pointer hot path 에 데이터 resolve 추가 금지 (60fps 기준).

6. **(2026-09-11 추가) 스키마 변경 파급은 한 적용기를 지난다** — 필드 rename/type/delete 가 행 · 템플릿 · fieldMap · `targetCollection` 참조를 한 트랜잭션으로 갱신하고 History entry 1개를 남긴다. 셀 편집 · 붙여넣기 · import · AI 제안 · agent tool 이 같은 적용기를 쓴다 (`Memory → Index → History → DB → Preview` 순서를 데이터에도 적용).
7. **(2026-09-11 추가, round 3 정정) `fieldId` 는 additive — 부여는 collections 가 store 에 들어오는 경계의 정규화 함수 1개, 영속은 로드 직후 1회 write-back** — 참조 (`{#id}` 템플릿 · fieldMap, canonical 문서) 와 정의 (`DataField.id`, IndexedDB `collections`) 는 저장 단위가 다르므로 메모리에서만 부여한 id 는 문서가 먼저 저장되는 순서에서 재생성된다. 따라서 id 가 없는 collection 은 **hydrate 직후 그 collection 만 IndexedDB 에 1회 write-back** 한다 (프로젝트당 id 없는 collection N건 · 1회, 이후 0). collections 를 store 에 넣는 모든 경로 (`fetchCollections` · create · update · delete · setRuntimeData · 실행기 sink · import envelope — `dataActions.ts:109,158,223,273,327,661` · `importCollectionEnvelope.ts:9`) 가 같은 정규화 함수를 지난다. `{field}` 템플릿의 사용자 문법은 **이름 그대로** — id 는 저장 형식에만 나타난다. "로드 재직렬화 0" 은 **바인딩 (`dataBinding`, HC4)** 에만 해당하고 collection 정의는 이 1회 write-back 을 허용한다.

8. **(round 3 추가) `useDataStore.collections` 는 name 키 Map 이다** (`dataActions.ts:105` `dataTablesMap.set(dt.name, dt)`, rename 시 `:200-215` 가 forEach 로 키를 옮긴다; `.get(name)` 소비처 `data.ts:315` `useCollection(name)` 공개 hook · `dataActions.ts:295,317,654,657` · `importCollectionEnvelope.ts:10`). 본 ADR 은 Map 을 **id 키로 재키잉** 한다 — Phase 1 에서 `useCollection(name)` 은 `useCollectionById(id)` + name fallback wrapper 로, `.get(name)` 6곳은 `resolveBoundCollection` 경유로. O(n) 순회 resolve 를 남기지 않는다 (HC5).

**Soft Constraints**:

- `resolveCollectionItems` 단일 계약(ADR-912 영역 B)을 Skia projector 전체 + DOM wrapper 7/10(GridList/ListBox/ComboBox/Breadcrumbs/TagGroup/Menu/Select)이 이미 소비 — 매핑 확장 지점이 구조적으로 준비되어 있다. raw 소비 잔여 3종(Table/Tree/Tabs DOM wrapper)은 본 ADR 에서 정렬 대상.
- Data 패널의 `ColumnSelector` 는 API 응답 감지 컬럼 import UI(`DetectedColumn[]` 체크박스)라 목적이 달라 직접 재사용 대상은 아님 — fieldMap 매핑 UI 는 `PropertyDataBinding` 의 기존 Select 패턴 위에 신규 구성 (참고 패턴 수준).

## Alternatives Considered

### 대안 A: 현행 name 참조 유지 + Inspector UI 만 보강

- 설명: `PropertyDataBinding` 계약은 그대로 두고 column mapping UI 만 추가. 3중 읽기 경로와 store 이중화는 방치, publish 는 별도 과제로 미룸.
- 근거: 최소 변경. 현행 name 참조도 rename 을 하지 않는 한 동작.
- 위험:
  - 기술: L — 신규 계약 없음
  - 성능: L — 변화 없음
  - 유지보수: **H** — name rename 파손(격차1) + 3중 경로(격차2) 영구 잔존. 신규 collection 컴포넌트마다 휴리스틱/legacy 분기 이해 비용 누적. publish 격차(격차4) 미해결로 "연동" 이 빌더 안에서만 완결
  - 마이그레이션: L — 없음

### 대안 B: id 참조 바인딩 계약 v2 + fieldMap + 읽기 경로 일원화 + publish 직렬화

- 설명: `PropertyDataBinding` 에 `collectionId`(안정 참조) + `fieldMap`(label/value/description/icon 역할별 컬럼 매핑)을 additive 확장. resolve 는 id 우선 + name fallback 단일 헬퍼로 통일. fieldMap 은 `resolveCollectionItems` 에 주입하고 기존 휴리스틱은 fallback 으로 격하 (Skia projector 전체 + DOM wrapper 7/10 이 같은 함수를 소비 — raw 소비 3종은 Phase 3/4 정렬로 대칭 확보). legacy 경로(datatableId / `type:"collection"`)는 실사용 실측 후 조건부 흡수. publish 시 data snapshot(schema+mockData) 직렬화 + publish 앱이 동일 shared 계약으로 소비.
- 근거: Webflow CMS / Framer CMS 는 collection field 를 요소에 역할별로 매핑하는 field-binding UI 가 표준이고, Retool/Appsmith 류 빌더는 datasource 를 id 로 참조해 rename-safe 하다. 업계 공통 패턴과 정합.
- 위험:
  - 기술: M — id/name 이중 resolve 전환기 존재 (단일 헬퍼로 국소화)
  - 성능: L — 기존 구독/캐시 구조 유지, resolve 는 O(1)~O(n) 조회
  - 유지보수: L — 단일 계약 + 단일 헬퍼. 신규 컴포넌트는 fieldMap 전달만
  - 마이그레이션: M — 기존 name 바인딩은 lazy upgrade (로드 파손 0, 저장 시 v2 기록). legacy 경로 흡수는 실측 게이트 조건부

### 대안 C: canonical document 에 data root collection 재도입

- 설명: collections 를 `CompositionDocument.data` root field 로 이관해 문서와 함께 직렬화 — publish 격차가 자동 해소되고 events/actions(ADR-131)와 구조 일관.
- 근거: ADR-110/131 의 root collection 패턴 자체는 검증됨.
- 위험:
  - 기술: M — root collection 메커니즘은 기존재
  - 성능: L
  - 유지보수: M — 데이터 CRUD 가 문서 mutation/history 파이프라인에 편입되는 비용
  - 마이그레이션: **H** — 기존 프로젝트 전수의 `data_tables` → document 이관 + Cloud 스키마 이중화 기간. 무엇보다 ADR-131 Phase 8 에서 **사용자가 명시 revert 로 확정한 전제(데이터 SSOT = `data_tables`)를 반전**시키는 SSOT 경계 재판정이라, 확정 전제의 재개 조건(사용자 재제기/scope 변경/코드 증거) 없이 채택 불가

### 대안 D (2026-09-11 추가): 대안 B + `fieldId` 없이 rename 파급만 (이름 참조 유지 + 적용기가 참조를 재작성)

- 설명: `collectionId` 는 도입하되 필드는 계속 `key` 문자열로 참조하고, rename 시 적용기가 행 · 템플릿 · fieldMap 안의 옛 key 를 새 key 로 전부 재작성한다 (Track 0 D2 수리 `renameRowsKey` 의 확장).
- 근거: Notion · Airtable 은 내부적으로 field id 를 쓰지만 (M7), Baserow 의 formula 참조는 이름 재작성 방식이다 — 둘 다 존재하는 패턴.
- 위험:
  - 기술: M — 템플릿 문자열 안의 `{name}` 을 정규식으로 재작성해야 하고 (`{name.first}` · 포맷 파이프 · literal 충돌), 재작성 누락은 무증상
  - 성능: L
  - 유지보수: **H** — 참조를 담는 곳이 늘 때마다 (fieldMap · targetCollection · 차트 시리즈 필드 (ADR-210) · 향후 filter/sort 오소링 B2 · agent tool 인자) 재작성기를 같이 넓혀야 하고, 하나라도 빠지면 격차 1 이 필드 축에서 재발한다. Framer 가 이 방식에서 id 로 옮긴 이유 (M7)
  - 마이그레이션: L — 저장 형식 변화 없음

### 대안 E (2026-09-11 추가): 대안 B + `DataField.id` 안정 참조 + `DataChange` 적용기 + store 단일화 — **개정안**

- 설명: 대안 B 에 세 가지를 더한다. ① `DataField.id` 신설 (lazy 부여) — `{field}` 템플릿 저장형 · fieldMap · `targetCollectionId` · 차트 시리즈 필드가 id 를 참조하고 이름은 표시 전용. ② `DataChange { ops: DataOp[], origin }` 적용기 하나 — 검증 → 참조 파급 (id 참조면 표시만) → History entry 1개 (`type:"data"`, `elementId` 대신 `collectionId`) → IndexedDB → canvas sync. ③ `useDataStore` 단일 (legacy `useDataTableStore` 소비처 3 파일 + React Query 병행 제거).
- 근거: Framer CMS (field id 안정 참조, M7) · Airtable/Notion (내부 field id) · Retool/Appsmith (변경 객체 → 적용기 → undo) — 리서치 §3-1 M6 · M7, §3-5 X4.
- 위험:
  - 기술: M — id/name 이중 resolve 전환기 (대안 B 와 같음) + 템플릿 저장형 이중 (이름 문법 ↔ id 저장) 변환기 1개
  - 성능: L — 적용기는 편집 이벤트 단위, hot path 아님. History entry 는 diff 만
  - 유지보수: L — 참조 담는 곳이 늘어도 id 는 불변이라 재작성기 불필요. 적용기 하나가 사람 · import · AI · agent 를 받으므로 후속 ADR (212 · 213) 의 진입점이 한 곳
  - 마이그레이션: M — `DataField.id` lazy 부여 (로드 재직렬화 0, 저장 시 기록) + History entry 타입 추가 (기존 entry 는 무변경) + store 통합은 원본 삭제 승인 규칙 준수. React Query 제거는 소비처 3 파일

### Risk Threshold Check

| 대안 | 기술 | 성능 | 유지보수 | 마이그레이션 | HIGH+ 개수 |
| ---- | :--: | :--: | :------: | :----------: | :--------: |
| A    |  L   |  L   |  **H**   |      L       |     1      |
| B    |  M   |  L   |    L     |      M       |     0      |
| C    |  M   |  L   |    M     |    **H**     |     1      |
| D    |  M   |  L   |  **H**   |      L       |     1      |
| E    |  M   |  L   |    L     |      M       |     0      |

루프 판정: 대안 B · E 가 HIGH 0 — 추가 대안 탐색 불필요. E 는 B 의 상위 집합이며 (B 의 잔존 위험을 늘리지 않고 격차 8 · 9 · 10 을 흡수) 2026-09-11 개정으로 B 를 대체한다.

## Decision

~~**대안 B: id 참조 바인딩 계약 v2 + fieldMap + 읽기 경로 일원화 + publish 직렬화**를 선택한다.~~ → **개정 2026-09-11 (사용자 결정 — 착수 금지 해제 + scope 확장)**: **대안 E: 대안 B + `DataField.id` 안정 참조 + `DataChange` 적용기 + store 단일화**를 선택한다. 아래 선택 근거 1~~3 은 B 기준으로 쓰였고 E 에도 그대로 성립한다; 4~~5 가 E 의 추가 근거다.

선택 근거:

1. 잔존 위험이 기술 M / 마이그레이션 M 뿐이며, 둘 다 단일 resolve 헬퍼와 lazy upgrade(로드 시 재직렬화 0 파일, 기존 프로젝트 파손 0)로 국소화된다.
2. `resolveCollectionItems` 단일 계약을 Skia projector 전체와 DOM wrapper 7/10 이 이미 공유하고, fieldMap 은 dataBinding 에 실려 projection rows 입력으로 이미 전달되므로(`getFlatProjectionRows({collections, dataBinding, props})`) shared 함수 내부 소비 시 기존 호출부 변경이 0 에 수렴한다 — D3 대칭(Hard Constraint 3)을 구조적으로 보존. raw 소비 잔여 3종(Table/Tree/Tabs DOM wrapper — `Table.tsx:206`/`Tree.tsx:93`/`Tabs.tsx:124`)은 Phase 3/4 에서 shared 계약 경유로 정렬한다.
3. ADR-131(데이터 SSOT)·ADR-132(read 진입점) 의 확정 전제를 그대로 준수하면서 그 위의 미완 영역만 채운다.
4. (2026-09-11) `collectionId` 만 안정화하고 필드를 이름으로 두면 격차 1 이 필드 축에서 그대로 재발한다 — Track 0 D2 수리 (`renameRowsKey`) 는 행만 옮기고 `{field}` 템플릿은 옛 key 로 남는 것이 실측됐다. 참조를 담는 곳 (fieldMap · targetCollection · 차트 시리즈 · 후속 filter/sort · agent tool 인자) 이 늘어날수록 재작성 방식 (대안 D) 의 누락 표면이 커진다.
5. (2026-09-11) 후속 ADR-212 (편집기 UI) · ADR-213 (데이터 tool 계약) · ADR-214 (Variables) 가 전부 "변경을 한 적용기에 태운다" 를 전제로 한다 — 적용기와 History 연결이 본 ADR 에 있어야 세 ADR 이 같은 진입점을 쓴다 (base ↔ 응용 분류: 본 ADR = base).

기각 사유:

- **대안 A 기각**: rename 파손과 3중 경로가 영구 잔존해 유지보수 HIGH. "연동" 의 사용자 완결점(배포 앱에서 데이터가 보임)을 달성하지 못한다.
- **대안 B 기각** (2026-09-11, E 로 대체): 격차 8 · 9 · 10 을 다루지 않는다 — collectionId 만 안정화하면 필드 축에서 격차 1 이 재발하고, 적용기 없이는 212/213/214 의 진입점이 셋으로 갈린다. E 는 B 의 잔존 위험을 늘리지 않는다 (Risk Threshold Check).
- **대안 D 기각** (2026-09-11): 참조 재작성기는 참조를 담는 표면이 늘 때마다 같이 넓혀야 하고 누락이 무증상이다 — 유지보수 HIGH. Framer 가 같은 이유로 id 참조로 옮겼다 (리서치 M7).
- **대안 C 기각**: ADR-131 Phase 8 에서 사용자가 확정한 데이터 SSOT 전제를 반전시키는 SSOT 경계 재판정(전제 확정 종결 계약의 재개 조건 미충족)이며, 그 이득(publish 직렬화 단순화)은 대안 B 의 snapshot 직렬화로 동등하게 달성 가능하다. 마이그레이션 비용도 HIGH.

> 구현 상세: [152-data-panel-collection-binding-integration-breakdown.md](../design/152-data-panel-collection-binding-integration-breakdown.md)

## Risks

| ID  | 위험                                                                                                                                                                                                                                                                           | 심각도 | 대응                                                                                                                                                                                                                                                     |
| --- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | :----: | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| R1  | id/name 이중 resolve 전환기에 기존 name 바인딩 프로젝트 회귀                                                                                                                                                                                                                   |  MED   | `resolveBoundCollection` 단일 헬퍼 (id 우선 + name fallback) + 직접 `name` find 패턴 grep 가드 + G1 live 확인                                                                                                                                            |
| R2  | fieldMap 을 Skia projector / DOM wrapper 중 한쪽만 반영해 label 비대칭                                                                                                                                                                                                         |  MED   | fieldMap 소비를 shared 함수 내부(dataBinding 이 이미 projection rows 입력에 포함)로 한정해 기존 호출부 변경 0 유지 + raw 소비 3종(Table/Tree/Tabs DOM)은 Phase 3/4 에서 shared 계약 경유로 정렬 + G2 `/cross-check`                                      |
| R3  | publish data snapshot 형식 결정 부담 (runtimeData 포함 여부 / API source 처리)                                                                                                                                                                                                 |  MED   | snapshot = schema + mockData 한정 (runtimeData 제외). ~~API 는 publish 런타임 직접 fetch~~ → 개정 2026-07-21: ADR-159 dataTable 단일 방향 — API source 오소링 제거(159 P4) 확정 시 publish 는 collections snapshot 만 소비, 본 항목은 159 G4 결과에 종속 |
| R4  | legacy 경로(datatableId / `type:"collection"`) 실사용 존재 시 제거 파손                                                                                                                                                                                                        |  MED   | Phase 0 실측 → G0 조건부 (0~4건 흡수 / 5건+ 마이그레이션 단계 확장). `useDataTableStore` 제거는 원본 삭제 승인 규칙 준수                                                                                                                                 |
| R5  | 10 컴포넌트 일괄 반영 중 scope inflation                                                                                                                                                                                                                                       |  LOW   | 대표 3종(ListBox/Table/Select) 선행 검증 후 패밀리 sweep — Phase 3/4 분리                                                                                                                                                                                |
| R6  | legacy top-level `element.dataBinding` 저장 위치 잔존 시 scene signature 사각 (격차 6) — binding 변경이 sceneVersion 미감지                                                                                                                                                    |  MED   | Phase 1 lazy upgrade 시 write 를 `props.dataBinding` 단일 위치로 정규화 (top-level 은 read fallback 만 유지) + Phase 0 에서 top-level 보유 element 실측                                                                                                  |
| R7  | **DI provider 부재(격차 7)로 D3 대칭이 착수 시점에 이미 깨져 있음** — fieldMap 을 아무리 정확히 전달해도 DOM 쪽은 행이 0이라 G2 `/cross-check` 가 fieldMap 과 무관한 이유로 실패한다 (추가 2026-08-17)                                                                         |  MED   | provider 배선을 **Phase 3 선행 조건**으로 승격 — G2 통과 조건에 전제 명시. 심각도를 HIGH 로 두지 않는 이유: 본 ADR 이 도입하는 위험이 아니라 ADR-132 가 기록·이연한 선행 결함이고, 설계(대안 B)의 정합성이 아니라 **작업 순서**만 바꾼다                 |
| R8  | (2026-09-11, round 3 정정) `DataField.id` 부여가 참조 (문서) 와 정의 (IndexedDB) 의 저장 단위 차이로 비원자적 — 문서만 저장 후 재로드 시 id 재생성 → `{#id}` 템플릿 파손. store 진입 경로가 6곳 + import envelope 이라 한 곳만 부여하면 나머지 경로가 id 없는 schema 를 흘린다 |  MED   | HC7 — store 진입 경계 정규화 함수 1개 (7 경로 전부) + id 없는 collection 은 hydrate 직후 1회 write-back. G4 에 "문서만 저장 → 재로드 → 템플릿 유지" 시나리오 + 정규화 경로 7곳 test (id 없는 schema 가 store 에 들어오는 경우 0)                         |
| R9  | (2026-09-11) `HistoryEntry` 가 element 중심 (`elementId` 필수, `type` 13종) — 데이터 entry 를 억지로 끼우면 undo/redo 경로 (`canonicalEvents` 우선) 가 데이터 entry 를 element 로 해석한다                                                                                     |  MED   | `type:"data"` entry 는 `data.dataChange` 에 역연산 (`inverse: DataOp[]`) 을 담고 undo/redo dispatcher 가 type 으로 먼저 분기 — element 경로에 도달하지 않음을 test 로 고정. 단축키 라우팅 (데이터 패널 포커스 시 데이터 스택) 은 ADR-212 몫              |
| R10 | (2026-09-11) store 단일화가 `BuilderCore.tsx:883,1007,1085` 의 legacy `useDataTableStore` 접근 (dataTableStates · consumers) 을 끊으면 canvas ↔ preview 동기화 (`syncCollectionsToCanvas`) 가 조용히 멈춘다                                                                    |  MED   | Phase 5 를 "소비처 대체 → 대칭 확인 (Skia row 수 == DOM row 수) → 원본 삭제 승인" 3단계로, 삭제는 별도 커밋                                                                                                                                              |
| R11 | (round 3 추가) name 키 Map 재키잉이 `useCollection(name)` 공개 hook · `.get(name)` 6곳 · `syncCollectionsToCanvas` 배열 변환 · rename re-key 를 한 번에 건드린다 — 누락 시 이름으로 찾는 경로가 조용히 `undefined`                                                             |  MED   | Phase 0 에 `.get(`/`.has(`/`useCollection(` 전수 표 · Phase 1 에서 `resolveBoundCollection` 단일 경유 + `collections.get(` 직접 호출 grep 0 가드 · G1 이 rename 후 목록 · 편집기 · 캔버스 3곳 동일 확인                                                  |

잔존 HIGH 위험 없음.

> **R7 종결 (2026-09-11)**: ADR-209 가 preview · publish 양쪽에 `CollectionDataProvider` 를 마운트해 격차 7 이 해소됐다 (`preview/App.tsx:1412` · `apps/publish/src/App.tsx:1`). G2 의 전제는 충족 상태이며 아래 2026-08-17 주의는 이력으로만 남긴다.

> **R7 주의 (2026-08-17)**: 위 "잔존 HIGH 위험 없음" 은 본 ADR 이 **새로 도입하는** 위험 기준이다. 착수 시점에 이미 존재하는 결함(격차 7 — 실데이터 8건 바인딩에서 캔버스 100행 ↔ preview 0행)은 사용자 관점 심각도가 이보다 높다. 재리뷰 시 이 결함을 본 ADR 안에서 처리할지, 선행 수리로 분리할지 판정 대상.

## Gates

| Gate | 시점          | 통과 조건                                                                                                                                                                                                                                                                                                                                                                                                                 | 실패 시 대안                                                                                                           |
| ---- | ------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------- |
| G0   | Phase 0 완료  | legacy 경로 실사용 실측 완료 — `datatableId` / `type:"collection"` 보유 element 0~4건이면 Phase 5 흡수 진행                                                                                                                                                                                                                                                                                                               | 5건+ 이면 Phase 5 에 데이터 마이그레이션 단계 추가 (사용자 확인)                                                       |
| G1   | Phase 1 직후  | 기존 name 기반 바인딩 프로젝트 로드 → collection 렌더 회귀 0 — live builder 1회 exercise                                                                                                                                                                                                                                                                                                                                  | fallback resolve 보강 후 재검증                                                                                        |
| G2   | Phase 3 완료  | **전제(2026-08-17 추가)**: collection DI provider 가 preview 에 마운트되어 `source:"dataTable"` 바인딩이 DOM 에서 행을 산출할 것 (격차 7 / R7). 그 위에서 — ListBox/Table/Select 에 fieldMap 지정 시 Builder Skia ↔ Preview DOM 동일 label/컬럼 — `/cross-check` PASS                                                                                                                                                     | 비대칭 경로 수정 후 재실행. **전제 미충족이면 fieldMap 결함이 아니므로 fieldMap 을 고치지 말 것** — provider 배선 선행 |
| G3   | Phase 6 완료  | publish 된 프로젝트에서 dataTable 바인딩 collection 이 snapshot 데이터 렌더 — 실기동 확인 (provider 는 ADR-209 로 이미 마운트 — 확인 대상은 snapshot 형식뿐)                                                                                                                                                                                                                                                              | snapshot 직렬화 형식 재설계                                                                                            |
| G4   | Phase 1b 완료 | (2026-09-11) 필드 rename live: Users 프리셋 · ListBox `{name}` 템플릿 바인딩 · 차트 시리즈 필드 지정 후 Schema 에서 `name → fullName` — 캔버스 Skia · preview DOM · 차트 모두 값 유지, 템플릿 편집기에 새 이름 표시, 저장 문서에 `fieldId` 기록. 기존 (id 없는) 프로젝트 로드 → id 없는 collection 만 1회 write-back (바인딩 재직렬화 0) → **템플릿만 저장하고 collection 편집 없이 재로드 → 템플릿 유지** (round 3 추가) | id 부여 지점 또는 템플릿 변환기 수정 — **재작성기 추가로 우회 금지** (대안 D 회귀)                                     |
| G5   | Phase 1c 완료 | (2026-09-11) 셀 편집 · 행 삭제 · CSV import · 필드 rename 각 1회 후 `⌘Z` 4회 → 원상, `⌘⇧Z` 4회 → 재적용. History 패널에 data entry 4개, element entry 0개. 요소 편집 entry 와 섞여도 각자 되돌아감                                                                                                                                                                                                                        | undo dispatcher 분기 수정. 데이터 entry 가 element 경로로 들어가면 G5 FAIL                                             |

### Live Exercise

- **G1 (Phase 1, 2026-09-11, headed Playwright `apps/builder/scripts/adr152-p1-live.mjs` — 실제 빌더, 새 프로젝트)**: IndexedDB 에 id 없는 collection 2건을 저장 형태로 시드 → 재로드 시 `DataField.id` 3/3 write-back · 두 번째 재로드 write 0 (`updated_at` 무변경) · v1 name 바인딩 ListBox 가 Skia 행 5 투영 (회귀 0) · Inspector 편집 commit 이 `collectionId` 를 기록 (Roles 2행 → Users 5행) · v1 바인딩도 Inspector 선택 표시 · IndexedDB 에서 rename (Users → People) 후 재로드해도 v2 바인딩 행 5 유지 + Inspector 새 이름 표시 · page error 0 — 10/10 PASS. DOM leg: `packages/shared/src/components/chart/collection{Runtime,Api}.browser.test.tsx` (browser vitest, `useCollectionData` v1 dataTable 바인딩 + `CollectionDataProvider`) 6/6.
- **G4 (Phase 1b, 2026-09-11, headed Playwright `apps/builder/scripts/adr152-p1b-live.mjs` — 실제 빌더 + Preview iframe compare 모드)**: id 없는 Users (4 필드 · 3행) 시드 → write-back 4/4 · ListBox 인스턴스 v2 바인딩 + Bar Chart `dimension/metric = #id` · Properties 에서 seed label 템플릿을 `{name} <{email}>` 로 편집 → 문서 `{#name} <{#email}>` (편집기는 이름 표시) · Preview DOM 행 `User 1 <u1@x.test>` · 차트 범주 `User 1..3` · 템플릿만 저장 후 재로드 → 저장형 유지 · `name → fullName` rename (저장 형태, 행 migrate) + 재로드 → Skia 행 3 · Preview 행 · 차트 범주 값 유지 · 편집기 `{fullName}` 표시 · 저장형 불변 · page error 0 — 14/14 PASS. 대조군 2 (key 참조 차트 · 이름 문법 템플릿) 동시 PASS. 범위 밖 발견: publish 런타임은 ref ListBox 의 master slot 템플릿을 이름 문법에서도 미보간 (기존, Phase 6 에서).
- **G5 (Phase 1c, 2026-09-11, headed Playwright `apps/builder/scripts/adr152-p1c-live.mjs` — 실제 빌더 Data 패널 편집기)**: id 없는 Users (4 필드 · 3행) 시드 → 편집기에서 셀 편집 (Table 탭 1행 name) · 행 삭제 (3행) · CSV import (2행 교체, `input[type=file]`) · 필드 rename (Schema 탭 name → fullName) 각 1회 → IndexedDB `collections` 가 매 편집마다 반영 · History 패널 data entry 4 (`Edit cell` · `Delete rows (1)` · `Replace data (2 rows)` · `Rename field — name → fullName`) / element entry 0 → `⌘Z` × 4 → IndexedDB 원상 (rows 3 · `User 1` · key `name` · schema 열 순서 유지) + 편집기 key 입력 `name` → `⌘⇧Z` × 4 → 재적용 (rows 2 · `Csv One` · `fullName`) → ListBox 팔레트 추가 (element `add` entry) 를 섞어 `⌘Z` × 5 → 요소 1 제거 + 데이터 원상, `⌘⇧Z` × 5 → 요소 복귀 + 데이터 재적용 · page error 0 — 14/14 PASS. R9 (element 경로 미도달) 는 `historyActions.data.test.ts` 가 `applyCanonicalHistoryEventsToActiveDocument` 미호출로 고정.
- **Phase 2 (2026-09-11, headed Playwright `apps/builder/scripts/adr152-p2-live.mjs` — 실제 Properties 패널)**: Users (4 필드 · id write-back) 시드 → ListBox 인스턴스 선택 → collection 미선택 시 fieldMap 행 0 → Users 선택 → value · icon Select 2행 (초기 `Auto`) → `id` 선택 → 문서 `fieldMap.value = <fieldId>` (key 아님) → `avatar` → `fieldMap.icon = <fieldId>` · Select 표시 `Value field: id` → icon `Auto` → fieldMap 에서 icon 제거 → IndexedDB 에서 `id → uid` rename + 재로드 → Select 표시 `uid` · 저장 fieldMap 불변 · page error 0 — 10/10 PASS. (fieldMap 소비 = Phase 3, G2)
- **G2 (Phase 3, 2026-09-11, headed Playwright `apps/builder/scripts/adr152-p3-live.mjs` — 실제 빌더 + Preview iframe compare 모드)**: Users (id · uid · name · glyph · photo, 3행) 시드 → ListBox · Select · Table 팔레트 추가 + v2 바인딩 `fieldMap { value: <uid id>, icon: <glyph id> }` → Skia ListBox 행 key (`projection:listbox-row:<id>:<itemKey>`) `U-1..3` = Preview DOM `data-key` · Select DOM option value `U-1..3` · Table Skia 행 key `U-1..3` + DOM `aria-rowcount` 3 · master slot 템플릿 `{label} [{icon}] {value}` → DOM 행 `User 1 [star] U-1` (icon 역할 glyph 컬럼) · icon 을 이미지 컬럼으로 → `{icon}` 빈 문자열 (avatar slot 몫) · `uid → userId` rename + 재로드 → 양 leg key 유지 (fieldId 참조) · 대조군 (fieldMap 없음) 양 leg `auto-1..3` (`id` 컬럼 휴리스틱) · page error 0 — 9/9 PASS. 아이콘 slot 자체는 팔레트 ListBox master 가 구성하지 않아 두 leg 다 안 그린다 (대칭) — 역할 소비는 가상 필드 · itemKey 로 잰다.
- **Table 정렬 후속 (2026-09-11, `adr152-p3-live.mjs` 재실행 10/10 + `adr152-p4-live.mjs` 12/12)**: Table DOM wrapper 를 `useResolvedCollectionItems` 로 정렬 → Preview DOM `tr.react-aria-Row[data-key]` = `U-1..3` = Skia 행 key (fieldMap value) · rename 후 유지 · page error 0. 첫 실행은 1/10 — hook rows memo 가 `reload` identity 에 묶여 Table 의 컬럼 자동 감지 setState 와 무한 루프 ("Maximum update depth exceeded") → rows memo 분리 후 10/10.
- **Phase 4 sweep (2026-09-11, headed Playwright `apps/builder/scripts/adr152-p4-live.mjs` — 실제 빌더 + Preview iframe compare 모드)**: Users (id · uid · name · title · glyph, 3행) 시드 → Breadcrumbs · ComboBox · GridList · Menu · Tabs · TagGroup · Tree 팔레트 추가 + 같은 v2 바인딩 `fieldMap { value: <uid id>, icon: <glyph id> }` → Skia 투영 행 key (gridlist · tag · breadcrumb) `U-1..3` · Preview DOM key GridList · TagGroup · Tabs · Menu (popover 열어) · ComboBox (popover 열어) · Tree `U-1..3` · Breadcrumbs 라벨 `User 1..3` (li 는 key 미노출) · page error 0 — 12/12 PASS. sweep 이 잡은 결함: TagGroup DOM 이 raw `id` 로 정규화 key 를 덮어 `auto-1..3` (Skia 는 `U-1..3`) → spread 순서 수리 후 대칭.
- **Phase 5 (2026-09-11, headed Playwright `apps/builder/scripts/adr152-p5-live.mjs` — 실제 빌더)**: Users 시드 → Data 패널 목록 `Users` (store fetch) → IndexedDB 에 직접 넣은 `Roles` 가 새로고침 버튼 (store fetch 만, React Query 제거) 으로 목록에 · 로딩 오버레이 해제 → ListBox 에 legacy `{ type:"collection", config:{ collectionId, name } }` 바인딩 → v2 정규화되어 Skia 행 `u1..3` = Preview DOM 행 → v2 바인딩 회귀 0 · page error 0 — 6/6 PASS.
- **G3 (Phase 6, 2026-09-11, headed Playwright `apps/builder/scripts/adr152-p6-live.mjs` — 실제 빌더 헤더 Preview → publish 탭)**: Users (id · uid · name · email, 3행) 시드 → ListBox · Table v2 바인딩 + `fieldMap { value: <uid id> }` → publish 탭에서 sessionStorage snapshot 의 collections 키가 `{ id, name, schema, mockData, useMockData }` (runtimeData · project_id · created_at 없음) · schema id 4/4 · ListBox 행 3 `data-key` `U-1..3` · Table `aria-rowcount` 3 + 셀 `User 1` 등 snapshot 값 · page error 0 — 5/5 PASS. 정보: ref ListBox master slot 템플릿은 publish 에서 미보간 (1b 격차 유지 — 원인 publish App 의 ref 미확장, 범위 밖).

## Consequences

### Positive

- DataTable rename 이 바인딩을 파손하지 않음 (`collectionId` 안정 참조) — Data 패널 편집 자유도 확보.
- 사용자가 schema 컬럼을 역할별(label/value/description/icon)로 매핑 가능 — 휴리스틱 의존 제거, Inspector `PropertyDataBinding` UX 완결.
- 읽기 경로가 `useCollectionData` + `resolveBoundCollection` 단일 계약으로 수렴 — 신규 collection 컴포넌트 추가 비용 감소.
- 배포 앱(publish)에서 바인딩된 collection 이 실제 데이터를 렌더 — 빌더→배포 연동 완결 (ADR-132 W4 해소).
- (2026-09-11) 필드 이름 변경이 템플릿 · fieldMap · 차트 · targetCollection 을 파손하지 않음 (`fieldId`). 데이터 편집 · import 가 `⌘Z` 로 돌아옴. ADR-212/213/214 가 같은 `DataChange` 적용기를 진입점으로 씀.

### Negative

- 전환기 동안 id/name 이중 resolve 코드 유지 (`resolveBoundCollection` 내부로 국소화).
- `PropertyDataBinding` v2 필드 추가로 binding 계약 문서화 부담 (`.claude/rules/state-management.md` §Collections read 진입점 갱신 필요).
- (2026-09-11) `{field}` 템플릿이 사용자 문법 (이름) 과 저장형 (id) 으로 갈려 변환기 1개를 유지해야 한다. `HistoryEntry` 에 데이터 타입이 추가돼 undo/redo dispatcher 가 2분기가 된다.
- publish payload 에 data snapshot 이 추가되어 배포 산출물 크기 증가 (mockData 규모에 비례 — schema+mockData 한정으로 상한 관리).
