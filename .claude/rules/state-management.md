---
description: 편집 상태 (catalog runtime 문서 · 명령 · 히스토리 · 저장 · 선택) 와 남은 Zustand store 작업 시 적용
paths:
  - "**/stores/**"
  - "apps/builder/src/builder/catalogRuntime/**"
  - "packages/shared/src/catalog/runtime/**"
  - "packages/shared/src/catalog/document/**"
  - "packages/shared/src/catalog/resolution/**"
  - "packages/shared/src/catalog/transactions/**"
  - "packages/shared/src/catalog/commands/**"
---

# 상태 관리 규칙

> **2026-10-04 Publish 후속**: Preview/Publish 실행 세션·DOM·상태·테마의 공용 구현은 `packages/shared/src/catalog/runtime`이다. Publish는 검증한 catalog 파일에서 독립 세션을 만들고 Builder store를 import하지 않는다. Builder iframe 동기화는 origin/source를 검증하는 기존 postMessage 경계를 유지한다.

> **2026-10-04 전면 개정**: ADR-248 Phase 4 (2026-10-03 main 병합) 로 Builder 의 문서 · 선택 · 히스토리 · 저장이 Zustand canonical store (`elements` / `elementsMap` / `childrenMap` · `_rebuildIndexes` · `runCanonicalMutation` · `historyActions` · `instanceActions`) 에서 **catalog runtime** (`apps/builder/src/builder/catalogRuntime/**` + `packages/shared/src/catalog/**`) 으로 옮겨졌고, 옛 store 와 그 규칙의 대상 파일은 `0b0eaea28` (Phase 4e-13-3) 에서 삭제됐다. 옛 규칙 본문은 git 이력에 있다.
>
> 공식 결정: [ADR-248](../../docs/adr/completed/248-unified-catalog-document.md). `composition-patterns` skill 의 규칙 · reference 는 2026-10-04 catalog runtime 기준으로 개정했다 (`zustand-*` 는 남은 UI store 한정). 옛 store 만 다루던 문서 4개 (`zustand-childrenmap-staleness` · `inspector-inline-styles` · `reference/state-details` · `reference/runtime-contracts`) 는 같은 날 삭제했다. skill 문서가 이 문서와 충돌하면 이 문서가 우선.

## 1. 무엇이 어디에 있나

