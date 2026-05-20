# OpenPencil 2종 ↔ composition 렌더링 3-Way 비교

> **분석 일자**: 2026-05-20
> **분석 대상**:
>
> - **OpenPencil-Z**: `/Users/admin/work/openpencil` (ZSeven-W, v0.7.5) — `OPENPENCIL_ANALYSIS.md` 참조
> - **OpenPencil-D**: `/Users/admin/work/open-pencil` (Danila Poyarkov, v0.12.2, Figma 호환 포크) — `OPEN_PENCIL_FIGMA_FORK_ANALYSIS.md` 참조
> - **composition**: in-tree (`apps/builder/src/builder/workspace/canvas/skia/**`)
>
> **사용자 framing**: 두 OpenPencil 은 모두 pencil app 을 카피하여 만든 변종 (같은 출발점에서 갈라짐)
> **이 문서의 scope**: 렌더링 파이프라인 3-way 비교 + composition 측 차용 검토 우선순위
> **목적**: 후속 ADR / 결정의 input
> **다른 분석과의 관계**:
>
> - `OPENPENCIL_ANALYSIS.md`, `OPEN_PENCIL_FIGMA_FORK_ANALYSIS.md` 는 각 프로젝트의 2-way 분석 (composition 과 양자 비교)
> - 본 문서는 **3-way 통합** + composition 측 실 코드 fact-check 정정 반영

---

## 0. Fact-check 정정 (Explore agent 확인, 2026-05-20)

기존 두 분석 문서는 composition 측 사실 일부가 stale. 본 문서의 비교표는 정정된 사실 기준.

| 영역             | 기존 분석 문서                      | 실제 코드 (2026-05-20)                                                                                                                                                                                      |
| ---------------- | ----------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Hit-test         | "boundsMap traverse + tree"         | **Rust WASM SpatialIndex**, 그리드 기반 (CELL_SIZE=256)<br>`canvas/wasm-bindings/spatialIndex.ts:28,76`                                                                                                     |
| 텍스트 캐시      | "결과 `{width,height}` dict 만 LRU" | **Paragraph 객체 자체 Map LRU**, `clearParagraphCache()` 진입점 존재<br>`skia/nodeRendererText.ts:36,63-86`                                                                                                 |
| Render trigger   | "layoutVersion 단일 카운터"         | **registryVersion** 카운터 + RAF 루프<br>(`layoutVersion` 은 레이아웃 invalidation 카운터로 별도 존재, `sceneVersion` 은 ADR-135/136 projection 시그널) `skia/SkiaCanvas.tsx:446`, `skia/useSkiaNode.ts:72` |
| Viewport culling | 분석 문서 "✅"                      | `cullingBounds` 인자는 일부 함수에 전달되지만, **renderCommands 안에서 viewport 밖 노드 skip 명시 로직 미확인** — Skia 자체 clipRect 에 위임 추정. `skia/gridRenderer.ts:23-24`, `skia/export.ts:79-80`     |

---

## 1. 3-Way 정체성 / 목표 / 베이스

| 측면            | OpenPencil-Z<br>(ZSeven-W, `openpencil`)              | OpenPencil-D<br>(Danila, `open-pencil`)      | composition                                                         |
| --------------- | ----------------------------------------------------- | -------------------------------------------- | ------------------------------------------------------------------- |
| 버전            | v0.7.5                                                | v0.12.2                                      | (in-tree)                                                           |
| 베이스 (사용자) | pencil app 카피                                       | pencil app 카피                              | RAC + Spec SSOT 자체 설계                                           |
| 목표            | AI-네이티브 벡터 디자인 도구 (Concurrent Agent Teams) | Figma 호환 디자인 에디터 (.fig 라운드트립)   | 노코드 웹 빌더 (React Aria Components → DOM/Preview + Skia/Builder) |
| 출력물          | `.op` JSON + 코드 생성 (React/Vue/Flutter/...)        | `.fig` + `.pen` + JSX/Tailwind 코드 생성     | canonical document → Supabase + Preview iframe DOM                  |
| UI 프레임워크   | React 19 (TanStack Start + Vite 7)                    | Vue 3 + Reka UI                              | React 19 + RAC                                                      |
| 데스크톱        | Electron 35 정식                                      | Tauri v2 (7MB)                               | 미지원                                                              |
| 패키지 매니저   | Bun                                                   | Bun                                          | pnpm                                                                |
| 린트            | oxlint / oxfmt                                        | oxlint / oxfmt                               | ESLint                                                              |
| AI 통합         | agent-native (Zig NAPI) + MCP 내장                    | Vercel AI SDK + 100+ tool + MCP (stdio+HTTP) | Groq SDK + agent loop (MCP 부분)                                    |
| 협업            | 미확인                                                | Yjs CRDT + Trystero WebRTC P2P               | Supabase Realtime (부분)                                            |

