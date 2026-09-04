# React · Zustand · Skia 프레임 성능 최적화 가이드

- 작성일: 2026-09-04
- 대상: Composition Builder
- 범위: React 렌더링, Zustand 상태 전파, CanvasKit/Skia CPU·GPU 병목, RAF scheduling, 측정 방법

## 요약

이 조합에서 가장 효과적인 접근은 개별 `memo` 튜닝보다 **invalidation-driven retained rendering**이다.

> React와 Zustand는 의미 있는 상태 변경만 처리하고, 프레임 단위의 transient 상태는 별도 presentation 계층에서 모은다. Skia는 변경된 레이어만 프레임당 한 번 제출한다.

핵심 원칙은 다음과 같다.

1. RAF는 하나의 scheduler가 소유하고 동시에 하나의 frame만 pending 상태로 둔다.
2. 화면이 변하지 않을 때는 RAF와 scene/plan 구축을 멈춘다.
3. pointer, camera, drag, hover 같은 고빈도 값은 React render를 일으키지 않는다.
4. canonical document와 history에는 최종 semantic commit만 반영한다.
5. CPU submission 시간과 GPU 실행 시간을 별도로 측정한다.
6. 평균 FPS 대신 frame time과 각 단계의 p50/p95/p99를 사용한다.

## 권장 상태 및 렌더링 구조

| 계층         | 상태 예시                                     | 갱신 방식                                        | 주요 소비자                    |
| ------------ | --------------------------------------------- | ------------------------------------------------ | ------------------------------ |
| Domain       | canonical document, selection commit, history | 이벤트/트랜잭션 단위 Zustand 갱신                | React 패널, DB, Preview        |
| Presentation | camera, pointer, drag offset, hover           | mutable ref 또는 vanilla store에 최신값 덮어쓰기 | 다음 RAF의 Skia 및 DOM overlay |
| Rendering    | dirty flags, retained picture, damage bounds  | 프레임당 최대 한 번 소비                         | CanvasKit, Skia, GPU           |

pointer 이벤트가 한 프레임 동안 여러 번 들어오더라도 중간값을 모두 렌더링하지 않는다. 다음 frame callback은 최신 presentation snapshot 하나만 읽는다.

## 1. RAF를 on-demand scheduler로 운영

CanvasKit 공식 가이드는 화면이 이벤트에 의해서만 변한다면 RAF를 계속 반복하지 않고 입력이 발생했을 때만 다음 프레임을 요청하도록 권장한다. `surface.requestAnimationFrame()`은 브라우저 RAF와 `flush()`를 결합한다.

```ts
let framePending = false;
let dirty = false;

function invalidate(): void {
  dirty = true;

  if (!framePending) {
    framePending = true;
    requestAnimationFrame(renderFrame);
  }
}

function renderFrame(): void {
  framePending = false;
  if (!dirty) return;

  dirty = false;
  const snapshot = readLatestPresentationState();
  renderAndFlush(snapshot);

  if (dirty || hasActiveAnimation()) {
    invalidate();
  }
}
```

이 구조의 불변식은 다음과 같다.

- 동시에 pending인 RAF는 최대 하나다.
- 여러 invalidation은 한 프레임으로 합쳐진다.
- animation이 활성화된 동안에만 연속 프레임을 유지한다.
- frame 처리 중 새 invalidation이 생기면 다음 frame을 예약한다.
- hidden tab timeout을 readiness 성공으로 취급하지 않는다.

### Composition의 최우선 측정 후보

현재 `SkiaCanvas`는 다음 RAF를 먼저 예약한 뒤 content와 frame plan을 구축한다.

- `apps/builder/src/builder/workspace/canvas/skia/SkiaCanvas.tsx:655`: `renderFrameCore`
- `apps/builder/src/builder/workspace/canvas/skia/SkiaCanvas.tsx:657`: 다음 RAF 예약
- `apps/builder/src/builder/workspace/canvas/skia/SkiaCanvas.tsx:879`: `buildSkiaFrameContent`
- `apps/builder/src/builder/workspace/canvas/skia/SkiaCanvas.tsx:916`: `buildFrameRenderPlan`
- `apps/builder/src/builder/workspace/canvas/skia/SkiaRenderer.ts:1013`: 이후의 frame classification

따라서 우선 검증할 가설은 다음과 같다.

> GPU content cache가 hit하더라도 cache classification 이전의 CPU scene/plan 구축 비용을 매 RAF 지불하고 있을 수 있다.

