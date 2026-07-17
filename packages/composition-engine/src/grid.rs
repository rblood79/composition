//! ADR-916 Phase 1-B — CSS Grid 레이아웃 (CSS-GRID-1 §7 track sizing / §8 placement)
//!
//! Taffy 를 대체하는 자체 grid solver. 두 개의 검증된 자산을 Rust 로 통합 승계한다:
//!
//! 1. `apps/builder/.../wasm/src/grid_layout.rs` (279줄, unit test 11) — px/fr/%/auto
//!    4단위 track 산술 커널 + row-major cell positions. runtime 미가동(layoutWorker 전용)
//!    이었으나 track/gap 산술이 검증된 커널.
//! 2. `apps/builder/.../layout/GridLayout.utils.ts` — 더 완전한 JS 구현.
//!    `repeat(auto-fill/auto-fit, ...)` 동적 track 수, `minmax(min, max)` (fr sentinel),
//!    named grid-template-areas, `gridColumn/Row` span 배치를 담당. 실동작 SSOT.
//!
//! grid_layout.rs 는 auto=1fr 근사 + repeat/minmax/named-areas 미지원이었다. 본 모듈은
//! GridLayout.utils.ts 의 알고리즘을 정본으로 이관하여 그 갭을 메우고, grid_layout.rs 의
//! 산술 test 11 을 회귀로 승계한다 (재작성 아닌 이식 — WPT-파생 검증 자산 상실 회피).
//!
//! ## implicit auto row intrinsic (2026-07-04, seam C-1 후속)
//!
//! `gridTemplateRows` 미명시(implicit auto row) 시 grid.rs 단독은 셀 높이를 하드코딩
//! fallback(100)으로 채운다(자식 flat 을 안 받아 intrinsic 을 모름). CSS implicit auto
//! row 는 그 행 자식들의 max content height 여야 하므로, **tree.rs `solve_grid`** 가
//! 자식을 먼저 solve 해 intrinsic height 를 얻고 row 별 max 를 px 트랙 문자열로 주입한 뒤
//! grid.rs 를 호출한다(자식 intrinsic → row 크기 도출은 트리 레벨 책임, grid.rs 는 확정된
//! 트랙만 배치). 이로써 grid height:auto 가 dual-run(Taffy self-diff) diff 0 통과.
//!
//! ## 미구현 (다음 세션 — dual-run FAIL 이 fixture)
//!
//! subgrid, 명시 track 의 `min-content`/`max-content` intrinsic(→ 0 폴백, 명시 row 안의
//! auto 는 여전히 미측정), dense packing 의 빈칸 역채움, baseline 정렬, `fit-content()`
//! 함수. 현행 catalog grid 컨테이너 사용 범위로 한정.

use std::collections::HashSet;
use wasm_bindgen::prelude::*;

/// Sentinel: fr track 의 size 미결정 상태. resolve 후 실제 px 로 대체된다.
const UNRESOLVED: f32 = 0.0;

/// Track unit 분류 (GridLayout.utils.ts GridTrack.unit 대응).
#[derive(Clone, Copy, Debug, PartialEq)]
enum TrackUnit {
    Px,
    Fr,
    Percent,
    Auto,
    Minmax,
}

/// 파싱된 grid track. resolve 전에는 `size` 가 UNRESOLVED(0) 인 fr/%/auto/minmax 가 존재.
#[derive(Clone, Debug)]
struct GridTrack {
    size: f32,
    unit: TrackUnit,
    /// fr 값 (unit=Fr 일 때) 또는 % 값 / minmax 원본 파싱용.
    fr_value: f32,
    /// minmax min (px). 컨텐츠 기반(auto/min-content/max-content)은 0 폴백.
    min: f32,
    /// minmax max. fr 이면 음수(-fr), px 이면 양수, 1fr 기본은 -1.
    max: f32,
}

impl GridTrack {
    fn new(unit: TrackUnit) -> Self {
        GridTrack {
            size: UNRESOLVED,
            unit,
            fr_value: 0.0,
            min: 0.0,
            max: -1.0,
        }
    }
}

// ─── 토큰화 ────────────────────────────────────────────────────────────

/// CSS grid-template 문자열을 최상위 토큰으로 분리. 괄호 depth 기반이라
/// `repeat(auto-fill, minmax(200px, 1fr))` 같은 중첩을 하나의 토큰으로 유지.
/// (GridLayout.utils.ts tokenizeTemplate / TaffyGridEngine.parseGridTemplate 동일)
fn tokenize_template(template: &str) -> Vec<String> {
    let mut tokens: Vec<String> = Vec::new();
    let mut depth: i32 = 0;
    let mut current = String::new();

    for ch in template.chars() {
        match ch {
            '(' => {
                depth += 1;
                current.push(ch);
            }
            ')' => {
                depth -= 1;
                current.push(ch);
            }
            ' ' if depth == 0 => {
                let t = current.trim();
                if !t.is_empty() {
                    tokens.push(t.to_string());
                }
                current.clear();
            }
            _ => current.push(ch),
        }
    }
    let t = current.trim();
    if !t.is_empty() {
        tokens.push(t.to_string());
    }
    tokens
}

// ─── 단일 트랙 파싱 ─────────────────────────────────────────────────────

/// px / fr / % / auto 단일 값 파싱 (minmax 제외). fr/%/auto 는 size 미결정.
/// (GridLayout.utils.ts parseSingleTrackValue 동일)
fn parse_single_track_value(value: &str) -> GridTrack {
    let v = value.trim();
    if let Some(fr_str) = v.strip_suffix("fr") {
        let mut t = GridTrack::new(TrackUnit::Fr);
        // GridLayout.utils.ts 는 `parseFloat(v) || 1` — 0/파싱실패 모두 1 로 폴백.
        let parsed = fr_str.trim().parse::<f32>().unwrap_or(0.0);
        t.fr_value = if parsed == 0.0 { 1.0 } else { parsed };
        t
    } else if let Some(px_str) = v.strip_suffix("px") {
        let mut t = GridTrack::new(TrackUnit::Px);
        t.size = px_str.trim().parse::<f32>().unwrap_or(0.0);
        t
    } else if let Some(pct_str) = v.strip_suffix('%') {
        let mut t = GridTrack::new(TrackUnit::Percent);
        // % 크기는 resolve 단계에서 containerSize 기반 계산. fr_value 에 퍼센트 보관.
        t.fr_value = pct_str.trim().parse::<f32>().unwrap_or(0.0);
        t
    } else if v == "auto" {
        GridTrack::new(TrackUnit::Auto)
    } else {
        // 알 수 없는 값 → auto (GridLayout.utils.ts 폴백 동일)
        GridTrack::new(TrackUnit::Auto)
    }
}

