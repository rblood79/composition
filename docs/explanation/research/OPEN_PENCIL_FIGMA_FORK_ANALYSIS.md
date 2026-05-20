# OpenPencil (open-pencil, Figma 호환 포크) 정밀 분석 리포트

> **분석 일자**: 2026-05-20
> **분석 대상**: `/Users/admin/work/open-pencil` (하이픈 표기, v0.12.2)
> **저자/저작권**: Danila Poyarkov + 오픈소스 컨트리뷰터 (MIT)
> **저장소**: https://github.com/open-pencil/open-pencil
> **분석 방법**: README/AGENTS.md/package.json/소스 read-only 조사 + Explore agent 2회 dispatch
> **분석 범위**: 프로젝트 전반 + 그래픽 렌더링 서브시스템 심층
>
> **다른 OpenPencil 과 구분**: `docs/explanation/research/OPENPENCIL_ANALYSIS.md` 는 ZSeven-W 의 `/Users/admin/work/openpencil` (한 단어, v0.7.5, React 19 + TanStack Start) 분석. **본 문서는 다른 프로젝트** — 동명이지만 저자/스택/목표 모두 상이.

---

## 1. 프로젝트 개요

| 항목         | 내용                                                      |
| ------------ | --------------------------------------------------------- |
| **이름**     | OpenPencil (open-pencil)                                  |
| **버전**     | 0.12.2 (2026-05-19)                                       |
| **저자**     | Danila Poyarkov + 오픈소스 컨트리뷰터 (Anton Soldatov 등) |
| **저장소**   | https://github.com/open-pencil/open-pencil                |
| **라이선스** | MIT                                                       |
| **카테고리** | 디자인 에디터 (Figma 대체)                                |
| **상태**     | 활발한 개발 중 (주 단위 릴리스, 프로덕션 준비 단계)       |
| **타겟**     | 디자이너 + 개발자 + AI 에이전트 (Figma 호환 워크플로)     |

OpenPencil 은 **Figma 호환** 오픈소스 디자인 에디터로, `.fig` 파일을 네이티브로 읽고/쓰며 Figma Plugin API 를 emulate 합니다. **완전히 스크립트 가능**한 것이 차별점 — CLI, XPath 쿼리, MCP 서버, 디스크톱 에이전트 통합을 1급 시민으로 지원합니다.

### 핵심 차별점

- **AI 내장**: 100+ tools 를 갖춘 멀티 프로바이더 AI 어시스턴트 (Anthropic, OpenAI, Google AI, OpenRouter, DeepSeek)
- **헤드리스/프로그래머블**: CLI, XPath 쿼리, MCP 서버 (stdio + HTTP)
- **실시간 협업**: Yjs CRDT + Trystero WebRTC P2P (서버 불필요, 계정 미필요)
- **크로스 플랫폼**: Tauri v2 데스크톱 (macOS/Windows/Linux, 7MB) + 웹 PWA
- **설계-투-코드**: JSX/Tailwind 내보내기, 디자인 토큰 추출, 컴포넌트 기반 워크플로

---

## 2. 기술 스택

### 렌더링 & 레이아웃

| 기술           | 버전              | 용도                                       |
| -------------- | ----------------- | ------------------------------------------ |
| CanvasKit WASM | 0.40.0            | Skia 래퍼 (Canvas/WebGL 그래픽)            |
| Yoga WASM      | 3.3.0-grid.3 포크 | Flex + CSS Grid 레이아웃 (OpenPencil 포크) |

### UI & 프레임워크

| 기술       | 버전   | 용도                                    |
| ---------- | ------ | --------------------------------------- |
| Vue 3      | 3.5.29 | 근본 앱 UI 프레임워크                   |
| Reka UI    | 2.9.0  | Vue SDK 용 헤드리스 컴포넌트 라이브러리 |
| Tailwind 4 | 4.2.1  | 유틸리티 CSS, `@tailwindcss/vite`       |
| Motion V   | 2.0.0  | 애니메이션 라이브러리                   |

