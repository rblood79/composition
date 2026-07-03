# ADR-916 Design Breakdown: 자체 단일 Rust 엔진 통합

> 본 문서는 [ADR-916](../916-unified-rust-engine.md)의 구현 상세. 결정 근거/대안/위험 평가는 ADR 본문 참조.

## 0. 현황 Inventory (2026-07-03 freeze)

### 0-1. Rust 측 (5,633줄)

| 모듈                                                                    |  줄수 | 상태                                                                                                                                                                                                                                | Taffy 의존    |
| ----------------------------------------------------------------------- | ----: | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------- |
| `apps/builder/src/builder/workspace/canvas/wasm/src/taffy_bridge.rs`    | 1,307 | 활성 (production)                                                                                                                                                                                                                   | ✅ Taffy 0.9  |
| `apps/builder/src/builder/workspace/canvas/wasm/src/binary_protocol.rs` | 1,347 | 활성 — TAFF 바이너리 직렬화                                                                                                                                                                                                         | ❌ 자체       |
| `apps/builder/src/builder/workspace/canvas/wasm/src/block_layout.rs`    |   625 | **runtime 미가동** — 호출처는 layoutAccelerator(import 0건) + layoutWorker(LAYOUT_WORKER=false)뿐. margin collapse/inline-block line box/fit-content 커널 구현 + unit test 17. 사전 해석 19-field 입력 의존 (스타일 해석 계층 없음) | ❌ 자체       |
| `apps/builder/src/builder/workspace/canvas/wasm/src/spatial_index.rs`   |   393 | 활성 (SPATIAL_INDEX=true)                                                                                                                                                                                                           | ❌ 자체       |
| `apps/builder/src/builder/workspace/canvas/wasm/src/grid_layout.rs`     |   279 | **runtime 미가동** — 동일 (호출처 layoutWorker 전용). px/fr/%/auto 4단위 파싱 + row-major auto-placement만. repeat/minmax/named areas/track sizing(§11) 미구현, auto=1fr 근사                                                       | ❌ 자체       |
| `packages/composition-layout/src/lib.rs`                                |   842 | **비활성** (USE_RUST_LAYOUT_ENGINE=false)                                                                                                                                                                                           | ✅ Taffy 0.10 |
| `packages/composition-layout/src/style.rs`                              |   599 | 비활성                                                                                                                                                                                                                              | —             |
| `packages/composition-layout/src/spatial.rs`                            |   219 | 비활성                                                                                                                                                                                                                              | —             |

### 0-2. JS 측 이관 대상 (핵심 ~15,700줄)

| 영역                                        | 파일                                                                             |   줄수 | 병목                                                   |
| ------------------------------------------- | -------------------------------------------------------------------------------- | -----: | ------------------------------------------------------ |
| 레이아웃 오케스트레이션                     | `layout/engines/fullTreeLayout.ts`                                               |  2,861 | DFS 전체 순회 + WASM 경계 노드당 ~5회                  |
| CSS 파싱/측정 유틸                          | `layout/engines/utils.ts`                                                        |  4,866 | 텍스트 측정 + 박스모델 계산                            |
| Implicit styles                             | `layout/engines/implicitStyles.ts`                                               |  2,440 | 노드당 ~50 컴포넌트 타입 분기                          |
| dirty 검출                                  | `layout/engines/persistentTaffyTree.ts`                                          |    423 | 노드당 JSON.stringify 문자열 비교                      |
| 렌더 커맨드                                 | `skia/renderCommands.ts`                                                         |  1,091 | 매 content 프레임 O(N) DFS + z-sort + boundsMap 재생성 |
| Skia 노드 데이터 빌드 (catalog shapes 소비) | `skia/buildSpecNodeData.ts`                                                      |  1,786 | 노드당 조상 체인 탐색 O(N×D)                           |
| store 동기화                                | `skia/StoreRenderBridge.ts`                                                      |    743 | detectChangedIds O(N) Map 순회                         |
| 스타일 해석                                 | `layout/engines/cssResolver.ts` + `cssValueParser.ts` + `taffyDisplayAdapter.ts` | ~2,266 | 노드당 ~50 속성 파싱/캐스케이드                        |

### 0-3. 피처 플래그 (`wasm-bindings/featureFlags.ts`)

| 플래그                   | 현재        | 전환 시점 |
| ------------------------ | ----------- | --------- |
| `LAYOUT_WORKER`          | false (:18) | Phase 0-B |
| `USE_RUST_LAYOUT_ENGINE` | false (:37) | Phase 0-A |

### 0-4. WASM 경계 횡단 (프레임 경로, 현재 5회)

1. 스타일 직렬화 (JS→WASM)
2. Taffy solve
3. 레이아웃 역직렬화 (WASM→JS)
4. SpatialIndex 쿼리
5. CanvasKit draw

