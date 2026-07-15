# ADR-152: Data 패널 ↔ Collections ↔ 컴포넌트 Collection 바인딩 통합

## Status

Proposed — 2026-07-16

## Context

빌더 Data 패널(`panels/datatable/`)에서 정의한 DataTable(collections)과 컴포넌트 collection(ListBox/Table/Select 등 10종 catalog binding)의 연동은 ADR-131(데이터 SSOT = `data_tables` 확정) / ADR-132(read 진입점 `useCollectionData` 단일화)로 골격이 완성됐으나, ADR-132 가 scope 밖으로 명시한 후속 영역(Data 패널 UX / publish 직렬화 / binding 계약 정합)이 미해결로 남아 있다. 본 ADR 은 그 후속으로, 바인딩 계약과 소비 경로를 완결한다.

**Domain 분류**: 본 결정은 **D2(Props/API — `dataBinding` prop 계약)** 중심이며, 데이터 자체의 SSOT 는 3-domain 밖의 데이터 도메인(ADR-131 이 `data_tables` 로 확정)이다. D3 는 소비 대칭(Builder Skia projector ↔ Preview DOM wrapper 가 동일 row/label 산출)으로만 관여하고, D1(RAC DOM/접근성)은 무변경. CSS Generator emit 과 무관한 ADR 이다 (inspector `kind:"binding"` 필드만 관여).

**실측 현행 격차 (2026-07-16)**:

1. **name 기반 바인딩 참조** — `useCollectionData.ts:298` 이 `collections.find((dt) => dt.name === propertyBinding.name)` 로 resolve. DataTable rename 시 바인딩이 silent 파손된다. `PropertyDataBinding` 타입(`packages/shared/src/types/collection.types.ts:207-220`)에 id 필드 자체가 없다.
2. **읽기 경로 3중화** — `useCollectionData.ts:202-208` 에 ① `dataBinding`(PropertyDataBinding) ② `datatableId`(legacy `useDataTableStore`, `stores/datatable.ts`) ③ legacy `DataBinding type:"collection"` 세 입력 경로가 공존한다.
3. **column mapping 부재** — item label 이 하드코딩 필드 휴리스틱(`packages/shared/src/collections/resolveCollectionItems.ts:169-176`, `label > textValue > children > name > title > value`)으로만 결정된다. schema 가 `{ email, age }` 인 테이블은 어떤 컬럼을 표시할지 사용자가 선택할 수 없다.
4. **publish 소비 0건** — `apps/publish/src` 에 collections 소비 코드가 없어, 배포된 앱에서 바인딩된 collection 이 데이터를 렌더하지 못한다 (ADR-132 §scope 경계 W4 지정 영역).
5. **store 이중화** — `useDataStore`(`stores/data.ts`, Supabase SSOT) 와 `useDataTableStore`(`stores/datatable.ts`, 별도 상태 기계) 공존.

**Hard Constraints**:

1. **데이터 SSOT = `data_tables`(collections) 유지** — ADR-131 Phase 8 에서 사용자가 확정한 전제 (canonical document 에 `data` root field 미도입). 본 ADR 은 이 경계를 변경하지 않는다.
2. **read 진입점 = `useCollectionData` 단일 경유** (ADR-132 Implemented) — 신규 소비 경로를 추가하지 않는다.
3. **Skia ↔ DOM 대칭** — 동일 collections 스냅샷에서 Builder Skia projection 과 Preview DOM wrapper 가 동일 row/label 을 산출해야 한다 (`/cross-check` 검증 가능).
4. **하위 호환** — 저장된 name 기반 `dataBinding` 을 가진 기존 프로젝트는 로드만으로 파손 0건이어야 한다 (lazy resolve — 로드 시점 재직렬화 0 파일, 저장 시에만 upgrade).
5. **성능** — collections 변경 → scene rebuild 는 기존 구독 구조(`BuilderCanvas.tsx:197-205` useMemo) 유지. pointer hot path 에 데이터 resolve 추가 금지 (60fps 기준).

**Soft Constraints**:

- `resolveCollectionItems` 단일 계약(ADR-912 영역 B)이 이미 Skia/DOM 양쪽에서 소비되고 있어, 매핑 확장 지점이 구조적으로 준비되어 있다.
- Data 패널에 `ColumnSelector` 등 schema UI 자산이 기존재 — 재사용 가능.

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

