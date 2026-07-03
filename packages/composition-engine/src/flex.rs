//! ADR-916 Phase 1-A — CSS Flexbox 레이아웃 (CSS-FLEXBOX-1) 자체 구현
//!
//! Taffy 를 대체하는 자체 flex solver. 입력은 `block_layout.rs` 와 동일한
//! **flat f32 배열 + 센티넬** 계약을 따른다 (사전 해석된 숫자 — 스타일 파싱은
//! 상류 style 계층 책임). dual-run 하네스(`dualRunHarness.ts`)가 이 solver 결과를
//! Taffy 결과와 HC3 2단 비교하여 CSS 명세 준수를 검증한다.
//!
//! ## 구현 범위
//!
//! - **단일축 기본 (2026-07-03 첫 단위)**: main-axis(row/column) 단일 라인 배치,
//!   fixed/auto size, `justify-content` 6종, `align-items` 4종, gap, 물리축 역매핑.
//! - **flex 분배 + wrap (2026-07-03 잔여, 본 land)**: `flex-grow`/`flex-shrink`
//!   여유·부족 분배(§9.7 Resolving Flexible Lengths 반복 동결 알고리즘),
//!   `flex-wrap`(multi-line §9.3 Collect flex items into flex lines),
//!   `align-content`(라인 간 정렬).
//! - **미구현 (다음 세션)**: `flex-basis: content` intrinsic 자동 측정,
//!   `aspect-ratio`, nested BFC, `align-self`(아이템별 override), auto margin 흡수.
//!   이 입력은 근사 처리 → dual-run FAIL 로 드러나며 그것이 다음 구현 대상 fixture.
//!
//! ## §9.7 Resolving Flexible Lengths (CSS-FLEXBOX-1)
//!
//! 여유 공간(free space)을 flex-grow/shrink 비율로 아이템에 분배하는 반복 알고리즘.
//! 핵심은 min/max 제약을 위반한 아이템을 **동결(freeze)** 하고 나머지를 재분배하는 루프:
//!
//! 1. sizing 방향 결정: `sum(hypothetical) < available` → grow, 아니면 shrink.
//! 2. inflexible 동결: grow인데 grow=0 또는 basis>hypothetical 이면 동결 (shrink 대칭).
//! 3. initial free space = available − sum(동결 outer size + 미동결 outer flex-basis).
//! 4. 미동결 아이템 있는 동안 반복:
//!    a. remaining free space 재계산.
//!    b. grow-sum<1 이면 magnitude 축소 / shrink 는 scaled factor(basis×shrink) 사용.
//!    c. target = basis ± remaining × (factor / sum factor).
//!    d. min/max clamp → violation 부호 합산.
//!    e. total>0 → min 위반 동결 / total<0 → max 위반 동결 / total==0 → 전체 동결.
//!
//! ## §9.3 Collect flex items into flex lines
//!
//! `flex-wrap: nowrap` 이면 전 아이템이 단일 라인. `wrap` 이면 아이템 outer main-size
//! 누적이 available_main 을 초과하기 직전에 새 라인 시작 (각 라인은 최소 1개 아이템).
//!
//! ## 필드 계약 (`FLEX_FIELD_COUNT` = 17, 노드당)
//!
//! | off | 필드              | 센티넬                    |
//! | --- | ----------------- | ------------------------- |
//! | 0   | flex_basis        | AUTO=-1, CONTENT=-2       |
//! | 1   | width             | AUTO=-1 (논리 main)       |
//! | 2   | height            | AUTO=-1 (논리 cross)      |
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
//! | 15  | flex_grow         | ≥0 (default 0)            |
//! | 16  | flex_shrink       | ≥0 (default 1)            |
//!
//! main/cross 축은 컨테이너 `flex_direction` 에 따라 물리축(x/y)에 매핑된다.
//! 아이템 필드는 이미 논리축(main/cross) 기준으로 상류에서 변환되어 들어온다.

use wasm_bindgen::prelude::*;

/// 노드당 입력 필드 수.
pub const FLEX_FIELD_COUNT: usize = 17;

/// 출력 필드 수 (x, y, width, height).
const OUT_FIELDS: usize = 4;

/// auto / none 센티넬.
const AUTO: f32 = -1.0;
/// flex-basis: content 센티넬.
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

// flex_wrap (컨테이너 파라미터)
/// nowrap — 단일 라인
pub const WRAP_NOWRAP: u8 = 0;
/// wrap — multi-line
pub const WRAP_WRAP: u8 = 1;

// align_content (라인 간 정렬, multi-line 만 의미). START 가 default(`_`).
#[allow(dead_code)]
const ALIGN_CONTENT_START: u8 = 1;
const ALIGN_CONTENT_STRETCH: u8 = 0;
const ALIGN_CONTENT_CENTER: u8 = 2;
const ALIGN_CONTENT_END: u8 = 3;
const ALIGN_CONTENT_SPACE_BETWEEN: u8 = 4;
const ALIGN_CONTENT_SPACE_AROUND: u8 = 5;

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

