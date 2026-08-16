# Pencil 생태계 분석 — 3개 디렉토리 정체 + composition reference 정합

**작성일**: 2026-05-27
**갱신일**: 2026-08-17 (openpencil v0.7.5 → v0.8.4 Rust 전환 재실측 + open-pencil v0.14.0 정정 — §1 / §3 / §4 / §5 / §6 / §7 / §8 / §9 / §10)
**분석 대상**: `/Users/admin/work/pencil`, `/Users/admin/work/openpencil`, `/Users/admin/work/open-pencil`
**관련 메모리**: [`pencil-component-visual-markers`](../../../.claude/memory), [`feedback-composition-enterprise-target`](../../../.claude/memory), [`feedback-no-fallback-thinking`](../../../.claude/memory)
**관련 ADR**: ADR-116 (canonical-only-runtime), ADR-122 (canonical SSOT), ADR-130 (frame), ADR-134 (AI 통합), ADR-142 (canonical document component model), ADR-153 (렌더 최적화 도입)

> **⚠️ STALE (2026-07-26) — Pencil.app 한정**: 본 문서의 Pencil.app 서술 일부가 v1.2.1 추출본 실측으로 반증됨 — ① 렌더러는 "native Skia (koffi FFI)" 가 아니라 **자체 C++ WASM (`pencil.wasm`, Skia m149 임베드)**, ② ".pen = closed format" 이 아니라 **평문 JSON (스키마 v2.14)**, ③ Helper 4-프로세스는 Electron 표준 구성 (차별점 아님), ④ 앱은 **Pen (pen.dev) 으로 리브랜딩**. 정정 상세: [PEN_V1.2.1_RENDERING_UIUX_ANALYSIS.md](PEN_V1.2.1_RENDERING_UIUX_ANALYSIS.md) §7.
>
> **♻️ 갱신 (2026-08-17) — openpencil (ZSeven-W)**: v0.7.5 기준 서술이 **v0.8.4 Rust 제품 재실측으로 전면 갱신**됨 (§3 참조). TypeScript/Electron 앱은 v0.7.5에서 retired 되었고, 현재 제품은 Rust Cargo workspace + native/Web Skia + wasm SDK다. 협업·agent orchestration·codegen·Figma/Git/VS Code/Chrome 통합도 추가되어 기존 "AI 중심, 협업 없음" 판정은 폐기한다.
>
> **♻️ 정정 (2026-08-17) — open-pencil 협업**: 기존 §4-2의 "P2P 아님" 판정은 잘못되었다. 현재 HEAD에는 직접 의존성 `trystero`, `trystero/mqtt` 기반 WebRTC room, STUN/TURN 설정이 존재한다. 실체는 **direct P2P 우선 + public relay/hub fallback + Yjs CRDT**이며, `ws`는 별도 WebSocket 표면의 의존성으로 협업 transport 전체를 설명하지 않는다.

---

## 1. 3개 디렉토리의 실제 정체

| 디렉토리                            | 형태                                                  | 정체                                                                                                                                                                                                                                                                 |
| ----------------------------------- | ----------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **`/Users/admin/work/pencil`**      | **macOS `.app` bundle (closed-source binary)**        | **Pencil.app v1.1.57** (`dev.pencil.desktop`, Electron, 60+ 언어). `Resources/app.asar` (165MB) — 소스 압축. 카피 아님 — **상업 데스크탑 앱 자체**. `.pen` 파일 + `pencil://` URL scheme. → v1.2.1 에서 **Pen** 리브랜딩                                             |
| **`/Users/admin/work/openpencil`**  | **Rust Cargo workspace + wasm SDK (open source MIT)** | **ZSeven-W/openpencil v0.8.4**. TypeScript/Electron 앱은 v0.7.5에서 retired 되었고, 현재는 `crates/*` 41개와 `packages/`의 wasm-backed SDK·VS Code·Chrome 연동이 제품 표면이다. `.op` Design-as-Code, AI agent teams, MCP, 협업, codegen, Figma/Git 통합을 포함한다. |
| **`/Users/admin/work/open-pencil`** | Bun monorepo (open source MIT)                        | **open-pencil/open-pencil v0.14.0** — 제품명 **OpenPencil** (openpencil.dev). ".fig + .pen 편집기 + 내장 AI + **프로그래머블 툴킷 (headless Vue SDK)**". 11 packages + tools/ (2026-08-15 실측)                                                                      |

**이름 충돌 주의**: `open-pencil/open-pencil` 의 제품명이 **OpenPencil** (`brew install openpencil`, app.openpencil.dev) 이라 `/Users/admin/work/openpencil` (ZSeven-W) 과 명칭이 겹친다. 인용 시 **경로 또는 GitHub org** 로 구분할 것.

**핵심 발견**: 3개는 **카피/fork 관계가 아니라 독립 프로젝트 3개**. README 에서 서로의 존재를 명시적으로 인지하며 공존. 사용자 관점 ("원본 + 카피 프로젝트들") 정정 필요.

---

