# Prompt Audit 2026-09 — `/claude-api prompt-audit` 결과

> 계기: Claude Platform 블로그 "Reducing cost and improving performance" (2026-09-08) 의 권장 3축 (prompt caching · 안티패턴 제거 · effort) 을 이 저장소에 적용. 이 문서는 `claude-api` skill 의 prompt-audit 절차 (Step 0~6) 산출물 — **보고서 + 제안 diff**. 적용은 hunk 단위로 사용자가 고른다 (skill 계약).

## 0. 전제 (Step 0)

| 항목          | 값                                                                                                                                                                                                                                                                                                                                                               |
| ------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 범위 A        | Claude Code harness 프롬프트 표면 — `CLAUDE.md` · `CLAUDE.local.md` · `~/.claude/CLAUDE.md` · `.claude/rules/*.md` (18) · `.claude/skills/*/SKILL.md` (14) · `.claude/agents/*.md` (2) · `.claude/output-styles/*.md` (2) · hook 주입 텍스트 (`session-start.sh` · `route-prompt.sh`) · auto-memory `MEMORY.md` (27KB, 상시 로드). 합계 5,353 줄 + 메모리 인덱스 |
| 범위 B        | 앱 LLM 표면 — `apps/builder/src/services/ai/**` (system prompt 문자열은 `apps/builder/src/i18n/translations.ts` `aiPrompt`/`aiAgent`/`aiVerify`/`aiToolDef`/`aiToolId`/`aiRunCommand`, 도구 스키마 `tools/definitions.ts`, 요청 조립 `providers/AnthropicProvider.ts`, 프로파일 `providers/AgentProfileRegistry.ts`, 서브에이전트 `agents/*`)                    |
| 범위 밖       | `AGENTS.md` (Codex 전용) · `docs/adr/**` (프롬프트 아님) · `IntentParser.ts` (AI 부재 시 규칙 기반 폴백 — LLM 호출 없음)                                                                                                                                                                                                                                         |
| 대상 모델 A   | Fable 5.1 (`claude-fable-5-1`) — 세션 모델. `CLAUDE.local.md:5` 기준 2026-09-02 부터                                                                                                                                                                                                                                                                             |
| 대상 모델 B   | `claude-opus-5` (planner) · `claude-sonnet-5` (main/executor/verifier) · `claude-haiku-4-5-20251001` (fast) — `AgentProfileRegistry.ts:70-103`. 기본 프리셋은 `local-ollama` (OpenAI 호환 — 비 Anthropic provider 표식). 감사는 이 프리셋을 Anthropic 으로 바꾸지 않는다                                                                                         |
| 출처 (Step 2) | harness 본문의 큰 덩어리는 2026-04 작성 (`git-workflow.md` 118/119 줄 · `cross-check/SKILL.md` 248/337 줄 · `ssot-hierarchy.md` 84/150 줄) — Opus 4.6/4.7 세대용. 저장소에 Fable 첫 등장 2026-07-03, Opus 5/Sonnet 5 2026-08-28, Fable 5.1 기본 2026-09-02                                                                                                       |

## 1. 요약

| 그룹                              | High | Medium | Low/flag |
| --------------------------------- | ---: | -----: | -------: |
| 1a 압박 어휘                      |    2 |      3 |        0 |
| 1b API 기능으로 대체되는 스캐폴드 |    1 |      2 |        0 |
| 2 skill/rule 파일                 |    2 |      1 |        3 |
| 3 도구 설명                       |    2 |      1 |        0 |
| 4 요청 구성·아키텍처              |    1 |      1 |        2 |

**영향 큰 순 3건**:

1. **앱 AnthropicProvider 가 prompt caching 을 전혀 쓰지 않고 `usage` 도 읽지 않는다** (H1). system prompt (카탈로그 124 type 인덱스 포함) + 도구 10종을 매 턴 전액 결제하고, 캐시가 도는지 확인할 계측이 없다. 블로그 1축의 가장 싼 레버가 통째로 비어 있다.
2. **`create_element` 도구 enum 이 카탈로그와 어긋난다** (H2). 스키마는 28 type 을 허용하는데 같은 요청의 system prompt 는 "아래 목록 (124) 에 있는 type 만" 이라 하고, 골격 힌트는 enum 에 없는 `Heading`·`ProgressBar` 를 만들라고 한다. 도구 계약과 프롬프트가 서로 다른 말을 한다.
3. **harness 가 매 세션 같은 내용을 3중으로 싣는다** (H4·M3). `session-start.sh` 로스터 12줄은 시스템 프롬프트의 skill description + `CLAUDE.md:57` 과 동일 정보, `route-prompt.sh` 힌트 3종은 `CLAUDE.md` 재삽입이다. 여기에 `CLAUDE.md` 12개 절 중 8개가 "(CRITICAL)" 라 표지가 정보를 잃었다.

