# ADR-213: 데이터 tool 계약 — 읽기 tool · `propose_data_change` 승인 경로 · `bind_collection` 정정 · "왜 실패했지?"

## Status

Implemented — 2026-09-12 (Proposed 2026-09-11 · 리뷰 Round 2 승인 · Phase 0~~7 완료 2026-09-11~~12, evidence [213-p0-inventory.md](../evidence/213-p0-inventory.md) 로컬)

> **선행 의존**: [ADR-152](152-data-panel-collection-binding-integration.md) 는 Implemented 이며 §2-3 `DataChange` 스키마 + `applyDataChange` 적용기가 base 다. Phase 1 읽기 tool은 독립이고, Phase 2 이후는 G0에서 현 consumer 격차를 freeze한 뒤 착수한다. [ADR-212](212-data-panel-editor-redesign.md) Phase 4는 본 ADR G1·G3의 공유 redactor와 G2·G4의 `define_endpoint` · `bind_element` consumer/coordinator에 의존한다. 실패 설명 UI는 공유 redactor가 먼저 적용되므로 역방향 의존 없이 먼저 제공할 수 있다. [ADR-202](../202-builder-ai-compiler-first-command-execution.md)에는 의존하지 않으며, 202 착수 시 `DataChange`를 감싸는 statement 어댑터로 편입한다.

## Context

빌더의 AI · 에이전트 표면이 데이터를 다루는 방법은 실측상 다음과 같다 (리서치 [DATA_PANEL_REDESIGN_RESEARCH_2026-09](../../explanation/research/DATA_PANEL_REDESIGN_RESEARCH_2026-09.md) §1-6):

- AI 패널 tool 9 + `run_command` 중 데이터 tool 은 `bind_collection` 하나이고, 그 형상이 legacy `source: "static" | "api" | "cloud"` + config 인라인 (`services/ai/tools/bindCollection.ts:24`) 이다 — 사람이 UI 로 기록하는 `{ source: "dataTable", name }` (ADR-159 P4b) 과 달라 **이미 있는 DataTable 에 요소를 잇는 tool 이 없다**. collection 생성 · 필드 추가 · 행 삽입 · API 정의 tool 은 0 (파일 주석이 "이 도구 범위 밖" 으로 명시).
- `get_editor_state` 는 pages · elements · selection 만 — 모델은 어떤 테이블이 있는지 모른 채 바인딩을 시도한다. 시스템 프롬프트 동적 주입 (`services/ai/catalog/dynamicInjection.ts`) 도 "컬렉션" 을 팔레트 카테고리로만 안다.
- agent 명령 allowlist 40 (ADR-196, `services/agent/agentCommands.ts`) 은 캔버스 · 패널 · 뷰포트만. 승인 게이트 (`AgentCommandConfirmDialog` — 명령 id · 되돌림 가능 여부) 와 세션 provenance 로그 (`agentCommandLog`)는 있으나 스키마 diff를 보여 주지 못한다. 이 로그는 durable audit store가 아니다.
- 데이터 편집은 History 밖이라 (152 격차 9) AI 가 만든 변경을 되돌릴 수단이 없다.

외부 대조 (리서치 §3-4 · §3-5) 는 예외 없이 한 계약으로 수렴한다 — **Propose → Review → Apply** (Bubble plan approve · NocoDB Suggest→Create · Lovable SQL 승인 · Cloud diff · Base44 import 승인, 8/8), 삭제 · 타입 변경은 AI 에서 기본 차단 (I2), 읽기는 fine-grained · 쓰기는 워크플로 단위 소수 (Anthropic "few high-impact workflow tools", Webflow · Cloud MCP), 스키마 계약은 컴팩트 JSON Schema + `strict` (Anthropic) / `outputSchema` (MCP), LLM 에는 스키마 + 샘플 N 행만 (I7). 비용이 가장 낮고 승인 UI 가 필요 없는 첫 출시 후보는 "왜 실패했지?" (Retool · Cloud · Postman, I5) 다.

