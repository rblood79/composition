//! ADR-916 Phase 1-A — CSS Flexbox 레이아웃 (CSS-FLEXBOX-1) 자체 구현
//!
//! Taffy 를 대체하는 자체 flex solver. 입력은 `block_layout.rs` 와 동일한
//! **flat f32 배열 + 센티넬** 계약을 따른다 (사전 해석된 숫자 — 스타일 파싱은
//! 상류 style 계층 책임). dual-run 하네스(`dualRunHarness.ts`)가 이 solver 결과를
//! Taffy 결과와 HC3 2단 비교하여 CSS 명세 준수를 검증한다.
//!
//! ## 구현 범위 (2026-07-03 세션 — 단일축 기본)
//!
//! - **구현**: main-axis(row/column) 단일 라인 배치, fixed-size / auto-size 아이템,
//!   `justify-content`(flex-start/center/flex-end/space-between/space-around/space-evenly),
//!   `align-items`(stretch/flex-start/center/flex-end), gap, main-axis 여유 공간 분배 없음.
//! - **미구현 (다음 세션)**: `flex-grow`/`flex-shrink` 여유·부족 분배(§9.7),
//!   `flex-wrap`(multi-line §9.3), `align-content`, `flex-basis: content` intrinsic,
//!   `aspect-ratio`, nested BFC. 이 항목들이 있는 입력은 현재 근사(고정 크기) 처리 →
//!   dual-run 에서 FAIL 로 드러나며, 그것이 다음 세션 구현 대상의 fixture 가 된다.
//!
//! ## 필드 계약 (`FLEX_FIELD_COUNT` = 16, 노드당)
//!
//! | off | 필드              | 센티넬                    |
//! | --- | ----------------- | ------------------------- |
//! | 0   | flex_basis        | AUTO=-1, CONTENT=-2       |
//! | 1   | width             | AUTO=-1                   |
//! | 2   | height            | AUTO=-1                   |
//! | 3   | margin_top        |                           |
//! | 4   | margin_right      |                           |
//! | 5   | margin_bottom     |                           |
//! | 6   | margin_left       |                           |
//! | 7   | pad_border_main   | main 축 padding+border 합 |
//! | 8   | pad_border_cross  | cross 축 padding+border 합|
//! | 9   | min_main          | AUTO=-1                   |
//! | 10  | max_main          | NONE=-1                   |
//! | 11  | min_cross         | AUTO=-1                   |
//! | 12  | max_cross         | NONE=-1                   |
//! | 13  | content_main      | content 크기 (main)       |
//! | 14  | content_cross     | content 크기 (cross)      |
//! | 15  | flex_grow_shrink  | grow*1000 + shrink (packed, 미소비 예약) |
//!
//! main/cross 축은 컨테이너 `flex_direction` 에 따라 물리축(x/y)에 매핑된다.
//! 아이템 필드는 이미 논리축(main/cross) 기준으로 상류에서 변환되어 들어온다.

use wasm_bindgen::prelude::*;

/// 노드당 입력 필드 수.
pub const FLEX_FIELD_COUNT: usize = 16;

/// 출력 필드 수 (x, y, width, height).
const OUT_FIELDS: usize = 4;

/// auto / none 센티넬.
const AUTO: f32 = -1.0;
/// flex-basis: content 센티넬.
#[allow(dead_code)]
const CONTENT: f32 = -2.0;

// flex_direction (컨테이너 파라미터)
/// row — main 축 = x
pub const DIR_ROW: u8 = 0;
/// column — main 축 = y
pub const DIR_COLUMN: u8 = 1;

// justify_content (main 축 정렬). START 는 default 분기(`_`)로 처리 — 명세 문서화용 상수.
#[allow(dead_code)]
const JUSTIFY_START: u8 = 0;
const JUSTIFY_CENTER: u8 = 1;
const JUSTIFY_END: u8 = 2;
const JUSTIFY_SPACE_BETWEEN: u8 = 3;
const JUSTIFY_SPACE_AROUND: u8 = 4;
const JUSTIFY_SPACE_EVENLY: u8 = 5;

// align_items (cross 축 정렬). START 는 default 분기(`_`)로 처리 — 명세 문서화용 상수.
const ALIGN_STRETCH: u8 = 0;
#[allow(dead_code)]
const ALIGN_START: u8 = 1;
const ALIGN_CENTER: u8 = 2;
const ALIGN_END: u8 = 3;

