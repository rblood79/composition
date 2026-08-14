# Pencil 생태계 분석 — 3개 디렉토리 정체 + composition reference 정합

**작성일**: 2026-05-27
**갱신일**: 2026-08-15 (open-pencil v0.12.2 → v0.14.0 재실측 — §1 표 / §4 / §5 / §7 / §8 / §10)
**분석 대상**: `/Users/admin/work/pencil`, `/Users/admin/work/openpencil`, `/Users/admin/work/open-pencil`
**관련 메모리**: [`pencil-component-visual-markers`](../../../.claude/memory), [`feedback-composition-enterprise-target`](../../../.claude/memory), [`feedback-no-fallback-thinking`](../../../.claude/memory)
**관련 ADR**: ADR-116 (canonical-only-runtime), ADR-122 (canonical SSOT), ADR-130 (frame), ADR-134 (AI 통합), ADR-142 (canonical document component model), ADR-153 (렌더 최적화 도입)

> **⚠️ STALE (2026-07-26) — Pencil.app 한정**: 본 문서의 Pencil.app 서술 일부가 v1.2.1 추출본 실측으로 반증됨 — ① 렌더러는 "native Skia (koffi FFI)" 가 아니라 **자체 C++ WASM (`pencil.wasm`, Skia m149 임베드)**, ② ".pen = closed format" 이 아니라 **평문 JSON (스키마 v2.14)**, ③ Helper 4-프로세스는 Electron 표준 구성 (차별점 아님), ④ 앱은 **Pen (pen.dev) 으로 리브랜딩**. 정정 상세: [PEN_V1.2.1_RENDERING_UIUX_ANALYSIS.md](PEN_V1.2.1_RENDERING_UIUX_ANALYSIS.md) §7.
>
> **♻️ 갱신 (2026-08-15) — open-pencil**: v0.12.2 기준 서술이 **v0.14.0 재실측으로 갱신**됨 (§4 참조). 핵심 정정 1건 — **"P2P 실시간 협업" 은 처음부터 부정확**하다 (WebRTC/peer 의존성 0건, 실체는 `yjs`+`y-protocols`+`ws` 서버 릴레이 CRDT). openpencil (ZSeven-W) 서술은 v0.7.5 기준 그대로이며 재실측 안 함.

---

## 1. 3개 디렉토리의 실제 정체

| 디렉토리                            | 형태                                           | 정체                                                                                                                                                                                                                     |
| ----------------------------------- | ---------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **`/Users/admin/work/pencil`**      | **macOS `.app` bundle (closed-source binary)** | **Pencil.app v1.1.57** (`dev.pencil.desktop`, Electron, 60+ 언어). `Resources/app.asar` (165MB) — 소스 압축. 카피 아님 — **상업 데스크탑 앱 자체**. `.pen` 파일 + `pencil://` URL scheme. → v1.2.1 에서 **Pen** 리브랜딩 |
| **`/Users/admin/work/openpencil`**  | Bun monorepo (open source MIT)                 | **ZSeven-W/openpencil v0.7.5** (GitHub 공식). "AI-native vector design tool, Design-as-Code, prompt→canvas". 11 packages (2026-05-27 기준, 재실측 안 함)                                                                 |
| **`/Users/admin/work/open-pencil`** | Bun monorepo (open source MIT)                 | **open-pencil/open-pencil v0.14.0** — 제품명 **OpenPencil** (openpencil.dev). ".fig + .pen 편집기 + 내장 AI + **프로그래머블 툴킷 (headless Vue SDK)**". 11 packages + tools/ (2026-08-15 실측)                          |

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

> 2026-05-27 v0.7.5 기준. 2026-08-15 재실측 대상 아님 — 이후 변경 여부 미확인.

| 항목       | 값                                                                 |
| ---------- | ------------------------------------------------------------------ |
| Git remote | `github.com/ZSeven-W/openpencil`                                   |
| 버전       | v0.7.5                                                             |
| Monorepo   | Bun workspaces (`packages/*` 11개 + `apps/*` 3개: web/desktop/cli) |
| 미션       | "AI-native vector design tool, Design-as-Code, prompt→canvas"      |
| 라이선스   | MIT                                                                |

**핵심 기술 스택**:

- **렌더링**: CanvasKit/Skia WASM + Paper.js (boolean path ops fallback)
- **데이터 모델**: `PenDocument` (version, name, themes, variables, pages, children) + 11 node types (frame/group/rectangle/ellipse/line/polygon/path/text/image/icon_font/ref)
- **컴포넌트 시스템**:
  - `FrameNode.reusable?: boolean` (boolean flag)
  - `FrameNode.slot?: string[]` (slot names array)
  - `RefNode` (instance): `ref: string`, `descendants?: Record<string, Partial<PenNode>>`
  - variant 없음 (slot 기반 composition 만)
