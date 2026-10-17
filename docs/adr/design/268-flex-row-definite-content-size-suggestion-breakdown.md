# ADR-268 design breakdown — flex row definite item 의 min-content 측정 복원

> 본문: [ADR-268](../completed/268-flex-row-definite-content-size-suggestion.md). 이 문서는 구현 상세 (phase · 파일 · 체크리스트 · fixture) 와 Phase 0 inventory 의 결론을 둔다. 수치는 측정 뒤 여기에 적는다 — 본문에는 옮기지 않는다.

## 1. 전제 lock-in

- 분리 아님 — 새 ADR 하나. base/응용 · schema 직교성 질문은 해당 없음. ADR-204 의 「row definite 는 이연」 전제를 **그대로 승계하지 않고** 재판정한다 — 단 ADR-204 Phase 4 가 명시한 재개 경로 (서브트리 세대 캐시 · 기준선 갱신 아님) 는 그대로 따른다.
- 허용치 사후 완화 금지: ADR-188 G0 `visits == 2N` (`packages/engine/src/tree.rs:11714`) · ADR-246 ratchet 기존 상한 · 새 엔진 카운트의 Phase 0 상한. 셋 다 이 ADR 이 올리지 않는다.
- oracle: Chrome `getBoundingClientRect` (ADR-156 차등 oracle, `apps/builder/tests/parity/*.browser.test.ts` `runParityCase`) · Compare Mode (live). Blink 코드는 지도.
- 한 격차 = 한 커밋 = 원복 RED 1 + cross-check (또는 live) 1 (정본 §0-2).
- 측정 경계 (ADR-169): TS 변경 0 — `styleOf` · `NodeStyle` · `layoutTypes.ts` 손대지 않는다.

## 2. Phase 0 — inventory · RED · 카운트 (동작 변경 0)

