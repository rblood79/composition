# ADR-138: 컴포넌트 패널 복합 컴포넌트 reusable origin-instance 부착 — dynamic 검증 + 진입점/fork UX

## Status

Implemented — 2026-05-18

진행 로그:

- 2026-05-15 — brainstorming (Google Stitch / Pencil app 벤치마크 → A안 "Pencil 모델 완성" 선택) 후 ADR 작성 (Proposed)
- 2026-05-15 — review-adr Round 1 검토 (`docs/adr/reviews/138.md`)
- 사용자 framing lock-in:
  - "기존 컴포넌트 패널의 컴포넌트들에 reusable origin-instance + slot 기능을 부착하면 기본 요소 수정이 복합 컴포넌트에 일괄 반영되어 편의성/유지보수성이 올라갈지" — 본 ADR 의 본질 질문
  - "dynamic 까지 체크가 되어야 제대로 확인" — pilot 은 dynamic items 검증 가능한 컴포넌트로
  - 시나리오 3 (instance 가 items 일부 patch + origin 나머지 반영) 처리 = **옵션 A 채택** — items 는 shallow override (instance 가 items 건드리면 origin 과 완전 분리)
- 2026-05-18 — Phase 0~3 구현 완료 → Accepted → Implemented. vitest 11/11 (reusableTabs 8 + reusableCard 3) · type-check 0 new violation (baseline 547) · Chrome MCP 5 시나리오 runtime 통과 (우클릭 "Add as component" → origin 승격 / instance items override → "items (forked)" 표시 / "Reset to origin" → origin 재연결). Phase 0 freeze 로 신규 컴포넌트 2개 계획이 기존 인프라(LayerTree context menu / ComponentSemanticsSection override 목록) 재사용으로 대체 — 6 파일.
- 2026-07-08 — [ADR-148](../148-reusable-slot-system-unification.md) 흡수 확인 (사용자 confirm "138 → 148 에 흡수"): 진입점·fork UX (AddAsComponentMenu / InstanceForkBadge) 는 ADR-148 이 변경 0 으로 승계, 등록 축 (REUSABLE_COMPOSITE_ORIGINS Toolbar/Form) 은 ADR-148 Phase 1 이 catalog reusable entry 로 대체 예정. 본 ADR 은 Implemented 기록으로 존속 — `completed/` 이동.

## Context

### 3-domain 분류 (ADR-063 정합)

본 ADR 은 [ssot-hierarchy.md](../../../.claude/rules/ssot-hierarchy.md) 의 D1 / D2 / D3 중:

- **어느 domain 도 변경하지 않는다** — D1 (RAC Tabs/Card DOM/ARIA) / D2 (`Tabs.props.items` + `Card.props.*`) / D3 (Tabs.spec / Card.spec 시각 스타일) 전부 그대로.
- **canonical schema architecture 영역** — ADR-116 reusable schema (`reusable: true` + `type: "ref"` + `descendants[path]` 3-mode override + `slot: false | string[]`) 의 **검증·일반화 응용**. schema 변경 0.

본 ADR 의 신규 작업은 (1) base schema 가 Frame 외 복합 컴포넌트에서 작동하는지 **검증** + (2) 사용자 **진입점/fork UX 보강** 두 가지이며, 3-domain 경계를 교차하지 않는다.

### Hard constraints (측정 가능)

- **canonical schema 변경 0** — `CompositionDocument` / `RefNode` / `DescendantOverride` 타입 무수정. base = ADR-116/130.
- **ADR-066 Tabs items SSOT 보존** — `Tabs.props.items` 는 직렬화 배열 (Tab element 소멸) 구조 유지. 본 ADR 이 items 를 child element 로 재도입하지 않는다.
- **type-check baseline 유지** — new violation 0.
- **Skia 60fps 유지** — origin-instance resolver 는 per-render merge 이므로 instance 다수일 때 프레임 예산 회귀 없음을 확인.
- **BC 영향 0** — schema 미변경 → 기존 프로젝트 재직렬화 불필요. 기존 origin-instance (type:"frame" 위주) 동작 무변경.

### 문제 framing

#### F1. reusable 인프라가 95% land 되었으나 Frame 외 검증이 비어 있다

ADR-111/112 (Pencil 모델 도입) + ADR-116~130 (canonical SSOT 전환) 으로 `reusable origin-instance + slot` schema·시각 마커·단축키·Properties 패널이 land 됐다. 그러나 end-to-end 검증된 범위는 사실상 `type: "frame"` 위주이며, **복합 컴포넌트 (Tabs / Select / Card / ComboBox 등 RAC composition) 가 origin 으로 등록될 때 `descendants[path]` 자식 영역 override 가 어떻게 작동하는지 검증/문서가 비어 있다.**

