# ADR-134 Design Breakdown — AI Assistant 차세대 아키텍처

> 본문: [134-ai-assistant-llm-infrastructure-unification.md](../134-ai-assistant-llm-infrastructure-unification.md). 설계 문서 단계 — Phase 0-9 실행 작업 + 코드 변경은 사용자 plan review 후 별도 단계.
>
> **2026-08-18 노선 개정 반영**: 본문 §인프라 노선 재결정 — 노선 α (자체 로컬 LLM 내장) 기각 → 노선 β (**에이전트 중심** 멀티 프로바이더 BYOK + 외부 에이전트/MCP 준비). Phase 1/2/5/7/9 산출물이 재편됐다. **2차 정정 (같은 날, 사용자)**: 조직 원리 = Pencil.app (외부 에이전트 embed) + ZSeven-W/openpencil (에이전트 팀 오케스트레이션) — open-pencil 역할 고정 슬롯 4종 비채택, 모델 구성 단위 = 에이전트 프로파일 (본문 §패턴 채택 주). 근거: [PENCIL_ECOSYSTEM_ANALYSIS.md](../../explanation/research/PENCIL_ECOSYSTEM_ANALYSIS.md) + [HOLAOS_ANALYSIS.md](../../explanation/research/HOLAOS_ANALYSIS.md) + [XAI_ORG_ANALYSIS.md](../../explanation/research/XAI_ORG_ANALYSIS.md) (grok-build — 5번째 수렴 사례, §5-1 에 Phase 1/2/9 구현 세부 reference 8건).

## 0. 전제 점검 4 질문 lock-in

본문 §전제 점검 4 질문 lock-in 참조. base/응용 분류 (ADR-054 base + ADR-011 응용) + schema 직교성 (Provider ↔ 도구/UI) + 선행 전제 reverse 검증 + 단일 통합 (사용자 explicit confirm) 통과. 2026-08-18 노선 개정은 재개 조건 (a) 사용자 재제기 — 통합 형태 결정은 유지, 인프라 노선만 재결정.

## 1. scope 경계 — ADR-134 vs 후속 응용 분리

### ADR-134 scope 안 (본 ADR)

- **base 영역** (ADR-054 흡수 + 2026-08-18 재규정): `LLMProvider` 추상화 / **2-way 어댑터 (Anthropic Messages + OpenAI-compatible Chat Completions)** / **에이전트 프로파일 레지스트리** (프로파일별 provider·모델·effort 구성 — planner/executor/verifier/fast + vision 예약) / secret isolation (키 보관·경유 경계) / 폐쇄망 = 로컬 OpenAI-compatible endpoint BYOK / 외부 에이전트·MCP 준비 (도구 표면 호환)
- **응용 영역** (ADR-011 흡수): 7개 AI 도구 canonical 정합 / 컴포넌트 카탈로그 (RAC/RSP) / 에이전트 오케스트레이션 (Plan→Execute→Verify 서브에이전트 분해) / AIPanel UX 1년차 신입 baseline / bounded repair / 에이전트 프로파일 설정 UX
- **4 격차 영역 동시 정합** (2026-08-26 재측정 반영): canonical document 어휘 (ADR-116/122 — store 전환은 이미 완료, 도구 schema 어휘 확장만 잔존) / `collections` (ADR-132) / interaction rule root collection (ADR-131 → **ADR-158** `InteractionRule`) / frame canonical (ADR-130) / AIPanel UX (HC12 — ADR-133 Deprecated 후 ADR-149 P1 선례)

### 노선 개정으로 scope 에서 빠진 것 (2026-08-18)

- ~~Ollama 전용 어댑터~~ — OpenAI-compatible endpoint 로 포섭 (전용 코드 없음)
- ~~node-llama-cpp Electron Utility Process 내장~~ — 노선 α 기각과 함께 종료. 재개 조건: 로컬 endpoint BYOK 로 커버 불가능한 폐쇄망 요구가 실사용에서 등장
- ~~Qwen3 / Qwen3.5 모델 고정 + 하드웨어 매트릭스 (16GB/36GB)~~ — 모델 선택은 사용자 프로파일 구성 소관
- ~~난이도 추정 기반 로컬/온라인 자동 전환 + 복합 작업 자동 분할~~ — 에이전트 프로파일 라우팅 (D7 분해) 으로 대체
- ~~open-pencil 역할 고정 슬롯 4종 (design/review/fast/vision) 명명·구조~~ — 2차 정정으로 비채택. 모델 구성 단위는 에이전트 프로파일 (오케스트레이션 실행 단위)