세 프로젝트 모두 **CanvasKit/Skia WASM** 을 핵심 렌더러로 채택. 차이는 그 위에 쌓은 레이어.

---

## 2. 렌더링 파이프라인 비교표 (핵심)

| 영역                      | OpenPencil-Z                                                             | OpenPencil-D                                                                | composition                                                                                    |
| ------------------------- | ------------------------------------------------------------------------ | --------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------- |
| **Surface 생성**          | `MakeWebGLCanvasSurface` → 실패 시 `MakeSWCanvasSurface` (auto fallback) | WebGL 우선 (정확 분기 미확인)                                               | WebGL (단일, SW fallback 없음)                                                                 |
| **렌더 루프**             | `requestAnimationFrame` + **dirty 1bit**                                 | `requestRender` / `requestRepaint` **이중 트리거**, RAF coalescing          | `requestAnimationFrame` + **registryVersion 카운터**                                           |
| **렌더 invalidation**     | dirty=true (모든 변경)                                                   | `sceneVersion++` (구조) vs `renderVersion++` (재페인트만)                   | `registryVersion` + `layoutVersion` + `sceneVersion` (ADR-135/136 projection signature)        |
| **부분 invalidation**     | ❌                                                                       | ❌ (단, Picture/Backing 캐시로 대체)                                        | ❌                                                                                             |
| **Paint 객체**            | 매 draw `new ck.Paint()` + delete                                        | **11 고정 pool, mutate 재사용**                                             | 매 draw `new ck.Paint()` + delete<br>(`SkiaDisposable` 스코프 매니저 try/finally 일괄 dispose) |
| **Picture 캐시**          | ❌                                                                       | ✅ **`nodePictureCache` + `subtreePictureCache`**                           | ❌                                                                                             |
| **Retained backing**      | ❌                                                                       | ✅ **3x oversample backing**, pan/zoom 중 캐시 transform만, 6ms idle budget | ❌                                                                                             |
| **Layout 엔진**           | 자체 JS flex-like (`pen-core/layout`, WASM 비의존)                       | **Yoga WASM** (Flex + CSS Grid 커스텀 포크 3.3.0-grid.3)                    | **Taffy WASM** (Flex + Grid + Block 통합, ADR-100)                                             |
| **Layout 캐시**           | ❌ (매 sync 전체 재계산)                                                 | 미확인                                                                      | ✅ `LAYOUT_PROP_KEYS` 시그니처, 증분 갱신 (`persistentTaffyTree`)                              |
| **텍스트 렌더**           | Vector(Paragraph) → Bitmap **양쪽 fallback**                             | CanvasKit Paragraph + opentype.js 측정 검증 layer                           | CanvasKit Paragraph 단일 (`halfLeading:true`, `heightMultiplier`)                              |
| **텍스트 캐시**           | **3단**: textCache 256MB + paraCache 64MB + paraImageCache 128MB         | Paragraph layout 캐시 + 폰트 로드 시 invalidateAllPictures                  | **Paragraph 객체 자체 Map LRU**, `clearParagraphCache()` 진입점                                |
| **텍스트 측정 엔진**      | Canvas 2D `measureText` (glyph 테이블 추정 + 정밀 모드)                  | opentype.js (Figma 호환 검증) + CanvasKit (실 렌더)                         | **CanvasKit native** (`canvaskitTextMeasurer`) — Canvas 2D 보정 없음 (ADR-100 이후)            |
| **Hit-test**              | **rbush R-tree** O(log n) — JS                                           | 미확인 (Picture 캐시 동등 효과)                                             | **Rust WASM SpatialIndex**, 256px 그리드 cell, `boundsMap → batchUpdate()` 동기화              |
| **Viewport 변환**         | `canvas.concat(viewportMatrix)` 1회 (Skia 가 처리)                       | `canvas.scale(dpr).translate(pan).scale(zoom)` 1회                          | `canvas.concat()` 1회 (DirectContainer 패턴, PixiJS 제거 후)                                   |
| **Viewport culling**      | ✅ `isRectInViewport(..., margin=64/zoom)`                               | ✅ `scene.ts:35` AABB + 회전 보수 판정                                      | **부분 / Skia clipRect 위임 추정** — 명시적 skip 로직 확인 안 됨                               |
| **무한 캔버스 zoom 범위** | [0.01, 20]                                                               | 미확인                                                                      | 확인 안 됨 (Builder UI 의 zoom limit 별도 확인 필요)                                           |
| **Variable 해석**         | 매 sync 전 재해석, 캐시 없음, 1-hop 순환 guard                           | 변수 modes (테마/사이즈 다축) 지원                                          | TokenRef → CSS variable 사전 변환 (CSSGenerator), Skia 측은 `{color.*}` resolveToken           |
| **Sync 락**               | 단방향 + `dragSyncSuppressed` bit                                        | nanoevents `render:requested`/`repaint:requested`                           | `canonical update → syncToCanonical → _rebuildIndexes` 순서 규약 (ADR-122)                     |
| **AI streaming overlay**  | ✅ 5단 (glow/badge/border/preview-fill)                                  | 미확인                                                                      | AIPanel 별도 (Skia overlay 미적용 추정)                                                        |
| **Vector 편집**           | `path` 노드 + Skia path                                                  | ✅ Boolean ops (`Skia path.op()` Union/Diff/Intersect/XOR)                  | ❌ (벡터 편집 도구 없음)                                                                       |

