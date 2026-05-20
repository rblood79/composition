# OpenPencil 프로젝트 분석

> **분석 일자**: 2026-05-20
> **분석 대상**: `/Users/admin/work/openpencil` (현재 버전 v0.7.5)
> **이 문서의 scope**: ① 프로젝트 전체 구조 / ② 렌더링 파이프라인 심층
> **목적**: composition 프로젝트와의 비교·차용 가능 패턴 발굴
> **분석 방법**: Explore agent (Read/Grep 기반 코드 추적). "확인 안 됨" 명시 부분은 코드 미발견 영역
> **다른 분석과의 관계**: 같은 디렉토리에 다른 scope 의 OpenPencil 분석이 추가될 수 있음 (예: `OPENPENCIL_AI_*.md`, `OPENPENCIL_MCP_*.md` 등). 본 문서는 architecture + rendering 한정

---

## 1. 정체성

- **세계 최초의 오픈소스 AI-네이티브 벡터 디자인 도구** (Pencil.dev 대안). MIT 라이선스 (© 2026 ZSeven-W)
- 핵심 키워드: **Concurrent Agent Teams** / **Design-as-Code** / **Built-in MCP Server** / **Multi-model Intelligence**
- 16개 언어 README (전 지구적 목표), 현재 버전 **v0.7.5**
- 공개 OSS — GitHub `ZSeven-W/openpencil`

---

## 2. Monorepo 구조 (Bun workspaces)

### apps/ (3개)

| 앱           | 역할                                                          |
| ------------ | ------------------------------------------------------------- |
| `web`        | TanStack Start + Nitro 백엔드 + Vite 7 + React 19 + Skia WASM |
| `desktop`    | Electron 35 패키징 (Nitro fork + IPC + electron-updater)      |
| `cli` (`op`) | 터미널 제어 도구, WebSocket(:9821) 으로 에디터 연결           |

### packages/ (12개, 위상순)

```
pen-types  →  pen-core  ← pen-figma
                ↓
         pen-engine / pen-renderer
                ↓
       pen-react / pen-mcp / pen-codegen
                ↓
              pen-sdk
pen-ai-skills (독립), pen-acp (Agent Client Protocol), agent-native (Zig submodule)
```

| 패키지          | 설명                                                 |
| --------------- | ---------------------------------------------------- |
| `pen-types`     | PenDocument 타입 정의 (모든 패키지의 기초, 의존 0)   |
| `pen-core`      | 문서 트리 연산, 레이아웃 엔진, 변수 시스템           |
| `pen-engine`    | 헤드리스 디자인 엔진 (프레임워크 독립)               |
| `pen-react`     | React UI SDK (Provider, Canvas, hooks, 패널)         |
| `pen-figma`     | Figma `.fig` 파일 파서·변환기 (uzip)                 |
| `pen-renderer`  | **독립형 CanvasKit/Skia 렌더러** — 실제 렌더링 엔진  |
| `pen-mcp`       | MCP 서버 구현 (Claude Code/Codex/Gemini 통합)        |
| `pen-sdk`       | 통합 SDK (모든 패키지 재export)                      |
| `pen-ai-skills` | AI 프롬프트 스킬 엔진 (md + YAML frontmatter)        |
| `pen-acp`       | Agent Client Protocol 서버                           |
| `pen-codegen`   | React/HTML/Vue/Flutter/SwiftUI/Compose/RN 코드 생성  |
| `agent-native`  | **Zig NAPI 네이티브 AI 에이전트 런타임** (submodule) |

---

## 3. 기술 스택

| 영역      | 채택                                                                                             |
| --------- | ------------------------------------------------------------------------------------------------ |
| 런타임/PM | **Bun ≥1.0** + Node 18+ + Zig 0.15.2 (agent-native)                                              |
| 프론트    | React 19.2 / TanStack Router 1.168 / Zustand 5 / Tailwind v4 / shadcn/ui                         |
| 렌더링    | **CanvasKit/Skia 0.40** (WASM, GPU) + Paper.js (boolean path) + rbush (공간 인덱스)              |
| 빌드      | Vite 7 / esbuild / Nitro nightly / electron-builder 26                                           |
| 린트      | **oxlint** + **oxfmt** (Rust 기반 고속)                                                          |
| AI SDK    | Anthropic 0.77 + claude-agent-sdk 0.2.47 + OpenCode + Copilot + Gemini + MCP 1.12.1 + ACP 0.18.2 |
| 기타      | isomorphic-git, kiwi-schema, i18next (15개 언어), html2canvas                                    |

