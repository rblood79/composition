# ADR-196: command registry 의 agent 호출 표면 — metadata 분리 · allowlist · 승인 · 기록

## Status

Accepted — 2026-08-28 (리뷰 round 1 승인 — MED 3 / LOW 3 fixed, pending 0; 사용자 승격 지시 2026-08-28. Proposed 2026-08-28)

> 출처: 2026-08-27 paperthin·polysona 분석 (Codex P4 — "ADR-195 runtime registry 를 agent 가 직접 호출하게 만드는 것은 아직 이르다 … 별도 architecture decision 이 필요한 범위") → 병합 순서 보류 항목 → 2026-08-28 사용자 `/new-adr` 지시. 완전 신규 주제 — 별도 ADR 로 두는 결정은 사용자 confirm (2026-08-28, [breakdown §1](design/196-agent-command-surface-breakdown.md)). **ADR-195 (Implemented) 가 base**, ADR-134 (Proposed) 는 consumer.

## 진행 로그

| Phase | 상태                | 근거                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                       |
| ----- | ------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 0     | Implemented (08-28) | G0 통과 — 재grep 6/6 일치 (정규식 1건 정정, baseline 정정 2건: `useSectionCollapse` 전역 store · 패널 토글 `dispatchPanelWorkspaceActivation` 선행) · 71 id 분류 확정 allowlist **40** (상한 40) · handler→심볼+부가 동작 표 · **액션별 history entry 실측 전부 1** (canonical 경로 재현 jsdom — paste 는 global ⌘V 가 N entry 라 adapter 는 batch 옵션; `detachInstance` 는 `irreversible`→`history` 정정) · AI 도구 승인 0·기록 0. breakdown §2·§3-3·§4·§5 갱신                                          |
| 1     | Implemented (08-28) | G1 통과 — `COMMAND_META` 71 (누락 type error) · 정적 게이트 5조항 + 민감도 4건 RED · `AGENT_COMMANDS` 40 adapter (값 export 1개) · 정적 심볼 대조 20 import + 금지 7 · jsdom spy 40 · HC1 diff 0 · type-check 0. `usePanelLayout.togglePanelWorkspace` 순수 함수 export (hook 은 1줄 위임) · undo/redo 되돌림 종류 `inverse` 추가 (entry 0, 조항 2 예외). 195 키보드 oracle live 재실행은 Phase 3                                                                                                          |
| 2     | Implemented (08-28) | G2 통과 — executor (`executeAgentCommand` / 배치 `executeAgentCommands` / descriptor `listAgentCommands` / `buildAgentReadModel`) · jsdom 14: denied 3종 · precondition-failed · declined (adapter 0, 승인 전 store 변경 0) · ok (undoable + historyIndex) · error · 배치 원소별 승인 + 첫 non-ok 중단 · 기록 1:1 5 status · history 계약 12: `undo: history` 명령 전부 entry 1 (canonical 경로 재현, executor 경유), undo/redo 0 + 복원 · type-check 0. `agentCommandLog` 는 독립 store (root 편입 안 함) |

## Context

**SSOT 3-domain 위치**: 빌더 시스템 UI (builder-system layer) — ADR-163/192/195 와 같은 위상. D1/D2/D3 어느 domain 에도 속하지 않는다 (catalog/spec/Generator 확장 0, 캔버스 컴포넌트 시각·DOM·props 무관). Generator 지원 여부 선언 대상 아님. `capabilityRegistry` (ADR-158, preview 인터랙션의 컴포넌트 런타임 capability) 는 이름만 비슷한 다른 축이다.

### 문제 — agent 는 빌더 명령을 이름으로 부를 수 없고, 부를 수 있게 만들면 지금 구조로는 안전하지 않다

2026-08-28 실측 (breakdown §2):

