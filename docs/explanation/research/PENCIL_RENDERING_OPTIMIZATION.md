# Pencil 생태계 3-앱 렌더링 최적화 심도 비교

> **작성일**: 2026-05-28
> **선행 문서**: [PENCIL_ECOSYSTEM_ANALYSIS.md](PENCIL_ECOSYSTEM_ANALYSIS.md) — 3개 디렉토리 정체 / 기술 스택 / 사용자 framing 정정
> **범위**: 렌더링 파이프라인, 캐시 계층, 측정 인프라, paint pool, viewport 처리만. UX / 데이터 모델 / AI 통합은 선행 문서.
> **방법**: openpencil + open-pencil 소스 직접 read (각 1,500-3,000 LOC 이내 핵심 파일 read), Pencil.app 은 binary 메타데이터 + node_modules 만 (asar 본체 접근 불가).
>
> **⚠️ STALE (2026-07-26)**: Pencil.app 서술 ("native Skia + 4-process 분리까지만 확정") 이 v1.2.1 asar 전개 실측으로 대체됨 — 실체는 **자체 C++ WASM 엔진 (Skia m149 임베드) + JS 레이아웃**이며, 본체도 open-pencil T2 와 같은 계열의 **콘텐츠 캐시 surface + stale blit** 수법을 사용. 실측 정본: [PEN_V1.2.1_RENDERING_UIUX_ANALYSIS.md](PEN_V1.2.1_RENDERING_UIUX_ANALYSIS.md) §3. openpencil / open-pencil 분석은 유효 유지.

---

## 결론 우선

**`open-pencil` 만 production-grade 다층 캐시 + 측정 인프라. `openpencil` 은 단순 단일-pass + RBush hit-test. `Pencil.app` 은 binary 분석 한계로 native Skia + 4-process Electron 분리까지만 확정.** composition 의 현재 1-tier 비-측정 렌더와 가장 격차 큰 reference 는 **`open-pencil/canvas/renderer/` + `profiler/`**.

---

## 1. open-pencil — 3-tier Retained Backing + Phase Profiler

### 1-1. 캐시 3 계층

위치: `open-pencil/packages/core/src/canvas/renderer/retained-backing.ts` (428 LOC) + `pipeline.ts` (347 LOC)

| Tier                         | 객체                                    | scope         | invalidate 조건                                                              | 비용 회수                                                           |
| ---------------------------- | --------------------------------------- | ------------- | ---------------------------------------------------------------------------- | ------------------------------------------------------------------- |
| **T1** `scenePicture`        | `PictureRecorder` 전체 페이지 1개       | page-level    | `sceneVersion` / `positionPreviewVersion` / `pageId` / volatile overlay 부재 | `drawPicture(pic)` = 거의 zero CPU                                  |
| **T2** `sceneBacking`        | bitmap surface, **viewport × 3배** 영역 | viewport 근방 | `panX·panY·zoom` 변화 후 idle 시점, `sceneVersion` 일치                      | pan/zoom 중 stale 이미지 scale-blit → blur 처리 후 fresh image swap |
| **T3** `subtreePictureCache` | childId 별 `Picture`                    | page child    | 같은 invalidate 키                                                           | T2 재구축 시 자식 picture 재사용                                    |

#### T2 의 두 핵심 메커니즘

**(a) Incremental build budget** — `retained-backing.ts:351-380`

```ts
const SCENE_BACKING_BUILD_BUDGET_MS = 6  // 60Hz 의 1/3

function stepSceneBackingBuild(r, sceneVersion): boolean {
  const startedAt = now()
  do {
    const childId = build.childIds[build.index]
    if (!childId) break
    renderBackingChild(r, build.graph, build.surface, childId, backing, ...)
    build.index++
  } while (build.index < build.childIds.length && now() - startedAt < BUILD_BUDGET_MS)
  // 6ms 안에 다 못 끝내면 다음 frame 으로 이월
}
```

자식 N개 중 6ms 안에 가능한 만큼만 record. `build.index` cursor 가 frame 간 진행 보존.

**(b) Stale-zoom 허용** — `retained-backing.ts:26-66, 87-111`

