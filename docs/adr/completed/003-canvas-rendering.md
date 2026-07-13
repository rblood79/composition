# ADR-003: PixiJS for Canvas Rendering

**Status:** Superseded (2026-02-05)
**Date:** 2024-01-01
**Last Updated:** 2026-03-03
**Decision Makers:** composition Team

> **Superseded By:** Pencil 방식 CanvasKit/Skia 2-pass 렌더러(컨텐츠 캐시 + present(blit) + 오버레이 분리).
> PixiJS는 렌더링이 아니라 **씬 그래프/히트테스트(EventBoundary)/이벤트** 전용 레이어로 유지.
>
> **후속 문서:**
>
> - [`docs/RENDERING_ARCHITECTURE.md`](../../legacy/RENDERING_ARCHITECTURE.md) — CanvasKit/Skia WASM 렌더링 아키텍처 (현행 기준 문서)
> - [`docs/adr/008-layout-engine.md`](008-layout-engine.md) — Taffy 단일 레이아웃 엔진 전략 (Dropflow 제거, TaffyBlockEngine 통합)
> - [`docs/CSS_SUPPORT_MATRIX.md`](../../CSS_SUPPORT_MATRIX.md) — CSS Level 3 지원 현황
>
> **참고:** 본 ADR의 Updates 섹션(2026-02-01~02-18, 30+ 항목)은 전환 과정의 상세 이력입니다.
> 현행 아키텍처는 `docs/RENDERING_ARCHITECTURE.md`를 기준으로 참조하세요.

## Context

composition Builder는 시각적 캔버스 에디터가 필요합니다:

- 수백~수천 개의 요소 렌더링
- 60fps 인터랙션 (드래그, 리사이즈, 선택)
- 줌/팬 뷰포트 변환
- 선택 오버레이, 가이드라인

## Decision

**PixiJS 8 + @pixi/react**를 캔버스 이벤트 레이어에 사용합니다.

> **Note (2026-02-18):** Phase 10-11에서 `@pixi/layout`(Yoga), `@pixi/ui` 의존성 완전 제거됨. DirectContainer(x/y 직접 배치) 패턴으로 전환.

## Alternatives Considered

| 옵션                | 장점                   | 단점                  |
| ------------------- | ---------------------- | --------------------- |
| DOM + CSS Transform | 단순함, 접근성         | 대규모 요소 성능 저하 |
| Canvas 2D           | 가벼움                 | 인터랙션 구현 복잡    |
| PixiJS              | WebGL 성능, 풍부한 API | 학습 곡선             |
| Three.js            | 3D 지원                | 2D 에디터에 과도함    |
| Konva               | React 통합 좋음        | Canvas 2D 기반 한계   |

## Rationale

1. **WebGL 성능**: GPU 가속으로 수천 개 요소도 60fps
2. **@pixi/react**: React 선언적 문법 유지 (DirectContainer x/y 직접 배치)
3. **생태계**: 필터, 마스킹, 텍스처 등 풍부한 기능

## Key Constraints

### DirectContainer 배치 규칙 (Phase 11+)

```typescript
// ✅ 엔진 계산 결과로 x/y 직접 배치
<DirectContainer elementId={id} x={layout.x} y={layout.y}
  width={layout.width} height={layout.height}>
  {children}
</DirectContainer>

// ✅ alpha=0 이벤트 전용 레이어 — 시각 렌더링은 Skia가 담당
// ✅ @pixi/layout, yoga-layout 의존성 없음
```

## Consequences

### Positive

- 대규모 프로젝트에서도 부드러운 인터랙션
- React 패턴과 자연스러운 통합
- 엔진 계산 결과 직접 사용으로 이중 계산 제거 (Phase 11)

### Negative

- 접근성 직접 구현 필요
- 디버깅이 DOM보다 어려움

## Update: CanvasKit/Skia WASM 이중 렌더러 (2026-02-01)

PixiJS 단독 렌더링에서 **Pencil 방식의 이중 렌더러**로 전환 진행 중:

| 레이어                          | 역할                                                |
| ------------------------------- | --------------------------------------------------- |
| **CanvasKit/Skia 캔버스** (z:2) | 디자인 노드 + AI 이펙트 + Selection 오버레이 렌더링 |
| **PixiJS 캔버스** (z:3, 투명)   | 씬 그래프 + EventBoundary 히트 테스팅 + 이벤트 처리 |

**핵심 변경:**

- PixiJS Camera 하위 레이어: `alpha=0`으로 시각적 숨김 (이벤트 유지)
- `renderable=false` 사용 금지 — PixiJS 8 EventBoundary가 히트 테스팅까지 비활성화
- Selection 오버레이: `selectionRenderer.ts`에서 CanvasKit API로 렌더링
- 상세: `docs/RENDERING_ARCHITECTURE.md` §5.7 참조

## Update: Rust WASM 성능 가속 (2026-02-02)

Phase 0-4 Rust WASM 모듈을 빌드/활성화하여 캔버스 성능 가속:

| Phase       | 모듈                           | 역할                                                    |
| ----------- | ------------------------------ | ------------------------------------------------------- |
| **Phase 1** | `SpatialIndex`                 | Grid-cell 기반 O(k) 뷰포트 컬링, 라쏘 선택, 히트 테스트 |
| **Phase 2** | `block_layout` / `grid_layout` | Block/Grid 레이아웃 WASM 가속 (children > 10)           |
| **Phase 4** | `layoutWorker`                 | Web Worker 비동기 레이아웃 + SWR 캐싱                   |

> **Note (2026-02-02):** 기존 환경변수 Feature Flag(`VITE_WASM_SPATIAL`, `VITE_WASM_LAYOUT`, `VITE_WASM_LAYOUT_WORKER`, `VITE_RENDER_MODE`, `VITE_SKIA_DUAL_SURFACE`)는 모두 제거되고 값이 하드코딩됨. `featureFlags.ts`의 `WASM_FLAGS`는 전부 `true`, `getRenderMode()`는 `'skia'` 고정.

**빌드 산출물:** `wasm-bindings/pkg/composition_wasm_bg.wasm` (70KB)
**상세:** `docs/RENDERING_ARCHITECTURE.md` Phase 0-4

## Update: Skia Border-Box 렌더링 수정 (2026-02-02)

Skia `renderBox()`의 stroke가 요소 바운드 밖으로 넘쳐 인접 요소 border가 겹치는 문제 수정:

| 항목               | 수정 전                                             | 수정 후                                                 |
| ------------------ | --------------------------------------------------- | ------------------------------------------------------- |
| **Stroke rect**    | `(0, 0, width, height)` — strokeWidth/2 밖으로 넘침 | `(inset, inset, width-inset, height-inset)` — 완전 내부 |
| **PixiJS 일치**    | 불일치 (PixiJS는 `getBorderBoxOffset` 사용)         | 일치 — 동일한 border-box 동작                           |
| **Block 레이아웃** | `parentBorder`가 `availableWidth`에서 차감          | border는 시각 전용, 레이아웃 inset 아님                 |

**상세:** `apps/builder/src/.../skia/nodeRenderers.ts`, `BuilderCanvas.tsx`

## Update: Skia AABB 뷰포트 컬링 좌표계 수정 (2026-02-02)

캔버스 팬 시 body가 화면 왼쪽/위쪽 가장자리에 닿으면 모든 렌더링이 사라지는 버그 수정:

| 항목                   | 수정 전                                                                   | 수정 후                                                |
| ---------------------- | ------------------------------------------------------------------------- | ------------------------------------------------------ |
| **루트 컨테이너**      | `{width:0, height:0}` 가상 노드에 AABB 컬링 적용 → 원점 이탈 시 전체 소실 | zero-size 노드는 컬링 스킵, 자식에서 개별 컬링         |
| **자식 cullingBounds** | 씬-로컬 좌표 그대로 전달 → `canvas.translate()` 후 좌표계 불일치          | `(x - node.x, y - node.y)` 역변환으로 로컬 좌표계 일치 |