---

## 3. 트레이드오프 분석 — 같은 Skia 인데 왜 갈라지나

### 3.1 OpenPencil-Z 의 선택 — "AI 우선, 렌더는 단순"

핵심 제약:

- **agent 가 페이지 부분을 동시 편집** (Concurrent Agent Teams) → 부분 invalidation 보다 **AI streaming overlay 5단** (각 agent 의 작업 영역 시각화) 우선
- 디자인 → 코드 생성이 출구 (`pen-codegen`) → 캔버스는 미리보기, 코드가 정본
- **dirty 1bit** 로 충분 — agent 가 큰 변경 단위로 작업, 잦은 작은 변경 아님

→ Paint pool / Picture 캐시 없음은 의식적 trade-off. Layout 캐시도 없음 (각 sync 전체 재계산).
→ **rbush R-tree** 하나로 hit-test 만 보강 — 캔버스 직접 조작은 부수적, agent 가 주.
→ WebGL → SW **자동 fallback** 은 환경 견고성 (CLI/Electron/Web 다중 진입점) 위해.

### 3.2 OpenPencil-D 의 선택 — "Figma 호환 + 60fps 직접 조작"

핵심 제약:

- 사용자가 **마우스로 직접** 도형 그리기/이동/리사이즈 — **60fps 절대 보장**
- **Figma 호환** → Yoga (Flex + Grid 커스텀 포크) 채택, opentype.js 로 advance width 검증, Boolean ops
- `.fig` 라운드트립 → 노드 모델이 Figma 모델 가까이, **Class-based SceneNode**

→ 매 frame paint 전부 다시 그리면 죽는다 → **Paint pool 11개 + Picture/Subtree 캐시 + 3x retained backing** 3중 방어
→ `requestRender` (구조 변경) vs `requestRepaint` (디스플레이 갱신) 분리 — selection/hover 같은 잦은 시각 변경에 Picture 캐시 유지하면서 overlay 만 갱신
→ **WASM 격리** (`@open-pencil/core` DOM-free) — 헤드리스 CLI export 가능, Tauri 7MB 빌드 성립

### 3.3 composition 의 선택 — "Builder ↔ Preview 대칭 + Spec SSOT"

핵심 제약 (CLAUDE.md `ssot-hierarchy.md` 3-domain 분할):

- **D1 (DOM/접근성, RAC 절대) + D2 (Props/API, RSP 참조) + D3 (시각, Spec SSOT)**
- Builder(Skia) 와 Preview(DOM+CSS) 가 **D3 대등 consumer** — 양쪽 시각 결과 동일성 검증 (`/cross-check`)
- canonical document 가 IndexedDB / Supabase 정본 — 캔버스는 **하류 view**
- 비개발자 사용자 대상, 마우스 조작 빈도는 Figma 류 디자인 도구보다 낮음

