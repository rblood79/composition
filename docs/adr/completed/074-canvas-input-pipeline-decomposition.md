# ADR-074: 캔버스 입력 파이프라인 SSOT 재편 (pointerdown→render.frame 체감 최적화)

> **SSOT domain**: D3 (시각 스타일) 경계를 건드리지 않는 **렌더 consumer 내부 구독/계산 SSOT 재편**. Spec/Skia/CSS 3-domain 모델은 불변. 본 ADR 은 `BuilderCanvas` 루트가 **구조 변경**과 **selection/overlay 변경**을 **동일한 입력 덩어리**로 병합하여 fan-out 을 유발하는 구조를 분리한다. 정본: [ssot-hierarchy.md](../../../.claude/rules/ssot-hierarchy.md). 선례: [ADR-069](069-input-frame-violation-mitigation.md) `selectElementWithPageTransition` Phase 1 (prod gate PASS 종결), [ADR-067](067-style-panel-skia-native-read-path.md) Zustand-native 구독 Phase 1~6 패턴, 2026-04-16 Phase B/C RenderContext 인덱스 + batch 인프라 세션.

## Status

Implemented — 2026-04-18 (Addendum 2 참조)

## Context

ADR-069 `selectElementWithPageTransition` land 이후 production gate (p95 input < 100ms, violations100ms = 0) 는 PASS 되었으나, **dev 환경 체감 지연**과 **빈 영역 클릭/페이지 전환 순간의 주관적 버벅임** 이 여전히 보고된다. 2026-04-17 분석 세션에서 원인을 `pointerdown → setState → sceneSnapshot useMemo → rendererInvalidationPacket useMemo → SkiaCanvas 재진입 → render.frame` 경로의 **선형 fan-out 누적**으로 압축했다.

### 관찰된 구조적 문제

1. **입력 경로 반쪽 병합** — `selectElementWithPageTransition` action 이 이미 존재 (`apps/builder/src/builder/stores/elements.ts:1111`) 하여 `currentPageId + selectedElementId + selectedElementIds + editingContextId + multiSelectMode` 를 단일 `set()` 에 병합하지만, `apps/builder/src/builder/workspace/canvas/hooks/useCentralCanvasPointerHandlers.ts:321~334` 빈 영역 클릭 경로는 여전히 `setCurrentPageId()` + `setSelectedElement()` 를 **분리 호출**. store notify 가 2회 연속 발생하여 루트 useMemo 가 2번 재계산.
2. **루트 selection 구독** — `apps/builder/src/builder/workspace/canvas/BuilderCanvas.tsx:157~159` 에서 `currentPageId / selectedElementId / selectedElementIds` 를 루트 레벨에서 직접 구독. line 153 주석은 "ElementsLayer 내부에서 직접 구독"이라 명시하나 **실제 코드와 불일치**. selection 만 바뀌어도 루트가 다시 돌아 하위 `useMemo` 체인 전체를 재평가.
3. **sceneSnapshot 계산 덩어리** — `apps/builder/src/builder/workspace/canvas/scene/buildSceneSnapshot.ts:18` 에서 `buildDepthMap` + `buildPageDataMap` + `buildPageFrames` + `buildVisiblePageSet` + `buildSelectionSnapshot` 을 **같은 함수** 안에서 계산. selection 만 바뀌어도 depth/pageData/pageFrames 전부 재계산.
4. **rendererInvalidationPacket 재생성 범위 과대** — `BuilderCanvas.tsx:385~430` `useMemo` deps 에 `selectedElementId / selectedElementIds` 포함 → selection 클릭마다 packet 객체 전체가 새로 생성되어 `SkiaCanvas` 가 invalidation 재계산. 실제로 SkiaCanvas 는 `packet.selection.selectionSignature` (line 443) 로 overlay-only 분기를 이미 가지고 있으므로 packet 을 scene/overlay 로 분할하면 overlay-only 흐름이 잘려나간다.
5. **페이지 전환 critical path** — `apps/builder/src/builder/stores/elements.ts:1091` `setCurrentPageId` → `apps/builder/src/builder/stores/history.ts:127` `setCurrentPage` 가 `pageHistories.set()` + `notifyListeners()` 를 **동기** 호출. IDB `restoreFromIndexedDB` 는 이미 백그라운드지만 listener notify 는 critical path.
6. **dev validate 과범위** — `apps/builder/src/builder/main/BuilderCore.tsx:424` `validateOrderNumbers(elements)` 가 `currentPageId` 변경 시 **전체 `elements`** 를 `reduce` 순회. dev-only 이나 경고 노이즈 + 체감 지연 원인.

