# ADR-155: 숨은 패널 selection fan-out 차단 — 패널 활성 gating

## Status

Proposed — 2026-07-17

> **구현 착수 금지** — 리뷰 승인 후 진행.

## Context

캔버스 선택 클릭 1회가 **패널을 전부 접은 상태에서도 ~110ms**(86~205ms) 의 동기 long task 를 만든다 (2026-07-17 실측, 43 요소 프로젝트; 사용자 실창에서는 95~220ms). JS Self-Profiling 분해 결과 비용의 본체는 render 가 아니라 **React commit 단계의 effect 순회** (busy 샘플 ~74%) 다:

- 숨은 스타일 패널의 입력 ~25개가 새 선택 요소 값으로 host update → React 내부 input 갱신 메커니즘으로 **클릭당 DOM 속성 쓰기 93건** (`name` ×50, `type` ×25)
- LayerTree TreeItem 4행 재생성 + 테마 스와치 2개 remount 의 passive effect 정리

구조 원인은 패널 시스템의 의도된 설계다: `PanelContainer.tsx:49-57` 의 `PanelContent` 가 **`isActive={true}` 하드코딩 + `memo(panelId, side)`** 로, (1) 화면에 없는 패널(Styles/Properties/Events/Themes/History 등 14종)까지 모든 선택 구독을 실행하고 (2) 실제 활성 상태를 내려도 memo 가 전파를 차단한다. 이 설계는 remount 비용 제거와 패널 로컬 상태(스크롤·입력) 보존이 목적이었으나, 그 대가로 숨은 패널이 매 클릭 갱신 비용을 지불한다. 선행 완화(ADR 없음, 커밋 `6ee06262a`)로 선택 시 canonical 문서 전체 재-materialize 는 문서당 1회 캐시로 해소됐고, 본 ADR 은 잔여 병목인 패널 fan-out 을 다룬다.

선택 구독 소비처: `stores/index.ts:197` `useSelectedElementData` → `useDebouncedSelectedElementData` ×4 (`panels/styles/StylesPanel.tsx:33,51` / `panels/properties/PropertiesPanel.tsx:789` / `panels/events/EventsPanel.tsx:281`) + 스타일 4섹션의 `selectedElementId` 직구독 + `panels/nodes/LayersSection.tsx:102`.

**3-Domain 판정**: 본 ADR 은 D1(DOM/접근성)/D2(Props)/D3(시각 스타일) SSOT 경계와 무관한 **builder 내부 UI 아키텍처** 결정이다. 경계 교차 없음.

**Hard Constraints**:

1. 캔버스 선택 클릭의 main-thread blocking: 현행 ~110ms(소형)/220ms(실창) → **50ms 미만** (대형 문서 기준 실측, 소형 문서 단독 판정 금지)
2. 패널 재활성 시 **현재 선택·상태 즉시 반영** (stale 표시 0건)
3. 패널 로컬 상태 (스크롤 위치, 입력 세션) 보존 — 현행 설계가 보장하던 계약 유지
4. React 19.2.7 (설치본에 stable `Activity` export 존재 — 2026-07-17 실측 확인)

**Soft Constraints**:

- 패널 14종 개별 수정을 최소화 (단일 지점 변경 선호 — 신규 패널 추가 시 계약 누락 방지)
- 향후 문서 편집·테마 변경 등 선택 외 갱신 축에도 같은 원리가 적용되는 구조 선호

## Alternatives Considered

### 대안 A: 패널 활성 구독 gating (selector sentinel)

- 설명: 패널이 layout store 에서 자기 활성 상태를 직접 구독(`usePanelIsActive(panelId)`)하고, 비활성 시 `useSelectedElementData(enabled)` 류 selector 가 안정 sentinel 을 반환해 재렌더를 차단. mounted 유지로 상태 보존.
- 근거: Zustand selector 조건 반환은 확립된 패턴 (React 외부 store 구독의 표준 기법). 패널 활성 상태가 store 에 이미 존재.
- 위험:
  - 기술: M — 활성 전환 시 catch-up 경로를 수동 구현 (전환 → 재구독 → 최신 선택 재파생), 누락 시 stale 표시
  - 성능: L — 클릭 시 숨은 패널 갱신 소거 (선택 축 한정)
  - 유지보수: M — 소비처 4곳+섹션별 배선, 신규 패널·신규 구독 추가 시 gating 계약을 사람이 지켜야 함 (누락 시 조용한 회귀)
  - 마이그레이션: L — 패널별 점진 적용, 롤백 = 파라미터 제거