### ADR-134 scope 밖 (후속 응용 ADR, 미작성)

본 ADR 반영 후 별도 ADR 분리 검토 영역:

- **AI 멀티모달 입력**: 스크린샷 / 이미지 / SVG 입력 — vision 용 에이전트 프로파일은 예약만 해 둔다. 구현 시 open-pencil 의 **bounded Vision inspection** (선택 영역 렌더만 전송 + 채팅 히스토리에 이미지 미보존) 을 데이터 lifecycle reference 로 채택 (분석 문서 §8 차용 후보 12)
- **CanvasKit 스키마 변환**: AI 출력을 Skia 렌더 가능한 spec shape 로 변환 — Phase A5 ADR-011 잔여 영역
- **AI 인스턴스/변수 도구**: component instance/slot 영역 AI 도구 — Phase A5 ADR-011 잔여 영역
- **AI 텍스트 생성/편집**: 리라이트 / 번역 / 톤 변경 / CTA 문구 생성 — ADR-054 §1.4 영역
- **AI 플레이스홀더 콘텐츠**: 업종 맥락 기반 더미 데이터 자동 주입 — ADR-054 §1.4 영역
- **AI 제안 모드**: `suggest_improvements` 도구 — ADR-054 §1.4 영역
- **접근성 AI 감사**: `audit_accessibility` 도구 + WCAG 자동 수정 — ADR-054 Phase 7 영역
- **브랜드 테마 자동 생성**: `generate_brand_theme` 도구 — ADR-054 §1.4 영역
- **기본 제공 모델 (proxy 운영)**: BYOK 온보딩 공백 (R2) 을 제품 부담 proxy 로 메울지 — 비용·운영 판정이 필요한 별도 결정
- **prompt/tool audit log + data retention 정책**: 분석 문서 §10 acceptance criteria 잔여 — 엔터프라이즈 감사 표면은 별도 ADR
- **AI 생성 이펙트**: 생성 중 블러+파티클 시각 피드백 확장 (G.3 보존, 확장은 별도 영역)

> **주의 (2026-08-18)**: 구 scope-밖 목록의 "MCP Protocol 어댑터 (Claude Code / Codex / Gemini / OpenCode CLI 통합)" 은 **Phase 9 로 편입**됐다 — 노선 β 의 최종 단계가 외부 에이전트 통합이다.

## 2. Phase 0 — inventory baseline freeze

**목적**: ADR-011 반영 영역 + 4 격차 측정 + **Groq 표면 실측**의 baseline freeze. Phase scope inflation 1.5x gap 차단 ([adr-writing.md M4](../../../.claude/rules/adr-writing.md)).

### Phase 0 산출물

- `~/.claude/plans/adr-134-baseline-inventory.md` (작업 시 신규 작성)
- ADR-011 Phase A1~A4 반영 산출물 인벤토리 (7개 도구 / AIPanel / AbortController / G.3 / IntentParser fallback / aiVisualFeedback)
- **Groq 표면 실측**: `groq-sdk` import 지점 / `dangerouslyAllowBrowser` / `llama-3.3-70b-versatile` 하드코딩 / API 키 취득 경로 (env/localStorage) 전수 grep
- 4 격차 영역 measure (2026-08-26 리뷰 round 1 이 1차 실측 — Phase 0 은 이를 baseline 으로 확정·보강):
  - 격차 1 — canonical document: read 는 `services/ai/tools/canonicalToolReadModel.ts` (canonical 순회, 6개 도구 import), write 는 facade `addElement / updateElement / removeElement` → `stores/utils/elementCreation.ts` / `elementUpdate.ts` / `elementRemoval.ts` → `adapters/canonical/canonicalMutations.ts` canonical-primary. 잔존 = 도구 schema 에 frame / slot / componentSemantics 1차 필드 어휘 부재. store action 실존 표면: `insertNode / updateNode / updateNodeProps / updateNodeExtension / moveNode / removeNode / updateDescendant` (`canonicalDocumentStore.ts`)
  - 격차 2 — collections: `useCollectionData({ datatableId | dataBinding })` (`packages/shared/src/hooks/useCollectionData.tsx`) 진입점 + `collections.runtimeData` sink (`DataTable.runtimeData?`, `types/builder/data.types.ts`) + `useDataTableStore` (`builder/stores/datatable.ts`) CRUD. canonical document 에 `collections` / `data` root 없음 (ADR-131 P8 revert)
  - 격차 3 — interaction rule: `InteractionRule` schema (`packages/shared/src/interactions/interactionRule.types.ts`) + `capabilityRegistry.ts` + store action `addEvent / updateEvent / removeEvent / setEvents` + read `useDocumentEvents()`. `SerializedEvent` / root `actions` 는 dormant (`composition-document.types.ts` 주석) — AI 도구 참조 금지
  - 격차 4 — frame: `FrameNode` schema + `isLegacyGroupForFrameMigration()` (`adapters/canonical/tagRename.ts`) hydration migration 분석
  - 회귀 gate baseline: AI 도구 안 `Transform` / `props.events` / `Group + group_N` / `SerializedEvent` 어휘 **0건** (2026-08-26 grep) — G3/G4 의 grep gate 는 "도입 금지" 회귀 조건
