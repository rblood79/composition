# ADR-245: AI 패널 on-device 모델 경로 — Chrome built-in AI (Prompt API + Translator) 선택 경로

## Status

Proposed — 2026-09-27 (사용자 `/create-adr` — AI 패널 지연 개선 후보 중 on-device 경로. **사용자 전제: 이 경로는 선택 사항이며, reasoningEffort 수정 (`1f0aa5d23`) 뒤에도 지연이 부족할 때만 정당화된다.** 따라서 Phase 0 은 go/no-go 계측이고, no-go 로 닫는 것도 정상 종결이다. no-go 는 상태 계약 (`adr-writing.md` §Status 전이) 안에서 기록한다 — **기각은 Deprecated**, 재개 조건이 살아 있는 **보류는 Proposed 유지** + Status 문장에 `보류 (no-go)` · 재개 조건 · Phase 0 수치 링크. 새 상태값을 만들지 않는다.)

**개정 2026-10-05** (사용자 지시 — ADR-248 catalog 전환 뒤 전체 재대조): 결정과 Phase 0 설계는 그대로다. AI 쓰기 · 읽기 경로가 catalog 문서로 옮겨졌지만 (`aiWriteHost.ts` · `aiReadHost.ts`), 이 ADR 이 기대는 경계 — provider 선택 · one-shot IR 계약 · `validateProgram` — 는 그 위층이라 바뀌지 않았다. 코드 인용 라인 · 번들 기준선 · 「적용」 의 뜻 (catalog 문서 commit) 을 갱신했다.

## Context

### 문제 — 모호한 요청의 지연

명시적 요청은 이미 LLM 없이 처리된다. ADR-202 compiler direct 경로가 "버튼 생성해" 를 모델 호출 0 · 2.0~2.1 초에 적용한다 ([ADR-202 Live Exercise 2차](completed/202-builder-ai-compiler-first-command-execution.md) §Live Exercise 2차). 남은 지연은 compile 결과가 `ambiguous` 인 요청 ("이 화면을 조금 더 보기 좋게 정리해줘" 류) 이다.

- `compiler/runtime.ts:68-78` — `ambiguous` 는 main 프로파일 provider 를 부르되, `provider.id !== "anthropic"` 이면 `legacy` 로 돌려 기존 Agent 루프 (`createAgentRunner.ts:125-131` — planner 가 구성돼 있으면 Orchestrator, 아니면 `AgentService` 단일 루프, `AgentService.ts:33` `MAX_TURNS = 10`) 로 넘긴다. IR 만 받는 one-shot (`compiler/oneShot.ts`, `responseSchema: programJsonSchema()`) 은 Anthropic 에만 열려 있다.
- 기준선 (수정 전): "버튼 생성해" 가 Agent 경로일 때 26.8 초 = prompt 평가 3,794 token / 22.5 초 + Qwen3 기본 thinking 약 8.1 초, 요청 본문 약 15 KB (system prompt 5,071 자 + 도구 schema 9개 6,039 자) — 2026-09-01, `qwen3:14b`, 메모리 `project-ai-assistant-ollama-latency-rootcause`. ADR-202 승격 live (2026-09-16) 의 모호 요청 legacy Agent 는 **호출당 28~106 초** (n_tokens ≈ 10.8k, 11 t/s).
- 2026-09-27 수정 (`1f0aa5d23` · 하니스 `a760c8cf1`): 프로파일 `reasoningEffort` 가 요청까지 전달되고 (`AgentProfileRegistry.ts:232-234` → `OpenAICompatibleProvider.ts:120` `reasoning_effort`), `ReasoningEffort` 에 `"none"` 추가 (`LLMProvider.ts:34-40`, OpenAI 호환 전용). local-ollama 프리셋 main · executor · fast = `none`, planner · verifier = 모델 기본 (`AgentProfileRegistry.ts:145-174`). **모호 요청의 첫 호출은 planner 라 planner 를 구성한 사용자는 여전히 thinking 이 돈다** (`a760c8cf1` 메시지). 저장된 프로파일은 프리셋을 다시 적용해야 새 값이 들어간다 (`agentProfiles.ts:46-53` — 저장값이 있으면 프리셋을 읽지 않는다).
- **수정 뒤 모호 요청 지연은 아직 아무도 재지 않았다.** 이 ADR 의 정당성은 그 수치에 달려 있다.

