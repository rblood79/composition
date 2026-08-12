# ADR-178: 캔버스 다중 선택 이동 — 요소·페이지 멀티 드래그 + 이동 modifier

## Status

Accepted — 2026-08-12 (리뷰 round 1 승인 — [reviews/178.md](reviews/178.md), 이슈 2건 전부 fixed)

## Context

2026-08-12 이동 기능 gap 실측 — 캔버스 드래그 파이프라인이 **구조적으로 단일 대상**이다:

- 요소: `useDragBridge.ts:313` 이 항상 `selectedElementIds[0]` 하나만 이동시키고, 드래그 시각 오프셋이 전역 단일 슬롯 (`skia/nodeRendererTree.ts:37, 60-83` — `{elementId, dx, dy}` 1건) 이라 여러 요소가 동시에 움직일 수 없다.
- 페이지: `canvasGestureSession.ts:32` 의 `pageOwner` 가 단수, transient presentation 도 `activeOverride` 1건 (`pagePositionPresentation.ts:16-17`, ADR-176 O(1) 계약) — 다중 페이지 이동 표현 자체가 불가.
- modifier: 캔버스 포인터 경로에 `altKey` 사용 0건 (Alt 드래그 복제 없음 — 복제는 Cmd+D 만), 드래그 중 `shiftKey` 축 고정 없음 (`usePageDrag.ts:127-152` 는 PointerEvent 를 받지 않아 modifier 접근 경로가 구조적으로 부재).
- 잠재 엣지: `useCentralCanvasPointerHandlers.ts:232-240` 이 선택 1개일 때만 body 가드를 세워, 다중 선택에 body 가 섞이면 첫 요소가 드래그되는 우회가 있다.

Figma/Pencil 은 다중 선택 드래그·Shift 축 고정·Alt 드래그 복제가 이동의 기본 문법이다. 요소 이동의 기본 모델(flow = 순서 변경/재부모화, absolute = left/top, 페이지 = 자유 배치)은 이미 견고하므로 — deferred commit, drop indicator, Esc 취소, dead-zone 전부 구현 확인 — 본 ADR 은 그 모델 위에 **대상을 집합으로 확장**하는 결정이다.

**3-domain**: builder-system 인터랙션 — D1/D2/D3 무관 (document 스키마 무변경).

### Hard Constraints

1. **ADR-176 owner 계약 승계** — pointer 당 gesture owner 1 은 유지하고 owner 가 대상 **집합**을 보유하도록 확장한다 (계약 반전 아님). transient publish 프레임당 1회, canonical commit 은 finish 1회 유지.
2. **deferred commit 유지** — 드래그 중 store 무변경, 드롭 시 canonical **batch** move 1회 + 히스토리 1 entry (대상별 N 회 mutation 금지 — Cmd+Z 1회로 전체 복귀).
3. 60fps — 오프셋 다중화의 프레임 비용은 대상 수 비례 상한, 전체 맵 clone 금지 (ADR-176 HC10 동형).
4. 대상 집합 정규화 — 조상 포함 시 자손 제외 (이중 이동 방지), body 혼합 선택의 기존 엣지를 함께 폐쇄.
5. modifier 는 기존 의미와 충돌 금지 — Shift 클릭(다중 선택 토글)·Shift 스크롤은 유지, 축 고정은 **드래그 중** 컨텍스트 한정.

### Soft Constraints

- 기존 `resolveSelectionDragIntent`/`resolveMultiDragTargets` 류 단일 진입점 패턴 유지 (판정 함수는 훅 밖, 테스트 가능).
- Alt 복제는 기존 duplicate 액션 재사용 (복제 경로 신설 금지).

## Alternatives Considered

### 대안 A: 오프셋 다중화 + 드롭 시 batch canonical move

- 시각 오프셋 단일 슬롯 → Map, 드롭 시 리더 기준 타겟 판정 + 전 대상 유효성 검사 + batch move 1회. 페이지는 gestureSession/presentation 의 대상 집합 확장.
- 위험: 기술(M — 오프셋 소비자 3곳 확장) / 성능(M — 대상 수 비례, 상한 관리) / 유지보수(M) / 마이그레이션(L — 스키마 무변경)

