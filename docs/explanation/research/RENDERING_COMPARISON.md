# 4-Way 렌더링 비교 — Pencil Desktop / OpenPencil-Z / OpenPencil-D / composition

> **분석 일자**: 2026-05-20
> **버전**: v2 (4-way override, 진짜 pencil 추가)
> **분석 대상**:
>
> - **Pencil Desktop** (highagency `dev.pencil.desktop`, v1.1.57) — 진짜 origin. `PENCIL_DESKTOP_ANALYSIS.md` 참조
> - **OpenPencil-Z** (`/Users/admin/work/openpencil`, ZSeven-W v0.7.5) — pencil 카피 변종. `OPENPENCIL_ANALYSIS.md` 참조
> - **OpenPencil-D** (`/Users/admin/work/open-pencil`, Danila Poyarkov v0.12.2, Figma fork) — pencil 카피 변종. `OPEN_PENCIL_FIGMA_FORK_ANALYSIS.md` 참조
> - **composition** (in-tree) — `apps/builder/src/builder/workspace/canvas/skia/**` 자체 설계
>
> **사용자 framing**:
>
> - 두 OpenPencil 은 **진짜 pencil 을 카피해서 갈라진 변종**. 진짜 pencil (Pencil Desktop) 자체가 reference point
> - composition product target = **엔터프라이즈급 빌더** (`feedback-composition-enterprise-target`)
> - **fallback / graceful degradation 사고 회피** — 정상 동작 보장이 product 책임 (`feedback-no-fallback-thinking`)
> - 60fps 는 최저선 (`feedback-performance-completeness`)
>
> **이 문서의 scope**: 렌더링 파이프라인 4-way 비교 + Anthropic core 개발자 관점 보완 검토 + 재설계 의심 surface
> **목적**: ADR-134 (AI Assistant) / ADR-142 (canonical document) / ADR-100 (Unified Skia) 후속 결정의 input

---

## 0. 정체 — 4 프로젝트 한 줄 요약 (혼동 차단)

| 프로젝트           | 정체 한 줄                                                                                                             |
| ------------------ | ---------------------------------------------------------------------------------------------------------------------- |
| **Pencil Desktop** | highagency 의 **AI-First 디자인 도구** (Electron + Skia + Claude/Codex/Gemini 3-backend + MCP hub). 진짜 origin        |
| **OpenPencil-Z**   | ZSeven-W 의 **AI-네이티브 벡터 디자인 도구** 카피 변종. Concurrent Agent Teams + agent-native (Zig NAPI)               |
| **OpenPencil-D**   | Danila Poyarkov 의 **Figma 호환 디자인 에디터** 카피 변종. `.fig` 라운드트립 + 60fps 직접 조작 강도 최우선             |
| **composition**    | RAC + Spec SSOT 기반 **엔터프라이즈 노코드 웹 빌더**. canonical document → Preview DOM + Builder Skia 양 consumer 대칭 |

> **본질 차이**: OpenPencil 2종은 디자인 도구 (시각 결과 only). Pencil Desktop 도 디자인 도구이나 AI integration 이 architecture 의 중심. composition 은 빌더 — RAC ARIA / DOM/CSS 호환이 추가 제약.

---

## 1. Fact-check 정정 (composition 측, Explore agent 확인 2026-05-20)

기존 두 OpenPencil 분석 문서 + 메모리 기록 중 composition 측 사실 일부가 stale. 본 문서의 비교표는 정정 기준.

| 영역             | 기존 기록                           | 실제 코드 (2026-05-20)                                                                                                                                                         |
| ---------------- | ----------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Hit-test         | "boundsMap traverse + tree"         | **Rust WASM SpatialIndex**, 256px 그리드 cell. `canvas/wasm-bindings/spatialIndex.ts:28,76`                                                                                    |
| 텍스트 캐시      | "결과 `{width,height}` dict 만 LRU" | **Paragraph 객체 자체 Map LRU**, `clearParagraphCache()` 진입점. `skia/nodeRendererText.ts:36,63-86`                                                                           |
| Render trigger   | "layoutVersion 단일 카운터"         | **registryVersion + layoutVersion + sceneVersion 3 카운터**, RAF 루프. `sceneVersion` 은 ADR-135/136 projection signature. `skia/SkiaCanvas.tsx:446`, `skia/useSkiaNode.ts:72` |
| Viewport culling | "✅"                                | `cullingBounds` 인자는 전달되지만 **renderCommands 안 viewport skip 로직 미확인** — Skia 자체 clipRect 위임 추정. `skia/gridRenderer.ts:23-24`, `skia/export.ts:79-80`         |
| Picture cache    | (언급 없음)                         | **미사용** — Pencil/OpenPencil-D 와 격차                                                                                                                                       |
| Paint pool       | (언급 없음)                         | **미사용** — 매 draw `new ck.Paint()` + `SkiaDisposable` try/finally dispose. `skia/hoverRenderer.ts:114-126`                                                                  |

---

## 2. 4-Way 정체성 / 목표 / 베이스

| 측면             | Pencil Desktop                                                           | OpenPencil-Z (ZSeven-W)                          | OpenPencil-D (Danila)                    | composition                                                       |
| ---------------- | ------------------------------------------------------------------------ | ------------------------------------------------ | ---------------------------------------- | ----------------------------------------------------------------- |
| 버전             | 1.1.57                                                                   | 0.7.5                                            | 0.12.2                                   | in-tree                                                           |
| 베이스 정체      | **진짜 origin** (highagency 자체)                                        | pencil 카피 변종                                 | pencil 카피 변종 (Figma fork)            | RAC + Spec SSOT 자체 설계                                         |
| 목표             | **AI-First 디자인 도구** (multi-vendor + multi-window)                   | AI-네이티브 벡터 디자인 (Concurrent Agent Teams) | Figma 호환 60fps 직접 조작               | 엔터프라이즈 노코드 웹 빌더                                       |
| 출력물           | `.pen` JSON v2.11 + AI/stock 이미지 생성 (Reve/Unsplash)                 | `.op` JSON + 코드 생성 (React/Vue/Flutter/...)   | `.fig` + `.pen` + JSX/Tailwind 코드 생성 | canonical document → Supabase + Preview iframe DOM                |
| 데스크톱         | **Electron 자체 (165MB asar, 641MB extract)**                            | Electron 35 정식                                 | Tauri v2 (7MB)                           | 미지원 (Web SPA)                                                  |
| UI 프레임워크    | React (4.9MB bundle, **vanilla state — zustand 0**)                      | React 19 (TanStack Start + Vite 7)               | Vue 3 + Reka UI                          | React 19 + RAC                                                    |
| 캔버스 측 WASM   | **9.5MB pencil.wasm** (Skia + 커스텀 bindings 추정)                      | CanvasKit                                        | CanvasKit                                | CanvasKit + Taffy WASM + Rust SpatialIndex WASM                   |
| canonical 모델   | `.pen` v2.11 (13~15 노드 + reusable/ref/slot)                            | `.op` JSON                                       | `.fig` schema 호환                       | ADR-116/122 canonical-only-runtime + ADR-142 PrimitiveBinding ~35 |
| 컴포넌트 모델    | `reusable: true` + `ref` + descendants path                              | (간략)                                           | (Figma component 호환)                   | `RefNode.descendants[path].children` (ADR-130 frame canonical)    |
| Layout           | **flex only (grid 없음)**                                                | 자체 JS flex-like                                | Yoga WASM + Grid 커스텀 포크             | Taffy WASM (Flex + Grid + Block 통합 + 증분 갱신)                 |
| AI 통합          | **Claude Agent SDK + Codex SDK + Pi (Gemini)** 3-backend + MCP Go binary | agent-native (Zig NAPI) + MCP 내장               | Vercel AI SDK + 100+ tool + MCP          | Groq SDK + agent loop (ADR-134 Proposed)                          |
| AI 코드 실행     | **QuickJS-Emscripten sandbox** (9.5MB WASM 2 variant)                    | 직접 host eval (추정)                            | 직접 host eval (추정)                    | (ADR-134 미land, 차용 핵심 후보)                                  |
| MCP 통합         | **10 외부 AI tool 자가-등록 hub** + 14 internal tools (Go binary)        | MCP 내장 (간략)                                  | MCP (stdio+HTTP)                         | 부분 (`mcp__*` 도구 ad-hoc)                                       |
| Streaming UX     | **partial JSON 라이브 미리보기** (`jsonrepair` + Anthropic beta)         | 미확인                                           | 미확인                                   | 미land                                                            |
| State 라이브러리 | **vanilla React + signals (보조 4회)** — zustand 0                       | preact-signals + Bun runtime                     | nanoevents                               | Zustand + canonical-only-runtime                                  |
| 협업             | 미확인                                                                   | 미확인                                           | Yjs CRDT + Trystero WebRTC P2P           | Supabase Realtime (부분)                                          |
| 패키지 매니저    | pnpm/npm (file: ../../lib/\*)                                            | Bun                                              | Bun                                      | pnpm                                                              |
| 린트             | (미확인)                                                                 | oxlint / oxfmt                                   | oxlint / oxfmt                           | ESLint                                                            |

