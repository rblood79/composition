# ADR-134 Design Breakdown — AI Assistant 차세대 아키텍처

> 본문: [134-ai-assistant-llm-infrastructure-unification.md](../134-ai-assistant-llm-infrastructure-unification.md). plan-only land 상태 — Phase 0-9 실행 작업 + 코드 변경은 사용자 plan review 후 별 step.

## 0. framing checkpoint 4 질문 lock-in

본문 §framing checkpoint 4 질문 lock-in 참조. base/응용 분류 (ADR-054 base + ADR-011 응용) + schema 직교성 (Provider ↔ 도구/UI) + baseline reverse 검증 + 단일 통합 (사용자 explicit confirm) 통과.

## 1. scope 경계 — ADR-134 vs ADR-136+ 응용 분리

### ADR-134 scope 안 (본 ADR)

- **base 영역** (ADR-054 흡수): `LLMProvider` 추상화 / Ollama / node-llama-cpp / Anthropic / OpenAI-compatible 4-way / 모델 라우팅 / 폐쇄망 / Electron Utility Process
- **응용 영역** (ADR-011 흡수): 7개 AI 도구 canonical 정합 / 컴포넌트 카탈로그 (RAC/RSP) / AI 설계 지능 (Plan→Execute→Verify) / AIPanel UX 1년차 신입 baseline / 자기 수정 / 모델 선택 UX
- **4 격차 영역 동시 정합**: canonical document (ADR-116/122) / data_tables (ADR-132) / events/actions root collection (ADR-131) / frame canonical (ADR-130) / AIPanel UX (ADR-133)

### ADR-134 scope 밖 (ADR-136+ 응용, 미발의)

본 ADR Phase 9 land 후 별 ADR 분리 검토 영역:

- **AI 멀티모달 입력**: 스크린샷 / 이미지 / SVG 입력 (Pencil 의 "frame → code" 패턴) — Phase A5 ADR-011 잔여 영역
- **CanvasKit 스키마 변환**: AI 출력을 Skia 렌더 가능한 spec shape 로 변환 — Phase A5 ADR-011 잔여 영역
- **AI 인스턴스/변수 도구**: ADR-110/111/112 component instance/slot 영역 AI 도구 — Phase A5 ADR-011 잔여 영역
- **AI 텍스트 생성/편집**: 리라이트 / 번역 / 톤 변경 / CTA 문구 생성 — ADR-054 §1.4 영역
- **AI 플레이스홀더 콘텐츠**: 업종 맥락 기반 더미 데이터 자동 주입 — ADR-054 §1.4 영역
- **AI 제안 모드**: `suggest_improvements` 도구 — ADR-054 §1.4 영역
- **접근성 AI 감사**: `audit_accessibility` 도구 + WCAG 자동 수정 — ADR-054 Phase 7 영역
- **브랜드 테마 자동 생성**: `generate_brand_theme` 도구 — ADR-054 §1.4 영역
- **MCP Protocol 어댑터**: Claude Code / Codex / Gemini / OpenCode CLI 통합 — ADR-054 §1.4 영역 (Electron 의존)
- **AI 생성 이펙트**: 생성 중 블러+파티클 시각 피드백 확장 (G.3 보존, 확장은 별 영역)

## 2. Phase 0 — inventory baseline freeze

**목적**: ADR-011 land 영역 + ADR-054 Proposed 영역 + 4 격차 측정의 baseline freeze. Phase scope inflation 1.5x gap 차단 ([adr-writing.md M4](../../../.claude/rules/adr-writing.md)).

### Phase 0 산출물

- `~/.claude/plans/adr-134-baseline-inventory.md` (작업 시 신규 작성)
- ADR-011 Phase A1~A4 land 산출물 인벤토리 (7개 도구 / AIPanel / AbortController / G.3 / IntentParser fallback / aiVisualFeedback)
- ADR-054 Proposed 영역 인벤토리 (Provider 인터페이스 설계 / Phase 1-7 영역 / Hard Constraints 7개 / Gates G1-G6)
- 4 격차 영역 measure:
  - 격차 1 — canonical document: `useCanonicalDocumentStore` mutation API 21개 + boundary helper 12 site allowlist 분석
  - 격차 2 — data_tables: `useCollectionData` 진입점 + `data_tables.runtimeData` sink 분석
  - 격차 3 — events/actions: `SerializedEvent / SerializedAction` schema + canonical mutation API 8개 분석
  - 격차 4 — frame: `FrameNode` schema + `isLegacyGroupForFrameMigration()` hydration migration 분석
- baseline freeze metric: 추정 file count + LOC + grep alias 종류 (실측 vs 추정 1.5x gap 차단)