**상세:** `apps/builder/src/.../skia/nodeRenderers.ts`

## Update: Skia UI 컴포넌트 Variant 색상 매핑 (2026-02-02)

`ElementSprite`의 Skia 폴백 렌더링에서 UI 컴포넌트 배경/테두리 색상을 `#e2e8f0`(slate-200)로 하드코딩하여 variant 변경이 반영되지 않던 문제 수정:

| 항목             | 수정 전                        | 수정 후                                          |
| ---------------- | ------------------------------ | ------------------------------------------------ |
| **배경색**       | `#e2e8f0` (slate-200) 하드코딩 | `VARIANT_BG_COLORS[variant]` 테이블 참조         |
| **테두리색**     | `#cbd5e1` (slate-300) 하드코딩 | `VARIANT_BORDER_COLORS[variant]` 테이블 참조     |
| **투명 variant** | 미지원                         | outline/ghost → `bgAlpha=0`, ghost → 테두리 없음 |
| **우선순위**     | 없음                           | `style.backgroundColor > variant > 기본값`       |

**상세:** `apps/builder/src/.../sprites/ElementSprite.tsx`, `docs/COMPONENT_SPEC.md` §4.5

## Update: Skia 렌더 트리 계층화 (2026-02-02)

캔버스 팬 시 Body 내 Button이 Body를 뒤따라오는 렌더링 불일치 문제를 근본적으로 해결:

| 항목               | 수정 전 (flat 트리)                                            | 수정 후 (계층적 트리)                                        |
| ------------------ | -------------------------------------------------------------- | ------------------------------------------------------------ |
| **트리 구조**      | `buildSkiaTreeFromRegistry` — 모든 노드를 flat siblings로 수집 | `buildSkiaTreeHierarchical` — 부모-자식 계층 보존            |
| **좌표 계산**      | `(wt.tx - cameraX) / zoom` — 각 노드 독립 절대 좌표            | `(child.wt.tx - parent.wt.tx) / zoom` — 부모 기준 상대 좌표  |
| **팬 안정성**      | worldTransform 갱신 타이밍 차이 → 노드 간 상대 위치 오차       | 뺄셈 시 카메라 오프셋 상쇄 → 상대 위치 항상 정확             |
| **Selection 좌표** | elementRegistry/하드코딩 — 컨텐츠와 다른 좌표 소스             | `buildTreeBoundsMap` — Skia 트리에서 추출, 컨텐츠와 동기화   |
| **AI 이펙트 좌표** | flat 트리에서 직접 `node.x/y` 사용                             | `buildNodeBoundsMap`에서 부모 오프셋 누적으로 절대 좌표 복원 |

**핵심 공식:** `relativeX = (child.wt.tx - parent.wt.tx) / cameraZoom`

- `parent.wt.tx`와 `child.wt.tx` 모두 동일한 (stale) cameraX를 포함
- 뺄셈 시 카메라 오프셋이 상쇄 → worldTransform 갱신 타이밍과 무관하게 상대 위치 정확

**상세:** `apps/builder/src/.../skia/SkiaOverlay.tsx`, `apps/builder/src/.../skia/aiEffects.ts`

## Update: Flex Layout CSS 정합성 개선 (2026-02-02)

### 1. 조건부 flexShrink (CSS flex-shrink 에뮬레이션)

`display:flex` 부모에 `width:100%` 자식 2개를 배치하면 body를 벗어나는 문제 수정:

| 항목                   | CSS (브라우저)               | Yoga (@pixi/layout) |
| ---------------------- | ---------------------------- | ------------------- |
| **flex-shrink 기본값** | 1 (축소 허용)                | 0 (축소 안 함)      |
| **min-width 기본값**   | auto (콘텐츠 크기 이하 방지) | 0 (0까지 축소 가능) |

**조건부 분기 적용:**

- 퍼센트 width/flexBasis → `flexShrink: 1` (CSS처럼 비례 축소)
- 고정/미지정 width → `flexShrink: 0` (min-width: auto 에뮬레이션)
- 사용자가 명시적 flexShrink 설정 시 그 값 우선

### 2. LayoutComputedSizeContext (퍼센트 크기 해석)

Yoga가 계산한 컨테이너 크기를 자식 스프라이트에 전달하는 React Context:

| 항목                              | 수정 전                                        | 수정 후                                                          |
| --------------------------------- | ---------------------------------------------- | ---------------------------------------------------------------- |
| **% width 해석**                  | `parseCSSSize('100%', undefined, 100)` → 100px | `parseCSSSize('100%', computedWidth, 100)` → 부모 기준 정확 계산 |
| **크기 전파**                     | 없음 — 각 스프라이트가 raw CSS 값 직접 사용    | `LayoutComputedSizeContext` — Yoga 결과를 Context로 전달         |
| **getBounds() vs computedLayout** | getBounds()는 콘텐츠 bounding box              | `_layout.computedLayout`에서 Yoga 결과 직접 읽기                 |

**새 파일:** `apps/builder/src/builder/workspace/canvas/layoutContext.ts` — 순환 참조 방지를 위해 별도 파일로 분리

### 3. @pixi/layout 'layout' 이벤트 기반 타이밍 수정

스타일 패널 변경 후 캔버스에 즉시 반영되지 않고 팬(이동)해야 적용되던 문제 수정:

| 항목       | 수정 전                                                | 수정 후                                                           |
| ---------- | ------------------------------------------------------ | ----------------------------------------------------------------- |
| **타이밍** | `requestAnimationFrame` 1회 — prerender 전에 실행 가능 | `container.on('layout', handler)` — Yoga 계산 완료 후 정확히 호출 |
| **의존성** | `[elementId, layout]` — layout 변경 시만 트리거        | `[elementId]` — 이벤트 기반이므로 재등록 불필요                   |
| **초기값** | rAF에 의존                                             | rAF fallback + layout 이벤트 구독                                 |

**상세:** `apps/builder/src/builder/workspace/canvas/BuilderCanvas.tsx` (LayoutContainer), `apps/builder/src/builder/workspace/canvas/layoutContext.ts`, `apps/builder/src/builder/workspace/canvas/sprites/ElementSprite.tsx`

### 4. Dirty Rect 부분 렌더링 활성화 (Skia 콘텐츠 프레임) — (현재 제거됨)

2026-02-03에 clipRect 기반 Dirty Rect 부분 렌더링을 활성화(좌표 변환 포함)했으나,
2026-02-04~02-05에 "팬/줌/스냅샷/padding" 조합에서 잔상·미반영 리스크가 커서 제거(보류)했다.
현재는 Pencil 방식 2-pass(컨텐츠 캐시 + present blit + 오버레이 분리)로 대체된다.

| 항목               | 당시(2026-02-03)                                      | 현재(2026-02-05)                                         |
| ------------------ | ----------------------------------------------------- | -------------------------------------------------------- |
| **content 프레임** | `renderContent(..., dirtyRects)` → clipRect 부분 렌더 | 컨텐츠 invalidation은 full rerender로 단순화             |
| **카메라 프레임**  | camera-only blit 인프라 보존(비활성)                  | snapshot 아핀 blit(camera-only) 활성 + cleanup(full) 1회 |

> 기록 목적 참고: `dirtyRectTracker.ts`는 과거 시도 흔적으로 남아 있을 수 있으나, 현재 렌더 경로에는 통합되지 않는다.

### 5. Skia 렌더 루프 Ticker Priority 수정 (display 전환 플리커)

`display: block ↔ flex` 전환 시 body 내 Button들이 캔버스 (0,0)으로 순간이동했다가 재배치되는 1-프레임 플리커 수정:

| 항목                     | 수정 전                                     | 수정 후                                        |
| ------------------------ | ------------------------------------------- | ---------------------------------------------- |
| **renderFrame priority** | NORMAL (0) — Application.render() 전에 실행 | UTILITY (-50) — Application.render() 후에 실행 |
| **alpha=0 설정**         | renderFrame 내부 (NORMAL 0)                 | 별도 `syncPixiVisibility` 콜백 (HIGH 25)       |
| **worldTransform**       | Yoga 미실행 → stale 좌표 읽음               | Yoga 실행 완료 → 최신 좌표 읽음                |

**근본 원인:**

- PixiJS ticker는 priority 순으로 콜백 실행: HIGH(25) → NORMAL(0) → LOW(-25) → UTILITY(-50)
- `Application.render()` (LOW=-25) 내부의 `prerender`에서 @pixi/layout이 Yoga `calculateLayout()` 실행
- `renderFrame` (NORMAL=0)이 Application.render() 전에 실행 → worldTransform 미갱신
- display 전환 시 Yoga가 아직 새 레이아웃을 계산하지 않은 stale 좌표 (0,0) 읽음

**상세:** `apps/builder/src/.../skia/SkiaOverlay.tsx`

## Update: Pan/Zoom 부드러움 최적화 (2026-02-02)

Pencil 앱 대비 팬/줌 끊김 원인 5가지를 분석·수정:

### 1. 정수 스냅 제거 (SelectionBox)

| 항목          | 수정 전                                                                     | 수정 후                    |
| ------------- | --------------------------------------------------------------------------- | -------------------------- |
| **좌표 처리** | `Math.round(bounds.x)` — 정수 스냅                                          | `bounds.x` — 서브픽셀 유지 |
| **증상**      | 줌 2x에서 1px 씬 스텝 = 2px 스크린 점프                                     | 부드러운 서브픽셀 이동     |
| **근거**      | PixiJS는 alpha=0 히트 테스팅 전용, 시각적 렌더링은 Skia가 안티앨리어싱 처리 | —                          |

**상세:** `apps/builder/src/.../selection/SelectionBox.tsx`

### 2. 고정 16ms 드래그 스로틀 제거

| 항목            | 수정 전                                      | 수정 후                                            |
| --------------- | -------------------------------------------- | -------------------------------------------------- |
| **스로틀**      | `performance.now() - last < 16` (60fps 고정) | RAF 스로틀 (디스플레이 주사율 동기화)              |
| **증상**        | 120Hz/144Hz에서 절반 이하 업데이트율         | 주사율에 맞는 업데이트                             |
| **move/resize** | 시간 기반 스로틀 → RAF 스로틀 (이중 스로틀)  | 포인터 이벤트 속도로 즉시 반영 (imperative PixiJS) |

**상세:** `apps/builder/src/.../selection/useDragInteraction.ts`

### 3. 인터랙션 중 해상도 하향 비활성화

| 항목            | 수정 전                                                                | 수정 후          |
| --------------- | ---------------------------------------------------------------------- | ---------------- |
| **인터랙션 중** | 해상도 하향 (저사양: 1, 고사양: 1.5)                                   | 고정 해상도 유지 |
| **증상**        | 줌 시작 시 PixiJS 캔버스 리사이즈 → @pixi/layout 재계산 → React 리렌더 | 리사이즈 없음    |
| **근거**        | Skia 모드에서 PixiJS는 이벤트 처리 전용 (시각적 렌더링 없음)           | —                |

**상세:** `apps/builder/src/.../canvas/pixiSetup.ts`

### 4. Skia 트리 캐시 카메라 비교 제거

| 항목               | 수정 전                                                                         | 수정 후                  |
| ------------------ | ------------------------------------------------------------------------------- | ------------------------ |
| **캐시 조건**      | `registryVersion + cameraX + cameraY + cameraZoom`                              | `registryVersion`만 비교 |
| **카메라 변경 시** | 캐시 MISS → O(N) 트리 순회 (~5-10ms)                                            | 캐시 HIT → O(1) (~0ms)   |
| **근거**           | 트리 좌표는 `relX = absX - parentAbsX`로 계산, 카메라가 부모-자식 뺄셈에서 상쇄 | —                        |

**상세:** `apps/builder/src/.../skia/SkiaOverlay.tsx` (`buildSkiaTreeHierarchical`)

### 5. Wheel 팬 Zustand 업데이트 RAF 배칭

| 항목                     | 수정 전                            | 수정 후                                   |
| ------------------------ | ---------------------------------- | ----------------------------------------- |
| **setPanOffset 호출**    | 매 wheel 이벤트 (120Hz+)           | requestAnimationFrame 배칭 (프레임당 1회) |
| **PixiJS/Skia 업데이트** | 즉시 (`controller.setPosition`)    | 즉시 (변경 없음)                          |
| **React 리렌더**         | 120Hz+ → BuilderCanvas 전체 리렌더 | 60fps 상한 → 불필요한 리렌더 제거         |

**상세:** `apps/builder/src/.../viewport/useViewportControl.ts`

### 6. Camera-Only Blit (Pencil 방식: padding + cleanup) — 활성화 (2026-02-05)

Pencil 모델대로 "컨텐츠는 캐시 스냅샷, 카메라만 바뀌면 blit만"을 활성화했다.
핵심은 **contentSurface를 뷰포트보다 크게 생성(padding 512px)** 하여 팬/줌 중 가장자리 클리핑을 막는 것.

| 항목                   | 동작                                                                                                      |
| ---------------------- | --------------------------------------------------------------------------------------------------------- |
| **카메라 변경 프레임** | `camera-only` → `blitWithCameraTransform()` (snapshot 아핀 변환) + 오버레이 렌더                          |
| **품질/커버리지 조건** | (1) `camera.zoom > snapshotZoom * 3` 또는 (2) 패딩 포함 스냅샷이 뷰포트를 덮지 못하면 즉시 content 재렌더 |
| **cleanup**            | 모션 정지 후 200ms에 cleanup(full) 1회 렌더로 품질 정리                                                   |
| **리샘플링**           | zoomRatio != 1이면 `drawImageCubic` 우선 적용(미지원 환경은 `drawImage` 폴백)                             |

**상세:** `apps/builder/src/.../skia/SkiaRenderer.ts`

## Update: Pencil 기반 Skia 렌더링 최적화 (2026-02-03 → 2026-02-05 반영)

Pencil 앱 분석에서 확인된 미적용 렌더링 기법을 도입:

### 1. Cleanup Render (200ms 디바운스) — 활성화

Pencil의 `debouncedMoveEnd(200ms) → invalidateContent()` 패턴. Camera-only blit과 함께 사용하여 가장자리 아티팩트를 해소하는 역할.

| 항목                       | 설명                                                                                                                                                                                 |
| -------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **트리거**                 | camera-only 프레임 이후 `scheduleCleanupRender()` 호출                                                                                                                               |
| **디바운스**               | 200ms — 연속 팬/줌 중에는 타이머 리셋, 정지 후 1회만 실행                                                                                                                            |
| **현재 상태 (2026-02-05)** | camera-only 아핀 blit 활성화. zoom mismatch 또는 snapshot이 화면을 완전히 덮지 못하는 경우(`canBlitWithCameraTransform() === false`)에 cleanup(full) 1회 재렌더로 품질/가장자리 정리 |

### 2. AI Flash 미세 조정

Flash progress > 90%일 때 overlayVersion 증가 중단하여 불필요한 리렌더 방지.

| 항목                | 수정 전                                           | 수정 후                  |
| ------------------- | ------------------------------------------------- | ------------------------ |
| **flash 종료 직전** | 매 프레임 `overlayVersion++`                      | progress >= 0.9이면 스킵 |
| **효과**            | 리렌더 절약 (flash는 시각적으로 거의 완료된 상태) |

