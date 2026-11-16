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

- 일반 Property에는 RAC context `slot` 선택·해제를 노출하지 않는다. 역할 이름·미지정·명시 해제의 문서·Code 계약과 자식 추가용 Slot은 보존한다. **Why (2026-11-07)** 모든 컴포넌트에 적용한 사용자 결정으로 공통 본문 두 경로의 RAC slot 선택창과 Sheet의 일반 필드를 숨긴다. 두 Slot 계약을 함께 지우면 Items 삽입이나 기존 역할 연결까지 사라진다 (`propertyRacSlotVisibility.test.tsx`).
- catalog의 Slot 제공자·소비자 및 상태 수신 등록은 실제 RAC context와 함께 갱신한다. **Why (2026-11-07):** SelectBox의 ListBoxItem Text와 ActionBar의 clear Button은 실제 context가 있어도 제공자 등록 누락으로 새 자식의 Slot 편집이 숨겨졌고, 새 타입의 disabled 수신 누락은 Canvas와 DOM의 활성 상태를 갈랐다 (`s2CompositionPatterns.test.tsx`).
- 상속·Slot은 binding, 원본의 내부 controller, Property, 실제 context 소비를 함께 검증한다. **Why (2026-11-07)** TextArea 수신 별칭과 Form size 키가 빠져 상태·크기가 상속되지 않았고, 13개 Canvas Label은 상위 required를 계산하지 않았다. Image의 별도 속성 계약과 trigger-root 원본의 Slot 전달도 일반 primitive 등록만으로 연결되지 않았다. DOM Slot 해석은 작성된 역할값과 분리한다. 역할값을 덮으면 숨겨야 할 necessity-label이 Preview에 나타난다 (`existingComponentContracts.test.tsx`).

- RAC 선택 wrapper의 자동 선택은 부모 slot까지 합쳐진 실제 그룹 상태를 읽고 시작한다. **Why (2026-11-07):** SegmentedControl이 own prop만 확인해 slotted 초기 선택을 첫 항목으로 덮고 controlled context에는 마운트 변경 이벤트를 보냈다. context 병합 전 기본값으로 상속을 차단하지 않는다 (`segmentedControlInheritance.browser.test.ts`).

- 필드 `value` 편집에는 일반 Text의 개행용 `white-space` 자동 승격을 적용하지 않는다. **Why (2026-11-07):** TextArea의 실제 Enter 입력이 Input에 지원되지 않는 `whiteSpace: pre-wrap`을 preview/commit하여 `CATALOG_CANVAS_VISUAL_UNSUPPORTED` 렌더 실패를 일으켰다. 값의 개행은 owner에 저장하고 필드의 표시 계약을 유지한다.

- Input의 편집 값과 표시 값은 같은 가장 가까운 field owner를 해석한다. 빈 값도 편집 채널을 유지하고 쓰기는 owner prop의 기존 명령 경로를 사용한다. **Why (2026-11-07):** TextArea·ColorField Input이 owner 값을 placeholder로만 파생해 Canvas에서 value를 편집할 수 없었다. 자식 value override를 쓰면 RAC owner context와 저장 값이 갈라지므로 표시와 편집의 owner 탐색을 공유한다.

- Collection의 RAC 선택 값은 키 배열과 `"all"` sentinel을 끝까지 구분하며, 재마운트 key도 값의 구조를 보존한다. **Why (2026-11-07):** Preview ListBox에서 Ctrl+A 뒤 `selectedKeys`를 배열로 단정해 `keys.join is not a function`으로 렌더가 중단됐다. 문자열 `"all"`과 항목 키 배열 `["all"]`, 쉼표를 포함한 항목 키도 같은 key로 합치지 않는다.

- Code에서 인접 변수의 기본값을 함께 바꿀 때 기존 이름이 남은 선언은 기존 변수 ID에 반영한다. **Why (2026-11-07):** 한 편집 hunk에 포함된 두 번째 useState를 삭제·재생성하면 컴포넌트의 PropVar가 이전 ID를 가리켜 autoFocus 연결이 사라졌다. native union의 타입·기본값은 생성·역편집에서도 그대로 보존한다.

> **2026-10-04 Publish 후속**: Preview/Publish 실행 세션·DOM·상태·테마의 공용 구현은 `packages/shared/src/catalog/runtime`이다. Publish는 검증한 catalog 파일에서 독립 세션을 만들고 Builder store를 import하지 않는다. Builder iframe 동기화는 origin/source를 검증하는 기존 postMessage 경계를 유지한다.

