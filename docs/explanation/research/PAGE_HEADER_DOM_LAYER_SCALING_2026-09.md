# 페이지 헤더 DOM 층의 페이지 수 확장성 — 현행 방어 · 남은 병목 · 외부 사례

> **작성일**: 2026-09-19
> **배경**: ADR-221 (2026-09-17 Implemented) 이 페이지 헤더를 Skia 에서 DOM 층으로 옮겼다. 액션바 (ADR-192) 는 그전부터 DOM. "페이지가 많아지면 DOM 층이 성능 문제를 내지 않는가" 를 현행 코드 실측 + 외부 사례로 정리한 조사 문서 — **코드 변경 0**.
> **관련**: [ADR-221](../../adr/completed/221-canvas-page-header-dom-layer.md) · [221-p3-after-baseline.md](../../adr/evidence/221-p3-after-baseline.md) (22 페이지 G2 실측) · [BUILDER_PERF_BASELINE_2026-09.md](./BUILDER_PERF_BASELINE_2026-09.md) (하니스) · 메모리 `multipage`

---

## 0. 결론

현재 구조는 **뷰포트 안 페이지만 DOM 노드** + **카메라 제스처 중 DOM 쓰기 0** 두 방어를 갖고 있어, 비용은 페이지 총수 N 이 아니라 **뷰포트 안에 보이는 페이지 수 V** 에 비례한다. 22 페이지 G2 실측에서 render.frame p95 는 평탄/개선. 남은 위험은 **V 자체가 커지는 경우 하나** — 줌아웃해서 100~300 페이지가 한 화면에 들어올 때 — 이다. 외부 사례는 같은 구현을 쓰지 않는다: tldraw 는 viewport culling, 선택/편집 예외, 안정 zoom (`debouncedZoom`) 과 일부 효과 LOD (`textShadowLod`) 를 제공하고, React Flow 공식 가이드는 빈번한 node 배열 구독 회피 · 큰 트리 hidden · 복잡한 style 단순화를 권한다. 아래 줌 임계 미마운트는 이 원칙을 Composition 에 적용해 본 **추론적 후보**였으며 공식 가이드의 직접 처방은 아니다. 액션바는 선택당 1 노드라 페이지 수와 무관하다.

**2026-09-19 실측 (§4-1 결과)**: 빌더 줌 하한 0.1 · 1440×900 에서 V 상한은 **60** (200 페이지 문서) — V=300 은 4K 급 뷰포트가 있어야 나온다. 레이어/GPU (§2-1) 와 드래그 occlusion (§2-2) 은 V=60 에서 병목이 아니고, **제스처 중 헤더 mount/unmount (§2-3) 는 실제로 돈다** (줌 1 · 50p 수평 pan 4/4 · 줌 0.1 · 200p 3 s 에 200/240) 는 것이 G2 가 못 본 비용이다. 다만 25 ms 초과 프레임 0 · longtask 0 이라 깨지는 시나리오는 없고, 4-2 줌 LOD 만 착수 사유가 성립한다 (MEDIUM · 긴급 아님).

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

| #   | 비용                                                                                                                                                                         | 근거                                                                                                                                                   | 규모 (V=300 가정)                                                                                                                         |
| --- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | **V 개 합성 레이어** — `.page-header { will-change: transform }` 이 헤더마다 레이어 승격                                                                                     | `PageHeaderLayer.css`                                                                                                                                  | 레이어 300 → GPU 텍스처 메모리 · 타일 eviction (첫 병목 후보). **실측 09-19: V=60 에서 헤더 레이어 47 · 2.7 MB (전체의 2 %) — 병목 아님** |
| 2   | **occlusion O(V²)** — 헤더마다 `occluders.slice(index+1)` 순회. settle 1회는 무시 가능하지만 **페이지 드래그 중엔 매 프레임 전량 재배치**                                    | `usePageHeaderPlacement.ts` `onFrame` (주석: "전체 재배치로 clip 을 매 프레임 재계산")                                                                 | 프레임당 ~45k rect 연산 + V 개 인라인 style 비교. **실측 09-19: V=60 드래그에서 style 쓰기 4.0/move (V 무관) · self-time 0.7 %**          |
| 3   | **React mount/unmount 갈아타기 (줌 1 에서 pan)** — 페이지가 200px 마진을 넘나들 때마다 `transientVisiblePageIds` 변경 → 항목 마운트/언마운트 (div + span + RAC 버튼 2 + svg) | `BuilderCanvas.tsx:641-690`. G2 는 **attribute 변경만** 셌고 childList 는 안 봤다 — 10% 줌 arm 은 전 페이지가 뷰포트 안이라 이 경로가 아예 돌지 않았다 | **실측 09-19: 줌 1 · 50p 수평 pan 3 s 에 4/4, 줌 0.1 · 200p 에 200/240 — 돈다 (§4-1 결과)**                                               |
| 4   | `currentPageId` 변경 시 V 개 reorder — `orderPagesForPaint` 가 활성 페이지를 끝으로, keyed 이동 1회                                                                          | `PageHeaderLayer.tsx` `ordered`                                                                                                                        | 무시 가능                                                                                                                                 |