/// `minmax(min, max)` 파싱. max 가 fr 이면 음수(-fr) 로 저장하여 resolve 에서 fr 풀 참여.
/// (GridLayout.utils.ts parseMinmax 동일)
fn parse_minmax(expr: &str) -> GridTrack {
    let open = expr.find('(').map(|i| i + 1).unwrap_or(0);
    let close = expr.rfind(')').unwrap_or(expr.len());
    let inner = if open <= close { &expr[open..close] } else { "" };
    let mut parts = inner.split(',');
    let min_str = parts.next().unwrap_or("0px").trim();
    let max_str = parts.next().unwrap_or("1fr").trim();

    // min: px 만 실값, 컨텐츠 기반(auto/min-content/max-content)은 0 폴백.
    let min_val = if let Some(px) = min_str.strip_suffix("px") {
        px.trim().parse::<f32>().unwrap_or(0.0)
    } else {
        0.0
    };

    // max: fr → 음수(-fr), px → 양수, auto/max-content → -1 (1fr 동작).
    let max_val = if let Some(fr) = max_str.strip_suffix("fr") {
        -(fr.trim().parse::<f32>().unwrap_or(1.0))
    } else if let Some(px) = max_str.strip_suffix("px") {
        px.trim().parse::<f32>().unwrap_or(0.0)
    } else {
        -1.0
    };

    let mut t = GridTrack::new(TrackUnit::Minmax);
    t.min = min_val;
    t.max = max_val;
    t
}

// ─── repeat() 전개 ─────────────────────────────────────────────────────

/// `repeat(count | auto-fill | auto-fit, track-list)` 를 트랙 배열로 전개.
/// auto-fill/auto-fit 은 컨테이너 크기 기반으로 반복 횟수를 산출한다.
/// 반환: (전개된 트랙, is_auto_fit)
/// (GridLayout.utils.ts expandRepeat 동일)
fn expand_repeat(expr: &str, container_size: f32, gap: f32) -> (Vec<GridTrack>, bool) {
    let open = expr.find('(').map(|i| i + 1).unwrap_or(0);
    let close = expr.rfind(')').unwrap_or(expr.len());
    let inner = if open <= close { &expr[open..close] } else { "" };

    // 최상위 첫 콤마로 count 와 track-list 분리 (괄호 depth 고려).
    let mut depth: i32 = 0;
    let mut first_comma: isize = -1;
    for (i, ch) in inner.char_indices() {
        match ch {
            '(' => depth += 1,
            ')' => depth -= 1,
            ',' if depth == 0 => {
                first_comma = i as isize;
                break;
            }
            _ => {}
        }
    }
    if first_comma < 0 {
        return (Vec::new(), false);
    }

    let fc = first_comma as usize;
    let count_str = inner[..fc].trim();
    let track_list_str = inner[fc + 1..].trim();

    // 반복 패턴 트랙 파싱.
    let pattern_tokens = tokenize_template(track_list_str);
    let pattern_tracks: Vec<GridTrack> = pattern_tokens
        .iter()
        .map(|token| {
            if token.starts_with("minmax(") {
                parse_minmax(token)
            } else {
                parse_single_track_value(token)
            }
        })
        .collect();

    let mut is_auto_fit = false;
    let repeat_count: usize;

    if count_str == "auto-fill" || count_str == "auto-fit" {
        is_auto_fit = count_str == "auto-fit";
        // 패턴 당 최소 크기 합산 (minmax→min, px→size, 그 외 0).
        let mut pattern_min_size = 0.0f32;
        for track in &pattern_tracks {
            match track.unit {
                TrackUnit::Minmax => pattern_min_size += track.min,
                TrackUnit::Px => pattern_min_size += track.size,
                _ => {}
            }
        }

        if pattern_min_size <= 0.0 {
            repeat_count = 1;
        } else {
            let effective_gap = gap * pattern_tracks.len() as f32;
            let n = ((container_size + gap) / (pattern_min_size + effective_gap)).floor();
            repeat_count = (n.max(1.0)) as usize;
        }
    } else {
        repeat_count = count_str.parse::<usize>().unwrap_or(1).max(1);
    }

    let mut tracks: Vec<GridTrack> = Vec::with_capacity(repeat_count * pattern_tracks.len());
    for _ in 0..repeat_count {
        for track in &pattern_tracks {
            tracks.push(track.clone());
        }
    }

    (tracks, is_auto_fit)
}

// ─── 트랙 크기 해결 (§7 track sizing 근사) ──────────────────────────────

/// 파싱된 트랙 배열의 size 를 확정. fixed(px/%) 합산 → 남은 공간을 fr/auto/minmax(fr) 분배.
/// (GridLayout.utils.ts resolveGridTracks 동일 — auto=1fr 근사, intrinsic 미측정)
fn resolve_grid_tracks(tracks: &mut [GridTrack], container_size: f32, gap: f32) {
    if tracks.is_empty() {
        return;
    }

    let total_gap = gap * (tracks.len() as f32 - 1.0);
    let mut fixed_size = 0.0f32;
    let mut fr_total = 0.0f32;

    // 1단계: 고정 크기 합산 (% 해결 포함) + fr 총량.
    for track in tracks.iter_mut() {
        match track.unit {
            TrackUnit::Px => fixed_size += track.size,
            TrackUnit::Percent => {
                let px = (track.fr_value / 100.0) * container_size;
                track.size = px;
                fixed_size += px;
            }
            TrackUnit::Fr => fr_total += track.fr_value, // fr_value 는 파싱 시 ≥1 보장
            TrackUnit::Auto => fr_total += 1.0, // auto = 1fr 근사
            TrackUnit::Minmax => {
                fixed_size += track.min;
                if track.max < 0.0 {
                    fr_total += track.max.abs();
                }
            }
        }
    }

    // 2단계: 남은 공간을 fr 풀에 분배.
    let remaining = (container_size - fixed_size - total_gap).max(0.0);
    let fr_size = if fr_total > 0.0 {
        remaining / fr_total
    } else {
        0.0
    };

    for track in tracks.iter_mut() {
        match track.unit {
            // fr_value 는 파싱 시 unwrap_or(1.0) 로 최소 1 보장됨 → 그대로 분배.
            TrackUnit::Fr => track.size = fr_size * track.fr_value,
            TrackUnit::Auto => track.size = fr_size,
            TrackUnit::Minmax => {
                let min_val = track.min;
                if track.max < 0.0 {
                    // max 가 fr: min 보장 + fr 분배.
                    let fr_val = track.max.abs();
                    track.size = min_val.max(min_val + fr_size * fr_val);
                } else {
                    // max 가 px: min 과 max 사이 clamp.
                    track.size = track.max.min(min_val.max(min_val + fr_size));
                }
            }
            _ => {} // px, % 이미 확정
        }
    }
}