> **2026-10-04 전면 개정**: ADR-248 Phase 4 (2026-10-03 main 병합) 로 Builder 의 문서 · 선택 · 히스토리 · 저장이 Zustand canonical store (`elements` / `elementsMap` / `childrenMap` · `_rebuildIndexes` · `runCanonicalMutation` · `historyActions` · `instanceActions`) 에서 **catalog runtime** (`apps/builder/src/builder/catalogRuntime/**` + `packages/shared/src/catalog/**`) 으로 옮겨졌고, 옛 store 와 그 규칙의 대상 파일은 `0b0eaea28` (Phase 4e-13-3) 에서 삭제됐다. 옛 규칙 본문은 git 이력에 있다.
>
> 공식 결정: [ADR-248](../../docs/adr/completed/248-unified-catalog-document.md). `composition-patterns` skill 의 규칙 · reference 는 2026-10-04 catalog runtime 기준으로 개정했다 (`zustand-*` 는 남은 UI store 한정). 옛 store 만 다루던 문서 4개 (`zustand-childrenmap-staleness` · `inspector-inline-styles` · `reference/state-details` · `reference/runtime-contracts`) 는 같은 날 삭제했다. skill 문서가 이 문서와 충돌하면 이 문서가 우선.

- **선택 · 펼침은 그룹이 저장한다 (ADR-308, 2026-11-12)**: 그룹의 `selectedKey(s)` · `value` · `expandedKeys` (Design 패널은 `defaultSelectedKey(s)` · `value` · `expandedKeys` 에 쓴다) 가 정본이고 항목은 key (`id`, Radio · Checkbox 는 `value`) 만 갖는다. Canvas · DOM · dispatcher 는 `catalog/runtime/groupSelection.ts` 하나 (`catalogSelectionGroupOf` · `catalogGroupSelection` · `catalogItemKey` · `catalogItemSelected` · `catalogGroupExpansion`) 를 읽는다 — 항목 `isSelected` · `isExpanded` 를 그룹 선택 · 펼침의 출처로 읽거나 쓰지 않는다 (단독 ToggleButton · Checkbox · Switch · Card · Disclosure 만 자기 상태, 게이트 `adr308GroupSelection.static.test.ts`). 그룹 안 항목 대상 Do 는 dispatcher 의 `groupStateOf` 가 그룹 값의 key 넣기 · 빼기로 바꾼다. 항목 key 를 고치는 쓰기는 그룹 값 · 짝 TabPanel `itemId` 를, 항목 삭제는 그룹 값의 그 key 를 같은 명령에서 고친다 (`singleSelection.ts` `catalogItemKeyRenameCommands` · `structure.ts` `dropRemovedItemKeys`). **Why**: 선택이 항목 `isSelected` 에 있어 그룹 칸이 두 그룹에만 있었고 instance 별 선택 · 컴포넌트 속성 · 데이터 행 선택이 불가능했다. contract 64.

## 1. 무엇이 어디에 있나

- **Collection 보기 캐시 (2026-11-03)**: 평가기가 실제 읽은 참조 대상의 행·schema와 미존재 대상까지 의존성으로 기록하고, 참조도 `resolveCollectionSnapshot` 정책을 따른다. **Why**: 직접 참조만 추적하면 Users → Teams → Organizations의 마지막 행 변경 후 필터가 이전 결과를 재사용했고, 참조의 별도 데이터 선택은 mock fallback·loading 상태를 직접 바인딩과 다르게 읽었다.

| 상태                                                     | 정본                                                                                                                               | 읽기                                                                                                                  |
| -------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------- |
| 문서 (페이지 · 노드 · 정의 · interaction · 상태 변수)    | `CatalogGraph` (`packages/shared/src/catalog/document/graph.ts`) — `CatalogRuntime` (`controller.ts`) 안                           | `graph.getEntry` · `ownerOf` · `CatalogReadModel` (`readModel.ts`) · `useCatalog*` hook (`react.runtime.ts`)          |
| 요소 순서                                                | `NodeEntry.children` · `PageEntry.children` 배열 (ADR-118), 페이지 순서는 `ProjectEntry.pageIds`                                   | 같은 배열. 문서 노드에 `order_num` 필드는 없다                                                                        |
| 선택 · hover · 편집 맥락 · breakpoint                    | `CatalogSession` (`session.ts`) — step 마다 `reconcile()` 로 사라진 대상을 뺀다                                                    | `useCatalogSession`                                                                                                   |
| 히스토리                                                 | 프로젝트당 스택 하나 (`ProjectSession.undo/redo` — `controller.ts`)                                                                | `CatalogHistoryStore` (`history.ts`, History 패널)                                                                    |
| 저장                                                     | IndexedDB `composition-catalog-projects-v1` (`storage.ts`) — `CatalogAutosave` (`autosave.ts`)                                     | —                                                                                                                     |
| 데이터 정의 (collections · 프로젝트 변수 · API endpoint) | 문서 entry `collection` · `endpoint` · `projectVariable` (ADR-286, contract 51 — mock 행 포함, API 결과 `runtimeRows` 는 store 만) | `useDataStore` (문서의 투영 — `catalogDataStore.ts`) · Canvas 는 문서에서 (`catalogDataRead.ts` → `catalogBoundRows`) |
| UI (패널 배치 · 캔버스 설정)                             | `builderUiStore` (`stores/builderUiStore.ts`) 외 작은 store (toast · conversation · commandRegistry …)                             | Zustand selector                                                                                                      |

