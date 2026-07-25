# Pen (구 Pencil) v1.2.1 데스크탑 앱 실측 분석 — 렌더링 · UI/UX 중심

> **작성일**: 2026-07-26
> **분석 대상**: `docs/pencil-extracted/` (Pen.app v1.2.1 번들 추출본, gitignored) — `Resources/app.asar` (182MB) 를 `@electron/asar` 로 전개해 실측
> **방법**: 병렬 에이전트 3개 (렌더링 파이프라인 / UI/UX 구조 / AI 통합·생태계·델타) 로 minified 번들·WASM strings·바이너리 증거 기반 분석. 추정이 아닌 실측 — 각 판정에 증거 심볼/문자열 인용
> **선행 문서**: [PENCIL_ECOSYSTEM_ANALYSIS.md](PENCIL_ECOSYSTEM_ANALYSIS.md) (2026-05-27, v1.1.57 메타데이터 추정) · [PENCIL_RENDERING_OPTIMIZATION.md](PENCIL_RENDERING_OPTIMIZATION.md) (2026-05-28) · [PENCIL_VS_XSTUDIO_UI_UX.md](../../legacy/PENCIL_VS_XSTUDIO_UI_UX.md) (2026-02, v1.1.10)
> **⚠️ 본 문서가 선행 3개 문서의 Pencil.app 서술을 부분 반증한다** — §7 델타 표 참조. 선행 문서의 openpencil / open-pencil 부분은 본 문서와 무관하게 유효
> **관련 메모리**: `project-pen-v121-extraction-analysis`

---

## 0. 결론 우선

1. **앱 정체**: "Pencil" → **"Pen" (pen.dev)** 리브랜딩 진행 중. `package.json` = `name: "pen"`, `productName: "Pen"`, repo `github:highagency/pen-desktop-releases`. `out/pen-migration.js` 가 구 Pencil.app 을 자동 제거·이관.
2. **렌더러 반증**: "native Skia (koffi FFI)" 추정은 틀렸다. 실체는 **자체 C++ emscripten 빌드 `pencil.wasm` (9.5MB, Skia m149 임베드)** — stock CanvasKit 도 native FFI 도 아닌 제3의 경로. koffi 는 node_modules 에 존재하지 않는다.
3. **PixiJS 반증**: v1.1.10 에서 관측된 "PixiJS 오버레이 Layer 2" 는 v1.2.1 에서 소멸 — PixiJS v8.3.4 코드가 번들에 끌려와 있으나 렌더러 인스턴스화 0건. 오버레이 포함 전부 자체 Skia WASM 렌더. **composition 의 ADR-900 (PixiJS 제거 + Skia 단일 렌더러) 과 같은 방향으로 독립 수렴**.
4. **.pen 포맷 반증**: "closed format" 이 아니라 **평문 pretty-printed JSON** (정식 스키마 v2.14, `@ha/schema/pen.schema.json` 38KB). MCP 서버 instructions 의 "encrypted" 문구는 기술 사실이 아니라 에이전트가 파일을 직접 편집하지 못하게 하는 가드레일 지시문.
5. **아키텍처 요지**: "얇은 wasm (렌더+텍스트측정+path+PDF), 두꺼운 JS (scene graph+레이아웃+히트테스트+컬링)". 캔버스 단일 렌더러 — HTML 은 일방향 export 산출물. composition 의 "Skia ↔ DOM 대등 2-consumer (D3 SSOT)" 와 근본적으로 다른 제품 전제.
6. **AI 통합이 중심축**: Claude/Codex/Cursor/Gemini/pi 5계열 에이전트 + 자체 인퍼런스 프록시, `spawn_agents` 병렬 오케스트레이션, batch_design 부분-JSON 스트리밍 라이브 렌더, 외부 코딩 CLI 7종에 MCP 자동 설치.

---

## 1. 전체 아키텍처 개관

```
Pen.app (Electron)
├── main process (out/main.js, app.js)
│   ├── 1 파일 = 1 BrowserWindow = 1 DesktopResourceDevice
│   ├── pencil:// 커스텀 프로토콜로 에디터 서빙
│   ├── chokidar — 열린 .pen 파일 외부 변경 감시 → 라이브 리로드
│   ├── AI 에이전트 러너 (claude.js / codex.js / agent-config-manager.js)
│   └── unix socket (~/.pencil/socket) — 외부 MCP 바이너리 프록시
└── renderer (out/editor/ — React + Tailwind v4)
    ├── assets/index.js (5.6MB) — 에디터 본체: scene graph, 레이아웃, 인터랙션, AI 채팅
    ├── assets/pencil.wasm (9.5MB) — 자체 Skia 바인딩 (C API 385개)
    ├── emscripten-module.browser-*.js ×2 — QuickJS 샌드박스 (goodies 스크립트 실행)
    └── goodies/ + images/styles/ — 셰이더·스크립트·스타일 프리셋 데이터
```