## 2. 원본 Pencil.app v1.1.57 기술 스택

`Resources/app.asar` 는 binary 라 직접 read 불가. `Info.plist` + `Frameworks/` + `app.asar.unpacked/node_modules/` 메타데이터로 추정:

```
Frameworks/
├── Electron Framework.framework               ← Electron 베이스
├── Pencil Helper (GPU).app                    ← GPU 프로세스 분리
├── Pencil Helper (Plugin).app                 ← 플러그인 프로세스 분리
├── Pencil Helper (Renderer).app               ← 렌더 프로세스 분리
└── Pencil Helper.app                          ← 메인 helper

Resources/app.asar (165MB)                     ← JS 소스 압축본 (closed-source)
Resources/app.asar.unpacked/node_modules/
├── @openai/codex + codex-sdk + codex-darwin-arm64    ← OpenAI Codex SDK
├── @anthropic-ai/claude-agent-sdk + darwin-arm64     ← Anthropic Claude Agent SDK
├── @mariozechner/clipboard-darwin-universal          ← native clipboard
└── koffi                                              ← C FFI (native CanvasKit/Skia 호출)
```

**Pencil.app 의 차별점**:

1. **AI 에이전트 데스크탑 임베드** — OpenAI Codex SDK + Anthropic Claude Agent SDK **동시** 통합
2. **native Skia (WASM 우회)** — koffi 로 C FFI 직접 호출 → **반증됨** (상단 STALE 배너 참조)
3. **프로세스 분리** — GPU/Plugin/Renderer 헬퍼 4개로 엔터프라이즈급 격리 → **Electron 표준 구성** (차별점 아님)
4. **60+ 언어 i18n** — 글로벌 상업 제품 수준

composition 메모리 [`pencil-component-visual-markers`](../../../.claude/memory) 의 magenta/violet 마커, `Cmd+Opt+K` 토글, Properties `##Component section##` `##Slot section##` 구조는 **이 closed-source 원본의 UX 를 reference 로 차용** 중인 것 (코드는 black box, UX 관측 결과만 메모리 보존).

---

## 3. openpencil (ZSeven-W) 상세

> **2026-08-17 v0.8.4 현재 스냅샷 재실측.** 이 절의 `openpencil`은 하이픈 없는 `/Users/admin/work/openpencil` (GitHub `ZSeven-W/openpencil`)을 뜻한다. 하이픈 있는 `/Users/admin/work/open-pencil`과는 별도 프로젝트다. 해당 디렉터리는 `.git` 메타데이터가 없어 commit-range diff 대신 현재 트리·README·`RELEASE_NOTES/v0.8.0..v0.8.4.md`를 기준으로 판정했다.

| 항목       | 값                                                                                                                                                           |
| ---------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Git remote | `github.com/ZSeven-W/openpencil`                                                                                                                             |
| 버전       | **v0.8.4** (`Cargo.toml` workspace version)                                                                                                                  |
| 구조       | **Rust Cargo workspace `crates/*` 41개** + `packages/` Bun workspace (`op-vscode`, `op-web-sdk`, React/Vue adapters); `op-chrome-extension` 별도 패키징 표면 |
| 전환       | TypeScript + Electron 앱과 `apps/*`/`pen-*` 패키지는 **v0.7.5에서 retired**. 현재 제품은 Rust native/web/CLI + wasm SDK                                      |
| 미션       | "AI-native vector design tool, Design-as-Code, prompt→canvas"에서 협업·agent teams·codegen·Figma/Git/IDE 통합을 포함하는 제품으로 확장                       |
| 라이선스   | MIT                                                                                                                                                          |

**핵심 기술 스택**:

- **렌더링**: native `skia-safe`/winit GPU 경로 + browser CanvasKit WASM/WebGL2. Paper.js는 현재 제품 runtime의 Boolean 구현이 아니며, native는 Skia `PathOp`, web은 shape-limited rectangle contour 경로를 사용한다.
- **데이터 모델**: `.op` JSON + canonical `PenDocument` (pages, children, variables, themes). 현재 SDK binding 기준 21 node variants로 확장되었고 form/widget, screen variant, event/binding/lifecycle/semantics/gesture/route 메타데이터를 포함한다.
- **컴포넌트 시스템**:
  - `FrameNode.reusable?: boolean` (boolean flag)
  - `FrameNode.slot?: string[]` (slot names array)
  - `RefNode` (instance): `ref: string`, `descendants?: Record<string, Partial<PenNode>>`
  - Rust `ComponentLibrary`, instance override/detach, `.pen` 기반 UIKit import/export
- **AI 통합**: `op-ai` + `op-ai-skills` + `op-orchestrator` + `op-acp` + `op-mcp`. Concurrent Agent Teams, layered workflow, multi-model/provider profile, 50+ style guide, 외부 CLI/ACP 연동을 포함한다.
- **협업**: 인증된 P2P 세션, public relay fallback, regional hub, pairing code, remote cursor, cross-account session, conflict panel/replay, online multi-tenant web mode.
- **코드·제품 통합**: Figma `.fig` import, Git clone/branch/merge/conflict UI, VS Code custom editor, Chrome web-capture extension, deck/template/asset center.
- **출력·SDK**: React/Vue/Svelte/HTML/Flutter/SwiftUI/Compose/React Native codegen, PDF/PPTX/HTML/video deck export, read-only `.op` wasm viewer SDK.

