# ADR-134: AI Assistant 차세대 아키텍처 — LLM 인프라 + 도구/UI 통합

## Status

Proposed — 2026-05-13

> **plan-only land**: 본문 + design breakdown + 기존 ADR Deprecated mv 까지만 land. Phase 0-9 실행 작업 + 코드 변경은 사용자 plan review 후 별 step ([[adr133-events-panel-simplification-plan]] 동일 패턴).

## Context

composition AI 어시스턴트의 두 선행 ADR — [ADR-011](completed/011-ai-assistant-design.md) (AI Assistant 설계, 2026-01-31) + [ADR-054](completed/054-local-llm-architecture.md) (로컬 LLM 아키텍처, 2026-04-05) — 는 본 ADR 발의 시점 (2026-05-13) 기준 다음 시스템 격차로 인해 폐기 후 통합 재설계가 필요하다.

### 격차 1 — canonical document SSOT 미반영 (ADR-011 응용 영역)

ADR-011 의 7개 도구 (createElement / updateElement / deleteElement / getEditorState / getSelection / searchElements / batchDesign) 는 작성 시점 (2026-01-31) 의 legacy elementsMap/childrenMap mutable subscription 기반. 본 ADR 발의 시점 기준 land 된 정합 영역 미반영:

- **ADR-116 canonical document SSOT** (Implemented 2026-05-02) — `CompositionDocument` schema + Frame/Slot/ComponentSemantics 1차 필드 + boundary helper (frameMirror / slotMirror / componentSemanticsMirror) allowlist
- **ADR-122 canonical-only runtime** (Implemented 2026-05-09) — Builder hot path 의 mutable `elementsMap`/`childrenMap` subscription 0건, canonical store + read-only derived snapshot 갈음
- **ADR-131 events/actions root collection** (Implemented 2026-05-13) — `SerializedEvent / SerializedAction` + `useEventsForTarget` / `useDocumentActions` / `useCanonicalDocumentStore` mutation API
- **ADR-130 Frame canonical vocabulary** (Implemented 2026-05-13) — `frame` type + `FrameNode` 1차 필드 (Group 응용에서 분리)

ADR-011 의 도구 시그니처 (`createElement(tag, props, parentId)`) 는 legacy element-level mutation 만 다루며, canonical `CompositionDocument` 의 frame / slot / componentSemantics / events / actions 영역 mutation 미지원. AI 가 frame layout container 또는 component instance/slot 을 만들 수 없음.

### 격차 2 — data_tables SSOT 미반영 (ADR-011 데이터 바인딩 격차)

ADR-011 Section 1.3.3 의 "데이터 바인딩 격차" (Mock 엔드포인트 30+ 누락 / DataBinding 3단계 타입 / DataTable 프리셋 18종 / Transform 3단계) 는 본 ADR 발의 시점 기준 SSOT 정합 미반영:

- **`data_tables` 가 데이터 SSOT** ([[project-data-tables-ssot-framing]] 사용자 framing 2026-05-13) — `useCollectionData({ datatableId | dataBinding })` 통합 read 진입점
- **ADR-132 useCollectionData useAsyncList 정합** (Implemented 2026-05-13) — collections rename + Transformer 제거 + `data_tables → collections` schema 정정. ADR-011 의 "Transform 3단계" 가 본 ADR Phase 7 에서 전수 제거됨
- **API endpoint sink** — `endpoint.targetDataTable` → `data_tables.runtimeData` (사용자 framing 영역)

ADR-011 의 `bindings` 도구 디자인은 legacy `{ type: "dataTable", field: "name" }` 필드 매핑만 다루며, ADR-132 land 된 `data_tables → collections` 정합 + `useAsyncList` patch/move/remove 표준 callback 미지원.

### 격차 3 — Provider 추상화 + Electron 시점 미확정 (ADR-054 base 영역)

ADR-054 Proposed (2026-04-05) 의 대안 A (Ollama → node-llama-cpp + 온라인 모델 선택) 는 본 ADR 발의 시점 기준 land 0건 (Proposed 상태 유지). Electron 마이그레이션 시점 미확정 (ADR-054 Soft Constraint 1) 이 해소되지 않은 상태에서 Phase 3 (node-llama-cpp 내장) 차단 위험. 또한 ADR-054 의 Hard Constraint (`groq-sdk` 완전 제거 + Provider 추상화 + 폐쇄망 + 컴포넌트 카탈로그 Tier 2 주입) 와 ADR-011 의 Phase A1~A4 land 산출물 (도구 7개 + AIPanel + AbortController + G.3) 의 정합 합의 부재.