- UI 프레임워크: React (`react-dom` 시그널). 상태는 자체 SceneManager/StateManager 클래스 계열.
- 캔버스: WebGL2 단일 (`ze.GetWebGLContext(canvas, {antialias:false, alpha:false})`).
- 텍스트 편집·커서만 DOM, 나머지 캔버스 chrome 전부 Skia 렌더 (§5.4).

---

## 2. 렌더링 엔진 — pencil.wasm 의 정체와 경계

### 2-1. "자체 제작 CanvasKit"

- 증거: wasm strings 에 `/Users/jansedivy/Documents/scratch/pencil-wasm/third_party/skia/include/...`, `Skia/PDF m149`, SkSL 컴파일러 소스 경로, harfbuzz/freetype/ICU74. **embind 문자열 0건** — 공식 CanvasKit 과 달리 순수 C API + 수제 JS wrapper (`ze` 네임스페이스, `ze.MakeOnScreenGLSurface` / `ze.Paint` 등 CanvasKit 과 유사한 API 형태).
- export 는 417개 (이름 minified) 이고, index.js 의 emscripten glue 가 `e._pencil_canvas_clear=U.jd` 식으로 **`pencil_*` 385개 함수**에 매핑.

### 2-2. C API 분포 (385개 전수)

| prefix                               | 개수 | 책임                                                                                                                                  |
| ------------------------------------ | :--: | ------------------------------------------------------------------------------------------------------------------------------------- |
| `pencil_path*`                       |  66  | SkPath/PathBuilder/PathEffect — `path_contains`, `make_from_svg`, `to_svg`, `simplify`, `trim`, boolean op                            |
| `pencil_canvas*`                     |  51  | SkCanvas 드로잉 전부 — `draw_paragraph`, **`draw_rect_array` 배치 API** 포함                                                          |
| `pencil_paragraph*`                  |  45  | skia textlayout Paragraph — `layout`, `get_min/max_intrinsic_width`, `get_rects_for_range`, `get_glyph_position_at_coord`, `get_path` |
| `pencil_font/text/typeface*`         |  73  | Font/TextStyle/TypefaceProvider/FontCollection — `set_dynamic_font_manager`, `enable_font_fallback`                                   |
| `pencil_paint/shader/image/picture*` |  76  | Paint / Shader(그라디언트·노이즈) / Image / SkPicture 녹화                                                                            |
| `pencil_gr_context/surface*`         |  29  | GrDirectContext + SkSurface — `make_webgl_gr_context`, `make_onscreen_gl_surface`, `surface_make_compatible_surface`                  |
| `pencil_runtime_effect*`             |  10  | SkSL RuntimeEffect (shader/colorFilter/blender)                                                                                       |
| `pencil_pdf*`                        |  6   | SkPDF — `make_document/begin_page/end_page/get_bytes`                                                                                 |
| 기타                                 |  29  | vertices / contour_measure / mask_filter / blender / unicode(ICU)                                                                     |

### 2-3. 엔진에 **없는** 것 (JS 소유 확정)

`pencil_layout*` / `pencil_hit*` / `pencil_node*` / `pencil_scene*` 계열 **0건**. scene graph, 문서 모델, auto-layout, 노드 히트테스트, 카메라/viewport, 컬링은 전부 JS. wasm 내부는 Skia 호출 wrapper 뿐 (C++ 심볼 증거: `pencil_paragraph_get_path` → `skia::textlayout::Paragraph` visitor).

**composition 과의 대비**: composition 은 렌더 바인딩 (CanvasKit) 과 별개로 **레이아웃을 Rust WASM (composition-engine, ADR-916) 이 소유**한다. Pen 은 레이아웃이 JS 다 — DOM Preview 와의 CSS 정합 요구가 없기 때문 (§7 참조).

---

## 3. 렌더링 파이프라인 상세

### 3-1. 프레임 루프 — on-demand, idle 시 완전 정지

```js
kue = Ou ? n=>setTimeout(n,1e3/60) : window.requestAnimationFrame.bind(window)
tick = () => { ...
  this.framesRequested>0 && (this.framesRequested-=1);
  this.deltaTime = fr(0,(t-this.currentTime)/1e3,.1);   // delta 0.1s clamp
  this.beforeUpdate(); this.afterUpdate(); this.flushDebouncedEvents();
  this.framesRequested>0 ? kue(this.tick) : this.activeRenderLoop=!1 }
```

