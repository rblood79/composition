//! ADR-916 Phase 1 — composition-engine
//!
//! Taffy 의존 없는 자체 단일 레이아웃 엔진. Flexbox/Grid/Block 을 CSS 명세 기반으로
//! 자체 구현하여 외부 라이브러리 래핑을 제거한다 (ADR-916).
//!
//! ## 모듈
//!
//! - `flex` — CSS Flexbox (CSS-FLEXBOX-1). Phase 1-A. 단일 라인 기본 + §9.7
//!   flex-grow/shrink 분배 + §9.3 flex-wrap multi-line + align-content 구현.
//!   미구현: flex-basis:content intrinsic 자동측정, aspect-ratio, align-self,
//!   auto margin 흡수, nested BFC.
//! - `block` — CSS Block (CSS 2.1 §8, BFC / §8.3.1 margin collapse). Phase 1-C.
//!   기존 block_layout.rs(625줄, test 17) 승계 이식 + 잔여 케이스 보강
//!   (through-collapse chain / 부모-자식 bottom collapse metadata / BFC bottom 차단).
//!   미구현: float/clear, writing-mode, BFC 내부 다단.
//!
//! - `grid` — CSS Grid (CSS-GRID-1 §7 track sizing / §8 placement). Phase 1-B.
//!   기존 grid_layout.rs(279줄, test 11) 산술 커널 + GridLayout.utils.ts 알고리즘
//!   (repeat/minmax/named-areas/span 배치) 통합 승계. 미구현: subgrid, intrinsic
//!   track(min/max-content), dense 역채움, baseline 정렬.
//!
//! - `style` — CSS 값 산술 파서 커널 (cssValueParser.ts 순수 산술 계층). Phase 2-A.
//!   단위 해석(px/rem/em/vw/vh/…/%) + calc()/clamp()/min()/max()/env() +
//!   font/border shorthand 분해. var()/디자인 토큰 해석은 DOM 의존이라 JS 잔류 —
//!   본 모듈은 var() 선치환된 순수 값 문자열을 입력받는다.
//!
//! - `cascade` — CSS Cascade Resolver 순수 헬퍼 (cssResolver.ts 자기완결 계층). Phase 2-A.
//!   상속 규칙 테이블 + 초기값 맵 + cascade 키워드(inherit/initial/unset/revert) +
//!   currentColor 토큰 치환 + font-variant→OpenType feature + 논리→물리 속성 변환.
//!   미이식: getRootComputedStyle(store 의존 JS 잔류), resolveFontStretchWidth(spec
//!   SSOT FONT_STRETCH_KEYWORD_MAP 의존 — 참조 계약 확정 후), resolveStyle 본체(조립 단위).
//!
//! - `display` — CSS Display 변환 순수 문자열 계층 (taffyDisplayAdapter.ts 자기완결 계층).
//!   Phase 2-A. CSS Display Level 3 이원 구조(outer/inner) 파싱 + blockification +
//!   inline-level 판정 + 자식 display 분류. 미이식: getElementDisplay(INLINE_BLOCK_TAGS
//!   tag 도메인 의존), toTaffyDisplay childElements 경로 + VERTICAL_ALIGN_MIDDLE_TAGS
//!   (node/tag 의존 → tree.rs 2-B 노드 계약과 함께 이관).
//!
//! - `tree` — 트리 오케스트레이션 (taffy_bridge.rs batch 계약 대응). Phase 2-B.
//!   `build_tree_batch` → `compute_layout` → `get_layouts_batch` 를 Taffy 없이
//!   자체 flex/block/grid 커널로 구현하는 계층. DFS 상단(style resolve/implicit/
//!   enrich = tag/spec/store 도메인)은 JS 잔류, 본 모듈은 순수화된 TaffyStyle 트리만
//!   레이아웃 계산. 층별 점진 — 단위 1(handle+build 골격+leaf compute) / 단위 2
//!   (post-order flex solve) / 단위 3-a(block dispatch) / 단위 3-b(grid dispatch) /
//!   **단위 4(현재, 증분 dirty 추적)** land. flex/block/grid 3 display dispatch +
//!   증분 재계산 완성. 증분 API 가 변경 노드 + 조상 dirty 전파(taffy mark_dirty
//!   계약 이식) → `solve_node` 는 clean 서브트리 skip(저장 layout 재사용), available
//!   변경/clear 시 skip 무효화. tree.rs 오케스트레이션 4 단위 완료 → LayoutEngineAPI
//!   batch 계약 완비. seam(createLayoutEngine) 미배선 → live 영향 0.
//!
//! - `wasm` — WASM 바인딩 wrapper (seam 배선 A). Phase 2-B. `tree::LayoutTree`
//!   (순수 Rust)를 JS `LayoutEngineAPI`(layoutBridge.ts) 16 메서드 계약으로 노출하는
//!   얇은 `#[wasm_bindgen]` wrapper — `taffy_bridge.rs::TaffyLayoutEngine` 과 동일
//!   시그니처라 `createLayoutEngine` seam 에 교체 가능하게 꽂힌다. `#[cfg(target_arch
//!   = "wasm32")]` 게이트 → native cargo test 무영향(JsValue non-wasm32 panic 회피).
//!   binary protocol 미구현(`has_binary_protocol()`=false → JS JSON 경로 fallback).
//!   **seam 미배선 유지** — wrapper 존재 ≠ flag 전환. dual-run(candidate=wrapper vs
//!   reference=Taffy) self-diff 0 통과가 flag 전환 전제(no-dormant-foundation).
//!
//! ## 미편입 (다음 단계)
//!
//! - seam 배선 (B1/B2) 완료: (B1) wasm-pack 산출물(`pkg/` — .wasm + 바인딩 .js/.d.ts)
//!   생성 + export 검증, (B2) JS↔WASM 통합 인프라(vitest 에 vite-plugin-wasm) +
//!   실제 두 WASM 엔진(자체 vs Taffy) dual-run self-diff. flex row fixed 케이스는
//!   자체 vs Taffy HC3 통과(dualRunLive.test.ts 4/4). 검증 경로는 JS 측
//!   (`apps/builder/.../layout/engines/dualRunEngines.ts` 어댑터 + `dualRunLive.test.ts`).
//! - seam 배선 (C-1) 실전 catalog dual-run 진단 완료 — **flag 전환 차단 확정**:
//!   dualRunLive.test.ts (C-1) describe 가 catalog 대표 3 패턴 측정. block
//!   height:auto → diff 0(정합) / **flex column height:auto → h=0 붕괴**(자체가
//!   avail_h=-1 sentinel 을 flex main available 로 받아 자식 shrink) / **grid
//!   height:auto → 셀 h +50**(intrinsic track 미측정, available 로 채움). 실전
//!   다수 패턴이 diff → (C-2) flag 전환 불가(no-dormant-foundation).
//! - **선결 과제 #1 flex.rs main-negative + ALIGN_STRETCH 완료 (2026-07-04)**:
//!   available_main 음수(sentinel) intrinsic 처리 + collect_lines 한 라인 +
//!   ALIGN_STRETCH 명시 cross 유지(`cross_is_auto`) → C-1 flex column height:auto
//!   dual-run diff 0 전환(dualRunLive.test.ts 7/7). flex.rs 모듈 doc 참조.
//! - **선결 과제 #2 grid.rs implicit auto row 완료 (2026-07-04)**: tree.rs
//!   `solve_grid` 이 rows 미명시 + auto-placement 시 자식 intrinsic content
//!   height 로 row-major row 크기 도출(grid.rs fallback 100 대체) → C-1 grid
//!   height:auto dual-run diff 0 전환. **dualRunLive.test.ts 7/7 — C-1 3 대표
//!   패턴(block/flex column/grid) 전면 diff 0** = 두 flag 전환 선결 완료.
//! - **(C-2b) 실전 중첩/혼합 dual-run 전면 diff 0 proof 완료 (2026-07-04)**:
//!   C-1(단일 레벨 3패턴)은 flag 전환의 필요조건이나 충분조건 아님 — 실전 catalog
//!   컨테이너는 컨테이너를 **중첩**한다(catalog 실측: flex 88 > grid 10 > block 6,
//!   column 23 > row 10). dualRunLive.test.ts (C-2b) describe 가 중첩·혼합 5
//!   fixture 측정: N1 flex-in-flex / N2 flex-in-grid / N3 grid-in-flex / N4 gap /
//!   N5 dimension 혼재 → **전면 diff 0**. **dualRunLive.test.ts 12/12(C-1 3 +
//!   C-2b 5 + B2 4)** = 실전 대표 8형상 자체 vs Taffy 시각 동일.
//! - **다음 = (C-2a) 런타임 배선 + flag 전환**: 자체 pkg apps/builder 런타임 로드
//!   배선(taffy `rustWasm.ts`/`layoutEngine.ts` 패턴, 현재 미배선) + `createLayoutEngine`
//!   flag true 경로 자체 엔진 주입 + `USE_RUST_LAYOUT_ENGINE` flip + Chrome MCP live
//!   exercise. **배선/flip 은 (C-2b) proof 확보 후 별도 승인 단위** — proof 를 먼저,
//!   배선은 proof 통과 후([[feedback-no-dormant-foundation-ahead-of-flip]]). live 엔진
//!   교체라 HIGH.

pub mod block;
pub mod cascade;
pub mod display;
pub mod flex;
pub mod grid;
pub mod style;
pub mod tree;

// WASM 바인딩 wrapper — wasm32 타겟에서만 컴파일(native cargo test 무영향).
// `tree::LayoutTree` 를 JS `LayoutEngineAPI`(layoutBridge.ts) 계약으로 노출.
#[cfg(target_arch = "wasm32")]
pub mod wasm;
