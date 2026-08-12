# ADR-178 설계 Breakdown: 캔버스 다중 선택 이동 — 요소·페이지 멀티 드래그 + 이동 modifier

## 1. Scope and dependency lock

### 1.1 In scope

- 요소 다중 선택 드래그 — 선택된 전 요소가 같은 델타로 함께 움직이고 드롭 시 batch canonical move + 히스토리 1 entry
- 페이지 다중 선택·드래그 (페이지 다중 선택 모델 신설 포함)
- 이동 modifier: 드래그 중 Shift 축 고정 (수평/수직), Alt/Option 드래그 복제
- 다중 선택에 body 가 섞였을 때 첫 요소가 드래그되는 기존 잠재 엣지 폐쇄

### 1.2 Explicitly out of scope

- 페이지 위치의 히스토리/영속화 (ADR-177 — 직교, 착수 순서 무관)
- 스냅/정렬 가이드 (ADR-179)
- 드래그의 기본 모델 변경 — flow 요소 = 순서 변경/재부모화, absolute 요소 = left/top 이동, 페이지 = 자유 배치 (전부 현행 유지)
- marquee/Shift 클릭 다중 선택 자체 (기존 기능 — 이동만 다룬다)
- LayerTree 패널 DnD (별도 mutation 진입점 — 현행 유지)

### 1.3 Four-question fork lock

| 질문                                          | 판정                                                                                                                                                                |
| --------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| base/application 관계인가?                    | ADR-176 의 owner 계약이 base — pointer 당 owner 1 은 유지하고 owner 가 **대상 집합**을 보유하도록 확장한다 (계약 반전 아님). 177/179 와는 직교.                     |
| schema 가 specialization 관계인가?            | 아니다. document 스키마 무변경 — 런타임 제스처/시각 오프셋/mutation batch 만 확장.                                                                                  |
| predecessor premise 를 reverse verify 했는가? | ADR-176 HC2 "하나의 gesture owner" 는 pointer 단위 규칙 — 다중 대상 보유와 모순 없음을 Phase 0 에서 코드로 확인. deferred commit(드래그 중 store 무변경) 원칙 승계. |
| 나중 review 까지 미룰 경계가 있는가?          | 없다. 대상 집합 정규화 규칙(조상 포함 시 자손 제외)·batch mutation 1회·modifier 의미를 Phase 0 전에 lock 한다.                                                      |

3-ADR 분리(177/178/179)는 사용자 confirm 완료 — 2026-08-12 AskUserQuestion "3개 분리 (권장)" 선택.

## 2. Current evidence (2026-08-12 실측)

| 경로                                                                                         | 현재 동작                                                                                                              | 관심사                                                                                  |
| -------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------- |
| `apps/builder/src/builder/workspace/canvas/hooks/useDragBridge.ts:313`                       | `const draggedId = dragState.selectedElementIds[0]` — 첫 요소만 이동                                                   | 대상 집합화 진입점                                                                      |
| `apps/builder/src/builder/workspace/canvas/skia/nodeRendererTree.ts:37, 60-83`               | 드래그 시각 오프셋이 전역 단일 슬롯 `{elementId, dx, dy}`                                                              | 오프셋 Map 화 — 렌더 비용 축                                                            |
| `apps/builder/src/builder/workspace/canvas/interaction/canvasGestureSession.ts:32, 74-112`   | `pageOwner` 단수 — `tryClaimPage`/`promoteElementToPage` 모두 단일 pageId                                              | owner 의 대상 집합 확장                                                                 |
| `apps/builder/src/builder/workspace/canvas/interaction/pagePositionPresentation.ts:16-17`    | transient override 가 `activePageId` + `activeOverride` 1건 (ADR-176 O(1) 계약)                                        | 다중 override 로 확장하되 map clone 금지 계약 유지                                      |
| `apps/builder/src/builder/workspace/canvas/hooks/useCentralCanvasPointerHandlers.ts:232-240` | 선택이 정확히 1개일 때만 `selectedElement` 조회 — 다중 선택 + body 혼합 시 가드 우회 엣지                              | 엣지 폐쇄 (본 ADR 에서 함께)                                                            |
| `apps/builder/src/builder/workspace/canvas/selection/dropTargetResolver.ts:443, 548+`        | 단일 요소 기준 drop 판정 (same-parent index / cross-container)                                                         | 다중 대상의 타겟 판정 규칙 (리더 기준 + 전 대상 유효성)                                 |
| `apps/builder/src/builder/workspace/canvas/skia/dragAnimator.ts`                             | 형제 벌림 애니메이션 — 단일 드래그 전제                                                                                | 다중 시 벌림 대상 계산                                                                  |
| `apps/builder/src/builder/hooks/useGlobalKeyboardShortcuts.ts:331`                           | 다중 선택 시 화살표 no-op (유지). ADR-177 Phase 3 이후 화살표=`handleArrowMove` — 페이지(body) 단일 선택 시 nudge 분기 | 페이지 **다중** 선택 모델 도입 시 nudge/인스펙터 X/Y 의 다중 대상 동작 정의 (후속 접점) |
| 캔버스 포인터 경로 전체                                                                      | `altKey` 사용 0건, `shiftKey` 는 다중 선택 클릭/스크롤 용도                                                            | modifier 신설 — 기존 의미와 컨텍스트 분리 (드래그 중 한정)                              |
| `apps/builder/src/builder/workspace/canvas/hooks/usePageDrag.ts:127-152`                     | `calculatePosition(clientX, clientY)` — PointerEvent 미수신, modifier 접근 경로 없음                                   | 시그니처 확장 (Shift 축 고정 지점)                                                      |

