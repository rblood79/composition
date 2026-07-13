# ADR-043: Selection Drag Alignment - Pencil 패턴 기반 선택 이동 정렬

## Status

Implemented — Phase 0~6 전체 완료 (2026-03-30). 후속 ADR-049에서 Pencil 패턴 완성 (Phase A~D).

## Date

2026-03-24

## Decision Makers

composition Team

## Related ADRs

- [ADR-003](003-canvas-rendering.md): PixiJS Canvas Rendering
- [ADR-035](035-workspace-canvas-refactor.md): Workspace Canvas Runtime Refactor
- [ADR-037](037-workspace-scene-runtime-rearchitecture.md): Workspace Scene Runtime Rearchitecture
- [ADR-039](039-page-scoped-rendering.md): Multi-page Canvas Page-Scoped Rendering
- [ADR-040](040-visible-page-delta-runtime.md): Visible Page + Delta Runtime
- [Workspace Selection Drag Breakdown](../design/workspace-selection-drag-breakdown.md): 실행 설계

---

## Context

composition의 selection drag는 이미 부분적으로 구현되어 있다. 특히 `useDragInteraction.ts`에는 move/resize/lasso의 드래그 상태와 deferred commit에 가까운 흐름이 존재한다. 다만 Pencil의 selection drag 패턴과 완전히 정렬되어 있지는 않다.

Pencil 쪽 패턴은 다음과 같다.

1. 드래그 시작 시 아이템이 원래 자리에서 즉시 빠져나간 것처럼 보인다.
2. 인접 요소 사이로 끌어가면 아이템이 부드럽게 사이에 삽입된다.
3. 인접하지 않은 위치에서는 가이드라인이 drop 위치를 유도한다.
4. 실제 commit은 drop 시점에만 발생한다.

composition는 여기서 한 단계 더 복잡하다.

1. 선택 및 이동은 PixiJS 레이어에서 시작한다.
2. 실제 렌더는 Skia(CanvasKit) 오버레이가 담당한다.
3. 렌더된 요소의 실제 위치는 PixiJS display object가 아니라 Skia 계산 결과가 기준일 수 있다.
4. Pixi-only hit test로는 렌더 좌표와 이벤트 영역이 어긋날 수 있다.

### Hard Constraints

1. 60fps 상호작용을 유지해야 한다.
2. 기존 drag/resize/lasso 동작과 하위 호환해야 한다.
3. multi-page 정합성을 깨면 안 된다.
4. history 기록 시점은 drag move가 아니라 drop commit이어야 한다.
5. drop target 탐색은 Skia-derived bounds를 source of truth로 사용해야 한다.
6. 기존 요소 트리 이동 로직과 충돌하면 안 된다.

---

## Alternatives Considered

### 대안 A: 현행 `useDragInteraction` 중심의 점진 확장

- 설명: 현재의 부분적 deferred commit 흐름을 유지하면서 hit test와 guide line만 보강한다.
- 위험: 기술(M) / 성능(L) / 유지보수(M) / 마이그레이션(L)
- 장점: 기존 코드 변경이 작고 즉시 적용 가능하다.
- 단점: Pixi/Skia 좌표 차이와 tree reorder/reparent의 책임 경계가 계속 흐려질 수 있다.

### 대안 B: SelectionBox + Skia bounds 계약으로 drag lifecycle 재정렬

- 설명: SelectionBox가 drag shell이 되고, Skia-derived bounds를 기준으로 hit test, insertion, guide line, commit을 분리한다.
- 위험: 기술(M) / 성능(M) / 유지보수(L) / 마이그레이션(M)
- 장점: Pencil과 가장 유사하고, 책임 경계가 명확하다.
- 단점: Skia bounds 계약과 render state 계약을 새로 고정해야 한다.

### 대안 C: 중앙 Pointer Session으로 완전 통합

