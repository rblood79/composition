# ADR-133 Design Breakdown — EventsPanel UX 단순화 + canonical 단일화 + RAC 정합

> 본 문서는 [ADR-133](../completed/133-events-panel-simplification.md) 의 구현 상세. Phase 0~7 + Gate.
>
> **Deprecated — 2026-07-08** — ADR-133 폐기 (개별 재설계 대상)에 따라 본 breakdown 은 historical reference. 재설계 ADR 의 전제 검증 자료로만 참조.

## 1. framing checkpoint lock-in (ADR 본문 §framing checkpoint 4 질문 참조)

본 ADR-133 의 framing 통과 항목:

- **base/응용 분류**: base ADR — UX simplification + canonical schema primary + breaking changes + callback gap 전수 추가 = 단일 framing
- **schema 직교성**: ADR-131 events/actions root collection 후속, ADR-132 collections rename 와 직교
- **baseline framing reverse**: ADR-131 Phase 5 G3 (ActionsPanel 별도 panel) **UX 표면 결정만 partial reverse**. schema root collection 격상은 유지
- **codex 3차 미루지 말 것**: 본 ADR 본문 발의 직후 codex 1차 review trigger
- **사용자 explicit confirm 5 결정 (Q1-Q5)**: onClick deprecation / onMouseEnter/Leave rename / callback gap ADR-133 안 흡수 / mental model 1년차 baseline / 4 종 제거

## 2. Phase 분해 + Gate

### Phase 0: Inventory baseline freeze

**목적**: 전수 grep baseline 확보 + 영향 site 수치화. design 추정 vs 실측 gap 1.5x 이상 시 framing trigger (사용자 AskUserQuestion 의무).

**작업**:

1. baseline grep (ADR 본문 §baseline grep 항목 전수):
   - legacy event/action 직접 read/write site (`element\.events` / `props\?\.events` / `EventHandler\b` / `EventAction\b`)
   - ActionsPanel 영역 (`ActionsPanel\b` / `"actions" as PanelId`)
   - condition string flow (`parseConditionString` / `handleConditionsChange`)
   - breaking change 영향 (`onClick\b` / `onMouseEnter\b` / `onMouseLeave\b` / `onMouseDown\b` / `onMouseUp\b` / `onKeyPress\b` / `onDoubleClick\b`)
   - callback gap 추가 site (`onRowAction` / `onSortChange` / `onResize` / `onResizeStart` / `onResizeEnd` / `onLoadMore` / `onClear\b` / `onInputChange\b` / `onPressStart` / `onPressEnd` / `onPressChange` / `onPressUp` / `onHoverChange\b`)
2. commit hash + 각 grep 수치 baseline freeze (본 design 문서 §3 baseline freeze 표 에 기록)
3. ADR-010 P0/P1 UI 표면 4 영역 (RecommendedEventsSection / TemplateSuggestionSection / RecommendedActionsChips / ActionBlock 누락 경고) 보존 grep gate baseline

**산출물**:

- Phase 0 baseline freeze 표 (이 design 문서 §3 갱신)
- `~/.claude/plans/adr-133-phase0-inventory.md` (수치 detail)

**Gate**: 없음 (inventory 만, 통과 조건 = baseline frozen 표 land + 사용자 review)

---

### Phase 1: UI design lock-in (1년차 신입 mental model 검증)

**목적**: default 표면 (L1 callback props list + L2 inline expand 1-action binding) + expand 표면 (L4 multi-action chain) UI sketch + interaction flow lock-in. **1년차 신입 OK baseline 검증 필수**.

**작업**:

1. UI sketch 작성 (3 상태):
   - 빈 상태 (handlers 0): callback props list + 추천 chips + 템플릿 카드 (ADR-010 P0 UI 표면 보존)
   - 일반 상태 (handlers > 0): callback props list (등록된 행 = expand 가능, 미등록 행 = "추가" 버튼)
   - expand 상태 (L2): inline 1-action picker + 추천 액션 chips (ADR-010 P1) + expand toggle (L4 power user)
2. Interaction flow 정의:
   - "Button 의 onPress 에 navigate 추가" — 1년차 신입이 몇 step?
   - "Form 의 onSubmit 에 condition 추가" — power user 영역, expand toggle 진입
   - "Table 의 onRowAction 에 action 추가" — 신규 callback gap 13 종 노출 흐름
3. 1년차 신입 mental model 검증 항목:
   - default 표면에서 "이 element 가 무엇을 할 수 있는가" 파악 = 1 step
   - "원하는 callback 의 handler 추가" = 2 step (행 클릭 + action 선택)
   - 학습 burden 측정 (RAC props 명 인지 / 추상 개념 학습)
