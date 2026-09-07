# Pen v1.2.8 데스크탑 번들 대조 — v1.2.1 실측 대비 델타

> **작성일**: 2026-09-07
> **분석 대상**: `/Users/admin/work/pencil` — **Pen.app v1.2.8** 번들 내용물 (`Contents/` 계층이 그대로 복사된 형태, 빌드 2026-09-02). `Resources/app.asar` (138MB) 를 `@electron/asar` 로 전개해 실측
> **대조 기준**: `docs/pencil-extracted/` 의 **Pen.app v1.2.1** 번들 (gitignored, `app.asar` 191MB) 을 같은 방법으로 전개해 파일 단위 diff
> **선행 문서**: [PEN_V1.2.1_RENDERING_UIUX_ANALYSIS.md](PEN_V1.2.1_RENDERING_UIUX_ANALYSIS.md) (2026-07-26 ~ 08-14, v1.2.1 실측 정본) · [PENCIL_ECOSYSTEM_ANALYSIS.md](PENCIL_ECOSYSTEM_ANALYSIS.md) (2026-08-17, v1.1.57 로컬 번들 전제) · [PENCIL_RENDERING_OPTIMIZATION.md](PENCIL_RENDERING_OPTIMIZATION.md)
> **방법**: 두 전개본의 `out/` 트리·`node_modules/@ha/*` 소스(TypeScript 원본이 동봉됨)·`pen.schema.json`·MCP 스키마 JSON·`pencil.wasm` strings·minified `index.js` 를 grep/diff 로 대조. 추정은 "추정" 으로 표기
> **관련 메모리**: `project-pen-v128-bundle-delta` (신규) · `project-pen-v121-extraction-analysis` (v1.2.1)

---

## 0. 결론 우선

1. **artifact 출처가 정리됐다.** `/Users/admin/work/pencil` 은 더 이상 Pencil.app v1.1.57 이 아니라 **Pen v1.2.8** 이다. 선행 문서가 "두 artifact 를 합치지 말 것" 이라 보류했던 provenance 문제는 같은 계보의 후속 릴리스로 확정됐다 — `pen-migration.js` (구 Pencil 제거) 는 사라지고 `pencil-cleanup.js` (설치 잔재 정리) 만 남았다.
2. **렌더링 코어는 변경 0.** `pencil.wasm` 은 9.55MB → 9.55MB, Skia m149 · ICU 74 · harfbuzz 동일. 프레임 루프 (`framesRequested`) · 콘텐츠 캐시 (`contentRenderedAtZoom`, `makeShaderCubic`) · JS 레이아웃 (`layout.dirty`) · Path 텍스트 렌더 (`renderAsPath`) · Quill 편집 · 워커 0 · PixiJS 잔재 — v1.2.1 문서 §2·§3·§6 의 판정이 전부 그대로 성립한다. C API 만 385 → **396** (path 프리미티브 판별·생성 10 + `canvas_get_surface` 1).
3. **AI 도구 표면이 재편됐다 — MCP 도구 10종 → 6종.** 읽기 도구 5종 (`batch_get`/`snapshot_layout`/`get_variables`/`export_nodes`/`export_html`) 과 `get_screenshot` 이 사라지고 **`execute` 하나의 JS API** (`Get`/`GetVariables`/`Export`/`TakeScreenshot`/`FindEmptySpace`…) 로 흡수됐다. `batch_design` 은 `execute` 로 개명 (내부 QuickJS 런타임 파일명은 여전히 `batch_design.js`). `get_guidelines` 는 `get_style` (스타일 26종) + `read_skill` (가이드 corpus) 로 분리. **`browser` 도구 신설.**
4. **에이전트 규범이 앱 밖으로 나갔다 — 스킬 번들.** v1.2.1 은 `.pen` 스키마 문서와 규칙 마크다운을 빌드 시 `?raw` import 해 시스템 프롬프트에 붙였다. v1.2.8 은 `out/skills/pen-dev/` (SKILL.md + execute.md + pen-schema.md + guide 9종) 를 **원격 blob storage 의 `skills/latest.json` 으로 갱신** (`minDesktopAppVersion` 게이트, staging→swap) 하고 Claude 에이전트에 `skills: "all"` 로 공급한다.
5. **브라우저 import 축 신설.** Electron `WebContentsView` 에 페이지 API 를 주입해 DOM 을 crawl (노드 상한 5,000) → `DomSnapshot` → 편집 가능한 캔버스 layer 로 재현. 디바이스 프리셋 18종, 요소 picker, 창 분리, MCP `browser` 5 action. 웹판은 Chrome Extension 으로 대체한다는 안내 문구가 있다.
6. **셸**: 대시보드 창 (새 파일 피커 대체, 로컬 draft 관리) · Comments 탭 (feature flag, 공유 링크 API) · Align 5 + Flip 2 단축키 · goodies 셰이더 +3 (glass/gummy/ripple) · CSP 에 `api.pen.dev` 추가.
7. **스키마 2.14 → 2.17 이지만 공개 표면 변경 0.** JSON 실차이는 `group` 의 `_PRIVATE` `layout` allOf 참조 제거 1건뿐 (43 defs · 노드 13종 동일).
8. **composition 차용 판정**: 렌더링 축은 변동 없음 (v1.2.1 문서 §6-2 처분 유지). 신규 참조 가치는 ① `execute` 형 "읽기까지 흡수한 JS DSL + 실패 시 트랜잭션 revert + find/replace 패치 재시도" (ADR-134 계열) ② 스킬 번들의 원격 갱신·버전 게이트 패턴 두 가지. 브라우저 import 는 composition 방향 (DOM 이 1급 consumer) 과 반대 방향이라 후순위.