**목표: 2회** (통합 엔진 batch 호출 + CanvasKit draw)

---

## Phase 0: 기존 인프라 배선 + 활성화 (flag 단독 전환 아님)

> **2026-07-03 codex 실사 (round 2)**: 두 flag 모두 단독 전환으로는 무효. 0-A 는 layoutBridge 미배선 + persistentTaffyTree factory 미경유, 0-B 는 scheduler 소비 caller 0건. Phase 0 은 "Quick Win flag flip" 이 아니라 **배선(wiring) 작업 + flag 활성화**다.

### 0-A. seam 구축 — 엔진 주입 지점 + batch 계약 인터페이스 (✅ Implemented 2026-07-03, flag 전환 보류)

> **2026-07-03 실행 결정 (사용자 confirm)**: **seam 만 구축, flag 전환 보류.** composition-layout(0.10) 도 외부 Taffy 종속이라 flag 전환 시 검증한 0.10 layout 은 Phase 1(Taffy 제거)에서 전부 폐기된다. 폐기될 0.10 dual-run 검증 비용을 피하고, Phase 1 의 composition-engine(자체 엔진)이 그대로 꽂히는 **교체 지점(seam)** 만 만든다.

- **실측 정정 (adapter crate 불필요)**: breakdown 초안의 "per-node API 비호환 → batch entry 구현/adapter 작성" 은 과대평가였다. `layoutEngine.ts` 의 `compositionLayout` wrapper 가 이미 TaffyLayout batch API 를 거의 전부 mirror 구현(`buildTreeBatch:293`/`getLayoutsBatch:265` flat f32→Map 변환 포함/`setChildren`/`updateStyleRaw`/`createNodeRaw`/`markDirty`/`removeNode`/`clear`/`nodeCount`). 실제 갭은 `buildTreeBatchBinary`/`hasBinaryProtocol` 2개 메서드뿐 (binary 미지원 시 `hasBinaryProtocol()=false` → JSON 경로 자동 fallback).
- **실행한 작업 (동작 무변, 순수 구조)**:
  1. `LayoutEngineAPI` 인터페이스(`layoutBridge.ts`)를 per-node API → **persistentTaffyTree 실사용 batch 계약 13 메서드**로 확장 (실사용과 불일치하면 엔진 주입 시 타입 갭 발생)
  2. `PersistentTaffyTree` 필드 `TaffyLayout` → `LayoutEngineAPI`, 생성자 `new TaffyLayout()` 직접 생성 제거 → `createLayoutEngine()` factory 경유 (+ 테스트용 optional 주입 파라미터)
  3. `createLayoutEngine()` 의 flag true wiring 은 **의도적으로 주석 유지** — flag 미전환. `USE_RUST_LAYOUT_ENGINE=false` default 이므로 여전히 TaffyLayout 반환, 동작 완전 무변
- **검증**: `persistentTaffyTree.seam.test.ts` 3/3 PASS (주입 엔진 사용 / factory default / 13-계약 정적 커버) + type-check 회귀 0 + live builder(DDF 프로젝트) 렌더 무변 + 새로고침 재현 + 콘솔 에러 0
- **flag 전환/dual-run/G1 → Phase 1 이연**: seam 은 구축됐으나 flag 는 켜지 않았으므로 Taffy 0.9→0.10 layout 결과 차이 검증(G1)은 이 시점 불필요. Phase 1 에서 composition-engine 을 seam 에 배선할 때 dual-run(G2)이 첫 실전 검증.
- 산출물: `layoutBridge.ts`(batch 계약 인터페이스 + seam factory) + `persistentTaffyTree.ts`(주입 seam) + `persistentTaffyTree.seam.test.ts`

### 0-B. LayoutScheduler 소비 배선 + `LAYOUT_WORKER=true` (⏸️ 생략 — Phase 1/2 통합 배선으로 이연, 2026-07-03)

> **2026-07-03 실행 결정 (사용자 confirm)**: **0-B 생략, Phase 0 을 0-A(seam)만으로 종료.** 근거는 0-A 의 "폐기될 것 지금 배선 금지" 와 동일 원칙([[feedback-no-dormant-foundation-ahead-of-flip]]).