/// flex 아이템 하나 — 파싱된 논리축 메트릭 (배치 전 중간 표현).
#[derive(Clone)]
struct FlexItem {
    /// 원본 노드 인덱스 (출력 매핑용)
    index: usize,
    /// flex-basis (pad/border 제외 content 크기, 미해석 시 hypothetical 산출용)
    flex_basis: f32,
    /// main 축 pad+border 합
    pad_border_main: f32,
    /// §9.7 결과 main content 크기 (동결/분배 후 확정)
    main_content: f32,
    /// border-box cross content 크기 (stretch 전)
    cross_content: f32,
    pad_border_cross: f32,
    margin_main_start: f32,
    margin_main_end: f32,
    margin_cross_start: f32,
    margin_cross_end: f32,
    min_main: f32,
    max_main: f32,
    min_cross: f32,
    max_cross: f32,
    flex_grow: f32,
    flex_shrink: f32,
    // §9.7 상태
    frozen: bool,
    target_main: f32,
}

impl FlexItem {
    /// outer main size (margin 포함, border-box)
    #[inline]
    fn outer_main(&self, content_main: f32) -> f32 {
        content_main + self.pad_border_main + self.margin_main_start + self.margin_main_end
    }
    /// border-box main size (margin 제외)
    #[inline]
    fn border_main(&self, content_main: f32) -> f32 {
        content_main + self.pad_border_main
    }
}

/// 원본 배열에서 아이템 파싱 → 논리축 FlexItem.
fn parse_item(data: &[f32], i: usize, direction: u8) -> FlexItem {
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
    let flex_grow = data[off + 15];
    let flex_shrink = data[off + 16];

    // flex-basis 해석 우선순위: flex_basis(명시) → width(논리 main) → content.
    // CONTENT / AUTO 센티넬은 content_main 로 fallback (intrinsic 자동측정 미구현).
    let basis = if flex_basis != AUTO && flex_basis != CONTENT {
        flex_basis
    } else if width != AUTO {
        width
    } else {
        content_main
    };
    // hypothetical main content (min/max clamp 전 — §9.7 이 clamp 를 소유)
    let main_content = basis.max(0.0);

    // cross content: height(논리 cross) 명시 시 사용, 없으면 content. stretch 는 배치 단계.
    let cross_content = if height != AUTO {
        clamp_size(height, min_cross, max_cross)
    } else {
        clamp_size(content_cross, min_cross, max_cross)
    };

    // margin 논리 매핑. row: main=left/right, cross=top/bottom / column: 반대
    let (mm_start, mm_end, mc_start, mc_end) = if direction == DIR_ROW {
        (m_left, m_right, m_top, m_bottom)
    } else {
        (m_top, m_bottom, m_left, m_right)
    };

    FlexItem {
        index: i,
        flex_basis: main_content,
        pad_border_main,
        main_content,
        cross_content,
        pad_border_cross,
        margin_main_start: mm_start,
        margin_main_end: mm_end,
        margin_cross_start: mc_start,
        margin_cross_end: mc_end,
        min_main,
        max_main,
        min_cross,
        max_cross,
        flex_grow,
        flex_shrink,
        frozen: false,
        target_main: main_content,
    }
}

