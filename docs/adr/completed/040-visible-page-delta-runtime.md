# ADR-040: Visible Page + Delta Runtime — 전체 요소 교체에서 visible-page/delta 동기화 모델로 전환

## Status

Completed

## Date

2026-03-13

## Decision Makers

composition Team

## Related ADRs

- [ADR-009](009-full-tree-wasm-layout.md): Figma-Class Rendering & Layout
- [ADR-012](012-rendering-layout-pipeline-hardening.md): 렌더링/레이아웃 파이프라인 하드닝
- [ADR-035](035-workspace-canvas-refactor.md): Workspace Canvas Runtime 리팩토링
- [ADR-037](037-workspace-scene-runtime-rearchitecture.md): Workspace Scene Runtime 재구성
- [ADR-039](039-page-scoped-rendering.md): Multi-page Canvas Page-Scoped Rendering

---

## Context

`ADR-039`로 visible page 중심의 page-scoped rendering은 도입됐지만,
builder 상태 동기화는 여전히 여러 구간에서 `전체 elements 배열 교체`를 전제로 움직인다.

이 구조는 페이지 수가 늘어나거나 페이지당 요소 수가 커질수록,
렌더러보다 앞단의 상태 동기화와 패널 렌더가 다시 병목이 되는 문제를 만든다.

### 문제 1. `setElements(...)` 중심 전체 교체 경로가 여전히 존재한다

현재 builder는 다음 경로를 여전히 가진다.

- page load 시 IndexedDB/Cloud 결과를 전체 `elements`로 병합 후 `setElements(...)`
- preview/iframe 메시지 처리 중 `UPDATE_ELEMENTS` 수신 시 `setElements(...)`
- 일부 editor/property/layout 경로에서도 전체 배열 교체 사용

결과:

- 작은 변경도 `elementsMap`, `pageIndex`, `childrenMap`, selection 파생값 전부를 다시 흔든다.
- page-local delta가 document-wide state churn으로 증폭된다.
- 패널과 캔버스가 “변경량”이 아니라 “전체 배열 재평가”에 반응한다.

### 문제 2. page activation이 원자적이지 않다

현재 로그 기준으로, 어떤 페이지는 활성화 직후 `elementCount`가
`1 -> 8 -> 17 -> 31 -> 48`처럼 단계적으로 증가한다.

이 패턴은 다음을 뜻한다.

- 현재 페이지의 요소 집합이 한 번에 확정되지 않는다.
- 로딩/동기화/선택/preview ACK 이후의 후속 반영이 여러 번 발생한다.
- `LayersSection`, `NodesPanel`이 같은 페이지를 여러 번 무겁게 다시 렌더한다.

즉, page activation은 아직 “페이지 스냅샷 전환”이 아니라
“중간 상태를 포함한 점진적 hydration”에 가깝다.

### 문제 3. visible page 렌더링과 상태 동기화 모델이 분리되어 있다

`ADR-039`는 렌더 비용 모델을 visible page 중심으로 낮췄지만,
state propagation은 여전히 document-wide 업데이트 패턴을 유지한다.

결과:

- 렌더러는 visible page만 보려 해도,
- store와 패널은 전체 문서 상태 변경으로 다시 반응한다.

즉, 렌더 계층과 상태 계층의 비용 모델이 서로 다르다.

### 문제 4. preview ↔ builder 계약이 snapshot 중심이다

현재 preview 메시지 계약은 여전히 `UPDATE_ELEMENTS` 같은
전체 스냅샷 교체형 메시지에 크게 의존한다.

이는 다음 문제를 만든다.

- 작은 수정도 전체 페이지/문서 스냅샷 교체로 표현된다.
- message burst가 오면 builder 패널이 중간 상태를 모두 소비한다.
- 장기적으로 요소 1,000개 페이지, 10~50 page 문서에서 비용이 급격히 커진다.

### Hard Constraints

1. page/element 저장 포맷은 유지한다.
2. 기존 편집 UX는 유지한다.
3. compare mode, workflow overlay, text edit, selection을 깨지 않는다.
4. Pixi + Skia 조합은 유지한다.
5. 단계별 rollback 가능해야 한다.
6. 최종 목표는 “비용이 전체 문서 크기보다 visible page와 actual delta에 비례”하는 구조다.