### 격차 4 — AIPanel UX (ADR-133 정합 미반영)

ADR-011 의 AIPanel (ChatMessage / ChatInput / ChatContainer / ToolCallMessage / AgentControls) 은 [[adr133-events-panel-simplification-plan]] (Proposed 2026-05-13) 의 "1년차 신입 개발자 baseline" mental model 미반영. ADR-133 Q4 사용자 framing "1년차 신입 개발자라도 사용할 수준이어야한다" 가 AI 도구 UX 에도 적용되어야 함.

### Hard Constraints

ADR-054 Hard Constraints 7개 유지:

1. Canvas 60fps 유지 — LLM 추론이 렌더링 스레드를 차단하면 안 됨
2. 기존 7개 AI 도구와 호환 + 확장 + canonical document mutation API 정합
3. Tool Calling 지원 — 자연어 → 도구 호출 패턴 핵심
4. Apple Silicon 16GB 에서 실행 가능 (Qwen3 14B Q4_K_M), **36GB 권장** (Qwen3.5-35B-A3B)
5. 초기 앱 번들 < 500KB — LLM 모델은 별도 다운로드/관리
6. RAC / RSP 문서 기반 정확한 props 설정 — 잘못된 prop 조합 생성 금지
7. **폐쇄망 지원** — 인터넷 불가 환경에서도 로컬 모델만으로 기본 AI 기능 동작

본 ADR 추가 Hard Constraints (canonical / data_tables / events 정합):

8. **canonical document mutation API 만 사용** — legacy `elementsMap` / `childrenMap` direct write 금지. AI 도구는 `useCanonicalDocumentStore.getState().{setFrames, setSlots, setEvents, setActions, ...}` 또는 boundary helper allowlist 경유
9. **`data_tables` 데이터 SSOT 정합** — AI 가 데이터 바인딩 도구 호출 시 `data_tables.runtimeData` sink + `useCollectionData({ datatableId | dataBinding })` read 진입점만 사용
10. **events/actions root collection 정합** — AI 가 이벤트 핸들러 생성 시 `SerializedEvent / SerializedAction` schema + canonical mutation API 사용
11. **frame canonical vocabulary 정합** — layout container 생성 시 `type: "frame"` (Group 응용 흡수 금지)
12. **AIPanel UX 1년차 신입 baseline** — ADR-133 Q4 framing 정합

### 3-domain 분할 (SSOT 체인 정본)

[SSOT 체인 정본](/.claude/rules/ssot-hierarchy.md) 3-domain 기준 본 ADR scope:

- **D1 DOM/접근성**: RAC 절대 권위 유지 — AI 도구가 출력하는 DOM 구조는 RAC 컴포넌트 사용 (수정/확장 금지)
- **D2 Props/API**: AI 가 RAC / RSP 문서 기반 정확한 props 설정 — Tool Calling 의 핵심 영역
- **D3 시각 스타일**: Spec SSOT — AI 가 스타일 변경 시 `style` props 만 mutate, `composition.spec.ts` 직접 편집 금지

## framing checkpoint 4 질문 lock-in

> [adr-writing.md §ADR Fork / 분리 결정 시 framing checkpoint](/.claude/rules/adr-writing.md) 의 4 질문 통과. 사용자 explicit confirm 1회 받음 (Q1 "단일 통합 ADR 1개" + Q2 "plan-only land"). [feedback-no-derived-adr-mid-execution](memory) + [feedback-adr-consolidation-burden-not-essence](memory) 차단 카테고리 자기-인용 통과.

### Q1: base / 응용 분류

- **ADR-054 = base** (LLM 인프라 / Provider 추상화 / Ollama→node-llama-cpp / Electron Utility Process / 모델 라우팅 / 폐쇄망)
- **ADR-011 = 응용** (AI 도구 7개 / 시스템 프롬프트 / AIPanel UI / 컴포넌트 지식 격차 / 레이아웃 격차 / 데이터 바인딩 격차)
- **결정**: base + 응용을 **단일 ADR-134 안 Phase 분해** (사용자 explicit confirm Q1)

