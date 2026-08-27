//! ADR-183 Phase 1 — 레이아웃 판정 트레이스의 **공개 계약** 회귀 감시.
//!
//! breakdown §4-1 이 freeze 한 이벤트가 실제 solve 에서 기록되는지, 그리고
//! 게이트가 꺼진 기본 상태에서 기록이 0 인지를 잠근다. 이벤트가 사라지면
//! explain 채널은 "판정이 없었다" 로 **거짓 안심**을 주므로(R2), 계측 지점
//! 삭제는 여기서 RED 로 잡혀야 한다.
//!
//! 트레이스는 엔진의 **자기 보고**다 — 좌표 정합 oracle 은 Chrome parity
//! fixture 이지 이 파일이 아니다 (R4). 여기서 단언하는 것은 "엔진이 무엇을
//! 했다고 보고하는가" 뿐이고, "그 판정이 CSS 에 맞는가" 는 parity 소관이다.

use composition_engine::trace::{ClampBound, FloorSource, SkipReason, TraceEvent};
use composition_engine::tree::LayoutTree;

/// batch JSON → 트리 빌드. 반환 handle 배열은 입력 배열 순서와 1:1 (post-order).
fn build(batch: &str) -> (LayoutTree, Vec<usize>) {
    let mut tree = LayoutTree::new();
    let handles = tree.build_tree_batch(batch).expect("batch build");
    (tree, handles)
}

/// 해당 노드의 **본 solve** 이벤트만 (측정 패스 태그 제외 — R5).
fn main_pass(tree: &LayoutTree, handle: usize) -> Vec<TraceEvent> {
    tree.trace_events(handle)
        .iter()
        .filter(|e| !e.measure_pass)
        .map(|e| e.event.clone())
        .collect()
}

// ── 1. 게이트 off — 기본 상태에서 기록 0 (HC1 의 전제) ──────────────────

const SIMPLE: &str = r#"[
  {"style":{"width":"40px","height":"20px"},"children":[]},
  {"style":{"display":"flex","flexDirection":"row","width":"200px","height":"auto"},"children":[0]}
]"#;

#[test]
fn trace_disabled_by_default_records_nothing() {
    let (mut tree, h) = build(SIMPLE);
    tree.compute_layout(h[1], 200.0, 400.0);

    assert!(!tree.trace_enabled(), "게이트는 기본 off 여야 한다");
    for &handle in &h {
        assert!(
            tree.trace_events(handle).is_empty(),
            "off 상태에서 노드 {handle} 이벤트가 기록됐다"
        );
    }
}

#[test]
fn disabling_trace_releases_recorded_events() {
    let (mut tree, h) = build(SIMPLE);
    tree.enable_trace();
    tree.compute_layout(h[1], 200.0, 400.0);
    assert!(!tree.trace_events(h[1]).is_empty(), "on 상태 기록 0");

    tree.disable_trace();
    assert!(
        tree.trace_events(h[1]).is_empty(),
        "off 전환 시 sink 가 해제돼야 한다 (R3 — WASM 힙)"
    );
}

// ── 2. 증분 skip 판정 (이벤트 #1) ────────────────────────────────────────

#[test]
fn incremental_skip_records_miss_then_hit() {
    let (mut tree, h) = build(SIMPLE);
    tree.enable_trace();

    // 1회차 — 저장된 반환값이 없다.
    tree.compute_layout(h[1], 200.0, 400.0);
    let first = main_pass(&tree, h[1]);
    assert!(
        first.iter().any(|e| matches!(
            e,
            TraceEvent::IncrementalSkip { reason: SkipReason::NoPrev, .. }
        )),
        "1회차 root 에 NoPrev 가 없다: {first:?}"
    );

    // 2회차 — 같은 root·같은 available, 전부 clean → root 에서 HIT 하고 자식은
    // **방문 자체가 없다**. 이것이 "편집한 요소가 아니라 무관한 형제가 변한다" 의
    // 반대편 서명이다: HIT 이면 그 아래는 통째로 직전 값이다.
    tree.compute_layout(h[1], 200.0, 400.0);
    let second = main_pass(&tree, h[1]);
    assert!(
        second.iter().any(|e| matches!(
            e,
            TraceEvent::IncrementalSkip { reason: SkipReason::Hit, .. }
        )),
        "2회차 root 에 Hit 가 없다: {second:?}"
    );
    assert_eq!(
        main_pass(&tree, h[0]).len(),
        1,
        "root 가 HIT 했는데 자식이 재방문됐다"
    );
}