---

## 1. artifact 출처 정리

| 항목                             | v1.2.1 (`docs/pencil-extracted/`)        | v1.2.8 (`/Users/admin/work/pencil`)                                            |
| -------------------------------- | ---------------------------------------- | ------------------------------------------------------------------------------ |
| `CFBundleShortVersionString`     | 1.2.1                                    | 1.2.8                                                                          |
| 번들 파일 mtime                  | 2026-07-20                               | 2026-09-02                                                                     |
| `app.asar`                       | 191MB                                    | 138MB                                                                          |
| Electron                         | 42.5.0                                   | 42.5.0 (동일)                                                                  |
| `@anthropic-ai/claude-agent-sdk` | 0.3.206                                  | **0.3.257**                                                                    |
| `@openai/codex-sdk`              | 0.144.1                                  | 0.144.1 (동일)                                                                 |
| `@cursor/sdk`                    | 1.0.22                                   | 1.0.22 (동일)                                                                  |
| `mcp-server-darwin-arm64` (Go)   | 4.76MB, go1.25.12                        | 4.69MB, go1.25.14                                                              |
| `out/editor/assets/index.js`     | 5.64MB                                   | **6.81MB** (+1.17MB — browser import · 대시보드 · Comments · ProseMirror 유입) |
| `@ha/*` 워크스페이스 패키지      | agent · ipc · mcp · schema · shared      | + **browser-inject** · **fonts**                                               |
| 업데이트 채널                    | `github:highagency/pen-desktop-releases` | 동일                                                                           |

`Info.plist` 의 bundle id 는 여전히 `dev.pencil.desktop`, 커스텀 프로토콜도 `pencil://` — 리브랜딩은 표시명·도메인 (`pen.dev`) 수준에서 진행 중이고 식별자는 유지한다. 선행 문서 [PENCIL_ECOSYSTEM_ANALYSIS.md](PENCIL_ECOSYSTEM_ANALYSIS.md) §2 가 "`/Users/admin/work/pencil` = v1.1.57 + koffi" 로 판정했던 번들은 이번 갱신으로 교체됐다 — koffi 는 v1.2.8 `app.asar.unpacked/node_modules` 에도 없다 (v1.2.1 판정과 동일).

---

## 2. 변경 없음 — 렌더링 코어 재검증

v1.2.1 문서의 렌더링 판정 근거가 된 심볼을 v1.2.8 번들에서 같은 방법으로 다시 셌다.