### 대안 B: 드래그 시작 시 임시 그룹(Frame) 생성 후 단일 이동

- 다중 선택을 Frame 으로 감싸 기존 단일 드래그를 재사용, 종료 시 해제.
- 위험: 기술(M) / 성능(L) / **유지보수(H — 드래그가 canonical 구조 mutation 을 유발: 히스토리에 그룹 생성/해제 노이즈, 취소·크래시 시 임시 구조 잔류 위험)** / 마이그레이션(M)

### 대안 C: 리더만 시각 이동, 드롭 시 나머지 일괄 적용

- 위험: 기술(L) / 성능(L) / 유지보수(L) / **UX 왜곡 H — 드래그 중 나머지 대상이 제자리에 남아 Figma/Pencil 기대와 정면 불일치, "무엇이 움직이는지" 피드백 실패**

### Risk Threshold Check

| 대안 | HIGH+ 요약                          | 판정            |
| ---- | ----------------------------------- | --------------- |
| A    | 없음 (전 축 L/M)                    | **통과 — 채택** |
| B    | 유지보수 H (드래그의 구조 mutation) | 실패            |
| C    | UX H (이동 피드백 실패)             | 실패            |

## Decision

**대안 A 채택.**

1. 드래그 시작 시 대상 집합을 정규화(조상 우선, body 분리)하는 단일 진입점을 두고, 시각 오프셋을 Map 으로 확장해 전 대상이 같은 델타로 움직인다.
2. 드롭은 리더 기준 타겟 판정 → 전 대상 유효성 검사 → canonical batch move 1회 + 히스토리 1 entry. absolute/flow 혼합 집합은 대상별 현행 규칙(absolute=left/top, flow=순서/재부모화)을 유지한다.
3. 페이지 다중 드래그는 gestureSession owner 의 대상 집합 확장 + presentation 다중 override 로 같은 계약을 따른다.
4. 이동 modifier 를 함께 도입한다 — 드래그 중 Shift 축 고정, pointerdown Alt 복제 후 복제본 드래그 (복제+이동 = 히스토리 1 entry).

기각 사유 — B: 드래그라는 transient 행위가 canonical 구조를 두 번 mutate 하는 설계는 취소·크래시 경로에서 임시 구조 잔류 위험과 히스토리 노이즈를 남긴다. C: 다중 이동의 목적(전 대상 동시 피드백) 자체를 포기하는 안이다.

> 구현 상세: [178-multi-select-move-breakdown.md](design/178-multi-select-move-breakdown.md)

## Risks

| ID  | 위험                                                                                                                                                                    | 심각도 | 대응                                                                                                                     |
| --- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------- | :----: | ------------------------------------------------------------------------------------------------------------------------ |
| R1  | 오프셋 다중화의 프레임 비용 — 소비자 3곳이 대상 수 비례로 늘어남 (`nodeRendererTree.ts` 오프셋 조회, `renderCommands.ts` top-layer 재방문, `dragAnimator.ts` 형제 벌림) |  HIGH  | Map 조회 O(1) 유지 + top-layer 재방문 대상 상한 + G3 프레임 비용 실측 (대상 10/50 tier)                                  |
| R2  | cross-container 드롭에서 일부 대상만 유효 (부모-자식 동시 선택, projected id, 자기 자신으로 드롭) — 부분 적용 시 데이터 불일치                                          |  MED   | 정규화(조상 우선) + 전 대상 유효성 사전 검사 — 불가 시 동작을 Phase 0 에서 Figma 실측 후 lock (전체 취소 vs 가능 대상만) |
| R3  | 페이지 다중 override 가 ADR-176 O(1) presentation 계약(전체 map clone 금지)을 깨뜨림                                                                                    |  MED   | override 를 소집합 Map 으로 한정 (선택 페이지 수 ≤ 전체) + ADR-176 G2 프레임당 publish 1회 재검증                        |
| R4  | modifier 충돌 — Shift 클릭 다중 선택/Alt 브라우저 기본 동작과의 간섭                                                                                                    |  LOW   | 클릭(무이동)과 드래그(threshold)의 시점 분리 + preventDefault 범위 한정 (G2)                                             |