### 파일 형식 & 협업

| 기술               | 버전    | 용도                            |
| ------------------ | ------- | ------------------------------- |
| Kiwi 바이너리 포맷 | 커스텀  | `.fig` / `.pen` 인코딩          |
| fzstd              | 0.1.1   | Zstd 압축                       |
| fflate             | 0.8.2   | ZIP 아카이브                    |
| Yjs                | 13.6.29 | CRDT (Conflict-free Replicated) |
| Trystero           | 0.22.0  | WebRTC P2P 시그널링             |
| y-indexeddb        | 9.0.12  | IndexedDB 저장소                |

### AI & MCP

| 기술                                       | 버전    | 용도                     |
| ------------------------------------------ | ------- | ------------------------ |
| Vercel AI SDK                              | 6.0.174 | 멀티 프로바이더 추상화   |
| @ai-sdk/{anthropic,openai,google,deepseek} | -       | 프로바이더별 어댑터      |
| @modelcontextprotocol/sdk                  | 1.27.1  | MCP 서버/클라이언트      |
| Hono                                       | 4.12.5  | HTTP MCP 서버 프레임워크 |
| OpenRouter                                 | -       | 통합 API 게이트웨이      |

### 텍스트 & 벡터

| 기술        | 버전   | 용도                               |
| ----------- | ------ | ---------------------------------- |
| OpenType.js | 1.3.4  | 폰트 파싱, 글리프 outline (측정용) |
| Culori      | 4.0.2  | 색상 파싱 & OkHCL 공간             |
| SVGPath     | 2.6.0  | 경로 파싱                          |
| Sucrase     | 3.35.1 | JSX 렌더러용 빠른 코드 변환        |
| Fontoxpath  | 3.34.0 | XPath 쿼리 (설계 노드 검색)        |

### 데스크톱 & 빌드

| 기술     | 버전  | 용도                           |
| -------- | ----- | ------------------------------ |
| Tauri v2 | -     | Rust 기반 크로스 플랫폼 런타임 |
| Vite     | 8.0.0 | 빌드 도구                      |
| Bun      | -     | 패키지 관리자 (`bun.lock`)     |
| tsdown   | -     | TypeScript 번들러 (npm 배포용) |

### 품질 도구

| 기술       | 버전   | 용도                                |
| ---------- | ------ | ----------------------------------- |
| Oxlint     | 1.50.0 | Rust 기반 린터 (17KB 규칙)          |
| Oxfmt      | 0.35.0 | Rust 기반 포매터                    |
| Playwright | 1.58.2 | E2E 시각적 회귀 테스트 (188 테스트) |
| Bun Test   | -      | 유닛 테스트 (764 테스트)            |
| Steiger    | 0.5.12 | 아키텍처 린트 (패키지 경계)         |
| JSCPD      | 4.0.8  | 코드 중복 감지                      |

---

## 3. 모노레포 구조 (Bun Workspace)

OpenPencil 은 5개 패키지 + 근본 앱(`src/`)으로 구성된 모노레포입니다.

