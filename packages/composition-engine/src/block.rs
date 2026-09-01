//! ADR-916 Phase 1-C — CSS Block 레이아웃 (CSS 2.1 §8, §9.4.1 BFC / §8.3.1 margin collapse)
//!
//! Taffy 를 대체하는 자체 block solver. 기존 `apps/builder/.../wasm/src/block_layout.rs`
//! (625줄, unit test 17) 를 **입력 계약(FIELD_COUNT=19) 그대로 승계 이식**한 것.
//! 원본은 runtime 미가동(layoutWorker 전용, LAYOUT_WORKER=false) 이었으나 검증된
//! margin collapse / inline-block line box / fit-content 커널이므로 재작성 대신 이식하여
//! WPT-파생 검증 자산 상실(Soft Constraint) 을 회피한다.
//!
//! ## 입력 계약 (`FIELD_COUNT` = 21, 노드당 — r10m2: 19 → 21)
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
//! | 7   | bfc_flag        | 1 = BFC 생성 — **미소비** (r9: 자식 자신의 margin collapse 는 BFC 와 무관, 프로토콜 호환 잔존) |
//! | 8   | pad_border_v    | padding_v + border_v 합             |
//! | 9   | pad_border_h    | padding_h + border_h 합             |
//! | 10-13| min_w/max_w/min_h/max_h | AUTO=-1                     |
//! | 14  | content_w       | intrinsic content 폭                |
//! | 15  | content_h       | intrinsic content 높이              |
//! | 16  | vertical_align  | 0=baseline 1=top 2=middle 3=bottom  |
//! | 17  | baseline        | border-box top 기준. **<0 = 원천 없음** → bottom margin edge(child_h+m_bottom) 폴백 (ADR-923 P3 r8l1 정정, §10.8.1) |
//! | 18  | line_height     | AUTO=-1 — S4 text run 예약 (atomic 은 margin box 참여) |
//! | 19  | margin_top_neg  | adjoining 집합의 **음수 성분** (≤0, r10m2) — 슬롯 3 은 양수 성분/own signed. `MarginSet::of(3).with(19)` |
//! | 20  | margin_bottom_neg | 슬롯 5 의 짝 (bottom) |
//!
//! ## 미구현 (다음 세션 — dual-run FAIL 이 fixture)
//!
//! float / clear, writing-mode, 명시적 BFC 내부 다단(column) 등은 미대상. block 은
//! 현행 catalog 컨테이너가 사용하는 vertical stacking + inline-block line box 범위로 한정.

use wasm_bindgen::prelude::*;

/// Block layout field count per child element.
pub const FIELD_COUNT: usize = 21;

/// Output fields per child: x, y, width, height
const OUT_FIELDS: usize = 4;

// Display types
#[allow(dead_code)]
const DISPLAY_BLOCK: u8 = 0;
const DISPLAY_INLINE_BLOCK: u8 = 1;
const DISPLAY_EMPTY_BLOCK: u8 = 2; // pre-classified empty block

// Vertical align
#[allow(dead_code)] // 기본값 0 은 match 의 `_` 팔이 처리 — 테스트·계약 문서용 명명 상수
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
/// Float32Array: [x, y, w, h, ...] for each child, plus 4 trailing values:
/// [firstChildMarginTop, lastChildMarginBottom, lastLineBaseline, inFlowBottom]
/// (lastLineBaseline: 마지막 line box 의 baseline — content-box y, line box 없으면
/// AUTO=-1. ADR-923 Phase 2 — 컨테이너 baseline 출력의 정확값 원천.
/// inFlowBottom: in-flow content 하단 = auto height 원천 (P3 r8h2) — 부모 bottom 과
/// collapse 하지 못한 마지막 margin chain 을 **포함**하고 (§10.6.3, r9m2), 탈출하는
/// chain·self-collapsing 꼬리 box 는 제외한다.)
///
/// margin collapse 모델 (CSS 2.1 §8.3.1 — ADR-923 P3 r9 Chrome 실측으로 재정의):
/// - `prev_margin_bottom` 이 "아직 놓이지 않은 인접 margin chain". block 은 자기 top 을
///   chain 과 collapse 해 놓이고, self-collapsing box(코드 2) 는 top/bottom 을 chain 에
///   더할 뿐 놓이지 않는다 (위치는 "non-zero bottom border 가 있었다면" 자리 — 부모 top
///   과 collapse 하는 선두 chain 은 부모 top border edge).
/// - 자식의 BFC 여부(bfc_flag)는 **자식 자신의** margin collapse 와 무관하다 — BFC 는
///   자기 in-flow 자식과의 collapse 만 막는다(그 차단은 tree.rs 가 자식 solve 의
///   can_collapse_* 로 한다). Chrome 실측 bfc-sibling-top-collapse / bfc-last-child-
///   margin-escape / bfc-first-child-top-escape (r9). 슬롯 7 은 프로토콜 호환용 잔존.
/// - line box 는 margin 을 collapse 하지 않는다 — line box 가 시작될 때 pending chain
///   은 그대로 놓인다 (block-margin-then-line-box).
/// - chain 은 값이 아니라 adjoining **집합** `MarginSet` (r10m2) — 형제·관통·hoist 3층의
///   margin 이 전부 한 집합이라 최대 양수 + 최소 음수 로만 닫힌다.
#[wasm_bindgen]
pub fn block_layout(
    data: &[f32],
    available_width: f32,
    available_height: f32,
    can_collapse_top: bool,
    can_collapse_bottom: bool,
    prev_sibling_margin_bottom: f32,
) -> Box<[f32]> {
    block_layout_with_strut(
        data,
        available_width,
        available_height,
        can_collapse_top,
        can_collapse_bottom,
        prev_sibling_margin_bottom,
        AUTO,
    )
}