### 3. Pencil 스타일 줌 속도

Pencil 앱의 줌 속도와 동일하게 조정:

| 항목              | 수정 전                     | 수정 후                                                             |
| ----------------- | --------------------------- | ------------------------------------------------------------------- |
| **줌 계수**       | `deltaY * 0.001` (12%/클릭) | `clamp(deltaY, ±30) * -0.012` (36%/클릭)                            |
| **트랙패드 구분** | 없음                        | `metaKey` → ±15 클램프 (트랙패드 핀치), `ctrlKey` → ±30 (마우스 휠) |
| **체감**          | Pencil 대비 3배 느림        | Pencil과 동일                                                       |

**상세:** `useViewportControl.ts`, `SkiaRenderer.ts`, `SkiaOverlay.tsx`

## Update: Dirty Rect 제거 + Pencil 2-pass 렌더러 완전 교체 (2026-02-05)

Dirty Rect(clipRect) 기반 부분 렌더링은 "팬/줌/스냅샷/padding" 조합에서
좌표계·클리핑 경계 문제가 잔상·미반영 버그로 나타나기 쉬워 제거(보류)했다.

대신 Pencil과 동일한 모델로 정리:

- contentSurface에 **디자인 컨텐츠** 전체 렌더 → `contentSnapshot` 캐시
- present 단계에서 snapshot blit(카메라 델타 아핀 변환) + **오버레이(Selection/AI/PageTitle) 별도 렌더**
- 줌/팬 중에는 camera-only 우선, 정지 후 cleanup(full)로 품질 정리
- Dev 관측: `GPUDebugOverlay`로 `RAF FPS`와 함께 `Present/s`, `Content/s`, `Registry/s`, `Idle%` 등을 분리 관측

## Update: Skia UI 컴포넌트 borderRadius 파싱 수정 (2026-02-03)

`ElementSprite`의 Skia 폴백 렌더링에서 `style.borderRadius`를 `typeof === 'number'`로 직접 검사하여 CSS 문자열 값(`"12px"` 등)이 항상 `0`으로 평가되던 버그 수정:

| 항목                  | 수정 전                                           | 수정 후                                          |
| --------------------- | ------------------------------------------------- | ------------------------------------------------ |
| **borderRadius 소스** | `style.borderRadius` (raw CSS 문자열)             | `convertStyle(style).borderRadius` (파싱된 숫자) |
| **파싱 방식**         | `typeof === 'number'` → 문자열이면 `0`            | `convertBorderRadius()` → `parseCSSSize()`       |
| **영향**              | 모든 UI 컴포넌트 borderRadius가 0 또는 기본값 6px | 사용자 설정값 정상 반영                          |

> **Note:** `convertStyle()`은 내부적으로 `convertBorderRadius()` → `parseCSSSize()`를 호출하여 CSS 문자열을 숫자로 변환한다. BoxSprite는 이미 이 패턴을 사용하고 있었으나, ElementSprite 폴백에서는 `borderRadius`를 destructuring하지 않아 raw 문자열을 직접 읽고 있었다. 이는 §4.7.4 "typeof === 'number' 금지 패턴"에 해당하는 버그였다.

**상세:** `apps/builder/src/.../sprites/ElementSprite.tsx`

## Update: Multi-Page Canvas Rendering (2026-02-05)

Pencil의 Frame처럼 모든 페이지를 캔버스에 동시 렌더링하는 멀티페이지 지원 추가:

### 씬 그래프 구조 변경

```
변경 전:                          변경 후:
Camera                           Camera
  BodyLayer (단일)                  pages.map(page =>
  CanvasBounds (단일)                 <PageContainer x={pos.x} y={pos.y}>
  ElementsLayer (단일)                  <pixiGraphics /> (타이틀 드래그)
  SelectionLayer                        <BodyLayer />
                                        <CanvasBounds />
                                        {isVisible && <ElementsLayer />}
                                      </PageContainer>
                                    )
                                    <SelectionLayer /> (최상단)
```

### 핵심 설계 결정

| 결정                                      | 근거                                                                     |
| ----------------------------------------- | ------------------------------------------------------------------------ |
| **PageContainer에 x/y 직접 배치**         | Yoga layout 외부이므로 x/y prop 예외 허용                                |
| **Skia traverse() 수정 불필요**           | `worldTransform`이 page container offset 자동 누적                       |
| **페이지 전환 시 레지스트리 초기화 제거** | 모든 페이지 동시 마운트                                                  |
| **`setSelectedElements([])` 사용**        | `clearSelection()`은 selection 슬라이스만 초기화 — 트리/패널에 잔류 문제 |
| **DOM clientX/clientY 좌표계**            | PixiJS global 좌표와 DOM 좌표 불일치 방지                                |
| **`invalidateContent()` + ref 기반**      | 버전 합산은 충돌 위험, 매 프레임 store 읽기는 성능 부담                  |

### 성능 영향

| 항목               | 변경 전                        | 변경 후                                  |
| ------------------ | ------------------------------ | ---------------------------------------- |
| 페이지별 요소 조회 | O(N\*M) `elements.find/filter` | O(1) `pageIndex`                         |
| elementById        | `new Map()` 매 렌더 생성       | `elementsMap` 직접 참조                  |
| 페이지 컨테이너    | 인라인 JSX                     | `PageContainer` memo                     |
| 뷰포트 밖 페이지   | 전체 렌더링                    | `ElementsLayer` 조건부 제외 (200px 마진) |

**상세:** `docs/MULTIPAGE.md`

## Update: Grid Skia 씬 좌표계 렌더링 + Snap to Grid (2026-02-12)

### 1. Grid 렌더러 Screen-Space → Scene-Space 마이그레이션

PixiJS `GridLayer.tsx` 기반 그리드를 CanvasKit/Skia `gridRenderer.ts`로 마이그레이션하면서,
그리드 좌표계를 Screen-Space에서 Scene-Space로 전환하여 Snap to Grid 정합성을 확보:

| 항목            | 수정 전 (Screen-Space)                 | 수정 후 (Scene-Space)                                    |
| --------------- | -------------------------------------- | -------------------------------------------------------- |
| **좌표계**      | `(0, 0)` ~ `(width, height)` 화면 고정 | `cullingBounds` 기반 씬 좌표                             |
| **그리드 정렬** | 카메라 독립 → 요소 snap 위치와 불일치  | 요소의 left/top 값과 동일한 좌표에 그리드선 위치         |
| **선 두께**     | 고정 1px                               | `1 / zoom` 보정으로 화면상 항상 1px                      |
| **중앙선**      | 화면 중앙                              | 씬 원점 `(0, 0)`                                         |
| **카메라 변환** | 없음                                   | `renderScreenOverlay()`에서 DPR + translate + scale 적용 |

**핵심:** 그리드가 씬 좌표계에서 렌더링되므로 Snap to Grid 위치와 시각적 그리드선이 항상 정확히 일치.

### 2. renderScreenOverlay() 카메라 변환 추가

`SkiaRenderer.ts`의 `renderScreenOverlay()`에 카메라 변환을 적용하여 씬 좌표계 오버레이를 지원:

```typescript
private renderScreenOverlay(cullingBounds: DOMRect, camera: CameraState): void {
  this.mainCanvas.save();
  this.mainCanvas.scale(this.dpr, this.dpr);
  this.mainCanvas.translate(camera.panX, camera.panY);
  this.mainCanvas.scale(camera.zoom, camera.zoom);
  this.screenOverlayNode.renderSkia(this.mainCanvas, cullingBounds);
  this.mainCanvas.restore();
}
```

### 3. 페이지 드래그 Snap to Grid 지원

