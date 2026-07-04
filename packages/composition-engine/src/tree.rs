//! ADR-916 Phase 2-B — `tree.rs` 트리 오케스트레이션 (단위 3-a: block dispatch)
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
//! - **단위 3 (진행 중)**: block + grid dispatch 추가 (display 별 분기 완성).
//!   세 커널의 계약이 비대칭이라(2026-07-04 실사) display 별 최소 검증층으로 재분할:
//!   - **단위 3-a (본 파일 현재)**: **block dispatch** — `block_layout`.
//!     flex 와 계약이 가장 가까움(자식 flat f32, 자식 재귀 solve 로 content_w/h 확보).
//!     block.rs 는 19필드/자식(물리축, vertical stacking) + OUT 은 `4*n + 2` (trailing
//!     firstChildMarginTop/lastChildMarginBottom metadata). auto width 는 컨테이너로
//!     stretch, fit-content 는 content_w 사용. margin collapse/inline-block/BFC 는
//!     block.rs 내부 처리 — tree.rs 는 오케스트레이션(자식 solve → flat → 위치 반영).
//!   - **단위 3-b (다음)**: **grid dispatch** — `grid_layout`. grid 는 계약이 근본적
//!     으로 다름(자식 flat 없음, template 문자열 + placement_spec 문자열로 트랙 산술).
//!     NodeStyle 의 `grid_template_columns: Vec<String>` → space-join, 자식 gridArea/
//!     gridColumn/gridRow → `parse_placements` 파이프 형식 직렬화 어댑터 필요.
//! - **단위 4 (다음)**: 증분 dirty 추적 + 재계산 최소화(taffy mark_dirty 대응).
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

use crate::block;
use crate::flex;
use crate::style::{resolve_css_size_value, CssValueContext};

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
}

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
}

impl NodeLayout {
    const ZERO: NodeLayout = NodeLayout { x: 0.0, y: 0.0, width: 0.0, height: 0.0 };
}

/// 트리 노드 (style + 자식 handle + 계산 결과).
#[derive(Debug, Clone)]
struct TreeNode {
    style: NodeStyle,
    children: Vec<usize>,
    layout: NodeLayout,
    /// 다음 compute_layout 에서 재계산 필요 여부 (단위 4 에서 실사용).
    dirty: bool,
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
}

impl LayoutTree {
    /// 빈 트리 생성.
    pub fn new() -> Self {
        Self::default()
    }

    // ── handle 관리 (taffy_bridge.rs alloc_handle/resolve 대응) ──

    /// 노드를 저장하고 handle 을 발급 (free_list 우선 재활용).
    fn alloc_handle(&mut self, node: TreeNode) -> usize {
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
        self.alloc_handle(TreeNode { style, children: Vec::new(), layout: NodeLayout::ZERO, dirty: true })
    }

    /// 기존 노드 스타일 교체 (dirty 표시).
    pub fn update_style(&mut self, handle: usize, style: NodeStyle) {
        if let Some(node) = self.get_mut(handle) {
            node.style = style;
            node.dirty = true;
        }
    }

    /// 노드 자식 교체 (dirty 표시).
    pub fn set_children(&mut self, handle: usize, children: Vec<usize>) {
        if let Some(node) = self.get_mut(handle) {
            node.children = children;
            node.dirty = true;
        }
    }

    /// 노드를 dirty 로 표시 (다음 compute_layout 에서 재계산).
    pub fn mark_dirty(&mut self, handle: usize) {
        if let Some(node) = self.get_mut(handle) {
            node.dirty = true;
        }
    }

    /// 노드 제거 + handle 을 free_list 로 반환(재활용 대상).
    pub fn remove_node(&mut self, handle: usize) {
        if handle < self.nodes.len() && self.nodes[handle].is_some() {
            self.nodes[handle] = None;
            self.free_list.push(handle);
        }
    }

