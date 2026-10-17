# ADR-268: flex row definite item 의 min-content 측정 복원 — ADR-204 가 성능으로 미룬 §4.5 content size suggestion 을 ratchet 카운트로 재판정

## Status

Proposed — 2026-10-17

- 사용자 요청: `/create-adr flex row definite item 의 §4.5 content size suggestion 복원 (F4) — ADR-204 perf 이연을 ADR-246 ratchet 카운트로 재판정 · 허용치 사후 완화 금지` (2026-10-17)
- 방향을 정한 사용자 원문: 「CHROMIUM_CANVAS_PARITY_2026-10.md 이 항목들은 설계문서로 다시 작성해야하나」 → 「전체 작성해야하는 ADR은 몇개가 되지」 → 「확정3개 create-adr 제목 모두 정해줘」 (2026-10-17). Chromium 대조 정본 [CHROMIUM_CANVAS_PARITY_2026-10.md](../explanation/research/CHROMIUM_CANVAS_PARITY_2026-10.md) 의 51 행 가운데 ADR 이 필요한 확정 3 건 (X8 sticky · fixed = [ADR-267](completed/267-sticky-fixed-position-canvas-engine.md) / **F4** / O1) 의 두 번째.
- 이미 정해진 것 (요청 원문 · 정본 §0-2 행 7 · ADR-204 Phase 4 판정): **허용치 사후 완화 금지** — ADR-188 G0 방문 수 단언 (`2N`) 과 ADR-246 ratchet 상한은 이 ADR 이 올리지 않는다. 구현이 그 안에 들어가지 못하면 구현을 바꾸거나 이연을 유지한다. oracle 은 Blink 코드가 아니라 Chrome `getBoundingClientRect` (ADR-156 차등 oracle) 다. Blink 인용은 고정 SHA `33688427bc1a316cecb28d5651ad25208ba9ab53` 원본을 직접 읽은 것 (code-confirmed), composition 쪽 수치 (Blink 150/150 vs 엔진 100/100) 는 아직 source-reported — Phase 0 이 재현한다.
- 리뷰: [reviews/268.md](reviews/268.md) Round 1 (2026-10-17, codex) — HIGH 3 (H1 측정 판정 · H2 임시 width 복원 · H3 ratchet 등록 방식). 2026-10-17 본문 · breakdown 수리 — 대안 A 의 판정을 「shrink 행 pre-scan」 에서 「floor 없이 푼 커널 결과가 specified size suggestion 아래인 item」 으로, 측정 helper 의 width 저장 · 복원을 helper 소유로, ratchet 등록을 `--add-keys` (0 포함 등급 A) 로 바꿨다. **Round 2 (2026-10-17) 수리 검증 통과 — H1 · H2 · H3 closed, 신규 HIGH/MEDIUM 0, pending 0. 설계 리뷰 종결** (전제 확정 — 재개 조건 외 재질문 없음). 제품 gate (wasm 카운터 · seed 4 측정 · ADR-188 2N · parity · live) 는 Phase 0 이후 실행.

Related: [ADR-204 가상화 collection 의 min-content floor](completed/204-virtualized-collection-min-content-floor.md) (이연 결정의 원문 — Phase 1 evidence §1-2 · Phase 4 「ADR-188 기준선을 4N 으로 갱신하지 않는다 · 재개 경로는 서브트리 세대 캐시」) · [ADR-188 타깃 레이아웃 입력과 Skia 서브트리 패치](completed/188-targeted-layout-and-skia-subtree-patching.md) (방문 수 기준선 G0 — `tree.rs` `adr188_g0_engine_skip_walk_baseline`) · [ADR-246 결정적 카운트 ratchet](completed/246-deterministic-count-ratchet-and-begin-frame-harness.md) (성능 판정 수단 — 상한은 내려가기만, 올리기는 승인 + 만료일) · [ADR-169 측정 채널 경계](completed/169-container-intrinsic-sizing-propagation.md) (폰트 측정은 TS · 구조 집계는 엔진 — 이 ADR 이 TS 공급 대안을 기각하는 근거) · [ADR-156 엔진 CSS parity 차등 oracle](completed/156-engine-css-parity-alignment-margin.md) (판정 수단) · [Chromium 대조 정본](../explanation/research/CHROMIUM_CANVAS_PARITY_2026-10.md) §0-2 행 7 · §7-0 행 4 · §7-2 F4 · U3