---

## 4. `.op` 파일 포맷 (PenDocument)

JSON 기반, **암호화 없음** (MCP 보호 정책일 뿐 실제는 평문), Git diff 친화적.

```typescript
// packages/pen-types/src/pen.ts
interface PenDocument {
  version: string; // "1.0"
  themes?: Record<string, string[]>;
  variables?: Record<string, VariableDefinition>;
  pages?: PenPage[];
  children: PenNode[];
}
```

**노드 타입**: `frame` (auto-layout) / `group` / `rectangle` / `ellipse` / `line` / `polygon` / `path` / `text` / `image` / `icon_font` / `ref` (컴포넌트 인스턴스)

**변수**: `$variable-name` 참조 → 코드 생성 시 CSS `var(--variable-name)`. 다중 테마 축 (Light/Dark × Compact/Comfortable 등)

**컴포넌트 시스템**: `FrameNode { reusable: true, slot: string[] }` = origin, `RefNode` = instance

---

## 5. MCP 서버 (`pen-mcp` — 이 repo 안 내장)

`packages/pen-mcp/src/server.ts` — stdio/HTTP 전송

도구 분류:

- **Document**: open, save, get, selection
- **Node**: insert, update, delete, move, copy, replace
- **Design**: `batch_design`, `design_skeleton`, `design_content`, `design_refine` (3-Phase 워크플로)
- **Variable**: get/set/set_themes
- **Codegen**: plan → submit_chunk → assemble → clean
- **Style Guide**: 50+ 내장 스타일(glassmorphism, brutalist, retro …) + fzstd 퍼지 매칭
- **Debug** (`OPENPENCIL_DEBUG_TOOLS=1`): screenshot, validation, logs tail

---

## 6. AI 스킬 엔진 (`pen-ai-skills`)

- `skills/*.md` (YAML frontmatter: phase / trigger / priority / budget / category)
- `vite-plugin-skills.ts` 가 빌드타임 컴파일 → `_generated/skill-registry.ts`
- Runtime: Loader → Resolver (조건부 선택) → Budget (토큰 추적)

```yaml
---
name: "hero-section"
description: "Generate landing page hero"
phase: "design_skeleton"
trigger: "keyword:hero OR keyword:landing"
priority: 100
budget: 2000
category: "layout"
---
```

composition 의 `.claude/skills/*.md` 와 직접 대응 — 다만 OpenPencil 은 **빌드타임 컴파일** 로 한 단계 더 SSOT.

---

## 7. agent-native (Zig NAPI submodule)

- 별도 repo (`ZSeven-W/agent`) git submodule
- `zig build napi -Doptimize=ReleaseFast` 또는 prebuilt `.node` 다운로드 (arch/platform 별)
- 멀티 프로바이더 추상화 + streaming + thinking mode adaptive
- 지원: Anthropic / OpenAI / Gemini / OpenCode / Copilot / Kimi / Zhipu / GLM

---

## 8. 빌드·실행

```bash
bun --bun run dev               # 웹 dev (3000)
bun --bun run build             # 웹 prod
bun run electron:dev            # Electron dev
bun run electron:build          # web build → esbuild(main/preload/mcp/cli) → agent-native bundle → electron-builder
bun run cli:compile             # apps/cli/dist/openpencil-cli.cjs
bun run mcp:dev / mcp:compile   # MCP stdio 서버
bun run test                    # Vitest 3.0.5
bun run lint / format           # oxlint / oxfmt
bun run bump <version>          # 전 package.json 동기화
```

**Docker 멀티스테이지**: builder(Zig+Bun) → base(226MB) → with-claude/codex/… → full(~1GB)

---

## 9. CI/CD & Hook

| 워크플로             | 트리거       | 동작                                                              |
| -------------------- | ------------ | ----------------------------------------------------------------- |
| `ci.yml`             | push/PR main | lint + format check + type check + test + web build + CLI compile |
| `build-electron.yml` | tag v\*      | macOS(arm64+x64)/Win/Linux → GitHub Release                       |
| `publish-cli.yml`    | tag v\*      | npm 발행 (위상순)                                                 |
| `docker.yml`         | push/tag     | ghcr.io push                                                      |

