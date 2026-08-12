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

| 경로                                                                                         | 현재 동작                                                                                 | 관심사                                                     |
| -------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------- | ---------------------------------------------------------- |
| `apps/builder/src/builder/workspace/canvas/hooks/useDragBridge.ts:313`                       | `const draggedId = dragState.selectedElementIds[0]` — 첫 요소만 이동                      | 대상 집합화 진입점                                         |
| `apps/builder/src/builder/workspace/canvas/skia/nodeRendererTree.ts:37, 60-83`               | 드래그 시각 오프셋이 전역 단일 슬롯 `{elementId, dx, dy}`                                 | 오프셋 Map 화 — 렌더 비용 축                               |
| `apps/builder/src/builder/workspace/canvas/interaction/canvasGestureSession.ts:32, 74-112`   | `pageOwner` 단수 — `tryClaimPage`/`promoteElementToPage` 모두 단일 pageId                 | owner 의 대상 집합 확장                                    |
| `apps/builder/src/builder/workspace/canvas/interaction/pagePositionPresentation.ts:16-17`    | transient override 가 `activePageId` + `activeOverride` 1건 (ADR-176 O(1) 계약)           | 다중 override 로 확장하되 map clone 금지 계약 유지         |
| `apps/builder/src/builder/workspace/canvas/hooks/useCentralCanvasPointerHandlers.ts:232-240` | 선택이 정확히 1개일 때만 `selectedElement` 조회 — 다중 선택 + body 혼합 시 가드 우회 엣지 | 엣지 폐쇄 (본 ADR 에서 함께)                               |
| `apps/builder/src/builder/workspace/canvas/selection/dropTargetResolver.ts:443, 548+`        | 단일 요소 기준 drop 판정 (same-parent index / cross-container)                            | 다중 대상의 타겟 판정 규칙 (리더 기준 + 전 대상 유효성)    |
| `apps/builder/src/builder/workspace/canvas/skia/dragAnimator.ts`                             | 형제 벌림 애니메이션 — 단일 드래그 전제                                                   | 다중 시 벌림 대상 계산                                     |
| `apps/builder/src/builder/hooks/useGlobalKeyboardShortcuts.ts:331`                           | 다중 선택 시 화살표 순서 변경 no-op                                                       | (변경 없음 — 관찰만)                                       |
| 캔버스 포인터 경로 전체                                                                      | `altKey` 사용 0건, `shiftKey` 는 다중 선택 클릭/스크롤 용도                               | modifier 신설 — 기존 의미와 컨텍스트 분리 (드래그 중 한정) |
| `apps/builder/src/builder/workspace/canvas/hooks/usePageDrag.ts:127-152`                     | `calculatePosition(clientX, clientY)` — PointerEvent 미수신, modifier 접근 경로 없음      | 시그니처 확장 (Shift 축 고정 지점)                         |

## 3. 계약 설계

### 3.1 대상 집합 정규화

- 드래그 시작 시 `selectedElementIds` 를 정규화: **조상이 집합에 있으면 자손 제외** (이중 이동 방지), body/page 혼합 시 요소 집합에서 body 제외 + 전 선택이 body 뿐이면 페이지 다중 드래그로 승격.
- 정규화는 단일 진입점 함수 (`resolveMultiDragTargets` 류, `interaction/selectionModel.ts` 인접) — 테스트 가능하게 훅 밖.

### 3.2 이동/드롭

- 시각: 오프셋 단일 슬롯 → `Map<elementId, {dx,dy}>` (같은 델타지만 top-layer 재방문·dragAnimator 가 개별 조회). 프레임당 갱신 1회 (RAF 스로틀 현행).
- 드롭: 리더(포인터가 잡은 요소) 기준으로 타겟 판정 → 전 대상에 같은 타겟 적용 가능성 검사 (불가 대상 존재 시 전체 취소 또는 가능 대상만 — Phase 0 에서 Figma 동작 실측 후 lock) → canonical batch move 1회 + 히스토리 1 entry.
- absolute 요소 혼합 집합: absolute 는 left/top 델타, flow 는 순서/재부모화 — 리더 종류 기준으로 동작 분기하지 않고 **대상별 현행 규칙 유지**.

### 3.3 Modifier

- **Shift (드래그 중)**: 시작점 기준 |dx|>|dy| → 수평 고정, 반대는 수직. 페이지·absolute 요소·페이지 다중 드래그에 적용 (flow 드래그는 드롭 판정 좌표에 적용).
- **Alt/Option (pointerdown 시)**: 대상 집합 복제 → 복제본으로 드래그 전환 (원본 잔류). 복제는 기존 duplicate 액션 재사용 + 히스토리 1 entry (복제+이동 합산).
- 기존 Shift 클릭(다중 선택 토글)과 충돌 없음 — 클릭(무이동)과 드래그(threshold 초과)의 시점 분리.

## 4. Phase 분해

| Phase | 내용                                                                                                                                         | 산출 검증                                                            |
| ----- | -------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------- |
| 0     | inventory freeze — 오프셋 소비자 전수(top-layer/dragAnimator/renderCommands), drop 판정 경로, Figma 다중 드롭 동작 실측, body 혼합 엣지 재현 | 계약 표 + 엣지 재현 기록                                             |
| 1     | 요소 다중 드래그 — 정규화 + 오프셋 Map + batch move + body 혼합 엣지 폐쇄                                                                    | live: 2+ 요소 동일 델타 이동 + Cmd+Z 1회 복귀                        |
| 2     | 페이지 다중 선택·드래그 — gestureSession 대상 집합 + presentation 다중 override                                                              | live: 2 페이지 동시 이동, ADR-176 G2 계약(프레임당 publish 1회) 유지 |
| 3     | modifier — Shift 축 고정 + Alt 드래그 복제                                                                                                   | live: 축 고정 좌표 실측 + Alt 복제 → 원본 잔류 + undo 1회            |
| 4     | 검증 종결 — 성능(오프셋 Map 프레임 비용) + CHANGELOG                                                                                         | live behavior 게이트                                                 |