- **실측 (완전 dead)**: `getLayoutScheduler`(`wasm-worker/index.ts:32`) caller 0건 + block/grid 가속기(`layoutAccelerator`) import 0건. LayoutScheduler 소비 경로가 어디에도 이어지지 않음
- **dormant 판정**: 0-B 가 배선하려는 대상은 block/grid worker offload 인데, 그 위의 실제 consumer(block/grid 가속기)가 이미 dead 다. 소비 배선을 지금 만들어도 가속기 자체를 부활시키지 않으면 실효 0 → **flip 앞선 dormant 기반**. 게다가 이 가속기는 Phase 1-B/1-C(`grid.rs`/`block.rs` 이관·확장)와 Phase 2-B(전체 layout worker 이관, breakdown 명시 "Phase 2-B 이후 범위")에서 재편되므로, 지금 배선하면 이관 시 중복 재작업
- **이연 위치**: worker offload 배선은 Phase 2-B(`tree.rs` full-tree batch API)에서 composition-engine 의 실제 worker 경로와 함께 통합 배선한다. `LAYOUT_WORKER` flag 전환도 그 시점.
- 잔존 인프라 코드(`LayoutScheduler.ts` / `wasm-worker/`)는 dead 이지만 Phase 2-B 이관 시 참조 자산으로 보존 (삭제하지 않음)

**Phase 0 종료 상태 (2026-07-03)**: 0-A seam ✅ Implemented (flag 보류) / 0-B ⏸️ Phase 2-B 이연. Phase 0 은 "인프라 배선" 이 아니라 **엔진 교체 지점(seam) 확보** 로 축소 종료 — flag 전환·worker offload 는 실제 자체 엔진(Phase 1) 이후로 이연하여 폐기될 중간 산출물 검증 비용을 제거.

---

## Phase 1: Taffy 제거 — 자체 레이아웃 엔진

> **실질 출발점 (2026-07-03 실사)**: flex 자체 구현 0% (Taffy 전담). block/grid 자체 모듈은 runtime 미가동 (0-1 표 참조) — 승계 가능 자산은 margin collapse·inline-block line box·track 파싱 **산술 커널**이며, 스타일 해석 계층·grid track sizing(§11)·flex 전체는 신규. 자체 구현의 실전 가동 이력이 0이므로 **G2 dual-run 이 사실상 첫 실전 검증**이다.

### 1-A. `flex.rs` 신규 (~2,000줄 추정)

> **2026-07-03 실행 (사용자 confirm — "1-A 착수" + 첫 단위 = crate scaffold + 단일축 기본)**: adr-writing.md M4(sub-group N≥3 → confirm 의무) 발동. flex.rs 는 flex-basis/main-size/grow-shrink/wrap/align 최소 4 sub-group 대공사이고 부분 구현은 dual-run 대부분 FAIL 이라, 대안 C big-bang 위험 회피를 위해 **가장 작은 검증 가능 단위(단일 라인 기본)부터** 착수.

- **✅ crate scaffold + 단일축 기본 land 2026-07-03**:
  - `packages/composition-engine/` 신규 crate — **taffy 의존 없음** (본 crate 존재 이유). `composition-layout`(0.10, Taffy 종속) 대체. wasm-bindgen + serde만.
  - `flex.rs` — 입력 계약은 `block_layout.rs` 패턴 승계 (**flat f32 배열 + AUTO/CONTENT 센티넬**, 사전 해석 숫자). 노드당 `FLEX_FIELD_COUNT=16` 필드 (flex_basis/width/height/margin4/pad_border main·cross/min·max main·cross/content main·cross/grow_shrink 예약).
  - **구현 범위**: `flex_layout_single_line` — main-axis(row/column) 단일 라인, fixed/auto size, `justify-content` 6종(start/center/end/space-between/around/evenly), `align-items` 4종(stretch/start/center/end), gap, 논리 main·cross → 물리 x/y/w/h 역매핑.
  - **미구현 (다음 세션)**: `flex-grow`/`flex-shrink` 여유·부족 분배(§9.7), `flex-wrap` multi-line(§9.3), `align-content`, `flex-basis: content` intrinsic, `aspect-ratio`, nested BFC. 이 입력은 현재 고정 크기 근사 → dual-run FAIL 로 드러나며 그것이 다음 세션 구현 대상 fixture.
  - **승계 자산 실측**: block_layout.rs/grid_layout.rs 는 각 알고리즘 전용 커널 — flex 직접 재사용 자산 거의 없음(`clamp_size` min/max clamp 정도). breakdown "~2,000줄 신규" = 순수 신규 확증.
