---
description: Zustand 상태 관리 관련 파일 작업 시 적용
paths:
  - "**/stores/**"
  - "apps/builder/src/adapters/canonical/**"
---

# 상태 관리 규칙

> **상세 패턴 인덱스** (composition-patterns skill reference):
>
> - [zustand-childrenmap-staleness](../skills/composition-patterns/rules/zustand-childrenmap-staleness.md) — props stale 회피 (CRITICAL)
> - [zustand-factory-pattern](../skills/composition-patterns/rules/zustand-factory-pattern.md) — StateCreator 팩토리 (HIGH)
> - [zustand-modular-files](../skills/composition-patterns/rules/zustand-modular-files.md) — 슬라이스 분리
> - [domain-o1-lookup](../skills/composition-patterns/rules/domain-o1-lookup.md) — elementsMap/childrenMap O(1)
> - [domain-async-pipeline](../skills/composition-patterns/rules/domain-async-pipeline.md) — Memory→Index→History→DB→Preview→Rebalance 순서
> - [domain-history-integration](../skills/composition-patterns/rules/domain-history-integration.md) — Undo/Redo 통합
> - 구현 상세: [state-details.md](../skills/composition-patterns/reference/state-details.md)

## Zustand 패턴

> **ADR-116/122 Implemented (2026-05-02 / 2026-05-09)**: `CompositionDocument` canonical schema 가 primary SSOT 로 land 완료. Builder runtime hot path 의 legacy `elementsMap`/`childrenMap` mutable subscription / mutation 은 0건 — canonical store + read-only derived snapshot 으로 갈음. 잔존 boundary helper (`frameMirror` / `slotMirror` / `componentSemanticsMirror` / `compositionExtensionFields` / `exportLegacyDocument`) 는 ADR-116 G7 + ADR-122 HC.3 boundary allowlist 내 의도된 architectural 영역. canonical 흐름 상세는 [docs/adr/completed/122-canonical-only-runtime-legacy-mirror-removal.md](../../docs/adr/completed/122-canonical-only-runtime-legacy-mirror-removal.md) 참조

- StateCreator factory 패턴 + 슬라이스 개별 파일 분리
- O(1) 인덱스: elementsMap(요소), childrenMap(자식), pageIndex(페이지). 배열 순회 금지. **ADR-122 Implemented (2026-05-09)** — Builder hot path 에서 `useStore.elementsMap`/`childrenMap` mutable subscription 0건. canonical selectors / `useStore.elements[]` 기반 read-only derived 사용
- childrenMap은 구조 변경 시에만 갱신 → props는 elementsMap에서 최신 조회 필수. **Why**: childrenMap이 props stale
- selector에서 배열/객체 반환 시 `useRef` + `shallow` 캐싱. Zustand v5 `equalityFn` 무시됨 주의

## 파이프라인 순서 (필수 보존)

1. Memory Update (즉시) → 2. Index Rebuild → 3. History Record
2. DB Persist (백그라운드) → 5. Preview Sync — 요소 순서는 canonical `children[]` 배열 순서가 SSOT (ADR-118), `order_num` 은 export mirror 로만 파생 (legacy `batchUpdateElementOrders()` 심볼 소멸)

## 핵심 규칙

- 상태 변경 전 히스토리 기록 필수 (Undo/Redo). **Why**: 기록 없이 변경 시 되돌리기 불가
- Stale closure 방지: setTimeout/queueMicrotask 안에서 `get()`으로 최신 상태 참조. **Why**: 외부 캡처 변수 stale
- Selection Consumer Contract (ADR-137): page-bound mutation은 deferred
  `SelectedElement`/inspector display data에서 pageId를 캡처하지 않는다.
  selection 경로는 commit 시점 `readImmediateSelectionSnapshot()`으로 만든
  `ImmediateSelectionSnapshot`을 `apply*FromSelection(snapshot, ...)`에 전달하고,
  projection body/frame editing context는 `apply*Explicit({ pageId, contextReason,
... })`만 사용한다. stale deferred page mismatch 상태에서는 page-bound controls를
  hide/disable한다.
- DB 저장 시 merged 전체 props 저장 (delta만 저장 금지). **Why**: 새로고침 후 미포함 props 소실
- 요소 삭제 후 `pageElementsSnapshot` 갱신 필수. **Why**: 미갱신 시 레이어 패널에 유령 항목

## Canonical sync 호출 순서 (CRITICAL)

ADR-116/122 canonical-only-runtime 후 `_rebuildIndexes` 는 `getCanonicalOrStoreElements()` → canonical 우선 derive (elements.ts:430). ADR-122 HC #2 ("runtime mutation 은 canonical document 를 먼저 갱신") 정합 패턴 (`createAddElementAction` 기준, `elementCreation.ts:186-244`):

