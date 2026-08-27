# ADR-188 구현 상세: 타깃 레이아웃 입력과 Skia 서브트리 패치

## 1. Fork checkpoint — ADR-187과의 경계

ADR-188은 ADR-187 Phase 4에서 증명된 **layout engine input과 Skia hit-test/command
consumer의 whole-tree 경계**만 분리한다. ADR-187의 session overlay, semantic target,
paint lane, Preview protocol, canonical finish commit은 선행 결정으로 유지한다.

1. **Base / 응용 분류**: ADR-187은 presentation transaction과 invalidation의 응용
   계약이고, ADR-188은 그 계약이 요구하는 targeted layout/renderer consumer의 base
   실행 경계다. ADR-188은 ADR-187의 prerequisite가 아니라, ADR-187의 paint 완료 뒤
   layout consumer를 제공하는 후속 base infrastructure다.
2. **Schema 직교성**: 두 ADR의 schema는 직교한다. ADR-187은 semantic mutation/session
   schema를, ADR-188은 layout result publication과 renderer patch span schema를
   정의한다. ADR-188은 ADR-187의 descriptor union을 확장하지 않는다.
3. **선행 ADR 전제 reverse 검증**: ADR-187의 `paint | layout | structure` lane 분리와
   `layoutVersion` 전역 bump 금지 전제는 유효하다. 그러나 ADR-187이 가정한 targeted
   layout entrypoint는 현재 `useLayoutPublisher`/Skia 구현에 존재하지 않으므로,
   `getLayoutsForIds()`만으로 충족됐다고 승계하지 않는다.
4. **3차 리뷰 대기 금지**: 위 세 전제를 본 fork 시점에 고정하고, 구현 phase를
   sub-phase 알파벳 분할 없이 G0~G6 단위로 검증한다. engine input, layout map,
   command stream, hit-test map의 각 경계를 1차 설계 검토에서 함께 검증한다.

## 2. Phase 개요

| Phase | 범위                                                                                                  | 산출물                                                                | 종료 Gate                              |
| ----- | ----------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------- | -------------------------------------- |
| 0     | 현재 whole-tree 경계 및 baseline 고정                                                                 | inventory, N-tier trace, 엔진 skip walk 실측, negative contract       | G0 — ✅ 2026-08-22 (P1 Rust 선행 필수) |
| 1     | persistent layout의 targeted input/result API (+ G0 초과 시 엔진 subtree-dirty 요약 플래그 선행 작업) | dirty-root propagation, affected result map, 호출부/엔진 분리 counter | G1                                     |
| 2     | layout publisher의 typed publication channel                                                          | base/full과 presentation/targeted 분리, delta overlay + revision 필드 | G2                                     |
| 3     | Skia subtree command span 및 hit-test patch                                                           | subtree render/hit projection patcher, revision 원자 교체             | G3/G4                                  |
| 4     | ADR-187 layout lane 연결과 fail-closed fallback                                                       | allowlist, rollback switch, no global bump                            | G5                                     |
| 5     | DOM/Skia parity 및 120Hz 성능 검증                                                                    | populated Builder trace, cross-check report                           | G6                                     |

## 3. 현재 경계와 문제 증거

경로는 모두 저장소 root 기준이다 (그대로 `rg`/`grep` 가능). 이하 문서 전체에서
`B = apps/builder/src/builder/`로 줄여 쓴다.

- `apps/builder/src/builder/workspace/canvas/hooks/useLayoutPublisher.ts:109-215`는
  page/frame 입력을 모두 순회하고 `getCachedPageLayout()` 결과를
  `publishLayoutMapsBatch()`로 발행한다.
- `apps/builder/src/builder/workspace/canvas/scene/layoutCache.ts:280`은 cache miss마다
  `calculateFullTreeLayoutFromSceneModel()`을 호출한다 (파일은 `layout/`이 아니라
  `scene/` 하위다).
- `apps/builder/src/builder/workspace/canvas/layout/engines/fullTreeLayout.ts:2449-2472`는
  항상 root DFS batch를 만들고, 같은 파일 `:3025`는 최종 결과를 `getLayoutsBatch()`로
  수집한다.
- `apps/builder/src/builder/workspace/canvas/skia/StoreRenderBridge.ts:429`의 layout
  listener는 모든 publish를 `resync(true)`로 승격한다.
- `apps/builder/src/builder/workspace/canvas/skia/renderCommands.ts:349-374`는
  `layoutVersion`이 바뀌면 전체 command stream DFS를 재생성한다.
  `apps/builder/src/builder/workspace/canvas/skia/SkiaCanvas.tsx:787`의 hit map도 전체
  frame plan 결과로만 교체된다.
