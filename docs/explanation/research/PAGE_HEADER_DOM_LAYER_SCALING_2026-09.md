# 페이지 헤더 DOM 층의 페이지 수 확장성 — 현행 방어 · 남은 병목 · 외부 사례

> **작성일**: 2026-09-19
> **배경**: ADR-221 (2026-09-17 Implemented) 이 페이지 헤더를 Skia 에서 DOM 층으로 옮겼다. 액션바 (ADR-192) 는 그전부터 DOM. "페이지가 많아지면 DOM 층이 성능 문제를 내지 않는가" 를 현행 코드 실측 + 외부 사례로 정리한 조사 문서 — **코드 변경 0**.
> **관련**: [ADR-221](../../adr/completed/221-canvas-page-header-dom-layer.md) · [221-p3-after-baseline.md](../../adr/evidence/221-p3-after-baseline.md) (22 페이지 G2 실측) · [BUILDER_PERF_BASELINE_2026-09.md](./BUILDER_PERF_BASELINE_2026-09.md) (하니스) · 메모리 `multipage`

---

## 0. 결론

현재 구조는 **뷰포트 안 페이지만 DOM 노드** + **카메라 제스처 중 DOM 쓰기 0** 두 방어를 갖고 있어, 비용은 페이지 총수 N 이 아니라 **뷰포트 안에 보이는 페이지 수 V** 에 비례한다. 22 페이지 G2 실측에서 render.frame p95 는 평탄/개선. 남은 위험은 **V 자체가 커지는 경우 하나** — 줌아웃해서 100~300 페이지가 한 화면에 들어올 때 — 이고, 외부 사례 (tldraw · React Flow) 도 정확히 이 지점을 줌 임계 LOD 로 막는다. 액션바는 선택당 1 노드라 페이지 수와 무관하다.

## 1. 현행 코드가 이미 하는 것

| 방어                                                                                     | 위치                                                      | 효과                                                  |
| ---------------------------------------------------------------------------------------- | --------------------------------------------------------- | ----------------------------------------------------- |
| 뷰포트 컬링 (200px 마진) — 헤더 노드는 `visiblePageFrames` 만 마운트                     | `BuilderCanvas.tsx:1648` · `scene/buildVisiblePageSet.ts` | 노드 수 = V, N 무관                                   |
| 카메라 제스처 게이트 — pan/zoom 중 층 `data-hidden` + DOM 쓰기 0, 종료 시 `placeAll` 1회 | `overlay/pageHeader/usePageHeaderPlacement.ts`            | 22p · 10% 줌 MutationObserver attribute 변경 0 (G2 ①) |
| 배치는 React state 가 아니라 transform 직접 쓰기 (값이 바뀔 때만)                        | `placePageHeaders`                                        | tldraw `useQuickReactor` 와 같은 패턴                 |
| 항목 `memo` + 층 `contain: layout style` + 층 `pointer-events: none`                     | `PageHeaderLayer.tsx:210` · `PageHeaderLayer.css`         | 재조정 · hit 비용 최소                                |
| 액션바는 선택당 1 노드                                                                   | `components/overlay/actionBar/useActionBarPlacement.ts`   | 페이지 수 무관                                        |

G2 ② (22 페이지, 이관 전/후 같은 기기 · 같은 명령): adverse pan render.frame p95 1.5 → 1.3 ms, default zoom 3.4 → 3.3 ms. callback gap +1 ms 는 idle 포함 균일 = 환경 기저 (evidence 문서 주).

## 2. 페이지 수가 커질 때 실제로 자라는 비용 (코드 기준)

