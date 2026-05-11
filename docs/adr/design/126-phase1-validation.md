# ADR-126 Phase 1 — Canonical-native Model 검증 (2026-05-10)

본 문서는 [ADR-126 design breakdown §4](126-element-type-deprecate-breakdown.md) 의
Phase 1 (canonical-native model 검증) 결과를 freeze 한다. main HEAD `47f0de91a` 기준.

**진입 조건**: ADR-123 / ADR-124 / ADR-125 모두 `Implemented — 2026-05-10` (G0 PASS).

---

## 1. Phase 1 목표

ADR-123/124/125 closure 후 잔존하는 `Element` consumer 를 식별하고, canonical-native
model 이 hot path 를 `Element` 없이 커버할 수 있는지 검증한다. **실제 코드 변경
최소** — Phase 2/3/4 의 file-by-file conversion 진입 전 measurement / classification
phase.

---

## 2. Base 3 ADR closure 검증 결과

### 2-A. ADR-123 — cloud transport boundary 잔존 검증

**산출물**: `apps/builder/src/adapters/canonical/__tests__/cloudBoundary.static.test.ts`
(ADR-123 Phase 4 Gate G4 grep gate, 5 assertion).

```
pnpm -F @composition/builder exec vitest run \
  src/adapters/canonical/__tests__/cloudBoundary.static.test.ts
```

→ **5/5 PASS** (847ms).

allowlist 6 file (`legacyElementsApiService.ts`, `services/api/index.ts`,
`utils/projectSync.ts`, `adapters/canonical/canonicalMutations.ts`,
`builder/factories/utils/dbPersistence.ts`, `dashboard/index.tsx`) 외 production hot
path 에서 cloud row API import **0 건**.

→ **G1-A PASS** — Builder hot path 에서 cloud row API 의존 사라짐 확증.

### 2-B. ADR-124 — history payload legacy Element snapshot 잔존 검증

`apps/builder/src/builder/stores/history.ts` HistoryEntry data 8 legacy snapshot
field (`prevElement`, `nextElement`, `elements`, `prevElements`, `nextElements`,
`prevChildren`, `nextChildren`, `parentId`) 모두 `@deprecated ADR-124 Phase 4`
JSDoc 마킹 완료 (line 64-82).

`historyActions.ts` 에서 canonical event primary read 패턴 확인:

- line 232 / 394 / 1052 / 1681 / 2137: `entry.data.canonicalEvents` early read
- line 398 / 1056: canonical event 적용 성공 시 `appliedCanonicalEvents = true` →
  legacy snapshot path skip
- `applyCanonicalHistoryEventsToActiveDocument()` 가 single source primary

→ **G1-B PASS** — history payload 가 canonical event single source 로 전환됨.
legacy snapshot field 는 v1 IndexedDB 호환 fallback 만으로 유지 (read 시 dead
path).

### 2-C. ADR-125 — render input canonical-native closure 검증

세 측정 모두 PASS:

| 측정                                         | 결과                                                                                                         |
| -------------------------------------------- | ------------------------------------------------------------------------------------------------------------ |
| Preview `UPDATE_ELEMENTS` receive 잔존       | `preview/types/index.ts:70` + `preview/messaging/messageHandler.ts:44-46` 모두 ADR-125 Phase 3 제거 마킹     |
| `calculateFullTreeLayoutFromSceneModel` swap | `layoutCache.ts:5,343` import + 호출 — 기존 `calculateFullTreeLayout` 은 internal entry 만 유지              |
| element-level `order_num` 갱신 (boundary 외) | **0 hit** — `projectSync.ts:103` 의 `order_num: pageIndex` 는 Page entity cloud field (page-level, scope 외) |

→ **G1-C PASS** — render input contract 가 canonical-native scene model 단일
source 로 닫힘.

---

## 3. 잔존 Element consumer 카테고리 매핑

### 3-A. unified.types `Element` 타입 import production file (37)

| Bucket            | Count  | 대표 파일                                                                                                                                      |
| ----------------- | :----: | ---------------------------------------------------------------------------------------------------------------------------------------------- |
| boundary-allowed  | **18** | `adapters/canonical/*` 15 + `resolvers/canonical/storeBridge.ts` + `types/builder/component.types.ts` + `types/builder/layout.types.ts`        |
| derived-view      | **1**  | `builder/stores/canonical/canonicalElementsView.ts` (정의)                                                                                     |
| hot-path-consumer | **18** | LayerTree (4) / Properties editor (3) / Frame actions (1) / preview (2) / ai tools (2) / utils (3) / drop resolver (1) / hooks (1) / pages (1) |

