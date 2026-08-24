# ADR-190 Phase 0 — emitter 지점 inventory freeze

> 본문: [../190-commit-descriptor-emitter-expansion.md](../190-commit-descriptor-emitter-expansion.md) ·
> breakdown: [190-commit-descriptor-emitter-expansion-breakdown.md](190-commit-descriptor-emitter-expansion-breakdown.md)

## 판정

**Phase 0 완료 (2026-08-24)** — inventory freeze + baseline 고정. 코드 조사만
수행했고 런타임 동작 변경은 0건이다.

Phase 1 진입에 필요한 3개 사실이 확정됐다: (1) emitter 삽입점이 단일 지점으로
특정됐고, (2) R2 (이중 큐) 가 코드 구조상 이미 분리되어 있으며, (3) R6 (다중
mutation) 의 실제 발생 지점이 batch action 2개로 국한된다.

## 1. baseline (재측정 불요 — freeze)

ADR-190 §Context 의 2026-08-24 실측을 그대로 고정한다. 재현:

```bash
node apps/builder/scripts/adr189-commit-baseline.mjs --repeats 5 \
  --out <path>
```

| fixture N | record+stream p95 | full DFS visits | queueCount | long task |
| --------: | ----------------: | --------------: | ---------: | --------: |
|        50 |             1.0ms |             106 |          0 |         0 |
|       500 |             2.4ms |             556 |          0 |         0 |
|     5,000 |        **73.1ms** |           5,056 |      **0** |        10 |

`queueCount=0` 은 fallback 이 아니라 **patch queue 미진입**이다
(`patchFallbackCount` 도 0). browser error 0건.

## 2. emitter 삽입점 — 단일 지점 특정

`createUpdateElementPropsAction` (`elementUpdate.ts:330-430`) 의 실행 순서:

| 순서 | 코드                                                    | 라인     |
| ---- | ------------------------------------------------------- | -------- |
| ①    | patch sanitize + no-op 조기 반환                        | :334-347 |
| ②    | history entry 기록                                      | :364-370 |
| ③    | `updatedElement` 조립 (단일 element)                    | :373-380 |
| ④    | **`syncUpdatedElementToCanonical(updatedElement)`**     | **:398** |
| ⑤    | `set({ elements, elementsMap, ... })` — store 구독 발화 | :415+    |

**emitter 는 ④ 와 ⑤ 사이**에 위치해야 한다:

- ④ 가 canonical document 를 갱신하므로 (`applyCanonicalPrimaryMerge` →
  `setDocument`, `canonicalMutations.ts:1812`) 그 직후 읽는
  `useCanonicalDocumentStore.getState().documentVersion` 이 **post-commit
  revision** 이다 — presentation adapter 가 쓰는 것과 동일 계약
  (`editorPresentationCommitAdapter.ts:410-411`).
- ⑤ 가 store subscriber (`StoreRenderBridge` resync) 를 발화시키므로, 그 전에
  queue 해야 sync 가 `pendingCommit` 을 본다. ⑤ 이후에 queue 하면 sync 는
  `pendingCommit === null` 분기로 `changedIds` 를 소비하고
  (`StoreRenderBridge.ts:1242-1246`), 뒤늦은 patch 는 stale revision 이 된다.

정적 가드 `elementUpdate.static.test.ts:71-86` 은 `indexOf` 기반 **순서**만
검사하므로 (④ index < ⑤ index) 그 사이 삽입은 가드를 깨지 않는다.

`elementUpdate.ts` 는 ADR-184 wrapper 직호출 allowlist 에 이미 등재되어 있어
(`canonicalMutationRunner.static.test.ts:53`) 신규 allowlist 추가가 필요 없다 —
emitter 는 wrapper 호출이 아니라 관찰자다.

## 3. R2 (이중 큐) — 구조적으로 이미 분리

presentation lane 의 canonical commit 은 `updateElementProps` 를 **경유하지
않는다**:

```
commitEditorPresentationFills (commitAdapter.ts:385-406)
  → runCanonicalMutation({
       canonical: () => useCanonicalDocumentStore.setDocument(...),
       store:     () => useStore.setState({ elements, layoutVersion })  ← 직접
       history:   () => historyManager.addEntry(...)
    })
```

`commitEditorPresentationStyle` 도 같은 형태다. 따라서 `updateElementProps`
안의 emitter 는 presentation commit 에서 **발화하지 않으며**, 두 생산자는 코드
경로상 disjoint 다.

ADR-190 R2 의 "commit origin 표식" 대응은 이 사실을 근거로 **Phase 1 에서
불필요**하다고 판정한다. 다만 회귀 방어는 유지한다 — presentation commit 1회에
`queueCount` 가 정확히 1 (2 아님) 임을 확인하는 정적/런타임 테스트를 G1 에
포함한다. 향후 누군가 adapter 의 `store:` 스테이지를 `updateElementProps` 로
바꾸면 그 테스트가 실패해야 한다.

Style 패널 hook (`useStylePresentationActions.ts`, `useFillActions.ts`,
`useLayoutPresentationActions.ts`, `useTextMetricsPresentationActions.ts`) 은
`updateElementProps` 를 호출하지 않는다 (grep 0건) — presentation session
단독 경로다. Properties 패널은 반대로 `updateElementProps` 단독이다.

## 4. R6 (다중 mutation) — batch action 2개로 국한