**Domain 분류**: 본 ADR 은 **D2 (Props/API — tool 입력 계약 · `dataBinding` prop 형상)** 다. tool 이 만드는 결과는 152 적용기를 지나므로 데이터 SSOT (`data_tables`, ADR-131) 와 D3 대칭 (152 가 담당) 에 새 경로를 만들지 않는다. D1 무변경. 승인 UI 는 빌더 chrome (RAC Dialog).

**Hard Constraints**:

1. **모델 대면 쓰기 tool은 `propose_data_change` 하나** — 사용자 승인 없이는 적용되지 않는다. `bind_collection`은 compatibility alias로 유지하되 입력을 `bind_element` DataChange로 정규화해 같은 proposal/confirm dispatcher를 지난다. `remove_field` · `remove_rows`는 tool 스키마에서 제외한다. `origin:"ai"|"agent"` 적용 호출은 dispatcher 1곳뿐이다.
2. **스키마 단일 소스와 origin 권한** — tool 입력은 `packages/shared/src/schemas/dataChange.ts`에서 `origin`을 제외하고 delete op를 제한해 파생한다. executor가 인증된 호출 주체에 따라 `origin:"ai"|"agent"`를 stamp하며 모델 입력으로 받지 않는다. Anthropic JSON Schema · Ollama zod · output 검증은 같은 파생 스키마를 쓴다.
3. **컨텍스트 예산** — 목록 최대 50개, 이름은 최대 80 code point로 자른다. 동적 주입은 직렬화 UTF-8 ≤8,192 bytes이면서 활성 provider tokenizer 기준 ≤2,048 tokens다. 스키마는 요청된 테이블만, 행은 샘플 ≤5다. worst-case fixture는 50개×80자이며 양 provider 측정값 중 큰 값을 쓴다.
4. **provenance** — 승인된 변경 묶음 1개 = History entry 1개 (`origin:"ai"|"agent"`) + 세션 provenance entry 1개 (ops 수 · 승인 여부 · historyId). `⌘Z` 1회로 전체가 돌아온다. durable audit가 필요하면 별도 저장 계약을 추가한다.
5. **secret** — `get/list` · 동적 주입 · `explain_request_failure`가 공유 순수 함수 `redactEndpointSecrets`를 provider 호출 전에 통과한다. 민감 header/cookie/query auth 값과 기존 평문을 placeholder로 바꾸며, 모델 payload의 원문 secret은 0건이다.
6. **양쪽 provider 동등** — Ollama 경로에서 스키마 밖 op 가 적용기에 도달하지 않는다 (zod 가 Anthropic strict 와 같은 스키마로 거른다).

**Soft Constraints**:

- Anthropic strict 는 재귀 · `minimum/maximum` · 깊은 `oneOf` 를 제한한다 — `DataOp` union 은 평면 tagged union 으로 유지하고 제약은 description 으로.
- ADR-202 는 Proposed 미착수 — 그 IR 위에 쌓으면 일정 종속. 본 ADR 은 202 없이 완결되고, 202 가 나중에 감싼다.
- AI 패널 live 는 Ollama 로 가능하고 Anthropic wire 는 키 게이트 (`AnthropicProvider.live.test.ts`) — 메모리 `reference-ai-panel-agent-runner-memo-needs-reload-after-profile-config`.
- 시안 "AgentReview" 아트보드 (스키마 diff 승인) 가 승인 UI 정본.

## Alternatives Considered

### 대안 A: op 단위 쓰기 tool 다수 + 즉시 적용 (현 `bind_collection` 방식 확장)

- 설명: `create_collection` · `add_field` · `insert_rows` · `define_endpoint` … 를 각각 tool 로 두고, 호출 즉시 store 에 적용한다 (현재 `bind_collection` 이 이렇게 동작).
- 근거: Webflow MCP 는 op 단위 21 tool 이다.
- 위험:
  - 기술: L
  - 성능: L
  - 유지보수: **H** — tool N 개 × 스키마 N 개 · 모델이 op 를 잘게 나눠 호출해 부분 적용 상태가 생김 (테이블은 만들었는데 필드는 실패) · 승인 없음은 외부 대조 8/8 (I1) 위반이라 나중에 승인을 얹으면 tool 마다 다시 손댄다
  - 마이그레이션: M — 즉시 적용된 변경은 History 밖이라 되돌릴 수 없음 (152 전)

