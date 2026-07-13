# Workspace Selection Drag Breakdown

## Purpose

이 문서는 [ADR-043](../completed/043-selection-drag-alignment.md)을 실행 가능한 작업 단위로 분해한 상세 플랜이다.
이 문서가 실제 구현 기준 문서이며, ADR은 결정과 제약만 유지한다.

목표는 다음과 같다.

- Pencil 스타일 selection drag lifecycle을 composition에 이식
- PixiJS 인터랙션과 Skia 렌더 좌표를 분리
- drag start vacate, adjacent insertion, guide line fallback을 명시적 규칙으로 고정
- 기존 요소 트리 이동 기능과 충돌하지 않게 구현 경계를 분리

---

## Pre-code Readiness

이 섹션의 체크리스트가 완료되기 전에는 코드 구현을 시작하지 않는다.

### 1. 행동 기준 고정

- [x] Pencil에서 확인한 행동을 composition 용어로 다시 적어둠
  - **drag start vacate**: 드래그 시작 시 원래 위치에 "빈 자리" 표시 (opacity 감소 또는 placeholder)
  - **adjacent insertion**: 인접 형제 요소 사이로 끌면 삽입 위치 표시 (drop indicator line)
  - **guide line fallback**: 인접하지 않은 위치에서는 가이드라인으로 drop 위치 유도
- [x] drag start vacate, adjacent insertion, guide line fallback의 우선순위를 확정함
  - 우선순위: **adjacent insertion > guide line fallback > vacate visual**
  - adjacent insertion이 감지되면 guide line은 표시하지 않음
- [x] single selection과 multi selection의 동작 차이를 문서화함
  - **single**: 개별 요소를 드래그하여 형제 간 reorder 또는 다른 컨테이너로 reparent
  - **multi**: Phase 1에서는 단일 선택만 지원. multi selection drag는 후속 Phase에서 확장
- [x] body/page root는 move 대상에서 제외한다는 점을 확정함
  - body 요소는 드래그 불가 (페이지 루트)
  - layout body도 드래그 불가

### 2. 좌표계/geometry 계약 고정

- [x] PixiJS는 interaction shell, Skia는 geometry source of truth로 합의함
- [x] `clientX/clientY` 기반 좌표와 scene-local 좌표를 분리함
  - **clientX/clientY**: 브라우저 viewport 기준 — pointer event에서 수신
  - **scene-local**: Camera transform(pan/zoom) 적용 후 캔버스 좌표 — `toScenePoint(clientX, clientY)` 변환
  - **element-local**: Taffy layout 결과의 상대 좌표 — 부모 기준 x/y
- [x] drop target 탐색은 Skia-derived bounds만 사용함
  - **현재 문제**: `elementRegistry.getElementBounds()`가 `container.getBounds()`(PixiJS 글로벌 좌표)를 반환 → Camera transform 포함 → scene-local과 불일치
  - **해결**: `layoutBoundsRegistry`의 Taffy 계산 결과(scene-local)를 source of truth로 사용
  - `hitTestPoint()`(WASM spatialIndex)는 이미 layout bounds 기반 → 올바른 경로
- [x] Pixi display object bounds는 drop candidate 계산에 사용하지 않음
  - `container.getBounds()`는 글로벌 좌표이므로 drop candidate에 부적합
  - `layoutBoundsRegistry`의 값만 사용
- [x] page offset, zoom, pan이 commit delta에 미치는 영향을 정리함
  - drag delta는 **scene-local 좌표계**에서 계산 (zoom 보정 후)
  - commit 시 delta를 요소의 style.left/top 또는 order_num에 반영
  - **flow element**: order_num 변경 (reorder) — delta 자체는 시각적 오프셋만
  - **absolute element**: style.left/top에 delta 직접 반영

### 3. 통합 전략 고정

- [x] `useDragInteraction.ts`는 유지하고 확장한다는 방침을 확정함
  - 이미 startMove/startResize/startLasso + RAF 스로틀 + deferred commit 패턴이 준비됨
- [x] move만 Selection drag resolver로 재정렬하고 resize/lasso는 기존 경로를 유지함
- [x] existing deferred commit 패턴을 폐기하지 않고 확장함
  - `onDragUpdate` 콜백: React state 없이 PixiJS 직접 조작 (SelectionBox.updatePosition)
  - `onMoveEnd` 콜백: drop 시점에만 store/history commit