- `framesRequested` 카운터 기반. idle 이면 rAF 체인 자체가 끊긴다 (`activeRenderLoop=false`) — 상태 변경 시 `requestFrame()` 재가동.
- 프레임 이벤트는 `queuedFrameEvents` Set 으로 프레임당 1회 debounce.
- WebGL2 옵션: `antialias:false` (컨텍스트 MSAA off — AA 는 Skia 담당), `alpha:false`. GPU 리소스 캐시 `setResourceCacheLimitBytes(512MB)`.

### 3-2. 줌/팬 성능 전략 — 2-계층 surface + 줌 캐시 (참고 가치 최상)

- **contentSurface** = 화면 + **패딩 512px** 의 offscreen GPU surface (MSAA≤4, Opaque). 문서 내용을 특정 줌 (`contentRenderedAtZoom`) 으로 래스터해 보관.
- **매 프레임 합성**은 이 캐시의 snapshot 을 shader 로 blit 만:
  - 줌 동일 → `FilterMode.Nearest` (픽셀 정합 blit)
  - 줌 제스처 중 → **`makeShaderCubic(.3,.3)` 리샘플만** — stale 캐시를 확대/축소해 보여주고 재래스터하지 않음
- **재래스터 조건**: ① `camera.zoom > contentRenderedAtZoom*3`, ② 카메라가 패딩 포함 캐시 bounds 이탈, ③ 명시적 `invalidateContent()`, ④ 이동 종료 200ms debounce 후 줌 불일치.
- 오버레이 (선택/핸들/가이드/에이전트 커서) 는 캐시 없이 매 프레임 메인 surface 직접.
- 타일링 없음 — 단일 패딩 surface 방식.

> 선행 문서 [PENCIL_RENDERING_OPTIMIZATION.md](PENCIL_RENDERING_OPTIMIZATION.md) 가 open-pencil 의 T2 (viewport×3 backing + stale blit) 를 "Pencil.app 은 분석 불가" 전제에서 소개했는데, **본체도 같은 계열 수법을 쓰고 있음이 실측 확인**된 셈.

### 3-3. 컬링/히트테스트 — JS

- 컬링: `beginRender` 가 노드 AABB (`intersectsWithTransform(getVisualLocalBounds(), worldMatrix)`) 판정 후 skip. 오버레이 이펙트도 `camera.overlapsBounds()` 컬링.
- 히트테스트: `findNodeAtPosition` → `camera.toWorld` → 자식 역순 `pointerHitTest` 재귀. wasm 은 `pencil_path_contains` (point-in-path) 프리미티브만 제공.
- 픽셀 그리드: 줌>4 에서 SkSL runtime effect 로 content shader 를 감싸 렌더 (줌 4→5.5 페이드인).

### 3-4. 텍스트 파이프라인

- **폰트**: Google Fonts 전체 카탈로그 JSON 이 번들에 내장 — **raw TTF 직접 fetch** → `pencil_typeface_make_from_data` → TypefaceProvider 등록 → dynamic font manager. 같은 폰트를 `@font-face` + `document.fonts.load()` 로 **DOM 에도 이중 등록** (편집 overlay 시각 일치용). UI 폰트 (시스템 스택) 와 문서 폰트 완전 분리.
- **측정/레이아웃**: skia textlayout Paragraph + ICU74 임베드 (줄바꿈/word boundary). caret·선택은 `getRectsForRange` / `getGlyphPositionAtCoordinate` / `getWordBoundary`.
- **편집 = DOM overlay** (Figma 형): 진입 시 캔버스 텍스트 숨김 (`node.hideText()` + `invalidateContent()`) → `camera.worldTransform × node.getWorldMatrix()` 를 CSS `transform: matrix(...)` 로 넘겨 정합 배치 → 멀티라인은 **Quill** (toolbar 비활성, plain text, 타이핑마다 scene 커밋 undo:false), 단일라인은 `<input>` + measure span. Cmd/Ctrl+Enter 커밋, Escape 취소. composition 의 TextEditOverlay 와 동일 계열.

### 3-5. 워커/멀티스레드 — 없음

- wasm `pthread` 0건, `SharedArrayBuffer` 0건, `new Worker(` 0건 — **완전 단일 스레드** (composition 과 동일).
- `webworkerAll.js` (183KB) 는 PixiJS v8 의 webworker 환경 어댑터 lazy 청크 — 에디터에서 사실상 로드 안 됨.
- emscripten 모듈 2종 (1.3MB/685KB) 은 렌더링이 아니라 **QuickJS 샌드박스** (asyncify/sync 빌드 각 1) — goodies 사용자 스크립트를 `setMemoryLimit` + `setMaxStackSize` + `Math.random=mulberry32(시드 고정)` 격리 환경에서 `evalCode` 실행.