- ADR-195 로 실행 축 SSOT `commandRegistry` 가 생겼지만 entry 는 `(id → handler)` 뿐이다 (`stores/commandRegistry.ts` `CommandEntry`). handler 는 등록 hook `useKeyboardShortcutsRegistry.ts:317-382` (effect 안 `handleKeyEvent` 클로저 + `registerCommand` `:368`) 의 **마운트된 React 클로저** — StylesPanel 의 `collapsedSections`, BuilderCanvas 의 `frameAreas`, PropertiesPanel 의 속성 클립보드 같은 로컬 state 를 잡고 있고, 컴포넌트가 언마운트되면 등록도 사라지며 (`StylesPanel` 은 선택이 없으면 `EmptyState`), `escape` 류는 DOM 포커스를 읽는다. **headless 호출 API 가 아니다** — precondition · mutation 범위 · undo 가능 여부 · 승인 필요 여부를 표현할 자리가 없다.
- 그런데 agent 는 이미 빌더를 바꾼다. AI 패널의 Groq 도구 7종 (`services/ai/tools/` — `create/update/delete_element`, `batch_design`, 읽기 3) 은 canonical 연산만 노출한다: **승인 게이트 0** (`deleteElement.ts` 는 body 보호뿐), **실행 기록 0** (대화 로그만), undo 는 개별 store 호출이 남기는 history 에 의존. 정렬·분배·그룹·복제·z-order·undo·줌·패널 토글은 **도달 불가** — "버튼 3개 왼쪽 정렬" 을 agent 가 하려면 geometry 를 스스로 계산해 `update_element` 를 N 회 부른다 (사람 경로 `canvasActions.alignSelection` 과 의미가 갈린다 — 팔레트가 71 을 나열하고 12 만 실행하던 195 이전 형태의 재발).
- 외부 agent (Chrome MCP 로 빌더를 조작하는 Claude/Codex — CLAUDE.md §완료 기준의 live exercise 경로) 도 같다: 키보드·클릭을 흉내낼 뿐 명령을 부를 수 없고, 무엇을 실행했는지 앱 안에 남지 않는다.
- ADR-134 D11 은 "MCP 호환 도구 표면" 을 Phase 9 (Electron 시점) 로 두었다. 그때 노출할 **명령 집합·안전 규칙·기록 형식** 이 없으면 Phase 9 는 도구 7종을 그대로 옮기는 것 이상이 될 수 없다.

필요한 것은 registry 를 agent 에게 여는 것이 아니라 (Codex P4: 아직 이르다), **명령의 정적 사실 (agent 호출 가능 여부 · 변경 범위 · 되돌림 · 승인) 을 UI handler 에서 분리**하고, agent 가 부를 수 있는 것은 **store-level 액션으로 별도 adapter** 를 두는 것이다. 액션 층 (`canvasActions.ts` 9 async 함수 `:143-398` · `historyManager` · `activatePanelWorkspacePanelV3` + `setPanelWorkspaceLayout` (`usePanelLayout.ts:59-63`) · `moveElementToSiblingEdge` (`useGlobalKeyboardShortcuts.ts:335-342`) · `zoomViewportAtContainerCenter` (`:89-95`)) 은 이미 공유돼 있어 재구현이 아니라 **바인딩** 만 추가한다 — 195 와 같은 형태다.

**Hard Constraints**:

1. **195 HC1 승계 — 키보드·팔레트 경로 무변경**. `useKeyboardShortcutsRegistry.ts` · `commandRegistry.ts` · `CommandPalette.tsx` · `keyboardShortcuts.ts` diff 0. 회귀 oracle = 195 키보드 26/26 · 입력창 7 · 팔레트 G3 23건 재실행 동일 + 정적 게이트 기존 조항 PASS.
2. **기본 거부** — `COMMAND_META[id].agentCallable` 기본 `false`, allowlist 만 `true`. 71 정의 전부 metadata 명시 (누락 = type error). allowlist 상한 **40** (breakdown §3-3 초안 ≈ 35, Phase 0 이 확정). `mutation: "external"` (DB/publish/navigation) 은 본 ADR 에서 노출 금지 고정.
3. **승인 없는 파괴 0** — `confirm: true` 명령 (`delete`·`deleteAlt`·`cut`·`detachInstance` + 되돌릴 수 없는 document/project 변경 전부 — 정적 게이트가 강제) 은 사용자 승인 Promise 가 resolve 되기 전 store 를 만지지 않는다. 배치는 원소별 승인 — 배치 1회 승인으로 파괴를 묶지 못한다.
4. **호출 1건 = 기록 1건** — 거부·precondition 실패·거절·성공·오류 전부 `agentCommandLog` 에 남고 AIPanel 에 보인다. 기록 없는 실행 0.
5. **되돌림 단위** — `undo: "history"` 명령은 agent 호출 1건이 history **1 entry** (사용자 ⌘Z 1회로 복원). 1 entry 는 **액션 자체가 보장**해야 한다 — `historyManager.runInTransaction` (`history.ts:495-506`) 은 **동기 창 전용** (콜백이 Promise 를 반환하면 경고, `:453-459` 근거) 인데 `canvasActions` 9 함수는 전부 `async` (`:143-398`) 라 transaction 으로 묶을 수 없다. Phase 0 이 액션별 entry 수를 실측하고, N entry 인 명령은 `irreversible` 로 표기 + `confirm` 필수 (또는 노출 금지).
6. **비용** — per-keydown 경로 코드 추가 0 · 신규 모듈 번들 Δ ≤ +3KB gz · 외부 의존 0 · `window.__compositionAgent` 는 DEV 빌드 한정.

