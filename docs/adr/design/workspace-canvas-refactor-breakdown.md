# Workspace Canvas Refactor Breakdown

## Purpose

이 문서는 [ADR-035](../completed/035-workspace-canvas-refactor.md)를 실행 가능한 작업 단위로 분해한 상세 플랜이다.

목표는 다음과 같다.

- 기존 동작 완전 유지
- 리팩토링 순서 명확화
- 각 phase의 코드 변경 경계와 검증 포인트 정의

---

## Phase별 현황 (2026-03-12 코드 대조 기준)

| Phase | 설명                     | 완성도 | 위험 | 주요 잔여 작업                                 |
| :---: | ------------------------ | :----: | :--: | ---------------------------------------------- |
|   0   | Baseline & Observability |  30%   |  L   | 체크리스트 문서, baseline 수치, debug logging  |
|   1   | Workspace Shell 분해     |  90%   |  L   | 형식 정리만 (hooks/컴포넌트 분리 완료)         |
|   2   | Viewport Runtime 정리    |  70%   |  M   | canvasSync mirror 검증, 이중 동기화 제거       |
|   3   | Invalidation 모델        |   0%   |  L   | 전체 미구현                                    |
|   4   | Frame Build Pipeline     |  60%   |  M   | SkiaOverlay 함수 추출, 타입 정의               |
|   5   | Node Renderer 분해       |   0%   |  H   | 전체 미구현 (extract-only 제한)                |
|   6   | Theme/Resource 분해      |  40%   |  M   | cssVariableReader 분리, theme watcher 서비스화 |
|   7   | DOM 의존 제거            |  20%   |  M   | querySelector 제거, state 기반 전환            |
|   8   | Artifact 격리            |  80%   |  L   | IDE 탐색 제외 설정                             |

---

## Execution Strategy

### 의존 관계

```
Phase 0 ─┬─→ Phase 1 (trivial)
         ├─→ Phase 8 (quick win)
         ├─→ Phase 3 ──→ Phase 4
         ├─→ Phase 2 ──┐
         └─→ Phase 6 ──┴─→ Phase 7
                                 └──→ Phase 5 (all prior phases 완료 후)
```

### 실행 순서

| 순서 | Phase   | 근거                                                         |
| :--: | ------- | ------------------------------------------------------------ |
|  1   | Phase 0 | 모든 후속 phase의 회귀 감지 전제                             |
|  2   | Phase 1 | 90% 완료 → 형식 정리로 조기 gate 통과                        |
|  3   | Phase 8 | 80% 완료 → 빠른 성과, 저위험                                 |
|  4   | Phase 3 | 저위험 + Phase 4 선행 조건 (invalidation 규칙 → 프레임 분리) |
|  5   | Phase 2 | Phase 7 선행 조건 (viewport SSoT → scrollbar DOM 제거)       |
|  6   | Phase 6 | Phase 7 선행 조건 (watcher 서비스 분리 → DOM 의존 제거)      |
|  7   | Phase 4 | Phase 3 결과 활용, SkiaOverlay 함수 추출                     |
|  8   | Phase 7 | Phase 2+6 완료 후 진행 가능                                  |
|  9   | Phase 5 | 최후순위, 모든 phase 완료 후 extract-only                    |

### 원칙

1. **Phase 0 선행 필수** — baseline 없이 후속 phase 진행 금지
2. **완성도 높은 phase 우선** — Phase 1(90%), Phase 8(80%)을 조기 완료
3. **의존 관계 준수** — Phase 3 → 4, Phase 2+6 → 7 순서 보장
4. **hot path 최후순위** — Phase 5(nodeRenderers)를 가장 마지막에 배치
5. **Phase당 1커밋** — 문제 시 해당 phase만 rollback 가능

---

## Phase 0. Baseline (순서 #1)

### 목표

- 리팩토링 전후 행동 비교 기준 확보

### 현황

- GPUMetrics 인터페이스 정의됨 (canvasSync.ts)
- gpuProfilerCore.ts 기초 구현됨
- 통합 debug logging, 체크리스트 문서, baseline 수치 **미존재**

### 작업

- 주요 시나리오 체크리스트 작성
- 현재 baseline FPS/frame time/tree build time 수집 및 기록
- debug logging category 표준화

### 검증

- breakpoint 변경
- compare mode
- zoom/pan
- lasso/selection/resize
- text edit
- workflow overlay
- image/font/theme 변경

---

## Phase 1. Workspace Shell 분해 (순서 #2)

### 목표

- `Workspace.tsx`를 shell orchestration 파일로 축소

### 현황 (90% 완료)

