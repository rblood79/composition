//! ADR-169 G4 — 트리 solve 패스 micro-bench (zero-dep, harness = false).
//!
//! `flex_shrink` 벤치는 `flex::flex_layout` **커널**만 재므로, ADR-169 가 추가하는
//! 비용(= intrinsic 측정 패스의 서브트리 재귀)이 잡히지 않는다. 이 벤치는
//! `LayoutTree::compute_layout` 전체를 재서 측정 패스 도입 전후를 비교한다.
//!
//! 시나리오는 실제 발산 형태를 본뜬다 — flex row 안에 컨테이너 item 이 있고 그 안에
//! 다시 중첩이 이어지는 구조. 측정 캐시가 없으면 여기서 깊이에 지수적으로 늘어난다(R1).
//!
//! 실행: `cargo bench --bench tree_solve` (packages/composition-engine)

use composition_engine::tree::{LayoutTree, NodeStyle};
use std::hint::black_box;
use std::time::Instant;

fn leaf(w: &str) -> NodeStyle {
    NodeStyle {
        width: Some(w.into()),
        height: Some("40px".into()),
        ..NodeStyle::default()
    }
}

fn scalar_leaf(min_c: f32, max_c: f32) -> NodeStyle {
    NodeStyle {
        height: Some("40px".into()),
        content_min_width: Some(min_c),
        content_max_width: Some(max_c),
        ..NodeStyle::default()
    }
}

fn flex_row(grow: Option<f32>) -> NodeStyle {
    NodeStyle {
        display: Some("flex".into()),
        flex_direction: Some("row".into()),
        flex_grow: grow,
        ..NodeStyle::default()
    }
}

/// 깊이 `depth` 의 중첩 flex row 트리. 각 단계는 [고정폭 sidebar, grow 컨테이너] 형태 —
/// 프리셋(`sidebar-left` 등) 실형태를 재귀로 쌓은 것.
fn build_nested(tree: &mut LayoutTree, depth: usize) -> usize {
    // 최심부: 스칼라 leaf 2개를 가진 flex row.
    let a = tree.create_node(scalar_leaf(120.0, 300.0));
    let b = tree.create_node(scalar_leaf(80.0, 200.0));
    let mut cur = tree.create_node(flex_row(Some(1.0)));
    tree.set_children(cur, vec![a, b]);

    for _ in 0..depth {
        let sidebar = tree.create_node(leaf("240px"));
        let content = tree.create_node(flex_row(Some(1.0)));
        tree.set_children(content, vec![cur]);
        let row = tree.create_node(flex_row(Some(1.0)));
        tree.set_children(row, vec![sidebar, content]);
        cur = row;
    }

    let root = tree.create_node(NodeStyle {
        display: Some("flex".into()),
        flex_direction: Some("row".into()),
        width: Some("1920px".into()),
        height: Some("800px".into()),
        ..NodeStyle::default()
    });
    tree.set_children(root, vec![cur]);
    root
}

/// 중앙값 + p90 (ns). 단발 최소값은 노이즈, 평균은 outlier 에 취약.
/// `batch` 회를 **한 번의 타이머 구간**으로 재고 나눈다 (ADR-183 G1).
///
/// 구 하니스는 1회씩 쟀는데, 그러면 두 가지가 측정을 지배한다:
///   ① **타이머 해상도** — macOS `Instant` 는 약 41.7ns 틱이라 208ns 짜리 증분 경로는
///      5틱이다. 인접 틱으로 한 칸만 움직여도 ±20% 라 2% 회귀는 원리상 못 본다
///      (실측: 같은 바이너리 A/A 에서 208 ↔ 167).
///   ② **`Instant::now()` 자신의 비용** — 측정 대상이 수백 ns 면 그 오버헤드가
///      결과의 큰 몫을 차지해, 실제 코드 변화를 희석한다.
/// 배치로 재면 둘 다 `batch` 로 나뉜다.
fn measure(label: &str, samples_n: usize, batch: usize, mut f: impl FnMut()) {
    let batch = batch.max(1);
    // 워밍업 — 첫 회 할당/캐시 미스 제외.
    for _ in 0..batch {
        f();
    }
    let mut samples = Vec::with_capacity(samples_n);
    for _ in 0..samples_n {
        let t = Instant::now();
        for _ in 0..batch {
            f();
        }
        samples.push(t.elapsed().as_nanos() as u64 / batch as u64);
    }
    samples.sort_unstable();
    let median = samples[samples.len() / 2];
    let p90 = samples[samples.len() * 9 / 10];
    println!("{label:<34} median {median:>9} ns   p90 {p90:>9} ns");
}

fn main() {
    println!("ADR-169 tree solve bench (median/p90, lower is better)\n");

    for depth in [1usize, 4, 8, 12] {
        let mut tree = LayoutTree::new();
        let root = build_nested(&mut tree, depth);
        // 매 iteration 전면 재계산 — available 을 번갈아 바꿔 증분 skip 을 무효화한다.
        // `mark_dirty(root)` 는 **조상 방향** 전파라 root 한 노드만 dirty 가 되고,
        // clean 자식은 그대로 skip 되어 깊이가 측정에 안 잡힌다 (초기 시도에서 depth
        // 1~12 가 전부 동일 수치로 나온 원인).
        let mut flip = false;
        // full solve 는 4µs~27µs 라 타이머 틱(41.7ns) 대비 100배 이상 — batch 불요.
        // 배치를 걸면 한 샘플이 8배 길어져 스케줄러 방해를 더 잘 타고 분산만 커진다
        // (실측 depth=1: batch 8 에서 median 8578 / p90 11614 로 악화).
        measure(&format!("nested depth={depth:<2} full solve"), 800, 1, || {
            flip = !flip;
            let w = if flip { 1920.0 } else { 1919.0 };
            tree.compute_layout(black_box(root), w, 800.0);
        });
    }

    // 증분 경로 — 한 번 계산된 뒤 동일 available 재호출 (실사용 hot path).
    let mut tree = LayoutTree::new();
    let root = build_nested(&mut tree, 8);
    tree.compute_layout(root, 1920.0, 800.0);
    measure("nested depth=8  incremental", 200, 500, || {
        tree.compute_layout(black_box(root), 1920.0, 800.0);
    });
}