- [x] **RED fixture**: `apps/builder/tests/parity/autoMin.browser.test.ts` 에 F4 케이스 추가 — `(f) row 200 > div{width:200px; min-content 150} ×2` (자식 보유 컨테이너 item — 텍스트 leaf 스칼라 `contentMinWidth: 150` 를 가진 자식 1 로 min-content 150 을 만든다) · 대조군 `(f-auto)` 같은 자식 · 폭 auto (현행 정합) · `(f-scroll)` 같은 item · `overflow: auto` (floor 0 현행 정합). 기대 = Chrome: (f) 150/150 (넘침) · 엔진 현재 100/100 → RED 기록.
- [x] **RED fixture — 판정 반례 2 (리뷰 Round 1 H1)**: `(f-sib) row 300 > A{width:200px; 자식 width 150} + B{width auto; 자식 width 200}` — B 가 **뒤에** 와서 2-b 순차 처리로도 A 를 볼 때 B 의 intrinsic 이 없다. Chrome 150/200 · 엔진 현재 100/200. `(f-basis0) row 500 > {width:200px; flex-basis:0; flex-grow:0; 자식 width 150}` 을 `flex-shrink: 0` · `1` 두 변형으로 — 행이 줄어들지 않아도 §9.2 hypothetical clamp 가 auto min 을 소비한다. Chrome 150 (두 변형) · 엔진 현재 0. 리뷰어 native probe · 최소 HTML 값 (`.agent/runs/2026-10-17-adr268-review/`) 을 oracle 형식으로 다시 잰다.
- [x] **엔진 카운트 export**: `tree.rs` 에 `solve_visits: Cell<usize>` (`solve_node` 진입 — `:1830`) · `intrinsic_measure_miss: Cell<usize>` (`measure_intrinsic_width` MISS 분기 — `:1720` 근처 — 와 1-a 의 `measure_intrinsic_content_width` MISS 분기 합. 새 측정이 이 카운트 밖에 있으면 G2 가 비용을 못 본다) 추가. `wasm.rs` 에 `get_counters() -> Box<[u32]>` · `reset_counters()` export. TS 바인딩 (`wasm-bindings/layoutBridge.ts` · `engine.ts`) 이 읽어 `__composition_LAYOUT_DEBUG__` (정의: `apps/builder/src/builder/workspace/canvas/skia/useSkiaNode.ts`) 에 `getEngineCounters()` 로 노출. `apps/builder/scripts/perf-baseline.mjs` (`:1849-1871` 결정적 카운트 기록 자리) 가 조작 전후 차를 `results.<부류>.counts.engine.{solveVisits,intrinsicMeasureMiss}` 로 기록한다 — `docCounters` 가 `doc.*` 로 펴지는 것과 같은 자리라 `flattenCounts` 뒤 ratchet 키는 **`engine.solveVisits` · `engine.intrinsicMeasureMiss`** (본문 Decision 과 같은 이름 — `layout.` 접두 없음). 조작이 엔진을 한 번도 안 부른 부류도 두 키를 **0 으로 싣는다** (키 부재 ≠ 0). 기존 `skip_walk_visits` (`:627`) 는 그대로 (테스트 전용).
- [x] **등급 판정**: seed 마다 `apps/builder/perf/ratchet.json` `runs.<seed>.args` **그대로** (`60` = `--seed-count 60 --fixed-inputs --call-counts --classes select,edit,page-switch,panel-toggle,drag,select-spread` · `600` = `select,edit,zoom,select-spread` · `600:nested-flex` = `edit` · `60:app-pages` = `zoom,edit,pan,page-switch`) 로 `pnpm perf:baseline -- <args>` 2회. 다른 인자로 잰 보고는 `applyAddKeys` 가 「조건 불일치」 로 거부한다 (`perf-ratchet-gate.mjs:416-419`). 등록 class 전부에서 두 카운트가 정확히 같으면 등급 A. 다르면 R2 축소 경로 (ratchet 편입 없이 ADR-188 단언 + Rust 단위 카운트로만) 를 본문 Status 에 적는다.
- [x] **ratchet 상한 기록 — `--add-keys` (리뷰 Round 1 H3)**: `node apps/builder/scripts/perf-ratchet-gate.mjs --add-keys 60=a.json,b.json 600=a.json,b.json 600:nested-flex=a.json,b.json 60:app-pages=a.json,b.json --keys engine.solveVisits,engine.intrinsicMeasureMiss --accept-recorder`. **`--update` 는 쓰지 않는다** — `applyUpdate` 는 새 양수 키를 **B** 에 넣고 (`:252-255`) 0 인 새 키는 `judge` 가 newKeys 에서 뺀다 (`:209`) → 카운트가 10/0 → 100/100 으로 늘어도 `decide` 는 pass (B 는 경고, 미등록 키는 판정 밖). `--add-keys` 는 정확 키를 보고에 없으면 0 으로 읽어 **0 포함 A** 로 등록하고 (`:450-455`), 값이 갈리면 거부, 기존 A 를 넘는 보고도 거부, 해시를 `recorderChanges` 에 사유와 함께 기록한다. 범위는 API 가 정한다 — 그 seed 의 `run.classes` **전부** (`:437`) 에 들어간다 (edit · select 한정은 지원 방식이 아니다 — 본문 사용자 결정 1 개정). 등록 직후 원복 RED: 판정 순수 함수에 `engine.solveVisits` 를 +1 한 보고를 넣어 `decide` = block 확인 (`perf-ratchet-gate.test.mjs` 에 케이스 1). 커밋 시점은 사용자 결정 1.
- [x] **reach 계수**: 조건 = 1-b 의 판정과 같다 — row 안 definite px 폭 · 자식 보유 · non-scrollable · min auto item 이면서 **floor 없이 푼 커널 결과 main 이 그 item 의 specified size suggestion 보다 작은** 것 (행 전체 shrink 여부 · flex-shrink 값과 무관). 대상 = `app-pages` 22 페이지 (`perfAppFixture.mjs` — `row(...)` 안 `{ width: N }` 자식) · 팔레트 64 트리 (ADR-204 Phase 0 의 210 노드 스크립트 재사용) · 사용자 문서 (QWE). 결과 수를 여기 §기록 에.
- [x] **ADR-188 G0 확인**: `cargo test adr188_g0_engine_skip_walk_baseline` PASS (2N) — 착수 전 값 고정.
- [x] **go/no-go**: RED 재현 + (reach > 0 또는 사용자 결정 2 (a)) 면 go.

## 3. Phase 1 — 대안 A

순서는 캐시 → writer → 문서. 각 단계가 한 커밋, 각 커밋에 원복 RED 1. 엔진 커밋마다 `pnpm wasm:build:engine` 뒤 parity.

### 1-a 서브트리 세대 캐시 (자기 폭 제외 슬롯) — 동작 변경 0