### 2.1 Phase 0 inventory freeze (2026-08-12 — 코드 실측)

**오프셋 소비자 전수** (시각 오프셋 Map 화의 영향 지점 — R1). grep 전수: `getDragVisualOffset`/`getSiblingOffset` 소비자는 아래 5곳뿐이며, `nodeRendererTree.ts` 의 Tree 렌더 경로(`renderNodeInternal`)는 드래그 오프셋을 **소비하지 않는다** (page delta 만 — "ADR-043: skiaTreeBuilder 반영" 주석은 잔재):

| 소비자                | 위치                                                                                      | 현행                             | Map 화 방향                                            |
| --------------------- | ----------------------------------------------------------------------------------------- | -------------------------------- | ------------------------------------------------------ |
| 스트림 빌드 top-layer | `renderCommands.ts:422` `dragRootId` 단수 — `visitElement:541` 유예 → `:452` 재방문 1회   | 드래그 root 1개만 clip 밖 재방문 | root **Set** + 유예 목록 순회 (대상 수 비례 상한 — G3) |
| 커맨드 실행 오프셋    | `renderCommands.ts:1006-1010` (`CMD_ELEMENT_BEGIN`) — 단일 슬롯 비교 + `getSiblingOffset` | cmd 당 O(1)                      | `Map.get(cmd.elementId)` O(1) 유지                     |
| 형제 벌림 애니메이터  | `dragAnimator.ts` (`updateAnimationTargets`/`tickAnimations`)                             | **이미 Map 기반**                | 무변경 — 리더 기준 `computeSiblingOffsets` 결과 그대로 |
| RAF 보간 publish      | `SkiaCanvas.tsx:687-689`                                                                  | 프레임당 1회                     | 무변경                                                 |
| 드래그 중 hover 억제  | `useElementHoverInteraction.ts:306`                                                       | non-null 체크                    | "드래그 활성" 판정 유지 (의미 동일)                    |

**드롭/커밋 경로**:

- `resolveDropTarget(scenePoint, draggedElementId, store)` — 드래그 요소의 **부모 기준** 형제 판정 (`dropTargetResolver.ts:443`). 다중은 **리더 id** 로 호출 (시그니처 유지). `computeReorderFromDropTarget`/`computeSiblingOffsets`/`computeInsertionLinePosition`/`computeDropPlaceholderBounds` 전부 `(target, draggedId, store)` — 리더 기준 유지, 형제 벌림의 draggedId 제외만 **집합 제외**로 확장.
- **canonical batch 전례**: `applyElementOrderCanonicalPrimary` (`canonicalMutations.ts`) 가 "`moveCanonicalChild` 를 doc 체인으로 N회 적용 → `setDocument` 1회" 패턴. 다중 드롭용 `moveElementsToCanonicalTarget(elementIds, target)` 를 같은 패턴으로 신설 (setDocument/persist 1회 — HC2).
- **히스토리 1 entry**: `historyManager.runInTransaction` 이 창 안 `addEntry` 전부를 entry 1개로 병합 (`history.ts:273-343`) — 현행 단일 드롭도 이 창 안에서 `trackCanonicalMove`. 다중은 같은 창에서 대상별 track (HC2 충족).

