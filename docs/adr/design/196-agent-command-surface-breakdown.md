# ADR-196 Breakdown: command registry 의 agent 호출 표면 — metadata 분리 · allowlist · 승인 · 기록

> ADR 본문: [196-agent-command-surface.md](../196-agent-command-surface.md). 구현 상세는 이 파일에만 둔다.

## 1. 전제 lock-in (완전 신규 주제 — 사용자 confirm 2026-08-28)

- **fork 아님**: `rg -il "agent.*(command|명령)|agentCallable|headless" docs/adr` — agent 의 빌더 명령 호출을 다룬 결정 0건. ADR-195 는 팔레트(사람) 를 두 번째 consumer 로 만들었고 agent 는 언급하지 않는다 (195 §7 후속 목록에도 없음). 출처는 2026-08-27 paperthin·polysona 분석 Codex P4 — "ADR-195 runtime registry 를 agent 가 직접 호출하게 만드는 것은 아직 이르다 … 별도 architecture decision 이 필요한 범위".
- **4 질문** (adr-writing.md §Fork 게이트 형식을 신규 주제에도 적용):
  1. base/응용 — **ADR-195 `commandRegistry` = base** (Implemented 08-27), 본 ADR = 응용 (entry 에 metadata 와 agent adapter 를 덧붙인다). ADR-134 (AI Assistant, Proposed) 는 본 ADR 의 **consumer** — D11 "MCP 호환 도구 표면" 이 본 ADR 의 descriptor 를 tool 1개로 노출한다.
  2. schema 직교 — 134 의 도구는 canonical document 연산 (`create/update/delete_element`, `batch_design`), 본 ADR 의 명령은 71 `ShortcutId` (UI 컨텍스트에 결합된 사용자 동작). 한쪽이 다른 쪽의 specialization 이 아니다.
  3. 선행 전제 reverse — 195 HC1 (키보드 경로 무변경) 은 consumer 가 하나 늘어도 유지된다 (adapter 는 handler 를 부르지 않는다, §3-2). 134 Phase 0~2 (provider 추상화·Groq 제거) 는 본 ADR 의 선행이 아니다 — 본 ADR 은 호스트 불문 (AI 패널 tool · Chrome MCP 로 조작하는 Claude/Codex · 향후 MCP/ACP).
  4. 사용자 confirm — 2026-08-28 AskUserQuestion "별도 ADR-196" 선택 (134 흡수 / 지금 작성 안 함 기각). 이 기록이 confirm 의 지속 형태다 — codex 1차 리뷰는 이 뒤에 진입.
- **SSOT 경계**: 빌더 시스템 UI (builder-system layer) — ADR-163/192/195 와 같은 위상. D1/D2/D3 무관, catalog/spec/Generator 확장 0. `packages/shared/src/interactions/capabilityRegistry.ts` (ADR-158, 컴포넌트 런타임 capability — preview 인터랙션 층) 는 이름만 비슷한 **다른 축** 이라 본 ADR 이 건드리지 않는다.

## 2. Current Baseline (2026-08-28 실측 — HEAD `37a035db2` / Phase 0 freeze 재확인 HEAD `52b268a42`)