// ─── 공개 API: track 파싱 ───────────────────────────────────────────────

/// CSS grid-template 문자열을 해결된 트랙 크기(px) 배열로 파싱.
/// repeat()/minmax()/px/fr/%/auto 지원. (grid_layout.rs parse_tracks 승계 + 확장)
///
/// # Arguments
/// * `template` — CSS grid template (예: "repeat(auto-fill, minmax(200px, 1fr))")
/// * `available` — 축 가용 공간 (px)
/// * `gap` — 트랙 간 gap (px)
#[wasm_bindgen]
pub fn parse_tracks(template: &str, available: f32, gap: f32) -> Box<[f32]> {
    let trimmed = template.trim();
    if trimmed.is_empty() {
        return Vec::new().into_boxed_slice();
    }

    let mut tracks = parse_template_to_tracks(trimmed, available, gap);
    resolve_grid_tracks(&mut tracks, available, gap);

    tracks
        .iter()
        .map(|t| t.size)
        .collect::<Vec<f32>>()
        .into_boxed_slice()
}

/// 내부: 문자열 → 미해결 GridTrack 배열 (repeat 전개 포함, resolve 전).
fn parse_template_to_tracks(template: &str, container_size: f32, gap: f32) -> Vec<GridTrack> {
    let tokens = tokenize_template(template.trim());
    let mut tracks: Vec<GridTrack> = Vec::new();

    for token in &tokens {
        if token.starts_with("repeat(") {
            let (expanded, _is_auto_fit) = expand_repeat(token, container_size, gap);
            tracks.extend(expanded);
        } else if token.starts_with("minmax(") {
            tracks.push(parse_minmax(token));
        } else {
            tracks.push(parse_single_track_value(token));
        }
    }

    tracks
}

// ─── named grid-template-areas ──────────────────────────────────────────

/// 이름 영역 → grid line 범위. (rowStart, rowEnd, colStart, colEnd) 1-based.
#[derive(Clone, Copy, Debug)]
struct AreaRect {
    row_start: i32,
    row_end: i32,
    col_start: i32,
    col_end: i32,
}

/// grid-template-areas 문자열을 이름→영역 맵으로 파싱.
/// 입력: `"header header" "sidebar main" "footer footer"`
/// (GridLayout.utils.ts parseGridTemplateAreas 동일 — 인접 셀 병합)
fn parse_template_areas(template: &str) -> Vec<(String, AreaRect)> {
    let mut areas: Vec<(String, AreaRect)> = Vec::new();
    // `"..."` 로 감싼 각 행 추출.
    let mut row_index = 0i32;
    let mut in_quote = false;
    let mut row_buf = String::new();

    let mut rows: Vec<String> = Vec::new();
    for ch in template.chars() {
        if ch == '"' {
            if in_quote {
                rows.push(std::mem::take(&mut row_buf));
                in_quote = false;
            } else {
                in_quote = true;
            }
        } else if in_quote {
            row_buf.push(ch);
        }
    }

    for row in &rows {
        let cells: Vec<&str> = row.split_whitespace().collect();
        for (col_index, cell_name) in cells.iter().enumerate() {
            if *cell_name == "." {
                continue;
            }
            let ci = col_index as i32;
            // 기존 영역이면 end 확장 (병합), 아니면 신규.
            if let Some(entry) = areas.iter_mut().find(|(n, _)| n == cell_name) {
                entry.1.row_end = entry.1.row_end.max(row_index + 2);
                entry.1.col_end = entry.1.col_end.max(ci + 2);
            } else {
                areas.push((
                    cell_name.to_string(),
                    AreaRect {
                        row_start: row_index + 1,
                        row_end: row_index + 2,
                        col_start: ci + 1,
                        col_end: ci + 2,
                    },
                ));
            }
        }
        row_index += 1;
    }

    areas
}

// ─── gridColumn / gridRow line 파싱 → parse_axis_placement (place_children 앞에 정의) ───
// (구 parse_grid_line 은 E13/ADR-156 Phase 3 에서 제거 — 위치 명시 여부와 span 을 분리하는
//  parse_axis_placement 로 대체해 occupancy 커서가 span 점유를 반영한다.)

// ─── cell 배치 ─────────────────────────────────────────────────────────

/// row-major auto-placement 로 자식 셀 위치/크기 계산.
/// (grid_layout.rs calculate_cell_positions 승계 — gridArea/gridColumn/Row 배치는
///  별도 grid_place_children 로 확장)
///
/// # Returns
/// Float32Array: [x, y, w, h, ...] 자식당 4값
#[wasm_bindgen]
pub fn calculate_cell_positions(
    tracks_x: &[f32],
    tracks_y: &[f32],
    col_gap: f32,
    row_gap: f32,
    child_count: u32,
) -> Box<[f32]> {
    let cols = tracks_x.len().max(1);
    let child_count = child_count as usize;
    if child_count == 0 {
        return Vec::new().into_boxed_slice();
    }

    // 열 x 위치 누적.
    let mut col_x = Vec::with_capacity(cols);
    let mut x_acc = 0.0f32;
    for (i, &w) in tracks_x.iter().enumerate() {
        col_x.push(x_acc);
        x_acc += w;
        if i < cols - 1 {
            x_acc += col_gap;
        }
    }

    // 행 y 위치 누적.
    let rows = tracks_y.len().max(1);
    let mut row_y = Vec::with_capacity(rows);
    let mut y_acc = 0.0f32;
    for (i, &h) in tracks_y.iter().enumerate() {
        row_y.push(y_acc);
        y_acc += h;
        if i < rows - 1 {
            y_acc += row_gap;
        }
    }

    let mut result = Vec::with_capacity(child_count * 4);
    for i in 0..child_count {
        let col = i % cols;
        let row = i / cols;
        let x = if col < col_x.len() { col_x[col] } else { 0.0 };
        let y = if row < row_y.len() { row_y[row] } else { 0.0 };
        let w = if col < tracks_x.len() {
            tracks_x[col]
        } else if !tracks_x.is_empty() {
            tracks_x[0]
        } else {
            100.0
        };
        let h = if row < tracks_y.len() {
            tracks_y[row]
        } else if !tracks_y.is_empty() {
            tracks_y[0]
        } else {
            100.0
        };
        result.push(x);
        result.push(y);
        result.push(w);
        result.push(h);
    }

    result.into_boxed_slice()
}