4. ADR-010 P0/P1 UI 표면 4 영역 자연 위치 명시:
   - RecommendedEventsSection → 빈 상태 분기 상단
   - TemplateSuggestionSection → 빈 상태 분기 (RecommendedEventsSection 아래)
   - RecommendedActionsChips → expand 안 action picker 영역
   - ActionBlock 누락 경고 → expand 안 action 행 inline (AlertTriangle 아이콘)

**산출물**:

- UI sketch (ASCII art 또는 figma link) — `~/.claude/plans/adr-133-phase1-ui-design.md`
- Interaction flow 표 (3 상태 × 5 시나리오)
- 1년차 신입 mental model 검증 항목 list

**Gate G1**: UI sketch + interaction flow + 1년차 신입 mental model 검증 항목 lock-in. 사용자 explicit confirm (AskUserQuestion).

**실패 시**: UI design 재작성. 1년차 신입 OK baseline 미충족 시 default 표면 단순화 loop (max 2회).

---

### Phase 2: Canonical primary 전환 (D2)

**목적**: EventsPanel 의 primary store 를 canonical hook 으로 전환. legacy `element.props.events` 직접 access 제거.

**작업**:

1. `EventsPanel.tsx` 의 `selectedElement.events` direct read → `useEventsForTarget(selectedElement.id)` 전환
2. `updateEvents(handlers)` → `useCanonicalDocumentStore.getState().setEvents/addEvent/updateEvent/removeEvent` 전환
3. legacy `EventHandler` ↔ canonical `SerializedEvent` write path round-trip helper 추가 (`apps/builder/src/builder/stores/canonical/eventsWriteAdapter.ts` 신규)
4. Pencil import/export adapter (`rootCollectionMigration.ts`) round-trip test 17/17 유지 + 신규 write path round-trip test 추가
5. boundary allowlist 외 direct access grep gate 0건 확증

**산출물**:

- `apps/builder/src/builder/stores/canonical/eventsWriteAdapter.ts` 신규
- EventsPanel.tsx 의 store access 전환 diff
- 회귀 test (round-trip + UI smoke)

**Gate G2**: `grep -rn "element\.events\|selectedElement\.events\|props\?\.events" apps/builder/src/builder/panels/events` = 0건 (boundary 외) + `useEventsForTarget` 호출 1+ 건 + Pencil adapter round-trip test PASS

**실패 시**: adapter round-trip 재정합 또는 boundary 확장 (allowlist 추가).

---

### Phase 3: Breaking changes 3 종 + callback gap 13 신규 추가 (D8 + D9)

**목적**: EventType union + EVENT_REGISTRY + IMPLEMENTED_EVENT_TYPES + COMPONENT_EVENT_SUPPORT 4-way 갱신.

**작업**:

1. **D8(a) onClick deprecation**:
   - `apps/builder/src/types/events/events.types.ts` 의 EventType union 에서 `onClick` → `@deprecated ADR-133` 마킹 (유지하되 deprecated)
   - `EVENT_REGISTRY` 의 `onClick` 항목 deprecated 마킹
   - `COMPONENT_EVENT_SUPPORT` 의 `onClick` → `onPress` 자동 치환 (실 사용 컴포넌트 metadata 갱신)
2. **D8(b) onMouseEnter/Leave rename**:
   - `onMouseEnter` → `@deprecated ADR-133, use onHoverStart`
   - `onMouseLeave` → `@deprecated ADR-133, use onHoverEnd`
   - `onHoverStart` / `onHoverEnd` 신규 추가 (EventType + registry + supportedEvents)
3. **D8(c) 4 종 제거**:
   - `onMouseDown` / `onMouseUp` / `onKeyPress` / `onDoubleClick` EventType union 에서 제거
   - `IMPLEMENTED_EVENT_TYPES` Set 에서 제거
   - `EVENT_REGISTRY` 의 항목 제거
   - `COMPONENT_EVENT_SUPPORT` 에서 제거
4. **D9 callback gap 13 신규 추가**:
   - Table 6 종: `onRowAction` / `onSortChange` / `onResize` / `onResizeStart` / `onResizeEnd` / `onLoadMore`
   - SearchField: `onClear`
   - ComboBox: `onInputChange`
   - Press lifecycle 4 종: `onPressStart` / `onPressEnd` / `onPressChange` / `onPressUp`
   - Hover lifecycle: `onHoverChange`
   - 4-way 갱신 (EventType + EVENT_REGISTRY + IMPLEMENTED_EVENT_TYPES + COMPONENT_EVENT_SUPPORT)