- **✅ 잔여 (grow/shrink + wrap + align-content) land 2026-07-04**:
  - **§9.7 Resolving Flexible Lengths**: `resolve_flexible_lengths()` 반복 동결 알고리즘. (1) hypothetical outer main 합 < available → grow / 아니면 shrink. (2) inflexible(factor=0 또는 basis 방향 역행) 즉시 동결. (3~4) 미동결 아이템 있는 동안: remaining free space 재계산 → grow 는 grow-ratio, shrink 는 scaled factor(basis×shrink) ratio 로 target 분배 → min/max clamp violation **부호 합산**(>0 min위반 동결 / <0 max위반 동결 / 0 전체동결). grow-sum<1 magnitude 축소 처리 포함.
  - **§9.3 Collect flex items into flex lines**: `collect_lines()` — nowrap 이면 단일 라인, wrap 이면 outer main-size 누적이 available 초과 직전 새 라인(라인당 최소 1개 보장). 각 라인 독립 §9.7 resolve.
  - **align-content**: `align_content_offsets()` — stretch(라인 cross 균등 확장, default 아님)/start(default)/center/end/space-between/space-around + `gap_cross` 라인 간격.
  - **진입점 재구성**: `flex_layout(...wrap, align_content, gap_cross)` 신규 = 전체 케이스. `flex_layout_single_line` 은 nowrap+gap_cross=0 위임 wrapper 로 유지(기존 8 테스트 회귀 방지 + 하위 호환).
  - **필드 계약 확장**: `FLEX_FIELD_COUNT` 16→17 — packed `flex_grow_shrink`(off15) 를 `flex_grow`(off15)/`flex_shrink`(off16) 별도 필드로 분리(§9.7 알고리즘 명료성).
  - **미구현 (다음)**: `flex-basis: content` intrinsic 자동측정, `aspect-ratio`, `align-self`(아이템별 override), auto margin 흡수, nested BFC.
- **검증**: `cargo test` **21/21 PASS** (기존 8 회귀 + grow 4[균등/비율/max-clamp 재분배/grow=0] + shrink 3[overflow/shrink=0/min-clamp 흡수] + wrap 4[2라인 분할/nowrap overflow/라인당 최소1/라인별 grow] + align-content 2[center/gap_cross]), clippy 0, 경고 0. native 단위 테스트 — wasm 컴파일 불필요.
- **⏸️ WASM batch 엔트리 + seam 배선 이연**: `LayoutEngineAPI` 계약 구현(`buildTreeBatch` 등)은 flex/grid/block 이 dual-run 통과할 만큼 완성된 뒤 `createLayoutEngine` 에 배선. 지금 배선하면 알고리즘 미완성 dormant 번들([[feedback-no-dormant-foundation-ahead-of-flip]]).
- 테스트: Taffy 의 gentest 방식 (Chrome 실측 → fixture 자동 생성) 포팅 — WPT-파생 fixture 자산 확보 (candidate 완성도 상승 시 dual-run golden 생성)
- 위치: `packages/composition-engine/src/flex.rs` (신규 crate — 아래 §Crate 구조)
- 산출물: `packages/composition-engine/{Cargo.toml, .gitignore, src/lib.rs, src/flex.rs}`

### 1-B. grid 확장 (`grid.rs`)

> **2026-07-04 실행 (사용자 승인 "1-B grid.rs (§11 track sizing) 착수… 승인")**: grid 는 block 과 동일하게 검증된 자산이 존재 → **승계 통합 이관**(재작성 아님). 다만 자산이 **두 곳에 분산**되어 있었다: (a) `grid_layout.rs`(279줄, test 11) 는 px/fr/%/auto 산술 + row-major cell positions 만 (auto=1fr 근사, repeat/minmax/areas 미지원), (b) `GridLayout.utils.ts` 는 더 완전한 실동작 구현(repeat auto-fill/auto-fit·minmax·named areas·span 배치). 후자가 실동작 SSOT → 두 자산을 `grid.rs` 로 통합하고 grid_layout.rs 산술 test 11 을 회귀로 승계. design freeze("grid_layout.rs 승계 확장") 정합, 사용자 관점 의문 대상 아님.

- **✅ land 2026-07-04**:
  - **통합 이관**: `grid_layout.rs` 산술 커널 + `GridLayout.utils.ts` 알고리즘(`tokenizeTemplate` / `parseSingleTrackValue` / `parseMinmax` / `expandRepeat` / `resolveGridTracks` / `parseGridTemplateAreas` / `parseGridLine` / `calculateGridCellBounds`) → `packages/composition-engine/src/grid.rs`. 두 원본 파일 **무변**.
  - **track sizing (§7)**: fixed(px/%) 합산 → 남은 공간을 fr/auto/minmax(fr) 풀 분배. `repeat(auto-fill/auto-fit, minmax(...))` 는 patternMinSize + gap 기반 반복 횟수 산출. `minmax(min, max)` 는 max 가 fr 이면 음수 sentinel 로 fr 풀 참여, px 이면 clamp. (GridLayout.utils.ts 계약 그대로 — intrinsic min/max-content 는 0 폴백)
  - **placement (§8)**: named `grid-template-areas`(인접 셀 병합) + `gridColumn/gridRow` span 키워드(`span N`, `1 / 3`, `1 / span 3`, `span 2 / 5`) + 숫자 `gridArea` shorthand + row-major auto-placement. `cell_bounds_for_child` 로 colStart..colEnd 트랙 + 내부 gap 누적.
  - **완결 공개 엔트리**: `grid_layout(template_cols, template_rows, template_areas, placement_spec, child_count, available_w, available_h, col_gap, row_gap)` — flex_layout/block_layout 과 대칭. 문자열 template → 최종 자식 bounds flat 배열(`[x,y,w,h,...]`). placement_spec 은 자식당 `area_name|grid_column|grid_row` 개행 구분(upstream JS style 직렬화 계약). 이 엔트리 도입으로 배치 함수들이 test-only dead code 가 아닌 실사용 API 로 노출.
  - **이관 중 정정 2건**: (1) `resolve_grid_tracks` fr 분배를 작성 중 과잉 min/max 체인으로 오작성 → 원본 계약(`frSize * frVal`)대로 정정. (2) `parse_single_track_value` fr 파싱에 `parseFloat||1` 폴백(0fr→1fr) 재현. clippy 경고 1건(while-let → for 루프) 수정.
  - **미구현 (다음 — dual-run FAIL 이 fixture)**: subgrid, intrinsic track(min-content/max-content → 0 폴백), dense packing 빈칸 역채움, baseline 정렬, `fit-content()` 함수. 현행 catalog grid 컨테이너 사용 범위로 한정.