### 대안 B: React `<Activity mode="hidden">` 래핑

- 설명: `PanelWrapper` 단일 지점에서 비활성 패널을 `<Activity mode="hidden">` 로 감싼다. React 가 hidden 서브트리의 갱신을 저우선으로 미루고(클릭 task 에서 제거), effect 를 내리고, 상태를 보존하며, visible 전환 시 pre-render 된 최신 상태를 즉시 보인다.
- 근거: React 19.2 공식 stable API — 정확히 "숨겨진 UI 의 상태 보존 + 갱신 지연" 용도로 설계됨 (react.dev Activity 문서). 설치본 19.2.7 에서 export 실측 확인. Zustand 의 useSyncExternalStore 구독도 hidden 중 해제 → visible 시 재구독+최신화 — 원하는 의미와 정확히 일치.
- 위험:
  - 기술: H — 프로젝트 실전 사용 전례 없음. RAC(portal/focus scope)·기존 `data-active` CSS 숨김 메커니즘과의 상호작용 미검증. hidden 중 effect 가 내려가므로 숨은 패널의 부수효과에 의존하는 경로가 있으면 동작 변화 (Phase 0 inventory 로 판정)
  - 성능: L — 클릭 task 에서 숨은 패널 비용 전부 제거 (선택 외 갱신 축 포함), idle 시 pre-render 로 이연
  - 유지보수: L — `PanelContainer.tsx` 1곳. 신규 패널 자동 적용 (계약 누락 불가능)
  - 마이그레이션: L — 패널 단위 점진 적용 가능, 롤백 = 래퍼 제거 1곳

### 대안 C: 비활성 패널 unmount (`if (!isActive) return null` 가드 부활)

- 설명: `PanelContent` 에 실제 isActive 를 내리고 비활성 패널은 null 렌더 (unmount). 패널 14종에 이미 존재하는 dead 가드를 되살리는 방향.
- 근거: 가장 단순한 구현. 다수 앱의 탭 패널 기본 패턴.
- 위험:
  - 기술: L — 메커니즘 자체는 자명
  - 성능: M — 재활성 시 전체 remount (RAC 트리 마운트 비용 — 부팅 실측에서 패널 서브트리 마운트가 수십 ms 급)
  - 유지보수: L
  - 마이그레이션: H — 패널 로컬 상태 소실 (스크롤·입력 세션·펼침 상태). 현행 설계가 명시적으로 지키던 사용자 가시 계약의 파괴 (Hard Constraint 3 위반)

### Risk Threshold Check

| 대안 | 기술 | 성능 | 유지보수 | 마이그레이션 | HIGH+ 개수 |
| ---- | :--: | :--: | :------: | :----------: | :--------: |
| A    |  M   |  L   |    M     |      L       |     0      |
| B    |  H   |  L   |    L     |      L       |     1      |
| C    |  L   |  M   |    L     |      H       |     1      |

루프 판정: HIGH 0 대안(A)이 존재하므로 추가 대안 루프 불필요. B 의 HIGH 1건은 파일럿 Gate 로 소거 가능한 검증 위험이며 아래 Decision 에서 수용 근거를 명시한다.

## Decision

**대안 B: `<Activity mode="hidden">` 래핑**을 선택한다.

선택 근거:

1. **위험의 성질이 다르다** — A 의 M 위험 2건(수동 catch-up + 신규 구독마다 사람이 지키는 계약)은 코드가 사는 동안 계속 지불하는 지속 위험이고, B 의 H 1건(RAC/CSS 상호작용 미검증)은 Phase 1 파일럿 1회로 소거되는 일회성 검증 위험이다. 실패 시 fallback(A 경로)이 명시되어 있고 롤백은 래퍼 1곳 제거다.
2. **커버리지** — A 는 선택 축만 차단하지만, B 는 문서 편집·테마 변경 등 모든 갱신 축에서 숨은 패널 비용을 제거한다 (Soft Constraint 2).
3. **단일 지점 + upstream 보장** — `PanelContainer.tsx` 1곳 변경으로 패널 14종 + 향후 신규 패널에 자동 적용. 갱신 지연·상태 보존·재활성 최신화가 React 엔진 보장이라 수동 catch-up 코드가 없다 (Hard Constraint 2·3 을 엔진이 담당).