/// §9.7 Resolving Flexible Lengths — 단일 라인의 아이템 main content 크기 확정.
///
/// `line` 아이템들의 `target_main` 을 grow/shrink 분배 결과로 채운다.
/// `available_main` 은 컨테이너 content-box main 크기, `total_gap` 은 라인 내 gap 총합.
fn resolve_flexible_lengths(line: &mut [FlexItem], available_main: f32, total_gap: f32) {
    if line.is_empty() {
        return;
    }

    // ── Step 1: hypothetical outer main 합으로 grow/shrink 방향 결정 ──
    let hypothetical_sum: f32 = line
        .iter()
        .map(|it| it.outer_main(it.flex_basis))
        .sum::<f32>()
        + total_gap;
    let growing = hypothetical_sum < available_main;

    // ── Step 2: inflexible 아이템 즉시 동결 (target = hypothetical) ──
    for it in line.iter_mut() {
        let factor = if growing { it.flex_grow } else { it.flex_shrink };
        let inflexible = factor == 0.0
            || (growing && it.flex_basis > it.main_content)
            || (!growing && it.flex_basis < it.main_content);
        if inflexible {
            it.frozen = true;
            it.target_main = clamp_size(it.flex_basis, it.min_main, it.max_main);
        } else {
            it.frozen = false;
            it.target_main = it.flex_basis;
        }
    }

    // ── Step 3~4: 미동결 아이템이 있는 동안 반복 분배 ──
    // (최악 아이템 수만큼 반복 — 매 라운드 최소 1개 동결 보장)
    loop {
        let any_unfrozen = line.iter().any(|it| !it.frozen);
        if !any_unfrozen {
            break;
        }

        // (a) remaining free space = available − (동결 outer size + 미동결 outer flex-basis)
        let used: f32 = line
            .iter()
            .map(|it| {
                if it.frozen {
                    it.outer_main(it.target_main)
                } else {
                    it.outer_main(it.flex_basis)
                }
            })
            .sum::<f32>()
            + total_gap;
        let remaining = available_main - used;

        // (b) flex factor 준비
        let (grow_sum, scaled_shrink_sum) = line.iter().filter(|it| !it.frozen).fold(
            (0.0f32, 0.0f32),
            |(g, s), it| (g + it.flex_grow, s + it.flex_basis * it.flex_shrink),
        );

        // (c) 미동결 아이템에 분배
        if growing {
            // grow-sum < 1 이면 free space magnitude 를 sum 만큼 축소 (§9.7 4b)
            let effective_remaining = if grow_sum < 1.0 {
                remaining * grow_sum
            } else {
                remaining
            };
            if grow_sum > 0.0 {
                for it in line.iter_mut().filter(|it| !it.frozen) {
                    let ratio = it.flex_grow / grow_sum;
                    it.target_main = it.flex_basis + effective_remaining * ratio;
                }
            }
        } else {
            // shrink: scaled flex shrink factor = flex_basis × flex_shrink
            let shrink_factor_sum: f32 = line
                .iter()
                .filter(|it| !it.frozen)
                .map(|it| it.flex_shrink)
                .sum();
            let effective_remaining = if shrink_factor_sum < 1.0 {
                remaining * shrink_factor_sum
            } else {
                remaining
            };
            if scaled_shrink_sum > 0.0 {
                for it in line.iter_mut().filter(|it| !it.frozen) {
                    let scaled = it.flex_basis * it.flex_shrink;
                    let ratio = scaled / scaled_shrink_sum;
                    // remaining 은 음수(부족) → basis 에서 감소
                    it.target_main = it.flex_basis + effective_remaining * ratio;
                }
            }
        }

        // (d) min/max clamp → 아이템별 violation 부호 기록 + 합산
        //   violation > 0 : min 으로 커졌음 (min violation)
        //   violation < 0 : max 로 작아졌음 (max violation)
        let mut total_violation = 0.0f32;
        let mut violations: Vec<(usize, f32)> = Vec::new();
        for (li, it) in line.iter_mut().enumerate() {
            if it.frozen {
                continue;
            }
            let unclamped = it.target_main;
            let clamped = clamp_size(unclamped, it.min_main.max(0.0), it.max_main);
            it.target_main = clamped;
            let v = clamped - unclamped;
            total_violation += v;
            violations.push((li, v));
        }

        // (e) total violation 부호로 동결 대상 결정 (§9.7 4e)
        //   >0 → min-violated(v>0) 동결 / <0 → max-violated(v<0) 동결 / ==0 → 전체 동결
        if total_violation > 0.0 {
            for (li, v) in &violations {
                if *v > 0.0 {
                    line[*li].frozen = true;
                }
            }
        } else if total_violation < 0.0 {
            for (li, v) in &violations {
                if *v < 0.0 {
                    line[*li].frozen = true;
                }
            }
        } else {
            // 위반 없음 → 전체 동결하여 종료
            for it in line.iter_mut().filter(|it| !it.frozen) {
                it.frozen = true;
            }
        }
    }

    // 최종 main content 확정 (target_main 이 content 크기)
    for it in line.iter_mut() {
        it.main_content = it.target_main;
    }
}

/// §9.3 — 아이템을 flex line 으로 수집. 각 원소는 원본 배열 인덱스의 Vec.
fn collect_lines(
    items: &[FlexItem],
    available_main: f32,
    wrap: u8,
    gap_main: f32,
) -> Vec<Vec<usize>> {
    if wrap == WRAP_NOWRAP || items.is_empty() {
        return vec![(0..items.len()).collect()];
    }

    let mut lines: Vec<Vec<usize>> = Vec::new();
    let mut current: Vec<usize> = Vec::new();
    let mut line_main = 0.0f32;

    for (i, it) in items.iter().enumerate() {
        let outer = it.outer_main(it.flex_basis);
        let gap = if current.is_empty() { 0.0 } else { gap_main };
        // 현재 라인이 비어있지 않고, 추가 시 available 초과면 새 라인
        if !current.is_empty() && line_main + gap + outer > available_main {
            lines.push(std::mem::take(&mut current));
            line_main = outer;
            current.push(i);
        } else {
            line_main += gap + outer;
            current.push(i);
        }
    }
    if !current.is_empty() {
        lines.push(current);
    }
    lines
}