- `tree.rs` `TreeNode` — `intrinsic_content_w: Option<(u64, f32, f32)>` 추가 (의미: 자기 `width` 를 auto 로 둔 content min/max-content, content-box). 기존 `intrinsic_w` (`:544`, 자기 폭 포함 — grid `col_contribution` `:1419` 소비) 는 그대로.
- `subtree_gen: u64` 추가 — **mutation 진입점에서만** 기록한다: `propagate_dirty` (`:851`, `mutation_gen += 1` 직후) 가 자기 노드부터 root 까지 **조기 종료 없는 별도 walk** 로 `subtree_gen = self.mutation_gen` 을 쓴다 (같은 함수의 dirty 전파 루프는 `already_dirty` 면 `break` 한다 — 거기에 얹으면 이미 dirty 인 중간 노드 위 조상이 옛 세대로 남아 stale HIT). `remove_node` (`:889`) 는 옛 부모 체인, 재부모화는 옛 · 새 부모 체인 둘 다. `alloc_handle` (`:751`) 는 새 노드 자신 (부모 체인은 붙일 때의 `propagate_dirty` 가 쓴다). **`mark_subtree_dirty` (`:1546-1559`) 에서는 기록하지 않는다** — 측정 pass 가 `measure_intrinsic_width` 안에서 그것을 부르므로 (`:1709 · :1711`), 기록하면 측정할 때마다 조상 세대가 올라 조상 캐시가 매번 MISS 다 (리뷰 Round 1 H2 와 같은 「측정 pass 의 부작용」 계열 — 수리 중 확인). 자기 서브트리 밖의 mutation 은 이 값을 바꾸지 않는다.
- `measure_intrinsic_content_width(handle)` — `measure_intrinsic_width` (`:1687`) 와 같은 `with_measure_pass` 가상 solve 2회이되 자기 `width` 를 임시 auto 로 두고 잰다. **임시 상태의 저장 · 복원은 helper 가 직접 한다 (리뷰 Round 1 H2)** — `with_measure_pass` 의 `SubtreeSnap` (`:483-491`, 복원 `:1641-1652`) 은 dirty · subtree_dirty · layout · last_avail · last_solved · last_definite_h 만 되돌리고 `NodeStyle` 은 담지 않는다. 그래서 helper 는 (1) `style.width` 와 자기 `intrinsic_w` 를 꺼내 두고, (2) `style.width = None` 을 **필드 직접 대입** 으로 둔다 (`update_style` 금지 — `propagate_dirty` 가 `mutation_gen` · `subtree_gen` 을 올려 자기 캐시를 스스로 무효화한다), (3) `with_measure_pass` 안에서 두 solve, (4) 닫는 즉시 `style.width` · `intrinsic_w` 를 되돌린다 (early return 경로 없이 한 블록). 같은 형태의 선례가 이미 있다 — `measure_intrinsic_height` (`tree.rs:1187-1213`) 가 자기 height/min/max 를 꺼내 두고 `with_measure_pass` 클로저 안에서 비운 뒤 solve 하고 되돌린다. 비우는 것은 `width` 하나다 — `min-width` 는 후보 조건상 auto 이고, `max-width` 는 남겨 solve 의 clamp 가 §4.5 「content size suggestion 은 확정 max 로 clamp」 를 그대로 한다. 측정 중 자기 `intrinsic_w` 를 누가 쓰더라도 「자기 폭 포함」 의미가 깨지지 않게 (4) 가 덮는다. 결과는 `intrinsic_content_w = Some((subtree_gen, min, max))`. 캐시 키 = `subtree_gen`. HIT 면 방문 0.
- Rust 단위: `intrinsic_content_measure_restores_style_and_caches` — width 200 노드 측정 뒤 `style.width == Some("200px")` · `intrinsic_w` 측정 전과 같음 · `mutation_gen` · 조상 `subtree_gen` 불변 · 이어서 `compute_layout` 한 layout 이 측정 없이 푼 layout 과 같음 (리뷰어 probe `measurement_snapshot_does_not_restore_temporary_style` 이 (4) 를 빼면 RED). `intrinsic_content_cache_hits_when_sibling_changes` (형제 편집 → HIT) · `intrinsic_content_cache_misses_when_descendant_changes` (자손 편집 → MISS · 새 값) · `intrinsic_content_cache_misses_after_two_edits_under_dirty_node` (compute 없이 같은 서브트리 두 번 편집 — 조기 종료 walk 였다면 RED) · `intrinsic_content_cache_misses_on_reparent` (옛 · 새 부모) · `measure_does_not_bump_ancestor_subtree_gen` · grid `None` 유지.
- 원복 RED (1-b 뒤 유효): 키를 `mutation_gen` 으로 되돌리면 ADR-188 fixture 4N RED.