### 대안 B: 읽기 tool 4 (fine-grained) + 쓰기 tool 1 `propose_data_change` → 승인 diff → 152 적용기 + `bind_collection` 정정 + "왜 실패했지?" + agent 명령 4

- 설명: 읽기는 `list_collections` · `get_collection` · `list_api_endpoints` · `get_api_endpoint` (공유 redactor, `format: concise|detailed`) + `get_editor_state` 요약 + 예산 제한 주입이다. 모델 대면 쓰기는 `propose_data_change` 하나이고, `bind_collection` compatibility alias도 `bind_element` proposal로 정규화해 같은 diff 승인 경로를 지난다. 승인 뒤 executor가 origin을 stamp하고 원자적 적용기에서 History 1 + 세션 provenance 1을 만든다. `explain_request_failure`는 redacted context로 원인과 patch 제안을 만들며 적용은 같은 승인 경로다.
- 근거: Propose → Review → Apply 8/8 (I1) · 삭제 차단 (I2, Bubble · Base44 append-only · Cloud read_only) · Anthropic tool 가이드 (few high-impact workflow tools · `strict` · `response_format`) · MCP spec (`outputSchema` · human-in-the-loop SHOULD) · Airtable Omni (Undo + checklist) · Retool/Cloud/Postman "Debug?" (I5) — 리서치 §3-4 I1 ~ I7, §3-5 X1 ~ X5 · X7.
- 위험:
  - 기술: M — 두 provider 의 구조화 출력 동등화 (Anthropic strict ↔ Ollama zod) · strict 제약과 union 스키마의 마찰
  - 성능: L — tool 은 편집 이벤트 단위, 프롬프트 예산은 HC 3 으로 상한
  - 유지보수: L — 스키마 1 소스 · 쓰기 진입점 1 · 승인 UI 1
  - 마이그레이션: L — `bind_collection` legacy 입력 read 호환, 새 tool 은 additive

### 대안 C: ADR-202 typed IR 안의 `data` statement 로 편입 — 202 먼저

- 설명: `BuilderCommandProgram` 에 data statement kind 를 추가하고 AI 패널 · agent · MCP 가 같은 IR 로 데이터를 다룬다. 본 ADR 은 202 Implemented 뒤에 착수.
- 근거: 202 의 "closed typed IR — 모든 mutation 은 tagged union" 원칙과 정합.
- 위험:
  - 기술: **H** — 202 는 Proposed 미착수 (2026-09-02). 미검증 IR 위에 데이터 계약을 쌓으면 202 의 설계 변경마다 본 ADR 이 흔들리고, 202 의 착수 시점이 본 ADR 의 시점이 된다
  - 성능: L
  - 유지보수: M — IR 하나로 수렴하는 이득은 있으나 202 완료 전엔 얻을 수 없다
  - 마이그레이션: M — 202 가 IR 버전을 올리면 데이터 statement 도 재직렬화

### 대안 D: MCP 서버로 외부 노출을 먼저 — AI 패널은 그 클라이언트

- 설명: 빌더가 MCP 서버를 열고 데이터 tool 을 노출, AI 패널 · Claude Code · 외부 에이전트가 같은 서버를 쓴다.
- 근거: Webflow · Notion · Airtable · Cloud · Figma 가 MCP 로 데이터를 연다.
- 위험:
  - 기술: M — 브라우저 앱이 MCP 서버가 되려면 transport (WebSocket/SSE) 계층이 필요
  - 성능: L
  - 유지보수: **H** — 표면 둘 (AI 패널 내부 tool + MCP) 을 같은 계약으로 유지 · annotations 는 클라이언트가 신뢰하지 않으므로 서버 승인 게이트를 따로 — 첫 출시 대상 (AI-3 · 읽기) 에는 필요 없는 층
  - 마이그레이션: M