/// 컨테이너 전체 flex 레이아웃 (wrap + grow/shrink 지원).
///
/// # Arguments
/// * `data` — 노드당 `FLEX_FIELD_COUNT` f32 (논리 main/cross 기준)
/// * `available_main` — 컨테이너 content-box main 크기
/// * `available_cross` — 컨테이너 content-box cross 크기
/// * `direction` — `DIR_ROW` | `DIR_COLUMN`
/// * `justify_content` — main 축 정렬 코드
/// * `align_items` — cross 축 정렬 코드 (라인 내)
/// * `align_content` — 라인 간 정렬 코드 (multi-line)
/// * `wrap` — `WRAP_NOWRAP` | `WRAP_WRAP`
/// * `gap_main` — main 축 gap
/// * `gap_cross` — cross 축 gap (라인 간)
///
/// # Returns
/// `[x, y, w, h, ...]` 물리 좌표 (컨테이너 content-box 원점 기준). 입력 노드 순서 유지.
#[wasm_bindgen]
#[allow(clippy::too_many_arguments)]
pub fn flex_layout(
    data: &[f32],
    available_main: f32,
    available_cross: f32,
    direction: u8,
    justify_content: u8,
    align_items: u8,
    align_content: u8,
    wrap: u8,
    gap_main: f32,
    gap_cross: f32,
) -> Box<[f32]> {
    let count = data.len() / FLEX_FIELD_COUNT;
    if count == 0 {
        return vec![].into_boxed_slice();
    }

    // ── 파싱: 논리축 FlexItem ──
    let items: Vec<FlexItem> = (0..count).map(|i| parse_item(data, i, direction)).collect();

    // ── §9.3 라인 수집 ──
    let line_indices = collect_lines(&items, available_main, wrap, gap_main);

    let mut out = vec![0.0f32; count * OUT_FIELDS];

    // 각 라인의 cross 크기(= 라인 내 최대 아이템 outer cross)를 모아 라인 간 배치 계산
    let mut line_cross_sizes: Vec<f32> = Vec::with_capacity(line_indices.len());
    // 라인별 확정 FlexItem (main_content resolve 후)
    let mut resolved_lines: Vec<Vec<FlexItem>> = Vec::with_capacity(line_indices.len());

    for idxs in &line_indices {
        let mut line: Vec<FlexItem> = idxs.iter().map(|&i| items[i].clone()).collect();
        let line_gap = if line.len() > 1 {
            gap_main * (line.len() as f32 - 1.0)
        } else {
            0.0
        };
        resolve_flexible_lengths(&mut line, available_main, line_gap);

        // 라인 cross 크기 = 최대 (cross content + pad_border + margin)
        let line_cross = line
            .iter()
            .map(|it| it.cross_content + it.pad_border_cross + it.margin_cross_start + it.margin_cross_end)
            .fold(0.0f32, f32::max);
        line_cross_sizes.push(line_cross);
        resolved_lines.push(line);
    }

    // ── align-content: 라인 간 cross 배치 ──
    let line_count = resolved_lines.len();
    let total_line_cross: f32 = line_cross_sizes.iter().sum::<f32>()
        + if line_count > 1 {
            gap_cross * (line_count as f32 - 1.0)
        } else {
            0.0
        };
    let cross_free = (available_cross - total_line_cross).max(0.0);

    let (cross_start_offset, cross_between_extra, stretch_extra) =
        align_content_offsets(align_content, cross_free, line_count);

    // ── 각 라인 배치 ──
    let mut cross_cursor = cross_start_offset;
    for (li, line) in resolved_lines.iter().enumerate() {
        let mut this_line_cross = line_cross_sizes[li];
        if stretch_extra > 0.0 {
            this_line_cross += stretch_extra;
        }

        place_line_main_axis(
            &mut out,
            line,
            available_main,
            justify_content,
            gap_main,
        );
        place_line_cross_axis(
            &mut out,
            line,
            direction,
            cross_cursor,
            this_line_cross,
            align_items,
        );

        cross_cursor += this_line_cross + gap_cross + cross_between_extra;
    }

    out.into_boxed_slice()
}

/// align-content offset 계산 → (start_offset, between_extra, per-line stretch_extra).
fn align_content_offsets(
    align_content: u8,
    cross_free: f32,
    line_count: usize,
) -> (f32, f32, f32) {
    if line_count == 0 {
        return (0.0, 0.0, 0.0);
    }
    match align_content {
        ALIGN_CONTENT_STRETCH => {
            // 여유를 라인마다 균등 분배 (라인 cross 크기 증가)
            let per_line = cross_free / line_count as f32;
            (0.0, 0.0, per_line)
        }
        ALIGN_CONTENT_CENTER => (cross_free / 2.0, 0.0, 0.0),
        ALIGN_CONTENT_END => (cross_free, 0.0, 0.0),
        ALIGN_CONTENT_SPACE_BETWEEN => {
            if line_count > 1 {
                (0.0, cross_free / (line_count as f32 - 1.0), 0.0)
            } else {
                (0.0, 0.0, 0.0)
            }
        }
        ALIGN_CONTENT_SPACE_AROUND => {
            let unit = cross_free / line_count as f32;
            (unit / 2.0, unit, 0.0)
        }
        // START (default): 여유를 끝에 몰아둠 (라인 크기·간격 변화 없음)
        _ => (0.0, 0.0, 0.0),
    }
}