- 설명: 중앙 canvas handler가 selection drag, resize, lasso, guide line, commit을 모두 관장한다.
- 위험: 기술(H) / 성능(M) / 유지보수(M) / 마이그레이션(H)
- 장점: 이벤트 흐름이 하나로 모인다.
- 단점: 기존 SelectionBox/Skia 구조와의 결합도가 커지고, migration 비용이 높다.

### Risk Threshold Check

| 대안  | 기술  | 성능 | 유지보수 | 마이그레이션 | 판정                                   |
| ----- | ----- | ---- | -------- | ------------ | -------------------------------------- |
| A     | M     | L    | M        | L            | 보수적이지만 좌표 불일치 해소가 불완전 |
| **B** | M     | M    | **L**    | M            | **채택**                               |
| C     | **H** | M    | M        | **H**        | 과도한 통합                            |

---

## Decision

**SelectionBox를 Pencil-style selection drag의 시작점으로 사용하고, drag 중에는 시각적 오프셋만 갱신하며, drop 시점에만 요소 props를 커밋하는 deferred-commit 패턴을 채택한다.**

### Decision Rationale

1. SelectionBox는 이미 selection shell이므로, move gesture의 시작점으로 두는 것이 구조적으로 자연스럽다.
2. PixiJS는 입력 shell, Skia는 geometry source of truth로 분리하는 편이 좌표 불일치를 가장 직접적으로 해소한다.
3. 현재 `useDragInteraction.ts`의 부분적 패턴을 유지하면서도, commit 기준과 guide line 규칙을 명확히 분리할 수 있다.
4. 중앙 Pointer Session으로 전면 통합하는 것보다 migration risk가 낮고, 기존 resize/lasso와의 충돌도 작다.
5. Skia-derived bounds로 hit test를 전환하면 rendered element와 event region mismatch 문제를 피할 수 있다.
6. Phase 2/3에서 판정이 불안정하면 즉시 `useDragInteraction.ts`의 기존 부분적 deferred-commit 경로로 안전 복귀할 수 있어, 대안 A 수준의 보수적 동작을 유지할 수 있다.

### Design Scope

- drag start vacate
- adjacent insertion
- guide line fallback
- Skia-derived hit test
- deferred commit

세부 구현 phase와 파일 경계는 [Workspace Selection Drag Breakdown](../design/workspace-selection-drag-breakdown.md)에서 관리한다.

---

## Consequences

### Positive

- 드래그 중 store churn을 줄일 수 있다.
- PixiJS/Skia 좌표 차이를 명시적으로 관리할 수 있다.
- selection move와 tree reorder/reparent의 책임 경계가 분명해진다.
- Pencil과 유사한 insertion/guide line UX를 구현할 수 있다.

### Negative

- Skia-derived bounds 계약을 별도로 유지해야 한다.
- selection visual state와 commit state가 분리되어 디버깅 포인트가 늘어난다.
- multi-selection과 absolute/relative layout 요소는 별도 규칙이 필요하다.

---

## Gates

| 시점    | 조건                            | 통과 기준                                     | 실패 시 rollback 범위 |
| ------- | ------------------------------- | --------------------------------------------- | --------------------- |
| Phase 0 | 좌표계와 source of truth 정의   | Pixi는 shell, Skia는 geometry로 문서화 완료   | 문서만 롤백           |
| Phase 1 | drag lifecycle 연결             | drag start vacate와 deferred commit 분리 확인 | Phase 1 변경만 롤백   |
| Phase 2 | Skia bounds hit test            | rendered bounds와 drop candidate 일치 확인    | Phase 2 변경만 롤백   |
| Phase 3 | adjacent insertion / guide line | 인접 삽입과 guide line 우선순위 확인          | Phase 3 변경만 롤백   |
| Phase 4 | commit path                     | drop 시점에만 store/history 기록 확인         | Phase 4 변경만 롤백   |
| Phase 5 | regression gate                 | 60fps와 multi-page 정합성 유지 확인           | 전체 phase 재평가     |
