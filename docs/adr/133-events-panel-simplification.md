# ADR-133: EventsPanel UX 단순화 (1년차 신입 baseline) + canonical events/actions 단일화 + ActionsPanel 흡수 + RAC convention 정합

## Status

Proposed — 2026-05-13 (ADR-010 / ADR-032 / ADR-034 supersede + ADR-131 §events/actions Phase 5 G3 partial revert)

진행 로그:

- 2026-05-13 — ADR 본문 + design breakdown 발의 (Proposed)
- 사용자 framing lock-in: (1) "이벤트패널 뎁스 너무 복잡 + ActionsPanel 뭐하는 기능이지?" — UX 단순화 본질 / (2) "RAC,RSC 의 이벤트 샘플부터 벤치마크를 해야" + "1년차 신입 개발자라도 사용할 수준이어야한다" — 정통 mental model 실증 우선
- RAC/RSC 벤치마크 evidence: `~/.claude/plans/rac-rsc-event-callback-benchmark.md` (42 RAC + 9 RSP 컴포넌트 callback 전수 inventory + composition gap 측정)
- 5 결정 사용자 explicit confirm: Q1 onClick deprecation / Q2 onMouseEnter/Leave rename / Q3 callback gap ADR-133 안 흡수 / Q4 mental model = 1년차 baseline / Q5 implemented:false 4 종 제거
- 3 ADR (010/032/034) Deprecated 이동 동반

## Context

### 3-domain 분류 (ADR-063 정합)

본 ADR 은 [ssot-hierarchy.md](../../.claude/rules/ssot-hierarchy.md) 의 D1 (DOM/접근성) / D2 (Props/API) / D3 (시각 스타일) 중:

- **D2 (Props/API) 정합 결정** — RAC/RSC 컴포넌트의 callback props (`onPress` / `onChange` / `onSelectionChange` / `onSubmit` / ...) 가 EventsPanel UI 의 primary navigation 단위. 사용자 mental model = "이 element 의 onPress 시 무엇이 일어나는가" 단일 질문 → 1-step expand 로 응답
- **schema architecture 정합** — `CompositionDocument.events` / `actions` root collection (ADR-131 Phase 1-4) primary store 전환

### 문제 framing

#### F1. 현 EventsPanel UX 뎁스 4 + overlay 2 — RAC 정통 mental model 괴리

현 [EventsPanel.tsx](../../apps/builder/src/builder/panels/events/EventsPanel.tsx) (884 LOC) 구조:

```
L1 PanelHeader (Events + Add 버튼)
├─ L2 추천 chips / 템플릿 / 핸들러 목록
│   └─ L3 핸들러 선택 → 상세 뷰 (Back/Delete header)
│       ├─ L4 WHEN block (event 종류 picker)
│       ├─ L4 IF block (condition 편집, 선택적)
│       ├─ L4 THEN block (액션 목록 + 추천 chips)
│       ├─ L4 ELSE block (조건 있을 때만)
│       └─ L4 Settings (debounce/throttle)
│       │
│       ├─ Overlay 1: ActionPicker (새 액션 추가 시)
│       └─ Overlay 2: BlockActionEditor (액션 편집 시)
```

사용자 framing 직접 인용 (2026-05-13): "현재 이벤트패널은 뎁스뎁스 너무 단계가 복잡하다".

#### F2. RAC/RSC 정통 mental model — 벤치마크 evidence

RAC 정통 mental model = **"컴포넌트별 semantic callback prop 1~3 개에 handler 1 개 binding"**. demo 정통 예시:

```tsx
<Button onPress={fn} />
<Select onSelectionChange={fn} />
<TextField onChange={fn} />
<Form onSubmit={fn} />
```

chain 개념은 RAC 측 부재 — handler 안에서 user 가 직접 작성. composition 의 multi-action chain 자체가 RAC 정통과 다른 모델 = **노코드 빌더의 필수 추상화**.

벤치마크 결과 (`~/.claude/plans/rac-rsc-event-callback-benchmark.md`):

- composition EventType 20 종 = RAC 핵심 9 영역 100% cover (Press/Change/ChangeEnd/SelectionChange/Action/OpenChange/ExpandedChange/Remove/Submit)
- composition convention 외 영역 (RAC "Not recommended" 명시): `onClick` / `onMouseEnter` / `onMouseLeave` / `onMouseDown` / `onMouseUp` / `onKeyPress` / `onDoubleClick` 7 종
- 세부 callback 누락: `onClear` (SearchField) / `onInputChange` (ComboBox) / Table 4-6 종 (`onRowAction`/`onSortChange`/`onResize`/`onLoadMore`) / Press lifecycle 4 종 / Hover lifecycle 3 종