> **공통점**: 네 프로젝트 모두 **CanvasKit/Skia WASM 단일 렌더 백엔드**. 차이는 그 위의 layer.

---

## 3. 렌더링 파이프라인 4-Way 비교 (핵심)

| 영역                         | Pencil Desktop                                                                                       | OpenPencil-Z                                                             | OpenPencil-D                                                                 | composition                                                                             |
| ---------------------------- | ---------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------ | ---------------------------------------------------------------------------- | --------------------------------------------------------------------------------------- |
| **Surface 생성**             | WebGL (Skia + Emscripten), **ContextLost 7회 grep** = recovery 풍부                                  | `MakeWebGLCanvasSurface` → 실패 시 `MakeSWCanvasSurface` (auto fallback) | WebGL 우선 (정확 분기 미확인)                                                | WebGL (단일, SW fallback 없음, context loss recovery 미확인)                            |
| **렌더 루프**                | `requestAnimationFrame` (34회 grep) + signals 보조                                                   | `requestAnimationFrame` + **dirty 1bit**                                 | `requestRender` / `requestRepaint` **이중 트리거**, RAF coalescing           | `requestAnimationFrame` + **registryVersion 카운터**                                    |
| **렌더 invalidation**        | (미확인 — signals 4회로 보조 추정)                                                                   | dirty=true (모든 변경)                                                   | `sceneVersion++` (구조) vs `renderVersion++` (재페인트만)                    | `registryVersion` + `layoutVersion` + `sceneVersion` (ADR-135/136 projection signature) |
| **부분 invalidation**        | ❌                                                                                                   | ❌                                                                       | ❌ (Picture/Backing 캐시로 대체)                                             | ❌                                                                                      |
| **Paint 객체**               | (pool 여부 미확인)                                                                                   | 매 draw `new ck.Paint()` + delete                                        | **11 고정 pool, mutate 재사용** (`paints.ts:13-111`)                         | 매 draw `new ck.Paint()` + delete (`SkiaDisposable` try/finally dispose)                |
| **Picture 캐시**             | **`PictureRecorder` 1회 grep** = 적용은 하나 **소극적**                                              | ❌                                                                       | ✅ **`nodePictureCache` + `subtreePictureCache`** (적극적)                   | ❌                                                                                      |
| **Retained backing**         | 미확인 (`PictureRecorder` 와 결합 추정)                                                              | ❌                                                                       | ✅ **3x oversample backing**, pan/zoom 캐시 transform만, **6ms idle budget** | ❌                                                                                      |
| **OffscreenCanvas / Worker** | **OffscreenCanvas 2회 grep + 183KB worker bundle 분리**                                              | 미확인                                                                   | 미확인                                                                       | ❌ (Taffy WASM main thread)                                                             |
| **Layout 엔진**              | **flex only** (grid 없음)                                                                            | 자체 JS flex-like (`pen-core/layout`, WASM 비의존)                       | **Yoga WASM** (Flex + CSS Grid 커스텀 포크 3.3.0-grid.3)                     | **Taffy WASM** (Flex + Grid + Block 통합)                                               |
| **Layout 캐시**              | (미확인)                                                                                             | ❌ (매 sync 전체 재계산)                                                 | 미확인                                                                       | ✅ `LAYOUT_PROP_KEYS` 시그니처, 증분 갱신 (`persistentTaffyTree`)                       |
| **텍스트 렌더**              | CanvasKit Paragraph (49회 grep) + ParagraphBuilder (5회) + **TypefaceFontProvider**                  | Vector(Paragraph) → Bitmap **양쪽 fallback**                             | CanvasKit Paragraph + opentype.js 측정 검증 layer                            | CanvasKit Paragraph 단일 (`halfLeading:true`, `heightMultiplier`)                       |
| **텍스트 캐시**              | (`PictureRecorder` 흡수 추정)                                                                        | **3단**: textCache 256MB + paraCache 64MB + paraImageCache 128MB         | Paragraph layout 캐시 + 폰트 로드 시 invalidateAllPictures                   | **Paragraph 객체 자체 Map LRU**, `clearParagraphCache()` 진입점                         |
| **텍스트 측정 엔진**         | **`getMaxIntrinsicWidth` 6회 + `getLongestLine` 1회** = composition 동일 API                         | Canvas 2D `measureText` (glyph 테이블 추정 + 정밀 모드)                  | opentype.js (Figma 호환 검증) + CanvasKit (실 렌더)                          | **CanvasKit native** (`canvaskitTextMeasurer`) — Canvas 2D 보정 없음 (ADR-100)          |
| **Hit-test**                 | (미확인 — bundle minified)                                                                           | **rbush R-tree** O(log n) JS                                             | 미확인 (Picture 캐시 동등 효과)                                              | **Rust WASM SpatialIndex** 256px 그리드 cell + `boundsMap → batchUpdate()` 동기화       |
| **Viewport 변환**            | `canvas.concat()` 1회 (추정)                                                                         | `canvas.concat(viewportMatrix)` 1회                                      | `canvas.scale(dpr).translate(pan).scale(zoom)` 1회                           | `canvas.concat()` 1회 (DirectContainer, PixiJS 제거 후)                                 |
| **Viewport culling**         | (미확인)                                                                                             | ✅ `isRectInViewport(..., margin=64/zoom)`                               | ✅ `scene.ts:35` AABB + 회전 보수 판정                                       | 부분 / Skia clipRect 위임 추정                                                          |
| **Variable 해석**            | **4 universal type (`*OrVariable`)** + theme 별 다중 value + 1-hop 순환 guard                        | 매 sync 전 재해석, 캐시 없음                                             | 변수 modes (테마/사이즈 다축)                                                | TokenRef → CSS variable 사전 변환 (CSSGenerator) + Skia `{color.*}` resolveToken        |
| **canonical mutation API**   | **`batch_design` JS DSL: I/C/U/R/M/D/G 7 primitive** + QuickJS sandbox + rollback                    | 미확인                                                                   | (Figma 호환 mutation)                                                        | Zustand slice actions (직접 mutation) + canonical sync (ADR-122)                        |
| **AI streaming UX**          | ★ **partial JSON 라이브 미리보기** (jsonrepair + Anthropic `fine-grained-tool-streaming-2025-05-14`) | AI streaming overlay 5단 (glow/badge/border/preview-fill)                | 미확인                                                                       | AIPanel 별도 (Skia overlay 미적용 추정, ADR-134 Proposed)                               |
| **Sync 락**                  | EventEmitter + IPC channels (Electron main↔renderer)                                                 | 단방향 + `dragSyncSuppressed` bit                                        | nanoevents `render:requested`/`repaint:requested`                            | `canonical update → syncToCanonical → _rebuildIndexes` 순서 규약 (ADR-122)              |
| **Vector 편집**              | `path` 노드 + Skia path (★ ellipse arc/ring 통합 표현)                                               | `path` 노드 + Skia path                                                  | ✅ Boolean ops (`Skia path.op()` Union/Diff/Intersect/XOR)                   | ❌ (벡터 편집 도구 없음)                                                                |
| **무한 캔버스 zoom 범위**    | (미확인)                                                                                             | [0.01, 20]                                                               | 미확인                                                                       | 미확인 (Builder UI zoom limit 별도 확인 필요)                                           |

