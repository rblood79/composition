---
description: 편집 상태 (catalog runtime 문서 · 명령 · 히스토리 · 저장 · 선택) 와 남은 Zustand store 작업 시 적용
paths:
  - "**/stores/**"
  - "apps/builder/src/builder/catalogRuntime/**"
  - "packages/shared/src/catalog/transactions/**"
  - "packages/shared/src/catalog/commands/**"
---

# 상태 관리 규칙

> **2026-10-04 Publish 후속**: Preview/Publish 실행 세션·DOM·상태·테마의 공용 구현은 `packages/shared/src/catalog/runtime`이다. Publish는 검증한 catalog 파일에서 독립 세션을 만들고 Builder store를 import하지 않는다. Builder iframe 동기화는 origin/source를 검증하는 기존 postMessage 경계를 유지한다.

> **2026-10-04 전면 개정**: ADR-248 Phase 4 (2026-10-03 main 병합) 로 Builder 의 문서 · 선택 · 히스토리 · 저장이 Zustand canonical store (`elements` / `elementsMap` / `childrenMap` · `_rebuildIndexes` · `runCanonicalMutation` · `historyActions` · `instanceActions`) 에서 **catalog runtime** (`apps/builder/src/builder/catalogRuntime/**` + `packages/shared/src/catalog/**`) 으로 옮겨졌고, 옛 store 와 그 규칙의 대상 파일은 `0b0eaea28` (Phase 4e-13-3) 에서 삭제됐다. 옛 규칙 본문은 git 이력에 있다.
>
> 공식 결정: [ADR-248](../../docs/adr/248-unified-catalog-document.md). `composition-patterns` skill 의 규칙 · reference 는 2026-10-04 catalog runtime 기준으로 개정했다 (`zustand-*` 는 남은 UI store 한정). 옛 store 만 다루던 문서 4개 (`zustand-childrenmap-staleness` · `inspector-inline-styles` · `reference/state-details` · `reference/runtime-contracts`) 는 같은 날 삭제했다. skill 문서가 이 문서와 충돌하면 이 문서가 우선.

## 1. 무엇이 어디에 있나

| 상태                                                  | 정본                                                                                                     | 읽기                                                                                                  |
| ----------------------------------------------------- | -------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------- |
| 문서 (페이지 · 노드 · 정의 · interaction · 상태 변수) | `CatalogGraph` (`packages/shared/src/catalog/document/graph.ts`) — `CatalogRuntime` (`controller.ts`) 안 | `graph.getEntry` · `ownerOf` · `CatalogReadModel` (`readModel.ts`) · `useCatalog*` hook (`react.tsx`) |
| 요소 순서                                             | `NodeEntry.children` · `PageEntry.children` 배열 (ADR-118), 페이지 순서는 `ProjectEntry.pageIds`         | 같은 배열. `order_num` 은 없다 (옛 프로젝트 로드 때 걷어냄)                                           |
| 선택 · hover · 편집 맥락 · breakpoint                 | `CatalogSession` (`session.ts`) — step 마다 `reconcile()` 로 사라진 대상을 뺀다                          | `useCatalogSession`                                                                                   |
| 히스토리                                              | 프로젝트당 스택 하나 (`ProjectSession.undo/redo` — `controller.ts`)                                      | `CatalogHistoryStore` (`history.ts`, History 패널)                                                    |
| 저장                                                  | IndexedDB `composition-catalog-projects-v1` (`storage.ts`) — `CatalogAutosave` (`autosave.ts`)           | —                                                                                                     |
| 데이터 (collections · 프로젝트 변수 · API endpoint)   | `useDataStore` (`stores/data.ts`) — 문서 밖 (H1: 행은 문서에 들어가지 않는다)                            | `useDataStore` · Canvas 는 `catalogBoundRows` (`dataBinding.ts`)                                      |
| UI (패널 배치 · 캔버스 설정)                          | `builderUiStore` (`stores/builderUiStore.ts`) 외 작은 store (toast · conversation · commandRegistry …)   | Zustand selector                                                                                      |

요소 · 문서 Zustand store 는 없다. `useStore` · `elementsMap` · `childrenMap` 를 새로 만들지 않는다.