/// span/gridArea 를 반영한 단일 자식 셀 bounds 계산 (내부).
/// (GridLayout.utils.ts calculateGridCellBounds 동일)
#[allow(clippy::too_many_arguments)]
fn cell_bounds_for_child(
    col_start: i32,
    col_end: i32,
    row_start: i32,
    row_end: i32,
    tracks_x: &[f32],
    tracks_y: &[f32],
    col_gap: f32,
    row_gap: f32,
) -> (f32, f32, f32, f32) {
    // x: colStart 이전 트랙 + gap 누적.
    let mut x = 0.0f32;
    for i in 0..(col_start - 1).max(0) {
        let idx = i as usize;
        x += tracks_x.get(idx).copied().unwrap_or(0.0);
        if i < col_start - 1 {
            x += col_gap;
        }
    }

    let mut y = 0.0f32;
    for i in 0..(row_start - 1).max(0) {
        let idx = i as usize;
        y += tracks_y.get(idx).copied().unwrap_or(0.0);
        if i < row_start - 1 {
            y += row_gap;
        }
    }

    // width: colStart..colEnd 트랙 + 내부 gap 누적.
    let mut width = 0.0f32;
    for i in (col_start - 1).max(0)..(col_end - 1).max(0) {
        let idx = i as usize;
        width += tracks_x.get(idx).copied().unwrap_or(0.0);
        if i < col_end - 2 {
            width += col_gap;
        }
    }

    let mut height = 0.0f32;
    for i in (row_start - 1).max(0)..(row_end - 1).max(0) {
        let idx = i as usize;
        height += tracks_y.get(idx).copied().unwrap_or(0.0);
        if i < row_end - 2 {
            height += row_gap;
        }
    }

    if width == 0.0 {
        width = tracks_x.first().copied().unwrap_or(100.0);
    }
    if height == 0.0 {
        height = tracks_y.first().copied().unwrap_or(100.0);
    }

    (x, y, width, height)
}

/// 자식 배치 명세 (내부 계산용 입력).
#[derive(Clone, Debug, Default)]
struct ChildPlacement {
    /// gridArea 이름 (있으면 named area 조회). 빈 문자열이면 미사용.
    area_name: String,
    /// 숫자 gridArea "r/c/r/c" 또는 gridColumn/gridRow. 빈 문자열이면 auto-placement.
    grid_column: String,
    grid_row: String,
}

/// gridColumn/gridRow 한 축 문자열 → `(명시 start line, span)`. `None` = auto 위치.
///
/// E13(ADR-156 Phase 3): 기존 `parse_grid_line` 은 `(start, end)` 를 주되 auto 위치를
/// child_index 로 강제해 **span 을 점유로 반영하지 못했다** (span 2 뒤 자식이 옆에 겹침).
/// 본 헬퍼는 위치 명시 여부와 span 을 분리해, occupancy 커서가 점유 셀을 스킵하게 한다.
/// - `""` / `"auto"` → `(None, 1)`
/// - `"2"` → `(Some(2), 1)`
/// - `"1 / 3"` → `(Some(1), 2)`  (end-start=span)
/// - `"span 2"` → `(None, 2)`
/// - `"1 / span 2"` → `(Some(1), 2)`
/// - `"span 2 / 4"` → `(Some(2), 2)`  (end 고정 → start=end-span)
fn parse_axis_placement(value: &str) -> (Option<i32>, i32) {
    let v = value.trim();
    if v.is_empty() || v.eq_ignore_ascii_case("auto") {
        return (None, 1);
    }
    let span_of = |s: &str| {
        s.trim_start_matches("span")
            .trim()
            .parse::<i32>()
            .unwrap_or(1)
            .max(1)
    };
    if let Some(slash) = v.find('/') {
        let a = v[..slash].trim();
        let b = v[slash + 1..].trim();
        let a_span = a.starts_with("span");
        let b_span = b.starts_with("span");
        return match (a_span, b_span) {
            // "span N / end" → end 고정, start=end-N
            (true, false) => {
                let span = span_of(a);
                (b.parse::<i32>().ok().map(|e| e - span), span)
            }
            // "start / span N"
            (false, true) => (a.parse::<i32>().ok(), span_of(b)),
            // "span N / span M" → 위치 auto, span=첫째
            (true, true) => (None, span_of(a)),
            // "start / end" 숫자
            (false, false) => match (a.parse::<i32>().ok(), b.parse::<i32>().ok()) {
                (Some(s), Some(e)) => (Some(s), (e - s).max(1)),
                (Some(s), None) => (Some(s), 1),
                _ => (None, 1),
            },
        };
    }
    if v.starts_with("span") {
        return (None, span_of(v));
    }
    (v.parse::<i32>().ok(), 1)
}

/// span 블록이 (row0,col0)에서 점유 없이 열 범위 안에 들어가는가.
fn block_fits(occ: &HashSet<(i32, i32)>, r0: i32, c0: i32, rs: i32, cs: i32, cols: i32) -> bool {
    if c0 < 1 || c0 + cs - 1 > cols {
        return false;
    }
    for r in r0..r0 + rs {
        for c in c0..c0 + cs {
            if occ.contains(&(r, c)) {
                return false;
            }
        }
    }
    true
}

fn mark_block(occ: &mut HashSet<(i32, i32)>, r0: i32, c0: i32, rs: i32, cs: i32) {
    for r in r0..r0 + rs {
        for c in c0..c0 + cs {
            occ.insert((r, c));
        }
    }
}

/// 자식 placement 의도 — (열 명시 start, 열 span, 행 명시 start, 행 span). None=해당 축 auto.
struct PlacementIntent {
    col_start: Option<i32>,
    col_span: i32,
    row_start: Option<i32>,
    row_span: i32,
}

/// ChildPlacement 문자열 → PlacementIntent (area 이름 / 숫자 gridArea / gridColumn·Row).
fn resolve_placement_intent(p: &ChildPlacement, areas: &[(String, AreaRect)]) -> PlacementIntent {
    if !p.area_name.is_empty() {
        if let Some((_, rect)) = areas.iter().find(|(n, _)| n == &p.area_name) {
            return PlacementIntent {
                col_start: Some(rect.col_start),
                col_span: (rect.col_end - rect.col_start).max(1),
                row_start: Some(rect.row_start),
                row_span: (rect.row_end - rect.row_start).max(1),
            };
        }
    } else if p.grid_column.matches('/').count() == 3 {
        // 숫자 gridArea shorthand "r / c / r / c".
        let parts: Vec<&str> = p.grid_column.split('/').map(|s| s.trim()).collect();
        let rs: i32 = parts[0].parse().unwrap_or(1);
        let cs: i32 = parts[1].parse().unwrap_or(1);
        let re: i32 = parts[2].parse().unwrap_or(rs + 1);
        let ce: i32 = parts[3].parse().unwrap_or(cs + 1);
        return PlacementIntent {
            col_start: Some(cs),
            col_span: (ce - cs).max(1),
            row_start: Some(rs),
            row_span: (re - rs).max(1),
        };
    }
    let (col_start, col_span) = parse_axis_placement(&p.grid_column);
    let (row_start, row_span) = parse_axis_placement(&p.grid_row);
    PlacementIntent { col_start, col_span, row_start, row_span }
}