/// 재부모화 — `AvailChanged` 의 실제 발생 경로.
///
/// root-level available 을 바꾸는 것으로는 이 사유가 안 나온다: `compute_layout` 이
/// `last_compute` 불일치를 보고 서브트리를 통째로 dirty 로 만들어 `Dirty` 가 된다.
/// 두 부모를 **한 root 아래** 두고 자식만 옮겨야 "clean 인데 available 이 다른" 상태가
/// 만들어진다 (layout-engine.md §증분 skip 의 키는 dirty 와 available 둘이다).
#[test]
fn incremental_skip_records_avail_changed_on_reparent() {
    let batch = r#"[
      {"style":{"width":"40px","height":"20px"},"children":[]},
      {"style":{"display":"block","width":"100px","height":"60px"},"children":[0]},
      {"style":{"display":"block","width":"300px","height":"60px"},"children":[]},
      {"style":{"display":"block","width":"400px","height":"400px"},"children":[1,2]}
    ]"#;
    let (mut tree, h) = build(batch);
    let (child, narrow, wide, root) = (h[0], h[1], h[2], h[3]);
    tree.compute_layout(root, 400.0, 400.0);

    // 게이트를 켜고 자식만 옮긴다 — 자식 자신의 style/children 은 그대로라 clean 이다.
    tree.enable_trace();
    tree.set_children(narrow, vec![]);
    tree.set_children(wide, vec![child]);
    tree.compute_layout(root, 400.0, 400.0);

    let ev = main_pass(&tree, child);
    assert!(
        ev.iter().any(|e| matches!(
            e,
            TraceEvent::IncrementalSkip { reason: SkipReason::AvailChanged, .. }
        )),
        "재부모화가 AvailChanged 로 기록되지 않았다: {ev:?}"
    );
}

// ── 3. used-size clamp (이벤트 #2) ───────────────────────────────────────

const CLAMPED: &str = r#"[
  {"style":{"width":"40px","height":"500px"},"children":[]},
  {"style":{"display":"flex","flexDirection":"column","width":"200px","height":"400px","maxHeight":"300px"},"children":[0]}
]"#;

#[test]
fn used_size_clamp_records_binding_bound() {
    let (mut tree, h) = build(CLAMPED);
    tree.enable_trace();
    tree.compute_layout(h[1], 200.0, 800.0);

    let ev = main_pass(&tree, h[1]);
    let clamp = ev.iter().find_map(|e| match e {
        TraceEvent::UsedSizeClamp { bound, from, to, .. } => Some((*bound, *from, *to)),
        _ => None,
    });
    let (bound, from, to) = clamp.unwrap_or_else(|| panic!("clamp 이벤트 없음: {ev:?}"));
    assert_eq!(bound, ClampBound::Max, "maxHeight 가 바인딩했어야 한다");
    assert_eq!((from, to), (400.0, 300.0), "clamp 전/후 값이 어긋난다");
}

// ── 4. §4.5 automatic minimum floor (이벤트 #3) ──────────────────────────

/// 주축 크기 auto + min 미명시 + overflow visible → floor 적용.
/// `contentMinWidth` 스칼라(off 19)가 공급되면 출처가 `ContentMinScalar` 다.
const AUTO_MIN: &str = r#"[
  {"style":{"height":"20px","contentMinWidth":60.0,"contentMaxWidth":300.0},"children":[]},
  {"style":{"height":"20px","contentMinWidth":60.0,"contentMaxWidth":300.0},"children":[]},
  {"style":{"display":"flex","flexDirection":"row","width":"100px","height":"20px"},"children":[0,1]}
]"#;

#[test]
fn auto_min_floor_records_scalar_source() {
    let (mut tree, h) = build(AUTO_MIN);
    tree.enable_trace();
    tree.compute_layout(h[2], 100.0, 400.0);

    let ev = main_pass(&tree, h[2]);
    let floors: Vec<_> = ev
        .iter()
        .filter_map(|e| match e {
            TraceEvent::AutoMinFloor { source, floor, .. } => Some((*source, *floor)),
            _ => None,
        })
        .collect();
    assert_eq!(floors.len(), 2, "flex item 2개 모두 floor 가 기록돼야 한다: {ev:?}");
    for (source, floor) in floors {
        assert_eq!(source, FloorSource::ContentMinScalar, "스칼라 공급인데 출처가 다르다");
        assert_eq!(floor, 60.0, "floor 는 content_min_main(off 19) 값이어야 한다");
    }
}