| 판정 (v1.2.1 문서 §)                                     | 증거 심볼                                       | v1.2.1 | v1.2.8 | 판정 |
| -------------------------------------------------------- | ----------------------------------------------- | -----: | -----: | :--: |
| 자체 emscripten Skia 빌드 (§2-1)                         | wasm strings `Skia/PDF m149`                    |   있음 |   있음 |  ✅  |
| ICU 임베드 (§3-4)                                        | `icudt74l`                                      |     26 |     26 |  ✅  |
| C API 표면 (§2-2)                                        | `_pencil_*` glue 매핑                           |    385 |    396 | +11  |
| on-demand 프레임 루프 (§3-1)                             | `framesRequested`                               |      5 |      5 |  ✅  |
| GPU 리소스 캐시 512MB (§3-1)                             | `setResourceCacheLimitBytes(512*1024*1024)`     |      1 |      1 |  ✅  |
| 콘텐츠 캐시 surface + 줌 캐시 (§3-2)                     | `contentRenderedAtZoom` / `makeShaderCubic`     | 10 / 3 | 10 / 3 |  ✅  |
| 완전 단일 스레드 (§3-5)                                  | `new Worker(` / `SharedArrayBuffer` / `pthread` |  0/0/0 |  0/0/0 |  ✅  |
| PixiJS 잔재 (§3-5)                                       | `webworkerAll.js` 183KB (lazy 청크)             |   있음 |   있음 |  ✅  |
| JS Figma 형 레이아웃 (§3-6)                              | `layout.dirty`                                  |     12 |     12 |  ✅  |
| 텍스트 = Path fill, `drawParagraph` 는 PDF 전용 (§3-4-1) | `renderAsPath` / `drawParagraph`                | 11 / 4 | 12 / 4 |  ✅  |
| DOM overlay 편집 = Quill (§3-4)                          | `quill`                                         |    252 |    252 |  ✅  |
| 공간 인덱스 없음 (§6-3-3)                                | `rbush` / `quadtree`                            |      0 |      0 |  ✅  |
| Picture 캐시 없음 (§6-3-3)                               | `PictureRecorder` (바인딩 정의 1건)             |      1 |      1 |  ✅  |
| Tailwind v3 CDN scaffold (§8-6)                          | `cdn.tailwindcss.com`                           |      1 |      1 |  ✅  |
| QuickJS 샌드박스 (§3-5)                                  | `evalCode` / `setMemoryLimit`                   |  5 / 2 |  5 / 2 |  ✅  |

v1.2.1 문서 §6-1 (렌더링 장단점) · §6-2 (차용 후보 처분) · §6-3 (장점 카탈로그) 는 **수정 없이 유효**하다.

### 2-1. 신규 C API 11개

```
_pencil_canvas_get_surface
_pencil_path_get_segments
_pencil_path_is_oval / _is_rect / _is_rrect
_pencil_path_make_circle / _make_line / _make_oval / _make_polygon / _make_rect / _make_rrect
```

`pencil_path*` 66 → 76. 방향은 두 가지다 — SkPath 를 rect/oval/rrect **프리미티브로 되돌리는 판별** (`is_*` + `get_segments`) 과 프리미티브에서 path 를 만드는 생성 (`make_*`). 브라우저 import 의 SVG/도형 환원 (§5) 과 같은 릴리스에 들어온 점으로 보아 **import 된 벡터를 rectangle/ellipse 노드로 승격하는 경로**로 추정한다 (JS 측 호출부 `path_is_rect` 2건 확인, 호출 문맥은 미추적).

---

## 3. 변경 — AI 도구 표면: MCP 10종 → 6종

`node_modules/@ha/mcp/src/schemas/*.json` 파일 단위 대조.

| v1.2.1 (10)                    | v1.2.8 (6)                         | 대응                                                                                                                      |
| ------------------------------ | ---------------------------------- | ------------------------------------------------------------------------------------------------------------------------- |
| `batch_design`                 | **`execute`**                      | 개명. 설명문도 동형 ("Use get_app_state if you don't have execute documentation"). `edits`/`editId` 파라미터 추가         |
| `batch_get`                    | —                                  | `execute` 안의 `Get(path, options)` · `Get(visit)` visitor 로 흡수                                                        |
| `snapshot_layout`              | —                                  | `Get(visit)` 의 `ctx.bounds` + `ctx.problems` ("partially clipped" / "fully clipped") 로 흡수                             |
| `get_variables`                | —                                  | `GetVariables()`                                                                                                          |
| `export_nodes` / `export_html` | —                                  | `Export(nodeIds, format, outputPath, options)` — png/jpeg/webp/pdf/html-tailwind/html-css                                 |
| `get_screenshot`               | —                                  | `TakeScreenshot(nodeIds)` (응답에 이미지 첨부)                                                                            |
| `get_editor_state`             | **`get_app_state`**                | 개명. `include_schema` 파라미터 제거 (스키마는 `read_skill` 로)                                                           |
| `get_guidelines`               | **`get_style`** + **`read_skill`** | guide 카테고리는 스킬 corpus 파일로, style 카테고리는 `get_style` (아카이타입 26종 — Aerial Gravitas … Zigzag Bold Split) |
| `spawn_agents`                 | `spawn_agents`                     | 스키마 동일                                                                                                               |
| —                              | **`browser`**                      | 신설 (§5)                                                                                                                 |

### 3-1. `execute` — JS DSL 의 실체

