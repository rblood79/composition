# ADR-213 Design Breakdown: 데이터 tool 계약 — 읽기 tool · `propose_data_change` · `bind_collection` 정정 · "왜 실패했지?"

> 본문: [213-data-tool-contract-propose-review-apply.md](../213-data-tool-contract-propose-review-apply.md) · 리서치 정본: [DATA_PANEL_REDESIGN_RESEARCH_2026-09](../../explanation/research/DATA_PANEL_REDESIGN_RESEARCH_2026-09.md) §1-6 · §3-4 · §3-5 · §4-3 · §4-4 · 시안: artifact `f7d8327e` "AgentReview" 아트보드 (스키마 diff 승인)

## 1. 전제 lock-in (fork 4 질문 — 사용자 confirm 2026-09-11, 리서치 §5 판정 ③)

1. **base / 응용**: ADR-152 (`DataChange` 스키마 + 적용기) = base, 본 ADR = **응용** (AI 패널 tool · agent 명령 · 사람이 부르는 AI 기능 3종). ADR-212 (편집기 UI) 와는 같은 base 위의 **형제** — 표면이 겹치는 곳은 ② "왜 실패했지?" 버튼 자리 (212 Phase 4 응답 패널) 와 ③ 승인 diff 뷰 (독립 overlay) 뿐.
2. **schema 직교**: 본 ADR 은 스키마를 신설하지 않는다 — tool `input_schema` · zod 검증 · `outputSchema` 는 전부 152 §2-3 `packages/shared/src/schemas/dataChange.ts` 에서 파생 (JSON Schema 생성기 1개). 신설은 tool 정의 · 승인 UI 상태 · 감사 로그 entry 형상뿐.
3. **의존 방향 — ADR-202 (compiler-first typed IR, Proposed)**: 본 ADR 은 202 에 **의존하지 않는다**. `DataOp` 는 202 `BuilderCommandProgram` 의 statement 가 아니라 152 소유 스키마이며, 202 가 착수하면 `data` statement kind 하나로 **`DataChange` 를 감싸는 어댑터** (R6) 로 편입한다 — 반대 방향 (213 이 202 IR 위에 쌓임) 은 202 미착수 상태에서 일정 종속이라 채택하지 않는다. **결정 지점 2 후보로 기록 — 202 착수 시 사용자 confirm 1회** (본 ADR 실행 중에는 재질문 없음).
4. codex 1차 진입 전 본 lock-in 완료.

## 2. 현행 인벤토리 (2026-09-11 실측 — Phase 0 에서 freeze)

| 표면                      | 파일                                                                                                                                       | 현재                                                                                                             |
| ------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------- |
| AI 패널 tool 정의         | `services/ai/tools/definitions.ts` — 9 + `run_command` (lazy)                                                                              | 데이터 tool 은 `bind_collection` 하나. 생성 · 필드 · 행 · 엔드포인트 tool 0                                      |
| `bind_collection`         | `services/ai/tools/bindCollection.ts:24` `SUPPORTED_SOURCES = ["static","api","supabase"]` + config 인라인                                 | 사람 UI 기록 형상 `{ source:"dataTable", name }` (ADR-159 P4b) 과 다르다 — DataTable 에 잇는 경로 없음           |
| `get_editor_state`        | `services/ai/tools/getEditorState.ts` · `canonicalToolReadModel.ts`                                                                        | pages · elements · selection 만 — collections / apiEndpoints 없음                                                |
| 시스템 프롬프트 동적 주입 | `services/ai/catalog/dynamicInjection.ts`                                                                                                  | "컬렉션" = 팔레트 카테고리 매핑만                                                                                |
| 구조화 출력               | `services/ai/providers/AnthropicProvider.ts:241` `output_config` (effort + format) · `OpenAICompatibleProvider.ts` (Ollama)                | Anthropic 만 strict 구조화 (ADR-134 후속, `project-prompt-audit-2026-09-applied`) — Ollama 는 zod 로 동등화 필요 |
| agent 명령 allowlist      | `services/agent/agentCommands.ts` `AGENT_COMMANDS` 40 (ADR-196)                                                                            | 캔버스 · 패널 · 뷰포트만. 데이터 0                                                                               |
| 승인 게이트               | `services/agent/agentCommandConfirmation.ts` · `executeAgentCommand.ts` (allowlist → precondition → confirm) · `AgentCommandConfirmDialog` | 명령 id · 되돌림 가능 여부 표시 — 스키마 diff 없음                                                               |
| 감사 로그                 | `agentCommandLog` (`executeAgentCommand.ts`)                                                                                               | 명령 단위. 데이터 변경 묶음 없음                                                                                 |
| 문서 envelope             | ADR-209 export/import — `collections` · `apiEndpoints`                                                                                     | 에이전트가 문서 단위로 읽는 유일 채널                                                                            |
| 적용기 (선행)             | ADR-152 Phase 1c `applyDataChange` · `dataChange.ts` 스키마                                                                                | **미구현 — 본 ADR Phase 2 이후 착수 조건**                                                                       |