## 2. 발견 (Step 5) — 신뢰도 순

### High

| #   | 위치                                                                                                                                                             | 근거 (인용)                                                                                                                                                                                                                         | 패턴                              | 왜 낡았나                                                                                                                                                                                                                                          | 조치                                                                                                       |
| --- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------- |
| H1  | `apps/builder/src/services/ai/providers/AnthropicProvider.ts:214-231` · 같은 파일 `message_start`/`usage` 파싱 없음                                              | `system`, `tools` 에 `cache_control` 0건. 스트림에서 `usage` 를 읽는 코드 0건                                                                                                                                                       | 4 (caching 부재 · 토큰 계측 부재) | Claude 5 계열 최소 캐시 prefix 512/1024 tok — system+tools 는 충분히 길다. 캐시 read 는 입력가의 0.1× (Fable 5.1 은 0.025×). `usage.cache_read_input_tokens` 없이는 캐시가 도는지 알 수 없다 (skill: "the usage fields are the only ground truth") | **add** — system 블록 breakpoint + 최상위 자동 `cache_control` + `usage` 를 stop 이벤트에 노출 (§3 D1)     |
| H2  | `apps/builder/src/services/ai/tools/definitions.ts:31-61,75` ↔ `translations.ts` `aiCatalog.intro1` · `aiTemplate.dashboard2/4` · `templates/layoutTemplates.ts` | enum 28개 (`"Button" … "frame"`) — 카탈로그 124 키. 프롬프트: "아래 목록에 있는 type 만 만들 수 있습니다" / "상단에 Heading 으로 제목을 넣는다" / "ProgressBar 로 지표를 표시". `createElement.ts` 실행기는 enum 을 검사하지 않는다 | 3 (계약 ≠ 실제 동작)              | 도구 설명은 man page — 계약이 실제와 다르면 어떤 프롬프트로도 못 고친다. 하드코딩 목록은 `systemPrompt.ts:6-8` 이 이미 "24개 하드코딩이 122개와 갈라져 값을 지어내는 원인" 이라고 기록한 바로 그 결함의 잔재                                       | **rewrite** — enum 을 `getAiComponentCatalog()` placeable type 에서 파생 (§3 D2)                           |
| H3  | `translations.ts` `aiAgent.plannerRole`·`plannerRule5`, `aiVerify.role`·`rule4` · `agents/PlannerAgent.ts:33-45` · `agents/VerifierAgent.ts:22-45`               | "**JSON 만** 출력합니다" ×2 · "설명이나 코드 블록 없이 JSON 만 출력하세요" ×2 · 코드 펜스 regex + `indexOf("{")` 추출 + 실패 시 `null`/`ok:true` 폴백                                                                               | 1b (JSON 강제 스택)               | 구조화 출력 `output_config.format` 이 스키마를 보장한다 — 프롬프트 강제 + regex 추출 + 폴백은 그 기능 이전의 스택. Anthropic 경로에서 `parsePlan` 이 `null` 을 내면 조용히 단일 실행으로 내려가 계획 자체가 사라진다                               | **replace-with-API-feature** — Anthropic 경로는 json_schema, 파서는 OpenAI 호환 경로 폴백으로 유지 (§3 D3) |
| H4  | `.claude/hooks/session-start.sh:56-75`                                                                                                                           | 로스터 12줄 (`composition-patterns` … `evaluate`) — 시스템 프롬프트의 skill description 과 동일. "사용자 전용" 3건은 `CLAUDE.md:57` 과 동일                                                                                         | 3 (실제 목록을 그림자처럼 반복)   | "system prompt 에 도구 이름을 열거하면 켜고 끌 때 dangling 이 남는다 — 삭제". 스크립트 주석 (53-55) 이 이미 "3중 중복 제거" 를 시도했으나 로스터 자체가 남았다. 세션당 ~1k tok                                                                     | **remove** — 로스터 블록 삭제, drift·memory 경고만 유지 (§3 A1)                                            |
| H5  | `CLAUDE.md:7,30,60,63,84,111,117,140`                                                                                                                            | "⚠️ 필수 … 반드시 … 읽으세요" · "(CRITICAL)" 절 표지 8개 / 12절                                                                                                                                                                     | 1a                                | "여러 지시가 각각 critical 이면 표지가 정보를 잃고, 프롬프트의 register 가 출력의 register 가 된다". 절마다 이미 **Why** 가 붙어 있어 표지 없이도 무게가 전달된다                                                                                  | **rewrite** — 절 제목의 "(CRITICAL)" 제거, Why 유지 (§3 A2)                                                |
| H6  | `.claude/skills/cross-check/SKILL.md:7,14,38,94,120,124,283`                                                                                                     | "(CRITICAL)" ×5 절 표지 · "**반드시** cross-check 실행" · "Chrome MCP 진입 전 반드시"                                                                                                                                               | 1a                                | 2026-04 작성 (Opus 4.6 세대). 절차 자체 (Step 0 catalog 선판정 · dist 신선도) 는 저자만 아는 문맥이라 유지                                                                                                                                         | **rewrite** — 표지·"반드시" 제거, 절차 본문 유지 (§3 A3)                                                   |
| H7  | `.claude/rules/git-workflow.md:21-28,99-105`                                                                                                                     | §2 사용자 인용 4건 ("어느순간 부터 …") · §8 "위반 이력 (재발 8회+ 누적)" — 날짜 5건, PR 번호 8건, `"PR 생성 하지마!!"`                                                                                                              | 2 (history narrative)             | "규칙의 권위는 처방하는 동작이지 사건이 아니다 — 고고학은 버린다". §1 규칙 자체는 8회 재현된 실패라 **유지** (keep list 5). 이력의 정본은 이미 `memory/feedback-pr-vs-direct-push.md` (§관련, 109행)                                               | **move** — §2 인용·§8 을 메모리로, 규칙 파일엔 "재발 8회 (2026-04)" 한 줄 (§3 A4)                          |
| H8  | `.claude/rules/changelog.md:10`                                                                                                                                  | "배경: 2026-04-06 이후 2026-04-24 까지 18일간 CHANGELOG 미갱신 + 1,300+ 커밋 drift 가 관측되었다 …"                                                                                                                                 | 2 · 1d (코드로 집행되는 규칙)     | drift 감시는 `session-start.sh:5-31` 이 매 세션 계산해 경고한다 — 서사는 집행 수단이 아니다                                                                                                                                                        | **rewrite** — 한 줄 ("14일/100 커밋 초과 시 hook 이 경고") (§3 A5)                                         |