- `apps/builder/src/builder/presentation/editorPresentationLayoutLane.ts:96`의
  `publishPresentationLayout()`은 이전 layout map 전체를 `new Map(previousLayoutMap)`으로
  복사한 뒤 affected 값을 덮어쓴다 — 값·identity는 보존되지만 map write는 `N` 비례로
  남는다 (§4.2.1).
- `packages/composition-engine/src/tree.rs`의 증분 skip 게이트 `subtree_has_dirty`는
  메모이즈되지 않은 재귀 walk이고 `propagate_dirty`가 조상 체인을 root까지 dirty로 올린다.
  dirty leaf 1개여도 `compute_layout()` 1회의 노드 방문은 `N` 비례다 (§4.1.1).
- `apps/builder/src/builder/presentation/editorPresentationLayoutLane.ts:20-33`의 lane
  인터페이스에는 revision/sequence 필드가 없다. 반면 paint lane은
  `apps/builder/src/builder/presentation/skiaEditorPresentationBridge.ts:22-28`에서
  `sequence`/`terminalRevision`으로 stale 거부를 이미 운용한다 (§4.3.1).

Phase 4의 `PersistentTaffyTree.getLayoutsForIds()`와
`computeDirtyLayoutForIds()`는 결과 수집 및 dirty cache 경계를 제공하지만, 위
입력 batch 생성과 renderer consumer를 targeted로 바꾸지는 않는다. 따라서 이 ADR은
"결과 몇 개만 읽기"가 아니라 **layout input → publication → draw span → hit-test
map** 전체를 하나의 typed contract로 정의한다.

## 4. 구현 계약

### 4.1 Targeted layout input

- `LayoutTargetSet`은 semantic target에서 승격된 `roots`, `affectedNodeIds`,
  `parentChain`을 immutable snapshot으로 보유한다.
- parent used-size 전파가 확인된 경우에만 root를 상향한다. 전체 document traversal로
  parent를 추정하지 않는다.
- persistent tree는 기존 node handle/style cache를 재사용하고, 새 input은 affected
  root/subtree에 한정한다.
- text intrinsic/resource 측정은 layout lane의 입력으로 명시한다. 측정 source가
  없으면 해당 descriptor를 continuous allowlist에서 제외한다.

#### 4.1.1 엔진 내부 방문 항의 분리 (hard constraint 2)

`k` 비례 주장은 **호출부 경계에만** 적용된다. 엔진 내부는 다음 이유로 `N` 비례다:

- `PersistentTaffyTree.computeDirtyLayoutForIds()`는 dirty 마킹 후 persistent root에서
  `computeLayout()`을 수행한다 (`apps/builder/src/builder/workspace/canvas/layout/engines/persistentTaffyTree.ts:432-448`).
- 엔진의 증분 skip 게이트 `subtree_has_dirty(handle)`는 메모이즈되지 않은 재귀 walk라
  clean 서브트리를 건너뛸지 판정하려고 그 서브트리를 끝까지 순회한다
  (`packages/composition-engine/src/tree.rs`).
- `propagate_dirty`가 조상 체인을 root까지 dirty로 올리므로, dirty leaf 1개여도 root가
  재solve되고 **clean 형제 서브트리마다 그 크기만큼 walk를 지불**한다.

따라서 계측과 gate를 두 항으로 분리한다:

| 항          | 대상                               | 상한                        | 측정 지점                        |
| ----------- | ---------------------------------- | --------------------------- | -------------------------------- |
| 호출부 방문 | plan 구성, dirty 마킹, 결과 수집   | `O(k + promotedAncestors)`  | lane/engine adapter counter      |
| 엔진 walk   | `compute_layout()` 1회의 노드 방문 | `O(N)` (허용, 단 시간 예산) | Rust 측 walk 카운터 + wall clock |

엔진 walk의 예산은 `N`=5,000·dirty leaf 1개 기준 **frame 예산(4ms)의 25% = 1ms**다. G0
실측이 이를 초과하면 `TreeNode`에 subtree-dirty 요약 플래그를 두어 skip 판정을 `O(1)`로
바꾸는 엔진 작업이 Phase 1의 필수 선행 범위가 된다. 초과하지 않으면 실측치를 G0 증거로
기록하고 현행 게이트를 유지한다. **호출부 counter만 GREEN인 상태를 hard constraint 1·2
동시 통과로 보고하지 않는다.**

#### 4.1.2 parent promotion 판정의 정본 (M3)