`out/skills/pen-dev/execute.md` (25.6KB) 가 공개 계약이고, 실행부는 `index.js` 의 QuickJS 호스트다.

- **API**: 변이 `Insert / Copy / Update / Replace / Move / Delete / Generate(nodeId, "ai"|"svg"|"stock", prompt) / SetVariables`, 읽기 `Get / Get<T>(visit) / GetVariables / FindEmptySpace / Print / TakeScreenshot / Export`. `document` 전역이 루트. 호출마다 새 scope — 값을 넘기려면 `const`/`let` 없이 전역 대입.
- **샌드박스**: v1.2.1 과 같은 QuickJS (`emscripten-module.browser-*.js` 2종). `setMemoryLimit(256MB)` · `setMaxStackSize(512KB)` · 인터럽트 데드라인 **2초** (호스트 호출 (export/screenshot/FindEmptySpace) 에 걸린 시간만큼 데드라인을 연장) · 도구 호출 전체 처리 상한 **55초** (`process()` 의 타임아웃 래퍼).
- **트랜잭션**: 문서 변이는 `rollback[]` 배열에 역연산을 누적하는 `unsafe*` 계열 (`unsafeApplyChanges` / `unsafeInsertNode` / `unsafeRemoveNode` / `unsafeChangeParent` …) 로 실행되고, 에러 시 "all modifications and the created globals will be reverted" (execute.md). 전역도 `__batchDesignExportGlobals()` 로 호출 끝에 추출·보존.
- **실패 복구 프로토콜**: 실패 응답에 `editId` 가 실리고, 다음 호출은 스니펫 재전송 대신 `edits: [{find, replace}]` 패치로 같은 `editId` 에 누적 적용한다. `partial` (스트리밍 부분 호출) 과 `edits` 는 배타.
- **스트리밍**: `partial === true` 호출을 도구 호출별 큐에 쌓아 도착 순서대로 실행 — 토큰이 흐르는 동안 캔버스에 그려지는 v1.2.1 의 라이브 렌더 기제가 그대로다 (`@ha/agent` claude 계층의 `fine-grained-tool-streaming` beta 헤더도 동일).
- **v1.2.1 과의 차이**: 런타임 자체는 같다 (`batch_design.js` / `batch_design_runtime.js` / `__batchDesignFindEmptySpace` 심볼이 두 버전에 같은 수로 존재). 달라진 것은 ① 읽기·export·스크린샷이 별도 MCP 도구에서 JS 함수로 이동 ② `edits` 패치 프로토콜 ③ 이름.

### 3-2. `get_app_state` 응답 구조 (추정)

스키마는 파라미터 0개. 설명문 "current state of the pen.dev app, current user selections and other essential information" 과 `execute` 설명문의 상호 참조로 보아 v1.2.1 `get_editor_state` 와 같은 역할 (활성 문서·선택·execute 문서 포인터). 응답 본문은 소켓 경유라 번들에서 확정하지 않았다.

---

## 4. 변경 — 스킬 번들 (`pen-dev`)

### 4-1. 구성

```
out/skills/pen-dev/
├── SKILL.md                 15.5KB  — 설계 규범 (좌표계·textGrowth·금지 속성·스타일 지침·검증 체크리스트)
├── execute.md               25.6KB  — §3-1 의 JS API 계약
├── pen-schema.md            11.8KB  — .pen 스키마 요약 (v1.2.1 의 generated-schema.md 38KB 를 대체)
├── scripts-and-shaders.md    3.5KB
└── guide/                   code · components · design-system · landing-page · mobile-app · slides · table · tailwind · web-app
```

`app.asar.unpacked` 에도 같은 트리가 있다 — 외부 CLI 가 파일 경로로 직접 읽을 수 있게 압축본 밖에 둔 것.

### 4-2. 갱신 기제 — `out/skills-manager.js`

- 원격 `https://hctfc8iexhqk0x3o.public.blob.vercel-storage.com/skills/latest.json` 을 fetch → `version` 비교 → `minDesktopAppVersion` 이 현재 앱보다 높으면 skip → zip 을 `~/.pencil/.skills-staging` 에 풀고 `~/.pencil/skills` 와 swap (`.skills-old` 보관). 오프라인 (TypeError) 은 정상 경로로 취급해 Sentry 에 보내지 않는다.
- 사용자 커스텀 스킬: `desktopConfig.customSkills` 경로 배열 (`addSkill`/`removeSkill`), YAML frontmatter (`name`/`description`/`author`) 파싱.
- 앱 기동 시 `skillsManager.refresh()` 는 non-blocking — "sessions read whatever bundle is on disk".