**`.githooks/pre-commit`**: 브랜치명 → 버전 추출 → 전 package.json sync → oxfmt format → oxlint → re-add staged

---

## 10. 배포 채널

- **npm**: `@zseven-w/*`
- **GitHub Releases**: DMG / NSIS / AppImage / deb (electron-updater 자동 업데이트)
- **Homebrew**: `brew tap zseven-w/openpencil && brew install --cask openpencil`
- **Scoop** (Win)
- **Docker**: `ghcr.io/zseven-w/openpencil:{base,with-claude,full,…}`

---

# Part B — 렌더링 파이프라인 심층

## 11. 핵심 경로 한눈에

```
PenDocument (JSON)
  → Zustand store
  → resolveRefs (component instance 펼침)
  → resolveNodeForCanvas ($variable 해석)
  → premeasureTextHeights (Canvas 2D 측정)
  → computeLayoutPositions (자체 flex-like 엔진)
  → flattenToRenderNodes (절대 좌표화)
  → SpatialIndex.rebuild (rbush R-tree)
  → requestAnimationFrame (dirty flag)
  → SkiaEngine.render
      ├ canvas.scale(dpr)
      ├ canvas.concat(viewportMatrix) — zoom/pan
      ├ viewport culling + visibility 체크
      └ SkiaNodeRenderer.drawNode (타입별 Skia API)
  → WebGL (GPU) 또는 SW (CPU fallback)
  → HTMLCanvasElement → 브라우저 compositor → 픽셀
```

---

## 12. Skia/CanvasKit 초기화 — `pen-renderer` 가 진짜 엔진

**WASM 로딩**: `packages/pen-renderer/src/init.ts:46-63`

- `canvaskit-wasm` 동적 import
- `locateFile` 기본값 `/canvaskit/` (정적 서빙)
- `apps/web/src/canvas/skia/skia-init.ts` 는 단순 re-export

**Surface 생성**: `packages/pen-renderer/src/renderer.ts:87-98`

```typescript
this.surface = this.ck.MakeWebGLCanvasSurface(canvas); // GPU 우선
if (!this.surface) this.surface = this.ck.MakeSWCanvasSurface(canvas); // CPU fallback
```

- DPR 적용: `canvas.width = clientWidth * dpr`
- WebGL 실패 시 자동 CPU 래스터라이저 폴백 — **분기 명시적**

**폰트 로딩**: `packages/pen-renderer/src/font-manager.ts`

- `TypefaceFontProvider` 사용
- 번들 폰트 (Inter / Noto Sans SC / KR / JP 등 `.woff2`) `/fonts/` fetch
- Google Fonts CDN 폴백
- `loadedFamilies` / `failedFamilies` / `systemFontFamilies` Set 으로 상태 분류 → **시스템 폰트는 vector 경로 포기, bitmap 강제**

---

## 13. 렌더 루프 — Dirty Flag + Culling 만, dirty rect 없음

`packages/pen-renderer/src/renderer.ts:297-305`

```typescript
const loop = () => {
  this.animFrameId = requestAnimationFrame(loop);
  if (!this.dirty || !this.surface) return;
  this.dirty = false;
  this.render(); // 전체 화면 재그리기
};
```

- **부분 invalidation 없음** — dirty 1bit 만
- **culling 있음**: `getViewportBounds(zoom, panX, panY, w, h, margin=64/zoom)` + `isRectInViewport(rect, vpBounds)` (skia-engine.ts:245-256)
- markDirty 트리거: setDocument / setPage / setViewport / 폰트 로드 완료 / 이미지 로드 완료
- vsync 동기 (60/120fps), 별도 throttle 없음

---

## 14. 노드 → Skia draw command (`node-renderer.ts`)

타입별 매핑:

| PenNode.type                    | Skia API                                                                                           |
| ------------------------------- | -------------------------------------------------------------------------------------------------- |
| `rectangle` / `frame` / `group` | `drawRect` 또는 `drawRRect(RRectXY)`                                                               |
| `ellipse`                       | `drawOval` / `drawPath` (arc)                                                                      |
| `line`                          | `drawLine`                                                                                         |
| `polygon`                       | 점 계산 → `drawPath`                                                                               |
| `path`                          | `Path.MakeFromSVGString` → `drawPath` (실패 시 manual parser fallback, 실패 시 bbox rect fallback) |
| `text`                          | Vector(Paragraph) 시도 → 실패 시 bitmap                                                            |
| `image`                         | `drawImageRect`                                                                                    |
| `icon_font`                     | SVG path → `drawPath`                                                                              |

