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
//!     block.rs 는 19필드/자식(물리축, vertical stacking) + OUT 은 `4*n + 2` (trailing
//!     firstChildMarginTop/lastChildMarginBottom metadata). auto width 는 컨테이너로
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

use crate::block;
use crate::flex;
use crate::grid;
use crate::style::{resolve_css_size_value, CssValueContext, FIT_CONTENT};

/// indefinite available 센티넬 (음수). `%` 크기는 indefinite containing block 에 대해
/// `auto` 로 풀린다(CSS §10.2) — `resolve_dimension` 이 음수 ctx 에서 0(=auto) 을 반환하고,
/// `solve_flex/block` 의 `avail >= 0.0` 가드가 감산을 건너뛴다.
const INDEFINITE_AVAIL: f32 = -1.0;

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
    /// 이 노드 자신의 style/children 변경 여부. 다음 compute_layout 에서
    /// (조상 dirty 전파와 결합해) 재계산 대상 판정에 사용.
    dirty: bool,
    /// 부모 handle (조상 dirty 전파용). root 는 None.
    ///
    /// **Why**: taffy 계약(taffy_bridge.rs:890-893)은 "dirty 를 조상까지 자동
    /// 전파" 한다. 자식 크기 변경 시 부모의 intrinsic size(auto width/height)와
    /// 자식 available 이 바뀌므로, 자식만 재계산하면 부모 배치가 stale 해진다.
    /// parent 포인터로 dirty 를 root 까지 상향 전파해 정확성을 보장한다.
    parent: Option<usize>,
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
        self.alloc_handle(TreeNode {
            style,
            children: Vec::new(),
            layout: NodeLayout::ZERO,
            dirty: true,
            parent: None,
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
        let mut cur = Some(handle);
        let mut guard = self.nodes.len() + 1;
        while let Some(h) = cur {
            if guard == 0 {
                break; // 순환 방지 안전판 (정상 트리에선 도달 불가)
            }
            guard -= 1;
            let Some(node) = self.get_mut(h) else { break };
            if node.dirty {
                // 이미 dirty → 조상도 이미 전파됐다고 가정하고 조기 종료.
                // (증분 API 는 항상 propagate 를 leaf→root 로 완주하므로 dirty 노드의
                //  조상은 반드시 dirty. 중복 전파 비용 절감.)
                break;
            }
            node.dirty = true;
            cur = node.parent;
        }
    }

    /// 노드 제거 + handle 을 free_list 로 반환(재활용 대상).
    ///
    /// 트리 구조 변경이므로 `last_compute` 를 무효화한다 — 이어지는 compute_layout
    /// 이 동일 (root, avail) 로 stale skip 하는 것을 방지. (제거된 handle 이 재활용돼
    /// 다른 노드가 되면 handle 기반 skip 판정이 오염되므로.)
    pub fn remove_node(&mut self, handle: usize) {
        if handle < self.nodes.len() && self.nodes[handle].is_some() {
            self.nodes[handle] = None;
            self.free_list.push(handle);
            self.last_compute = None;
        }
    }

    /// 전체 트리 초기화.
    pub fn clear(&mut self) {
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
                parent: None,
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
    }

    /// 서브트리(`handle` 포함)에 dirty 노드가 하나라도 있으면 true.
    ///
    /// clean 서브트리(전부 false)는 `solve_node` 가 저장된 layout 을 재사용하고
    /// 재귀를 생략할 수 있다. dirty 노드가 하나라도 있으면 정확성을 위해 해당
    /// 노드부터 전체 재solve(자식 available 이 부모 재배치로 바뀔 수 있으므로).
    fn subtree_has_dirty(&self, handle: usize) -> bool {
        let Some(node) = self.get(handle) else {
            return false;
        };
        if node.dirty {
            return true;
        }
        node.children.iter().any(|&c| self.subtree_has_dirty(c))
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
            n.layout = NodeLayout { x: 0.0, y: 0.0, width: 0.0, height: 0.0 };
            n.dirty = false;
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
        }
        for c in children {
            self.mark_subtree_dirty(c);
        }
    }

    /// 노드 하나를 solve — 자식을 먼저 재귀 solve 한 뒤 display 별로 배치.
    /// 반환: (content_width, content_height) — 부모 intrinsic 도출용.
    fn solve_node(&mut self, handle: usize, avail_w: f32, avail_h: f32) -> (f32, f32) {
        let Some(node) = self.get(handle) else {
            return (0.0, 0.0);
        };

        // 증분 skip: 서브트리가 전부 clean 이면 저장된 layout 을 재사용.
        // (저장된 layout.width/height 는 explicit 노드면 border-box, auto 노드면
        //  content 크기 — solve_flex/block/grid 는 explicit 이면 그 값을, auto 면
        //  자식 bounding box(content) 를 컨테이너 layout 에 저장하고 동일 값을
        //  반환한다. 부모 write_*_item 의 content 슬롯(content_main/cross, content_w/h)
        //  은 자식이 auto(명시 없음) 일 때만 fallback 소비하므로, explicit 자식의
        //  border-box 반환은 그 슬롯에 아예 안 읽혀 무해 — write_flex_item/
        //  write_block_item 이 명시값을 우선하고 content 는 AUTO 분기에서만 쓴다.)
        if !self.subtree_has_dirty(handle) {
            let l = node.layout;
            return (l.width, l.height);
        }

        let children = node.children.clone();
        let display = classify_container_display(node.style.display.as_deref());
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
        let (explicit_w, explicit_h) = self.resolve_self_size(handle, avail_w, avail_h);

        // leaf(=in-flow 자식 없음): 자기 크기만. absolute 자식만 있는 경우도 여기 해당 —
        //   컨테이너 크기는 absolute 자식에 영향받지 않으므로(out-of-flow) 그대로 확정한 뒤
        //   absolute 배치만 수행한다.
        if children.is_empty() {
            let w = explicit_w;
            let h = explicit_h;
            if let Some(n) = self.get_mut(handle) {
                n.layout = NodeLayout { x: 0.0, y: 0.0, width: w, height: h };
                n.dirty = false;
            }
            if !abs_children.is_empty() {
                self.place_absolute_children(handle, &abs_children, w, h, avail_w);
            }
            return (w, h);
        }

        // display 별 dispatch — 자식을 먼저 solve → flat f32 → 커널 → 위치 배치.
        let (cw, ch) = match display {
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

        // out-of-flow 자식 배치 — 컨테이너 크기 확정 후 (containing block 이 필요).
        if !abs_children.is_empty() {
            self.place_absolute_children(handle, &abs_children, cw, ch, avail_w);
        }
        (cw, ch)
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
    /// 해석 규칙 (CSS 근사):
    /// - `left` 지정 → x = pad_border_start + left. `right` 만 지정 → x = (cb_right - right - w).
    /// - 둘 다 auto → static 위치 근사로 pad_border_start (0 오프셋).
    /// - `margin_left/top` 은 최종 좌표에 **가산** (음수 허용 — `translate(-50%)` 에뮬레이션).
    /// - `width/height` auto → 자식 solve 결과(content) 사용.
    ///
    /// 미지원(의도적): `inset` % 는 containing block 기준으로 해석되며, margin auto 센터링,
    /// 조상 체인 탐색(가장 가까운 positioned ancestor), `fixed` 의 viewport 기준은 미구현.
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

        for &c in abs_children {
            // 자식 solve — available = containing block (%/auto 해석 기준).
            let (mut w, mut h) = self.solve_node(c, cb_w, cb_h);

            let cstyle = self.get(c).map(|n| n.style.clone()).unwrap_or_default();
            // inset % 는 containing block 기준 (CSS) — 축별 ctx.
            let ctx_x = self.ctx_for(cb_w);
            let ctx_y = self.ctx_for(cb_h);

            // 자식 명시 크기 우선 (solve 반환이 0 인 auto leaf 대비).
            let ew = resolve_dimension(cstyle.width.as_deref(), &ctx_x);
            let eh = resolve_dimension(cstyle.height.as_deref(), &ctx_y);
            if ew > 0.0 {
                w = ew;
            }
            if eh > 0.0 {
                h = eh;
            }

            let left = resolve_inset(cstyle.inset_left.as_deref(), &ctx_x);
            let right = resolve_inset(cstyle.inset_right.as_deref(), &ctx_x);
            let top = resolve_inset(cstyle.inset_top.as_deref(), &ctx_y);
            let bottom = resolve_inset(cstyle.inset_bottom.as_deref(), &ctx_y);

            // margin 은 음수 허용 (translate(-50%) 에뮬레이션 채널).
            let ml = resolve_signed(cstyle.margin_left.as_deref(), &ctx_x);
            let mt = resolve_signed(cstyle.margin_top.as_deref(), &ctx_y);

            // left 우선, 없으면 right 로 역산, 둘 다 없으면 static 근사(0).
            let x = match (left, right) {
                (Some(l), _) => pb_start_x + l,
                (None, Some(r)) => pb_start_x + (cb_w - r - w),
                (None, None) => pb_start_x,
            } + ml;
            let y = match (top, bottom) {
                (Some(t), _) => pb_start_y + t,
                (None, Some(b)) => pb_start_y + (cb_h - b - h),
                (None, None) => pb_start_y,
            } + mt;

            if let Some(n) = self.get_mut(c) {
                n.layout = NodeLayout { x, y, width: w, height: h };
                n.dirty = false;
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
        let cross_definite_self = if is_row {
            explicit_h > 0.0 || avail_h >= 0.0
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
                return (child_avail_w, child_avail_h);
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
                (child_avail_w, child_avail_h)
            } else if is_row {
                (child_avail_w, INDEFINITE_AVAIL) // row → cross = height
            } else {
                (INDEFINITE_AVAIL, child_avail_h) // column → cross = width
            }
        };
        let child_solves: Vec<(f32, f32)> = children.iter().map(|&c| child_cross_solve(c)).collect();
        let mut child_sizes: Vec<(f32, f32)> = Vec::with_capacity(children.len());
        for (i, &c) in children.iter().enumerate() {
            let (sw, sh) = child_solves[i];
            let cs = self.solve_node(c, sw, sh);
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
                &mut data, i, &cstyle, cw, ch, is_row, &ctx, &main_ctx, &cross_ctx,
            );
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
        let (avail_main, avail_cross) = if is_row {
            (child_avail_w, child_avail_h)
        } else {
            let main_h = if explicit_h > 0.0 { child_avail_h } else { -1.0 };
            (main_h, child_avail_w)
        };

        let cross_definite = if is_row { explicit_h > 0.0 } else { explicit_w > 0.0 };
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
                let laid_out_main = resolve_dimension_opt(main_raw, &main_ctx)
                    .unwrap_or(if is_row { child_avail_w } else { child_avail_h });
                if (used_main - laid_out_main).abs() <= RESOLVE_EPS {
                    continue; // 분배로 안 바뀜 — 재배치 불필요
                }

                // used main 으로 재-solve → 새 content 크기.
                //   1차 solve 가 subtree 를 clean 으로 만들었으므로(`solve_*` 말미의
                //   `dirty=false`), 그대로 부르면 증분 skip 이 **stale 캐시**를 돌려준다.
                //   재-solve 전에 subtree 를 dirty 로 되돌린다.
                //
                //   explicit main 자식은 `solve_node` 가 자기 스타일의 명시값을 우선하므로
                //   available 만 바꿔선 안 된다 — 명시 main 을 **used 값으로 덮어써** 재-solve
                //   한 뒤 원복한다(스타일 원본 보존).
                let overridden = resolve_dimension_opt(main_raw, &main_ctx).is_some();
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

        // 4) 자식 위치 반영 + bounding box 로 컨테이너 content 크기 도출.
        //    bounding box 는 offset 전 좌표 기준(컨테이너 content 크기), 저장은 offset 후
        //    (자식 화면 좌표는 padding 안쪽) — 섞으면 컨테이너 크기에 padding 이중 반영.
        let mut max_right: f32 = 0.0;
        let mut max_bottom: f32 = 0.0;
        for (i, &c) in children.iter().enumerate() {
            let off = i * 4;
            let (x, y, w, h) = (out[off], out[off + 1], out[off + 2], out[off + 3]);
            max_right = max_right.max(x + w);
            max_bottom = max_bottom.max(y + h);
            if let Some(n) = self.get_mut(c) {
                n.layout = NodeLayout { x: x + off_x, y: y + off_y, width: w, height: h };
            }
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
            let cs = self.solve_node(c, child_avail_w, child_containing_h);
            child_sizes.push(cs);
        }

        // 2) 자식 → block flat f32 (19필드, 물리축).
        let mut data = vec![0.0f32; children.len() * block::FIELD_COUNT];
        for (i, &c) in children.iter().enumerate() {
            let cstyle = self.get(c).map(|n| n.style.clone()).unwrap_or_default();
            let (cw, ch) = child_sizes[i];
            write_block_item(&mut data, i, &cstyle, cw, ch, &ctx, &height_ctx);
        }

        // 3) block_layout — BFC 격리 가정(부모-자식 collapse 미전파, 단위 3-a scope).
        let out = block::block_layout(&data, child_avail_w, child_avail_h, false, false, 0.0);

        // 4) 자식 위치 반영 + bounding box 로 컨테이너 content 크기 도출.
        //    (out 마지막 2값은 firstChildMarginTop/lastChildMarginBottom metadata — 단위 3-a 미소비.)
        //    bounding box 는 offset 전 좌표 기준(컨테이너 content 크기), 저장은 offset 후
        //    (자식 화면 좌표는 padding 안쪽) — 섞으면 컨테이너 크기에 padding 이중 반영.
        let mut max_right: f32 = 0.0;
        let mut max_bottom: f32 = 0.0;
        for (i, &c) in children.iter().enumerate() {
            let off = i * 4;
            let (x, y, w, h) = (out[off], out[off + 1], out[off + 2], out[off + 3]);
            max_right = max_right.max(x + w);
            max_bottom = max_bottom.max(y + h);
            if let Some(n) = self.get_mut(c) {
                n.layout = NodeLayout { x: x + off_x, y: y + off_y, width: w, height: h };
            }
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
        let container_w = if explicit_w > 0.0 {
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
        let template_cols = join_tracks(style.grid_template_columns.as_deref());
        let mut template_rows = join_tracks(style.grid_template_rows.as_deref());

        // (2)+(3) 자식 placement 직렬화 (area_name|grid_column|grid_row 개행 구분).
        let placement_spec = self.build_grid_placement_spec(children);

        // auto row intrinsic 측정. 두 케이스를 통합 처리한다:
        //  (A) implicit auto row (gridTemplateRows 미명시) + 전부 auto-placement:
        //      row-major 로 자식 → row 매핑, 각 row = 그 자식들 max intrinsic content height.
        //  (B) **명시** auto row (`gridTemplateRows:["auto",...]`) — placement 유무 무관:
        //      자식의 gridRowStart(1-based line)로 row 결정, auto 토큰 row 만 max intrinsic
        //      으로 치환(px/fr/% row 는 보존).
        // grid.rs 는 auto 를 1fr 로 근사(available 분배)하므로, 측정 없이는 height:auto
        // 컨테이너에서 auto row 가 availH 를 나눠 가져 폭발(availH>0) 또는 0 붕괴(availH<0).
        // ProgressBar/Meter 실구조(1fr auto / auto auto + placement)가 (B) 케이스.
        let row_tokens: Vec<&str> = template_rows.split_whitespace().collect();
        let has_auto_row = row_tokens.iter().any(|t| *t == "auto");
        // (A) implicit auto row: `gridTemplateRows` 미명시. placement 유무 **무관**:
        //   - placement 없음 → row-major (자식 i → row = i / col_count).
        //   - placement 있음 (Slider: gridRowStart 로 label=row1, track=row2 명시) →
        //     자식 gridRowStart 로 row 결정. 행 수는 명시된 max row 까지 확장.
        //   각 행 = 그 행 자식들 max intrinsic content height 를 px 트랙으로 주입.
        //   (기존엔 `placement_spec.is_empty()` 도 요구해 Slider 처럼 rows 미명시 +
        //    placement 명시인 케이스가 미측정 → template_rows 빈 문자열 그대로 grid.rs
        //    전달 → row_tracks 0개 → cell_bounds height=100 fallback + row 겹침. 2026-07-06)
        let implicit_rows = template_rows.is_empty() && !children.is_empty();

        if implicit_rows {
            let col_count = grid::parse_tracks(&template_cols, container_w, col_gap).len().max(1);
            let mut row_heights: Vec<f32> = Vec::new();
            for (i, &c) in children.iter().enumerate() {
                // gridRowStart 1-based line → row index (미명시면 row-major i/col_count).
                // solve_node(&mut) 전에 필드만 읽어 NodeStyle 전체 clone 회피.
                let row = grid_line_to_track_index(
                    self.get(c).and_then(|n| n.style.grid_row_start.as_deref()),
                    i / col_count,
                );
                let (_, ch) = self.solve_node(c, container_w, container_h);
                if row >= row_heights.len() {
                    row_heights.resize(row + 1, 0.0);
                }
                row_heights[row] = row_heights[row].max(ch);
            }
            template_rows = row_heights
                .iter()
                .map(|h| format!("{h}px"))
                .collect::<Vec<_>>()
                .join(" ");
        } else if has_auto_row && !children.is_empty() {
            // (B) 명시 track 안의 auto row: 자식 gridRowStart 로 row 결정 후 auto row 만 측정.
            // gridRowStart 미명시 자식은 row-major fallback(col_count 기준).
            let col_count = grid::parse_tracks(&template_cols, container_w, col_gap).len().max(1);
            let mut row_intrinsic: Vec<f32> = vec![0.0; row_tokens.len()];
            for (i, &c) in children.iter().enumerate() {
                // gridRowStart 1-based line → row index (미명시면 row-major i/col_count).
                let row = grid_line_to_track_index(
                    self.get(c).and_then(|n| n.style.grid_row_start.as_deref()),
                    i / col_count,
                );
                let (_, ch) = self.solve_node(c, container_w, container_h);
                if row < row_intrinsic.len() {
                    row_intrinsic[row] = row_intrinsic[row].max(ch);
                }
            }
            // auto 토큰만 측정값으로 치환, px/fr/% 는 원본 유지.
            template_rows = row_tokens
                .iter()
                .enumerate()
                .map(|(r, tok)| {
                    if *tok == "auto" {
                        format!("{}px", row_intrinsic.get(r).copied().unwrap_or(0.0))
                    } else {
                        (*tok).to_string()
                    }
                })
                .collect::<Vec<_>>()
                .join(" ");
        }

        // auto **column** intrinsic 측정 (row 와 대칭). `gridTemplateColumns:"1fr auto"`
        // 에서 auto col 은 CSS 상 그 col 자식들의 max content width. grid.rs 는 auto 를 1fr
        // 로 근사(available 분배)하므로, 측정 없이는 auto col 이 1fr 과 available 을 나눠 가져
        // content 보다 크게(ProgressBar value: CSS 29 vs 근사 168) → col 폭 발산 + 배치 밀림.
        // 자식 gridColumnStart(1-based line)로 col 결정, auto 토큰 col 만 max intrinsic width
        // 로 치환(1fr/px/% col 보존). placement 없는 자식은 col-major fallback.
        let has_auto_col = template_cols.split_whitespace().any(|t| t == "auto");
        let template_cols = if has_auto_col && !children.is_empty() {
            let col_tokens: Vec<String> =
                template_cols.split_whitespace().map(String::from).collect();
            // row-major auto-placement: gridColumnStart 미명시 자식 i 의 col = i % col_count.
            let col_count = col_tokens.len().max(1);
            let mut col_intrinsic: Vec<f32> = vec![0.0; col_tokens.len()];
            for (i, &c) in children.iter().enumerate() {
                // gridColumnStart 1-based line → col index (미명시면 col-major i%col_count).
                let col = grid_line_to_track_index(
                    self.get(c).and_then(|n| n.style.grid_column_start.as_deref()),
                    i % col_count,
                );
                let (cw, _) = self.solve_node(c, container_w, container_h);
                if col < col_intrinsic.len() {
                    col_intrinsic[col] = col_intrinsic[col].max(cw);
                }
            }
            col_tokens
                .iter()
                .enumerate()
                .map(|(cidx, tok)| {
                    if tok == "auto" {
                        format!("{}px", col_intrinsic.get(cidx).copied().unwrap_or(0.0))
                    } else {
                        tok.clone()
                    }
                })
                .collect::<Vec<_>>()
                .join(" ")
        } else {
            template_cols
        };

        // grid_layout — 셀 bounds flat [x,y,w,h,...].
        // justify-content/align-content (E12) — 고정 트랙이 컨테이너보다 작을 때 트랙셋 정렬.
        let justify_content = style.justify_content.as_deref().unwrap_or("");
        let align_content = style.align_content.as_deref().unwrap_or("");
        // grid-auto-flow/columns/rows (E14). auto_columns/rows 는 track array → space-join.
        let auto_flow = style.grid_auto_flow.as_deref().unwrap_or("");
        let auto_columns = join_tracks(style.grid_auto_columns.as_deref());
        let auto_rows = join_tracks(style.grid_auto_rows.as_deref());
        let bounds = grid::grid_layout(
            &template_cols,
            &template_rows,
            "", // template_areas 미사용 (NodeStyle 에 없음 — Skia 경로는 숫자 line)
            &placement_spec,
            children.len() as u32,
            container_w,
            container_h,
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
        let mut max_right: f32 = 0.0;
        let mut max_bottom: f32 = 0.0;
        for (i, &c) in children.iter().enumerate() {
            let off = i * 4;
            let (x, y, w, h) = (bounds[off], bounds[off + 1], bounds[off + 2], bounds[off + 3]);
            // 자식을 셀 크기로 재귀 solve (셀 안 flex/block 컨테이너 배치용).
            // 자식 자기 크기는 셀 크기로 override — grid item 은 셀을 채운다(stretch 기본).
            self.solve_node(c, w, h);
            max_right = max_right.max(x + w);
            max_bottom = max_bottom.max(y + h);
            if let Some(n) = self.get_mut(c) {
                n.layout = NodeLayout { x: x + off_x, y: y + off_y, width: w, height: h };
            }
        }

        // 컨테이너 크기: 명시 있으면 명시, 없으면 셀 bounding box.
        let final_w = if explicit_w > 0.0 { explicit_w } else { max_right };
        let final_h = if explicit_h > 0.0 { explicit_h } else { max_bottom };
        if let Some(n) = self.get_mut(handle) {
            n.layout = NodeLayout { x: 0.0, y: 0.0, width: final_w, height: final_h };
            n.dirty = false;
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
/// 단위 2 는 Flex, 단위 3-a 는 Block, 단위 3-b 는 Grid 실배치. `_hasChildren`
/// 컨테이너의 CSS 기본 display 는 block 이므로(display 미설정 → block),
/// non-flex/non-grid 는 Block 으로 취급한다.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
enum ContainerDisplay {
    Flex,
    Block,
    Grid,
}

/// display 문자열 → 컨테이너 분류.
///
/// - flex/inline-flex → Flex (단위 2)
/// - grid/inline-grid → Grid (단위 3-b)
/// - block/inline-block/flow-root/list-item/미설정/기타 → Block (단위 3-a)
///
/// display 미설정(None)이 Block 인 이유: CSS 초기 display 는 inline 이지만
/// composition 의 `_hasChildren` 컨테이너는 상단(taffyDisplayAdapter)에서 blockify
/// 되어 내려온다 — tree.rs 는 순수화된 스타일을 받으므로 컨테이너=block 이 기본.
fn classify_container_display(display: Option<&str>) -> ContainerDisplay {
    match display.map(|d| d.trim().to_ascii_lowercase()).as_deref() {
        Some("flex") | Some("inline-flex") => ContainerDisplay::Flex,
        Some("grid") | Some("inline-grid") => ContainerDisplay::Grid,
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

/// grid `*Start` line 문자열 → 0-based track index. auto row/column 측정에서
/// 자식이 어느 트랙에 속하는지 결정하는 단일 정의(row·column 대칭).
///
/// - `grid_row_start:"2"` (1-based CSS line) → index 1. `(line - 1).max(0)` 로
///   음수 line 은 0 으로 clamp(`usize` 캐스트 전 방어 — 미클램프 시 resize OOM).
/// - 미명시("auto"/빈 문자열) → `major_fallback` (row-major `i / col_count`
///   또는 col-major `i % col_count`).
///
/// **주의(측정 한정)**: `*End`/span 은 미고려 — 측정 pass 는 자식을 시작 트랙에만
/// 귀속시킨다. span 을 가진 자식(`gridRowEnd:"3"`)의 실 배치는 grid.rs
/// `place_children` 가 담당. 측정↔배치 이 부분 정합은 grid.rs 쪽 계약.
fn grid_line_to_track_index(start: Option<&str>, major_fallback: usize) -> usize {
    normalize_grid_line_part(start)
        .and_then(|s| s.parse::<i32>().ok())
        .map(|line| (line - 1).max(0) as usize)
        .unwrap_or(major_fallback)
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

/// specified size(border-box, 전역 `* { box-sizing: border-box }` 계약) →
/// 커널 content 입력. pad_border 감산, 0 하한 (pad_border 초과 시 content 0 =
/// border-box 가 pad_border 로 floor — CSS 동일).
#[inline]
fn spec_to_content(v: f32, pad_border: f32) -> f32 {
    (v - pad_border).max(0.0)
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
///
/// specified size(width/height, min/max 동일) = border-box — intake 에서
/// `spec_to_content` 로 pad_border 감산 후 flex.rs 에 content 값으로 전달한다.
///
/// `ctx` 는 cross 축(=자식 % 의 inline containing block) 기준, `main_ctx` 는 main 축
/// 기준이다. `flex-basis` 의 `%` 는 **main 축** 컨테이너 크기를 기준으로 해소해야 하므로
/// (column 이면 height) 별도 ctx 를 받는다.
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
    data[off + 3] = resolve_dimension(cstyle.margin_top.as_deref(), ctx);
    data[off + 4] = resolve_dimension(cstyle.margin_right.as_deref(), ctx);
    data[off + 5] = resolve_dimension(cstyle.margin_bottom.as_deref(), ctx);
    data[off + 6] = resolve_dimension(cstyle.margin_left.as_deref(), ctx);
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
///
/// specified size(width/height, min/max 동일) = border-box — intake 에서
/// `spec_to_content` 로 pad_border 감산 후 block.rs 에 content 값으로 전달한다.
fn write_block_item(
    data: &mut [f32],
    i: usize,
    cstyle: &NodeStyle,
    cw: f32,
    ch: f32,
    ctx: &CssValueContext,
    height_ctx: &CssValueContext,
) {
    let off = i * block::FIELD_COUNT;

    // display: 자식 display=inline-block 이면 1, 그 외 컨테이너 자식은 block(0).
    // (grid/flex 자식도 이 컨테이너 안에선 block-level box 로 취급 — CSS 표준.)
    let display_code: f32 = match cstyle.display.as_deref().map(|d| d.trim().to_ascii_lowercase()).as_deref() {
        Some("inline-block") => 1.0,
        _ => 0.0,
    };

    // 명시 width/height (음수=미지정 → AUTO -1). fit-content 는 FIT_CONTENT(-2)
    // 센티넬 보존 — block.rs 가 shrink-to-fit(content 폭)으로 해소한다(필드표 §1/2).
    // resolve_dimension_opt 로 붕괴시키면 auto stretch 로 오처리 → block-level
    // Calendar(width:fit-content) 가 부모 폭 전체를 차지 (tree_golden N8).
    //
    // **height 의 `%` 는 `height_ctx`** (E6/ADR-156 P2) — 컨테이너 height 가 명시 definite
    // 일 때만 실축, auto 면 indefinite→auto (CSS §10.5). `ctx`(폭) 로 풀면 height:50% 가
    // 폭의 50% 로 잘못 해소된다(BP-1/2). width 는 그대로 ctx(폭).
    let expl_w = resolve_cross_dimension_opt(cstyle.width.as_deref(), ctx);
    let expl_h = resolve_cross_dimension_opt(cstyle.height.as_deref(), height_ctx);

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
    data[off + 3] = resolve_dimension(cstyle.margin_top.as_deref(), ctx);
    data[off + 4] = resolve_dimension(cstyle.margin_right.as_deref(), ctx);
    data[off + 5] = resolve_dimension(cstyle.margin_bottom.as_deref(), ctx);
    data[off + 6] = resolve_dimension(cstyle.margin_left.as_deref(), ctx);
    data[off + 7] = 0.0; // bfc_flag — 단위 3-a 미판정(BFC 감지는 상단/후속 단위)
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

/// `position` 이 out-of-flow(absolute/fixed)인가.
///
/// CSS: absolute/fixed 자식은 정상 흐름에서 빠져 컨테이너 크기·형제 배치·gap 에
/// 기여하지 않는다. static/relative/sticky 는 in-flow.
#[inline]
fn is_out_of_flow(position: Option<&str>) -> bool {
    matches!(position, Some("absolute") | Some("fixed"))
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

/// `resolve_dimension_opt` + fit-content 보존 변형. flex cross 축 + block 자식
/// width/height intake 에서 사용 (2026-07-13 block 확장 — tree_golden N8).
///
/// 일반 `resolve_dimension_opt` 은 fit-content(음수 센티넬)를 None(→AUTO)로 붕괴시켜
/// flex cross 축에서 stretch 로 오처리한다(Calendar width:fit-content 가 부모 폭 전체로
/// stretch). 본 변형은 fit-content 만 `FIT_CONTENT`(=flex::CONTENT -2) 센티넬로 통과시켜
/// flex.rs `parse_item` 이 content_cross(shrink-to-fit)로 해소하게 한다. 그 외 intrinsic
/// 키워드(min/max-content)는 아직 미지원 → None(AUTO) 유지.
fn resolve_cross_dimension_opt(value: Option<&str>, ctx: &CssValueContext) -> Option<f32> {
    let v = value?;
    let trimmed = v.trim();
    if trimmed.is_empty() || trimmed.eq_ignore_ascii_case("auto") {
        return None;
    }
    match resolve_css_size_value(trimmed, ctx) {
        Some(n) if n >= 0.0 => Some(n),
        // fit-content: flex cross 축은 content 로 shrink-to-fit (stretch 아님).
        Some(n) if n == FIT_CONTENT => Some(flex::CONTENT),
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
        // row0 높이 = max(30,50) = 50 → c0,c1 셀 높이 50.
        assert_eq!(tree.get_layout(handles[0]).height, 50.0, "row0 max height");
        assert_eq!(tree.get_layout(handles[1]).height, 50.0, "row0 max height");
        // c2 는 row1 (y=50), 높이 40.
        let c2 = tree.get_layout(handles[2]);
        assert_eq!(c2.y, 50.0, "c2 row1 y = row0 height 50");
        assert_eq!(c2.height, 40.0, "row1 height = 40");
        // 컨테이너 intrinsic = 50 + 40 = 90.
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
        // col0 = 100px 고정(자식 60 무관), col1 auto = 자식 40.
        assert_eq!(tree.get_layout(handles[0]).width, 100.0, "px col 100 고정(자식 60 무관)");
        assert_eq!(tree.get_layout(handles[1]).width, 40.0, "auto col = 자식 intrinsic 40");
        // col1 x = 100(col0) + 0(gap 없음) = 100.
        assert_eq!(tree.get_layout(handles[1]).x, 100.0, "col1 x = col0 width 100");
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
        assert_eq!(tree.get_layout(handles[0]).width, 290.0, "label 1fr = 290");
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
        assert_eq!(tree.get_layout(handles[1]).x, 40.0, "c1 col1 x = col0 width 40");
    }

    /// 명시 auto row 혼합: px row 는 고정 유지, auto row 만 intrinsic 측정.
    #[test]
    fn grid_mixed_px_and_auto_rows_preserve_px() {
        let mut tree = LayoutTree::new();
        // rows "40px auto". row0 자식 h=20(px row 40 고정), row1 자식 h=25(auto 측정).
        let json = r#"[
            {"style":{"height":"20px","gridColumnStart":"1","gridColumnEnd":"2","gridRowStart":"1","gridRowEnd":"2"},"children":[]},
            {"style":{"height":"25px","gridColumnStart":"1","gridColumnEnd":"2","gridRowStart":"2","gridRowEnd":"3"},"children":[]},
            {"style":{"display":"grid","width":"200px","gridTemplateColumns":["1fr"],"gridTemplateRows":["40px","auto"]},"children":[0,1]}
        ]"#;
        let handles = tree.build_tree_batch(json).unwrap();
        tree.compute_layout(handles[2], 200.0, -1.0);
        assert_eq!(tree.get_layout(handles[0]).height, 40.0, "px row 40 고정(자식 20 무관)");
        assert_eq!(tree.get_layout(handles[1]).height, 25.0, "auto row = 자식 intrinsic 25");
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
}

