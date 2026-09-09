# ADR-039: Multi-page Canvas Page-Scoped Rendering — Visible Page 중심 렌더링, 페이지별 캐시, 페이지 단위 invalidation

## Status

Implemented

## Date

2026-03-13

## Decision Makers

composition Team

## Related ADRs

- [ADR-009](009-full-tree-wasm-layout.md): Figma-Class Rendering & Layout
- [ADR-012](012-rendering-layout-pipeline-hardening.md): 렌더링/레이아웃 파이프라인 하드닝
- [ADR-035](035-workspace-canvas-refactor.md): Workspace Canvas Runtime 리팩토링
- [ADR-037](037-workspace-scene-runtime-rearchitecture.md): Workspace Scene Runtime 재구성

---

## Context

현재 multi-page canvas는 UI상으로는 여러 페이지를 동시에 다루지만,
런타임 비용 모델은 여전히 “문서 전체를 하나의 장면으로 다시 계산”하는 성격이 강하다.

이 구조는 페이지 수 증가에 따라 page add/select/reposition 비용이 선형으로 커지며,
특히 페이지 추가 시 `pointerdown`/`requestAnimationFrame` long task 경고가 반복된다.

### 문제 1. Scene 파생 계산이 전체 페이지 기준이다

[buildSceneSnapshot.ts](039-page-scoped-rendering.md) 단계에서
매번 다음 값이 전체 페이지 기준으로 재생성된다.

- `allPageData`
- `pageFrames`
- `visiblePageIds`
- `sceneVersion`

이 중 `pageFrames`/`visiblePageIds`는 문서 메타 계층에 가깝고,
`allPageData`는 실제 페이지 content render 입력이다.
서로 다른 비용 특성을 가진 데이터를 같은 재계산 단위로 취급하고 있다.

### 문제 2. Pixi는 visible page를 알지만, Skia content build는 전체 페이지를 입력으로 사용한다

Pixi 경로는 `visiblePageIds`를 사용해 페이지 컨테이너 가시성을 제어하지만,
Skia content build는 모든 페이지의 body를 root로 삼아 command stream/tree build를 수행한다.

결과:

- 화면 밖 페이지도 content build 비용에 포함된다.
- 페이지 추가/이동이 전체 content invalidate로 번진다.
- page count 증가가 그대로 Skia frame cost 증가로 이어진다.

### 문제 3. invalidation이 페이지 단위가 아니라 전역 content 단위다

현재 `pagePositionsVersion`, `registryVersion`, `overlayVersion`은 전역 숫자 위주로 관리된다.
페이지 하나가 추가되거나 한 페이지의 위치만 바뀌어도,
실제 동작은 “변경된 페이지 1개”보다 “전체 content 재평가”에 가깝다.

결과:

- 신규 페이지 생성 비용이 기존 페이지 수에 비례해서 증가
- 일부 page-only 변경도 전체 재빌드 경로를 타기 쉬움
- 캐시가 있어도 page-scoped 재사용을 하기 어렵다

### 문제 4. Page가 렌더 단위가 아니라 UI 모델에만 머문다

현재 `Page`는 sidebar, page frame, selection/navigation의 대상이지만,
런타임 내부에서는 여전히 “document-wide tree 안의 한 그룹”처럼 취급된다.

근본적으로는 Page를 다음 단위로 승격해야 한다.

- 레이아웃 단위
- 렌더 캐시 단위
- invalidation 단위
- visibility/culling 단위

### Hard Constraints

1. 저장 포맷(`page`, `element`)은 변경하지 않는다.
2. 기존 multi-page UX는 유지한다.
3. compare mode, workflow overlay, text edit, selection을 깨지 않는다.
4. Pixi + Skia 조합은 유지한다.
5. 단계별 성능 gate가 있어야 하며 rollback 가능해야 한다.
6. “페이지 수 증가 시 비용 증가폭 완화”가 핵심 성공 조건이다.

---

## Alternatives Considered

### 대안 A. 현재 구조 유지 + hot function 미세 최적화

- 설명: `buildSceneSnapshot`, `SkiaOverlay`, `BuilderCanvas`에 메모이제이션과 캐시만 추가한다.
- 위험: 기술(L) / 성능(M) / 유지보수(H) / 마이그레이션(L)

장점:

- 구현이 빠르다.
- 몇몇 경고 수치는 줄일 수 있다.

단점:

- 비용 모델 자체는 그대로다.
- 페이지 수가 증가하면 다시 병목이 드러난다.
- page-scoped cache/invalidation 구조가 생기지 않는다.

### 대안 B. 페이지를 렌더 단위로 승격하는 page-scoped runtime 도입

- 설명: Scene 메타와 page content를 분리하고, visible page만 content build/compose한다.
- 위험: 기술(M) / 성능(L) / 유지보수(L) / 마이그레이션(M)

장점:

- 비용 모델을 `O(total pages)`에서 `O(visible pages)` 중심으로 전환할 수 있다.
- 페이지 추가/삭제/이동의 영향 범위를 페이지 단위로 축소할 수 있다.
- 장기적으로 virtualization, background page freezing, partial invalidation으로 확장 가능하다.

단점:

- scene/runtime/input/overlay 경계 조정이 필요하다.
- 과도기 동안 전역/페이지 단위 버전 체계가 공존한다.

### 대안 C. 페이지를 별도 canvas/iframe로 분리

- 설명: 각 페이지를 독립 렌더 surface 또는 별도 runtime으로 완전히 나눈다.
- 위험: 기술(H) / 성능(M) / 유지보수(M) / 마이그레이션(H)

장점:

- page isolation은 가장 강하다.

단점:

- selection, lasso, workflow edge, compare mode, cross-page overlay 복잡도가 급증한다.
- 현재 아키텍처와의 단절이 크다.

### Risk Threshold Check

- 대안 A는 단기 봉합에는 유효하지만 근본 원인을 해결하지 못한다.
- 대안 C는 isolation은 강하지만 현 구조 제약에서 리스크가 지나치게 높다.
- 대안 B가 성능/구조/이행 위험의 균형점이다.

---

## Decision

**대안 B**를 채택한다.

즉, multi-page canvas는 문서 전체 단일 render path에서
**Visible Page 중심 page-scoped rendering architecture**로 전환한다.

핵심 결정은 다음 네 가지다.

1. `Page`를 render/cache/invalidation의 1급 단위로 승격한다.
2. `SceneSnapshot`을 `document meta`와 `page content snapshot`으로 분리한다.
3. Skia content build는 visible page만 대상으로 한다.
4. invalidation version은 전역 숫자에서 page-scoped version 체계로 확장한다.

## Implementation Summary

2026-03-13 기준 Phase 0~6 구현 완료.

- Phase 0: baseline을 [039-phase-0-baseline.md](039-phase-0-baseline.md)에 고정
- Phase 1: `SceneSnapshot`을 `document` 메타와 `pageSnapshots` 맵으로 분리
- Phase 2: Pixi는 visible page만 `PageContainer`와 `PixiPageRendererInput`을 생성
- Phase 3: Skia command stream root를 visible page body로 제한하고 root signature를 캐시 키에 포함
- Phase 4: `visibleContentVersion`, `visiblePagePositionVersion`, `allPageFrameVersion`으로 content/document overlay 무효화 범위를 분리
- Phase 5: overlay 입력을 `visiblePageFrames`와 `allPageFrames`로 분리해 page title과 workflow/minimap 경계를 고정
- Phase 6: legacy `allPageData/currentPageData` 경로 제거, 테스트와 문서 갱신

---

## Target Architecture

### 1. Document Meta Snapshot

책임:

- `pageFrames`
- `visiblePageIds`
- viewport/container 기반 page culling
- minimap/document-level overlay 메타

비책임:

- 페이지 내부 요소 트리 build
- 개별 페이지 content cache

### 2. Page Render Unit

페이지마다 아래 구조를 가진다.

- `pageId`
- `bodyElement`
- `pageElements`
- `layoutMap` 또는 page-local derived layout
- `treeBoundsMap`
- `contentNode`
- `contentVersion`
- `layoutVersion`
- `positionVersion`
- `visibilityState`

이 단위는 Pixi와 Skia가 공통으로 소비 가능한 최소 render contract가 된다.

### 3. Visible Page Composition

Skia content build는 “전체 document tree 1개”를 빌드하는 대신:

1. visible page set 결정
2. visible page render unit만 content build 또는 cache reuse
3. page frame 순서대로 compose

로 동작한다.

### 4. Page-Scoped Invalidation

전역 invalidation은 최소한으로 유지하고,
아래와 같이 페이지 단위 버전을 추가한다.

- `pageContentVersion[pageId]`
- `pageLayoutVersion[pageId]`
- `pagePositionVersion[pageId]`

문서 전체 invalidation은 다음 경우로 제한한다.

- 페이지 추가/삭제
- 페이지 순서 변경
- viewport/container size 변경으로 visible set 재계산 필요
- workflow graph 구조 자체 변경

### 5. Overlay 계층 분리

overlay도 두 층으로 분리한다.

- document overlay: page frames, minimap, cross-page workflow
- page overlay: selection, hover, resize handles, local guides

이 분리를 통해 page-only 변경이 document overlay 전체 재계산으로 번지지 않게 한다.

---

## Expected Performance Model

현재 목표는 “한 프레임을 더 빠르게 만들기”보다
“프레임 비용이 페이지 수에 따라 무너지는 구조를 바꾸기”다.

### 현재 비용 모델

- page add / page move / page select
- 전체 scene snapshot 재생성
- 전체 page body 기준 content build
- 전체 page frame 기준 overlay 판단

즉, 비용이 `total pages + total elements`에 가깝게 증가한다.

### 목표 비용 모델

- document meta 갱신: `total pages`
- content build: `visible pages + visible elements`
- page add: `new page + meta delta`
- page move: `changed page + visible set delta`

