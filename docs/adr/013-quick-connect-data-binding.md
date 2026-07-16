# ADR-013: Quick Connect — Collection 컴포넌트 데이터 바인딩 자동화

## Status

Proposed — 2026-03-02 (원문) / **2026-07-16 Risk-First 재작성** (reviews/013.md round 1 반영 — legacy 형식 + stale 전제 7건 정정)

> **선행 의존 (2026-07-16 확정)**: [ADR-152](152-data-panel-collection-binding-integration.md)(바인딩 계약 v2 — `collectionId`+`fieldMap`, `props.dataBinding` 정규화) 완료가 착수 조건이다 (Hard Constraint 1 + R1/G0). ADR-152 로의 병합 여부는 2026-07-16 사용자 확인으로 **분리 유지** 확정 (계약 layer ↔ UX 자동화 layer 직교).

## Context

Collection 컴포넌트(ListBox, Select, ComboBox, GridList, Menu, Table)에 데이터를 연결하려면 3단계 수동 작업이 필요하다: ① Data 패널에서 DataTable 수동 생성 → ② Inspector 의 binding 필드(`GenericFieldRenderer` `case "binding"` → `PropertyDataBinding`)에서 소스/테이블 수동 선택 → ③ (Table/ListBox) 컬럼/필드 자동 생성 파이프라인 트리거 대기. 동시에 factory 가 의미 없는 정적 아이템(Item 1, 2, 3)을 기본 생성해 초보 사용자를 혼란시킨다. 본 ADR 은 이 흐름을 **preset 기반 1클릭 Quick Connect** (DataTable 생성 + 바인딩 자동 기록)로 자동화한다.

**업계 표준 분석** (원문 2026-03-02 리서치 — 대안 평가 근거):

| 빌더                   |  데이터 소스 자동 생성   | 삭제 시 데이터 | 패턴                     |
| ---------------------- | :----------------------: | :------------: | ------------------------ |
| Webflow                |            ❌            |      유지      | 기존 CMS Collection 선택 |
| Retool                 |       ❌ (데모만)        |      유지      | 쿼리 기반 느슨 결합      |
| Framer                 |            ❌            |      유지      | CMS Collection 선택      |
| Bubble.io              |            ❌            |      유지      | Type + 쿼리 2단계        |
| **composition (제안)** | **Quick Connect로 생성** |    **유지**    | **Preset 기반 1클릭**    |

**Domain 분류**: 본 결정은 빌더 도구 UX 기능으로, `dataBinding` prop 계약은 **D2 (ADR-152 관할 — 본 ADR 은 그 계약의 write consumer)** 이며 신규 계약을 도입하지 않는다. factory 기본 아이템 제거는 **D3 시각 결과 변경** (빈 collection 의 기본 상태) — Builder Skia ↔ Preview DOM 의 빈 상태 대칭 유지 의무 (Hard Constraint 4). D1 (RAC DOM/접근성) 은 무변경 — React Aria Dynamic Collections (`items` prop + render function) 표준 경로를 그대로 사용하고, `dataBinding` → `useCollectionData` → `items` 가 이 패턴의 기존 구현이다.

**실측 현행 표면 (2026-07-16 재검증 — 원문 2026-03 인용 중 소멸분 정정)**:

- **소멸**: PixiListBox/PixiList (ADR-900), 컴포넌트당 spec placeholder (ADR-142 — `packages/specs/src/components/` 는 Frame/Group/Slot 3개만), 컴포넌트별 에디터 5종 (`ListBox/Select/ComboBox/GridList/MenuEditor` — `TableEditor.tsx` 만 잔존)
- **생존 (재사용 자산)**: preset 시스템 (`panels/datatable/presets/` — `DATATABLE_PRESETS`/`PRESET_CATEGORIES`/`getPresetsByCategory`, `DataTablePreset.schema: DataField[]` + `generateSampleData`), `stores/data.ts` `createDataTable`, Inspector binding 표면 (`GenericFieldRenderer.tsx:187` `case "binding"` → `PropertyDataBinding`), Popover+검색 UI 참조 패턴 (`panels/events/pickers/ActionTypePicker.tsx`)
- **형태 변경 (Phase 0 재확정 대상)**: `ADD_COLUMN_ELEMENTS`/`ADD_FIELD_ELEMENTS` handler 는 `enqueuePreviewGeneratedElements` 큐 경유 (`useIframeMessenger.ts:767/786`), `TableRenderer` 컬럼 생성 캐시 clear 는 per-table prefix + source 포함 키 삭제 방식으로 재작성됨 (`TableRenderer.tsx:143-159`)
- **여전히 유효한 작업 대상**: factory 기본 아이템 잔존 (`SelectionComponents.ts` ListBoxItem/GridListItem, `NavigationComponents.ts` MenuItem), `renderEmptyState` 는 `TagGroup.tsx` 만 보유 — 대상 6종 전부 미보유