| 항목                  | 실측                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 |
| --------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| registry              | `apps/builder/src/builder/stores/commandRegistry.ts` — `CommandEntry {id, handler: () => void, scope, priority, allowInInput, disabled, seq}`. `registerCommand` / `resolveCommand` (priority ↓ → seq ↓) / `getCommandRegistrySnapshot` / `subscribeCommandRegistry`. **metadata 없음** — precondition·mutation·undo 를 표현할 자리가 없다. vitest 5 케이스                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          |
| handler 의 정체       | 등록 hook `hooks/useKeyboardShortcutsRegistry.ts:317-382` 의 effect 클로저 (`registerCommand` `:368`). 7 등록 지점 (195 breakdown §2): global 42 · CanvasSelectionShortcuts 16 · BuilderCanvas 1 (`frameAreas`) · StylesPanel 2 (`collapsedSections` 로컬 state) · PropertiesPanel 2 (속성 클립보드 로컬) · CommandPalette 1 · BuilderHeader 1. **언마운트 = 미등록** (StylesPanel 은 선택 없으면 `EmptyState`). `escape` 류는 DOM 포커스를 읽는다. → headless 호출 부적합 (Codex P4 판정과 일치)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    |
| 정의                  | `config/keyboardShortcuts.ts` `SHORTCUT_DEFINITIONS` 71 (`ShortcutId = keyof typeof`). 필드: key/code/modifier/category/scope/priority/allowInInput/capture/description/`palette?: false` (195). agent 관련 필드 0                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                   |
| 액션 층 (store-level) | `workspace/canvas/actions/canvasActions.ts` — `copySelection · cutSelection · paste · duplicateSelection · deleteSelection · groupSelection · ungroupSelection · alignSelection · distributeSelection` (전부 `async`, `:143-398`; + `buildCanvasActionElementsMap · selectableWithoutBody`). 컨텍스트 메뉴(182)·단축키·액션 바(192) 가 공유 → **agent adapter 1순위 후보**. undo/redo = `useStore.getState().undo/redo` (`useGlobalKeyboardShortcuts.ts:73-80`). 패널 토글 = `activatePanelWorkspacePanelV3` + `setPanelWorkspaceLayout` (`hooks/usePanelLayout.ts:59-63` — `togglePanel` 은 hook 이라 adapter 는 안쪽 순수 함수+setter). z-order = root store `moveElementToSiblingEdge` (`useGlobalKeyboardShortcuts.ts:335-342`, `handleMoveToSiblingEdge` 가 `selectedElementIds` 로 targetId 결정). 줌 = `zoomViewportAtContainerCenter` (`:89-95`, `useViewportSyncStore` 기준) — **`canvasStore.setZoom` (`stores/canvasStore.ts:41`, 소비자 12곳) 은 다른 store 라 사용 금지 (split-brain)** |
| 현재 agent 표면       | `services/ai/tools/` 7종 — `create_element · update_element · delete_element · batch_design · get_editor_state · get_selection · search_elements` (Groq tool calling). **승인 게이트 0** (`deleteElement.ts` 는 body 보호만), **실행 기록 0** (AIPanel 대화만), undo 는 개별 store 호출이 남기는 history 에 의존. 정렬/분배/그룹/복제/z-order/undo/줌/패널은 **도달 불가** — agent 가 정렬을 하려면 geometry 를 직접 계산해 `update_element` 를 N 회                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 |
| 외부 agent 표면       | Chrome MCP (Claude/Codex 가 빌더를 실제 조작 — CLAUDE.md §완료 기준 live exercise 경로). 지금은 키보드/팔레트/클릭을 흉내낼 뿐 명령을 이름으로 부를 수 없다. ADR-134 D11 (MCP 호환 도구 표면) 은 Proposed — 134 착수 전까지 본 ADR 의 노출 경로는 Groq tool 1개 (`run_command`) 와 window 진입점 (Phase 3 live 용)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                   |
| 승인 다이얼로그 선례  | `requestEditingSemanticsDetachConfirmation` (`utils/editingSemanticsImpactConfirmation.ts:69-71`) — 이미 `Promise<boolean>`. jsdom 선례 `components/overlay/EditingSemanticsImpactDialog.test.tsx`. agent 경로는 같은 흐름을 그대로 await                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            |
| history 단위          | `historyManager.beginTransaction/commitTransaction/runInTransaction` (`stores/history.ts:461-526`) — **동기 창 전용** (`:453-459` — 창 안 `await` 는 무관한 mutation 을 같은 되돌리기 단위로 빨아들임; `runInTransaction` 은 Promise 반환 시 경고 `:506`). `canvasActions` 9 함수는 전부 `async` (`:143-398`) → transaction 으로 못 묶는다. entry type 에 `group`/`ungroup`/`batch` 존재 (`:126-128`). 호출자 1곳 (`ButtonChildSection.tsx`). **Phase 0 = 액션별 entry 수 실측**                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                     |
| dev-process ledger    | `scripts/agent/run-ledger.sh` (`.agent/runs/*/evidence.jsonl`, local-only) — 개발 작업 근거. **in-app agent 호출 기록과는 별개** — 본 ADR 의 기록은 앱 안 (AIPanel 가시) 이 1차, ledger bridge 는 Phase 3 live 검증 도구로만 (§3-5)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  |

### Phase 0 재grep (착수 직전 필수)

```bash
cd apps/builder
# 정의 수 / 등록 지점 / registry 필드 — 195 §2 와 대조
grep -cE '^  [a-zA-Z0-9_]+: \{' src/builder/config/keyboardShortcuts.ts     # 71 (숫자 id zoom100/zoom200 포함 — [a-zA-Z]+ 는 69)
grep -rln 'bindHandlersToDefinitions' src --include='*.ts' --include='*.tsx' | grep -v test | grep -vc useKeyboardShortcutsRegistry  # 9 (7 등록 + config + hooks/index)
grep -n 'export interface CommandEntry' -A 8 src/builder/stores/commandRegistry.ts
# canvasActions 표면 / history group 표면 / AI 도구 승인·기록
grep -oE '^export (async )?function [a-zA-Z]+' src/builder/workspace/canvas/actions/canvasActions.ts | wc -l   # 11
grep -nE 'group|batch|begin|end|transaction' src/builder/stores/history.ts | head
grep -rn -iE 'confirm|approv' src/services/ai --include='*.ts' | grep -v test | wc -l     # 0
```

### Phase 0 실측 결과 (2026-08-28 — HEAD `52b268a42`)

**재grep** (§2 대조):