#### F3. ActionsPanel dead UI 상태 — ADR-131 Phase 5 G3 UX 표면 결정 잘못

[ActionsPanel.tsx](../../apps/builder/src/builder/panels/actions/ActionsPanel.tsx) (155 LOC):

- minimum viable (id text input + kind text input + next text input + remove)
- kind 별 specialized config UI **없음** / chain DAG visualization **없음** / cross-event 사용 표시 **없음**

사용자 framing: "ActionsPanel 은 뭐하는 기능이지?" — 패널의 존재 의미 자체가 사용자에게 전달 안 됨.

**ADR-131 schema 결정 (canonical actions root collection) 자체는 정당** — cross-element reuse / id 참조 / chain DAG 는 가치 있음. 다만 **별도 panel 로 표면화한 Phase 5 G3 결정이 UX 관점에서 잘못**. EventsPanel 안 inline 흡수가 자연.

#### F4. legacy EventHandler ↔ canonical SerializedEvent dual-write 미정합

ADR-131 Phase 4 (consumer rewrite dual-write) 가 schema 만 land. EventsPanel UI 의 primary 모델은 여전히 legacy `EventHandler`:

| 영역         | EventsPanel 현 모델                                | ADR-131 canonical 모델                                              | gap                                           |
| ------------ | -------------------------------------------------- | ------------------------------------------------------------------- | --------------------------------------------- |
| events 저장  | `element.props.events: EventHandler[]` (inline)    | `document.events: SerializedEvent[]` (root, id + target)            | EventsPanel 이 legacy 만 read/write           |
| actions 저장 | `EventHandler.actions: EventAction[]` (inline)     | `document.actions: SerializedAction[]` (root, id + next chain)      | inline vs root 분기. cross-event reuse 불가능 |
| condition    | `EventHandler.condition: string` (JS expression)   | `SerializedEvent.condition?: Record<string, unknown>` (placeholder) | placeholder 만 정의                           |
| else branch  | `EventHandler.elseActions: EventAction[]` (inline) | `SerializedEvent.fallbackActionRef?: string` (id reference)         | adapter round-trip 만, UI 미반영              |
| chain        | actions 배열 순차 실행                             | `SerializedAction.next?: string[]` (DAG)                            | EventsPanel 은 sequential array               |

ADR-131 canonical schema 가치 (cross-event reuse / DAG chain / id 참조) 가 UI 표면 미land 로 사장 상태.

#### F5. 3 ADR (010/032/034) format/data SSOT 변경 후 obsolete

| ADR                               | 작성                                                                          | 현 상태                                                                                              |
| --------------------------------- | ----------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------- |
| ADR-010 (2026-02-10 ~ 2026-03-03) | Events Panel Smart Recommendations                                            | P0/P1 100% land (UI 표면 유지 가치). P1.5/P2 미land → ADR-134 응용                                   |
| ADR-032 (2026-03-12)              | Events Platform 재설계 v2 (Capability/Recipe/Effect/BindingRef/Condition DSL) | 0% land. events/actions root collection 영역은 ADR-131 partial supersede 완결. 나머지 → ADR-134 응용 |
| ADR-034 (2026-03-12)              | Events Panel Renovation (7 섹션 IA)                                           | 0% land. 7 섹션 IA framing 은 본 ADR-133 의 RAC-props-list 모델로 대체                               |

### Hard Constraints

1. **1년차 신입 mental model baseline**: 사용자 framing "1년차 신입 개발자라도 사용할 수준이어야한다" 직접 인용. default UI 표면은 **1년차 신입 개발자가 단독 사용 가능한 수준** — design Phase 에서 explicit 검증 (UI sketch + interaction flow)
2. **RAC 정통 매핑 mental model**: EventsPanel UI 의 primary 단위는 element 의 RAC callback props (semantic 단일 question). 사용자가 "이 element 의 onPress 시 무엇이 일어나는가" 를 1-step expand 로 확인
3. **canonical schema primary**: EventsPanel read/write 는 `useEventsForTarget(elementId): SerializedEvent[]` + `useDocumentActions(): SerializedAction[]` direct. legacy `element.props.events` 직접 access 0건 (boundary 외)
4. **Pencil import/export 호환 유지**: legacy `EventHandler` 모델은 Pencil round-trip adapter (`rootCollectionMigration.ts`) 가 cover. Pencil import 시 `element.props.events` 가 들어오면 canonical 로 변환, export 시 역변환
5. **ADR-010 P0/P1 UI 표면 보존**: 추천 chips / 템플릿 / 추천 액션 chips / 누락 경고 4 영역은 사용자 가치 검증 완료
6. **ActionsPanel 표면 제거**: `apps/builder/src/builder/panels/actions/` 디렉토리 전체 + `PanelId "actions"` 제거
7. **breaking changes 3 종 lock-in** (사용자 explicit confirm Q1/Q2/Q5):
   - Q1: `onClick` → `onPress` migration (deprecation + adapter)
   - Q2: `onMouseEnter` / `onMouseLeave` → `onHoverStart` / `onHoverEnd` rename
   - Q5: `onMouseDown` / `onMouseUp` / `onKeyPress` / `onDoubleClick` 4 종 EventType union 에서 제거