## 3. Tool 표면 (Phase 1 · 4 산출물)

| tool                      | 종류            | 입력                                                                         | 출력                                                                    |        승인         |
| ------------------------- | --------------- | ---------------------------------------------------------------------------- | ----------------------------------------------------------------------- | :-----------------: |
| `list_collections`        | 읽기            | `{ format?: "concise" \| "detailed" }`                                       | `[{ id, name, fieldCount, rowCount, source, usedBy }]`                  |          —          |
| `get_collection`          | 읽기            | `{ collectionId \| name, sampleRows?: ≤5, format? }`                         | `{ schema: DataField[], sample: row[], source }`                        |          —          |
| `list_api_endpoints`      | 읽기            | `{ format? }`                                                                | `[{ id, name, method, url, targetCollectionId, lastRun }]`              |          —          |
| `get_api_endpoint`        | 읽기            | `{ endpointId }`                                                             | 정의 (Auth 값은 `{{secret.NAME}}` 마스킹)                               |          —          |
| `propose_data_change`     | **쓰기 (유일)** | `DataChange` (152 §2-3, `remove_field` · `remove_rows` 제외)                 | `{ status: "applied" \| "rejected" \| "invalid", historyId?, errors? }` |        필수         |
| `bind_collection` (정정)  | 쓰기            | `{ elementRef, collectionId, fieldMap? }` (legacy `source/config` read 호환) | 기존 결과 형상                                                          |        기존         |
| `explain_request_failure` | 읽기 (AI-3)     | `{ endpointId, runId }` → 컨텍스트 조립은 코드가                             | `{ cause, suggestion: DataOp[] (define_endpoint patch) }`               | 제안 → propose 경로 |

`get_editor_state` 에는 `collections: [{ id, name, fieldCount, rowCount }]` 요약만 추가 (X3). 행 전량 노출 tool 은 없다 (I7).

## 4. Phase 계획

### Phase 0 — Inventory freeze (게이트 G0)

- [ ] tool 정의 · executor 등록 경로 · `ToolExecutionResult` 형상 표 (definitions.ts ↔ index.ts)
- [ ] Anthropic strict 제약 목록 (재귀 · `minimum/maximum` · `oneOf` 깊이) 을 `DataOp` union 에 대조 — 위반 항목은 description 으로 이전 (R1)
- [ ] Ollama (`OpenAICompatibleProvider`) tool 호출 인자 검증 지점 실측 — zod 삽입 위치 (R2)
- [ ] `AgentCommandConfirmDialog` props · `agentCommandLog` entry 형상 · `EditingSemanticsImpactDialog` 재사용 가능 여부
- [ ] `dynamicInjection` 토큰 예산 실측 (현재 주입량 · 캐시 prefix 경계 — Anthropic 경로)
- [ ] **착수 조건**: Phase 2 이후는 ADR-152 Phase 1c Implemented (G5 PASS)

### Phase 1 — 읽기 tool 4 + `get_editor_state` 요약 + 프롬프트 주입 (152 독립, 게이트 G1)

- [ ] `list_collections` · `get_collection` · `list_api_endpoints` · `get_api_endpoint` — `useDataStore` read 만, `format: concise|detailed` (X3), `sampleRows ≤ 5` (I7 · AI-6)
- [ ] `get_editor_state.collections` 요약
- [ ] `dynamicInjection` 에 테이블 목록 (이름 · 필드 수 · 행 수) 만 — 스키마는 요청된 테이블만 (AI-6), Anthropic 경로는 캐시 prefix 안
- [ ] secret 마스킹 test (`get_api_endpoint` 출력에 Auth 값 0)
- [ ] G1 live: AI 패널 "어떤 테이블이 있어?" → `list_collections` 호출 → 이름 · 행 수 답변 (Ollama 경로, 메모리 `reference-ai-panel-agent-runner-memo-needs-reload-after-profile-config`)

