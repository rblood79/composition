//! ADR-164 G3 — flex shrink 경로 micro-bench (zero-dep, harness = false).
//!
//! criterion 상당의 회귀 게이트 목적: §4.5 automatic minimum floor 도입 직전
//! 커밋에서 기준치를 측정하고, 도입 후 동일 시나리오로 on/off 비교한다.
//! 외부 crate 없이 `Instant` 반복 측정 — 중앙값/p90 을 판정값으로 쓴다
//! (단발 최소값은 노이즈, 평균은 outlier 에 취약).
//!
//! 실행: `cargo bench --bench flex_shrink` (packages/composition-engine)

use composition_engine::flex::{self, FLEX_FIELD_COUNT};
use std::hint::black_box;
use std::time::Instant;

/// 아이템 1개를 data 배열에 기록. 미지정 필드는 0 유지(zero-init 계약).
#[allow(clippy::too_many_arguments)]
fn write_item(
    data: &mut [f32],
    i: usize,
    basis: f32,
    width: f32,
    min_main: f32,
    max_main: f32,
    content_main: f32,
    content_cross: f32,
    grow: f32,
    shrink: f32,
) {
    let off = i * FLEX_FIELD_COUNT;
    data[off] = basis;
    data[off + 1] = width;
    data[off + 2] = -1.0; // height AUTO
    data[off + 9] = min_main;
    data[off + 10] = max_main;
    data[off + 11] = -1.0; // min_cross AUTO
    data[off + 12] = -1.0; // max_cross NONE
    data[off + 13] = content_main;
    data[off + 14] = content_cross;
    data[off + 15] = grow;
    data[off + 16] = shrink;
}

fn bench_case(name: &str, data: &[f32], available_main: f32, wrap: u8) {
    const WARMUP: usize = 20;
    const RUNS: usize = 100;

    for _ in 0..WARMUP {
        black_box(flex::flex_layout(
            black_box(data),
            available_main,
            800.0,
            flex::DIR_ROW,
            0, // justify start
            0, // align stretch
            0, // align_content
            wrap,
            0.0,
            0.0,
            true,
        ));
    }

    let mut ns: Vec<u128> = Vec::with_capacity(RUNS);
    for _ in 0..RUNS {
        let t = Instant::now();
        black_box(flex::flex_layout(
            black_box(data),
            available_main,
            800.0,
            flex::DIR_ROW,
            0,
            0,
            0,
            wrap,
            0.0,
            0.0,
            true,
        ));
        ns.push(t.elapsed().as_nanos());
    }
    ns.sort_unstable();
    let median = ns[RUNS / 2];
    let p90 = ns[RUNS * 9 / 10];
    println!("bench {name} median_ns {median} p90_ns {p90}");
}

fn main() {
    // S1: nowrap 1000 아이템, width 명시 200 합 200k > available 100k → 전원 shrink.
    //     §9.7 분배 루프 hot path (floor 도입 전후 모두 지나는 기존 경로).
    let n1 = 1000;
    let mut d1 = vec![0.0f32; n1 * FLEX_FIELD_COUNT];
    for i in 0..n1 {
        write_item(&mut d1, i, -1.0, 200.0, -1.0, -1.0, 200.0, 24.0, 0.0, 1.0);
    }
    bench_case("shrink_nowrap_1000", &d1, 100_000.0, flex::WRAP_NOWRAP);

    // S2: wrap 1200 아이템, width AUTO + content 1500 > available 1000 → 라인당
    //     단일 item 강제 shrink (wrap 라인은 available 이하로 패킹되므로 초과 item 만
    //     shrink 를 탄다). §4.5 floor 대상(width-auto item) — 도입 후 min violation
    //     동결 경로가 추가되어 결과도 1500 유지로 바뀐다 (도입 전 1000).
    let n2 = 1200;
    let mut d2 = vec![0.0f32; n2 * FLEX_FIELD_COUNT];
    for i in 0..n2 {
        write_item(&mut d2, i, -1.0, -1.0, -1.0, -1.0, 1500.0, 32.0, 0.0, 1.0);
    }
    bench_case("shrink_wrap_auto_1200", &d2, 1_000.0, flex::WRAP_WRAP);

    // S3: nowrap 1000 아이템 grow — floor 무관 대조군 (회귀 오탐 분리용).
    let n3 = 1000;
    let mut d3 = vec![0.0f32; n3 * FLEX_FIELD_COUNT];
    for i in 0..n3 {
        write_item(&mut d3, i, 0.0, -1.0, -1.0, -1.0, 50.0, 24.0, 1.0, 1.0);
    }
    bench_case("grow_nowrap_1000", &d3, 500_000.0, flex::WRAP_NOWRAP);

    // S4 (ADR-165): S1 동형 + width AUTO + content_min_main(off 19) 공급 —
    //     §4.5 floor 가 정확 min-content 를 소비하는 경로. shrink 목표(100)가
    //     floor(40) 위라 min violation 동결 없이 분배 종료 (floor 읽기 비용 측정).
    let n4 = 1000;
    let mut d4 = vec![0.0f32; n4 * FLEX_FIELD_COUNT];
    for i in 0..n4 {
        write_item(&mut d4, i, -1.0, -1.0, -1.0, -1.0, 200.0, 24.0, 0.0, 1.0);
        d4[i * FLEX_FIELD_COUNT + 19] = 40.0; // content_min_main
    }
    bench_case("shrink_minfloor_1000", &d4, 100_000.0, flex::WRAP_NOWRAP);

    // S5 (ADR-165): S4 변형 — 컨테이너가 min-content 합보다 좁아 전원 floor 동결
    //     (min violation 동결 경로 hot). 정확 min-content(120)가 결과 폭.
    let n5 = 1000;
    let mut d5 = vec![0.0f32; n5 * FLEX_FIELD_COUNT];
    for i in 0..n5 {
        write_item(&mut d5, i, -1.0, -1.0, -1.0, -1.0, 200.0, 24.0, 0.0, 1.0);
        d5[i * FLEX_FIELD_COUNT + 19] = 120.0;
    }
    bench_case("shrink_minfloor_freeze_1000", &d5, 100_000.0, flex::WRAP_NOWRAP);
}
