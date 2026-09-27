# ADR-245 구현 상세 — AI 패널 on-device 모델 경로 (Chrome built-in AI)

> 본문: [ADR-245](../245-ai-panel-on-device-model-path.md). 이 문서는 Phase 0 (go/no-go 계측) 과, G0 통과 시에만 착수하는 Phase 1~4 의 작업 단위를 담는다. **G0 가 no-go 면 Phase 1 이후는 착수하지 않는다** — 그 경우 이 문서는 Phase 0 기록만 남기고 닫힌다.

## 1. 선행 ADR 관계 lock-in (4 질문)

| #   | 질문                   | 답                                                                                                                                                                                                                                                                                                                              |
| --- | ---------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Q1  | base / 응용 분류       | ADR-134 (provider · 프로파일 인프라) = base, ADR-202 (compiler-first · IR one-shot) = base 의 응용, ADR-245 = 202 의 one-shot 경로에 provider 하나를 더하는 응용. 245 는 134 D1 의 "2-way 어댑터" 를 3-way 로 넓히는 **부분 개정** 이며 134 · 202 의 결정을 뒤집지 않는다                                                       |
| Q2  | schema 직교성          | 새 저장 schema 없음. `BuilderCommandProgram` (`compiler/contracts.ts:53-58`) 을 그대로 소비한다. 프로파일 저장 모양 (`composition.ai.profiles`) 에 provider 값 하나가 늘 뿐 — 기존 저장값 해석 무변경                                                                                                                           |
| Q3  | 선행 전제 reverse 검증 | 202 는 "OpenAI 호환 one-shot 은 미검증이라 Agent 로 보낸다" (`compiler/runtime.ts:73-78`) 를 전제로 둔다. 245 Phase 1 은 이 판정을 provider id 가 아니라 **구조화 출력 지원 여부** 로 바꾼다 — 202 전제의 반전이 아니라 202 G4 (UNVERIFIED 유지 항목) 의 재개다. 이 재개를 245 안에서 할지 202 후속으로 할지는 사용자 판정 대상 |
| Q4  | fork 분리 vs 단일 통합 | 대안 B (서버 경로 축소) 가 G0 에서 이기면 B 는 202 후속으로 넘기고 245 는 Deprecated (no-go 기각) 로 닫는다 — 245 안에 B 구현을 흡수하지 않는다 (사용자 확인 대상, 본문 §사용자 결정 지점)                                                                                                                                      |

## 2. Phase 0 — go/no-go 계측 (문서 + 계측 스크립트만, 제품 코드 변경 0)

### 2.1 계측 arm

| arm  | 경로                                                                                                                                            | 조건                                                                                                   |
| ---- | ----------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------ |
| D0   | 대조군 — 수정 전 동작. local-ollama 프로파일에서 `reasoningEffort` 를 모두 비움 (모델 기본 thinking)                                            | 같은 기기 · 같은 모델 · 같은 요청 세트                                                                 |
| D1   | 수정 후 프리셋 그대로 — main/executor/fast `none`, planner/verifier 기본                                                                        | planner 미구성 (AgentService 단일) · planner 구성 (Orchestrator) 두 가지 모두                          |
| D1'  | D1 + planner/verifier 도 `none`                                                                                                                 | 프리셋 한 줄 변경의 효과 분리용                                                                        |
| B1   | Ollama `/v1/chat/completions` 에 `response_format: { type: "json_schema", … programJsonSchema() }` 로 one-shot IR (계측 스크립트가 직접 호출)   | system prompt = `oneShot.ts:19` 와 같은 문장 · manifest 전체 / 부분 두 가지                            |
| A    | Prompt API `LanguageModel` 세션 + `responseConstraint: programJsonSchema()` · 입력은 Translator ko→en 뒤 · 출력 IR 은 `validateProgram` 로 판정 | 자격 기기 1대 이상 · cold (세션 생성 포함) / warm (세션 재사용 없이 새 세션, 모델은 이미 받음) 두 가지 |
| A-en | A 에서 번역 단계를 빼고 영어 원문 요청                                                                                                          | 번역 비용 · 번역 품질 영향 분리                                                                        |