// ── 5. 측정 패스 태그 (R5) ───────────────────────────────────────────────

/// `width:max-content` 컨테이너는 `measure_intrinsic_width` 재실행을 태운다.
/// 그 구간 이벤트가 본 solve 와 섞이면 판독이 오도된다.
const MEASURED: &str = r#"[
  {"style":{"width":"40px","height":"20px"},"children":[]},
  {"style":{"display":"flex","flexDirection":"row","width":"max-content","height":"auto"},"children":[0]},
  {"style":{"display":"block","width":"400px","height":"auto"},"children":[1]}
]"#;

#[test]
fn measure_pass_events_are_tagged_separately() {
    let (mut tree, h) = build(MEASURED);
    tree.enable_trace();
    tree.compute_layout(h[2], 400.0, 400.0);

    let all = tree.trace_events(h[1]);
    assert!(
        all.iter().any(|e| matches!(e.event, TraceEvent::IntrinsicMeasure { .. })),
        "측정 캐시 이벤트가 없다: {all:?}"
    );
    assert!(
        tree.trace_events(h[0]).iter().any(|e| e.measure_pass),
        "센티넬 available 구간 이벤트에 measure_pass 태그가 없다"
    );
}

// ── 6.5 JSON 직렬화 계약 (Phase 2 — WASM 경계) ───────────────────────────
//
// `wasm.rs::getLayoutTrace` 는 wasm32 게이트라 native 테스트가 닿지 않는다.
// 그래서 JSON 형태 계약은 그 아래 층(`tree.rs::trace_json`)에서 잠근다 —
// wasm 표면은 이 문자열을 그대로 위임한다. TS 판독자(compositionEngine.ts
// `EngineTraceNode`)가 이 스키마의 소비자다: 필드명이 바뀌면 여기가 RED.

#[test]
fn trace_json_reports_typed_events() {
    let (mut tree, h) = build(CLAMPED);
    tree.enable_trace();
    tree.compute_layout(h[1], 200.0, 800.0);

    let v: serde_json::Value =
        serde_json::from_str(&tree.trace_json(h[1])).expect("trace_json 이 유효 JSON 이 아니다");
    assert_eq!(v["handle"].as_u64(), Some(h[1] as u64));
    assert_eq!(v["enabled"], true);
    assert_eq!(v["dropped"].as_u64(), Some(0));

    let events = v["events"].as_array().expect("events 배열 없음");
    let clamp = events
        .iter()
        .find(|e| e["type"] == "UsedSizeClamp")
        .unwrap_or_else(|| panic!("UsedSizeClamp 이벤트 없음: {events:?}"));
    // internally-tagged: 판정 payload 가 태그와 같은 층에 평탄화돼야 TS 가
    // discriminated union 으로 읽는다.
    assert_eq!(clamp["bound"], "Max");
    assert_eq!(clamp["axis"], "Block");
    assert_eq!(clamp["from"].as_f64(), Some(400.0));
    assert_eq!(clamp["to"].as_f64(), Some(300.0));
    assert_eq!(clamp["measure_pass"], false, "R5 태그가 JSON 에 실리지 않았다");
}

#[test]
fn trace_json_when_disabled_reports_enabled_false() {
    let (mut tree, h) = build(SIMPLE);
    tree.compute_layout(h[1], 200.0, 400.0);

    let v: serde_json::Value =
        serde_json::from_str(&tree.trace_json(h[1])).expect("off 상태도 유효 JSON 이어야 한다");
    assert_eq!(v["enabled"], false);
    assert!(
        v["events"].as_array().is_some_and(|a| a.is_empty()),
        "off 상태 events 는 빈 배열이어야 한다"
    );
}

// ── 6. 노드당 상한 (R3) ──────────────────────────────────────────────────

#[test]
fn per_node_event_cap_is_enforced() {
    let (mut tree, h) = build(SIMPLE);
    tree.enable_trace();
    for _ in 0..500 {
        tree.mark_dirty(h[1]);
        tree.compute_layout(h[1], 200.0, 400.0);
    }
    let n = tree.trace_events(h[1]).len();
    assert!(
        n <= composition_engine::trace::MAX_EVENTS_PER_NODE,
        "노드당 상한({}) 초과: {n}",
        composition_engine::trace::MAX_EVENTS_PER_NODE
    );
    assert!(tree.trace_dropped(h[1]) > 0, "상한 초과분이 dropped 로 집계되지 않았다");
}
