# ADR-189 Phase 2 / G2 evidence — variable command span splice

> 대상: [ADR-189](../189-commit-lane-incremental-record.md) Phase 2.
> 상태: 구현·로컬 계약·populated canonical command live gate 완료, pixel diff는 Phase 2
> closure에서 최종 검증 대기.

## 1. 구현 범위

- `renderCommands.ts`는 full DFS가 끝난 command array를 `Array` 호환 piece-table
  buffer로 승격한다. `CommandSpanMap`은 span을 source segment와 offset cursor로
  보유해 splice 뒤 tail span을 순회하며 다시 쓰지 않는다.
- `subtreeCommandPatch.ts`는 ADR-188 고정 길이 `applySubtreeCommandPatch`의 reject
  계약을 유지하면서, ADR-189 전용 `applyCommitSubtreeCommandPatch`로 node-set과
  command-count 변화를 허용한다. clip/scroll/z-order/root revision 전제 실패는
  full fallback 결과로 반환한다.
- draw bounds, hit bounds, SpatialIndex, presentation revision을 한 동기 구간에서
  갱신하고 dirty element의 `nodePictureCache`를 무효화한다.
- `StoreRenderBridge`는 canonical terminal descriptor를 다음 post-commit sync에서
  queue한다. registry를 먼저 갱신하고 dirty-root replacement를 만든 뒤 patch 성공 시
  cached stream key를 새 layout revision으로 승격하며, layout publish 경계에서도 같은
  결과를 소비한다. 실패 시 full rebuild로 수렴한다.

## 2. 로컬 G2 계약 결과

fixture는 `patch-body > patch-owner > patch-leaf` 뒤에 `patch-trailing-leaf`를 두고,
replacement에서 `patch-second-leaf`를 추가했다.

| 검증                                        | 결과                                                           |
| ------------------------------------------- | -------------------------------------------------------------- |
| replacement command count 변화(가변 splice) | PASS — commit lane 적용                                        |
| replacement 뒤 trailing subtree span offset | PASS — cursor map이 delta를 lazy 반영                          |
| splice write count                          | PASS — `writeCount = replacement span 길이`, tail N write 없음 |
| 기존 presentation lane command-count reject | PASS — `command-count-changed` 유지                            |
| fallback 조건                               | PASS — reject 결과와 DEV fallback counter 경유                 |
| 기존 render command 회귀                    | PASS — 19 tests                                                |
| subtree patch 회귀 + G2 fixture             | PASS — 12 tests                                                |
| SkiaCanvas static wiring                    | PASS — 4 tests                                                 |
| builder type-check                          | PASS — baseline 43개 외 신규 위반 0                            |

Builder package config으로 실행한 bridge/presentation 회귀는 2 files / 11 tests가
통과했다. `git diff --check`도 통과했다.

## 3. populated canonical live gate

새 격리 project를 dashboard 생성 경로로 만들고 canonical document를 hydration한 뒤
201개 active node를 seed하여 `fills.replace` terminal commit을 실행했다.

| 검증                                               | 결과                                     |
| -------------------------------------------------- | ---------------------------------------- |
| queue / patch success / fallback                   | `1 / 1 / 0`                              |
| patch write count                                  | `6` (replacement span 길이만 기록)       |
| commit 후 full command build                       | `0` (증분 subtree build `1`, visits `1`) |
| command-stream cache miss                          | `0`                                      |
| command stream / SpatialIndex / revision promotion | PASS                                     |
| console errors                                     | `0`                                      |

layout publish 전 stale map을 먼저 소비하지 않도록 1회 대기하고, layout sync에서 patch
성공 결과를 cache key 승격까지 연결했다. 이 trace는 command 구조·write budget·full
fallback 경계를 통과하지만, full rebuild와의 **pixel diff 0**은 아직 별도 closure
harness가 필요하다. 따라서 Phase 2는 구현 및 command live gate 완료 상태이며 G2 최종
Accepted/Complete 승격은 pixel 대조 후로 유지한다.
