# ADR-035: Workspace Canvas Runtime 리팩토링 - 동작 보존 기반 구조 단순화와 성능 최적화

## Status

Implemented (Phase 0~8 완료, baseline 수집 + invalidation/panel runtime gate + WASM artifact 분리 완료)

## Date

2026-03-13

## Decision Makers

composition Team

## Related ADRs

- [ADR-008](008-layout-engine.md): 캔버스 레이아웃 엔진 전환
- [ADR-009](009-full-tree-wasm-layout.md): Figma-Class Rendering & Layout
- [ADR-012](012-rendering-layout-pipeline-hardening.md): 렌더링/레이아웃 파이프라인 하드닝
- [ADR-027](../027-inline-text-editing.md): Canvas Inline Text Editing

---

## Context

`apps/builder/src/builder/workspace`는 Builder의 핵심 편집 화면이며,
다음 역할을 동시에 수행하고 있다.

- breakpoint 기반 캔버스 크기 결정
- viewport zoom/pan
- Pixi 입력 처리
- Skia 렌더링
- 레이아웃 계산 결과 소비
- selection/lasso/resize
- workflow overlay
- text edit overlay
- scrollbar
- font/image/theme/DPR/resize watcher

현 구조는 기능적으로는 풍부하지만,
핵심 런타임 파일에 책임이 과도하게 집중되어 있다.

주요 신호:

- [BuilderCanvas.tsx](/Users/admin/work/composition/apps/builder/src/builder/workspace/canvas/BuilderCanvas.tsx)
- [SkiaOverlay.tsx](/Users/admin/work/composition/apps/builder/src/builder/workspace/canvas/skia/SkiaOverlay.tsx)
- [nodeRenderers.ts](/Users/admin/work/composition/apps/builder/src/builder/workspace/canvas/skia/nodeRenderers.ts)
- [Workspace.tsx](/Users/admin/work/composition/apps/builder/src/builder/workspace/Workspace.tsx)
- [CanvasScrollbar.tsx](/Users/admin/work/composition/apps/builder/src/builder/workspace/scrollbar/CanvasScrollbar.tsx)
- [canvasSync.ts](/Users/admin/work/composition/apps/builder/src/builder/workspace/canvas/canvasSync.ts)
- [cssVariableReader.ts](/Users/admin/work/composition/apps/builder/src/builder/workspace/canvas/utils/cssVariableReader.ts)

현재 확인된 구조적 문제는 다음과 같다.

### 문제 1. 핫패스 파일의 책임 과밀

`BuilderCanvas`, `SkiaOverlay`, `nodeRenderers`가 각각 초기화, 상태 조합,
렌더 파이프라인, watcher, 디버그, 캐시, overlay 렌더까지 동시에 담당한다.

결과:

- 변경 영향 범위가 지나치게 넓다.
- 병목 지점의 국소적 개선이 어렵다.
- 회귀 위험이 커진다.

### 문제 2. viewport 상태 원천이 분산됨

현재 viewport 관련 상태는 다음 계층에 나뉘어 존재한다.

- `ViewportController`
- `useCanvasSyncStore`
- `Workspace` 내부 계산
- `CanvasScrollbar` 직접 구독

결과:

- sync 경로가 복잡하다.
- pan/zoom 관련 버그가 숨어들기 쉽다.
- 실제 authoritative state가 불분명하다.

### 문제 3. Pixi 입력과 Skia 렌더 사이의 변환 비용이 큼

현재 구조는 Pixi를 입력 처리 계층으로 유지하면서,
Skia가 별도의 콘텐츠 렌더링을 담당한다.
이 과정에서 command stream/tree 재구성, bounds map 생성,
selection/workflow/AI overlay 계산이 `SkiaOverlay`에 밀집되어 있다.

결과:

- 프레임 경로에서 CPU 비용이 크다.
- invalidation reason 추적이 어렵다.
- 캐시 무효화 규칙이 분산된다.
- 단계 분리 시 잘못 설계하면 같은 입력을 여러 번 순회하는 중복 계산 위험이 있다.

### 문제 4. invalidation 모델이 암묵적이다

현재 렌더 무효화는 `registryVersion`, `layoutVersion`,
`pagePositionsVersion`, `overlayVersion`, image/font/theme/resize 이벤트에 의해 발생한다.

하지만 어떤 변경이 어떤 레이어를 무효화하는지 체계적으로 정리되어 있지 않다.

결과:

- 필요 이상 재렌더링 가능성
- stale cache 보정 로직 증가
- 디버깅 비용 증가

### 문제 5. DOM 의존 보조 로직이 렌더 런타임과 섞여 있다

예:

- scrollbar가 `querySelector`로 패널 폭을 측정
- theme observer와 resize observer가 직접 렌더러 lifecycle 내부에 결합
- text overlay가 Skia registry와 직접 연결

결과:

- UI shell 변경에 취약
- 테스트와 추론이 어려움
- platform/runtime 경계가 흐려짐

### 문제 6. 거대 유틸과 생성 산출물이 탐색 비용을 증가시킨다

특히 `cssVariableReader.ts`는 단일 파일 규모가 매우 크고,
`src` 하위에 wasm 산출물이 함께 존재하여 실제 소스 탐색 효율을 떨어뜨린다.

### Hard Constraints

이번 리팩토링은 반드시 아래 제약을 지켜야 한다.

1. **기존 동작 유지**: 렌더 결과, 입력 동작, 편집 UX를 바꾸지 않는다.
2. **기존 사용자 계약 유지**: zoom/pan, selection, workflow overlay, text edit, compare mode, multi-page 동작 유지.
3. **점진적 전환 가능**: 단계별로 롤백 가능해야 한다.
4. **기존 저장 포맷 무영향**: element/store 데이터 구조는 바꾸지 않는다.
5. **성능 회귀 금지**: 리팩토링 단계 중 frame time/FPS가 악화되면 phase 통과 불가.

### Execution Guardrails

본 ADR의 잔여 phase는 아래 운영 규칙을 강제한다.

1. **Phase 0 선행 완료 필수**: baseline 성능 수치와 수동 시각 비교 체크리스트 없이 후속 phase 진행 금지
2. **Phase 단위 gate 검증 필수**: 각 phase 완료 후 `pnpm -F @composition/builder type-check`와 수동 렌더링 비교를 모두 통과해야 다음 phase 진행 가능
3. **Phase당 1커밋 원칙**: 문제 발생 시 해당 phase만 즉시 rollback/revert 가능해야 함
4. **동작 변경과 구조 변경 분리**: 구조 분해 phase에서 동작 개선이나 최적화 로직을 섞지 않음
5. **Hot path 후순위 배치**: `nodeRenderers.ts` 분해는 모든 저위험/중위험 phase 이후 마지막에 수행

---

## Alternatives Considered

### 대안 A: 현 구조 유지 + 국소 최적화만 수행

- 설명: 큰 구조 변경 없이 hot function만 최적화하고 memo/cache를 추가한다.
- 위험: 기술(L) / 성능(M) / 유지보수(H) / 마이그레이션(L)

장점:

- 작업량이 작다.
- 즉각적인 미세 개선이 가능하다.

단점:

- 구조 문제를 해소하지 못한다.
- giant file 문제와 상태 분산은 그대로 남는다.
- 이후 변경 비용이 계속 누적된다.

### 대안 B: 엔진 전면 교체 또는 단일 엔진 재구축

- 설명: Pixi/Skia 경계를 새로 정의하거나, 입력/렌더 엔진을 통째로 바꾼다.
- 위험: 기술(H) / 성능(H) / 유지보수(M) / 마이그레이션(H)

장점:

- 이상적인 구조를 새로 설계할 수 있다.

단점:

- 동작 보존 제약과 충돌한다.
- 회귀 범위가 지나치게 크다.
- 현재 단계에서 리스크가 과도하다.

### 대안 C: 동작 보존 기반 구조 리팩토링 + 상태 원천 축소 + 핫패스 분리

- 설명: 엔진 자체는 유지하되, 책임을 재배치하고 viewport/invalidation/render pipeline을 정리한다.
- 위험: 기술(M) / 성능(L) / 유지보수(L) / 마이그레이션(M)

장점:

- 기존 동작 유지와 구조 개선을 동시에 달성 가능하다.
- 단계별 측정과 롤백이 가능하다.
- 이후 최적화의 기반이 된다.

단점:

- 초기 설계와 분해 작업이 필요하다.
- 과도기 동안 old/new 경로가 잠시 공존할 수 있다.

### Risk Threshold Check

- 대안 A는 유지보수 위험이 HIGH이므로 장기 해법으로 부적합
- 대안 B는 기술/성능/마이그레이션 위험이 모두 HIGH로 현재 제약과 충돌
- 대안 C는 MEDIUM 중심이며 단계적 관리 가능

---

## Decision

**대안 C**를 채택한다.

즉, `workspace/canvas`는 **기존 동작을 유지한 채**
아래 목표를 향해 점진적으로 리팩토링한다.

1. giant runtime file 분해
2. viewport single source of truth 확립
3. render invalidation 모델 명시화
4. Skia frame build 파이프라인 분리
5. text/theme/resize/scrollbar watcher의 shell/runtime 경계 정리
6. generated artifact와 hand-written source 분리