8. **callback gap 전수 추가** (Q3 — ADR-133 안 흡수):
   - Table: `onRowAction` / `onSortChange` / `onResize` / `onResizeStart` / `onResizeEnd` / `onLoadMore` (6 종)
   - SearchField: `onClear`
   - ComboBox: `onInputChange`
   - Press lifecycle: `onPressStart` / `onPressEnd` / `onPressChange` / `onPressUp` (4 종)
   - Hover lifecycle: `onHoverChange` (Q2 의 onHoverStart/End 외 추가 1 종)
9. **2 depth 제한 (default 표면)**: L1 = element 의 RAC callback props list, L2 = inline expand 안 1-action binding. overlay 0
10. **expand 표면 (power user)**: L2 expand 안 toggle 로 (multi-action chain + condition + custom event + debounce/throttle) 접근
11. **type-check baseline 602 freeze**: 본 ADR scope 안 type-check 신규 위반 0건

### Soft Constraints

- ADR-010 P0/P1 land 영역 UX 표면 보존 — simplified UX 안에서 자연 위치로 흡수
- `condition: string` (JS expression) → `condition: Record<string, unknown>` 1단계 AST placeholder lock-in (`{kind:"comparison", left, op, right}`). 완전 DSL 은 ADR-134 응용
- debounce/throttle 은 `SerializedEvent` 확장 슬롯 (`[k: string]: unknown`) 활용
- 18 templates (`data/eventTemplates.ts`) 데이터 보존. UX 표면에서는 빈 상태 분기에서 자연 노출
- legacy migration helper (onClick → onPress, onMouseEnter/Leave → onHoverStart/End) 는 import 시점 1회 변환

### baseline grep (Phase 0 inventory 시 commit hash 와 함께 frozen)

- `element\.events\|selectedElement\.events\|props\.events\|props\?\.events` direct read/write site
- `EventHandler\b\|EventAction\b` import / type usage site
- `ActionsPanel\b\|"actions" as PanelId\|panel.*actions` site
- `parseConditionString\|handleConditionsChange` condition string flow
- `actionMetadata.ts` ACTION_METADATA / ACTION_TYPE_LABELS / REGISTRY_ACTION_CATEGORIES consumer
- breaking change 영향 grep:
  - `onClick\b` (`apps/builder/src` + `packages/shared/src` — element.props 사용처)
  - `onMouseEnter\b\|onMouseLeave\b\|onMouseDown\b\|onMouseUp\b\|onKeyPress\b\|onDoubleClick\b`
- callback gap 추가 site:
  - `onRowAction\|onSortChange\|onResize\b\|onResizeStart\|onResizeEnd\|onLoadMore` (Table 측 prop 흐름)
  - `onClear\b` (SearchField)
  - `onInputChange\b` (ComboBox)
  - `onPressStart\|onPressEnd\|onPressChange\|onPressUp\|onHoverChange\b`

## Alternatives Considered

### 대안 A: 사용자 framing 정합 (UX simplification + canonical primary + ActionsPanel 흡수 + breaking changes + callback gap 전수 추가)

- **설명**: (1) EventsPanel UI = element RAC callback props list (L1) + 각 행 inline expand 안 1-action binding (L2, default). expand toggle = multi-action chain + condition + custom event + debounce/throttle (L4 power user 격리). (2) Primary store = canonical hook direct. legacy `EventHandler` = adapter round-trip 만. (3) ActionsPanel 제거 + inline cross-event reuse 토글. (4) condition 1단계 AST placeholder lock-in. (5) ADR-010 P0/P1 UI 표면 보존. (6) breaking changes 3 종 (onClick deprecation / onMouseEnter/Leave rename / 4 종 제거). (7) callback gap 전수 추가 (Table 6 + onClear + onInputChange + Press lifecycle 4 + Hover lifecycle 1)
- **근거**:
  - 사용자 framing 명시 lock-in 5 결정 (Q1-Q5)
  - RAC 정통 mental model 정합 (벤치마크 evidence)
  - "1년차 신입 OK" baseline — default 표면이 RAC props 매핑 단순 모델
  - ADR-131 canonical schema 가치 UI 표면 land
  - ADR-010 P0/P1 100% land 가치 보존
