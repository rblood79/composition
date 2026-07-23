# ADR-162: GridList 카드 템플릿 임의 자식 실체화 + row-data 동적 매핑

## Status

Proposed — 2026-07-24

## Context

사용자가 Components 페이지의 GridList 카드 템플릿(`component-gridlist-item-default`)에 Image/Button 등 임의 컴포넌트를 추가해도 GridList 인스턴스 카드에 반영되지 않는다 (2026-07-24 사용자 보고, 라이브 실측). 원인은 회귀가 아니라 현행 카드 모델의 설계 한계 2중:

1. `resolveSlotComposition`(packages/shared/src/catalog/slotRoles.ts:162)이 인식된 slotRole(label/description/icon 등 13종)을 가진 자식만 추출 — 비-slot 자식은 구성에서 드롭.
2. 카드 렌더러가 고정 slot 재구성만 수행 — Skia `gridlist_card` escape(packages/specs/src/renderers/skiaPrimitives.ts:468 `stackEntries: Array<"label"|"description">`, replace 모드) / DOM `renderGridListItemSlotContent`(packages/shared/src/renderers/SelectionRenderers.tsx:162).

사용자 요구는 2축: **① 템플릿에 추가한 대로 인스턴스 카드에 반영** (임의 구성), **② GridList 패널 Content-Data 에서 추가된 항목의 prop 에 데이터 컬럼을 동적 매핑**.

**ADR-159 경계 (2026-07-24 사용자 confirm — "159 base 의존 재획정")**: [ADR-159](159-collection-field-template-binding.md)(Proposed)가 같은 문제 공간의 **보간 축**(`{field}` 템플릿 문법·shared resolver `fieldTemplate.ts`·오소링 ComboBox·dataTable 단일 소스)을 담당한다. 본 ADR 은 **구조 축**(템플릿 서브트리 실체화 + 카드 높이 실측 + escape gate)만 소유하며, 보간은 159 P1 의 `compileFieldTemplate`/`interpolateFieldTemplate` 2심볼을 소비한다 (제2 엔진 금지 — 159 grep gate 준수). 요구 ②의 오소링 UI 도 159 P4 패턴을 임의 자식 prop 으로 확장 소비. **선행 의존**: Phase 2 진입 전 159 P1, Phase 5 진입 전 159 P4 Implemented.

**SSOT 3-domain 분류**: 본 ADR 은 **D3(시각 스타일 — 카드 구성·스타일의 Skia↔DOM 대칭)** 중심. 카드 내부 콘텐츠 구성은 RAC GridListItem 이 허용하는 자식 콘텐츠 범위라 D1 침범 아님 (RAC DOM 구조/ARIA 무변경). 데이터 매핑은 159 의 바인딩 계보(canonical 문서 모델 영역) 소비로 D2 신규 prop 도입 없음.

**Hard Constraints**:

1. Canvas 60fps 유지 — composed 카드도 가상화 window cap(ADR-150 A2) 내에서만 실체화.
2. D3 대칭 — composed 카드의 Skia 렌더와 Preview DOM 렌더의 시각 결과 동일 (`/cross-check` PASS).
3. BC 0% — 기존 slot-only 문서(비-slot 자식 없음)는 시각·동작 무변경 (opt-in 전환, 기존 gridlist 테스트 전량 GREEN 유지).
4. 행 높이 SSOT 단일화 — window stride(ADR-150 A2 rowHeight)·owner 높이(§1.55c)·실제 카드 렌더가 동일 실측값 소비 (이원화 금지, ADR-160 원칙 승계).
5. 보간 단일 소스 — `{field}` 파싱은 ADR-159 resolver 2심볼 import 만 (자체 파싱 0건, 159 grep gate).

**Soft Constraints**:

- ADR-148 placeholder·origin SSOT 모델, ADR-161 ref-composite 전제 승계 (재사용 자산: `CollectionProjectionRow.item` raw record, `resolveCanonicalRefTree` 실체화, templateBinding.ts propsSchema 치환과 공존).
- ListBox/Menu 패밀리 확산은 GridList proof 이후 (범위 외).