| 항목                                                 | 기대 | 실측                                                                                                                  |
| ---------------------------------------------------- | :--: | --------------------------------------------------------------------------------------------------------------------- |
| 정의 수                                              |  71  | **71** — 재grep 정규식 `[a-zA-Z]+` 는 `zoom100`/`zoom200` 을 놓쳐 69 로 센다 → `[a-zA-Z0-9_]+` 로 정정 (위 블록 반영) |
| `bindHandlersToDefinitions` 파일                     |  9   | **9** (7 등록 + config + hooks/index)                                                                                 |
| `CommandEntry` 필드                                  |  7   | **7** (id/handler/scope/priority/allowInInput/disabled/seq) — metadata 자리 없음                                      |
| `canvasActions` export                               |  11  | **11**                                                                                                                |
| history entry type group/ungroup/batch · transaction | 존재 | **존재** (`history.ts:126-128` · 동기 창 `:441-563`)                                                                  |
| AI 도구 confirm/approv                               |  0   | **0** · 실행 기록 심볼 (`agentCommandLog`/`toolLog`/`auditLog`/`executionLog`) **0**                                  |

baseline 정정 2건: (1) StylesPanel 의 `toggleFocusMode`/`toggleSections` 는 로컬 state 가 아니라 **전역 zustand store** `useSectionCollapse` (persist, `panels/styles/hooks/useSectionCollapse.ts:29`) — StylesPanel 마운트 없이도 store 로 호출 가능 → `toggleFocusMode` allowlist 유지, `toggleSections` 는 패널 UI 전용 판정 유지. (2) 패널 토글은 `dispatchPanelWorkspaceActivation(panelId)` 가 먼저 (true 면 단락) → `activatePanelWorkspacePanelV3` → `setPanelWorkspaceLayout` (`hooks/usePanelLayout.ts:59-70`) — helper 3개 (`registryEntries`/`currentWorkspaceLayout`/`fallbackSurfaceRect`, `:15-31`) 는 모듈 private 이라 Phase 1 이 `togglePanelWorkspace(panelId)` 순수 함수를 같은 파일에서 export 한다 (hook 본문 무변경, §5 표 +1).

**71 id 분류 확정** — allowlist **40 / 71** (상한 40 충족), 노출 금지 31:

| 판정                       | id                                                                                                                                                                                                                                                                                                                                                                                                                                                                      |
| -------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| allow 40                   | undo redo · zoomIn zoomOut zoomToFit zoom100 zoom200 · toggleNodes toggleComponents toggleDatatable toggleTheme toggleProperties toggleStyles toggleEvents toggleHistory toggleRulers openSettings · copy paste cut · bringToFront bringForward sendBackward sendToBack · duplicate toggleComponentOrigin detachInstance selectAll delete group ungroup · alignLeft alignHCenter alignRight alignTop alignVCenter alignBottom distributeH distributeV · toggleFocusMode |
| 금지 — alias 2             | zoomInNumpad (= zoomIn) · deleteAlt (= delete) — 같은 handler, 이름 하나만 노출                                                                                                                                                                                                                                                                                                                                                                                         |
| 금지 — UI 컨텍스트 결합 3  | zoomToSelection (`BuilderCanvas.tsx:892-906` 클로저 `frameAreas`/`pageHeight`/`interactiveElementsMapRef` — store 만으로 재현 불가) · toggleAI (agent 가 자기 host 패널을 닫는다) · toggleMonitor (개발 계측 패널)                                                                                                                                                                                                                                                      |
| 금지 — external 1          | openProject (`navigate("/dashboard")`, `BuilderHeader.tsx:97-99`)                                                                                                                                                                                                                                                                                                                                                                                                       |
| 금지 — 연속·포커스 전용 12 | commandPalette · escape · nextElement prevElement · arrowUp/Down/Left/Right · arrow\*Shift 4                                                                                                                                                                                                                                                                                                                                                                            |
| 금지 — 패널 로컬 5         | copyProperties pasteProperties (`PropertiesPanel` 로컬 클립보드) · copyStyles pasteStyles (`useCopyPaste` 훅 클립보드) · toggleSections                                                                                                                                                                                                                                                                                                                                 |
| 금지 — registry 밖 8       | treeNav 6 · treeSelect · treeSelectSpace (RAC `TreeBase` 네이티브 — 195 확정)                                                                                                                                                                                                                                                                                                                                                                                           |

**handler → 호출 심볼 + 부가 동작** (allowlist 40 — adapter 는 이 심볼을 그대로 부른다, R1):