Skia 시절과의 구조적 차이: Skia 텍스트는 줌에 따라 자연 축소됐지만 DOM 헤더는 **역스케일 (화면 고정 크기)** 이라 줌아웃할수록 V 개 정규 크기 노드가 그대로 남는다. 1 · 2 · 3 모두 이 성질에서 나온다.

## 3. 외부 사례

| 도구                          | 페이지/프레임 라벨 위치                                    | 스케일 대응                                                                                                                                                                                                                                                                                                                                                                                                                              |
| ----------------------------- | ---------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **tldraw**                    | shape 전부 HTML/SVG DOM (라벨 포함)                        | R-tree 공간 인덱스 + `display:none` 컬링 ("10,000 shapes → 50 render") · `CullingController` 하나가 React 우회 직접 DOM 쓰기 · `debouncedZoomThreshold` (500 shape 초과 시 카메라 이동 중 줌 값 안정화) · LOD (`textShadowLod` 0.35 — 작은 줌에서 그림자·스트로크 단순화) · `maxShapesPerPage` 4000. 선택 indicator 는 DOM → canvas 로 이미 옮겼고 나머지 overlay 도 canvas 화 검토 (#8314: "per-overlay DOM 노드 · CSS transform 제거") |
| **React Flow**                | 노드 전부 DOM                                              | 공식 가이드는 빈번히 바뀌는 `nodes`/`edges` 배열 직접 구독 회피, 큰 트리의 `hidden`, 복잡한 style 단순화를 권한다. `onlyRenderVisibleElements` 와 semantic zoom/placeholder 는 외부 사례·적용 후보이지 공식 `Performance` 문서의 직접 처방으로 인용하지 않는다                                                                                                                                                                           |
| **Figma**                     | 전부 WebGL (자체 텍스트 엔진), DOM 라벨 없음               | 타일 기반 렌더러. "HTML/SVG 는 DOM 접근 때문에 canvas 보다 훨씬 느리고, 스크롤에 최적화돼 있지 줌에는 아니다"                                                                                                                                                                                                                                                                                                                            |
| **Penpot**                    | SVG DOM → Rust/Skia wasm 으로 이전 중                      | "DOM 은 줌·팬과 무관하게 모든 요소를 렌더한다 — 성능이 안 나온다". UI chrome 은 DOM 유지                                                                                                                                                                                                                                                                                                                                                 |
| **Excalidraw**                | static canvas + interactive canvas 2장                     | 프레임 이름은 canvas 텍스트; 빈번 갱신 층을 분리해 정적 층 재그리기 최소화                                                                                                                                                                                                                                                                                                                                                               |
| **Chrome HTML-in-Canvas API** | DOM 서브트리를 `drawElementImage` 로 canvas/WebGL 텍스처에 | Chrome 148–150 origin trial. "Figma/Miro/Docs 류가 앱 UI 를 canvas 안에서 네이티브 렌더" 가 목표 — 장기 대안, 아직 실전 불가                                                                                                                                                                                                                                                                                                             |

공통 결론: DOM 라벨은 **뷰포트 컬링 + React 우회 직접 쓰기** 까지는 모두 같고, 그 다음 단계는 **줌 임계 아래 LOD** 다. composition 은 첫 두 단계를 갖췄고 세 번째가 없다.

## 4. 권고 — 측정 먼저, 순서대로

### 4-1. 측정 확장 (코드 변경 0)

`pnpm perf:baseline -- --lane frame --pages 200 --zoom 0.1` 로 V=200 arm 을 추가하고 다음을 잰다 (0.05 는 빌더 `minZoom` 0.1 아래라 적용 불가 — `viewport/ViewportController.ts:72`). 이 수치 없이 4-2 ~ 4-4 는 착수 사유가 없다 (measurement-validity Q1).

- (a) 헤더 층 MutationObserver — **childList 포함** (§2-3 의 반증 케이스: 줌 1 · 페이지 50 · 수평 pan 에서 0 이 아니면 결함 승격, 0 이면 LOW deferred)
- (b) DevTools Layers 수 · GPU 메모리 (§2-1)
- (c) 페이지 드래그 중 render.frame p95 (§2-2)

#### 4-1 결과 — 2026-09-19 실측

같은 기기 · 같은 세션 · headed Chrome · viewport 1440×900 · DPR 1 · Navigator/Properties 열림 · CPU throttle 1. 원본: `docs/adr/evidence/page-header-scaling-2026-09/` (하니스 JSON 2 · probe JSON 3 · probe 스크립트 — `.gitignore` 정책상 local-only). 대조군 22 페이지는 09-17 G2 수치와 일치 (pan render.frame p95 1.3 · 할당 49.7 MB/s) — 측정 환경 동일성 확인.

**V 는 문서 크기가 아니라 뷰포트/줌 하한이 정한다.** 빌더 줌 하한 0.1 · 6열 시드 격자 (x 1200 · y 1100) · 1440×900 에서 200 페이지 문서의 마운트 헤더는 **60** 이다 (22 페이지 문서는 22). §2 의 "V=300 가정" 은 이 창에서 도달 불가 — 200 이 전부 한 화면에 들어오려면 4K 급 뷰포트가 필요하다. 아래 표의 "200p" 는 곧 **V=60** 이다.

| 항목                                                               |                       22p · 줌 0.1 (V=22) |                  200p · 줌 0.1 (V=60) |           50p · 줌 1 (V=1) |
| ------------------------------------------------------------------ | ----------------------------------------: | ------------------------------------: | -------------------------: |
| 하니스 pan — callback gap p95 / render.frame p95 / 할당 / GC       |           9.4 ms / 1.3 ms / 49.7 MB/s / 8 |    11.8 ms / 2.1 ms / 100.2 MB/s / 19 |                          — |
| 하니스 zoom — callback gap p95 / render.frame p95                  |                                 9.2 / 0.5 |                             9.5 / 0.5 |                          — |
| 하니스 idle — callback gap p95                                     |                                       9.3 |                                  10.5 |                          — |
| (b) 합성 레이어 총수 / 헤더 귀속                                   |                                   47 / 21 |                               73 / 47 |                     27 / 1 |
| (b) 헤더 텍스처 추정 (w·h·4, drawsContent 만) / 전체 drawsContent  |                         1.2 MB / 124.8 MB |                     2.7 MB / 144.9 MB |          0.9 MB / 127.3 MB |
| (a) 수평 휠 pan 3 s — 헤더 mount / unmount (childList)             |                                   76 / 95 |                             200 / 240 |                  **4 / 4** |
| (a) 수직 휠 pan 3 s — mount / unmount                              |                                   12 / 15 |                             140 / 134 |                    15 / 12 |
| (a) 제스처 중 헤더 attribute 쓰기 (게이트 밖 settle 1회 포함)      |                                         3 |                                    18 |                          3 |
| (c) 페이지 드래그 3 s — callback gap p95 / max                     |                            10.1 / 74.6 ms |                       10.5 / 199.2 ms |              9.1 / 80.1 ms |
| (c) 드래그 — render.frame p95 / 할당 / GC / longtask               |        1.5 ms / 42.7 MB/s / 5 / 1 (81 ms) | 2.6 ms / 104.2 MB/s / 16 / 2 (396 ms) | 1.1 ms / 25.8 MB/s / 3 / 0 |
| (c) 드래그 — 헤더 style 쓰기 / pointermove                         |                          1422 / 355 (4.0) |                      1219 / 301 (4.0) |            350 / 349 (1.0) |
| (c) 드래그 — `placePageHeaders` 계열 self-time (JS Self-Profiling) | collectNodes 1.1 % + writeTransform 0.8 % |                                 0.7 % |   pageHeaderScreenRect 1 % |

판정 (§2 항목별):

- **§2-3 mount/unmount 는 제스처 중에 실제로 돈다 — 반증 케이스 RED.** 줌 1 · 50 페이지 · 수평 pan 에서 4/4, 줌 0.1 에서는 3 s 에 200/240 (프레임당 ~1.2 회 childList). G2 ① 이 attribute 만 세어 못 본 경로가 맞다. 다만 **프레임 지표에서 깨지는 시나리오는 없다** — 200p pan 에서 25 ms 초과 프레임 0 · longtask 0 · 119.4 fps. V=22 → 60 에서 callback gap p95 +2.4 ms · 할당 2× · GC 2.4× 가 이 경로와 Skia 페이지 사각형 200개 (render.frame +0.8 ms) 의 합이며 둘을 이 측정으로는 가르지 못한다. review-loop-closure §2 기준으로 **MEDIUM (production 재현 = 120 Hz 에서 p95 가 1 vsync 8.3 ms 를 22p 에서도 이미 넘고 있어 회귀선이 아니라 누적선)** — 4-2 줌 LOD 의 착수 사유는 성립하되 긴급은 아니다.
- **§2-1 레이어 · GPU 메모리 — 병목 아님 (V=60).** 헤더 레이어 47 (마운트 60 중 완전 clip 된 13 은 레이어 없음) · 텍스처 추정 2.7 MB 로 전체 145 MB 의 2 %. 4-3 (`will-change` 제거) 은 이 창에서 측정 가능한 이득이 없다 — 4K 뷰포트 실측 전에는 착수 사유 없음.
- **§2-2 드래그 중 O(V²) occlusion — V=60 에서 비가시.** 헤더 style 쓰기는 V 와 무관하게 pointermove 당 4.0 (값 변경 가드가 동작) 이고 placement self-time 0.7 %. 드래그 프로파일 1위는 `resolveAxisSpacingSnap` (snapGuides.ts:193, 3 %) — 페이지 200 개를 상대로 한 스냅 후보 계산이며 헤더 층이 아니다. 4-4 착수 사유 없음.
- **§2-4 활성 페이지 reorder — 1회 확인.** 드래그 시작에 childList V−2 (58 · 20) 한 번.
- **부수 관찰 (헤더 층 밖)**: 200p 드래그 시작 1.4 s 안에 199 / 125 / 153 ms 스파이크 3 (longtask 2 · 396 ms), 22p 는 74.6 ms 1회. 페이지 수에 비례하는 드래그 시작 비용이 있다 — 후보는 스냅 후보 계산 · 할당 (104 MB/s) 의 GC. 이 문서 범위 밖, 별도 조사 항목.

### 4-2. 줌 LOD 후보 (외부 원칙의 Composition 적용안)

헤더의 화면 높이가 임계 (예: 타이틀 12px 미만으로 읽히는 줌) 아래면 헤더 노드를 마운트하지 않거나 타이틀 없는 띠 하나로 축약 — V 가 폭발하는 유일한 경로를 끊는 후보였다. React Flow 공식 문서는 저줌 미마운트를 직접 규정하지 않고, tldraw culled shape 도 placeholder 로 교체되지 않고 DOM 에 남아 `display:none` 이 된다. 선택·편집 shape 는 컬링에서 제외된다.

→ **[ADR-226](../../adr/226-page-header-zoom-lod.md) Proposed (2026-09-19)**: 실측이 겨눈 비용은 줌이 아니라 **제스처 중 mount/unmount** 라 (줌 1 에서도 4/4) 줌 임계 미마운트는 기각하고, 제스처 중 프레임 집합 동결 + 헤더 폭 티어 (`< 96 px` compact) 를 채택. 개수 cap · hidden 티어는 V ≥ 150 실측 후 재개.

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