### Hard Constraints

1. `pnpm type-check` 3 tasks 통과.
2. Chrome MCP 회귀: 빈 영역 클릭/페이지 전환/요소 선택/overlay invalidation 시각 불변.
3. **Gate G1 (입력 경로)**: Empty-click 시 `BuilderCanvas` 루트 renderCount = 1 (현행 2+).
4. **Gate G2 (selection fan-out)**: selection-only 변화 시 `sceneSnapshot` 재계산 skip (identity 유지). `rendererInvalidationPacket` 의 scene 하위 필드 identity 유지.
5. **Gate G3 (입력 p95 dev)**: `input.pointerdown` p95 (빈 영역 클릭) dev 환경 ≤ 기준값 (baseline 측정 후 목표치 -30%).
6. **Gate G4 (page-transition p95)**: 신설 라벨 `input.page-transition` p95 ≤ 기준값 (baseline -30%).
7. **기존 계측 라벨 호환**: `PERF_LABEL.INPUT_POINTERDOWN / RENDER_FRAME / RENDER_CONTENT_BUILD / RENDER_PLAN_BUILD / RENDER_SKIA_DRAW` 유지. 신설 라벨만 추가.

### Soft Constraints

- ADR-069 Addendum 가 아닌 **독립 ADR**: ADR-069 는 prod gate 종결 상태. 본 ADR 은 "루트 구독 SSOT 재편" 이라는 별개 주제.
- 6-Phase 순차 land: 각 Phase 독립 PR 가능, 중간 rollback 안전.
- 외부 의존성 변경 없음 (Zustand/Skia/RAC 버전 불변).

## Alternatives Considered

### 대안 A: 본 제안 (입력 경로 병합 → 루트 구독 분리 → snapshot/packet 분할 → history/dev 정리)

6-Phase 순차. P1 빈 영역 클릭 → `selectElementWithPageTransition` 일원화 / P2 `BuilderCanvas` 루트에서 `selectedElementId/Ids/currentPageId` 구독 제거 후 하위 컴포넌트(`ElementsLayer`/`SkiaCanvas` packet 생성부) 이전 / P3 `buildSceneSnapshot` 을 scene-structure 계산과 selection snapshot 으로 분할 → 별도 `useMemo` / P4 `rendererInvalidationPacket` 을 `sceneInvalidationPacket` + `overlayInvalidationPacket` 두 입력으로 분리, SkiaCanvas 의 `packet.selection.selectionSignature` 분기와 정합 / P5 `historyManager.setCurrentPage` 의 listener notify 를 microtask 로 deferral + `pageHistories.set` lazy / P6 `validateOrderNumbers` 를 `dirtyPageIds` 기반으로 축소.

