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
//! - `spatial_index` — 그리드 셀 기반 공간 인덱스 (hit-test / viewport culling / lasso
//!   selection). ADR-916 SpatialIndex crate 분리(2026-07-05): 기존 `composition_wasm`
//!   (Taffy) crate 에서 이동 — endgame Taffy 완전 제거의 crate 물리 결합 해소(kill
//!   criteria ③). taffy 의존 0 + 레이아웃 모듈 결합 0 이라 clean 편입. `#[wasm_bindgen]`
//!   struct 직접(게이트 밖) → wasm-pack 자동 export + native cargo test 통과(JsValue 미사용).
//!
//! - `display` — CSS Display 변환 순수 문자열 계층 (taffyDisplayAdapter.ts 의 이원 구조 이식).
//!   Phase 2-A. CSS Display Level 3 이원 구조(outer/inner) 파싱 + blockification +
//!   inline-level 판정. ADR-923 Phase 5 (2026-09-02) 부터 TS 는 CSS display 값을 그대로
//!   보내고 outer/inner 해석·blockify 는 이 계층과 tree.rs 만 한다 (TS IFC 시뮬레이션 삭제).
//!   JS 잔류: 기본 display 해석 `resolveDefaultDisplay` (컴포넌트 tag 도메인).
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
//! - **(C-2a) 런타임 배선 + flag 전환 land (2026-07-04)**: 자체 엔진을 live builder
//!   레이아웃 엔진으로 전환. (1) `compositionEngineWasm.ts`(전역 로드, taffy
//!   `rustWasm.ts` 대응) + `compositionEngine.ts`(동기 wrapper `CompositionEngineLayout`,
//!   taffy `TaffyLayout` 대응 — 자체 pkg 가 camelCase 16-메서드라 이름 매핑 없이 raw
//!   타입 변환만). (2) `layoutBridge.ts::createLayoutEngine` flag true 경로에 자체
//!   엔진 주입(미준비 시 Taffy 안전 폴백). (3) `init.ts` startup 에 자체 WASM 로드.
//!   (4) `USE_RUST_LAYOUT_ENGINE` flip. **경로 정정**: 자체 pkg 는 monorepo
//!   `packages/`(dev 서버 root 밖)이라 절대 URL fetch 실패 → wasm-pack out-dir 을
//!   apps/builder 내부(`wasm-bindings/composition-engine-pkg/`, taffy 선례 미러링)로
//!   지정 + 상대 경로 import(`package.json wasm:build:engine`). **Chrome MCP live
//!   exercise**: builder 진입 → `createLayoutEngine()` 이 `CompositionEngineLayout`
//!   반환 + flex row 실계산(leaf-b x=30) + nodeCount 3 확인, Canvas/Skia 렌더 무붕괴.
//!   **핵심 발견**: `UNIFIED_ENGINE:true` global override 로 `isUnifiedFlag` 가 개별
//!   flag 무관 true → 배선 커밋 = 즉시 live 전환(배선/flip 분리 불가 구조). rollback =
//!   flag false + createLayoutEngine 진입 차단. type-check PASS(baseline 69) 무회귀.
//! - **(1-E) Taffy dead code 제거 land (2026-07-05)**: 자체 엔진 live 전환 후
//!   Taffy 엔진 클래스 4종이 인스턴스화 0건 / `.calculate()` 호출 0건 = dead.
//!   삭제: `BaseTaffyEngine.ts`(abstract, `new TaffyLayout()` dead) +
//!   `layoutAccelerator.ts`(importer 0). 클래스만 제거(파일 유지, live helper 보존):
//!   `TaffyFlexEngine`/`TaffyGridEngine`/`TaffyBlockEngine` 클래스 + `isTaffy*Available`
//!   삭제하되 순수 style helper `elementToTaffyStyle`/`parseGridTemplate`/
//!   `elementToTaffyBlockStyle` 는 `fullTreeLayout.ts:41-43` 소비 유지. **사용자 결정**:
//!   폴백 유지(`layoutBridge.ts:84` WASM 미가용 안전망) + dead 코드만 삭제(crate/pkg
//!   물리 삭제 아님). 잔존 참조 9/6/2 = 파일명 import 경로 + 주석뿐. type-check PASS
//!   (baseline 69) 무회귀. commit f2ac4860c(-1252줄).
//! - **다음 = 2-C scene.rs / 2-D commands.rs / 2-E text.rs 재평가**: fullTreeLayout DFS
//!   → 자체 엔진 편입 후속 단계. HIGH — 별도 승인.

pub mod block;
pub mod cascade;
pub mod display;
pub mod flex;
pub mod grid;
pub mod spatial_index;
pub mod style;
/// ADR-183 — 레이아웃 판정 트레이스 (디버그 채널). 게이트 off 가 기본.
pub mod trace;
pub mod tree;

pub use spatial_index::SpatialIndex;

// WASM 바인딩 wrapper — wasm32 타겟에서만 컴파일(native cargo test 무영향).
// `tree::LayoutTree` 를 JS `LayoutEngineAPI`(layoutBridge.ts) 계약으로 노출.
#[cfg(target_arch = "wasm32")]
pub mod wasm;
