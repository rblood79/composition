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

> 선행 문서 [PENCIL_RENDERING_OPTIMIZATION.md](PENCIL_RENDERING_OPTIMIZATION.md) 가 open-pencil 의 T2 (viewport×3 backing + stale blit) 를 "Pencil.app 은 분석 불가" 전제에서 소개했는데, **본체도 같은 계열 수법을 쓰고 있음이 실측 확인**된 셈. composition 도 같은 연구를 근거로 `SkiaRenderer` 에 **이미 동형 구현 완료** — 본체와의 파라미터 대조는 §6-1-c.

### 3-3. 컬링/히트테스트 — JS

- 컬링: `beginRender` 가 노드 AABB (`intersectsWithTransform(getVisualLocalBounds(), worldMatrix)`) 판정 후 skip. 오버레이 이펙트도 `camera.overlapsBounds()` 컬링.
- 히트테스트: `findNodeAtPosition` → `camera.toWorld` → 자식 역순 `pointerHitTest` 재귀. wasm 은 `pencil_path_contains` (point-in-path) 프리미티브만 제공.
- 픽셀 그리드: 줌>4 에서 SkSL runtime effect 로 content shader 를 감싸 렌더 (줌 4→5.5 페이드인).

### 3-4. 텍스트 파이프라인

- **폰트**: Google Fonts 전체 카탈로그 JSON 이 번들에 내장 — **raw TTF 직접 fetch** → `pencil_typeface_make_from_data` → TypefaceProvider 등록 → dynamic font manager. 같은 폰트를 `@font-face` + `document.fonts.load()` 로 **DOM 에도 이중 등록** (편집 overlay 시각 일치용). UI 폰트 (시스템 스택) 와 문서 폰트 완전 분리.
- **측정/레이아웃**: skia textlayout Paragraph + ICU74 임베드 (줄바꿈/word boundary). caret·선택은 `getRectsForRange` / `getGlyphPositionAtCoordinate` / `getWordBoundary`.
- **편집 = DOM overlay** (Figma 형): 진입 시 캔버스 텍스트 숨김 (`node.hideText()` + `invalidateContent()`) → `camera.worldTransform × node.getWorldMatrix()` 를 CSS `transform: matrix(...)` 로 넘겨 정합 배치 → 멀티라인은 **Quill** (toolbar 비활성, plain text, 타이핑마다 scene 커밋 undo:false), 단일라인은 `<input>` + measure span. Cmd/Ctrl+Enter 커밋, Escape 취소. composition 의 TextEditOverlay 와 동일 계열.

### 3-4-1. paragraph 수명 · 그리기 경로 — 노드 소유 + Path 렌더 (2026-07-30 추가 실측)

> **동기**: composition 의 텍스트 불특정 소실 버그 (ADR-173 되돌림 사슬 — paragraph LRU 스래싱 + 프레임 중 WASM delete → Ganesh 텍스트 blob 캐시 stale 히트) 와 대조하기 위해, Pen 이 같은 문제를 어떻게 다루는지 번들(`index.js` 5.6MB 난독)에서 재추적했다. 결론: **Pen 은 이 문제를 캐시 정책으로 푼 것이 아니라, 문제가 성립할 수 없는 구조 두 개로 회피한다.**

**① paragraph 수명 = 노드 수명 — 전역 캐시 부재**

```js
// 텍스트 노드 클래스 (난독 번들 복원)
getParagraph(e) {
  if (this.dirtyParagraph || !this.paragraph) {
    // ParagraphBuilder.MakeFromFontCollection(...) → addText
    this.paragraph && this.paragraph.delete(); // 재생성 시에만 폐기
    this.paragraph = builder.build();
  }
  return this.paragraph; // 노드 필드로 상시 보유
}
destroy() {
  this.paragraph && this.paragraph.delete(); // 노드 제거 시에만 폐기
  this._fillPath && this._fillPath.delete();
}
```

- paragraph 는 각 텍스트 노드의 **필드**다. 재생성은 텍스트/스타일 dirty 때만, 삭제는 rebuild 또는 `destroy()` 때만. 번들 전체에서 텍스트용 LRU/상한/퇴거 코드 **0건** (`Lru` 1건은 base64 블롭 내부 우연 문자열). 상한이 없으니 "walk 당 N개 초과" 스래싱 문턱 자체가 존재하지 않고, **사용 중 객체를 프레임 도중 delete 하는 경로가 구조적으로 없다**.

**② 일반 렌더는 `drawParagraph` 를 쓰지 않는다 — 글리프를 Path 로 그린다**

```js
getFillPath(e) {
  this._fillPath = this.getParagraph(e).getPath(); // 글리프 외곽선 → Skia Path (노드별 캐시)
}
render(e, r, s) {
  e.renderFills(r, this.getFillPath(e), fills, ...); // 일반 도형 fill 파이프라인
  if (s === Mv.PDF) r.drawParagraph(...);            // PDF export 전용
}
```

- paragraph 의 textStyle color 가 `[0,0,0,0]`(투명) — paragraph 는 **shaping/측정/geometry 추출 전용**이고 화면 출력은 Path fill 이다. `drawParagraph` 는 번들 전체 3곳: 바인딩 정의 1 + PDF export + `renderAsPath===false` 명시 분기뿐.
- 따라서 Ganesh **텍스트 blob 캐시(글리프 아틀라스)가 일반 렌더 파이프라인에 등장하지 않는다** — composition 소실 버그의 기제(재사용된 WASM 주소로 blob stale 히트)가 원천 불성립. 부수 이득: 텍스트에도 도형과 동일한 fill 체계(그라데이션/이미지)가 그대로 적용된다.
- 폰트 fallback 은 `paragraph.unresolvedCodepoints()` → fallback 폰트 로드로 처리.

**③ 완충층 — 제스처 중엔 텍스트 draw 자체가 없다**

§3-2 의 content surface 캐시와 결합하면 팬/줌 중 paragraph/path draw ≈ 0 (blit 만), 재래스터는 정착 후 200ms 디바운스 1회. Path 렌더가 glyph atlas 방식보다 글리프당 비싼 거래인데 그 비용을 이 층이 흡수한다.