5. type-check baseline 602 freeze 검증

**산출물**:

- 4-way 갱신 diff
- 신규 callback metadata (label / description / category)

**Gate G3**: EventType union 갱신 (deprecated 3 + 제거 4 + 신규 13) + EVENT_REGISTRY + IMPLEMENTED_EVENT_TYPES + COMPONENT_EVENT_SUPPORT 4-way 갱신 grep gate + migration helper 단위 test PASS + `grep -rn "onMouseDown\|onMouseUp\|onKeyPress\|onDoubleClick" apps/builder/src/types/events` = 0건

**실패 시**: callback 추가/제거 보강 + 4-way 정합 재검증.

---

### Phase 4: Migration helper + Pencil adapter 통합

**목적**: breaking changes 3 종 의 element.props.events / Pencil 데이터 1회 마이그레이션.

**작업**:

1. `migrateLegacyEventTypes(elements: Element[])` helper 작성 (`apps/builder/src/builder/utils/migration/legacyEventTypes.ts` 신규):
   - onClick → onPress (event handler 동일 binding)
   - onMouseEnter → onHoverStart / onMouseLeave → onHoverEnd
   - onMouseDown / onMouseUp / onKeyPress / onDoubleClick → 제거 + warning log
2. Pencil import adapter (`pencil-adapter` 또는 `rootCollectionMigration.ts`) 에 helper 통합 — Pencil import 시점 1회 호출
3. Inspector 측 element.props.events 마이그레이션 helper 호출 (앱 시작 시 1회, `BuilderCore.tsx` 또는 `useStore` init)
4. Pencil import e2e test 1회 추가 (Pencil 데이터에 onClick / onMouseEnter 포함 시 자동 변환 확증)

**산출물**:

- `legacyEventTypes.ts` 신규
- Pencil adapter 통합 diff
- e2e test PASS evidence

**Gate G4**: 마이그레이션 1회 실행 결과 — deprecated EventType (onClick / onMouseEnter/Leave / 4 종 제거 대상) grep 0건 (boundary 외) + Pencil import e2e test PASS

**실패 시**: helper 분기 보강 (Pencil adapter vs Inspector 2 경로 통합).

---

### Phase 5: UI depth 2 + ActionsPanel 흡수 (D1 + D3 + D4)

**목적**: EventsPanel.tsx 전면 재작성 + ActionsPanel 디렉토리 제거.

**작업**:

1. `EventsPanel.tsx` 884 LOC 전면 재작성:
   - L1 callback props list view (element 의 RAC callback props 표시)
   - L2 inline expand (각 행 클릭 시 1-action binding picker)
   - L4 expand toggle (multi-action chain + condition + debounce/throttle)
   - overlay 제거 (ActionPickerOverlay / BlockActionEditor overlay → inline)
2. `apps/builder/src/builder/panels/actions/` 디렉토리 전체 제거:
   - `ActionsPanel.tsx` / `ActionsPanel.css` / `index.ts` 삭제
3. `PanelId "actions"` 제거 (`apps/builder/src/builder/panels/core/types.ts` 또는 panel registry)
4. inline cross-event reuse 토글:
   - action 편집 시 "다른 event 에서도 사용" 토글
   - toggle ON 시 anonymous id (`action_${timestamp}`) → named id 승격 (사용자 입력)
   - 다른 event 의 action picker 에서 named action 참조 가능
   - referencing event 역인덱스 표시 (`useEventsForTarget` 활용)
5. condition placeholder lock-in (D6):
   - `SerializedEvent.condition: {kind:"comparison" | "raw", left?, op?, right?, expression?}` schema 1단계 AST
   - UI = 단순 left/op/right 3-field input (comparison) + raw textarea fallback
6. debounce/throttle (D7):
   - `SerializedEvent.debounce?: number / throttle?: number`
   - UI = expand 안 inline NumberInput (Settings 섹션 표면 제거)

**산출물**:

- `EventsPanel.tsx` 신규 (목표 ~400 LOC, 884 LOC → 50% 감축)
- `apps/builder/src/builder/panels/actions/` 디렉토리 제거 diff
- inline cross-event reuse 토글 UI

**Gate G5**: EventsPanel UI = element callback props list (L1) + inline expand action chain (L2). overlay (`ActionPickerOverlay` / action editor overlay) 제거 — `action-editor-overlay` / `action-picker-overlay` CSS class 0건. `apps/builder/src/builder/panels/actions/` 디렉토리 부재 + `PanelId "actions"` 0건. Chrome MCP screenshot evidence

