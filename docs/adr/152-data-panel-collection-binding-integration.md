# ADR-152: Data 패널 ↔ Collections ↔ 컴포넌트 Collection 바인딩 통합

## Status

Proposed — 2026-07-16

> **개정 2026-07-21 (사용자 confirm — ADR-159 와 경계 재획정)**: 텍스트 표시 축(label/description 컬럼 선택)은 [ADR-159](completed/159-collection-field-template-binding.md)(`{field}` 템플릿 바인딩)로 이관 — 본 ADR 의 fieldMap 은 **비텍스트 역할(icon/value) 한정**으로 축소. 데이터 소스는 ADR-159 의 dataTable 단일 방향(api/variable/route 오소링 표면 제거, 159 P4)을 전제로 개정 — 본 ADR 의 API source 관련 항목(R3, breakdown Phase 6)은 159 G4 게이트 결과에 종속. **scope 변경이므로 착수 전 재리뷰 대상** (기존 round 1 승인은 구 scope 기준).

> **실측 추가 2026-08-17 (scope 무변경 — 근거 보강 + 사실 정정)**: `source:"dataTable"` 바인딩이 **빌더 캔버스에서는 렌더되고 preview 에서는 0행**인 것을 양축 대조로 확인했다 (격차 7). 원인은 `CollectionDataProvider` 가 repo 어디에도 마운트되지 않는 것이고, ADR-132 가 R2/G3-1 로 식별·이연한 바로 그 항목이되 범위가 더 넓다 (`dataTableService` 축 포함, 전 앱). 이에 따라 **Hard Constraint 3(Skia↔DOM 대칭)은 보존 대상이 아니라 복구 대상으로 정정**했고, provider 배선을 Phase 3 선행 조건으로 올렸다 (R7 / G2 전제 / breakdown Phase 3). 대안·Decision·Phase 구성은 변경하지 않았다 — 재리뷰 시 이 결함을 본 ADR 안에서 처리할지 선행 수리로 분리할지가 판정 대상.

## Context

빌더 Data 패널(`panels/datatable/`)에서 정의한 DataTable(collections)과 컴포넌트 collection(ListBox/Table/Select 등 10종 catalog binding)의 연동은 ADR-131(데이터 SSOT = `data_tables` 확정) / ADR-132(read 진입점 `useCollectionData` 단일화)로 골격이 완성됐으나, ADR-132 가 scope 밖으로 명시한 후속 영역(Data 패널 UX / publish 직렬화 / binding 계약 정합)이 미해결로 남아 있다. 본 ADR 은 그 후속으로, 바인딩 계약과 소비 경로를 완결한다.

**Domain 분류**: 본 결정은 **D2(Props/API — `dataBinding` prop 계약)** 중심이며, 데이터 자체의 SSOT 는 3-domain 밖의 데이터 도메인(ADR-131 이 `data_tables` 로 확정)이다. D3 는 소비 대칭(Builder Skia projector ↔ Preview DOM wrapper 가 동일 row/label 산출)으로만 관여하고, D1(RAC DOM/접근성)은 무변경. CSS Generator emit 과 무관한 ADR 이다 (inspector `kind:"binding"` 필드만 관여).

**후속 응용 ADR**: [ADR-013](013-quick-connect-data-binding.md)(Quick Connect — 바인딩 생성 1클릭 UX)은 본 ADR 의 계약 v2 write 경로(`collectionId`+`fieldMap`, `props.dataBinding` 정규화)를 소비하는 응용이며, 본 ADR 완료가 선행 조건이다. 병합 여부는 2026-07-16 사용자 확인으로 **분리 유지** 확정 — 계약 layer(본 ADR)와 UX 자동화 layer(013)는 직교하고, 합치면 실패 시 원인 분리가 불가한 위험 누적 구조가 된다.

**실측 현행 격차 (2026-07-16)**:

1. **name 기반 바인딩 참조** — `useCollectionData.ts:298` 이 `collections.find((dt) => dt.name === propertyBinding.name)` 로 resolve. DataTable rename 시 바인딩이 silent 파손된다. `PropertyDataBinding` 타입(`packages/shared/src/types/collection.types.ts:207-220`)에 id 필드 자체가 없다.
2. **읽기 경로 3중화** — `useCollectionData.ts:202-208` 에 ① `dataBinding`(PropertyDataBinding) ② `datatableId`(legacy `useDataTableStore`, `stores/datatable.ts`) ③ legacy `DataBinding type:"collection"` 세 입력 경로가 공존한다.
3. **column mapping 부재** — item label 이 하드코딩 필드 휴리스틱(`packages/shared/src/collections/resolveCollectionItems.ts:169-176`, `label > textValue > children > name > title > value`)으로만 결정된다. schema 가 `{ email, age }` 인 테이블은 어떤 컬럼을 표시할지 사용자가 선택할 수 없다. → **개정 2026-07-21**: 텍스트 표시(label/description)는 ADR-159 `{field}` 템플릿이 해결(다중 필드+literal 혼합 — 단일 컬럼 fieldMap 으로는 표현 불가가 확인됨). 본 ADR 잔존분은 비텍스트 역할(icon/value) 매핑만.
4. **publish 소비 0건** — `apps/publish/src` 에 collections 소비 코드가 없어, 배포된 앱에서 바인딩된 collection 이 데이터를 렌더하지 못한다 (ADR-132 §scope 경계 W4 지정 영역). → **개정 2026-08-17**: 원인이 publish 고유가 아니다. 아래 격차 7 의 provider 부재가 **preview 에도 동일하게** 걸린다 — publish 는 소비 코드가 없고 preview 는 소비 코드가 있는데 공급자가 없는 형태로, 증상(0행)은 같다.
5. **store 이중화** — `useDataStore`(`stores/data.ts`, Supabase SSOT) 와 `useDataTableStore`(`stores/datatable.ts`, 별도 상태 기계) 공존.
6. **binding 이중 저장 위치** — `getElementDataBinding` 이 `props.dataBinding` 우선 + legacy top-level `element.dataBinding` fallback 의 2 위치를 읽는다 (`apps/builder/src/adapters/canonical/compositionExtensionFields.ts:74-94`). scene projection signature 는 `props` 만 포함하므로 (`buildSceneSnapshot.ts:49-66`) legacy top-level 위치만 가진 요소는 binding 변경이 sceneVersion 에 미감지되는 사각이 있다.
7. **DI provider 부재 → Skia ↔ DOM 대칭이 이미 깨져 있다 (실측 2026-08-17)** — `CollectionDataProvider` / `CollectionDataContext.Provider` 가 **repo 어디에도 렌더되지 않는다** (전 확장자 grep 0건 + `git log -S --all` 결과 2건 모두 ADR 문서의 코드 예시 — 한 번도 마운트된 적 없음). 따라서 `useCollectionDataServices()` 는 항상 context 기본값 `{}` 를 반환하고 `dataTableService` / `apiEndpointService` / `mockApiService` 가 영구히 `undefined` 다. 상세는 아래 §"격차 7 실측 근거".

**격차 7 실측 근거 (2026-08-17, 양축 대조)**

같은 프로젝트(`148ccd1e…`)·같은 바인딩으로 두 축을 실행해 대조했다. 대상 데이터: IndexedDB `collections` 3건(`Users` mock 100행 / `Roles` 5 / `Invitations` 5), 라이브 store 에 `source:"dataTable"` 바인딩 **8건**(전부 `ref` 노드).

| 축                     | 결과                                                                                                                                                                                                      |
| ---------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Skia (빌더 캔버스)** | ✅ 행 투영됨. `projection:listbox-rows:{Users owner}` = 340×**3398px**(100행 분량), `projection:gridlist-rows:{Invitations owner}` = 350×174, `Roles` 는 mock 5건의 **실제 itemKey** 로 row 노드 5/5 존재 |
| **DOM (preview)**      | ❌ 0행. preview 페이지에 React 루트를 띄워 `useCollectionData` 직접 렌더 — `Roles`/`Users` 모두 `rows: 0`, `loading: true`(4초 후에도), `error: null`                                                     |
| 대조군 (`static`)      | ✅ `rows: 3`, `loading: false` — DI 를 안 거치는 경로는 정상. 프로브 자체는 유효                                                                                                                          |

같은 렌더에서 `useCollectionDataServices()` 반환값이 `{}` 임(`serviceKeys: []`)도 함께 관측됐다.