- **AI 통합**: 자체 `pen-ai-skills` 패키지 + MCP server (Claude Code/Codex CLI 연동)
- **UI 패널**: PropertyPanel, LayerPanel, ComponentBrowser, **AIChatPanel**, VariablesPanel, CodePanel

**핵심 파일**: `packages/pen-types/src/pen.ts:1-226` (PenDocument, PenNode, RefNode 전체 schema)

**composition 과의 schema 비교 (1:1 거의 정합)**:
| openpencil | composition (canonical) |
|---|---|
| `FrameNode.reusable: boolean` | `FrameNode.reusable: boolean` (ADR-130) |
| `FrameNode.slot: string[]` | slot mirror metadata (ADR-122 boundary allowlist) |
| `RefNode.ref: string` | `RefNode.ref: string` + `descendants[path]` (ADR-116/122) |
| `PenDocument.pages[]` | `CompositionDocument.pages[]` |
| `PenDocument.variables` | `CompositionDocument.themes/variables` (ADR-110) |

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

### 4-2. 정정 — "P2P 실시간 협업" 은 부정확 (기준선 시점부터)

기준선의 "**차별점**: P2P 실시간 협업" 서술은 v0.12.2 시점에도 근거가 없었다. 실측:

- 의존성: `yjs` + `y-protocols` + `y-indexeddb` + **`ws`** (v0.12.2 · v0.14.0 **동일**). `webrtc`/`peerjs`/`simple-peer` 계열 **0건**.
- v0.14.0 Security 항목도 "collaboration **WebSocket** dependency" 를 갱신 대상으로 기록.
- 소스: `src/app/collab/{room,session,awareness,local-awareness,use}.ts` + `src/app/editor/canvas/collaboration-awareness.ts`.

→ 실체는 **서버 릴레이 CRDT 협업** (yjs awareness + IndexedDB 로컬 영속). composition scope 밖이라는 결론(§8)은 유지되지만, 근거를 "P2P" 로 인용하지 말 것.

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

> open-pencil 열은 2026-08-15 (v0.14.0) 기준. 나머지 열은 2026-05-27 기준 (Pencil.app 은 상단 STALE 배너 참조).

| 축                | Pencil.app (원본)                                     | openpencil (ZSeven-W)                                                                   | open-pencil / OpenPencil (org)                                                       | composition (현재)                                                            |
| ----------------- | ----------------------------------------------------- | --------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------ | ----------------------------------------------------------------------------- |
| **렌더링**        | native Skia (koffi FFI) → **자체 C++ WASM 으로 반증** | CanvasKit WASM + Paper.js (boolean ops)                                                 | CanvasKit WASM (WebGL2) — **변동 없음**                                              | CanvasKit WASM (ADR-100 단일 엔진)                                            |
| **데이터 모델**   | `.pen` (closed format) → **평문 JSON 으로 반증**      | `PenDocument` + 11 node types + `RefNode` + `FrameNode.reusable:bool` + `slot:string[]` | Figma 호환 (.fig + .pen) + Kiwi instance override + **HTML/CSS/Tailwind/JSX 입출력** | `CompositionDocument` (ADR-116/122) + RefNode + frame                         |
| **컴포넌트**      | (UX: magenta/violet 마커)                             | reusable bool + slot array + RefNode (variant 없음)                                     | COMPONENT + INSTANCE + variant + **Assets 패널 인스턴스 삽입**                       | ADR-142 — reusable frame as composite component (단일 SSOT)                   |
| **AI 통합**       | **Codex SDK + Claude Agent SDK** 데스크탑 임베드      | 자체 `pen-ai-skills` + MCP server                                                       | **역할별 모델 4종 (Design/Review/Fast/Vision) + ACP 에이전트 3종 + MCP**             | Groq SDK (`llama-3.3-70b`) + Tool Calling (ADR-134 plan only)                 |
| **협업**          | (closed, 미확인)                                      | 없음 (AI 중심)                                                                          | **yjs CRDT over WebSocket** (P2P 아님 — §4-2 정정)                                   | 없음 (Supabase Auth 만)                                                       |
| **fallback 정책** | (native binary 자체가 fallback)                       | Paper.js 보조                                                                           | **fallback 없음 (Canvas 2D 미지원)** — 변동 없음                                     | fallback 없음 (메모리 [`feedback-no-fallback-thinking`](.claude/memory) 정합) |

---

## 6. composition reference 정합 평가