| id                                           | handler (등록 지점)                                              | 호출 심볼                                                                                                                                        | 부가 동작 (adapter 가 재현)                                                              | mutation / undo / confirm                  |
| -------------------------------------------- | ---------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------- | ------------------------------------------ |
| undo · redo                                  | global `handleUndo/Redo` (`useGlobalKeyboardShortcuts.ts:73-83`) | `useStore.getState().undo()` / `redo()`                                                                                                          | 없음                                                                                     | document / — (index 이동, entry 0) / false |
| zoomIn · zoomOut                             | global (`:89-104`)                                               | `zoomViewportAtContainerCenter(zoom ± 0.1)` — 현재 zoom 은 `useViewportSyncStore`                                                                | 없음                                                                                     | view / none / false                        |
| zoomToFit                                    | global (`:106-112`)                                              | `computeFitViewport({canvasSize, containerSize})` → `applyViewportState`                                                                         | `containerSize` 0 이면 no-op (precondition)                                              | view / none / false                        |
| zoom100 · zoom200                            | global (`:114-115`)                                              | `zoomViewportAtContainerCenter(1 / 2)`                                                                                                           | 없음                                                                                     | view / none / false                        |
| toggleNodes … toggleHistory 8 · openSettings | global (`:121-160`)                                              | `togglePanel(id)` = `dispatchPanelWorkspaceActivation` ∥ `activatePanelWorkspacePanelV3` → `setPanelWorkspaceLayout` (`usePanelLayout.ts:59-70`) | 없음                                                                                     | view / none / false                        |
| toggleRulers                                 | global (`:163-166`)                                              | `setShowRulers(!showRulers)` (root store `canvasSettings.ts:206`)                                                                                | 없음                                                                                     | view / none / false                        |
| copy                                         | global `handleCanvasCopy` (`:181-188`)                           | `copySelection({elementsMap, writeClipboardText, requireCurrentPageForCopy: true})`                                                              | `panel:events` scope 는 placeholder — adapter 는 canvas 분기만                           | none / none / false                        |
| paste                                        | global `handleCanvasPaste` (`:203-206`)                          | `paste({elementsMap, readClipboardText})` — **adapter 는 `pasteHistory: "batch"`** (아래 실측)                                                   | 대상 부모 = `resolvePasteTargetParentId(selectedElementId)` (액션 내부)                  | document / history / false                 |
| cut                                          | global `handleCanvasCut` (`:193-200`)                            | `cutSelection(...)` (copy 성공 시에만 delete)                                                                                                    | 없음                                                                                     | document / history / **true**              |
| delete                                       | global `handleCanvasDelete` (`:211-228`)                         | `deleteSelection({elementsMap})`                                                                                                                 | **가이드 선택 중이면 `deletePageGuide`** (`getSelectedGuide()` 분기) — adapter 동일 분기 | document / history / **true**              |
| toggleComponentOrigin                        | global (`:230-237`)                                              | `toggleComponentOrigin(selectedElementId)`                                                                                                       | 단일 `selectedElementId` 필수                                                            | document / history / false                 |
| detachInstance                               | global (`:239-263`) / csel (`:116-133`)                          | `requestEditingSemanticsDetachConfirmation` → `detachInstance(id)`                                                                               | `canDetachInstance(element)` precondition · 기존 다이얼로그 = executor confirm 게이트    | document / history / **true**              |
| bringToFront · sendToBack                    | global `handleMoveToSiblingEdge` (`:335-347`)                    | `moveElementToSiblingEdge(targetId, "front" / "back")`                                                                                           | 다중 선택 no-op · targetId = `selectedElementId ?? selectedElementIds[0]`                | document / history / false                 |
| bringForward · sendBackward                  | global `handleReorderSibling` (`:286-296`)                       | `reorderElementWithinParent(targetId, ±1)`                                                                                                       | 다중 선택 no-op · 경계면 false (entry 0)                                                 | document / history / false                 |
| duplicate                                    | csel (`:83-85`)                                                  | `duplicateSelection({elementsMap})`                                                                                                              | body 제외 · 결과 선택 갱신 (액션 내부)                                                   | document / history / false                 |
| selectAll                                    | csel (`:88-108`)                                                 | `getPageElements(currentPageId)` → `setSelectedElements(ids)`                                                                                    | body 포함 (handler 와 동일)                                                              | selection / none / false                   |
| group · ungroup                              | csel (`:187-193`)                                                | `groupSelection` / `ungroupSelection`                                                                                                            | group: `multiSelectMode` ∧ body 제외 ≥ 2 · ungroup: 단일 frame/Group                     | document / history / false                 |
| align 6                                      | csel `handleAlign` (`:196-201`)                                  | `alignSelection(ctx, type)` — left/center/right/top/middle/bottom                                                                                | `multiSelectMode` ∧ ≥ 2                                                                  | document / history / false                 |
| distributeH · distributeV                    | csel `handleDistribute` (`:204-212`)                             | `distributeSelection(ctx, "horizontal" / "vertical")`                                                                                            | `multiSelectMode` ∧ ≥ 3                                                                  | document / history / false                 |
| toggleFocusMode                              | StylesPanel (`:151-152`)                                         | `useSectionCollapse.getState().toggleFocusMode()`                                                                                                | 없음 (전역 persist store)                                                                | view / none / false                        |

csel = `CanvasSelectionShortcuts.tsx`. `elementsMap` 인자: global 은 `useStore.getState().elementsMap`, csel 은 `panelNodeMapToElementMap(useCanonicalPropertyElementsMap())` — adapter 는 store `elementsMap` 을 쓰고 G3 가 결과 동일성을 handler 경로와 대조한다.

**액션별 history entry 수 실측** (jsdom — 실제 빌더 경로 재현: canonical document 등록 + `registerCanonicalMutationStoreActions` + `registerCanonicalMutationRunnerBridge`, `BuilderCore.tsx:216-231` 과 동일. canonical 없는 시드는 z-order·per-element paste 가 조용히 no-op 이라 0 으로 잘못 잰다 — 모든 행은 적용 효과를 함께 확인):

