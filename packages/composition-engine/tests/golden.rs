//! ADR-916 Phase 1-D — Golden fixture (native)
//!
//! 세 완결 공개 엔트리(`flex_layout` / `grid_layout` / `block_layout`)의 **전체
//! 파이프라인**을 CSS 명세 유래 기대값으로 대조 고정한다. 모듈 내부 단위 테스트가
//! 각 함수(§9.7 resolve, §7 track sizing, §8.3.1 collapse …)를 검증하는 것과 달리,
//! 본 golden 은 입력 f32 계약 → 완결 엔트리 → 물리 좌표 `[x,y,w,h,...]` 까지의
//! 통합 결과를 명세 대조값으로 회귀 고정한다.
//!
//! ## 기대값 근거 (Chrome/Taffy 실측 대신 명세 계산)
//!
//! breakdown §1-D 는 golden 생성 방식을 "Chrome 실측 → fixture 자동 생성" 으로
//! 정의하나, 그 경로는 자체 엔진의 **WASM 트리 배선(buildTreeBatch)** 을 전제한다
//! (dualRunHarness 가 트리 batch 계약을 소비). 트리 오케스트레이션은 Phase 2-B
//! tree.rs 범위(G5 사용자 confirm 필수)이므로, Phase 1 scope 를 유지한 채 검증
//! 기반을 확보하기 위해 **단일 컨테이너 단위**로 golden 을 고정한다. 기대값은
//! CSS 명세가 규정하는 정확 계산값(정수 좌표 케이스 위주 — Chrome/Taffy 도 동일
//! 산출) 이며, 각 케이스에 계산 근거를 주석으로 남긴다. 트리 dual-run golden 은
//! candidate 트리 배선이 생기는 시점(2-B)에 dualRunHarness 로 통합한다.
//!
//! ## tolerance
//!
//! HC3 (a) 수치 diff ≤ 1px (f32 sub-pixel). 정수 좌표 케이스는 실질 diff 0.

use composition_engine::block::{block_layout, FIELD_COUNT as BLOCK_FIELDS};
use composition_engine::flex::{
    flex_layout, DIR_COLUMN, DIR_ROW, FLEX_FIELD_COUNT, WRAP_NOWRAP, WRAP_WRAP,
};
use composition_engine::grid::grid_layout;

/// HC3 (a) 수치 tolerance (px) — dualRunHarness.ts `NUMERIC_TOLERANCE_PX` 와 동일.
const TOL: f32 = 1.0;

/// 출력 `[x,y,w,h,...]` 을 4-tuple 단위로 기대값과 대조. |diff| ≤ TOL 이면 통과.
fn assert_bounds(label: &str, actual: &[f32], expected: &[[f32; 4]]) {
    assert_eq!(
        actual.len(),
        expected.len() * 4,
        "{label}: 출력 길이 불일치 (got {} floats, want {} bounds)",
        actual.len(),
        expected.len()
    );
    for (i, want) in expected.iter().enumerate() {
        let got = [
            actual[i * 4],
            actual[i * 4 + 1],
            actual[i * 4 + 2],
            actual[i * 4 + 3],
        ];
        for (f, (&g, &w)) in got.iter().zip(want.iter()).enumerate() {
            let field = ["x", "y", "w", "h"][f];
            assert!(
                (g - w).abs() <= TOL,
                "{label}: child[{i}].{field} = {g} (want {w}, Δ={:.4} > {TOL}px)",
                g - w
            );
        }
    }
}

// ─────────────────────────────────────────────────────────────────────────────
// flex golden — flex_layout(data, avail_main, avail_cross, dir, justify, align,
//                            align_content, wrap, gap_main, gap_cross)
// FLEX_FIELD_COUNT=17 필드/노드. off: [basis,w,h,mt,mr,mb,ml,pb_main,pb_cross,
//   min_main,max_main,min_cross,max_cross,content_main,content_cross,grow,shrink]
// ─────────────────────────────────────────────────────────────────────────────

/// 고정 크기 3개 flex item — 두 축 각 100 width, direction=row, gap=10.
/// justify=start, align=start. 아이템 basis=100, cross content=50.
/// 기대: x = 0, 110, 220 (100 + 10 gap 누적), y=0, w=100, h=50.
fn flex_item(basis: f32, cross: f32, grow: f32, shrink: f32) -> [f32; 17] {
    [
        basis, // 0 flex_basis
        basis, // 1 width(main)
        cross, // 2 height(cross)
        0.0, 0.0, 0.0, 0.0, // 3-6 margins
        0.0, 0.0, // 7-8 pad_border main/cross
        -1.0, -1.0, -1.0, -1.0, // 9-12 min/max main·cross (AUTO/NONE)
        basis, cross, // 13-14 content main/cross
        grow, shrink, // 15-16 grow/shrink
    ]
}

