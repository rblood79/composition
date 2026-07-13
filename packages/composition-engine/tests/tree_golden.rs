//! ADR-916 endgame kill criteria ② — tree_golden 독립 oracle (native)
//!
//! Chrome 실측(브라우저 ground truth)을 상수로 고정해 tree.rs::compute_layout
//! 트리 배치의 회귀를 Taffy 없이 잡는다. golden.rs(단일 컨테이너 평면 계약)와
//! 달리 LayoutTree/compute_layout/get_layouts_batch 트리 계약을 대조한다.
//!
//! fixture 원본: dualRunLive.test.ts C-2b N1~N5 (실전 대표 중첩/혼합 8형상 중
//! 트리 5종). 좌표는 root-상대 정규화(Chrome=viewport 기준, Rust=tree 기준).
//! box model: NodeLayout=content-box, N1~N5 fixture 는 border/padding 미사용 →
//! 추출 HTML 리셋(margin/padding/border 0 + box-sizing:border-box)으로 일치.
//!
//! N6 는 Chrome 실측이 아니라 **box-sizing:border-box 계약을 CSS 산술로 손계산**
//! 고정한 padding≠0 케이스(ADR-916 box-sizing 계약 정합 Task 4) — tree.rs 의
//! 컨테이너 padding 자식 available 감산/좌표 offset(§2.6 offset 계약)이 padding
//! 이 있는 flex row 에서도 CSS 와 일치하는지 회귀 감시한다.

use composition_engine::tree::LayoutTree;

/// HC3 (a) 수치 tolerance (px) — golden.rs TOL 과 동일.
const TOL: f32 = 1.0;

/// batch JSON 의 `children` 인덱스 배열을 파싱해 `parent[i]` 맵을 만든다.
/// post-order(자식이 부모보다 앞) 배열이므로 부모 인덱스는 항상 자식보다 크다.
/// root(부모 없음)는 `usize::MAX` 로 표시.
fn parse_parents(batch_json: &str) -> Vec<usize> {
    let v: serde_json::Value = serde_json::from_str(batch_json).expect("batch json");
    let arr = v.as_array().expect("batch array");
    let mut parent = vec![usize::MAX; arr.len()];
    for (i, node) in arr.iter().enumerate() {
        if let Some(children) = node.get("children").and_then(|c| c.as_array()) {
            for c in children {
                let ci = c.as_u64().expect("child index") as usize;
                parent[ci] = i;
            }
        }
    }
    parent
}

/// batch JSON → 트리 빌드 → compute → **절대 좌표** flat 반환.
///
/// tree.rs 계약(compute_layout §417)은 자식 좌표를 **부모 content-box 상대**로
/// 산출한다(taffy_bridge.rs 동일). Chrome `getBoundingClientRect` 는 viewport
/// 절대 좌표이므로, 대조하려면 조상 체인 offset 을 누적해 절대 좌표로 변환한 뒤
/// root origin 을 빼야 한다. (root-상대 절대 좌표 = 조상 누적 - root offset.)
///
/// handles 순서 = batch 배열 순서(post-order). root 는 handles 마지막.
fn layout_relative(batch_json: &str) -> Vec<f32> {
    let mut tree = LayoutTree::new();
    let handles = tree.build_tree_batch(batch_json).expect("batch build");
    let root = *handles.last().expect("root handle");
    tree.compute_layout(root, 200.0, -1.0);
    let flat = tree.get_layouts_batch(&handles);
    let parent = parse_parents(batch_json);
    let n = handles.len();

    // 각 노드의 절대 좌표 = 자신 relative + 모든 조상 relative 합.
    // post-order 라 인덱스 감소 방향으로 조상 offset 을 누적할 수 있다.
    let mut abs_x = vec![0.0f32; n];
    let mut abs_y = vec![0.0f32; n];
    for i in 0..n {
        let (mut ax, mut ay) = (flat[i * 4], flat[i * 4 + 1]);
        let mut p = parent[i];
        while p != usize::MAX {
            ax += flat[p * 4];
            ay += flat[p * 4 + 1];
            p = parent[p];
        }
        abs_x[i] = ax;
        abs_y[i] = ay;
    }

    // root-상대 정규화 — Chrome 상수도 root origin 을 뺀 root-상대.
    let (rx, ry) = (abs_x[n - 1], abs_y[n - 1]);
    let mut out = Vec::with_capacity(n * 4);
    for i in 0..n {
        out.push(abs_x[i] - rx); // x (절대 - root)
        out.push(abs_y[i] - ry); // y
        out.push(flat[i * 4 + 2]); // w (크기는 offset 무관)
        out.push(flat[i * 4 + 3]); // h
    }
    out
}