**Paint 생성** (`node-renderer.ts:110-225` fill / `:416-441` stroke):

- `Paint` 객체 매 draw 마다 new + delete (**pool 패턴 없음** — GC 부담 잠재 영역)
- gradient: `Shader.MakeLinearGradient` / `MakeRadialGradient` + `TileMode.Clamp`
- dash: `PathEffect.MakeDash([dash, gap], offset)`
- shadow: `MaskFilter.MakeBlur(Normal, blur/2, true)` — Skia 규약상 blur radius 절반

**Color 파싱** (`paint-utils.ts:10-48`): #RGB / #RRGGBB / #RRGGBBAA / rgba() → `Color4f(r/255, g/255, b/255, a)` 정규화. fallback `#d1d5db`.

---

## 15. 레이아웃 엔진 — 자체 구현 (Yoga/Taffy 아님)

`packages/pen-core/src/layout/engine.ts` — 순수 JS/TS, WASM 비의존

**Flex-like 알고리즘** (composition 의 Taffy 와 대조 포인트):

- `getNodeWidth(node, parentAvail)`: 명시 숫자 → `'fill'` (부모 잔여) → `'fit'` (자식 기반 intrinsic) → 텍스트는 Canvas 2D 측정
- `computeLayoutPositions(parent, children)`:
  - `layout: 'horizontal' | 'vertical'`
  - `gap` / `padding` / `justifyContent` / `alignItems` (flex-start/center/flex-end/space-between)
  - `'fill'` 자식들은 `remainingMain / fillCount` 로 분배 — flex-grow:1 과 동치

**캐싱 전략**: **없음**. 매 `syncFromDocument()` 때 전 트리 재계산. 텍스트 높이만 `premeasureTextHeights()` 에서 Canvas 2D `measureText` 로 사전 측정 후 mutated tree 반환.

---

## 16. 텍스트 — Vector 우선, Bitmap fallback (3단 캐시)

`packages/pen-renderer/src/text-renderer.ts:129-154`

```typescript
drawText() {
  if (shadow) drawTextShadow();         // glyph-shaped (사각형 X)
  if (drawTextVector()) return;          // CanvasKit Paragraph 성공 시
  drawTextBitmap();                       // Canvas 2D → CanvasKit Image
}
```

**Vector 경로** (`:160-299`): `ParagraphBuilder.MakeFromFontProvider` + `ParagraphStyle`:

- `textAlign` / `fontFamilies` (fallback chain) / `letterSpacing` / `heightMultiplier` / `halfLeading:true`
- 세그먼트 스타일 (`tNode.content[]`): `pushStyle` / `addText` / `pop` 으로 inline run
- 폰트 미로드 시:
  - 시스템 폰트면 즉시 `false` 반환 (bitmap path)
  - 외부 폰트면 `ensureFont(family).then(clearParaCache + onFontLoaded)` 비동기 로드 + 폴백 chain 있으면 vector 시도

**3단 캐시** (`:15-35`):

| Cache                                   | 용량   |
| --------------------------------------- | ------ |
| `textCache` (bitmap result)             | 256 MB |
| `paraCache` (Paragraph 객체)            | 64 MB  |
| `paraImageCache` (래스터화된 Paragraph) | 128 MB |

캐시 키: `p|content|size|color|weight|family|align|width|letterSpacing|lineHeight`

**측정** (`pen-core/src/layout/text-measure.ts`): `estimateTextWidth` (glyph 테이블 빠른 추정) / `estimateTextWidthPrecise` (Canvas 2D TextMetrics) / `wrapLine` (단어 단위 + 문자 이진탐색 줄바꿈)

---

## 17. Hit-Test — rbush R-tree + zIndex

`packages/pen-renderer/src/spatial-index.ts:28-52`

