# ADR-125 구현 상세 — Render input canonical-native contract

본 문서는 [ADR-125](../125-render-input-canonical-native-contract.md) 의 phase plan,
inventory, gate 측정 방법을 정의한다. ADR-122 closure note 의 "별도 renderer
refactor" 항목을 정식 범위로 닫고, render pipeline 의 입력 계약을 canonical-native
로 확정하는 구체 단계.

## 1. Target State

| Layer                     | Target                                                            | 금지 대상                                                      |
| ------------------------- | ----------------------------------------------------------------- | -------------------------------------------------------------- |
| layout engine 입력        | canonical scene model node list 또는 canonical document traversal | `DFSContext.elementsMap`/`childrenMap` map shape 직접 contract |
| Preview render channel    | `UPDATE_CANONICAL_DOCUMENT` 단일 active channel                   | `UPDATE_ELEMENTS` receive (compatibility 잔존도 포함)          |
| element move 연산         | canonical `children[]` splice 단일 source                         | `order_num` 필드 갱신                                          |
| Builder→Preview bootstrap | canonical hydration 완료 후 단일 `UPDATE_CANONICAL_DOCUMENT` 송신 | `!canonicalDoc` 분기의 `sendElementsToIframe()` outbound       |

## 2. Current Hybrid Inventory Seed

Phase 0 에서 아래 seed 를 실제 코드 기준으로 재측정하고 bucket 을 확정한다.

```bash
rg -n "elementsMap|childrenMap" \
  apps/builder/src/builder/workspace/canvas/layout \
  -g '*.ts' -g '*.tsx'

rg -n "UPDATE_ELEMENTS|sendElementsToIframe" \
  apps/builder/src/preview \
  apps/builder/src/builder/hooks/useIframeMessenger.ts \
  -g '*.ts' -g '*.tsx'

rg -n "order_num" \
  apps/builder/src/builder/stores/elements.ts \
  -g '*.ts'
```

### Inventory bucket

| Surface                                                                                                                     | 분류                                                    | Phase                    |
| --------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------- | ------------------------ |
| `apps/builder/src/builder/workspace/canvas/layout/engines/fullTreeLayout.ts` (42 hits)                                      | runtime-forbidden                                       | Phase 2                  |
| `apps/builder/src/builder/workspace/canvas/layout/engines/utils.ts` (6 hits)                                                | runtime-forbidden                                       | Phase 2                  |
| `apps/builder/src/builder/workspace/canvas/layout/engines/BaseTaffyEngine.ts` / `TaffyFlexEngine.ts` / `TaffyGridEngine.ts` | transition-derived-readonly                             | Phase 2 (signature 유지) |
| `apps/builder/src/preview/messaging/messageHandler.ts:45,300`                                                               | runtime-forbidden                                       | Phase 3                  |
| `apps/builder/src/preview/types/index.ts:71`                                                                                | runtime-forbidden                                       | Phase 3                  |
| `apps/builder/src/builder/hooks/useIframeMessenger.ts:721-726`                                                              | runtime-forbidden                                       | Phase 4                  |
| `apps/builder/src/builder/stores/elements.ts:1414-1456` move fallback                                                       | runtime-forbidden                                       | Phase 5                  |
| `apps/builder/src/adapters/canonical/canonicalMutations.ts` order helper                                                    | boundary-allowed (children[] splice 가 primary 면 유지) | Phase 5                  |

## 3. Phase Plan

| Phase   | Goal                                   | Main output                                        | Gate |                                                                  Status                                                                   |
| ------- | -------------------------------------- | -------------------------------------------------- | :--: | :---------------------------------------------------------------------------------------------------------------------------------------: |
| Phase 0 | render input contract inventory freeze | bucket 분류 + 정확한 file/line list                |  G1  |                                       **Done — 2026-05-10** ([125-inventory.md](125-inventory.md))                                        |
| Phase 1 | canonical scene model boundary 강화    | `buildCanonicalSceneModel()` 입력 contract 확장    |  —   |                                              **Done — 2026-05-10** (JSDoc + canonical entry)                                              |
| Phase 2 | layout engine input contract 정의      | `DFSContext` canonical-native 전환 + benchmark     |  G2  |                                 **Done (2-a) — 2026-05-10** (layoutCache caller swap, browser load PASS)                                  |
| Phase 3 | Preview UPDATE_ELEMENTS receive 제거   | hydration guard 강화 + receive case 제거           |  G3  |                           **Done — 2026-05-10** (UpdateElementsMessage type 제거 + case "UPDATE_ELEMENTS" 제거)                           |
| Phase 4 | bootstrap fallback path canonical-only | `useIframeMessenger.ts` `!canonicalDoc` 분기 제거  |  —   |                                       **Done — 2026-05-10** (`!canonicalDoc` legacy bootstrap 제거)                                       |
| Phase 5 | order_num 갱신 path 제거               | `elements.ts` move fallback canonical-only         |  G4  |                                **Done — 2026-05-10** (ADR-122 HC.5 closure, fallback order_num 갱신 제거)                                 |
| Phase 6 | final verification                     | render benchmark + browser smoke + targeted vitest |  G5  | **Done — 2026-05-10** (FPS 96-120 idle / canvas 2612x1768 / console error 0 / preflight FULL TURBO PASS / 회귀 vitest 12 file 55/55 PASS) |