/// tracks + placement 배열로 모든 자식 bounds 계산. gridArea 이름/숫자, gridColumn/Row span,
/// **occupancy 기반 2-phase auto-placement**(CSS-GRID-1 §8.5, grid-auto-flow:row sparse)를
/// 통합 처리한다.
///
/// E13(ADR-156 Phase 3): 이전 구현은 auto 위치를 `child_index % cols` 로 계산해 span 점유를
/// 무시했다 (span 2 자식 뒤 자식이 겹침). CSS §8.5 는 **정의된 row 를 가진 아이템을 먼저**
/// 배치하고(step 2), **fully-auto 아이템을 커서로 나중에** 배치한다(step 4) — 단일 패스는
/// 이 순서를 못 지켜 row-span 아이템과 auto 아이템의 열이 뒤바뀐다(실측: a.x 100↔rspan.x 0).
/// 따라서 2-phase 로 처리한다:
///   Phase 0 — 명시 row 아이템(fully-definite + definite-row-auto-col): row band 첫 free 열.
///   Phase 1 — 나머지(definite-col-auto-row + fully-auto): 커서 row-major 스캔.
fn place_children(
    placements: &[ChildPlacement],
    tracks_x: &[f32],
    tracks_y: &[f32],
    col_gap: f32,
    row_gap: f32,
    areas: &[(String, AreaRect)],
) -> Vec<(f32, f32, f32, f32)> {
    let cols = tracks_x.len().max(1) as i32;
    let items: Vec<PlacementIntent> = placements
        .iter()
        .map(|p| resolve_placement_intent(p, areas))
        .collect();

    let mut occ: HashSet<(i32, i32)> = HashSet::new();
    let mut resolved: Vec<Option<(i32, i32)>> = vec![None; items.len()];

    // ── Phase 0: 명시 row 아이템 (CSS §8.5 step 1+2) ──
    for (i, it) in items.iter().enumerate() {
        let Some(r) = it.row_start else { continue };
        let c = if let Some(c) = it.col_start {
            c // fully-definite
        } else {
            // definite-row-auto-col: row band 첫 free 열.
            let mut c = 1;
            while !block_fits(&occ, r, c, it.row_span, it.col_span, cols) && c <= cols {
                c += 1;
            }
            c.min(cols.max(1))
        };
        mark_block(&mut occ, r, c, it.row_span, it.col_span);
        resolved[i] = Some((r, c));
    }

    // ── Phase 1: 나머지 (auto row) — 커서 row-major sparse (CSS §8.5 step 4) ──
    let mut cur_row = 1i32;
    let mut cur_col = 1i32;
    for (i, it) in items.iter().enumerate() {
        if resolved[i].is_some() {
            continue;
        }
        if let Some(c) = it.col_start {
            // definite-col-auto-row: 커서 row 부터 그 열에서 첫 free.
            let mut r = cur_row;
            while !block_fits(&occ, r, c, it.row_span, it.col_span, cols) && r < cur_row + 10_000 {
                r += 1;
            }
            mark_block(&mut occ, r, c, it.row_span, it.col_span);
            resolved[i] = Some((r, c));
            cur_row = r;
            cur_col = c + it.col_span;
        } else {
            // fully-auto: 커서에서 row-major 스캔.
            let mut r = cur_row;
            let mut placed = None;
            'scan: while r < cur_row + 10_000 {
                let mut c = if r == cur_row { cur_col } else { 1 };
                while c + it.col_span - 1 <= cols.max(it.col_span) {
                    if c + it.col_span - 1 <= cols
                        && block_fits(&occ, r, c, it.row_span, it.col_span, cols)
                    {
                        placed = Some((r, c));
                        break 'scan;
                    }
                    c += 1;
                }
                r += 1;
            }
            let (r, c) = placed.unwrap_or((cur_row, 1));
            mark_block(&mut occ, r, c, it.row_span, it.col_span);
            resolved[i] = Some((r, c));
            cur_row = r;
            cur_col = c + it.col_span;
        }
        if cur_col > cols {
            cur_row += 1;
            cur_col = 1;
        }
    }

    // ── 최종 bounds (child 순서) ──
    items
        .iter()
        .enumerate()
        .map(|(i, it)| {
            let (r, c) = resolved[i].unwrap_or((1, 1));
            cell_bounds_for_child(
                c,
                c + it.col_span,
                r,
                r + it.row_span,
                tracks_x,
                tracks_y,
                col_gap,
                row_gap,
            )
        })
        .collect()
}

// ─── 컨테이너 트랙 정렬 (E12) ───────────────────────────────────────────

/// justify-content / align-content 로 트랙셋을 컨테이너 안에서 정렬 (CSS-GRID-1 §10.4/§10.5).
///
/// 트랙 총합이 컨테이너보다 작을 때(전부 고정 트랙)만 free space 가 생긴다 — fr/auto 트랙은
/// 컨테이너를 채우므로 free≈0 → 오프셋 없음. `(start_offset, extra_gap)` 반환: start_offset 은
/// 트랙셋 전체 이동, extra_gap 은 트랙 사이 추가 간격(space-*). flex `align_content_offsets` 대칭.
fn track_distribution(mode: &str, free: f32, n: usize) -> (f32, f32) {
    if free <= 0.5 || n == 0 {
        return (0.0, 0.0);
    }
    match mode.trim() {
        "center" => (free / 2.0, 0.0),
        "end" | "flex-end" => (free, 0.0),
        "space-between" => {
            if n > 1 {
                (0.0, free / (n as f32 - 1.0))
            } else {
                (free / 2.0, 0.0) // 단일 트랙 space-between → center (CSS)
            }
        }
        "space-around" => {
            let unit = free / n as f32;
            (unit / 2.0, unit)
        }
        "space-evenly" => {
            let unit = free / (n as f32 + 1.0);
            (unit, unit)
        }
        // start / flex-start / stretch / normal / 기타 → 오프셋 없음
        _ => (0.0, 0.0),
    }
}

// ─── 공개 API: 완결 grid 레이아웃 ──────────────────────────────────────