| 상태                                                  | 정본                                                                                                     | 읽기                                                                                                         |
| ----------------------------------------------------- | -------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------ |
| 문서 (페이지 · 노드 · 정의 · interaction · 상태 변수) | `CatalogGraph` (`packages/shared/src/catalog/document/graph.ts`) — `CatalogRuntime` (`controller.ts`) 안 | `graph.getEntry` · `ownerOf` · `CatalogReadModel` (`readModel.ts`) · `useCatalog*` hook (`react.runtime.ts`) |
| 요소 순서                                             | `NodeEntry.children` · `PageEntry.children` 배열 (ADR-118), 페이지 순서는 `ProjectEntry.pageIds`         | 같은 배열. 문서 노드에 `order_num` 필드는 없다                                                               |
| 선택 · hover · 편집 맥락 · breakpoint                 | `CatalogSession` (`session.ts`) — step 마다 `reconcile()` 로 사라진 대상을 뺀다                          | `useCatalogSession`                                                                                          |
| 히스토리                                              | 프로젝트당 스택 하나 (`ProjectSession.undo/redo` — `controller.ts`)                                      | `CatalogHistoryStore` (`history.ts`, History 패널)                                                           |
| 저장                                                  | IndexedDB `composition-catalog-projects-v1` (`storage.ts`) — `CatalogAutosave` (`autosave.ts`)           | —                                                                                                            |
| 데이터 (collections · 프로젝트 변수 · API endpoint)   | `useDataStore` (`stores/data.ts`) — 문서 밖 (H1: 행은 문서에 들어가지 않는다)                            | `useDataStore` · Canvas 는 `catalogBoundRows` (`dataBinding.ts`)                                             |
| UI (패널 배치 · 캔버스 설정)                          | `builderUiStore` (`stores/builderUiStore.ts`) 외 작은 store (toast · conversation · commandRegistry …)   | Zustand selector                                                                                             |

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
- **컴포넌트 원본은 정의가 소유하는 template 이고 Local page 가 그것을 그린다 (ADR-279, 2026-10-21 — ADR-260 의 참조 모양 폐기)**: `createComponent` 는 정의 (`templateRootId` 소유 edge) 가 노드를 넘겨받고 부모 child list 의 그 자리에 새 instance 를 둔다 — 위치 키 (`POSITION_LAYOUT_KEYS`) 는 base · `responsive[bp]` 층마다 instance 의 같은 층으로 (`splitPositionLayers`), 중첩 추출 (Local 카드 안 노드) 은 바깥 instance 의 `descendantOverrides` · interaction · `showWhen` 주소를 같은 transaction 에서 새 instance 를 지나도록 재작성 (`rewriteAddressesThroughExtracted`, 바깥 정의의 property target 은 뺀다). 원본 판정은 `componentOriginOf` (= `definitionOfTemplateRoot` 가 component 정의) — 역색인은 소유 template 에도 같다. `dissolveComponent` = instance 전부 detach + 정의 · template 삭제, `duplicateDefinition` = ◆ ⌘D, 복사한 template 루트의 붙여넣기 = instance. Create component 의 이름은 `utils/componentNamePrompt.ts` (host 없으면 동기 기본 이름). **Why (2026-10-21)**: 기본 원본이 Library page 에 사는데 사용자 원본만 page 에 남아 비대칭 (사용자 「잘못된 선택」) — ADR-260 의 `originRef` 세 모양 · Restore · 숨은 template 은 모두 삭제, contract 46.
- **template 노드 자신의 override 도 instance 에 투영된다 (ADR-260 Decision 11)**: 투영 자리의 override 는 「투영 경로의 owner 들 (바깥 instance → 안쪽 project template 노드), 바깥이 이김」 으로 읽는다 — `resolution/templateOwners.ts` (`overridesAt` · `layeredOverride` · `innerOwnerPlace`) 를 resolver · positions · fieldSource 가 같이 쓴다. template 노드의 `fillSlot` · `replace` 자식은 바깥 instance 의 template 자리 (`templatePath` 가 그 노드의 owned children 으로 들어간다 — `address.ts`) 이고 detach 는 사본으로 물질화한다. 한쪽 소비자만 바꾸면 Canvas · Layers · 패널 값이 갈린다.
- **원본 instance 인 template 자리는 자기 값을 안쪽 원본의 루트로 넘긴다** (`resolver.ts` `instanceRoot(...)` — Menu 의 Button 자리는 Button 원본의 instance 라 record 는 Button 원본의 루트다). 넘기는 visual 키 목록 · layout 에 그 자리 patch 의 breakpoint 층 (`patchLayers` · `templateLayers`) 과 patch layout 을 넣는다. **Why (2026-10-15)**: 목록이 base `visual` 키만 들고 layout 은 patch 를 뺀 `authoredLayout` 이라, Mobile 에서 쓴 Menu Button 의 border 와 desktop margin 이 문서에만 있고 화면에 없었다 (사용자 보고).
- **바뀐 데이터를 Canvas 에 알리기**: 행 변경 → `workspace.refreshRows`, 프로젝트 변수 변경 → `workspace.refreshState` (둘 다 `CatalogBuilderCore.tsx` 가 `useDataStore` 구독으로 부른다). mount 는 root 가 읽은 collections (`rowsSource`) 와 다른 것만 (`changedCollectionIds`) — 무조건 `refreshRows()` 를 부르지 않는다. **Why (2026-10-21)**: boot 가 data store 초기화를 await 한 뒤 root 를 만들어 행이 이미 있는데 mount 가 바인딩 page root 전부를 다시 해석했다 (22 페이지 문서 첫 프레임의 ~1/4, 4x 에서 ~~520 ms). `refreshRows` 1회는 page root 전부 재 flatten + 장면 전체 재 bind 라 (324~~370 ms · 4x 1.3 s) 호출 수가 곧 비용이다.
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

`showWhen`·`presentWhen`·RAC render props 값과 상태 주체 주소는
[RAC 조립 계약](../skills/composition-patterns/rules/domain-rac-composition.md)을 따른다.
상태 변수 `{{ }}`와 구분하고 owner 변경 뒤 consumer 재평가·저장 주소 보존을 확인한다.

## 6. Interaction (ADR-131 의 events / actions 를 대체)

