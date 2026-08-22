# ADR-188: 타깃 레이아웃 입력과 Skia 서브트리 패치

## Status

Accepted — 2026-08-22

Related: [ADR-187 에디터 프레젠테이션 트랜잭션과 타입 기반 무효화](187-editor-presentation-transaction-and-typed-invalidation.md)

## Context

ADR-187 Phase 4는 paint lane과 layout lane을 분리했지만, 현재 Builder의 layout
publisher와 Skia consumer는 여전히 whole-tree 계약이다. `useLayoutPublisher`는 visible
page/frame 입력을 전체 순회하고 `getCachedPageLayout()`을 호출한다. cache miss에서는
`calculateFullTreeLayoutFromSceneModel()`이 root DFS batch를 만들며, 최종 결과는
`getLayoutsBatch()`로 전체 수집된다. layout map 발행은 global version을 증가시키고
`StoreRenderBridge`의 `resync(true)`를 호출하며, command stream cache miss는 전체
`buildRenderCommandStream()` DFS와 `hitBoundsMap` 재생성으로 이어진다.

현재 Phase 4에서 추가한 `getLayoutsForIds()`와 `computeDirtyLayoutForIds()`는 결과
수집과 persistent dirty-cache 경계만 줄인다. layout input 구성, publication version,
Skia draw command span, hit-test map은 아직 N-dependent다. 이 상태에서
`publishPresentationLayout()`을 기존 publisher에 직접 연결하면 ADR-187의 G6을
전역 version bump/full rebuild로 통과시키는 잘못된 fallback이 된다.

이 결정은 D3 시각 스타일의 Builder(Skia) 소비자와 layout runtime 경계를 다룬다. D1
DOM 접근성 semantics와 D2 public component props는 변경하지 않는다. layout result와
renderer patch contract가 새로 생기지만 canonical document schema와 persistence
schema는 변경하지 않는다.

**Hard Constraints**:

1. targeted layout의 layout-input 구성, published map write, command/hit patch 비용은
   전체 visible node 수 `N`이 아니라 affected subtree `k`와 promoted ancestor 수에
   비례해야 한다. published map write는 affected node 수를 초과할 수 없다 — 이전 layout
   map 전체를 복사한 뒤 그 위에 affected 값을 덮어쓰는 publish는 값·identity 보존을
   만족하더라도 이 제약을 만족하지 못한다.
2. 위 상한은 **호출부 경계**의 계약이다. 현행 엔진의 증분 skip 게이트는 clean 서브트리를
   건너뛸지 판정하기 위해 그 서브트리를 순회하므로, `compute_layout()` 1회의 노드 방문은
   `k`가 아니라 `N`에 비례한다. 이 항을 `k` 비례로 위장하지 않고 별도 예산으로 관리한다:
   `N`=5,000·dirty leaf 1개 기준 엔진 walk가 hard constraint 4의 frame 예산 25%(1ms)를
   넘으면, skip 판정을 `O(1)` 요약 플래그로 바꾸는 엔진 선행 작업이 Phase 1의 필수 범위가
   된다.
3. targeted presentation publish는 global `layoutVersion` 증가, `StoreRenderBridge.sync(true)`,
   whole-scene command stream rebuild를 발생시키지 않아야 한다.
4. 120Hz 기준 presentation apply p95는 4ms 이하, p99는 8.33ms 미만이어야 한다. targeted
   publication은 monotonic revision을 **값으로 보유**하고, draw geometry와 hit-test
   geometry는 같은 revision 값을 읽는다 — 두 소비자가 서로 다른 revision을 관측할 수 있는
   중간 상태를 만들지 않으며(원자 교체), 도착 순서가 어긋났거나 base가 이미 retire된
   patch는 적용하지 않고 거부한다.
5. 비영향 layout node의 값과 object identity, canonical document/history/persist
   경로는 유지되어야 한다. 실패한 capability는 stale 화면을 만들지 않고 commit-only로
   fail-closed해야 한다.

**Soft Constraints**:

- 기존 `PersistentTaffyTree`, `editorPresentationLayoutLane`, command stream 구조를
  재사용하고 새 layout engine을 병렬로 복제하지 않는다.
- CanvasKit/Skia 자원 수명과 기존 page/frame multi-root 계약을 유지한다.
- Phase별 rollback이 가능하고 ADR-187 paint pilot의 성공 경로를 건드리지 않는다.