### Phase 0 Gate

- Phase 0 inventory baseline freeze + 사용자 confirm 후 Phase 1 진입
- Phase scope inflation 1.5x 시 사용자 confirm (M4) 의무

## 3. Phase 1 — LLM Provider 추상화 layer (G1)

**목적**: `LLMProvider` 인터페이스 + 4-way 어댑터 (Ollama / node-llama-cpp / Anthropic / OpenAI-compatible) land. `completeWithTools(tools, messages, options)` 통합 시그니처.

### Phase 1 산출물

- `apps/builder/src/services/ai/providers/LLMProvider.ts` — 인터페이스 정의
- `apps/builder/src/services/ai/providers/OllamaProvider.ts` — Ollama REST API 어댑터
- `apps/builder/src/services/ai/providers/AnthropicProvider.ts` — Anthropic Messages API 어댑터
- `apps/builder/src/services/ai/providers/OpenAICompatibleProvider.ts` — OpenAI Chat Completions API 어댑터
- `apps/builder/src/services/ai/providers/NodeLlamaCppProvider.ts` — Electron 의존 (Phase 9), Phase 1 에서는 stub 만
- `apps/builder/src/services/ai/providers/ProviderRegistry.ts` — Provider 등록 + 모델 선택 + 사용자 설정 영구화

### Phase 1 Gate G1

- 4-way 어댑터 land + 사용자 모델 선택 UX (Ollama / Anthropic / OpenAI-compatible)
- 기존 7개 도구 시그니처 보존 + 통합 인터페이스 통과
- type-check + vitest PASS

## 4. Phase 2 — Groq 완전 제거 + Ollama Provider 1st (G2)

**목적**: `groq-sdk` 완전 제거 + `dangerouslyAllowBrowser: true` 제거 + Ollama Provider 로 기존 7개 도구 전수 통과.

### Phase 2 산출물

- `groq-sdk` 패키지 제거 (`pnpm remove groq-sdk`)
- `apps/builder/src/services/ai/GroqService.ts` 삭제
- `apps/builder/src/services/ai/GroqAgentService.ts` → `apps/builder/src/services/ai/AgentService.ts` 로 rename (Provider 추상화 경유)
- `apps/builder/src/services/ai/IntentParser.ts` 보존 (최후 fallback) or 제거 검토
- `apps/builder/src/services/ai/systemPrompt.ts` Ollama 모델 정합 갱신 (Qwen3 / Llama 3 prompt format)
- `apps/builder/src/builder/panels/ai/hooks/useAgentLoop.ts` Provider 경유 정합 갱신
- AbortController + G.3 시각 피드백 보존 검증

### Phase 2 Gate G2

- `groq-sdk` 0 grep gate (production runtime)
- `dangerouslyAllowBrowser: true` 0 grep gate
- Ollama Provider 로 기존 7개 도구 전수 통과 (createElement / updateElement / deleteElement / getEditorState / getSelection / searchElements / batchDesign)
- AbortController 동작 검증 + G.3 시각 피드백 회귀 없음
- type-check + vitest PASS

## 5. Phase 3 — AI 도구 canonical 정합 (D2, G3)

**목적**: 7개 도구 시그니처를 canonical mutation API 경유로 전환. legacy `elementsMap` / `childrenMap` direct write 0건.

### Phase 3 산출물

- `apps/builder/src/services/ai/tools/createElement.ts` → `useCanonicalDocumentStore.getState().{setFrames, setSlots, ...}` 또는 `nodeOpsActions` boundary helper 경유
- `apps/builder/src/services/ai/tools/updateElement.ts` → canonical mutation API 경유
- `apps/builder/src/services/ai/tools/deleteElement.ts` → canonical mutation API 경유 + body 보호 + boundary 검증
- `apps/builder/src/services/ai/tools/getEditorState.ts` → `useCanonicalDocumentStore` read selector + `useDocumentEvents` / `useDocumentActions` 통합 데이터
- `apps/builder/src/services/ai/tools/getSelection.ts` → `useCanonicalDocumentStore` selectedNodeIds selector
- `apps/builder/src/services/ai/tools/searchElements.ts` → canonical `CompositionDocument.nodes` 순회 + tag/propName/propValue/styleProp 필터
- `apps/builder/src/services/ai/tools/batchDesign.ts` → canonical mutations batch + transactional 패턴 + 실패 시 rollback
- `apps/builder/src/services/ai/tools/definitions.ts` → 7개 도구 JSON Schema 갱신 (canonical schema 정합)

### Phase 3 Gate G3