#### derived-view (Phase 5 격리 대상)

- `apps/builder/src/builder/stores/canonical/canonicalElementsView.ts` —
  `canonicalDocumentToElements()` + `useCanonicalElements()` +
  `useCanonicalSelectedElement()` 정의.
- production caller 약 ~10: `builder/stores/index.ts:111`, `useCanonicalPropertyRead.ts:28`,
  `useComponentMemory.ts:98`, `PropertyCustomId.tsx:33`,
  `useDeltaMessenger.ts:115`, `useCollectionItemManager.ts:31`,
  `usePresetApply.ts:224`, `canvasStore.ts:108,128`, `LayersSection.tsx`.

#### hot-path-consumer (Phase 2/4 file-by-file 전환)

| 카테고리              | 파일 (대표)                                                                                                                    |
| --------------------- | ------------------------------------------------------------------------------------------------------------------------------ |
| LayerTree / Frames    | `panels/nodes/{LayersSection,PagesSection,FramesTab/FrameElementTree}.tsx` + `tree/LayerTree/useLayerTreeData.ts`              |
| Properties editor     | `panels/properties/editors/{LayoutPresetSelector/usePresetApply,TableEditor}.tsx` + `components/property/PropertyCustomId.tsx` |
| Styles / Frame action | `panels/styles/utils/fillExternalIngress.ts` + `stores/utils/frameActions.ts`                                                  |
| Utils                 | `utils/{idGeneration,idValidation,treeUtils}.ts`                                                                               |
| Drag-drop             | `workspace/canvas/selection/dropTargetResolver.ts`                                                                             |
| Hooks                 | `hooks/usePageManager.ts`                                                                                                      |
| Preview               | `preview/{App.tsx,utils/layoutResolver.ts}`                                                                                    |
| AI tools              | `services/ai/tools/{canonicalToolReadModel,createElement}.ts`                                                                  |

### 3-B. Annotation 기반 Element 타입 사용 production file (161)

`: Element\b | <Element\b | Element\[\]` 정규식 기반. 카테고리:

| 카테고리                                        | 파일 수 | Phase   |
| ----------------------------------------------- | :-----: | ------- |
| canvas hot path (Skia/renderers/layout engines) | **25**  | Phase 2 |
| panels / Properties / LayerTree                 |   ~30   | Phase 2 |
| store / history / inspector / drag-drop         |   ~40   | Phase 4 |
| preview / publish / ai tools / messaging        |   ~15   | Phase 4 |
| boundary / adapter / utils                      |   ~50   | 유지    |

→ Phase 2 우선 전환 대상: canvas hot path **25 파일** + LayerTree/Properties **30 파일** ≒ 55 파일.

---

## 4. canonical-native API hot path 커버 가능성 판정

### 4-A. 이미 존재하는 canonical-native API

| API                                           | 위치                                                     | 역할                                                  |
| --------------------------------------------- | -------------------------------------------------------- | ----------------------------------------------------- |
| `calculateFullTreeLayoutFromSceneModel`       | `workspace/canvas/layout/engines/fullTreeLayout.ts:2333` | scene model → layout map (ADR-125 Phase 1 진입점)     |
| canonical scene snapshot                      | `workspace/canvas/scene/canonicalSceneModel.ts`          | derived-readonly view (ADR-125 Phase 1 contract)      |
| canonical node/path/alias resolver            | `adapters/canonical/canonicalRefResolution.ts`           | ADR-122 baseline                                      |
| `applyCanonicalHistoryEventsToActiveDocument` | `stores/history/canonicalHistoryEvents.ts`               | canonical event sequence apply (ADR-124 primary read) |
| `getActiveCanonicalHistoryElements`           | `stores/history/canonicalHistoryEvents.ts`               | canonical-native history 결과 read                    |

### 4-B. 판정 결과

`canonical-native API 가 hot path 를 Element 없이 커버 가능` — **YES**.

근거:

1. **Render path**: Skia render 는 layout 결과를 소비. Layout 은 ADR-125 Phase 2-a
   에서 이미 scene model snapshot derive 진입.
2. **Selection / hit-test**: canonical node ref API + scene model 의 alias path 로
   selection 표시 가능.
3. **Properties / Inspector read**: canonical-native property read 는 canonical
   document `nodes[]` traversal + alias resolver 로 충분.