- **검증**: `cargo test` **64/64 PASS** (flex 21 + block 19 + grid 24 = 승계 11 + repeat/minmax 5 + areas/span/place 5 + 완결 엔트리 3), clippy 0, 경고 0. seam 미배선 → live builder 영향 0 (WASM 배선은 flex/grid/block dual-run 통과 후 첫 배선 시점 이연).
- **Phase 1 self-impl 3종(flex/block/grid) 완료** — 남은 Phase 1: 1-D fixture golden 생성 + WASM batch 엔트리(`LayoutEngineAPI`) + `createLayoutEngine` seam 배선 + 1-E Taffy 제거.
- **Phase 1 부분 마감 (2026-07-04, 사용자 "(C) 여기서 멈추고 Phase 1 마감")**: self-impl 알고리즘 계층(1-A/1-B/1-C) + 1-D 하네스·golden 까지 land. **WASM 트리 batch 배선 + 1-E Taffy 제거는 미착수** — 배선이 트리 오케스트레이션(2-B tree.rs) 선행을 요구해 사실상 Phase 2 진입이므로, Phase 1 을 여기서 마감하고 배선은 Phase 2 로 넘긴다. ADR Status = Accepted 유지 (Phase 1 전체 미완). 자체 엔진은 seam 미배선 crate 로 존재(live 영향 0, Taffy 경로 가동).

### 1-C. block 보강 (`block.rs`)

> **2026-07-04 실행 (사용자 승인 "1-C block.rs 먼저")**: block 은 flex 와 달리 검증된 625줄 커널(test 17) 이 이미 존재 → **승계 이식**(재작성 아님). 재작성은 Soft Constraint(WPT-파생 검증 자산 상실) 정면 위배이고 design 이 이미 "block_layout.rs 승계" 로 freeze → 이식이 design 정합 실행 (사용자 관점 의문 대상 아님). 실측 결과 커널이 CSS 2.1 §8.3.1 핵심(vertical stacking / margin collapse 양·음·혼합 / BFC / inline-block line box / fit-content) 을 이미 충실 구현 → "잔여 케이스" 는 명세상 명확한 것만 보강, 추측 보강은 dormant(dual-run FAIL 이 fixture) — flex.rs 원칙 동일.

- **✅ land 2026-07-04**:
  - **이식**: `apps/builder/.../wasm/src/block_layout.rs`(625줄) → `packages/composition-engine/src/block.rs`. 입력 계약 `FIELD_COUNT=19` 그대로 (flex `FLEX_FIELD_COUNT=17` 과 별도 — block 은 vertical-align/baseline/BFC flag 고유 필드 보유). 계약 통일은 **Phase 2-B tree.rs 통합 시점**에 결정 (지금 통일 시 dormant). 승계 test 16 (fit-content 6 포함) 유지. 원본 파일 **무변** (승계 후 개선은 새 crate 만 — 원본은 여전히 참조 자산으로 보존).
  - **잔여 케이스 보강 (명세상 명확)**: (1) **empty block through-collapse chain** — 원본 커널이 `prev_margin_bottom = collapsed_self` 로 덮어써 앞선 sibling 의 margin 이 chain 에서 유실 → CSS 2.1 §8.3.1("인접 margin 은 모두 하나로 collapse") 위반. `collapse(prev_margin_bottom, collapsed_self)` 누적으로 수정 (3연속 empty block 관통 test 로 확증). (2) 부모-자식 **bottom margin collapse** metadata 전파 test. (3) **BFC 자식** 은 부모와 bottom collapse 차단 (metadata 0) test.
  - **clippy 수정**: `child_w` fit-content/explicit-px 동일 분기(`content + pad_border_h`) → `width_val != AUTO` 단일 분기 병합 (동작 무변, identical-blocks 경고 해소).
  - **미구현 (다음)**: float/clear, writing-mode, BFC 내부 다단(column). block 은 현행 catalog 컨테이너 사용 범위(vertical stacking + inline-block line box)로 한정.