- 7개 도구 canonical mutation API 경유 (boundary helper allowlist 12 site 외 direct access 0 grep gate)
- legacy `elementsMap.get / set` AI 도구 안 사용 0 grep gate
- canonical mutation 경유 후 회귀 검증 (Tool Calling 정확도 ≥ Phase 2 baseline 유지)
- type-check + vitest PASS

## 6. Phase 4 — data_tables + events/actions + frame canonical 정합 (D3/D4/D5, G4)

**목적**: 4 격차 영역 동시 정합:

- **D3 data_tables SSOT** (ADR-132): AI 데이터 바인딩 도구가 `data_tables.runtimeData` sink + `useCollectionData({ datatableId | dataBinding })` read 진입점만 사용
- **D4 events/actions root collection** (ADR-131): AI 가 이벤트 핸들러 생성 시 `SerializedEvent / SerializedAction` schema + `useCanonicalDocumentStore.getState().{setEvents, setActions, ...}` 사용
- **D5 frame canonical vocabulary** (ADR-130): AI 가 layout container 생성 시 `type: "frame"` (Group 응용 흡수 금지)

### Phase 4 산출물

- `apps/builder/src/services/ai/tools/bindDataTable.ts` 신규 — `useCanonicalDocumentStore.getState().{addCollection, ...}` 경유. legacy `Transform 3단계` 도구 제거 (ADR-132 정합)
- `apps/builder/src/services/ai/tools/createEvent.ts` 신규 — `SerializedEvent` schema + `useCanonicalDocumentStore.getState().setEvents` 경유
- `apps/builder/src/services/ai/tools/createAction.ts` 신규 — `SerializedAction` schema + `useCanonicalDocumentStore.getState().setActions` 경유
- `apps/builder/src/services/ai/tools/createElement.ts` — `tag: "frame"` 처리 + legacy `Group + customId="group_N"` 도구 제거
- `apps/builder/src/services/ai/systemPrompt.ts` — `data_tables` / `SerializedEvent` / `SerializedAction` / `frame` schema 가이드 추가

### Phase 4 Gate G4

- AI 도구 안 `Transform 3단계` 0 grep gate (ADR-132 정합)
- AI 도구 안 `element.props.events` 0 grep gate (ADR-131 정합)
- AI 도구 안 `type: "Group" + customId="group_N"` 0 grep gate (ADR-130 정합)
- `data_tables.runtimeData` sink + `useCollectionData` read 진입점 사용 검증
- type-check + vitest PASS

## 7. Phase 5 — 컴포넌트 카탈로그 (D6, G5)

**목적**: RAC / RSP 문서 기반 컴포넌트 카탈로그 + Tier 2 동적 주입. ADR-011 Section 1.3.1 "컴포넌트 지식 격차" 해소.

### Phase 5 산출물

- `apps/builder/src/services/ai/catalog/componentCatalog.ts` — 65+ 컴포넌트 메타데이터 (variant / size / props / a11y / Compositional 구조)
- `apps/builder/src/services/ai/catalog/dynamicInjection.ts` — Tier 2 동적 주입 (작업 컨텍스트 기반 선택적 로딩, ~311K tok → 128K context 안 fit)
- `apps/builder/src/services/ai/catalog/specSync.ts` — `packages/specs/src/components/*.spec.ts` → 카탈로그 자동 동기화 (Phase 6+)
- `apps/builder/src/services/ai/systemPrompt.ts` — 카탈로그 진입점 + 동적 주입 hook

### Phase 5 Gate G5

- 카탈로그 65+ 컴포넌트 메타데이터 land + RAC / RSP 문서 매핑 검증
- 동적 주입 후 Props 정확도 ≥ 90% (Phase 5 검증 데이터셋 — 15 시나리오 기반)
- Qwen3 14B Q4_K_M (16GB) Props 정확도 ≥ 75% (보정 후)
- Qwen3.5-35B-A3B Q4_K_M (36GB) Props 정확도 ≥ 90% (보정 후)
- type-check + vitest PASS

## 8. Phase 6 — AI 설계 지능 Plan→Execute→Verify (D7)

**목적**: 멀티스텝 대시보드 디자인 + 자기 수정 (max 2회). Pencil / Google Stitch / v0.dev 참조.

### Phase 6 산출물

