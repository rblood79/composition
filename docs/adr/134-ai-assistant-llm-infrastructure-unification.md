# ADR-134: AI Assistant 차세대 아키텍처 — LLM 인프라 + 도구/UI 통합

## Status

Proposed — 2026-05-13
**노선 개정 — 2026-08-18**: 자체 로컬 LLM 내장 노선 (Ollama 1st + node-llama-cpp Electron 내장 + Qwen 고정) 을 폐기하고, reference 수렴 노선 (**역할별 멀티 프로바이더 BYOK + 외부 코딩 에이전트/MCP 준비**) 으로 교체. **Groq 완전 제거 방침은 유지**. 근거: [PENCIL_ECOSYSTEM_ANALYSIS.md](../explanation/research/PENCIL_ECOSYSTEM_ANALYSIS.md) (2026-08-17 갱신) + [HOLAOS_ANALYSIS.md](../explanation/research/HOLAOS_ANALYSIS.md) (2026-08-18) + [XAI_ORG_ANALYSIS.md](../explanation/research/XAI_ORG_ANALYSIS.md) (2026-08-18 — grok-build 를 5번째 수렴 사례로 추가). 본 개정은 전제 확정 종결 계약의 재개 조건 (a) 사용자 재제기에 따른 것 — 통합 형태 (단일 ADR, 대안 A) 결정은 유지하고 **인프라 노선만 재결정** (§인프라 노선 재결정 2026-08-18).

> **설계 문서 단계**: 본문 + design breakdown + 기존 ADR Deprecated 이동까지만 반영 (구현은 이후 단계). Phase 0-9 실행 작업 + 코드 변경은 사용자 plan review 후 별도 단계 ([[adr133-events-panel-simplification-plan]] 동일 패턴).

## Context

composition AI 어시스턴트의 두 선행 ADR — [ADR-011](completed/011-ai-assistant-design.md) (AI Assistant 설계, 2026-01-31) + [ADR-054](completed/054-local-llm-architecture.md) (로컬 LLM 아키텍처, 2026-04-05) — 는 본 ADR 작성 시점 (2026-05-13) 기준 다음 시스템 격차로 인해 폐기 후 통합 재설계가 필요하다.

### 격차 1 — canonical document SSOT 미반영 (ADR-011 응용 영역)

ADR-011 의 7개 도구 (createElement / updateElement / deleteElement / getEditorState / getSelection / searchElements / batchDesign) 는 작성 시점 (2026-01-31) 의 legacy elementsMap/childrenMap mutable subscription 기반. 본 ADR 작성 시점 기준 반영 완료된 정합 영역 미반영:

- **ADR-116 canonical document SSOT** (Implemented 2026-05-02) — `CompositionDocument` schema + Frame/Slot/ComponentSemantics 1차 필드 + boundary helper (frameMirror / slotMirror / componentSemanticsMirror) allowlist
- **ADR-122 canonical-only runtime** (Implemented 2026-05-09) — Builder hot path 의 mutable `elementsMap`/`childrenMap` subscription 0건, canonical store + read-only derived snapshot 갈음
- **ADR-131 events/actions root collection** (Implemented 2026-05-13) — `SerializedEvent / SerializedAction` + `useEventsForTarget` / `useDocumentActions` / `useCanonicalDocumentStore` mutation API
- **ADR-130 Frame canonical vocabulary** (Implemented 2026-05-13) — `frame` type + `FrameNode` 1차 필드 (Group 응용에서 분리)

ADR-011 의 도구 시그니처 (`createElement(tag, props, parentId)`) 는 legacy element-level mutation 만 다루며, canonical `CompositionDocument` 의 frame / slot / componentSemantics / events / actions 영역 mutation 미지원. AI 가 frame layout container 또는 component instance/slot 을 만들 수 없음.

### 격차 2 — data_tables SSOT 미반영 (ADR-011 데이터 바인딩 격차)

ADR-011 Section 1.3.3 의 "데이터 바인딩 격차" (Mock 엔드포인트 30+ 누락 / DataBinding 3단계 타입 / DataTable 프리셋 18종 / Transform 3단계) 는 본 ADR 작성 시점 기준 SSOT 정합 미반영:

- **`data_tables` 가 데이터 SSOT** ([[project-data-tables-ssot-framing]] 사용자 확정 2026-05-13) — `useCollectionData({ datatableId | dataBinding })` 통합 read 진입점
- **ADR-132 useCollectionData useAsyncList 정합** (Implemented 2026-05-13) — collections rename + Transformer 제거 + `data_tables → collections` schema 정정. ADR-011 의 "Transform 3단계" 가 해당 ADR Phase 7 에서 전수 제거됨
- **API endpoint sink** — `endpoint.targetDataTable` → `data_tables.runtimeData` (사용자 확정 영역)

ADR-011 의 `bindings` 도구 디자인은 legacy `{ type: "dataTable", field: "name" }` 필드 매핑만 다루며, ADR-132 반영 완료된 `data_tables → collections` 정합 + `useAsyncList` patch/move/remove 표준 callback 미지원.

### 격차 3 — Provider 추상화 + Electron 시점 미확정 (ADR-054 base 영역)

ADR-054 Proposed (2026-04-05) 의 대안 A (Ollama → node-llama-cpp + 온라인 모델 선택) 는 본 ADR 작성 시점 기준 반영 0건 (Proposed 상태 유지). Electron 마이그레이션 시점 미확정 (ADR-054 Soft Constraint 1) 이 해소되지 않은 상태에서 로컬 LLM 내장 단계 차단 위험. 또한 ADR-054 의 Hard Constraint (`groq-sdk` 완전 제거 + Provider 추상화 + 폐쇄망 + 컴포넌트 카탈로그 Tier 2 주입) 와 ADR-011 의 Phase A1~A4 반영 산출물 (도구 7개 + AIPanel + AbortController + G.3) 의 정합 합의 부재.

