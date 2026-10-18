use std::cell::Cell;
use std::collections::{HashMap, HashSet};
use wasm_bindgen::prelude::*;

/// Grid-cell based spatial index for O(k) viewport culling and lasso selection.
///
/// Elements are stored in scene coordinates. Queries transform viewport/lasso
/// bounds to scene space before lookup.
///
/// Cell key encoding: `(cx as i64) << 32 | (cy as u32 as i64)`
#[wasm_bindgen]
pub struct SpatialIndex {
    cell_size: f32,
    /// cell_key → list of element IDs in that cell
    cells: HashMap<i64, Vec<u32>>,
    /// element_id → list of cell keys it occupies
    element_cells: HashMap<u32, Vec<i64>>,
    /// element_id → [x, y, width, height] cached bounds
    bounds: HashMap<u32, [f32; 4]>,
    /// ADR-272 Phase 0 — 결정적 카운트 (질의는 `&self` 라 Cell). `take_query_stat` 이 읽고 0 으로.
    stats: QueryStats,
}

#[derive(Default)]
struct QueryStats {
    /// 사각형 질의 수 (`query_viewport` · `query_rect`).
    queries: Cell<u64>,
    /// 사각형 질의가 지난 셀 좌표 수 (빈 셀 포함).
    cells_visited: Cell<u64>,
    /// 셀 안 항목 방문 수 (dedup 전).
    items_visited: Cell<u64>,
    /// 질의 결과 수.
    results: Cell<u64>,
    /// `upsert` · `remove` 가 지운 옛 셀 + 넣은 새 셀 수.
    upsert_cells: Cell<u64>,
}

#[inline]
fn bump(c: &Cell<u64>, n: u64) {
    c.set(c.get() + n);
}

/// Encode grid cell coordinates into a single i64 key.
#[inline]
fn cell_key(cx: i32, cy: i32) -> i64 {
    ((cx as i64) << 32) | (cy as u32 as i64)
}

/// Axis-aligned bounding box intersection test.
#[inline]
#[allow(clippy::too_many_arguments)]
fn aabb_intersects(
    ax: f32, ay: f32, aw: f32, ah: f32,
    bx: f32, by: f32, bw: f32, bh: f32,
) -> bool {
    ax < bx + bw && ax + aw > bx && ay < by + bh && ay + ah > by
}

/// Point-in-AABB test.
#[inline]
fn aabb_contains_point(x: f32, y: f32, w: f32, h: f32, px: f32, py: f32) -> bool {
    px >= x && px <= x + w && py >= y && py <= y + h
}

#[wasm_bindgen]
impl SpatialIndex {
    /// Create a new SpatialIndex with the given cell size (in scene pixels).
    /// Recommended: 256 for typical canvas applications.
    #[wasm_bindgen(constructor)]
    pub fn new(cell_size: f32) -> SpatialIndex {
        let cell_size = if cell_size <= 0.0 { 256.0 } else { cell_size };
        SpatialIndex {
            cell_size,
            cells: HashMap::new(),
            element_cells: HashMap::new(),
            bounds: HashMap::new(),
            stats: QueryStats::default(),
        }
    }

    /// ADR-272 Phase 0 — 누적 하나 (`i`: 0 queries · 1 cellsVisited · 2 itemsVisited · 3 results · 4 upsertCells)
    /// 를 돌려주고 0 으로. 하니스 (dev) 만 부른다 — production 은 정수 증가 비용만 남는다. 배열이 아니라
    /// 스칼라인 것은 배열 반환이 glue 의 메모리 view 읽기 (`getDataViewMemory0`) 를 불러 하니스의 함수 호출 수
    /// ratchet 에 잡히기 때문이다 (`60` page-switch 180 → 184).
    pub fn take_query_stat(&self, i: u32) -> f64 {
        let s = &self.stats;
        let cell = match i {
            0 => &s.queries,
            1 => &s.cells_visited,
            2 => &s.items_visited,
            3 => &s.results,
            4 => &s.upsert_cells,
            _ => return 0.0,
        };
        cell.replace(0) as f64
    }

    /// Insert or update an element's bounds in the index.
    pub fn upsert(&mut self, id: u32, x: f32, y: f32, w: f32, h: f32) {
        // Skip zero-size elements
        if w <= 0.0 || h <= 0.0 {
            self.remove(id);
            return;
        }

        // Remove from old cells if exists
        self.remove_from_cells(id);

        // Compute occupied cells
        let cell_keys = self.compute_cells(x, y, w, h);

        // Insert into cells
        bump(&self.stats.upsert_cells, cell_keys.len() as u64);
        for &ck in &cell_keys {
            self.cells.entry(ck).or_default().push(id);
        }

        // Store element → cells mapping
        self.element_cells.insert(id, cell_keys);

        // Cache bounds
        self.bounds.insert(id, [x, y, w, h]);
    }