→ **Paint pool / Picture 캐시 도입 ROI 가 낮다** — 캔버스는 view, 정본은 canonical. 매 frame 전체 재그리기 비용보다 SSOT 일관성 / 양 consumer 대칭 검증이 우선.
→ **Taffy WASM (Flex + Grid + Block 통합)** 채택 — Spec 의 `_containerWidth` 주입 + grid 배치까지 일관 처리. OpenPencil-D 의 Yoga 포크 (Grid 만 별도 add) 보다 통합도 높음.
→ **Rust WASM SpatialIndex 그리드** — hit-test 외에도 boundsMap 동기화 / projection ID 공간 처리 (ADR-135/136) 까지 통합 수용. rbush R-tree 보다 데이터 흐름 단순 (cell 단위 batch update).
→ **canonical-only-runtime** (ADR-122) — Builder hot path 에서 `elementsMap`/`childrenMap` mutable subscription 0 건. OpenPencil-Z/D 가 SceneGraph mutation 으로 직접 변경하는 모델과 본질 차이.

### 3.4 의외의 정합 — 세 프로젝트 공통

- **단일 viewport matrix** (canvas.concat 1회) — 노드별 transform 누적 X
- **부분 dirty rect 미사용** — Skia 의 GPU 성능 / 자체 clip / 캐시에 위임
- **vsync RAF 동기**, 별도 throttle 없음
- **WASM 격리 의도** — composition 은 `packages/specs` / `packages/shared` 분할, OpenPencil-D 는 subpath export, OpenPencil-Z 는 12-package 위상 분리

→ "왜 같은가" 는 **Skia 의 성능 특성이 가이드** 한다. dirty rect 효용 < clip + culling + GPU. matrix concat 비용은 무시 가능.

### 3.5 의외의 차이

| 패턴             | 세 프로젝트 차이                                                                                                                                 |
| ---------------- | ------------------------------------------------------------------------------------------------------------------------------------------------ |
| Paint pool       | OpenPencil-D 만 적용 — composition 은 SkiaDisposable 스코프 try/finally 로 leak 방지에 집중, pool 까지는 안 감. OpenPencil-Z 도 미적용           |
| Picture 캐시     | OpenPencil-D 만. composition/OpenPencil-Z 는 전체 재그리기 — 다만 composition 은 layout 캐시 (Taffy 증분) 로 layout-side cost 는 절감            |
| 텍스트 캐시 단계 | OpenPencil-Z 3단 (256+64+128MB) >> composition 1단 (Paragraph LRU) >> OpenPencil-D 의 Picture 통합 캐시. 캐시 메모리 사용량의 trade-off          |
| 텍스트 fallback  | OpenPencil-Z 만 vector → bitmap 자동 fallback. composition 은 vector 단일 (CanvasKit native 측정으로 fallback 회피). OpenPencil-D 도 vector 단일 |
| SW fallback      | OpenPencil-Z 만 명시적 (WebGL 실패 시 자동). composition 은 WebGL 단일 — context loss 시 복구 경로 없음                                          |

---

## 4. composition 측 차용 검토 가능 패턴 (사실 기반 우선순위)

> 본 문서는 차용 자체를 결정하지 않는다. **후속 ADR 발의의 input** 으로 정리만 함.

### Tier A — ROI 높음 (직접 효과 예상)

1. **WebGL → SW 자동 fallback** (OpenPencil-Z `renderer.ts:87-98`)
   - composition 약점: WebGL context loss 시 복구 경로 없음, dev 도중 GPU 리셋 시 빈 화면 가능
   - 적용 비용: 작음 — `MakeSWCanvasSurface` 분기 추가
   - composition framing 영향: 없음 (SSOT 무관, 환경 견고성 layer)

2. **Subtree Picture cache** (OpenPencil-D `renderer.ts` + ADR-135 frame projection 자연 매칭)
   - ADR-135 가 frame 을 projection 단위로 격상시킨 후 frame 단위 Picture 캐싱이 자연스러움
   - reusable frame (component origin) 의 paint 결과 재사용 가능
   - 적용 비용: 중간 — invalidation 정책 (어떤 변경이 Picture 무효화 trigger 인지) 필요

### Tier B — 선결 조건 있음