### 코드 사실 — 이 ADR 이 기대는 경계

- `LLMProviderId = "anthropic" | "openai-compatible"` (`providers/LLMProvider.ts:21`). ADR-134 D1 은 어댑터를 이 2-way 로 줄였다.
- **원격 provider 는 브라우저에서 실제로 막혀 있다.** `requestStream` 이 모든 호출 전에 `assertBrowserCallAllowed` (`LLMProvider.ts:218-224, 294`) 를 부르고, 우회 필드 `allowRemoteDirect` 는 저장소 안에 설정하는 호출자가 없다 (grep 0 — 타입 선언 · 판정 코드 · 테스트뿐, 판정은 `import.meta.env.DEV` 에서만 통과). 프록시 (ADR-134 D10) 는 아직 없다. 그래서 **지금 AI 패널에서 실제로 동작하는 LLM 은 로컬 · 사설망 OpenAI 호환 endpoint (Ollama 등) 뿐**이고, Anthropic one-shot 은 실사용 경로가 아니다. "on-device 가 안 되면 Anthropic 으로" 는 현재 성립하지 않는 fallback 이다 — fallback 은 Ollama 프로파일 또는 "설정 필요" 안내다.
- one-shot 의 IR 계약은 provider 중립이다: `programContract` (`compiler/contracts.ts:53-58`, operations 정확히 1) · `programJsonSchema()` (`:68-73`) · `validateProgram` 재검증과 삭제/명령 거부 (`runtime.ts:94-120`). 새 provider 는 이 계약을 그대로 소비할 수 있다.
- **문서 쓰기 · 읽기는 catalog 다 (ADR-248)**: 요소 도구 (`create_element` · `update_element` · `delete_element`) 는 열린 Builder 가 설치한 `AiWriteHost` (`aiWriteHost.ts`) 를 거쳐 catalog 명령으로 쓰고 (쓰기 1 회 = history 1 단계), manifest 의 컴포넌트 필드는 `catalogCreationEditFields` 에서, context 는 `AiReadHost` 에서 나온다 (`compiler/builderHost.ts:25-60`). host 가 없으면 context 는 비어 있다 — 계측은 반드시 열린 Builder 안에서 `readCompilerState()` 를 읽는다. IR 계약 · executor 진입 (`runtime.ts:123-126`) 은 무변경이라 새 provider 가 닿는 표면은 ADR-248 전과 같다.
- AI 패널은 lazy chunk 다 (`builder/panels/ai/lazyAIPanel.tsx`, `lazyPanelBoundary.static.test.ts` 의 `ai/AIPanel` 대상). `AgentProfileRegistry` · `agentProfiles` 를 값 import 하는 곳 7개 (`AgentProfileSettings` · `ConnectionStatus` · `useAgentLoop` · `AgentService` · `createAgentRunner` · `AgentProfileRouter` · `compiler/runtime`) 가 전부 AI 패널 · AI 서비스 안이다.
- 연결 상태 UI 는 `builder/panels/ai/components/ConnectionStatus.tsx` — "어느 작업이 어느 프로파일로 가는가" 를 보여 주며, 모델 다운로드 상태 같은 수명주기 표시는 없다.
- ADR-134 Phase 5: catalog 전체 상세 6,454 tok, Tier 1 + 선택 주입 1,389 tok. one-shot 은 현재 `CommandManifest` 전체를 system 문장에 싣는다 (`oneShot.ts:19`). 두 수치는 ADR-248 전 (2026-08-28) 측정이고 manifest 출처가 catalog 편집 계약으로 바뀌었다 — 지금 크기는 Phase 0 의 context 사용량 측정이 다시 잰다 (R4).

### 외부 사실 — Chrome built-in AI (2026-09-27 조사, Chrome for Developers 사례 · 릴리스 노트 원문 대조)

