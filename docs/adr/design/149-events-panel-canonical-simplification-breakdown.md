# ADR-149 구현 상세 — EventsPanel 전면 재설계 (2-depth UX + canonical primary + RAC callback 정합)

> 본 문서는 [ADR-149](../149-events-panel-canonical-simplification.md) 의 구현 상세 (Wave/Phase, 파일 변경, Gate 매핑, 체크리스트). 결정/위험/대안은 ADR 본문. 실측 baseline: 2026-07-08 코드 recon (본문 §Context 실측 표).

## §1. Fork checkpoint lock-in (adr-writing.md 4질문)

| 질문                       | 판정                                                                                                                                                                                                                                                                            |
| -------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| base/응용 분류             | **base = ADR-131** (events/actions root collection schema, Implemented) + **ADR-122** (canonical-only runtime 방향, Implemented). **ADR-149 = 응용 실행 설계** — base 가 확정한 schema/방향의 UI·런타임 소비 전환. ADR-133 은 Deprecated 전신 — 목적만 승계, 구조 비승계.       |
| schema 직교성              | canonical schema 필드 변경 0 — `SerializedEvent`/`SerializedAction` 기존 필드만 사용 (condition 은 기존 placeholder 활용). EventType union 은 D2 편집 계약 layer 로 canonical core 와 직교.                                                                                     |
| 선행 ADR 전제 reverse 검증 | ADR-133 전제 자동 승계 금지 — 2026-07-08 실측으로 재검증: (a) 883 LOC / depth 유지 확인, (b) **신규 발견**: Preview 런타임이 legacy 소비 (구 133 은 이 축을 Phase 로 명시하지 않음 → 본 ADR 이 1급 축 승격), (c) 벤치마크 파일 소멸 → F2 요약 historical 인용 + in-repo 재검증. |
| codex 3차 미루지 말 것     | 전제·관점은 본 문서 lock-in. codex/review-adr 은 본문 정합 layer 로만 사용.                                                                                                                                                                                                     |

**사용자 explicit confirm (M2)**: 2026-07-08 "ADR-133 설계목적만 파악후 전면 재설계 진행해" — 재설계 ADR 작성 명시 지시. 폐기·승계 분류는 동일 세션 선행 confirm ("133은 폐기후- 재설계대상").

## §2. ADR-133 대비 재설계 차이 (목적 승계 / 구조 신규)

| 축                | 구 ADR-133                                                 | 본 ADR-149                                                                        |
| ----------------- | ---------------------------------------------------------- | --------------------------------------------------------------------------------- |
| 구조              | 7 Phase 단일 진행 + D1~D9 + Risk 11                        | **2-Wave 격리** (Wave 1 = union 무변경 불변식, Wave 2 조건부) + Risk 7            |
| 런타임 축         | Phase 미명시 (canonical primary 를 Panel r/w 로만 정의)    | **1급 축 승격** — Preview EventEngine canonical 소비 전환 (HC3) + 단위 test 신설  |
| 역방향 adapter    | 전제만 (R2 대응에 언급)                                    | **신규 구현 명시** — `migrateRootCollectionToLegacy` 주석만 존재 실측 (HC5)       |
| callback gap      | "13종" 고정 lock-in (D9)                                   | 수치 자동 승계 금지 — Wave 2 착수 시 in-repo react-aria 문서로 **재실측 후 확정** |
| 벤치마크 evidence | `~/.claude/plans/rac-rsc-event-callback-benchmark.md` 참조 | 원본 소멸 실측 — ADR-133 F2 요약 historical 인용으로 대체                         |
| breaking 3종      | Q1/Q2/Q5 사용자 confirm (2026-05-13)                       | **승계** (재confirm 불요) — 단 적용 시점을 Wave 2 로 격리                         |

## §3. Wave/Phase 분해

> 각 Phase 는 독립 검증·revert 단위. sub-group N≥3 분할 / sliver commit 5+ 예상 시 adr-writing.md M4 — 사용자 confirm 의무 (R3).