이미 분리 완료된 모듈:

- ✅ `useWorkspaceCanvasSizing.ts` — breakpoint → canvasSize 계산
- ✅ `useWorkspaceCompareSplit.ts` — compare mode split 관리
- ✅ `WorkspaceCompareMode.tsx` — compare layout rendering
- ✅ `WorkspaceStatusIndicator.tsx` — context lost indicator
- ✅ `WorkflowCanvasToggles.tsx` — workflow overlay toggles
- ✅ `Workspace.tsx` — 117줄로 축소됨, shell orchestration 역할

### 잔여 작업

- Workspace.tsx 책임 경계 주석 추가
- 문서화 (현 상태가 Phase 1 목표 달성임을 기록)

### 목표 파일 구조 (달성됨)

```text
workspace/
  Workspace.tsx
  components/
    WorkflowCanvasToggles.tsx
    WorkspaceCompareMode.tsx
    WorkspaceStatusIndicator.tsx
  hooks/
    useWorkspaceCanvasSizing.ts
    useWorkspaceCompareSplit.ts
```

### 검증 포인트

- 비교 모드 UI 동일
- fallbackCanvas 경로 동일
- canvas size 계산 결과 동일
- status indicator 노출 조건 동일

---

## Phase 8. Source Tree Hygiene (순서 #3)

### 목표

- generated artifact 격리

### 현황 (80% 완료)

- ✅ `wasm-bindings/pkg/.gitignore` → `*` (모든 생성 파일 무시)
- ✅ 생성 wasm/js 파일이 git 추적에서 제외됨
- ⚠️ Rust `target/` gitignore 상태 확인 필요
- ⚠️ IDE 탐색 제외 설정 미적용

### 잔여 작업

- Rust target/ .gitignore 확인 및 보완
- IDE/에디터 탐색 제외 설정 (tsconfig, IDE settings)

### 검증 포인트

- source tree 탐색성 개선
- handwritten source와 generated output 경계 명확화

---

## Phase 3. Invalidation 모델 정리 (순서 #4)

### 목표

- content/layout/overlay/theme/resource invalidation 표준화

### 현황 (0% — 전체 미구현)

- `InvalidationReason` 타입: 미정의
- 현재: `registryVersion`, `layoutVersion`, `overlayVersion` 등 암묵적 version 카운터
- 어떤 변경이 어떤 레이어를 무효화하는지 체계 없음

### 작업

- `InvalidationReason` enum 정의:

```ts
type InvalidationReason =
  | "content"
  | "layout"
  | "viewport"
  | "overlay"
  | "theme"
  | "resource"
  | "workflow";
```

- 캐시 무효화 규칙 표 작성 (version → reason 매핑)
- content/layout/overlay/theme/resource별 invalidation ownership 문서화
- SkiaOverlay 캐시 우회/무효화 로직 정리

### 검증 포인트

- stale frame 없음
- 불필요한 content rebuild 감소
- invalidation reason 추적 가능

---

## Phase 2. Viewport Runtime 정리 (순서 #5)

### 목표

- viewport authoritative state를 `ViewportController`로 수렴

### 현황 (70% 완료)

- ✅ `ViewportController.ts` — attach/pan/zoom/fit 구현, onStateSync 콜백
- ✅ `useViewportControl.ts` — Controller-React bridge
- ✅ `viewportActions.ts` — computeFitViewport/computeFillViewport
- ⚠️ `canvasSync.ts`의 zoom/panOffset이 mirror인지 authoritative인지 불명확
- ⚠️ CanvasScrollbar에서 controller + store 이중 구독 잔존

### 잔여 작업

- `canvasSync.ts` zoom/panOffset → read-only snapshot 명시 (setter 제거 또는 @readonly 주석)
- CanvasScrollbar의 controller/store 이중 경로 → controller 단일 경로로 축소
- 이중 동기화 경로 제거 (ViewportController → store 단방향)

### 검증 포인트

- fit/fill
- pan drag
- wheel zoom
- scrollbars

---

## Phase 6. Theme / Resource Runtime 정리 (순서 #6)

### 목표

- giant util과 watcher 정리

### 현황 (40% 완료)

- ✅ `fontManager.ts` (398줄) — 독립 서비스
- ✅ `imageCache.ts` (281줄) — 독립 서비스
- ⚠️ `cssVariableReader.ts` — giant file, 미분리
- ⚠️ theme watcher — SkiaOverlay 내부에 결합
- ⚠️ readCssBgColor() — SkiaOverlay 내부 인라인

### 잔여 작업