- **Skia 가 되는 이유**: DI 를 안 거친다 — `BuilderCanvas.tsx:234` 가 `useDataStore.collections` 를 직접 읽어 `buildCanonicalSceneModel({ collections, … })` 로 넘긴다 (Hard Constraint 2 가 적어 둔 "별도 경로").
- **DOM 이 안 되는 이유**: `useCollectionData` 의 `source:"dataTable"` 분기는 `collections = dataTableService?.getDataTables() ?? []` 로만 목록을 얻어 항상 `[]` → `find(name)` 이 항상 `undefined`. `source:"api"` 도 `apiEndpoints` 로 동형. **비-DI 우회 경로는 없다**.
- **에러가 아니라 조용한 영구 로딩**이다. `useResolvedCollectionItems` 는 `boundData.length > 0` 로 판정해 정적 `items` 로 폴백하므로 화면에는 단서가 남지 않고, `loading` 은 상위로 그대로 전달돼 이를 소비하는 컴포넌트는 스피너가 멈추지 않는다.
- **선행 ADR 의 기록과 대조**: ADR-132 는 이 위험을 R2 로 식별하고 G3-1 게이트("DI Context 가 Canvas 측 provider 에 주입되어 있음")를 걸었으나 **게이트가 실패했고** 문서화된 대안(분기 잔존 lock-in)을 채택해 후속(=본 ADR)으로 이관했다 (`132-…-breakdown.md:104,254,453`). 즉 회귀가 아니라 **기록된 이연**이다. 다만 그 기록은 범위를 `apiEndpointService` × Canvas 측으로 좁게 적었고, 실측 결과는 (a) provider 자체가 전 앱 부재라 `dataTableService` 축도 포함되며 (b) 캔버스는 되고 DOM 만 안 되는 **비대칭**이라는 점에서 더 넓다.

**Hard Constraints**:

1. **데이터 SSOT = `data_tables`(collections) 유지** — ADR-131 Phase 8 에서 사용자가 확정한 전제 (canonical document 에 `data` root field 미도입). 본 ADR 은 이 경계를 변경하지 않는다.
2. **빌더 DOM RAC collection 의 items read = `useCollectionData` 단일 경유 유지** (ADR-132 Implemented — 원 scope 는 RAC collection 컴포넌트의 items read). Builder Skia 는 scene model 이 collections 를 직접 구독하는 기존 별도 경로(`BuilderCanvas.tsx:197-205`)이고, 본 ADR Phase 6 의 publish read 경로 신설은 이 constraint 의 scope 밖이다 — 단 두 경로 모두 `resolveBoundCollection` / `resolveCollectionItems` shared 계약을 공유해야 한다.
3. **Skia ↔ DOM 대칭** — 동일 collections 스냅샷에서 Builder Skia projection 과 Preview DOM wrapper 가 동일 row/label 을 산출해야 한다 (`/cross-check` 검증 가능). → **정정 2026-08-17**: 이 제약은 **보존 대상이 아니라 복구 대상**이다. 격차 7 실측대로 `source:"dataTable"` 에서 이미 깨져 있다 (Skia 100행 ↔ DOM 0행). 따라서 Decision §선택 근거 2 의 "D3 대칭을 **구조적으로 보존**" 은 fieldMap 축에 한해 성립하는 서술이고, 대칭 자체는 provider 배선으로 **먼저 복구**되어야 그 위에서 유효하다.
4. **하위 호환** — 저장된 name 기반 `dataBinding` 을 가진 기존 프로젝트는 로드만으로 파손 0건이어야 한다 (lazy resolve — 로드 시점 재직렬화 0 파일, 저장 시에만 upgrade).
5. **성능** — collections 변경 → scene rebuild 는 기존 구독 구조(`BuilderCanvas.tsx:197-205` useMemo) 유지. pointer hot path 에 데이터 resolve 추가 금지 (60fps 기준).

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
  - 마이그레이션: **H** — 기존 프로젝트 전수의 `data_tables` → document 이관 + Supabase 스키마 이중화 기간. 무엇보다 ADR-131 Phase 8 에서 **사용자가 명시 revert 로 확정한 전제(데이터 SSOT = `data_tables`)를 반전**시키는 SSOT 경계 재판정이라, 확정 전제의 재개 조건(사용자 재제기/scope 변경/코드 증거) 없이 채택 불가

### Risk Threshold Check

| 대안 | 기술 | 성능 | 유지보수 | 마이그레이션 | HIGH+ 개수 |
| ---- | :--: | :--: | :------: | :----------: | :--------: |
| A    |  L   |  L   |  **H**   |      L       |     1      |
| B    |  M   |  L   |    L     |      M       |     0      |
| C    |  M   |  L   |    M     |    **H**     |     1      |