**거래 (Pen 이 지불하는 것)**: 메모리가 텍스트 노드 수에 비례해 paragraph + fillPath 를 상시 보유 (상한 없음 — 문서 크기에 맡김) / LCD 서브픽셀 힌팅 포기 (path 렌더) / 대량 텍스트 일괄 재래스터 시 path fill 비용. composition 대조와 잠재 결함 현황은 `BUILDER_FRAME_DROP_BASELINE_5K.md` §8.

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

> 렌더링 축의 장단점 상세는 §6-1, 실측 정정 2건 (줌/팬 캐시 · 프레임 루프) 도 §6-1 에 반영.

| 축              | **Pen v1.2.1**                                                                               | **composition**                                                                             |
| --------------- | -------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------- |
| Skia 바인딩     | 자체 C API 385개 (`pencil_*`) + 수제 wrapper — embind 없음, Skia m149 직접 빌드              | 공식 CanvasKit WASM (embind, `canvaskit-wasm@0.40` 고정)                                    |
| WASM 책임       | 렌더 + 텍스트 측정/레이아웃 + path + PDF **만**                                              | CanvasKit = 렌더+측정 / **레이아웃은 별도 자체 Rust WASM** (composition-engine)             |
| 레이아웃        | **JS**, Figma 형 stack auto-layout (hug/fill, 2축 2-pass) — CSS 호환 목표 없음               | **Rust WASM**, CSS-FLEXBOX/GRID 표준 정합 (§4.5 automatic minimum size 등)                  |
| DOM 렌더 경로   | 없음 — 캔버스 단일 + HTML 은 export 산출물                                                   | **Skia ↔ DOM 대등 2-consumer** (D3 SSOT 대칭) — 근본 차이                                   |
| 프레임 루프     | **on-demand rAF — idle 시 rAF 체인 완전 정지** (`framesRequested` 카운터) + delta clamp      | **연속 rAF + 5종 frame 분류** — idle 프레임은 GPU 작업 0, rAF wake 자체는 유지 (§6-1-b)     |
| 줌/팬           | 콘텐츠 캐시 surface (화면+512px) + 제스처 중 cubic 리샘플 blit, 3배 임계/종료 200ms 재래스터 | **동형 구현 완료** — `SkiaRenderer` dual surface, 파라미터까지 본체와 일치 (§6-1-c 대조 표) |
| 히트테스트      | JS 재귀 + wasm `path_contains` (point-in-path 벡터 정밀)                                     | JS renderCommands AABB + `hitBoundsMap` (조상 clip 교차) SpatialIndex                       |
| 텍스트 편집     | DOM overlay (Quill, camera×node CSS matrix) + 폰트 DOM 이중 등록                             | TextEditOverlay (DOM overlay) — 동일 계열                                                   |
| 오버레이 chrome | 전부 캔버스, worldspace/screenspace **2-pass 분리**                                          | 캔버스 오버레이 + boundsMap/hitBoundsMap 두 맵 분리                                         |
| 멀티스레드      | 없음 (pthread/SAB 0건)                                                                       | 없음 (동일)                                                                                 |
| 스크립트 확장   | QuickJS WASM 샌드박스 (메모리/스택 제한 + 시드 RNG)                                          | 해당 없음                                                                                   |
| 컴포넌트 모델   | `reusable` + `slot` + `Ref/descendants` override                                             | canonical `reusable`/Ref 모델 — **1:1 정합** (ADR-142 계열)                                 |
| AI              | 5계열 에이전트 + spawn_agents + 스트리밍 라이브 렌더 + MCP 생태계 주입                       | Groq tool calling (ADR-134 로 LLM 통합 재설계 제안 중)                                      |

## 6-1. 렌더링 축 상세 비교 — composition 관점 장단점

> composition 측 근거: `apps/builder/src/builder/workspace/canvas/skia/SkiaRenderer.ts` / `SkiaCanvas.tsx` 실코드 (2026-07-26 재확인) + `.claude/rules/canvas-rendering.md`. 본 절에서 §6 초판 표의 2개 행 (줌/팬 "캐시 계층 없음", 프레임 루프 "on-demand 유사") 을 실측으로 정정한다.

### (a) Skia 바인딩 획득 방식 — 자체 emscripten 빌드 vs 공식 CanvasKit

| 항목      | Pen (자체 pencil.wasm)                            | composition (canvaskit-wasm 0.40)                 |
| --------- | ------------------------------------------------- | ------------------------------------------------- |
| Skia 버전 | m149 (2026 초 계열) — 최신 추종                   | 0.40 고정 (2023 릴리스) — 약 2년+ 격차            |
| 바인딩 층 | 순수 C ABI + 수제 JS wrapper (embind 0건)         | embind 자동 바인딩                                |
| API 표면  | 필요한 385개만 노출 + 커스텀 진입점 자유          | 공식 표면 고정 — 커스텀 진입점 불가               |
| 유지보수  | Skia 소스 트리 + emscripten 빌드 인프라 자체 부담 | 업그레이드/버그픽스 upstream 위임, 타입 정의 제공 |

- **Pen 장점**: ① `draw_rect_array` 같은 **배치 드로우 진입점**을 직접 추가해 JS↔wasm 왕복을 구조적으로 절감. ② embind 디스패치 오버헤드 제거. ③ 최신 Skia milestone 의 텍스트/GPU 개선 수혜. ④ SkSL RuntimeEffect·SDF 등 필요한 저수준 기능을 빌드 옵션으로 통제.
- **composition 장점**: 빌드 인프라 비용 0, 커뮤니티 검증·타입 정의. 렌더 바인딩이 제품 차별화 지점이 아닌 단계에서는 합리적 선택.
- **composition 단점 (실코드 증거)**: ① `drawImageCubic` 이 타입 정의에 없어 **런타임 존재 가드로 우회** (`SkiaRenderer.ts` blit 경로 — upstream 타입 지연의 실물 사례). ② 배치 API 부재 — 노드당 개별 draw 호출. ③ 0.40 고정으로 이후 milestone 의 Paragraph/GPU 개선 미수혜. 버전 상향은 측정 oracle 정합 재검증 (§d) 을 동반해야 하므로 비용이 낮지 않다.