---

## 4. 트레이드오프 분석 — 같은 Skia 인데 왜 4갈래로 갈라지나

### 4.1 Pencil Desktop 의 선택 — "AI 가 architecture 의 중심"

핵심 제약:

- **AI mutation 이 primary entry** — 사람-주도 mutation 도 동일 `batch_design` 경유 가능. 7 primitive (I/C/U/R/M/D/G) 가 사용자 GUI 입력의 backend
- **3-backend (Claude/Codex/Gemini)** first-class — 후행 추가 아님. `createAgent` factory + 정규화된 `session-event`
- **multi-window grid 모드** — `--agent-config` CLI batch + 수십 시안 자동 생성
- **MCP hub** — 10 외부 AI tool config 자가-등록. 사용자의 AI ecosystem 안에 자기 자신을 endpoint 로

→ 렌더링은 **표준 Skia + 소극적 캐시 (`PictureRecorder` 1회만)**. AI 가 큰 mutation 단위로 작업 → 잦은 selection/hover 시각 변경 우선순위 낮음
→ **state = vanilla React** — zustand 0회 grep. props/context drilling. 디자인 도구 트리 깊이가 빌더 대비 얕음
→ **flex only (grid 없음)** — 디자인 도구 정체성 (Figma 도 grid 없음). composition 의 Taffy Flex+Grid+Block 통합과 본질 다른 노선
→ **QuickJS sandbox** — LLM JS 코드 host eval 금지. composition ADR-134 차용 핵심 후보

### 4.2 OpenPencil-Z 의 선택 — "AI 우선, 렌더는 단순, 환경 견고성"

핵심 제약:

- **agent 가 페이지 부분을 동시 편집** (Concurrent Agent Teams) → AI streaming overlay 5단 (각 agent 작업 영역 시각화) 우선
- **디자인 → 코드 생성** (`pen-codegen`) → 캔버스는 미리보기, 코드가 정본
- **CLI/Electron/Web 다중 진입점** → WebGL→SW fallback (환경 견고성)
- **dirty 1bit** — agent 가 큰 변경 단위로 작업, 잦은 작은 변경 아님

→ Paint pool / Picture 캐시 없음. Layout 캐시도 없음 (각 sync 전체 재계산)
→ **rbush R-tree** 하나로 hit-test 만 보강
→ **3단 텍스트 캐시 (256+64+128MB)** — 디자인 도구 텍스트량 가정 (수천 노드)
→ **agent-native (Zig NAPI)** — Bun + Zig NAPI 로 agent FFI

### 4.3 OpenPencil-D 의 선택 — "Figma 호환 + 60fps 직접 조작 강박"

핵심 제약:

- 사용자가 **마우스로 직접** 도형 그리기/이동/리사이즈 → 60fps 절대 보장
- **Figma 호환** → Yoga (Flex + Grid 커스텀 포크), opentype.js advance width 검증, Boolean ops
- `.fig` 라운드트립 → 노드 모델 = Figma 모델. **Class-based SceneNode**

→ 매 frame paint 전부 다시 그리면 죽는다 → **Paint pool 11 + Picture/Subtree cache + 3x retained backing** **3중 방어**
→ `requestRender` (구조) vs `requestRepaint` (디스플레이) 분리 — selection/hover 같은 잦은 시각 변경에 Picture 캐시 유지 + overlay 만 갱신
→ **WASM 격리** (`@open-pencil/core` DOM-free) — 헤드리스 CLI export, Tauri 7MB 빌드

> 진짜 pencil 보다 렌더 측 캐싱이 **더 적극적**. 이유: pencil 은 AI 가 mutation 주체 → 잦은 hover/drag 빈도 낮음. D 는 사람 직접 조작 → 사용자 손가락 cost 가 직접 손실

### 4.4 composition 의 선택 — "Builder ↔ Preview 대칭 + Spec SSOT + 엔터프라이즈 빌더"

핵심 제약 (`ssot-hierarchy.md` 3-domain 분할):

- **D1 (DOM/접근성, RAC 절대) + D2 (Props/API, RSP 참조) + D3 (시각, Spec SSOT)**
- Builder(Skia) ↔ Preview(DOM+CSS) 가 **D3 대등 consumer** — 양쪽 시각 결과 동일성 검증
- canonical document = IndexedDB / Supabase 정본 — 캔버스는 하류 view
- **엔터프라이즈 target** — 수백~수천 노드 + 60fps pan/zoom + 복잡 layout 편집 양립

→ **Taffy WASM (Flex + Grid + Block 통합)** — Spec `_containerWidth` 주입 + grid 배치 일관. OpenPencil-D Yoga 포크 (Grid 별도 add) 보다 통합도 높음
→ **Rust WASM SpatialIndex** — hit-test + boundsMap 동기화 + projection ID 처리 (ADR-135/136) 통합 흡수. rbush R-tree 보다 데이터 흐름 단순
→ **canonical-only-runtime** (ADR-122) — Builder hot path mutable subscription 0건. 4-way 중 유일하게 SSOT 분리 + 양 consumer 대칭 강제
→ **렌더 측 캐싱 미적용 영역** — Paint pool / Picture cache / retained backing 미land. **엔터프라이즈 target 부합 위해 도달 목표** (단순 ROI 분석 아님)