4. **History / Undo**: ADR-124 closure 후 canonical event sequence 가 primary
   path. legacy snapshot read 는 v1 IndexedDB fallback 만.
5. **Drag-drop / Move**: canonical document `parentId` + `path[]` 로 reposition
   표현 가능 (ADR-122 canonicalMutations).

**잔존 위험**:

- canvas 25 파일의 `Element` annotation 이 자식 children 순회를 위해
  `childrenMap.get(id)` 같은 derived view API 에 의존 — Phase 2 file-by-file
  전환에서 `context.resolver.children(node)` 패턴으로 swap 필요.
- LayerTree 가 store cache `useStore.getState().elementsMap` 직접 read 하던
  관행은 ADR-122/125 closure 로 0 hit (G0 inventory 결과 재확인). store-cache
  bucket auto-closure.

---

## 5. FPS Baseline (Phase 2 비교용)

dev server `http://localhost:5173/builder/f94b518e-eb98-4328-9a05-9660271b1ab6`
브라우저 idle 상태.

| 측정 항목           | 값                                      |
| ------------------- | --------------------------------------- |
| canvas dimensions   | 2612x1880 (CSS 1306x940)                |
| visible panel count | 0 (idle, no dropdown)                   |
| FPS sample          | 300 frames (2.5s window)                |
| **FPS median**      | **120.5**                               |
| FPS p10             | 107.5                                   |
| FPS p99             | 137.0                                   |
| 60fps gate          | **PASS** (-5% bound = 114.4, 충분 여유) |
| console error       | 0                                       |

→ Phase 2 진입 시 동일 시나리오 (idle, panel 0) 에서 median 120.5 ± 5% (114.4 ~
126.6) 유지가 G2 통과 기준.

---

## 6. type-check + targeted vitest

| 검증                                                          | 결과         |
| ------------------------------------------------------------- | ------------ |
| `pnpm type-check`                                             | PASS (cache) |
| `pnpm -F @composition/builder exec vitest run cloudBoundary*` | 5/5 PASS     |

---

## 7. Phase 1 Gate (G1) 통과 여부

| Gate 항목                                                                             | 통과 |
| ------------------------------------------------------------------------------------- | :--: |
| canonical-native node/path/alias API 가 `Element` 없이 hot path 커버 가능 (설계 검증) |  ✅  |
| ADR-123 cloud boundary 잔존 0 (allowlist 외)                                          |  ✅  |
| ADR-124 history canonical event primary read 확증                                     |  ✅  |
| ADR-125 render input scene model 단일 source 확증                                     |  ✅  |
| `pnpm type-check` 0 error                                                             |  ✅  |
| FPS baseline 수립 (median 120.5)                                                      |  ✅  |

→ **G1 PASS** — Phase 2 진입 가능.

---

## 8. Phase 2 진입 권장 — hot path consumer 전환 (Skia / layout / Preview / Properties / LayerTree)

| Sub-task                                                                                          | Bucket file 수 | 회귀 위험 |
| ------------------------------------------------------------------------------------------------- | :------------: | :-------: |
| Skia render path (StoreRenderBridge / renderCommands / rendererInput) → canonical scene 직접 소비 |      ~10       |  MEDIUM   |
| Layout engine input → scene model 직접 소비 (`calculateFullTreeLayoutFromSceneModel` caller 확장) |       ~5       |    LOW    |
| Preview render → canonical-native resolved tree 소비                                              |       ~3       |  MEDIUM   |
| Properties editor (LayoutPresetSelector, TableEditor) → canonical property read API               |       ~5       |    LOW    |
| LayerTree (LayersSection, PagesSection, FramesTab, useLayerTreeData) → canonical node/path model  |       ~5       |  MEDIUM   |

전환 패턴:

```typescript
// Before
function renderElement(element: Element): void {
  const children = childrenMap.get(element.id) ?? [];
}

// After (canonical-native)
function renderNode(node: CanonicalNode, context: RenderContext): void {
  const children = context.resolver.children(node);
}
```

---

## 9. 관련

- ADR 본문: [docs/adr/completed/126-element-type-deprecate.md](../completed/126-element-type-deprecate.md)
- Breakdown: [docs/adr/design/126-element-type-deprecate-breakdown.md](126-element-type-deprecate-breakdown.md)
- Phase 0 inventory: [docs/adr/design/126-inventory.md](126-inventory.md)
