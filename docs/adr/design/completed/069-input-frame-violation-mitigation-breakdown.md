# ADR-069 Breakdown — 입력·프레임 Violation 완화 구현 상세

> ADR 본문: [069-input-frame-violation-mitigation.md](../../completed/069-input-frame-violation-mitigation.md)
>
> 본 문서는 Phase 목록, 파일 변경표, 체크리스트를 담는다. 결정 근거/대안 비교는 ADR 본문 참조.

## 영향 파일 (현재 코드 기준)

| 경로                                                                                                     | 역할                                                                        | 변경 Phase |
| -------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------- | :--------: |
| `apps/builder/src/builder/workspace/canvas/hooks/useCanvasElementSelectionHandlers.ts`                   | `handleElementClick` 진입점, 3-set 근원                                     |     1      |
| `apps/builder/src/builder/workspace/canvas/hooks/useCentralCanvasPointerHandlers.ts`                     | 중앙 native pointerdown, `computeBounds` 2회 호출                           |     1      |
| `apps/builder/src/builder/stores/elements.ts`                                                            | `setSelectedElement`/`setCurrentPageId`/`clearSelection` Phase1/Phase2 패턴 |     1      |
| `apps/builder/src/builder/workspace/canvas/BuilderCanvas.tsx`                                            | 광역 구독자, selector 세분화 대상                                           |     2      |
| `apps/builder/src/builder/workspace/canvas/skia/skiaFramePlan.ts`                                        | `buildFrameRenderPlan` — 분리 + 캐시                                        |     3      |
| `apps/builder/src/builder/workspace/canvas/skia/SkiaCanvas.tsx`                                          | `renderFrame` — 서브-시그니처 조립                                          |     3      |
| `apps/builder/src/builder/workspace/canvas/skia/invalidationPacket.ts` (가칭 — 실제 경로는 구현 시 확인) | `overlayVersion` → 서브-버전 세분화                                         |     3      |
| `apps/builder/src/builder/stores/scenePanels.ts` (인스펙터/레이어 패널 selector 정의)                    | id-only 구독 전환                                                           |     2      |

## Phase 0 — Baseline 측정 (대안 D 편입)

측정 없는 최적화 금지. 프로덕션 빌드에서 실측 후 Phase 1 착수.

### 체크리스트

- [ ] `pnpm build && pnpm preview`로 프로덕션 빌드 실행
- [ ] Chrome DevTools Performance 패널로 4개 시나리오 각각 10회씩 기록:
  - 같은 페이지 요소 클릭
  - 다른 페이지 요소 클릭
  - body 빈 영역 클릭
  - workflow overlay ON 상태 클릭
- [ ] 각 시나리오의 pointerdown Bottom-Up을 CSV로 저장:
  - `computeSelectionBoundsForHitTest` self-time
  - `hitTestPoint` (WASM) self-time
  - store action(`setSelectedElement`/`setCurrentPageId`/`clearSelection`) self-time
  - React commit 시간 + commit 횟수
- [ ] 직후 rAF 1~3 프레임의 `buildSkiaFrameContent` / `buildFrameRenderPlan` / `renderer.render` self-time 분리
- [ ] 측정 결과를 `docs/adr/design/069-input-frame-violation-mitigation-baseline.md`(별도 파일)에 표로 기록

### Gate G0 통과 조건

- 4 시나리오 × 상위 3 hotspots 식별 완료
- dev vs prod 차이 비율 확인 (대안 D 기각 근거)

## Phase 1 — same-turn store write 병합 (대안 A)

### 1-1. store 액션 신설

`stores/elements.ts`에 페이지 전환 + 선택을 단일 mutation으로 처리하는 action 추가.

```ts
// 개념 스케치 — 실구현은 기존 setSelectedElement Phase1/Phase2 패턴 준수
selectElementWithPageTransition: (elementId, targetPageId, options?) => {
  const startTime = performance.now();
  cancelHydrateSelectedProps();

  // Phase 1 (즉시 set 1회): currentPageId + selected* 동시 갱신
  set((state) => ({
    currentPageId: targetPageId ?? state.currentPageId,
    selectedElementId: elementId,
    selectedElementIds: [elementId],
    selectedElementIdsSet: new Set([elementId]),
    multiSelectMode: false,
  }));

  // Phase 2 (scheduleNextFrame): selectedElementProps hydrate
  scheduleNextFrame(() => {
    /* 기존 패턴 동일 */
  });
  scheduleHydrateSelectedProps(elementId);
};
```