### 4.5 의외의 정합 — 4 프로젝트 공통

- **단일 viewport matrix** (canvas.concat 1회) — 노드별 transform 누적 없음
- **부분 dirty rect 미사용** — Skia GPU 성능 / 자체 clip / 캐시에 위임
- **vsync RAF 동기**, 별도 throttle 없음
- **canonical document 모델** — 4 모두 JSON serializable (`.pen`/`.op`/`.fig`/canonical). composition 이 가장 elaborate

→ "왜 같은가" 는 **Skia 의 성능 특성이 가이드**. dirty rect 효용 < clip + culling + GPU. matrix concat 비용 무시 가능

### 4.6 의외의 차이 — 본질 분기점

| 패턴               | Pencil Desktop                                 | OpenPencil-Z          | OpenPencil-D              | composition                                               |
| ------------------ | ---------------------------------------------- | --------------------- | ------------------------- | --------------------------------------------------------- |
| Picture cache      | 1회 (소극적)                                   | ❌                    | **적극적 (subtree+node)** | ❌                                                        |
| Paint pool         | (미확인)                                       | ❌                    | **11 고정**               | ❌ (Disposable scope)                                     |
| Retained backing   | (PictureRecorder 흡수 추정)                    | ❌                    | **3x oversample + 6ms**   | ❌                                                        |
| OffscreenCanvas    | **2회 + worker bundle 183KB**                  | 미확인                | 미확인                    | ❌                                                        |
| State 라이브러리   | **vanilla React** (zustand 0)                  | preact-signals        | nanoevents                | **Zustand + canonical-only-runtime**                      |
| Layout 통합도      | flex only                                      | flex only             | Yoga (Flex + Grid 포크)   | **Taffy Flex+Grid+Block 통합 + 증분**                     |
| AI integration     | **3-backend + QuickJS sandbox + MCP hub**      | agent-native Zig NAPI | Vercel AI SDK 100+ tools  | Groq + ADR-134 Proposed                                   |
| AI streaming UX    | **partial JSON 라이브 미리보기** (jsonrepair)  | overlay 5단           | (미확인)                  | (미land)                                                  |
| canonical mutation | **batch_design JS DSL 7 primitive + rollback** | (미확인)              | (Figma 호환)              | Zustand actions 직접 + canonical sync                     |
| 컴포넌트 모델      | **reusable + ref + descendants path**          | (간략)                | Figma component           | **RefNode.descendants + slot + projection (ADR-130/135)** |

> **결론**: Pencil 과 composition 의 canonical/component/slot 모델은 **거의 정합**. 차이는 (1) Pencil 이 AI mutation 우선이라 렌더 측 적극 캐싱 약함 (2) composition 이 D1/D2/D3 정합 강제라 simplification 불가. OpenPencil 2종은 양쪽 다른 방향으로 갈라짐 — D 는 렌더 적극 / Z 는 AI 적극

---

## 5. Anthropic core 개발자 관점 — composition 보완 검토

> **Framing 전제**:
>
> - composition product target = **엔터프라이즈급 빌더** (`feedback-composition-enterprise-target`)
> - **fallback / graceful degradation 패턴 자동 제외** (`feedback-no-fallback-thinking`)
> - 60fps 는 최저선 — 도달 목표 아님
> - Anthropic 관점 = **의식적 trade-off + measurement-driven + 패턴 추상화**

### Must — 엔터프라이즈 target 도달 위해 필수

#### 1. **Subtree Picture cache** (OpenPencil-D 적극 / Pencil Desktop 소극)

- **출처**: OpenPencil-D `renderer.ts` (subtree + node), Pencil `PictureRecorder` 1회 grep
- **composition 적용 자연 매칭**: ADR-135 frame projection 단위로 Picture 캐싱 → reusable frame (component origin) paint 결과 재사용
- **패턴 추상화**: **immutable artifact + lazy invalidation** (canonical immutable snapshot 사고 모델을 render artifact 에 확장)
- **현 격차**: composition 은 매 frame 전체 재그리기. canonical/projection/SSOT 영역에는 immutable snapshot 사고가 있는데 **render artifact 영역에 없다**
- **적용 비용**: 중간 — invalidation 정책 (어떤 변경이 Picture 무효화 trigger 인지) 설계 필요
- **우선순위**: HIGH

#### 2. **Retained backing (3x oversample + 6ms idle budget)** (OpenPencil-D)

- **출처**: OpenPencil-D `renderer/retained-backing.ts`
- **메커니즘**: 정지 상태에서 viewport 3배 영역 미리 raster 캐시 → pan/zoom 중 캐시 이미지만 transform (재렌더 0). 정지 후 2-18 idle frame 대기 → crisp 재캐시
- **패턴 추상화**: **frame budget 명시 정책** (6ms idle budget = 16.6ms frame 중 6ms 만 build 에 쓰겠다는 commitment). React 18 concurrent rendering 의 time-slicing 사고와 동일
- **현 격차**: composition 은 RAF 의존 + frame budget 미정의. 무거운 작업이 다음 frame 으로 yield 하는 메커니즘 부재
- **적용 비용**: 중간 — idle scheduler + invalidation 정책
- **우선순위**: HIGH

#### 3. **`requestRender` / `requestRepaint` 분리** (OpenPencil-D `create.ts:78`)