### (b) 프레임 루프 — idle 시 rAF 완전 정지 vs 연속 rAF + 프레임 분류

- **Pen**: `framesRequested` 카운터가 0 이면 **rAF 체인 자체를 끊는다** (`activeRenderLoop=false`) — idle 시 CPU wake 0. 대가는 invalidation 규율: 모든 상태 변경 지점이 `requestFrame()` 을 호출해야 하며, 누락 = stale 화면 버그.
- **composition**: `renderFrameCore` 가 **매 프레임 무조건 다음 rAF 를 예약**하고, `classifyFrame` 5종 분류 (idle/present/camera-only/content/full) 로 idle 프레임은 GPU 작업 0 으로 스킵. idle 에도 프레임당 소량 JS (version 비교 + camera 읽기) 는 실행된다.
- **트레이드 판정**: composition 방식은 "재가동 트리거 누락" 버그 클래스가 원천적으로 없다는 게 장점이고, 단점은 idle wake 비용 (배터리·백그라운드 탭). 단 composition 은 이미 `layoutVersion`/`registryVersion` 카운터 규율을 지불하고 있으므로, **version bump 지점 = requestFrame 지점**이라는 등식이 성립해 Pen 형 완전 정지로의 전환 비용이 낮은 편이다. 전환 시 hidden 탭 rAF pause 로 인한 overlay stale 계열 (메모리 `reference-chrome-mcp-hidden-tab-raf-pause-stale-overlay`) 재검증 필요.

### (c) 줌/팬 콘텐츠 캐시 — **동형 구현 완료** (차용 후보 아님, 파라미터 일치 실측)

§6 초판 표의 "composition 캐시 계층 없음" 은 **틀렸다**. composition `SkiaRenderer` 는 [PENCIL_RENDERING_OPTIMIZATION.md](PENCIL_RENDERING_OPTIMIZATION.md) (open-pencil 연구) 를 근거로 Phase 6 에서 dual surface 캐시를 이미 구현했고, 이번 본체 실측으로 **파라미터까지 일치**함이 검증됐다:

| 파라미터           | Pen v1.2.1 본체           | composition SkiaRenderer                | 일치 |
| ------------------ | ------------------------- | --------------------------------------- | :--: |
| 캐시 surface 크기  | 화면 + 패딩 512px         | `contentPaddingCssPx = 512`             |  ✅  |
| 재래스터 줌 임계   | 캡처 줌 × 3 초과          | `camera.zoom > snapshotCamera.zoom * 3` |  ✅  |
| 제스처 중 blit     | cubic 리샘플 (`.3/.3`)    | Mitchell-Netravali `{b:1/3, c:1/3}`     |  ✅  |
| 모션 종료 정리     | 200ms debounce 재래스터   | `scheduleCleanupRender()` 200ms         |  ✅  |
| 커버리지 이탈 감지 | 카메라가 패딩 bounds 이탈 | `canBlitWithCameraTransform()` 4변 검사 |  ✅  |
| 줌 동일 시         | Nearest blit              | `drawImage` (비스케일)                  |  ✅  |

- **잔여 미세 차이**: Pen 은 contentSurface MSAA≤4 를 명시 설정 / composition 은 `mainSurface.makeSurface()` 로 동일 백엔드 정책 승계. composition 은 frame 분류가 명시 5종이라 dev 계측 (`idleFrameRatio`/`blitTime`/`contentRendersPerSec`) 이 분류 단위로 가능 — 운영 관측성은 composition 우위.
- **시사점**: 이 축은 차용 후보가 아니라 **독립 검증 완료 사례** — composition 의 파라미터 선택 (512/3×/cubic/200ms) 이 본체 프로덕션 값과 동일함이 확인되어 튜닝 근거가 강화됐다.

### (d) 텍스트 측정 oracle — 단일 엔진 vs 이중 엔진

- **Pen**: 측정·caret·렌더 전부 wasm Paragraph 단일 엔진 (ICU74 임베드). **측정↔렌더 불일치라는 버그 클래스가 구조적으로 존재하지 않는다.**
- **composition**: 측정 oracle = Canvas 2D ("Layout = Canvas 2D = CSS 정합" 원칙), 렌더 = CanvasKit — 이중 엔진. sub-pixel 발산 교정 레이어를 상시 유지한다: nodeRendererText 의 post-layout `getMaxIntrinsicWidth()` 교정, 오발 줄바꿈 `+1` 재layout, ParagraphStyle 3곳 동기화 규칙 (canvas-rendering.md §3).
- **판정**: composition 의 이중 oracle 은 결함이 아니라 **DOM 대칭의 대가**다. Preview DOM 이 대등 consumer 인 이상 측정은 CSS(브라우저) 와 같아야 하고, CanvasKit 단일 측정으로 통일하면 CSS 와 발산한다. Pen 은 CSS 정합 요구 자체가 없어 단일 oracle 이 가능한 것 — **아키텍처 전제가 다르므로 이 단순성은 차용 불가**.

### (e) 레이아웃 소유권 — JS Figma 3모드 vs Rust WASM CSS 표준

- **Pen**: hug/fill/fixed 3모드 × 2축 2-pass 를 JS 로 구현. margin/percent/grid 미지원을 스키마가 명시 — **알고리즘 표면적을 의도적으로 극소화**. 장점: 디버깅 용이, 반복 속도, 마샬링 경계 없음. 단점: HTML export 는 근사 변환 (라운드트립 불가), 웹 표준 표현력 제한.
- **composition**: CSS-FLEXBOX/GRID 표준 공식을 Rust WASM 이 소유 (§4.5 automatic minimum size, fit-content 공식, grid track sizing — ADR-916/164/165). 장점: DOM 과 **동일 공식** — 시각 대칭 성립의 전제. 단점: 표준 전체 표면적의 자체 구현 부담 + binary protocol 마샬링 + 5-심볼 캐시 무효화 체인·full rebuild 판정 같은 운영 규율 (layout-engine.md).
- **판정**: 양쪽 다 "제품이 요구하는 표현력" 에 정합한 선택. Pen 의 레이아웃 단순성을 부러워할 이유는 없다 — composition 이 그 모델을 채택하면 노코드 빌더의 산출물 (실제 웹앱 CSS) 을 포기하게 된다.