- **Prompt API** 는 Chrome 148 부터 웹에서 stable. 샘플링 파라미터 (temperature · topK) 는 웹에서 아직 Origin Trial. `responseConstraint` (JSON Schema) 로 구조화 출력. Prompt API 는 top-level document 에서 쓴다 (Yahoo TW 사례).
- **언어: Chrome 149 부터 모델 지원 언어는 영어 · 스페인어 · 일본어 · 독일어 · 프랑스어 — 한국어 없음.** Translator API 는 ko 를 지원한다 (데스크톱 한정). composition 의 UI locale 은 ko-KR · en-US (`i18n/locales.ts`) 이고 사용자 요청은 주로 한국어다 (compiler 패턴 자체가 한국어 문장 — `compile.ts:54-70`).
- **하드웨어**: Windows 10/11 · macOS 13+ · Linux · ChromeOS Chromebook Plus. Android · iOS 제외. 여유 저장 공간 22 GB 이상, GPU VRAM 4 GB 초과 또는 CPU 경로 RAM 16 GB + 4 코어. `downloadable` 상태의 모델 다운로드는 user activation 필요. 모델은 Chrome 이 인터넷으로 받는다 — 폐쇄망 (ADR-134 HC7) 에서는 받을 수 없다.
- **Safari/WebKit 미지원**, Apple · Mozilla 가 반대 입장 (TechTimes 2026-05-16) — Safari 지원은 기대하지 않는다. 사용자 브라우저 확인 대상은 Chrome + WebKit (메모리 `user-browser-targets-firefox-not-priority`).
- 사례 패턴: Guess Who (인식과 추론 분리 · `responseConstraint` · 결정은 앱 코드 · 작업마다 새 세션) · Terra (지원 안 되는 언어는 번역 → 영어로 처리 → 역번역, on-device 의 유일한 방법) · Miravia (모델 다운로드 중에는 서버 모델, 끝나면 전환) · Bright Sites (수 GB 다운로드 전 명시 동의 · provider 추상화) · Yahoo TW (unavailable/downloadable/downloading/available 상태를 UI 에 노출) · CyberAgent (출력 형식 불안정 → JSON 수선 · context 사용량으로 token 예산).
- **어느 사례도 Gemini Nano 의 prompt 평가 지연을 보고하지 않는다.** "on-device 가 Ollama 보다 빠르다" 는 근거가 없는 가설이다.

### SSOT 3-Domain 판정

D1 · D2 · D3 어느 것도 아니다. AI provider 선택은 빌더 chrome 의 실행 경로다 — 컴포넌트 DOM · ARIA (RAC 소관) · 컴포넌트 props (RSP 참조) · 캔버스/Preview 시각 결과 변경 0. 모델 출력은 기존 IR 계약을 거쳐 기존 executor 가 적용하므로, 생성되는 요소의 D1~D3 판정은 ADR-202 와 같다.

### Hard constraints

- **HC1 계약 지표** — 모호 요청 중 **적용 가능한 요청** (정답 IR 이 1 operation) 의 "제출 → 첫 명령 적용" 지연 p50 / p95 가 이 ADR 의 유일한 채택 근거다. 표현 불가 요청은 적용 시각이 없으므로 정답률 (적용 0 = 정답) 과 종료 시간으로 따로 채점한다 (breakdown §2.2 · §2.3). 절대 목표와 상대 기준은 G0 (사용자 확정).
- **HC2 번들** — Builder · Preview initial gzip Δ ≤ 0. 어댑터는 AI lazy chunk 안에서만 도달 (ADR-201 상한 Builder ≤ 1,421,000 / Preview ≤ 623,000, 만료 2026-10-25 — ADR-248 뒤 정적 initial Builder 1,228,752 · Preview 394,104, [248 G5 근거](design/248-phase4-g5-evidence.md) §3).
- **HC3 fallback 정합** — on-device 를 쓸 수 없는 모든 경우 (Safari · 기기 미달 · 모델 미다운로드 · 한국어 번역 불가 · 정책 차단 · 폐쇄망 · 출력 무효) 에 동작이 지금과 같다 (Ollama 프로파일 있으면 legacy Agent, 없으면 "설정 필요"). 출력 무효는 지금 `runtime.ts` 가 `handled: true` 로 끝내므로, mutation 전 on-device 의 **출력 형식 오류 (허용 목록 3 종)** 만 `handled: false` 로 돌려 legacy 로 넘기는 반환 분기가 필요하다 — `protected-target` 등 안전 · 의미 거부는 넘기지 않는다 (breakdown §4). on-device 선택은 레지스트리가 아니라 one-shot 전용 비동기 resolver 가 하고, 쓸 수 없으면 지금의 `resolveProvider("main")` 결과를 그대로 쓴다 (breakdown §4).
- **HC4 안전** — 모델 출력은 IR 뿐. `validateProgram` · 삭제/명령 거부 · 대상 선택 일치 (`runtime.ts:94-120`) 를 그대로 지나고, 적용은 기존 executor → `AiWriteHost` → catalog 명령 하나다. 도구 호출 · Agent 루프에 on-device 모델을 넣지 않는다.
- **HC5 동의** — 모델 · 언어팩 자동 다운로드 금지. 사용자가 누른 동작에서만, 크기 · 저장 공간 안내 뒤.
- **HC6 Canvas 프레임** — 추론 중에도 Canvas cadence 유지 (ADR-134 HC1 · CLAUDE.md 성능 기준). on-device 추론은 Skia (CanvasKit WebGL) 와 GPU 를 나눠 쓴다.