- **프록시 경계 사전 조사** (D10): Supabase Edge Function 호출 가능 범위 / streaming 지원 / 키 보관 위치 후보 비교 — Phase 2 확정의 입력
- baseline freeze metric: 추정 file count + LOC + grep alias 종류 (실측 vs 추정 1.5x gap 차단)

### Phase 0 Gate

- Phase 0 inventory baseline freeze + 사용자 confirm 후 Phase 1 진입
- Phase scope inflation 1.5x 시 사용자 confirm (M4) 의무

## 3. Phase 1 — LLM Provider 추상화 + 에이전트 프로파일 (D1, G1)

**목적**: `LLMProvider` 인터페이스 + **2-way 어댑터** (Anthropic Messages / OpenAI-compatible Chat Completions) + **에이전트 프로파일 레지스트리** 반영. `completeWithTools(tools, messages, options)` 통합 시그니처. ZSeven-W/openpencil multi-model/provider profile + grok-build 서브에이전트별 모델/effort 설정 정합 (2026-08-18 2차 정정 — open-pencil 역할 4종 고정 슬롯 비채택). 어댑터 구현 reference: grok-build `ApiBackend` capability 술어 (backend 차이를 if 산개가 아니라 enum 술어 메서드로 중앙화 — Messages 의 "native schema ↔ tool use 상충 → StructuredOutput 도구 우회" 포함) + retry 행동 스펙 (429 Retry-After 전액 대기 + 별도 시도 상한 / 413 이미지 strip 1회 / 영구-fatal 분류 / 서버 override 헤더) — [XAI_ORG_ANALYSIS.md](../../explanation/research/XAI_ORG_ANALYSIS.md) §2-2/§5-1 #2·#3.

### Phase 1 산출물

- `apps/builder/src/services/ai/providers/LLMProvider.ts` — 인터페이스 정의 (`completeWithTools` + streaming + abort + reasoning effort 옵션)
- `apps/builder/src/services/ai/providers/AnthropicProvider.ts` — Anthropic Messages API 어댑터 (tool use format)
- `apps/builder/src/services/ai/providers/OpenAICompatibleProvider.ts` — OpenAI Chat Completions 어댑터 (function calling format). **Ollama / vLLM / LM Studio / 사내 gateway 는 전부 이 어댑터 + base URL 설정으로 포섭 — 전용 어댑터 금지**
- `apps/builder/src/services/ai/providers/AgentProfileRegistry.ts` — 에이전트 프로파일 (`main` / `planner` / `executor` / `verifier` / `fast` + `vision` 예약) 정의 + 프로파일별 {provider, baseUrl, model, credentialRef, reasoningEffort} 구성 + 사용자 설정 영구화
- 프로파일 프리셋 템플릿 — Anthropic / OpenAI / 로컬 endpoint (Ollama) 3종 (R2 온보딩 완화)

### Phase 1 Gate G1

- 2-way 어댑터 + 에이전트 프로파일 설정 모델 반영 (Ollama 는 OpenAI-compatible base URL 로 통과 확인)
- 기존 7개 도구 시그니처 보존 + 통합 인터페이스 통과
- type-check + vitest PASS

## 4. Phase 2 — Groq 완전 제거 + secret isolation (D10, G2)

**목적**: `groq-sdk` 완전 제거 + `dangerouslyAllowBrowser: true` 제거 + **키 보관·경유 경계 확정** + 대체 provider (에이전트 프로파일 경유) 로 기존 7개 도구 전수 통과.

### Phase 2 산출물