### Risk Threshold Check

| 대안 | 기술  | 성능 | 유지보수 | 마이그레이션 | HIGH+ 개수 |
| ---- | :---: | :--: | :------: | :----------: | :--------: |
| A    |   L   |  L   |  **H**   |      M       |     1      |
| B    |   M   |  L   |    L     |      L       |     0      |
| C    | **H** |  L   |    M     |      M       |     1      |
| D    |   M   |  L   |  **H**   |      M       |     1      |

루프 판정: B 가 HIGH 0 — 추가 대안 불필요. D 는 후순위 원칙으로만 기록 (breakdown §6).

## Decision

**대안 B: 읽기 tool 4 + `propose_data_change` 승인 경로 + `bind_collection` 정정 + "왜 실패했지?" + agent 명령 4**를 선택한다.

선택 근거:

1. provider 동등화는 한 파생 스키마로 고정한다. HIGH R7은 모든 alias를 승인 dispatcher에 모으는 G2·G4, HIGH R8은 provider 직전 공유 redactor를 검증하는 G1·G3을 통과하기 전 해당 Phase를 열지 않는 방식으로 수용한다.
2. 모델 대면 쓰기와 compatibility alias가 같은 dispatcher를 지나므로 승인 · History · 세션 provenance가 한 곳에 붙는다. 사람이 부르는 AI 3종과 agent tool도 같은 경로를 쓴다.
3. 첫 출시 (Phase 1 읽기 · Phase 3 "왜 실패했지?") 는 승인 UI 없이 가능하고 152 와 독립이라 (Phase 1) 즉시 가치를 낸다.
4. ADR-202 와 직교 — 202 가 착수하면 어댑터 1개로 편입되고, 그 전에도 완결된다.

기각 사유:

- **대안 A 기각**: 승인 없음 (I1 위반) · 부분 적용 상태 · tool N 개 유지 — 유지보수 HIGH. 나중에 승인을 얹으면 tool 마다 재작업.
- **대안 C 기각**: 202 미착수에 일정 종속 — 기술 HIGH. 편입은 어댑터로 나중에 같은 결과를 얻는다.
- **대안 D 기각**: 첫 출시에 필요 없는 transport · 이중 표면 — 유지보수 HIGH. 원칙만 기록 (AX-6).

> 구현 상세: [213-data-tool-contract-propose-review-apply-breakdown.md](../design/213-data-tool-contract-propose-review-apply-breakdown.md)

## Risks

| ID  | 위험                                                                                                         | 심각도 | 대응                                                                                                                                |
| --- | ------------------------------------------------------------------------------------------------------------ | :----: | ----------------------------------------------------------------------------------------------------------------------------------- |
| R1  | Anthropic strict 가 `DataOp` union 의 일부 (재귀 `DataField.children` · `minimum`) 를 거부해 tool 등록이 400 |  MED   | Phase 0 에서 제약 대조 → 위반 항목은 description 으로 이전, `children` 은 깊이 1 로 평면화. strict 스냅샷 test                      |
| R2  | Ollama 경로에 zod 가 빠지면 스키마 밖 op (예: `remove_field`) 가 적용기에 도달                               |  MED   | `OpenAICompatibleProvider` tool 인자 지점에 같은 스키마의 zod 삽입 + 부정 케이스 test (delete op → invalid)                         |
| R3  | diff 뷰가 큰 `insert_rows` (수백 행) 를 전부 렌더해 승인 다이얼로그가 느리다                                 |  LOW   | 요약 (행 수 · 필드) + 샘플 3행 + "전체 보기" 접힘                                                                                   |
| R4  | `update_field` type 변경은 delete 가 아니어도 파괴적 (값 손실) — tool 이 승인 한 번으로 통과                 |  MED   | diff 뷰가 사용처 N + 변환 미리보기 (212 UX-5 와 같은 계산) 를 보여 주고, 손실 행 > 0 이면 별도 체크 필요                            |
| R5  | 프롬프트 주입이 테이블 수와 이름 길이에 비례해 커진다                                                        |  LOW   | 50개×80자 worst-case, UTF-8 8,192 bytes와 활성 tokenizer 2,048 tokens 이중 상한, 초과 시 "더 있음"                                  |
| R6  | ADR-202 착수 시 `DataChange` 와 `BuilderCommandProgram` 이 이중 IR                                           |  MED   | 202 가 `data` statement 1종으로 `DataChange` 를 감싼다 (어댑터, 본 ADR 은 무변경). 결정 지점 2 — 202 착수 시 사용자 confirm 1회     |
| R7  | `bindCollection.ts` · dev/test entry가 승인 dispatcher를 우회해 데이터 쓰기를 직접 적용한다                  |  HIGH  | 모든 AI/agent 쓰기를 동일 dispatcher로 통합, `origin` 적용 호출 1곳 grep, 데이터 명령에는 confirm `skip` 금지, G2·G4 거부/undo 검증 |
| R8  | 실패 설명 context의 request headers/cookies/query auth 또는 기존 endpoint 평문이 provider로 전송된다         |  HIGH  | 공유 `redactEndpointSecrets`를 context 조립 경계에 강제하고 canary secret으로 get/list/injection/explain payload 원문 0 검증        |

