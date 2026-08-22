# ADR-189 Phase 2 / G2 evidence — variable command span splice

> 대상: [ADR-189](../189-commit-lane-incremental-record.md) Phase 2.
> 상태: 구현 및 로컬 G2 계약 검증 완료, populated canonical live gate는 별도 보류.

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
  cached stream key를 새 layout revision으로 승격하며, 실패 시 full rebuild로 수렴한다.

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

## 3. live gate 경계

새 Builder project를 만드는 기존 G0 harness는 legacy `elementsMap`만 준비하고
canonical document index를 준비하지 않아 `EditorPresentationTransactionRuntime`의
`hasTarget`에서 거부됐다. 기존 project를 대상으로 하면 사용자 canonical document를
변경하므로 commit live trace를 수행하지 않았다. 따라서 현재 증적은 command stream
구조·span·fallback·wiring의 로컬 G2까지이며, populated canonical commit의
`patchWriteCount > 0`, full build 0, pixel 대조는 Phase 2 closure 전에 별도 harness가
필요하다.

이 경계는 구현 실패가 아니라 live fixture hydration/authority 문제다. 해결 전에는
G2를 Accepted/Complete로 승격하지 않는다.