현재 `createPresentationLayoutPlan`의 `shouldPromoteParent` 기본값은 `() => false`이고
(`apps/builder/src/builder/presentation/editorPresentationLayoutLane.ts:62`), affected set은 승격된 root의 서브트리로만 채워진다
(같은 파일 `:78-81`). 승격이 없으면 **in-flow 형제가 affected set 밖으로 빠져** flex/block 흐름에서
형제 위치가 stale해진다. 그런데 판정 근거가 될 registry는 하향축만 갖는다 —
`EditorMutationEffectPropagation = "self" | "inherited-subtree"`
(`apps/builder/src/builder/presentation/invalidation/editorMutationEffectRegistry.ts:6,24`). 즉 상향(used-size) 판정의 데이터 원천이 없다.

판정을 두 축의 합성으로 정의하고, 각 축의 소유자를 고정한다:

| 축          | 질문                                             | 정본                           | 값                                                      |
| ----------- | ------------------------------------------------ | ------------------------------ | ------------------------------------------------------- |
| 속성 축     | 이 mutation이 노드 자신의 used size를 바꾸는가   | `editorMutationEffectRegistry` | `usedSizeEffect: "none" \| "self-box" \| "content-box"` |
| 컨테이너 축 | 부모가 자식 used size 변화에 배치를 재분배하는가 | layout lane의 container 규칙표 | display(flex/grid/block) × 해당 축 크기 확정 여부       |

- `shouldPromoteParent(parentId, childId)` = 속성 축이 `"none"`이 아니고 **동시에** 부모가
  해당 축에서 재분배하는 컨테이너일 때만 `true`.
- 승격은 **해당 축에서 크기가 확정되고 재분배하지 않는 첫 조상**에서 멈춘다 (명시
  width/height 컨테이너, page body, out-of-flow 경계). 이것이 promoted ancestor 수의 상한이며,
  전체 document traversal로 대체하지 않는다.
- `position:absolute/fixed` 자식은 in-flow에 기여하지 않으므로 부모를 승격시키지 않는다
  (엔진의 out-of-flow 처리와 같은 경계).
- **production 기본값을 `() => false`로 두지 않는다.** 합성 규칙이 기본값이고, `() => false`는
  테스트 전용이다. 두 축 중 하나라도 값이 없는 descriptor는 continuous allowlist에서 제외한다.
- 호출부(패널/드래그 핸들러)가 자체 heuristic으로 승격을 결정하는 경로를 금지한다 — 정본은
  위 두 축뿐이다.

G1은 이 규칙을 fixture가 아니라 **런타임 판정**으로 검증한다: 폭 변경 시 in-flow 형제가
affected set에 **포함**되고, 크기 확정 조상에서 승격이 멈추며, absolute 자식 변경이 부모를
승격시키지 않는다.

### 4.2 Typed layout publication

```ts
type LayoutPublication =
  | { kind: "canonical-full"; version: number }
  | {
      kind: "presentation-targeted";
      rootKey: string;
      roots: readonly string[];
      affectedNodeIds: ReadonlySet<string>;
      /** 이 publication이 덮는 affected node만 담는다 — base map 복사 금지. */
      layoutDelta: ReadonlyMap<string, ComputedLayout>;
      /** targeted lane 안에서 단조 증가. 소비자의 stale/out-of-order 판정 키. */
      presentationRevision: number;
      /** 이 delta가 얹힌 canonical publish의 version. 불일치 시 patch 거부. */
      baseCanonicalRevision: number;
    };
```

- canonical/full publication만 legacy `layoutVersion`과 full StoreRenderBridge sync를
  사용할 수 있다.
- presentation-targeted publication은 global version을 올리지 않는다.
- page map 밖의 node를 publish하거나 affected set 밖의 값을 수정하려 하면
  fail-closed 한다.

#### 4.2.1 overlay 계약 — base map 복사 금지 (hard constraint 1)

현행 `publishPresentationLayout()`은 `new Map(input.previousLayoutMap)`으로 이전 map
전체를 복사한 뒤 affected 값을 덮어쓴다 (`apps/builder/src/builder/presentation/editorPresentationLayoutLane.ts:96`). 이는
"비영향 node의 값·identity 보존"은 만족하지만 **map write가 `N` 비례**로 남아 hard
constraint 1을 위반한다. Phase 2에서 다음 계약으로 교체한다:

- publication은 `layoutDelta`(affected node만) + `baseCanonicalRevision`만 보유한다.
  write 수는 `|affectedNodeIds|`를 넘지 않는다.
- 소비자는 단일 `Map` 참조 대신 `resolve(id) = delta.get(id) ?? base.get(id)` lookup을
  쓴다. base map은 canonical publish가 소유하고 targeted lane은 읽기만 한다.
- 병합된 단일 `Map`이 필요한 소비자가 남아 있으면, 그 소비자를 lookup 계약으로 옮기는
  것이 Phase 2 범위다. 병합 map을 만들어 넘기는 우회는 이 제약을 되돌린다.