### Q2: schema 직교성

- Provider 추상화 (`LLMProvider`) ↔ AI 도구 (`createElement` / `updateElement` / ...) — **직교 specialization**
- ADR-054 의 `LLMProvider.completeWithTools(tools, messages)` 가 base 인터페이스
- ADR-011 의 `7 tool definitions + AgentLoop + AIPanel` 이 응용 implementation

### Q3: baseline framing reverse 검증

- 기존 baseline: ADR-054 supersedes ADR-011 (단일 supersede 관계)
- 사용자 framing 정정 (2026-05-13): **두 ADR 모두 폐기 + ADR-134 통합 발의** (단순 supersede 가 아니라 system 정합 격차 해소 목적)
- baseline framing 자동 승계 금지 — fork 시점에 4 격차 (canonical / data_tables / events / AIPanel UX) 별도 검증 완료

### Q4: fork 분리 vs 단일 통합

- 사용자 explicit confirm: **단일 통합 ADR 1개** (Q1 답변 "단일 통합 ADR 1개")
- 동기 분류: "발의 부담 절약" 아님 — base + 응용 영역이 4 격차 영역과 동시 정합 필요 ([[feedback-adr-consolidation-burden-not-essence]] 차단 통과)

## Alternatives Considered

### 대안 A: ADR-054 base + ADR-011 응용 → ADR-134 단일 통합 (선택)

- 설명: ADR-054 의 Provider 추상화 (base) + ADR-011 의 도구/UI (응용) 영역을 단일 ADR-134 안 Phase 분해. 4 격차 (canonical / data_tables / events / AIPanel UX) 와 동시 정합. 본 ADR 안에 LLM Provider Phase + AI 도구 canonical 정합 Phase + 컴포넌트 카탈로그 Phase + AIPanel UX Phase 모두 포함
- 근거: ADR-133 동일 패턴 (3 ADR Deprecated + 통합 신규 ADR) + 4 격차 영역이 응용/base 분리해도 동일 사용자 framing decision 적용 필요 → 분리 fork 시 의존 체인 관리 비용 (ADR-N base → ADR-M 응용) 이 통합 대비 높음
- 위험:
  - 기술: **MEDIUM** — Electron 시점 미확정 → Phase 9 (node-llama-cpp 내장) 차단 위험은 ADR-054 와 동일
  - 성능: **MEDIUM** — 로컬 모델 BFCL tool calling 정확도 ≤ 75% (Qwen3.5-35B-A3B 권장 73%) — ADR-054 동일
  - 유지보수: **MEDIUM** — 단일 ADR scope 9 Phase + 4 격차 영역 — Phase 별 명확한 경계 + Gate 통과 조건 필요
  - 마이그레이션: **LOW** — ADR-011 의 Phase A1~A4 land 산출물 (도구 7개 + AIPanel + AbortController + G.3) 은 보존 + canonical 정합 Phase 에서 점진 mutation API 교체

### 대안 B: ADR-N base (LLM 인프라) + ADR-M 응용 (AI 도구/UI) 분리 fork

- 설명: ADR-054 영역을 ADR-N base 로 리브랜드, ADR-011 응용 영역을 ADR-M 신규 발의. 두 ADR 의 의존 체인을 명시. ADR-N → ADR-M prerequisite 관계
- 근거: framing checkpoint Q1 base/응용 분류 권장 패턴 (ADR-111/112 사례 정합)
- 위험:
  - 기술: **MEDIUM** — 대안 A 와 동일
  - 성능: **MEDIUM** — 대안 A 와 동일
  - 유지보수: **HIGH** — 2 ADR 발의 + 의존 체인 관리. 4 격차 (canonical / data_tables / events / AIPanel UX) 가 base/응용 어느 ADR 에 속하는지 추가 의사결정 필요. 격차 1-4 가 응용 영역에 가까우나 base 영역의 Provider 인터페이스에도 영향
  - 마이그레이션: **MEDIUM** — base ADR land 완료 후 응용 ADR 진입 → AI 개발 병렬성 손실

### 대안 C: ADR-011 만 Deprecated + ADR-054 Proposed 유지 후 신규 응용 ADR