`usePageDrag.ts`에 snap-to-grid 로직 추가 — 기존에는 요소 드래그만 snap을 지원하고 페이지 드래그는 미지원:

| 항목              | 수정 전              | 수정 후                                               |
| ----------------- | -------------------- | ----------------------------------------------------- |
| **onPointerMove** | 자유 이동            | `snapToGrid` 활성 시 `gridSize` 단위 스냅             |
| **onPointerUp**   | 최종 위치만 업데이트 | 최종 위치 + 스냅 적용 (RAF 취소로 누락된 이동분 반영) |

**상세:** `gridRenderer.ts`, `SkiaRenderer.ts`, `SkiaOverlay.tsx`, `usePageDrag.ts`

## Update: Spec Shapes 기반 Skia UI 컴포넌트 렌더링 (2026-02-12)

62개 UI 컴포넌트(Button, Checkbox, Radio, Switch 등)가 "배경색+텍스트" fallback으로만 Skia 렌더링되던 한계를 **ComponentSpec의 `render.shapes()` 기반 정확한 도형 렌더링**으로 교체:

| 항목                   | 수정 전                                             | 수정 후                                                                       |
| ---------------------- | --------------------------------------------------- | ----------------------------------------------------------------------------- |
| **UI 컴포넌트 렌더링** | 배경색+텍스트 fallback (`VARIANT_BG_COLORS` 테이블) | Spec shapes 기반 정확한 도형 렌더링                                           |
| **지원 Shape 타입**    | 없음                                                | roundRect, rect, circle, line, border, text, shadow, container                |
| **Column 레이아웃**    | 미지원                                              | `rearrangeShapesForColumn()` — shapes 좌표 재배치 (indicator 중앙, text 아래) |
| **BlockEngine 크기**   | `DEFAULT_HEIGHT` 36px fallback                      | Spec 기반 24px (md) + `flexDirection` 인식                                    |

### 1. 렌더링 파이프라인

```
ComponentSpec.render.shapes(props, variant, size, state = 'default')
  → Shape[] (roundRect, rect, circle, line, border, text, shadow, container)
  → specShapesToSkia(shapes, theme, width, height)
  → SkiaNodeData (box, line, text, effects)
  → renderNode() (nodeRenderers.ts)
```

### 2. specShapeConverter.ts (신규)

`Shape[]` → `SkiaNodeData` 제네릭 변환기. Shape 타입별 매핑 규칙:

| Shape 타입  | SkiaNodeData 타입       | 변환 규칙                                                            |
| ----------- | ----------------------- | -------------------------------------------------------------------- |
| `roundRect` | `box`                   | `radius` → `borderRadius`, `auto` 크기 → 컨테이너 크기               |
| `rect`      | `box`                   | `borderRadius: 0`                                                    |
| `circle`    | `box`                   | 중심→좌상단 변환 (`x - radius, y - radius`), `borderRadius = radius` |
| `line`      | `line`                  | `x1/y1/x2/y2` + `strokeColor/strokeWidth` (신규 SkiaNodeData 타입)   |
| `border`    | 기존 노드에 stroke 추가 | `target` ID 또는 직전 노드의 `box.strokeColor/strokeWidth` 설정      |
| `text`      | `text`                  | baseline/align 기반 padding 계산, `TokenRef` fontSize 해석           |
| `shadow`    | `effects[]` 추가        | `target` 노드에 `drop-shadow` EffectStyle 부착                       |
| `container` | 재귀 호출               | 자식 `Shape[]` → `specShapesToSkia()` 재귀                           |

**bgBox 추출 규칙:** 첫 번째 `auto`-sized shape at `(0, 0)`만 컨테이너 배경으로 추출. 고정 크기 shape (예: checkbox indicator 20x20)는 추출하지 않음.

**색상 해석:** `ColorValue` → `resolveColor()` → hex → `Float32Array(r, g, b, a)`
**TokenRef 해석:** `resolveNum()` → `resolveToken()` (예: `'{typography.text-md}'` → `14`)

### 3. ElementSprite.tsx 변경

`TAG_SPEC_MAP`으로 62개 컴포넌트 태그를 ComponentSpec에 매핑:

```typescript
const TAG_SPEC_MAP: Record<string, ComponentSpec<any>> = {
  Button: ButtonSpec,
  SubmitButton: ButtonSpec,
  FancyButton: FancyButtonSpec,
  // ... 62개 컴포넌트
};

function getSpecForTag(tag: string): ComponentSpec<any> | null {
  return TAG_SPEC_MAP[tag] ?? null;
}
```

**Column layout 지원:** `rearrangeShapesForColumn()` — `flexDirection: column` 일 때 indicator를 가로 중앙에, text를 indicator 아래에 재배치.

**세로 가운데 정렬:** 컨테이너가 spec 콘텐츠보다 높을 때 `specNode.y = (finalHeight - specHeight) / 2`로 수직 센터링.

### 4. BlockEngine 통합

`engines/utils.ts`의 `calculateContentWidth/Height`에 Checkbox/Radio/Switch/Toggle 전용 크기 계산 추가:

| 항목                     | 수정 전                 | 수정 후                                                                   |
| ------------------------ | ----------------------- | ------------------------------------------------------------------------- |
| **기본 높이**            | `DEFAULT_HEIGHT` (36px) | Spec 기반 크기 (md: 24px)                                                 |
| **flexDirection row**    | 미지원                  | `indicatorW + gap + textW`                                                |
| **flexDirection column** | 미지원                  | `max(indicatorW, textW)`, height: `indicatorH + gap + textH`              |
| **styleToLayout.ts**     | 기본 flex 없음          | Checkbox/Radio/Switch 기본 flex 레이아웃 + `flexDirection` 인식 크기 계산 |

### 5. 기타 변경

| 파일                             | 변경                                                                                             |
| -------------------------------- | ------------------------------------------------------------------------------------------------ |
| `skia/nodeRenderers.ts`          | `SkiaNodeData`에 `'line'` 타입 추가, `renderLine()` 구현                                         |
| `skia/aiEffects.ts`              | `borderRadius` 튜플 타입 호환성 패치 (`number \| readonly [number, number, number, number]`)     |
| `types/builder/unified.types.ts` | `createDefaultCheckboxProps`/`RadioProps`/`SwitchProps`에 `variant`, `size`, `style` 기본값 추가 |

**상세:** `apps/builder/src/.../skia/specShapeConverter.ts`, `apps/builder/src/.../sprites/ElementSprite.tsx`, `apps/builder/src/.../skia/nodeRenderers.ts`, `docs/COMPONENT_SPEC.md`

## Update: Spec Shapes props.style 오버라이드 패턴 (2026-02-12)

모든 49개 ComponentSpec의 `render.shapes()` 함수에 **props.style 오버라이드 패턴**을 적용하여,
Inspector에서 설정한 인라인 스타일이 WebGL(Skia) 렌더링에 정확히 반영되도록 수정:

### 1. props.style 우선 참조 패턴

| 속성        | 오버라이드 소스                          | 폴백                           |
| ----------- | ---------------------------------------- | ------------------------------ |
| 배경색      | `props.style?.backgroundColor`           | `variant.background` (state별) |
| 텍스트색    | `props.style?.color`                     | `variant.text`                 |
| 테두리색    | `props.style?.borderColor`               | `variant.border`               |
| 모서리 반경 | `props.style?.borderRadius`              | `size.borderRadius`            |
| 테두리 두께 | `props.style?.borderWidth`               | spec 기본값 (1)                |
| 폰트 크기   | `props.style?.fontSize`                  | `size.fontSize`                |
| 폰트 굵기   | `props.style?.fontWeight`                | spec 기본값 (500)              |
| 폰트 패밀리 | `props.style?.fontFamily`                | `fontFamily.sans`              |
| 텍스트 정렬 | `props.style?.textAlign`                 | 'center'                       |
| 패딩        | `props.style?.paddingLeft/Right/padding` | `size.paddingX`                |

