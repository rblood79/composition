# ADR-188 Phase 0 — G0 baseline evidence

## 범위

Phase 0는 현재 whole-tree 경계와 targeted publication의 negative contract를
변경 전 기준으로 고정한다. 호출부 방문 비용과 composition-engine 내부 skip walk를
같은 수치로 합산하지 않는다.

## 재현 명령

```bash
cargo test --manifest-path packages/composition-engine/Cargo.toml \
  adr188_g0_engine_skip_walk_baseline -- --nocapture
pnpm -F @composition/builder exec vitest run \
  src/builder/presentation/skiaEditorPresentationBridge.test.ts \
  src/builder/presentation/editorPresentationPhase2.static.test.ts \
  src/builder/presentation/editorPresentationLayoutLane.test.ts
```

측정은 2026-08-22 macOS native debug test profile에서 수행했다. 각 N tier는
warm-up 8회 뒤 24회 `compute_layout()`을 재고 median/p95를 기록했다. dirty leaf는
1개이며, 호출부가 아니라 엔진의 `subtree_has_dirty` 재귀 방문 카운터를 별도로
수집했다.

## N-tier baseline

| N visible nodes | skip-walk visits / compute |    median |       p95 | 판정       |
| --------------: | -------------------------: | --------: | --------: | ---------- |
|              50 |             148 (`3N - 2`) |  0.456 ms |  0.566 ms | 기준선     |
|             500 |           1,498 (`3N - 2`) |  2.347 ms |  2.708 ms | 기준선     |
|           5,000 |          14,998 (`3N - 2`) | 22.296 ms | 22.720 ms | **G0 RED** |

현재 엔진의 skip 게이트는 clean subtree를 메모이즈된 요약값 없이 재귀 순회한다.
N=5,000·dirty leaf 1개에서 p95 22.720ms로 frame 예산 4ms의 25%(1ms)를
초과했다. 따라서 Phase 1에는 `TreeNode` subtree-dirty 요약 플래그를 통한
`O(1)` skip 판정 선행 작업을 **필수**로 편입한다. 이 결과를 호출부 targeted input이
`O(k)`라는 근거로 재사용하지 않는다.

## Negative contract

`editorPresentationLayoutLane.test.ts`의 `ADR-188 G0: targeted layout has no
full-sync escape hatch`가 통과했다(18개 focused presentation test 전체 PASS).
현재 targeted lane에는 `layoutVersion`, `resync(true)`, `onLayoutPublished`,
`buildRenderCommandStream` 참조가 없다. 이 static guard는 Phase 2 publication
구현이 global version/full sync 경계를 재도입하면 RED가 된다.

## 선행 paint 회귀

ADR-187 paint lane의 bridge/protocol static 및 stale-revision 테스트를 함께 실행해
3 files / 18 tests PASS를 확인했다. ADR-187 Phase 3의 G5 live/counter closure는
기존 증거(`design/187-editor-presentation-transaction-and-typed-invalidation-breakdown.md`)
를 그대로 유지하며, 이번 Phase 0에서 paint lane 코드는 변경하지 않았다.

## G0 결론

baseline, 엔진 walk 분리 계측, negative contract, paint 회귀 확인은 완료했다.
다만 엔진 walk 예산 초과로 G0는 **RED 조건을 기록한 채 종료**한다. 다음 Phase 1은
JS targeted input 구현에 앞서 Rust subtree-dirty 요약 플래그를 먼저 land하고,
동일 N-tier trace에서 walk 항을 재측정해야 한다.