- 설명: ADR-054 Proposed (Risk-First 템플릿 + design breakdown 존재) 유지 + ADR-011 만 Deprecated. 신규 응용 ADR (AI 도구 / UI) 1개 발의
- 근거: ADR-054 는 2026-04-05 작성으로 비교적 최근 + Risk-First 템플릿 정합 + design breakdown 2360 lines 존재 (재사용 가치)
- 위험:
  - 기술: **MEDIUM** — ADR-054 의 Hard Constraint 7개 + Soft Constraint 가 4 격차 (canonical / data_tables / events / AIPanel UX) 미반영
  - 성능: **MEDIUM** — 대안 A 와 동일
  - 유지보수: **HIGH** — ADR-054 본문 + design 2360 lines 가 본 ADR 발의 시점 기준 stale 영역 (Pencil AI 분석 + Groq SDK 분석 + Phase 1-7 영역) 다수. 일부 보존 + 일부 정정 시 본문 정합성 회복 비용 큼
  - 마이그레이션: **MEDIUM** — ADR-054 의 Phase 가 응용 ADR 의 Phase 와 의존 — 분리 의사결정 비용
- 사용자 framing 정정: "기존 계획은 폐기후 신규 ADR 을 생성하는것이 맞다고본다" 와 충돌 (ADR-054 유지 의도 가능성은 사용자 framing 에서 명시 거부)

### Risk Threshold Check

| 대안                                                    | 기술 | 성능 | 유지보수 | 마이그레이션 | HIGH+ 개수 |
| ------------------------------------------------------- | :--: | :--: | :------: | :----------: | :--------: |
| A: ADR-054 + ADR-011 → ADR-134 단일 통합 **(선택)**     |  M   |  M   |    M     |      L       |     0      |
| B: ADR-N base + ADR-M 응용 분리 fork                    |  M   |  M   |  **H**   |      M       |     1      |
| C: ADR-054 유지 + ADR-011 만 Deprecated + 신규 응용 ADR |  M   |  M   |  **H**   |      M       |     1      |

- 대안 A: HIGH 0개 — 4 격차 영역 동시 정합 + 사용자 framing Q1 정합 ("단일 통합 ADR 1개")
- 대안 B: HIGH 1개 — 2 ADR 의존 체인 관리 비용. framing checkpoint Q1 base/응용 권장이나 사용자 explicit confirm 가 단일 통합
- 대안 C: HIGH 1개 — ADR-054 본문 stale 영역 정정 비용 + 사용자 framing 충돌

루프 판정: HIGH 0개 대안 (A) 존재. 추가 대안 불필요.

## Decision

**대안 A: ADR-054 base + ADR-011 응용 → ADR-134 단일 통합** 채택. ADR-011, ADR-054 모두 Status: Deprecated (Replaced by ADR-134) 후 `completed/` 이동.

### 위험 수용 근거

- **MEDIUM 위험 3개** (기술/성능/유지보수) 는 ADR-054 와 동일한 영역. Phase 별 Gate 통과 조건 + 사용자 framing 정합 (1년차 신입 baseline) 으로 관리 가능
- LOW 위험 1개 (마이그레이션) — ADR-011 의 Phase A1~A4 land 산출물 (도구 7개 + AIPanel + AbortController + G.3) 보존 + 점진 canonical 정합

### 기각 사유

- **대안 B 기각**: framing checkpoint Q1 base/응용 분류는 권장이나, 4 격차 (canonical / data_tables / events / AIPanel UX) 가 base/응용 어느 영역에 속하는지 추가 의사결정 비용 발생. 사용자 explicit confirm 가 단일 통합
- **대안 C 기각**: ADR-054 본문 2360 lines (design 포함) 가 본 ADR 발의 시점 기준 stale 영역 다수. 정정 비용이 신규 ADR 발의 비용보다 큼. 사용자 framing "기존 계획은 폐기후 신규 ADR" 과 충돌

### sub-decision D1-D9