요소 · 문서 Zustand store 는 없다. `useStore` · `elementsMap` · `childrenMap` 를 새로 만들지 않는다.

- **Home = 프로젝트 첫 페이지 (`catalogHomePageId` — `commands/project.ts`, 사용자 결정 2026-11-11)**: Navigator 트리 · Canvas 페이지 격자 · 페이지 설정이 이 함수 하나를 읽는다. Home 은 다른 페이지 아래로 들어가지 않고 route 는 `/` 다 — `updatePage` 가 `HOME_PAGE_FIXED` 로 거절하고 패널은 Parent page 칸을 내지 않는다. **Why**: Navigator (「부모 없는 route `/`, 없으면 첫 root」) 와 Canvas (첫 페이지) 의 판정이 달라, Home 에 부모를 주면 Navigator 의 Home 표시만 다른 페이지로 옮겨 갔다.

## 2. 편집 파이프라인 (순서 필수 보존)

- 테마 변경은 transaction consumer 안에서 새 토큰으로 root를 한 번만 만든다. 실패 시 graph를 원복한 뒤 등록된 `onRollback`으로 이전 토큰·root·엔진 입력을 복구하고, root 구독자는 publish 뒤 모두 호출한다. **Why (2026-11-02)**: activeThemeId의 project `put`을 기존 root의 전체 갱신으로 소비한 뒤 `afterStep`에서 다시 root를 만들어 600요소 전환의 layout 계산이 2회 발생했다. 토큰 설치·새 root 생성 실패도 저장·history에 들어가기 전에 원복해야 한다.

문서를 바꾸는 길은 **명령 하나**다 — `CatalogCommand` (`packages/shared/src/catalog/commands/**`: `setFields` · `insertNodes` · `moveNodes` · `pasteNodes` …) 를 `workspace.execute(command)` 에 넘긴다. 패널은 `useCatalogCommandRunner` (hook) · `runCatalogCommand` (workspace 를 prop 으로 받는 곳) (`catalogRuntime/commandRunner.ts`) 가 거부를 안내로 (`notifyEditRefusal`), 그 밖의 실패를 toast 로 바꿔 준다 — 패널 코드에서 `workspace.execute` 를 직접 try/catch 하지 않는다. graph 를 직접 고치거나 op 를 손으로 만들어 `runtime` 에 넣지 않는다.

1. `CatalogWorkspace.execute` (`workspace.ts`) — 자동 HTML id · origin view 재작성 → `root.execute` → 정의 view 후처리 · 선택 (`plan.selectAfter`)
2. `CatalogCompositionRoot.execute` (`compositionRoot.ts`) — 현재 revision 에 대해 명령을 계획하고 `runtime.dispatch`. `REVISION_CONFLICT` 면 한 번 다시 계획한다
3. `CatalogRuntime.step` (`controller.ts`):
   1. `applyCatalogTransaction` (`transaction.ts`) — project id · `expectedRevision` · history 의도 · 빈 op 검사 → staging → entry · 구조 검증 → inverse → `graph.commit` (revision + 1)
   2. **consumer** (compositionRoot 의 Canvas · DOM record 갱신 · 레이아웃) — 던지면 `graph.revertCommit` 후 `CatalogStepAbortedError`. 문서와 화면은 같이 바뀌거나 같이 안 바뀐다
   3. 저장 대기열에 변경 entry **전체 JSON** 추가 (`expectedDurableRevision = revision − 1`)
   4. 히스토리 기록 → resolved 캐시 무효화 → field 구독자 → step listener (session reconcile · read model · autosave · preview) → consumer 의 deliver
   5. 구독자 · listener 오류는 모아서 `CatalogSubscriberError` — 이때 step 은 이미 커밋돼 있다 (되돌리지 않는다)
4. `CatalogAutosave` — 기본 `queueMicrotask` 로 `runtime.save` → `CatalogStorage.commit` 이 저장된 revision 이 `expectedDurableRevision` 이고 새 revision 이 +1 일 때만 쓴다 (아니면 `REVISION_CONFLICT` / `UNSUPPORTED_PROJECT_FORMAT`)
5. Preview — `workspace.attachPreview` 의 `CatalogPreviewChannel` (`previewChannel.ts`) 이 step 의 바뀐 · 지운 id 를 모아 `CATALOG_DELTA`, 준비 · 프로젝트 전환 때 `CATALOG_SNAPSHOT`. Preview 는 복제본에 `runtime.sync` (history skip `"sync"`, 저장 없음). 데이터 정의는 문서 delta 로 같이 가고, `CATALOG_DATA` (`CatalogPreviewFrame.tsx`) 는 API 결과 `{ id, runtimeData }` 만 (ADR-286 R7)