### Phase 2 — `bind_collection` 정정 (AX-3, 게이트 G4)

- [ ] 입력 `{ elementRef, collectionId, fieldMap? }` → 152 `bind_element` op 를 적용기로 (History entry 동반). legacy `{ source: static|api|supabase, config }` 는 read 호환 (ADR-159 P4c residual 과 같은 처리 — 신규 오소링 미노출)
- [ ] `bindCollectionRender.test.tsx` 갱신 + legacy 입력 회귀 test
- [ ] G4 live: "이 ListBox 를 Users 에 연결해" → 캔버스 Skia 행 + preview DOM 행 (152 대칭 위에서)

### Phase 3 — "왜 실패했지?" (AI-3, 게이트 G3)

- [ ] `explain_request_failure` — 코드가 컨텍스트 조립 (요청 정의 · 응답 status/headers · 본문 앞 2KB · 테이블 스키마) → 모델은 `{ cause, suggestion: DataOp[] }` 구조화 출력 (define_endpoint patch: headers · path · dataPath)
- [ ] 표면: ADR-212 Phase 4 응답 패널 오류 옆 버튼 — 212 전에는 AI 패널 프롬프트 ("마지막 실행 왜 실패했어?") 로 같은 tool 호출
- [ ] suggestion 적용은 Phase 4 승인 경로 (그 전엔 제안 텍스트만)
- [ ] G3 live: Bearer 없는 엔드포인트 401 → 원인 "Authorization 헤더 없음" + `define_endpoint` patch 제안 → (Phase 4 후) 적용 → 재실행 200

### Phase 4 — `propose_data_change` + 승인 diff 뷰 + provenance (AX-2 · X4 · X5 · AX-7, 게이트 G2)

- [ ] tool `input_schema` = `dataChange.ts` 에서 생성한 JSON Schema (delete 계열 제외 — I2), Anthropic strict + Ollama zod 같은 소스 (R1 · R2)
- [ ] 승인 UI: `AgentCommandConfirmDialog` 를 **스키마 diff 뷰** 로 확장 (AgentReview 아트보드) — 테이블별 필드 추가/변경 · 행 삽입 수 + 샘플 3행 · 바인딩 변경 · "사용처 N" (152 역참조) · 되돌림 가능 표시. 큰 `insert_rows` 는 요약 + 샘플 (R3)
- [ ] 승인 → `applyDataChange({ origin: "ai" | "agent" })` → History entry 1 + 단계 목록 (provenance) → 결과 `outputSchema` 검증 (`applied | rejected | invalid`)
- [ ] `agentCommandLog` 에 데이터 변경 묶음 entry (origin · ops 수 · 승인 여부 · historyId) (AX-7)
- [ ] `update_field` type 변경은 사람 경로와 같은 "사용처 N" 확인을 diff 뷰 안에서 (R4)
- [ ] G2 live: "Users 에 status 필드 추가하고 샘플 3행 넣어" → diff 뷰 (필드 1 · 행 3) → 승인 → 격자에 반영 → `⌘Z` 1회로 묶음 원상

### Phase 5 — agent 명령 allowlist 확장 (AX-4)

- [ ] `AGENT_COMMANDS` 에 `data.openTable` · `data.openEndpoint` · `data.runEndpoint` · `data.importPaste` — ADR-196 방식 (handler 가 부르는 같은 심볼, executor 게이트 밖 호출 불가)
- [ ] precondition: 프로젝트 로드 · 대상 id 존재 · `importPaste` 는 confirm 게이트 (쓰기)
- [ ] Playwright · Chrome MCP 가 같은 경로로 조작 가능 — `fix-live.mjs` 패턴으로 1회

### Phase 6 — 사람이 부르는 AI 3종 (AI-1 · AI-2 · AI-4, 게이트 G5)

- [ ] AI-1 "설명으로 테이블 만들기": 모델은 **스키마 + 샘플 행 생성 규칙** 만 (구조화 출력) → 샘플 행은 코드가 생성 (`presets/dataTablePresets.ts` 생성기를 검증기로 승격 — I3, FK/enum 정합) → 미리보기 (스키마 표 + 5행) → 수정 → `propose_data_change` 경로. 객관식 clarifying 1~2 문항은 조건부 (I8)
- [ ] AI-2 붙여넣기 이해: cURL · JSON 샘플 · 표 텍스트 한 입력창 — 규칙 파서 먼저 (212 Phase 4 cURL · Track 0 `resolveResponseData`), 실패 시 모델 → 항상 212 UX-2/UX-3 미리보기로
- [ ] AI-4 반복 편집: 열린 테이블/엔드포인트 자동 첨부 → 제안 diff → 승인 (Phase 4 경로). 삭제 · 타입 변경은 제안에 포함되되 사용처 N 확인
- [ ] 진입: 212 생성 패널 "AI 로" · AI 패널 프롬프트 둘 다 같은 tool
- [ ] G5 live: "블로그 글 테이블 만들어 — 제목 · 본문 · 작성자 · 게시일 · 상태" → 미리보기 (필드 5 · 샘플 5행, 상태 enum 정합) → 적용 → 목록에 테이블 + 캔버스 바인딩 가능