## 4. Phase 0 — Render input contract inventory freeze

작업:

1. inventory seed command 를 실행해 모든 hit 를 bucket 으로 분류한다.
2. layout engine 의 42 hits 를 file × line 단위 list 로 확정한다 (`fullTreeLayout.ts` /
   `utils.ts` / engine 별 entry).
3. Preview `UPDATE_ELEMENTS` receive type def 와 case 처리 분리 list 작성.
4. `order_num` 갱신 위치 (`elements.ts:1417-1456` + 인접 helper) 정확한 라인 freeze.
5. `useIframeMessenger.ts:718-726` bootstrap 분기 코드 freeze.

검증:

```bash
pnpm -F @composition/builder exec vitest run \
  src/builder/workspace/canvas/layout
```

완료 조건 (G1):

- 모든 hit 에 bucket / target phase / 정확한 file:line 이 있다.
- layout engine 42 hits 가 file:line 단위로 enumerate 되어 있다.
- Preview/Bootstrap/order_num 4 surface 가 정확히 분리되어 있다.

## 5. Phase 1 — Canonical scene model boundary 강화

작업:

1. `apps/builder/src/builder/workspace/canvas/scene/canonicalSceneModel.ts` 의
   `buildCanonicalSceneModel()` 결과에 canonical-native traversal API
   (`visitCanonicalDocumentElements`) 를 통과한 node list 를 추가한다.
2. 기존 `elementsMap`/`childrenMap` 출력은 유지하되, "canonical scene model
   internal derived" 임을 type 주석에 명시한다.
3. layout engine 측에서 scene model 의 canonical node list 를 입력으로 받을 수
   있도록 entry signature 확장. 기존 map signature 는 deprecated 로 마킹.

검증:

```bash
pnpm -F @composition/builder exec vitest run \
  src/builder/workspace/canvas/scene/canonicalSceneModel.test.ts \
  src/builder/workspace/canvas/BuilderCanvas.projection.static.test.ts
```

완료 조건:

- canonical scene model 이 node list + map 양쪽을 export.
- layout engine entry 가 둘 중 어느 것이든 받을 수 있는 transitional state.
- 기존 caller (BuilderCanvas) 회귀 0.

## 6. Phase 2 — Layout engine input contract 정의

작업:

1. `fullTreeLayout.ts` 의 `DFSContext` 정의를 canonical-native node list 입력으로
   전환. 내부 traversal 은 `visitCanonicalDocumentElements` 또는 scene model node
   list 를 사용.
2. `utils.ts` 의 helper (`calculateContentHeight` / `enrichWithIntrinsicSize` 등) 가
   canonical node 입력을 받도록 signature 확장.
3. `BaseTaffyEngine` / `TaffyFlexEngine` / `TaffyGridEngine` 외부 호출 signature
   유지 (Soft Constraint). 내부 구현만 canonical-native 로 전환.
4. 42 hits 전수 grep 후 잔존 0 확인.

금지:

- legacy map shape 를 layout engine 외부 contract 로 다시 노출.
- `order_num` 사용 (children[] index 만).
- canonical traversal 결과를 또 다시 map 으로 캐시 (Phase 6 benchmark 결과로 도입
  여부 결정).

검증:

```bash
rg -n "DFSContext|elementsMap|childrenMap" \
  apps/builder/src/builder/workspace/canvas/layout

pnpm -F @composition/builder exec vitest run \
  src/builder/workspace/canvas/layout

# render benchmark
pnpm -F @composition/builder exec vitest run \
  src/builder/workspace/canvas/__benchmarks__/renderLoop.bench.ts
```

완료 조건 (G2):

- `fullTreeLayout.ts` 내 `elementsMap`/`childrenMap` direct subscription 0건.
- canonical-native 전환 후 render loop 60fps 달성.
- 기존 map lookup 대비 latency +10% 이내. 초과 시 Phase 2-b 에서 scene snapshot
  캐시 또는 pre-built node list 도입 후 재측정.

## 7. Phase 3 — Preview UPDATE_ELEMENTS receive 제거

작업:

1. `apps/builder/src/preview/App.tsx` / `messageHandler.ts` 에서 canonical
   hydration guard 강화 — `UPDATE_CANONICAL_DOCUMENT` 수신 후에야 render 진입,
   미수신 상태에서는 명시적 loading state.
2. `messageHandler.ts:45` type def 와 `:300` case 처리 제거.
3. `preview/types/index.ts:71` type 제거.
4. Preview side browser smoke — create/edit/delete/reorder 시나리오 회귀 0.

검증:

```bash
rg -n "UPDATE_ELEMENTS" apps/builder/src/preview

pnpm -F @composition/builder exec vitest run \
  src/builder/hooks/__tests__/useIframeMessenger.canonical.test.ts \
  src/preview
```

완료 조건 (G3):