**Soft Constraints**:

- ADR-134 는 Proposed·미착수이고 Groq 제거가 예정돼 있다. 본 ADR 의 consumer 는 Groq tool 1개 (`run_command`) 로 최소 노출하되, descriptor 는 `COMMAND_META` 에서 생성해 134 D11 이 MCP tool 로 옮길 때 재정의가 없게 한다.
- 승인 흐름은 `detachInstance` 의 `requestEditingSemanticsDetachConfirmation` (`utils/editingSemanticsImpactConfirmation.ts:69-71`, 이미 `Promise<boolean>`) 을 재사용한다 — agent 가 결과를 기다리는 형태가 이미 있다. jsdom 선례 `EditingSemanticsImpactDialog.test.tsx`.
- **adapter 는 handler 가 부르는 심볼을 그대로 부른다** (다른 store 의 같은 이름 함수 금지 — `canvasStore.setZoom` `:41` 은 viewport 경로가 아니다, 소비자 12곳 별도 store = split-brain 위험). Phase 0 이 allowlist 각 id 의 "handler → 호출 심볼" 표를 만들고 adapter 는 그 표를 따른다.
- 패널 로컬 state 에 묶인 명령 (`toggleSections` · 속성/스타일 클립보드) 은 195 대안 C 를 기각한 같은 이유로 store 승격하지 않는다 → 노출 금지.

## Alternatives Considered

### 대안 A: metadata 분리 + agent adapter 층 — `COMMAND_META` (정적 사실) + `AGENT_COMMANDS` (store-level 바인딩) + executor (allowlist → precondition → 승인 → history 1 entry → 기록) (권장)

- 설명: 정의 옆에 `COMMAND_META[id] = { agentCallable, mutation, undo, confirm, precondition?, args? }` 표를 두고, allowlist 명령마다 `canvasActions.*` / `historyManager` / `activatePanelWorkspacePanelV3`+`setPanelWorkspaceLayout` / `moveElementToSiblingEdge` / `zoomViewportAtContainerCenter` — **handler 가 부르는 심볼 그대로** — 를 부르는 adapter 를 둔다. `executeAgentCommand(id, args, ctx)` 하나가 모든 호스트 (AI 패널 tool · Chrome MCP · 향후 MCP) 의 진입점. UI handler 와 registry 는 무변경. breakdown §3.
- 근거: VS Code 는 `commands.registerCommand` 와 별도로 `package.json` `commands[].enablement` (정적 when 절) 를 두고 extension 이 `executeCommand` 로 부르되 UI 전용 명령은 명시적으로 제외한다; JetBrains `AnAction` 은 headless 호출에 `DataContext` 가 필요해 `actionPerformed` 를 직접 부르지 않고 `ActionUtil.invokeAction` + 명시 컨텍스트로 부른다 — "UI handler ≠ 자동화 API" 가 업계 패턴. Claude Code 의 tool permission (allow/ask/deny + 기본 ask) 과 Figma Plugin API 의 `figma.commitUndo()` (plugin 변경을 undo 1 단위로 묶음) 가 HC3/HC5 의 선례. 프로젝트 안 선례 = 195 (액션 층 공유 + 바인딩만 추가) · ADR-158 `capabilityRegistry` (정적 표 + 런타임 분리) · Codex P4 명세 그대로.
- 위험:
  - 기술: **M** — adapter 와 UI handler 의 의미 drift (정렬·분배·그룹은 같은 `canvasActions` 라 0, z-order/zoom/패널은 handler 가 부르는 store 심볼 실측 — `moveElementToSiblingEdge` · `zoomViewportAtContainerCenter` · `activatePanelWorkspacePanelV3`) · 액션별 history entry 수 (async 라 transaction 불가). 심볼 대조는 정적 표, 결과 동일성은 G3 handler 경로 live 로 잠긴다.
  - 성능: L — keydown 경로 무변경, 표는 정적.
  - 유지보수: M — 명령당 표 1행 + adapter 1개가 늘고, 정적 게이트 5조항이 누락을 잡는다. 새 정의는 `COMMAND_META` 누락이 type error 라 잊을 수 없다.
  - 마이그레이션: L — 전부 additive. Phase 1 만 들어간 상태는 표·adapter·테스트뿐이라 되돌리기 1 commit.