/// 라인 내 main 축 배치 (justify-content). `out` 의 main 좌표 채움.
fn place_line_main_axis(
    out: &mut [f32],
    line: &[FlexItem],
    available_main: f32,
    justify_content: u8,
    gap_main: f32,
) {
    let n = line.len();
    if n == 0 {
        return;
    }
    let total_gap = if n > 1 {
        gap_main * (n as f32 - 1.0)
    } else {
        0.0
    };
    let total_main: f32 = line
        .iter()
        .map(|it| it.border_main(it.main_content) + it.margin_main_start + it.margin_main_end)
        .sum::<f32>()
        + total_gap;
    let free_main = (available_main - total_main).max(0.0);

    let (start_offset, between_extra) = match justify_content {
        JUSTIFY_CENTER => (free_main / 2.0, 0.0),
        JUSTIFY_END => (free_main, 0.0),
        JUSTIFY_SPACE_BETWEEN => {
            if n > 1 {
                (0.0, free_main / (n as f32 - 1.0))
            } else {
                (0.0, 0.0)
            }
        }
        JUSTIFY_SPACE_AROUND => {
            let unit = free_main / n as f32;
            (unit / 2.0, unit)
        }
        JUSTIFY_SPACE_EVENLY => {
            let unit = free_main / (n as f32 + 1.0);
            (unit, unit)
        }
        // JUSTIFY_START (default)
        _ => (0.0, 0.0),
    };

    let mut cursor = start_offset;
    for (i, it) in line.iter().enumerate() {
        cursor += it.margin_main_start;
        // main 좌표는 direction 에 따라 out[off] (row=x) 또는 out[off+1] (column=y)
        // 여기서는 임시로 out[off] 에 main_pos, out[off+2] 에 main_size 저장 후
        // cross 배치에서 physical 로 최종 변환하지 않고, place_line_cross_axis 가
        // direction 을 알고 write_physical 로 최종 좌표를 쓴다.
        // 따라서 이 단계는 "main_pos / main_size" 를 임시 슬롯에 기록.
        let out_off = it.index * OUT_FIELDS;
        // 임시 저장: main_pos → out_off (재해석), main_size → out_off+2
        out[out_off] = cursor; // main_pos (임시)
        out[out_off + 2] = it.border_main(it.main_content); // main_size (임시)
        cursor += it.border_main(it.main_content) + it.margin_main_end;
        if i + 1 < n {
            cursor += gap_main + between_extra;
        }
    }
}

/// 라인 내 cross 축 배치 (align-items) + physical 최종 좌표 기록.
fn place_line_cross_axis(
    out: &mut [f32],
    line: &[FlexItem],
    direction: u8,
    line_cross_start: f32,
    line_cross_size: f32,
    align_items: u8,
) {
    for it in line.iter() {
        let out_off = it.index * OUT_FIELDS;
        // main_pos / main_size 를 임시 슬롯에서 회수
        let main_pos = out[out_off];
        let main_size = out[out_off + 2];

        let item_cross_border = it.cross_content + it.pad_border_cross;
        let cross_avail = line_cross_size - it.margin_cross_start - it.margin_cross_end;
        let cross_free = (cross_avail - item_cross_border).max(0.0);

        let (cross_pos_local, cross_final) = match align_items {
            ALIGN_STRETCH => {
                let stretched = clamp_size(
                    cross_avail,
                    it.min_cross,
                    it.max_cross,
                );
                (it.margin_cross_start, stretched)
            }
            ALIGN_CENTER => (it.margin_cross_start + cross_free / 2.0, item_cross_border),
            ALIGN_END => (it.margin_cross_start + cross_free, item_cross_border),
            // ALIGN_START (default)
            _ => (it.margin_cross_start, item_cross_border),
        };
        let cross_pos = line_cross_start + cross_pos_local;

        write_physical(out, out_off, direction, main_pos, cross_pos, main_size, cross_final);
    }
}

/// 단일 라인 flex (하위 호환 진입점 — grow/shrink/wrap 없이 기본 배치).
///
/// `flex_layout` 의 nowrap + grow/shrink=0 특수 케이스. 기존 8 테스트가 이 API 를
/// 사용하므로 유지. 신규 코드는 `flex_layout` 사용 권장.
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
    flex_layout(
        data,
        available_main,
        available_cross,
        direction,
        justify_content,
        align_items,
        ALIGN_CONTENT_STRETCH,
        WRAP_NOWRAP,
        gap_main,
        0.0,
    )
}

#[cfg(test)]
mod tests {
    use super::*;

    /// 노드 하나 필드를 배열에 채우는 헬퍼. width→논리main, height→논리cross.
    /// flex_grow=0, flex_shrink=1 (CSS default).
    fn item(width: f32, height: f32) -> [f32; FLEX_FIELD_COUNT] {
        let mut f = [0.0f32; FLEX_FIELD_COUNT];
        f[0] = AUTO; // flex_basis
        f[1] = width; // width (논리 main)
        f[2] = height; // height (논리 cross)
        f[9] = AUTO; // min_main
        f[10] = AUTO; // max_main
        f[11] = AUTO; // min_cross
        f[12] = AUTO; // max_cross
        f[15] = 0.0; // flex_grow
        f[16] = 1.0; // flex_shrink
        f
    }

