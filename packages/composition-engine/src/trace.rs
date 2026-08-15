//! ADR-183 — 레이아웃 판정 트레이스 (디버그 채널).
//!
//! 엔진은 solve 시점에 판정 정보를 전부 갖고 있으나 기록 없이 소멸시킨다. 그
//! 결과 같은 오진이 반복되어 `.claude/rules/layout-engine.md` 에 "~로 진단 금지"
//! 목록이 문서 층으로만 쌓였다. 이 모듈은 그 판정을 **노드 단위로 기록**해 문서
//! 방어를 실행 시점 판별로 옮긴다.
//!
//! ## 게이트 계약 (HC1)
//!
//! `LayoutTree::trace` 가 `None` 이면 기록 지점의 비용은 **`Option` 분기 1회**이고
//! 할당은 0 이다. 이벤트 구성(`TraceEvent` 생성)은 반드시 `Some` 분기 **안**에서
//! 한다 — 밖에서 만들어 넘기면 off 경로가 `Vec` 할당을 지불한다.
//!
//! ## 오해 방지 (R4)
//!
//! 트레이스는 **엔진의 자기 보고**다. "엔진이 무엇을 했나" 는 답하지만 "그것이
//! CSS 에 맞나" 는 답하지 않는다 — 정합 oracle 은 Chrome parity fixture 다.
//!
//! ## 이벤트 목록의 출처
//!
//! 7종은 임의 선정이 아니라 `layout-engine.md` 의 오진 이력에서 **역산**했다
//! (ADR-183 breakdown §4-1). 각 variant 주석의 "배제하는 오진" 이 그 근거이고,
//! 엔진 알고리즘을 수정할 때 해당 이벤트를 같이 갱신하지 않으면 explain 이
//! "판정이 없었다" 로 거짓 안심을 준다 (R2 — `tests/layout_trace.rs` 가 감시).

use serde::Serialize;
use std::collections::HashMap;

/// 노드당 이벤트 상한 (R3 — WASM 힙). 초과분은 버리고 개수만 센다.
///
/// **상한이 있는 쪽이 옳다**: 트레이스는 디버그 세션 단위 수명이고 노드당 판정
/// 수는 solve 반복 횟수에 비례해 무한히 자란다. 다만 `nodeRendererText` 의 구
/// content-키 LRU 처럼 **상한이 곧 퇴거**가 되면 안 되므로, 여기서는 퇴거 대신
/// **선착순 보존 + 초과 개수 집계**다 — 판독자가 "잘렸다" 를 알 수 있으면 된다.
pub const MAX_EVENTS_PER_NODE: usize = 64;

/// 논리축이 아니라 **물리축** — 판독자가 `width`/`height` 로 읽는다.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize)]
pub enum Axis {
    /// 인라인 축 (width)
    Inline,
    /// 블록 축 (height)
    Block,
}

/// 증분 skip 게이트(`tree.rs::solve_node`)의 판정.
///
/// 배제하는 오진: "새로고침하면 정상으로 돌아온다 → store/canonical 데이터 문제"
/// (layout-engine.md §"증분 skip 의 키는 dirty 와 available 둘이다"). 전체 재빌드가
/// 캐시를 버리는 것뿐이므로 데이터는 멀쩡하다.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize)]
pub enum SkipReason {
    /// 저장된 반환값 재사용 — 서브트리 clean + available 동일.
    Hit,
    /// 저장된 반환값 없음 (최초 solve, 또는 측정 패스 복구 직후).
    NoPrev,
    /// 서브트리에 dirty 노드가 있어 재계산.
    Dirty,
    /// available 이 직전 solve 와 다름 — **재부모화 / 부모 리사이즈**의 서명.
    AvailChanged,
}

/// used size clamp 에서 어느 쪽이 바인딩했나.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize)]
pub enum ClampBound {
    Min,
    Max,
}

