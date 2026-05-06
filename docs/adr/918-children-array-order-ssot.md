# ADR-918: children 배열 순서 기반 ordering SSOT 전환

## Status

Proposed — 2026-05-06

## Context

ADR-916 이후 `CompositionDocument`가 canonical document SSOT가 되었지만, sibling
order는 여전히 여러 runtime 경로에서 legacy `order_num` metadata에 의존한다. 최근
page 추가 순서와 Home 삭제 불가 판정은 `order_num` 보정으로 hotfix 되었지만, 이
접근은 page에만 국한된 임시 조치다.

Pencil-compatible format 근거는 더 넓다. Pencil format model은 top-level
`children`을 root scenegraph로 정의하고, frame/group-like node의 공통 필드도
`children`을 child node 저장소로 둔다
(`docs/pencil-copy/format-model.md:10`, `docs/pencil-copy/format-model.md:48`).
UI association 문서는 `children`이 Layers tree, canvas render order, slide order를
구동하며, `children` 재정렬이 layer/layout order 변경이라고 명시한다
(`docs/pencil-copy/format-ui-associations.md:9`). UI state도 root/nested
`children`, slide frame list, slot fill children에서 파생된다
(`docs/pencil-copy/format-ui-associations.md:31`).

따라서 이 ADR의 범위는 page order만이 아니다. canonical/Pencil structural tree에서
순서를 갖는 모든 `children` 배열이 범위다.

범위에 포함되는 ordering surface:

1. `CompositionDocument.children`: page-like presentation root의 page/frame/slide
   순서. reusable catalog root는 page order에서 제외한다.
2. `FrameNode.children`: frame, group, layout container, body 하위 structural child 순서.
3. reusable component origin/master의 `children`: origin layer/render/layout 순서.
4. `RefNode.descendants[slotPath].children`: component instance slot fill 순서.
5. LayerTree/PageTree/Frame tree projection, Skia render order, hit-test priority,
   drag/drop insertion index.
6. Preview iframe과 Publish runtime의 page tree/render tree ordering.
7. legacy Element projection의 `parent_id` sibling order와 `childrenMap` ordering.

범위에서 제외하거나 별도 판단할 ordering surface:

- CSS `z-index`, explicit stacking context, paint-only layering: structural tree order와
  별도 속성으로 유지한다. 단 render/hit-test의 effective stacking order는
  `z-index`를 1차 key로, `children[]` index를 stable tie-breaker로 사용한다.
- collection data item order(`items`, Table row/column data, API collection records):
  canonical structural node로 materialize된 child가 아닌 한 이 ADR의 primary SSOT로
  편입하지 않는다. 단, 구조 child로 projection되는 ListBox/GridList/Select template
  ordering은 Phase 0 inventory에서 분류한다.
- migration-only legacy fixture ordering: import/export boundary에서만 허용한다.

**Hard Constraints**:

1. canonical structural order의 최종 SSOT는 parent `children[]` 배열 index여야 한다.
2. `order_num`은 import/export/legacy DB/API compatibility boundary에서 파생되는 mirror
   값으로만 남겨야 하며, runtime ordering decision의 primary key가 되면 안 된다.
3. render와 hit-test는 동일한 effective order 계약을 공유해야 한다. 기본 structural
   order는 `children[]` index이고, 명시적 `z-index`가 있으면 `z-index` 오름차순 +
   `children[]` index tie-breaker를 effective render order로 사용한다. Pencil renderer는
   viewport `children`을 앞에서 뒤로 렌더하고
   (`docs/pencil-extracted/engine/15_skia-renderer.txt:194`), selection은
   effective child order의 뒤에서부터 역순 탐색한다
   (`docs/pencil-extracted/engine/13_selection-manager.txt:355`).
4. drag/drop reorder는 target parent와 insertion index를 `children[]` splice로 표현해야
   한다. Pencil drag model도 original index, `findInsertionIndexInLayout`,
   `deferredDropChildIndex`를 사용한다
   (`docs/pencil-copy/drag-drop-analysis.md:48`,
   `docs/pencil-copy/drag-drop-analysis.md:67`,
   `docs/pencil-copy/drag-drop-analysis.md:87`).
5. slot fill은 `descendants[slotPath].children` append order를 보존해야 한다. 같은
   `ref`를 다시 삽입해도 기존 child를 replace하지 않는다
   (`docs/pencil-copy/slot-model.md:46`).
6. Home/non-deletable page identity는 order 위치가 아니라 slug/root identity로 판정해야
   한다.

**Soft Constraints**:

- direct cutover 이전까지 legacy `Element.order_num`을 완전히 삭제하지 않는다. 외부
  export, 오래된 fixture, API service, test helper 호환성을 phased mirror로 처리한다.