    /// flex_grow / flex_shrink 설정 헬퍼.
    fn with_flex(mut f: [f32; FLEX_FIELD_COUNT], grow: f32, shrink: f32) -> [f32; FLEX_FIELD_COUNT] {
        f[15] = grow;
        f[16] = shrink;
        f
    }

    fn flatten(items: &[[f32; FLEX_FIELD_COUNT]]) -> Vec<f32> {
        items.iter().flatten().copied().collect()
    }

    // ── 기존 8 테스트 (단일축 기본, 회귀 방지) ──

    #[test]
    fn row_fixed_items_justify_start() {
        let data = flatten(&[item(50.0, 20.0), item(50.0, 20.0), item(50.0, 20.0)]);
        let out = flex_layout_single_line(&data, 300.0, 100.0, DIR_ROW, JUSTIFY_START, ALIGN_START, 10.0);
        assert_eq!(out[0], 0.0);
        assert_eq!(out[4], 60.0);
        assert_eq!(out[8], 120.0);
        assert_eq!(out[1], 0.0);
        assert_eq!(out[2], 50.0);
        assert_eq!(out[3], 20.0);
    }

    #[test]
    fn row_justify_center() {
        let data = flatten(&[item(50.0, 20.0), item(50.0, 20.0)]);
        let out = flex_layout_single_line(&data, 200.0, 100.0, DIR_ROW, JUSTIFY_CENTER, ALIGN_START, 0.0);
        assert_eq!(out[0], 50.0);
        assert_eq!(out[4], 100.0);
    }

    #[test]
    fn row_justify_space_between() {
        let data = flatten(&[item(50.0, 20.0), item(50.0, 20.0)]);
        let out = flex_layout_single_line(&data, 200.0, 100.0, DIR_ROW, JUSTIFY_SPACE_BETWEEN, ALIGN_START, 0.0);
        assert_eq!(out[0], 0.0);
        assert_eq!(out[4], 150.0);
    }

    #[test]
    fn column_direction_maps_main_to_y() {
        let data = flatten(&[item(40.0, 30.0), item(40.0, 30.0)]);
        let out = flex_layout_single_line(&data, 200.0, 100.0, DIR_COLUMN, JUSTIFY_START, ALIGN_START, 5.0);
        assert_eq!(out[1], 0.0);
        assert_eq!(out[5], 45.0);
        assert_eq!(out[2], 30.0);
        assert_eq!(out[3], 40.0);
    }

    #[test]
    fn align_center_cross() {
        let data = flatten(&[item(50.0, 20.0)]);
        let out = flex_layout_single_line(&data, 300.0, 100.0, DIR_ROW, JUSTIFY_START, ALIGN_CENTER, 0.0);
        assert_eq!(out[1], 40.0);
    }

    #[test]
    fn align_stretch_fills_cross() {
        let mut f = item(50.0, AUTO);
        f[2] = AUTO;
        let data = flatten(&[f]);
        let out = flex_layout_single_line(&data, 300.0, 100.0, DIR_ROW, JUSTIFY_START, ALIGN_STRETCH, 0.0);
        assert_eq!(out[3], 100.0);
    }

    #[test]
    fn empty_input_returns_empty() {
        let out = flex_layout_single_line(&[], 300.0, 100.0, DIR_ROW, JUSTIFY_START, ALIGN_START, 0.0);
        assert_eq!(out.len(), 0);
    }

    #[test]
    fn clamp_respects_max_cross() {
        let mut f = item(50.0, AUTO);
        f[2] = AUTO;
        f[12] = 30.0;
        let data = flatten(&[f]);
        let out = flex_layout_single_line(&data, 300.0, 100.0, DIR_ROW, JUSTIFY_START, ALIGN_STRETCH, 0.0);
        assert_eq!(out[3], 30.0);
    }

    // ── §9.7 flex-grow 분배 ──

    #[test]
    fn grow_distributes_free_space_equally() {
        // 2개 basis 50, grow 1 each, available 200 → free 100 → 각 +50 = 100
        let data = flatten(&[
            with_flex(item(50.0, 20.0), 1.0, 1.0),
            with_flex(item(50.0, 20.0), 1.0, 1.0),
        ]);
        let out = flex_layout(&data, 200.0, 100.0, DIR_ROW, JUSTIFY_START, ALIGN_START, ALIGN_CONTENT_STRETCH, WRAP_NOWRAP, 0.0, 0.0);
        // width 각 100
        assert!((out[2] - 100.0).abs() < 0.01, "item0 width={}", out[2]);
        assert!((out[6] - 100.0).abs() < 0.01, "item1 width={}", out[6]);
        // x: 0, 100
        assert!((out[0] - 0.0).abs() < 0.01);
        assert!((out[4] - 100.0).abs() < 0.01);
    }