### Soft constraints

- npm 의존성 추가 0 (필요한 API 표면만 로컬 타입 선언).
- ADR-134 의 provider 추상화 · ADR-202 의 IR one-shot 을 재사용하고 새 실행 경로를 만들지 않는다.
- ADR-134 노선 α 기각 사유 (제품이 모델 수명주기를 소유) 를 되살리지 않는다 — 모델은 브라우저가 소유하는 것만 허용.

## Alternatives Considered

### 대안 A: `chrome-built-in` provider — IR 전용 one-shot + 한국어 번역 전처리

- 설명: `LLMProviderId` 에 `chrome-built-in` 을 더하고, 이 provider 는 **one-shot IR 경로에서만** 쓴다. `LanguageModel` 세션을 요청마다 새로 만들고 `responseConstraint: programJsonSchema()` 로 IR 만 받는다 (Guess Who). 한국어 요청은 Translator ko→en 으로 요청 문장만 번역한다 (Terra 앞 절반). 출력이 산문이 아니라 IR 이라 역번역이 필요 없다 — 결과 문장은 코드가 i18n 으로 만든다. `availability()` 가 `available` 이 아니면 기존 경로 그대로, 다운로드 중에는 Ollama 로 처리하다 완료 뒤 전환 (Miravia), 상태 4단계 표시 (Yahoo TW), 동의 뒤 다운로드 (Bright Sites). `runtime.ts:74` 의 Anthropic 한정 판정을 "구조화 출력 능력" 판정으로 바꾼다.
- 위험: 기술(H) / 성능(M) / 유지보수(M) / 마이그레이션(L)
  - 기술 H: 한국어가 모델 지원 언어가 아니다 — 디자인 어휘 ("차분하게", "여백 좀") 의 번역 손실이 IR 정답률에 주는 영향은 미측정. Gemini Nano 가 manifest 제약 IR 을 얼마나 맞히는지 미측정. manifest 전체 (6,454 tok 급) 가 세션 context 에 들어가는지 미측정. API 표면이 아직 움직인다 (샘플링 파라미터 OT, 필드 이름 변경 이력).
  - 성능 M: 첫 사용에 수 GB 모델 + 언어팩 다운로드 · 세션 생성 비용. 추론이 Skia 와 GPU 를 나눈다 (HC6). 지연 자체는 공개 수치가 없어 이득 방향도 미확정.
  - 유지보수 M: provider id 가 레지스트리 · 라우터 · 연결 상태 · 설정 UI 에 하나 늘고, 수명주기 상태 UI 가 새로 생긴다. 모델 버전은 Chrome 이 바꾼다 — 같은 입력의 출력이 브라우저 업데이트로 달라질 수 있다.
  - 마이그레이션 L: 기본 off · 추가형. 끄면 지금 동작.

### 대안 B: 서버 측 경로 축소 — Ollama one-shot IR + prompt 축소