### 격차 4 — AIPanel UX (ADR-133 정합 미반영)

ADR-011 의 AIPanel (ChatMessage / ChatInput / ChatContainer / ToolCallMessage / AgentControls) 은 [[adr133-events-panel-simplification-plan]] (Proposed 2026-05-13) 의 "1년차 신입 개발자 baseline" mental model 미반영. ADR-133 Q4 사용자 확정 "1년차 신입 개발자라도 사용할 수준이어야한다" 가 AI 도구 UX 에도 적용되어야 함.

### 격차 5 — reference 수렴 방향과의 발산 (2026-08-18 추가)

[PENCIL_ECOSYSTEM_ANALYSIS.md](../explanation/research/PENCIL_ECOSYSTEM_ANALYSIS.md) (2026-08-17 갱신, §2/§3/§4/§8/§9) 실측 기준, 비교 대상 제품군의 AI 인프라는 전부 같은 방향으로 수렴했고 **자체 로컬 LLM 내장 (node-llama-cpp 류) 은 어디에도 없다**:

| Reference                                                                                              | AI 인프라 실측                                                                                                                                                                                                                                                                                                                                |
| ------------------------------------------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Pencil.app v1.1.57**                                                                                 | OpenAI Codex SDK (`@openai/codex` 0.128.0) + Anthropic Claude Agent SDK (0.2.141) **dual embed** — 외부 코딩 에이전트를 데스크톱에 직접 통합                                                                                                                                                                                                  |
| **openpencil (ZSeven-W) v0.8.4**                                                                       | `op-ai` + skills + `op-orchestrator` (Concurrent Agent Teams) + `op-acp` + `op-mcp` — **multi-model/provider profile** + 외부 CLI/ACP 연동, MCP catalog 129 tools                                                                                                                                                                             |
| **open-pencil (OpenPencil) v0.14.0**                                                                   | **역할별 모델 4종 (Design / Review / Fast / Vision)** — 슬롯마다 개별 provider·엔드포인트·자격증명 + provider 별 reasoning effort + 격리 Vision inspection + **ACP 에이전트 (Claude Code / Codex / Gemini CLI)** + MCP unix socket 자동 발견                                                                                                  |
| **holaboss-ai/holaOS** ([HOLAOS_ANALYSIS.md](../explanation/research/HOLAOS_ANALYSIS.md) 2026-08-18)   | 하니스 추상화 (`runtime/harness-host` — 자체 pi / Claude Code / Codex 3-way) + BYOK 멀티 프로바이더 (Anthropic / OpenAI / 호환 endpoint) + MCP + deferred tool gateway + 하니스 간 공유 메모리                                                                                                                                                |
| **xai-org/grok-build** ([XAI_ORG_ANALYSIS.md](../explanation/research/XAI_ORG_ANALYSIS.md) 2026-08-18) | BYOK 멀티 백엔드 (`ApiBackend` — Anthropic Messages / OpenAI ChatCompletions·Responses + capability 술어) + ACP 지원 에이전트 + MCP 클라이언트 + **도구 지연 로딩** (BM25 `search_tool` + `use_tool` 메타 디스패처 — MCP 도구를 모델 manifest 에서 제외) + `~/.claude/settings.json`·skills·hooks 네이티브 호환 읽기. 자체 로컬 LLM 내장 없음 |

같은 문서 §9-5 의 composition 판정: "기본 agent loop 는 있으나 enterprise-grade provider·verification·offline contract 가 없다" — 잔존 gap 은 AI 기능 수가 아니라 **AI productization** (provider abstraction / secret isolation / prompt·tool audit / Plan→Execute→Verify / offline / data retention — §10 acceptance criteria). 현행 `GroqAgentService` 는 `groq-sdk` ^0.37.0 + `llama-3.3-70b-versatile` 단일 provider + `dangerouslyAllowBrowser: true` (API 키 브라우저 노출) 상태다.

반면 본 ADR 의 2026-05-13 원 노선 (Ollama 1st + node-llama-cpp Electron 내장 + Qwen 모델 고정 + 폐쇄망 first-class 내장) 은:

- reference 5개 어디에도 대응물이 없는 **고립 노선** — 모델 수명주기 관리 (다운로드 ~18.5GB / 양자화 / 세대 교체) 를 제품이 소유
- 하드웨어 제약 (16GB 는 14B 한정, 권장 36GB) 을 제품 요구사항으로 떠안음
- 로컬 모델 tool calling 정확도 상한 (BFCL ≤ 75%) 을 카탈로그 주입으로 보정하는 구조적 부담
- Electron 마이그레이션 미확정에 최종 단계 (Phase 9) 가 묶임

사용자 재제기 (2026-08-18): "기존 Groq 은 제거 예정이고, pencil 앱이나 PENCIL_ECOSYSTEM_ANALYSIS.md 분석처럼 open-pencil 방향으로 전환해야 한다" — 이에 따라 §인프라 노선 재결정에서 노선을 재평가한다.

### Hard Constraints

ADR-054 Hard Constraints 승계 + 2026-08-18 노선 개정 반영:

1. Canvas 60fps 유지 — LLM 추론이 렌더링 스레드를 차단하면 안 됨
2. 기존 7개 AI 도구와 호환 + 확장 + canonical document mutation API 정합
3. Tool Calling 지원 — 자연어 → 도구 호출 패턴 핵심
4. ~~Apple Silicon 16GB 에서 실행 가능 (Qwen3 14B), 36GB 권장~~ — **2026-08-18 삭제**: 로컬 모델은 BYOK OpenAI-compatible endpoint (Ollama 등) 소관으로 이동. 하드웨어 사양은 사용자 endpoint 환경의 속성이지 제품 hard constraint 가 아님
5. 초기 앱 번들 < 500KB — LLM 관련 코드는 lazy load, 모델 자체는 제품이 배포하지 않음
6. RAC / RSP 문서 기반 정확한 props 설정 — 잘못된 prop 조합 생성 금지
7. **폐쇄망 지원** — 인터넷 불가 환경에서도 기본 AI 기능 동작. **2026-08-18 달성 방식 재규정**: 자체 모델 내장이 아니라 **로컬 OpenAI-compatible endpoint (Ollama / vLLM / LM Studio 등) 를 역할 슬롯에 BYOK 바인딩**하는 방식으로 달성

본 ADR 추가 Hard Constraints (canonical / data_tables / events 정합 + 2026-08-18 추가):

8. **canonical document mutation API 만 사용** — legacy `elementsMap` / `childrenMap` direct write 금지. AI 도구는 `useCanonicalDocumentStore.getState().{setFrames, setSlots, setEvents, setActions, ...}` 또는 boundary helper allowlist 경유
9. **`data_tables` 데이터 SSOT 정합** — AI 가 데이터 바인딩 도구 호출 시 `data_tables.runtimeData` sink + `useCollectionData({ datatableId | dataBinding })` read 진입점만 사용
10. **events/actions root collection 정합** — AI 가 이벤트 핸들러 생성 시 `SerializedEvent / SerializedAction` schema + canonical mutation API 사용
11. **frame canonical vocabulary 정합** — layout container 생성 시 `type: "frame"` (Group 응용 흡수 금지)
12. **AIPanel UX 1년차 신입 baseline** — ADR-133 Q4 확정 정합
13. **API 키 브라우저 비노출** (2026-08-18 추가) — browser 번들에서 외부 provider 직접 호출 금지. `dangerouslyAllowBrowser` 류 0건. BYOK 키는 브라우저 JS 에 상수/env 로 실리지 않는 보관·경유 경계 필수 (로컬 endpoint 는 사용자 머신 내 통신이라 예외)

### 3-domain 분할 (SSOT 체인 정본)

[SSOT 체인 정본](/.claude/rules/ssot-hierarchy.md) 3-domain 기준 본 ADR scope:

- **D1 DOM/접근성**: RAC 절대 권위 유지 — AI 도구가 출력하는 DOM 구조는 RAC 컴포넌트 사용 (수정/확장 금지)
- **D2 Props/API**: AI 가 RAC / RSP 문서 기반 정확한 props 설정 — Tool Calling 의 핵심 영역
- **D3 시각 스타일**: catalog SSOT — AI 가 스타일 변경 시 `style` props 만 mutate, catalog/spec 직접 편집 금지

## 전제 점검 4 질문 lock-in

> [adr-writing.md §ADR Fork / 분리 결정 시 전제·관점 점검](/.claude/rules/adr-writing.md) 의 4 질문 통과. 사용자 explicit confirm 1회 받음 (Q1 "단일 통합 ADR 1개" + Q2 "설계 문서만 먼저 반영"). [feedback-no-derived-adr-mid-execution](memory) + [feedback-adr-consolidation-burden-not-essence](memory) 차단 카테고리 자기-인용 통과.
>
> **2026-08-18 개정 주기**: 본 개정은 재개 조건 (a) **사용자 재제기**에 의한 것. Q1~Q4 의 통합 형태 결정 (단일 ADR / 직교 분류 / 두 선행 ADR Deprecated) 은 그대로 유지되며, 재결정 대상은 인프라 노선 (§인프라 노선 재결정) 하나다. 별도 fork/분리 없음.

### Q1: base / 응용 분류

- **ADR-054 = base** (LLM 인프라 / Provider 추상화 / 모델 라우팅 / 폐쇄망)
- **ADR-011 = 응용** (AI 도구 7개 / 시스템 프롬프트 / AIPanel UI / 컴포넌트 지식 격차 / 레이아웃 격차 / 데이터 바인딩 격차)
- **결정**: base + 응용을 **단일 ADR-134 안 Phase 분해** (사용자 explicit confirm Q1)

### Q2: schema 직교성

- Provider 추상화 (`LLMProvider`) ↔ AI 도구 (`createElement` / `updateElement` / ...) — **직교 specialization**
- ADR-054 의 `LLMProvider.completeWithTools(tools, messages)` 가 base 인터페이스
- ADR-011 의 `7 tool definitions + AgentLoop + AIPanel` 이 응용 implementation

### Q3: 선행 전제 reverse 검증

- 기존 전제: ADR-054 supersedes ADR-011 (단일 supersede 관계)
- 사용자 정정 (2026-05-13): **두 ADR 모두 폐기 + ADR-134 통합 작성** (단순 supersede 가 아니라 system 정합 격차 해소 목적)
- 선행 전제 자동 승계 금지 — fork 시점에 4 격차 (canonical / data_tables / events / AIPanel UX) 별도 검증 완료

### Q4: fork 분리 vs 단일 통합

- 사용자 explicit confirm: **단일 통합 ADR 1개** (Q1 답변 "단일 통합 ADR 1개")
- 동기 분류: "작성 부담 절약" 아님 — base + 응용 영역이 4 격차 영역과 동시 정합 필요 ([[feedback-adr-consolidation-burden-not-essence]] 차단 통과)

## Alternatives Considered

### 통합 형태 결정 (2026-05-13 — 유지)

#### 대안 A: ADR-054 base + ADR-011 응용 → ADR-134 단일 통합 (선택)

