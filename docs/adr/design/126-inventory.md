# ADR-126 Phase 0 — Inventory Freeze (2026-05-10)

본 문서는 [ADR-126 design breakdown §3](126-element-type-deprecate-breakdown.md) 의 Phase 0
inventory 측정 결과를 freeze 한다. main HEAD `6e20a3fb4` 기준.

## 1. Phase 0 Gate (G0) 통과 결과

ADR-123 / ADR-124 / ADR-125 모두 `Implemented — 2026-05-10` 도달:

```
docs/adr/123-cloud-document-row-schema.md       : Implemented — 2026-05-10
docs/adr/124-canonical-only-history-schema.md   : Implemented — 2026-05-10
docs/adr/125-render-input-canonical-native-contract.md : Implemented — 2026-05-10
```

→ **G0 PASS** — base 3 prerequisite 충족, ADR-126 Phase 1+ 진입 가능.

## 2. 측정 결과 (정량)

| 측정 대상                                          | 명령                                                                                | 결과                                                                                                                                    |
| -------------------------------------------------- | ----------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------- |
| `Element` 타입 raw hit (production, exclude tests) | `rg -n "\bElement\b" apps/builder/src --no-heading` (HTMLElement 등 제외)           | **1766 lines**                                                                                                                          |
| `canonicalDocumentToElements(` production callers  | `rg -n "canonicalDocumentToElements\(" apps/builder/src --no-heading` (테스트 제외) | **4 location**: 정의 1 (`canonicalElementsView.ts:234`) + 호출 3 (`canonicalHistoryEvents.ts:270` / `canonicalElementsView.ts:352,390`) |
| `useCanonicalElements` 위치                        | `rg -n "useCanonicalElements\b" apps/builder/src --no-heading` (테스트 제외)        | **~20 hit (~10 production caller)**                                                                                                     |
| `useStore.getState().elementsMap`/`childrenMap`    | `rg -n` (production hot path direct read)                                           | **0 hit (direct hot-path read closure)**                                                                                                |

→ ADR-126 breakdown §1 의 추정 (Element ~1,300 line hit / canonicalDocumentToElements 4 caller / useCanonicalElements ~12 production caller) 과 일치 범위 (1766 ≈ 1300+ boundary, 4 정확, ~10 production).

## 3. Bucket 분류 freeze

### 3-A. `derived-view` (Phase 5 제거 대상)

| Symbol                                  | 위치                                                                                                                                                       | 분류                              |
| --------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------- |
| `canonicalDocumentToElements()`         | `apps/builder/src/builder/stores/canonical/canonicalElementsView.ts:234`                                                                                   | 함수 정의 (Phase 5 boundary 격리) |
| `canonicalDocumentToElements()` callers | `canonicalHistoryEvents.ts:270` / `canonicalElementsView.ts:352` (`useCanonicalElements`) / `canonicalElementsView.ts:390` (`useCanonicalSelectedElement`) | 내부 derived path                 |
| `useCanonicalElements()`                | `canonicalElementsView.ts:348`                                                                                                                             | hook 정의                         |

production 호출 site (~10):

- `apps/builder/src/builder/stores/index.ts:111` (selector 합성)
- `apps/builder/src/builder/panels/properties/hooks/useCanonicalPropertyRead.ts:28`
- `apps/builder/src/builder/panels/monitor/hooks/useComponentMemory.ts:98`
- `apps/builder/src/builder/components/property/PropertyCustomId.tsx:33`
- `apps/builder/src/builder/hooks/useDeltaMessenger.ts:115`
- `apps/builder/src/builder/hooks/useCollectionItemManager.ts:31`
- `apps/builder/src/builder/panels/properties/editors/LayoutPresetSelector/usePresetApply.ts:224`
- `apps/builder/src/builder/stores/canvasStore.ts:108,128`
- `apps/builder/src/builder/panels/nodes/LayersSection.tsx`

### 3-B. `store-cache` (Phase 3 전환 — direct read 0, store state 타입 잔여)

ADR-125 Phase 2-a 의 `calculateFullTreeLayoutFromSceneModel` caller swap 결과로 `useStore.getState().elementsMap`/`childrenMap` direct hot-path read 는 0건이다. 이는 render/layout direct read closure 근거이며, store state 타입 자체가 닫혔다는 의미는 아니다.

- 측정: `rg -n "useStore.getState().elementsMap|useStore.getState().childrenMap" apps/builder/src` = **0 hit**
- 잔여: `apps/builder/src/builder/stores/elements.ts` 의 `ElementsState.elementsMap: Map<string, Element>` / `childrenMap: Map<string, Element[]>` 및 store utility의 `Element` key/value 타입 참조는 Phase 3 G3 전환 대상.

### 3-C. `hot-path-consumer` (Phase 2/4 전환 대상)

