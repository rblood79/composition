//! ADR-916 Phase 1-C — CSS Block 레이아웃 (CSS 2.1 §8, §9.4.1 BFC / §8.3.1 margin collapse)
//!
//! Taffy 를 대체하는 자체 block solver. 기존 `apps/builder/.../wasm/src/block_layout.rs`
//! (625줄, unit test 17) 를 **입력 계약(FIELD_COUNT=19) 그대로 승계 이식**한 것.
//! 원본은 runtime 미가동(layoutWorker 전용, LAYOUT_WORKER=false) 이었으나 검증된
//! margin collapse / inline-block line box / fit-content 커널이므로 재작성 대신 이식하여
//! WPT-파생 검증 자산 상실(Soft Constraint) 을 회피한다.
//!
//! ## 입력 계약 (`FIELD_COUNT` = 19, 노드당)
//!
//! 사전 해석된 flat f32 배열 + AUTO(-1)/FIT_CONTENT(-2) 센티넬. flex.rs 와 별도 계약이며
//! (block 은 vertical-align/baseline/BFC flag 등 고유 필드 보유), 계약 통일은 Phase 2-B
//! tree.rs 통합 시점에 결정한다 (지금 통일하면 dormant — no-dormant-foundation-ahead-of-flip).
//!
//! | off | 필드            | 비고                                |
//! | --- | --------------- | ----------------------------------- |
//! | 0   | display         | 0=block 1=inline-block 2=empty-block|
//! | 1   | width           | AUTO=-1, FIT_CONTENT=-2             |
//! | 2   | height          | AUTO=-1, FIT_CONTENT=-2             |
//! | 3-6 | margin t/r/b/l  |                                     |
//! | 7   | bfc_flag        | 1 = BFC 생성 (margin collapse 차단) |
//! | 8   | pad_border_v    | padding_v + border_v 합             |
//! | 9   | pad_border_h    | padding_h + border_h 합             |
//! | 10-13| min_w/max_w/min_h/max_h | AUTO=-1                     |
//! | 14  | content_w       | intrinsic content 폭                |
//! | 15  | content_h       | intrinsic content 높이              |
//! | 16  | vertical_align  | 0=baseline 1=top 2=middle 3=bottom  |
//! | 17  | baseline        | border-box top 기준. **<0 = 원천 없음** → border-box bottom(child_h) 폴백 (ADR-923 P2, §10.8.1) |
//! | 18  | line_height     | AUTO=-1                             |
//!
//! ## 미구현 (다음 세션 — dual-run FAIL 이 fixture)
//!
//! float / clear, writing-mode, 명시적 BFC 내부 다단(column) 등은 미대상. block 은
//! 현행 catalog 컨테이너가 사용하는 vertical stacking + inline-block line box 범위로 한정.

use wasm_bindgen::prelude::*;

/// Block layout field count per child element.
pub const FIELD_COUNT: usize = 19;

/// Output fields per child: x, y, width, height
const OUT_FIELDS: usize = 4;

// Display types
#[allow(dead_code)]
const DISPLAY_BLOCK: u8 = 0;
const DISPLAY_INLINE_BLOCK: u8 = 1;
const DISPLAY_EMPTY_BLOCK: u8 = 2; // pre-classified empty block

// Vertical align
const VALIGN_BASELINE: u8 = 0;
const VALIGN_TOP: u8 = 1;
const VALIGN_MIDDLE: u8 = 2;
const VALIGN_BOTTOM: u8 = 3;

/// Sentinel for "auto" (no explicit value)
const AUTO: f32 = -1.0;

/// Sentinel for "fit-content" (use content intrinsic size)
const FIT_CONTENT: f32 = -2.0;

/// CSS margin collapse (CSS 2.1 §8.3.1). `tree.rs` 가 부모-자식 상쇄 chain 전파
/// (hoisted margin ↔ 자기 style margin)에서 재사용하므로 pub (E3/ADR-156 P4).
#[inline]
pub fn collapse_margins(a: f32, b: f32) -> f32 {
    if a >= 0.0 && b >= 0.0 {
        a.max(b)
    } else if a < 0.0 && b < 0.0 {
        a.min(b)
    } else {
        a + b
    }
}