### 1-2. `useCanvasElementSelectionHandlers.ts` 호출부 교체

- `clearSelection()` + `setCurrentPageId()` + `setSelectedElement()` 순차 호출을 `selectElementWithPageTransition()` 1회로 치환
- `startTransition` 래핑 제거(Zustand에 대해 no-op이므로 제거로 코드 의도 명확화)

### 1-3. `useCentralCanvasPointerHandlers.ts` bounds 중복 제거

- L172 `computeSelectionBoundsForHitTest()` 결과를 `selectionBoundsRef.current`에 저장
- L242 fresh bounds 재계산은 "`handleElementClick`이 실제로 currentPageId 변경했거나 selectedIds 변경한 경우"에만 조건부 실행
- 그렇지 않으면 최초 계산 결과 재사용

### 체크리스트

- [ ] `selectElementWithPageTransition` action 추가 + 타입 갱신
- [ ] `useCanvasElementSelectionHandlers.ts` 3-set → 1-set 치환
- [ ] `startTransition` 래핑 제거(이유 주석 1줄만)
- [ ] `computeSelectionBoundsForHitTest` 조건부 재호출 구현
- [ ] `pnpm type-check` PASS
- [ ] Chrome MCP로 4 시나리오 회귀 (ADR-043 drag + ADR-027 inline edit 포함)
- [ ] **Drag 즉시 시작 회귀 테스트**: 다른 페이지 요소를 클릭 직후 threshold(3px) 초과 이동 시 `pendingDrag.bounds`가 새 selection 기준으로 정확한지 검증. batched action 후 `state.elementsMap.get(hitElementId)` 즉시 조회 가능성 확인 (Phase 1(즉시 set)이 stale을 만들지 않는지)
- [ ] **Preview iframe 페이지 표시 회귀**: 다른 페이지 요소 클릭 시 Preview iframe이 대상 페이지로 전환되는지 확인. `setCurrentPageId` 병합 후에도 postMessage 전파 타이밍이 변하지 않아야 함 (ADR-004 iframe isolation 계약)
- [ ] **Multi-selection 회귀**: shift/meta 연타 선택 유지 여부 확인 — `selectElementWithPageTransition`는 단일 선택 경로에만 적용, 다중 선택 경로는 기존 `setSelectedElements` 유지

### Gate G1 통과 조건

- 페이지 전환 경로 same-turn `set()` 호출 수 3 → 1 (console 계측)
- 프로덕션 빌드 pointerdown p95 < 50ms, 연속 20 클릭

## Phase 2 — 구독 fan-out 축소 (대안 A 연장)

### 2-1. selector 세분화 대상 식별

Phase 0 Performance 프로파일에서 commit 시간 상위 컴포넌트 선별. 예상 대상:

- `BuilderCanvas.tsx` — `useStore(...)` 광역 구독
- StylesPanel / InspectorPanel — selectedElementProps 전체 구독
- LayerPanel — childrenMap/elementsMap 구독

### 2-2. id-only 구독 전환

- `selectedElementId`만 구독 → 실제 props는 하위 컴포넌트에서 lazy `useStore(s => s.elementsMap.get(id))`
- `useShallow` 금지 규약(ESLint) 하에 primitive selector + `useMemo` 조립 패턴 적용 (ADR-067 선례)

### 체크리스트

- [ ] Phase 0 측정에서 commit 시간 상위 3 컴포넌트 선별
- [ ] 각 컴포넌트 selector를 primitive 단위로 분해
- [ ] `pnpm type-check` PASS
- [ ] React Profiler로 클릭 1회당 re-render 수 before/after 비교

## Phase 3 — FrameRenderPlan 부분 캐시 (대안 B)

### 3-1. `buildFrameRenderPlan` 분리

현재 단일 함수를 3개로 분해:

```
buildOverlayPlan(ctx, { selectionVersion, editingVersion, minimapVersion })
buildContentPlan(ctx, { registryVersion, pagePosVersion, viewportBounds })
buildWorkflowPlan(ctx, { workflowOverlaySignature, graphSignature, hoverEdgeId })
```

