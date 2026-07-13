# ADR-074 구현 상세: 캔버스 입력 파이프라인 SSOT 재편

> 본 문서는 [ADR-074](../completed/074-canvas-input-pipeline-decomposition.md) 의 Phase 구성, 파일 변경 범위, Gate 측정 방법, 롤백 전략을 상세화한다. ADR 본문은 "무엇을/왜" 에 한정하고 "어떻게" 는 이 문서에 둔다 (`.claude/rules/adr-writing.md` 스캐폴딩 규칙).

## Addendum 1 — Phase 순서 재조정 (2026-04-18)

Phase 1 land 후 실제 `BuilderCanvas.tsx` 코드 조사 결과 **원안 Phase 2 (루트 구독 제거) 가 단독 land 불가** 로 판명됨. 원인:

- `rendererInvalidationPacket` useMemo (BuilderCanvas.tsx:385~430) 가 `selectedElementId / selectedElementIds` 를 packet.selection 객체로 전달. 루트 구독 제거 시 packet 생성 불가.
- `sceneSnapshot` useMemo (BuilderCanvas.tsx:268~300) 가 `selectedElementIds / currentPageId` 를 deps 로 포함. 루트 구독 제거 시 snapshot 계산 불가.

원안 Phase 3 (sceneSnapshot 분할) 와 Phase 4 (packet 분할) 는 루트 구독 변경 없이 **독립 land 가능**. 두 단계 완료 후 useMemo deps 가 selection-invariant 하위 필드로 축소되면 루트 구독 제거가 자연 달성.

### 재조정된 Phase 순서

| Phase | 원안 (초안)              | 재조정 (2026-04-18)              | 비고                                  |
| ----- | ------------------------ | -------------------------------- | ------------------------------------- |
| P1    | 입력 경로 일원화         | **동일** (land 완료: `f3bc6f0a`) | —                                     |
| P2    | 루트 selection 구독 제거 | **sceneSnapshot 분할**           | 원안 P3 승격                          |
| P3    | sceneSnapshot 분할       | **packet scene/overlay 분리**    | 원안 P4 승격                          |
| P4    | packet 분할              | **루트 selection 구독 제거**     | 원안 P2 강등, P2+P3 선행 조건 만족 후 |
| P5    | history notify deferral  | **동일**                         | —                                     |
| P6    | dev validate dirty-scope | **동일**                         | —                                     |

Gate 매핑도 일부 변동: **G1 (empty-click root renderCount = 1)** 은 재조정된 P4 land 후 확정. **G2 (sceneSnapshot/packet identity 유지)** 는 재조정된 P2~P3 land 후 확정.

본 문서의 아래 "Phase 1 ~ Phase 6" 세부는 **재조정된 순서** 기준으로 유지된다 (원안 설명은 참고용).

---

## 0. Baseline 측정 (Phase 진입 전 필수)

본 ADR 의 Gate G3/G4 는 **상대적 개선치** (-30%) 이므로 baseline 측정이 선행되어야 한다.

### 측정 환경

- Chrome 정식 빌드 (stable)
- dev 서버 (`pnpm dev`)
- 5000+ elements 로드된 샘플 프로젝트 (ADR-069 Phase 2-0 기준 프로젝트 재사용)
- DevTools Performance panel CPU throttling **off**, Network **off**
- 브라우저 확장 **비활성화**

### 계측 방법

```
window.__composition_PERF__.reset()
# 100회 빈 영역 클릭 반복
window.__composition_PERF__.snapshot("input.pointerdown")
# 20회 페이지 전환 반복 (Page A → B → A → B ...)
window.__composition_PERF__.snapshot("input.page-transition")  # 신설 라벨, Phase 5 에서 활성
```

### 기록 위치

`docs/adr/design/074-baseline-measurements.md` 신설. 측정 후 Gate 목표 수치 갱신.

---

## 1. Phase 구성

각 Phase 는 **독립 PR** 로 land. Phase 경계에서 type-check + Chrome MCP 회귀 PASS 확인.

### Phase 1 — 입력 경로 일원화 (`selectElementWithPageTransition` 전면 적용)

**목적**: 빈 영역 클릭 경로의 `setCurrentPageId + setSelectedElement` 2-call 을 `selectElementWithPageTransition` 단일 호출로 병합.

**파일 변경**:

- `apps/builder/src/builder/workspace/canvas/hooks/useCentralCanvasPointerHandlers.ts`
  - line 321~334 `bodySelection.pageId` 분기의 `setCurrentPageId() + setSelectedElement()` 쌍 → `selectElementWithPageTransition(bodyElementId, bodySelection.pageId)` 단일 호출로 교체.
  - `bodySelection.bodyElementId === null` 케이스는 별도 처리 (selection 해제 + 페이지 전환만) — `setCurrentPageId + setSelectedElements([])` 유지하되 단일 set() 로 래핑한 신규 action `clearSelectionWithPageTransition(pageId)` 신설 검토.
  - 페이지 영역 밖 클릭 (line 331~334) 은 기존 `setSelectedElements([])` 유지.

- `apps/builder/src/builder/stores/elements.ts`
  - 필요 시 `clearSelectionWithPageTransition(pageId)` 신설 (P1 내에서 판단, 아니면 Phase 2 로 이월).

**Gate**: G1 일부 진입 가능 조건 — empty-click renderCount 관찰. 단 P2 의 루트 구독 제거 전까지는 G1 PASS 확정 불가.

**Rollback**: 2-call 원복 (git revert).

---

### Phase 2 — `buildSceneSnapshot` 분할 (structure / selection)

> 원안 Phase 3 를 승격. Addendum 1 참조.

**목적**: scene-structure 계산 (`depthMap / pageDataMap / pageFrames / visiblePages`) 과 selection snapshot 을 독립 함수로 분리. BuilderCanvas 에서 별도 `useMemo` 로 소비. selection-only 변화 시 structure 재계산 비용 제거.

**파일 변경**:

- `apps/builder/src/builder/workspace/canvas/scene/buildSceneSnapshot.ts`
  - `buildSceneStructureSnapshot(input)` 신설 (depth/pageData/pageFrames/visiblePages/pageFrameMap/allPageFrameVersion/document 레벨 모두).
  - 기존 `buildSceneSnapshot` 은 `buildSceneStructureSnapshot + buildSelectionSnapshot` 합성으로 재정의 (하위 consumer 호환 유지).
  - `sceneSnapshotTypes.ts` 에 `SceneStructureSnapshot` / `SceneSelectionSnapshot` 타입 분리 export. 기존 `SceneSnapshot` 타입은 두 타입의 union 으로 재정의.

- `apps/builder/src/builder/workspace/canvas/BuilderCanvas.tsx`
  - 기존 `sceneSnapshot` useMemo 를 `sceneStructureSnapshot` useMemo (deps: selection 제외) + `sceneSelectionSnapshot` useMemo (deps: selection 만) 2 개로 분리.
  - 하위 consumer (`skiaRendererInput`, `layoutPublisherInputs`, `rendererInvalidationPacket`) 는 기존 `sceneSnapshot` 인터페이스를 기대하므로, 합성 `sceneSnapshot` useMemo 를 유지 (deps: `sceneStructureSnapshot` + `sceneSelectionSnapshot` — 둘 다 identity 안정적이면 identity 유지).

**Gate**: G2 일부 진입 — `sceneStructureSnapshot.document.pageFrameMap` identity 가 selection-only 변화 시 `Object.is` 로 유지되는지 수동 assertion.

**Rollback**: `buildSceneStructureSnapshot` helper 제거 + BuilderCanvas useMemo 통합 원복 (기존 단일 useMemo 로 복귀).

---

### Phase 3 — `rendererInvalidationPacket` scene/overlay 분리

> 원안 Phase 4 를 승격. Addendum 1 참조.

**목적**: 단일 packet 을 `sceneInvalidationPacket` + `overlayInvalidationPacket` 으로 분리. SkiaCanvas 의 `lastSelectionSignatureRef` 분기 효과 실현.

**파일 변경**:

- `apps/builder/src/builder/workspace/canvas/invalidation/rendererInvalidation.ts` (또는 현재 `createRendererInvalidationPacket` 정의 파일)
  - `createSceneInvalidationPacket(input)` 신설: `grid / workflow / dataSource` 등 scene 구조 관련 필드만.
  - `createOverlayInvalidationPacket(input)` 신설: `ai / selection / editingContext / aiFlashAnimations` 등 overlay 한정.
  - 기존 `createRendererInvalidationPacket` 은 두 함수의 합성으로 유지 (backward-compat, deprecated 마킹).

- `apps/builder/src/builder/workspace/canvas/BuilderCanvas.tsx` / `SkiaCanvas.tsx`
  - 두 packet 을 SkiaCanvas 에 별도 props 로 전달 (또는 context 분리).
  - SkiaCanvas 내부에서 scene packet 변화 시에만 content rebuild, overlay packet 변화 시에만 overlay invalidation.

**Gate**: G2 PASS 확정 — selection-only 변화 시 `sceneInvalidationPacket` identity 유지, `render.content.build` 스킵 관찰.