| 액션                                       |                                                      entry                                                      | 효과 확인                                                                                  |
| ------------------------------------------ | :-------------------------------------------------------------------------------------------------------------: | ------------------------------------------------------------------------------------------ |
| alignSelection(left, 3)                    |                                                      **1**                                                      | left 60/60/60                                                                              |
| distributeSelection(horizontal, 3)         |                                                      **1**                                                      | left 60/110/160                                                                            |
| duplicateSelection(3) / (1)                |                                                  **1** / **1**                                                  | 요소 4→7 / 2→3, 선택 = 새 요소                                                             |
| deleteSelection(3) / (1)                   |                                                  **1** / **1**                                                  | `removeElements` batch / `removeElement`                                                   |
| copySelection(3)                           |                                                        0                                                        | 클립보드 641B                                                                              |
| **paste per-element (global ⌘V 경로)**     |                                                   **3 (= N)**                                                   | 요소 +3 — `addElement` 마다 entry                                                          |
| paste batch (csel `handlePasteAll` 경로)   |                                                      **1**                                                      | 요소 +3 (`trackMultiPaste`)                                                                |
| cutSelection(2)                            |                                                      **1**                                                      | copy 0 + delete 1                                                                          |
| groupSelection(3) / ungroupSelection       |                                                  **1** / **1**                                                  | frame 1 + 자식 3 / 원복 a,b,c                                                              |
| moveElementToSiblingEdge front / back      |                                                  **1** / **1**                                                  | b,c,a / c,a,b — 이미 끝이면 false·0                                                        |
| reorderElementWithinParent ±1              |                                                      **1**                                                      | b,a,c — 경계면 false·0                                                                     |
| toggleComponentOrigin ×2                   |                                                  **1** / **1**                                                  | reusable true → false (`applyElementSnapshotBatch` type `batch`, `instanceActions.ts:614`) |
| detachInstance                             | **1** (코드 근거 — 같은 `applyElementSnapshotBatch` 경로 `:734-758`; jsdom 인스턴스 시드 없음 → G3 live 재확인) | —                                                                                          |
| setShowRulers · setSelectedElements · zoom |                                                        0                                                        | view / selection                                                                           |
| undo / redo                                |                                                 0 (index 이동)                                                  | left 복원 60/110/160 → 60/60/60                                                            |

**판정**:

1. `undo: "history"` 명령 전부 **1 entry 성립** — HC5 의 `irreversible` 분기 적용 대상 0. 단 `paste` 는 handler 별로 다르다: 캔버스 ⌘V (global) 는 **N entry**, properties 패널 ⌘V (csel `handlePasteAll`) 는 1 entry. adapter 는 `pasteHistory: "batch"` 로 1 entry (같은 심볼, 옵션만 다름 — 문서 결과 동일, G3 대조 대상은 요소 집합). global ⌘V 의 N entry 는 기존 비일관 — 본 ADR scope 밖 관찰.
2. `detachInstance` 는 `irreversible` 이 아니라 **`history`** (§3-3 정정) — confirm 은 유지 (기존 다이얼로그 = executor confirm 게이트).
3. `zoomToSelection` **노출 금지** 확정 (BuilderCanvas 클로저 의존).
4. 측정 스크립트는 임시 파일 (미커밋) — G2 의 "entry 수 = 1" 계약 테스트가 Phase 2 에서 같은 시드 (canonical 등록) 로 상시화한다.

## 3. 시스템 설계

### 3-1. 세 층 분리 (Codex P4)

```
SHORTCUT_DEFINITIONS (정의 — 무엇)            195: 표기 formatShortcut / 실행 commandRegistry (UI adapter = 등록 hook 의 handler)
        │
        ├─ COMMAND_META[id]  (신규 — 공통 metadata: agentCallable · mutation · precondition · undo · confirm)
        │
        └─ AGENT_COMMANDS[id] (신규 — agent adapter: store-level action. handler 를 부르지 않는다)
                  │
            executeAgentCommand(id, args, ctx)  →  allowlist → precondition → confirm 게이트 → 실행 → history 1 entry → 기록 1건
                  │
        consumer: AI 패널 tool `run_command` (Groq, 134 이전 최소) · window.__compositionAgent (Phase 3 live) · 134 D11 MCP 도구 (후속)
```

키보드·팔레트 경로는 한 줄도 바뀌지 않는다 (195 HC1 승계). `CommandEntry` 도 무변경 — metadata 는 registry 가 아니라 **정의 옆 별도 표** 에 둔다 (registry 는 마운트 상태를, 표는 정적 사실을 담는다).

### 3-2. `COMMAND_META` (신규 — `config/commandMeta.ts`)