`Element` 타입 import 한 production 파일 (~50개) — Skia/layout/Preview/Properties/LayerTree/History/drag-drop. 전체 enumerate 는 Phase 1 진입 후 file-by-file conversion. 주요 카테고리:

| 카테고리            | 대표 파일                                                                                                                                             |
| ------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------- |
| BuilderCore mount   | `builder/main/BuilderCore.tsx:58,78,82,90,92,116,117`                                                                                                 |
| Skia render         | `builder/workspace/canvas/**/*.ts` (layout 48 hits, ADR-125 land)                                                                                     |
| Preview render      | `preview/utils/layoutResolver.ts:8` / `preview/App.tsx:34`                                                                                            |
| Factory definitions | `builder/factories/definitions/TableComponents.ts:34,45,56,66,91,101`                                                                                 |
| Adapter / resolver  | `adapters/canonical/legacyElementFields.ts:1` / `frameLayoutCascade.ts:8` / `resolvers/canonical/storeBridge.ts:33`                                   |
| AI tools            | `services/ai/tools/createElement.ts:11,66` / `canonicalToolReadModel.ts:4,6,14`                                                                       |
| Utility             | `builder/utils/treeUtils.ts:7` / `multiElementCopy.ts:8` / `idGeneration.ts:1` / `idValidation.ts:1` / `smartSelection.ts:8` / `selectionMemory.ts:8` |
| Messaging           | `services/messaging.ts:40,43,129` / `utils/dom/iframeMessenger.ts:1` / `builder/utils/canvasDeltaMessenger.ts:15`                                     |

### 3-D. `boundary-allowed` (유지 허용)

| 파일                                                                 | 역할                                                 |
| -------------------------------------------------------------------- | ---------------------------------------------------- |
| `apps/builder/src/utils/projectSync.ts`                              | cloud sync boundary (ADR-123 Phase 4 grep gate 통과) |
| `apps/builder/src/adapters/canonical/legacyElementFields.ts`         | legacy field utility (boundary)                      |
| `apps/builder/src/adapters/canonical/legacyElementsApiService.ts`    | cloud row CRUD boundary (ADR-123 Phase 4)            |
| `apps/builder/src/builder/stores/canonical/canonicalElementsView.ts` | canonical → Element projection (Phase 5 격리)        |

### 3-E. `test-doc` (Phase 6 정렬)

`apps/builder/src/**/__tests__/**` + `*.test.ts(x)` + `*.spec.ts` + `docs/**` — Element 타입 fixture / static guard test. Phase 6 grep gate 정렬 단계에서 일괄 정리.

## 4. Phase 1+ 진입 권장 순서

| Phase | Goal                                                                                                                                                    | Bucket 적용                               | 의존        |
| ----- | ------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------- | ----------- |
| 1     | derived-view boundary 격리 — `canonicalDocumentToElements`/`useCanonicalElements` 가 boundary allowlist file 내부 정의로만 export, hot path import 차단 | `derived-view`                            | —           |
| 2     | hot-path-consumer 전환 (1) — Skia / layout / Preview render path 가 canonical-native node/path/alias model 직접 소비                                    | `hot-path-consumer` (Skia/layout/Preview) | Phase 1     |
| 3     | store-cache 정합 — direct read 0 확인 후 `elementsMap`/`childrenMap` store state 타입을 canonical-native 또는 deprecated readonly snapshot 으로 정렬    | `store-cache`                             | Phase 2     |
| 4     | hot-path-consumer 전환 (2) — Properties / LayerTree / History / drag-drop / AI tools / messaging                                                        | `hot-path-consumer` (나머지)              | Phase 2     |
| 5     | derived-view 제거 — `canonicalDocumentToElements`/`useCanonicalElements` production caller 0 후 함수 자체 deprecate / boundary allowlist 만 사용        | `derived-view`                            | Phase 1+2+4 |
| 6     | final verification — `Element` 타입에 `@deprecated` JSDoc + boundary grep gate + targeted vitest + browser smoke                                        | `test-doc`                                | Phase 5     |

## Phase 0 G0 통과 결과

- [x] base 3 ADR (ADR-123 / ADR-124 / ADR-125) 모두 `Implemented` 도달 (2026-05-10)
- [x] Element 타입 production hit 측정 (1766 line)
- [x] derived-view symbol 4 location enumerate
- [x] useCanonicalElements production caller ~10 enumerate
- [x] store-cache direct read bucket = 0 hit 확인
- [ ] store-cache store state 타입 전환은 Phase 3 잔여
- [x] hot-path-consumer 카테고리 분류 완료
- [x] boundary-allowed allowlist 명시
- [x] Phase 1+ 진입 순서 6 phase plan freeze
- [x] Phase 1 진입 가능 — derived-view boundary 격리 (가장 작은 scope, 회귀 위험 LOW)