- `cssVariableReader.ts` 4분할:
  1. raw css variable access
  2. semantic theme snapshot
  3. color conversion
  4. component token resolver
- theme watcher 서비스 분리 (SkiaOverlay에서 추출)
- readCssBgColor() → theme read service로 이동

### 검증 포인트

- theme 변경 반영 경로 동일
- font/image resource 갱신 타이밍 동일

---

## Phase 4. Frame Build Pipeline 분리 (순서 #7)

### 목표

- `SkiaOverlay`에서 frame build orchestration만 남김

### 현황 (60% 완료)

- ✅ `skiaFrameHelpers.ts` — buildTreeBoundsMap, buildPageFrameMap 분리
- ✅ `renderCommands.ts` — RenderCommandStream, getCachedCommandStream 분리
- ✅ `skiaOverlayHelpers.ts` — buildHoverHighlightTargets 등 6개 함수 분리
- ⚠️ `SkiaOverlay.tsx` 여전히 1664줄 — 프레임 빌드 orchestration + 렌더 호출 + DOM 리스너 혼재
- ⚠️ `FrameInputSnapshot`, `SharedSceneDerivedData` 타입 미정의

### 잔여 작업

- `FrameInputSnapshot`, `SharedSceneDerivedData`, `ContentBuildResult` 타입 정의 (types.ts)
- SkiaOverlay에서 함수 추출:
  - `buildSkiaFrameContent()` — content render 입력 조합
  - `buildSelectionOverlayData()` — selection render 입력
  - `buildWorkflowOverlayData()` — workflow edge 계산
- `buildSkiaTreeHierarchical()` → 별도 모듈로 추출
- DOM 보조 함수 (readCssBgColor, updateTextChildren) → 해당 서비스/모듈로 이동

### 핵심 원칙

- 큰 맵/트리/바운드 계산은 프레임당 1회만
- overlay 단계는 공용 산출물 재사용
- boundsMap 중복 순회 증가 금지

---

## Phase 7. DOM 의존 유틸 제거 (순서 #8)

### 목표

- UI shell과 runtime 경계 명확화

### 선행 조건

- Phase 2 완료 (ViewportController 단일 원천 확립)
- Phase 6 완료 (theme/resource watcher 서비스 분리)

### 작업

- `CanvasScrollbar`의 `querySelector('aside...')` 제거
- `measureWorkspacePanelInsets()` → shell/layout store에서 계산된 값 전달
- DOM 측정 책임을 runtime 외부로 이동
- CSS transition 타이밍 가정 제거

### 검증 포인트

- scrollbar 동작 동일
- shell 레이아웃 변경에 대한 취약성 감소

---

## Phase 5. Node Renderer 분해 (순서 #9 — 최후순위)

### 목표

- `nodeRenderers.ts` 기능별 모듈 분리

### 현황 (0% — 전체 미구현)

- `nodeRenderers.ts` — 2001줄 단일 파일
- 모든 도형 렌더 + 텍스트 캐싱 + 효과 적용이 혼재

### 작업

- box/text/image/shape/effect/overflow/scrollbar/text cache 분리:
  - `renderBox.ts`
  - `renderText.ts`
  - `renderImage.ts`
  - `renderShape.ts`
  - `renderOverflow.ts`
  - `renderScrollbar.ts`
  - `paragraphCache.ts`

### 제약 (CRITICAL)

- 이 phase는 **extract-only**로 제한
- 함수 이동/파일 분리 외 로직 변경 금지
- paragraph cache, strutStyle, fontFamilies 동기화 규칙 변경 금지
- 캐시 정책 변경, 텍스트 측정 방식 변경, paragraph 생성 타이밍 변경 금지
- 성능 최적화나 렌더 수정은 후속 phase 또는 후속 ADR로 분리

### 진입 조건

- Phase 0~4, 6~8 **모두 완료**
- baseline 수치와 수동 시각 비교 기준 확보
- 직전 phase까지 gate 검증 연속 통과

### 검증 포인트

- 동일 scene에서 렌더 결과 차이 없음
- text/image/box rendering 회귀 없음
- frame time/FPS 악화 없음

---

## Phase Gate

모든 phase는 아래 gate를 통과해야 완료로 간주한다.

1. `pnpm -F @composition/builder type-check`
2. 핵심 수동 렌더링 비교 통과
3. 성능 baseline 대비 회귀 없음
4. phase 범위가 1커밋으로 rollback 가능

수동 렌더링 비교 최소 체크리스트:

- breakpoint 변경
- compare mode
- zoom/pan
- lasso/selection/resize
- text edit
- workflow overlay
- image/font/theme 변경