### 4-3. 에이전트 측 소비

- Claude 에이전트 (`@ha/agent/src/claude/index.ts`): `skills: "all"`, 파일 접근 자동 허용 경로에 `~/.claude/skills` 와 `~/.pencil/skills` 추가 (`isAllowedPath`). `disallowedTools: ["Agent"]`.
- 시스템 프롬프트: v1.2.1 은 `ipc-device-manager.ts` 가 `../../schema/generated-schema.md?raw` 와 `pencil.md?raw` 를 빌드 시 import 해 append 했다. v1.2.8 은 `getSystemPrompt(device)` 로 바뀌고 `read-skill-file` IPC (`device.readSkillFile(relativePath)`) 가 `read_skill` MCP 도구의 백엔드다 — **스키마·규범이 빌드 상수에서 런타임 파일로 이동**.
- 외부 CLI 설치 대상 (`@ha/mcp/src/installer.ts`, 두 버전 diff 0): claude (`~/.claude.json`) · codex (`config.toml`) · gemini · windsurf · cursor · antigravity (IDE/CLI 2종) · opencode · copilot · kiro · Claude Desktop — **11 타깃**. v1.2.1 문서 §5 의 "7종" 은 축소 서술이었다.

---

## 5. 변경 — 브라우저 import 축 (신규)

### 5-1. 구성 요소

| 층                   | 위치                                            | 역할                                                                                                             |
| -------------------- | ----------------------------------------------- | ---------------------------------------------------------------------------------------------------------------- |
| main 프로세스        | `out/browser-import/` 7 파일 (~100KB)           | `BrowserViewController` — Electron `WebContentsView` 생성·도킹/분리 (`detach` → 별도 창)·zoom·device UA·devtools |
| 페이지 주입 스크립트 | `@ha/browser-inject` (src 32 파일, vitest 동봉) | `PAGE_API_SOURCE` 를 `dom-ready` 마다 `executeJavaScript` — `window.__pencil` API (`fontsReady`, picker, crawl)  |
| 공유 타입·변환       | `@ha/shared/src/browser-import/` 16 파일        | `DomSnapshot`/`DomSnapshotNode` 타입, 디바이스 프리셋, CSS url/filter/sprite 파서, 클립보드 직렬화               |
| 렌더러 UI            | `index.js` (`browser-view:*` IPC 19 채널)       | "Import from browser" 버튼 (localStorage `browser-view-open`), 사이드바 **Browser** 탭                           |
| MCP                  | `browser` 도구                                  | `load-page` / `import-to-canvas` / `screenshot-to-canvas` / `return-element` / `return-screenshot`               |

### 5-2. DOM crawl (`dom-crawl.ts`)

- `MAX_NODES = 5000` 초과 시 `truncated`. `SKIP_TAGS` (script/style/link/meta/head/noscript/template/title) 제외, `RASTER_TAGS` (canvas/svg/video/iframe/object/embed) 는 래스터 캡처로 대체.
- 스타일은 `DomStyleKeyConfig` 의 키 집합만 수집 (computed style 전량이 아님), `::before`/`::after` 의사 요소 포함, `preScrollPage` 로 lazy 콘텐츠 선로드, fetch 타임아웃 15초.
- 컴포넌트 이름: `ComponentNameResolver` 가 React 계열 fiber 에서 이름을 읽어 **컴포넌트 DOM 경계 요소 1개에만** 기록 (`componentBoundaryName`). 결과는 import 된 노드의 `context` 필드에 `"Card - div"` 형태로 실린다 — "코드에서 요소를 찾는 좌표" 용도.
- 후처리 모듈: `inline-svg-images` · `svg-use-expansion` · `mask-vectors` · `sprite-extraction` (CSS background sprite 잘라내기) · `embed-thumbnails` · `remote-assets` (이미지는 브라우저 세션의 fetch 를 먼저 시도해 쿠키 의존 자산까지 가져오고, 실패 시 `net.fetch` 폴백) · `page-capture` (AVIF/HEIC 등을 Chromium 디코더로 PNG 재인코딩).

### 5-3. 디바이스 프리셋 (`browser-view.ts`, 18종)

iPhone 16e/17/Air/17 Pro/17 Pro Max · Pixel 10/10 Pro/10 Pro XL · Galaxy S26 · Z Fold 7 · iPad mini (A17 Pro)/Air 11·13 (M4)/Pro 11·13 (M5) · Surface Pro 12 · Nest Hub/Hub Max — 각각 CSS 너비 + UA. 캡처는 Chromium 이 타일링하는 device-pixel 상한 아래로 bounds 를 반올림한다.

