//! ADR-916 Phase 2-B — `tree.rs` 트리 오케스트레이션 (단위 4: 증분 dirty 추적)
//!
//! `apps/builder/.../wasm/src/taffy_bridge.rs` 의 `TaffyLayoutEngine` batch 계약
//! (`build_tree_batch` → `compute_layout` → `get_layouts_batch`) 을 Taffy 없이
//! 자체 flex/block/grid 커널(`crate::flex`/`crate::block`/`crate::grid`) 로
//! 오케스트레이션하는 계층. 본 계층이 `LayoutEngineAPI`(layoutBridge.ts) seam 에
//! 꽂힐 Rust 구현이다.
//!
//! ## 2-B 이관 경계 (2026-07-04 실사, 사용자 "실측 하단만 착수" 승인)
//!
//! DFS 상단 3-step(resolveStyle+applyImplicitStyles+enrichWithIntrinsicSize)은
//! tag/spec/store 도메인 의존이라 **JS 잔류**. 본 모듈은 상단이 이미 순수화한
//! TaffyStyle 레코드(= `build_tree_batch` 의 nodesJson payload)를 입력받아 트리
//! 레이아웃만 계산한다. (Phase 1 flat f32 센티넬 철학과 동일 — 도메인 해석은 JS,
//! 순수 계산만 Rust.)
//!
//! ## 층별 점진 (단위 분할 — 2-A 최소 검증 단위 패턴 승계)
//!
//! flex/block/grid.rs 는 모두 "부모 available 크기 + 자식 flat f32 → 자식 위치"
//! 1-depth 커널이며 **컨테이너 자기 크기를 반환하지 않는다**. batch 계약은 N-depth
//! 트리 상호의존을 해결해야 하므로, 그 사이를 잇는 오케스트레이션을 층별로 나눠
//! 각 단위를 cargo test 로 검증한다.
//!
//! **단위 2/3 병합 (2026-07-04 재정의)**: 원안은 "단위 2=intrinsic(bottom-up)/
//! 단위 3=placement(top-down)" 분리였으나, 실측상 height:auto 부모의 intrinsic
//! 크기는 **자식을 먼저 배치(커널 호출)해 bounding box 를 봐야** 나온다 —
//! intrinsic 과 placement 가 물리적으로 분리 불가. 따라서 "post-order 트리 solve"
//! (각 노드에서 display 별 커널 dispatch → 자식 배치 → bounding box 로 컨테이너
//! content 크기 도출) 를 한 단위로 병합하고, 내부를 display 별 최소 검증층으로
//! 다시 쪼갠다.
//!
//! - **단위 1 (land)**: tree 자료구조 + handle 관리 + `build_tree_batch` 골격 +
//!   `get_layouts_batch` + 증분 API. `compute_layout` = leaf-only(자기 크기만).
//! - **단위 2 (land)**: **post-order flex solve** — flex 컨테이너에서 자식을
//!   `flex.rs`(`flex_layout`) 로 배치하고, 자식 bounding box 로 컨테이너 content
//!   크기(height:auto sentinel) 를 도출. 재귀로 손자까지 bottom-up.
//! - **단위 3 (land)**: block + grid dispatch 추가 (display 별 분기 완성).
//!   세 커널의 계약이 비대칭이라(2026-07-04 실사) display 별 최소 검증층으로 재분할:
//!   - **단위 3-a (land)**: **block dispatch** — `block_layout`.
//!     flex 와 계약이 가장 가까움(자식 flat f32, 자식 재귀 solve 로 content_w/h 확보).
//!     block.rs 는 21필드/자식(물리축, vertical stacking — r10m2 로 19→21) + OUT 은
//!     `4*n + 6` (trailing firstChildMarginTop/lastChildMarginBottom/lastLineBaseline/
//!     inFlowBottom + 음수 성분 2). auto width 는 컨테이너로
//!     stretch, fit-content 는 content_w 사용. margin collapse/inline-block/BFC 는
//!     block.rs 내부 처리 — tree.rs 는 오케스트레이션(자식 solve → flat → 위치 반영).
//!   - **단위 3-b (본 파일 현재)**: **grid dispatch** — `grid_layout`. grid 는 계약이
//!     근본적으로 다름 — 자식 flat 을 안 받고 `template_cols/rows/areas` +
//!     `placement_spec` **문자열**만 받아 트랙 산술로 셀 배치(자식 크기는 트랙이 결정).
//!     tree.rs 어댑터가 NodeStyle → grid.rs 문자열 계약 변환:
//!     (1) `grid_template_columns: Vec<String>`(track array `["1fr","auto"]`) →
//!     space-join `"1fr auto"` (grid.rs `tokenize_template` 재분해),
//!     (2) 자식 `grid_column_start`+`grid_column_end`(taffy_bridge 처럼 분리된 단일
//!     line/span 값) → grid.rs `parse_grid_line` 결합 형식 `"{start} / {end}"` 재조립,
//!     (3) 자식들을 `area_name|grid_column|grid_row` 파이프 형식(개행 구분)으로 직렬화.
//!     NodeStyle 에 gridArea 이름/`grid_template_areas` 필드 없음(taffy_bridge 동일 —
//!     Skia 경로는 숫자 line 사용, factory 가 이름+line 병기) → area_name 항상 빈 문자열,
//!     template_areas 미사용. 자식 크기는 grid.rs 가 트랙에서 산출(intrinsic track 미측정).
//! - **단위 3-b (land)**: grid dispatch (위 어댑터).
//! - **단위 4 (본 파일 현재)**: **증분 dirty 추적** — taffy 의 "dirty 조상 자동
//!   전파" 계약(taffy_bridge.rs:890-893) 이식. 증분 API(`update_style`/
//!   `set_children`/`mark_dirty`)가 변경 노드 + 조상 체인을 dirty 로 마킹하고,
//!   `solve_node` 는 서브트리가 전부 clean 이면 저장된 layout 을 재사용하고 재귀를
//!   생략한다(dirty 서브트리만 재계산). 정확성 안전판: (1) 부모가 재solve 되면
//!   자식 available 이 바뀔 수 있어 dirty 노드 하위는 무조건 전체 재solve, (2)
//!   root-level available-space 가 직전과 다르면(`last_compute` 비교) 서브트리
//!   전체를 강제 dirty 로 skip 무효화(%/auto 크기 stale 방지). taffy 의 layout
//!   cache(available-space 키) 대비 캐시 없는 보수적 skip — 관찰 계약(최종 layout
//!   값의 정확성)을 절대 위반하지 않는 선에서만 재계산을 절감한다.
//!
//! ## flex.rs 알려진 제약 (단위 2 착수 중 발견, Phase 1 flex.rs scope)
//!
//! `flex.rs` 의 `ALIGN_STRETCH`(align-items 기본값)는 자식의 **명시 cross size 를
//! 무시하고** 컨테이너 cross available 로 stretch 한다 (flex.rs:664 `cross_avail`
//! 무조건 사용). CSS 명세상 stretch 는 cross size 가 `auto` 인 경우에만 적용되고
//! 명시 크기는 존중해야 하므로 이는 flex.rs Phase 1 의 미구현/버그다. 단위 2
//! tree.rs solve 는 이 버그를 **건드리지 않으며**(scope: 오케스트레이션), 테스트는
//! stretch 가 관여하지 않는 케이스(`align-items:flex-start`)로 구성해 solve 로직만
//! 검증한다. flex.rs stretch 수정은 Phase 1 flex.rs 후속(별도 착수).
//!
//! seam 미배선 순수 Rust — live builder 영향 0. `createLayoutEngine` 실배선(flag
//! 전환)은 flex/block/grid 트리 dual-run(Taffy self-diff 0) 통과 후 별도 단계.

use serde::Deserialize;
#[cfg(test)]
use std::cell::Cell;

use crate::block;
use crate::display::{self, Display, InnerDisplay};
use crate::flex;
use crate::grid;
use crate::style::{resolve_css_size_value, CssValueContext, FIT_CONTENT, MAX_CONTENT, MIN_CONTENT};
use crate::trace::{Axis, ClampBound, SkipReason, TraceEvent, TraceSink, TracedEvent, TrackStage};

/// indefinite available 센티넬 (음수). `%` 크기는 indefinite containing block 에 대해
/// `auto` 로 풀린다(CSS §10.2) — `resolve_dimension` 이 음수 ctx 에서 0(=auto) 을 반환하고,
/// `solve_flex/block` 의 `avail >= 0.0` 가드가 감산을 건너뛴다.
const INDEFINITE_AVAIL: f32 = -1.0;

/// intrinsic 측정 모드 센티넬 (ADR-169 Phase 1).
///
/// `INDEFINITE_AVAIL` 의 음수 도메인을 **확장**한다 — Taffy `AvailableSpace::{MinContent,
/// MaxContent}` / Yoga `MeasureMode` / Blink `ComputeMinMaxSizes` 와 같은 "동일 알고리즘을
/// 특수 모드로 재실행" 표현이되, `solve_node(handle, avail_w, avail_h)` 시그니처를 그대로
/// 두므로 호출부 전수 변경이 없다.
///
/// **성립 근거**: available 소비 지점의 가드가 전부 `avail >= 0.0` 형태고 `INDEFINITE_AVAIL`
/// 과의 **등가 비교가 0건**이다. 따라서 새 음수 값은 기존 indefinite 경로를 그대로 타고,
/// 모드 판정이 필요한 지점(leaf intrinsic 해석)에서만 추가로 읽힌다.
const MIN_CONTENT_AVAIL: f32 = -2.0;
const MAX_CONTENT_AVAIL: f32 = -3.0;

/// available 센티넬이 지시하는 intrinsic 측정 모드. 평범한 indefinite/definite 는 `None`.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
enum IntrinsicMode {
    Min,
    Max,
}

/// available 값 → 측정 모드. 센티넬은 정확값 비교 — 산술로 만들어지지 않는 상수라
/// 부동소수 오차가 끼어들 여지가 없다 (감산 경로는 `avail >= 0.0` 가드가 차단).
fn intrinsic_mode(avail: f32) -> Option<IntrinsicMode> {
    if avail == MIN_CONTENT_AVAIL {
        Some(IntrinsicMode::Min)
    } else if avail == MAX_CONTENT_AVAIL {
        Some(IntrinsicMode::Max)
    } else {
        None
    }
}

/// **shrink-to-fit 인라인 축이 확정된 뒤 자식을 다시 풀 border-box 폭** (CSS-SIZING-3 §5.1).
///
/// 인라인 available 이 미결정이면 컨테이너 크기가 **자식으로부터** 나온다. 그 pass 에서
/// 자식의 `%` 는 참조할 확정 크기가 없어 `auto` 로 풀리고(순환 백분율), auto 폭 블록 자식은
/// stretch 대신 fit-content 가 된다 — 둘 다 **intrinsic 기여를 구하는 동안만** 맞는 해석이다.
/// CSS 는 크기가 정해진 **뒤** 그 크기를 containing block 으로 삼아 자식을 정상 배치한다.
///
/// 그래서 확정값으로 **한 번 더** 푼다. 재진입은 확정 폭을 `explicit_w` 로 넘기므로 2차 pass
/// 에서 이 게이트가 닫혀 1회로 끝난다 (flex 3.6/3.7, grid 블록 축 clamp 와 같은 형태).
///
/// **컨테이너 상자는 1차 pass 값을 유지한다** — intrinsic 크기는 `%` 를 `auto` 로 본 값이고,
/// 재해소로 자식이 더 커지면 CSS 도 넘치게 둔다 (실측 `width:150%` → 상자 120 / 자식 180).
///
/// 측정 모드 센티넬(`-2`/`-3`)은 대상이 아니다 — 거기서는 `%` 가 `auto` 인 것이 최종 답이다.
/// 호출부가 `inline_shrink_to_fit` 에 그 판정을 담아 넘긴다 (block/flex 는 상속 available 이
/// 미결정일 때, grid 는 `inline_intrinsic` — `width: max-content` 같은 키워드까지 포함).
fn shrink_to_fit_settled(
    inline_shrink_to_fit: bool,
    content_w: f32,
    own_pb_h: f32,
    own_min_w: Option<f32>,
    own_max_w: Option<f32>,
) -> Option<f32> {
    if !inline_shrink_to_fit {
        return None;
    }
    // shrink-to-fit 의 used size 도 자기 min/max clamp **뒤**의 값이다 (CSS-SIZING-3
    // §5.1 / ADR-170 군집 A). clamp 가 바인딩하면 재진입 폭이자 상자 폭이 된다 —
    // 호출부가 (settled − pb) ≠ 1차 content 비교로 바인딩 여부를 판정한다.
    let mut settled = content_w + own_pb_h;
    if let Some(mx) = own_max_w {
        settled = settled.min(mx);
    }
    if let Some(mn) = own_min_w {
        settled = settled.max(mn);
    }
    // 0 이하면 2차 pass 도 `explicit_w <= 0` 이라 게이트가 안 닫힌다 — 재진입 자체를 막는다.
    if settled > 0.0 {
        Some(settled)
    } else {
        None
    }
}

/// 트리 노드의 스타일 표현 (taffy_bridge.rs `StyleInput` 대응).
///
/// 모든 필드 optional — 미설정 필드는 CSS 초기값. camelCase JSON 계약은
/// `build_tree_batch` 의 nodesJson payload(PersistentTaffyTree.buildFull 이
/// `JSON.stringify(node.style)` 로 직렬화) 와 1:1 대응해야 한다.
///
/// 단위 1 은 자기 크기 해결에 필요한 필드만 실사용하지만, 계약 정합을 위해
/// StyleInput 전체 스키마를 그대로 보유한다(누락 필드는 다음 단위에서 소비).
#[derive(Debug, Clone, Default, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct NodeStyle {
    // Display & position
    pub display: Option<String>,
    pub position: Option<String>,
    pub overflow_x: Option<String>,
    pub overflow_y: Option<String>,

    // Flex container
    pub flex_direction: Option<String>,
    pub flex_wrap: Option<String>,
    pub justify_content: Option<String>,
    pub justify_items: Option<String>,
    pub align_items: Option<String>,
    pub align_content: Option<String>,

    // Flex item
    pub flex_grow: Option<f32>,
    pub flex_shrink: Option<f32>,
    pub flex_basis: Option<String>,
    pub align_self: Option<String>,
    pub justify_self: Option<String>,

    // Grid container
    pub grid_template_columns: Option<Vec<String>>,
    pub grid_template_rows: Option<Vec<String>>,
    pub grid_auto_flow: Option<String>,
    pub grid_auto_columns: Option<Vec<String>>,
    pub grid_auto_rows: Option<Vec<String>>,

    // Grid item
    pub grid_column_start: Option<String>,
    pub grid_column_end: Option<String>,
    pub grid_row_start: Option<String>,
    pub grid_row_end: Option<String>,

    // Size
    pub width: Option<String>,
    pub height: Option<String>,
    pub min_width: Option<String>,
    pub min_height: Option<String>,
    pub max_width: Option<String>,
    pub max_height: Option<String>,

    // Spacing
    pub margin_top: Option<String>,
    pub margin_right: Option<String>,
    pub margin_bottom: Option<String>,
    pub margin_left: Option<String>,
    pub padding_top: Option<String>,
    pub padding_right: Option<String>,
    pub padding_bottom: Option<String>,
    pub padding_left: Option<String>,
    pub border_top: Option<String>,
    pub border_right: Option<String>,
    pub border_bottom: Option<String>,
    pub border_left: Option<String>,

    // Inset (position offsets)
    pub inset_top: Option<String>,
    pub inset_right: Option<String>,
    pub inset_bottom: Option<String>,
    pub inset_left: Option<String>,

    // Gap
    pub column_gap: Option<String>,
    pub row_gap: Option<String>,

    // Aspect ratio
    pub aspect_ratio: Option<f32>,

    // Intrinsic 측정 스칼라 (ADR-165 측정 계약) — CSS 속성이 아니라 TS 가 공급하는
    // 텍스트 leaf content 측정값 (content-box, ceil 적용 px). 엔진은 텍스트 측정
    // 불가(CanvasKit oracle 불변 — ADR-164 HC2)이므로 이 두 스칼라가 폭 축
    // intrinsic (fit/min/max-content + §4.5 floor) 의 유일한 입력이다.
    /// min-content 폭 (최장 단어 폭)
    pub content_min_width: Option<f32>,
    /// max-content 폭 (단일줄 폭)
    pub content_max_width: Option<f32>,

    // Baseline 계약 (ADR-923 Phase 2) — block line box 의 vertical-align/baseline 슬롯
    // 배선 + 컨테이너 baseline 출력의 입력. line_height 는 컨테이너 strut 으로 소비되고
    // block item 슬롯 18 은 S4 text run 예약 (P3 r8l1/r9l2 정정 — "슬롯 미소비 해소" 아님).
    /// vertical-align CSS 키워드 (baseline/top/middle/bottom — 그 외/미설정 = baseline).
    /// tree.rs 가 block.rs u8 코드로 매핑한다 (flex enum 매핑과 같은 경계 역할).
    pub vertical_align: Option<String>,
    /// line-height — **px 해석 완료 스칼라** (TS 가 배율·단위를 fontSize 로 선해석.
    /// 엔진은 폰트 메트릭이 없어 배율을 스스로 해석할 수 없다 — ADR-165 와 같은 계약).
    /// 소비는 컨테이너 strut(solve_block → block_layout_with_strut) — item 슬롯 18 은 S4 예약.
    pub line_height: Option<f32>,
    /// 텍스트 leaf 의 첫 줄 baseline (content-box 상단 기준 px — TS 측정 공급 채널.
    /// content_min/max_width 와 같은 성격: CSS 속성이 아니라 측정 스칼라).
    pub leaf_baseline: Option<f32>,
}

/// `NodeStyle` 선언 필드 수 — ADR-156 R7/G6 정적 가드 앵커.
///
/// breakdown §1-3 3축 교차표의 "NodeStyle 49필드"(현재 54 — ADR-165 +2 ·
/// ADR-923 P2 +3) 를 코드로 고정한다. 이 값을
/// 바꾸면(= 필드 추가/삭제) `nodestyle_field_contract_guard` 의 전수 구조분해가
/// 먼저 컴파일 RED 이므로, 교차표 갱신 없이 필드만 늘리는 silent drift 가 차단된다.
pub const NODESTYLE_FIELD_COUNT: usize = 54;

/// 「선언 O · 송신 O · 소비 X」 필드 (camelCase = serde 계약명).
///
/// ADR-156 §Residual 잔존과 1:1. 파이프라인이 값을 보내지만 엔진이 읽지 않는
/// 필드로, 소비 코드를 배선하면 이 목록에서 제거한다. 반대로 신규 미소비 필드가
/// 생기면 여기 등재해야 `nodestyle_field_contract_guard` 산술(소비+미소비=선언)이
/// 맞는다. `order`(E16)·`grid_template_areas` 는 `NodeStyle` 미선언(serde silent
/// drop)이라 필드 수(54)에 불포함 — 유입 경로가 생기면 선언 후 재판정.
///
/// **2026-07-18 (옵션 3-a)**: `justifySelf`/`justifyItems` 는 `solve_grid` 의
/// `grid_inline_justify`/`parse_justify_items` 배선으로 소비 전환 → 목록 비움.
/// 남은 미소비 필드 0 (전부 소비 — 이후 ADR-165 +2 · ADR-923 P2 +3 로 54).
pub const UNCONSUMED_NODESTYLE_FIELDS: [&str; 0] = [];

/// batch 트리 빌드 입력 (taffy_bridge.rs `BatchNodeInput` 대응).
///
/// post-order(리프 먼저, 루트 마지막) 배열. `children` 은 같은 배열 내 인덱스.
#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct BatchNodeInput {
    style: NodeStyle,
    /// 같은 batch 배열 내 자식 인덱스 (post-order — 자식이 부모보다 앞).
    children: Vec<usize>,
}

/// 계산된 레이아웃 결과 (taffy_bridge.rs `LayoutOutput` 대응, content-box 위치/크기).
#[derive(Debug, Clone, Copy, PartialEq)]
pub struct NodeLayout {
    pub x: f32,
    pub y: f32,
    pub width: f32,
    pub height: f32,
    /// border-box 상단 기준 in-flow baseline (ADR-923 Phase 2).
    ///
    /// - leaf: `leaf_baseline` 입력 + padding/border-top (텍스트 첫 줄)
    /// - flex/grid 컨테이너: 첫 in-flow item 의 baseline (Flexbox §8.5 근사)
    /// - block 컨테이너: 마지막 in-flow line box(또는 마지막 baseline 보유 자식)
    ///
    /// **내부 센티널 `BASELINE_NONE`(-1.0) = baseline 원천 없음.** 경계 출력
    /// (`get_layouts_batch`/`getLayout`)과 block intake 는 height(bottom) 폴백으로
    /// 해석한다 (CSS 2.1 §10.8.1 — in-flow line box 없는 inline-block 은 bottom).
    /// 센티널을 내부에 보존하는 이유: 폴백값(height)을 저장해 두면 부모가 stretch 로
    /// height 를 덮어쓸 때 stale 이 되고, "원천 없음" 과 "실측 baseline == height" 를
    /// 구분할 수 없어 컨테이너 전파(원천 있는 자식만 전파)가 깨진다.
    pub baseline: f32,
}

/// `NodeLayout.baseline` 의 "원천 없음" 센티널 — 경계에서 height 폴백.
pub const BASELINE_NONE: f32 = -1.0;

impl NodeLayout {
    const ZERO: NodeLayout =
        NodeLayout { x: 0.0, y: 0.0, width: 0.0, height: 0.0, baseline: BASELINE_NONE };

    /// 경계 계약값 — 원천 있으면 그 값, 없으면 height (bottom 폴백).
    #[inline]
    pub fn resolved_baseline(&self) -> f32 {
        if self.baseline >= 0.0 { self.baseline } else { self.height }
    }
}

/// 측정 패스 전후 복구 단위 — `(handle, dirty, subtree_dirty, layout, last_avail, last_solved)`.
type SubtreeSnap = (
    usize,
    bool,
    bool,
    NodeLayout,
    Option<(f32, f32)>,
    Option<(f32, f32)>,
);

/// 트리 노드 (style + 자식 handle + 계산 결과).
#[derive(Debug, Clone)]
struct TreeNode {
    style: NodeStyle,
    children: Vec<usize>,
    layout: NodeLayout,
    /// 이 노드 자신의 style/children 변경 여부. 다음 compute_layout 에서
    /// (조상 dirty 전파와 결합해) 재계산 대상 판정에 사용.
    dirty: bool,
    /// 이 노드의 자손 중 dirty 노드가 있는지 요약한다.
    ///
    /// `subtree_has_dirty`가 clean subtree를 매번 재귀 순회하지 않도록 하는
    /// O(1) 게이트다. `dirty`는 자기 자신, 이 필드는 자손 요약을 나타내며,
    /// solve 완료 시 두 값을 함께 clear한다.
    subtree_dirty: bool,
    /// 부모 handle (조상 dirty 전파용). root 는 None.
    ///
    /// **Why**: taffy 계약(taffy_bridge.rs:890-893)은 "dirty 를 조상까지 자동
    /// 전파" 한다. 자식 크기 변경 시 부모의 intrinsic size(auto width/height)와
    /// 자식 available 이 바뀌므로, 자식만 재계산하면 부모 배치가 stale 해진다.
    /// parent 포인터로 dirty 를 root 까지 상향 전파해 정확성을 보장한다.
    parent: Option<usize>,
    /// 부모-자식 마진 상쇄로 이 컨테이너 **밖으로 hoisted 된** 첫 자식 top /
    /// 마지막 자식 bottom margin (E3/ADR-156 P4). `solve_block` 이 BFC 차단 요인
    /// (padding/border/overflow≠visible / flex·grid item)이 없을 때만 nonzero 로 채운다.
    /// 부모(=조부모)의 `solve_block` 이 이 노드를 block flat 으로 직렬화할 때 자기 style
    /// margin 과 collapse 하여 상쇄 chain 을 잇는다. 비-block solve(flex/grid/leaf)는 ZERO.
    /// 값이 아니라 adjoining **집합** (block.rs `MarginSet`, r10m2) — 손자→자식→형제 3층의
    /// margin 이 한 집합이라 최대 양수 + 최소 음수 로만 닫힌다.
    escaped_mt: block::MarginSet,
    escaped_mb: block::MarginSet,
    /// 이 block 컨테이너가 **self-collapsing** 인가 (CSS 2.1 §8.3.1 — 상하 padding/border 0 ·
    /// height auto 또는 0 · min-height 0 · line box 없음 · in-flow 자식 없거나 전부 관통 ·
    /// BFC 아님). 재귀 정의라 자식의 `solve_block` 이 판정해 두면 부모 intake 가 읽어 block
    /// flat 코드 2 로 보낸다 — `height: 0` 명시 컨테이너는 intake 의 auto-height 규칙만으론
    /// 분류할 수 없다 (ADR-923 P3 r9 후속 ①, Chrome height-zero-self-collapsing). leaf
    /// (in-flow 자식 없음 — absolute 자식만 있는 경우 포함, r10m1) 는 `solve_node` leaf 경로가
    /// 같은 조건 + `leaf_baseline` 없음(= 텍스트 line box 없음, r10h1) 으로 판정한다.
    /// **단일 원천** — intake 는 이 플래그만 읽는다 (r9m2 이중 층 교훈).
    self_collapsing: bool,
    /// 폭 축 intrinsic 측정 캐시 `(mutation_gen, min_content, max_content)` — border-box
    /// (ADR-169 Phase 1).
    ///
    /// **Why 캐시**: 측정은 서브트리 재귀라, 캐시 없이 중첩 컨테이너마다 두 번씩 재실행하면
    /// **깊이에 지수적**이다 (R1/G4).
    ///
    /// **Why generation**: 무효화를 `dirty` 마킹에 얹으면 `propagate_dirty` 의 조기 종료
    /// (이미 dirty 인 조상에서 break) 때문에 조상 캐시가 살아남는다. 트리 단위 mutation
    /// 카운터와 대조하면 그 구멍이 원천적으로 없고 판정도 O(1) 이다. mutation 은 layout
    /// pass 사이에 일어나므로, 한 pass 안에서는 캐시가 온전히 유효하다 — 지수 폭발이
    /// 실제로 발생하는 구간이 거기다.
    intrinsic_w: Option<(u64, f32, f32)>,
    /// 저장된 `layout` 이 계산될 때 받은 available `(avail_w, avail_h)`.
    ///
    /// 증분 skip 의 **두 번째 키**다. dirty 만으로는 재부모화를 못 잡는다 — 옮겨온
    /// 노드는 자기 style/children 이 안 바뀌어 clean 인데 새 부모가 주는 available 은
    /// 다르다. 트리 단위 `last_compute` 는 root·available 이 같으면 통과시키므로
    /// 이 축을 노드마다 따로 들고 있어야 한다.
    last_avail: Option<(f32, f32)>,
    /// 직전 `solve_node` 가 **반환**한 `(w, h)`.
    ///
    /// 증분 skip 이 돌려줄 값은 `layout` 이 아니라 이것이다. `layout` 은 배치 단계에서
    /// **부모가 border-box 로 덮어쓴다** — auto 축의 반환 계약(content-box)과 다른
    /// 값이 되므로, skip 이 `layout` 을 돌려주면 부모가 pad+border 를 다시 더해
    /// skip 마다 그만큼 부풀어 오른다 (라이브: 다른 요소를 편집할 때마다 컬렉션
    /// item origin 높이가 `2×(padding+border)` 씩 누적 — 새로고침하면 원상복귀).
    last_solved: Option<(f32, f32)>,
}

/// 자체 레이아웃 트리 엔진 (taffy_bridge.rs `TaffyLayoutEngine` 대응).
///
/// handle → 노드 mapping. 해제된 handle 은 `None` 이 되고 `free_list` 로 재활용.
/// (Taffy `TaffyTree` 없이 자체 flex/block/grid 커널로 트리를 해결한다.)
#[derive(Debug, Default)]
pub struct LayoutTree {
    /// handle(index) → 노드. 해제 시 None.
    nodes: Vec<Option<TreeNode>>,
    /// 재활용 가능한 (해제된) handle 인덱스.
    free_list: Vec<usize>,
    /// 직전 `compute_layout` 의 (root, available_width, available_height).
    ///
    /// **Why**: 증분 skip(clean 서브트리 재계산 생략)은 available-space 가
    /// 직전과 동일할 때만 정확하다. %/auto 크기는 available 에 의존하므로
    /// available 이 바뀌면 clean 노드도 stale — 이 경우 skip 을 무효화(전체
    /// 재계산)한다. taffy 는 layout cache 의 available-space 키로 처리하지만
    /// 자체 트리는 캐시가 없어 root-level available 비교로 갈음한다.
    last_compute: Option<(usize, f32, f32)>,
    /// 트리 mutation 카운터 — intrinsic 측정 캐시 유효성 판정 (ADR-169 Phase 1).
    /// 노드 생성/스타일·자식 변경/제거/clear 마다 증가.
    mutation_gen: u64,
    /// ADR-183 — 판정 트레이스 sink. `None` 이 기본이고, 그때 계측 지점의 비용은
    /// `Option` 분기 1회다 (HC1). `Box` 인 이유는 off 상태 `LayoutTree` 를
    /// 포인터 하나만큼만 키우기 위함.
    trace: Option<Box<TraceSink>>,
    /// ADR-188 G0/G1 계측. Test builds count skip-gate invocations separately from
    /// production layout behavior.
    #[cfg(test)]
    skip_walk_visits: Cell<usize>,
}

impl LayoutTree {
    /// 빈 트리 생성.
    pub fn new() -> Self {
        Self::default()
    }

    // ── ADR-183 판정 트레이스 (디버그 채널) ──────────────────────────────

    /// 트레이스 게이트를 켠다. 이 시점부터의 solve 판정이 노드별로 쌓인다.
    ///
    /// **라이브 캐시 상태 그대로 기록되는 것이 채널의 존재 이유다** (ADR-183
    /// Decision 1). 문제 노드를 fresh 로 다시 풀면 skip 게이트·측정 캐시를 타지
    /// 않아, 오진 반복 최다 축(캐시 계열)이 정확히 사각이 된다. 그러므로 진단 시
    /// 트리를 새로 만들지 말고 **살아 있는 트리에 이걸 켜라**.
    pub fn enable_trace(&mut self) {
        if self.trace.is_none() {
            self.trace = Some(Box::new(TraceSink::new()));
        }
    }

    /// 게이트를 끄고 기록을 해제한다 (R3 — WASM 힙 반환).
    pub fn disable_trace(&mut self) {
        self.trace = None;
    }

    pub fn trace_enabled(&self) -> bool {
        self.trace.is_some()
    }

    /// 노드의 기록된 판정. 게이트가 off 면 빈 슬라이스.
    pub fn trace_events(&self, handle: usize) -> &[TracedEvent] {
        match self.trace.as_ref() {
            Some(sink) => sink.events(handle),
            None => &[],
        }
    }

    /// 노드당 상한(`MAX_EVENTS_PER_NODE`) 초과로 버려진 개수.
    pub fn trace_dropped(&self, handle: usize) -> usize {
        self.trace.as_ref().map(|s| s.dropped(handle)).unwrap_or(0)
    }

    /// 이벤트가 하나라도 기록된 노드 handle 목록.
    pub fn traced_handles(&self) -> Vec<usize> {
        self.trace.as_ref().map(|s| s.traced_handles()).unwrap_or_default()
    }

    /// 기록된 이벤트만 비운다 (게이트는 유지) — 재현 구간을 좁힐 때.
    pub fn clear_trace(&mut self) {
        if let Some(sink) = self.trace.as_mut() {
            sink.clear();
        }
    }

    /// 노드 판정 트레이스의 JSON 보고 (ADR-183 Phase 2 — WASM 경계용).
    ///
    /// `{"handle":N,"enabled":bool,"dropped":N,"events":[{"measure_pass":bool,
    /// "type":"...",...}]}` — wasm32 표면(`wasm.rs::getLayoutTrace`)은 이 문자열을
    /// 그대로 위임하므로, 스키마 계약은 native 테스트(`tests/layout_trace.rs`)가
    /// 여기서 잠근다. `enabled:false` 도 유효 JSON 을 낸다 — TS 판독자가 "게이트가
    /// 꺼져 있다" 와 "판정이 없었다" 를 구분해야 하기 때문 (R2 거짓 안심 방지).
    pub fn trace_json(&self, handle: usize) -> String {
        #[derive(serde::Serialize)]
        struct TraceNodeReport<'a> {
            handle: usize,
            enabled: bool,
            dropped: usize,
            events: &'a [TracedEvent],
        }
        let report = TraceNodeReport {
            handle,
            enabled: self.trace_enabled(),
            dropped: self.trace_dropped(handle),
            events: self.trace_events(handle),
        };
        // 실패 경로 없음(NAN 은 null 로 직렬화) — 방어적 fallback 만 둔다.
        serde_json::to_string(&report).unwrap_or_else(|_| {
            format!(r#"{{"handle":{handle},"enabled":false,"dropped":0,"events":[]}}"#)
        })
    }

    /// 판정 1건 기록 — **off 경로 비용은 `Option` 분기 1회**.
    ///
    /// 호출부는 이벤트를 클로저로 넘긴다: 인자로 만들어 넘기면 `Vec` 를 쓰는
    /// variant(`GridTrackResolve`)가 off 경로에서도 할당을 지불한다 (HC1).
    #[inline]
    fn trace_push(&mut self, handle: usize, event: impl FnOnce() -> TraceEvent) {
        if let Some(sink) = self.trace.as_mut() {
            sink.push(handle, event());
        }
    }

    /// 증분 skip 게이트의 판정 — **게이트 자신과 트레이스가 공유하는 단일 정의**.
    ///
    /// 반환 `Some(prev)` 면 그 값을 그대로 돌려주면 된다(HIT). `subtree_dirty` 를
    /// 클로저로 받는 이유는 단축 평가 보존이다 — `last_solved` 가 없으면 트리 walk
    /// 자체를 돌지 않는 것이 기존 동작이고, 여기서 그것을 잃으면 계측이 아니라
    /// 성능 회귀가 된다 (HC1).
    #[inline]
    fn skip_decision(
        node: &TreeNode,
        subtree_dirty: impl FnOnce() -> bool,
        avail_w: f32,
        avail_h: f32,
    ) -> (SkipReason, Option<(f32, f32)>) {
        let Some(prev) = node.last_solved else {
            return (SkipReason::NoPrev, None);
        };
        if subtree_dirty() {
            return (SkipReason::Dirty, None);
        }
        if node.last_avail != Some((avail_w, avail_h)) {
            return (SkipReason::AvailChanged, None);
        }
        (SkipReason::Hit, Some(prev))
    }

    // ── handle 관리 (taffy_bridge.rs alloc_handle/resolve 대응) ──

    /// 노드를 저장하고 handle 을 발급 (free_list 우선 재활용).
    fn alloc_handle(&mut self, node: TreeNode) -> usize {
        self.mutation_gen += 1; // 측정 캐시 무효화 (ADR-169)
        if let Some(idx) = self.free_list.pop() {
            self.nodes[idx] = Some(node);
            idx
        } else {
            let idx = self.nodes.len();
            self.nodes.push(Some(node));
            idx
        }
    }

    /// handle 이 유효하면 노드 참조 반환.
    fn get(&self, handle: usize) -> Option<&TreeNode> {
        self.nodes.get(handle).and_then(|n| n.as_ref())
    }

    /// handle 이 유효하면 노드 가변 참조 반환.
    fn get_mut(&mut self, handle: usize) -> Option<&mut TreeNode> {
        self.nodes.get_mut(handle).and_then(|n| n.as_mut())
    }

    // ── 증분 API (taffy_bridge.rs 대응) ──

    /// leaf 노드 생성 → handle 반환.
    pub fn create_node(&mut self, style: NodeStyle) -> usize {
        self.alloc_handle(TreeNode {
            style,
            children: Vec::new(),
            layout: NodeLayout::ZERO,
            dirty: true,
            subtree_dirty: false,
            parent: None,
            escaped_mt: block::MarginSet::ZERO,
            escaped_mb: block::MarginSet::ZERO,
            self_collapsing: false,
            intrinsic_w: None,
            last_avail: None,
            last_solved: None,
        })
    }

    /// 기존 노드 스타일 교체 (해당 노드 + 조상 dirty 전파).
    ///
    /// **Why 조상 전파**: taffy 계약(taffy_bridge.rs:895)에서 `set_style` 은 내부적으로
    /// `mark_dirty` 를 호출하고, dirty 는 조상까지 전파된다. style 변경이 노드 크기를
    /// 바꾸면 부모 intrinsic/배치가 stale 되므로 root 까지 마킹해야 정확.
    pub fn update_style(&mut self, handle: usize, style: NodeStyle) {
        if let Some(node) = self.get_mut(handle) {
            node.style = style;
        }
        self.propagate_dirty(handle);
    }

    /// 노드 자식 교체 (parent 배선 + 해당 노드 + 조상 dirty 전파).
    ///
    /// 새 자식들의 parent 를 이 노드로 설정한다(조상 전파 경로 확보). 자식 집합
    /// 변경은 컨테이너 재배치를 유발하므로 taffy 처럼 조상까지 dirty 전파.
    pub fn set_children(&mut self, handle: usize, children: Vec<usize>) {
        for &c in &children {
            if let Some(child) = self.get_mut(c) {
                child.parent = Some(handle);
            }
        }
        if let Some(node) = self.get_mut(handle) {
            node.children = children;
        }
        self.propagate_dirty(handle);
    }

    /// 노드를 dirty 로 표시 (해당 노드 + 조상 전파 — 다음 compute_layout 재계산).
    pub fn mark_dirty(&mut self, handle: usize) {
        self.propagate_dirty(handle);
    }

    /// `handle` 부터 root 까지 조상 체인을 dirty 로 마킹.
    ///
    /// taffy 의 "dirty 를 조상까지 자동 전파" 계약(taffy_bridge.rs:890-893) 이식.
    /// 순환(비정상 트리)에서도 무한 루프를 막기 위해 방문 노드 수를 노드 총수로 상한.
    fn propagate_dirty(&mut self, handle: usize) {
        self.mutation_gen += 1; // 측정 캐시 무효화 (ADR-169)
        let mut cur = Some(handle);
        let mut guard = self.nodes.len() + 1;
        while let Some(h) = cur {
            if guard == 0 {
                break; // 순환 방지 안전판 (정상 트리에선 도달 불가)
            }
            guard -= 1;
            let Some((parent, already_dirty)) = self
                .get(h)
                .map(|node| (node.parent, node.dirty))
            else {
                break;
            };
            if let Some(parent_handle) = parent {
                if let Some(parent_node) = self.get_mut(parent_handle) {
                    parent_node.subtree_dirty = true;
                }
            }
            if already_dirty {
                // 이미 dirty인 노드는 이전 전파에서 조상까지 dirty/summary를
                // 올렸으므로 중복 전파를 생략한다. 단, 바로 위 부모 summary는
                // 위에서 먼저 갱신해 재부모화 경계에서도 보수적으로 유지한다.
                break;
            }
            if let Some(node) = self.get_mut(h) {
                node.dirty = true;
            }
            cur = parent;
        }
    }

    /// 노드 제거 + handle 을 free_list 로 반환(재활용 대상).
    ///
    /// 트리 구조 변경이므로 `last_compute` 를 무효화한다 — 이어지는 compute_layout
    /// 이 동일 (root, avail) 로 stale skip 하는 것을 방지. (제거된 handle 이 재활용돼
    /// 다른 노드가 되면 handle 기반 skip 판정이 오염되므로.)
    pub fn remove_node(&mut self, handle: usize) {
        if handle < self.nodes.len() && self.nodes[handle].is_some() {
            self.mutation_gen += 1; // 측정 캐시 무효화 (ADR-169)
            self.nodes[handle] = None;
            self.free_list.push(handle);
            self.last_compute = None;
        }
    }

    /// 전체 트리 초기화.
    pub fn clear(&mut self) {
        self.mutation_gen += 1; // 측정 캐시 무효화 (ADR-169)
        self.nodes.clear();
        self.free_list.clear();
        // handle 이 0 부터 재발급되므로 stale skip 방지 위해 무효화.
        self.last_compute = None;
    }

    /// 현재 살아있는 노드 수.
    pub fn node_count(&self) -> usize {
        self.nodes.iter().filter(|n| n.is_some()).count()
    }

    // ── batch 트리 빌드 (taffy_bridge.rs build_tree_batch 대응) ──

    /// post-order(리프 먼저) JSON 배열을 파싱해 트리를 일괄 구축, handle 배열 반환.
    ///
    /// 입력 인덱스와 반환 handle 은 1:1 대응. 자식 인덱스가 이미 처리된 앞선
    /// 노드의 handle 로 치환된다(post-order 이므로 자식이 항상 부모보다 앞).
    ///
    /// # Errors
    /// JSON 파싱 실패 또는 자식 인덱스 범위 초과 시 `Err`. (taffy_bridge.rs 와
    /// 동일한 no-silent-drop 정책 — filter_map/unwrap 금지.)
    pub fn build_tree_batch(&mut self, nodes_json: &str) -> Result<Vec<usize>, String> {
        let inputs: Vec<BatchNodeInput> = serde_json::from_str(nodes_json)
            .map_err(|e| format!("build_tree_batch: parse error: {e}"))?;

        let mut handles: Vec<usize> = Vec::with_capacity(inputs.len());

        for (i, input) in inputs.into_iter().enumerate() {
            // 자식 인덱스 → 이미 발급된 handle 로 치환 (post-order 보장).
            let mut child_handles: Vec<usize> = Vec::with_capacity(input.children.len());
            for &child_idx in &input.children {
                if child_idx >= i {
                    return Err(format!(
                        "build_tree_batch: child index {child_idx} out of range at node {i} (post-order 위반)"
                    ));
                }
                child_handles.push(handles[child_idx]);
            }

            let handle = self.alloc_handle(TreeNode {
                style: input.style,
                children: child_handles.clone(),
                layout: NodeLayout::ZERO,
                dirty: true,
                subtree_dirty: !child_handles.is_empty(),
                parent: None,
                escaped_mt: block::MarginSet::ZERO,
                escaped_mb: block::MarginSet::ZERO,
                self_collapsing: false,
                intrinsic_w: None,
                last_avail: None,
                last_solved: None,
            });
            // 자식들의 parent 를 이 노드로 배선 (조상 dirty 전파 경로 확보).
            for &ch in &child_handles {
                if let Some(child) = self.get_mut(ch) {
                    child.parent = Some(handle);
                }
            }
            handles.push(handle);
        }

        Ok(handles)
    }

    // ── 레이아웃 계산 (단위 1: leaf-only 자기 크기 해결) ──

    /// `root` 를 뿌리로 트리 레이아웃 계산.
    ///
    /// **단위 1 (leaf-only)**: 각 노드를 자기 크기(width/height)만 해결한다.
    /// `root` 를 뿌리로 트리 레이아웃을 post-order solve.
    ///
    /// **단위 2 (post-order flex solve)**: 각 노드를 bottom-up 으로 방문 —
    /// (1) leaf 는 자기 크기(width/height, auto 는 0)만 해결, (2) flex 컨테이너는
    /// 자식을 먼저 solve 한 뒤 `flex.rs`(`flex_layout`) 로 배치하고 자식 bounding
    /// box 로 컨테이너 content 크기(width/height auto sentinel) 를 도출.
    ///
    /// 자식 좌표는 부모 content-box 기준 상대 좌표(taffy_bridge.rs 와 동일 — 부모
    /// origin 은 부모의 x/y, 자식 좌표는 부모 안 상대). `available_height < 0`
    /// sentinel 은 "부모 height:auto → 자식 합산으로 결정" 을 의미.
    ///
    /// block/grid dispatch 는 단위 3.
    ///
    /// **단위 4 (증분 dirty 추적)**: 증분 API(`update_style`/`set_children`/
    /// `mark_dirty`)가 변경 노드 + 조상 체인을 dirty 로 마킹한다(taffy 조상 전파
    /// 계약 이식). `solve_node` 는 서브트리에 dirty 가 하나도 없으면 저장된 layout
    /// 을 재사용하고 재귀를 생략 — dirty 서브트리만 재계산한다. 단, root-level
    /// available-space 가 직전 호출과 다르면 %/auto 크기가 stale 될 수 있어
    /// skip 을 전면 무효화(전체 재계산)한다.
    pub fn compute_layout(&mut self, root: usize, available_width: f32, available_height: f32) {
        if self.get(root).is_none() {
            return;
        }
        // available-space 가 직전과 다르면 증분 skip 무효화 (전 서브트리 강제 dirty).
        //
        // **Why 전 서브트리**: root 만 dirty 로 하면 root 재solve 시 clean 자식이
        // skip 되어 저장된(stale) layout 을 재사용한다. 하지만 available 이 바뀌면
        // 자식의 %/auto/상속 크기가 달라질 수 있으므로 clean 자식도 재계산해야 정확.
        // → root 서브트리 전체를 dirty 로 마킹해 skip 게이트를 전면 무효화한다.
        let avail_changed = self.last_compute != Some((root, available_width, available_height));
        if avail_changed {
            self.mark_subtree_dirty(root);
            self.last_compute = Some((root, available_width, available_height));
        }
        self.solve_node(root, available_width, available_height);
        self.fixup_root_self_size(root, available_width, available_height);
    }

    /// E5: root 자기 크기 결함군 정정 (ADR-156 Phase 5).
    ///
    /// solve_block/flex/grid 는 auto 크기를 **content bounding box**(shrink-to-fit, pad_border
    /// 제외)로 반환한다. 중첩 노드는 부모의 배치 커널이 stretch/clamp 하지만 **root 는 부모가
    /// 없어** 그 shrink-to-fit 이 그대로 최종 크기가 된다. CSS 는 block-level root 를 containing
    /// block(availW)으로 fill 하고, auto 높이에 pad_border 를 더하며, 자기 min/max 로 clamp 한다.
    ///
    /// **explicit 차원은 건드리지 않는다** — 라이브 root(body)는 명시 크기라 회귀 0. auto 축에만 적용.
    fn fixup_root_self_size(&mut self, root: usize, avail_w: f32, avail_h: f32) {
        let style = self.get(root).map(|n| n.style.clone()).unwrap_or_default();
        let ctx_w = self.ctx_for(avail_w);
        let ctx_h = self.ctx_for(avail_h);
        let has_w = resolve_dimension_opt(style.width.as_deref(), &ctx_w).is_some();
        let has_h = resolve_dimension_opt(style.height.as_deref(), &ctx_h).is_some();
        // 컨테이너 자신의 세로 pad_border (auto 높이 = content + pad_border, border-box).
        let own_pb_v = axis_pad_border(&style, &ctx_w, false);

        let mut layout = self.get(root).map(|n| n.layout).unwrap_or(NodeLayout::ZERO);

        // ① auto width → availW fill (block-level root). explicit 폭은 유지.
        if !has_w && avail_w > 0.0 {
            layout.width = avail_w;
            // min/max width clamp (자기 크기 — CSS §10.4).
            // r12m2 sweep — §10.4: max 먼저, 그 다음 min (min > max 면 min 우선).
            if let Some(mx) = resolve_dimension_opt(style.max_width.as_deref(), &ctx_w) {
                layout.width = layout.width.min(mx);
            }
            if let Some(mn) = resolve_dimension_opt(style.min_width.as_deref(), &ctx_w) {
                layout.width = layout.width.max(mn);
            }
        }

        // ② auto height → content + pad_border, 이어서 자기 min/max clamp. explicit 높이는 유지.
        if !has_h {
            layout.height += own_pb_v;
            // r12m2 sweep — §10.7: max 먼저, 그 다음 min (Chrome root min-height:30 + max-height:10
            // → 30 / 종전 10).
            if let Some(mx) = resolve_dimension_opt(style.max_height.as_deref(), &ctx_h) {
                layout.height = layout.height.min(mx);
            }
            if let Some(mn) = resolve_dimension_opt(style.min_height.as_deref(), &ctx_h) {
                layout.height = layout.height.max(mn);
            }
        }

        if let Some(n) = self.get_mut(root) {
            n.layout = layout;
        }
    }

    /// 트랙 intrinsic 측정용 자식 기여값 — 자식 **자신의** min/max 로 clamp.
    ///
    /// CSS-GRID-1 §12.5: `auto` 트랙 크기는 자식의 content 크기가 아니라 min/max 로 clamp 된
    /// **기여값(contribution)** 의 최댓값이다. `solve_node` 는 노드 자신의 min/max 를 적용하지
    /// 않는다 — flex item 은 `flex.rs` 가 프로토콜 off 10/12 로 따로 처리하고, root 는
    /// `fixup_root_self_size` 가 처리하므로 그 두 경로만 덮여 있었다. 그래서 grid auto 트랙
    /// 측정에서는 콘텐츠가 없고 `min-height` 만 선언한 자식이 0 으로 측정되어 트랙 전체를
    /// 무너뜨렸다 — Frame 프리셋의 header/navigation 밴드가 캔버스에서 사라지던 원인
    /// (2026-07-26 실측: 같은 자리에 `height` 를 주면 60, `minHeight` 는 0).
    ///
    /// 여기서만 clamp 하고 `solve_node` 는 건드리지 않는다. 트랙 크기 산정은 CSS 가 기여값을
    /// 따로 정의하는 지점이라 국소 적용이 맞고, `solve_node` 전역 변경은 flex/block 경로와
    /// 이중 적용될 위험이 있다.
    fn track_contribution(
        &self,
        child: usize,
        width: f32,
        height: f32,
        avail_w: f32,
        avail_h: f32,
    ) -> (f32, f32) {
        let Some(node) = self.get(child) else {
            return (width, height);
        };
        let ctx_w = self.ctx_for(avail_w);
        let ctx_h = self.ctx_for(avail_h);
        let style = &node.style;
        let mut w = width;
        let mut h = height;
        // r12m2 sweep — max 먼저, 그 다음 min (§10.4/§10.7; Chrome grid item min-height:30 +
        // max-height:10 → 트랙 30 / 종전 10).
        if let Some(mx) = resolve_dimension_opt(style.max_width.as_deref(), &ctx_w) {
            w = w.min(mx);
        }
        if let Some(mn) = resolve_dimension_opt(style.min_width.as_deref(), &ctx_w) {
            w = w.max(mn);
        }
        if let Some(mx) = resolve_dimension_opt(style.max_height.as_deref(), &ctx_h) {
            h = h.min(mx);
        }
        if let Some(mn) = resolve_dimension_opt(style.min_height.as_deref(), &ctx_h) {
            h = h.max(mn);
        }
        (w, h)
    }

    /// 아이템의 **최소 기여**에 CSS-GRID-1 §6.6 자동 최소 크기 clamp 를 적용한다.
    ///
    /// §12.5 의 minimum contribution 정의가 두 갈래다:
    /// - 선호 크기가 **확정**(`width:90px`) → 최소 기여 = min-content 기여 = 그 크기. clamp 없음.
    /// - 선호 크기가 **`auto` 처럼 동작**(auto / % / fit-content 등) → 최소 기여 = *used
    ///   minimum size*. 명시 `min-*` 이 있으면 그 값이고, 없으면 자동 최소 크기이며 이때만
    ///   §6.6 이 "고정 max 트랙만 span 하면 그 상한으로 clamp" 를 건다.
    ///
    /// Chrome 실측(트랙 `minmax(auto,20px)`, 내용 min 40)이 네 줄로 갈라 준다:
    /// `width:auto`→20 · `width:90px`→**90** · `min-width:70px`→**70** · `width:50%`→20.
    /// 세로도 같다 — `minmax(auto,40px)` 행에서 `height:60px` 자식은 **60**.
    /// 명시 `min-*` 은 뒤이어 도는 `track_contribution` 의 `max(min)` 이 되살리므로,
    /// 여기서는 clamp 를 걸어도 결과가 같다 (실측 70 = max(clamp 20, min-width 70)).
    fn clamp_auto_min_contribution(
        &self,
        child: usize,
        raw_min: f32,
        fixed_max: Option<f32>,
        horizontal: bool,
    ) -> f32 {
        let Some(limit) = fixed_max else {
            return raw_min;
        };
        let Some(node) = self.get(child) else {
            return raw_min;
        };
        let pref = if horizontal {
            node.style.width.as_deref()
        } else {
            node.style.height.as_deref()
        };
        if preferred_size_behaves_as_auto(pref) {
            raw_min.min(limit)
        } else {
            raw_min
        }
    }

    /// 자식의 **인라인 축** content 기여 `(min-content, max-content, 컨테이너로_solve함)`.
    ///
    /// CSS-GRID-1 §12.5 의 트랙 기여값이다. 두 값이 갈려야 `auto` 트랙이 base(min-content)
    /// ↔ 상한(max-content) 사이에서 움직인다 — 실측 `auto auto` / 컨테이너 150 에서
    /// 트랙이 75·75 가 되는 것은 base 40 에 여유 35 씩이 §12.6 으로 붙기 때문이다.
    ///
    /// grid 서브트리는 `measure_intrinsic_width` 가 `None` 이라(ADR-169 이연) 기존
    /// "컨테이너 크기로 solve" 근사로 떨어지고, 그때는 min·max 를 같은 값으로 둔다 —
    /// `(v, v)` 는 base == 상한이라 종전 동작(측정값에 고정)과 정확히 같다.
    ///
    /// 세 번째 반환값은 "서브트리를 컨테이너 크기로 solve 했다" 는 신고다. 그 경우
    /// 자식이 clean 으로 남아 셀 크기 재solve 가 증분 skip 되므로 호출부가 되살려야 한다
    /// (`measure_intrinsic_width` 경로는 스냅샷 복구가 있어 오염이 없다).
    fn col_contribution(
        &mut self,
        c: usize,
        container_w: f32,
        container_h: f32,
        fixed_max: Option<f32>,
    ) -> (f32, f32, bool) {
        // §12.5 의 기여는 **outer size(margin-box)** 다 (ADR-170 군집 H). border-box
        // 측정값에 가로 margin 을 더한다 — item min/max clamp(track_contribution) 는
        // border-box 대상이라 margin 은 clamp **뒤**에 더한다. 실측 `auto auto`/300 +
        // `marginLeft:10px` 자식: Chrome 트랙 175(기여 80 + §12.8 95) / 종전 엔진 170
        // (기여 70) — Δ = margin/2 이 §12.8 균등 분배로 두 트랙에 갈라져 나타난다.
        let m_h = {
            let ctx = self.ctx_for(container_w.max(0.0));
            let resolve_margin = |v: Option<&str>| -> f32 {
                match v.map(str::trim) {
                    // `%` margin 은 intrinsic 기여에서 0 — 기준이 지금 구하는 크기
                    // 자신이라 순환이다 (§5.1 순환 백분율과 같은 규칙). auto 도 0.
                    Some(t) if t.ends_with('%') => 0.0,
                    _ => resolve_signed(v, &ctx),
                }
            };
            self.get(c)
                .map(|n| {
                    resolve_margin(n.style.margin_left.as_deref())
                        + resolve_margin(n.style.margin_right.as_deref())
                })
                .unwrap_or(0.0)
        };
        if let Some((mn, mx)) = self.measure_intrinsic_width(c) {
            let mn = self.clamp_auto_min_contribution(c, mn, fixed_max, true);
            let (mn, _) = self.track_contribution(c, mn, 0.0, container_w, container_h);
            let (mx, _) = self.track_contribution(c, mx, 0.0, container_w, container_h);
            return ((mn + m_h).min(mx + m_h), mx + m_h, false);
        }
        let (cw, ch) = self.solve_node(c, container_w, container_h);
        let (cw, _) = self.track_contribution(c, cw, ch, container_w, container_h);
        (cw + m_h, cw + m_h, true)
    }

    /// 서브트리(`handle` 포함)에 dirty 노드가 하나라도 있으면 true.
    ///
    /// 자손 요약 플래그로 판정하므로 clean subtree를 재귀 순회하지 않는다.
    /// dirty 노드가 하나라도 있으면 정확성을 위해 해당 노드부터 전체 재solve
    /// (자식 available 이 부모 재배치로 바뀔 수 있으므로).
    #[inline]
    fn subtree_has_dirty(&self, handle: usize) -> bool {
        #[cfg(test)]
        self.skip_walk_visits
            .set(self.skip_walk_visits.get().saturating_add(1));
        let Some(node) = self.get(handle) else {
            return false;
        };
        node.dirty || node.subtree_dirty
    }

    /// display:none 서브트리(`handle` 포함) 전체를 zero layout + clean 처리.
    ///
    /// none 자식은 solve 재귀에서 제외되므로, dirty 를 남기면 부모의
    /// `subtree_has_dirty` skip 게이트가 영구 무력화된다 — 자손까지 함께 정리.
    fn zero_subtree_layout(&mut self, handle: usize) {
        let children = match self.get(handle) {
            Some(n) => n.children.clone(),
            None => return,
        };
        if let Some(n) = self.get_mut(handle) {
            n.layout = NodeLayout { x: 0.0, y: 0.0, width: 0.0, height: 0.0, baseline: BASELINE_NONE };
            n.dirty = false;
            n.subtree_dirty = false;
        }
        for c in children {
            self.zero_subtree_layout(c);
        }
    }

    /// 서브트리(`handle` 포함) 전체를 dirty 로 마킹.
    ///
    /// available-space 변경 시 skip 게이트를 전면 무효화하는 데 사용. 조상 전파와
    /// 달리 하향(자손 방향) 마킹이다.
    fn mark_subtree_dirty(&mut self, handle: usize) {
        let children = match self.get(handle) {
            Some(node) => {
                // 이미 서브트리 전체가 dirty 라면 재하향 불필요 (동일 avail 반복 호출 절감).
                node.children.clone()
            }
            None => return,
        };
        if let Some(node) = self.get_mut(handle) {
            node.dirty = true;
            node.subtree_dirty = !children.is_empty();
        }
        for c in children {
            self.mark_subtree_dirty(c);
        }
    }

    // ── intrinsic 측정 패스 (ADR-169 Phase 1) ──

    /// 서브트리의 `(dirty, subtree_dirty, layout, last_avail, last_solved)` 를
    /// 수집 — 측정 패스 전후 원상 복구용.
    fn snapshot_subtree(&self, handle: usize, out: &mut Vec<SubtreeSnap>) {
        let Some(node) = self.get(handle) else { return };
        out.push((
            handle,
            node.dirty,
            node.subtree_dirty,
            node.layout,
            node.last_avail,
            node.last_solved,
        ));
        for c in node.children.clone() {
            self.snapshot_subtree(c, &mut *out);
        }
    }

    /// `snapshot_subtree` 결과를 되돌린다.
    ///
    /// `last_avail` 도 함께 되돌린다 — 측정 pass 는 센티넬 available 로 돌므로
    /// 그 값이 남으면 skip 게이트의 키가 측정값으로 오염된다 (복구 대상은
    /// layout·dirty·available 3종이 한 묶음).
    fn restore_subtree(&mut self, snap: &[SubtreeSnap]) {
        for &(h, dirty, subtree_dirty, layout, last_avail, last_solved) in snap {
            if let Some(node) = self.get_mut(h) {
                node.dirty = dirty;
                node.subtree_dirty = subtree_dirty;
                node.layout = layout;
                node.last_avail = last_avail;
                node.last_solved = last_solved;
            }
        }
    }

    /// 노드의 폭 축 intrinsic `(min_content, max_content)` 측정 (border-box).
    ///
    /// 동일 `solve_node` 를 **측정 모드 available 로 재실행**한다 — Taffy/Yoga/Blink 가
    /// 공유하는 형태다. 컨테이너는 기존 집계 경로를 그대로 쓰고, 모드 분기는
    /// `resolve_leaf_intrinsic_width` 한 곳에만 있다.
    ///
    /// **부작용 없음이 계약**: solve 는 서브트리의 `layout`/`dirty` 를 건드리므로
    /// 측정 전 스냅샷을 떠 끝나면 원상 복구한다. 복구하지 않고 `mark_subtree_dirty` 로
    /// 갈음하면 **자손 측정 캐시까지 함께 날아가** 중첩 깊이에 지수적이 된다 (R1/G4).
    /// 측정 pass 가 서브트리를 clean 으로 남겨 이후 solve 가 증분 skip 하는 오염
    /// (grid 측정 pass 선례) 도 이 복구로 함께 차단된다.
    ///
    /// **grid 서브트리도 대상**이다 (2026-07-28 — ADR-169 이 이연했던 축). `solve_grid` 가
    /// 측정 센티넬을 받으면 트랙을 available 분배 대신 **자식 기여**로 세우므로
    /// (§12.5–§12.7.1), 음수 available 에서 `fr_size = 0` 으로 붕괴하던 경로가 없다.
    /// 반환이 `None` 인 경우는 이제 없다 — 시그니처는 호출부 폴백 계약 때문에 유지한다.
    fn measure_intrinsic_width(&mut self, handle: usize) -> Option<(f32, f32)> {
        let gen = self.mutation_gen;
        if let Some((g, min_w, max_w)) = self.get(handle).and_then(|n| n.intrinsic_w) {
            if g == gen {
                // ADR-183 #5 — HIT. "부모는 맞고 자손만 틀림" 서명의 판별점이다:
                // 세대가 안 바뀌면 스타일이 바뀌어도 옛 측정값이 그대로 소비된다.
                if self.trace.is_some() {
                    self.trace_push(handle, || TraceEvent::IntrinsicMeasure {
                        hit: true,
                        generation: g,
                        min: min_w,
                        max: max_w,
                    });
                }
                return Some((min_w, max_w));
            }
        }
        let mut snap = Vec::new();
        self.snapshot_subtree(handle, &mut snap);

        // 이 아래 두 번의 solve 는 **센티넬 available 로 도는 가상 solve** 다. 그
        // 구간 이벤트를 본 solve 와 같은 줄에 놓으면 판독이 오도되므로 태그를 건다 (R5).
        if let Some(sink) = self.trace.as_mut() {
            sink.enter_measure();
        }

        // 측정 전 dirty 강제 — clean 서브트리면 `solve_node` 가 저장된 layout 을
        // 그대로 돌려줘 측정이 아니라 **직전 배치 결과**를 읽게 된다.
        self.mark_subtree_dirty(handle);
        let (min_w, _) = self.solve_node(handle, MIN_CONTENT_AVAIL, INDEFINITE_AVAIL);
        self.mark_subtree_dirty(handle);
        let (max_w, _) = self.solve_node(handle, MAX_CONTENT_AVAIL, INDEFINITE_AVAIL);

        self.restore_subtree(&snap);
        if let Some(sink) = self.trace.as_mut() {
            sink.exit_measure();
        }
        // min ≤ max 불변식 — 집계 근사라 역전이 원리상 가능하다(§9.9.3 미구현, R4).
        let result = (min_w.min(max_w), max_w);
        if let Some(node) = self.get_mut(handle) {
            node.intrinsic_w = Some((gen, result.0, result.1));
        }
        // MISS — 재측정이 실제로 돌았다. `generation` 이 직전 HIT 과 다르면 그 사이
        // mutation 이 있었다는 뜻이고, 같은 세대에서 MISS 가 반복되면 캐시가 안 잡히는 것.
        if self.trace.is_some() {
            self.trace_push(handle, || TraceEvent::IntrinsicMeasure {
                hit: false,
                generation: gen,
                min: result.0,
                max: result.1,
            });
        }
        Some(result)
    }

    /// 측정 모드에서 **자식**을 푸는 진입점 (ADR-169 Phase 4 / G4).
    ///
    /// 컨테이너 자식은 서브트리를 다시 풀지 않고 **캐시된 intrinsic 을 소비**한다.
    /// 값은 `solve_node(c, 센티넬, ...)` 와 동일하다 — `measure_intrinsic_width` 가
    /// 바로 그 호출의 결과를 캐시하기 때문이다. 다른 것은 **횟수**뿐이다:
    /// 재귀 solve 면 노드마다 서브트리를 훑어 깊이에 겹치지만, 캐시 소비면 노드당
    /// 1회로 끝난다 (Taffy `compute_intrinsic` / Blink `ComputeMinMaxSizes` 형태).
    ///
    /// cross 는 `0.0` 으로 둔다 — 측정 모드의 반환값 중 **폭만** 소비되고, nowrap
    /// 컨테이너에서 cross 는 주축 결과에 영향을 주지 않는다. wrap 컨테이너는 라인
    /// 분할이 cross 에 걸리므로 호출부에서 이 경로를 쓰지 않는다.
    ///
    /// grid 자식은 `measure_intrinsic_width` 가 `None` 이라 자동으로 기존 재귀
    /// 경로로 떨어진다 (§컨테이너 intrinsic 이연).
    fn solve_child_intrinsic_aware(&mut self, c: usize, sw: f32, sh: f32) -> (f32, f32) {
        if let Some(mode) = intrinsic_mode(sw) {
            let is_container = self.get(c).map(|n| !n.children.is_empty()).unwrap_or(false);
            if is_container {
                if let Some((min_w, max_w)) = self.measure_intrinsic_width(c) {
                    return (
                        match mode {
                            IntrinsicMode::Min => min_w,
                            IntrinsicMode::Max => max_w,
                        },
                        0.0,
                    );
                }
            }
        }
        self.solve_node(c, sw, sh)
    }

    /// block 컨테이너의 자식 1개 solve — atomic inline(line item) 이고 폭 auto 면
    /// **shrink-to-fit** (CSS 2.1 §10.3.9: used width = min(max-content,
    /// max(min-content, available − margin − pad/border))).
    ///
    /// ADR-923 Phase 3 (r6 관찰 → Chrome 실측 ib-shrink-to-fit-wrap ·
    /// ib-fit-under-min-content · ib-pct-child-shrink): 종전엔 부모의 definite
    /// available 로 1회 solve 한 content 폭을 그대로 써 wrap flex(80×2, avail 100)가
    /// fit-content 100 대신 80 이 되고, available < min-content 에서 floor 없이
    /// 잘리고, percentage 자식이 부모 available 기준으로 선해소됐다. fit 확정 후 그
    /// 폭으로 재-solve — wrap·percentage 가 fit 기준으로 재해소되고, used width 는
    /// content bbox 가 아니라 fit 자체다 (§10.3.9 used value). 재-solve 전
    /// `mark_subtree_dirty` 필수 (측정 pass clean 캐시 함정).
    fn solve_block_child(&mut self, c: usize, sw: f32, sh: f32) -> (f32, f32) {
        let (atomic, w_auto, has_children, cstyle) = match self.get(c) {
            Some(n) => (
                display::is_atomic_inline_level(display::parse_display(
                    n.style.display.as_deref(),
                )),
                matches!(n.style.width.as_deref(), None | Some("auto")),
                !n.children.is_empty(),
                n.style.clone(),
            ),
            None => return self.solve_child_intrinsic_aware(c, sw, sh),
        };
        if sw >= 0.0 && atomic && w_auto && has_children {
            if let Some((min_w, max_w)) = self.measure_intrinsic_width(c) {
                let ctx = self.ctx_for(sw);
                let pbh = axis_pad_border(&cstyle, &ctx, true);
                let margins = resolve_dimension(cstyle.margin_left.as_deref(), &ctx)
                    + resolve_dimension(cstyle.margin_right.as_deref(), &ctx);
                let avail_content = (sw - margins - pbh).max(0.0);
                let fit = max_w.min(min_w.max(avail_content));
                self.mark_subtree_dirty(c);
                let (_, h) = self.solve_node(c, fit + pbh, sh);
                return (fit, h);
            }
        }
        self.solve_child_intrinsic_aware(c, sw, sh)
    }

    /// 노드의 **실효** display 이원 구조 (ADR-923 Phase 1): 자기 style 의 CSS 값 1개를
    /// `display::parse_display` 로 읽고, 부모가 flex/grid 컨테이너면 `display::blockify`
    /// (outer=block, inner 유지 — CSS Display 3 §2.7; TS `fullTreeLayout.ts` `blockifyDisplay`
    /// 의 엔진 대응). 부모가 block 이면 outer 그대로 — `write_block_item` 이 outer 로 line
    /// item 을 판정한다. root(부모 없음) 는 자기 값 그대로.
    fn effective_display(&self, handle: usize) -> Display {
        let Some(node) = self.get(handle) else {
            return display::parse_display(None);
        };
        let own = display::parse_display(node.style.display.as_deref());
        let parent_is_flex_or_grid = node
            .parent
            .and_then(|p| self.get(p))
            .map(|p| {
                matches!(
                    classify_container_display(p.style.display.as_deref()),
                    ContainerDisplay::Flex | ContainerDisplay::Grid
                )
            })
            .unwrap_or(false);
        if parent_is_flex_or_grid { display::blockify(own) } else { own }
    }

    /// 노드 하나를 solve — 자식을 먼저 재귀 solve 한 뒤 display 별로 배치.
    /// 반환: (content_width, content_height) — 부모 intrinsic 도출용.
    fn solve_node(&mut self, handle: usize, avail_w: f32, avail_h: f32) -> (f32, f32) {
        let Some(node) = self.get(handle) else {
            return (0.0, 0.0);
        };

        // 증분 skip: 서브트리가 전부 clean 이면 **직전 반환값**(`last_solved`)을 재사용.
        //
        // **`layout` 을 돌려주면 안 된다** (2026-07-28): `solve_*` 가 저장한 값은 배치
        // 단계에서 **부모가 border-box 로 덮어쓴다**. auto 축의 반환 계약은 content-box
        // 이므로 skip 이 `layout` 을 돌려주면 부모가 pad+border 를 다시 더해 skip 마다
        // 그만큼 부풀어 오른다. 반환값을 따로 들고 있어야 skip 이 멱등이다.
        //
        // **available 도 키다** (2026-07-28): 저장된 layout 은 *그때 받은 available*
        // 에서만 유효하다. 노드가 **재부모화**되면 자기 style/children 은 그대로라
        // 서브트리가 clean 인데 부모가 주는 available 은 달라진다 — 게이트가
        // dirty 만 보면 직전 부모 밑에서 계산된 크기를 그대로 돌려준다 (라이브:
        // 레이어 이동/undo 뒤 크기가 이전 부모 기준으로 눌러앉음). root-level
        // `last_compute` 비교로는 못 잡는다 — 같은 root·같은 available 이기 때문.
        //
        // NOTE(진단): 이 게이트가 병인일 때의 증상 서명 — 다른 곳으로 진단하지 말 것.
        //   ① "편집한 요소가 아니라 **무관한 형제**가 변한다" — 편집 대상은 dirty 라
        //      skip 되지 않는다. 원인을 찾을 때 편집한 쪽을 보면 길을 잃는다.
        //   ② "**새로고침하면 정상**으로 돌아온다" — 전체 재빌드가 캐시를 버리는 것.
        //      store/canonical 데이터 문제가 **아니다** (스냅샷 diff 로 1분 안에 배제).
        //   ③ padding 0 요소는 무증상이라 "특정 컴포넌트만 이상하다" 로 잘못 귀속된다.
        //   상세: .claude/rules/layout-engine.md §"증분 skip 의 키는 dirty 와 available 둘이다"
        //
        // ADR-183: 판정은 `skip_decision` **단일 함수**가 내리고 게이트와 트레이스가
        // 그것을 공유한다 — 트레이스 쪽에 조건을 복제하면 게이트를 고칠 때 explain 만
        // 옛 조건을 보고해 거짓 안심을 준다 (R2). `subtree_has_dirty` 는 O(1) 요약
        // 게이트지만 클로저로 넘겨 **기존 단축 평가를 보존**한다 (last_solved 가
        // 없으면 요약 판정도 호출하지 않는다).
        let (skip_reason, skip_prev) =
            Self::skip_decision(node, || self.subtree_has_dirty(handle), avail_w, avail_h);
        if let Some(prev) = skip_prev {
            if self.trace.is_some() {
                self.trace_push(handle, || TraceEvent::IncrementalSkip {
                    reason: skip_reason,
                    avail: (avail_w, avail_h),
                });
            }
            return prev;
        }

        let children = node.children.clone();
        // ADR-923 Phase 1: display 이원 계약 — 자기 solver 는 **inner** 로 고른다. 부모가
        // flex/grid 컨테이너면 blockify (outer=block, inner 유지 — CSS Display 3 §2.7).
        let display = container_display_of(self.effective_display(handle));
        // 이 solve 가 쓰는 available 을 기록 — 위 게이트의 두 번째 키. 첫 borrow 가
        // 끝난 지점에서 한 번만 쓴다 (재-borrow 추가 없이).
        if let Some(n) = self.get_mut(handle) {
            n.last_avail = Some((avail_w, avail_h));
        }
        // MISS 사유 기록 — HIT 는 위에서 이미 남기고 반환했다.
        if self.trace.is_some() {
            self.trace_push(handle, || TraceEvent::IncrementalSkip {
                reason: skip_reason,
                avail: (avail_w, avail_h),
            });
        }
        // display:none 자식은 layout 비참여 (CSS: 박스 미생성 — 크기/흐름/gap 전부 제외).
        // zero layout 을 기록해 get_layouts_batch 완전성은 유지한다 (tree_golden N9).
        //
        // position:absolute/fixed 자식도 **in-flow 에서 제외**한다 (CSS: out-of-flow —
        //   컨테이너 크기/형제 배치/gap 에 기여하지 않음). 흐름 배치가 끝나 컨테이너
        //   크기가 확정된 뒤 `place_absolute_children` 이 inset/margin 으로 배치한다.
        let mut abs_children: Vec<usize> = Vec::new();
        let children: Vec<usize> = {
            let mut flow = Vec::with_capacity(children.len());
            for &c in &children {
                let Some(cn) = self.get(c) else { continue };
                if cn.style.display.as_deref() == Some("none") {
                    self.zero_subtree_layout(c);
                    continue;
                }
                if is_out_of_flow(cn.style.position.as_deref()) {
                    abs_children.push(c);
                } else {
                    flow.push(c);
                }
            }
            flow
        };

        // 명시 크기(있으면) — auto 는 아래에서 content 로 채움.
        let (mut explicit_w, mut explicit_h) = self.resolve_self_size(handle, avail_w, avail_h);

        // 컨테이너 자신의 intrinsic 키워드 폭 해소 (CSS-SIZING-3 §5 — ADR-170 군집 B).
        //
        // 종전엔 키워드가 부모 intake 의 `CONTENT` 센티넬로만 처리되어, 소비되는 값이
        // **일반 solve 의 content bounding box** (auto 자식 stretch 포함) 였다. 자식이
        // 확정 폭이면 우연히 min==max==bbox 라 정합이었지만, 측정 스칼라 leaf 는
        // stretch 된 폭이 bbox 를 밀어 올려 `width:min-content` 가 부모 폭 전체가 됐다
        // (실측 dom 50 / eng 300). 올바른 값은 측정 모드 재실행이 내는 min/max-content 다.
        //
        // - leaf 는 `resolve_leaf_intrinsic_width` 가 스칼라로 자체 해소 — 여기는 컨테이너만.
        // - grid 는 `solve_grid` 의 `inline_intrinsic` 이 §12.5 트랙 경로로 자체 처리한다.
        //   여기서 선해소해 definite 로 넘기면 `fr` 이 확정 폭을 재분배해 §12.7.1 의
        //   freeze 계약이 무너진다 (`1fr 1fr`/min-content 40·30 → 35·35) — grid 제외.
        // - 측정 패스 안에서는 measure 재진입 대신 **키워드가 요구하는 모드로 센티넬을
        //   고정**한다 (§5.2 — `width:min-content` 상자의 max-content 기여도 min-content).
        //   fit-content 는 측정 컨텍스트에서 현재 모드 값과 같으므로 무변경.
        let mut avail_w = avail_w;
        if explicit_w <= 0.0
            && !children.is_empty()
            && display != ContainerDisplay::Grid
        {
            if let Some(kw) = self.width_intrinsic_keyword(handle, avail_w) {
                match intrinsic_mode(avail_w) {
                    None => {
                        if let Some((mn, mx)) = self.measure_intrinsic_width(handle) {
                            let resolved = if kw == MIN_CONTENT {
                                mn
                            } else if kw == MAX_CONTENT {
                                mx
                            } else if avail_w >= 0.0 {
                                // fit-content = clamp(min-content, stretch-fit, max-content).
                                // stretch-fit = available − margin (mn/mx 와 같은 border-box 산술).
                                let ctx = self.ctx_for(avail_w);
                                let m = self
                                    .get(handle)
                                    .map(|n| {
                                        resolve_signed(n.style.margin_left.as_deref(), &ctx)
                                            + resolve_signed(n.style.margin_right.as_deref(), &ctx)
                                    })
                                    .unwrap_or(0.0);
                                (avail_w - m).clamp(mn, mx)
                            } else {
                                // avail indefinite → max-content (CSS-SIZING-3 §5).
                                mx
                            };
                            if resolved > 0.0 {
                                explicit_w = resolved;
                            }
                        }
                    }
                    Some(mode) => {
                        let want = if kw == MIN_CONTENT {
                            IntrinsicMode::Min
                        } else if kw == MAX_CONTENT {
                            IntrinsicMode::Max
                        } else {
                            mode
                        };
                        if want != mode {
                            avail_w = match want {
                                IntrinsicMode::Min => MIN_CONTENT_AVAIL,
                                IntrinsicMode::Max => MAX_CONTENT_AVAIL,
                            };
                        }
                    }
                }
            }
        }
        // ── used size = clamp(명시/stretch, min-*, max-*) — ADR-170 군집 A ──
        //
        // CSS-SIZING-3 §5.1: used size 는 min/max clamp **뒤**의 값이고 내부 배치·파생의
        // 입력이다. 기존 규칙 (layout-engine.md §"컨테이너의 used size 는 clamp 뒤의 값")
        // 은 flex main/cross + grid block 3축만 덮었다 — 인라인 축은 clamp 가 부모 intake
        // (block.rs `clamp_size` / flex.rs off 10·12) 에만 걸려, **상자만 clamp 되고
        // 자식들은 clamp 이전 폭 기준으로 배치**됐다 (실측 `w=120px+minW200`: 상자 200 /
        // 자식 120 · `w=auto+maxW60`: 상자 60 / 자식 300).
        // 필요한 값을 **borrow 한 번**으로 해소 — NodeStyle 전체 clone 은 solve_node
        // 가 노드마다 도는 hot path 라 bench 회귀를 만든다 (Option<String> 50필드 힙 복제).
        let ctx_w_own = self.ctx_for(avail_w);
        let ctx_h_own = self.ctx_for(avail_h);
        let (
            own_min_w,
            own_max_w,
            own_min_h,
            own_max_h,
            own_margin_h,
            own_aspect,
            own_min_h_absent,
            own_overflow_y_visible,
        ) = match self.get(handle) {
            Some(node) => {
                let s = &node.style;
                (
                    resolve_dimension_opt(s.min_width.as_deref(), &ctx_w_own),
                    resolve_dimension_opt(s.max_width.as_deref(), &ctx_w_own),
                    resolve_dimension_opt(s.min_height.as_deref(), &ctx_h_own),
                    resolve_dimension_opt(s.max_height.as_deref(), &ctx_h_own),
                    resolve_signed(s.margin_left.as_deref(), &ctx_w_own)
                        + resolve_signed(s.margin_right.as_deref(), &ctx_w_own),
                    s.aspect_ratio.filter(|r| *r > 0.0),
                    s.min_height.is_none(),
                    s.overflow_y
                        .as_deref()
                        .map(|o| o.eq_ignore_ascii_case("visible"))
                        .unwrap_or(true),
                )
            }
            None => (None, None, None, None, 0.0, None, true, true),
        };
        if explicit_w > 0.0 {
            // 명시 폭 (키워드 해소값 포함) — max 먼저, min 이 이긴다 (CSS §5.1).
            let before = explicit_w;
            if let Some(mx) = own_max_w {
                explicit_w = explicit_w.min(mx);
            }
            if let Some(mn) = own_min_w {
                explicit_w = explicit_w.max(mn);
            }
            // ADR-183 #2 — **바인딩했을 때만** 기록한다. clamp 선언은 있는데 값이 안
            // 바뀐 경우까지 남기면 판독자가 "clamp 탓" 으로 잘못 몰린다.
            if self.trace.is_some() && explicit_w != before {
                let bound = if explicit_w < before { ClampBound::Max } else { ClampBound::Min };
                let to = explicit_w;
                self.trace_push(handle, || TraceEvent::UsedSizeClamp {
                    axis: Axis::Inline,
                    bound,
                    from: before,
                    to,
                });
            }
        } else if !children.is_empty()
            && intrinsic_mode(avail_w).is_none()
            && avail_w >= 0.0
        {
            // auto 폭 + block-level stretch 문맥: 잠정 used = avail − margins. definite
            // 승격 조건 둘 — ① clamp 가 실제로 **바인딩** (군집 A) ② aspect 의 w→h 전송이
            // stretch 폭을 입력으로 요구 (군집 F — §5 preferred size 가 stretch 로 정해지고
            // 그 값이 전송 입력이다. 실측 `ratio 2` + 양축 auto: Chrome h=150=300/2, 종전
            // 엔진은 전송 자체가 안 돌아 h=content 50). 비바인딩·비aspect 면 기존 auto 경로
            // 유지 (flex item main 등 stretch 가 아닌 문맥에서 폭을 강제하지 않기 위함).
            // 부모가 block 일 때만 — flex/grid item 의 used 크기는 그 커널 소관이다.
            // aspect 의 h→w 전송이 예정된 상자는 제외 (전송값이 stretch 를 이긴다 — §5).
            let aspect_needs_w = own_aspect.is_some() && explicit_h <= 0.0;
            if own_min_w.is_some() || own_max_w.is_some() || aspect_needs_w {
                let parent_is_block = self
                    .get(handle)
                    .and_then(|n| n.parent)
                    .and_then(|p| self.get(p))
                    .map(|p| {
                        classify_container_display(p.style.display.as_deref())
                            == ContainerDisplay::Block
                    })
                    .unwrap_or(false);
                let aspect_transfers_w = own_aspect.is_some() && explicit_h > 0.0;
                if parent_is_block && !aspect_transfers_w {
                    let tentative = avail_w - own_margin_h;
                    let mut clamped = tentative;
                    if let Some(mx) = own_max_w {
                        clamped = clamped.min(mx);
                    }
                    if let Some(mn) = own_min_w {
                        clamped = clamped.max(mn);
                    }
                    if (clamped != tentative || aspect_needs_w) && clamped > 0.0 {
                        explicit_w = clamped;
                    }
                }
            }
        }
        // 블록 축 — 명시 높이의 clamp. 자식 `%` base (`child_containing_h`) / grid definite
        // 게이트 / flex main 이 이 값을 소비한다 (flex 3.6 재-clamp 는 멱등).
        if explicit_h > 0.0 {
            let before = explicit_h;
            if let Some(mx) = own_max_h {
                explicit_h = explicit_h.min(mx);
            }
            if let Some(mn) = own_min_h {
                explicit_h = explicit_h.max(mn);
            }
            if self.trace.is_some() && explicit_h != before {
                let bound = if explicit_h < before { ClampBound::Max } else { ClampBound::Min };
                let to = explicit_h;
                self.trace_push(handle, || TraceEvent::UsedSizeClamp {
                    axis: Axis::Block,
                    bound,
                    from: before,
                    to,
                });
            }
        }

        // E15: aspect-ratio — 한 축만 명시되고 다른 축이 auto 면 ratio 로 파생 (CSS §4).
        //   ratio = width / height → height = width/ratio, width = height*ratio.
        //   군집 A clamp **뒤**에 돈다 — 파생 입력은 used size 다 (군집 G).
        //
        //   w→h 전송은 CSS-SIZING-4 §5.2.2 자동 최소의 대상이다: ratio-의존 축의
        //   min-size = content (min-height 미지정 + overflow visible). 그래서 자식 보유
        //   상자는 전송값을 explicit 로 굳히지 않고 dispatch 뒤 content 와 max 한다
        //   (실측 `w:120px + maxW60 + ratio 2`: 전송 30 < 내용 50 → Chrome 50).
        let mut aspect_h_floor: Option<f32> = None;
        if let Some(ratio) = own_aspect {
            {
                if explicit_w > 0.0 && explicit_h <= 0.0 {
                    let transferred = explicit_w / ratio;
                    let floor_applies =
                        !children.is_empty() && own_min_h_absent && own_overflow_y_visible;
                    if floor_applies {
                        aspect_h_floor = Some(transferred);
                    } else {
                        explicit_h = transferred;
                    }
                } else if explicit_h > 0.0 && explicit_w <= 0.0 {
                    explicit_w = explicit_h * ratio;
                }
            }
        }

        // 재계산마다 hoisted margin 리셋 (E3). solve_block 만 nonzero 로 채우고,
        // flex/grid/leaf 는 0 유지 — display 가 block→flex 로 바뀌어도 stale escaped 잔존 없음.
        if let Some(n) = self.get_mut(handle) {
            n.escaped_mt = block::MarginSet::ZERO;
            n.escaped_mb = block::MarginSet::ZERO;
            n.self_collapsing = false;
        }

        // leaf(=in-flow 자식 없음): 자기 크기만. absolute 자식만 있는 경우도 여기 해당 —
        //   컨테이너 크기는 absolute 자식에 영향받지 않으므로(out-of-flow) 그대로 확정한 뒤
        //   absolute 배치만 수행한다.
        if children.is_empty() {
            // ADR-165: 폭 intrinsic — width auto/센티넬을 공급 스칼라로 해석 (스칼라
            // 부재 시 explicit_w 그대로 = 기존 동작). 반환 w 는 부모 content 슬롯
            // (content_main/cross, content_w) 의 제안값이 된다.
            let w = self.resolve_leaf_intrinsic_width(handle, explicit_w, avail_w);
            let h = explicit_h;
            // ADR-923 Phase 2: leaf baseline = TS 측정 스칼라(`leafBaseline`, content-box
            // 상단 기준 첫 줄 baseline) + 자기 padding/border-top (border-box 좌표 승격).
            // 원천 없으면 센티널 — 경계/부모 intake 가 height(bottom) 로 폴백 (§10.8.1).
            let baseline = match self.get(handle).and_then(|n| n.style.leaf_baseline) {
                Some(lb) => {
                    let style = self.get(handle).map(|n| n.style.clone()).unwrap_or_default();
                    let ctx = self.ctx_for(avail_w);
                    pad_border_start(&style, &ctx, false) + lb.max(0.0)
                }
                None => BASELINE_NONE,
            };
            // §8.3.1 self-collapsing (leaf 판정 — r10h1/r10m1): block-level 여부는 부모 intake
            // 가 본다. 상하 pad/border 0 · height auto/0 · min-height 0 · BFC 아님 · **line box
            // 없음** = 텍스트 측정 스칼라(`leaf_baseline`) 부재 — 텍스트 leaf 는 height:0 이어도
            // line box 가 있어 margin 이 관통하지 않는다 (Chrome text-leaf-height-zero-has-line-
            // box b.y 60). absolute 자식만 있는 컨테이너도 이 경로다 (abs-only-height-zero b.y 40).
            let leaf_self_collapsing = {
                let lstyle = self.get(handle).map(|n| n.style.clone()).unwrap_or_default();
                let ctx = self.ctx_for(avail_w);
                let min_h = resolve_dimension_opt(lstyle.min_height.as_deref(), &self.ctx_for(avail_h))
                    .unwrap_or(0.0);
                !node_establishes_bfc(&lstyle)
                    && axis_pad_border(&lstyle, &ctx, false) == 0.0
                    && h <= 0.0
                    && min_h <= 0.0
                    && lstyle.leaf_baseline.is_none()
            };
            if let Some(n) = self.get_mut(handle) {
                n.layout = NodeLayout { x: 0.0, y: 0.0, width: w, height: h, baseline };
                n.self_collapsing = leaf_self_collapsing;
                n.dirty = false;
                n.subtree_dirty = false;
            }
            if !abs_children.is_empty() {
                self.place_absolute_children(handle, &abs_children, w, h, avail_w);
            }
            if let Some(n) = self.get_mut(handle) {
                n.last_solved = Some((w, h));
            }
            return (w, h);
        }

        // display 별 dispatch — 자식을 먼저 solve → flat f32 → 커널 → 위치 배치.
        let (cw, mut ch) = match display {
            ContainerDisplay::Flex => {
                self.solve_flex(handle, &children, explicit_w, explicit_h, avail_w, avail_h)
            }
            ContainerDisplay::Block => {
                self.solve_block(handle, &children, explicit_w, explicit_h, avail_w, avail_h)
            }
            ContainerDisplay::Grid => {
                self.solve_grid(handle, &children, explicit_w, explicit_h, avail_w, avail_h)
            }
        };

        // aspect w→h 전송의 content 하한 (§5.2.2 — 위 파생 블록 참조): used h =
        // max(전송값, content). dispatch 는 h=auto 로 돌아 ch = content extent 다.
        if let Some(t) = aspect_h_floor {
            if t > ch {
                ch = t;
                if let Some(n) = self.get_mut(handle) {
                    n.layout.height = ch;
                }
            }
        }

        // E10: position:relative 자식은 in-flow 배치 후 자기 box 만 inset 만큼 시각 이동.
        //   형제 위치·컨테이너 크기(cw/ch)에는 영향 없음(CSS §9.4.3 relative 계약) — 이미
        //   배치된 자식 layout 만 옮긴다. 자식 subtree 좌표는 부모 상대라 조상 누적
        //   (get_layouts_batch 소비처)이 함께 이동시킨다.
        self.apply_relative_offsets(&children, avail_w, ch);

        // out-of-flow 자식 배치 — 컨테이너 크기 확정 후 (containing block 이 필요).
        if !abs_children.is_empty() {
            self.place_absolute_children(handle, &abs_children, cw, ch, avail_w);
        }
        if let Some(n) = self.get_mut(handle) {
            n.last_solved = Some((cw, ch));
        }
        (cw, ch)
    }

    /// E10: `position:relative` 자식에 inset 시각 offset 적용.
    ///
    /// relative 는 in-flow 로 배치돼(형제·컨테이너 크기 불변) 자기 box 만 top/left/right/bottom
    /// 만큼 이동한다(CSS §9.4.3). solve_flex/block/grid 가 이미 배치한 자식 layout 을 옮기며,
    /// 자식 subtree 좌표는 부모 상대라 조상 누적(get_layouts_batch)이 함께 이동시킨다.
    ///
    /// left 우선(있으면 right 무시) / top 우선 — LTR 근사. % inset 은 containing block 크기
    /// 기준(라이브 편집 경로는 px 만 송신 — % offset 은 fixture 밖 근사).
    fn apply_relative_offsets(&mut self, flow_children: &[usize], avail_w: f32, container_h: f32) {
        for &c in flow_children {
            let Some(cn) = self.get(c) else { continue };
            if cn.style.position.as_deref() != Some("relative") {
                continue;
            }
            let cstyle = cn.style.clone();
            let ctx_x = self.ctx_for(avail_w);
            let ctx_y = self.ctx_for(container_h);
            let left = resolve_inset(cstyle.inset_left.as_deref(), &ctx_x);
            let right = resolve_inset(cstyle.inset_right.as_deref(), &ctx_x);
            let top = resolve_inset(cstyle.inset_top.as_deref(), &ctx_y);
            let bottom = resolve_inset(cstyle.inset_bottom.as_deref(), &ctx_y);
            let dx = match (left, right) {
                (Some(l), _) => l,
                (None, Some(r)) => -r,
                (None, None) => 0.0,
            };
            let dy = match (top, bottom) {
                (Some(t), _) => t,
                (None, Some(b)) => -b,
                (None, None) => 0.0,
            };
            if dx != 0.0 || dy != 0.0 {
                if let Some(n) = self.get_mut(c) {
                    n.layout.x += dx;
                    n.layout.y += dy;
                }
            }
        }
    }

    /// `position:absolute|fixed` 자식 배치 (CSS out-of-flow).
    ///
    /// **containing block**: 가장 가까운 positioned 조상의 **padding box**. 본 엔진은
    /// 조상 체인을 거슬러 올라가지 않고 **직계 부모를 containing block 으로 간주**한다
    /// (composition 의 실사용 패턴 — `position:relative` 부모 + absolute 자식이 전부).
    ///
    /// 좌표계: 형제 in-flow 자식과 동일하게 **부모 border-box 원점 기준 상대 좌표**를
    /// 기록한다(`solve_flex/block/grid` 의 `x + off_x` 와 같은 공간).
    ///
    /// 해석 규칙 (E11/ADR-156 P4.5 — `resolve_abs_axis`):
    /// - 양측 inset + 크기 auto → **stretch** / 양측 inset + definite + margin auto →
    ///   잉여 분배(센터링). 한쪽 inset → 그 기준 배치 (음수 inset·margin 허용).
    /// - 양측 auto → static 위치 유지. `width/height` auto → 자식 solve 결과(content).
    ///
    /// **의도적 미지원 (ADR-164 Phase 2 확정, 2026-07-25)** — Phase 0 실측
    /// (docs/adr/design/164-...-breakdown.md §7 0-3, 실사용 0건) 근거로 종결:
    /// - **containing block 조상 체인** (nearest positioned ancestor 탐색): 직계 부모
    ///   고정. factory absolute/fixed 기본값 0건 + Inspector position 편집 UI 미노출.
    ///   재개 조건 = positioned ancestor 2단 이상 실사용 등장.
    /// - **`fixed` 의 viewport 기준**: absolute 로 근사 — 상류 TS 도 fixed→absolute
    ///   로 강제 변환해 송신한다 (fullTreeLayout.ts patch 경로. 렌더 층의 sticky/fixed
    ///   좌표 보정은 별도 경로 — renderCommands.ts). 재개 조건 = 캔버스 viewport
    ///   (=page frame) 기준 fixed 실사용 등장.
    fn place_absolute_children(
        &mut self,
        handle: usize,
        abs_children: &[usize],
        container_w: f32,
        container_h: f32,
        avail_w: f32,
    ) {
        let style = self.get(handle).map(|n| n.style.clone()).unwrap_or_default();
        let parent_ctx = self.ctx_for(avail_w);

        // containing block = 부모 padding box.
        let pb_start_x = pad_border_start(&style, &parent_ctx, true);
        let pb_start_y = pad_border_start(&style, &parent_ctx, false);
        let pb_total_x = axis_pad_border(&style, &parent_ctx, true);
        let pb_total_y = axis_pad_border(&style, &parent_ctx, false);
        let cb_w = (container_w - pb_total_x).max(0.0);
        let cb_h = (container_h - pb_total_y).max(0.0);

        // static position (E11 ②) — inset 무지정 시 정상 흐름 위치를 유지한다.
        //   block 흐름 근사: static_y = 문서 순서상 선행 in-flow 형제들의 누적 하단,
        //   static_x = content 원점(pb_start_x). display:none/out-of-flow 는 흐름 비참여.
        let all_children = self
            .get(handle)
            .map(|n| n.children.clone())
            .unwrap_or_default();
        let mut static_pos: Vec<(usize, f32, f32)> = Vec::new();
        let mut flow_bottom = pb_start_y;
        for &ch in &all_children {
            let Some(cnode) = self.get(ch) else { continue };
            if cnode.style.display.as_deref() == Some("none") {
                continue;
            }
            if is_out_of_flow(cnode.style.position.as_deref()) {
                static_pos.push((ch, pb_start_x, flow_bottom));
            } else {
                let l = cnode.layout;
                flow_bottom = (l.y + l.height).max(flow_bottom);
            }
        }

        for &c in abs_children {
            // 자식 solve — available = containing block (%/auto 해석 기준).
            let (mut w, mut h) = self.solve_node(c, cb_w, cb_h);

            let cstyle = self.get(c).map(|n| n.style.clone()).unwrap_or_default();
            let child_is_container = self
                .get(c)
                .map(|node| !node.children.is_empty())
                .unwrap_or(false);
            // inset % 는 containing block 기준 (CSS) — 축별 ctx.
            let ctx_x = self.ctx_for(cb_w);
            let ctx_y = self.ctx_for(cb_h);

            // 명시 크기 유무 — auto 면 stretch(E11 ①) 대상. 명시 크기는 solve 반환 우선.
            let has_w = resolve_dimension_opt(cstyle.width.as_deref(), &ctx_x).is_some();
            let has_h = resolve_dimension_opt(cstyle.height.as_deref(), &ctx_y).is_some();
            let ew = resolve_dimension(cstyle.width.as_deref(), &ctx_x);
            let eh = resolve_dimension(cstyle.height.as_deref(), &ctx_y);
            if ew > 0.0 {
                w = ew;
            }
            if eh > 0.0 {
                h = eh;
            }

            // solve_* 는 auto 크기 컨테이너의 content-box를 부모 배치 커널에 반환한다.
            // 일반 flow에서는 그 커널이 padding/border를 더해 border-box를 기록하지만,
            // absolute 자식은 이 경로에서 직접 layout을 기록하므로 같은 변환이 필요하다.
            // leaf의 반환값은 이미 border-box일 수 있으므로 컨테이너에만 적용한다.
            if child_is_container && !has_w {
                w += axis_pad_border(&cstyle, &ctx_x, true);
            }
            if child_is_container && !has_h {
                h += axis_pad_border(&cstyle, &ctx_y, false);
            }

            let left = resolve_inset(cstyle.inset_left.as_deref(), &ctx_x);
            let right = resolve_inset(cstyle.inset_right.as_deref(), &ctx_x);
            let top = resolve_inset(cstyle.inset_top.as_deref(), &ctx_y);
            let bottom = resolve_inset(cstyle.inset_bottom.as_deref(), &ctx_y);

            // margin — auto 는 잉여 공간 흡수(E11 ③) 대상이라 별도 감지, 그 외 음수 허용
            // (translate(-50%) 에뮬레이션 채널).
            let ml_auto = cstyle.margin_left.as_deref() == Some("auto");
            let mr_auto = cstyle.margin_right.as_deref() == Some("auto");
            let mt_auto = cstyle.margin_top.as_deref() == Some("auto");
            let mb_auto = cstyle.margin_bottom.as_deref() == Some("auto");
            let ml = if ml_auto {
                0.0
            } else {
                resolve_signed(cstyle.margin_left.as_deref(), &ctx_x)
            };
            let mr = if mr_auto {
                0.0
            } else {
                resolve_signed(cstyle.margin_right.as_deref(), &ctx_x)
            };
            let mt = if mt_auto {
                0.0
            } else {
                resolve_signed(cstyle.margin_top.as_deref(), &ctx_y)
            };
            let mb = if mb_auto {
                0.0
            } else {
                resolve_signed(cstyle.margin_bottom.as_deref(), &ctx_y)
            };

            let (sx, sy) = static_pos
                .iter()
                .find(|&&(h, _, _)| h == c)
                .map(|&(_, x, y)| (x, y))
                .unwrap_or((pb_start_x, pb_start_y));

            // 축별 배치 — x/y 대칭 (stretch / margin auto / static 을 한 함수로).
            let (x, nw) = resolve_abs_axis(
                pb_start_x, cb_w, left, right, w, has_w, ml, mr, ml_auto, mr_auto, sx,
            );
            let (y, nh) = resolve_abs_axis(
                pb_start_y, cb_h, top, bottom, h, has_h, mt, mb, mt_auto, mb_auto, sy,
            );

            if let Some(n) = self.get_mut(c) {
                // out-of-flow: baseline 은 부모 전파에 참여하지 않지만 자식 자신의
                // 값(자기 solve 기록)은 보존한다 (ADR-923 Phase 2).
                let baseline = n.layout.baseline;
                n.layout = NodeLayout { x, y, width: nw, height: nh, baseline };
                n.dirty = false;
                n.subtree_dirty = false;
            }
        }
    }

    /// flex 컨테이너 solve — 자식 재귀 → `flex.rs` 배치 → 컨테이너 크기 도출.
    fn solve_flex(
        &mut self,
        handle: usize,
        children: &[usize],
        explicit_w: f32,
        explicit_h: f32,
        avail_w: f32,
        avail_h: f32,
    ) -> (f32, f32) {
        // 컨테이너 스타일에서 flex 파라미터 추출.
        let style = self.get(handle).map(|n| n.style.clone()).unwrap_or_default();
        let direction = parse_flex_direction(style.flex_direction.as_deref());
        let is_row = direction == flex::DIR_ROW;
        let justify = parse_justify_content(style.justify_content.as_deref());
        let align_items = parse_align_items(style.align_items.as_deref());
        let align_content = parse_align_content(style.align_content.as_deref());
        let wrap = parse_flex_wrap(style.flex_wrap.as_deref());

        let parent_ctx = self.ctx_for(avail_w);
        // 컨테이너 자신의 pad_border (% 는 부모 available 기준 — CSS containing block).
        let own_pb_h = axis_pad_border(&style, &parent_ctx, true);
        let own_pb_v = axis_pad_border(&style, &parent_ctx, false);
        let off_x = pad_border_start(&style, &parent_ctx, true);
        let off_y = pad_border_start(&style, &parent_ctx, false);

        // 자식 available = 컨테이너 content box. explicit(border-box) 이면 감산,
        // auto stretch 이면 상속 available(border-box) 에서 감산.
        // 음수 available 은 indefinite 센티넬 — 감산 없이 보존.
        let child_avail_w = if explicit_w > 0.0 {
            spec_to_content(explicit_w, own_pb_h)
        } else if avail_w >= 0.0 {
            (avail_w - own_pb_h).max(0.0)
        } else {
            avail_w
        };
        let child_avail_h = if explicit_h > 0.0 {
            spec_to_content(explicit_h, own_pb_v)
        } else if avail_h >= 0.0 {
            (avail_h - own_pb_v).max(0.0)
        } else {
            avail_h
        };
        // 자식이 percent **height** 를 해소하는 containing block 높이 — 컨테이너 height 가
        //   **명시 definite** 일 때만 실축, auto 면 INDEFINITE (CSS §10.5). `child_avail_h` 는
        //   부모가 내려준 available 이라 auto 여도 양수라, 자식 재귀 solve 에 그대로 내리면
        //   자식이 `height:50%` 를 **상속 available** 로 해소한다. `solve_block` 의 동명
        //   게이트와 같은 규칙이고 flex 에만 빠져 있었다 (2026-07-27).
        //   축 무관 — 블록 축에는 stretch 가 없어 row/column 어느 쪽 cross 든 동일하다.
        let child_containing_h = if explicit_h > 0.0 {
            child_avail_h
        } else {
            INDEFINITE_AVAIL
        };
        // 자식 write / gap 해석 ctx 는 content 폭 기준 (자식 % 의 containing block).
        let ctx = self.ctx_for(child_avail_w);
        let gap_row = resolve_gap(style.row_gap.as_deref(), &ctx);
        let gap_col = resolve_gap(style.column_gap.as_deref(), &ctx);
        // main/cross gap 매핑 (row → main=column_gap, cross=row_gap).
        let (gap_main, gap_cross) =
            if is_row { (gap_col, gap_row) } else { (gap_row, gap_col) };

        // **cross 축 `%` 기준 = 컨테이너 자신의 cross 가 definite 일 때만 available**.
        //
        // CSS §10.2: `%` 크기는 containing block 의 해당 축이 **content 에 의존(shrink-to-fit)**
        // 이면 `auto` 로 푼다 — 그 축 크기가 아직 자식으로부터 도출되는 중이라 참조할 확정값이 없다.
        //
        // definite 판정 2가지 (둘 중 하나면 definite):
        //   (a) 자신이 그 축에 **명시 크기** 보유 (`explicit_*`)
        //   (b) **부모가 그 축의 definite available 을 내려줌** (`avail_* >= 0`) — block 부모의
        //       block-level 자식은 부모 폭으로 **stretch** 되므로 width 가 확정이다. 반대로
        //       shrink-wrap 하는 부모(예: flex `align-items:flex-start` 의 cross)는 자식에게
        //       **INDEFINITE_AVAIL(음수)** 를 내려보내 "네 크기는 네 콘텐츠가 정한다" 를 알린다.
        //
        // **Why (DatePicker, 2026-07-14)**:
        //   - shrink-wrap 부모: `body(flex column, align-items:flex-start) > DatePicker(width 미지정)
        //     > SelectTrigger(width:100%)`. 자식의 100% 를 상속 available(350)로 풀면 trigger 가
        //     350 → shrink-to-fit 이어야 할 DatePicker 가 그걸 감싸며 350 으로 팽창(DOM 113.1).
        //   - stretch 부모: `body(block) > DatePicker(width 미지정) > SelectTrigger(width:100%)`.
        //     여기선 DatePicker 가 block-level 이라 **390 으로 stretch** → trigger 100% = 390 이
        //     정답이다(DOM 390). (a) 만 보면 이 케이스가 indefinite 로 오판돼 trigger 가 160 으로
        //     수축한다 — (b) 가 그 구분을 담당.
        //
        // main 축(`ctx`/`main_ctx`) 과 padding/margin/gap 은 **기존 그대로** available 기준 —
        //   available 자체를 죽이면 shrink-to-fit 의 상한과 main 축 배치가 무너진다
        //   (초기 시도에서 SelectValue width 0 회귀). 바뀌는 건 **cross 축 `%` 해석뿐**.
        //
        // **(b) 는 인라인 축 전용이다 (2026-07-27)**: 위 DatePicker 근거는 전부 **폭** 이야기다
        //   — block 레벨 stretch 는 인라인 축에만 적용된다. 블록 축에서 `height:auto` 는
        //   "내용 크기" 라, 부모가 definite available 을 내려줘도 **높이는 확정되지 않는다**
        //   (CSS §10.5: percentage height 는 containing block 높이가 definite 일 때만 해소).
        //   `solve_block` 의 `child_containing_h` 게이트(`explicit_h > 0.0`)와 같은 규칙이고,
        //   flex cross 축에만 빠져 있었다.
        //
        //   실측(2026-07-27 CSS 정합 sweep): `flex(row, width:300, height 미지정)` 안의
        //   `height:50%` 자식이 상속 available 600 의 절반인 **300** 으로 해소 (DOM 은 0 —
        //   `%` → auto → 내용 없음). 컨테이너도 그만큼 부풀었다.
        let cross_definite_self = if is_row {
            explicit_h > 0.0
        } else {
            explicit_w > 0.0 || avail_w >= 0.0
        };
        let cross_ctx = if cross_definite_self {
            self.ctx_for(if is_row { child_avail_h } else { child_avail_w })
        } else {
            self.ctx_for(INDEFINITE_AVAIL)
        };

        // 1) 자식 재귀 solve → 각 자식 content 크기 확보.
        //
        // **cross 를 stretch 하지 않는 컨테이너는 auto-cross 자식에게 indefinite cross
        //   available 을 내린다.** `align-items` 가 stretch(기본값)면 auto-cross 자식은 컨테이너
        //   cross 로 늘어나므로 containing block 이 확정이다. flex-start/center/end 면 그 자식은
        //   **shrink-to-fit** — 자기 콘텐츠가 크기를 정하므로, 그 자식이 **컨테이너**일 때 그
        //   안쪽 `%` cross 가 참조할 확정 basis 가 없다(CSS §10.2 → `%` → auto). 이 신호가 자식의
        //   `cross_definite_self` 규칙 (b)(`avail_* >= 0`) 로 전달된다.
        //
        //   **단, cross 를 명시한 자식은 예외 (2026-07-14)**: `align-items` 는 *auto-cross 자식을
        //   늘릴지*만 정할 뿐, **cross 를 명시한 자식에는 아무 영향이 없다**. 그런 자식의 cross 는
        //   `align-items` 와 무관하게 **확정**이다. 이 예외가 없으면 `align-items:flex-start` 인
        //   컨테이너 밑에서 `width:100%` 로 폭이 확정된 자식(SelectTrigger)까지 indefinite 를 받아
        //   → 그 자식의 main(row=width) 이 indefinite → **flex grow 분배가 통째로 skip**
        //   (flex.rs Step 0 early return) → `flex:1`(basis 0%) 인 DateInput 이 **폭 0 으로 붕괴**
        //   했다 (DOM 은 grow 로 308). 반대로 예외를 자식별이 아니라 컨테이너 전체로 넓히면
        //   (cross_definite_self 로 판정) width 미지정 DatePicker 가 shrink-to-fit 을 잃고
        //   available(350)로 팽창한다 — 그래서 **자식별 판정**이어야 한다.
        //
        //   **주의 — 축을 정확히**: row 컨테이너의 cross 는 **height**, column 은 **width**.
        //   초기 시도가 이걸 `%` 해석 컨텍스트와 뒤섞어(`align-items:center` row trigger 가
        //   자식에게 indefinite height 를 내려 SelectValue 가 0) 회귀를 냈다. 여기서 내리는 건
        //   **available 뿐**이고, `%` 해석은 위 `cross_ctx` 가 별도로 담당한다.
        let stretches_children_cross = align_items == 0;
        let child_cross_solve = |c: usize| -> (f32, f32) {
            if stretches_children_cross {
                return (child_avail_w, child_containing_h);
            }
            // 자식이 cross 를 **명시**했으면 align-items 와 무관하게 확정 → available 유지.
            let cross_raw = self.get(c).and_then(|n| {
                if is_row {
                    n.style.height.clone()
                } else {
                    n.style.width.clone()
                }
            });
            let child_cross_explicit = cross_raw
                .as_deref()
                .map(|v| {
                    let t = v.trim();
                    !t.is_empty() && !t.eq_ignore_ascii_case("auto") && t != "fit-content"
                })
                .unwrap_or(false);
            if child_cross_explicit {
                (child_avail_w, child_containing_h)
            } else if is_row {
                (child_avail_w, INDEFINITE_AVAIL) // row → cross = height
            } else {
                (INDEFINITE_AVAIL, child_containing_h) // column → cross = width
            }
        };
        let child_solves: Vec<(f32, f32)> = children.iter().map(|&c| child_cross_solve(c)).collect();
        let mut child_sizes: Vec<(f32, f32)> = Vec::with_capacity(children.len());
        let wraps = matches!(style.flex_wrap.as_deref(), Some("wrap") | Some("wrap-reverse"));

        // **step 1 중복 제거** (ADR-169 Phase 4 / G4). 아래 2-b 가 intrinsic 으로 덮어쓸
        // item 은 여기서 available 로 푸는 solve 의 **주축 결과가 버려진다**. 그런데도 풀면
        // 3.5 가 used size 로 한 번 더 풀어 레벨당 solve 가 2회 — 중첩 깊이에 2^d 다
        // (실측: depth 12 가 47 µs → 36.5 ms). 그 item 은 여기서 건너뛰고 3.5 의 단일
        // solve 에 맡긴다. 판정식은 2-b 와 동일해야 한다 — `data[off+1] == AUTO` 는
        // `resolve_dimension_opt(main_raw, main_ctx).is_none()` 과 같고, row 에서
        // `main_ctx == ctx` 다 (아래 main_ctx 정의).
        let mut deferred_to_resolve = vec![false; children.len()];
        for (i, &c) in children.iter().enumerate() {
            if !is_row || wraps {
                break; // column 은 2-b 대상이 아니고, wrap 은 라인 분할이 cross 에 걸린다
            }
            let Some(n) = self.get(c) else { continue };
            if n.children.is_empty() || n.style.content_min_width.is_some() {
                continue;
            }
            if resolve_dimension_opt(n.style.width.as_deref(), &ctx).is_some() {
                continue; // main 명시 — content 슬롯 미소비
            }
            deferred_to_resolve[i] = true;
        }

        for (i, &c) in children.iter().enumerate() {
            if deferred_to_resolve[i] {
                // 주축은 2-b 가, cross 는 3.5 가 채운다 (3.5 는 아래에서 강제 적용).
                child_sizes.push((0.0, 0.0));
                continue;
            }
            let (sw, sh) = child_solves[i];
            // wrap 컨테이너는 라인 분할이 cross 에 걸려 cross 를 0 으로 둘 수 없다 —
            // 그 경우만 기존 재귀 solve 를 유지한다.
            let cs = if wraps {
                self.solve_node(c, sw, sh)
            } else {
                self.solve_child_intrinsic_aware(c, sw, sh)
            };
            child_sizes.push(cs);
        }

        // 2) 자식 → flex flat f32 (논리축 main/cross 변환).
        //    flex-basis / height 의 `%` 는 **main 축** 컨테이너 크기 기준 (column 이면 height).
        //    그 외 자식 % (width/padding 등) 는 inline 축(=width) 기준 → ctx 유지.
        //
        //    **column main 은 컨테이너 height 가 명시 definite 일 때만 실축** (E6/CSS §10.5):
        //    auto 높이 컨테이너의 percent 자식(height/basis %)은 참조할 확정 높이가 없어 auto 로
        //    푼다. child_avail_h 는 부모가 내려준 available 이라 auto 여도 양수일 수 있으므로
        //    (그대로 쓰면 percent 가 상속 available 기준으로 잘못 해소), explicit_h 게이트로
        //    indefinite 를 명시한다. row 는 main=width 라 ctx(폭) 그대로.
        let main_ctx = if is_row {
            ctx.clone()
        } else {
            self.ctx_for(if explicit_h > 0.0 { child_avail_h } else { INDEFINITE_AVAIL })
        };
        let mut data = vec![0.0f32; children.len() * flex::FLEX_FIELD_COUNT];
        for (i, &c) in children.iter().enumerate() {
            let cstyle = self.get(c).map(|n| n.style.clone()).unwrap_or_default();
            let (cw, ch) = child_sizes[i];
            write_flex_item(
                &mut data,
                i,
                &cstyle,
                cw,
                ch,
                is_row,
                &ctx,
                &main_ctx,
                &cross_ctx,
                MarginAxisReverse {
                    main: flex_direction_is_reverse(style.flex_direction.as_deref()),
                    cross: flex_wrap_is_reverse(style.flex_wrap.as_deref()),
                },
            );
        }

        // 2-b) **컨테이너 item 의 intrinsic 을 실측으로 교체** (ADR-169 Phase 2).
        //
        // 위 루프까지의 `content_main` 은 1) 단계가 **컨테이너 available 로 solve** 한
        // 결과다. 스스로 폭을 갖지 않고 늘어나기만 하는 내용(auto 폭 블록, `width:100%`)
        // 은 그 값이 곧 available 이라, 상한 근사가 base size 와 §4.5 floor 양쪽에
        // 들어간다. 여기서 두 채널을 **함께** 정확한 값으로 덮는다 — 한쪽만 고치면
        // floor 가 같이 커져 긴 텍스트 초과가 악화된다(G3, 부분 반영 금지).
        //
        // 적용 범위:
        // - `is_row` 한정. 측정 스칼라는 폭 축이고 column main(=height)은 height-for-width
        //   재줄바꿈이 얽힌 별도 축이다 (R6 — Phase 3 판정).
        // - **자식을 가진 item** 만. leaf 는 ADR-165 스칼라로 이미 정확하고, 그 채널을
        //   덮으면 폰트 측정 결과를 구조 집계로 갈아치우게 된다.
        // - main 이 `auto` 인 item 만. 명시 폭 item 은 `content_main` 을 소비하지 않는다.
        if is_row {
            for (i, &c) in children.iter().enumerate() {
                let off = i * flex::FLEX_FIELD_COUNT;
                if data[off + 1] != -1.0 {
                    continue; // main 명시 — content 슬롯 미소비
                }
                let is_container_item = self
                    .get(c)
                    .map(|n| !n.children.is_empty() && n.style.content_min_width.is_none())
                    .unwrap_or(false);
                if !is_container_item {
                    continue;
                }
                // grid 서브트리는 `None` — 측정 채널을 열지 않고 ADR-169 이전 경로를
                // 그대로 둔다 (Phase 3 / G5). 0 으로 붕괴시키는 것보다 낫다.
                let Some((min_w, max_w)) = self.measure_intrinsic_width(c) else {
                    continue;
                };
                data[off + 13] = max_w; // flex base size = max-content
                if min_w > 0.0 {
                    data[off + 19] = min_w; // §4.5 floor = 정확 min-content
                } else if data[off + 9] == -1.0 {
                    // min-content 가 **0** 인 경우. off 19 는 `0.0 = absent` 계약이라
                    // 그대로 쓰면 `content_main` fallback 으로 되돌아간다(= 상한이 하한).
                    // 사용자가 min 을 명시하지 않았을 때만, 같은 뜻을 **명시 min 0** 으로
                    // 적어 그 모호성을 피한다 — §4.5 의 조건을 tree.rs 가 재구현하지
                    // 않으면서 결과는 동일하다 (floor 0).
                    data[off + 9] = 0.0;
                }
            }
        }

        // 3) main/cross available.
        //
        // column main(=height)은 컨테이너 자신의 height 가 explicit 일 때만 definite.
        // height:auto 는 부모가 definite available 을 내려줘도 indefinite 다 —
        // 블록 레벨 stretch 는 인라인축(width)에만 적용되고, flex free space 는
        // definite main 에서만 산출된다(CSS §9.7). 상속 avail_h 를 그대로 main 으로
        // 넘기면 flexGrow 자식이 페이지 높이로 grow 한다(tree_golden N7, live Tabs
        // 844/1024 발산). row main(=width)은 auto 여도 블록 레벨 stretch 로 definite
        // → 상속 available 유지.
        let (mut avail_main, avail_cross) = if is_row {
            (child_avail_w, child_avail_h)
        } else {
            let main_h = if explicit_h > 0.0 { child_avail_h } else { -1.0 };
            (main_h, child_avail_w)
        };

        // cross definite 판정 = `cross_definite_self` 와 동일 (ADR-170 군집 E).
        // column 의 cross(=width)는 명시가 없어도 **block-level stretch 로 확정**된다
        // (`avail_w >= 0` — §백분율 크기의 (b) 인라인 축 규칙). 종전엔 explicit 만 봐서
        // 정합 available 을 받은 auto 폭 컨테이너의 라인 cross 가 content 로 떨어졌고,
        // §9.4 step 11 stretch 가 auto-cross 스칼라 leaf 를 라인(=content 90)까지만
        // 늘렸다 (실측 dom 300 / eng 90). row 의 cross(=height)는 블록 축이라 명시만 확정.
        let mut cross_definite = cross_definite_self;
        let mut avail_cross = avail_cross;

        // ADR-183 #3 — §4.5 floor. `data` 가 2-b 의 실측 교체까지 끝난 **이 지점**이
        // 커널이 실제로 보는 입력이다. 그 앞에서 읽으면 상한 근사가 찍혀 판독이 틀린다.
        // 조건 판정은 커널과 같은 `flex::resolve_auto_min_main` 이 소유한다 (§4-4a).
        if self.trace.is_some() {
            for i in 0..children.len() {
                if let (floor, Some(source)) = flex::resolve_auto_min_main(&data, i) {
                    self.trace_push(handle, || TraceEvent::AutoMinFloor { item: i, source, floor });
                }
            }
        }

        let mut out = flex::flex_layout(
            &data,
            avail_main,
            avail_cross,
            direction,
            justify,
            align_items,
            align_content,
            wrap,
            gap_main,
            gap_cross,
            cross_definite,
        );

        // 3.5) **flex item 재-solve** — used main size 로 자식 내용 재배치 (CSS §9.9).
        //
        // 자식 subtree 는 3-1) 에서 **분배 전 available**(child_avail_w/h) 로 solve 됐다.
        // grow/shrink 로 자식의 최종(used) main 크기가 그와 달라지면, 자식 내부의 wrap /
        // `%` / auto height 는 **틀린 폭 기준**으로 굳는다 — CSS 는 used size 로 내용을
        // 다시 배치한다.
        //
        // **Why (TagGroup labelPosition="side", 2026-07-14)**: TagList(flex:1) 가 분배 전
        //   폭 350 으로 solve 되어 칩이 350 기준 1줄로 wrap → 분배 후 실제 폭은 278 인데
        //   칩 배치는 350 기준 그대로 → **칩이 한 줄로 나열되며 TagGroup 영역을 벗어남**
        //   (DOM 은 278 에서 2줄). 재-solve 로 content_main/cross 를 갱신 후 flex 재배치.
        //
        // 대상: (a) 컨테이너(자식 보유) — leaf 는 내용 재배치가 없어 무의미.
        //       (b) main 축 explicit 없음 — 명시 크기면 내용도 그 크기 기준으로 이미 정확.
        //       (c) used main 이 solve available 과 유의미하게 다름.
        // 재-solve 는 **1회만** (수렴 가정 — 재배치가 다시 폭을 바꾸지는 않는다).
        {
            const RESOLVE_EPS: f32 = 0.5;
            let mut changed = false;
            for (i, &c) in children.iter().enumerate() {
                let off = i * 4;
                let (used_w, used_h) = (out[off + 2], out[off + 3]);
                let used_main = if is_row { used_w } else { used_h };

                let Some(cn) = self.get(c) else { continue };
                if cn.children.is_empty() {
                    continue; // leaf — 재배치할 내용 없음
                }
                let cstyle = cn.style.clone();

                // 자식이 **실제로 내용을 배치할 때 쓴 main 크기**:
                //   main explicit → 그 값(border-box) / auto → 상속 available.
                // `used_main`(flex 분배 결과, border-box) 이 이와 다르면 내용이 틀린 폭
                //   기준으로 굳은 것 — explicit 이어도 shrink 로 줄어들 수 있다.
                let main_raw = if is_row {
                    cstyle.width.as_deref()
                } else {
                    cstyle.height.as_deref()
                };
                // main 축 `%` 는 main_ctx (E6) — column 이면 height 기준.
                //
                // auto-main fallback 은 **자식이 실제로 solve 된 main available** 이다
                // (ADR-170 군집 C). 그 available 이 indefinite 였으면 자식은 content
                // 크기로 배치된 것 — 기준을 `child_avail_h`(음수 센티넬) 로 잡으면
                // used(=content) 와 항상 달라 불필요한 재-solve 가 발생하고, 그 재-solve
                // 가 used_main 을 **상속 available 로** 내려 자식의 `%` main 이 컨테이너
                // content 크기에 풀린다 (CSS §10.5 위반 — 실측 `column height:auto` 안
                // `h=50%` 상자가 content 50 의 절반 25 로 붕괴, 내부까지 25 기준 재배치).
                let laid_out_main =
                    resolve_dimension_opt(main_raw, &main_ctx).unwrap_or_else(|| {
                        let (cs_w, cs_h) = child_solves[i];
                        let solved_avail = if is_row { cs_w } else { cs_h };
                        if solved_avail >= 0.0 {
                            solved_avail
                        } else if is_row {
                            child_sizes[i].0
                        } else {
                            child_sizes[i].1
                        }
                    });
                // step 1 을 건너뛴 item 은 **아직 한 번도 배치되지 않았다** — 비교 없이
                // 무조건 여기서 푼다 (이게 그 item 의 유일한 실 solve 다).
                if !deferred_to_resolve[i] && (used_main - laid_out_main).abs() <= RESOLVE_EPS {
                    continue; // 분배로 안 바뀜 — 재배치 불필요
                }

                // ADR-183 #6 — 3.5 재-solve 발생. 이 재-solve 는 `used_main` 을 상속
                // available 로 내려주므로, 자식의 미해소 `%` 가 여기서 다시 풀린다
                // (§flex item 재-solve — `%` 의 세 번째 누수 경로). 백분율 발산을 볼 때
                // 게이트가 아니라 이 줄이 원인인지 먼저 갈라야 한다.
                if self.trace.is_some() {
                    self.trace_push(handle, || TraceEvent::FlexItemResolve {
                        item: i,
                        used_main,
                        prev_avail: laid_out_main,
                    });
                }

                // used main 으로 재-solve → 새 content 크기.
                //   1차 solve 가 subtree 를 clean 으로 만들었으므로(`solve_*` 말미의
                //   `dirty=false`), 그대로 부르면 증분 skip 이 **stale 캐시**를 돌려준다.
                //   재-solve 전에 subtree 를 dirty 로 되돌린다.
                //
                //   explicit main 자식은 `solve_node` 가 자기 스타일의 명시값을 우선하므로
                //   available 만 바꿔선 안 된다 — 명시 main 을 **used 값으로 덮어써** 재-solve
                //   한 뒤 원복한다(스타일 원본 보존).
                //
                //   override 대상은 auto 가 아닌 **모든** main 스타일이다 (ADR-170 군집 C
                //   잔여). "해소된 값" 만 대상이면 main_ctx 에서 못 푼 `%` 가 남고, 그
                //   `%` 는 재-solve 의 상속 available(=used_main) 에 다시 풀린다 — 실측
                //   `h=50%+maxH40`: 컨테이너가 clamp 한 used 40 에 50% 가 풀려 20 으로
                //   붕괴 (CSS 는 % → auto → content 50 → clamp 40).
                let overridden = main_raw
                    .map(|v| {
                        let t = v.trim();
                        !t.is_empty() && !t.eq_ignore_ascii_case("auto")
                    })
                    .unwrap_or(false);
                let saved_main = if is_row {
                    cstyle.width.clone()
                } else {
                    cstyle.height.clone()
                };
                if overridden {
                    if let Some(n) = self.get_mut(c) {
                        let v = Some(format!("{}px", used_main));
                        if is_row {
                            n.style.width = v;
                        } else {
                            n.style.height = v;
                        }
                    }
                }

                self.mark_subtree_dirty(c);
                // cross available 은 1차 solve 와 동일 규칙 (자식별 — 위 child_solve_cross).
                let (cs_w, cs_h) = child_solves[i];
                let (re_w, re_h) = if is_row {
                    self.solve_node(c, used_main, cs_h)
                } else {
                    self.solve_node(c, cs_w, used_main)
                };

                if overridden {
                    if let Some(n) = self.get_mut(c) {
                        if is_row {
                            n.style.width = saved_main;
                        } else {
                            n.style.height = saved_main;
                        }
                    }
                }

                // flex 입력의 content 슬롯 갱신 (13=content_main, 14=content_cross).
                let d_off = i * flex::FLEX_FIELD_COUNT;
                let (new_cm, new_cc) = if is_row { (re_w, re_h) } else { (re_h, re_w) };
                data[d_off + 13] = new_cm;
                data[d_off + 14] = new_cc;
                changed = true;
            }

            if changed {
                out = flex::flex_layout(
                    &data,
                    avail_main,
                    avail_cross,
                    direction,
                    justify,
                    align_items,
                    align_content,
                    wrap,
                    gap_main,
                    gap_cross,
                    cross_definite,
                );
            }
        }

        // 3.6) **컨테이너 main 을 자기 min/max 로 clamp 한 뒤 재분배** (CSS-FLEXBOX-1 §9.4→§9.7).
        //
        // 컨테이너의 **used** main size = (명시 크기 또는 내용 크기) 를 자기 min/max 로 clamp 한
        // 값이고, flexible length 는 **그 used 값**에 대해 풀린다. 엔진은 clamp 를 배치 **뒤에만**
        // 걸고 있었다 — root 는 `fixup_root_self_size`, flex item 은 `flex.rs` off 10·12, grid
        // 트랙은 `track_contribution`. 셋 다 "이미 배치된 결과의 상자만" 늘리고 줄이므로, 안쪽
        // 분배는 clamp 이전 값 기준으로 굳는다.
        //
        // 실측(2026-07-28, Chrome 대조):
        // - `column + minHeight:400` 안의 `flexGrow:1` 자식 → DOM **340** / 구 엔진 **0**
        //   (미결정 main 은 여유가 없어 grow 가 no-op → 컨테이너만 min 으로 부풀었다)
        // - `column + maxHeight:200` 안의 `height:100px` 자식 3개 → DOM **67**씩 / 구 엔진 100씩
        //   (used main 200 에 대한 음수 여유 → shrink 가 돌아야 한다)
        //
        // **auto-main item 은 이 재분배로 찌그러지지 않는다** — §4.5 automatic minimum size 가
        // min-content floor 를 걸기 때문이다. ListBox 형태(`maxHeight:300` + auto 높이 행)는
        // clamp 후에도 행이 100 을 유지하고 넘쳐 스크롤한다(실측 DOM·엔진 동형). 압축되는 것은
        // 위 두 번째 줄처럼 **주축 크기를 명시한** item 뿐이며, 그게 CSS 결과다.
        // main 축이 auto 일 때의 used main size — 아래 4) 컨테이너 크기가 이 값을 쓴다.
        // (main 이 명시면 그 값이 used 라 여기서 건드리지 않는다.)
        let mut clamped_auto_main: Option<f32> = None;
        if !children.is_empty() {
            let ctx_main = self.ctx_for(if is_row { avail_w } else { avail_h });
            let (min_raw, max_raw) = if is_row {
                (style.min_width.as_deref(), style.max_width.as_deref())
            } else {
                (style.min_height.as_deref(), style.max_height.as_deref())
            };
            let min_main = resolve_dimension_opt(min_raw, &ctx_main);
            let max_main = resolve_dimension_opt(max_raw, &ctx_main);
            if min_main.is_some() || max_main.is_some() {
                let own_pb_main = if is_row { own_pb_h } else { own_pb_v };
                // 기준값: main 이 확정이면 그 값, 미결정이면 방금 배치한 내용 extent.
                let base_main = if avail_main >= 0.0 {
                    avail_main
                } else {
                    let mut extent: f32 = 0.0;
                    for i in 0..children.len() {
                        let off = i * 4;
                        let e = if is_row {
                            out[off] + out[off + 2]
                        } else {
                            out[off + 1] + out[off + 3]
                        };
                        extent = extent.max(e);
                    }
                    extent
                };
                let mut used = base_main;
                if let Some(mn) = min_main {
                    used = used.max(spec_to_content(mn, own_pb_main));
                }
                if let Some(mx) = max_main {
                    used = used.min(spec_to_content(mx, own_pb_main));
                }
                let used = used.max(0.0);
                let main_is_auto = if is_row { explicit_w <= 0.0 } else { explicit_h <= 0.0 };
                if main_is_auto {
                    clamped_auto_main = Some(used);
                }
                if (used - base_main).abs() > 0.5 {
                    avail_main = used;
                    out = flex::flex_layout(
                        &data,
                        avail_main,
                        avail_cross,
                        direction,
                        justify,
                        align_items,
                        align_content,
                        wrap,
                        gap_main,
                        gap_cross,
                        cross_definite,
                    );
                }
            }
        }

        // 3.7) **교차축도 같다** — min/max clamp 가 cross 를 확정으로 만든다 (§9.4 step 8).
        //
        // 라인의 outer cross size 는 컨테이너의 inner cross size **그 자체**이고(step 8),
        // `align-items:stretch` 는 그 라인을 채운다. 그런데 "컨테이너 cross 가 확정인가" 를
        // `explicit_*` 만으로 판정하면 `min-height` 로 확정된 컨테이너가 미확정으로 남아,
        // 자식이 **내용 크기(0)** 로 접힌다.
        //
        // 실측(2026-07-28): `row + minHeight:400` 안의 높이 미지정 자식이 Chrome 400 / 구
        // 엔진 **0**. 프레임 row 페이지의 슬롯이 정확히 이 형태다.
        //
        // **`height:%` 자식은 여기서 살아나지 않는다** — 해소 불가 백분율은 Chrome 도 0 이고
        // (실측), 그건 `%` 해석 컨텍스트(`cross_ctx`) 소관이라 건드리지 않는다. 여기서 바뀌는
        // 것은 **cross 를 명시하지 않은** 자식의 stretch 대상 크기뿐이다.
        if !cross_definite && !children.is_empty() {
            let ctx_cross_size = self.ctx_for(if is_row { avail_h } else { avail_w });
            let (min_raw, max_raw) = if is_row {
                (style.min_height.as_deref(), style.max_height.as_deref())
            } else {
                (style.min_width.as_deref(), style.max_width.as_deref())
            };
            let min_cross = resolve_dimension_opt(min_raw, &ctx_cross_size);
            let max_cross = resolve_dimension_opt(max_raw, &ctx_cross_size);
            if min_cross.is_some() || max_cross.is_some() {
                let own_pb_cross = if is_row { own_pb_v } else { own_pb_h };
                let mut content_cross: f32 = 0.0;
                for i in 0..children.len() {
                    let off = i * 4;
                    let e = if is_row {
                        out[off + 1] + out[off + 3]
                    } else {
                        out[off] + out[off + 2]
                    };
                    content_cross = content_cross.max(e);
                }
                let mut used = content_cross;
                if let Some(mn) = min_cross {
                    used = used.max(spec_to_content(mn, own_pb_cross));
                }
                if let Some(mx) = max_cross {
                    used = used.min(spec_to_content(mx, own_pb_cross));
                }
                let used = used.max(0.0);
                if (used - content_cross).abs() > 0.5 {
                    avail_cross = used;
                    cross_definite = true;
                    out = flex::flex_layout(
                        &data,
                        avail_main,
                        avail_cross,
                        direction,
                        justify,
                        align_items,
                        align_content,
                        wrap,
                        gap_main,
                        gap_cross,
                        cross_definite,
                    );
                }
            }
        }

        // 3.8) ~~main 축 margin:auto 후처리~~ — **flex 커널로 이관** (2026-07-27).
        //   구 구현은 tree.rs 가 flex_layout 출력 좌표를 통째로 다시 깔던 **단일 라인
        //   근사**라, wrap 컨테이너에서는 흡수 자체가 일어나지 않았다(실측: 250 폭 2줄
        //   에서 `marginLeft:auto` 아이템 x = 100, CSS 는 150). 흡수는 라인의 여유를
        //   알아야 하므로 라인을 소유한 `flex.rs::place_line_main_axis` 가 제자리다.
        //   cross 축 auto margin(§9.6 step 13/14)도 같은 이유로 커널이 소유한다 —
        //   두 축을 다른 층에 두면 정렬 무효화 규칙이 한쪽에만 걸린다.
        //   ⚠️ 여기에 auto margin 후처리를 재도입하지 말 것 (커널 흡수와 이중 적용).

        // 3.9) **reverse 반사** (E8/ADR-156 P4). row/column-reverse 는 main 축, wrap-reverse
        //   는 cross 축을 반사한다. CSS 의 reverse 는 해당 축의 start/end 를 뒤집는 것이라
        //   **정방향 배치의 순수 기하 반사**로 정확히 재현된다 (justify/gap/free-space/align
        //   전부 최종 좌표에 이미 녹아 있어 반사가 일괄 처리). flex.rs 커널·golden 계약을
        //   건드리지 않아 R2(flex 계약 파손) 회피.
        //
        //   반사 정의역: 물리축이 definite 컨테이너 크기를 가지면 그 크기, auto(indefinite)면
        //   정방향 content extent(= 배치 최댓값) — auto 축은 컨테이너가 content 로 축소되므로
        //   content extent 반사 = 순수 순서 반전(bbox 보존).
        let main_reverse = flex_direction_is_reverse(style.flex_direction.as_deref());
        let cross_reverse = flex_wrap_is_reverse(style.flex_wrap.as_deref());
        if main_reverse || cross_reverse {
            // 물리축 매핑: row → main=x/cross=y, column → main=y/cross=x.
            let reflect_x = if is_row { main_reverse } else { cross_reverse };
            let reflect_y = if is_row { cross_reverse } else { main_reverse };
            // 각 물리축의 definite 크기 (없으면 None → content extent 사용).
            let (x_size, y_size) = if is_row {
                (
                    if avail_main >= 0.0 { Some(avail_main) } else { None },
                    if cross_definite { Some(avail_cross) } else { None },
                )
            } else {
                (
                    if cross_definite { Some(avail_cross) } else { None },
                    if avail_main >= 0.0 { Some(avail_main) } else { None },
                )
            };
            let mut cmax_x: f32 = 0.0;
            let mut cmax_y: f32 = 0.0;
            for i in 0..children.len() {
                let off = i * 4;
                cmax_x = cmax_x.max(out[off] + out[off + 2]);
                cmax_y = cmax_y.max(out[off + 1] + out[off + 3]);
            }
            let ext_x = x_size.unwrap_or(cmax_x);
            let ext_y = y_size.unwrap_or(cmax_y);
            for i in 0..children.len() {
                let off = i * 4;
                if reflect_x {
                    out[off] = ext_x - out[off] - out[off + 2];
                }
                if reflect_y {
                    out[off + 1] = ext_y - out[off + 1] - out[off + 3];
                }
            }
        }

        // 4) 자식 위치 반영 + bounding box 로 컨테이너 content 크기 도출.
        //    bounding box 는 offset 전 좌표 기준(컨테이너 content 크기), 저장은 offset 후
        //    (자식 화면 좌표는 padding 안쪽) — 섞으면 컨테이너 크기에 padding 이중 반영.
        let mut max_right: f32 = 0.0;
        let mut max_bottom: f32 = 0.0;
        // ADR-923 Phase 3: wrap row 컨테이너의 min-content 측정용 — 최대 item outer 기여
        // (css-flexbox-1 §9.9: wrap 의 min-content main 은 합산이 아니라 최대 item).
        let min_wrap_measure =
            is_row && wraps && matches!(intrinsic_mode(avail_w), Some(IntrinsicMode::Min));
        let mut max_item_outer: f32 = 0.0;
        // ADR-923 Phase 2: flex 컨테이너 baseline = 첫 in-flow item 의 baseline
        // (Flexbox §8.5 — baseline 참여 판정(align-self:baseline 그룹)은 S8 미구현이라
        // 첫 원천 보유 item 근사. 원천 없는 item 은 건너뛴다 — bottom 폴백을 전파하면
        // 컨테이너 자신의 bottom 폴백과 달라져 §10.8.1 을 위반한다).
        let mut first_item_baseline: f32 = BASELINE_NONE;
        for (i, &c) in children.iter().enumerate() {
            let off = i * 4;
            let (x, y, w, h) = (out[off], out[off + 1], out[off + 2], out[off + 3]);
            max_right = max_right.max(x + w);
            max_bottom = max_bottom.max(y + h);
            if min_wrap_measure {
                let cst = self.get(c).map(|n| n.style.clone()).unwrap_or_default();
                let outer = w
                    + resolve_dimension(cst.margin_left.as_deref(), &parent_ctx)
                    + resolve_dimension(cst.margin_right.as_deref(), &parent_ctx);
                max_item_outer = max_item_outer.max(outer);
            }
            if let Some(n) = self.get_mut(c) {
                let child_baseline = n.layout.baseline;
                n.layout =
                    NodeLayout { x: x + off_x, y: y + off_y, width: w, height: h, baseline: child_baseline };
                if first_item_baseline < 0.0 && child_baseline >= 0.0 {
                    first_item_baseline = y + off_y + child_baseline;
                }
            }
        }

        // 컨테이너 크기: 명시 있으면 명시, 없으면 자식 bounding box.
        //   단 main 축은 3.6 이 min/max clamp 한 **used main size** 가 있으면 그 값 — 분배를
        //   그 크기에 대해 돌렸으므로 상자도 같은 값이어야 한다(`minHeight` 로 커진 컨테이너의
        //   내용이 60 이어도 상자는 400).
        let auto_main_w = if is_row { clamped_auto_main } else { None };
        let auto_main_h = if is_row { None } else { clamped_auto_main };
        let container_w = if explicit_w > 0.0 {
            explicit_w
        } else if min_wrap_measure {
            // 측정 pass 는 센티널 available 로 단일 라인 배치라 max_right 가 합산이 된다
            // — Min 모드의 wrap 컨테이너만 최대 item outer 로 대체 (§9.9. 실측:
            // 80×2 wrap 의 min-content 는 160 이 아니라 80 — adr923_p3_inline_shrink_to_fit).
            max_item_outer
        } else {
            auto_main_w.unwrap_or(max_right)
        };
        let container_h = if explicit_h > 0.0 {
            explicit_h
        } else {
            auto_main_h.unwrap_or(max_bottom)
        };

        // 5) **shrink-to-fit 확정 뒤 재-solve** (block 과 동일 규칙 — `shrink_to_fit_settled`).
        //   row 는 확정 main 이 생겨 grow/shrink 가 비로소 돌고(§4.5 floor 가 과압축을 막는다),
        //   column 은 cross 가 확정이라 자식 `%` 폭이 해소된다. 실측(2026-07-28): `align-items`
        //   non-stretch 아래 `width:50%` 자식이 Chrome 60 / 구 엔진 120.
        let inline_shrink_to_fit =
            explicit_w <= 0.0 && avail_w == INDEFINITE_AVAIL && !children.is_empty();
        if let Some(settled) = shrink_to_fit_settled(
            inline_shrink_to_fit,
            container_w,
            own_pb_h,
            resolve_dimension_opt(style.min_width.as_deref(), &parent_ctx),
            resolve_dimension_opt(style.max_width.as_deref(), &parent_ctx),
        ) {
            for &c in children {
                self.mark_subtree_dirty(c);
            }
            // ADR-183 #4 — shrink-to-fit 확정 뒤 재진입 (CSS-SIZING-3 §5.1). 이 줄이
            // 있으면 자식의 `%` 가 확정 폭에 다시 해소된 것이고, 없으면 1차 pass 의
            // `auto` 해석이 최종값이다 — 둘을 구분 못 하면 폭 발산의 원인을 못 좁힌다.
            self.trace_push(handle, || TraceEvent::ShrinkToFitReentry {
                axis: Axis::Inline,
                settled,
            });
            let (_, h2) = self.solve_flex(handle, children, settled, explicit_h, avail_w, avail_h);
            // auto 축 반환은 content-box 계약 — 단 min/max clamp 가 바인딩했으면 used
            // size 는 clamp 뒤 값이다 (군집 A — 1차 content 유지 계약은 `%` 재해소 한정).
            let report_w = if (settled - own_pb_h - container_w).abs() > f32::EPSILON {
                settled - own_pb_h
            } else {
                container_w
            };
            if let Some(n) = self.get_mut(handle) {
                n.layout.width = report_w;
            }
            return (report_w, h2);
        }

        if let Some(n) = self.get_mut(handle) {
            n.layout = NodeLayout {
                x: 0.0,
                y: 0.0,
                width: container_w,
                height: container_h,
                baseline: first_item_baseline,
            };
            n.dirty = false;
            n.subtree_dirty = false;
        }
        (container_w, container_h)
    }

    /// block 컨테이너 solve — 자식 재귀 → `block.rs`(`block_layout`) → 컨테이너 크기 도출.
    ///
    /// block 은 flex 와 달리 논리축 변환이 없다(항상 물리 vertical stacking). 자식을
    /// 먼저 solve 해 content_w/h 를 확보하고, 21필드 flat f32(물리축)로 직렬화해
    /// `block_layout` 에 넘긴다. auto width 자식은 컨테이너 폭으로 stretch(block.rs
    /// 내부), 그 stretch 폭은 자식 solve 시점엔 모르므로 solve 는 content 만 산출하고
    /// 최종 폭은 block.rs 가 결정 → 반영 후 bounding box 로 컨테이너 크기 도출.
    ///
    /// margin collapse/inline-block line box/BFC through-collapse 는 block.rs 내부가
    /// 처리한다. 단위 3-a 는 부모-자식 margin collapse 를 미전파(`can_collapse_*=false`,
    /// BFC 격리 가정) — 부모로의 collapse 전파는 tree.rs 레벨 metadata 배선이 필요한
    /// 별도 단위. 여기서는 컨테이너 내부 물리 stacking 만 검증한다.
    fn solve_block(
        &mut self,
        handle: usize,
        children: &[usize],
        explicit_w: f32,
        explicit_h: f32,
        avail_w: f32,
        avail_h: f32,
    ) -> (f32, f32) {
        let parent_ctx = self.ctx_for(avail_w);
        let style = self.get(handle).map(|n| n.style.clone()).unwrap_or_default();
        // 컨테이너 자신의 pad_border (% 는 부모 available 기준 — CSS containing block).
        let own_pb_h = axis_pad_border(&style, &parent_ctx, true);
        let own_pb_v = axis_pad_border(&style, &parent_ctx, false);
        let off_x = pad_border_start(&style, &parent_ctx, true);
        let off_y = pad_border_start(&style, &parent_ctx, false);

        // 자식 available = 컨테이너 content box. explicit(border-box) 이면 감산,
        // auto stretch 이면 상속 available(border-box) 에서 감산.
        // 음수 available 은 indefinite 센티넬 — 감산 없이 보존.
        let child_avail_w = if explicit_w > 0.0 {
            spec_to_content(explicit_w, own_pb_h)
        } else if avail_w >= 0.0 {
            (avail_w - own_pb_h).max(0.0)
        } else {
            avail_w
        };
        let child_avail_h = if explicit_h > 0.0 {
            spec_to_content(explicit_h, own_pb_v)
        } else if avail_h >= 0.0 {
            (avail_h - own_pb_v).max(0.0)
        } else {
            avail_h
        };
        // 자식 write / gap 해석 ctx 는 content 폭 기준 (자식 % 의 containing block).
        let ctx = self.ctx_for(child_avail_w);
        // 자식이 percent height 를 해소하는 containing block 높이 (E6) — 컨테이너 height 가
        // **명시 definite** 일 때만 실축, auto 면 INDEFINITE (CSS §10.5). child_avail_h 는
        // auto 여도 부모 available 로 양수라, 그대로 내리면 자식이 height:50% 를 상속
        // available 로 잘못 해소한다(E6 auto-parent PH-1/FP-1: leaf 의 resolve_self_size 가
        // avail_h 기준으로 250 을 냄). height_ctx(write_block_item) 와 solve_node(leaf 자기
        // 크기) **양 경로**에 같은 게이트를 적용해야 percent height 가 일관되게 auto 가 된다.
        let child_containing_h = if explicit_h > 0.0 { child_avail_h } else { INDEFINITE_AVAIL };
        let height_ctx = self.ctx_for(child_containing_h);

        // 1) 자식 재귀 solve → content 크기 확보. auto 컨테이너면 avail_h=INDEFINITE 를 내려
        //    자식 percent height 가 auto 로 해소되게 한다 (위 게이트와 동일 근거).
        let mut child_sizes: Vec<(f32, f32)> = Vec::with_capacity(children.len());
        for &c in children {
            let cs = self.solve_block_child(c, child_avail_w, child_containing_h);
            child_sizes.push(cs);
        }

        // 부모-자식 마진 상쇄 차단 판정 (E3/E17/ADR-156 P4).
        //   CSS 2.1 §8.3.1: 첫 자식 top margin 은 부모에 top padding/border 가 없고 부모가
        //   BFC 를 확립하지 않을 때만 부모와 상쇄해 밖으로 탈출한다. 마지막 자식 bottom 도 대칭.
        //   차단 요인: ① overflow≠visible (BFC, E17) ② top/bottom padding·border
        //   ③ 이 block 이 flex/grid **item** (부모가 flex/grid → item 은 BFC).
        let creates_bfc = overflow_creates_bfc(&style);
        let parent_is_flex_or_grid = self
            .get(handle)
            .and_then(|n| n.parent)
            .and_then(|p| self.get(p))
            .map(|p| {
                matches!(
                    classify_container_display(p.style.display.as_deref()),
                    ContainerDisplay::Flex | ContainerDisplay::Grid
                )
            })
            .unwrap_or(false);
        let block_is_bfc = creates_bfc || parent_is_flex_or_grid;
        let can_collapse_top = !block_is_bfc && off_y == 0.0; // off_y = padding_top+border_top
        let bottom_barrier = pad_border_end(&style, &parent_ctx, false);
        // r11m1 — §8.3.1 adjoining: "bottom margin of a last in-flow child and bottom margin of
        // its parent if the parent has 'auto' computed height" (padding/border 0 · BFC 아님 은
        // 종전 조건). 명시 height (0 포함 — height:0 은 auto 가 아니다) 면 마지막 자식 margin 은
        // 부모 안에 남는다 (Chrome parent-explicit-height-bottom-margin-contained b.y 50 / 종전
        // 70 · height:0 0 / 종전 20). `min-height: 0` 은 adjoining 조건이 아니라 self-collapsing
        // 조건 — min/max-height 는 아래 flow_bottom 확정 뒤 **바인딩 여부**로 판정한다. top
        // 조건에는 height 가 없다 (parent-explicit-height-top-margin-still-collapses p.y 30).
        // height 판정 ctx 는 `resolve_self_size`(explicit_h) 와 같은 avail_h. min/max-height 도
        // 세로 축이라 같은 ctx — 부모가 auto 면 avail_h 는 INDEFINITE 라 percentage 는 None → 0
        // (§10.7: containing block 높이 미명시 시 percentage min-height 는 0). 종전 `parent_ctx`
        // (avail_w) 는 50% 를 폭 기준 150 으로 풀어 바인딩으로 오판 (r12m1 — Chrome b.y 40 / 35).
        let own_height_ctx = self.ctx_for(avail_h);
        let own_height_is_auto =
            resolve_dimension_opt(style.height.as_deref(), &own_height_ctx).is_none();
        let own_min_h =
            resolve_dimension_opt(style.min_height.as_deref(), &own_height_ctx).unwrap_or(0.0);
        let can_collapse_bottom = !block_is_bfc && bottom_barrier == 0.0 && own_height_is_auto;

        // 2) 자식 → block flat f32 (FIELD_COUNT=21 필드, 물리축).
        let measuring = intrinsic_mode(avail_w).is_some();
        let mut data = vec![0.0f32; children.len() * block::FIELD_COUNT];
        for (i, &c) in children.iter().enumerate() {
            let cstyle = self.get(c).map(|n| n.style.clone()).unwrap_or_default();
            let (cw, ch) = child_sizes[i];
            // ADR-923 Phase 2: 자식 solve 가 기록한 baseline (border-top 기준, 센티널 보존).
            // Phase 3 (r7 관찰 → Chrome 실측 ib-overflow-hidden-baseline): **scroll
            // container** 인 atomic inline 은 내부 line box 와 무관하게 bottom margin edge
            // 가 baseline — 센티널로 강제해 intake 의 margin-edge 폴백을 태운다. 규범:
            // css-align-3 §9.1 "a block container that is a block-axis scroll container
            // always has a last baseline set … block-end margin edge" (CSS 2.1 §10.8.1
            // "overflow other than visible" 문면을 scroll container 로 갱신한 조항 — r9l1).
            // clip 은 scroll container 가 아니라 제외 (r8 Chrome 실측 ib-overflow-clip-
            // baseline: last line box baseline 유지 — Codex r8 과제6 반증).
            let child_baseline = if is_scroll_container(&cstyle) {
                BASELINE_NONE
            } else {
                self.get(c).map(|n| n.layout.baseline).unwrap_or(BASELINE_NONE)
            };
            write_block_item(&mut data, i, &cstyle, cw, ch, child_baseline, &ctx, &height_ctx);
            let off = i * block::FIELD_COUNT;
            // **인라인 available 이 미결정이면 auto 폭 block-level 자식은 fit-content 다.**
            //
            // block.rs 의 auto 는 `available - margin` stretch 인데, available 이 음수 센티넬
            // 이면 폭이 음수가 되어 컨테이너가 0 으로 붕괴한다. CSS 상 "늘어날 available 이
            // 없는" 상태의 기여는 stretch 가 아니라 content 이므로 FIT_CONTENT(=content_w
            // 슬롯 소비)가 정의에 맞는 해석이다.
            //
            // ADR-169 Phase 1 이 **측정 패스**(`-2`/`-3`)에만 걸어 뒀는데, `INDEFINITE_AVAIL`
            // (`-1`)도 같은 상태다 — flex 컨테이너의 `align-items` 가 non-stretch 면 auto-cross
            // 자식이 shrink-to-fit 이라 그 센티넬을 받는다(§Container Align). 실측(2026-07-28):
            // `column + align-items:center` 안의 block 컨테이너에서 `width:100%` 자식이 폭
            // **-1**, 컨테이너 **0** (DOM 은 둘 다 120). 라이브에서는 catalog 의 `width:100%`
            // 계열(B22 Text 등)을 품은 컴포넌트가 12~48px 로 접혔다.
            if (measuring || child_avail_w < 0.0) && data[off + 1] == -1.0 {
                data[off + 1] = flex::CONTENT;
            }
            // 자식이 자기 자식 상쇄로 hoisted margin 을 보유하면 자기 style margin 과 collapse
            //   해 상쇄 chain 을 잇는다 (E3 전파). 자식이 BFC 확립 시 형제 관통 상쇄 차단 flag.
            let (ch_esc_mt, ch_esc_mb, ch_bfc, ch_self_collapsing) = self
                .get(c)
                .map(|n| (n.escaped_mt, n.escaped_mb, node_establishes_bfc(&n.style), n.self_collapsing))
                .unwrap_or((block::MarginSet::ZERO, block::MarginSet::ZERO, false, false));
            // r10m2 — own margin 과 탈출 chain 은 한 adjoining 집합: 슬롯 3/5 = 양수 성분,
            // 19/20 = 음수 성분 (block.rs `MarginSet::of(3).with(19)`). 이항 collapse 로 값만
            // 넘기면 손자 음수 margin 이 wrapper·형제 양수와 결합 순서에 따라 갈린다
            // (Chrome mixed-sign-chain-hoisted-through-wrapper g.y 20 / 종전 35).
            let mt = block::MarginSet::of(data[off + 3]).join(ch_esc_mt);
            data[off + 3] = mt.pos;
            data[off + 19] = mt.neg;
            let mb = block::MarginSet::of(data[off + 5]).join(ch_esc_mb);
            data[off + 5] = mb.pos;
            data[off + 20] = mb.neg;
            if ch_bfc {
                data[off + 7] = 1.0; // bfc_flag — block.rs 미소비 (r9), 프로토콜 호환 잔존
            }
            // self-collapsing 코드 2 — **단일 원천** = 자식 solve 가 남긴 플래그 (solve_block
            // 재귀 판정 또는 solve_node leaf 경로 — r10h1/r10m1). intake 는 판정하지 않는다.
            if data[off] == 0.0 && ch_self_collapsing {
                data[off] = 2.0;
            }
        }

        // 3) block_layout — 부모-자식 collapse 활성 (차단 요인 없을 때). metadata
        //    (firstChildMarginTop/lastChildMarginBottom) 로 탈출 margin 을 회수한다.
        // ADR-923 Phase 3: 컨테이너 line-height(px) = strut (§10.8 — Chrome 실측
        // strut-short/tall). None = strut 없음 (TS 는 "normal" 을 보내지 않는다 — 그
        // gap 의 공급 채널은 S4/Phase 5 판정).
        let strut_line_height = style.line_height.unwrap_or(-1.0);
        let out = block::block_layout_with_strut(
            &data,
            child_avail_w,
            child_avail_h,
            can_collapse_top,
            can_collapse_bottom,
            0.0,
            strut_line_height,
        );
        let meta_off = children.len() * 4;
        // 탈출한 top margin — block.rs 는 첫 자식을 여전히 y=escaped_top 에 배치하고 이 값을
        //   metadata 로 보고한다. 상쇄된 margin 은 컨테이너 **밖**으로 나가므로 자식 y 에서
        //   빼 컨테이너 content 원점(y=0)에 맞추고, 컨테이너 밖으로 hoist 한다.
        let escaped_top = out[meta_off];
        let escaped_bottom = out[meta_off + 1];
        // r10m2 — meta 4/5 = 음수 성분 → 집합 복원 (부모 intake 가 own margin 과 합친다).
        let escaped_top_set =
            block::MarginSet { pos: escaped_top - out[meta_off + 4], neg: out[meta_off + 4] };
        let escaped_bottom_set =
            block::MarginSet { pos: escaped_bottom - out[meta_off + 5], neg: out[meta_off + 5] };

        // 4) 자식 위치 반영 + bounding box 로 컨테이너 content 크기 도출.
        //    bounding box 는 offset 전 좌표 기준(컨테이너 content 크기), 저장은 offset 후
        //    (자식 화면 좌표는 padding 안쪽) — 섞으면 컨테이너 크기에 padding 이중 반영.
        let mut max_right: f32 = 0.0;
        // ADR-923 Phase 2: block 컨테이너 baseline = 마지막 in-flow line box(정확값은
        // 아래 block.rs meta), line box 가 마지막이 아니면 마지막 baseline 원천 보유
        // 자식의 baseline (CSS 2.1 §10.8.1 "last in-flow line box" 의 중첩 전파 근사).
        let mut last_inflow_baseline: f32 = BASELINE_NONE;
        for (i, &c) in children.iter().enumerate() {
            let off = i * 4;
            let (mut x, y, w, h) = (out[off], out[off + 1] - escaped_top, out[off + 2], out[off + 3]);
            // E4: 가로 margin:auto → content box 잉여 공간 분배 (ADR-156 Phase 5, CSS §10.3.3).
            //   both auto = 중앙, left auto = 우측 정렬. auto width 자식은 free 0 이라 무영향.
            let cstyle = self.get(c).map(|n| n.style.clone()).unwrap_or_default();
            let ml_auto = cstyle.margin_left.as_deref() == Some("auto");
            let mr_auto = cstyle.margin_right.as_deref() == Some("auto");
            if ml_auto || mr_auto {
                let free = (child_avail_w - w).max(0.0);
                x = if ml_auto && mr_auto {
                    free / 2.0
                } else if ml_auto {
                    free
                } else {
                    x
                };
            }
            max_right = max_right.max(x + w);
            if let Some(n) = self.get_mut(c) {
                let child_baseline = n.layout.baseline;
                n.layout =
                    NodeLayout { x: x + off_x, y: y + off_y, width: w, height: h, baseline: child_baseline };
                let code = data[i * block::FIELD_COUNT];
                if code == 1.0 {
                    // atomic inline-level: line box 참여 — 원천 없어도 bottom 폴백이 곧
                    // baseline 이다. 근사 후보 = item y + 해소값; 마지막 자식이 line box 면
                    // 아래 meta 정확값(top/middle/bottom 정렬 반영)이 이 근사를 덮는다.
                    let resolved = if child_baseline >= 0.0 { child_baseline } else { h };
                    last_inflow_baseline = y + off_y + resolved;
                } else if child_baseline >= 0.0 {
                    last_inflow_baseline = y + off_y + child_baseline;
                }
            }
        }

        // ADR-923 Phase 2: 마지막 자식이 line box 참여자면 block.rs meta 의 마지막
        // line box baseline(content-box y, escape 전 좌표)이 정확값 — off_y/escape 보정.
        let last_line_baseline = out[meta_off + 2];
        let last_child_is_line_item = !children.is_empty()
            && data[(children.len() - 1) * block::FIELD_COUNT] == 1.0;
        let container_baseline = if last_child_is_line_item && last_line_baseline >= 0.0 {
            off_y + (last_line_baseline - escaped_top)
        } else {
            last_inflow_baseline
        };

        // 컨테이너 크기: 명시 있으면 명시. 높이는 block.rs meta **in-flow bottom** 단독
        // (CSS 2.1 §10.6.3 — 마지막 line box(strut/valign 초과분 포함, r8h2) 또는 마지막
        // in-flow block 의 bottom border/margin edge). 자식 rect bbox 는 쓰지 않는다 —
        // 꼬리 self-collapsing box 의 rect(y=as-if-border 자리, h 0) 와 음수 bottom margin
        // 이 bbox 에선 auto height 를 부풀린다 (r9m2 — Chrome trailing-empty-block-escape
        // root 10, bbox 면 30).
        let flow_bottom = out[meta_off + 3] - escaped_top;
        // r11m1 — min/max-height 가 **바인딩**되면 (used block-size ≠ strut 제외 intrinsic) 마지막
        // 자식의 bottom margin strut 은 부모 밖으로 전파되지 않는다 — Blink 모델, Chrome 실측:
        // min-height:30 (content 20 < 30 < strut 포함 40) p.h 30 · b.y 45 (포함-후-clamp 모델이면
        // 55) · max-height:10 b.y 25 · min-height:100 b.y 115 / 미바인딩 min-height:10 은 접힘
        // 유지 b.y 40 (종전 min_h > 0 일괄 포함은 55 로 발산). 사용 높이는 부모 intake 의
        // `clamp_size`(슬롯 12/13, content-box) 가 확정하므로 여기선 strut 만 지운다 — 자식 margin
        // edge 는 상자 안 overflow. 비교는 슬롯과 같은 content-box.
        let flow_content = flow_bottom.max(0.0);
        let own_max_h_content =
            resolve_dimension_opt(style.max_height.as_deref(), &own_height_ctx)
                .map(|mx| spec_to_content(mx, own_pb_v));
        let min_max_binds = spec_to_content(own_min_h, own_pb_v) > flow_content
            || own_max_h_content.is_some_and(|mx| mx < flow_content);
        let escaped_bottom_set = if can_collapse_bottom && min_max_binds {
            block::MarginSet::ZERO
        } else {
            escaped_bottom_set
        };
        let container_w = if explicit_w > 0.0 { explicit_w } else { max_right };
        // auto height 는 0 하한 (r10m3 — 음수 margin 으로 in-flow bottom 이 content 원점 위로
        // 올라가도 used height 는 음수가 아니다: Chrome negative-top-margin-padded root.h 2).
        let container_h = if explicit_h > 0.0 {
            explicit_h
        } else if own_height_is_auto {
            flow_bottom.max(0.0)
        } else {
            // 명시 height:0 은 auto 가 아니다 (r11m1 인접) — used content 0. min-height clamp 와
            // padding 은 auto 와 같은 경로 (부모 intake `clamp_size` / root fixup) 가 적용한다.
            0.0
        };

        // 5) **shrink-to-fit 확정 뒤 재-solve** — `%` 재해소 + auto 폭 자식 stretch 복원.
        //   실측(2026-07-28): 폭 120 으로 확정된 shrink-to-fit block 안에서 `width:50%` 자식이
        //   Chrome 60 / 구 엔진 120, `marginLeft:10%` 자식이 x=147/w=108 vs x=135/w=120.
        let inline_shrink_to_fit =
            explicit_w <= 0.0 && avail_w == INDEFINITE_AVAIL && !children.is_empty();
        if let Some(settled) = shrink_to_fit_settled(
            inline_shrink_to_fit,
            container_w,
            own_pb_h,
            resolve_dimension_opt(style.min_width.as_deref(), &parent_ctx),
            resolve_dimension_opt(style.max_width.as_deref(), &parent_ctx),
        ) {
            for &c in children {
                self.mark_subtree_dirty(c);
            }
            self.trace_push(handle, || TraceEvent::ShrinkToFitReentry {
                axis: Axis::Inline,
                settled,
            });
            let (_, h2) = self.solve_block(handle, children, settled, explicit_h, avail_w, avail_h);
            // auto 축 반환은 content-box 계약 — min/max clamp 바인딩 시 used = clamp 뒤 값.
            let report_w = if (settled - own_pb_h - container_w).abs() > f32::EPSILON {
                settled - own_pb_h
            } else {
                container_w
            };
            if let Some(n) = self.get_mut(handle) {
                n.layout.width = report_w;
            }
            return (report_w, h2);
        }

        let all_children_collapse_through =
            (0..children.len()).all(|i| data[i * block::FIELD_COUNT] == 2.0);
        if let Some(n) = self.get_mut(handle) {
            n.layout = NodeLayout {
                x: 0.0,
                y: 0.0,
                width: container_w,
                height: container_h,
                baseline: container_baseline,
            };
            n.escaped_mt = escaped_top_set;
            n.escaped_mb = escaped_bottom_set;
            // §8.3.1 self-collapsing 판정 (struct doc) — in-flow 자식 **전부** 관통(코드 2;
            // line box 는 코드 1 이라 자동 제외), height auto/0, 상하 pad/border 0, min-height 0,
            // BFC 아님. in-flow bottom ≤ 0 은 근거가 아니다 — 음수 margin 으로 bottom 이 0 이하로
            // 내려가도 내용 있는 자식이 있으면 self-collapsing 이 아니다 (r10m3 인접, Chrome
            // negative-flow-bottom-not-self-collapsing b.y 60). 부모 intake 가 코드 2 로 읽는다.
            n.self_collapsing = !block_is_bfc
                && off_y == 0.0
                && bottom_barrier == 0.0
                && all_children_collapse_through
                && explicit_h <= 0.0
                && own_min_h <= 0.0;
            n.dirty = false;
            n.subtree_dirty = false;
        }
        (container_w, container_h)
    }

    /// grid 컨테이너 solve — `grid.rs`(`grid_layout`) 로 트랙 산술 셀 배치.
    ///
    /// grid 는 flex/block 과 계약이 근본적으로 다르다. 자식 flat f32 를 안 받고
    /// `template_cols/rows/areas` + `placement_spec` **문자열**만 받아 트랙을
    /// 산술로 계산해 셀 bounds 를 낸다(자식 크기 = 트랙 크기, intrinsic track 미측정).
    ///
    /// tree.rs 어댑터 역할:
    /// (1) `grid_template_columns: Vec<String>` (track array) → space-join 문자열,
    /// (2) 자식 `grid_column_start`+`end` → grid.rs `parse_grid_line` 결합 형식
    ///     `"{start} / {end}"` 재조립 (NodeStyle 은 taffy_bridge 처럼 start/end 분리),
    /// (3) 자식들을 `area_name|grid_column|grid_row` 파이프 형식(개행 구분) 직렬화.
    ///
    /// 셀 bounds 를 받은 뒤 각 자식을 셀 크기로 재귀 solve(자식이 grid 셀 안 flex/
    /// block 컨테이너일 수 있음) → 셀 좌표를 자식 위치로 반영.
    ///
    /// **implicit auto row (2026-07-04, seam C-1)**: `gridTemplateRows` 미명시 +
    /// 전부 auto-placement 이면, grid.rs 하드코딩 fallback(100) 대신 자식을 먼저
    /// solve 해 intrinsic content height 를 얻고 row-major(row = i / col_count) 별
    /// max 를 px 트랙으로 주입한 뒤 grid.rs 호출 → CSS implicit auto row 동작.
    /// (명시 row 안의 auto track intrinsic, 명시 placement 케이스는 여전히 미측정.)
    fn solve_grid(
        &mut self,
        handle: usize,
        children: &[usize],
        explicit_w: f32,
        explicit_h: f32,
        avail_w: f32,
        avail_h: f32,
    ) -> (f32, f32) {
        let style = self.get(handle).map(|n| n.style.clone()).unwrap_or_default();
        let parent_ctx = self.ctx_for(avail_w);
        let own_pb_h = axis_pad_border(&style, &parent_ctx, true);
        let own_pb_v = axis_pad_border(&style, &parent_ctx, false);
        let off_x = pad_border_start(&style, &parent_ctx, true);
        let off_y = pad_border_start(&style, &parent_ctx, false);

        // 트랙 available = content box (explicit=border-box 감산 / 상속도 감산).
        let mut container_w = if explicit_w > 0.0 {
            spec_to_content(explicit_w, own_pb_h)
        } else if avail_w >= 0.0 {
            (avail_w - own_pb_h).max(0.0)
        } else {
            avail_w
        };
        let container_h = if explicit_h > 0.0 {
            spec_to_content(explicit_h, own_pb_v)
        } else if avail_h >= 0.0 {
            (avail_h - own_pb_v).max(0.0)
        } else {
            avail_h
        };
        let ctx_w = self.ctx_for(container_w);

        // gap.
        let col_gap = resolve_gap(style.column_gap.as_deref(), &ctx_w);
        let row_gap = resolve_gap(style.row_gap.as_deref(), &ctx_w);

        // (1) track array → space-join 문자열.
        let mut template_cols = join_tracks(style.grid_template_columns.as_deref());
        let mut template_rows = join_tracks(style.grid_template_rows.as_deref());

        // (2)+(3) 자식 placement 직렬화 (area_name|grid_column|grid_row 개행 구분).
        let placement_spec = self.build_grid_placement_spec(children);

        // 자식 → 셀 매핑은 **grid.rs 의 실제 배치**로 구한다. 트랙 sizing 은 "어느 자식이
        // 어느 트랙에 있는가" 를 알아야 하는데, `i / col_count` 근사는 CSS §8.5 커서 규칙
        // (definite column 이 커서보다 왼쪽이면 다음 행)을 모른다 — 측정한 행과 배치된 행이
        // 갈리면 컨테이너 크기가 어긋난다 (실측: definite-column 자식 2개가 CSS 는 2행인데
        // 근사는 1행 → DOM 400 / 근사 200).
        let flow_column = style
            .grid_auto_flow
            .as_deref()
            .map(|f| f.contains("column"))
            .unwrap_or(false);
        let placed_cells = grid::resolve_child_cells(
            &placement_spec,
            children.len(),
            "",
            grid::parse_tracks(&template_cols, container_w, col_gap).len().max(1),
            grid::tokenize_template(&template_rows).len().max(1),
            flow_column,
        );

        // 아래 intrinsic 측정 pass 들은 자식 서브트리를 **컨테이너 크기**로 solve 한다.
        // solve_* 는 말미에 dirty=false 를 찍으므로, 그 뒤 셀 크기로 다시 부르면 증분 skip
        // 이 stale 캐시를 돌려준다 — 측정이 돌았는지 기록해 최종 pass 에서 되살린다.
        let mut measured_with_container = false;

        // ── 인라인 축이 미결정이면 트랙을 **기여로 세운다** (CSS-GRID-1 §12.5–§12.7.1) ──
        //
        // 세 진입이 같은 상태다: 측정 모드 센티넬(`measure_intrinsic_width` 재실행) /
        // `width` 가 intrinsic 키워드 / 상속 available 자체가 indefinite. 어느 쪽이든
        // "나눠 줄 여유" 가 없으므로 available 을 분배하는 평소 경로가 성립하지 않는다 —
        // `resolve_grid_tracks` 2단계가 음수 available 에서 `fr_size = 0` 을 내 **fr·auto
        // 트랙이 통째로 붕괴**하던 자리다 (ADR-169 이 grid 축을 이연한 사유).
        //
        // 여기서 트랙을 px 로 확정하고 `container_w` 를 그 합으로 세우면, 아래 경로는
        // definite 컨테이너를 받은 것과 똑같이 돈다 — §12.8 stretch 도 auto 토큰이 남지
        // 않아 자연히 no-op 이다(여유가 없으니 정답).
        let inline_intrinsic = intrinsic_mode(avail_w).or_else(|| {
            // **explicit 폭이 있으면 definite 경로다** — 키워드여도 재진입 2차 pass 는
            //   settled(확정) 폭을 받으므로 intrinsic 재측정이 그 폭을 덮으면 안 된다
            //   (ADR-170 — 재진입이 원본 토큰으로 §12.5→§12.6→§12.7.1→§12.8 을 다시 돈다).
            if explicit_w > 0.0 {
                return None;
            }
            match style.width.as_deref().map(str::trim) {
                Some(w) if w.eq_ignore_ascii_case("min-content") => Some(IntrinsicMode::Min),
                Some(w) if w.eq_ignore_ascii_case("max-content") => Some(IntrinsicMode::Max),
                // `fit-content` = clamp(min, stretch-fit, max) — 상한 쪽부터 구하고
                //   아래에서 available 로 clamp 한다.
                Some(w) if w.eq_ignore_ascii_case("fit-content") => Some(IntrinsicMode::Max),
                _ => {
                    // 상속 available 도 미결정 → shrink-to-fit = max-content.
                    if avail_w >= 0.0 { None } else { Some(IntrinsicMode::Max) }
                }
            }
        });

        if let Some(mode) = inline_intrinsic {
            // **명시 열이 없어도 암묵 열은 있다** — `grid-template-columns` 미지정이면
            // auto-placement 가 만든 암묵 열을 `grid-auto-columns`(기본 `auto`)가 정한다.
            // 종전엔 여기서 그냥 빠져나가 `container_w` 가 미결정 센티넬(`-1`) 그대로 남았고,
            // 그 값이 컨테이너 폭으로 보고됐다 — 실측: `align-items:center` 아래 template
            // 없는 grid 의 폭이 **-1** (DOM 120). 행 축의 암묵 트랙 생성과 같은 규칙이다.
            let toks: Vec<String> = {
                let explicit = grid::tokenize_template(&template_cols);
                if !explicit.is_empty() {
                    explicit
                } else {
                    let cols = placed_cells.iter().map(|p| p.1).max().map_or(1, |m| m + 1);
                    let auto_toks =
                        grid::tokenize_template(&join_tracks(style.grid_auto_columns.as_deref()));
                    (0..cols)
                        .map(|i| {
                            auto_toks
                                .get(i % auto_toks.len().max(1))
                                .cloned()
                                .unwrap_or_else(|| "auto".to_string())
                        })
                        .collect()
                }
            };
            if !toks.is_empty() {
                let col_count = toks.len();
                let mut col_min = vec![0.0f32; col_count];
                let mut col_max = vec![0.0f32; col_count];
                for (i, &c) in children.iter().enumerate() {
                    let col = placed_cells.get(i).map(|p| p.1).unwrap_or(i % col_count);
                    let fixed_max = toks.get(col).and_then(|t| track_fixed_max(t, 0.0));
                    let (mn, mx, solved_with_container) =
                        self.col_contribution(c, container_w, container_h, fixed_max);
                    measured_with_container |= solved_with_container;
                    if col < col_count {
                        col_min[col] = col_min[col].max(mn);
                        col_max[col] = col_max[col].max(mx);
                    }
                }
                let sizes = grid_intrinsic_track_sizes(&toks, &col_min, &col_max, mode);
                let sum: f32 = sizes.iter().sum::<f32>()
                    + col_gap * (col_count as f32 - 1.0).max(0.0);
                // `fit-content` 는 stretch-fit(=상속 available)으로 한 번 더 clamp 한다.
                let is_fit_content = style
                    .width
                    .as_deref()
                    .map(|w| w.trim().eq_ignore_ascii_case("fit-content"))
                    .unwrap_or(false);
                container_w = if is_fit_content && avail_w >= 0.0 {
                    sum.min((avail_w - own_pb_h).max(0.0))
                } else {
                    sum
                };
                template_cols = sizes
                    .iter()
                    .map(|s| format!("{s}px"))
                    .collect::<Vec<_>>()
                    .join(" ");
            }
        }

        // ── 행 트랙 sizing (블록 축) — 트랙 목록의 소유자는 tree.rs 다 ──
        //
        // grid.rs 는 **자식을 모른다**. `auto` 를 1fr 로 근사(available 분배)하므로 측정 없이는
        // `height:auto` 컨테이너에서 auto row 가 상속 available 을 나눠 가져 폭발(availH>0)
        // 하거나 0 으로 붕괴(availH<0)한다. 그래서 여기서 자식 기여로 행을 px 로 확정해 넘긴다.
        // 토큰화는 grid.rs 와 **같은 함수**를 쓴다 — `split_whitespace` 는 `minmax(50px, 80px)`
        // 처럼 내부에 공백이 있는 토큰을 두 조각으로 쪼갠다.
        //
        // **행 목록 = 명시 토큰 ++ 암묵 토큰**. 암묵 행의 크기는 `grid-auto-rows` 가 정하고
        // (기본 `auto`, 값이 여러 개면 첫 암묵 행부터 순환), 자식이 쓰는 최대 row 까지 만든다.
        // 종전엔 명시 토큰이 하나라도 있으면 암묵 행을 아예 만들지 않아 grid.rs 의
        // `cell_bounds_for_child` 가 범위 밖 트랙을 0 으로 읽었다 — 자식이 같은 y 에 겹치고
        // 컨테이너도 그만큼 짧아진다 (실측 `30px` 1행 + 자식 3개: DOM 70 / 엔진 50, k2 가 k1 위).
        //
        // **블록 축이 미결정이면 전 토큰을 기여로 세운다** (§12.5–§12.7.1, 인라인 축과 동형).
        // `1fr`/`%` 는 나눠 줄 여유가 없으니 content 크기가 되어야 하는데 종전 경로는 그 둘을
        // 상속 available 로 풀었다. 미결정 축에서는 이 확정 결과가 곧 컨테이너 높이다(`final_h`).
        let explicit_row_tokens: Vec<String> = grid::tokenize_template(&template_rows);
        let auto_row_tokens: Vec<String> = style
            .grid_auto_rows
            .as_deref()
            .map(|v| {
                v.iter()
                    .map(|t| t.trim().to_string())
                    .filter(|t| !t.is_empty())
                    .collect()
            })
            .filter(|v: &Vec<String>| !v.is_empty())
            .unwrap_or_else(|| vec!["auto".to_string()]);
        let child_rows: Vec<usize> = placed_cells.iter().map(|p| p.0).collect();
        // 암묵 행은 **row-flow 에서만** 생긴다 — col-flow 는 행을 명시 트랙으로 고정하고
        // 열을 늘린다 (그 확장은 grid.rs 소관).
        let row_count = if flow_column {
            explicit_row_tokens.len()
        } else {
            child_rows
                .iter()
                .map(|&r| r + 1)
                .max()
                .unwrap_or(0)
                .max(explicit_row_tokens.len())
        };
        let row_tokens: Vec<String> = (0..row_count)
            .map(|r| match explicit_row_tokens.get(r) {
                Some(t) => t.clone(),
                None => auto_row_tokens
                    [(r - explicit_row_tokens.len()) % auto_row_tokens.len()]
                .clone(),
            })
            .collect();

        let block_indefinite = explicit_h <= 0.0;
        let needs_row_measure =
            block_indefinite || row_tokens.iter().any(|t| track_needs_contribution(t));

        // 행별 content 기여. **블록 축은 min-content == max-content** 로 둔다 — 높이는 폭이
        // 정해진 뒤의 내용 크기 하나뿐이라 두 값이 갈리지 않는다 (인라인 축과 다른 점).
        let mut row_intrinsic: Vec<f32> = vec![0.0; row_count];
        if needs_row_measure && !children.is_empty() {
            measured_with_container = true;
            for (i, &c) in children.iter().enumerate() {
                let row = child_rows[i];
                let (cw, ch) = self.solve_node(c, container_w, container_h);
                // §6.6 — 고정 max 트랙만 span 하는 auto-height 아이템의 최소 기여 clamp.
                let fixed_max = row_tokens
                    .get(row)
                    .and_then(|t| track_fixed_max(t, container_h));
                let ch = self.clamp_auto_min_contribution(c, ch, fixed_max, false);
                let (_, ch) = self.track_contribution(c, cw, ch, container_w, container_h);
                if row < row_intrinsic.len() {
                    row_intrinsic[row] = row_intrinsic[row].max(ch);
                }
            }
        }

        let row_auto_idx: Vec<usize> = row_tokens
            .iter()
            .enumerate()
            .filter(|(_, t)| track_max_sizing_is_auto(t))
            .map(|(r, _)| r)
            .collect();

        // 블록 축 트랙 extent — 미결정 축에서는 이것이 곧 컨테이너 높이다.
        let mut row_extent: Option<f32> = None;
        template_rows = if block_indefinite {
            let sizes = grid_intrinsic_track_sizes(
                &row_tokens,
                &row_intrinsic,
                &row_intrinsic,
                IntrinsicMode::Max,
            );
            row_extent =
                Some(sizes.iter().sum::<f32>() + row_gap * (row_count as f32 - 1.0).max(0.0));
            sizes
                .iter()
                .map(|s| format!("{s}px"))
                .collect::<Vec<_>>()
                .join(" ")
        } else {
            // definite 축 — content 기반 토큰만 측정값으로 해소, px/fr/% 는 원본 유지
            // (그 뒤 §12.8 stretch 가 auto 트랙에 여유를 분배한다).
            row_tokens
                .iter()
                .enumerate()
                .map(|(r, tok)| {
                    let h = row_intrinsic.get(r).copied().unwrap_or(0.0);
                    resolve_track_with_contribution(tok, h, h)
                })
                .collect::<Vec<_>>()
                .join(" ")
        };

        // auto **column** intrinsic 측정 (row 와 대칭). `gridTemplateColumns:"1fr auto"`
        // 에서 auto col 은 CSS 상 그 col 자식들의 max content width. grid.rs 는 auto 를 1fr
        // 로 근사(available 분배)하므로, 측정 없이는 auto col 이 1fr 과 available 을 나눠 가져
        // content 보다 크게(ProgressBar value: CSS 29 vs 근사 168) → col 폭 발산 + 배치 밀림.
        // 자식 gridColumnStart(1-based line)로 col 결정, auto 토큰 col 만 max intrinsic width
        // 로 치환(1fr/px/% col 보존). placement 없는 자식은 col-major fallback.
        // §12.8 stretch 대상 인덱스 — 측정으로 `{n}px` 가 되기 **전에** 어느 트랙이 auto
        // 였는지 기록해 둔다. 치환 후에는 토큰만으로 구분할 수 없다.
        let mut col_auto_idx: Vec<usize> = Vec::new();
        let col_tokens: Vec<String> = grid::tokenize_template(&template_cols);
        let has_intrinsic_col = col_tokens.iter().any(|t| track_needs_contribution(t));
        let template_cols = if has_intrinsic_col && !children.is_empty() {
            // row-major auto-placement: gridColumnStart 미명시 자식 i 의 col = i % col_count.
            let col_count = col_tokens.len().max(1);
            // 트랙별 (min-content, max-content) 기여 — 그 열 자식들의 최댓값.
            let mut col_min: Vec<f32> = vec![0.0; col_tokens.len()];
            let mut col_max: Vec<f32> = vec![0.0; col_tokens.len()];
            for (i, &c) in children.iter().enumerate() {
                let col = placed_cells.get(i).map(|p| p.1).unwrap_or(i % col_count);
                let fixed_max = col_tokens
                    .get(col)
                    .and_then(|t| track_fixed_max(t, container_w));
                let (mn, mx, solved_with_container) =
                    self.col_contribution(c, container_w, container_h, fixed_max);
                measured_with_container |= solved_with_container;
                if col < col_min.len() {
                    col_min[col] = col_min[col].max(mn);
                    col_max[col] = col_max[col].max(mx);
                }
            }
            col_auto_idx = col_tokens
                .iter()
                .enumerate()
                .filter(|(_, t)| track_max_sizing_is_auto(t))
                .map(|(c, _)| c)
                .collect();
            col_tokens
                .iter()
                .enumerate()
                .map(|(cidx, tok)| {
                    let mn = col_min.get(cidx).copied().unwrap_or(0.0);
                    let mx = col_max.get(cidx).copied().unwrap_or(0.0);
                    resolve_track_with_contribution(tok, mn, mx)
                })
                .collect::<Vec<_>>()
                .join(" ")
        } else {
            template_cols
        };

        // CSS-GRID-1 §12.8 "Stretch auto Tracks" — 남는 여유를 auto 트랙에 균등 분배.
        //
        // **definite 판정은 `explicit_*` 하나**로 아래 `align_content` 게이트와 같은 근거다:
        // 여유는 definite size 에서만 생기고(CSS-ALIGN-3 §4.4), 상속 available 을 여유로
        // 보면 없는 공간을 나눠 넣는다. 실측 확인 — `height:auto` 그리드는 stretch 없음,
        // flex row 안의 `width:auto` 그리드도 없음(shrink-to-fit, DOM 80).
        //
        // **가로축을 `explicit_w > 0.0` 으로 좁힌 이유**: block-level `width:auto` 그리드는
        // CSS 상 stretch-fit 이라 인라인 크기가 definite 인데, 엔진에는 그걸 구분하는 신호가
        // 없다. 같은 자리에서 `1fr` 이 이미 그 구분 없이 상속 available 로 해소되어 DOM 80
        // vs 엔진 400 으로 어긋나 있다 — **`auto` 와 무관한 별개 축**이라 여기서 같이 풀지
        // 않는다. 좁힌 게이트는 그 축을 건드리지 않고, `auto` 트랙이 우연히 맞던 경우
        // (flex item 그리드)를 깨지도 않는다. `gridItemBox.browser.test.ts` 의 스냅샷이 고정.
        let mut row_tracks: Vec<String> = grid::tokenize_template(&template_rows);
        if explicit_h > 0.0 && distribution_allows_stretch(style.align_content.as_deref()) {
            stretch_auto_tracks(&mut row_tracks, &row_auto_idx, container_h, row_gap);
            template_rows = row_tracks.join(" ");
        }
        // **인라인 축은 stretch-fit 도 definite** 다 — block-level `width:auto` 박스는 CSS 상
        //   containing block 을 채우므로(§10.3.3) 나눠 줄 여유가 있다. 그 구분은 이제 위
        //   `inline_intrinsic` 이 준다: shrink-to-fit(flex item / 측정 모드 / 키워드)이면
        //   `Some`, 그 외에 상속 available 이 확정이면 stretch-fit 이다.
        //   블록 축(`align_content`)에는 이 완화를 주지 않는다 — `height:auto` 는 내용 크기라
        //   진짜 미결정이다 (§여유가 없는 것과 음수인 것은 다르다).
        let inline_definite = explicit_w > 0.0 || (inline_intrinsic.is_none() && avail_w >= 0.0);
        let mut col_tracks: Vec<String> = grid::tokenize_template(&template_cols);
        let template_cols =
            if inline_definite && distribution_allows_stretch(style.justify_content.as_deref()) {
                stretch_auto_tracks(&mut col_tracks, &col_auto_idx, container_w, col_gap);
                col_tracks.join(" ")
            } else {
                template_cols
            };

        // ADR-183 #7 — 커널에 넘어가는 **확정 트랙**. 여기까지 오면 §12.5 기여로 세운
        // base 에 §12.6/§12.7.1 이 얹히고 §12.8 stretch 까지 반영된 값이다. 트랙 폭을
        // 자식 폭으로 역추정하면 틀린다 (빈 트랙·넘치는 자식) — 그래서 그 값을 직접 남긴다.
        if self.trace.is_some() {
            let cols = parse_track_px(&col_tracks);
            let rows = parse_track_px(&row_tracks);
            let stretched_cols =
                inline_definite && distribution_allows_stretch(style.justify_content.as_deref());
            self.trace_push(handle, || TraceEvent::GridTrackResolve {
                stage: if stretched_cols { TrackStage::AutoStretch } else { TrackStage::Contribution },
                axis: Axis::Inline,
                tracks: cols,
            });
            let stretched_rows =
                explicit_h > 0.0 && distribution_allows_stretch(style.align_content.as_deref());
            self.trace_push(handle, || TraceEvent::GridTrackResolve {
                stage: if stretched_rows { TrackStage::AutoStretch } else { TrackStage::Contribution },
                axis: Axis::Block,
                tracks: rows,
            });
        }

        // grid_layout — 셀 bounds flat [x,y,w,h,...].
        // justify-content/align-content (E12) — 고정 트랙이 컨테이너보다 작을 때 트랙셋 정렬.
        let justify_content = style.justify_content.as_deref().unwrap_or("");
        // `align-content` 는 **block 축이 definite** 일 때만 여유를 분배한다 — 여유 공간은
        //   definite size 에서만 생긴다(CSS-ALIGN-3 §4.4 / CSS-GRID-1 §10.5). `height:auto`
        //   그리드는 트랙 sizing 을 위해 **상속 available** 을 `container_h` 로 쓰는데, 그걸
        //   그대로 여유로 보면 **없는 공간**을 트랙 사이에 나눠 넣는다.
        //
        // **Why (2026-07-27 CSS 정합 sweep)**: `height:auto` + `align-content:center` 그리드에서
        //   상속 600 을 기준으로 (600-70)/2 = 265 만큼 트랙이 아래로 밀리고 컨테이너 높이가
        //   70 → 335 로 폭주했다 (`space-between` 은 560/600). flex 의 미결정 main 센티넬
        //   (`place_line_main_axis`) 과 **같은 병인**이다. 인라인 축(`justify-content`)은
        //   block 레벨 stretch 로 폭이 늘 definite 이라 대상 아님 — shrink-to-fit 그리드가
        //   생기면 그때 같은 판정을 붙인다.
        let align_content = if explicit_h > 0.0 {
            style.align_content.as_deref().unwrap_or("")
        } else {
            ""
        };
        // grid-auto-flow/columns/rows (E14). auto_columns/rows 는 track array → space-join.
        let auto_flow = style.grid_auto_flow.as_deref().unwrap_or("");
        let auto_columns = join_tracks(style.grid_auto_columns.as_deref());
        let auto_rows = join_tracks(style.grid_auto_rows.as_deref());
        // 미결정 블록 축에서는 트랙 extent 가 곧 컨테이너 크기다 — 상속 available 을 넘기면
        // `track_distribution` 이 없는 여유를 트랙 사이에 나눠 넣는다.
        let grid_container_h = row_extent.unwrap_or(container_h);
        let bounds = grid::grid_layout(
            &template_cols,
            &template_rows,
            "", // template_areas 미사용 (NodeStyle 에 없음 — Skia 경로는 숫자 line)
            &placement_spec,
            children.len() as u32,
            container_w,
            grid_container_h,
            col_gap,
            row_gap,
            justify_content,
            align_content,
            auto_flow,
            &auto_columns,
            &auto_rows,
        );

        // 셀 좌표 반영 + 각 자식을 셀 크기로 재귀 solve.
        // bounding box 는 offset 전 좌표 기준(컨테이너 content 크기), 저장은 offset 후
        // (자식 화면 좌표는 padding 안쪽) — 섞으면 컨테이너 크기에 padding 이중 반영.
        //
        // E2 (ADR-156 Phase 3, 옵션 3-b): align-items/align-self **세로 배치**. 자식 height 가
        //   확정(explicit)이거나 align≠stretch 면 자식을 셀 안에서 start/center/end 로 배치하고
        //   자식 실제 height 를 쓴다(stretch 기본은 셀 채움 유지). **width(justify)는 stretch 유지**
        //   — JS DFS(fullTreeLayout) 가 grid 자식 폭을 트랙 폭으로 강제하므로 엔진이 justify 를
        //   더해도 live 에서 이중 적용/무효가 되어 §Residual (옵션 3-b 계약).
        let grid_align_items = parse_align_items(style.align_items.as_deref());
        let grid_justify_items = parse_justify_items(style.justify_items.as_deref());
        let mut max_right: f32 = 0.0;
        // ADR-923 Phase 2 (r7m1 수정): grid 컨테이너 baseline = **placement row-major
        // 첫** 원천 보유 item (CSS-ALIGN-3 §9.3 first-baseline set = 첫 row 기준).
        // 종전 children source 순서 첫 원천은 명시 placement 가 순서를 뒤집으면
        // (row2 item 이 source 앞) 다른 row 의 baseline 을 냈다 — 후보 정렬 키 =
        // 셀 (y, x) (offset 전 좌표; 같은 row 는 같은 트랙 y 라 f32 동등 비교 안전).
        let mut first_item_baseline: f32 = BASELINE_NONE;
        let mut first_item_key: (f32, f32) = (f32::INFINITY, f32::INFINITY);
        for (i, &c) in children.iter().enumerate() {
            let off = i * 4;
            let (x, y, w, h) = (bounds[off], bounds[off + 1], bounds[off + 2], bounds[off + 3]);
            // 자식을 셀 크기로 재귀 solve → 자식 실제 크기(explicit/content) 회수.
            //
            // 측정 pass 가 **컨테이너 크기**로 서브트리를 풀어 clean 으로 만들어 놨으면, 셀
            // 크기가 다른데도 그대로 부르면 증분 skip 이 stale 캐시를 돌려준다 (solve_flex 의
            // used_main 재-solve 와 동형 — 거기도 `mark_subtree_dirty` 로 되살린다).
            //
            // 증상: `240px 1fr` grid 의 두 번째 칸(1680)에 `width:100%` 자식을 넣으면 자식이
            // 컨테이너 폭(1920)을 그대로 쓴다 — 셀 자신은 bounds 로 덮어써지므로 **자식만**
            // 어긋나 눈에 잘 안 띈다. 프레임을 페이지에 적용한 뒤 content 슬롯에 요소를 넣으면
            // sidebar 폭이 빠지지 않는 형태로 드러났다 (2026-07-27).
            //
            // 셀 크기가 측정 available 과 같으면 되살리지 않는다 — 증분 재사용 보존.
            const CELL_RESOLVE_EPS: f32 = 0.5;
            if measured_with_container
                && ((w - container_w).abs() > CELL_RESOLVE_EPS
                    || (h - container_h).abs() > CELL_RESOLVE_EPS)
            {
                self.mark_subtree_dirty(c);
            }
            let (cw, ch) = self.solve_node(c, w, h);
            // 자식 **명시(definite) 크기** 여부 — auto/미설정/intrinsic 센티넬은 0.
            //   stretch 하 explicit dimension respect 판정에 쓴다(아래 세로축). percentage/
            //   calc 는 셀(w,h) 기준 resolve → definite 로 취급(CSS grid area 는 definite).
            let (child_ew, child_eh) = self.resolve_self_size(c, w, h);
            let cstyle = self.get(c).map(|n| n.style.clone()).unwrap_or_default();
            // **intrinsic 키워드도 "크기가 auto 가 아니다"** — CSS-ALIGN-3 §4.1 은 stretch 를
            //   "the item's size in that axis is `auto`" 일 때로 한정한다. `fit-content` /
            //   `min-content` / `max-content` 는 auto 가 아니므로 stretch 대상이 아닌데,
            //   `resolve_self_size` 는 이들을 길이로 풀 수 없어 0(=미설정)을 돌려준다.
            //   그래서 명시 px 는 존중받는데 키워드만 셀 폭으로 늘어났다 — 실측(트랙 150,
            //   내용 min 40 / max 120): `fit-content` DOM 120 / 엔진 150, `min-content`
            //   DOM 40 / 엔진 150. 같은 자식이 flex 부모에서는 120·40 으로 정상이라
            //   **grid 축 하나**의 비대칭이었다.
            let ew_is_keyword = size_is_intrinsic_keyword(cstyle.width.as_deref());
            let eh_is_keyword = size_is_intrinsic_keyword(cstyle.height.as_deref());
            let align = grid_block_align(cstyle.align_self.as_deref(), grid_align_items);
            // 세로(block) 배치 코드 결정 (ADR-156 옵션 3-a 세로축 — §Residual "align:stretch
            //   explicit-height" 해소):
            //   - align≠stretch → 그 정렬 코드(start/center/end) + 자식 실제 height.
            //   - align==stretch **인데 자식이 explicit height** → CSS 는 stretch 를 무효화하고
            //     explicit height 를 유지 + start(top) 정렬 (definite size 가 stretch 를 이김).
            //   - align==stretch + auto height → 셀 채움(h) (기본 stretch — auto-height 자식만).
            //   live grid(ProgressBar/Meter/Slider)는 각 auto row 를 자식 intrinsic 으로 sizing
            //   → 자식 explicit height == 셀 height → free=0 → 무회귀. row 안에 키 큰 형제가 있어
            //   짧은 explicit 자식이 셀보다 작을 때만 top 정렬로 갈린다(CSS 정합).
            //
            // margin 은 **양축 모두** 그리드 영역 안에서 소비된다 (CSS-GRID §10.1 — 영역이
            //   containing block, §10.2 — auto margin 이 정렬보다 먼저 여유를 흡수). `%` 는
            //   양축 다 영역의 **인라인** 크기 기준(CSS §8.3)이라 ctx 는 셀 폭 하나다.
            let mctx = self.ctx_for(w);
            let hctx = self.ctx_for(h);
            let margin = GridItemMargin::resolve(&cstyle, &mctx);
            let (fy, fh) = place_grid_axis(GridAxisInput {
                cell_pos: y,
                cell_size: h,
                real_size: ch,
                explicit: child_eh > 0.0 || eh_is_keyword,
                align,
                m_start: margin.top,
                m_end: margin.bottom,
                m_start_auto: margin.top_auto,
                m_end_auto: margin.bottom_auto,
                min: resolve_dimension_opt(cstyle.min_height.as_deref(), &hctx),
                max: resolve_dimension_opt(cstyle.max_height.as_deref(), &hctx),
            });
            // E2 justify(가로) — grid_block_align(세로) 대칭 (ADR-156 옵션 3-a). justify≠stretch
            //   이고 자식이 실제 width(cw>0, explicit/content)를 가지면 셀 안 start/center/end 로
            //   배치. `cw>0` 가드: auto-width 자식(cw=0, 콘텐츠 폭 미지정)은 stretch 로 셀을 채워
            //   0 붕괴 방지(intrinsic shrink-to-fit justify 는 JS 협업 필요 — §Residual). 기본
            //   stretch 는 셀 폭 채움 유지. **컨테이너 auto-width(max_right)는 셀 우변 x+w 기준
            //   유지** — 트랙 extent 이 컨테이너 폭이지 자식 배치가 아님(CSS grid 계약).
            //
            // **가로축도 explicit dimension 이 stretch 를 이긴다** (세로축 `block_align` 과
            //   동형 — CSS-ALIGN-3 §4.1 "stretch … only if the item's size in that axis is
            //   auto"). 종전엔 `justify == 0`(기본 stretch/normal) 이면 명시 width 를 무시하고
            //   셀 폭을 그대로 썼다 — `width:40px` grid item 이 150 트랙에서 150 이 되는 식.
            //   `%`/min-max clamp 도 같이 삼켜졌다(50% → 150, maxWidth:60 → 150).
            let justify = grid_inline_justify(cstyle.justify_self.as_deref(), grid_justify_items);
            let (fx, fw) = place_grid_axis(GridAxisInput {
                cell_pos: x,
                cell_size: w,
                real_size: cw,
                explicit: child_ew > 0.0 || ew_is_keyword,
                align: justify,
                m_start: margin.left,
                m_end: margin.right,
                m_start_auto: margin.left_auto,
                m_end_auto: margin.right_auto,
                min: resolve_dimension_opt(cstyle.min_width.as_deref(), &mctx),
                max: resolve_dimension_opt(cstyle.max_width.as_deref(), &mctx),
            });
            max_right = max_right.max(x + w);
            if let Some(n) = self.get_mut(c) {
                let child_baseline = n.layout.baseline;
                n.layout = NodeLayout {
                    x: fx + off_x,
                    y: fy + off_y,
                    width: fw,
                    height: fh,
                    baseline: child_baseline,
                };
                if child_baseline >= 0.0
                    && (y < first_item_key.0
                        || (y == first_item_key.0 && x < first_item_key.1))
                {
                    first_item_key = (y, x);
                    first_item_baseline = fy + off_y + child_baseline;
                }
            }
        }

        // 컨테이너 크기: 명시 있으면 명시, 없으면 셀 bounding box.
        //
        // **intrinsic 경로는 트랙 extent** 를 쓴다 — 셀 bounding box 는 자식이 **점유한**
        // 칸까지만이라 빈 트랙이 빠진다. CSS 는 빈 트랙도 자리를 차지한다 (실측
        // `1fr 1fr` + 자식 1개 / max-content → DOM 240, 점유 셀 기준이면 120).
        // definite 경로의 `max_right` 는 기존 계약 그대로 둔다.
        let final_w = if explicit_w > 0.0 {
            explicit_w
        } else if inline_intrinsic.is_some() {
            // auto 축 반환은 **content-box** — 부모 커널이 자식의 pad_border 를 더한다.
            // 여기서 더하면 이중 계산이다 (실측 padding 10 grid: DOM 140 / 구 엔진 160).
            container_w
        } else {
            max_right
        };
        // **블록 크기도 트랙 extent** 다 (CSS-GRID §11.1) — 셀 bounding box 가 아니다.
        // 셀 bbox 는 (a) 빈 트랙을 빼먹고 (b) 트랙보다 큰 자식을 따라 늘어난다. CSS 는 둘 다
        // 아니다 — 넘치는 자식은 흘러넘치고(실측 30px 행 + 100px 자식 → DOM 30), 자식 없는
        // 트랙도 자리를 차지한다(실측 `30px 40px` + 자식 1개 → DOM 70). 자식 margin 도
        // 컨테이너를 늘리지 않는다(실측 marginBottom:50 → DOM 30).
        let final_h = if explicit_h > 0.0 {
            explicit_h
        } else {
            row_extent.unwrap_or(0.0)
        };

        // **인라인 축도 shrink-to-fit 확정 뒤 재-solve** (block/flex 와 동일 — CSS-SIZING-3 §5.1).
        //
        // 판정은 `inline_intrinsic` 이다 — `width: max-content` 처럼 **키워드**로 shrink-to-fit
        // 인 경우 상속 available 은 definite 라 block/flex 의 게이트로는 안 잡힌다.
        // 블록 축 clamp 재진입보다 **먼저** 둔다 (CSS 도 인라인 축이 먼저 확정된다).
        //
        // **재진입은 원본 토큰으로 §12.5→§12.6→§12.7.1→§12.8 을 다시 돈다** (2026-07-28 —
        // 구 freeze 제거). 종전엔 px 로 확정한 트랙을 얼려 넘겼는데, 그건 `fr` 이 확정 폭을
        // 재분배하던 결함(§12.7.1 base 부재)의 우회였다. 이제 단독 `fr` 이 `minmax({기여}px,
        // fr)` 로 공급되어 freeze-restart 가 같은 결과를 **알고리즘으로** 낸다 (`1fr 1fr`/
        // min-content 70 → hf 35 → base 40 freeze → 40·30). freeze 를 걷어내면 clamp 로
        // 커진 컨테이너의 §12.8 auto 트랙 stretch 와 줄어든 컨테이너의 min-content floor 재계산이
        // 함께 살아난다 (실측 `w=min-content+minW200`: Chrome 트랙 130/70 / freeze 는 90/30).
        // 2차 pass 는 `explicit_w > 0` 이라 `inline_intrinsic` 게이트가 닫혀 1회로 끝난다.
        //
        // 행은 얼리지 않는다 — 폭이 바뀌면 높이는 다시 재는 것이 맞다(height-for-width).
        let inline_shrink_to_fit = explicit_w <= 0.0
            && inline_intrinsic.is_some()
            && intrinsic_mode(avail_w).is_none()
            && !children.is_empty();
        if let Some(settled) = shrink_to_fit_settled(
            inline_shrink_to_fit,
            final_w,
            own_pb_h,
            resolve_dimension_opt(style.min_width.as_deref(), &parent_ctx),
            resolve_dimension_opt(style.max_width.as_deref(), &parent_ctx),
        ) {
            // **암묵 열(명시 template 없음)만 예외로 1차 pass 의 합성 px 트랙을 얹는다** —
            // 재-run 할 원본 토큰 자체가 없어 definite 경로가 grid.rs 기본 트랙(100)으로
            // 떨어진다. 명시 토큰이 있으면 그대로 재-run (위 주석의 §12.5~§12.8 재계산).
            let implicit_cols = style
                .grid_template_columns
                .as_deref()
                .map(|v| v.is_empty())
                .unwrap_or(true);
            let saved_cols = style.grid_template_columns.clone();
            if implicit_cols {
                let synthesized: Vec<String> =
                    template_cols.split_whitespace().map(String::from).collect();
                if !synthesized.is_empty() {
                    if let Some(n) = self.get_mut(handle) {
                        n.style.grid_template_columns = Some(synthesized);
                    }
                }
            }
            for &c in children {
                self.mark_subtree_dirty(c);
            }
            self.trace_push(handle, || TraceEvent::ShrinkToFitReentry {
                axis: Axis::Inline,
                settled,
            });
            let (_, h2) = self.solve_grid(handle, children, settled, explicit_h, avail_w, avail_h);
            // min/max clamp 바인딩 시 used = clamp 뒤 값 (군집 A — content-box 계약 유지).
            let report_w = if (settled - own_pb_h - final_w).abs() > f32::EPSILON {
                settled - own_pb_h
            } else {
                final_w
            };
            if let Some(n) = self.get_mut(handle) {
                if implicit_cols {
                    n.style.grid_template_columns = saved_cols;
                }
                n.layout.width = report_w;
            }
            return (report_w, h2);
        }

        // **블록 축도 min/max clamp 뒤가 used size** (flex 3.6/3.7 과 같은 규칙).
        //
        // grid 는 트랙 sizing 자체가 definite 여부에 매달려 있다 — `1fr` 행, `align-content`,
        // §12.8 auto 트랙 stretch 셋 다 `explicit_h > 0.0` 게이트다. 그래서 clamp 된 크기로
        // **한 번 다시 푸는** 것이 유일하게 온전한 반영이고, 그때는 게이트가 자연히 열린다.
        //
        // 실측(2026-07-28): `minHeight:400` + `rows: 60px 1fr` 이 Chrome 60/340 / 구 엔진
        // 60/60. `height` 를 주던 시절엔 우연히 맞았지만, body 를 `min-height` 로 옮기면
        // 그 우연이 사라진다.
        //
        // 재진입은 1회로 끝난다 — 두 번째 호출은 `explicit_h > 0.0` 이라 이 분기를 건너뛴다.
        // 재진입 전 자식 subtree 를 dirty 로 되돌린다: 1차 pass 가 자식을 clean 으로 만들어
        // (`solve_*` 말미 `dirty=false`) 그대로 부르면 증분 skip 이 stale 캐시를 돌려준다.
        if explicit_h <= 0.0 {
            let ctx_h = self.ctx_for(avail_h);
            let min_h = resolve_dimension_opt(style.min_height.as_deref(), &ctx_h);
            let max_h = resolve_dimension_opt(style.max_height.as_deref(), &ctx_h);
            if min_h.is_some() || max_h.is_some() {
                let mut used = final_h;
                if let Some(mn) = min_h {
                    used = used.max(spec_to_content(mn, own_pb_v));
                }
                if let Some(mx) = max_h {
                    used = used.min(spec_to_content(mx, own_pb_v));
                }
                let used = used.max(0.0);
                if (used - final_h).abs() > 0.5 {
                    for &c in children {
                        self.mark_subtree_dirty(c);
                    }
                    return self.solve_grid(
                        handle,
                        children,
                        explicit_w,
                        used + own_pb_v,
                        avail_w,
                        avail_h,
                    );
                }
            }
        }

        if let Some(n) = self.get_mut(handle) {
            n.layout = NodeLayout {
                x: 0.0,
                y: 0.0,
                width: final_w,
                height: final_h,
                baseline: first_item_baseline,
            };
            n.dirty = false;
            n.subtree_dirty = false;
        }
        (final_w, final_h)
    }

    /// 자식들의 grid placement 를 grid.rs `parse_placements` 파이프 형식으로 직렬화.
    ///
    /// 자식당 한 줄 `area_name|grid_column|grid_row` (개행 구분). NodeStyle 은
    /// gridArea 이름 필드가 없으므로 area_name 은 항상 빈 문자열. grid_column/row 는
    /// `grid_column_start`+`grid_column_end` 를 grid.rs `parse_grid_line` 결합 형식
    /// (`"{start} / {end}"`)으로 재조립 — start 만 있으면 start 만, 둘 다 없으면 빈
    /// 문자열(auto-placement). placement 가 하나도 없으면 빈 문자열 반환(전부 auto).
    fn build_grid_placement_spec(&self, children: &[usize]) -> String {
        let mut lines: Vec<String> = Vec::with_capacity(children.len());
        let mut any_placement = false;
        for &c in children {
            let cstyle = self.get(c).map(|n| n.style.clone()).unwrap_or_default();
            let grid_column = combine_grid_line(
                cstyle.grid_column_start.as_deref(),
                cstyle.grid_column_end.as_deref(),
            );
            let grid_row = combine_grid_line(
                cstyle.grid_row_start.as_deref(),
                cstyle.grid_row_end.as_deref(),
            );
            if !grid_column.is_empty() || !grid_row.is_empty() {
                any_placement = true;
            }
            // area_name 항상 빈 문자열 (NodeStyle 에 gridArea 이름 없음).
            lines.push(format!("|{grid_column}|{grid_row}"));
        }
        if any_placement {
            lines.join("\n")
        } else {
            String::new() // 전부 auto → placement_spec 비움 (grid.rs auto-placement)
        }
    }

    /// % 기준 컨텍스트 (container_size = avail).
    fn ctx_for(&self, avail: f32) -> CssValueContext {
        CssValueContext {
            parent_size: None,
            container_size: Some(avail),
            viewport_width: None,
            viewport_height: None,
            root_font_size: None,
        }
    }

    /// 노드 명시 크기(width/height) 해결. auto/미설정/음수 센티넬은 0.
    ///
    /// 반환값은 border-box (specified 그대로) — leaf 최종 layout 크기. px/percent
    /// 무관하게 동일 경로(`resolve_dimension`→`resolve_css_size_value`)를 거쳐
    /// "해석된 px" 가 곧 border-box 값이다 — 이 함수 자체는 pad_border 를 감산하지
    /// 않는다(자신의 padding 은 자신의 outer 크기에 영향 없음, CSS 계약과 동일).
    /// 컨테이너가 *자식에게 넘기는 available* 감산은 `spec_to_content` 가 별도 담당.
    fn resolve_self_size(&self, handle: usize, avail_w: f32, avail_h: f32) -> (f32, f32) {
        let Some(node) = self.get(handle) else {
            return (0.0, 0.0);
        };
        let ctx_w = self.ctx_for(avail_w);
        let ctx_h = self.ctx_for(avail_h);
        let w = resolve_dimension(node.style.width.as_deref(), &ctx_w);
        let h = resolve_dimension(node.style.height.as_deref(), &ctx_h);
        (w, h)
    }

    /// 노드의 `width` 가 intrinsic 키워드(min/max/fit-content)면 해당 센티넬 반환.
    ///
    /// 컨테이너 키워드 폭 해소 (solve_node — ADR-170 군집 B) 의 판정 전용. 명시
    /// px/% 나 auto/미설정은 `None`.
    fn width_intrinsic_keyword(&self, handle: usize, avail_w: f32) -> Option<f32> {
        let node = self.get(handle)?;
        let raw = node.style.width.as_deref().map(str::trim).filter(|s| !s.is_empty())?;
        if raw.eq_ignore_ascii_case("auto") {
            return None;
        }
        let v = resolve_css_size_value(raw, &self.ctx_for(avail_w))?;
        (v == MIN_CONTENT || v == MAX_CONTENT || v == FIT_CONTENT).then_some(v)
    }

    /// leaf 폭 intrinsic 해석 (ADR-165 — CSS-SIZING-3 §5).
    ///
    /// TS 가 공급한 측정 스칼라(`content_min_width`=최장 단어 / `content_max_width`=
    /// 단일줄, content-box px)로 width 키워드를 해석한다. 스칼라 부재 시 `explicit_w`
    /// 그대로 (기존 동작 — TS 폭 주입 의존 leaf 무영향). 반환은 border-box.
    ///
    /// - `auto`: max-content 를 content 제안값으로 반환 — 부모 content 슬롯
    ///   (flex basis fallback / block shrink-to-fit) 소비용. block-level stretch·
    ///   flex 최종 크기는 부모 배치가 소유하므로 이 값이 최종 폭을 강제하지 않는다.
    /// - `fit-content`: `clamp(min-content, stretch-fit, max-content)` —
    ///   stretch-fit = avail − margins (avail indefinite 면 max-content).
    /// - `min-content` / `max-content`: 해당 스칼라.
    /// - 명시 크기(px/%/…): `explicit_w` 그대로 (기존 경로).
    fn resolve_leaf_intrinsic_width(&self, handle: usize, explicit_w: f32, avail_w: f32) -> f32 {
        let Some(node) = self.get(handle) else {
            return explicit_w;
        };
        let s = &node.style;
        let (min_raw, max_raw) = (s.content_min_width, s.content_max_width);
        if min_raw.is_none() && max_raw.is_none() {
            return explicit_w;
        }
        // 한쪽만 공급되면 다른 쪽으로 보정 (min ≤ max 불변식 유지).
        let min_c = min_raw.or(max_raw).unwrap_or(0.0).max(0.0);
        let max_c = max_raw.or(min_raw).unwrap_or(0.0).max(min_c);
        let ctx = self.ctx_for(avail_w);
        let pad_border_h = axis_pad_border(s, &ctx, true);
        let raw = s.width.as_deref().map(str::trim).unwrap_or("");
        let sentinel = if raw.is_empty() || raw.eq_ignore_ascii_case("auto") {
            None
        } else {
            resolve_css_size_value(raw, &ctx)
        };
        match sentinel {
            // 명시 크기 — 기존 경로 그대로.
            Some(n) if n >= 0.0 => explicit_w,
            Some(n) if n == MIN_CONTENT => min_c + pad_border_h,
            Some(n) if n == MAX_CONTENT => max_c + pad_border_h,
            Some(n) if n == FIT_CONTENT => {
                let m_l = resolve_signed(s.margin_left.as_deref(), &ctx);
                let m_r = resolve_signed(s.margin_right.as_deref(), &ctx);
                let stretch_fit = if avail_w > 0.0 {
                    (avail_w - m_l - m_r - pad_border_h).max(0.0)
                } else {
                    // avail indefinite → max-content (CSS-SIZING-3 §5).
                    // 측정 모드에서는 그 모드의 값이 stretch-fit 자리를 대신한다
                    // (min-content 측정 중인 `fit-content` 상자는 min-content 로 접힌다).
                    match intrinsic_mode(avail_w) {
                        Some(IntrinsicMode::Min) => min_c,
                        _ => max_c,
                    }
                };
                stretch_fit.clamp(min_c, max_c) + pad_border_h
            }
            // auto (None) / 해석 불가 — content 제안값 = max-content.
            //   단 min-content 측정 패스에서는 min-content 를 낸다 (ADR-169 Phase 1).
            //   컨테이너는 이 leaf 값을 기존 집계 경로 그대로 합/최대로 모으므로,
            //   모드 분기는 **leaf 한 곳**에만 있으면 서브트리 전체에 전파된다.
            _ if intrinsic_mode(avail_w) == Some(IntrinsicMode::Min) => min_c + pad_border_h,
            _ => max_c + pad_border_h,
        }
    }

    // ── 결과 수집 (taffy_bridge.rs get_layouts_batch 대응) ──

    /// 여러 노드의 레이아웃을 flat `[x0,y0,w0,h0,b0, x1,y1,w1,h1,b1, ...]` 로 수집
    /// (ADR-923 Phase 2 — handle 당 **5값**, b = baseline). 무효 handle 은 `[0,0,0,0,0]`.
    ///
    /// baseline 은 경계 계약값으로 해소해 내보낸다 — 원천 없으면 height(bottom 폴백,
    /// CSS 2.1 §10.8.1). 내부 센티널(`BASELINE_NONE`)은 경계를 넘지 않는다.
    pub fn get_layouts_batch(&self, handles: &[usize]) -> Vec<f32> {
        let mut out = Vec::with_capacity(handles.len() * 5);
        for &h in handles {
            let l = self.get(h).map(|n| n.layout).unwrap_or(NodeLayout::ZERO);
            out.extend_from_slice(&[l.x, l.y, l.width, l.height, l.resolved_baseline()]);
        }
        out
    }

    /// 단일 노드 레이아웃 조회 (진단/테스트용).
    pub fn get_layout(&self, handle: usize) -> NodeLayout {
        self.get(handle).map(|n| n.layout).unwrap_or(NodeLayout::ZERO)
    }
}

/// dimension 값 해결 — 명시 크기(px/%/vw/calc…)면 그 값, auto/미설정/음수면 0.
///
/// auto/intrinsic(fit/min/max-content 센티넬) 은 0 — solve 가 content 로 채운다.
fn resolve_dimension(value: Option<&str>, ctx: &CssValueContext) -> f32 {
    match value {
        Some(v) => {
            let trimmed = v.trim();
            if trimmed.is_empty() || trimmed.eq_ignore_ascii_case("auto") {
                return 0.0;
            }
            match resolve_css_size_value(trimmed, ctx) {
                // 음수 센티넬(fit/min/max-content)은 현재 0 (content 로 대체).
                Some(n) if n >= 0.0 => n,
                _ => 0.0,
            }
        }
        None => 0.0,
    }
}

// ─── display 분류 + CSS 키워드 → flex.rs u8 매핑 ──────────────────────
//
// flex.rs 는 순수 계산 커널이라 CSS 문자열 파싱을 하지 않는다(WASM 경계에서 JS 가
// u8 전달). tree.rs 가 그 경계 역할을 이어받아 CSS 키워드를 flex.rs 상수와
// 일치하는 u8 로 매핑한다. 상수 값은 flex.rs 정의와 동일해야 함(리터럴 대조).

/// 컨테이너 formatting context 분류.
///
/// 단위 2 는 Flex, 단위 3-a 는 Block, 단위 3-b 는 Grid 실배치. `_hasChildren`
/// 컨테이너의 CSS 기본 display 는 block 이므로(display 미설정 → block),
/// non-flex/non-grid 는 Block 으로 취급한다.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
enum ContainerDisplay {
    Flex,
    Block,
    Grid,
}

/// display 문자열 → 컨테이너 분류 — `display::parse_display(d).inner` 만 본다 (ADR-923
/// Phase 1). outer(inline/block) 는 **부모의 line item 판정** 몫이라 여기서 무관하다.
///
/// - inner Flex (flex/inline-flex) → Flex (단위 2)
/// - inner Grid (grid/inline-grid) → Grid (단위 3-b)
/// - inner Flow/FlowRoot/None (block/inline/inline-block/flow-root/none/list-item/미설정/
///   미인식 → `parse_display` block 폴백) → Block (단위 3-a)
///
/// display 미설정(None)이 Block 인 이유: CSS 초기 display 는 inline 이지만
/// composition 의 `_hasChildren` 컨테이너는 상단(taffyDisplayAdapter)에서 blockify
/// 되어 내려온다 — tree.rs 는 순수화된 스타일을 받으므로 컨테이너=block 이 기본.
fn classify_container_display(display: Option<&str>) -> ContainerDisplay {
    container_display_of(display::parse_display(display))
}

/// [`Display`] 이원 구조 → 컨테이너 solver (inner 만).
fn container_display_of(d: Display) -> ContainerDisplay {
    match d.inner {
        InnerDisplay::Flex => ContainerDisplay::Flex,
        InnerDisplay::Grid => ContainerDisplay::Grid,
        InnerDisplay::Flow | InnerDisplay::FlowRoot | InnerDisplay::None => ContainerDisplay::Block,
    }
}

/// flex-direction → flex.rs DIR_ROW(0)/DIR_COLUMN(1). row-reverse/column-reverse
/// 는 축만 매핑 — reverse 는 배치 후 `solve_flex` 가 main 축 반사로 처리(E8).
fn parse_flex_direction(v: Option<&str>) -> u8 {
    match v.map(|s| s.trim().to_ascii_lowercase()).as_deref() {
        Some("column") | Some("column-reverse") => flex::DIR_COLUMN,
        _ => flex::DIR_ROW,
    }
}

/// flex-direction 이 `row-reverse`/`column-reverse` 인가 (E8/ADR-156 P4).
/// reverse 는 정방향 배치 결과를 main 축으로 반사해 구현한다 (순수 기하 — flex.rs
/// 커널·golden 계약 무변경). 반사 정의역은 컨테이너 definite main, auto 면 content extent.
fn flex_direction_is_reverse(v: Option<&str>) -> bool {
    matches!(
        v.map(|s| s.trim().to_ascii_lowercase()).as_deref(),
        Some("row-reverse") | Some("column-reverse")
    )
}

/// flex-wrap 이 `wrap-reverse` 인가 (E8). 라인 스택을 cross 축으로 반사 —
/// 라인 순서 반전 + 라인 내 align 방향 반전을 한 번에 처리한다 (CSS §5.2 cross-start/end 반전).
fn flex_wrap_is_reverse(v: Option<&str>) -> bool {
    matches!(
        v.map(|s| s.trim().to_ascii_lowercase()).as_deref(),
        Some("wrap-reverse")
    )
}

/// justify-content → flex.rs JUSTIFY_* (start=0/center=1/end=2/space-between=3/
/// space-around=4/space-evenly=5). flex.rs 상수와 리터럴 대조 일치.
fn parse_justify_content(v: Option<&str>) -> u8 {
    match v.map(|s| s.trim().to_ascii_lowercase()).as_deref() {
        Some("center") => 1,
        Some("flex-end") | Some("end") => 2,
        Some("space-between") => 3,
        Some("space-around") => 4,
        Some("space-evenly") => 5,
        // flex-start/start/normal/기타 → 0
        _ => 0,
    }
}

/// align-items → flex.rs ALIGN_* (stretch=0/start=1/center=2/end=3).
fn parse_align_items(v: Option<&str>) -> u8 {
    match v.map(|s| s.trim().to_ascii_lowercase()).as_deref() {
        Some("flex-start") | Some("start") => 1,
        Some("center") => 2,
        Some("flex-end") | Some("end") => 3,
        // stretch/normal/기타 → 0 (default stretch)
        _ => 0,
    }
}

/// align-self → flex.rs off-17 코드 (0=auto 상속 / 1=stretch / 2=start / 3=center / 4=end).
///
/// **0=auto 가 기본값**: `align-self:auto`(미지정 포함)는 컨테이너 `align-items` 상속(CSS).
/// flex.rs off 17 이 zero-init 이면 자동으로 auto 가 되므로, 미지정 자식은 항상 상속한다.
/// justify-self 는 flex item 에 무효(grid 전용, Phase 3) — 여기선 align-self 만 소비.
fn parse_align_self(v: Option<&str>) -> f32 {
    match v.map(|s| s.trim().to_ascii_lowercase()).as_deref() {
        Some("stretch") => 1.0,
        Some("flex-start") | Some("start") => 2.0,
        Some("center") => 3.0,
        Some("flex-end") | Some("end") => 4.0,
        // auto/normal/미지정/기타 → 0 (컨테이너 align-items 상속)
        _ => 0.0,
    }
}

/// grid 블록축(행) 정렬 코드 — align-self(자식) → parse_align_items 코드(0=stretch/1=start/
/// 2=center/3=end), auto/미지정은 컨테이너 align-items 상속. E2(ADR-156 Phase 3, 옵션 3-b)
/// 의 세로 배치용 — justify(가로)는 JS DFS 폭 강제로 §Residual.
fn grid_block_align(align_self: Option<&str>, container: u8) -> u8 {
    match align_self.map(|s| s.trim().to_ascii_lowercase()).as_deref() {
        Some("stretch") => 0,
        Some("flex-start") | Some("start") | Some("self-start") => 1,
        Some("center") => 2,
        Some("flex-end") | Some("end") | Some("self-end") => 3,
        // auto/normal/미지정 → 컨테이너 align-items 상속
        _ => container,
    }
}

/// justify-items → grid 인라인축(열) 코드 (stretch=0/start=1/center=2/end=3).
/// `parse_align_items` 의 가로축 대칭. LTR 에서 left→start / right→end.
fn parse_justify_items(v: Option<&str>) -> u8 {
    match v.map(|s| s.trim().to_ascii_lowercase()).as_deref() {
        Some("flex-start") | Some("start") | Some("left") => 1,
        Some("center") => 2,
        Some("flex-end") | Some("end") | Some("right") => 3,
        // stretch/normal/기타 → 0 (default stretch)
        _ => 0,
    }
}

/// grid 인라인축(열) 정렬 코드 — justify-self(자식) → parse_justify_items 코드(0=stretch/
/// 1=start/2=center/3=end), auto/미지정은 컨테이너 justify-items 상속. E2(ADR-156 옵션 3-a)
/// 의 가로 배치용 — `grid_block_align`(세로) 대칭.
fn grid_inline_justify(justify_self: Option<&str>, container: u8) -> u8 {
    match justify_self
        .map(|s| s.trim().to_ascii_lowercase())
        .as_deref()
    {
        Some("stretch") => 0,
        Some("flex-start") | Some("start") | Some("self-start") | Some("left") => 1,
        Some("center") => 2,
        Some("flex-end") | Some("end") | Some("self-end") | Some("right") => 3,
        // auto/normal/미지정 → 컨테이너 justify-items 상속
        _ => container,
    }
}

/// align-content → flex.rs ALIGN_CONTENT_* (stretch=0/start=1/center=2/end=3/
/// space-between=4/space-around=5).
fn parse_align_content(v: Option<&str>) -> u8 {
    match v.map(|s| s.trim().to_ascii_lowercase()).as_deref() {
        Some("flex-start") | Some("start") => 1,
        Some("center") => 2,
        Some("flex-end") | Some("end") => 3,
        Some("space-between") => 4,
        Some("space-around") => 5,
        // stretch/normal/기타 → 0
        _ => 0,
    }
}

/// flex-wrap → flex.rs WRAP_NOWRAP(0)/WRAP_WRAP(1). wrap-reverse 는 wrap 로 정규화.
fn parse_flex_wrap(v: Option<&str>) -> u8 {
    match v.map(|s| s.trim().to_ascii_lowercase()).as_deref() {
        Some("wrap") | Some("wrap-reverse") => flex::WRAP_WRAP,
        _ => flex::WRAP_NOWRAP,
    }
}

/// gap 값 해결 (px/%/calc…). 미설정/auto/음수는 0.
fn resolve_gap(v: Option<&str>, ctx: &CssValueContext) -> f32 {
    resolve_dimension(v, ctx).max(0.0)
}

/// 축의 content-distribution 이 auto 트랙 stretch 를 허용하는가 (CSS-GRID-1 §12.8).
///
/// `normal`/`stretch`(및 미설정) 만 여유를 트랙에 넣는다. `start`/`center`/`end`/
/// `space-*` 는 트랙을 내용 크기로 두고 **트랙셋 전체**를 정렬한다 — Chrome 실측:
/// `auto auto` / 컨테이너 300 에서 기본은 트랙 150·150, `start` 는 40·40 후 좌측 정렬.
fn distribution_allows_stretch(v: Option<&str>) -> bool {
    matches!(v.unwrap_or("").trim(), "" | "normal" | "stretch")
}

/// CSS-GRID-1 §12.8 "Stretch auto Tracks" — 남는 **definite** 여유를 auto 트랙에 균등 분배.
///
/// `tracks` 는 intrinsic 측정이 끝난 토큰 배열(`auto` → `{측정값}px` 치환 후), `auto_idx`
/// 는 그 중 **원래 `auto` 였던** 인덱스다. 치환 후에는 토큰만 봐서 auto 였는지 알 수 없어
/// 인덱스를 따로 넘긴다.
///
/// 참여 조건은 "max 트랙 sizing 이 `auto`" 하나다 — px/%/`minmax(_,px)` 는 제외된다
/// (실측: `auto minmax(50px,80px)` 300 → auto 220 / minmax 80). `fr` 이 하나라도 있으면
/// 그것이 여유를 전부 흡수해 `free == 0` 이 되므로 **자동으로** no-op 이다 (실측:
/// `auto 1fr` → auto 는 content 40 유지). 넘칠 때(여유 음수)도 no-op — 트랙을 줄이지 않는다.
/// 트레이스용 — 확정 트랙 문자열을 px 수치로. 해소 불가 토큰(`1fr` 등이 남은 경우)은
/// `f32::NAN` 으로 남겨 "이 트랙은 아직 안 풀렸다" 를 판독자가 구분하게 한다.
/// 트레이스 게이트 안에서만 호출되므로 off 경로 비용 0.
fn parse_track_px(tracks: &[String]) -> Vec<f32> {
    tracks
        .iter()
        .map(|t| {
            t.trim()
                .strip_suffix("px")
                .and_then(|n| n.parse::<f32>().ok())
                .unwrap_or(f32::NAN)
        })
        .collect()
}

fn stretch_auto_tracks(tracks: &mut [String], auto_idx: &[usize], container: f32, gap: f32) {
    /// f32 누산 오차가 가짜 stretch 를 만들지 않게 하는 하한.
    const FREE_EPS: f32 = 0.01;

    if auto_idx.is_empty() || tracks.is_empty() || container <= 0.0 {
        return;
    }
    let resolved = grid::parse_tracks(&tracks.join(" "), container, gap);
    // `repeat(...)` 전개로 개수가 달라지면 auto_idx 대응이 깨진다 — 그때는 적용 보류.
    if resolved.len() != tracks.len() {
        return;
    }
    let used: f32 = resolved.iter().sum::<f32>() + gap * (tracks.len() as f32 - 1.0);
    let free = container - used;
    if free <= FREE_EPS {
        return;
    }
    let share = free / auto_idx.len() as f32;
    for &i in auto_idx {
        tracks[i] = format!("{}px", resolved[i] + share);
    }
}

// ── 트랙 sizing function ↔ content 기여 (CSS-GRID-1 §12.5) ──

/// 한 축의 트랙 sizing function. `<track-size>` 는 min·max 두 개로 분해된다
/// (`auto` = `minmax(auto, auto)`, `1fr` = `minmax(auto, 1fr)` 형태).
///
/// **`Definite` 는 원문 문자열을 그대로 들고 간다** — px/%/fr 의 해석은 grid.rs 가
/// 컨테이너 크기를 알고 하는 일이고, 여기서 미리 풀면 `%` 가 두 번 해석된다.
#[derive(Debug, Clone, PartialEq)]
enum SizingFn {
    /// px / % / fr — grid.rs 가 그대로 해석 (원문 보존).
    Definite(String),
    /// `auto`. **min 자리에서는 min-content, max 자리에서는 max-content** 다
    /// (CSS-GRID-1 §12.5 — 자동 최소 크기 / 최대 content 크기).
    Auto,
    MinContent,
    MaxContent,
    /// `fit-content(<len>)` — `minmax(auto, max-content)` 이되 상한을 인자로 clamp.
    FitContent(String),
}

impl SizingFn {
    fn parse(v: &str) -> SizingFn {
        let t = v.trim();
        if t.eq_ignore_ascii_case("auto") {
            SizingFn::Auto
        } else if t.eq_ignore_ascii_case("min-content") {
            SizingFn::MinContent
        } else if t.eq_ignore_ascii_case("max-content") {
            SizingFn::MaxContent
        } else if let Some(rest) = strip_fn_call(t, "fit-content") {
            SizingFn::FitContent(rest.trim().to_string())
        } else {
            SizingFn::Definite(t.to_string())
        }
    }

    /// content 기여를 소비하는가 — 아니면 측정 자체가 불필요하다.
    fn needs_contribution(&self) -> bool {
        !matches!(self, SizingFn::Definite(_))
    }
}

/// `name(...)` 형태면 괄호 안을 돌려준다. 아니면 `None`.
fn strip_fn_call<'a>(v: &'a str, name: &str) -> Option<&'a str> {
    let t = v.trim();
    let (head, rest) = t.split_at(t.find('(')?);
    if !head.trim().eq_ignore_ascii_case(name) {
        return None;
    }
    rest.strip_prefix('(')?.strip_suffix(')')
}

/// 트랙 토큰 → (min sizing, max sizing).
///
/// `minmax(a, b)` 는 그대로 분해하고, 단일 값 `x` 는 CSS 정의대로 펼친다:
/// `auto` → (auto, auto) / `1fr` → (auto, 1fr) / `min-content` → (min-content, min-content) /
/// `100px` → (100px, 100px) / `fit-content(L)` → (auto, fit-content(L)).
///
/// **`fr` 의 min 이 `auto`** 라는 점이 중요하다 — `1fr` 트랙은 자기 content 아래로
/// 줄지 않는다. 다만 본 엔진의 fr 분배(§12.7)는 그 하한을 아직 적용하지 않아,
/// 여기서도 `Definite` 로 넘겨 기존 동작을 보존한다 (§Residual).
fn split_track_sizing(token: &str) -> (SizingFn, SizingFn) {
    let t = token.trim();
    if let Some(inner) = strip_fn_call(t, "minmax") {
        let mut parts = split_top_level_comma(inner);
        let max = parts.pop().unwrap_or_else(|| "auto".to_string());
        let min = parts.pop().unwrap_or_else(|| "auto".to_string());
        return (SizingFn::parse(&min), SizingFn::parse(&max));
    }
    match SizingFn::parse(t) {
        // 단일 content 키워드는 min·max 양쪽에 같은 함수가 온다 → 트랙이 그 크기에 고정.
        SizingFn::MinContent => (SizingFn::MinContent, SizingFn::MinContent),
        SizingFn::MaxContent => (SizingFn::MaxContent, SizingFn::MaxContent),
        SizingFn::Auto => (SizingFn::Auto, SizingFn::Auto),
        f @ SizingFn::FitContent(_) => (SizingFn::Auto, f),
        d @ SizingFn::Definite(_) => {
            // 단독 `fr` = `minmax(auto, fr)` (CSS-GRID-1 §7.2.4) — min 자리는 자동
            // 최소(=min-content 기여)다 (ADR-170 군집 D). 종전엔 원문 유지라 기여
            // machinery 가 안 돌아 base 없는 순수 분배가 됐다 — `1fr 1fr`/120 에
            // 기여 90/30 이면 CSS 60→freeze 90 재시작으로 90/30 인데 엔진은 60/60.
            if let SizingFn::Definite(v) = &d {
                if parse_fr(v).is_some() {
                    return (SizingFn::Auto, d.clone());
                }
            }
            // px/% — 원문 유지.
            (d.clone(), d)
        }
    }
}

/// 괄호 depth 를 고려한 최상위 콤마 분리.
fn split_top_level_comma(v: &str) -> Vec<String> {
    let mut out = Vec::new();
    let mut depth = 0i32;
    let mut cur = String::new();
    for ch in v.chars() {
        match ch {
            '(' => {
                depth += 1;
                cur.push(ch);
            }
            ')' => {
                depth -= 1;
                cur.push(ch);
            }
            ',' if depth == 0 => out.push(std::mem::take(&mut cur)),
            _ => cur.push(ch),
        }
    }
    out.push(cur);
    out
}

/// 트랙이 content 측정을 요구하는가 (`auto`/`min-content`/`max-content`/`fit-content()`).
fn track_needs_contribution(token: &str) -> bool {
    let (mn, mx) = split_track_sizing(token);
    mn.needs_contribution() || mx.needs_contribution()
}

/// max 트랙 sizing 이 `auto` 인가 — CSS-GRID-1 §12.8 stretch 참여 조건.
///
/// `min-content`/`max-content`/`fit-content()`/`px`/`fr` 은 제외다. 실측:
/// `min-content min-content` / 컨테이너 500 → 40·40 그대로 (stretch 없음),
/// `fit-content(60px)` → 60 에서 멈춤.
fn track_max_sizing_is_auto(token: &str) -> bool {
    matches!(split_track_sizing(token).1, SizingFn::Auto)
}

/// content 기여 `(min_content, max_content)` 를 받아 트랙 토큰을 **definite 토큰**으로 해소.
///
/// 이 함수가 tree ↔ grid 층의 경계다 — 자식을 아는 tree 가 content 함수를 px 로 풀고,
/// grid.rs 는 확정된 트랙만 sizing 한다 (모듈 헤더의 "자식 intrinsic → 트랙 크기 도출은
/// 트리 레벨 책임" 계약과 같은 방향).
///
/// CSS-GRID-1 §12.4 "if the growth limit is less than the base size, increase the growth
/// limit to match" — 상한이 base 보다 작으면 base 로 끌어올린다. 그래서 `minmax(auto,80px)`
/// 은 내용이 120 이면 120 이 된다(실측 DOM 120, 상한이 밀려 올라감).
///
/// `mn` 은 이미 §6.6 자동 최소 크기 clamp 가 **아이템 단위로** 적용된 값이다
/// (`clamp_auto_min_contribution`) — 그 clamp 는 아이템의 선호 크기가 `auto` 처럼 동작할
/// 때만 걸려서, 트랙 토큰만 보고는 판정할 수 없다.
fn resolve_track_with_contribution(token: &str, mn: f32, mx: f32) -> String {
    let (min_fn, max_fn) = split_track_sizing(token);
    if !min_fn.needs_contribution() && !max_fn.needs_contribution() {
        return token.trim().to_string();
    }

    let base = match &min_fn {
        // min 자리의 `auto` = automatic minimum size (아이템 단위 clamp 반영 완료).
        SizingFn::Auto => Some(mn),
        SizingFn::MinContent => Some(mn),
        SizingFn::MaxContent => Some(mx),
        // `fit-content()` 는 min 자리에 올 수 없다(문법). 방어적으로 min-content 취급.
        SizingFn::FitContent(_) => Some(mn),
        SizingFn::Definite(_) => None,
    };

    let limit = match &max_fn {
        // max 자리의 `auto` = max-content (§12.8 stretch 는 그 뒤 별도 단계).
        SizingFn::Auto | SizingFn::MaxContent => Some(mx),
        SizingFn::MinContent => Some(mn),
        // clamp(min-content, L, max-content) — 실측 `fit-content(60)`→60 / `fit-content(200)`→120.
        SizingFn::FitContent(arg) => Some(parse_px(arg).map_or(mx, |l| l.clamp(mn.min(mx), mx))),
        SizingFn::Definite(_) => None,
    };

    match (base, limit) {
        (Some(b), Some(l)) => {
            let l = l.max(b); // §12.4 growth limit ≥ base
            if (l - b).abs() < 0.01 {
                format!("{b}px")
            } else {
                format!("minmax({b}px,{l}px)")
            }
        }
        // 한쪽만 content 기반 — 반대편은 원문(px/%/fr) 보존.
        (Some(b), None) => match &max_fn {
            SizingFn::Definite(d) => format!("minmax({b}px,{d})"),
            _ => format!("{b}px"),
        },
        (None, Some(l)) => match &min_fn {
            SizingFn::Definite(d) => format!("minmax({d},{l}px)"),
            _ => format!("{l}px"),
        },
        (None, None) => token.trim().to_string(),
    }
}

/// `"2fr"` → `Some(2.0)`. fr 이 아니면 `None`.
fn parse_fr(v: &str) -> Option<f32> {
    let n = v.trim().strip_suffix("fr")?.trim();
    let f = if n.is_empty() { 1.0 } else { n.parse::<f32>().ok()? };
    Some(if f == 0.0 { 1.0 } else { f })
}

/// intrinsic 제약 아래의 트랙 크기 (CSS-GRID-1 §12.5 + §12.6 + §12.7.1).
///
/// 컨테이너 인라인 크기가 아직 없는 상태 — `width: min-content` 류 키워드, 측정 모드
/// 센티넬, flex shrink-to-fit — 에서는 **나눠 줄 여유가 없다**. 각 트랙을 자식 기여로
/// 세우고, `fr` 은 여유를 못 받으므로 §12.7.1 "Find the Size of an fr" 로 편다.
///
/// | 트랙          | min-content 모드 | max-content 모드              |
/// | ------------- | ---------------- | ----------------------------- |
/// | `px`          | 그 값            | 그 값                         |
/// | `%`           | min-content 기여 | max-content 기여 (auto 동형)  |
/// | `auto`        | min-content 기여 | max-content 기여              |
/// | `min-content` | min-content      | min-content                   |
/// | `max-content` | max-content      | max-content                   |
/// | `fit-content` | min-content      | clamp(min, L, max)            |
/// | `minmax(a,b)` | a 의 base        | b 의 상한 (b 가 fr 이면 §12.7.1) |
/// | `fr`          | min-content 기여 | flex factor × used fraction   |
///
/// **`%` 는 auto 처럼 동작한다** — 백분율의 기준이 지금 구하려는 그 크기라 해소 불가
/// (실측 `50% auto` / max-content → 180 = 120+60, min-content → 70 = 40+30).
/// **min-content 모드에서 fr 은 펴지 않는다** — base 그대로다 (실측 `3fr 1fr` → 70).
fn grid_intrinsic_track_sizes(
    tokens: &[String],
    col_min: &[f32],
    col_max: &[f32],
    mode: IntrinsicMode,
) -> Vec<f32> {
    let mn = |i: usize| col_min.get(i).copied().unwrap_or(0.0);
    let mx = |i: usize| col_max.get(i).copied().unwrap_or(0.0);

    let mut base: Vec<f32> = Vec::with_capacity(tokens.len());
    let mut limit: Vec<f32> = Vec::with_capacity(tokens.len());
    let mut flex: Vec<Option<f32>> = Vec::with_capacity(tokens.len());

    for (i, tok) in tokens.iter().enumerate() {
        let (min_fn, max_fn) = split_track_sizing(tok);
        let b = match &min_fn {
            SizingFn::MaxContent => mx(i),
            // `auto`/`min-content`/`fit-content` + 해소 불가한 길이(%/fr) 는 전부 min-content.
            SizingFn::Definite(d) => parse_px(d).unwrap_or_else(|| mn(i)),
            _ => mn(i),
        };
        let (l, f) = match &max_fn {
            SizingFn::MinContent => (mn(i), None),
            SizingFn::Auto | SizingFn::MaxContent => (mx(i), None),
            SizingFn::FitContent(arg) => (
                parse_px(arg).map_or(mx(i), |lim| lim.clamp(mn(i).min(mx(i)), mx(i))),
                None,
            ),
            SizingFn::Definite(d) => match parse_fr(d) {
                // flexible — 상한은 무한. §12.7.1 이 뒤에서 정한다.
                Some(fr) => (f32::INFINITY, Some(fr)),
                None => (parse_px(d).unwrap_or_else(|| mx(i)), None),
            },
        };
        base.push(b);
        limit.push(l.max(b)); // §12.4 — 상한은 base 아래로 못 내려간다
        flex.push(f);
    }

    if mode == IntrinsicMode::Min {
        return base;
    }

    // §12.7.1 "Find the Size of an fr" — 여유가 미결정일 때의 used flex fraction.
    //   후보 둘: (a) 각 flexible 트랙의 base ÷ flex factor (factor ≤ 1 이면 base 그대로),
    //   (b) 그 트랙을 지나는 아이템의 max-content 기여 ÷ Σfactor (Σ < 1 이면 1 로 본다).
    //   실측: `3fr 1fr`(기여 120·60) → uff 60 → 180·60 / `0.5fr 0.5fr` → uff 120 → 60·60.
    let mut uff: f32 = 0.0;
    for (i, f) in flex.iter().enumerate() {
        let Some(fr) = *f else { continue };
        uff = uff.max(if fr > 1.0 { base[i] / fr } else { base[i] });
        uff = uff.max(mx(i) / fr.max(1.0));
    }

    (0..tokens.len())
        .map(|i| match flex[i] {
            Some(fr) => base[i].max(fr * uff),
            None => limit[i],
        })
        .collect()
}

/// `"80px"` → `Some(80.0)`. px 이외(%/calc)는 `None` — 호출부가 폴백을 정한다.
fn parse_px(v: &str) -> Option<f32> {
    v.trim().strip_suffix("px")?.trim().parse::<f32>().ok()
}

/// **고정 길이**(px/%) 트랙 값 → px. `fr`/`auto`/`calc()` 등은 `None`.
///
/// CSS-GRID-1 이 말하는 "fixed track sizing function" 판정이자 그 값이다 —
/// §6.6 의 자동 최소 크기 clamp 대상을 가른다.
fn definite_track_len(v: &str, container: f32) -> Option<f32> {
    let t = v.trim();
    if let Some(px) = parse_px(t) {
        return Some(px);
    }
    let pct = t.strip_suffix('%')?.trim().parse::<f32>().ok()?;
    Some(pct / 100.0 * container)
}

/// §6.6 clamp 상한 — **min sizing 이 `auto`** 이고 max sizing 이 고정 길이일 때만.
///
/// §6.6 은 *자동* 최소 크기(=`min-width:auto` 해소)에 대한 규정이라, min 자리에 `min-content`
/// 를 **명시**하면 대상이 아니다. 실측이 갈라 준다 — 같은 상한 20px 에서
/// `minmax(auto,20px)` → 20 이지만 `minmax(min-content,20px)` → 40.
fn track_fixed_max(token: &str, container: f32) -> Option<f32> {
    let (min_fn, max_fn) = split_track_sizing(token);
    if min_fn != SizingFn::Auto {
        return None;
    }
    match max_fn {
        SizingFn::Definite(d) => definite_track_len(&d, container),
        _ => None,
    }
}

/// 아이템의 선호 크기가 CSS 상 "`auto` 처럼 동작"하는가.
///
/// 미설정 / `auto` / **백분율**(containing block 의존) / intrinsic 키워드가 해당한다.
/// 확정 길이(`90px`)면 최소 기여가 그 크기라 §6.6 clamp 대상이 아니다.
fn preferred_size_behaves_as_auto(v: Option<&str>) -> bool {
    let Some(t) = v.map(str::trim) else {
        return true;
    };
    if t.is_empty() || t.eq_ignore_ascii_case("auto") || t.ends_with('%') {
        return true;
    }
    matches!(
        SizingFn::parse(t),
        SizingFn::MinContent | SizingFn::MaxContent | SizingFn::FitContent(_)
    )
}

/// track array(`["1fr", "auto"]`) → space-join 문자열(`"1fr auto"`).
///
/// grid.rs `tokenize_template` 이 다시 최상위 토큰으로 분해하므로 join 만 한다.
/// 각 원소가 `repeat(...)`/`minmax(...)` 같은 복합 표현이어도 공백 없는 단일 토큰
/// 이라 join 후 재토큰화가 무손실(괄호 depth 기반 tokenize). 미설정/빈 배열은 "".
fn join_tracks(tracks: Option<&[String]>) -> String {
    match tracks {
        Some(list) if !list.is_empty() => list.join(" "),
        _ => String::new(),
    }
}

/// grid line start/end 를 grid.rs `parse_grid_line` 결합 형식으로 재조립.
///
/// NodeStyle 은 taffy_bridge 처럼 start/end 를 분리된 단일 값으로 보유
/// (`"1"` / `"span 2"` / `"auto"`). grid.rs `parse_grid_line` 은 결합 형식
/// (`"1 / 3"`, `"1 / span 3"`, `"span 2"`) 을 파싱하므로 재조립:
/// - start+end 둘 다 유효 → `"{start} / {end}"`
/// - start 만 → `"{start}"` (parse_grid_line 이 (start, start+1))
/// - end 만 → `"{end}"` 를 end 로 쓸 방법 없음 → auto (빈 문자열)
/// - 둘 다 없음/auto → 빈 문자열 (auto-placement)
///
/// "auto" 는 명시 line 아님 → 없는 것으로 취급(빈 부분).
fn combine_grid_line(start: Option<&str>, end: Option<&str>) -> String {
    let s = normalize_grid_line_part(start);
    let e = normalize_grid_line_part(end);
    match (s, e) {
        (Some(s), Some(e)) => format!("{s} / {e}"),
        (Some(s), None) => s,
        // end 만 있으면 start 없이 grid.rs 로 표현 불가 → auto.
        (None, _) => String::new(),
    }
}

/// grid line 단일 값 정규화 — "auto"/미설정/빈 문자열은 None(명시 아님).
/// `"1"` / `"span 2"` / `"-1"` 같은 실 line 값만 Some 으로 통과.
fn normalize_grid_line_part(v: Option<&str>) -> Option<String> {
    let v = v?.trim();
    if v.is_empty() || v.eq_ignore_ascii_case("auto") {
        return None;
    }
    Some(v.to_string())
}

/// padding+border 한 축 합 (main 또는 cross).
///
/// direction 이 row 면 main=좌우(left+right), cross=상하(top+bottom).
/// column 이면 반대. padding + border 를 각각 해결해 합산.
fn axis_pad_border(style: &NodeStyle, ctx: &CssValueContext, is_main_horizontal: bool) -> f32 {
    let (a, b, ba, bb) = if is_main_horizontal {
        (
            style.padding_left.as_deref(),
            style.padding_right.as_deref(),
            style.border_left.as_deref(),
            style.border_right.as_deref(),
        )
    } else {
        (
            style.padding_top.as_deref(),
            style.padding_bottom.as_deref(),
            style.border_top.as_deref(),
            style.border_bottom.as_deref(),
        )
    };
    resolve_dimension(a, ctx)
        + resolve_dimension(b, ctx)
        + resolve_dimension(ba, ctx)
        + resolve_dimension(bb, ctx)
}

/// 좌표 offset 용 — padding+border 의 시작 성분 (horizontal → left, 아니면 top).
/// 자식 좌표는 부모 border-box 원점 기준이므로 content 원점으로 밀어야 한다
/// (Taffy layout location 과 동일 계약).
fn pad_border_start(style: &NodeStyle, ctx: &CssValueContext, horizontal: bool) -> f32 {
    let (p, b) = if horizontal {
        (style.padding_left.as_deref(), style.border_left.as_deref())
    } else {
        (style.padding_top.as_deref(), style.border_top.as_deref())
    };
    resolve_dimension(p, ctx) + resolve_dimension(b, ctx)
}

/// pad_border 의 **끝** 성분 (horizontal → right, 아니면 bottom). 마진 상쇄 차단
/// 판정(bottom barrier)에서 padding_bottom+border_bottom 을 읽는다 (E3/ADR-156 P4).
fn pad_border_end(style: &NodeStyle, ctx: &CssValueContext, horizontal: bool) -> f32 {
    let (p, b) = if horizontal {
        (style.padding_right.as_deref(), style.border_right.as_deref())
    } else {
        (style.padding_bottom.as_deref(), style.border_bottom.as_deref())
    };
    resolve_dimension(p, ctx) + resolve_dimension(b, ctx)
}

/// overflow 한 축의 값이 **scrollable value** (scroll/auto/hidden — css-overflow-3 §3.1
/// "cause the box to be a scroll container") 인가. `visible`/`clip`/미지정 = 아니다.
///
/// scroll container 판정의 **단일 술어** (ADR-923 P3 r9h1 — 종전 3곳이 따로 갈려 flex
/// 만 clip 을 scroll container 로 오판): ① BFC 생성 (CSS 2.1 §9.4.1) ② block container
/// last baseline 강제 (css-align-3 §9.1 "block-axis scroll container … block-end margin
/// edge") ③ flex §4.5 automatic minimum (non-scrollable 만 content floor). Chrome 실측
/// clip-no-bfc · ib-overflow-clip-baseline · flex-item-clip-auto-min 이 세 소비처의 clip
/// 제외를 각각 확증한다.
fn is_scrollable_overflow(v: Option<&str>) -> bool {
    matches!(v.map(|s| s.trim().to_ascii_lowercase()).as_deref(),
        Some(o) if !o.is_empty() && o != "visible" && o != "clip")
}

/// 이 노드가 scroll container 인가 — 한 축이라도 scrollable 이면 다른 축의 visible 은
/// auto 로 계산되므로 (css-overflow-3 §3.1 computed value) 양축 판정과 같다.
fn is_scroll_container(style: &NodeStyle) -> bool {
    is_scrollable_overflow(style.overflow_x.as_deref())
        || is_scrollable_overflow(style.overflow_y.as_deref())
}

/// scroll container 는 BFC 를 생성한다 (CSS 2.1 §9.4.1 — E17/ADR-156 P4). BFC 는
/// 부모-자식 마진 상쇄를 차단한다. `clip` 제외 (r8m2) — css-overflow-3
/// §valdef-overflow-clip: hidden 과 달리 새 formatting context 를 만들지 않는다
/// (Chrome 실측 clip-no-bfc: margin 관통 탈출).
fn overflow_creates_bfc(style: &NodeStyle) -> bool {
    is_scroll_container(style)
}

/// 이 노드가 새 BFC 를 확립하는가 — scroll container + flex/grid 컨테이너.
///
/// 소비처 (r10l3 정정): ① self-collapsing 판정 제외 (Blink 는 BFC 를 self-collapsing 으로
/// 보지 않는다 — `solve_node` leaf 경로 / `solve_block` 플래그) ② block.rs 슬롯 7
/// `bfc_flag` 는 **미소비** (r9 — BFC 자식 자신의 margin 도 형제·부모와 정상 collapse,
/// Chrome bfc-sibling-top-collapse). 자기 in-flow 자식과의 collapse 차단은 `solve_block`
/// 의 `can_collapse_*`(block_is_bfc) 가 한다 — 두 층이 같은 규칙을 막지 않는다.
fn node_establishes_bfc(style: &NodeStyle) -> bool {
    if overflow_creates_bfc(style) {
        return true;
    }
    // flex/grid 컨테이너 = inner ∈ {Flex, Grid} (outer 무관 — ADR-923 Phase 1 `display.rs` 배선).
    matches!(
        display::parse_display(style.display.as_deref()).inner,
        InnerDisplay::Flex | InnerDisplay::Grid
    )
}

/// specified size(border-box, 전역 `* { box-sizing: border-box }` 계약) →
/// 커널 content 입력. pad_border 감산, 0 하한 (pad_border 초과 시 content 0 =
/// border-box 가 pad_border 로 floor — CSS 동일).
#[inline]
fn spec_to_content(v: f32, pad_border: f32) -> f32 {
    (v - pad_border).max(0.0)
}

/// 자식 스타일 + solve 된 content 크기 → flex.rs flat f32 (논리축 main/cross).
///
/// flex.rs 필드 계약(FLEX_FIELD_COUNT=19): 0=flex_basis, 1=width(main),
/// 2=height(cross), 3-6=margin(top/right/bottom/left, 물리), 7=pad_border_main,
/// 8=pad_border_cross, 9=min_main, 10=max_main, 11=min_cross, 12=max_cross,
/// 13=content_main, 14=content_cross, 15=flex_grow, 16=flex_shrink,
/// 17=align_self, 18=overflow_main(0=non-scrollable/1=scroll container — ADR-164 §4.5, r9h1),
/// 19=content_min_main(0=absent — 정확 min-content, ADR-165 §4.5 floor 정밀화).
///
/// content_main/cross 는 자식 solve 결과(cw/ch)를 direction 으로 매핑. width/height
/// 명시(>0)면 그 값, 없으면 AUTO(-1) — flex.rs 가 content 로 fallback.
///
/// specified size(width/height, min/max 동일) = border-box — intake 에서
/// `spec_to_content` 로 pad_border 감산 후 flex.rs 에 content 값으로 전달한다.
///
/// `ctx` 는 cross 축(=자식 % 의 inline containing block) 기준, `main_ctx` 는 main 축
/// 기준이다. `flex-basis` 의 `%` 는 **main 축** 컨테이너 크기를 기준으로 해소해야 하므로
/// (column 이면 height) 별도 ctx 를 받는다.
#[allow(clippy::too_many_arguments)]
fn write_flex_item(
    data: &mut [f32],
    i: usize,
    cstyle: &NodeStyle,
    cw: f32,
    ch: f32,
    is_row: bool,
    ctx: &CssValueContext,
    main_ctx: &CssValueContext,
    cross_ctx: &CssValueContext,
    reverse: MarginAxisReverse,
) {
    let off = i * flex::FLEX_FIELD_COUNT;

    // 논리축 매핑: row → main=가로(width), cross=세로(height) / column → 반대.
    // main 축은 `resolve_dimension_opt`(fit-content→AUTO), cross 축은
    // `resolve_cross_dimension_opt`(fit-content→CONTENT 센티넬 보존 → flex.rs 가
    // content_cross 로 shrink-to-fit, stretch 안 함). Calendar(column, width:fit-content)
    // 의 width 는 cross 축이므로 CONTENT 로 통과되어 부모 폭 stretch 를 회피한다.
    //
    // cross 축 `%` 는 **`cross_ctx`** 로 푼다 — 컨테이너 자신의 cross 가 auto(콘텐츠 의존)
    // 면 indefinite 라 `%` → auto (CSS §10.2). `ctx`(=available) 로 풀면 shrink-to-fit
    // 컨테이너가 자식 `100%` 를 상속 available 로 키워 되레 팽창한다 (DatePicker 350 vs 113).
    let (main_raw, cross_raw) = if is_row {
        (cstyle.width.as_deref(), cstyle.height.as_deref())
    } else {
        (cstyle.height.as_deref(), cstyle.width.as_deref())
    };
    // main 축 `%` 는 **`main_ctx`** 로 푼다 (E6/ADR-156 P2) — column 이면 main=height 라
    // percent height 가 컨테이너 **높이** 기준이어야 한다. `ctx`(폭) 로 풀면 height:50% 가
    // 폭의 50% 로 잘못 해석된다. main_ctx 는 컨테이너 height 가 명시 definite 일 때만 실축을
    // 담고(auto 면 indefinite→auto), row 면 ctx(폭) 와 동일하다(main=width).
    let main_size = resolve_dimension_opt(main_raw, main_ctx);
    let cross_size = resolve_cross_dimension_opt(cross_raw, cross_ctx);
    let (content_main, content_cross) = if is_row { (cw, ch) } else { (ch, cw) };

    let pad_border_main = axis_pad_border(cstyle, ctx, is_row);
    let pad_border_cross = axis_pad_border(cstyle, ctx, !is_row);

    // specified size 는 border-box — 논리축별 pad_border 감산 (min/max 동일).
    // CONTENT 센티넬(fit-content)은 실 크기가 아니므로 spec_to_content 감산 제외 —
    // flex.rs 가 content_cross 로 해소한다(pad/border 는 content_cross 산출에 이미 반영).
    // flex-basis: 명시값(px/%/em…) → flex.rs 가 width 보다 우선 소비.
    //   `auto`(미지정 포함) 는 AUTO(-1), `content` 는 CONTENT(-2) 센티넬 → flex.rs 가
    //   width → content 순으로 fallback. `%` 는 main 축 기준(main_ctx).
    //   basis 도 specified size = border-box → pad_border 감산 후 content 값으로 전달.
    data[off] = resolve_flex_basis(cstyle.flex_basis.as_deref(), main_ctx)
        .map(|v| {
            if v == flex::CONTENT {
                flex::CONTENT
            } else {
                spec_to_content(v, pad_border_main)
            }
        })
        .unwrap_or(-1.0);
    data[off + 1] = main_size.map(|v| spec_to_content(v, pad_border_main)).unwrap_or(-1.0);
    data[off + 2] = match cross_size {
        Some(v) if v == flex::CONTENT => flex::CONTENT,
        Some(v) => spec_to_content(v, pad_border_cross),
        None => -1.0,
    };
    // margin 은 **부호 있는** 해석(E7/ADR-156 P4) — `resolve_signed` 는 음수를 보존한다.
    // `resolve_dimension` 은 `n >= 0.0` 필터로 음수를 0 으로 뭉개, `marginLeft:-20px` 형제
    // 당김(flex main cursor)·auto-width 확장(=avail - m)이 소실됐다 (BM-1/E7-flex).
    //
    // reverse 축은 여기서 **양쪽 margin 을 맞바꿔** 커널에 정방향 논리로 넘긴다.
    // 커널은 reverse 를 모르고(3.9 반사가 tree.rs 소관), 반사는 **위치만** 뒤집지
    // margin 이 아이템의 어느 쪽에 붙는지는 못 바꾼다. 예: `row-reverse` 의 main-start
    // 는 오른쪽이라 main-start margin = physical margin-right 인데, 그대로 넘기면
    // 커널이 margin-left 를 main-start 로 써서 반사 후 margin 이 반대편에 남는다
    // (실측 2026-07-27: row-reverse + marginLeft:20px → 240, CSS 260 — 정확히 margin
    // 만큼 반대쪽). auto margin 마스크도 같이 뒤집어야 흡수 쪽이 맞는다.
    let (m_top, m_right, m_bottom, m_left) = {
        let t = resolve_signed(cstyle.margin_top.as_deref(), ctx);
        let r = resolve_signed(cstyle.margin_right.as_deref(), ctx);
        let b = resolve_signed(cstyle.margin_bottom.as_deref(), ctx);
        let l = resolve_signed(cstyle.margin_left.as_deref(), ctx);
        let (t, b) = if reverse.vertical(is_row) { (b, t) } else { (t, b) };
        let (l, r) = if reverse.horizontal(is_row) { (r, l) } else { (l, r) };
        (t, r, b, l)
    };
    data[off + 3] = m_top;
    data[off + 4] = m_right;
    data[off + 5] = m_bottom;
    data[off + 6] = m_left;
    data[off + 7] = pad_border_main;
    data[off + 8] = pad_border_cross;
    // min/max 도 축별 ctx (E6) — main(column=minHeight/maxHeight)은 main_ctx, cross(row=
    // minHeight/maxHeight)는 cross_ctx. 폭 축(minWidth 등)은 두 ctx 모두 폭 기준이라 무변경.
    data[off + 9] = resolve_dimension_opt(min_main_str(cstyle, is_row), main_ctx)
        .map(|v| spec_to_content(v, pad_border_main)).unwrap_or(-1.0);
    data[off + 10] = resolve_dimension_opt(max_main_str(cstyle, is_row), main_ctx)
        .map(|v| spec_to_content(v, pad_border_main)).unwrap_or(-1.0);
    data[off + 11] = resolve_dimension_opt(min_cross_str(cstyle, is_row), cross_ctx)
        .map(|v| spec_to_content(v, pad_border_cross)).unwrap_or(-1.0);
    data[off + 12] = resolve_dimension_opt(max_cross_str(cstyle, is_row), cross_ctx)
        .map(|v| spec_to_content(v, pad_border_cross)).unwrap_or(-1.0);
    data[off + 13] = content_main;
    data[off + 14] = content_cross;
    data[off + 15] = cstyle.flex_grow.unwrap_or(0.0).max(0.0);
    data[off + 16] = cstyle.flex_shrink.unwrap_or(1.0).max(0.0);
    // align_self (E1) — 0=auto(컨테이너 align-items 상속)/1~4 명시. flex item 은
    // justify_self 무효(grid 전용)라 여기선 align_self 만 소비.
    data[off + 17] = parse_align_self(cstyle.align_self.as_deref());
    // §4.5 automatic minimum (ADR-164) — **item 자신이** scroll container 인가 (부모 아님).
    // 한 축이 scrollable 이면 다른 축 visible 은 auto 로 계산되므로 양축 판정
    // (`is_scroll_container`). clip/visible/미지정 = 0 (zero-init 계약) → content floor
    // 유지 (r9h1 — Chrome 실측 flex-item-clip-auto-min 80 / hidden 대조군 60).
    data[off + 18] = if is_scroll_container(cstyle) { 1.0 } else { 0.0 };
    // §4.5 floor 의 정확 min-content (ADR-165) — 스칼라는 폭 축 측정값이므로 row 에서만
    // 존재 (column 의 main=height 는 height-for-width 재줄바꿈 영역 → 2-pass 잔존 계약).
    // content_main(=cw, 자식 solve 반환) 과 같은 공간이 되도록 pad_border_main 가산.
    // 0 = absent → flex.rs 가 content_main(상한 근사) fallback.
    data[off + 19] = if is_row {
        cstyle
            .content_min_width
            .map(|v| v.max(0.0) + pad_border_main)
            .unwrap_or(0.0)
    } else {
        0.0
    };
    // §8.1 auto margin 마스크 — 값 자체는 `resolve_signed` 가 0 으로 주므로, "0 인가"
    // 로는 `margin: 0` 과 구분되지 않는다. 흡수/정렬 무효화 판정을 위해 별도 채널.
    let (a_top, a_right, a_bottom, a_left) = {
        let t = is_auto_margin(cstyle.margin_top.as_deref());
        let r = is_auto_margin(cstyle.margin_right.as_deref());
        let b = is_auto_margin(cstyle.margin_bottom.as_deref());
        let l = is_auto_margin(cstyle.margin_left.as_deref());
        let (t, b) = if reverse.vertical(is_row) { (b, t) } else { (t, b) };
        let (l, r) = if reverse.horizontal(is_row) { (r, l) } else { (l, r) };
        (t, r, b, l)
    };
    let mut auto_mask = 0u32;
    if a_top {
        auto_mask |= flex::MARGIN_AUTO_TOP;
    }
    if a_right {
        auto_mask |= flex::MARGIN_AUTO_RIGHT;
    }
    if a_bottom {
        auto_mask |= flex::MARGIN_AUTO_BOTTOM;
    }
    if a_left {
        auto_mask |= flex::MARGIN_AUTO_LEFT;
    }
    data[off + 20] = auto_mask as f32;
}

/// grid item 의 4방향 margin — 값 + `auto` 여부.
struct GridItemMargin {
    top: f32,
    right: f32,
    bottom: f32,
    left: f32,
    top_auto: bool,
    right_auto: bool,
    bottom_auto: bool,
    left_auto: bool,
}

impl GridItemMargin {
    fn resolve(cstyle: &NodeStyle, ctx: &CssValueContext) -> Self {
        Self {
            top: resolve_signed(cstyle.margin_top.as_deref(), ctx),
            right: resolve_signed(cstyle.margin_right.as_deref(), ctx),
            bottom: resolve_signed(cstyle.margin_bottom.as_deref(), ctx),
            left: resolve_signed(cstyle.margin_left.as_deref(), ctx),
            top_auto: is_auto_margin(cstyle.margin_top.as_deref()),
            right_auto: is_auto_margin(cstyle.margin_right.as_deref()),
            bottom_auto: is_auto_margin(cstyle.margin_bottom.as_deref()),
            left_auto: is_auto_margin(cstyle.margin_left.as_deref()),
        }
    }
}

/// `place_grid_axis` 입력 — 필드가 많아 구조체로 (clippy too_many_arguments).
struct GridAxisInput {
    /// 그리드 영역(셀)의 시작 좌표.
    cell_pos: f32,
    /// 그리드 영역의 크기.
    cell_size: f32,
    /// 자식 solve 결과 크기.
    real_size: f32,
    /// 자식이 이 축에 **명시(definite) 크기**를 갖는가 — stretch 를 무효화한다.
    explicit: bool,
    /// 0=stretch(기본) 1=start 2=center 3=end.
    align: u8,
    m_start: f32,
    m_end: f32,
    m_start_auto: bool,
    m_end_auto: bool,
    /// 자식 자신의 min/max — grid 는 이 축 제약을 아무도 적용해 주지 않는다.
    min: Option<f32>,
    max: Option<f32>,
}

/// grid item 한 축의 배치 — 그리드 영역 안에서 margin / 정렬 / auto margin 해소.
///
/// **두 축이 완전 대칭이라 한 함수로 둔다.** 축마다 따로 두면 한쪽에만 규칙이 붙는다 —
/// 실제로 그랬다: 세로축은 "explicit 크기가 stretch 를 이긴다"(ADR-156 옵션 3-a)를
/// 받았는데 가로축은 못 받아, `width:40px` grid item 이 150 트랙에서 **150** 이 됐다
/// (Chrome 40). `%`/min-max clamp 도 같이 삼켜졌다(50% → 150, maxWidth:60 → 150).
/// margin 은 양축 다 아예 소비되지 않았다.
///
/// 규칙 (CSS-GRID §10.1/§10.2 + CSS-ALIGN-3 §4.1):
/// 1. 영역에서 margin 을 뺀 것이 가용 공간 — stretch 는 그 크기를 채운다.
/// 2. stretch 는 **크기가 auto 일 때만** 적용된다 (명시 크기가 이긴다).
/// 3. auto margin 이 있으면 stretch 하지 않고, auto margin 이 여유를 균등 흡수하며
///    정렬 속성은 그 축에서 무효가 된다 (flex §8.1 과 동형).
fn place_grid_axis(i: GridAxisInput) -> (f32, f32) {
    let avail = (i.cell_size - i.m_start - i.m_end).max(0.0);
    let auto_count = i.m_start_auto as usize + i.m_end_auto as usize;

    // `real_size <= 0` = auto 크기 자식의 intrinsic 이 0 (콘텐츠 폭 미지정). CSS 는
    //   shrink-to-fit 으로 0 이지만, 엔진은 **0 붕괴 방지**로 셀을 채운다 — intrinsic
    //   shrink-to-fit 은 JS 협업이 필요한 별도 영역(ADR-156 §Residual). 이 폴백을
    //   빼면 빈 컨테이너가 캔버스에서 사라진다.
    let stretch = (i.align == 0 && !i.explicit && auto_count == 0) || i.real_size <= 0.0;
    // 자식 자신의 min/max clamp — **stretch 든 아니든** 적용된다 (CSS §10.1: 그리드
    //   영역은 containing block 일 뿐, 자식의 min/max 를 무효화하지 않는다). block/flex
    //   부모에서는 각 커널이 이미 적용하는데 grid 만 통째로 빠져 있었다 (실측: block·flex
    //   10/10 정합, grid 5/5 발산 — `maxWidth:60` 자식이 트랙 150 을 그대로 먹는 식).
    let clamp = |v: f32| {
        let v = if let Some(mx) = i.max { v.min(mx) } else { v };
        if let Some(mn) = i.min { v.max(mn) } else { v }
    };
    if stretch {
        return (i.cell_pos + i.m_start, clamp(avail));
    }

    // **셀보다 큰 아이템은 넘친다** — 자르지 않는다 (Chrome 실측: 150 트랙 안의
    //   `width:300px` 는 300). 구 `.min(avail)` 클램프는 `min-width` 가 셀을 넘기는
    //   경우까지 삼켰다.
    let size = clamp(i.real_size);
    // 위치 정렬(center/end)은 **음수 여유를 그대로** 쓴다 (CSS-ALIGN-3 §4.2 기본 `unsafe`)
    //   — flex 축과 동일 규칙. auto margin 흡수는 음수에서 0 (흡수할 여유가 없다).
    //   Chrome 실측(셀 150 / 아이템 300): center x=-75, end x=-150.
    let free_raw = avail - size;
    let free = free_raw.max(0.0);
    let lead = if auto_count > 0 {
        let share = free / auto_count as f32;
        if i.m_start_auto { share } else { 0.0 }
    } else {
        match i.align {
            2 => free_raw / 2.0, // center
            3 => free_raw,       // end
            _ => 0.0,            // start(1) / stretch+explicit
        }
    };
    (i.cell_pos + i.m_start + lead, size)
}

/// 크기가 intrinsic **키워드**인가 (`fit-content` / `min-content` / `max-content`).
///
/// CSS 상 "auto 가 아닌 크기" 라 `justify-self`/`align-self` 의 stretch 대상에서 빠진다.
/// `resolve_self_size` 는 이들을 길이로 풀 수 없어 0 을 돌려주므로, 그 값만으로는
/// 미설정과 구분되지 않는다.
fn size_is_intrinsic_keyword(v: Option<&str>) -> bool {
    let Some(t) = v.map(str::trim) else {
        return false;
    };
    t.eq_ignore_ascii_case("min-content")
        || t.eq_ignore_ascii_case("max-content")
        || t.eq_ignore_ascii_case("fit-content")
}

/// margin 값이 `auto` 인가 — 흡수 대상 판정(§8.1 / §10.3.3 / abspos §10.3.7).
#[inline]
fn is_auto_margin(v: Option<&str>) -> bool {
    v.map(|s| s.trim().eq_ignore_ascii_case("auto"))
        .unwrap_or(false)
}

/// flex 컨테이너의 축 반전 (`*-reverse`) — 어느 **물리** margin 쌍을 맞바꿀지 결정한다.
///
/// 논리축(main/cross) → 물리축(가로/세로) 매핑이 `is_row` 에 달려 있어, 호출부가
/// 직접 물리축을 계산하지 않도록 여기서 변환한다.
#[derive(Clone, Copy)]
struct MarginAxisReverse {
    /// `flex-direction: *-reverse` — main 축 반전.
    main: bool,
    /// `flex-wrap: wrap-reverse` — cross 축 반전.
    cross: bool,
}

impl MarginAxisReverse {
    /// 세로 쌍(top↔bottom)을 맞바꿔야 하는가 — row 면 cross 축, column 이면 main 축.
    #[inline]
    fn vertical(self, is_row: bool) -> bool {
        if is_row { self.cross } else { self.main }
    }
    /// 가로 쌍(left↔right)을 맞바꿔야 하는가 — row 면 main 축, column 이면 cross 축.
    #[inline]
    fn horizontal(self, is_row: bool) -> bool {
        if is_row { self.main } else { self.cross }
    }
}

/// 자식 스타일 + solve 된 content 크기 → block.rs flat f32 (21필드, 물리축).
///
/// block.rs 필드 계약(FIELD_COUNT=21 — r10m2): 0=display(0=block/1=atomic inline-level — inline-block ·
/// inline-flex · inline-grid, ADR-923 Phase 1/2=self-collapsing — 이 함수는 0/1 만 쓰고, 코드 2 는
/// solve_block intake 가 자식 solve 플래그로 발행, r10m1),
/// 1=width(AUTO=-1/FIT_CONTENT=-2), 2=height, 3-6=margin(t/r/b/l), 7=bfc_flag,
/// 8=pad_border_v, 9=pad_border_h, 10-13=min_w/max_w/min_h/max_h(AUTO=-1),
/// 14=content_w, 15=content_h, 16=vertical_align, 17=baseline, 18=line_height(AUTO=-1),
/// 19/20=margin top/bottom 음수 성분 (r10m2 — intake 가 채움).
///
/// 논리축 변환 없음(block 은 항상 물리 vertical stacking). content_w/h 는 자식 solve
/// 결과(cw/ch)를 그대로. width/height 명시(>0)면 그 값, 없으면 AUTO(-1) — block.rs 가
/// auto→stretch(width) / auto→content(height) 로 분기. min/max 미지정도 AUTO(-1).
///
/// vertical_align/baseline (ADR-923 Phase 2 배선): valign 은 style 키워드 → u8,
/// baseline 은 자식 solve 가 기록한 `NodeLayout.baseline` (센티널 <0 = 원천 없음 →
/// block.rs 가 bottom margin edge 로 해소 — CSS 2.1 §10.8.1 r8l1 정정). line_height
/// 슬롯 18 은 px 스칼라(AUTO=-1) 를 싣지만 **S4 text run 예약 — block.rs 미소비**
/// (실소비는 컨테이너 strut 경로. r8l1/r9l2 정정 — "미소비 해소" 가 아니다).
///
/// display 코드 2 (self-collapsing box, CSS 2.1 §8.3.1) 는 intake 가 여기서 판정한다
/// (r9m2 — 종전 "block.rs 사전 분류" 서술은 발행 주체가 없어 dead 였다).
///
/// specified size(width/height, min/max 동일) = border-box — intake 에서
/// `spec_to_content` 로 pad_border 감산 후 block.rs 에 content 값으로 전달한다.
// 8번째 인자(child_baseline)는 ADR-923 Phase 2 계약 — flat 슬롯 직렬화 함수라
// 구조체 묶음이 오히려 계약 가독성을 해친다 (block.rs 필드표와 1:1 대응 유지).
#[allow(clippy::too_many_arguments)]
fn write_block_item(
    data: &mut [f32],
    i: usize,
    cstyle: &NodeStyle,
    cw: f32,
    ch: f32,
    child_baseline: f32,
    ctx: &CssValueContext,
    height_ctx: &CssValueContext,
) {
    let off = i * block::FIELD_COUNT;

    // display (ADR-923 Phase 1 — `display.rs` 이원 계약): 자식의 **outer** 가 inline 이고
    // inner 가 flow-root/flex/grid 면 1 = block 부모의 line item (inline-block · inline-flex ·
    // inline-grid — CSS 2.1 §9.2.2 atomic inline-level box). 그 외 0 = block-level box
    // (block/flex/grid 자식은 이 컨테이너 안에선 block-level — CSS 표준). 순수 `inline`
    // (inner=flow) 은 S4(B 갈래) 까지 0 유지 (요소 단위 inline 혼합 미지원). 2(self-
    // collapsing) 는 아래 필드 확정 뒤 판정.
    let display_code: f32 = if display::is_atomic_inline_level(
        display::parse_display(cstyle.display.as_deref()),
    ) {
        1.0
    } else {
        0.0
    };

    // 명시 width/height (음수=미지정 → AUTO -1). fit-content 는 FIT_CONTENT(-2)
    // 센티넬 보존 — block.rs 가 shrink-to-fit(content 폭)으로 해소한다(필드표 §1/2).
    // resolve_dimension_opt 로 붕괴시키면 auto stretch 로 오처리 → block-level
    // Calendar(width:fit-content) 가 부모 폭 전체를 차지 (tree_golden N8).
    //
    // **height 의 `%` 는 `height_ctx`** (E6/ADR-156 P2) — 컨테이너 height 가 명시 definite
    // 일 때만 실축, auto 면 indefinite→auto (CSS §10.5). `ctx`(폭) 로 풀면 height:50% 가
    // 폭의 50% 로 잘못 해소된다(BP-1/2). width 는 그대로 ctx(폭).
    let mut expl_w = resolve_cross_dimension_opt(cstyle.width.as_deref(), ctx);
    let mut expl_h = resolve_cross_dimension_opt(cstyle.height.as_deref(), height_ctx);
    // E15: aspect-ratio 파생 (ADR-156 Phase 5) — **h→w 방향만**. 폭이 auto 면 파생 폭을
    //   definite 로 표기해 부모 block 이 stretch 하지 않게 한다 (auto -1 이면 컨테이너
    //   폭으로 팽창). w→h 방향은 여기서 파생하지 않는다 — 자식 solve 가 §5.2.2 자동
    //   최소(content 하한)를 반영한 높이를 content_h 슬롯으로 공급하고, height auto 는
    //   block.rs 가 content_h 로 해소한다 (ADR-170 군집 G — intake 파생이 그 값을
    //   explicit 로 덮으면 하한이 죽는다).
    if expl_w.is_none() {
        apply_aspect_to_dims(cstyle.aspect_ratio, &mut expl_w, &mut expl_h);
    }

    let pad_border_v = axis_pad_border(cstyle, ctx, false);
    let pad_border_h = axis_pad_border(cstyle, ctx, true);

    // specified size 는 border-box — 커널은 content 수학이므로 intake 에서 감산.
    // min/max 도 CSS box-sizing 적용 대상 (상수 shift 라 content 단계 clamp 와 등가).
    // FIT_CONTENT 센티넬은 실 크기가 아니므로 감산 제외하고 그대로 통과.
    data[off] = display_code;
    data[off + 1] = match expl_w {
        Some(v) if v == flex::CONTENT => v,
        Some(v) => spec_to_content(v, pad_border_h),
        None => -1.0,
    }; // width AUTO=-1 / FIT_CONTENT=-2
    data[off + 2] = match expl_h {
        Some(v) if v == flex::CONTENT => v,
        Some(v) => spec_to_content(v, pad_border_v),
        None => -1.0,
    }; // height AUTO=-1 / FIT_CONTENT=-2
    // margin 은 **부호 있는** 해석(E7/ADR-156 P4) — 음수 보존. block.rs `collapse_margins`
    // 는 mixed/음수를 정확히 처리하고, auto width 는 `available - m_left - m_right` 로 음수
    // margin 만큼 확장(E7-block b.w 320). `resolve_dimension` 음수 0-clamp 가 이를 막았다.
    data[off + 3] = resolve_signed(cstyle.margin_top.as_deref(), ctx);
    data[off + 4] = resolve_signed(cstyle.margin_right.as_deref(), ctx);
    data[off + 5] = resolve_signed(cstyle.margin_bottom.as_deref(), ctx);
    data[off + 6] = resolve_signed(cstyle.margin_left.as_deref(), ctx);
    data[off + 7] = 0.0; // bfc_flag — E3/E17 에서 solve_block 이 자식 BFC 판정 후 override
    data[off + 8] = pad_border_v; // pad_border_v (상하)
    data[off + 9] = pad_border_h; // pad_border_h (좌우)
    data[off + 10] = resolve_dimension_opt(cstyle.min_width.as_deref(), ctx)
        .map(|v| spec_to_content(v, pad_border_h)).unwrap_or(-1.0);
    data[off + 11] = resolve_dimension_opt(cstyle.max_width.as_deref(), ctx)
        .map(|v| spec_to_content(v, pad_border_h)).unwrap_or(-1.0);
    // min/max height 의 `%` 도 height_ctx (E6) — 컨테이너 높이 기준. min/max width 는 ctx(폭).
    data[off + 12] = resolve_dimension_opt(cstyle.min_height.as_deref(), height_ctx)
        .map(|v| spec_to_content(v, pad_border_v)).unwrap_or(-1.0);
    data[off + 13] = resolve_dimension_opt(cstyle.max_height.as_deref(), height_ctx)
        .map(|v| spec_to_content(v, pad_border_v)).unwrap_or(-1.0);
    data[off + 14] = cw; // content_w
    data[off + 15] = ch; // content_h
    // ADR-923 Phase 2 — 단위 3-a "미소비" 3 슬롯 해소: 실제 style/자식 solve 값 전달.
    data[off + 16] = vertical_align_code(cstyle.vertical_align.as_deref());
    data[off + 17] = child_baseline; // <0 = 원천 없음 → block.rs 가 bottom margin edge 로 해소 (P3 §10.8.1)
    data[off + 18] = cstyle.line_height.unwrap_or(-1.0); // px 스칼라, AUTO=-1 — S4 예약 (소비는 컨테이너 strut)

    // 19/20 = adjoining 집합 음수 성분 — solve_block intake 가 탈출 chain 과 합쳐 채운다 (r10m2).
    data[off + 19] = 0.0;
    data[off + 20] = 0.0;
    // self-collapsing(코드 2) 은 여기서 판정하지 않는다 — 자식 solve 가 남긴 플래그가 단일
    // 원천 (r9m2 이중 층 교훈 · r10h1 텍스트 line box · r10m1 absolute 자식). intake 참조.
}

/// vertical-align CSS 키워드 → block.rs u8 코드 (0=baseline 1=top 2=middle 3=bottom).
///
/// 미지원 키워드(sub/super/text-top/text-bottom/`<length>`)는 baseline(0) —
/// capability matrix seed(breakdown §2.2 S6) 대상이지 silent 확장 대상이 아니다.
fn vertical_align_code(v: Option<&str>) -> f32 {
    match v.map(str::trim) {
        Some(s) if s.eq_ignore_ascii_case("top") => 1.0,
        Some(s) if s.eq_ignore_ascii_case("middle") => 2.0,
        Some(s) if s.eq_ignore_ascii_case("bottom") => 3.0,
        _ => 0.0,
    }
}

/// min_width/height 중 main 축 (row → min_width).
fn min_main_str(s: &NodeStyle, is_row: bool) -> Option<&str> {
    if is_row { s.min_width.as_deref() } else { s.min_height.as_deref() }
}
fn max_main_str(s: &NodeStyle, is_row: bool) -> Option<&str> {
    if is_row { s.max_width.as_deref() } else { s.max_height.as_deref() }
}
fn min_cross_str(s: &NodeStyle, is_row: bool) -> Option<&str> {
    if is_row { s.min_height.as_deref() } else { s.min_width.as_deref() }
}
fn max_cross_str(s: &NodeStyle, is_row: bool) -> Option<&str> {
    if is_row { s.max_height.as_deref() } else { s.max_width.as_deref() }
}

/// resolve_dimension 의 Option 변형 — 미지정/auto 는 None(AUTO 센티넬용).
fn resolve_dimension_opt(value: Option<&str>, ctx: &CssValueContext) -> Option<f32> {
    let v = value?;
    let trimmed = v.trim();
    if trimmed.is_empty() || trimmed.eq_ignore_ascii_case("auto") {
        return None;
    }
    match resolve_css_size_value(trimmed, ctx) {
        Some(n) if n >= 0.0 => Some(n),
        _ => None,
    }
}

/// `position` 이 out-of-flow(absolute/fixed)인가.
///
/// CSS: absolute/fixed 자식은 정상 흐름에서 빠져 컨테이너 크기·형제 배치·gap 에
/// 기여하지 않는다. static/relative/sticky 는 in-flow.
#[inline]
fn is_out_of_flow(position: Option<&str>) -> bool {
    matches!(position, Some("absolute") | Some("fixed"))
}

/// absolute 배치 한 축의 (위치, 크기) 산출 (CSS §10.3.7 / §10.6.4 근사).
///
/// - 양측 inset + 크기 auto → **stretch**: size = cb − start − end − margins (E11 ①).
/// - 양측 inset + 크기 definite + margin auto → 잉여 공간 분배(중앙/한쪽) (E11 ③).
/// - 한쪽 inset → 그 기준 배치 (start 우선, end 는 역산).
/// - 양측 auto → **static position** 유지 (E11 ②).
///
/// `m_*_auto` 이면 해당 margin 은 잉여 흡수용이라 `m_*` 는 0 으로 전달된다.
#[allow(clippy::too_many_arguments)]
fn resolve_abs_axis(
    pb_start: f32,
    cb_size: f32,
    start: Option<f32>,
    end: Option<f32>,
    size: f32,
    has_explicit_size: bool,
    m_start: f32,
    m_end: f32,
    m_start_auto: bool,
    m_end_auto: bool,
    static_pos: f32,
) -> (f32, f32) {
    match (start, end) {
        (Some(s), Some(e)) => {
            if !has_explicit_size {
                // ① stretch — 크기가 잉여 공간을 채운다.
                let sz = (cb_size - s - e - m_start - m_end).max(0.0);
                (pb_start + s + m_start, sz)
            } else {
                // 크기 definite + 양측 inset → over-constrained. margin auto 가 잉여를 흡수.
                let free = cb_size - s - e - size - m_start - m_end;
                let start_margin = if m_start_auto && m_end_auto {
                    free / 2.0 // ③ 중앙
                } else if m_start_auto {
                    free // 끝쪽 정렬
                } else {
                    // margin-end auto 흡수, 또는 over-constrained(end 무시) → 시작쪽 정렬.
                    m_start
                };
                (pb_start + s + start_margin, size)
            }
        }
        (Some(s), None) => (pb_start + s + m_start, size),
        (None, Some(e)) => (pb_start + cb_size - e - size - m_end, size),
        (None, None) => (static_pos + m_start, size), // ② static position
    }
}

/// inset(top/right/bottom/left) 해결 — **음수 허용**, auto/미지정은 None.
///
/// `resolve_dimension_opt` 와 달리 음수를 버리지 않는다. CSS 에서 `left:-10px` 은
/// 유효하며(컨테이닝 블록 밖으로 밀어냄), 0 으로 뭉개면 배치가 달라진다.
fn resolve_inset(value: Option<&str>, ctx: &CssValueContext) -> Option<f32> {
    let v = value?;
    let trimmed = v.trim();
    if trimmed.is_empty() || trimmed.eq_ignore_ascii_case("auto") {
        return None;
    }
    resolve_css_size_value(trimmed, ctx)
}

/// margin 등 **부호 있는** 길이 해결 — 미지정/auto/해석불가는 0.
///
/// 음수 margin 은 CSS 유효값이며, absolute 배치에서 `translate(-50%, -50%)` 를
/// 에뮬레이션하는 채널이다 (예: SliderThumb `marginLeft: -thumbSize/2`).
#[inline]
fn resolve_signed(value: Option<&str>, ctx: &CssValueContext) -> f32 {
    resolve_inset(value, ctx).unwrap_or(0.0)
}

/// E15: aspect-ratio 파생 — 한 축만 definite 이고 다른 축이 auto(None)면 ratio 로 파생한다.
///
/// `ratio = width / height` → height = width/ratio, width = height*ratio. 파생 결과를 definite
/// 로 표기해 부모 배치 커널이 auto(stretch)로 오처리하지 않게 한다. FIT_CONTENT/음수 센티넬은
/// 실 크기가 아니므로 파생 제외(양수 definite 만 대상).
#[inline]
fn apply_aspect_to_dims(aspect_ratio: Option<f32>, w: &mut Option<f32>, h: &mut Option<f32>) {
    let Some(ratio) = aspect_ratio else { return };
    if ratio <= 0.0 {
        return;
    }
    match (*w, *h) {
        (Some(wv), None) if wv > 0.0 => *h = Some(wv / ratio),
        (None, Some(hv)) if hv > 0.0 => *w = Some(hv * ratio),
        _ => {}
    }
}

/// `resolve_dimension_opt` + fit-content 보존 변형. flex cross 축 + block 자식
/// width/height intake 에서 사용 (2026-07-13 block 확장 — tree_golden N8).
///
/// 일반 `resolve_dimension_opt` 은 fit-content(음수 센티넬)를 None(→AUTO)로 붕괴시켜
/// flex cross 축에서 stretch 로 오처리한다(Calendar width:fit-content 가 부모 폭 전체로
/// stretch). 본 변형은 intrinsic 키워드 3종(fit/min/max-content)을 `CONTENT`(-2) 센티넬로
/// 통과시켜 flex.rs `parse_item` 이 content_cross(shrink-to-fit)로, block.rs 가
/// content_w/h 로 해소하게 한다 (ADR-165 — min/max-content 확장).
///
/// leaf 는 `resolve_leaf_intrinsic_width` 가 키워드 의미론(min=최장 단어 / max=단일줄 /
/// fit=clamp)을 이미 자기 content 크기(cw)에 구웠으므로 CONTENT fallback 이 그대로 정확값.
/// 컨테이너는 content bounding box 로의 shrink-to-fit 근사 (컨테이너 intrinsic 정밀화는
/// 본 ADR 범위 밖 — stretch 오처리보다 명세에 가깝다).
fn resolve_cross_dimension_opt(value: Option<&str>, ctx: &CssValueContext) -> Option<f32> {
    let v = value?;
    let trimmed = v.trim();
    if trimmed.is_empty() || trimmed.eq_ignore_ascii_case("auto") {
        return None;
    }
    match resolve_css_size_value(trimmed, ctx) {
        Some(n) if n >= 0.0 => Some(n),
        // intrinsic 키워드: flex cross 축은 content 로 shrink-to-fit (stretch 아님).
        Some(n) if n == FIT_CONTENT || n == MIN_CONTENT || n == MAX_CONTENT => {
            Some(flex::CONTENT)
        }
        _ => None,
    }
}

/// `flex-basis` 해소 — main 축 기준 ctx 를 받는다.
///
/// 반환: `Some(px)` = 명시 basis / `Some(flex::CONTENT)` = `content` 키워드 /
///       `None` = `auto`(미지정 포함) → 호출부가 AUTO(-1) 센티넬로 기록.
///
/// **Why (2026-07-14)**: `NodeStyle.flex_basis` 는 선언·역직렬화만 되고
/// `write_flex_item` 이 항상 AUTO(-1) 를 하드코딩해 **flex.rs 의 basis 해석
/// 우선순위(명시 basis → width → content)에 명시 basis 가 도달하지 못했다**
/// (`inset_*` 와 동형 silent failure — JS 는 정확히 보내고 Rust 가 안 읽음).
/// 사고: `flex:1`(basis 0%) 자식이 basis=content 로 fallback → 남은 공간을
/// 차지하지 못하고 자기 content 폭을 요구 → row-wrap 컨테이너에서 다음 줄로 밀림
/// (TagGroup `labelPosition="side"` 의 TagList).
fn resolve_flex_basis(value: Option<&str>, main_ctx: &CssValueContext) -> Option<f32> {
    let v = value?;
    let trimmed = v.trim();
    if trimmed.is_empty() || trimmed.eq_ignore_ascii_case("auto") {
        return None;
    }
    // `content` 키워드 → flex.rs CONTENT 센티넬 (content_main 으로 해소).
    if trimmed.eq_ignore_ascii_case("content") {
        return Some(flex::CONTENT);
    }
    // **`%` basis 는 main 이 indefinite 면 `content` 로 취급** (CSS §9.2.3):
    //   containing block 의 main 이 content 의존(auto)이면 `%` 를 풀 확정값이 없다.
    //   `0%`(= `flex:1` 의 shorthand 전개) 를 그대로 0 으로 두면 grow 할 free space 도
    //   없어(indefinite) item 이 **폭 0 으로 붕괴**한다 — DatePicker 안 DateInput 이
    //   trigger(width auto) 에서 w=0 이 되던 회귀 (2026-07-14).
    //   CSS 는 이 경우 basis 를 content 로 보고 intrinsic 폭을 쓴다.
    let main_indefinite = main_ctx.container_size.map(|s| s < 0.0).unwrap_or(true);
    if main_indefinite && trimmed.ends_with('%') {
        return Some(flex::CONTENT);
    }
    match resolve_css_size_value(trimmed, main_ctx) {
        Some(n) if n >= 0.0 => Some(n),
        Some(n) if n == FIT_CONTENT => Some(flex::CONTENT),
        _ => None,
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    /// ADR-156 R7/G6 — `NodeStyle` 정적 필드 계약 가드.
    ///
    /// `golden.rs::golden_field_contract_guard`(FLEX_FIELD_COUNT assert) 패턴을
    /// 승계하되, 필드 **수**만이 아니라 「선언 O · 소비 X」 축까지 코드로 고정한다.
    ///
    /// 3중 방어:
    /// 1. **전수 구조분해(`..` 금지)** — `NodeStyle` 에 필드를 추가하면 여기서 즉시
    ///    컴파일 RED. 대응: breakdown §1-3 3축 교차표(선언/소비/송신) 갱신 + 소비
    ///    여부 판정 → 미소비면 `UNCONSUMED_NODESTYLE_FIELDS` 등재. 문서 표 단독은
    ///    stale 화하므로(본 ADR 이 발견한 미소비 9필드가 어떤 가드에도 안 걸렸음)
    ///    이 구조분해가 상시성의 근거다.
    /// 2. **산술 계약** — 소비 54 + 미소비 0 = 선언 54 (breakdown §1-3 "선언 = 소비 +
    ///    미소비" 앵커). 필드를 소비 배선하며 allowlist 에서 빼면 CONSUMED_COUNT 도
    ///    함께 갱신해야 통과.
    /// 3. **미소비 allowlist** — `UNCONSUMED_NODESTYLE_FIELDS` 가 §Residual 과 1:1.
    #[test]
    fn nodestyle_field_contract_guard() {
        // (1) 전수 구조분해 — `..` 절대 금지. 필드 추가 시 컴파일 RED.
        //     소비 여부와 무관하게 54필드를 전부 명시(바인딩은 `_`)해야 통과한다.
        let NodeStyle {
            display: _,
            position: _,
            overflow_x: _,
            overflow_y: _,
            flex_direction: _,
            flex_wrap: _,
            justify_content: _,
            justify_items: _,
            align_items: _,
            align_content: _,
            flex_grow: _,
            flex_shrink: _,
            flex_basis: _,
            align_self: _,
            justify_self: _,
            grid_template_columns: _,
            grid_template_rows: _,
            grid_auto_flow: _,
            grid_auto_columns: _,
            grid_auto_rows: _,
            grid_column_start: _,
            grid_column_end: _,
            grid_row_start: _,
            grid_row_end: _,
            width: _,
            height: _,
            min_width: _,
            min_height: _,
            max_width: _,
            max_height: _,
            margin_top: _,
            margin_right: _,
            margin_bottom: _,
            margin_left: _,
            padding_top: _,
            padding_right: _,
            padding_bottom: _,
            padding_left: _,
            border_top: _,
            border_right: _,
            border_bottom: _,
            border_left: _,
            inset_top: _,
            inset_right: _,
            inset_bottom: _,
            inset_left: _,
            column_gap: _,
            row_gap: _,
            aspect_ratio: _,
            content_min_width: _,
            content_max_width: _,
            vertical_align: _,
            line_height: _,
            leaf_baseline: _,
        } = NodeStyle::default();

        // (2) 산술 계약 — 소비 + 미소비 = 선언. breakdown §1-3 "49 = 소비 40 + 미소비 9"
        //     가 Phase 2~5 배선으로 "49 = 소비 47 + 미소비 2", 옵션 3-a(2026-07-18)로
        //     "49 = 소비 49 + 미소비 0" 으로 이동했다(justify_self/justify_items 소비 전환:
        //     solve_grid grid_inline_justify). ADR-165 (2026-07-25): 측정 스칼라 2필드
        //     (content_min_width/content_max_width) 추가 — 소비처는 resolve_leaf_intrinsic_width
        //     + write_flex_item off 19 → "51 = 소비 51 + 미소비 0". ADR-923 Phase 2
        //     (2026-09-01): baseline 계약 3필드(vertical_align/line_height/leaf_baseline)
        //     추가 — 소비처는 write_block_item 슬롯 16/17 + 컨테이너 strut(line_height)
        //     + leaf solve baseline (슬롯 18 은 S4 text run 예약 — r8l1 정정) →
        //     "54 = 소비 54 + 미소비 0".
        const CONSUMED_COUNT: usize = 54;
        assert_eq!(
            CONSUMED_COUNT + UNCONSUMED_NODESTYLE_FIELDS.len(),
            NODESTYLE_FIELD_COUNT,
            "소비({CONSUMED_COUNT}) + 미소비({}) ≠ 선언({NODESTYLE_FIELD_COUNT}) — \
             필드 추가/소비 전환 시 breakdown §1-3 교차표 동반 갱신 (ADR-156 R7)",
            UNCONSUMED_NODESTYLE_FIELDS.len(),
        );

        // (3) 미소비 allowlist — 옵션 3-a 로 justify 2필드 소비 전환 후 **빈 배열**(전부 소비).
        //     신규 미소비 필드가 생기면 여기 + UNCONSUMED_NODESTYLE_FIELDS 동반 등재.
        let empty: [&str; 0] = [];
        assert_eq!(
            UNCONSUMED_NODESTYLE_FIELDS, empty,
            "미소비 필드 변경 — ADR-156 §Residual + breakdown §1-3 동반 갱신",
        );
    }

    /// BatchNodeInput 형식(`{style, children}`)의 leaf 노드 JSON 1개.
    fn style_json(width: &str, height: &str) -> String {
        format!(
            r#"{{"style":{{"width":"{width}","height":"{height}"}},"children":[]}}"#
        )
    }

    // ── handle 관리 ──

    #[test]
    fn create_and_count() {
        let mut tree = LayoutTree::new();
        let a = tree.create_node(NodeStyle::default());
        let b = tree.create_node(NodeStyle::default());
        assert_eq!(a, 0);
        assert_eq!(b, 1);
        assert_eq!(tree.node_count(), 2);
    }

    #[test]
    fn remove_recycles_handle() {
        let mut tree = LayoutTree::new();
        let a = tree.create_node(NodeStyle::default());
        let _b = tree.create_node(NodeStyle::default());
        tree.remove_node(a);
        assert_eq!(tree.node_count(), 1);
        // 재활용: 다음 create 는 해제된 handle a 를 재사용.
        let c = tree.create_node(NodeStyle::default());
        assert_eq!(c, a, "free_list 재활용 실패");
        assert_eq!(tree.node_count(), 2);
    }

    #[test]
    fn remove_invalid_handle_noop() {
        let mut tree = LayoutTree::new();
        tree.remove_node(99); // 범위 밖 — panic 없이 no-op
        assert_eq!(tree.node_count(), 0);
    }

    #[test]
    fn clear_resets() {
        let mut tree = LayoutTree::new();
        tree.create_node(NodeStyle::default());
        tree.create_node(NodeStyle::default());
        tree.clear();
        assert_eq!(tree.node_count(), 0);
        // clear 후 handle 은 0 부터 다시.
        let a = tree.create_node(NodeStyle::default());
        assert_eq!(a, 0);
    }

    // ── build_tree_batch ──

    #[test]
    fn build_flat_leaves() {
        let mut tree = LayoutTree::new();
        let json = format!(
            "[{}, {}]",
            style_json("100px", "50px"),
            style_json("200px", "80px")
        );
        let handles = tree.build_tree_batch(&json).unwrap();
        assert_eq!(handles.len(), 2);
        assert_eq!(tree.node_count(), 2);
    }

    #[test]
    fn build_parent_with_children_postorder() {
        let mut tree = LayoutTree::new();
        // post-order: 자식 2개 먼저, 부모 마지막. 부모 children=[0,1].
        let json = r#"[{"style":{"width":"10px"},"children":[]},{"style":{"width":"20px"},"children":[]},{"style":{"width":"100px"},"children":[0,1]}]"#;
        let handles = tree.build_tree_batch(json).unwrap();
        assert_eq!(handles.len(), 3);
        // 부모(마지막)의 children 이 앞선 handle 로 치환됐는지.
        let root = handles[2];
        let node = tree.get(root).unwrap();
        assert_eq!(node.children, vec![handles[0], handles[1]]);
    }

    #[test]
    fn build_parse_error() {
        let mut tree = LayoutTree::new();
        let err = tree.build_tree_batch("not json").unwrap_err();
        assert!(err.contains("parse error"), "err={err}");
    }

    #[test]
    fn build_child_index_out_of_range() {
        let mut tree = LayoutTree::new();
        // 노드 0 이 자식 [5] 참조 — post-order 위반(자식이 자기 이후).
        let json = r#"[{"style":{},"children":[5]}]"#;
        let err = tree.build_tree_batch(json).unwrap_err();
        assert!(err.contains("out of range"), "err={err}");
    }

    #[test]
    fn build_forward_reference_rejected() {
        let mut tree = LayoutTree::new();
        // 노드 0 이 자식 [1] 참조 — 1 은 아직 미처리(자기 이후) → 거부.
        let json = r#"[{"style":{},"children":[1]},{"style":{},"children":[]}]"#;
        let err = tree.build_tree_batch(json).unwrap_err();
        assert!(err.contains("out of range"), "err={err}");
    }

    #[test]
    fn flex_column_parent_single_line_child_no_height_explosion() {
        // body(flex column, height 764) > group(flex row, alignItems center, height 미지정)
        //   > 버튼(width 60, height 30).
        // 버그: group 이 align-content stretch 로 764 근처까지 팽창(ToggleButtonGroup 397).
        // 기대: group height = 자식 30.
        let mut tree = LayoutTree::new();
        // post-order: [버튼(0), group(1, children[0]), body(2, children[1])]
        let json = r#"[
            {"style":{"width":"60px","height":"30px"},"children":[]},
            {"style":{"display":"flex","flexDirection":"row","alignItems":"center"},"children":[0]},
            {"style":{"display":"flex","flexDirection":"column","height":"764px"},"children":[1]}
        ]"#;
        let handles = tree.build_tree_batch(json).unwrap();
        let body = handles[2];
        let group = handles[1];
        tree.compute_layout(body, 1200.0, 764.0);
        let gh = tree.get(group).unwrap().layout.height;
        assert!((gh - 30.0).abs() < 0.5, "group height={} (expect 30, not ~764/397)", gh);
    }

    // ── compute_layout (단위 1: leaf-only 자기 크기) ──

    #[test]
    fn compute_leaf_explicit_px() {
        let mut tree = LayoutTree::new();
        let json = format!("[{}]", style_json("120px", "40px"));
        let handles = tree.build_tree_batch(&json).unwrap();
        tree.compute_layout(handles[0], 400.0, 300.0);
        let l = tree.get_layout(handles[0]);
        assert_eq!(l.width, 120.0);
        assert_eq!(l.height, 40.0);
        assert_eq!(l.x, 0.0);
        assert_eq!(l.y, 0.0);
    }

    #[test]
    fn compute_leaf_percent() {
        let mut tree = LayoutTree::new();
        let json = format!("[{}]", style_json("50%", "25%"));
        let handles = tree.build_tree_batch(&json).unwrap();
        tree.compute_layout(handles[0], 400.0, 200.0);
        let l = tree.get_layout(handles[0]);
        assert_eq!(l.width, 200.0, "50% of 400");
        assert_eq!(l.height, 50.0, "25% of 200");
    }

    #[test]
    fn compute_leaf_auto_root_fills_width_zero_height() {
        let mut tree = LayoutTree::new();
        // E5(ADR-156 P5): block-level **root** 는 auto width 를 availW 로 fill 한다(CSS §10.3.3).
        //   auto height 는 content(leaf=0) + pad_border(0) = 0. (중첩 leaf 는 부모가 stretch —
        //   root 만 fixup_root_self_size 가 직접 채운다.)
        let json = r#"[{"style":{"width":"auto"},"children":[]}]"#;
        let handles = tree.build_tree_batch(json).unwrap();
        tree.compute_layout(handles[0], 400.0, 300.0);
        let l = tree.get_layout(handles[0]);
        assert_eq!(l.width, 400.0, "block-level root auto width → availW fill");
        assert_eq!(l.height, 0.0, "auto height, leaf content 0");
    }

    // ── E5 root 자기 크기 결함군 / E4 margin auto / E15 aspect-ratio (ADR-156 Phase 5) ──

    /// E5: root auto height = content + pad_border, auto width = availW fill.
    #[test]
    fn e5_root_auto_height_adds_padding_and_fills_width() {
        let mut tree = LayoutTree::new();
        let json = r#"[
            {"style":{"display":"block","width":"100px","height":"20px"},"children":[]},
            {"style":{"display":"block","paddingTop":"10px","paddingRight":"10px","paddingBottom":"10px","paddingLeft":"10px"},"children":[0]}
        ]"#;
        let handles = tree.build_tree_batch(json).unwrap();
        tree.compute_layout(handles[1], 300.0, -1.0);
        let r = tree.get_layout(handles[1]);
        assert_eq!(r.width, 300.0, "auto width → availW fill");
        assert_eq!(r.height, 40.0, "content 20 + padding 20");
    }

    /// E5: 무폭 flex root 가 availW 를 채운다 (block-level 컨테이너).
    #[test]
    fn e5_root_nowidth_flex_fills_available_width() {
        let mut tree = LayoutTree::new();
        let json = r#"[
            {"style":{"width":"40px","height":"20px"},"children":[]},
            {"style":{"display":"flex","flexDirection":"row"},"children":[0]}
        ]"#;
        let handles = tree.build_tree_batch(json).unwrap();
        tree.compute_layout(handles[1], 200.0, -1.0);
        assert_eq!(tree.get_layout(handles[1]).width, 200.0, "flex root fills availW");
    }

    /// E5: root auto height 자기 min/max clamp.
    #[test]
    fn e5_root_auto_height_min_max_clamp() {
        let mut up = LayoutTree::new();
        let json_min = r#"[
            {"style":{"display":"block","width":"100px","height":"30px"},"children":[]},
            {"style":{"display":"block","minHeight":"80px"},"children":[0]}
        ]"#;
        let h = up.build_tree_batch(json_min).unwrap();
        up.compute_layout(h[1], 300.0, -1.0);
        assert_eq!(up.get_layout(h[1]).height, 80.0, "minHeight clamp up");

        let mut down = LayoutTree::new();
        let json_max = r#"[
            {"style":{"display":"block","width":"100px","height":"100px"},"children":[]},
            {"style":{"display":"block","maxHeight":"50px"},"children":[0]}
        ]"#;
        let h2 = down.build_tree_batch(json_max).unwrap();
        down.compute_layout(h2[1], 300.0, -1.0);
        assert_eq!(down.get_layout(h2[1]).height, 50.0, "maxHeight clamp down");
    }

    /// E4: block 자식 가로 margin:auto → 중앙 정렬.
    #[test]
    fn e4_block_margin_auto_centers() {
        let mut tree = LayoutTree::new();
        // mid(width 200) > k(width 80, marginLeft/Right auto) → k.x = (200-80)/2 = 60.
        let json = r#"[
            {"style":{"display":"block","width":"80px","height":"20px","marginLeft":"auto","marginRight":"auto"},"children":[]},
            {"style":{"display":"block","width":"200px"},"children":[0]}
        ]"#;
        let handles = tree.build_tree_batch(json).unwrap();
        tree.compute_layout(handles[1], 300.0, -1.0);
        assert_eq!(tree.get_layout(handles[0]).x, 60.0, "margin auto 중앙");
    }

    /// E4: flex row 자식 marginLeft:auto → 잉여 공간 흡수(우측으로 밀림).
    #[test]
    fn e4_flex_margin_auto_pushes_end() {
        let mut tree = LayoutTree::new();
        // flex row(width 200) > k(width 40, marginLeft auto) → k.x = 200 - 40 = 160.
        let json = r#"[
            {"style":{"width":"40px","height":"20px","marginLeft":"auto"},"children":[]},
            {"style":{"display":"flex","flexDirection":"row","width":"200px","height":"50px"},"children":[0]}
        ]"#;
        let handles = tree.build_tree_batch(json).unwrap();
        tree.compute_layout(handles[1], 300.0, -1.0);
        assert_eq!(tree.get_layout(handles[0]).x, 160.0, "auto margin free space 흡수");
    }

    /// reverse 축의 margin start/end 역할 — 반사는 **위치만** 뒤집는다.
    ///
    /// `row-reverse` 의 main-start 는 오른쪽이므로 main-start margin = physical
    /// margin-right 다. 물리 margin 을 그대로 커널에 넘기면 margin 이 반사 후 반대편에
    /// 남는다 (Chrome 실측 260 vs 구 엔진 240 — 정확히 margin 만큼). auto 무관하게
    /// **고정 margin 에서도** 재현되는 별개 결함이라 여기서 함께 잠근다.
    #[test]
    fn reverse_axis_swaps_margin_start_end() {
        // row-reverse(width 300) > k0(40, marginLeft 20) + k1(40).
        // CSS: 아이템은 오른쪽부터 — k0 은 오른쪽 끝 260, marginLeft 20 은 k0 의 왼쪽에
        //      들어가 k1 을 200 으로 민다.
        let mut tree = LayoutTree::new();
        let json = r#"[
            {"style":{"width":"40px","height":"20px","marginLeft":"20px"},"children":[]},
            {"style":{"width":"40px","height":"20px"},"children":[]},
            {"style":{"display":"flex","flexDirection":"row-reverse","width":"300px","height":"50px"},"children":[0,1]}
        ]"#;
        let handles = tree.build_tree_batch(json).unwrap();
        tree.compute_layout(handles[2], 400.0, -1.0);
        assert_eq!(tree.get_layout(handles[0]).x, 260.0, "row-reverse: margin-left 는 main-end");
        assert_eq!(tree.get_layout(handles[1]).x, 200.0, "형제는 margin 만큼 더 밀린다");

        // column-reverse 동형 (세로 쌍 top↔bottom).
        let mut col = LayoutTree::new();
        let json_col = r#"[
            {"style":{"width":"40px","height":"40px","marginTop":"20px"},"children":[]},
            {"style":{"width":"40px","height":"40px"},"children":[]},
            {"style":{"display":"flex","flexDirection":"column-reverse","width":"300px","height":"200px"},"children":[0,1]}
        ]"#;
        let h_col = col.build_tree_batch(json_col).unwrap();
        col.compute_layout(h_col[2], 400.0, -1.0);
        assert_eq!(col.get_layout(h_col[0]).y, 160.0, "column-reverse: margin-top 은 main-end");
    }

    /// E15: aspect-ratio — 한 축 명시 + ratio 로 다른 축 파생.
    #[test]
    fn e15_aspect_ratio_derives_missing_axis() {
        let mut w2h = LayoutTree::new();
        // width 100 + ratio 2 → height 50.
        let json_w = r#"[
            {"style":{"display":"block","width":"100px","aspectRatio":2},"children":[]},
            {"style":{"display":"block","width":"300px","height":"600px"},"children":[0]}
        ]"#;
        let h = w2h.build_tree_batch(json_w).unwrap();
        w2h.compute_layout(h[1], 300.0, -1.0);
        assert_eq!(w2h.get_layout(h[0]).height, 50.0, "width 100 / ratio 2 = 50");

        let mut h2w = LayoutTree::new();
        // height 60 + ratio 3 → width 180 (부모가 stretch 하지 않아야 — write_block_item definite).
        let json_h = r#"[
            {"style":{"display":"block","height":"60px","aspectRatio":3},"children":[]},
            {"style":{"display":"block","width":"300px","height":"600px"},"children":[0]}
        ]"#;
        let h2 = h2w.build_tree_batch(json_h).unwrap();
        h2w.compute_layout(h2[1], 300.0, -1.0);
        assert_eq!(h2w.get_layout(h2[0]).width, 180.0, "height 60 * ratio 3 = 180 (no stretch)");
    }

    #[test]
    fn compute_invalid_root_noop() {
        let mut tree = LayoutTree::new();
        tree.compute_layout(99, 400.0, 300.0); // panic 없이 no-op
    }

    // ── 단위 2: post-order flex solve ──

    /// flex row 컨테이너 + 2 explicit 자식 → 좌→우 배치 (gap 0).
    #[test]
    fn flex_row_two_children_no_gap() {
        let mut tree = LayoutTree::new();
        // post-order: 자식0(100×50), 자식1(80×50), 부모(flex row).
        let json = r#"[
            {"style":{"width":"100px","height":"50px"},"children":[]},
            {"style":{"width":"80px","height":"50px"},"children":[]},
            {"style":{"display":"flex","flexDirection":"row","width":"400px","height":"60px"},"children":[0,1]}
        ]"#;
        let handles = tree.build_tree_batch(json).unwrap();
        let root = handles[2];
        tree.compute_layout(root, 400.0, 60.0);
        // 자식0: x=0, 자식1: x=100 (좌→우 누적).
        let c0 = tree.get_layout(handles[0]);
        let c1 = tree.get_layout(handles[1]);
        assert_eq!(c0.x, 0.0, "c0.x");
        assert_eq!(c0.width, 100.0, "c0.w");
        assert_eq!(c1.x, 100.0, "c1.x (100 뒤)");
        assert_eq!(c1.width, 80.0, "c1.w");
    }

    /// flex row + column_gap → 자식 사이 간격.
    #[test]
    fn flex_row_with_gap() {
        let mut tree = LayoutTree::new();
        let json = r#"[
            {"style":{"width":"100px","height":"50px"},"children":[]},
            {"style":{"width":"80px","height":"50px"},"children":[]},
            {"style":{"display":"flex","flexDirection":"row","width":"400px","height":"60px","columnGap":"20px"},"children":[0,1]}
        ]"#;
        let handles = tree.build_tree_batch(json).unwrap();
        tree.compute_layout(handles[2], 400.0, 60.0);
        let c1 = tree.get_layout(handles[1]);
        assert_eq!(c1.x, 120.0, "c1.x = 100 + 20 gap");
    }

    /// flex column → 위→아래 배치.
    #[test]
    fn flex_column_stacks_vertically() {
        let mut tree = LayoutTree::new();
        let json = r#"[
            {"style":{"width":"100px","height":"30px"},"children":[]},
            {"style":{"width":"100px","height":"40px"},"children":[]},
            {"style":{"display":"flex","flexDirection":"column","width":"200px","height":"200px"},"children":[0,1]}
        ]"#;
        let handles = tree.build_tree_batch(json).unwrap();
        tree.compute_layout(handles[2], 200.0, 200.0);
        let c0 = tree.get_layout(handles[0]);
        let c1 = tree.get_layout(handles[1]);
        assert_eq!(c0.y, 0.0, "c0.y");
        assert_eq!(c1.y, 30.0, "c1.y = c0 height 뒤");
    }

    /// height:auto flex row 컨테이너 → 자식 bounding box 로 intrinsic 도출.
    #[test]
    fn flex_container_intrinsic_height_from_children() {
        let mut tree = LayoutTree::new();
        // 부모 height 미지정(auto) → 자식 max bottom = 50 이 컨테이너 height.
        let json = r#"[
            {"style":{"width":"100px","height":"50px"},"children":[]},
            {"style":{"width":"80px","height":"40px"},"children":[]},
            {"style":{"display":"flex","flexDirection":"row","width":"400px"},"children":[0,1]}
        ]"#;
        let handles = tree.build_tree_batch(json).unwrap();
        let root = handles[2];
        tree.compute_layout(root, 400.0, -1.0); // height:auto sentinel
        let container = tree.get_layout(root);
        assert_eq!(container.width, 400.0, "명시 width 유지");
        // stretch(default align-items) 로 자식이 컨테이너 cross 로 늘어날 수 있으나,
        // 컨테이너 height 미정이면 자식 max cross(50) 가 bounding box.
        assert_eq!(container.height, 50.0, "intrinsic height = max child bottom");
    }

    /// DatePicker 실측 회귀 — `align-items:flex-start` 부모의 **width 미지정** flex 자식은
    /// 부모 폭으로 stretch 되면 안 되고 콘텐츠 폭(shrink-to-fit)이어야 한다.
    ///
    /// body(flex column, width 350, align-items:flex-start)
    ///   └ DatePicker(flex column, width 미지정)   ← CSS 124, Skia 350 발산
    ///       ├ Label(74×20)
    ///       └ trigger(flex row, width 미지정)
    ///           └ DateInput(110×20)
    ///
    /// CSS: align-items:flex-start 라 cross(=width) 가 auto 인 자식은 fit-content.
    /// 회귀 시 DatePicker/trigger 가 350 으로 팽창한다.
    #[test]
    fn flex_start_auto_cross_child_shrinks_to_fit() {
        let mut tree = LayoutTree::new();
        // post-order: DateInput(0), trigger(1), Label(2), DatePicker(3), body(4)
        let json = r#"[
            {"style":{"width":"110px","height":"20px"},"children":[]},
            {"style":{"display":"flex","flexDirection":"row","alignItems":"center"},"children":[0]},
            {"style":{"width":"74px","height":"20px"},"children":[]},
            {"style":{"display":"flex","flexDirection":"column","rowGap":"4px"},"children":[2,1]},
            {"style":{"display":"flex","flexDirection":"column","width":"350px","alignItems":"flex-start"},"children":[3]}
        ]"#;
        let handles = tree.build_tree_batch(json).unwrap();
        tree.compute_layout(handles[4], 350.0, 400.0);

        let dp = tree.get_layout(handles[3]);
        let trg = tree.get_layout(handles[1]);
        // 콘텐츠 최대폭 = DateInput 110 (Label 74 보다 큼) → DatePicker 110, 350 이 아님.
        assert_eq!(dp.width, 110.0, "DatePicker 가 부모 폭으로 stretch 됨 (CSS 는 fit-content)");
        assert_eq!(trg.width, 110.0, "trigger 가 부모 폭으로 stretch 됨");
        // 높이는 Label 20 + gap 4 + trigger 20 = 44.
        assert_eq!(dp.height, 44.0);
    }

    /// DatePicker 실측 회귀 (본체) — shrink-to-fit 부모의 `width:100%` 자식.
    ///
    /// CSS: 부모가 shrink-to-fit(auto cross) 이면 자식의 `100%` 는 **부모의 확정 폭**을
    /// 기준으로 풀린다(순환 → 콘텐츠가 폭을 정하고 100% 는 그에 맞춤). 따라서 100% 자식은
    /// 부모를 팽창시키지 못한다 — 부모 폭은 여전히 콘텐츠(110).
    ///
    /// 엔진 회귀: `100%` 를 **available(350)** 로 풀어 부모까지 350 으로 팽창시킨다.
    /// 실측(2026-07-14): DOM DatePicker 124.3 vs Skia 350.
    #[test]
    fn percent_width_child_does_not_inflate_shrink_to_fit_parent() {
        let mut tree = LayoutTree::new();
        // post-order: DateInput(0), trigger(1, width:100%), Label(2), DatePicker(3), body(4)
        let json = r#"[
            {"style":{"width":"110px","height":"20px"},"children":[]},
            {"style":{"display":"flex","flexDirection":"row","alignItems":"center","width":"100%"},"children":[0]},
            {"style":{"width":"74px","height":"20px"},"children":[]},
            {"style":{"display":"flex","flexDirection":"column","rowGap":"4px"},"children":[2,1]},
            {"style":{"display":"flex","flexDirection":"column","width":"350px","alignItems":"flex-start"},"children":[3]}
        ]"#;
        let handles = tree.build_tree_batch(json).unwrap();
        tree.compute_layout(handles[4], 350.0, 400.0);

        let dp = tree.get_layout(handles[3]);
        assert_eq!(
            dp.width, 110.0,
            "width:100% 자식이 shrink-to-fit 부모를 available(350) 로 팽창시킴"
        );
    }

    /// 중첩 flex — 손자까지 bottom-up solve.
    ///
    /// 외부 column 에 `align-items:flex-start` 명시 — flex.rs 의 stretch(cross
    /// 명시 크기 무시) 버그를 우회하여 tree.rs solve 오케스트레이션만 검증한다.
    /// (flex.rs stretch 버그는 모듈 doc "flex.rs 알려진 제약" 참조 — 단위 2 scope
    /// 밖, Phase 1 flex.rs 후속 수정.)
    #[test]
    fn flex_nested_bottom_up() {
        let mut tree = LayoutTree::new();
        // post-order: leaf(50×20), 내부 flex row [leaf], 외부 flex column [내부].
        let json = r#"[
            {"style":{"width":"50px","height":"20px"},"children":[]},
            {"style":{"display":"flex","flexDirection":"row","width":"200px","height":"30px","alignItems":"flex-start"},"children":[0]},
            {"style":{"display":"flex","flexDirection":"column","width":"300px","height":"100px","alignItems":"flex-start"},"children":[1]}
        ]"#;
        let handles = tree.build_tree_batch(json).unwrap();
        tree.compute_layout(handles[2], 300.0, 100.0);
        // 손자 leaf 가 내부 flex 안 (0,0) 에 배치.
        let leaf = tree.get_layout(handles[0]);
        assert_eq!(leaf.x, 0.0);
        assert_eq!(leaf.width, 50.0);
        // 내부 flex 는 외부 column 안 (0,0), 명시 width 200 유지(flex-start 라 stretch 없음).
        let inner = tree.get_layout(handles[1]);
        assert_eq!(inner.y, 0.0);
        assert_eq!(inner.width, 200.0);
    }

    /// flex row 자식 명시 width = border-box — padding/border 가산 아님.
    #[test]
    fn flex_child_explicit_width_is_border_box() {
        let mut tree = LayoutTree::new();
        // 자식 width 100px + padding 좌우 10 + border 좌우 1 → border-box 그대로 100.
        let json = r#"[
            {"style":{"width":"100px","height":"30px","paddingLeft":"10px","paddingRight":"10px","borderLeft":"1px","borderRight":"1px"},"children":[]},
            {"style":{"display":"flex","width":"300px","height":"200px"},"children":[0]}
        ]"#;
        let handles = tree.build_tree_batch(json).unwrap();
        tree.compute_layout(handles[1], 300.0, 200.0);
        let c0 = tree.get_layout(handles[0]);
        assert_eq!(c0.width, 100.0, "flex main 축 specified = border-box");
    }

    /// flex column 자식 명시 width(cross 축) = border-box.
    #[test]
    fn flex_column_child_cross_width_is_border_box() {
        let mut tree = LayoutTree::new();
        let json = r#"[
            {"style":{"width":"100px","height":"30px","paddingLeft":"10px","paddingRight":"10px"},"children":[]},
            {"style":{"display":"flex","flexDirection":"column","width":"300px","height":"200px"},"children":[0]}
        ]"#;
        let handles = tree.build_tree_batch(json).unwrap();
        tree.compute_layout(handles[1], 300.0, 200.0);
        let c0 = tree.get_layout(handles[0]);
        assert_eq!(c0.width, 100.0, "flex cross 축 specified = border-box");
    }

    /// flex-column 자식이 `width:fit-content` 면 stretch(부모 폭) 대신 content 폭으로 축소.
    ///
    /// 실전(Calendar): 부모 body(flex-column) 안 Calendar(width:fit-content) 가 부모 폭
    /// 전체로 stretch 되던 발산(Skia 350 vs CSS 256). fit-content 는 cross 축이므로
    /// resolve_cross_dimension_opt 가 CONTENT 센티넬로 통과 → flex.rs 가 content_cross(자식
    /// 내부 콘텐츠 폭)로 shrink-to-fit. 버그(fix 이전): fit-content→None→AUTO→stretch.
    #[test]
    fn flex_column_child_fit_content_width_shrinks_not_stretch() {
        let mut tree = LayoutTree::new();
        // 부모(flex-column, 300px) → 자식(width:fit-content) → 손자(width:60px).
        //   자식은 content 폭 60 이어야 함(부모 폭 300 으로 stretch 아님).
        let json = r#"[
            {"style":{"width":"60px","height":"20px"},"children":[]},
            {"style":{"display":"flex","flexDirection":"column","width":"fit-content"},"children":[0]},
            {"style":{"display":"flex","flexDirection":"column","width":"300px","height":"200px"},"children":[1]}
        ]"#;
        let handles = tree.build_tree_batch(json).unwrap();
        tree.compute_layout(handles[2], 300.0, 200.0);
        let child = tree.get_layout(handles[1]);
        assert_eq!(
            child.width, 60.0,
            "fit-content 자식 width={} (expect content 60, not stretch 300)",
            child.width
        );
    }

    // ── ADR-165: intrinsic 측정 스칼라 (content_min/max_width) 소비 ──

    /// auto-width 텍스트 leaf + 스칼라 → basis = max-content (압박 없음 → 그대로).
    #[test]
    fn leaf_auto_width_scalars_max_content_basis() {
        let mut tree = LayoutTree::new();
        let json = r#"[
            {"style":{"height":"20px","contentMinWidth":40,"contentMaxWidth":120},"children":[]},
            {"style":{"display":"flex","flexDirection":"row","width":"300px","height":"100px","alignItems":"flex-start"},"children":[0]}
        ]"#;
        let handles = tree.build_tree_batch(json).unwrap();
        tree.compute_layout(handles[1], 300.0, 100.0);
        let leaf = tree.get_layout(handles[0]);
        assert_eq!(leaf.width, 120.0, "무압박 auto leaf = max-content 단일줄 폭");
    }

    /// shrink 압박 시 §4.5 floor = 정확 min-content (ADR-164 상한 근사 120 이 아니라 40).
    #[test]
    fn leaf_shrink_floors_at_exact_min_content() {
        let mut tree = LayoutTree::new();
        // 컨테이너 30px < min-content 40 → shrink 는 40 에서 정지 (ADR-164 였다면
        // floor = content_main(120) 이라 120 고정 — 정밀화의 차등 지점).
        let json = r#"[
            {"style":{"height":"20px","contentMinWidth":40,"contentMaxWidth":120},"children":[]},
            {"style":{"display":"flex","flexDirection":"row","width":"30px","height":"100px","alignItems":"flex-start"},"children":[0]}
        ]"#;
        let handles = tree.build_tree_batch(json).unwrap();
        tree.compute_layout(handles[1], 300.0, 100.0);
        let leaf = tree.get_layout(handles[0]);
        assert_eq!(leaf.width, 40.0, "shrink floor = 정확 min-content(40)");
    }

    /// width:min-content 키워드 → 최장 단어 폭.
    #[test]
    fn leaf_width_min_content_keyword() {
        let mut tree = LayoutTree::new();
        let json = r#"[
            {"style":{"width":"min-content","height":"20px","contentMinWidth":40,"contentMaxWidth":120},"children":[]},
            {"style":{"display":"block","width":"300px","height":"100px"},"children":[0]}
        ]"#;
        let handles = tree.build_tree_batch(json).unwrap();
        tree.compute_layout(handles[1], 300.0, 100.0);
        let leaf = tree.get_layout(handles[0]);
        assert_eq!(leaf.width, 40.0, "min-content = 최장 단어 폭");
    }

    /// width:max-content 키워드 — block 컨텍스트에선 avail 무시 (overflow 허용).
    #[test]
    fn leaf_width_max_content_keyword_ignores_avail() {
        let mut tree = LayoutTree::new();
        let json = r#"[
            {"style":{"width":"max-content","height":"20px","contentMinWidth":40,"contentMaxWidth":120},"children":[]},
            {"style":{"display":"block","width":"100px","height":"100px"},"children":[0]}
        ]"#;
        let handles = tree.build_tree_batch(json).unwrap();
        tree.compute_layout(handles[1], 100.0, 100.0);
        let leaf = tree.get_layout(handles[0]);
        assert_eq!(leaf.width, 120.0, "max-content 는 avail(100) 무시하고 단일줄 폭");
    }

    /// width:fit-content 키워드 → clamp(min-content, avail, max-content).
    #[test]
    fn leaf_width_fit_content_clamps_to_avail() {
        let mut tree = LayoutTree::new();
        // avail 100 ∈ [40, 120] → 100. (avail 300 이면 120, avail 20 이면 40.)
        let json = r#"[
            {"style":{"width":"fit-content","height":"20px","contentMinWidth":40,"contentMaxWidth":120},"children":[]},
            {"style":{"display":"block","width":"100px","height":"100px"},"children":[0]}
        ]"#;
        let handles = tree.build_tree_batch(json).unwrap();
        tree.compute_layout(handles[1], 100.0, 100.0);
        let leaf = tree.get_layout(handles[0]);
        assert_eq!(leaf.width, 100.0, "fit-content = clamp(40, 100, 120)");
    }

    // ── 단위 3-a: block dispatch ──

    /// block 컨테이너 + 2 explicit 자식 → 위→아래 vertical stacking (margin 0).
    #[test]
    fn block_two_children_vertical_stack() {
        let mut tree = LayoutTree::new();
        let json = r#"[
            {"style":{"width":"100px","height":"30px"},"children":[]},
            {"style":{"width":"100px","height":"40px"},"children":[]},
            {"style":{"display":"block","width":"300px","height":"200px"},"children":[0,1]}
        ]"#;
        let handles = tree.build_tree_batch(json).unwrap();
        tree.compute_layout(handles[2], 300.0, 200.0);
        // 자식0: y=0, 자식1: y=30 (위→아래 누적).
        let c0 = tree.get_layout(handles[0]);
        let c1 = tree.get_layout(handles[1]);
        assert_eq!(c0.y, 0.0, "c0.y");
        assert_eq!(c0.height, 30.0, "c0.h");
        assert_eq!(c1.y, 30.0, "c1.y = c0 height 뒤");
        assert_eq!(c1.height, 40.0, "c1.h");
    }

    /// block 컨테이너 자식 margin collapse (block.rs 내부) → 인접 margin max.
    #[test]
    fn block_children_margin_collapse() {
        let mut tree = LayoutTree::new();
        // 자식0(h=30, mb=20), 자식1(h=40, mt=30). collapse → c1.y = 30 + max(20,30) = 60.
        let json = r#"[
            {"style":{"width":"100px","height":"30px","marginBottom":"20px"},"children":[]},
            {"style":{"width":"100px","height":"40px","marginTop":"30px"},"children":[]},
            {"style":{"display":"block","width":"300px","height":"200px"},"children":[0,1]}
        ]"#;
        let handles = tree.build_tree_batch(json).unwrap();
        tree.compute_layout(handles[2], 300.0, 200.0);
        let c1 = tree.get_layout(handles[1]);
        assert_eq!(c1.y, 60.0, "c1.y = 30 + collapse(20,30)=30");
    }

    /// block 자식 auto width → 컨테이너 폭으로 stretch (block.rs).
    #[test]
    fn block_child_auto_width_stretches() {
        let mut tree = LayoutTree::new();
        // 자식 width 미지정(auto) → 컨테이너 폭 300 으로 stretch.
        let json = r#"[
            {"style":{"height":"30px"},"children":[]},
            {"style":{"display":"block","width":"300px","height":"200px"},"children":[0]}
        ]"#;
        let handles = tree.build_tree_batch(json).unwrap();
        tree.compute_layout(handles[1], 300.0, 200.0);
        let c0 = tree.get_layout(handles[0]);
        assert_eq!(c0.width, 300.0, "auto width → 컨테이너 폭 stretch");
    }

    /// block 자식 명시 px width = border-box (전역 * { box-sizing: border-box } 계약).
    /// padding 은 명시 폭 안에 포함된다 — 가산 아님.
    #[test]
    fn block_child_explicit_width_is_border_box() {
        let mut tree = LayoutTree::new();
        // 자식 width 100px + padding 10 좌우(총 20) → border-box 그대로 100.
        let json = r#"[
            {"style":{"width":"100px","height":"30px","paddingLeft":"10px","paddingRight":"10px"},"children":[]},
            {"style":{"display":"block","width":"300px","height":"200px"},"children":[0]}
        ]"#;
        let handles = tree.build_tree_batch(json).unwrap();
        tree.compute_layout(handles[1], 300.0, 200.0);
        let c0 = tree.get_layout(handles[0]);
        assert_eq!(c0.width, 100.0, "specified width = border-box (padding 포함)");
    }

    /// block 자식 명시 percent width 도 border-box — px 와 동일 계약 공유 확증.
    ///
    /// percent 는 `resolve_dimension`(→ `resolve_css_size_value`) 에서 부모 avail
    /// 기준 px 로 먼저 해석된 뒤(leaf 는 `solve_node` explicit 분기에서 그 값을 그대로
    /// 최종 width 로 반영), 이 최종값이 곧 border-box 크기다 — px 리터럴과 percent
    /// 는 "해석된 px" 단계 이후 완전히 같은 경로를 타므로 별도 감산 로직이 없다.
    /// (percent 는 own leaf 크기 해석 대상이라 이 테스트에서 padding 은 leaf 자신의
    /// content 를 줄일 뿐 최종 border-box 폭엔 영향 없음 — Task 1 감산은 컨테이너가
    /// *자식에게 넘기는 available* 감산이고, 여기서 검증하는 것은 자식 자신의
    /// specified-size 해석이 px/percent 무관하게 동일 border-box 계약을 따르는지다.)
    #[test]
    fn block_child_percent_width_is_border_box() {
        let mut tree = LayoutTree::new();
        // 부모 content 400(padding 0) + 자식 width 50% + padding 10 좌우.
        let json = r#"[
            {"style":{"width":"50%","height":"30px","paddingLeft":"10px","paddingRight":"10px"},"children":[]},
            {"style":{"display":"block","width":"400px","height":"200px"},"children":[0]}
        ]"#;
        let handles = tree.build_tree_batch(json).unwrap();
        tree.compute_layout(handles[1], 400.0, 200.0);
        let c0 = tree.get_layout(handles[0]);
        assert_eq!(c0.width, 200.0, "50% of content 400 = border-box 200 (px 와 동일 계약)");
    }

    /// Button md 재현: height 30(= lineHeight 20 + paddingY 4×2 + border 1×2) 명시 →
    /// border-box 그대로 30 (현행 결함: 40 으로 이중 가산).
    #[test]
    fn block_child_explicit_height_is_border_box_button_md() {
        let mut tree = LayoutTree::new();
        let json = r#"[
            {"style":{"width":"100px","height":"30px","paddingTop":"4px","paddingBottom":"4px","borderTop":"1px","borderBottom":"1px"},"children":[]},
            {"style":{"display":"block","width":"300px","height":"200px"},"children":[0]}
        ]"#;
        let handles = tree.build_tree_batch(json).unwrap();
        tree.compute_layout(handles[1], 300.0, 200.0);
        let c0 = tree.get_layout(handles[0]);
        assert_eq!(c0.height, 30.0, "Button md border-box height");
    }

    /// height:auto block 컨테이너 → 자식 stacking 합으로 intrinsic 도출.
    #[test]
    fn block_container_intrinsic_height_from_children() {
        let mut tree = LayoutTree::new();
        // 부모 height 미지정(auto) → 자식 stacking 합(30+40=70)이 컨테이너 height.
        let json = r#"[
            {"style":{"width":"100px","height":"30px"},"children":[]},
            {"style":{"width":"100px","height":"40px"},"children":[]},
            {"style":{"display":"block","width":"300px"},"children":[0,1]}
        ]"#;
        let handles = tree.build_tree_batch(json).unwrap();
        let root = handles[2];
        tree.compute_layout(root, 300.0, -1.0); // height:auto sentinel
        let container = tree.get_layout(root);
        assert_eq!(container.width, 300.0, "명시 width 유지");
        assert_eq!(container.height, 70.0, "intrinsic height = 자식 stacking 합");
    }

    /// display 미설정 컨테이너 → block 기본(자식 배치됨).
    #[test]
    fn undefined_display_container_is_block() {
        let mut tree = LayoutTree::new();
        // display 미설정 컨테이너 — CSS 초기 inline 이지만 tree.rs 계약상 block.
        let json = r#"[
            {"style":{"width":"100px","height":"25px"},"children":[]},
            {"style":{"width":"300px","height":"200px"},"children":[0]}
        ]"#;
        let handles = tree.build_tree_batch(json).unwrap();
        tree.compute_layout(handles[1], 300.0, 200.0);
        // display 미설정 → block dispatch → 자식 배치(y=0).
        let c0 = tree.get_layout(handles[0]);
        assert_eq!(c0.y, 0.0, "미설정 display → block 자식 배치");
        assert_eq!(c0.height, 25.0);
    }

    // ── 단위 3-b: grid dispatch ──

    /// grid 2열 auto-placement — 4 자식 row-major.
    #[test]
    fn grid_two_col_auto_placement() {
        let mut tree = LayoutTree::new();
        // cols "1fr 1fr" at 200 → [100,100], rows "50px 50px".
        let json = r#"[
            {"style":{},"children":[]},
            {"style":{},"children":[]},
            {"style":{},"children":[]},
            {"style":{},"children":[]},
            {"style":{"display":"grid","width":"200px","height":"100px","gridTemplateColumns":["1fr","1fr"],"gridTemplateRows":["50px","50px"]},"children":[0,1,2,3]}
        ]"#;
        let handles = tree.build_tree_batch(json).unwrap();
        tree.compute_layout(handles[4], 200.0, 100.0);
        // child0 (0,0): x=0 y=0 w=100 h=50.
        let c0 = tree.get_layout(handles[0]);
        assert_eq!((c0.x, c0.y, c0.width, c0.height), (0.0, 0.0, 100.0, 50.0), "c0");
        // child1 (1,0): x=100 y=0.
        let c1 = tree.get_layout(handles[1]);
        assert_eq!((c1.x, c1.y), (100.0, 0.0), "c1 두번째 열");
        // child2 (0,1): x=0 y=50.
        let c2 = tree.get_layout(handles[2]);
        assert_eq!((c2.x, c2.y), (0.0, 50.0), "c2 두번째 행");
        // child3 (1,1): x=100 y=50.
        let c3 = tree.get_layout(handles[3]);
        assert_eq!((c3.x, c3.y), (100.0, 50.0), "c3");
    }

    /// grid gap — col_gap/row_gap 이 셀 좌표에 반영.
    #[test]
    fn grid_with_gap() {
        let mut tree = LayoutTree::new();
        // cols "100px 100px" gap 10, rows "50px 50px" gap 20.
        let json = r#"[
            {"style":{},"children":[]},
            {"style":{},"children":[]},
            {"style":{},"children":[]},
            {"style":{},"children":[]},
            {"style":{"display":"grid","width":"210px","height":"120px","gridTemplateColumns":["100px","100px"],"gridTemplateRows":["50px","50px"],"columnGap":"10px","rowGap":"20px"},"children":[0,1,2,3]}
        ]"#;
        let handles = tree.build_tree_batch(json).unwrap();
        tree.compute_layout(handles[4], 210.0, 120.0);
        // child1 (1,0): x = 100 + 10 gap = 110.
        let c1 = tree.get_layout(handles[1]);
        assert_eq!(c1.x, 110.0, "c1.x = 100 + col_gap 10");
        // child2 (0,1): y = 50 + 20 gap = 70.
        let c2 = tree.get_layout(handles[2]);
        assert_eq!(c2.y, 70.0, "c2.y = 50 + row_gap 20");
    }

    /// `height:auto` 그리드는 `align-content` 로 밀리지 않는다 — 여유 공간은 definite
    /// block size 에서만 생긴다(CSS-ALIGN-3 §4.4). 상속 available 을 여유로 오해하면
    /// 트랙이 아래로 밀리고 컨테이너 높이가 폭주한다 (2026-07-27 실측: 70 → 335).
    #[test]
    fn grid_auto_height_ignores_align_content() {
        for ac in ["center", "end", "space-between", "space-around"] {
            let mut tree = LayoutTree::new();
            let json = format!(
                r#"[
                {{"style":{{"height":"20px"}},"children":[]}},
                {{"style":{{"height":"30px"}},"children":[]}},
                {{"style":{{"height":"40px"}},"children":[]}},
                {{"style":{{"display":"grid","width":"300px","gridTemplateColumns":["1fr","1fr"],"alignContent":"{ac}"}},"children":[0,1,2]}},
                {{"style":{{"display":"block","width":"400px","height":"600px"}},"children":[3]}}
            ]"#
            );
            let handles = tree.build_tree_batch(&json).unwrap();
            tree.compute_layout(handles[4], 400.0, 600.0);

            // 1행 = max(20,30) = 30, 2행 = 40 → 컨테이너 70, 3번째 자식 y = 30.
            let grid = tree.get_layout(handles[3]);
            assert_eq!(grid.height, 70.0, "align-content={ac} 컨테이너 높이");
            let c2 = tree.get_layout(handles[2]);
            assert_eq!(c2.y, 30.0, "align-content={ac} 2행 y");
        }
    }

    /// 반대편 회귀 방지 — definite 높이에서는 `align-content` 가 정상 동작한다.
    #[test]
    fn grid_definite_height_applies_align_content() {
        let mut tree = LayoutTree::new();
        // 행 합 70(30+40), 컨테이너 200 → 여유 130. center → 트랙셋 65 아래로.
        let json = r#"[
            {"style":{"height":"20px"},"children":[]},
            {"style":{"height":"30px"},"children":[]},
            {"style":{"height":"40px"},"children":[]},
            {"style":{"display":"grid","width":"300px","height":"200px","gridTemplateColumns":["1fr","1fr"],"alignContent":"center"},"children":[0,1,2]},
            {"style":{"display":"block","width":"400px","height":"600px"},"children":[3]}
        ]"#;
        let handles = tree.build_tree_batch(json).unwrap();
        tree.compute_layout(handles[4], 400.0, 600.0);

        let c0 = tree.get_layout(handles[0]);
        assert_eq!(c0.y, 65.0, "center → (200-70)/2");
    }

    /// E2 옵션 3-a: justify-items:end — explicit-width 자식이 셀 우측 배치 + 폭 respect.
    #[test]
    fn grid_justify_items_end_respects_explicit_width() {
        let mut tree = LayoutTree::new();
        // 1열 200폭 · 1행 100높이. 자식 width:40 height:100 (컨테이너 justifyItems:end).
        let json = r#"[
            {"style":{"width":"40px","height":"100px"},"children":[]},
            {"style":{"display":"grid","width":"200px","height":"100px","gridTemplateColumns":["1fr"],"gridTemplateRows":["100px"],"justifyItems":"end"},"children":[0]}
        ]"#;
        let handles = tree.build_tree_batch(json).unwrap();
        tree.compute_layout(handles[1], 200.0, 100.0);
        let c = tree.get_layout(handles[0]);
        // justify-items:end → x = 200 - 40 = 160, w=40 (stretch 아닌 explicit 폭).
        assert_eq!(
            (c.x, c.width),
            (160.0, 40.0),
            "justify-items:end 우측 배치 + 폭 respect"
        );
    }

    /// E2 옵션 3-a: justify-self:center override + auto-width 자식은 stretch 유지(cw>0 가드).
    #[test]
    fn grid_justify_self_center_and_auto_stretch() {
        let mut tree = LayoutTree::new();
        // 자식0: width:40 justifySelf:center → 중앙. 자식1: auto width → stretch fill.
        let json = r#"[
            {"style":{"width":"40px","height":"100px","justifySelf":"center"},"children":[]},
            {"style":{"height":"100px"},"children":[]},
            {"style":{"display":"grid","width":"200px","height":"200px","gridTemplateColumns":["1fr"],"gridTemplateRows":["100px","100px"]},"children":[0,1]}
        ]"#;
        let handles = tree.build_tree_batch(json).unwrap();
        tree.compute_layout(handles[2], 200.0, 200.0);
        let c0 = tree.get_layout(handles[0]);
        // justify-self:center → x=(200-40)/2=80, w=40.
        assert_eq!((c0.x, c0.width), (80.0, 40.0), "justify-self:center");
        let c1 = tree.get_layout(handles[1]);
        // auto-width 자식은 justify 대상 아님(cw=0 가드) → stretch fill(x=0, w=200).
        assert_eq!(
            (c1.x, c1.width),
            (0.0, 200.0),
            "auto-width 자식 stretch 유지(cw>0 가드)"
        );
    }

    /// E2 옵션 3-a 세로축: align-items 기본(stretch)인데 자식이 explicit height →
    /// CSS 는 stretch 를 무효화 → explicit height 유지 + top 정렬 (definite 가 stretch 이김).
    /// Chrome ground truth 실측 일치 (parity harness Case B). 폭은 세로축 전용 수정이라
    /// justify 기본 stretch 유지 — 수평 explicit-width mirror 는 미착수(§Residual).
    #[test]
    fn grid_stretch_explicit_height_respects_and_top_aligns() {
        let mut tree = LayoutTree::new();
        // 1열 200 · 1행 100. c0 explicit height 40 (셀 100 보다 짧음, align 기본 stretch).
        let json = r#"[
            {"style":{"height":"40px"},"children":[]},
            {"style":{"display":"grid","width":"200px","height":"100px","gridTemplateColumns":["1fr"],"gridTemplateRows":["100px"]},"children":[0]}
        ]"#;
        let handles = tree.build_tree_batch(json).unwrap();
        tree.compute_layout(handles[1], 200.0, 100.0);
        let c = tree.get_layout(handles[0]);
        assert_eq!(
            (c.y, c.height),
            (0.0, 40.0),
            "stretch 하 explicit height 유지 + top 정렬"
        );
        assert_eq!(c.width, 200.0, "width 는 justify 기본 stretch 유지(세로축 전용 수정)");
    }

    /// 회귀 가드: auto-height 자식(explicit 없음)은 stretch 로 셀 채움 유지 —
    /// live grid(빈 셀/full-height 아이템)가 의존. child_eh==0 → stretch 분기.
    #[test]
    fn grid_stretch_auto_height_still_fills_cell() {
        let mut tree = LayoutTree::new();
        // c0 height 미설정(auto) → content 0 이지만 stretch 로 셀(80) 채움.
        let json = r#"[
            {"style":{},"children":[]},
            {"style":{"display":"grid","width":"120px","height":"80px","gridTemplateColumns":["1fr"],"gridTemplateRows":["80px"]},"children":[0]}
        ]"#;
        let handles = tree.build_tree_batch(json).unwrap();
        tree.compute_layout(handles[1], 120.0, 80.0);
        let c = tree.get_layout(handles[0]);
        assert_eq!(
            (c.y, c.height),
            (0.0, 80.0),
            "auto-height 자식은 stretch 로 셀 채움(무회귀)"
        );
    }

    /// align-self:center + explicit height (3-b 정렬 유지 확인) — 셀 중앙 배치 + 크기 유지.
    #[test]
    fn grid_align_self_center_explicit_height_centers() {
        let mut tree = LayoutTree::new();
        let json = r#"[
            {"style":{"height":"40px","alignSelf":"center"},"children":[]},
            {"style":{"display":"grid","width":"120px","height":"100px","gridTemplateColumns":["1fr"],"gridTemplateRows":["100px"]},"children":[0]}
        ]"#;
        let handles = tree.build_tree_batch(json).unwrap();
        tree.compute_layout(handles[1], 120.0, 100.0);
        let c = tree.get_layout(handles[0]);
        // center → y=(100-40)/2=30, h=40.
        assert_eq!(
            (c.y, c.height),
            (30.0, 40.0),
            "align-self:center + explicit height 중앙 배치"
        );
    }

    /// grid line placement — 자식 gridColumn span (start/end 분리 → 결합 재조립).
    #[test]
    fn grid_child_column_span() {
        let mut tree = LayoutTree::new();
        // 자식0 gridColumnStart "1" + gridColumnEnd "3" (2칸 span). cols [100,100].
        let json = r#"[
            {"style":{"gridColumnStart":"1","gridColumnEnd":"3"},"children":[]},
            {"style":{"display":"grid","width":"200px","height":"50px","gridTemplateColumns":["100px","100px"],"gridTemplateRows":["50px"]},"children":[0]}
        ]"#;
        let handles = tree.build_tree_batch(json).unwrap();
        tree.compute_layout(handles[1], 200.0, 50.0);
        // colStart 1 colEnd 3 → width = track0 + track1 = 200.
        let c0 = tree.get_layout(handles[0]);
        assert_eq!(c0.width, 200.0, "1 / 3 span → 2트랙 폭");
    }

    /// grid fr track 분배 — "1fr 2fr" at 300 → [100, 200].
    #[test]
    fn grid_fr_track_distribution() {
        let mut tree = LayoutTree::new();
        let json = r#"[
            {"style":{},"children":[]},
            {"style":{},"children":[]},
            {"style":{"display":"grid","width":"300px","height":"50px","gridTemplateColumns":["1fr","2fr"],"gridTemplateRows":["50px"]},"children":[0,1]}
        ]"#;
        let handles = tree.build_tree_batch(json).unwrap();
        tree.compute_layout(handles[2], 300.0, 50.0);
        let c0 = tree.get_layout(handles[0]);
        let c1 = tree.get_layout(handles[1]);
        assert_eq!(c0.width, 100.0, "1fr = 300/3");
        assert_eq!(c1.width, 200.0, "2fr = 300/3*2");
    }

    /// grid 자식이 flex 컨테이너 — 셀 안에서 자식 배치 (재귀 solve).
    #[test]
    fn grid_child_is_flex_container() {
        let mut tree = LayoutTree::new();
        // post-order: 손자 leaf(40×20), grid 자식=flex row [손자], grid 컨테이너.
        let json = r#"[
            {"style":{"width":"40px","height":"20px"},"children":[]},
            {"style":{"display":"flex","flexDirection":"row","alignItems":"flex-start"},"children":[0]},
            {"style":{"display":"grid","width":"100px","height":"50px","gridTemplateColumns":["100px"],"gridTemplateRows":["50px"]},"children":[1]}
        ]"#;
        let handles = tree.build_tree_batch(json).unwrap();
        tree.compute_layout(handles[2], 100.0, 50.0);
        // grid 자식(flex)은 셀 (0,0) 100×50.
        let flex_child = tree.get_layout(handles[1]);
        assert_eq!((flex_child.x, flex_child.y), (0.0, 0.0), "flex 셀 위치");
        assert_eq!((flex_child.width, flex_child.height), (100.0, 50.0), "flex 셀 크기");
        // 손자 leaf 는 flex 안 (0,0) 에 배치(재귀 solve 확증).
        let leaf = tree.get_layout(handles[0]);
        assert_eq!(leaf.x, 0.0, "손자 leaf x");
        assert_eq!(leaf.width, 40.0, "손자 leaf 명시 폭 유지");
    }

    /// height:auto grid 컨테이너 → 셀 bounding box 로 intrinsic 도출.
    #[test]
    fn grid_container_intrinsic_height_from_cells() {
        let mut tree = LayoutTree::new();
        // rows "40px 60px", 2 자식 auto (한 열) → bounding box height = 40+60 = 100.
        let json = r#"[
            {"style":{},"children":[]},
            {"style":{},"children":[]},
            {"style":{"display":"grid","width":"100px","gridTemplateColumns":["100px"],"gridTemplateRows":["40px","60px"]},"children":[0,1]}
        ]"#;
        let handles = tree.build_tree_batch(json).unwrap();
        let root = handles[2];
        tree.compute_layout(root, 100.0, -1.0); // height:auto sentinel
        let container = tree.get_layout(root);
        assert_eq!(container.width, 100.0, "명시 width 유지");
        assert_eq!(container.height, 100.0, "intrinsic height = 셀 bounding box (40+60)");
    }

    /// implicit auto row (gridTemplateRows 미명시) + 자식 명시 height →
    /// 셀 높이 = 자식 intrinsic content height (하드코딩 100 아님).
    /// C-1 진단이 flag 전환 선결로 확정한 grid intrinsic track 케이스.
    #[test]
    fn grid_implicit_auto_row_from_child_height() {
        let mut tree = LayoutTree::new();
        // cols "1fr 1fr" at 200 → [100,100]. rows 미명시(implicit auto).
        // 자식 2개 각 height:50px → 한 행(row-major 2열) → 셀 높이 = 자식 50.
        let json = r#"[
            {"style":{"height":"50px"},"children":[]},
            {"style":{"height":"50px"},"children":[]},
            {"style":{"display":"grid","width":"200px","height":"auto","gridTemplateColumns":["1fr","1fr"]},"children":[0,1]}
        ]"#;
        let handles = tree.build_tree_batch(json).unwrap();
        let root = handles[2];
        tree.compute_layout(root, 200.0, -1.0); // height:auto sentinel
        // 셀 높이 = 자식 명시 50 (하드코딩 100 아님).
        let c0 = tree.get_layout(handles[0]);
        let c1 = tree.get_layout(handles[1]);
        assert_eq!(c0.height, 50.0, "c0 셀 높이 = 자식 intrinsic 50 (not 100)");
        assert_eq!(c1.height, 50.0, "c1 셀 높이 = 자식 intrinsic 50 (not 100)");
        // 컨테이너 intrinsic height = row 높이 50 (1행).
        let container = tree.get_layout(root);
        assert_eq!(container.height, 50.0, "컨테이너 intrinsic = row 50");
    }

    /// implicit auto row 여러 행 — 자식 3개 2열 → 2행, 각 행 높이 = 그 행 자식 max intrinsic.
    ///
    /// **row 높이**는 max intrinsic 으로 sizing 되지만, 셀보다 **짧은 explicit-height 자식**
    /// (c0: 30 < row0 50)은 셀을 stretch 로 채우지 않고 explicit height 를 유지 + top 정렬
    /// 한다 (ADR-156 옵션 3-a 세로축 — CSS `align-self:stretch` 는 definite height 를 이기지
    /// 못함). Chrome ground truth 실측: c0 {y:0, h:30} (parity harness Case A).
    #[test]
    fn grid_implicit_auto_row_multi_row_max_height() {
        let mut tree = LayoutTree::new();
        // cols "1fr 1fr", 자식 3개 (row0: c0,c1 / row1: c2). rows 미명시.
        // c0 h=30, c1 h=50 → row0 = max(30,50)=50. c2 h=40 → row1 = 40.
        let json = r#"[
            {"style":{"height":"30px"},"children":[]},
            {"style":{"height":"50px"},"children":[]},
            {"style":{"height":"40px"},"children":[]},
            {"style":{"display":"grid","width":"200px","height":"auto","gridTemplateColumns":["1fr","1fr"]},"children":[0,1,2]}
        ]"#;
        let handles = tree.build_tree_batch(json).unwrap();
        let root = handles[3];
        tree.compute_layout(root, 200.0, -1.0);
        // row0 셀 높이 = max(30,50) = 50. c0 은 explicit 30 유지(셀보다 짧음) + top 정렬,
        //   c1 은 explicit 50 == 셀 → 그대로 50.
        let c0 = tree.get_layout(handles[0]);
        assert_eq!(c0.height, 30.0, "c0 explicit height 30 (셀 50 로 stretch 안 함)");
        assert_eq!(c0.y, 0.0, "c0 top 정렬 (stretch 무효)");
        assert_eq!(tree.get_layout(handles[1]).height, 50.0, "c1 explicit 50 == 셀");
        // c2 는 row1 (y=50), 높이 40 (== 셀).
        let c2 = tree.get_layout(handles[2]);
        assert_eq!(c2.y, 50.0, "c2 row1 y = row0 height 50");
        assert_eq!(c2.height, 40.0, "row1 height = 40");
        // 컨테이너 intrinsic = row0(50) + row1(40) = 90 (row 높이는 max intrinsic 유지).
        assert_eq!(tree.get_layout(root).height, 90.0, "컨테이너 = row0+row1 = 90");
    }

    /// **명시** auto row (`gridTemplateRows:["auto","auto"]`) + placement 명시 +
    /// 부모 height:auto → 각 auto row = 그 row 자식들의 max intrinsic content height.
    ///
    /// ProgressBar/Meter 실구조 (2026-07-06 전수조사): `gridTemplateColumns:"1fr auto"`,
    /// `gridTemplateRows:"auto auto"`, 자식이 gridRowStart/End 로 row 명시. 기존
    /// implicit auto row 경로는 `template_rows.is_empty() && placement_spec.is_empty()`
    /// 두 조건 모두 요구 → 명시 rows + 명시 placement 인 본 케이스는 미측정 →
    /// grid.rs 가 auto 를 1fr 로 근사해 available_h 를 나눠 가져 컨테이너가 availH
    /// 전체로 폭발(716). CSS 는 auto row = content → 컨테이너 ~row 합.
    #[test]
    fn grid_explicit_auto_rows_measured_from_child_intrinsic() {
        let mut tree = LayoutTree::new();
        // cols "1fr auto", rows "auto auto". 부모 height:auto (availH=-1).
        // row0: label(h=20, col1)/value(h=20, col2). row1: track(h=8, col1-3).
        // → row0=20, row1=8 → 컨테이너 = 20 + 8 = 28 (availH 폭발 아님).
        let json = r#"[
            {"style":{"height":"20px","gridColumnStart":"1","gridColumnEnd":"2","gridRowStart":"1","gridRowEnd":"2"},"children":[]},
            {"style":{"height":"20px","gridColumnStart":"2","gridColumnEnd":"3","gridRowStart":"1","gridRowEnd":"2"},"children":[]},
            {"style":{"height":"8px","gridColumnStart":"1","gridColumnEnd":"3","gridRowStart":"2","gridRowEnd":"3"},"children":[]},
            {"style":{"display":"grid","width":"320px","gridTemplateColumns":["1fr","auto"],"gridTemplateRows":["auto","auto"]},"children":[0,1,2]}
        ]"#;
        let handles = tree.build_tree_batch(json).unwrap();
        let root = handles[3];
        tree.compute_layout(root, 320.0, -1.0); // height:auto sentinel → availH 폭발 없어야
        // 컨테이너 height = row0(20) + row1(8) = 28 (availH 716/320 아님).
        let container = tree.get_layout(root);
        assert_eq!(
            container.height, 28.0,
            "명시 auto row = 자식 intrinsic 합 28 (availH 폭발 아님)"
        );
        // 각 셀 높이 = 그 row 자식 intrinsic.
        assert_eq!(tree.get_layout(handles[0]).height, 20.0, "row0 label = 20");
        assert_eq!(tree.get_layout(handles[2]).height, 8.0, "row1 track = 8");
        // track y = row0 height 20.
        assert_eq!(tree.get_layout(handles[2]).y, 20.0, "row1 y = row0 20");
    }

    /// auto 트랙 기여값은 자식 **자신의 min/max** 로 clamp 된다 (CSS-GRID-1 §12.5).
    ///
    /// 콘텐츠가 없고 `min-height` 만 선언한 자식은 content 측정이 0 이라, clamp 없이는
    /// auto row 가 통째로 0 으로 무너진다. 실제로 Frame 프리셋(대시보드/Holy Grail)의
    /// header·navigation 밴드가 이 경로로 캔버스에서 사라졌다 — 같은 자리에 `height` 를
    /// 주면 60 이 나오고 `minHeight` 는 0 이던 비대칭(2026-07-26 실측).
    #[test]
    fn grid_auto_row_honors_child_min_height() {
        let mut tree = LayoutTree::new();
        // rows "auto 1fr": row0 = 빈 자식(min-height 60만) / row1 = 빈 자식.
        let json = r#"[
            {"style":{"minHeight":"60px","gridColumnStart":"1","gridColumnEnd":"2","gridRowStart":"1","gridRowEnd":"2"},"children":[]},
            {"style":{"gridColumnStart":"1","gridColumnEnd":"2","gridRowStart":"2","gridRowEnd":"3"},"children":[]},
            {"style":{"display":"grid","width":"400px","height":"300px","gridTemplateColumns":["1fr"],"gridTemplateRows":["auto","1fr"]},"children":[0,1]}
        ]"#;
        let handles = tree.build_tree_batch(json).unwrap();
        tree.compute_layout(handles[2], 400.0, 300.0);
        assert_eq!(
            tree.get_layout(handles[0]).height,
            60.0,
            "빈 자식의 min-height 가 auto row 기여값 — clamp 누락 시 0"
        );
        assert_eq!(
            tree.get_layout(handles[1]).height,
            240.0,
            "1fr row = 남은 높이 300 - 60"
        );
        assert_eq!(tree.get_layout(handles[1]).y, 60.0, "row1 y = row0 높이");
    }

    /// auto **column** 도 같은 계약 — 빈 자식의 `min-width` 가 트랙 기여값.
    #[test]
    fn grid_auto_column_honors_child_min_width() {
        let mut tree = LayoutTree::new();
        let json = r#"[
            {"style":{"minWidth":"120px","gridColumnStart":"1","gridColumnEnd":"2","gridRowStart":"1","gridRowEnd":"2"},"children":[]},
            {"style":{"gridColumnStart":"2","gridColumnEnd":"3","gridRowStart":"1","gridRowEnd":"2"},"children":[]},
            {"style":{"display":"grid","width":"400px","height":"100px","gridTemplateColumns":["auto","1fr"],"gridTemplateRows":["1fr"]},"children":[0,1]}
        ]"#;
        let handles = tree.build_tree_batch(json).unwrap();
        tree.compute_layout(handles[2], 400.0, 100.0);
        assert_eq!(
            tree.get_layout(handles[0]).width,
            120.0,
            "빈 자식의 min-width 가 auto column 기여값"
        );
        assert_eq!(tree.get_layout(handles[1]).x, 120.0, "1fr col x = auto col 폭");
    }

    /// `max-height` 는 기여값을 **낮추는** 방향으로도 걸린다 (clamp 는 양방향).
    #[test]
    fn grid_auto_row_clamps_child_contribution_by_max_height() {
        let mut tree = LayoutTree::new();
        let json = r#"[
            {"style":{"height":"200px","maxHeight":"80px","gridColumnStart":"1","gridColumnEnd":"2","gridRowStart":"1","gridRowEnd":"2"},"children":[]},
            {"style":{"display":"grid","width":"400px","gridTemplateColumns":["1fr"],"gridTemplateRows":["auto"]},"children":[0]}
        ]"#;
        let handles = tree.build_tree_batch(json).unwrap();
        tree.compute_layout(handles[1], 400.0, -1.0);
        assert_eq!(
            tree.get_layout(handles[1]).height,
            80.0,
            "max-height 가 auto row 기여값 상한"
        );
    }

    /// 명시 auto **column** (`gridTemplateColumns:["1fr","auto"]`) → auto col =
    /// 그 col 자식들의 max intrinsic content width (1fr 근사 아님).
    ///
    /// ProgressBar 실구조 (2026-07-06 cross-check): `gridTemplateColumns:"1fr auto"`
    /// 에서 CSS 는 auto col = value content(~29), 1fr = 나머지(~307). grid.rs 는 auto 를
    /// 1fr 로 근사해 available 을 반반 분배(180/168) → value 폭 발산 + 중앙으로 밀림.
    /// auto row 와 대칭인 column intrinsic 측정.
    #[test]
    fn grid_explicit_auto_column_measured_from_child_intrinsic() {
        let mut tree = LayoutTree::new();
        // cols "1fr auto" at 320. col0(1fr) label / col1(auto) value(w=30 명시).
        // → auto col1 = 30, 1fr col0 = 320 - 30 - gap0 = 290.
        let json = r#"[
            {"style":{"height":"20px","gridColumnStart":"1","gridColumnEnd":"2","gridRowStart":"1","gridRowEnd":"2"},"children":[]},
            {"style":{"width":"30px","height":"20px","gridColumnStart":"2","gridColumnEnd":"3","gridRowStart":"1","gridRowEnd":"2"},"children":[]},
            {"style":{"display":"grid","width":"320px","gridTemplateColumns":["1fr","auto"],"gridTemplateRows":["auto"]},"children":[0,1]}
        ]"#;
        let handles = tree.build_tree_batch(json).unwrap();
        tree.compute_layout(handles[2], 320.0, -1.0);
        // auto col1(value) = 자식 intrinsic 30 (1fr 근사 168 아님).
        let val = tree.get_layout(handles[1]);
        assert_eq!(val.width, 30.0, "auto col = 자식 intrinsic 30 (not 1fr 근사)");
        // value 는 우측 정렬: x = 320 - 30 = 290.
        assert_eq!(val.x, 290.0, "auto col 우측 (1fr 이 나머지 흡수)");
        // 1fr col0(label) = 320 - 30 = 290.
        assert_eq!(tree.get_layout(handles[0]).width, 290.0, "1fr = 나머지 290");
    }

    /// px col + auto col 혼합: px col 고정, auto col 만 intrinsic 측정.
    #[test]
    fn grid_mixed_px_and_auto_columns_preserve_px() {
        let mut tree = LayoutTree::new();
        // cols "100px auto" at 320. col0(100px 고정) / col1(auto=자식 40).
        let json = r#"[
            {"style":{"width":"60px","height":"20px","gridColumnStart":"1","gridColumnEnd":"2","gridRowStart":"1","gridRowEnd":"2"},"children":[]},
            {"style":{"width":"40px","height":"20px","gridColumnStart":"2","gridColumnEnd":"3","gridRowStart":"1","gridRowEnd":"2"},"children":[]},
            {"style":{"display":"grid","width":"320px","gridTemplateColumns":["100px","auto"],"gridTemplateRows":["auto"]},"children":[0,1]}
        ]"#;
        let handles = tree.build_tree_batch(json).unwrap();
        tree.compute_layout(handles[2], 320.0, -1.0);
        // **트랙 폭 ≠ 자식 폭** (2026-07-27 정정): col0 은 100px 고정이지만, 그 안의
        //   자식은 `width:60px` 명시라 stretch 되지 않고 60 을 유지한다 (CSS-ALIGN-3
        //   §4.1 — stretch 는 크기가 auto 일 때만). 구 assertion 은 자식 폭에 트랙 폭
        //   100 을 기대해 결함을 고정하고 있었다. Chrome 실측: c0=(0,0,**60**,20).
        //   트랙이 100 인 근거는 형제 x=100 이 그대로 증명한다.
        assert_eq!(tree.get_layout(handles[0]).width, 60.0, "자식 명시 60 유지(트랙 100 아님)");
        assert_eq!(tree.get_layout(handles[1]).width, 40.0, "auto col = 자식 intrinsic 40");
        // col1 x = 100(col0) + 0(gap 없음) = 100 — 트랙 폭 100 의 증거.
        assert_eq!(tree.get_layout(handles[1]).x, 100.0, "col1 x = col0 트랙 폭 100");
    }

    /// **implicit auto row (gridTemplateRows 미명시) + placement 명시** — Slider 실구조.
    ///
    /// Slider (2026-07-06 전수조사): `gridTemplateColumns:"1fr auto"`, **gridTemplateRows
    /// 없음** (catalog/implicitStyles 모두 rows 미방출), 자식이 gridRowStart 로 row 명시
    /// (label/output=row1, track=row2). 기존 auto row 측정 두 경로 모두 미커버:
    ///   - 경로 A(implicit_all_auto): `placement_spec.is_empty()` 요구 → placement 있어 실패
    ///   - 경로 B(has_auto_row): `template_rows` 에 "auto" 토큰 요구 → 빈 문자열이라 실패
    /// → `template_rows` 빈 문자열 그대로 grid.rs 전달 → row_tracks 0개 →
    /// cell_bounds_for_child 가 row2 를 track 부재로 y=row_gap 위치에 배치 + height=100
    /// fallback → 전 자식 겹침(track/label 겹침) + height 폭발. CSS 는 row1(20)+gap(4)+
    /// row2(8) = 32, track y=24.
    #[test]
    fn grid_implicit_auto_row_with_placement_slider_realstruct() {
        let mut tree = LayoutTree::new();
        // cols "1fr auto" (rows 미명시), rowGap 4. 부모 height:auto (availH=-1).
        // row0: label(h20, col1)/output(h20, col2). row1: track(h8, col1-3).
        // CSS 기대: 컨테이너 = 20 + gap4 + 8 = 32. track y = 20 + gap4 = 24.
        let json = r#"[
            {"style":{"height":"20px","gridColumnStart":"1","gridColumnEnd":"2","gridRowStart":"1","gridRowEnd":"2"},"children":[]},
            {"style":{"height":"20px","gridColumnStart":"2","gridColumnEnd":"3","gridRowStart":"1","gridRowEnd":"2"},"children":[]},
            {"style":{"width":"100%","height":"8px","gridColumnStart":"1","gridColumnEnd":"3","gridRowStart":"2","gridRowEnd":"3"},"children":[]},
            {"style":{"display":"grid","width":"348px","rowGap":"4px","gridTemplateColumns":["1fr","auto"]},"children":[0,1,2]}
        ]"#;
        let handles = tree.build_tree_batch(json).unwrap();
        let root = handles[3];
        tree.compute_layout(root, 348.0, -1.0); // height:auto sentinel
        // 컨테이너 height = row0(20) + rowGap(4) + row1(8) = 32 (height 폭발/겹침 아님).
        let container = tree.get_layout(root);
        assert_eq!(
            container.height, 32.0,
            "implicit auto row + placement = row0(20)+gap(4)+row1(8) = 32"
        );
        // 각 셀 높이 = 그 row 자식 intrinsic (100 fallback 아님).
        assert_eq!(tree.get_layout(handles[0]).height, 20.0, "row0 label = 20 (not 100)");
        assert_eq!(tree.get_layout(handles[2]).height, 8.0, "row1 track = 8 (not 100)");
        // label row1 y=0, track row2 y = row0(20) + gap(4) = 24 (겹침 아님).
        assert_eq!(tree.get_layout(handles[0]).y, 0.0, "label row0 y=0");
        assert_eq!(tree.get_layout(handles[2]).y, 24.0, "track row1 y = row0 20 + gap 4 = 24");
        // track 은 col1-3 span → 전체 폭 348.
        assert_eq!(tree.get_layout(handles[2]).width, 348.0, "track span 전체 348");
    }

    /// ProgressBar 실구조 통합: `gridTemplateColumns:"1fr auto"` + `gridTemplateRows:"auto auto"`
    /// 동시 auto (row·column 양쪽 측정 경로 동시 실행) + placement 명시.
    /// row·column 결과 explicit assertion 으로 두 측정 경로 상호작용 확증.
    #[test]
    fn grid_progressbar_realstruct_row_and_col_auto() {
        let mut tree = LayoutTree::new();
        // cols "1fr auto" / rows "auto auto" at 320.
        // row0: label(col1, h20) / value(col2, w30 h20). row1: track(col1-3, h8, w100%).
        // → col1(auto)=value 30, col0(1fr)=320-30=290. row0=20, row1=8.
        let json = r#"[
            {"style":{"width":"60px","height":"20px","gridColumnStart":"1","gridColumnEnd":"2","gridRowStart":"1","gridRowEnd":"2"},"children":[]},
            {"style":{"width":"30px","height":"20px","gridColumnStart":"2","gridColumnEnd":"3","gridRowStart":"1","gridRowEnd":"2"},"children":[]},
            {"style":{"width":"100%","height":"8px","gridColumnStart":"1","gridColumnEnd":"3","gridRowStart":"2","gridRowEnd":"3"},"children":[]},
            {"style":{"display":"grid","width":"320px","gridTemplateColumns":["1fr","auto"],"gridTemplateRows":["auto","auto"]},"children":[0,1,2]}
        ]"#;
        let handles = tree.build_tree_batch(json).unwrap();
        let root = handles[3];
        tree.compute_layout(root, 320.0, -1.0);
        // 컨테이너 = row0(20) + row1(8) = 28 (availH 폭발 아님).
        assert_eq!(tree.get_layout(root).height, 28.0, "컨테이너 = row0+row1 = 28");
        // column: auto col1(value) = 30, 1fr col0(label) = 290.
        assert_eq!(tree.get_layout(handles[1]).width, 30.0, "value auto col = intrinsic 30");
        assert_eq!(tree.get_layout(handles[1]).x, 290.0, "value 우측 (1fr 흡수 후)");
        // **트랙 폭 ≠ 자식 폭** (2026-07-27 정정) — label 은 `width:60px` 명시라 1fr
        //   트랙(290)으로 늘어나지 않는다. Chrome 실측: label=(0,0,**60**,20).
        //   트랙이 290 인 근거는 형제 value.x=290 이 증명한다.
        assert_eq!(tree.get_layout(handles[0]).width, 60.0, "label 명시 60 유지(1fr 290 아님)");
        // row: row0=20 (label/value), row1=8 (track), track y=20.
        assert_eq!(tree.get_layout(handles[0]).height, 20.0, "row0 label = 20");
        assert_eq!(tree.get_layout(handles[2]).height, 8.0, "row1 track = 8");
        assert_eq!(tree.get_layout(handles[2]).y, 20.0, "track row1 y = row0 20");
        // track 은 col1-3 span → 전체 폭 320.
        assert_eq!(tree.get_layout(handles[2]).width, 320.0, "track span 전체 320");
    }

    /// auto column + gridColumnStart 미명시 → row-major col fallback(i % col_count).
    /// c0→col0, c1→col1 (i % row_count 로 뭉치는 버그 회귀 방지).
    #[test]
    fn grid_auto_column_col_major_fallback() {
        let mut tree = LayoutTree::new();
        // cols "auto auto", 자식 2개 placement 미명시. row-major: c0→col0(w40), c1→col1(w60).
        let json = r#"[
            {"style":{"width":"40px","height":"20px"},"children":[]},
            {"style":{"width":"60px","height":"20px"},"children":[]},
            {"style":{"display":"grid","width":"300px","gridTemplateColumns":["auto","auto"],"gridTemplateRows":["auto"]},"children":[0,1]}
        ]"#;
        let handles = tree.build_tree_batch(json).unwrap();
        tree.compute_layout(handles[2], 300.0, -1.0);
        // col0 = c0 intrinsic 40, col1 = c1 intrinsic 60 (둘 다 col0 로 뭉치지 않음).
        assert_eq!(tree.get_layout(handles[0]).width, 40.0, "c0 → col0 = 40");
        assert_eq!(tree.get_layout(handles[1]).width, 60.0, "c1 → col1 = 60");
        assert_eq!(tree.get_layout(handles[0]).x, 0.0, "c0 col0 x=0");
        // col0 폭 = 내용 40 + §12.8 여유 분배 100 = 140 (Chrome 실측: c1.x=140).
        // **트랙 폭 ≠ 자식 폭** — 자식은 40/60 그대로고, 열 분리는 이 x 가 증명한다.
        assert_eq!(tree.get_layout(handles[1]).x, 140.0, "c1 col1 x = col0 트랙 140");
    }

    /// 명시 auto row 혼합: px row 는 고정 유지, auto row 만 intrinsic 측정.
    ///
    /// px row(40) 는 트랙 크기로 고정되지만, 그 row 의 **짧은 explicit 자식**(c0: 20)은
    /// stretch 로 셀을 채우지 않고 explicit height 유지 + top 정렬한다 (ADR-156 옵션 3-a
    /// 세로축). row0=40px 인 증거는 c1.y=40 (row1 시작). Chrome ground truth 실측:
    /// c0 {y:0, h:20} (parity harness Case D).
    #[test]
    fn grid_mixed_px_and_auto_rows_preserve_px() {
        let mut tree = LayoutTree::new();
        // rows "40px auto". row0 자식 h=20(셀 40 안에서 20 유지), row1 자식 h=25(auto 측정).
        let json = r#"[
            {"style":{"height":"20px","gridColumnStart":"1","gridColumnEnd":"2","gridRowStart":"1","gridRowEnd":"2"},"children":[]},
            {"style":{"height":"25px","gridColumnStart":"1","gridColumnEnd":"2","gridRowStart":"2","gridRowEnd":"3"},"children":[]},
            {"style":{"display":"grid","width":"200px","gridTemplateColumns":["1fr"],"gridTemplateRows":["40px","auto"]},"children":[0,1]}
        ]"#;
        let handles = tree.build_tree_batch(json).unwrap();
        tree.compute_layout(handles[2], 200.0, -1.0);
        // c0 은 explicit 20 유지(px row 40 로 stretch 안 함) + top 정렬.
        assert_eq!(tree.get_layout(handles[0]).height, 20.0, "c0 explicit 20 유지(셀 40)");
        assert_eq!(tree.get_layout(handles[0]).y, 0.0, "c0 top 정렬");
        assert_eq!(tree.get_layout(handles[1]).height, 25.0, "auto row = 자식 intrinsic 25");
        // px row 는 여전히 40 (c1 이 row1 = y=40 에서 시작 → row0 트랙 40 고정 증거).
        assert_eq!(tree.get_layout(handles[1]).y, 40.0, "row1 y = px row 40");
        assert_eq!(tree.get_layout(handles[2]).height, 65.0, "컨테이너 = 40 + 25 = 65");
    }

    /// 명시 auto row — placement 로 중간 row 건너뜀 → 빈 auto row = 0.
    #[test]
    fn grid_explicit_auto_row_skipped_is_zero() {
        let mut tree = LayoutTree::new();
        // rows "auto auto auto". 자식은 row1(gridRowStart:1)·row3(gridRowStart:3)만 → row2 빈 auto.
        let json = r#"[
            {"style":{"height":"20px","gridColumnStart":"1","gridColumnEnd":"2","gridRowStart":"1","gridRowEnd":"2"},"children":[]},
            {"style":{"height":"30px","gridColumnStart":"1","gridColumnEnd":"2","gridRowStart":"3","gridRowEnd":"4"},"children":[]},
            {"style":{"display":"grid","width":"200px","gridTemplateColumns":["1fr"],"gridTemplateRows":["auto","auto","auto"]},"children":[0,1]}
        ]"#;
        let handles = tree.build_tree_batch(json).unwrap();
        tree.compute_layout(handles[2], 200.0, -1.0);
        assert_eq!(tree.get_layout(handles[0]).height, 20.0, "row0 = 20");
        assert_eq!(tree.get_layout(handles[1]).height, 30.0, "row2 = 30");
        // row1 빈 auto = 0 → row2 자식 y = row0(20) + row1(0) = 20.
        assert_eq!(tree.get_layout(handles[1]).y, 20.0, "빈 auto row1=0 → row2 y=20");
        assert_eq!(tree.get_layout(handles[2]).height, 50.0, "컨테이너 = 20+0+30 = 50");
    }

    // ── 컨테이너 own padding — 자식 available 감산 + 좌표 offset + percent ctx ──

    /// 부모 padding → 자식 available 은 content 폭, 자식 좌표는 padding 안쪽 원점.
    #[test]
    fn block_parent_padding_shrinks_child_avail_and_offsets_origin() {
        let mut tree = LayoutTree::new();
        // 부모 border-box 300 + padding 20 사방 → content 260.
        // auto 자식 stretch = 260, 좌표 (20, 20).
        let json = r#"[
            {"style":{"height":"30px"},"children":[]},
            {"style":{"display":"block","width":"300px","height":"200px","paddingTop":"20px","paddingRight":"20px","paddingBottom":"20px","paddingLeft":"20px"},"children":[0]}
        ]"#;
        let handles = tree.build_tree_batch(json).unwrap();
        tree.compute_layout(handles[1], 400.0, 400.0);
        let c0 = tree.get_layout(handles[0]);
        assert_eq!(c0.width, 260.0, "auto 자식 stretch = 부모 content 폭");
        assert_eq!(c0.x, 20.0, "부모 padding-left 안쪽 원점");
        assert_eq!(c0.y, 20.0, "부모 padding-top 안쪽 원점");
    }

    /// flex 부모 padding → 동일 (available 감산 + 원점 offset).
    #[test]
    fn flex_parent_padding_shrinks_avail_and_offsets_origin() {
        let mut tree = LayoutTree::new();
        let json = r#"[
            {"style":{"width":"50px","height":"30px"},"children":[]},
            {"style":{"display":"flex","width":"300px","height":"100px","paddingTop":"10px","paddingLeft":"10px","paddingRight":"10px","paddingBottom":"10px","justifyContent":"flex-end"},"children":[0]}
        ]"#;
        let handles = tree.build_tree_batch(json).unwrap();
        tree.compute_layout(handles[1], 400.0, 400.0);
        let c0 = tree.get_layout(handles[0]);
        // main avail = 300-20=280, flex-end → x = 10(offset) + 280-50 = 240.
        assert_eq!(c0.x, 240.0, "flex-end 위치가 content 폭 기준 + padding offset");
        assert_eq!(c0.y, 10.0, "padding-top offset");
    }

    /// grid 부모 padding → 1fr 트랙이 content 폭 기준, 셀 좌표 offset.
    #[test]
    fn grid_parent_padding_shrinks_tracks_and_offsets_cells() {
        let mut tree = LayoutTree::new();
        let json = r#"[
            {"style":{},"children":[]},
            {"style":{},"children":[]},
            {"style":{"display":"grid","width":"220px","height":"100px","gridTemplateColumns":["1fr","1fr"],"gridTemplateRows":["50px"],"paddingTop":"10px","paddingLeft":"10px","paddingRight":"10px","paddingBottom":"10px"},"children":[0,1]}
        ]"#;
        let handles = tree.build_tree_batch(json).unwrap();
        tree.compute_layout(handles[2], 400.0, 400.0);
        let c0 = tree.get_layout(handles[0]);
        let c1 = tree.get_layout(handles[1]);
        assert_eq!(c0.width, 100.0, "1fr = (220-20)/2");
        assert_eq!(c0.x, 10.0, "셀 x = padding-left offset");
        assert_eq!(c1.x, 110.0, "셀2 x = 10 + 100");
        assert_eq!(c0.y, 10.0, "셀 y = padding-top offset");
    }

    // ── position:absolute (out-of-flow) ──
    //
    // 2026-07-14: 엔진이 absolute/inset 을 아예 읽지 않아 absolute 자식이 항상 부모
    //   원점(0,0)에 고정되던 버그 회귀 게이트 (SliderThumb 가 value 위치로 안 가던 원인).

    #[test]
    fn absolute_child_positioned_by_inset() {
        let mut tree = LayoutTree::new();
        let json = r#"[
            {"style":{"position":"absolute","left":"30px","top":"10px","width":"20px","height":"20px","insetLeft":"30px","insetTop":"10px"},"children":[]},
            {"style":{"display":"block","position":"relative","width":"200px","height":"100px"},"children":[0]}
        ]"#;
        let handles = tree.build_tree_batch(json).unwrap();
        tree.compute_layout(handles[1], 400.0, 400.0);
        let c = tree.get_layout(handles[0]);
        assert_eq!(c.x, 30.0, "insetLeft 가 x 로 반영");
        assert_eq!(c.y, 10.0, "insetTop 이 y 로 반영");
        assert_eq!((c.width, c.height), (20.0, 20.0));
    }

    #[test]
    fn absolute_child_percent_inset_uses_containing_block() {
        let mut tree = LayoutTree::new();
        // containing block = 부모 padding box (200×100). left:50% → 100.
        let json = r#"[
            {"style":{"position":"absolute","insetLeft":"50%","width":"20px","height":"20px"},"children":[]},
            {"style":{"display":"block","position":"relative","width":"200px","height":"100px"},"children":[0]}
        ]"#;
        let handles = tree.build_tree_batch(json).unwrap();
        tree.compute_layout(handles[1], 400.0, 400.0);
        let c = tree.get_layout(handles[0]);
        assert_eq!(c.x, 100.0, "left:50% = containing block 폭의 절반");
    }

    #[test]
    fn absolute_flex_container_keeps_its_padding_and_border_in_border_box() {
        let mut tree = LayoutTree::new();
        // Live Builder regression: 두 Button(69×30)을 row Frame(gap 20, padding 20,
        // border 2) 안에 둔 뒤 Frame 자체를 absolute로 전환한다. Frame의 content-box는
        // 69 + 20 + 69 = 158, 30 이지만, CSS border-box는 202×74여야 한다.
        let json = r#"[
            {"style":{"width":"69px","height":"30px"},"children":[]},
            {"style":{"width":"69px","height":"30px"},"children":[]},
            {"style":{"display":"flex","flexDirection":"row","position":"absolute","insetLeft":"92px","insetTop":"224px","columnGap":"20px","paddingTop":"20px","paddingRight":"20px","paddingBottom":"20px","paddingLeft":"20px","borderTop":"2px","borderRight":"2px","borderBottom":"2px","borderLeft":"2px"},"children":[0,1]},
            {"style":{"display":"block","position":"relative","width":"390px","height":"844px"},"children":[2]}
        ]"#;
        let handles = tree.build_tree_batch(json).unwrap();
        tree.compute_layout(handles[3], 390.0, 844.0);

        let frame = tree.get_layout(handles[2]);
        assert_eq!(frame.x, 92.0, "absolute left inset 유지");
        assert_eq!(frame.y, 224.0, "absolute top inset 유지");
        assert_eq!(
            (frame.width, frame.height),
            (202.0, 74.0),
            "absolute Frame도 padding(40)과 border(4)를 포함한 border-box여야 한다",
        );
    }

    #[test]
    fn absolute_child_negative_margin_offsets_center() {
        let mut tree = LayoutTree::new();
        // **SliderThumb 실제 케이스**: 트랙 350×8, thumb 18px, value=50%.
        //   left:50% + marginLeft:-9 → x = 175 - 9 = 166 (중심 175).
        //   top:trackHeight/2 - thumbSize/2 = 4 - 9 = -5 (중심 4) — 음수 inset 허용.
        let json = r#"[
            {"style":{"position":"absolute","insetLeft":"50%","insetTop":"-5px","marginLeft":"-9px","width":"18px","height":"18px"},"children":[]},
            {"style":{"display":"grid","position":"relative","width":"350px","height":"8px"},"children":[0]}
        ]"#;
        let handles = tree.build_tree_batch(json).unwrap();
        tree.compute_layout(handles[1], 400.0, 400.0);
        let c = tree.get_layout(handles[0]);
        assert_eq!(c.x, 166.0, "left:50%(175) + marginLeft:-9 → 166 (중심 175)");
        assert_eq!(c.y, -5.0, "음수 insetTop 보존 (트랙 위로 넘침 — 중심 4)");
        // 중심이 DOM(175, 4) 과 일치.
        assert_eq!(c.x + c.width / 2.0, 175.0, "thumb 중심 x = DOM 과 동일");
        assert_eq!(c.y + c.height / 2.0, 4.0, "thumb 중심 y = 트랙 세로 중앙");
    }

    // ── flex-basis ────────────────────────────────────────────────────────
    //
    // `NodeStyle.flex_basis` 는 선언·역직렬화만 되고 **write_flex_item 이 항상 AUTO(-1)
    // 를 써넣어** flex.rs 의 basis 해석 우선순위(명시 basis → width → content)에
    // 명시 basis 가 도달하지 못했다 (inset_* 와 동형 silent failure).
    //
    // 실제 사고 (TagGroup labelPosition="side"): TagList 가 `flex:1`(grow 1, basis 0%)
    //   인데 basis 가 AUTO → content(칩 합산 폭)로 fallback → 컨테이너를 넘겨 wrap →
    //   Label 옆이 아니라 **둘째 줄**로 밀림. DOM 은 basis 0 이 이겨 정상 가로 배치.

    /// `%` flex-basis 는 main 이 **indefinite** 면 `content` 로 취급 (CSS §9.2.3).
    ///
    /// **Why (DatePicker, 2026-07-14)**: DatePicker(column, width auto) > SelectTrigger
    ///   (row, width auto — 부모 cross 가 auto 라 indefinite) > DateInput(`flex:1` → basis 0%).
    ///   `0%` 를 그대로 0 으로 두면 grow 할 free space 도 없어(indefinite) DateInput 이
    ///   **w=0 으로 붕괴** → DatePicker 가 Label 폭(74)까지만 수축 (DOM 은 113).
    ///   basis 를 content 로 보면 intrinsic 폭(71)이 살아 trigger/DatePicker 가 콘텐츠를 감싼다.
    /// DatePicker 실측 회귀 (2026-07-14 2차): `height:100%` 자식이 **explicit height 부모** 안에서
    /// 0 이 되면 안 된다.
    ///
    /// 실측 batch: SelectTrigger(row, height 30px explicit, padding 4/4, border 1/1)
    ///   > DateInput(width 102px, `height:100%`, flex:1 basis 0%).
    /// trigger content-box = 30 - 8 - 2 = 20 → DateInput height 20 이어야 한다.
    /// 회귀 시 h=0 (Skia DateInput 이 안 보임).
    #[test]
    fn percent_height_child_resolves_against_explicit_parent_content_box() {
        let mut tree = LayoutTree::new();
        // post-order: DateInput(0), SelectIcon(1), SelectTrigger(2)
        let json = r#"[
            {"style":{"display":"block","width":"102px","height":"100%","flexGrow":1,"flexShrink":1,"flexBasis":"0%","minWidth":"0px"},"children":[]},
            {"style":{"display":"block","width":"18px","height":"18px","flexShrink":0},"children":[]},
            {"style":{"display":"flex","flexDirection":"row","alignItems":"center","columnGap":"4px","height":"30px","width":"100%",
                      "paddingTop":"4px","paddingBottom":"4px","paddingLeft":"12px","paddingRight":"4px",
                      "borderTop":"1px","borderBottom":"1px","borderLeft":"1px","borderRight":"1px"},"children":[0,1]}
        ]"#;
        let handles = tree.build_tree_batch(json).unwrap();
        tree.compute_layout(handles[2], 390.0, 400.0);

        let di = tree.get_layout(handles[0]);
        assert_eq!(di.height, 20.0, "height:100% 가 0 으로 붕괴 (부모 content-box 20)");
        let trg = tree.get_layout(handles[2]);
        assert_eq!(trg.height, 30.0, "trigger 가 explicit 30 을 유지해야 함");
    }

    /// 위와 동일하나 **실측 전체 체인** (body block > DatePicker column > trigger row > DateInput).
    /// live 에서 DateInput h=0 / trigger h=28 로 나오던 회귀 — 부모 체인을 포함해야 재현된다.
    #[test]
    fn datepicker_full_chain_dateinput_percent_height_not_zero() {
        let mut tree = LayoutTree::new();
        // post-order: Label(0), DateInput(1), SelectIcon(2), SelectTrigger(3), DatePicker(4), body(5)
        // live batch 실측 그대로 (2026-07-14) — body 는 width/height explicit.
        let json = r#"[
            {"style":{"display":"block","width":"fit-content","height":"20px","minWidth":"74px","flexShrink":0},"children":[]},
            {"style":{"display":"block","width":"102px","height":"100%","flexGrow":1,"flexShrink":1,"flexBasis":"0%","minWidth":"0px"},"children":[]},
            {"style":{"display":"block","width":"18px","height":"18px","flexShrink":0},"children":[]},
            {"style":{"display":"flex","flexDirection":"row","alignItems":"center","columnGap":"4px","rowGap":"4px","height":"30px","width":"100%",
                      "paddingTop":"4px","paddingBottom":"4px","paddingLeft":"12px","paddingRight":"4px",
                      "borderTop":"1px","borderBottom":"1px","borderLeft":"1px","borderRight":"1px"},"children":[1,2]},
            {"style":{"display":"flex","flexDirection":"column","alignItems":"flex-start","rowGap":"4px","columnGap":"4px"},"children":[0,3]},
            {"style":{"display":"block","width":"390px","height":"844px","overflowX":"auto","overflowY":"auto"},"children":[4]}
        ]"#;
        let handles = tree.build_tree_batch(json).unwrap();
        tree.compute_layout(handles[5], 390.0, 844.0);

        // block body 는 DatePicker(block-level)를 390 으로 **stretch** → 그 안의
        //   trigger `width:100%` 도 390 이어야 한다(DOM 실측 390). shrink-to-fit 으로
        //   오판하면 trigger 가 콘텐츠 폭(160)으로 수축한다.
        let dp = tree.get_layout(handles[4]);
        assert_eq!(dp.width, 390.0, "block 부모 안 DatePicker 는 390 으로 stretch");
        let trg_w = tree.get_layout(handles[3]).width;
        assert_eq!(trg_w, 390.0, "trigger width:100% → 390 (160 으로 수축 회귀)");

        let di = tree.get_layout(handles[1]);
        let trg = tree.get_layout(handles[3]);
        assert_eq!(trg.height, 30.0, "trigger explicit height 30 유지 (live 28 회귀)");
        assert_eq!(di.height, 20.0, "DateInput height:100% → 부모 content-box 20 (live 0 회귀)");
    }

    /// `flex:1`(basis 0%) 자식이 **definite main 컨테이너 안에서 grow** 해야 한다.
    ///
    /// 회귀 (2026-07-14, DatePicker): column DatePicker 의 `align-items:flex-start` 가
    ///   **cross 를 명시한 자식(SelectTrigger `width:100%`)에게까지** indefinite width 를
    ///   내려 → trigger 의 main(row=width) 이 indefinite → flex.rs Step 0 early-return 으로
    ///   **grow 분배 전체 skip** → `flex:1`(basis 0%) DateInput 이 **폭 0** 으로 붕괴.
    ///   (DOM 은 grow 로 308.) `align-items` 는 auto-cross 자식만 대상이다.
    #[test]
    fn flex_grow_basis_zero_child_grows_in_definite_main_container() {
        let mut tree = LayoutTree::new();
        // live batch 실측 그대로 (2026-07-14, JS 가 intrinsic width 를 굳히지 않게 고친 뒤):
        //   DateInput 은 width 없음 + `flex:1`(grow 1 / basis 0%) + minWidth 0.
        // post-order: Label(0), DateInput(1), SelectIcon(2), SelectTrigger(3), DatePicker(4), body(5)
        let json = r#"[
            {"style":{"display":"block","width":"fit-content","height":"20px","minWidth":"74px","flexShrink":0},"children":[]},
            {"style":{"display":"block","height":"100%","flexGrow":1,"flexShrink":1,"flexBasis":"0%","minWidth":"0px"},"children":[]},
            {"style":{"display":"block","width":"18px","height":"18px","flexShrink":0},"children":[]},
            {"style":{"display":"flex","flexDirection":"row","alignItems":"center","columnGap":"4px","rowGap":"4px","height":"30px","width":"100%",
                      "paddingTop":"4px","paddingBottom":"4px","paddingLeft":"12px","paddingRight":"4px",
                      "borderTop":"1px","borderBottom":"1px","borderLeft":"1px","borderRight":"1px"},"children":[1,2]},
            {"style":{"display":"flex","flexDirection":"column","alignItems":"flex-start","rowGap":"4px","columnGap":"4px"},"children":[0,3]},
            {"style":{"display":"block","width":"390px","height":"844px","overflowX":"auto","overflowY":"auto"},"children":[4]}
        ]"#;
        let handles = tree.build_tree_batch(json).unwrap();
        tree.compute_layout(handles[5], 390.0, 844.0);

        let trg = tree.get_layout(handles[3]);
        assert_eq!(trg.width, 390.0, "trigger width:100% → 390");

        // trigger content-box = 390 - paddingL 12 - paddingR 4 - border 2 = 372.
        // 372 - icon 18 - gap 4 = 350 → DateInput 이 남은 공간을 전부 grow.
        let di = tree.get_layout(handles[1]);
        assert_eq!(di.width, 350.0, "flex:1 (basis 0%) → 남은 공간 grow (0 붕괴 회귀)");
        assert_eq!(di.height, 20.0, "height:100% → trigger content-box 20");

        // icon 은 DateInput 뒤로 밀려난다 — grow 가 죽으면 x=17 로 딸려온다.
        let ic = tree.get_layout(handles[2]);
        assert_eq!(ic.x, 367.0, "icon 이 grow 된 DateInput 뒤에 배치 (x=17 회귀)");
    }

    #[test]
    fn percent_flex_basis_with_indefinite_main_falls_back_to_content() {
        let mut tree = LayoutTree::new();
        // post-order: DateInput(0, flex:1 basis 0%, intrinsic 71), icon(1, 18),
        //             trigger(2, row, width auto), DatePicker(3, column, width auto),
        //             body(4, flex column, align-items:flex-start → DatePicker 를 shrink-wrap)
        //
        // shrink-wrap 부모가 있어야 DatePicker 의 cross(width) 가 indefinite 가 된다 —
        // root 로 직접 solve 하면 부모가 definite available 을 내려준 것과 같아(rule (b))
        // stretch 되므로 이 시나리오가 재현되지 않는다.
        let json = r#"[
            {"style":{"width":"71px","height":"20px","flexGrow":1,"flexShrink":1,"flexBasis":"0%"},"children":[]},
            {"style":{"width":"18px","height":"18px"},"children":[]},
            {"style":{"display":"flex","flexDirection":"row","alignItems":"center","columnGap":"4px"},"children":[0,1]},
            {"style":{"display":"flex","flexDirection":"column"},"children":[2]},
            {"style":{"display":"flex","flexDirection":"column","alignItems":"flex-start","width":"350px"},"children":[3]}
        ]"#;
        let handles = tree.build_tree_batch(json).unwrap();
        tree.compute_layout(handles[4], 350.0, 400.0);

        let di = tree.get_layout(handles[0]);
        assert_eq!(di.width, 71.0, "basis 0% 가 0 으로 굳어 DateInput 이 붕괴");
        // trigger = 71 + gap 4 + icon 18 = 93 (콘텐츠 폭), 350 아님.
        let trg = tree.get_layout(handles[2]);
        assert_eq!(trg.width, 93.0);
        let dp = tree.get_layout(handles[3]);
        assert_eq!(dp.width, 93.0);
    }

    #[test]
    fn flex_basis_zero_percent_grows_into_remaining_space() {
        let mut tree = LayoutTree::new();
        // **TagGroup side 실제 케이스**: 컨테이너 350(row), Label 68 고정,
        //   TagList `flex:1`(basis 0%) → 남은 폭 350-68-4(gap)=278 전부 차지.
        //   basis 가 content(자식 합산 400)로 fallback 하면 wrap 되어 둘째 줄로 밀린다.
        let json = r#"[
            {"style":{"width":"68px","height":"20px","flexShrink":0},"children":[]},
            {"style":{"width":"400px","height":"30px"},"children":[]},
            {"style":{"display":"flex","flexGrow":1,"flexShrink":1,"flexBasis":"0%","minWidth":"0px","height":"30px"},"children":[1]},
            {"style":{"display":"flex","flexDirection":"row","flexWrap":"wrap","columnGap":"4px","width":"350px"},"children":[0,2]}
        ]"#;
        let handles = tree.build_tree_batch(json).unwrap();
        tree.compute_layout(handles[3], 350.0, 400.0);
        let label = tree.get_layout(handles[0]);
        let list = tree.get_layout(handles[2]);
        assert_eq!(label.x, 0.0, "Label 은 좌측");
        assert_eq!(
            list.x, 72.0,
            "basis:0% → Label(68) + gap(4) 뒤에 같은 줄 배치 (wrap 되면 x=0)"
        );
        assert_eq!(list.y, 0.0, "같은 줄 — wrap 되면 y > 0");
        assert_eq!(
            list.width, 278.0,
            "grow 로 남은 폭 전부 (350 - 68 - 4). basis=content(400) 면 wrap"
        );
    }

    // ── flex item 재-solve (used size 로 내용 재배치) ──────────────────────
    //
    // CSS: flex item 의 최종 used main size 가 확정되면 **그 크기로 item 의 내용을 다시
    // 배치**한다. 기존 solve_flex 는 자식을 **분배 전 available 폭**으로 한 번만 solve 하고,
    // grow/shrink 로 폭이 바뀌어도 subtree 를 재-solve 하지 않았다 → 자식 내부의 wrap /
    // `%` / auto height 가 **분배 전 폭** 기준으로 굳는다.
    //
    // 실제 사고 (TagGroup labelPosition="side"): TagList(flex:1) 가 350 available 로 solve
    //   되어 칩이 350 기준으로 wrap → 분배 후 실제 폭 278 인데 칩 배치는 350 기준 그대로 →
    //   **칩이 한 줄로 나열되며 TagGroup 영역을 벗어남**. DOM 은 278 에서 2줄 wrap.

    #[test]
    fn flex_item_subtree_relayouts_at_used_width() {
        let mut tree = LayoutTree::new();
        // **TagGroup side 실제 케이스**: 컨테이너 350, Label 68 + gap 4 → TagList 는 278.
        //   TagList 안의 칩(90/54/96/67) 은 278 폭에서 wrap 되어야 한다:
        //     row1: 90 + 4 + 54 + 4 + 96 = 248, 다음 67 은 248+4+67=319 > 278 → row2.
        //   분배 전 폭(350)으로 굳으면 4개가 전부 1줄(90+54+96+67+gap*3 = 319 ≤ 350) →
        //   TagList height 30(1줄) + 칩이 자기 박스(278)를 넘침.
        let json = r#"[
            {"style":{"width":"68px","height":"20px","flexShrink":0},"children":[]},
            {"style":{"width":"90px","height":"30px","flexShrink":0},"children":[]},
            {"style":{"width":"54px","height":"30px","flexShrink":0},"children":[]},
            {"style":{"width":"96px","height":"30px","flexShrink":0},"children":[]},
            {"style":{"width":"67px","height":"30px","flexShrink":0},"children":[]},
            {"style":{"display":"flex","flexDirection":"row","flexWrap":"wrap","columnGap":"4px","rowGap":"4px","flexGrow":1,"flexShrink":1,"flexBasis":"0%","minWidth":"0px"},"children":[1,2,3,4]},
            {"style":{"display":"flex","flexDirection":"row","flexWrap":"wrap","columnGap":"4px","alignItems":"flex-start","width":"350px"},"children":[0,5]}
        ]"#;
        let handles = tree.build_tree_batch(json).unwrap();
        tree.compute_layout(handles[6], 350.0, 400.0);

        let list = tree.get_layout(handles[5]);
        assert_eq!(list.width, 278.0, "TagList = 350 - 68 - 4");

        // 칩 4개가 278 폭에서 2줄로 wrap — 4번째(67px)가 둘째 줄.
        let c4 = tree.get_layout(handles[4]);
        assert!(
            c4.y > 0.0,
            "4번째 칩은 둘째 줄이어야 한다 (분배 전 350 으로 굳으면 y=0 한 줄). y={}",
            c4.y
        );
        // 칩이 자기 컨테이너(278) 안에 들어와야 한다 — 넘치면 TagGroup 밖으로 삐져나감.
        for (i, &h) in [handles[1], handles[2], handles[3], handles[4]]
            .iter()
            .enumerate()
        {
            let c = tree.get_layout(h);
            assert!(
                c.x + c.width <= 278.0 + 0.5,
                "칩 {} 이 TagList(278) 를 벗어남: x={} w={}",
                i,
                c.x,
                c.width
            );
        }
        // TagList height = 2줄 (30 + 4 + 30 = 64).
        assert_eq!(list.height, 64.0, "2줄 wrap → 30 + rowGap4 + 30");
    }

    #[test]
    fn flex_item_shrink_relayouts_text_like_child_height() {
        let mut tree = LayoutTree::new();
        // shrink 로 좁아진 item 안의 wrap 컨테이너도 재-solve 대상.
        //   컨테이너 200, item 은 shrink 되어 100 → 안의 60px 블록 2개가 1줄(124>100 이라 2줄).
        let json = r#"[
            {"style":{"width":"60px","height":"10px","flexShrink":0},"children":[]},
            {"style":{"width":"60px","height":"10px","flexShrink":0},"children":[]},
            {"style":{"display":"flex","flexDirection":"row","flexWrap":"wrap","columnGap":"4px","rowGap":"4px","width":"200px","flexShrink":1},"children":[0,1]},
            {"style":{"width":"100px","height":"10px","flexShrink":0},"children":[]},
            {"style":{"display":"flex","flexDirection":"row","width":"200px"},"children":[2,3]}
        ]"#;
        let handles = tree.build_tree_batch(json).unwrap();
        tree.compute_layout(handles[4], 200.0, 200.0);
        let item = tree.get_layout(handles[2]);
        assert_eq!(item.width, 100.0, "shrink → 200 - 100 = 100");
        let b = tree.get_layout(handles[1]);
        assert!(
            b.y > 0.0,
            "shrink 후 폭 100 에서 60+4+60=124 > 100 → 둘째 줄. y={}",
            b.y
        );
    }

    #[test]
    fn flex_basis_explicit_px_overrides_width() {
        let mut tree = LayoutTree::new();
        // CSS: flex-basis 는 main 축에서 width 를 이긴다 (grow/shrink 0 이면 basis 그대로).
        let json = r#"[
            {"style":{"width":"200px","flexBasis":"50px","flexGrow":0,"flexShrink":0,"height":"10px"},"children":[]},
            {"style":{"display":"flex","flexDirection":"row","width":"300px"},"children":[0]}
        ]"#;
        let handles = tree.build_tree_batch(json).unwrap();
        tree.compute_layout(handles[1], 300.0, 100.0);
        let c = tree.get_layout(handles[0]);
        assert_eq!(c.width, 50.0, "flex-basis(50) 가 width(200) 를 이긴다");
    }

    #[test]
    fn flex_basis_auto_falls_back_to_width() {
        let mut tree = LayoutTree::new();
        // basis:auto → width 사용 (기존 동작 보존 — 회귀 가드).
        let json = r#"[
            {"style":{"width":"120px","flexBasis":"auto","flexGrow":0,"flexShrink":0,"height":"10px"},"children":[]},
            {"style":{"display":"flex","flexDirection":"row","width":"300px"},"children":[0]}
        ]"#;
        let handles = tree.build_tree_batch(json).unwrap();
        tree.compute_layout(handles[1], 300.0, 100.0);
        assert_eq!(tree.get_layout(handles[0]).width, 120.0, "basis:auto → width");
    }

    #[test]
    fn flex_basis_percent_resolves_against_main_axis_in_column() {
        let mut tree = LayoutTree::new();
        // column 컨테이너의 main 축은 **height**. basis 50% 는 컨테이너 height(200)
        //   기준 100 이어야 한다 (width 300 기준 150 이 아니라).
        let json = r#"[
            {"style":{"flexBasis":"50%","flexGrow":0,"flexShrink":0,"width":"10px"},"children":[]},
            {"style":{"display":"flex","flexDirection":"column","width":"300px","height":"200px"},"children":[0]}
        ]"#;
        let handles = tree.build_tree_batch(json).unwrap();
        tree.compute_layout(handles[1], 300.0, 200.0);
        assert_eq!(
            tree.get_layout(handles[0]).height,
            100.0,
            "column main=height → 50% of 200 (width 기준 150 이면 축 매핑 오류)"
        );
    }

    #[test]
    fn absolute_child_excluded_from_container_size_and_siblings() {
        let mut tree = LayoutTree::new();
        // out-of-flow: absolute 자식은 auto 컨테이너 크기에 기여하지 않고,
        //   in-flow 형제의 배치(block 세로 stacking)도 밀지 않는다.
        let json = r#"[
            {"style":{"position":"absolute","insetLeft":"0px","insetTop":"0px","width":"500px","height":"500px"},"children":[]},
            {"style":{"height":"30px"},"children":[]},
            {"style":{"height":"40px"},"children":[]},
            {"style":{"display":"block","position":"relative","width":"100px"},"children":[0,1,2]}
        ]"#;
        let handles = tree.build_tree_batch(json).unwrap();
        tree.compute_layout(handles[3], 400.0, 400.0);
        let parent = tree.get_layout(handles[3]);
        assert_eq!(parent.height, 70.0, "auto 높이 = in-flow 자식(30+40)만 — absolute 500 제외");
        // in-flow 형제는 absolute 자식을 무시하고 0 부터 stacking.
        assert_eq!(tree.get_layout(handles[1]).y, 0.0, "첫 in-flow 자식 y=0");
        assert_eq!(tree.get_layout(handles[2]).y, 30.0, "둘째 in-flow 자식 y=30 (absolute 영향 없음)");
    }

    #[test]
    fn absolute_child_right_bottom_inset() {
        let mut tree = LayoutTree::new();
        // right/bottom 만 지정 → 반대편에서 역산.
        let json = r#"[
            {"style":{"position":"absolute","insetRight":"10px","insetBottom":"20px","width":"30px","height":"40px"},"children":[]},
            {"style":{"display":"block","position":"relative","width":"200px","height":"100px"},"children":[0]}
        ]"#;
        let handles = tree.build_tree_batch(json).unwrap();
        tree.compute_layout(handles[1], 400.0, 400.0);
        let c = tree.get_layout(handles[0]);
        assert_eq!(c.x, 160.0, "right:10 → x = 200 - 10 - 30");
        assert_eq!(c.y, 40.0, "bottom:20 → y = 100 - 20 - 40");
    }

    #[test]
    fn absolute_child_inside_padded_parent_uses_padding_box() {
        let mut tree = LayoutTree::new();
        // containing block = padding box → 원점이 padding-left/top 만큼 이동.
        let json = r#"[
            {"style":{"position":"absolute","insetLeft":"0px","insetTop":"0px","width":"10px","height":"10px"},"children":[]},
            {"style":{"display":"block","position":"relative","width":"200px","height":"100px","paddingLeft":"20px","paddingTop":"15px","paddingRight":"20px","paddingBottom":"15px"},"children":[0]}
        ]"#;
        let handles = tree.build_tree_batch(json).unwrap();
        tree.compute_layout(handles[1], 400.0, 400.0);
        let c = tree.get_layout(handles[0]);
        assert_eq!(c.x, 20.0, "left:0 = padding box 원점 (padding-left)");
        assert_eq!(c.y, 15.0, "top:0 = padding box 원점 (padding-top)");
    }

    #[test]
    fn absolute_only_child_does_not_collapse_explicit_parent() {
        let mut tree = LayoutTree::new();
        // absolute 자식만 있는 컨테이너 — in-flow 자식 0 이지만 명시 크기 유지 +
        //   absolute 배치는 정상 수행 (leaf 분기에서 조기 반환하지 않아야 함).
        let json = r#"[
            {"style":{"position":"absolute","insetLeft":"25px","insetTop":"5px","width":"10px","height":"10px"},"children":[]},
            {"style":{"display":"grid","position":"relative","width":"100px","height":"50px"},"children":[0]}
        ]"#;
        let handles = tree.build_tree_batch(json).unwrap();
        tree.compute_layout(handles[1], 400.0, 400.0);
        let p = tree.get_layout(handles[1]);
        let c = tree.get_layout(handles[0]);
        assert_eq!((p.width, p.height), (100.0, 50.0), "명시 크기 보존");
        assert_eq!((c.x, c.y), (25.0, 5.0), "absolute 자식 배치 수행");
    }

    // ── position:relative 시각 offset (E10) + absolute 3종 (E11) ──

    /// E10: relative 자식은 in-flow(형제 무이동) + 자기 box 만 inset 만큼 이동.
    #[test]
    fn relative_child_offset_shifts_self_not_siblings() {
        let mut tree = LayoutTree::new();
        // pre(20) → k(relative, left15/top10: flow y=20 → 30) → post(flow y=40 유지).
        let json = r#"[
            {"style":{"display":"block","height":"20px"},"children":[]},
            {"style":{"display":"block","height":"20px","position":"relative","insetLeft":"15px","insetTop":"10px"},"children":[]},
            {"style":{"display":"block","height":"20px"},"children":[]},
            {"style":{"display":"block","width":"300px","height":"600px"},"children":[0,1,2]}
        ]"#;
        let handles = tree.build_tree_batch(json).unwrap();
        tree.compute_layout(handles[3], 300.0, -1.0);
        assert_eq!(tree.get_layout(handles[0]).y, 0.0, "pre flow y=0");
        let k = tree.get_layout(handles[1]);
        assert_eq!(k.x, 15.0, "relative left:15 시각 이동");
        assert_eq!(k.y, 30.0, "flow 20 + top:10 = 30");
        assert_eq!(
            tree.get_layout(handles[2]).y,
            40.0,
            "post 는 k flow box(20..40) 기준 → 40 (relative offset 무영향)"
        );
    }

    /// E11 ①: 양측 inset + 크기 auto → containing block 안에서 stretch.
    #[test]
    fn absolute_stretch_both_insets_auto_size() {
        let mut tree = LayoutTree::new();
        // cb 200×100, k left10/right10/top15/bottom25 + 크기 auto → stretch.
        let json = r#"[
            {"style":{"position":"absolute","insetLeft":"10px","insetRight":"10px","insetTop":"15px","insetBottom":"25px"},"children":[]},
            {"style":{"display":"block","position":"relative","width":"200px","height":"100px"},"children":[0]}
        ]"#;
        let handles = tree.build_tree_batch(json).unwrap();
        tree.compute_layout(handles[1], 400.0, 400.0);
        let c = tree.get_layout(handles[0]);
        assert_eq!(c.x, 10.0, "left:10");
        assert_eq!(c.width, 180.0, "stretch w = 200 - 10 - 10");
        assert_eq!(c.y, 15.0, "top:15");
        assert_eq!(c.height, 60.0, "stretch h = 100 - 15 - 25");
    }

    /// E11 ②: inset 무지정 → 정상 흐름 위치(static position) 유지.
    #[test]
    fn absolute_static_position_no_inset() {
        let mut tree = LayoutTree::new();
        // pre(30) 뒤 abs k inset 무지정 → static position (0, 30).
        let json = r#"[
            {"style":{"display":"block","height":"30px"},"children":[]},
            {"style":{"position":"absolute","width":"20px","height":"20px"},"children":[]},
            {"style":{"display":"block","position":"relative","width":"200px","height":"100px"},"children":[0,1]}
        ]"#;
        let handles = tree.build_tree_batch(json).unwrap();
        tree.compute_layout(handles[2], 400.0, 400.0);
        let c = tree.get_layout(handles[1]);
        assert_eq!(c.x, 0.0, "static x = content 원점");
        assert_eq!(c.y, 30.0, "static y = 선행 in-flow 형제(30) 하단");
    }

    /// E11 ③: margin auto + 양측 inset + 명시 크기 → 잉여 공간 균등 분배(중앙).
    #[test]
    fn absolute_margin_auto_centers() {
        let mut tree = LayoutTree::new();
        // left0/right0 + width40 + marginLeft/Right auto → free 160 균등 → x=80.
        let json = r#"[
            {"style":{"position":"absolute","insetLeft":"0px","insetRight":"0px","insetTop":"0px","width":"40px","height":"20px","marginLeft":"auto","marginRight":"auto"},"children":[]},
            {"style":{"display":"block","position":"relative","width":"200px","height":"100px"},"children":[0]}
        ]"#;
        let handles = tree.build_tree_batch(json).unwrap();
        tree.compute_layout(handles[1], 400.0, 400.0);
        let c = tree.get_layout(handles[0]);
        assert_eq!(c.x, 80.0, "margin auto 중앙 = (200 - 40)/2");
        assert_eq!(c.width, 40.0, "명시 width 보존");
    }

    // ── get_layouts_batch ──

    #[test]
    fn layouts_batch_flat_shape() {
        let mut tree = LayoutTree::new();
        // 두 독립 leaf(부모-자식 관계 없음). 단위 2 계약: compute_layout(root) 는
        // root 서브트리만 계산 → 두 노드를 각각 root 로 compute (taffy_bridge 동일).
        let json = format!(
            "[{}, {}]",
            style_json("100px", "50px"),
            style_json("200px", "80px")
        );
        let handles = tree.build_tree_batch(&json).unwrap();
        tree.compute_layout(handles[0], 400.0, 300.0);
        tree.compute_layout(handles[1], 400.0, 300.0);
        let flat = tree.get_layouts_batch(&handles);
        assert_eq!(flat.len(), 10, "2 노드 × 5 = 10 f32 (ADR-923 Phase 2: +baseline)");
        // 노드 0: 100×50, 노드 1: 200×80 (x/y=0). baseline 원천 없음 → height 폴백.
        assert_eq!(&flat[0..5], &[0.0, 0.0, 100.0, 50.0, 50.0]);
        assert_eq!(&flat[5..10], &[0.0, 0.0, 200.0, 80.0, 80.0]);
    }

    #[test]
    fn layouts_batch_invalid_handle_zero() {
        let tree = LayoutTree::new();
        let flat = tree.get_layouts_batch(&[42]);
        assert_eq!(flat, vec![0.0, 0.0, 0.0, 0.0, 0.0]);
    }

    // ── 단위 4: 증분 dirty 추적 ──
    //
    // dirty 조상 전파 / clean skip / available 무효화 로직은 display 종류·intrinsic
    // 도출과 직교한다. 테스트는 **명시 width/height 를 가진 flex row 컨테이너**로
    // 구성해 (flex.rs column+height:auto sentinel 미해결 영역을 우회 — flex_container_
    // intrinsic_height_from_children 이 row 인 이유와 동일) dirty 로직만 격리 검증한다.

    /// px 크기 leaf NodeStyle.
    fn px_leaf(width: f32, height: f32) -> NodeStyle {
        serde_json::from_str(&format!(r#"{{"width":"{width}px","height":"{height}px"}}"#))
            .unwrap()
    }

    /// 명시 크기 flex row 컨테이너 NodeStyle (flex-start — stretch 우회).
    fn flex_row_fixed(width: f32, height: f32) -> NodeStyle {
        serde_json::from_str(&format!(
            r#"{{"display":"flex","flexDirection":"row","width":"{width}px","height":"{height}px","alignItems":"flex-start"}}"#
        ))
        .unwrap()
    }

    /// update_style 은 변경 노드 + 조상 체인을 dirty 로 전파한다 (taffy 계약).
    #[test]
    fn update_style_propagates_dirty_to_ancestors() {
        let mut tree = LayoutTree::new();
        let child = tree.create_node(px_leaf(100.0, 50.0));
        let root = tree.create_node(flex_row_fixed(400.0, 100.0));
        tree.set_children(root, vec![child]);
        tree.compute_layout(root, 400.0, 100.0);

        // 초기: child 100×50, root 명시 400×100.
        assert_eq!(tree.get_layout(child).width, 100.0);
        assert_eq!(tree.get_layout(root).width, 400.0);

        // compute 후 전 노드 clean.
        assert!(!tree.subtree_has_dirty(root), "compute 후 서브트리 clean 이어야");

        // 자식 width 변경 → child + root dirty 전파.
        tree.update_style(child, px_leaf(200.0, 50.0));
        assert!(
            tree.subtree_has_dirty(root),
            "자식 update 후 root 서브트리가 dirty 여야 (조상 전파)"
        );

        // 재계산 — 자식 변경이 반영되어야 (taffy test_mark_dirty_incremental 계약).
        tree.compute_layout(root, 400.0, 100.0);
        assert_eq!(
            tree.get_layout(child).width,
            200.0,
            "update_style + recompute 후 width 반영"
        );
    }

    /// ADR-188 Phase 1: subtree dirty 요약은 clean subtree 판정을 재귀 순회 없이
    /// O(1)로 수행하고, solve 완료 후 요약 상태를 함께 정리한다.
    #[test]
    fn subtree_dirty_summary_is_constant_and_cleared_after_solve() {
        let mut tree = LayoutTree::new();
        let child = tree.create_node(px_leaf(100.0, 50.0));
        let root = tree.create_node(flex_row_fixed(400.0, 100.0));
        tree.set_children(root, vec![child]);
        tree.compute_layout(root, 400.0, 100.0);

        assert!(!tree.get(root).unwrap().subtree_dirty);
        tree.skip_walk_visits.set(0);
        assert!(!tree.subtree_has_dirty(root));
        assert_eq!(tree.skip_walk_visits.get(), 1, "clean summary 판정은 root 1회");

        tree.update_style(child, px_leaf(200.0, 50.0));
        assert!(tree.get(root).unwrap().dirty);
        assert!(tree.get(root).unwrap().subtree_dirty);

        tree.compute_layout(root, 400.0, 100.0);
        assert!(!tree.get(root).unwrap().dirty);
        assert!(!tree.get(root).unwrap().subtree_dirty);
        assert!(!tree.get(child).unwrap().dirty);
        assert!(!tree.get(child).unwrap().subtree_dirty);
    }

    /// explicit mark_dirty 후 재계산해도 값이 유지된다 (taffy 계약: cache invalidation).
    #[test]
    fn explicit_mark_dirty_preserves_value() {
        let mut tree = LayoutTree::new();
        let child = tree.create_node(px_leaf(100.0, 50.0));
        let root = tree.create_node(flex_row_fixed(400.0, 100.0));
        tree.set_children(root, vec![child]);
        tree.compute_layout(root, 400.0, 100.0);
        assert_eq!(tree.get_layout(child).width, 100.0);

        // style 변경 없이 cache invalidation 만 — 값 불변이어야.
        tree.mark_dirty(child);
        assert!(tree.subtree_has_dirty(root), "mark_dirty 후 조상 전파");
        tree.compute_layout(root, 400.0, 100.0);
        assert_eq!(
            tree.get_layout(child).width,
            100.0,
            "explicit mark_dirty 는 값을 바꾸지 않음"
        );
    }

    /// set_children(자식 추가) 후 컨테이너 재배치 (taffy test_mark_dirty_add_remove_child 계약).
    #[test]
    fn set_children_add_reflows_container() {
        let mut tree = LayoutTree::new();
        let c1 = tree.create_node(px_leaf(100.0, 50.0));
        let root = tree.create_node(flex_row_fixed(400.0, 100.0));
        tree.set_children(root, vec![c1]);
        tree.compute_layout(root, 400.0, 100.0);
        assert_eq!(tree.get_layout(c1).x, 0.0);

        // 둘째 자식 추가 → root dirty → 재배치 (row: c2 는 c1 오른쪽 x=100).
        let c2 = tree.create_node(px_leaf(80.0, 30.0));
        tree.set_children(root, vec![c1, c2]);
        tree.compute_layout(root, 400.0, 100.0);

        assert_eq!(tree.get_layout(c2).x, 100.0, "c2 는 c1(w=100) 오른쪽 x=100");
        assert_eq!(tree.get_layout(c2).width, 80.0);
    }

    /// set_children(자식 제거) 후 남은 자식 재배치.
    #[test]
    fn set_children_remove_reflows_container() {
        let mut tree = LayoutTree::new();
        let c1 = tree.create_node(px_leaf(100.0, 50.0));
        let c2 = tree.create_node(px_leaf(80.0, 30.0));
        let root = tree.create_node(flex_row_fixed(400.0, 100.0));
        tree.set_children(root, vec![c1, c2]);
        tree.compute_layout(root, 400.0, 100.0);
        assert_eq!(tree.get_layout(c2).x, 100.0);

        // c1 제거 → c2 가 맨 앞(x=0)으로.
        tree.set_children(root, vec![c2]);
        tree.remove_node(c1);
        tree.compute_layout(root, 400.0, 100.0);
        assert_eq!(tree.get_layout(c2).x, 0.0, "c1 제거 후 c2 는 x=0");
    }

    /// clean sibling 서브트리는 skip 되지만 부모 재배치 입력으로 정확한 크기를 반환한다.
    ///
    /// A 를 update 하면 A + root 만 dirty. root 재solve 시 B 는 clean → skip(저장된
    /// layout 재사용) 되지만, B 의 저장 크기가 flex 배치에 정확히 반영되어야 한다.
    #[test]
    fn clean_sibling_skipped_but_size_reused() {
        let mut tree = LayoutTree::new();
        let a = tree.create_node(px_leaf(100.0, 40.0));
        let b = tree.create_node(px_leaf(80.0, 60.0));
        let root = tree.create_node(flex_row_fixed(400.0, 100.0));
        tree.set_children(root, vec![a, b]);
        tree.compute_layout(root, 400.0, 100.0);
        // 초기 row: a(x=0,w=100), b(x=100,w=80).
        assert_eq!(tree.get_layout(b).x, 100.0);

        // A width 변경(100→150) → A + root dirty, B clean.
        tree.update_style(a, px_leaf(150.0, 40.0));
        assert!(!tree.subtree_has_dirty(b), "B 는 clean 이어야 (A 만 변경)");
        tree.compute_layout(root, 400.0, 100.0);

        // A 새 폭 반영 + B 는 A 오른쪽으로 재배치(x=150) + B 크기(skip) 보존.
        assert_eq!(tree.get_layout(a).width, 150.0);
        assert_eq!(tree.get_layout(b).x, 150.0, "B 는 A(w=150) 오른쪽 x=150 재배치");
        assert_eq!(tree.get_layout(b).width, 80.0, "B 크기(skip)는 보존");
    }

    /// available-space 변경 시 clean 노드도 재계산된다 (% 크기 stale 방지).
    #[test]
    fn available_change_invalidates_skip() {
        let mut tree = LayoutTree::new();
        // 자식 width=50% → 컨테이너 폭에 의존. 컨테이너는 명시 폭 없이 avail 상속.
        let child = tree.create_node(serde_json::from_str(r#"{"width":"50%","height":"40px"}"#).unwrap());
        let root = tree.create_node(
            serde_json::from_str(r#"{"display":"flex","flexDirection":"row","height":"40px","alignItems":"flex-start"}"#).unwrap(),
        );
        tree.set_children(root, vec![child]);

        tree.compute_layout(root, 400.0, 40.0);
        assert_eq!(tree.get_layout(child).width, 200.0, "50% of 400");

        // 변경 없이 available 만 확대 → child 50% 재계산 (skip 무효화).
        tree.compute_layout(root, 800.0, 40.0);
        assert_eq!(
            tree.get_layout(child).width,
            400.0,
            "available 800 → 50% = 400 (clean 노드도 재계산)"
        );
    }

    /// **재부모화된 노드는 새 부모의 available 로 다시 풀린다** (stale 크기 재사용 금지).
    ///
    /// `set_children` 은 새 부모와 그 조상만 dirty 로 만든다 — 옮겨온 자식 자신의
    /// 서브트리는 style/children 이 안 바뀌었으니 clean 이다. 그래서 skip 게이트가
    /// **직전 부모 밑에서 계산된 크기**를 그대로 돌려줬다. 크기가 부모에 의존하는
    /// 형태(shrink-to-fit ↔ stretch)에서 이동 뒤 크기가 눌러앉는다.
    #[test]
    fn reparent_invalidates_child_skip() {
        let mut tree = LayoutTree::new();
        // auto 폭 컨테이너 — stretch 부모면 부모 폭, shrink-to-fit 부모면 내용(40).
        let leaf = tree.create_node(px_leaf(40.0, 20.0));
        let subject = tree
            .create_node(serde_json::from_str(r#"{"display":"block","height":"20px"}"#).unwrap());
        tree.set_children(subject, vec![leaf]);

        // 두 후보 부모를 **한 root** 아래 둔다 — root/available 이 바뀌면
        // `last_compute` 가 전체 재계산으로 갈음해 이 결함이 가려진다 (실제 빌더는
        // page body 가 고정 root 라 항상 같은 root·같은 available 이다).
        let wide = tree.create_node(
            serde_json::from_str(r#"{"display":"block","width":"200px","height":"60px"}"#).unwrap(),
        );
        let narrow = tree.create_node(
            serde_json::from_str(
                r#"{"display":"flex","flexDirection":"column","alignItems":"flex-start","width":"200px","height":"60px"}"#,
            )
            .unwrap(),
        );
        let root = tree.create_node(
            serde_json::from_str(r#"{"display":"block","width":"200px","height":"200px"}"#).unwrap(),
        );

        // ① block 부모 — block 자식은 stretch → 200.
        tree.set_children(wide, vec![subject]);
        tree.set_children(root, vec![wide, narrow]);
        tree.compute_layout(root, 200.0, 200.0);
        assert_eq!(
            tree.get_layout(subject).width,
            200.0,
            "block 부모에서는 stretch"
        );

        // ② flex column + align-items:flex-start 로 이동 → shrink-to-fit → 내용 40.
        tree.set_children(wide, vec![]);
        tree.set_children(narrow, vec![subject]);
        tree.compute_layout(root, 200.0, 200.0);

        assert_eq!(
            tree.get_layout(subject).width,
            40.0,
            "재부모화 후에는 새 부모의 available 로 재계산 (stale 200 재사용 금지)"
        );
    }

    /// 증분 skip 은 **멱등**이어야 한다 — 형제만 바뀌는 재계산이 반복돼도 skip 되는
    /// 노드의 크기가 자라면 안 된다.
    ///
    /// 회귀: skip 이 `layout`(배치 단계에서 부모가 border-box 로 덮어쓴 값)을 돌려줘
    /// 부모가 pad+border 를 다시 더했다 — 재계산마다 `2×(padding+border)` 누적.
    /// padding/border 를 가진 auto-height 컨테이너에서만 드러나므로 둘 다 준다.
    #[test]
    fn incremental_skip_is_idempotent_for_padded_auto_container() {
        let mut tree = LayoutTree::new();
        let leaf = tree.create_node(px_leaf(40.0, 20.0));
        // padding 12 + border 1 → 자라면 회당 +26 (2 pass 면 +52).
        let subject = tree.create_node(
            serde_json::from_str(
                r#"{"display":"flex","flexDirection":"column","paddingTop":"12px","paddingBottom":"12px","paddingLeft":"12px","paddingRight":"12px","borderTop":"1px","borderBottom":"1px","borderLeft":"1px","borderRight":"1px"}"#,
            )
            .unwrap(),
        );
        tree.set_children(subject, vec![leaf]);

        // 같은 root 아래 형제 — 이쪽만 dirty 로 만들어 subject 는 skip 되게 한다.
        let sibling = tree.create_node(
            serde_json::from_str(r#"{"display":"block","width":"50px","height":"10px"}"#).unwrap(),
        );
        let root = tree.create_node(
            serde_json::from_str(r#"{"display":"block","width":"200px","height":"300px"}"#).unwrap(),
        );
        tree.set_children(root, vec![subject, sibling]);

        tree.compute_layout(root, 200.0, 300.0);
        let first = tree.get_layout(subject).height;
        assert_eq!(first, 46.0, "content 20 + padding 24 + border 2");

        for round in 0..3 {
            tree.update_style(
                sibling,
                serde_json::from_str(&format!(
                    r#"{{"display":"block","width":"50px","height":"{}px"}}"#,
                    10 + round
                ))
                .unwrap(),
            );
            tree.compute_layout(root, 200.0, 300.0);
            assert_eq!(
                tree.get_layout(subject).height,
                first,
                "형제만 바뀐 {}번째 재계산에서 skip 대상이 자랐다",
                round + 1
            );
        }
    }

    /// 동일 available 재호출 + 변경 없음 → 결과 불변 (skip 이 값을 깨지 않음).
    #[test]
    fn repeated_compute_no_change_stable() {
        let mut tree = LayoutTree::new();
        let child = tree.create_node(px_leaf(100.0, 50.0));
        let root = tree.create_node(flex_row_fixed(400.0, 100.0));
        tree.set_children(root, vec![child]);
        tree.compute_layout(root, 400.0, 100.0);
        let first = tree.get_layout(child);

        // 변경 없이 같은 available 재호출 — 전 서브트리 clean → skip → 값 동일.
        tree.compute_layout(root, 400.0, 100.0);
        let second = tree.get_layout(child);
        assert_eq!(first.width, second.width);
        assert_eq!(first.height, second.height);
        assert_eq!(first.x, second.x);
        assert_eq!(first.y, second.y);
    }

    /// clear 후 handle 재발급 시 stale skip 이 없다 (last_compute 무효화).
    #[test]
    fn clear_invalidates_skip_cache() {
        let mut tree = LayoutTree::new();
        let child = tree.create_node(px_leaf(100.0, 50.0));
        let root = tree.create_node(flex_row_fixed(400.0, 100.0));
        tree.set_children(root, vec![child]);
        tree.compute_layout(root, 400.0, 100.0);

        // clear 후 동일 handle(0,1) 로 다른 크기 트리 재빌드.
        tree.clear();
        let child2 = tree.create_node(px_leaf(250.0, 50.0));
        let root2 = tree.create_node(flex_row_fixed(400.0, 100.0));
        assert_eq!((child2, root2), (0, 1), "handle 0 부터 재발급");
        tree.set_children(root2, vec![child2]);
        // 동일 (root=1, avail=400,100) 지만 clear 로 무효화됐으므로 정확 재계산.
        tree.compute_layout(root2, 400.0, 100.0);
        assert_eq!(
            tree.get_layout(child2).width,
            250.0,
            "clear 후 stale skip 없이 새 크기 반영"
        );
    }

    // ── ADR-169 Phase 1 — intrinsic 측정 패스 ──

    /// TS 측정 스칼라를 가진 텍스트 leaf (ADR-165 채널).
    fn scalar_leaf(min_c: f32, max_c: f32) -> NodeStyle {
        NodeStyle {
            height: Some("40px".into()),
            content_min_width: Some(min_c),
            content_max_width: Some(max_c),
            ..NodeStyle::default()
        }
    }

    fn flex_row_auto() -> NodeStyle {
        NodeStyle {
            display: Some("flex".into()),
            flex_direction: Some("row".into()),
            ..NodeStyle::default()
        }
    }

    /// leaf 는 스칼라를 그대로 낸다 — 모드 분기가 leaf 에서 갈리는지 확인.
    #[test]
    fn intrinsic_leaf_reports_scalars() {
        let mut tree = LayoutTree::new();
        let leaf = tree.create_node(scalar_leaf(300.0, 500.0));
        assert_eq!(tree.measure_intrinsic_width(leaf), Some((300.0, 500.0)));
    }

    /// block 컨테이너 = 자식들의 **최대** (세로 적층).
    #[test]
    fn intrinsic_block_container_takes_max_of_children() {
        let mut tree = LayoutTree::new();
        let a = tree.create_node(scalar_leaf(300.0, 500.0));
        let b = tree.create_node(scalar_leaf(100.0, 700.0));
        let root = tree.create_node(NodeStyle::default()); // display 미지정 → block
        tree.set_children(root, vec![a, b]);
        assert_eq!(tree.measure_intrinsic_width(root), Some((300.0, 700.0)));
    }

    /// flex row 컨테이너 = 자식들의 **합** (가로 나열, nowrap).
    #[test]
    fn intrinsic_flex_row_container_sums_children() {
        let mut tree = LayoutTree::new();
        let a = tree.create_node(scalar_leaf(300.0, 500.0));
        let b = tree.create_node(scalar_leaf(100.0, 200.0));
        let root = tree.create_node(flex_row_auto());
        tree.set_children(root, vec![a, b]);
        assert_eq!(tree.measure_intrinsic_width(root), Some((400.0, 700.0)));
    }

    /// **본 ADR 의 핵심** — stretch 로만 늘어나는 자식은 컨테이너 intrinsic 에
    /// 기여하지 않는다. 현행 `solve_flex` 1단계는 이 형태에서 컨테이너 available 을
    /// 그대로 고유 폭으로 오인한다 (parity fixture D/E).
    #[test]
    fn intrinsic_ignores_stretch_only_children() {
        let mut tree = LayoutTree::new();
        // width:100% 자식 — indefinite containing block 에서 auto 로 풀린다.
        let pct = tree.create_node(NodeStyle {
            width: Some("100%".into()),
            height: Some("40px".into()),
            ..NodeStyle::default()
        });
        let container = tree.create_node(NodeStyle::default());
        tree.set_children(container, vec![pct]);
        assert_eq!(
            tree.measure_intrinsic_width(container),
            Some((0.0, 0.0)),
            "stretch 자식은 고유 폭이 없다"
        );
    }

    /// 측정은 **부작용이 없어야** 한다 (G1) — layout / dirty / 후속 compute 전부 불변.
    #[test]
    fn intrinsic_measure_has_no_side_effects() {
        let mut tree = LayoutTree::new();
        let leaf = tree.create_node(scalar_leaf(300.0, 500.0));
        let root = tree.create_node(flex_row_fixed(1000.0, 100.0));
        tree.set_children(root, vec![leaf]);
        tree.compute_layout(root, 1000.0, 100.0);
        let before_leaf = tree.get_layout(leaf);
        let before_root = tree.get_layout(root);

        tree.measure_intrinsic_width(root);

        assert_eq!(tree.get_layout(leaf).width, before_leaf.width, "leaf layout 오염");
        assert_eq!(tree.get_layout(root).width, before_root.width, "root layout 오염");
        // 측정이 서브트리를 clean 으로 남겨 이후 solve 가 증분 skip 하는 오염도 없어야 한다.
        tree.compute_layout(root, 1000.0, 100.0);
        assert_eq!(tree.get_layout(leaf).width, before_leaf.width, "재계산 결과 발산");
    }

    /// 캐시는 dirty 와 함께 무효화된다 — style 변경 후 새 값이 나와야 한다.
    #[test]
    fn intrinsic_cache_invalidated_by_style_change() {
        let mut tree = LayoutTree::new();
        let leaf = tree.create_node(scalar_leaf(300.0, 500.0));
        let root = tree.create_node(flex_row_auto());
        tree.set_children(root, vec![leaf]);
        assert_eq!(tree.measure_intrinsic_width(root), Some((300.0, 500.0)));

        tree.update_style(leaf, scalar_leaf(50.0, 80.0));
        assert_eq!(
            tree.measure_intrinsic_width(root),
            Some((50.0, 80.0)),
            "자식 변경이 조상 캐시를 무효화하지 못함"
        );
    }
    /// **ADR-169 Phase 2 핵심 계약** — 컨테이너 item 의 §4.5 floor 가 *정확 min-content*
    /// 에서 멈춘다. off 19 을 안 채우면 `0 = absent` 규약 탓에 `content_main`(= max-content)
    /// 이 하한이 되어 컨테이너가 단일줄 폭에서 멈춘다 (G3 — 부분 반영 금지의 실체).
    ///
    /// 형태: root 340 = [content(grow, block > 스칼라 leaf 42/118), sidebar 300 shrink:0].
    /// leftover 는 40 이지만 min-content 가 42 라 42 에서 정지하고 2px 초과한다 — CSS 동작.
    #[test]
    fn container_item_floors_at_exact_min_content() {
        let mut tree = LayoutTree::new();
        let leaf = tree.create_node(scalar_leaf(42.0, 118.0));
        let content = tree.create_node(NodeStyle {
            flex_grow: Some(1.0),
            ..NodeStyle::default()
        });
        tree.set_children(content, vec![leaf]);
        let sidebar = tree.create_node(NodeStyle {
            width: Some("300px".into()),
            flex_shrink: Some(0.0),
            height: Some("40px".into()),
            ..NodeStyle::default()
        });
        let root = tree.create_node(NodeStyle {
            display: Some("flex".into()),
            flex_direction: Some("row".into()),
            width: Some("340px".into()),
            height: Some("80px".into()),
            align_items: Some("flex-start".into()),
            ..NodeStyle::default()
        });
        tree.set_children(root, vec![content, sidebar]);

        assert_eq!(
            tree.measure_intrinsic_width(content),
            Some((42.0, 118.0)),
            "컨테이너 intrinsic 이 자식 스칼라를 집계하지 못함"
        );
        tree.compute_layout(root, 340.0, 80.0);
        assert_eq!(
            tree.get_layout(content).width,
            42.0,
            "leftover(40) 아래로 눌리거나 max-content(118) 에서 멈춤 — floor 채널 오배선"
        );
    }

    /// grid 스타일 헬퍼 — 트랙이 `1fr 1fr` 이라 음수 available 에서 0 으로 무너지는 형태.
    fn grid_two_fr() -> NodeStyle {
        serde_json::from_str(r#"{"display":"grid","gridTemplateColumns":["1fr","1fr"]}"#).unwrap()
    }

    /// grid 서브트리도 **측정된다** (2026-07-28 — ADR-169 이연 해소).
    ///
    /// `1fr 1fr` + 자식 둘(min 100 / max 200): min-content 는 fr 을 펴지 않아 base 합
    /// 200, max-content 는 §12.7.1 used flex fraction 200 으로 트랙 둘이 200 씩 → 400.
    /// 조상도 같은 값이 올라온다.
    #[test]
    fn grid_subtree_is_measured() {
        let mut tree = LayoutTree::new();
        let a = tree.create_node(scalar_leaf(100.0, 200.0));
        let b = tree.create_node(scalar_leaf(100.0, 200.0));
        let grid = tree.create_node(grid_two_fr());
        tree.set_children(grid, vec![a, b]);
        assert_eq!(tree.measure_intrinsic_width(grid), Some((200.0, 400.0)), "grid 자신");

        let content = tree.create_node(NodeStyle::default());
        tree.set_children(content, vec![grid]);
        assert_eq!(
            tree.measure_intrinsic_width(content),
            Some((200.0, 400.0)),
            "grid 를 품은 조상"
        );
    }

    /// grid 를 품은 flex item 은 **트랙 기여 합**이 된다 (available 채움이 아니라).
    ///
    /// 이연 상태에서는 1000(=컨테이너 폭)이었다 — "옳은 값" 이 아니라 측정을 포기한
    /// 결과였다. 지금은 DOM 과 같은 400 이다 (트랙 200 + 200).
    #[test]
    fn grid_flex_item_uses_track_contribution() {
        for nested in [false, true] {
            let mut tree = LayoutTree::new();
            let a = tree.create_node(scalar_leaf(100.0, 200.0));
            let b = tree.create_node(scalar_leaf(100.0, 200.0));
            let grid = tree.create_node(grid_two_fr());
            tree.set_children(grid, vec![a, b]);
            let item = if nested {
                let content = tree.create_node(NodeStyle::default());
                tree.set_children(content, vec![grid]);
                content
            } else {
                grid
            };
            let side = tree.create_node(NodeStyle {
                width: Some("300px".into()),
                flex_shrink: Some(0.0),
                height: Some("40px".into()),
                ..NodeStyle::default()
            });
            let root = tree.create_node(flex_row_fixed(1000.0, 100.0));
            tree.set_children(root, vec![item, side]);
            tree.compute_layout(root, 1000.0, 100.0);
            assert_eq!(
                tree.get_layout(item).width,
                400.0,
                "grid item 이 트랙 기여 합이 아님 (nested={nested})"
            );
        }
    }

    /// grid 측정이 **형제의 측정을 오염시키지 않는다** — 트리 단위 세대 캐시라 서로의
    /// 스냅샷/복구가 섞이면 값이 새어 나온다.
    #[test]
    fn grid_measurement_does_not_disturb_sibling() {
        let mut tree = LayoutTree::new();
        let leaf = tree.create_node(scalar_leaf(42.0, 118.0));
        let plain = tree.create_node(NodeStyle::default());
        tree.set_children(plain, vec![leaf]);
        let g_leaf = tree.create_node(scalar_leaf(100.0, 200.0));
        let grid = tree.create_node(grid_two_fr());
        tree.set_children(grid, vec![g_leaf]);
        assert_eq!(tree.measure_intrinsic_width(plain), Some((42.0, 118.0)));
        // 자식 하나 + 트랙 둘 — 빈 트랙도 자리를 차지한다(max 200 → 트랙 200·200).
        assert_eq!(tree.measure_intrinsic_width(grid), Some((100.0, 400.0)));
        assert_eq!(
            tree.measure_intrinsic_width(plain),
            Some((42.0, 118.0)),
            "grid 측정 후 형제 값이 흔들림"
        );
    }

    /// ADR-188 G0 — dirty leaf 1개에서 엔진 skip walk와 `compute_layout()` 비용을
    /// 호출부 계측과 분리해 동결한다.
    ///
    /// root 아래에 큰 clean subtree와 마지막 dirty leaf를 둔다. root 자체는 dirty라
    /// 즉시 반환하지만 clean subtree의 `subtree_has_dirty`가 모든 clean node를 걷고,
    /// flex 배치의 자식 재진입에서도 같은 게이트가 반복된다. 따라서 현재 구현의
    /// 방문 수는 `3N - 2`로 관측된다.
    #[test]
    fn adr188_g0_engine_skip_walk_baseline() {
        use std::time::Instant;

        fn build_tree(node_count: usize) -> (LayoutTree, usize, usize) {
            let mut tree = LayoutTree::new();
            let clean_leaf_count = node_count - 2; // clean root + dirty leaf 제외
            let clean_leaves = (0..clean_leaf_count)
                .map(|_| tree.create_node(px_leaf(1.0, 20.0)))
                .collect::<Vec<_>>();
            let clean_root = tree.create_node(flex_row_fixed(5_000.0, 40.0));
            tree.set_children(clean_root, clean_leaves);
            let dirty_leaf = tree.create_node(px_leaf(1.0, 20.0));
            let root = tree.create_node(flex_row_fixed(5_000.0, 80.0));
            tree.set_children(root, vec![clean_root, dirty_leaf]);
            tree.compute_layout(root, 5_000.0, 80.0);
            (tree, root, dirty_leaf)
        }

        for node_count in [50usize, 500, 5_000] {
            let (mut tree, root, dirty_leaf) = build_tree(node_count);
            for _ in 0..8 {
                tree.update_style(dirty_leaf, px_leaf(2.0, 20.0));
                tree.skip_walk_visits.set(0);
                tree.compute_layout(root, 5_000.0, 80.0);
            }

            let mut samples = Vec::with_capacity(24);
            let mut visits = Vec::with_capacity(24);
            for _ in 0..24 {
                tree.update_style(dirty_leaf, px_leaf(1.0, 20.0));
                tree.skip_walk_visits.set(0);
                let started = Instant::now();
                tree.compute_layout(root, 5_000.0, 80.0);
                samples.push(started.elapsed().as_nanos());
                visits.push(tree.skip_walk_visits.get());
                std::hint::black_box(tree.get_layout(root));
            }
            samples.sort_unstable();
            visits.sort_unstable();
            let median_ns = samples[samples.len() / 2];
            let p95_ns = samples[samples.len() * 19 / 20];
            // summary 플래그는 clean subtree 내부의 재귀 walk를 제거한다. 현재
            // flex 배치가 자식 solve 진입 자체는 모두 필요로 하므로, 계측값은
            // 기존 3N-2에서 2N으로 줄고 subtree 크기 자체는 여전히 layout kernel
            // 방문 항으로 남는다. 이 두 항을 혼동하지 않도록 수치를 고정한다.
            let expected_visits = node_count * 2;
            assert!(
                visits.iter().all(|&count| count == expected_visits),
                "G0 baseline walk count changed for N={node_count}: {visits:?}"
            );
            println!(
                "ADR-188 G0 engine_skip_walk n={node_count} visits={} median_ns={median_ns} p95_ns={p95_ns}",
                visits[visits.len() / 2]
            );
        }
    }

    // ── ADR-923 Phase 2: baseline 출력 계약 + 입력 3종 ──
    //
    // 계약: `NodeLayout.baseline` = border-box 상단 기준 in-flow baseline. leaf 는
    // `leafBaseline` 입력(+pad/border-top), flex/grid 는 첫 원천 item, block 은 마지막
    // line box(meta)/마지막 원천 자식. 원천 없으면 경계에서 height(bottom) 폴백.
    // 입력 3종(verticalAlign/lineHeight/leafBaseline)은 block intake 슬롯 16/17/18
    // ("미소비" 해소) + leaf solve 가 소비한다.

    /// leaf: leafBaseline 입력 → baseline 출력 (pad_top 가산), 부재 시 height 폴백.
    /// block 컨테이너: 마지막 원천 보유 자식(L1)의 baseline 전파 (L2 는 원천 없음).
    #[test]
    fn adr923_p2_leaf_baseline_output_and_bottom_fallback() {
        let mut tree = LayoutTree::new();
        let json = r#"[
            {"style":{"width":"60px","height":"30px","leafBaseline":24,"paddingTop":"4px"},"children":[]},
            {"style":{"width":"60px","height":"30px"},"children":[]},
            {"style":{"display":"block","width":"300px","height":"100px"},"children":[0,1]}
        ]"#;
        let h = tree.build_tree_batch(json).unwrap();
        tree.compute_layout(h[2], 300.0, 100.0);
        let flat = tree.get_layouts_batch(&h);
        assert_eq!(flat.len(), 15, "3 노드 × 5");
        assert_eq!(flat[4], 28.0, "L1 baseline = paddingTop 4 + leafBaseline 24");
        assert_eq!(flat[9], flat[8], "L2 원천 없음 → height(bottom) 폴백");
        assert_eq!(flat[14], 28.0, "block 컨테이너 = 마지막 원천 자식(L1, y=0) 의 baseline");
    }

    /// Button 시나리오: inline-flex 컨테이너 2개가 내부 텍스트 leaf 의 baseline 으로
    /// 같은 line box 에서 정렬 — flex 컨테이너 baseline 전파(첫 item) + line box 정렬 +
    /// block 부모의 마지막 line box baseline 출력.
    #[test]
    fn adr923_p2_inline_flex_containers_align_by_text_baseline() {
        let mut tree = LayoutTree::new();
        let json = r#"[
            {"style":{"width":"60px","height":"20px","leafBaseline":16},"children":[]},
            {"style":{"display":"inline-flex","flexDirection":"row"},"children":[0]},
            {"style":{"width":"60px","height":"40px","leafBaseline":32},"children":[]},
            {"style":{"display":"inline-flex","flexDirection":"row"},"children":[2]},
            {"style":{"display":"block","width":"300px","height":"100px"},"children":[1,3]}
        ]"#;
        // post-order: B(3) 의 자식이 2 (leafB).
        let h = tree.build_tree_batch(json).unwrap();
        tree.compute_layout(h[4], 300.0, 100.0);
        let a = tree.get_layout(h[1]);
        let b = tree.get_layout(h[3]);
        assert_eq!(a.baseline, 16.0, "A 컨테이너 baseline = 첫 item(leaf lb 16)");
        assert_eq!(b.baseline, 32.0, "B 컨테이너 baseline = 첫 item(leaf lb 32)");
        assert_eq!((a.x, a.y), (0.0, 16.0), "A 는 line baseline(32) 에 맞춰 16 내려감");
        assert_eq!((b.x, b.y), (60.0, 0.0), "B 가 line baseline 결정 (32)");
        let flat = tree.get_layouts_batch(&h);
        assert_eq!(flat[4 * 5 + 4], 32.0, "block 부모 baseline = 마지막 line box(32)");
    }

    /// verticalAlign:"top" item 은 baseline 정렬에 불참 — 줄 상단 고정.
    #[test]
    fn adr923_p2_vertical_align_top_pins_item() {
        let mut tree = LayoutTree::new();
        let json = r#"[
            {"style":{"width":"60px","height":"20px","leafBaseline":16},"children":[]},
            {"style":{"display":"inline-flex","flexDirection":"row"},"children":[0]},
            {"style":{"width":"60px","height":"40px","leafBaseline":32},"children":[]},
            {"style":{"display":"inline-flex","flexDirection":"row","verticalAlign":"top"},"children":[2]},
            {"style":{"display":"block","width":"300px","height":"100px"},"children":[1,3]}
        ]"#;
        let h = tree.build_tree_batch(json).unwrap();
        tree.compute_layout(h[4], 300.0, 100.0);
        let a = tree.get_layout(h[1]);
        let b = tree.get_layout(h[3]);
        assert_eq!(a.y, 0.0, "baseline 참여자가 A 뿐 → line baseline 16, A 는 0");
        assert_eq!(b.y, 0.0, "top 정렬 — baseline 불참");
    }

    /// atomic inline 의 lineHeight 는 line box 를 키우지 **않는다** — §10.8: atomic
    /// inline-level(ib/inline-flex/inline-grid) 은 margin box 로만 참여. Phase 3 Chrome
    /// 실측(atomic-line-height-inert: dom tail.y 20)으로 Phase 2 의 종전 가정(50 확장)을
    /// 반전. line box 확장은 **컨테이너** lineHeight(strut) 의 몫 — 아래 strut 테스트.
    #[test]
    fn adr923_p3_atomic_line_height_inert() {
        let mut tree = LayoutTree::new();
        let json = r#"[
            {"style":{"width":"60px","height":"20px","leafBaseline":16},"children":[]},
            {"style":{"display":"inline-flex","flexDirection":"row","lineHeight":50},"children":[0]},
            {"style":{"display":"block","height":"10px"},"children":[]},
            {"style":{"display":"block","width":"300px","height":"200px"},"children":[1,2]}
        ]"#;
        let h = tree.build_tree_batch(json).unwrap();
        tree.compute_layout(h[3], 300.0, 200.0);
        let c = tree.get_layout(h[2]);
        assert_eq!(c.y, 20.0, "line box = item margin box 20 — item lineHeight 50 불관여");
    }

    /// flex/grid 컨테이너 baseline = 첫 원천 item (padding offset 포함).
    #[test]
    fn adr923_p2_flex_and_grid_container_baseline_first_item() {
        let mut tree = LayoutTree::new();
        let flex_json = r#"[
            {"style":{"width":"30px","height":"20px","leafBaseline":12},"children":[]},
            {"style":{"display":"flex","flexDirection":"row","paddingTop":"5px","width":"100px","height":"50px"},"children":[0]}
        ]"#;
        let h = tree.build_tree_batch(flex_json).unwrap();
        tree.compute_layout(h[1], 200.0, 100.0);
        assert_eq!(
            tree.get_layout(h[1]).baseline,
            17.0,
            "flex: paddingTop 5 + item y 0 + leaf baseline 12"
        );

        let mut tree2 = LayoutTree::new();
        let grid_json = r#"[
            {"style":{"width":"30px","height":"20px","leafBaseline":12},"children":[]},
            {"style":{"display":"grid","gridTemplateColumns":["100px"],"width":"100px","height":"50px"},"children":[0]}
        ]"#;
        let h2 = tree2.build_tree_batch(grid_json).unwrap();
        tree2.compute_layout(h2[1], 200.0, 100.0);
        assert_eq!(tree2.get_layout(h2[1]).baseline, 12.0, "grid: 첫 row 첫 item baseline");
    }

    /// grid 컨테이너 baseline 은 **placement row-major 첫** 원천 item — source 순서가 아니다.
    ///
    /// Codex round 7 r7m1: 명시 placement 로 source 순서(A=row2, B=row1)를 뒤집으면
    /// 종전 코드는 children 배열 첫 원천(A, row2)을 골라 30+12=42 를 냈다. CSS-ALIGN-3
    /// §9.3 first-baseline set 은 첫 row 기준 — 기대값은 B(row1) 의 0+4=4.
    #[test]
    fn adr923_p2_grid_container_baseline_row_major_not_source_order() {
        let mut tree = LayoutTree::new();
        let json = r#"[
            {"style":{"width":"30px","height":"20px","leafBaseline":12,"gridRowStart":"2"},"children":[]},
            {"style":{"width":"30px","height":"20px","leafBaseline":4,"gridRowStart":"1"},"children":[]},
            {"style":{"display":"grid","gridTemplateColumns":["100px"],"gridTemplateRows":["30px","30px"],"width":"100px","height":"60px"},"children":[0,1]}
        ]"#;
        let h = tree.build_tree_batch(json).unwrap();
        tree.compute_layout(h[2], 200.0, 100.0);
        assert_eq!(
            tree.get_layout(h[2]).baseline,
            4.0,
            "placement 첫 row(B, y=0) 의 원천 4 — source 첫(A, row2) 42 아님"
        );
    }

    /// 컨테이너 line-height = strut (§10.8) — ascent=descent=lh/2 로 line box 참여.
    /// Chrome 실측 strut-short(40 strut > item 20 → line 40) · strut-tall(item 50 →
    /// 50 + strut descent 20 = 70).
    #[test]
    fn adr923_p3_parent_line_height_strut() {
        let mut tree = LayoutTree::new();
        let json = r#"[
            {"style":{"display":"inline-block","width":"60px","height":"20px"},"children":[]},
            {"style":{"display":"block","height":"10px"},"children":[]},
            {"style":{"display":"block","width":"300px","height":"200px","lineHeight":40},"children":[0,1]}
        ]"#;
        let h = tree.build_tree_batch(json).unwrap();
        tree.compute_layout(h[2], 300.0, 200.0);
        assert_eq!(tree.get_layout(h[1]).y, 40.0, "strut 40 이 item 20 위 line 을 40 으로");

        let mut tree2 = LayoutTree::new();
        let json2 = r#"[
            {"style":{"display":"inline-block","width":"60px","height":"50px"},"children":[]},
            {"style":{"display":"block","height":"10px"},"children":[]},
            {"style":{"display":"block","width":"300px","height":"200px","lineHeight":40},"children":[0,1]}
        ]"#;
        let h2 = tree2.build_tree_batch(json2).unwrap();
        tree2.compute_layout(h2[2], 300.0, 200.0);
        assert_eq!(tree2.get_layout(h2[1]).y, 70.0, "item ascent 50 + strut descent 20");
    }

    /// r8h1 — vertical-align:middle 은 margin box 중심을 baseline 에 고정 (Chrome
    /// valign-middle-tall: ib20 + ib60(middle) → baseline 30, ib20 y=10 — line 중앙설이면 0).
    #[test]
    fn adr923_p3_valign_middle_tall_pushes_baseline() {
        let mut tree = LayoutTree::new();
        let json = r#"[
            {"style":{"display":"inline-block","width":"60px","height":"20px"},"children":[]},
            {"style":{"display":"inline-block","width":"60px","height":"60px","verticalAlign":"middle"},"children":[]},
            {"style":{"display":"block","width":"300px","height":"200px"},"children":[0,1]}
        ]"#;
        let h = tree.build_tree_batch(json).unwrap();
        tree.compute_layout(h[2], 300.0, 200.0);
        assert_eq!(tree.get_layout(h[0]).y, 10.0, "asc=30 → baseline item y 10");
        assert_eq!(tree.get_layout(h[1]).y, 0.0, "middle 60 중심 = baseline 30 → y 0");
    }

    /// r8h2 — 마지막 line box 의 strut 높이가 컨테이너 auto-height 에 반영 (Chrome
    /// strut-last-line: ib20 + strut40, tail 없음 → root h 40 — 자식 bbox 만으론 20).
    #[test]
    fn adr923_p3_last_line_strut_extends_auto_height() {
        let mut tree = LayoutTree::new();
        let json = r#"[
            {"style":{"display":"inline-block","width":"60px","height":"20px"},"children":[]},
            {"style":{"display":"block","width":"300px","lineHeight":40},"children":[0]}
        ]"#;
        let h = tree.build_tree_batch(json).unwrap();
        tree.compute_layout(h[1], 300.0, 200.0);
        assert_eq!(tree.get_layout(h[1]).height, 40.0, "auto height = 마지막 line box 40");
    }

    /// r8m2 — overflow:clip 은 BFC 를 만들지 않는다 (css-overflow-3 §valdef-overflow-clip;
    /// Chrome clip-no-bfc: 자식 margin-top 이 clip 부모를 관통해 탈출).
    #[test]
    fn adr923_p3_overflow_clip_no_bfc_margin_escapes() {
        let mut tree = LayoutTree::new();
        let json = r#"[
            {"style":{"display":"block","marginTop":"20px","height":"10px"},"children":[]},
            {"style":{"display":"block","overflowX":"clip","overflowY":"clip"},"children":[0]},
            {"style":{"display":"block","width":"300px","height":"200px"},"children":[1]}
        ]"#;
        let h = tree.build_tree_batch(json).unwrap();
        tree.compute_layout(h[2], 300.0, 200.0);
        assert_eq!(tree.get_layout(h[1]).height, 10.0, "margin 관통 → wrap h 10");
        assert_eq!(tree.get_layout(h[0]).y, 0.0, "wrap 상대 y 0 (margin 탈출)");
    }

    /// r8 오라클 — overflow:clip 의 inline-block baseline 은 visible 처럼 last line box
    /// (Chrome ib-overflow-clip-baseline: a.y 20 — margin-edge 강제였다면 10).
    #[test]
    fn adr923_p3_overflow_clip_keeps_line_box_baseline() {
        let mut tree = LayoutTree::new();
        let json = r#"[
            {"style":{"display":"inline-block","width":"60px","height":"20px"},"children":[]},
            {"style":{"display":"inline-block","width":"60px","paddingBottom":"10px","overflowX":"clip","overflowY":"clip"},"children":[0]},
            {"style":{"display":"inline-block","width":"60px","height":"40px"},"children":[]},
            {"style":{"display":"block","width":"300px","height":"200px"},"children":[1,2]}
        ]"#;
        let h = tree.build_tree_batch(json).unwrap();
        tree.compute_layout(h[3], 300.0, 200.0);
        assert_eq!(tree.get_layout(h[1]).y, 20.0, "a baseline = last line box 20 → y 40-20");
    }

    // ── round 9 — Chrome 실측 (r9h1 / r9m2 / 인접 margin chain) ──

    /// r9h1 — overflow:clip flex item 은 scroll container 가 아니라 §4.5 content floor 유지
    /// (Chrome flex-item-clip-auto-min: f.w 80 / hidden 대조군 60). 양축 판정: overflowY
    /// hidden 만 있어도 overflowX 는 auto 로 계산돼 scroll container.
    #[test]
    fn adr923_p3_r9_flex_item_clip_keeps_auto_min_floor() {
        let run = |overflow_key: &str, val: &str| -> f32 {
            let mut tree = LayoutTree::new();
            let json = format!(
                r#"[
                {{"style":{{"width":"80px","height":"20px"}},"children":[]}},
                {{"style":{{"width":"80px","height":"20px"}},"children":[]}},
                {{"style":{{"display":"flex","flexWrap":"wrap","{}":"{}"}},"children":[0,1]}},
                {{"style":{{"display":"flex","width":"60px"}},"children":[2]}}
            ]"#,
                overflow_key, val
            );
            let h = tree.build_tree_batch(&json).unwrap();
            tree.compute_layout(h[3], 60.0, 200.0);
            tree.get_layout(h[2]).width
        };
        assert_eq!(run("overflowX", "clip"), 80.0, "clip: content floor 유지");
        assert_eq!(run("overflowX", "visible"), 80.0, "visible: content floor 유지");
        assert_eq!(run("overflowX", "hidden"), 60.0, "hidden: scroll container → floor 0");
        assert_eq!(run("overflowY", "hidden"), 60.0, "cross 축 hidden 도 scroll container (computed overflow-x auto)");
    }

    /// r9m2 — 꼬리 self-collapsing box 의 관통 margin 은 부모 bottom 으로 탈출, auto
    /// height 제외 (Chrome trailing-empty-block-escape: root h 10, empty y 30).
    #[test]
    fn adr923_p3_r9_trailing_empty_block_escapes_auto_height() {
        let mut tree = LayoutTree::new();
        let json = r#"[
            {"style":{"display":"block","height":"10px","marginBottom":"10px"},"children":[]},
            {"style":{"display":"block","marginTop":"20px","marginBottom":"30px"},"children":[]},
            {"style":{"display":"block","width":"300px"},"children":[0,1]}
        ]"#;
        let h = tree.build_tree_batch(json).unwrap();
        tree.compute_layout(h[2], 300.0, 200.0);
        assert_eq!(tree.get_layout(h[2]).height, 10.0, "empty tail excluded");
        assert_eq!(tree.get_layout(h[1]).y, 30.0, "as-if non-zero bottom border position");
        assert_eq!(tree.get_layout(h[1]).height, 0.0);
    }

    /// r9m2 — padding-bottom 이 있으면 마지막 bottom margin(관통 chain 포함) 이 content 에
    /// 포함 (Chrome trailing-margin-contained 31 / trailing-empty-block-contained 41).
    #[test]
    fn adr923_p3_r9_trailing_margin_contained_by_padding() {
        let mut tree = LayoutTree::new();
        let json = r#"[
            {"style":{"display":"block","height":"10px","marginBottom":"20px"},"children":[]},
            {"style":{"display":"block","width":"300px","paddingBottom":"1px"},"children":[0]}
        ]"#;
        let h = tree.build_tree_batch(json).unwrap();
        tree.compute_layout(h[1], 300.0, 200.0);
        assert_eq!(tree.get_layout(h[1]).height, 31.0);

        let mut tree = LayoutTree::new();
        let json = r#"[
            {"style":{"display":"block","height":"10px","marginBottom":"10px"},"children":[]},
            {"style":{"display":"block","marginTop":"20px","marginBottom":"30px"},"children":[]},
            {"style":{"display":"block","width":"300px","paddingBottom":"1px"},"children":[0,1]}
        ]"#;
        let h = tree.build_tree_batch(json).unwrap();
        tree.compute_layout(h[2], 300.0, 200.0);
        assert_eq!(tree.get_layout(h[2]).height, 41.0, "10 + max(10,20,30) + 1");
    }

    /// r9 인접 — BFC 자식(flex) 의 자기 margin 은 형제·부모와 collapse 한다 (Chrome
    /// bfc-sibling-top-collapse b.y 30 / bfc-last-child-margin-escape sib.y 30 /
    /// bfc-first-child-top-escape wrap y 30·h 10).
    #[test]
    fn adr923_p3_r9_bfc_child_own_margins_collapse() {
        let mut tree = LayoutTree::new();
        let json = r#"[
            {"style":{"display":"block","height":"10px","marginBottom":"20px"},"children":[]},
            {"style":{"display":"flex","marginTop":"10px","height":"10px"},"children":[]},
            {"style":{"display":"block","width":"300px"},"children":[0,1]}
        ]"#;
        let h = tree.build_tree_batch(json).unwrap();
        tree.compute_layout(h[2], 300.0, 200.0);
        assert_eq!(tree.get_layout(h[1]).y, 30.0, "sibling top collapse: 10 + max(20,10)");
        assert_eq!(tree.get_layout(h[2]).height, 40.0);

        let mut tree = LayoutTree::new();
        let json = r#"[
            {"style":{"display":"flex","height":"10px","marginBottom":"20px"},"children":[]},
            {"style":{"display":"block"},"children":[0]},
            {"style":{"display":"block","height":"10px"},"children":[]},
            {"style":{"display":"block","width":"300px"},"children":[1,2]}
        ]"#;
        let h = tree.build_tree_batch(json).unwrap();
        tree.compute_layout(h[3], 300.0, 200.0);
        assert_eq!(tree.get_layout(h[1]).height, 10.0, "wrap: bfc child mb escapes");
        assert_eq!(tree.get_layout(h[2]).y, 30.0, "sib after escaped 20");

        let mut tree = LayoutTree::new();
        let json = r#"[
            {"style":{"display":"block","height":"10px"},"children":[]},
            {"style":{"display":"flex","marginTop":"20px","height":"10px"},"children":[]},
            {"style":{"display":"block"},"children":[1]},
            {"style":{"display":"block","width":"300px"},"children":[0,2]}
        ]"#;
        let h = tree.build_tree_batch(json).unwrap();
        tree.compute_layout(h[3], 300.0, 200.0);
        assert_eq!(tree.get_layout(h[2]).y, 30.0, "wrap y: bfc child mt escaped through wrap");
        assert_eq!(tree.get_layout(h[2]).height, 10.0);
        assert_eq!(tree.get_layout(h[1]).y, 0.0, "flex child at wrap content top");
    }

    /// r9 인접 — 선두 self-collapsing box + 다음 block 의 margin chain 이 wrap top 으로
    /// 통째 탈출 (Chrome empty-first-chain-through-wrap: empty/solid/wrap y 40, root h 50).
    #[test]
    fn adr923_p3_r9_leading_empty_chain_escapes_through_wrap() {
        let mut tree = LayoutTree::new();
        let json = r#"[
            {"style":{"display":"block","height":"10px"},"children":[]},
            {"style":{"display":"block","marginTop":"20px","marginBottom":"30px"},"children":[]},
            {"style":{"display":"block","marginTop":"5px","height":"10px"},"children":[]},
            {"style":{"display":"block"},"children":[1,2]},
            {"style":{"display":"block","width":"300px"},"children":[0,3]}
        ]"#;
        let h = tree.build_tree_batch(json).unwrap();
        tree.compute_layout(h[4], 300.0, 200.0);
        assert_eq!(tree.get_layout(h[3]).y, 40.0, "wrap y = 10 + max(20,30,5)");
        assert_eq!(tree.get_layout(h[3]).height, 10.0);
        assert_eq!(tree.get_layout(h[1]).y, 0.0, "leading empty = wrap top border edge");
        assert_eq!(tree.get_layout(h[2]).y, 0.0, "solid at wrap content top");
        assert_eq!(tree.get_layout(h[4]).height, 50.0);
    }

    /// r9 후속 ① — `height: 0` 명시 + margin 도 self-collapsing (§8.3.1 "zero or auto computed
    /// height"; Chrome height-zero-self-collapsing: b.y 40 · root 50). in-flow 내용이 있으면
    /// 아님 (대조군 b.y 60 · root 70).
    #[test]
    fn adr923_p3_r9_height_zero_self_collapsing() {
        let mut tree = LayoutTree::new();
        let json = r#"[
            {"style":{"display":"block","height":"10px","marginBottom":"10px"},"children":[]},
            {"style":{"display":"block","height":"0px","marginTop":"20px","marginBottom":"30px"},"children":[]},
            {"style":{"display":"block","height":"10px","marginTop":"5px"},"children":[]},
            {"style":{"display":"block","width":"300px"},"children":[0,1,2]}
        ]"#;
        let h = tree.build_tree_batch(json).unwrap();
        tree.compute_layout(h[3], 300.0, 200.0);
        assert_eq!(tree.get_layout(h[2]).y, 40.0, "chain max(10,20,30,5) 관통");
        assert_eq!(tree.get_layout(h[3]).height, 50.0);

        let mut tree = LayoutTree::new();
        let json = r#"[
            {"style":{"display":"block","height":"10px","marginBottom":"10px"},"children":[]},
            {"style":{"display":"block","height":"10px"},"children":[]},
            {"style":{"display":"block","height":"0px","marginTop":"20px","marginBottom":"30px"},"children":[1]},
            {"style":{"display":"block","height":"10px","marginTop":"5px"},"children":[]},
            {"style":{"display":"block","width":"300px"},"children":[0,2,3]}
        ]"#;
        let h = tree.build_tree_batch(json).unwrap();
        tree.compute_layout(h[4], 300.0, 200.0);
        assert_eq!(tree.get_layout(h[3]).y, 60.0, "내용 있는 height:0 은 self-collapsing 아님");
        assert_eq!(tree.get_layout(h[4]).height, 70.0);
    }

    /// r10h1 — 텍스트 leaf 는 `leafBaseline`(line box 신호) 이 있으면 height:0 이어도
    /// self-collapsing 이 아니다 (Chrome text-leaf-height-zero-has-line-box b.y 60 / 없으면 40).
    #[test]
    fn adr923_p3_r10_text_leaf_height_zero_keeps_line_box() {
        let run = |leaf: &str| {
            let mut tree = LayoutTree::new();
            let json = format!(
                r#"[
                {{"style":{{"display":"block","height":"10px","marginBottom":"10px"}},"children":[]}},
                {{"style":{},"children":[]}},
                {{"style":{{"display":"block","height":"10px","marginTop":"5px"}},"children":[]}},
                {{"style":{{"display":"block","width":"300px"}},"children":[0,1,2]}}
            ]"#,
                leaf
            );
            let h = tree.build_tree_batch(&json).unwrap();
            tree.compute_layout(h[3], 300.0, 200.0);
            (tree.get_layout(h[2]).y, tree.get_layout(h[3]).height)
        };
        assert_eq!(
            run(r#"{"display":"block","height":"0px","marginTop":"20px","marginBottom":"30px","leafBaseline":12}"#),
            (60.0, 70.0),
            "line box 있음 → 20 + 0 + 30 순차"
        );
        assert_eq!(
            run(r#"{"display":"block","height":"0px","marginTop":"20px","marginBottom":"30px"}"#),
            (40.0, 50.0),
            "신호 없음 → self-collapsing chain max 30"
        );
    }

    /// r10m1 — absolute 자식만 있는 height:0 컨테이너는 self-collapsing (solve_node leaf 경로 —
    /// Chrome abs-only-height-zero b.y 40); auto height 대조군도 40.
    #[test]
    fn adr923_p3_r10_abs_only_children_self_collapsing() {
        for z in [
            r#"{"display":"block","height":"0px","marginTop":"20px","marginBottom":"30px"}"#,
            r#"{"display":"block","marginTop":"20px","marginBottom":"30px"}"#,
        ] {
            let mut tree = LayoutTree::new();
            let json = format!(
                r#"[
                {{"style":{{"display":"block","height":"10px","marginBottom":"10px"}},"children":[]}},
                {{"style":{{"position":"absolute","width":"10px","height":"10px"}},"children":[]}},
                {{"style":{},"children":[1]}},
                {{"style":{{"display":"block","height":"10px","marginTop":"5px"}},"children":[]}},
                {{"style":{{"display":"block","width":"300px"}},"children":[0,2,3]}}
            ]"#,
                z
            );
            let h = tree.build_tree_batch(&json).unwrap();
            tree.compute_layout(h[4], 300.0, 200.0);
            assert_eq!(tree.get_layout(h[3]).y, 40.0, "{z}");
            assert_eq!(tree.get_layout(h[4]).height, 50.0, "{z}");
        }
    }

    /// r10m2 — adjoining 집합이 3층(손자 탈출 · wrapper own · 형제 chain)을 넘는다:
    /// {10, 25, 30, −20} = 10 (Chrome mixed-sign-chain-hoisted-through-wrapper g.y 20 —
    /// 이항 누적이면 35); self-collapsing wrapper 변형 {10, 25, 30, −20, 5} → b.y 20.
    #[test]
    fn adr923_p3_r10_mixed_sign_margin_set_across_levels() {
        let mut tree = LayoutTree::new();
        let json = r#"[
            {"style":{"display":"block","height":"10px","marginBottom":"10px"},"children":[]},
            {"style":{"display":"block","height":"10px","marginTop":"-20px"},"children":[]},
            {"style":{"display":"block","marginTop":"30px"},"children":[1]},
            {"style":{"display":"block","marginTop":"25px"},"children":[2]},
            {"style":{"display":"block","height":"10px","marginTop":"5px"},"children":[]},
            {"style":{"display":"block","width":"300px"},"children":[0,3,4]}
        ]"#;
        let h = tree.build_tree_batch(json).unwrap();
        tree.compute_layout(h[5], 300.0, 200.0);
        let abs_g = tree.get_layout(h[3]).y + tree.get_layout(h[2]).y + tree.get_layout(h[1]).y;
        assert_eq!(abs_g, 20.0, "{{10,25,30,-20}} = 30 - 20");
        assert_eq!(tree.get_layout(h[4]).y, 35.0);
        assert_eq!(tree.get_layout(h[5]).height, 45.0);

        let mut tree = LayoutTree::new();
        let json = r#"[
            {"style":{"display":"block","height":"10px","marginBottom":"10px"},"children":[]},
            {"style":{"display":"block","marginTop":"30px","marginBottom":"-20px"},"children":[]},
            {"style":{"display":"block","marginTop":"25px"},"children":[1]},
            {"style":{"display":"block","height":"10px","marginTop":"5px"},"children":[]},
            {"style":{"display":"block","width":"300px"},"children":[0,2,3]}
        ]"#;
        let h = tree.build_tree_batch(json).unwrap();
        tree.compute_layout(h[4], 300.0, 200.0);
        assert_eq!(tree.get_layout(h[3]).y, 20.0, "{{10,25,30,-20,5}} = 10");
        assert_eq!(tree.get_layout(h[4]).height, 30.0);
    }

    /// r10m3 — auto height 0 하한 (Chrome negative-top-margin-padded root.h 2 ·
    /// negative-bottom-margin-contained 1) + in-flow bottom ≤ 0 이어도 내용 있는 자식이
    /// 있으면 self-collapsing 아님 (negative-flow-bottom-not-self-collapsing b.y 60).
    #[test]
    fn adr923_p3_r10_negative_margin_auto_height_floor() {
        let mut tree = LayoutTree::new();
        let json = r#"[
            {"style":{"display":"block","height":"20px","marginTop":"-30px"},"children":[]},
            {"style":{"display":"block","width":"300px","paddingTop":"1px","paddingBottom":"1px"},"children":[0]}
        ]"#;
        let h = tree.build_tree_batch(json).unwrap();
        tree.compute_layout(h[1], 300.0, 200.0);
        assert_eq!(tree.get_layout(h[0]).y, -29.0);
        assert_eq!(tree.get_layout(h[1]).height, 2.0, "content 0 하한 + padding 2");

        let mut tree = LayoutTree::new();
        let json = r#"[
            {"style":{"display":"block","height":"20px","marginBottom":"-30px"},"children":[]},
            {"style":{"display":"block","width":"300px","paddingBottom":"1px"},"children":[0]}
        ]"#;
        let h = tree.build_tree_batch(json).unwrap();
        tree.compute_layout(h[1], 300.0, 200.0);
        assert_eq!(tree.get_layout(h[1]).height, 1.0);

        let mut tree = LayoutTree::new();
        let json = r#"[
            {"style":{"display":"block","height":"10px","marginBottom":"10px"},"children":[]},
            {"style":{"display":"block","height":"20px","marginBottom":"-30px"},"children":[]},
            {"style":{"display":"block","height":"5px"},"children":[]},
            {"style":{"display":"block","marginTop":"20px","marginBottom":"30px"},"children":[1,2]},
            {"style":{"display":"block","height":"10px","marginTop":"5px"},"children":[]},
            {"style":{"display":"block","width":"300px"},"children":[0,3,4]}
        ]"#;
        let h = tree.build_tree_batch(json).unwrap();
        tree.compute_layout(h[5], 300.0, 200.0);
        assert_eq!(tree.get_layout(h[3]).height, 0.0, "wrap used height 0 하한");
        assert_eq!(tree.get_layout(h[4]).y, 60.0, "wrap 은 self-collapsing 아님 (자식 내용 있음)");
        assert_eq!(tree.get_layout(h[5]).height, 70.0);
    }

    /// r11m1 — 부모 bottom 과 마지막 자식 bottom margin 의 adjoining 은 §8.3.1 "parent has
    /// auto computed height" (padding/border 0 · BFC 아님 은 종전 조건) + Blink: min/max-height
    /// 가 바인딩되면 strut 미전파. Chrome 실측: height:50px 부모 b.y 50 (종전 70) · height:0
    /// 부모는 auto 가 아니라 used height 0 + margin 미탈출 b.y 0 (종전 20) · height:0+min-height:
    /// 10 → 10 (종전 30) · min-height:30 부분 바인딩 p.h 30 · b.y 45 · min-height:100 b.y 115 ·
    /// max-height:10 b.y 25. 대조군: 미바인딩 min-height:10 / min-height:0 / max-height:100 은
    /// 접힘 유지 (b.y 40), height 명시는 top collapse 에 무관 (p.y 30 · b.y 80).
    #[test]
    fn adr923_p3_r11_parent_bottom_collapse_auto_height_and_unbound_min_max() {
        let run = |p_style: &str| -> (f32, f32, f32) {
            let mut tree = LayoutTree::new();
            let json = format!(
                r#"[
                {{"style":{{"display":"block","height":"20px","marginBottom":"20px"}},"children":[]}},
                {{"style":{{"display":"block",{p_style}}},"children":[0]}},
                {{"style":{{"display":"block","height":"10px"}},"children":[]}},
                {{"style":{{"display":"block","width":"300px"}},"children":[1,2]}}
            ]"#
            );
            let h = tree.build_tree_batch(&json).unwrap();
            tree.compute_layout(h[3], 300.0, 200.0);
            (tree.get_layout(h[1]).height, tree.get_layout(h[2]).y, tree.get_layout(h[3]).height)
        };
        assert_eq!(run(r#""height":"50px""#), (50.0, 50.0, 60.0), "height 명시 → 자식 margin 미탈출");
        assert_eq!(
            run(r#""minHeight":"10px","marginBottom":"15px""#),
            (20.0, 40.0, 50.0),
            "미바인딩 min-height → 접힘 유지 (max(20,15)=20)"
        );
        assert_eq!(
            run(r#""minHeight":"30px","marginBottom":"15px""#),
            (30.0, 45.0, 55.0),
            "부분 바인딩 min-height → strut 미전파, used 30 (자식 margin edge 40 은 overflow)"
        );
        assert_eq!(
            run(r#""minHeight":"100px","marginBottom":"15px""#),
            (100.0, 115.0, 125.0),
            "바인딩 min-height → strut 미전파, 부모 자기 margin 15 만"
        );
        assert_eq!(
            run(r#""maxHeight":"10px","marginBottom":"15px""#),
            (10.0, 25.0, 35.0),
            "바인딩 max-height → strut 미전파"
        );
        assert_eq!(run(r#""height":"0px""#), (0.0, 0.0, 10.0), "height:0 은 auto 가 아니다 — used 0");
        assert_eq!(run(r#""height":"0px","minHeight":"10px""#), (10.0, 10.0, 20.0), "height:0 + min-height:10 → used 10");
        assert_eq!(run(r#""minHeight":"0px","marginBottom":"15px""#), (20.0, 40.0, 50.0), "min-height:0 명시 → 접힘 유지");
        assert_eq!(run(r#""maxHeight":"100px","marginBottom":"15px""#), (20.0, 40.0, 50.0), "max-height 는 bottom 조건 아님");

        // top collapse 는 height 와 무관 (§8.3.1 top 조건 = border/padding 만).
        let mut tree = LayoutTree::new();
        let json = r#"[
            {"style":{"display":"block","height":"10px"},"children":[]},
            {"style":{"display":"block","height":"20px","marginTop":"20px"},"children":[]},
            {"style":{"display":"block","height":"50px"},"children":[1]},
            {"style":{"display":"block","height":"10px"},"children":[]},
            {"style":{"display":"block","width":"300px"},"children":[0,2,3]}
        ]"#;
        let h = tree.build_tree_batch(json).unwrap();
        tree.compute_layout(h[4], 300.0, 200.0);
        assert_eq!(tree.get_layout(h[2]).y, 30.0, "c 의 margin-top 이 p top 을 관통");
        assert_eq!(tree.get_layout(h[1]).y, 0.0);
        assert_eq!(tree.get_layout(h[3]).y, 80.0);
    }

    /// r12m1/r12m2 — percentage min-height 는 세로 ctx (auto 부모 = indefinite → 0, §10.7:
    /// Chrome b.y 40 / 수평 ctx 150 오판 35) · min > max 는 min 우선 (§10.7 max-then-min:
    /// Chrome p.h 30 · b.y 45 / min-then-max 10 · 25) · sweep: root fixup (root.h 30 / 10) ·
    /// grid 트랙 기여값 (c.h 30 / 10).
    #[test]
    fn adr923_p3_r12_percent_min_height_ctx_and_clamp_order() {
        let run = |p_style: &str| -> (f32, f32, f32) {
            let mut tree = LayoutTree::new();
            let json = format!(
                r#"[
                {{"style":{{"display":"block","height":"20px","marginBottom":"20px"}},"children":[]}},
                {{"style":{{"display":"block",{p_style}}},"children":[0]}},
                {{"style":{{"display":"block","height":"10px"}},"children":[]}},
                {{"style":{{"display":"block","width":"300px"}},"children":[1,2]}}
            ]"#
            );
            let h = tree.build_tree_batch(&json).unwrap();
            tree.compute_layout(h[3], 300.0, 200.0);
            (tree.get_layout(h[1]).height, tree.get_layout(h[2]).y, tree.get_layout(h[3]).height)
        };
        assert_eq!(run(r#""minHeight":"50%","marginBottom":"15px""#), (20.0, 40.0, 50.0), "indefinite CB 의 % min-height = 0 → 접힘");
        assert_eq!(run(r#""minHeight":"30px","maxHeight":"10px","marginBottom":"15px""#), (30.0, 45.0, 55.0), "min > max → min 우선");

        let mut tree = LayoutTree::new();
        let json = r#"[
            {"style":{"display":"block","height":"20px"},"children":[]},
            {"style":{"display":"block","width":"300px","minHeight":"30px","maxHeight":"10px"},"children":[0]}
        ]"#;
        let h = tree.build_tree_batch(json).unwrap();
        tree.compute_layout(h[1], 300.0, 200.0);
        assert_eq!(tree.get_layout(h[1]).height, 30.0, "root fixup 도 max-then-min");

        let mut tree = LayoutTree::new();
        let json = r#"[
            {"style":{"minHeight":"30px","maxHeight":"10px"},"children":[]},
            {"style":{"display":"grid","gridTemplateColumns":["1fr"],"width":"300px"},"children":[0]}
        ]"#;
        let h = tree.build_tree_batch(json).unwrap();
        tree.compute_layout(h[1], 300.0, 200.0);
        assert_eq!(tree.get_layout(h[0]).height, 30.0, "grid item min > max → 30");
        assert_eq!(tree.get_layout(h[1]).height, 30.0, "auto 트랙 기여값도 30");
    }

    /// r9 인접 — line box 는 margin 을 collapse 하지 않는다 (block h10+mb10 뒤 inline-block
    /// y 20 — Chrome block-margin-then-line-box).
    #[test]
    fn adr923_p3_r9_block_margin_then_line_box() {
        let mut tree = LayoutTree::new();
        let json = r#"[
            {"style":{"display":"block","height":"10px","marginBottom":"10px"},"children":[]},
            {"style":{"display":"inline-block","width":"60px","height":"20px"},"children":[]},
            {"style":{"display":"block","width":"300px"},"children":[0,1]}
        ]"#;
        let h = tree.build_tree_batch(json).unwrap();
        tree.compute_layout(h[2], 300.0, 200.0);
        assert_eq!(tree.get_layout(h[1]).y, 20.0);
        assert_eq!(tree.get_layout(h[2]).height, 40.0);
    }

    /// vertical-align: bottom 초과분은 line 을 위로 늘려 baseline 을 아래로 민다
    /// (§10.8.1 — Chrome 실측 valign-bottom: a.y 20).
    #[test]
    fn adr923_p3_valign_bottom_pushes_baseline() {
        let mut tree = LayoutTree::new();
        let json = r#"[
            {"style":{"display":"inline-block","width":"60px","height":"20px"},"children":[]},
            {"style":{"display":"inline-block","width":"60px","height":"40px","verticalAlign":"bottom"},"children":[]},
            {"style":{"display":"block","width":"300px","height":"200px"},"children":[0,1]}
        ]"#;
        let h = tree.build_tree_batch(json).unwrap();
        tree.compute_layout(h[2], 300.0, 200.0);
        assert_eq!(tree.get_layout(h[0]).y, 20.0, "baseline = max(20, 40-0) = 40 → a.y 20");
        assert_eq!(tree.get_layout(h[1]).y, 0.0, "bottom 정렬 — line bottom 에 맞음");
    }

    /// 폴백 baseline = bottom **margin** edge (§10.8.1 — Chrome 실측
    /// ib-baseline-margin-bottom: h20+mb8 → baseline 28, a.y 12).
    #[test]
    fn adr923_p3_baseline_fallback_margin_edge() {
        let mut tree = LayoutTree::new();
        let json = r#"[
            {"style":{"display":"inline-block","width":"60px","height":"20px","marginBottom":"8px"},"children":[]},
            {"style":{"display":"inline-block","width":"60px","height":"40px"},"children":[]},
            {"style":{"display":"block","width":"300px","height":"200px"},"children":[0,1]}
        ]"#;
        let h = tree.build_tree_batch(json).unwrap();
        tree.compute_layout(h[2], 300.0, 200.0);
        assert_eq!(tree.get_layout(h[0]).y, 12.0, "40(line) − 28(margin-edge baseline)");
    }

    /// overflow ≠ visible 인 atomic inline 은 내부 line box 대신 bottom margin edge 가
    /// baseline (§10.8.1 두 번째 조항 — Chrome 실측 ib-overflow-hidden-baseline: a.y 10).
    #[test]
    fn adr923_p3_overflow_hidden_forces_margin_edge_baseline() {
        let mut tree = LayoutTree::new();
        let json = r#"[
            {"style":{"display":"inline-block","width":"60px","height":"20px"},"children":[]},
            {"style":{"display":"inline-block","width":"60px","paddingBottom":"10px","overflowX":"hidden","overflowY":"hidden"},"children":[0]},
            {"style":{"display":"inline-block","width":"60px","height":"40px"},"children":[]},
            {"style":{"display":"block","width":"300px","height":"200px"},"children":[1,2]}
        ]"#;
        let h = tree.build_tree_batch(json).unwrap();
        tree.compute_layout(h[3], 300.0, 200.0);
        assert_eq!(
            tree.get_layout(h[1]).y,
            10.0,
            "내부 line baseline 20 무시 — margin edge 30 으로 정렬 (40-30)"
        );
    }

    /// atomic inline + 폭 auto 는 shrink-to-fit (§10.3.9) — Chrome 실측 3종:
    /// wrap fit-content 100 (one-pass 80 아님) · available < min-content 는 floor 80 ·
    /// percentage 자식은 fit(60) 기준 재해소 30.
    #[test]
    fn adr923_p3_inline_shrink_to_fit() {
        let mut tree = LayoutTree::new();
        let json = r#"[
            {"style":{"width":"80px","height":"20px"},"children":[]},
            {"style":{"width":"80px","height":"20px"},"children":[]},
            {"style":{"display":"inline-flex","flexWrap":"wrap"},"children":[0,1]},
            {"style":{"display":"block","width":"100px","height":"200px"},"children":[2]}
        ]"#;
        let h = tree.build_tree_batch(json).unwrap();
        tree.compute_layout(h[3], 300.0, 200.0);
        let f = tree.get_layout(h[2]);
        assert_eq!(f.width, 100.0, "fit-content = min(160, max(80, 100)) = 100");
        assert_eq!(f.height, 40.0, "fit 100 에서 wrap → 2 line");

        let mut tree2 = LayoutTree::new();
        let json2 = r#"[
            {"style":{"width":"80px","height":"20px"},"children":[]},
            {"style":{"display":"inline-flex"},"children":[0]},
            {"style":{"display":"block","width":"60px","height":"200px"},"children":[1]}
        ]"#;
        let h2 = tree2.build_tree_batch(json2).unwrap();
        tree2.compute_layout(h2[2], 300.0, 200.0);
        assert_eq!(tree2.get_layout(h2[1]).width, 80.0, "min-content floor — overflow");

        let mut tree3 = LayoutTree::new();
        let json3 = r#"[
            {"style":{"width":"60px","height":"20px","flexShrink":0},"children":[]},
            {"style":{"width":"50%","height":"20px","flexShrink":0},"children":[]},
            {"style":{"display":"inline-flex"},"children":[0,1]},
            {"style":{"display":"block","width":"100px","height":"200px"},"children":[2]}
        ]"#;
        let h3 = tree3.build_tree_batch(json3).unwrap();
        tree3.compute_layout(h3[3], 300.0, 200.0);
        assert_eq!(tree3.get_layout(h3[2]).width, 60.0, "fit = maxc(pct→auto) = 60");
        assert_eq!(tree3.get_layout(h3[1]).width, 30.0, "50% 는 fit 60 기준 재해소");
    }

    // ── ADR-923 Phase 1: display.rs 배선 — outer → line item, inner → solver ──
    //
    // 계약: 엔진 경계의 display 는 CSS 값 1개. 부모 block 은 자식의 **outer** 로 line item
    // 여부를, 자식 자신은 **inner** 로 solver 를 고른다 (CSS Display 3 §2). TS 는 오늘
    // inline-flex/inline-grid 를 엔진에 보내지 않으므로 (S9 정규화) 프로덕션 동작 무변경 —
    // Phase 5 cutover 가 이 경로를 켠다.

    /// block 부모 아래 inline-flex 자식 2 = 같은 line box (outer=inline 이 line item).
    #[test]
    fn adr923_block_parent_inline_flex_children_share_line_box() {
        let mut tree = LayoutTree::new();
        // post-order: leaf0, A(inline-flex>[0]), leaf2, B(inline-flex>[2]), root(block>[1,3])
        let json = r#"[
            {"style":{"width":"60px","height":"30px"},"children":[]},
            {"style":{"display":"inline-flex","flexDirection":"row"},"children":[0]},
            {"style":{"width":"60px","height":"30px"},"children":[]},
            {"style":{"display":"inline-flex","flexDirection":"row"},"children":[2]},
            {"style":{"display":"block","width":"300px","height":"100px"},"children":[1,3]}
        ]"#;
        let h = tree.build_tree_batch(json).unwrap();
        tree.compute_layout(h[4], 300.0, 100.0);
        let a = tree.get_layout(h[1]);
        let b = tree.get_layout(h[3]);
        assert_eq!((a.x, a.y), (0.0, 0.0), "A 는 줄 머리");
        assert_eq!((a.width, a.height), (60.0, 30.0), "inline-flex 폭은 shrink-to-fit (content)");
        assert_eq!((b.x, b.y), (60.0, 0.0), "B 는 A 오른쪽 같은 줄 — line item");
    }

    /// inline-flex 자식의 inner=flex: 자기 자식 2개가 가로로 놓인다 (block 이면 세로).
    #[test]
    fn adr923_inline_flex_child_inner_solver_is_flex() {
        let mut tree = LayoutTree::new();
        let json = r#"[
            {"style":{"width":"40px","height":"20px"},"children":[]},
            {"style":{"width":"40px","height":"20px"},"children":[]},
            {"style":{"display":"inline-flex","flexDirection":"row"},"children":[0,1]},
            {"style":{"display":"block","width":"300px","height":"100px"},"children":[2]}
        ]"#;
        let h = tree.build_tree_batch(json).unwrap();
        tree.compute_layout(h[3], 300.0, 100.0);
        let l0 = tree.get_layout(h[0]);
        let l1 = tree.get_layout(h[1]);
        assert_eq!((l0.x, l0.y), (0.0, 0.0));
        assert_eq!((l1.x, l1.y), (40.0, 0.0), "inner=flex row → 가로 배치");
        let c = tree.get_layout(h[2]);
        assert_eq!((c.width, c.height), (80.0, 20.0), "컨테이너는 item 합 (shrink-to-fit)");
    }

    /// inline-grid 동형: line item (outer=inline) + inner=grid (자식이 열 track 을 따른다).
    #[test]
    fn adr923_block_parent_inline_grid_child_is_line_item_with_grid_inner() {
        let mut tree = LayoutTree::new();
        // post-order: leaf0, leaf1, A(inline-grid 2col>[0,1]), B(inline-block 60×30), root(block>[2,3])
        let json = r#"[
            {"style":{"height":"20px"},"children":[]},
            {"style":{"height":"20px"},"children":[]},
            {"style":{"display":"inline-grid","gridTemplateColumns":["50px","50px"]},"children":[0,1]},
            {"style":{"display":"inline-block","width":"60px","height":"30px"},"children":[]},
            {"style":{"display":"block","width":"300px","height":"100px"},"children":[2,3]}
        ]"#;
        let h = tree.build_tree_batch(json).unwrap();
        tree.compute_layout(h[4], 300.0, 100.0);
        let l0 = tree.get_layout(h[0]);
        let l1 = tree.get_layout(h[1]);
        assert_eq!((l0.x, l0.width), (0.0, 50.0), "grid col 1");
        assert_eq!((l1.x, l1.width), (50.0, 50.0), "grid col 2 — inner=grid");
        let a = tree.get_layout(h[2]);
        let b = tree.get_layout(h[3]);
        assert_eq!(a.width, 100.0, "inline-grid 폭 = track 합");
        assert_eq!((b.x, b.y), (100.0, 0.0), "inline-block B 가 inline-grid A 와 같은 줄");
    }

    /// 순수 inline(outer=inline, inner=flow) 은 S4(B 갈래) 까지 현행대로 block 격상 (code 0).
    /// 본 ADR 밖 — 동작 무변경 확인용 고정.
    #[test]
    fn adr923_pure_inline_child_stays_block_level_until_s4() {
        let mut tree = LayoutTree::new();
        let json = r#"[
            {"style":{"width":"60px","height":"30px"},"children":[]},
            {"style":{"display":"inline"},"children":[0]},
            {"style":{"width":"60px","height":"30px"},"children":[]},
            {"style":{"display":"inline"},"children":[2]},
            {"style":{"display":"block","width":"300px","height":"100px"},"children":[1,3]}
        ]"#;
        let h = tree.build_tree_batch(json).unwrap();
        tree.compute_layout(h[4], 300.0, 100.0);
        let a = tree.get_layout(h[1]);
        let b = tree.get_layout(h[3]);
        assert_eq!(a.width, 300.0, "block 격상 → auto 폭 stretch");
        assert_eq!((b.x, b.y), (0.0, 30.0), "세로 적층 (현행 유지)");
    }

    /// inline-block 은 종전대로 line item — 회귀 고정 (tree intake 경유).
    #[test]
    fn adr923_inline_block_children_still_line_items() {
        let mut tree = LayoutTree::new();
        let json = r#"[
            {"style":{"display":"inline-block","width":"60px","height":"30px"},"children":[]},
            {"style":{"display":"inline-block","width":"60px","height":"30px"},"children":[]},
            {"style":{"display":"block","width":"300px","height":"100px"},"children":[0,1]}
        ]"#;
        let h = tree.build_tree_batch(json).unwrap();
        tree.compute_layout(h[2], 300.0, 100.0);
        let a = tree.get_layout(h[0]);
        let b = tree.get_layout(h[1]);
        assert_eq!((a.x, a.y), (0.0, 0.0));
        assert_eq!((b.x, b.y), (60.0, 0.0));
    }

    /// 컨테이너 solver 선택은 inner 만 본다 — outer 는 부모의 line item 판정 몫.
    #[test]
    fn adr923_classify_container_display_uses_inner_only() {
        assert!(matches!(classify_container_display(Some("inline-flex")), ContainerDisplay::Flex));
        assert!(matches!(classify_container_display(Some("inline-grid")), ContainerDisplay::Grid));
        assert!(matches!(classify_container_display(Some("inline-block")), ContainerDisplay::Block));
        assert!(matches!(classify_container_display(Some("inline")), ContainerDisplay::Block));
        assert!(matches!(classify_container_display(Some("flow-root")), ContainerDisplay::Block));
        assert!(matches!(classify_container_display(Some("none")), ContainerDisplay::Block));
        assert!(matches!(classify_container_display(Some("list-item")), ContainerDisplay::Block));
        assert!(matches!(classify_container_display(None), ContainerDisplay::Block));
    }

    /// flex 부모 아래 inline-flex/inline-block 자식은 blockify (outer=block) — flex item 이고
    /// inner 는 유지. `effective_display` 가 그 계약을 낸다.
    #[test]
    fn adr923_flex_parent_blockifies_inline_child_outer_keeps_inner() {
        let mut tree = LayoutTree::new();
        let json = r#"[
            {"style":{"width":"60px","height":"30px"},"children":[]},
            {"style":{"display":"inline-flex","flexDirection":"row"},"children":[0]},
            {"style":{"display":"inline-block","width":"60px","height":"30px"},"children":[]},
            {"style":{"display":"flex","flexDirection":"row","width":"300px","height":"100px"},"children":[1,2]}
        ]"#;
        let h = tree.build_tree_batch(json).unwrap();
        tree.compute_layout(h[3], 300.0, 100.0);
        let a = tree.effective_display(h[1]);
        assert_eq!(a, Display { outer: display::OuterDisplay::Block, inner: InnerDisplay::Flex });
        let b = tree.effective_display(h[2]);
        assert_eq!(b, Display { outer: display::OuterDisplay::Block, inner: InnerDisplay::FlowRoot });
        // block 부모 아래서는 outer 가 보존된다 (root 는 부모 없음 → 자기 값).
        assert_eq!(tree.effective_display(h[3]).outer, display::OuterDisplay::Block);
        let la = tree.get_layout(h[1]);
        let lb = tree.get_layout(h[2]);
        assert_eq!((la.x, lb.x), (0.0, 60.0), "둘 다 flex item");
    }
}