- **위험**:
  - 기술: **LOW** — canonical hook 이미 존재 (ADR-131 Phase 3 land), 신규 인프라 없음
  - 성능: **LOW** — UI re-render 단순화. canonical store O(1) lookup
  - 유지보수: **LOW** — single source primary, dual-write 미정합 해소
  - 마이그레이션: **MEDIUM-HIGH** — EventsPanel.tsx 884 LOC 전면 재작성 + ActionsPanel.tsx 제거 + breaking changes 3 종 (adapter + supportedEvents 갱신 + Pencil round-trip 호환) + 010/032/034 supersede chain + callback gap 약 12 신규 EventType 추가

### 대안 B: scope 축소 (UX simplification + canonical primary 만, breaking changes + callback gap 제외)

- **설명**: 대안 A 의 (1)~(5) 만 적용. (6) breaking changes + (7) callback gap 은 별 ADR (ADR-134 응용) 으로 분리
- **근거**: scope inflation 회피, ADR-133 본문 scope 단일화
- **위험**:
  - 기술: LOW
  - 성능: LOW
  - 유지보수: **MEDIUM** — onClick / onMouseEnter/Leave RAC convention 외 영역 영원 잔존, 1년차 신입이 onClick 과 onPress 의 차이 인지 burden
  - 마이그레이션: LOW
  - **본질 한계**: 사용자 explicit confirm "ADR-133 안 흡수" 결정 (Q3) + "deprecation" (Q1) + "rename" (Q2) + "제거" (Q5) 4 결정 부정합. Q4 mental model "1년차 OK" baseline 정합 부족 (RAC convention 외 영역 학습 burden 잔존)

### 대안 C: 현 상태 유지 + ADR-131 dual-write 정합만

- **설명**: EventsPanel UI 표면 유지, internal store 만 canonical primary 로 전환
- **근거**: 변경 minimal, UI 회귀 위험 0
- **위험**:
  - 기술: LOW
  - 성능: LOW
  - 유지보수: **HIGH** — 사용자 framing 4 항목 ("뎁스 너무 복잡" + "ActionsPanel 뭐하는 기능?" + "1년차 OK" + RAC convention 정합) 전수 미해소
  - 마이그레이션: LOW
  - **본질 한계**: 본 ADR 발의 동기 자체 충족 부재

### Risk Threshold Check

| 대안 | 기술 | 성능 | 유지보수 | 마이그레이션 | HIGH+ 개수 | 본질 한계                  |
| :--: | :--: | :--: | :------: | :----------: | :--------: | :------------------------- |
|  A   |  L   |  L   |    L     |     M-H      |     0      | 없음                       |
|  B   |  L   |  L   |    M     |      L       |     0      | Q1/Q2/Q3/Q5 4 결정 부정합  |
|  C   |  L   |  L   |    H     |      L       |     1      | 사용자 framing 전수 미충족 |

- HIGH+ 보유: 대안 C (1개)
- 대안 A 만 HIGH+ 0 + 본질 한계 없음 → 채택. scope inflation 마이그레이션 MEDIUM-HIGH 는 design breakdown 의 Phase 분해 + Gate 로 mitigation

## Decision

**대안 A 채택** — UX simplification + canonical primary + ActionsPanel 흡수 + breaking changes 3 종 + callback gap 전수 추가.

> 구현 상세: [133-events-panel-simplification-breakdown.md](design/133-events-panel-simplification-breakdown.md)

### framing checkpoint 4 질문 lock-in (M2 — 사용자 explicit confirm 2026-05-13)

| #   | 질문                          | 답변                                                                                                                                                                                                                                                                                                          |
| --- | ----------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | base / 응용 분류              | **base ADR** — UX simplification + canonical schema primary 전환 + breaking changes + callback gap 전수 추가 = 단일 framing (RAC 정통 매핑 + 1년차 baseline). Capability/Recipe/Effect Registry / Condition DSL 완전 AST / IA 7 섹션 / P1.5/P2 / Property Editor 이벤트 설정 제거 (108 에디터) = ADR-134 응용 |
| 2   | schema 직교성                 | ADR-131 events/actions root collection schema 정합 — Phase 4 (consumer rewrite) dual-write 후속. ADR-132 collections rename 와 직교 (events/actions vs data binding 영역)                                                                                                                                     |
| 3   | baseline framing reverse 검증 | ADR-131 Phase 5 G3 (ActionsPanel 별도 panel) UX 표면 결정 **partial reverse** — schema root collection 격상 결정 유지, UI 표면만 EventsPanel 흡수                                                                                                                                                             |
| 4   | codex 3차 미루지 말 것        | framing checkpoint 통과 + RAC/RSC 벤치마크 evidence + 5 결정 사용자 explicit confirm 후 본문 발의. codex 1차 review = 본문 발의 직후 trigger                                                                                                                                                                  |