- 설명: on-device 대신 지금 동작하는 로컬 endpoint 경로를 줄인다 (메모리 `project-ai-assistant-ollama-latency-rootcause` 의 효과 순서 ②③④). (B1) OpenAI 호환 어댑터가 `responseSchema` 를 `response_format: json_schema` 로 보내게 해 (Ollama 는 구조화 출력을 지원한다 — 현재 어댑터가 무시할 뿐, `LLMProvider.ts:123-128` 주석) 모호 요청도 Agent 루프 대신 **one-shot IR 1 회**로 처리. (B2) one-shot manifest 를 Tier 1 + 관련 type 상세로 축소 (ADR-134 Phase 5 의 1,389 tok 선택 주입 재사용). (B3) legacy Agent 가 남는 경우 intent 별 도구 부분집합. (B4) context 8K.
- 위험: 기술(M) / 성능(L) / 유지보수(L) / 마이그레이션(L)
  - 기술 M: `qwen3` 의 구조화 출력 유효율 · 정답률은 미측정 (ADR-202 G4 가 UNVERIFIED 로 남긴 항목과 같다).
  - 성능 L: prompt 가 줄면 prompt 평가 (26.8 초 중 22.5 초를 차지한 항목) 가 직접 준다. 지연 절감의 기전이 이미 측정돼 있다.
  - 유지보수 L: 기존 어댑터 · one-shot 경로의 확장. 새 provider · 새 UI 없음.
  - 마이그레이션 L.
- 관찰: B1 은 A 가 어차피 필요로 하는 "one-shot 을 Anthropic 밖으로 여는 일" 과 같은 작업이다. 차이는 모델이 어디서 도느냐와 한국어 번역 단계뿐이다. **Ollama 사용자에게는 B 가 A 를 지배할 가능성이 높다** — 같은 IR 계약, 한국어를 이해하는 모델 (qwen3), 번역 · 다운로드 · 수명주기 UI 없음. A 가 B 를 이기려면 Nano 의 IR 1 회 지연이 Ollama one-shot 보다 크게 짧아야 한다.

### 대안 C: WebLLM / WebGPU 브라우저 내 모델 (MLC WebLLM · wllama · Transformers.js)

- 설명: 한국어를 다루는 오픈 모델 (Qwen 계열 등) 을 composition 이 weight 로 배포하고 WebGPU 로 브라우저에서 추론한다 (메모리 `reference-webllm-airgap-offline-options`). Safari · 폐쇄망 (내부 서버가 weight 제공) 까지 갈 수 있는 유일한 브라우저 내 경로.
- 위험: 기술(M) / 성능(H) / 유지보수(H) / 마이그레이션(L)
  - 성능 H: 수 GB weight 를 origin 마다 받고 브라우저 캐시에 둔다 (지워지면 재다운로드). 런타임 JS/WASM 이 AI chunk 를 크게 키운다. WebGPU 추론이 Skia 와 GPU 를 직접 다툰다 (HC6).
  - 유지보수 H: 모델 수명주기 (변환 · 양자화 · 세대 교체 · 기기 매트릭스) 를 제품이 소유한다 — ADR-134 가 노선 α 를 기각한 바로 그 사유다.

### 대안 D: reasoningEffort 수정에서 멈춘다 (추가 변경 없음)

- 설명: `1f0aa5d23` 로 충분하다고 보고, 필요하면 프리셋의 planner · verifier 도 `none` 으로 바꾸는 한 줄만 검토한다.
- 위험: 기술(L) / 성능(M~H, 미측정) / 유지보수(L) / 마이그레이션(L)
  - 성능: 수정 전 모호 요청 legacy Agent 호출당 28~106 초. thinking 제거분 (약 8 초/호출) 을 빼도 prompt 평가가 남는다 — 충분한지 여부가 곧 G0 의 질문이다.

### Risk Threshold Check

| 대안 | HIGH+                                     | 판정                                                                                         |
| ---- | ----------------------------------------- | -------------------------------------------------------------------------------------------- |
| A    | 기술 H (한국어 · 정답률 · context 미측정) | 위험이 전부 **측정으로 해소 가능한** 종류 — Phase 0 계측이 회피 수단. 계측 전 구현 착수 금지 |
| B    | 없음                                      | 통과. 다만 이 ADR 의 목적 (on-device) 밖 — G0 에서 이기면 ADR-202 후속으로 인계              |
| C    | 성능 H · 유지보수 H                       | 기각 (ADR-134 노선 α 기각 사유 재현)                                                         |
| D    | 성능 미측정 (H 가능)                      | G0 의 대조 arm. 충분하면 가장 싼 결론                                                        |

루프 1회: 모든 대안이 HIGH 를 가진 것은 아니다 (B 가 HIGH 0). A 의 HIGH 는 "모른다" 에서 오는 위험이라 새 대안 대신 **측정 선행 (Phase 0 go/no-go)** 으로 다룬다.

## Decision