### 3-6. 레이아웃 엔진 — JS, Figma 형 stack auto-layout

```js
function Q1e(n) {
  n.layout.dirty && (Qq(n, 0), eG(n, 0), Qq(n, 1), eG(n, 1), J1e(n));
}
```

- `Qq(node, axis)` = bottom-up **hug** 측정, `eG(node, axis)` = top-down **fill** 분배, `J1e` = 주축 justify (space-between/around 포함) + 교차축 align. 축별 (x/y) 2-pass.
- 텍스트 intrinsic 은 wasm Paragraph 측정 (`get_min/max_intrinsic_width`) 을 JS 레이아웃이 소비 — **측정은 wasm, 소비 알고리즘은 JS** (composition ADR-165 의 "측정 주체 TS / 소비 알고리즘 엔진" 과 역할 배치가 반대).
- Yoga/flexbox 심볼 0건. CSS 호환 목표 없음 — `.pen` 스키마도 `fit_content`/`fill_container`/고정 3모드 + margin/percent 불지원 명시.

### 3-7. 내보내기

- **HTML**: 생성기는 index.js 내 JS (scene node → HTML/CSS·Tailwind 코드), `html.js`(165KB) 는 **Prettier HTML 플러그인** — 출력 포맷만 담당. Electron 에선 문서 변경 4초 debounce / 최소 60초 간격 **자동 HTML export 루프** 상주.
- **PDF**: SkPDF 네이티브 벡터 — 동일 renderSkia 경로에 `renderTarget===PDF` 분기.
- **이미지**: PNG/JPEG/WEBP, 기본 2x, 상한 `min(8192, maxTextureSize)`.

---

## 4. UI/UX — 셸 구성

### 4-1. 디자인 토큰/테마

- **Tailwind v4 `@theme` + shadcn/ui 시맨틱 계약** — 변수 244개 3계층: oklch 원시 팔레트 (`--color-zinc-*` 등) → shadcn 시맨틱 (`--background/--card/--primary/--sidebar-*`) → 커스텀 확장.
- 커스텀 확장의 핵심은 **`--canvas-bg`** (light `#f6f6f6` / dark `#1e1e1e`) — **속성 패널 배경 (`bg-canvas-bg`) 과 캔버스 배경이 같은 토큰을 공유**해 패널이 캔버스와 한 면처럼 보인다. `--accent-active:#3b82f6` 은 양 테마 동일 (선택/활성 파랑).
- **테마 전환 = class 기반** (media query 아님): `classList.add(theme)` + **`skiaRenderer.invalidateContent()` 를 한 지점에서 동시 처리**. 기본값 dark. Electron 이면 `set-native-theme` IPC 로 네이티브 크롬까지 동기화. composition 의 `setDarkMode → themeVersion++ + notifyLayoutChange()` 계약과 동형.
- UI 폰트는 시스템 스택 (웹폰트 없음), 모노는 Roboto Mono. shadow 는 Tailwind 유틸만 — 별도 elevation 토큰 없음.

### 4-2. 패널 구조

```
┌────────────────────────────────────────────────────────────┐
│ (Electron: 상단 39px drag 영역 + vibrancy)                   │
│ ┌─────────────┐ ┌──┐                        ┌────────────┐ │
│ │ 좌측 사이드바 │ │툴│   캔버스 (Skia WASM)     │ 속성 패널   │ │
│ │ Agent/Layers│ │바│                        │ 212px      │ │
│ │ /Slides/    │ │(플로팅)│  예시 프롬프트 칩    │ 선택시에만  │ │
│ │ Components/ │ └──┘    줌 위젯(하단 우측)     │ bg-canvas-bg│ │
│ │ Libraries   │                              └────────────┘ │
└────────────────────────────────────────────────────────────┘
```