/// min/max clamp (block_layout.rs 승계 — 유일한 공용 primitive).
/// max=AUTO(-1) 은 제약 없음(무한대)으로 취급.
fn clamp_size(value: f32, min_val: f32, max_val: f32) -> f32 {
    let mut v = value;
    if max_val != AUTO && v > max_val {
        v = max_val;
    }
    if min_val != AUTO && v < min_val {
        v = min_val;
    }
    v
}

/// 논리 main/cross 크기를 물리 (x,y,w,h) 로 역매핑.
/// row 면 main=x축(width)/cross=y축(height), column 이면 반대.
fn write_physical(
    out: &mut [f32],
    out_off: usize,
    direction: u8,
    main_pos: f32,
    cross_pos: f32,
    main_size: f32,
    cross_size: f32,
) {
    if direction == DIR_ROW {
        out[out_off] = main_pos; // x
        out[out_off + 1] = cross_pos; // y
        out[out_off + 2] = main_size; // width
        out[out_off + 3] = cross_size; // height
    } else {
        out[out_off] = cross_pos; // x
        out[out_off + 1] = main_pos; // y
        out[out_off + 2] = cross_size; // width
        out[out_off + 3] = main_size; // height
    }
}

/// 아이템 하나의 main-axis outer 크기 (margin 포함).
struct FlexItem {
    /// content-box 를 포함한 border-box main 크기
    main_size: f32,
    /// border-box cross 크기
    cross_size: f32,
    margin_main_start: f32,
    margin_main_end: f32,
    margin_cross_start: f32,
    margin_cross_end: f32,
    min_cross: f32,
    max_cross: f32,
}