### (f) 히트테스트/컬링 — 벡터 정밀 vs clip-aware

- **Pen**: 자식 역순 재귀 `pointerHitTest` + wasm `path_contains` — **벡터 외곽선 기준 point-in-path 정밀 히트** (일러스트형 도형에 유리). 컬링은 노드 AABB.
- **composition**: command stream + AABB 컬링 (`translateStack`/`scrollDeltaStack` 스크롤 반영) + **`hitBoundsMap` = 원본 박스 ∩ 조상 clip rect** (보이는 영역만 히트, canvas-rendering.md §8.5) + SpatialIndex. 박스 모델 중심이라 AABB 근사로 충분하고, overflow 컨테이너에서 잘린 영역의 유령 히트를 구조적으로 차단 — 2026-07-24 실측 버그 일괄 해소의 산물.
- **판정**: 서로 다른 형상 도메인에 최적화 — Pen 은 자유 벡터 도형, composition 은 CSS 박스 + overflow/clip. composition 에 path 정밀 히트가 필요해지는 시점 (자유 도형 도구 도입) 에 `path_contains` 계열이 참조 지점.

### (g) 오버레이 chrome 좌표계 — 명시 2-pass vs scene 단일계

- **Pen**: `render` (worldspace — 1/zoom 폭 아웃라인·스냅 가이드) / `renderScreenspace` (리사이즈 핸들·눈금·프레임명) 를 **렌더 패스 시그니처로 분리** — 좌표계 혼동을 타입 수준에서 차단.
- **composition**: overlayNode/screenOverlayNode 모두 카메라 변환 아래 렌더 (scene 단일계 원칙 — canvas-rendering.md §8.7) + screen 고정 시각 요소는 1/zoom 역보정. §8.7 의 "선택 박스 panOffset 이중 보정" 버그처럼 단일계 원칙으로 사고를 단순화한 이력.
- **판정**: 현행 scene 단일계는 히트/선택 좌표계와 일관돼 유지가 옳다. 다만 순수 screen-space 위젯 (핸들·라벨·눈금) 이 늘어나 1/zoom 역보정이 산재하기 시작하면 Pen 형 명시 분리 패스가 승격 선례.

### (h) 총평 — Pen 렌더링 단순성의 출처는 "DOM 정합 포기"

| 비용 구조         | Pen                                       | composition                                            |
| ----------------- | ----------------------------------------- | ------------------------------------------------------ |
| 시각 검증 대상    | 렌더러 1개 — canvas 가 곧 정본            | 대등 2-consumer — cross-check 상수 비용                |
| 텍스트 oracle     | 단일 (불일치 클래스 부재)                 | 이중 + 교정 레이어 상시 유지                           |
| 레이아웃 표면적   | 3모드 극소                                | CSS 표준 전체 + 운영 규율                              |
| 그 대가로 얻는 것 | 단순성·속도 (HTML 은 근사 export 로 격하) | **Preview/Publish = 실제 웹앱** (노코드 빌더의 산출물) |

개별 수법 (줌 캐시 — 이미 동형, 배치 API, 커서, rAF 정지) 은 차용 가능하지만, Pen 의 아키텍처 수준 단순성은 "HTML 을 일방향 산출물로 격하" 한 제품 전제에서 나온다 — composition 이 이를 차용하는 것은 제품 정의 변경이지 렌더링 최적화가 아니다.

## 6-2. 차용 후보 (우선순위순)

**렌더링** (§6-1 실측 정정 반영):

1. ~~줌/팬 콘텐츠 캐시 surface + cubic 리샘플 blit~~ — **이미 동형 구현 완료** (§6-1-c). 차용 후보에서 제외, 본 실측은 파라미터 일치 검증으로 역할 전환.
2. ~~**idle 시 rAF 체인 완전 정지** (`framesRequested` 카운터)~~ — **기각 2026-07-26**. [ADR-167](../../adr/completed/167-on-demand-frame-loop.md) 로 설계 후 G0 실측 불통과 (유휴 비용이 코어 1개의 0.67% = 6.7ms/s 로 wake 누락 버그 클래스 도입 대가에 미달). 추가 실측: **유휴 프레임은 Skia draw 호출을 1건도 내지 않는다** (240 + 192 프레임 관측, 인터셉터 유효성 2/2 + 동일 CanvasKit 싱글턴 확인) — 이미 프레임 분류 단계에서 그리기를 건너뛰므로 남는 절감은 루프 자체의 분류 오버헤드뿐. 파생 처리 2건 완료 (`performanceMonitor` 상시 rAF → 버스트 측정 / ADR-153 우선순위 근거 인용).
3. ~~**배치 드로우 API** (`draw_rect_array`)~~ — **ADR-153 에 흡수 2026-07-26**. CanvasKit 공식 표면에 배치 API 는 없으나, 이 빌드에 `PictureRecorder` / `MakePicture` / `drawPicture` 가 **모두 존재**함을 live 확인 — 즉 등가 이득의 경로는 ADR-153 **Phase 3 (Picture 캐시)** 이며 API 실현 가능성 spike 는 해소됐다. 도입 여부를 가를 draw-call 카운터는 ADR-153 **Phase 1** 의 결번 지표 그 자체 (Context 격차 3). 별도 후보로 유지하지 않음. 자체 바인딩 빌드는 Phase 1 실측이 per-call WASM 왕복 지배를 보일 때만 재론.
4. **worldspace/screenspace 오버레이 패스 명시 분리** — 조건부 유지 (§6-1-g). 2026-07-26 실측: `1/zoom` 역보정 **147건 / 26 파일** (오버레이 렌더러만 60건 — selection 24 · hover 10 · dropIndicator 7 · slotMarker 6 · overlayBuilder 5 · overlayHelpers 4 · grid 4, 별도 기능 캔버스인 workflow\* 39 제외). 다만 형태가 `const sw = 1 / zoom` **균일 관용구**라 "산재"보다 "관행"에 가깝다 → 패스 분리(§8.7 scene 단일계 원칙 반전이라 ADR 필요) 대신 **공유 헬퍼 1개로 심볼 단일화**가 선행 저비용 수단. 헬퍼조차 오·남용되기 시작하면 그때 Pen 형 2-pass 승격.
5. ~~각도 캐시된 회전 리사이즈 커서~~ — **완료 2026-07-26** (`selection/resizeCursors.ts`, 1° 양자화 + 180° 대칭 접기, 회전 도입 시 `rotationDeg` 인자만으로 확장).