**Hard Constraints**:

1. **ADR-152 계약 v2 준수** — Quick Connect 가 기록하는 바인딩은 `collectionId` + `fieldMap` 형식이어야 하며, name 기반 v1 바인딩을 신규 생산하지 않는다. **착수 조건 = ADR-152 Implemented** (G0).
2. **데이터 독립성** — 컴포넌트 삭제 시 DataTable 보존 (업계 5/5 공통 패턴). 기존 프로젝트 데이터 파손 0건.
3. **기존 수동 경로 무손상** — `PropertyDataBinding` 수동 바인딩 + 바인딩 제거 흐름은 그대로 유지, Quick Connect 는 additive.
4. **빈 상태 Skia ↔ DOM 대칭** — factory 기본 아이템 제거 후 빈 collection 6종의 Builder Skia 렌더와 Preview DOM 렌더 (empty state) 가 시각적으로 동일해야 한다 (`/cross-check` 검증 가능).
5. **1클릭 완결** — Quick Connect 실행 후 사용자 추가 수동 단계 0 (Table 의 Column 생성 포함). 실패 시 orphan DataTable / 파손 바인딩 0건 (롤백).

**Soft Constraints**:

- preset 자산(스키마 + 샘플 데이터 생성기)이 이미 존재해 Quick Connect 는 UI + hook 결선만 추가하면 된다.
- preset 은 schema 를 알고 있으므로 ADR-152 의 `fieldMap` 을 생성 시점에 자동 채울 수 있다 (label/description 역할 컬럼 추정) — 수동 매핑 단계 생략.

## Alternatives Considered

### 대안 A: 현행 수동 3단계 유지 (+ 온보딩 문서만 보강)

- 설명: 코드 무변경. Data 패널 → Inspector 바인딩 → 파이프라인 트리거의 기존 흐름을 문서/툴팁으로 안내.
- 근거: 최소 변경. 수동 경로 자체는 동작 검증됨.
- 위험:
  - 기술: L — 변경 없음
  - 성능: L — 변경 없음
  - 유지보수: **H** — 초보 온보딩 격차 + factory 정적 아이템(Item 1, 2, 3) 혼란 영구 잔존. 업계 비교 (Context 표) 대비 UX 열위 지속
  - 마이그레이션: L — 없음

### 대안 B: Quick Connect — preset 기반 1클릭 (DataTable 생성 + v2 바인딩 자동 기록)

- 설명: Inspector binding 표면에 Quick Connect 버튼 추가 → preset 선택 (또는 빈 테이블) → `createDataTable` + ADR-152 v2 바인딩(`collectionId`+`fieldMap` 자동 채움) 기록. factory 기본 아이템 제거 + 6종 empty state ("데이터를 연결하세요") 추가. 데이터 흐름은 기존 `useCollectionData` → Dynamic Collections 경로 그대로.
- 근거: Context 업계 표준 분석 — preset 기반 생성은 5개 빌더 어디에도 없는 차별점이되, 삭제 시 데이터 유지(느슨 결합)는 5/5 공통 패턴을 따른다. 재사용 자산(preset/store/Inspector 표면) 전부 생존 실측.
- 위험:
  - 기술: M — Table 컬럼 생성 캐시/큐 파이프라인이 재작성되어 있어 재연결 시나리오 재검증 필요 (Phase 0), 빈 상태 Skia 렌더 동작 실측 부재
  - 성능: L — 생성 시 1회 동작, hot path 무관
  - 유지보수: L — 단일 hook + 기존 파이프라인 재사용, 신규 계약 없음 (ADR-152 계약 소비만)
  - 마이그레이션: L — factory 변경은 신규 생성 요소에만 적용, 기존 저장 프로젝트 무영향 (additive)

