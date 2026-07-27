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
//! - **main size undefined + stretch 정정 (2026-07-04, seam C-1 후속)**:
//!   `available_main` 음수(sentinel = flexDirection:column + height:auto 등 main
//!   축 크기 미결정) 시 grow/shrink 를 하지 않고 hypothetical(flex-basis) 유지
//!   (intrinsic sizing) — 이전엔 음수를 shrink 로 오처리해 자식 main 축 0 붕괴.
//!   `collect_lines` 도 sentinel 이면 한 라인(max-content) 유지. `ALIGN_STRETCH`
//!   는 cross size 가 auto 일 때만 컨테이너 cross 로 확장 — 명시적 cross size
//!   (column 자식 width:100px 등)는 유지(이전엔 무조건 stretch). 두 정정으로
//!   flex column height:auto 가 dual-run(Taffy self-diff) diff 0 통과.
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
//! ## 필드 계약 (`FLEX_FIELD_COUNT` = 21, 노드당)
//!
//! | off | 필드              | 센티넬                          |
//! | --- | ----------------- | ------------------------------- |
//! | 0   | flex_basis        | AUTO=-1, CONTENT=-2             |
//! | 1   | width             | AUTO=-1 (논리 main)             |
//! | 2   | height            | AUTO=-1 (논리 cross)            |
//! | 3   | margin_top        |                                 |
//! | 4   | margin_right      |                                 |
//! | 5   | margin_bottom     |                                 |
//! | 6   | margin_left       |                                 |
//! | 7   | pad_border_main   | main 축 padding+border 합       |
//! | 8   | pad_border_cross  | cross 축 padding+border 합      |
//! | 9   | min_main          | AUTO=-1                         |
//! | 10  | max_main          | NONE=-1                         |
//! | 11  | min_cross         | AUTO=-1                         |
//! | 12  | max_cross         | NONE=-1                         |
//! | 13  | content_main      | content 크기 (main)             |
//! | 14  | content_cross     | content 크기 (cross)            |
//! | 15  | flex_grow         | ≥0 (default 0)                  |
//! | 16  | flex_shrink       | ≥0 (default 1)                  |
//! | 17  | align_self        | 0=auto(상속) 1=stretch 2=start 3=center 4=end (E1/ADR-156 P2) |
//! | 18  | overflow_main     | 0=visible(zero-init) 1=clipped — item 자신의 주축 overflow (ADR-164 §4.5) |
//! | 19  | content_min_main  | 0=absent(zero-init) — 정확 min-content (main, ADR-165 §4.5 floor 정밀화) |
//! | 20  | margin_auto_mask  | 0=없음(zero-init) — 물리 margin `auto` 비트마스크 (1=top 2=right 4=bottom 8=left) |
//!
//! off 17(`align_self`)은 **0=auto 가 zero-init 기본값 겸 CSS 기본값**이라, 값을 안 쓰는
//! 입력 배열(기존 golden/테스트)은 자동으로 컨테이너 `align_items` 를 상속한다.
//! off 18(`overflow_main`)도 동일 원칙 — **0=visible 이 zero-init 겸 CSS 기본값**.
//! off 19(`content_min_main`)도 동일 원칙 — **0=absent 가 zero-init 겸 fallback**
//! (`content_main` 으로 대체 — ADR-164 상한 근사 동작 유지). min-content 0 은 floor 0
//! = floor 부재와 등가라 absent 와 구분이 필요 없다.
//! off 20(`margin_auto_mask`)도 동일 — **0=auto 없음이 zero-init 겸 기본값**.
//!
//! ## §8.1 auto margin — 정렬보다 **먼저** 여유를 가져간다
//!
//! `margin: auto` 는 해당 축의 양의 여유 공간을 흡수하고, 그 결과 정렬 속성
//! (`justify-content` / `align-items` / `align-self`)은 그 축에서 **무효**가 된다
//! ("the margins will have stolen all the free space"). 흡수는 **라인 단위**다 —
//! main 축은 그 라인의 여유, cross 축은 그 라인의 cross 크기 기준.
//!
//! 세 규칙이 한 묶음이다 (하나만 넣으면 나머지가 어긋난다):
//! - §9.6 step 13 — cross auto margin 이 라인 cross 여유를 균등 흡수. 여유가 음수면
//!   auto margin 은 0 (= 아이템이 라인 시작에 붙고 넘친다).
//! - §9.6 step 14 — cross margin 중 하나라도 auto 면 `align-self` 를 적용하지 않는다.
//! - §9.4 step 11 — `stretch` 는 cross margin 이 **둘 다 auto 가 아닐 때만** 적용된다
//!   (auto margin 이 있으면 아이템은 자기 content 크기를 유지).
//!
//! 흡수 대상 margin 은 상류에서 0 으로 들어오므로(`resolve_signed`), 크기 계산
//! (라인 cross, outer main 합)은 auto 를 0 으로 본 값이 그대로 맞다.
//!
//! ## §4.5 automatic minimum size (ADR-164 도입 / ADR-165 정밀화)
//!
//! `min_main == AUTO` ∧ `overflow_main == visible` ∧ `width == AUTO` 인 item 은
//! content-based minimum 을 used min 으로 쓴다 — shrink 가 그 밑으로 내려가지 않는다.
//! floor 기준값(ADR-165): `content_min_main`(off 19, 정확 min-content = 최장 단어 폭)
//! 이 공급되면 그 값, absent(0)면 `content_main`(단일줄 상한 근사 — ADR-164 동작) —
//! 양쪽 다 `max_main` clamp 동반. **width-auto 한정**인 이유: explicit
//! 노드의 content 슬롯은 tree.rs 가 border-box 를 저장해 content 제안값으로 신뢰
//! 불가하고, width-definite 의 §4.5 floor 는 min(content 제안, specified 제안)이라
//! content 제안값 없이는 과대 floor(Chrome 발산)가 된다. 텍스트 leaf 의 content
//! 제안값은 상류 TS 가 `contentMinWidth`/`contentMaxWidth` 스칼라(NodeStyle)로
//! 공급한다 (ADR-165 측정 계약 — 구 minWidth 채널은 스칼라 계약으로 흡수).
//!
//! main/cross 축은 컨테이너 `flex_direction` 에 따라 물리축(x/y)에 매핑된다.
//! 아이템 필드는 이미 논리축(main/cross) 기준으로 상류에서 변환되어 들어온다.

use wasm_bindgen::prelude::*;

/// 노드당 입력 필드 수.
pub const FLEX_FIELD_COUNT: usize = 21;

/// off 20 `margin_auto_mask` 비트 — 물리 margin 이 `auto` 인지 (§8.1 흡수 대상).
/// 기록(`tree.rs::write_flex_item`)과 해석(`parse_item`)이 **같은 상수**를 쓴다.
pub const MARGIN_AUTO_TOP: u32 = 1;
pub const MARGIN_AUTO_RIGHT: u32 = 2;
pub const MARGIN_AUTO_BOTTOM: u32 = 4;
pub const MARGIN_AUTO_LEFT: u32 = 8;

/// 출력 필드 수 (x, y, width, height).
const OUT_FIELDS: usize = 4;

/// auto / none 센티넬.
const AUTO: f32 = -1.0;
/// flex-basis: content 센티넬.
/// content 센티넬 (flex-basis:content / cross fit-content). tree.rs intake 가
/// cross 축 fit-content 를 본 값으로 write → `parse_item` 이 content_cross 로 해소.
pub const CONTENT: f32 = -2.0;

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

// align_self (per-item cross 정렬, E1). 입력 field(off 17) 값 → 컨테이너 align_items
// override. 0=auto 는 컨테이너 값 상속(CSS `align-self:auto` 기본). 1~4 는 명시.
// **0 이 auto 인 이유**: zero-init 입력 배열이 자동으로 상속(=CSS 기본)이 되어, 값을 안
// 쓰는 기존 golden/테스트 배열이 무변경으로 통과한다.
const ALIGN_SELF_AUTO: u8 = 0;
const ALIGN_SELF_STRETCH: u8 = 1;
const ALIGN_SELF_START: u8 = 2;
const ALIGN_SELF_CENTER: u8 = 3;
const ALIGN_SELF_END: u8 = 4;