- `groq-sdk` 패키지 제거 (`pnpm remove groq-sdk`)
- `apps/builder/src/services/ai/GroqAgentService.ts` → `apps/builder/src/services/ai/AgentService.ts` rename (AgentProfileRegistry → LLMProvider 경유, `llama-3.3-70b-versatile` 하드코딩 제거)
- **원격 provider 프록시 경계 확정** (Phase 0 조사 기반): Supabase Edge Function 경유안 채택 여부 + streaming relay + 키 보관 (서버측 secret / 사용자 세션 연계). 로컬 endpoint (localhost) 는 직접 호출 허용
- 키 저장 정책 구현: 브라우저 localStorage 평문 금지 — 명시 opt-in 경로만
- `apps/builder/src/services/ai/IntentParser.ts` 보존 (최후 fallback) or 제거 검토
- `apps/builder/src/services/ai/systemPrompt.ts` provider 중립 갱신 (특정 모델 전제 서술 제거)
- `apps/builder/src/builder/panels/ai/hooks/useAgentLoop.ts` Provider 경유 정합 갱신
- AbortController + G.3 시각 피드백 보존 검증

### Phase 2 Gate G2

- `groq-sdk` 0 grep gate (production runtime)
- `dangerouslyAllowBrowser` 0 grep gate + browser 번들 내 원격 provider 직접 호출 0 (R12)
- 대체 provider (에이전트 프로파일 경유) 로 기존 7개 도구 전수 통과 (createElement / updateElement / deleteElement / getEditorState / getSelection / searchElements / batchDesign)
- AbortController 동작 검증 + G.3 시각 피드백 회귀 없음
- type-check + vitest PASS

## 5. Phase 3 — AI 도구 canonical 어휘 확장 (D2, G3)

**목적** (2026-08-26 재규정): store 전환은 이미 완료돼 있다 (read `canonicalToolReadModel.ts`, write facade canonical-primary — Phase 0 격차 1 실측). Phase 3 의 일은 **도구 schema 에 canonical 1차 필드 어휘를 추가**하고, 필요한 곳만 store action 을 직접 경유하는 것. legacy `elementsMap` / `childrenMap` direct write 0건은 **회귀 조건** (현 baseline 0).

### Phase 3 산출물

- `apps/builder/src/services/ai/tools/createElement.ts` → 파라미터에 `type: "frame"` + `FrameNode` 1차 필드 (`clip` / `placeholder`) / slot / componentSemantics 표현 추가. write 는 facade `addElement` 유지; 1차 필드는 생성 직후 `useCanonicalDocumentStore.getState().updateNode` / `updateNodeExtension` patch
- `apps/builder/src/services/ai/tools/updateElement.ts` → facade `updateElement` 유지 + 1차 필드 patch 경로 추가
- `apps/builder/src/services/ai/tools/deleteElement.ts` → facade `removeElement` 유지 + body 보호 + boundary 검증 (변경 최소)
- `apps/builder/src/services/ai/tools/getEditorState.ts` → `canonicalToolReadModel` 유지 + `useDocumentEvents()` (`InteractionRule[]`) 통합 데이터 (root `actions` 는 dormant — 미포함)
- `apps/builder/src/services/ai/tools/getSelection.ts` → `canonicalToolReadModel` 유지 (변경 최소)
- `apps/builder/src/services/ai/tools/searchElements.ts` → `canonicalToolReadModel` 순회 + tag/propName/propValue/styleProp 필터에 1차 필드 (frame / slot / componentSemantics) 필터 추가
- `apps/builder/src/services/ai/tools/batchDesign.ts` → `runCanonicalMutation` (`adapters/canonical/canonicalMutationRunner.ts`) 으로 다단계 mutation 을 history 1건으로 묶고 실패 시 rollback
- `apps/builder/src/services/ai/tools/definitions.ts` → 7개 도구 JSON Schema 갱신 (1차 필드 어휘 반영). **MCP tool schema 호환 형태 유지 (D11) — 파라미터 JSON Schema 와 도구 명세를 실행 코드에서 분리해 Phase 9 에서 MCP server 로 노출 가능하게**

### Phase 3 Gate G3

- 도구 schema 에 frame / slot / componentSemantics 어휘 반영 + **AI 가 `type: "frame"` 요소 1건 생성 live 실측** (Chrome MCP 또는 사용자 confirm)
- facade / store action 외 `elementsMap` / `childrenMap` 직접 접근 0 grep gate (회귀 — baseline 0)
- `batchDesign` 이 history 1건으로 묶이는지 undo 1회로 확인
- Tool Calling 정확도 ≥ Phase 2 baseline 유지
- type-check + vitest PASS

## 6. Phase 4 — collections + interaction rule + frame canonical 정합 (D3/D4/D5, G4)

**목적** (2026-08-26 ADR-158 정합으로 재작성): 3 격차 영역 동시 정합:

- **D3 `collections` SSOT** (ADR-132): AI 데이터 바인딩 도구가 `Element.dataBinding` 참조를 설정 (`updateNodeProps` / facade `updateElement`) + `collections.runtimeData` sink + `useCollectionData({ datatableId | dataBinding })` read 진입점만 사용. collections CRUD 는 `useDataTableStore` 경유 (canonical document 에 `collections` root 없음)
- **D4 interaction rule root collection** (ADR-158): AI 가 이벤트를 만들 때 `InteractionRule` schema + `useCanonicalDocumentStore.getState().addEvent / updateEvent / removeEvent`. action 은 `navigate | toast | capability` 인라인 — `capability` 는 `capabilityRegistry.ts` 등록 항목만. 별도 action 도구 없음 (root `actions` dormant)
- **D5 frame canonical vocabulary** (ADR-130): AI 가 layout container 생성 시 `type: "frame"` (Group 응용 흡수 금지)

### Phase 4 산출물

- `apps/builder/src/services/ai/tools/bindCollection.ts` 신규 — 대상 element 의 `dataBinding` 을 `updateNodeProps` 로 설정 (`{ datatableId }` 또는 `{ dataBinding }` 형태, `useCollectionData` 계약 정합). collections 가 없으면 `useDataTableStore` 로 생성 안내 (생성 자체는 사용자 승인 게이트)
- `apps/builder/src/services/ai/tools/createInteractionRule.ts` 신규 — `InteractionRule` schema (`isInteractionRule` 가드 통과) + `addEvent` 경유. `capability` action 은 `capabilityRegistry` 로 대상 컴포넌트가 해당 capability 를 노출하는지 검증 후 write
- `apps/builder/src/services/ai/tools/createElement.ts` — `type: "frame"` 처리 (Phase 3 어휘 확장과 연속). legacy `Group + customId="group_N"` 어휘 미도입
- `apps/builder/src/services/ai/tools/definitions.ts` — 신규 도구 2종 JSON Schema (MCP 호환 형태)
- `apps/builder/src/services/ai/systemPrompt.ts` — `collections` / `InteractionRule` (trigger·action 3종·capability 목록) / `frame` schema 가이드 추가

### Phase 4 Gate G4

- **AI 가 `InteractionRule` 1건 생성 → Preview 에서 동작 live 실측** (예: Button click → toast; ADR-158 G2 와 같은 dispatcher 경로)
- **AI 가 `Element.dataBinding` 설정 → `useCollectionData` 로 데이터 렌더 live 실측** (ListBox/GridList 등 collection 1종)
- 회귀 gate (baseline 0건, 2026-08-26): 신규·기존 AI 도구 안 `SerializedEvent` / root `actions` / `Transform` / `element.props.events` / `type: "Group" + customId="group_N"` 어휘 0 grep
- type-check + vitest PASS

## 7. Phase 5 — 컴포넌트 카탈로그 (D6, G5)

**목적**: RAC / RSP 문서 기반 컴포넌트 카탈로그 + Tier 2 동적 주입. ADR-011 Section 1.3.1 "컴포넌트 지식 격차" 해소. **2026-08-18 재규정**: 로컬 모델 정확도 보정이 아니라 **provider 무관 도메인 지식 주입** — 어느 모델이든 composition 컴포넌트 vocabulary / catalog 규칙은 주입 없이 알 수 없다.

### Phase 5 산출물

- `apps/builder/src/services/ai/catalog/componentCatalog.ts` — 65+ 컴포넌트 메타데이터 (variant / size / props / a11y / Compositional 구조)
- `apps/builder/src/services/ai/catalog/dynamicInjection.ts` — Tier 2 동적 주입 (작업 컨텍스트 기반 선택적 로딩, ~311K tok → context 예산 안 fit)
- `apps/builder/src/services/ai/catalog/specSync.ts` — catalog(`COMPONENT_RULES_TABLE`) → AI 카탈로그 자동 동기화 (Phase 6+)
- `apps/builder/src/services/ai/systemPrompt.ts` — 카탈로그 진입점 + 동적 주입 hook

### Phase 5 Gate G5

- 카탈로그 65+ 컴포넌트 메타데이터 반영 + RAC / RSP 문서 매핑 검증
- 동적 주입 후 Props 정확도 ≥ 90% (Phase 5 검증 데이터셋 — 15 시나리오, **executor 프로파일 기준 모델로 측정**)
- (구 Qwen3 14B/35B 정확도 조건은 노선 α 기각과 함께 삭제 — 로컬 endpoint 사용 시 정확도는 사용자 trade-off, R10)
- type-check + vitest PASS

## 8. Phase 6 — 에이전트 오케스트레이션 Plan→Execute→Verify (D7)