```ts
mergeXxxIntoCanonicalDocument([...]);              // 1. canonical document 1차 갱신
set((prev) => ({ elements: [...prev.elements, ...newItems] })); // 2. legacy array derive 갱신
get()._rebuildIndexes();                             // 3. canonical 기반 index 재구축
await persistActiveCanonicalDocument(db);            // 4. IndexedDB persist (백그라운드)
```

### 신규 mutation 은 러너 경유가 유일 경로 (ADR-184 Implemented 2026-08-15)

**신규 mutation 경로는 위 순서를 수동으로 쓰지 않는다** — `runCanonicalMutation` (`adapters/canonical/canonicalMutationRunner.ts`) 이 canonical → set → `_rebuildIndexes` → history → persist(백그라운드) 순서를 소유하고, 호출자는 스테이지 함수만 제공한다 (canonical required — set-1차 위반이 시그니처상 표현 불가):

```ts
runCanonicalMutation({
  canonical: () => mergeElementsCanonicalPrimary(newItems), // wrapper 는 이 스테이지 안에서만
  store: () => set((prev) => ({ elements: [...prev.elements, ...newItems] })),
  history: () => {
    /* prev 캡처 필요 시 러너 호출 전 closure 로 */
  },
  // 기록하지 않는 mutation 은 history: { skip: "<사유>" } 로 생략을 명시 (ADR-185)
  // rebuild / persist 는 러너 소유 — 삭제 계열만 persistOptions: { allowShrink, reason }
});
```

**history 스테이지는 필수 (ADR-185 — history coverage 계약, Implemented 2026-08-15)**: 사용자-가시 mutation 이 history entry 없이 출시되는 계열이 4회 재발 (move 사후 수리 / 복합 생성 dead saveSnapshot / ADR-181 가이드 사후 편입 / 페이지 생성·삭제 — G-1, 2026-08-15 수리 `7a45f82d8`) 하여, `history` 는 기록 함수 또는 `{ skip: 사유 }` 명시적 생략만 허용한다 — 조용한 생략 (필드 자체를 빼는 형태) 은 타입 에러, 빈 skip 사유는 진입 시점 throw. 정당한 생략 사례: preview transient (commit 이 별도 기록) / silent live edit (useTextEdit 형) / preview 런타임 ingress. 기존 경로의 기록 여부 전수 감사와 **gap 목록 (수리 백로그 정본)** 은 [ADR-185 breakdown §4](../../docs/adr/design/185-history-coverage-contract-breakdown.md) — G-1 (페이지 생성/삭제) 은 별도 작업으로 수리 완료 (`page-lifecycle` entry + 페이지 간 스택 이관 `migrateEntryToPage` — history 는 페이지별 스택이라 활성 전환 entry 는 이관 없이 반대 방향 도달 불가).

- wrapper (`mergeElementsCanonicalPrimary` 등 6종) **직호출은 기존 경로 allowlist (15파일, ADR-184 breakdown §4-3 freeze) 한정** — `canonicalMutationRunner.static.test.ts` 가 기계 집행 (allowlist **추가 금지**, 추가 시도 자체가 리뷰 대상)
- 기존 경로 이관은 비스코프 ("회귀 위험 대비 이득 작음" 선행 판정 유지) — 재개 조건: 해당 경로에서 stale-canonical race **재발** 시 그 경로 1건만 이관
- hydration / bridge / undo 재생 (FramesTab 로드, BuilderCore page shell bridge, historyActions 재생 등) 은 mutation 이 아니라 러너 대상 아님 — 기존 파일 allowlist 로 고정

**금지 패턴**:

- ❌ `set` → `_rebuildIndexes` → canonical update — `_rebuildIndexes` 가 **stale canonical** 로 elementsMap mirror 빌드하여 `reusable` / `componentRole` / mirror field 누락 race 발생. 사용자 가시 영향: 신규 프로젝트 생성 직후 origin → copy → paste 시 instance 가 일반 element 로 생성. 새로고침 후 IndexedDB → canonical hydrate 정합화로 영구 회복.
- ❌ `set` 1차 → `syncXxxToCanonical` 2차 — ADR-122 HC #2 위반. wrapper 호출 시점이 set 뒤로 밀리면 canonical document 가 set 의 mutation 보다 1 tick 늦게 갱신되어 동기 read consumer (Skia bridge / canonical selector) 가 stale canonical 노출. 잔존 영역 (아래) 에서 회귀 패턴 반복.

**잔존 영역 (ADR-122 post-Implemented residual, 2026-05-23 amend / 2026-07-15 부분 해소)**:

ADR-122 본문 G1 ("mutation mirror 제거") 는 wrapper 가 단일 진입점이 되었음을 검증했지만 **wrapper 호출 순서 (canonical 1차 vs set 1차) 일관성** 은 검증하지 않았다. 2026-07-15 history 정비에서 2곳 해소, 다음 1곳이 `set` 1차 패턴 잔존:

| 경로                                                  | 위치                                                                                                     | 상태                                                                                                                                                                                                  |
| ----------------------------------------------------- | -------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `createInstance` / `resetInstanceOverrideField`       | `apps/builder/src/builder/stores/utils/instanceActions.ts` (createInstance / resetInstanceOverrideField) | **잔존** — `set` 1차 → `syncInstanceElementsToCanonical` 2차. 단 history entry 는 canonical insert/replace event 로 전환됨 (2026-07-15) 이라 undo 경로의 full-replace 노출은 소멸                     |
| instance snapshot batch (`applyElementSnapshotBatch`) | `apps/builder/src/builder/stores/utils/instanceActions.ts` (`applyElementSnapshotBatch`)                 | **해소 (2026-07-15)** — ① prev 캡처 → ② canonical sync 1차 → ③ replace event entry → ④ set → ⑤ \_rebuildIndexes 로 재배열                                                                             |
| history Undo / Redo / goToHistoryIndex                | `apps/builder/src/builder/stores/history/historyActions.ts` (`!appliedCanonicalEvents` 분기 3곳)         | **해소 (2026-07-15)** — sync 가 `set()` 선행 + canonical 재파생 결과로 set. `historyActions.static.test.ts` 의 source-order 정적 가드가 재발 차단. 이 분기 자체는 구 IndexedDB v1 entry 전용으로 격하 |

본 잔존은 ADR-122 본문 § Residual 에 추가됐다 ([docs/adr/completed/122-canonical-only-runtime-legacy-mirror-removal.md](../../docs/adr/completed/122-canonical-only-runtime-legacy-mirror-removal.md)). createInstance/resetInstanceOverrideField 의 호출 순서 reverse 는 여전히 후속 분리 (회귀 위험 대비 이득이 작음 — history 경로는 이미 canonical event 로 격리). **위반 누적 차단은 ADR-184** (신규 경로 러너 경유 + 우회 차단 정적 가드 — 잔존 경로는 allowlist 고정, §신규 mutation 은 러너 경유 참조).

**회귀 이력**: `instanceActions.ts` 3곳 fix — commits `a859f8b97` (applyElementSnapshotBatch) + `ee91020c4` (createInstance / resetInstanceOverrideField). 위 잔존 패턴 자체 정정 대신 그로 인한 stale derive race 만 우회 해소.

## Root Collection SSOT (ADR-131 Implemented 2026-05-13)

- `CompositionDocument.events` / `actions` 가 일급 root collection. 각 entry 는 flat node 구조 (ADR-110 `themes`/`variables` 패턴과 동일) → 향후 behavior 카테고리 확장 시 동일 패턴 적용
- mutation 은 `syncXxxToCanonical()` 경유 (root collection 전용 sync). UI node 는 `props.onPress: "ev1"` 같은 **string id** 로 root collection entry 를 참조 — static type guard 필수
- ADR-116 §3 `x-composition.events|actions` extension field 는 본 root field 로 partial supersede 됨
- **data 영역 제외**: ADR-131 Phase 8 사용자 관점 revert — `data_tables` (→ `collections`) 가 데이터 SSOT 유지, `CompositionDocument.data` root field 미도입

## Collections read 진입점 (ADR-132 Implemented 2026-05-13)

- RAC collection 컴포넌트 (Table/ListBox/GridList/ComboBox/Select/Tree/Breadcrumbs) 의 items read 는 `useCollectionData({ datatableId | dataBinding })` **단일 경유**
- source="api" 는 `useAsyncList.load` callback 안에서 `executeApiEndpoint` 호출 → `collections.runtimeData` sink → `list.items` read. **금지**: useEffect + local useState 로 endpoint 결과 보관 (legacy 우회 패턴)
- rename: `data_tables` (snake/DB) / `dataTables` (camel/store) → `collections` (canonical). internal type 도 `CollectionsMap` / `CollectionState` / `targetCollection`
- **UI surface 심볼은 유지**: `DataTable*` (DataTableEditor / DataTablePanel / panels/datatable/ 등) 은 사용자 노출이라 rename 제외

## 스타일 패널 (Zustand → Jotai Bridge)

- PropertyUnitInput: focus 시 selectedElementId ref 캡처 → blur 시 비교 → 다르면 onChange 스킵. **Why**: mousedown→blur 이벤트 순서로 blur 시점에 이미 새 요소 선택됨
- buildSelectedElement에 `properties` 전달 필수. **Why**: 미전달 시 size를 모름 → md fallback → 잘못된 fontSize 표시
- SyntheticComputedStyle: Spec preset 속성 추가 시 인터페이스도 동기화. 우선순위: inline → computed → synthetic → 기본값

## 금지 패턴

- ❌ 배열 순회로 요소 검색 (elementsMap O(1) 사용)
- ❌ DB 저장 시 delta props만 저장 (merged 전체 필수)
- ❌ 히스토리 기록 없이 상태 변경
- ❌ setTimeout 내에서 외부 캡처 변수 사용 (get() 필수)