## 2. 편집 파이프라인 (순서 필수 보존)

문서를 바꾸는 길은 **명령 하나**다 — `CatalogCommand` (`packages/shared/src/catalog/commands/**`: `setFields` · `insertNodes` · `moveNodes` · `pasteNodes` …) 를 `workspace.execute(command)` 에 넘긴다. 패널은 `useCatalogCommandRunner` (`panels/navigator/catalog/`) 가 실패를 toast 로 바꿔 준다. graph 를 직접 고치거나 op 를 손으로 만들어 `runtime` 에 넣지 않는다.

1. `CatalogWorkspace.execute` (`workspace.ts`) — 자동 HTML id · origin view 재작성 → `root.execute` → 정의 view 후처리 · 선택 (`plan.selectAfter`)
2. `CatalogCompositionRoot.execute` (`compositionRoot.ts`) — 현재 revision 에 대해 명령을 계획하고 `runtime.dispatch`. `REVISION_CONFLICT` 면 한 번 다시 계획한다
3. `CatalogRuntime.step` (`controller.ts`):
   1. `applyCatalogTransaction` (`transaction.ts`) — project id · `expectedRevision` · history 의도 · 빈 op 검사 → staging → entry · 구조 검증 → inverse → `graph.commit` (revision + 1)
   2. **consumer** (compositionRoot 의 Canvas · DOM record 갱신 · 레이아웃) — 던지면 `graph.revertCommit` 후 `CatalogStepAbortedError`. 문서와 화면은 같이 바뀌거나 같이 안 바뀐다
   3. 저장 대기열에 변경 entry **전체 JSON** 추가 (`expectedDurableRevision = revision − 1`)
   4. 히스토리 기록 → resolved 캐시 무효화 → field 구독자 → step listener (session reconcile · read model · autosave · preview) → consumer 의 deliver
   5. 구독자 · listener 오류는 모아서 `CatalogSubscriberError` — 이때 step 은 이미 커밋돼 있다 (되돌리지 않는다)
4. `CatalogAutosave` — 기본 `queueMicrotask` 로 `runtime.save` → `CatalogStorage.commit` 이 저장된 revision 이 `expectedDurableRevision` 이고 새 revision 이 +1 일 때만 쓴다 (아니면 `REVISION_CONFLICT` / `UNSUPPORTED_PROJECT_FORMAT`)
5. Preview — `workspace.attachPreview` 의 `CatalogPreviewChannel` (`previewChannel.ts`) 이 step 의 바뀐 · 지운 id 를 모아 `CATALOG_DELTA`, 준비 · 프로젝트 전환 때 `CATALOG_SNAPSHOT`. Preview 는 복제본에 `runtime.sync` (history skip `"sync"`, 저장 없음). 데이터는 따로 `CATALOG_DATA` (`CatalogPreviewFrame.tsx`)

## 3. 핵심 규칙

