//! ADR-916 Phase 1 — composition-engine
//!
//! Taffy 의존 없는 자체 단일 레이아웃 엔진. Flexbox/Grid/Block 을 CSS 명세 기반으로
//! 자체 구현하여 외부 라이브러리 래핑을 제거한다 (ADR-916).
//!
//! ## 모듈
//!
//! - `flex` — CSS Flexbox (CSS-FLEXBOX-1). Phase 1-A. 현재 단일 라인 기본만 구현.
//!
//! ## 미편입 (다음 세션)
//!
//! - `grid` — CSS Grid (grid_layout.rs 승계 확장). Phase 1-B.
//! - `block` — margin collapse / BFC (block_layout.rs 승계). Phase 1-C.
//! - WASM batch 엔트리 (`LayoutEngineAPI` 계약 구현) — flex/grid/block 이 dual-run
//!   통과할 만큼 완성된 뒤 seam(`createLayoutEngine`) 에 배선. 지금 배선하면
//!   알고리즘 미완성 상태의 dormant 번들 (no-dormant-foundation-ahead-of-flip).

pub mod flex;