### 2. Yoga 높이 통합

| 항목                  | 수정 전                                       | 수정 후                          |
| --------------------- | --------------------------------------------- | -------------------------------- |
| **배경 roundRect**    | `height: size.height` (고정)                  | `height: 'auto'` (컨테이너 크기) |
| **specHeight**        | `Math.min(sizeSpec.height, finalHeight)`      | `finalHeight` (항상 Yoga)        |
| **MIN_BUTTON_HEIGHT** | 24px 최소값 제한                              | 제거                             |
| **수직 센터링**       | `specNode.y = (finalHeight - specHeight) / 2` | 불필요 (높이 동일)               |

### 3. specShapeConverter 개선

| 항목                   | 변경                                                                                             |
| ---------------------- | ------------------------------------------------------------------------------------------------ |
| **텍스트 maxWidth**    | `shape.x > 0`일 때 자동 감소: center → `containerWidth - x*2`, left/right → `containerWidth - x` |
| **safety clamp**       | `maxWidth < 1`이면 `containerWidth`로 폴백 (padding=0 안전 처리)                                 |
| **gradient fill 이전** | `boxData.fill → specNode.box.fill` 후 `boxData.fill = undefined`                                 |

**상세:** `packages/specs/src/components/*.spec.ts` (49개), `apps/builder/src/.../sprites/ElementSprite.tsx`, `apps/builder/src/.../skia/specShapeConverter.ts`, `apps/builder/src/.../ui/PixiButton.tsx`

## Update: TagGroup 컨테이너 구조 전환 & TextSprite 히트 영역 (2026-02-13)

### 1. TagGroup/TagList → CONTAINER_TAGS 전환

TagGroup과 TagList를 `TAG_SPEC_MAP` 기반 개별 렌더링에서 **BoxSprite 기반 컨테이너 렌더링**으로 전환:

| 항목                     | 수정 전                             | 수정 후                                               |
| ------------------------ | ----------------------------------- | ----------------------------------------------------- |
| **렌더링 방식**          | `TAG_SPEC_MAP`에서 개별 Spec 렌더링 | `CONTAINER_TAGS`에 추가하여 BoxSprite 기반 컨테이너   |
| **isYogaSizedContainer** | TagGroup/TagList 미포함             | TagGroup/TagList 추가 (ToggleButtonGroup과 동일 패턴) |
| **PixiTagGroup**         | 특수 렌더링 코드 존재               | 제거                                                  |

**근거:** TagGroup/TagList는 자식 요소를 Yoga 레이아웃으로 배치하는 컨테이너 역할이므로, 개별 도형 렌더링보다 BoxSprite 컨테이너가 적합.

### 2. ElementSprite useSkiaNode 이중 등록 방지

`useSkiaNode` 훅에서 Skia 데이터 이중 등록을 방지하는 로직 개선:

| 항목                | 수정 전                                                                                                                                          | 수정 후                                                                          |
| ------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------ | -------------------------------------------------------------------------------- |
| **변수명**          | `hasBoxSprite`                                                                                                                                   | `hasOwnSprite` (의미 명확화)                                                     |
| **spriteType 체크** | BoxSprite만 체크                                                                                                                                 | `text` spriteType 추가                                                           |
| **문제**            | style이 있는 텍스트 요소(예: fontSize/fontWeight가 설정된 Label)에서 ElementSprite가 box 데이터를 등록하여 TextSprite의 텍스트 데이터를 덮어씌움 | TextSprite가 자체적으로 Skia 데이터를 등록하므로 ElementSprite에서 덮어쓰기 방지 |

**영향:** Label, Text, Heading, Paragraph 등 텍스트 요소에 인라인 스타일(fontSize, fontWeight 등)이 설정된 경우, Skia 렌더링에서 텍스트가 사라지거나 단순 박스로 대체되는 버그가 해결됨.

### 3. TextSprite 투명 히트 영역

backgroundColor가 없는 텍스트 요소에서도 PixiJS EventBoundary 클릭 감지가 가능하도록 투명 히트 영역 추가:

| 항목                          | 수정 전                                        | 수정 후                                           |
| ----------------------------- | ---------------------------------------------- | ------------------------------------------------- |
| **backgroundColor 없는 경우** | `g.clear()` 실행 → 히트 영역 0                 | `alpha:0.001` 투명 사각형 렌더링 → 클릭 감지 가능 |
| **사용자 경험**               | 배경색 없는 텍스트를 캔버스에서 클릭/선택 불가 | 텍스트 영역 어디서든 클릭/선택 가능               |

**원리:** PixiJS EventBoundary는 `alpha > 0`인 렌더된 영역에서만 히트 테스트를 수행. `alpha:0.001`은 시각적으로 투명하지만 이벤트 감지는 활성화됨 (`renderable=false`는 이벤트까지 비활성화하므로 사용 금지 — ADR-003 기존 규칙 참조).

### 4. styleToLayout 텍스트 태그 높이 자동계산

Yoga `measureFunc` 없이도 컨테이너 내에서 텍스트 요소의 높이를 올바르게 인식하도록 자동계산 로직 추가:

| 항목               | 수정 전                    | 수정 후                                                  |
| ------------------ | -------------------------- | -------------------------------------------------------- |
| **텍스트 높이**    | 미지정 → Yoga가 0으로 처리 | `Math.ceil(fontSize * 1.4)` 자동계산                     |
| **대상 태그**      | 없음                       | `TEXT_LAYOUT_TAGS` 집합: label, text, heading, paragraph |
| **size prop 해석** | 미지원                     | typography 토큰 매핑 (xs:12, sm:14, md:16, lg:18, xl:20) |

**계산 공식:** `height = Math.ceil(fontSize * 1.4)`

- `fontSize`: `style.fontSize` > `size` prop 토큰 매핑 > 기본값 16px
- `1.4`: CSS `line-height: 1.4` 근사값 (텍스트 baseline + descender 포함)

**상세:** `apps/builder/src/.../sprites/ElementSprite.tsx`, `apps/builder/src/.../sprites/TextSprite.tsx`, `apps/builder/src/.../canvas/styleToLayout.ts`

## Update: 컨테이너 히트 영역 Non-Layout 패턴 (2026-02-14)

### 문제

CSS padding이 설정된 컨테이너 요소(TagGroup, TagList, Card, Box 등)를 캔버스에서 클릭해도 선택되지 않는 버그.

**근본 원인: Yoga 3의 absolute positioning과 padding의 상호작용**

@pixi/layout은 Yoga 3 (`yoga-layout ^3.2.1`)을 레이아웃 엔진으로 사용한다. Yoga 3에는 `AbsolutePositionWithoutInsetsExcludesPadding` errata 플래그가 있으며, @pixi/layout (`^3.2.0`)은 Yoga errata를 별도로 구성하지 않고 기본값을 사용한다.

이 기본 동작에서, `position: 'absolute'`이고 `left`/`top` inset이 명시된 자식 노드는 **부모의 content 영역 원점**(paddingLeft, paddingTop)을 기준으로 배치된다:

```
Container (padding: 16px)
┌──────────────────────────┐  ← 컨테이너 border-box 원점 (0, 0)
│  padding (16px)           │
│  ┌────────────────────┐  │  ← content 영역 원점 (16, 16)
│  │ absolute 자식       │  │  ← left:0, top:0 → (16, 16)에 배치됨
│  │ (BoxSprite 히트영역) │  │
│  └────────────────────┘  │
│                          │
└──────────────────────────┘
```

