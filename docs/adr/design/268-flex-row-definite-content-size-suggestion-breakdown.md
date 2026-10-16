# ADR-268 design breakdown — flex row definite item 의 min-content 측정 복원

> 본문: [ADR-268](../268-flex-row-definite-content-size-suggestion.md). 이 문서는 구현 상세 (phase · 파일 · 체크리스트 · fixture) 와 Phase 0 inventory 의 결론을 둔다. 수치는 측정 뒤 여기에 적는다 — 본문에는 옮기지 않는다.

## 1. 전제 lock-in

- 분리 아님 — 새 ADR 하나. base/응용 · schema 직교성 질문은 해당 없음. ADR-204 의 「row definite 는 이연」 전제를 **그대로 승계하지 않고** 재판정한다 — 단 ADR-204 Phase 4 가 명시한 재개 경로 (서브트리 세대 캐시 · 기준선 갱신 아님) 는 그대로 따른다.
- 허용치 사후 완화 금지: ADR-188 G0 `visits == 2N` (`packages/engine/src/tree.rs:11714`) · ADR-246 ratchet 기존 상한 · 새 엔진 카운트의 Phase 0 상한. 셋 다 이 ADR 이 올리지 않는다.
- oracle: Chrome `getBoundingClientRect` (ADR-156 차등 oracle, `apps/builder/tests/parity/*.browser.test.ts` `runParityCase`) · Compare Mode (live). Blink 코드는 지도.
- 한 격차 = 한 커밋 = 원복 RED 1 + cross-check (또는 live) 1 (정본 §0-2).
- 측정 경계 (ADR-169): TS 변경 0 — `styleOf` · `NodeStyle` · `layoutTypes.ts` 손대지 않는다.

## 2. Phase 0 — inventory · RED · 카운트 (동작 변경 0)

- [ ] **RED fixture**: `apps/builder/tests/parity/autoMin.browser.test.ts` 에 F4 케이스 추가 — `(f) row 200 > div{width:200px; min-content 150} ×2` (자식 보유 컨테이너 item — 텍스트 leaf 스칼라 `contentMinWidth: 150` 를 가진 자식 1 로 min-content 150 을 만든다) · 대조군 `(f-auto)` 같은 자식 · 폭 auto (현행 정합) · `(f-scroll)` 같은 item · `overflow: auto` (floor 0 현행 정합). 기대 = Chrome: (f) 150/150 (넘침) · 엔진 현재 100/100 → RED 기록.
- [ ] **엔진 카운트 export**: `tree.rs` 에 `solve_visits: Cell<usize>` (`solve_node` 진입 — `:1830`) · `intrinsic_measure_miss: Cell<usize>` (`measure_intrinsic_width` MISS 분기 — `:1718` 근처) 추가. `wasm.rs` 에 `get_counters() -> Box<[u32]>` · `reset_counters()` export. TS 바인딩 (`wasm-bindings/layoutBridge.ts` · `engine.ts`) 이 읽어 `__composition_LAYOUT_DEBUG__` (정의: `apps/builder/src/builder/workspace/canvas/skia/useSkiaNode.ts`) 에 `getEngineCounters()` 로 노출. `apps/builder/scripts/perf-baseline.mjs` (`:1849-1871` 결정적 카운트 기록 자리) 가 조작 전후 차를 `perfLabels` 옆 `engine.solveVisits` · `engine.intrinsicMeasureMiss` 로 기록. 기존 `skip_walk_visits` (`:627`) 는 그대로 (테스트 전용).
- [ ] **등급 판정**: `pnpm perf:baseline -- --lane frame --fixed-inputs --seed 60|600|600:nested-flex|60:app-pages --classes edit,select` 2회 → 두 카운트가 정확히 같으면 등급 A. 다르면 R2 축소 경로 (ratchet 편입 없이 ADR-188 단언 + Rust 단위 카운트로만) 를 본문 Status 에 적는다.
- [ ] **ratchet 상한 기록**: `node apps/builder/scripts/perf-ratchet-gate.mjs --update <seed>=<frame.json>` — 새 키만 추가 (기존 키 값 불변 확인). `recorderSha256` 변경 → `recorderChanges` 항목에 사유 「ADR-268 Phase 0 엔진 카운트 2종 추가」. 커밋 시점은 사용자 결정 1.
- [ ] **reach 계수**: 조건 = row 라인이 shrink (자식 hypothetical 합 > 컨테이너 content 폭) 하고 item 이 definite px 폭 · 자식 보유 · non-scrollable · min auto · flex-shrink > 0. 대상 = `app-pages` 22 페이지 (`perfAppFixture.mjs` — `row(...)` 안 `{ width: N }` 자식) · 팔레트 64 트리 (ADR-204 Phase 0 의 210 노드 스크립트 재사용) · 사용자 문서 (QWE). 결과 수를 여기 §기록 에.
- [ ] **ADR-188 G0 확인**: `cargo test adr188_g0_engine_skip_walk_baseline` PASS (2N) — 착수 전 값 고정.
- [ ] **go/no-go**: RED 재현 + (reach > 0 또는 사용자 결정 2 (a)) 면 go.