**실패 시**: UI 재설계 (1년차 신입 mental model 미충족 시 default 표면 단순화).

---

### Phase 6: ADR-010 P0/P1 UI 표면 보존 검증 + evaluator agent screenshot (D5)

**목적**: 사용자 가치 검증된 4 영역 (RecommendedEventsSection / TemplateSuggestionSection / RecommendedActionsChips / ActionBlock 누락 경고) UI 표면 유지 확증.

**작업**:

1. 4 영역 grep gate (각 component import 1+ 건 확증)
2. Chrome MCP screenshot evidence — 구 panel ↔ 신 panel 비교 (4 영역 시각 유지 확증)
3. evaluator agent (Chrome MCP) 호출 — 1년차 신입 mental model 검증:
   - "Button 의 onPress 에 navigate 추가" 시나리오 step 수 (목표 ≤ 3)
   - "Form 의 onSubmit 에 condition 추가" 시나리오 step 수 (목표 ≤ 5)
   - 학습 burden 평가 (RAC props 명 노출 + 추상 개념 학습 최소화)
4. Storybook story 추가 (3 상태 × 5 element type — Button / Select / Form / Table / Dialog)

**산출물**:

- evaluator agent screenshot 비교 보고서
- Storybook stories
- 1년차 신입 mental model 검증 결과

**Gate G6**: RecommendedEventsSection / TemplateSuggestionSection / RecommendedActionsChips / ActionBlock 누락 경고 4 영역 UI 표면 유지 grep gate + evaluator agent (Chrome MCP) screenshot 비교 (구 panel ↔ 신 panel) + 1년차 신입 mental model 검증 OK

**실패 시**: UI 표면 복원 또는 design 재작성 (Phase 1 loop).

---

### Phase 7: Status Implemented + README + CHANGELOG (D + 폐기)

**목적**: ADR-133 Status:Implemented 승격 + 3 ADR (010/032/034) Deprecated 이동 + README + CHANGELOG.

**작업**:

1. ADR-133 Status:Proposed → Implemented + 진행 로그 갱신
2. `docs/adr/010-events-panel.md` → `docs/adr/completed/010-events-panel.md` + Status:Deprecated 마킹
3. `docs/adr/032-events-data-integration.md` → `docs/adr/completed/032-events-data-integration.md` + Status:Deprecated 마킹
4. `docs/adr/034-events-panel-renovation.md` → `docs/adr/completed/034-events-panel-renovation.md` + Status:Deprecated 마킹
5. README.md 갱신:
   - ADR-133 entry 추가
   - 010/032/034 행 "Deprecated by ADR-133" 마킹 + 위치 갱신 (completed/ 경로)
   - P3/P5 우선순위 항목에서 010/032/034 정리
6. CHANGELOG.md 엔트리 (Architecture 섹션):
   - "EventsPanel UX 단순화 — ADR-133 Implemented (Phase 0~7 완결)"
   - Why / 변경 영역 / Migration cost
7. type-check 3/3 PASS 검증
8. vitest PASS 검증
9. Chrome MCP smoke 5 element type PASS 검증

**산출물**:

- ADR-133 Status:Implemented
- 3 ADR Deprecated + completed/ 이동 (mv)
- README + CHANGELOG diff

**Gate G7**: G1-G6 모두 통과 + type-check 3/3 PASS (baseline 602 freeze) + vitest PASS + Chrome MCP smoke 5 element type (Button / Select / Form / Table / Dialog) PASS + README + CHANGELOG 갱신

**실패 시**: Phase 별 rollback. type-check 신규 위반 시 영역 분해 + commit 단위 분리.

## 3. Phase 0 baseline freeze 표 (Phase 0 land 시점 갱신 — 현재 placeholder)

| 영역                       | grep target                                                         | 추정 count | 실측 count | commit hash | gap 1.5x 이상? |
| -------------------------- | ------------------------------------------------------------------- | :--------: | :--------: | :---------: | :------------: |
| legacy event read          | `element\.events\|selectedElement\.events\|props\?\.events`         |     ~5     |    TBD     |     TBD     |      TBD       |
| legacy EventHandler import | `\bEventHandler\b\|\bEventAction\b`                                 |    ~30     |    TBD     |     TBD     |      TBD       |
| ActionsPanel 영역          | `\bActionsPanel\b\|"actions" as PanelId`                            |    ~10     |    TBD     |     TBD     |      TBD       |
| condition string flow      | `parseConditionString\|handleConditionsChange`                      |     ~5     |    TBD     |     TBD     |      TBD       |
| onClick 영향               | `\bonClick\b`                                                       |    ~20     |    TBD     |     TBD     |      TBD       |
| onMouseEnter/Leave 영향    | `\bonMouseEnter\b\|\bonMouseLeave\b`                                |    ~10     |    TBD     |     TBD     |      TBD       |
| 4 종 제거 대상             | `\bonMouseDown\b\|\bonMouseUp\b\|\bonKeyPress\b\|\bonDoubleClick\b` |     ~5     |    TBD     |     TBD     |      TBD       |
| callback gap 13 신규       | (각 신규 callback grep)                                             |     0      |    TBD     |     TBD     |      TBD       |
| ADR-010 P0/P1 4 영역 보존  | (각 component import)                                               |     4      |    TBD     |     TBD     |      TBD       |