### sub-decision D1~D9

| ID  | 결정                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 | scope                     |
| --- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------- |
| D1  | EventsPanel UI depth 4→2 축소 (default 표면) — L1 = element 의 RAC callback props list, L2 = inline expand 안 1-action binding. expand toggle = multi-action chain + condition + custom event (L4 power user 격리). **1년차 신입 OK 검증**: design Phase 0 에서 UI sketch + interaction flow 명시 + Phase 6 evaluator agent screenshot 검증                                                                                                                                                                                          | 본 ADR                    |
| D2  | Primary store canonical — `useEventsForTarget(elementId): SerializedEvent[]` + `useDocumentActions(): SerializedAction[]` direct read/write. legacy `element.props.events` 는 Pencil import/export adapter round-trip 만                                                                                                                                                                                                                                                                                                             | 본 ADR                    |
| D3  | action chain 모델 canonical — EventsPanel inline `actions[]` → `SerializedAction.next[]` chain. THEN/ELSE → `actionRef` / `fallbackActionRef`. action 정의는 element 내부 inline 생성하되 `document.actions[]` 에 자동 등록 (anonymous id)                                                                                                                                                                                                                                                                                           | 본 ADR                    |
| D4  | ActionsPanel 흡수 — `apps/builder/src/builder/panels/actions/` 디렉토리 전체 + `PanelId "actions"` 제거. cross-event reuse 는 EventsPanel 안 action 편집 시 "다른 event 에서도 사용" 토글 (toggle ON 시 anonymous id → named id 승격 + 다른 event 에서 picker 로 참조 가능)                                                                                                                                                                                                                                                          | 본 ADR                    |
| D5  | ADR-010 P0/P1 UI 표면 보존 — RecommendedEventsSection / TemplateSuggestionSection / RecommendedActionsChips / ActionBlock 누락 경고 4 영역. simplified UX 안 자연 위치 (callback list 빈 상태 / expand 안 action picker 영역)                                                                                                                                                                                                                                                                                                        | 본 ADR                    |
| D6  | condition placeholder lock-in — `EventHandler.condition: string` (JS expression) → `SerializedEvent.condition: {kind:"comparison" \| "raw", left?, op?, right?, expression?}` 1단계 AST + raw fallback. 완전 DSL 은 ADR-134 응용                                                                                                                                                                                                                                                                                                     | 본 ADR                    |
| D7  | debounce/throttle 확장 슬롯 — `SerializedEvent.debounce?: number / throttle?: number`. 현 Settings 섹션 → expand 안 inline                                                                                                                                                                                                                                                                                                                                                                                                           | 본 ADR                    |
| D8  | **breaking changes 3 종** (Q1+Q2+Q5):<br/>(a) `onClick` → `onPress` migration: EventType union 에서 `onClick` deprecated 마킹 + supportedEvents 갱신 + Pencil import adapter 1회 변환 + Inspector 측 element.props.events 마이그레이션 helper (1회 실행)<br/>(b) `onMouseEnter` / `onMouseLeave` → `onHoverStart` / `onHoverEnd` rename: EventType union deprecated 마킹 + 동일 migration<br/>(c) `onMouseDown` / `onMouseUp` / `onKeyPress` / `onDoubleClick` 4 종: EventType union 에서 제거 + Pencil import 시 무시 (warning log) | 본 ADR                    |
| D9  | **callback gap 전수 추가** (Q3):<br/>Table: `onRowAction` / `onSortChange` / `onResize` / `onResizeStart` / `onResizeEnd` / `onLoadMore` (6 종)<br/>SearchField: `onClear`<br/>ComboBox: `onInputChange`<br/>Press lifecycle: `onPressStart` / `onPressEnd` / `onPressChange` / `onPressUp` (4 종)<br/>Hover lifecycle: `onHoverChange` (1 종)<br/>총 13 신규 EventType + componentMeta.supportedEvents 갱신                                                                                                                         | 본 ADR                    |
| —   | Capability/Recipe/Effect Registry / BindingRef AST / Condition DSL 완전 AST / IA 7 섹션 renovation / ADR-010 P1.5/P2 / Property Editor 이벤트 설정 제거 (108 에디터)                                                                                                                                                                                                                                                                                                                                                                 | **ADR-134 응용 (미발의)** |