#[test]
fn golden_flex_row_fixed_gap() {
    // 3 items × basis 100, gap 10, row, no grow/shrink. available_main 넉넉(1000).
    let mut data = Vec::new();
    for _ in 0..3 {
        data.extend_from_slice(&flex_item(100.0, 50.0, 0.0, 0.0));
    }
    let out = flex_layout(&data, 1000.0, 200.0, DIR_ROW, 0, 1, 0, WRAP_NOWRAP, 10.0, 0.0, true);
    // start 정렬 → 누적 offset. align=start(1) → cross y=0.
    assert_bounds(
        "flex_row_fixed_gap",
        &out,
        &[
            [0.0, 0.0, 100.0, 50.0],
            [110.0, 0.0, 100.0, 50.0],
            [220.0, 0.0, 100.0, 50.0],
        ],
    );
}

#[test]
fn golden_flex_row_grow_equal() {
    // 2 items, basis 0, grow 1 each, available_main 300, gap 0.
    // §9.7: free = 300 - 0 = 300, 균등 분배 → 각 150.
    let mut data = Vec::new();
    data.extend_from_slice(&flex_item(0.0, 50.0, 1.0, 1.0));
    data.extend_from_slice(&flex_item(0.0, 50.0, 1.0, 1.0));
    let out = flex_layout(&data, 300.0, 100.0, DIR_ROW, 0, 1, 0, WRAP_NOWRAP, 0.0, 0.0, true);
    assert_bounds(
        "flex_row_grow_equal",
        &out,
        &[[0.0, 0.0, 150.0, 50.0], [150.0, 0.0, 150.0, 50.0]],
    );
}

#[test]
fn golden_flex_row_justify_center() {
    // 2 items × 100, available 400, gap 0, justify=center(1).
    // free = 400 - 200 = 200 → 좌우 100씩 → x = 100, 200.
    let mut data = Vec::new();
    data.extend_from_slice(&flex_item(100.0, 50.0, 0.0, 0.0));
    data.extend_from_slice(&flex_item(100.0, 50.0, 0.0, 0.0));
    let out = flex_layout(&data, 400.0, 100.0, DIR_ROW, 1, 1, 0, WRAP_NOWRAP, 0.0, 0.0, true);
    assert_bounds(
        "flex_row_justify_center",
        &out,
        &[[100.0, 0.0, 100.0, 50.0], [200.0, 0.0, 100.0, 50.0]],
    );
}

#[test]
fn golden_flex_column_shrink() {
    // column, 2 items basis 100 (main=height), available_main 120, shrink 1 each.
    // §9.7: overflow = 200 - 120 = 80. scaled factor = basis×shrink = 100 each.
    // 균등 흡수 → 각 40 축소 → 60, 60. y = 0, 60.
    let mut data = Vec::new();
    data.extend_from_slice(&flex_item(100.0, 80.0, 0.0, 1.0));
    data.extend_from_slice(&flex_item(100.0, 80.0, 0.0, 1.0));
    let out = flex_layout(&data, 120.0, 200.0, DIR_COLUMN, 0, 1, 0, WRAP_NOWRAP, 0.0, 0.0, true);
    // column: main=y/height, cross=x/width. cross content=80 → w=80.
    assert_bounds(
        "flex_column_shrink",
        &out,
        &[[0.0, 0.0, 80.0, 60.0], [0.0, 60.0, 80.0, 60.0]],
    );
}

#[test]
fn golden_flex_wrap_two_lines() {
    // 3 items × 100, available_main 250, gap 0, wrap.
    // line1: item0(0-100) + item1(100-200); item2 (200-300 > 250) → line2.
    // align_content=0 은 STRETCH(CSS 기본값) 이므로, stretch 간섭 제거를 위해
    // available_cross 를 라인 합(50+50=100)에 딱 맞춘다 → cross_free 0 → stretch 무효.
    // line cross size = 50 → line2 y = 50.
    let mut data = Vec::new();
    for _ in 0..3 {
        data.extend_from_slice(&flex_item(100.0, 50.0, 0.0, 0.0));
    }
    let out = flex_layout(&data, 250.0, 100.0, DIR_ROW, 0, 1, 0, WRAP_WRAP, 0.0, 0.0, true);
    assert_bounds(
        "flex_wrap_two_lines",
        &out,
        &[
            [0.0, 0.0, 100.0, 50.0],
            [100.0, 0.0, 100.0, 50.0],
            [0.0, 50.0, 100.0, 50.0],
        ],
    );
}