- G2는 `write count ≤ |affectedNodeIds|`와 `base map 복사 0`을 함께 단언한다.

#### 4.2.2 multi-root partition과 group 원자성 (M1)

publisher는 page/frame마다 별도 map을 발행하고 그 key는 root body에서
`page_id ?? getFrameElementMirrorId(body) ?? body.id`로 파생된다
(`apps/builder/src/builder/workspace/canvas/hooks/useLayoutPublisher.ts:141-145`, 같은
파생이 `B/workspace/canvas/layout/engines/fullTreeLayout.ts:2440`에도 있다). 반면
`LayoutPublication`은 단일 `rootKey`와 복수 `roots`를 동시에 갖는다. 다중 선택이 page와
frame에 걸치면 이 둘의 관계가 정의되지 않는다.

- **partition 규칙**: publication 1건은 rootKey 1개를 소유한다. 그 `roots`,
  `affectedNodeIds`, `layoutDelta`는 전부 해당 rootKey의 map에 속한 node만 담는다. plan이
  여러 rootKey에 걸치면 rootKey 수만큼 publication으로 **분할**한다.
- **파생 단일화**: rootKey 파생은 위 publisher 식을 재사용한다. `PresentationLayoutTreeIndex`가
  `rootKeyByNodeId`(또는 동등한 resolver)를 제공하고, lane은 두 번째 파생식을 만들지 않는다.
  rootKey를 확정할 수 없는 node는 fail-closed — 해당 descriptor는 commit-only다.
- **base map 소유권**: overlay의 base는 해당 rootKey의 per-page map이다. 모든 page를 병합하는
  `getSharedLayoutMap()`(`B/workspace/canvas/layout/engines/fullTreeLayout.ts:328-330`)을 targeted lane의 base로 쓰지 않는다 —
  병합 map을 base로 삼으면 §4.2.1의 `O(k)` write 계약이 되돌아간다.
- **revision 스코프**: `presentationRevision`은 **rootKey별 단조 증가**다 (patch 적용 상태가
  rootKey별이므로). 한 plan에서 갈라진 publication들은 공통 `planSequence`를 공유한다.
- **group 원자성**: 같은 `planSequence`의 publication은 **한 프레임에서 함께 적용**한다. 그중
  하나라도 §4.3.1 거부 조건에 걸리면 **그룹 전체를 적용하지 않는다**. 일부만 적용해 page A는
  새 geometry, page B는 이전 geometry가 되는 부분 적용을 금지한다.
- **거부된 그룹의 revision 미기록**: 그룹이 거부되면, 검사를 이미 통과한 publication의
  `presentationRevision`도 **적용 상태로 기록하지 않는다**. 기록하면 같은 plan의 재시도가
  §4.3.1의 역행 판정에 걸려 영구 거부된다. rootKey별 "최근 적용 revision"은 그룹이 실제로
  적용된 순간에만 전진한다.
- G2는 rootKey 경계 위반(다른 rootKey의 node가 delta에 포함) 0건과, 그룹 부분 적용 0건을
  함께 단언한다. 거부 후 같은 plan을 재시도하면 정상 적용되는지도 확인한다.

### 4.3 Skia subtree patch

- command stream은 element별 subtree span, parent clip context, hit-test span을
  보유한다.
- layout patch는 변경된 root의 ancestor context를 다시 계산하고, affected subtree의
  draw command와 `hitBoundsMap`을 함께 갱신한다.
- span 길이·clip·z-order·sticky/scroll context가 보존되지 않으면 targeted patch를
  적용하지 않고 canonical/full path로 승격하지 않는다. 해당 descriptor는 commit-only
  또는 별도 allowlist로 남긴다.

#### 4.3.1 revision identity와 원자 교체 (hard constraint 4)

ADR-187 paint lane은 이미 stale 거부 계약을 운용한다 — `SessionProjectionState`의
`sequence`/`terminalRevision`과 `renderedDocumentRevision >= terminalRevision` 비교
(`apps/builder/src/builder/presentation/skiaEditorPresentationBridge.ts:22-28,79-80,133`). layout lane은 이 선례를 재발명 없이
확장한다:

- patch를 적용하기 전에 `presentationRevision`이 해당 rootKey의 최신 적용값보다 큰지,
  `baseCanonicalRevision`이 현재 canonical publish와 일치하는지 확인한다. 둘 중 하나라도
  어긋나면 **적용하지 않고 거부**한다 (fail-closed — 화면을 stale하게 두지 않는다).
- draw span과 `hitBoundsMap`은 **같은 patch 적용 단위 안에서 함께 교체**한다. 둘을 서로
  다른 시점에 갱신해 중간 프레임이 서로 다른 revision을 관측하는 경로를 만들지 않는다.
