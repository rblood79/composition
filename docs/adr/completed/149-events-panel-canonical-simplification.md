# ADR-149: EventsPanel 전면 재설계 — 2-depth UX + canonical events/actions primary + RAC callback 정합

## Status

Implemented — 2026-07-19 (**delivered scope 명시**, Option A 재정의 — 사용자 confirm). **Delivered (Wave 1 편집)**: 2-depth EventsPanel(HC1) + canonical events/actions primary 편집(단일 write 진입점 `updateEventsRootCollection`) + ActionsPanel 제거(HC4) + dead EventHandlerFactory 은퇴 + 역방향 adapter `migrateRootCollectionToLegacy`(HC5) + round-trip 동등성. **별도 ADR 이관**: 실제 런타임 이벤트 동작 bridge(HC3 — publish `element.events` mismatch 수정 + Preview seam canonical 소비) + true 방향 역전(canonical-first write + canonical history) + cross-event reuse + Wave 2 RAC convention + builder-side reader canonical 전환(undo-정합성 의존). **재정의 사유**: Phase 3 recon 에서 원 전제(HC3 EventHandlerFactory canonical 소비 + R4 live 소비자 전환)가 거짓 판명 — 패널 이벤트를 올바로 소비하는 런타임 0개(EventHandlerFactory dead / Preview 미동작 / publish 이미 broken). 상세: 진행 로그 2026-07-19 Phase 3 항목 + [inventory §1-B 정정](../design/149-events-panel-inventory.md). (Accepted — 2026-07-19 리뷰 round 3 승인: round 1·2 이슈 전건 fixed, HIGH/CRITICAL 0, drift 0, 종결 계약 성립)

진행 로그:

- 2026-07-19 — **Accepted → Implemented (delivered scope)**. Wave 1 편집 scope(2-depth UI + canonical primary 편집 + ActionsPanel 정리 + 역방향 adapter + dead retire) 전건 main 머지 + 검증(type-check 63 PASS · vitest 34/34 · Chrome MCP live 2-depth UI + canonical write 실측). Wave 2 convention + 실제 런타임 동작 bridge + true 방향 역전 + cross-event reuse = 별도 ADR 이관(Option A, 사용자 confirm 2026-07-19). runtime bridge 후속 ADR 은 backlog note(README) 로 기록 — 이벤트 런타임 재설계(4 shape + 3 action 어휘 정합)는 별도 세션 create-adr.