루프 판정: 대안 B 가 HIGH 0 으로 존재 — 추가 대안 탐색 불필요.

## Decision

**대안 B: id 참조 바인딩 계약 v2 + fieldMap + 읽기 경로 일원화 + publish 직렬화**를 선택한다.

선택 근거:

1. 잔존 위험이 기술 M / 마이그레이션 M 뿐이며, 둘 다 단일 resolve 헬퍼와 lazy upgrade(로드 시 재직렬화 0 파일, 기존 프로젝트 파손 0)로 국소화된다.
2. `resolveCollectionItems` 단일 계약을 Skia projector 전체와 DOM wrapper 7/10 이 이미 공유하고, fieldMap 은 dataBinding 에 실려 projection rows 입력으로 이미 전달되므로(`getFlatProjectionRows({collections, dataBinding, props})`) shared 함수 내부 소비 시 기존 호출부 변경이 0 에 수렴한다 — D3 대칭(Hard Constraint 3)을 구조적으로 보존. raw 소비 잔여 3종(Table/Tree/Tabs DOM wrapper — `Table.tsx:206`/`Tree.tsx:93`/`Tabs.tsx:124`)은 Phase 3/4 에서 shared 계약 경유로 정렬한다.
3. ADR-131(데이터 SSOT)·ADR-132(read 진입점) 의 확정 전제를 그대로 준수하면서 그 위의 미완 영역만 채운다.

기각 사유:

- **대안 A 기각**: rename 파손과 3중 경로가 영구 잔존해 유지보수 HIGH. "연동" 의 사용자 완결점(배포 앱에서 데이터가 보임)을 달성하지 못한다.
- **대안 C 기각**: ADR-131 Phase 8 에서 사용자가 확정한 데이터 SSOT 전제를 반전시키는 SSOT 경계 재판정(전제 확정 종결 계약의 재개 조건 미충족)이며, 그 이득(publish 직렬화 단순화)은 대안 B 의 snapshot 직렬화로 동등하게 달성 가능하다. 마이그레이션 비용도 HIGH.

> 구현 상세: [152-data-panel-collection-binding-integration-breakdown.md](design/152-data-panel-collection-binding-integration-breakdown.md)

## Risks

| ID  | 위험                                                                                                                        | 심각도 | 대응                                                                                                                                                                                                                                                     |
| --- | --------------------------------------------------------------------------------------------------------------------------- | :----: | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| R1  | id/name 이중 resolve 전환기에 기존 name 바인딩 프로젝트 회귀                                                                |  MED   | `resolveBoundCollection` 단일 헬퍼 (id 우선 + name fallback) + 직접 `name` find 패턴 grep 가드 + G1 live 확인                                                                                                                                            |
| R2  | fieldMap 을 Skia projector / DOM wrapper 중 한쪽만 반영해 label 비대칭                                                      |  MED   | fieldMap 소비를 shared 함수 내부(dataBinding 이 이미 projection rows 입력에 포함)로 한정해 기존 호출부 변경 0 유지 + raw 소비 3종(Table/Tree/Tabs DOM)은 Phase 3/4 에서 shared 계약 경유로 정렬 + G2 `/cross-check`                                      |
| R3  | publish data snapshot 형식 결정 부담 (runtimeData 포함 여부 / API source 처리)                                              |  MED   | snapshot = schema + mockData 한정 (runtimeData 제외). ~~API 는 publish 런타임 직접 fetch~~ → 개정 2026-07-21: ADR-159 dataTable 단일 방향 — API source 오소링 제거(159 P4) 확정 시 publish 는 collections snapshot 만 소비, 본 항목은 159 G4 결과에 종속 |
| R4  | legacy 경로(datatableId / `type:"collection"`) 실사용 존재 시 제거 파손                                                     |  MED   | Phase 0 실측 → G0 조건부 (0~4건 흡수 / 5건+ 마이그레이션 단계 확장). `useDataTableStore` 제거는 원본 삭제 승인 규칙 준수                                                                                                                                 |
| R5  | 10 컴포넌트 일괄 반영 중 scope inflation                                                                                    |  LOW   | 대표 3종(ListBox/Table/Select) 선행 검증 후 패밀리 sweep — Phase 3/4 분리                                                                                                                                                                                |
| R6  | legacy top-level `element.dataBinding` 저장 위치 잔존 시 scene signature 사각 (격차 6) — binding 변경이 sceneVersion 미감지 |  MED   | Phase 1 lazy upgrade 시 write 를 `props.dataBinding` 단일 위치로 정규화 (top-level 은 read fallback 만 유지) + Phase 0 에서 top-level 보유 element 실측                                                                                                  |