**body 혼합 엣지 재현 (코드 추적)**: `useCentralCanvasPointerHandlers.ts:232-241` 이 선택 1개일 때만 `selectedElement` 를 조회해, 다중 선택에서는 `:428-431` 의 body 가드(`selectedElement?.type !== "body"`)가 무조건 통과 → `pendingDrag.elementId = selectedIds[0]`. body 가 첫 요소면 body 로 `startMove` → `useDragBridge` 가 body 에 시각 오프셋 (페이지 전체가 움직여 보임), 드롭 시 `resolveDropTarget` 이 parent 부재로 null → 커밋 없음 — **시각만 이동하고 커밋은 안 되는 혼란 상태**. Phase 1 정규화(§3.1)가 폐쇄, G1 에서 재현 불가 확인.

**R2 lock (다중 드롭 유효성 — Figma 모델)**: Figma 는 부분 적용을 하지 않는다 — 선택이 계층 정규화(조상만 이동, 자손은 따라감)되고, 드래그 집합의 자신/자손 컨테이너는 드롭 후보에서 제외된다 (자기 안으로 드롭 불가). lock: **타겟 판정 단계에서 대상 집합의 자신·자손을 후보 제외** + 남은 타겟에 전 대상 적용 불가면 **전체 취소** (가능 대상만 부분 적용 금지 — R2 데이터 불일치 차단). 검증: G1.

## 3. 계약 설계

### 3.1 대상 집합 정규화

- 드래그 시작 시 `selectedElementIds` 를 정규화: **조상이 집합에 있으면 자손 제외** (이중 이동 방지), body/page 혼합 시 요소 집합에서 body 제외 + 전 선택이 body 뿐이면 페이지 다중 드래그로 승격.
- 정규화는 단일 진입점 함수 (`resolveMultiDragTargets` 류, `interaction/selectionModel.ts` 인접) — 테스트 가능하게 훅 밖.

### 3.2 이동/드롭

- 시각: 오프셋 단일 슬롯 → `Map<elementId, {dx,dy}>` (같은 델타지만 top-layer 재방문·dragAnimator 가 개별 조회). 프레임당 갱신 1회 (RAF 스로틀 현행).
- 드롭: 리더(포인터가 잡은 요소) 기준으로 타겟 판정 → 전 대상에 같은 타겟 적용 가능성 검사 (불가 대상 존재 시 전체 취소 또는 가능 대상만 — Phase 0 에서 Figma 동작 실측 후 lock) → canonical batch move 1회 + 히스토리 1 entry.
- absolute 요소 혼합 집합: absolute 는 left/top 델타, flow 는 순서/재부모화 — 리더 종류 기준으로 동작 분기하지 않고 **대상별 현행 규칙 유지**.
- **페이지 다중 드래그의 히스토리 (리뷰 round 1 — ADR-177 Implemented 접점)**: finish 에서 페이지별 `updatePagePosition` 을 N회 반복 호출하면 안 된다 — ADR-177 Phase 2 이후 그 함수는 **호출당 히스토리 entry 1개 + persist** 를 기록하므로 entry N개 = HC1/HC2 (Cmd+Z 1회 전체 복귀) 위반. 다중 페이지의 기록은 ADR-177 의 `page-position` **batch entry** (`pagePositionEvent.entries[]` N건 → entry 1개) 로 낸다 — `alignPagesToScreen` (`pageLayoutActions.ts`) 의 batch 경로가 정확한 전례. 177/178 은 착수 직교였으나 177 완료로 페이지 축 히스토리의 거처는 확정됐다.

### 3.3 Modifier

- **Shift (드래그 중)**: 시작점 기준 |dx|>|dy| → 수평 고정, 반대는 수직. 페이지·absolute 요소·페이지 다중 드래그에 적용 (flow 드래그는 드롭 판정 좌표에 적용).
- **Alt/Option (pointerdown 시)**: 대상 집합 복제 → 복제본으로 드래그 전환 (원본 잔류). 복제는 기존 duplicate 액션 재사용 + 히스토리 1 entry (복제+이동 합산).
- 기존 Shift 클릭(다중 선택 토글)과 충돌 없음 — 클릭(무이동)과 드래그(threshold 초과)의 시점 분리.

## 4. Phase 분해