- `apps/builder/src/services/ai/planning/PlanService.ts` — Plan 단계 (자연어 → 컴포넌트 구조 → 레이아웃 → 스타일 → 데이터 분해)
- `apps/builder/src/services/ai/planning/ExecuteService.ts` — Execute 단계 (Plan 결과 → 도구 호출 시퀀스)
- `apps/builder/src/services/ai/planning/VerifyService.ts` — Verify 단계 (결과 → 자연어 요청 정합 검증) + 자기 수정 (max 2회)
- `apps/builder/src/services/ai/tools/createComposite.ts` — 팩토리 기반 합성 컴포넌트 생성 (Card → CardHeader + CardContent / Tabs → TabList + TabPanel 등)
- `apps/builder/src/services/ai/templates/layoutTemplates.ts` — 레이아웃 템플릿 (대시보드 / 폼 / 리스트 / 카드 그리드 등)

### Phase 6 검증 (Gate 없음, Phase 7 G6 통합 검증)

- "사용자 관리 대시보드 만들어줘" 시나리오 1회 통과 + 자기 수정 ≤ 1회
- "이커머스 상품 카탈로그 만들어줘" 시나리오 1회 통과 + 자기 수정 ≤ 1회
- 멀티스텝 계획 정확도 ≥ 75% (T2 36GB 기준)

## 9. Phase 7 — 모델 라우팅 + 폐쇄망 (D8, G6)

**목적**: 난이도 기반 자동 라우팅 + 폐쇄망 first-class 지원.

### Phase 7 산출물

- `apps/builder/src/services/ai/routing/DifficultyEstimator.ts` — 자연어 요청 난이도 추정 (단순 / 중간 / 복합)
- `apps/builder/src/services/ai/routing/ModelRouter.ts` — 난이도 → 모델 선택 (단순 → 로컬, 복합 → 온라인 전환 제안)
- `apps/builder/src/services/ai/routing/OfflineFallback.ts` — 폐쇄망 환경 복합 작업 자동 분할
- `apps/builder/src/builder/panels/ai/components/ModelSelector.tsx` — 사용자 모델 선택 UX (Ollama / Anthropic / OpenAI-compatible)
- `apps/builder/src/builder/panels/ai/components/OfflineIndicator.tsx` — 폐쇄망 상태 표시 + 작업 분할 안내

### Phase 7 Gate G6

- 폐쇄망 단순 작업 100% 통과 (인터넷 미연결 환경)
- 폐쇄망 복합 작업 자동 분할 통과 (단순 작업 시퀀스로 분해)
- 모델 라우팅 정확도 측정 (단순 → 로컬 / 복합 → 온라인 제안 정합 ≥ 90%)
- type-check + vitest PASS

## 10. Phase 8 — AIPanel UX 1년차 신입 baseline (D9)

**목적**: ADR-133 Q4 framing "1년차 신입 개발자라도 사용할 수준" 정합. depth 4→2 축소.

### Phase 8 산출물

- `apps/builder/src/builder/panels/ai/AIPanel.tsx` — depth 2 (default 표면 = 자연어 입력 + 도구 실행 결과 시각 피드백)
- `apps/builder/src/builder/panels/ai/components/AdvancedMode.tsx` — 고급 모드 (Plan 단계 시각화 + 자기 수정 표시, L4 power user 격리)
- `apps/builder/src/builder/panels/ai/components/ToolCallMessage.tsx` — 1년차 신입 baseline UX (도구 호출 의도 + 결과 한 줄 요약)
- `apps/builder/src/builder/panels/ai/components/AgentControls.tsx` — 중단 버튼 + 현재 turn 표시 (보존 + UX 단순화)

### Phase 8 검증 (Gate 없음, evaluator agent screenshot)

- depth 4 → 2 축소 measure
- 1년차 신입 baseline 시나리오 5개 통과 (evaluator agent screenshot 검증)
- ADR-133 Q4 framing 정합 검증

## 11. Phase 9 — Electron Utility Process 내장 (G7)

**목적**: node-llama-cpp Utility Process 내장 + Canvas FPS 60fps 유지. **Electron 마이그레이션 시점 의존 (R1 HIGH 위험)**.

### Phase 9 산출물

- `apps/builder/electron/utilityProcess/llmWorker.ts` — node-llama-cpp Utility Process
- `apps/builder/src/services/ai/providers/NodeLlamaCppProvider.ts` — Electron IPC 경유 Provider 정식 land
- 모델 다운로드 + 관리 UX (~18.5GB Qwen3.5-35B-A3B Q4_K_M)
- Canvas FPS measure + Utility Process 우선순위 조정

### Phase 9 Gate G7

- node-llama-cpp Utility Process 내장 + AI 추론 중 Canvas 60fps 유지 (±5fps 이내)
- 모델 다운로드 UX 통과 (사용자 onboarding)
- type-check + vitest PASS

**Phase 9 실패 시 대안**: Phase 1-8 stand-alone 유지 (Ollama 기본 운영) — Electron 마이그레이션 land 까지 보류