- **검증**: `cargo test` **40/40 PASS** (flex 21 + block 19 = 승계 16 + 잔여 3), clippy 0, 경고 0. seam 미배선 → live builder 영향 0 (WASM 배선은 flex/grid/block 완성 후 dual-run 첫 배선 시점 이연).
- 기존 `block_layout.rs` (625줄) 승계

### 1-D. Dual-run 게이트 (G2)

> **2026-07-03 실행 결정 (사용자 confirm — "1-D 하네스 먼저")**: Phase 1 진입 단위를 breakdown 순서(1-A flex.rs 먼저)에서 **1-D 하네스 먼저**로 재배열. 근거 = flex.rs 의 유일한 검증 경로(dual-run diff)가 하네스이므로, 검증 기반이 산출물보다 선행해야 한다([[feedback-no-dormant-foundation-ahead-of-flip]] — 검증 기반은 flip 앞선 dormant 가 아니라 flip 의 안전망). 하네스 부재 상태로 flex.rs 를 쓰면 R1(CSS 명세 결함) 을 잡을 수단이 0.

- **✅ 비교 엔진 land 2026-07-03**: `dualRunHarness.ts` — 두 `LayoutEngineAPI` 인스턴스(reference=Taffy / candidate=자체 엔진)에 동일 batch 를 먹여 `getLayoutsBatch()` 결과를 elementId 기준 diff. Phase 0-A seam 의 `LayoutEngineAPI` 계약을 그대로 소비(엔진 종류 무관 대칭 비교). 순수 함수(WASM 의존 없음) — type-check 회귀 0.
  - **HC3 2단 판정 구현**: (a) 수치 diff ≤ 1px (`NUMERIC_TOLERANCE_PX`, f32 tolerance) + (b) 1x zoom device pixel round diff 0. `(a) 통과 + (b) 위반` 시 **(b) 우선 FAIL** (pixel 경계 넘는 sub-pixel drift). `pass = numericViolations==0 && pixelViolations==0`.
  - **diff 매칭**: handle 은 엔진별 독립 발급이므로 handle 직접 비교 금지 → `handleToId`/`refHandleToId` 로 elementId 복원 후 매칭. 구조 불일치 노드는 nodeCount 제외.
  - **위반 리포트**: `NumericViolation`/`PixelViolation` (elementId + field + delta/px) + `formatViolations()` 사람 읽기용 포맷.
  - **검증**: `dualRunHarness.test.ts` 5/5 PASS — self-diff(diff 0, 하네스 정확성) / sub-pixel≤1px 같은 pixel PASS / 수치>1px FAIL / pixel 경계 넘는 drift (b)우선 FAIL / handle 정렬 무관 elementId 매칭.
- **✅ 단일 컨테이너 golden land 2026-07-04** (사용자 승인 "1-D fixture golden 생성 착수 승인, 배선까지 한 번에"): `tests/golden.rs` — 세 완결 엔트리(`flex_layout`/`grid_layout`/`block_layout`)의 **전체 파이프라인**을 CSS 명세 유래 기대값으로 회귀 고정 (14 케이스).
  - **golden 방식 재정의 (Phase 경계 유지)**: breakdown 원안의 "Chrome 실측 → golden 자동 생성" 은 dualRunHarness 가 소비하는 **트리 batch 계약(`buildTreeBatch(json) → handles → getLayoutsBatch`)** 을 전제한다. 그런데 세 완결 엔트리는 "단일 컨테이너 + 자식" 평면 f32 계약이지 트리가 아니다 → 트리 오케스트레이션(DFS 빌드 + display 디스패치 + 스타일 해석)은 **Phase 2-A style.rs + 2-B tree.rs** 범위(G5 confirm 필수). 따라서 Phase 1 scope 유지를 위해 **단일 컨테이너 단위 golden**(명세 정확 계산값, 정수 좌표 위주 — Taffy/Chrome 동일 산출)으로 검증 기반 확보. 트리 dual-run golden 은 candidate 트리 배선(2-B) 시점에 dualRunHarness 로 통합.
  - **golden 이 실제 버그 1건 발견 (제 역할)**: `grid.rs` cell x/y offset 이 colStart 바로 앞 트랙 뒤 gap 을 **항상 누락** — `if i < colStart-2` (원본 `GridLayout.utils.ts:621` 승계) 가 명세상 `colStart-1` 이어야 함 (앞선 트랙 각각 뒤 gap 1개). gap>0 grid 의 2번째 이후 컬럼/행이 gap 만큼 좌/상 당겨짐. **원본 JS 승계 버그 = live builder 에도 존재** (현재는 원본 JS·grid.rs 동일 버그라 CSS↔Skia 대칭 유지). 원본 JS 가 live 소비 중 → grid.rs 단독 수정 시 분기 → **원본과 함께 고쳐야 하는 SSOT 정합 결정** (사용자 surface 후 별도 처리). golden 은 명세 정답 유지 + `#[ignore]` 표지, dual-run(Taffy 대조)/수정 시 unignore.
  - flex `align-content` 기본값=stretch 확인 (CSS 명세), block margin collapse 양·음·혼합 부호 case 포함. `golden_field_contract_guard` 로 FLEX_FIELD_COUNT=17 / FIELD_COUNT=19 정적 가드.
  - block.rs test `1 * OUT_FIELDS` identity_op clippy 3건 정리.
  - **검증**: cargo test **77 PASS + 1 ignored** (lib 64 + golden 13/14), `cargo clippy --tests` 0.
  - **⏸️ WASM 트리 batch 엔트리 + `createLayoutEngine` 배선 미착수**: dualRunHarness 트리 계약이 tree.rs(2-B) 선행 요구 = Phase 2 진입(HIGH·G5 confirm) + grid gap 버그 처리 방침이 사용자 판단 대상 → 자동 진입 대신 사용자 surface.