## 3. 핵심 규칙

- 작성된 상태가 자식의 존재 여부를 결정하면 소유자 값 해석과 증분 의존성 갱신을 함께 연결한다. **Why (2026-11-03)**: Sheet의 `defaultOpen=true`가 Preview에서는 열렸지만 Canvas는 overlay를 항상 숨겼다. Sheet의 열림 우선순위와 trigger → overlay 재판정을 함께 연결해야 편집·Undo·재로딩이 같은 결과를 낸다.
- 소유자 속성으로 자식 장식을 그릴 때도 derived props와 의존성 전파를 함께 선언한다. **Why (2026-11-03)**: SheetOverlay의 `preventDismissal`과 `swipeDirection`을 자식 Sheet에 전달하여 Canvas·CSS handle 표시와 방향을 맞추고, 속성 편집·Undo에 따른 갱신을 검증했다.

- 텍스트 편집 범위의 focus 이탈은 editor DOM뿐 아니라 Typography와 portal을 포함해 감시한다. **Why (2026-11-02, ADR-299)**: editor에만 붙은 focusout은 패널 input→Tab 범위 이탈을 놓쳐 Chromium·WebKit에서 커밋 0회였다. document capture와 1회 커밋 guard로 처리한다.

- RichText 편집기의 로딩 화면은 원본 runs와 동일한 mark/token 해석을 사용하며 plain 입력을 받지 않는다. **Why (2026-11-03)**: 새로고침·Dashboard 재진입 첫 편집의 textarea fallback은 64px·24px 서식을 제거해 표시했고, 로드 전에 입력하면 runs를 문자열로 덮어썼다. 대기 중 키는 Canvas 전역 단축키로 전파하지 않는다. 전역 capture 단축키도 `role="textbox"`와 내부 run을 입력 대상으로 판별해야 한다.

- **Styles scrub 미리보기 (ADR-298)**: `TokenUse`는 활성 테마 값으로 해석한 뒤 `previewRecord`에 전달한다. 취소·원점 복귀·capture 해제는 대기 RAF와 보유 preview를 끝내며 문서/History를 쓰지 않는다. **Why (2026-11-02)**: primitive 전용 변환기가 원래 토큰을 버려 Padding M(12px)에서 자유값 16px 드래그를 취소한 뒤에도 consumer가 16에 남았다.