### 5-4. 웹판과의 관계

번들 안내 문구: "This feature is available only in the desktop version, or you can also use pen.dev Chrome Extension to import from browser." — 웹 에디터는 확장 프로그램이 같은 `DomSnapshot` 을 클립보드 직렬화 (`serializeBrowserImportClipboardData`) 로 넘기는 구조로 추정. 온보딩 화면의 진입점 3개: **Import from Figma** (팝업) · **Import from browser** · **Recreate a screenshot**.

---

## 6. 변경 — 셸·문서 관리

| 항목                   | v1.2.1                                                                          | v1.2.8                                                                                                                                     |
| ---------------------- | ------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------ |
| 시작 화면              | `new-file-window.js` (템플릿 피커)                                              | **`dashboard-window.js`** — 최근 문서 + 로컬 draft 목록, 삭제/최근에서 제거, 템플릿으로 새 파일 (`DashboardCreateSubmission`)              |
| draft 저장소           | —                                                                               | **`~/.pencil/documents/<uuid>/<name>.pen`** (`managed-documents.js`) — "Drafts only exist in pen.dev". 삭제 시 previews 도 함께 제거       |
| 썸네일 서빙            | 파일 경로                                                                       | `pencil://<PREVIEW_URL_HOST>/…` 프로토콜 호스트로 서빙 (main.js 프로토콜 핸들러가 편집기 자산과 previews 를 host 로 분기, 경로 탈출 차단)  |
| 종료                   | 창 닫힘 → quit                                                                  | **`quit-state.js` 상태 머신** (Idle → ClosingWindows → Approved) — 열린 문서마다 `requestClose()` 승인 후 cleanup                          |
| 구 Pencil 이관         | `pen-migration.js` 16KB                                                         | 제거 → `pencil-cleanup.js` 3KB (남은 `Pen-*` 설치 파일 + `pencil-uninstall` 마커 처리)                                                     |
| 단축키                 | 57 라벨                                                                         | + **Align left/right/top/bottom/center · Flip horizontal/vertical** (7)                                                                    |
| 사이드바 탭            | Agent · Layers · Slides · Components · Libraries · Assets · Variables · Browser | + **Comments**                                                                                                                             |
| Comments               | `Comment` 도구 라벨만                                                           | `isFeatureEnabled("comments")` 게이트 + `commentManager` (hitTest/open/draft) + 공유 링크 API `/s/:token/comments` · `/api/share/comments` |
| 리치 텍스트 라이브러리 | Quill                                                                           | Quill 유지 + **ProseMirror/Tiptap 유입** (`ProseMirror` 50건, `collaboration` 확장 오류 문자열 포함 — 용도 미확정, 댓글·채팅 입력 후보)    |
| goodies                | 셰이더 GLSL 12 · webp 썸네일                                                    | + `glass.glsl` · `gummy.glsl` · `ripple.glsl`, 썸네일 +6 (blurry-lens · chlorophyll/cold/warm-gummy · glass · ripple)                      |
| 폰트                   | Google Fonts 카탈로그 `index.js` 내장                                           | 유지 (`fonts.gstatic` 3,512건 동일) + **`@ha/fonts`** (`font-fallback-index.json` — Noto Sans 계열 fallback 인덱스, 748KB)                 |
| CSP                    | `api.pencil.dev`                                                                | + **`api.pen.dev`**, `img-src pencil:` (썸네일 프로토콜), `storage.googleapis.com`                                                         |
| 텔레메트리             | PostHog + Sentry                                                                | 동일 (`posthog` 53 → 63)                                                                                                                   |

`out/data/` 의 번들 문서 13개 (shadcn/heroui/lunaris/nitro/halo 라이브러리 + 템플릿) 는 파일명 기준 동일.

---

## 7. 변경 — 에이전트 계층 (`@ha/agent`)