- [x] SelectionBox는 drag shell, resolver는 geometry contract, store는 commit contract로 분리함
  - **SelectionBox**: 시각적 드래그 피드백 (updatePosition imperative handle)
  - **Resolver**: layoutBoundsRegistry 기반 drop target/insertion index 계산
  - **Store**: onMoveEnd에서만 요소 이동/reorder commit
- [x] `useDragInteraction.ts` 내부 snapshot 생성과 resolver 연결 지점을 확정함
  - `startMove()` 시점: 현재 선택 요소의 bounds snapshot 캡처
  - `updateDrag()` 시점: delta로 resolver에 drop candidate 쿼리
  - `endDrag()` 시점: resolver 결과로 store commit

### 4. 파일 경계 고정

- [x] 1차 수정 대상 파일 목록을 확정함
  - `useDragInteraction.ts` — move 경로에 resolver 연결
  - `useCentralCanvasPointerHandlers.ts` — pointerdown에서 startMove 호출 연결
  - `SelectionBox.tsx` — updatePosition imperative handle 활용
  - `selectionModel.ts` — Skia bounds 기반 drop target resolver 추가
  - `dropIndicatorRenderer.ts` — 기존 Skia drop indicator 활용/확장
  - `elementRegistry.ts` — layoutBoundsRegistry 기반 bounds 조회 보강
- [x] 수정하지 않을 파일 목록도 함께 확정함
  - `BuilderCanvas.tsx` — 기존 이벤트 구조 유지
  - `DirectContainer.tsx` — layout 배치 경로 유지
  - `ElementSprite.tsx` — 렌더링 경로 유지
  - Skia nodeRenderers — 렌더링 경로 유지
- [x] store/history 변경과 renderer 변경을 같은 phase에 섞지 않음
- [x] tree interop와 guide line 렌더를 같은 phase에 섞지 않음
- [x] `useDragInteraction.ts`를 Phase 1의 인접 파일로 포함할지 확정함 → **포함**
- [x] `BuilderCanvas.tsx`, `SelectionLayer.tsx`, `selectionHitTest.ts`를 상위 조율 파일로 명시함 → **확인**

### 5. 회귀 기준 고정

- [x] 60fps 기준을 baseline 대비 비교 가능한 형태로 기록함
  - baseline: 현재 선택/클릭 시 60fps 유지 (drag 미구현이므로 drag 비교는 불가)
  - 목표: drag 중 평균 frame time < 16.7ms
- [x] history 기록 시점을 drop commit으로 제한함
  - drag 중: store mutation 없음, history 기록 없음
  - drop 시: onMoveEnd 콜백에서 단일 history 기록
- [x] multi-page 정합성 검증 시나리오를 문서화함
  - 같은 페이지 내 요소 이동: order_num 변경
  - 다른 페이지로 이동: Phase 1에서는 불가 (같은 페이지 내만)
- [x] 기존 drag/resize/lasso 하위 호환 시나리오를 문서화함
  - resize: TransformHandle에서 startResize → 기존 경로 유지
  - lasso: 빈 영역 드래그 → startLasso → 기존 경로 유지
  - move: SelectionBox 내부 드래그 → startMove → **새 경로 (Phase 1)**

### 6. 구현 승인 기준

- [x] Phase 0 checklist가 완료됨
- [x] Phase 1~5의 완료 조건이 모두 명확함
- [x] open design questions에 대해 최소한의 정책 결정을 내림
  - **absolute vs flow**: absolute 요소는 style.left/top delta 반영, flow 요소는 reorder (order_num 변경)
  - **cross-container reparent**: Phase 1에서는 같은 부모 내 reorder만. reparent는 Phase 4
- [x] 구현 시작 전에 rollback 기준을 합의함
  - 각 Phase는 독립 커밋, 문제 시 해당 Phase만 revert
- [x] absolute positioned element와 flow/layout element의 drop semantics를 Phase 0에서 구분함
  - **absolute**: `position: absolute` 요소 → delta를 style.left/top에 반영
  - **flow**: `display: flex/grid/block` 내 요소 → insertion index로 order_num 변경
- [x] Phase 0에서 absolute/flow semantics가 결정되지 않으면 구현 진입을 보류함 → **결정 완료**

---

## 핵심 전제

### Source of Truth

이 기능에서 **드롭 타겟 탐색과 삽입 위치 계산의 기준은 Skia-derived bounds**다.

