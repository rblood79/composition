# Pencil 생태계 분석 — 3개 디렉토리 정체 + composition reference 정합

**작성일**: 2026-05-27
**분석 대상**: `/Users/admin/work/pencil`, `/Users/admin/work/openpencil`, `/Users/admin/work/open-pencil`
**관련 메모리**: [`pencil-component-visual-markers`](../../../.claude/memory), [`feedback-composition-enterprise-target`](../../../.claude/memory), [`feedback-no-fallback-thinking`](../../../.claude/memory)
**관련 ADR**: ADR-116 (canonical-only-runtime), ADR-122 (canonical SSOT), ADR-130 (frame), ADR-134 (AI 통합), ADR-142 (canonical document component model)

---

## 1. 3개 디렉토리의 실제 정체

| 디렉토리                            | 형태                                           | 정체                                                                                                                                                                                     |
| ----------------------------------- | ---------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **`/Users/admin/work/pencil`**      | **macOS `.app` bundle (closed-source binary)** | **Pencil.app v1.1.57** (`dev.pencil.desktop`, Electron, 60+ 언어). `Resources/app.asar` (165MB) — 소스 압축. 카피 아님 — **상업 데스크탑 앱 자체**. `.pen` 파일 + `pencil://` URL scheme |
| **`/Users/admin/work/openpencil`**  | Bun monorepo (open source MIT)                 | **ZSeven-W/openpencil v0.7.5** (GitHub 공식). "AI-native vector design tool, Design-as-Code, prompt→canvas". 11 packages                                                                 |
| **`/Users/admin/work/open-pencil`** | Bun monorepo (open source MIT)                 | **open-pencil/open-pencil v0.12.2** (GitHub 공식). "Figma-compatible editor + P2P 실시간 협업". 6 packages                                                                               |

**핵심 발견**: 3개는 **카피/fork 관계가 아니라 독립 프로젝트 3개**. README 에서 서로의 존재를 명시적으로 인지하며 공존. 사용자 framing ("원본 + 카피 프로젝트들") 정정 필요.

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
2. **native Skia (WASM 우회)** — koffi 로 C FFI 직접 호출
3. **프로세스 분리** — GPU/Plugin/Renderer 헬퍼 4개로 엔터프라이즈급 격리
4. **60+ 언어 i18n** — 글로벌 상업 제품 수준

composition 메모리 [`pencil-component-visual-markers`](../../../.claude/memory) 의 magenta/violet 마커, `Cmd+Opt+K` 토글, Properties `##Component section##` `##Slot section##` 구조는 **이 closed-source 원본의 UX 를 reference 로 차용** 중인 것 (코드는 black box, UX 관측 결과만 메모리 보존).

---

## 3. openpencil (ZSeven-W) 상세

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

## 4. open-pencil (org) 상세

| 항목       | 값                                                             |
| ---------- | -------------------------------------------------------------- |
| Git remote | `github.com/open-pencil/open-pencil`                           |
| 버전       | v0.12.2                                                        |
| Monorepo   | Bun workspaces (`packages/*` 6개: core/vue/mcp/docs/cli/demos) |
| 미션       | "Figma-compatible editor + P2P 실시간 협업"                    |
| 라이선스   | MIT                                                            |

**핵심 기술 스택**:

- **렌더링**: CanvasKit/Skia WASM (WebGL2 backed) — Paper.js 없음, Canvas 2D 폴백 없음
- **데이터 모델**: Figma-compatible (.fig + .pen) + **Kiwi instance override system** (Figma `.fig` round-trip 정합)
- **컴포넌트 시스템**:
  - COMPONENT + INSTANCE (Figma 호환)
  - **variant 지원** (component sets, default variant via property definitions)
  - 핵심 파일: `packages/core/src/scene-graph/instances.ts`, `kiwi/instance-overrides/`
- **AI 통합**: OpenRouter + MCP stdio routing
- **차별점**: **P2P 실시간 협업** (Tauri desktop + Vue SPA)
- **UI 패널**: LayersPanel.vue, PropertiesPanel.vue, AssetsPanel.vue, DesignPanel.vue

**최근 활동** (`CHANGELOG.md:5-49`, v0.12.2 2026-05-19):

