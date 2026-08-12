# ADR-177 설계 Breakdown: 페이지 위치의 문서 데이터화 — 히스토리 기록 + 영속화

## 1. Scope and dependency lock

### 1.1 In scope

- 페이지 캔버스 위치(breakpoint 별)를 canonical document 의 additive 필드로 편입
- `updatePagePosition` commit 시점의 히스토리 기록 (canonical event 확장) + undo/redo 배선
- 새로고침/프로젝트 재로드 시 저장된 배치 복원 (필드 부재 시 현행 재계산 폴백)
- `alignPagesToScreen` 일괄 재배치의 단일 히스토리 entry 기록
- 위치 데이터의 소비자 노출: 인스펙터 페이지 X/Y 입력 + 페이지 선택 시 화살표 nudge (1px / Shift 10px)

### 1.2 Explicitly out of scope

- ADR-176 의 gesture owner / transient presentation / finish-only commit 계약 변경
- 드래그 중(연속 인터랙션 중) 히스토리·persist 기록 (finish 1회 원칙 유지)
- 다중 페이지 선택·이동 (ADR-178), 스냅/정렬 가이드 (ADR-179)
- Preview/Publish 출력 — 페이지 캔버스 배치는 authoring 데이터로 배포 산출물에 영향 없음
- element 노드 히스토리 스키마의 기존 이벤트 의미 변경

### 1.3 Four-question fork lock

| 질문                                          | 판정                                                                                                                                                                            |
| --------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| base/application 관계인가?                    | ADR-176(gesture/presentation)이 sibling base — 본 ADR 은 그 commit 지점 뒤에 붙는 데이터 축이다. ADR-178/179 와는 직교(의존 없음).                                              |
| schema 가 specialization 관계인가?            | 아니다. document 에 additive 필드 1종 + 히스토리 event kind 1종 추가 — 기존 element 노드 이벤트의 specialization 이 아니다.                                                     |
| predecessor premise 를 reverse verify 했는가? | ADR-176 은 "document schema migration·새 저장 필드를 만들지 않는다"를 명시적 경계로 뒀다 — 본 ADR 이 그 이연분의 스키마 결정이며, ADR-176 의 commit 1회 계약은 그대로 승계한다. |
| 나중 review 까지 미룰 경계가 있는가?          | 없다. 저장 위치(document additive)·기록 시점(finish 1회)·BC(필드 부재 폴백)를 Phase 0 전에 lock 한다.                                                                           |

3-ADR 분리(177/178/179)는 사용자 confirm 완료 — 2026-08-12 AskUserQuestion "3개 분리 (권장)" 선택.

## 2. Current evidence (2026-08-12 실측 + 리뷰 round 1 보강)

| 경로                                                                      | 현재 동작                                                                                                                                | 관심사                                                          |
| ------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------- |
| `apps/builder/src/builder/stores/elements.ts:2026-2038`                   | `updatePagePosition` 이 `pagePositions` + `pagePositionsByBreakpoint` + version 만 set — 히스토리/persist 호출 없음                      | commit 지점에 기록 삽입                                         |
| `apps/builder/src/builder/stores/history.ts:46-88`                        | `HistoryEntry.type` 이 `add\|update\|remove\|move\|batch\|group\|ungroup` + `elementId` 필수 — element 노드 전용                         | event kind 확장 지점                                            |
| `apps/builder/src/builder/stores/history.ts:105-106, 387-402`             | **히스토리 스택은 per-page** — `pageHistories: Map<string, PageHistory>` + `addEntry` 가 `currentPageId` 스택에 기록                     | 프로젝트 수준 entry 의 **스택 소속 규칙** (Phase 0 lock — 아래) |
| `apps/builder/src/builder/stores/history/historyActions.ts`               | undo/redo 적용 분기가 canonical 노드 이벤트 전제 (`switch (entry.type)` 8곳+)                                                            | page-position event 적용 분기 신설                              |
| `apps/builder/src/builder/stores/elements.ts:495, 618-630`                | `pagePositionsByBreakpoint` 인메모리 맵 (`withActivePagePositionSnapshot` 이 active breakpoint 만 갱신)                                  | document 필드와의 hydrate/mirror 경계                           |
| `apps/builder/src/builder/stores/elements.ts:1938`                        | `initializePagePositions` — 로드 시 재계산 (저장 경로 미발견, 새로고침 시 배치 소실 실측)                                                | 필드 존재 시 hydrate 우선, 부재 시 현행 폴백                    |
| `apps/builder/src/builder/hooks/usePageManager.ts:153-161`                | 신규 페이지 생성 시 다음 슬롯 계산                                                                                                       | 신규 페이지의 초기 위치 기록 규칙                               |
| `apps/builder/src/builder/workspace/canvas/viewport/pageLayoutActions.ts` | `alignPagesToScreen` 전 페이지 일괄 재배치 — **`initializePagePositions` 경유** (`updatePagePosition` 미경유, `pageLayoutActions.ts:18`) | 기록 삽입 지점이 2곳 (drag finish + 일괄 정렬) — batch 1 entry  |
| `apps/builder/src/builder/workspace/canvas/hooks/usePageDrag.ts:200-228`  | finish 에서 `updatePagePosition` 1회 (ADR-176 계약)                                                                                      | 기록 시점 재사용 (드래그 중 기록 금지)                          |
| `apps/builder/src/builder/panels/styles/sections/TransformSection.tsx`    | 요소 CSS position 편집 — 페이지 좌표 UI 없음                                                                                             | 페이지 X/Y 입력의 거처 판정 (Phase 3)                           |
| `apps/builder/src/builder/config/keyboardShortcuts.ts:555-602`            | 화살표 = 형제 순서 변경 (`canvas-focused`, element 선택 전제) — 페이지 선택 상태에서는 no-op                                             | 페이지 선택 시 화살표 분기 신설 (충돌 없음)                     |