### Phase 0 — Inventory freeze (G0) ✅ Implemented 2026-07-19

> freeze 산출물: [149-events-panel-inventory.md](149-events-panel-inventory.md) (commit `bf4e6aac4`). type-check baseline 63/PASS, EventType union 24종, EventsPanel 878 LOC, R4 live 소비자에 `canvasDeltaMessenger.ts:241` 신규 편입.

- legacy `props.events` read/write site 전수 grep 표 (본문 실측 표 기반 + commit hash 고정)
- boundary allowlist 확정: `adapters/canonical/*` (Pencil import/export) / `exportLegacyDocument.ts` — allowlist 외 접근은 G2 grep 게이트 대상. **`elementDiff.ts`/`workflowEdges.ts`/`elementMapper` 는 allowlist 아님** (live 소비자 — §5 전환 대상, 본문 R4. round 2 정정 2026-07-14: 구 bullet 이 이 2건을 allowlist 에 포함해 §5 와 자기모순이었음)
- EventType union 멤버 실측 고정 (`events.registry.ts:30-160` — onRemove:138/onScroll:145/onResize:150/onLoad:155 포함, union 정의 :165) + type-check baseline 값 freeze (round 2 정정: 구 인용 ":32-128" 은 4멤버 절삭)

### Wave 1 — canonical end-to-end + 2-depth UI

#### Phase 1 — UI design lock-in (G1) ✅ Implemented (G1 사용자 confirm 2026-07-19)

- UI sketch + interaction flow: L1 = supportedEvents 기반 callback props list (populated/empty 상태), L2 = inline expand (1-action 기본 + power-user toggle: chain/condition/debounce·throttle)
- ADR-010 P0/P1 4 영역 (추천 chips / 템플릿 / 추천 액션 chips / 누락 경고) 의 신규 표면 내 위치 명시
- **사용자 explicit confirm (AskUserQuestion)** 후 Phase 2 진입 — **2026-07-19 확정** (execute-adr G1, 사용자 "승인 — Phase 2 착수")

**Lock-in design (G1 확정 2026-07-19)** — Phase 2 재작성의 목표 구조:

```
L1 — 기본 표면 (depth 1, overlay 0)
  ⚡ {supportedEvents callback}  ·  바인딩 상태  ·  클릭 → L2 inline expand
  빈 상태: 💡 추천 이벤트 chips(①) + 📋 템플릿 chips(②)
L2 — inline accordion (depth 2, overlay 아님)
  액션 목록(기본 1개) · [+ 액션 추가] · 💡 추천 액션 chips(③)
  ⚙ 고급 ▸ : 조건 · debounce/throttle · "다른 이벤트서도 사용" 토글(ActionsPanel 흡수: anon→named id)
  ⚠ 누락 경고(④)
```

- depth ≤ 2 / overlay 0 (HC1) — 현행 WhenBlock/IfBlock/ThenElseBlock/BlockActionEditor 3~4 depth 대체
- ADR-010 4영역: ①② = L1 빈 상태, ③④ = L2 내부. ActionsPanel 별도 패널 제거(HC4), cross-event reuse 는 L2 고급 토글로 흡수

#### Phase 2 — EventsPanel canonical primary 재작성 + ActionsPanel 흡수

