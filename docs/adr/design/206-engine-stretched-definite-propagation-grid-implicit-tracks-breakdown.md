# ADR-206 design breakdown — 엔진 늘어난 크기 definite 전파 + grid 암묵 트랙 준수

> 본 문서가 구현 상세의 정본이다. ADR 본문은 결정·위험·게이트만 둔다.
> 상태: **Proposed (2026-09-07) — 미착수.** 근거 문서: [TAFFY_UPSTREAM_DELTA_2026-09.md](../../explanation/research/TAFFY_UPSTREAM_DELTA_2026-09.md) (§2 실측 · §4 권고). 선행 A 묶음 (③ abs clamp · ⑤ leaf aspect) 은 `0b1cecb4a` 로 완료 — 본 ADR 의 Phase 0 근거로 쓴다.

## 1. Fork 게이트 4 질문 lock-in

본 ADR 은 **완전 신규 주제**다 (기존 ADR 의 잔여 영역 분리도, base/응용 split 도 아님). 인접 ADR 과의 방향을 오해하지 않도록 lock-in 한다 (`.claude/rules/adr-writing.md` §ADR Fork).

1. **base / 응용 분류**: ADR-164 (TS 보정 흡수 — "CSS 표준 의미론의 새 gap 은 엔진 구현이 기본 경로") 와 ADR-170 (기본 축 격자 2,702 조합 0 발산) 이 base, 본 ADR 은 그 위에서 **엔진이 빠뜨린 CSS 규칙 2개** (stretch 확정 · 암묵 트랙) 를 채우는 응용이다. base 의 결정을 바꾸지 않는다.
2. **schema 직교성**: `NodeStyle` 55 필드 무변경. 새 입력 없이 기존 필드의 해석만 바뀐다 — schema 교집합 전부, specialization 없음 → 직교.
3. **선행 ADR 전제 reverse 검증**: ADR-164 의 전제 ("TS 보정 재도입 금지, 엔진 소유") 를 그대로 쓴다. 의존 방향 반전 없음 — `grep -n "재침식\|TS 보정" .claude/rules/layout-engine.md` 로 규칙이 살아 있음을 확인. ledger §백분율의 "판정은 `explicit_h > 0` 하나" 는 **규칙의 확장**이지 반전이 아니다 (CSS §10.5 인용은 유지되고 flexbox §9.8 · grid §6.6 이 추가된다).
4. **codex 3차까지 미루지 않음**: 위 1~3 을 착수 전 (2026-09-07) 에 lock-in.

**사용자 confirm 기록**: 2026-09-07 세션 — AskUserQuestion "ADR 구성" 에서 **B 만 ADR 1개, C 는 scope 밖 기록** 선택 + `/create-adr 엔진 늘어난 크기 definite 전파 + grid 암묵 트랙 준수` 직접 입력. 본문 self-lock-in 이 아니라 사용자 선택이 선행했다.

## 2. Phase 0 — 코드 사실 표 (착수 전 전수 대조용)

각 행은 사실 1줄 + 경로:라인 + 확인 명령. 행 번호는 `0b1cecb4a` 기준.