| R7 | **DI provider 부재(격차 7)로 D3 대칭이 착수 시점에 이미 깨져 있음** — fieldMap 을 아무리 정확히 전달해도 DOM 쪽은 행이 0이라 G2 `/cross-check` 가 fieldMap 과 무관한 이유로 실패한다 (추가 2026-08-17) | MED | provider 배선을 **Phase 3 선행 조건**으로 승격 — G2 통과 조건에 전제 명시. 심각도를 HIGH 로 두지 않는 이유: 본 ADR 이 도입하는 위험이 아니라 ADR-132 가 기록·이연한 선행 결함이고, 설계(대안 B)의 정합성이 아니라 **작업 순서**만 바꾼다 |

잔존 HIGH 위험 없음.

> **R7 주의 (2026-08-17)**: 위 "잔존 HIGH 위험 없음" 은 본 ADR 이 **새로 도입하는** 위험 기준이다. 착수 시점에 이미 존재하는 결함(격차 7 — 실데이터 8건 바인딩에서 캔버스 100행 ↔ preview 0행)은 사용자 관점 심각도가 이보다 높다. 재리뷰 시 이 결함을 본 ADR 안에서 처리할지, 선행 수리로 분리할지 판정 대상.

## Gates

| Gate | 시점         | 통과 조건                                                                                                                                                                                                                                                             | 실패 시 대안                                                                                                           |
| ---- | ------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------- |
| G0   | Phase 0 완료 | legacy 경로 실사용 실측 완료 — `datatableId` / `type:"collection"` 보유 element 0~4건이면 Phase 5 흡수 진행                                                                                                                                                           | 5건+ 이면 Phase 5 에 데이터 마이그레이션 단계 추가 (사용자 확인)                                                       |
| G1   | Phase 1 직후 | 기존 name 기반 바인딩 프로젝트 로드 → collection 렌더 회귀 0 — live builder 1회 exercise                                                                                                                                                                              | fallback resolve 보강 후 재검증                                                                                        |
| G2   | Phase 3 완료 | **전제(2026-08-17 추가)**: collection DI provider 가 preview 에 마운트되어 `source:"dataTable"` 바인딩이 DOM 에서 행을 산출할 것 (격차 7 / R7). 그 위에서 — ListBox/Table/Select 에 fieldMap 지정 시 Builder Skia ↔ Preview DOM 동일 label/컬럼 — `/cross-check` PASS | 비대칭 경로 수정 후 재실행. **전제 미충족이면 fieldMap 결함이 아니므로 fieldMap 을 고치지 말 것** — provider 배선 선행 |
| G3   | Phase 6 완료 | publish 된 프로젝트에서 dataTable 바인딩 collection 이 snapshot 데이터 렌더 — 실기동 확인                                                                                                                                                                             | snapshot 직렬화 형식 재설계                                                                                            |

## Consequences

### Positive

- DataTable rename 이 바인딩을 파손하지 않음 (`collectionId` 안정 참조) — Data 패널 편집 자유도 확보.
- 사용자가 schema 컬럼을 역할별(label/value/description/icon)로 매핑 가능 — 휴리스틱 의존 제거, Inspector `PropertyDataBinding` UX 완결.
- 읽기 경로가 `useCollectionData` + `resolveBoundCollection` 단일 계약으로 수렴 — 신규 collection 컴포넌트 추가 비용 감소.
- 배포 앱(publish)에서 바인딩된 collection 이 실제 데이터를 렌더 — 빌더→배포 연동 완결 (ADR-132 W4 해소).

### Negative

- 전환기 동안 id/name 이중 resolve 코드 유지 (`resolveBoundCollection` 내부로 국소화).
- `PropertyDataBinding` v2 필드 추가로 binding 계약 문서화 부담 (`.claude/rules/state-management.md` §Collections read 진입점 갱신 필요).
- publish payload 에 data snapshot 이 추가되어 배포 산출물 크기 증가 (mockData 규모에 비례 — schema+mockData 한정으로 상한 관리).