---

## Alternatives Considered

### 대안 A. 현 구조 유지 + 패널/렌더 미세 최적화 반복

- 설명: `NodesPanel`, `LayersSection`, `PageTree`, `SkiaOverlay`를 계속 국소 최적화한다.
- 위험: 기술(L) / 성능(M) / 유지보수(H) / 마이그레이션(L)

장점:

- 바로 적용 가능하다.
- 일부 long task 수치는 줄일 수 있다.

단점:

- 전체 교체형 상태 모델은 그대로 남는다.
- 페이지 수와 요소 수가 커질수록 다시 병목이 드러난다.
- 패널/렌더 최적화가 구조 부채를 가리기만 한다.

### 대안 B. Visible Page + Delta Runtime으로 상태 계약까지 전환

- 설명: visible page만 소비하고, 변경은 delta로 전파하는 방향으로 builder/preview/store 계약을 재정의한다.
- 위험: 기술(M) / 성능(L) / 유지보수(L) / 마이그레이션(M)

장점:

- 렌더와 상태 계층의 비용 모델을 일치시킬 수 있다.
- page activation을 원자적으로 만들 수 있다.
- 요소 수가 큰 페이지에서도 “전체 교체” 없이 부분 반영이 가능하다.
- Figma/Pencil류 편집기의 일반적 아키텍처 원칙과 맞는다.

단점:

- 메시지 계약과 store API를 단계적으로 바꿔야 한다.
- 과도기에는 snapshot/delta 경로가 공존한다.

### 대안 C. preview/builder 동기화 자체를 제거하고 단일 런타임으로 통합

- 설명: iframe preview 계약을 줄이고 builder 내부 단일 상태계로 통합한다.
- 위험: 기술(H) / 성능(M) / 유지보수(M) / 마이그레이션(H)

장점:

- 이상적으로는 가장 단순한 상태 모델이 된다.

단점:

- 현재 제품 제약과 충돌한다.
- 회귀 위험이 너무 크다.
- 범위가 지나치게 커져 다른 작업을 막는다.

### Risk Threshold Check

- 대안 A는 임시 대응으로는 유효하지만, page/element 규모가 커질수록 다시 막힌다.
- 대안 C는 장기적으로 가능할 수 있으나 현재 제약에서 위험 한도를 넘는다.
- 대안 B가 구조적 개선과 단계적 이행의 균형점이다.

---

## Decision

**대안 B**를 채택한다.

즉, multi-page builder runtime은
**`visible page + delta update` 모델**로 단계적으로 전환한다.

핵심 결정은 다섯 가지다.

1. 전체 `setElements(...)` 교체를 주 경로에서 제거하고 delta 경로를 기본값으로 만든다.
2. page activation은 “중간 상태 다중 반영”이 아니라 “원자적 page snapshot 전환”으로 바꾼다.
3. preview ↔ builder 계약은 snapshot 메시지보다 delta 메시지를 우선 사용한다.
4. 패널은 전체 문서 배열이 아니라 current visible page snapshot만 소비하도록 더 엄격히 제한한다.
5. legacy snapshot fallback은 마지막 phase에서만 제거한다.

---

## Target Architecture

### 1. Page Activation as Atomic Commit

페이지 전환은 아래 단위로 한 번에 커밋된다.

- `currentPageId`
- `page snapshot`
- `pageIndex/elementsMap`의 page-local 변경분
- 선택 대상(body 또는 기존 선택 복원)

중간 상태에서 `elementCount`가 여러 번 늘어나는 구조를 허용하지 않는다.

### 2. Delta-First Message Contract

preview ↔ builder 간 요소 동기화는 아래 메시지를 기본값으로 한다.

- `DELTA_ELEMENT_ADDED`
- `DELTA_ELEMENT_UPDATED`
- `DELTA_ELEMENT_REMOVED`
- `DELTA_BATCH_UPDATE`

`UPDATE_ELEMENTS`는 bootstrap, hard resync, recovery 전용 fallback으로 제한한다.

### 3. Visible Page Snapshot

패널과 캔버스가 소비하는 기본 데이터는 아래다.