```typescript
rebuild(nodes: RenderNode[]) {
  this.tree.clear();
  const items = nodes.map((rn, i) => ({
    minX: rn.absX, minY: rn.absY,
    maxX: rn.absX + rn.absW, maxY: rn.absY + rn.absH,
    nodeId: rn.node.id, renderNode: rn, zIndex: i,  // 렌더 순서 = z-order
  }));
  this.tree.load(items);  // bulk-insert O(n)
}

hitTest(sx, sy) {
  const candidates = this.tree.search({ minX:sx, minY:sy, maxX:sx, maxY:sy });
  candidates.sort((a, b) => b.zIndex - a.zIndex);  // 위에서부터
  return candidates.filter(isPointHittableRenderNode);
}
```

**Hittability 규칙** (`:92-113`):

- opacity ≤ 0 → non-hittable
- 빈 frame/group (fill/stroke/effects 모두 없음) → **non-hittable** (자식만 hit)
- 빈 rectangle → hittable

**좌표 변환** (`viewport.ts`):

```typescript
viewportMatrix(vp) → [zoom,0,panX, 0,zoom,panY, 0,0,1]  // CanvasKit 3x3 column-major
screenToScene(cx, cy, rect, vp) → { x: (cx-rect.left-panX)/zoom, y: ... }
zoomToPoint(vp, sx, sy, rect, newZoom) → 커서 아래 scene point 고정하고 pan 재계산
```

zoom 범위: `[0.01, 20]`

---

## 18. Variable 해석 — 렌더 직전, 캐싱 없음

`packages/pen-core/src/variables/resolve.ts:206-250`

```typescript
resolveNodeForCanvas(node, variables, activeTheme) {
  // opacity / gap / padding / fill[].color / stroke.thickness / effects[].blur
  // 각각 isVariableRef($로 시작) 체크 → resolveNumericRef / resolveColorRef
}

resolveVariableRef(ref, vars, theme) {
  const def = vars[ref.slice(1)];
  const val = def.value;
  if (Array.isArray(val)) return resolveThemedValue(val, theme);
  if (typeof val === 'string' && val.startsWith('$')) return undefined;  // circular guard
  return val;
}
```

- **순환 참조 방지**: 1-hop 만 처리 → `$a → $b → $c` 는 silent undefined
- **테마 매칭**: `activeTheme = { mode:'light', size:'sm' }` 같은 다축 → `themedValue.theme` 객체와 전체 일치 항목 선택, 없으면 첫 값
- **캐싱 없음**: theme switch 시 `syncFromDocument()` 전체 재해석 (대형 문서에서 잠재 비용)

---

## 19. Sync 락 — 단방향 + 드래그 suppression

`apps/web/src/canvas/skia/skia-engine.ts:70-72`

```typescript
dragSyncSuppressed = false; // 드래그 중에는 syncFromDocument skip
```

- composition 의 `canvas-sync-lock` 양방향 락보다 단순
- 드래그 중 레이아웃 엔진이 시각 위치 덮어쓰는 것 방지가 본질

**Sync 흐름** (`:166-203`):

```
getActivePageChildren → resolveRefs → resolveNodeForCanvas
  → premeasureTextHeights → computeLayoutPositions
  → flattenToRenderNodes → spatialIndex.rebuild → markDirty
```

---

## 20. Viewport — Skia matrix concat 한 번으로 끝

`skia-engine.ts:237-240`

```typescript
canvas.save();
canvas.scale(dpr, dpr);
canvas.concat(viewportMatrix({ zoom, panX, panY }));
// 모든 노드는 scene 좌표계로 그리기 (Skia 가 변환)
canvas.restore();
```

**Zoom-to-fit** (`renderer.ts:180-207`): renderNodes 의 bbox 합 → `(canvasW - padding*2) / contentW` / `contentH` 중 작은 값 (최대 2x) → pan 으로 center 정렬.

**Frame label / Agent badge** 는 `1/zoom` 스케일로 그려져 zoom 무관 일정 크기 유지 (`node-renderer.ts:330-394`).

---

## 21. 성능 — 무엇이 있고 무엇이 없나

**있음**:

- viewport culling
- spatial index (hit-test O(log n))
- text 3단 캐시 (256+64+128 MB)
- image async loading + `flushPending()` (export 직전 대기)
- bulk insert (`tree.load`)

**없음 (혹은 미확인)**:

- ❌ dirty rect (전체 재그리기)
- ❌ paint pool (매 draw 마다 new/delete)
- ❌ layout 캐시 (매 sync 전 트리 재계산)
- ❌ variable resolve 캐시
- ❌ WebWorker layout
- ❌ FPS counter (확인 안 됨)
- ❌ adaptive LOD
- ❌ node virtualization (Skia 가 자체 culling 하지만 트리 트래버스는 매번)