| 패키지             | NPM 이름            | 역할                                                     | 크기      |
| ------------------ | ------------------- | -------------------------------------------------------- | --------- |
| **core**           | `@open-pencil/core` | 엔진 (씬그래프, 렌더러, 레이아웃, 파일 포맷, 도구)       | 2.2MB TS  |
| **vue**            | `@open-pencil/vue`  | 헤드리스 Vue 3 SDK (Reka UI 스타일) — 커스텀 셸/임베딩용 | -         |
| **cli**            | `@open-pencil/cli`  | 헤드리스 CLI (검사, 내보내기, 린트) — citty 기반         | -         |
| **mcp**            | `@open-pencil/mcp`  | MCP 서버 (stdio + HTTP) — Claude Code/Cursor 통합 — Hono | -         |
| **docs**           | `@open-pencil/docs` | VitePress 문서 사이트                                    | -         |
| **src/** (근본 앱) | -                   | Tauri/Vue 데스크톱 & 웹 에디터                           | 15 도메인 |

### Core 도메인 구조 (Subpath Exports)

Core 는 정교한 **subpath export 모델**로 임포트 부담을 최소화합니다 — heavy dependency 격리, DOM-free engine:

```
@open-pencil/core/scene-graph    — SceneGraph, 노드 타입, 히트테스트, 스냅
@open-pencil/core/canvas         — SkiaRenderer (Skia/CanvasKit)
@open-pencil/core/editor         — createEditor, EditorState (13 모듈)
@open-pencil/core/kiwi           — .fig 파싱/직렬화, 바이너리 코덱
@open-pencil/core/io             — IORegistry, 포맷 어댑터
@open-pencil/core/io/formats/*   — fig, pen, jsx, raster, svg 포맷
@open-pencil/core/lint           — 디자인 린트 규칙
@open-pencil/core/tools          — ToolDef, 모든 도구, AI 어댑터
```

### App Layer 도메인 (`src/app/*`)

프레임워크 중립 에디터 코어 위에 Vue 레이어를 추가합니다:

```
ai/         — AI 어시스턴트, 프로바이더 설정, 프롬프트
editor/     — EditorSession (Vue 래퍼), 문서 I/O, 자동저장, 벡터 편집
tabs/       — 탭 관리, 활성 에디터 접근
automation/ — Tauri RPC, MCP WebSocket 라우팅
collab/     — 실시간 협업 (Yjs CRDT + Trystero P2P)
shell/      — 상단 바, 메뉴, 패널 레이아웃
document/   — 파일 저장/로드, Tauri 파일 플러그인
demo/       — 데모 라우터
tauri/      — Tauri-specific 플러그인, IPC
```

---

## 4. 에디터 상태 머신 아키텍처

`createEditor()` 팩토리가 **13개 모듈**을 조립하여 상태 관리, 뷰포트, 도구, 선택, 언두/리도를 통합합니다:

```
EditorContext
├── types.ts       — EditorState, EditorOptions, EditorEvents
├── create.ts      — createEditor() 어셈블러
├── viewport.ts    — screenToCanvas, zoom, pan, fit
├── selection.ts   — select, clearSelection, marquee, snap
├── pages.ts       — switchPage, addPage, deletePage
├── shapes.ts      — createShape, pen tool, adoptNodes
├── structure.ts   — group, ungroup, reorder, reparent
├── components.ts  — component/instance/detach/componentSet
├── clipboard.ts   — duplicate, copy, paste, delete
├── undo.ts        — commitMove/Resize/Rotation, snapshot/restore
├── text.ts        — startTextEditing, commitTextEdit
├── nodes.ts       — updateNode, updateNodeWithUndo, setLayoutMode
└── tools.ts       — ALL_TOOLS (100+), tool dispatch
```

**이벤트 버스 (Nanoevents)**:

- `selection:changed`, `tool:changed`, `page:changed`, `viewport:changed`
- `render:requested`, `repaint:requested` (성능 최적화 핵심)
- `node:created/updated/deleted/reparented` (씬그래프)
- Vue SDK: `useEditorEvent(event, handler)` composable

### 씬그래프 모델

```typescript
SceneGraph
├── pages: Page[]
├── components: Component[]
├── variables: VariableCollection[]
├── node(id): SceneNode
├── children(parentId): SceneNode[]
├── reparent(nodeId, parentId)
└── emitter: nanoevents

SceneNode Types:
  - Frame, Section, Group
  - Component, ComponentSet, Instance
  - Text, Vector, Ellipse, Rectangle, Polygon, Line
  - BooleanGroup
```

---

## 5. 그래픽 렌더링 서브시스템 (심층)

### 5.1 렌더링 파이프라인 전체 흐름

```
씬그래프 변경
  ↓ requestRender() / requestRepaint() 호출
  ↓ sceneVersion++ 또는 renderVersion++
  ↓ emitEditorEvent (nanoevents)
RAF 스케줄러 (frame coalescing)
  ↓
pipeline.ts: canvas.save → scale(dpr) → translate(pan) → scale(zoom)
  ↓
scene.ts renderNode() (재귀, viewport culling)
  ↓
SkiaRenderer.renderShape/renderText/renderVector
  ↓ Paint/Path/Shader 캐시에서 가져옴
canvas.drawPath / drawParagraph / drawPicture
  ↓
overlays layer (선택박스, snap, ruler) — 별도 pass
  ↓
surface.flush() → 화면
```

### 5.2 `requestRender` vs `requestRepaint` 분리 설계 ⭐

`packages/core/src/editor/create.ts:78`:

```typescript
function requestRender() {
  state.renderVersion++;
  state.sceneVersion++;
  emitEditorEvent("render:requested", { renderVersion, sceneVersion });
}

function requestRepaint() {
  state.renderVersion++;
  emitEditorEvent("repaint:requested", { renderVersion, sceneVersion });
}
```

- **`requestRender()`** — 씬그래프 구조 변경 (노드 추가/속성/레이아웃) → `sceneVersion++` → Picture 재기록 필요
- **`requestRepaint()`** — 디스플레이 갱신만 (선택 변경/hover) → `renderVersion++` → 캐시된 Picture 재사용

v0.12.0 의 "이벤트 기반 렌더링" 전환은 폴링 RAF 루프 제거 + 이벤트 driven 으로 idle 시 0 work.

### 5.3 CanvasKit/Skia 사용 패턴

**WASM 격리** — `packages/core/src/canvaskit.ts` 만 런타임 import, 나머지는 `import type` → 헤드리스 Bun 실행 가능.

**Paint 객체 풀** (`renderer/paints.ts:13-111`): 고정 **11개 Paint** 미리 생성 (fillPaint / strokePaint / dashPaint / shadowPaint / textPaint / overlayPaint 등). 매 draw call 에서 `setColor` / `setShader` 만 mutate — 매번 `new ck.Paint()` 호출 안 함.

**Path/Picture/Filter 캐시** (`renderer.ts`):

```typescript
vectorPathCache: Map<nodeId, Path[]>;
nodePictureCache: Map<nodeId, SkPicture>;
subtreePictureCache: Map<nodeId, SubtreePictureCacheEntry>;
imageFilterCache: Map<key, ImageFilter>;
maskFilterCache: Map<sigma, MaskFilter>;
```

**Resource 해제 명시** (`renderer.ts:542`):

```typescript
invalidateVectorPath(nodeId: string): void {
  const cache = this.vectorPathCache.get(nodeId);
  if (old) {
    for (const p of old) p.delete();  // WASM 메모리 누수 방지
    cache.delete(nodeId);
  }
}
```

### 5.4 노드별 그리기 (Draw Functions)

| 노드                      | 렌더 방식                                                         |
| ------------------------- | ----------------------------------------------------------------- |
| Frame / Rectangle / RRect | RRect path + fill/stroke + effects                                |
| Ellipse / Arc             | arc path                                                          |
| Line                      | stroke-only                                                       |
| Vector                    | cached `Path[]` (codepoint/manual)                                |
| **BooleanGroup**          | Skia `path.op()` Union/Difference/Intersect/XOR (`boolean.ts:11`) |
| Text                      | CanvasKit `Paragraph.layout()` + `canvas.drawParagraph()`         |
| Group/Component/Instance  | 자식 재귀만                                                       |

**Stroke align**: Figma 호환 위해 INSIDE/CENTER/OUTSIDE 분기 — Skia 기본 CENTER 외에는 path 자체 inflate.

**Boolean Operations** (`boolean.ts:11`):

```typescript
const BOOLEAN_PATH_OP = {
  UNION: "Union",
  SUBTRACT: "Difference",
  INTERSECT: "Intersect",
  EXCLUDE: "XOR",
};
```

Skia `PathOp` enum 과 direct mapping.

### 5.5 좌표 변환 — 전역 행렬 단일 적용

`pipeline.ts:175`:

```typescript
canvas.save();
canvas.scale(dpr, dpr); // DPR retina
canvas.translate(panX, panY);
canvas.scale(zoom, zoom);
// 콘텐츠 렌더
canvas.restore();
```

노드별 transform 누적이 아닌 **surface 전체 한 번** — pan/zoom 비용 거의 0. `screenToCanvas` 도 단순 역산 (`(sx - panX) / zoom`).

회전 노드 culling 은 대각선 보수 판정 (`scene.ts:35`) — false positive 허용 (안전 sweep).

### 5.6 오버레이 — 별도 layer pass

`pipeline.ts:200`:

```typescript
if (layer !== "overlays") {
  // Scene 렌더 (picture 캐시 사용 가능)
} else {
  r.drawSelection(canvas, graph, selectedIds, overlays);
  r.drawSnapGuides(canvas, overlays.snapGuides);
  r.drawMarquee(canvas, overlays.marquee);
  r.drawRulers(canvas, graph, selectedIds);
}
```

**Scene 캐시 유지하면서 UI 만 빠르게 갱신** — 마우스 hover/marquee drag 시 scene 재기록 없음.

### 5.7 성능 최적화 — Retained Backing 패턴 (핵심 ⭐⭐)

`renderer/retained-backing.ts`:

```typescript
const SCENE_BACKING_SCALE = 3; // viewport 3배 미리 렌더
const SCENE_BACKING_BUILD_BUDGET_MS = 6; // 16.6ms 중 6ms 만 build 에 사용
```

**3배 oversample 캐시**:

- 정지 상태에서 viewport 의 3배 영역을 미리 raster 캐시
- pan/zoom 중에는 **캐시 이미지만 transform** (재렌더 0) — 60fps 보장
- 정지 후 2-18 idle frame 대기 → 새 viewport 기준으로 crisp 재캐시

추가 패턴:

- **Node Picture cache**: 무거운 노드 (vector path 많은 그룹) 의 paint 결과를 `SkPicture` 로 — scene picture 안에 `drawPicture()` 만 삽입
- **Viewport culling** (`scene.ts:35`): AABB 빠른 판정 + 회전 시 대각선 보수
- **WASM ↔ JS 비용 최소화**: `_tmpColor` / `_tmpRect` Float32Array 재사용 (GC 압박 제거)

### 5.8 텍스트 렌더링 — Paragraph + opentype.js 측정 전용

```typescript
// 측정: opentype.js (Figma 호환성 검증용)
OpenTypeSync.parse(bytes).stringToGlyphs(text); // advance width 검증

// 렌더링: CanvasKit Paragraph
paragraph.layout(maxWidth);
canvas.drawParagraph(paragraph, x, y);
```

opentype.js 는 **측정 전용**, 실제 그리기는 CanvasKit Paragraph API. Figma 호환 측정 (em square, advance width) 을 검증하기 위해 opentype 결과와 비교.

**Fallback chain**:

```typescript
fontManager.ensureCJKFallback().then((families) => {
  if (families.length > 0) r.invalidateAllPictures(); // 폰트 도착 시 전체 재캐시
});
fontManager.ensureArabicFallback();
```

### 5.9 헤드리스 렌더링 (Node/Bun)

`@open-pencil/core` 는 DOM 의존 0:

```typescript
IS_BROWSER ? window.devicePixelRatio : 1;
```

CanvasKit WASM 의 **offscreen surface** → `surface.makeImageSnapshot()` → Uint8Array → PNG/JPG/WEBP encode. CLI export 가 이 경로로 동작.

### 5.10 핵심 파일 reference

- `packages/core/src/canvas/renderer.ts:1` — SkiaRenderer 클래스 (628 줄)
- `packages/core/src/canvas/renderer/pipeline.ts:175` — transform stack
- `packages/core/src/canvas/renderer/retained-backing.ts:1` — 3x oversample 캐시
- `packages/core/src/canvas/renderer/paints.ts:13` — Paint pool 초기화
- `packages/core/src/canvas/scene.ts:35` — viewport culling
- `packages/core/src/canvas/scene.ts:138` — renderNode 분업
- `packages/core/src/canvas/boolean.ts:11` — Skia PathOp 매핑
- `packages/core/src/editor/create.ts:78` — render/repaint 분리

---

## 6. 개발 워크플로 & 품질 관리

### Git Workflows (7개 GitHub Actions)

| 워크플로        | 역할                                        |
| --------------- | ------------------------------------------- |
| ci.yml          | 린트, 타입체크, 유닛/E2E 테스트 (모든 커밋) |
| build.yml       | 데스크톱 + CLI 빌드 (macOS, Windows, Linux) |
| app.yml         | 웹 앱 배포 (app.openpencil.dev)             |
| docs.yml        | 문서 배포 (openpencil.dev)                  |
| homebrew.yml    | macOS Homebrew tap                          |
| preview.yml     | PR 미리보기                                 |
| heavy-tests.yml | Figma 호환성 e2e (별도)                     |

### 품질 게이트 (`bun run`)

```bash
bun run check          # oxlint + tsgo + vue-tsc + arch + i18n + dupes
bun run lint           # type-aware oxlint + structure lint
bun run test           # Playwright (188 e2e 테스트)
bun run test:unit      # Bun unit (764 테스트)
bun run format         # oxfmt
bun run check:arch     # Steiger 아키텍처 검증
```

### 린트 정책 (`oxlint.json`, 489줄)

- Rust 기반 플러그인 6개 (typescript, import, unicorn, vue, promise, node)
- 커스텀 app lint 규칙 (`./lint/plugin.js`)
- `no-console` 경고 (allow: warn, error, debug, time, timeEnd)
- 엄격한 import 정렬 (workspace, external, internal)

### 테스트 전략

1. **Playwright E2E** (188 테스트)
   - 시각적 회귀: 스냅샷 비교 (maxDiffPixelRatio: 0.01)
   - 프로젝트: openpencil, openpencil-webkit, figma (Figma 호환성)
   - 2x 기기 스케일, 1280×800 뷰포트

2. **Bun Unit** (764 테스트)
   - `tests/engine/` — 코덱, 씬그래프, 레이아웃 유닛
   - 커버리지 리포트 가능

3. **시각적 비교 도구**
   - `bun run visual-compare` — 렌더링 결과 비교 (CI 호환성 검증)

---

## 7. CHANGELOG 최근 동향 (활발한 개발)

| 버전       | 날짜       | 주요 변화                                                                      |
| ---------- | ---------- | ------------------------------------------------------------------------------ |
| **0.12.2** | 2026-05-19 | OpenRouter 커스텀 모델 + 로컬 알림 + MCP 개선                                  |
| **0.12.1** | 2026-05-19 | .fig 라운드트립 수정 + 웹 폰트 픽커 + Tauri 경로 처리                          |
| **0.12.0** | 2026-05-18 | 애셋 패널, 컴포넌트 variants, 변수 modes, PDF 내보내기, **이벤트 기반 렌더링** |
| **0.11.8** | 2026-04-23 | Windows MCP 수정                                                               |
| **0.11.7** | 2026-04-22 | Stdio MCP 서버, 헤드리스 폰트 측정, XPath CLI                                  |
| **0.11.6** | 2026-04-08 | tsdown 빌드 마이그레이션                                                       |
| **0.11.5** | 2026-04-08 | npm 배포 publishConfig 수정                                                    |
| **0.11.4** | 2026-04-08 | Core package 임포트 경로 수정 + save_file MCP                                  |
| **0.11.3** | 2026-04-08 | 레이어 이름 바꾸기, 회전 히트 테스트, 글꼴 폴백                                |
| **0.11.2** | 2026-04-06 | 렌더링 확대/축소 최적화                                                        |

**개발 활동**: 매우 활발 (일주일에 여러 릴리스, 성능/호환성에 집중)

---

## 8. 파일 통계

| 메트릭          | 값                            |
| --------------- | ----------------------------- |
| TypeScript 파일 | ~327 (tests/ 포함)            |
| Core src 크기   | 2.2MB                         |
| Canvas renderer | 628줄 (SkiaRenderer 코어)     |
| Lint rules      | 489줄 (oxlint.json)           |
| E2E 테스트      | 188개 (Playwright)            |
| Unit 테스트     | 764개 (Bun)                   |
| 언어            | TypeScript, Vue, Rust (Tauri) |

---

## 9. Composition 과의 비교

### 9.1 프로젝트 차원

| 측면              | OpenPencil (open-pencil)          | composition                      |
| ----------------- | --------------------------------- | -------------------------------- |
| **목표**          | Figma 호환 디자인 에디터          | 노코드 웹 빌더 (RAC 기반)        |
| **파일 형식**     | `.fig` (Figma) + `.pen` (자체)    | canonical document → DB          |
| **렌더링**        | CanvasKit/Skia ⭐ 동일            | CanvasKit/Skia (ADR-100 통합)    |
| **레이아웃**      | Yoga WASM (Flex+Grid 커스텀 포크) | Taffy WASM                       |
| **UI 프레임워크** | Vue 3 + Reka UI                   | React 19 + React Aria Components |
| **상태**          | Yjs CRDT (P2P)                    | Zustand + Jotai + TanStack Query |
| **백엔드**        | 없음 (P2P + 로컬)                 | Supabase                         |
| **AI**            | 100+ tool 내장, 멀티 프로바이더   | Groq SDK, agent loop, MCP 일부   |
| **데스크톱**      | Tauri v2 (7MB)                    | (계획 단계)                      |
| **타겟 사용자**   | 디자이너 + 개발자 (Figma 유저)    | 비개발자 + AI 에이전트           |

### 9.2 렌더링 구현 디테일 비교

| 영역              | OpenPencil (open-pencil)                    | composition                                      |
| ----------------- | ------------------------------------------- | ------------------------------------------------ |
| **노드 모델**     | Class-based SceneNode (Frame/Rectangle/...) | Spec-driven (런타임 schema, ADR-036/142)         |
| **렌더 트리거**   | `requestRender` / `requestRepaint` 분리     | `layoutVersion` 단일 카운터 (ADR-135/136)        |
| **변환 적용**     | Surface 전체 1회 (canvas.scale + translate) | 동일 (DirectContainer 패턴, ADR-100)             |
| **텍스트 측정**   | opentype.js (검증) + Paragraph (렌더)       | CanvasKit Paragraph 단일 (canvaskitTextMeasurer) |
| **Paint 객체**    | 고정 11 pool, mutate 재사용                 | Skia native path 별 생성 추정                    |
| **Picture cache** | node + subtree 2단계                        | 미확인 (점검 가치)                               |
| **Backing 전략**  | 3x oversample + idle re-crisp               | 미적용                                           |
| **이벤트 모델**   | nanoevents (`render:requested` 등)          | Zustand subscribeWithSelector                    |
| **Boolean ops**   | Skia `path.op()` 직접                       | 미해당 (벡터 편집 없음)                          |

### 9.3 composition 이 차용 가능한 패턴 5선

#### 1. `requestRender` / `requestRepaint` 분리 ⭐ 가장 직접적

현재 `layoutVersion++` 단일 트리거가 layout-affecting 과 visual-only 변경을 같이 invalidate. 분리 시:

- 색상/opacity/effect 변경 → `repaint` (Picture 캐시 유지)
- layout/structure 변경 → `render` (Picture 재기록)

ADR-136 sceneVersion signature 와 직교 — 본 분리는 Picture 캐시 레이어 추가 시 가치 발현. **선결 조건: Picture 캐시 도입**.

#### 2. Retained Backing (3x oversample) ⭐⭐ 큰 win 가능

zoom/pan 중 60fps 유지의 표준 패턴. composition pencil import / 대형 frame 작업 시 zoom 부드러움 개선. 구현 비용 중간 (idle scheduler + invalidation 정책 필요).

#### 3. Paint 객체 pool

매 draw 마다 Paint allocate → setColor → drop 패턴이 있으면 GC 압박. 11개 고정 pool + mutate 패턴은 검증된 모델.

#### 4. Subtree Picture cache

큰 그룹 (reusable frame 등) 의 paint 결과 `SkPicture` 캐싱. ADR-135 frame projection 도입 후 frame 단위 캐싱 자연스러움.

#### 5. opentype.js 측정 검증 layer

**채택 비추천** — composition 은 이미 CanvasKit Paragraph 단일 SSOT 로 정착 (`canvas-rendering.md §3`). 외부 라이브러리 추가는 `feedback-text-layout-breakage` 의 "post-layout 교정" 원칙과 충돌. **단**, Figma 호환 export 가 필요해질 경우 검증 layer 로만 도입.

### 9.4 아키텍처 차원에서 차용 가능

1. **Core 의 subpath export 모델** — DOM-free engine 격리. composition `packages/specs` / `packages/shared` 분할 보강 참고축
2. **이벤트 버스 + requestRender 패턴** (Nanoevents) — composition 의 `notifyLayoutChange()` / `layoutVersion` 과 철학 유사
3. **Steiger arch lint** — 패키지 경계 자동 검증. composition 도 도입 검토 여지
4. **시각 회귀 테스트** (Playwright maxDiffPixelRatio 0.01) — composition `/cross-check` 자동화 확장 모델
5. **MCP 서버 표준화** — stdio + HTTP 이중 endpoint, `OPENPENCIL_MCP_ROOT` 환경변수로 파일 액세스 범위 제한 모델

---

## 10. 결론

본 OpenPencil (open-pencil, Danila Poyarkov 의 Figma 호환 포크) 은 composition 과 **렌더링 엔진 (Skia/CanvasKit) 을 공유**하면서도 **완전히 다른 목표 (Figma 호환 디자인 도구 vs 노코드 웹 빌더)** 를 가진 프로젝트입니다. composition 의 관점에서 본 OpenPencil 은:

- **Skia 활용 모범 사례**의 참조원 — Paint pool, Picture cache, retained backing, opentype 측정 검증 등 검증된 패턴 다수 보유
- **헤드리스 / 프로그래머블 디자인 도구**의 reference — `@open-pencil/core` 의 DOM-free 모델, CLI/MCP 통합 표준화
- **CRDT 협업의 사례** — Yjs + Trystero 조합 (composition 이 향후 협업 도입 시 참고)

차용 우선순위:

1. `requestRender` / `requestRepaint` 분리 (선결: Picture 캐시 도입)
2. Retained Backing 3x oversample
3. Paint pool 적용
4. Subtree Picture cache (ADR-135 projection 직후 자연스러움)

분석 시점에 OpenPencil 은 0.12.2 — 활발한 개발 중이므로 이 리포트의 일부 디테일은 빠르게 stale 될 수 있음. 차용 결정 시 최신 코드 재확인 필요.

---

**참조 commit**: open-pencil `main` HEAD 2026-05-19 시점 (분석 dispatch 2026-05-20)

**관련 문서**:

- `OPENPENCIL_ANALYSIS.md` — ZSeven-W 의 `/Users/admin/work/openpencil` (한 단어, v0.7.5, React 19 + TanStack Start) 분석. 동명이지만 다른 프로젝트