### 1-b writer — 커널 결과로 판정하는 지연 floor (2-b 의 `continue` 는 그대로)

판정 기준은 **「auto minimum 이 이 item 의 결과를 바꿀 수 있는가」** 다 (리뷰 Round 1 H1 — 행 전체 shrink 여부 · `flex-shrink > 0` 은 기준이 아니다). §4.5 의 auto min = `min(specified size suggestion, content size suggestion)` ≤ specified (= 그 item 의 px `width`, 확정 max 로 clamp). 따라서 floor 없이 푼 커널 결과 main 이 specified 이상인 item 은 floor 가 결과를 바꿀 수 없다 — 측정을 건너뛰어도 Chrome 과 같다. 결과가 specified 보다 작으면 (shrink 로 줄었든 · `flex-basis: 0` 의 hypothetical 이 작든) 잰다.

- **판정은 2-b 뒤 · 커널 결과 위에서** — 종전 초안의 pre-scan (1) 단계 `child_sizes` 합산) 은 버린다. 1) 단계는 nowrap row 의 auto 컨테이너 item 을 `deferred_to_resolve` 로 미뤄 `(0, 0)` 을 넣고 (`tree.rs:3052-3070`) 실제 max-content 는 2-b 가 넣는다 — 그 합은 hypothetical 이 아니다 (반례 `(f-sib)`: 200 + 0 < 300 이라 건너뛰지만 Chrome 은 A = 150). 2-b 가 끝난 `data` 는 auto 형제의 intrinsic · 명시 basis · min/max 를 전부 담고 있고 (`:3270-3272` 주석 — 「커널이 실제로 보는 입력」), 커널이 그것으로 §9.2 hypothetical clamp 와 §9.7 분배를 한다. 그래서 판정을 커널 출력에 둔다.
- `tree.rs:3146-3156` 의 `continue` 는 **그대로 둔다** (2-b 에서 definite item 을 재지 않는다). 대신 커널 호출 4곳 (`:3281` 1차 · `:3494` 3.5 재-solve 뒤 · `:3573` 3.6 main clamp · `:3642` cross clamp) 을 helper `flex_layout_with_definite_floor(&mut data, …)` 하나로 감싼다:
  1. `flex::flex_layout` 1회.
  2. 후보 = row · 아직 안 잰 · definite **px** 폭 · 자식 보유 · `content_min_width.is_none()` · non-scrollable (`off 18 == 0`) · min auto (`off 9 == -1`) item 중 **커널 출력 main < specified size suggestion** 인 것. 비교식은 커널의 `auto_min_main_from_parts` (`flex.rs:360-406`) 와 같은 box 공간이어야 하므로 `flex.rs` 에 순수 함수 `definite_item_floor_may_bind(data, out, i, is_row) -> bool` 로 둔다 (조건 판정은 커널 쪽 한 곳이 소유 — `resolve_auto_min_main` 과 같은 원칙, §4-4a).
  3. 후보가 없으면 끝 (흔한 경우 — 추가 solve 0 · 커널 1회). 있으면 후보마다 `measure_intrinsic_content_width` → `data[off + 19] = min_w` (0 이면 종전 규칙대로 `off 9 = 0`) → 커널 재실행 → 2 로. floor 는 올라가기만 하고 item 마다 한 번만 재므로 item 수 안에서 끝난다 — 한 item 에 floor 가 걸리면 줄어든 여유가 형제로 넘어가 형제가 새로 specified 아래로 갈 수 있어 반복이 필요하다.
  - 커널 재실행은 child solve 가 없는 f32 산술이다. 엔진 방문 수 (`solve_visits`) 를 늘리는 것은 측정 MISS 뿐이다.