### 기각된 대안의 기각 사유

- **대안 B (scope 축소)**: 사용자 explicit confirm "ADR-133 안 흡수" (Q3) + Q1/Q2/Q5 4 결정 부정합. Q4 mental model "1년차 OK" baseline 정합 부족 (RAC convention 외 영역 학습 burden 잔존)
- **대안 C (현 상태 유지)**: 사용자 framing 4 항목 ("뎁스 너무 복잡" + "ActionsPanel 뭐하는 기능?" + "1년차 OK" + RAC convention 정합) 전수 미해소. 본 ADR 발의 동기 자체 충족 부재

### 3 ADR (010/032/034) 폐기 처리

사용자 결정 (2026-05-13): **Status:Deprecated + docs/adr/completed/ 이동**.

본 ADR-133 과 함께 동반 commit:

- `docs/adr/010-events-panel.md` → `docs/adr/completed/010-events-panel.md` + Status 마킹
- `docs/adr/032-events-data-integration.md` → `docs/adr/completed/032-events-data-integration.md` + Status 마킹
- `docs/adr/034-events-panel-renovation.md` → `docs/adr/completed/034-events-panel-renovation.md` + Status 마킹
- README.md 의 010/032/034 행 → "Deprecated by ADR-133" 마킹 + 위치 갱신

historical context 보존 — 본문 archive (completed/ 이동) 만, 본문 삭제 금지.

## Risks

| ID  | 위험                                                                                                                                                                                             | 심각도 | 대응                                                                                                                                                                                                                               |
| --- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | :----: | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| R1  | EventsPanel.tsx 884 LOC 전면 재작성 — UI 회귀 표면 넓음 + 1년차 신입 OK baseline 검증 부족 시 사용자 만족도 ↓                                                                                    |  MED   | Phase 0 inventory baseline freeze + Phase 1 design (UI sketch + interaction flow) 사용자 review + Phase 6 evaluator agent screenshot evidence (Chrome MCP) + cross-check skill. ADR-010 P0/P1 UI 표면 4 영역 보존 grep gate        |
| R2  | legacy `EventHandler` ↔ canonical `SerializedEvent` adapter round-trip 회귀 — Pencil import/export + 신규 EventsPanel write path 양방향                                                          |  MED   | ADR-131 Phase 2 `rootCollectionMigration.ts` round-trip test 17/17 유지 + 신규 EventsPanel ↔ canonical write path round-trip test 추가. 회귀 시 adapter 정정                                                                       |
| R3  | breaking changes 3 종 (Q1 onClick / Q2 onMouseEnter/Leave / Q5 4 종 제거) 마이그레이션 — 기존 element.props.events / Pencil 데이터에 deprecated EventType 잔존 가능                              |  MED   | Phase 4 migration helper (1회 실행 — `migrateLegacyEventTypes(elements: Element[])`): onClick→onPress / onMouseEnter→onHoverStart / onMouseLeave→onHoverEnd / 4 종 제거. Pencil import 시 동일 helper 적용. type-check + grep gate |
| R4  | callback gap 13 신규 EventType (Table 6 + SearchField 1 + ComboBox 1 + Press 4 + Hover 1) 추가 — componentMeta.supportedEvents + EVENT_REGISTRY + IMPLEMENTED_EVENT_TYPES 갱신 누락 시 UI 미노출 |  LOW   | Phase 3 callback gap 추가 시 4-way 갱신 (EventType union + EVENT_REGISTRY + IMPLEMENTED_EVENT_TYPES + COMPONENT_EVENT_SUPPORT 각 컴포넌트 metadata). grep gate                                                                     |
| R5  | ActionsPanel 제거 시 ADR-131 Phase 6 G4 grep gate (`x-composition.events\|actions\|dataBinding` direct access 0건 차단) 영향                                                                     |  LOW   | ActionsPanel 의 `useDocumentActions` / `useCanonicalDocumentStore.getState().addAction` 류는 EventsPanel 안 inline action 편집으로 이관 — boundary allowlist 내 유지. G4 grep gate 영향 0                                          |
| R6  | condition `string` → `Record<string, unknown>` 1단계 AST placeholder 전환 시 기존 핸들러 condition 마이그레이션                                                                                  |  LOW   | Phase 2 adapter 가 `parseConditionString` 역변환 helper 활용. AST 미지원 케이스는 raw string 보존 (`{kind:"raw", expression}`) fallback                                                                                            |
| R7  | cross-event action reuse "다른 event 에서도 사용" 토글 UX 회귀 — action id rename / 삭제 시 referencing event 영향                                                                               |  MED   | Phase 5 action 편집 시 referencing event 표시 (`useEventsForTarget` 역인덱스) + 삭제 시 confirm. canonical store 의 `removeAction` 호출 시 referencing event 의 `actionRef` cleanup                                                |
| R8  | type-check baseline 602 freeze 위반 가능성 — EventsPanel 재작성 + breaking changes + callback gap 추가 시 신규 위반                                                                              |  MED   | Phase 별 `pnpm type-check` 검증 + Phase 종료 commit 직전 baseline 확인 (CLAUDE.md Stop hook 자동 검증). 위반 발견 시 Phase 분해 (R1 mitigation 과 결합)                                                                            |
| R9  | 1년차 신입 mental model 검증 부족 — UI sketch / interaction flow 가 실제 1년차 신입 사용 가능 수준인지 객관 검증 부재                                                                            |  MED   | Phase 1 design 시 UI sketch 사용자 review + Phase 6 evaluator agent (Chrome MCP) + Storybook story 추가 + (선택) 1년차 신입 개발자 동료 user test 1회                                                                              |
| R10 | scope inflation MED-HIGH (D8 breaking 3 + D9 callback gap 13) — Phase 분해 시 진행 단계 다단계 (8-9 phase) 예상                                                                                  |  MED   | design breakdown Phase 분해 + Gate (`feedback-execute-adr-surface-minimization` 차단 카테고리 정합 — Phase 단위 진행 + sub-phase 분해 금지)                                                                                        |
| R11 | Pencil import 시 legacy EventType (onClick / onMouseEnter/Leave / 4 종 제거 대상) 변환 helper 누락 시 import 실패 또는 silent drop                                                               |  LOW   | Phase 4 helper 에 import path 분기 (Pencil adapter / Inspector 마이그레이션 2 경로 통합 helper). Pencil import e2e test 1회 추가                                                                                                   |