**조건부 결정 — Phase 0 go/no-go 계측을 먼저 하고, 대안 A 의 구현 (Phase 1~4) 은 G0 가 go 일 때만 착수한다.**

Phase 0 은 같은 기기 · 같은 요청 세트 (사람이 쓴 한국어 모호 요청 20개 이상 + 미리 쓴 정답 IR) 로 D (수정 후 — planner thinking 유지 / 끔) · B1 (Ollama one-shot IR, 계측 스크립트) · A (Prompt API IR + ko→en 번역, 자격 기기) · A-en (번역 없음) 을 잰다. 판정:

1. D 또는 B1 의 p95 가 절대 목표 이하 → **no-go (기각), Deprecated**. 수치를 남기고 닫는다. B1 이 이긴 경우 B 는 ADR-202 후속 (G4 재개) 으로 넘긴다.
2. A 가 가장 나은 서버 arm 대비 p50 절반 이하 · p95 이하 (공통 분모 · 실패 60 s 채움) · 성공률 −5%p 이내 · 오답 적용 서버 이하 · 추론 중 프레임 기준 통과 → **go, Accepted**, Phase 1~4.
3. 그 밖 → **no-go (보류), Proposed 유지** — Status 문장에 보류와 재개 조건을 적는다. 재개 조건: Prompt API 모델의 한국어 지원 · 자격 기기 비율 변화 · 사용 패턴 변화로 B/D 가 느려짐.

go 일 때 A 의 형태: `chrome-built-in` 은 one-shot IR 전용 (도구 호출 · Agent 루프 불참), 기본 off, 동의 뒤 다운로드, 상태 4단계 표시, 다운로드 중과 사용 불가 시 기존 경로, 어댑터는 AI chunk 안 동적 import, 요청마다 새 세션, 샘플링 파라미터 미사용, 한국어는 요청 문장만 번역하고 역번역 없음.

**위험 수용 근거**: A 의 기술 H 는 구현 전에 측정으로 판정되고, 측정이 불리하면 구현 비용 0 으로 닫힌다. go 뒤에 남는 위험 (자격 기기 비율 · 모델 버전 변화) 은 HC3 fallback 이 "지금과 같은 동작" 으로 상한을 막는다 — 최악의 결과는 "on-device 를 쓰는 사용자가 적다" 이지 "AI 패널이 나빠진다" 가 아니다.

**기각 · 보류 사유**:

- B: 기각이 아니라 **이 ADR 범위 밖**. 모호 요청 지연의 가장 유력한 해법일 수 있고, G0 에서 B1 이 이기면 그 결과가 이 ADR 을 닫는 근거가 된다. B 구현은 ADR-202 의 one-shot 계약 · G4 소관이다.
- C: 모델 수명주기를 제품이 소유 (ADR-134 노선 α 기각 사유) · weight 다운로드 · GPU 경합으로 HIGH 2개. 폐쇄망 · Safari 요구가 새로 생기면 그때 별도로 다시 본다.
- D: 기각하지 않는다 — G0 의 대조 arm 이며, 충분하면 이 ADR 의 결론이다.

**범위 밖**: 원격 provider 프록시 (ADR-134 D10) · Agent 루프 · Orchestrator 에 on-device 모델 투입 · Summarizer/Writer/Rewriter 등 다른 built-in API · Preview/Publish 런타임의 AI.

> 구현 상세: [245-ai-on-device-breakdown.md](design/245-ai-on-device-breakdown.md)

## Risks