B1 · A · A-en 은 제품 코드가 아니라 `apps/builder/scripts/adr245-*.mjs` 계측 스크립트 (Playwright 로 빌더를 띄워 `readCompilerState()` 의 실제 manifest · context 를 꺼내 쓴다) 다. manifest 를 손으로 만들지 않는다 (§측정 무결성 Q1).

### 2.2 요청 세트 (Q1 · Q5)

- 사람이 쓴 모호 요청 **20개 이상** — ADR-202 compile 결과가 `ambiguous` 인 한국어 문장 (예: "이 화면을 조금 더 보기 좋게 정리해줘", "버튼 좀 크게", "선택한 카드 색을 차분하게"). 생성·복제 문장 금지.
- 각 요청의 **정답 IR (또는 "표현 불가")** 을 계측 전에 사람이 작성해 고정한다 — 채점 기준이 모델 출력에서 오지 않게 한다. 요청은 두 부분 세트로 나눈다: **적용 가능** (정답 IR 이 1 operation — `programContract` 는 정확히 1 op 만 실행, `contracts.ts:53-58`) ≥ 16 개와 **표현 불가** (정답 = 적용 없음) ≥ 4 개. 표현 불가 요청은 모델이 빈 operations 를 내도 `validateProgram` 이 거부하므로 (`runtime.ts:94-96`) 첫 적용 시각이 존재하지 않는다 — 지연 지표에서 뺀다.
- 절반은 선택 요소가 있는 상태, 절반은 없는 상태.
- 요청 세트와 정답표는 사용자 승인 뒤 고정 (본문 §사용자 결정 지점).

### 2.3 지표

| 지표                  | 정의                                                                                                                                                                                                                          |
| --------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 계약 지표             | **적용 가능 부분 세트만**: 제출 (Enter) → **첫 명령이 canonical 에 적용된 시점** 까지의 시간 p50 / p95 (arm 별 n ≥ 16 × 3 회). 적용이 일어나지 않은 표본 (거부 · 오답 무적용) 은 지연 값을 만들지 않고 정답률에서 실패로 센다 |
| 정답률                | 적용 가능: 정답표 대비 적용된 IR 일치율 (type · 대상 · 필드 · 값). 표현 불가: **적용 0** 이면 정답 (빈 operations 거부 · legacy 로 넘김 모두 정답, 무엇이든 적용되면 오답) — 두 부분 세트를 따로 보고                         |
| 종료 시간 (표현 불가) | 제출 → 사용자에게 최종 응답 (거부 안내 또는 legacy Agent 결과) 이 표시된 시점 p50 / p95 — 계약 지표와 섞지 않는다                                                                                                             |
| 유효율                | `validateProgram` 통과율 (JSON · semantic)                                                                                                                                                                                    |
| 구성 비용 (따로 보고) | A: 모델 다운로드 시간 · Translator 언어팩 다운로드 시간 · `LanguageModel.create` 시간 / B1: Ollama cold load                                                                                                                  |
| 한국어 손실 (A 한정)  | A 정답률 − A-en 정답률                                                                                                                                                                                                        |
| context 사용량 (A)    | manifest 전체 · 축소본 각각의 세션 context 사용량 (`measureContextUsage` 류) — 전체 manifest 가 한 세션에 들어가는가                                                                                                          |
| 프레임 (A · B1)       | 추론 중 Canvas 프레임 time p95 (`pnpm perf:baseline -- --lane frame` 조건 재사용) — GPU 를 Skia 와 나눠 쓰는 영향                                                                                                             |

### 2.4 측정 조건 기록 (Q2 · Q3 · 조건 없는 수치 인용 금지)

기기 (칩 · RAM · GPU VRAM · 여유 저장 공간) · OS · Chrome 버전 · `LanguageModel.availability()` 결과 · Ollama 버전 · 모델 · `context_length` (`/api/ps`, 4096 절단 함정 — 메모리 `reference-ollama-default-num-ctx-truncates-tool-prompt`) · `visibilityState` visible · 전원 연결 여부 · 반복 순서 (arm 을 섞어 돌려 열 상태 편향 제거).