- **히스토리 의도는 필수**: `applyCatalogTransaction` 은 `history: { kind: "record", label }` 또는 `{ kind: "skip", reason }` 없이는 `HISTORY_INTENT_REQUIRED` 로 거부한다. skip 사유는 `project-create` · `load` · `fixture` · `sync` 넷뿐 — 사용자 편집은 늘 기록된다 (ADR-185 의 「조용한 생략 금지」 가 타입 · 검증으로 옮겨 왔다).
- **히스토리는 프로젝트당 한 스택**: undo / redo 는 entry 의 `inverse` / `forward` 를 기록된 step 으로 다시 돌리고 바깥 효과 (`external`) 를 뒤따라 실행한다. 페이지별 스택 · `migrateEntryToPage` 는 없다. AI 묶음은 `mergeHistory` 로 한 entry.
- **문서 밖 상태의 히스토리 = `recordExternal`**: `useDataStore.applyDataChange` 는 `setDataHistoryRecorder` (`CatalogBuilderCore.tsx` 가 `catalogDataHistoryRecorder` 로 연결 — `dataHistory.ts`) 를 지나 같은 스택에 `CatalogExternalEffect` 로 들어간다. 데이터 + 노드 바인딩을 한 번에 바꾸는 경우 (AI `bind_element`) 는 `catalogDocumentBindingCommitter` 하나의 entry.
- **바뀐 데이터를 Canvas 에 알리기**: 행 변경 → `workspace.refreshRows`, 프로젝트 변수 변경 → `workspace.refreshState` (둘 다 `CatalogBuilderCore.tsx` 가 `useDataStore` 구독으로 부른다).
- **구독은 field 단위**: 패널 · 오버레이는 `runtime.subscribeEntryField` / `subscribeResolvedField` 나 `useCatalog*` hook 으로 읽는다. step 전체를 구독해 매번 다시 계산하지 않는다 (`subscribeSteps` 는 read model 처럼 집계가 필요한 곳만).
- **Zustand 규칙은 남은 store 에만**: StateCreator 팩토리 · 슬라이스 파일 분리, selector 는 개별 값 단위로 쓰고 배열 / 객체가 필요하면 ref 캐싱 (Zustand v5 는 `equalityFn` 을 무시 · 그룹 selector 와 `useShallow` 는 로컬 ESLint 금지 — `apps/builder/eslint-local-rules/index.js`), `setTimeout` / `queueMicrotask` 안에서는 `get()` 으로 최신 값.

## 4. 데이터 — Collections (ADR-132 · ADR-152 v2)

- **문서의 바인딩**: `NodeEntry.binding: DataBindingRef { collectionId, fieldMap? }` (`catalog/document/types.ts`). 변환 `catalogBindingRef` (`dataBinding.ts`), 편집 명령 `catalogBindingCommand` (`dataBindingCommand.ts`, Properties 의 binding 키는 `catalogPropertiesPatchCommand` 가 이쪽으로 가른다).
- **DOM · Preview · publish 의 읽기**: `useCollectionData({ dataBinding })` → `useResolvedCollectionItems` 하나 (`packages/shared/src/hooks/`). resolve 는 `resolveBoundCollection` (id 우선, `name` 은 옛 값 폴백), 옛 `{ type:"collection", config }` 는 `normalizeDataBinding` 이 읽기 경계에서 v2 로. `fieldMap` 값과 `{#<fieldId>}` 토큰은 `DataField.id` (key 아님).
- **Canvas 의 읽기**: `catalogBoundRows` (`dataBinding.ts`) 가 바인딩된 행으로 record 를 만든다 (행 템플릿 편집은 `rowTemplate.ts`). 행 템플릿 해석 (`resolveFieldRoles` · `interpolateCollectionRowTemplate`) 은 shared DOM 쪽 함수다 — Canvas 와 DOM 의 결과가 같은지는 `/cross-check` 로 본다.
- **데이터 편집 = `DataChange`**: collection 생성 · 삭제 · schema · 행 · source 는 `useDataStore.applyDataChange(change)` (`stores/utils/dataChange.ts` — `reduceDataOps` 순수 적용기, all-or-nothing, inverse 동시 산출) 하나. `create/update/deleteCollection` 은 `collectionUpdateToOps` diff 의 얇은 wrapper. **금지**: `set()` 으로 `collections` 직접 변경 · 히스토리 없는 데이터 편집 · `remove_field` / `remove_rows` 를 AI 에 노출 (`HUMAN_ONLY_DATA_OPS`).
- source = `"api"` 는 `useAsyncList.load` 안에서 `executeApiEndpoint` → `collections.runtimeData` → `list.items`. useEffect + 로컬 state 로 결과를 들고 있지 않는다.
- publish snapshot 은 `toRuntimeCollection(table)` (`{ id, name, schema, mockData, useMockData }`). `ExportedProjectSchema` 는 schema 필드 `id` 를 통과시킨다.
- 이름: 저장 · 내부 타입은 `collections` (`CollectionState` · `targetCollection`), 사용자에게 보이는 UI 심볼 `DataTable*` (`panels/datatable/`) 은 유지.

## 5. 상태 변수 (ADR-214)