**UI/UX** (2026-07-26 코드 실태 확인 결과 반영):

1. ~~**`--canvas-bg` 토큰 공유**~~ — **이미 동형** (`setupThemeWatcher` 가 캔버스 컨테이너의 `--bg` 를 resolved sRGB 로 읽어 렌더러에 공급, `skia/themeWatcher.ts:71`). Pen 식 별도 `--canvas-bg` 신설은 색 출처를 2개로 늘리는 후퇴. / **선택 시에만 나타나는 초경량 속성 패널** (212px, 접힘 시 플로팅 미니 카드) — 기술 장애 없음, **제품 UX 결정** 대상 (ADR-163 패널 표준의 `.panel > .panel-contents > .section` 골격과 공존 가능한지가 유일한 확인 항목).
2. **auto-layout 자식에서 화살표 키 = 형제 순서 재배치** — **실행 후보 (전제는 다름)**. composition 은 px nudge 가 애초에 없어 "무의미한 기능의 승화"가 아니라 **신규 기능**이다. canonical `children[]` 이 순서 SSOT (ADR-118) 라 mutation 정의는 명확하고 히스토리 통합 경로도 기존. 걸림돌 1건 — `arrowUp`/`arrowDown` 이 이미 category `events` + scope `canvas-focused` 로 점유 중 (`config/keyboardShortcuts.ts:559-577`) → `detectShortcutConflicts` 대상, scope 재정의 선행. 규모 소~중, ADR 불요.
3. **AI tool-call 시제 라벨 테이블** + **선택 컨텍스트 칩** + **캔버스 플래시형 변경 표시** — [ADR-134](../../adr/134-ai-assistant-llm-infrastructure-unification.md) 계열로 라우팅 (Proposed). 본 문서에서 별도 후보로 추적하지 않음.
4. **스타일 프리셋 = 토큰 값 세트 + 썸네일** — **부분 존재**: 테마 썸네일은 `panels/themes/MiniThemePreview.tsx`, 스펙 프리셋 해석은 `panels/styles/utils/specPresetResolver.ts` 로 이미 있고 **갤러리 UI 형태만** 미도입. theme/tokens SSOT (ADR-110) 위 확장이라 저비용.
5. ~~단축키 데이터 테이블 SSOT~~ — **이미 동형이며 더 완비**. `SHORTCUT_DEFINITIONS` + `SHORTCUT_PRIORITY` (8단계) + `scope` + `i18n` 를 갖춘 `config/keyboardShortcuts.ts` 단일 소스에, 소비자로 치트시트 (`components/help/KeyboardShortcutsHelp.tsx`) · 툴팁 (`components/overlay/ShortcutTooltip.tsx`) · 커맨드 팔레트 · 충돌 검출기 (`utils/detectShortcutConflicts.ts`) · 디버거까지 존재. 후보에서 제외.
6. **container query 사이드바 탭** (아이콘↔라벨) + 리사이즈 핸들 더블클릭 복원 — **미도입 확인** (`@container` / `container-type` 사용 0건). ADR-163 패널 표준 안의 저비용 디테일. §2 예약 prefix 규칙 (`tab-*` 은 탭 UI 전용) 준수 필요.
7. **빈 캔버스 예시 프롬프트 칩** — 패널 단위 empty-state 는 다수 존재하나 **캔버스 온보딩은 없음**. AI 프롬프트 연계라 3번과 함께 ADR-134 계열에서 다루는 편이 자연스러움.

**종합** — 원 후보 12건 (렌더링 5 + UI/UX 7) 의 처분: **이미 동형 3** (줌 캐시 · canvas-bg · 단축키 SSOT) / **완료 2** (커서 · rAF 파생 정리) / **기각 1** (ADR-167) / **타 ADR 흡수·라우팅 3** (배치 API→153, AI 3종·온보딩 칩→134) / **조건부 유지 1** (2-pass 분리) / **실행 후보 3** (화살표 재배치 · 프리셋 갤러리 · container query 탭) / **제품 결정 1** (초경량 속성 패널).

**2026-07-29 추가 4건** — §6-3-5 참조: 팬 deps 분리 (A, 유일하게 회수량이 측정된 후보) · 무효화 3단계 분류 (B) · `buildDepthMap` 증분화 (C) · 방어적 Map 복사 제거 (D).

---

## 6-3. Pen 장점 전수 카탈로그 + 팬 경로 실측 (2026-07-29)

### 6-3-0. 이 절의 성격

§6-1 이 축별 비교, §6-2 가 차용 후보 처분표라면 본 절은 **"Pen 이 잘 하는 것" 을 빠짐없이 나열한 카탈로그**다. 사용자 질문("요소가 많아도 성능 저하가 없는 이유")에서 출발해 추출본을 재조사했고, 그 과정에서 composition 측 신규 실측 1건을 얻었다.

**핵심 판정**: Pen 의 장점은 "그리는 코드가 빠르다" 가 **아니다**. 그쪽은 오히려 순진하다 (§6-3-3). 장점은 전부 ① **실행 자체를 차단하는 게이트**와 ② **모델이 곧 렌더 소스인 단층 구조**에서 나온다.

### 6-3-1. 신규 실측 — composition 의 팬 프레임당 O(N)