- **D1**: LLM Provider 추상화 (ADR-054 base 흡수) — `LLMProvider` 인터페이스 + 4-way 구현 (Ollama / node-llama-cpp / Anthropic / OpenAI-compatible). `completeWithTools(tools, messages, options)` 통합 시그니처
- **D2**: AI 도구 canonical 정합 (ADR-011 응용 + ADR-116/122 정합) — 7개 도구 시그니처를 canonical mutation API 경유로 전환:
  - `createElement / updateElement / deleteElement` → `useCanonicalDocumentStore.getState().{setFrames, ...}` 또는 `nodeOpsActions` boundary helper
  - `getEditorState / getSelection / searchElements` → `useCanonicalDocumentStore` read selector
  - `batchDesign` → canonical mutations batch + Pencil-style transactional 패턴
- **D3**: data_tables SSOT 정합 (ADR-011 데이터 바인딩 격차 + ADR-132 정합) — AI 가 데이터 바인딩 도구 호출 시 `data_tables.runtimeData` sink + `useCollectionData({ datatableId | dataBinding })` read 진입점만 사용. legacy `Transform 3단계` 도구 제거 (ADR-132 Phase 4 정합)
- **D4**: events/actions root collection 정합 (ADR-131 정합) — AI 가 이벤트 핸들러 생성 시 `SerializedEvent / SerializedAction` schema + `useCanonicalDocumentStore.getState().{setEvents, setActions, ...}` 사용. legacy `element.props.events` 도구 제거
- **D5**: frame canonical vocabulary 정합 (ADR-130 정합) — AI 가 layout container 생성 시 `type: "frame"` (Group 응용 흡수 금지). legacy `Group + customId="group_N"` 도구 제거
- **D6**: 컴포넌트 카탈로그 (RAC / RSP 문서 기반 — ADR-054 흡수) — Tier 2 동적 주입 패턴 (Qwen3 128K context). 컴포넌트별 md 문서 ~311K tok 를 작업 컨텍스트에 따라 선택적 주입
- **D7**: AI 설계 지능 (Plan→Execute→Verify) — 멀티스텝 대시보드 디자인. `create_composite` 도구 + 레이아웃 템플릿 + 자기 수정 (max 2회). Pencil/Google Stitch 참조
- **D8**: 모델 라우팅 (난이도 기반 자동 전환 — ADR-054 흡수) — 단순 작업 (단일 도구 호출) 로컬 모델, 복합 작업 (대시보드 설계) 온라인 모델 전환 자동 제안. 폐쇄망에서 복합 작업 자동 분할
- **D9**: AIPanel UX 1년차 신입 baseline (ADR-133 정합) — depth 4→2 축소. default 표면 = 자연어 입력 + 도구 실행 결과 시각 피드백 (G.3 보존). 고급 모드 = Plan 단계 시각화 + 자기 수정 표시 (L4 power user 격리)

### Phase 0-9 분해 + Gate G1-G7

> 구현 상세: [134-ai-assistant-llm-infrastructure-unification-breakdown.md](design/134-ai-assistant-llm-infrastructure-unification-breakdown.md)

- Phase 0 — inventory baseline freeze (ADR-011 land 영역 인벤토리 + ADR-054 Proposed 영역 인벤토리 + 4 격차 측정)
- Phase 1 — LLM Provider 추상화 layer (D1) — **G1**
- Phase 2 — Groq 완전 제거 + Ollama Provider 1st (D1) — **G2**
- Phase 3 — AI 도구 canonical 정합 (D2) — **G3**
- Phase 4 — data_tables + events/actions + frame canonical 정합 (D3/D4/D5) — **G4**
- Phase 5 — 컴포넌트 카탈로그 (D6) — **G5**
- Phase 6 — AI 설계 지능 Plan→Execute→Verify (D7)
- Phase 7 — 모델 라우팅 + 폐쇄망 (D8) — **G6**
- Phase 8 — AIPanel UX 단순화 1년차 신입 baseline (D9)
- Phase 9 — Electron Utility Process 내장 (node-llama-cpp) — **G7** — Electron 마이그레이션 시점 의존

## Risks

