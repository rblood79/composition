# ADR-134: AI Assistant 차세대 아키텍처 — LLM 인프라 + 도구/UI 통합

## Status

Accepted — 2026-08-28 (리뷰 round 2 승인 — round 1 이슈 8건 HIGH 1 / MED 3 / LOW 4 전부 fixed, pending 0; 사용자 `/execute-adr 134` 착수 지시 2026-08-28). Proposed 2026-05-13
**노선 개정 — 2026-08-18**: 자체 로컬 LLM 내장 노선 (Ollama 1st + node-llama-cpp Electron 내장 + Qwen 고정) 을 폐기하고, reference 수렴 노선 (**에이전트 중심 멀티 프로바이더 BYOK + 외부 코딩 에이전트/MCP 준비**) 으로 교체. **Groq 완전 제거 방침은 유지**. 근거: [PENCIL_ECOSYSTEM_ANALYSIS.md](../explanation/research/PENCIL_ECOSYSTEM_ANALYSIS.md) (2026-08-17 갱신) + [HOLAOS_ANALYSIS.md](../explanation/research/HOLAOS_ANALYSIS.md) (2026-08-18) + [XAI_ORG_ANALYSIS.md](../explanation/research/XAI_ORG_ANALYSIS.md) (2026-08-18 — grok-build 를 5번째 수렴 사례로 추가). 본 개정은 전제 확정 종결 계약의 재개 조건 (a) 사용자 재제기에 따른 것 — 통합 형태 (단일 ADR, 대안 A) 결정은 유지하고 **인프라 노선만 재결정** (§인프라 노선 재결정 2026-08-18).

> **설계 문서 단계 → 실행 진입 (2026-08-28)**: 본문 + design breakdown + 기존 ADR Deprecated 이동까지 반영 후, 사용자 착수 지시로 **Phase 0 (inventory baseline freeze, 문서만) 반영 완료**. Phase 1 부터의 코드 변경은 Phase 0 결과 confirm 후. Phase 0-9 실행 작업 + 코드 변경은 사용자 plan review 후 별도 단계 (ADR-133 이 2026-05-13 에 쓴 "설계 문서 먼저 → plan review 후 실행" 패턴 동일).
>
> **응용 영역 코드 사실 재측정 — 2026-08-26 (리뷰 round 1 반영)**: 2026-08-18 개정은 인프라 노선만 재결정하고 응용 영역 (격차 1~4) 을 2026-05-13 코드 스냅샷 그대로 두었다. 그 사이 반영된 ADR-149 (Implemented 2026-07-19) / ADR-158 (Implemented 2026-08-16) / AI-services canonical 정리 (`b994285ef`, 2026-06-18) 를 [reviews/134.md](reviews/134.md) round 1 이 실측해 다음을 정정했다 — ① 격차 1 은 "legacy 기반" 이 아니라 **facade 경유 canonical-primary + 도구 schema 어휘 부재** ② events 는 `SerializedEvent` 가 아니라 **`InteractionRule`** (ADR-158), root `actions` 는 dormant ③ mutation API 는 실존 store action (`insertNode / updateNode / updateNodeProps / updateNodeExtension / moveNode / removeNode / addEvent / updateEvent / removeEvent`) 으로 교체 ④ ADR-133 은 Deprecated (2026-07-08) — "1년차 신입 baseline" 은 ADR-149 P1 이 승계했고 본 ADR 은 HC12 로 독립 선언 ⑤ 데이터 SSOT 명칭은 `collections` (구 `data_tables`) 로 통일. 노선 β 결정·대안 평가·Gate G1/G2/G6/G7 은 무변경.

## 진행 로그

| Phase | 상태                | 근거                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      |
| ----- | ------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 0     | Implemented (08-28) | G0 통과 — inventory baseline freeze. **Groq 결합이 `GroqAgentService.ts` 1개 파일에 국소화** (값 import 1 · type-only 2 · `dangerouslyAllowBrowser` · 모델 id · env 키 전부 동일 파일, 서비스 소비자 `useAgentLoop` 1곳) · **`AIAgentProvider` 인터페이스는 존재하나 소비자 0** (`ai.types.ts:59`, dormant — Phase 1 은 추상화 신설이 아니라 소비 경로 전환) · **Supabase Edge Function 인프라 미존재** (D10 프록시는 Phase 2 에 배포 스캐폴딩 포함) · `systemPrompt.ts` 이미 provider 중립 · 회귀 gate baseline `Transform`/`props.events`/`group_N`/`SerializedEvent` 전부 0 · scope inflation Phase 1~4·8 전부 1.5x 미만. 산출물 `~/.claude/plans/adr-134-baseline-inventory.md`, breakdown §2 Phase 0 실측 결과 · §12 |
| 1     | Implemented (08-28) | G1 통과 — `services/ai/providers/` 신설: `LLMProvider` (통합 시그니처 `completeWithTools` + SSE 스트리밍 + abort + reasoning effort, 외부 의존 0 · fetch 기반) · `AnthropicProvider` (system 최상위 · `tool_result` 블록 병합 · `input_json_delta` 조립 · thinking budget) · `OpenAICompatibleProvider` (**Ollama/vLLM/LM Studio/사내 gateway 는 전용 어댑터 없이 baseUrl 로 포섭**) · `AgentProfileRegistry` (프로파일 6 = main/planner/executor/verifier/fast + vision 예약, 프리셋 3, `credentialRef` 는 키 **이름**만 — 값 미보관). vitest 14 (wire 포맷 oracle) + AI 영역 회귀 36 + type-check 0. **모델 id 빈 프리셋은 미구성으로 판정** — 만료 id 하드코딩 재발 차단 (Phase 0 실측 대응). 소비 경로 배선은 Phase 2 |
| 2     | Implemented (08-28) | G2 통과 — `groq-sdk` 제거 (패키지 + import 3곳) · `GroqAgentService.ts` → **`AgentService.ts`** (LLMProvider 경유, 하드코딩 모델 id·`dangerouslyAllowBrowser`·`VITE_GROQ_API_KEY` 소멸) · **원격 직접 호출 차단** `assertBrowserCallAllowed` (로컬·사설망만 허용, DEV opt-in 은 프로덕션에서 접힘 — 번들 확인) · `byokKeyStore` (기본 메모리, 브라우저 저장은 명시 opt-in, 해제 시 삭제) · `agentProfiles` (설정만 저장, 키 값 0). vitest 26 신규 (grep gate 3 · 원격 차단 3 · 키 정책 3 · 프로파일 2 · 도구 전수 8 + 루프 계약 4) · 회귀 포함 59 · type-check 0 · 프로덕션 빌드 grep 4항 전부 0. **live**: 로컬 mock endpoint 바인딩 → AI 패널 입력 → `run_command(zoomIn)` 으로 zoom 74%→84% 실제 변경 (§Live Exercise) |
| 3     | Implemented (08-28) | G3 통과 — 도구 schema 에 canonical 1차 필드 어휘 (`canonical.clip/placeholder/slot/reusable`, create/update) + `COMPONENT_TAGS` 에 `frame` + search 필터 3종. patch 는 `updateNode` 경유 (facade 우회 없음) · **batch_design 3-op = history 1 entry** (묶기 전 실측 3 → 트랜잭션 창으로 병합, undo 1회 복원 확인) · `get_editor_state` 에 `InteractionRule` 요약 (dormant `SerializedEvent`/root `actions` 제외 — R6) · `elementsMap`/`childrenMap` 직접 접근 0 grep gate. vitest 12 신규 + AI 영역 71 · type-check 0. **live**: AI 패널에서 `type:"frame"` 1건 생성 + `clip/placeholder/slot` 반영 확인 (§Live Exercise)                                                                                                 |
| 4     | Implemented (08-28) | G4 통과 — 도구 2종: `bind_collection` (dataBinding 은 props 가 아니라 **extension**, source 별 config 검증) · `create_interaction_rule` (ADR-158 `InteractionRule` + `capabilityRegistry` trigger/capability 검증, 실패 시 사용 가능 목록 반환). **store 액션 `applyCanonicalExtensionPatch` 신설** — canonical patch + legacy mirror 재파생 + persist 를 러너(ADR-184) 한 묶음으로. `systemPrompt` 가이드 · 은퇴 어휘 5종 0 grep gate. 소비자 경로 검증: ListBox 가 도구 산출 바인딩으로 항목 3건 렌더, Preview dispatcher 가 도구 산출 규칙으로 toast 실행. vitest 16 신규 + AI·dispatcher 106 · type-check 0 (§Live Exercise)                                                                                          |
| 5     | Implemented (08-28) | G5 통과 — `services/ai/catalog/` 신설: **손으로 적지 않고 catalog SSOT 에서 파생**한다 (`componentCatalog` + `COMPONENT_RULES_TABLE` + `resolveEditContract`). 118 type / prop 집합·enum·variant·size 값 전수 대조 불일치 0. Tier 1 (전체 type 목록, 391 tok) 은 항상 · Tier 2 (요청 관련 상세) 는 골라서 주입 — 프롬프트 1,389 tok vs 전체 6,454 tok. 15 시나리오 recall **45/45**, RSP 표본 대조 **40/41**. 구 systemPrompt 의 하드코딩 24종 목록 제거 (그 목록의 `Div` 는 catalog 에 없는 type 이었다). vitest 44 신규 + AI·dispatcher 150 · type-check 0 (§Live Exercise) |
| 6     | Implemented (08-28) | Plan → Execute → Verify 분해 — `agents/` 신설 (Planner/Executor/Verifier + Orchestrator). 역할마다 **자기 프로파일 provider** 로 호출되고, 검증 실패 시 **최대 2회** 수리 후 사람에게 넘긴다. 계획이 1단계면 분해·검증을 건너뛴다 (단순 요청에 호출 3배를 붙이지 않는다). `createAgentRunner` 가 planner 구성 여부로 분해/단일 경로를 고른다 — **패널 배선까지 완료**. **live 결함 1건 수정**: `create_element` 가 팩토리를 안 거쳐 AI 가 만든 `Select` 는 자식 0개 껍데기였다 (팔레트와 불일치) → 팔레트와 같은 분기로 71→76 트리 생성. 레이아웃 템플릿 4종 (catalog 대조 gate). vitest 38 신규 + AI·패널 188 · type-check 0 (§Live Exercise) |
| 7     | 구현 완료 · **G6 부분** (08-28) | `routing/AgentProfileRouter` (작업 유형 → 프로파일, 내림을 **기록으로 남긴다** — Phase 6 의 조용한 내림이 실제 문제였다) + 패널 UI 2종 (`AgentProfileSettings` / `ConnectionStatus`, AI 패널 헤더 톱니로 진입) + 로컬 endpoint 가이드 문서. **G6 측정**: 라우팅 분기 PASS (프로파일별 상이 모델이 역할별로 그대로 호출됨) · 로컬 endpoint 로 **도구 10종 전수 통과, 오류 0** · **Ollama 실물 대조만 미실시** (미설치 — 사용자 환경). vitest 27 신규 + 215 · type-check 0 (§Live Exercise) |
| 8~9   | 미착수              | Phase 8 (AIPanel UX baseline) 부터. **G6 종결에 남은 것**: ① Ollama 실물 1회 실행 ② 카탈로그 주입 후 모델-루프 props 정확도 (G5) ③ Phase 6 의 2개 대시보드 시나리오 품질 — 셋 다 사용자가 로컬 endpoint 를 띄우면 한 번에 끝난다. 원격 상용 provider 는 프록시가 생기기 전까지 차단 상태 — 프록시 도입은 별도 결정                                                                                                                                                                                                                                                                                                                                                                                        |

