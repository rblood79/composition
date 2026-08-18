# Pencil 생태계 분석 — 3개 디렉토리 정체 + composition reference 정합

**작성일**: 2026-05-27
**갱신일**: 2026-08-17 (세 제품 최신 artifact/release + Figma/Framer 공식 기능 교차 검증, AI·제품화 수준·총점 추가 — §1~§10)
**분석 대상**: `/Users/admin/work/pencil`, `/Users/admin/work/openpencil`, `/Users/admin/work/open-pencil` + 비교 제품군 Figma, Framer
**관련 메모리**: [`pencil-component-visual-markers`](../../../.claude/memory), [`feedback-composition-enterprise-target`](../../../.claude/memory), [`feedback-no-fallback-thinking`](../../../.claude/memory)
**관련 ADR**: ADR-116 (canonical-only-runtime), ADR-122 (canonical SSOT), ADR-130 (frame), ADR-134 (AI 통합), ADR-142 (canonical document component model), ADR-153 (렌더 최적화 도입)

> **⚠️ 버전 분리 (2026-08-17) — Pencil.app / Pen artifact**: `/Users/admin/work/pencil`의 실제 `Info.plist`는 **Pencil.app v1.1.57** (`dev.pencil.desktop`)다. 별도 문서의 v1.2.1 추출본(`docs/pencil-extracted/`)은 **Pen v1.2.1** artifact이므로 현재 `/Users/admin/work/pencil`의 버전·렌더러를 덮어쓰지 않는다. 아래 §2와 §5는 v1.1.57 로컬 번들과 v1.2.1 별도 분석을 분리한다.
>
> **♻️ 갱신 (2026-08-17) — openpencil (ZSeven-W)**: v0.7.5 기준 서술을 **v0.8.4 Rust 제품**으로 전면 교체했다 (§3 참조). Upstream v0.8.4는 2026-08-11 pre-release이며 release 페이지에 tag 이후 1 commit이 표시된다. local checkout은 2026-08-17 재확인 시점에 `.git` 메타데이터를 보유한다 — `HEAD 9c810776` = `v0.8.4-1` (tag 이후 1 commit인 release manifest 갱신 커밋)로, release 페이지 표시와 정확히 일치해 exact commit이 확정됐다 (구 ".git 없음" 서술은 ADR-921 리뷰 round 1에서 stale 판정·정정).
>
> **♻️ 정정 (2026-08-17) — open-pencil 협업**: 기존 §4-2의 "P2P 아님" 판정은 잘못되었다. 현재 HEAD에는 직접 의존성 `trystero`, `trystero/mqtt` 기반 WebRTC room, STUN/TURN 설정이 존재한다. 실체는 **direct P2P 우선 + public relay/hub fallback + Yjs CRDT**이며, `ws`는 별도 WebSocket 표면의 의존성으로 협업 transport 전체를 설명하지 않는다.
>
> **♻️ 추가 (2026-08-17) — 제품화 수준 비교**: Figma와 Framer를 기능 reference가 아니라 **사용자 workflow 완결성·운영·보안·배포·확장성까지 포함한 제품화 benchmark**로 추가했다. 기능 존재 여부와 제품화 성숙도는 별도 점수로 계산하고, 제품화 반영 총점은 기능 70% + 제품화 30%로 산출한다.

---

## 1. 3개 디렉토리의 실제 정체

| 디렉토리                            | 형태                                                  | 정체                                                                                                                                                                                                                                                                                                                                                                                                                |
| ----------------------------------- | ----------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **`/Users/admin/work/pencil`**      | **macOS `.app` bundle (closed-source binary)**        | 로컬 bundle은 **Pencil.app v1.1.57** (`dev.pencil.desktop`, Electron, 60+ 언어). `Info.plist`와 unpacked native modules의 mtime은 2026-05-18이며, `Resources/app.asar` + `.pen` + `pencil://`를 포함한다. 별도 v1.2.1 Pen 추출 분석과 동일 artifact로 보지 않는다.                                                                                                                                                  |
| **`/Users/admin/work/openpencil`**  | **Rust Cargo workspace + wasm SDK (open source MIT)** | `Cargo.toml` 기준 **ZSeven-W/openpencil v0.8.4**. TypeScript/Electron 앱은 v0.7.5에서 retired 되었고, 현재는 `crates/*` 41개와 `packages/`의 wasm-backed SDK·VS Code·Chrome 연동이 제품 표면이다. `.op` Design-as-Code, AI agent teams, MCP, 협업, codegen, Figma/Git 통합을 포함한다. local checkout `HEAD 9c810776` (`v0.8.4` tag + 1 commit — release manifest 갱신, 2026-08-17 git 재확인)로 exact commit 확정. |
| **`/Users/admin/work/open-pencil`** | Bun monorepo (open source MIT)                        | `package.json` **v0.14.0** + `Unreleased`, local `HEAD 2710f906` (2026-08-14). 제품명 **OpenPencil** (openpencil.dev) — ".fig + .pen 편집기 + 내장 AI + 프로그래머블 툴킷 (headless Vue SDK)". 명시적 11 workspaces + `tools/`.                                                                                                                                                                                     |

**이름 충돌 주의**: `open-pencil/open-pencil` 의 제품명이 **OpenPencil** (`brew install openpencil`, app.openpencil.dev) 이라 `/Users/admin/work/openpencil` (ZSeven-W) 과 명칭이 겹친다. 인용 시 **경로 또는 GitHub org** 로 구분할 것.

**핵심 발견**: 3개는 **카피/fork 관계가 아니라 독립 프로젝트 3개**. README 에서 서로의 존재를 명시적으로 인지하며 공존. 사용자 관점 ("원본 + 카피 프로젝트들") 정정 필요.

### 최신성·증거 수준 판정

- **Pencil.app**: live update feed가 아니라 `/Users/admin/work/pencil`에 보관된 bundle을 판정한 것이다. 이 artifact의 버전은 v1.1.57로 확정되지만, 별도 v1.2.1 추출본의 변경이 이 bundle에 반영됐는지는 확인하지 않았다.
- **openpencil (ZSeven-W)**: local checkout의 git 메타데이터로 upstream과의 일치가 확정됐다 (`git describe v0.8.4-1-g9c810776` — release 페이지의 tag 이후 1 commit과 동일, 2026-08-17 재확인). 성능·기능 주장은 여전히 README/release note/current source가 동시에 확인되는 범위만 채택한다.
- **open-pencil (org)**: local Git repository가 clean이고 `HEAD`·`package.json`·`CHANGELOG.md`를 함께 확인했다. v0.14.0 release 이후의 `Unreleased` 기능도 현재 제품 분석에 포함하되, 수치가 없는 성능 문장은 정성 claim으로 표시한다.

---

## 2. 원본 Pencil.app v1.1.57 기술 스택 — 로컬 bundle 기준

`/Users/admin/work/pencil/Info.plist`의 `CFBundleShortVersionString`·`CFBundleVersion`은 모두 **1.1.57**이다. `Resources/app.asar`는 binary라 직접 source read는 하지 않고, `Info.plist` + `Frameworks/` + `app.asar.unpacked/node_modules/` 메타데이터로 현재 로컬 artifact를 판정했다.