### Phase 7 — closure

- [ ] AX-6 MCP 노출 원칙 (`readOnlyHint` · `destructiveHint` · 사람이 읽는 이름 · pagination) 을 본 breakdown §6 에 문서만 — 노출 자체는 후순위
- [ ] ADR-202 편입 어댑터 자리 문서화 (R6)
- [ ] CHANGELOG (Features — AI) · ADR README · `### Live Exercise`

## 5. 파일 변경표 (추정 — Phase 0 에서 freeze)

| 파일                                                                                                                         | Phase | 변경                                   |
| ---------------------------------------------------------------------------------------------------------------------------- | :---: | -------------------------------------- |
| `services/ai/tools/{listCollections,getCollection,listApiEndpoints,getApiEndpoint}.ts` (신규)                                |   1   | 읽기 tool 4                            |
| `services/ai/tools/definitions.ts` · `index.ts` · `getEditorState.ts`                                                        |  1·4  | 등록 · collections 요약                |
| `services/ai/catalog/dynamicInjection.ts`                                                                                    |   1   | 테이블 목록 주입 (예산)                |
| `services/ai/tools/bindCollection.ts`                                                                                        |   2   | `collectionId` 형상 + legacy read 호환 |
| `services/ai/tools/explainRequestFailure.ts` (신규)                                                                          |   3   | 컨텍스트 조립 + 구조화 출력            |
| `services/ai/tools/proposeDataChange.ts` (신규) · `packages/shared/src/schemas/dataChange.ts` → JSON Schema 생성             |   4   | 쓰기 tool 1 + 스키마 파생              |
| `services/agent/agentCommandConfirmation.ts` · `AgentCommandConfirmDialog` (+ `DataChangeDiffView.tsx` 신규)                 |   4   | 스키마 diff 뷰                         |
| `services/agent/executeAgentCommand.ts` (`agentCommandLog`)                                                                  |   4   | 데이터 묶음 entry                      |
| `services/ai/providers/OpenAICompatibleProvider.ts`                                                                          |   4   | zod 인자 검증 (Ollama 동등화)          |
| `services/agent/agentCommands.ts`                                                                                            |   5   | `data.*` 4 명령                        |
| `services/ai/tools/{createTableFromDescription,understandPaste}.ts` (신규) · `presets/dataTablePresets.ts` (생성기 → 검증기) |   6   | AI-1 · AI-2 · AI-4                     |

## 6. MCP 노출 원칙 (후순위 — 문서만, AX-6)

- annotations `readOnlyHint` (읽기 4 + explain) · `destructiveHint: false` (propose — delete 없음) · `idempotentHint: false`; 클라이언트가 힌트를 신뢰하지 않는다는 전제로 서버 측 승인 게이트는 그대로.
- 이름은 사람이 읽는 것 우선 (`name`), UUID 는 `detailed` 에만. 목록은 pagination 기본. 오류에는 다음 행동 안내 (`"Run the endpoint first"`).
- ADR-202 recipe 체계에 "data recipe" 로 편입되면 AI 패널 · agent · MCP 가 같은 `DataChange` 를 쓴다 — 어댑터 1개 (R6).

## 7. 검증 전략

- 정적: JSON Schema ↔ zod 동일 소스 test (스냅샷) · strict 제약 위반 0 test · `outputSchema` 검증 test · delete 계열 tool 미노출 grep · 승인 없이 `applyDataChange({origin:"ai"|"agent"})` 호출 0 grep 가드
- live (Ollama 경로 기본, Anthropic 은 키 있을 때 `AnthropicProvider.live.test.ts` 게이트): G1 읽기 · G4 bind · G3 실패 설명 · G2 propose 승인 + undo · G5 설명으로 테이블
- 판독 루프: `.claude/rules/review-loop-closure.md`