### Live Exercise

**2026-08-28 · Chrome MCP (dev `localhost:5173`, 프로젝트 SSD)** — Phase 2 G2.

- **로컬 endpoint 직결 end-to-end** — OpenAI 호환 mock endpoint (`127.0.0.1:11555`) 를 `main` 프로파일에 바인딩하고 AI 패널에 "화면 확대해줘" 입력. endpoint 로그로 확인: 1차 요청에 **도구 정의 8종** 전달 → `run_command {"id":"zoomIn"}` tool call → 도구 실행 결과가 대화에 실려 2차 요청 (`hasToolResult=true`). 화면에서는 **zoom 74% → 84%** 로 실제 변경됐고, AI 패널에 스트리밍 텍스트("확대할게요.") + ADR-196 기록 "AGENT 실행 명령 (1) zoomIn 실행" 이 함께 표시됐다.
- **원격 직접 호출 차단 (HC13/R12)** — 같은 자리에서 `api.openai.com` 프로파일로 바꿔 실행: `fetch` 가 **0회**, `remote-provider-requires-proxy` 로 차단. 프로덕션 번들에서 DEV opt-in 분기가 접혀 우회 경로가 없음도 확인 (`e.allowRemoteDirect,` 뒤에 곧바로 throw).
- **번들 grep** — 프로덕션 산출물에 `groq-sdk` · `dangerouslyAllowBrowser` · `api.groq.com` · `VITE_GROQ_API_KEY` **전부 0건**.
- **정리** — 프로파일 설정 제거 (미구성 기본으로 복귀), zoom 원복, mock endpoint 종료.
- 관찰 (스코프 밖 — Phase 8 AIPanel UX): 도구 실행 **뒤** 턴의 assistant 텍스트가 화면에 보이지 않는다. `useAgentLoop` 의 `text-delta` 가 `appendToLastMessage` 로 가는데 그 시점의 마지막 메시지가 도구 결과 메시지라, 고정 라벨("도구 실행 완료") 뒤에 붙어 사라진다. provider 교체와 무관한 기존 동작 (이벤트 순서 동일) 이라 Phase 2 에서 고치지 않는다.

**2026-08-28 (2차) · Chrome MCP** — Phase 3 G3.

- **AI 가 `type: "frame"` 요소를 만든다** — 로컬 mock endpoint 를 물린 AI 패널에 "프레임 하나 만들어줘" 입력 → `create_element {"type":"frame","canonical":{"clip":true,"placeholder":true,"slot":["card"]}}` tool call → 문서 요소 **71 → 72**, 생성된 노드에서 `readCanonicalFields` 가 `{clip:true, placeholder:true, slot:["card"]}` 를 그대로 돌려준다. endpoint 로그로 도구 정의에 canonical 어휘가 실려 나간 것도 확인 (`canonicalVocab=true`).
- **정리** — undo 1회로 72 → 71 복귀, 프로파일 설정 제거, mock 종료.
- 실측으로 드러난 구조 사실 2개 (본문 반영):
  - **`reusable: true` 는 frame 을 page scope 밖으로 옮긴다** (`canonicalElementsView.getNodeScope`) — 페이지 요소 목록·트리에서 사라진다 (노드는 살아 있다). 도구 설명에 경고를 넣었다.
  - **`componentSemantics` 라는 1차 필드는 없다** — `adapters/canonical/componentSemanticsMirror.ts` 의 legacy mirror metadata 가 quarantine 으로 남아 있을 뿐이다. 컴포넌트 의미의 1차 필드는 `reusable` / `ref` / `descendants` 이고, 이 Phase 가 연 것은 `reusable` 하나다 (`ref` 인스턴스 생성은 ADR-161 표면).

**2026-08-28 (3차) · Chrome MCP** — Phase 4 G4.

- **AI 가 이벤트 규칙과 데이터 바인딩을 만든다** — 로컬 mock endpoint 를 물린 AI 패널 한 번의 대화에서 `create_interaction_rule`(Button `onPress` → toast) 과 `bind_collection`(ListBox, static 3건) 이 순서대로 실행됐고, **IndexedDB `documents` 레코드**에서 `events` 규칙과 ListBox `x-composition.dataBinding` 을 직접 확인했다 (persist 도달).
- **1차 시도에서 드러난 결함과 수정** — extension 만 고치면 legacy `elements` mirror 가 stale 로 남아 캔버스·트리가 옛 값을 그렸다 (`_rebuildIndexes()` 는 인덱스만 다시 만들고 배열은 둔다). store 액션 **`applyCanonicalExtensionPatch`** 를 만들어 러너의 ② store 스테이지에서 mirror 를 재파생하도록 고쳤고, 재실행에서 `element.dataBinding` 이 즉시 반영되는 것을 확인했다 (`layoutVersion` bump 동반).
- **소비자 경로 검증** (Preview iframe 전송 계층 밖에서 같은 경로를 그대로 사용):
  - `ListBox` 가 도구 산출 바인딩으로 "AI 항목 1~3" 을 렌더 (`useCollectionData` 경유) + 바인딩 없을 때 렌더 안 됨 대조군.
  - 도구가 canonical `events` 에 넣은 규칙을 `buildInteractionIndex` → `createElementHandlers("btn-1")` → `onPress()` 로 실행해 toast 발생, `executeInteractionRule` 직접 실행도 `{ok:true, kind:"toast"}`.
  - 빌더 안에서 compare mode 를 켜 Preview iframe 이 canonical 문서를 렌더하는 것도 확인했다 (페이지 전환 전송은 기존 재송신 경로 문제라 이번 범위 밖 — 메모리 `reference-preview-iframe-compare-mode-and-resend-gap`).