/// per-item `align_self`(0=auto/1~4) 를 라인 `align_items`(ALIGN_*) 로 해소.
/// auto → 컨테이너 값 상속, 그 외 → 대응 ALIGN_* 코드.
#[inline]
fn resolve_self_align(align_self: u8, container_align: u8) -> u8 {
    match align_self {
        ALIGN_SELF_STRETCH => ALIGN_STRETCH,
        ALIGN_SELF_START => ALIGN_START,
        ALIGN_SELF_CENTER => ALIGN_CENTER,
        ALIGN_SELF_END => ALIGN_END,
        // ALIGN_SELF_AUTO + 미지의 값 → 컨테이너 상속
        _ => container_align,
    }
}

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
    /// cross size 가 auto 인가 — ALIGN_STRETCH 는 auto 일 때만 컨테이너 cross 로 확장.
    /// 명시적 cross size(예: column 자식 width:100px)는 stretch 대상 아님 (CSS 명세).
    cross_is_auto: bool,
    pad_border_cross: f32,
    margin_main_start: f32,
    margin_main_end: f32,
    margin_cross_start: f32,
    margin_cross_end: f32,
    /// margin 이 `auto` 인가 (§8.1) — 해당 margin 값은 0 으로 들어오고, 배치 시
    /// 라인 여유를 흡수한다. cross 쪽 auto 는 stretch·align-self 도 무효화한다.
    margin_main_start_auto: bool,
    margin_main_end_auto: bool,
    margin_cross_start_auto: bool,
    margin_cross_end_auto: bool,
    min_main: f32,
    max_main: f32,
    min_cross: f32,
    max_cross: f32,
    flex_grow: f32,
    flex_shrink: f32,
    /// per-item cross 정렬(0=auto 상속 / 1~4 명시) — E1. place_line_cross_axis 가
    /// resolve_self_align 으로 컨테이너 align_items 를 override.
    align_self: u8,
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
    // align_self: 0=auto(상속)/1=stretch/2=start/3=center/4=end. 음수/비정상은 auto(0).
    let align_self = {
        let v = data[off + 17];
        if v > 0.0 { v as u8 } else { ALIGN_SELF_AUTO }
    };
    // §4.5 automatic minimum size (ADR-164): min 미명시(auto) + item 주축 overflow
    // visible + width auto → content-based minimum 을 used min 으로 해석. 이후 §9.7
    // clamp/violation 동결 기계가 floor 를 자연 집행한다. width-auto 한정·스칼라
    // 공급 채널 사유는 모듈 doc §4.5 절 참조. min:0 명시는 AUTO 센티넬(-1)과
    // 구분되어 그대로 존중된다 (falsy 함정 없음).
    //
    // ADR-165: floor 기준값은 정확 min-content(`content_min_main`, off 19) 우선 —
    // absent(0)면 `content_main`(단일줄 상한 근사, ADR-164 동작) fallback.
    let overflow_clipped = data[off + 18] != 0.0;
    let content_min_main = data[off + 19];
    let min_main = if min_main == AUTO && !overflow_clipped && width == AUTO {
        let suggestion = if content_min_main > 0.0 { content_min_main } else { content_main };
        let floor = suggestion.max(0.0);
        if max_main != AUTO { floor.min(max_main) } else { floor }
    } else {
        min_main
    };

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

    // cross content 결정:
    //   - AUTO(-1): content 사용 + stretch 대상(cross_is_auto=true).
    //   - CONTENT(-2, fit-content): content 사용하되 stretch 안 함(cross_is_auto=false).
    //     CSS: width/height:fit-content 는 shrink-to-fit — align-items:stretch 무시.
    //   - 명시 px(>=0): 그 값 유지, stretch 안 함.
    // 버그(fix 이전): fit-content 는 tree.rs resolve_dimension_opt 에서 None→AUTO(-1)로
    //   붕괴되어 stretch 됐다(Calendar width 100% 발산). CONTENT 센티넬을 보존하면 여기서
    //   content_cross 로 shrink-to-fit + stretch 제외.
    let cross_is_auto = height == AUTO;
    let cross_content = if cross_is_auto || height == CONTENT {
        clamp_size(content_cross, min_cross, max_cross)
    } else {
        clamp_size(height, min_cross, max_cross)
    };

    // margin 논리 매핑. row: main=left/right, cross=top/bottom / column: 반대
    let (mm_start, mm_end, mc_start, mc_end) = if direction == DIR_ROW {
        (m_left, m_right, m_top, m_bottom)
    } else {
        (m_top, m_bottom, m_left, m_right)
    };
    // auto 플래그도 동일 매핑 (§8.1). 값 자체는 0 으로 들어오므로 위 크기 계산은 무영향.
    let auto_mask = data[off + 20] as u32;
    let (mm_start_auto, mm_end_auto, mc_start_auto, mc_end_auto) = if direction == DIR_ROW {
        (
            auto_mask & MARGIN_AUTO_LEFT != 0,
            auto_mask & MARGIN_AUTO_RIGHT != 0,
            auto_mask & MARGIN_AUTO_TOP != 0,
            auto_mask & MARGIN_AUTO_BOTTOM != 0,
        )
    } else {
        (
            auto_mask & MARGIN_AUTO_TOP != 0,
            auto_mask & MARGIN_AUTO_BOTTOM != 0,
            auto_mask & MARGIN_AUTO_LEFT != 0,
            auto_mask & MARGIN_AUTO_RIGHT != 0,
        )
    };

    FlexItem {
        index: i,
        flex_basis: main_content,
        pad_border_main,
        main_content,
        cross_content,
        cross_is_auto,
        pad_border_cross,
        margin_main_start: mm_start,
        margin_main_end: mm_end,
        margin_cross_start: mc_start,
        margin_cross_end: mc_end,
        margin_main_start_auto: mm_start_auto,
        margin_main_end_auto: mm_end_auto,
        margin_cross_start_auto: mc_start_auto,
        margin_cross_end_auto: mc_end_auto,
        min_main,
        max_main,
        min_cross,
        max_cross,
        flex_grow,
        flex_shrink,
        align_self,
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

    // ── Step 0: main size undefined(sentinel = 음수 available) → intrinsic sizing ──
    // flexDirection:column + height:auto 등 main 축 크기 미결정 시 CSS 는 grow/shrink 를
    // 하지 않고 각 아이템의 hypothetical(flex-basis) 를 유지한다(max-content 기준).
    // available_main 음수를 grow/shrink 분배식에 넣으면 remaining 이 큰 음수가 되어
    // 아이템 main 축이 0 으로 붕괴하므로, 분배 전에 basis 로 확정하고 조기 반환한다.
    if available_main < 0.0 {
        for it in line.iter_mut() {
            it.frozen = true;
            it.target_main = clamp_size(it.flex_basis, it.min_main.max(0.0), it.max_main);
            it.main_content = it.target_main;
        }
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
    // WRAP_NOWRAP, 빈 입력, 또는 main size 미결정(sentinel = 음수 available) 은
    // 모두 한 라인. sentinel 은 wrap 판정 기준(available_main)이 없어 max-content 로
    // 한 라인 유지 — 음수를 초과 판정에 넣으면 각 아이템이 별도 라인으로 잘못 분할된다.
    if wrap == WRAP_NOWRAP || items.is_empty() || available_main < 0.0 {
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
    cross_is_definite: bool,
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
    // cross 가 **indefinite**(컨테이너 height:auto 등) 면 align-content 가 분배할 free
    //   space 자체가 없다 — 컨테이너는 라인 합계로 축소된다(CSS §8.4: align-content 는
    //   컨테이너 cross 가 definite 일 때만 의미). 상속받은 available_cross(부모 폭/높이)를
    //   그대로 쓰면 **없는 여유 공간**을 라인 사이에 분배해 세로 gap 이 폭주한다.
    //
    // **Why (TagGroup side, 2026-07-14)**: TagList(height:auto)가 2줄로 wrap 될 때
    //   available_cross=400(상속 페이지 높이) − 라인합 64 = 336 을 align-content:stretch
    //   가 분배 → 둘째 줄이 y=202 로 밀리고 컨테이너 height 가 232 로 폭주.
    //   단일 라인 경로는 `cross_is_definite` 로 이미 보호돼 있었으나(ToggleButtonGroup
    //   397→30), multi-line 경로는 미보호였다.
    // 위치 정렬(center/end)은 음수 여유를 그대로 쓰고(§4.2 기본 `unsafe`), 분배·stretch 는
    //   음수에서 fallback 으로 떨어져 start 처럼 배치된다 — main 축 `justify-content` 와 동형.
    //   Chrome 실측(2026-07-27, 컨테이너 60 / 두 줄 합 100): center 줄 y=-20·30,
    //   flex-end -40·10, flex-start·stretch·space-between·space-around 는 전부 0·50.
    let cross_free_raw = if cross_is_definite {
        available_cross - total_line_cross
    } else {
        0.0
    };
    let cross_free = cross_free_raw.max(0.0);

    let (mut cross_start_offset, mut cross_between_extra, stretch_extra) =
        align_content_offsets(align_content, cross_free, cross_free_raw, line_count, wrap);
    if wrap == WRAP_NOWRAP {
        // align-content 정렬(center/end/space-*) offset 은 **single-line 컨테이너**에 무효
        //   (CSS §8.4: "no effect on a single-line flex container (i.e. one with flex-wrap:nowrap)").
        // 판정 기준은 `flex-wrap:nowrap` 이지 "결과 라인이 1개"가 아니다 (CSS §5.2) —
        //   wrap 컨테이너는 라인이 1개여도 multi-line 이라 align-content 가 그대로 적용된다.
        cross_start_offset = 0.0;
        cross_between_extra = 0.0;
    }

    // ── 각 라인 배치 ──
    let mut cross_cursor = cross_start_offset;
    for (li, line) in resolved_lines.iter().enumerate() {
        let mut this_line_cross = line_cross_sizes[li];
        if stretch_extra > 0.0 {
            this_line_cross += stretch_extra;
        }
        // single-line(nowrap) + definite: 라인 cross = 컨테이너 cross(available_cross).
        // align-items(center/end/stretch/clamp)가 이 공간 안에서 정렬/채움 (CSS §9.4 step 8:
        //   "If the flex container is single-line and has a definite cross size, the outer cross
        //   size of the flex line is the flex container's inner cross size"). indefinite(height
        //   auto)면 자식 max 유지 → 컨테이너가 content 로 축소(ToggleButtonGroup height 30, 397 아님).
        //
        // **Why `wrap == WRAP_NOWRAP` 이지 `line_count == 1` 이 아닌가 (2026-07-17)**:
        //   CSS §5.2 는 single-line 을 **flex-wrap:nowrap** 으로 정의한다 — wrap 컨테이너는
        //   라인이 1개로 떨어져도 multi-line 이고, 라인 cross 는 자식 max 로 남아 align-content
        //   가 배치한다. `line_count == 1` 로 판정하면 wrap 컨테이너의 유일 라인까지 컨테이너
        //   cross 로 승격시켜 align-content:flex-start 를 무력화한다.
        //   실제 증상: body(display:block, 페이지 높이 definite) > Button 은 block IFC 시뮬레이션
        //   (INLINE_BLOCK_PARENT_CONFIG = wrap + align-items:center + align-content:flex-start)
        //   을 타는데, 라인이 페이지 높이로 승격되며 align-items:center 가 Button 을 세로 중앙에
        //   배치 → CSS(좌상단)와 Skia(좌중앙) 비대칭. wrap 이면 승격하지 않아야 상단에 쌓인다.
        //
        // **Why `max` 가 아니라 대입인가 (2026-07-27)**: §9.4 step 8 은 "**is** the flex
        //   container's inner cross size" — 라인이 컨테이너보다 커도 라인 cross 는 컨테이너
        //   cross 이고, 넘치는 아이템이 라인 **밖으로** 흘러넘친다. `max` 로 라인을 아이템에
        //   맞춰 키우면 `align-items:stretch` 가 그 커진 라인을 채워 **auto-cross 아이템이
        //   내용까지 자란다**(CSS 는 컨테이너에서 자름). 실측: 확정 높이 100 밴드 안의
        //   height:auto 자식이 내용 300 일 때 DOM 100 / 엔진 300 (row·column 동형).
        //   `align-items:flex-start` 는 아이템이 자기 크기를 유지하므로 종전에도 정합이었고,
        //   그래서 `flexSweep`(definite cross 를 줄 합보다 크게 잡는 구성)에 안 걸렸다.
        //
        // 한편 아이템이 넘치더라도 **라인 cross 를 컨테이너로 확정**해야 center/end 정렬의
        //   기준면이 컨테이너가 된다(§8.3 — 넘침은 양방향으로 균등).
        if wrap == WRAP_NOWRAP && cross_is_definite {
            this_line_cross = available_cross;
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
///
/// `cross_free` = 0 하한 여유 (분배·stretch 용 — 음수면 fallback 으로 start 처럼 배치),
/// `cross_free_raw` = 음수 허용 여유 (위치 정렬 center/end 용 — CSS-ALIGN-3 §4.2 `unsafe`).
fn align_content_offsets(
    align_content: u8,
    cross_free: f32,
    cross_free_raw: f32,
    line_count: usize,
    wrap: u8,
) -> (f32, f32, f32) {
    if line_count == 0 {
        return (0.0, 0.0, 0.0);
    }
    match align_content {
        ALIGN_CONTENT_STRETCH => {
            if wrap == WRAP_NOWRAP {
                // single-line(nowrap): align-content stretch 무효(CSS §8.4). 라인 부풀리기 없음 —
                //   라인 cross 는 호출부의 §9.4 step 8 승격이 이미 컨테이너 cross 로 맞춘다.
                // 자식 stretch(align-items:stretch)는 place_line_cross_axis 가 available_cross 로 별도 처리.
                //
                // 판정은 `flex-wrap:nowrap` 기준 (CSS §5.2) — wrap 컨테이너는 라인이 1개여도
                //   multi-line 이라 §9.4 step 9 로 그 유일 라인이 컨테이너 cross 를 채워야 한다.
                (0.0, 0.0, 0.0)
            } else {
                // 여유를 라인마다 균등 분배 (라인 cross 크기 증가)
                let per_line = cross_free / line_count as f32;
                (0.0, 0.0, per_line)
            }
        }
        ALIGN_CONTENT_CENTER => (cross_free_raw / 2.0, 0.0, 0.0),
        ALIGN_CONTENT_END => (cross_free_raw, 0.0, 0.0),
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
    // 위치 정렬(center/end)은 **음수 여유를 그대로** 쓴다 (CSS-ALIGN-3 §4.2 기본 `unsafe`) —
    //   아이템이 컨테이너보다 크면 center 는 양쪽으로, end 는 시작 쪽으로 넘친다.
    // 분배 정렬(space-*)은 음수에서 fallback 으로 떨어져 **start 처럼** 배치된다.
    //   Chrome 실측(2026-07-27, 컨테이너 100 / 아이템 300): center -100, flex-end -200,
    //   space-between·around·evenly 는 셋 다 0. 즉 분배값의 클램프는 결함이 아니라 정답이라
    //   두 계열을 분리한다 — 한쪽 값만 쓰면 반대쪽이 깨진다.
    //
    // 단 main 축 크기가 **미결정**(sentinel 음수 — `flex-direction:column` + `height:auto`
    //   등)이면 컨테이너가 내용으로 축소되므로 분배할 여유 공간이 **애초에 없다**(CSS §9.7:
    //   free space 는 definite main size 에서만 산출). 센티넬을 그대로 빼면 `-1 - total`
    //   이라는 가짜 음수 여유가 생겨 center/end 가 아이템을 컨테이너 **위로** 밀어내고,
    //   auto height 는 그만큼 줄어든다. `resolve_flexible_lengths`/`collect_lines`/
    //   main 축 auto margin 흡수(tree.rs)와 **동일 가드**.
    let free_main_raw = if available_main < 0.0 {
        0.0
    } else {
        available_main - total_main
    };
    let free_main = free_main_raw.max(0.0);

    // §8.1 — auto margin 이 있으면 그것이 여유를 **먼저** 가져가고 justify-content 는
    //   무효가 된다. 흡수는 이 라인의 여유 기준 (multi-line 에서 라인마다 다르다).
    //   음수 여유는 흡수 없음 — `free_main` 이 0 하한이라 share 도 0 이 된다.
    let main_auto_count: usize = line
        .iter()
        .map(|it| it.margin_main_start_auto as usize + it.margin_main_end_auto as usize)
        .sum();
    let main_auto_share = if main_auto_count > 0 {
        free_main / main_auto_count as f32
    } else {
        0.0
    };

    let (start_offset, between_extra) = if main_auto_count > 0 {
        (0.0, 0.0)
    } else {
        match justify_content {
        JUSTIFY_CENTER => (free_main_raw / 2.0, 0.0),
        JUSTIFY_END => (free_main_raw, 0.0),
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
        }
    };

    let mut cursor = start_offset;
    for (i, it) in line.iter().enumerate() {
        cursor += it.margin_main_start;
        if it.margin_main_start_auto {
            cursor += main_auto_share;
        }
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
        if it.margin_main_end_auto {
            cursor += main_auto_share;
        }
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
        // **음수 free space 를 0 으로 클램프하지 않는다** (CSS-ALIGN-3 §4.2 — 기본 정렬은
        //   `unsafe`). 아이템이 라인보다 크면 center 는 양쪽으로 균등하게, end 는 시작 쪽으로
        //   넘쳐야 한다 (CSS-FLEXBOX §8.3 "it will overflow equally in both directions").
        //   클램프하면 두 정렬이 overflow 상황에서 조용히 start 로 무너진다 — `safe` 키워드를
        //   쓴 것과 같은 동작이고, composition 은 그 키워드를 소비하지 않는다.
        // Chrome 실측(crossAxisOverflow.browser.test.ts): 라인 100 + 아이템 300 →
        //   center y=-100 / end y=-200 (구 엔진은 둘 다 0).
        let cross_free = cross_avail - item_cross_border;

        // §9.6 step 13/14 + §9.4 step 11 — cross margin 이 하나라도 `auto` 면 그 margin 이
        //   라인 cross 여유를 흡수하고, **align-self·stretch 는 무효**가 된다. 세 규칙이
        //   한 묶음이라 여기서 함께 처리한다 (align 분기보다 먼저).
        // 여유가 음수면 auto margin 은 0 — 아이템이 라인 시작에 붙고 넘친다(§9.6 step 13
        //   후단). `cross_free.max(0.0)` 이 그 동작이다.
        let cross_auto_count =
            it.margin_cross_start_auto as usize + it.margin_cross_end_auto as usize;
        if cross_auto_count > 0 {
            let share = cross_free.max(0.0) / cross_auto_count as f32;
            let lead = if it.margin_cross_start_auto { share } else { 0.0 };
            let cross_pos = line_cross_start + it.margin_cross_start + lead;
            write_physical(
                out,
                out_off,
                direction,
                main_pos,
                cross_pos,
                main_size,
                item_cross_border,
            );
            continue;
        }

        // per-item align_self 가 컨테이너 align_items 를 override (E1). auto → 상속.
        let effective_align = resolve_self_align(it.align_self, align_items);
        let (cross_pos_local, cross_final) = match effective_align {
            // stretch 는 cross size 가 auto 일 때만 컨테이너 cross 로 확장한다 (CSS 명세).
            // 명시적 cross size(예: column 자식 width:100px)는 그 값을 유지 —
            // start 정렬처럼 배치하되 크기는 border-box content 유지.
            ALIGN_STRETCH if it.cross_is_auto => {
                let stretched = clamp_size(cross_avail, it.min_cross, it.max_cross);
                (it.margin_cross_start, stretched)
            }
            ALIGN_CENTER => (it.margin_cross_start + cross_free / 2.0, item_cross_border),
            ALIGN_END => (it.margin_cross_start + cross_free, item_cross_border),
            // ALIGN_START (default) + ALIGN_STRETCH with explicit cross size
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
        true, // cross_is_definite — 헬퍼는 available_cross 를 컨테이너 크기로 가정(기존 시맨틱)
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

    /// align_self(off 17) 설정 헬퍼 — 0=auto/1=stretch/2=start/3=center/4=end.
    fn with_align_self(mut f: [f32; FLEX_FIELD_COUNT], code: f32) -> [f32; FLEX_FIELD_COUNT] {
        f[17] = code;
        f
    }

    // ── E1 align-self (ADR-156 Phase 2) ──

    #[test]
    fn align_self_end_overrides_container_start() {
        // 컨테이너 align_items=START, 자식 align_self=END → 자식이 cross 끝(row: y=80).
        let child = with_align_self(item(50.0, 20.0), 4.0); // 4=END
        let data = flatten(&[child]);
        let out = flex_layout_single_line(&data, 300.0, 100.0, DIR_ROW, JUSTIFY_START, ALIGN_START, 0.0);
        assert_eq!(out[1], 80.0); // available_cross 100 - h 20
    }

    #[test]
    fn align_self_center_overrides_container_stretch_and_keeps_size() {
        // 컨테이너 STRETCH, 자식 align_self=CENTER + 명시 cross(h=30) → 중앙 배치 + 크기 유지(stretch 안 함).
        let child = with_align_self(item(50.0, 30.0), 3.0); // 3=CENTER
        let data = flatten(&[child]);
        let out = flex_layout_single_line(&data, 300.0, 100.0, DIR_ROW, JUSTIFY_START, ALIGN_STRETCH, 0.0);
        assert_eq!(out[1], 35.0); // (100-30)/2
        assert_eq!(out[3], 30.0); // 크기 보존 — stretch 미적용
    }

    #[test]
    fn align_self_auto_inherits_container_center() {
        // 자식 align_self=auto(0) → 컨테이너 align_items=CENTER 상속.
        let child = item(50.0, 20.0); // field 17 = 0 = auto
        let data = flatten(&[child]);
        let out = flex_layout_single_line(&data, 300.0, 100.0, DIR_ROW, JUSTIFY_START, ALIGN_CENTER, 0.0);
        assert_eq!(out[1], 40.0); // (100-20)/2 — 상속된 center
    }

    #[test]
    fn align_self_stretch_overrides_container_start() {
        // 컨테이너 START, 자식 align_self=stretch + auto cross → 컨테이너 cross 채움.
        let mut f = item(50.0, AUTO);
        f[2] = AUTO;
        let child = with_align_self(f, 1.0); // 1=STRETCH
        let data = flatten(&[child]);
        let out = flex_layout_single_line(&data, 300.0, 100.0, DIR_ROW, JUSTIFY_START, ALIGN_START, 0.0);
        assert_eq!(out[3], 100.0); // cross 채움
    }

    #[test]
    fn align_self_column_end_maps_to_x() {
        // column 컨테이너: cross=x. 자식 align_self=END → 자식이 cross 끝(x).
        // available_cross(=width)=200, 자식 width=40 → END → x=160.
        let child = with_align_self(item(30.0, 40.0), 4.0); // main=height 30, cross=width 40
        let data = flatten(&[child]);
        let out = flex_layout_single_line(&data, 300.0, 200.0, DIR_COLUMN, JUSTIFY_START, ALIGN_START, 0.0);
        assert_eq!(out[0], 160.0); // column cross = x = 200 - 40
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
        let out = flex_layout(&data, 200.0, 100.0, DIR_ROW, JUSTIFY_START, ALIGN_START, ALIGN_CONTENT_STRETCH, WRAP_NOWRAP, 0.0, 0.0, false);
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
        let out = flex_layout(&data, 250.0, 100.0, DIR_ROW, JUSTIFY_START, ALIGN_START, ALIGN_CONTENT_STRETCH, WRAP_NOWRAP, 0.0, 0.0, false);
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
        let out = flex_layout(&data, 300.0, 100.0, DIR_ROW, JUSTIFY_START, ALIGN_START, ALIGN_CONTENT_STRETCH, WRAP_NOWRAP, 0.0, 0.0, false);
        assert!((out[2] - 120.0).abs() < 0.01, "item0 clamped width={}", out[2]);
        assert!((out[6] - 180.0).abs() < 0.01, "item1 redistributed width={}", out[6]);
    }

    #[test]
    fn grow_zero_stays_at_basis() {
        // grow 0 → basis 유지, 여유 공간 분배 없음
        let data = flatten(&[item(50.0, 20.0), item(50.0, 20.0)]);
        let out = flex_layout(&data, 300.0, 100.0, DIR_ROW, JUSTIFY_START, ALIGN_START, ALIGN_CONTENT_STRETCH, WRAP_NOWRAP, 0.0, 0.0, false);
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
        let out = flex_layout(&data, 150.0, 100.0, DIR_ROW, JUSTIFY_START, ALIGN_START, ALIGN_CONTENT_STRETCH, WRAP_NOWRAP, 0.0, 0.0, false);
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
        let out = flex_layout(&data, 150.0, 100.0, DIR_ROW, JUSTIFY_START, ALIGN_START, ALIGN_CONTENT_STRETCH, WRAP_NOWRAP, 0.0, 0.0, false);
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
        let out = flex_layout(&data, 100.0, 100.0, DIR_ROW, JUSTIFY_START, ALIGN_START, ALIGN_CONTENT_STRETCH, WRAP_NOWRAP, 0.0, 0.0, false);
        assert!((out[2] - 80.0).abs() < 0.01, "item0 min-clamped width={}", out[2]);
        assert!((out[6] - 20.0).abs() < 0.01, "item1 absorbed width={}", out[6]);
    }

    // ── §9.3 flex-wrap ──

    #[test]
    fn wrap_breaks_into_two_lines() {
        // 3개 basis 100, available 250, wrap. line1=[0,1](200), line2=[2]
        let data = flatten(&[item(100.0, 30.0), item(100.0, 30.0), item(100.0, 30.0)]);
        let out = flex_layout(&data, 250.0, 200.0, DIR_ROW, JUSTIFY_START, ALIGN_START, ALIGN_CONTENT_START, WRAP_WRAP, 0.0, 0.0, false);
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
        let out = flex_layout(&data, 250.0, 200.0, DIR_ROW, JUSTIFY_START, ALIGN_START, ALIGN_CONTENT_START, WRAP_NOWRAP, 0.0, 0.0, false);
        assert!((out[1] - 0.0).abs() < 0.01);
        assert!((out[5] - 0.0).abs() < 0.01);
        assert!((out[9] - 0.0).abs() < 0.01, "item2 stays on same line y={}", out[9]);
        assert!((out[8] - 200.0).abs() < 0.01, "item2 x={}", out[8]);
    }

    #[test]
    fn wrap_each_line_has_min_one_item() {
        // 아이템 하나가 available 초과해도 자기 라인 확보
        let data = flatten(&[item(300.0, 30.0), item(300.0, 30.0)]);
        let out = flex_layout(&data, 250.0, 200.0, DIR_ROW, JUSTIFY_START, ALIGN_START, ALIGN_CONTENT_START, WRAP_WRAP, 0.0, 0.0, false);
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
        let out = flex_layout(&data, 250.0, 200.0, DIR_ROW, JUSTIFY_START, ALIGN_START, ALIGN_CONTENT_START, WRAP_WRAP, 0.0, 0.0, false);
        assert!((out[2] - 125.0).abs() < 0.01, "item0 grown width={}", out[2]);
        assert!((out[6] - 125.0).abs() < 0.01, "item1 grown width={}", out[6]);
    }

    // ── align-content ──

    #[test]
    fn align_content_center_two_lines() {
        // 3개 basis 100, available_main 250 → line1=[0,1](200≤250), line2=[2].
        // 2 라인 각 cross 30, available_cross 200 → total 60, free 140, center → start 70
        //
        // `cross_is_definite=true` 필수 (2026-07-14): align-content 는 컨테이너 cross 가
        //   **definite 일 때만** free space 를 분배한다(CSS §8.4). indefinite 면 컨테이너가
        //   라인 합계로 축소되므로 분배할 공간 자체가 없다. 본 테스트는 center 분배를
        //   검증하는 것이므로 definite 로 호출한다 (기존엔 false 였으나, 그 전제로 분배가
        //   일어나던 것이 TagGroup side 의 세로 gap 폭주 근본이었다 —
        //   indefinite 미분배는 `multi_line_indefinite_align_content_does_not_distribute` 가 가드).
        let data = flatten(&[item(100.0, 30.0), item(100.0, 30.0), item(100.0, 30.0)]);
        let out = flex_layout(&data, 250.0, 200.0, DIR_ROW, JUSTIFY_START, ALIGN_START, ALIGN_CONTENT_CENTER, WRAP_WRAP, 0.0, 0.0, true);
        // line1 items(0,1) y = 70, line2 item(2) y = 70+30 = 100
        assert!((out[1] - 70.0).abs() < 0.01, "line1 item0 y={}", out[1]);
        assert!((out[5] - 70.0).abs() < 0.01, "line1 item1 y={}", out[5]);
        assert!((out[9] - 100.0).abs() < 0.01, "line2 item2 y={}", out[9]);
    }

    #[test]
    fn multi_line_indefinite_align_content_does_not_distribute() {
        // **회귀 게이트 (TagGroup labelPosition="side", 2026-07-14)**: 컨테이너 cross 가
        //   indefinite(height:auto) 면 align-content 는 분배할 free space 가 없다.
        //   상속 available_cross(부모 높이)를 그대로 쓰면 **없는 여유 공간**을 라인 사이에
        //   분배해 세로 gap 이 폭주한다 (TagList 2줄 → 둘째 줄 y=202, height 232).
        //   단일 라인은 `cross_is_definite` 로 이미 보호돼 있었으나(ToggleButtonGroup 397→30),
        //   multi-line 경로가 미보호였다.
        let data = flatten(&[item(100.0, 30.0), item(100.0, 30.0), item(100.0, 30.0)]);
        // available_cross 400(상속 페이지 높이) 이지만 indefinite → 분배 없음.
        let out = flex_layout(&data, 250.0, 400.0, DIR_ROW, JUSTIFY_START, ALIGN_START, ALIGN_CONTENT_STRETCH, WRAP_WRAP, 0.0, 4.0, false);
        assert!((out[1] - 0.0).abs() < 0.01, "line1 y=0, got {}", out[1]);
        assert!(
            (out[9] - 34.0).abs() < 0.01,
            "line2 y = line1 cross(30) + gap_cross(4) = 34 — 분배되면 커진다. got {}",
            out[9]
        );
    }

    #[test]
    fn gap_cross_between_lines() {
        // 3개 basis 100, available_main 250 → line1=[0,1], line2=[2].
        // gap_cross 10 → line2 y = line1_cross(30) + gap(10) = 40
        let data = flatten(&[item(100.0, 30.0), item(100.0, 30.0), item(100.0, 30.0)]);
        let out = flex_layout(&data, 250.0, 200.0, DIR_ROW, JUSTIFY_START, ALIGN_START, ALIGN_CONTENT_START, WRAP_WRAP, 0.0, 10.0, false);
        assert!((out[9] - 40.0).abs() < 0.01, "line2 y with gap={}", out[9]);
    }

    // ── main available 음수(sentinel = height:auto 등 undefined main) — intrinsic sizing ──

    #[test]
    fn sentinel_main_no_grow_shrink_keeps_basis() {
        // available_main = -1 (main size undefined, 예: flexDirection:column + height:auto).
        // CSS: main size 미결정 → grow/shrink 안 함, 각 아이템 hypothetical(basis) 유지.
        // 회귀 전(버그): -1 을 shrink 로 오판 → remaining 음수 → 아이템 main 축 0 붕괴.
        let data = flatten(&[item(30.0, 100.0), item(40.0, 100.0)]);
        let out = flex_layout(
            &data, -1.0, 200.0, DIR_ROW, JUSTIFY_START, ALIGN_START,
            ALIGN_CONTENT_START, WRAP_NOWRAP, 0.0, 0.0, false,
        );
        // 아이템 main(width) 은 basis 유지 (30, 40) — 0 붕괴 없음
        assert!((out[2] - 30.0).abs() < 0.01, "item0 width={} (expect 30)", out[2]);
        assert!((out[6] - 40.0).abs() < 0.01, "item1 width={} (expect 40)", out[6]);
        // main 축 순차 배치 (x: 0, 30)
        assert!((out[0] - 0.0).abs() < 0.01, "item0 x={}", out[0]);
        assert!((out[4] - 30.0).abs() < 0.01, "item1 x={} (expect 30)", out[4]);
    }

    #[test]
    fn sentinel_main_column_stacks_children() {
        // flexDirection:column + height:auto 실전 케이스. main=height 축, available_main=-1.
        // 자식 논리 main(height) = 30, 40 유지 + y 순차 배치 (0, 30).
        // item(width, height): DIR_COLUMN 이면 논리 main=height 축값이 f[1](width 슬롯)에 온다
        // → tree.rs 가 column 일 때 height 를 논리 main 으로 매핑. 여기선 직접 논리축으로 구성.
        let data = flatten(&[item(30.0, 100.0), item(40.0, 100.0)]);
        let out = flex_layout(
            &data, -1.0, 200.0, DIR_COLUMN, JUSTIFY_START, ALIGN_START,
            ALIGN_CONTENT_START, WRAP_NOWRAP, 0.0, 0.0, false,
        );
        // DIR_COLUMN: 논리 main(f[1]=30,40) → 물리 height(out h), y 순차 배치
        assert!((out[3] - 30.0).abs() < 0.01, "item0 height={} (expect 30)", out[3]);
        assert!((out[7] - 40.0).abs() < 0.01, "item1 height={} (expect 40)", out[7]);
        assert!((out[1] - 0.0).abs() < 0.01, "item0 y={}", out[1]);
        assert!((out[5] - 30.0).abs() < 0.01, "item1 y={} (expect 30)", out[5]);
    }

    #[test]
    fn stretch_respects_explicit_cross_size() {
        // ALIGN_STRETCH 지만 자식 cross(height) 가 명시(30px)면 stretch 하지 않고 30 유지.
        // CSS: align-items:stretch 는 cross size 가 auto 일 때만 적용.
        // 버그: 명시 cross 를 무시하고 컨테이너 cross(100)로 stretch.
        let data = flatten(&[item(50.0, 30.0)]); // cross(height)=30 명시
        let out = flex_layout_single_line(
            &data, 300.0, 100.0, DIR_ROW, JUSTIFY_START, ALIGN_STRETCH, 0.0,
        );
        // cross(height) = 명시 30 유지 (stretch 로 100 되면 안 됨)
        assert!((out[3] - 30.0).abs() < 0.01, "cross height={} (expect 30, not stretched)", out[3]);
    }

    #[test]
    fn stretch_still_fills_when_cross_auto() {
        // 회귀 방지: cross(height)=AUTO 면 여전히 stretch 로 컨테이너 cross 채움.
        let mut f = item(50.0, AUTO);
        f[2] = AUTO; // cross auto
        let data = flatten(&[f]);
        let out = flex_layout_single_line(
            &data, 300.0, 100.0, DIR_ROW, JUSTIFY_START, ALIGN_STRETCH, 0.0,
        );
        assert!((out[3] - 100.0).abs() < 0.01, "cross height={} (expect stretch 100)", out[3]);
    }

    #[test]
    fn stretch_clamps_auto_cross_to_definite_container() {
        // §9.4 step 8 은 대입 — single-line + definite cross 면 라인 cross = 컨테이너 cross.
        // 내용이 컨테이너보다 커도(content_cross=300 vs 컨테이너 100) stretch 는 컨테이너에서
        // 자른다. 라인을 아이템에 맞춰 키우면(구 `max`) 아이템이 내용까지 자랐다.
        // Chrome 실측 대조: crossAxisOverflow.browser.test.ts "row/stretch 내용>컨테이너".
        let mut f = item(50.0, AUTO);
        f[2] = AUTO; // cross auto → stretch 대상
        f[14] = 300.0; // content_cross = 내용이 컨테이너(100) 초과
        let data = flatten(&[f]);
        let out = flex_layout_single_line(
            &data, 300.0, 100.0, DIR_ROW, JUSTIFY_START, ALIGN_STRETCH, 0.0,
        );
        assert!(
            (out[3] - 100.0).abs() < 0.01,
            "cross height={} (expect clamp 100, not content 300)",
            out[3]
        );
    }

    #[test]
    fn overflowing_item_keeps_size_and_line_origin_when_not_stretched() {
        // 회귀 방지: 같은 초과 상황에서 stretch 가 아니면(START) 아이템은 자기 크기를
        // 유지하고 라인 원점에 놓인다 — 넘침은 라인 밖으로 흘러야 한다(자르지 않음).
        let mut f = item(50.0, AUTO);
        f[2] = AUTO;
        f[14] = 300.0;
        let data = flatten(&[f]);
        let out = flex_layout_single_line(
            &data, 300.0, 100.0, DIR_ROW, JUSTIFY_START, ALIGN_START, 0.0,
        );
        assert!((out[3] - 300.0).abs() < 0.01, "cross height={} (expect 300)", out[3]);
        assert!((out[1] - 0.0).abs() < 0.01, "cross y={} (expect 0)", out[1]);
    }

    #[test]
    fn center_and_end_overflow_cross_axis_unsafely() {
        // CSS-ALIGN-3 §4.2 기본 정렬은 `unsafe` — 아이템이 라인보다 크면 center 는 양쪽으로
        // 균등하게, end 는 시작 쪽으로 넘친다. 음수 free space 를 0 으로 클램프하면 두 정렬이
        // overflow 에서 start 로 무너진다.
        // Chrome 실측 대조: crossAxisOverflow.browser.test.ts "row/center·flex-end 내용>컨테이너".
        let mut f = item(50.0, 300.0); // cross(height)=300 명시 > 라인 100
        f[2] = 300.0;
        let data = flatten(&[f]);

        let centered = flex_layout_single_line(
            &data, 300.0, 100.0, DIR_ROW, JUSTIFY_START, ALIGN_CENTER, 0.0,
        );
        assert!(
            (centered[1] - (-100.0)).abs() < 0.01,
            "center cross y={} (expect -100)",
            centered[1]
        );

        let ended = flex_layout_single_line(
            &data, 300.0, 100.0, DIR_ROW, JUSTIFY_START, ALIGN_END, 0.0,
        );
        assert!(
            (ended[1] - (-200.0)).abs() < 0.01,
            "end cross y={} (expect -200)",
            ended[1]
        );
    }

    #[test]
    fn justify_center_end_overflow_unsafely_but_distributed_falls_back() {
        // main 축도 같은 규칙 — 단 분배 정렬은 음수에서 fallback(start) 이다.
        // Chrome 실측(컨테이너 100 / 아이템 300): center -100 / end -200 /
        //   space-between·around·evenly 0. 분배값의 0 클램프는 정답이므로 유지한다.
        let mut f = item(300.0, 40.0); // main(width)=300 > 컨테이너 100
        f[16] = 0.0; // flex_shrink=0 — 줄어들지 않게
        let data = flatten(&[f]);
        let at = |justify: u8| {
            flex_layout_single_line(&data, 100.0, 200.0, DIR_ROW, justify, ALIGN_START, 0.0)[0]
        };
        assert!((at(JUSTIFY_CENTER) - (-100.0)).abs() < 0.01, "center x={}", at(JUSTIFY_CENTER));
        assert!((at(JUSTIFY_END) - (-200.0)).abs() < 0.01, "end x={}", at(JUSTIFY_END));
        for j in [JUSTIFY_SPACE_BETWEEN, JUSTIFY_SPACE_AROUND, JUSTIFY_SPACE_EVENLY] {
            assert!((at(j) - 0.0).abs() < 0.01, "distributed({}) x={} (expect 0)", j, at(j));
        }
    }

    #[test]
    fn align_content_center_end_overflow_unsafely_but_distributed_falls_back() {
        // 라인 간 배치(multi-line)도 같은 규칙. Chrome 실측(컨테이너 cross 60 / 두 줄 합 100):
        //   center 줄 y = -20·30, flex-end = -40·10, 나머지(start/stretch/space-*) = 0·50.
        let mut f = item(80.0, 50.0);
        f[16] = 0.0; // flex_shrink=0
        let data = flatten(&[f, f]);
        // main 100 에 80 짜리 둘 → wrap 으로 2 라인, 라인 합 100 > 컨테이너 cross 60
        let at = |ac: u8| {
            let out = flex_layout(
                &data, 100.0, 60.0, DIR_ROW, JUSTIFY_START, ALIGN_START, ac, WRAP_WRAP, 0.0, 0.0,
                true,
            );
            (out[1], out[5])
        };
        assert_eq!(
            (at(ALIGN_CONTENT_CENTER).0.round(), at(ALIGN_CONTENT_CENTER).1.round()),
            (-20.0, 30.0)
        );
        assert_eq!(
            (at(ALIGN_CONTENT_END).0.round(), at(ALIGN_CONTENT_END).1.round()),
            (-40.0, 10.0)
        );
        for ac in [
            ALIGN_CONTENT_START,
            ALIGN_CONTENT_STRETCH,
            ALIGN_CONTENT_SPACE_BETWEEN,
            ALIGN_CONTENT_SPACE_AROUND,
        ] {
            assert_eq!((at(ac).0.round(), at(ac).1.round()), (0.0, 50.0), "ac={ac}");
        }
    }

    #[test]
    fn indefinite_main_makes_justify_content_a_no_op() {
        // `flex-direction:column` + `height:auto` 는 main 축 크기가 미결정이라
        //   `available_main` 이 센티넬(-1)로 들어온다. 컨테이너가 내용으로 축소되므로
        //   분배할 여유 공간이 없다 = justify-content 6종 전부 no-op 이어야 한다.
        //
        // **회귀 실측(2026-07-27, ListBoxItem origin)**: 센티넬을 여유로 오해해
        //   `-1 - 76` 의 절반(-38.5)만큼 자식을 위로 밀어냈다 — 아이콘/라벨/설명이 행
        //   위로 삐져나가고 auto height 가 84 → 45.5 로 줄었다. catalog containerStyles
        //   의 `justify-content:center` 를 가진 column + auto height 컨테이너 전반이 대상.
        let mut f = item(24.0, 100.0); // 논리 main(=height) 24
        f[16] = 0.0; // flex_shrink=0
        let data = flatten(&[f, f, f]);
        for justify in [
            JUSTIFY_START,
            JUSTIFY_CENTER,
            JUSTIFY_END,
            JUSTIFY_SPACE_BETWEEN,
            JUSTIFY_SPACE_AROUND,
            JUSTIFY_SPACE_EVENLY,
        ] {
            let out = flex_layout(
                &data,
                -1.0, // available_main 센티넬 (height:auto)
                366.0,
                DIR_COLUMN,
                justify,
                ALIGN_START,
                ALIGN_CONTENT_STRETCH,
                WRAP_NOWRAP,
                2.0, // gap
                0.0,
                false, // cross indefinite
            );
            let ys = [out[1], out[5], out[9]];
            assert_eq!(ys, [0.0, 26.0, 52.0], "justify={justify} ys={ys:?}");
        }
    }

    #[test]
    fn center_and_end_unchanged_when_item_fits() {
        // 회귀 방지: 여유가 양수면 종전 그대로 (클램프 제거가 정상 경로를 안 건드린다).
        let f = item(50.0, 40.0);
        let data = flatten(&[f]);

        let centered = flex_layout_single_line(
            &data, 300.0, 100.0, DIR_ROW, JUSTIFY_START, ALIGN_CENTER, 0.0,
        );
        assert!((centered[1] - 30.0).abs() < 0.01, "center y={} (expect 30)", centered[1]);

        let ended = flex_layout_single_line(
            &data, 300.0, 100.0, DIR_ROW, JUSTIFY_START, ALIGN_END, 0.0,
        );
        assert!((ended[1] - 60.0).abs() < 0.01, "end y={} (expect 60)", ended[1]);
    }

    #[test]
    fn fit_content_cross_uses_content_not_stretch() {
        // ALIGN_STRETCH + 자식 cross(height) = FIT_CONTENT(=CONTENT 센티넬 -2) 면
        // content_cross(60) 로 shrink-to-fit — stretch(컨테이너 cross 100) 안 함.
        // CSS: width/height: fit-content 는 auto 와 달리 content 폭으로 축소, stretch 대상 아님.
        // 버그(현재): resolve_dimension_opt 가 fit-content(-2)를 None→AUTO(-1)로 붕괴 →
        //   cross_is_auto=true → 컨테이너 cross 로 stretch (Calendar width 100% 발산).
        // 실전: Calendar(부모 flex-column, width:fit-content) 가 부모 폭 전체로 stretch.
        let mut f = item(50.0, CONTENT); // cross(height) = FIT_CONTENT 센티넬
        f[14] = 60.0; // content_cross = 자식 intrinsic content 폭 60
        let data = flatten(&[f]);
        let out = flex_layout_single_line(
            &data, 300.0, 100.0, DIR_ROW, JUSTIFY_START, ALIGN_STRETCH, 0.0,
        );
        // cross(height) = content 60 (stretch 100 아님)
        assert!(
            (out[3] - 60.0).abs() < 0.01,
            "cross height={} (expect fit-content 60, not stretched 100)",
            out[3]
        );
    }

    #[test]
    fn sentinel_main_wrap_stays_single_line() {
        // WRAP_WRAP + available_main=-1(sentinel): main size 미결정 → wrap 기준 없음 →
        // 한 라인(max-content) 유지. 버그: collect_lines 가 outer > -1 을 항상 초과로
        // 판정해 각 아이템 별도 라인 → cross 축으로 잘못 쌓임.
        let data = flatten(&[item(30.0, 20.0), item(40.0, 20.0)]);
        let out = flex_layout(
            &data, -1.0, 200.0, DIR_ROW, JUSTIFY_START, ALIGN_START,
            ALIGN_CONTENT_START, WRAP_WRAP, 0.0, 0.0, false,
        );
        // 한 라인이면 두 아이템 같은 y(0), x 순차(0, 30)
        assert!((out[1] - 0.0).abs() < 0.01, "item0 y={} (single line)", out[1]);
        assert!((out[5] - 0.0).abs() < 0.01, "item1 y={} (single line, expect 0)", out[5]);
        assert!((out[4] - 30.0).abs() < 0.01, "item1 x={} (expect 30)", out[4]);
    }

    #[test]
    fn sentinel_main_still_grows_when_available_positive() {
        // 회귀 방지: available_main 양수면 기존 grow/shrink 정상 동작 유지.
        let data = flatten(&[
            with_flex(item(100.0, 30.0), 1.0, 1.0),
            with_flex(item(100.0, 30.0), 1.0, 1.0),
        ]);
        let out = flex_layout(
            &data, 300.0, 200.0, DIR_ROW, JUSTIFY_START, ALIGN_START,
            ALIGN_CONTENT_START, WRAP_NOWRAP, 0.0, 0.0, false,
        );
        // free 100 → 각 +50 = 150
        assert!((out[2] - 150.0).abs() < 0.01, "item0 grown={}", out[2]);
        assert!((out[6] - 150.0).abs() < 0.01, "item1 grown={}", out[6]);
    }

    // ── 단일 라인 align-content 무효화 (CSS §8.4) ──

    #[test]
    fn single_line_align_content_stretch_does_not_expand_line() {
        // row, 자식 1개 height 명시 30, available_cross 764(부모가 준 큰 값),
        // align_items=START(stretch 아님), align_content=stretch(default).
        // CSS §8.4: 단일 라인은 align-content stretch 무효 → 라인/자식 cross 30 유지(764 아님).
        let data = flatten(&[item(50.0, 30.0)]);
        let out = flex_layout(
            &data, 300.0, 764.0, DIR_ROW, JUSTIFY_START, ALIGN_START,
            ALIGN_CONTENT_STRETCH, WRAP_NOWRAP, 0.0, 0.0, false,
        );
        assert!((out[3] - 30.0).abs() < 0.01, "height={} (expect 30, not stretched)", out[3]);
        assert!((out[1] - 0.0).abs() < 0.01, "y={} (expect 0)", out[1]);
    }

    #[test]
    fn single_line_align_content_center_does_not_offset() {
        // 단일 라인 + align_content=center → center offset 무효(자식 y=0).
        let data = flatten(&[item(50.0, 30.0)]);
        let out = flex_layout(
            &data, 300.0, 764.0, DIR_ROW, JUSTIFY_START, ALIGN_START,
            ALIGN_CONTENT_CENTER, WRAP_NOWRAP, 0.0, 0.0, false,
        );
        assert!((out[1] - 0.0).abs() < 0.01, "y={} (expect 0, center 무효)", out[1]);
        assert!((out[3] - 30.0).abs() < 0.01, "height={} (expect 30)", out[3]);
    }

    #[test]
    fn single_line_align_items_center_child_stays_at_top() {
        // align_items=center + 자식 height 30 + available_cross 764.
        // 라인 cross = 자식 max = 30 이므로 라인 내 중앙 = 제자리(y=0). ToggleButtonGroup 실제 케이스.
        let data = flatten(&[item(50.0, 30.0)]);
        let out = flex_layout(
            &data, 300.0, 764.0, DIR_ROW, JUSTIFY_START, ALIGN_CENTER,
            ALIGN_CONTENT_STRETCH, WRAP_NOWRAP, 0.0, 0.0, false,
        );
        assert!((out[3] - 30.0).abs() < 0.01, "height={} (expect 30)", out[3]);
        assert!((out[1] - 0.0).abs() < 0.01, "y={} (expect 0, 라인 cross=30 이므로 제자리)", out[1]);
    }

    // ── cross_is_definite 매개변수 추가 회귀 방지 ──

    #[test]
    fn multi_line_align_content_stretch_still_expands() {
        // WRAP + available_main 작아 2라인 강제. available_cross 200, 라인당 자식 height 20.
        // 다중 라인 align-content stretch → 라인들이 cross_free 를 나눠 팽창(단일 라인 무효와 대비).
        let data = flatten(&[item(80.0, 20.0), item(80.0, 20.0)]);
        let out = flex_layout(
            &data, 100.0, 200.0, DIR_ROW, JUSTIFY_START, ALIGN_START,
            ALIGN_CONTENT_STRETCH, WRAP_WRAP, 0.0, 0.0, true,
        );
        // 2라인: item0 y=0, item1 은 첫 라인이 stretch_extra 로 팽창해 20 보다 큰 y 로 밀림.
        assert!((out[1] - 0.0).abs() < 0.01, "item0 y={} (라인0 시작)", out[1]);
        assert!(out[5] > 20.0 + 0.01, "item1 y={} (라인1 — 라인0 stretch 로 20 초과)", out[5]);
    }

    // ── wrap 컨테이너는 라인 1개여도 multi-line (CSS Flexbox §5.2) ──

    #[test]
    fn wrap_single_line_definite_align_content_start_keeps_line_at_top() {
        // block IFC 시뮬레이션 (taffyDisplayAdapter INLINE_BLOCK_PARENT_CONFIG):
        //   body(display:block, 페이지 높이 definite) > Button(inline-block)
        //   → flex/row/wrap + align_items:center + align_content:flex-start
        // CSS §5.2: flex-wrap:wrap 은 라인이 1개여도 **multi-line 컨테이너** — §9.4 step 8 의
        //   "single-line 이면 라인 cross = 컨테이너 cross" 규칙은 nowrap 전용이다.
        //   따라서 라인 cross = 자식 max(32), align-content:flex-start 가 라인을 상단에 배치
        //   → 자식 y=0 (CSS block 의 line box 가 상단부터 쌓이는 것과 동일).
        let data = flatten(&[item(80.0, 32.0)]);
        let out = flex_layout(
            &data, 1200.0, 800.0, DIR_ROW, JUSTIFY_START, ALIGN_CENTER,
            ALIGN_CONTENT_START, WRAP_WRAP, 0.0, 0.0, true,
        );
        assert!((out[1] - 0.0).abs() < 0.01, "y={} (expect 0 — wrap 은 multi-line, 라인 상단 고정)", out[1]);
        assert!((out[3] - 32.0).abs() < 0.01, "height={} (expect 32 — 라인 cross 는 자식 max)", out[3]);
    }

    #[test]
    fn wrap_single_line_definite_align_content_stretch_still_fills() {
        // 회귀 가드: wrap + 라인 1개 + definite + align-content:stretch(default) 는
        //   CSS §9.4 step 9 로 라인이 컨테이너 cross 를 채운다 → align_items:center 가 중앙 배치.
        //   (align_content:flex-start 만 상단 고정 — stretch 는 기존 동작 유지)
        let data = flatten(&[item(80.0, 32.0)]);
        let out = flex_layout(
            &data, 1200.0, 800.0, DIR_ROW, JUSTIFY_START, ALIGN_CENTER,
            ALIGN_CONTENT_STRETCH, WRAP_WRAP, 0.0, 0.0, true,
        );
        assert!((out[1] - 384.0).abs() < 0.01, "y={} (expect 384 — stretch 로 라인이 800 을 채움)", out[1]);
    }

    #[test]
    fn single_line_definite_align_items_center_uses_available_cross() {
        // definite(cross_is_definite=true) + align_items=center + available_cross 100 + 자식 20
        //   → 자식 y=40 ((100-20)/2). definite 면 라인 cross=available_cross 로 중앙정렬.
        // indefinite 였다면 라인 cross=자식 20 → y=0 (single_line_indefinite_* 테스트가 대비).
        let data = flatten(&[item(50.0, 20.0)]);
        let out = flex_layout(
            &data, 300.0, 100.0, DIR_ROW, JUSTIFY_START, ALIGN_CENTER,
            ALIGN_CONTENT_STRETCH, WRAP_NOWRAP, 0.0, 0.0, true,
        );
        assert!((out[1] - 40.0).abs() < 0.01, "y={} (expect 40, definite 중앙정렬)", out[1]);
    }

    // ── §4.5 automatic minimum size (ADR-164) ──

    /// width AUTO + content_main 기반 아이템 (§4.5 floor 대상 형태).
    fn item_auto(content_main: f32, cross: f32) -> [f32; FLEX_FIELD_COUNT] {
        let mut f = item(AUTO, cross);
        f[13] = content_main;
        f
    }

    #[test]
    fn auto_min_floors_shrink_at_content() {
        // width AUTO + content 150 + shrink 1, available 100 → §4.5 floor 가 150 유지.
        // (floor 이전에는 100 으로 shrink — min AUTO 가 0 취급이었다)
        let data = flatten(&[item_auto(150.0, 20.0)]);
        let out = flex_layout(
            &data, 100.0, 50.0, DIR_ROW, JUSTIFY_START, ALIGN_START,
            ALIGN_CONTENT_START, WRAP_NOWRAP, 0.0, 0.0, true,
        );
        assert!((out[2] - 150.0).abs() < 0.01, "w={} (expect 150 — content floor)", out[2]);
    }

    #[test]
    fn auto_min_floor_distributes_among_siblings() {
        // [auto content 80] + [width 200 shrink 1], available 200.
        // hypothetical 80+200=280 → 부족 80. auto 아이템은 floor 80 에서 동결(min violation),
        // 나머지 부족은 definite 아이템이 전부 흡수 → 200-80=120.
        let data = flatten(&[item_auto(80.0, 20.0), with_flex(item(200.0, 20.0), 0.0, 1.0)]);
        let out = flex_layout(
            &data, 200.0, 50.0, DIR_ROW, JUSTIFY_START, ALIGN_START,
            ALIGN_CONTENT_START, WRAP_NOWRAP, 0.0, 0.0, true,
        );
        assert!((out[2] - 80.0).abs() < 0.01, "auto w={} (expect 80 floor)", out[2]);
        assert!((out[6] - 120.0).abs() < 0.01, "definite w={} (expect 120)", out[6]);
    }

    #[test]
    fn explicit_min_zero_allows_shrink_below_content() {
        // min_main 0 명시 (`minWidth:0` — falsy 함정 가드): floor 미적용 → 100 까지 shrink.
        let mut f = item_auto(150.0, 20.0);
        f[9] = 0.0; // 명시 min 0
        let data = flatten(&[f]);
        let out = flex_layout(
            &data, 100.0, 50.0, DIR_ROW, JUSTIFY_START, ALIGN_START,
            ALIGN_CONTENT_START, WRAP_NOWRAP, 0.0, 0.0, true,
        );
        assert!((out[2] - 100.0).abs() < 0.01, "w={} (expect 100 — min:0 존중)", out[2]);
    }

    #[test]
    fn clipped_item_has_no_auto_min_floor() {
        // item 자신의 주축 overflow ≠ visible (off 18 = 1) → §4.5 floor 미적용 (scroll
        // container item 은 content 밑으로 자유 shrink — 명세 조건).
        let mut f = item_auto(150.0, 20.0);
        f[18] = 1.0; // overflow_main clipped
        let data = flatten(&[f]);
        let out = flex_layout(
            &data, 100.0, 50.0, DIR_ROW, JUSTIFY_START, ALIGN_START,
            ALIGN_CONTENT_START, WRAP_NOWRAP, 0.0, 0.0, true,
        );
        assert!((out[2] - 100.0).abs() < 0.01, "w={} (expect 100 — clipped 무floor)", out[2]);
    }

    #[test]
    fn auto_min_floor_clamped_by_max_main() {
        // content 150 + max_main 120 → floor = min(150,120) = 120 (§4.5 max clamp).
        let mut f = item_auto(150.0, 20.0);
        f[10] = 120.0; // max_main
        let data = flatten(&[f]);
        let out = flex_layout(
            &data, 100.0, 50.0, DIR_ROW, JUSTIFY_START, ALIGN_START,
            ALIGN_CONTENT_START, WRAP_NOWRAP, 0.0, 0.0, true,
        );
        assert!((out[2] - 120.0).abs() < 0.01, "w={} (expect 120 — max clamp floor)", out[2]);
    }

    #[test]
    fn width_definite_item_keeps_free_shrink() {
        // width definite 200 (content 슬롯 신뢰 불가 케이스) → floor 미적용, 100 shrink.
        // §4.5 의 min(content 제안, specified 제안)에서 content 제안 부재 시 과대 floor 방지.
        let data = flatten(&[with_flex(item(200.0, 20.0), 0.0, 1.0)]);
        let out = flex_layout(
            &data, 100.0, 50.0, DIR_ROW, JUSTIFY_START, ALIGN_START,
            ALIGN_CONTENT_START, WRAP_NOWRAP, 0.0, 0.0, true,
        );
        assert!((out[2] - 100.0).abs() < 0.01, "w={} (expect 100 — definite 자유 shrink)", out[2]);
    }

    #[test]
    fn column_axis_auto_min_floor_symmetric() {
        // column: main=height. height AUTO + content_main 150, available 100 → 150 유지.
        let data = flatten(&[item_auto(150.0, 40.0)]);
        let out = flex_layout(
            &data, 100.0, 300.0, DIR_COLUMN, JUSTIFY_START, ALIGN_START,
            ALIGN_CONTENT_START, WRAP_NOWRAP, 0.0, 0.0, true,
        );
        assert!((out[3] - 150.0).abs() < 0.01, "h={} (expect 150 — column floor 대칭)", out[3]);
    }
}
