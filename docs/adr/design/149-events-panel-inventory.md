# ADR-149 Phase 0 — Inventory Freeze (G0)

> **freeze 기준**: commit `bf4e6aac4` (2026-07-19). 본 문서는 ADR-149 Wave 1/2 착수 전 legacy `props.events` 소비 표면·EventType union·boundary vs live 2분류·baseline 값을 **동결**한다. Phase 2/3 의 grep 게이트(HC2/HC3/HC4)와 R4 live 소비자 전환은 본 표를 정본으로 판정한다. ADR 본문 §Context 실측(2026-07-08) 대비 라인 drift 는 재freeze 로 흡수 — [breakdown §Phase 0](149-events-panel-canonical-simplification-breakdown.md).

## 1. legacy `props.events` / `element.events` read·write site 전수 (2분류)

### 1-A. Boundary allowlist — 무변경 (adapter / serialize 경로만)

Phase 3 프로젝션 제거 후에도 유지. HC2/HC3 grep 게이트의 **허용 목록**.

| site                                               | 라인                                                          | 역할                                                           |
| -------------------------------------------------- | ------------------------------------------------------------- | -------------------------------------------------------------- |
| `adapters/canonical/compositionExtensionFields.ts` | 48-61 (`getElementEvents`: `props?.events ?? element.events`) | canonical/legacy 통합 accessor (boundary SSOT)                 |
| `adapters/canonical/canonicalMutations.ts`         | 530-531                                                       | `element.events` → `ext.events` 직렬화                         |
| `adapters/canonical/exportLegacyDocument.ts`       | 208                                                           | `ext.events` → `element.events` (Pencil export)                |
| `adapters/canonical/index.ts`                      | 362-378                                                       | ADR-116 G7 cutover (`element.events` → `x-composition.events`) |
| `adapters/canonical/legacyElementSanitizer.ts`     | 36, 87                                                        | legacy clone/sanitize                                          |
| `adapters/canonical/legacyMetadata.ts`             | 97                                                            | 주석 (cutover 기록)                                            |
| `adapters/canonical/slotAndLayoutAdapter.ts`       | 46-55                                                         | slot adapter 직렬화                                            |

### 1-B. Live 소비자 — Phase 3 canonical 전환 대상 (R4)

프로젝션 제거 **전에** canonical read 로 전환 필수. 미전환 시 silent 기능 소실.

| site                                              | 라인                                                         | 소비 형태                                                                            | 비고                                                                                                                                      |
| ------------------------------------------------- | ------------------------------------------------------------ | ------------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------- |
| `utils/events/eventHandlers.ts`                   | 44, 45, 80, 118                                              | Preview 런타임 primary (`element.props.events`)                                      | **HC3 핵심 전환 대상** (Phase 3)                                                                                                          |
| `builder/inspector/utils/elementMapper.ts`        | 44                                                           | `props.events = selected.events` 매핑                                                | Phase 0 제거/보류 판정 → Phase 2/3 canonical                                                                                              |
| `builder/panels/events/EventsPanel.tsx`           | 343-344                                                      | `selectedElement.events` 소비                                                        | Phase 2 재작성 대상 (878 LOC)                                                                                                             |
| `builder/panels/events/state/useEventHandlers.ts` | 39                                                           | `element.events`                                                                     | Phase 2 재작성                                                                                                                            |
| `builder/stores/inspectorActions.ts`              | 317 (def), 1054/1067/1080/1093 (call), 1061/1074/1087 (read) | `syncEventsToRootCollection` (legacy→canonical mirror) + `updateSelectedEvents` 계열 | Phase 2 방향 역전/제거 (R8 history/persist 통합)                                                                                          |
| `builder/workspace/canvas/skia/workflowEdges.ts`  | 202, 204                                                     | `getElementEvents` 소비 (Skia navigation 엣지)                                       | R4 명시                                                                                                                                   |
| **`builder/utils/canvasDeltaMessenger.ts`**       | **22, 241**                                                  | **`getElementEvents` 소비 (Preview delta 페이로드 `events` 필드)**                   | **⚠️ Phase 0 신규 발견 — ADR 본문 R4/breakdown §5 원 목록(workflowEdges/elementDiff/elementMapper)에 부재. workflowEdges 와 동형 소비자** |

> **참고**: `elementDiff.ts` 는 본 freeze grep(`props\??\.events|selectedElement\.events|element\.events`)에 직접 매치 없음 — ADR §5 의 `elementDiff.ts` 는 events diff 경로 추정 인용. Phase 3 착수 시 재확인 대상(diff 경로가 events 를 참조하면 live 소비자, 아니면 목록에서 제외).
>
> **getElementEvents 소비자 통합 전환 기회**: `workflowEdges:204` 와 `canvasDeltaMessenger:241` 은 둘 다 `getElementEvents`(compositionExtensionFields.ts:55) 경유. Phase 3 에서 `getElementEvents` 자체를 canonical root collection read 로 갱신하면 두 소비자를 단일 지점에서 전환 가능 (R4 대응 축소).

## 2. EventType union 멤버 실측 (24종)

`types/events/events.registry.ts` — `EVENT_REGISTRY` 키 (union 정의 `EventType = keyof typeof EVENT_REGISTRY` :165).