## 12. baseline freeze 표 (Phase 0 작업 시 채움)

| 영역                   | 추정 file count | 실측 file count | gap (실측/추정) | 1.5x 초과 여부 |
| ---------------------- | --------------- | --------------- | --------------- | -------------- |
| Phase 1 Provider       | ~7 file         | TBD             | TBD             | TBD            |
| Phase 2 Groq 제거      | ~5 file         | TBD             | TBD             | TBD            |
| Phase 3 도구 canonical | ~10 file        | TBD             | TBD             | TBD            |
| Phase 4 격차 정합      | ~12 file        | TBD             | TBD             | TBD            |
| Phase 5 카탈로그       | ~8 file         | TBD             | TBD             | TBD            |
| Phase 6 Plan→E→V       | ~15 file        | TBD             | TBD             | TBD            |
| Phase 7 라우팅         | ~8 file         | TBD             | TBD             | TBD            |
| Phase 8 AIPanel UX     | ~10 file        | TBD             | TBD             | TBD            |
| Phase 9 Electron       | ~10 file        | TBD             | TBD             | TBD            |

1.5x 초과 시 [adr-writing.md M4](../../../.claude/rules/adr-writing.md) sub-group N≥3 분할 / scope inflation 사용자 confirm 의무 적용.

## 13. ADR-011 Phase A1~A4 land 산출물 보존 영역 (Phase 2 전환 대상)

| 산출물                                  | Phase 2 처리                                                     |
| --------------------------------------- | ---------------------------------------------------------------- |
| `GroqAgentService.ts`                   | `AgentService.ts` rename + Provider 추상화 경유                  |
| 7개 도구 (createElement 등)             | Phase 3 canonical mutation API 정합 + Phase 4 4 격차 정합        |
| `AIPanel.tsx` + ChatMessage 등 컴포넌트 | Phase 8 depth 4→2 축소 + 1년차 신입 baseline 적용                |
| `useAgentLoop.ts`                       | Provider 추상화 경유 정합 갱신                                   |
| `AbortController` + AgentControls       | 보존 (Phase 2 회귀 검증 필수)                                    |
| G.3 시각 피드백 (`aiVisualFeedback`)    | 보존 (Phase 2 회귀 검증 필수)                                    |
| `IntentParser.ts`                       | 보존 검토 (최후 fallback) or 제거 (Provider 추상화 후 불필요 시) |
| `systemPrompt.ts`                       | Ollama / Anthropic / OpenAI-compatible 정합 갱신 + 카탈로그 hook |
| `styleAdapter.ts`                       | 보존 (CSS-like → 내부 스키마 변환, AI-A5a 단위 정규화)           |
| `definitions.ts`                        | Phase 3 도구 JSON Schema canonical 정합 갱신                     |

## 14. ADR-054 Proposed 영역 흡수 매핑

| ADR-054 Phase                    | ADR-134 매핑                         |
| -------------------------------- | ------------------------------------ |
| Phase 1 (Groq 제거 + Provider)   | Phase 1 + Phase 2                    |
| Phase 2 (로컬 모델 Tool Calling) | Phase 2 + Phase 5 (카탈로그 보정)    |
| Phase 3 (Canvas FPS)             | Phase 9 (Electron Utility Process)   |
| Phase 4 (컴포넌트 카탈로그)      | Phase 5                              |
| Phase 5 (Props 정확도)           | Phase 5 G5                           |
| Phase 6 (디자인 지능)            | Phase 6                              |
| Phase 7 (접근성 감사)            | **ADR-134 scope 밖** (ADR-136+ 응용) |

## 15. 사용자 plan review 후 진입 절차

본 plan-only land 이후 진입 절차 (ADR-133 동일 패턴):

1. **사용자 plan review** — 본 design breakdown 정독 + 정정 사항 명시
2. **차단 / 정당화 메모리 평가** — Phase 0 진입 전 (`feedback-execute-adr-surface-minimization` / `feedback-no-derived-adr-mid-execution` 평가)
3. **Phase 0 inventory baseline freeze 진입** — `~/.claude/plans/adr-134-baseline-inventory.md` 작성
4. **Phase 1 진입** — Phase 0 baseline freeze 사용자 confirm 후
5. **각 Phase 별 land 절차** — type-check + vitest + grep gate 통과 + main 직접 push (PR 금지 정합) + CHANGELOG entry

각 Phase 별 commit 단위는 single land 권장 (`feedback-execute-adr-surface-minimization` 정합). sub-step 분해 (1-α/1-β/...) 금지 — 사용자 framing 위반.