```ts
function sceneBackingPreviewIdleMs(r): number {
  // viewport event interval 측정 (sceneBackingAverageViewportIntervalMs)
  // → 사용자가 활발히 pan/zoom 중이면 짧은 idle, 잠시 멈추면 긴 idle
  const expectedEventsDuringRender = renderMs / inputIntervalMs;
  return clamp(renderMs * quietInputIntervals, minDelay, maxDelay);
}

// pan/zoom 중에는 sceneBackingPreviewUntil 이내 동안 stale image 사용 허용
const allowStaleZoom = now() < r.sceneBackingPreviewUntil;
```

→ 사용자가 zoom 휠 돌리는 동안에는 backing 의 기존 image 를 scale 변환해 임시로 그려 frame drop 회피. 멈추면 crisp 복원.

### 1-2. RenderLayer 분리 — architecture 결정

`pipeline.ts:27, 174-239`:

```ts
export type RenderLayer = "full" | "scene" | "overlays";
```

- `overlays` 만 재요청 가능 → selection / marquee / snap guide 변경 시 scene 캐시 유지
- `hasVolatileOverlay()` = dropTarget / rotation / textEdit / nodeEdit → cache skip
- `scenePictureMissReason()` 반환 7가지: `'position-preview' | 'volatile-overlay' | 'missing-picture' | 'position-preview-version' | 'scene-version' | 'page' | 'unknown'` — cache miss 원인이 1급 신호

### 1-3. 측정 인프라

위치: `open-pencil/packages/core/src/profiler/` (723 LOC 9 파일)

| 측정 영역  | 메커니즘                                                                                                                             | 파일                                 |
| ---------- | ------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------ |
| GPU 시간   | `EXT_disjoint_timer_query_webgl2` non-blocking pollResults                                                                           | `gpu-timer.ts` (92 LOC)              |
| Draw call  | `gl.drawArrays/drawElements` wrap counter                                                                                            | `draw-call-counter.ts` (55 LOC)      |
| Phase      | `render:scene`, `render:drawPicture`, `render:recordPicture`, `render:volatile`, `render:selection`, `render:rulers`, `render:flush` | `phase-timer.ts` (59 LOC)            |
| Node-level | `captureSession.stack.begin/end(nodeId, drawCallsDelta)`                                                                             | `capture-session.ts` (39 LOC)        |
| HUD        | 화면 내 overlay                                                                                                                      | `hud-renderer.ts` (261 LOC)          |
| Export     | speedscope.app JSON — flamechart (Firefox Profiler 호환)                                                                             | `speedscope-export.ts` (6 LOC entry) |

`render-profiler.ts:90-94` 의 `setScenePictureMode(mode, reason)` 으로 frame 단위 cache hit/miss 모드 + 미스 사유 동시 기록.

### 1-4. Paint pool — `paints.ts:13-111` (111 LOC)

35+ Paint 객체 init 시 한 번 생성:

```
fillPaint, strokePaint, selectionPaint, parentOutlinePaint, snapPaint,
auxFill, auxStroke, opacityPaint, effectLayerPaint,
rulerBgPaint, rulerTickPaint, rulerTextPaint, rulerHlPaint, rulerBadgePaint, rulerLabelPaint,
penPathPaint, penLiveStrokePaint, penHandlePaint, penVertexFill, penVertexStroke
```

ad-hoc `new Paint()` per draw 없음. `setColor / setAlphaf` 로 reuse. `lifecycle.ts:31-58` 에서 모두 명시적 `.delete()`.

### 1-5. 자원 lifecycle — 9 캐시 통합 해제

`lifecycle.ts:17-66`:

```
imageCache, vectorPathCache, vectorStrokePathCache, vectorStrokeOutlineCache,
fillGeometryCache, strokeGeometryCache,
imageFilterCache, maskFilterCache, nodePictureCache
```

9개 캐시 모두 단일 `destroyRenderer()` 경로. `destroyed` flag 로 idempotent. WASM 메모리 누수 회피.

### 1-6. 노드 단위 textPicture 캐시

`scene-graph/index.ts:402`:

```ts
if (node.textPicture && textChanged) node.textPicture = null;
```

각 텍스트 노드가 자기 `Picture` 보유 — 텍스트 변경 없으면 record 비용 회피.

---

## 2. openpencil — 평면화 + RBush + dirty-flag (라이트)

### 2-1. 단일-pass 매 frame 전체 그리기

위치: `openpencil/packages/pen-renderer/src/renderer.ts` (395 LOC)

```ts
private startRenderLoop() {
  const loop = () => {
    this.animFrameId = requestAnimationFrame(loop);
    if (!this.dirty || !this.surface) return;   // dirty flag 만 차단
    this.dirty = false;
    this.render();
  };
}
```