---

## 22. AI streaming 중 부분 렌더 — Overlay 5단

`skia-engine.ts:259-342`

```
1. 일반 노드 렌더
2. drawAgentGlow (frame 주변 aura, breath = sin(π·t) bell curve, 1.2s)
3. drawAgentBadge (agent 이름)
4. drawAgentBorder (개별 노드 border, agent 색상)
5. drawAgentPreviewFill (반투명 채우기)
```

agent indicator 진행률 시각화. cancel cleanup 메커니즘은 코드상 확인 안 됨 (agentFrames map 에서 제거 + sync 재호출 추정).

---

## 23. Export

| 종류                       | 경로                                                                               |
| -------------------------- | ---------------------------------------------------------------------------------- |
| PNG (래스터)               | `surface.makeImageSnapshot()` → `encodeToBytes()` (확인 안 됨 — 함수 시그니처만)   |
| SVG                        | **미지원** (코드상 export 메서드 없음)                                             |
| 코드 (React/Vue/Flutter/…) | `pen-codegen` 패키지 (별도 파이프라인)                                             |
| MCP `get_screenshot`       | `PenRenderer.renderToImageData()` 또는 surface snapshot — 정확한 진입점 확인 안 됨 |

---

# Part C — composition 과의 직접 대비

## 24. 공유 개념

- **Canonical Document = SSOT** (composition `CompositionDocument` ↔ OpenPencil `PenDocument`)
- **Zustand v5** 양방향 동기화 + 순환 방지 락
- **컴포넌트 origin/instance/override** 모델 (composition ADR-116/122/130 ↔ OpenPencil `reusable` frame + `ref` node)
- **토큰/변수 시스템** (composition `{color.*}` TokenRef ↔ OpenPencil `$variable`)
- **Multi-page**

## 25. 차이점

| 측면              | OpenPencil                                              | composition                                     |
| ----------------- | ------------------------------------------------------- | ----------------------------------------------- |
| Skia 사용처       | Web + Electron 양쪽                                     | Builder 한정 (Preview 는 DOM)                   |
| 렌더 분기         | WebGL → SW fallback **자동**                            | WebGL (단일)                                    |
| 레이아웃 엔진     | 자체 JS flex-like (`pen-core/layout`)                   | **Taffy WASM** (Flex/Grid/Block)                |
| 텍스트            | Vector + Bitmap **양쪽 fallback**                       | Vector only (CanvasKit Paragraph + halfLeading) |
| 텍스트 캐시       | 3단 (256+64+128 MB)                                     | LRU `{width,height}` 결과만 (WASM 객체 미캐시)  |
| Hit-test          | **rbush R-tree** O(log n)                               | boundsMap traverse + tree                       |
| Variable 해석     | 매 sync 전 재해석 (캐시 없음)                           | TokenRef → CSS variable 사전 변환               |
| Sync 락           | 단방향 + dragSuppressed bit                             | canonical update → rebuildIndexes 순서 규약     |
| 부분 invalidation | ❌ (dirty 1bit)                                         | ❌ (동일)                                       |
| Paint pool        | ❌                                                      | ❌ (동일)                                       |
| Viewport culling  | ✅ margin = 64/zoom                                     | ✅                                              |
| 무한 캔버스       | ✅ zoom [0.01, 20]                                      | ✅                                              |
| 진입점            | Web + Electron + CLI + MCP **네이티브**                 | Web Builder 중심                                |
| AI 인프라         | Concurrent Agent Teams + 스킬 엔진 + agent-native (Zig) | Groq Tool Calling + agent loop                  |
| 데스크톱          | Electron 정식                                           | 미지원                                          |
| Lint              | **oxlint** (Rust, 고속)                                 | ESLint                                          |
| 국제화            | 16개 언어                                               | 미지수                                          |

## 26. composition 이 차용 검토 가능한 패턴