이것은 코드 구조에서 도출한 측정 가설이며 아직 병목 판정은 아니다. 기존 `render.content.build`, `render.plan.build`, `render.skia.draw` 측정값의 p95/p99로 판단해야 한다.

## 2. Zustand 최적화

Zustand는 domain state에는 적합하지만 프레임 단위 데이터 버스로 사용하면 store notification과 React render fan-out이 발생할 수 있다.

### 권장 패턴

- `pointermove`, camera, drag delta, animation progress는 ref 또는 imperative presentation 계층에서 관리한다.
- 최종 drop, selection 변경, property commit은 Zustand와 history에 반영한다.
- React 컴포넌트에서는 `useStore((state) => state.foo)`처럼 필요한 scalar만 구독한다.
- 전체 store를 구독하거나 selector에서 매번 객체, 배열, `Map`, `Set`을 생성하지 않는다.
- 파생값은 revision 기반 cache로 안정적인 identity를 제공한다.
- 고빈도 consumer는 `subscribeWithSelector`로 필요한 값만 받아 ref를 갱신하고 React render를 피한다.
- 관련 상태 변경은 의미적으로 가능한 범위에서 한 번의 mutation으로 합쳐 notification 횟수를 줄인다.
- FPS와 통계는 RAF마다 store에 쓰지 않고 250~1000ms 단위로 sampling한다.
- subscription은 unmount/dispose 시 반드시 해제한다.

Zustand 공식 문서는 빈번한 변경에 대해 `subscribe()`로 view를 직접 갱신하는 transient update가 큰 성능 차이를 만들 수 있다고 설명한다. 일반 Zustand 문서는 computed object에 `useShallow`를 제안하지만 Composition의 로컬 규칙은 group selector와 `useShallow` 패턴을 제한하므로 scalar selector 또는 안정적으로 cache된 derived snapshot이 더 적합하다.

현재 readiness 경로처럼 제출 대기 중에만 Zustand를 확인하고 성공 후 관련 ref를 비워 이후 RAF 접근을 제거하는 방식은 적절하다.

## 3. React 최적화

React 최적화는 다음 순서로 진행한다.

1. 전체 store 구독과 상위 컴포넌트 갱신을 제거한다.
2. component boundary와 props identity를 안정화한다.
3. React Performance Tracks와 Profiler로 실제 render/commit 비용을 측정한다.
4. 비용이 확인된 컴포넌트에만 `memo`, `useMemo`, `useCallback`을 적용한다.
5. Inspector 검색, 대형 panel 전환 등 비긴급 UI에만 `startTransition`을 검토한다.

### 주의점

- `memo`는 계산을 무료로 만들지 않는다. props 비교 비용이 rendering 비용보다 클 수 있다.
- inline object/function을 무조건 memoization하면 코드 복잡도와 cache 유지 비용만 늘 수 있다.
- `startTransition`은 계산을 빠르게 하지 않는다. update를 낮은 우선순위와 interruptible work로 바꾼다.
- camera, drag, selection feedback, Skia readiness처럼 즉시성과 순서가 중요한 값에는 Transition을 사용하지 않는다.
- 개발 모드의 Strict Mode와 instrumentation overhead를 최종 성능 수치로 사용하지 않는다.
- production build와 고정 fixture에서 다시 측정한다.

## 4. CanvasKit/Skia CPU 최적화

CPU 경로에서는 GPU draw call 이전의 작업을 먼저 분해한다.

- canonical lookup은 O(1) index와 versioned snapshot을 사용한다.
- 단일 노드 read를 위해 전체 document projection이나 반복 DFS를 수행하지 않는다.
- frame마다 scene graph, render command, 배열, 객체, `Map`을 재생성하지 않는다.
- structural sharing과 revision을 사용해 unchanged subtree를 재사용한다.
- layout-affecting 변경과 paint-only 변경을 구분한다.
- full layout rebuild는 엔진 계약상 필요한 경우에만 수행한다.
- text shaping과 측정 결과를 cache하되 CanvasKit WASM 객체의 소유권 및 해제를 명확히 한다.
- hover/selection overlay 변경 때문에 content command stream 전체를 다시 만들지 않는다.
- viewport culling과 damage bounds 계산이 full traversal보다 비싸지 않은지 함께 측정한다.

## 5. CanvasKit/Skia GPU 최적화

GPU 측에서는 다음 순서가 일반적으로 효과가 크다.