| ID  | 위험                                                                                         | 심각도 | 대응                                                                                                                            |
| --- | -------------------------------------------------------------------------------------------- | :----: | ------------------------------------------------------------------------------------------------------------------------------- |
| R1  | Electron 마이그레이션 시점 미확정 → Phase 9 차단                                             |  HIGH  | Phase 1-8 은 Vite 웹앱 환경에서 land 가능 (Ollama REST API). Phase 9 만 Electron 의존 — Gate G7 으로 분리                       |
| R2  | 로컬 모델 BFCL tool calling 정확도 ≤ 75%                                                     |  MED   | Qwen3.5-35B-A3B 권장 (BFCL 73%), 16GB MacBook Air 는 Qwen3 14B (BFCL 68%) 한정. 컴포넌트 카탈로그 Tier 2 주입으로 +15~20%p 보정 |
| R3  | 컴포넌트 카탈로그 ~311K tok > 128K context                                                   |  MED   | 동적 주입 (작업 컨텍스트 기반 선택적 로딩) + RAG (long-term). Phase 5 G5 통과 조건                                              |
| R4  | canonical document mutation API 가 AI 도구 시그니처와 정합 안 됨 (ADR-122 mirror 격하 영역)  |  MED   | Phase 3 G3 — 7개 도구 전수 canonical mutation API 경유 검증 + boundary helper allowlist 12 site 외 direct access 0 grep gate    |
| R5  | data_tables SSOT 와 dataBinding 도구 시그니처 정합 (ADR-132 Transformer 제거 영역)           |  MED   | Phase 4 G4 — `useCollectionData({ datatableId \| dataBinding })` 통합 진입점 + legacy `Transform 3단계` 도구 제거 검증          |
| R6  | events/actions root collection 과 AI 이벤트 핸들러 도구 정합 (ADR-131 영역)                  |  MED   | Phase 4 G4 — `SerializedEvent / SerializedAction` schema + canonical mutation API 사용 검증 + legacy `element.props.events` 0   |
| R7  | AIPanel UX 1년차 신입 baseline 검증 (ADR-133 Q4 framing)                                     |  MED   | Phase 8 evaluator agent screenshot 검증 + depth 4→2 축소 measure                                                                |
| R8  | Provider 별 Tool Calling format 차이 (Ollama function calling / Anthropic tool use / OpenAI) |  MED   | `LLMProvider.completeWithTools` 통합 시그니처 + 어댑터 (Ollama / Claude / OpenAI-compatible 3-way 표준화)                       |
| R9  | groq-sdk 완전 제거 시 기존 Phase A1~A4 land 산출물 회귀                                      |  MED   | Phase 2 G2 — Ollama Provider 로 기존 7개 도구 전수 통과 + AbortController + G.3 시각 피드백 보존                                |
| R10 | 폐쇄망 환경 검증 (오프라인 first-class)                                                      |  MED   | Phase 7 G6 — 인터넷 미연결 환경에서 로컬 모델만으로 단순 작업 100% / 복합 작업 자동 분할 검증                                   |
| R11 | Phase scope inflation (단일 ADR 9 Phase + 4 격차 영역 → 1.5x gap 가능성)                     |  MED   | [adr-writing.md M4](rules) — Phase scope inflation 1.5x 시 사용자 confirm 의무. Phase 별 design breakdown freeze                |

잔존 HIGH 위험 1개 (R1) → Gate G7 로 관리.

## Gates

| Gate | 시점         | 통과 조건                                                                                                | 실패 시 대안                                                |
| ---- | ------------ | -------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------- |
| G1   | Phase 1 완료 | `LLMProvider` 추상화 layer + 4-way 어댑터 (Ollama / node-llama-cpp / Anthropic / OpenAI-compatible) land | Provider 인터페이스 재설계                                  |
| G2   | Phase 2 완료 | `groq-sdk` 완전 제거 + Ollama Provider 로 기존 7개 도구 전수 통과 (AbortController + G.3 보존)           | Provider 인터페이스 재설계, fallback 단계 추가              |
| G3   | Phase 3 완료 | 7개 도구 canonical mutation API 경유 + boundary helper allowlist 외 direct access 0 grep gate            | mutation API 확장 (frame/slot/componentSemantics 추가 등)   |
| G4   | Phase 4 완료 | data_tables + events/actions + frame canonical 정합 검증 + legacy 도구 제거 + grep gate                  | 도구 시그니처 재설계, legacy 잔존물 cleanup phase 추가      |
| G5   | Phase 5 완료 | 컴포넌트 카탈로그 Props 정확도 ≥ 90% (RAC / RSP 문서 기반 검증)                                          | 카탈로그 형식 재설계, 동적 주입 전략 변경 (RAG 도입)        |
| G6   | Phase 7 완료 | 폐쇄망 환경 단순 작업 100% / 복합 작업 자동 분할 검증 + 모델 라우팅 정확도 측정                          | 라우팅 규칙 보강, 복합 작업 분할 알고리즘 재설계            |
| G7   | Phase 9 완료 | node-llama-cpp Utility Process 내장 + Canvas FPS 60fps 유지 (±5fps 이내, R1 HIGH 위험 통과)              | Phase 9 보류, Phase 1-8 stand-alone 유지 (Ollama 기본 운영) |