**시각적 렌더링(Skia)** 은 컨테이너의 전체 border-box 영역(padding 포함)을 올바르게 렌더링한다. 하지만 **인터랙티브 히트 영역(PixiJS)** 의 BoxSprite는 `layout={{ position: 'absolute', left: 0, top: 0 }}`으로 배치되어 있어, Yoga가 이를 content 영역 원점으로 오프셋한다. 결과적으로 padding 영역에 히트 영역이 존재하지 않아 클릭이 불가능하다.

### 해결: Non-Layout `<pixiGraphics>` 히트 영역

`layout` prop이 없는 `<pixiGraphics>`를 컨테이너의 **첫 번째 자식**으로 삽입한다:

```tsx
// ElementSprite.tsx — 컨테이너 렌더링 (box, flex, grid spriteType)
<>
  {/* Non-layout 히트 영역: layout prop 없음 → Yoga가 무시 → 컨테이너 원점(0,0)에 배치 */}
  <pixiGraphics
    draw={drawContainerHitRect}
    eventMode="static"
    cursor="pointer"
    onPointerDown={handleContainerPointerDown}
  />
  {/* BoxSprite: absolute 배치 (기존) — padding 오프셋 영향받지만 시각적 역할만 */}
  <pixiContainer
    layout={{
      position: "absolute" as const,
      left: 0,
      top: 0,
      right: 0,
      bottom: 0,
    }}
  >
    <BoxSprite
      element={effectiveElement}
      isSelected={isSelected}
      onClick={onClick}
    />
  </pixiContainer>
  {/* 자식 요소들 */}
  {childElements.map((childEl) => renderChildElement(childEl))}
</>
```

**핵심 메커니즘:**

| 항목            | BoxSprite (기존, absolute)                  | pixiGraphics (신규, non-layout)                              |
| --------------- | ------------------------------------------- | ------------------------------------------------------------ |
| **layout prop** | `{ position: 'absolute', left: 0, top: 0 }` | 없음                                                         |
| **Yoga 참여**   | 참여 — padding에 의한 오프셋 발생           | 무시 — Yoga 레이아웃 트리에 포함되지 않음                    |
| **배치 위치**   | content 영역 원점 (paddingLeft, paddingTop) | 컨테이너 원점 (0, 0)                                         |
| **크기**        | content 영역 (padding 제외)                 | `LayoutComputedSizeContext`의 border-box 크기 (padding 포함) |
| **역할**        | 배경/테두리 시각 렌더링 + Skia 데이터 등록  | 이벤트 히트 영역 전용                                        |
| **이벤트 처리** | `eventMode="static"` (BoxSprite 자체)       | `eventMode="static"` + `onPointerDown`                       |

**`drawContainerHitRect` 구현:**

```typescript
const drawContainerHitRect = useCallback(
  (g: PixiGraphics) => {
    g.clear();
    const w = computedW ?? 0; // LayoutComputedSizeContext에서 Yoga border-box 크기
    const h = computedH ?? 0;
    if (w <= 0 || h <= 0) return;
    g.rect(0, 0, w, h);
    g.fill({ color: 0xffffff, alpha: 0.001 });
  },
  [computedW, computedH],
);
```

### 적용 대상

이 패턴은 **자식 요소를 가진 모든 컨테이너 타입**에 적용된다:

| spriteType | 적용 조건                  |
| ---------- | -------------------------- |
| `box`      | `childElements.length > 0` |
| `flex`     | `childElements.length > 0` |
| `grid`     | `childElements.length > 0` |

대상 태그 (`CONTAINER_TAGS`): Card, Box, Panel, Form, Group, Dialog, Modal, Disclosure, DisclosureGroup, Accordion, ToggleButtonGroup, TagGroup, TagList

> **Note:** 자식이 없는 컨테이너는 BoxSprite 단독으로 렌더링되며, BoxSprite 자체의 히트 영역이 충분하므로 non-layout 패턴이 불필요하다.

### 관련 규칙

- **[pixi-hitarea-absolute](/.claude/skills/composition-patterns/rules/pixi-hitarea-absolute.md)** — 히트 영역 배치 패턴 (이 Update로 "Non-layout 히트 영역" 섹션 추가)

**상세:** `apps/builder/src/.../sprites/ElementSprite.tsx` (drawContainerHitRect, handleContainerPointerDown)

## Update: 레이아웃 엔진 마이그레이션 완료 — 전략 D Phase 9 (2026-02-17)

008-layout-engine.md 전략 D의 최종 단계인 Phase 9를 완료하여, 레거시 레이아웃 엔진을 모두 삭제하고 새 엔진 아키텍처로 완전 전환:

### 1. 레거시 엔진 삭제 (Phase 9A)

| 삭제 대상        | 라인 수 | 대체 엔진                      |
| ---------------- | ------- | ------------------------------ |
| `BlockEngine.ts` | 952줄   | `TaffyBlockEngine`             |
| `FlexEngine.ts`  | 65줄    | `TaffyFlexEngine` (Taffy WASM) |
| `GridEngine.ts`  | 563줄   | `TaffyGridEngine` (Taffy WASM) |

### 2. 현재 엔진 아키텍처

| display 값                                     | 엔진               | 기술       |
| ---------------------------------------------- | ------------------ | ---------- |
| `flex`, `inline-flex`                          | `TaffyFlexEngine`  | Taffy WASM |
| `grid`, `inline-grid`                          | `TaffyGridEngine`  | Taffy WASM |
| `block`, `inline-block`, `flow-root`, `inline` | `TaffyBlockEngine` | Taffy WASM |

**WASM 초기화:** `WASM_FLAGS.LAYOUT_ENGINE`이 `true`여야 `initRustWasm()`이 호출됨. `initRustWasm()`은 `import()` 후 **반드시 default export(`__wbg_init`)를 명시적으로 호출**하여 내부 wasm 바인딩을 초기화한다 (wasm-pack `--target bundler` 필수 요건). WASM 미로드 시 `TaffyBlockEngine`이 JavaScript 폴백 경로로 동작 (Dropflow는 제거됨 — Phase 9 이후 `TaffyBlockEngine`이 block 레이아웃 단독 처리).

### 3. 디스패처 정리 (Phase 9C)

- `engines/index.ts`에서 `shouldDelegateToPixiLayout` 제거
- Feature flag 분기 (`isTaffyFlexEnabled`, `isTaffyGridEnabled`, `isDropflowBlockEnabled`) 제거 (Dropflow 제거와 함께 `isDropflowBlockEnabled`도 삭제)
- `selectEngine()` 직접 라우팅으로 단순화
- 싱글톤 엔진 인스턴스 (매 호출마다 new 생성 → 싱글톤)

### 4. 주요 수정 사항

| 수정                              | 원인                                   | 해결                                 |
| --------------------------------- | -------------------------------------- | ------------------------------------ |
| `WASM_FLAGS.LAYOUT_ENGINE` 활성화 | `false`일 때 Taffy 엔진 비활성화       | `true`로 변경                        |
| `resolveLayoutSize()` 추가        | `width:'100%'` 문자열이 0으로 평가     | `%` 문자열을 부모 크기 기준으로 해석 |
| Flex parent passthrough           | wrapper가 `alignItems:flex-start` 강제 | 부모 flex 속성을 Yoga wrapper에 전달 |

### 5. 기술 스택 변경

| 항목              | 변경 전                                                          | 변경 후                                                                  |
| ----------------- | ---------------------------------------------------------------- | ------------------------------------------------------------------------ |
| **Layout Engine** | 하이브리드 (BlockEngine, FlexEngine, GridEngine) + Feature flags | Taffy WASM (Flex/Grid/Block) — `TaffyBlockEngine` 단일 엔진, 직접 라우팅 |
| **Feature flags** | `taffyFlex`, `taffyGrid`, `dropflowBlock`                        | 제거 (항상 활성, `dropflowBlock`은 Dropflow 제거로 폐기)                 |
| **코드 라인**     | ~1,580줄 레거시 코드                                             | 삭제 완료                                                                |