- PixiJS는 pointer event와 hit shell 역할만 한다.
- Skia는 실제 렌더된 요소의 위치와 크기를 제공한다.
- selection box는 Pixi로 이벤트를 받고, 실제 판단은 Skia bounds로 한다.

### 주요 동작

Pencil과 동일하게 아래 3가지를 지원해야 한다.

1. 드래그 시작 시 아이템이 원래 위치에서 즉시 빠져나간 것처럼 보인다.
2. 인접 요소 사이에 가까워지면 부드럽게 그 사이로 삽입된다.
3. 인접하지 않은 위치에서는 guide line이 나타나 drop 위치를 유도한다.

---

## Phase별 현황

| Phase | 설명                            | 위험 | 주요 목표                          |
| :---: | ------------------------------- | :--: | ---------------------------------- |
|   0   | Baseline & Interaction Contract |  L   | 좌표/히트/렌더 경계 정의           |
|   1   | Drag Session & Vacate           |  M   | drag start vacate, deferred commit |
|   2   | Skia Bounds Hit Test            |  M   | Skia-derived drop target 탐색      |
|   3   | Adjacent Insertion & Guide Line |  H   | insertion index + guide rendering  |
|   4   | Commit Path & Tree Interop      |  M   | move/reorder/reparent commit       |
|   5   | Verification & Regression Gates |  L   | 시나리오 검증, 회귀 방지           |

---

## Execution Strategy

### 의존 관계

```text
Phase 0
  ├─→ Phase 1 (drag lifecycle)
  ├─→ Phase 2 (Skia bounds hit test)
  │         └─→ Phase 3 (adjacent insertion / guide line)
  └─→ Phase 4 (commit path)
                     └─→ Phase 5 (verification)
```

### 실행 원칙

1. **Phase 0 먼저**
   - 좌표계와 hit-test 기준을 문서화하지 않으면, Pixi/Skia mismatch를 다시 만들 가능성이 높다.
2. **visual state와 store commit 분리**
   - drag 중 store mutation 금지
   - drop 시점에만 commit
3. **Skia bounds 우선**
   - 드롭 타겟, insertion index, guide line 모두 Skia geometry 기반
4. **tree interop 분리**
   - selection drag는 tree reorder/reparent의 한 경로일 뿐, 기존 tree move를 대체하지 않는다.
5. **phase당 1커밋**
   - 문제 발생 시 해당 phase만 rollback 가능해야 한다.

### 통합 전략

- 기존 `useDragInteraction.ts`는 유지한다.
- move는 selection drag resolver가 처리하고, resize/lasso는 기존 경로를 유지한다.
- 이미 존재하는 부분적 deferred commit 패턴은 폐기하지 않고 확장한다.
- SelectionBox는 drag shell, `useDragInteraction.ts`는 입력 상태 모델, Skia bounds resolver는 geometry contract로 분리한다.
- history 기록과 store commit은 Phase 4 이전에 SelectionBox로 끌어오지 않는다.

### 완료 판정 기준

- 60fps 유지 기준은 평균 frame time이 baseline 대비 유의미하게 악화되지 않아야 한다.
- drag 중 React state churn이 증가하지 않아야 한다.
- selection move가 resize/lasso와 충돌하지 않아야 한다.
- 구현 전후에 multi-page 선택이 동일한 의미를 가져야 한다.

---

## Phase 0. Baseline & Interaction Contract

### 목표

- drag / drop / guide line의 책임 경계 확정
- 좌표 변환 체계와 geometry source of truth 문서화

### 확인 대상

- `SelectionLayer` / `SelectionBox`
- `BuilderCanvas` central pointer handlers
- `elementRegistry` / `Skia selection renderer`
- `dropIndicatorRenderer`

### 계약 정의

| 항목            | 책임                     |
| --------------- | ------------------------ |
| pointer start   | PixiJS selection shell   |
| pointer delta   | canvas scene-local delta |
| geometry lookup | Skia-derived bounds      |
| visual offset   | transient render state   |
| commit          | store action / history   |

### 검증 포인트

- Pixi-only bounds를 쓰지 않는다는 사실이 문서로 명시됨
- drag start와 commit 시점이 분리됨
- guide line은 insertion candidate가 없을 때만 fallback으로 표시됨
- baseline FPS / frame time 비교가 가능함
- `BuilderCanvas.tsx` / `SelectionLayer.tsx` / `selectionHitTest.ts`가 Phase 0~2의 상위 조율 지점으로 문서화됨

---

## Phase 1. Drag Session & Vacate

### 목표