- current visible page element ids
- current page root/body
- page-local children map
- page-local selection context

전체 문서 배열은 저장/복구/디버그용 경로로만 남긴다.

### 4. Delta-Aware Store

store는 다음 성질을 가져야 한다.

- page-local add/update/remove가 전체 rebuild 없이 반영됨
- `pageIndex`, `childrenMap`, `elementsMap`이 delta 기준 증분 갱신됨
- `setElements(...)`는 recovery/bootstrap 외 사용 금지

### 5. Panel Isolation

`NodesPanel`, `LayersSection`, `PageTree`는 아래 조건을 만족해야 한다.

- current page가 바뀌지 않으면 page-local 요소 변경에만 반응
- current page가 바뀌면 새 page snapshot 1회만 반영
- 중간 hydration 상태를 여러 번 소비하지 않음

---

## Expected Performance Model

현재 문제는 “한 프레임을 조금 줄이기”보다
“동기화 모델 자체가 전체 문서 비용을 유발한다”는 점이다.

### 현재 비용 모델

- page add/select/delete
- 전체 또는 대규모 `elements` 갱신
- `pageIndex`/`elementsMap`/패널 파생값 다중 재평가
- 동일 page에 대한 중간 상태 반복 렌더

즉, 비용이 `total pages + total elements + sync bursts`에 가깝다.

### 목표 비용 모델

- page add: `new page shell + activation delta`
- page select: `target page snapshot 1회 commit`
- page edit: `affected elements delta`
- panel render: `current page + changed subtree`

즉, 비용이 `visible page + changed elements`에 가깝게 수렴해야 한다.

---

## Phased Plan

### Phase 0. Baseline & Contract Audit

작업:

1. 현재 `UPDATE_ELEMENTS`, `setElements`, page activation 경로 전부 목록화
2. page add/select/delete, page당 1/100/1000 요소 시나리오 baseline 수집
3. preview ↔ builder 메시지 계약의 snapshot/delta 사용 현황 문서화

성공 기준:

- 어떤 경로가 전체 교체인지, 어떤 경로가 delta인지 문서로 고정
- baseline 지표 확보
- baseline 문서: `docs/adr/040-phase-0-baseline.md`

### Phase 1. Snapshot Recovery / Delta Default 분리

작업:

1. `setElements(...)` 호출부를 `bootstrap/recovery`와 `interactive update`로 분리
2. interactive 경로에서 `UPDATE_ELEMENTS` 사용 금지
3. builder에서 iframe발 `UPDATE_ELEMENTS`를 hard resync 전용으로 제한

성공 기준:

- 편집 중 일반 상호작용이 전체 배열 교체를 사용하지 않음
- current page 패널 소비가 `pageElementsSnapshot` 기준으로 분리됨

### Phase 2. Atomic Page Activation

작업:

1. page activation을 단일 commit 함수로 정리
2. `currentPageId`, body selection, page snapshot 반영 시점을 하나로 묶음
3. 동일 page에서 `elementCount`가 단계적으로 증가하는 중간 상태 제거

성공 기준:

- page select/add 후 같은 page에 대해 panel render burst가 1회 수준으로 축소

### Phase 3. Delta-Aware Store API 정착

작업:

1. `addElement`/`updateElement`/`removeElement`/`batchUpdate`를 주 경로로 승격
2. `pageIndex`, `childrenMap`, `elementsMap` 증분 갱신 일관화
3. legacy `setElements` 의존 editor/property 경로를 delta API로 치환

성공 기준:

- page-local 수정이 전체 `elements` 교체 없이 완료

### Phase 4. Panel Snapshot Isolation

작업:

1. `NodesPanel`, `LayersSection`, `PageTree`를 current page snapshot 기준으로 단순화
2. panel render가 pageCount 변화와 current page subtree 변화만 소비하게 정리
3. tree virtualization/cache를 current page 기준으로 강화

성공 기준:

- 1000 element page에서도 panel render가 subtree/selection 변경 중심으로 제한

### Phase 5. Preview Contract Cleanup

작업:

1. preview runtime에서 snapshot 메시지 의존 제거
2. ACK/recovery/bootstrap 경로를 제외하고 delta 메시지만 사용
3. hard resync가 필요한 경우만 `UPDATE_ELEMENTS` 허용