**상세:** `docs/adr/008-layout-engine.md`, `apps/builder/src/.../layout/engines/index.ts`

## Update: @pixi/layout + @pixi/ui 완전 제거 — Phase 10-11 (2026-02-18)

### Phase 10: @pixi/ui 제거 (완료)

11개 UI 컴포넌트 파일에서 `@pixi/ui` 의존성 제거. 순수 PixiJS Container + Graphics(alpha=0.001) 히트 영역으로 대체.

### Phase 11: @pixi/layout (Yoga) 제거 (완료)

**이중 계산 문제 해결:**

| 항목                   | 수정 전                                                           | 수정 후                                 |
| ---------------------- | ----------------------------------------------------------------- | --------------------------------------- |
| **레이아웃 경로**      | Engine → ComputedLayout → marginTop/marginLeft 변환 → Yoga 재계산 | Engine → ComputedLayout → x/y 직접 배치 |
| **LayoutContainer**    | Yoga layout={} prop 기반                                          | DirectContainer x/y/width/height props  |
| **UI 컴포넌트 (42개)** | layout={} prop + Yoga 연동                                        | layout prop 완전 제거                   |
| **패키지**             | `@pixi/layout ^3.2.0`, `yoga-layout ^3.2.1`                       | 제거됨                                  |

**수정 범위 (49개 파일):**

- `BuilderCanvas.tsx` — DirectContainer + renderWithCustomEngine 리팩터
- `sprites/ElementSprite.tsx` — layout prop → x/y
- `ui/` 하위 42개 파일 — layout prop 제거
- `pixiSetup.ts` — LayoutContainer/LayoutText 제거
- `pixi-jsx.d.ts`, `types/pixi-react.d.ts` — 타입 정리
- `package.json` — @pixi/layout, yoga-layout 제거

**핵심 원리:** PixiJS는 alpha=0 이벤트 전용 레이어이므로, 엔진 계산 결과의 근사치가 히트 테스트에 충분. Skia가 정확한 시각적 렌더링 담당.

### 현재 기술 스택

| 항목                       | 상태                                                            |
| -------------------------- | --------------------------------------------------------------- |
| **CanvasKit/Skia WASM**    | 메인 렌더러 (디자인 노드 + AI 이펙트 + Selection 오버레이)      |
| **PixiJS 8 + @pixi/react** | 이벤트 전용 레이어 (alpha=0, DirectContainer 직접 배치)         |
| **Taffy WASM**             | Flex/Grid/Block 레이아웃 엔진 (`TaffyBlockEngine`이 block 통합) |
| ~~Dropflow Fork~~          | **제거됨** (Phase 9 — `TaffyBlockEngine`으로 대체)              |
| ~~@pixi/layout~~           | **제거됨** (Phase 11)                                           |
| ~~@pixi/ui~~               | **제거됨** (Phase 10)                                           |
| ~~yoga-layout~~            | **제거됨** (Phase 11)                                           |

## Implementation

```typescript
// Phase 11+: @pixi/layout 없이 DirectContainer로 직접 배치
import { Application, extend } from '@pixi/react';

// DirectContainer: 엔진 계산 결과를 직접 사용
<DirectContainer
  elementId={child.id}
  x={layout.x} y={layout.y}
  width={layout.width} height={layout.height}
>
  <ElementSprite element={child} ... />
</DirectContainer>
```

## Update: Select/ComboBox Compositional Size Delegation (2026-03-11)

### 문제

Select/ComboBox 컴포넌트의 Compositional Architecture(Select → SelectTrigger → SelectValue + SelectIcon)에서 Property Panel을 통한 size 변경이 WebGL/Skia 캔버스에 반영되지 않는 문제.

**근본 원인**: Store에는 부모 Select/ComboBox element에만 size prop이 저장된다. 자식 SelectTrigger/ComboBoxWrapper element는 자체 size prop이 없으므로, ElementSprite의 `skiaNodeData` useMemo에서 항상 "md" fallback을 사용했다.

### 해결: 3경로 동시 size delegation

| 경로              | 파일                     | 메커니즘                                                                                 |
| ----------------- | ------------------------ | ---------------------------------------------------------------------------------------- |
| **Skia 렌더링**   | `ElementSprite.tsx`      | `parentDelegatedSize` useStore selector — 부모/조부모 Select/ComboBox의 size 실시간 조회 |
| **레이아웃 엔진** | `fullTreeLayout.ts`      | `effectiveGetChildElements` wrapper — DFS 순회 시 부모 size를 wrapper 자식에 주입        |
| **CSS Preview**   | `SelectionRenderers.tsx` | `size` prop 직접 전달                                                                    |

### ElementSprite parentDelegatedSize 패턴

```typescript
// apps/builder/src/builder/workspace/canvas/sprites/ElementSprite.tsx
const PARENT_SIZE_DELEGATION_TAGS = new Set([
  "SelectTrigger",
  "ComboBoxWrapper",
  "SelectValue",
  "SelectIcon",
  "ComboBoxInput",
  "ComboBoxTrigger",
]);
const SIZE_DELEGATION_PARENT_TAGS = new Set(["Select", "ComboBox"]);

const parentDelegatedSize = useStore((state) => {
  if (!PARENT_SIZE_DELEGATION_TAGS.has(element.tag) || !element.parent_id)
    return null;
  const parent = state.elementsMap.get(element.parent_id);
  if (!parent) return null;
  if (SIZE_DELEGATION_PARENT_TAGS.has(parent.tag))
    return parent.props?.size ?? null;
  // 2단계 상위 (SelectValue → SelectTrigger → Select)
  if (parent.parent_id) {
    const grandParent = state.elementsMap.get(parent.parent_id);
    if (grandParent && SIZE_DELEGATION_PARENT_TAGS.has(grandParent.tag))
      return grandParent.props?.size ?? null;
  }
  return null;
});
```

**동작 원리**: Select의 size 변경 → `elementsMap` 갱신 → `parentDelegatedSize` selector 새 값 반환 → ElementSprite 리렌더 → `skiaNodeData` useMemo 재계산 → `registerSkiaNode` → `registryVersion++` → Skia 트리 캐시 무효화 → 다음 프레임 업데이트

### CSS-Spec 동기화 테이블

| Size | border-box height | paddingY | paddingX(left) | paddingX(right) | borderWidth | content-box height |
| ---- | ----------------- | -------- | -------------- | --------------- | ----------- | ------------------ |
| xs   | 20                | 1        | 4              | 1               | 1           | 16                 |
| sm   | 22                | 2        | 8              | 2               | 1           | 16                 |
| md   | 30                | 4        | 12             | 4               | 1           | 20                 |
| lg   | 42                | 8        | 16             | 8               | 1           | 24                 |
| xl   | 54                | 12       | 24             | 12              | 1           | 28                 |

**동기화 필수 파일**: Select.spec.ts, ComboBox.spec.ts, SelectTrigger.spec.ts, `SPEC_PADDING`(implicitStyles.ts), `TRIGGER_CONTENT_HEIGHTS`(utils.ts), `COMBOBOX_INPUT_HEIGHTS`(utils.ts)

**상세**: `apps/builder/src/.../sprites/ElementSprite.tsx`, `apps/builder/src/.../layout/engines/fullTreeLayout.ts`, `apps/builder/src/.../layout/engines/implicitStyles.ts`, `apps/builder/src/.../layout/engines/utils.ts`

## References

- `apps/builder/src/builder/workspace/canvas/` - Canvas 구현
- `.claude/skills/composition-patterns/rules/pixi-*.md` - PIXI 규칙
- `docs/adr/008-layout-engine.md` - 레이아웃 엔진 전략