- EventsPanel 신규: 읽기 = `useEventsForTarget(elementId)` + `useDocumentActions()` 구독 (두 hook 은 `canonicalElementsBridge.ts:161-196` useSyncExternalStore **read 전용** — round 2 정정: 구 "direct r/w" 표기는 부정확). 쓰기 = **canonical write 단일 진입점 wrapper 신설** (예: `updateEventsRootCollection`/`updateActionsRootCollection` — ADR-131 "root collection mutation 은 sync wrapper 경유" 계약 동형, 호출 순서 canonical 1차 → history → persist). legacy 접근 0건 (HC2)
- 과도기 무중단: 쓰기 시 canonical 1차 + **canonical→legacy 프로젝션** (역 mirror) 로 props.events 유지 → 런타임 무영향 (Phase 3 에서 제거)
- ActionsPanel 흡수: cross-event reuse inline 토글 (anonymous→named id 승격) + `panels/actions/` 제거 + `PanelId "actions"` 제거 (HC4)
- 기존 `syncEventsToRootCollection` (legacy→canonical mirror) 제거 — 방향 역전 완결
- **history/persist 통합 (R8)**: canonical events/actions 편집 경로에 history record + DB persist 연결 — 현행 canonicalDocumentStore mutation 은 "In-memory skeleton (history/undo/persistence 미통합)" 자인 (`builder/stores/canonical/canonicalDocumentStore.ts:7-10`). legacy 경로의 `updateAndSave` → `historyManager.addEntry` (`builder/stores/inspectorActions.ts:561`) 와 동등한 undo/redo 보장 필수 (state-management 파이프라인 Memory→Index→History→DB)

#### Phase 3 — Preview 런타임 canonical 소비 전환 + adapter 완결

- `EventHandlerFactory.createEventHandlers` 가 canonical document 파생 (target=element 의 `SerializedEvent[]`) 소비 — `element.props.events` 읽기 0건 (HC3)
- Phase 2 의 canonical→legacy 프로젝션 제거 (boundary allowlist 외 legacy 접근 0)
- 역방향 adapter `migrateRootCollectionToLegacy` 구현 + export 경로 연결 (HC5) + round-trip test (legacy→canonical→legacy 동등성)
- 기존 프로젝트 hydration 1회 migration (`migrateLegacyElementsToRootCollections` 재사용)
- **live 소비자 canonical 전환 (R4)**: workflowEdges (`builder/workspace/canvas/skia/workflowEdges.ts:202-205` — `getElementEvents` 소비, Skia navigation 엣지) / `elementMapper.ts:44` / `elementDiff.ts` 를 프로젝션 제거 **전에** canonical read 로 전환 — 미전환 시 silent 기능 소실 (Phase 0 에서 boundary vs live 2분류 freeze)
- EventEngine 단위 test 신설 (navigate / setState / apiCall 대표 3 kind + chain/condition 분기)
- **G2**: grep 게이트 전체 + 이벤트 편집 undo/redo 1회 (R8) + live behavior 1회 (builder 에서 Button onPress → navigate 바인딩 → Preview 실행)

### Wave 2 — RAC convention 정합 (G2 통과 후 조건부)

#### Phase 4 — EventType 정합 + migration helper

- gap 재실측: `.claude/skills/react-aria/references/components/` 대조 → 추가 목록 확정 (구 133 D9 의 Table 6 / SearchField 1 / ComboBox 1 / Press 4 / Hover 1 은 출발점 후보)
- breaking 3종 (Q1/Q2/Q5 승계): onClick deprecate→onPress / onMouseEnter·Leave→onHoverStart·End / onMouseDown·Up·KeyPress·DoubleClick 4종 제거
- 4-way 동시 갱신: `EVENT_REGISTRY` + `IMPLEMENTED_EVENT_TYPES` + `ComponentMeta.supportedEvents` + `migrateLegacyEventTypes` helper (Pencil import + hydration 2 경로 공용)
- **G3**: 4-way grep + 제거 4종 grep 0건 + helper test + live 1회

### Phase 5 — closure (G4)

- type-check baseline 무증가 + README/CHANGELOG (Implemented 승격 트리거) + ADR-133/010/032/034 후속 링크 정합
- 검증 블록에 실제 exercise 내역 명시 (live behavior 게이트 — test 개수 나열 금지)

## §4. Gate ↔ Risk 매핑

| Gate | Phase | 대응 Risk          |
| ---- | ----- | ------------------ |
| G0   | 0     | R4                 |
| G1   | 1     | R2                 |
| G2   | 2–3   | R1, R4, R5, R6, R8 |
| G3   | 4     | R3 (wave 격리)     |
| G4   | 5     | 전체               |