```
Frameworks/
├── Electron Framework.framework               ← Electron 베이스
├── Pencil Helper (GPU).app                    ← GPU 프로세스 분리
├── Pencil Helper (Plugin).app                 ← 플러그인 프로세스 분리
├── Pencil Helper (Renderer).app               ← 렌더 프로세스 분리
└── Pencil Helper.app                          ← 메인 helper

Resources/app.asar (165MB)                     ← JS 소스 압축본 (closed-source)
Resources/app.asar.unpacked/node_modules/
├── @openai/codex 0.128.0 + codex-sdk                 ← OpenAI Codex SDK
├── @anthropic-ai/claude-agent-sdk 0.2.141            ← Claude Code 2.1.141 SDK
├── koffi 2.16.2                                      ← Node C FFI
├── @mariozechner/clipboard-darwin-universal          ← native clipboard
└── ...
```

**Pencil.app 의 차별점**:

1. **AI 에이전트 데스크탑 임베드** — OpenAI Codex SDK + Anthropic Claude Agent SDK **동시** 통합
2. **native Skia (WASM 우회) 추정** — v1.1.57 local bundle에는 `koffi` 2.16.2와 Codex/Claude native modules가 실제로 존재하므로, 이 artifact에 대해서는 C FFI 경로를 유지한다. 단 별도 v1.2.1 Pen 추출본은 이 결론을 반증하는 다른 artifact다.
3. **프로세스 분리** — GPU/Plugin/Renderer 헬퍼 4개로 엔터프라이즈급 격리 → **Electron 표준 구성** (차별점 아님)
4. **60+ 언어 i18n** — 글로벌 상업 제품 수준

composition 메모리 [`pencil-component-visual-markers`](../../../.claude/memory) 의 magenta/violet 마커, `Cmd+Opt+K` 토글, Properties `##Component section##` `##Slot section##` 구조는 **이 closed-source 원본의 UX 를 reference 로 차용** 중인 것 (코드는 black box, UX 관측 결과만 메모리 보존).

### v1.2.1 Pen 추출본과의 관계

`PEN_V1.2.1_RENDERING_UIUX_ANALYSIS.md`는 2026-07-26에 `docs/pencil-extracted/`의 **별도 Pen.app v1.2.1 bundle**을 추출해 작성한 후속 분석이다. 해당 artifact에서는 자체 `pencil.wasm`/Skia m149, 평문 `.pen` JSON schema v2.14, `koffi` 부재, `Pen` 리브랜딩을 확인했다. 이는 제품 계보의 후속 변화 후보로는 유효하지만, 현재 `/Users/admin/work/pencil`의 v1.1.57을 v1.2.1로 표기하거나 v1.1.57의 `koffi` 증거를 삭제할 근거는 아니다. 비교표에서는 다음처럼 두 증거를 분리한다.

| 구분                  | 직접 확인된 artifact                                                                                        | 분석에 사용할 수 있는 범위                                                         |
| --------------------- | ----------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------- |
| 현재 workspace bundle | Pencil.app v1.1.57, `dev.pencil.desktop`, Electron, `koffi 2.16.2`, Codex 0.128.0, Claude Agent SDK 0.2.141 | `/Users/admin/work/pencil`의 현재 정체·AI dependency·native bridge                 |
| 별도 후속 추출본      | Pen v1.2.1, `pencil.wasm`, Skia m149, `.pen` schema v2.14                                                   | 후속 버전의 렌더링·포맷·리브랜딩 변화. 현재 bundle의 version proof로 사용하지 않음 |

---

## 3. openpencil (ZSeven-W) 상세

> **2026-08-17 v0.8.4 현재 스냅샷 재실측.** 이 절의 `openpencil`은 하이픈 없는 `/Users/admin/work/openpencil` (GitHub `ZSeven-W/openpencil`)을 뜻한다. 하이픈 있는 `/Users/admin/work/open-pencil`과는 별도 프로젝트다. 판정은 현재 트리·README·`RELEASE_NOTES/v0.8.0..v0.8.4.md` 기준이며, 2026-08-17 재확인에서 `.git` 메타데이터가 확인되어 `HEAD 9c810776` (`v0.8.4` tag + 1 commit — release manifest 갱신)로 exact commit이 확정됐다. Upstream v0.8.4는 2026-08-11 pre-release이고, 아래 버전은 **현재 source의 workspace version**이자 commit `9c810776` 기준으로 읽는다.

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

**v0.8.4에서 분석을 바꾸는 최신 delta**:

- v0.8.3에서 도입된 authenticated collaboration의 **public relay가 published build에서 실제로 동작하도록** endpoint whitespace 검증을 build-time으로 이동하고, auth/rate-limit/network/protocol 오류를 분리했다.
- deck/template/style asset을 MCP·CLI surface로 노출하고 `export_deck`, `list_scene_templates`, `use_scene_template`, `list_style_guides`, `export_frames`, `get_deck_boards`를 추가해 “AI가 만들지만 전달하지 못하는” 단절을 줄였다. MCP catalog는 release note 기준 123→129 tools로 증가했다.
- update check는 GitHub API quota가 소진된 경우 Releases Atom feed로 전환한다. 따라서 현재 제품을 “AI canvas + MCP stdio”로만 설명하는 것은 v0.8.4 기준으로 불충분하다.

**성능 수치의 해석**: README가 제시하는 10,000-node full layout snapshot 약 0.68s, wheel-zoom CPU 약 69%→0%, web payload 8.2MB raw/2.18MB gzip은 제품 README의 측정 주장이다. open-pencil/composition과 동일한 hardware·scenario·p50/p95/p99 protocol로 재측정된 교차 비교 수치는 아니므로, §4-6 및 §5에서는 “제품 자체의 reported metric”으로만 사용한다.

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

## 4. open-pencil (OpenPencil) 상세 — 2026-08-17 갱신

| 항목       | 값                                                                                                                             |
| ---------- | ------------------------------------------------------------------------------------------------------------------------------ |
| Git remote | `github.com/open-pencil/open-pencil`                                                                                           |
| 버전       | **v0.14.0** (package/release 2026-08-10~11) + `Unreleased` (local `HEAD 2710f906`, 2026-08-14) — 기준선은 v0.12.2 (2026-05-19) |
| Monorepo   | Bun workspaces — **명시 11개** (`scene-graph`/`pen`/`kiwi`/`fig`/`core`/`dom-css`/`vue`/`cli`/`mcp`/`docs` + `tools/docs`)     |
| 미션       | ".fig / .pen 편집기 + 내장 AI + **프로그래머블 툴킷** (headless Vue SDK)"                                                      |
| 라이선스   | MIT                                                                                                                            |

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

**현재 `Unreleased` 추가분**: unsaved/pathless document local crash recovery, bounded isolated Vision inspection(이미지 history 미보존), AI chat image attachments, provider-specific reasoning effort, unavailable/substituted font의 affected-layer selection/retry가 추가됐다. 따라서 v0.14.0만 읽은 비교보다 현재 `CHANGELOG.md`의 Unreleased까지 포함한 비교가 정확하다.

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

**검증 가능한 claim과 한계**:

- `tests/engine`과 `perf.bench.ts`는 layout/snap/hit-test/render/import/DOM-CSS/FIG/Kiwi/vector를 도메인별로 격리해 검증한다.
- `tools/visual-oracles`의 `compare`/`bisect`/`export-fixtures`/`analyze-pattern`/`update-report`는 “어느 commit에서 픽셀이 발산했는가”를 찾는 회귀 인프라다. 단순 screenshot snapshot보다 원인 commit 탐색에 초점이 있다.
- 현재 확인한 release/changelog에는 composition의 native-refresh protocol과 같은 hardware-normalized frame-time p50/p95/p99 표가 없다. 그러므로 위 가상화·캐시·IPC 개선을 곧바로 “60fps 보장” 또는 composition보다 빠른 수치로 번역하지 않는다.
- `Unreleased`의 crash recovery·Vision inspection·font retry는 기능 안정성/운영 복원력 축이지 렌더 frame-time benchmark가 아니다.