- **picture cache 없음, backing 없음**. 매 frame 전부 그리기
- `markDirty()` 가 변경 트리거 → RAF 안 `dirty=false` 면 skip
- `renderNodes` 배열 단순 for-loop → `nodeRenderer.drawNode()`

### 2-2. Document → flatten RenderNode 한 번

```ts
private syncFromDocument() {
  const resolved = resolveRefs(pageChildren, allNodes);              // ref 해소
  const variableResolved = resolved.map(n =>
    resolveNodeForCanvas(n, vars, theme));                            // 변수 치환
  const measured = premeasureTextHeights(variableResolved);           // 텍스트 측정
  this.renderNodes = flattenToRenderNodes(measured);                  // tree → flat
  this.spatialIndex.rebuild(this.renderNodes);                        // R-tree
  this.markDirty();
}
```

tree DFS 는 setDocument / setPage / setThemeVariant 시 1회. 매 frame 회피. `RenderNode { absX, absY, absW, absH, clipRect, node }` — 절대 좌표 사전 계산.

### 2-3. RBush (R-tree) spatial index

위치: `openpencil/packages/pen-renderer/src/spatial-index.ts` (201 LOC)

- 외부 lib `rbush` (Vladimir Agafonkin, mapbox/leaflet 산하 — 검증된 R-tree)
- `tree.search({minX, minY, maxX, maxY})` → bbox 교차 후보 → `zIndex` desc 정렬
- `hitTest(x, y)` O(log n) + 보이지 않는 노드 자동 제외:
  - `opacity ≤ 0`
  - fill/stroke 둘 다 없는 frame/group
  - `resolveColorAlpha` 으로 hex/rgba alpha 확인
- `searchRect()` 로 marquee 선택도 처리

### 2-4. premeasureTextHeights — fixed-width + auto-height 1회 보정

`document-flattener.ts:41-119`:

- `_measureCtx` Canvas 2D context 모듈-수준 lazy 재사용
- trigger 조건: `textGrowth === 'fixed-width'` + `height !== 'fill_container'/'fit_content'`
- `wrapLine()` 의 CJK 문자별 줄바꿈 vs 라틴 단어별 줄바꿈 분기 (`paint-utils.ts:120-176`)

### 2-5. Viewport culling primitive — **정의되어 있으나 미사용**

`viewport.ts:74-101`:

```ts
export function isRectInViewport(rect, vpBounds): boolean {
  return !(
    rect.x + rect.w < vpBounds.left ||
    rect.x > vpBounds.right ||
    rect.y + rect.h < vpBounds.top ||
    rect.y > vpBounds.bottom
  );
}
```

primitive 있으나 `renderer.ts:325-328` 의 main loop 에서 사용 안 함. read-only viewer 라 viewport 외에도 전부 그림 (`zoomToFit()` UX 가 핵심).

### 2-6. 정리

- **개념**: viewer 수준 (Figma → SVG export viewer 비슷). 편집 budget 압박 없음
- **장점**: 코드 단순 (pen-renderer 전체 3,048 LOC), R-tree hit-test 만 견고
- **격차**: 캐시 0, GPU/draw-call 측정 0, paint pool 부재 (각 노드가 `new Paint()` 가능성)

---

## 3. Pencil.app — koffi native Skia + 4-process Electron (binary 분석)

### 3-1. 확정 사항

| 영역                                  | 단서                                                                                               |
| ------------------------------------- | -------------------------------------------------------------------------------------------------- |
| **renderer = native Skia (not WASM)** | `node_modules/koffi/` — C FFI binding. CanvasKit WASM 미사용                                       |
| **process 분리**                      | `Frameworks/Pencil Helper (GPU).app`, `Helper (Plugin).app`, `Helper (Renderer).app`, `Helper.app` |
| **AI dual embed**                     | `@openai/codex` + `codex-darwin-arm64` + `@anthropic-ai/claude-agent-sdk` + native binary          |
| **MCP 서버**                          | `out/mcp-server-darwin-arm64` — 외부 도구가 Pencil 조작 가능                                       |
| **clipboard native**                  | `@mariozechner/clipboard-darwin-universal` — Electron clipboard API 우회                           |
| **CFBundleIdentifier**                | `dev.pencil.desktop`, v1.1.57, macOS SDK 15.5                                                      |

### 3-2. 추정 (asar 본체 접근 불가)