불리한 경우 (Q2) 는 필수 arm 으로 둔다: 한국어 입력 · 모델 미다운로드 첫 사용 · Safari/WebKit (A 가 없으니 fallback 경로 시간) · 선택 요소 없는 문서.

### 2.5 판정 (본문 G0 의 계산 절차)

1. `best_server = min(D1, D1', B1)` 을 p95 기준으로 고른다.
2. `best_server` p95 가 절대 목표 (본문 G0, 사용자 확정) 이하 → **no-go**. D1/D1' 이면 이 ADR 은 Deprecated (no-go 기각), B1 이면 Deprecated (no-go 기각) + B 는 202 후속으로 인계.
3. 아니면 A 가 (a) p50 ≤ 0.5 × best_server p50 · (b) p95 ≤ best_server p95 · (c) 정답률 ≥ best_server 정답률 − 5%p · (d) 추론 중 프레임 p95 가 대조 (추론 없음) 대비 악화 ≤ 본문 G5 기준 — 넷 다 만족 → **go** (Accepted 로 올리고 Phase 1 착수).
4. 그 밖 → **no-go (보류)** — Deprecated, Status 에 재개 조건 기록. 재개 조건: Prompt API 모델의 한국어 지원 · 또는 자격 기기 비율 변화 · 또는 B/D 가 더 느려지는 사용 패턴 변화.

산출: `docs/adr/evidence/245-phase0-go-no-go.md` (arm 별 원자료 · 조건 · 판정 계산).

## 3. Phase 1 — one-shot 경로를 provider 능력으로 연다 (go 이후)

- `compiler/runtime.ts:73-78` 의 `provider.id !== "anthropic"` 판정을 provider 가 선언하는 능력 (`structuredOutput: true`) 으로 바꾼다. Anthropic 은 기존대로, 새 provider 는 선언, OpenAI 호환은 선언하지 않는다 (B1 결과가 좋아도 이 Phase 에서 켜지 않는다 — 202 후속 소관).
- `oneShot.ts` 는 provider 중립 유지. manifest 를 context 예산에 맞춰 줄이는 함수 (Tier 1 type 목록 + 요청 관련 type 상세 — ADR-134 Phase 5 의 선택 주입 재사용) 를 one-shot 입력에 쓴다. 전체 manifest 로 충분하다는 Phase 0 결과가 있으면 생략.
- unit: 능력 판정 · 능력 없는 provider 는 `legacy` 로 (현재 동작 보존) · 삭제/명령 거부 (`runtime.ts:109-120`) 무변경.

## 4. Phase 2 — `ChromeBuiltInProvider` 어댑터