이 ADR의 성공은 “페이지 수 증가 시 cost slope가 완만해지는지”로 판단한다.

---

## Phased Plan

### Phase 0. Baseline & Budget

작업:

1. page count 1/10/25/50 시나리오 baseline 수집
2. page add 1회당 main-thread blocking time 기록
3. `requestAnimationFrame`, `pointerdown`, `success` long task 수집

성공 기준:

- page add / page move / page select에 대한 baseline 표 확보

### Phase 1. Scene Meta / Page Content 분리

작업:

1. `SceneSnapshot`을 document meta와 page content snapshot으로 분리
2. `allPageData`를 page render unit map으로 전환
3. visible page set을 중앙 단일 원천으로 고정

성공 기준:

- 문서 메타와 페이지 content가 별도 버전/캐시 키를 가짐

### Phase 2. Pixi Page Render Unit 전환

작업:

1. `buildPixiPageRendererInput()`를 page snapshot 기반으로 전환
2. visible page가 아닌 경우 page content 계산 자체를 생략
3. page add 시 기존 페이지 renderer input 재생성을 최소화

성공 기준:

- 페이지 추가가 모든 페이지 renderer input rebuild로 번지지 않음

### Phase 3. Skia Visible Page Content Build

작업:

1. command stream/tree build root를 visible page로 한정
2. page별 `contentNode`/`treeBoundsMap` 캐시 도입
3. compose 단계에서 visible page만 합성

성공 기준:

- page add 시 기존 invisible page는 content rebuild 대상이 아님

### Phase 4. Page-Scoped Invalidation Matrix

작업:

1. `pageContentVersion`, `pageLayoutVersion`, `pagePositionVersion` 도입
2. 전역 `renderer.invalidateContent()` 호출부를 page-scoped invalidate로 치환
3. invalidation reason을 document/page 계층으로 분리

성공 기준:

- page move/add/remove와 local content edit의 무효화 범위가 구분됨

### Phase 5. Overlay Recomposition 정리

작업:

1. selection/hover를 page overlay로 분리
2. workflow/page frame/minimap을 document overlay로 유지
3. overlay recomposition 범위를 visible page 기준으로 제한

성공 기준:

- selection/hover 변경이 document overlay 전체 재계산으로 번지지 않음

### Phase 6. Regression Gate & Cleanup

작업:

1. legacy 전역 page build 경로 제거
2. 테스트/문서/metrics 정리
3. perf budget 회귀 확인

성공 기준:

- page count가 늘어나도 page add/select/move 비용 증가폭이 baseline 대비 유의미하게 완화

---

## Measurement Gates

각 phase 완료 후 아래를 검증한다.

1. `pnpm -F @composition/builder type-check`
2. visible/invisible page 전환 시 렌더 결과 동일성 확인
3. page add 연속 실행 시 long task 지속 시간 비교
4. 25+ page 시나리오에서 page add/select/move 비용 비교

핵심 지표:

- averageFps
- lastFrameTime
- skiaFrameTimeAvgMs
- contentRenderTimeMs
- page add action blocking time
- page select blocking time
- page move blocking time
- visible page count별 content build time

---

## Non-Goals

이번 ADR 범위에 포함하지 않는다.

- Pixi 제거 또는 Skia 단일 엔진 전환
- 저장 포맷 변경
- workflow 모델 자체 재설계
- compare mode UI 재설계
- virtualization을 위한 별도 iframe/page runtime 분리

---

## Open Questions

1. page render unit 캐시를 React 외부 store로 둘지, renderer 내부 캐시로 둘지 결정 필요
2. invisible page의 content cache를 유지할지, cold-evict 전략을 둘지 결정 필요
3. workflow edge가 invisible page를 연결할 때 document overlay의 최소 계산 범위를 어떻게 정의할지 결정 필요
4. selection/lasso가 cross-page를 지원해야 하는지, 현재처럼 page-local 정책을 유지할지 명확화 필요

---

## References

- [BuilderCanvas.tsx](/Users/admin/workspace/composition/apps/builder/src/builder/workspace/canvas/BuilderCanvas.tsx)
- [buildSceneSnapshot.ts](/Users/admin/workspace/composition/apps/builder/src/builder/workspace/canvas/scene/buildSceneSnapshot.ts)
- [buildSceneIndex.ts](/Users/admin/workspace/composition/apps/builder/src/builder/workspace/canvas/scene/buildSceneIndex.ts)
- [skiaFramePipeline.ts](/Users/admin/workspace/composition/apps/builder/src/builder/workspace/canvas/skia/skiaFramePipeline.ts)
- [SkiaOverlay.tsx](/Users/admin/workspace/composition/apps/builder/src/builder/workspace/canvas/skia/SkiaOverlay.tsx)
- [SkiaRenderer.ts](/Users/admin/workspace/composition/apps/builder/src/builder/workspace/canvas/skia/SkiaRenderer.ts)