| #   | 비용                                                                                                                                                                         | 근거                                                                                                                                                   | 규모 (V=300 가정)                                             |
| --- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------- |
| 1   | **V 개 합성 레이어** — `.page-header { will-change: transform }` 이 헤더마다 레이어 승격                                                                                     | `PageHeaderLayer.css`                                                                                                                                  | 레이어 300 → GPU 텍스처 메모리 · 타일 eviction (첫 병목 후보) |
| 2   | **occlusion O(V²)** — 헤더마다 `occluders.slice(index+1)` 순회. settle 1회는 무시 가능하지만 **페이지 드래그 중엔 매 프레임 전량 재배치**                                    | `usePageHeaderPlacement.ts` `onFrame` (주석: "전체 재배치로 clip 을 매 프레임 재계산")                                                                 | 프레임당 ~45k rect 연산 + V 개 인라인 style 비교              |
| 3   | **React mount/unmount 갈아타기 (줌 1 에서 pan)** — 페이지가 200px 마진을 넘나들 때마다 `transientVisiblePageIds` 변경 → 항목 마운트/언마운트 (div + span + RAC 버튼 2 + svg) | `BuilderCanvas.tsx:641-690`. G2 는 **attribute 변경만** 셌고 childList 는 안 봤다 — 10% 줌 arm 은 전 페이지가 뷰포트 안이라 이 경로가 아예 돌지 않았다 | 미측정 (§4-1 반증 케이스)                                     |
| 4   | `currentPageId` 변경 시 V 개 reorder — `orderPagesForPaint` 가 활성 페이지를 끝으로, keyed 이동 1회                                                                          | `PageHeaderLayer.tsx` `ordered`                                                                                                                        | 무시 가능                                                     |

Skia 시절과의 구조적 차이: Skia 텍스트는 줌에 따라 자연 축소됐지만 DOM 헤더는 **역스케일 (화면 고정 크기)** 이라 줌아웃할수록 V 개 정규 크기 노드가 그대로 남는다. 1 · 2 · 3 모두 이 성질에서 나온다.

## 3. 외부 사례