/// 단일 라인 flex 레이아웃 (no-wrap, no grow/shrink 분배).
///
/// # Arguments
/// * `data` — 노드당 `FLEX_FIELD_COUNT` f32 (논리 main/cross 기준)
/// * `available_main` — 컨테이너 content-box main 크기
/// * `available_cross` — 컨테이너 content-box cross 크기
/// * `direction` — `DIR_ROW` | `DIR_COLUMN`
/// * `justify_content` — main 축 정렬 코드
/// * `align_items` — cross 축 정렬 코드
/// * `gap_main` — main 축 gap
///
/// # Returns
/// `[x, y, w, h, ...]` 물리 좌표 (컨테이너 content-box 원점 기준).
#[wasm_bindgen]
#[allow(clippy::too_many_arguments)]
pub fn flex_layout_single_line(
    data: &[f32],
    available_main: f32,
    available_cross: f32,
    direction: u8,
    justify_content: u8,
    align_items: u8,
    gap_main: f32,
) -> Box<[f32]> {
    let count = data.len() / FLEX_FIELD_COUNT;
    if count == 0 {
        return vec![].into_boxed_slice();
    }

    // ── 1단계: 각 아이템의 hypothetical main/cross 크기 결정 ──
    // (flex-basis / width / content 해석. grow/shrink 미적용 = hypothetical 이 곧 최종)
    let mut items: Vec<FlexItem> = Vec::with_capacity(count);
    for i in 0..count {
        let off = i * FLEX_FIELD_COUNT;
        let flex_basis = data[off];
        let width = data[off + 1];
        let height = data[off + 2];
        let m_top = data[off + 3];
        let m_right = data[off + 4];
        let m_bottom = data[off + 5];
        let m_left = data[off + 6];
        let pad_border_main = data[off + 7];
        let pad_border_cross = data[off + 8];
        let min_main = data[off + 9];
        let max_main = data[off + 10];
        let min_cross = data[off + 11];
        let max_cross = data[off + 12];
        let content_main = data[off + 13];
        let content_cross = data[off + 14];

        // main-axis 논리 크기: main 은 direction 축, width/height 는 물리축이므로
        // 상류에서 논리축 변환된 값을 flex_basis/width 에 담아 보낸다.
        // (이 세션 계약: flex_basis 우선, 없으면 width(=논리 main), 없으면 content)
        let main_definite = if flex_basis != AUTO && flex_basis != CONTENT {
            flex_basis
        } else if width != AUTO {
            width
        } else {
            content_main
        };
        let main_content = clamp_size(main_definite, min_main, max_main);
        let main_size = main_content + pad_border_main;

        // cross-axis: height(논리 cross) 명시 시 사용, 없으면 content.
        // stretch 는 배치 단계에서 처리.
        let cross_content = if height != AUTO {
            clamp_size(height, min_cross, max_cross)
        } else {
            clamp_size(content_cross, min_cross, max_cross)
        };
        let cross_size = cross_content + pad_border_cross;

        // main/cross margin 을 direction 에 맞춰 논리 매핑.
        // row: main = left/right, cross = top/bottom
        // column: main = top/bottom, cross = left/right
        let (mm_start, mm_end, mc_start, mc_end) = if direction == DIR_ROW {
            (m_left, m_right, m_top, m_bottom)
        } else {
            (m_top, m_bottom, m_left, m_right)
        };

        items.push(FlexItem {
            main_size,
            cross_size,
            margin_main_start: mm_start,
            margin_main_end: mm_end,
            margin_cross_start: mc_start,
            margin_cross_end: mc_end,
            min_cross,
            max_cross,
        });
    }

    // ── 2단계: main 축 총 점유 + 여유 공간 ──
    let total_gap = if count > 1 {
        gap_main * (count as f32 - 1.0)
    } else {
        0.0
    };
    let total_main: f32 = items
        .iter()
        .map(|it| it.main_size + it.margin_main_start + it.margin_main_end)
        .sum::<f32>()
        + total_gap;
    let free_main = (available_main - total_main).max(0.0);

    // ── 3단계: justify-content — main 시작 offset + 아이템 간격 ──
    let (start_offset, between_extra) = match justify_content {
        JUSTIFY_CENTER => (free_main / 2.0, 0.0),
        JUSTIFY_END => (free_main, 0.0),
        JUSTIFY_SPACE_BETWEEN => {
            if count > 1 {
                (0.0, free_main / (count as f32 - 1.0))
            } else {
                (0.0, 0.0)
            }
        }
        JUSTIFY_SPACE_AROUND => {
            let unit = free_main / count as f32;
            (unit / 2.0, unit)
        }
        JUSTIFY_SPACE_EVENLY => {
            let unit = free_main / (count as f32 + 1.0);
            (unit, unit)
        }
        // JUSTIFY_START (default)
        _ => (0.0, 0.0),
    };

    // ── 4단계: 배치 ──
    let mut out = vec![0.0f32; count * OUT_FIELDS];
    let mut main_cursor = start_offset;

    for (i, it) in items.iter().enumerate() {
        let out_off = i * OUT_FIELDS;

        // main 위치 (margin start 포함)
        main_cursor += it.margin_main_start;
        let main_pos = main_cursor;

        // cross 위치/크기 — align-items
        let cross_free = available_cross - it.cross_size - it.margin_cross_start - it.margin_cross_end;
        let (cross_pos, cross_final) = match align_items {
            ALIGN_STRETCH => {
                // stretch: cross 크기 명시 없으면 available 채움 (min/max clamp)
                let stretched = clamp_size(
                    available_cross - it.margin_cross_start - it.margin_cross_end,
                    it.min_cross,
                    it.max_cross,
                );
                (it.margin_cross_start, stretched)
            }
            ALIGN_CENTER => (it.margin_cross_start + cross_free / 2.0, it.cross_size),
            ALIGN_END => (it.margin_cross_start + cross_free, it.cross_size),
            // ALIGN_START (default)
            _ => (it.margin_cross_start, it.cross_size),
        };

        write_physical(
            &mut out,
            out_off,
            direction,
            main_pos,
            cross_pos,
            it.main_size,
            cross_final,
        );

        // 다음 아이템으로 커서 이동
        main_cursor += it.main_size + it.margin_main_end;
        if i + 1 < count {
            main_cursor += gap_main + between_extra;
        }
    }

    out.into_boxed_slice()
}

#[cfg(test)]
mod tests {
    use super::*;

    /// 노드 하나 필드를 배열에 채우는 헬퍼. 미지정 필드는 센티넬/0.
    fn item(width: f32, height: f32) -> [f32; FLEX_FIELD_COUNT] {
        let mut f = [0.0f32; FLEX_FIELD_COUNT];
        f[0] = AUTO; // flex_basis
        f[1] = width; // width (논리 main)
        f[2] = height; // height (논리 cross)
        f[9] = AUTO; // min_main
        f[10] = AUTO; // max_main
        f[11] = AUTO; // min_cross
        f[12] = AUTO; // max_cross
        f
    }

    fn flatten(items: &[[f32; FLEX_FIELD_COUNT]]) -> Vec<f32> {
        items.iter().flatten().copied().collect()
    }