- **정리** — 실측으로 만든 규칙·바인딩을 문서에서 모두 제거하고 프로파일·mock 을 정리했다 (요소 71, `events: []`, 확장 필드 없음).

**2026-08-28 (4차) · Chrome MCP** — Phase 5 G5.

- **카탈로그가 실제로 모델의 도구 호출을 결정한다** — 이번 mock endpoint 는 컴포넌트 지식을 **내장하지 않는다**. 받은 system prompt 에서 `### Button` 블록의 variant 허용 값을 읽어 마지막 값을 골라 `create_element` 를 부른다. 카탈로그가 주입되지 않았다면 고를 값이 없어 실패한다. 실행 결과: mock 로그 `variantValues=accent|primary|secondary|negative|premium|genai chosen=genai`, 생성된 노드 `props.variant="genai"` (+`size:"xl"`, `fillStyle:"outline"`) — 요소 71 → 72, 캔버스에 outline 버튼으로 렌더. system prompt 6,285 자, Tier 1 인덱스 포함.
- **정리** — undo 1회로 72 → 71, 지속 문서에 잔여 0 확인, 프로파일 제거, mock 종료.
- 실측으로 드러난 것 (본문·breakdown 반영):
  - **R3 심각도가 과대했다** — 카탈로그 전체 상세는 6,454 tok 으로 context 예산 안에 든다. "~311K tok" 은 RAC/RSP 원문 문서 추정이지 메타데이터가 아니다. 동적 주입은 필수가 아니라 4.6x 최적화이고, 실패 시 대안으로 적혀 있던 **RAG 도입은 근거가 사라졌다**.
  - **catalog 에 같은 type 이 두 번 등록된 항목이 4개** (Toolbar/Form/Card/InlineAlert — primitive + reusable). 실제 생성물은 origin ref 인스턴스라, primitive 쪽 `accepts` 를 모델에게 알려 주면 존재하지 않는 편집 prop 을 광고하게 된다. palette 노출 쪽을 정본으로 접고 props 는 비운다 (인스턴스 생성 후 `get_editor_state` 로 확인).

**2026-08-28 (5차) · Chrome MCP** — Phase 6 오케스트레이션.

- **역할 3개가 각자 프로파일로 돌아간다** — "제목이 있는 프레임 만들어줘" 한 요청에서 mock endpoint 로그가 순서대로 찍혔다: `planner` (템플릿 힌트 포함·카탈로그 없음) → 2단계 계획 → `executor` × 2단계 (각각 카탈로그가 실린 빌더 프롬프트 + 도구 호출) → `verifier` (계획 + 실행 기록, 도구 없음) → **수리 1회** (지적 사항이 실린 실행 지시) → `verifier` 재검 통과. 역할마다 **다른 system prompt** 가 간 것이 곧 분해가 실제로 동작한다는 증거다. 요소 71 → 74.
- **`create_element` 가 합성 컴포넌트를 껍데기로 만들던 결함 (RED→GREEN)** — 수정 전: "셀렉트 만들어줘" → `Select` 1개, **자식 0개**. 팔레트로 만든 같은 컴포넌트는 `Label` + `SelectTrigger`(`SelectValue`/`SelectIcon`) 를 갖는다. 원인은 `create_element` 가 `ComponentFactory.createComplexComponent` / reusable ref 분기를 타지 않고 element 하나만 만든 것. 수정 후 같은 요청이 71 → 76 으로 팔레트와 같은 트리를 만든다.
- **정리** — undo 로 71 복귀, 프로파일 제거, mock 종료.
- 관찰: 로그 첫 줄의 정체불명 호출은 mock 가동을 확인한 `curl` (system·user 없음) 이었다 — 앱의 자동 호출이 아니다.

**2026-08-28 (6차) · Chrome MCP** — Phase 7 / G6.

- **프로파일마다 다른 모델이 역할별로 정확히 호출된다** — 5개 프로파일에 서로 다른 모델 id (`g6-planner` / `g6-executor` / `g6-verifier` …) 를 넣고 한 요청을 실행했다. 로컬 endpoint 로그: `[planner] model=g6-planner` → `[executor] model=g6-executor` × 8턴 (도구 정의 10종 전달) → `[verifier] model=g6-verifier`. 라우팅 분기가 실제로 갈린다.
- **로컬 endpoint 로 도구 10종 전수 통과** — 같은 요청 안에서 `get_editor_state` / `get_selection` / `search_elements` / `run_command` / `create_element` ×2 / `update_element` / `create_interaction_rule` / `bind_collection` / `batch_design` / `delete_element` ×2 = **12 tool result, 오류 0**. 문서는 71 → 71 로 복귀했다 (만든 것을 도구가 스스로 지웠다).
- **설정 UI 가 실제로 열리고 그린다** — AI 패널 헤더 톱니 → 프리셋 3 · 연결 상태 · 프로파일 5행. 미구성 상태에서 "계획 → 기본" 같은 내림이 문장으로 표시된다.
- **UI 결함 2건 발견 → 수정** — 프리셋 버튼이 `fillStyle="outline"` 에서 거의 안 보였고 (`variant="secondary"` 로 교체), `fieldset` 기본 `min-width:min-content` 때문에 긴 select 옵션이 입력 필드를 패널 밖으로 밀어냈다 (`min-width:0`). 둘 다 수정 후 재확인.
- **G6 를 통과로 적지 않은 이유** — 게이트는 "Ollama OpenAI-compatible endpoint" 를 지정한다. 경로는 로컬 OpenAI 호환 endpoint 로 전부 통과했지만 **Ollama 가 이 환경에 없어** 실물 서버 wire 대조를 못 했다. 사용자가 로컬 endpoint 를 띄우면 1회 실행으로 종결된다.
- **정리** — 만든 요소 0 잔존, orphan `InteractionRule` 1건 수동 제거, 프로파일 제거, mock 종료, zoom 복원 (67% → 69%, 배율 사다리상 근사).
- 스코프 밖 관찰: **요소를 지워도 그 요소의 이벤트 규칙이 `events` 에 남는다** (G6 실측에서 orphan 1건). ADR-158 영역.

## Context

composition AI 어시스턴트의 두 선행 ADR — [ADR-011](completed/011-ai-assistant-design.md) (AI Assistant 설계, 2026-01-31) + [ADR-054](completed/054-local-llm-architecture.md) (로컬 LLM 아키텍처, 2026-04-05) — 는 본 ADR 작성 시점 (2026-05-13) 기준 다음 시스템 격차로 인해 폐기 후 통합 재설계가 필요하다.

### 격차 1 — canonical document SSOT 미반영 (ADR-011 응용 영역)

ADR-011 의 7개 도구 (createElement / updateElement / deleteElement / getEditorState / getSelection / searchElements / batchDesign — 도구 name 은 `create_element` 등 snake_case, `services/ai/tools/definitions.ts`) 는 작성 시점 (2026-01-31) 에 legacy elementsMap/childrenMap mutable subscription 기반이었다. **2026-08-26 재측정**: 이 서술은 더 이상 사실이 아니다 —

- **read 경로는 이미 canonical**: 6개 도구가 `services/ai/tools/canonicalToolReadModel.ts` 를 import 하고, 이 모듈은 `useCanonicalDocumentStore` + `visitCanonicalDocumentElements` 로 활성 문서를 순회한다 (`canonicalToolReadModel.static.test.ts` 가 `elementsMap` / `childrenMap` 부재를 단언)
- **write 경로는 facade 경유 canonical-primary**: `createElement.ts` → `addElement`, `deleteElement.ts` → `removeElement`, `updateElement.ts` → `updateElement` (모두 `builder/stores` facade). facade 구현 (`stores/utils/elementCreation.ts` / `elementUpdate.ts` / `elementRemoval.ts`) 은 `adapters/canonical/canonicalMutations.ts` (`mergeElementsCanonicalPrimary` 등) + `canonicalHistoryEvents` 를 경유하므로 legacy direct write 가 아니다