- selection drag 시작 시 아이템이 원래 위치에서 빠져나간 것처럼 보이는 상태를 만든다.

### 구현 포인트

1. pointerdown에서 drag session snapshot 생성
2. 선택 항목의 visual offset을 transient하게 적용
3. store mutation 없이 selection shell만 이동
4. pointerup/cancel에서 snapshot 정리

### 예상 작업 파일

- `apps/builder/src/builder/workspace/canvas/selection/SelectionBox.tsx`
- `apps/builder/src/builder/workspace/canvas/selection/useDragInteraction.ts`
- `apps/builder/src/builder/workspace/canvas/skia/nodeRendererTree.ts`
- `apps/builder/src/builder/workspace/canvas/skia/renderCommands.ts`
- `apps/builder/src/builder/workspace/canvas/skia/selectionRenderer.ts`

### 검증 포인트

- drag 시작 시 item이 즉시 빠져나간 것처럼 보임
- cancel 시 원위치 복귀
- single selection과 multi selection 모두 drag session을 공유
- history entry는 아직 생성되지 않음

---

## Phase 2. Skia Bounds Hit Test

### 목표

- drop target 탐색을 Pixi display object가 아니라 Skia bounds로 수행한다.

### 구현 포인트

1. rendered bounds를 기준으로 hover/drop candidate 수집
2. candidate의 parent/children 관계를 사용해 insertion index 계산
3. Skia bounds가 없으면 fallback하지 말고 안전하게 no-target 처리

### 예상 작업 파일

- `apps/builder/src/builder/workspace/canvas/elementRegistry.ts`
- `apps/builder/src/builder/workspace/canvas/hooks/useCanvasDragDropHelpers.ts`
- `apps/builder/src/builder/workspace/canvas/skia/dropIndicatorRenderer.ts`
- `apps/builder/src/builder/workspace/canvas/skia/renderCommands.ts`

### 검증 포인트

- 렌더된 위치와 drop candidate가 일치
- Pixi display object bounds와 달라도 잘못된 drop target을 만들지 않음
- page offset / zoom / pan이 반영된 scene-local 기준이 유지됨
- fallback 없이 no-target이 안전하게 처리됨

---

## Phase 3. Adjacent Insertion & Guide Line

### 목표

- 인접 요소 사이로 들어가면 부드러운 insertion, 비인접이면 guide line을 보여준다.

### 구현 포인트

1. candidate가 인접 범위인지 판정
2. 인접이면 insertion index를 갱신
3. 인접하지 않으면 guide line state를 활성화
4. guide line은 tree insertion candidate가 없음에도 drop 가능 영역을 설명해야 한다

### 설계 규칙

| 상황             | UI 반응                    | 상태                       |
| ---------------- | -------------------------- | -------------------------- |
| 인접 요소 사이   | item이 slot으로 흘러들어감 | insertion candidate active |
| 비인접 위치      | guide line만 표시          | guide-only                 |
| 유효 target 없음 | 아무 삽입도 하지 않음      | inactive                   |

### 검증 포인트

- adjacent insertion 시 시각적으로 끊기지 않음
- guide line은 drop 가능 위치를 오해 없이 보여줌
- tree reorder와 guide line의 상태가 충돌하지 않음
- insertion preview와 guide line의 우선순위가 명확함

---

## Phase 4. Commit Path & Tree Interop

### 목표

- drop 시점에만 실제 store mutation을 수행하고, tree reorder/reparent와 selection move를 정리한다.

### 커밋 규칙

1. move commit은 선택된 element에만 적용
2. absolute/relative/auto 등 layout contract가 다른 요소는 별도 처리
3. reparent/reorder가 필요하면 insertion index를 함께 commit
4. guide line fallback 상태는 commit 전에 해제

### 예상 작업 파일

- `apps/builder/src/builder/workspace/canvas/selection/SelectionBox.tsx`
- `apps/builder/src/builder/stores/utils/elementUpdate.ts`
- `apps/builder/src/builder/workspace/canvas/hooks/useCanvasDragDropHelpers.ts`
- `apps/builder/src/builder/workspace/canvas/hooks/useCentralCanvasPointerHandlers.ts`

### 검증 포인트

- store는 drop 시점에만 갱신됨
- history entry는 단일 commit으로 남음
- tree move와 selection move가 중복 commit되지 않음
- commit 시점의 selectedIds와 실제 props 반영이 일치함

---

## Phase 5. Verification & Regression Gates