- 설명: ADR-054 의 Provider 추상화 (base) + ADR-011 의 도구/UI (응용) 영역을 단일 ADR-134 안 Phase 분해. 4 격차 (canonical / data_tables / events / AIPanel UX) 와 동시 정합
- 근거: ADR-133 동일 패턴 (3 ADR Deprecated + 통합 신규 ADR) + 4 격차 영역이 응용/base 분리해도 동일 사용자 결정 적용 필요 → 분리 fork 시 의존 체인 관리 비용이 통합 대비 높음
- 위험: 기술(M) / 성능(M) / 유지보수(M — 단일 ADR scope 9 Phase, Phase 별 Gate 필요) / 마이그레이션(L — ADR-011 Phase A1~A4 산출물 보존 + 점진 교체)

#### 대안 B: ADR-N base (LLM 인프라) + ADR-M 응용 (AI 도구/UI) 분리 fork

- 설명: ADR-054 영역을 base ADR 로, ADR-011 응용 영역을 신규 응용 ADR 로 분리. 두 ADR 의 의존 체인 명시
- 위험: 기술(M) / 성능(M) / **유지보수(H — 2 ADR 작성 + 의존 체인 관리, 4 격차의 소속 재판정 비용)** / 마이그레이션(M — base 완료 후 응용 진입, 병렬성 손실)

#### 대안 C: ADR-011 만 Deprecated + ADR-054 Proposed 유지 후 신규 응용 ADR

- 설명: ADR-054 (Risk-First 템플릿 + design breakdown 2360 lines) 유지 + ADR-011 만 Deprecated
- 위험: 기술(M) / 성능(M) / **유지보수(H — ADR-054 본문 stale 영역 다수, 정정 비용 > 신규 작성 비용)** / 마이그레이션(M)
- 사용자 정정과 충돌: "기존 계획은 폐기후 신규 ADR 을 생성하는것이 맞다고본다"

#### Risk Threshold Check (통합 형태)

| 대안                                                    | 기술 | 성능 | 유지보수 | 마이그레이션 | HIGH+ 개수 |
| ------------------------------------------------------- | :--: | :--: | :------: | :----------: | :--------: |
| A: ADR-054 + ADR-011 → ADR-134 단일 통합 **(선택)**     |  M   |  M   |    M     |      L       |     0      |
| B: ADR-N base + ADR-M 응용 분리 fork                    |  M   |  M   |  **H**   |      M       |     1      |
| C: ADR-054 유지 + ADR-011 만 Deprecated + 신규 응용 ADR |  M   |  M   |  **H**   |      M       |     1      |

루프 판정: HIGH 0개 대안 (A) 존재. 추가 대안 불필요.

### 인프라 노선 재결정 (2026-08-18 — 격차 5 대응)

통합 형태 (대안 A) 는 유지한 채, **"Groq 제거 후 무엇으로 대체하는가"** 의 노선을 재평가한다.

#### 노선 α: 자체 로컬 LLM 내장 (2026-05-13 원 결정)

- 설명: Ollama Provider 1st → node-llama-cpp Electron Utility Process 내장 → Qwen3/Qwen3.5 모델 고정 + 카탈로그 주입으로 tool calling 정확도 보정. 폐쇄망 first-class 를 제품 내장으로 달성
- 위험:
  - 기술: **MEDIUM** — node-llama-cpp 안정성 + Electron 마이그레이션 시점 의존
  - 성능: **HIGH** — 로컬 모델 BFCL tool calling ≤ 75% 가 UX 상한. frontier 모델 대비 격차가 카탈로그 보정으로도 미해소 (multistep 설계 T2 72%)
  - 유지보수: **HIGH** — 모델 수명주기 (다운로드 ~18.5GB / 양자화 / 세대 교체 / 하드웨어 매트릭스 16·36GB) 를 제품이 소유. reference 5개 (Pencil.app / openpencil / open-pencil / holaOS / grok-build) 어디에도 대응물이 없는 고립 노선 — 교차 검증 불가
  - 마이그레이션: **MEDIUM** — 최종 단계가 Electron 미확정에 묶임

#### 노선 β: 역할별 멀티 프로바이더 BYOK + 외부 에이전트/MCP 준비 (선택)

- 설명: open-pencil v0.14.0 의 역할별 모델 패턴을 채택 — **역할 슬롯 (design / review / fast / vision 예약)** 마다 provider·엔드포인트·자격증명·모델을 개별 설정 (BYOK). 어댑터는 **Anthropic Messages + OpenAI-compatible Chat Completions 2-way** 로 축소하고, 로컬 모델 (Ollama / vLLM / LM Studio) 은 OpenAI-compatible endpoint 로 포섭 — 폐쇄망은 전 슬롯을 로컬 endpoint 에 바인딩하는 것으로 달성. 도구 정의는 MCP tool schema 호환 형태를 유지해 외부 코딩 에이전트 (ACP — Claude Code / Codex) 통합을 Electron 단계 목표로 준비. `dangerouslyAllowBrowser` 제거 + 키 보관·경유 경계 (secret isolation) 를 1급 결정으로 승격
- 근거: 격차 5 — reference 5개 전부가 이 방향으로 수렴 (분석 문서 §8 차용 후보 4/7/12/17 + holaOS 하니스 패턴 + grok-build `ApiBackend`·도구 지연 로딩). 분석 문서 §10 "AI 운영 가능성 재평가" 의 acceptance criteria (provider abstraction / secret isolation / audit / verification / offline / retention) 와 1:1 정합. 구현 세부 reference: [XAI_ORG_ANALYSIS.md](../explanation/research/XAI_ORG_ANALYSIS.md) §5-1 (capability 술어 / retry 스펙 / 프롬프트 템플릿 / compaction 계약)
- 위험:
  - 기술: **LOW** — 표준 API 2종 어댑터. 웹앱 환경에서 즉시 진행 가능 (Electron 비의존)
  - 성능: **LOW** — frontier 모델 tool calling (BFCL 90%+) 이 기본 경험. 로컬 endpoint 선택 시 정확도는 사용자 trade-off
  - 유지보수: **MEDIUM** — 역할 슬롯 설정 UX + BYOK 키 보관 경계 + provider 2종 어댑터. 모델 수명주기는 provider/사용자 소관으로 이전
  - 마이그레이션: **LOW** — 기존 7 도구 + AgentLoop 보존, provider 만 교체. ACP embed 만 Electron 단계로 이연