### Medium

| #   | 위치                                                                                                                   | 근거 (인용)                                                                                                                                                                         | 패턴                           | 왜 낡았나                                                                                                                                                                               | 조치                                                                                     |
| --- | ---------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------- |
| M1  | `translations.ts` `aiPrompt.rule1`                                                                                     | "1. 요소를 생성/수정하기 전에 get_editor_state나 get_selection으로 현재 상태를 파악하세요."                                                                                         | 1b ("plan before acting")      | 턴 컨텍스트 (`buildTurnContext`) 가 이미 페이지·선택 요소 type/id/props·개수를 싣는다. 무조건 선행 호출은 매 요청 도구 1회를 강제한다. 실제 id 가 필요한 경우는 rule2 가 이미 규정      | **rewrite** — rule1 삭제, rule2 에 "실제 id 가 필요할 때만 조회" 로 흡수 (§3 D4)         |
| M2  | `.claude/rules/premise-decision-points.md:23`                                                                          | "**결정 지점의 사고는 깊은 사고로 (CRITICAL)**: … 표면 답변 (plan→execute→done) 을 피하고 깊은 사고 모드로 진입한다"                                                                | 1b (사고 깊이를 산문으로 지시) | 깊이는 `effort` 로 조절한다 — Claude 5 계열은 adaptive thinking 이 항상 켜져 있고 "think harder" 산문은 중복. 남길 것은 **무엇을** 따져야 하는지 (4 결정 지점의 판단 재료)              | **rewrite** — "깊은 사고 모드" 문장을 판단 재료 목록으로 교체 (§3 A6)                    |
| M3  | `.claude/hooks/route-prompt.sh:29-51`                                                                                  | 힌트 3종 — ADR 사용자 전용 (= `CLAUDE.md:57`) · 렌더링 cross-check (= `CLAUDE.md:59,125`, 스크립트 주석 "CLAUDE.md 에도 있지만 … 상기") · 정정→메모리 (= 시스템 프롬프트 Memory 절) | 1d (턴마다 지시 재삽입)        | "재삽입은 긴 세션에서 지시를 잃던 모델의 목발 — 현재 모델은 한 번 말한 지시를 유지한다". 스크립트가 2026-08-31 에 14→3 으로 줄였으나 남은 3개도 상시 컨텍스트와 같은 내용               | **remove** — hook 을 settings 에서 제거 (파일은 삭제 승인 별도) (§3 A7)                  |
| M4  | `translations.ts` `aiToolDef.updateElement` · `aiToolDef.getSelection`                                                 | "기존 요소의 속성이나 스타일을 수정합니다." (1문장) · get_selection 1문장 — merge/replace 의미 없음, 언제 쓰지 말라는 말 없음                                                       | 3 (설명 부족)                  | 도구 설명의 기준은 정밀도 — props/styles 는 spread merge, fills 는 주어지면 **교체** (`updateElement.ts:73-89,115`). get_selection 은 턴 컨텍스트가 이미 같은 정보를 실어 대부분 불필요 | **add** — 계약 문장 추가 (§3 D5). delete_element 의 자식 처리는 실측 후 (flag)           |
| M5  | `.claude/rules/layout-engine.md:16,65,73,81,90,96` · `adr-writing.md:9,11,17,24,37` · `execute-adr/SKILL.md:27,98,156` | 절 제목 "(CRITICAL)" ×6 / ×5 / ×3. `canvas-rendering.md` 는 "금지" 41회/236줄                                                                                                       | 1a                             | H5 와 같은 이유. glob-scoped 라 세션 세금은 낮지만 해당 파일 작업 시 register 가 전이된다. `review/SKILL.md` 의 CRITICAL 은 심각도 어휘 (체크리스트 등급) 라 제외                       | **rewrite** — 표지 제거 (§3 A8). "금지" 는 각 줄에 Why 가 붙어 있어 keep list 5 — 표지만 |
| M6  | `AnthropicProvider.ts:205-232`                                                                                         | `fallbacks` 없음 — planner 가 `claude-opus-5` (안전 분류기 적용 모델). `refusal` 은 사용자에게 사유만 보여주고 종료 (`AgentService.ts:106-117`)                                     | 4 (재기준선 추가 항목)         | Fable 5.1 / Opus 5 이전 체크리스트 [TUNE]: "refusal 처리 + 기본으로 fallback 옵트인 (`fallbacks: "default"` + beta `server-side-fallback-2026-07-01`)"                                  | **add** (선택) — beta 헤더 + `fallbacks: "default"` (§3 D6)                              |