/// Clamp a size value between min and max (AUTO = no limit)
#[inline]
fn clamp_size(value: f32, min_val: f32, max_val: f32) -> f32 {
    let mut result = value;
    if min_val != AUTO {
        result = result.max(min_val);
    }
    if max_val != AUTO {
        result = result.min(max_val);
    }
    result
}

/// Inline-block item in a line box (temporary storage during calculation)
struct LineItem {
    /// Index into output array
    out_index: usize,
    x: f32,
    #[allow(dead_code)]
    width: f32,
    height: f32,
    margin_top: f32,
    margin_bottom: f32,
    vertical_align: u8,
    baseline: f32,
    line_height: f32,
}

/// Calculate block layout for pre-processed children.
///
/// # Arguments
/// * `data` - Flat Float32Array with FIELD_COUNT fields per child
/// * `available_width` - Parent's available content width
/// * `available_height` - Parent's available content height
/// * `can_collapse_top` - Whether first child can collapse with parent top
/// * `can_collapse_bottom` - Whether last child can collapse with parent bottom
/// * `prev_sibling_margin_bottom` - Previous sibling's margin bottom (context)
///
/// # Returns
/// Float32Array: [x, y, w, h, ...] for each child, plus 3 trailing values:
/// [firstChildMarginTop, lastChildMarginBottom, lastLineBaseline]
/// (lastLineBaseline: 마지막 line box 의 baseline — content-box y, line box 없으면
/// AUTO=-1. ADR-923 Phase 2 — 컨테이너 baseline 출력의 정확값 원천.)
#[wasm_bindgen]
pub fn block_layout(
    data: &[f32],
    available_width: f32,
    available_height: f32,
    can_collapse_top: bool,
    can_collapse_bottom: bool,
    prev_sibling_margin_bottom: f32,
) -> Box<[f32]> {
    let _ = available_height; // reserved for future use
    let child_count = data.len() / FIELD_COUNT;
    if child_count == 0 {
        return vec![0.0, 0.0].into_boxed_slice();
    }

    // Output: 4 values per child + 3 trailing metadata (ADR-923 P2: +lastLineBaseline)
    let mut out = vec![0.0f32; child_count * OUT_FIELDS + 3];

    let mut current_y: f32 = 0.0;
    let mut current_x: f32 = 0.0;
    let mut prev_margin_bottom = prev_sibling_margin_bottom;
    let mut first_child_margin_top: f32 = 0.0;
    let mut last_child_margin_bottom: f32 = 0.0;
    let mut is_first_block = true;

    // LineBox accumulator for inline-block elements
    let mut line_items: Vec<LineItem> = Vec::new();
    // 마지막으로 flush 된 line box 의 baseline (content-box y). line box 없으면 AUTO.
    let mut last_line_baseline: f32 = AUTO;

    for i in 0..child_count {
        let off = i * FIELD_COUNT;
        let display = data[off] as u8;
        let width_val = data[off + 1]; // AUTO = -1
        let height_val = data[off + 2]; // AUTO = -1
        let m_top = data[off + 3];
        let m_right = data[off + 4];
        let m_bottom = data[off + 5];
        let m_left = data[off + 6];
        let bfc_flag = data[off + 7] as u8; // 1 = creates BFC
        let pad_border_v = data[off + 8]; // padding_v + border_v combined
        let pad_border_h = data[off + 9]; // padding_h + border_h combined
        let min_w = data[off + 10];
        let max_w = data[off + 11];
        let min_h = data[off + 12];
        let max_h = data[off + 13];
        let content_w = data[off + 14];
        let content_h = data[off + 15];
        let vertical_align = data[off + 16] as u8;
        let baseline = data[off + 17];
        let line_height = data[off + 18]; // AUTO = -1

        let child_creates_bfc = bfc_flag == 1;
        let out_off = i * OUT_FIELDS;

        if display == DISPLAY_INLINE_BLOCK {
            // Inline-block: accumulate into line box
            // fit-content behaves same as auto for inline-block (use content size)
            let child_content_w = clamp_size(
                if width_val != AUTO && width_val != FIT_CONTENT { width_val } else { content_w },
                min_w, max_w,
            );
            let child_content_h = clamp_size(
                if height_val != AUTO && height_val != FIT_CONTENT { height_val } else { content_h },
                min_h, max_h,
            );
            let child_w = child_content_w + pad_border_h;
            let child_h = child_content_h + pad_border_v;
            let total_width = child_w + m_left + m_right;

            // ADR-923 Phase 2: baseline <0 = 원천 없음 → border-box bottom(child_h) 폴백
            // (CSS 2.1 §10.8.1 — in-flow line box 없는 inline-block 의 baseline).
            let baseline = if baseline >= 0.0 { baseline } else { child_h };

            // Line wrap check
            if current_x + total_width > available_width && current_x > 0.0 {
                let lb = flush_line_box(&line_items, current_y, &mut out);
                last_line_baseline = current_y + lb;
                current_y += calculate_line_box_height(&line_items);
                current_x = 0.0;
                line_items.clear();
            }

            line_items.push(LineItem {
                out_index: out_off,
                x: current_x + m_left,
                width: child_w,
                height: child_h,
                margin_top: m_top,
                margin_bottom: m_bottom,
                vertical_align,
                baseline,
                line_height,
            });

            // Write width/height (x/y will be set by flush_line_box)
            out[out_off + 2] = child_w;
            out[out_off + 3] = child_h;

            current_x += total_width;
            prev_margin_bottom = 0.0;
            is_first_block = false;
        } else if display == DISPLAY_EMPTY_BLOCK {
            // Empty block: self-collapse top/bottom margins
            if !line_items.is_empty() {
                let lbh = calculate_line_box_height(&line_items);
                let lb = flush_line_box(&line_items, current_y, &mut out);
                last_line_baseline = current_y + lb;
                current_y += lbh;
                current_x = 0.0;
                line_items.clear();
            }

            // Empty block: 자기 top/bottom margin 을 self-collapse 한 뒤, 인접한
            // 이전 margin 과 through-collapse (CSS 2.1 §8.3.1 — 인접 margin 은 모두
            // 하나로 collapse). prev_margin_bottom 을 덮어쓰지 않고 누적 collapse 하여
            // 앞선 sibling 의 margin 이 chain 을 관통하도록 보존한다.
            let collapsed_self = collapse_margins(m_top, m_bottom);
            let through = collapse_margins(prev_margin_bottom, collapsed_self);

            out[out_off] = m_left;
            out[out_off + 1] = current_y + through;
            out[out_off + 2] = available_width - m_left - m_right;
            out[out_off + 3] = 0.0;

            if is_first_block && can_collapse_top {
                first_child_margin_top = collapse_margins(first_child_margin_top, through);
            }
            last_child_margin_bottom = through;
            prev_margin_bottom = through;
        } else {
            // Block: vertical stacking + margin collapse
            if !line_items.is_empty() {
                let lbh = calculate_line_box_height(&line_items);
                let lb = flush_line_box(&line_items, current_y, &mut out);
                last_line_baseline = current_y + lb;
                current_y += lbh;
                current_x = 0.0;
                line_items.clear();
            }

            if is_first_block {
                if can_collapse_top && !child_creates_bfc {
                    first_child_margin_top = m_top;
                    prev_margin_bottom = 0.0;
                }
                is_first_block = false;
            }

            let collapsed_margin_top = if child_creates_bfc {
                prev_margin_bottom + m_top
            } else {
                collapse_margins(prev_margin_bottom, m_top)
            };
            current_y += collapsed_margin_top;

            // Block width
            // fit-content: use content intrinsic width (shrink-to-fit)
            let child_content_w = clamp_size(
                if width_val == FIT_CONTENT {
                    content_w                               // fit-content: content size
                } else if width_val != AUTO {
                    width_val                               // explicit px
                } else {
                    available_width - m_left - m_right      // auto: stretch to parent
                },
                min_w, max_w,
            );
            let child_content_h = clamp_size(
                if height_val != AUTO && height_val != FIT_CONTENT { height_val } else { content_h },
                min_h, max_h,
            );

            // Auto-width (== AUTO) 는 margin-box 가 이미 available 에 stretch 되어
            // padding+border 를 content 폭이 포함(available - m 이 border-box). explicit px /
            // fit-content(둘 다 != AUTO) 는 content 폭이므로 padding+border 를 더한다.
            let child_w = if width_val != AUTO {
                child_content_w + pad_border_h // explicit px / fit-content: content + padding + border
            } else {
                child_content_w // auto (margin-box already at available)
            };
            let child_h = child_content_h + pad_border_v;

            out[out_off] = m_left;
            out[out_off + 1] = current_y;
            out[out_off + 2] = child_w;
            out[out_off + 3] = child_h;

            current_y += child_h;

            if child_creates_bfc {
                prev_margin_bottom = m_bottom;
                last_child_margin_bottom = 0.0;
            } else {
                prev_margin_bottom = m_bottom;
                last_child_margin_bottom = m_bottom;
            }
        }
    }

    // Flush remaining line box
    if !line_items.is_empty() {
        let lb = flush_line_box(&line_items, current_y, &mut out);
        last_line_baseline = current_y + lb;
    }

    // Trailing metadata
    if !can_collapse_top {
        first_child_margin_top = 0.0;
    }
    if !can_collapse_bottom {
        last_child_margin_bottom = 0.0;
    }

    let meta_off = child_count * OUT_FIELDS;
    out[meta_off] = first_child_margin_top;
    out[meta_off + 1] = last_child_margin_bottom;
    out[meta_off + 2] = last_line_baseline; // ADR-923 P2 — line box 없으면 AUTO

    out.into_boxed_slice()
}