**검증 인프라 신설**:

- `tests/engine/` 30개 도메인 — `layout/{auto-layout,absolute-position,grid-layout}`, `snap`, `hit-test`, `text`, `render`, `dom-css`, `figma`, `kiwi`, `vector`, `perf.bench.ts` 등 (+29.6k LOC / 303 files)
- `tools/visual-oracles/` — `compare` / **`bisect`** / `export-fixtures` / `analyze-pattern` / `update-report` / `pixel-image`
- 품질 게이트: `steiger`(아키텍처) / `knip`(미사용) / `sherif`(monorepo) / `publint`+`attw`(패키지) / secret-scan / i18n 검사

### 4-7. 이번 갱신에서 확인된 안정 baseline

`canvaskit-wasm ^0.40.0` (WebGL2 backed) · Tauri 2 + Vue 3 SPA · Canvas 2D 폴백 없음 · MIT · `.fig`/`.pen` Figma 호환 document surface · COMPONENT/INSTANCE + variant · Kiwi instance override. `@open-pencil/dom-css`가 신설됐지만 CSS 규격 layout engine으로 승격된 것은 아니며, current Unreleased에도 이 경계 변화는 확인되지 않는다.

### 4-8. Figma·Framer 제품화 baseline

Figma와 Framer는 source-level renderer를 공개하지 않는 hosted product이므로 내부 Canvas/WebGL 구현을 open-source 제품과 직접 비교하지 않는다. 대신 실제 사용자에게 노출된 workflow와 운영 surface를 제품화 평가의 기준으로 삼는다.