| composition 영역                                           | Reference 출처                                      | 정합 평가                                                                              |
| ---------------------------------------------------------- | --------------------------------------------------- | -------------------------------------------------------------------------------------- |
| Component visual marker (magenta/violet, Cmd+Opt+K 토글)   | **Pencil.app (closed-source 원본)**                 | UX 마커 차용 — closed-source 라 코드는 못 봄, 메모리에 관측 결과만 보존                |
| `CompositionDocument` canonical schema (ADR-116/122)       | **openpencil/`PenDocument` + node types**           | 가장 가까운 정합 — flat node array + RefNode + reusable bool + slot string[] 패턴 동일 |
| ADR-130 frame (D1 RAC `Group` ↔ D3 canonical `frame` 분리) | **openpencil `FrameNode.reusable` + Figma `Frame`** | reusable bool 패턴 정확 차용                                                           |
| ADR-131 events/actions root collection                     | (Pencil/openpencil 모두 부재)                       | composition 독자 — 두 reference 모두 events root 없음                                  |
| ADR-134 AI Assistant 통합 (plan only)                      | **Pencil.app Codex+Claude SDK 동시 임베드**         | reference 더 진보 — composition 은 Groq 단일, plan 아직                                |
| ADR-100 단일 Skia 엔진                                     | 3개 모두 CanvasKit                                  | 업계 표준 — composition 정합                                                           |
| ADR-142 canonical document component model                 | **openpencil node tree + reusable boolean**         | 정확 정합 — 단일 SSOT 방향 검증                                                        |
| ADR-153 렌더 최적화 (측정 우선 + Picture 캐시)             | **open-pencil `retained-backing.ts` + `profiler/`** | Phase 1 반영 완료. reference 는 v0.14.0 에서 더 확장 (§4-6, 렌더 문서 갱신 배너 참조)  |
| ADR-916 Rust 레이아웃 엔진 (CSS 규격)                      | (3개 모두 부재 — Figma 계열 auto-layout)            | composition 독자 — open-pencil `dom-css` 는 어댑터이지 CSS 엔진 아님 (§4-5)            |

---

## 7. composition product target 정합

composition 의 product target = **엔터프라이즈급 빌더** (메모리 [`feedback-composition-enterprise-target`](../../../.claude/memory)). 3 reference 와 비교:

- **Pencil.app**: 상업 데스크탑 — Helper apps 4개 (GPU/Plugin/Renderer/main). composition 은 web browser 라 Helper process 불가능 → Worker thread 로 대안 필요 (ADR 미작성)
- **openpencil**: AI-native + MCP 우선 — Picture cache / Paint pool / retained backing 같은 high-perf primitive 가 메모리 [`feedback-composition-enterprise-target`](.claude/memory) 에서 "**차용 후보 / Must**" 로 명시됨
- **open-pencil**: 2026-08-15 기준 축이 "Figma 호환 + 협업" 에서 **"프로그래머블 툴킷"** 으로 이동 — headless Vue SDK / CLI / MCP / 90+ AI tool / design-to-code 양방향. composition 이 엔터프라이즈 빌더를 지향한다면 **SDK 경계 분리 (§4-3) 와 검증 인프라 도구화 (§4-6) 가 협업 기능보다 참조 가치가 크다**. 협업은 여전히 scope 밖

**fallback 회피 원칙** ([`feedback-no-fallback-thinking`](../../../.claude/memory)) 적용:

- Pencil.app native binary fallback → 차용 불가 (web 환경)
- openpencil Paper.js boolean ops fallback → 회피 (composition 은 Skia native path 직접 사용)
- **open-pencil 만 fallback 없음** → composition 정합 방향과 일치 (v0.14.0 에서도 유지)

---

## 8. 차용 후보 / 차용 불가

### 차용 후보 (composition 강화 영역)

1. **openpencil `RefNode` + `descendants` override 패턴** — composition ADR-122 의 canonical RefNode 와 거의 동일 구조. cross-reference 로 schema 검증 가능
2. **openpencil `FrameNode.reusable:bool` + `slot:string[]`** — composition ADR-130 frame + ADR-142 reusable composite 의 reference. 단일 bool 플래그가 명료
3. **Pencil.app helper process 분리 (GPU/Plugin/Renderer)** — composition 의 Worker thread 분리 영역 후보 (ADR 미작성, 향후 작성·제안 영역)
4. **Pencil.app AI agent dual embed (Codex + Claude SDK)** — composition ADR-134 plan-only 상태 → reference 가 더 진보

**2026-08-15 추가 (open-pencil v0.14.0 실측):**

5. **Layers 패널 가상화** — 수천 노드 문서의 증분 갱신 + 안정 확장 + scroll-to-selection. composition 5k 요소 프레임 드랍 지도 (메모리 [`project-frame-drop-map-5k-baseline`](../../../.claude/memory)) 의 노드 트리 축과 직결
6. **비활성 패널 지연 생성** — Code 패널 JSX 생성·강조를 활성 시점까지 미룸. composition 의 선택 클릭 fan-out 대책 (메모리 [`project-selection-click-fanout-next-lever`](../../../.claude/memory), ADR-155 Activity gating) 과 동형 처방
7. **클립보드 자식 1회 인덱싱** — 붙여넣기에서 노드마다 재스캔 제거. composition 붙여넣기·복제 경로에 동일 형태 존재 여부 점검 가치
8. **시각 오라클 도구화** (`compare` / **`bisect`** / `update-report`) — composition 은 Chrome parity fixture 는 갖췄으나 (`*.browser.test.ts`) **회귀 구간 이분 탐색·리포트 도구가 없다**. 발산 키가 100+ 로 나오는 격자 (ADR-170) 에서 도구화 이득이 큼