- 적용된 revision을 stream에 값으로 남겨, G4가 "draw와 hit가 같은 revision 값을 실제로
  보유한다"를 관측 가능한 단언으로 검증한다. "같은 snapshot에서 계산했다"는 서술만으로는
  통과로 인정하지 않는다.

#### 4.3.2 subtree span 데이터 모델과 patch 전제 (M2)

현행 stream은 평면 배열 `commands: RenderCommand[]`와 self-draw 구간만 보유한다 —
`SelfSpan`은 `ELEMENT_BEGIN` 직후 ~ `CHILDREN_BEGIN` 직전의 인덱스 쌍이고
(`apps/builder/src/builder/workspace/canvas/skia/renderCommands.ts:145-148,664-669`), 자식 재귀 구간은 포함하지 않는다. `hitBoundsMap`은 DFS
도중 조상 clip과 교차해 만들어지고 그 clip 값 자체는 버려진다 (같은 파일 `:573-576`). 따라서 서브트리
단위 교체에 필요한 두 가지가 없다: **서브트리 구간**과 **조상 clip context**.

추가할 구조 (기존 DFS 1회 안에서 함께 기록 — 별도 순회 금지):

| 필드                                          | 정의                                                                                                 | 용도              |
| --------------------------------------------- | ---------------------------------------------------------------------------------------------------- | ----------------- |
| `subtreeSpans: Map<string, Span>`             | `start` = 해당 element의 `CMD_ELEMENT_BEGIN` 인덱스, `end` = 짝이 되는 `CMD_ELEMENT_END` 다음 인덱스 | 교체 구간         |
| `clipContextByElement: Map<string, ClipRect>` | `hitBoundsMap` 계산에 쓴 조상 누적 clip rect                                                         | 재계산·전제 검증  |
| `zOrderKeyByElement: Map<string, string>`     | 형제 순서 + top-layer 소속을 담은 키                                                                 | z-order 불변 검증 |

**patch 전제 (하나라도 불충족이면 적용하지 않고 commit-only)**:

1. **구간 연속성** — 서브트리가 배열에서 연속이어야 한다. 드래그 root는 top-layer로 재방문이
   유예되어 자기 커맨드가 부모 구간 밖에 방출되므로 (같은 파일 `:539-540`, `:450-465`), patch 대상 또는
   그 자손이 `dragRootIds`에 있으면 거부한다. `isFixed` 등 top-layer 재배치가 구간 안에 있으면
   같은 이유로 거부한다.
2. **길이 보존** — 새 커맨드 수 == 기존 구간 길이. 평면 배열이라 길이가 달라지면 뒤따르는 모든
   `selfSpans`/`subtreeSpans` 인덱스가 무효화된다. 길이가 바뀌는 변경(자식 수 변화 등)은 이
   ADR의 targeted 범위가 아니다 (§8 structure patch).
3. **clip context 불변** — patch root의 `clipContextByElement` 값이 기록 시점과 같아야 한다.
   patch root 자신의 자식 clip(`CMD_CHILDREN_BEGIN`의 width/height)은 새 layout으로 다시
   계산해 커맨드에 반영한다.
4. **z-order 불변** — `zOrderKeyByElement`가 patch 전후 동일해야 한다.

**재계산 단위**: patch root의 서브트리에 속한 **모든** element의 `boundsMap`/`hitBoundsMap`을
다시 만든다 — root가 움직이면 자손의 절대 좌표가 전부 따라 움직이기 때문이다. hit bounds는
기록된 조상 clip(위 3)과 patch root의 새 자식 clip을 함께 교차한다. 서브트리 **밖**의 element는
건드리지 않으며, 이것이 안전한 전제는 §4.1.2의 promotion이 in-flow 형제를 이미 affected set
안으로 넣었을 때뿐이다 — promotion이 없으면 형제 bounds가 stale해진다.

재계산은 **갱신이 아니라 교체**다. `hitBoundsMap`은 조상 clip과의 교차가 비면 애초에 등재하지
않으므로(`B/workspace/canvas/skia/renderCommands.ts:573-576`) patch 후 완전히 clip 밖으로 나간
자손은 **기존 entry를 삭제해야** 한다. set-only 루프로 구현해 자격을 잃은 entry가 남으면 빈
영역 클릭이 그 요소를 선택하는 ghost hit이 된다 — 서브트리 범위의 기존 entry를 먼저 비우고 새
결과를 쓴다.

`syncSpatialIndex(hitBoundsMap)`(같은 파일 `:471`)도 같은 patch 적용 단위 안에서 갱신한다. 전체 map을
다시 만들어 넘기면 §6의 `command/hit patch: O(k + clipContext)` 계약이 되돌아간다.