    /// Batch insert/update from a flat Float32Array.
    /// Format: [id, x, y, w, h, id, x, y, w, h, ...]
    /// Each record is 5 floats. The id is cast to u32.
    pub fn batch_upsert(&mut self, data: &[f32]) {
        let record_size = 5;
        let count = data.len() / record_size;

        for i in 0..count {
            let offset = i * record_size;
            let id = data[offset] as u32;
            let x = data[offset + 1];
            let y = data[offset + 2];
            let w = data[offset + 3];
            let h = data[offset + 4];
            self.upsert(id, x, y, w, h);
        }
    }

    /// Query elements intersecting a viewport rectangle (scene coordinates).
    /// Returns a deduplicated array of element IDs.
    pub fn query_viewport(&self, left: f32, top: f32, right: f32, bottom: f32) -> Box<[u32]> {
        self.query_rect_internal(left, top, right, bottom)
    }

    /// Query elements intersecting a lasso/selection rectangle (scene coordinates).
    /// Returns a deduplicated array of element IDs.
    pub fn query_rect(&self, left: f32, top: f32, right: f32, bottom: f32) -> Box<[u32]> {
        self.query_rect_internal(left, top, right, bottom)
    }

    /// Query elements containing a specific point (scene coordinates).
    /// Returns element IDs (front-to-back order not guaranteed).
    pub fn query_point(&self, px: f32, py: f32) -> Box<[u32]> {
        let cx = (px / self.cell_size).floor() as i32;
        let cy = (py / self.cell_size).floor() as i32;
        let ck = cell_key(cx, cy);

        let mut result = Vec::new();

        if let Some(ids) = self.cells.get(&ck) {
            for &id in ids {
                if let Some(b) = self.bounds.get(&id) {
                    if aabb_contains_point(b[0], b[1], b[2], b[3], px, py) {
                        result.push(id);
                    }
                }
            }
        }

        result.into_boxed_slice()
    }

    /// Remove an element from the index.
    pub fn remove(&mut self, id: u32) {
        self.remove_from_cells(id);
        self.element_cells.remove(&id);
        self.bounds.remove(&id);
    }

    /// Clear all elements from the index.
    pub fn clear(&mut self) {
        self.cells.clear();
        self.element_cells.clear();
        self.bounds.clear();
    }

    /// Return the number of indexed elements.
    pub fn count(&self) -> u32 {
        self.bounds.len() as u32
    }
}

// Private methods (not exposed to WASM)
impl SpatialIndex {
    /// Compute which grid cells an AABB occupies.
    fn compute_cells(&self, x: f32, y: f32, w: f32, h: f32) -> Vec<i64> {
        let min_cx = (x / self.cell_size).floor() as i32;
        let min_cy = (y / self.cell_size).floor() as i32;
        let max_cx = ((x + w) / self.cell_size).floor() as i32;
        let max_cy = ((y + h) / self.cell_size).floor() as i32;

        let mut keys = Vec::with_capacity(
            ((max_cx - min_cx + 1) * (max_cy - min_cy + 1)) as usize,
        );

        for cx in min_cx..=max_cx {
            for cy in min_cy..=max_cy {
                keys.push(cell_key(cx, cy));
            }
        }

        keys
    }

    /// Remove element from all cells it occupies (does not remove from element_cells/bounds).
    fn remove_from_cells(&mut self, id: u32) {
        if let Some(cell_keys) = self.element_cells.get(&id) {
            bump(&self.stats.upsert_cells, cell_keys.len() as u64);
            for &ck in cell_keys {
                if let Some(ids) = self.cells.get_mut(&ck) {
                    ids.retain(|&eid| eid != id);
                    // Clean up empty cells to prevent memory leaks
                    if ids.is_empty() {
                        self.cells.remove(&ck);
                    }
                }
            }
        }
    }