/// Calculate line box height from items
fn calculate_line_box_height(items: &[LineItem]) -> f32 {
    if items.is_empty() {
        return 0.0;
    }

    let mut max_total_height: f32 = 0.0;
    let mut max_baseline_from_top: f32 = 0.0;

    for item in items {
        let total_h = item.height + item.margin_top + item.margin_bottom;
        max_total_height = max_total_height.max(total_h);

        if item.line_height != AUTO {
            let lh_with_margin = item.line_height + item.margin_top + item.margin_bottom;
            max_total_height = max_total_height.max(lh_with_margin);
        }

        if item.vertical_align == VALIGN_BASELINE {
            let baseline_from_top = item.margin_top + item.baseline;
            max_baseline_from_top = max_baseline_from_top.max(baseline_from_top);
        }
    }

    let mut max_below_baseline: f32 = 0.0;
    for item in items {
        if item.vertical_align == VALIGN_BASELINE {
            let below = item.height - item.baseline + item.margin_bottom;
            max_below_baseline = max_below_baseline.max(below);
        }
    }

    let baseline_height = max_baseline_from_top + max_below_baseline;
    max_total_height.max(baseline_height)
}

/// Flush line box items: compute vertical positions and write x/y to output.
///
/// 반환값: 이 line box 의 baseline (line top 기준 offset — 호출자가 start_y 를 더해
/// content-box y 로 만든다. ADR-923 Phase 2 — trailing meta `lastLineBaseline` 원천).
fn flush_line_box(items: &[LineItem], start_y: f32, out: &mut [f32]) -> f32 {
    if items.is_empty() {
        return 0.0;
    }

    let line_box_height = calculate_line_box_height(items);

    // Calculate baseline for the line box
    let mut line_baseline: f32 = 0.0;
    for item in items {
        if item.vertical_align == VALIGN_BASELINE {
            let baseline_from_top = item.margin_top + item.baseline;
            line_baseline = line_baseline.max(baseline_from_top);
        }
    }

    for item in items {
        let final_y = match item.vertical_align {
            VALIGN_TOP => start_y + item.margin_top,
            VALIGN_BOTTOM => start_y + line_box_height - item.height - item.margin_bottom,
            VALIGN_MIDDLE => {
                start_y
                    + (line_box_height - item.height - item.margin_top - item.margin_bottom) / 2.0
                    + item.margin_top
            }
            _ => {
                // baseline (default)
                start_y + line_baseline - item.baseline
            }
        };

        out[item.out_index] = item.x;
        out[item.out_index + 1] = final_y;
        // width and height already written
    }

    line_baseline
}