## §5. 파일 좌표 (2026-07-08 실측 기준)

**재작성/수정**:

- `apps/builder/src/builder/panels/events/` — EventsPanel.tsx (883 LOC) + 부속 (block editor 트리 WhenBlock/IfBlock/ThenElseBlock/BlockActionEditor + `actions/*ActionEditor.tsx` 25종은 L2 expand 내부로 재배치)
- `apps/builder/src/builder/panels/actions/ActionsPanel.tsx` (154 LOC) — 제거
- `apps/builder/src/builder/panels/core/types.ts:60` + `panelConfigs.ts:212` — `PanelId "actions"` 제거
- `apps/builder/src/builder/stores/inspectorActions.ts:290,980-1028` — `updateSelectedEvents` 계열 + `syncEventsToRootCollection` 방향 역전/제거 + history/persist 통합 (R8, `historyManager.addEntry` :561 동등성)
- `apps/builder/src/utils/events/eventHandlers.ts:35-118` — canonical 소비 전환
- `apps/builder/src/utils/events/eventEngine.ts` — 소비 입력 변경 + 단위 test 신설
- `apps/builder/src/adapters/canonical/rootCollectionMigration.ts` — 역방향 `migrateRootCollectionToLegacy` 구현 (:19 주석 실현)
- **live 소비자 (Phase 3 canonical 전환 대상 — R4)**: `apps/builder/src/builder/workspace/canvas/skia/workflowEdges.ts:202-205` (getElementEvents 소비) / `apps/builder/src/builder/utils/canvasDeltaMessenger.ts:22,241` (getElementEvents 소비 — Preview delta 페이로드, **Phase 0 freeze 신규 확인**) / `apps/builder/src/builder/stores/utils/elementDiff.ts` (events 참조 여부 Phase 3 재확인) / `apps/builder/src/builder/inspector/utils/elementMapper.ts:44` — 상세: [inventory §1-B](149-events-panel-inventory.md)
- `apps/builder/src/builder/inspector/utils/elementMapper.ts:44` — `selectedElement.events` 매핑 제거/보류 판정 (Phase 0)

**Wave 2**: `apps/builder/src/types/events/events.registry.ts` (:32-128 union / :180~ actions) + `packages/shared/src/components/metadata.ts` (supportedEvents)

**소비 hooks (기존, 무변경)**: `stores/canonical/canonicalElementsBridge.ts:142,161,187`

**boundary allowlist (무변경 — adapter/serialize 경로만)**: `apps/builder/src/adapters/canonical/{compositionExtensionFields,slotAndLayoutAdapter,canonicalMutations,exportLegacyDocument,index}.ts` / `builder/stores/canonical/{canonicalElementsView,canonicalDocumentStore}.ts` — workflowEdges/elementDiff/elementMapper 는 allowlist 아님 (live 소비자, 위 전환 대상)

## §6. 검증 체크리스트

- [x] Phase 0: inventory 표 + allowlist + baseline freeze (commit hash) — **완료 2026-07-19** (`bf4e6aac4`, [inventory](149-events-panel-inventory.md))
- [x] Phase 1: UI sketch 사용자 confirm (AskUserQuestion) — **완료 2026-07-19** (G1 lock-in design 확정)
- [ ] Phase 2: HC2/HC4 grep 0건 + canonical→legacy 프로젝션 동작 (Preview 무중단) + history/persist 통합 — 이벤트 편집 undo/redo 1회 (R8)
- [ ] Phase 3: HC3 grep 0건 + live 소비자 (workflowEdges/elementDiff/elementMapper) canonical 전환 (R4) + round-trip test + hydration migration + EventEngine test + **live 1회**
- [ ] Phase 4: 4-way 갱신 grep + 제거 4종 0건 + helper test + live 1회
- [ ] Phase 5: type-check baseline 무증가 + README/CHANGELOG + 계보 링크 정합
- [ ] 전 Phase: sub-group N≥3 / sliver commit 5+ 예상 시 사용자 confirm (M4)