### Low / flag

| #   | 위치                                              | 근거                                                                                                                        | 판정                                                                                                                      |
| --- | ------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------- |
| L1  | `CLAUDE.local.md:5` ↔ `~/.claude/settings.json:8` | 문서는 `model: "claude-fable-5-1[1m]"`, 실제 파일은 `"model": "opus[1m]"`. 이 세션의 `/model` 은 다른 곳에 저장했을 수 있다 | flag — 저장 위치 확인 후 문서 1줄 정정                                                                                    |
| L2  | `memory/MEMORY.md` 27KB (상시 로드)               | `session-start.sh:33-34` 가 30KB 를 truncate 임계로 경고                                                                    | flag — 낡은 패턴이 아니라 크기 세금. 압축은 wiki-lint 소관                                                                |
| L3  | `.claude/skills/composition-patterns/SKILL.md:3`  | description 이 트리거 구절 4개 열거                                                                                         | flag — 트리거 텍스트는 조정된 긴급도를 가질 수 있다 (Group 3 split)                                                       |
| L4  | `AgentProfileRegistry.ts:100`                     | `claude-haiku-4-5-20251001` (날짜 접미)                                                                                     | flag — skill 표는 `claude-haiku-4-5`; 둘 다 해석된다                                                                      |
| L5  | `AgentProfileRegistry.ts:70-103` effort/모델 배치 | planner opus-5 high · verifier sonnet-5 medium · main/executor sonnet-5 (기본 high)                                         | flag — 블로그 3축 ("강한 모델 + 낮은 effort") 은 eval 세트가 있어야 판정 — `/claude-api hillclimb` 범위, 프롬프트 감사 밖 |