- 위치: `services/ai/providers/ChromeBuiltInProvider.ts` — AI 패널 lazy chunk 안에서만 도달 (현재 `AgentProfileRegistry` · `agentProfiles` 소비처 7곳이 전부 AI 패널 · AI 서비스 안이다). **레지스트리 (`createProvider` — 동기 팩토리, `AgentProfileRegistry.ts:222-239`) 를 거치지 않는다** — 아래 one-shot 전용 resolver 가 동적 import 한다.
- **one-shot 전용 provider resolver (리뷰 245 R1 h1)**: `agentProfiles.ts` 에 `resolveOneShotProvider(): Promise<{ provider: LLMProvider; kind: "on-device" | "main" } | null>` 를 추가하고, `runtime.ts:69-74` 의 one-shot 분기가 `resolveProvider("main")` 대신 이것을 부른다. 선택 순서: ① `composition.ai.onDevice` 가 on 이고 `LanguageModel` feature-detect 통과 · `availability() === "available"` 이고 한국어 요청이면 `Translator` 도 available → `await import("./ChromeBuiltInProvider")` 로 만든 provider (`kind: "on-device"`). ② 그 밖 (off · 미지원 · `downloadable`/`downloading` · 번역 불가 · import 실패) → 지금의 `resolveProvider("main")` 를 그대로 반환 (`kind: "main"`) — 이후 `provider.id` 판정 (Anthropic 이면 one-shot, 아니면 `legacy`) 은 무변경. ③ main 도 없으면 `null` → 지금처럼 `provider-not-configured`. `resolveProvider` · 레지스트리 · Agent 경로의 동기 계약은 건드리지 않는다. `availability()` 는 요청마다 부르되 결과 캐시 없음 (다운로드 완료가 바로 반영되게). unit: 순서 ①②③ 각각 · import 실패 → ② · signal abort 중 resolver 대기 → `aborted`.
- 타입: npm 의존성 추가 없이 필요한 표면만 로컬 ambient 선언 (`LanguageModel` · `Translator` · `LanguageDetector`). 모든 호출 전 `typeof LanguageModel !== "undefined"` feature-detect — Safari/Firefox 에서 참조 오류 0.
- `completeWithTools` 계약: `tools` 가 비어 있지 않으면 즉시 `LLMProviderError` (도구 호출 미지원 — Agent/Orchestrator 경로에 들어오지 않게). `responseSchema` → `responseConstraint`. `promptStreaming` 조각 → `text-delta`, 끝 → `stop{reason:"end"}`. `signal` → 세션 `destroy()` + abort.
- 세션 수명: 요청마다 새 세션 (Guess Who 패턴 — 이전 대화가 IR 에 새지 않게), system 문장은 `initialPrompts`. 샘플링 파라미터 (temperature/topK) 는 웹에서 Origin Trial 이라 **넘기지 않는다**.
- 한국어 전처리: `LanguageDetector` 또는 locale 로 ko 판정 → `Translator(ko→en)` 로 요청 문장만 번역. manifest · context 는 이미 영어 식별자라 번역하지 않는다. 결과 메시지는 IR 로부터 i18n 문장을 코드가 만든다 — **역번역 없음** (출력이 산문이 아니라 IR 이라 Terra 패턴의 뒤 절반이 필요 없다).
- 출력 불안정: 파싱 실패 · schema 불일치 · 빈 operations 1 회 → 같은 세션 재시도 없이 기존 경로 (`legacy`) 로 넘긴다 (재시도 0 회). JSON 수선 (CyberAgent 패턴) 은 Phase 0 유효율이 95% 미만일 때만 추가.
- **fallback 반환 계약 (리뷰 245 R1 h2)**: 지금 `runtime.ts` 의 `rejected()` 는 모든 오류를 `handled: true` 로 돌려주고 `useAgentLoop.ts:132-150` 은 그 자리에서 "이해 못함" 으로 끝낸다 — 어댑터 오류만으로는 legacy Agent 가 돌지 않는다. `runCompilerRequest` 에 on-device provider 전용 분기를 둔다: provider 가 `chrome-built-in` 이고 실패가 **mutation 전** (`metric.toolExecutions === 0`) 이며 종류가 `invalid-or-unavailable-output` · `validateProgram` 거부 (빈 operations 포함) · `source-mismatch` 이면 `{ handled: false, route: "legacy", fallbackReason }` 를 반환한다. `useAgentLoop` 는 `handled: false` + proposal 없음이면 이미 Agent 경로로 간다 (`:152` 이후) — 소비자 변경 0. 안전 거부 (`uncertain-action` · `unrequested-target` · `context-changed` · `aborted`) 는 지금처럼 `handled: true` 로 끝낸다 (fallback 이 모델 출력의 위험 판단을 우회하지 않게). 중복 적용 방지: fallback 은 `toolExecutions === 0` 일 때만 열리므로 on-device 경로가 적용한 뒤 Agent 가 다시 적용하는 경우가 없다. Anthropic one-shot 의 오류 처리는 무변경. unit: 실패 종류 × provider 표 (fallback 3 종 → `handled:false` · 안전 거부 4 종 → `handled:true` · Anthropic 무효 출력 → `handled:true`) · 적용 뒤 오류 → fallback 없음.

## 5. Phase 3 — 프로파일 · 상태 · 동의 UI