/// Exposed margin collapse for debugging/testing from JS
#[wasm_bindgen]
pub fn wasm_collapse_margins(a: f32, b: f32) -> f32 {
    collapse_margins(a, b)
}

#[cfg(test)]
mod tests {
    use super::*;

    // ── ADR-923 Phase 2: baseline meta + 센티널 폴백 ──

    /// trailing meta[2] = 마지막 line box baseline (make_inline_block 은 0.8h).
    #[test]
    fn line_box_meta_reports_last_line_baseline() {
        let mut data = Vec::new();
        data.extend(make_inline_block(50.0, 30.0, VALIGN_BASELINE));
        data.extend(make_inline_block(60.0, 40.0, VALIGN_BASELINE));
        let out = block_layout(&data, 300.0, 600.0, false, false, 0.0);
        let meta_off = 2 * OUT_FIELDS;
        assert_eq!(out.len(), meta_off + 3, "trailing meta 3 (ADR-923 P2)");
        assert_eq!(out[meta_off + 2], 32.0, "line baseline = max(24, 32) — 0.8×40");

        let block_only = make_block(100.0, 50.0, 0.0, 0.0);
        let out2 = block_layout(&block_only, 300.0, 600.0, false, false, 0.0);
        assert_eq!(out2[OUT_FIELDS + 2], AUTO, "line box 없음 → AUTO");
    }