#### F2. Tabs items 같은 직렬화 배열은 Pencil schema 의 회색지대

- Pencil 모델의 `descendants[path]` 는 child element 단위 patch (DOM 자식).
- 그러나 ADR-066 으로 composition 의 Tabs items 는 **`props.items` 안 직렬화 배열** (Tab element 소멸).
- "items 배열의 한 항목" 은 child element 도 prop 도 아닌 중간 entity — `descendants` 가 직접 다루지 않는다.

instance 가 items 를 일부만 patch 하고 origin 의 나머지 변경은 받고 싶은 시나리오 (시나리오 3) 가 schema 의 본질적 gap. 이 처리 방식이 사용자 framing "일괄 수정" 의 실효성을 좌우한다.

#### F3. 사용자 진입점 UX 부재

현재 origin 등록은 element 를 만들고 Properties 패널에 진입해야만 가능하다. palette / layer panel 우클릭 "Add as component" 같은 1-step 진입점이 없어 reusable 모델의 발견성이 낮다.

#### F4. fork 발생 시 사용자 인지 수단 부재

instance 가 items 를 override 하면 origin 과 분리(fork)되지만, 사용자는 그 사실을 알 수 없다. fork 상태·되돌리기·detach 를 표시하는 UX 가 없어, 사용자가 일괄 수정 이득을 못 누리고 instance detach 만 반복하게 된다.

## Alternatives Considered

### 대안 A: Pencil 모델 완성 — 검증 + 진입점/fork UX

- 설명: 이미 95% land 된 reusable 인프라의 잔여 5% 를 완성. Tabs (primary, dynamic items) + Card (baseline, region/descendants) pilot 으로 base schema 를 end-to-end 검증하고, 진입점 context menu + fork badge UX 를 보강. schema 변경 0.
- 위험: 기술(LOW — 신규 schema 없음, test + helper + UX layer) / 성능(LOW — resolver per-render merge 그대로) / 유지보수(LOW — 기존 모듈 함수 호출, 결합도 증가 미미) / 마이그레이션(LOW — BC 영향 0)

### 대안 B: Google Stitch 편입 — AI 화면 생성 + 테마 통합

- 설명: 벤치마크한 Google Stitch 의 강점 (전역 테마-편집 통합, AI prompt 기반 화면/변형 생성, 무한 캔버스) 을 우선 채택.
- 위험: 기술(HIGH — AI 인프라 ADR-134 Proposed 단계, 테마 통합은 ADR-021 BC) / 성능(MED — AI 호출 비용, Electron 시점 미확정) / 유지보수(MED — 신규 표면 다수) / 마이그레이션(MED — 테마 redesign BC)
- 순서 의존: reusable 검증 미완 상태에서 AI 가 origin 변형을 생성하면 schema 정합성 보장 불가 → A 가 사실상 prerequisite.

### 대안 C: 하이브리드 — A 일부 + B 일부 동시

- 설명: A 의 검증과 B 의 ThemesPanel 상시 노출을 동시 진행.
- 위험: 기술(MED — 두 영역 동시) / 성능(LOW) / 유지보수(MED — 두 영역 동시 drift 가능) / 마이그레이션(MED)

### Risk Threshold Check

| 대안                  | HIGH+ 개수    | 판정                                                |
| --------------------- | ------------- | --------------------------------------------------- |
| A. Pencil 모델 완성   | 0 (전 축 LOW) | 통과 — 위험 회피 대안 추가 불필요                   |
| B. Google Stitch 편입 | 1 HIGH (기술) | A 가 prerequisite — 단독 진입 시 schema 정합성 위험 |
| C. 하이브리드         | 0 HIGH, 3 MED | A 대비 추가 이득 없이 drift 위험만 증가             |

대안 A 가 모든 축 LOW 로, HIGH/CRITICAL 루프 불필요. 추가 대안 발굴 없이 A 채택.

## Decision

**대안 A 채택** — Pencil 모델 완성. 이미 land 된 reusable 인프라(ADR-111/112/116~130)의 잔여 검증·UX 를 완성한다.

세부 결정:

- **pilot**: Tabs (primary — dynamic items 검증) + Card (baseline — region/descendants 검증). 단순/복잡 비교로 schema gap vs 컴포넌트 특유 edge case 를 구분. (`slot` 필드는 `false | string[]` — 슬롯 추천 component ID 배열로, Tabs/Card factory 가 설정하지 않으며 본 ADR 범위 외. Card 영역 override 는 `descendants[<자식 stable id>]` 로 작동 — breakdown §4 참조.)
- **시나리오 3 처리**: items 는 **shallow override (fork)** — instance 가 `props.items` 를 건드리면 origin 과 완전 분리. Pencil 패턴 그대로. 분리 사실을 명시 UX(`InstanceForkBadge`)로 사용자에게 전달.
- **scope**: A-1 검증 + A-2 진입점 UX + A-3 fork UX 를 단일 ADR 로 통합 land. A-4 (잔여 ComponentTag 전수 sweep) 는 pilot 통과 후 별도 발의.