- 문서 정본은 `InteractionEntry { kind:"interaction", ownerId, trigger, action }` (`ProjectEntry.interactionIds`) — interaction 이 자기 소유 노드를 가리킨다 (노드가 `props.onPress: "ev1"` 로 가리키지 않는다). 편집은 `catalogRuntime/interactions.ts` 의 명령.
- **등록표는 손으로 쓰지 않는다 (ADR-280)**: `CAPABILITY_REGISTRY` · `IMPLICIT_STATE_SOURCES` 는 RAC 개념 파일 (`packages/shared/src/interactions/concepts/*.ts` — RAC 문서 절 하나 = 개념 하나, 이름마다 설치 d.ts `satisfies`) 과 컴포넌트 spec (`componentInteractionSpecs.ts` — 유일한 손 입력) 에서 `deriveRegistry` 가 만든다. 새 컴포넌트의 When · Do 는 spec 한 줄 (개념 · owner) 이고, type 마다 쓰는 이름이 그 RAC props 에 없으면 `RAC_SURFACE_CHECK` 가 컴파일을 막는다. 개념 표는 RAC 의 절 구조를 옮긴 묶음일 뿐 새 어휘가 아니다 (사용자 원칙 2026-10-22).
- **Preview/Publish 의 상태는 첫 render 부터 controlled**: running Preview (`setRuntimeProps` 가 있는 렌더) 의 binding 은 상태 prop 을 `catalogControlledProps` (`catalog/runtime/runtimeStateProps.ts`) 로 넘긴다 — 값은 항상 정의 (`undefined` 로 uncontrolled 에 떨어지는 render 금지 — react-stately 는 `value !== undefined` 로 판정), RAC 의 변경은 record 의 runtime 값으로, `default*` 와 controlled prop 을 같이 넘기지 않는다, key 에 상태값을 넣지 않는다 (remount 금지). 현재 값은 `catalogRuntimeStateOf` 하나 (runtime override ?? 시작 상태 — 항목이 선언한 선택 포함) 를 렌더와 dispatcher 가 같이 읽는다. **Why**: 항목 집계를 `defaultSelectedKeys` 로 넘기던 ListBox · GridList 는 규칙이 쓴 선택이 RAC 에 닿지 않았고, dispatcher 는 집계를 몰라 다중 선택의 `selectItem` 이 기존 선택을 지웠다 (ADR-280 Phase 0 RED).
- **open 은 trigger 의 것**: overlay 본체 (Modal · Popover · Tooltip) 의 자기 `isOpen` 은 trigger context 를 이긴다 (설치 RAC `Modal.mjs:88-90`) — 본체를 controlled 로 두면 trigger press 가 본체를 못 연다. 그래서 MenuTrigger · DialogTrigger · TooltipTrigger · ContextualHelp · picker 가 `isOpen` 을 받고, 본체에 건 open 규칙은 dispatcher 의 `stateOwnerOf` 가 trigger 로 보낸다. 본체는 trigger 없이 설 때만 자기 open 을 갖는다.
- **capability 쓰기 순서**: 값 해소 (`!param` · `!event.<arg>` · 리터럴) → 현재 유효 상태 → 결과 (`op` add · remove, single 은 교체) → RAC 제약 (`guards` — disabled · readOnly · 빈 선택 금지 · selectionMode · disabledKeys, 그룹이 내려주는 disabled · readOnly 포함) → 결과 전체 쓰기. 막히면 report (조용한 no-op 금지). 범위는 RAC 가 clamp 하므로 guard 없음. 래퍼 (`I18nProvider` · `display: contents` marker · calendar picker) 는 `withRuntime` 이 준 핸들러를 안의 RAC 요소에 넘긴다 (`ForwardingI18nProvider` · `ForwardingMarker` · `catalogForwardHandlers`).
- **Form submit · reset 은 DOM ref**: dispatcher `invokeImperative` → `requestSubmit()` (RAC validation 을 거친다) · `reset()` (controlled field 는 `useFormReset` 으로 첫 값). 작성한 목적지가 없는 Form (`action` 없음 · `method` ≠ `dialog`) 만 `onSubmit` 에서 `preventDefault` — 목적지가 있으면 HTML 제출 그대로.
- **패널은 RAC 가 지금 받는 것만 (ADR-281)**: When · Do 선택지는 `exposure.ts` (`exposedTriggerGroups` · `exposedCapabilities`) 가 고르고, 판정은 dispatcher 의 첫 검사와 같은 `declaredRefusal` (`constraints.ts`) 이다 — 패널과 실행이 다른 답을 내지 않는다. 막힌 규칙은 지우지 않고 표식만. When 라벨 키는 등록표 그룹에서 유도 (`interactions.trigger.<개념>.<callback>`), `!event` 인자 이름은 개념의 `args` (`eventArgNames`).
- **조상 상속 (ADR-281)**: page 루트 · frame 의 `isDisabled` · `isReadOnly` · `isRequired` · `locale` (+ page 루트 `colorScheme`) 는 `runtime/inheritedProps.ts` 하나를 DOM (`CatalogDomNode` — RAC `Provider` 표 `providerContexts.ts` + `I18nProvider`) · Canvas (`presence.ts` 파생 `isDisabled` · `isReadOnly`) · guard (`getConstraintContext().inherited`) 가 읽는다. 받는 쪽 flag 는 OR (조상의 `true` 가 이김) — palette 원본이 `isDisabled: false` 를 기본값으로 실어 record 가 작성한 `false` 와 구별하지 못한다. **Why (2026-10-22)**: RAC 규칙 (자식 자기 값 우선) 만 따르면 상속이 어떤 palette 컴포넌트에도 닿지 않았다. `colorScheme` 은 Do 전용 (`editorHidden`) → 세션 `setColorScheme` 이 `applyTheme` 을 그 색 모드로.
- **원본 규칙의 instance 상속 (ADR-281)**: 원본 template 노드의 규칙은 모든 instance 에서 실행되고, instance 는 자리 patch 의 `interactions` 맵 (원본 규칙 → `"off"` \| 자기 규칙) 으로 끄거나 바꾼다. 패널 (`catalogInheritedInteractionsOf`) 과 Preview (`recordsOfOwner`) 는 `effectiveInteractionsOf` (`catalog/resolution/effectiveInteractions.ts`) 하나를 읽는다 — 한쪽만 바꾸면 「안 보이는데 실행」 이 돌아온다. ADR-262 반영 · Reset all 이 맵을 다룬다.
- **`callEndpoint` 는 제출 전용 실행기 (ADR-281)**: `submitApiEndpoint` → `submitCollectionEndpoint` — 요청 공유 0 (조회의 `createCollectionEndpointExecutor` 는 endpoint id 로 진행 중 요청을 공유해 둘째 body 를 버린다), 성공 = `response.ok` (204 · 빈 본문 · 비 JSON 도 성공), 실패는 Preview runtime 이 `[interactions]` 경고 + toast. body 는 `!event.formData` (form 요소 `FormData`, 같은 name 여러 값은 배열) 또는 리터럴.