성공 기준:

- preview ↔ builder 상호작용 기본 경로가 delta-only

### Phase 6. Legacy Removal & Perf Gate

작업:

1. interactive `setElements` fallback 제거
2. 불필요한 perf 계측과 임시 compatibility 코드 정리
3. 문서/테스트/운영 가이드 업데이트

성공 기준:

- visible page + delta update 모델이 기본 런타임 계약이 됨

---

## Measurement Gates

각 phase 완료 후 다음을 검증한다.

1. `pnpm -F @composition/builder type-check`
2. page add/select/delete smoke 테스트 통과
3. 현재 페이지 동일 기준에서 `elementCount` 단계 증가 burst가 제거되었는지 확인
4. 10/25/50 page, 100/1000 element 시나리오에서 long task slope 비교

핵심 지표:

- `pages.add-click`
- `pages.add.activate-next-frame`
- `pages.delete-click.total`
- `panel.nodes.render`
- `panel.layers.render`
- page activation 당 render burst 횟수
- interactive `setElements(...)` 호출 횟수

---

## Non-Goals

이번 ADR 범위에 포함하지 않는다.

- 저장 포맷 변경
- Pixi/Skia 단일 엔진 전환
- compare mode 재설계
- workflow 모델 자체 재설계
- iframe 제거

---

## Open Questions

1. hard resync 발생 조건을 어디까지 허용할지 명확화 필요
2. page activation 시 selection 복원 정책을 body 우선으로 고정할지 결정 필요
3. preview contract에서 delta batch granularity를 element 단위로 둘지 subtree 단위로 둘지 결정 필요
4. panel virtualization을 tree base 수준에서 공통화할지 page/layer 개별 최적화로 둘지 결정 필요

---

## References

- `apps/builder/src/builder/hooks/usePageManager.ts`
- `apps/builder/src/builder/hooks/useIframeMessenger.ts`
- `apps/builder/src/builder/stores/elements.ts`
- `apps/builder/src/builder/stores/elementLoader.ts`
- `apps/builder/src/builder/panels/nodes/NodesPanel.tsx`
- `apps/builder/src/builder/panels/nodes/LayersSection.tsx`
- `apps/builder/src/builder/panels/nodes/PagesSection.tsx`
- `apps/builder/src/preview/messaging/messageHandler.ts`
- `apps/builder/src/preview/utils/messageHandlers.ts`

## Implementation Notes