- 2026-07-19 — **Phase 3 전제 붕괴 → Option A(retire+adapter) 재정의** (execute-adr, 사용자 confirm). Explore recon + 직접 grep 검증으로 breakdown Phase 3 전제(HC3 "EventHandlerFactory 가 canonical 소비" + R4 "live 소비자 전환")가 **거짓**임을 확정: (a) `EventHandlerFactory` import 소비처 0건 = **dead**, (b) `EventEngine.executeEvent` 유일 호출자가 그 dead factory = inert, (c) builder Preview 는 **이벤트 미동작**(`createEventHandlerMap` seam provider 0, renderer.types.ts:74 선언 + 14 소비처 전부 `?.`), (d) 유일 live 런타임 = publish `ElementRenderer.tsx:78` 이 `element.events`(props.events 아님) + `{trigger,payload}` read = 패널 저작 `props.events{event,config}` 와 **위치+shape 이중 mismatch(이미 broken)**. → **패널 이벤트를 올바로 소비하는 런타임 0개**. M3(추정 vs 실측 gap = inventory 보강, fork 금지) + 결정 지점 ④ 로 AskUserQuestion → 사용자 **Option A(축소: retire dead + adapter, 실제 런타임 동작 bridge 는 별도 ADR)** 선택.
- 2026-07-19 — **Phase 3-a (역방향 adapter migrateRootCollectionToLegacy, HC5) Implemented** (`424703388`). canonical root(SerializedEvent[]+SerializedAction[]) → legacy EventHandler[] 복원 (2026-05-15 제거된 rootEventsToLegacyByTarget 재도입) — target filter + actionRef chain(next[0]) 순회(순환 차단) + fallbackActionRef→elseActions + condition {expr}→string + fidelity slot 복원. forward fidelity 보강(event enabled/debounce/throttle + action delay/condition/enabled index-sig 보존). round-trip 동등성 test(legacy→forward→reverse→legacy identity, fidelity 포함). vitest 24/24 PASS.
- 2026-07-19 — **Phase 3-b (dead EventHandlerFactory 은퇴) Implemented** (`97932279d`, 사용자 삭제 승인). `utils/events/eventHandlers.ts` 삭제(import 0). `EventEngine`(eventEngine.ts)은 preview variable-sync live(App.tsx:111)라 보존 — executeEvent 경로는 caller-less(dead-in-live-class, 별도 정리 백로그). **3-c(builder-side reader canonical 전환) 이관**: canonical root 에 undo 통합 부재(Phase 2 실측 — undo 는 props.events 만 되돌리고 canonical stale)라 reader 를 canonical 로 바꾸면 undo 후 버그. props.events 가 undo-정합 read source → reader 전환은 canonical history 통합(별도 ADR)과 동반. type-check 63 PASS. 다음: 3-d(Phase 0 inventory 정정 + closure) → **runtime bridge/Wave 2/cross-event reuse/방향 역전은 별도 ADR**.
- 2026-07-19 — **Phase 2c (ActionsPanel 제거 HC4 + legacy events write 정리) 부분 Implemented** (execute-adr, `9fec3fe07`). `PanelId "actions"` 제거(types.ts) + panelConfigs 등록 제거(Workflow icon + ActionsPanel import) + dead selected-\* mutation 4종 제거(impl+interface + 훅 4종 + useInspectorActions aggregator events 4필드, 소비처 전수 0) + `syncEventsToRootCollection` delegate 제거(→ `updateEventsRootCollection` 이 `writeEventsToRootCollection` 직접 호출, 단일 write 진입점 확정). type-check 63 유지(DataBinding known error 라인 1251→1182 시프트), vitest 16/16. **live(Chrome MCP)**: 빌더 무에러 로드 + 인스펙터 탭 strip 정상(액션 탭 미존재) + `updateEventsRootCollection` inline write exercise → canonical `doc.events{onPress,target,actionRef}`+`doc.actions{navigate,path}` 반영 + 빈 events cleanup 정상. **`panels/actions/` 물리 삭제 = 사용자 승인 대기**(execute-adr file-delete 가드). **scope 판정(사후 보고)**: cross-event reuse 토글 + true 방향 역전(canonical-first write)은 2a legacy-first(inline actions) 아키텍처상 Phase 3 canonical-primary write 에 하드 의존(actionRef 공유 표현 불가) → Phase 3 이관. 2c 는 write-direction 독립 부분만 수행. 다음: Phase 3 (Preview 런타임 canonical 소비 전환 HC3 + 역방향 adapter HC5 + R4 live 소비자 전환 + 2c 이관분 + EventEngine test, **HIGH**).
- 2026-07-19 — **Phase 2b (EventsPanel 2-depth UI 재작성) Implemented** (execute-adr, `21eee5b27`). 878 LOC block editor 트리(WhenBlock/IfBlock/ThenElseBlock + overlay, depth 3~4) → 2-depth inline UX (HC1: depth ≤ 2, overlay 0). L1(`EventsPanel.tsx` ~330 LOC) = supportedEvents callback 목록(바인딩 상태 + 빈 상태 추천 chips①/템플릿②) / L2(`components/EventAccordionItem.tsx` 신규) = inline accordion(액션 목록 + inline BlockActionEditor[25종 재사용] + 추천 액션 chips③ + 누락 경고④ + 고급[조건/debounce·throttle] + 이벤트 제거). 쓰기 = 2a wrapper `updateEventsRootCollection`. **설계 결정(사후 보고)**: 읽기 = `selectedElement.events`(canonical-synced legacy projection) 유지 — canonical-hook 읽기는 역방향 adapter `migrateRootCollectionToLegacy`(제거됨, HC5 Phase 3 소유)에 결합되므로 2b 앞당김 시 round-trip 비대칭 회귀 표면 추가 → HC1(2b 실사용자 목표) + HC2 write 단일 진입점 충족하고 canonical-hook 읽기는 Phase 3 로 격리. **live 검증(Chrome MCP 1회 exercise)**: 8 callback 행 렌더 + 미설정 상태 → 프레스 펼침(overlay 0) → 추천 chip navigate 추가 → path=/home → **canonical store 실측** `doc.events{onPress,target,actionRef}`+`doc.actions{navigate,path:/home}` + undo/redo `/home↔/hom`. **전환기 gap(Phase 3, 소비자 0 무영향)**: canonical root 는 undo/redo 시 재파생 안 됨(R8 완결 Phase 3) / 패널 local state config-only undo 즉시 미반영(구 패널 동일, 회귀 아님). type-check 63 baseline PASS, vitest 6/6(2a 회귀) PASS. 다음: Phase 2c (ActionsPanel 흡수 + cross-event reuse 토글 + `panels/actions/` 제거 + PanelId "actions" 제거 + `syncEventsToRootCollection` 제거).
- 2026-07-19 — **Phase 2a (canonical write infra, R8 foundation) Implemented** (execute-adr, TDD). root-derive 로직을 `stores/canonical/rootCollectionEventsWrite.ts`(`writeEventsToRootCollection`)로 추출(6 test GREEN) + `syncEventsToRootCollection` delegate 전환(중복 제거) + store action `updateEventsRootCollection(elementId, events)` 신설 = `updateAndSave`(node projection+history+persist, R8) + root 파생. **설계 결정**: history 시스템이 노드-앵커(`CanonicalHistoryNodeEvent` insert/remove/move/update 4종, root-collection 배열 이벤트 타입 부재)라, Phase 2 는 transitional projection(props.events via updateAndSave)로 history/persist 를 확보하고 root collection 은 canonical-primary READ 뷰로 파생 — root-collection-native history event type 은 Phase 3(projection 제거) 과제로 격리. 4개 selected-\* 무변경(동작 보존, 위임은 2b). type-check 63 baseline 유지(라인 시프트 1건 baseline 갱신), vitest 27 PASS. 다음: Phase 2b (EventsPanel 2-depth UI 재작성).
- 2026-07-19 — **Phase 1 (UI design lock-in, G1) Implemented** (execute-adr). 2-depth UI design(L1 = supportedEvents callback list, L2 = inline accordion 1-action + 고급 toggle, ADR-010 4영역 배치, ActionsPanel 흡수) 사용자 explicit confirm (AskUserQuestion "승인 — Phase 2 착수"). lock-in design = [breakdown Phase 1](../design/149-events-panel-canonical-simplification-breakdown.md). 다음: Phase 2 (EventsPanel canonical primary 재작성 + ActionsPanel 흡수, MEDIUM).
- 2026-07-19 — **Phase 0 (Inventory freeze, G0) Implemented** (execute-adr). freeze commit `bf4e6aac4`, 산출물 [design/149-events-panel-inventory.md](../design/149-events-panel-inventory.md): legacy `props.events` 소비 2분류(boundary 7 site / live 8 site) + EventType union 24종 + type-check baseline 63/PASS + EventsPanel 878 LOC freeze. Phase 0 finding — `canvasDeltaMessenger.ts:241` 신규 live 소비자(`getElementEvents` 소비, Preview delta 페이로드) 발견 → R4 + breakdown §5 보강. 다음: Phase 1 (UI design lock-in, G1) = **AskUserQuestion 하드 게이트** (사용자 UI design confirm 전 Phase 2 진입 금지).
- 2026-07-19 — Proposed → **Accepted**. reviews/149.md round 3 재리뷰: 구조 7/7 PASS, 핵심 코드 정합 4/4 VERIFIED(eventHandlers legacy props.events 소비 / canonicalDocumentStore history 미통합 / migrateRootCollectionToLegacy 미구현 / workflowEdges live 소비자), round 1·2 이슈 종결 재확인, 2026-07-14 이후 drift 는 `b563085fe`(ADR-155 dead guard 정리, Phase 0 re-freeze 흡수) 1건뿐. 착수 시 G1(Wave 1 UI design 사용자 explicit confirm) 이 구현 전 게이트로 존속.
- 2026-07-08 — [ADR-133](133-events-panel-simplification.md) Deprecated (사용자 결정 "133은 폐기 후 재설계 대상") 의 후속으로 작성. 사용자 명시 지시 "ADR-133 설계목적만 파악후 전면 재설계 진행해" — 설계 목적 4개만 승계, 설계 구조는 2026-07-08 코드 실측 기반 신규.