/// root-상대 flat 을 4-tuple 단위로 EXPECTED 상수와 대조. |diff| ≤ TOL.
fn assert_tree_bounds(label: &str, actual: &[f32], expected: &[[f32; 4]]) {
    assert_eq!(
        actual.len(),
        expected.len() * 4,
        "{label}: 출력 길이 불일치 (got {} floats, want {} bounds)",
        actual.len(),
        expected.len()
    );
    for (i, want) in expected.iter().enumerate() {
        for (f, &w) in want.iter().enumerate() {
            let g = actual[i * 4 + f];
            let field = ["x", "y", "w", "h"][f];
            assert!(
                (g - w).abs() <= TOL,
                "{label}: node[{i}].{field} = {g} (want {w}, Δ={:.4} > {TOL}px)",
                g - w
            );
        }
    }
}

// ─────────────────────────────────────────────────────────────────────────────
// N1 flex-in-flex — column root(auto) → [row 컨테이너(2 leaf), leaf]
// ─────────────────────────────────────────────────────────────────────────────

/// N1 flex-in-flex. 순서: [0] n1-a, [1] n1-b, [2] n1-row, [3] n1-c, [4] n1-root.
/// Chrome 실측(2026-07-06, root-상대). column root auto = 20+30.
const N1_EXPECTED: &[[f32; 4]] = &[
    [0., 0., 30., 20.],  // [0] n1-a
    [30., 0., 40., 20.], // [1] n1-b   (a 30px 뒤)
    [0., 0., 200., 20.], // [2] n1-row
    [0., 20., 50., 30.], // [3] n1-c   (row h20 아래)
    [0., 0., 200., 50.], // [4] n1-root (auto = 20+30)
];
const N1_BATCH: &str = r#"[
  {"style":{"width":"30px","height":"20px"},"children":[]},
  {"style":{"width":"40px","height":"20px"},"children":[]},
  {"style":{"display":"flex","flexDirection":"row","alignItems":"flex-start","width":"200px","height":"20px"},"children":[0,1]},
  {"style":{"width":"50px","height":"30px"},"children":[]},
  {"style":{"display":"flex","flexDirection":"column","width":"200px","height":"auto"},"children":[2,3]}
]"#;

#[test]
fn tree_golden_n1_flex_in_flex() {
    let rel = layout_relative(N1_BATCH);
    assert_tree_bounds("N1 flex-in-flex", &rel, N1_EXPECTED);
}

// ─────────────────────────────────────────────────────────────────────────────
// N2 flex-in-grid — grid(2열, auto row) → 각 셀에 flex column
// ─────────────────────────────────────────────────────────────────────────────

/// N2 flex-in-grid. 순서: [0] n2-a1, [1] n2-a2, [2] n2-cell-a, [3] n2-b1,
/// [4] n2-cell-b, [5] n2-root. Chrome 실측(2026-07-06, root-상대).
/// grid 2열 1fr=100px, auto row = max(cell-a 40, cell-b 30) = 40 (cell-b stretch).
const N2_EXPECTED: &[[f32; 4]] = &[
    [0., 0., 40., 15.],    // [0] n2-a1
    [0., 15., 40., 25.],   // [1] n2-a2   (a1 15px 아래)
    [0., 0., 100., 40.],   // [2] n2-cell-a (1열, h=15+25)
    [100., 0., 40., 30.],  // [3] n2-b1   (2열 x=100)
    [100., 0., 100., 40.], // [4] n2-cell-b (2열, row 높이 40 stretch)
    [0., 0., 200., 40.],   // [5] n2-root (auto row = 40)
];
const N2_BATCH: &str = r#"[
  {"style":{"width":"40px","height":"15px"},"children":[]},
  {"style":{"width":"40px","height":"25px"},"children":[]},
  {"style":{"display":"flex","flexDirection":"column","height":"auto"},"children":[0,1]},
  {"style":{"width":"40px","height":"30px"},"children":[]},
  {"style":{"display":"flex","flexDirection":"column","height":"auto"},"children":[3]},
  {"style":{"display":"grid","gridTemplateColumns":["1fr","1fr"],"width":"200px","height":"auto"},"children":[2,4]}
]"#;

#[test]
fn tree_golden_n2_flex_in_grid() {
    let rel = layout_relative(N2_BATCH);
    assert_tree_bounds("N2 flex-in-grid", &rel, N2_EXPECTED);
}


// ─────────────────────────────────────────────────────────────────────────────
// N3 grid-in-flex — flex column(auto) → [grid(2열, 고정 40px row), leaf]
// ─────────────────────────────────────────────────────────────────────────────