| #   | 사실                                                                                                                                                                                                                                                                                                                          | 경로:라인                                                                                               | 확인 명령                                                                                                                   |
| --- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------- |
| F1  | flex 자식 재귀 available 의 블록 축 definite 판정이 `explicit_h > 0.0` 하나 — stretch 로 확정된 cross 는 반영 안 됨                                                                                                                                                                                                           | `packages/composition-engine/src/tree.rs:2131`                                                          | `grep -n "let child_containing_h = if explicit_h > 0.0" tree.rs`                                                            |
| F2  | flex 3.5 재-solve 는 `solve_node(c, used_main, cs_h)` — **main 만** used 값, cross 는 1차 solve 의 `cs_h` 그대로                                                                                                                                                                                                              | `tree.rs:2576`                                                                                          | `grep -n "self.solve_node(c, used_main, cs_h)" tree.rs`                                                                     |
| F3  | block 도 같은 게이트 (`explicit_h > 0.0`) — 두 경로 (ctx · 재귀 available) 가 같이 막혀 있다 (ledger §백분율)                                                                                                                                                                                                                 | `tree.rs:2977`                                                                                          | `grep -n "child_containing_h = if explicit_h > 0.0 { child_avail_h }" tree.rs`                                              |
| F4  | grid 셀은 `solve_node(c, w, h)` 로 셀 크기를 **available** 로만 내린다 — 자식 안에서 `explicit_h == 0` 이라 손자 `%` 는 INDEFINITE                                                                                                                                                                                            | `tree.rs:3753`                                                                                          | `grep -n "let (cw, ch) = self.solve_node(c, w, h);" tree.rs`                                                                |
| F5  | aspect w→h 전송값은 자식 있는 상자에서 `aspect_h_floor` 에만 들어가고 `explicit_h` 는 0 유지 → 손자 `%` base 아님                                                                                                                                                                                                             | `tree.rs:1768`                                                                                          | `grep -n "aspect_h_floor = Some(transferred)" tree.rs`                                                                      |
| F6  | `block_fits` 가 `c0 + cs - 1 > cols` 면 무조건 false — 열 수를 넘는 span 은 어느 행에도 못 들어간다                                                                                                                                                                                                                           | `packages/composition-engine/src/grid.rs:754-757`                                                       | `grep -n "fn block_fits" grid.rs`                                                                                           |
| F7  | `+ 10_000` 가드가 **5곳** — 배치 루프 4곳 (`:1008/:1014/:1038/:1044`) + col-flow definite-column 용 `first_free_row` (`:788`). 전부 가드 뒤 **실패 위치를 그대로 반환** (definite-col 은 `r = cur_row + 10000`). 리뷰 round 1 에서 `:788` 추가                                                                                | `grid.rs:788` · `:1008` · `:1014` · `:1038` · `:1044`                                                   | `grep -n "10_000" grid.rs` (5건)                                                                                            |
| F8  | 트랙 부재 시 셀 폴백 `unwrap_or(100.0)` 가 **3곳** — 폭 `:682` · 높이 `:685` · column-flow 암묵 열 `:1187`. 정폭 grid 에 template 이 없으면 item 100px. 리뷰 round 1 에서 `:685` · `:1187` 추가                                                                                                                               | `grid.rs:682` · `:685` · `:1187`                                                                        | `grep -n "unwrap_or(100.0)" grid.rs` (3건)                                                                                  |
| F9  | `parse_implicit_track_size` 가 `grid-auto-columns` 의 **첫 토큰 px 만** 읽는다 (fr/%/auto/minmax/목록 → fallback)                                                                                                                                                                                                             | `grid.rs:1094-1102`                                                                                     | `grep -n "fn parse_implicit_track_size" grid.rs`                                                                            |
| F10 | 암묵 열 생성은 `grid-auto-flow: column` 분기에서만 — row-flow 에서 배치가 열을 넘어도 열이 안 는다                                                                                                                                                                                                                            | `grid.rs:1186`                                                                                          | `grep -n "if needed_cols > tracks_x.len()" grid.rs`                                                                         |
| F11 | tree.rs 의 "명시 열 없어도 암묵 열은 있다" 합성은 `inline_intrinsic` (auto 폭) 분기 **안** — 정폭이면 안 돈다                                                                                                                                                                                                                 | `tree.rs:3390`                                                                                          | `grep -n "if let Some(mode) = inline_intrinsic {" tree.rs`                                                                  |
| F12 | 기여 계산 층은 `repeat(...)` 토큰을 `SizingFn::Definite` 통째로 받아 `parse_px` 실패 → auto 축에서 content 행 1개로 접힘                                                                                                                                                                                                      | `tree.rs:4446` · `:4489`                                                                                | `grep -n "SizingFn::Definite" tree.rs`                                                                                      |
| F13 | grid-auto-rows 는 토큰 목록을 순환하며 intrinsic 기여를 받는다 — 열 쪽 (F9) 과 비대칭. 열도 같은 형태로 맞추면 된다                                                                                                                                                                                                           | `tree.rs:3468-3487` 부근 (`auto_row_tokens`)                                                            | `grep -n "auto_row_tokens" tree.rs`                                                                                         |
| F14 | catalog 6 규칙이 template 없는 `display: grid` — MeterTrack · MeterValue · ProgressBarTrack · ProgressBarValue · ProgressCircle · SliderTrack                                                                                                                                                                                 | `packages/shared/src/catalog/generated/componentRulesTable.ts:7261 · 7357 · 8543 · 8603 · 8645 · 10703` | `grep -n 'display: "grid"' componentRulesTable.ts`                                                                          |
| F15 | ledger §백분율: "판정은 `explicit_h > 0.0` **하나**다. 상속 available 은 높이를 확정하지 않는다 (CSS §10.5)" — flexbox §9.8 · grid §6.6 부재                                                                                                                                                                                  | `.claude/skills/composition-patterns/reference/layout-css-parity-ledger.md` §백분율 크기                | `grep -n "판정은" layout-css-parity-ledger.md`                                                                              |
| F16 | ADR-170 격자는 **1단 전파만** — "중첩 2단 이상" 은 사각 표에 명시. F5/B1d 는 2단 (부모 stretch → 자식 → 손자 %) 이라 격자 green 이 반증이 아니다                                                                                                                                                                              | `.claude/rules/layout-engine.md` §기본 축은 격자가 잠갔다 — 사각 표                                     | `grep -n "중첩 2단" .claude/rules/layout-engine.md`                                                                         |
| F17 | Chrome 실측 (2026-09-07): F5 inner h 0 (Chrome 100) · B1d 0 (100) · B6c 0 (75) · G4 y 100,000 (0) · G12 w 100 (400) · G10 root h 40 (80) · G11 100/100 (133/267)                                                                                                                                                              | TAFFY_UPSTREAM_DELTA_2026-09.md §2                                                                      | 문서 §6 fixture 를 `runParityCase` 로 재실행                                                                                |
| F18 | A 묶음 선행 완료: `resolve_abs_axis((min,max))` · 군집 F leaf ② — 게이트 12 (baseline 11 RED)                                                                                                                                                                                                                                 | `0b1cecb4a` · `tests/parity/absClampAspectLeaf.browser.test.ts` · ledger §24                            | `git show 0b1cecb4a --stat`                                                                                                 |
| F19 | 빌더 factory · preset 은 `height:%` 를 생성하지 않는다 (grep 0건). catalog 의 `height: "100%"` 2곳은 Meter · ProgressBar `staticSelectors[".fill"]` — Preview DOM 막대이지 canonical 노드가 아니다 (Track `children: []`, Phase 0 live). ① 의 production 입력은 사용자 Styles 패널의 `%` 높이뿐 (리뷰 round 1 → Phase 0 정정) | `componentRulesTable.ts:7058` · `:8339`                                                                 | `grep -rn 'height: "100%"' apps/builder/src/builder/factories packages/shared/src/catalog/generated/componentRulesTable.ts` |

