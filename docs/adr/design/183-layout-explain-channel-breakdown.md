# ADR-183 Design Breakdown: 레이아웃 explain 디버그 채널 (엔진 판정 트레이스)

> 본문: [183-layout-explain-channel.md](../183-layout-explain-channel.md)
> 상태: Accepted (2026-08-15 리뷰 승인) — **Phase 0 완료 2026-08-15** (§4 산출물 freeze). 다음 진입점 = Phase 1

## 1. 목표 형태

디버그 게이트가 켜진 상태에서, 노드 하나에 대해 엔진이 내린 판정 시퀀스를 판독 가능한 형태로 얻는다:

```
window.__layoutExplain("component-listbox")
→ [node component-listbox] solve_flex(avail_w=350, avail_h=-1)
  ├ §4.5 auto-min floor: content_min_main=162 적용 (off 19 공급)
  ├ used-size clamp: maxHeight 300 바인딩 → 재분배 3.6 진입
  ├ incremental skip: MISS (subtree dirty)
  └ 반환 (350, 300) → last_solved 기록 (gen=412)
```

트레이스는 **엔진의 자기 보고**다 — 정합 oracle 은 여전히 Chrome parity fixture (판독 헬퍼 출력 첫 줄에 명시).

## 2. Phase 분할

### Phase 0 — 트레이스 이벤트 인벤토리 + off-cost baseline (freeze) ✅ 2026-08-15

- `layout-engine.md` 의 "진단 금지" / 금지 패턴 항목에서 **역산**: 각 오진을 1줄로 배제하려면 어떤 판정이 기록돼야 하는가 → 이벤트 목록 freeze. 초기 후보 (오진 이력 빈도순):
  1. 증분 skip 판정 (HIT/MISS + 사유: dirty / `last_avail` 불일치) — tree.rs:968
  2. used-size clamp 발화 (min/max 어느 쪽이 바인딩했나 + 재분배 재진입 여부)
  3. §4.5 automatic minimum floor (스칼라 공급 vs absent fallback — `flex.rs::parse_item`)
  4. stretch ↔ shrink-to-fit 갈래 (`inline_intrinsic` 판정 + 재진입)
  5. intrinsic 측정 캐시 (HIT/MISS + `mutation_gen`)
  6. flex item 재-solve 발화 (3.5 — used ≠ solved_avail)
  7. grid 트랙 해소 결과 (§12.5 기여 / §12.7.1 freeze-restart / §12.8 stretch)
- off-cost baseline: `benches/flex_shrink.rs` 전 케이스(5종) + `benches/tree_solve.rs` 현행 median_ns 채록 (동일 머신 — G1 의 A/B 기준값)
- 산출물: 이벤트 enum 초안 + baseline 표 (본 문서 §4 에 기록)

### Phase 1 — 엔진 trace 코어

- `packages/composition-engine/src/trace.rs` 신설: `TraceEvent` enum + `TraceSink` (노드 handle → `Vec<TraceEvent>`, 노드당 상한 N — R3)
- 게이트: `LayoutTree` 에 `trace: Option<TraceSink>` — **off 시 비용 = `Option` 분기 1회/판정 지점**. 기록 매크로/헬퍼는 `if let Some(sink)` 로만 진입
- 계측 지점 (Phase 0 freeze 목록의 거처):
  - `tree.rs::solve_node` — 증분 skip 판정 (968 게이트), used-size clamp, 키워드 폭 해소
  - `flex.rs` — `parse_item` §4.5 floor, `solve_flex` 3.5 재-solve / 3.6·3.7 clamp 재분배, 라인 cross 대입
  - `tree.rs::solve_grid` — `inline_intrinsic` 판정, 트랙 해소 (§12.5/§12.7.1/§12.8)
  - `tree.rs::measure_intrinsic_width` — 캐시 HIT/MISS (`mutation_gen`)
- **측정 패스 오염 금지**: `snapshot_subtree`/`restore_subtree` 구간(센티넬 available)의 이벤트는 `measure_pass: true` 태그 또는 별도 버킷 — 본 solve 판정과 섞이면 판독이 오도된다
- 단위 테스트: 대표 판정 3종 (skip HIT / clamp 바인딩 / §4.5 floor) 이 기대 이벤트를 남기는지 + off 시 이벤트 0건
- **G1 측정**: off 상태 A/B 벤치 — 회귀 ≤ 2% 확인 후 다음 phase

### Phase 2 — WASM 경계

- `wasm.rs` (wasm-bindgen surface — `build_tree_batch` 가 있는 파일): `enable_layout_trace(enabled: bool)` / `get_layout_trace(node_id) -> JsValue(JSON)`
- **binary_protocol / `build_tree_batch` 계약 무변경** (HC3) — 트레이스는 별도 조회 API, 배치 payload 에 싣지 않는다
- enable 시에만 sink 할당 (R3 — off 시 메모리 0)
- `compositionEngineWasm.ts` 바인딩 + `idMapper.ts` 경유 element id ↔ node handle 변환