각 함수는 자체 캐시 키(weak ref 또는 Map)를 보유하고, 키 일치 시 이전 plan 객체를 그대로 반환한다.

### 3-2. `overlayVersion` 서브-시그니처 세분화

- 현재: 단일 `overlayVersionRef.current++`가 selection/editing/minimap/drag/AI/grid/workflow 전부를 포괄
- 변경: `overlayVersions = { selection, editing, minimap, drag, ai, grid, workflow }` 구조체로 분리
- `recordInvalidation("overlay", reason)` 호출부에서 reason별 해당 키만 bump

### 3-3. renderer.render 호출 최적화

- framePlan 객체 자체의 참조 동일성으로 `renderer.setOverlayNode`/`setContentNode` 스킵 판단
- dirty-plane 단위 draw (overlay-only 변경 시 content 레이어 미드로우)

### 체크리스트

- [ ] `skiaFramePlan.ts` 3-way 분리 + 타입 정의
- [ ] `overlayVersions` 구조체 도입 + invalidation 호출부 전수 수정
- [ ] `renderer.setOverlayNode` 참조 동일성 스킵 구현
- [ ] `/cross-check` skill 5 샘플 × 5-레이어 PASS
- [ ] `parallel-verify` 패밀리 1회 통과
- [ ] Chrome MCP: **AI 비활성 상태**에서 selection 연타 → content node 재사용률 100% 확인 (계측 로그 필요)
- [ ] **AI active 상태 예외 검증**: `aiState.generatingNodes`/`flashAnimations` 활성 중에는 overlay 매 프레임 bump가 정상 동작이므로 재사용률 100% 조건에서 제외됨을 코드 주석 + Gate 문구에 명시

### Gate G2 통과 조건

- rAF renderFrame p95 < 50ms(프로덕션)
- **AI 비활성 상태 전제**하에 selection-only 변경 시 contentNode 참조 동일 100%
- `/cross-check` PASS + `parallel-verify` PASS

## Phase 4 — 종합 검증 + 종결

### 체크리스트

- [ ] 4 시나리오 × 10 클릭 Violation 경고 0건 (Chrome DevTools)
- [ ] Canvas 60fps 유지 (PerformanceDashboard 스냅샷)
- [ ] ADR-043 drag / ADR-049 reparenting / ADR-027 inline edit 회귀 없음
- [ ] auto-memory `session-2026-MM-DD-violation-mitigation.md` 기록
- [ ] ADR-069 Status: Proposed → Implemented
- [ ] `docs/adr/README.md` 현황 요약 + 테이블 갱신

### Gate G3 통과 조건

- Violation 경고 0건/연속 10 클릭 × 4 시나리오 = 40 클릭 모두 클린
- 60fps 유지
- 회귀 없음

## 롤백 전략

- Phase 1: `selectElementWithPageTransition` revert + 기존 3-set 복구
- Phase 2: selector 단위 revert (PR 단위 분할 권장)
- Phase 3: `overlayVersions` 구조체 → 단일 `overlayVersion` 복구 + 분리 함수 재합성
- 각 Phase는 독립 PR로 제출하여 revert 단위를 격리

## 측정 방법 세부

### `performance.mark` 기반 INP 근사 계측

```ts
// 개념 스케치
const pointerDownStart = performance.now();
// ... handler body ...
performance.measure("input.pointerdown", { start: pointerDownStart });
```

- `performance.getEntriesByName("input.pointerdown")` 주기적 수집 → `stats/violations.jsonl` 기록 (선택)
- 프로덕션 빌드에서만 활성화하여 개발 오버헤드 제거

### Chrome DevTools Bottom-Up 템플릿

```
Performance 기록 → Main thread → 해당 pointerdown task 선택
→ Bottom-Up 탭 → Group by Function
→ 상위 10개 self-time 엔트리 캡처
```

Phase 0 baseline 문서에 이 절차를 표준화하여 Phase 1/2/3 각각 after 측정에서 동일 방법으로 비교.

## Addendum — 2026-04-17 (Phase 1 실측 이후 재조정)