```ts
export type MutationScope =
  "none" | "view" | "selection" | "document" | "project" | "external";
//  none: 읽기 · view: 줌/패널/포커스 (문서 무변경) · selection: 선택만 · document: 요소/스타일 변경 (history)
//  project: 페이지/프로젝트 메타 · external: DB/publish/navigation (되돌림 불가 — 본 ADR 에서 agent 노출 금지)

export interface CommandMeta {
  agentCallable: boolean; // 기본 false — allowlist 만 true
  mutation: MutationScope;
  undo: "history" | "none" | "irreversible";
  confirm: boolean; // true 면 사용자 승인 없이는 실행 0 (destructive · external 은 필수)
  precondition?: (
    s: AgentReadModel,
  ) => { ok: true } | { ok: false; reason: string };
  args?: JsonSchema; // 134 D11 호환 — 파라미터 있는 명령만 (alignSelection 의 방향 등)
}
export const COMMAND_META: Record<ShortcutId, CommandMeta>; // 71 전부 명시 — 누락 = type error
```

정적 게이트 (`commandMeta.static.test.ts`):

1. `agentCallable: true` ⇒ `AGENT_COMMANDS[id]` 존재 (adapter 없는 노출 0)
2. `mutation ∈ {document, project}` ∧ `undo !== "history"` ⇒ `confirm: true` (되돌릴 수 없는 변경은 승인 필수)
3. `mutation === "external"` ⇒ `agentCallable: false` (본 ADR 범위 밖 — DB/publish/navigation)
4. `palette: false` 인 연속·포커스 전용 정의 (escape · 방향키 8 · tree 8 · Tab 2) ⇒ `agentCallable: false`
5. `confirm: true` 인 id 의 adapter 는 executor 의 confirm 게이트를 우회하는 경로가 없다 (adapter 가 직접 store 를 부르는 것은 허용하되 executor 밖에서 export 되지 않음)

### 3-3. `AGENT_COMMANDS` (신규 — `services/agent/agentCommands.ts`)

| 군                 | id                                                                                                                                                                                                                                                                                                 | adapter 대상                                                                                                                                                                      | mutation                | undo                                     | confirm   |
| ------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------- | ---------------------------------------- | --------- |
| 선택 편집          | `alignLeft/HCenter/Right/Top/VCenter/Bottom` · `distributeH/V` · `group` · `ungroup` · `duplicate`                                                                                                                                                                                                 | `canvasActions.*` (단축키·메뉴와 동일 함수)                                                                                                                                       | document                | history                                  | false     |
| z-order            | `bringToFront · bringForward · sendBackward · sendToBack`                                                                                                                                                                                                                                          | `moveElementToSiblingEdge(targetId, edge)` / `handleReorderSibling(±1)` 의 store 심볼 (Phase 0 확정)                                                                              | document                | history                                  | false     |
| 클립보드           | `copy · paste · cut`                                                                                                                                                                                                                                                                               | `canvasActions.copySelection/paste/cutSelection` — paste 는 `pasteHistory: "batch"` (Phase 0 실측: per-element 는 N entry)                                                        | document (copy 는 none) | history                                  | cut: true |
| 삭제               | `delete` (`deleteAlt` 는 alias — 노출 금지)                                                                                                                                                                                                                                                        | `canvasActions.deleteSelection` (+ 가이드 선택 분기 `deletePageGuide`)                                                                                                            | document                | history                                  | **true**  |
| 인스턴스           | `detachInstance`                                                                                                                                                                                                                                                                                   | 기존 `requestEditingSemanticsDetachConfirmation` (이미 `Promise<boolean>`) → `detachInstance`                                                                                     | document                | history (Phase 0 실측 — `batch` entry 1) | **true**  |
| 선택               | `selectAll`                                                                                                                                                                                                                                                                                        | store selection action                                                                                                                                                            | selection               | none                                     | false     |
| history            | `undo · redo`                                                                                                                                                                                                                                                                                      | `historyManager`                                                                                                                                                                  | document                | history                                  | false     |
| 뷰                 | `zoomIn/Out/ToFit` · `zoom100/200` · `toggleRulers` · `toggleFocusMode`                                                                                                                                                                                                                            | `zoomViewportAtContainerCenter` / `computeFitViewport`+`applyViewportState` (viewportSync) · root store `setShowRulers` · `useSectionCollapse` store — `canvasStore.setZoom` 금지 | view                    | none                                     | false     |
| 패널               | `toggleNodes/Components/Datatable/Theme/Properties/Styles/Events/History` 8 · `openSettings`                                                                                                                                                                                                       | `dispatchPanelWorkspaceActivation` ∥ `activatePanelWorkspacePanelV3` → `setPanelWorkspaceLayout` (Phase 1: `togglePanelWorkspace(panelId)` export)                                | view                    | none                                     | false     |
| **노출 금지** (31) | alias 2 `zoomInNumpad · deleteAlt` · UI 결합 3 `zoomToSelection · toggleAI · toggleMonitor` · `openProject` (navigation) · `commandPalette` · `escape` · 방향키 8 · tree 8 · `nextElement/prevElement` · `copyProperties/pasteProperties · copyStyles/pasteStyles · toggleSections` (패널 UI 전용) | —                                                                                                                                                                                 | —                       | —                                        | —         |