| 제품       | 2026-08-17 현재 제품화 증거                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                       | 제품화 평가에 반영한 한계                                                                                                                                                              |
| ---------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Figma**  | Auto Layout, components/variants, Variables·Libraries, version history, Organization/Enterprise branching, Dev Mode·Code Connect, Plugin API, Figma Sites를 하나의 SaaS workflow로 제공한다. 파일은 최대 500명 참여·200명 편집을 공식 안내하며, Organization/Enterprise는 web publishing 통제도 제공한다. [Auto Layout](https://help.figma.com/hc/en-us/articles/360040451373-Explore-auto-layout-properties) · [Branching](https://help.figma.com/hc/en-us/articles/360063144053-Guide-to-branching) · [Dev Mode](https://help.figma.com/hc/en-us/articles/15023124644247-Guide-to-Dev-Mode) · [Plugin API](https://developers.figma.com/docs/plugins/api/api-reference/) · [Multiplayer limit](https://help.figma.com/hc/en-us/articles/1500006775761-How-many-people-can-be-in-a-file-at-once) | renderer p50/p95/p99, self-hosting, 내부 schema는 공개 근거가 없다. Figma Sites는 문서 기준 open beta이므로 전체 제품의 hosting maturity와 동일시하지 않는다.                          |
| **Framer** | Canvas·components·breakpoints·CMS·custom code·staging/version·custom domain·hosting·site optimization을 연결한다. Agents는 prompt로 editable page/section/copy/visual을 만들고 수정하며 publish까지 이어진다. [Agents](https://www.framer.com/help/ai/) · [Publishing](https://www.framer.com/help/publishing/) · [Site optimization](https://www.framer.com/help/articles/site-optimization/)                                                                                                                                                                                                                                                                                                                                                                                                    | 자체 HTML export를 지원하지 않고 hosting 중심이다. editor frame-time benchmark와 범용 design-document schema는 공개되지 않았으며, CMS 내부 구조는 private implementation으로 취급된다. |

이 baseline 때문에 Figma는 **협업·design system·enterprise governance**, Framer는 **웹사이트 publish·CMS·hosting·AI workflow**의 제품화 reference로 분류한다. composition과의 직접 경쟁축은 renderer 구현 자체가 아니라 이 운영 가능한 workflow의 완결성이다.

---

## 5. 5축 비교 매트릭스

> 핵심 5축은 **렌더링 / 데이터 모델 / 컴포넌트 / AI / 협업**이다. 성능·검증·운영·제품화는 보조 행으로 분리한다. `/Users/admin/work/openpencil`은 2026-08-17 v0.8.4 source snapshot, `/Users/admin/work/open-pencil`은 2026-08-17 v0.14.0 + local `HEAD 2710f906` 기준이다. Pencil.app은 현재 v1.1.57 local bundle과 별도 v1.2.1 Pen 추출본을 분리한다. Figma는 Figma Design + Figma Sites, Framer는 hosted website builder + Agents 범위로 평가한다.

| 축                | Pencil.app / Pen                                                                      | openpencil (ZSeven-W)                                                             | OpenPencil (open-pencil)                                                | composition                                                                                              | Figma                                                                        | Framer                                                                           |
| ----------------- | ------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------- | ----------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------- | -------------------------------------------------------------------------------- |
| **렌더링**        | v1.1.57 Electron/native bridge 추정, v1.2.1은 별도 `pencil.wasm`/Skia m149            | native `skia-safe` + browser CanvasKit/WebGL2 shared host                         | CanvasKit WASM/WebGL2, Canvas 2D 폴백 없음                              | CanvasKit WASM 단일 renderer + Rust layout/Skia consumer                                                 | hosted renderer 내부 비공개                                                  | hosted React/edge delivery, editor renderer 내부 비공개                          |
| **데이터 모델**   | `.pen` surface 직접 확인, schema는 bundle에서 직접 read하지 않음; v1.2.1은 JSON v2.14 | `.op` JSON `PenDocument`, 21 node variants, events/bindings/lifecycle/route       | `.fig` + `.pen` + Kiwi override + HTML/CSS/Tailwind/JSX 입출력          | `CompositionDocument` + canonical RefNode/frame/slot/events/actions                                      | node/file model + Variables/Libraries, proprietary                           | visual site/document + components/CMS, proprietary                               |
| **컴포넌트**      | component/slot affordance UX reference                                                | `reusable` + `slot` + `RefNode/descendants` + ComponentLibrary/UIKit              | COMPONENT/INSTANCE + variant + Assets panel                             | ADR-142 reusable frame composite + canonical component semantics                                         | components/variants/Variables/Libraries                                      | components/variants/variables/CMS components                                     |
| **AI 통합**       | Codex SDK + Claude Agent SDK; 별도 v1.2.1은 5 agent families/spawn/MCP report         | `op-ai` + skills + concurrent orchestrator + ACP/MCP + multi-provider             | Design/Review/Fast/Vision role models + ACP/MCP + bounded Vision        | Groq `llama-3.3-70b-versatile`, streaming Tool Calling, 7 tools; provider abstraction/Ollama는 plan-only | First Draft/Agent, text/image/interaction/asset tools, paid Full seat·credit | Agents가 editable page/section/copy/visual을 생성·수정·publish; external agents  |
| **협업**          | closed-source bundle에서 contract 미확인                                              | authenticated P2P + relay + regional hub, pairing/cursors/conflict replay         | Trystero WebRTC P2P + relay/hub fallback + Yjs CRDT                     | 실시간 document collaboration 없음. Supabase Auth는 identity surface                                     | multiplayer, version history, Organization/Enterprise branching              | branches/staging/version workflow; realtime editor contract는 본 비교에서 미확인 |
| **성능·검증**     | 교차 benchmark 없음; v1.2.1 별도 WebGL/WASM 실측                                      | README reported 10k snapshot ~0.68s; release/CI/cargo-deny/source tests           | virtualized layers, retained backing, 30 engine domains, visual-oracles | ADR-153 Implemented: Picture/paint/cache/profiler/ping-pong + SpatialIndex; p50/p95/p99 우선             | version history/Dev Mode/multiplayer scaling; renderer p50/p95/p99 공개 없음 | site optimization/Lighthouse/staging; editor frame-time benchmark 공개 없음      |
| **운영·출력**     | Electron desktop + `.pen`/URL scheme                                                  | native desktop/web/CLI/wasm viewer, Figma/Git/VS Code/Chrome, codegen/deck export | Tauri desktop/web/CLI/MCP/headless Vue SDK, `.pptx`/HTML/PDF/SVG        | Builder + publish/preview, canonical mutation path                                                       | Dev Mode/Code Connect/export/Figma Sites                                     | CMS, custom code, staging, custom domain, hosting, publish                       |
| **제품화 수준**   | 상업 desktop UX는 강하나 artifact·schema 검증은 제한                                  | 기능 범위는 넓지만 v0.8.4 pre-release·source snapshot 불일치 리스크               | 프로그래머블 toolkit은 강하나 공식적으로 production-ready 아님          | canonical·성능 검증은 강하나 협업·public SDK·AI 운영 contract 부족                                       | 협업·library·branch·Dev Mode·enterprise control이 가장 성숙                  | publish·CMS·hosting·AI workflow가 가장 완결적이나 HTML export 없음               |
| **fallback 정책** | artifact별 상이: v1.1.57 native bridge, v1.2.1 custom WASM                            | Paper.js runtime fallback 없음; native PathOp/web contour parity 별도 검증        | Canvas 2D 폴백 없음                                                     | fallback 없음. 지원범위와 parity를 명시                                                                  | SaaS 내부 fallback 비공개                                                    | hosting/runtime 최적화는 제공하지만 editor fallback 내부는 비공개                |

---

### 5-1. 제품화 수준 평가 기준

기능이 존재하는 것과 사용자가 안정적으로 사용할 수 있는 제품으로 완성된 것은 다르다. 본 문서의 **제품화 수준**은 다음 다섯 기준을 0~5점으로 평가한다.

| 기준                       | 판정 질문                                                               |
| -------------------------- | ----------------------------------------------------------------------- |
| **사용자 workflow 완결성** | 생성 → 편집 → 저장 → 공유 → 검토 → 배포가 한 제품 안에서 끊기지 않는가? |
| **신뢰성·검증**            | 회귀·성능·시각 정합성·복구 경로를 반복 검증할 수 있는가?                |
| **보안·권한·비밀 관리**    | API key, document access, collaboration, admin policy가 운영 가능한가?  |
| **배포·호스팅·확장 표면**  | public SDK/CLI/Plugin/hosting/export가 사용자 workflow에 연결되는가?    |
| **릴리스·운영 성숙도**     | stable release, migration, observability, support·governance가 있는가?  |

제품화 점수는 AI 기능의 수가 아니라 **AI를 포함한 전체 workflow를 보안·검증·운영 가능한 상태로 제공하는 정도**를 본다. 예를 들어 composition의 7개 tool loop는 기능 점수에는 반영되지만 browser-side API key와 단일 provider는 제품화 점수를 낮춘다.

### 5-2. 기능 점수 및 제품화 반영 총점

기능 점수는 10개 축에 `데이터·문서 10 / 컴포넌트 10 / 레이아웃 10 / 렌더링 10 / 협업·버전 10 / 코드·Publish 10 / 확장성 10 / 성능·검증 10 / 엔터프라이즈 운영 5 / AI 15`의 가중치를 적용한 값이다. 제품화 반영 총점은 기능 점수 70%와 제품화 수준 30%를 합산한다. 이는 기능이 많지만 아직 운영 가능한 제품이 아닌 pre-release가 과대평가되는 것을 막기 위한 보정이다.

| 제품                         | 기능 총점 /100 | 제품화 수준 /5 | 제품화 반영 총점 /100 | 제품화 판정                                                                        |
| ---------------------------- | -------------: | -------------: | --------------------: | ---------------------------------------------------------------------------------- |
| **Figma**                    |           90.9 |        **4.8** |              **92.4** | 성숙한 SaaS 협업·library·branch·Dev Mode·enterprise control                        |
| **Framer**                   |           85.9 |        **4.5** |              **87.1** | publish·CMS·hosting·AI workflow가 강한 production website 제품                     |
| **OpenPencil (open-pencil)** |           86.2 |            3.7 |                  82.5 | SDK/CLI/MCP/visual oracle는 강하지만 active development·production readiness 제한  |
| **openpencil (ZSeven-W)**    |           84.8 |            3.5 |                  80.4 | native/Web·agent·협업 범위는 넓지만 pre-release와 snapshot provenance 리스크       |
| **Pencil/Pen**               |           70.0 |            4.1 |                  73.6 | 상업 desktop UX·AI는 강하지만 closed artifact와 version 분리로 검증성 제한         |
| **composition**              |           69.0 |            3.0 |                  66.3 | canonical·layout·성능 검증은 강하지만 협업·public SDK·AI 보안/운영 contract 미완료 |

> 총점은 “어떤 제품이 절대적으로 우월한가”가 아니라 **enterprise builder를 현재 바로 운영할 수 있는 수준**을 비교하는 지표다. Figma와 Framer는 hosted SaaS 운영 이점이 있고, open-source 제품은 확장성과 데이터 소유권 이점이 있으므로 총점만으로 아키텍처 선택을 대체하지 않는다.

### 5-3. 기능 축별 원점수

아래 점수는 기능의 존재 여부만이 아니라 현재 release/source에서 확인되는 범위와 성숙도를 함께 반영한 0~5 원점수다. `AI`는 15점, `엔터프라이즈 운영`은 5점, 나머지는 각 10점으로 환산한다.

| 기능 축                | 가중치 | Figma | Framer | OpenPencil | openpencil | Pencil/Pen | composition |
| ---------------------- | -----: | ----: | -----: | ---------: | ---------: | ---------: | ----------: |
| 데이터·문서 모델       |     10 |   4.8 |    3.5 |        4.3 |        4.7 |        3.5 |         4.5 |
| 컴포넌트·디자인 시스템 |     10 |   5.0 |    4.2 |        4.5 |        4.0 |        4.0 |         4.0 |
| 레이아웃·반응형        |     10 |   4.2 |    4.6 |        3.8 |        3.8 |        3.8 |         4.8 |
| 렌더링·런타임          |     10 |   3.8 |    4.6 |        4.0 |        4.8 |        4.0 |         4.2 |
| 협업·버전 관리         |     10 |   5.0 |    3.8 |        4.2 |        4.0 |        2.0 |         1.5 |
| 코드·Export·Publish    |     10 |   4.2 |    5.0 |        4.2 |        4.0 |        3.5 |         3.0 |
| 확장성·SDK             |     10 |   5.0 |    4.0 |        4.8 |        4.5 |        3.8 |         2.5 |
| 성능·검증              |     10 |   4.3 |    4.5 |        4.8 |        3.8 |        3.0 |         4.5 |
| 엔터프라이즈 운영      |      5 |   4.8 |    4.0 |        3.2 |        3.5 |        2.8 |         3.5 |
| AI 통합                |     15 |   4.5 |    4.5 |        4.6 |        4.7 |        4.0 |         2.5 |

### 5-4. 제품화 원점수

| 제품화 기준             |   Figma |  Framer | OpenPencil | openpencil | Pencil/Pen | composition |
| ----------------------- | ------: | ------: | ---------: | ---------: | ---------: | ----------: |
| 사용자 workflow 완결성  |     5.0 |     4.7 |        3.8 |        3.7 |        4.4 |         3.2 |
| 신뢰성·검증             |     4.8 |     4.4 |        4.6 |        3.7 |        3.4 |         4.4 |
| 보안·권한·비밀 관리     |     4.7 |     4.1 |        3.2 |        3.1 |        3.7 |         2.0 |
| 배포·호스팅·확장 표면   |     4.8 |     4.9 |        3.8 |        3.8 |        4.2 |         2.7 |
| 릴리스·운영 성숙도      |     4.7 |     4.4 |        3.1 |        3.2 |        4.8 |         2.7 |
| **제품화 수준 평균 /5** | **4.8** | **4.5** |    **3.7** |    **3.5** |    **4.1** |     **3.0** |

> 제품화 원점수에서 composition은 신뢰성·검증은 높지만 보안·권한·배포·릴리스 운영이 낮다. 따라서 “기술적으로 구현된 기능”과 “외부 사용자에게 안전하게 제공되는 기능”을 동일하게 세지 않는다.

## 6. composition reference 정합 평가

| composition 영역                                           | Reference 출처                                                                                            | 최신 정합 평가                                                                                                                                                                                                                                                 |
| ---------------------------------------------------------- | --------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Component visual marker (magenta/violet, Cmd+Opt+K 토글)   | Pencil.app v1.1.57 local bundle + 별도 Pen v1.2.1 UX report                                               | UX marker는 reference 가능하지만 implementation은 black box다. v1.2.1 report의 marker/AI UX를 v1.1.57 bundle 사실로 합치지 않는다.                                                                                                                             |
| `CompositionDocument` canonical schema (ADR-116/122)       | openpencil v0.8.4 `.op`/`PenDocument` + SDK node types                                                    | 가장 가까운 schema reference다. pages/children/variables/themes + Ref/reusable/slot이 공통이지만, openpencil은 21 node variants와 events/bindings/lifecycle/route로 제품 surface가 더 넓다. 1:1 동일성은 아님                                                  |
| ADR-130 frame (D1 RAC `Group` ↔ D3 canonical `frame` 분리) | openpencil `FrameNode.reusable` + `slot` + ComponentLibrary                                               | reusable bool/slot을 명시적으로 보존하고 UIKit/instance override까지 연결한 점이 유효하다. composition의 canonical frame vocabulary를 바꾸는 근거는 아니다.                                                                                                    |
| ADR-131 events/actions root collection                     | openpencil node-level `events`/`bindings`/lifecycle/route                                                 | interaction metadata가 존재한다는 기존 정정은 유지한다. 그러나 node-level metadata와 composition의 root `SerializedEvent/SerializedAction` contract는 별도이며, schema를 합치면 안 된다.                                                                       |
| ADR-134 AI Assistant 통합                                  | Pencil v1.1.57 dual SDK, openpencil Rust agent/orchestrator, open-pencil role models/ACP/MCP              | composition은 **기능이 전혀 없는 상태가 아니라** legacy Groq Tool Calling 7 tools가 landed다. 다만 Provider abstraction/Ollama/offline/routing/Plan→Execute→Verify는 ADR-134 Proposed plan-only라 reference 대비 격차가 남는다.                                |
| ADR-100 단일 Skia 엔진                                     | openpencil native `skia-safe` + browser CanvasKit/WebGL2; open-pencil CanvasKit WebGL2                    | “Skia 공통”보다 host contract가 핵심이다. openpencil의 Rust shared core와 composition의 web CanvasKit+Rust layout은 유사 목표지만 동일 runtime은 아니다.                                                                                                       |
| ADR-142 canonical document component model                 | openpencil `.op` PenDocument + reusable/Ref/descendants + UIKit; Pen v1.2.1 report의 동일 축              | Ref/reusable/slot/descendants는 공통 vocabulary로 재확증됐다. openpencil의 ComponentLibrary와 Pen의 agent-facing component model은 composition runtime registry와 별도 경계로 둔다.                                                                            |
| ADR-153 렌더 최적화 (측정 우선 + Picture 캐시)             | open-pencil retained backing/virtualization/oracles + openpencil 10k reported metric                      | composition ADR-153은 **2026-07-28 Implemented**다. Phase 1 profiler, Phase 2 paint lifecycle, Phase 3 Picture/ping-pong을 land했고 Phase 4 incremental budget은 G4 미달로 도입하지 않았다. reference는 이제 “도입 후보”가 아니라 landed 결과와 비교해야 한다. |
| ADR-916 Rust 레이아웃 엔진 (CSS 규격)                      | 3개 모두 Figma 계열 auto-layout; open-pencil `dom-css`                                                    | composition 독자 자산이다. open-pencil `dom-css`와 openpencil HTML/CSS import는 adapter/codegen이며 CSS-SIZING/FLEXBOX/GRID engine이 아니다.                                                                                                                   |
| 제품화·협업 workflow                                       | Figma multiplayer·version history·Organization/Enterprise branching·Libraries·Dev Mode·Plugin API         | composition은 canonical mutation과 Builder/Preview는 보유하지만 realtime collaboration·branch·public plugin/SDK가 없다. Figma는 제품화 reference이지 renderer/schema를 그대로 차용할 대상은 아니다.                                                            |
| 제품화·publish workflow                                    | Framer CMS·custom code·staging/version·custom domain·hosting·Agents                                       | composition publish/preview는 내부 Builder workflow로는 유효하지만 Framer처럼 public hosting·CMS·deployment·AI publish loop까지 연결된 제품화 surface는 아니다. Framer의 HTML export 부재는 hosting 중심 trade-off로 기록한다.                                 |
| 제품화·AI 운영                                             | Figma AI Agent/First Draft, Framer Agents·external agents, openpencil/OpenPencil의 multi-provider·ACP/MCP | composition의 7-tool Groq loop는 기능적으로 landed지만 provider abstraction·offline·secret isolation·Plan→Execute→Verify가 미완료다. 따라서 기능 격차보다 **운영 가능한 AI contract 격차**로 평가한다.                                                         |

**현재 정합의 핵심**: schema 축은 이미 composition이 reference 패턴을 흡수한 상태이고, 렌더링 축도 ADR-153 구현으로 기존 문서의 “composition은 retained/cache/profiler가 없다”는 낡은 격차가 해소됐다. 반면 제품화 축에서는 Figma의 협업·governance, Framer의 publish·hosting, OpenPencil 계열의 public SDK/agent surface가 앞선다. composition의 남은 gap은 단순 기능 수가 아니라 **협업·배포·확장·AI 보안/검증을 하나의 운영 가능한 workflow로 묶는 제품화 contract**다.

---

## 7. composition product target 정합

composition 의 product target = **엔터프라이즈급 빌더** (메모리 [`feedback-composition-enterprise-target`](../../../.claude/memory)). 2026-08-17 현재 target 정합은 “reference 기능을 그대로 복제했는가”가 아니라 canonical/renderer/layout/AI/운영 경계를 분리해 평가한다.

- **Pencil.app / Pen**: v1.1.57 local bundle은 상업 Electron desktop과 dual AI SDK/native bridge reference다. v1.2.1 Pen 추출본의 custom WASM/JS-heavy architecture까지 포함하면 composition의 web runtime과 비교할 수 있지만, 두 artifact를 같은 release로 취급하면 안 된다. Helper process 자체는 web product target의 직접 이식 후보가 아니라 Worker/utility isolation 질문으로 환원한다.
- **openpencil**: 현재는 AI-native + MCP만이 아니라 **Rust shared core + native/Web Skia + CLI/SDK + collaboration + codegen** 제품이다. `LayoutScene`/`RenderBackend` 공유, 10k-node reported metric, read-only wasm SDK, agent-team orchestration, authenticated collaboration은 composition의 enterprise builder target과 직접 비교할 reference다. 반대로 composition의 CSS 규격 layout engine은 openpencil의 Figma/HTML adapter와 다른 독자 target이다.
- **open-pencil**: 축이 "Figma 호환 + 협업"에서 **"프로그래머블 툴킷"**으로 이동했다 — headless Vue SDK / CLI / MCP / role-based AI / design-to-code 양방향 / visual-oracle tooling. composition이 엔터프라이즈 빌더를 지향한다면 SDK 경계 분리(§4-3), 패널·scene virtualization(§4-6), visual oracle bisect가 협업 기능보다 직접적인 reference다. 협업은 여전히 scope 밖이다.
- **Figma**: composition이 enterprise builder로 확장할 때의 **제품화 benchmark**다. Libraries·Variables·branching·version history·Dev Mode·Plugin API·multiplayer가 이미 한 SaaS workflow로 연결되어 있으므로, schema나 renderer를 복제하기보다 권한·review·handoff·extension boundary를 비교해야 한다.
- **Framer**: composition이 publish/preview를 production website로 확장할 때의 **배포 benchmark**다. CMS·custom code·staging·custom domain·hosting·AI Agents가 연결되어 있지만, HTML export를 제공하지 않는 hosting 중심 trade-off도 함께 기록해야 한다.

**composition의 현재 위치**:

- canonical SSOT, frame/component vocabulary, root events/actions, CSS layout engine, Skia/Preview parity는 reference를 소비하는 쪽이 아니라 자체 contract를 가진다.
- 렌더링 성능은 ADR-153 Implemented로 Picture cache, paint lifecycle, GPU/draw-call profiler, speedscope export, ping-pong snapshot까지 확보했다. 따라서 “open-pencil cache를 아직 도입해야 한다”는 문장을 그대로 유지하지 않는다.
- AI는 7개 tool + streaming agent loop + abort/visual feedback이 landed지만, `GroqAgentService`의 browser API key, 단일 provider, `llama-3.3-70b-versatile`, `dangerouslyAllowBrowser`는 ADR-134가 해결하려는 현재 gap이다. Figma·Framer·open-pencil 계열과의 차이는 AI 기능 수보다 provider·권한·검증·운영 contract의 제품화 수준이다.
- 제품화 반영 총점은 기능 총점 69.0/100에서 **66.3/100**으로 낮아진다. 이는 composition의 기술 기반이 약해서가 아니라, 현재 enterprise builder로 바로 운영할 때 필요한 realtime collaboration·public SDK·secret isolation·AI verification·production hosting이 아직 하나의 완결된 제품 workflow가 아니기 때문이다.

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
7. **Pencil.app AI agent dual embed (Codex + Claude SDK)** — composition은 legacy Groq agent loop가 landed했지만 ADR-134의 provider/offline/verification 확장은 plan-only → reference가 더 진보

**2026-08-17 추가 (open-pencil v0.14.0 + Unreleased 실측):**

8. **Layers 패널 가상화** — 수천 노드 문서의 증분 갱신 + 안정 확장 + scroll-to-selection. composition 5k 요소 프레임 드랍 지도 (메모리 [`project-frame-drop-map-5k-baseline`](../../../.claude/memory)) 의 노드 트리 축과 직결
9. **비활성 패널 지연 생성** — Code 패널 JSX 생성·강조를 활성 시점까지 미룸. composition 의 선택 클릭 fan-out 대책 (메모리 [`project-selection-click-fanout-next-lever`](../../../.claude/memory), ADR-155 Activity gating) 과 동형 처방
10. **클립보드 자식 1회 인덱싱** — 붙여넣기에서 노드마다 재스캔 제거. composition 붙여넣기·복제 경로에 동일 형태 존재 여부 점검 가치
11. **시각 오라클 도구화** (`compare` / **`bisect`** / `update-report`) — composition은 Chrome parity fixture와 cross-check gate를 갖췄지만, open-pencil처럼 회귀 구간 이분 탐색·패턴 분석을 하나의 도구 표면으로 묶지는 않았다. 발산 키가 100+로 나오는 격자(ADR-170)에서 도구화 이득이 큼
12. **bounded Vision inspection + image attachment lifecycle** — open-pencil은 selection render를 Vision model에 보내되 Design chat history에 이미지를 보존하지 않는 경계를 둔다. composition AI가 멀티모달로 확장될 때 입력 보존·전송·폐기 정책의 reference로 삼을 수 있다.
13. **openpencil v0.8.4 relay 오류 분류·build-time endpoint validation** — 협업을 도입하지 않더라도 외부 control-plane 오류를 `auth / rate-limit / network / malformed build`로 분리하는 운영·보안 관점의 reference다.
14. **Figma library·branch·Dev Mode contract** — library publish/review, version checkpoint, Organization/Enterprise branch, Code Connect를 composition의 canonical version·review·handoff boundary와 대조한다. Figma renderer나 proprietary file format을 가져오는 후보는 아니다.
15. **Figma Plugin API·Variables REST의 public extension boundary** — composition mutation path를 외부에 공개할 때 capability-scoped read/write API, document version pinning, secret boundary의 reference로 삼는다.
16. **Framer publish/staging/CMS workflow** — composition `publish/preview`가 production deployment로 확장될 때 custom domain, staging/production separation, CMS binding, rollback·version contract를 조사한다.
17. **Framer AI Agent의 editable output contract** — prompt 결과가 단순 text가 아니라 editable page/layer와 publish 상태로 귀결되는 구조를 ADR-134의 Plan→Execute→Verify 이후 단계 reference로 삼는다.

### 차용 불가 / 보류

1. **Pencil.app v1.1.57 native koffi bridge / Pen v1.2.1 custom C++ WASM** — web browser에 직접 이식할 수 없다. v1.1.57의 native bridge와 v1.2.1의 custom WASM은 서로 다른 artifact이므로 하나의 fallback 계층으로 조합하지 않는다.
2. **openpencil authenticated collaboration** — 현재 composition scope 밖. 다만 “협업 없음”이 아니라 P2P/relay/hub·auth·conflict model을 참고할 수 있는 보류 reference다.
3. **openpencil web Boolean 경로의 shape-specific contour 처리** — native Skia PathOp와 동일한 general path engine으로 간주하지 말고, composition vector boolean ops 도입 시 parity/지원범위를 별도 검증한다.
4. **open-pencil 실시간 협업** — composition scope 밖. 인용 시 **Trystero WebRTC direct P2P + public relay/hub fallback + Yjs CRDT**로 설명한다 (§4-2).
5. **open-pencil Kiwi instance override (Figma 호환)** — composition canonical과 schema 충돌. 별도 import/export 어댑터 영역
6. **open-pencil `dom-css` 의 CSS→노드 매핑** — Figma auto-layout 어휘로의 축약 매핑이라 composition의 CSS 규격 엔진에 역행 (§4-5). 참조 가치가 있는 방향은 **역방향** (`from-scene-graph` / `html-export`의 export 어법)
7. **openpencil Rust shared core의 wholesale 도입** — composition은 React/CanvasKit/Rust layout/Preview/CSS parity 계약이 이미 다른 방향으로 land됐다. 도입 후보는 host 분리·SDK read boundary·성능 측정 protocol이지 Rust workspace 자체가 아니다.
8. **open-pencil retained cache의 wholesale 재이식** — composition ADR-153이 이미 Picture/cache/lifecycle/profiler를 구현했고, open-pencil의 3-tier cache를 그대로 겹치면 invalidate·WASM memory contract가 충돌한다. 남은 후보는 visual oracle와 패널 virtualization처럼 현재 gap이 확인된 부분뿐이다.
9. **Figma/Framer hosted renderer·SaaS 운영 모델의 wholesale 도입** — 내부 renderer, proprietary schema, hosting control plane은 composition의 canonical-only·self-controlled architecture와 충돌한다. 차용 단위는 review/version/permission/deployment contract다.
10. **Framer HTML export를 전제로 한 migration** — Framer는 hosting 중심 제품이고 공식 FAQ상 HTML self-host export를 지원하지 않는다. composition의 publish portability 요구가 있다면 자체 export contract로 별도 설계한다.

---

## 9. 종합 결론

최신 데이터 기준의 종합 판정은 다음과 같다.

1. **Pencil 계열은 두 artifact로 나눠야 한다.** `/Users/admin/work/pencil`은 v1.1.57 Electron bundle이며 Codex/Claude SDK와 `koffi`가 실제 unpacked dependency로 확인된다. 별도 Pen v1.2.1 추출본은 custom `pencil.wasm`/Skia m149와 평문 `.pen` schema를 보여준다. 어느 한쪽을 다른 쪽의 최신 구현으로 전사하면 잘못된 결론이 된다.
2. **openpencil은 composition canonical schema의 가장 가까운 reference이면서 제품 범위가 가장 크게 확장됐다.** v0.8.4는 `.op`/`PenDocument`, Ref/reusable/slot을 유지하면서 21 node variants, interaction metadata, Rust native/Web shared host, SDK/CLI/codegen, collaboration까지 품는다. 기존의 “AI 중심, 협업 없음”이나 “MCP first” 요약은 폐기한다.
3. **open-pencil은 v0.14.0 + Unreleased에서 툴킷/검증 제품으로 이동했다.** package split, design-to-code, role-based AI, bounded Vision, crash recovery, virtualized Layers, retained backing, visual-oracle bisect가 핵심이다. P2P 협업은 여전히 존재하지만 composition product target에 직접 가져올 1순위는 아니다.
4. **composition의 schema/layout/renderer는 더 이상 단순 후발 격차가 아니다.** ADR-116/122/130/131/142로 canonical SSOT·frame·events/actions·component 경계가 정착했고, ADR-916 CSS 규격 layout은 세 reference와 다른 독자 자산이다. ADR-153도 2026-07-28 Implemented되어 Picture cache, paint lifecycle, profiler, ping-pong snapshot, SpatialIndex 기반 경로가 land됐다.
5. **composition의 가장 큰 잔존 gap은 AI productization이다.** 현재 `GroqAgentService`는 `llama-3.3-70b-versatile`, streaming Tool Calling, 7 tools, max 10 turns, 429 retry를 실제 제공한다. 그러나 browser-side `dangerouslyAllowBrowser`와 단일 provider는 ADR-134가 해결하려는 문제이고, Provider abstraction/Ollama/offline/routing/Plan→Execute→Verify는 아직 Proposed plan-only다. 따라서 “AI가 없다”가 아니라 “기본 agent loop는 있으나 enterprise-grade provider·verification·offline contract가 없다”가 정확하다.
6. **협업은 제품 scope 차이로 분류한다.** openpencil은 authenticated P2P + public relay + regional hub, open-pencil은 Trystero WebRTC + relay/hub fallback + Yjs CRDT다. composition의 Supabase Auth는 identity surface이지 실시간 document collaboration 구현이 아니므로, 이를 schema/rendering gap으로 잘못 계산하지 않는다.
7. **성능 비교는 FPS 숫자 경쟁이 아니라 측정 contract 비교로 전환한다.** openpencil의 10k-node/0.68s와 open-pencil의 qualitative cache/virtualization claim은 각 프로젝트의 자체 metric이다. composition은 native refresh cadence를 보존하고 frame-time p50/p95/p99를 우선하는 정책과 ADR-153 live evidence를 갖췄으므로, 공통 hardware·scenario 없이 “어느 제품이 더 빠르다”고 결론내리지 않는다.
8. **차용의 단위는 코드가 아니라 경계·검증 protocol이다.** 차용 우선순위는 `RefNode/reusable/slot` schema 비교, read-only SDK boundary, open-pencil visual-oracle bisect/패널 virtualization, openpencil relay error classification, Pencil/ Pen의 agent-facing UX다. Native FFI, Rust workspace wholesale, collaboration transport wholesale 이식은 보류한다.
9. **제품화 benchmark를 추가하면 Figma와 Framer의 우위가 기능 수가 아니라 workflow 완결성에서 나온다는 점이 명확해진다.** Figma는 협업·library·branch·Dev Mode·enterprise control, Framer는 CMS·hosting·staging·custom domain·AI publish loop를 연결한다. composition은 개별 canonical·layout·renderer contract는 강하지만 이 surface들이 하나의 운영 가능한 제품 workflow로 연결되지는 않았다.
10. **기능 총점과 제품화 반영 총점을 분리해 기록한다.** composition의 기능 총점은 69.0/100으로 Pencil/Pen보다 높지만, 제품화 수준 3.0/5를 반영하면 **66.3/100**이다. 이는 AI만의 문제가 아니라 realtime collaboration·public SDK·secret isolation·deployment·governance를 포함한 전체 product surface의 미완성 때문이다.
11. **현재 composition의 우선순위는 새로운 renderer 기능 추가가 아니다.** ADR-134 AI provider/security/verification, public read/write SDK capability, publish/hosting contract, collaboration scope decision, enterprise permission/audit를 제품화 gate로 정의하는 것이 총점 개선에 직접 연결된다.

---

## 10. 후속 조사 후보 (사용자 결정 영역)

- **Pencil artifact provenance 고정** — `/Users/admin/work/pencil` v1.1.57과 `docs/pencil-extracted/` Pen v1.2.1의 동일성·migration 경로를 다음 bundle에서 확인. 그 전까지는 두 버전의 렌더러/포맷 claim을 합치지 않는다.
- **openpencil native/Web Boolean parity** — native Skia `PathOp`와 web shape-specific contour 경로의 지원범위·fixture 차이를 비교해 composition vector boolean 정책을 결정
- **openpencil `op-collab*` trust/relay/session 경계** — composition 협업을 실제 제안할 때 auth, pairing, conflict replay, relay fallback, public relay threat model의 최소 계약을 비교
- **openpencil read-only wasm SDK ↔ composition preview/publish 경계** — editor mutation API와 외부 viewer API의 분리 수준, document versioning, capability scope를 비교
- **open-pencil `tools/visual-oracles` 이식 가능성** — `compare`/`bisect`/`analyze-pattern`/`update-report`를 composition Chrome parity fixture에 붙일 때 source-of-truth와 artifact storage를 먼저 정의. 단순 snapshot 추가로 끝내지 않는다.
- **open-pencil SDK 패키지 경계 ↔ composition packages 경계 대조** — `scene-graph/pen/kiwi/fig/dom-css`와 composition `specs/shared/composition-engine`의 public/private boundary를 비교하되, `dom-css`를 CSS engine으로 흡수하지 않는다.
- **ADR-134 단계 승격 판단** — legacy Groq tool loop는 landed지만 provider abstraction/offline/verification은 미착수다. Phase 0 baseline을 새로 freeze한 뒤 보안(`dangerouslyAllowBrowser`), canonical mutation, tool correctness, offline gate 순으로 P1 여부를 결정한다.
- **AI Vision/attachment data lifecycle** — open-pencil의 bounded selection render·non-retention 원칙을 composition의 Preview/Canvas snapshot·권한 모델과 대조한다. 구현 전 threat model과 storage retention gate가 필요하다.
- **제품화 score gate 정의** — 기능 총점과 별도로 사용자 workflow 완결성, reliability/validation, secret·permission, 배포·hosting·SDK, release/observability를 acceptance gate로 정의하고 composition의 제품화 수준 3.0/5를 재측정한다.
- **Figma 협업·governance contract 대조** — multiplayer, version checkpoint, branch, library publish/review, Dev Mode handoff를 composition의 history·canonical version·권한 모델과 비교한다. realtime collaboration 도입 여부와 무관하게 review/branch boundary는 조사 가치가 있다.
- **Framer publish productization contract 대조** — publish/preview, staging/production, CMS binding, custom domain, rollback, deployment failure handling을 composition `apps/publish`와 대조한다. Framer의 HTML export 부재는 portability 요구와 분리해 결정한다.
- **AI 운영 가능성 재평가** — tool 수가 아니라 provider abstraction, secret isolation, prompt/tool audit, Plan→Execute→Verify, retry/cancel, offline/local model, data retention을 제품화 acceptance criteria로 고정한다.
- **public SDK capability boundary** — Figma Plugin API·Variables REST, OpenPencil headless SDK/MCP, openpencil read-only wasm SDK를 비교해 composition preview/publish의 read-only와 mutation API를 capability/version scoped contract로 정의할지 판단한다. 배포·공급망 축 정본 reference 추가 (2026-08-18): xai plugin-marketplace 의 2계층 SHA 고정 (full 40-hex + 설치 시 rev-parse 재검증) + CI 원격-fetch 인덱스 신선도 강제 + 보안 리뷰 기각 목록 (SKILL.md 프롬프트 주입 포함) — [XAI_ORG_ANALYSIS.md](XAI_ORG_ANALYSIS.md) §5-2.
- **Worker thread / GPU 분리 ADR** — Pencil v1.1.57 helper process와 Pen v1.2.1 single-WASM 구조를 분리해 비교하고, composition에서는 Worker isolation이 실제 frame-time p95/interaction latency를 개선하는지 측정 후 제안한다.
- **공통 benchmark protocol** — 세 제품의 10k-node/zoom/pan/large document claim을 동일 hardware·refresh rate·fixture·warm/cold 조건의 frame-time p50/p95/p99로 재측정하기 전에는 상대 성능 순위를 발표하지 않는다.
- **openpencil v0.8.4 이후 재실측** — upstream release page가 tag 이후 1 commit을 표시하고 local snapshot에는 `.git`이 없으므로, 다음 source refresh에서 exact commit, Cargo lock, SDK format version, relay/host changes를 다시 고정한다.

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
- Pencil.app / openpencil은 당시 **재실측하지 않음**. 아래 2026-08-17 3차와 4차에서 두 artifact를 각각 다시 확인함.

**2026-08-17 3차 (openpencil 한정)** — `/Users/admin/work/openpencil` 현재 스냅샷 직접 read:

- `AGENTS.md`, `Cargo.toml`, `packages/package.json`으로 TypeScript/Electron retirement, Rust workspace, v0.8.4, SDK workspace 경계를 확인
- `README.md`의 기능·기술 스택·project structure·Rust migration·10k-node 측정값을 확인
- `RELEASE_NOTES/v0.8.0.md`~`v0.8.4.md`에서 Rust 전환, AI/MCP/ACP, HTML/Figma import, codegen, collaboration, deck/template/extension, relay fix 범위를 확인
- `crates/op-editor-core`, `op-host-native`, `op-host-web`, `op-ai*`, `op-orchestrator`, `op-mcp`, `op-collab*`, `op-codegen`, `packages/op-web-sdk*` 파일 구조와 구현 경계를 대조
- 현재 디렉터리에는 `.git` 메타데이터가 없어 commit count/diff는 산출하지 않음. 따라서 v0.7.5 대비 변경의 시간축은 release notes와 현재 source evidence로만 판정

**2026-08-17 4차 (Pencil.app·composition·upstream release 교차 확인)**:

- `/Users/admin/work/pencil/Info.plist`의 `CFBundleShortVersionString`/`CFBundleVersion`, `Resources/app.asar.unpacked/node_modules/{@openai/codex,@openai/codex-sdk,@anthropic-ai/claude-agent-sdk,koffi}/package.json`을 직접 확인했다. 별도 `PEN_V1.2.1_RENDERING_UIUX_ANALYSIS.md`의 `docs/pencil-extracted/` artifact와 분리했다.
- composition `apps/builder/src/services/ai/GroqAgentService.ts`·`services/ai/tools/index.ts`로 현재 Groq model/tool loop를, ADR-134 본문으로 Proposed/plan-only provider·offline 계획을 확인했다.
- composition ADR-153 completed 문서와 `docs/CHANGELOG.md`의 2026-08-15 native-refresh 정책을 확인했다. 현재 판정은 “cache/profiler 없음”이 아니라 **ADR-153 Implemented + frame-time p50/p95/p99 우선**이다.
- upstream primary release pages도 확인했다: [ZSeven-W/openpencil v0.8.4](https://github.com/ZSeven-W/openpencil/releases/tag/v0.8.4)는 pre-release이며 tag 이후 1 commit을 표시하고, [open-pencil/open-pencil v0.14.0](https://github.com/open-pencil/open-pencil/releases/tag/v0.14.0)는 2026-08-11 latest release로 package split·AI model roles·virtualized Layers·large `.fig`/cache 변경을 명시한다.

**2026-08-17 정정 검증 (open-pencil 협업)** — 별도 `/Users/admin/work/open-pencil`의 현재 HEAD도 교차 확인:

- root `package.json`의 직접 `trystero` dependency, `src/app/collab/room.ts`의 `trystero/mqtt` + STUN/TURN, `CHANGELOG.md`의 P2P/relay 서술을 확인
- 기존 §4-2의 "WebSocket 서버 릴레이만" 결론을 삭제하고 direct P2P + relay/hub fallback으로 정정

**2026-08-17 5차 (Figma·Framer·제품화 수준)** — 공식 문서와 현재 분석 artifact를 교차 확인:

- Figma 공식 Help/Developer 문서에서 Auto Layout, Libraries/Variables, version history, Organization/Enterprise branching, Dev Mode·Code Connect, Plugin API, multiplayer limit, Figma Sites publishing control을 확인했다. AI는 First Draft/Agent beta, text/image/interaction/asset tools, paid Full seat·credit 조건을 확인했다.
- Framer 공식 Help/Product 문서에서 Agents, editable page/section/copy/visual 생성, external agents, CMS, custom code, staging/version, custom domain·hosting·optimization을 확인했다. 공식 FAQ의 HTML self-host export 미지원도 제품화 trade-off로 반영했다.
- 기능 총점은 0~5 축 점수에 `10/10/10/10/10/10/10/10/5/15` 가중치를 적용했다. 제품화 수준은 사용자 workflow, reliability/validation, security/permission, deployment/extension, release/operations 5개 항목의 0~5 종합 판정이며, 제품화 반영 총점은 기능 70% + 제품화 30%다.
- AI 점수는 모델 응답 품질·환각률을 공통 benchmark 없이 비교하지 않고, 현재 사용자 workflow에 연결된 agent/tool/provider/multimodal/verification·security surface의 제품화 수준만 비교한다.
