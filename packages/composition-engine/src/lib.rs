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
//!   레이아웃 계산. 층별 점진 — **단위 1(현재)**: handle 관리 + build_tree_batch
//!   골격 + leaf-only compute_layout. 단위 2(intrinsic)/3(placement+dispatch)/
//!   4(dirty 추적)는 다음 착수. seam(createLayoutEngine) 미배선 → live 영향 0.
//!
//! ## 미편입 (다음 세션)
//!
//! - WASM batch 엔트리 (`LayoutEngineAPI` 계약 구현) — flex/grid/block 이 dual-run
//!   통과할 만큼 완성된 뒤 seam(`createLayoutEngine`) 에 배선. 지금 배선하면
//!   알고리즘 미완성 상태의 dormant 번들 (no-dormant-foundation-ahead-of-flip).

pub mod block;
pub mod cascade;
pub mod display;
pub mod flex;
pub mod grid;
pub mod style;
pub mod tree;