> ADR 본문 Addendum 참조. 본 breakdown의 Phase 3(FrameRenderPlan 부분 캐시)는 **철회 권고**. Phase 2 앞에 **관찰성 2.0 단계(Phase 2-0)**를 추가한다.

### Phase 2-0 — 관찰성 2.0 (longtask PerformanceObserver)

`observe()` wrapper는 함수 본체만 측정하므로 Chrome task 전체 시간(React commit + subscriber fan-out 포함)을 놓친다. Phase 2 착수 전 선행하여 before/after 비교 가능하도록 longtask 관찰자를 추가한다.

#### 2-0-1. `perfMarks.ts` 확장

- `measurementTraces` 링버퍼 추가 (5s / 최대 256 entries). `observe`/`observeAsync`/`markEnd`에서 `pushTrace(label, start, end)` 호출
- `PerformanceObserver({ entryTypes: ['longtask'] })` 등록 — SSR 가드 + feature-detect(`supportedEntryTypes`) + try/catch
- 각 longtask entry의 `[startTime, startTime+duration]`과 `measurementTraces`의 overlap 최댓값으로 라벨 분류:
  - `input.*` 매치 → `longtask.input`
  - `render.*` 매치 → `longtask.render`
  - 매치 없음 → `longtask.unclassified`
- 기존 p50/p95/p99/violations 통계 구조 재사용 + `topAttributions`(script name 상위 5개) 추가
- `window.__composition_PERF__` 확장: `snapshotLongTask(label)` / `snapshotLongTasks()` / `resetLongTasks()`

#### 체크리스트

- [x] `apps/builder/src/builder/utils/perfMarks.ts` 확장
- [x] `pnpm type-check` PASS
- [ ] 실 브라우저에서 `__composition_PERF__.snapshotLongTasks()` 동작 확인 (사용자 수동 조작, MCP 제어 탭은 `visibilityState: 'hidden'` 이슈로 부정확)
- [ ] baseline 측정: 페이지 전환 클릭 20회 → `longtask.input` p50/p95/violations50ms 기록

### Phase 2 — 구독 fan-out 축소 (재조정된 1순위)

ADR 본문 Addendum의 Gate G2'("`longtask.input` p95 < 50ms + violations50ms 0건, 연속 20 클릭")를 목표로 한다.

#### 2-A. BuilderCanvas 광역 구독 분해 — **스킵 결정 (2026-04-17)**

**감사 결과 요약**:

- `BuilderCanvas.tsx` L140~244 총 45건 `useStore`/`useViewportSyncStore`/`useAIVisualFeedbackStore`/`useCanvasLifecycleStore`/`useLayoutsStore` 호출
- 45건의 용도 분포:
  - stable actions(`setSelectedElement` 등) 12건 — 리렌더 유발 없음 (reference stable)
  - `sceneSnapshot` useMemo deps 14건
  - `skiaRendererInput` useMemo deps 9건
  - `rendererInvalidationPacket` useMemo deps 19건
  - 기타 effect/callback 5건
- **JSX 자체는 단순** (`SkiaCanvasLazy` + `ViewportControlBridge` + `TextEditOverlay` + WASM 배너). BuilderCanvas는 "canvas용 데이터 조립기" 성격이며 45건 구독은 3개 useMemo 조립로 수렴
- 각 deps는 3 useMemo 결과에 **구조적으로 필요한 값**이라 제거 불가. ADR-067 선례의 "primitive + useMemo 조립"은 **이미 현재 형태**

**정량 근거 — 실제 Violation 주범 분포**:

```
selectedElement* (Id/Ids/Props) 구독 파일 수: 24
currentPageId 구독 파일 수:                 20
elements 배열 구독 파일 수:                  4
BuilderCanvas 본체:                         1
```

Chrome Violation `click 430~510ms × 2 + message 200ms` 주기 패턴은 BuilderCanvas 1 subscriber가 아닌 **24 files + 각 파일 내부 여러 subscriber(PropertyUnitInput 등 row 단위)의 연쇄 commit**에서 발생. BuilderCanvas의 3-useMemo 재실행은 `render.content.build` 0.01ms 측정값으로 이미 충분히 낮음.

**결론**: Phase 2-A는 스킵. 재분해 여지 구조적으로 작고, Phase 2-B ROI가 압도적. 미래 재검토 불필요.