## Consequences

### Positive

- **단일 진입점**: `LLMProvider` 통합 인터페이스로 로컬/온라인 모델 자유 전환 (Pencil / Google Stitch 패턴 정합)
- **canonical document 정합**: AI 가 `CompositionDocument` 의 frame / slot / componentSemantics / events / actions 영역 mutation 가능 — ADR-116/122/130/131 land 영역 활용
- **data_tables SSOT 정합**: AI 가 `useCollectionData({ datatableId | dataBinding })` 통합 read 진입점 + `data_tables.runtimeData` sink 사용 — ADR-132 정합
- **events/actions root collection 정합**: AI 가 `SerializedEvent / SerializedAction` schema 사용 — ADR-131 정합
- **groq-sdk 완전 제거**: 벤더 종속 해소 + `dangerouslyAllowBrowser: true` 제거 (API 키 브라우저 노출 위험 해소)
- **컴포넌트 카탈로그**: RAC / RSP 문서 기반 props / variant / size 정확한 설정 — Tier 2 동적 주입 (Qwen3 128K context)
- **AI 설계 지능**: Plan→Execute→Verify + 자기 수정 (max 2회) → 대시보드 수준 멀티스텝 디자인 가능
- **폐쇄망 지원**: 로컬 모델만으로 단순 작업 100% / 복합 작업 자동 분할
- **AIPanel UX 1년차 신입 baseline**: depth 4→2 축소 (ADR-133 정합)

### Negative

- 9 Phase 작업 분량 + 4 격차 영역 동시 정합 — single ADR scope 큼 (Phase scope inflation R11 위험)
- Electron 시점 미확정으로 Phase 9 차단 (R1 HIGH 위험 보존)
- 권장 하드웨어 36GB RAM — 16GB 에서는 14B 모델로 제한적 (ADR-054 와 동일 제약)
- 복합 디자인 (대시보드 수준) 로컬 모델 한계 (T2 72%) — 난이도 라우팅으로 완화
- 컴포넌트 카탈로그 유지보수 — RAC / RSP 업데이트 시 재생성 필요 (ADR-054 와 동일 부담)
- 다수 Provider 유지보수 — Ollama / LlamaCpp / Anthropic / OpenAI-compatible 4-way

## supersede / 폐기 관계

- **ADR-011 → Deprecated** (Replaced by ADR-134) — Phase A1~A4 land 산출물 (도구 7개 + AIPanel + AbortController + G.3) 은 본 ADR Phase 2 (Groq 제거 + Ollama Provider 1st) 에서 보존 + canonical 정합 Phase 3-4 에서 점진 mutation API 교체
- **ADR-054 → Deprecated** (Replaced by ADR-134) — Proposed 영역 (Provider 추상화 / Ollama→node-llama-cpp / 모델 라우팅 / 폐쇄망) 본 ADR Phase 1/2/7/9 에 흡수. Risk-First 템플릿 + Hard Constraints 7개 + Gates 6개 본 ADR 에 정합 갱신

## 관련

- 본문 design: [design/134-ai-assistant-llm-infrastructure-unification-breakdown.md](design/134-ai-assistant-llm-infrastructure-unification-breakdown.md)
- 폐기 대상: [completed/011-ai-assistant-design.md](completed/011-ai-assistant-design.md) / [completed/054-local-llm-architecture.md](completed/054-local-llm-architecture.md)
- 정합 ADR: ADR-116 / ADR-122 (canonical document) / ADR-130 (frame) / ADR-131 (events/actions root) / ADR-132 (useCollectionData) / ADR-133 (AIPanel UX 1년차 신입 baseline)
- 동일 패턴: ADR-133 (3 ADR Deprecated + 통합 신규 ADR + plan-only land + Phase 실행 사용자 review 후)