// ─────────────────────────────────────────────────────────────────────────────
// grid golden — grid_layout(cols, rows, areas, placement, count, w, h, cgap, rgap)
// ─────────────────────────────────────────────────────────────────────────────

#[test]
fn golden_grid_fixed_2x2() {
    // 2×2 fixed tracks, no gap. cols "100px 100px" rows "50px 50px".
    // auto-placement row-major: (0,0)(0,1)(1,0)(1,1).
    let out = grid_layout("100px 100px", "50px 50px", "", "", 4, 200.0, 100.0, 0.0, 0.0);
    assert_bounds(
        "grid_fixed_2x2",
        &out,
        &[
            [0.0, 0.0, 100.0, 50.0],
            [100.0, 0.0, 100.0, 50.0],
            [0.0, 50.0, 100.0, 50.0],
            [100.0, 50.0, 100.0, 50.0],
        ],
    );
}

#[test]
fn golden_grid_fr_distribution() {
    // cols "1fr 1fr", available 300, col_gap 0. 각 트랙 150.
    // rows "100px". 2 children auto-placement → (0,0)(0,1).
    let out = grid_layout("1fr 1fr", "100px", "", "", 2, 300.0, 100.0, 0.0, 0.0);
    assert_bounds(
        "grid_fr_distribution",
        &out,
        &[[0.0, 0.0, 150.0, 100.0], [150.0, 0.0, 150.0, 100.0]],
    );
}

#[test]
fn golden_grid_fixed_plus_fr_with_gap() {
    // cols "100px 1fr", available 300, col_gap 20.
    // fixed 100 + gap 20 소비 → 남은 fr 공간 = 300 - 100 - 20 = 180 → 1fr=180.
    // 트랙 sizing 은 정확: [100, 180]. 명세상 x: 0, 120 (100 + gap 20).
    let out = grid_layout("100px 1fr", "50px", "", "", 2, 300.0, 50.0, 20.0, 0.0);
    assert_bounds(
        "grid_fixed_plus_fr_gap",
        &out,
        &[[0.0, 0.0, 100.0, 50.0], [120.0, 0.0, 180.0, 50.0]],
    );
}

#[test]
fn golden_grid_auto_placement_offsets_include_leading_gaps() {
    // cols "100px 1fr", rows "50px 1fr", available 300×200.
    // column gap 20, row gap 10.
    // tracks: cols [100,180], rows [50,140].
    // 2번째 column x = 100 + 20 = 120, 2번째 row y = 50 + 10 = 60.
    let out = grid_layout("100px 1fr", "50px 1fr", "", "", 4, 300.0, 200.0, 20.0, 10.0);
    assert_bounds(
        "grid_auto_placement_offsets_include_leading_gaps",
        &out,
        &[
            [0.0, 0.0, 100.0, 50.0],
            [120.0, 0.0, 180.0, 50.0],
            [0.0, 60.0, 100.0, 140.0],
            [120.0, 60.0, 180.0, 140.0],
        ],
    );
}

#[test]
fn golden_grid_minmax_fr_max() {
    // cols "minmax(50px, 1fr) minmax(50px, 1fr)", available 300, gap 0.
    // 각 min 50, max=1fr. fr 풀 = 300 → 각 150 (≥min 50). 트랙 [150,150].
    let out = grid_layout(
        "minmax(50px, 1fr) minmax(50px, 1fr)",
        "80px",
        "",
        "",
        2,
        300.0,
        80.0,
        0.0,
        0.0,
    );
    assert_bounds(
        "grid_minmax_fr_max",
        &out,
        &[[0.0, 0.0, 150.0, 80.0], [150.0, 0.0, 150.0, 80.0]],
    );
}

#[test]
fn golden_grid_named_areas() {
    // grid-template-areas: "header header" "sidebar main"
    // cols "100px 200px" rows "40px 100px".
    // 자식 2개: placement_spec 으로 area 지정. header 는 col1-2(전폭), main 은 col2/row2.
    // placement 형식: 자식당 "area_name|grid_column|grid_row" 개행 구분.
    let placement = "header||\nmain||";
    let out = grid_layout(
        "100px 200px",
        "40px 100px",
        "\"header header\" \"sidebar main\"",
        placement,
        2,
        300.0,
        140.0,
        0.0,
        0.0,
    );
    // header: col 1..3 (0..300 width=300), row 1 (y=0, h=40).
    // main: col 2 (x=100, w=200), row 2 (y=40, h=100).
    assert_bounds(
        "grid_named_areas",
        &out,
        &[[0.0, 0.0, 300.0, 40.0], [100.0, 40.0, 200.0, 100.0]],
    );
}