/// `block_layout` + 컨테이너 strut line-height (ADR-923 Phase 3).
///
/// `strut_line_height` = 컨테이너의 line-height px (AUTO=-1 → strut 없음). 각 line box 에
/// ascent = descent = lh/2 의 zero-width baseline 참여자로 들어간다 (`line_metrics` doc —
/// Chrome 실측 strut-short/tall). wasm export 는 기존 `block_layout` 시그니처를 유지한다.
pub fn block_layout_with_strut(
    data: &[f32],
    available_width: f32,
    available_height: f32,
    can_collapse_top: bool,
    can_collapse_bottom: bool,
    prev_sibling_margin_bottom: f32,
    strut_line_height: f32,
) -> Box<[f32]> {
    let _ = available_height; // reserved for future use
    let child_count = data.len() / FIELD_COUNT;
    if child_count == 0 {
        return vec![0.0, 0.0, AUTO, 0.0, 0.0, 0.0].into_boxed_slice();
    }

    // Output: 4 values per child + 6 trailing metadata (P2: +lastLineBaseline · P3 r8h2:
    // +inFlowBottom · r10m2: +firstChildMarginTopNeg/lastChildMarginBottomNeg — 0/1 은 값,
    // 4/5 는 음수 성분. pos = 값 − neg)
    let mut out = vec![0.0f32; child_count * OUT_FIELDS + 6];

    let mut current_y: f32 = 0.0;
    let mut current_x: f32 = 0.0;
    // margin chain 3종은 adjoining **집합** (r10m2 — `MarginSet` doc).
    let mut prev_margin_bottom = MarginSet::of(prev_sibling_margin_bottom);
    let mut first_child_margin_top = MarginSet::ZERO;
    let mut last_child_margin_bottom = MarginSet::ZERO;
    let mut is_first_block = true;

    // 부모 top 과 collapse 하는 선두 self-collapsing box 들 (out offset) — 루프 뒤
    // escaped top(= 부모 top border edge) 으로 y 를 덮는다 (§8.3.1).
    let mut leading_empties: Vec<usize> = Vec::new();

    // LineBox accumulator for inline-block elements
    let mut line_items: Vec<LineItem> = Vec::new();
    // 마지막으로 flush 된 line box 의 baseline (content-box y). line box 없으면 AUTO.
    let mut last_line_baseline: f32 = AUTO;

    for i in 0..child_count {
        let off = i * FIELD_COUNT;
        let display = data[off] as u8;
        let width_val = data[off + 1]; // AUTO = -1
        let height_val = data[off + 2]; // AUTO = -1
        // r10m2 — adjoining 집합: 슬롯 3/5 = own(signed)·양수 성분, 19/20 = 탈출 chain 음수 성분.
        let m_top_set = MarginSet::of(data[off + 3]).with(data[off + 19]);
        let m_bottom_set = MarginSet::of(data[off + 5]).with(data[off + 20]);
        let m_top = m_top_set.value();
        let m_right = data[off + 4];
        let m_bottom = m_bottom_set.value();
        let m_left = data[off + 6];
        let _bfc_flag = data[off + 7]; // r9: 미소비 — 자식 자신의 margin 은 BFC 여부와 무관하게 collapse (모듈 doc)
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
        let _line_height = data[off + 18]; // 예약 (S4 text run) — atomic inline 은 §10.8 margin box 로만 참여 (Phase 3 Chrome 실측)

        let out_off = i * OUT_FIELDS;
        // block-level 폭 (block / self-collapsing 공통): fit-content = content, 명시 px,
        // auto = margin-box 가 available 에 stretch. auto 는 border-box 가 available-m 이라
        // pad_border 를 더하지 않는다 (explicit/fit-content 는 content 폭이라 더한다).
        let block_level_width = |width_val: f32| -> f32 {
            let child_content_w = clamp_size(
                if width_val == FIT_CONTENT {
                    content_w
                } else if width_val != AUTO {
                    width_val
                } else {
                    available_width - m_left - m_right
                },
                min_w, max_w,
            );
            if width_val != AUTO { child_content_w + pad_border_h } else { child_content_w }
        };

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

            // ADR-923 Phase 3 (r7 관찰 → Chrome 실측 ib-baseline-margin-bottom): 폴백
            // baseline 은 border-box bottom 이 아니라 **bottom margin edge** (CSS 2.1
            // §10.8.1 — h20+mb8 → baseline 28, Chrome y 12). overflow≠visible 강제는
            // tree.rs write 쪽이 센티널로 만들어 이 폴백을 태운다 (같은 조항).
            let baseline = if baseline >= 0.0 { baseline } else { child_h + m_bottom };

            // Line wrap check
            if current_x + total_width > available_width && current_x > 0.0 {
                let m = flush_line_box(&line_items, current_y, &mut out, strut_line_height);
                last_line_baseline = current_y + m.baseline;
                current_y += m.height;
                current_x = 0.0;
                line_items.clear();
            }

            // line box 는 margin collapse 에 참여하지 않는다 — 새 line box 가 시작되면
            // pending chain 이 그대로 놓인다 (§8.3.1 — Chrome block-margin-then-line-box:
            // block h10+mb10 뒤 inline-block y 20). 선두 탈출 chain 도 같은 값을 더해
            // 좌표계(escaped top 포함)를 맞춘다.
            if line_items.is_empty() {
                current_y += prev_margin_bottom.value(); // 아래에서 0 으로 리셋
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
            });

            // Write width/height (x/y will be set by flush_line_box)
            out[out_off + 2] = child_w;
            out[out_off + 3] = child_h;

            current_x += total_width;
            prev_margin_bottom = MarginSet::ZERO;
            last_child_margin_bottom = MarginSet::ZERO; // 마지막이 line box 면 탈출할 margin 없음
            is_first_block = false;
        } else if display == DISPLAY_EMPTY_BLOCK {
            // Empty block: self-collapse top/bottom margins
            if !line_items.is_empty() {
                let m = flush_line_box(&line_items, current_y, &mut out, strut_line_height);
                last_line_baseline = current_y + m.baseline;
                current_y += m.height;
                current_x = 0.0;
                line_items.clear();
            }

            // Empty block: 자기 top/bottom margin 을 self-collapse 한 뒤, 인접한
            // 이전 margin 과 through-collapse (CSS 2.1 §8.3.1 — 인접 margin 은 모두
            // 하나로 collapse). prev_margin_bottom 을 덮어쓰지 않고 누적 collapse 하여
            // 앞선 sibling 의 margin 이 chain 을 관통하도록 보존한다.
            let collapsed_self = m_top_set.join(m_bottom_set);
            let through = prev_margin_bottom.join(collapsed_self);

            // 위치 = "non-zero bottom border 가 있었다면" 의 자리 (§8.3.1 — 자기 top 만
            // 이전 chain 과 collapse. Chrome r9 trailing-empty-block-escape: solid h10+mb10
            // 뒤 empty(mt20,mb30) y 30). current_y 는 전진하지 않는다 — auto height 에서
            // 제외 (§10.6.3, Chrome root.h 10).
            out[out_off] = m_left;
            out[out_off + 1] = current_y + prev_margin_bottom.join(m_top_set).value();
            out[out_off + 2] = block_level_width(width_val);
            out[out_off + 3] = 0.0;

            if is_first_block && can_collapse_top {
                first_child_margin_top = first_child_margin_top.join(through);
                leading_empties.push(out_off);
            }
            last_child_margin_bottom = through;
            prev_margin_bottom = through;
        } else {
            // Block: vertical stacking + margin collapse
            if !line_items.is_empty() {
                let m = flush_line_box(&line_items, current_y, &mut out, strut_line_height);
                last_line_baseline = current_y + m.baseline;
                current_y += m.height;
                current_x = 0.0;
                line_items.clear();
            }

            if is_first_block {
                if can_collapse_top {
                    // 선두 self-collapsing chain(prev) 과 자기 top 이 한 덩어리로 부모 top
                    // 과 collapse (Chrome r9 empty-first-chain-through-wrap: wrap y 40).
                    // 좌표계는 escaped top 을 포함하므로 y 도 같은 값만큼 전진한다.
                    first_child_margin_top = prev_margin_bottom.join(m_top_set);
                }
                is_first_block = false;
            }

            // BFC 자식도 자기 top margin 은 이전 형제 bottom 과 collapse 한다 (§8.3.1 —
            // Chrome r9 bfc-sibling-top-collapse: a mb20 + flex mt10 → y 30, 합산이면 40).
            let collapsed_margin_top = prev_margin_bottom.join(m_top_set).value();
            current_y += collapsed_margin_top;

            let child_content_h = clamp_size(
                if height_val != AUTO && height_val != FIT_CONTENT { height_val } else { content_h },
                min_h, max_h,
            );
            let child_w = block_level_width(width_val);
            let child_h = child_content_h + pad_border_v;

            out[out_off] = m_left;
            out[out_off + 1] = current_y;
            out[out_off + 2] = child_w;
            out[out_off + 3] = child_h;

            current_y += child_h;

            // BFC 자식의 bottom margin 도 다음 형제/부모 bottom 과 collapse 한다 (Chrome r9
            // bfc-last-child-margin-escape: wrap>flex(h10,mb20) 뒤 sib y 30).
            prev_margin_bottom = m_bottom_set;
            last_child_margin_bottom = m_bottom_set;
        }
    }

    // Flush remaining line box
    if !line_items.is_empty() {
        let m = flush_line_box(&line_items, current_y, &mut out, strut_line_height);
        last_line_baseline = current_y + m.baseline;
        current_y += m.height; // r8h2 — 마지막 line box 높이를 in-flow bottom 에 반영 (Chrome strut-last-line)
    }

    // Trailing metadata
    if !can_collapse_top {
        first_child_margin_top = MarginSet::ZERO;
    }
    if !can_collapse_bottom {
        // 부모 bottom 과 collapse 하지 못하는 마지막 margin chain 은 content 에 포함된다
        // (§10.6.3 "last in-flow child 의 bottom margin edge" — Chrome r9 trailing-margin-
        // contained: h10+mb20+pb1 → 31 / trailing-empty-block-contained → 41).
        current_y += last_child_margin_bottom.value();
        last_child_margin_bottom = MarginSet::ZERO;
    }
    // 부모 top 과 collapse 한 선두 self-collapsing box 의 top border edge = 부모의 것
    // (§8.3.1 — Chrome r9 empty-first-chain-through-wrap: empty y == wrap y).
    for &o in &leading_empties {
        out[o + 1] = first_child_margin_top.value();
    }

    let meta_off = child_count * OUT_FIELDS;
    out[meta_off] = first_child_margin_top.value();
    out[meta_off + 1] = last_child_margin_bottom.value();
    out[meta_off + 4] = first_child_margin_top.neg; // r10m2 — 음수 성분 (tree.rs 가 집합 복원)
    out[meta_off + 5] = last_child_margin_bottom.neg;
    out[meta_off + 2] = last_line_baseline; // ADR-923 P2 — line box 없으면 AUTO
    out[meta_off + 3] = current_y; // P3 r8h2 — in-flow content bottom (마지막 line box 포함; auto-height 원천)

    out.into_boxed_slice()
}