기각 사유:

- **대안 A 기각**: 소비처별 배선(4곳+섹션)과 신규 구독마다의 gating 계약 준수가 지속 유지보수 부담이며, 선택 외 갱신 축은 여전히 숨은 패널 비용을 지불한다. 단 B 의 Gate 실패 시 fallback 경로로 보존한다.
- **대안 C 기각**: 패널 로컬 상태 소실이 Hard Constraint 3 을 직접 위반 — 현행 설계가 의도적으로 지키던 사용자 가시 계약의 회귀.

> 구현 상세: [155-hidden-panel-selection-fanout-gating-breakdown.md](design/155-hidden-panel-selection-fanout-gating-breakdown.md)

## Risks

| ID  | 위험                                                                                                         | 심각도 | 대응                                                                          |
| --- | ------------------------------------------------------------------------------------------------------------ | :----: | ----------------------------------------------------------------------------- |
| R1  | Activity 와 RAC portal/focus·기존 `data-active` CSS 숨김의 상호작용 미검증 (표시 깨짐/포커스 이탈 가능)      |  HIGH  | G2 파일럿 (저위험 패널 2종 선행) — 실패 시 fallback A 로 전환                 |
| R2  | 숨은 패널 effect 에 의존하는 외부 경로 존재 시 hidden 중 effect unmount 로 동작 변화 (단축키·전역 브릿지 류) |  MED   | G1 — Phase 0 inventory 로 전수 판정, 해당 패널은 gating 제외 목록에 명시      |
| R3  | 소형 문서 측정으로 효과를 오판 (110ms 중 commit effect 비중이 문서·패널 구성에 따라 달라짐)                  |  MED   | G3 — 대형 문서(500+ 요소 또는 실프로젝트) 병행 실측 의무, 소형 단독 판정 금지 |
| R4  | 패널 토글 애니메이션·레이아웃 회귀 (Activity 숨김 처리와 기존 CSS transform 이중화)                          |  LOW   | Phase 1 에서 CSS 역할 정리 + G4 토글 회귀 확인                                |

## Gates

| Gate | 시점           | 통과 조건                                                                                                          | 실패 시 대안                                       |
| ---- | -------------- | ------------------------------------------------------------------------------------------------------------------ | -------------------------------------------------- |
| G1   | Phase 0        | 숨은 패널 effect 의존 inventory 완료 — 의존 0건 확인 또는 제외 목록 확정                                           | 의존 패널은 Activity 적용 제외 (부분 적용)         |
| G2   | Phase 1 파일럿 | 파일럿 패널 기준: 클릭당 DOM 속성 쓰기·remount 소거 + 재활성 시 현재 상태 즉시 표시 (Chrome MCP live)              | fallback 대안 A (selector gating) 로 전환          |
| G3   | Phase 3        | 대형 문서 기준 클릭 longtask <50ms + commit effect 샘플 비율 유의미 감소 (baseline 74%) — 소형 문서 단독 판정 금지 | 원인 재분해 후 fallback A 병용 검토                |
| G4   | Phase 3        | 패널 로컬 상태(스크롤·입력) 보존 + 토글 애니메이션 회귀 0건                                                        | CSS 역할 재조정 (data-active 유지 + Activity 병행) |

## Consequences

### Positive

- 캔버스 선택 클릭의 동기 비용에서 숨은 패널 몫(commit effect 순회 ~74%) 제거 — `PanelContainer.tsx` 1곳으로 패널 14종 + 신규 패널 자동 커버
- 선택 외 갱신 축(문서 편집·테마)에서도 숨은 패널 비용 제거 — 별도 배선 없이 동일 원리 적용
- 패널 활성/비활성 의미가 React 공식 메커니즘으로 표준화 — `isActive={true}` 하드코딩과 각 패널의 dead 가드 정리 계기

### Negative

- React 19.2 `Activity` 에 대한 프로젝트 첫 의존 — React 마이너 업그레이드 시 동작 확인 대상 추가
- hidden 패널의 갱신이 idle 로 이연되므로, 숨은 패널이 실시간이어야 하는 기능을 향후 추가할 경우 해당 패널을 제외 목록으로 관리해야 함 (design §5 inventory 가 그 정본)
- 파일럿·실측 Gate 4개를 통과해야 하는 검증 비용 (일회성)