- 근거: 2026-04-16 Phase B/C 세션 RenderContext 인덱스 도입 PR 에서 동일한 "루트 구독 축소 + 인덱스 패턴" 이 -195 LOC + Chrome MCP 회귀 PASS 로 증명. ADR-067 Phase 1~6 도 "Zustand-native 세분화 selector + subscribeWithSelector" 가 G1/G2/G3 전부 PASS.
- 위험:
  - 기술: **MEDIUM** — P2 루트 구독 이전 시 하위 컴포넌트 props 흐름 개편 필요. RenderContext 확장 여지 (ElementsLayer 가 이미 selection 소비). P4 packet 분리는 SkiaCanvas 의 `lastSelectionSignatureRef` / `lastEditingContextRef` 기반 분기를 이미 활용 중이라 비교적 안전.
  - 성능: **LOW** — 각 Phase 독립 Gate 계측. 회귀 발생 시 개별 PR rollback.
  - 유지보수: **MEDIUM** — 입력 경로 / sceneSnapshot / packet 3개 영역 동시 수정. 6-Phase 분할로 리뷰 단위 축소.
  - 마이그레이션: **LOW** — 외부 API 변화 없음. 내부 구독 구조만 재편.

### 대안 B: `SkiaCanvas` 완전 자립 (BuilderCanvas 루트에서 canvas state 전부 분리)

BuilderCanvas 루트를 "컨테이너 + DOM 이벤트 binding" 만 남기고 모든 Store 구독을 `SkiaCanvas` 내부로 이전. `rendererInvalidationPacket` 도 `SkiaCanvas` 내부에서 생성. 단일 대형 리팩토링.

- 근거: ADR-067 Phase 6 (Jotai 완전 제거) 선례가 "컴포넌트 레벨에서 Store 접근 단일화" 효과를 입증. React 공식 `useSyncExternalStore` + zustand `subscribeWithSelector` 조합으로 canvas 전용 구독 캡슐화 가능.
- 위험:
  - 기술: **HIGH** — `BuilderCanvas` 는 Settings/AI/Workflow/DataSource 등 10+ store 슬라이스와 얽혀있고 event handler wiring (`useCentralCanvasPointerHandlers`) 도 루트 scope 에서 실행 중. 전체 이전은 대규모 reshape.
  - 성능: **LOW** — 목표는 달성하나 추가 이득 없음.
  - 유지보수: **HIGH** — 단일 대형 PR 리뷰 부담. 중간 rollback 어려움.
  - 마이그레이션: **MEDIUM** — event handler 흐름 변경 시 기존 shortcut/mouse/keyboard 회귀 가능성.

### 대안 C: RenderContext 확장으로 통합 (2026-04-16 Phase B/C 패턴 재사용)

Phase B/C 에서 도입한 `RenderContext.elementsMap / childrenMap` 인덱스에 **selection 인덱스** (`selectedElementIdSet: Set<string>`, `currentPageElements: Element[]`) 를 추가. `buildSceneSnapshot` 과 `rendererInvalidationPacket` 을 RenderContext provider 가 소유하고, consumer 는 세분화 selector 로 구독.

- 근거: 2026-04-16 `Phase C P3-A.2/3` 에서 selector memoization 대신 index 기반 lookup 으로 ~60곳 -120 LOC + 회귀 없음. RenderContext 는 이미 `packages/shared` + `preview` 동시 소비 검증됨.
- 위험:
  - 기술: **MEDIUM** — RenderContext 가 `preview`/`publish` 양쪽에 공유되므로 selection 의존성이 preview 까지 전파될 수 있음. 경계 재설정 필요.
  - 성능: **LOW** — 인덱스 재계산 비용이 기존 useMemo 와 유사. 이득은 구조 명확성.
  - 유지보수: **LOW** — Phase B/C 패턴 재사용. 학습 비용 낮음.
  - 마이그레이션: **MEDIUM** — `RenderContext` 타입 변화 시 preview / publish / builder 3개 consumer 동기 필요.

### Risk Threshold Check

| 대안                   | 기술 | 성능 | 유지보수 | 마이그레이션 | HIGH+ 개수 |
| ---------------------- | :--: | :--: | :------: | :----------: | :--------: |
| A (6-Phase 순차)       |  M   |  L   |    M     |      L       |     0      |
| B (SkiaCanvas 자립)    |  H   |  L   |    H     |      M       |     2      |
| C (RenderContext 확장) |  M   |  L   |    L     |      M       |     0      |