    /// Internal rect query with AABB verification and deduplication.
    fn query_rect_internal(&self, left: f32, top: f32, right: f32, bottom: f32) -> Box<[u32]> {
        let query_w = right - left;
        let query_h = bottom - top;

        if query_w <= 0.0 || query_h <= 0.0 {
            return Vec::new().into_boxed_slice();
        }

        let min_cx = (left / self.cell_size).floor() as i32;
        let min_cy = (top / self.cell_size).floor() as i32;
        let max_cx = (right / self.cell_size).floor() as i32;
        let max_cy = (bottom / self.cell_size).floor() as i32;

        let mut seen = HashSet::new();
        let mut result = Vec::new();
        let stats = &self.stats;
        bump(&stats.queries, 1);
        bump(
            &stats.cells_visited,
            (max_cx as i64 - min_cx as i64 + 1) as u64 * (max_cy as i64 - min_cy as i64 + 1) as u64,
        );

        for cx in min_cx..=max_cx {
            for cy in min_cy..=max_cy {
                let ck = cell_key(cx, cy);
                if let Some(ids) = self.cells.get(&ck) {
                    bump(&stats.items_visited, ids.len() as u64);
                    for &id in ids {
                        if seen.insert(id) {
                            // AABB verification to remove false positives
                            if let Some(b) = self.bounds.get(&id) {
                                if aabb_intersects(
                                    b[0], b[1], b[2], b[3],
                                    left, top, query_w, query_h,
                                ) {
                                    result.push(id);
                                }
                            }
                        }
                    }
                }
            }
        }

        bump(&stats.results, result.len() as u64);
        result.into_boxed_slice()
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_new() {
        let idx = SpatialIndex::new(256.0);
        assert_eq!(idx.count(), 0);
    }

    #[test]
    fn test_upsert_and_count() {
        let mut idx = SpatialIndex::new(256.0);
        idx.upsert(1, 0.0, 0.0, 100.0, 100.0);
        idx.upsert(2, 300.0, 300.0, 50.0, 50.0);
        assert_eq!(idx.count(), 2);
    }

    #[test]
    fn test_upsert_update() {
        let mut idx = SpatialIndex::new(256.0);
        idx.upsert(1, 0.0, 0.0, 100.0, 100.0);
        idx.upsert(1, 500.0, 500.0, 100.0, 100.0);
        assert_eq!(idx.count(), 1);

        // Old position should not return
        let r = idx.query_viewport(-10.0, -10.0, 200.0, 200.0);
        assert!(r.is_empty());

        // New position should return
        let r = idx.query_viewport(400.0, 400.0, 700.0, 700.0);
        assert_eq!(r.len(), 1);
        assert_eq!(r[0], 1);
    }

    #[test]
    fn test_remove() {
        let mut idx = SpatialIndex::new(256.0);
        idx.upsert(1, 0.0, 0.0, 100.0, 100.0);
        idx.remove(1);
        assert_eq!(idx.count(), 0);

        let r = idx.query_viewport(-10.0, -10.0, 200.0, 200.0);
        assert!(r.is_empty());
    }

    #[test]
    fn test_query_viewport() {
        let mut idx = SpatialIndex::new(256.0);
        idx.upsert(1, 10.0, 10.0, 80.0, 80.0);
        idx.upsert(2, 500.0, 500.0, 80.0, 80.0);
        idx.upsert(3, 1000.0, 1000.0, 80.0, 80.0);

        // Viewport covers element 1 and 2
        let r = idx.query_viewport(0.0, 0.0, 600.0, 600.0);
        assert_eq!(r.len(), 2);
        assert!(r.contains(&1));
        assert!(r.contains(&2));
    }

    #[test]
    fn test_query_rect_lasso() {
        let mut idx = SpatialIndex::new(256.0);
        idx.upsert(1, 100.0, 100.0, 50.0, 50.0);
        idx.upsert(2, 200.0, 200.0, 50.0, 50.0);
        idx.upsert(3, 400.0, 400.0, 50.0, 50.0);

        // Lasso covers 1 and 2
        let r = idx.query_rect(50.0, 50.0, 260.0, 260.0);
        assert_eq!(r.len(), 2);
        assert!(r.contains(&1));
        assert!(r.contains(&2));
        assert!(!r.contains(&3));
    }

    #[test]
    fn test_query_point() {
        let mut idx = SpatialIndex::new(256.0);
        idx.upsert(1, 100.0, 100.0, 50.0, 50.0);
        idx.upsert(2, 200.0, 200.0, 50.0, 50.0);

        let r = idx.query_point(125.0, 125.0);
        assert_eq!(r.len(), 1);
        assert_eq!(r[0], 1);

        // Outside both
        let r = idx.query_point(0.0, 0.0);
        assert!(r.is_empty());
    }

    #[test]
    fn test_batch_upsert() {
        let mut idx = SpatialIndex::new(256.0);
        let data: Vec<f32> = vec![
            1.0, 0.0, 0.0, 100.0, 100.0,
            2.0, 300.0, 300.0, 50.0, 50.0,
            3.0, 600.0, 600.0, 80.0, 80.0,
        ];
        idx.batch_upsert(&data);
        assert_eq!(idx.count(), 3);
    }

    #[test]
    fn test_clear() {
        let mut idx = SpatialIndex::new(256.0);
        idx.upsert(1, 0.0, 0.0, 100.0, 100.0);
        idx.upsert(2, 300.0, 300.0, 50.0, 50.0);
        idx.clear();
        assert_eq!(idx.count(), 0);
    }

    #[test]
    fn test_zero_size_element() {
        let mut idx = SpatialIndex::new(256.0);
        idx.upsert(1, 0.0, 0.0, 0.0, 100.0);
        assert_eq!(idx.count(), 0);

        idx.upsert(2, 0.0, 0.0, 100.0, 0.0);
        assert_eq!(idx.count(), 0);
    }

    #[test]
    fn test_element_spanning_multiple_cells() {
        let mut idx = SpatialIndex::new(256.0);
        // Element spans 4 cells (crosses both cell boundaries)
        idx.upsert(1, 200.0, 200.0, 200.0, 200.0);
        assert_eq!(idx.count(), 1);

        // Query from any corner cell should find it
        let r = idx.query_viewport(0.0, 0.0, 250.0, 250.0);
        assert_eq!(r.len(), 1);

        let r = idx.query_viewport(300.0, 300.0, 450.0, 450.0);
        assert_eq!(r.len(), 1);

        // Deduplication: should appear only once
        let r = idx.query_viewport(0.0, 0.0, 500.0, 500.0);
        assert_eq!(r.len(), 1);
    }

    #[test]
    fn test_negative_coordinates() {
        let mut idx = SpatialIndex::new(256.0);
        idx.upsert(1, -100.0, -100.0, 50.0, 50.0);
        idx.upsert(2, -300.0, -300.0, 50.0, 50.0);

        let r = idx.query_viewport(-150.0, -150.0, -40.0, -40.0);
        assert_eq!(r.len(), 1);
        assert_eq!(r[0], 1);
    }

    #[test]
    fn test_default_cell_size() {
        let idx = SpatialIndex::new(0.0);
        assert_eq!(idx.cell_size, 256.0);

        let idx = SpatialIndex::new(-10.0);
        assert_eq!(idx.cell_size, 256.0);
    }

    /// ADR-272 Phase 0 — 질의는 덮은 셀 좌표 전부 (빈 셀 포함) · 셀 안 항목 (dedup 전) · 결과를 센다.
    /// upsert 는 옛 셀 + 새 셀. take 는 읽고 0 으로.
    #[test]
    fn test_query_stats() {
        let mut idx = SpatialIndex::new(256.0);
        // 셀 (0,0) 하나 · 셀 (0..=1, 0) 둘
        idx.upsert(1, 10.0, 10.0, 50.0, 50.0);
        idx.upsert(2, 200.0, 10.0, 100.0, 50.0);
        let take = |idx: &SpatialIndex| -> Vec<f64> { (0..5).map(|i| idx.take_query_stat(i)).collect() };
        assert_eq!(take(&idx), [0.0, 0.0, 0.0, 0.0, 3.0]);
        // 옛 셀 2 지움 + 새 셀 1 넣음
        idx.upsert(2, 300.0, 10.0, 100.0, 50.0);
        assert_eq!(idx.take_query_stat(4), 3.0);
        // 질의 (0,0)~(1,1) = 셀 4 · 항목 방문 2 (셀 (0,0) 의 1 · 셀 (1,0) 의 2) · 결과 2
        let r = idx.query_rect(0.0, 0.0, 350.0, 300.0);
        assert_eq!(r.len(), 2);
        assert_eq!(take(&idx), [1.0, 4.0, 2.0, 2.0, 0.0]);
        // 빈 질의는 세지 않는다 · 점 질의도 세지 않는다
        idx.query_rect(10.0, 10.0, 10.0, 10.0);
        idx.query_point(20.0, 20.0);
        assert_eq!(take(&idx), [0.0, 0.0, 0.0, 0.0, 0.0]);
        idx.remove(1);
        assert_eq!(idx.take_query_stat(4), 1.0);
    }
}