R7은 `services/ai/tools/bindCollection.ts`, `services/agent/executeAgentCommand.ts`, `services/agent/devAgentEntry.ts`를 동적 seed로 삼고 G2·G4에 매핑한다. R8은 G1·G3에 매핑한다.

## Gates

| Gate | 시점         | 통과 조건                                                                                                                                                     | 실패 시 대안                          |
| ---- | ------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------- |
| G0   | Phase 0 완료 | 현재 consumer/우회 호출 전수, strict/Ollama 검증 지점, 승인 props, 50×80 prompt before arm, cross-store preflight/commit/inverse seam을 freeze                | 격차가 남으면 해당 Phase 착수 금지    |
| G1   | Phase 1 완료 | 50×80 fixture가 UTF-8 ≤8,192 bytes·양 provider 중 최대 ≤2,048 tokens. get/list/injection payload canary secret 0, 샘플 ≤5, Ollama 읽기 live                   | 절단·redactor·예산 조정               |
| G2   | Phase 4 완료 | tool schema에 origin/delete 0, executor가 origin stamp. diff 승인→cross-store commit/History 1→undo 원상, 거부·각 op failure injection은 전 store/문서 무변경 | dispatcher·coordinator·inverse 수정   |
| G3   | Phase 3 완료 | 401 실패의 headers/cookies/query/body canary를 redactor 뒤 provider payload에서 원문 0으로 확인하고 원인+`define_endpoint` 제안→승인→200                      | redactor·context 조립 보강            |
| G4   | Phase 2 완료 | `bind_collection` 정상/legacy 입력 모두 diff 승인 표시, 거부 시 무변경, 승인 시 Skia·DOM 행 표시, History 1 및 `⌘Z` 원상                                      | alias 정규화·dispatcher·consumer 수정 |
| G5   | Phase 6 완료 | "블로그 글 테이블 만들어 …" → 미리보기 (필드 5 · 샘플 5행 · enum 정합) → 적용 → 바인딩 가능 · 스키마에 없는 컬럼 0 (I3)                                       | 생성기-검증기 보강                    |

### Live Exercise

전부 Chrome MCP (실제 builder · 프로젝트 "ADR-213 live" / "DDF") · provider Ollama qwen3:14b (Anthropic 키 없음 — Anthropic wire 는 `AnthropicProvider.live.test.ts` 키 게이트 미실행) · 2026-09-11 ~ 09-12. 상세 · 발견 · 수리는 evidence [213-p0-inventory.md](../evidence/213-p0-inventory.md) 의 Phase 절.