### 검토 후 유지 (keep list 적용)

- `ssot-hierarchy.md` §6 금지 패턴 · `canvas-rendering.md` 금지 항목 — D1/D2/D3 경계 제약이고 각 줄에 이유가 있다 (keep 1·5).
- `git-workflow.md` §1 규칙 · `CLAUDE.md` §완료 기준 (ADR-144 34 커밋 revert) · §마이그레이션 삭제 승인 — 재현된 실패에 대한 제약 (keep 5). 정확한 시퀀스가 하나뿐인 작업 (push · 삭제) 은 스크립트 유지 (keep 3).
- `aiPrompt.rule2` ("elementId 는 지어내지 마세요" + 자리표시자 실패 사유) · `aiToolId.elementId*` 4건 중복 — 서로 일치하는 작동 중 중복 (keep 8).
- `aiVerify.rule3` ("확신이 없으면 ok: true — 불필요한 재시도가 사용자 작업을 되돌릴 수 있습니다") — 이유 있는 업무 제약.
- `~/.claude/CLAUDE.md` 어휘 표 — 이유·예외가 명시된 정책 제약.
- `CLAUDE.md:140` 마지막 단락 — 의도된 1회 recap (keep 10).
- `agents/orchestrator.ts` planner/executor/verifier 로스터 — 역할·도구가 다르고 1단계 요청은 분해를 건너뛴다 (Group 4 중복 서브에이전트 아님).
- `systemPrompt.ts` 고정 system + 턴 컨텍스트 분리 (2026-09-03) — 이미 캐시 친화 배치. H1 은 이 배치 위에 breakpoint 만 얹는다.

## 3. 제안 diff (Step 6) — hunk 단위

### D 앱 (`apps/builder`)

**D1 · H1 caching + usage** — `providers/AnthropicProvider.ts`

```ts
// buildRequestBody
...(system
  ? { system: [{ type: "text", text: system, cache_control: { type: "ephemeral" } }] }
  : {}),
messages: wire,
...(tools ? { tools, tool_choice: {...} } : {}),
// 대화 꼬리는 자동 breakpoint 가 따라간다 (skill §Automatic vs explicit — agent loop 권장 조합)
cache_control: { type: "ephemeral" },
```

- 렌더 순서 tools → system → messages 라 system 블록 breakpoint 하나가 tools 까지 덮는다.
- `message_start.message.usage` (`input_tokens` · `cache_creation_input_tokens` · `cache_read_input_tokens`) + `message_delta.usage.output_tokens` 를 모아 stop 이벤트 `usage` 로 노출 (`LLMStreamEvent` stop 에 `usage?: LLMUsage` 추가). AgentService 는 DEV 에서 `console.debug` 로 표시.
- 테스트: 요청 본문 `system[0].cache_control` · 최상위 `cache_control` 존재 (RED→GREEN) · 스트림 fixture 의 usage 가 stop 이벤트로 나옴 · 기존 "system 은 최상위로" 테스트는 문자열→블록 배열로 갱신.
- 5분 TTL 유지 — AI 패널 턴 간격은 5분 미만이 보통. 1h 는 write 2× 라 이득 없음.

**D2 · H2 enum 파생** — `tools/definitions.ts`

```ts
import { getAiComponentCatalog } from "../catalog/componentCatalog";
const COMPONENT_TAGS = getAiComponentCatalog()
  .filter((e) => e.placeable)
  .map((e) => e.type);
```

- 기존 `COMPONENT_TAGS` 상수 삭제. G1 테스트 ("도구 10종 …") 는 이름·스키마 동일성만 보므로 영향 없음. 회귀 테스트: enum 에 `Heading`·`ProgressBar` 포함, `frame` 포함.