- **좌측 사이드바**: 5탭, **기본 닫힘** + `window.innerWidth>=1200` 가드. 리사이즈 (Electron 240~700, 기본 320) + **핸들 더블클릭 = 기본폭 복원**. 탭은 container query 로 폭 300px 미만이면 아이콘만 (`calc-size(auto,size)` 애니메이션).
- **툴바**: 사이드바 우측에 붙는 세로 플로팅 카드. Move / 프리미티브 드롭다운 (Rectangle·Ellipse·Line·Polygon·Icon·Script·Image — **마지막 사용 프리미티브를 대표 버튼으로 기억**) / Text / Frame / Sticky Note / Hand / Design Goodies / 단축키 / Settings.
- **속성 패널**: **선택이 있을 때만 렌더** (`selectedNodesLength>0`), 212px 고정 컬럼 ↔ 접힘 시 `absolute right-1.5 top-1.5` 플로팅 미니 카드 2단 모드. 섹션: Alignment → Position → Layout/Dimensions (auto/fixed/fill 모드) → Appearance → Fill → Stroke → Typography → Icon → Script → Effects → Theme → Metadata → Export.
- **줌 위젯**: 하단 우측 [−][100%▾][+]. 퍼센트 갱신은 React 리렌더 없이 `textContent` 직접 갱신 (`cameraChangeDebounced` 구독).
- 레이어 패널: headless-tree 기반, 인라인 rename, 캔버스와 **동일 컨텍스트 메뉴 빌더 공유**. 레이어명 fallback 체인 = `name → text 내용 → 타입 라벨`.

### 4-3. 인터랙션 모델

중앙 집중 키보드 핸들러 (window capture 1개, `_pressedKeys` Set) + `?` 치트시트 모달. 단축키를 **데이터 테이블 SSOT 하나**로 관리해 치트시트와 툴팁이 같은 소스를 소비.