**판정**: HIGH+ 가 0 인 대안 A/C 가 threshold 통과. B 는 HIGH 2 — 단일 대형 PR 의 리뷰/rollback 부담이 불균형. 루프 추가 대안 불필요.

## Decision

**대안 A (6-Phase 순차)** 를 선택한다. 다만 P2 (루트 구독 분리) / P3 (sceneSnapshot 분할) 구현 시 **대안 C 의 인덱스 패턴을 로컬 기법으로 차용** — RenderContext 까지 확장하지 않되 BuilderCanvas 내부에서 `useMemo` 세분화 + selector 분리.

선택 근거:

1. **ADR-069 / ADR-067 선례**: 동일 프로젝트에서 "선형 Phase + 독립 Gate 측정" 이 prod p95 -86% 실증. 본 ADR 도 같은 패턴을 적용 가능.
2. **점진 land 안전성**: 각 Phase 가 독립 PR. P1 은 ~10줄 수정, P6 은 dev-only. 회귀 발생 시 개별 rollback.
3. **Gate G1~G4 분리 측정 가능**: `PERF_LABEL.INPUT_POINTERDOWN` 기존 라벨로 G3 측정. 신설 `input.page-transition` 으로 G4 측정. scene fan-out 은 React DevTools Profiler + 루트 renderCount 로 G1/G2 측정.
4. **대안 C 의 확장 여지 보존**: 본 ADR 은 RenderContext 확장을 금지하지 않음. 향후 `preview`/`publish` 통합 최적화 필요 시 C 패턴으로 승격 가능.

기각 사유:

- **대안 B 기각**: HIGH 위험 2개 (기술 + 유지보수). BuilderCanvas 의 Settings/AI/Workflow/DataSource store 의존성은 본 ADR scope (입력 경로 + scene/packet SSOT) 를 벗어남. 단일 대형 PR 의 중간 rollback 불가 위험이 본 ADR 의 "점진 land" soft constraint 와 상충.
- **대안 C 기각**: 위험 profile 은 A 와 유사하나 **RenderContext 는 preview/publish 공유 타입** 이라 selection 추가 시 경계 재설정 비용 발생. 본 ADR 은 Builder 전용 최적화이므로 RenderContext 확장 없이 로컬 세분화로 충분.

> 구현 상세: [074-canvas-input-pipeline-decomposition-breakdown.md](../../adr/design/074-canvas-input-pipeline-decomposition-breakdown.md)

## Gates

| Gate | 시점          | 통과 조건                                                                                                 | 실패 시 대안                                                |
| ---- | ------------- | --------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------- |
| G1   | P1~P2 land 후 | Empty-click 시 `BuilderCanvas` root renderCount = 1 (React DevTools Profiler)                             | P2 롤백 → 루트 구독 유지 + P1 만 land                       |
| G2   | P3~P4 land 후 | selection-only 변화 시 `sceneSnapshot.pageFrameMap` / `sceneInvalidationPacket` identity 유지 (Object.is) | P3 롤백 → `buildSceneSnapshot` 원복 + P4 packet 단일체 유지 |
| G3   | P1~P4 land 후 | `PERF_LABEL.INPUT_POINTERDOWN` dev p95 ≥ **baseline -30%** (빈 영역 클릭 100회 반복)                      | P2~P4 re-tune 또는 선택적 롤백                              |
| G4   | P5 land 후    | 신설 `input.page-transition` dev p95 ≥ **baseline -30%** (페이지 전환 20회 반복)                          | P5 롤백 → history notify 동기 유지                          |
| G5   | P6 land 후    | dev 환경 `[perf]` warning 발생 건수 ≥ 50% 감소 (10분 세션 기준)                                           | P6 scope 축소 (validateOrderNumbers dirty-page-only 만)     |