    #[test]
    fn row_fixed_items_justify_start() {
        // 3개 50px 아이템, gap 10, row, justify-start
        let data = flatten(&[item(50.0, 20.0), item(50.0, 20.0), item(50.0, 20.0)]);
        let out = flex_layout_single_line(&data, 300.0, 100.0, DIR_ROW, JUSTIFY_START, ALIGN_START, 10.0);
        // x: 0, 60, 120
        assert_eq!(out[0], 0.0);
        assert_eq!(out[4], 60.0);
        assert_eq!(out[8], 120.0);
        // y=0 (align-start), w=50, h=20
        assert_eq!(out[1], 0.0);
        assert_eq!(out[2], 50.0);
        assert_eq!(out[3], 20.0);
    }

    #[test]
    fn row_justify_center() {
        // 2개 50px, gap 0, available 200 → free=100, center → start_offset=50
        let data = flatten(&[item(50.0, 20.0), item(50.0, 20.0)]);
        let out = flex_layout_single_line(&data, 200.0, 100.0, DIR_ROW, JUSTIFY_CENTER, ALIGN_START, 0.0);
        assert_eq!(out[0], 50.0); // 첫 아이템 x = 50
        assert_eq!(out[4], 100.0); // 두 번째 = 50 + 50
    }

    #[test]
    fn row_justify_space_between() {
        // 2개 50px, available 200 → free=100, space-between → between_extra=100
        let data = flatten(&[item(50.0, 20.0), item(50.0, 20.0)]);
        let out = flex_layout_single_line(&data, 200.0, 100.0, DIR_ROW, JUSTIFY_SPACE_BETWEEN, ALIGN_START, 0.0);
        assert_eq!(out[0], 0.0); // 첫 = 0
        assert_eq!(out[4], 150.0); // 두 번째 = 50 + 100(between)
    }

    #[test]
    fn column_direction_maps_main_to_y() {
        // column: main=y. 2개 height 30, gap 5
        let data = flatten(&[item(40.0, 30.0), item(40.0, 30.0)]);
        // column 이면 논리 main = height, 논리 cross = width.
        // item() 은 width→논리main(f[1]), height→논리cross(f[2]) 로 채우므로
        // column 테스트는 main=width 필드(f[1]=40)가 y 크기가 됨.
        let out = flex_layout_single_line(&data, 200.0, 100.0, DIR_COLUMN, JUSTIFY_START, ALIGN_START, 5.0);
        // main(y): 0, 45(40+5)
        assert_eq!(out[1], 0.0); // 첫 y
        assert_eq!(out[5], 45.0); // 두 번째 y = 40 + 5
        // cross(x) = height 필드(30) → width 로 매핑
        assert_eq!(out[2], 30.0); // width = 논리 cross(height=30)
        assert_eq!(out[3], 40.0); // height = 논리 main(width=40)
    }

    #[test]
    fn align_center_cross() {
        // available_cross 100, item cross 20 → free 80, center → cross_pos 40
        let data = flatten(&[item(50.0, 20.0)]);
        let out = flex_layout_single_line(&data, 300.0, 100.0, DIR_ROW, JUSTIFY_START, ALIGN_CENTER, 0.0);
        assert_eq!(out[1], 40.0); // y = (100-20)/2
    }

    #[test]
    fn align_stretch_fills_cross() {
        // height AUTO 면 stretch 시 available_cross 채움
        let mut f = item(50.0, AUTO);
        f[2] = AUTO; // height auto
        let data = flatten(&[f]);
        let out = flex_layout_single_line(&data, 300.0, 100.0, DIR_ROW, JUSTIFY_START, ALIGN_STRETCH, 0.0);
        assert_eq!(out[3], 100.0); // height stretched to available_cross
    }

    #[test]
    fn empty_input_returns_empty() {
        let out = flex_layout_single_line(&[], 300.0, 100.0, DIR_ROW, JUSTIFY_START, ALIGN_START, 0.0);
        assert_eq!(out.len(), 0);
    }

    #[test]
    fn clamp_respects_max_cross() {
        // stretch 이지만 max_cross=30 → 30 으로 clamp
        let mut f = item(50.0, AUTO);
        f[2] = AUTO;
        f[12] = 30.0; // max_cross
        let data = flatten(&[f]);
        let out = flex_layout_single_line(&data, 300.0, 100.0, DIR_ROW, JUSTIFY_START, ALIGN_STRETCH, 0.0);
        assert_eq!(out[3], 30.0);
    }
}