1. 정적 content와 자주 변하는 overlay를 별도 retained surface 또는 picture로 유지한다.
2. camera-only 변경은 기존 snapshot의 transform/blit으로 처리한다.
3. damage bounds가 있으면 변경 영역만 다시 기록한다.
4. viewport 밖 노드는 GPU command 생성 전 단계에서 culling한다.
5. image decode와 texture upload를 frame hot path에서 제거한다.
6. 불필요한 offscreen surface, snapshot, full-canvas clear, overdraw를 줄인다.
7. 변경된 surface만 flush한다.
8. `readPixels`나 동기 GPU 결과 조회처럼 pipeline을 막는 처리를 피한다.

CanvasKit의 `Paint`, `Path`, `Image`, `Surface`처럼 `new` 또는 `Make*`로 생성한 WASM 객체는 JavaScript GC가 자동 해제하지 않는다. 장기 재사용 객체와 frame-local 객체의 소유권을 구분하고 종료 시 `delete()`해야 한다.

현재 Composition의 content surface와 overlay 분리는 Chrome Performance Insights 팀이 공개한 layered canvas 최적화 방향과 일치한다. 다음 단계는 cache 존재 여부보다 cache hit 이전 CPU 비용과 실제 hit ratio를 확인하는 것이다.

## 6. CPU와 GPU 시간을 분리하는 방법

`surface.flush()` 시간만으로 GPU 시간을 판단하면 안 된다. CanvasKit의 공식 benchmark 설명에 따르면 `flush()`는 명령을 GPU에 보낸 뒤 반환하며 GPU가 실제로 완료됐는지는 그 시점에 알 수 없다.

- `draw + flush`가 느림: JavaScript, WASM 또는 command submission 병목 가능성
- 전체 frame interval은 긴데 `draw + flush`는 짧음: GPU 병목 가능성
- 두 값이 모두 김: CPU와 GPU가 함께 포화됐을 가능성

Composition에는 `EXT_disjoint_timer_query_webgl2`를 사용하는 비차단 GPU timer가 구현되어 있다.

- `apps/builder/src/builder/workspace/canvas/skia/gpuTimer.ts`
- 결과가 준비되기 전에는 동기 대기하지 않는다.
- in-flight query는 제한한다.
- `GPU_DISJOINT_EXT`가 발생한 sample은 폐기한다.

### Readiness 의미

`Surface.flush()` 성공은 GPU command **제출 완료**에 가깝다. 반드시 사용자의 모니터에 해당 pixel이 scanout됐다는 의미는 아니다.

따라서 현재 readiness 계약은 다음과 같이 표현하는 것이 정확하다.

> matching project/document revision의 Skia surface submission이 성공했다.

RAF callback 실행만으로 ready 처리하거나 timeout으로 성공 처리해서는 안 된다.

## 7. 측정 프로토콜

### 환경 고정

- Builder 탭을 foreground로 유지한다.
- production build를 사용한다.
- 동일 fixture, viewport, DPR, zoom을 사용한다.
- 60Hz와 고주사율 환경을 구분한다.
- cold start와 warm cache를 구분한다.
- 개발용 monitor 자체의 RAF와 Zustand update가 측정 결과를 오염하지 않는지 확인한다.

### 시나리오

- idle
- pan
- zoom
- page drag
- element drag
- selection/hover
- Inspector property edit
- project load와 first Skia submission
- animation active/cleanup

### 기록할 지표

- frame interval p50/p95/p99
- `render.frame`
- `render.content.build`
- `render.plan.build`
- `render.skia.draw`
- React render/commit duration
- layout engine duration과 full/incremental rebuild 횟수
- GPU timer p50/p95/p99
- content cache hit/miss와 invalidation reason
- frame당 Zustand mutation 및 React commit 횟수
- WASM heap과 GPU resource 증가 추세
- dropped frame 비율과 Long Animation Frame attribution

평균 FPS만 사용하면 드문 긴 stall을 숨긴다. frame time percentile과 최악의 interaction trace를 함께 보아야 한다.

## 8. Worker와 OffscreenCanvas 적용 기준

Worker 이전은 첫 번째 최적화가 아니라 마지막 구조적 선택으로 둔다.

적용 조건은 다음과 같다.

- profile에서 main-thread scene/layout/command build가 명확한 지배 병목이다.
- worker에 보낼 데이터가 전체 mutable object graph가 아니라 revisioned snapshot 또는 transferable command buffer다.
- serialization 및 message latency가 절감할 계산 비용보다 작다.
- CanvasKit, FontMgr, image resource의 worker ownership을 명확히 할 수 있다.
- DOM overlay와 hit testing이 동일 frame snapshot을 유지할 수 있다.
- context loss와 resource disposal을 worker 경계에서도 복구할 수 있다.