- 2026-03-13: `docs/adr/040-phase-0-baseline.md` 추가로 baseline 및 contract audit 고정
- 2026-03-13: `apps/builder/src/builder/stores/elements.ts`에 `pageElementsSnapshot` 캐시 도입
- 2026-03-13: `apps/builder/src/builder/stores/index.ts`의 `useCurrentPageElements()`를 current-page snapshot selector로 전환
- 2026-03-13: `apps/builder/src/builder/main/BuilderCore.tsx`에서 page 모드 iframe 동기화를 visible page snapshot 기준으로 축소
- 2026-03-13: `apps/builder/src/builder/stores/elements.ts`에 `activatePage()` 추가, `PagesSection` 삭제/선택 경로를 atomic page activation 패턴으로 정리
- 2026-03-13: `mergeElements()` 공용 액션 도입으로 layout 선택/적용, collection item 삭제, group/table editor의 interactive 전체 교체 경로 일부 제거
- 2026-03-13: `replaceElementId()` 추가로 temp-id -> persisted id 치환에서 interactive `setElements(...)` 제거
- 2026-03-13: `hydrateProjectSnapshot()` / `recoverElementsSnapshot()`로 full snapshot 경계를 bootstrap/recovery 전용 API로 명시
- 2026-03-13: `BuilderCore`의 iframe sync를 visible scope 기준 delta-first로 전환하고, scope 전환 시에만 full snapshot fallback을 유지
- 2026-03-13: `useElementCreator` / `ComponentsPanel`에서 요소 생성 직후 직접 `sendElementsToIframe(...)` 호출을 제거해 중복 full sync 경로 차단
- 2026-03-13: preview가 보내는 `ADD_COLUMN_ELEMENTS` / `ADD_FIELD_ELEMENTS`를 frame-batched `mergeElements()` 경로로 묶어 현재 페이지 hydration burst를 완화
- 2026-03-13: `LayersSection`과 `LayerTree`에서 current-page map / node map을 재사용하도록 정리해 선택 변경·자동 펼침 시 불필요한 재귀/선형 탐색을 제거
- 2026-03-13: `NodesPanel`에서 `LayersSection`을 deferred current page 기준으로 렌더해 page activation의 동기 커밋 부담을 낮춤
- 2026-03-13: `LayerTree`가 큰 현재 페이지 트리에서는 `VirtualizedTree` 경로를 사용하도록 전환해 page activation 시 layer panel 렌더 범위를 축소
- 2026-03-13: `usePageManager` / `PagesSection`에서 page activation과 delete fallback local transition을 `startTransition`으로 낮추고, 삭제 후 Cloud page sync 잔여 호출을 제거
- 2026-03-13: `NodesPanel`의 pages/layouts 탭 콘텐츠를 분리해 pages 탭에서 layouts 관련 구독, layouts 탭에서 pages/layers 관련 구독이 함께 흔들리지 않도록 commit 범위를 축소
- 2026-03-13: `PagesTabContent`에서 `LayersSection` 표시용 page id를 한 프레임 더 늦춰 activation 첫 RAF에서 page 전환과 layer panel 초기 커밋을 분리
- 2026-03-13: `LayersSection` 첫 렌더는 placeholder만 표시하고 실제 `LayerTree`는 다음 프레임에 붙여 activation 프레임의 layer panel 초기 커밋을 추가로 분리
- 2026-03-14: **Phase 1 — Interactive 경로의 `state.elements` 전체 배열 구독 → O(1) delta 패턴 전환** (29개 파일)
  - Property Editors 17개: `elementsMap.get()` O(1) 조회 + `childrenMap.get()` O(1) 자식 조회로 전환
    - ColumnEditor, CellEditor, FieldEditor, RowEditor, ElementSlotSelector, TableHeaderEditor, TableBodyEditor, BreadcrumbsEditor, TreeItemEditor, TagEditor, RadioGroupEditor, CheckboxGroupEditor, ToggleButtonGroupEditor, ListBoxItemEditor, GridListEditor, TableEditor, ToggleButtonEditor
  - `TabsEditor`: `childrenMap` 기반 Dual Lookup (직속 Tab → TabList 내부 Tab)
  - `canvasStore.ts`: `useCanvasElements()` → `pageElementsSnapshot[currentPageId]`, `useCanvasSelectedElement()` → `elementsMap.get()`
  - `useTextEdit.ts`: `elements.map()` 전체 교체 → `elements.indexOf()` + `Array.with()` 증분 패치
  - `instanceActions.ts`: `detachInstance`의 `elements.map()` → `findIndex` + `with()` + `elementsMap` 증분 패치
  - `AIPanel.tsx`: `state.elements` 전체 구독 → `pageElementsSnapshot[currentPageId]` 현재 페이지만 구독
  - `useCollectionItemManager.ts`: `state.elements` → `childrenMap.get(elementId)` O(1) 조회
  - `PixiListBox.tsx`, `PixiToggleButtonGroup.tsx`: `state.elements` → `childrenMap.get(element.id)` O(1) 조회
  - `usePresetApply.ts`: `state.elements` → `elementsMap` + `childrenMap` 순회, handler 내부 `getState()` 사용
  - `LayoutsTab.tsx`: `state.elements` → `elementsMap.forEach()` layout_id 필터링
  - `useComponentMemory.ts`: `state.elements` → `elementsMap` + `childrenMap` O(1) 조회 (depth/children 계산 포함)
  - `useDeltaMessenger.ts`: `state.elements.length` → `state.elementsMap.size`
  - `historyActions.ts`: `postMessage("*")` → `postMessage(window.location.origin)` 보안 강화 (3곳)
  - 의도적 스킵: `BuilderCanvas.tsx` (멀티페이지 렌더러 — 구조적으로 전체 elements 필요, Phase 3+ 대상), `historyActions.ts` undo/redo 내부 (스냅샷 복원 로직으로 전체 교체 정당)