- `apps/builder/src/preview/**` 에서 `UPDATE_ELEMENTS` 0 hits.
- canonical hydration guard 가 미수신 상태에서 빈 화면 대신 loading state 출력.
- browser smoke create/edit/delete/reorder 회귀 0.

Browser smoke:

- Builder 진입 → canonical hydration 완료 대기 → Preview 첫 frame
- create/edit/delete/reorder 4 시나리오
- console/page errors 0

## 8. Phase 4 — Bootstrap fallback path canonical-only

작업:

1. `useIframeMessenger.ts:718-726` `!canonicalDoc` 분기 제거.
2. 대안: canonical document hydration 자체를 BuilderCore mount 시 보장
   (sync-then-publish pattern). canonical document 가 없는 시점에는 Preview 초기
   loading state 유지.
3. `sendElementsToIframe()` outbound caller 가 모두 제거되면 함수 자체 제거.

금지:

- canonical document 부재 시 legacy `Element[]` 를 임시 hydrate 하는 fallback.
- `UPDATE_ELEMENTS` outbound 재도입.

검증:

```bash
rg -n "sendElementsToIframe|UPDATE_ELEMENTS" \
  apps/builder/src/builder/hooks/useIframeMessenger.ts \
  apps/builder/src/builder/main/BuilderCore.tsx

pnpm -F @composition/builder exec vitest run \
  src/builder/hooks/__tests__/useIframeMessenger.canonical.test.ts \
  src/builder/main/BuilderCore.static.test.ts
```

완료 조건:

- `sendElementsToIframe` production caller 0건.
- `UPDATE_ELEMENTS` outbound 0건.
- BuilderCore mount → canonical hydration → Preview 첫 frame 흐름이 deterministic.

## 9. Phase 5 — order_num 갱신 path 제거

작업:

1. `apps/builder/src/builder/stores/elements.ts:1414-1456` move fallback 의
   `order_num` 필드 갱신 제거.
2. move 연산 primary path 가 canonical `children[]` splice 를 통과하는지 확인
   (`canonicalMutations.ts::moveElementCanonicalPrimary` 또는
   `applyElementOrderCanonicalPrimary`).
3. legacy store cache `elements[]` reorder 는 canonical splice 결과에서 derived 로
   재구성.
4. ADR-122 HC.5 grep gate 추가:

```bash
rg -n "order_num" \
  apps/builder/src/builder/stores/elements.ts \
  apps/builder/src/builder/stores/utils \
  -g '*.ts'
```

금지:

- `order_num` 필드 재도입 (ADR-122 HC.5).
- canonical splice 우회 path 신설.

검증:

```bash
pnpm -F @composition/builder exec vitest run \
  src/builder/stores/__tests__/elementMove.test.ts \
  src/adapters/canonical/__tests__/canonicalMutations.test.ts
```

완료 조건 (G4):

- `elements.ts` move 연산에서 `order_num` 필드 기록 0건.
- canonical `children[]` splice 가 primary path.
- ADR-122 HC.5 grep gate 통과.

## 10. Phase 6 — Final verification

검증:

```bash
pnpm -F @composition/builder exec vitest run \
  src/adapters/canonical/__tests__ \
  src/builder/stores/canonical \
  src/builder/workspace/canvas/layout \
  src/builder/workspace/canvas/scene
pnpm -F @composition/shared exec vitest run src/utils
pnpm run codex:preflight

# render benchmark
pnpm -F @composition/builder exec vitest run \
  src/builder/workspace/canvas/__benchmarks__/renderLoop.bench.ts
```

Browser smoke checklist:

- 새 page/body/element 생성 후 refresh persistence
- sibling reorder / cross-page reparent / slot fill reorder
- component origin delete / page delete / instance materialization
- `Go to component` / `Select instances` cross-page selection
- Preview render parity (Skia ↔ DOM 시각 동일)
- Skia render 60fps 유지
- console/page errors 0

문서 sync:

- ADR-125 본문 Status / Gate 결과 갱신
- 본 breakdown phase status 갱신
- `docs/adr/README.md` row 갱신
- `docs/CHANGELOG.md` 변경 내역 추가
- `.claude/rules/canvas-rendering.md` canonical-native render input contract 항목 추가

완료 조건 (G5):

- `pnpm run codex:preflight` 통과
- browser smoke 7 시나리오 회귀 0
- targeted vitest 전부 PASS
- render loop 60fps 유지

## 11. Completion Definition

ADR-125 완료 조건:

1. layout engine 입력 contract 가 canonical-native (map shape direct contract 0).
2. Preview `UPDATE_ELEMENTS` receive type 제거 (compatibility receive 포함).
3. Builder→Preview active channel 이 `UPDATE_CANONICAL_DOCUMENT` 단일.
4. element move 연산에서 `order_num` 갱신 0 (ADR-122 HC.5 closure).
5. render loop 60fps 유지 (Phase 2 + Phase 6 benchmark gate 통과).
6. browser smoke 7 시나리오 회귀 0.

ADR-126 prerequisite 충족: render input contract 가 canonical-native 이므로
ADR-126 의 Element type deprecate 가 진입 가능한 상태.