- intrinsic 키워드 폭 분기 (`:3168-3187`) 는 그대로 (키워드 폭은 2-b 가 auto 로 받아 이미 잰다).
- 커널 `flex.rs:360-406` 의 floor 절 변경 없음 — 슬롯 19 가 채워지면 `SpecifiedSizeMin` 절이 이미 동작한다. 주석 (`:380-386`) 의 「컨테이너 … ADR-204 Phase 1/2」 를 「row definite 컨테이너 = ADR-268 (지연 floor)」 로.
- Rust 단위: 정본 F4 (200 > 200×2 · min-content 150 → 150/150) · **`(f-sib)` 300 > A 200 + 뒤 auto B (자식 200) → 150/200** · **`(f-basis0)` 500 > basis 0 · grow 0 · shrink 0 / 1 → 150** · 형제 연쇄 (A 의 floor 로 B 가 새로 specified 아래 → B 도 측정) · 커널 결과 ≥ specified 인 행 (측정 0 — `intrinsic_measure_miss` 단언) · `width_definite_item_keeps_free_shrink` 불변 (스칼라 부재 · **자식 없는** definite item — 후보 아님). 리뷰어 native probe 2건 (`deferred_auto_sibling_is_zero_in_step_one_prescan` · `no_shrink_row_still_needs_auto_minimum_for_explicit_basis`) 은 기대값을 Chrome 값으로 바꿔 GREEN 이 돼야 한다.
- cargo: `adr188_g0_engine_skip_walk_baseline` 2N PASS (row 5000 > clean 컨테이너 5000 + dirty leaf → 1px shrink → clean 컨테이너가 후보 → `subtree_gen` HIT → 방문 0).
- browser: Phase 0 (f) · (f-sib) · (f-basis0) 2변형 GREEN · (f-auto) · (f-scroll) 불변 · `autoMin` · `flexSweep` · `basicAxis*` · `containerIntrinsic` 전량.
- 원복 RED: 2-b `continue` 는 이 단계에서 바뀌지 않으므로 그것을 되돌리는 원복은 무의미하다 (Round 2 참고). helper 의 2 · 3 단계를 우회 (커널 1회만 · 슬롯 19 미기록) → (f) · (f-sib) · (f-basis0) 2변형 RED.

### 1-c ratchet · live

- `pnpm gate:perf-ratchet` (또는 `perf-ratchet-run.mjs`) — seed 4 의 등록 class 전부: 기존 등급 A 변동 0 · `engine.solveVisits` · `engine.intrinsicMeasureMiss` ≤ Phase 0 등급 A 상한 (0 인 class 는 0 그대로 — 이 키는 `--add-keys` 로 A 에 있으므로 초과가 `decide` = block 이다). 초과면 1-a 의 세대 기록 범위 (조상 체인 길이 · HIT 조건) 를 고치고 재측정 — 상한은 두지 않는다. 그래도 초과면 본문 Decision 의 Deferred 경로.
- live (Chrome MCP · G3): row frame 200 > `width: 200` Button 둘 (라벨 길게) → Compare Mode Canvas 폭 = Preview 폭 · 라벨 편집 뒤 (자손 변경) 도 같음. 결과 → 본문 `### Live Exercise`.

### 1-d 문서 · 상태

- `tree.rs:3149-3153` 이연 주석 → 「ADR-268 — definite item 은 2-b 가 아니라 커널 결과 기반 지연 floor (`flex_layout_with_definite_floor`) 가 서브트리 세대 캐시로 잰다」.
- `.claude/rules/layout-engine.md` §엔진 CSS 정합 규칙 색인 행 5 (§4.5) · 행 6 (측정 캐시 — 「캐시 키는 `mutation_gen`」 에 content 슬롯의 `subtree_gen` 병기).
- ADR-204 (`completed/204-*.md`) Status 진행 로그의 「이연 확정 1」 에 「→ ADR-268 (날짜) 로 닫힘」 한 줄 (본문 결정은 바꾸지 않는다).
- 정본 `CHROMIUM_CANVAS_PARITY_2026-10.md` F4 (§0-2 행 7 · §7-0 표 행 4 · §7-2) — `source-reported` → `gate-passed`, ratchet 엔진 카운트를 §11-3 성능 에 한 줄.
- `docs/adr/README.md` · CHANGELOG (사용자-가시: 좁은 row 의 고정 폭 Button · Frame 폭이 Preview 와 같아짐).

## 4. Phase 2 — 종결

- [x] G2 · G3 통과 → Implemented 승격 (`### Live Exercise` 기재) · README 완료 표 이동 · `docs/adr/reviews/268.md` (리뷰가 있었으면) pending 0 확인.
- [x] 메모리 `project-blink-layout-delta-2026-10` 의 F4 줄 갱신.