### Phase 0 산출 — 완료 (2026-09-07, 동작 변경 0)

- [x] **F1~F19 전수 대조** — 리뷰 round 1 에서 실행: F7 5곳 · F8 3곳 · F19 신규, 나머지 일치.
- [x] **F14 live 판정 — ④ 는 잠복 (Phase 2 후반).** 로컬 프로젝트 `qwe` (빌더 `/builder/ade5bcd8…`, Chrome MCP hidden 탭 — overlay 95% 상태지만 `fullTreeLayout` → wasm 은 돈다, 270 rect) 에서 문서에 이미 있던 ProgressBar 2 + `ComponentFactory.createComplexComponent` 로 심은 Meter · Slider 의 `getSharedLayoutMap()`:

  | 컴포넌트 (root 폭) | Track rect (x, y, w, h) | 판정                                 |
  | ------------------ | ----------------------- | ------------------------------------ |
  | ProgressBar (350)  | (0, 24, **350**, 8)     | Track 폭 = 컨테이너 폭 — 100 아님    |
  | Meter (342)        | (0, 24, **342**, 8)     | 같음                                 |
  | Slider (342)       | (0, 24, **342**, 8)     | 같음 (SliderThumb (162, −5, 18, 18)) |

  원인: factory 가 Track 에 인라인 `width: "100%"` + `gridColumnStart 1 / gridColumnEnd 3` 를 싣고, root 는 catalog `gridTemplateColumns: "1fr auto"` (`componentRulesTable.ts:7011 · 8289 · 10430 · 10490`) 를 가진다 — template 없는 grid 는 Track 자신인데 **Track 은 canonical 자식이 0** 이라 암묵 열이 생길 item 이 없다. ④ 가 production 에서 드러나려면 사용자가 template 없는 `display: grid` Frame 에 자식을 넣어야 한다.