### 수동 검증 시나리오

1. 단일 요소를 드래그하면 원래 위치에서 즉시 빠져나가는지 확인
2. 인접 요소 사이로 들어갈 때 insertion preview가 자연스럽게 바뀌는지 확인
3. 비인접 위치에서는 guide line이 나타나는지 확인
4. drop 후 실제 store 위치가 Skia 렌더 위치와 일치하는지 확인
5. cancel 시 원복되는지 확인
6. multi selection에서 상대 위치가 유지되는지 확인

### 회귀 게이트

- Pixi-only hit test 복귀 금지
- Skia bounds 없는 drop target 계산 금지
- drag 중 store mutation 금지
- guide line과 insertion preview가 동시에 active일 때 우선순위 명시
- baseline 대비 frame time 악화가 허용 범위를 넘지 않아야 함

---

## Phase Exit Checklist

### Phase 0

- [x] Pixi shell / Skia geometry / store commit의 책임이 구분됨
  - `dropTargetResolver.ts:8` — layoutBoundsRegistry source of truth 명시
- [x] 현재 `useDragInteraction`이 어떤 값을 소유하는지 문서화됨
  - startMove/updateDrag/endDrag/cancelDrag lifecycle
- [x] baseline frame time 기록 완료
  - drag 미구현 baseline — 선택/클릭 시 60fps 유지 확인
- [x] absolute positioned element와 flow/layout element의 drop semantics 결정 완료
  - absolute: style.left/top delta 반영, flow: order_num reorder

### Phase 1

- [x] drag start 시 visual vacate 확인
  - `SelectionLayer.tsx:177` — `selectionBoxRef.updatePosition(delta)` 시각적 오프셋
- [x] cancel 시 원복 확인
  - `useDragInteraction.ts:359` — `cancelDrag()` RAF 취소 + state 초기화
  - `SelectionLayer.tsx:287` — `resetPosition()` 호출
  - `useCentralCanvasPointerHandlers.ts` — Escape 키 핸들러 (Phase 5 추가)
- [x] store mutation이 발생하지 않음
  - `onDragUpdate` 콜백에서 ref만 갱신, React state/store 변경 없음

### Phase 2

- [x] rendered bounds를 기준으로 target을 찾음
  - `dropTargetResolver.ts:133-210` — `getElementBoundsSimple` (layoutBoundsRegistry)
- [x] Pixi bounds에 의존하지 않음
  - `container.getBounds()` 직접 호출 없음, scene-local 좌표만 사용
- [x] no-target fallback이 안전함
  - bounds/parent 없으면 `null` 반환, body 부모도 `null`

### Phase 3

- [x] adjacent insertion preview 확인
  - `dropIndicatorRenderer.ts:56-96` — dashed insertion line (자식 간 중점)
- [x] guide line fallback 확인
  - `dropIndicatorRenderer.ts:44-53` — 컨테이너 아웃라인 (blue-500)
- [x] 우선순위 충돌 없음
  - `isAdjacentInsertion` true 시 commit 스킵, indicator만 표시

### Phase 4

- [x] drop 시점에만 commit 발생
  - `SelectionLayer.tsx:210` — `onMoveEnd`에서만 store mutation
- [x] history entry가 1개만 생성됨
  - `SelectionLayer.tsx:236-244` — `addBatchDiffEntry` 1회
- [x] tree reorder/reparent 중복 없음
  - `computeReorderFromDropTarget` 변경 없으면 빈 배열

### Phase 5

- [x] resize/lasso 하위 호환 유지
  - `useDragInteraction.ts` startResize/startLasso 미변경
- [x] drag 중 store mutation 금지
  - `onDragUpdate`에서 ref만 갱신
- [x] Escape 키 드래그 취소
  - `useCentralCanvasPointerHandlers.ts` — keydown Escape → `onCancelDrag` 호출
  - `SelectionLayer.tsx` — cancelDrag + drop indicator 제거 + resetPosition
- [ ] 60fps 유지 — 수동 브라우저 검증 필요
- [ ] multi-page 정합성 유지 — 수동 브라우저 검증 필요

---

## Open Design Questions

1. multi selection에서 insertion preview를 group-wide로 할지, 대표 anchor 중심으로 할지
2. absolute positioned element와 flow/layout element의 drop semantics를 동일하게 볼지
3. guide line의 스타일을 selection renderer와 완전히 분리할지
4. parent insertion과 sibling reorder를 같은 resolver로 다룰지