/// 자식 placement 문자열 파싱. 자식당 `area_name|grid_column|grid_row` (파이프 구분),
/// 자식 간 개행 구분. 빈 필드는 auto 로 해석. (upstream JS 가 style 을 이 형태로 직렬화)
fn parse_placements(spec: &str) -> Vec<ChildPlacement> {
    if spec.is_empty() {
        return Vec::new();
    }
    spec.split('\n')
        .map(|line| {
            let mut parts = line.split('|');
            ChildPlacement {
                area_name: parts.next().unwrap_or("").trim().to_string(),
                grid_column: parts.next().unwrap_or("").trim().to_string(),
                grid_row: parts.next().unwrap_or("").trim().to_string(),
            }
        })
        .collect()
}

/// flex_layout / block_layout 과 대칭인 grid 의 완결 공개 엔트리.
/// 문자열 template(cols/rows/areas) + 자식 placement 를 받아 최종 자식 bounds flat 배열
/// (`[x, y, w, h, ...]`, 자식당 4값) 을 반환한다.
///
/// # Arguments
/// * `template_cols` — grid-template-columns (repeat/minmax/px/fr/%/auto)
/// * `template_rows` — grid-template-rows
/// * `template_areas` — grid-template-areas (`"a b" "c d"`), 빈 문자열이면 미사용
/// * `placement_spec` — 자식 placement (`parse_placements` 형식), 빈 문자열이면 전부 auto
/// * `child_count` — 자식 수 (placement_spec 이 비면 이 수만큼 auto-placement)
/// * `available_w` / `available_h` — 컨테이너 가용 폭/높이
/// * `col_gap` / `row_gap` — 트랙 간 gap
#[wasm_bindgen]
#[allow(clippy::too_many_arguments)]
pub fn grid_layout(
    template_cols: &str,
    template_rows: &str,
    template_areas: &str,
    placement_spec: &str,
    child_count: u32,
    available_w: f32,
    available_h: f32,
    col_gap: f32,
    row_gap: f32,
    justify_content: &str,
    align_content: &str,
) -> Box<[f32]> {
    // 트랙 해결.
    let mut col_tracks = parse_template_to_tracks(template_cols.trim(), available_w, col_gap);
    resolve_grid_tracks(&mut col_tracks, available_w, col_gap);
    let mut row_tracks = parse_template_to_tracks(template_rows.trim(), available_h, row_gap);
    resolve_grid_tracks(&mut row_tracks, available_h, row_gap);

    let tracks_x: Vec<f32> = col_tracks.iter().map(|t| t.size).collect();
    let tracks_y: Vec<f32> = row_tracks.iter().map(|t| t.size).collect();

    // named areas.
    let areas = if template_areas.trim().is_empty() {
        Vec::new()
    } else {
        parse_template_areas(template_areas)
    };

    // placement (없으면 child_count 만큼 auto-placement).
    let placements = if placement_spec.trim().is_empty() {
        vec![ChildPlacement::default(); child_count as usize]
    } else {
        parse_placements(placement_spec)
    };

    // ── E12: 컨테이너 트랙 정렬 (justify-content / align-content) ──
    // 트랙 총합 < 컨테이너(고정 트랙)일 때만 free space → 오프셋/추가 gap. fr/auto 는 free≈0.
    // available 이 음수(indefinite)면 free 음수 → 분배 없음(auto 축은 정렬 대상 아님).
    let n_cols = tracks_x.len();
    let n_rows = tracks_y.len();
    let total_x: f32 =
        tracks_x.iter().sum::<f32>() + col_gap * n_cols.saturating_sub(1) as f32;
    let total_y: f32 =
        tracks_y.iter().sum::<f32>() + row_gap * n_rows.saturating_sub(1) as f32;
    let (off_x, extra_col_gap) = track_distribution(justify_content, available_w - total_x, n_cols);
    let (off_y, extra_row_gap) = track_distribution(align_content, available_h - total_y, n_rows);

    let bounds = place_children(
        &placements,
        &tracks_x,
        &tracks_y,
        col_gap + extra_col_gap,
        row_gap + extra_row_gap,
        &areas,
    );

    let mut out = Vec::with_capacity(bounds.len() * 4);
    for (x, y, w, h) in bounds {
        out.push(x + off_x);
        out.push(y + off_y);
        out.push(w);
        out.push(h);
    }
    out.into_boxed_slice()
}

#[cfg(test)]
mod tests {
    use super::*;

    fn approx_eq(a: f32, b: f32) -> bool {
        (a - b).abs() < 0.01
    }

    // ── 승계 (grid_layout.rs) — track 산술 11 ──────────────────────────

    #[test]
    fn test_parse_tracks_fr() {
        let result = parse_tracks("1fr 2fr", 300.0, 0.0);
        assert_eq!(result.len(), 2);
        assert!(approx_eq(result[0], 100.0));
        assert!(approx_eq(result[1], 200.0));
    }

    #[test]
    fn test_parse_tracks_px() {
        let result = parse_tracks("100px 200px", 400.0, 0.0);
        assert_eq!(result.len(), 2);
        assert!(approx_eq(result[0], 100.0));
        assert!(approx_eq(result[1], 200.0));
    }

    #[test]
    fn test_parse_tracks_mixed() {
        let result = parse_tracks("100px 1fr 2fr", 400.0, 0.0);
        assert_eq!(result.len(), 3);
        assert!(approx_eq(result[0], 100.0));
        assert!(approx_eq(result[1], 100.0)); // 300 remaining / 3fr * 1fr
        assert!(approx_eq(result[2], 200.0)); // 300 remaining / 3fr * 2fr
    }

    #[test]
    fn test_parse_tracks_percent() {
        let result = parse_tracks("50% 1fr", 400.0, 0.0);
        assert_eq!(result.len(), 2);
        assert!(approx_eq(result[0], 200.0));
        assert!(approx_eq(result[1], 200.0));
    }

    #[test]
    fn test_parse_tracks_auto() {
        let result = parse_tracks("auto auto", 400.0, 0.0);
        assert_eq!(result.len(), 2);
        assert!(approx_eq(result[0], 200.0));
        assert!(approx_eq(result[1], 200.0));
    }

    #[test]
    fn test_parse_tracks_with_gap() {
        let result = parse_tracks("1fr 1fr", 400.0, 20.0);
        assert_eq!(result.len(), 2);
        // available - gap = 380, / 2 = 190
        assert!(approx_eq(result[0], 190.0));
        assert!(approx_eq(result[1], 190.0));
    }

    #[test]
    fn test_parse_tracks_empty() {
        let result = parse_tracks("", 400.0, 0.0);
        assert_eq!(result.len(), 0);
    }