#### 노선 γ: 외부 코딩 에이전트 전면 위임

- 설명: Pencil.app dual embed / holaOS 하니스처럼 Claude Agent SDK / Codex SDK 를 직접 embed 하고 자체 tool loop 를 폐기 — 에이전트가 MCP 로 composition 도구를 호출
- 위험:
  - 기술: **HIGH** — SDK subprocess 실행이 필요해 **Electron 선행 필수** (웹앱 현 단계에서 차단). 브라우저에서 대응물 없음
  - 성능: **LOW** — frontier 에이전트 품질
  - 유지보수: **MEDIUM** — 에이전트 SDK 버전 추종 + 하니스 계약 유지
  - 마이그레이션: **HIGH** — 기존 AgentLoop/AIPanel 산출물 폐기 + 전면 재작성. 1년차 신입 baseline UX 를 코딩 에이전트 UI 위에 재구축해야 함
- 판정: 현 단계 기각하되 **폐기 아님** — 노선 β 의 MCP 호환 도구 표면이 γ 의 전제 조건이므로, Electron 반영 후 Phase 9 에서 부분 채택 (자체 loop 와 병존하는 embed) 을 재평가

#### Risk Threshold Check (인프라 노선)

| 노선                                           | 기술  | 성능  | 유지보수 | 마이그레이션 | HIGH+ 개수 |
| ---------------------------------------------- | :---: | :---: | :------: | :----------: | :--------: |
| α: 자체 로컬 LLM 내장 (원 결정)                |   M   | **H** |  **H**   |      M       |     2      |
| β: 역할별 BYOK + 외부 에이전트 준비 **(선택)** |   L   |   L   |    M     |      L       |     0      |
| γ: 외부 에이전트 전면 위임                     | **H** |   L   |    M     |    **H**     |     2      |

루프 판정: HIGH 0개 노선 (β) 존재. 추가 노선 불필요.

## Decision

**통합 형태 = 대안 A** (2026-05-13, 유지) + **인프라 노선 = 노선 β** (2026-08-18 개정) 채택. ADR-011, ADR-054 모두 Status: Deprecated (Replaced by ADR-134) 후 `completed/` 이동 (완료).

### 위험 수용 근거

- 노선 β 의 MEDIUM 1개 (유지보수 — 역할 슬롯 UX + 키 경계) 는 Gate G1/G2 통과 조건으로 관리
- BYOK 전제로 "키 미설정 시 AI 기능 0" 온보딩 공백이 생김 (R2 재규정) — 설정 UX + 역할 프리셋으로 완화, 기본 제공 모델 (제품 부담 proxy 운영) 도입 여부는 별도 판정
- ADR-011 의 Phase A1~A4 산출물 (도구 7개 + AIPanel + AbortController + G.3) 보존 + 점진 canonical 정합 (원 결정과 동일)

### 기각 사유

- **대안 B/C 기각** (2026-05-13, 유지): 의존 체인 관리 비용 / stale 본문 정정 비용 + 사용자 정정 충돌
- **노선 α 기각** (2026-08-18): 성능·유지보수 HIGH 2개. reference 5개 어디에도 없는 고립 노선으로, 모델 수명주기·하드웨어 매트릭스를 제품이 소유하는 구조적 부담 대비 이득 (폐쇄망 first-class) 은 노선 β 의 로컬 endpoint BYOK 로 동등 달성 가능
- **노선 γ 현 단계 기각** (2026-08-18): Electron 선행 필수 — 웹앱 현 단계에서 차단. 단 노선 β 가 γ 의 전제 (MCP 호환 도구 표면) 를 준비하므로 Phase 9 재평가 대상

### sub-decision D1-D11 (2026-08-18 개정 반영)

- **D1** (개정): LLM Provider 추상화 + **역할별 모델 슬롯** — `LLMProvider.completeWithTools(tools, messages, options)` 통합 시그니처 + **2-way 어댑터** (Anthropic Messages / OpenAI-compatible Chat Completions). Ollama·vLLM·LM Studio 등 로컬 모델은 OpenAI-compatible endpoint 로 포섭 (전용 어댑터 없음). 역할 슬롯 4종 (open-pencil 패턴): `design` (도구 호출·생성) / `review` (Plan·Verify) / `fast` (단순 응답·분류) / `vision` (예약 — 멀티모달은 scope 밖 유지). 슬롯마다 provider / endpoint / 자격증명 / 모델 / reasoning effort 개별 설정. ~~node-llama-cpp 어댑터~~ 제거
- **D2**: AI 도구 canonical 정합 (ADR-011 응용 + ADR-116/122 정합) — 7개 도구 시그니처를 canonical mutation API 경유로 전환:
  - `createElement / updateElement / deleteElement` → `useCanonicalDocumentStore.getState().{setFrames, ...}` 또는 `nodeOpsActions` boundary helper
  - `getEditorState / getSelection / searchElements` → `useCanonicalDocumentStore` read selector
  - `batchDesign` → canonical mutations batch + transactional 패턴