**D3 · H3 구조화 출력** — `providers/LLMProvider.ts` · `AnthropicProvider.ts` · `agents/PlannerAgent.ts` · `agents/VerifierAgent.ts` · `translations.ts`

- `LLMCompletionOptions.responseSchema?: Record<string, unknown>` 추가. Anthropic 어댑터: `output_config.format = { type: "json_schema", schema }` (effort 와 같은 `output_config` 안). OpenAI 호환 어댑터: 무시 (파서 폴백 유지).
- Planner 스키마 `{goal: string, steps: [{index, instruction, done?}]}` · Verifier `{ok: boolean, issues: string[]}`.
- 프롬프트: `plannerRole` 의 "**JSON 만** 출력합니다" · `plannerRule5` 의 "설명이나 코드 블록 없이 JSON 만 출력하세요" · `aiVerify.role` 의 "**JSON 만**" · `aiVerify.rule4` 삭제 (en 도 동일). `plannerRule5` 의 "최대 6개" 는 코드 (`steps.slice(0, 6)`) 가 집행하므로 스키마 `maxItems: 6` 으로 이동.
- `parsePlan`/`parseVerdict` 는 OpenAI 호환 경로용으로 남는다 (동작 무변경).

**D4 · M1 rule1 흡수** — `translations.ts` (ko/en)

```
- rule1: "1. 요소를 생성/수정하기 전에 get_editor_state나 get_selection으로 현재 상태를 파악하세요."
+ (삭제 — rule2 첫 문장에 "실제 id 가 필요할 때만 search_elements / get_editor_state 로 조회합니다" 추가, 번호 재조정)
```

**D5 · M4 도구 계약 보강** — `translations.ts` `aiToolDef`

```
- updateElement: "기존 요소의 속성이나 스타일을 수정합니다."
+ updateElement: "기존 요소의 속성이나 스타일을 수정합니다. props 와 styles 는 기존 값에 병합되고 (주지 않은 키는 유지), fills 는 주어지면 배열 전체가 교체됩니다. 요소 type 은 바꿀 수 없습니다 — 다른 컴포넌트가 필요하면 delete_element 후 create_element."
- getSelection: "현재 선택된 요소의 상세 정보를 조회합니다. 태그, 속성, 스타일, 부모/자식 관계를 반환합니다."
+ getSelection: "현재 선택된 요소의 상세 정보를 조회합니다. 태그, 속성, 스타일, 부모/자식 관계를 반환합니다. 선택 요소의 type·id·props 는 이미 요청 컨텍스트에 있으므로, 자식 목록이나 스타일이 추가로 필요할 때만 호출하세요."
```

**D6 · M6 refusal fallback (선택)** — `AnthropicProvider.ts`: 헤더 `anthropic-beta: server-side-fallback-2026-07-01` + 본문 `fallbacks: "default"`. Sonnet 5 main 에서는 no-op, opus-5 planner 에서 의미. BYOK 사용자 계정의 beta 가용성에 의존하므로 기본 off 옵션으로 두는 편이 안전.

### A harness (`.claude/`, `CLAUDE.md`)

**A1 · H4** — `session-start.sh:56-75`: `<composition-workflow-roster>` 의 "## 핵심 Skills" 12줄 삭제. drift·memory 경고 블록만 남긴다.

**A2 · H5** — `CLAUDE.md`

```
- > **⚠️ 필수**: 코드 작업 시작 전 반드시 `.claude/skills/composition-patterns/SKILL.md`를 읽으세요.
+ > 코드 작업 전 `.claude/skills/composition-patterns/SKILL.md` 를 읽는다 — 규칙 인덱스가 거기 있다.
- ## SSOT 체인 정본 — 3-Domain 분할 (CRITICAL)                     → ## SSOT 체인 정본 — 3-Domain 분할
- ### 완료 기준 — test/type-check PASS 단독으로 ADR·task 종결 금지 (CRITICAL) → ### 완료 기준 — test/type-check PASS 단독으로 ADR·task 종결 금지
- ## CHANGELOG 관리 (CRITICAL)                                       → ## CHANGELOG 관리
- ## 마이그레이션/리네임/삭제 작업 원칙 (CRITICAL)                   → ## 마이그레이션/리네임/삭제 작업 원칙
- ## Git Push 정책 (CRITICAL — 로컬 작업 환경 절대 정책)             → ## Git Push 정책 — 로컬 작업 환경
- **전제·관점 의문 처리 — 결정 지점 한정 (CRITICAL)**:              → **전제·관점 의문 처리 — 결정 지점 한정**:
```