- **모델**: `VariableDef` (`packages/shared/src/state/`). 소유자별 저장 —
  - 프로젝트 = `useDataStore.variables` (IndexedDB, `define_variable` op, `createVariable` / `updateVariable` / `deleteVariable`)
  - 페이지 · 요소 = 문서의 `StateVariableEntry { kind:"stateVariable", ownerId, name, valueType, defaultValue }` (`ProjectEntry.stateVariableIds`). 노드에 `state` 필드는 없다. 편집은 `stateVariables.ts` 의 record 명령 (UI: `CatalogStateSection.tsx`)
- **가시성 · 이름 충돌 · 사용처** (Builder): `catalogVisibleVariableEntries` · `catalogVariableNameConflict` · `catalogVariableUsageCount` (`stateVariables.ts`, `dataVariables.ts`). 사슬은 요소 → 조상 → 페이지 → 프로젝트, 이름은 사슬 안에서 고유. 소유자 이동은 `catalogLegacyVariableMove` (`dataVariables.ts`).
- **읽기 `{{ name }}`**: `resolveStateTemplate` (string prop 만, 깊이 6). **Canvas 는 기본값 env · Preview / publish 는 런타임 env** — 설계된 비대칭이라 `/cross-check` 에서 결함으로 판정하지 않는다. collection 행 템플릿은 `{{ }}` 먼저 → `{field}` 나중. 미해결 이름 · `{{ env.X }}` 는 원문, `\{{` 는 리터럴 (`hasStateTemplateSyntax`).
- **런타임 값**: `createRuntimeState` (shared) — Preview (`catalogPreviewSession.ts`) 와 publish 에만 있다. 값 키는 `VariableDef.id`, scope `project` / `page:${pageId}` (진입 리셋) / `element:${instanceKey}`. persist 는 project 만 (`composition:runtime-state:v1:${projectId}`). 구독은 `subscribeVariable` (의존 인덱스) — 전체 revision 구독 금지.
- **쓰기 액션**: 문서에는 `InteractionEntry.action { opcode:"setState" }`, 실행은 shared `dispatcher` → `DispatchDeps.writeState`.

## 6. Interaction (ADR-131 의 events / actions 를 대체)

- 문서 정본은 `InteractionEntry { kind:"interaction", ownerId, trigger, action }` (`ProjectEntry.interactionIds`) — interaction 이 자기 소유 노드를 가리킨다 (노드가 `props.onPress: "ev1"` 로 가리키지 않는다). 편집은 `catalogRuntime/interactions.ts` 의 명령.
- `CompositionDocument.events` / `actions` 타입은 export · 옛 입력 형식으로만 남는다 — Builder 정본이 아니다.

## 7. Styles · Properties 패널 입력

- `PropertyUnitInput`: focus 때 선택 id 를 ref 로 잡고 blur 때 비교 — 다르면 onChange 를 건너뛴다. **Why**: mousedown → blur 순서라 blur 시점에 이미 새 요소가 선택돼 있다.
- Styles 값은 `catalogStylesHost.ts` 가 선택 record 의 typed field 를 읽어 `SelectedElement` 로 만든다 (옛 `buildSelectedElement` · `SyntheticComputedStyle` 은 없다). 편집은 `catalogSemanticPatchCommand` → `setFields` 한 step.

## 금지 패턴

- ❌ graph 를 직접 고치거나 op 를 손으로 만들어 runtime 에 넣기 — 명령 → `workspace.execute` 가 유일한 길
- ❌ `history` 의도 없이 transaction 실행 · 사용자 편집을 skip 사유로 기록 생략
- ❌ consumer (Canvas · DOM 갱신) 안의 실패를 삼키기 — 던져야 `revertCommit` 으로 문서와 화면이 같이 되돌아간다
- ❌ 문서 밖 상태 (data store) 를 바꾸면서 `recordExternal` 없이 끝내기 — undo 에서 문서와 데이터가 갈린다
- ❌ 요소 · 문서 Zustand store 를 다시 만들기 (`useStore` · `elementsMap` · `childrenMap`)
- ❌ `set()` 으로 `collections` 직접 변경 · step 전체 구독으로 field 하나를 다시 계산
- ❌ `setTimeout` 안에서 바깥에서 잡은 store 값 사용 (남은 Zustand store — `get()` 필수)