따라서 **잔존 격차는 "canonical 전환" 이 아니라 "도구 schema 어휘 부재"** 다. 본 ADR 작성 시점 기준 반영 완료된 정합 영역 중 도구가 표현하지 못하는 것:

- **ADR-116 canonical document SSOT** (Implemented 2026-05-02) — `CompositionDocument` schema + Frame/Slot/ComponentSemantics 1차 필드 + boundary helper (frameMirror / slotMirror / componentSemanticsMirror) allowlist
- **ADR-122 canonical-only runtime** (Implemented 2026-05-09) — Builder hot path 의 mutable `elementsMap`/`childrenMap` subscription 0건, canonical store + read-only derived snapshot 갈음
- **ADR-131 events/actions root collection** (Implemented 2026-05-13) → **ADR-158 로 entry 형태 교체** (Implemented 2026-08-16) — root `events` 는 `InteractionRule[]` (`packages/shared/src/interactions/interactionRule.types.ts`: `{ id, type: "interaction", elementId, trigger, action }`, action 은 `navigate | toast | capability` 3종 인라인, capability 는 `capabilityRegistry.ts` 의 RAC controlled prop 1:1). store action 은 `addEvent / updateEvent / removeEvent / setEvents`, read 는 `useDocumentEvents(): InteractionRule[]`. 구 `SerializedEvent` 와 root `actions` (`SerializedAction[]`) 는 **dormant** — ADR-158 write 경로가 항상 `undefined` 로 두므로 AI 도구는 참조하지 않는다
- **ADR-130 Frame canonical vocabulary** (Implemented 2026-05-13) — `frame` type + `FrameNode` 1차 필드 (Group 응용에서 분리)

ADR-011 의 도구 시그니처 (`createElement(tag, props, parentId)`) 는 element-level 생성만 다루며, canonical `CompositionDocument` 의 frame / slot / componentSemantics 1차 필드와 interaction rule 을 **도구 파라미터로 표현하지 못한다**. AI 가 frame layout container / component instance·slot / interaction rule 을 만들 수 없음. facade 가 canonical-primary 라 store 정합은 이미 확보돼 있으므로, Phase 3 의 일은 store 전환이 아니라 schema 확장 + 필요 시 store action 직접 경유 (`insertNode` 등) 다.

### 격차 2 — `collections` (구 data_tables) SSOT 미반영 (ADR-011 데이터 바인딩 격차)

ADR-011 Section 1.3.3 의 "데이터 바인딩 격차" (Mock 엔드포인트 30+ 누락 / DataBinding 3단계 타입 / DataTable 프리셋 18종 / Transform 3단계) 는 본 ADR 작성 시점 기준 SSOT 정합 미반영:

- **`collections` (구 `data_tables`) 가 데이터 SSOT** ([[project-data-tables-ssot-framing]] 사용자 확정 2026-05-13; 명칭은 ADR-132 Phase 5 rename 이후 `collections` — 본 ADR 은 이 명칭으로 통일, 2026-08-26) — `useCollectionData({ datatableId | dataBinding })` (`packages/shared/src/hooks/useCollectionData.tsx`) 통합 read 진입점. 데이터는 canonical document 밖 IndexedDB store (`collections` / `api_endpoints` / `variables`, `builder/stores/datatable.ts` `useDataTableStore`) 에 있고, element 는 `Element.dataBinding` 참조만 가진다 (ADR-131 Phase 8 에서 document `data` root 제거 — `composition-document.types.ts` 주석)
- **ADR-132 useCollectionData useAsyncList 정합** (Implemented 2026-05-13) — collections rename + Transformer 제거. ADR-011 의 "Transform 3단계" 가 해당 ADR Phase 7 에서 전수 제거됨
- **API endpoint sink** — `endpoint.targetDataTable` → `collections.runtimeData` (`DataTable.runtimeData?` 메모리 전용 필드, `types/builder/data.types.ts`; 사용자 확정 영역)

ADR-011 의 `bindings` 도구 디자인은 legacy `{ type: "dataTable", field: "name" }` 필드 매핑만 다루며, ADR-132 반영 완료된 `collections` 정합 + `useAsyncList` patch/move/remove 표준 callback 미지원.

### 격차 3 — Provider 추상화 + Electron 시점 미확정 (ADR-054 base 영역)

ADR-054 Proposed (2026-04-05) 의 대안 A (Ollama → node-llama-cpp + 온라인 모델 선택) 는 본 ADR 작성 시점 기준 반영 0건 (Proposed 상태 유지). Electron 마이그레이션 시점 미확정 (ADR-054 Soft Constraint 1) 이 해소되지 않은 상태에서 로컬 LLM 내장 단계 차단 위험. 또한 ADR-054 의 Hard Constraint (`groq-sdk` 완전 제거 + Provider 추상화 + 폐쇄망 + 컴포넌트 카탈로그 Tier 2 주입) 와 ADR-011 의 Phase A1~A4 반영 산출물 (도구 7개 + AIPanel + AbortController + G.3) 의 정합 합의 부재.

### 격차 4 — AIPanel UX ("1년차 신입 baseline" 미반영)

ADR-011 의 AIPanel (`panels/ai/AIPanel.tsx` + `components/AgentControls.tsx` / `ToolCallMessage.tsx` / `ToolResultMessage.tsx` + `hooks/useAgentLoop.ts` — 2026-08-26 실측 파일 기준) 은 "1년차 신입 개발자 baseline" mental model 미반영. 이 baseline 은 ADR-133 Q4 사용자 확정 (2026-05-13, "1년차 신입 개발자라도 사용할 수준이어야한다") 에서 출발했고, **ADR-133 은 2026-07-08 Deprecated** 됐으나 원칙은 [ADR-149](completed/149-events-panel-canonical-simplification.md) P1 (Implemented 2026-07-19 — "default 표면 2 depth, overlay 0") 이 승계·실현했다. 본 ADR 은 이 원칙을 **HC12 로 독립 선언**하며 (ADR-133 참조에 의존하지 않음), depth 축소의 구체 기준은 ADR-149 P1 을 선례로 삼는다.

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

**패턴 채택 주 — 2026-08-18 2차 정정 (사용자)**: "open-pencil 이 아니라 **Pencil.app 과 ZSeven-W/openpencil 패턴**으로 가야 한다." 위 표의 5개는 전부 수렴 근거로 유효하나, **노선 β 의 조직 원리로 채택하는 패턴은 Pencil.app (외부 코딩 에이전트 dual embed) + ZSeven-W/openpencil (에이전트 팀 오케스트레이션 + multi-model/provider profile + skills)** 이다. open-pencil 의 역할별 고정 슬롯 4종 (Design/Review/Fast/Vision) 명명·구조는 **비채택** — 모델 구성의 단위는 역할 슬롯이 아니라 **에이전트 프로파일** (오케스트레이션의 실행 단위별 provider/model 구성) 이다. open-pencil 은 bounded Vision inspection 등 개별 세부의 참조로만 유지.

### Hard Constraints

ADR-054 Hard Constraints 승계 + 2026-08-18 노선 개정 반영:

1. Canvas 60fps 유지 — LLM 추론이 렌더링 스레드를 차단하면 안 됨
2. 기존 7개 AI 도구와 호환 + 확장 + canonical document mutation API 정합
3. Tool Calling 지원 — 자연어 → 도구 호출 패턴 핵심
4. ~~Apple Silicon 16GB 에서 실행 가능 (Qwen3 14B), 36GB 권장~~ — **2026-08-18 삭제**: 로컬 모델은 BYOK OpenAI-compatible endpoint (Ollama 등) 소관으로 이동. 하드웨어 사양은 사용자 endpoint 환경의 속성이지 제품 hard constraint 가 아님
5. 초기 앱 번들 < 500KB — LLM 관련 코드는 lazy load, 모델 자체는 제품이 배포하지 않음
6. RAC / RSP 문서 기반 정확한 props 설정 — 잘못된 prop 조합 생성 금지
7. **폐쇄망 지원** — 인터넷 불가 환경에서도 기본 AI 기능 동작. **2026-08-18 달성 방식 재규정**: 자체 모델 내장이 아니라 **로컬 OpenAI-compatible endpoint (Ollama / vLLM / LM Studio 등) 를 에이전트 프로파일에 BYOK 바인딩**하는 방식으로 달성

