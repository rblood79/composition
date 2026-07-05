//! ADR-916 endgame kill criteria ② — tree_golden 독립 oracle (native)
//!
//! Chrome 실측(브라우저 ground truth)을 상수로 고정해 tree.rs::compute_layout
//! 트리 배치의 회귀를 Taffy 없이 잡는다. golden.rs(단일 컨테이너 평면 계약)와
//! 달리 LayoutTree/compute_layout/get_layouts_batch 트리 계약을 대조한다.
//!
//! fixture 원본: dualRunLive.test.ts C-2b N1~N5 (실전 대표 중첩/혼합 8형상 중
//! 트리 5종). 좌표는 root-상대 정규화(Chrome=viewport 기준, Rust=tree 기준).
//! box model: NodeLayout=content-box, fixture 는 border/padding 미사용 →
//! 추출 HTML 리셋(margin/padding/border 0 + box-sizing:border-box)으로 일치.

use composition_engine::tree::LayoutTree;

/// HC3 (a) 수치 tolerance (px) — golden.rs TOL 과 동일.
const TOL: f32 = 1.0;

/// batch JSON → 트리 빌드 → compute → root-상대 정규화 flat 반환.
/// handles 순서 = batch 배열 순서(post-order). root 는 handles 마지막.
fn layout_relative(batch_json: &str) -> Vec<f32> {
    let mut tree = LayoutTree::new();
    let handles = tree.build_tree_batch(batch_json).expect("batch build");
    let root = *handles.last().expect("root handle");
    tree.compute_layout(root, 200.0, -1.0);
    let flat = tree.get_layouts_batch(&handles);
    // root origin 추출(정규화용) — Chrome=viewport 기준이므로 상수도 root-상대.
    let root_layout = tree.get_layout(root);
    let (rx, ry) = (root_layout.x, root_layout.y);
    let mut rel = flat;
    let mut i = 0;
    while i < rel.len() {
        rel[i] -= rx; // x
        rel[i + 1] -= ry; // y
        i += 4;
    }
    rel
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
/// (Chrome 실측 미확정 — placeholder, Task 2 에서 실측값으로 교체)
const N1_EXPECTED: &[[f32; 4]] = &[
    [0., 0., 0., 0.], // [0] n1-a
    [0., 0., 0., 0.], // [1] n1-b
    [0., 0., 0., 0.], // [2] n1-row
    [0., 0., 0., 0.], // [3] n1-c
    [0., 0., 0., 0.], // [4] n1-root
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
/// [4] n2-cell-b, [5] n2-root. (placeholder — Task 2 교체)
const N2_EXPECTED: &[[f32; 4]] = &[
    [0., 0., 0., 0.], // [0] n2-a1
    [0., 0., 0., 0.], // [1] n2-a2
    [0., 0., 0., 0.], // [2] n2-cell-a
    [0., 0., 0., 0.], // [3] n2-b1
    [0., 0., 0., 0.], // [4] n2-cell-b
    [0., 0., 0., 0.], // [5] n2-root
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
/// [4] n3-root. (placeholder — Task 2 교체)
const N3_EXPECTED: &[[f32; 4]] = &[
    [0., 0., 0., 0.], // [0] n3-g1
    [0., 0., 0., 0.], // [1] n3-g2
    [0., 0., 0., 0.], // [2] n3-grid
    [0., 0., 0., 0.], // [3] n3-foot
    [0., 0., 0., 0.], // [4] n3-root
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
/// (placeholder — Task 2 교체)
const N4_EXPECTED: &[[f32; 4]] = &[
    [0., 0., 0., 0.], // [0] n4-a
    [0., 0., 0., 0.], // [1] n4-b
    [0., 0., 0., 0.], // [2] n4-c
    [0., 0., 0., 0.], // [3] n4-root
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
/// (placeholder — Task 2 교체)
const N5_EXPECTED: &[[f32; 4]] = &[
    [0., 0., 0., 0.], // [0] n5-fixed
    [0., 0., 0., 0.], // [1] n5-auto
    [0., 0., 0., 0.], // [2] n5-root
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
// field contract guard — EXPECTED 길이 = fixture 노드 수 (순서 drift 조기 검출)
// ─────────────────────────────────────────────────────────────────────────────

#[test]
fn tree_golden_field_contract_guard() {
    assert_eq!(N1_EXPECTED.len(), 5, "N1 노드 5");
    assert_eq!(N2_EXPECTED.len(), 6, "N2 노드 6");
    assert_eq!(N3_EXPECTED.len(), 5, "N3 노드 5");
    assert_eq!(N4_EXPECTED.len(), 4, "N4 노드 4");
    assert_eq!(N5_EXPECTED.len(), 3, "N5 노드 3");
}