### 차용 불가 / 보류

1. **Pencil.app native koffi Skia** — web browser 환경 불가능 (composition 은 WASM 필수). 단 전제 자체가 반증됨 (상단 STALE 배너)
2. **open-pencil 실시간 협업** — composition scope 밖 (현재 ADR 없음, Supabase Auth 만). 인용 시 "P2P" 아닌 **yjs CRDT over WebSocket** 으로 (§4-2)
3. **openpencil Paper.js boolean ops fallback** — fallback 사고 회피 원칙 위반 ([`feedback-no-fallback-thinking`](../../../.claude/memory)). composition 이 vector boolean ops 추가 시 Skia native path 직접 사용
4. **open-pencil Kiwi instance override (Figma 호환)** — composition canonical 과 schema 충돌. 별도 import/export 어댑터 영역
5. **open-pencil `dom-css` 의 CSS→노드 매핑** — Figma auto-layout 어휘로의 축약 매핑이라 composition 의 CSS 규격 엔진에 역행 (§4-5). 참조 가치가 있는 방향은 **역방향** (`from-scene-graph` / `html-export` 의 export 어법)

---

## 9. 종합 결론

3 reference 가 composition 에 주는 본질적 시사:

1. **`/pencil` 은 카피 아닌 closed-source 원본** — UX/마커는 reference 가능, 코드는 black box. composition 메모리가 이미 정확히 인지 중 (v1.2.1 추출로 내부는 후속 규명 — PEN 분석 문서)
2. **openpencil 이 composition canonical schema 의 가장 가까운 reference** — RefNode/reusable/slot 패턴이 1:1 정합. ADR-116/122/130 의 진화 방향 검증에 활용 가능
3. **open-pencil 의 협업은 composition scope 밖** — 향후 협업 ADR 작성·제안 시 Kiwi instance override 가 reference, 현재는 무시. 단 "P2P" 근거는 정정됨 (§4-2)
4. **AI 통합에서 composition 이 가장 뒤처짐** — Pencil.app (Codex+Claude SDK 동시) ≈ open-pencil v0.14.0 (역할별 4모델 + ACP 3종) > openpencil (MCP first) > composition (Groq 단일, ADR-134 plan only). 격차가 3개월 사이 더 벌어졌다
5. **3 reference 의 공통 = CanvasKit + flat node + RefNode + reusable+slot** — 업계 표준 패턴으로 굳는 중. composition 이 ADR-116/122/130/142 에서 같은 방향인 것은 정합 — 메모리 [`adr142-canonical-document-model`](../../../.claude/memory) 의 방향이 검증됨
6. **(2026-08-15) 세 프로젝트 모두 CSS 규격 레이아웃을 목표로 하지 않는다** — Figma auto-layout 어휘가 공통 기반이고, open-pencil 의 CSS 지원조차 import 어댑터다 (§4-5). composition 의 Rust CSS 엔진 + Chrome 실측 oracle 은 **이 생태계에 대응물이 없는 독자 자산**이며, 동시에 이 생태계에서 차용할 레이아웃 처방이 없다는 뜻이기도 하다

---

## 10. 후속 조사 후보 (사용자 결정 영역)

- **open-pencil `tools/visual-oracles` 도구 구조 분석** — composition parity fixture 의 bisect/report 도구화 판단 근거 (§8-8). 2026-08-15 신규
- **open-pencil SDK 패키지 경계 (scene-graph/pen/kiwi/fig/dom-css) ↔ composition packages 경계 대조** — composition 은 `specs`/`shared`/`composition-engine` 3분할. 툴킷 지향 시 참조 (§4-3). 2026-08-15 신규
- **ADR-134 (AI 통합) priority 재검토** — reference 2종이 더 진보. plan → P1 승격 가치 평가 (§9-4)
- **Worker thread / GPU 분리 영역 ADR 미작성** — Pencil.app helper process 패턴이 단서. composition Skia 렌더 worker 격리 영역 별도 작성·제안 가능
- **openpencil (ZSeven-W) v0.7.5 이후 재실측** — 본 갱신에서 제외됨. canonical schema 정합의 근거 문서라 stale 위험 존재

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
- Pencil.app / openpencil 은 **재실측하지 않음** — 해당 절은 1차 기준 그대로