- **SDK**: `@anthropic-ai/claude-agent-sdk` 0.3.206 → 0.3.257. `thinking: {type: "enabled"}` → **`adaptive`**. 권한: `permissionMode` 를 config 로 받고, 권한 요청 다이얼로그의 "always-allow" 가 **"switch-to-auto"** (`setPermissionMode("auto")`) 로 바뀜.
- **모델 목록 추가** (`index.js` 문자열): `claude-5-opus` / `claude-opus-5` / `claude-fable-5-1` / `claude-5-fable`, `gemini-3.5-flash-lite` / `3.6-flash` / `3.7-flash`. GPT 계열 (`gpt-5.6-luna/sol/terra` 등) 은 동일.
- **pen.dev Pro 프록시**: `PEN_PROVIDER_ID = "pen.dev"`, 기본 `minimax-m3`. `pencil-provider.ts` 에 모델 4종의 **가격·컨텍스트 표** (`PENCIL_MODEL_SPECS` — MiniMax M3 512K · GLM 5.2 1M ctx/128K out · Qwen 3.7 Plus 256K · Kimi K2.7 Code) 가 코드로 박혔다. 표시명은 "Pencil Pro" → **"pen.dev Pro - …"**.
- **커스텀 provider**: `pi/custom-providers.ts` 신설 — `~/.pencil/models.json` 의 `providers` 를 pi-coding-agent `ProviderConfig` 로 읽어 등록 (OpenAI-compatible 등 `CUSTOM_PROVIDER_API_TYPES`, 기본 컨텍스트 512K). `pi/session-events.ts` 신설.
- `AgentType` 은 여전히 `claude | codex | gemini | pi | cursor` 5종. Cursor effort 는 `default` 단일.
- MCP 전송: `@ha/mcp` 에 `mcp-socket-server.ts` (node-ipc, `~/.pencil/socket/pencil-<app>.sock`, Windows 는 named pipe) + `mcp-transport.ts` 가 들어와 `@ha/ipc` 의 `transport-server`/`transport-request-router` 를 대체. `IPCDeviceManager` 가 `createAgent` 팩토리를 주입받는 구조로 바뀌어 `@ha/ipc` 의 `@ha/agent` 직접 의존이 끊겼다 (web-editor 호스트가 같은 패키지를 쓰기 위한 분리로 추정 — `pencil-provider.ts` 주석 "browser hosts (web-editor) can compile this file").

---

## 8. 스키마 2.14 → 2.17

`pen.schema.json` 정규화 diff 는 2곳뿐:

1. `version.const`: `"2.14"` → `"2.17"`
2. `group` 정의의 `allOf` 에서 `{ "_PRIVATE": true, "$ref": "#/$defs/layout" }` 제거

`$defs` 43개·노드 13종·fill/effect 종류·`generated-schema.md` (TS 타입 덤프) 는 version 문자열 외 동일. 즉 마이너 3단계는 내부 (`_PRIVATE`) 정리이며 **공개 표면과 composition canonical 정합 (v1.2.1 문서 §5) 은 그대로**다. 스킬의 `pen-schema.md` (11.8KB) 가 에이전트용 요약본으로 새로 들어왔고, `SKILL.md` 는 "alignItems baseline/stretch · margin · percentage size 불지원" 을 명시한다 — v1.2.1 문서 §3-6 판정과 일치.

---

## 9. composition 관점 시사점

| 후보                                                | 판정                                                                                                                                                                                                                                                                                                                              |
| --------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 렌더링 축 (v1.2.1 §6-2 · §6-3-5)                    | **변동 없음** — 코어 심볼 전부 동일 (§2). 기존 처분 (동형 3 · 완료 2 · 기각 1 · 라우팅 3 · 조건부 1 · 실행 후보 A~F) 유지                                                                                                                                                                                                         |
| `execute` 형 JS DSL                                 | **ADR-134 계열 참조 승격**. 읽기 도구를 JS 함수로 흡수해 도구 수를 줄이고, 변이는 rollback 배열로 트랜잭션화, 실패는 `find/replace` 패치로 재시도 — "compiler-first" 방향 (메모리 `project-ai-assistant-compiler-first-direction`) 과 정합. composition 의 7 tool loop 가 확장될 때 "도구 추가" 대신 "실행 API 확장" 을 먼저 검토 |
| 스킬 번들 원격 갱신 + `minDesktopAppVersion` 게이트 | 규범 문서를 앱 릴리스와 분리하는 운영 패턴. composition 은 규범이 `.claude/` 저장소 내 파일이라 현 단계 해당 없음 — 사용자 배포 AI 기능이 생기면 참조                                                                                                                                                                             |
| 브라우저 import (DOM → 캔버스)                      | **후순위**. composition 은 DOM 이 D3 의 대등 consumer 라 "HTML import" 는 곧 canonical 역변환 문제이고, publish 링크만 유지하는 현 방침 (`project-publish-link-only-defer-until-builder-stable`) 과 우선순위가 어긋난다. 참조 가치는 `ComponentNameResolver` (fiber 에서 컴포넌트 경계 이름 추출) 1건                             |
| Path 프리미티브 판별 C API (`path_is_rect` 등)      | 해당 없음 — CanvasKit 공식 표면 고정 (v1.2.1 §6-1-a)                                                                                                                                                                                                                                                                              |
| Comments (공유 링크 스레드)                         | composition 협업 축 부재 (ECOSYSTEM §5 "협업 1.5") — 제품 결정 영역, 기술 참조 없음                                                                                                                                                                                                                                               |
| Align/Flip 단축키                                   | composition 은 정렬 액션 존재 여부를 이번에 확인하지 않음 — `config/keyboardShortcuts.ts` 대조는 별도 작업                                                                                                                                                                                                                        |