3. **`requestRender` / `requestRepaint` 분리** (OpenPencil-D `create.ts:78`)
   - **선결 조건**: Picture 캐시 도입 (#2). 캐시가 없으면 분리 효과 0
   - 적용 비용: 작음 (분리 자체) + 큼 (Picture 캐시 필수 동반)

4. **Paint 객체 pool** (OpenPencil-D `paints.ts:13-111` 11개 고정)
   - 효과: GC 압박 감소. 단 composition `SkiaDisposable` try/finally 가 leak 은 막고 있어 누수 risk 는 낮음
   - 적용 비용: 작음
   - **단**, 측정 우선 — composition profile 에서 Paint allocate 가 hot 한지 확인 후 결정

### Tier C — 비추 / 조건부

5. **opentype.js 측정 검증** (OpenPencil-D)
   - **채택 비추천** — composition `canvas-rendering.md §3` 가 CanvasKit native 측정 단일 SSOT 확립 (`canvaskitTextMeasurer` + paragraph getMaxIntrinsicWidth 교정)
   - Canvas 2D ↔ CanvasKit 보정 layer 제거가 composition 의 의식적 ADR-100 결정. opentype.js 추가는 trade-off 역행
   - **단**, Figma `.fig` import/export 가 composition 에 들어올 경우 검증 layer 로만 한정 도입 (메인 측정 경로 X)

6. **3단 텍스트 캐시 (256+64+128MB)** (OpenPencil-Z)
   - composition 은 Paragraph 객체 LRU 1단으로 충분 — 빌더 텍스트량이 디자인 도구 수준 (수천 텍스트 노드) 아님
   - 캐시 메모리 256MB 는 builder 환경 (다른 tab 공존) 에서 부적절
   - **채택 비추천** — 필요 시 `getMaxParagraphCacheSize()` 한계 상향만으로 충분

7. **rbush R-tree** (OpenPencil-Z hit-test)
   - composition 은 이미 **Rust WASM SpatialIndex 그리드** 사용 → rbush 보다 데이터 흐름이 단순 (cell batch update)
   - **채택 비추천** — 이미 우월한 인프라

### Tier D — 차용 아닌 학습 reference

8. **AI streaming overlay 5단** (OpenPencil-Z `skia-engine.ts:259-342`)
   - composition AIPanel 이 캔버스 위 indicator 표시할 때 참조 패턴 (glow / badge / border / preview-fill)
   - ADR-134 (AI Assistant LLM 통합) Proposed 상태 — Phase 도중 참조 가능

9. **Concurrent Agent Teams orchestrator** (OpenPencil-Z)
   - composition `dispatching-parallel-agents` skill 보다 도메인-aware (페이지 공간 분해)
   - 사용자 workflow 가 multi-agent 빈도 높아질 때 참조

10. **Yjs CRDT + Trystero P2P** (OpenPencil-D)
    - composition 협업이 Supabase Realtime 일변도. P2P 협업 추후 도입 시 reference

### 차용 안 하는 이유 명시 (의식적 trade-off)

- **자체 layout 엔진 (JS flex-like, OpenPencil-Z 패턴)** — composition 의 Taffy WASM (Flex + Grid + Block 통합 + 증분 갱신) 이 우위. 변경 비추천
- **Yoga 포크 (OpenPencil-D)** — Taffy 가 Block 까지 통합 처리, Yoga 는 Grid 별도 add. 변경 비추천
- **SceneGraph class 모델 (OpenPencil-D)** — composition canonical document + Spec SSOT 모델과 본질 충돌. 변경 비추천

---

## 5. composition 이 우위에 있는 영역

| 영역                    | composition 우위 근거                                                                                                                         |
| ----------------------- | --------------------------------------------------------------------------------------------------------------------------------------------- |
| Layout 엔진 통합도      | **Taffy WASM** = Flex + Grid + Block 통합 + 증분 갱신 (`persistentTaffyTree`). OpenPencil-Z 자체 JS flex / OpenPencil-D Yoga (Grid 별도 포크) |
| canonical document      | ADR-116/122 canonical-only-runtime, runtime hot path mutable subscription 0건. 양 OpenPencil 은 SceneGraph mutation 직접                      |
| projection / page-frame | ADR-135/136 render-space ↔ canonical ID 공간 분리, sceneVersion signature                                                                     |
| 3-domain SSOT 분할      | D1 (RAC) / D2 (RSP) / D3 (Spec). 양 OpenPencil 은 시각 도구 — RAC 같은 접근성 SSOT 분할 무관                                                  |
| Spec-first              | Spec SSOT → CSS 자동 생성 + Skia 양 consumer 대칭. 양 OpenPencil 은 시각 단일 consumer (DOM 미상정)                                           |
| 절차 거버넌스           | ADR Risk-First + framing checkpoint 4 질문 + Wave A/B 자율화 모델                                                                             |
| Layout 캐시             | LAYOUT_PROP_KEYS 시그니처 기반 증분 갱신. OpenPencil-Z 는 layout 캐시 없음, OpenPencil-D 는 미확인                                            |
| Hit-test 통합           | Rust WASM SpatialIndex 가 boundsMap 동기화 + projection ID 처리까지 통합 흡수                                                                 |

---

## 6. Critical Files (인용 reference)

### composition 측 (본 문서 fact-check 인용)

- `apps/builder/src/builder/workspace/canvas/skia/SkiaCanvas.tsx:446` — RAF 루프 진입
- `apps/builder/src/builder/workspace/canvas/skia/useSkiaNode.ts:72` — registryVersion 카운터 watch
- `apps/builder/src/builder/workspace/canvas/skia/disposable.ts:25` — SkiaDisposable 스코프 매니저
- `apps/builder/src/builder/workspace/canvas/skia/hoverRenderer.ts:114-126` — Paint 매 draw 생성 패턴
- `apps/builder/src/builder/workspace/canvas/wasm-bindings/spatialIndex.ts:28,76` — Rust WASM SpatialIndex
- `apps/builder/src/builder/workspace/canvas/skia/renderCommands.ts:350,358-369` — syncSpatialIndex 진입점
- `apps/builder/src/builder/workspace/canvas/skia/nodeRendererText.ts:36,63-86` — Paragraph LRU 캐시
- `apps/builder/src/builder/workspace/canvas/skia/nodeRendererState.ts` — `clearParagraphCache()` 진입점
- `apps/builder/src/builder/workspace/canvas/skia/gridRenderer.ts:23-24`, `export.ts:79-80` — cullingBounds 전달
- `apps/builder/src/builder/workspace/canvas/skia/export.ts:86` — `makeImageSnapshot()` (mask/export 제한적)

### OpenPencil-Z (`OPENPENCIL_ANALYSIS.md` 인용)

- `packages/pen-renderer/src/renderer.ts:87-98` — Surface 생성 (WebGL→SW fallback)
- `packages/pen-renderer/src/renderer.ts:297-305` — RAF 루프 (dirty 1bit)
- `packages/pen-renderer/src/text-renderer.ts:160-299` — Vector 텍스트
- `packages/pen-core/src/layout/engine.ts` — 자체 JS layout
- `packages/pen-core/src/variables/resolve.ts:206-250` — variable 해석
- `packages/pen-renderer/src/spatial-index.ts:28-52` — rbush R-tree
- `apps/web/src/canvas/skia/skia-engine.ts:259-342` — AI streaming overlay 5단

### OpenPencil-D (`OPEN_PENCIL_FIGMA_FORK_ANALYSIS.md` 인용)

- `packages/core/src/canvas/renderer.ts:542` — Resource 명시 해제 (WASM 메모리 누수 방지)
- `packages/core/src/canvas/renderer/paints.ts:13-111` — Paint pool 11개 초기화
- `packages/core/src/canvas/renderer/retained-backing.ts` — 3x oversample backing, 6ms idle budget
- `packages/core/src/editor/create.ts:78` — `requestRender` / `requestRepaint` 분리
- `packages/core/src/canvas/scene.ts:35,138` — culling + renderNode
- `packages/core/src/canvas/boolean.ts:11` — Skia PathOp 매핑
- `packages/core/src/canvas/renderer/pipeline.ts:175` — transform stack

---

## 7. 후속 작업 옵션 (사용자 결정 대상)

본 문서는 비교 분석까지. 다음 step 은 사용자 선택:

| 옵션 | 내용                                                                | 비용 | 본질 영향                                                    |
| ---- | ------------------------------------------------------------------- | ---- | ------------------------------------------------------------ |
| B    | Tier A #1 (SW fallback) ADR 발의                                    | 작음 | composition WebGL context loss 견고성 보강                   |
| C    | Tier A #2 (Subtree Picture cache) 사전 profiling                    | 중간 | profile evidence 없이 도입 시 risk threshold check 실패 가능 |
| D    | 기존 분석 문서 2개의 stale 부분 (hit-test / 텍스트 캐시) 정정 patch | 작음 | 두 분석 문서 신뢰도 회복                                     |
| E    | 본 문서까지로 closure (별도 액션 없음)                              | 0    | 비교 자체가 목적 — 후속 결정은 추후                          |

본 문서 §0 fact-check 표가 정정 분을 흡수했으므로, 옵션 D 는 두 분석 문서 자체 수정 여부만 사용자 결정 (본 문서로 참고 가능하므로 우선순위 낮음).