/// Line box 세로 메트릭 (ADR-923 Phase 3 — Chrome 차등 실측으로 재정의).
///
/// - **atomic inline 의 `line_height` 는 관여하지 않는다** (CSS 2.1 §10.8 — inline-block/
///   inline-flex/inline-grid 는 margin box 로 참여. Chrome 실측 atomic-line-height-inert:
///   item lineHeight 50 이어도 line = 20). slot 18 은 S4(순수 inline text run) 예약.
/// - **strut** (§10.8 — 컨테이너 폰트/line-height 의 zero-width inline box): 컨테이너
///   line-height 가 px 로 오면 ascent = descent = lh/2 로 baseline 참여 (half-leading —
///   폰트 축은 TS 선해석 몫이라 fontSize 0 기준 정확, 실폰트 ascent 보정 공급 채널은
///   S4/Phase 5 판정. Chrome 실측 strut-short/tall: 40px strut → line 40 / 50+20=70).
/// - **vertical-align: bottom 초과분은 line 을 위로 늘려 baseline 을 아래로 민다**
///   (§10.8.1 — Chrome 실측 valign-bottom: ib20(baseline)+ib40(bottom) → baseline 40,
///   ib20 y=20). top 초과분은 아래로 늘어 baseline 불변. **middle 은 line 중앙이
///   아니라 baseline 에 margin box 중심 고정** (§10.8 baseline + x-height/2 — fontSize 0
///   채널이라 x-height 0, 실폰트 보정은 S4/Phase 5. Chrome 실측 r8 valign-middle-tall:
///   ib20+ib60(middle) → baseline 30, ib20 y=10 — line 중앙설이면 y 0).
struct LineMetrics {
    height: f32,
    baseline: f32,
}