### Phase 3 — TS 판독 채널

- `fullTreeLayout.ts` 인접에 디버그 헬퍼: element id → handle 매핑 → 트레이스 조회 → 사람이 읽는 시퀀스 포맷 (§1 형태)
- `window.__layoutExplain(elementId)` — **dev 전용** (`import.meta.env.DEV` 게이트, 게이트 상수는 boolean 상수가 아니므로 featureFlags registry 계약과 무충돌)
- TS 층 자체 판정 (Step 4.5 재측정 트리거, 스칼라 공급 여부) 은 **엔진 트레이스에 없다** — 헬퍼가 `enrichWithIntrinsicSize` 공급값 (`contentMinWidth`/`contentMaxWidth`) 을 별도 줄로 병기 (경계 표기: `[TS]` prefix)
- **G2**: live builder 에서 실노드 1개 explain 실측 (완료 기준 live behavior 게이트)
- **G3**: 오진 대표 3건 (새로고침-정상 캐시 / 형제 성장 / flexSweep green 오독 아님 — 미결정 main) 이 트레이스 출력으로 판별됨을 시나리오로 확인

### Phase 4 — (비스코프) 패널 UI 승격

사용자용 "왜 이 크기인가" 패널은 **본 ADR 범위 밖** — 내부 채널 운용 경험 후 별도 ADR 로 판단. 여기서 미리 설계하지 않는다.

## 3. 파일 변경 요약 (추정 — Phase 0 에서 실측 보정)

| 파일                                                                               | 변경                                           |
| ---------------------------------------------------------------------------------- | ---------------------------------------------- |
| `packages/composition-engine/src/trace.rs`                                         | 신설 — TraceEvent/TraceSink                    |
| `packages/composition-engine/src/tree.rs`                                          | 계측 지점 삽입 (solve_node/solve_grid/measure) |
| `packages/composition-engine/src/flex.rs`                                          | 계측 지점 삽입 (§4.5/3.5/3.6/라인 cross)       |
| `packages/composition-engine/src/wasm.rs`                                          | WASM API 2종                                   |
| `apps/builder/src/builder/workspace/canvas/wasm-bindings/compositionEngineWasm.ts` | 바인딩                                         |
| `apps/builder/src/builder/workspace/canvas/layout/engines/` (디버그 헬퍼 신설)     | 판독 포맷 + window 노출                        |

## 4. Phase 0 산출물 (2026-08-15 실측 — freeze)

### 4-1. 트레이스 이벤트 목록 (7종 + 태그 1)

각 이벤트는 `layout-engine.md` 의 "~로 진단 금지" 항목에서 **역산**했다 — 그 오진을 한 줄로 배제하려면 무엇이 기록돼야 하는가. 거처는 전부 현행 소스에서 확인.

| #   | 이벤트                                         | 배제하는 오진                                                            | 거처 (검증)                                                                                                                 |
| --- | ---------------------------------------------- | ------------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------- |
| 1   | `IncrementalSkip { hit, reason }`              | "새로고침하면 정상 → store/canonical 문제" (rules:330)                   | `tree.rs::solve_node` 976-980 (`last_solved` + `subtree_has_dirty` + `last_avail`)                                          |
| 2   | `UsedSizeClamp { axis, bound, redistributed }` | "clamp 후 재분배 생략" — 상자만 clamp 되고 분배는 clamp 이전 값          | `tree.rs::resolve_self_size` 3145 · `shrink_to_fit_settled` clamp 146-160                                                   |
| 3   | `AutoMinFloor { source, value }`               | "auto-main item 찌그러짐을 이 변경 탓으로 진단" (rules:168)              | `flex.rs::parse_item` 320-325 (off 19 `content_min_main` **공급** vs `content_main` **absent fallback**)                    |
| 4   | `ShrinkToFitReentry { mode }`                  | "키워드 발산을 확정 폭 자식만으로 진단" (rules:356)                      | `tree.rs::shrink_to_fit_settled` 142 · 호출부 2177(flex)/2392(block)/3001(grid) · `width_intrinsic_keyword` 3160            |
| 5   | `IntrinsicMeasure { hit, gen }`                | "부모는 맞고 자손만 틀림" = 측정 캐시                                    | `tree.rs::measure_intrinsic_width` 890-909 (`intrinsic_w` 캐시 · `mutation_gen` 379)                                        |
| 6   | `FlexItemResolve { used_main, prev_avail }`    | "이 누수를 백분율 게이트 결함으로 진단" (rules:521)                      | `tree.rs::solve_flex` 3.5 — 1796-1880                                                                                       |
| 7   | `GridTrackResolve { stage, tracks }`           | `auto` 트랙 미성장 / `fr` 재계산 불일치를 트랙 sizing 일반 문제로 오귀속 | `tree.rs` `resolve_track_with_contribution` 2710·2758 · `stretch_auto_tracks` 2781·2794 · `grid.rs` 272(§12.7.1)·403(§12.6) |
| —   | `measure_pass: bool` **태그**                  | 센티넬 available 이벤트가 본 solve 판정과 섞여 판독 오도 (R5)            | `snapshot_subtree` / `restore_subtree` 849-870 구간에서 세팅                                                                |