- 렌더 전략 미확정. koffi C FFI = WASM marshaling 비용 회피 → 더 공격적 캐시 가능
- macOS Metal 직접 호출 시 → `MTKView` + `MTLBuffer` retained mode 가능
- WebGL2 timer query 보다 정밀한 GPU profiling 가능

### 3-3. 외부 관찰된 UX 단서 (memory: pencil-component-visual-markers)

- origin: magenta + solid outline / instance: violet + dotted
- `Cmd+Opt+K` 토글 / `Cmd+Opt+X` detach
- Properties 패널 `##Component section##` + `##Slot section##` 헤더 구조

→ 렌더 최적화보다 edit-time 응답성에 집중한 흔적.

---

## 4. composition 현재 패턴과 정합 평가

| 영역                            | composition 현재                          | open-pencil                             | openpencil              | Pencil.app                    |
| ------------------------------- | ----------------------------------------- | --------------------------------------- | ----------------------- | ----------------------------- |
| **렌더러**                      | Skia WASM 단일 (ADR-100)                  | Skia WASM                               | Skia WASM               | **Skia native (koffi C FFI)** |
| **picture cache**               | ❌ 없음 (매 frame 전체)                   | ✅ 3-tier (scene/backing/subtree)       | ❌ 없음                 | 추정 ✅ (asar 미공개)         |
| **viewport culling**            | 부분적 (treeBounds 순회)                  | ✅ worldViewport + 3x backing           | primitive 있으나 미사용 | 추정 ✅                       |
| **spatial index**               | linear 순회 (buildTreeBoundsMap)          | scene-graph absPosCache                 | ✅ RBush R-tree         | 미확정                        |
| **paint pool**                  | ad-hoc 잔존 가능                          | ✅ 35+ paint singleton                  | 부분적                  | 추정 ✅                       |
| **dirty flag**                  | ✅ sceneVersion + layoutVersion (ADR-136) | sceneVersion + positionPreviewVersion   | 단순 boolean            | 미확정                        |
| **profiler/HUD**                | longtask gate (ADR-069) 뿐                | ✅ phase + GPU + draw-call + speedscope | ❌ 없음                 | 추정 ✅                       |
| **node-level Picture cache**    | ❌                                        | ✅ subtreePictureCache + textPicture    | ❌                      | 미확정                        |
| **stale-zoom preview**          | ❌                                        | ✅ allowStaleZoom + idle interval 측정  | ❌                      | 추정 ✅                       |
| **incremental build budget**    | ❌                                        | ✅ 6ms cursor 패턴                      | ❌                      | 미확정                        |
| **layer 분리 (scene/overlays)** | ❌ 단일 layer                             | ✅ `'full' / 'scene' / 'overlays'`      | ❌                      | 미확정                        |

---

## 5. ultrathink 종합 — 5개 본질적 시사

### 5-1. composition 의 가장 큰 격차는 "cache hierarchy" 가 아니라 **측정 인프라**

3-tier cache 도입은 큰 ADR. 그러나 **무엇이 느린지 모르면** cache 설계 자체가 추측. open-pencil 의 `scenePictureMissReason` (7가지 분류) + `phase` 측정 + draw-call count + speedscope export 가 **선결 단계**. composition 의 ADR-069 longtask gate 는 전체 응답성만 측정, 노드/단계 breakdown 안 함.

### 5-2. retained backing 의 두 축 — **incremental budget + stale-zoom 허용**

open-pencil 의 핵심 통찰: 6ms 안에 못 끝나는 backing build 를 cursor 로 N frame 에 걸쳐 진행하면서, 그 사이 **stale image 를 scale 변환해 보여줌**. 사용자는 "blur 잠시 → crisp 복원" UX 를 받고 60fps 끊김 없음. composition 의 ADR-100 Unified Skia 와 직각으로 결합 가능 (Unified Skia = 단일 렌더러 결정, retained backing = 그 위 캐싱 전략).

### 5-3. RenderLayer 분리는 **architecture 결정**, 단순 최적화 아님

`'full' | 'scene' | 'overlays'` 3-layer 는 selection 변경 시 scene 캐시 유지 + overlay 만 다시 그리기. composition 은 현재 selection 변경 시 전체 재그리기 (추정). 이 분리는 **렌더 호출자(builder UI)** 가 어느 layer 를 재요청할지 알아야 함 → store-bridge 계약 변경 필요.

### 5-4. openpencil 의 RBush 는 **즉시 도입 가능 단일 변경**