**목적** (2026-08-18 2차 정정): 멀티스텝 대시보드 디자인을 **서브에이전트 분해로 실행** + bounded repair (자기 수정 max 2회). Reference: **ZSeven-W/openpencil Concurrent Agent Teams / layered workflow** (PENCIL 분석 §8 차용 후보 4 — phase 별 prompt, bounded repair, per-agent canvas indicator) / Pencil.app / Google Stitch. open-pencil Design·Review 역할 분리는 비채택 (본문 §패턴 채택 주).

### Phase 6 산출물

- `apps/builder/src/services/ai/agents/PlannerAgent.ts` — Plan 서브에이전트 (자연어 → 컴포넌트 구조 → 레이아웃 → 스타일 → 데이터 분해) — planner 프로파일 참조
- `apps/builder/src/services/ai/agents/ExecutorAgent.ts` — Execute 서브에이전트 (Plan 결과 → 도구 호출 시퀀스) — executor 프로파일 참조
- `apps/builder/src/services/ai/agents/VerifierAgent.ts` — Verify 서브에이전트 (결과 → 자연어 요청 정합 검증) + bounded repair (max 2회) — verifier 프로파일 참조
- `apps/builder/src/services/ai/agents/orchestrator.ts` — 오케스트레이터 (서브에이전트 실행 순서·병렬성·에이전트별 진행 이벤트 방출 — per-agent indicator 의 데이터 소스)
- 단순 분류·의도 파싱 — fast 보조 프로파일 (IntentParser 대체 검토 지점)
- `apps/builder/src/services/ai/tools/createComposite.ts` — 팩토리 기반 합성 컴포넌트 생성 (Card → CardHeader + CardContent / Tabs → TabList + TabPanel 등)
- `apps/builder/src/services/ai/templates/layoutTemplates.ts` — 레이아웃 템플릿 (대시보드 / 폼 / 리스트 / 카드 그리드 등)

### Phase 6 검증 (Gate 없음, Phase 7 G6 통합 검증)

- "사용자 관리 대시보드 만들어줘" 시나리오 1회 통과 + 자기 수정 ≤ 1회
- "이커머스 상품 카탈로그 만들어줘" 시나리오 1회 통과 + 자기 수정 ≤ 1회
- planner/executor/verifier 가 각자 프로파일로 호출되는지 검증 (프로파일별 모델을 달리 설정하고 호출 로그 확인) + 에이전트별 진행 이벤트 방출 확인

## 9. Phase 7 — 에이전트 프로파일 라우팅 + 폐쇄망 BYOK 검증 (D8, G6)

**목적**: 작업 유형 → 실행 에이전트/프로파일 라우팅 (D7 분해가 정본) + 폐쇄망 시나리오 실측. 구 난이도 추정 / 로컬·온라인 자동 전환 / 복합 작업 자동 분할은 노선 개정으로 삭제.

### Phase 7 산출물

- `apps/builder/src/services/ai/routing/AgentProfileRouter.ts` — 작업 유형 → 실행 에이전트 선택 (plan/verify → planner·verifier, execute → executor, 분류 → fast). 프로파일 미구성 시 구성된 프로파일로 downgrade + 안내
- `apps/builder/src/builder/panels/ai/components/AgentProfileSettings.tsx` — 에이전트 프로파일 설정 UX (프로파일별 provider / base URL / 모델 / 키 / reasoning effort + 프리셋 3종)
- `apps/builder/src/builder/panels/ai/components/ConnectionStatus.tsx` — 프로파일별 연결 상태 표시 (원격 도달 불가 시 로컬 endpoint 안내 — 구 OfflineIndicator 대체)
- 로컬 endpoint 설정 가이드 문서 (`docs/` — Ollama OpenAI-compatible 모드 기준)

### Phase 7 Gate G6

- 에이전트 프로파일 라우팅 동작 검증 (프로파일별 상이 모델 구성 → 호출 분기 실측)
- **폐쇄망 시나리오**: 전 프로파일을 로컬 OpenAI-compatible endpoint (Ollama) 로 바인딩 → 7개 도구 전수 통과 1회 실측 (R10 — 모델 품질 보증이 아니라 경로 검증)
- type-check + vitest PASS

## 10. Phase 8 — AIPanel UX 1년차 신입 baseline (D9)

**목적**: HC12 "1년차 신입 개발자라도 사용할 수준" 정합 (출처 ADR-133 Q4 사용자 확정 2026-05-13; ADR-133 Deprecated 후 ADR-149 P1 "default 표면 2 depth, overlay 0" 이 선례). depth 4→2 축소.

### Phase 8 산출물