### 4-2. off-cost baseline (G1 A/B 기준값)

동일 머신, `cargo bench`, 40회 반복 중 **워밍업 2회 폐기** 후 38 표본. G1 판정 통계량은 **min** (§4-3).

| 케이스                                       | min_ns | median_ns | 2% 대역 |
| -------------------------------------------- | -----: | --------: | ------: |
| `flex_shrink :: shrink_nowrap_1000`          |  18083 |     18292 |    ±362 |
| `flex_shrink :: shrink_wrap_auto_1200`       |  65250 |     68854 |   ±1305 |
| `flex_shrink :: grow_nowrap_1000`            |  16917 |     17083 |    ±338 |
| `flex_shrink :: shrink_minfloor_1000`        |  18292 |     18458 |    ±366 |
| `flex_shrink :: shrink_minfloor_freeze_1000` |  18500 |     18604 |    ±370 |
| `tree_solve :: nested depth=1 full`          |   4000 |      4166 |     ±80 |
| `tree_solve :: nested depth=4 full`          |   9500 |      9958 |    ±190 |
| `tree_solve :: nested depth=8 full`          |  17125 |     17667 |    ±342 |
| `tree_solve :: nested depth=12 full`         |  25833 |     26626 |    ±517 |
| `tree_solve :: nested depth=8 incremental`   |    208 |       208 |      ±4 |

**콜드 1회차는 정상상태의 2.5배** (실측 `shrink_nowrap` 52125 → 18271, `depth=12` 45792 → 27312). 폐기하지 않으면 A/B 어느 쪽이 먼저 도는지가 결과를 지배한다.

### 4-3. G1 판정 프로토콜 (baseline 측정에서 도출 — 신설)

HC1/G1 의 `≤ 2%` 는 **단일 A/B 실행으로 판정 불가**다. 같은 바이너리를 두 표본군으로 나눈 A/A 검정에서 가짜 회귀가 임계를 넘는다:

| 통계량 | n=3   | n=5  | n=7  | n=10 | n=14     | n=19     |
| ------ | ----- | ---- | ---- | ---- | -------- | -------- |
| median | 13.0% | 8.8% | 8.9% | 4.4% | 3.2%     | 1.7%     |
| min    | 8.9%  | 4.8% | 4.6% | 4.3% | **1.7%** | **1.1%** |

**프로토콜 (G1 집행 시 필수)**:

1. 두 변형(A = 계측 없음 / B = 계측 삽입 + 게이트 off)의 벤치 바이너리를 **사전 빌드** (`cargo bench --no-run`) 후 **번갈아 직접 실행** — `cargo bench` 재빌드가 표본 사이에 끼면 캐시 상태가 갈린다
2. **첫 2회 폐기** (콜드)
3. 케이스별 **min** 비교, **군당 14회 이상** (위양성 상한 1.7% < 2.0%). 여유가 필요하면 19회 (1.1%)
4. 최악 노이즈 케이스는 `shrink_wrap_auto_1200` (전체 spread 17%) — median 통계로는 이 케이스 하나 때문에 판정이 무너진다

### 4-4. Phase 1 로 이월되는 제약 2건

**(a) 커널은 트리를 모른다 — sink 인자 통과 필요**
`flex_layout` / `grid_layout` 은 flat `f32` 배열 위의 순수 함수이고 `LayoutTree` 를 참조하지 않는다 (호출부는 `tree.rs` 1782·1926·2004·2066 / 2826 뿐). 이벤트 #3(§4.5 floor)의 거처가 커널 내부(`parse_item`)라 **sink 를 인자로 통과**시켜야 하며, `benches/flex_shrink.rs` 의 직접 호출부도 동반 갱신 대상이다(`None` 전달 — baseline 비교성은 유지). 대안(조건을 `tree.rs` 에 복제)은 §4.5 floor 조건 이중화라 **금지** — 커널이 정본.

**(b) 벤치 형태가 leaf 지배를 덮지 않는다**
게이트 비용은 `solve_node` 호출당 상수라, **총비용 대비 비율은 leaf 비중이 높을수록 커진다**. `tree_solve` 는 depth ≤ 12 의 중첩 형태(노드 ~26, leaf 약 절반)이고 실사용은 5k 요소의 **폭 넓은** 문서다. 현재 가장 민감한 검출기는 `nested depth=8 incremental` (208ns · A/A 노이즈 0.5%) 이므로 **G1 1차 판정 케이스로 고정**하고, 형제 다수 케이스 추가 여부는 Phase 1 계측 지점 확정 후 판단한다. (근거: 최선의 경우만 재는 성능 게이트가 통과하고도 실사용 회귀만 남긴 전례 — memory `feedback-perf-gate-favorable-case-only-measurement`)