잔존 HIGH 위험 0건.

## Gates

| Gate         | 시점                                                         | 통과 조건                                                                                                                                                                                                                                                                                                                               | 실패 시 대안                                 |
| ------------ | ------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------- |
| G1 (Phase 1) | UI design lock-in 후 사용자 review 통과                      | UI sketch + interaction flow + 1년차 신입 mental model 검증 항목 lock-in. 사용자 explicit confirm (AskUserQuestion)                                                                                                                                                                                                                     | UI design 재작성                             |
| G2 (Phase 2) | canonical primary 전환 land 직후                             | `grep -rn "element\.events\|selectedElement\.events\|props\?\.events" apps/builder/src/builder/panels/events` = 0건 (boundary 외) + `useEventsForTarget` 호출 1+ 건 + Pencil adapter round-trip test PASS                                                                                                                               | adapter round-trip 재정합 또는 boundary 확장 |
| G3 (Phase 3) | breaking changes 3 종 + callback gap 13 추가 land 직후       | EventType union 갱신 (deprecated 3 + 제거 4 + 신규 13) + EVENT_REGISTRY + IMPLEMENTED_EVENT_TYPES + COMPONENT_EVENT_SUPPORT 4-way 갱신 grep gate + migration helper 단위 test PASS + `grep -rn "onMouseDown\|onMouseUp\|onKeyPress\|onDoubleClick" apps/builder/src/types/events` = 0건                                                 | callback 추가/제거 보강                      |
| G4 (Phase 4) | migration helper 1회 실행 + Pencil adapter 통합 직후         | 마이그레이션 1회 실행 결과 — deprecated EventType (onClick / onMouseEnter/Leave / 4 종 제거 대상) grep 0건 (boundary 외) + Pencil import e2e test PASS                                                                                                                                                                                  | helper 분기 보강                             |
| G5 (Phase 5) | UI depth 2 + ActionsPanel 흡수 land 직후                     | EventsPanel UI = element callback props list (L1) + inline expand action chain (L2). overlay (`ActionPickerOverlay` / action editor overlay) 제거 — `action-editor-overlay` / `action-picker-overlay` CSS class 0건. `apps/builder/src/builder/panels/actions/` 디렉토리 부재 + `PanelId "actions"` 0건. Chrome MCP screenshot evidence | UI 재설계                                    |
| G6 (Phase 6) | ADR-010 P0/P1 UI 표면 보존 검증 + evaluator agent screenshot | RecommendedEventsSection / TemplateSuggestionSection / RecommendedActionsChips / ActionBlock 누락 경고 4 영역 UI 표면 유지 grep gate + evaluator agent (Chrome MCP) screenshot 비교 (구 panel ↔ 신 panel) + 1년차 신입 mental model 검증 OK                                                                                             | UI 표면 복원 또는 design 재작성              |
| G7 (Phase 7) | Status Implemented 직전                                      | G1-G6 모두 통과 + type-check 3/3 PASS (baseline 602 freeze) + vitest PASS + Chrome MCP smoke 5 element type (Button / Select / Form / Table / Dialog) PASS + README + CHANGELOG 갱신                                                                                                                                                    | Phase 별 rollback                            |

