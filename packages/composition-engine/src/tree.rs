//! ADR-916 Phase 2-B — `tree.rs` 트리 오케스트레이션 (단위 1: leaf-only skeleton)
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
//! flex/block/grid.rs 는 모두 "단일 컨테이너 + 자식 flat f32 → 자식 위치" 1-depth
//! 커널이다. batch 계약은 N-depth 트리 상호의존을 해결해야 하므로, 그 사이를
//! 잇는 오케스트레이션(handle 관리 + post-order intrinsic + top-down placement +
//! display dispatch)을 층별로 나눠 각 단위를 cargo test 로 검증한다.
//!
//! - **단위 1 (본 파일 현재)**: tree 자료구조 + handle 관리(alloc/recycle) +
//!   `build_tree_batch` 골격(post-order 파싱·저장·handle 배열) + `get_layouts_batch`
//!   flat 반환 + 증분 API(create/update/set_children/remove/mark_dirty/clear).
//!   `compute_layout` 은 **leaf-only** — 각 노드를 자기 크기(width/height)만
//!   해결하고 자식 배치는 하지 않는다(자식 좌표 0). taffy_bridge.rs 의 handle
//!   생명주기(`alloc_handle`/`resolve`/`free_list`) 를 정확히 대응.
//! - **단위 2 (다음)**: post-order intrinsic 크기 측정(자식→부모 bottom-up).
//! - **단위 3 (다음)**: top-down placement + display dispatch(각 노드에서
//!   flex/block/grid.rs 로 자식 flat f32 변환·호출).
//! - **단위 4 (다음)**: 증분 dirty 추적 + 재계산 최소화(taffy mark_dirty 대응).
//!
//! seam 미배선 순수 Rust — live builder 영향 0. `createLayoutEngine` 실배선(flag
//! 전환)은 flex/block/grid 트리 dual-run(Taffy self-diff 0) 통과 후 별도 단계.

use serde::Deserialize;

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
    /// 자식 배치(intrinsic 측정 + placement + display dispatch)는 단위 2/3 범위 —
    /// 현재는 모든 노드 좌표가 (0,0). height sentinel(-1)→MaxContent 는 단위 2
    /// (intrinsic) 에서 구현하므로, 현재는 명시 크기(px/%/vw…)만 해결하고
    /// auto 는 0 으로 둔다.
    ///
    /// `available_height < 0` sentinel(taffy_bridge.rs RC-1) 대응은 단위 2 로 이연.
    pub fn compute_layout(&mut self, root: usize, available_width: f32, available_height: f32) {
        if self.get(root).is_none() {
            return;
        }
        // 컨테이너 % 기준 컨텍스트 (root 는 available_width/height 기준).
        let ctx = CssValueContext {
            parent_size: None,
            container_size: Some(available_width),
            viewport_width: None,
            viewport_height: None,
            root_font_size: None,
        };

        // 단위 1: 살아있는 모든 노드를 leaf 처럼 자기 크기만 해결.
        // (트리 순회·자식 배치는 단위 2/3. 여기서는 handle 계약·크기 해결 커널만 검증.)
        let handles: Vec<usize> = (0..self.nodes.len())
            .filter(|&h| self.get(h).is_some())
            .collect();

        for h in handles {
            let (w, ht) = self.resolve_self_size(h, &ctx, available_width, available_height);
            if let Some(node) = self.get_mut(h) {
                node.layout = NodeLayout { x: 0.0, y: 0.0, width: w, height: ht };
                node.dirty = false;
            }
        }
    }

    /// 노드 자기 크기(width/height) 해결. auto/미설정은 0 (단위 2 intrinsic 이전).
    fn resolve_self_size(
        &self,
        handle: usize,
        ctx: &CssValueContext,
        avail_w: f32,
        avail_h: f32,
    ) -> (f32, f32) {
        let Some(node) = self.get(handle) else {
            return (0.0, 0.0);
        };
        let w = resolve_dimension(node.style.width.as_deref(), ctx, avail_w);
        // height 컨텍스트는 세로 기준 container_size 로 교체.
        let h_ctx = CssValueContext { container_size: Some(avail_h), ..*ctx };
        let h = resolve_dimension(node.style.height.as_deref(), &h_ctx, avail_h);
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
/// 단위 1 은 intrinsic(fit/min/max-content, auto) 미지원 → 0. style.rs 의
/// FIT/MIN/MAX_CONTENT 센티넬은 단위 2(intrinsic)에서 해석.
fn resolve_dimension(value: Option<&str>, ctx: &CssValueContext, _avail: f32) -> f32 {
    match value {
        Some(v) => {
            let trimmed = v.trim();
            if trimmed.is_empty() || trimmed.eq_ignore_ascii_case("auto") {
                return 0.0;
            }
            match resolve_css_size_value(trimmed, ctx) {
                // 음수 센티넬(fit/min/max-content)은 단위 2 이전엔 0.
                Some(n) if n >= 0.0 => n,
                _ => 0.0,
            }
        }
        None => 0.0,
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

    // ── get_layouts_batch ──

    #[test]
    fn layouts_batch_flat_shape() {
        let mut tree = LayoutTree::new();
        let json = format!(
            "[{}, {}]",
            style_json("100px", "50px"),
            style_json("200px", "80px")
        );
        let handles = tree.build_tree_batch(&json).unwrap();
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
