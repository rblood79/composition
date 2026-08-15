# ADR-183 Design Breakdown: 레이아웃 explain 디버그 채널 (엔진 판정 트레이스)

> 본문: [183-layout-explain-channel.md](../183-layout-explain-channel.md)
> 상태: Accepted (2026-08-15 리뷰 승인) — **Phase 0~2 완료 2026-08-15** (§4 산출물 freeze + G1 PASS + WASM 경계). 다음 진입점 = Phase 3 (TS 판독 채널 + G2·G3)

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

### Phase 1 — 엔진 trace 코어 ✅ 2026-08-15 (G1 PASS)

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

### Phase 2 — WASM 경계 ✅ 2026-08-15

- `wasm.rs` (wasm-bindgen surface — `build_tree_batch` 가 있는 파일): `enableLayoutTrace(enabled: bool)` / `getLayoutTrace(handle) -> String(JSON)`. JSON 스키마 계약은 wasm32 게이트 아래 층(`tree.rs::trace_json`)이 소유해 **native 테스트로 잠근다** (`tests/layout_trace.rs` §6.5 — wasm 표면은 문자열 그대로 위임)
- **binary_protocol / `build_tree_batch` 계약 무변경** (HC3) — 트레이스는 별도 조회 API, 배치 payload 에 싣지 않는다
- enable 시에만 sink 할당 (R3 — off 시 메모리 0)
- `compositionEngineWasm.ts` 바인딩(raw 2메서드) + `compositionEngine.ts` wrapper (`EngineTraceEvent`/`EngineTraceNode` wire 타입 — serde internally-tagged 1:1, 디버그 채널이라 미준비 시 throw 대신 false/null) + `LayoutEngineAPI` **optional** 메서드 (테스트용 fake 엔진이 구현을 강제받지 않게)
- **실측 정정 (2026-08-15)**: element id ↔ node handle 변환의 실소유자는 `idMapper.ts` 가 아니라 `persistentTaffyTree.ts::handleMap` 이다 — `idMapper` 는 SpatialIndex 용 UUID↔u32 매핑으로 레이아웃 handle 과 무관. passthrough 는 `PersistentTaffyTree.enableLayoutTrace(enabled)` / `.getLayoutTraceForElement(elementId)` (기존 `getHandle` 접근자와 같은 층)

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

**프로토콜 (G1 집행 시 필수)** — Phase 1 집행에서 4·5항이 실측으로 추가됐다:

1. 두 변형(A = 계측 없음 / B = 계측 삽입 + 게이트 off)의 벤치 바이너리를 **사전 빌드** (`cargo bench --no-run`) 후 **번갈아 직접 실행** — `cargo bench` 재빌드가 표본 사이에 끼면 캐시 상태가 갈린다. A 는 `git worktree` 로 뜬 기준 커밋에서 빌드한다 (stash 금지 — 병렬 세션 WIP 위험)
2. **첫 2회 폐기** (콜드)
3. **A/A 대조군을 같이 돌린다** — 같은 바이너리를 두 arm(A1·A2)으로 실행해 그 회차의 노이즈 바닥을 **동시에** 측정한다. 이것 없이는 관측된 Δ 가 효과인지 그날의 노이즈인지 못 가른다 (실측: 노이즈 바닥이 회차마다 1.9% → 6.5% → 19.7% 로 요동쳤다)
4. **arm 순서를 반복마다 회전**한다 (`A1 A2 B` / `A2 B A1` / `B A1 A2`). 고정 순서면 마지막 arm 이 반복 내 드리프트를 체계적으로 떠안아, **없는 회귀가 B 에만 붙는다** (실측: 고정 순서에서 `depth=12` +5.1%, 회전 후 −0.2%)
5. **판정 통계량은 min 이 아니라 "반복 내부 쌍대 비율의 중앙값"** — 각 반복에서 `B / mean(A1, A2)` 를 구하고 그 중앙값을 본다. 인접 실행끼리 나누므로 곱셈성 드리프트(주파수·발열)가 상쇄된다. 실측 비교 (같은 데이터셋):

| 통계량                | 노이즈 바닥 (A/A) | 판정 가능?        |
| --------------------- | ----------------: | ----------------- |
| min-of-28             |              2.4% | ❌ (임계 2% 초과) |
| **반복 내 쌍대 비율** |         **0.25%** | ✅                |

> 구 3항(“min · 군당 14회”)은 Phase 0 에서 A/A 만으로 도출한 것인데, 실집행에서 노이즈 바닥이 그날 상태에 따라 임계를 넘나들어 판정이 서지 않았다. min 은 극값 통계라 arm 별로 “깨끗한 실행”이 몇 번 걸렸는지에 좌우된다 — 쌍대 비율이 그 의존을 없앤다.

**벤치 하니스도 같이 고쳤다** (`benches/tree_solve.rs`, A/B 양쪽에 동일 적용 필수):

- `measure` 에 `batch` 인자 추가 — `nested depth=8 incremental` 은 208ns 로 macOS 타이머 틱(약 41.7ns)의 5배뿐이라 인접 틱 한 칸에 ±20% 가 흔들렸다(같은 바이너리 A/A 에서 208 ↔ 167 실측). 500회를 한 구간으로 재 해상도와 `Instant::now()` 오버헤드를 함께 나눈다 → 194ns, 노이즈 0.0%
- 배치는 **타이머 해상도에 걸린 케이스에만**. full solve(4~27µs)에 batch 8 을 걸었더니 한 샘플이 길어져 스케줄러 방해를 더 타 오히려 악화됐다 (depth=1: median 3958 → 8578, p90 11614)
- full solve 는 표본 수를 200 → 800 으로 (구간 길이는 그대로, 실행별 중앙값만 안정화)