| 도구                          | 페이지/프레임 라벨 위치                                    | 스케일 대응                                                                                                                                                                                                                                                                                                                                                                                                                              |
| ----------------------------- | ---------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **tldraw**                    | shape 전부 HTML/SVG DOM (라벨 포함)                        | R-tree 공간 인덱스 + `display:none` 컬링 ("10,000 shapes → 50 render") · `CullingController` 하나가 React 우회 직접 DOM 쓰기 · `debouncedZoomThreshold` (500 shape 초과 시 카메라 이동 중 줌 값 안정화) · LOD (`textShadowLod` 0.35 — 작은 줌에서 그림자·스트로크 단순화) · `maxShapesPerPage` 4000. 선택 indicator 는 DOM → canvas 로 이미 옮겼고 나머지 overlay 도 canvas 화 검토 (#8314: "per-overlay DOM 노드 · CSS transform 제거") |
| **React Flow**                | 노드 전부 DOM                                              | `onlyRenderVisibleElements` 뷰포트 가상화. 한계 명시: **줌아웃해 전부 보이면 가상화가 무력** → "Semantic zoom / LOD — 줌 임계 아래서 placeholder 노드로 교체" 가 권장 해법                                                                                                                                                                                                                                                               |
| **Figma**                     | 전부 WebGL (자체 텍스트 엔진), DOM 라벨 없음               | 타일 기반 렌더러. "HTML/SVG 는 DOM 접근 때문에 canvas 보다 훨씬 느리고, 스크롤에 최적화돼 있지 줌에는 아니다"                                                                                                                                                                                                                                                                                                                            |
| **Penpot**                    | SVG DOM → Rust/Skia wasm 으로 이전 중                      | "DOM 은 줌·팬과 무관하게 모든 요소를 렌더한다 — 성능이 안 나온다". UI chrome 은 DOM 유지                                                                                                                                                                                                                                                                                                                                                 |
| **Excalidraw**                | static canvas + interactive canvas 2장                     | 프레임 이름은 canvas 텍스트; 빈번 갱신 층을 분리해 정적 층 재그리기 최소화                                                                                                                                                                                                                                                                                                                                                               |
| **Chrome HTML-in-Canvas API** | DOM 서브트리를 `drawElementImage` 로 canvas/WebGL 텍스처에 | Chrome 148–150 origin trial. "Figma/Miro/Docs 류가 앱 UI 를 canvas 안에서 네이티브 렌더" 가 목표 — 장기 대안, 아직 실전 불가                                                                                                                                                                                                                                                                                                             |

공통 결론: DOM 라벨은 **뷰포트 컬링 + React 우회 직접 쓰기** 까지는 모두 같고, 그 다음 단계는 **줌 임계 아래 LOD** 다. composition 은 첫 두 단계를 갖췄고 세 번째가 없다.

## 4. 권고 — 측정 먼저, 순서대로

### 4-1. 측정 확장 (코드 변경 0)

`pnpm perf:baseline -- --lane frame --pages 200 --zoom 0.05` 로 V=200 arm 을 추가하고 다음을 잰다. 이 수치 없이 4-2 ~ 4-4 는 착수 사유가 없다 (measurement-validity Q1).

- (a) 헤더 층 MutationObserver — **childList 포함** (§2-3 의 반증 케이스: 줌 1 · 페이지 50 · 수평 pan 에서 0 이 아니면 결함 승격, 0 이면 LOW deferred)
- (b) DevTools Layers 수 · GPU 메모리 (§2-1)
- (c) 페이지 드래그 중 render.frame p95 (§2-2)

### 4-2. 줌 LOD (React Flow 권장 패턴)

헤더의 화면 높이가 임계 (예: 타이틀 12px 미만으로 읽히는 줌) 아래면 헤더 노드를 마운트하지 않거나 타이틀 없는 띠 하나로 축약 — V 가 폭발하는 유일한 경로를 끊는다.

### 4-3. `will-change: transform` 제거 또는 활성 헤더만

정적 배치 (settle 1회) 라 레이어 승격의 이득이 거의 없고 V 개 텍스처 비용만 남는다. 드래그 중인 페이지 헤더만 인라인으로 켜면 충분.

### 4-4. 드래그 중 occlusion 을 활성 집합에 국한

`activeOverrides` 에 든 페이지와 겹치는 헤더만 clip 재계산 (현재 전량 O(V²)).

### 4-5. 장기

페이지 수천 규모가 실제 요구가 되더라도 라벨을 Skia 로 되돌리는 것은 답이 아니다 (ADR-221 이 그 반대를 택한 이유 = 유지보수 H — 아이콘 · hover · 툴팁 · 지역 변수를 JS 로 재구현). HTML-in-Canvas 정식 출시 시점에 재검토.

## 5. 출처

- tldraw: [Culling](https://tldraw.dev/sdk-features/culling) · [Performance](https://tldraw.dev/sdk-features/performance) · [#8314 overlays → canvas](https://github.com/tldraw/tldraw/issues/8314) · [culling internals (DeepWiki)](https://deepwiki.com/tldraw/tldraw/3.4-shape-rendering-and-culling)
- React Flow: [Performance](https://reactflow.dev/learn/advanced-use/performance) · [xyflow #3883 onlyRenderVisibleElements](https://github.com/xyflow/xyflow/issues/3883) · [Architecting for Massive Scale in React Flow](https://www.visualflow.dev/blogs/scale-studio-pro)
- Figma: [Building a professional design tool on the web](https://www.figma.com/blog/building-a-professional-design-tool-on-the-web/) · [Figma Rendering: Powered by WebGPU](https://www.figma.com/blog/figma-rendering-powered-by-webgpu/)
- Penpot: [It's time for Penpot to (almost) move away from the DOM](https://community.penpot.app/t/its-time-for-penpot-to-almost-move-away-from-the-dom/6437) · [Penpot's new rendering system](https://penpot.app/blog/penpots-new-rendering-system/)
- Excalidraw: [rendering pipeline (DeepWiki)](https://deepwiki.com/excalidraw/excalidraw/5.1-canvas-rendering-pipeline) · [#10063 Canvas Rendering Performance Optimization](https://github.com/excalidraw/excalidraw/issues/10063)
- Chrome 레이어: [web.dev — manage layer count](https://developers.google.com/web/fundamentals/performance/rendering/stick-to-compositor-only-properties-and-manage-layer-count) · [GPU memory limits in Chrome compositing](https://www.browser-rendering.com/compositing-and-gpu-acceleration/hardware-acceleration-limits/gpu-memory-limits-in-chrome-compositing/)
- [Chrome: HTML-in-Canvas API origin trial](https://developer.chrome.com/blog/html-in-canvas-origin-trial)