/// §4.5 automatic minimum size 의 floor 기준값 출처 (ADR-165).
///
/// 배제하는 오진: "auto-main item 이 찌그러지는 것을 이 변경 탓으로 진단"
/// (layout-engine.md §used size clamp 금지 패턴). floor 가 발화했는지, 그리고
/// 그 값이 정확 min-content 인지 근사인지가 갈림점이다.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize)]
pub enum FloorSource {
    /// off 19 `content_min_main` — TS 스칼라 공급 (정확 min-content).
    ContentMinScalar,
    /// off 13 `content_main` — 스칼라 부재 fallback (단일줄 상한 근사).
    ContentMainFallback,
}

/// 트랙 sizing 단계 (CSS-GRID-1).
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize)]
pub enum TrackStage {
    /// §12.5 — 자식 content 기여로 base/상한 산출.
    Contribution,
    /// §12.8 — `auto` 트랙에 남는 여유 균등 분배.
    AutoStretch,
}

/// 엔진이 내린 판정 1건.
///
/// 필드는 **판독자가 오진을 배제하는 데 필요한 최소**만 담는다 — 값을 늘리면
/// off 경로 비용이 아니라 유지 부담(R2)이 커진다.
///
/// JSON 직렬화는 internally-tagged (`"type"` 필드) — TS 판독자가 discriminated
/// union 으로 소비한다 (`compositionEngine.ts::EngineTraceEvent`). variant 명·
/// 필드명이 곧 wire 계약이므로 rename 은 TS 타입과 동시 갱신
/// (`tests/layout_trace.rs` JSON 계약 테스트가 감시). `GridTrackResolve.tracks`
/// 의 NAN(미해소 토큰)은 serde_json 이 `null` 로 내보낸다.
#[derive(Debug, Clone, PartialEq, Serialize)]
#[serde(tag = "type")]
pub enum TraceEvent {
    /// #1 증분 skip 게이트.
    IncrementalSkip {
        reason: SkipReason,
        avail: (f32, f32),
    },
    /// #2 used size clamp — min/max 중 어느 쪽이 바인딩했나.
    UsedSizeClamp {
        axis: Axis,
        bound: ClampBound,
        from: f32,
        to: f32,
    },
    /// #3 §4.5 automatic minimum floor (flex item 단위).
    AutoMinFloor {
        /// 컨테이너 자식 인덱스 (flex item 순번).
        item: usize,
        source: FloorSource,
        floor: f32,
    },
    /// #4 shrink-to-fit 확정 뒤 재진입 (CSS-SIZING-3 §5.1).
    ShrinkToFitReentry { axis: Axis, settled: f32 },
    /// #5 intrinsic 폭 측정 캐시 — "부모는 맞고 자손만 틀림" 의 판별점.
    IntrinsicMeasure {
        hit: bool,
        generation: u64,
        min: f32,
        max: f32,
    },
    /// #6 flex item 재-solve (3.5) — used main 이 자식이 푼 available 과 다를 때.
    FlexItemResolve {
        item: usize,
        used_main: f32,
        prev_avail: f32,
    },
    /// #7 grid 트랙 해소 결과.
    GridTrackResolve {
        stage: TrackStage,
        axis: Axis,
        tracks: Vec<f32>,
    },
}

/// 기록된 이벤트 + 발생 문맥.
///
/// JSON 에서는 `event` 가 태그와 같은 층으로 평탄화된다 —
/// `{"measure_pass":false,"type":"UsedSizeClamp","bound":"Max",...}`.
#[derive(Debug, Clone, PartialEq, Serialize)]
pub struct TracedEvent {
    /// 측정 패스(센티넬 available) 안에서 발생했는가 (R5).
    ///
    /// 측정 패스는 `MIN_CONTENT_AVAIL`/`MAX_CONTENT_AVAIL` 로 도는 **가상 solve**라
    /// 그 판정을 본 solve 와 같은 줄에 놓으면 판독이 오도된다. 태그를 지우지 말 것.
    pub measure_pass: bool,
    #[serde(flatten)]
    pub event: TraceEvent,
}