**확정 allowlist 40 / 71** (Phase 0 실측 2026-08-28 — 상한 40 충족; 초안 ≈ 35 에서 alias 2 · `zoomToSelection` · `toggleAI` · `toggleMonitor` 를 빼고 패널 9 · 뷰 7 을 세면 40 — 분류표는 §2 Phase 0 실측 결과). `zoomToSelection` 은 BuilderCanvas 의 `frameAreas` 클로저가 필요해 노출 금지 확정.

### 3-4. executor (`services/agent/executeAgentCommand.ts`)

```
executeAgentCommand(id, args, ctx: { host: "ai-panel" | "chrome-mcp" | "mcp", requestConfirm })
  1. COMMAND_META[id].agentCallable === false → { status: "denied", reason } + 기록
  2. precondition(readModel) 실패 → { status: "precondition-failed", reason } + 기록
  3. confirm === true → await ctx.requestConfirm({ id, summary })  거부 → { status: "declined" } + 기록
  4. adapter(args) 실행 — **transaction 으로 감싸지 않는다** (runInTransaction 은 동기 창 전용, adapter 는 async). 1 entry 는 액션 자체가 보장 (Phase 0 실측 표) — N entry 명령은 undo: "irreversible" + confirm 또는 노출 금지. 동기 액션 (패널·줌) 은 history 무관 (view)
  5. 기록 1건 append (§3-5) → { status: "ok", undoable, historyIndex }
```

배치 (`run_commands([...])`) 는 mutation 등급 = 원소 max, confirm 은 **원소별** (배치로 승인 1회에 묶어 destructive 를 숨기지 못한다 — R2).

### 3-5. 기록 (`agentCommandLog` — root store 세션 슬라이스)

```ts
{ ts, host, id, args, status: "ok"|"denied"|"precondition-failed"|"declined"|"error", reason?, mutation, undoable, historyIndex?, durationMs }
```

- AIPanel 에 "agent 가 실행한 명령" 으로 가시 (사용자가 무엇이 바뀌었는지 안다). 세션 메모리 — 영속 아님 (R5).
- dev harness bridge: `window.__compositionAgent.log()` 를 Chrome MCP 가 읽어 `pnpm agent:run -- evidence live-exercise pass --detail` 에 붙인다 (Phase 3 G3 도구). 앱이 파일을 쓰지 않는다.

### 3-6. consumer (본 ADR 범위)

- **Groq tool `run_command`** (`services/ai/tools/runCommand.ts`) — 파라미터 `{ id: enum(allowlist), args? }`. 도구 정의는 `COMMAND_META` 에서 생성 (allowlist 가 enum). 134 가 Groq 를 제거하면 같은 descriptor 를 MCP tool 로 옮긴다 (D11).
- **`window.__compositionAgent`** — dev 빌드 한정 (`import.meta.env.DEV`) `{ run, list, log }`. Phase 3 live 게이트와 Chrome MCP 경로 전용.

## 4. Phase 계획

| Phase | 내용                                                                                                                                                                                                                                                                                                             | Gate | 규모                  |
| ----- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---- | --------------------- |
| 0     | **Implemented 2026-08-28 (G0 통과)** — inventory freeze — §2 재grep · 71 id 분류 (§3-3 표 확정, allowlist 상한 40) · allowlist 각 id "handler → 호출 심볼 + 부가 동작" 표 · **액션별 history entry 수 실측** (`getCurrentPageEntries` 전후 diff, async 액션은 transaction 불가) · AI 도구 7종 승인/기록 0 재확인 | G0   | 문서만                |
| 1     | `COMMAND_META` 71 + 정적 게이트 5조항 + `AGENT_COMMANDS` adapter (allowlist) + 정적 심볼 대조 (adapter import = Phase 0 표의 handler 호출 심볼) + jsdom spy (심볼 1회 호출) — 결과 parity 는 G3 (handler 경로 oracle) — **키보드·팔레트 무변경**                                                                 | G1   | 3 파일 신규           |
| 2     | executor + confirm 게이트 + history group + `agentCommandLog` 슬라이스 + jsdom (denied / precondition / declined / ok / 배치 confirm 원소별)                                                                                                                                                                     | G2   | 3 파일 신규 + store 1 |
| 3     | consumer — `run_command` Groq tool + `window.__compositionAgent` (DEV) + AIPanel 로그 표시 → **live** (Chrome MCP): agent 호출 ≥ 15 · confirm 실측 (delete) · undo 1회 복원 · 195 oracle 재실행 · 번들 Δ                                                                                                         | G3   | 2 파일 + UI 1         |
| 4     | CHANGELOG · README · `### Live Exercise` · 134 D11 에 "descriptor 소비" 1줄 정합 메모                                                                                                                                                                                                                            | —    | 문서                  |

## 5. 파일 변경표