    /// baseline 센티널(<0) = 원천 없음 → border-box bottom(child_h) 폴백 (§10.8.1).
    #[test]
    fn inline_block_baseline_sentinel_falls_back_to_bottom() {
        let mut first = make_inline_block(50.0, 30.0, VALIGN_BASELINE);
        first[17] = -1.0; // 원천 없음 → 폴백 30 (bottom)
        let mut data = first;
        data.extend(make_inline_block(60.0, 40.0, VALIGN_BASELINE)); // baseline 32
        let out = block_layout(&data, 300.0, 600.0, false, false, 0.0);
        // line_baseline = max(30, 32) = 32 → 첫 item y = 32 - 30 = 2.
        assert_eq!(out[1], 2.0, "폴백 baseline(=bottom 30) 으로 정렬");
    }

    fn make_block(width: f32, height: f32, m_top: f32, m_bottom: f32) -> Vec<f32> {
        vec![
            DISPLAY_BLOCK as f32, // display
            width,                // width (AUTO=-1)
            height,               // height (AUTO=-1)
            m_top,                // margin_top
            0.0,                  // margin_right
            m_bottom,             // margin_bottom
            0.0,                  // margin_left
            0.0,                  // bfc_flag
            0.0,                  // pad_border_v
            0.0,                  // pad_border_h
            AUTO,                 // min_w
            AUTO,                 // max_w
            AUTO,                 // min_h
            AUTO,                 // max_h
            100.0,                // content_w
            height.max(0.0),      // content_h
            0.0,                  // vertical_align
            0.0,                  // baseline
            AUTO,                 // line_height
        ]
    }

    fn make_inline_block(width: f32, height: f32, valign: u8) -> Vec<f32> {
        vec![
            DISPLAY_INLINE_BLOCK as f32,
            width, height,
            0.0, 0.0, 0.0, 0.0, // margins
            0.0,                  // bfc_flag
            0.0, 0.0,           // pad_border
            AUTO, AUTO, AUTO, AUTO, // min/max
            width.max(0.0), height.max(0.0), // content
            valign as f32,
            height.max(0.0) * 0.8, // baseline ~80%
            AUTO,                  // line_height
        ]
    }