- **출처**: OpenPencil-D
- **메커니즘**: 구조 변경 (`sceneVersion++`) vs 디스플레이 갱신 (`renderVersion++`) 분리. selection/hover 잦은 시각 변경 시 Picture 캐시 유지 + overlay 만 갱신
- **패턴 추상화**: **change category × cost tier matching**. composition 의 registryVersion/layoutVersion/sceneVersion 3 카운터 분리는 **있지만**, 어떤 카운터가 증가하든 결국 매 frame 전체 재그리기 — **분류 자체가 dead investment**
- **#1 Subtree Picture cache 와 묶음** — 캐시 없이 분리만으로는 효과 0
- **적용 비용**: 작음 (분리 자체) + 큼 (Picture 캐시 필수 동반)
- **우선순위**: HIGH (Must #1 과 같은 ADR)

#### 4. **Paint 객체 pool** (OpenPencil-D `paints.ts:13-111` 11 고정)

- **출처**: OpenPencil-D
- **메커니즘**: 고정 Paint 객체 mutate 재사용 → GC 압박 제거. composition 현재 `SkiaDisposable` try/finally 가 leak 은 막지만 매 draw `new ck.Paint()` + delete 유지
- **패턴 추상화**: **WASM resource ownership 명시**. JS GC 가 WASM heap 해제 보장 안 함. Paragraph LRU eviction 시 명시 delete 검증 가치
- **현 격차**: 엔터프라이즈 대규모 노드에서 Paint allocate cost 무시 불가
- **적용 비용**: 작음 — profile evidence 없이도 도입 정당화 (target 부합)
- **우선순위**: MEDIUM (단독 land 가능)

#### 5. **OffscreenCanvas + Worker bundle 분리** (Pencil Desktop 2회 grep + 183KB worker)

- **출처**: Pencil Desktop `assets/webworkerAll.js:183KB`
- **메커니즘**: layout/measure 를 worker 로 offload — main thread 부담 분산
- **현 격차**: composition Taffy WASM 은 main thread. 큰 layout 재계산 시 frame drop
- **적용 비용**: 중간 — worker 통신 layer 신규
- **우선순위**: MEDIUM (Must #1~#3 도달 후 재평가)

### Nice-to-have — 별도 영역 (렌더 외)

#### 6. **QuickJS-Emscripten sandbox** (Pencil Desktop, OSS 라이브러리)

- **출처**: Pencil `out/editor/assets/ffi.js`, https://github.com/justjake/quickjs-emscripten
- **메커니즘**: LLM 이 작성한 JS 코드를 host JS 에 직접 노출 안 함. memory limit / stack size / timeout QuickJS 강제
- **composition 적용**: **ADR-134 (AI Assistant LLM 통합) 핵심 차용 후보**. host `eval()`/`Function()` 절대 회피
- **우선순위**: HIGH (ADR-134 진입 시)

#### 7. **Streaming partial JSON 라이브 미리보기** (Pencil Desktop)

- **출처**: Pencil `@ha/agent/src/claude/index.ts:212-499`
- **메커니즘**: Claude SDK `includePartialMessages: true` + `ANTHROPIC_BETAS: "fine-grained-tool-streaming-2025-05-14"` + `jsonrepair` 로 token-by-token 캔버스 반영. "AI 가 디자인하는 모습" UX
- **composition 적용**: ADR-134 도중 Skia preview 인프라와 자연 결합
- **우선순위**: HIGH (ADR-134 진입 시)

#### 8. **`createAgent` factory + 정규화 `session-event`** (Pencil Desktop)

- **출처**: Pencil `@ha/agent/src/{create-agent, claude, codex, pi}.ts`
- **메커니즘**: 3-backend (Claude/Codex/Gemini) 통합 청사진. event type 모두 동일 channel 로 emit (`tool-use-start` / `thinking` / `stream-message`)
- **composition 적용**: ADR-134 Decision 섹션 참조
- **우선순위**: HIGH (ADR-134 진입 시)

#### 9. **`canUseTool` cwd-containment 자동 permission** (Pencil Desktop)

- **출처**: Pencil `@ha/agent/src/claude/index.ts:90-153`
- **메커니즘**: file path 가 cwd 안인지 검사 → 자동 permit. 사용자 prompt 빈도 감소
- **composition 적용**: AI Panel permission UI
- **우선순위**: MEDIUM (ADR-134 phase)

#### 10. **MCP hub 자가-등록 패턴** (Pencil Desktop 10 외부 AI tool)

- **출처**: Pencil `@ha/mcp/src/installer.ts`
- **메커니즘**: composition 도 동일 패턴 → 사용자가 Claude Code/Cursor/Windsurf 어디서든 composition canonical document 를 query/mutate
- **우선순위**: MEDIUM (composition Electron 모드 land 시)

#### 11. **AI streaming overlay 5단** (OpenPencil-Z)

- glow / badge / border / preview-fill 패턴. composition AIPanel 캔버스 위 indicator
- ADR-134 phase 도중 참조
- **우선순위**: LOW

#### 12. **Concurrent Agent Teams orchestrator** (OpenPencil-Z) + **spawn_agents prompt template** (Pencil)

- composition `dispatching-parallel-agents` skill 보다 도메인-aware (페이지 공간 분해 / "one less than needed" / containerNodes 격리)
- 사용자 multi-agent 빈도 높아질 때 참조
- **우선순위**: LOW

#### 13. **Yjs CRDT + Trystero WebRTC P2P** (OpenPencil-D)

- composition 협업이 Supabase Realtime 일변도. P2P 협업 추후 도입 시
- **우선순위**: LOW

### 채택 제외 — fallback 사고 / composition 우위 영역 충돌

- **WebGL → SW 자동 fallback** (OpenPencil-Z) — fallback 사고 회피. WebGL context loss 원인을 product 가 해결 (GPU 메모리 관리 / 리소스 dispose 명시 / 환경 요구 명시)
- **Vector → Bitmap 텍스트 fallback** (OpenPencil-Z) — 동일 framing
- **Path SVG parser 다중 fallback** (OpenPencil-Z) — 동일 framing
- **시스템 폰트 → bitmap 강제** (OpenPencil-Z font-manager) — 동일 framing
- **opentype.js 측정 검증** (OpenPencil-D) — composition `canvas-rendering.md §3` 가 CanvasKit native 측정 단일 SSOT 확립. ADR-100 의식적 결정 역행
- **3단 텍스트 캐시 (256+64+128MB)** (OpenPencil-Z) — composition Paragraph 객체 LRU 1단으로 충분. 256MB 메모리 상한이 builder 환경 (다른 tab 공존) 에서 부적절. 필요 시 `getMaxParagraphCacheSize()` 한계 상향
- **rbush R-tree** (OpenPencil-Z) — composition 은 이미 Rust WASM SpatialIndex 그리드 사용. 우위 영역 — 변경 비추천
- **자체 JS layout 엔진** (OpenPencil-Z / Pencil Desktop flex only) — composition Taffy 통합도 우위. 변경 비추천
- **Yoga 포크** (OpenPencil-D) — Taffy 가 Block 까지 통합. Yoga 는 Grid 별도 add. 변경 비추천
- **SceneGraph class 모델** (OpenPencil-D) — composition canonical document + Spec SSOT 모델과 본질 충돌
- **vanilla React state (zustand 미사용)** (Pencil Desktop) — composition O(1) elementsMap/childrenMap + pageIndex SSOT 가 ADR-040 핵심. 엔터프라이즈 대규모 트리에서 props drilling + context 만으로는 60fps 어려움
- **flex only (grid 없음)** (Pencil Desktop) — composition Taffy WASM (Flex/Grid/Block). RAC Table/GridList/ListBox 정합 깨짐 (D1 침범)
- **`note`/`prompt`/`context`/`script` 노드 타입** (Pencil Desktop) — D3 시각 도메인 외 노드 도입 시 SSOT 체인 위반. AI 의도 메타는 `composition.actions`/`events` root collection 에 (ADR-131)

---

## 6. Anthropic core 개발자 관점 — composition 재설계 의심 (이걸 왜? 굳이 이렇게?)

> "왜 굳이 이렇게" 의심을 통과한 선택은 정당화 evidence (ADR / 측정) 동반해야 한다. composition 의 의식적 선택을 4-way 비교 기준으로 의심.

### 의심 A. canonical → projection → render 3-layer 가 정당한가?

- **현재**: canonical SSOT → ADR-135 projection (frame) → renderCommands → Skia
- **의심**: projection layer 추가 cost. OpenPencil-D 는 SceneGraph mutation 직접, projection 없음. Pencil 도 `.pen` document → directly `batch_design` mutation
- **재설계 가설**: projection 제거 → canonical mutation 이 render 에 직접 영향
- **결론**: **정당**. reusable frame / page-frame 시나리오는 projection 없이 해결 불가. ADR-135/136 의 sceneVersion signature 가 본질. **다만 projection cost 가 frame budget 의 몇 ms 인지 측정값 부재 — measurement gap**

### 의심 B. D3 시각 SSOT 의 대칭 강제가 Skia native 성능 발목 잡나?

- **현재**: Spec 이 양 consumer (DOM+CSS, Skia) 대칭 강제
- **의심**: Skia 의 native 기능 (`path.op()` Boolean / Shader / ImageFilter) 을 "DOM 호환" 위해 안 쓰는 경우 발생 가능. OpenPencil-D 는 Boolean ops 자유 사용 — Figma 호환 한정
- **재설계 가설**: D3 SSOT 를 더 느슨하게 — "시각 결과 동일성, 구현 자유"
- **결론**: **SSOT 자체는 정당** (이미 명시), 다만 적용에서 implementer 가 과도 보수. cross-check / parallel-verify skill 이 그 검증 layer

### 의심 C. WebGL 단일 → WebGPU 시기?

- **현재**: WebGL (Skia CanvasKit 의 WebGL backend)
- **의심**: WebGPU Chrome 113+ Stable, Safari 18 (2024 후반) 진입. CanvasKit WebGPU backend 검토 가치
- **결론**: **시기 상 이르다**. 엔터프라이즈 환경 Safari N-2 까지 지원 필요. 2-3년 후 재평가. CanvasKit WebGPU backend 진척 추적

### 의심 D. Skia 단일 (PixiJS 제거) → 이벤트 layer 자체 재검토?

- **현재**: Skia 가 그리기 + 이벤트 (EventBoundary) 통합 (ADR-100)
- **의심**: PixiJS 제거 후 이벤트 처리는 Rust SpatialIndex cover. 그러나 마우스 → SpatialIndex 조회 → 액션 dispatch latency 충분 측정됐나?
- **결론**: ADR-100 의 Skia 단일은 정당. **다만 이벤트 latency p99 측정 evidence 부재 — profiling 가치**

### 의심 E. RAC 재분해 + Spec 양립 → 자체 primitive 라이브러리 가능?

- **현재**: RAC (DOM 출력 / 접근성) + Spec (Skia 출력 정의) 양립. RAC 의존성 유지
- **의심**: Pencil Desktop 은 RAC 무사용 (vanilla React). 디자인 도구 정체성에서 ARIA 절대 의무 아님
- **재설계 가설**: RAC 정신 (접근성/키보드/focus) 만 추출 → 자체 unstyled primitive + Skia 직접 출력. React 의존 최소화
- **결론**: **재고 가치 있음, 그러나 비용 압도**. RAC 활발 개발 + 접근성 표준 따라가기 자체 유지 비용 = 3-5명 풀타임 engineering. **답: 정당. 다만 React fiber re-render 비용은 별도 측정 영역**

### 의심 F. Taffy WASM 통합 → flex only 단순화 가능?

- **현재**: Taffy WASM (Flex + Grid + Block 통합 + 증분)
- **의심**: Pencil Desktop / OpenPencil 2종 모두 flex only (grid 미포함). 빌더가 디자인 도구 수준이면 단순화 가능
- **재설계 가설**: Grid 제거 → flex only
- **결론**: **기각**. RAC Table/GridList/ListBox 가 grid 필수. D1 침범. **composition 의 Taffy 통합은 product target (RAC 정합) 위해 필수**

### 의심 G. canonical document 모델 → Pencil `.pen` 처럼 단순화?

- **현재**: ADR-142 PrimitiveBinding ~35 + RefNode.descendants + slot + projection
- **의심**: Pencil `.pen` v2.11 = 13~15 노드 + 7 mutation primitive + slot 단순. composition 보다 1차원적
- **재설계 가설**: composition canonical 도 13~15 노드 + 7 primitive 로 단순화
- **결론**: **기각**. Pencil 은 디자인 도구 (시각 결과만). composition 은 빌더 — D1 (DOM/ARIA) + D2 (RSP props) + D3 (시각) 3-domain 정합 필수. 단순화 시 RAC ARIA / RSP API 호환 깨짐

### 의심 H. Zustand + canonical-only-runtime → vanilla React 가능?

- **현재**: Zustand slice + canonical-only-runtime (ADR-122)
- **의심**: Pencil Desktop = vanilla React (zustand 0회 grep). 4.9MB bundle 에서 성립
- **재설계 가설**: composition 도 vanilla React + props/context drilling
- **결론**: **기각**. Pencil 디자인 도구 트리는 얕음 (root → page → frames → leaves). composition 빌더 트리는 수백~수천 노드 + O(1) elementsMap/childrenMap 인덱스 필수. props drilling 시 60fps 불가

### 의심 I. 매 frame 전체 재그리기 → 부분 dirty rect 도입?

- **현재**: registryVersion 변경 → 전체 재그리기
- **의심**: Skia drawRect dirty regions 명시 활용
- **결론**: **기각**. Skia 가 GPU 위 dirty rect 한계 (전체 frame buffer 단위). **Must #1 Picture cache + #2 retained backing 이 더 효과적** — Skia 의 의식적 trade-off

### 의심 J. Rust WASM SpatialIndex 256px 그리드 → adaptive cell size?

- **현재**: CELL_SIZE=256 고정
- **의심**: 노드 크기 분포에 따라 cell size 적정값 다름. 작은 노드 많으면 64/128, 큰 노드 많으면 512
- **재설계 가설**: adaptive cell size
- **결론**: **재고 가치 있음**. adaptive 비용 > fixed 256 의 정확도 부족 비용 일 수 있음. **fixed 256 정당화 자료 없음 — 측정 evidence gap**

---

## 7. composition 우위 영역 (4-way 기준)

| 영역                    | composition 우위 근거                                                     | 4-way 비교                                                                                               |
| ----------------------- | ------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------- |
| Layout 엔진 통합도      | **Taffy WASM** = Flex + Grid + Block 통합 + 증분 갱신                     | Pencil/OpenPencil-Z 자체 JS flex only / OpenPencil-D Yoga (Grid 별도 포크) — composition 만 Block + 증분 |
| canonical-only-runtime  | ADR-116/122 runtime hot path mutable subscription 0건                     | 4-way 중 유일 — Pencil/OpenPencil-D 는 SceneGraph mutation 직접, Pencil 은 batch_design rollback 만 보장 |
| projection / page-frame | ADR-135/136 render-space ↔ canonical ID 공간 분리, sceneVersion signature | 4-way 중 유일                                                                                            |
| 3-domain SSOT 분할      | D1 (RAC) / D2 (RSP) / D3 (Spec)                                           | 4-way 중 유일 — 다른 3 프로젝트는 시각 single consumer (DOM/ARIA 미상정)                                 |
| Spec-first              | Spec SSOT → CSS 자동 생성 + Skia 양 consumer 대칭                         | 4-way 중 유일                                                                                            |
| Layout 캐시             | LAYOUT_PROP_KEYS 시그니처 + 증분 갱신                                     | OpenPencil-Z 미적용 / Pencil/OpenPencil-D 미확인 — composition 명시 우위                                 |
| Hit-test 통합           | Rust WASM SpatialIndex 가 boundsMap 동기화 + projection ID 처리 통합 흡수 | OpenPencil-Z rbush JS / Pencil/OpenPencil-D 미확인 — composition Rust WASM 으로 양적 우위                |
| 절차 거버넌스           | ADR Risk-First + framing checkpoint 4 질문 + Wave A/B 자율화 모델         | 4-way 중 유일 — 다른 3 프로젝트는 git log 기반 결정 추정                                                 |
| 컴포넌트 모델 정합도    | RefNode.descendants + slot + projection (ADR-130/135)                     | Pencil `.pen` reusable/ref/descendants 와 거의 정합 — 4-way 중 가장 정교                                 |

## 8. composition 도달 목표 영역 (Anthropic 관점에서 정당화 evidence 약함)

| 영역                           | 현 격차                                   | 4-way 도달 reference                        | 우선순위       |
| ------------------------------ | ----------------------------------------- | ------------------------------------------- | -------------- |
| Subtree Picture cache          | 미적용                                    | OpenPencil-D (적극) / Pencil (소극)         | HIGH           |
| Retained backing + idle budget | 미적용                                    | OpenPencil-D 3x oversample + 6ms            | HIGH           |
| requestRender/Repaint 분리     | 미적용 (3 카운터 분리만)                  | OpenPencil-D                                | HIGH           |
| Paint object pool              | 미적용                                    | OpenPencil-D 11 fixed                       | MEDIUM         |
| OffscreenCanvas + Worker       | 미적용 (Taffy main thread)                | Pencil (worker 183KB)                       | MEDIUM         |
| WebGL ContextLost recovery     | 미확인                                    | Pencil 7회 grep                             | MEDIUM         |
| Frame budget 정책              | 미정의 (RAF 의존)                         | OpenPencil-D 6ms idle                       | MEDIUM         |
| 메모리 budget 정책             | Paragraph LRU 한도 정의만, 통합 정책 없음 | OpenPencil-Z 3단 (256+64+128MB) — 한도 명시 | MEDIUM         |
| QuickJS sandbox (AI 코드 격리) | 미land (ADR-134 Proposed)                 | Pencil quickjs-emscripten WASM 2 variant    | HIGH (ADR-134) |
| Streaming partial JSON UX      | 미land (ADR-134 Proposed)                 | Pencil jsonrepair + Anthropic beta          | HIGH (ADR-134) |
| 3-backend agent factory        | Groq 단일 (ADR-134 Proposed)              | Pencil `createAgent` (Claude/Codex/Gemini)  | HIGH (ADR-134) |

→ **Anthropic 관점 결론**: composition 의 **SSOT / 아키텍처 / 거버넌스** 영역은 4-way 우위. 의심 영역은 **모두 render cost layer + AI integration 가 명시 정책 없이 implicit**. Pencil 의 AI 영역 차용 (Must #6~#8) + OpenPencil-D 의 렌더 캐싱 차용 (Must #1~#4) 이 도달 목표.

---

## 9. Anthropic core 개발자 관점 — 본질 통찰 5

### 통찰 1. **계산-캐시-재사용 3계층 분리 부재**

OpenPencil-D 는 **compute → cache (Picture) → re-use** 3계층 명확. composition 은 compute → 즉시 사용. **canonical SSOT 영역의 immutable snapshot 사고를 render artifact 영역에 확장 안 함** — Anthropic 관점에서 가장 큰 architectural gap.

### 통찰 2. **변경 분류 ↔ 처리 비용 매칭 부재**

composition 의 registryVersion/layoutVersion/sceneVersion 3 카운터 **분리는 있지만 처리 차등화 없음**. OpenPencil-D 의 `requestRender` (비싼) ↔ `requestRepaint` (싼) 매칭은 1:1. composition 의 분류 자체가 dead investment — Must #1+#3 도입 시 활성화.

### 통찰 3. **공간 ↔ 시간 trade-off + frame budget 명시화 부재**

OpenPencil-Z 의 3단 텍스트 캐시 (448MB) / OpenPencil-D 의 3x retained backing — **메모리로 시간을 사는 의식적 결정**. composition 의 Paragraph LRU 는 한도/정책 부재. **엔터프라이즈 product 의 메모리/시간 budget = SLA 영역**. 명시 정책 필요.

### 통찰 4. **AI integration 이 architecture 의 후행 추가 vs 중심**

Pencil 은 AI = first-class citizen (3-backend, QuickJS sandbox, MCP hub, batch_design, streaming partial JSON). composition 의 ADR-134 는 **Pencil 정도의 AI integration depth** 가 product target 부합 — surface-level 통합 (Groq SDK + agent loop) 이상의 architectural commitment 필요.

### 통찰 5. **WASM resource ownership audit 부재**

OpenPencil-D `invalidateVectorPath` 의 명시 `path.delete()`. composition `SkiaDisposable` scope 가 try/finally 일괄 dispose 는 OK, 단 **scope 밖 캐시된 WASM 객체 (Paragraph LRU eviction 시 명시 delete?)** audit 필요. silent memory leak risk.

---

## 10. Critical Files (인용 reference)

### Pencil Desktop 측 (`PENCIL_DESKTOP_ANALYSIS.md` 인용)

- `out/editor/index.html` — CSP / Vite SPA entry
- `out/editor/assets/index.js` (4.9MB) — minified React bundle
- `out/editor/assets/pencil.wasm` (9.5MB) — Skia + custom bindings
- `out/editor/assets/webworkerAll.js` (183KB) — Worker bundle (OffscreenCanvas)
- `out/editor/assets/ffi.js` + `module-*` — QuickJS-Emscripten FFI
- `node_modules/@ha/schema/{generated-schema.md, pen.schema.json, src/generated-types-*.ts}` — .pen v2.11 schema
- `node_modules/@ha/mcp/dist/schemas/{batch_design,spawn_agents,...}.json` — 14 MCP tool schemas
- `node_modules/@ha/agent/src/{create-agent, claude, codex, pi, types}.ts` — 3-backend agent factory
- `out/data/{halo, lunaris, nitro, shadcn}.lib.pen` — 4 built-in design systems
- `out/{main, app, desktop-resource-device, claude}.js` — Electron main 27 files

### OpenPencil-Z 측 (`OPENPENCIL_ANALYSIS.md` 인용)

- `packages/pen-renderer/src/renderer.ts:87-98` — Surface 생성 (WebGL→SW fallback)
- `packages/pen-renderer/src/renderer.ts:297-305` — RAF 루프 (dirty 1bit)
- `packages/pen-renderer/src/text-renderer.ts:160-299` — Vector 텍스트
- `packages/pen-core/src/layout/engine.ts` — 자체 JS layout
- `packages/pen-core/src/variables/resolve.ts:206-250` — variable 해석
- `packages/pen-renderer/src/spatial-index.ts:28-52` — rbush R-tree
- `apps/web/src/canvas/skia/skia-engine.ts:259-342` — AI streaming overlay 5단

### OpenPencil-D 측 (`OPEN_PENCIL_FIGMA_FORK_ANALYSIS.md` 인용)

- `packages/core/src/canvas/renderer.ts:542` — Resource 명시 해제 (WASM 메모리 leak 방지)
- `packages/core/src/canvas/renderer/paints.ts:13-111` — Paint pool 11 초기화
- `packages/core/src/canvas/renderer/retained-backing.ts` — 3x oversample, 6ms idle budget
- `packages/core/src/editor/create.ts:78` — `requestRender` / `requestRepaint` 분리
- `packages/core/src/canvas/scene.ts:35,138` — culling + renderNode
- `packages/core/src/canvas/boolean.ts:11` — Skia PathOp 매핑
- `packages/core/src/canvas/renderer/pipeline.ts:175` — transform stack

### composition 측 (Explore agent fact-check 2026-05-20)

- `apps/builder/src/builder/workspace/canvas/skia/SkiaCanvas.tsx:446` — RAF 루프 진입
- `apps/builder/src/builder/workspace/canvas/skia/useSkiaNode.ts:72` — registryVersion 카운터 watch
- `apps/builder/src/builder/workspace/canvas/skia/disposable.ts:25` — SkiaDisposable 스코프 매니저
- `apps/builder/src/builder/workspace/canvas/skia/hoverRenderer.ts:114-126` — Paint 매 draw 생성 패턴
- `apps/builder/src/builder/workspace/canvas/wasm-bindings/spatialIndex.ts:28,76` — Rust WASM SpatialIndex
- `apps/builder/src/builder/workspace/canvas/skia/renderCommands.ts:350,358-369` — syncSpatialIndex 진입점
- `apps/builder/src/builder/workspace/canvas/skia/nodeRendererText.ts:36,63-86` — Paragraph LRU 캐시
- `apps/builder/src/builder/workspace/canvas/skia/nodeRendererState.ts` — `clearParagraphCache()` 진입점
- `apps/builder/src/builder/workspace/canvas/skia/gridRenderer.ts:23-24`, `export.ts:79-80` — cullingBounds
- `apps/builder/src/builder/workspace/canvas/skia/export.ts:86` — `makeImageSnapshot()` (mask/export 제한)

---

## 11. 후속 작업 옵션 (사용자 결정 대상)

본 문서는 4-way 비교 분석까지. 다음 step 은 사용자 선택:

| 옵션 | 내용                                                                                                                       | 비용 | 본질 영향                                                                                        |
| ---- | -------------------------------------------------------------------------------------------------------------------------- | ---- | ------------------------------------------------------------------------------------------------ |
| A    | **Must #1+#3 묶음 ADR** — Subtree Picture cache + requestRender/Repaint 분리. ADR-135 frame projection 후속으로 자연 매칭  | 중간 | 엔터프라이즈 대규모 문서 60fps 도달의 결정타. invalidation 정책 설계 동반. composition 본질 강화 |
| B    | **Must #2 Retained backing** ADR — pan/zoom 60fps 절대 표준 + 6ms idle budget 도입                                         | 중간 | pan/zoom 절대 60fps. frame budget 정책 (통찰 3) 동시 해결                                        |
| C    | **Must #4 Paint pool 11** — profile evidence 없이도 도입 정당화 (target 부합)                                              | 작음 | GC 압박 제거. WASM resource audit (통찰 5) 동시 추진 가치                                        |
| D    | **Must #5 OffscreenCanvas + Worker** PoC — layout/measure main thread offload                                              | 중간 | Taffy main thread 부담 분산. Pencil 패턴 직접 차용                                               |
| E    | **ADR-134 본 분석 반영 revision** — Pencil `createAgent` + `session-event` + QuickJS sandbox + streaming partial JSON 명시 | 작음 | AI integration depth 가 product target 부합 (통찰 4)                                             |
| F    | 기존 분석 문서 3개 stale 부분 정정 patch (hit-test / 텍스트 캐시 / culling)                                                | 작음 | 분석 문서 신뢰도 회복. 본 문서 §1 fact-check 흡수했으므로 우선순위 낮음                          |
| G    | 본 문서까지로 closure (별도 액션 없음)                                                                                     | 0    | 비교 자체가 목적 — 후속 결정은 추후                                                              |

권장 순서: **A → C → B → E → D**. A 는 Must #1+#3 묶음으로 OpenPencil-D 적극 캐싱 패턴 + composition 의 dead 3 카운터 활성화 (통찰 2). C 는 profile 없이도 즉시 land 가능 (target 부합). B 는 frame budget 정책 정착. E 는 ADR-134 본격 진입.

---

## 12. 메모리 / ADR 정합 reference

### 메모리 (4-way framing 근거)

- `~/.claude/projects/-Users-admin-work-composition/memory/feedback-composition-enterprise-target.md` — 엔터프라이즈 target framing
- `~/.claude/projects/-Users-admin-work-composition/memory/feedback-no-fallback-thinking.md` — fallback 사고 회피
- `~/.claude/projects/-Users-admin-work-composition/memory/feedback-performance-completeness.md` — 60fps 는 최저선
- `~/.claude/projects/-Users-admin-work-composition/memory/pencil-component-visual-markers.md` — pencil 시각 마커 (origin/instance) 기존 분석
- `~/.claude/projects/-Users-admin-work-composition/memory/project-pencil-format-residual-framing.md` — pencil format SSOT framing
- `~/.claude/projects/-Users-admin-work-composition/memory/ssot-chain-definition.md` — D1/D2/D3 정본

### 규칙 / ADR (composition 측)

- `.claude/rules/ssot-hierarchy.md` — 3-Domain 정본 (D1/D2/D3)
- `.claude/rules/canvas-rendering.md` — Skia 렌더링 + 텍스트 측정 (§3)
- `.claude/rules/layout-engine.md` — Taffy WASM Flex/Grid/Block
- `.claude/rules/state-management.md` — Zustand + canonical document SSOT
- `docs/adr/100-unified-skia-rendering-engine.md` — ADR-100 Unified Skia Engine
- `docs/adr/completed/116-...md` — ADR-116 canonical-only-runtime
- `docs/adr/completed/122-canonical-only-runtime-legacy-mirror-removal.md`
- `docs/adr/completed/130-frame-canonical-vocabulary.md` — ADR-130 frame canonical
- `docs/adr/135-frame-projection-render-space-id.md` — ADR-135 frame projection
- `docs/adr/136-scene-version-signature.md` — ADR-136 sceneVersion signature
- `docs/adr/134-ai-assistant-llm-unification-plan.md` — ADR-134 AI Assistant (Proposed)
- `docs/adr/design/142-...breakdown.md` — ADR-142 canonical document = component SSOT

### 외부 라이브러리 (차용 후보)

- `quickjs-emscripten` — https://github.com/justjake/quickjs-emscripten (AI 코드 격리 VM)
- `@anthropic-ai/claude-agent-sdk` — Pencil 직접 사용
- `@openai/codex-sdk` — Pencil 직접 사용
- `jsonrepair` — partial JSON 복구 (streaming UX)
- Anthropic beta header `fine-grained-tool-streaming-2025-05-14`

---

**문서 끝.** 본 분석은 Pencil 1.1.57 + OpenPencil-Z 0.7.5 + OpenPencil-D 0.12.2 + composition 2026-05-20 시점이며, 향후 버전 변경 시 stale 가능. 재분석 시 각 분석 문서 §0 절차로 재현 가능.