- **D3**: data_tables SSOT 정합 (ADR-132 정합) — AI 데이터 바인딩 도구는 `data_tables.runtimeData` sink + `useCollectionData({ datatableId | dataBinding })` read 진입점만 사용. legacy `Transform 3단계` 도구 제거
- **D4**: events/actions root collection 정합 (ADR-131 정합) — `SerializedEvent / SerializedAction` schema + canonical mutation API. legacy `element.props.events` 도구 제거
- **D5**: frame canonical vocabulary 정합 (ADR-130 정합) — layout container 생성 시 `type: "frame"`. legacy `Group + customId="group_N"` 도구 제거
- **D6** (목적 재규정): 컴포넌트 카탈로그 (RAC / RSP 문서 기반) — 원 목적 (로컬 모델 정확도 보정) 에서 **provider 무관 도메인 지식 주입**으로 재규정. 어느 모델이든 composition 의 컴포넌트 vocabulary / props / catalog 규칙은 컨텍스트 주입 없이는 알 수 없음. Tier 2 동적 주입 (작업 컨텍스트 기반 선택적 로딩) 유지
- **D7** (역할 배선 추가): AI 설계 지능 (Plan→Execute→Verify) — 멀티스텝 대시보드 디자인 + `create_composite` 도구 + 레이아웃 템플릿 + 자기 수정 (max 2회). **역할 슬롯 배선**: Plan/Verify = `review` 슬롯, Execute = `design` 슬롯, 단순 분류·응답 = `fast` 슬롯 (open-pencil Design/Review 분리 정합)
- **D8** (개정): 모델 라우팅 — ~~난이도 기반 로컬/온라인 전환~~ → **역할 기반 슬롯 라우팅** (작업 유형 → 역할 슬롯 선택, D7 배선이 정본). 폐쇄망 = 전 슬롯을 로컬 OpenAI-compatible endpoint 에 바인딩 (Hard Constraint 7 재규정 정합). 난이도 추정·자동 전환 제안·복합 작업 자동 분할은 제거 — 슬롯 구성이 사용자 통제 지점
- **D9**: AIPanel UX 1년차 신입 baseline (ADR-133 정합) — depth 4→2 축소. default 표면 = 자연어 입력 + 도구 실행 결과 시각 피드백 (G.3 보존). 고급 모드 = Plan 단계 시각화 + 자기 수정 표시 + **역할 슬롯 설정** (L4 power user 격리)
- **D10** (신규 2026-08-18): **secret isolation** — `dangerouslyAllowBrowser` 제거 + browser 번들에서 외부 provider 직접 호출 0건 (Hard Constraint 13). BYOK 키 보관·경유 경계: 원격 provider 는 프록시 경유 (Supabase Edge Function 등 — Phase 2 에서 확정), 로컬 endpoint (localhost) 는 직접 호출 허용. 키의 브라우저 저장은 사용자 명시 opt-in (localStorage 평문 금지)
- **D11** (신규 2026-08-18): **외부 에이전트/MCP 준비** — 7+ 도구 정의를 MCP tool schema 와 호환되는 형태 (JSON Schema 파라미터 + 명세 분리) 로 유지. ACP/에이전트 SDK embed (Claude Code / Codex — Pencil.app dual embed·holaOS 하니스·grok-build ACP 패턴) 는 Electron 반영 후 Phase 9 에서 재평가. 도구 표면이 커질 때의 지연 로딩은 grok-build `search_tool`+`use_tool` 패턴 (manifest 안정 = KV cache 보존 — 3중 독립 수렴 확인, XAI_ORG_ANALYSIS §5-1 #1) 을 정본 reference 로 한다

### Phase 0-9 분해 + Gate G1-G7 (2026-08-18 개정)

> 구현 상세: [134-ai-assistant-llm-infrastructure-unification-breakdown.md](design/134-ai-assistant-llm-infrastructure-unification-breakdown.md)

- Phase 0 — inventory baseline freeze (ADR-011 반영 영역 인벤토리 + 4 격차 측정 + Groq 표면 실측)
- Phase 1 — LLM Provider 추상화 + 역할 슬롯 (D1) — **G1**
- Phase 2 — Groq 완전 제거 + secret isolation (D10) — **G2**
- Phase 3 — AI 도구 canonical 정합 (D2) — **G3**
- Phase 4 — data_tables + events/actions + frame canonical 정합 (D3/D4/D5) — **G4**
- Phase 5 — 컴포넌트 카탈로그 (D6) — **G5**
- Phase 6 — AI 설계 지능 Plan→Execute→Verify + 역할 배선 (D7)
- Phase 7 — 역할 슬롯 라우팅 + 폐쇄망 BYOK 검증 (D8) — **G6**
- Phase 8 — AIPanel UX 단순화 1년차 신입 baseline (D9)
- Phase 9 — 외부 코딩 에이전트 통합 (ACP/SDK embed — D11) — **G7** — Electron 마이그레이션 시점 의존

## Risks

| ID  | 위험                                                                                          | 심각도 | 대응                                                                                                                                                 |
| --- | --------------------------------------------------------------------------------------------- | :----: | ---------------------------------------------------------------------------------------------------------------------------------------------------- |
| R1  | Electron 마이그레이션 시점 미확정 → Phase 9 (외부 에이전트 embed) 차단                        |  HIGH  | Phase 1-8 은 Vite 웹앱 환경에서 자립 완결 (BYOK provider 는 웹에서 동작). Phase 9 만 Electron 의존 — Gate G7 으로 분리. 노선 γ 재평가도 이 시점      |
| R2  | (재규정) BYOK 전제 — 키 미설정 사용자는 AI 기능 0 (기본 제공 모델 부재 온보딩 공백)           |  MED   | 최초 실행 설정 UX + 역할 슬롯 프리셋 (Anthropic / OpenAI / 로컬 endpoint 템플릿). 제품 부담 기본 모델 (proxy 운영) 도입은 별도 판정 (scope 밖)       |
| R3  | 컴포넌트 카탈로그 ~311K tok > context 예산                                                    |  MED   | 동적 주입 (작업 컨텍스트 기반 선택적 로딩) + RAG (long-term). Phase 5 G5 통과 조건                                                                   |
| R4  | canonical document mutation API 가 AI 도구 시그니처와 정합 안 됨 (ADR-122 mirror 격하 영역)   |  MED   | Phase 3 G3 — 7개 도구 전수 canonical mutation API 경유 검증 + boundary helper allowlist 외 direct access 0 grep gate                                 |
| R5  | data_tables SSOT 와 dataBinding 도구 시그니처 정합 (ADR-132 Transformer 제거 영역)            |  MED   | Phase 4 G4 — `useCollectionData({ datatableId \| dataBinding })` 통합 진입점 + legacy `Transform 3단계` 도구 제거 검증                               |
| R6  | events/actions root collection 과 AI 이벤트 핸들러 도구 정합 (ADR-131 영역)                   |  MED   | Phase 4 G4 — `SerializedEvent / SerializedAction` schema + canonical mutation API 사용 검증 + legacy `element.props.events` 0                        |
| R7  | AIPanel UX 1년차 신입 baseline 검증 (ADR-133 Q4 확정)                                         |  MED   | Phase 8 evaluator agent screenshot 검증 + depth 4→2 축소 measure                                                                                     |
| R8  | Provider 별 Tool Calling format 차이 (Anthropic tool use / OpenAI function calling)           |  MED   | `LLMProvider.completeWithTools` 통합 시그니처 + 2-way 어댑터 표준화 (4-way → 2-way 축소로 원 위험 대비 완화)                                         |
| R9  | groq-sdk 완전 제거 시 기존 Phase A1~A4 산출물 회귀                                            |  MED   | Phase 2 G2 — 대체 provider (역할 슬롯 경유) 로 기존 7개 도구 전수 통과 + AbortController + G.3 시각 피드백 보존                                      |
| R10 | (재규정) 폐쇄망 = 로컬 endpoint BYOK — endpoint 품질·모델 선택이 사용자 소관이 되어 결과 편차 |  MED   | Phase 7 G6 — Ollama OpenAI-compatible endpoint 로 7 도구 전수 통과 1회 실측 + 로컬 endpoint 설정 가이드 문서화. 모델별 품질 보증은 제품 책임 아님    |
| R11 | Phase scope inflation (단일 ADR 9 Phase + 4 격차 영역 → 1.5x gap 가능성)                      |  MED   | [adr-writing.md M4](rules) — Phase scope inflation 1.5x 시 사용자 confirm 의무. Phase 별 design breakdown freeze                                     |
| R12 | (신규) 원격 provider 프록시 경계 부재 시 BYOK 키 브라우저 노출 재발 (Groq 사례 반복)          |  MED   | Phase 2 G2 — `dangerouslyAllowBrowser` 0 + browser 번들 내 원격 provider 직접 호출 0 grep gate. 프록시 방식 (Supabase Edge Function 등) Phase 2 확정 |

잔존 HIGH 위험 1개 (R1) → Gate G7 로 관리.

## Gates

| Gate | 시점         | 통과 조건                                                                                                                                | 실패 시 대안                                                    |
| ---- | ------------ | ---------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------- |
| G1   | Phase 1 완료 | `LLMProvider` 추상화 + 2-way 어댑터 (Anthropic / OpenAI-compatible) + 역할 슬롯 4종 설정 모델 반영 (Ollama 는 OpenAI-compatible 로 통과) | Provider 인터페이스 재설계                                      |
| G2   | Phase 2 완료 | `groq-sdk` 0 grep + `dangerouslyAllowBrowser` 0 grep + browser 번들 원격 provider 직접 호출 0 + 대체 provider 로 7개 도구 전수 통과      | 키 경유 방식 재설계 (프록시 ↔ 로컬 gateway), fallback 단계 추가 |
| G3   | Phase 3 완료 | 7개 도구 canonical mutation API 경유 + boundary helper allowlist 외 direct access 0 grep gate                                            | mutation API 확장 (frame/slot/componentSemantics 추가 등)       |
| G4   | Phase 4 완료 | data_tables + events/actions + frame canonical 정합 검증 + legacy 도구 제거 + grep gate                                                  | 도구 시그니처 재설계, legacy 잔존물 cleanup phase 추가          |
| G5   | Phase 5 완료 | 컴포넌트 카탈로그 Props 정확도 ≥ 90% (RAC / RSP 문서 기반 검증, `design` 슬롯 기준 모델)                                                 | 카탈로그 형식 재설계, 동적 주입 전략 변경 (RAG 도입)            |
| G6   | Phase 7 완료 | 역할 슬롯 라우팅 (D7 배선) 동작 + 폐쇄망 시나리오 — 전 슬롯 로컬 endpoint 바인딩으로 7 도구 통과 1회 실측                                | 슬롯 구성 UX 보강, 로컬 endpoint 가이드 확충                    |
| G7   | Phase 9 완료 | 외부 에이전트 (ACP/SDK) embed 1종 이상 + MCP 도구 표면으로 composition 조작 실측 + Canvas 60fps 유지 (R1 HIGH 위험 통과)                 | Phase 9 보류, Phase 1-8 자립 운영 유지 (BYOK provider 기본)     |

## Consequences

### Positive

- **reference 수렴 노선**: Pencil.app / openpencil / open-pencil / holaOS / grok-build 5개 reference 와 같은 방향 — 교차 검증 가능한 패턴 (역할별 모델 / BYOK / ACP·MCP / 도구 지연 로딩), 고립 노선의 모델 수명주기 부담 소멸
- **단일 진입점**: `LLMProvider` 통합 인터페이스 + 역할 슬롯으로 원격/로컬 모델 자유 전환 — 폐쇄망은 로컬 endpoint 바인딩으로 동등 달성
- **canonical document 정합**: AI 가 `CompositionDocument` 의 frame / slot / componentSemantics / events / actions 영역 mutation 가능 — ADR-116/122/130/131 반영 영역 활용
- **data_tables SSOT 정합**: `useCollectionData({ datatableId | dataBinding })` 통합 read 진입점 + `data_tables.runtimeData` sink — ADR-132 정합
- **events/actions root collection 정합**: `SerializedEvent / SerializedAction` schema — ADR-131 정합
- **groq-sdk 완전 제거 + secret isolation**: 벤더 종속 해소 + `dangerouslyAllowBrowser: true` 제거가 1급 결정 (Hard Constraint 13) 으로 승격 — API 키 브라우저 노출 구조 재발 차단
- **컴포넌트 카탈로그**: provider 무관 도메인 지식 주입 — 어느 모델이든 composition vocabulary 정확도 확보
- **AI 설계 지능**: Plan→Execute→Verify + 역할 배선 (review/design/fast) + 자기 수정 (max 2회)
- **외부 에이전트 확장로**: MCP 호환 도구 표면이 Phase 9 (Claude Code / Codex embed) 와 노선 γ 재평가의 전제를 준비
- **AIPanel UX 1년차 신입 baseline**: depth 4→2 축소 (ADR-133 정합)

### Negative

- **BYOK 온보딩 공백**: 키/endpoint 미설정 사용자는 AI 기능 0 (R2) — 원 노선의 "로컬 모델 내장 = 설정 없는 기본 경험" 은 포기. 기본 제공 모델 (proxy 운영) 은 별도 판정
- 9 Phase 작업 분량 + 4 격차 영역 동시 정합 — single ADR scope 큼 (R11)
- Electron 시점 미확정으로 Phase 9 (외부 에이전트 embed) 차단 (R1 HIGH 보존 — 단 원 노선과 달리 Phase 1-8 이 제품 완결)
- 폐쇄망 품질이 사용자 로컬 endpoint 선택에 의존 (R10) — 제품이 모델 품질을 보증하지 않음
- 원격 provider 프록시 (Supabase Edge Function 등) 운영 표면 추가 (R12)
- 컴포넌트 카탈로그 유지보수 — RAC / RSP 업데이트 시 재생성 필요 (원 결정과 동일 부담)

## supersede / 폐기 관계

- **ADR-011 → Deprecated** (Replaced by ADR-134) — Phase A1~A4 산출물 (도구 7개 + AIPanel + AbortController + G.3) 은 본 ADR Phase 2 에서 보존 + canonical 정합 Phase 3-4 에서 점진 mutation API 교체
- **ADR-054 → Deprecated** (Replaced by ADR-134) — Proposed 영역 중 Provider 추상화 / 폐쇄망은 본 ADR Phase 1/7 에 흡수 (2026-08-18 노선 개정으로 재규정), **Ollama 전용 어댑터 / node-llama-cpp 내장 / Qwen 모델 고정 / 난이도 라우팅은 노선 α 기각과 함께 승계 종료**

## 개정 이력

| 날짜       | 내용                                                                                                                                                                                                                       |
| ---------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 2026-05-13 | 최초 작성 — ADR-011 + ADR-054 단일 통합, 노선 α (자체 로컬 LLM 내장), 설계 문서만 반영                                                                                                                                     |
| 2026-08-18 | 노선 재결정 (사용자 재제기) — 노선 α 기각 → 노선 β (역할별 BYOK + 외부 에이전트/MCP 준비). 격차 5 추가, Hard Constraint 4 삭제·7 재규정·13 추가, D1/D8 개정, D10/D11 신규                                                  |
| 2026-08-18 | 수렴 근거 보강 — xai-org 9개 저장소 분석 (XAI_ORG_ANALYSIS.md) 반영: grok-build 를 격차 5 의 5번째 수렴 사례로 추가 (reference 4→5개), D11 에 도구 지연 로딩 (`search_tool`+`use_tool`, 3중 독립 수렴) 정본 reference 명시 |

## 관련

- 본문 design: [design/134-ai-assistant-llm-infrastructure-unification-breakdown.md](design/134-ai-assistant-llm-infrastructure-unification-breakdown.md)
- 노선 재결정 근거: [PENCIL_ECOSYSTEM_ANALYSIS.md](../explanation/research/PENCIL_ECOSYSTEM_ANALYSIS.md) (§5 비교 매트릭스 / §8 차용 후보 4·7·12·17 / §9-5 AI productization / §10 acceptance criteria) + [OPENPENCIL_DETAIL.md](../explanation/research/OPENPENCIL_DETAIL.md) + [HOLAOS_ANALYSIS.md](../explanation/research/HOLAOS_ANALYSIS.md) (§3 하니스 추상화·BYOK·deferred tool gateway / §4 노선 β 정합 표 / §5 차용 후보) + [XAI_ORG_ANALYSIS.md](../explanation/research/XAI_ORG_ANALYSIS.md) (§2 grok-build 하니스 실측 / §5-1 ADR-134 매핑 8건 — 도구 지연 로딩·capability 술어·retry 스펙·프롬프트 템플릿·compaction·권한 파이프라인 / §5-2 marketplace 배포 계약)
- 폐기 대상: [completed/011-ai-assistant-design.md](completed/011-ai-assistant-design.md) / [completed/054-local-llm-architecture.md](completed/054-local-llm-architecture.md)
- 정합 ADR: ADR-116 / ADR-122 (canonical document) / ADR-130 (frame) / ADR-131 (events/actions root) / ADR-132 (useCollectionData) / ADR-133 (AIPanel UX 1년차 신입 baseline)
- 동일 패턴: ADR-133 (3 ADR Deprecated + 통합 신규 ADR + 설계 문서 먼저 + Phase 실행 사용자 review 후)