### 4.4 Rollback / compatibility

- capability flag는 descriptor/property 단위로 둔다. unsupported layout은 기존
  canonical commit 경로만 사용한다.
- `layoutVersion++` fallback을 continuous presentation의 성공 증거로 사용하지 않는다.
- canonical commit 후 full publish가 도착하면 targeted overlay/patch ownership을
  revision latch에 따라 해제한다.

## 5. 파일 책임 경계

경로는 모두 저장소 root 기준이다 (`B`는 §3의 축약).

| 영역             | 예상 경로                                                                                               | 책임                                                                     |
| ---------------- | ------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------ |
| engine (JS)      | `B/workspace/canvas/layout/engines/persistentTaffyTree.ts`                                              | targeted input, parent promotion, result collection                      |
| engine (Rust)    | `packages/composition-engine/src/tree.rs`                                                               | 증분 skip 판정 (G0 초과 시 subtree-dirty 요약 플래그)                    |
| layout publisher | `B/workspace/canvas/hooks/useLayoutPublisher.ts`, `B/workspace/canvas/layout/engines/fullTreeLayout.ts` | typed publication과 version 분리, rootKey 파생 단일화                    |
| layout cache     | `B/workspace/canvas/scene/layoutCache.ts`                                                               | cache miss 진입점 (full-tree 계산 경계)                                  |
| layout lane      | `B/presentation/editorPresentationLayoutLane.ts`                                                        | plan/resolver contract 유지, delta overlay·revision, engine 호출 adapter |
| promotion 정본   | `B/presentation/invalidation/editorMutationEffectRegistry.ts`                                           | `usedSizeEffect` 축 (속성 → used size 영향)                              |
| command stream   | `B/workspace/canvas/skia/renderCommands.ts`                                                             | subtree span, clip context, local rebuild, hit bounds patch              |
| Skia bridge      | `B/workspace/canvas/skia/StoreRenderBridge.ts`, `B/workspace/canvas/skia/SkiaCanvas.tsx`                | targeted event 구독, full resync 격리, hit-test 적용                     |
| paint lane 선례  | `B/presentation/skiaEditorPresentationBridge.ts`                                                        | `sequence`/`terminalRevision` stale 거부 패턴 (참조)                     |
| tests            | 인접 `*.test.ts(x)`                                                                                     | identity, clip/z-order, stale revision, unsupported fallback             |
| docs             | ADR-187 addendum/CHANGELOG                                                                              | phase evidence와 범위 경계                                               |

## 6. 계측 및 성공 수식

각 trace에서 `N`은 visible scene node 수, `k`는 affected subtree node 수다. 상한은
**호출부 경계**와 **엔진 내부**를 분리해 기록한다 (§4.1.1).

호출부 경계:

- layout input node visits: `O(k + promotedAncestors)`; `N` 비례 full DFS는 RED다.
- published map writes: `≤ |affectedNodeIds|`; base map 복사 0, 비영향 map
  value/reference 변경 0.
- command/hit patch: `O(k + clipContext)`; full `buildRenderCommandStream()` 호출 0,
  `hitBoundsMap`/spatial index 전체 재생성 0.
- publication은 rootKey별로 분할되고, 한 plan의 그룹은 전부 적용되거나 전부 거부된다.
- targeted publication의 global layout version bump, `StoreRenderBridge.sync(true)`,
  whole-scene command rebuild는 모두 0이어야 한다.

엔진 내부 (`N` 비례 허용, 시간 예산으로 관리):

- `compute_layout()` 1회의 노드 방문은 `O(N)`이다 — skip 게이트가 clean 서브트리를
  순회해 판정하기 때문이다. 이 값을 `k` 비례로 보고하지 않는다.
- 예산: `N`=5,000·dirty leaf 1개에서 walk wall clock `< 1ms` (frame 예산 4ms의 25%).
  초과 시 subtree-dirty 요약 플래그 작업이 Phase 1 필수 범위가 된다.

프레임 전체:

- drag frame p95 `< 4ms`, p99 `< 8.33ms`; 120Hz 기준 long task 0.
- 적용된 patch의 draw revision == hit revision (불일치 프레임 0).

## 7. Gate 체크리스트

### G0 — baseline 및 negative contract

- N=50/500/5,000에서 기존 whole-tree 경로 count/time을 기록한다.
- 같은 N tier에서 **엔진 skip walk**(dirty leaf 1개, `compute_layout()` 1회)의 노드 방문
  수와 wall clock을 별도로 기록한다. `N`=5,000에서 1ms를 초과하면 subtree-dirty 요약
  플래그 작업을 Phase 1 필수 범위로 승격하고 그 사실을 G0 증거에 남긴다.