### 스택 소속 규칙 (리뷰 round 1 — Phase 0 lock 대상)

페이지 위치는 프로젝트 수준 데이터인데 히스토리 스택은 per-page 다. Phase 0 에서 다음을 확정한다:

- `page-position-set` entry 를 **기록 시점의 `currentPageId` 스택**에 넣을지, 이동 대상 pageId 스택에 넣을지 판정 (비활성 페이지 드래그·`alignPagesToScreen` 전 페이지 batch 는 대상이 복수).
- 판정 기준: **undo 도달성** — 사용자가 Cmd+Z 를 누르는 시점의 활성 페이지 스택에서 entry 가 보여야 한다. 기본 후보는 "기록 시점의 활성 페이지 스택" (기존 element batch 와 동형 — 활성 페이지 전환 후 undo 미도달은 기존 히스토리 모델의 공통 특성으로 수용).

## 3. Phase 분해

| Phase | 내용                                                                                                                                                                                         | 산출 검증                                                                  |
| ----- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------- |
| 0     | inventory freeze — 히스토리 소비자 전수(grep `HistoryEntry` / canonical event 소비 분기), **스택 소속 규칙 (§2)**, persist/hydrate 경로, breakpoint 맵 구조, 신규 페이지 초기 위치 규칙 확정 | 대상 파일 목록 + 계약 표                                                   |
| 1     | document additive 필드 + persist/hydrate — 로드 시 필드 존재 → hydrate, 부재 → `initializePagePositions` 폴백 (lazy write: 다음 위치 변경 시에만 필드 기록)                                  | 새로고침 후 배치 유지 / 구 문서 로드 무변경 (재직렬화 0)                   |
| 2     | 히스토리 canonical event (`page-position-set`, batch 지원) + undo/redo 적용 분기 + `alignPagesToScreen` batch 1 entry (`initializePagePositions` 경유 경로 포함 — 기록 삽입 지점 2곳)        | 드래그 → Cmd+Z 원위치 / redo 재적용, 정적 가드 (event kind 소비 분기 전수) |
| 3     | 소비자 — 인스펙터 페이지 X/Y 입력(active breakpoint) + 페이지 선택 시 화살표 nudge 1px / Shift 10px (기존 화살표=형제 순서와 scope 분리: 페이지 선택 상태 한정)                              | live: X/Y 입력 반영 + nudge + 각각 히스토리 entry                          |
| 4     | 검증 종결 — G1~G4 전수 + CHANGELOG                                                                                                                                                           | live behavior 게이트 (§완료 기준)                                          |

## 4. 데이터 형식 (Phase 0 에서 최종 확정)

- 후보: document 수준 `pagePositions: { [pageId]: { [breakpoint]: {x,y} } }` root 필드 (ADR-131 root collection 패턴) 또는 page node 필드. **root 필드 우선 검토** — 페이지 노드 스키마 오염 없이 authoring 데이터로 격리되고, 삭제된 페이지 정리 규칙이 단순.
- 좌표는 scene px, breakpoint 키는 기존 `pagePositionsByBreakpoint` 키와 동일.
- **hydrate 는 페이지 단위 병합** — 필드 보유 문서에 이후 추가된 페이지(필드에 entry 없음)는 그 페이지만 신규 슬롯 계산(`usePageManager` 규칙)으로 보충한다. 문서 단위 "필드 존재/부재" 이분법이 아니다.
- hydrate set 은 기존 mutation 과 같은 계약 준수 — `withActivePagePositionSnapshot` + `pagePositionsVersion + 1` (sceneVersion 반영, canvas-rendering.md §9).
- 히스토리 payload: `{ kind: "page-position-set", entries: [{ pageId, breakpoint, before: {x,y} | null, after: {x,y} }] }` — batch(정렬/다중) 대응.