    /// 전체 트리 초기화.
    pub fn clear(&mut self) {
        self.nodes.clear();
        self.free_list.clear();
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
                children: child_handles,
                layout: NodeLayout::ZERO,
                dirty: true,
            });
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
    /// block/grid dispatch 는 단위 3. 현재 flex 아닌 컨테이너는 자기 크기만 해결
    /// (자식 미배치) — 단위 3 에서 완성.
    pub fn compute_layout(&mut self, root: usize, available_width: f32, available_height: f32) {
        if self.get(root).is_none() {
            return;
        }
        self.solve_node(root, available_width, available_height);
    }

    /// 노드 하나를 solve — 자식을 먼저 재귀 solve 한 뒤 display 별로 배치.
    /// 반환: (content_width, content_height) — 부모 intrinsic 도출용.
    fn solve_node(&mut self, handle: usize, avail_w: f32, avail_h: f32) -> (f32, f32) {
        let Some(node) = self.get(handle) else {
            return (0.0, 0.0);
        };
        let children = node.children.clone();
        let display = classify_container_display(node.style.display.as_deref());

        // 명시 크기(있으면) — auto 는 아래에서 content 로 채움.
        let (explicit_w, explicit_h) = self.resolve_self_size(handle, avail_w, avail_h);

        // leaf 또는 (단위 3-b 미지원) grid 컨테이너: 자기 크기만.
        if children.is_empty() || display == ContainerDisplay::Other {
            let w = explicit_w;
            let h = explicit_h;
            if let Some(n) = self.get_mut(handle) {
                n.layout = NodeLayout { x: 0.0, y: 0.0, width: w, height: h };
                n.dirty = false;
            }
            return (w, h);
        }

        // display 별 dispatch — 자식을 먼저 solve → flat f32 → 커널 → 위치 배치.
        match display {
            ContainerDisplay::Flex => {
                self.solve_flex(handle, &children, explicit_w, explicit_h, avail_w, avail_h)
            }
            ContainerDisplay::Block => {
                self.solve_block(handle, &children, explicit_w, explicit_h, avail_w, avail_h)
            }
            // Other(grid) 는 위에서 early return — 도달 불가.
            ContainerDisplay::Other => (explicit_w, explicit_h),
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

        let ctx = self.ctx_for(avail_w);
        let gap_row = resolve_gap(style.row_gap.as_deref(), &ctx);
        let gap_col = resolve_gap(style.column_gap.as_deref(), &ctx);
        // main/cross gap 매핑 (row → main=column_gap, cross=row_gap).
        let (gap_main, gap_cross) =
            if is_row { (gap_col, gap_row) } else { (gap_row, gap_col) };

        // 자식 available: 컨테이너 명시 크기 있으면 그것, 없으면 상속 avail.
        let child_avail_w = if explicit_w > 0.0 { explicit_w } else { avail_w };
        let child_avail_h = if explicit_h > 0.0 { explicit_h } else { avail_h };

        // 1) 자식 재귀 solve → 각 자식 content 크기 확보.
        let mut child_sizes: Vec<(f32, f32)> = Vec::with_capacity(children.len());
        for &c in children {
            let cs = self.solve_node(c, child_avail_w, child_avail_h);
            child_sizes.push(cs);
        }

        // 2) 자식 → flex flat f32 (논리축 main/cross 변환).
        let mut data = vec![0.0f32; children.len() * flex::FLEX_FIELD_COUNT];
        for (i, &c) in children.iter().enumerate() {
            let cstyle = self.get(c).map(|n| n.style.clone()).unwrap_or_default();
            let (cw, ch) = child_sizes[i];
            write_flex_item(&mut data, i, &cstyle, cw, ch, is_row, &ctx);
        }

        // 3) main/cross available.
        let (avail_main, avail_cross) = if is_row {
            (child_avail_w, child_avail_h)
        } else {
            (child_avail_h, child_avail_w)
        };

        let out = flex::flex_layout(
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
        );

        // 4) 자식 위치 반영 + bounding box 로 컨테이너 content 크기 도출.
        let mut max_right: f32 = 0.0;
        let mut max_bottom: f32 = 0.0;
        for (i, &c) in children.iter().enumerate() {
            let off = i * 4;
            let (x, y, w, h) = (out[off], out[off + 1], out[off + 2], out[off + 3]);
            if let Some(n) = self.get_mut(c) {
                n.layout = NodeLayout { x, y, width: w, height: h };
            }
            max_right = max_right.max(x + w);
            max_bottom = max_bottom.max(y + h);
        }

        // 컨테이너 크기: 명시 있으면 명시, 없으면 자식 bounding box.
        let container_w = if explicit_w > 0.0 { explicit_w } else { max_right };
        let container_h = if explicit_h > 0.0 { explicit_h } else { max_bottom };
        if let Some(n) = self.get_mut(handle) {
            n.layout = NodeLayout { x: 0.0, y: 0.0, width: container_w, height: container_h };
            n.dirty = false;
        }
        (container_w, container_h)
    }

    /// block 컨테이너 solve — 자식 재귀 → `block.rs`(`block_layout`) → 컨테이너 크기 도출.
    ///
    /// block 은 flex 와 달리 논리축 변환이 없다(항상 물리 vertical stacking). 자식을
    /// 먼저 solve 해 content_w/h 를 확보하고, 19필드 flat f32(물리축)로 직렬화해
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
        let ctx = self.ctx_for(avail_w);

        // 자식 available: 컨테이너 명시 폭 있으면 그것, 없으면 상속 avail.
        let child_avail_w = if explicit_w > 0.0 { explicit_w } else { avail_w };
        let child_avail_h = if explicit_h > 0.0 { explicit_h } else { avail_h };

        // 1) 자식 재귀 solve → content 크기 확보.
        let mut child_sizes: Vec<(f32, f32)> = Vec::with_capacity(children.len());
        for &c in children {
            let cs = self.solve_node(c, child_avail_w, child_avail_h);
            child_sizes.push(cs);
        }

        // 2) 자식 → block flat f32 (19필드, 물리축).
        let mut data = vec![0.0f32; children.len() * block::FIELD_COUNT];
        for (i, &c) in children.iter().enumerate() {
            let cstyle = self.get(c).map(|n| n.style.clone()).unwrap_or_default();
            let (cw, ch) = child_sizes[i];
            write_block_item(&mut data, i, &cstyle, cw, ch, &ctx);
        }

        // 3) block_layout — BFC 격리 가정(부모-자식 collapse 미전파, 단위 3-a scope).
        let out = block::block_layout(&data, child_avail_w, child_avail_h, false, false, 0.0);

        // 4) 자식 위치 반영 + bounding box 로 컨테이너 content 크기 도출.
        //    (out 마지막 2값은 firstChildMarginTop/lastChildMarginBottom metadata — 단위 3-a 미소비.)
        let mut max_right: f32 = 0.0;
        let mut max_bottom: f32 = 0.0;
        for (i, &c) in children.iter().enumerate() {
            let off = i * 4;
            let (x, y, w, h) = (out[off], out[off + 1], out[off + 2], out[off + 3]);
            if let Some(n) = self.get_mut(c) {
                n.layout = NodeLayout { x, y, width: w, height: h };
            }
            max_right = max_right.max(x + w);
            max_bottom = max_bottom.max(y + h);
        }

        // 컨테이너 크기: 명시 있으면 명시, 없으면 자식 bounding box.
        let container_w = if explicit_w > 0.0 { explicit_w } else { max_right };
        let container_h = if explicit_h > 0.0 { explicit_h } else { max_bottom };
        if let Some(n) = self.get_mut(handle) {
            n.layout = NodeLayout { x: 0.0, y: 0.0, width: container_w, height: container_h };
            n.dirty = false;
        }
        (container_w, container_h)
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

    // ── 결과 수집 (taffy_bridge.rs get_layouts_batch 대응) ──

    /// 여러 노드의 레이아웃을 flat `[x0,y0,w0,h0, x1,y1,w1,h1, ...]` 로 수집.
    /// 무효 handle 은 `[0,0,0,0]`.
    pub fn get_layouts_batch(&self, handles: &[usize]) -> Vec<f32> {
        let mut out = Vec::with_capacity(handles.len() * 4);
        for &h in handles {
            let l = self.get(h).map(|n| n.layout).unwrap_or(NodeLayout::ZERO);
            out.extend_from_slice(&[l.x, l.y, l.width, l.height]);
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
/// 단위 2 는 Flex 만, 단위 3-a 는 Block 추가 실배치. Grid 는 단위 3-b 에서 실배치
/// (현재 Other 로 분류돼 자기 크기만). `_hasChildren` 컨테이너의 CSS 기본 display
/// 는 block 이므로(display 미설정 → block), non-flex/non-grid 는 Block 으로 취급한다.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
enum ContainerDisplay {
    Flex,
    Block,
    /// grid/기타 — 단위 3-b 에서 grid dispatch 추가.
    Other,
}

/// display 문자열 → 컨테이너 분류.
///
/// - flex/inline-flex → Flex (단위 2)
/// - block/inline-block/flow-root/list-item/미설정 → Block (단위 3-a)
/// - grid/inline-grid/기타 → Other (단위 3-b 에서 grid 실배치)
///
/// display 미설정(None)이 Block 인 이유: CSS 초기 display 는 inline 이지만
/// composition 의 `_hasChildren` 컨테이너는 상단(taffyDisplayAdapter)에서 blockify
/// 되어 내려온다 — tree.rs 는 순수화된 스타일을 받으므로 컨테이너=block 이 기본.
fn classify_container_display(display: Option<&str>) -> ContainerDisplay {
    match display.map(|d| d.trim().to_ascii_lowercase()).as_deref() {
        Some("flex") | Some("inline-flex") => ContainerDisplay::Flex,
        Some("grid") | Some("inline-grid") => ContainerDisplay::Other,
        // block / inline-block / flow-root / list-item / 미설정 → Block
        _ => ContainerDisplay::Block,
    }
}

/// flex-direction → flex.rs DIR_ROW(0)/DIR_COLUMN(1). row-reverse/column-reverse
/// 는 단위 2 미지원(축만 매핑, reverse 는 다음) → row/column 로 정규화.
fn parse_flex_direction(v: Option<&str>) -> u8 {
    match v.map(|s| s.trim().to_ascii_lowercase()).as_deref() {
        Some("column") | Some("column-reverse") => flex::DIR_COLUMN,
        _ => flex::DIR_ROW,
    }
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

/// 자식 스타일 + solve 된 content 크기 → flex.rs flat f32 (논리축 main/cross).
///
/// flex.rs 필드 계약(FLEX_FIELD_COUNT=17): 0=flex_basis, 1=width(main),
/// 2=height(cross), 3-6=margin(top/right/bottom/left, 물리), 7=pad_border_main,
/// 8=pad_border_cross, 9=min_main, 10=max_main, 11=min_cross, 12=max_cross,
/// 13=content_main, 14=content_cross, 15=flex_grow, 16=flex_shrink.
///
/// content_main/cross 는 자식 solve 결과(cw/ch)를 direction 으로 매핑. width/height
/// 명시(>0)면 그 값, 없으면 AUTO(-1) — flex.rs 가 content 로 fallback.
fn write_flex_item(
    data: &mut [f32],
    i: usize,
    cstyle: &NodeStyle,
    cw: f32,
    ch: f32,
    is_row: bool,
    ctx: &CssValueContext,
) {
    let off = i * flex::FLEX_FIELD_COUNT;

    // 명시 width/height (음수=미지정 → AUTO -1).
    let expl_w = resolve_dimension_opt(cstyle.width.as_deref(), ctx);
    let expl_h = resolve_dimension_opt(cstyle.height.as_deref(), ctx);

    // 논리축 매핑: row → main=가로, cross=세로.
    let (main_size, cross_size) = if is_row { (expl_w, expl_h) } else { (expl_h, expl_w) };
    let (content_main, content_cross) = if is_row { (cw, ch) } else { (ch, cw) };

    // flex_basis: 미지정(auto) → -1.
    data[off] = -1.0; // flex_basis AUTO (basis:content/px 는 단위 3 이후)
    data[off + 1] = main_size.unwrap_or(-1.0);
    data[off + 2] = cross_size.unwrap_or(-1.0);
    data[off + 3] = resolve_dimension(cstyle.margin_top.as_deref(), ctx);
    data[off + 4] = resolve_dimension(cstyle.margin_right.as_deref(), ctx);
    data[off + 5] = resolve_dimension(cstyle.margin_bottom.as_deref(), ctx);
    data[off + 6] = resolve_dimension(cstyle.margin_left.as_deref(), ctx);
    data[off + 7] = axis_pad_border(cstyle, ctx, is_row); // pad_border_main
    data[off + 8] = axis_pad_border(cstyle, ctx, !is_row); // pad_border_cross
    // min/max: 미지정 → -1 (AUTO/NONE).
    data[off + 9] = resolve_dimension_opt(min_main_str(cstyle, is_row), ctx).unwrap_or(-1.0);
    data[off + 10] = resolve_dimension_opt(max_main_str(cstyle, is_row), ctx).unwrap_or(-1.0);
    data[off + 11] = resolve_dimension_opt(min_cross_str(cstyle, is_row), ctx).unwrap_or(-1.0);
    data[off + 12] = resolve_dimension_opt(max_cross_str(cstyle, is_row), ctx).unwrap_or(-1.0);
    data[off + 13] = content_main;
    data[off + 14] = content_cross;
    data[off + 15] = cstyle.flex_grow.unwrap_or(0.0).max(0.0);
    data[off + 16] = cstyle.flex_shrink.unwrap_or(1.0).max(0.0);
}

/// 자식 스타일 + solve 된 content 크기 → block.rs flat f32 (19필드, 물리축).
///
/// block.rs 필드 계약(FIELD_COUNT=19): 0=display(0=block/1=inline-block/2=empty-block),
/// 1=width(AUTO=-1/FIT_CONTENT=-2), 2=height, 3-6=margin(t/r/b/l), 7=bfc_flag,
/// 8=pad_border_v, 9=pad_border_h, 10-13=min_w/max_w/min_h/max_h(AUTO=-1),
/// 14=content_w, 15=content_h, 16=vertical_align, 17=baseline, 18=line_height(AUTO=-1).
///
/// 논리축 변환 없음(block 은 항상 물리 vertical stacking). content_w/h 는 자식 solve
/// 결과(cw/ch)를 그대로. width/height 명시(>0)면 그 값, 없으면 AUTO(-1) — block.rs 가
/// auto→stretch(width) / auto→content(height) 로 분기. min/max 미지정도 AUTO(-1).
///
/// vertical_align/baseline/line_height 는 단위 3-a 미소비(inline-block line box 는
/// 상단이 blockify 하거나 leaf 로 전달 — 컨테이너 자식은 block/inline-block 중
/// block 우선) → baseline(0) / valign(0=baseline) / line_height AUTO 기본값.
fn write_block_item(
    data: &mut [f32],
    i: usize,
    cstyle: &NodeStyle,
    cw: f32,
    ch: f32,
    ctx: &CssValueContext,
) {
    let off = i * block::FIELD_COUNT;

    // display: 자식 display=inline-block 이면 1, 그 외 컨테이너 자식은 block(0).
    // (grid/flex 자식도 이 컨테이너 안에선 block-level box 로 취급 — CSS 표준.)
    let display_code: f32 = match cstyle.display.as_deref().map(|d| d.trim().to_ascii_lowercase()).as_deref() {
        Some("inline-block") => 1.0,
        _ => 0.0,
    };

    // 명시 width/height (음수=미지정 → AUTO -1).
    let expl_w = resolve_dimension_opt(cstyle.width.as_deref(), ctx);
    let expl_h = resolve_dimension_opt(cstyle.height.as_deref(), ctx);

    data[off] = display_code;
    data[off + 1] = expl_w.unwrap_or(-1.0); // width AUTO=-1
    data[off + 2] = expl_h.unwrap_or(-1.0); // height AUTO=-1
    data[off + 3] = resolve_dimension(cstyle.margin_top.as_deref(), ctx);
    data[off + 4] = resolve_dimension(cstyle.margin_right.as_deref(), ctx);
    data[off + 5] = resolve_dimension(cstyle.margin_bottom.as_deref(), ctx);
    data[off + 6] = resolve_dimension(cstyle.margin_left.as_deref(), ctx);
    data[off + 7] = 0.0; // bfc_flag — 단위 3-a 미판정(BFC 감지는 상단/후속 단위)
    data[off + 8] = axis_pad_border(cstyle, ctx, false); // pad_border_v (상하)
    data[off + 9] = axis_pad_border(cstyle, ctx, true); // pad_border_h (좌우)
    data[off + 10] = resolve_dimension_opt(cstyle.min_width.as_deref(), ctx).unwrap_or(-1.0);
    data[off + 11] = resolve_dimension_opt(cstyle.max_width.as_deref(), ctx).unwrap_or(-1.0);
    data[off + 12] = resolve_dimension_opt(cstyle.min_height.as_deref(), ctx).unwrap_or(-1.0);
    data[off + 13] = resolve_dimension_opt(cstyle.max_height.as_deref(), ctx).unwrap_or(-1.0);
    data[off + 14] = cw; // content_w
    data[off + 15] = ch; // content_h
    data[off + 16] = 0.0; // vertical_align (0=baseline)
    data[off + 17] = 0.0; // baseline
    data[off + 18] = -1.0; // line_height AUTO
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

#[cfg(test)]
mod tests {
    use super::*;

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
    fn compute_leaf_auto_is_zero_unit1() {
        let mut tree = LayoutTree::new();
        // auto/미설정은 단위 1 에선 0 (intrinsic 은 단위 2).
        let json = r#"[{"style":{"width":"auto"},"children":[]}]"#;
        let handles = tree.build_tree_batch(json).unwrap();
        tree.compute_layout(handles[0], 400.0, 300.0);
        let l = tree.get_layout(handles[0]);
        assert_eq!(l.width, 0.0);
        assert_eq!(l.height, 0.0);
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

    /// block 자식 명시 px width → padding/border 더해진 border-box.
    #[test]
    fn block_child_explicit_width_adds_padding() {
        let mut tree = LayoutTree::new();
        // 자식 width 100px + padding 10 좌우(총 20) → border-box 120.
        let json = r#"[
            {"style":{"width":"100px","height":"30px","paddingLeft":"10px","paddingRight":"10px"},"children":[]},
            {"style":{"display":"block","width":"300px","height":"200px"},"children":[0]}
        ]"#;
        let handles = tree.build_tree_batch(json).unwrap();
        tree.compute_layout(handles[1], 300.0, 200.0);
        let c0 = tree.get_layout(handles[0]);
        assert_eq!(c0.width, 120.0, "explicit width + padding = border-box");
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

    /// grid 컨테이너는 단위 3-a 에서 자식 미배치 — 자기 크기만 (단위 3-b 전).
    ///
    /// grid dispatch 는 단위 3-b. 단위 3-a 에서 grid 컨테이너는 `solve_node` 의
    /// Other 분기로 자기 크기만 해결하고 **자식을 재귀 solve 하지 않는다** →
    /// 자식 layout 은 ZERO(미방문). 단위 3-b 에서 grid_layout dispatch 로 배치된다.
    #[test]
    fn grid_container_self_size_only_unit3a() {
        let mut tree = LayoutTree::new();
        let json = r#"[
            {"style":{"width":"100px","height":"50px"},"children":[]},
            {"style":{"display":"grid","width":"300px","height":"200px"},"children":[0]}
        ]"#;
        let handles = tree.build_tree_batch(json).unwrap();
        tree.compute_layout(handles[1], 300.0, 200.0);
        let container = tree.get_layout(handles[1]);
        assert_eq!(container.width, 300.0);
        assert_eq!(container.height, 200.0);
        // 자식은 미방문(단위 3-b grid dispatch 전) → layout ZERO.
        let child = tree.get_layout(handles[0]);
        assert_eq!(child, NodeLayout::ZERO, "grid 자식은 단위 3-b 전 미배치");
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
        assert_eq!(flat.len(), 8, "2 노드 × 4 = 8 f32");
        // 노드 0: 100×50, 노드 1: 200×80 (x/y=0).
        assert_eq!(&flat[0..4], &[0.0, 0.0, 100.0, 50.0]);
        assert_eq!(&flat[4..8], &[0.0, 0.0, 200.0, 80.0]);
    }

    #[test]
    fn layouts_batch_invalid_handle_zero() {
        let tree = LayoutTree::new();
        let flat = tree.get_layouts_batch(&[42]);
        assert_eq!(flat, vec![0.0, 0.0, 0.0, 0.0]);
    }
}