| Phase | 내용                                                                                                                                         | 산출 검증                                                                                                                |
| ----- | -------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------ |
| 0     | inventory freeze — 오프셋 소비자 전수(top-layer/dragAnimator/renderCommands), drop 판정 경로, Figma 다중 드롭 동작 실측, body 혼합 엣지 재현 | **Implemented 2026-08-12** — §2.1 계약 표 + 엣지 재현 기록 + R2 lock                                                     |
| 1     | 요소 다중 드래그 — 정규화 + 오프셋 Map + batch move + body 혼합 엣지 폐쇄                                                                    | **Implemented 2026-08-12** — live: batch 연속 삽입 + entry 1개 + Cmd+Z 1회 원순서 복원 + body 엣지 재현 불가 (§4.1 기록) |
| 2     | 페이지 다중 선택·드래그 — gestureSession 대상 집합 + presentation 다중 override                                                              | **Implemented 2026-08-12** — live: 2 페이지 동일 델타 이동 + batch entry 1 + Cmd+Z 1회 전체 복귀 (§4.2 기록)             |
| 3     | modifier — Shift 축 고정 + Alt 드래그 복제                                                                                                   | live: 축 고정 좌표 실측 + Alt 복제 → 원본 잔류 + undo 1회                                                                |
| 4     | 검증 종결 — 성능(오프셋 Map 프레임 비용) + CHANGELOG                                                                                         | live behavior 게이트                                                                                                     |

### 4.1 Phase 1 구현 기록 (2026-08-12)

**구현 형태** (§2.1 계약 대비 조정 1건 포함):

- 정규화 단일 진입점 `resolveMultiDragTargets` + R2 필터 `isContainerWithinDragTargets` (`interaction/selectionModel.ts`) — 조상 판정은 **body 제외 후의 자격 집합** 기준 (body 를 selectedIds 그대로 조상으로 치면 body 자손 전부가 오제외 — 유닛 테스트로 확정).
- 시각 오프셋은 `Map<id,{dx,dy}>` 대신 **`ReadonlySet<string> + 공유 {dx,dy}`** (`nodeRendererTree.ts`) — 전 대상이 같은 델타라 조회 O(1) 은 `Set.has` 로 동일하고 프레임당 갱신이 델타 2필드뿐 (HC3 강화). 단일 대상 string 호출은 기존 시그니처 호환.
- top-layer 재방문: `dragRootId` 단수 → `dragRootIds` Set + 유예 **목록** (`renderCommands.ts`) — 정규화 집합이라 유예 root 간 조상-자손 중복 없음.
- batch mutation `moveElementsToCanonicalTarget` (`canonicalMutations.ts`) — doc 체인 N회 적용 → `setDocument` 1회, 삽입 성공마다 index+1 (연속 배치).
- 드롭 커밋 `commitMultiDragDrop` (`useDragBridge.ts`) — `runInTransaction` 1 entry + flow/absolute 대상별 현행 규칙 (absolute 는 부모가 바뀔 때만 canonical move 포함).
- body 엣지 폐쇄: `useCentralCanvasPointerHandlers` 의 pendingDrag 2곳 + startMove 승격부가 정규화 리더 사용.

**live 검증 (Chrome MCP — Home 페이지, frame 적용)**: ① [body, Nav] 혼합 선택 드래그 → 페이지 위치 불변 (종전 엣지 재현 불가) ② [Nav, GridList] 다중 드래그 → frame 슬롯에 선택 순서 그대로 연속 삽입 + 히스토리 카운터 +1 ③ Cmd+Z 1회 → body 원순서 정확 복원 + 슬롯 비움.

**발견 2건**:

1. **batch undo 형제 순서 뒤집힘 (Phase 1 에서 수정)** — `trackCanonicalMove` 를 이동 순서(=from index 오름차순)로 기록하면 undo 의 역순 적용 (`applyCanonicalHistoryEventsToDocument`) 이 큰 index 부터 삽입해 형제 순서가 뒤집힌다 (live 실측: [Nav@0, refA@1] 복원 시 refA 가 형제 뒤로). 기록을 **from index 내림차순**으로 정렬해 undo(역순=오름차순 복원)/redo(정순=내림차순 재적용, to 는 최종 문서 기준) 양방향 정합 — live 재검증 완료.
2. **[사전 결함 — scope 외] frame 슬롯 드롭의 redo 가 ref 직접 children 으로 훼손** — 슬롯(ref-descendants)으로 요소를 드롭 후 undo→redo 하면 요소가 `RefNode.descendants[path].children` 이 아니라 **ref 노드의 직접 `children`** 으로 들어간다. 원인은 `buildCanonicalMoveEvents` 의 to 해석이 descendants 좌표를 표현하지 못하는 알려진 한계 (본문 주석 "대상은 일반 트리 노드 전용 — ref override 내부 노드 금지"). **단일 드래그 대조군으로 동일 재현 확증** — 다중 경로가 만들거나 악화시킨 것 아님 (동형). 후속 수정 대상: move event 에 ref-descendants 좌표 확장 또는 슬롯 드롭의 replace-event 기록.