/// N3 grid-in-flex. 순서: [0] n3-g1, [1] n3-g2, [2] n3-grid, [3] n3-foot,
/// [4] n3-root. Chrome 실측(2026-07-06, root-상대).
/// grid 2열 1fr=100px, 고정 40px row. flex column auto = 40+20.
const N3_EXPECTED: &[[f32; 4]] = &[
    [0., 0., 100., 40.],   // [0] n3-g1   (1열)
    [100., 0., 100., 40.], // [1] n3-g2   (2열)
    [0., 0., 200., 40.],   // [2] n3-grid (고정 40px row)
    [0., 40., 60., 20.],   // [3] n3-foot (grid h40 아래)
    [0., 0., 200., 60.],   // [4] n3-root (auto = 40+20)
];
const N3_BATCH: &str = r#"[
  {"style":{"height":"40px"},"children":[]},
  {"style":{"height":"40px"},"children":[]},
  {"style":{"display":"grid","gridTemplateColumns":["1fr","1fr"],"gridTemplateRows":["40px"],"width":"200px","height":"40px"},"children":[0,1]},
  {"style":{"width":"60px","height":"20px"},"children":[]},
  {"style":{"display":"flex","flexDirection":"column","width":"200px","height":"auto"},"children":[2,3]}
]"#;

#[test]
fn tree_golden_n3_grid_in_flex() {
    let rel = layout_relative(N3_BATCH);
    assert_tree_bounds("N3 grid-in-flex", &rel, N3_EXPECTED);
}

// ─────────────────────────────────────────────────────────────────────────────
// N4 gap flex column — rowGap 8 → 자식 사이 간격 정합
// ─────────────────────────────────────────────────────────────────────────────

/// N4 gap flex column. 순서: [0] n4-a, [1] n4-b, [2] n4-c, [3] n4-root.
/// Chrome 실측(2026-07-06, root-상대). rowGap 8 누적. auto = 30+8+40+8+20.
const N4_EXPECTED: &[[f32; 4]] = &[
    [0., 0., 100., 30.],  // [0] n4-a
    [0., 38., 100., 40.], // [1] n4-b   (30 + gap 8)
    [0., 86., 100., 20.], // [2] n4-c   (38 + 40 + gap 8)
    [0., 0., 200., 106.], // [3] n4-root (30+8+40+8+20)
];
const N4_BATCH: &str = r#"[
  {"style":{"width":"100px","height":"30px"},"children":[]},
  {"style":{"width":"100px","height":"40px"},"children":[]},
  {"style":{"width":"100px","height":"20px"},"children":[]},
  {"style":{"display":"flex","flexDirection":"column","rowGap":"8px","width":"200px","height":"auto"},"children":[0,1,2]}
]"#;

#[test]
fn tree_golden_n4_gap_flex_column() {
    let rel = layout_relative(N4_BATCH);
    assert_tree_bounds("N4 gap flex column", &rel, N4_EXPECTED);
}

// ─────────────────────────────────────────────────────────────────────────────
// N5 dimension 혼재 flex row — 고정 자식 + auto(내용폭) 자식 + columnGap 10
// ─────────────────────────────────────────────────────────────────────────────

/// N5 dimension 혼재 flex row. 순서: [0] n5-fixed, [1] n5-auto, [2] n5-root.
/// Chrome 실측(2026-07-06, root-상대). columnGap 10. auto 자식은 자연폭 유지.
const N5_EXPECTED: &[[f32; 4]] = &[
    [0., 0., 50., 20.],  // [0] n5-fixed
    [60., 0., 70., 20.], // [1] n5-auto (50 + gap 10)
    [0., 0., 200., 20.], // [2] n5-root
];
const N5_BATCH: &str = r#"[
  {"style":{"width":"50px","height":"20px"},"children":[]},
  {"style":{"width":"70px","height":"20px"},"children":[]},
  {"style":{"display":"flex","flexDirection":"row","columnGap":"10px","alignItems":"flex-start","width":"200px","height":"20px"},"children":[0,1]}
]"#;

#[test]
fn tree_golden_n5_mixed_dimension() {
    let rel = layout_relative(N5_BATCH);
    assert_tree_bounds("N5 dimension 혼재 flex row", &rel, N5_EXPECTED);
}

// ─────────────────────────────────────────────────────────────────────────────
// N6 padded flex row — box-sizing:border-box 계약 (padding≠0) golden
// ─────────────────────────────────────────────────────────────────────────────