**핵심 파일/경계**: `crates/op-editor-core` (canonical `PenDocument` editor state), `crates/op-host-native` / `crates/op-host-web` (native/web host), `crates/op-ai*`·`op-orchestrator`·`op-mcp` (AI), `crates/op-collab*` (협업), `crates/op-codegen` (codegen), `packages/op-web-sdk*` (wasm viewer SDK).

**composition 과의 schema 비교 (1:1 거의 정합)**:
| openpencil | composition (canonical) |
|---|---|
| `.op` `PenDocument`의 pages/children/variables/themes SSOT | `CompositionDocument` canonical SSOT (ADR-116/122) |
| `FrameNode.reusable: boolean` | `FrameNode.reusable: boolean` (ADR-130) |
| `FrameNode.slot: string[]` | slot mirror metadata (ADR-122 boundary allowlist) |
| `RefNode.ref` + `descendants` override | `RefNode.ref` + `descendants[path]` (ADR-116/122) |
| node-level `events`/`bindings`/lifecycle/route | ADR-131 root events/actions collection과는 별도 축; 직접 1:1 정합으로 확대 해석하지 않음 |

---

## 4. open-pencil (OpenPencil) 상세 — 2026-08-15 갱신

| 항목       | 값                                                                                                                         |
| ---------- | -------------------------------------------------------------------------------------------------------------------------- |
| Git remote | `github.com/open-pencil/open-pencil`                                                                                       |
| 버전       | **v0.14.0** (2026-08-10) + Unreleased (HEAD `2710f906`, 2026-08-14) — 기준선은 v0.12.2 (2026-05-19)                        |
| Monorepo   | Bun workspaces — **명시 11개** (`scene-graph`/`pen`/`kiwi`/`fig`/`core`/`dom-css`/`vue`/`cli`/`mcp`/`docs` + `tools/docs`) |
| 미션       | ".fig / .pen 편집기 + 내장 AI + **프로그래머블 툴킷** (headless Vue SDK)"                                                  |
| 라이선스   | MIT                                                                                                                        |

### 4-1. 기준선(v0.12.2) 대비 변경 규모