## 3. Phase 1 — 대안 A

순서는 캐시 → writer → 문서. 각 단계가 한 커밋, 각 커밋에 원복 RED 1. 엔진 커밋마다 `pnpm wasm:build:engine` 뒤 parity.

### 1-a 서브트리 세대 캐시 (자기 폭 제외 슬롯) — 동작 변경 0

- `tree.rs` `TreeNode` — `intrinsic_content_w: Option<(u64, f32, f32)>` 추가 (의미: 자기 `width` 를 auto 로 둔 content min/max-content, content-box). 기존 `intrinsic_w` (`:544`, 자기 폭 포함 — grid `col_contribution` `:1419` 소비) 는 그대로.
- `subtree_gen: u64` 추가 — `mark_subtree_dirty` (`:1546-1559`) 와 `:868` 전파 지점에서 조상 체인에 `self.mutation_gen` 을 기록. 자기 서브트리 밖의 mutation 은 이 값을 바꾸지 않는다.
- `measure_intrinsic_content_width(handle)` — `measure_intrinsic_width` (`:1687`) 와 같은 `with_measure_pass` 가상 solve 2회이되 자기 `width` 를 임시 auto 로 두고 재며 (snapshot/restore 는 `with_measure_pass` 가 담당), 캐시 키 = `subtree_gen`. HIT 면 방문 0.
- Rust 단위: `intrinsic_content_cache_hits_when_sibling_changes` (형제 편집 → HIT) · `intrinsic_content_cache_misses_when_descendant_changes` (자손 편집 → MISS · 새 값) · grid `None` 유지.
- 원복 RED (1-b 뒤 유효): 키를 `mutation_gen` 으로 되돌리면 ADR-188 fixture 4N RED.

### 1-b writer — 2-b 의 `continue` 를 조건부로

- `tree.rs:3146-3156` — `data[off + 1] != -1.0` 분기를 다음으로 교체: definite **px** 폭 · 자식 보유 · `content_min_width.is_none()` · non-scrollable (`off 18 == 0`) · min auto (`off 9 == -1`) · flex-shrink > 0 · **행이 shrink** (pre-scan: Σ(hypothetical main + margin) + gap > 컨테이너 content main — 1) 단계 solve 결과 `child_sizes` 로 계산) 일 때만 `measure_intrinsic_content_width` 를 호출해 `data[off + 19] = min_w` (0 이면 종전 규칙대로 `off 9 = 0`). intrinsic 키워드 폭 분기 (`:3168-3187`) 는 그대로. 그 외는 종전처럼 `continue`.
- 커널 `flex.rs:360-406` 변경 없음 — 슬롯 19 가 채워지면 `SpecifiedSizeMin` 절이 이미 동작한다. 주석 (`:380-386`) 의 「컨테이너 … ADR-204 Phase 1/2」 를 「row definite 컨테이너 = ADR-268」 로.
- Rust 단위: 정본 F4 (200 > 200×2 · min-content 150 → 150/150) · shrink 아닌 행 (측정 0 — 카운트 단언) · `flex-shrink: 0` item (측정 0) · `width_definite_item_keeps_free_shrink` 불변.
- cargo: `adr188_g0_engine_skip_walk_baseline` 2N PASS (clean 컨테이너 HIT).
- browser: Phase 0 (f) 케이스 GREEN · (f-auto) · (f-scroll) 불변 · `autoMin` · `flexSweep` · `basicAxis*` · `containerIntrinsic` 전량.
- 원복 RED: `continue` 복원 → (f) RED.