/// N6 padded flex row (box-sizing 계약 고정 — Chrome 실측 아님, CSS 산술 손계산).
/// 순서: [0] n6-a, [1] n6-b, [2] n6-root.
///
/// 컨테이너 border-box 300×100, padding 10 사방 → content 280×80, 원점 offset
/// (10,10). 자식 A(width:100px border-box, 자체 padding 8 좌우) 는 border-box
/// 계약상 outer width 가 100 그대로(자체 padding 은 A 의 content 만 줄임 — 부모
/// offset/자식 배치엔 영향 없음). 자식 B(width:50px) 는 gap 0 이므로 A 뒤에
/// 바로 이어붙는다: x = off_x(10) + A.width(100) = 110.
/// 컨테이너 height 는 explicit 100 이 우선(content 20 이지만 override).
/// (CSS 산술: A=(10,10,100,20), B=(110,10,50,20), root=(0,0,300,100).)
const N6_EXPECTED: &[[f32; 4]] = &[
    [10., 10., 100., 20.], // [0] n6-a   (border-box, 자체 padding 8 은 outer 무영향)
    [110., 10., 50., 20.], // [1] n6-b   (10 + a.width 100, gap 0)
    [0., 0., 300., 100.],  // [2] n6-root (explicit height 100 유지)
];
const N6_BATCH: &str = r#"[
  {"style":{"width":"100px","height":"20px","paddingLeft":"8px","paddingRight":"8px"},"children":[]},
  {"style":{"width":"50px","height":"20px"},"children":[]},
  {"style":{"display":"flex","flexDirection":"row","alignItems":"flex-start","width":"300px","height":"100px","paddingTop":"10px","paddingRight":"10px","paddingBottom":"10px","paddingLeft":"10px"},"children":[0,1]}
]"#;

#[test]
fn tree_golden_n6_padded_flex_row_border_box() {
    let rel = layout_relative(N6_BATCH);
    assert_tree_bounds("N6 padded flex row (border-box)", &rel, N6_EXPECTED);
}

// ─────────────────────────────────────────────────────────────────────────────
// N7 auto-height column + flexGrow 자식 — indefinite main 은 grow 미발동 (CSS §9.7)
// ─────────────────────────────────────────────────────────────────────────────

/// N7 Tabs 실전 형상 (Chrome 실측 아님 — CSS §9.7 산술 손계산, N6 선례).
/// 순서: [0] n7-list, [1] n7-content, [2] n7-panels, [3] n7-tabs, [4] n7-root.
///
/// root(block, height:1000px definite) 안의 tabs(flex column, height:auto)가
/// flexGrow:1 자식(panels)을 가질 때: 컨테이너 main 크기가 indefinite 이므로
/// free space 분배(grow)는 발동하지 않고 hypothetical(content 24)을 유지해야
/// 한다(§9.7 — free space 는 definite main 에서만 산출). 회귀형: 부모가 준
/// definite available(1000)을 main 크기로 오인해 panels 가 971 로 grow →
/// tabs 가 페이지 높이로 폭발 (live Tabs 844/1024 발산, 2026-07-13 sweep).
const N7_EXPECTED: &[[f32; 4]] = &[
    [0., 0., 200., 29.],   // [0] n7-list  (고정 29)
    [0., 29., 50., 24.],   // [1] n7-content
    [0., 29., 200., 24.],  // [2] n7-panels (grow 미발동 = content 24, cross stretch 200)
    [0., 0., 200., 53.],   // [3] n7-tabs  (auto = 29+24)
    [0., 0., 200., 1000.], // [4] n7-root  (explicit 1000)
];
const N7_BATCH: &str = r#"[
  {"style":{"width":"200px","height":"29px"},"children":[]},
  {"style":{"width":"50px","height":"24px"},"children":[]},
  {"style":{"display":"flex","flexDirection":"column","height":"auto","flexGrow":1},"children":[1]},
  {"style":{"display":"flex","flexDirection":"column","width":"200px","height":"auto"},"children":[0,2]},
  {"style":{"width":"200px","height":"1000px"},"children":[3]}
]"#;

#[test]
fn tree_golden_n7_auto_column_flex_grow_no_distribution() {
    let rel = layout_relative(N7_BATCH);
    assert_tree_bounds("N7 auto-height column + flexGrow", &rel, N7_EXPECTED);
}

// ─────────────────────────────────────────────────────────────────────────────
// field contract guard — EXPECTED 길이 = fixture 노드 수 (순서 drift 조기 검출)
// ─────────────────────────────────────────────────────────────────────────────

#[test]
fn tree_golden_field_contract_guard() {
    assert_eq!(N1_EXPECTED.len(), 5, "N1 노드 5");
    assert_eq!(N2_EXPECTED.len(), 6, "N2 노드 6");
    assert_eq!(N3_EXPECTED.len(), 5, "N3 노드 5");
    assert_eq!(N4_EXPECTED.len(), 4, "N4 노드 4");
    assert_eq!(N5_EXPECTED.len(), 3, "N5 노드 3");
    assert_eq!(N6_EXPECTED.len(), 3, "N6 노드 3");
    assert_eq!(N7_EXPECTED.len(), 5, "N7 노드 5");
}