/// 노드 handle → 이벤트 목록.
#[derive(Debug, Default)]
pub struct TraceSink {
    events: HashMap<usize, Vec<TracedEvent>>,
    /// 상한 초과로 버린 개수 (handle 별).
    dropped: HashMap<usize, usize>,
    /// 측정 패스 중첩 깊이 — 0 보다 크면 `measure_pass`.
    ///
    /// bool 이 아니라 카운터인 이유: `measure_intrinsic_width` 는 min/max 두 모드로
    /// 각각 solve 를 돌리고 그 안에서 자손이 또 측정을 태울 수 있다. bool 이면
    /// 안쪽이 먼저 끝나며 태그가 조기 해제된다.
    measure_depth: u32,
}

impl TraceSink {
    pub fn new() -> Self {
        Self::default()
    }

    /// 이벤트 1건 기록. 상한 초과분은 버리고 개수만 센다.
    pub fn push(&mut self, handle: usize, event: TraceEvent) {
        let measure_pass = self.measure_depth > 0;
        let slot = self.events.entry(handle).or_default();
        if slot.len() >= MAX_EVENTS_PER_NODE {
            *self.dropped.entry(handle).or_insert(0) += 1;
            return;
        }
        slot.push(TracedEvent {
            measure_pass,
            event,
        });
    }

    pub fn events(&self, handle: usize) -> &[TracedEvent] {
        self.events.get(&handle).map(|v| v.as_slice()).unwrap_or(&[])
    }

    pub fn dropped(&self, handle: usize) -> usize {
        self.dropped.get(&handle).copied().unwrap_or(0)
    }

    /// 기록된 노드 handle 목록 (판독 헬퍼의 "무엇이 잡혔나" 용).
    pub fn traced_handles(&self) -> Vec<usize> {
        let mut v: Vec<usize> = self.events.keys().copied().collect();
        v.sort_unstable();
        v
    }

    pub fn enter_measure(&mut self) {
        self.measure_depth += 1;
    }

    pub fn exit_measure(&mut self) {
        self.measure_depth = self.measure_depth.saturating_sub(1);
    }

    pub fn in_measure_pass(&self) -> bool {
        self.measure_depth > 0
    }

    /// 이벤트만 비우고 측정 깊이는 보존 — solve 중 호출되지 않는다는 가정 없이 안전.
    pub fn clear(&mut self) {
        self.events.clear();
        self.dropped.clear();
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn cap_preserves_first_and_counts_overflow() {
        let mut sink = TraceSink::new();
        for i in 0..(MAX_EVENTS_PER_NODE + 10) {
            sink.push(
                7,
                TraceEvent::IncrementalSkip {
                    reason: SkipReason::Hit,
                    avail: (i as f32, 0.0),
                },
            );
        }
        assert_eq!(sink.events(7).len(), MAX_EVENTS_PER_NODE);
        assert_eq!(sink.dropped(7), 10);
        // 선착순 보존 — 첫 이벤트가 살아 있어야 "언제부터" 를 읽을 수 있다.
        assert!(matches!(
            sink.events(7)[0].event,
            TraceEvent::IncrementalSkip { avail: (0.0, _), .. }
        ));
    }

    #[test]
    fn measure_depth_is_nestable() {
        let mut sink = TraceSink::new();
        sink.enter_measure();
        sink.enter_measure();
        sink.exit_measure();
        assert!(
            sink.in_measure_pass(),
            "중첩 측정에서 안쪽이 끝났다고 태그가 풀리면 안 된다"
        );
        sink.exit_measure();
        assert!(!sink.in_measure_pass());
    }

    #[test]
    fn untraced_handle_reads_empty() {
        let sink = TraceSink::new();
        assert!(sink.events(99).is_empty());
        assert_eq!(sink.dropped(99), 0);
    }
}