    #[test]
    fn test_vertical_stacking() {
        let mut data = Vec::new();
        data.extend(make_block(AUTO, 100.0, 0.0, 0.0));
        data.extend(make_block(AUTO, 200.0, 0.0, 0.0));

        let result = block_layout(&data, 400.0, 800.0, false, false, 0.0);
        // child 0: y=0, h=100
        assert_eq!(result[1], 0.0);
        assert_eq!(result[3], 100.0);
        // child 1: y=100, h=200
        assert_eq!(result[5], 100.0);
        assert_eq!(result[7], 200.0);
    }

    #[test]
    fn test_margin_collapse_positive() {
        let mut data = Vec::new();
        data.extend(make_block(AUTO, 100.0, 0.0, 20.0));
        data.extend(make_block(AUTO, 100.0, 30.0, 0.0));

        let result = block_layout(&data, 400.0, 800.0, false, false, 0.0);
        // child 1 y = 100 + max(20, 30) = 130
        assert_eq!(result[5], 130.0);
    }

    #[test]
    fn test_margin_collapse_negative() {
        let mut data = Vec::new();
        data.extend(make_block(AUTO, 100.0, 0.0, -10.0));
        data.extend(make_block(AUTO, 100.0, -20.0, 0.0));

        let result = block_layout(&data, 400.0, 800.0, false, false, 0.0);
        // child 1 y = 100 + min(-10, -20) = 80
        assert_eq!(result[5], 80.0);
    }

    #[test]
    fn test_margin_collapse_mixed() {
        let mut data = Vec::new();
        data.extend(make_block(AUTO, 100.0, 0.0, 20.0));
        data.extend(make_block(AUTO, 100.0, -10.0, 0.0));

        let result = block_layout(&data, 400.0, 800.0, false, false, 0.0);
        // child 1 y = 100 + (20 + -10) = 110
        assert_eq!(result[5], 110.0);
    }

    #[test]
    fn test_bfc_blocks_collapse() {
        let mut data = Vec::new();
        data.extend(make_block(AUTO, 100.0, 0.0, 20.0));
        // second child creates BFC
        let mut child2 = make_block(AUTO, 100.0, 30.0, 0.0);
        child2[7] = 1.0; // bfc_flag
        data.extend(child2);

        let result = block_layout(&data, 400.0, 800.0, false, false, 0.0);
        // BFC: no collapse, y = 100 + 20 + 30 = 150
        assert_eq!(result[5], 150.0);
    }

    #[test]
    fn test_inline_block_horizontal() {
        let mut data = Vec::new();
        data.extend(make_inline_block(50.0, 30.0, VALIGN_BASELINE));
        data.extend(make_inline_block(60.0, 40.0, VALIGN_BASELINE));

        let result = block_layout(&data, 400.0, 400.0, false, false, 0.0);
        // child 0: x=0
        assert_eq!(result[0], 0.0);
        // child 1: x=50
        assert_eq!(result[4], 50.0);
    }

    #[test]
    fn test_inline_block_line_wrap() {
        let mut data = Vec::new();
        data.extend(make_inline_block(200.0, 30.0, VALIGN_BASELINE));
        data.extend(make_inline_block(250.0, 40.0, VALIGN_BASELINE));

        let result = block_layout(&data, 400.0, 400.0, false, false, 0.0);
        // child 0: x=0, y on first line
        assert_eq!(result[0], 0.0);
        // child 1: x=0 (wrapped to next line)
        assert_eq!(result[4], 0.0);
        // child 1 y should be > 0 (after first line)
        assert!(result[5] > 0.0);
    }