| #   | 멤버              | 라인 | Wave 2 처리 (Phase 4)                    |
| --- | ----------------- | ---- | ---------------------------------------- |
| 1   | onClick           | 32   | **deprecate → onPress**                  |
| 2   | onDoubleClick     | 37   | **제거**                                 |
| 3   | onMouseEnter      | 42   | **rename → onHoverStart** (미존재, 신설) |
| 4   | onMouseLeave      | 47   | **rename → onHoverEnd** (미존재, 신설)   |
| 5   | onMouseDown       | 52   | **제거**                                 |
| 6   | onMouseUp         | 57   | **제거**                                 |
| 7   | onChange          | 64   | 유지                                     |
| 8   | onInput           | 69   | 유지                                     |
| 9   | onSubmit          | 74   | 유지                                     |
| 10  | onFocus           | 79   | 유지                                     |
| 11  | onBlur            | 84   | 유지                                     |
| 12  | onKeyDown         | 91   | 유지                                     |
| 13  | onKeyUp           | 96   | 유지                                     |
| 14  | onKeyPress        | 101  | **제거**                                 |
| 15  | onPress           | 108  | 유지 (onClick 승계 대상)                 |
| 16  | onSelectionChange | 113  | 유지                                     |
| 17  | onAction          | 118  | 유지                                     |
| 18  | onOpenChange      | 123  | 유지                                     |
| 19  | onChangeEnd       | 128  | 유지                                     |
| 20  | onExpandedChange  | 133  | 유지                                     |
| 21  | onRemove          | 138  | 유지                                     |
| 22  | onScroll          | 145  | 유지                                     |
| 23  | onResize          | 150  | 유지                                     |
| 24  | onLoad            | 155  | 유지                                     |

- **Wave 2 breaking 대상 7종 (DOM-legacy)**: onClick / onMouseEnter / onMouseLeave / onMouseDown / onMouseUp / onKeyPress / onDoubleClick (2026-05-13 Q1/Q2/Q5 confirm 승계, 적용 시점 Wave 2 격리).
- **Wave 1 불변식**: 위 union 24종 **무변경** (HC9). onHoverStart/End 신설 및 4종 제거는 Phase 4 에서만.
- round 2 l3 정정 실증: 구 인용 `:32-128` 은 onRemove/onScroll/onResize/onLoad 4멤버 절삭 — 실제 :32~:155.

## 3. ActionsPanel / PanelId "actions" 제거 표면 (HC4)

| site                                      | 라인                                     | 처리              |
| ----------------------------------------- | ---------------------------------------- | ----------------- |
| `builder/panels/actions/ActionsPanel.tsx` | 154 LOC, `useDocumentActions()` :34 소비 | Phase 2 흡수·제거 |
| `builder/panels/core/panelConfigs.ts`     | 212 (`id: "actions"`)                    | 제거              |
| `builder/panels/core/types.ts`            | 60 (`\| "actions"`)                      | 제거              |

## 4. canonical read hooks 소비 현황 (전환 목표)

| hook                 | 현 소비자                 | 정의                                                               |
| -------------------- | ------------------------- | ------------------------------------------------------------------ |
| `useDocumentActions` | ActionsPanel.tsx:34 (1곳) | `canonicalElementsBridge.ts:187` (useSyncExternalStore, read 전용) |
| `useEventsForTarget` | **0**                     | `canonicalElementsBridge.ts:161`                                   |
| `useDocumentEvents`  | **0**                     | `canonicalElementsBridge.ts:142`                                   |

> Phase 2 목표: EventsPanel 읽기를 `useEventsForTarget` + `useDocumentActions` 로 전환, 쓰기는 canonical write 단일 진입점 wrapper 신설(`updateEventsRootCollection`/`updateActionsRootCollection`, canonical 1차 → history → persist). read hooks 는 read 전용이므로 별도 write wrapper 필요 (round 2 l2 정정).

## 5. 역방향 adapter 현황 (R5 / HC5)

- `migrateRootCollectionToLegacy` — **미구현** (`rootCollectionMigration.ts:19` 주석만, function/const 정의 grep 0건). Phase 3 구현 대상.
- `migrateLegacyElementsToRootCollection` — 존재 (`rootCollectionMigration.ts:158`, hydration 1회 migration 재사용 소스).

## 6. Baseline 값 freeze

| 항목                          | freeze 값                                                                            |
| ----------------------------- | ------------------------------------------------------------------------------------ |
| freeze commit                 | `bf4e6aac4`                                                                          |
| type-check baseline           | **63 known errors, PASS (0 new)** — `apps/builder/scripts/type-check-baseline.sh`    |
| EventsPanel.tsx LOC           | **878** (ADR 본문 883 → −5, `b563085fe` dead `isActive` 가드 정리 반영)              |
| ActionsPanel.tsx LOC          | 154                                                                                  |
| EventType union               | 24종                                                                                 |
| canonical events/actions test | rootCollectionMigration.test.ts 11 케이스 (EventsPanel/EventEngine 자체 단위 test 0) |

## 7. Phase 0 finding → 본문 반영

- **R4 live 소비자 목록 보강**: `canvasDeltaMessenger.ts:241` 추가 (본 문서 §1-B). ADR 본문 R4 + breakdown §5 갱신 완료.
- 그 외 §Context(2026-07-08) 대비 라인 drift(syncEventsToRootCollection 290→317, EventsPanel 883→878 등)는 본 freeze 로 흡수 — 전제 무변경, scope 무변경 (adr-writing.md M3).