본 ADR 추가 Hard Constraints (canonical / collections / interaction rule 정합 + 2026-08-18 추가 + 2026-08-26 실존 표면 정정):

8. **canonical document mutation API 만 사용** (2026-08-26 실존 표면으로 정정) — legacy `elementsMap` / `childrenMap` direct write 금지. AI 도구가 쓸 수 있는 write 표면은 두 가지뿐: (a) `builder/stores` facade (`addElement / updateElement / updateElementProps / removeElement` — 구현이 `adapters/canonical/canonicalMutations.ts` 경유 canonical-primary), (b) `useCanonicalDocumentStore.getState()` store action 직접 (`insertNode / updateNode / updateNodeProps / updateNodeExtension / moveNode / removeNode / updateDescendant`, events 는 `addEvent / updateEvent / removeEvent / setEvents`). Frame / Slot / ComponentSemantics 는 root 컬렉션이 아니라 **node 1차 필드**이므로 `updateNode` / `updateNodeExtension` patch 로 다룬다 (root setter 없음). 다단계 mutation 은 `runCanonicalMutation` (`canonicalMutationRunner.ts`) 으로 history 1건 묶음
9. **`collections` 데이터 SSOT 정합** — AI 가 데이터 바인딩 도구 호출 시 element 쪽은 `Element.dataBinding` 참조를 `updateNodeProps` / facade `updateElement` 로 설정하고, 데이터 쪽은 `collections.runtimeData` sink + `useCollectionData({ datatableId | dataBinding })` read 진입점만 사용. collections 자체의 CRUD 는 `useDataTableStore` (`builder/stores/datatable.ts`) 경유 — canonical document 에 `collections` root 는 없다
10. **interaction rule root collection 정합** (ADR-158) — AI 가 이벤트를 만들 때 `InteractionRule` schema (`{ id, type: "interaction", elementId, trigger, action: navigate | toast | capability }`) + `addEvent / updateEvent / removeEvent` 사용. `capability` action 은 `capabilityRegistry.ts` 에 등록된 대상 컴포넌트 capability 만 허용. 구 `SerializedEvent` / root `actions` (`SerializedAction[]`, ADR-158 이후 dormant) 참조 금지
11. **frame canonical vocabulary 정합** — layout container 생성 시 `type: "frame"` (Group 응용 흡수 금지)
12. **AIPanel UX 1년차 신입 baseline** — 본 ADR 독립 원칙 (출처: ADR-133 Q4 사용자 확정 2026-05-13, ADR-133 Deprecated 후 ADR-149 P1 이 승계). 구체 기준 = ADR-149 P1 선례 (default 표면 2 depth, overlay 0)
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

#### 노선 β: 에이전트 중심 멀티 프로바이더 BYOK + 외부 에이전트/MCP 준비 (선택)

- 설명 (2026-08-18 2차 정정 반영 — §패턴 채택 주): 조직 원리는 **에이전트 중심** — ① 자체 AI 는 **에이전트 팀 오케스트레이션** (ZSeven-W/openpencil 패턴: Plan→Execute→Verify 를 서브에이전트 분해로 실행, layered workflow, bounded repair) 으로 구성하고, ② 최종 형태는 **외부 코딩 에이전트 embed** (Pencil.app dual embed 패턴 — ACP/SDK, Electron 단계) 다. 모델 구성 단위는 **에이전트 프로파일** — 프로파일마다 provider·엔드포인트·자격증명·모델·reasoning effort 개별 설정 (BYOK, ZSeven-W multi-model/provider profile·grok-build 서브에이전트별 모델 설정과 동형). 어댑터는 **Anthropic Messages + OpenAI-compatible Chat Completions 2-way** 로 축소하고, 로컬 모델 (Ollama / vLLM / LM Studio) 은 OpenAI-compatible endpoint 로 포섭 — 폐쇄망은 전 프로파일을 로컬 endpoint 에 바인딩하는 것으로 달성. 도구 정의는 MCP tool schema 호환 형태를 유지해 embed 전환을 준비. `dangerouslyAllowBrowser` 제거 + 키 보관·경유 경계 (secret isolation) 를 1급 결정으로 승격
- 근거: 격차 5 — reference 5개 전부가 이 방향으로 수렴 (분석 문서 §8 차용 후보 4/7/12/17 + holaOS 하니스 패턴 + grok-build `ApiBackend`·도구 지연 로딩). 분석 문서 §10 "AI 운영 가능성 재평가" 의 acceptance criteria (provider abstraction / secret isolation / audit / verification / offline / retention) 와 1:1 정합. 구현 세부 reference: [XAI_ORG_ANALYSIS.md](../explanation/research/XAI_ORG_ANALYSIS.md) §5-1 (capability 술어 / retry 스펙 / 프롬프트 템플릿 / compaction 계약)
- 위험:
  - 기술: **LOW** — 표준 API 2종 어댑터. 웹앱 환경에서 즉시 진행 가능 (Electron 비의존)
  - 성능: **LOW** — frontier 모델 tool calling (BFCL 90%+) 이 기본 경험. 로컬 endpoint 선택 시 정확도는 사용자 trade-off
  - 유지보수: **MEDIUM** — 에이전트 프로파일 설정 UX + BYOK 키 보관 경계 + provider 2종 어댑터. 모델 수명주기는 provider/사용자 소관으로 이전
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

| 노선                                                  | 기술  | 성능  | 유지보수 | 마이그레이션 | HIGH+ 개수 |
| ----------------------------------------------------- | :---: | :---: | :------: | :----------: | :--------: |
| α: 자체 로컬 LLM 내장 (원 결정)                       |   M   | **H** |  **H**   |      M       |     2      |
| β: 에이전트 중심 BYOK + 외부 에이전트 준비 **(선택)** |   L   |   L   |    M     |      L       |     0      |
| γ: 외부 에이전트 전면 위임                            | **H** |   L   |    M     |    **H**     |     2      |

루프 판정: HIGH 0개 노선 (β) 존재. 추가 노선 불필요.

## Decision

**통합 형태 = 대안 A** (2026-05-13, 유지) + **인프라 노선 = 노선 β** (2026-08-18 개정) 채택. ADR-011, ADR-054 모두 Status: Deprecated (Replaced by ADR-134) 후 `completed/` 이동 (완료).

### 위험 수용 근거

- 노선 β 의 MEDIUM 1개 (유지보수 — 에이전트 프로파일 UX + 키 경계) 는 Gate G1/G2 통과 조건으로 관리
- BYOK 전제로 "키 미설정 시 AI 기능 0" 온보딩 공백이 생김 (R2 재규정) — 설정 UX + 역할 프리셋으로 완화, 기본 제공 모델 (제품 부담 proxy 운영) 도입 여부는 별도 판정
- ADR-011 의 Phase A1~A4 산출물 (도구 7개 + AIPanel + AbortController + G.3) 보존 + 점진 canonical 정합 (원 결정과 동일)

### 기각 사유

- **대안 B/C 기각** (2026-05-13, 유지): 의존 체인 관리 비용 / stale 본문 정정 비용 + 사용자 정정 충돌
- **노선 α 기각** (2026-08-18): 성능·유지보수 HIGH 2개. reference 5개 어디에도 없는 고립 노선으로, 모델 수명주기·하드웨어 매트릭스를 제품이 소유하는 구조적 부담 대비 이득 (폐쇄망 first-class) 은 노선 β 의 로컬 endpoint BYOK 로 동등 달성 가능
- **노선 γ 현 단계 기각** (2026-08-18): Electron 선행 필수 — 웹앱 현 단계에서 차단. 단 노선 β 가 γ 의 전제 (MCP 호환 도구 표면) 를 준비하므로 Phase 9 재평가 대상

### sub-decision D1-D11 (2026-08-18 개정 반영)