| 분류       | 단축키 (⌘=mod)                                                                                               |
| ---------- | ------------------------------------------------------------------------------------------------------------ |
| Tools      | V Move · H Hand · A/F Frame · T Text · N Sticky note · R Rect · O Ellipse                                    |
| Editing    | ⌘D · ⌫ · ⌘G Group · ⌘⇧G Ungroup · ⌘⌥G Frame selection · ⌘Z/⌘⇧Z                                               |
| Components | **⌘⌥K Create component · ⌘⌥X Detach instance · ⌥⇧R Replace inside instance**                                 |
| Clipboard  | ⌘C/X/V · ⌘⇧C Copy as PNG · **⌘⌥C Copy as HTML**                                                              |
| Ordering   | `]`/`[` front/back · ⌘]/⌘[ forward/backward                                                                  |
| View       | ⌘' Pixel grid · ⌘⇧' Snap to pixel · `=`/`-` 줌 ×2/÷2 · 0=100% · 1=fit · 2=selection                          |
| AI Chat    | **⌘K Toggle chat · ⌘T New chat tab · Ctrl+Tab 탭 순환 · ↑↓ 프롬프트 히스토리**                               |
| Selection  | ⌘A (선택 있으면 같은 부모의 형제 전체) · Esc · **↵ Select children · ⇧↵ Select parent** · ⌘Click deep select |
| 이동       | 화살표 1px, ⇧10px — **auto-layout 자식이면 화살표가 형제 순서 재배치** (`isInLayout()` 분기, ⌥=맨끝)         |

- 더블클릭 = drill-in + 텍스트 편집 (수동 감지 300ms). 스냅핑 (`snapToObjects`/`roundToPixels` 기본 on) 가이드는 캔버스 직접 렌더.
- 컴포넌트 팔레트→캔버스 DnD 는 `dataTransfer("application/x-ha")` + 자기 창 검증 UUID.
- 클립보드 라우팅: `data-pencil-allow-canvas-clipboard` / `data-pencil-allow-chat-clipboard` DOM 속성으로 선언적 구분.

### 4-4. 캔버스 오버레이 chrome — 전부 캔버스 렌더, 2-pass 분리

```js
render(t,e){ for(const s of selectedNodes) t.renderNodeOutline(s, 1/zoom);  // worldspace
  this.stateManager.state.render(t,e); this.snapManager.render(e) }
renderScreenspace(t,e){ this.resizeHandles.render(t,e); this.guidesGraph.render(t,e);
  this.guidesGraph.frameNamesManager?.render(t,e) }                          // screenspace
```

- **worldspace pass** (1/zoom 폭): 선택·호버 아웃라인, 스냅 가이드. **screenspace pass**: 리사이즈 핸들·눈금 가이드·프레임명 라벨. 렌더 패스 구조 자체로 좌표계 혼동을 차단 — composition 의 boundsMap/hitBoundsMap 분리 (canvas-rendering.md §8.5) 와 같은 문제의식.
- **커서만 DOM**: 회전 핸들용 커서를 각도별로 캔버스에 그려 `-webkit-image-set(url(...) 2x)` 로 캐시 — 회전된 도형에서도 커서 방향이 기하학적으로 정확.
- 캔버스 안에 **retained-mode 미니 위젯 툴킷** 존재 (`layout/padding/cornerRadius/hoverBackgroundColor/onPointerDown` 을 받는 자체 UI 노드) — 프레임 pennant·인캔버스 배지 메뉴를 hover/클릭까지 캔버스 측에서 처리.
- **AI 시각 피드백도 캔버스**: `addFlash` (에이전트 수정 노드 플래시), `addGeneratingEffect` (생성 중 회전 이펙트), `pokeAgentCursor` (대화별 에이전트 커서 — 목표 좌표 lerp 이동, 유휴 시 페이드아웃).
- Figma 식 Alt-거리 측정 오버레이는 미발견 (기능 부재 판정).

### 4-5. AI 채팅 패널 UX

- 에이전트 5계열 통합 + **에이전트별 effort 선택 UI** (`minimal~max`, claude 기본 high). provider 상태 배너는 status.claude.com 등 폴링.
- 세션 = 탭이 아니라 드롭다운 ("Agent sessions" + 실행 중 파랑 글로우 도트 + "N agents running").
- 입력 툴바: **병렬 에이전트 Nx** (슬롯별 모델 지정), designCount (한 번에 N개 시안), iterateMode "layout"/"style" 토글, 스타일 피커.
- **선택 컨텍스트 칩**: 캔버스 선택 노드가 입력창 위 칩으로 표시, 개별 해제 — 선택이 곧 프롬프트 컨텍스트라는 계약의 시각화.
- **tool-call 표시 = 시제 분리 상태 동사 매핑**: `{batch_design: "Designing…/Designed", get_screenshot: "Reviewing visuals/Reviewed visuals", spawn_agents: "Started agents", ...}`. TodoWrite 는 체크리스트, AskUserQuestion 은 질문 카드로 구조화 렌더.
- diff/체크포인트 패널 없음 — **캔버스 플래시 + 에이전트 커서**가 변경 표시를 담당 (문서 undo 스택 공유).
- 스크롤: 40px 임계 sticky-bottom + ResizeObserver 스트리밍 성장 추적.

### 4-6. goodies / 스타일 갤러리 — "프리셋 = 데이터"

- **셰이더 99종 = GLSL 12개 × uniform 프리셋 변주** (`{kind:"shader", glslFile, uniforms:{u_color1:...}, thumbnail}`) — Silk 18 / Geo Pattern 18 / Aurora 15 / Halftone 7 (comic-book·newsprint·faded-riso) 등. 썸네일 webp 사전 렌더. SDF 매니저가 path 의 signed distance field 를 만들어 shape 계열 셰이더에 공급.
- **스크립트 11종** (Clock/Radar/Gauge/Chart/Candlestick/Flow Field...): 파라미터 (`inputs`) 를 가진 생성형 스크립트 노드 — QuickJS 샌드박스에서 실행 (§3-5).
- **스타일 갤러리 56종 = 28 패밀리 × 팔레트 변주**: 이미지가 아니라 **타입드 파라미터 세트** — `params:{headings:"Playfair Display", body:"Newsreader", colorPalette:"Heritage Warmth", roundness, elevation, decorativeImagery}` 를 AI 프롬프트에 주입. 갤러리 모달은 Featured/Styles/Design Systems/Scripts/Shaders 5섹션 통합.

### 4-7. 온보딩/빈 상태

- 빈 캔버스 (노드≤2 또는 웰컴 문서) 에만 뜨는 **예시 프롬프트 칩 바** (하단 플로팅, 12개 하드코딩) — 클릭 시 `"Clean the canvas first, then design {X}"` 로 포장해 에이전트 전송. **문서가 수정되는 순간 자동 소멸**.
- 첫 실행 시 에이전트 설정 위저드 (localStorage 플래그). 기본값: `showPixelGrid:true`, `snapToObjects:true`.

---

## 5. AI 통합 · 생태계 (요약)

> 렌더링/UI-UX 가 본 문서의 중심이므로 요약만. 상세 증거는 세션 분석 로그 참조.

- **에이전트 5계열**: Claude (`@anthropic-ai/claude-agent-sdk` 0.3.206 — **번들된 Claude Code 실행 파일** 구동, systemPrompt = `claude_code` preset + .pen 스키마 문서 전문 + 디자인 규칙 append, Skill/Agent 도구 차단) / Codex (0.144.1, stdio MCP) / Cursor (`@cursor/sdk`, composer-2.5) / Gemini·pi (`pi-coding-agent`, 11 providers) / **자체 호스팅 인퍼런스 프록시 "Pencil Pro"** (MiniMax M3·GLM 5.2·Qwen 3.7 Plus·Kimi K2.7 Code, 512K ctx).
- **MCP 도구 10종**: `get_editor_state / get_guidelines / batch_get / batch_design(유일한 쓰기) / snapshot_layout / get_screenshot / get_variables / export_nodes / export_html / spawn_agents`.
- **`spawn_agents`**: 병렬 디자이너 에이전트 (최대 8-10) — placeholder 컨테이너 노드를 먼저 만들어 nodeID 분배, "프롬프트에 레이아웃/색을 넣지 마라" 프로토콜.
- **스트리밍 라이브 렌더**: `batch_design` 의 `input_json_delta` 를 부분 JSON 상태에서 실시간 파싱 (`extractJsonStringFieldPrefix` / jsonrepair) → 토큰이 흐르는 동안 캔버스에 그려짐. Claude beta `fine-grained-tool-streaming-2025-05-14`.
- **외부 생태계 주입**: claude/codex/gemini/antigravity/opencode/kiro CLI + Claude Desktop 7종의 설정 파일에 pencil MCP 자동 설치, `~/.claude/settings.json` allowlist 자동 편집. 외부 MCP 사용일수 (`mcp_usage_days`) 과금 미터. unix socket 프록시 (Go 바이너리 4.7MB).
- **CLI 헤드리스 배치**: `--agent-config '<JSON>'` — 파일×프롬프트 배열로 에이전트 병렬 실행 + 윈도우 그리드 배치.
- **.pen 포맷**: 평문 JSON, 스키마 v2.14. 노드 13종 — AI-네이티브 노드 4종 (`note`/`prompt`(model 필드 보유)/`context`/`script`) 포함. fill 6종 (shader GLSL·mesh_gradient 포함). `imports` 로 라이브러리 참조. 컴포넌트 모델 (`reusable` + `slot` + `Ref/descendants` override) 은 **composition canonical (ADR-116/122/130/142) 과 1:1 정합 재확증**.
- 번들 라이브러리: shadcn/heroui/lunaris/nitro/halo (`.lib.pen`, reusable 87~100개) + `prompt` 노드가 심어진 템플릿.
- 인프라: PostHog + Sentry×2 (`sendDefaultPii:true`) + api.pencil.dev (device-login/usage/share 서명 업로드) + 24h 오프라인 강제 로그아웃.

---

## 6. composition 관점 비교표

| 축              | **Pen v1.2.1**                                                                                      | **composition**                                                                 |
| --------------- | --------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------- |
| Skia 바인딩     | 자체 C API 385개 (`pencil_*`) + 수제 wrapper — embind 없음, Skia m149 직접 빌드                     | 공식 CanvasKit WASM (embind)                                                    |
| WASM 책임       | 렌더 + 텍스트 측정/레이아웃 + path + PDF **만**                                                     | CanvasKit = 렌더+측정 / **레이아웃은 별도 자체 Rust WASM** (composition-engine) |
| 레이아웃        | **JS**, Figma 형 stack auto-layout (hug/fill, 2축 2-pass) — CSS 호환 목표 없음                      | **Rust WASM**, CSS-FLEXBOX/GRID 표준 정합 (§4.5 automatic minimum size 등)      |
| DOM 렌더 경로   | 없음 — 캔버스 단일 + HTML 은 export 산출물                                                          | **Skia ↔ DOM 대등 2-consumer** (D3 SSOT 대칭) — 근본 차이                       |
| 프레임 루프     | on-demand rAF (idle 완전 정지) + delta clamp                                                        | on-demand 유사 (dirty/layoutVersion 카운터)                                     |
| 줌/팬           | **콘텐츠 캐시 surface (화면+512px) + 제스처 중 cubic 리샘플 blit**, 3배 임계/종료 debounce 재래스터 | 캐시 계층 없음 — command stream 재실행 + AABB 컬링                              |
| 히트테스트      | JS 재귀 + wasm `path_contains`                                                                      | JS renderCommands AABB + `hitBoundsMap` (clip 교차) SpatialIndex                |
| 텍스트 편집     | DOM overlay (Quill, camera×node CSS matrix) + 폰트 DOM 이중 등록                                    | TextEditOverlay (DOM overlay) — 동일 계열                                       |
| 오버레이 chrome | 전부 캔버스, worldspace/screenspace **2-pass 분리**                                                 | 캔버스 오버레이 + boundsMap/hitBoundsMap 두 맵 분리                             |
| 멀티스레드      | 없음 (pthread/SAB 0건)                                                                              | 없음 (동일)                                                                     |
| 스크립트 확장   | QuickJS WASM 샌드박스 (메모리/스택 제한 + 시드 RNG)                                                 | 해당 없음                                                                       |
| 컴포넌트 모델   | `reusable` + `slot` + `Ref/descendants` override                                                    | canonical `reusable`/Ref 모델 — **1:1 정합** (ADR-142 계열)                     |
| AI              | 5계열 에이전트 + spawn_agents + 스트리밍 라이브 렌더 + MCP 생태계 주입                              | Groq tool calling (ADR-134 로 LLM 통합 재설계 제안 중)                          |

## 6-1. 차용 후보 (우선순위순)

**렌더링**:

1. **줌/팬 중 콘텐츠 캐시 surface + cubic 리샘플 blit** — 팬/줌 제스처 한정 2-계층 합성. 재래스터 정책 (3배 임계 + 종료 200ms debounce) 까지 세트로. 복잡한 페이지에서 60fps 여유를 콘텐츠 복잡도와 무관하게 확보.
2. **worldspace/screenspace 오버레이 패스 명시 분리** — 현행 §8.5 두 맵 분리를 렌더 패스 구조로 승격하는 방향의 선례.
3. **배치 드로우 API** (`draw_rect_array`) — CanvasKit 호출 왕복이 병목이 될 때의 참조 지점.
4. 각도 캐시된 회전 리사이즈 커서 (`-webkit-image-set` DOM 커서) — 저비용 고급 조작감.

**UI/UX**:

1. **`--canvas-bg` 토큰 공유** (패널-캔버스 시각 통합) + **선택 시에만 나타나는 초경량 속성 패널** (212px, 접힘 시 플로팅 미니 카드).
2. **auto-layout 자식에서 화살표 키 = 형제 순서 재배치** — flex/grid 컨테이너 내부에서 px 이동이 무의미하다는 점의 UX 승화. composition 레이아웃 컨테이너에 그대로 이식 가능.
3. **AI tool-call 시제 라벨 테이블** + **선택 컨텍스트 칩** + **캔버스 플래시형 변경 표시** — ADR-134 계열 직접 참조 대상.
4. **스타일 프리셋 = 토큰 값 세트 + 썸네일** — composition theme/tokens SSOT 위에 얹는 갤러리 설계의 직접 참조 사례.
5. 단축키 데이터 테이블 SSOT (치트시트·툴팁 공유) — 단축키 도입 시 시작점.
6. container query 사이드바 탭 (아이콘↔라벨) + 리사이즈 핸들 더블클릭 복원 — 패널 시스템 (ADR-163) 저비용 디테일.
7. 빈 캔버스 예시 프롬프트 칩 (문서 수정 시 자동 소멸) — 온보딩을 소멸성 캔버스 오버레이로.

---

## 7. 선행 문서 델타 — 정정 표

| 축               | 선행 문서 서술 (v1.1.10 / v1.1.57 추정 기준)            | v1.2.1 실측                                                                            | 판정                 |
| ---------------- | ------------------------------------------------------- | -------------------------------------------------------------------------------------- | -------------------- |
| 앱 정체          | Pencil.app (`dev.pencil.desktop`)                       | **Pen** (pen.dev, highagency), `pen-migration.js` 자동 이관                            | 신규 (리브랜딩)      |
| 렌더러           | native Skia (koffi FFI), WASM 미사용                    | **자체 pencil.wasm** (emscripten + Skia m149), koffi 부재                              | **반증 — 정정 필요** |
| 오버레이         | PixiJS v8 Layer 2                                       | PixiJS 렌더러 미가동 (번들 잔재만) — 자체 WASM 엔진 통합                               | **반증 — 정정 필요** |
| .pen 포맷        | closed format                                           | 평문 pretty JSON, 정식 스키마 v2.14 (`@ha/schema`), `imports` 지원                     | **반증 — 정정 필요** |
| Helper 4프로세스 | "엔터프라이즈급 프로세스 격리" 차별점                   | 모든 Electron 앱의 표준 구성 — 특수 분리 증거 없음                                     | 과대해석 격하        |
| AI 통합          | Codex + Claude 듀얼                                     | 5계열 + 자체 프록시 + spawn_agents + 외부 CLI 7종 MCP 자동 설치 + 스트리밍 라이브 렌더 | 대폭 확장            |
| 컴포넌트 모델    | reusable/slot/Ref — composition canonical 정합          | 동일 + AI-네이티브 노드 4종 추가                                                       | 유지·재확증          |
| Selection UX     | SelectionManager/더블클릭 drill-in/300ms (v1.1.10 관측) | 동일 유지 + Enter/Shift+Enter 계층 이동, ⌘A 형제 인지                                  | 유지·보강            |

**선행 문서 원문은 보존** (역사 기록) — 각 문서 상단에 본 문서로의 stale 경고 포인터만 추가한다. openpencil / open-pencil 서술은 이번 추출본과 무관하므로 유효 유지.