**Rollback**: 단일 packet useMemo 복원.

---

### Phase 4 — `BuilderCanvas` 루트 selection 구독 제거

> 원안 Phase 2 를 강등. Addendum 1 참조. Phase 2~3 선행으로 useMemo deps 가 selection-invariant 하위 필드로 축소되어야 실행 가능.

**목적**: 루트에서 `currentPageId / selectedElementId / selectedElementIds` 직접 구독 제거. selection fan-out 을 하위 컴포넌트 (`ElementsLayer` / `SkiaCanvas`) 로 내림.

**파일 변경**:

- `apps/builder/src/builder/workspace/canvas/BuilderCanvas.tsx`
  - line 157~159 `useStore((state) => state.currentPageId/selectedElementId/selectedElementIds)` 3 개 구독 제거.
  - line 153 주석 (`selectedElementIds는 ElementsLayer 내부에서 직접 구독`) 과 실제 구현 정합 복원.
  - `sceneSelectionSnapshot` / `overlayInvalidationPacket` 생성을 하위 컴포넌트 또는 selection 전용 provider 로 이전.

- `apps/builder/src/builder/workspace/canvas/skia/SkiaCanvas.tsx` (또는 `SkiaOverlayProvider` 신설)
  - overlay packet 생성을 SkiaCanvas 내부로 이전. 기존 `packet.selection.selectionSignature` / `packet.selection.editingSignature` 분기는 유지.

- `apps/builder/src/builder/workspace/canvas/ElementsLayer.tsx` (해당 파일 확인 후 경로 정정)
  - selection 구독이 이미 내부에 있는지 확인. 없으면 `sceneSelectionSnapshot` 직접 구독 추가.

**Gate**: G1 PASS 확정 (empty-click 시 BuilderCanvas root renderCount = 1, React DevTools Profiler 관찰).

**Rollback**: 루트 구독 복원 + selection useMemo 루트 배치 복원.

---

### Phase 5 — `historyManager.setCurrentPage` notify deferral + 신설 라벨

**목적**: 페이지 전환 critical path 에서 listener notify 를 microtask 로 deferral. 신설 라벨 `input.page-transition` 으로 G4 측정 가능화.

**파일 변경**:

- `apps/builder/src/builder/stores/history.ts`
  - `setCurrentPage(pageId)` 내부 `this.notifyListeners()` 를 `queueMicrotask(() => this.notifyListeners())` 로 교체.
  - `pageHistories.set()` 신규 생성은 동기 유지 (restoreFromIndexedDB 와 순서 보장).
  - Undo/Redo stack 접근 시 `pageHistories.get(pageId)` 가 null 이면 microtask 완료 대기하는 safety net 추가.

- `apps/builder/src/builder/utils/perfMarks.ts`
  - `PERF_LABEL` 에 `INPUT_PAGE_TRANSITION: "input.page-transition"` 추가.

- `apps/builder/src/builder/stores/elements.ts`
  - `setCurrentPageId` / `selectElementWithPageTransition` 의 페이지 전환 분기 전체를 `observe(PERF_LABEL.INPUT_PAGE_TRANSITION, ...)` 로 래핑.

**Gate**: G4 PASS — `input.page-transition` p95 dev 환경 baseline -30%.

**Rollback**: microtask deferral 제거 + 신설 라벨 유지 (계측 자산).

---

### Phase 6 — `validateOrderNumbers` dirty-page-only 축소

**목적**: dev-only 전수 검사 → dirty page scope 한정.

**파일 변경**:

- `apps/builder/src/builder/hooks/useValidation.ts`
  - `validateOrderNumbers(elements)` 시그니처를 `validateOrderNumbers(elements, options?: { pageIds?: string[] })` 로 확장.
  - `pageIds` 지정 시 해당 페이지 소속 elements 만 `reduce` 그룹핑.

- `apps/builder/src/builder/main/BuilderCore.tsx`
  - `useEffect` 내부 `validateOrderNumbers(elements)` → `validateOrderNumbers(elements, { pageIds: [currentPageId] })` 로 변경.

- `apps/builder/src/builder/stores/elements.ts`
  - `dirtyPageIds: Set<string>` 신설 (저장 직후 페이지 id 누적). 기존 `dirtyElementIds` 와 병렬.

**Gate**: G5 PASS — dev `[perf]` warning 건수 10분 세션 기준 -50%.

**Rollback**: `pageIds` 파라미터 optional 유지 (forward-compat) + 호출처 원복.

---

## 2. 측정 인프라 요약