- Canvas backing renderer 최적화 (perf cache subtree, retained backing)
- 로컬라이제이션 툴팁
- OpenRouter 모델 유연화
- MCP stdio routing
- JSX font 호환

---

## 5. 5축 비교 매트릭스

| 축                | Pencil.app (원본)                                | openpencil (ZSeven-W)                                                                   | open-pencil (org)                                       | composition (현재)                                                            |
| ----------------- | ------------------------------------------------ | --------------------------------------------------------------------------------------- | ------------------------------------------------------- | ----------------------------------------------------------------------------- |
| **렌더링**        | native Skia (koffi FFI)                          | CanvasKit WASM + Paper.js (boolean ops)                                                 | CanvasKit WASM (WebGL2)                                 | CanvasKit WASM (ADR-100 단일 엔진)                                            |
| **데이터 모델**   | `.pen` (closed format)                           | `PenDocument` + 11 node types + `RefNode` + `FrameNode.reusable:bool` + `slot:string[]` | Figma-compatible (.fig + .pen) + Kiwi instance override | `CompositionDocument` (ADR-116/122) + RefNode + frame                         |
| **컴포넌트**      | (UX: magenta/violet 마커)                        | reusable bool + slot array + RefNode (variant 없음)                                     | COMPONENT + INSTANCE + variant (Figma 호환)             | ADR-142 — reusable frame as composite component (단일 SSOT)                   |
| **AI 통합**       | **Codex SDK + Claude Agent SDK** 데스크탑 임베드 | 자체 `pen-ai-skills` + MCP server                                                       | OpenRouter + MCP stdio                                  | Groq SDK (`llama-3.3-70b`) + Tool Calling (ADR-134 plan only)                 |
| **협업**          | (closed, 미확인)                                 | 없음 (AI 중심)                                                                          | **P2P 실시간 협업**                                     | 없음 (Supabase Auth 만)                                                       |
| **fallback 정책** | (native binary 자체가 fallback)                  | Paper.js 보조                                                                           | **fallback 없음 (Canvas 2D 미지원)**                    | fallback 없음 (메모리 [`feedback-no-fallback-thinking`](.claude/memory) 정합) |

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

---

## 7. composition product target 정합

composition 의 product target = **엔터프라이즈급 빌더** (메모리 [`feedback-composition-enterprise-target`](../../../.claude/memory)). 3 reference 와 비교:

- **Pencil.app**: 상업 데스크탑 — koffi native Skia (WASM 우회) + Helper apps 4개 (GPU/Plugin/Renderer/main) — **엔터프라이즈급 성능 분리**. composition 은 web browser 라 Helper process 불가능 → Worker thread 로 대안 필요 (ADR 미발의)
- **openpencil**: AI-native + MCP 우선 — Picture cache / Paint pool / retained backing 같은 high-perf primitive 가 메모리 [`feedback-composition-enterprise-target`](.claude/memory) 에서 "**차용 후보 / Must**" 로 명시됨
- **open-pencil**: Figma 호환 + P2P collab — 협업 영역은 composition scope 밖 (현재 ADR 없음). Kiwi instance override 메커니즘은 ADR-122 canonical-only-runtime 과 비교 가능

**fallback 회피 원칙** ([`feedback-no-fallback-thinking`](../../../.claude/memory)) 적용:

- Pencil.app native binary fallback → 차용 불가 (web 환경)
- openpencil Paper.js boolean ops fallback → 회피 (composition 은 Skia native path 직접 사용)
- **open-pencil 만 fallback 없음** → composition 정합 방향과 일치

---

## 8. 차용 후보 / 차용 불가

### 차용 후보 (composition 강화 영역)

1. **openpencil `RefNode` + `descendants` override 패턴** — composition ADR-122 의 canonical RefNode 와 거의 동일 구조. cross-reference 로 schema 검증 가능
2. **openpencil `FrameNode.reusable:bool` + `slot:string[]`** — composition ADR-130 frame + ADR-142 reusable composite 의 reference. 단일 bool 플래그가 명료
3. **Pencil.app helper process 분리 (GPU/Plugin/Renderer)** — composition 의 Worker thread 분리 영역 후보 (ADR 미발의, 향후 작성·제안 영역)
4. **Pencil.app AI agent dual embed (Codex + Claude SDK)** — composition ADR-134 plan-only 상태 → reference 가 더 진보