## Consequences

### Positive

- 사용자 framing "뎁스 너무 복잡" 정정 — 4 depth → 2 depth (default), overlay 0
- 사용자 framing "ActionsPanel 뭐하는 기능이지?" 정정 — 별도 panel 제거, cross-event reuse 는 inline 자연 노출
- 사용자 framing "1년차 신입 OK" baseline — RAC 정통 mental model 정합 + UI design Phase 1 검증
- ADR-131 canonical schema 가치 (cross-event reuse / DAG chain / id 참조) UI 표면 land — schema 만 존재하던 dual-write 정합 완결
- RAC 정통 mental model 정합 — `props.onPress` 가 사용자 단일 질문 단위 + RAC convention (onClick 대신 onPress / onMouseEnter 대신 onHoverStart) 정렬
- callback gap 전수 cover — Table / SearchField / ComboBox / Press lifecycle / Hover lifecycle 13 신규 EventType
- ADR-010 P0/P1 100% land 가치 보존 — 사용자 가치 검증된 4 영역 UI 표면 그대로
- 3 ADR (010/032/034) historical context 보존 + supersede chain 명확 — git log + README 추적 가능
- ADR-134 응용 영역 분리 lock-in — 추가 발의 시점 framing checkpoint 별도 통과 필수

### Negative

- EventsPanel.tsx 884 LOC 전면 재작성 — UI 회귀 표면 넓음 (R1 mitigation)
- legacy `EventHandler` adapter round-trip 영원 유지 — Pencil import/export 호환 비용
- ActionsPanel 제거 시 ADR-131 Phase 5 G3 결정 partial reverse — historical context 에 supersede chain 추가 (cleanup 비용 LOW)
- condition AST 1단계 placeholder lock-in — 완전 DSL 미지원 시점에 raw string fallback (`{kind:"raw", expression}`) 분기 존재
- **breaking changes 3 종 마이그레이션 cost** — onClick / onMouseEnter/Leave / 4 종 제거 의 element.props.events + Pencil 데이터 마이그레이션 helper 1회 실행 + 사용자 안내
- **callback gap 13 신규 EventType 추가 cost** — EventType union + EVENT_REGISTRY + IMPLEMENTED_EVENT_TYPES + COMPONENT_EVENT_SUPPORT 4-way 갱신 + 신규 callback 처리 (Inspector + Skia 측 supportedEvents 표시)
- ADR-134 응용 영역 (capability/recipe/condition DSL 완전 AST 등) 별 ADR 발의 시 framing checkpoint 4 질문 + scope 분류 검증 cost

## References

- [ADR-131: events/data/actions 일급 컴포넌트 루트 컬렉션](completed/131-events-data-actions-first-class-collections.md) — schema base (Phase 5 G3 ActionsPanel UX 결정 partial reverse 대상). Implemented 2026-05-13
- [ADR-132: useCollectionData useAsyncList 정합 + collections rename + Transformer 제거](132-usecollectiondata-useasynclist-alignment.md) — collections rename baseline
- [ADR-110: Canonical Themes / Variables](completed/110-canonical-themes-variables-land-plan.md) — root collection 패턴 baseline
- [ADR-116: Canonical Document SSOT 전환](completed/116-canonical-document-ssot-transition.md) — Phase 5 §3 partial supersede (ADR-131 경유)
- [ADR-063: SSOT Chain Charter](completed/063-ssot-chain-charter.md) — 3-domain 분할 정본 (D2 Props/API 정합 결정)
- [ADR-010: Events Panel Smart Recommendations](completed/010-events-panel.md) — Deprecated by ADR-133
- [ADR-032: Events Platform 재설계 v2](completed/032-events-data-integration.md) — Deprecated by ADR-133
- [ADR-034: Events Panel Renovation](completed/034-events-panel-renovation.md) — Deprecated by ADR-133
- RAC/RSC 벤치마크 evidence: `~/.claude/plans/rac-rsc-event-callback-benchmark.md`
- React Aria Components docs: https://react-spectrum.adobe.com/react-aria/
- React Spectrum docs: https://react-spectrum.adobe.com/