## Context

**Domain**: D3 (시각 스타일) — 같은 catalog 값 (row flex 컨테이너 안 definite 폭 · 자식 보유 item) 에서 Canvas (엔진) 와 Preview (Chrome) 가 같은 상자를 내야 하는 대칭 문제. D1 · D2 변경 없음. **Generator 선언** (adr-writing.md 반복 패턴 #2): spec / CSS Generator 확장이 아니다. 변경 채널은 엔진 (`packages/engine/src/tree.rs`) 하나이고 `styleOf` · `NodeStyle` · 생성 CSS 는 불변이다.

### 문제 — Blink 는 content 제안을 재고, 엔진은 definite row 컨테이너 item 에서 생략한다

css-flexbox-1 §4.5 automatic minimum size 는 non-scrollable · `min-width: auto` item 의 자동 최소를 `min(specified size suggestion, content size suggestion)` 으로 정한다. Blink `FlexLayoutAlgorithm::ConstructAndAppendFlexItems` (`third_party/blink/renderer/core/layout/flex/flex_layout_algorithm.cc:1061-1168`, SHA 33688427) 는 `ShouldApplyAutoMinSize` (`:423-452` — 스크롤 컨테이너 아님 · min auto · size containment 아님) 인 모든 item 에 `specified_size_suggestion` (`:1062-1083`) 과 `content_size_suggestion` (`:1085-1158`) 을 구해 `min` (`:1161-1162`) 을 쓰고, **item 이 그 아래로 줄어들 수 없을 때만** content 측정을 생략한다 (`:1104-1140`).

엔진은 두 자리에서 다르다:

1. **커널** `packages/engine/src/flex.rs:360-406` `auto_min_main_from_parts` — definite 주축 item 은 **정확 스칼라 (슬롯 19 `content_min_main`) 가 있을 때만** `min(specified, content)` 를 적용하고 (`:385-399`), 스칼라가 없으면 floor 없이 돌아간다 (`:392`). 그 이유는 맞다 — definite item 의 `content_main` (슬롯 13) 은 자식 solve 가 돌려준 **자기 solved 크기** 라 content 제안이 아니다 (ADR-204 Phase 1 §1-1, golden `flex_column_shrink` · `width_definite_item_keeps_free_shrink` `flex.rs:2174`).
2. **writer** `packages/engine/src/tree.rs:3146-3156` (`solve_flex` 2-b) — row 컨테이너 item 의 intrinsic 을 실측으로 바꾸는 루프가 `data[off + 1] != -1.0` (주축 명시) 이면 `continue` 한다. 주석 그대로: 「ADR-204 Phase 1 은 row definite 컨테이너의 content min-content 측정 (자기 폭을 비운 가상 solve 2회) 을 시도했으나 shrink 행에서 방문 수가 2N→4N 으로 늘어 ADR-188 G0 기준선을 깬다 — 별도 perf 판정으로 이연」.

따라서 **row flex 안의 definite 폭 · 자식 보유 · non-scrollable item** (텍스트를 가진 고정 폭 Button · 자식을 가진 고정 폭 Frame) 은 슬롯 19 가 0 이라 자동 최소가 0 이고, 행이 좁으면 min-content 아래로 줄어든다. 정본 F4 fixture: `width: 200` row > `div{width:200px}` ×2 (각 min-content 150) → **Blink 150/150 (넘침) / 엔진 100/100**. 같은 축의 column 쪽은 ADR-204 Phase 1 2-c (`tree.rs:3202-3241`) 가 이미 닫았다 — 가상 solve 없이 자식 layout 의 max bottom 을 읽을 수 있어서다. row 는 그 길이 없다.

### 왜 미뤘는가 — 비용은 진짜였다 (ADR-204 Phase 1 evidence §1-2 · Phase 4 판정)

row 축의 컨테이너 intrinsic 은 `measure_intrinsic_width` (`tree.rs:1687-1735`) 가 **센티넬 available 로 가상 solve 2회** 를 돌려 얻는다. definite 폭 컨테이너에 쓰려면 자기 폭을 auto 로 두고 재야 하는데, 캐시 슬롯 `intrinsic_w: Option<(mutation_gen, min, max)>` (`:533-544`) 는 「자기 폭 포함」 의미라 grid `col_contribution` (`:1419`) 과 충돌한다 (앞뒤로 비워야 함). 그리고 캐시 키가 **전역 `mutation_gen`** (`:752 · :852 · :898 · :907` — 모든 mutation 에 +1) 이라 편집마다 clean 서브트리도 다시 잰다. ADR-188 G0 fixture (`tree.rs:11669-11722` — root row 5000 > clean 컨테이너 5000 + dirty leaf 1 → **행이 1px shrink** · clean 컨테이너는 definite 폭 · N−2 자식) 에서 방문 수 `2N` 단언 (`:11714 expected_visits = node_count * 2`) 이 `4N` (N=50: 198 vs 100) 으로 깨졌다. ADR-204 Phase 4 는 「보호된 perf 기준선을 실행자 판단으로 바꾸지 않는다 · 4N 은 편집마다 드는 증분 비용이고 ADR-188 이 보호하는 모양 (큰 clean 서브트리 + dirty leaf 1) 그 자체다 · **재개 경로는 기준선 갱신이 아니라 서브트리 세대 캐시 (자기 폭 제외 의미의 별도 슬롯) 위에 writer 를 다시 여는 것**」 으로 닫았다. first nail (QWE 6 페이지 63 노드): row 라인 2 · shrink 0 · 후보 0.

### 그 뒤 바뀐 것 — 재판정 수단이 생겼고, 아직 엔진을 보지 못한다

- **ADR-246 ratchet** (2026-09-27 Implemented · pre-push) — seed `60` · `600` · `600:nested-flex` · `60:app-pages` 의 조작 class (`edit` · `select` · `zoom` · `pan` · `page-switch` …) 에서 결정적 카운트 (등급 A = 2회 동일) 를 상한으로 판정하고, 상한은 `--update` 로 내려가기만 하며 올리기는 `--raise` (승인자 · 사유 · 만료일) 뿐이다 (`apps/builder/perf/ratchet.json` — `raises[]`). **그러나 ratchet 은 엔진 안을 보지 못한다**: layout 관련 키는 `layoutVersionDelta` 하나이고, `--call-counts` 는 CDP precise coverage 라 JS 함수만 센다 (wasm 함수는 없다). 엔진의 방문 카운터 `skip_walk_visits` (`tree.rs:627`) 는 테스트 전용 `Cell` 이고 `wasm.rs` (`:52-252` — `compute_layout` · `get_layouts_batch` · `enable_layout_trace` …) 에 카운터 export 가 없다. 「ratchet 카운트로 재판정」 하려면 **엔진 카운트를 ratchet 이 읽을 수 있게 하는 것이 선행** 이다.
- **서브트리 dirty 요약** `subtree_dirty` (`tree.rs:507` · 전파 `:868` · `mark_subtree_dirty` `:1546-1559`) 가 있다 — ADR-188 이 이름 붙인 요약 계열. Phase 4 판정이 요구한 「서브트리 세대」 키를 그 위에 둘 수 있다.
- **실사용 형태 fixture** `app-pages` (22 페이지, `apps/builder/scripts/perfAppFixture.mjs` — ADR-266) 와 팔레트 64 트리 (210 노드, ADR-204 Phase 0) 가 reach 계수에 쓸 수 있다. 종전 first nail 은 사용자 문서 하나 (63 노드) 였다.
- ADR-204 G0 fixture (`adr204MinContentFloorFirstNail`) 는 저장소에 **없다** — 옛 pipeline leg 와 함께 2026-10-05 삭제. 「row definite 80」 행은 지금 live fixture 가 없다 (Phase 0 에서 ADR-156 oracle 형식으로 다시 만든다).

### Hard constraints

- **HC1 정합**: ADR-156 차등 oracle (browser vitest `autoMin.browser.test.ts` 계열) — row definite 컨테이너 item fixture 의 엔진 폭 ↔ Chrome `getBoundingClientRect` 차 ≤ 1 px. 정본 F4 케이스 (Blink 150/150) 포함.
- **HC2 허용치 사후 완화 금지**: (a) ADR-188 G0 `visits == 2N` 단언 (`tree.rs:11714`) 을 바꾸지 않는다. (b) ADR-246 ratchet 의 기존 등급 A 상한 변동 0, 이 ADR 이 새로 올리는 엔진 카운트의 상한은 **Phase 0 값으로 고정** 하고 등급 A 로 등록하며 (`--add-keys` — 0 포함. `--update` 는 새 키를 B 로 넣어 초과가 경고에 그친다), Phase 1 커밋이 그 위로 가면 커밋이 아니라 설계를 고친다. `--raise` 는 이 ADR 범위에서 쓰지 않는다.
- **HC3 회귀 0**: cargo 스위트 전량 · browser parity 전량 (`autoMin` · `flexSweep` · `basicAxis*` 2,702 · `containerIntrinsic` · `adr248Catalog*`) PASS. `width_definite_item_keeps_free_shrink` (스칼라 부재 definite item 은 자유 shrink) 와 column golden `flex_column_shrink` 유지 — floor 는 **실측값에서만** 나온다.
- **HC4 측정 경계** (ADR-169 · `layout-engine.md` §TS 잔존 계약): TS 가 컨테이너 min-content 를 공급하지 않는다. `styleOf` · `NodeStyle` · `layoutTypes.ts` 변경 0.
- **HC5 산출물**: 엔진 변경은 `pnpm wasm:build:engine` (gitignored). ratchet 의 engine 변경 push 는 wasm 신선도 확인을 거친다 (ADR-246 R6). Builder initial gzip ≤ 1,421,000 B (ADR-201 재승인 값 — 카운터 export 는 wasm 쪽이라 initial 번들 무관, 크기 변화량만 기록).

## Alternatives Considered

### 대안 A — 서브트리 세대 캐시 (자기 폭 제외 슬롯) + 커널 결과 기반 지연 floor (ADR-204 Phase 4 가 이름 붙인 재개 경로)

- 설명: `TreeNode` 에 `intrinsic_content_w: Option<(subtree_gen, min, max)>` 슬롯을 더한다 — 의미는 「자기 폭을 auto 로 둔 content min/max-content」 (기존 `intrinsic_w` 의 「자기 폭 포함」 과 분리, grid `col_contribution` 충돌 없음). 키는 전역 `mutation_gen` 이 아니라 **그 서브트리 안에서 마지막으로 mutation 이 난 세대** (`propagate_dirty` 의 mutation 진입점에서 조상 체인 전체에 기록 — 측정 pass 가 부르는 `mark_subtree_dirty` 에서는 기록하지 않는다). 측정은 자기 `width` 를 helper 가 직접 저장 · 비움 · 복원한다 (`with_measure_pass` 의 snapshot 은 `NodeStyle` 을 담지 않는다 — 선례 `measure_intrinsic_height`). 판정은 **auto minimum 이 결과를 바꿀 수 있는 item 만** 잰다: auto min = `min(specified, content)` ≤ specified 이므로, floor 없이 푼 커널 결과 main 이 그 item 의 specified size suggestion (px `width`) 이상이면 floor 는 결과를 바꿀 수 없다. 결과가 그 아래인 non-scrollable · min auto item 만 재고 커널을 다시 돌리며, floor 로 여유가 형제에 넘어가면 형제도 같은 판정을 받는다 (item 마다 한 번 · 단조). 행 전체 shrink 여부나 `flex-shrink` 값은 기준이 아니다 — `flex-basis: 0` 의 hypothetical clamp (§9.2) 도 auto min 을 소비한다. clean 서브트리는 HIT → 방문 0, 내용이 바뀐 서브트리만 2n 재측정.
- 근거: Blink 도 content 제안을 **결과에 영향이 없을 item 이면 생략** 하고 (`:1104-1140`), 측정값은 `MinMaxSizes` 캐시 (layout result) 로 재사용한다 — 「변하지 않은 서브트리는 다시 재지 않는다」 가 같은 형태다. ADR-188 G0 fixture 는 clean 컨테이너가 바뀌지 않으므로 HIT → `2N` 유지.
- 위험: 기술 **MEDIUM** (두 캐시 슬롯이 다른 의미 · 서브트리 세대의 stale HIT 는 「부모는 맞고 자손만 틀림」 서명 — ADR-183 #5 trace `IntrinsicMeasure hit` 로 판별 가능) / 성능 LOW~MEDIUM (내용이 바뀐 서브트리의 첫 편집에 +2n — 정당한 비용, 상한은 Phase 0 값) / 유지보수 MEDIUM (슬롯 · 세대 두 개) / 마이그레이션 LOW (경계 변경 0, 롤백 = 커널 호출 4곳의 지연 floor helper 를 `flex::flex_layout` 직접 호출로 되돌림).

### 대안 B — 지연 floor 만, 캐시는 전역 `mutation_gen` 그대로

- 설명: 대안 A 의 판정으로 측정을 열되 캐시 키는 바꾸지 않는다.
- 위험: 기술 LOW / 성능 **HIGH** (ADR-188 G0 fixture 가 바로 shrink 행이라 편집마다 clean 컨테이너를 다시 잰다 → 4N — ADR-204 Phase 1 이 실측한 그 상태, HC2 위반) / 유지보수 LOW / 마이그레이션 LOW.

### 대안 C — ADR-188 기준선을 4N 으로 갱신

- 설명: 측정을 열고 단언을 `4N` 으로 바꾼다 (ADR-204 Phase 1 의 첫 경로).
- 위험: 기술 LOW / 성능 **HIGH** (편집마다 clean 서브트리 2N 추가 — ADR-188 이 보호하는 모양 자체) / 유지보수 LOW / 마이그레이션 **HIGH** (보호된 기준선을 실행자 판단으로 완화 — 사용자 지시 「허용치 사후 완화 금지」 와 정면 충돌).

### 대안 D — TS (`styleOf`) 가 컨테이너 min-content 스칼라를 공급

- 설명: TS 가 자식 측정값을 집계해 `contentMinWidth` 를 컨테이너에도 싣는다 (슬롯 19 가 채워져 커널 절이 바로 동작).
- 위험: 기술 MEDIUM / 성능 LOW / 유지보수 **HIGH** (ADR-169 경계 「폰트 측정은 TS · 구조 집계는 엔진」 위반 — 컨테이너 intrinsic 은 자식 값의 집계라 TS 공급은 레이아웃 재구현, `layout-engine.md` §TS 잔존 계약이 금지) / 마이그레이션 MEDIUM (TS · Rust 두 곳이 같은 값을 계산 → 어긋나면 Compare Mode 발산 재생산).

### 대안 E — 이연 유지 (정본 F4 = `deferred`)

- 설명: 2-b `continue` 를 둔다. 재개 조건 「실제 문서에서 격차 보고」 를 기다린다.
- 위험: 기술 LOW / 성능 LOW / 유지보수 LOW / 마이그레이션 LOW — 다만 좁은 row 의 고정 폭 Button · Frame 이 Preview 와 다르게 줄어드는 D3 발산이 남고, 사용자 요청 (복원) 과 어긋난다. **Phase 0 에서 reach 0 이고 비용 > 0 으로 판정되면 이 대안이 종결 경로** 다 (G0 no-go).

### Risk Threshold Check

| 대안 | HIGH+                    | 판정                                                              |
| ---- | ------------------------ | ----------------------------------------------------------------- |
| A    | 없음 (기술 MEDIUM 1)     | 통과                                                              |
| B    | 성능 HIGH                | 제외 — HC2 위반이 실측으로 확정돼 있음                            |
| C    | 성능 · 마이그레이션 HIGH | 제외 — 사용자 지시와 충돌                                         |
| D    | 유지보수 HIGH            | 제외 — ADR-169 경계                                               |
| E    | 없음                     | 통과 — 사용자 요청과 어긋나 기본 선택 아님, G0 no-go 의 종결 경로 |

HIGH 가 없는 대안이 둘 (A · E) 이라 새 대안 추가 루프는 필요 없다.

## Decision

**대안 A.** definite row 컨테이너 item 의 §4.5 content size suggestion 을 **서브트리 세대 캐시 (자기 폭 제외 슬롯) 위에서 · floor 가 결과를 바꿀 수 있는 item 에만** (floor 없는 커널 결과 < specified size suggestion) 복원한다. 재판정의 수단은 두 겹이다 — (1) ADR-188 G0 `2N` 단언 (cargo) 불변, (2) ADR-246 ratchet 에 **엔진 결정적 카운트 2종** (`engine.solveVisits` — `solve_node` 진입 수 · `engine.intrinsicMeasureMiss` — intrinsic 측정 MISS 수, 두 측정 함수 합) 을 wasm export 로 올려 seed 4 의 등록 class 전부에 **등급 A (0 포함) 로 `--add-keys` 등록** 해 상한을 Phase 0 값으로 고정하고 Phase 1 커밋이 그 위로 가지 않는 것. 둘 다 통과하고 HC1 fixture 가 ≤ 1 px 이면 Implemented. ratchet 상한을 넘으면 캐시 설계를 고치고, 그래도 안 들어가면 **대안 E 로 Deferred 종결** (상한은 올리지 않는다 — HC2).

- 위험 수용 근거: A 의 유일한 MEDIUM 은 서브트리 세대의 stale HIT 다. 세대 기록 지점이 mutation 진입점 (`propagate_dirty` · `remove_node` · 재부모화) 의 조기 종료 없는 조상 walk 한 종류이고, 기존 trace (`IntrinsicMeasure { hit, generation }`) 가 HIT/MISS 를 그대로 보여 준다. G1 이 「자손 편집 뒤 floor 가 따라오는가」 fixture 와 원복 RED (세대 키 → 전역 키로 되돌리면 ADR-188 fixture 4N RED) 로 집행한다.
- B 기각: ADR-204 Phase 1 이 실측한 4N 상태 그대로 — HC2.
- C 기각: 사용자 지시 「허용치 사후 완화 금지」 와 ADR-204 Phase 4 판정 둘 다 반대.
- D 기각: ADR-169 경계 위반 · TS/Rust 이중 계산.
- E 는 기각이 아니라 **G0 no-go 의 종결 경로** 로 둔다 — reach 가 0 인데 비용이 등급 A 에서 0 이 아니면 정합 가치가 비용을 정당화하지 못한다.

### 사용자 결정 2건

execute-adr 가 해당 항목에 닿을 때 묻는다 — 지금 질문하지 않는다.

1. **엔진 카운트 ratchet 편입의 커밋 시점**: 범위는 정해져 있다 — `--add-keys` 는 그 seed 의 등록 class 전부에 넣는다 (`perf-ratchet-gate.mjs` `applyAddKeys` 가 `run.classes` 를 돈다 · Round 1 H3 — 종전 「edit · select 한정」 선택지는 지원 방식이 아니라 뺐다. 엔진이 안 도는 class 는 A = 0 이 되어 오히려 더 좁은 상한이다). 편입은 recorder 변경 (`perf-baseline.mjs`) 이라 `recorderSha256` 이 바뀌고 ratchet 이 「기준 재설정 필요」 를 낸다 (ADR-246 R5) — 기존 키의 값은 바뀌지 않으므로 재설정은 새 키 추가로 끝난다. 다른 세션의 push 와 겹치면 그 세션의 ratchet 결과가 「재설정 필요」 로 뜬다 — 커밋 시점을 사용자가 고른다.
2. **reach 0 일 때의 진행**: Phase 0 계수 (app-pages 22 페이지 · 팔레트 64 트리 · 사용자 문서) 가 「floor 없는 커널 결과가 specified 아래인 row 안 definite 폭 · 자식 보유 · non-scrollable item」 0 이면 — (a) 비용이 등급 A 변동 0 이면 정합 가치로 진행 (권고), (b) 비용 > 0 이면 대안 E 로 Deferred 종결, (c) 비용과 무관하게 진행. 권고 (a)/(b) 규칙.

> 구현 상세: [268-flex-row-definite-content-size-suggestion-breakdown.md](design/268-flex-row-definite-content-size-suggestion-breakdown.md)

## Risks

| ID  | 위험                                                                                                                                    | 심각도 | 대응                                                                                                                                                                                                                                                            |
| --- | --------------------------------------------------------------------------------------------------------------------------------------- | :----: | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| R1  | 서브트리 세대의 stale HIT — 자손이 바뀌었는데 옛 min-content 가 floor 로 소비됨 (ADR-183 #5 「부모는 맞고 자손만 틀림」 서명)           |  MED   | 세대 기록은 mutation 진입점의 조기 종료 없는 조상 walk (측정 pass 의 `mark_subtree_dirty` 는 기록 안 함) · G1 fixture 「자손 텍스트 길이 변경 → floor 갱신」 · trace `IntrinsicMeasure hit/generation` 으로 판별 · 원복 RED (전역 키로 되돌리면 ADR-188 4N RED) |
| R2  | 새 엔진 카운트가 등급 B (비결정) 로 나옴 — ratchet 등급 A 편입 불가                                                                     |  MED   | Phase 0 에서 같은 seed · `--fixed-inputs` 2회 동일성 확인. 등급 A 가 아니면 ratchet 편입 대신 ADR-188 `2N` 단언 + Rust 단위 카운트 (`skip_walk_visits` 류) 로만 판정하고 그 사실을 기록 — HC2 (b) 축소를 본문에 적는다                                          |
| R3  | recorder 변경으로 ratchet 「기준 재설정 필요」 — 병렬 세션의 push 가 그 사이 걸림                                                       |  LOW   | 사용자 결정 1 (커밋 시점) · 기존 키 값 불변이라 재설정은 새 키 추가만                                                                                                                                                                                           |
| R4  | reach 0 — 격차를 보이는 fixture 가 합성 (정본 F4) 뿐                                                                                    |  MED   | oracle 이 Chrome 자체라 합성 fixture 도 외부 ground truth 다 (measurement-validity Q5). reach 는 Q1 (대표성) 에 쓰고 비용 판정 (사용자 결정 2) 의 입력으로만 — 「미관측 = dead」 로 읽지 않는다                                                                 |
| R5  | 2-b 가 열리면 grid 서브트리 (`measure_intrinsic_width` → `None`) · intrinsic 키워드 폭 (`fit-content` 등) 경로와 얽힘                   |  LOW   | definite **px** 폭만 연다 — 키워드 폭은 현행 분기 (`tree.rs:3168-3187`) 그대로 · grid `None` 은 종전처럼 `continue`                                                                                                                                             |
| R6  | 문서 stale — `tree.rs:3149-3153` 이연 주석 · ADR-204 Phase 4 로그의 「재개 조건」 · `layout-engine.md` §5 · 정본 F4 (`source-reported`) |  LOW   | Phase 1 마지막 커밋에서 같이 고침 (정본 §0-5 형식)                                                                                                                                                                                                              |

잔존 HIGH 위험 없음.

## Gates

| Gate | 시점            | 통과 조건                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                     | 실패 시 대안                                                                                             |
| ---- | --------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------- |
| G0   | Phase 0 종결    | (a) RED fixture — ADR-156 oracle 형식으로 정본 F4 케이스 (row 200 > definite 200 ×2 · 각 min-content 150) 가 Chrome 150/150 vs 엔진 100/100 으로 재현 + 판정 반례 2 (뒤에 오는 auto 형제 — Chrome 150/200 · 엔진 100/200 / 행이 안 줄어드는 `flex-basis: 0` — Chrome 150 · 엔진 0, shrink 0 · 1) · (b) 엔진 카운트 2종 wasm export + 하니스 라벨, seed 4 의 `runs.<seed>.args` 그대로 2회 · 등록 class 전부 동일 (등급 A) · `--add-keys --accept-recorder` 로 0 포함 A 등록 + `engine.*` +1 보고가 block 인 판정 테스트 · (c) reach 계수 (app-pages · 팔레트 64 · 사용자 문서) · (d) ADR-188 `2N` PASS 확인 · (e) 동작 변경 0 | (a) 재현 안 되면 정본 F4 재판정 → ADR Deprecated · (b) 등급 B 면 R2 축소 경로 · (c) 0 이면 사용자 결정 2 |
| G1   | Phase 1 각 커밋 | cargo 전량 PASS · ADR-188 `visits == 2N` 불변 · 원복 RED 1 (지연 floor helper 우회 — 커널 1회만 · floor 미기록 → G0 fixture 3종 RED / 세대 키 → 전역 키 → ADR-188 fixture 4N RED) · R1 fixture (자손 변경 뒤 floor 갱신 · 형제 변경 뒤 HIT 유지 · dirty 노드 아래 두 번 편집 · 재부모화) · 측정 뒤 `style.width` · `intrinsic_w` · 조상 `subtree_gen` 불변 · G0 판정 반례 2 의 Rust 단위 GREEN                                                                                                                                                                                                                                | 틀린 축만 수리, 한 커밋에 하나                                                                           |
| G2   | Phase 1 종결    | ADR-246 ratchet seed 4 의 등록 class 전부 — 기존 등급 A 변동 0 · 새 엔진 카운트 ≤ Phase 0 등급 A 상한 · `--raise` 0 · browser parity 전량 PASS (HC3) · G0 fixture 3종 ≤ 1 px                                                                                                                                                                                                                                                                                                                                                                                                                                                  | 캐시 설계 수정 후 재측정 · 그래도 초과면 대안 E 로 Deferred 종결 (상한 불변)                             |
| G3   | Phase 1 종결    | live 1회 (Chrome MCP) — row frame 폭 200 안에 `width: 200` Button 둘 (라벨 min-content > 100) → Compare Mode 에서 Canvas 폭 = Preview 폭 (≤ 1 px) · 라벨을 길게 바꾼 뒤 (자손 편집) 도 같음                                                                                                                                                                                                                                                                                                                                                                                                                                   | 사용자 confirm 대체 불가 — 미통과면 Implemented 승격 보류                                                |
| G4   | 종결            | 정본 F4 `source-reported` → `gate-passed` · `tree.rs` 이연 주석 · `layout-engine.md` §5 · ADR-204 Phase 4 이연 항목에 「ADR-268 로 닫힘」 표기 · README · CHANGELOG                                                                                                                                                                                                                                                                                                                                                                                                                                                           | 문서만 — 승격 전 마무리                                                                                  |

집행 수단은 cargo (`packages/engine`) · browser vitest (`pnpm -F @composition/builder test:parity`) · pre-push ratchet (`pnpm gate:perf-ratchet`) · 로컬 Chrome MCP live — 모두 `push: main` 과 양립한다.

### Live Exercise

(Implemented 승격 시 기재 — G3 의 Compare Mode 시나리오 · 결과 · 날짜 · Chrome MCP / 사용자 confirm 구분.)

## Consequences

### Positive

- 좁은 row 안의 고정 폭 Button · Frame 이 Canvas 와 Preview 에서 같은 폭으로 멈춘다 — ADR-204 가 「G0 row definite 80 (writer 이연)」 으로 남긴 D3 발산이 닫힌다.
- §4.5 의 row · column 양축이 엔진 한 곳에서 같은 절 (`min(specified, content)`) 로 동작한다 — TS 보정 재도입 없음 (ADR-164 · 169 방향 유지).
- ratchet 이 처음으로 **엔진 안의 결정적 카운트** 를 본다 — 이후 엔진 성능 작업 (ADR-269 property node · 정본 O1) 의 판정 수단이 하나 늘어난다.
- 서브트리 세대 캐시는 ADR-188 R6 가 Phase 1 범위로 적어 둔 「O(1) 요약」 계열의 첫 소비자다.

### Negative

- `TreeNode` 에 슬롯 하나 (`intrinsic_content_w`) 와 세대 필드가 늘어 캐시 의미가 둘이 된다 — 둘을 혼용하면 grid 기여가 틀어진다 (R5 · 주석으로 고정).
- 내용이 바뀐 definite 컨테이너의 첫 편집은 가상 solve 2회 (+2n) 를 더 낸다 — Phase 0 상한 안에서만 허용.
- recorder 변경으로 ratchet 기준 재설정이 한 번 필요하다 (사용자 결정 1).
- reach 가 0 으로 나오면 이 ADR 의 가치는 빈도가 아니라 D3 대칭의 완결과 ratchet 의 엔진 가시성이다 — 그 경우에도 사용자 결정 2 가 진행 여부를 가른다.