- **히스토리 의도는 필수**: `applyCatalogTransaction` 은 `history: { kind: "record", label }` 또는 `{ kind: "skip", reason }` 없이는 `HISTORY_INTENT_REQUIRED` 로 거부한다. skip 사유는 `project-create` · `load` · `fixture` · `sync` 넷뿐 — 사용자 편집은 늘 기록된다 (ADR-185 의 「조용한 생략 금지」 가 타입 · 검증으로 옮겨 왔다).
- **히스토리는 프로젝트당 한 스택**: undo / redo 는 entry 의 `inverse` / `forward` 를 기록된 step 으로 다시 돌리고 바깥 효과 (`external`) 를 뒤따라 실행한다. 페이지별 스택 · `migrateEntryToPage` 는 없다. AI 묶음은 `mergeHistory` 로 한 entry.
- **데이터 편집도 문서 명령 하나 (ADR-286)**: `useDataStore.applyDataChange` 는 reduce 결과를 sink (`setDataDefinitionSink` — `bindCatalogDataStore`, `catalogDataStore.ts`) 로 넘기고 sink 가 `setDataEntries` (+ 바인딩 · 문서 명령) 를 `composeOver` 로 묶어 `workspace.execute` 한 step 으로 실행한다 — history · 저장 · 프로젝트 파일이 하나. store 의 정의 Map 은 step 마다 문서에서 다시 투영된다 (직접 set 금지 — `adr286G1` 정적 검사). 옛 `recordExternal` 데이터 경로 (`dataHistory.ts`) 는 삭제됐다.
- **컴포넌트 원본은 정의가 소유하는 template 이고 Local page 가 그것을 그린다 (ADR-279, 2026-10-21 — ADR-260 의 참조 모양 폐기)**: `createComponent` 는 정의 (`templateRootId` 소유 edge) 가 노드를 넘겨받고 부모 child list 의 그 자리에 새 instance 를 둔다 — 위치 키 (`POSITION_LAYOUT_KEYS`) 는 base · `responsive[bp]` 층마다 instance 의 같은 층으로 (`splitPositionLayers`), 중첩 추출 (Local 카드 안 노드) 은 바깥 instance 의 `descendantOverrides` · interaction · `showWhen` 주소를 같은 transaction 에서 새 instance 를 지나도록 재작성 (`rewriteAddressesThroughExtracted`, 바깥 정의의 property target 은 뺀다). 원본 판정은 `componentOriginOf` (= `definitionOfTemplateRoot` 가 component 정의) — 역색인은 소유 template 에도 같다. `dissolveComponent` = instance 전부 detach + 정의 · template 삭제, `duplicateDefinition` = ◆ ⌘D, 복사한 template 루트의 붙여넣기 = instance. Create component 의 이름은 `utils/componentNamePrompt.ts` (host 없으면 동기 기본 이름). **Why (2026-10-21)**: 기본 원본이 Library page 에 사는데 사용자 원본만 page 에 남아 비대칭 (사용자 「잘못된 선택」) — ADR-260 의 `originRef` 세 모양 · Restore · 숨은 template 은 모두 삭제, contract 46.
- **Components 탭의 Library · Local page 는 문서의 page 다 (ADR-282 Phase 3, 2026-10-25)**: `ProjectEntry.componentPageIds` (라우트 · Pages 목록 · Preview · publish 밖 — `withoutComponentPages`), 처음 열 때 runtime `load` step (History 없음) 으로 만든다. ◆ 칸은 원본을 `NodeEntry.originOf` 로 참조하고, Builder 가 그 원본 (표본 view entry 또는 정의 · override 소유 template 루트) 을 `graph.setViewChildren` 으로 그 칸의 `children` 앞에 그린다 — 저장 · export · 색인에는 없다. 명령 · transaction 은 `graph.commandReader` (그리는 자식 없는 graph) 로 읽고 stage 가 쓰기 · inverse 에서 그 id 를 지운다. **Why**: 그리는 자식을 명령이 보면 칸을 걷는 명령 (해제의 주소 재작성) 이 view 표본을 쓰려 했다 (`INVALID_ID`). 사용자에게 보이는 instance 수는 page 의 ◇ 를 빼고 센다 (`projectInstancesOf`). 저장 노드 id 는 `project:node:cp-<역할>-<hash>` (`componentPageNodeId` — 역할 `card` · `inst` · `theme` · `origin` · `local` 을 pick · hover helper 가 id 로 읽는다), body 는 3 열 grid 에 카드 직속, 카드는 제목 바로 뒤에 ◆ (와 slot 을 채운 ◇) 를 직접 담고 (Origin 줄 없음 — 그리는 위치는 `setViewChildren` 의 `at`), 그 뒤 줄은 grid 하나 — 컴포넌트 카드는 캡션 없이 샘플만 (◆ · ◇ 는 Layers 가 표시, 사용자 2026-10-25), theme 카드는 샘플 행 + 캡션 행 (값 이름 · 값). **Why (2026-10-25)**: 경로형 id (평균 99 B, 부모 `children` 이 반복) 와 Column · 줄 · 칸 frame 으로 Library page 가 867 KB 였다 (사용자 「Library 가 왜 1mb」) → 464 KB. page 가 만든 값 (body grid · gap · padding …) 은 그 노드의 기본값 — Styles dirty · Reset 은 `catalogComponentPageBaseline` (`workspace.componentPageBaseline`) 과 비교하고 되돌린다 (사용자 보고 2026-10-25 「리셋 시 초기화」). `componentPageIds` 는 History 밖 load step 만 쓴다 — undo · redo 는 그 목록을 지금 값으로 둔다 (`withCurrentComponentPages`), 남아 있는 page 를 목록에서 빼는 step 은 `UNOWNED_ENTRY` 로 거부된다. **Why (2026-10-27)**: Library 를 처음 열기 전에 기록된 step 의 undo 가 프로젝트 옛 사본으로 목록을 지워, 재열기 · Publish 가 `UNOWNED_ENTRY` 로 실패했다 (283 live 관찰). Library 가 잠긴 동안 (기본 — `workspace.setLibraryUnlocked`) 그 page 의 노드 · 표본 · 해제 사본은 어떤 편집도 받지 않는다 (`originView.ts` `catalogOriginEditCommand` → `LIBRARY_LOCKED` 안내). **Why (2026-10-25)**: Phase 3 로 page 노드가 문서 노드가 되자 잠금이 사본만 막아 「잠금해제 하지 않아도 수정 가능」 했다.
- **template 노드 자신의 override 도 instance 에 투영된다 (ADR-260 Decision 11)**: 투영 자리의 override 는 「투영 경로의 owner 들 (바깥 instance → 안쪽 project template 노드), 바깥이 이김」 으로 읽는다 — `resolution/templateOwners.ts` (`overridesAt` · `layeredOverride` · `innerOwnerPlace`) 를 resolver · positions · fieldSource 가 같이 쓴다. template 노드의 `fillSlot` · `replace` 자식은 바깥 instance 의 template 자리 (`templatePath` 가 그 노드의 owned children 으로 들어간다 — `address.ts`) 이고 detach 는 사본으로 물질화한다. 한쪽 소비자만 바꾸면 Canvas · Layers · 패널 값이 갈린다.
- **원본 instance 인 template 자리는 자기 값을 안쪽 원본의 루트로 넘긴다** (`resolver.ts` `instanceRoot(...)` — Menu 의 Button 자리는 Button 원본의 instance 라 record 는 Button 원본의 루트다). 넘기는 visual 키 목록 · layout 에 그 자리 patch 의 breakpoint 층 (`patchLayers` · `templateLayers`) 과 patch layout 을 넣는다. **Why (2026-10-15)**: 목록이 base `visual` 키만 들고 layout 은 patch 를 뺀 `authoredLayout` 이라, Mobile 에서 쓴 Menu Button 의 border 와 desktop margin 이 문서에만 있고 화면에 없었다 (사용자 보고).
- **바뀐 데이터를 Canvas 에 알리기**: 정의 (mock 행 · schema · 프로젝트 변수 시작값) 는 문서 step 이라 consume plan 이 그것을 읽는 root 를 다시 그린다 (`compositionRoot.ts` `dataReaderRoots` — ADR-286 R8, store 구독 없음). API 결과 (`runtimeRows`) 만 `CatalogBuilderCore.tsx` 의 store 구독이 `workspace.refreshRows(changedRuntimeCollectionIds(...))` 로 알린다. mount 는 root 가 읽은 행 (`rowsSource`) 과 다른 것만 — 무조건 `refreshRows()` 를 부르지 않는다. **Why (2026-10-21)**: boot 가 data store 초기화를 await 한 뒤 root 를 만들어 행이 이미 있는데 mount 가 바인딩 page root 전부를 다시 해석했다 (22 페이지 문서 첫 프레임의 ~1/4, 4x 에서 ~~520 ms). `refreshRows` 1회는 page root 전부 재 flatten + 장면 전체 재 bind 라 (324~~370 ms · 4x 1.3 s) 호출 수가 곧 비용이다.
- **구독은 field 단위**: 패널 · 오버레이는 `runtime.subscribeEntryField` / `subscribeResolvedField` 나 `useCatalog*` hook 으로 읽는다. step 전체를 구독해 매번 다시 계산하지 않는다 (`subscribeSteps` 는 read model 처럼 집계가 필요한 곳만). 집계 읽기는 손으로 구독하지 않고 `useCatalogStepReading(workspace, read)` (JSON 이 같으면 같은 값) · `useCatalogRevision(workspace)` (문서 전체를 읽는 view — Code 보기 · Interactions 규칙 목록) 로 한다 (`catalogRuntime/react.runtime.ts`, 정적 게이트 `panels/core/panelStepReading.static.test.ts`).
- **지운 대상을 읽는 구독은 마지막 값을 든다**: `CatalogReadModel` 의 읽기가 대상이 사라져 다시 계산에 실패하면 캐시를 지우지 않고 `orphan` 으로 마지막 값을 돌려주고, 대상이 돌아오면 (Undo) 다시 따른다 (`readModel.ts` `revive`). **Why (2026-11-16 /fix)**: 실패한 읽기를 지웠더니, 트리가 줄을 빼기 전에 한 번 더 그려지는 Layers 의 Chart 줄 아이콘 (`useCatalogPropSource(chartType)`) 이 새로 계산하다 `CatalogValidationError` 를 던져 Chart 를 Backspace 로 지우면 앱이 멈췄다 (회귀 `phase4cReadModel.test.ts`).
- **Zustand 규칙은 남은 store 에만**: StateCreator 팩토리 · 슬라이스 파일 분리, selector 는 개별 값 단위로 쓰고 배열 / 객체가 필요하면 ref 캐싱 (Zustand v5 는 `equalityFn` 을 무시 · 그룹 selector 와 `useShallow` 는 로컬 ESLint 금지 — `apps/builder/eslint-local-rules/index.js`), `setTimeout` / `queueMicrotask` 안에서는 `get()` 으로 최신 값.