- [x] **F19 정정 — ① 의 catalog 도달은 0.** catalog `height: "100%"` 2곳 (`:7058 · :8339`) 은 `staticSelectors[".fill"]` — Preview DOM 의 fill 막대 (Meter/ProgressBar `.bar > .fill`) 이고 canonical 노드가 아니다 (Track `children: []`). ① 이 닿는 production 입력은 **사용자가 Styles 패널에서 넣는 `%` 높이뿐**. 시드는 `removeElement` 로 전부 제거 (canonical 269 → 269, 잔여 0).
- [x] **BC 인벤토리 — N = 0 / M = 269 (0%).** 로컬 IndexedDB `composition` v21 의 프로젝트 1개 (`qwe`, `document_parts` 270) 의 canonical 문서 27 페이지 · 노드 269 (frame 29 · Button 15 · Label 25 · ref 10 · ProgressBar 2 …) 를 `__canonical_STORE__` 에서 전수 순회: 인라인 `style.height` / `minHeight` / `maxHeight` 가 `%` 인 노드 **0**, `responsive.styles` 의 `%` 높이 **0**. `%` 는 `width: "100%"` 만 (Form · TextField · Input · Card · Image · Description · ProgressBar 등 — 폭 축은 이미 정합). R1 은 이 저장소 기준 **LOW** — 변화는 앞으로 사용자가 `%` 높이를 넣을 때만 나타난다. 합성 문서가 아니라 사람이 만든 프로젝트 (measurement-validity Q1) 이지만 표본이 1 프로젝트라 분포 일반화는 하지 않는다.
- [x] **`cargo bench tree_solve` baseline** (2026-09-07, 같은 머신 · `0b1cecb4a` 코드 · bench profile, median / p90 ns):

  | 시나리오                   | median | p90    |
  | -------------------------- | ------ | ------ |
  | nested depth=1 full solve  | 4,875  | 5,042  |
  | nested depth=4 full solve  | 10,291 | 10,833 |
  | nested depth=8 full solve  | 18,083 | 19,125 |
  | nested depth=12 full solve | 27,167 | 27,625 |
  | nested depth=8 incremental | 209    | 215    |

  G3 상한 = 각 행 median × 1.05 (depth 12: **28,525 ns**). ADR-169 당시 46.0 µs 와 다른 것은 머신·빌드 차이 — 비교는 이 표와만 한다.

**G0 판정**: 통과. Phase 2 순서는 ② (over-span 텔레포트 — 사용자 입력 즉시 재현) → ④ (잠복). Phase 1 은 그대로 선행.

## 3. Phase 분할

### Phase 1 — 늘어난 크기를 definite 로 전달 (①, Taffy #1003 · #1123 · #965)