## Context

### 승계된 설계 목적 (ADR-133 → 본 ADR)

| #   | 목적                                                                             | 원 사용자 지시 (2026-05-13, ADR-133 인용)                                               |
| --- | -------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------- |
| P1  | EventsPanel 편집 depth 축소 (default 표면 2 depth, overlay 0)                    | "현재 이벤트패널은 뎁스뎁스 너무 단계가 복잡하다" + "1년차 신입 개발자라도 사용할 수준" |
| P2  | canonical events/actions root collection **primary 전환** (ADR-131 가치 실현)    | —                                                                                       |
| P3  | ActionsPanel 의 EventsPanel 흡수 (별도 패널 제거)                                | "ActionsPanel 은 뭐하는 기능이지?"                                                      |
| P4  | RAC callback convention 정합 (non-recommended 7종 정리 + 세부 callback gap 보강) | "RAC,RSC 의 이벤트 샘플부터 벤치마크를 해야"                                            |

### 2026-07-08 현행 실측 (재설계 baseline — ADR-133 시점 대비 실질 무변화 + 신규 확인 2건)

| 축                         | 실측                                                                                                                     | 증거                                                                            |
| -------------------------- | ------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------- |
| EventsPanel                | 883 LOC, legacy `element.props.events` read/write primary, WhenBlock/IfBlock/ThenElseBlock + BlockActionEditor 3~4 depth | `panels/events/EventsPanel.tsx:282,349` / `inspector/utils/elementMapper.ts:44` |
| dual-write                 | legacy 1차 기록 + `syncEventsToRootCollection` **one-way mirror** (legacy→canonical)                                     | `builder/stores/inspectorActions.ts:290,980-1028`                               |
| **런타임 (신규 1급 축)**   | Preview EventEngine 이 `element.props.events` 만 소비 — canonical root collection **런타임 미소비**                      | `utils/events/eventHandlers.ts:44,80` / `utils/events/eventEngine.ts:186`       |
| canonical hooks 소비       | `useEventsForTarget`/`useDocumentEvents` 소비자 **0**, `useDocumentActions` = ActionsPanel 1곳                           | `stores/canonical/canonicalElementsBridge.ts:142,161,187`                       |
| ActionsPanel               | 154 LOC minimum-viable stub (kind 별 config UI 없음), `PanelId "actions"` 등록                                           | `panels/actions/ActionsPanel.tsx` / `panels/core/panelConfigs.ts:212`           |
| EventType union            | DOM 계열 7종 전부 잔존 (onClick/onMouse\*4/onKeyPress/onDoubleClick), RAC hover/press lifecycle 부재                     | `types/events/events.registry.ts:32-128`                                        |
| supportedEvents            | `ComponentMeta.supportedEvents` (metadata) — catalog 미흡수 (ADR-142 가 events 를 binding 흡수 대상에서 제외 선언)       | `packages/shared/src/components/metadata.ts:21`                                 |
| 역방향 adapter (신규 확인) | canonical→legacy `migrateRootCollectionToLegacy` **주석만 존재, 미구현**                                                 | `adapters/canonical/rootCollectionMigration.ts:19`                              |
| 테스트                     | canonical adapter/store 측 ~88 케이스. **EventsPanel / EventEngine 자체 단위 test 사실상 0**                             | `rootCollectionMigration.test.ts` (11) 외                                       |