- `apps/builder/src/builder/panels/ai/AIPanel.tsx` — depth 2 (default 표면 = 자연어 입력 + 도구 실행 결과 시각 피드백)
- `apps/builder/src/builder/panels/ai/components/AdvancedMode.tsx` — 고급 모드 (Plan 단계 시각화 + 자기 수정 표시 + **에이전트별 진행 표시** (per-agent indicator — ZSeven-W 정합) + **에이전트 프로파일 설정 진입점**, L4 power user 격리)
- `apps/builder/src/builder/panels/ai/components/ToolCallMessage.tsx` — 1년차 신입 baseline UX (도구 호출 의도 + 결과 한 줄 요약)
- `apps/builder/src/builder/panels/ai/components/AgentControls.tsx` — 중단 버튼 + 현재 turn 표시 (보존 + UX 단순화)
- BYOK 최초 실행 온보딩 (R2): 키/endpoint 미설정 시 설정 유도 표면 (빈 채팅창이 아니라 프리셋 선택 안내)

### Phase 8 검증 (Gate 없음, evaluator agent screenshot)

- depth 4 → 2 축소 measure
- 1년차 신입 baseline 시나리오 5개 통과 (evaluator agent screenshot 검증)
- BYOK 미설정 상태 최초 진입 시나리오 통과 (온보딩 공백 R2 완화 확인)

## 11. Phase 9 — 외부 코딩 에이전트 통합 (D11, G7)

**목적**: ACP/에이전트 SDK embed (Claude Code / Codex) + MCP 도구 표면 노출. **2026-08-18 2차 정정으로 위상 확정: 외부 에이전트 embed 는 이연된 부가 기능이 아니라 노선 β 의 최종 형태다 (Pencil.app dual embed 패턴 정본)** — Phase 1-8 의 자체 오케스트레이션은 웹 단계의 자립 경로이자 embed 의 전제 (MCP 호환 도구 표면) 를 준비한다. **Electron 마이그레이션 시점 의존 (R1 HIGH 위험)**. Reference: Pencil.app dual embed (Codex SDK + Claude Agent SDK) / open-pencil ACP (Claude Code / Codex / Gemini CLI) / holaOS harness-host (pi / claude-code / codex 3-way + deferred tool gateway — [HOLAOS_ANALYSIS.md](../../explanation/research/HOLAOS_ANALYSIS.md) §3-1/§5) / grok-build (ACP + `search_tool`+`use_tool` 도구 지연 로딩 정본 + embed 권한 5단 파이프라인 — [XAI_ORG_ANALYSIS.md](../../explanation/research/XAI_ORG_ANALYSIS.md) §2-1/§2-3/§5-1).

### Phase 9 산출물

- composition MCP server — Phase 3 에서 준비한 MCP 호환 도구 표면 (7+ 도구) 을 MCP server 로 노출 (외부 에이전트가 canonical mutation API 를 도구로 사용)
- 에이전트 embed 1종 이상 (Claude Agent SDK 우선 검토) — Electron subprocess + AIPanel 연계
- 자체 AgentLoop 와 embed 에이전트의 병존 계약 (노선 γ 부분 채택 재평가 — 본문 §기각 사유)
- 키/권한 경계: embed 에이전트의 도구 권한 scope (mutation 범위 제한 + 사용자 승인 게이트)

### Phase 9 Gate G7

- 외부 에이전트 embed 1종 이상 + MCP 도구 표면으로 composition 문서 조작 실측 (요소 생성/수정 1 시나리오)
- AI 추론·에이전트 실행 중 Canvas 60fps 유지
- type-check + vitest PASS

**Phase 9 실패 시 대안**: Phase 9 보류, Phase 1-8 자립 운영 유지 (BYOK provider 기본) — Electron 마이그레이션 반영까지 보류

## 12. baseline freeze 표 (Phase 0 작업 시 채움 — 2026-08-18 재편 반영)

| 영역                      | 추정 file count                                                                                           | 실측 file count | gap (실측/추정) | 1.5x 초과 여부 |
| ------------------------- | --------------------------------------------------------------------------------------------------------- | --------------- | --------------- | -------------- |
| Phase 1 Provider+프로파일 | ~6 file                                                                                                   | TBD             | TBD             | TBD            |
| Phase 2 Groq 제거+secret  | ~7 file                                                                                                   | TBD             | TBD             | TBD            |
| Phase 3 도구 어휘 확장    | ~8 file (7 도구 + definitions; store 전환 없음 — 2026-08-26 재산정)                                       | TBD             | TBD             | TBD            |
| Phase 4 격차 정합         | ~5 file (신규 도구 2 + createElement + definitions + systemPrompt — createAction 삭제, 2026-08-26 재산정) | TBD             | TBD             | TBD            |
| Phase 5 카탈로그          | ~8 file                                                                                                   | TBD             | TBD             | TBD            |
| Phase 6 Plan→E→V+역할     | ~15 file                                                                                                  | TBD             | TBD             | TBD            |
| Phase 7 라우팅+폐쇄망     | ~6 file                                                                                                   | TBD             | TBD             | TBD            |
| Phase 8 AIPanel UX        | ~10 file                                                                                                  | TBD             | TBD             | TBD            |
| Phase 9 외부 에이전트     | ~10 file                                                                                                  | TBD             | TBD             | TBD            |