    #[test]
    fn grow_distributes_by_ratio() {
        // basis 50 each, grow 1 vs 3, available 250 → free 150 → +37.5 / +112.5
        let data = flatten(&[
            with_flex(item(50.0, 20.0), 1.0, 1.0),
            with_flex(item(50.0, 20.0), 3.0, 1.0),
        ]);
        let out = flex_layout(&data, 250.0, 100.0, DIR_ROW, JUSTIFY_START, ALIGN_START, ALIGN_CONTENT_STRETCH, WRAP_NOWRAP, 0.0, 0.0);
        assert!((out[2] - 87.5).abs() < 0.01, "item0 width={}", out[2]);
        assert!((out[6] - 162.5).abs() < 0.01, "item1 width={}", out[6]);
    }

    #[test]
    fn grow_clamped_by_max_redistributes() {
        // basis 50 each grow 1, available 300 → free 200 → naive +100 각 150.
        // item0 max_main 120 → clamp 120, 잉여 30 을 item1 에 재분배 → item1 = 150+30 = 180
        let mut f0 = with_flex(item(50.0, 20.0), 1.0, 1.0);
        f0[10] = 120.0; // max_main
        let data = flatten(&[f0, with_flex(item(50.0, 20.0), 1.0, 1.0)]);
        let out = flex_layout(&data, 300.0, 100.0, DIR_ROW, JUSTIFY_START, ALIGN_START, ALIGN_CONTENT_STRETCH, WRAP_NOWRAP, 0.0, 0.0);
        assert!((out[2] - 120.0).abs() < 0.01, "item0 clamped width={}", out[2]);
        assert!((out[6] - 180.0).abs() < 0.01, "item1 redistributed width={}", out[6]);
    }

    #[test]
    fn grow_zero_stays_at_basis() {
        // grow 0 → basis 유지, 여유 공간 분배 없음
        let data = flatten(&[item(50.0, 20.0), item(50.0, 20.0)]);
        let out = flex_layout(&data, 300.0, 100.0, DIR_ROW, JUSTIFY_START, ALIGN_START, ALIGN_CONTENT_STRETCH, WRAP_NOWRAP, 0.0, 0.0);
        assert!((out[2] - 50.0).abs() < 0.01);
        assert!((out[6] - 50.0).abs() < 0.01);
    }

    // ── §9.7 flex-shrink 분배 ──

    #[test]
    fn shrink_distributes_overflow() {
        // basis 100 each, shrink 1, available 150 → overflow 50.
        // scaled shrink = 100×1 each, ratio 0.5 → 각 -25 = 75
        let data = flatten(&[
            with_flex(item(100.0, 20.0), 0.0, 1.0),
            with_flex(item(100.0, 20.0), 0.0, 1.0),
        ]);
        let out = flex_layout(&data, 150.0, 100.0, DIR_ROW, JUSTIFY_START, ALIGN_START, ALIGN_CONTENT_STRETCH, WRAP_NOWRAP, 0.0, 0.0);
        assert!((out[2] - 75.0).abs() < 0.01, "item0 shrunk width={}", out[2]);
        assert!((out[6] - 75.0).abs() < 0.01, "item1 shrunk width={}", out[6]);
    }

    #[test]
    fn shrink_zero_keeps_size_overflow() {
        // shrink 0 → 축소 안 함, overflow 허용
        let data = flatten(&[
            with_flex(item(100.0, 20.0), 0.0, 0.0),
            with_flex(item(100.0, 20.0), 0.0, 0.0),
        ]);
        let out = flex_layout(&data, 150.0, 100.0, DIR_ROW, JUSTIFY_START, ALIGN_START, ALIGN_CONTENT_STRETCH, WRAP_NOWRAP, 0.0, 0.0);
        assert!((out[2] - 100.0).abs() < 0.01);
        assert!((out[6] - 100.0).abs() < 0.01);
    }

    #[test]
    fn shrink_respects_min_main() {
        // basis 100 each shrink 1, available 100 → overflow 100 → naive 각 -50 = 50.
        // item0 min_main 80 → clamp 80, 부족분을 item1 이 더 흡수 → item1 = 20
        let mut f0 = with_flex(item(100.0, 20.0), 0.0, 1.0);
        f0[9] = 80.0; // min_main
        let data = flatten(&[f0, with_flex(item(100.0, 20.0), 0.0, 1.0)]);
        let out = flex_layout(&data, 100.0, 100.0, DIR_ROW, JUSTIFY_START, ALIGN_START, ALIGN_CONTENT_STRETCH, WRAP_NOWRAP, 0.0, 0.0);
        assert!((out[2] - 80.0).abs() < 0.01, "item0 min-clamped width={}", out[2]);
        assert!((out[6] - 20.0).abs() < 0.01, "item1 absorbed width={}", out[6]);
    }

    // ── §9.3 flex-wrap ──