---

## 10. 선행 문서 stale 지점

| 문서 · 절                                     | 구 서술                                                                   | v1.2.8 사실                                                                        | 처리                                                    |
| --------------------------------------------- | ------------------------------------------------------------------------- | ---------------------------------------------------------------------------------- | ------------------------------------------------------- |
| ECOSYSTEM §1 표 · §2 · §5 · §9 · §10          | `/Users/admin/work/pencil` = Pencil.app v1.1.57, koffi, provenance 미확정 | 같은 경로가 Pen v1.2.8. koffi 부재. 계보 확정                                      | 상단 배너 + §1·§2·§5 갱신                               |
| ECOSYSTEM §5-3 / §5-4 점수                    | Pencil/Pen AI 4.0 · 확장성 3.8 · 협업 2.0                                 | execute DSL · 스킬 번들 · 브라우저 import · Comments 로 상향 요인 발생             | **재채점 보류** (방법론 전체 재적용 필요 — 배너에 명시) |
| PEN_V1.2.1 §5 "MCP 도구 10종"                 | 10종 열거                                                                 | 6종 (§3)                                                                           | 배너 포인터                                             |
| PEN_V1.2.1 §5 "외부 CLI 7종에 MCP 자동 설치"  | 7종                                                                       | installer 는 두 버전 모두 11 타깃                                                  | 배너 포인터 (정정)                                      |
| PEN_V1.2.1 §4-3 단축키 표                     | Align/Flip 없음                                                           | +7                                                                                 | 배너 포인터                                             |
| PEN_V1.2.1 §8-9 `get_guidelines` guide corpus | 앱 내부 동적 목록                                                         | 디스크 스킬 번들 (`read_skill`) + 원격 갱신                                        | 배너 포인터                                             |
| RENDERING_OPTIMIZATION 상단 STALE 배너        | v1.2.1 실측으로 대체                                                      | v1.2.8 에서도 동일 — 추가 정정 없음                                                | 배너 한 줄 추가                                         |
| 메모리 `project-pen-v121-extraction-analysis` | 추출 원본 scratchpad 소멸                                                 | v1.2.8 전개본도 scratchpad (세션 소멸) — 원본은 `/Users/admin/work/pencil` 에 유지 | 신규 메모리 + 인덱스 갱신                               |

---

## 11. 재현 좌표

```bash
# 전개 (둘 다 scratchpad — 세션 종료 시 소멸, 원본 asar 는 각 경로에 유지)
npx -y @electron/asar extract /Users/admin/work/pencil/Resources/app.asar <scratch>/pen-1.2.8/app
npx -y @electron/asar extract docs/pencil-extracted/Resources/app.asar <scratch>/pen-1.2.1/app

# 핵심 대조
diff <(cd pen-1.2.1/app/out && find . -type f | sort) <(cd pen-1.2.8/app/out && find . -type f | sort)
ls pen-1.2.{1,8}/app/node_modules/@ha/mcp/src/schemas          # 도구 표면
diff -r pen-1.2.1/app/node_modules/@ha/agent/src pen-1.2.8/app/node_modules/@ha/agent/src
diff <(grep -oE "_pencil_[a-z0-9_]+" pen-1.2.1/app/out/editor/assets/index.js | sort -u) \
     <(grep -oE "_pencil_[a-z0-9_]+" pen-1.2.8/app/out/editor/assets/index.js | sort -u)
strings pen-1.2.8/app/out/editor/assets/pencil.wasm | grep -oE "Skia/PDF m[0-9]+"
```

minified 식별자 (`Oen` · `uUt` · `Men/Pen/Ien/Ren` 등) 는 v1.2.8 빌드 한정 좌표다 — 다음 버전에서는 문자열 (`editId` · `batch_design.js` · `setMemoryLimit`) 로 재탐색한다.