## Gates

| Gate | 통과 조건                                                                                                                 |
| ---- | ------------------------------------------------------------------------------------------------------------------------- |
| G1   | live: 요소 2+개 선택 드래그 → 전 대상 동일 델타 이동 + Cmd+Z 1회 전체 복귀. body 혼합 선택 드래그 엣지 재현 불가 확인     |
| G2   | live: 페이지 2개 동시 드래그 + Shift 축 고정 좌표 실측 + Alt 복제(원본 잔류, undo 1회) — 기존 Shift 클릭 다중 선택 회귀 0 |
| G3   | 드래그 프레임 비용 — 대상 10/50 tier 에서 프레임당 오프셋 갱신 1회 + 전체 map clone 0 (ADR-176 G2 동형 카운터)            |
| G4   | type-check + 정규화/유효성 판정 유닛 테스트 + `docs/CHANGELOG.md` 갱신 (Implemented 승격 시)                              |

## Phase 진행 로그

| Phase | 내용                                                | 상태                                                                                                                                                                                                                                                |
| ----- | --------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 0     | inventory freeze                                    | **Implemented 2026-08-12** — 오프셋 소비자 5곳 전수(Tree 경로 미소비 확인) + batch 전례(`applyElementOrderCanonicalPrimary`·`runInTransaction` 1-entry 병합) + body 혼합 엣지 코드 추적 + R2 lock (자신·자손 후보 제외 + 전체 취소). breakdown §2.1 |
| 1 | 요소 다중 드래그 (정규화 + 오프셋 Map + batch move) | **Implemented 2026-08-12** — `resolveMultiDragTargets` 정규화 + 오프셋 Set(공유 델타) + top-layer 다중 유예 + `moveElementsToCanonicalTarget` batch + body 엣지 폐쇄. live: batch 연속 삽입 + entry 1개 + Cmd+Z 1회 원순서 복원 (track 내림차순 기록). 사전 결함 1건 기록 — 슬롯 드롭 redo 훼손 (단일 경로 동형, breakdown §4.1) |
| 2 | 페이지 다중 선택·드래그 | **Implemented 2026-08-12** — owner `pageIds` 집합 + presentation `activeOverrides` 소집합 Map (R3 유지) + `updatePagePositionsBatch` (ADR-177 batch entry 1개). 타이틀 shift 클릭 = body 직접 토글 (cross-page 다중). live: 2 페이지 동일 델타 + Cmd+Z 1회 전체 복귀 + 문서 batch 추종. 사전 결함 해소 동반 — element 세션 잔류로 tryClaimPage 상시 실패 → promote fallback (breakdown §4.2) |
| 3 | modifier (Shift 축 고정 + Alt 복제) | **Implemented 2026-08-12** — `dragModifiers.ts` (applyAxisLock 순수 함수 + Alt arm 플래그). 요소=드롭 판정 좌표까지 일괄 고정, 페이지=리더 델타 고정 (다중 동반). Alt 복제 = 기존 duplicate 파이프라인 재사용, trackMultiPaste entry 1개 (복제+이동 합산, undo 1회). live: y 불변 실측 + 원본 잔류 + undo 1회 전체 취소 (breakdown §4.3) |
| 4     | 검증 종결 (성능 + CHANGELOG)                        | 미착수                                                                                                                                                                                                                                              |

## Consequences

### Positive

- 다중 선택 이동·축 고정·Alt 복제로 Figma/Pencil 의 이동 문법과 체감 격차가 닫힌다.
- body 혼합 선택 엣지가 정규화 규칙으로 함께 폐쇄된다.

### Negative

- 드래그 파이프라인의 상태가 단일 → 집합으로 넓어져 취소/정리 경로 테스트 표면이 늘어난다.
- 오프셋 소비자 3곳의 계약이 바뀌므로 회귀 감시(정적 가드 + live)가 필요하다.