- targeted event가 global version/full sync를 일으키면 RED가 되는 static/runtime test를
  먼저 추가한다.

### G1 — engine targeted input

- root/parent promotion, affected subtree, intrinsic unsupported descriptor를 fixture로
  검증한다.
- promotion을 **런타임 판정**으로 검증한다 (§4.1.2): 폭 변경 시 in-flow 형제가 affected set에
  포함되고, 크기 확정 조상에서 승격이 멈추며, absolute 자식은 부모를 승격시키지 않는다.
  두 축(`usedSizeEffect` × container 재분배) 중 하나라도 값이 없는 descriptor는 allowlist에서
  제외된다. production 경로에 `() => false` 기본값이 남아 있으면 RED다.
- 호출부 방문 counter와 엔진 walk 항을 **분리 계측**한다. 호출부 counter만 GREEN인 결과를
  hard constraint 1·2 동시 통과로 보고하지 않는다.
- unrelated layout value와 object identity를 보존한다.

### G2 — publisher split

- canonical-full과 presentation-targeted event를 분리한다.
- targeted event에서 `layoutVersion`, `onLayoutPublished` full callback,
  `StoreRenderBridge.resync(true)`가 0이다.
- publication write 수 ≤ `|affectedNodeIds|`이고 base map 복사가 0이다. 병합된 단일
  `Map`을 만들어 소비자에게 넘기는 경로가 남아 있으면 RED다.
- rootKey 경계 위반(다른 rootKey의 node가 `layoutDelta`에 포함)이 0이고, rootKey 파생이
  publisher 식과 단일화되어 있다 (§4.2.2).
- page/frame에 걸친 다중 선택에서 같은 `planSequence` 그룹이 한 프레임에 함께 적용되거나
  함께 거부된다 — 부분 적용 0건.
- targeted lane의 base로 `getSharedLayoutMap()`(전 page 병합)을 쓰는 경로가 0이다.

### G3 — command span patch

- leaf, nested subtree, clipped child, scroll/sticky, z-order fixture를 통과한다.
- §4.3.2의 네 전제(구간 연속성 / 길이 보존 / clip context 불변 / z-order 불변)를 각각 위반하는
  negative fixture가 **전부 거부**로 판정된다. 특히 드래그 root가 top-layer로 유예된 경우와
  커맨드 수가 달라지는 경우를 명시적으로 포함한다.
- patch된 서브트리의 모든 element에 대해 `boundsMap`/`hitBoundsMap`이 재계산되고, 서브트리 밖
  element의 bounds는 변경되지 않는다. `syncSpatialIndex`도 같은 적용 단위에서 갱신된다.
- span context가 불완전하면 patch를 거부하고 화면을 stale하게 두지 않는다.

### G4 — hit-test parity

- draw bounds와 `hitBoundsMap`이 동일 revision **값을 보유**하고, 한 patch 적용 단위에서
  함께 교체된다. 서로 다른 revision을 관측하는 중간 프레임이 0이다.
- `presentationRevision` 역행 또는 `baseCanonicalRevision` 불일치 patch가 전부 거부되고,
  거부 후 화면이 stale하지 않다. 그룹 거부 직후 같은 plan을 재시도하면 정상 적용된다
  (거부된 그룹의 revision이 적용 상태로 기록되지 않음, §4.2.2).
- patch로 조상 clip 밖으로 나간 자손의 `hitBoundsMap` entry가 삭제되어, 해당 영역 클릭이
  그 요소를 선택하지 않는다 (ghost hit 0).
- pointer move/click/wheel이 patched node와 sibling을 동일하게 판정한다.

### G5 — ADR-187 integration

- layout descriptor allowlist만 targeted lane으로 연결한다.
- paint-only fill drag는 기존 G5 counter를 유지하고 layout lane으로 승격하지 않는다.
- finish/cancel/document revision handoff 후 stale patch가 0이다.

### G6 — live performance and parity

- populated Builder 상단 split Preview에서 layout slider/geometry interaction을 실제로
  exercise한다.
- DOM/Skia geometry, clipping, hit-test parity를 확인한다.
- 120Hz trace에서 `N` 증가에 따른 frame/apply cost 발산이 없고, console error/warn 0이다.

## 8. 진행 로그

### Phase 0 / G0 — Complete with mandatory Phase 1 engine prerequisite (2026-08-22)

- evidence: [188-phase-0-g0-baseline.md](188-phase-0-g0-baseline.md)
- N=50/500/5,000 baseline과 엔진 skip-walk 방문 수를 분리 계측했다. 현재 방문 수는
  `3N - 2`이며 `compute_layout()` p95는 각각 0.566ms / 2.708ms / 22.720ms다.