## 4. 데이터 — Collections · 5. 상태 변수 · 6. Interaction → [data-interaction.md](data-interaction.md)

2026-11-15 세 절을 원문 그대로 [data-interaction.md](data-interaction.md) 로 옮겼다 (절 번호 §4 · §5 · §6 유지). 그 파일은 데이터 · 변수 · interaction · Preview 세션 · resolver · 명령 · 문서 파일을 읽을 때 로드된다. 아래 경우는 `paths` 에 걸리지 않아도 **먼저 그 파일을 읽는다**:

- `compositionRoot.ts` 의 행 감싸개 (`catalogBindingKey` · `catalogBindingQuery` · `dataReaderRoots` · `planBindingOwners` · `refreshRows` · `refreshState`) 를 고칠 때 — §4 · §6
- Canvas · DOM 에서 바운드 행 (`catalogBoundRows` · `repeat` 항목 · `rowIndex` · 표시 창) 을 읽거나 그리는 코드를 고칠 때 — §4 · §6 「반복 표시」
- `{{ }}` 템플릿 · 입력 변수 · 날짜 값을 읽는 새 소비처를 만들 때 — §5
- When · Do · capability · open 소유 · controlled 상태 prop 을 건드릴 때 — §6

## 7. Styles · Properties 패널 입력