    #[test]
    fn test_empty_block() {
        let mut data = Vec::new();
        data.extend(make_block(AUTO, 100.0, 0.0, 20.0));
        // Empty block
        let mut empty = make_block(AUTO, 0.0, 10.0, 15.0);
        empty[0] = DISPLAY_EMPTY_BLOCK as f32;
        empty[2] = AUTO; // height = auto
        empty[15] = 0.0; // content_h = 0
        data.extend(empty);
        data.extend(make_block(AUTO, 100.0, 5.0, 0.0));

        let result = block_layout(&data, 400.0, 800.0, false, false, 0.0);
        // Empty block height = 0
        assert_eq!(result[7], 0.0);
    }

    #[test]
    fn test_parent_child_collapse_top() {
        let mut data = Vec::new();
        data.extend(make_block(AUTO, 100.0, 20.0, 0.0));

        let result = block_layout(&data, 400.0, 800.0, true, false, 0.0);
        let meta_off = OUT_FIELDS; // child 1개 뒤 metadata 시작
        // firstChildMarginTop should be 20 (collapsed to parent)
        assert_eq!(result[meta_off], 20.0);
    }

    #[test]
    fn test_collapse_margins_fn() {
        assert_eq!(wasm_collapse_margins(20.0, 30.0), 30.0);
        assert_eq!(wasm_collapse_margins(-10.0, -20.0), -20.0);
        assert_eq!(wasm_collapse_margins(20.0, -10.0), 10.0);
    }

    #[test]
    fn test_fit_content_block_width() {
        // Block with fit-content width should use contentWidth, not stretch
        let mut data = Vec::new();
        let mut child = make_block(FIT_CONTENT, AUTO, 0.0, 0.0);
        child[14] = 120.0; // content_w = 120
        data.extend(child);

        let result = block_layout(&data, 400.0, 800.0, false, false, 0.0);
        // fit-content: width = contentWidth(120) + padBorderH(0) = 120 (not 400)
        assert_eq!(result[2], 120.0);
    }

    #[test]
    fn test_fit_content_block_with_padding() {
        // Block with fit-content width + padding/border
        let mut data = Vec::new();
        let mut child = make_block(FIT_CONTENT, AUTO, 0.0, 0.0);
        child[9] = 20.0;  // pad_border_h = 20
        child[14] = 100.0; // content_w = 100
        data.extend(child);

        let result = block_layout(&data, 400.0, 800.0, false, false, 0.0);
        // fit-content: width = contentWidth(100) + padBorderH(20) = 120
        assert_eq!(result[2], 120.0);
    }

    #[test]
    fn test_fit_content_block_clamped_by_max() {
        // fit-content width should respect max-width
        let mut data = Vec::new();
        let mut child = make_block(FIT_CONTENT, AUTO, 0.0, 0.0);
        child[11] = 80.0;  // max_w = 80
        child[14] = 200.0; // content_w = 200 (exceeds max)
        data.extend(child);

        let result = block_layout(&data, 400.0, 800.0, false, false, 0.0);
        // clamp(200, AUTO, 80) = 80, then + padBorderH(0) = 80
        assert_eq!(result[2], 80.0);
    }

    #[test]
    fn test_fit_content_block_clamped_by_min() {
        // fit-content width should respect min-width
        let mut data = Vec::new();
        let mut child = make_block(FIT_CONTENT, AUTO, 0.0, 0.0);
        child[10] = 150.0; // min_w = 150
        child[14] = 50.0;  // content_w = 50 (below min)
        data.extend(child);

        let result = block_layout(&data, 400.0, 800.0, false, false, 0.0);
        // clamp(50, 150, AUTO) = 150, then + padBorderH(0) = 150
        assert_eq!(result[2], 150.0);
    }

    #[test]
    fn test_fit_content_inline_block() {
        // Inline-block with fit-content should use contentWidth (same as auto)
        let mut data = Vec::new();
        let mut child = make_inline_block(FIT_CONTENT, 30.0, VALIGN_BASELINE);
        child[14] = 80.0; // content_w = 80
        data.extend(child);

        let result = block_layout(&data, 400.0, 400.0, false, false, 0.0);
        // fit-content inline-block: width = contentWidth(80)
        assert_eq!(result[2], 80.0);
    }