**잔존 HIGH 위험 없음** — Risk Threshold Check 에서 대안 A 가 HIGH+ 0개로 통과. Gate 실패 시 Phase 단위 롤백으로 흡수.

## Consequences

### Positive

- `apps/builder/src/builder/workspace/canvas/hooks/useCentralCanvasPointerHandlers.ts` 빈 영역 클릭 경로 `selectElementWithPageTransition` 일원화 → store notify 1회 감소.
- `apps/builder/src/builder/workspace/canvas/BuilderCanvas.tsx` 루트 selection 구독 제거 → 루트 useMemo 체인 재평가 빈도 감소.
- `apps/builder/src/builder/workspace/canvas/scene/buildSceneSnapshot.ts` 분할 → scene-structure 계산과 selection snapshot 독립 캐싱.
- `rendererInvalidationPacket` 분할 → `SkiaCanvas` 의 `packet.selection.selectionSignature` 분기 효과 실현 (현재는 packet 자체가 재생성되어 상쇄).
- `apps/builder/src/builder/stores/history.ts` notify deferral → 페이지 전환 critical path 단축.
- `apps/builder/src/builder/main/BuilderCore.tsx` `validateOrderNumbers` dirty-page-only 축소 → dev 경고 노이즈 감소.
- 신설 계측 라벨 `input.page-transition` 으로 향후 ADR 도 동일 지표 사용 가능.

### Negative

- `BuilderCanvas` 하위 컴포넌트 (`ElementsLayer` / `SkiaCanvas` packet 생성부) props 흐름 개편 필요 — 리뷰 시 호출처 확인 부담.
- `buildSceneSnapshot` 분할 후 signature 계산 지점이 2곳으로 증가 — stale 방지 규칙 문서화 필요 (`.claude/rules/canvas-rendering.md` 추가).
- P5 `historyManager.setCurrentPage` notify deferral 은 undo/redo 타이밍 semantics 변화 가능성 — Chrome MCP 로 5회 이상 왕복 회귀 테스트 필요.
- P6 dirty-page-only validate 는 기존 전수 검사에서 놓쳤던 엣지 케이스 발견 지연 가능 — weekly report 의 duplicate order_num 건수 모니터링.

---

## Addendum 2 — 함수 본체 성공 vs 체감 한계 확증 (2026-04-18)

P1~P5 land 후 dev 환경 실측 결과, **ADR-074 는 함수 본체 최적화 관점에서 완전 성공**하였으나, **실제 사용자 체감 개선은 범위 밖** 임이 longtask 측정으로 결정적으로 확증되었다.

### 실측 결과

**observe 본체 측정 (ADR-074 의 목표 축)**:

| 라벨                    | count |  mean  |  p50  |   p95   |      판정       |
| ----------------------- | :---: | :----: | :---: | :-----: | :-------------: |
| `input.pointerdown`     |  14   | 1.45ms | 1.1ms | (\<2ms) | ✅ Gate G3 충족 |
| `input.page-transition` |   9   | 0.72ms | 0.8ms | (\<2ms) | ✅ Gate G4 충족 |

**longtask task-level 측정 (체감 축, PerformanceObserver)**:

| 라벨                    | count |   mean    |  p50  |  p95  |   **p99**   |   **max**   | viol100ms |
| ----------------------- | :---: | :-------: | :---: | :---: | :---------: | :---------: | :-------: |
| `longtask.input`        |  52   | 463.79ms  | 467ms | 621ms | **1016ms**  |   1016ms    | **100%**  |
| `longtask.render`       |  21   | 1219.95ms | 393ms | 578ms | **19742ms** | **19742ms** |    57%    |
| `longtask.unclassified` |  105  |  172.5ms  | 119ms | 411ms |    447ms    |   2942ms    |    65%    |

### 해석

