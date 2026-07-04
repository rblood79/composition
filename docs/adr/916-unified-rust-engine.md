# ADR-916: 자체 단일 Rust 엔진 통합

## Status

Accepted — 2026-07-03

- Proposed — 2026-07-03
- Accepted — 2026-07-03 (Risk Threshold Check 대안 D 선정 + Gate G1~G5 완비 + 자체리뷰/codex 2 라운드 정정 반영 후 사용자 명시 confirm)
- Phase 0 — 종료 2026-07-03 (**0-A seam 만 land**, flag 보류). 0-A = 레이아웃 엔진 주입 seam (`createLayoutEngine` factory 경유, 동작 무변). 0-B(LayoutScheduler worker offload)는 Phase 2-B 로 이연 — block/grid 가속기 dead + Phase 1/2 재편 대상이라 flip 앞선 dormant 배선 회피. 다음 진입점 = Phase 1 (Taffy 제거, HIGH 위험 — 별도 사용자 승인 필요)
- Phase 1 진입 (사용자 승인 2026-07-03, "1-D 하네스 먼저") — **1-D dual-run diff 하네스 비교 엔진 land** (`dualRunHarness.ts`, HC3 2단 판정, 계약 test 5/5). breakdown 순서를 1-A(flex.rs) 먼저에서 **1-D(검증 기반) 먼저**로 재배열 — 하네스가 flex.rs 의 유일한 검증 경로(R1 대응)이므로 산출물보다 선행. fixture golden 생성은 candidate 엔진(flex.rs) 착수 시점 이연. 다음 진입점 = 1-A `flex.rs` 신규 (HIGH 위험, ~2,000줄 CSS Flexbox 명세 — 별도 세션·사용자 승인)
- 1-A 착수 (사용자 승인 2026-07-03, "1-A 착수" + 첫 단위 = crate scaffold + 단일축 기본) — **`composition-engine` crate(taffy 의존 없음) + `flex.rs` 단일 라인 flex land** (`flex_layout_single_line`: justify 6종 / align 4종 / row·column / gap, `FLEX_FIELD_COUNT=16` 계약 = block_layout.rs flat f32 패턴 승계). M4(sub-group N≥3 confirm) 발동 → 대안 C big-bang 회피 위해 최소 검증 가능 단위부터. cargo test 8/8 PASS. **미구현**: grow/shrink 분배(§9.7)·wrap(§9.3)·align-content·flex-basis content — 다음 세션 (dual-run FAIL 이 fixture). WASM seam 배선은 flex/grid/block 완성 후 이연. 다음 진입점 = 1-A 잔여(grow/shrink/wrap) 또는 1-B grid (HIGH — 별도 세션·승인)
- 1-A 잔여 land (사용자 승인 2026-07-04, "flex-grow/shrink 분배와 wrap 구현… 착수 승인") — **`flex.rs` §9.7 flex-grow/shrink 분배 + §9.3 flex-wrap multi-line + align-content land**. `flex_layout` 신규 진입점(wrap/align-content 파라미터 추가), `flex_layout_single_line` 은 nowrap 특수 케이스로 위임(하위 호환). §9.7 = 반복 동결(freeze) 알고리즘: grow/shrink 방향 결정 → inflexible 동결 → min/max clamp violation 부호 합산으로 재분배 루프. §9.3 = outer main-size 누적 초과 직전 라인 분할(라인당 최소 1개). `FLEX_FIELD_COUNT` 16→17 (packed grow_shrink → 별도 flex_grow/flex_shrink 필드 분리). cargo test **21/21 PASS** (기존 8 회귀 + grow 4 / shrink 3 / wrap 4 / align-content 2), clippy 0. **미구현**: flex-basis:content intrinsic 자동측정·aspect-ratio·align-self·auto margin 흡수·nested BFC. WASM seam 배선은 여전히 flex/grid/block 완성 후 이연 (dormant 회피). 다음 진입점 = 1-B grid.rs (track sizing §11, HIGH — 별도 세션·승인)
- 1-C block.rs land (사용자 승인 2026-07-04, "1-C block.rs 먼저") — **기존 `block_layout.rs`(625줄, test 17) 를 `composition-engine/src/block.rs` 로 승계 이식 + 명세상 명확한 잔여 케이스 보강**. 이식 = 입력 계약(`FIELD_COUNT=19`) 그대로 (계약 통일은 Phase 2-B tree.rs 로 이연 — 지금 통일 시 dormant). **승계 vs 재작성 판정**: block 은 flex 와 달리 검증된 커널 존재 → 재작성은 Soft Constraint(WPT-파생 검증 자산 상실) 위배 → design freeze("block_layout.rs 승계") 정합으로 이식 선택 (사용자 관점 의문 아님). **잔여 케이스 (명세상 명확한 것만)**: (1) empty block **through-collapse chain** — 원본 커널이 `prev_margin_bottom = collapsed_self` 로 덮어써 앞선 sibling margin 유실 → CSS 2.1 §8.3.1 위반 발견 → `collapse(prev, self)` 누적으로 수정 (3연속 empty 통과 test), (2) 부모-자식 bottom collapse metadata 전파, (3) BFC 자식 bottom collapse 차단. clippy 수정 1건(child_w fit-content/explicit 동일 분기 병합). cargo test **40/40 PASS** (flex 21 + block 19: 승계 16 + 잔여 3), clippy 0. **미구현**: float/clear·writing-mode·BFC 내부 다단. 원본 block_layout.rs 무변(승계 후 개선은 새 crate 만). 다음 진입점 = 1-B grid.rs (track sizing §11, HIGH — 별도 세션·승인)
- 1-B grid.rs land (사용자 승인 2026-07-04, "1-B grid.rs (§11 track sizing) 착수… 승인") — **두 검증 자산을 `composition-engine/src/grid.rs` 로 통합 승계**: (a) `grid_layout.rs`(279줄, test 11) 의 px/fr/%/auto track 산술 + row-major cell positions 커널, (b) `GridLayout.utils.ts` 의 더 완전한 알고리즘 — `repeat(auto-fill/auto-fit, ...)` 동적 track 수 / `minmax(min, max)` (fr sentinel) / named grid-template-areas / `gridColumn·gridRow` span 배치. **승계 판정**: grid_layout.rs 는 auto=1fr 근사 + repeat/minmax/areas 미지원이었으나, GridLayout.utils.ts 에 실동작 검증된 JS 구현이 존재 → 재작성 아닌 두 자산 통합 이관 (block.rs 와 동일 패턴, design freeze "grid_layout.rs 승계 확장" 정합). **완결 공개 엔트리** `grid_layout(template_cols, template_rows, template_areas, placement_spec, ...)` 신규 = flex_layout/block_layout 과 대칭 (문자열 template → 최종 자식 bounds flat 배열). 이관 중 `resolve_grid_tracks` fr 분배를 원본 계약(`frSize * frVal`)대로 정정 + `parseFloat||1` 폴백(0fr→1fr) 재현. cargo test **64/64 PASS** (flex 21 + block 19 + grid 24: 승계 11 + repeat/minmax 5 + areas/span/place 5 + 완결 엔트리 3), clippy 0. **미구현**: subgrid·intrinsic track(min/max-content→0 폴백)·dense 역채움·baseline 정렬·`fit-content()` 함수. 원본 grid_layout.rs / GridLayout.utils.ts 무변. WASM seam 배선은 여전히 flex/grid/block dual-run 통과 후 이연(dormant 회피). **Phase 1 self-impl 3종(flex/block/grid) 완료** — 다음 진입점 = 1-D fixture golden 생성 + WASM batch 엔트리(`LayoutEngineAPI`) + seam 배선 + 1-E Taffy 제거 (HIGH — 별도 세션·승인)
- 1-D fixture golden land (사용자 승인 2026-07-04, "1-D fixture golden 생성 착수 승인, 배선까지 한 번에") — **세 완결 엔트리(flex_layout/grid_layout/block_layout) 전체 파이프라인을 CSS 명세 유래 기대값으로 회귀 고정** (`tests/golden.rs`, 현재 15 케이스). golden 방식 재정의: breakdown §1-D 의 "Chrome 실측 → 자동 생성" 은 자체 엔진의 **WASM 트리 배선(buildTreeBatch)** 을 전제 (dualRunHarness 가 트리 batch 계약 소비) → 트리 오케스트레이션은 Phase 2-B tree.rs 범위(G5 confirm 필수)라, Phase 1 scope 유지를 위해 **단일 컨테이너 단위 golden** (명세 정확 계산값, 정수 좌표 위주)으로 확보. golden 이 grid cell x/y leading gap 누락 승계 버그를 발견했고, 후속 처리에서 원본 JS live helper와 Rust 후보 엔진을 동시에 수정해 CSS↔Skia 분기를 피했다. block.rs test identity_op clippy 3건 정리. 후속 grid gap 처리 후 cargo test **79/79 PASS** (lib 64 + golden 15, ignored 0), clippy --tests 0. **배선(WASM 트리 batch + createLayoutEngine)은 미착수** — dualRunHarness 트리 계약이 tree.rs(2-B, HIGH·G5 confirm) 선행을 요구한다. 다음 진입점 = G5 scope confirm 후 Phase 2-A/2-B 진입 (HIGH — 사용자 승인)
- **Phase 1 부분 마감** (사용자 결정 2026-07-04, "(C) 여기서 멈추고 Phase 1 마감") — **self-impl 알고리즘 계층 완료, 배선/Taffy 제거 미착수**. land: 1-D dual-run 하네스 비교 엔진 + 1-A flex.rs(§9.7 grow/shrink·§9.3 wrap·align-content) + 1-C block.rs(승계 이식 + through-collapse) + 1-B grid.rs(track sizing §7·placement §8) + 1-D 단일 컨테이너 golden. **미착수 (배선 후 가능)**: WASM 트리 batch 엔트리(`buildTreeBatch`) + `createLayoutEngine` 배선 = tree.rs(2-B) 트리 오케스트레이션 선행 요구 → 사실상 Phase 2 진입, 1-E(Taffy dependency 제거)는 배선·dual-run 안정 후에만 가능. **ADR Status = Accepted 유지** (Phase 1 전체 미완 → Implemented 승격 아님). 자체 엔진은 seam 미배선 순수 crate 로 존재 — live builder 영향 0, 현행 Taffy 경로 그대로 가동. **다음 진입점 = Phase 2 진입 (G5 scope confirm 필수, HIGH — 별도 세션·사용자 승인)**. 배선·1-E 는 Phase 2-A(style.rs)/2-B(tree.rs) 완료 후 트리 계약이 생겨야 착수 가능.
- Grid gap 승계 버그 처리 완료 (사용자 승인 2026-07-04, "Phase 2 진입 가능하게 grid gap JS + grid.rs 동시 수정") — `GridLayout.utils.ts` 와 `composition-engine/src/grid.rs` 의 leading gap offset 조건을 동시에 `colStart-1`/`rowStart-1` 로 정정. `tests/golden.rs` 의 ignored fixture 해제 + row/column leading gap fixture 추가(15 golden), JS live helper 단위 테스트 추가. 검증: composition-engine cargo test **79/79 PASS** (lib 64 + golden 15, ignored 0), clippy --tests 0, `GridLayout.utils.test.ts` PASS, type-check PASS. **G5 confirm 착수 조건 충족**: grid gap 차단은 해소됐고, Phase 2 code 진입은 여전히 G5 사용자 scope confirm 이 필요.
- **Phase 2 진입 (G5 confirm)** (사용자 결정 2026-07-04, "본 ADR 내 2-A/2-B 선착수") — Phase 2 scope 를 **본 ADR 내 2-A/2-B 선착수**로 확정 (후속 ADR fork 아님, breakdown 안전 기본값). 2-B tree.rs 완료 실측 후 2-C/2-D/2-E 재판정. G5 gate 통과.
- **2-A style.rs 첫 단위 land** (사용자 승인 2026-07-04, "세 실측 결정 승인, 첫 단위 착수") — **CSS 값 산술 파서 커널 이식** (`composition-engine/src/style.rs` 신규). 착수 전 실사로 breakdown 대비 실측 3건 확정·정정: (1) **style.rs 위치** — 원안 "composition-layout/style.rs 기반" 은 stale(Taffy 0.10 종속 폐기 예정 crate) → `composition-engine` 신규가 정합(Phase 1 crate 결정 자연 승계, fork 4질문 대상 아님). (2) **이관 경계** — `cssValueParser.ts` 의 DOM 의존(`getComputedStyle(documentElement)`, var()/토큰) 은 JS 잔류, 순수 산술만 Rust — var() 선치환 후 산술을 Rust 에 전달(flat f32 철학). (3) **첫 단위** — 4,700줄 통이관 불가(M4) → 값 산술 커널만. 이식 함수: `resolve_css_size_value`(진입점) / `resolve_unit_value`(px/rem/em/vw/vh/vmin/vmax/in/cm/mm/pc/pt/ch/ex/%) / `resolve_calc`(재귀 하강 + tokenize) / clamp·min·max / env(safe-area 4종→0) / split_css_function_args. 계약: `number|undefined`→`Option<f32>`, `CSSValueContext`→`CssValueContext`(스칼라, variableScope 제외), intrinsic→센티넬 f32(FIT/MIN/MAX_CONTENT), `parse_leading_f32` 로 JS parseFloat 근사. rem-before-em / %는 container 필요 / calc 0-division None 등 edge case 승계. cargo test **106 PASS** (lib 90=기존 64+style 26 / golden 15 / doc-test 1), clippy --tests 0, 원본 JS 산술 계약 값 대조 일치. seam 미배선 순수 함수 → live 영향 0(dual-run/cross-check 는 트리 배선 2-B 이후). 당시 **미이식(후속 2-A 단위)**: font/border shorthand → cssResolver → taffyDisplayAdapter → implicitStyles(2,440줄). font/border shorthand 는 아래 단위에서 처리 완료.
- **2-A style.rs shorthand 단위 land** (사용자 승인 2026-07-04, "1") — **font/border shorthand 분해 이식**. `parse_font_shorthand` 는 JS `parseFontShorthand` 계약을 승계해 `fontStyle/fontWeight/fontSize/lineHeight/fontFamily` 를 optional string 으로 분해하고 `normal` 은 결과에서 제외, quoted family/comma family 를 보존한다. `parse_border_shorthand` 는 JS `parseBorderShorthand` 계약을 승계해 순서 무관 width/style/color 를 분해하고 width 는 JS `parseFloat` 근사(`1.5rem`→`1.5`), 기본값은 `{width:0, style:"none", color:"#000000"}`. seam 미배선 순수 함수 → live 영향 0. 검증: shorthand RED→GREEN, cargo test **112 PASS** (lib 96 / golden 15 / doc-test 1), clippy --tests 0. **남은 2-A 단위**: `cssResolver.ts` 캐스케이드 → `taffyDisplayAdapter.ts` display 매핑 → `implicitStyles.ts` 데이터 주도 매핑. 다음 진입점은 `cssResolver.ts` 캐스케이드 최소 계약 또는 보류 (HIGH — 별도 승인).
- **2-A cascade.rs 단위 land** (사용자 승인 2026-07-04, "승인") — **`cssResolver.ts` 자기완결 순수 계층 이식** (`composition-engine/src/cascade.rs` 신규). 착수 전 실사로 store/DOM 의존이 `getRootComputedStyle()`(`useThemeConfigStore.getState()`) 한 곳에만 격리됨을 확인 → 순수 로직/데이터 테이블만 이식. 이식: `is_inheritable_property`(상속 19종) / `css_initial_value`(초기값 맵) / `resolve_cascade_keyword`(inherit/initial/unset/revert → `CascadeResult::Inherit|Value`) / `resolve_current_color`(currentColor 단어 경계 치환, `\bcurrentColor\b/gi` 재현) / `resolve_font_variant_features`+`DEFAULT_FONT_FEATURES`(font-variant→OpenType) / `resolve_logical_properties`(논리→물리, LTR, shorthand 2값 분리 + 물리 우선). 계약: `Record<string, string|number>`→`BTreeMap<String, CssValue>`(`CssValue::Str|Num` enum), INHERIT_SENTINEL→`CascadeResult::Inherit`, 논리 속성 반복 순서는 정의 순서 상수로 재현. **미이식**: `getRootComputedStyle`/`ROOT_COMPUTED_STYLE`(store 의존 JS 잔류), `resolveFontStretchWidth`(`@composition/specs` FONT_STRETCH_KEYWORD_MAP = ADR-091 spec SSOT 의존 → Rust crate 의 spec 참조 계약 미정으로 제외, 이중화 회피), `resolveStyle` 본체(조립 단위). 검증: cargo test **130 PASS** (lib 114=96+cascade 18 / golden 15 / doc-test 1), clippy --tests 0, 원본 JS 로직 대조(currentColor/cascade/font-variant) 전 케이스 값 일치. seam 미배선 순수 함수 → live 영향 0. **남은 2-A 단위**: `resolveStyle` 본체 조립 + `resolveFontStretchWidth`(spec 참조 계약 확정 후) → `taffyDisplayAdapter.ts` → `implicitStyles.ts`(2,440줄). 다음 진입점 = 위 잔여 단위 또는 2-B tree.rs (HIGH — 별도 승인).
- **2-A display.rs 단위 land** (사용자 승인 2026-07-04, "승인") — **`taffyDisplayAdapter.ts` 자기완결 순수 display 문자열 계층 이식** (`composition-engine/src/display.rs` 신규). 착수 전 실사로 tag/node 의존 함수(`getElementDisplay`=`INLINE_BLOCK_TAGS`, `toTaffyDisplay`/`needsBlockChildFullWidth` childElements, `VERTICAL_ALIGN_MIDDLE_TAGS`)와 순수 문자열 함수를 분리 — cascade `resolveFontStretchWidth`(spec SSOT) 제외와 동일 패턴으로 tag 도메인 의존 제외. 이식: `parse_display`(CSS Display Level 3 이원 구조 9종 매핑 + block 폴백) / `display_to_string`(역변환) / `classify_child_display`(block/inline/none, inline-flex/grid→block) / `blockify_display`(CSS L3 blockification, outer:inline→block inner 유지) / `is_inline_level`. `Display{outer, inner}` → `OuterDisplay`/`InnerDisplay` enum. 검증: cargo test **137 PASS** (lib 121=114+display 7 / golden 15 / doc-test 1), clippy --tests 0, 원본 JS 로직 대조(blockify 8 / classify 7 / roundtrip 9) 전 케이스 값 일치. seam 미배선 순수 함수 → live 영향 0. **미이식**: tag/node 의존 함수 → tree.rs(2-B) 노드 계약 또는 spec 참조 계약 확정 후. 다음 진입점 = `implicitStyles.ts`(2,440줄) 또는 2-B tree.rs (HIGH — 별도 승인).
- **2-B 착수 전 실사** (사용자 결정 2026-07-04, "B — 2-B tree.rs 진입") — breakdown "6-step DFS 일체화" 서술 대비 실측 gap 확정·기록(commit `0dbef44ae`). DFS 상단 3-step(`resolveStyle`=`getRootComputedStyle()` store 의존 + `applyImplicitStyles` tag/spec + `enrichWithIntrinsicSize` @composition/specs·propagationRegistry)은 **JS 잔류**(2-A 순수 계층 격리 이유). Rust 이관 표면은 `PersistentTaffyTree` 가 `LayoutEngineAPI` 를 호출하는 **하단 batch 계약**(`buildTreeBatch`→`computeLayout`→`getLayoutsBatch`)뿐 — payload `node.style` 은 상단이 이미 순수화한 TaffyStyle 레코드. gap 은 Phase 0 inventory 정밀화(서술 정정)로 흡수, 새 ADR fork 아님(M3). scope 정의 fork 판단은 AskUserQuestion 으로 surface(전제·관점 layer). **미착수** — 사용자 confirm 대기.
- **2-B tree.rs 단위 1 land** (사용자 승인 2026-07-04, "실측 하단만 착수" + "층별 점진" 기본값 채택) — **트리 오케스트레이션 계층 skeleton** (`composition-engine/src/tree.rs` 신규, taffy_bridge.rs `TaffyLayoutEngine` batch 계약 대응). 착수 전 실사로 **아키텍처 gap 확정**: flex/block/grid.rs 는 모두 "단일 컨테이너 + 자식 flat f32 → 자식 위치" 1-depth 커널인데 batch 계약은 N-depth 트리 상호의존 해결 필요 → 그 사이 오케스트레이션(handle 관리 + intrinsic + placement + dispatch)을 층별 점진(2-A 최소 검증 단위 패턴)으로 분할. **단위 1 scope**: `LayoutTree`(handle `nodes: Vec<Option<TreeNode>>` + `free_list` 재활용, taffy_bridge `alloc_handle`/`resolve` 대응) + `build_tree_batch`(post-order JSON 파싱·저장·handle 배열, child index 범위 검증 = forward-reference 거부) + `get_layouts_batch`(flat `[x,y,w,h,...]`, 무효 handle `[0,0,0,0]`) + 증분 API(create/update_style/set_children/remove_node/mark_dirty/clear/node_count). `compute_layout` 은 **leaf-only** — 각 노드 자기 크기(width/height, style.rs `resolve_css_size_value` 재사용)만 해결, 자식 배치·좌표는 (0,0). `NodeStyle` = StyleInput 전체 스키마(camelCase 계약 정합). **자식 배치는 단위 2(post-order intrinsic)/3(top-down placement+display dispatch)/4(dirty 추적)로 명시 분리**. 검증: cargo test **152 PASS** (lib 136=121+tree 15 / golden 15 / doc-test 1), clippy --tests 0, taffy_bridge.rs batch 계약 대조(child index 치환·flat shape·handle 재활용) 일치. seam(`createLayoutEngine`) 미배선 순수 Rust → live 영향 0. **다음 진입점** = 단위 2 post-order intrinsic 측정 또는 단위 3 placement+dispatch (HIGH — 별도 승인).
- **2-B tree.rs 단위 2 land** (사용자 승인 2026-07-04, "승인") — **post-order flex solve** (`tree.rs` `compute_layout` 확장). 착수 전 실사로 **단위 경계 재정의**: flex/block/grid.rs 는 컨테이너 자기 크기를 반환하지 않으므로(자식별 `[x,y,w,h]` 만) height:auto 부모 intrinsic 은 자식을 먼저 배치(커널 호출)해 bounding box 를 봐야 나옴 → **intrinsic ↔ placement 물리적 분리 불가**. 원안 "단위 2=intrinsic / 단위 3=placement" 를 "post-order 트리 solve" 한 단위로 병합, 내부를 display 별(flex → block/grid) 최소 검증층으로 재분할(승인된 옵션 A 내부 단위 경계 조정 — fork 아님). **단위 2 scope**: `compute_layout` = post-order `solve_node`(leaf/비-flex 는 자기 크기, flex 는 `solve_flex`) — 자식 재귀 solve → `write_flex_item`(NodeStyle → flex flat f32: direction 별 width↔main·height↔cross 매핑, padding/border 축 합산, min/max 논리축, content_main/cross=자식 solve 결과) → `flex::flex_layout` → 자식 좌표 반영 + bounding box 로 컨테이너 content 크기(height:auto sentinel) 도출. CSS 키워드 → flex.rs u8 매핑(`parse_flex_direction`/`parse_justify_content`/`parse_align_items`/`parse_align_content`/`parse_flex_wrap`, flex.rs 상수 리터럴 대조). **발견(flex.rs 알려진 제약, scope 밖)**: `flex.rs` `ALIGN_STRETCH` 가 자식 명시 cross size 를 무시하고 컨테이너 cross 로 stretch(CSS 명세 위반 — Phase 1 flex.rs 버그). tree.rs 는 건드리지 않고 테스트를 `align-items:flex-start` 로 우회, flex.rs 수정은 Phase 1 후속. **미포함(다음 단위)**: block/grid dispatch(단위 3 — 현재 비-flex 컨테이너는 자기 크기만·자식 미방문), row-reverse/column-reverse, flex-basis:content/px, 증분 dirty(단위 4). 컨테이너 크기 = bounding box 근사 — Taffy formatting context 정확값 정합은 seam 배선 후 dual-run 에서 검증. 검증: cargo test **158 PASS** (lib 142=136+flex solve 6 / golden 15 / doc-test 1), clippy --tests 0. seam 미배선 → live 영향 0. **다음 진입점** = 단위 3 block/grid dispatch (HIGH — 별도 승인).
- **2-B tree.rs 단위 3-a land** (사용자 승인 2026-07-04, "단위 3 (block/grid dispatch) — 승인") — **block dispatch** (`tree.rs` `solve_block` 추가). 착수 전 실사로 **단위 3 재분할**: flex/block/grid.rs 세 커널 계약 비대칭 확인 — flex(17필드,논리축)·block(19필드,물리축)은 "자식 flat f32 → 위치" 커널이라 solve 패턴 동일하나 grid 는 근본적으로 다름(자식 flat 없음, `template_cols/rows/areas`+`placement_spec` 문자열만 받아 트랙 산술). 따라서 block(3-a, flex 와 계약 근사) 먼저 + grid(3-b, 문자열 어댑터) 분리(승인된 옵션 A 내부 경계 조정 — fork 아님). **단위 3-a scope**: `solve_node` 의 `ContainerDisplay::Block` 분기 → `solve_block`(자식 재귀 solve → `write_block_item`= block flat f32 19필드 물리축: display code(block/inline-block)/margin 4-way/pad*border v·h 축 합/min·max/content_w·h → `block::block_layout(data, w, h, false, false, 0)` → 자식 좌표 반영 + bounding box → 컨테이너 크기). `classify_container_display` 확장: flex/inline-flex→Flex, grid/inline-grid→Other(3-b), 그 외(block/inline-block/**미설정**)→Block(`_hasChildren` 컨테이너는 상단 blockify → 미설정=block 기본). margin collapse/auto-width stretch/fit-content 는 block.rs 내부 처리. **미포함(다음 단위)**: grid dispatch(단위 3-b — grid 컨테이너 현재 자기 크기만·자식 미방문), 부모-자식 margin collapse 전파(block.rs OUT trailing metadata 2필드 미소비, `can_collapse*_=false`BFC 격리 가정 — tree.rs 레벨 배선은 별도 단위), inline-block baseline 전달, BFC 감지(bfc_flag=0 고정), 증분 dirty(단위 4). **참조 자산 대조**: taffy_bridge.rs 는 Taffy 내장 solver(TaffyTree) 사용 — 자체`block*layout`미호출 →`can_collapse*_=false` 가정은 batch 계약과 무관(정합 위반 없음). 검증: cargo test **164 PASS** (lib 148=142+block dispatch 6 / golden 15 / doc-test 1), clippy --tests 0. 검증층 = block vertical stack / 자식 margin collapse / auto-width stretch / explicit px+padding border-box / height:auto intrinsic=stacking 합 / display 미설정→block / grid 자기 크기만(3-b 전). seam 미배선 → live 영향 0. **다음 진입점** = 단위 3-b grid dispatch (HIGH — 별도 승인).
- **2-B tree.rs 단위 3-b land** (사용자 승인 2026-07-04, "승인") — **grid dispatch** (`tree.rs` `solve_grid` 추가). flex/block/grid dispatch 완성. grid 는 계약이 근본적으로 다름 — 자식 flat 을 안 받고 `template_cols/rows/areas`+`placement_spec` **문자열**만 받아 트랙 산술로 셀 배치(자식 크기 = 트랙 크기, intrinsic track 미측정). **tree.rs 어댑터 3요소**: (1) `join_tracks`(NodeStyle `grid_template_columns: Vec<String>` track array → space-join `"1fr auto"`, grid.rs `tokenize_template` 재분해 무손실), (2) `combine_grid_line`(NodeStyle 은 taffy_bridge 처럼 `gridColumnStart`+`End` 분리 값 보유 → grid.rs `parse_grid_line` 결합 형식 `"{start} / {end}"` 재조립, `normalize_grid_line_part` 로 auto/미설정은 None), (3) `build_grid_placement_spec`(자식들을 `area_name|grid_column|grid_row` 파이프+개행 직렬화, 전부 auto 면 빈 문자열). `solve_grid` = 어댑터 → `grid::grid_layout` → 셀 bounds → 각 자식 셀 크기로 재귀 solve(셀 안 flex/block 컨테이너 배치) → 셀 좌표 반영 + bounding box → 컨테이너 크기. `classify_container_display` grid/inline-grid→Grid. **발견(grid.rs 알려진 제약, scope 밖)**: intrinsic track 미측정(min/max-content→0), 음수 line index 0 clamp(미지원), dense/subgrid/baseline 미구현 — grid.rs Phase 1-B scope. **미포함(다음 단위)**: `justify-self`/`align-self` 셀 내 정렬(현재 자식 셀 stretch), `grid-template-areas` named area(NodeStyle 필드 없음 — Skia 숫자 line), grid-auto-flow column/dense, 증분 dirty(단위 4). **참조 자산 대조**: fullTreeLayout payload 직렬화(`gridColumnStart`=`String(...)` 개별 필드 / `gridTemplateColumns`=`coerceGridTrack`→track array)가 NodeStyle 계약과 1:1 일치 — 어댑터 상류 정합. 검증: cargo test **169 PASS** (lib 153=148+grid dispatch 6−삭제 1 / golden 15 / doc-test 1), clippy --tests 0. 검증층 = 2열 auto-placement / gap 셀 좌표 / gridColumn span / fr 분배 / grid 셀 안 flex 재귀 solve / height:auto intrinsic=셀 bounding box. seam 미배선 → live 영향 0. **다음 진입점** = 단위 4 증분 dirty 추적 (HIGH — 별도 승인). 단위 4 land 시 `LayoutEngineAPI` batch 계약 완비 → seam 배선(dual-run Taffy self-diff 0) 단계.
- **2-B tree.rs 단위 4 land** (사용자 승인 2026-07-04, "승인") — **증분 dirty 추적** (`tree.rs` `compute_layout`/증분 API 확장). taffy 의 "dirty 조상 자동 전파" 계약(taffy_bridge.rs:890-897 주석: "set_style/set_children 이 mark_dirty 내부 호출 + dirty 를 조상까지 자동 전파") 이식. **이관 4요소**: (1) `TreeNode` 에 `parent: Option<usize>` 추가 + `set_children`/`build_tree_batch` 가 자식 parent 배선(조상 전파 경로), (2) `update_style`/`set_children`/`mark_dirty` → `propagate_dirty(handle)` 로 변경 노드부터 root 까지 조상 dirty 마킹(이미 dirty 노드 만나면 조기 종료 — 그 조상은 이미 dirty 이므로 누락 없음), (3) `solve_node` 진입 시 `subtree_has_dirty(handle)` false 면 저장된 `layout.width/height` 를 반환값으로 재사용하고 재귀 생략(dirty 서브트리만 재계산 — clean sibling 은 skip 되나 저장 크기가 부모 flex/block/grid 배치 입력으로 정확 반영), (4) `LayoutTree.last_compute: Option<(root,avail_w,avail_h)>` — available 이 직전과 다르면 `mark_subtree_dirty(root)` 로 skip 전면 무효화(%/auto stale 방지, taffy layout cache 대비 캐시 없는 보수적 갈음), `clear`/`remove_node` 는 `last_compute=None` 무효화(handle 재발급 stale skip 차단). **참조 자산 대조**: taffy 의 3 incremental 테스트(test_mark_dirty_incremental=값 반영+값 보존, test_mark_dirty_add_remove_child=add/remove reflow) 관찰 계약 동형 커버 — taffy 는 column y좌표로 검증하나 자체는 flex column+height:auto(-1 sentinel) 미해결 영역(flex.rs main available 음수 미처리, Phase 1 후속) 우회 위해 row x좌표로 동형 검증(관찰 계약=최종 layout 정확성 동일). **미포함(다음 단계)**: taffy 수준 노드별 available-space 캐시(현재 root-level 비교 보수적 무효화), flex column height:auto intrinsic(flex.rs Phase 1 후속). 검증: cargo test **177 PASS** (lib 161=153+단위 4 신규 8 / golden 15 / doc-test 1), clippy --tests 0. 검증층 = update_style 조상 전파+반영(100→200) / explicit mark_dirty 값 보존 / set_children add·remove reflow / clean sibling skip+크기 재사용 / available 변경 % 재계산(width 200→400) / 동일 avail 재호출 값 불변 / clear 후 stale skip 없음. seam 미배선 → live 영향 0. **tree.rs 오케스트레이션 4 단위(1/2/3-a/3-b/4) 완료 → `LayoutEngineAPI` batch 계약 완비.** **다음 진입점** = seam 배선(`createLayoutEngine` flag 전환) + dual-run(Taffy self-diff 0) 검증 (HIGH — 1-E Taffy 제거 전제, 별도 승인).

## Context

**3-Domain 판정**: 본 ADR 은 D3(시각 스타일) consumer 인 Builder(Skia) 렌더 경로의 **내부 구현 계층** 재구축이다. D1(DOM/접근성) / D2(Props/API) 무관. D3 시각 정본 접점은 style resolution 이관(Phase 2-A) 시 **catalog SSOT** (`componentCatalog.ts` + `COMPONENT_RULES_TABLE`, ADR-912/913/914 cutover 완결 — 잔존 spec 은 Frame/Group/Slot 3개 영구 예외) 파생 스타일 값 보존 하나 — /cross-check 로 검증한다. catalog/Generator 확장 없음 (Generator emit 지원 질문 해당 없음).

composition Builder 렌더링 파이프라인은 JS 64,316줄(92%) + Rust 5,633줄(8%) 로 구성된다. Rust 는 외부 라이브러리 Taffy 를 래핑한 layout solve 에 국한되고, 나머지 전 단계(scene graph 동기화 / 스타일 해석 / DFS 오케스트레이션 / 렌더 커맨드 생성 / 텍스트 측정)가 JS main thread 에서 실행된다. 실측 병목 코드 경로:

- `apps/builder/src/builder/workspace/canvas/layout/engines/persistentTaffyTree.ts` (423줄) — dirty 검출을 노드당 JSON.stringify 문자열 비교로 수행
- `apps/builder/src/builder/workspace/canvas/layout/engines/fullTreeLayout.ts` (2,861줄) — batch 직렬화 병목: 초기 빌드 `buildTreeBatch(JSON.stringify(payload))` 전체 트리 직렬화 + 증분 갱신 시 변경 노드당 `updateStyleRaw` JSON.stringify, 2-pass 보정 최악 3× solve (computeLayout 호출부 3곳: `:2343/:2602/:2718`). (참고: per-node createNode/updateStyle/setChildren/computeLayout/getLayout 5-call API 는 비활성 composition-layout 쪽 인터페이스)
- `apps/builder/src/builder/workspace/canvas/skia/renderCommands.ts` (1,091줄) — 매 content 프레임 O(N) DFS + z-sort + boundsMap 재생성
- `apps/builder/src/builder/workspace/canvas/skia/buildSpecNodeData.ts` (1,786줄) — 노드당 조상 체인 탐색 O(N×D)
- `apps/builder/src/builder/workspace/canvas/skia/StoreRenderBridge.ts` (743줄) — detectChangedIds O(N) Map 순회
- 텍스트 측정 — 캐시 미스 시 다중 WASM 왕복 + Canvas2D/CanvasKit 이중 측정 경로

프레임 경로에서 WASM 경계를 5회 횡단한다 (스타일 직렬화 / Taffy solve / 레이아웃 역직렬화 / SpatialIndex 쿼리 / CanvasKit draw).

교체 대상 외부 라이브러리 래핑은 **Taffy 가 유일**하다 (serde / wasm-bindgen 은 플랫폼 인프라). **Skia(CanvasKit) 는 유지** — 픽셀 렌더링 엔진 교체는 본 ADR 범위 밖. 자체 구현 Rust 모듈(block_layout 625줄 / grid_layout 279줄 / spatial_index 393줄 / binary_protocol 1,347줄)이 이미 존재하며, Taffy 0.10 기반 신규 엔진(`packages/composition-layout`, 1,660줄)은 `USE_RUST_LAYOUT_ENGINE=false` 뒤에 비활성 상태다. Worker 인프라(`wasm-worker/` 672줄) 역시 `LAYOUT_WORKER=false` 로 비활성.

**Hard Constraints**:

1. Canvas 60fps @ 1000+ 노드 (CLAUDE.md 성능 기준) — 이관 각 단계에서 프레임타임 회귀 금지
2. 초기 번들 < 500KB — WASM lazy-load 경로 유지, 엔진 WASM 증가 gzip +300KB 이내
3. **BC 수식화**: 기존 프로젝트 문서 100% 가 layout 영향권 — 기준 2단: (a) dual-run **수치** diff ≤ 1px (f32 sub-pixel tolerance, 엔진 간 부동소수점 drift 허용) (b) **시각** diff 0 = 1x zoom device pixel 스크린샷 diff 0 — 수치 drift 가 동일 device pixel 로 라운딩되는 범위만 허용. (a) 통과 + (b) 위반 (예: 0.5px drift 가 픽셀 경계를 넘어 라운딩 차이 유발) 시 (b) 가 우선 — FAIL
4. D3 대칭: Builder(Skia) ↔ Preview(DOM+CSS) 시각 결과 동일 — /cross-check 전수 PASS
5. WASM 경계 횡단 프레임 경로 5회 → 2회 (통합 엔진 batch 호출 + CanvasKit draw)

**Soft Constraints**:

- Rust 유지보수 역량 — 코드 리뷰 가능 인력 제한 (버스팩터)
- CSS Flexbox/Grid spec 자체 구현의 검증 비용 — Taffy 가 축적한 WPT-파생 테스트 자산 상실 위험
- 대규모 코드 생성 도구 (Fable 5 등) 활용 시 생성 코드 검증 부담

## Alternatives Considered

### 대안 A: 현상 유지 + JS 측 점진 최적화

- 설명: Taffy 유지, JS 병목 지점만 개별 최적화 (JSON.stringify → 해시, memoization 확대)
- 근거: 최소 변경 원칙, 회귀 위험 0
- 위험:
  - 기술: L — 검증된 경로 유지
  - 성능: **H** — 노드당 ~5회 WASM 경계 횡단은 JS 최적화로 구조적으로 해소 불가
  - 유지보수: M — 이중 Rust crate (0.9/0.10) + 외부 라이브러리 버전 종속 지속
  - 마이그레이션: L — 변경 없음

### 대안 B: Taffy 유지 통합 (Quick Win 만)

- 설명: composition-layout 배선 + `USE_RUST_LAYOUT_ENGINE=true`, LayoutScheduler 소비 배선 + `LAYOUT_WORKER=true` 로 종료. Taffy 0.10 단일화, 파이프라인은 JS 유지
- 근거: 인프라 코드가 이미 존재 (composition-layout 1,660줄 + wasm-worker 672줄). **단 flag 단독 전환은 무효** — layoutBridge 는 flag true 시 경고 후 TaffyLayout fallback (`layoutBridge.ts:36-44`), persistentTaffyTree 는 factory 미경유 직접 생성 (`persistentTaffyTree.ts:27,84`), scheduler 소비 caller 0건 (`wasm-worker/index.ts:32`) → 엔진 주입 + batch API 정합 + 소비 배선의 소규모 통합 작업 필요. worker 는 BLOCK_LAYOUT/GRID_LAYOUT 가속기만 처리 — Taffy full-tree solve 는 main thread 잔류 (`layoutWorker.ts:33-38`)
- 위험:
  - 기술: L — flag 전환 + 기구현 코드
  - 성능: M — scene/commands/style/text 병목 잔존, 경계 횡단 5회 유지
  - 유지보수: M — Taffy 외부 종속 영구화 (버전 업그레이드마다 layout 결과 변동 리스크 반복 — 0.9→0.10 도 결과 차이 존재)
  - 마이그레이션: L — flag revert 가능

### 대안 C: 일괄 전면 재작성 (big-bang)

- 설명: 단일 composition-engine crate 를 한 번에 작성, 완성 시점에 일괄 전환
- 근거: Figma (C++ 자체 엔진 → WASM, JS 는 UI shell) 업계 전례 — 최종 아키텍처 형태 자체는 검증된 방향
- 위험:
  - 기술: **C** — CSS Flexbox/Grid spec 전체를 중간 검증 지점 없이 일괄 구현 (Taffy 가 수년 축적한 spec compliance 를 단일 사이클에 재구현)
  - 성능: L — 최종 형태는 개선
  - 유지보수: H — 거대 단일 diff, 리뷰 불가
  - 마이그레이션: **C** — 전환 실패 시 전면 롤백, 회귀 원인 국소화 불가

### 대안 D: 단계적 단일 엔진 통합 (Phase 0→1→2, 게이트 기반)

- 설명: Phase 0 (기존 인프라 **배선 + flag 활성화** = 대안 B 내용 흡수 — flag 단독 전환 아님) → Phase 1 (Taffy 제거 — flex.rs 자체 구현 + dual-run 게이트) → Phase 2 (파이프라인 5개 모듈 순차 이관, 모듈별 게이트). 각 단계 독립 검증 + fallback flag 유지
- 근거: Taffy 자체가 Chrome 실측 기반 gentest fixture 로 spec 준수를 검증 — 동일 방법론 포팅 가능. Yoga(Meta) 의 flexbox subset 구현이 spec 불일치 장기 부채가 된 전례 → full spec + Chrome 실측 fixture 방식 채택. Flutter Web CanvasKit renderer (엔진 WASM + CanvasKit draw 분리) 와 동일 구조
- 위험:
  - 기술: **H** — flex.rs 자체 구현. 단 dual-run + WPT-파생 fixture 로 구간별 검증
  - 성능: L — 각 Phase 벤치 게이트
  - 유지보수: M — 이관 기간 JS/Rust 이중 경로 공존
  - 마이그레이션: M — 모듈별 fallback flag, 단계별 롤백 가능

### Risk Threshold Check

| 대안 | 기술 | 성능 | 유지보수 | 마이그레이션 | HIGH+ 개수 |
| ---- | ---- | ---- | -------- | ------------ | :--------: |
| A    | L    | H    | M        | L            |     1      |
| B    | L    | M    | M        | L            |     0      |
| C    | C    | L    | H        | C            |  3 (C×2)   |
| D    | H    | L    | M        | M            |     1      |

루프 판정: C 에 CRITICAL 2건 → 근본적으로 다른 접근 필요 → 대안 D (단계적 + 게이트) 추가로 해소. D 의 잔존 HIGH 1건 (기술 — flex 자체 구현) 은 G2 dual-run 게이트로 관리하며 수용. B 는 HIGH 0 이지만 본 ADR 의 목표 (외부 라이브러리 래핑 제거 + 단일 엔진) 를 달성하지 못함.

## Decision

**대안 D: 단계적 단일 엔진 통합**을 선택한다.

선택 근거:

1. **위험 수용 근거**: 유일한 HIGH (flex.rs 자체 구현) 는 Taffy 와의 dual-run 비교 + Chrome 실측 fixture 로 이관 전 구간에서 검증된다. Taffy fallback flag 가 G2 통과까지 유지되므로 실패 시 손실은 신규 코드 폐기로 한정
2. Phase 0 은 이미 존재하는 인프라 코드의 **배선(엔진 주입 + batch API 정합 + scheduler 소비 배선) + flag 활성화** 로 JSON dirty 검출 제거 + block/grid 가속 경로 worker offload 를 획득 (flag 단독 전환 무효 — 실사 근거는 breakdown Phase 0 참조) — 후속 Phase 의 성능 기준선 측정 확보
3. 최종 상태 (JS ~15,000줄 UI 바인딩 + 단일 WASM batch API + CanvasKit draw) 는 Figma / Flutter Web 에서 검증된 아키텍처

기각 사유:

- **대안 A 기각**: 노드당 ~5회 WASM 경계 횡단은 JS 측 최적화로 구조적으로 해소 불가 — 성능 HIGH 잔존
- **대안 B 기각**: Taffy 외부 종속 영구화 — 본 ADR 의 문제 정의 (외부 라이브러리 래핑 제거) 자체를 미해결. 단, B 의 실행 내용은 D 의 Phase 0 으로 흡수됨
- **대안 C 기각**: CRITICAL 2건 (중간 검증 지점 없는 spec 전체 구현 + 전면 롤백 리스크). 동일 목적지를 D 가 게이트 기반으로 도달

> 구현 상세: [916-unified-rust-engine-breakdown.md](design/916-unified-rust-engine-breakdown.md)

## Risks

| ID  | 위험                                                                | 심각도 | 대응                                                                                                                                                                                                                                     |
| --- | ------------------------------------------------------------------- | :----: | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| R1  | flex.rs 자체 구현의 CSS spec 결함 (Taffy WPT-파생 테스트 자산 상실) |  HIGH  | G2 dual-run diff + Chrome gentest 방식 fixture 포팅. 통과 전 Taffy fallback 유지                                                                                                                                                         |
| R2  | 이관 기간 JS/Rust 이중 경로 drift (동일 로직 양측 수정 누락)        |  MED   | 모듈별 cutover 완료 시 JS 경로 즉시 삭제 (dormant 병행 금지)                                                                                                                                                                             |
| R3  | Rust 유지보수 버스팩터                                              |  MED   | 모듈 경계 = CSS spec 章 단위 유지, gentest fixture 가 회귀 안전망                                                                                                                                                                        |
| R4  | 대규모 생성 코드 (Fable 5 활용) 검증 부담                           |  MED   | 모듈당 fixture-first: fixture 작성 → 생성 → dual-run — 생성 코드는 fixture 통과로만 수용                                                                                                                                                 |
| R5  | WASM 번들 증가                                                      |  MED   | G4 사이즈 게이트 (gzip +300KB 이내), wasm-opt + 모듈 분리 로딩 대비                                                                                                                                                                      |
| R6  | text.rs 이관이 Layout=Canvas2D=CSS 정합 원칙 파괴                   |  MED   | canvas-rendering.md §3 규칙 승계 — **측정 경로 한정**: Paragraph 객체 캐싱 금지, 결과값만 LRU (`canvaskitTextMeasurer.ts:122`). render 경로의 관리형 Paragraph 캐시(`nodeRendererText.ts:36`) 는 2-E 비대상·현행 유지. /cross-check 필수 |
| R7  | Taffy 0.9→0.10 전환 (Phase 0-A) 자체의 layout 결과 변동             |  MED   | G1 회귀 fixture 전수 — flag 전환이라도 dual-run 검증                                                                                                                                                                                     |

## Gates

| Gate | 시점                          | 통과 조건                                                                                                | 실패 시 대안                                       |
| ---- | ----------------------------- | -------------------------------------------------------------------------------------------------------- | -------------------------------------------------- |
| G1   | Phase 0 배선 + flag 전환 직후 | 회귀 fixture 전수 PASS (HC3 2단 기준: 수치 ≤ 1px + 1x zoom 스크린샷 diff 0) + 1000노드 60fps 유지        | flag revert (즉시 롤백)                            |
| G2   | Phase 1 flex.rs 완성 시       | dual-run 수치 diff ≤ 1px + 1x zoom 스크린샷 diff 0 (전 fixture, HC3 2단 기준) + Chrome 실측 fixture PASS | Taffy fallback 유지, flex.rs 반복 수정 (제거 보류) |
| G3   | Phase 2 각 모듈 cutover       | /cross-check PASS + 1000노드 프레임타임 개선 실측 + type-check                                           | 해당 모듈 JS 경로 유지 (모듈 단위 보류)            |
| G4   | 각 Phase 빌드                 | WASM gzip +300KB 이내                                                                                    | wasm-opt 재조정 / 모듈 분리 로딩                   |
| G5   | Phase 2 착수 전               | 사용자 scope confirm (5 모듈 분할 — M4 의무) + Phase 1 실측 기반 재판정                                  | Phase 2 를 후속 ADR 로 분리                        |

## Consequences

### Positive

- WASM 경계 횡단 프레임 경로 5회 → 2회 — 직렬화 / GC 압력 구조적 제거
- JSON.stringify dirty 검출 / O(N) 변경 감지 / O(N×D) 조상 탐색 → 해시 · bitfield · 1-pass 로 대체
- 외부 라이브러리(Taffy) 버전 종속 제거 — layout 동작이 자체 fixture 로 고정, 업그레이드 리스크 소멸
- JS 렌더 파이프라인 ~64K줄 → ~15K줄 (UI 바인딩) — canvas 모듈 인지 부하 감소
- 텍스트 측정 이중 경로 (Canvas2D / CanvasKit) 불일치 문제의 구조적 해소 기반

### Negative

- flex/grid/block spec 유지 책임이 composition 으로 이전 — CSS spec 갱신 추적 의무 발생
- 이관 기간 (Phase 1~2) fallback flag 분기 유지 비용
- Rust 코드량 5,633줄 → ~12,000줄+ 추정 — 리뷰 가능 인력 제약
- 회귀 fixture / dual-run 하네스 / 벤치 하네스 신규 구축 비용 (Phase 0 선행 투자)