fn line_metrics(items: &[LineItem], strut_line_height: f32) -> LineMetrics {
    if items.is_empty() {
        return LineMetrics { height: 0.0, baseline: 0.0 };
    }
    let mut asc: f32 = 0.0;
    let mut desc: f32 = 0.0;
    if strut_line_height >= 0.0 {
        asc = strut_line_height / 2.0;
        desc = strut_line_height / 2.0;
    }
    let mut max_top: f32 = 0.0;
    let mut max_bottom: f32 = 0.0;
    for item in items {
        let mbox = item.height + item.margin_top + item.margin_bottom;
        match item.vertical_align {
            VALIGN_TOP => max_top = max_top.max(mbox),
            VALIGN_BOTTOM => max_bottom = max_bottom.max(mbox),
            VALIGN_MIDDLE => {
                // r8h1 — middle 은 baseline 참여: margin box 중심을 baseline(+x-height/2=0)
                // 에 고정하므로 asc/desc 를 절반씩 민다 (line 중앙 배치 아님 — Chrome 실측).
                asc = asc.max(mbox / 2.0);
                desc = desc.max(mbox / 2.0);
            }
            _ => {
                asc = asc.max(item.margin_top + item.baseline);
                desc = desc.max(item.height - item.baseline + item.margin_bottom);
            }
        }
    }
    let height = (asc + desc).max(max_top).max(max_bottom);
    let baseline = asc.max(max_bottom - desc);
    LineMetrics { height, baseline }
}