### 4-4. Phase 1 로 이월되는 제약 2건

**(a) 커널은 트리를 모른다 — sink 인자 통과 필요**
`flex_layout` / `grid_layout` 은 flat `f32` 배열 위의 순수 함수이고 `LayoutTree` 를 참조하지 않는다 (호출부는 `tree.rs` 1782·1926·2004·2066 / 2826 뿐). 이벤트 #3(§4.5 floor)의 거처가 커널 내부(`parse_item`)라 **sink 를 인자로 통과**시켜야 하며, `benches/flex_shrink.rs` 의 직접 호출부도 동반 갱신 대상이다(`None` 전달 — baseline 비교성은 유지). 대안(조건을 `tree.rs` 에 복제)은 §4.5 floor 조건 이중화라 **금지** — 커널이 정본.

**(a) 결과 — 래퍼가 아니라 본체를 공유하는 형태로 해소** (Phase 1)
`flex_layout` 시그니처는 **무변경**이다. `auto_min_main_from_parts(main_size, min_main, max_main, content_main, overflow_clipped, content_min_main)` 가 조건의 단일 정의를 갖고, 커널(`parse_item`)은 **이미 읽은 값을 인자로** 넘긴다. 트레이스는 `resolve_auto_min_main(data, i)` 로 같은 본체를 부른다. 따라서 sink 인자 통과도, 벤치 호출부 갱신도 불필요했다.

> 처음엔 `resolve_auto_min_main(data, i)` 를 커널이 직접 부르게 했는데, 아이템당 배열 6 load 가 중복돼 1000-아이템 벤치에서 **+2~3%** 로 나왔다 (G1 1차 측정). "단일 정의" 는 유지하고 "재접근" 만 없애는 것이 정답이다. 반환 tuple 의 출처 필드가 커널에서 DCE 되도록 `#[inline(always)]` 를 건다.

**(b) 벤치 형태가 leaf 지배를 덮지 않는다**
게이트 비용은 `solve_node` 호출당 상수라, **총비용 대비 비율은 leaf 비중이 높을수록 커진다**. `tree_solve` 는 depth ≤ 12 의 중첩 형태(노드 ~26, leaf 약 절반)이고 실사용은 5k 요소의 **폭 넓은** 문서다. 현재 가장 민감한 검출기는 `nested depth=8 incremental` (배치 측정 후 194ns · A/A 노이즈 0.0%) 이므로 **G1 1차 판정 케이스로 고정**한다. (근거: 최선의 경우만 재는 성능 게이트가 통과하고도 실사용 회귀만 남긴 전례 — memory `feedback-perf-gate-favorable-case-only-measurement`)

> **Phase 1 정정**: Phase 0 이 이 케이스의 A/A 노이즈를 0.5% 로 적은 것은 **운이었다** — 208ns 는 타이머 5틱이라 모든 실행이 우연히 같은 틱에 떨어졌던 것이고, 표본을 늘리자 208 ↔ 167 로 갈렸다(19.7%). 배치 측정 도입 후에야 실제로 0.0% 다. **해상도 바닥에 붙은 값의 낮은 분산은 안정성의 증거가 아니라 양자화의 증거**일 수 있다.

형제 다수(폭 넓은 트리) 케이스는 **추가하지 않았다**: 게이트 비용은 `solve_node` 호출당 상수이고 노이즈는 곱셈성(주파수·발열)이라, 노드를 늘려도 **비율**은 그대로여서 해상도가 좋아지지 않는다. 실제로 해상도를 만든 것은 노드 수가 아니라 위 §4-3 의 쌍대 통계다. 다만 leaf 비중이 다른 형태에서 비율 자체가 달라질 여지는 남으므로, Phase 3 G2 의 라이브 실측(실문서)이 그 확인을 겸한다.

### 4-5. G1 결과 (2026-08-15 — PASS)

A = `cfe567dd8` (계측 이전, `git worktree` 빌드) / B = 계측 + 게이트 off. 하니스는 양쪽 동일본. 반복 30회 × 3 arm, 순서 회전, 콜드 2회 폐기, 판정 = 반복 내 쌍대 비율 중앙값.

| 케이스                        | 노이즈 (A2/A1) | 효과 (B/A) |
| ----------------------------- | -------------: | ---------: |
| `shrink_nowrap_1000`          |         +0.12% |     +0.22% |
| `shrink_wrap_auto_1200`       |         −0.25% |     +0.21% |
| `grow_nowrap_1000`            |         +0.25% |     −0.24% |
| `shrink_minfloor_1000`        |         +0.23% |     −0.17% |
| `shrink_minfloor_freeze_1000` |         +0.23% |     −0.22% |
| `nested depth=1 full`         |         −0.01% | **+1.57%** |
| `nested depth=4 full`         |         +0.24% |     +0.00% |
| `nested depth=8 full`         |         +2.51% |     −1.41% |
| `nested depth=12 full`        |         +2.71% |     −1.51% |
| `nested depth=8 incremental`  |         +0.00% |     +1.11% |

**판정: PASS** — 최대 +1.57% ≤ 2%.

읽는 법: flex 커널 5종이 전부 ±0.25% 인 것이 **커널 무변경의 확증**이다(§4-4a 의 로드 중복을 고치기 전에는 여기가 +2~3% 였다). 비용이 보이는 곳은 `depth=1`(+1.57%)과 `incremental`(+1.11%) — 호출당 상수 비용이 **호출당 작업량이 가장 작은** 형태에서 가장 크게 보이는, 물리적으로 앞뒤가 맞는 모양이다. `depth=8/12` 의 음수 값은 그 케이스의 A/A 노이즈가 2.5% 대라 해석하지 않는다.