기각 사유:

- **대안 B 기각**: AI/테마 통합은 사용자 framing("기본 요소 수정 → 복합 컴포넌트 일괄 수정")과 다른 가치. 또한 reusable 검증이 B 의 prerequisite — 검증 없이 AI 가 origin 변형을 생성하면 schema 정합성 보장 불가. ADR-134 (AI) 의 후속 영역.
- **대안 C 기각**: A 대비 추가 사용자 이득 없이 두 영역 동시 drift 위험만 증가. ThemesPanel 상시 노출(B-1)은 schema 변경 없는 0.3 ADR 규모로, A 완료 후 독립 진행이 자연스럽다.

> 구현 상세: [138-component-palette-reusable-breakdown.md](../design/138-component-palette-reusable-breakdown.md)

## Risks

Decision 이행 중 관리할 잔존 운영 위험. 잔존 HIGH 위험 없음 — 아래는 전부 MED 이하.

| ID  | 위험                                                                                              | 심각도 | 대응                                                                                                                  |
| --- | ------------------------------------------------------------------------------------------------- | :----: | --------------------------------------------------------------------------------------------------------------------- |
| R1  | items shallow override fork 후 사용자가 fork 사실을 인지 못 하면 origin 변경 미반영을 버그로 오인 |  MED   | A-3 `InstanceForkBadge` 가 fork 상태 + [Reset to origin] 명시. 시나리오 3 진입 시 confirm dialog                      |
| R2  | A-4 잔여 ComponentTag sweep 이 후속 ADR 로 분리 → 검증 범위가 Tabs/Card 한정인 채로 방치될 debt   |  MED   | Decision 에 A-4 별도 발의 명시. pilot 통과 직후 sweep ADR 발의를 후속 작업으로 lock-in                                |
| R3  | `descendants[path].patch` orphan (origin child 삭제 후 instance patch 잔존) 자동 정리 미정        |  LOW   | resolver 가 dangling 무시 (사용자 가시 영향 없음). export/serialize 단 정리는 후속 ADR — breakdown §2 Phase 4 외 영역 |
| R4  | Chrome MCP runtime 검증이 환경 의존 (브라우저 세션)                                               |  LOW   | vitest 8+3 시나리오가 1차 gate. Chrome MCP 는 보조 runtime 확인                                                       |

## Gates

잔존 HIGH 위험 없음 — Gate 테이블은 land 검증 게이트로 운용 (breakdown §6 Verification gate 와 1:1).

| Gate | 시점         | 통과 조건                                                                             | 실패 시 대안                                                                |
| ---- | ------------ | ------------------------------------------------------------------------------------- | --------------------------------------------------------------------------- |
| G1   | Phase 1 완료 | `reusableTabs.scenarios` 8 + `reusableCard.scenarios` 3 vitest 전부 PASS              | 실패 시나리오가 schema gap 이면 ADR 재검토, helper 결함이면 Phase 1 내 수정 |
| G2   | Phase 1 완료 | Chrome MCP 5 dynamic 시나리오 runtime 통과                                            | runtime 불일치 시 vitest 와 대조 후 root-cause                              |
| G3   | Phase 3 완료 | type-check baseline 유지 (new violation 0) + cross-check Tabs/Card Skia↔CSS 시각 대칭 | 회귀 시 land 보류                                                           |
| G4   | Phase 0      | 추정 7-8 파일 대비 실측 1.5x 이내                                                     | 초과 시 `adr-writing.md` M4 — 사용자 surface 후 분할/단일 결정              |

## Consequences

### Positive

- ADR-111/112/116~130 으로 누적된 reusable 인프라가 Frame 외 복합 컴포넌트로 일반화 — 사용자 framing "기본 요소 수정 → 복합 컴포넌트 일괄 반영" 이 Tabs/Card 에서 실증.
- 진입점 context menu + fork badge 로 reusable 모델 발견성·이해도 상승.
- canonical schema 변경 0 → BC 영향 없음, 기존 프로젝트 무영향.

### Negative

- 검증 범위가 pilot (Tabs/Card) 한정 — 잔여 ComponentTag 는 A-4 후속 ADR 까지 미검증 debt (R2).
- `InstanceForkBadge` / `AddAsComponentMenu` 신규 UI 표면 추가 → 유지보수 대상 2개 증가 (LOW).
- `descendants` orphan 자동 정리는 본 ADR scope 외 — 후속 ADR 필요 (R3).
