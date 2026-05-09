# ADR-125 Phase 0 — Render input contract inventory freeze (2026-05-10)

본 문서는 [ADR-125 design breakdown §4](125-render-input-canonical-native-contract-breakdown.md)
의 Phase 0 inventory 측정 결과를 freeze 한다. main HEAD `f54c2495c` 기준.

## 1. Layout engine 48 hits — file:line 단위 enumerate

### 1-A. `fullTreeLayout.ts` — 42 hits

위치: `apps/builder/src/builder/workspace/canvas/layout/engines/fullTreeLayout.ts`

| 분류                                  | line 범위                                                                                                  | 의미                                                                                      |
| ------------------------------------- | ---------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------- |
| **DFSContext type 정의**              | 857-858, 1909-1910                                                                                         | `elementsMap: Map<string, Element>` / `childrenMap: Map<string, string[]>` parameter 선언 |
| **Element lookup (parent traversal)** | 914, 924, 998, 1042, 1075, 1107, 1146, 1166-1168, 1175, 1203, 1233, 1326-1330, 1367, 1492, 1744, 1900-1949 | `elementsMap.get(rawElement.parent_id)` 류 ancestor 탐색                                  |
| **Layout pass 진입 entry**            | 883-884, 1175, 1938-1939, 1972, 2078, 2135, 2158, 2210, 2234, 2262, 2266                                   | `elementsMap` / `childrenMap` direct subscription                                         |
| **JSDoc 주석**                        | 297, 370, 1900-1901, 1326                                                                                  | 주석 내 `elementsMap` 언급 (functional impact 없음)                                       |

핵심 transformation 대상 (Phase 2):

- `DFSContext` interface 의 `elementsMap`/`childrenMap` parameter → canonical-native node list 또는 scene model snapshot 으로 전환
- 내부 traversal 은 `visitCanonicalDocumentElements` / scene model node list 사용

### 1-B. `utils.ts` — 6 hits

위치: `apps/builder/src/builder/workspace/canvas/layout/engines/utils.ts`

| 분류                      | line         | 의미                                                                                         |
| ------------------------- | ------------ | -------------------------------------------------------------------------------------------- |
| function signature        | 614, 617-618 | `elementsMap: Map<string, Element>` / `childrenMap: Map<string \| null, string[]>` parameter |
| internal traversal        | 621, 633     | `elementsMap.values()` / `childrenMap.get(id)`                                               |
| optional helper signature | 649          | `_elementsMap?: Map<string, Element>` (optional, Phase 2 에서 canonical 시그니처 추가)       |

핵심 transformation 대상 (Phase 2): 동일 — canonical node list 받도록 signature 확장.

### 1-C. Engine entry signatures (transition-derived-readonly)

| 파일                 | line             | 처리                                       |
| -------------------- | ---------------- | ------------------------------------------ |
| `BaseTaffyEngine.ts` | (별도 측정 필요) | 외부 호출 signature 유지 (Soft Constraint) |
| `TaffyFlexEngine.ts` | (별도 측정 필요) | 동일                                       |
| `TaffyGridEngine.ts` | (별도 측정 필요) | 동일                                       |

→ Engine 내부 구현만 canonical-native 로 전환. 외부에서 보이는 signature 는 Phase 2 에서
canonical 추가 + map shape deprecated 마킹.

## 2. Preview UPDATE_ELEMENTS receive 15 hits

### 2-A. `useIframeMessenger.ts` — 11 hits (production)

위치: `apps/builder/src/builder/hooks/useIframeMessenger.ts`

| line | role                                                            | 처리 phase                          |
| ---- | --------------------------------------------------------------- | ----------------------------------- |
| 130  | type signature                                                  | Phase 4                             |
| 251  | function definition                                             | Phase 4                             |
| 290  | outbound `type: "UPDATE_ELEMENTS"` postMessage                  | Phase 4 (canonical only)            |
| 300  | outbound `type: "UPDATE_ELEMENTS"` postMessage                  | Phase 4                             |
| 597  | inbound buffer item type guard                                  | Phase 4                             |
| 611  | rebroadcast `type: "UPDATE_ELEMENTS"`                           | Phase 4                             |
| 718  | comment                                                         | —                                   |
| 724  | bootstrap fallback `sendElementsToIframe(currentElements)` 호출 | Phase 4 (`!canonicalDoc` 분기 제거) |
| 972  | hook return                                                     | Phase 4                             |
| 1276 | mock impl `sendElementsToIframe: () => {}`                      | Phase 4                             |
| 1295 | hook return                                                     | Phase 4                             |