| Gate | 시나리오 (실제로 한 것)                                                                                                                                                                                                                                                                       | 결과                                                                               | 일자  |
| ---- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------- | ----- |
| G1   | 50×80 fixture 8,192 B · 2,048 token 이중 상한 (단위) · AI 패널 "list_collections 로 …" → 주입 절 → `list_collections` → `get_collection` → 답변 (Ollama 6 호출 · canary 0)                                                                                                                    | PASS                                                                               | 09-11 |
| G4   | `bind_collection` 정상 입력 · legacy `source:"static"` 입력 → 승인 diff → Skia · DOM 행 표시 → History 1 → ⌘Z 원상 · 거부 무변경                                                                                                                                                              | PASS                                                                               | 09-11 |
| G3   | `bearerCheck` 401 (canary 3종: header · cookie · query) → "왜 실패했어?" → `explain_request_failure` → 원인 + `define_endpoint` 제안 · provider payload 4건 canary 원문 0 · (승인 → 200 은 Phase 4 에서)                                                                                      | PASS                                                                               | 09-11 |
| G2   | 401 제안 → `propose_data_change` → diff 다이얼로그 (define_endpoint · 헤더 키) → Run → IndexedDB 갱신 (**secret 원문 보존 — live 발견 후 `preserveSecrets` 수리**) → Test 200 → ⌘Z 원상 · canary 0. 거부 · failure injection 은 단위 (dispatcher · cross-store rollback)                      | PASS                                                                               | 09-11 |
| AX-4 | `window.__compositionAgent.run("data.*")` — openTable (precondition-failed / ok) · openEndpoint (Headers 탭) · runEndpoint (GET, 401 스냅샷) · importPaste (탭 표 → diff → Run → 테이블 → undo · Reject → declined) · 호출 7 = 기록 7                                                         | PASS                                                                               | 09-11 |
| G5   | "블로그 글 테이블 만들어 — 제목 · 본문 · 작성자 · 게시일 · 상태" → `create_table_from_description` (필드 5 · enum 정합 · 한글 라벨) → diff (스키마 표 + 샘플 행) → BlogPosts (컬럼 = 스키마 키, I3) · AI-4 "이 테이블에 tags 추가" → add_field · AI-2 쉼표 표 → Members · 10 payload canary 0 | PASS (환경: `ollama serve` 기본 num_ctx 4096 이면 프롬프트 절단 — 32768 로 재기동) | 09-11 |

정적 게이트 (매 커밋): `dataProposalDispatcher.static.test.ts` (origin 적용 호출 = dispatcher 1곳) · `proposeDataChange.test.ts` (tool parameters = `modelFacingDataChangeJsonSchema()` toEqual) · `dataCommandMeta.static.test.ts` · redactor canary 단위. 사용자 confirm 으로 대체한 항목 없음.

## Consequences

### Positive

- 모델이 어떤 테이블이 있는지 알고 (읽기 4 + 요약), 있는 테이블에 요소를 잇는다 (`bind_collection` 정정).
- AI · agent 의 데이터 변경이 전부 승인 diff 를 지나고 `⌘Z` 1회로 돌아온다 — 사람 편집과 같은 적용기 · History.
- "왜 실패했지?" 가 API 편집기의 첫 AI 기능 — 비용 최저, 승인 UI 불요.
- 스키마 1 소스 — tool · 검증 · export 가 같은 정의. ADR-202 편입은 어댑터 1개.
- Playwright · Chrome MCP · MCP 클라이언트가 `data.*` agent 명령으로 같은 경로를 조작.

### Negative

- 승인 diff 뷰 (스키마 · 행 · 바인딩 · 사용처) 를 유지해야 한다 — 152 op 종류가 늘면 diff 렌더러도 늘어난다.
- provider 둘의 구조화 출력 동등화 test 를 스키마 변경마다 재실행.
- 삭제는 AI 로 못 한다 (의도된 제약) — 사용자가 UI 로 해야 한다.
- 202 편입 전까지 데이터 IR 과 명령 IR 이 별개 — 202 착수 시 어댑터 작업 1회.