- `LLMProviderId` (`LLMProvider.ts:21`) 에 `"chrome-built-in"` 추가 (provider 객체의 `id` 용). 프로파일 · 레지스트리에는 넣지 않는다 — `isProfileConfigured` · `createProvider` 무변경 (선택은 §4 resolver 가 한다).
- 라우팅: `chrome-built-in` 은 **one-shot 전용**. `createAgentRunner` (`createAgentRunner.ts:113-135`) 와 `AgentProfileRouter` 는 이 provider 를 main/planner/executor/verifier 후보에서 제외 → 모호 요청이 one-shot 에서 거부되면 Ollama 프로파일이 있을 때만 legacy Agent 로, 없으면 지금과 같은 "설정 필요" 안내.
  - 설계 선택: 새 프로파일 id (`oneShot`) 를 두지 않고 main 프로파일과 별도로 "빠른 해석 모델" 설정 1개를 둔다 — 프로파일 표 (D8 라우팅) 를 흔들지 않기 위해서. 저장 키는 `composition.ai.profiles` 와 분리 (`composition.ai.onDevice`), 기본값 off.
- 상태 표시: `ConnectionStatus.tsx` 에 모델 상태 4단계 (unavailable · downloadable · downloading(진행률) · available — Yahoo TW 패턴) 와 한국어 번역 상태 (Translator 언어팩) 를 한 줄로. unavailable 사유 (브라우저 미지원 · 기기 조건 · 정책) 는 사용자 문장으로.
- 동의: `downloadable` 에서 자동 다운로드 금지. 사용자가 누른 버튼 (user activation) 에서만 `create()` → 크기 · 저장 공간 안내 문구 먼저 (Bright Sites 패턴). 거절 · 다운로드 실패는 기존 경로 무변경.
- 다운로드 중 (Miravia 패턴): 모호 요청은 지금 경로 (Ollama legacy) 로 계속 처리하고, `available` 이 된 뒤부터 one-shot 으로 바꾼다.
- i18n 키는 ko-KR · en-US 동시 (`noHardcodedKoreanUi.static.test.ts` 준수).

## 6. Phase 4 — 게이트 · live

- G1 (IR 유효율) · G2 (fallback) · G3 (한국어) · G4 (번들) · G5 (프레임) · G6 (live) — 본문 Gates 표.
- 번들: before/after 는 별도 worktree clean 빌드 (메모리 `feedback-baseline-build-separate-worktree-original-deps`). Builder · Preview initial Δ ≤ 0, `ChromeBuiltInProvider` initial 귀속 0, `lazyPanelBoundary.static.test.ts` 에 새 모듈 추가.
- live (Chrome, 자격 기기): 모델 available 상태에서 모호 요청 3종 → 적용 · undo 1회 복원 / 모델 미다운로드 → 동의 버튼 → 다운로드 중 요청은 Ollama 로 → 완료 뒤 one-shot / 한국어 요청 → 번역 → 적용 / WebKit (Playwright) → 상태 "브라우저 미지원" · 기존 경로 동작 · page error 0.
- 문서: README · CHANGELOG (사용자-가시 변경) · `docs/how-to/development/ai-local-endpoint.md` 에 on-device 절.

## 7. 파일 범위 (go 이후 예상)

| 파일                                                                             | 변경                                         |
| -------------------------------------------------------------------------------- | -------------------------------------------- |
| `services/ai/providers/LLMProvider.ts`                                           | `LLMProviderId` 확장 · 구조화 출력 능력 선언 |
| `services/ai/providers/ChromeBuiltInProvider.ts` (신규)                          | 어댑터 · ambient 타입 · 번역 전처리          |
| `services/ai/providers/AgentProfileRegistry.ts`                                  | 구성 판정 · 3번째 분기 (동적 import)         |
| `services/ai/compiler/runtime.ts`                                                | one-shot 진입 판정을 능력 기반으로           |
| `services/ai/compiler/oneShot.ts`                                                | manifest 예산 맞춤 (Phase 0 결과에 따라)     |
| `services/ai/createAgentRunner.ts` · `routing/AgentProfileRouter.ts`             | one-shot 전용 provider 제외                  |
| `builder/panels/ai/components/ConnectionStatus.tsx` · `AgentProfileSettings.tsx` | 상태 4단계 · 동의 · 설정                     |
| `i18n` 라벨 (ko-KR · en-US)                                                      | 상태 · 동의 · 미지원 사유 문장               |
| `builder/panels/core/lazyPanelBoundary.static.test.ts`                           | 새 모듈 경계                                 |