### 2-B. `BuilderCore.tsx` — 3 hits (comment only)

| line     | role        | 처리                                      |
| -------- | ----------- | ----------------------------------------- |
| 584      | JSDoc 주석  | Phase 4 에서 함수 자체 제거되면 주석 정리 |
| 921, 932 | 비활성 주석 | 동일                                      |

### 2-C. `preview/messaging/messageHandler.ts` — 2 hits

| line | role                               | 처리 phase     |
| ---- | ---------------------------------- | -------------- |
| 45   | type def `type: "UPDATE_ELEMENTS"` | Phase 3 (제거) |
| 300  | `case "UPDATE_ELEMENTS":` handler  | Phase 3 (제거) |

### 2-D. `preview/types/index.ts` — 1 hit

| line | role             | 처리 phase     |
| ---- | ---------------- | -------------- |
| 71   | type declaration | Phase 3 (제거) |

## 3. order_num 갱신 path

`apps/builder/src/builder/stores/elements.ts` — 3 hits (production):

| line | code                                                                                        | 처리 phase          |
| ---- | ------------------------------------------------------------------------------------------- | ------------------- |
| 1414 | `{ page_id?: string \| null; parent_id?: string; order_num?: number }` (parameter type)     | Phase 5             |
| 1425 | `order_num: index` (move fallback 갱신)                                                     | Phase 5 (제거 대상) |
| 1456 | `...(upd.order_num !== undefined ? { order_num: upd.order_num } : {})` (conditional spread) | Phase 5 (제거 대상) |

`utils/frameActions.ts:93` — `delete (metadata as Record<string, unknown>).order_num` (이미 cleanup
경로). Phase 5 에서 동작 변경 없음.

`utils/__tests__/*.ts` — order_num 테스트 fixture (53건). canonical migration 후 테스트 fixture
도 canonical-native 로 정리 필요 (Phase 5-b 또는 Phase 6).

## 4. Bucket 분류 freeze

| Surface                                              | bucket                                                  | Phase                                 |
| ---------------------------------------------------- | ------------------------------------------------------- | ------------------------------------- |
| `fullTreeLayout.ts` 42 hits                          | runtime-forbidden                                       | Phase 2                               |
| `utils.ts` 6 hits                                    | runtime-forbidden                                       | Phase 2                               |
| Engine entry signatures (Base/Flex/Grid)             | transition-derived-readonly                             | Phase 2 (signature 유지, 내부만 전환) |
| `messageHandler.ts:45,300`                           | runtime-forbidden                                       | Phase 3                               |
| `preview/types/index.ts:71`                          | runtime-forbidden                                       | Phase 3                               |
| `useIframeMessenger.ts:290,300,611,724` outbound     | runtime-forbidden                                       | Phase 4                               |
| `useIframeMessenger.ts:597` inbound buffer           | runtime-forbidden                                       | Phase 4                               |
| `useIframeMessenger.ts:718-726` `!canonicalDoc` 분기 | runtime-forbidden                                       | Phase 4                               |
| `elements.ts:1414-1456` move fallback                | runtime-forbidden                                       | Phase 5                               |
| `canonicalMutations.ts` order helper                 | boundary-allowed (children[] splice 가 primary 면 유지) | Phase 5                               |

## Phase 0 G1 통과 결과

- [x] 모든 hit 에 bucket / target phase / 정확한 file:line 표기
- [x] layout engine 48 hits (42 + 6) file × line 단위 enumerate
- [x] Preview/Bootstrap/order_num 4 surface 분리 freeze
- [x] Phase 1 진입 가능 — canonical scene model boundary 강화로 직진