- 2026-03-14: **Phase 2 — Atomic Page Activation** (4개 파일)
  - `activatePage()`: 동일 페이지+동일 요소 선택 시 중복 commit 방어 (early return)
  - `PagesSection.handlePageSelect()`: `await loadPageIfNeeded()` 대기 후 activation → 즉시 activation + 백그라운드 로드로 전환. async → sync 변환으로 activation 지연 제거
  - `PagesSection.handlePageDelete()`: `elements.filter(page_id)` O(N) → `pageElementsSnapshot[page.id]` O(1) 조회 + `elements.find(page_id + order_num)` → `pageElementsSnapshot` 기반 body 조회
  - `elementLoader.lazyLoadPageElements()`: elements set() + loadedPages set() 2회 → 단일 set()으로 병합하여 render burst 1회 축소
- 2026-03-14: **Phase 3 — Delta-Aware Store API 정착** (4개 파일)
  - `elementCreation.ts` `addElement`/`addComplexElement`: `elements.filter(parent_id)` O(N) → `childrenMap.get()` O(1) 형제 조회
  - `elementCreation.ts` layout 재정렬: `elements.filter(layout_id)` → `elementsMap.forEach()` (전용 인덱스 없음)
  - `inspectorActions.ts` `updateSelectedStylesPreview`/`updateSelectedFills`: `elements.findIndex(id)` O(N) → `indexOf(elementsMap.get())` + `with()` 증분 패치
  - `elementUpdate.ts` `updateElement`/`updateElementProps`: `elements.map(id)` O(N) → `indexOf(element)` + `with()` 증분 패치
  - 의도적 유지: 배치 업데이트(`batchUpdateElementProps/batchUpdateElements`)는 다수 요소 동시 변경이므로 Map 기반 유지, 히스토리(undo/redo)는 스냅샷 복원으로 전체 배열 교체 정당
- 2026-03-14: **Phase 4 — Panel Snapshot Isolation** (Phase 0~1에서 실질 완료 확인)
  - `LayersSection`: `pageElementsSnapshot[currentPageId]` 기준 완벽 최적화 — 다른 페이지 변화 무시
  - `PageTree`: pages 배열만 구독 (올바름 — 페이지 간 계층 관계)
  - `LayerTree`: current page elements + VirtualizedTree (12개 이상 노드 시 자동 전환, overscan=8)
  - `PagesTabContent`: 3단계 defer (useDeferredValue → scheduleNextFrame → scheduleCancelableBackgroundTask)
  - 성공 기준 달성: 1000 element page에서 panel render가 subtree/selection 변경 중심으로 제한
- 2026-03-14: **Phase 5 — Preview Contract Cleanup** (기존 구현 확인)
  - `useIframeMessenger.ts` L616-631: `UPDATE_ELEMENTS` 수신 — recovery-only 차단 이미 구현됨 (`source === "preview-recovery"` 등 3가지 조건 외 무시)
  - `BuilderCore.tsx`: `sendElementsToIframe()` 사용이 bootstrap(PREVIEW_READY 후), scope 전환, delta fallback 3가지로 한정 — interactive 경로는 `sendDeltaScopedElements()` 우선
  - `messageHandler.ts`: Delta 핸들러(`DELTA_ELEMENT_ADDED/UPDATED/REMOVED/BATCH_UPDATE`) 이미 구현
  - `useDeltaMessenger.ts`: deprecated (WebGL Canvas가 Zustand 직접 읽음 → Delta 전송 불필요)
  - 성공 기준 달성: preview ↔ builder 상호작용 기본 경로가 delta-only
- 2026-03-14: **Phase 6 — Legacy Removal & Perf Gate**
  - `usePageManager.ts` `fetchElements`: `elements.filter(page_id)` → `pageElementsSnapshot` O(1) 조회
  - `LayoutsTab.tsx`: `setElements` 사용 정당성 문서화 (Layout 모드 전환 bootstrap 성격)
  - Interactive `setElements` 호출 경로 전수 검증 — 모두 bootstrap/recovery/layout-load 전용으로 확인
  - ADR-040 전체 Phase 0~6 완료