| Gate | 라벨/도구                                 | 관찰 방법                                                | 목표     |
| ---- | ----------------------------------------- | -------------------------------------------------------- | -------- |
| G1   | React DevTools Profiler                   | empty-click 시 BuilderCanvas root renderCount            | = 1      |
| G2   | `Object.is` + console.assert              | selection-only 변화 시 sceneStructure/scenePacket 동일성 | 유지     |
| G3   | `PERF_LABEL.INPUT_POINTERDOWN`            | snapshot p95 (100회 빈 영역 클릭)                        | base-30% |
| G4   | `PERF_LABEL.INPUT_PAGE_TRANSITION` (신설) | snapshot p95 (20회 페이지 전환)                          | base-30% |
| G5   | console `[perf]` warning 카운트           | 10분 세션 수동 카운트 또는 console wrap 집계             | ≥ -50%   |

---

## 3. 체크리스트 (Phase land 시)

각 Phase PR 머지 전 아래 항목 전부 PASS 확인:

- [ ] `pnpm type-check` 3 tasks PASS
- [ ] Chrome MCP 회귀: 빈 영역 클릭 / 요소 선택 / 페이지 전환 / overlay invalidation 시각 불변
- [ ] Gate 측정 결과 `docs/adr/design/074-baseline-measurements.md` 에 기록
- [ ] `.claude/rules/canvas-rendering.md` 에 신설 signature 계산 지점 규칙 추가 (재조정 P2 land 후)
- [ ] `parallel-verify` skill 로 영향 컴포넌트 패밀리 (Tabs/Select/Menu — packet 분기 공유) 회귀 검증 (재조정 P3 land 후)

---

## 4. 의존성 / 선후 관계

(Addendum 1 재조정 반영)

```
P1 ──→ P2 ──→ P3 ──→ P4 ──→ (P5, P6 병렬 가능)

P2: sceneSnapshot 분할 (scene-invariant useMemo 분기 신설)
P3: packet scene/overlay 분리 (P2 의 scene signature 를 overlay 와 격리)
P4: BuilderCanvas 루트 selection 구독 제거
    ↑ P2+P3 선행으로 루트 useMemo deps 가 selection-invariant 가 된 이후 자연 달성
```

- P5 는 P1~P4 와 독립. 단 `input.page-transition` 라벨 도입은 선행 필요 (P5 내부에서 처리).
- P6 은 전부 독립. 마지막 land 권장 (dev 경고 감소가 다른 Gate 측정 noise 감소에 기여).

---

## 5. 리스크 완화 노트

### R1. P2 buildSceneStructureSnapshot 의 pageFrameMap identity 보존 실패

- 완화: Map 인스턴스를 useMemo 로 감싸고 deps 에 `elements` / `pagePositions` 만 포함. `selectedElementIds` / `currentPageId` 제외.
- 검증: Phase 2 land 직후 `Object.is(prev.document.pageFrameMap, next.document.pageFrameMap)` 수동 assertion (selection 클릭 100회 반복).

### R2. P3 packet 분리 후 SkiaCanvas 내부 refs 정합성

- 완화: `lastSelectionSignatureRef` / `lastEditingContextRef` / `lastAIActiveRef` 가 overlay packet 과만 연동되도록 정리. scene packet 은 `lastSceneSignatureRef` 신설.
- 검증: Chrome MCP 로 selection 클릭 시 `render.content.build` 이 스킵되고 overlay 분기만 동작하는지 console 로그 관찰.

### R3. P4 루트 구독 제거 후 하위 컴포넌트 props flood

- 완화: ElementsLayer / SkiaCanvas overlay provider 가 이미 selection 을 소비한다면 신규 props 증가 없음. Phase 4 진입 전 사전 조사.
- Fallback: selection 전용 React Context 도입 (provider 가 `subscribeWithSelector` 로 구독 + 하위는 `useContext`).

### R5. P5 notify deferral 로 undo/redo 즉시 반응성 저하

- 완화: undo/redo action 진입 시 동기 flush (`flushPendingNotify()` helper). 테스트 케이스: 페이지 전환 → 즉시 `Cmd+Z` 시나리오.

---

## 6. 종결 기준 (ADR-074 Implemented 전환)

- G1 / G2 / G3 / G4 / G5 모두 PASS
- 6 Phase 전부 main 머지 + Chrome MCP 회귀 PASS
- `docs/adr/design/074-baseline-measurements.md` 에 before/after 수치 기록
- `docs/adr/README.md` 에서 Proposed → Implemented 상태 전이 + 완료 ADR 섹션 이동