- 기존 page/frame/component 회귀를 다시 열지 않도록 page hotfix는 Phase 2 완료 전까지
  compatibility fallback으로 유지할 수 있다.
- collection item ordering은 structural node ordering과 섞지 않고 별도 분류/후속 ADR
  후보로 남긴다.

**2026-05-06 local main 반영 상태**:

- ADR 작성 이후 local main에는 partial 선행 패치가 들어왔다. canonical upsert는 기존
  node를 같은 `children[]` 위치에서 replace하고, 신규 child만 append하는 방향으로 보강됐다
  (`apps/builder/src/adapters/canonical/canonicalMutations.ts:291`,
  `apps/builder/src/adapters/canonical/canonicalMutations.ts:307`).
- export boundary는 canonical child 순회 index를 legacy `order_num`으로 파생하는 경로를
  이미 사용한다
  (`apps/builder/src/adapters/canonical/exportLegacyDocument.ts:55`,
  `apps/builder/src/adapters/canonical/exportLegacyDocument.ts:161`).
- component origin persistence/round-trip은 `reusable: true`를 legacy
  `componentRole: "master"` mirror로 내보내고, page-owned origin을 root reusable catalog로
  끌어올리지 않도록 보강됐다
  (`apps/builder/src/adapters/canonical/canonicalMutations.ts:501`,
  `apps/builder/src/adapters/canonical/canonicalMutations.ts:874`).
- 단, 이 선행 패치는 full cutover가 아니다. `buildTreeFromElements`, LayerTree projection,
  drag/drop order write, Preview/Publish render path에는 여전히 `order_num` primary
  sort/write가 남아 있으므로 ADR-918의 Phase/Gate는 유지한다.

## Alternatives Considered

### 대안 A: `children[]` index를 canonical ordering SSOT로 전환

- 설명: parent node의 `children[]` 배열 순서를 모든 structural order의 기준으로 삼고,
  legacy `order_num`은 adapter/export/DB boundary에서 index로 파생한다.
- 근거: Pencil format과 UI association이 root/nested/slot `children`을 Layers, render,
  slide, slot fill order의 source로 둔다.
- 위험:
  - 기술: M — canonical adapter, LayerTree, render input, drag/drop, slot descendants를
    같은 계약으로 수렴해야 한다.
  - 성능: L — array index 기반 read는 현행 `childrenMap`과 동일하거나 단순하며, O(n)
    reorder는 기존 sibling reorder와 같은 범주다.
  - 유지보수: L — order 결정 규칙이 하나로 줄어든다.
  - 마이그레이션: M — legacy projects와 fixtures는 hydrate 시 `order_num`을 기준으로
    최초 `children[]`를 정규화해야 한다.

### 대안 B: `order_num`을 canonical metadata로 계속 유지

- 설명: page hotfix처럼 canonical node metadata에 `order_num`을 보존하고, projection마다
  `order_num` sort를 유지한다.
- 근거: 현행 Element/DB/API/test fixture와 맞아 즉시 변경량이 작다.
- 위험:
  - 기술: M — canonical document와 metadata mirror가 서로 다른 order를 가질 수 있다.
  - 성능: L — 기존 sort 비용을 유지한다.
  - 유지보수: H — page, layer, slot, component마다 sort fallback과 special case가
    늘어난다.
  - 마이그레이션: L — 기존 데이터 구조와 가장 가깝다.

### 대안 C: surface별 hybrid reconciliation 유지

- 설명: page는 `order_num`, LayerTree는 `childrenMap`, render는 canonical tree, slot은
  descendants order처럼 surface별로 local rule을 유지하고 동기화 helper로 reconcile한다.
- 근거: 각 UI surface의 단기 회귀를 독립적으로 패치할 수 있다.
- 위험:
  - 기술: H — 동일 document가 surface마다 다른 순서로 보일 수 있다.
  - 성능: M — projection마다 재정렬/reconcile 비용과 invalidation이 추가된다.
  - 유지보수: H — ordering bug가 재발할 때 root cause가 source인지 projection인지
    구분하기 어렵다.
  - 마이그레이션: M — 단계별로는 쉬워 보이나 마지막 dual-source 제거가 지연된다.

### Risk Threshold Check

| 대안 | 기술 | 성능 | 유지보수 | 마이그레이션 | HIGH+ 개수 |
| ---- | ---- | ---- | -------- | ------------ | :--------: |
| A    | M    | L    | L        | M            |     0      |
| B    | M    | L    | H        | L            |     1      |
| C    | H    | M    | H        | M            |     2      |

루프 판정: 대안 B/C는 HIGH가 1개 이상이므로 장기 primary path로 채택하지 않는다.
대안 A는 모든 축이 MEDIUM 이하이고, compatibility mirror를 phase boundary에 한정하면
현행 page hotfix를 전체 tree ordering 전환으로 안전하게 확장할 수 있다.