**측정 방법**: MCP 탭이 hidden 이라 rAF 정지 + 타이머 1Hz 스로틀이 걸려 이벤트 구동 팬 측정은 불가능했다 (메모리 `reference-chrome-mcp-hidden-tab-raf-pause-stale-overlay`). 그래서 두 갈래로 분리했다.

- **비용** — `buildSceneStructureSnapshot` 에 라이브 입력을 stash 해 **동기 반복 호출**로 측정 (타이머 무관). 스케일은 `page-components` 요소를 클론해 확장.
- **빈도** — 코드로 확정. `useViewportControl.ts:349` 가 팬 델타를 rAF 당 1회 store 에 반영 → `BuilderCanvas` 리렌더 → 해당 useMemo deps 에 `panOffset`/`zoom` 포함 (`BuilderCanvas.tsx` 의 `sceneStructureSnapshot` / `layoutPublisherInputs`).

| 노드 수            | snapshot p50 | p95   | `new Map(elementById)` |
| ------------------ | ------------ | ----- | ---------------------- |
| 62 (실제 프로젝트) | 0.1ms        | 0.6ms | ~0                     |
| 224                | 0.1ms        | 0.2ms | ~0                     |
| 980                | 0.3–0.5ms    | 0.6ms | ~0                     |
| 4,868              | 1.3ms        | 1.4ms | 0.2ms                  |
| 9,728              | 2.1–3.9ms    | 4.6ms | 0.4ms                  |

노드당 약 0.3µs 선형. 하위 분해 (N=9,728): `buildDepthMap` 0.8ms (최대, 약 38%) · `buildPageDataMap` 0.4ms · `buildPageFrames` 0.2ms · 나머지 약 0.7ms (페이지별 `hashString` + visible set).