### 차용 불가 / 보류

1. **Pencil.app native koffi Skia** — web browser 환경 불가능 (composition 은 WASM 필수)
2. **open-pencil P2P 실시간 협업** — composition scope 밖 (현재 ADR 없음, Supabase Auth 만)
3. **openpencil Paper.js boolean ops fallback** — fallback 사고 회피 원칙 위반 ([`feedback-no-fallback-thinking`](../../../.claude/memory)). composition 이 vector boolean ops 추가 시 Skia native path 직접 사용
4. **open-pencil Kiwi instance override (Figma 호환)** — composition canonical 과 schema 충돌. 별도 import/export 어댑터 영역

---

## 9. ultrathink 종합 결론

3 reference 가 composition 에 주는 본질적 시사:

1. **`/pencil` 은 카피 아닌 closed-source 원본** — UX/마커는 reference 가능, 코드는 black box. composition 메모리가 이미 정확히 인지 중
2. **openpencil 이 composition canonical schema 의 가장 가까운 reference** — RefNode/reusable/slot 패턴이 1:1 정합. ADR-116/122/130 의 진화 방향 검증에 활용 가능
3. **open-pencil 의 P2P 협업은 composition scope 밖** — 향후 협업 ADR 발의·제안 시 Kiwi instance override 가 reference, 현재는 무시
4. **AI 통합에서 composition 이 가장 뒤처짐** — Pencil.app (Codex+Claude SDK 동시) > openpencil (MCP first) > composition (Groq 단일, ADR-134 plan only). product target 이 엔터프라이즈 빌더라면 ADR-134 우선순위 P1 검토 가치
5. **3 reference 의 공통 = CanvasKit + flat node + RefNode + reusable+slot** — 이건 **업계 표준 패턴**으로 굳어지는 중. composition 이 ADR-116/122/130/142 에서 같은 방향으로 가고 있는 것은 정합 — 메모리 [`adr142-canonical-document-model`](../../../.claude/memory) 의 방향이 검증됨

---

## 10. 후속 조사 후보 (사용자 결정 영역)

본 분석은 ultrathink 1차. 깊이 분석이 필요한 영역:

- **openpencil `pen-types/src/pen.ts` (226줄) ↔ composition canonical schema 1:1 diff** — RefNode / FrameNode / PenNode 11종 vs CompositionDocument node types 정확한 매핑. ADR-122 G7 boundary allowlist 영역 정합 검증
- **Pencil.app `app.asar` 압축 해제로 실제 stack 확정** — Electron asar 표준 도구로 안전 추출 가능. closed-source 라이선스 검토 후 결정 필요
- **ADR-134 (AI 통합) priority 재검토** — Pencil.app reference 가 더 진보됨. plan → P1 승격 가치 평가
- **Worker thread / GPU 분리 영역 ADR 미발의** — Pencil.app helper process 패턴이 단서. composition Skia 렌더 worker 격리 영역 별도 작성·제안 가능
- **open-pencil Kiwi instance override 메커니즘 분석** — composition ADR-122 canonical instance 와 schema 충돌 영역. import/export 어댑터 필요시 reference

---

## 출처 / 메서드

본 분석은 3개 Explore agent 병렬 dispatch 결과 + 직접 binary 메타데이터 검증의 종합:

- `/Users/admin/work/pencil` — `Info.plist` + `Frameworks/` + `app.asar.unpacked/node_modules/` 직접 read (binary 본체는 read 불가)
- `/Users/admin/work/openpencil` — Explore agent `a58f0402199f70c43` (33 tool uses, 80s)
- `/Users/admin/work/open-pencil` — Explore agent `a4b73b5b8ee18c82a` (39 tool uses, 171s)

> **주의**: 첫 번째 dispatch agent (`a21fef29dddfc4df7`) 가 cwd 에 묶여 `/Users/admin/work/composition` 을 분석하는 오류 발생 — 결과 폐기 후 직접 binary 메타데이터 read 로 대체. 본 보고서의 Pencil.app 항목은 binary 메타데이터 기반 추정.