## 5. 파일 변경표 (추정 — Phase 0 에서 확정)

| 파일                                                                                    | 변경                                                                                                                                   | Phase         |
| --------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------- | ------------- |
| `packages/engine/src/tree.rs`                                                           | 카운터 2 · `intrinsic_content_w` · `subtree_gen` · `measure_intrinsic_content_width` · 지연 floor helper (커널 호출 4곳) · 단위 테스트 | 0 · 1-a · 1-b |
| `packages/engine/src/wasm.rs`                                                           | `get_counters` · `reset_counters` export                                                                                               | 0             |
| `packages/engine/src/flex.rs`                                                           | `definite_item_floor_may_bind` 판정 함수 · 주석 (`:380-386`)                                                                           | 1-b           |
| `apps/builder/src/builder/workspace/canvas/wasm-bindings/layoutBridge.ts` · `engine.ts` | 카운터 읽기                                                                                                                            | 0             |
| `apps/builder/src/builder/workspace/canvas/skia/useSkiaNode.ts`                         | `__composition_LAYOUT_DEBUG__.getEngineCounters`                                                                                       | 0             |
| `apps/builder/scripts/perf-baseline.mjs`                                                | 결정적 카운트에 `engine.*` 2 키                                                                                                        | 0             |
| `apps/builder/perf/ratchet.json`                                                        | 새 키 A 상한 (`--add-keys`, 0 포함) · `recorderChanges` 1                                                                              | 0             |
| `apps/builder/scripts/perf-ratchet-gate.test.mjs`                                       | `engine.*` +1 보고 → block 케이스                                                                                                      | 0             |
| `apps/builder/tests/parity/autoMin.browser.test.ts`                                     | (f) · (f-sib) · (f-basis0) ×2 · (f-auto) · (f-scroll)                                                                                  | 0             |
| `.claude/rules/layout-engine.md` · 정본 · ADR-204 로그 · README · CHANGELOG             | 문서                                                                                                                                   | 1-d · 2       |

추정 10 파일 (문서 제외). TS 변경은 카운터 읽기만 — 레이아웃 입력 (`styleOf`) 변경 0.

## 기록

### Phase 0 — 2026-10-17 (go)

- **RED 재현** (`autoMin.browser.test.ts`, Chrome `getBoundingClientRect` vs 엔진): (f) c0 · c1 폭 Chrome 150/150 · 엔진 100/100 · (f-sib) A Chrome 150 · 엔진 100 (B 200 양쪽 같음) · (f-basis0) shrink 0 · 1 둘 다 Chrome 150 · 엔진 0. 대조군 (f-auto) · (f-scroll) 정합. 정본 F4 의 source-reported 수치와 같다.
- **ADR-188 G0**: `adr188_g0_engine_skip_walk_baseline` PASS — n=50/500/5000 → visits 100/1000/10000 (2N).
- **엔진 카운트**: `tree.rs` `solve_visits` (`solve_node` 진입) · `intrinsic_measure_miss` (두 측정 함수 MISS 합) — `counters()` / `reset_counters()`. wasm export 는 **스칼라 getter 둘** (`solveVisits()` · `intrinsicMeasureMiss()` + `resetCounters()`) 이다 — 계획의 `get_counters() -> Box<[u32]>` 는 wasm-bindgen glue 가 `getDataViewMemory0` 로 읽어 측정 창의 기존 등급 A 키 `seeds.60.page-switch.A.v8.fn…engine_bg.js#getDataViewMemory0` 를 180 → 182 로 올렸다 (HC2 위반 — 첫 측정에서 잡아 바꿈, 바꾼 뒤 180). TS 는 `engine.ts` 가 dev 빌드에서만 살아 있는 엔진을 `WeakRef` 로 모아 합하고 (해제된 엔진의 카운트는 합에 남긴다) `window.__composition_ENGINE_COUNTERS__` (`snapshot` · `reset`) 로 노출한다 — 계획의 `__composition_LAYOUT_DEBUG__` 는 지금 src 에 정의가 없어 ADR-265 `__composition_DOC_COUNTERS__` 와 같은 형태를 따랐다. 하니스 (`perf-baseline.mjs`) 는 `counts.engine.{solveVisits,intrinsicMeasureMiss}` 로 싣는다.
- **등급 판정**: seed 가 ADR-267 로 **5 개** (`60:sticky-lists` = edit · select 추가) 라 17 class. `runs.<seed>.args` 그대로 2회 — 17 class 전부 a = b (등급 A). 기존 등급 A 초과 0 (두 회 모두), B 경고 1 (b 회 — 판정 밖). 0 이 아닌 값: `60` edit 976/0 · drag 65/0 · `600` edit 9076/0 · zoom 250/0 · `600:nested-flex` edit 1284/90 · `60:app-pages` zoom 2250/0 · edit 14448/192 · `60:sticky-lists` edit 690/0 (solveVisits/intrinsicMeasureMiss). 나머지 class 는 0/0.
- **ratchet 등록**: `perf-ratchet-gate.mjs --add-keys <5 seed>=a,b --keys engine.solveVisits,engine.intrinsicMeasureMiss --accept-recorder` → 34 키 (17 class × 2) 0 포함 A. 기존 값 변동 0. `recorderChanges` 에 `e2b3bd85… → ea9cf645…` (`--add-keys engine.*`). 판정 테스트 `perf-ratchet-gate.test.mjs` 「engine.* 0 포함 A 등록 뒤 +1 보고는 block」 (+1 두 키 각각 block · 같은 보고를 `--update` 로 넣었다면 pass 인 반례 포함) — 20/20.
- **reach** (현재 엔진 = floor 없음 · 조건은 1-b 판정과 같다): `app-pages` 22 페이지 (record 5,116) 에서 row 안 definite px · 자식 보유 · non-scrollable · min auto · 텍스트 스칼라 없는 item **245**, 그중 결과 폭 < specified **14** (frame — 예 1100 → 1093.5 · 580 → 564 · 840 → 823.6, 전부 nowrap). 팔레트 77 항목 기본 상태 (Slot 은 layout 전용이라 거부 — record 523) 는 0. 사용자 문서 (QWE) 는 하니스 격리 컨텍스트에 없어 세지 않았다. 측정 스크립트 = 세션 scratchpad (`reach.mjs` — 격리 프로젝트 + `__COMPOSITION_CATALOG__.workspace.root` 의 `getAppliedLayoutInput` · `getGeometry`).
- **go/no-go**: RED 재현 + reach 14 > 0 → **go** (사용자 결정 2 해당 없음).