| action                    | 수정 element 수                                         | R6 해당 |
| ------------------------- | ------------------------------------------------------- | :-----: |
| `updateElementProps`      | **1개** — `sourceElements.with(idx, ...)` (`:378-380`)  |   ❌    |
| `updateElement`           | 1개 — `:566` 단일 sync                                  |   ❌    |
| `batchUpdateElementProps` | **N개** — `validUpdates` 순회 후 배열 sync (`:717-739`) |   ✅    |
| `batchUpdateElements`     | N개 — 동일 패턴                                         |   ✅    |

`updateElementProps` 의 `markDirtyWithDescendantsUpdate` (`:397` 부근) 는
**layout dirty 마킹**이지 canonical mutation 이 아니다 — descendant 가 dirty 로
표시돼도 mutation 은 1건이므로 descriptor 도 1건이다. 이 구분을 놓치면 불필요한
배치 로직을 넣게 된다.

instance/propagation 계열 (`instanceActions.ts`) 은 `updateElementProps` 를
경유하지 않고 자체 sync 경로를 쓴다 — Phase 3 에서 별도 분류한다.

## 5. action → descriptor 축 매핑

builder-side 호출만 집계한다. `apps/builder/src/preview/**` 의 동명 심볼은
**preview runtime store** 로 builder canonical store 가 아니다 (메모리
`feedback-preview-runtime-store-not-builder-store`) — 전량 제외.

| action                               | descriptor 축                | Phase | builder 호출 파일 (비-테스트)                                                                                                                                                                                                                                                                         |
| ------------------------------------ | ---------------------------- | :---: | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `updateElementProps`                 | `style.patch`                | **1** | `useTextEdit.ts` / `ButtonChildSection.tsx` / `usePresetApply.ts` / `PropertiesPanel.tsx` / `canvasStore.ts` / `BatchPropertyEditor.tsx` / `useIframeMessenger.ts` / `useCollectionItemManager.ts` / `BuilderCore.tsx` / `useBorderRadiusDrag.ts` / **`services/ai/tools/updateElement.ts`** (11파일) |
| `updateElement`                      | `style.patch` (구조 키 제외) |   3   | Phase 0 범위 밖 — Phase 3 분류                                                                                                                                                                                                                                                                        |
| `batchUpdateElementProps`            | `style.patch` × N (배치)     |   3   | R6 대상 — `mutations[]` 1회 queue                                                                                                                                                                                                                                                                     |
| `batchUpdateElements`                | 혼합 × N (배치)              |   3   | R6 대상                                                                                                                                                                                                                                                                                               |
| `addElement`                         | `structure.patch` (`add`)    |   2   |                                                                                                                                                                                                                                                                                                       |
| `addComplexElement`                  | `structure.patch` (`add`)    |   2   |                                                                                                                                                                                                                                                                                                       |
| `removeElement(s)`                   | `structure.patch` (`remove`) |   2   | payload 에 `parentId` 필수 (post-commit 트리에서 대상 소멸)                                                                                                                                                                                                                                           |
| `reorderElementWithinParent`         | `structure.patch` (`order`)  |   2   | `canvasContextMenuProviders.ts:123` / `useGlobalKeyboardShortcuts.ts:292`                                                                                                                                                                                                                             |
| `moveElementToSiblingEdge`           | `structure.patch` (`order`)  |   2   | `canvasContextMenuProviders.ts:120` / `useGlobalKeyboardShortcuts.ts:309`                                                                                                                                                                                                                             |
| `undo` / `redo` / `goToHistoryIndex` | 재생 — 혼합                  |   3   | 다수 노드 동시 변경 가능 → R4 임계 대상                                                                                                                                                                                                                                                               |

### 제외 목록 (emit 하지 않음 — full rebuild 유지)

| 대상                                                                                         | 사유                                                                                                                                                      |
| -------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `moveElementToContainer` / `moveElementToCanonicalTarget`                                    | reparent — 출발지·도착지 양쪽 dirty, 소비자가 `unsupported-structure-operation` fail-closed (`commitPatchPlan.ts:133-137`). 진입점 `useDragBridge.ts:910` |
| `appendPageShell` / `removePageLocal` / `activatePage`                                       | page-level mutation — element subtree 범위 밖                                                                                                             |
| `updatePagePosition*` / `updateFramePosition`                                                | 좌표 mirror — element command stream 무관                                                                                                                 |
| `setElements` / `hydrateProjectSnapshot` / `loadPageElements`                                | hydration — mutation 아님 (ADR-184 러너 대상도 아님)                                                                                                      |
| `createInstance` / `detachInstance` / `toggleComponentOrigin` / `resetInstanceOverrideField` | ref/slot 계열 + `set` 1차 잔존 경로 (state-management.md §잔존 영역) — Phase 3 분류 후 판정                                                               |

## 6. Phase 1 진입 판정

Phase 1 (style 축 emitter) 의 선행 불확실성 3건이 모두 해소됐다:

- 삽입점 특정 ✅ (§2) — 단일 지점, 정적 가드 무충돌, allowlist 추가 불요
- R2 대응 범위 확정 ✅ (§3) — origin 표식 불요, 회귀 테스트로 대체
- R6 범위 확정 ✅ (§4) — Phase 1 대상 (`updateElementProps`) 은 단일 element 라
  배치 로직 불요. 배치는 Phase 3 (`batchUpdate*`) 로 이연

Phase 1 의 잔존 위험은 R1 (descriptor fidelity) 단독이며, 대응은 ADR 본문대로
"해석 불가 키 1개라도 존재 시 descriptor 미발행 → full rebuild" + G1 pixel
oracle 이다.

## 검증

- 코드 조사만 — 소스 변경 0건, 런타임 동작 변경 0건
- `pnpm type-check`: PASS (baseline 43 known errors, 신규 위반 0)
- 인용 라인은 2026-08-24 `b79336e45` 시점 기준