### 대안 B: registry handler 직접 호출 — agent 가 `resolveCommand(id).handler()` 를 부른다

- 설명: 195 entry 를 그대로 agent 에게 연다. executor 는 allowlist 와 기록만 얹는다.
- 근거: 코드 최소 (adapter 0). Chrome DevTools Protocol 의 `Input.dispatchKeyEvent` 처럼 "사람 경로를 그대로 재생" 하는 자동화.
- 위험:
  - 기술: **H** — handler 는 마운트 클로저다: StylesPanel 언마운트 시 미등록 (실패가 "지금은 없음" 으로만 보임), `escape`·포커스 의존 handler 는 agent 컨텍스트에서 다른 일을 하고, `detachInstance` 처럼 확인 다이얼로그를 띄우는 handler 는 agent 가 결과를 기다릴 수 없다. Codex P4 가 실측으로 기각한 형태.
  - 성능: L.
  - 유지보수: M — handler 가 바뀌면 agent 동작이 조용히 바뀐다 (계약 없음).
  - 마이그레이션: L.

### 대안 C: AI 도구 개별 확장 — 명령마다 Groq tool 을 추가 (`align_elements` · `group_elements` · …)

- 설명: 134 의 현행 방식 그대로 도구 7 → 40. 각 도구가 canonical 연산을 스스로 조립.
- 근거: 134 Phase 3 (도구 canonical 정합) 의 연장선. 도구 스키마가 LLM 에게 가장 서술적.
- 위험:
  - 기술: M — geometry·그룹 의미를 도구 안에서 재구현 → `canvasActions` 와 drift (팔레트 12/71 사례의 재발 형태).
  - 성능: L.
  - 유지보수: **H** — 명령 40 × 도구 정의·검증·프롬프트 중복. 정의가 늘 때 도구가 안 따라오는 195 이전 구조.
  - 마이그레이션: M — 134 Groq 제거 시 40 도구를 다시 옮긴다.

### 대안 D: 명령 전부를 headless 명령 모듈로 승격 — UI handler 폐지, 키보드·팔레트·agent 가 같은 함수 (195 대안 C 재등장)

- 설명: 로컬 state 의존 handler 를 store 로 올려 71 명령을 순수 함수로 만든다.
- 근거: 가장 순수한 SSOT.
- 위험:
  - 기술: **H** — 195 가 기각한 이유 그대로 (로컬 state 4종 store 승격 = 각각 별도 결정, selection fan-out 증가).
  - 성능: M.
  - 유지보수: M.
  - 마이그레이션: **H** — 등록 7곳 전면 개편, HC1 위반.

### Risk Threshold Check

| 대안 | 기술 | 성능 | 유지보수 | 마이그레이션 | HIGH+ 개수 |
| ---- | ---- | ---- | -------- | ------------ | :--------: |
| A    | M    | L    | M        | L            |     0      |
| B    | H    | L    | M        | L            |     1      |
| C    | M    | L    | H        | M            |     1      |
| D    | H    | M    | M        | H            |     2      |