    #[test]
    fn test_cell_positions_basic() {
        let tracks_x = [100.0, 200.0];
        let tracks_y = [50.0, 60.0];
        let result = calculate_cell_positions(&tracks_x, &tracks_y, 0.0, 0.0, 4);
        assert_eq!(result.len(), 16);
        assert!(approx_eq(result[0], 0.0)); // child0 x
        assert!(approx_eq(result[1], 0.0)); // child0 y
        assert!(approx_eq(result[2], 100.0)); // child0 w
        assert!(approx_eq(result[3], 50.0)); // child0 h
        assert!(approx_eq(result[4], 100.0)); // child1 x
        assert!(approx_eq(result[6], 200.0)); // child1 w
        assert!(approx_eq(result[8], 0.0)); // child2 x
        assert!(approx_eq(result[9], 50.0)); // child2 y
        assert!(approx_eq(result[12], 100.0)); // child3 x
        assert!(approx_eq(result[13], 50.0)); // child3 y
    }

    #[test]
    fn test_cell_positions_with_gap() {
        let tracks_x = [100.0, 200.0];
        let tracks_y = [50.0, 60.0];
        let result = calculate_cell_positions(&tracks_x, &tracks_y, 10.0, 20.0, 4);
        assert!(approx_eq(result[4], 110.0)); // child1 x = 100 + 10 gap
        assert!(approx_eq(result[9], 70.0)); // child2 y = 50 + 20 gap
    }

    #[test]
    fn test_cell_positions_empty() {
        let tracks_x = [100.0];
        let tracks_y = [50.0];
        let result = calculate_cell_positions(&tracks_x, &tracks_y, 0.0, 0.0, 0);
        assert_eq!(result.len(), 0);
    }

    // ── 확장 (GridLayout.utils.ts) — repeat/minmax/areas/span ────────────

    #[test]
    fn test_repeat_fixed_count() {
        // repeat(3, 1fr) at 300 → [100, 100, 100]
        let result = parse_tracks("repeat(3, 1fr)", 300.0, 0.0);
        assert_eq!(result.len(), 3);
        assert!(approx_eq(result[0], 100.0));
        assert!(approx_eq(result[1], 100.0));
        assert!(approx_eq(result[2], 100.0));
    }

    #[test]
    fn test_repeat_pattern() {
        // repeat(2, 100px 1fr) at 400 → [100, fr, 100, fr]. fixed=200, remaining=200, 2fr → 100 each
        let result = parse_tracks("repeat(2, 100px 1fr)", 400.0, 0.0);
        assert_eq!(result.len(), 4);
        assert!(approx_eq(result[0], 100.0));
        assert!(approx_eq(result[1], 100.0));
        assert!(approx_eq(result[2], 100.0));
        assert!(approx_eq(result[3], 100.0));
    }

    #[test]
    fn test_repeat_auto_fill_minmax() {
        // repeat(auto-fill, minmax(200px, 1fr)) at 640, gap 0
        // patternMin=200 → N = floor(640/200) = 3
        let result = parse_tracks("repeat(auto-fill, minmax(200px, 1fr))", 640.0, 0.0);
        assert_eq!(result.len(), 3);
        // 3 tracks, each min 200 + fr 분배. fixed=600, remaining=40, 3fr → +13.3 each ≈ 213.3
        assert!(approx_eq(result[0], 213.333));
    }

    #[test]
    fn test_minmax_fr_max() {
        // minmax(100px, 1fr) 200px at 500. minmax min=100 + fr, fixed=100+200=300, remaining=200, 1fr → 100
        // → minmax = max(100, 100+200) = 300; 200px = 200
        let result = parse_tracks("minmax(100px, 1fr) 200px", 500.0, 0.0);
        assert_eq!(result.len(), 2);
        assert!(approx_eq(result[0], 300.0));
        assert!(approx_eq(result[1], 200.0));
    }

    #[test]
    fn test_minmax_px_max_clamp() {
        // minmax(100px, 150px) 1fr at 400. minmax fixed min=100, 1fr pool.
        // fixed=100, remaining=300, 1fr(minmax는 max px라 fr풀 미참여, 1fr만) → fr_size=300
        // minmax = min(150, max(100, 100+300)) = min(150, 400) = 150; 1fr = 300
        let result = parse_tracks("minmax(100px, 150px) 1fr", 400.0, 0.0);
        assert_eq!(result.len(), 2);
        assert!(approx_eq(result[0], 150.0));
        assert!(approx_eq(result[1], 300.0));
    }

    #[test]
    fn test_template_areas_parse() {
        let areas = parse_template_areas("\"header header\" \"sidebar main\" \"footer footer\"");
        // header: row 1, cols 1-3 (병합)
        let header = areas.iter().find(|(n, _)| n == "header").unwrap();
        assert_eq!(header.1.row_start, 1);
        assert_eq!(header.1.row_end, 2);
        assert_eq!(header.1.col_start, 1);
        assert_eq!(header.1.col_end, 3);
        // main: row 2, col 2
        let main = areas.iter().find(|(n, _)| n == "main").unwrap();
        assert_eq!(main.1.row_start, 2);
        assert_eq!(main.1.col_start, 2);
    }

    #[test]
    fn test_axis_placement_span() {
        // (명시 start, span) 분리 — E13 occupancy 커서 입력.
        assert_eq!(parse_axis_placement("span 2"), (None, 2)); // 위치 auto, span 2
        assert_eq!(parse_axis_placement("1 / 3"), (Some(1), 2)); // start 1, span 2
        assert_eq!(parse_axis_placement("1 / span 3"), (Some(1), 3));
        assert_eq!(parse_axis_placement("span 2 / 5"), (Some(3), 2)); // end 5 고정 → start 3
        assert_eq!(parse_axis_placement("2"), (Some(2), 1));
        assert_eq!(parse_axis_placement(""), (None, 1));
        assert_eq!(parse_axis_placement("auto"), (None, 1));
    }

    #[test]
    fn test_place_children_auto() {
        // 2열, 4 자식 auto-placement. tracks_x=[100,100] tracks_y=[50,50]
        let placements = vec![ChildPlacement::default(); 4];
        let areas: Vec<(String, AreaRect)> = Vec::new();
        let result = place_children(&placements, &[100.0, 100.0], &[50.0, 50.0], 0.0, 0.0, &areas);
        assert_eq!(result.len(), 4);
        assert_eq!(result[0], (0.0, 0.0, 100.0, 50.0)); // child0 (0,0)
        assert_eq!(result[1], (100.0, 0.0, 100.0, 50.0)); // child1 (1,0)
        assert_eq!(result[2], (0.0, 50.0, 100.0, 50.0)); // child2 (0,1)
        assert_eq!(result[3], (100.0, 50.0, 100.0, 50.0)); // child3 (1,1)
    }