    #[test]
    fn wrap_breaks_into_two_lines() {
        // 3개 basis 100, available 250, wrap. line1=[0,1](200), line2=[2]
        let data = flatten(&[item(100.0, 30.0), item(100.0, 30.0), item(100.0, 30.0)]);
        let out = flex_layout(&data, 250.0, 200.0, DIR_ROW, JUSTIFY_START, ALIGN_START, ALIGN_CONTENT_START, WRAP_WRAP, 0.0, 0.0);
        // line1: x 0, 100 / y 0
        assert!((out[0] - 0.0).abs() < 0.01);
        assert!((out[4] - 100.0).abs() < 0.01);
        assert!((out[1] - 0.0).abs() < 0.01, "item0 y={}", out[1]);
        assert!((out[5] - 0.0).abs() < 0.01, "item1 y={}", out[5]);
        // line2: item2 x 0, y = line1 cross(30)
        assert!((out[8] - 0.0).abs() < 0.01, "item2 x={}", out[8]);
        assert!((out[9] - 30.0).abs() < 0.01, "item2 y={}", out[9]);
    }

    #[test]
    fn nowrap_keeps_single_line_overflow() {
        // wrap nowrap → 초과해도 단일 라인 (shrink 0 이므로 overflow)
        let data = flatten(&[
            with_flex(item(100.0, 30.0), 0.0, 0.0),
            with_flex(item(100.0, 30.0), 0.0, 0.0),
            with_flex(item(100.0, 30.0), 0.0, 0.0),
        ]);
        let out = flex_layout(&data, 250.0, 200.0, DIR_ROW, JUSTIFY_START, ALIGN_START, ALIGN_CONTENT_START, WRAP_NOWRAP, 0.0, 0.0);
        assert!((out[1] - 0.0).abs() < 0.01);
        assert!((out[5] - 0.0).abs() < 0.01);
        assert!((out[9] - 0.0).abs() < 0.01, "item2 stays on same line y={}", out[9]);
        assert!((out[8] - 200.0).abs() < 0.01, "item2 x={}", out[8]);
    }

    #[test]
    fn wrap_each_line_has_min_one_item() {
        // 아이템 하나가 available 초과해도 자기 라인 확보
        let data = flatten(&[item(300.0, 30.0), item(300.0, 30.0)]);
        let out = flex_layout(&data, 250.0, 200.0, DIR_ROW, JUSTIFY_START, ALIGN_START, ALIGN_CONTENT_START, WRAP_WRAP, 0.0, 0.0);
        // 각자 라인: item0 y 0, item1 y 30
        assert!((out[1] - 0.0).abs() < 0.01);
        assert!((out[5] - 30.0).abs() < 0.01, "item1 own line y={}", out[5]);
    }

    #[test]
    fn wrap_grow_applies_per_line() {
        // wrap 후 각 라인 내에서 grow 분배. 2개 basis 100 grow 1, available 250.
        // line1=[0,1] (200 ≤ 250) → free 50 → 각 +25 = 125
        let data = flatten(&[
            with_flex(item(100.0, 30.0), 1.0, 1.0),
            with_flex(item(100.0, 30.0), 1.0, 1.0),
        ]);
        let out = flex_layout(&data, 250.0, 200.0, DIR_ROW, JUSTIFY_START, ALIGN_START, ALIGN_CONTENT_START, WRAP_WRAP, 0.0, 0.0);
        assert!((out[2] - 125.0).abs() < 0.01, "item0 grown width={}", out[2]);
        assert!((out[6] - 125.0).abs() < 0.01, "item1 grown width={}", out[6]);
    }

    // ── align-content ──

    #[test]
    fn align_content_center_two_lines() {
        // 3개 basis 100, available_main 250 → line1=[0,1](200≤250), line2=[2].
        // 2 라인 각 cross 30, available_cross 200 → total 60, free 140, center → start 70
        let data = flatten(&[item(100.0, 30.0), item(100.0, 30.0), item(100.0, 30.0)]);
        let out = flex_layout(&data, 250.0, 200.0, DIR_ROW, JUSTIFY_START, ALIGN_START, ALIGN_CONTENT_CENTER, WRAP_WRAP, 0.0, 0.0);
        // line1 items(0,1) y = 70, line2 item(2) y = 70+30 = 100
        assert!((out[1] - 70.0).abs() < 0.01, "line1 item0 y={}", out[1]);
        assert!((out[5] - 70.0).abs() < 0.01, "line1 item1 y={}", out[5]);
        assert!((out[9] - 100.0).abs() < 0.01, "line2 item2 y={}", out[9]);
    }

    #[test]
    fn gap_cross_between_lines() {
        // 3개 basis 100, available_main 250 → line1=[0,1], line2=[2].
        // gap_cross 10 → line2 y = line1_cross(30) + gap(10) = 40
        let data = flatten(&[item(100.0, 30.0), item(100.0, 30.0), item(100.0, 30.0)]);
        let out = flex_layout(&data, 250.0, 200.0, DIR_ROW, JUSTIFY_START, ALIGN_START, ALIGN_CONTENT_START, WRAP_WRAP, 0.0, 10.0);
        assert!((out[9] - 40.0).abs() < 0.01, "line2 y with gap={}", out[9]);
    }
}