## Alternatives Considered

### 대안 A: 기존 full-tree publisher를 그대로 확장

- 설명: `publishPresentationLayout()`이 기존 `publishLayoutMap(s)`를 호출하고
  `layoutVersion`과 full StoreRenderBridge sync를 허용한다.
- 근거: 현재 `TaffyTree::compute_layout`은 root에서 계산하고 computed layout을
  조회하는 단순한 API를 제공한다 ([TaffyTree API](https://docs.rs/taffy/latest/taffy/struct.TaffyTree.html)).
- 위험:
  - 기술: MEDIUM — 기존 API 재사용은 쉽지만 targeted input 계약이 없다.
  - 성능: CRITICAL — `N` 전체 DFS, full sync, command stream rebuild가 유지된다.
  - 유지보수: HIGH — paint/layout 분리 규칙이 전역 fallback에 의해 다시 깨진다.
  - 마이그레이션: LOW — 변경량은 작지만 잘못된 성능 계약을 고착한다.

### 대안 B: typed targeted layout + Skia subtree patch

- 설명: dirty-root/result set, revision을 값으로 갖는 typed layout publication
  overlay, element subtree span, clip-aware hit-test patch를 하나의 명시적
  contract로 추가한다. publication은 base map을 복사하지 않고 affected delta만
  보유하며, draw와 hit-test는 같은 revision snapshot을 원자적으로 교체한다.
  span/clip/z-order 전제가 충족되지 않는 descriptor는 patch하지 않고 commit-only로
  남긴다.
- 근거: Skia의 `SkPicture`는 drawing command를 기록하고 전체 또는 일부 playback할 수
  있으며, immutable picture와 cull rect를 명시한다 ([SkPicture reference](https://api.skia.org/classSkPicture.html),
  [SkPictureRecorder reference](https://api.skia.org/classSkPictureRecorder.html)). 이는
  기존 command stream을 무조건 복제하는 대신 검증된 subtree span만 재기록/재생하는
  경계를 설계할 근거가 된다. Taffy도 persistent tree의 `mark_dirty`와 layout 조회를
  별도 API로 노출한다 ([TaffyTree methods](https://docs.rs/taffy/latest/taffy/struct.TaffyTree.html#methods)).
- 위험:
  - 기술: HIGH — parent used-size, text intrinsic, clip, sticky/scroll, z-order가
    모두 일치해야 한다.
  - 성능: MEDIUM — 성공 시 `O(k)`이지만 span 재기록과 clip context 비용을 계측해야 한다.
  - 유지보수: MEDIUM — layout publication과 renderer patch schema가 추가된다.
  - 마이그레이션: HIGH — command stream/hit-test 소비자와 rollback 경계를 함께 바꿔야 한다.

### 대안 C: 별도 layout/renderer scene을 병렬 구축

- 설명: presentation overlay 전용 scene과 layout engine을 새로 만들고 canonical
  scene과 병합한다.
- 근거: 독립 scene은 consumer별 최적화에는 유리하지만, Taffy의 layout tree와 Skia의
  picture playback이 이미 제공하는 cache/ownership 경계를 중복한다.
- 위험:
  - 기술: HIGH — CSS layout semantics와 ref/page/frame projection을 이중 구현한다.
  - 성능: MEDIUM — 작은 `k` 경로는 빠를 수 있으나 scene merge가 추가된다.
  - 유지보수: CRITICAL — canonical/DOM/Skia 세 결과의 drift를 장기적으로 관리해야 한다.
  - 마이그레이션: HIGH — 기존 scene, hit-test, Preview parity를 전면 재검증해야 한다.

### 대안 D: layout continuous preview를 지원하지 않고 commit-only 유지

- 설명: ADR-187 paint lane만 production으로 유지하고 layout/structure descriptor는
  canonical commit 후에만 반영한다.
- 근거: 현재 엔진 경계를 침범하지 않으며, ADR-187 breakdown도 targeted layout이
  불가능하면 continuous migration을 보류하도록 명시한다.
- 위험:
  - 기술: LOW — 새 renderer contract가 없다.
  - 성능: LOW — drag 중 layout work가 없다.
  - 유지보수: MEDIUM — layout slider 사용자 경험과 ADR-187의 전체 목표가 미완료다.
  - 마이그레이션: LOW — rollback이 단순하다.

### Risk Threshold Check

| 대안 | 기술   | 성능     | 유지보수 | 마이그레이션 | HIGH+ 개수 |
| ---- | ------ | -------- | -------- | ------------ | :--------: |
| A    | MEDIUM | CRITICAL | HIGH     | LOW          |     2      |
| B    | HIGH   | MEDIUM   | MEDIUM   | HIGH         |     2      |
| C    | HIGH   | MEDIUM   | CRITICAL | HIGH         |     3      |
| D    | LOW    | LOW      | MEDIUM   | LOW          |     0      |

대안 D가 낮은 위험을 가지지만 hard constraint 1\~4와 layout continuous preview 목표를
충족하지 못한다. 대안 C는 새 scene 중복으로 CRITICAL 유지보수 위험을 추가한다. 따라서
첫 루프에서 대안을 더 추가하지 않고, 대안 B를 **capability allowlist + fail-closed
fallback + 단계별 G0\~G6**으로 제한해 잔존 HIGH를 gates로 관리한다.

## Decision

**대안 B: typed targeted layout + Skia subtree patch**를 선택한다.

선택 근거:

1. ADR-187이 요구한 `N`과 `k`의 비용 분리를 layout input부터 hit-test까지 보존한다.
2. 기존 persistent tree와 Skia picture/command ownership을 재사용하므로 대안 C의
   병렬 scene drift를 피한다.
3. 구현 불가능한 descriptor를 전역 full-rebuild fallback으로 숨기지 않고
   commit-only로 유지해 성능 계약을 정직하게 보존한다.
4. G3/G4에서 draw span과 hit bounds가 같은 revision을 소비하지 못하면 해당
   capability를 production에 승격하지 않으므로 시각·인터랙션 split-brain을 차단한다.
5. 엔진 증분 skip 게이트의 `N` 비례 walk를 `k` 비례로 뭉뚱그리지 않고 hard constraint
   2의 독립 예산으로 분리했다. 호출부 counter만 GREEN이고 엔진 항이 그대로 남는 위장
   통과를 G0/G1에서 구조적으로 배제한다.
6. publication을 base map 복사가 아닌 affected delta overlay로 두고 revision을 값으로
   실어, ADR-187 paint lane이 이미 운용 중인 sequence/terminal-revision 거부 규칙을
   재발명 없이 layout lane으로 확장한다.

기각 사유:

- **대안 A 기각**: 기존 full-tree publisher를 재사용하면 ADR-187 G6을 위반하고
  color-picker에서 제거한 N-dependent 승격을 layout lane에 재도입한다.
- **대안 C 기각**: canonical layout/Skia/Preview의 세 번째 scene SSOT를 만들며
  ref/page/frame과 intrinsic text semantics를 이중 구현한다.
- **대안 D 기각(단기 fallback으로만 보존)**: 현재 안전하지만 layout slider의
  continuous preview 목표를 포기한다. capability별 실패 시 fallback으로는 허용한다.

> 구현 상세: [188-targeted-layout-and-skia-subtree-patching-breakdown.md](design/188-targeted-layout-and-skia-subtree-patching-breakdown.md)

## Risks

| ID  | 위험                                                                                                                                                                                                                                                                    | 심각도 | 대응                                                                                                                                                                                                                                                        |
| --- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | :----: | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| R1  | parent used-size/intrinsic propagation 누락으로 subtree 결과와 in-flow 형제가 stale해짐. 경로: `editorPresentationLayoutLane.ts`, `editorMutationEffectRegistry.ts`, `persistentTaffyTree.ts`                                                                           |  HIGH  | promotion 판정을 registry `usedSizeEffect` 축 × container 재분배 규칙의 합성으로 고정(구현 상세 §4.1.2). G1에서 형제 포함·승격 종료 조건을 런타임 판정으로 검증하고, 두 축 중 값이 없는 descriptor는 allowlist에서 제외                                     |
| R2  | command span 교체와 clip/z-order context가 어긋나 draw와 hit-test가 달라짐. 경로: `renderCommands.ts`, `skiaFramePipeline.ts`, `SkiaCanvas.tsx`                                                                                                                         |  HIGH  | 구간 연속성·길이 보존·clip context 불변·z-order 불변 4전제를 patch 선행 조건으로 두고(§4.3.2), publication의 `presentationRevision`/`baseCanonicalRevision`을 draw·hit 양쪽이 읽게 한다. G3/G4에서 각 전제의 negative fixture가 전부 거부로 판정되어야 한다 |
| R3  | targeted publication이 global version/full sync로 승격되어 N-dependent 비용이 재발함. 경로: `fullTreeLayout.ts`, `StoreRenderBridge.ts`, `renderCommands.ts`                                                                                                            |  HIGH  | typed event static guard + G2 counter에서 `layoutVersion++`, `sync(true)`, full stream rebuild을 0으로 단언                                                                                                                                                 |
| R4  | CanvasKit picture/command 자원 수명이 patch cache보다 짧거나 길어 stale/OOB가 발생함. 경로: `SkiaCanvas.tsx`, `renderCommands.ts`, `skiaFramePipeline.ts`                                                                                                               | MEDIUM | G3 cache ownership/release fixture, unmount/page switch/rollback rehearsal, DEV leak counter                                                                                                                                                                |
| R5  | Preview DOM은 canonical commit을 먼저 소비하고 Skia overlay가 늦게 retire되어 flash가 발생함. 경로: `editorPresentationRuntime.ts`, `SkiaCanvas.tsx`, Preview delta bridge                                                                                              | MEDIUM | ADR-187 committed revision latch를 재사용하고 G5 finish-before-document/document-before-finish를 재실행                                                                                                                                                     |
| R6  | 엔진 증분 skip 게이트가 clean 서브트리를 순회해 판정하므로 `compute_layout()` 1회의 방문이 `N` 비례로 남고, 호출부 counter만으로는 GREEN이 되어 성능 계약이 위장 통과함. 경로: `packages/composition-engine/src/tree.rs`, `persistentTaffyTree.ts`, `fullTreeLayout.ts` |  HIGH  | hard constraint 2의 독립 예산으로 관리 — G0에서 `N`=5,000·dirty leaf 1개 walk를 실측하고, frame 예산 25% 초과 시 subtree-dirty 요약 플래그(`O(1)` 판정) 엔진 작업을 Phase 1 필수 범위로 승격                                                                |
| R7  | targeted publish가 이전 layout map 전체를 복사한 뒤 affected 값을 덮어써, 값·identity는 보존하면서 map write가 `N` 비례로 남음. 경로: `editorPresentationLayoutLane.ts`, `useLayoutPublisher.ts`, `fullTreeLayout.ts`                                                   |  HIGH  | publication을 base 복사 없는 affected delta overlay로 고정(§4.2.1)하고, G2에서 write 수 ≤ affected 수 및 base map 복사 0을 단언                                                                                                                             |
| R8  | page/frame에 걸친 다중 선택에서 publication이 rootKey별로 분할되지 않아 다른 rootKey의 node를 덮어쓰거나 그룹의 일부만 적용됨. 경로: `useLayoutPublisher.ts`, `fullTreeLayout.ts`, `editorPresentationLayoutLane.ts`                                                    | MEDIUM | rootKey별 publication 분할 + publisher 파생식 단일화 + `planSequence` 그룹 원자성(§4.2.2). G2에서 경계 위반 0건과 부분 적용 0건을 단언                                                                                                                      |

## Gates

| Gate | 시점    | 통과 조건                                                                                                                                                                                                  | 실패 시 대안                                                                      |
| ---- | ------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------- |
| G0   | Phase 0 | N=50/500/5,000 baseline과 negative contract 고정, 엔진 skip walk(`N`=5,000·dirty leaf 1개) 실측 기록, 기존 paint G5 회귀 0                                                                                 | 설계 보강 후 재측정. walk가 frame 예산 25% 초과면 엔진 선행 작업을 Phase 1에 편입 |
| G1   | Phase 1 | targeted input 방문·affected result가 fixture와 일치, promotion이 런타임 판정으로 in-flow 형제를 포함하고 크기 확정 조상에서 멈춤, 호출부 방문 counter와 엔진 walk 항을 분리 계측, unrelated identity 유지 | 해당 descriptor commit-only                                                       |
| G2   | Phase 2 | presentation event가 global version/full sync를 올리지 않음, publication write 수 ≤ affected 수·base map 복사 0, rootKey 경계 위반 0·그룹 부분 적용 0                                                      | 대안 D                                                                            |
| G3   | Phase 3 | subtree span patch가 draw command와 clip/z-order context를 보존, 4전제(연속성·길이·clip·z-order) negative fixture가 전부 거부, resource leak 0                                                             | 대안 D                                                                            |
| G4   | Phase 3 | draw bounds와 hitBoundsMap이 동일 revision 값을 보유하고 한 번에 교체됨, stale·out-of-order patch 거부가 누락 0                                                                                            | 해당 descriptor commit-only                                                       |
| G5   | Phase 4 | ADR-187 runtime과 finish/cancel/revision latch 정합, paint lane counter 불변                                                                                                                               | ADR-187 layout allowlist 축소                                                     |
| G6   | Phase 5 | populated Builder split Preview live parity, 120Hz p95 `<4ms`, p99 `<8.33ms`, console error/warn 0                                                                                                         | 대안 D 및 별도 재설계 검토                                                        |

## Implementation Progress

- **Phase 0 / G0 — Complete (2026-08-22)**: N=50/500/5,000 whole-tree baseline,
  engine `subtree_has_dirty` walk counter, targeted full-sync negative contract,
  and ADR-187 paint regression tests are fixed in
  [G0 evidence](design/188-phase-0-g0-baseline.md). N=5,000·dirty leaf 1개에서
  engine skip walk p95 22.720ms가 측정되어 1ms 예산을 초과했다. 따라서 Phase 1의
  Rust subtree-dirty 요약 플래그 작업은 조건부가 아니라 필수 선행 범위다.
- **Phase 1 / G1 — Implemented (2026-08-22)**: Rust subtree-dirty summary와 dirty
  전파/측정 snapshot 경계를 반영하고, registry `usedSizeEffect` × layout container
  규칙표 기반 runtime promotion, persistent targeted input/result API 및 분리 counter를
  추가했다. explicit sized ancestor stop, in-flow sibling 포함, absolute child/paint-only
  fail-closed를 검증했다. [G1 evidence](design/188-phase-1-g1-targeted-input.md)
- **Phase 2 / G2 — Implemented (2026-08-22)**: canonical-full과 presentation-targeted
  publication을 typed channel로 분리하고, affected delta만 보유하는 overlay와 root별
  revision을 추가했다. page/frame rootKey 파생을 공용 helper로 단일화했으며, multi-root
  plan은 `planSequence` group으로 원자 적용/거부한다. base map 전체 복사,
  `getSharedLayoutMap()` targeted base, full-sync callback은 static/runtime guard에서
  0건이다. [G2 evidence](design/188-phase-2-g2-publication.md)

## Consequences

### Positive

- layout presentation이 전체 scene publish와 분리되어 paint picker의 성능 계약을
  layout/structure 변경이 오염시키지 않는다.
- layout map, draw command, hit-test가 같은 affected set/revision을 공유해
  interaction split-brain을 구조적으로 검출할 수 있다.
- targeted capability를 점진적으로 allowlist에 추가하면서 실패 descriptor는
  commit-only로 안전하게 남길 수 있다.

### Negative

- layout publisher와 Skia command stream에 새 typed contract와 cache lifecycle이
  생긴다.
- parent propagation, text measurement, clip/sticky/scroll 같은 기존 full-tree
  암묵 전제를 명시적으로 테스트해야 한다.
- G0 실측 결과 엔진 증분 skip 판정을 `O(1)` 요약 플래그로 바꾸는 Rust 작업이
  Phase 1의 필수 범위로 확정됐다(5,000 node p95 22.720ms > 1ms 예산).
- publication이 base map을 복사하지 않으므로 layout map 소비자는 단일 `Map` 참조 대신
  overlay lookup 계약을 따라야 한다. publication은 rootKey별로 분할되므로 다중 선택
  소비자는 그룹 단위 적용/거부를 처리해야 한다.
- promotion 판정이 registry `usedSizeEffect` 축과 container 재분배 규칙표의 합성이 되므로,
  새 layout 속성을 추가할 때 두 축의 값을 함께 채워야 continuous allowlist에 들어간다.
- G6을 통과하기 전까지 layout slider는 일부 또는 전체가 commit-only일 수 있다.