### 1-c ratchet · live

- `pnpm gate:perf-ratchet` (또는 `perf-ratchet-run.mjs`) — seed 4 × `edit` · `select`: 기존 등급 A 변동 0 · `engine.solveVisits` · `engine.intrinsicMeasureMiss` ≤ Phase 0 상한. 초과면 1-a 의 세대 기록 범위 (조상 체인 길이 · HIT 조건) 를 고치고 재측정 — 상한은 두지 않는다. 그래도 초과면 본문 Decision 의 Deferred 경로.
- live (Chrome MCP · G3): row frame 200 > `width: 200` Button 둘 (라벨 길게) → Compare Mode Canvas 폭 = Preview 폭 · 라벨 편집 뒤 (자손 변경) 도 같음. 결과 → 본문 `### Live Exercise`.

### 1-d 문서 · 상태

- `tree.rs:3149-3153` 이연 주석 → 「ADR-268 — shrink 행 · 줄어들 수 있는 item 만 서브트리 세대 캐시로 측정」.
- `.claude/rules/layout-engine.md` §엔진 CSS 정합 규칙 색인 행 5 (§4.5) · 행 6 (측정 캐시 — 「캐시 키는 `mutation_gen`」 에 content 슬롯의 `subtree_gen` 병기).
- ADR-204 (`completed/204-*.md`) Status 진행 로그의 「이연 확정 1」 에 「→ ADR-268 (날짜) 로 닫힘」 한 줄 (본문 결정은 바꾸지 않는다).
- 정본 `CHROMIUM_CANVAS_PARITY_2026-10.md` F4 (§0-2 행 7 · §7-0 표 행 4 · §7-2) — `source-reported` → `gate-passed`, ratchet 엔진 카운트를 §11-3 성능 에 한 줄.
- `docs/adr/README.md` · CHANGELOG (사용자-가시: 좁은 row 의 고정 폭 Button · Frame 폭이 Preview 와 같아짐).

## 4. Phase 2 — 종결

- [ ] G2 · G3 통과 → Implemented 승격 (`### Live Exercise` 기재) · README 완료 표 이동 · `docs/adr/reviews/268.md` (리뷰가 있었으면) pending 0 확인.
- [ ] 메모리 `project-blink-layout-delta-2026-10` 의 F4 줄 갱신.

## 5. 파일 변경표 (추정 — Phase 0 에서 확정)

| 파일                                                                | 변경                                                                          | Phase   |
| ------------------------------------------------------------------- | ----------------------------------------------------------------------------- | ------- |
| `packages/engine/src/tree.rs`                                       | 카운터 2 · `intrinsic_content_w` · `subtree_gen` · `measure_intrinsic_content_width` · 2-b 조건 · 단위 테스트 | 0 · 1-a · 1-b |
| `packages/engine/src/wasm.rs`                                       | `get_counters` · `reset_counters` export                                      | 0       |
| `packages/engine/src/flex.rs`                                       | 주석만 (`:380-386`)                                                           | 1-b     |
| `apps/builder/src/builder/workspace/canvas/wasm-bindings/layoutBridge.ts` · `engine.ts` | 카운터 읽기                                                                   | 0       |
| `apps/builder/src/builder/workspace/canvas/skia/useSkiaNode.ts`     | `__composition_LAYOUT_DEBUG__.getEngineCounters`                              | 0       |
| `apps/builder/scripts/perf-baseline.mjs`                            | 결정적 카운트에 `engine.*` 2 키                                                | 0       |
| `apps/builder/perf/ratchet.json`                                    | 새 키 상한 · `recorderChanges` 1                                              | 0       |
| `apps/builder/tests/parity/autoMin.browser.test.ts`                 | (f) · (f-auto) · (f-scroll)                                                   | 0       |
| `.claude/rules/layout-engine.md` · 정본 · ADR-204 로그 · README · CHANGELOG | 문서                                                                          | 1-d · 2 |

추정 9 파일 (문서 제외). TS 변경은 카운터 읽기만 — 레이아웃 입력 (`styleOf`) 변경 0.

## 기록

(Phase 0 의 수치 — RED 값 · 등급 판정 2회 값 · ratchet 상한 · reach 계수 · ADR-188 2N 확인 — 를 날짜와 함께 여기에 적는다.)