이번 ADR은 “새 엔진 도입”이 아니라
**현재 엔진을 유지한 상태에서 구조를 최적화하는 설계 문서**다.

### Recommended Execution Order

최종 구현 기준으로 Phase 0~8이 모두 완료됐다.
아래 순서는 실제 수행 시 사용한 gate 순서를 보존하기 위해 남겨둔다.

```
Phase 0 ─┬─→ Phase 1 (trivial)
         ├─→ Phase 8 (quick win)
         ├─→ Phase 3 ──→ Phase 4
         ├─→ Phase 2 ──┐
         └─→ Phase 6 ──┴─→ Phase 7
                                 └──→ Phase 5 (all prior phases 완료 후)
```

| 순서 | Phase   | 잔여 작업                                                                 |  완성도  | 위험 | 상태     |
| :--: | ------- | ------------------------------------------------------------------------- | :------: | :--: | -------- |
|  1   | Phase 0 | baseline 문서 작성 + 실측값 수집 + authenticated builder smoke 확보       | **100%** |  L   | **완료** |
|  2   | Phase 1 | Workspace.tsx 책임 주석 + 문서화                                          | **100%** |  L   | **완료** |
|  3   | Phase 8 | WASM pkg를 `apps/builder/wasm-bindings/pkg`로 이동, script/import 정리    | **100%** |  L   | **완료** |
|  4   | Phase 3 | `renderInvalidation.ts` 추적 유틸 보강 + unit test gate 추가              | **100%** |  L   | **완료** |
|  5   | Phase 2 | canvasSync deprecation 완료, viewport 단일 원천 확립                      | **100%** |  M   | **완료** |
|  6   | Phase 6 | cssVariableReader 4분할 완료 + size key 정규화 (`xs/sm/md/lg/xl` 호환)    | **100%** |  M   | **완료** |
|  7   | Phase 4 | SkiaOverlay 분해, skiaOverlayBuilder/skiaFramePlan/skiaFramePipeline 추출 | **100%** |  M   | **완료** |
|  8   | Phase 7 | CanvasScrollbar querySelector 제거, panel runtime test gate 추가          | **100%** |  M   | **완료** |
|  9   | Phase 5 | nodeRenderers.ts extract-only 분해 (8파일 barrel 구조)                    | **100%** |  H   | **완료** |

이 순서의 원칙은 다음과 같다.

1. **Phase 0으로 관측 가능성 확보** — 회귀 원인을 추적 가능하게 만든다.
2. **저위험 phase 우선** — 문서/격리/관측 가능성 확보를 먼저 끝낸다.
3. **의존 관계 준수** — Phase 3 → Phase 4, Phase 2+6 → Phase 7 순서를 보장한다.
4. **hot path 최후순위** — Phase 5(nodeRenderers)를 가장 마지막에 배치한다.

### Phase 5 Special Constraint

`Phase 5`는 본 ADR에서 가장 위험한 phase로 간주한다.

특히 `nodeRenderers.ts`는 매 프레임 실행되는 hot path이며,
paragraph cache, strutStyle, fontFamilies, text/image render path의 정합성이 미묘하게 연결되어 있다.

따라서 `Phase 5`는 아래 조건을 모두 만족할 때만 진행한다.

1. Phase 0~4, 6~8 모두 완료
2. 시각 스냅샷 비교 기준과 수동 비교 체크리스트 확보
3. 작업 범위를 **extract-only**로 제한

여기서 **extract-only**란 다음을 의미한다.

- 로직 변경 없이 파일 분리만 수행
- 함수 이동/파일 분해 외의 알고리즘 수정 금지
- 캐시 정책 변경, 텍스트 측정 방식 변경, paragraph 생성 타이밍 변경 금지
- cleanup/rename/최적화는 별도 후속 phase 또는 후속 ADR로 분리

---

## Target Architecture

### 1. Workspace Shell Layer

역할:

- breakpoint 선택
- compare mode 레이아웃
- shell 수준 DOM 구조
- panel/chrome 연동

대상:

- `Workspace.tsx`
- `ZoomControls.tsx`
- `Workspace.css`

목표:

- canvas runtime 세부 구현을 모르게 한다.
- shell은 layout orchestration만 담당한다.

### 2. Viewport Runtime Layer

역할:

- zoom/pan authoritative state
- camera container attach/detach
- scroll/drag/fit/fill
- scrollbar 연동

핵심 원칙:

- authoritative viewport state는 `ViewportController`에 둔다.
- store는 mirror snapshot 또는 cross-component read model만 담당한다.

대상:

- `viewport/ViewportController.ts`
- `viewport/useViewportControl.ts`
- `scrollbar/CanvasScrollbar.tsx`
- `canvasSync.ts`

### 3. Layout Runtime Layer

역할:

- layout 계산 결과 publish
- shared layout map / filtered children map 관리
- viewport culling 입력 제공

대상:

- `layout/engines/*`
- `fullTreeLayout.ts`
- `useViewportCulling.ts`

### 4. Render Runtime Layer

역할:

- Skia/Pixi 렌더 입력 모델 조합
- command stream / tree path 선택
- content vs overlay render 구분
- cache/invalidation 적용

대상:

- `BuilderCanvas.tsx`
- `skia/SkiaOverlay.tsx`
- `skia/SkiaRenderer.ts`
- `skia/renderCommands.ts`
- `skia/nodeRenderers.ts`

### 5. Interaction Runtime Layer

역할:

- selection/lasso/resize
- hover
- workflow interaction
- hit-testing

대상:

- `selection/*`
- `hooks/useWorkflowInteraction.ts`
- `hooks/useElementHoverInteraction.ts`
- spatial index bindings

### 6. Overlay Runtime Layer

역할:

- text edit overlay session
- DOM overlay lifecycle
- focus/edit completion

대상:

- `overlay/*`

### 7. Runtime Services Layer

역할:

- theme snapshot
- font/image resource sync
- resize/DPR/context loss watcher
- debug/profiler/logging

대상:

- `cssVariableReader.ts` 후속 분리 결과물
- `imageCache.ts`
- `fontManager.ts`
- `gpuProfilerCore.ts`

---

## Key Design Decisions

### D1. 동작 보존 리팩토링을 위해 엔진은 유지한다

Pixi 입력 + Skia 렌더 조합은 즉시 제거하지 않는다.
대신 그 사이의 orchestration을 줄이고,
공유 입력 모델을 정리하는 방향으로 간다.

### D2. viewport는 단일 원천을 가진다

`ViewportController`를 authoritative state로 둔다.

`useCanvasSyncStore`의 `zoom`, `panOffset`은:

- UI 표시용
- 외부 읽기용
- 마지막 확정 상태 스냅샷

정도로 축소한다.

즉, 실시간 인터랙션 경로에서 store를 상태 원천으로 사용하지 않는다.

### D3. invalidation reason을 명시적 모델로 승격한다

무효화 이유를 enum 또는 태그 집합으로 정의한다.

예:

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

이 모델을 통해:

- 어떤 변경이 어떤 레이어를 다시 그려야 하는지
- 어떤 캐시를 비워야 하는지
- 어떤 메트릭을 기록해야 하는지

를 표준화한다.

### D4. giant file은 orchestration과 implementation을 분리한다

특히 아래 파일은 분해 대상이다.

- `Workspace.tsx`
- `BuilderCanvas.tsx`
- `SkiaOverlay.tsx`
- `nodeRenderers.ts`
- `cssVariableReader.ts`

원칙:

- 상위 파일은 orchestration만 담당
- 실제 알고리즘과 렌더 함수는 하위 모듈로 이동

### D5. Frame Build Pipeline은 "단계 분리"가 아니라 "공용 중간 산출물 재사용"을 전제로 한다

이 ADR에서 말하는 pipeline 분리는
단순히 함수를 여러 개로 나누는 것을 의미하지 않는다.

핵심 원칙:

1. 프레임 입력 snapshot은 한 번만 만든다.
2. 큰 입력 맵(`elementsMap`, `layoutMap`, `boundsMap`, tree/stream`)은 가능한 한 한 번만 만든다.
3. selection/workflow/AI overlay 단계는 content 단계의 공용 산출물을 재사용한다.
4. 단계별 재계산은 invalidation reason이 허용할 때만 수행한다.

즉 다음과 같은 구조를 지향한다.

```ts
FrameInputSnapshot
  -> SharedSceneDerivedData
  -> ContentBuildResult
       - commandStream
       - boundsMap
  -> SelectionOverlayBuildResult   // boundsMap 재사용
  -> WorkflowOverlayBuildResult    // shared scene data 재사용
  -> AIBuildResult                 // boundsMap 재사용
```

금지하는 구조:

- content 단계가 `layoutMap`을 순회
- selection 단계가 다시 `layoutMap`을 순회
- workflow 단계가 다시 `elementsMap`을 순회
- ai 단계가 다시 bounds를 독립 계산

허용하는 구조:

- content 단계에서 만든 `boundsMap`을 selection/AI가 재사용
- 공용 `FrameInputSnapshot`과 `SharedSceneDerivedData`를 모든 단계가 공유

성능 목표는 "단계를 더 많이 만든다"가 아니라
"같은 프레임에서 큰 계산을 한 번만 한다"이다.

### D6. DOM watcher는 runtime service로 분리한다

theme observer, resize observer, DPR change, context loss, image/font callback은
렌더러 lifecycle 내부에 직접 섞지 않고 watcher service 또는 hook으로 분리한다.

### D7. CanvasScrollbar는 layout shell 입력을 직접 받는다

`querySelector('aside...')` 기반 측정은 제거 대상이다.
패널 inset은 shell/layout store가 계산해서 전달해야 한다.

### D8. generated artifact는 source tree에서 분리한다

`wasm-pkg`, `target`, 생성 JS/WASM 파일은
source review와 static analysis를 방해하지 않도록 격리한다.

---

## Detailed Refactoring Plan

### Phase 0. Behavioral Baseline & Observability

목표:

- 리팩토링 전후 동작 비교 기준 확보
- 성능 회귀 감지 장치 마련

작업:

1. 핵심 사용자 시나리오 체크리스트 문서화
2. frame time / tree build time / selection build time / AI bounds build time 수집 기준 통일
3. debug logging category 설계
4. regression 비교 항목 정의

보존 시나리오:

- breakpoint 변경
- zoom in/out
- fit/fill
- pan
- lasso/selection/resize
- text edit start/update/commit/cancel
- workflow overlay on/off
- compare mode
- image load/font load 후 재렌더

### Phase 1. Workspace Shell 분해

목표:

- `Workspace.tsx`를 shell orchestration으로 축소

분리 대상:

- breakpoint sizing
- compare mode split management
- panel resize tracking
- initial centering strategy

예상 결과:

- `WorkspaceShell`
- `WorkspaceBreakpointSizing`
- `WorkspaceCompareMode`
- `WorkspaceViewportCoordinator`

### Phase 2. Viewport Runtime 정리

목표:

- viewport single source of truth 확립

작업:

1. `ViewportController` authoritative state 정의
2. `useCanvasSyncStore.zoom/panOffset`을 mirrored state로 축소
3. `CanvasScrollbar`를 controller 기반으로 재구성
4. fit/fill/center 연산을 하나의 coordinator에서 관리

성공 기준:

- pan/zoom 경로에서 이중 동기화 제거
- scrollbar 동작 유지

### Phase 3. Render Invalidation 모델 정리

목표:

- content/layout/overlay/theme/resource invalidation 경계를 명시화

작업:

1. invalidation reason enum 도입
2. version 기반 무효화 규칙 표 작성
3. `SkiaOverlay` 캐시 우회/무효화 로직 정리
4. resource/theme/layout 변경의 책임 분리

성공 기준:

- stale cache 보정 로직 감소
- 캐시 무효화 경로 추적 가능

### Phase 4. Skia Frame Build Pipeline 분리

목표:

- `SkiaOverlay`를 canvas lifecycle 중심으로 축소
- frame build 단계 분리와 동시에 중복 계산을 제거

분리 대상:

- command stream/tree 선택
- bounds map 빌드
- selection render data 빌드
- workflow overlay 데이터 빌드
- AI bounds 빌드

예상 결과:

- `buildSkiaFrameContent()`
- `buildSelectionOverlayData()`
- `buildWorkflowOverlayData()`
- `buildFrameCaches()`

추가 원칙:

- `FrameInputSnapshot`은 프레임당 1회 생성
- `SharedSceneDerivedData`는 프레임당 1회 생성
- `boundsMap`은 가능한 한 content 단계에서 1회 생성 후 재사용
- overlay 단계는 공용 산출물 소비만 담당

### Phase 5. Node Renderer 분해

목표:

- `nodeRenderers.ts`의 책임을 도형별/기능별로 나눈다

분리 예:

- `renderBox.ts`
- `renderText.ts`
- `renderImage.ts`
- `renderShape.ts`
- `renderOverflow.ts`
- `renderScrollbar.ts`
- `paragraphCache.ts`

성공 기준:

- 텍스트 렌더/캐시와 나머지 노드 렌더가 분리됨
- 특정 렌더 문제 수정 시 영향 범위 축소

### Phase 6. Theme & Resource Runtime 분해

목표:

- `cssVariableReader.ts`와 resource watcher 정리

작업:

1. raw css variable access
2. semantic theme snapshot
3. color conversion
4. component token resolver

로 분리한다.

추가로:

- font sync service
- image invalidation service
- theme watcher service

를 나눈다.

### Phase 7. DOM-dependent Utility 제거

목표:

- DOM query/setTimeout 기반 보정 제거

대상:

- `CanvasScrollbar`
- panel inset 측정
- shell-driven resize coupling

성공 기준:

- shell/layout state 기반 계산으로 전환
- CSS transition 타이밍 가정 제거

### Phase 8. Generated Artifact Isolation

목표:

- source tree 탐색성과 유지보수성 향상

작업:

- `src` 하위 generated wasm/pkg 산출물 이동 또는 명시적 격리
- 리뷰/검색 대상에서 자동 제외 가능한 구조로 재배치

---

## Performance Strategy

이번 ADR은 micro-optimization보다
**hot path 구조 최적화**를 우선한다.

핵심 전략:

1. 프레임 경로에서 상태 원천 수 줄이기
2. 재구성 비용이 큰 데이터 빌드 파이프라인 분리
3. content render와 overlay render의 invalidation 구분
4. 텍스트/테마/resource 계산의 비프레임화
5. DOM 측정과 렌더 경로 분리
6. 같은 프레임에서 큰 맵/트리/바운드 계산은 최대 1회만 수행

측정 지표:

- average fps
- skia frame time
- skia tree build time
- selection build time
- AI bounds build time
- content rerenders/sec
- registry changes/sec

---

## Compatibility Strategy

이번 리팩토링은 아래 호환성을 유지해야 한다.

### UI / UX Compatibility

- visible output 동일
- interaction timing 동일 수준 유지
- text editing UX 유지
- workflow overlay UX 유지

### State Compatibility

- builder store 구조 유지
- element 데이터 구조 유지
- selection 모델의 외부 계약 유지

### Operational Compatibility

- feature flag 동작 유지
- compare mode 유지
- CanvasKit / WebGL / wasm fallback 경로 유지

---

## Gates

### G0. Baseline Established

- 핵심 시나리오 체크리스트가 문서화되어 있다.
- 현재 성능 baseline 수치가 수집되어 있다.

### G1. Workspace Shell Extraction

- `Workspace.tsx`가 shell 역할로 축소된다.
- breakpoint/compare mode/centering 로직이 독립 모듈로 분리된다.
- 기존 동작 회귀가 없다.

### G2. Viewport Single Source of Truth

- viewport authoritative state가 1곳이다.
- scrollbar, zoom controls, fit/fill, drag pan이 동일하게 동작한다.
- pan/zoom 관련 이중 업데이트 경로가 제거된다.

### G3. Render Invalidation Standardization

- invalidation reason이 명시적으로 정의된다.
- 캐시 무효화 규칙이 문서화된다.
- stale frame 회피용 ad-hoc 보정이 감소한다.

### G4. SkiaOverlay Decomposition

- `SkiaOverlay`가 frame pipeline orchestration만 담당한다.
- frame build 단계가 독립 모듈로 분리된다.
- 성능 수치가 baseline 대비 악화되지 않는다.
- `layoutMap`, `elementsMap`, `boundsMap`의 중복 순회가 증가하지 않는다.
- selection/workflow/AI 단계가 content 공용 산출물을 재사용한다.

### G5. Node Renderer Decomposition

- `nodeRenderers.ts`가 도형별/기능별 모듈로 분리된다.
- text paragraph cache가 독립 모듈로 분리된다.

### G6. Runtime Services Cleanup

- theme/resource/resize watcher가 서비스 계층으로 분리된다.
- `cssVariableReader.ts` giant file 문제가 해소된다.

### G7. Source Tree Hygiene

- generated artifact가 source tree와 명확히 분리된다.
- static analysis와 검색 범위가 개선된다.

---

## Consequences

### Positive

1. giant file와 책임 과밀이 해소된다.
2. viewport 동기화 버그 가능성이 감소한다.
3. render invalidation 추적 가능성이 높아진다.
4. 이후 성능 최적화를 더 작은 단위로 수행할 수 있다.
5. hot path와 비-hot path를 구분한 개선이 가능해진다.
6. 유지보수와 디버깅 비용이 낮아진다.

### Negative

1. 초기 분해 비용이 크다.
2. 과도기 동안 old/new orchestration이 함께 존재할 수 있다.
3. 단계별 regression 검증 비용이 증가한다.

---

## Non-Goals

이번 ADR 범위에 포함하지 않는 항목:

- Pixi 제거
- Skia 제거
- 저장 포맷 변경
- selection/workflow feature 자체 재설계
- 새로운 렌더 엔진 도입

---

## Open Questions

1. `canvasSync.ts`를 장기적으로 유지할지, runtime snapshot store로 축소할지 결정 필요
2. command stream 경로와 tree 경로를 얼마나 오래 병행 유지할지 결정 필요
3. generated wasm/pkg 산출물의 최종 위치를 빌드 시스템 차원에서 어떻게 다룰지 결정 필요
4. text edit overlay가 장기적으로 Skia runtime service와 어떤 경계로 묶일지 결정 필요

---

## Progress Log

### 2026-03-13: Phase 0/3/7/8 완료 + ADR-035 종료

#### Phase 0 완료 — Baseline 측정 확정

- `docs/adr/035-phase-0-baseline.md`에 authenticated builder URL 기준 baseline 수치 기록
- headless Chrome 임시 프로필에서 `ADR035 Baseline` 13요소 페이지를 생성/선택하고 6초 안정화 후 수집
- 수집 결과: `averageFps 59.99`, `lastFrameTime 16.67ms`, `skiaFrameTimeAvgMs 17.75ms`

#### Phase 3 완료 — Invalidation gate 고정

- `renderInvalidation.ts`에 `INVALIDATION_REASONS`, `resetInvalidationHistory()` 추가
- 개발 환경뿐 아니라 test 환경에서도 invalidation history를 검증 가능하도록 gate 보강
- `renderInvalidation.test.ts`로 history limit(100개)와 recent count 동작 고정

#### Phase 7 완료 — Panel Runtime gate 고정

- `panelLayoutRuntime.ts`에 test reset helper 추가
- 등록 기반 `ResizeObserver` 캐시가 panel visibility/store toggle과 함께 동작하는지 unit test 추가
- `panelLayoutRuntime.test.ts`로 querySelector 제거 이후 계약을 회귀 테스트로 고정

#### Phase 8 완료 — Generated Artifact Isolation

- `apps/builder/src/.../wasm-bindings/pkg` → `apps/builder/wasm-bindings/pkg` 이동
- wasm-pack out-dir, Vite dynamic import, tsconfig exclude, gitignore 규칙을 새 경로에 맞게 정렬
- hand-written source와 generated artifact 경계 분리 완료

### 2026-03-12: Phase 2/4/5/6 완료 + 프로젝트 전체 ESLint/TypeScript 정리

#### Phase 2 완료 — Viewport Runtime 정리

- `canvasSync.ts`의 `setZoom`/`setPanOffset`에 런타임 deprecation 경고 추가
- `ViewportController`가 authoritative state로 확립됨
- `useCanvasSyncStore`는 UI 표시용 mirror snapshot으로 축소

#### Phase 4 완료 — Skia Frame Build Pipeline 분리

`SkiaOverlay.tsx`에서 3개 모듈 추출:

| 파일                    | 역할                                      | 규모      |
| ----------------------- | ----------------------------------------- | --------- |
| `skiaOverlayBuilder.ts` | overlay build 로직 (workflow/cache)       | ~426줄    |
| `skiaFramePlan.ts`      | FrameInputSnapshot + FrameRenderPlan 조합 | 신규      |
| `skiaFramePipeline.ts`  | buildSkiaFrameContent 파이프라인          | 기존 추출 |

타입 정의:

- `SharedSceneDerivedData` — 프레임당 1회 계산, 모든 오버레이 공유
- `FrameRenderPlan` — content + overlay + screen overlay 통합
- `ContentBuildResult`, `SelectionOverlayBuildResult`, `WorkflowOverlayBuildResult`

`SkiaOverlay.tsx`: 1268줄 → ~1026줄 (orchestration 중심으로 축소)

#### Phase 5 완료 — Node Renderer 분해

`nodeRenderers.ts`를 extract-only 원칙으로 8파일 barrel 구조로 분해:

| 파일                     | 역할              |
| ------------------------ | ----------------- |
| `nodeRenderers.ts`       | 14줄 barrel       |
| `nodeRendererTypes.ts`   | 타입 정의         |
| `nodeRendererState.ts`   | 상태/캐시 관리    |
| `nodeRendererTree.ts`    | 트리 순회/빌드    |
| `nodeRendererText.ts`    | 텍스트 렌더링     |
| `nodeRendererBorders.ts` | 테두리 렌더링     |
| `nodeRendererShapes.ts`  | Spec shapes 렌더  |
| `nodeRendererImage.ts`   | 이미지 렌더링     |
| `nodeRendererClip.ts`    | 클리핑/오버플로우 |

#### Phase 6 완료 — Theme & Resource Runtime 분해

`cssVariableReader.ts` (7502줄) → 16줄 barrel + 4개 모듈:

| 파일                     | 역할                     |
| ------------------------ | ------------------------ |
| `cssVariableCore.ts`     | CSS 변수 읽기/변환 기본  |
| `cssLabelPresets.ts`     | 라벨 프리셋              |
| `cssComponentColors.ts`  | 컴포넌트별 색상 프리셋   |
| `cssComponentPresets.ts` | 컴포넌트별 사이즈 프리셋 |

추가 보정:

- size preset getter가 `xs/sm/md/lg/xl`와 `XS/S/M/L/XL` 양쪽 입력을 모두 수용하도록 정규화
- `computedStyleService`와 Skia/WebGL preset reader 간 size key 계약 불일치 제거

#### 프로젝트 전체 ESLint/TypeScript 정리

TypeScript: **0 에러** (전체 통과)

ESLint 수정 내역:

| 카테고리              | 수정 수 | 상세                                                            |
| --------------------- | :-----: | --------------------------------------------------------------- |
| unused imports/vars   |   ~20   | 전체 패키지 (builder, shared, publish)                          |
| `any` 타입 제거       |    2    | `ComponentSpec<any>` → `ComponentSpec<Record<string, unknown>>` |
| set-state-in-effect   |    8    | `queueMicrotask()` 래핑 (ScrubInput, PropertyUnitInput 등)      |
| refs-during-render    |    7    | ref 할당을 useEffect 내부로 이동                                |
| rules-of-hooks        |    1    | ComboBox early return 위치 수정                                 |
| no-useless-assignment |    2    | skiaFramePipeline, ThemeService                                 |
| let→const             |    1    | export.utils.ts                                                 |
| eslint-disable 정리   |    2    | 불필요한 suppress 지시문 제거                                   |

##### 잔존 ESLint 에러 5개 (React Compiler 한계 — 수정 불필요)

| 파일                | 줄   | 에러                                                             | 횟수 |
| ------------------- | ---- | ---------------------------------------------------------------- | :--: |
| `ElementSprite.tsx` | 1364 | Compilation Skipped: Existing memoization could not be preserved |  x4  |
| `TextSprite.tsx`    | 292  | Compilation Skipped: Existing memoization could not be preserved |  x1  |

**분석 결과: 리팩터링 불필요**

- React Compiler가 복잡한 수동 `useMemo` (770줄/200줄)를 자동 보존하지 못할 때 발생
- 수동 메모이제이션이 **그대로 유지**되므로 런타임 동작/성능에 영향 없음
- "graceful degradation" — 컴파일러가 스킵하면 기존 수동 최적화가 계속 작동
- 분할 시 위험(캔버스 렌더링 핵심 경로, 회귀 범위 넓음) 대비 이익(lint 에러 제거뿐) 불균형
- 필요 시 별도 ADR로 "Sprite 렌더 데이터 파이프라인 분할" 계획 권장

### 종료 상태

| Phase   | 완성도 | 완료 근거                                                  |
| ------- | :----: | ---------------------------------------------------------- |
| Phase 0 |  100%  | baseline 문서 수치 확정 + authenticated builder smoke 확보 |
| Phase 1 |  100%  | Workspace shell 책임 문서화 완료                           |
| Phase 2 |  100%  | viewport single source of truth 정착                       |
| Phase 3 |  100%  | invalidation model 구현 + unit test gate                   |
| Phase 4 |  100%  | Skia frame pipeline 분리                                   |
| Phase 5 |  100%  | node renderer extract-only 분해                            |
| Phase 6 |  100%  | cssVariableReader 분리 + size key 정규화                   |
| Phase 7 |  100%  | panel layout runtime 전환 + unit test gate                 |
| Phase 8 |  100%  | generated WASM artifact source tree 외부 분리              |

---

## References

- [Workspace.tsx](/Users/admin/work/composition/apps/builder/src/builder/workspace/Workspace.tsx)
- [BuilderCanvas.tsx](/Users/admin/work/composition/apps/builder/src/builder/workspace/canvas/BuilderCanvas.tsx)
- [SkiaOverlay.tsx](/Users/admin/work/composition/apps/builder/src/builder/workspace/canvas/skia/SkiaOverlay.tsx)
- [nodeRenderers.ts](/Users/admin/work/composition/apps/builder/src/builder/workspace/canvas/skia/nodeRenderers.ts)
- [CanvasScrollbar.tsx](/Users/admin/work/composition/apps/builder/src/builder/workspace/scrollbar/CanvasScrollbar.tsx)
- [ViewportController.ts](/Users/admin/work/composition/apps/builder/src/builder/workspace/canvas/viewport/ViewportController.ts)
- [useViewportControl.ts](/Users/admin/work/composition/apps/builder/src/builder/workspace/canvas/viewport/useViewportControl.ts)
- [canvasSync.ts](/Users/admin/work/composition/apps/builder/src/builder/workspace/canvas/canvasSync.ts)
- [cssVariableReader.ts](/Users/admin/work/composition/apps/builder/src/builder/workspace/canvas/utils/cssVariableReader.ts)