    #[test]
    fn test_place_children_span() {
        // child0 gridColumn "1 / 3" (2칸 span). tracks_x=[100,100] gap 0
        let mut placements = vec![ChildPlacement::default(); 1];
        placements[0].grid_column = "1 / 3".to_string();
        let areas: Vec<(String, AreaRect)> = Vec::new();
        let result = place_children(&placements, &[100.0, 100.0], &[50.0], 0.0, 0.0, &areas);
        // colStart 1, colEnd 3 → width = track0 + track1 = 200
        assert!(approx_eq(result[0].2, 200.0));
    }

    #[test]
    fn test_place_children_named_area() {
        let areas = parse_template_areas("\"header header\" \"sidebar main\"");
        let mut placements = vec![ChildPlacement::default(); 1];
        placements[0].area_name = "header".to_string();
        let result = place_children(&placements, &[100.0, 100.0], &[50.0, 50.0], 0.0, 0.0, &areas);
        // header: col 1-3, row 1-2 → x=0 y=0 w=200 h=50
        assert!(approx_eq(result[0].0, 0.0));
        assert!(approx_eq(result[0].1, 0.0));
        assert!(approx_eq(result[0].2, 200.0));
        assert!(approx_eq(result[0].3, 50.0));
    }

    // ── 완결 엔트리 grid_layout (flex_layout/block_layout 대칭) ─────────

    #[test]
    fn test_grid_layout_auto_placement() {
        // 2열 grid, 4 자식 auto. cols "1fr 1fr" at 200 → [100,100], rows "50px 50px"
        let out = grid_layout("1fr 1fr", "50px 50px", "", "", 4, 200.0, 100.0, 0.0, 0.0, "", "");
        assert_eq!(out.len(), 16);
        // child0 (0,0)
        assert!(approx_eq(out[0], 0.0));
        assert!(approx_eq(out[1], 0.0));
        assert!(approx_eq(out[2], 100.0));
        assert!(approx_eq(out[3], 50.0));
        // child3 (1,1) → x=100 y=50
        assert!(approx_eq(out[12], 100.0));
        assert!(approx_eq(out[13], 50.0));
    }

    #[test]
    fn test_grid_layout_span_occupancy() {
        // E13: 2열 grid. child0 = column span 2 (1행 전체 점유). child1/child2 auto 는
        //   점유를 스킵해 2행에 배치돼야 한다 (구현 전엔 child_index%cols 로 child1 이
        //   (1행,2열)에 겹쳤다).
        let out = grid_layout("1fr 1fr", "50px 50px", "", "|span 2|\n||\n||", 3, 200.0, 100.0, 0.0, 0.0, "", "");
        assert_eq!(out.len(), 12);
        // child0: col span 2 → x=0 w=200, row1 → y=0
        assert!(approx_eq(out[0], 0.0));
        assert!(approx_eq(out[1], 0.0));
        assert!(approx_eq(out[2], 200.0));
        // child1: span 점유 회피 → 2행 1열 (x=0 y=50)
        assert!(approx_eq(out[4], 0.0));
        assert!(approx_eq(out[5], 50.0));
        // child2: 2행 2열 (x=100 y=50)
        assert!(approx_eq(out[8], 100.0));
        assert!(approx_eq(out[9], 50.0));
    }

    #[test]
    fn test_grid_layout_named_areas() {
        // header 가 첫 행 전체 span. cols "1fr 1fr" at 200, rows "40px 60px", areas 2행
        let out = grid_layout(
            "1fr 1fr",
            "40px 60px",
            "\"header header\" \"side main\"",
            "header", // 자식0 = header area
            1,
            200.0,
            100.0,
            0.0,
            0.0,
            "",
            "",
        );
        assert_eq!(out.len(), 4);
        // header: col 1-3 → w=200, row 1-2 → h=40
        assert!(approx_eq(out[0], 0.0));
        assert!(approx_eq(out[1], 0.0));
        assert!(approx_eq(out[2], 200.0));
        assert!(approx_eq(out[3], 40.0));
    }

    #[test]
    fn test_grid_layout_repeat_autofill() {
        // repeat(auto-fill, minmax(200px, 1fr)) at 640 → 3 트랙. 3 자식 auto row-major.
        let out = grid_layout(
            "repeat(auto-fill, minmax(200px, 1fr))",
            "100px",
            "",
            "",
            3,
            640.0,
            100.0,
            0.0,
            0.0,
            "",
            "",
        );
        assert_eq!(out.len(), 12);
        // 3 트랙 각 ≈213.33. child0 x=0, child1 x≈213.33, child2 x≈426.67
        assert!(approx_eq(out[0], 0.0));
        assert!(approx_eq(out[4], 213.333));
        assert!(approx_eq(out[8], 426.667));
    }

    #[test]
    fn test_grid_layout_placement_spec_span() {
        // 자식0 gridColumn "1 / 3" span 2. cols "100px 100px", 개행 placement.
        let out = grid_layout("100px 100px", "50px", "", "|1 / 3|", 1, 200.0, 50.0, 0.0, 0.0, "", "");
        assert_eq!(out.len(), 4);
        // colStart 1 colEnd 3 → width 200
        assert!(approx_eq(out[2], 200.0));
    }

    #[test]
    fn test_grid_layout_justify_content_center() {
        // E12: 고정 트랙 100+100=200, 컨테이너 300 → free 100. justify-content:center → offset 50.
        let out = grid_layout("100px 100px", "50px", "", "", 2, 300.0, 50.0, 0.0, 0.0, "center", "");
        assert_eq!(out.len(), 8);
        assert!(approx_eq(out[0], 50.0)); // child0 x = free/2
        assert!(approx_eq(out[4], 150.0)); // child1 x = 50 + 100
    }

    #[test]
    fn test_grid_layout_justify_content_space_between() {
        // E12: 고정 트랙 100+100, 컨테이너 300 → free 100. space-between(n=2) → gap += 100.
        let out = grid_layout(
            "100px 100px", "50px", "", "", 2, 300.0, 50.0, 0.0, 0.0, "space-between", "",
        );
        assert!(approx_eq(out[0], 0.0)); // child0 x=0
        assert!(approx_eq(out[4], 200.0)); // child1 x = track0(100) + extra gap(100)
    }

    #[test]
    fn test_grid_layout_fr_no_justify_offset() {
        // fr 트랙은 컨테이너를 채워 free≈0 → justify-content 무효(오프셋 0).
        let out = grid_layout("1fr 1fr", "50px", "", "", 2, 300.0, 50.0, 0.0, 0.0, "center", "");
        assert!(approx_eq(out[0], 0.0)); // 오프셋 없음
        assert!(approx_eq(out[4], 150.0)); // 각 트랙 150
    }
}