- **⏸️ 트리 dual-run golden 이연 (2-B)**: 트리 batch 계약이 생기는 시점에 실 WASM Taffy self-diff(diff 0) + candidate 트리 dual-run 을 live builder 검증과 통합.
- 기준: 픽셀 diff ≤ 1px (f32 tolerance), 회귀 fixture 전수
- 통과 전 Taffy fallback 경로 유지 (flag)
- 산출물: `dualRunHarness.ts`(비교 엔진 + HC3 2단 diff) + `dualRunHarness.test.ts`(계약 5) + `tests/golden.rs`(단일 컨테이너 golden 14)

### 1-E. Taffy dependency 제거

- Cargo.toml 양쪽에서 taffy 삭제 (`composition-wasm` 0.9 / `composition-layout` 0.10)
- `taffy_bridge.rs` (1,307줄) 폐기

---

## Phase 2: 파이프라인 통합 (모듈별 순차, 각 모듈 G3 게이트)

> **착수 전 G5**: 사용자 scope confirm 필수 (5 모듈 분할 — adr-writing.md M4 의무). Phase 1 완료 시점 실측으로 본 ADR 내 진행 vs 후속 ADR 분리 재판정.

### 2-A. `style.rs` 확장 — Style Resolution 이관

- 대상: `cssResolver.ts`(745) + `cssValueParser.ts`(1,006) + `taffyDisplayAdapter.ts`(515) + `implicitStyles.ts`(2,440)
- `composition-layout/src/style.rs` (599줄) 기반 확장
- implicit styles 는 데이터 주도 매핑 테이블 (tag → style) 로 재구성
- **catalog SSOT 접점**: catalog 파생 스타일 값 보존 — 시각 정본은 `packages/shared/src/catalog/componentCatalog.ts` + `COMPONENT_RULES_TABLE` (`packages/shared/src/catalog/generated/componentRulesTable.ts`), Skia 소비 경로는 `buildSpecNodeData.ts` → `buildCatalogShapes`. 이관 후 /cross-check 전 컴포넌트. (참고: per-component spec 은 ADR-912 cutover 로 삭제 — Frame/Group/Slot 3개만 영구 잔존)

### 2-B. `tree.rs` — fullTreeLayout DFS 이관

- 6-step DFS 파이프라인 (resolveStyle → applyImplicitStyles → enrichWithIntrinsicSize → solve → 2-pass 보정) Rust 일체화
- WASM 경계: 노드당 ~5회 → 문서당 1회 (batch in → batch out)
- 2-pass height 보정 (최악 3× computeLayout) → 단일 패스 내 통합
- layout-engine.md 의 기존 계약 (grid full rebuild 조건, longhand 정책, min-width:auto 에뮬레이션 등) 전수 승계

### 2-C. `scene.rs` — Scene graph dirty detection

- `StoreRenderBridge.detectChangedIds` O(N) → generation counter + dirty bitfield O(1)
- element registry Rust 관리
- **ADR-136 sceneVersion 계약 승계 (canvas-rendering.md §9)**: sceneVersion = layoutVersion + pagePositionsVersion + projection content signature (`scene/buildSceneSnapshot.ts:91` `buildSceneStructureSnapshot` / `:206` sceneVersion hash). signature 계산은 snapshot 빌드 시점만 (pointer hot path 금지), projection-relevant field 추가 시 signature input 동시 갱신 의무 — Rust 이관 후에도 동일 보수 의무 유지

### 2-D. `commands.rs` — Render command stream + SpatialIndex 단일 패스