### 대안 C: Factory 가 컴포넌트 생성 시 DataTable 자동 생성

- 설명: collection 컴포넌트를 캔버스에 놓는 즉시 전용 DataTable 을 자동 생성해 바인딩.
- 근거: 클릭 수 최소 (0클릭). 원문 2026-03 대안 A.
- 위험:
  - 기술: M — factory 가 Data store 에 side effect (동기화/undo 경계 복잡)
  - 성능: L
  - 유지보수: **H** — 데이터/UI 강결합: 컴포넌트 삭제 시 DataTable 정리 판단 문제, DataTable 공유 불가 (1:1 고정), 업계 5/5 부재 패턴 (Context 표)
  - 마이그레이션: M — 도입 후 되돌리면 자동 생성된 테이블 잔존물 정리 필요

### Risk Threshold Check

| 대안 | 기술 | 성능 | 유지보수 | 마이그레이션 | HIGH+ 개수 |
| ---- | :--: | :--: | :------: | :----------: | :--------: |
| A    |  L   |  L   |  **H**   |      L       |     1      |
| B    |  M   |  L   |    L     |      L       |     0      |
| C    |  M   |  L   |  **H**   |      M       |     1      |

루프 판정: 대안 B 가 HIGH 0 으로 존재 — 추가 대안 탐색 불필요.

> 참고 — 원문의 "Field 자동 생성" 대안은 별도 대안이 아니라 현행 코드에 이미 존재하는 런타임 파이프라인이 됐다 (`ADD_FIELD_ELEMENTS`, `useIframeMessenger.ts:786`). Quick Connect 와 이 파이프라인의 공존/중복 여부는 Phase 0 재-inventory 판정 대상.

## Decision

**대안 B: Quick Connect — preset 기반 1클릭**을 선택한다.

선택 근거:

1. 잔존 위험이 기술 M 뿐이며, 이는 Phase 0 재-inventory (Table 캐시 현행 로직 / 빈 상태 Skia 렌더 실측 / `ADD_FIELD_ELEMENTS` 관계 판정 / 히스토리 기록 여부) 로 착수 전에 해소된다.
2. ADR-152 계약 v2 의 write consumer 로 설계되어 legacy 바인딩을 신규 생산하지 않고, preset schema 로 `fieldMap` 을 자동 채워 152 가 도입하는 수동 매핑 단계까지 생략한다 — 두 ADR 의 시너지 지점.
3. 데이터 독립성 (삭제 시 유지) 은 업계 5/5 공통 패턴을 따르고, preset 기반 생성은 차별점으로 추가한다.

기각 사유:

- **대안 A 기각**: 유지보수 HIGH — 온보딩 격차와 정적 아이템 혼란이 영구 잔존하며, 문서 보강으로는 3단계 수동 작업 자체가 줄지 않는다.
- **대안 C 기각**: 유지보수 HIGH — 데이터/UI 강결합으로 삭제 정리·테이블 공유 문제가 구조화되고, 업계 5개 빌더 모두 채택하지 않는 패턴 (Context 표).

> 구현 상세: [013-quick-connect-data-binding-breakdown.md](design/013-quick-connect-data-binding-breakdown.md)

## Risks