| 변경                                                                                                                                                                                                                                                                                                                                                         | 파일                                                                                          | 규범                                                              |
| ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | --------------------------------------------------------------------------------------------- | ----------------------------------------------------------------- |
| flex 3.5: item 이 `align-self: stretch` (auto margin 없음) 이고 라인 cross 가 definite 면 cross 도 `used_cross` 로 재-solve — `solve_node(c, used_main, used_cross)` 그리고 그 호출의 `child_containing_h` 게이트가 열리도록 **definite 입력 채널** 을 둔다                                                                                                  | `tree.rs` `solve_flex` 3.5 (`:2576` 부근)                                                     | flexbox §9.8 "stretched item 의 cross 는 definite" · §9.4 step 11 |
| definite 입력 채널: `solve_node` 가 available 과 별도로 "이 축은 확정" 표시를 받는다 — `NodeStyle` 확장 없이 `TreeNode` 의 per-solve 플래그 (`definite_h_override: Option<f32>`) 또는 `solve_node_with_definite(c, w, h, definite_h)` 시그니처. `%` ctx (`height_ctx`) 와 재귀 available 두 게이트가 **같이** 그 값을 읽는다 (ledger §백분율 두 게이트 규칙) | `tree.rs` `solve_node` 진입 · `solve_flex`/`solve_block`/`solve_grid` 의 `child_containing_h` | ledger §백분율 (두 경로 동시)                                     |
| grid: 셀 stretch (`align-self: normal/stretch`, 크기 auto) 인 item 에 row extent 를 definite 로 전달                                                                                                                                                                                                                                                         | `tree.rs:3753` 부근 (`place_grid_axis` 판정 재사용)                                           | grid §6.6 · §11.1                                                 |
| aspect: 자식 있는 상자의 전송 높이 — `aspect_h_floor` 는 유지하되 손자 `%` base 로는 전송값 (content 하한 적용 후 값) 을 definite 로 전달 — dispatch **전** 에 잠정 definite, dispatch 후 floor 재적용                                                                                                                                                       | `tree.rs:1768` 부근 + dispatch                                                                | CSS-SIZING-4 §5.2.2 · §5                                          |
| ledger §백분율 갱신 — "판정은 `explicit_h > 0` 하나" → "명시 `explicit_h` **또는** stretch/grid/aspect 로 확정된 definite 채널"                                                                                                                                                                                                                              | `layout-css-parity-ledger.md` §백분율 · `layout-engine.md` 색인 §13                           | 문서                                                              |

- 게이트 fixture: `percentSize.browser.test.ts` 에 F5 · B1d · B6c + **multi-line W3 · W4** (`flex-wrap: wrap` h200 · 3×150 → 2 라인: W3 라인 100 → inner `h50%` = 50 · W4 item2 `h30` + `align-content: stretch` 분배 → 라인 115 → 57.5. Chrome 실측 리뷰 round 1, 엔진 0 — 채널 기준은 컨테이너 cross 가 아니라 **분배 뒤 라인 cross**. §9.8 "single-line" 한정은 Chrome 과 다르다 → ledger 개정 시 명시) + 파생 (column 컨테이너 stretch 폭의 `width:%` 손자는 이미 정합 — 대조군 · `align-self: flex-start` 면 **비확정** 대조군 · auto margin 있으면 비확정 대조군 · grid `align-self: start` 대조군 · 3단 중첩 1건).
- 원복 RED: 채널 제거 시 F5·B1d·B6c·W3·W4 5건 RED, 대조군 GREEN 유지 (대조군이 RED 면 가짜 확정 — ledger §백분율 금지 패턴 1).
- 회귀: `basicAxis{ContainerSize,ChildSize,Nesting}` · `percentSize` · `flexSweep` · `crossAxisOverflow` · `gridItemBox` 전량.

### Phase 2 — grid 암묵 트랙 준수 (② · ④, Taffy #1036 · #1037 · #986 · 암묵 트랙 기본 `auto`)