루프 판정: HIGH 0 인 대안(A) 이 있으므로 추가 대안 불요. CRITICAL 없음.

## Decision

**대안 A: metadata 분리 + agent adapter 층** 을 선택한다.

선택 근거:

1. **Codex P4 명세와 1:1** — 공통 metadata (id · precondition · mutation scope · undo) / UI adapter (현행 handler) / agent adapter (store action) / 기본 `agentCallable: false` / allowlist / destructive·DB·publish 승인 / 기록. 분석 문서가 요구한 분리를 그대로 구현하고, 그 이상 (MCP 노출·dispatcher 단일화) 은 하지 않는다.
2. **195 와 같은 형태** — 액션 층은 이미 공유돼 있으므로 재구현이 아니라 바인딩만 늘린다. 정렬·분배·그룹·복제·삭제·클립보드 (allowlist 의 절반) 는 단축키·컨텍스트 메뉴와 **같은 함수** 를 부른다 → 의미 drift 가 구조적으로 0.
3. **안전 규칙이 정적 게이트로 잠긴다** — "노출됐는데 adapter 없음" · "되돌릴 수 없는데 승인 없음" · "external 인데 노출" · "연속키인데 노출" · "승인 우회 경로" 5조항이 테스트라, 새 명령이 늘어도 사람이 기억할 필요가 없다 (HC2·HC3).
4. **호스트 불문** — executor 하나를 AI 패널 tool · Chrome MCP (DEV window) · 134 D11 MCP 가 같이 쓴다. 134 착수 여부와 무관하게 지금 검증 가능하고, 134 는 descriptor 를 옮기기만 한다.
5. **잔존 위험이 정적 대조 + jsdom + live 15건으로 닫힌다** — "adapter 호출 심볼 = handler 호출 심볼" 은 Phase 0 표 + 정적 게이트, executor 분기 (denied/precondition/declined/ok/배치) 와 기록 1:1 은 jsdom, **결과 동일성 (parity) 의 oracle 은 handler 경로** — Chrome MCP 가 같은 문서에서 키보드 경로와 agent 경로를 각각 실행해 store 상태를 대조한다 (§G3). adapter 가 부르는 함수를 직접 불러 비교하는 자기 확인 테스트는 oracle 로 쓰지 않는다 (measurement-validity §2 #3/#4).

기각 사유:

- **대안 B 기각**: handler 는 마운트 클로저라 headless 계약이 없다 — 언마운트 시 조용히 없어지고, 포커스·다이얼로그 의존 handler 는 agent 가 기다릴 수 없다. allowlist 를 얹어도 "실행됐는데 다른 일을 했다" 를 막지 못한다.
- **대안 C 기각**: 명령 의미를 도구 안에서 재구현하는 것이 곧 drift 다 (195 이전의 팔레트 switch 와 같은 구조). 134 의 Groq 제거 때 전부 다시 옮긴다.
- **대안 D 기각**: 195 가 같은 이유로 기각한 전면 개편이며 HC1 위반. agent 표면 문제의 크기를 넘는다.

> 구현 상세: [196-agent-command-surface-breakdown.md](design/196-agent-command-surface-breakdown.md)

## Risks

| ID  | 위험                                                                                                                                                                                                                                                           | 심각도 | 대응                                                                                                                                                                                                                                                                                                            |
| --- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | :----: | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| R1  | adapter 가 UI handler 와 다른 일을 한다 — handler 는 호출 심볼 앞뒤에 부가 동작 (선택 재계산 · 포커스 · 스크롤, 예: `handleMoveToSiblingEdge` 가 `selectedElementIds` 를 읽어 targetId 를 정하는 `:335-342`) 을 두므로 심볼만 같아도 결과가 다를 수 있다       |  MED   | Phase 0 "handler → 호출 심볼 + 부가 동작" 표. 결과 parity 의 oracle 은 **handler 경로** (G3 live 대조) — adapter 의 callee 를 직접 불러 비교하는 자기 확인은 oracle 아님. 부가 동작을 재현 못 하는 명령은 노출 금지 (allowlist 상한 40 안)                                                                      |
| R2  | 승인 우회 — 배치 1회 승인으로 destructive 를 묶거나, adapter 가 executor 밖에서 export 돼 직접 호출된다                                                                                                                                                        |  MED   | 배치는 원소별 승인 (HC3). adapter 모듈은 executor 만 import (정적 게이트 5조항 — export 표면 grep). 기록에 host 가 남아 우회가 보인다                                                                                                                                                                           |
| R3  | history 단위 — transaction 표면은 있지만 동기 창 전용 (`history.ts:453-459`, `runInTransaction` `:495-506` 은 Promise 반환 시 경고) 이고 `canvasActions` 9 함수는 전부 async (`:143-398`) 라 묶을 수 없다. 정렬 N 요소가 entry N 개면 사용자 undo 가 부분 복원 |  MED   | Phase 0 이 allowlist 액션별 entry 수를 실측 (`historyManager.getCurrentPageEntries` 전후 diff). 1 entry 가 액션 자체로 보장되는 것 (group/ungroup 은 entry type 존재 `:126-128`) 만 `undo: "history"`, N entry 는 `irreversible` + `confirm` 또는 노출 금지. 비동기 액션용 병합 표면 추가는 별도 결정 (ADR-180) |
| R4  | precondition 이 판정 후 실행 전에 stale (선택이 바뀜)                                                                                                                                                                                                          |  LOW   | executor 가 실행 직전 재판정 — 판정과 실행 사이 await 는 승인 Promise 뿐                                                                                                                                                                                                                                        |
| R5  | 기록이 세션 메모리라 재현·감사 불가                                                                                                                                                                                                                            |  LOW   | AIPanel 가시 + DEV `window.__compositionAgent.log()` 를 Chrome MCP 가 읽어 dev ledger 에 옮긴다. 영속화는 §7 후속                                                                                                                                                                                               |
| R6  | 134 와 descriptor 이중화 — 134 가 다른 스키마로 MCP tool 을 만들면 표 2벌                                                                                                                                                                                      |  LOW   | `COMMAND_META` 에서 descriptor 생성 (JSON Schema 호환). Phase 4 에서 134 D11 에 "본 ADR descriptor 소비" 1줄 정합                                                                                                                                                                                               |
| R7  | 신규 public 표면 (Groq tool `run_command`) 이 사용자-가시 — AI 패널이 새 동작을 한다                                                                                                                                                                           |  LOW   | CHANGELOG 필수 (신규 public API 트리거). 기본 거부라 allowlist 밖 동작 변화 0                                                                                                                                                                                                                                   |

잔존 HIGH 위험 없음.

## Gates

| Gate | 시점    | 통과 조건                                                                                                                                                                                                                                                                                                                                                                                                                                                     | 실패 시 대안                                                                                               |
| ---- | ------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------- |
| G0   | Phase 0 | breakdown §2 재grep 일치 · 71 id 분류표 확정 (allowlist ≤ 40, external 전부 금지, 연속키·tree·패널 로컬 금지) · allowlist 각 id 의 "handler → 호출 심볼 + 부가 동작" 표 (z-order `moveElementToSiblingEdge` · zoom `zoomViewportAtContainerCenter` · 패널 `activatePanelWorkspacePanelV3` 기점) · **액션별 history entry 수 실측** (async 라 transaction 불가 — 1 entry 아닌 명령은 `irreversible`+confirm 또는 금지) · AI 도구 7종 승인 0·기록 0 재확인      | 표 갱신 commit 으로 흡수 (fork 아님). N entry 명령은 HC5 `irreversible` 분기 적용                          |
| G1   | Phase 1 | `COMMAND_META` 71 전부 (누락 type error) · 정적 게이트 5조항 PASS + 민감도 (allowlist id 의 adapter 제거 → RED · external id `agentCallable: true` → RED · irreversible document 명령 `confirm: false` → RED) · 정적 대조: allowlist 각 adapter 의 호출 심볼 = Phase 0 표의 handler 호출 심볼 (import grep) · jsdom: adapter 가 그 심볼을 정확히 1회 부른다 (spy) · 195 키보드 oracle 26/26 · 입력창 7 · 정적 게이트 기존 조항 PASS · type-check · HC1 diff 0 | 실패 조항만 수정. 심볼 불일치 명령은 노출 금지로 내린다 (allowlist 축소는 scope 변경 아님)                 |
| G2   | Phase 2 | jsdom: denied (allowlist 밖) · precondition-failed · declined (승인 거부 시 store 무변경) · ok · 배치 원소별 승인 · 기록 1:1 (5 status 전부) · `undo: "history"` 명령은 entry 수 = 1 (Phase 0 실측 표와 일치) · 승인 전 store 변경 0                                                                                                                                                                                                                          | 실패 분기만 수정. 승인 Promise 가 기존 다이얼로그와 결합 불가면 agent 전용 confirm 컴포넌트 (최소) 로 대체 |
| G3   | Phase 3 | live (Chrome MCP · 사용자 confirm 구분 기재): agent 호출 ≥ 15 (정렬 6 · 분배 2 · 그룹/해제 · 복제 · z-order 2 · undo/redo · 줌 · 패널 토글 2) 전부 **같은 문서에서 키보드 경로를 먼저 실행해 얻은 store 상태와 대조** (parity oracle = handler 경로) · `delete` 승인 다이얼로그 실측 (거부 → 무변경, 승인 → 삭제 + 기록) · undo 1회 복원 1건 · 팔레트 G3 23건 재실행 동일 · 번들 Δ ≤ +3KB gz · `pnpm agent:work -- verify` 통과                               | 다른 결과가 나온 명령은 R1 — 부가 동작 재현 또는 노출 금지. 3건 이상이면 Phase 1 분류표 재검토             |
| G4   | Phase 3 | AI 패널 경유 `run_command` 1회 실측 (Groq) — allowlist enum 이 도구 정의에 반영, allowlist 밖 id 요청은 denied 로 기록                                                                                                                                                                                                                                                                                                                                        | Groq 경로 실패는 134 선행 문제가 아니라 descriptor 생성 결함 — descriptor 테스트 추가                      |

### Live Exercise

(Implemented 승격 시 기재 — G3/G4 의 시나리오 · 결과 · 날짜 · Chrome MCP / 사용자 confirm 구분. 미기재 시 Stop hook 이 승격을 block.)

## Consequences

### Positive

- agent 가 빌더 명령을 **이름으로** 부른다 — 정렬·분배·그룹·복제·z-order·undo·줌·패널 (≈35) 이 사람 경로와 같은 함수로 실행되고, geometry 재계산 같은 우회가 사라진다.
- 명령의 정적 사실 (변경 범위 · 되돌림 · 승인) 이 코드에 표로 존재한다 — 71 전부 명시라 "이 명령을 agent 에게 열어도 되나" 가 추측이 아니라 표 조회가 된다. 134 D11 은 이 표에서 descriptor 를 생성한다.
- 파괴 명령은 승인 없이 돌지 않고 (AI 도구 7종에는 지금 없는 게이트), 모든 호출이 AIPanel 에 보인다.
- 키보드·팔레트·registry 무변경 — 195 회귀 oracle 이 그대로 검증한다.

### Negative

- 명령당 metadata 1행 + allowlist 명령당 adapter 1개가 새로 생긴다 — 같은 동작의 바인딩이 UI 와 agent 두 벌 (정적 게이트가 누락은 잡지만 의미 drift 는 parity 테스트 범위 안에서만 잡는다, R1).
- `agentCommandLog` 슬라이스와 AIPanel 로그 UI 가 늘어난다. 세션 메모리라 감사 용도는 아니다 (R5).
- external 명령 (DB/publish/navigation) 과 패널 로컬 state 명령은 agent 에게 닫힌 채 남는다 — 요구가 생기면 별도 결정 (breakdown §7).
- Groq tool `run_command` 는 134 의 Groq 제거 때 MCP tool 로 옮겨야 한다 (descriptor 재사용이라 정의는 유지되지만 배선은 1회 이동).