### Phase 1 · 종결 — 2026-10-17 (Implemented)

- **1-a** `TreeNode.intrinsic_content_w` · `subtree_gen`. 세대는 `propagate_dirty` (조기 종료 없는 별도 walk `stamp_subtree_gen`) · `remove_node` (옛 부모 체인) · `set_children` 의 재부모화 (옛 부모 체인 — 새 체인은 이어지는 `propagate_dirty`) · `alloc_handle` (자신) 만 쓴다. `measure_intrinsic_content_width` 는 width · `intrinsic_w` 를 꺼내 두고 필드 직접 대입으로 비운 뒤 `with_measure_pass` 안 solve 2회 → 복원. MISS 는 `intrinsic_measure_miss` 에 더한다. Rust 7 (계획 6 + 「옛 부모 children 을 그대로 둔 재부모화」 1). 계획과 다른 점: 테스트 컨테이너가 flex row 라 min-content = item 기여의 합 (300 · 310) — 기대값을 그에 맞췄고, dirty 아래 두 번 편집은 MISS 수 대신 저장 세대 증가로 단언 (중첩 컨테이너의 `measure_intrinsic_width` MISS 가 같은 카운터에 섞인다).
- **1-b** 판정 `flex::definite_item_floor_may_bind(data, out, i, is_row)` — row · definite main · min auto · non-scrollable · 슬롯 19 비어 있음 · `out` border-box main < (min(main, max) + pad_border_main) − 0.5. helper `flex_layout_with_definite_floor(children, data, floor_measured, is_row, kernel)` 가 커널 호출 4곳 (1차 · 3.5 · 3.6 · 3.7) 을 감싸고, 트리 조건 (자식 보유 · `content_min_width` 없음 · px 폭) 은 helper 가 본다. `floor_measured` 는 한 `solve_flex` 안 4 호출이 공유. min-content 0 이면 결과가 그대로라 재실행하지 않는다 (계획의 「off 9 = 0」 은 필요 없었다). Rust 7 (F4 · f-sib · f-basis0 ×2 · 형제 연쇄 · 맞는 행 측정 0 · 자손 편집 추종 + 형제 HIT · scroll / 명시 min 비후보).
- **G1**: cargo 480 + golden 15 · 10 · 15 · 1 PASS. 원복 RED — helper 우회 (`if true { return out; }`) → autoMin F4 4 RED · 세대 키를 `mutation_gen` 으로 → `adr188_g0_engine_skip_walk_baseline` N=50 visits 198 (2N = 100) RED. 둘 다 trap 복원 + cmp.
- **G2**: Phase 1 wasm 으로 seed 5 · 17 class 2회 — 기존 A 초과 0 · B 경고 0 · `engine.*` 17 class 전부 Phase 0 값 그대로 (A 상한 = 값) · `--raise` 0. parity 829/830 — 실패 1 `adr248CatalogGeometryDelta` case 2 (`subtreeNodeVisits` 기대 4 · 실제 1) 는 HEAD 엔진 빌드로도 같은 값이라 이 ADR 과 무관 (ADR-264 옮기기 뒤 낡은 기대값 — 테스트가 쓰는 `design/248-phase3-geometry-delta.json` 은 HEAD 로 되돌렸다). F4 fixture 4 ≤ 1 px · 대조군 2 · `autoMin` 14/14.
- **reach 재계수** (Phase 1 wasm): 후보 14 는 그대로 측정되지만 폭이 바뀐 item 0 — 14 개 모두 내용 min-content 가 이미 결과 폭 아래다. 화면 변화는 내용이 고정 폭 아래로 밀릴 만큼 긴 경우에만 난다 (G3 live 의 「QuarterlyRevenue」).
- **G3** live 9/9 (본문 `### Live Exercise`) + RED arm (helper 우회 빌드 — 편집 뒤 Frame Canvas 100/100 · Preview 129.6/70.4 FAIL). Button 은 엔진에서 텍스트 leaf (`contentMinWidth` 스칼라) 라 이미 floor 가 있었다 — 이 ADR 의 대상은 자식 보유 컨테이너 item.
- **G4**: 정본 F4 `gate-passed` (§0-2 행 7 · §7-0 행 4 · §7-2) + §11-3 엔진 카운트 한 줄 · `tree.rs` 이연 주석 · `flex.rs` floor 절 주석 · `layout-engine.md` 색인 행 5 · 6 · ADR-204 Phase 4 이연 확정 1 에 「ADR-268 로 닫힘」 · README · CHANGELOG.
- 파일 (문서 제외): 계획 10 → 실제 9 — `engineWasm.ts` 타입이 늘고 `useSkiaNode.ts` · `layoutBridge.ts` 는 손대지 않았다 (카운트 노출은 `engine.ts` 한 곳).