- **D1** (개정, 2026-08-18 2차 정정): LLM Provider 추상화 + **에이전트 프로파일** — `LLMProvider.completeWithTools(tools, messages, options)` 통합 시그니처 + **2-way 어댑터** (Anthropic Messages / OpenAI-compatible Chat Completions). Ollama·vLLM·LM Studio 등 로컬 모델은 OpenAI-compatible endpoint 로 포섭 (전용 어댑터 없음). 모델 구성 단위 = **에이전트 프로파일** (ZSeven-W multi-model/provider profile·grok-build 서브에이전트별 모델 설정 정합): 프로파일마다 provider / endpoint / 자격증명 / 모델 / reasoning effort 개별 설정. 기본 프로파일 = 메인 에이전트 + 오케스트레이션 서브에이전트 (planner / executor / verifier / fast 보조) — open-pencil 의 역할 고정 슬롯 4종 명명은 비채택 (§패턴 채택 주). vision 용 프로파일은 예약만 (멀티모달 scope 밖 유지). ~~node-llama-cpp 어댑터~~ 제거
- **D2** (2026-08-26 재규정 — 격차 1 재측정): AI 도구 **canonical 어휘 확장** (ADR-011 응용 + ADR-116/122/130 정합). store 전환은 이미 완료 (read `canonicalToolReadModel.ts`, write facade canonical-primary) 이므로 Phase 3 의 일은 schema 와 write 표면 확장:
  - `createElement` → 파라미터에 `type: "frame"` + `FrameNode` 1차 필드 (`clip` / `placeholder`) / slot / componentSemantics 표현 추가. write 는 facade `addElement` 유지, node 1차 필드는 `updateNode` / `updateNodeExtension` patch
  - `updateElement / deleteElement` → facade `updateElement` / `removeElement` 유지 (canonical-primary 확인됨). body 보호 + boundary 검증은 도구 측 유지
  - `getEditorState / getSelection / searchElements` → `canonicalToolReadModel` 유지 + `useDocumentEvents()` (InteractionRule) 통합
  - `batchDesign` → `runCanonicalMutation` 으로 다단계 mutation 을 history 1건으로 묶고 실패 시 rollback