`CLAUDE.md:60` "CRITICAL/HIGH 이슈: 즉시 수정, 스킵 금지" 는 심각도 어휘라 유지.

**A3 · H6** — `cross-check/SKILL.md`: 7·38·94·120 의 "(CRITICAL)" 제거, 14 "**반드시** cross-check 실행" → "cross-check 를 실행한다", 124 "진입 전 반드시 아래 절차 수행" → "진입 전 아래 절차를 거친다". 283 은 심각도 어휘 — 유지.

**A4 · H7** — `git-workflow.md`

```
- ## 2. 왜 — 자동화 흐름 차단이 본질 손실
- 사용자 지적 (2026-04-27): (인용 4건)
+ ## 2. 왜 — 자동화 흐름 차단이 본질 손실
+ (인용 블록 삭제, "PR 패턴이 일으키는 실제 손실" 1~5 는 유지)
- ## 8. 위반 이력 (재발 8회+ 누적)  (본문 6줄)
+ ## 8. 이력
+ 2026-04 한 달에 8회 재발 후 절대 정책으로 전환. 사건별 기록: `memory/feedback-pr-vs-direct-push.md`.
```

메모리 파일에 §8 본문을 옮겨 붙인다 (정보 손실 0).

**A5 · H8** — `changelog.md:10`

```
- > **배경**: 2026-04-06 이후 2026-04-24 까지 18일간 CHANGELOG 미갱신 + 1,300+ 커밋 drift 가 관측되었다 (…). 본 규칙은 동일 drift 재발 방지를 위한 trigger-based 의무 갱신 contract.
+ > drift 는 `session-start.sh` 가 매 세션 계산해 14일 또는 100 커밋 초과 시 경고한다. 본 규칙은 trigger 기반 갱신 계약이다.
```

**A6 · M2** — `premise-decision-points.md:23`

```
- **결정 지점의 사고는 깊은 사고로 (CRITICAL)**: 4개 결정 지점에서는 표면 답변 (plan→execute→done) 을 피하고 깊은 사고 모드로 진입한다. tool 호출로 outsource 금지 — …
+ **결정 지점에서 따질 것**: 어느 ADR 의 어느 전제가 흔들리는지 · 코드 실측 근거가 무엇인지 · 반대 방향의 설명이 성립하는지 · 사용자에게 무엇을 물어야 답이 갈리는지. codex review / cross-check 는 본문 정합 layer 일 뿐 전제·관점 layer 가 아니다. 절차 컴플라이언스 통과가 사용자 confirm 을 대체하지 못한다.
```

**A7 · M3** — `.claude/settings.json` `UserPromptSubmit` 에서 `route-prompt.sh` 제거. 파일 삭제는 별도 승인.

**A8 · M5** — `layout-engine.md` 6 절 · `adr-writing.md` 5 곳 · `execute-adr/SKILL.md` 3 곳의 "(CRITICAL)" 표지 제거 (본문 무변경).

## 4. 검증 (Step 7)

- D1: 같은 system+tools 로 2회 요청 시 2번째 `usage.cache_read_input_tokens > 0` — `AnthropicProvider.live.test.ts` (키 게이트) 에 assertion 추가. 키 없으면 요청 본문 스냅샷 테스트만.
- D2·D3·D4·D5: unit (RED→GREEN) + AI 패널 live 1회 — "대시보드 만들어줘" 로 Heading 생성 여부 (D2) · planner JSON 파싱 실패 0 (D3).
- A1~A8: 동작 변경 0 (텍스트) — `pnpm hooks:selftest` + `pnpm codex:agent-catalog` 게이트 통과. 행동 회귀는 다음 세션 관찰 (PR 정책 위반 · cross-check 누락 발생 시 해당 hunk 원복).
- 재감사 시점: 다음 모델 세대 이전 시 (`shared/model-migration.md` 새 절 추가가 트리거).