| 변경                                                                                                                                        | 파일                                                                                                   | 규범                                  |
| ------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------ | ------------------------------------- |
| 명시 배치 (`col_start` 또는 `row_start` 있음) 는 열/행 한계 없이 배치 — `block_fits` 의 `cols` 한계는 **자동 배치 축에만**                  | `grid.rs:754` `block_fits` + 호출 4곳                                                                  | CSS-GRID-1 §8.5 implicit grid 성장    |
| 10,000 반복 가드 → **라인 clamp** (`start.min(10_000)`, `span` 은 `10_000 - start` 로) 후 정상 배치. 실패 위치 반환 삭제 — **5곳** (F7)     | `grid.rs:788/1008/1014/1038/1044`                                                                      | Chrome 10,000 트랙 clamp (Taffy #986) |
| 배치 결과의 `max(col_end)` / `max(row_end)` 로 암묵 열·행 수를 정하고, 암묵 트랙은 `grid-auto-columns`/`rows` 토큰 **순환** (없으면 `auto`) | `grid.rs:1186` (column-flow 한정 해제) · `:1094` (`parse_implicit_track_size` 폐기 → 토큰 순환 + 기여) | §7.6 · §8.5                           |
| 정폭 grid 에 template 이 없으면 `["auto"]` 1열 합성 — F11 의 합성을 `inline_intrinsic` 분기 밖으로                                          | `tree.rs:3390` 부근                                                                                    | §7.1 (암묵 grid 만 있는 컨테이너)     |
| 셀 폭·높이 폴백 100 제거 — 트랙이 없으면 위 합성이 항상 선행하므로 도달 불가; 남기면 assert 로. **3곳** (F8)                                | `grid.rs:682/685/1187`                                                                                 | —                                     |
| auto 축 기여 계산 전 `repeat(N, …)` 을 `expand_repeat` 로 펼친 뒤 `SizingFn` 분류 (auto-repeat 는 scope 밖 — §5)                            | `tree.rs:4446/4489` 부근                                                                               | §7.2.3.1                              |
| `grid-auto-columns` 목록이 fr/auto/minmax 일 때 F13 의 auto-rows 경로와 같은 기여·분배 — 열/행 대칭                                         | `tree.rs` auto_row_tokens 대응 열 경로                                                                 | §7.6                                  |

- 게이트 fixture: 신규 `gridImplicitTracks.browser.test.ts` — G4 (span 초과) · G4' (row-start 초과) · G12 (정폭 template 없음, 1 / 3 item) · G10 (auto 축 `repeat(2, 40px)`) · G11 (`grid-auto-columns: 1fr 2fr` column flow) · 10,000 clamp (`grid-row-start: 20000` → Chrome 값) · 대조군: 자동 배치가 `cols` 한계를 지키는 케이스 (기존 `gridItemBox`).
- 원복 RED: `block_fits` 한계 해제 원복 → G4 RED · 합성 분기 원복 → G12 RED · 순환 원복 → G11 RED (타입별 실제 diff 행 기록 — 메모리 `feedback-mutation-red-record-actual-diff-per-type`).
- 회귀: `gridItemBox` · `gridTrackContribution` · `gridContainerIntrinsic` · `gridContainerBlockSize` · `gridAutoTrackStretch` · `gridMinmaxTracks` · `gridAlignContent` · `shrinkToFitInline` 전량 + `catalogComponentBox` (F14 6 규칙 — 착수 전 GridListItem·Tooltip 2건은 기존 실패로 분리 기록).

### Phase 3 — 문서 · live · 종결

- ledger §백분율 개정 + 신규 §25 (grid 암묵 트랙) · `layout-engine.md` 색인 13 개정 + 25 추가 · CHANGELOG (Fixed — 기존 문서 배치 변화 명시) · `TAFFY_UPSTREAM_DELTA_2026-09.md` §4 ①②④ ✅ · `presetDefinitions.ts:21` 회피 주석 정정 (`minmax()` 만 해제 — auto-repeat 는 여전히 회피).
- live: 실제 프로젝트에서 (a) `flex row height:200` 안 Frame 의 `height:100%` 자식, (b) 2열 grid 에 `grid-column: span 3` 자식, (c) F14 Track 하나 — Chrome MCP 또는 사용자 confirm, 결과를 ADR `### Live Exercise` 에 기재.
- `pnpm perf:baseline -- --lane frame` 1회 (600 요소) — 재-solve 추가의 프레임 영향 확인 (G3 의 bench 와 별개, 제품 수준).

## 4. 파일 변경표

| 파일                                                                                                            | Phase | 변경                                                                                                                      |
| --------------------------------------------------------------------------------------------------------------- | ----- | ------------------------------------------------------------------------------------------------------------------------- |
| `packages/composition-engine/src/tree.rs`                                                                       | 1 · 2 | definite 채널 · 3.5 cross 재-solve · grid 셀 definite · aspect 승격 · 암묵 열 합성 이동 · repeat 펼침 · auto-columns 순환 |
| `packages/composition-engine/src/grid.rs`                                                                       | 2     | `block_fits` 축별 한계 · 10,000 clamp · 암묵 트랙 생성 일반화 · 폴백 100 제거                                             |
| `apps/builder/tests/parity/percentSize.browser.test.ts`                                                         | 1     | F5 · B1d · B6c · W3 · W4 + 대조군                                                                                         |
| `apps/builder/tests/parity/gridImplicitTracks.browser.test.ts` (신규)                                           | 2     | G4 · G12 · G10 · G11 · clamp + 대조군                                                                                     |
| `packages/composition-engine/tests/tree_golden.rs`                                                              | 1 · 2 | 손계산 golden 2~3건 (Chrome 실측값 상수)                                                                                  |
| `.claude/skills/composition-patterns/reference/layout-css-parity-ledger.md`                                     | 3     | §백분율 개정 · §25                                                                                                        |
| `.claude/rules/layout-engine.md`                                                                                | 3     | 색인 13 · 25                                                                                                              |
| `docs/CHANGELOG.md` · `docs/explanation/research/TAFFY_UPSTREAM_DELTA_2026-09.md` · `presetDefinitions.ts` 주석 | 3     | 기록                                                                                                                      |

## 5. scope 밖 (사용자 결정 2026-09-07 — 별도 판정)

C 묶음은 **production 도달 사례가 없어** 본 ADR 에 넣지 않는다. 도달 사례가 나타나면 별도 ADR 또는 본 ADR 후속 phase.

| 항목 | 내용                                                                       | Taffy                  |
| ---- | -------------------------------------------------------------------------- | ---------------------- |
| ⑥    | grid 파서 — 대괄호 라인 이름 · `auto-fit` collapse · auto-repeat 최소 크기 | #1138 #1035 #946       |
| ⑦    | flex `baseline` 정렬 · `safe`/`unsafe` · `self-start`/`self-end` (flex)    | #1109 #1127 #952 #1077 |
| ⑧    | `display: flow-root` BFC · block `align-content`                           | #997 #959              |
| ⑨    | padded 텍스트 leaf intrinsic 이중 가산 — **실측 전 판정 보류**             | #1018                  |

## 6. 완료 체크리스트

- [ ] Phase 0 산출 4건 (전수 대조 · F14 live · BC 인벤토리 · bench baseline)
- [ ] Phase 1 게이트 GREEN + 원복 RED + 회귀 0
- [ ] Phase 2 게이트 GREEN + 원복 RED + 회귀 0 (기존 실패 2건 분리 기록)
- [ ] `cargo bench tree_solve` p50 ≤ baseline +5%
- [ ] live 3 시나리오 → ADR `### Live Exercise`
- [ ] ledger · 색인 · CHANGELOG · 대조 문서 · preset 주석
- [ ] README Implemented 전이 + 현황 카운트