#### 2-B. 실측 기반 타겟팅 (D안) — 실제 Phase 2 본 작업

Profiler 실측을 선행하여 **실제 commit 시간이 큰 상위 컴포넌트만 수정**. 24 files 일괄 감사로 확장하지 않는다.

##### 2-B-0. React DevTools Profiler 녹화

- 사용자 수동 녹화(MCP 제어 탭은 `visibilityState: 'hidden'` 이슈로 부정확)
- 시나리오: 다른 페이지 요소 클릭 1회
- 캡처:
  - Commits 탭: 첫 commit + 연쇄 commit 개수 + 각 duration
  - Ranked 탭: exclusive commit time 상위 10 컴포넌트
  - "Why did this render?" 주요 render 원인(prop/state/hook)
- 상위 5~10 타겟 → 2-B-1 수정 대상 확정

##### 2-B-1. 상위 타겟 id-only + lazy subscribe 전환

ADR-067 패턴 재적용:

- `selectedElementProps` 전체 구독 → `selectedElementId`만 구독 + 하위에서 lazy `useStore(s => s.elementsMap.get(id))`
- 배열/Map 전체 구독 → version counter + `useStore.getState()` lazy lookup
- `useShallow` 금지 — primitive selector + `useMemo`로 조립

##### 2-B-2. 스타일 패널 섹션 감사 (ADR-067 후속 확인)

ADR-067 Phase 6까지 Jotai 제거 + Zustand native 전환 완료. 그러나 TransformSection/LayoutSection/TypographySection/AppearanceSection/ComponentStateSection 5개 섹션이 **각자 `selectedElement*` 직접 구독** 상태. Profiler 결과 이들이 상위에 포함되면 공통 컨텍스트(`useElementStyleContext` — 이미 도입됨)로 축소 가능.

#### 2-B. 인스펙터 / 레이어 / 스타일 패널

- 인스펙터: `selectedElementProps` 전체 구독 의심 → id-only 구독 + lazy subscribe (`useStore(s => s.elementsMap.get(id))`)
- 레이어 패널: `elements` 전체 구독 의심 → `childrenMap` 기반 lazy 구독 (이미 부분 적용됨, 감사만)
- 스타일 패널: ADR-067 Phase 6까지 Zustand-native 완료. 추가 최적화 여지 적을 것으로 예상 — 측정 후 판단

#### 체크리스트

- [ ] Phase 2-0 완료 후 baseline `longtask.input` p95 기록
- [ ] 2-A: `BuilderCanvas.tsx` selector 감사 리포트 작성 (구독자 목록 + 각 값의 소비처)
- [ ] 2-A: 미소비 구독 제거 + primitive selector + `useMemo` 조립 (ADR-067 패턴)
- [ ] `pnpm type-check` PASS
- [ ] 2-A 후 `longtask.input` p95 측정 → baseline 대비 개선 확인
- [ ] 2-B: Inspector/Layer/Styles 패널 감사 + 필요 시 id-only 전환
- [ ] 2-B 후 `longtask.input` p95 측정 → G2' 통과 여부 확인
- [ ] Chrome MCP 4 시나리오 회귀 PASS (ADR-043 drag + ADR-027 inline edit + multi-selection shift/meta)

### Phase 3 — FrameRenderPlan 부분 캐시 (철회 권고)

실측 결과 render pipeline 전체(`render.frame` 0.07~0.22ms, `render.content.build` / `plan.build` / `skia.draw` 각각 0.01ms)가 이미 한계 근처이므로 **대안 B의 ROI가 현저히 낮다**. 본 ADR 범위에서 제외한다.

- 재발 조건(workflow overlay 확장, AI flash 빈도 증가 등)에서 rAF 계열 longtask(`longtask.render`)가 다시 observable해질 경우 **별도 ADR로 신규 발의**
- 본 breakdown의 3-1 / 3-2 / 3-3 설계 스케치는 후속 ADR의 참고 자료로 보존

### Phase 4 — 종결 기준 (Addendum 적용)

- Gate G2' 통과 → ADR Status: Proposed → Implemented
- `docs/adr/README.md` 테이블 갱신, 세션 메모리 업데이트
- Phase 3 관련 선언("대안 B 철회")을 ADR-069 후속 ADR(필요 시) 근거로 명시