composition 의 `buildTreeBoundsMap` 이 매 hit-test 마다 linear 순회. RBush 외부 lib (npm `rbush`, 4.6kB minified) 도입은 ADR 1개 / 1주 영역. open-pencil 의 3-tier cache 보다 ROI 우선순위 높음 (영향 면적 작음 + 확정 효과).

### 5-5. Pencil.app 의 native Skia 는 **이번 사이클 비-목표**

koffi C FFI native binding = Electron Builder + node-gyp 빌드 체계 + macOS/Windows/Linux 3-binary 유지. composition 의 Vite + Tauri 부재 환경에서 이 영역 진입은 ADR 5+ 개. **단**, Pencil.app 의 dual AI SDK (Codex + Claude Agent) 임베드 + MCP server 는 ADR-134 (이미 Proposed) 의 reference 로 즉시 활용 가능.

---

## 6. 후속 조사 후보 (사용자 결정 영역)

각 항목은 별도 ADR 또는 조사 task. 본 문서는 현황 보고만, 처방 아님.

1. **profiler 인프라** — open-pencil `profiler/render-profiler.ts` 패턴을 composition 에 차용. ADR-069 확장 또는 신규 ADR.
2. **RBush spatial index** — `buildTreeBoundsMap` linear 순회 → R-tree 교체. 단일 ADR 영역.
3. **node-level Picture cache (T3)** — composition 의 ElementSprite/StoreRenderBridge 위 textPicture 류 추가. T1/T2 보다 부분 도입 쉬움.
4. **RenderLayer 분리** — store-bridge 계약 재설계 영향 큼. 조사 phase 필요.
5. **scenePicture (T1)** — `PictureRecorder` 전체 페이지 캐시. composition 의 sceneVersion (ADR-136) 와 invalidate 키 정합 검증 필요.
6. **sceneBacking (T2) — 가장 큰 영역**. incremental budget + stale-zoom + 3x viewport — 3-4 phase ADR.
7. **Paint pool audit** — composition 의 ad-hoc `new Paint()` 사용 grep 후 SSOT 통합. 단일 ADR.

---

## 출처 / 메서드

### 소스 직접 read

- `/Users/admin/work/open-pencil/packages/core/src/canvas/renderer/{retained-backing,pipeline,paints,lifecycle}.ts` (4 파일, 1,036 LOC)
- `/Users/admin/work/open-pencil/packages/core/src/profiler/render-profiler.ts` (173 LOC)
- `/Users/admin/work/openpencil/packages/pen-renderer/src/{renderer,spatial-index,viewport,paint-utils,document-flattener}.ts` (5 파일, 1,284 LOC)

### 보조 grep

- `open-pencil/packages/core/src/scene-graph/index.ts` (absPosCache + textPicture 패턴)
- `openpencil/packages/pen-renderer/src/` 의 wc -l 전수

### Pencil.app — binary 메타만

- `Info.plist`, `Frameworks/`, `Resources/app.asar.unpacked/{node_modules,out}/` (선행 문서 `PENCIL_ECOSYSTEM_ANALYSIS.md` Section 2 와 동일)
- app.asar (165MB) 본체 read 미수행 — closed-source binary 접근 한계 명시

### 미수행 영역 (한계)

- open-pencil 의 `node-renderer.ts` 1,170 LOC 본체 read — 시간 ROI 판단으로 skip. 노드별 그리기 디테일이 본 분석 결론에 영향 없음
- open-pencil 의 `frame/` 디렉토리 frame profiler 세부
- openpencil 의 `pen-engine` (browser/ + core/) — pen-renderer 와 분리된 별 패키지, 메모리/이벤트 영역 가능성
- Pencil.app asar 본체 — 별도 추출 도구 (`asar extract`) 필요. 사용자 명시 요청 시 진행

---

## 관련 메모리

- [project-autonomy-maturity-model](memory) — Wave A/A\* 패턴 (본 분석 결과의 처방 단계에 적용 가능)
- [feedback-composition-enterprise-target](memory) — composition = 엔터프라이즈급 빌더. open-pencil 의 retained backing 은 **차용 후보 / Must**
- [feedback-no-fallback-thinking](memory) — open-pencil 의 `MakeSWCanvasSurface` fallback 은 composition target 차용 후보에서 제외
- [feedback-describe-vs-prescribe-separation](memory) — 본 문서는 현황 보고 layer, 처방 layer 아님