- 설명: `PropertyDataBinding` 에 `collectionId`(안정 참조) + `fieldMap`(label/value/description/icon 역할별 컬럼 매핑)을 additive 확장. resolve 는 id 우선 + name fallback 단일 헬퍼로 통일. fieldMap 은 `resolveCollectionItems` 에 주입하고 기존 휴리스틱은 fallback 으로 격하 (Skia/DOM 이 같은 함수를 소비하므로 대칭 자동 유지). legacy 경로(datatableId / `type:"collection"`)는 실사용 실측 후 조건부 흡수. publish 시 data snapshot(schema+mockData) 직렬화 + publish 앱이 동일 shared 계약으로 소비.
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
2. `resolveCollectionItems` 단일 계약을 Skia/DOM 이 이미 공유하므로, fieldMap 확장이 D3 대칭(Hard Constraint 3)을 구조적으로 보존한다 — 별도 동기화 코드가 늘지 않는다.
3. ADR-131(데이터 SSOT)·ADR-132(read 진입점) 의 확정 전제를 그대로 준수하면서 그 위의 미완 영역만 채운다.

기각 사유:

- **대안 A 기각**: rename 파손과 3중 경로가 영구 잔존해 유지보수 HIGH. "연동" 의 사용자 완결점(배포 앱에서 데이터가 보임)을 달성하지 못한다.
- **대안 C 기각**: ADR-131 Phase 8 에서 사용자가 확정한 데이터 SSOT 전제를 반전시키는 SSOT 경계 재판정(전제 확정 종결 계약의 재개 조건 미충족)이며, 그 이득(publish 직렬화 단순화)은 대안 B 의 snapshot 직렬화로 동등하게 달성 가능하다. 마이그레이션 비용도 HIGH.

> 구현 상세: [152-data-panel-collection-binding-integration-breakdown.md](design/152-data-panel-collection-binding-integration-breakdown.md)

## Risks

| ID  | 위험                                                                           | 심각도 | 대응                                                                                                                          |
| --- | ------------------------------------------------------------------------------ | :----: | ----------------------------------------------------------------------------------------------------------------------------- |
| R1  | id/name 이중 resolve 전환기에 기존 name 바인딩 프로젝트 회귀                   |  MED   | `resolveBoundCollection` 단일 헬퍼 (id 우선 + name fallback) + 직접 `name` find 패턴 grep 가드 + G1 live 확인                 |
| R2  | fieldMap 을 Skia projector / DOM wrapper 중 한쪽만 반영해 label 비대칭         |  MED   | 주입 지점을 `resolveCollectionItems` 옵션 단일 계약으로 한정 (호출부 2곳) + G2 `/cross-check`                                 |
| R3  | publish data snapshot 형식 결정 부담 (runtimeData 포함 여부 / API source 처리) |  MED   | snapshot = schema + mockData 한정 (runtimeData 제외), API 는 publish 런타임 직접 fetch — Phase 0 인벤토리로 확정 후 G3 실기동 |
| R4  | legacy 경로(datatableId / `type:"collection"`) 실사용 존재 시 제거 파손        |  MED   | Phase 0 실측 → G0 조건부 (0~4건 흡수 / 5건+ 마이그레이션 단계 확장). `useDataTableStore` 제거는 원본 삭제 승인 규칙 준수      |
| R5  | 10 컴포넌트 일괄 반영 중 scope inflation                                       |  LOW   | 대표 3종(ListBox/Table/Select) 선행 검증 후 패밀리 sweep — Phase 3/4 분리                                                     |

잔존 HIGH 위험 없음.

## Gates

| Gate | 시점         | 통과 조건                                                                                                   | 실패 시 대안                                                     |
| ---- | ------------ | ----------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------- |
| G0   | Phase 0 완료 | legacy 경로 실사용 실측 완료 — `datatableId` / `type:"collection"` 보유 element 0~4건이면 Phase 5 흡수 진행 | 5건+ 이면 Phase 5 에 데이터 마이그레이션 단계 추가 (사용자 확인) |
| G1   | Phase 1 직후 | 기존 name 기반 바인딩 프로젝트 로드 → collection 렌더 회귀 0 — live builder 1회 exercise                    | fallback resolve 보강 후 재검증                                  |
| G2   | Phase 3 완료 | ListBox/Table/Select 에 fieldMap 지정 시 Builder Skia ↔ Preview DOM 동일 label/컬럼 — `/cross-check` PASS   | 비대칭 경로 수정 후 재실행                                       |
| G3   | Phase 6 완료 | publish 된 프로젝트에서 dataTable 바인딩 collection 이 snapshot 데이터 렌더 — 실기동 확인                   | snapshot 직렬화 형식 재설계                                      |

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