| ID  | 위험                                                                                                                                          | 심각도 | 대응                                                                                                     |
| --- | --------------------------------------------------------------------------------------------------------------------------------------------- | :----: | -------------------------------------------------------------------------------------------------------- |
| R1  | 한국어 미지원 — 번역이 디자인 어휘의 뉘앙스를 잃어 IR 정답률이 떨어진다. 번역 결과가 manifest 의 type · 필드 이름과 어긋난다                  |  HIGH  | G0 A vs A-en 정답률 차 · G3                                                                              |
| R2  | on-device 가 빠르다는 근거가 없다 — 세션 생성 · 번역 · 추론을 합치면 Ollama one-shot (B1) 보다 느릴 수 있다                                   |  HIGH  | G0 계약 지표 (cold/warm 분리, 대조군 D0)                                                                 |
| R3  | 가용성 분산 — 기기 조건 · 저장 공간 22 GB · Safari 미지원 · 기업 정책 · 폐쇄망에서 대부분 사용자가 fallback 으로 떨어져 투자 대비 효과가 작다 |  MED   | G0 에 계측 기기의 `availability()` 기록 · HC3 로 동작 상한 보장 · 효과 판단은 사용자 (§사용자 결정 지점) |
| R4  | manifest 전체가 세션 context 에 들어가지 않는다                                                                                               |  MED   | G0 context 사용량 · Phase 1 manifest 축소 (Tier 1 + 선택 주입)                                           |
| R5  | 추론이 Skia 와 GPU 를 나눠 Canvas 프레임이 떨어진다                                                                                           |  MED   | G0 · G5 추론 중 프레임 p95                                                                               |
| R6  | 출력 형식 불안정 (schema 는 맞지만 semantic 무효) · 브라우저 업데이트로 같은 입력의 출력이 바뀐다                                             |  MED   | `validateProgram` 재검증 · 무효 1회면 기존 경로 · G1 유효율                                              |
| R7  | 어댑터나 타입 선언이 initial 로 끌려오거나, Safari 에서 전역 참조 오류                                                                        |  LOW   | G4 · feature-detect · `lazyPanelBoundary` 가드                                                           |
| R8  | Phase 1 의 one-shot 능력 판정 변경이 Anthropic one-shot · OpenAI 호환 legacy 라우팅을 바꾼다                                                  |  LOW   | Phase 1 unit — 능력 없는 provider 는 `legacy` 유지                                                       |

## Gates

측정 조건 (기기 · OS · Chrome 버전 · `availability()` · Ollama 버전 · 모델 · `context_length` · `visibilityState` · 전원 · arm 순서) 을 모든 수치에 붙인다. 조건 없는 수치는 인용하지 않는다 ([measurement-validity](../../.claude/rules/measurement-validity.md)).

| Gate | 시점                     | 통과 조건                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        | 실패 시 대안                                                                                                   |
| ---- | ------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------- |
| G0   | Phase 0 (go/no-go)       | **Q1 대표성**: 사람이 쓴 한국어 모호 요청 ≥ 20 (적용 가능 ≥ 16 · 표현 불가 ≥ 4) + 미리 쓴 정답 IR (사용자 승인). 지연 p50/p95 는 적용 가능 부분 세트 **전체를 모든 arm 의 공통 분모**로 계산하고, 정답 적용이 없는 표본은 제외하지 않고 T = 60 s 로 채운다. 성공률 (정답 적용 비율) 과 오답 적용 수를 같이 판정 (breakdown §2.3 · §2.5). **Q2 불리 케이스**: 한국어 · 모델 미다운로드 첫 사용 (다운로드 시간 따로 보고) · WebKit fallback · 선택 없는 문서. **Q3 대조군**: D0 (수정 전) · D1 · D1' · B1 · A · A-en 을 같은 기기 · 같은 세트로. **Q4 소비 경로**: D1 · D1' arm 은 실제 요청 본문의 `reasoning_effort` 를 가로채 확인 (`a760c8cf1` 하니스 방식 — 저장된 프로파일이 옛 값이면 무효). **Q5 oracle**: 정답은 모델 출력이 아닌 미리 쓴 IR. 판정: 가장 나은 서버 arm p95 ≤ **절대 목표 (제안 5 초, 사용자 확정)** 면 no-go / A 가 p50 ≤ 0.5× · p95 ≤ 1.0× · 성공률 ≥ −5%p · 오답 적용 ≤ 서버 · 프레임 G5 통과면 go / 그 밖 no-go (보류) | no-go 는 실패가 아니라 종결 — 기각 Deprecated · 보류 Proposed 유지 (Status 문장)                               |
| G1   | Phase 2 종료             | A 의 `validateProgram` 통과율 ≥ 95% (G0 세트) · 무효 출력 시 기존 경로로 넘어가 사용자 가시 결과가 지금과 같음                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                   | JSON 수선 추가 후 재측정, 미달이면 구현 되돌림 · Deprecated (기각 — 재개는 새 ADR)                             |
| G2   | Phase 3 종료             | fallback 7종 (Safari/WebKit · 기기 미달 (`unavailable`) · `downloadable` 미동의 · `downloading` · 번역 불가 · 무효 출력 · 사용자 off) 각각에서 요청 결과가 수정 전과 같다 (Ollama 있음 → legacy / 없음 → 설정 안내) · 자동 다운로드 0                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            | 경로별 수리                                                                                                    |
| G3   | Phase 2 종료             | 한국어 요청 정답률 − 영어 원문 정답률 ≥ −10%p (G0 세트) · 번역 실패 시 원문 영어 추측 금지 (fallback)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            | 번역 대상 축소 (요청 문장만 → 핵심 명사구) 후 재측정, 미달이면 구현 되돌림 · Deprecated (기각 — 재개는 새 ADR) |
| G4   | Phase 4                  | Builder · Preview initial gzip Δ ≤ 0 (별도 worktree clean 빌드 before/after) · `ChromeBuiltInProvider` initial 귀속 0 · `lazyPanelBoundary.static.test.ts` 대상 추가                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                             | 경계 수리                                                                                                      |
| G5   | Phase 0 · Phase 4        | 추론 중 Canvas 프레임 time p95 가 같은 조작의 추론 없는 대조 대비 악화 ≤ 1 frame (display refresh 기준)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          | 추론 중 캔버스 조작 안내 또는 구현 되돌림 · Deprecated (기각)                                                  |
| G6   | Phase 4 (Implemented 전) | live — Chrome 자격 기기: available 상태 모호 요청 3종 적용 + undo · 미다운로드 → 동의 → 다운로드 중 요청은 Ollama → 완료 뒤 one-shot · 한국어 요청 번역 → 적용 · WebKit: "브라우저 미지원" 표시 + 기존 경로 · page error 0                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                       | 경로별 수리                                                                                                    |