## Decision

**대안 A: `children[]` index를 canonical ordering SSOT로 전환**을 선택한다.

선택 근거:

1. Pencil-compatible document model과 Composition canonical document가 같은 ordering
   계약을 갖게 된다.
2. page-only `order_num` 보정으로 해결한 증상을 frame/body/component/slot children까지
   일반화할 수 있다.
3. render/hit-test/LayerTree/drag-drop이 모두 parent child index를 공유하면 refresh 후
   projection drift와 Home/order special case가 줄어든다.

기각 사유:

- **대안 B 기각**: `order_num`을 계속 primary로 두면 canonical `children[]`와 metadata
  mirror 중 어느 쪽이 진짜 순서인지 다시 불명확해진다.
- **대안 C 기각**: surface별 reconciliation은 이번 회귀의 원인인 projection drift를
  제도화한다.

> 구현 상세: [918-children-array-order-ssot-breakdown.md](design/918-children-array-order-ssot-breakdown.md)

## Residual Risks

- legacy DB/API/export payload는 아직 `order_num` 필드를 기대하는 경로가 있다. 이 ADR은
  삭제가 아니라 derived mirror 격리부터 수행한다.
- collection item ordering과 structural node ordering이 섞인 기존 컴포넌트는 Phase 0에서
  분류가 필요하다. structural child는 ADR-918 범위, data item order는 별도 범위로 둔다.
- drag 중 transient reorder를 canonical document에 반영하는 시점과 undo history commit
  시점을 분리하지 않으면 history noise가 생길 수 있다.
- 현재 `shouldPreserveExistingCanonicalPosition` 계열 선행 패치는 metadata/order가 동일한
  기존 node의 위치 보존에는 충분하지만, 명시적 reorder를 표현하는 API는 아니다. explicit
  reorder/cross-container move는 별도 `children[]` splice/move helper로 닫아야 한다.
- 현재 selection hit-test 보강은 depth/area 우선 정책을 포함한다. ADR-918의 최종 G3는
  render와 hit-test가 동일한 effective child order(`z-index` + `children[]` index
  tie-breaker)를 공유하는지 다시 검증해야 한다.

## Gates

| Gate                         | 시점         | 통과 조건                                                                                                                                                                                                  | 실패 시 대안                          |
| ---------------------------- | ------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------- |
| G0: inventory baseline       | Phase 0 종료 | `order_num`, `childrenMap`, sibling sort, drag insertion index call site를 adapter/legacy/structural/collection/test bucket으로 분류                                                                       | 구현 착수 금지                        |
| G1: canonical helpers        | Phase 1 종료 | parent `children[]` read/insert/move/remove helper와 derived `order_num` mirror helper가 생기고 unit test가 통과                                                                                           | page hotfix 유지, helper 재설계       |
| G2: page/root cutover        | Phase 2 종료 | PageTree/root page order와 Home delete policy가 `children[]` order + identity 기준으로 동작, metadata `order_num` primary sort 제거                                                                        | page path만 rollback                  |
| G3: render/runtime cutover   | Phase 3 종료 | LayerTree, Skia render/hit-test, Preview iframe, Publish runtime이 같은 structural/effective child order 계약을 사용. depth/area 등 local hit-test heuristic은 최종 effective order와 충돌하지 않음을 증명 | affected projection slice rollback    |
| G4: drag/drop cutover        | Phase 4 종료 | same-container/cross-container reorder가 target parent `children[]` splice와 insertion index로 저장되고 undo는 1 user action                                                                               | drag transient update 비활성 fallback |
| G5: component/slot cutover   | Phase 5 종료 | origin/instance/slot descendants order가 `children[]` append/move 계약을 보존하고 duplicate ref slot fill이 유지됨                                                                                         | slot write path rollback              |
| G6: legacy mirror quarantine | Phase 6 종료 | non-adapter runtime에서 `order_num` primary ordering decision이 allowlist 0 또는 명시 예외만 남음                                                                                                          | `order_num` mirror 격리 범위 재조정   |

## Consequences

### Positive

- page뿐 아니라 frame/body/component/slot children까지 같은 ordering model을 공유한다.
- Pencil import/export, Builder LayerTree, Skia render/hit-test의 순서 계약이 맞춰진다.
- `order_num` drift로 인한 refresh 후 순서/삭제 정책/selection mismatch 가능성이 줄어든다.

### Negative

- legacy Element와 canonical document 사이의 projection boundary를 여러 파일에서 정리해야
  한다.
- `order_num`을 즉시 삭제하지 않기 때문에 Phase 6 전까지는 mirror write/read 허용 범위
  관리가 필요하다.
- collection data item ordering은 structural order와 별도 결정을 유지하므로 Phase 0에서
  명확한 bucket 분류가 필요하다.