OffscreenCanvas는 WebGL과 WebAssembly rendering을 worker event loop에서 수행할 수 있지만, 잘못 적용하면 scene 복사와 동기화 비용이 새로운 병목이 된다.

## Composition 실행 우선순위

1. `renderFrameCore`의 idle CPU 비용을 실측한다.
2. content/plan 구축 전 dirty classification이 가능한지 검증한다.
3. 단일 pending RAF와 on-demand scheduling을 도입할 수 있는지 설계한다.
4. camera/drag/hover 경로의 React 및 Zustand fan-out이 0인지 확인한다.
5. content, overlay, damage cache의 hit ratio와 invalidation reason을 분석한다.
6. layout과 canonical lookup의 반복 DFS, full projection, 배열/Map 재생성을 제거한다.
7. GPU timer로 CPU submission과 GPU execution을 분리한다.
8. 위 조치 후에도 CPU가 지배적일 때만 Worker/OffscreenCanvas를 검토한다.

## 완료 조건 예시

- idle 상태에서 scene/plan rebuild가 발생하지 않는다.
- 한 display frame에 application render submission은 최대 한 번이다.
- pointer/camera/drag transient update가 React commit을 유발하지 않는다.
- RAF마다 Zustand mutation을 수행하지 않는다.
- content-only, overlay-only, camera-only invalidation이 서로 분리된다.
- foreground production trace에서 주요 시나리오의 p95/p99가 정의된 frame budget을 만족한다.
- CPU와 GPU 회귀 gate가 별도로 존재한다.
- readiness는 matching project/document의 성공한 Skia submission으로만 완료된다.

## 공식 레퍼런스

### React

- [React Performance Tracks](https://react.dev/reference/dev-tools/react-performance-tracks)
- [React Profiler](https://react.dev/reference/react/Profiler)
- [React memo](https://react.dev/reference/react/memo)
- [React startTransition](https://react.dev/reference/react/startTransition)
- [React useSyncExternalStore](https://react.dev/reference/react/useSyncExternalStore)
- [React Render and Commit](https://react.dev/learn/render-and-commit)

### Zustand

- [Zustand README — transient updates](https://github.com/pmndrs/zustand/blob/main/README.md#transient-updates-for-often-occurring-state-changes)
- [Zustand subscribeWithSelector](https://zustand.docs.pmnd.rs/reference/middlewares/subscribe-with-selector)
- [Zustand prevent rerenders](https://zustand.docs.pmnd.rs/learn/guides/prevent-rerenders-with-use-shallow)

### CanvasKit · Skia · WebGL

- [CanvasKit Quickstart](https://skia.org/docs/user/modules/quickstart/)
- [CanvasKit official performance benchmark](https://skia.googlesource.com/skia/+/3b13de2073cd/tools/perf-canvaskit-puppeteer/render-skp.html)
- [CanvasKit — Skia + WebAssembly](https://skia.org/docs/user/modules/canvaskit/)
- [Tracing Skia Execution](https://skia.org/docs/dev/tools/tracing/)
- [EXT_disjoint_timer_query_webgl2 specification](https://registry.khronos.org/webgl/extensions/EXT_disjoint_timer_query_webgl2/)

### Chrome · Web Platform

- [Chrome DevTools Performance](https://developer.chrome.com/docs/devtools/performance)
- [Long Animation Frames API](https://developer.chrome.com/docs/web-platform/long-animation-frames)
- [Chrome Performance Insights layered canvas 사례](https://developer.chrome.com/blog/performance-insights)
- [OffscreenCanvas HTML Standard](https://html.spec.whatwg.org/multipage/canvas.html#the-offscreencanvas-interface)
- [Chromium RenderingNG architecture](https://developer.chrome.com/docs/chromium/renderingng-architecture)

## 결론

Composition의 최적화 방향은 다음 한 문장으로 정리할 수 있다.

> Canonical state 변경은 semantic commit으로 제한하고, transient presentation은 최신값만 유지하며, 하나의 frame coordinator가 dirty layer만 구축하고 한 번 제출한다.

현재 retained surface, shared frame snapshot, damage invalidation, non-blocking GPU timer는 올바른 기반이다. 다음으로 확인해야 할 가장 큰 기회는 항상 실행되는 RAF에서 renderer classification 전에 반복되는 content/plan CPU 작업을 줄이는 것이다.