### Live Exercise

(Implemented 승격 시 기재 — G0 가 no-go 면 이 절 없이 닫는다 — 기각 Deprecated · 보류 Proposed 유지.)

## 사용자 결정 지점

1. **G0 절대 목표** — 모호 요청 "제출 → 첫 적용" p95 몇 초면 "충분" 인가 (제안 5 초). 이 값이 no-go 판정을 정한다.
2. **요청 세트 · 정답표 승인** — 20개 이상 한국어 모호 요청과 정답 IR 을 계측 전에 고정.
3. **B1 이 이길 때의 소속** — Ollama one-shot IR 을 ADR-202 후속 (G4 재개) 으로 넘기고 이 ADR 은 Deprecated (no-go 기각) 로 닫는가, 이 ADR 안에서 하는가 (결정 지점 ① ADR 분리/통합).
4. **채택 근거의 범위** — 사용자 전제는 "지연" 하나다. on-device 의 다른 이점 (Ollama 설치 없이 LLM 경로 — 원격 provider 가 막혀 있는 지금 유일한 무설정 경로) 을 go 근거에 넣을지 (결정 지점 ④ scope 변경). 넣지 않으면 이 ADR 은 지연만으로 판정한다.
5. **자격 기기** — Phase 0 의 A arm 을 잴 기기 (macOS 13+, RAM 16 GB+ 또는 VRAM 4 GB 초과, 여유 22 GB) 가 있는가. 없으면 A arm 을 잴 수 없어 보류 (Proposed 유지).

## Consequences

### Positive

- 수정 뒤 모호 요청 지연이 처음으로 같은 조건에서 측정된다 — go/no-go 어느 쪽이든 다음 지연 작업 (B 또는 A) 의 근거가 생긴다.
- go 이면: 자격 기기의 Chrome 사용자가 로컬 서버 · 키 없이 모호 요청을 IR 1 회로 처리한다. one-shot 이 provider 능력 기반이 되어 Anthropic 한정이 풀린다.
- no-go 이면: 구현 비용 0 으로 닫히고, 기각 근거가 수치로 남아 같은 제안이 다시 올라올 때 재측정 없이 판정할 수 있다.

### Negative

- Phase 0 자체가 비용이다 — 요청 세트 · 정답표 작성, 자격 기기 확보, 계측 스크립트 3개.
- go 이면: provider 가 3개로 늘고 수명주기 · 동의 UI 가 생긴다. Chrome 이 모델을 바꾸면 같은 입력의 결과가 바뀔 수 있다. Safari · 폐쇄망 사용자에게는 이득 0.
- 한국어 요청이 번역을 거치므로, 한국어 디자인 어휘의 뉘앙스는 서버 모델 (qwen3 등) 경로보다 불리할 수 있다.