    #[test]
    fn test_fit_content_vertical_stacking() {
        // Two blocks: auto then fit-content, should stack vertically
        let mut data = Vec::new();
        data.extend(make_block(AUTO, 50.0, 0.0, 10.0));
        let mut fit_child = make_block(FIT_CONTENT, 60.0, 20.0, 0.0);
        fit_child[14] = 150.0; // content_w = 150
        data.extend(fit_child);

        let result = block_layout(&data, 400.0, 800.0, false, false, 0.0);
        // child 0: y=0, w=400 (auto stretch), h=50
        assert_eq!(result[0], 0.0);  // x
        assert_eq!(result[1], 0.0);  // y
        assert_eq!(result[2], 400.0); // w (auto)
        assert_eq!(result[3], 50.0);  // h
        // child 1: y = 50 + max(10,20) = 70, w=150 (fit-content)
        assert_eq!(result[5], 70.0);  // y (after margin collapse)
        assert_eq!(result[6], 150.0); // w (fit-content = contentWidth)
    }

    // ── 이식 검증 후 추가: 명세상 명확한 잔여 케이스 (1-C land) ──

    #[test]
    fn test_empty_block_through_collapse_chain() {
        // 연속 empty block 3개: margin 이 chain 을 관통(through-collapse)해야 한다.
        // block(h=100, mb=20) → empty(mt=10, mb=30) → empty(mt=5, mb=15) → block(mt=25)
        // 마지막 block y = 100 + collapse(20, collapse(10,30)=30, collapse(5,15)=15, 25)
        //   = 100 + max(20,30,15,25) = 130 (연속 collapse 는 모두 인접 → 전부 최대값)
        let mut data = Vec::new();
        data.extend(make_block(AUTO, 100.0, 0.0, 20.0));
        let mut e1 = make_block(AUTO, AUTO, 10.0, 30.0);
        e1[0] = DISPLAY_EMPTY_BLOCK as f32;
        e1[15] = 0.0;
        data.extend(e1);
        let mut e2 = make_block(AUTO, AUTO, 5.0, 15.0);
        e2[0] = DISPLAY_EMPTY_BLOCK as f32;
        e2[15] = 0.0;
        data.extend(e2);
        data.extend(make_block(AUTO, 100.0, 25.0, 0.0));

        let result = block_layout(&data, 400.0, 800.0, false, false, 0.0);
        // 마지막 block(index 3) y — through-collapse 로 max(20,30,15,25)=30 위에 위치.
        // empty block 은 높이 0 이므로 current_y 는 첫 block 하단(100) 유지, 그 위에 collapse.
        assert_eq!(result[13], 130.0, "last block y after through-collapse");
    }

    #[test]
    fn test_parent_child_collapse_bottom_metadata() {
        // 마지막 자식의 margin-bottom 이 부모로 전파 (can_collapse_bottom=true).
        let mut data = Vec::new();
        data.extend(make_block(AUTO, 100.0, 0.0, 35.0));

        let result = block_layout(&data, 400.0, 800.0, false, true, 0.0);
        let meta_off = OUT_FIELDS; // child 1개 뒤 metadata 시작
        // lastChildMarginBottom = 35 (부모로 collapse)
        assert_eq!(result[meta_off + 1], 35.0, "last child margin-bottom propagates to parent");
    }

    #[test]
    fn test_bfc_child_no_bottom_collapse_to_parent() {
        // BFC 자식은 부모와 bottom margin collapse 안 함 → metadata 0.
        let mut data = Vec::new();
        let mut child = make_block(AUTO, 100.0, 0.0, 35.0);
        child[7] = 1.0; // bfc_flag
        data.extend(child);

        let result = block_layout(&data, 400.0, 800.0, false, true, 0.0);
        let meta_off = OUT_FIELDS; // child 1개 뒤 metadata 시작
        // BFC 자식 → lastChildMarginBottom = 0 (부모로 전파 차단)
        assert_eq!(result[meta_off + 1], 0.0, "BFC child bottom margin does not collapse to parent");
    }
}