- 항목을 추가하는 원본은 자식 Slot 선언과 `GROUP_ITEM_TYPES` 또는 `COLLECTION_FAMILIES`를 함께 등록한다. 내부 묶음의 Slot 선택창은 `GROUP_ITEMS_WRAPPER`의 그룹 항목을 읽는다. **Why (2026-11-07)** SegmentedControl·SelectBoxGroup의 두 등록, Pagination·ColorSwatchPicker·ActionBar의 Slot 선언이 빠져 있었다. 전체 팔레트와 13개 그룹의 명령·Slot 계약을 대조했다.

- RAC 항목의 `id`는 HTML ID와 별개로 보존하며, locale 기본 행간과 상태 부품의 시각은 공통 record 투영과 DOM 스타일에서 함께 소비한다. **Why (2026-11-07)** Slot 소유 SegmentedControlItem의 자동 HTML ID가 선택 key를 덮어 Preview에서 모두 미선택으로 보였다. CJK 행간은 CSS 기본값에 가려졌고 disabled 테두리는 증분 갱신에서 누락됐다. 초기 선택·사용자 편집·Undo와 설치 S2의 실제 출력을 대조했다.

- Avatar의 숫자·`lh` 크기는 별도 scalar 값 계약으로 검증하고, `lh` 기하는 실제 상속 font·line-height와 같은 갱신 의존성을 사용한다. **Why (2026-11-07)** 상위 fontSize 20→24 편집에서 leaf를 typography 의존성에서 제외하면 Canvas 지름은 60에 남고 Preview는 72로 변했다. 상속 font의 leaf 갱신과 숫자·문자열 저장 왕복을 인접 회귀 검사로 확인했다.

- partRules의 `via` 적용과 변경 전파는 같은 `CATALOG_PART_RULE_PASS_HOSTS`를 읽는다. **Why (2026-11-07)** Disclosure XL의 resolver는 제목을 20px·700으로 해석했으나 Heading을 통과하는 Button 자식이 증분 갱신에서 빠져 Canvas는 14px·600에 남았다. 제목·아이콘의 재해석과 Undo/Redo를 회귀 검사로 확인했다.

- **글자 편집 상자 = ProseMirror 입력 층 (ADR-299)**: 텍스트 선택 때 `textEditor/EditorField` chunk 를 미리 준비하고 편집 진입 때 lazy 로 연다 (로드 전 plain은 textarea, RichText는 서식을 보존한 read-only 화면), 매 입력은 `fromDoc` (정규형 run) → `previewRecord` (문서 쓰기 0), 커밋은 지금처럼 `setFields` 한 명령. 편집 범위 = 편집 상자 + Typography 절 (`[data-section-id="typography"]`) + 팝오버 — 그 안의 press · focus 는 편집을 끝내지 않고, 패널은 `textEditorHandle` (선택 구간 marks 읽기 · PM transaction 쓰기) 로만 편집기에 닿는다. 편집 밖 패널 쓰기는 노드 값 + run 의 그 축 지우기 (사용자 결정 3, `catalogStylesHost` `styleCommandOf`). Properties 의 글자 칸은 plain 을 보이고 거기서 쓰면 run 이 사라진다 (Decision 6). **Why (2026-11-02 live)**: Properties 가 작성 값을 그대로 읽어 `[object Object]` 를 보였다.

- 구조 편집으로 template 부품이 owned node가 된 field의 Content 패널은 실제 부품 값을 읽고,
  부모의 의미 속성 편집·Reset과 부품 쓰기를 한 명령으로 적용한다. **Why (2026-10-14)**:
  Prefix 추가 시 고정된 Label·Input을 둔 채 부모 label/placeholder만 바꾸면 패널과 두 renderer가
  달라진다. 부품 직접 편집과 Undo도 패널 구독 대상에 포함한다.