| 축         | v0.12.2 (2026-05-19)                                    | HEAD (2026-08-14)                   |
| ---------- | ------------------------------------------------------- | ----------------------------------- |
| 커밋       | —                                                       | **711 commits**                     |
| diff       | —                                                       | 2,106 files, **+126,786 / −34,917** |
| workspaces | `packages/*` glob (실질 6: core/vue/mcp/docs/cli/demos) | **11개 명시 + tools/**              |
| 의존성 수  | 87                                                      | 111                                 |

변경량 상위: `tests/engine` +29.6k (303 files) · `packages/core` +15.7k · `packages/vue` +14.1k · `src/components` +11.4k · `packages/fig` +6.7k(신설) · `packages/kiwi` +6.4k(신설) · `packages/dom-css` +4.2k(신설) · `packages/scene-graph` +1.3k(신설).

### 4-2. 정정 — "P2P 아님" 판정은 잘못됨

기존 갱신에서 `ws`와 `yjs` 의존성만 보고 "서버 릴레이 CRDT"로 정정한 것은 오류다. 현재 HEAD의 실제 협업 경로는 다음과 같다.

- 직접 의존성: `trystero` + `yjs` + `y-protocols` + `y-indexeddb`; `ws`는 MCP/기타 WebSocket 표면에도 사용된다.
- `src/app/collab/room.ts`가 `trystero/mqtt`의 `joinRoom()`을 호출하고 STUN/TURN ICE 서버를 설정한다.
- Yjs document update와 awareness는 Trystero room action으로 peer 간 전송된다.
- 현재 제품 설명과 v0.8.3 release notes는 **direct P2P 우선 → public relay fallback → regional hub** 구조, pairing code, cursor/presence, conflict replay를 명시한다.
- 이 구조는 v0.12.2 시점의 `room.ts`에도 이미 존재하므로, "처음부터 P2P 근거가 없었다"는 기존 문장도 삭제해야 한다.

→ open-pencil 협업의 정확한 요약은 **Trystero WebRTC direct P2P + public relay/hub fallback + Yjs CRDT + IndexedDB local persistence**다. composition scope 밖이라는 결론은 유지하되, "P2P 아님" 또는 "WebSocket 서버 릴레이만"으로 인용하지 말 것.

### 4-3. 신설 패키지 — SDK 경계 재편 (0.14.0 Breaking changes)

`@open-pencil/core` 단일 배럴에서 도메인별 패키지로 분리됨:

| 패키지                     | 내용                                                                                             |
| -------------------------- | ------------------------------------------------------------------------------------------------ |
| `@open-pencil/scene-graph` | scene graph 타입 + geometry / coordinate / matrix / **snap** / undo / hit-test / path (4.7k LOC) |
| `@open-pencil/pen`         | `.pen` 파싱                                                                                      |
| `@open-pencil/kiwi`        | Kiwi 동기 압축 해제 (구 `core/kiwi/instance-overrides`)                                          |
| `@open-pencil/fig`         | `.fig` 컨테이너 (zstd 해제 포함)                                                                 |
| `@open-pencil/dom-css`     | **HTML / CSS / Tailwind / JSX ↔ scene graph 변환** (신규 축, §4-5)                               |

식별자 규약도 변경 — 약어 대문자 (`JSONObject` / `RPCCommand` / `importSVG` / `exportSVG` / `exportPDF` / `getJSX`), Vue SDK API 교체 (`FillPickerRoot`→`FillRoot`, `useFillPicker()`→`useFill()`, `useColorModel()` 신설). `packages/core` 는 canvas / layout / text / io / figma-api / lint / profiler / vector 를 유지 (47k LOC).

### 4-4. 신규 기능 축 (기준선에 없던 것)

- **design-to-code 양방향**: HTML/CSS/Tailwind/JSX **import** (앱·CLI·SDK) + 컴파일된 CSS 를 포함한 standalone HTML **export**. Code 패널 JSX 생성.
- **`.pptx` export** (선택/페이지/문서 — 텍스트·사각형·타원·선은 편집 가능, 복잡 레이어는 이미지 임베드).
- **SVG import** 확장 (드롭 파일, clip path + `<use>` 참조, JSX children 도형, 다색 fill).
- **이미지 → 편집 가능 벡터** 변환 (Recraft / fal.ai).
- **AI 재편**: 역할별 모델 4종 (**Design / Review / Fast / Vision**) 개별 provider·엔드포인트·자격증명, provider 별 reasoning effort, **격리 vision inspection** (선택 영역 렌더만 전송, 이미지 미보존), 채팅 이미지 첨부, **ACP 에이전트** (Claude Code / Codex / Gemini CLI), MCP unix socket 자동 발견 + localhost TCP 폴백. 기준선의 "OpenRouter + MCP stdio" 는 부분집합.
- **스토리지**: S3 호환 워크스페이스 (local-first 저장 + 백그라운드 동기화 + `.fig` 임베드 프리뷰), 크래시 복구 (미저장·경로 없는 문서 포함).
- **에디터**: Assets 패널 컴포넌트 썸네일/그룹/드래그 인스턴스, 페이지 관리(리네임·삭제·재정렬), 프레임 프리셋, **layout grid 편집**, Design 패널 확장 (constraints / stroke cap·join / corner smoothing / shared styles / component properties / blend mode / mask / typography / per-node export settings), Figma 식 숫자키 불투명도.
- **폰트**: 언어 인지 CJK·아랍 폴백, 문자별 원격 서브셋, 미가용·대체 폰트를 영향 레이어 선택과 함께 노출 (Figma API·MCP 로도).

### 4-5. `dom-css` 는 CSS 레이아웃 엔진이 **아니다** (composition 판정에 직결)

| 파일                  | LOC | 내용                                                                                        |
| --------------------- | --- | ------------------------------------------------------------------------------------------- |
| `to-scene-graph.ts`   | 498 | CSS 선언 → Figma 계열 노드 속성 매핑                                                        |
| `html-export.ts`      | 368 | scene graph → standalone HTML                                                               |
| `from-scene-graph.ts` | 310 | 역방향 변환                                                                                 |
| `headless-css.ts`     | 306 | cssom 파싱 + 특이도 캐스케이드 + **상속 5속성** (color/font-family/size/weight/line-height) |

매핑 실체: `display:flex|inline-flex` → `layoutMode: HORIZONTAL|VERTICAL`, `flex-wrap` → `layoutWrap`, `position:absolute|fixed` → `layoutPositioning:'ABSOLUTE'`, `flex-end` → `MAX`. 의존성은 `@acemir/cssom` + `parse5` + `tailwindcss v4` + `twirlwind`.

→ **CSS 규격 구현이 아니라 import/export 어댑터**다. composition 의 Rust 레이아웃 엔진(ADR-916, CSS-SIZING/FLEXBOX/GRID 준수 + Chrome 실측 fixture)과 **경쟁 축이 아니며**, 메모리 [`feedback-pen-model-identical-exclusion-logic-invalid`](../../../.claude/memory) 의 "레이아웃 표면적 2개 / oracle 이중화" 판정이 그대로 유지된다.

### 4-6. 성능·검증 인프라 (composition 관심 영역)

**성능** (0.14.0 + Unreleased):

- Layers 패널 **가상화** — 수천 노드 문서에서 증분 갱신 / 안정 확장 상태 / 범위 선택 / scroll-to-selection
- 캐시된 scene backing **재사용** (줌·팬·드래그·편집 중 안전 구간)
- 대용량 `.fig` 열기·저장 가속 + **미열람 페이지 지연 처리**
- **비활성 Code 패널의 JSX 생성·구문 강조 지연** — 대용량 선택 반응성 유지 (#500)
- 붙여넣기 시 Figma 클립보드 자식 **1회 인덱싱** (노드마다 재스캔 제거 → 선형)
- `.fig` export 시 불변 바이너리 자원 공유 → 피크 메모리 감소
- `.fig` export 를 **바이너리 Tauri IPC** 로 전송 (JSON byte array 대체 — 대용량 저장 잘림·WebView 메모리 고갈 방지)

**검증 인프라 신설**:

- `tests/engine/` 30개 도메인 — `layout/{auto-layout,absolute-position,grid-layout}`, `snap`, `hit-test`, `text`, `render`, `dom-css`, `figma`, `kiwi`, `vector`, `perf.bench.ts` 등 (+29.6k LOC / 303 files)
- `tools/visual-oracles/` — `compare` / **`bisect`** / `export-fixtures` / `analyze-pattern` / `update-report` / `pixel-image`
- 품질 게이트: `steiger`(아키텍처) / `knip`(미사용) / `sherif`(monorepo) / `publint`+`attw`(패키지) / secret-scan / i18n 검사

### 4-7. 변하지 않은 것

`canvaskit-wasm ^0.40.0` (렌더러 동일, WebGL2 backed) · Tauri 2 + Vue 3 SPA · Canvas 2D 폴백 없음 · MIT · Kiwi instance override (패키지로 추출만 됨) · COMPONENT/INSTANCE + variant (Figma 호환).

---

## 5. 5축 비교 매트릭스

> `/Users/admin/work/openpencil` 열은 2026-08-17 v0.8.4 현재 스냅샷, `/Users/admin/work/open-pencil` 열은 2026-08-15 v0.14.0 + HEAD 기준. Pencil.app은 상단 STALE 배너 참조.

| 축                | Pencil.app (원본)                                     | openpencil (ZSeven-W)                                                                                                      | open-pencil / OpenPencil (org)                                                              | composition (현재)                                                            |
| ----------------- | ----------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------- |
| **렌더링**        | native Skia (koffi FFI) → **자체 C++ WASM 으로 반증** | native `skia-safe`/winit GPU + browser CanvasKit WASM/WebGL2; native Boolean은 Skia `PathOp`, web은 별도 rectangle contour | CanvasKit WASM (WebGL2) — **변동 없음**                                                     | CanvasKit WASM (ADR-100 단일 엔진)                                            |
| **데이터 모델**   | `.pen` (closed format) → **평문 JSON 으로 반증**      | `.op` JSON `PenDocument` + 21 node variants + pages/themes/variables + interaction metadata                                | Figma 호환 (.fig + .pen) + Kiwi instance override + **HTML/CSS/Tailwind/JSX 입출력**        | `CompositionDocument` (ADR-116/122) + RefNode + frame                         |
| **컴포넌트**      | (UX: magenta/violet 마커)                             | reusable bool + slot + RefNode/descendants + ComponentLibrary + UIKit                                                      | COMPONENT + INSTANCE + variant + **Assets 패널 인스턴스 삽입**                              | ADR-142 — reusable frame as composite component (단일 SSOT)                   |
| **AI 통합**       | **Codex SDK + Claude Agent SDK** 데스크탑 임베드      | Rust agent runtime + `op-ai-skills` + concurrent orchestrator + ACP/MCP + multi-provider                                   | **역할별 모델 4종 (Design/Review/Fast/Vision) + ACP 에이전트 3종 + MCP**                    | Groq SDK (`llama-3.3-70b`) + Tool Calling (ADR-134 plan only)                 |
| **협업**          | (closed, 미확인)                                      | **인증된 P2P + public relay + regional hub**, pairing code, cursors, conflict replay                                       | **Trystero WebRTC direct P2P + relay/hub fallback + Yjs CRDT** (WebSocket 전용 아님 — §4-2) | 없음 (Supabase Auth 만)                                                       |
| **fallback 정책** | (native binary 자체가 fallback)                       | Paper.js runtime fallback 없음; native Skia PathOp와 web shape-specific Boolean 경로를 별도 검증                           | **Canvas 2D 폴백 없음** — 변동 없음                                                         | fallback 없음 (메모리 [`feedback-no-fallback-thinking`](.claude/memory) 정합) |

---

## 6. composition reference 정합 평가

| composition 영역                                           | Reference 출처                                                              | 정합 평가                                                                                                                                        |
| ---------------------------------------------------------- | --------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------ |
| Component visual marker (magenta/violet, Cmd+Opt+K 토글)   | **Pencil.app (closed-source 원본)**                                         | UX 마커 차용 — closed-source 라 코드는 못 봄, 메모리에 관측 결과만 보존                                                                          |
| `CompositionDocument` canonical schema (ADR-116/122)       | **openpencil current `.op`/`PenDocument` + node types**                     | 가장 가까운 정합 — pages/children/variables/themes + RefNode + reusable/slot 패턴 유지. 단 현재는 21 node variants와 interaction metadata로 확장 |
| ADR-130 frame (D1 RAC `Group` ↔ D3 canonical `frame` 분리) | **openpencil `FrameNode.reusable` + component registry**                    | reusable bool 패턴은 유지되고, UIKit/component library와 instance override가 제품 경계로 확장                                                    |
| ADR-131 events/actions root collection                     | openpencil node-level `events`/`bindings`/lifecycle/route                   | composition의 root collection과 동일하다고 볼 수는 없지만, "reference에 events가 없다"는 기존 판정은 수정 필요                                   |
| ADR-134 AI Assistant 통합 (plan only)                      | **openpencil Rust agent runtime + orchestrator + ACP/MCP + multi-provider** | 기존 `MCP first` 요약보다 진보. composition은 여전히 ADR-134 plan-only라 통합 격차가 큼                                                          |
| ADR-100 단일 Skia 엔진                                     | openpencil native `skia-safe` + browser CanvasKit/WebGL2                    | 동일한 Rust editor core를 native/web에 공유하는 경계가 추가 reference가 됨                                                                       |
| ADR-142 canonical document component model                 | **openpencil `.op` PenDocument + reusable/Ref/descendants + UIKit**         | 단일 SSOT 방향은 검증되지만, component registry가 별도 runtime metadata로 존재하는 점은 구분 필요                                                |
| ADR-153 렌더 최적화 (측정 우선 + Picture 캐시)             | **open-pencil `retained-backing.ts` + `profiler/`**                         | Phase 1 반영 완료. reference 는 v0.14.0 에서 더 확장 (§4-6, 렌더 문서 갱신 배너 참조)                                                            |
| ADR-916 Rust 레이아웃 엔진 (CSS 규격)                      | (3개 모두 부재 — Figma 계열 auto-layout)                                    | composition 독자 — open-pencil `dom-css` 는 어댑터이지 CSS 엔진 아님 (§4-5)                                                                      |

---

## 7. composition product target 정합

composition 의 product target = **엔터프라이즈급 빌더** (메모리 [`feedback-composition-enterprise-target`](../../../.claude/memory)). 3 reference 와 비교:

- **Pencil.app**: 상업 데스크탑 — Helper apps 4개 (GPU/Plugin/Renderer/main). composition 은 web browser 라 Helper process 불가능 → Worker thread 로 대안 필요 (ADR 미작성)
- **openpencil**: 현재는 AI-native + MCP만이 아니라 **Rust shared core + native/Web Skia + CLI/SDK + collaboration + codegen** 제품이다. `LayoutScene`/`RenderBackend` 공유, 10k-node 측정, CanvasKit cache, agent-team orchestration, authenticated collaboration은 composition의 enterprise builder 판단에 직접 비교할 reference다.
- **open-pencil**: 2026-08-15 기준 축이 "Figma 호환 + 협업" 에서 **"프로그래머블 툴킷"** 으로 이동 — headless Vue SDK / CLI / MCP / 90+ AI tool / design-to-code 양방향. composition 이 엔터프라이즈 빌더를 지향한다면 **SDK 경계 분리 (§4-3) 와 검증 인프라 도구화 (§4-6) 가 협업 기능보다 참조 가치가 크다**. 협업은 여전히 scope 밖

**fallback 회피 원칙** ([`feedback-no-fallback-thinking`](../../../.claude/memory)) 적용:

- Pencil.app native binary fallback → 차용 불가 (web 환경)
- openpencil의 **Paper.js runtime fallback** → 현재 제품에서는 확인되지 않음. Native는 Skia `PathOp`를 사용하므로, 기존의 "Paper.js fallback 회피" 판정은 삭제한다. 다만 web Boolean의 shape-specific contour 경로는 native와 별도 parity 검증 대상이다.
- **open-pencil Canvas 2D 폴백 없음** → composition 정합 방향과 일치 (v0.14.0에서도 유지)

---

## 8. 차용 후보 / 차용 불가

### 차용 후보 (composition 강화 영역)

1. **openpencil `RefNode` + `descendants` override 패턴** — composition ADR-122 의 canonical RefNode 와 거의 동일 구조. cross-reference 로 schema 검증 가능
2. **openpencil `FrameNode.reusable:bool` + `slot:string[]`** — composition ADR-130 frame + ADR-142 reusable composite 의 reference. 단일 bool 플래그가 명료
3. **openpencil canonical `.op` + shared Rust editor/render boundary** — document SSOT와 native/Web host 분리를 함께 유지한다. composition의 canonical-only runtime 및 CSS/Skia consumer 경계 비교에 유효
4. **openpencil agent-team orchestration + layered workflow** — spatial decomposition, phase별 prompt, bounded repair, per-agent canvas indicator가 composition ADR-134의 단일 assistant plan을 확장할 때 reference가 됨
5. **openpencil read-only wasm SDK boundary** — editor mutation과 외부 viewer surface를 분리한 public API 경계. composition publish/preview 분리와 비교 가능
6. **Pencil.app helper process 분리 (GPU/Plugin/Renderer)** — composition 의 Worker thread 분리 영역 후보 (ADR 미작성, 향후 작성·제안 영역)
7. **Pencil.app AI agent dual embed (Codex + Claude SDK)** — composition ADR-134 plan-only 상태 → reference 가 더 진보

**2026-08-15 추가 (open-pencil v0.14.0 실측):**

8. **Layers 패널 가상화** — 수천 노드 문서의 증분 갱신 + 안정 확장 + scroll-to-selection. composition 5k 요소 프레임 드랍 지도 (메모리 [`project-frame-drop-map-5k-baseline`](../../../.claude/memory)) 의 노드 트리 축과 직결
9. **비활성 패널 지연 생성** — Code 패널 JSX 생성·강조를 활성 시점까지 미룸. composition 의 선택 클릭 fan-out 대책 (메모리 [`project-selection-click-fanout-next-lever`](../../../.claude/memory), ADR-155 Activity gating) 과 동형 처방
10. **클립보드 자식 1회 인덱싱** — 붙여넣기에서 노드마다 재스캔 제거. composition 붙여넣기·복제 경로에 동일 형태 존재 여부 점검 가치
11. **시각 오라클 도구화** (`compare` / **`bisect`** / `update-report`) — composition 은 Chrome parity fixture 는 갖췄으나 (`*.browser.test.ts`) **회귀 구간 이분 탐색·리포트 도구가 없다**. 발산 키가 100+ 로 나오는 격자 (ADR-170) 에서 도구화 이득이 큼

### 차용 불가 / 보류

1. **Pencil.app native koffi Skia** — web browser 환경 불가능 (composition은 WASM 필수). 단 전제 자체가 반증됨 (상단 STALE 배너)
2. **openpencil authenticated collaboration** — 현재 composition scope 밖. 다만 "협업 없음"이 아니라 P2P/relay/hub·auth·conflict model을 참고할 수 있는 보류 reference다.
3. **openpencil web Boolean 경로의 shape-specific contour 처리** — native Skia PathOp와 동일한 general path engine으로 간주하지 말고, composition vector boolean ops 도입 시 parity/지원범위를 별도 검증한다.
4. **open-pencil 실시간 협업** — composition scope 밖. 인용 시 **Trystero WebRTC direct P2P + public relay/hub fallback + Yjs CRDT**로 설명한다 (§4-2).
5. **open-pencil Kiwi instance override (Figma 호환)** — composition canonical과 schema 충돌. 별도 import/export 어댑터 영역
6. **open-pencil `dom-css` 의 CSS→노드 매핑** — Figma auto-layout 어휘로의 축약 매핑이라 composition의 CSS 규격 엔진에 역행 (§4-5). 참조 가치가 있는 방향은 **역방향** (`from-scene-graph` / `html-export`의 export 어법)

---

## 9. 종합 결론

3 reference 가 composition 에 주는 본질적 시사:

1. **`/pencil` 은 카피 아닌 closed-source 원본** — UX/마커는 reference 가능, 코드는 black box. composition 메모리가 이미 정확히 인지 중 (v1.2.1 추출로 내부는 후속 규명 — PEN 분석 문서)
2. **openpencil이 composition canonical schema의 가장 가까운 reference** — RefNode/reusable/slot 패턴이 유지되고 `.op` SSOT와 Rust editor state가 명시적으로 분리된다. ADR-116/122/130/142의 진화 방향 검증에 활용 가능
3. **두 open\* 프로젝트 모두 협업을 제품 표면으로 끌어올렸다** — openpencil은 authenticated P2P/relay/hub, open-pencil은 Trystero P2P/relay/hub + Yjs다. composition은 여전히 Supabase Auth만 있으므로 협업은 제품 scope 차이로 분류한다.
4. **AI 통합에서 composition이 여전히 뒤처짐** — Pencil.app의 Codex+Claude SDK 동시 임베드, openpencil의 Rust agent runtime/orchestrator/ACP/MCP, open-pencil의 역할별 모델·ACP·MCP에 비해 composition은 Groq 단일 + ADR-134 plan-only다. 단 openpencil을 단순 "MCP first"로 축소하던 기존 서술은 폐기한다.
5. **렌더링 공통점은 CanvasKit/Skia지만 host architecture는 달라졌다** — openpencil은 native `skia-safe`와 browser CanvasKit을 Rust core로 공유하고, open-pencil은 CanvasKit WebGL2, composition은 CanvasKit WASM 단일 엔진이다. "3개 모두 CanvasKit"만으로 동일한 runtime contract를 가정하지 않는다.
6. **`RefNode`/`reusable`/`slot`은 여전히 공통 schema 축** — 다만 openpencil의 현재 node surface와 interaction metadata는 훨씬 넓어졌으므로, 11-node 1:1 비교는 폐기한다.
7. **CSS 규격 레이아웃은 여전히 composition 독자 자산** — openpencil의 HTML/CSS import와 open-pencil의 `dom-css`는 adapter/codegen 성격이며, composition의 Rust CSS-SIZING/FLEXBOX/GRID engine + Chrome oracle과 동일한 CSS engine은 아니다.

---

## 10. 후속 조사 후보 (사용자 결정 영역)

- **openpencil native/Web Boolean parity** — native Skia `PathOp`와 web shape-specific contour 경로의 지원범위·fixture 차이를 비교해 composition vector boolean 정책을 결정
- **openpencil `op-collab*` trust/relay/session 경계** — composition 협업을 실제 제안할 때 auth, pairing, conflict replay, relay fallback의 최소 계약을 비교
- **openpencil read-only wasm SDK ↔ composition preview/publish 경계** — editor mutation API와 외부 viewer API의 분리 수준을 비교
- **open-pencil `tools/visual-oracles` 도구 구조 분석** — composition parity fixture의 bisect/report 도구화 판단 근거 (§8-11). 2026-08-15 신규
- **open-pencil SDK 패키지 경계 (scene-graph/pen/kiwi/fig/dom-css) ↔ composition packages 경계 대조** — composition은 `specs`/`shared`/`composition-engine` 3분할. 툴킷 지향 시 참조 (§4-3). 2026-08-15 신규
- **ADR-134 (AI 통합) priority 재검토** — reference 2종이 더 진보. plan → P1 승격 가치 평가 (§9-4)
- **Worker thread / GPU 분리 영역 ADR 미작성** — Pencil.app helper process 패턴이 단서. composition Skia 렌더 worker 격리 영역 별도 작성·제안 가능
- **openpencil (ZSeven-W) v0.8.4 이후 재실측** — 현재 스냅샷은 2026-08-17 기준이며, 다음 release에서 Rust crate/SDK/collab 계약 drift를 재검증

---

## 출처 / 메서드

**2026-05-27 1차** — 3개 Explore agent 병렬 dispatch + 직접 binary 메타데이터 검증:

- `/Users/admin/work/pencil` — `Info.plist` + `Frameworks/` + `app.asar.unpacked/node_modules/` 직접 read (binary 본체는 read 불가)
- `/Users/admin/work/openpencil` — Explore agent `a58f0402199f70c43` (33 tool uses, 80s)
- `/Users/admin/work/open-pencil` — Explore agent `a4b73b5b8ee18c82a` (39 tool uses, 171s)

> **주의**: 첫 번째 dispatch agent (`a21fef29dddfc4df7`) 가 cwd 에 묶여 `/Users/admin/work/composition` 을 분석하는 오류 발생 — 결과 폐기 후 직접 binary 메타데이터 read 로 대체. 본 보고서의 Pencil.app 항목은 binary 메타데이터 기반 추정.

**2026-08-15 2차 (open-pencil 한정)** — 로컬 저장소 직접 실측:

- `git diff --stat v0.12.2..HEAD` + `git rev-list --count` (변경 규모), `CHANGELOG.md` 0.13.0~0.14.0+Unreleased 전문
- `package.json` workspaces·의존성을 v0.12.2 와 `git show` 로 대조 (협업 스택 정정 근거)
- `packages/dom-css/src/*` 직접 read (헤드리스 CSS 범위 확정), `packages/scene-graph/src/*` 파일 목록, `tests/engine/` · `tools/visual-oracles/` 구조
- Pencil.app / openpencil 은 **재실측하지 않음** — 당시 해당 절은 1차 기준 그대로였으나, 아래 2026-08-17 3차에서 openpencil을 갱신함

**2026-08-17 3차 (openpencil 한정)** — `/Users/admin/work/openpencil` 현재 스냅샷 직접 read:

- `AGENTS.md`, `Cargo.toml`, `packages/package.json`으로 TypeScript/Electron retirement, Rust workspace, v0.8.4, SDK workspace 경계를 확인
- `README.md`의 기능·기술 스택·project structure·Rust migration·10k-node 측정값을 확인
- `RELEASE_NOTES/v0.8.0.md`~`v0.8.4.md`에서 Rust 전환, AI/MCP/ACP, HTML/Figma import, codegen, collaboration, deck/template/extension, relay fix 범위를 확인
- `crates/op-editor-core`, `op-host-native`, `op-host-web`, `op-ai*`, `op-orchestrator`, `op-mcp`, `op-collab*`, `op-codegen`, `packages/op-web-sdk*` 파일 구조와 구현 경계를 대조
- 현재 디렉터리에는 `.git` 메타데이터가 없어 commit count/diff는 산출하지 않음. 따라서 v0.7.5 대비 변경의 시간축은 release notes와 현재 source evidence로만 판정

**2026-08-17 정정 검증 (open-pencil 협업)** — 별도 `/Users/admin/work/open-pencil`의 현재 HEAD도 교차 확인:

- root `package.json`의 직접 `trystero` dependency, `src/app/collab/room.ts`의 `trystero/mqtt` + STUN/TURN, `CHANGELOG.md`의 P2P/relay 서술을 확인
- 기존 §4-2의 "WebSocket 서버 릴레이만" 결론을 삭제하고 direct P2P + relay/hub fallback으로 정정