- `renderCommands.ts` O(N) DFS + z-sort + boundsMap → Rust flat command 배열
- SpatialIndex 갱신을 command 생성과 단일 패스 통합 (`syncSpatialIndex` 복사 제거)
- viewport culling Rust 내부 수행
- canvas-rendering.md §8 scrollOffset 차감 계약 승계

### 2-E. `text.rs` — 텍스트 측정 캐시

- **scope = 측정(measurement) 경로만** — `canvaskitTextMeasurer.ts` 의 결과값 캐시(`:122-127`, Paragraph 객체 아닌 `{width, height}` 만) 를 Rust LRU 로 이관. **render 경로의 Paragraph 객체 캐시(`nodeRendererText.ts:36` `paragraphCache` — `clearParagraphCache()` 로 delete 수명 관리) 는 본 Phase 비대상, 현행 유지**
- **제약 (canvas-rendering.md §3 — 측정 경로 규칙)**: WASM Paragraph 객체 캐싱 금지 — 결과값 `{width, height}` 만 LRU. Layout=Canvas 2D=CSS 정합 원칙 유지
- Rust 측 LRU + batch 측정 요청 (캐시 미스 시 단어당 다중 왕복 → batch 1회)
- 조상 체인 기반 font 상속 해석 (`buildSpecNodeData.ts` O(N×D) 탐색 → 트리 빌드 시 1회 top-down 패스)

### Phase 2 순서 의존성

2-A → 2-B 순서 필수 (tree 가 style 소비). 2-C / 2-D / 2-E 는 2-B 이후 상호 독립.

각 모듈 cutover 완료 시 대응 JS 경로 **즉시 삭제** — dormant 병행 금지 (feedback-no-dormant-foundation-ahead-of-flip).

---

## Crate 구조 (목표)

```
packages/composition-engine/        # 신규 통합 crate (composition-layout 승계)
├── Cargo.toml                      # taffy 의존 없음
└── src/
    ├── lib.rs          # WASM 엔트리 — 단일 batch API
    ├── scene.rs        # 2-C
    ├── style.rs        # 2-A (기존 style.rs 승계 확장)
    ├── tree.rs         # 2-B
    ├── flex.rs         # 1-A
    ├── grid.rs         # 1-B (grid_layout.rs 승계)
    ├── block.rs        # 1-C (block_layout.rs 승계)
    ├── commands.rs     # 2-D
    ├── text.rs         # 2-E
    ├── spatial.rs      # 승계 (spatial_index.rs / spatial.rs 통합)
    └── protocol.rs     # binary_protocol.rs 승계
```

최종 상태: JS ~15,000줄 (UI 바인딩 + CanvasKit draw 호출) + 단일 WASM batch API.

---

## 검증 매트릭스

| 검증                                   | 도구                                          | 적용 Phase       |
| -------------------------------------- | --------------------------------------------- | ---------------- |
| 회귀 fixture (기존 문서 layout 무변화) | dual-run diff 하네스 (신규)                   | 0, 1, 2 전부     |
| CSS↔Skia 시각 대칭                     | /cross-check + parallel-verify                | 2-A, 2-E         |
| 성능 벤치 (1000+ 노드 프레임타임)      | 벤치 하네스 (신규)                            | 각 Phase 전후    |
| WASM 번들 사이즈 (gzip)                | build 리포트                                  | 각 Phase         |
| type-check                             | pnpm type-check                               | 전부             |
| live behavior                          | Chrome MCP 1회 exercise (CLAUDE.md 완료 기준) | 각 Phase cutover |

---

## 순서 의존성 요약

```
Phase 0-A (seam ✅) ─→ Phase 1 self-impl (1-A/B/C ✅ + 1-D 하네스·golden ✅) ┐
                                                                              │ 배선·1-E 이연 (트리 계약 필요)
Phase 0-B (⏸️ 이연) ─────────────────────────────────────────────────────────┼─→ G5 confirm ─→ Phase 2 (2-A → 2-B → {2-C,2-D,2-E})
                                                                              │                            │
              WASM 트리 batch 배선 + 1-E Taffy 제거 + 0-B worker offload ─────┴──── 2-B tree.rs 완료 시점 ──┘
```

- **Phase 0 종료** (2026-07-03): 0-A seam 만 land, 0-B 는 2-B 로 이연.
- **Phase 1 부분 마감** (2026-07-04): self-impl 알고리즘(1-A/B/C) + 1-D 하네스·golden land. **배선(WASM 트리 batch) + 1-E Taffy 제거는 미착수** — 배선이 트리 오케스트레이션(2-B) 선행 요구 → Phase 2 로 이연. 다음 진입점 = **Phase 2 (G5 scope confirm 필수, HIGH — 별도 사용자 승인)**. 병행 미결: grid gap 승계 버그(§1-D) 처리 방침.