1. **rbush 공간 인덱스** — composition 의 `buildTreeBoundsMap` traverse 대비 hit-test 빠름
2. **3단 텍스트 캐시 + 용량 한도** — composition 은 결과 dict 만 LRU, paragraph 객체 자체 미캐시
3. **WebGL → SW 자동 fallback** — composition 은 Skia 한정, 컨텍스트 손실 시 복구 경로 부재
4. **AI streaming overlay 5단** (glow/badge/border/preview-fill) — composition AI 패널이 canvas 위 indicator 표시 시 참조 가능
5. **단방향 `dragSyncSuppressed` bit** — composition 다층 락 대비 단순. 단 양방향 mutation (canonical edit + drag) 동시 처리 필요 시 부족할 수 있음
6. **`pen-ai-skills` 빌드타임 스킬 컴파일** — composition `.claude/skills` 가 markdown 그대로 로드하는 구조 대비 더 강한 SSOT (vite plugin)
7. **Concurrent Agent Teams orchestrator** — 페이지를 공간 서브태스크로 분해해 병렬 에이전트 실행 (composition 의 `dispatching-parallel-agents` 보다 도메인-aware)
8. **CLI `op` + WebSocket(:9821)** — 터미널에서 에디터 실시간 제어 (composition 은 dev server only)
9. **Model Capability Profiles** (Full/Standard/Basic-tier) — thinking mode adaptive switching

## 27. composition 이 OpenPencil 보다 앞선 영역

- **Taffy WASM** (grid/flex/block 통합 + 증분 갱신)
- **D1/D2/D3 SSOT 분할** (RAC ARIA / RSP props / Spec 시각)
- **canonical document schema + projection** (page-frame ID 공간 분리, ADR-135/136)
- **layoutVersion 3-심볼 체인** (캐시 invalidation 정합성)
- **ADR-Risk First 템플릿** + framing checkpoint (절차적 거버넌스)

---

## 28. 주요 파일 경로 (참고용)

| 항목                     | 경로                                                 |
| ------------------------ | ---------------------------------------------------- |
| 문서 모델 타입           | `packages/pen-types/src/pen.ts`                      |
| 핵심 연산                | `packages/pen-core/src/` (tree/layout/variables)     |
| Skia/CanvasKit 초기화    | `packages/pen-renderer/src/init.ts:46-63`            |
| Surface 생성             | `packages/pen-renderer/src/renderer.ts:87-98`        |
| 렌더 루프                | `packages/pen-renderer/src/renderer.ts:297-342`      |
| Shape 렌더링             | `packages/pen-renderer/src/node-renderer.ts:482-900` |
| Paint (Fill/Stroke)      | `packages/pen-renderer/src/node-renderer.ts:110-441` |
| 텍스트 (Vector)          | `packages/pen-renderer/src/text-renderer.ts:160-350` |
| Layout Engine            | `packages/pen-core/src/layout/engine.ts`             |
| Variable Resolution      | `packages/pen-core/src/variables/resolve.ts:206-250` |
| Document Flattening      | `packages/pen-renderer/src/document-flattener.ts`    |
| Spatial Index (Hit-test) | `packages/pen-renderer/src/spatial-index.ts`         |
| Viewport Transform       | `packages/pen-renderer/src/viewport.ts`              |
| Font Manager             | `packages/pen-renderer/src/font-manager.ts`          |
| Image Loading            | `packages/pen-renderer/src/image-loader.ts`          |
| SkiaEngine (Web 래퍼)    | `apps/web/src/canvas/skia/skia-engine.ts`            |
| MCP 서버                 | `packages/pen-mcp/src/server.ts` + `routes/`         |
| AI 스킬                  | `packages/pen-ai-skills/skills/` + `engine/`         |
| CLI                      | `apps/cli/src/commands/`                             |
| Electron                 | `apps/desktop/main.ts`                               |

---

## 29. 분석 한계 / 확인 안 된 영역

이 분석은 Read/Grep 기반 정적 추적이며 다음 영역은 코드 미발견 또는 부분 추정:

- `drawTextBitmap()` 본문 (text-renderer.ts:400+ 길이 초과)
- PNG export 진입점 (정확한 함수 시그니처)
- MCP `get_screenshot` 의 surface snapshot 호출 위치
- AI streaming cancel 시 partial cleanup 메커니즘
- FPS counter / dev mode overlay 존재 여부
- Electron 환경에서의 GPU 가속 차이 (코드상 분기 없음)
- 사용자 framing 비교 — pencil app 외부 reference 와의 일치도

추가 조사 필요 시 위 영역을 좁혀 별도 분석 권장.