### 4.2 Phase 2 구현 기록 (2026-08-12)

**구현 형태**:

- `PageGestureOwner.pageIds` (리더 포함 집합 — 리더가 항상 첫 요소로 정규화) + `tryClaimPage`/`promoteElementToPage` 4번째 인자. pointer 당 owner 1 계약(HC1) 유지 — owner 가 집합을 보유.
- presentation `activePageId/activeOverride` → **`activeOverrides: ReadonlyMap`** (드래그 대상 수만큼의 소집합 — R3 전체 map clone 금지 유지). `begin(canonical, pageIds[], bp)` / `publish(positions[])` (프레임당 1회 — ADR-176 G2). `readPagePosition/Delta` 소비자 10곳은 함수 경유라 무수정 호환.
- `usePageDrag`: 리더 위치(스냅 포함)의 델타를 전 대상이 공유 (Figma 동형). finish 는 단일=`updatePagePosition` / 다중=**`updatePagePositionsBatch`** (elements.ts 신설 — set 1회 + canonical batch 1회 + ADR-177 `pagePositionEvent.entries[]` entry 1개 + persist 1회, 리뷰 round 1 lock 그대로).
- 페이지 다중 선택 진입: **타이틀 shift 클릭 = 그 페이지 body 를 선택에 직접 토글** (body 는 `resolveClickTarget` 을 통과하지 못해 `handleElementClick` 경유 시 `handleUnresolvedTarget` 단독 대체+페이지 전환으로 빠짐 — 직접 `setSelectedElements` 토글이 `selectResolvedTarget` shift 분기와 같은 계약). cross-page body 다중 선택은 기존 selection 모델이 이미 수용.
- 승격 3지점(타이틀/엣지 핸들/빈 영역)이 `resolveSelectedPageIds`(전 선택이 body 일 때만 pageId 집합) 로 집합 전달 — 잡은 페이지가 리더.

**live 검증 (Chrome MCP)**: 페이지 body 선택 → 다른 페이지 타이틀 shift 클릭 → [body, body] cross-page 다중 (currentPageId 무변경) → 타이틀 드래그 → **두 페이지 동일 델타 (+123.05, +152.8) 동시 이동** → 카운터 +1 (batch entry 1) → Cmd+Z 1회 전체 복귀 → redo 재적용 → IndexedDB 문서 `pagePositions` 두 페이지 모두 breakpoint 별 batch 기록 추종.

**발견 1건 — [사전 결함, 본 phase 에서 실동작 해소] element gesture 세션 잔류**: `useViewportControl`/중앙 핸들러가 pointerdown 마다 `beginPointer`(element) 로 세션을 열지만 element 세션은 pointerup 에서 아무도 `endPointer` 로 닫지 않는다 — 같은 pointerId 로 잔류해 **`tryClaimPage` 가 첫 press 이후 구조적으로 실패** (2026-08-12 계측 실측: 타이틀 클릭이 reload 직후에만 성공). 타이틀 경로에 `promoteElementToPage` fallback (정확히 이 상태를 승격하는 기존 API) 을 연결해 타이틀 드래그가 항상 동작하게 됨 — 단일 타이틀 드래그의 간헐 실패도 함께 해소. 잔류 자체의 근본 정리 (element 세션의 pointerup 해제 계약) 는 후속 대상.

**후속 다듬기 (기록)**: 다중 드래그 finish 후 `setCurrentPageId`(리더) 의 page activation patch 가 다중 선택을 리더 body 단독으로 대체한다 — 이동은 완성되나 연속 다중 드래그엔 재선택 필요. 선택 보존은 page activation 의 선택 대체 정책과 얽혀 별도 판단.