// ─────────────────────────────────────────────────────────────────────────────
// block golden — block_layout(data, avail_w, avail_h, collapse_top, collapse_bot,
//                             prev_sibling_margin_bottom)
// FIELD_COUNT=19: [display,w,h,mt,mr,mb,ml,bfc,pb_v,pb_h,min_w,max_w,min_h,max_h,
//   content_w,content_h,valign,baseline,line_height]
// 출력: 자식당 [x,y,w,h] + 후행 2값 [firstChildMarginTop, lastChildMarginBottom]
// ─────────────────────────────────────────────────────────────────────────────

fn block_child(w: f32, h: f32, mt: f32, mb: f32) -> [f32; 19] {
    [
        0.0, // display = block
        w,   // width
        h,   // height
        mt, 0.0, mb, 0.0, // margins (top,right,bottom,left)
        0.0, // bfc flag
        0.0, 0.0, // pad_border v/h
        -1.0, -1.0, -1.0, -1.0, // min/max w/h (AUTO)
        w, h, // content w/h
        0.0, 0.0, -1.0, // valign, baseline, line_height(AUTO)
    ]
}

#[test]
fn golden_block_vertical_stack() {
    // 3 blocks, no margins, w=200 h=50 each. available_w 400.
    // vertical stacking: y = 0, 50, 100. block width=explicit 200.
    let mut data = Vec::new();
    for _ in 0..3 {
        data.extend_from_slice(&block_child(200.0, 50.0, 0.0, 0.0));
    }
    let out = block_layout(&data, 400.0, 1000.0, false, false, 0.0);
    // 후행 2값 제외하고 3 children 만 대조.
    let bounds = &out[..12];
    assert_bounds(
        "block_vertical_stack",
        bounds,
        &[
            [0.0, 0.0, 200.0, 50.0],
            [0.0, 50.0, 200.0, 50.0],
            [0.0, 100.0, 200.0, 50.0],
        ],
    );
}

#[test]
fn golden_block_margin_collapse() {
    // 2 blocks, block0 margin-bottom 30, block1 margin-top 20.
    // §8.3.1: 인접 margin collapse → max(30,20)=30 (둘 다 양수).
    // block0 y=0 h=50, block1 y = 50 + 30 = 80.
    let mut data = Vec::new();
    data.extend_from_slice(&block_child(200.0, 50.0, 0.0, 30.0));
    data.extend_from_slice(&block_child(200.0, 50.0, 20.0, 0.0));
    let out = block_layout(&data, 400.0, 1000.0, false, false, 0.0);
    let bounds = &out[..8];
    assert_bounds(
        "block_margin_collapse",
        bounds,
        &[[0.0, 0.0, 200.0, 50.0], [0.0, 80.0, 200.0, 50.0]],
    );
}

#[test]
fn golden_block_negative_margin_collapse() {
    // block0 margin-bottom 40, block1 margin-top -10.
    // §8.3.1 혼합 부호: 40 + (-10) = 30. block1 y = 50 + 30 = 80.
    let mut data = Vec::new();
    data.extend_from_slice(&block_child(100.0, 50.0, 0.0, 40.0));
    data.extend_from_slice(&block_child(100.0, 50.0, -10.0, 0.0));
    let out = block_layout(&data, 400.0, 1000.0, false, false, 0.0);
    let bounds = &out[..8];
    assert_bounds(
        "block_negative_margin_collapse",
        bounds,
        &[[0.0, 0.0, 100.0, 50.0], [0.0, 80.0, 100.0, 50.0]],
    );
}

/// 필드 계약 상수가 golden 작성 가정과 일치하는지 정적 확증
/// (계약 변경 시 golden 이 silent 하게 어긋나지 않도록 가드).
#[test]
fn golden_field_contract_guard() {
    assert_eq!(FLEX_FIELD_COUNT, 17, "flex 필드 계약 변경 — golden 재작성 필요");
    assert_eq!(BLOCK_FIELDS, 19, "block 필드 계약 변경 — golden 재작성 필요");
}