/// Flush line box items: compute vertical positions and write x/y to output.
///
/// 반환: 이 line box 의 메트릭 — 호출자가 `current_y + baseline` 으로 trailing meta
/// `lastLineBaseline`(content-box y) 를 만들고 `height` 만큼 y 를 전진한다
/// (ADR-923 Phase 2 컨테이너 baseline 출력의 정확값 원천).
fn flush_line_box(
    items: &[LineItem],
    start_y: f32,
    out: &mut [f32],
    strut_line_height: f32,
) -> LineMetrics {
    let m = line_metrics(items, strut_line_height);
    for item in items {
        let final_y = match item.vertical_align {
            VALIGN_TOP => start_y + item.margin_top,
            VALIGN_BOTTOM => start_y + m.height - item.height - item.margin_bottom,
            VALIGN_MIDDLE => {
                // r8h1 — margin box 중심 = baseline (x-height 0 채널).
                let mbox = item.height + item.margin_top + item.margin_bottom;
                start_y + m.baseline - mbox / 2.0 + item.margin_top
            }
            _ => {
                // baseline (default)
                start_y + m.baseline - item.baseline
            }
        };

        out[item.out_index] = item.x;
        out[item.out_index + 1] = final_y;
        // width and height already written
    }
    m
}

/// **adjoining margin 집합** (CSS 2.1 §8.3.1 "collapsed margin = maximum of the positive
/// adjoining margins + minimum (most negative) of the negative adjoining margins").
///
/// 이항 `collapse_margins` 를 누적하면 3개 이상 부호 혼합에서 결합 순서에 의존한다 —
/// {10, 30, −20, 5, 25, 5} 는 집합으론 30−20 = 10 인데 이항 누적은 25 (ADR-923 P3 r10m2,
/// Chrome mixed-sign-chain-three-empties b.y 20 / 엔진 35). 형제 chain · self-collapsing
/// box 관통 · 부모-자식 hoist 3층이 모두 한 집합이므로 tree.rs 경계(escaped, 슬롯 19/20,
/// meta 4/5)도 값이 아니라 (pos, neg) 쌍으로 넘긴다.
#[derive(Clone, Copy, Debug, Default, PartialEq)]
pub struct MarginSet {
    /// 최대 양수 (≥ 0)
    pub pos: f32,
    /// 최소 음수 (≤ 0)
    pub neg: f32,
}