- N=5,000 결과가 frame 예산 25%(1ms)를 초과해 Phase 1의 Rust
  `subtree-dirty` 요약 플래그(`O(1)` skip 판정)를 필수 선행 작업으로 승격했다.
- targeted lane full-sync escape hatch negative contract와 ADR-187 paint bridge/protocol
  회귀 3 files / 18 tests를 통과했다.
- 다음 진입점은 Phase 1이며 JS targeted input보다 Rust summary flag를 먼저 구현·재측정한다.

### Phase 1 / G1 — Implemented (2026-08-22)

- evidence: [188-phase-1-g1-targeted-input.md](188-phase-1-g1-targeted-input.md)
- Rust `TreeNode.subtree_dirty` 요약 플래그, dirty 전파/solve 완료 정리 및 intrinsic
  snapshot 복구를 반영했다. skip gate는 clean subtree recursive walk 없이 O(1) summary를
  읽는다.
- mutation registry에 `usedSizeEffect`를 추가하고 layout lane이 display 규칙표와 합성해
  in-flow sibling을 포함하는 runtime parent promotion을 수행한다. explicit sized ancestor,
  absolute child, paint-only descriptor의 fail-closed 경계를 테스트했다.
- persistent engine에 typed targeted input/result API와 `inputNodeVisits` /
  `resultNodeVisits` / `engineComputeCalls` 분리 counter를 추가했다.
- G1 관련 3 files / 14 Vitest, Rust 전체 325+15+10+11 및 doc test, type-check, live smoke를
  통과했다. Phase 2는 typed publication channel로 진입한다.

### Phase 2 / G2 — Implemented (2026-08-22)

- evidence: [188-phase-2-g2-publication.md](188-phase-2-g2-publication.md)
- `LayoutPublication` union과 canonical-full/targeted 별도 listener lane을 추가했다.
  targeted publication은 affected `layoutDelta`와 root별
  `presentationRevision`/`baseCanonicalRevision`/`planSequence`만 보유한다.
- 기존 base map 전체 복사 merge를 제거하고 `delta → base` overlay lookup으로 바꿨다.
  `writeCount`는 affected delta write만 계측하며 `getSharedLayoutMap()`은 targeted base로
  사용하지 않는다.
- `page_id ?? getFrameElementMirrorId(body) ?? body.id` rootKey 파생을 공용 helper로
  단일화했다. page/frame multi-root plan은 rootKey별 publication으로 분할하고, unknown
  root 또는 cross-root node는 fail-closed한다.
- group의 모든 publication을 먼저 검사한 뒤 한 번에 revision/overlay를 적용한다. 한 root의
  base/revision 오류가 다른 root의 revision을 기록하지 않으며, 거부된 동일 plan 재시도가
  가능하다.
- G2 관련 5 files / 29 Vitest와 type-check를 통과했다. Phase 3은 이 channel의 Skia
  subtree span/hit-test consumer를 구현한다.

### Phase 5 / G6 — Implemented (2026-08-22)

- evidence: [188-phase-5-g6-live-parity.md](188-phase-5-g6-live-parity.md)
- 초기 RED는 paint ColorArea를 동작한 layout apply 0 하니스, N개 노드를 모두 가시화한
  `V=N` dense fixture, canonical synthetic `Box`와 동적 import의 별도 Vite module
  instance를 측정한 결과였다. 제품 layout hot path 판정에서 제외했다.
- 실제 `EditorPresentationTransactionRuntime`/Skia command singleton을 query-opt-in
  read-only boundary로 관측하고, canonical `frame` target 1개만 가시화한
  document-scale fixture에서 N=50/500/5,000 × 5회 120Hz trace를 수행했다.
- N=5,000 runtime apply 중앙 p95/p99 `0.165/0.179ms`, Skia frame
  `1.487/1.548ms`, 15개 전체 long task 0, console error/warn 및 page error 0이다.
  canonical/legacy/layout/projection/full rebuild/full-document counter는 모두 0이다.
- Preview와 Skia clipped width가 15/15 일치하고, 실제 WASM SpatialIndex center hit,
  동일 revision draw/hit 교체, command count 불변, canvas composited pixel 변화 및 cancel
  완전 복원, canonical store 불변을 모두 확인했다.
- focused Vitest 3 files / 28 tests와 baseline-aware type-check를 통과했다.

## 9. Rollback 및 후속 경계

G3 또는 G4가 실패하면 해당 descriptor를 continuous layout allowlist에서 제거하고
commit-only로 유지한다. global full rebuild fallback을 presentation hot path에
재도입하지 않는다. structure patch, ref/slot topology, children-map 변경은 이 ADR의
targeted layout 결과가 안정화된 뒤 별도 decision gate에서 다룬다.