## 5. Phase 0 계약 표 (2026-08-12 freeze — inventory 실측 완료)

| #   | 계약                  | 확정 내용                                                                                                                                                                                                                                                                                                                                                          |
| --- | --------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| C1  | document 필드         | `CompositionDocument.pagePositions?: Record<pageId, Partial<Record<BreakpointName, {x,y}>>>` — root additive (`composition-document.types.ts:785+`). `cloneDocument` 는 shallow spread 라 자동 보존 (`canonicalDocumentStore.ts:131-136`) — mutation 은 항상 새 객체 교체                                                                                          |
| C2  | canonical mutation    | `canonicalDocumentStore` 에 `setPagePositions(entries)` 액션 신설 — `mutateActiveDoc` helper 재사용 (ADR-131 root collection 패턴, `canonicalDocumentStore.ts:852` — events/actions 8 액션과 동형)                                                                                                                                                                 |
| C3  | persist               | canonical 갱신 후 `persistActiveCanonicalDocument(db)` — 동명 5줄 로컬 헬퍼 관례 (`elements.ts:99` 주석: 공용 추출은 별도 정리 대상) 준수, `elements.ts` 로컬 헬퍼 재사용                                                                                                                                                                                          |
| C4  | hydrate               | `initializePagePositions` 에 `persisted?` 옵션 인자 — 재계산 후 **페이지 단위 override 병합** + 전 breakpoint 를 `pagePositionsByBreakpoint` 에 반영 (active 는 `pagePositions` 미러). 호출처 2곳 중 `usePageManager.ts:430` 만 persisted 전달, `alignPagesToScreen` 은 현행 재계산                                                                                |
| C5  | 히스토리 형식         | `HistoryEntry.type` 에 `"page-position"` 추가 + `data.pagePositionEvent?: { entries: [{pageId, breakpoint, before: {x,y}\|null, after: {x,y}}] }`. `elementId` = 첫 pageId (소비자 미해석 무해값). `CanonicalHistoryNodeEvent` union 은 **불변** (노드 트리 적용 함수 전제 — 침범 금지)                                                                            |
| C6  | 스택 소속             | `historyManager.addEntry` 현행 그대로 — **기록 시점 활성 페이지(`currentPageId`) 스택** (`history.ts:387-402`). 활성 전환 후 undo 미도달은 기존 element batch 와 동형 특성으로 수용 (§2 판정)                                                                                                                                                                      |
| C7  | undo/redo 적용        | `createUndoAction`/`createRedoAction`/`createGoToHistoryIndexAction`/`applyHistoryEntry` (`historyActions.ts:263, 670, 1041, 1135`) 진입부에서 `type === "page-position"` **early-branch** — element 노드 경로 미진입. 적용 = store set(entry.breakpoint 가 active 면 미러 포함, 아니면 byBreakpoint 만) + `setPagePositions` + persist + `pagePositionsVersion+1` |
| C8  | R2 파서 판정          | **additive 안전 확정** — `db.documents.get` 반환 객체를 검증 없이 그대로 사용 (`usePageManager.ts:347-409` 실측, migration 체인은 특정 필드만 접촉). 마이그레이션 버전 게이트 불요                                                                                                                                                                                 |
| C9  | 정적 가드             | `historyActions.static.test.ts` (source-order 가드 전례) 에 page-position 소비 분기 가드 추가 — undo/redo/goToIndex 3 진입점 전수                                                                                                                                                                                                                                  |
| C10 | 신규 페이지 초기 위치 | `computeNextPagePosition` (`usePageManager.ts:152-161`) 현행 유지 — 문서 기록은 **lazy write** (생성 시점 기록 없음, 다음 위치 변경 시에만)                                                                                                                                                                                                                        |

## 6. BC 수식화

- 기존 프로젝트 영향 **0%** — 필드 부재 문서는 현행 재계산 경로 그대로, 로드 시 재직렬화 0 (lazy write).
- 필드 보유 문서를 구 빌드로 열 경우: 미지 필드 무시(현행 파서가 additive 필드 허용인지 Phase 0 확인 — 거부라면 마이그레이션 버전 게이트 추가). `CompositionDocument` 는 optional root 필드 패턴 기확립 (`themes?`/`tokens?`/`imports?` — `packages/shared/src/types/composition-document.types.ts:785+`) 이라 TS 타입 축은 additive 안전.