### ADR-133 이 폐기된 구조적 원인 — 재설계가 회피할 것

단일 ADR 에 UI 재작성(883 LOC) + 데이터층 전환 + breaking 3종 + 신규 EventType 13종을 7 Phase / sub-decision D1~D9 / Risk 11개로 묶은 scope 과대 (구 133 R10 이 자인). 본 재설계는 **2-Wave 축 분리** — Wave 1 (canonical end-to-end + UI) 은 EventType union 무변경 불변식, Wave 2 (convention 정합) 는 Wave 1 게이트 통과 후 조건부 — 로 동일 실패를 구조적으로 차단한다.

### 3-domain 분류 (ADR-063 정합)

**D2 (Props/API) 결정** — RAC callback props 가 UI primary 단위 + EventType union 정합. canonical schema 는 composition 직교 extension 영역 (root collection, ADR-131 Implemented) 으로 **필드 변경 0**. D1 (DOM/접근성) / D3 (시각 스타일) 비접촉 — spec/catalog Generator 확장 아님 (선차단 seed #2 해당 없음).

### Hard Constraints

1. **depth ≤ 2 + overlay 0** (default 표면): L1 = element 의 RAC callback props list, L2 = inline expand 안 action binding. Chrome MCP 확인
2. **EventsPanel legacy 직접 접근 0건**: `grep "props\?\.events\|selectedElement\.events" apps/builder/src/builder/panels/events` = 0 (boundary 외)
3. **Preview 런타임 canonical 소비**: `eventHandlers.ts` 의 `element.props.events` 읽기 0건 — canonical 파생 경유로 대체
4. **ActionsPanel 표면 제거**: `panels/actions/` 디렉토리 + `PanelId "actions"` grep 0건
5. **Pencil round-trip 보존**: `rootCollectionMigration` 기존 11 test 유지 + 역방향 `migrateRootCollectionToLegacy` 구현 (현재 주석만) + round-trip test 추가
6. **ADR-010 P0/P1 4 영역 표면 보존**: RecommendedEventsSection / TemplateSuggestionSection / RecommendedActionsChips / ActionBlock 누락 경고
7. **type-check baseline 무증가** (Phase 0 에서 현행 값 freeze)
8. **live behavior 게이트**: 실제 builder 에서 바인딩 편집 → Preview 이벤트 실행 1회 exercise (CLAUDE.md 완료 기준 — test PASS 단독 종결 금지)
9. **Wave 1 = EventType union 무변경 불변식** — convention 정합은 Wave 2 로 격리, 두 wave 독립 revert 단위

### Soft Constraints

- RAC/RSC 벤치마크 원본 파일 (`~/.claude/plans/rac-rsc-event-callback-benchmark.md`) 소멸 — ADR-133 F2 요약 (EventType = RAC 핵심 9영역 cover / non-recommended 7종 / gap 목록) 을 historical 인용, Wave 2 착수 시 in-repo `.claude/skills/react-aria/references/` 문서로 재검증
- condition 은 기존 `SerializedEvent.condition` placeholder 활용 (1단계 AST `{kind:"comparison"|"raw"}` + raw fallback) — 완전 DSL 은 ADR-134 응용 영역 유지
- supportedEvents SSOT (metadata.ts) 의 catalog 이관은 **non-goal** — 이원화 현상 유지, 후속 별도 판단
- 개발 단계 프로젝트 — BC 는 hydration 1회 변환 수준 (기존 `migrateLegacyElementsToRootCollections` 재사용), Pencil import/export 호환만 유지

## Alternatives Considered

### 대안 A: 2-Wave 수직 재설계 — canonical end-to-end (UI + 런타임) 선행, convention 정합 후행

- 설명: **Wave 1** = EventsPanel depth-2 재작성 + canonical direct r/w (`useEventsForTarget`/`useDocumentActions`) + Preview EventEngine canonical 소비 전환 + ActionsPanel 흡수·제거 + 역방향 adapter 구현. **Wave 2** = RAC convention 정합 (onClick deprecate / mouse→hover rename / 4종 제거 / gap 보강 + migration helper). Wave 1 은 EventType union 무변경.
- 근거: 업계 노코드 빌더 (Framer/Webflow/Retool) 의 이벤트 UI 는 "trigger 목록 + inline action 편집" 2-depth 패턴. RAC 정통 mental model = semantic callback 단위 (`<Button onPress>`). 데이터-소비 경로를 한 wave 에 닫는 수직 슬라이스는 ADR-912 R-5 / ADR-148 Phase 2 에서 검증된 방식.
- 위험:
  - 기술: M — Preview 런타임 재배선. 단 Preview 는 `UPDATE_CANONICAL_DOCUMENT` 채널로 canonical 을 이미 수신 (ADR-122) — 소비 지점 전환만 신규
  - 성능: L — 이벤트 바인딩은 편집·실행 시점 경로, Canvas hot path 아님
  - 유지보수: M — 재작성 회귀 표면 (883 LOC) 있으나 legacy boundary 축소로 장기 감소
  - 마이그레이션: M — props.events → canonical hydration 1회 + Pencil round-trip 보존 (역방향 adapter 신규 구현 필요)

### 대안 B: 구 ADR-133 구조 승계 — 7 Phase 단일 진행

- 설명: 구 133 의 D1~~D9 sub-decision + Phase 0~~7 을 그대로 재활성화.
- 근거: 2026-05-13 사용자 confirm (Q1~Q5) 을 이미 통과한 구조.
- 위험:
  - 기술: M — 동일 표면
  - 성능: L
  - 유지보수: **H** — scope 과대 (UI+데이터+breaking+gap 단일 묶음) 가 폐기 원인 그대로 재현 (구 133 R10 자인)
  - 마이그레이션: M

### 대안 C: UI-first 최소 — legacy store 유지, depth-2 재작성만

- 설명: 데이터층 비접촉, EventsPanel UI 표면만 재작성.
- 근거: 회귀 표면 최소화.
- 위험:
  - 기술: L
  - 성능: L
  - 유지보수: **H** — P2/P3 미달성, canonical 가치 (cross-event reuse / chain / id 참조) 계속 사장 + 이후 데이터층 전환 시 UI 2차 재작성
  - 마이그레이션: L

### Risk Threshold Check

| 대안 | 기술 | 성능 | 유지보수 | 마이그레이션 | HIGH+ 개수 |
| ---- | ---- | ---- | -------- | ------------ | :--------: |
| A    | M    | L    | M        | M            |     0      |
| B    | M    | L    | H        | M            |     1      |
| C    | L    | L    | H        | L            |     1      |

루프 판정: 대안 A 가 HIGH 0 — 새 대안 추가 불필요.

## Decision

**대안 A 채택** — 2-Wave 수직 재설계.

핵심 결정:

1. **store 방향 역전**: 현행 "legacy 1차 + canonical one-way mirror" → **canonical 1차**. Wave 1 중간 단계에서는 canonical→legacy 프로젝션(역 mirror)으로 런타임 무중단 유지, 런타임 canonical 소비 전환 후 프로젝션 제거 (breakdown Phase 2/3)
2. **UI 모델**: L1 = `supportedEvents` 기반 RAC callback props list (빈 상태에 ADR-010 추천/템플릿 표면), L2 = inline expand (기본 1-action binding, power-user toggle 로 multi-action chain·condition·debounce/throttle) — 구 133 D1/D7 취지 승계
3. **ActionsPanel 흡수**: cross-event reuse 는 inline "다른 event 에서도 사용" 토글 (anonymous id → named id 승격) — 구 133 D4 승계, `useDocumentActions` 소비는 EventsPanel 로 이관
4. **Wave 2 convention 정합**: onClick deprecate → onPress / onMouseEnter·Leave → onHoverStart·End / onMouseDown·Up·KeyPress·DoubleClick 4종 제거 (2026-05-13 사용자 confirm Q1/Q2/Q5 승계). **callback gap 은 "13종" 수치를 자동 승계하지 않고 Wave 2 착수 시 react-aria 문서로 재실측 후 확정**

위험 수용 근거:

1. 런타임 재배선(기술 M)은 Preview 가 canonical document 를 이미 수신 중 (ADR-122) 이라 소비 지점 전환에 한정 — EventEngine 단위 test 신설 + live 게이트 (G2) 로 관리 가능
2. 재작성 회귀(유지보수 M)는 ADR-010 4 영역 보존 grep + evaluator screenshot + 2-wave 격리로 표면 축소
3. 마이그레이션 M 은 개발 단계 + 기존 migration helper 재사용으로 hydration 1회 수준

기각 사유:

- **대안 B 기각**: 유지보수 H — 폐기 원인 (scope 과대) 재현. 구조를 바꾸지 않으면 같은 결말
- **대안 C 기각**: 유지보수 H — 승계 목적 4개 중 P2/P3 미달성, canonical 사장 상태 영속 + UI 2차 재작성 비용

> 구현 상세: [149-events-panel-canonical-simplification-breakdown.md](../design/149-events-panel-canonical-simplification-breakdown.md)

## Risks

| ID  | 위험                                                                                                                                                                                                                                                                                                                                                                                                                                              | 심각도 | 대응                                                                                                                                                                                          |
| --- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | :----: | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| R1  | Preview 런타임 canonical 전환 회귀 — 이벤트 무동작 (현재 EventEngine 단위 test 0)                                                                                                                                                                                                                                                                                                                                                                 |  MED   | Phase 3 에서 EventEngine 단위 test 신설 + G2 live behavior 게이트 (바인딩 편집 → Preview 실행 1회)                                                                                            |
| R2  | EventsPanel 883 LOC 재작성 회귀 — ADR-010 P0/P1 표면 소실                                                                                                                                                                                                                                                                                                                                                                                         |  MED   | HC6 grep 게이트 + evaluator agent (Chrome MCP) screenshot 비교 + G1 UI design 사용자 confirm                                                                                                  |
| R3  | scope inflation 재발 (구 133 폐기 원인)                                                                                                                                                                                                                                                                                                                                                                                                           |  MED   | 2-Wave 격리 (Wave 1 = union 무변경 불변식) + adr-writing.md M4 게이트 (sub-group N≥3 / sliver commit 5+ 시 사용자 confirm)                                                                    |
| R4  | legacy `props.events` read site 에 **live 소비자와 boundary 혼재** — workflowEdges + canvasDeltaMessenger (Skia navigation 엣지 + Preview delta payload — 둘 다 `getElementEvents` 소비, `adapters/canonical/compositionExtensionFields.ts:55`) / elementDiff / elementMapper 는 adapter 가 아닌 live 기능. 프로젝션 제거(Phase 3) 후 미전환 live 소비자는 **silent 기능 소실** (workflow 엣지 소멸)                                              |  MED   | Phase 0 inventory 에서 **2분류 freeze** — boundary (adapter/export, allowlist 유지) vs live 소비자 (Phase 3 canonical 전환 대상). live 소비자 전환 완료를 G2 통과 조건에 포함                 |
| R5  | 역방향 adapter (`migrateRootCollectionToLegacy`) 신규 구현 결함 — Pencil export 시 events 소실                                                                                                                                                                                                                                                                                                                                                    |  MED   | HC5 round-trip test (legacy→canonical→legacy 왕복 동등성) + 기존 11 test 유지                                                                                                                 |
| R6  | 기존 프로젝트 props.events → canonical hydration 마이그레이션 누락                                                                                                                                                                                                                                                                                                                                                                                |  LOW   | 기존 `migrateLegacyElementsToRootCollections` 재사용 (hydration 1회) — 개발 단계라 영향 제한적                                                                                                |
| R7  | supportedEvents SSOT 이원화 (metadata.ts vs catalog) 잔존                                                                                                                                                                                                                                                                                                                                                                                         |  LOW   | non-goal 명시 — L1 list 는 metadata.ts 소비, catalog 이관은 후속 별도 판단                                                                                                                    |
| R8  | **canonical mutation 층 history/undo/persistence 미통합** — canonicalDocumentStore 헤더 자인 ("In-memory mutation skeleton — history/undo/persistence 미통합", `builder/stores/canonical/canonicalDocumentStore.ts:7-10`). legacy 경로는 `updateAndSave` → `historyManager.addEntry` (`builder/stores/inspectorActions.ts:561`) 로 기록되나 canonical direct write 는 미기록 — Wave 1 전환 시 이벤트 편집 undo/redo 소실 + DB persist 경로 미정의 |  MED   | Phase 2 에서 canonical events/actions 편집 경로에 history record + persist 통합 (state-management 파이프라인 Memory→Index→History→DB 정합) — G2 에 "이벤트 편집 undo/redo 1회 live 확인" 포함 |

잔존 HIGH 위험 없음.

## Gates

| Gate | 시점             | 통과 조건                                                                                                                                                                                                                                                                           | 실패 시 대안                           |
| ---- | ---------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------- |
| G0   | Phase 0          | inventory freeze — legacy site 전수 grep 표 + EventType 멤버 실측 + boundary allowlist + type-check baseline 값 + commit hash 고정                                                                                                                                                  | inventory 보강 후 재freeze             |
| G1   | Wave 1 UI design | UI sketch + interaction flow + 1년차 신입 mental model 검증 항목 — 사용자 explicit confirm (AskUserQuestion)                                                                                                                                                                        | UI design 재작성                       |
| G2   | Wave 1 반영 직후 | HC1 (depth≤2 Chrome MCP) + HC2/HC4 grep 0건 + HC3 (eventHandlers legacy 읽기 0건) + HC5 round-trip test + HC6 표면 보존 grep + live 소비자 (workflowEdges 등) canonical 전환 확인 (R4) + 이벤트 편집 undo/redo 1회 (R8) + **live behavior 1회** (바인딩 편집 → Preview 이벤트 실행) | 회귀 축 rollback (wave 단위 revert)    |
| G3   | Wave 2 반영 직후 | EventType 갱신 4-way grep (EVENT_REGISTRY / IMPLEMENTED_EVENT_TYPES / metadata supportedEvents / migration helper) + 제거 4종 grep 0건 + migration helper test + live 1회                                                                                                           | convention 축만 revert (Wave 1 무영향) |
| G4   | closure          | type-check baseline 무증가 + README/CHANGELOG 갱신 + ADR-133 후속 링크 정합 + 검증 블록에 실제 exercise 내역 명시                                                                                                                                                                   | Implemented 승격 보류                  |

## Consequences

### Positive

- 승계 목적 4개 전부 달성 경로 확보 — depth 2 (P1) / canonical primary + 런타임 소비 (P2) / 단일 패널 (P3) / RAC convention (P4, Wave 2)
- ADR-131 canonical schema 가치 (cross-event reuse / chain / id 참조) 가 UI + 런타임 양쪽에서 처음으로 실소비 — `useEventsForTarget` 소비자 0 상태 해소
- legacy `element.props.events` 가 Pencil import/export boundary 로 격리 — ADR-116/122 canonical-only 방향과 정합
- EventEngine 단위 test 신설로 무테스트 런타임 영역 해소

### Negative

- EventsPanel 883 LOC + EventEngine 소비 지점 재작성 — 회귀 표면 큼 (R1/R2 관리)
- 역방향 adapter 신규 구현 + Pencil round-trip 유지 비용 영구
- Wave 2 완료 전까지 EventType union 에 RAC non-recommended 7종 잔존 (과도기)
- ActionsPanel 제거로 ADR-131 Phase 5 G3 표면 결정 reverse — historical 기록에 supersede 명시 필요

## References

- [ADR-133](133-events-panel-simplification.md) — **Deprecated 2026-07-08, 본 ADR 이 후속** (설계 목적 승계 원천, D1~~D9 + F1~~F5 historical 분석 자료)
- [ADR-131](131-events-data-actions-first-class-collections.md) — events/actions root collection schema base (Implemented 2026-05-13)
- [ADR-122](122-canonical-only-runtime-legacy-mirror-removal.md) — canonical-only runtime 방향 정본
- [ADR-010](010-events-panel.md) / [ADR-032](032-events-data-integration.md) / [ADR-034](034-events-panel-renovation.md) — Deprecated 계보 (본 ADR 이 최종 후속)
- ADR-134 (Proposed) — condition 완전 DSL / capability registry 응용 영역 (본 ADR 범위 밖 유지)
- in-repo RAC 레퍼런스: `.claude/skills/react-aria/references/components/` (Wave 2 gap 재실측 소스)