- 놓은 원본 instance 의 slot 기본 내용은 놓는 순간 소유 노드 (`fillSlot`) 다 — `insertNodes` · 컬렉션 "+" 가 `ownSlotContents` (`commands/materialize.ts`) 를 부른다. 선언된 slot 외에 항목을 담은 자리 (Menu) 와 중첩 원본 slot 의 항목 채움 (Select · ComboBox 의 ListBox) 도 같다. 연결된 목록은 `repeat` 표시가 붙은 소유 항목을 행마다 반복하고 나머지 항목은 고정 항목으로 그 자리에 둔다 (ADR-310 Phase 3 — 아래 「반복 표시」), `{prop}` 에 묶인 slot 만 템플릿 자리로 둔다. 한 주소의 override 는 하나라서 `fillSlot` 이 그 자리의 prop · style 쓰기 (`DescendantPatchFields`) 도 담는다 — patch 를 읽는 곳은 `descendantPatchOf` 로 읽는다. **Why (2026-10-14, 같은 날 둘째)**: patch 가 `fillSlot` 을 덮어 Card Content · TabList · Menu 의 style 한 번이 `UNOWNED_NODE` 로 거부됐다. 조상 타입은 원본 이름이 아니라 루트 타입으로 읽는다 (`ancestorTypes`) — 「TreeItem/Default」 안의 TreeItem 이 컬렉션 밖으로 보여 원본의 selected 표시 상태가 선택으로 샜다. **Why (2026-10-14)**: 템플릿 자리 항목은 detach · create component · ID 가 없어 "+" 로 넣은 항목과 다른 객체였다 (사용자 「slot 호스트 전부」). 그전 resolver 는 `fillSlot` 이면 행을 버렸다 ("+" 로 항목을 넣은 bound ListBox 의 행이 사라짐).

- 렌더 중 ref 를 갱신하지 않는다 — 렌더가 소비하는 입력·헤더 스냅샷은 state 또는 외부 구독으로 읽고, 최신 이벤트 콜백은 commit 에서 연결한다. **Why (2026-10-12 lint 수리)**: 렌더 중 ref를 갱신하면 아직 commit되지 않은 렌더의 콜백이 네이티브 이벤트 경로로 유출될 수 있다. 렌더가 소비하는 입력·헤더 스냅샷은 state 또는 외부 구독으로 읽고, 최신 이벤트 콜백은 commit에서 연결한다. 이전 consumer의 cleanup은 새 consumer를 끊지 않아야 한다.

- 새 노드의 생성 props (`catalogCreationProps`) 는 「자기 값 없이 보이는 값」 (`readDefinitionProp` — `readPropSource().inherited` 와 같은 계층, 문서 reader 로) 과 다를 때만 쓴다. 정의의 `defaults` 와 비교하지 않는다. **Why (2026-11-16 /fix)**: composite 원본 (Chart) 은 `defaults: {}` 이고 값이 template 루트에 있어, 놓은 Chart 마다 Overrides 가 ~30 개였다. library 만 읽으면 잠금 해제한 원본의 template (프로젝트 사본) 에서 `DANGLING_TEMPLATE` 이 난다 (`chartCreationOverrides.test.ts`).
- `PropertyUnitInput`: focus 때 선택 id 를 ref 로 잡고 blur 때 비교 — 다르면 onChange 를 건너뛴다. **Why**: mousedown → blur 순서라 blur 시점에 이미 새 요소가 선택돼 있다.
- Styles 값은 `catalogStylesHost.ts` 가 선택 record 의 typed field 를 읽어 `SelectedElement` 로 만든다 (옛 `buildSelectedElement` · `SyntheticComputedStyle` 은 없다). 편집은 `catalogSemanticPatchCommand` → `setFields` 한 step.

## 금지 패턴

- ❌ graph 를 직접 고치거나 op 를 손으로 만들어 runtime 에 넣기 — 명령 → `workspace.execute` 가 유일한 길
- ❌ `history` 의도 없이 transaction 실행 · 사용자 편집을 skip 사유로 기록 생략
- ❌ consumer (Canvas · DOM 갱신) 안의 실패를 삼키기 — 던져야 `revertCommit` 으로 문서와 화면이 같이 되돌아간다
- ❌ data store 의 정의 Map (`collections` · `variables` · `apiEndpoints`) 을 직접 set — 문서의 투영이다 (쓰기는 `applyDataChange` → sink → 문서 명령)
- ❌ 요소 · 문서 Zustand store 를 다시 만들기 (`useStore` · `elementsMap` · `childrenMap`)
- ❌ `set()` 으로 `collections` 직접 변경 · step 전체 구독으로 field 하나를 다시 계산
- ❌ `setTimeout` 안에서 바깥에서 잡은 store 값 사용 (남은 Zustand store — `get()` 필수)