| 파일                                                                               | Phase | 변경                                                                                                          |
| ---------------------------------------------------------------------------------- | ----- | ------------------------------------------------------------------------------------------------------------- |
| `apps/builder/src/builder/config/commandMeta.ts`                                   | 1     | 신규 — `COMMAND_META` 71 + 타입                                                                               |
| `apps/builder/src/builder/config/commandMeta.static.test.ts`                       | 1     | 신규 — 정적 게이트 5조항                                                                                      |
| `apps/builder/src/builder/hooks/usePanelLayout.ts`                                 | 1     | `togglePanelWorkspace(panelId)` 순수 함수 export (hook 본문 무변경 — Phase 0 판정, helper 3개가 모듈 private) |
| `apps/builder/src/services/agent/agentCommands.ts`                                 | 1     | 신규 — allowlist adapter (canvasActions · historyManager · store)                                             |
| `apps/builder/src/services/agent/agentCommands.test.ts`                            | 1     | 신규 — parity                                                                                                 |
| `apps/builder/src/services/agent/executeAgentCommand.ts`                           | 2     | 신규 — executor                                                                                               |
| `apps/builder/src/services/agent/executeAgentCommand.test.ts`                      | 2     | 신규                                                                                                          |
| `apps/builder/src/builder/stores/agentCommandLog.ts`                               | 2     | 신규 — 세션 슬라이스 (root store 편입은 Phase 0 판정)                                                         |
| `apps/builder/src/services/ai/tools/runCommand.ts` + `definitions.ts` + `index.ts` | 3     | tool 1개 추가 (descriptor 생성)                                                                               |
| `apps/builder/src/builder/main/BuilderCore.tsx` (또는 dev entry)                   | 3     | `window.__compositionAgent` DEV 노출                                                                          |
| `apps/builder/src/builder/panels/ai/*`                                             | 3     | 로그 표시 (최소 — 목록 1개)                                                                                   |
| `docs/adr/134-*.md`                                                                | 4     | D11 정합 메모 1줄                                                                                             |

**무변경 보장**: `useKeyboardShortcutsRegistry.ts` · `commandRegistry.ts` · `CommandPalette.tsx` · `keyboardShortcuts.ts` (정의 필드 추가 없음 — metadata 는 별도 표).

### 체크리스트

- [x] Phase 0 (2026-08-28, HEAD `52b268a42`): §2 재grep 일치 (정규식 1건 정정) · §3-3 표 확정 (allowlist **40**) · handler→심볼 표 · 액션별 entry 수 실측 (전부 1, paste 는 batch 옵션) — §2 Phase 0 실측 결과
- [ ] Phase 1: 정적 게이트 5조항 PASS + 민감도 (allowlist id 의 adapter 제거 → RED · external id 를 agentCallable true → RED) · 심볼 대조 전부 PASS · spy 1회 · 195 oracle 26/26 · type-check
- [ ] Phase 2: denied/precondition/declined/ok/배치 jsdom PASS · 기록 1:1 · history 1 entry
- [ ] Phase 3: live ≥ 15 (키보드 경로 store 상태와 대조) · confirm 실측 · undo 복원 · 195 oracle 재실행 · 팔레트 G3 23건 재실행 동일 · 번들 Δ ≤ +3KB gz · `pnpm agent:work -- verify` 통과 (live-exercise 기록 포함)
- [ ] Phase 4: CHANGELOG (신규 public 표면) · README · `### Live Exercise`

## 6. 재현 스니펫 (Phase 3 — Chrome MCP `javascript_tool`)

```js
// allowlist 확인
window.__compositionAgent
  .list()
  .map((c) => c.id + ":" + c.mutation + (c.confirm ? "!" : ""));
// 정렬 3개 → undo 1회 복원
await window.__compositionAgent.run("alignLeft");
window.__compositionAgent.log().at(-1); // { status: "ok", undoable: true, historyIndex }
await window.__compositionAgent.run("undo");
// 거부 경로
await window.__compositionAgent.run("openProject"); // { status: "denied", reason: "external" }
await window.__compositionAgent.run("delete"); // confirm 다이얼로그 → 거부 시 { status: "declined" }
```

## 7. 비스코프 / 후속

- **external 명령 (DB/publish/navigation) 의 agent 노출** — 본 ADR 은 `agentCallable: false` 고정. 승인 흐름이 앱 안 다이얼로그를 넘어 배포 파이프라인과 얽히므로 별도 결정 (publish 는 `project-publish-link-only-defer-until-builder-stable` 방침과도 충돌).
- **MCP/ACP 노출** — ADR-134 D11/Phase 9. 본 ADR 은 descriptor 만 JSON Schema 호환으로 둔다.
- **패널 로컬 state 명령** (`toggleSections` · 속성/스타일 클립보드) 의 store 승격 — 195 대안 C 와 같은 이유로 보류. agent 가 필요로 하면 그때 개별 결정.
- **컨텍스트 메뉴·액션 바 registry 통합** — 195 §7 그대로.
- **agentCommandLog 영속화 / 세션 간 감사** — 지금은 세션 메모리. 요구가 생기면 ADR-180 history 와의 관계를 먼저 정한다.