Phase 0 종료 후 본 표를 update. 1.5x 이상 gap 발견 시 [feedback-adr-revert-after-review-fatigue](../../../~/.claude/projects/-Users-admin-work-composition/memory/feedback-adr-revert-after-review-fatigue.md) 차단 3 질문 자기-인용 + 사용자 AskUserQuestion 의무.

## 4. scope 경계 명시

본 ADR-133 의 scope 안 / 밖 명확 분리:

### scope 안 (D1-D9)

- D1: EventsPanel UI depth 4→2 축소
- D2: Canonical primary 전환
- D3: action chain canonical (SerializedAction.next[])
- D4: ActionsPanel 흡수
- D5: ADR-010 P0/P1 UI 표면 보존
- D6: condition 1단계 AST placeholder
- D7: debounce/throttle 확장 슬롯
- D8: breaking changes 3 종 (onClick / onMouseEnter/Leave / 4 종 제거)
- D9: callback gap 13 신규 추가

### scope 밖 (ADR-134 응용, 미발의)

- Capability/Recipe/Effect Registry (자동 추론)
- BindingRef AST (stable id 참조 system)
- Condition DSL 완전 AST (현 1단계 placeholder 확장)
- IA 7 섹션 renovation (ConnectionStatusSection / RecommendedRecipesSection / HandlersListSection / HandlerEditorSection / DiagnosticsSection / PreviewSection)
- ADR-010 P1.5 (인라인 추가행 / 즉시 수정 / 최근 사용 / aria-live)
- ADR-010 P2 (AI 자연어 생성 / 커맨드 팔레트 / 시뮬레이션)
- Property Editor 이벤트 설정 제거 (108 에디터)

## 5. 위험 mitigation (ADR 본문 §Risks 참조)

| Risk ID | Phase           | mitigation                                                                    |
| ------- | --------------- | ----------------------------------------------------------------------------- |
| R1      | Phase 0 + 1 + 6 | inventory baseline + UI sketch 사용자 review + evaluator agent screenshot     |
| R2      | Phase 2         | round-trip helper + Pencil adapter test 17/17 + 신규 write path test          |
| R3      | Phase 4         | migration helper 1회 실행 + Pencil import e2e test                            |
| R4      | Phase 3         | 4-way 갱신 grep gate                                                          |
| R5      | Phase 5         | inline action 편집 이관 + boundary allowlist 유지                             |
| R6      | Phase 2         | parseConditionString 역변환 helper + raw fallback                             |
| R7      | Phase 5         | referencing event 역인덱스 + 삭제 confirm                                     |
| R8      | Phase 0~7 전체  | Phase 별 type-check + Stop hook                                               |
| R9      | Phase 1 + 6     | 1년차 신입 mental model 검증 항목 + evaluator agent                           |
| R10     | Phase 분해 전체 | Phase 단위 진행 + sub-phase 분해 금지 (execute-adr-surface-minimization 정합) |
| R11     | Phase 4         | helper 분기 통합 + e2e test                                                   |

## 6. ADR-134 응용 발의 시점 framing 의무

ADR-133 Status:Implemented 후 ADR-134 응용 발의 시:

1. framing checkpoint 4 질문 별도 통과 (base/응용 분류 / schema 직교성 / baseline framing reverse / codex 3차 미루지 말 것)
2. scope 분류 — Capability/Recipe/Effect/BindingRef/Condition DSL/IA renovation/P1.5/P2/Property Editor 이벤트 설정 제거 중 어느 sub-group 부터?
3. 사용자 explicit confirm 의무 (AskUserQuestion + 차단 카테고리 자기-인용)
4. ADR-133 의 D8/D9 추가 영역 (breaking changes / callback gap) 의 land 결과 영향 측정 — 1년차 신입 mental model 검증 결과가 ADR-134 응용 design 의 baseline

이 4 항목 통과 못 하면 ADR-134 응용 발의 차단.