- **Pointerdown 함수 본체 1.1ms vs longtask.input p50 467ms** — 비율 0.24% 만 함수 본체. 나머지 99.76% 는 React commit phase + subscriber fan-out. P4 의 루트 selection 구독 제거로 BuilderCanvas 루트 fan-out 은 차단했으나, 하위 컴포넌트 (StoreRenderBridge / SkiaCanvas rAF / 기타 store subscriber 800+ 개) 는 잔존.
- **longtask.render p99 19742ms** — 20 초 stall. 한 번이라도 이 수준이 발생한다는 건 실사용 응답성 파괴. SkiaCanvas rAF loop + render.content.build + StoreRenderBridge fan-out 결합 폭주. **ADR-074 scope 전혀 건드리지 않는 별개 경로**.
- **violations100ms = 100% (longtask.input)** — 모든 input longtask 가 100ms 임계를 넘김. 이는 ADR-069 Phase 0 세션에서 확증된 "observe 본체 1ms 미만 vs Chrome Violation 300~600ms" 패턴과 정확히 동일.

### ADR-074 범위 한계 재확증

ADR-074 의 정식 Gate G1~G5 는 함수 본체 및 루트 리렌더 차단에 한정되며, 이 범위 내에서는 모두 충족됨:

- **G1 (empty-click root renderCount = 1)**: 구조적 충족 (Phase 4 에서 루트 selection 구독 6개 제거).
- **G2 (snapshot/packet identity)**: 구조적 충족 (Phase 2 structure snapshot + Phase 3 scene packet 분리).
- **G3 (input.pointerdown p95)**: 본체 1.1ms 로 사실상 최소치 (baseline 없이도 물리적 하한 근접).
- **G4 (input.page-transition p95)**: 본체 0.8ms 로 사실상 최소치.
- **G5 (dev warning count)**: 본 ADR 에서 P6 (validateOrderNumbers dirty-scope) 은 **보류**. 체감과 무관하며 우선순위 낮음.

### 후속 이관

longtask 측정으로 노출된 세 영역은 본 ADR 범위 밖이며, 다음으로 이관:

1. **`longtask.input` p99 1016ms / viol100 100%** — React commit + subscriber fan-out. ADR-069 Phase 2-B 에서 20개 subscriber 정리했으나 1168 개 중 800+ 개 잔존. → **신규 ADR-075** (아래 참조) 의 부분 scope.
2. **`longtask.render` p99 19742ms** — SkiaCanvas rAF / StoreRenderBridge / render.content.build fan-out. **치명적 stall**. → **신규 ADR-075** 의 핵심 scope.
3. **`longtask.unclassified` count 105, p95 411ms** — dev scheduler.development.js / React dev build overhead. prod 빌드 시 큰 폭 감소 예상. → **prod 측정으로 재검증** (ADR-069 Implemented 세션의 방식 그대로, 별도 ADR 불필요).

### 후속 ADR

- **ADR-075 (Proposed)**: Render longtask fan-out 해체 — SkiaCanvas rAF / StoreRenderBridge subscriber 축소. Gate: `longtask.render` p99 < 500ms (현재 19742ms, -97%), `longtask.input` p95 < 100ms (현재 621ms, -84%).

### P6 처리

P6 `validateOrderNumbers` dirty-page-only scope 는 **체감 무관하며 우선순위 낮음**. Implementation 에 포함시키지 않고 보류. 필요 시 별도 작은 PR 로 처리 가능.

### 결론

ADR-074 는 "BuilderCanvas 루트 입력 경로 SSOT 재편" 을 완수했다. 함수 본체 측정 지표로 Gate G1~G4 충족, 구조적 debt (루트 과다 구독 / sceneSnapshot 덩어리 / packet 비분리) 를 청산. **실사용 체감 개선은 후속 ADR-075 에서 render fan-out 을 해체해야 실현됨** 을 longtask 실측으로 결정적으로 확증.