**Generator 선언** (adr-writing seed #2): 본 ADR 은 catalog 경로 — Spec CSS Generator 확장 없음. composed 카드의 자식은 각 컴포넌트의 기존 catalog binding/renderer 를 그대로 소비한다.

## Alternatives Considered

### 대안 A: 템플릿 서브트리 실체화 + ADR-159 보간 소비

- 설명: projection 이 카드를 flat 합성 노드가 아닌 **origin 템플릿 서브트리의 행별 실체화**로 생성 (Skia scene 자식 노드 + DOM 재귀 렌더). 동적 매핑은 159 resolver 를 실체화된 자식의 string prop 에 적용 (raw record = `CollectionProjectionRow.item`). 비-slot 자식 존재 시에만 composed 모드 발동 (BC gate).
- 근거: Framer/Webflow 류 빌더의 collection repeater 표준 모델 (템플릿 + 필드 바인딩). 프로젝트 내 선례 — ADR-159 가 보간 축을 이미 확정 방향으로 설계, legacy Field/DataField 템플릿 모드(SelectionRenderers.tsx Path 1)가 동일 요구의 과거 구현.
- 위험:
  - 기술: **H** — 카드 높이 formula(§1.55c) → 실측 전환이 가상화 stride·owner 높이와 연쇄 (Risk R1).
  - 성능: M — scene 노드 수 rows × 서브트리 노드로 증가하나 window cap 상한 존재.
  - 유지보수: M — composed/slot 2모드 공존 분기. 판정 단일 심볼로 완화.
  - 마이그레이션: L — opt-in, 기존 문서 무변경.

### 대안 B: slot vocabulary 확장 (image/media/action role 추가)

- 설명: SLOT_ROLES 에 image/action 등을 추가하고 카드 렌더러(escape/DOM)가 해당 slot 을 emit 하도록 확장. 추가 자식에 slot role 자동 부여.
- 근거: ADR-148 고정 vocabulary 모델의 최소 연장 — ListBox icon slot 선례.
- 위험:
  - 기술: L — 기존 모델 내 증분.
  - 성능: L.
  - 유지보수: **H** — 새 컴포넌트 유형마다 role + 양측 렌더러 + metric 확장 반복 (vocabulary 무한 증식). 중첩 컨테이너·임의 구성 표현 불가.
  - 마이그레이션: L.
- **요구 미달**: "추가한 대로 반영"(임의 구성)을 구조적으로 충족 못 함 — 고정 레이아웃 카드만 가능.

### 대안 C: legacy Field/DataField 템플릿 모드 부활 확장

- 설명: SelectionRenderers.tsx Path 1 의 Field 자식 + columnMapping 모델을 Skia 까지 확장 정비.
- 근거: 동일 요구의 기존 구현 존재.
- 위험:
  - 기술: M — Skia 대응 전무 (DOM 전용 legacy) → escape 전면 신설.
  - 성능: L.
  - 유지보수: **H** — ADR-147/148 이 의도적으로 제거한 모델의 역행 (Field 중간 노드 = 실 컴포넌트 아닌 메타 노드, origin 문서 SSOT 원칙과 충돌). ADR-159 의 columnMapping 축소 방향과도 역행. 이중 모델 영구화.
  - 마이그레이션: M — 기존 slot 모델 문서와 Field 모델 공존 혼선.

### Risk Threshold Check

| 대안 | 기술 | 성능 | 유지보수 | 마이그레이션 | HIGH+ 개수 |
| ---- | ---- | ---- | -------- | ------------ | :--------: |
| A    | H    | M    | M        | L            |     1      |
| B    | L    | L    | H        | L            |     1      |
| C    | M    | L    | H        | M            |     1      |

루프 판정: 모든 대안이 HIGH 1개 — 그러나 B/C 의 HIGH 는 구조적(요구 미달·모델 역행)으로 회피 불가인 반면, A 의 HIGH 는 기술 위험으로 Gate(높이 실측 단일 resolver + parity test)로 관리 가능. 새 대안 추가 루프는 A 의 위험이 관리 가능 판정으로 종료.

## Decision

**대안 A: 템플릿 서브트리 실체화 + ADR-159 보간 소비**를 선택한다.

선택 근거:

1. 사용자 요구(임의 구성 + 동적 매핑)를 유일하게 완전 충족 — B 는 고정 레이아웃 한계, C 는 제거된 모델 역행.
2. A 의 HIGH(카드 높이 실측 전환)는 §1.55c formula 와 실제 projection 의 기존 구조적 어긋남(2026-07-23 실측, 메모리 기록)을 **근본 해소하는 방향과 일치** — 위험이자 부채 청산.
3. 보간·오소링을 159 에 위임해 본 ADR 의 신규 메커니즘을 구조 축 3개(판정·실체화·실측)로 최소화 — 매핑 SSOT = origin 문서 (ADR-148 Decision 3 승계), 보간 SSOT = 159 resolver (이중 엔진 금지).

기각 사유:

- **대안 B 기각**: "추가한 대로 반영" 요구를 구조적으로 충족 불가 (고정 slot 레이아웃만). vocabulary 무한 증식 유지보수 HIGH.
- **대안 C 기각**: ADR-147/148 이 의도적으로 폐기한 Field 메타 노드 모델 역행 + ADR-159 의 columnMapping 축소 방향과 충돌. Skia 측 전무해 신설 비용이 A 와 동급이면서 모델 이원화만 추가.

> 구현 상세: [162-gridlist-template-subtree-projection-breakdown.md](design/162-gridlist-template-subtree-projection-breakdown.md)

## Risks

| ID  | 위험                                                                                                                                                                                           | 심각도 | 대응                                                                                                                                       |
| --- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | :----: | ------------------------------------------------------------------------------------------------------------------------------------------ |
| R1  | composed 카드 높이 실측 전환 — §1.55c(utils.ts)·`resolveCollectionRowMetric`(collectionItemMetrics.ts, ADR-160)·window stride(ADR-150 A2 rowHeight) 3소비처 연쇄. 이원화 시 clip/overflow 재발 |  HIGH  | 단일 실측 resolver + `_projectedRowsContentHeight` 채널 재사용(ADR-157 P4) + parity test (Gate G3). 1차 범위 템플릿 균일 높이 가정 명시    |
| R2  | slot-only 문서 회귀 — composed 판정 오작동 시 기존 카드 경로 파손                                                                                                                              |  MED   | 판정 단일 심볼(`isComposedCollectionTemplate`) 3소비처 공유 + 기존 gridlist 테스트 전량 GREEN gate (G1)                                    |
| R3  | 치환 이중화/충돌 — propsSchema 치환(ADR-148, instance root)과 159 row 보간의 순서·오염, 또는 소비처가 자체 `{...}` 파싱 도입                                                                   |  MED   | 순서 계약 명문화 (breakdown §4): propsSchema 선행(schema 키 한정) → 159 보간 후행. 159 grep gate(2심볼 외 파싱 0건) 준수 + 통합 테스트 1건 |
| R4  | scene 노드 수 증가 (rows × 서브트리) — 60fps 회귀                                                                                                                                              |  MED   | 가상화 window cap 상한 유지 (composed 도 window 슬라이스만 실체화). Gate G4 성능 확인                                                      |
| R5  | 선행 의존 지연 — ADR-159 P1/P4 미구현 시 본 ADR Phase 2/5 착수 불가                                                                                                                            |  MED   | 진입 조건 명시 (breakdown §1) — P0/P1(판정 primitive)은 독립 진행 가능. 159 우선순위는 사용자 결정                                         |

## Gates

| Gate | 시점         | 통과 조건                                                                                                    | 실패 시 대안                                               |
| ---- | ------------ | ------------------------------------------------------------------------------------------------------------ | ---------------------------------------------------------- |
| G1   | Phase 2/3 후 | 기존 gridlist 테스트 전량 GREEN (slot-only 시각·동작 무변경) + type-check 0                                  | composed 판정 gate 재설계, slot 경로 revert                |
| G2   | Phase 3 후   | composed 카드 Skia↔DOM parity — `/cross-check` gridlist PASS + live builder 에서 Image/Button 카드 반영 확인 | 비대칭 축 systematic-debugging 후 재검증                   |
| G3   | Phase 4 후   | composed 카드 높이: 엔진 실측 = rowHeight resolver 출력 = DOM 실측 (parity test + live)                      | formula fallback 유지 + composed 모드 explicit height 요구 |
| G4   | Phase 6      | 60fps 유지 (composed 20행 window 기준), 실체화 노드 수 = window cap × 서브트리 노드 상한 확인                | window cap 축소 또는 composed 노드 상한 도입               |

## Consequences

### Positive

- 사용자가 카드 템플릿을 임의 구성(Image/Button/중첩 컨테이너)으로 편집하면 모든 인스턴스 카드에 반영 — 빌더 재사용 컴포넌트 모델의 실질 완성 축.
- 데이터 매핑이 코드 규약(fixed-field 휴리스틱)이 아닌 origin 문서의 `{field}` 표현 — 사용자 가시·편집 가능 (159 문법 공유로 collection 패밀리 일관 인터페이스).
- §1.55c formula ↔ 실제 projection 의 구조적 어긋남(기존 기술 부채)을 실측 단일화로 청산 (composed 모드부터).
- ListBox/Menu 확산 시 동일 모델 재사용 가능 (판정·실체화 primitive 가 family 무관).

### Negative

- 카드 렌더 경로 2모드(slot/composed) 공존 — 판정 심볼 단일화로 완화하나 이해 비용 증가.
- composed 카드는 escape 최적화(단일 primitive 렌더) 대신 실 노드 트리 — 카드당 렌더 비용 증가 (window cap 으로 상한).
- ADR-159 P1/P4 에 대한 순서 결합 — 159 지연 시 본 ADR 의 보간·오소링 가시 성과도 지연 (구조 축 P0~P1 만 독립).
- 1차 범위 제약: 템플릿 균일 높이 가정 / origin 공유 매핑만 / 인터랙티브 자식의 행 컨텍스트 이벤트 미지원 (breakdown §8 후속).