`layoutPublisherInputs` 는 visible page 마다 `new Map(elementById)` 를 뜬다 (`renderers/rendererInput.ts`) → 10k·2페이지에서 약 0.8ms 추가. **합계 약 3~4.7ms/프레임 = 60fps 예산의 18~28%.** Pen 은 이 구간이 0ms 다 (§6-3-2 (a) #5).

**측정 한계 (명시)**: end-to-end 팬 프레임은 측정하지 못했다 — 위는 "함수 비용 × 코드로 확인한 빈도" 다. `performance.now()` 가 0.1ms 로 양자화돼 소규모 값은 정밀도가 낮고, 10k 두 회차가 2.1/3.9 로 갈린 것은 JIT·GC 편차다. 스케일은 단일 페이지 클론이라 실제 문서의 형태 분포와 다르다. 계측 코드는 반영하지 않고 되돌렸다.

**정정 1건**: `skiaRendererInput` useMemo 는 deps 에 `panOffset`/`zoom` 이 **없어** 팬에 재계산되지 않는다. 팬 경로에 걸리는 것은 위 두 개뿐이다.

### 6-3-2. 장점 카탈로그

composition 열의 표기: ✅ 이미 동형 / △ 부분 / ❌ 없음 / — 해당 없음.

#### (a) 프레임 루프 · 카메라

| #   | 장점                                                                                        | composition                                  |
| --- | ------------------------------------------------------------------------------------------- | -------------------------------------------- |
| 1   | idle 시 rAF 체인 완전 정지 (`framesRequested` 0 → `activeRenderLoop=false`)                 | ❌ — 단 **기각됨** (ADR-167 G0 불통과, §6-2) |
| 2   | 콘텐츠 서피스 캐시 (화면+512px, 특정 줌 래스터 후 snapshot blit)                            | ✅ 파라미터까지 일치                         |
| 3   | 재래스터 게이트 4개 (줌×3 / bounds 이탈 / `invalidateContent()` / 이동 종료 200ms debounce) | ✅                                           |
| 4   | 줌 제스처 중 stale 캐시를 `makeShaderCubic(.3,.3)` 로 리샘플만                              | ✅                                           |
| 5   | **팬/줌 중 레이아웃 호출 0** — `updateLayout()` 이 `redrawContentIfNeeded()` 안에만 존재    | ❌ 팬 프레임마다 스냅샷 재구축 (§6-3-1)      |
| 6   | 프레임 이벤트를 `queuedFrameEvents` Set 으로 프레임당 1회 debounce                          | △                                            |

#### (b) 컬링

| #   | 장점                                                                                               | composition                                 |
| --- | -------------------------------------------------------------------------------------------------- | ------------------------------------------- |
| 7   | **서브트리 진입 차단** — `beginRender` 실패 시 즉시 return, 자식 재귀 자체가 없음 (O(1))           | △ replay 중 `skipDepth` 로 커맨드 선형 스캔 |
| 8   | 보수적·정확한 컬 박스 — frame 은 `clip:false` 일 때, group 은 항상 자식 visual bounds union        | ✅                                          |
| 9   | 컬 박스 dirty 캐시 (`_visualLocalBoundsDirty`)                                                     | ✅                                          |
| 10  | 월드 좌표 컬 rect 를 그대로 하강 — 레벨마다 좌표 재유도 없음 (`intersectsWithTransform` 이 역변환) | ✅                                          |
| 11  | 오버레이 이펙트도 `camera.overlapsBounds()` 별도 컬링                                              | ✅                                          |

#### (c) 레이아웃

| #   | 장점                                                                                     | composition                                                                |
| --- | ---------------------------------------------------------------------------------------- | -------------------------------------------------------------------------- |
| 12  | **조상 체인 dirty 마킹 + 조기 중단** — `for(e=parent; e && !e.layout.dirty; e=e.parent)` | ❌ 버전 카운터 + 시그니처 해싱                                             |
| 13  | 하강도 매 레벨 게이트 — `Qq`/`eG`/`J1e` 3 pass 전부 `if(n.layout.dirty)` 로 진입 판정    | △ 엔진 증분은 있으나 TS 층은 페이지 단위                                   |
| 14  | clean root 는 체크 1회로 반환 — 문서 전체를 순회해도 비용이 문서 크기에 비례하지 않음    | ❌ `createPageLayoutSignature` 가 편집마다 페이지 전 요소 × 키 문자열 생성 |
| 15  | 월드 행렬 캐시 (`worldMatrix`, `onTransformChange` 에서만 갱신)                          | ✅                                                                         |

#### (d) 무효화 분류 — 가장 정교한 항목

`classifyVisualChange` 가 3단계를 돌리고 `invalidateVisualCaches(t)` 가 단계마다 다른 전파 규칙을 적용한다.

```js
invalidateVisualCaches(t){ let e = (t===1);
  for(let r=this; r!=null; r=r.parent){
    r._thumbnail = undefined;
    e && (r._visualLocalBoundsDirty = true);
    t===2 && (e = true);
  }}
```

| 변경 종류                 | 단계 | bounds 무효화 범위                         |
| ------------------------- | ---- | ------------------------------------------ |
| 색 · 채움 · 텍스트 스타일 | 0    | **0개** — 썸네일만 폐기                    |
| 크기 · 이펙트             | 1    | 자기 + 조상 전부                           |
| 위치 · 회전 · enabled     | 2    | 자기는 **제외** (로컬 bounds 불변), 조상만 |

composition 의 대응물은 `LAYOUT_AFFECTING_PROP_KEYS` / `NON_LAYOUT_PROPS_UPDATE` 2단계이며 그것도 레이아웃 축 전용이다. 씬 스냅샷 축에는 분류가 없다. → ❌

#### (e) 노드별 캐시

| #   | 장점                                                                                                      | composition                                                        |
| --- | --------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------ |
| 17  | `_fillPath`+`fillPathDirty`, `paragraph`+`dirtyParagraph`, `strokePath`, `_isPathOpenCache`, `_thumbnail` | ✅ **composition 이 더 많음** (LRU 측정 캐시 + `nodePictureCache`) |

> **#17 정정 주의 (2026-07-30)**: "더 많음" 은 캐시 **개수**의 비교일 뿐 우위가 아니다. Pen 의 노드 소유(수명=노드) 모델은 상한·퇴거·프레임 중 delete 가 구조적으로 없어 composition 의 텍스트 소실 버그 부류(LRU 문턱 초과 → 스래싱 → WASM 주소 재사용 blob stale)가 성립 불가다. 상세 §3-4-1, composition 잔존 결함 현황은 `BUILDER_FRAME_DROP_BASELINE_5K.md` §8.

#### (f) 텍스트

| #   | 장점                                                                                                                                                                       | composition                                                                                                      |
| --- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------- |
| 18  | 측정 엔진 단일 (skia textlayout Paragraph + ICU74) — 정합 대조 대상이 없음                                                                                                 | ❌ 이중 (Canvas 2D ↔ CanvasKit) — CSS 정합의 대가                                                                |
| 35  | paragraph 수명 = 노드 수명 (전역 LRU 없음) + 일반 렌더는 Path fill (`drawParagraph` 는 PDF 전용) — 스래싱 문턱·blob stale 부류가 구조적으로 부재 (§3-4-1, 2026-07-30 추가) | ❌ 전역 LRU 상한 1,000 + 프레임 중 즉시 delete + `drawParagraph` — 텍스트 소실 버그의 성립 조건 (기준선 문서 §8) |
| 19  | 폰트 raw TTF 직접 fetch → `pencil_typeface_make_from_data`, Google Fonts 내장                                                                                              | △                                                                                                                |
| 20  | DOM 오버레이 편집 (`transform: matrix()` 정합, Quill / `<input>`)                                                                                                          | ✅ TextEditOverlay 동형                                                                                          |
| 21  | UI 폰트와 문서 폰트 완전 분리                                                                                                                                              | ✅                                                                                                               |

#### (g) 구조

| #   | 장점                                                                                            | composition                                                                   |
| --- | ----------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------- |
| 22  | **파생 계층 0개** — 재래스터가 `getViewportNode().children → renderSkia` 로 씬 그래프 직접 순회 | ❌ 4겹 (store→sceneNodes→snapshot→rendererInput→command stream) — 런타임 형상 |
| 23  | 최상위 단위가 여느 노드와 같은 기제 — 컬링·dirty 게이트를 상속                                  | △ 모델은 동일 (트리 노드) — 런타임만 page 전용 축으로 특수화 (아래 주의)      |
| 24  | CSS 호환 목표 없음 — hug/fill/고정 3모드, margin·percent 불지원                                 | — 정반대가 제품 목표                                                          |

> #23 주의 (2026-07-29 지적 → **2026-07-30 재정정**): page(composition)/frame(Pen) 은 **명칭만 다르다** — 둘 다 프로젝트 노드 아래 같은 트리 구조이고 format 도 1:1 (§5 컴포넌트 모델 정합 재확증). "씬 그래프 안/밖" 이분법도 모델 차이가 아니라 **빌더 런타임의 코드 형상**이다 — canonical 문서에서 page 는 이미 트리의 노드이고, 런타임이 그것을 전용 축(pagePositions/pageIndex/visiblePages/페이지별 layout publish)으로 특수화해 다뤘을 뿐이다. 따라서 이 행은 "구조가 달라 차용 불가" 가 아니라 **구현 통합 여부** 항목이다. composition 도 레이아웃·컬링은 visible page 로 이미 제한한다 (`BuilderCanvas.tsx` `visiblePages`) — 빠진 것은 팬 경로뿐 (§6-3-1).

#### (h) 오버레이 · 인터랙션

| #   | 장점                                                                                 |
| --- | ------------------------------------------------------------------------------------ |
| 25  | 오버레이 chrome 전부 캔버스 렌더, worldspace/screenspace 2-pass 명시 분리 (§6-1-g)   |
| 26  | 히트테스트 벡터 정밀 — `pencil_path_contains` point-in-path, 자식 역순 재귀          |
| 27  | 픽셀 그리드를 SkSL runtime effect 로 content shader 를 감싸 렌더 (줌 4→5.5 페이드인) |

#26 은 정밀도 우위이고 확장성은 composition 의 SpatialIndex 가 우위다 (Pen 은 공간 인덱스 없음).

#### (i) 셸 · 내보내기 · AI

| #   | 장점                                                                                                            |
| --- | --------------------------------------------------------------------------------------------------------------- |
| 28  | `--canvas-bg` 를 패널과 캔버스가 공유 (composition 은 이미 동형 — §6-2 UI/UX 1)                                 |
| 29  | 속성 패널 212px, 선택 시에만 표시 (제품 UX 결정 대상)                                                           |
| 30  | goodies = 셰이더 12종 × 99 프리셋, QuickJS 샌드박스 (`setMemoryLimit`/`setMaxStackSize`/시드 고정 RNG)          |
| 31  | 스타일 갤러리 = 타입드 파라미터 세트 56종 ("프리셋 = 데이터")                                                   |
| 32  | PDF 를 SkPDF 네이티브 벡터로 — `renderTarget===PDF` 분기 하나로 동일 렌더 경로 재사용                           |
| 33  | HTML 자동 export 루프 상주 (4초 debounce / 최소 60초 간격)                                                      |
| 34  | AI — 5계열 CLI + 자체 프록시, `spawn_agents` 병렬 오케스트레이션, `batch_design` 부분-JSON 스트리밍 라이브 렌더 |

### 6-3-3. 장점이 **아닌** 것 — Pen 이 일부러 안 하는 것

카탈로그만 보면 "최적화가 잘 된 앱" 으로 읽히지만 실측은 반대다. **최적화 대상 축을 잘못 잡지 않으려면 이쪽이 더 중요하다.**

- `new ze.Paint` 를 fill 마다 새로 할당하고 delete — Paint 풀 없음 (할당 지점 47곳)
- 노드별 Picture 캐시 없음 — 재래스터는 보이는 씬 전체 재기록
- 공간 인덱스 없음 (rbush/quadtree 0건) — 최상위 frame 목록 선형 스캔
- 타일링 없음 — 단일 패딩 서피스
- 워커 0 / SharedArrayBuffer 0 — 완전 단일 스레드
- 커맨드 스트림 같은 중간 표현 없음

### 6-3-4. 대가 — 차용 불가 항목 (2026-07-30 축소 정정)

> 초판은 #22·#24·#18 을 묶어 "DOM/CSS 정합 포기의 산물" 로 판정했다. **#22 를 여기 넣은 것은 과잉**이었고, ADR-172 가 이 문장을 인용해 구조 축(④)을 배제한 채 국소 축(①)만 최적화하는 근거가 됐다 (결과: 실사용 회귀로 전량 되돌림 — ADR-172/173 Deprecated).

DOM/CSS 정합의 실제 대가는 둘뿐이다:

- **#18 측정 oracle 이중화** (Canvas 2D ↔ CanvasKit) — Preview DOM 이 대등 consumer 인 이상 측정은 브라우저와 같아야 한다. 차용 불가 유지.
- **#24 레이아웃 알고리즘 표면적** (CSS 표준 전체 ↔ hug/fill 3모드) — ADR-164/165/169/170 의 작업량이 그 대가. 차용 불가 유지 (제품 목표 자체).

**#22(파생 계층 4겹)는 정합의 산물이 아니다** — React 호스팅 + 불변 store(canonical + undo) 라는 런타임 구현 선택이다. ②(편집 무효화 O(N))도 정합 탓이 아니다 — Rust 엔진은 이미 조상 체인 dirty 조기 중단 + 세대 카운터 증분 skip 을 갖고 있고(layout-engine.md), O(N) 은 TS 브리지(`createPageLayoutSignature` + 커맨드 스트림 전체 재구축)의 전략 선택이다. CSS 의 넓은 reflow 도달 범위는 무효화를 보수적으로 만들 뿐 게이트 자체를 막지 않는다.

경계는 **해소가 레이아웃 단에서 끝난다**는 것이다 — catalog 저장값(CSS 의미값)과 .pen 저장값(3모드)의 차이는 엔진이 x/y/w/h 로 해소하는 비용까지이고, 그 뒤 렌더 경로(트리 순회·컬링·dirty·서브트리 skip)는 두 앱이 동형 조건이다. 축 ③, 그리고 ④의 렌더 경로 부분은 정합과 무관하게 차용 가능하다.

### 6-3-5. 신규 차용 후보 (§6-2 목록에 추가)

| 후보                                                                                                             | 근거                                                                                 | 규모            |
| ---------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------ | --------------- |
| **A. `sceneStructureSnapshot` deps 에서 `panOffset`/`zoom` 분리** — `visiblePageIds` 산출만 별도 useMemo 로 분리 | §6-3-1 (10k 기준 3~4.7ms/프레임 회수, **유일하게 측정된 회수량**)                    | 소              |
| **B. 무효화 3단계 분류 도입** — 색·텍스트 변경이 기하 캐시를 건드리지 않게                                       | §6-3-2 (d)                                                                           | 중, 효과 미측정 |
| C. `buildDepthMap` 증분화 (A 의 38%)                                                                             | §6-3-1 분해                                                                          | 중              |
| D. `new Map(elementById)` 방어적 복사 제거 (읽기 전용 소비자면 `ReadonlyMap`)                                    | §6-3-1                                                                               | 소              |
| E. paragraph **폐기 지연** (flush 후 WASM delete) — 성능 최적화가 아니라 use-after-free 계열 수명 결함의 수리    | §3-4-1 + 기준선 문서 §8 (되돌린 처치 중 유일하게 Pen 모델과 방향 일치)               | 소              |
| F. paragraph 수명을 노드(registry entry)에 묶는 retained 전환 — 전역 LRU 폐지                                    | §3-4-1. 단 composition 은 전 페이지 4,969 노드 전역 등록이라 **메모리 축 검토 선행** | 중              |

A 만으로 팬 경로의 측정된 비용 대부분이 사라진다. B~D 는 기제 개선이며 효과는 미측정이다. E 는 성능 항목이 아니라 정합(텍스트 소실) 항목이다. **#1 (idle rAF) 은 재론 금지** — ADR-167 로 기각 완료.

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