1.5x 초과 시 [adr-writing.md M4](../../../.claude/rules/adr-writing.md) sub-group N≥3 분할 / scope inflation 사용자 confirm 의무 적용.

## 13. ADR-011 Phase A1~A4 반영 산출물 보존 영역 (Phase 2 전환 대상)

| 산출물                                                                    | Phase 2 처리                                                                                          |
| ------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------- |
| `GroqAgentService.ts`                                                     | `AgentService.ts` rename + AgentProfileRegistry→LLMProvider 경유                                      |
| 7개 도구 (createElement 등)                                               | Phase 3 canonical 어휘 확장 (store 경로는 이미 canonical-primary) + Phase 4 격차 정합 + MCP 호환 유지 |
| `AIPanel.tsx` + `AgentControls` / `ToolCallMessage` / `ToolResultMessage` | Phase 8 depth 4→2 축소 + 1년차 신입 baseline 적용                                                     |
| `useAgentLoop.ts`                                                         | Provider 추상화 경유 정합 갱신                                                                        |
| `AbortController` + AgentControls                                         | 보존 (Phase 2 회귀 검증 필수)                                                                         |
| G.3 시각 피드백 (`aiVisualFeedback`)                                      | 보존 (Phase 2 회귀 검증 필수)                                                                         |
| `IntentParser.ts`                                                         | 보존 검토 (최후 fallback) — Phase 6 에서 fast 프로파일 대체 재검토                                    |
| `systemPrompt.ts`                                                         | provider 중립 갱신 (특정 모델 전제 제거) + 카탈로그 hook                                              |
| `styleAdapter.ts`                                                         | 보존 (CSS-like → 내부 스키마 변환, AI-A5a 단위 정규화)                                                |
| `definitions.ts`                                                          | Phase 3 도구 JSON Schema canonical 정합 + MCP 호환 형태 갱신                                          |

## 14. ADR-054 Proposed 영역 흡수 매핑 (2026-08-18 개정)

| ADR-054 Phase                    | ADR-134 매핑                                                          |
| -------------------------------- | --------------------------------------------------------------------- |
| Phase 1 (Groq 제거 + Provider)   | Phase 1 + Phase 2                                                     |
| Phase 2 (로컬 모델 Tool Calling) | **승계 종료** — 로컬 모델은 OpenAI-compatible endpoint BYOK (Phase 7) |
| Phase 3 (Canvas FPS)             | Phase 9 (외부 에이전트 실행 중 60fps — 대상 교체)                     |
| Phase 4 (컴포넌트 카탈로그)      | Phase 5                                                               |
| Phase 5 (Props 정확도)           | Phase 5 G5 (executor 프로파일 기준으로 재규정)                        |
| Phase 6 (디자인 지능)            | Phase 6                                                               |
| Phase 7 (접근성 감사)            | **ADR-134 scope 밖** (후속 응용 ADR)                                  |

## 15. 사용자 plan review 후 진입 절차

설계 문서 반영 이후 진입 절차 (ADR-133 동일 패턴):

1. **사용자 plan review** — 본 design breakdown 정독 + 정정 사항 명시
2. **차단 / 정당화 메모리 평가** — Phase 0 진입 전 (`feedback-execute-adr-surface-minimization` / `feedback-no-derived-adr-mid-execution` 평가)
3. **Phase 0 inventory baseline freeze 진입** — `~/.claude/plans/adr-134-baseline-inventory.md` 작성
4. **Phase 1 진입** — Phase 0 baseline freeze 사용자 confirm 후
5. **각 Phase 별 완료 절차** — type-check + vitest + grep gate 통과 + main 직접 push (PR 금지 정합) + CHANGELOG entry

각 Phase 별 commit 단위는 단일 커밋 권장 (`feedback-execute-adr-surface-minimization` 정합). sub-step 분해 (1-α/1-β/...) 금지 — 사용자 확정 위반.
