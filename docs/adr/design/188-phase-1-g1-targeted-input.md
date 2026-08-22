# ADR-188 Phase 1 — Targeted input/result 및 subtree-dirty evidence

## 범위

Phase 0 G0에서 확인된 엔진 skip walk 초과를 반영해 다음 경계를 구현했다.

- Rust `TreeNode.subtree_dirty` 요약 플래그와 O(1) `subtree_has_dirty` 판정
- dirty 전파, `mark_subtree_dirty`, `display:none` 정리, intrinsic 측정 snapshot/restore의
  요약 상태 보존
- JS mutation registry의 `usedSizeEffect` 축과 layout lane의 display 규칙표 기반 parent
  promotion
- persistent layout의 typed targeted input/result API 및 호출부/result counter 분리

Phase 2의 publication overlay/map copy 제거, Phase 3의 Skia command span patch, Phase 4의
ADR-187 runtime 연결은 이 evidence의 범위가 아니다.

## G1 검증

| 항목                   | 결과                                                                     |
| ---------------------- | ------------------------------------------------------------------------ |
| runtime promotion      | `style.width` 변경이 flex parent와 in-flow sibling을 affected set에 포함 |
| sized ancestor stop    | explicit `width`+`height` parent에서 promotion 정지                      |
| out-of-flow 경계       | `position:absolute` child는 parent promotion 없음                        |
| paint-only fail-closed | `style.color`는 used-size effect가 `none`이라 target subtree만 유지      |
| targeted result        | persistent engine은 등록된 unique `affectedNodeIds`만 요청               |
| unrelated identity     | 기존 layout map의 비영향 object identity 유지 테스트 PASS                |
| counter 분리           | `inputNodeVisits`, `resultNodeVisits`, `engineComputeCalls`를 별도 반환  |

## 엔진 재측정

`adr188_g0_engine_skip_walk_baseline`을 subtree summary 기준으로 갱신했다. `visits`는
summary gate 호출 항이며, flex layout kernel이 모든 child solve entry를 요구하므로 전체
compute wall time과 동일한 의미로 해석하지 않는다.

|     N | summary gate visits |       median |          p95 |
| ----: | ------------------: | -----------: | -----------: |
|    50 |          100 (`2N`) |  0.239708 ms |  0.249917 ms |
|   500 |        1,000 (`2N`) |  2.323250 ms |  2.603209 ms |
| 5,000 |       10,000 (`2N`) | 23.348667 ms | 24.326458 ms |

clean subtree 내부의 recursive skip walk는 제거됐다. 다만 `compute_layout()` 전체는
flex 배치 kernel의 O(N) child solve 항을 여전히 포함하므로 5,000 node wall time 자체는
1ms를 넘는다. 이 항은 호출부 targeted counter와 혼동하지 않고 Phase 5 성능 검증에서
별도 추적한다.

## 검증 명령

- `cargo test` — 325 unit + 15 golden + 10 trace + 11 tree-golden + doc test PASS
- `pnpm exec vitest run` — Phase 1 관련 3 files / 14 tests PASS
- `pnpm run codex:typecheck` — baseline 43 known errors, new violation 0
- `pnpm run codex:format` — changed files unchanged after format
- dist gate — `.codex/.spec-rebuild-pending` 없음, specs dist/CSS generated 존재
- live smoke — Builder 인증 세션에서 isolated project 생성 및 50-node drag exercise 완료;
  `bridgeFullRebuildCount=0`, `previewFullDocumentMessageCount=0`,
  `targetIncrementalPatchCount=32`, long task 0. fixture가 생성하는 lowercase `box`에
  대한 기존 React console error 1건은 Phase 1 변경 경로와 무관하며 별도 범위로 남긴다.