## 7. Styles · Properties 패널 입력

- 구조 편집으로 template 부품이 owned node가 된 field의 Content 패널은 실제 부품 값을 읽고,
  부모의 의미 속성 편집·Reset과 부품 쓰기를 한 명령으로 적용한다. **Why (2026-10-14)**:
  Prefix 추가 시 고정된 Label·Input을 둔 채 부모 label/placeholder만 바꾸면 패널과 두 renderer가
  달라진다. 부품 직접 편집과 Undo도 패널 구독 대상에 포함한다.

- 놓은 원본 instance 의 slot 기본 내용은 놓는 순간 소유 노드 (`fillSlot`) 다 — `insertNodes` · 컬렉션 "+" 가 `ownSlotContents` (`commands/materialize.ts`) 를 부른다. 선언된 slot 외에 항목을 담은 자리 (Menu) 와 중첩 원본 slot 의 항목 채움 (Select · ComboBox 의 ListBox) 도 같다. ListBox · GridList · TagGroup · Breadcrumbs (와 picker 의 ListBox) 는 resolver 가 첫 소유 항목을 행마다 반복하고, `{prop}` 에 묶인 slot 만 템플릿 자리로 둔다. 한 주소의 override 는 하나라서 `fillSlot` 이 그 자리의 prop · style 쓰기 (`DescendantPatchFields`) 도 담는다 — patch 를 읽는 곳은 `descendantPatchOf` 로 읽는다. **Why (2026-10-14, 같은 날 둘째)**: patch 가 `fillSlot` 을 덮어 Card Content · TabList · Menu 의 style 한 번이 `UNOWNED_NODE` 로 거부됐다. 조상 타입은 원본 이름이 아니라 루트 타입으로 읽는다 (`ancestorTypes`) — 「TreeItem/Default」 안의 TreeItem 이 컬렉션 밖으로 보여 원본의 selected 표시 상태가 선택으로 샜다. **Why (2026-10-14)**: 템플릿 자리 항목은 detach · create component · ID 가 없어 "+" 로 넣은 항목과 다른 객체였다 (사용자 「slot 호스트 전부」). 그전 resolver 는 `fillSlot` 이면 행을 버렸다 ("+" 로 항목을 넣은 bound ListBox 의 행이 사라짐).

- 렌더 중 ref 를 갱신하지 않는다 — 렌더가 소비하는 입력·헤더 스냅샷은 state 또는 외부 구독으로 읽고, 최신 이벤트 콜백은 commit 에서 연결한다. **Why (2026-10-12 lint 수리)**: 렌더 중 ref를 갱신하면 아직 commit되지 않은 렌더의 콜백이 네이티브 이벤트 경로로 유출될 수 있다. 렌더가 소비하는 입력·헤더 스냅샷은 state 또는 외부 구독으로 읽고, 최신 이벤트 콜백은 commit에서 연결한다. 이전 consumer의 cleanup은 새 consumer를 끊지 않아야 한다.

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