impl MarginSet {
    pub const ZERO: MarginSet = MarginSet { pos: 0.0, neg: 0.0 };

    /// 부호 있는 margin 1개의 집합.
    #[inline]
    pub fn of(m: f32) -> Self {
        if m >= 0.0 { Self { pos: m, neg: 0.0 } } else { Self { pos: 0.0, neg: m } }
    }

    /// 두 집합의 합집합.
    #[inline]
    pub fn join(self, o: Self) -> Self {
        Self { pos: self.pos.max(o.pos), neg: self.neg.min(o.neg) }
    }

    /// margin 1개 추가.
    #[inline]
    pub fn with(self, m: f32) -> Self {
        self.join(Self::of(m))
    }

    /// collapsed 값.
    #[inline]
    pub fn value(self) -> f32 {
        self.pos + self.neg
    }
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
        assert_eq!(out.len(), meta_off + 6, "trailing meta 6 (ADR-923 P3 r8h2: +inFlowBottom · r10m2: +neg 2)");
        assert_eq!(out[meta_off + 2], 32.0, "line baseline = max(24, 32) — 0.8×40");

        let block_only = make_block(100.0, 50.0, 0.0, 0.0);
        let out2 = block_layout(&block_only, 300.0, 600.0, false, false, 0.0);
        assert_eq!(out2[OUT_FIELDS + 2], AUTO, "line box 없음 → AUTO");
    }

    /// r8h1 — middle 은 margin box 중심을 baseline 에 고정 (Chrome valign-middle-tall).
    #[test]
    fn adr923_p3_valign_middle_anchors_to_baseline() {
        let mut data = Vec::new();
        data.extend(make_inline_block(60.0, 20.0, VALIGN_BASELINE)); // baseline 16 (0.8h)
        data.extend(make_inline_block(60.0, 60.0, VALIGN_MIDDLE));
        let out = block_layout(&data, 300.0, 600.0, false, false, 0.0);
        // asc = max(16, 30) = 30 · desc = max(4, 30) = 30 → H 60, baseline 30.
        assert_eq!(out[1], 14.0, "baseline item y = 30 - 16");
        assert_eq!(out[OUT_FIELDS + 1], 0.0, "middle 60 의 중심 = baseline 30 → y 0");
        let meta_off = 2 * OUT_FIELDS;
        assert_eq!(out[meta_off + 2], 30.0, "middle 이 밀어올린 line baseline 30");
    }

    /// r8h2 — 마지막 line box 의 strut 높이가 meta in-flow bottom 에 반영.
    #[test]
    fn adr923_p3_last_line_strut_in_flow_bottom() {
        let data = make_inline_block(60.0, 20.0, VALIGN_BASELINE);
        let out = block_layout_with_strut(&data, 300.0, 600.0, false, false, 0.0, 40.0);
        // strut asc=desc=20 · item asc 16/desc 4 → H 40, baseline 20.
        assert_eq!(out[1], 4.0, "item y = baseline 20 - 16");
        assert_eq!(out[OUT_FIELDS + 3], 40.0, "in-flow bottom = 마지막 line box 포함 40");
    }

    /// baseline 센티널(<0) = 원천 없음 → bottom margin edge(child_h+m_bottom) 폴백 (§10.8.1).
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
            0.0,                  // margin_top_neg (r10m2)
            0.0,                  // margin_bottom_neg
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
            0.0, 0.0,              // margin neg 성분 (r10m2)
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
    fn test_bfc_sibling_top_margin_collapses() {
        // r9 (Chrome bfc-sibling-top-collapse): BFC 자식의 자기 top margin 도 이전 형제
        // bottom 과 collapse — y = 100 + max(20, 30) = 130 (구 모델 합산 150 은 오류).
        let mut data = Vec::new();
        data.extend(make_block(AUTO, 100.0, 0.0, 20.0));
        let mut child2 = make_block(AUTO, 100.0, 30.0, 0.0);
        child2[7] = 1.0; // bfc_flag — 자식 자신의 margin collapse 에는 무관 (미소비)
        data.extend(child2);

        let result = block_layout(&data, 400.0, 800.0, false, false, 0.0);
        assert_eq!(result[5], 130.0, "BFC sibling top margin collapses with previous bottom");
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
    fn test_bfc_child_bottom_margin_collapses_to_parent() {
        // r9 (Chrome bfc-last-child-margin-escape): BFC 자식의 자기 bottom margin 은 부모
        // bottom 과 collapse 해 탈출한다 — BFC 는 자기 in-flow 자식과의 collapse 만 막는다.
        let mut data = Vec::new();
        let mut child = make_block(AUTO, 100.0, 0.0, 35.0);
        child[7] = 1.0; // bfc_flag
        data.extend(child);

        let result = block_layout(&data, 400.0, 800.0, false, true, 0.0);
        let meta_off = OUT_FIELDS; // child 1개 뒤 metadata 시작
        assert_eq!(result[meta_off + 1], 35.0, "BFC child bottom margin collapses to parent");
    }

    // ── ADR-923 Phase 3 round 9 — margin chain 경계 (Chrome 실측) ──

    /// trailing-margin-contained: 부모 bottom 과 collapse 불가(can_collapse_bottom=false)
    /// 면 마지막 bottom margin 이 in-flow bottom 에 포함 (h10+mb20 → 30).
    #[test]
    fn adr923_p3_r9_trailing_margin_contained_in_flow_bottom() {
        let data = make_block(AUTO, 10.0, 0.0, 20.0);
        let result = block_layout(&data, 300.0, 600.0, false, false, 0.0);
        assert_eq!(result[OUT_FIELDS + 3], 30.0, "inFlowBottom includes contained trailing margin");
        assert_eq!(result[OUT_FIELDS + 1], 0.0, "nothing escapes");
        let escaped = block_layout(&data, 300.0, 600.0, false, true, 0.0);
        assert_eq!(escaped[OUT_FIELDS + 3], 10.0, "escaping margin excluded from in-flow bottom");
        assert_eq!(escaped[OUT_FIELDS + 1], 20.0);
    }

    /// trailing-empty-block-escape / -contained: 꼬리 self-collapsing box 는 위치만 갖고
    /// (y = 10 + max(10,20) = 30) current_y 를 전진시키지 않는다. 탈출 시 bottom 10,
    /// 포함 시 10 + max(10,20,30) = 40.
    #[test]
    fn adr923_p3_r9_trailing_empty_block_position_and_height() {
        let mut data = Vec::new();
        data.extend(make_block(AUTO, 10.0, 0.0, 10.0));
        let mut e = make_block(AUTO, AUTO, 20.0, 30.0);
        e[0] = DISPLAY_EMPTY_BLOCK as f32;
        e[15] = 0.0;
        data.extend(e);
        let meta = 2 * OUT_FIELDS;
        let esc = block_layout(&data, 300.0, 600.0, false, true, 0.0);
        assert_eq!(esc[5], 30.0, "empty y = as-if non-zero bottom border");
        assert_eq!(esc[meta + 3], 10.0, "escape: empty excluded");
        assert_eq!(esc[meta + 1], 30.0, "chain escapes");
        let con = block_layout(&data, 300.0, 600.0, false, false, 0.0);
        assert_eq!(con[5], 30.0);
        assert_eq!(con[meta + 3], 40.0, "contained: chain included");
    }

    /// empty-first-chain-through-wrap: 선두 empty(20,30) + block(mt5) 의 chain 30 이 통째
    /// 부모 top 으로 탈출 — escaped 30, block y 30 (탈출 좌표계), empty y = escaped (부모 top
    /// border edge).
    #[test]
    fn adr923_p3_r9_leading_empty_chain_escapes_whole() {
        let mut data = Vec::new();
        let mut e = make_block(AUTO, AUTO, 20.0, 30.0);
        e[0] = DISPLAY_EMPTY_BLOCK as f32;
        e[15] = 0.0;
        data.extend(e);
        data.extend(make_block(AUTO, 10.0, 5.0, 0.0));
        let meta = 2 * OUT_FIELDS;
        let out = block_layout(&data, 300.0, 600.0, true, true, 0.0);
        assert_eq!(out[meta], 30.0, "escaped top = whole chain");
        assert_eq!(out[5], 30.0, "block y = escaped (rel 0)");
        assert_eq!(out[1], 30.0, "leading empty y = parent top border edge");
        assert_eq!(out[meta + 3], 40.0, "in-flow bottom = 30 + 10");
        // 부모 top 과 collapse 불가면 empty y = 자기 mt(20), block y = 30 (chain 30 놓임)
        let padded = block_layout(&data, 300.0, 600.0, false, false, 0.0);
        assert_eq!(padded[1], 20.0);
        assert_eq!(padded[5], 30.0);
        assert_eq!(padded[meta + 3], 40.0);
    }

    /// r10m2 — adjoining 집합은 최대 양수 + 최소 음수: {10, 30, −20, 5, 25, 5} → 10 (이항
    /// 누적 25 — Chrome mixed-sign-chain-three-empties b.y 20). 슬롯 19/20 = 탈출 chain 의
    /// 음수 성분, meta 4/5 = 부모로 넘기는 음수 성분.
    #[test]
    fn adr923_p3_r10_margin_set_extrema_not_pairwise() {
        let set = MarginSet::of(10.0).with(30.0).with(-20.0).with(5.0).with(25.0).with(5.0);
        assert_eq!((set.pos, set.neg, set.value()), (30.0, -20.0, 10.0));
        assert_eq!(collapse_margins(collapse_margins(10.0, 30.0), -20.0), 10.0, "2개씩은 같다");

        let mut data = Vec::new();
        data.extend(make_block(AUTO, 10.0, 0.0, 10.0));
        let mut e1 = make_block(AUTO, AUTO, 30.0, -20.0);
        e1[0] = DISPLAY_EMPTY_BLOCK as f32;
        e1[15] = 0.0;
        data.extend(e1);
        let mut e2 = make_block(AUTO, AUTO, 5.0, 25.0);
        e2[0] = DISPLAY_EMPTY_BLOCK as f32;
        e2[15] = 0.0;
        data.extend(e2);
        data.extend(make_block(AUTO, 10.0, 5.0, 0.0));
        let out = block_layout(&data, 300.0, 600.0, false, false, 0.0);
        assert_eq!(out[3 * OUT_FIELDS + 1], 20.0, "b.y = 10 + (30 − 20)");
        assert_eq!(out[4 * OUT_FIELDS + 3], 30.0, "in-flow bottom");

        // own mt 30 + 탈출 chain 음수 −20 (슬롯 19) + 이전 형제 mb 10 → {10, 30, −20} = 10.
        let mut data = Vec::new();
        data.extend(make_block(AUTO, 10.0, 0.0, 10.0));
        let mut c = make_block(AUTO, 10.0, 30.0, 0.0);
        c[19] = -20.0;
        data.extend(c);
        let out = block_layout(&data, 300.0, 600.0, false, false, 0.0);
        assert_eq!(out[OUT_FIELDS + 1], 20.0);

        // 선두 chain 이 부모 top 과 collapse: meta 0 = 값 10, meta 4 = 음수 성분 −20.
        let mut c = make_block(AUTO, 10.0, 30.0, 0.0);
        c[19] = -20.0;
        let out = block_layout(&c, 300.0, 600.0, true, true, 0.0);
        let meta = OUT_FIELDS;
        assert_eq!(out.len(), meta + 6);
        assert_eq!((out[meta], out[meta + 4]), (10.0, -20.0));
        assert_eq!(out[1], 10.0, "escaped 좌표계 포함");
    }

    /// block-margin-then-line-box: line box 는 margin 을 collapse 하지 않는다 — block
    /// h10+mb10 뒤 inline-block 은 y 20, 마지막이 line box 면 탈출 margin 0.
    #[test]
    fn adr923_p3_r9_pending_margin_lands_before_line_box() {
        let mut data = Vec::new();
        data.extend(make_block(AUTO, 10.0, 0.0, 10.0));
        data.extend(make_inline_block(60.0, 20.0, VALIGN_BASELINE));
        let meta = 2 * OUT_FIELDS;
        let out = block_layout(&data, 300.0, 600.0, false, true, 0.0);
        assert_eq!(out[5], 20.0, "inline-block y after block margin");
        assert_eq!(out[meta + 1], 0.0, "no trailing margin escapes past a line box");
        assert_eq!(out[meta + 3], 40.0);
    }
}