| ID  | 위험                                                                                                                | 심각도 | 대응                                                                                                                                                 |
| --- | ------------------------------------------------------------------------------------------------------------------- | :----: | ---------------------------------------------------------------------------------------------------------------------------------------------------- |
| R1  | ADR-152 미완 상태에서 착수 시 name 기반 v1 바인딩 신규 생산 → 152 lazy upgrade 부담 증가                            |  MED   | G0 착수 조건 = ADR-152 Implemented. 바인딩 기록은 152 의 `resolveBoundCollection`/v2 스키마 경유만                                                   |
| R2  | factory 기본 아이템 제거 후 빈 collection 의 Skia 렌더 동작 미정의 (spec placeholder 소멸 — catalog 경로 실측 부재) |  MED   | Phase 0 에서 빈 상태 6종 Skia 실측 → Phase 1 에서 DOM `renderEmptyState` 와 대칭 구현 → G1 `/cross-check`                                            |
| R3  | Table 재연결(동일 source 다른 DataTable) 시 Column 재생성 차단 여부 미확정 — 캐시 clear 로직이 원문 이후 재작성됨   |  MED   | Phase 0 실측 (`TableRenderer.tsx:143-159` 현행 키 구성으로 재연결 시나리오 검증) → 차단 재현 시에만 우회 설계, 미재현 시 원문 3-Phase null 우회 폐기 |
| R4  | Quick Connect 산출물(DataTable + 바인딩 + Column elements)이 히스토리 미통합일 가능성 — undo 시 부분 복원           |  MED   | Phase 0 에서 `enqueuePreviewGeneratedElements` 경로의 히스토리 기록 여부 실측 → 미기록이면 undo 범위를 사용자 가시 문서화 + 후속 통합 항목으로 명시  |
| R5  | DataTable 생성 성공 후 바인딩 기록 실패 시 orphan DataTable                                                         |  LOW   | 롤백 계약: `prevBinding` 복구 시도 → `deleteCollection` — 실패 시 console.error + Data 패널 수동 복구 가능 상태 유지                                 |

잔존 HIGH 위험 없음.

## Gates

| Gate | 시점         | 통과 조건                                                                                                                            | 실패 시 대안                                                     |
| ---- | ------------ | ------------------------------------------------------------------------------------------------------------------------------------ | ---------------------------------------------------------------- |
| G0   | 착수 전      | ADR-152 status = Implemented **AND** Phase 0 재-inventory 완료 (R2/R3/R4 의 미확정 전제 3건 실측 판정 기록)                          | 착수 보류 — ADR-152 완료 대기 또는 재-inventory 보강             |
| G1   | Phase 1 완료 | 빈 collection 6종 (ListBox/GridList/Select/ComboBox/Menu/Table) 의 Skia ↔ Preview DOM 빈 상태 시각 대칭 — `/cross-check` PASS        | 비대칭 경로 수정 후 재실행                                       |
| G2   | Phase 3 완료 | 대표 3종 (ListBox/Table/Select) Quick Connect 1클릭 → live builder 에서 데이터 렌더 + v2 바인딩(`collectionId`+`fieldMap`) 기록 확인 | hook/UI 결선 수정 후 재검증                                      |
| G3   | closure      | Table 재연결 (Column 교체) + 실패 롤백 시나리오 실기동 + 기존 수동 바인딩 경로 회귀 0                                                | 해당 시나리오 수정 후 재실행 — 미해소 시 Table 지원을 Phase 분리 |

## Consequences

### Positive

- 데이터 연결이 3단계 수동 → 1클릭으로 단축 — 초보 온보딩 격차 해소, 업계 비교 열위 (Context 표) 반전.
- factory 정적 아이템 (Item 1, 2, 3) 제거 — 신규 생성 컴포넌트의 기본 상태가 "데이터를 연결하세요" empty state 로 의미화.
- preset schema 기반 `fieldMap` 자동 기록 — ADR-152 가 도입하는 컬럼 매핑을 생성 시점에 무비용 완성.
- 데이터 독립성 유지 — 컴포넌트 삭제 후에도 DataTable 재사용 가능.

### Negative

- 빈 상태 대칭 (R2/G1) 검증 부담 — collection 6종 × Skia/DOM 2경로.
- Quick Connect 재실행 정책 (새 DataTable 생성 + 바인딩 교체, Table 은 Column 전체 교체) 에 대한 사용자 학습 필요 — confirm 다이얼로그로 완화.
- 히스토리 통합 여부에 따라 undo 동작 범위가 다른 기능과 달라질 수 있음 (R4 — Phase 0 판정 후 문서화).