- **D3**: `collections` SSOT 정합 (ADR-132 정합) — AI 데이터 바인딩 도구는 `Element.dataBinding` 참조 설정 (`updateNodeProps` / facade `updateElement`) + `collections.runtimeData` sink + `useCollectionData({ datatableId | dataBinding })` read 진입점만 사용. collections CRUD 는 `useDataTableStore` 경유. legacy `Transform 3단계` 어휘 도입 금지 (현 AI 도구 안 0건 — 회귀 gate)
- **D4** (2026-08-26 ADR-158 정합으로 재작성): interaction rule root collection 정합 — AI 이벤트 도구는 `InteractionRule` schema + `addEvent / updateEvent / removeEvent`. action 3종 (`navigate` / `toast` / `capability`) 중 `capability` 는 `capabilityRegistry.ts` 등록 항목만 허용 (RAC controlled prop 1:1). 구 `SerializedEvent` / root `actions` / `element.props.events` 어휘 도입 금지 (현 AI 도구 안 0건 — 회귀 gate). 별도 `createAction` 도구는 만들지 않는다 (action 이 rule 안에 인라인)
- **D5**: frame canonical vocabulary 정합 (ADR-130 정합) — layout container 생성 시 `type: "frame"`. legacy `Group + customId="group_N"` 도구 제거
- **D6** (목적 재규정): 컴포넌트 카탈로그 (RAC / RSP 문서 기반) — 원 목적 (로컬 모델 정확도 보정) 에서 **provider 무관 도메인 지식 주입**으로 재규정. 어느 모델이든 composition 의 컴포넌트 vocabulary / props / catalog 규칙은 컨텍스트 주입 없이는 알 수 없음. Tier 2 동적 주입 (작업 컨텍스트 기반 선택적 로딩) 유지
- **D7** (개정, 2026-08-18 2차 정정): **에이전트 오케스트레이션** (Plan→Execute→Verify) — 멀티스텝 대시보드 디자인을 **서브에이전트 분해로 실행** (ZSeven-W/openpencil Concurrent Agent Teams / layered workflow 패턴 — PENCIL 분석 §8 차용 후보 4): planner / executor / verifier 서브에이전트가 각자 에이전트 프로파일 (D1) 을 참조, 단순 분류·응답은 fast 보조 프로파일. `create_composite` 도구 + 레이아웃 템플릿 + bounded repair (자기 수정 max 2회) + 에이전트별 진행 표시 (per-agent indicator — ZSeven-W 정합)
- **D8** (개정): 모델 라우팅 — ~~난이도 기반 로컬/온라인 전환~~ → **에이전트 프로파일 라우팅** (작업 유형 → 오케스트레이션의 실행 에이전트 선택, D7 분해가 정본). 폐쇄망 = 전 프로파일을 로컬 OpenAI-compatible endpoint 에 바인딩 (Hard Constraint 7 재규정 정합). 난이도 추정·자동 전환 제안·복합 작업 자동 분할은 제거 — 프로파일 구성이 사용자 통제 지점
- **D9**: AIPanel UX 1년차 신입 baseline (HC12 — ADR-149 P1 선례) — depth 4→2 축소. default 표면 = 자연어 입력 + 도구 실행 결과 시각 피드백 (G.3 보존). 고급 모드 = Plan 단계 시각화 + 자기 수정 표시 + 에이전트별 진행 표시 + **에이전트 프로파일 설정** (L4 power user 격리)
- **D10** (신규 2026-08-18): **secret isolation** — `dangerouslyAllowBrowser` 제거 + browser 번들에서 외부 provider 직접 호출 0건 (Hard Constraint 13). BYOK 키 보관·경유 경계: 원격 provider 는 프록시 경유 (Supabase Edge Function 등 — Phase 2 에서 확정), 로컬 endpoint (localhost) 는 직접 호출 허용. 키의 브라우저 저장은 사용자 명시 opt-in (localStorage 평문 금지)
- **D11** (신규 2026-08-18): **외부 에이전트/MCP 준비** — 7+ 도구 정의를 MCP tool schema 와 호환되는 형태 (JSON Schema 파라미터 + 명세 분리) 로 유지. ACP/에이전트 SDK embed (Claude Code / Codex — Pencil.app dual embed·holaOS 하니스·grok-build ACP 패턴) 는 Electron 반영 후 Phase 9 에서 재평가. 도구 표면이 커질 때의 지연 로딩은 grok-build `search_tool`+`use_tool` 패턴 (manifest 안정 = KV cache 보존 — 3중 독립 수렴 확인, XAI_ORG_ANALYSIS §5-1 #1) 을 정본 reference 로 한다
  - **정합 (2026-08-28, ADR-196 Phase 4)**: 명령 실행 도구는 D11 이 새로 정의하지 않고 [ADR-196](completed/196-agent-command-surface.md) 의 descriptor (`listAgentCommands()` — `COMMAND_META` allowlist 파생 JSON Schema) 를 **그대로 소비**한다. 현재 Groq tool `run_command` 로 배선돼 있고, D11 이 MCP/새 provider 로 옮길 때 정의 재작성 없이 배선만 이동한다 (196 R6). 실측 (2026-08-28): 현행 `GroqAgentService` 의 모델 id `llama-3.3-70b-versatile` 이 만료돼 (`404 model_not_found`) AI 패널 도구 8종 전부 도달 불가 — Phase 0 baseline 항목.

### Phase 0-9 분해 + Gate G1-G7 (2026-08-18 개정)

> 구현 상세: [134-ai-assistant-llm-infrastructure-unification-breakdown.md](design/134-ai-assistant-llm-infrastructure-unification-breakdown.md)

- Phase 0 — inventory baseline freeze (ADR-011 반영 영역 인벤토리 + 4 격차 측정 + Groq 표면 실측)
- Phase 1 — LLM Provider 추상화 + 에이전트 프로파일 (D1) — **G1**
- Phase 2 — Groq 완전 제거 + secret isolation (D10) — **G2**
- Phase 3 — AI 도구 canonical 어휘 확장 (D2) — **G3**
- Phase 4 — collections + interaction rule + frame canonical 정합 (D3/D4/D5) — **G4**
- Phase 5 — 컴포넌트 카탈로그 (D6) — **G5**
- Phase 6 — 에이전트 오케스트레이션 Plan→Execute→Verify (D7)
- Phase 7 — 에이전트 프로파일 라우팅 + 폐쇄망 BYOK 검증 (D8) — **G6**
- Phase 8 — AIPanel UX 단순화 1년차 신입 baseline (D9)
- Phase 9 — 외부 코딩 에이전트 통합 (ACP/SDK embed — D11) — **G7** — Electron 마이그레이션 시점 의존

## Risks

| ID  | 위험                                                                                                                                                           | 심각도 | 대응                                                                                                                                                                            |
| --- | -------------------------------------------------------------------------------------------------------------------------------------------------------------- | :----: | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| R1  | Electron 마이그레이션 시점 미확정 → Phase 9 (외부 에이전트 embed) 차단                                                                                         |  HIGH  | Phase 1-8 은 Vite 웹앱 환경에서 자립 완결 (BYOK provider 는 웹에서 동작). Phase 9 만 Electron 의존 — Gate G7 으로 분리. 노선 γ 재평가도 이 시점                                 |
| R2  | (재규정) BYOK 전제 — 키 미설정 사용자는 AI 기능 0 (기본 제공 모델 부재 온보딩 공백)                                                                            |  MED   | 최초 실행 설정 UX + 에이전트 프로파일 프리셋 (Anthropic / OpenAI / 로컬 endpoint 템플릿). 제품 부담 기본 모델 (proxy 운영) 도입은 별도 판정 (scope 밖)                          |
| R3  | ~~컴포넌트 카탈로그 ~311K tok > context 예산~~ → **해소 (2026-08-28 실측)**: catalog 파생 전체 상세 6,454 tok 으로 예산 안. 311K 는 RAC/RSP 원문 추정치였다 |  LOW   | Phase 5 G5 통과 — Tier 1/2 동적 주입은 4.6x 최적화로 유지 (필수 아님). **RAG 도입 근거 소멸** |
| R4  | (재규정 2026-08-26) 도구 schema 가 frame / slot / componentSemantics 1차 필드를 표현하지 못하거나, 확장 시 facade 를 우회해 `elementsMap` 직접 접근이 재도입됨 |  MED   | Phase 3 G3 — 도구 schema 에 1차 필드 어휘 반영 + facade / store action 외 direct access 0 grep gate (현 baseline 0 — 회귀 gate) + `runCanonicalMutation` 으로 batch history 1건 |
| R5  | `collections` SSOT 와 dataBinding 도구 시그니처 정합 (ADR-132 Transformer 제거 영역)                                                                           |  MED   | Phase 4 G4 — `Element.dataBinding` 설정 + `useCollectionData({ datatableId \| dataBinding })` 진입점 + `Transform 3단계` 어휘 미도입 회귀 gate                                  |
| R6  | (재작성 2026-08-26) AI 이벤트 도구가 ADR-158 `InteractionRule` 이 아니라 dormant `SerializedEvent` / root `actions` 를 목표로 구현됨 (round 1 HIGH)            |  MED   | Phase 4 G4 — `InteractionRule` + `addEvent` 경유 + `capabilityRegistry` 검증 + `SerializedEvent` / `actions` root / `element.props.events` 어휘 0 grep gate                     |
| R7  | AIPanel UX 1년차 신입 baseline 검증 (HC12 — ADR-149 P1 선례)                                                                                                   |  MED   | Phase 8 evaluator agent screenshot 검증 + depth 4→2 축소 measure                                                                                                                |
| R8  | Provider 별 Tool Calling format 차이 (Anthropic tool use / OpenAI function calling)                                                                            |  MED   | `LLMProvider.completeWithTools` 통합 시그니처 + 2-way 어댑터 표준화 (4-way → 2-way 축소로 원 위험 대비 완화)                                                                    |
| R9  | groq-sdk 완전 제거 시 기존 Phase A1~A4 산출물 회귀                                                                                                             |  MED   | Phase 2 G2 — 대체 provider (에이전트 프로파일 경유) 로 기존 7개 도구 전수 통과 + AbortController + G.3 시각 피드백 보존                                                         |
| R10 | (재규정) 폐쇄망 = 로컬 endpoint BYOK — endpoint 품질·모델 선택이 사용자 소관이 되어 결과 편차                                                                  |  MED   | Phase 7 G6 — Ollama OpenAI-compatible endpoint 로 7 도구 전수 통과 1회 실측 + 로컬 endpoint 설정 가이드 문서화. 모델별 품질 보증은 제품 책임 아님                               |
| R11 | Phase scope inflation (단일 ADR 9 Phase + 4 격차 영역 → 1.5x gap 가능성)                                                                                       |  MED   | [adr-writing.md M4](rules) — Phase scope inflation 1.5x 시 사용자 confirm 의무. Phase 별 design breakdown freeze                                                                |
| R12 | (신규) 원격 provider 프록시 경계 부재 시 BYOK 키 브라우저 노출 재발 (Groq 사례 반복)                                                                           |  MED   | Phase 2 G2 — `dangerouslyAllowBrowser` 0 + browser 번들 내 원격 provider 직접 호출 0 grep gate. 프록시 방식 (Supabase Edge Function 등) Phase 2 확정                            |

잔존 HIGH 위험 1개 (R1) → Gate G7 로 관리. R1 은 외부 인프라 (Electron 도입 시점) 위험이라 adr-writing.md 선차단 체크 "HIGH+ 위험 코드 경로 3곳 인용" 은 N/A — 코드 경로가 아직 없다 (`package.json` 에 electron / 에이전트 SDK 의존 0건, 2026-08-26 실측).

## Gates

| Gate | 시점         | 통과 조건                                                                                                                                                                                                                                                                         | 실패 시 대안                                                    |
| ---- | ------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------- |
| G1   | Phase 1 완료 | `LLMProvider` 추상화 + 2-way 어댑터 (Anthropic / OpenAI-compatible) + 에이전트 프로파일 설정 모델 반영 (Ollama 는 OpenAI-compatible 로 통과)                                                                                                                                      | Provider 인터페이스 재설계                                      |
| G2   | Phase 2 완료 | `groq-sdk` 0 grep + `dangerouslyAllowBrowser` 0 grep + browser 번들 원격 provider 직접 호출 0 + 대체 provider 로 7개 도구 전수 통과                                                                                                                                               | 키 경유 방식 재설계 (프록시 ↔ 로컬 gateway), fallback 단계 추가 |
| G3   | Phase 3 완료 | 도구 schema 에 frame / slot / componentSemantics 어휘 반영 + AI 가 `type: "frame"` 요소 1건 생성 live 실측 + facade / store action 외 `elementsMap` / `childrenMap` 직접 접근 0 grep gate (회귀) + `batchDesign` 이 history 1건으로 묶임                                          | store action 추가 (`insertNode` 인자 확장 등)                   |
| G4   | Phase 4 완료 | AI 가 `InteractionRule` 1건 생성 → Preview 동작 live 실측 + `Element.dataBinding` 설정 → `useCollectionData` 로 데이터 렌더 live 실측 + 신규 도구가 `SerializedEvent` / root `actions` / `Transform` / `Group + group_N` 어휘 미도입 (회귀 gate, 착수 전 baseline 0건 2026-08-26) | 도구 시그니처 재설계, capability 노출 범위 조정                 |
| G5   | Phase 5 완료 | 컴포넌트 카탈로그 Props 정확도 ≥ 90% (RAC / RSP 문서 기반 검증, executor 프로파일 기준 모델)                                                                                                                                                                                      | 카탈로그 형식 재설계, 동적 주입 전략 변경 (RAG 도입)            |
| G6   | Phase 7 완료 | 에이전트 프로파일 라우팅 (D7 분해) 동작 + 폐쇄망 시나리오 — 전 프로파일 로컬 endpoint 바인딩으로 7 도구 통과 1회 실측                                                                                                                                                             | 프로파일 구성 UX 보강, 로컬 endpoint 가이드 확충                |
| G7   | Phase 9 완료 | 외부 에이전트 (ACP/SDK) embed 1종 이상 + MCP 도구 표면으로 composition 조작 실측 + Canvas 60fps 유지 (R1 HIGH 위험 통과)                                                                                                                                                          | Phase 9 보류, Phase 1-8 자립 운영 유지 (BYOK provider 기본)     |

## Consequences

### Positive

- **reference 수렴 노선**: Pencil.app / openpencil / open-pencil / holaOS / grok-build 5개 reference 와 같은 방향 — 교차 검증 가능한 패턴 (에이전트 프로파일별 모델 / BYOK / 에이전트 오케스트레이션 / ACP·MCP / 도구 지연 로딩), 고립 노선의 모델 수명주기 부담 소멸. 조직 원리 정본 = Pencil.app embed + ZSeven-W/openpencil 오케스트레이션 (§패턴 채택 주)
- **단일 진입점**: `LLMProvider` 통합 인터페이스 + 에이전트 프로파일로 원격/로컬 모델 자유 전환 — 폐쇄망은 로컬 endpoint 바인딩으로 동등 달성
- **canonical document 정합**: AI 가 `CompositionDocument` 의 frame / slot / componentSemantics 1차 필드와 interaction rule 을 도구 어휘로 다룰 수 있음 — ADR-116/122/130/158 반영 영역 활용 (store 정합은 facade canonical-primary 로 이미 확보)
- **`collections` SSOT 정합**: `Element.dataBinding` + `useCollectionData({ datatableId | dataBinding })` 통합 read 진입점 + `collections.runtimeData` sink — ADR-132 정합
- **interaction rule root collection 정합**: `InteractionRule` schema + `capabilityRegistry` — ADR-158 정합
- **groq-sdk 완전 제거 + secret isolation**: 벤더 종속 해소 + `dangerouslyAllowBrowser: true` 제거가 1급 결정 (Hard Constraint 13) 으로 승격 — API 키 브라우저 노출 구조 재발 차단
- **컴포넌트 카탈로그**: provider 무관 도메인 지식 주입 — 어느 모델이든 composition vocabulary 정확도 확보
- **에이전트 오케스트레이션**: Plan→Execute→Verify 를 planner/executor/verifier 서브에이전트 분해로 실행 (ZSeven-W 패턴) + bounded repair (max 2회) + 에이전트별 진행 표시
- **외부 에이전트 확장로**: MCP 호환 도구 표면이 Phase 9 (Claude Code / Codex embed) 와 노선 γ 재평가의 전제를 준비
- **AIPanel UX 1년차 신입 baseline**: depth 4→2 축소 (HC12 — ADR-149 P1 선례)

### Negative

- **BYOK 온보딩 공백**: 키/endpoint 미설정 사용자는 AI 기능 0 (R2) — 원 노선의 "로컬 모델 내장 = 설정 없는 기본 경험" 은 포기. 기본 제공 모델 (proxy 운영) 은 별도 판정
- 9 Phase 작업 분량 + 4 격차 영역 동시 정합 — single ADR scope 큼 (R11)
- Electron 시점 미확정으로 Phase 9 (외부 에이전트 embed) 차단 (R1 HIGH 보존 — 단 원 노선과 달리 Phase 1-8 이 제품 완결)
- 폐쇄망 품질이 사용자 로컬 endpoint 선택에 의존 (R10) — 제품이 모델 품질을 보증하지 않음
- 원격 provider 프록시 (Supabase Edge Function 등) 운영 표면 추가 (R12)
- 컴포넌트 카탈로그 유지보수 — RAC / RSP 업데이트 시 재생성 필요 (원 결정과 동일 부담)

## supersede / 폐기 관계

- **ADR-011 → Deprecated** (Replaced by ADR-134) — Phase A1~A4 산출물 (도구 7개 + AIPanel + AbortController + G.3) 은 본 ADR Phase 2 에서 보존 + Phase 3-4 에서 canonical 어휘 확장 (store 경로는 이미 canonical-primary — 교체 아님, 2026-08-26 정정)
- **ADR-054 → Deprecated** (Replaced by ADR-134) — Proposed 영역 중 Provider 추상화 / 폐쇄망은 본 ADR Phase 1/7 에 흡수 (2026-08-18 노선 개정으로 재규정), **Ollama 전용 어댑터 / node-llama-cpp 내장 / Qwen 모델 고정 / 난이도 라우팅은 노선 α 기각과 함께 승계 종료**

## 개정 이력

| 날짜       | 내용                                                                                                                                                                                                                                                                                                                                                                                                                                                 |
| ---------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 2026-05-13 | 최초 작성 — ADR-011 + ADR-054 단일 통합, 노선 α (자체 로컬 LLM 내장), 설계 문서만 반영                                                                                                                                                                                                                                                                                                                                                               |
| 2026-08-18 | 노선 재결정 (사용자 재제기) — 노선 α 기각 → 노선 β (역할별 BYOK + 외부 에이전트/MCP 준비). 격차 5 추가, Hard Constraint 4 삭제·7 재규정·13 추가, D1/D8 개정, D10/D11 신규                                                                                                                                                                                                                                                                            |
| 2026-08-18 | 수렴 근거 보강 — xai-org 9개 저장소 분석 (XAI_ORG_ANALYSIS.md) 반영: grok-build 를 격차 5 의 5번째 수렴 사례로 추가 (reference 4→5개), D11 에 도구 지연 로딩 (`search_tool`+`use_tool`, 3중 독립 수렴) 정본 reference 명시                                                                                                                                                                                                                           |
| 2026-08-18 | 2차 정정 (사용자) — 조직 원리 교정: open-pencil 역할 고정 슬롯 4종 비채택 → **Pencil.app (외부 에이전트 embed) + ZSeven-W/openpencil (에이전트 팀 오케스트레이션)** 패턴 채택. 모델 구성 단위 = 에이전트 프로파일. D1/D7/D8/D9 재규정, Phase 1/6/7 재명명 (§패턴 채택 주)                                                                                                                                                                            |
| 2026-08-26 | 리뷰 round 1 반영 (reviews/134.md) — 응용 영역 코드 사실 재측정: 격차 1 재규정 (facade canonical-primary + 어휘 부재), `SerializedEvent` → `InteractionRule` (ADR-158), mutation API 실존 표면으로 교체 (`setFrames/setSlots/nodeOpsActions` 폐기), ADR-133 → HC12 독립 선언 + ADR-149 P1 선례, `data_tables` → `collections` 통일, G3/G4 live 실측 + 회귀 gate 로 재표현, R1 seed N/A 명시. HC8/9/10/12, D2/D3/D4/D9, R4~R7, G3/G4, 격차 1/2/4 갱신 |
| 2026-08-28 | **Accepted 승격 + Phase 0 반영** — 리뷰 round 2 승인 기록(pending 0)으로 Status 전이, 사용자 `/execute-adr 134` 착수. Phase 0 inventory baseline freeze 완료 (Groq 표면 국소화 · `AIAgentProvider` dormant · Edge Function 미존재 · 회귀 gate baseline 0). 사용자 결정 "Groq 는 더 이상 사용하지 않는다" 확인 — 현행 모델 id 만료(404)로 AI 패널이 이미 정지 상태이며 Phase 1+2 가 복구 경로. ADR-196 descriptor 소비 정합 1줄 (D11)                 |

## 관련

- 본문 design: [design/134-ai-assistant-llm-infrastructure-unification-breakdown.md](design/134-ai-assistant-llm-infrastructure-unification-breakdown.md)
- 노선 재결정 근거: [PENCIL_ECOSYSTEM_ANALYSIS.md](../explanation/research/PENCIL_ECOSYSTEM_ANALYSIS.md) (§5 비교 매트릭스 / §8 차용 후보 4·7·12·17 / §9-5 AI productization / §10 acceptance criteria) + [OPENPENCIL_DETAIL.md](../explanation/research/OPENPENCIL_DETAIL.md) + [HOLAOS_ANALYSIS.md](../explanation/research/HOLAOS_ANALYSIS.md) (§3 하니스 추상화·BYOK·deferred tool gateway / §4 노선 β 정합 표 / §5 차용 후보) + [XAI_ORG_ANALYSIS.md](../explanation/research/XAI_ORG_ANALYSIS.md) (§2 grok-build 하니스 실측 / §5-1 ADR-134 매핑 8건 — 도구 지연 로딩·capability 술어·retry 스펙·프롬프트 템플릿·compaction·권한 파이프라인 / §5-2 marketplace 배포 계약)
- 폐기 대상: [completed/011-ai-assistant-design.md](completed/011-ai-assistant-design.md) / [completed/054-local-llm-architecture.md](completed/054-local-llm-architecture.md)
- 정합 ADR: ADR-116 / ADR-122 (canonical document) / ADR-130 (frame) / ADR-131 → [ADR-158](completed/158-interactions-rules-capability-registry.md) (interaction rule root collection + capability registry) / ADR-132 (useCollectionData) / [ADR-149](completed/149-events-panel-canonical-simplification.md) P1 (1년차 신입 baseline 선례 — ADR-133 Deprecated 2026-07-08 후 승계)
- 리뷰 기록: [reviews/134.md](reviews/134.md) — round 1 (2026-08-26) 응용 영역 코드 사실 재측정 이슈 8건 반영
- 동일 패턴: ADR-133 (3 ADR Deprecated + 통합 신규 ADR + 설계 문서 먼저 + Phase 실행 사용자 review 후 — ADR-133 자체는 이후 Deprecated, 절차 패턴만 참조)