### 2026-10-17 — Phase 1 후속: viewport 환경 변경 캐시 수리

- 구현 판독 Round 3 LOW: 기존 엔진에 `setViewport(300,800)` → row 200 안 width 200 item 둘 (각 자식 `50vw`) → `setViewport(600,800)` 하면 item 폭이 150에 남고 fresh 엔진은 200이었다. 현재 Builder의 breakpoint 교체는 엔진을 비워 production 차단 이슈로 올리지 않았으나, 엔진의 환경 의존 캐시 계약을 수리했다.
- 설계 보완: 자기 폭 제외 슬롯의 키를 `max(subtree_gen, viewport_gen)`으로 판정한다. 두 세대는 같은 `mutation_gen` 시간축을 사용한다. viewport 변경 때만 전역 측정 세대와 `viewport_gen`을 올려 기존 `intrinsic_w`도 무효화한다. 서브트리 세대는 그대로여서 형제 편집 HIT와 ADR-188 `2N`을 유지한다. setter에서 노드를 순회하지 않으며 측정 pass는 세대를 바꾸지 않는다.
- 회귀: 문서 mutation 없는 viewport 증가·감소의 `vw`·`vh` item 배치 = fresh build, 동일 viewport 재설정 HIT, 기존 intrinsic 폭 캐시의 viewport 추종. Rust에서 수리 전 두 테스트 RED를 확인했다.
- 검증: Rust 524/524 (unit 483 · 부가 41), 재빌드 WASM 반례 1/1 (`first 150 · warm 200 = fresh 200`), Chromium 42/42 (새 vw/vh 차등 포함), typecheck PASS. ratchet 상한 변경 없음. [리뷰 Round 4](../reviews/268.md#round-4) l1 fixed. 실제 Builder UI·production 성능·번들·전체 ratchet은 재실행하지 않았다.
