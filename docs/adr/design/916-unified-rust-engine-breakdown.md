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
  - **golden 이 실제 버그 1건 발견 및 후속 처리 완료 (제 역할)**: `grid.rs` cell x/y offset 이 colStart 바로 앞 트랙 뒤 gap 을 누락하던 원본 `GridLayout.utils.ts` 승계 버그를 발견. gap>0 grid 의 2번째 이후 컬럼/행이 gap 만큼 좌/상 당겨지는 live builder 버그였으므로, grid.rs 단독 수정이 아니라 원본 JS live helper와 Rust 후보 엔진을 함께 고치는 SSOT 정합 처리를 2026-07-04 후속으로 완료했다.
  - flex `align-content` 기본값=stretch 확인 (CSS 명세), block margin collapse 양·음·혼합 부호 case 포함. `golden_field_contract_guard` 로 FLEX_FIELD_COUNT=17 / FIELD_COUNT=19 정적 가드.
  - block.rs test `1 * OUT_FIELDS` identity_op clippy 3건 정리.
  - **검증**: 후속 grid gap 처리 후 cargo test **79/79 PASS** (lib 64 + golden 15, ignored 0), `cargo clippy --tests` 0.
  - **⏸️ WASM 트리 batch 엔트리 + `createLayoutEngine` 배선 미착수**: dualRunHarness 트리 계약이 tree.rs(2-B) 선행 요구 = Phase 2 진입(HIGH·G5 confirm). 자동 진입 대신 사용자 scope confirm surface.
- **✅ grid gap 승계 버그 처리 완료 2026-07-04**:
  - **동시 수정**: live JS `GridLayout.utils.ts` 와 후보 Rust `composition-engine/src/grid.rs` 의 leading gap offset 조건을 모두 `colStart-1`/`rowStart-1` 로 정정. grid.rs 단독 수정으로 CSS↔Skia 분기되는 상태를 피하고, Phase 2 tree batch baseline 이 잘못된 JS 버그를 계승하지 않게 막는다.
  - **fixture**: 기존 `golden_grid_fixed_plus_fr_with_gap` 의 `#[ignore]` 제거 + row/column leading gap 동시 fixture 추가. JS live helper 에 `GridLayout.utils.test.ts` 추가.
  - **검증**: `cargo test --manifest-path packages/composition-engine/Cargo.toml` **79/79 PASS** (lib 64 + golden 15, ignored 0), `cargo clippy --manifest-path packages/composition-engine/Cargo.toml --tests` 0, `pnpm exec vitest run apps/builder/src/builder/workspace/canvas/layout/GridLayout.utils.test.ts` PASS, `pnpm run codex:typecheck` PASS.
  - **G5 상태**: grid gap 차단 해소. Phase 2 code 진입은 여전히 아래 G5 scope confirm 선행.
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
> **2026-07-04 G5 confirm 착수**: Phase 1 실측상 self-impl 알고리즘 계층과 단일 컨테이너 golden 은 land, grid gap 차단은 JS+Rust 동시 수정으로 해소. 남은 Phase 2 진입 판단은 (1) 본 ADR 내 `2-A style.rs → 2-B tree.rs` 선착수 후 2-C/2-D/2-E 재판정, 또는 (2) Phase 2 전체를 후속 ADR 로 분리 중 선택. 안전 기본값은 **본 ADR 내 2-A/2-B 선착수 + 2-B 이후 후속 모듈 재판정**이다.

### 2-A. `style.rs` 확장 — Style Resolution 이관

> **2026-07-04 G5 confirm 후 착수 (사용자 "본 ADR 내 2-A/2-B 선착수" + "세 실측 결정 승인, 첫 단위 착수")**: 착수 전 실사로 breakdown 서술 대비 실측 3건 확정. (1) **style.rs 위치 정정** — 원안 "`composition-layout/src/style.rs`(599줄) 기반 확장" 은 **stale**. composition-layout 은 Taffy 0.10 종속 crate(폐기 예정, Phase 0-A 결정문 명시)이고 Phase 1 self-impl 은 전부 `composition-engine`(taffy 무의존)으로 이동됨 → 2-A 도 `composition-engine/src/style.rs` **신규**가 정합([[feedback-no-dormant-foundation-ahead-of-flip]] — 폐기될 crate 위에 짓지 않음). Phase 1 crate 결정의 자연 승계라 fork checkpoint 4질문 대상 아님(전제·의존 방향 재판정 아님). (2) **이관 경계** — `cssValueParser.ts` 의 DOM 의존(`getComputedStyle(document.documentElement)`, var()/토큰 해석)은 한 곳으로 격리됨 → WASM 이관 불가, **JS 잔류**. 순수 산술만 Rust 이관 — var()/토큰은 JS 가 선해석해 순수 값으로 만든 뒤 산술 파싱을 Rust 에 전달(Phase 1 flat f32 센티넬 철학 동일). (3) **첫 착수 단위** — 4,700줄 통이관 불가(M4) → 가장 작은 검증 가능 단위 = CSS 값 산술 파서 커널만.

- **✅ CSS 값 산술 파서 커널 land 2026-07-04** (첫 단위):
  - `packages/composition-engine/src/style.rs` 신규 — `cssValueParser.ts` 의 순수 산술 계층 이식. `resolve_css_size_value`(진입점) + `resolve_unit_value`(px/rem/em/vw/vh/vmin/vmax/in/cm/mm/pc/pt/ch/ex/% + 단위없는 숫자) + `resolve_calc`(재귀 하강 파서 + `tokenize_calc`) + `resolve_clamp`/`resolve_css_min`/`resolve_css_max` + `resolve_env`(safe-area-inset 4종→0) + `split_css_function_args`(괄호 깊이 추적).
  - **계약**: JS `number | undefined` → Rust `Option<f32>`. `CSSValueContext` → `CssValueContext`(parent_size/container_size/viewport/root_font_size 스칼라, variableScope 제외=DOM 의존 JS 잔류). intrinsic 키워드 → 센티넬 f32(`FIT_CONTENT=-2`/`MIN_CONTENT=-3`/`MAX_CONTENT=-4`, Phase 1 `AUTO=-1` 계열 규약 동일). `parse_leading_f32` 로 JS `parseFloat("12abc")===12` 재현.
  - **rem-before-em 검사 순서** / **% 는 container 미제공 시 None** / **calc 0-division None** / **미종결 괄호 None** 등 원본 edge case 그대로 승계.
  - **미이식 (JS 잔류/후속 단위, 첫 단위 완료 시점)**: `resolveVar`/`resolveVariableFromDOMDefault`/`createVariableScopeWithDOMFallback`(DOM 조회, JS 잔류), `parseFontShorthand`/`parseBorderShorthand`(shorthand 분해, 아래 후속 단위에서 처리 완료), `cssResolver.ts`/`taffyDisplayAdapter.ts`/`implicitStyles.ts` 전체(2-A 후속).
  - **검증**: `cargo test` **106 PASS** (lib 90 = 기존 64 + style 26 / golden 15 / doc-test 1), clippy --tests 0. 원본 JS 산술 계약 대조(1in/cm/pt/rem/vmin/calc/clamp) 값 일치 확인. seam 미배선 순수 함수 → live builder 영향 0, dual-run/cross-check N/A(트리 배선은 2-B 이후).
- **✅ font/border shorthand 단위 land 2026-07-04** (사용자 승인 "1"):
  - **font shorthand**: JS `parseFontShorthand` 계약 승계. `ParsedFont { font_style, font_weight, font_size, line_height, font_family }` optional string 구조. `normal` 은 결과에서 제외, `font-variant` 는 인식만 하고 미소비(원본 동일), 숫자 weight/keyword weight와 `size/line-height` 분해, quoted family/comma family 보존.
  - **border shorthand**: JS `parseBorderShorthand` 계약 승계. `ParsedBorder { width, style, color }`, 순서 무관 width/style/color 분해. width 는 JS `parseFloat` 근사(`1.5rem`→`1.5`)이고 색상 함수 전체 파싱은 하지 않음(원본 동일). 기본값은 `{width:0, style:"none", color:"#000000"}`.
  - **검증**: TDD RED(함수/구조체 없음) → GREEN. `cargo test --manifest-path packages/composition-engine/Cargo.toml shorthand` 6/6 PASS, 전체 `cargo test` **112 PASS** (lib 96 / golden 15 / doc-test 1), `cargo clippy --manifest-path packages/composition-engine/Cargo.toml --tests` 0.
  - seam 미배선 순수 함수 → live builder 영향 0. dual-run/cross-check 는 2-B 트리 배선 이후.
- **✅ cascade 순수 헬퍼 land 2026-07-04** (`cssResolver.ts` 이관 첫 단위):
  - `packages/composition-engine/src/cascade.rs` 신규 — `cssResolver.ts` 의 **자기완결 순수** 계층 이식. 실사로 store/DOM 의존이 `getRootComputedStyle()` 한 곳(`useThemeConfigStore.getState()`)에만 격리됨을 확인 → 나머지 순수 로직/데이터 테이블만 이식.
  - **이식**: `is_inheritable_property`(상속 속성 19종) / `css_initial_value`(초기값 맵) / `resolve_cascade_keyword`(inherit/initial/unset/revert, `CascadeResult::Inherit|Value`) / `resolve_current_color`(currentColor 단어 경계 치환 — `\bcurrentColor\b/gi` 재현) / `resolve_font_variant_features`+`DEFAULT_FONT_FEATURES`(font-variant→OpenType) / `resolve_logical_properties`(논리→물리, LTR, shorthand 2값 분리 + 물리 우선).
  - **계약**: JS `Record<string, string|number>` → `BTreeMap<String, CssValue>` (`CssValue::Str|Num` enum, string/number 혼합 대응). INHERIT_SENTINEL → `CascadeResult::Inherit`. 논리 속성 반복 순서는 원본 `LOGICAL_TO_PHYSICAL`/`LOGICAL_SHORTHAND_TO_PHYSICAL` 정의 순서 상수(`LOGICAL_KEYS`/`SHORTHAND_KEYS`)로 재현.
  - **미이식 (다음 단위/JS 잔류)**: `getRootComputedStyle`/`ROOT_COMPUTED_STYLE`(store 의존 → JS 가 root computed style 계산해 전달), `resolveFontStretchWidth`(`@composition/specs` `FONT_STRETCH_KEYWORD_MAP` = ADR-091 spec SSOT 의존 → Rust crate 의 spec 데이터 참조 계약이 아직 없어 이번 단위 제외, spec SSOT 이중화 회피), `resolveStyle` 본체(캐스케이드 진입점 = 위 헬퍼 조립 단위).
  - **검증**: `cargo test` **130 PASS** (lib 114 = 이전 96 + cascade 18 / golden 15 / doc-test 1), clippy --tests 0. 원본 JS 로직 대조 — currentColor(whole/compound/단어경계) + cascade(inherit/initial/unset color·margin/customProp) + font-variant 대소문자 전 케이스 값 일치. seam 미배선 순수 함수 → live 영향 0.
- **✅ display 순수 문자열 계층 land 2026-07-04** (`taffyDisplayAdapter.ts` 이관 첫 단위):
  - `packages/composition-engine/src/display.rs` 신규 — `taffyDisplayAdapter.ts` 의 **자기완결 순수** display 문자열 변환 계층 이식. 실사로 tag/node 의존 함수(`getElementDisplay`=`INLINE_BLOCK_TAGS`, `needsBlockChildFullWidth`/`toTaffyDisplay` childElements, `VERTICAL_ALIGN_MIDDLE_TAGS`)와 순수 문자열 함수를 분리.
  - **이식**: `parse_display`(CSS Display Level 3 이원 구조 9종 매핑 + block 폴백) / `display_to_string`(역변환) / `classify_child_display`(block/inline/none) / `blockify_display`(CSS L3 blockification, outer:inline→block, inner 유지) / `is_inline_level`. `Display{outer, inner}` → Rust `OuterDisplay`/`InnerDisplay` enum.
  - **미이식 (다음 단위/tree.rs 2-B)**: `getElementDisplay`(`INLINE_BLOCK_TAGS` = 컴포넌트 tag 도메인 지식 의존 → cascade `resolveFontStretchWidth` 와 동일 패턴, tag 분류 SSOT 이중화 회피), `needsBlockChildFullWidth`/`toTaffyDisplay` childElements 경로(`CanvasLayoutNode` 자식 배열 → tree.rs 노드 계약과 함께), `VERTICAL_ALIGN_MIDDLE_TAGS`(tag Set).
  - **검증**: `cargo test` **137 PASS** (lib 121 = 이전 114 + display 7 / golden 15 / doc-test 1), clippy --tests 0. 원본 JS 로직 대조 — blockify(8케이스)/classify(inline-flex→block 포함 7케이스)/roundtrip(9종) 전 케이스 값 일치. seam 미배선 순수 함수 → live 영향 0.
- **남은 2-A 단위 (다음)**: `resolveStyle` 본체(cascade 진입점 조립) + `resolveFontStretchWidth`(spec SSOT 참조 계약 확정 후) + display tag 기반 함수(getElementDisplay 등) → `implicitStyles.ts`(tag→style 데이터 주도 매핑 테이블, 2,440줄 최대 단위). tag/node/spec 의존 단위는 tree.rs(2-B) 노드 계약 또는 spec 참조 계약 확정 후. 각 단위 착수 시 동일하게 최소 검증 단위 확인.
- implicit styles 는 데이터 주도 매핑 테이블 (tag → style) 로 재구성
- **catalog SSOT 접점**: catalog 파생 스타일 값 보존 — 시각 정본은 `packages/shared/src/catalog/componentCatalog.ts` + `COMPONENT_RULES_TABLE` (`packages/shared/src/catalog/generated/componentRulesTable.ts`), Skia 소비 경로는 `buildSpecNodeData.ts` → `buildCatalogShapes`. 이관 후 /cross-check 전 컴포넌트. (참고: per-component spec 은 ADR-912 cutover 로 삭제 — Frame/Group/Slot 3개만 영구 잔존)

### 2-CAT. Catalog 정적 참조 계약 — 조상 체인 propagation 이관 선결 (설계 확정 2026-07-05)

> **성격**: 2-A 잔여(`resolveStyle` 본체 / `implicitStyles`)와 2-B 조상 체인 흡수가 **공통으로 대기하던 선결 계약**. 2-A §"남은 단위" 의 "`resolveFontStretchWidth`(spec SSOT 참조 계약 확정 후)" 및 2-E→2-B 흡수 결정의 그 '참조 계약'이 본 절이다. 새 ADR 아님 — breakdown 내부 계약. **설계만 확정, 구현 미착수** (HIGH — 별도 사용자 승인).

**착수 경위 (2026-07-05, 사용자 "다음 진입점 정리" → "catalog 참조 계약 먼저 설계" → "설계 v2 재작성")**: 조상 체인 propagation(`buildSpecNodeData.ts` `getPropagationAncestors`:313 + `applyParentPropagationProps`:361) 이관의 의미 있는 단위는 catalog(`resolveComponentRule`)+token(`resolveToken`) 정적 참조를 Rust 측에 선결로 요구. 실사 → 설계 v1 → 적대적 반대심문 3건(S3 주입 / color 이연 / oracle·gate) 이 **CRITICAL 3 + HIGH 6** 결함 확정 → v2 재작성으로 봉합. framing: 이관 후보 전제 + 벤치=정당화([[feedback-rust-migration-candidate-bench-justifies-not-gates]]), dormant 회피([[feedback-no-dormant-foundation-ahead-of-flip]]).

**핵심 방향 (S3 런타임 1회 주입)**: JS `buildCatalogStaticSnapshot()`(builder 계층 — shared 테이블 + specs resolveToken 동시 import 가능 유일 계층)이 앱 로드 시 (type×size)→**숫자 metrics 스냅샷** 생성, `initCompositionEngineWasm()` promise 내부 WASM 1회 원자 주입. **TokenRef 문자열이 WASM 경계를 넘지 않음** → 값 사본 repo 미보관 → **값 이중화 0**. Rust `catalog.rs`(신규) 는 조회 전용. (S1 값 사본 커밋 / S2 build-time 생성 = 정본 2벌 HIGH 로 기각. ADR-912 생성기 삭제·손 편집 정본 결정과 정합.)

**정직성 정정**: v1 의 "무이중화" 는 과잉 주장. Taffy 폴백 엔진이 존재하는 한 propagation **로직**은 JS/Rust 양쪽에 한시 병존(폴백 경로용) → **값 이중화 0 + 로직 이중화는 Taffy 완전 제거(endgame) 시점까지 HIGH 잔존(R4)**.

**계약 강화 5개 조항** (v2, 반대심문 봉합):

1. **사영 = key 단위 allowlist** (`fontSize`/`lineHeight`/`iconSize` 3 key + `defaultSize`). 서브트리 사영 금지 → `height:"auto"`(componentRulesTable.ts:1473+) / nested `indicator{}`(:9556+) / sizes 내 `borderRadius:"{radius.*}"`(:38+) 를 **범위에서 제거**(C1·H5 구조적 봉합). height/indicator 는 사영 밖 — indicator 유일 소비자 `resolveSliderProps` 가 이관 scope 밖(§제외 목록)이라 발산 벡터 없음.
2. **defaultSize fallback 1급 조항**: `resolve(type,size) = sizes[size] ?? sizes[defaultSize]` Rust 이식(live 소비자 3경로 `buildSpecNodeData.ts:1124` / `implicitStyles.ts:204-226` / `StoreRenderBridge.ts:553` 동형). JS 사전 전개 기각(L2 검증 불가). Negative = "미존재 **type**→None" 만 (C2 — v1 "미존재 size→None" 은 정반대라 폐기).
3. **oracle 순환 파괴 — 독립 권위 leg (L0)**: v1 3-레벨은 양변 동일 `resolveToken` → shared-fault 맹목(재현 이력: ADR-913 `{radius.xs}` silent undefined). L0 = primitive↔CSS parity(CSS `shared-tokens.css` 텍스트 직접 파싱, resolveToken 미경유). ✅ **Land 2026-07-05 (`4bcb611fa`)** — `typographyCssParity.ts` 9 test PASS. **실측 정정(M3, 추정 vs 실측 gap = 절차 정밀화)**: 사영 allowlist 는 `fontSize`/`lineHeight`/`iconSize` 만(조항 1)이라 spacing 은 애초에 사영 밖 + primitive `spacing.md=16` 과 CSS `--spacing-md:12px` 는 spacing.ts 주석이 명시한 **의도된 별개 계열**(발산 벡터 아님) → v2 초안의 "도입 즉시 spacing RED 예상" 은 오예측(폐기). L0 이 실제 검출한 발산 1건 = **`text-xl--line-height`**(primitive 30 vs CSS `calc(1.75/1.25)×20px=28`) → `KNOWN_TYPOGRAPHY_DIVERGENCES` ledger 명시 등록(침묵 skip 금지), 그 외 typography 전수 정합. oracle 작동 증명 3방식: positive 전수 정합 통과 + ledger 재확인(stale 방지, 여전히 발산 상태 assert) + negative fixture(변조 CSS 를 RED 로 검출). 실수정(어느 값이 정본인지 판정 + Skia/DOM 동시 정렬)은 별도 D3 symmetric 단위(R10). + L1.5 손검증 golden 앵커 + strict resolve throw(C3).
4. **doc override 타입 분리**: `resolveStaticComponentRule(type)`(doc 파라미터 없음) 신설, 스냅샷 빌더·propagation 소비자 강제 → override 유입 = **compile error**. grep gate 보조 강등(adr912 grep escape 선례 회피). doc.componentRules 는 scope-out, non-empty 감지 시 재빌드+재주입 Gate 를 Phase 2 선결 등록(H3 — live 호출 6건 기존재).
5. **주입 대상·ready·fail-loud**: 스냅샷 = Rust `thread_local` static(per-instance 아님 — startup 인스턴스 0개). init promise 내부 원자 주입. `isAvailable()` 2조건(`engineModule!==null && catalogInjected`). 미주입 lookup = dev panic/prod console.error + JS 폴백(침묵 default 금지). HMR 재주입 보장(H2).

**이관 scope 고정 (H4)**: registry 4심볼(`propagationPathMatches`:286 / `getPropagationAncestors`:313 / `resolvePropagationValue`:340 / `applyParentPropagationProps`:361) **만**. parent-read 주입군 7종(`resolveButtonChildColor`:675 color TokenRef 주입 / `resolveProgressProps`:709 / `resolveSliderProps`:766 / `resolveIconDelegation`:800 / `resolveTagListItemsFromParent`:860 / `resolveParentDelegatedSize`:409 / Tab ancestor)은 **명시적 제외**(JS 잔존) → "이관 scope color 축 = 0건" 성립. 값 전달 = 타입 불문 opaque passthrough(variant 전파 9건 필터 금지) / catalog 읽기 = Button.sizes 치수 3 key 뿐.

**Phase 순서 — dormant 회피 (H6, C-2b 선례)**:

| 단계         | 내용                                                                                                                                             | 완료선                                                                               |
| ------------ | ------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------ |
| P2-CAT ①     | `resolveStaticComponentRule` + strict resolve 파이프라인(`parsePxValue` 경유, `Number()` 금지, isFinite assert) + `buildCatalogStaticSnapshot()` | ✅ Land 2026-07-05 (`1a48ec78a`) — 순수 계층, 배선 0                                 |
| P2-CAT ②     | L0 parity(typography ledger) + L1 구조 정합 + L1.5 golden 앵커                                                                                   | ✅ L0 Land 2026-07-05 (`4bcb611fa`) — 9 test, 순수 검증. L1/L1.5 는 P2-CAT ③ 착수 시 |
| P2-CAT ③     | Rust `catalog.rs` + `inject_catalog_snapshot` + L2 cargo fixture                                                                                 | **← P2-CAT 완료선** (cargo 소비자 있음, dead 아님)                                   |
| P2-PROP 동시 | init 주입 배선 + `isAvailable()` 2조건 + fail-loud 발동 + tree.rs propagation 이관 + **L3 dual-run**                                             | **소비 phase 착수와 동시** (배선 선행 = dormant)                                     |

L3(행동 dual-run diff 0) 소유는 완료 phase(2-B)가 아니라 **P2-PROP(조상 체인 이관 phase)** 로 재지정 — 완료 phase 위임 = 소유자 공백(H6).

**Phase 순서 재정의 (2-A→2-B "순서 필수" 정밀화)**: 조상 체인 propagation 이 소비하는 것 = catalog sizes 층 + 토큰 정적 층뿐(`buttonTextMetrics`/`buttonIconPx`), `resolveStyle` 본체·`implicitStyles`(2,440줄) 아님. 따라서 **"완료된 2-A 순수 계층 + P2-CAT → 2-B 조상 체인 개방"**. 2-A 잔여(resolveStyle 조립/implicitStyles/display tag)는 조상 체인의 선결 아님(병행/후행 가능). `resolveFontStretchWidth` "spec SSOT 참조 계약 확정 후" 대기도 P2-CAT 로 해제.

**잔존 위험 (정직)**: R4(폴백 로직 이중화 HIGH — Taffy 제거까지 dual-run CI 상시로 관리, 소멸은 endgame) · R10(typography `text-xl--line-height` live 발산 MED — primitive 30 vs CSS 28, L0 이 표면화한 실채무, `KNOWN_TYPOGRAPHY_DIVERGENCES` ledger 등록됨. 별도 수정 단위 = 정본 판정 + Skia/DOM 양 consumer 동시 D3 symmetric). 나머지 CRITICAL 3+HIGH 4 는 위 5조항+scope 고정으로 봉합.

> 설계 v2 전문(§1~8 + Risk/Gate 10항 1:1 + v1↔v2 봉합 색인)은 세션 기록. 구현 상세(파일별 변경/커밋 분해/테스트 배치)는 착수 시 본 절 확장.

### 2-B. `tree.rs` — fullTreeLayout DFS 이관

- 6-step DFS 파이프라인 (resolveStyle → applyImplicitStyles → enrichWithIntrinsicSize → solve → 2-pass 보정) Rust 일체화
- WASM 경계: 노드당 ~5회 → 문서당 1회 (batch in → batch out)
- 2-pass height 보정 (최악 3× computeLayout) → 단일 패스 내 통합
- layout-engine.md 의 기존 계약 (grid full rebuild 조건, longhand 정책, min-width:auto 에뮬레이션 등) 전수 승계

> **2026-07-04 2-B 착수 전 실사 — 서술 대비 실측 gap (사용자 scope confirm 대기)**: 위 "6-step DFS 일체화" 서술은 **최종 목표**지만 실측상 한 번에 이관 불가. 경계 확정:
>
> | DFS 단계                                                                                                                                                                                                                                         | 실측 도메인 의존                                                                   | 이관 판정                                                                                       |
> | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------- |
> | 상단 3-step: `resolveStyle`(`cssResolver.ts` — `getRootComputedStyle()` store 의존) + `applyImplicitStyles`(tag/spec 의존) + `enrichWithIntrinsicSize`(`extractSpecTextStyle` @composition/specs + `resolvePropagatedProps` propagationRegistry) | tag/spec/store 도메인                                                              | **JS 잔류** (2-A 에서 순수 계층 style/cascade/display 만 격리한 이유 — 도메인 의존은 격리 불가) |
> | 하단: `PersistentTaffyTree` 가 `LayoutEngineAPI` 를 호출하는 표면 — `buildTreeBatch(JSON.stringify(payload))` → `computeLayout(root,w,h)` → `getLayoutsBatch(handles)` (+ 증분 `updateStyleRaw`/`setChildren`/`markDirty`/`removeNode`)          | 순수 트리 계산 (payload 의 `node.style` 은 상단이 이미 순수화한 TaffyStyle 레코드) | **Rust `tree.rs` 이관 대상** (flex/block/grid.rs 를 트리로 오케스트레이션)                      |
>
> - **실측 scope(옵션 A)**: `tree.rs` = `LayoutEngineAPI` batch 계약 구현 — nodesJson 직렬화 트리를 받아 노드별 display 로 flex/block/grid.rs 디스패치하며 계산, 결과 batch 반환. 상단 style resolve/implicit/enrich 는 JS 잔류. 이 자리는 `layoutBridge.ts:26` `LayoutEngineAPI` + `layoutBridge.ts:63` `createLayoutEngine()` seam 에 이미 정의됨 (Phase 0-A). 배선 시점부터 live 영향 발생 → dual-run(Taffy self-diff 0) 검증 필수.
> - **gap 처리 원칙 (adr-writing.md M3)**: 서술 vs 실측 gap 은 **Phase 0 inventory 절차 정밀화(breakdown 서술 정정)로 흡수** — 새 ADR fork 사유 아님. 상단 3-step 이관은 spec 참조 계약(catalog 도메인)이 선행돼야 하므로 별도 후속 단위이며, tree.rs 하단 batch 계약 이관과 독립.
> - **scope 확정 (2026-07-04, 사용자 "실측 하단만 착수")**: 옵션 A 채택. `tree.rs` = `LayoutEngineAPI` batch 계약 구현, DFS 상단은 JS 잔류. gap 은 위 서술 정정으로 흡수(새 ADR 아님).

**2-B 아키텍처 gap + 층별 점진 단위 분할 (2026-07-04 착수 실사)**: flex/block/grid.rs 는 모두 "단일 컨테이너 + 자식 flat f32 → 자식 위치" **1-depth 커널**(Phase 1 flat f32 센티넬 계약)인데, batch 계약(`build_tree_batch`→`compute_layout`→`get_layouts_batch`)은 **N-depth 트리 상호의존**(부모 크기 ↔ 자식 intrinsic)을 해결해야 한다. 즉 tree.rs 는 flat 커널들을 재귀 트리로 오케스트레이션하는 계층 전체를 새로 작성 — 큰 단위라 2-A 최소 검증 단위 패턴으로 층별 분할:

> **단위 2/3 재정의 (2026-07-04 단위 2 착수 실사)**: 원안 "단위 2=intrinsic(bottom-up) / 단위 3=placement(top-down)" 분리는 실측상 불가. flex/block/grid.rs 는 **컨테이너 자기 크기를 반환하지 않으므로**(자식별 `[x,y,w,h]` 만) height:auto 부모의 intrinsic 은 **자식을 먼저 배치(커널 호출)해 bounding box 를 봐야** 나온다 — intrinsic ↔ placement 물리적 분리 불가. 따라서 두 단위를 "post-order 트리 solve" 한 단위로 병합하고 내부를 display 별(flex → block/grid) 최소 검증층으로 재분할. 이는 승인된 옵션 A(실측 하단 착수) 내부의 단위 경계 조정 — scope 확대/fork 아님.

| 단위         | scope                                                                                                                                                                                                                                                                       | 상태               |
| ------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------ |
| **단위 1**   | tree 자료구조 + handle 관리(alloc/recycle, taffy_bridge `alloc_handle`/`resolve` 대응) + `build_tree_batch` 골격(post-order 파싱·저장·handle 배열, forward-ref 거부) + `get_layouts_batch` flat 반환 + 증분 API. `compute_layout` = **leaf-only**(자기 크기만, 자식 좌표 0) | ✅ Land 2026-07-04 |
| **단위 2**   | **post-order flex solve** — flex 컨테이너에서 자식 재귀 solve → `flex.rs`(`flex_layout`) 배치 → 자식 bounding box 로 컨테이너 content 크기(height:auto sentinel) 도출. NodeStyle → flex flat f32(논리축 매핑) 변환 + CSS 키워드 → u8 매핑                                   | ✅ Land 2026-07-04 |
| **단위 3-a** | **block dispatch** — block 컨테이너에서 자식 재귀 solve → `block.rs`(`block_layout`) 배치 → 자식 bounding box 로 컨테이너 크기 도출. NodeStyle → block flat f32(19필드, 물리축) 변환. margin collapse/auto-width stretch/fit-content 는 block.rs 내부 처리                  | ✅ Land 2026-07-04 |
| **단위 3-b** | **grid dispatch** — `grid_layout`. grid 는 계약이 근본적으로 다름(자식 flat 없음, template/placement 문자열). NodeStyle `grid_template_columns: Vec<String>` → space-join, 자식 gridColumnStart/End → `parse_grid_line` 결합 형식 재조립 → `parse_placements` 파이프 직렬화 | ✅ Land 2026-07-04 |
| **단위 4**   | 증분 dirty 추적 + 재계산 최소화 (taffy mark_dirty 대응, `updateStyleRaw`/`setChildren` 증분 경로). 증분 API 가 변경 노드 + 조상 체인 dirty 전파 → `solve_node` 는 clean 서브트리 skip(저장 layout 재사용), dirty 서브트리만 재계산 + available 변경/clear 시 skip 무효화    | ✅ Land 2026-07-04 |

- **단위 1 검증**: `LayoutTree`(`nodes: Vec<Option<TreeNode>>` + `free_list`) + `NodeStyle`(StyleInput 전체 스키마 camelCase 정합) + `build_tree_batch`(child index `>= i` forward-reference 거부 = taffy_bridge `handles.get(idx)` None 정책과 동일 의미) + `compute_layout` leaf-only(`resolve_self_size` → style.rs `resolve_css_size_value`, auto/intrinsic 센티넬은 0 — 단위 2 이전) + `get_layouts_batch` flat. cargo test **152 PASS**(lib 136 = 121+tree 15 / golden 15 / doc-test 1), clippy --tests 0, taffy_bridge.rs batch 계약 대조(child index 치환 / flat shape / handle 재활용) 일치. seam 미배선 순수 Rust → live 영향 0.
- **단위 1 미포함(다음 단위 명시)**: 자식 배치 전면(intrinsic 측정·placement·display dispatch), height sentinel(-1)→MaxContent(단위 2), grid template/areas 소비(단위 3, grid.rs 위임), 증분 dirty 재계산 최소화(단위 4). 단위 1 은 handle 계약·크기 해결 커널·batch 직렬화만 검증.
- **단위 2 검증**: `compute_layout` = post-order `solve_node` — leaf/비-flex 는 자기 크기, flex 는 `solve_flex`(자식 재귀 solve → `write_flex_item` 로 flex flat f32 = direction 별 width↔main·height↔cross 매핑, padding/border 축 합산, min/max 논리축, content_main/cross=자식 solve 결과 → `flex::flex_layout` → 자식 좌표 반영 + bounding box → 컨테이너 크기). CSS→u8 매핑(`parse_flex_direction`/`parse_justify_content`/`parse_align_items`/`parse_align_content`/`parse_flex_wrap`)은 flex.rs 상수 리터럴 대조. cargo test **158 PASS**(lib 142 = 136+flex solve 6 / golden 15 / doc-test 1), clippy --tests 0. 검증층 = flex row/column, gap, 명시 크기 자식, height:auto intrinsic 도출, 중첩 flex bottom-up. seam 미배선 → live 영향 0.
- **단위 2 발견(flex.rs 알려진 제약)**: `flex.rs` `ALIGN_STRETCH`(align-items 기본값)가 자식 **명시 cross size 를 무시**하고 컨테이너 cross available 로 stretch(flex.rs:664). CSS 명세상 stretch 는 cross size `auto` 만 대상 → flex.rs Phase 1 버그. 단위 2 tree.rs 는 이를 건드리지 않고(scope: 오케스트레이션), 테스트를 `align-items:flex-start` 로 우회해 solve 로직만 검증. flex.rs stretch 수정은 Phase 1 flex.rs 후속(별도 착수).
- **단위 2 미포함(다음 단위 명시)**: block/grid dispatch(단위 3 — 현재 비-flex 컨테이너는 자기 크기만, 자식 미방문), row-reverse/column-reverse(축만 매핑, reverse 미구현), flex-basis:content/px(단위 3 이후), 증분 dirty 재계산 최소화(단위 4). **컨테이너 크기 = 자식 bounding box 근사** — Taffy formatting context 정확값과의 정합은 seam 배선 후 dual-run(Taffy self-diff 0)에서 검증(현재 명세 정확값 케이스로만 확보).

> **단위 3 재분할 (2026-07-04 착수 실사)**: flex/block/grid.rs 세 커널의 계약이 비대칭이라 단위 3 을 display 별 최소 검증층으로 재분할한다. **flex.rs(17필드, 논리축)** 와 **block.rs(19필드, 물리축)** 는 둘 다 "자식 flat f32 → 자식 위치" 커널이라 solve 패턴이 같지만(자식 재귀 solve → flat 직렬화 → 커널 → bounding box), **grid.rs 는 근본적으로 다르다** — 자식 flat 을 안 받고 `template_cols/rows/areas` + `placement_spec` **문자열**만 받아 트랙 산술로 셀을 배치한다(자식 크기는 트랙이 결정, intrinsic track 미측정). 따라서 block(3-a, flex 와 계약 근사)을 먼저, grid(3-b, 문자열 어댑터 필요)를 나눠 착수. 승인된 옵션 A 내부의 단위 경계 조정 — scope 확대/fork 아님.

- **단위 3-a 검증**: `solve_node` 의 `ContainerDisplay::Block` 분기 → `solve_block`(자식 재귀 solve → `write_block_item` 로 block flat f32 = 19필드 물리축, display code(block/inline-block)/margin 4-way/pad*border v·h 축 합/min·max/content_w·h → `block::block_layout(data, w, h, false, false, 0)` → 자식 좌표 반영 + bounding box → 컨테이너 크기). `classify_container_display` 확장 — flex/inline-flex→Flex, grid/inline-grid→Other(3-b), 그 외(block/inline-block/미설정)→Block. cargo test **164 PASS**(lib 148 = 142+block dispatch 6 / golden 15 / doc-test 1), clippy --tests 0. 검증층 = block vertical stack, 자식 margin collapse(block.rs 내부), auto-width stretch, explicit px+padding border-box, height:auto intrinsic=stacking 합, display 미설정→block. grid 컨테이너는 Other 분기로 자기 크기만(단위 3-b 전 자식 미방문) 확증. **참조 자산 대조**: taffy_bridge.rs 는 Taffy 내장 solver(TaffyTree) 사용 — 자체 `block_layout` 미호출이므로 `can_collapse*\*=false` 가정은 batch 계약과 무관(정합 위반 없음). seam 미배선 → live 영향 0.
- **단위 3-a 미포함(다음 단위 명시)**: grid dispatch(단위 3-b — grid 컨테이너는 현재 자기 크기만, 자식 미방문), 부모-자식 margin collapse 전파(block.rs OUT trailing metadata 2필드 = firstChildMarginTop/lastChildMarginBottom 미소비, `can_collapse_*=false` BFC 격리 가정 — tree.rs 레벨 metadata 배선은 별도 단위), inline-block line box 의 tree.rs 레벨 baseline 전달(현재 valign=baseline/baseline=0 기본, 상단 blockify 가정), BFC 감지(bfc_flag=0 고정 — 상단/후속 단위), 증분 dirty(단위 4).
- **단위 3-b 검증**: `solve_node` 의 `ContainerDisplay::Grid` 분기 → `solve_grid`(grid.rs 문자열 계약 어댑터 → `grid::grid_layout` → 셀 bounds → 각 자식 셀 크기로 재귀 solve → 셀 좌표 반영 + bounding box → 컨테이너 크기). 어댑터 3요소: (1) `join_tracks`(track array `["1fr","auto"]` → space-join `"1fr auto"`, grid.rs `tokenize_template` 재분해 무손실), (2) `combine_grid_line`(NodeStyle `gridColumnStart`+`End` 분리 값 → grid.rs `parse_grid_line` 결합 형식 `"{start} / {end}"` 재조립, `normalize_grid_line_part` 로 auto/미설정은 None), (3) `build_grid_placement_spec`(자식들을 `area_name|grid_column|grid_row` 파이프+개행 직렬화, 전부 auto 면 빈 문자열). cargo test **169 PASS**(lib 153 = 148+grid dispatch 6−삭제 1 / golden 15 / doc-test 1), clippy --tests 0. 검증층 = 2열 auto-placement row-major, col/row gap 셀 좌표 반영, gridColumn span(1/3=2트랙 폭), fr track 분배(1fr 2fr=100/200), grid 셀 안 flex 컨테이너 재귀 solve(손자까지), height:auto intrinsic=셀 bounding box. **참조 자산 대조**: fullTreeLayout payload 직렬화(`gridColumnStart`=`String(...)` 개별 필드 / `gridTemplateColumns`=`coerceGridTrack`→track array)가 NodeStyle 계약(`grid_column_start: Option<String>` / `grid_template_columns: Option<Vec<String>>`)과 1:1 일치 — 어댑터가 상류 직렬화 계약 정합. seam 미배선 → live 영향 0.
- **단위 3-b 발견(grid.rs 알려진 제약, scope 밖)**: grid.rs 는 (1) intrinsic track 미측정(`min-content`/`max-content` → 0 폴백 — 자식 크기가 트랙을 늘리지 않음), (2) 음수 line index(`"-1"` = 끝에서부터)를 `cell_bounds_for_child` 에서 `(x-1).max(0)` 로 0 clamp(완전 미지원), (3) dense packing 역채움/subgrid/baseline 미구현(grid.rs module doc 명시). tree.rs 어댑터는 값을 그대로 전달하고 grid.rs 처리 방식을 따름 — 이 제약들은 grid.rs Phase 1-B scope(별도 착수). grid item stretch(셀을 채움)는 단위 3-b 기본값(자식을 셀 크기로 override) — `justify-self`/`align-self` 별 셀 내 정렬은 미구현(다음 단위).
- **단위 3-b 미포함(다음 단위 명시)**: `justify-self`/`align-self` 셀 내 정렬(현재 자식이 셀 stretch 채움), `grid-template-areas` named area(NodeStyle 에 필드 없음 — Skia 경로는 숫자 line, factory 가 이름+line 병기), `grid-auto-flow: column`/dense, intrinsic track(grid.rs 미측정), 증분 dirty(단위 4). 셀 크기 = 트랙 산술 확정값 — Taffy grid formatting context 정확값 정합은 seam 배선 후 dual-run 에서 검증.
- **단위 4 검증**: 증분 dirty 추적 이관. (1) `TreeNode` 에 `parent: Option<usize>` 추가 + `set_children`/`build_tree_batch` 가 자식 parent 배선. (2) `update_style`/`set_children`/`mark_dirty` → `propagate_dirty(handle)` 로 변경 노드부터 root 까지 조상 체인 dirty 마킹(이미 dirty 인 노드 만나면 조기 종료 — 그 조상은 이미 dirty 이므로 누락 없음). (3) `solve_node` 진입 시 `subtree_has_dirty(handle)` false 면 저장된 `layout.width/height` 를 반환값으로 재사용하고 재귀 생략(dirty 서브트리만 재계산). (4) `LayoutTree.last_compute: Option<(root, avail_w, avail_h)>` — available 이 직전과 다르면 `mark_subtree_dirty(root)` 로 skip 전면 무효화(%/auto stale 방지). (5) `clear`/`remove_node` 는 `last_compute=None` 무효화(handle 재발급 stale skip 차단). cargo test **161 PASS**(lib 161 = 153+단위 4 신규 8 / golden 15 / doc-test 1), clippy --tests 0. 검증층 = update_style 조상 전파+반영(100→200), explicit mark_dirty 값 보존, set_children add/remove reflow, clean sibling skip+크기 재사용(A 만 dirty 시 B skip 되나 배치 정확), available 변경 시 % 재계산(400→800→width 200→400), 동일 avail 재호출 값 불변, clear 후 stale skip 없음. **참조 자산 대조**: taffy_bridge.rs:890-897 계약("set_style/set_children 이 mark_dirty 내부 호출 + dirty 조상 자동 전파") 이식. taffy 는 layout cache(available-space 키)로 세밀 skip 하나 자체 트리는 캐시 없어 root-level available 비교로 보수적 갈음 — taffy 의 3 incremental 테스트(test_mark_dirty_incremental=값 반영/값 보존, test_mark_dirty_add_remove_child=add/remove reflow) 관찰 계약을 동형 커버(taffy 는 column y좌표, 자체는 flex column+height:auto sentinel 미해결 영역 우회 위해 row x좌표로 동형 검증 — 관찰 계약=최종 layout 정확성 동일). seam 미배선 → live 영향 0.
- **단위 4 미포함(다음 단계 명시)**: taffy 수준 layout cache(노드별 available-space 키 캐시 — 현재는 root-level available 비교로 보수적 무효화, sibling 축 available 변경 미세 감지 안 함), flex column + height:auto(-1 sentinel) intrinsic 도출(flex.rs main available 음수 미처리 — 단위 4 테스트가 이 영역 우회, Phase 1 flex.rs 후속). tree.rs 오케스트레이션 4 단위(1/2/3-a/3-b/4) 완료 → `LayoutEngineAPI` batch 계약 완비. 다음 = seam 배선(`createLayoutEngine` flag 전환) + dual-run(Taffy self-diff 0) 검증(1-E Taffy 제거 전제).

#### seam 배선 sub-scope 분해 (2026-07-04 실사)

"seam 배선"은 실사 결과 3 sub-scope 로 분해된다 — 각각 live 영향과 규모가 다르며, **(C)는 (B) 결과라는 경험적 gate 에 의존**하므로 별도 게이트다.

| sub-scope              | 내용                                                                                                    |            live 영향             | 게이트                                                                       |
| ---------------------- | ------------------------------------------------------------------------------------------------------- | :------------------------------: | ---------------------------------------------------------------------------- |
| **(A) WASM 바인딩**    | 자체 crate 에 `#[wasm_bindgen]` wrapper(`wasm.rs`) — `LayoutTree` → JS `LayoutEngineAPI` 16 메서드 노출 | 0 (순수 crate 확장, seam 미배선) | 없음 (선행 필수)                                                             |
| **(B) dual-run 측정**  | wasm-pack 산출물 → `runDualLayout`(candidate=wrapper vs reference=Taffy) self-diff 측정                 |          0 (검증 경로)           | (A) 산출물 필요                                                              |
| **(C) seam flag 전환** | `createLayoutEngine` flag true 경로 배선 → live builder 레이아웃 엔진 교체                              |        **live 엔진 교체**        | (B) self-diff 0 통과 필수 ([[feedback-no-dormant-foundation-ahead-of-flip]]) |

- **seam 배선 (A) WASM 바인딩 검증** (사용자 승인 2026-07-04, "승인"): `composition-engine/src/wasm.rs` 신규 — `LayoutEngine` wrapper struct(`#[wasm_bindgen]`)가 내부 `tree::LayoutTree` 를 감싸 JS `LayoutEngineAPI`(layoutBridge.ts) 16 메서드 노출(`isAvailable`/`buildTreeBatch`/`buildTreeBatchBinary`/`hasBinaryProtocol`/`createNodeRaw`/`updateStyleRaw`/`setChildren`/`markDirty`/`removeNode`/`computeLayout`/`getLayoutsBatch`/`getLayout`/`clear`/`nodeCount`). `taffy_bridge.rs::TaffyLayoutEngine` 과 **동일 시그니처** — 두 엔진이 같은 seam 에 교체 가능하게 꽂힌다. **설계**: (1) `#[cfg(target_arch = "wasm32")]` 게이트(lib.rs) → native cargo test 무영향(JsValue non-wasm32 panic 회피, taffy*bridge.rs:1209-1210 동일 이유), (2) wrapper 얇게 — 레이아웃 로직은 `LayoutTree`, wrapper 는 JSON→NodeStyle 역직렬화 + flat f32 직렬화 + 에러→JsValue 만, (3) binary protocol 미구현(`hasBinaryProtocol`=false → JS persistentTaffyTree.buildFull:141 이 JSON 경로 `buildTreeBatch` fallback, `buildTreeBatchBinary` 는 호출 안 됨 → 계약 충족용 Err stub). **참조 자산 대조**: taffy_bridge.rs wasm-bindgen 패턴(constructor/js_name/Box<[f32]> flat 반환/Result<*,JsValue>) 그대로 승계. `getLayoutsBatch` flat `Box<[f32]>` = JS 가 handle 순서로 슬라이스해 Map 재구성(persistentTaffyTree.ts). **검증**: native cargo test **177 PASS**(lib 161 무회귀 / golden 15 / doc-test 1) + native clippy --tests 0(wasm 모듈 게이트로 회귀 0) + **wasm32 컴파일 성공**(`cargo check --target wasm32-unknown-unknown` — wrapper 가 실제 wasm 타겟에서 `#[wasm_bindgen]` 포함 에러 없이 컴파일) + wasm32 clippy 0. **seam 미배선 유지** — wrapper 존재 ≠ flag 전환(`createLayoutEngine` flag true 경로 여전히 fallback). live builder 영향 0.
- **seam 배선 (B) 재분해 (2026-07-04 실사)**: (B) "dual-run 측정" 은 실사 결과 다시 (B1)/(B2) 로 분해된다. `dualRunHarness.test.ts` 는 현재 **실제 WASM 엔진을 로드하지 않고** mock(`makeEngine` + 주입 `layoutFn`)으로 diff 산술만 검증한다 — 자체 엔진 vs 실제 Taffy 비교 경로는 **미구축** ([[feedback-infra-exists-vs-wired-consumption-path]]: 하네스 코드 존재 ≠ 실제 엔진 소비 경로 존재). 따라서 (B1) wasm-pack 산출물 생성 + export 검증(live 0) → (B2) JS↔WASM 통합 테스트 인프라(자체 엔진 & 실제 Taffy 동시 로드) + 실제 self-diff 측정 으로 분리.

  | sub      | 내용                                                                                                            |             live             | 게이트                         |
  | -------- | --------------------------------------------------------------------------------------------------------------- | :--------------------------: | ------------------------------ |
  | **(B1)** | `wasm-pack build --target bundler` → `pkg/` 산출물(.wasm+.js+.d.ts) 생성 + `LayoutEngine` 16 메서드 export 검증 | 0 (gitignore pkg, 로컬 빌드) | (A) 완료                       |
  | **(B2)** | JS↔WASM 통합 인프라(두 엔진 실제 로드) + `runDualLayout` 실제 self-diff 측정                                    |           0 (검증)           | (B1) 산출물 + 통합 인프라 신규 |
  | **(C)**  | `createLayoutEngine` flag 전환                                                                                  |          live 교체           | (B2) self-diff 0               |

- **seam 배선 (B1) wasm-pack 빌드 검증** (사용자 승인 2026-07-04, "승인"; scope 질문 무응답 → [[feedback-infra-exists-vs-wired-consumption-path]] + surface-minimization 근거 최소 표면 (B1)만): `wasm-pack build packages/composition-engine --target bundler --out-dir pkg` 실행 → `pkg/composition_engine.{js,d.ts}` + `composition_engine_bg.wasm`(220KB) 생성. **export 검증**: `.d.ts` 가 `export class LayoutEngine` + 16 메서드(`buildTreeBatch(nodes_json:string):Uint32Array` / `computeLayout` / `getLayoutsBatch(handles:Uint32Array):Float32Array` / `isAvailable():boolean` 등, camelCase js_name 변환 정상)를 노출 — (A) wrapper 가 실제 JS consumable 산출물을 냄을 확증. raw 반환(`Uint32Array`/`Float32Array`)은 taffy_bridge 동일 형식 → persistentTaffyTree.ts 어댑터가 `LayoutEngineAPI`(number[]/Map) 로 흡수. flex/block/grid `flex_layout`/`block_layout`/`grid_layout` free function 도 함께 export(golden 테스트 소비). **pkg 커밋 제외**: `packages/composition-engine/.gitignore` 에 `pkg/` 사전 등록(taffy `wasm-bindings/pkg` 관례 동일 — 빌드 산출물, Vite 번들 시 재생성). (B1) 은 코드 변경 0(문서만) — 빌드 검증 단계. **seam 미배선 유지**. live builder 영향 0.
- **seam 배선 (B2) JS↔WASM 통합 인프라 + 실제 self-diff** (사용자 승인 2026-07-04, "승인"; 로딩 전략 질문 무응답 → [[feedback-no-dormant-foundation-ahead-of-flip]] + surface-minimization 근거 옵션 1(vitest 에 vite-plugin-wasm) 선택 — 런타임 앱과 **동일 `--target bundler` pkg** 를 그대로 로드해 self-diff 가 실배선 산출물을 측정, 최고 신뢰도 + 최소 표면. nodejs 타겟 별도 빌드(옵션 2)는 런타임과 다른 산출물이라 신뢰도 갭 + 빌드 파이프라인 부수 표면으로 배제): **실사 확정** — `dualRunHarness.ts::runDualLayout` 은 실제 `LayoutEngineAPI` 를 받으면 그대로 동작(mock 인 것은 `.test.ts` 뿐). 두 pkg 모두 `--target bundler`(loader 가 `import * as wasm from "./..._bg.wasm"`)라 vitest(node)에서 직접 로드 불가였고, 기존 테스트에서 실제 WASM 로드 0건 + vitest.config 에 wasm 처리 0 → (B2)가 미구축 경로. **최소 스파이크 실증**(infra-exists≠wired 를 vitest wasm 로딩에도 적용): `vite-plugin-wasm`(apps/builder 이미 설치)만으로 자체 pkg `LayoutEngine` 로드 + leaf compute 성공(top-level-await 플러그인 불필요 — 자체 loader 동기 `__wbg_set_wasm`). **구현**: (1) `dualRunEngines.ts` 신규 — raw wasm-bindgen 산출물을 `LayoutEngineAPI` 로 어댑트하는 얇은 wrapper 2개(`adaptSelfEngine`: camelCase + `Uint32Array`/`Float32Array`→`number[]`/`Map` 변환 / `adaptTaffyEngine`: snake_case→camel 이름 매핑 + raw 재구성 — 런타임 taffyLayout.ts::TaffyLayout 은 전역 getRustWasm 의존이라 vitest 미가용 → fixture 전용 어댑터 별도), (2) `dualRunLive.test.ts` 신규 — 두 실제 WASM 엔진을 `runDualLayout` 에 주입해 self-diff, (3) `vitest.config.ts` 에 `vite-plugin-wasm` 등록(`.wasm` import 없는 기존 테스트엔 no-op). **검증**: dualRunLive **4/4 PASS** — 자체 self-diff diff 0(실 WASM 하네스 정확성) / 자체 leaf 실측 30×20·40×20·flex row x=0/30 / Taffy 동일 batch 계약 로드 / **자체 vs Taffy 실전 비교 HC3 통과**(flex row fixed 두 엔진 동일). dualRunHarness.test.ts(mock) 5/5 무회귀. `tokenConsumerDrift.test.ts` 2 snapshot 실패는 **plugin 없는 baseline 동일 확증**(ADR-081 인프라, 무관 사전 실패). type-check PASS(baseline 69, 새 violation 0). **자체 vs Taffy flex row fixed HC3 통과 = (C) 방향 청신호**(단 미해결 영역 flex column height:auto 는 넓은 fixture 필요 — (C) 착수 시 확장). **seam 미배선 유지** — 어댑터는 테스트 fixture 전용, createLayoutEngine 배선 안 함. live builder 영향 0.
- **seam 배선 (C-1) 실전 catalog dual-run 진단 — flag 전환 차단 확정** (사용자 승인 2026-07-04, "(C) 승인" + batch 소스 "수작 대표 fixture batch 확장"): 실사로 **(C)가 (C-1) 실전 diff 측정 → (C-2) diff 0 시만 flag 전환 으로 분해**됨을 확정(승인된 (C) 내부 순서). 실전 batch 는 fullTreeLayout DFS 런타임 생성이라 캐처 fixture 없음 → catalog containerStyles 실사(flexDirection:column 다수 / grid 6 / block)로 대표 3 패턴 + height:auto fixture 수작. 자체 crate apps/builder dependency 미등록(런타임 로드 배선도 (C-2) 선결). **측정(dualRunLive.test.ts (C-1))**: block height:auto → **diff 0** / flex column height:auto → **h=0 붕괴**(자체 avail_h=-1 을 flex main available 로 받아 자식 shrink) / grid height:auto → **셀 h +50**(intrinsic track 미측정, available 로 채움). **(C-2) flag 전환 불가** — 실전 다수 패턴이 diff → flag 켜면 live 회귀([[feedback-no-dormant-foundation-ahead-of-flip]]). flex.rs §9.7 main-negative + grid.rs intrinsic track 이 선결. block 은 정합. 검증: dualRunLive 7/7 PASS(기존 4 + C-1 3), type-check PASS. 진단이 선결 경계 못박음(수정 후 `toBe(false)`→`toBe(true)` 뒤집히면 flag 준비 신호). createLayoutEngine flag 경로 fallback 유지(코드 0). seam 미배선. live 영향 0.
- **flag 전환 선결 #1 — flex.rs main-negative + ALIGN_STRETCH 정정 완료** (사용자 승인 2026-07-04, "승인"; flex.rs 먼저 = catalog flex column 다수 + 붕괴 심각도 + 표면 집중): 근원 3곳 TDD 수정 — (1) `resolve_flexible_lengths` available_main 음수(sentinel)면 grow/shrink skip, basis 유지(intrinsic) — 이전 h=0 붕괴, (2) `collect_lines` sentinel 한 라인 유지 — 이전 wrap 오분할, (3) `ALIGN_STRETCH` 는 cross auto 일 때만 stretch, 명시 cross 유지(FlexItem `cross_is_auto` 필드) — 단위 2 우회 버그 정정. cargo test 183 PASS(sentinel 4 + stretch 2 신규), clippy 0. **live dual-run**: pkg 재빌드 → C-1 flex column height:auto **diff 0 전환**(Taffy 완전 일치), dualRunLive 7/7. C-1 flex column 기대 `toBe(false)`→`toBe(true)` 갱신. seam 미배선. live 영향 0.
- **flag 전환 선결 #2 — grid.rs implicit auto row intrinsic 완료 — C-1 전면 diff 0** (사용자 승인 2026-07-04, "승인"): 근원 = C-1 GRID_AUTO 가 `gridTemplateRows` 미명시(implicit auto row) → grid.rs 하드코딩 fallback 100(자식 flat 안 받아 intrinsic 모름). **수정 위치 = tree.rs `solve_grid`**(트리 레벨 — 자식 intrinsic → row 크기 도출 책임): rows 미명시 + 전부 auto-placement 이면 자식 먼저 solve → row-major(row=i/col_count) 별 max intrinsic → px 트랙 주입 후 grid.rs 호출. 명시 placement 는 fallback 유지. cargo test 185 PASS(grid implicit 2 신규), clippy 0. **live dual-run**: pkg 재빌드 → C-1 grid height:auto **diff 0 전환**, C-1 grid 기대 `toBe(false)`→`toBe(true)`. **dualRunLive 7/7 — C-1 3 대표 패턴(block/flex column/grid) 전면 diff 0** = 두 선결(#1 flex.rs + #2 grid.rs) 완료. seam 미배선. live 영향 0.
- **flag 전환 선결 완료 → 다음 = (C-2)**: (C-2) flag 전환 재평가 — (1) 자체 pkg 를 apps/builder dependency 등록 + 런타임 로드 배선(현재 미등록, taffy `rustWasm.ts` 패턴 참고) + `createLayoutEngine` flag true 경로에 자체 엔진 주입, (2) **넓은 실전 fixture(실제 catalog 컨테이너 트리)로 dual-run 확장 후 diff 0 재확인** — C-1 3 패턴은 대표 샘플이므로 실전 트리의 중첩/혼합/edge(예: flex 안 grid, grid 안 flex, 명시 placement, minmax, 다중 페이지 컨테이너)는 미검증. live 엔진 교체라 HIGH — 별도 승인 필수. C-1 대표 diff 0 는 (C-2) 청신호이나 실전 전면 dual-run 이 flag flip 전 최종 선결.
- **(C-2b) 실전 중첩/혼합 dual-run 전면 diff 0 proof 완료** (사용자 승인 2026-07-04, "승인"): **관점 검증** — (C-2) 를 flag flip 까지 한 단위로 밀지 않고 **배선/flip 을 분리**(순서 무응답 → 차단 메모리 default). 런타임 배선 코드를 flag flip 없이 넣는 것 자체가 dormant foundation → **배선 없이 fixture 만으로 proof 확보 우선**([[feedback-no-dormant-foundation-ahead-of-flip]] + [[feedback-infra-exists-vs-wired-consumption-path]] + [[feedback-execute-adr-surface-minimization]]). **왜 C-1 로 불충분**: C-1 은 단일 레벨 3패턴 — 실전 catalog 컨테이너는 컨테이너를 **중첩**(componentRulesTable 실측: flex 88 > grid 10 > block 6, column 23 > row 10). 단일 레벨은 부모 available 전파 / cross-axis stretch → 자식 컨테이너 intrinsic 상호작용 미노출. **fixture 5종(catalog 근거)**: N1 flex-in-flex(Card 헤더/바디) / N2 flex-in-grid(그리드 셀 내 스택) / N3 grid-in-flex(섹션 내 데이터 그리드) / N4 gap 혼합(rowGap/columnGap) / N5 dimension 혼재(고정+auto flex row). **검증(live = 실 WASM dual-run)**: pkg 재빌드 → (C-2b) describe 5 fixture 전면 diff 0. **dualRunLive 12/12 PASS**(B2 4 + C-1 3 + C-2b 5) = 실전 대표 8형상 자체 vs Taffy 시각 동일. sanity(leaf 폭 30 vs 60 실제 산출 = 조용한 통과 아님) 통과. type-check 무회귀. seam 미배선(flag false 유지, 런타임 배선 미도입) → live 영향 0. **다음 = (C-2a) 런타임 배선 + flag 전환**(HIGH, 별도 승인): 자체 pkg 런타임 로드 배선(taffy `rustWasm.ts`/`layoutEngine.ts` 패턴) + `createLayoutEngine` flag true 자체 엔진 주입 + `USE_RUST_LAYOUT_ENGINE` flip + Chrome MCP live exercise. proof 확보 완료 → 배선은 proof 통과 후.
- **(C-2a) 런타임 배선 + flag 전환 완료 — 자체 엔진 live builder 전환** (사용자 승인 2026-07-04, "(C-2a) 승인"): **배선 2 파일**(taffy 미러링): `compositionEngineWasm.ts`(전역 로드) + `compositionEngine.ts`(동기 wrapper `CompositionEngineLayout` — 자체 pkg camelCase 16-메서드 = 이름 일치라 raw 타입 변환만). `layoutBridge.ts` flag true 경로 자체 엔진 주입(미준비 Taffy 폴백) + `init.ts` startup 로드 + `USE_RUST_LAYOUT_ENGINE` flip. **경로 정정**: 자체 pkg monorepo `packages/`(dev root 밖) → 절대 URL fetch 실패 → wasm-pack out-dir 을 apps/builder 내부(`wasm-bindings/composition-engine-pkg/`)로 지정 + 상대 import(taffy 선례). `package.json wasm:build:engine`. **전제 정정**: `UNIFIED_ENGINE:true` global override 로 `isUnifiedFlag` 개별 flag 무관 true → 배선=즉시 flip(분리 불가). 옵션 1(배선=flip 인정) 진행, `isUnifiedFlag` 재설계는 scope 확장 회피. **Chrome MCP live exercise**: builder 진입 → init 로그 + `createLayoutEngine()` `CompositionEngineLayout` 반환 + flex 실계산(leaf-b x=30) + nodeCount 3 + Skia 렌더 무붕괴. infra-exists-vs-wired 검증이 초기 폴백(TaffyLayout 반환) 잡아 경로 정정. type-check PASS(69) + 20/20 무회귀. **다음 = 1-E Taffy 제거 재평가**(자체 엔진 안정화 후 Taffy crate/pkg/wrapper 제거 → 2-C/2-D/2-E). HIGH — 별도 승인.
- **(1-E) Taffy dead code 제거 완료** (사용자 승인 2026-07-05, "1-E Taffy 제거 승인"; scope AskUserQuestion 2건 = "폴백 유지 + Taffy 사용 참조만 제거" + "dead 코드 삭제만"). **dead 판정 근거**: C-2a live 전환 후 Taffy 엔진 클래스는 인스턴스화 0건 / `.calculate()` 호출 0건 — `selectEngine()` router 부재, live 경로는 `createLayoutEngine()` seam → `CompositionEngineLayout` 단일. **삭제(파일 전체 2)**: `BaseTaffyEngine.ts`(abstract, `new TaffyLayout()` dead) + `layoutAccelerator.ts`(importer 0). **클래스만 제거(파일 유지 3, live helper 보존)**: `TaffyFlexEngine`/`Grid`/`Block` 클래스 + `isTaffy*Available` 삭제, 순수 helper `elementToTaffyStyle`/`parseGridTemplate`/`elementToTaffyBlockStyle` 는 `fullTreeLayout.ts:41-43` 소비 유지(Taffy 인스턴스 비의존 pure fn — DFS 가 style 변환에만 사용). **폴백 유지**: `layoutBridge.ts:84` Taffy fallback = WASM 미가용 안전망(사용자 지시, crate/pkg 물리 삭제 아님). ⚠️ `TaffyGridEngine.parseGridTemplateAreas`(dead)와 `GridLayout.utils.ts:456 parseGridTemplateAreas`(**live, 동명 다른 함수**) 혼동 주의 — 후자 보존됨. **검증**: 삭제 심볼 잔존 참조 0건, 파일명 참조 9/6/2 = import 경로 + 주석. type-check PASS(69) 무회귀. commit f2ac4860c(-1252줄). **다음 = 2-C scene.rs / 2-D commands.rs / 2-E text.rs 재평가**(fullTreeLayout DFS → 자체 엔진 편입 후속). HIGH — 별도 승인.

### 2-C. Projection signature recomputation 제거/증분화

> **2026-07-05 벤치 재정의 (원 제목 "Scene graph dirty detection O(N)→O(1)" 폐기)**: 벤치가 원안 전제(detectChangedIds O(N) 병목)를 반증 → scope 를 실측 병목(projection signature 재계산)으로 재정의. 원안 제목/목표는 아래 "폐기된 원안" 참조.

**목표**: `buildSceneStructureSnapshot` 의 projection content signature 재계산 비용 제거/증분화. **dirty detection 최적화 아님**.

**벤치 근거 (`sceneDirtyDetection.bench.ts`, 검증 매트릭스 '성능 벤치' gate)**:

| 노드 | `buildSceneStructureSnapshot` 전체 | `createResolvedProjectionSignature` 단독 | signature 비중 | `detectChangedIds` |
| ---- | ---------------------------------- | ---------------------------------------- | -------------- | ------------------ |
| 500  | 2.06ms                             | 2.23ms                                   | ~100%          | 0.0070ms           |
| 1000 | 5.98ms                             | 5.99ms                                   | ~100%          | 0.0157ms           |
| 3000 | 18.76ms                            | 18.15ms                                  | ~97%           | 0.052ms            |

→ 병목은 **signature 계산 하나** (전체 snapshot 비용의 ~100%). depthMap/pageDataMap/pageFrames 는 무시 가능. `detectChangedIds` 는 예산 0.3% (원안 이관 무의미).

**핵심 성질 — signature 는 pan/zoom/containerSize 와 독립**: 입력 = `input.elements`(sceneNodes) + `pageSnapshots` 의 node 참조(`bodyElement`/`pageElements`) 뿐. `isVisible` 등 viewport 필드 미참조. 그런데 현재 전체 `buildSceneStructureSnapshot` 이 단일 useMemo(`BuilderCanvas.tsx:352`, deps 에 panOffset/zoom)에 묶여 pan/zoom 중에도 매 프레임 전체 재직렬화.

**수정안 후보 (표면 오름차순 — 최소부터)**:

- **안 A (최소, JS)**: signature 계산을 pan/zoom deps 에서 분리 — signature 를 별도 useMemo(`elements`/`layoutVersion`/`pagePositions` deps 만)로 뽑아 pan/zoom-only 변경 시 재계산 skip. Rust 이관 0, 표면 최소. pan/zoom 은 layout 이 안정된 상태에서 가장 빈번한 인터랙션이므로 실측 병목의 큰 몫을 즉시 제거.
- **안 B (JS 증분)**: 전체 `stableSerialize` 회피 — 노드별 signature 를 캐싱(node 참조 안정 시 재사용) + 변경 노드만 rehash. detectChangedIds 가 이미 O(N) 참조 비교를 하므로 그 결과를 signature 증분에 재사용 가능.
- **안 C (Rust 이관, scene.rs)**: signature 계산을 `scene.rs` WASM 으로 이관. 표면 최대 — cutover 즉시 삭제 원칙(§Phase 2 순서 의존성) + [[feedback-no-dormant-foundation-ahead-of-flip]] 상 안 A/B 로 병목이 해소되면 Rust 이관은 과잉. **안 A/B 실측 후에도 예산 초과 잔존 시에만 정당화**.

**판정 방향**: 안 A 우선(최소 표면). 안 A 적용 후 재벤치 → 잔여 병목이 예산 내면 2-C 종료, 초과 시 안 B → 그래도 초과 시 안 C(Rust). **element registry Rust 관리 / scene.rs 신설은 안 A/B 로 해소 시 불필요** — 원안의 "Rust 이관 전제" 는 벤치 미확보 상태의 추정이었음.

**✅ 안 A land 완료 (2026-07-05)**: `buildSceneStructureSnapshot` 에 `precomputedProjectionSignature?` 주입 파라미터 추가(미주입 시 내부 계산 = 하위 호환). `BuilderCanvas.tsx` 가 signature 를 pan/zoom 독립 useMemo(deps: `sceneNodes`/`sceneNodesMap`/`layoutVersion`/`pages`/`scenePageIndex`/`isFrameEditMode` — panOffset/zoom/containerSize 제외)로 계산해 주입. **재벤치 결과 — 병목 예산 내 해소**:

| 노드 | pan/zoom 프레임 (안 A 전 = 전체) | pan/zoom 프레임 (안 A 후 = signature 주입) | 개선 |
| ---- | -------------------------------- | ------------------------------------------ | ---- |
| 500  | 2.11ms                           | 0.072ms                                    | 29×  |
| 1000 | 6.35ms                           | 0.151ms                                    | 42×  |
| 3000 | 21.44ms(예산 초과)               | 0.492ms(예산 3%)                           | 44×  |

→ pan/zoom 프레임 3000 노드 21.44ms→0.49ms. **60fps 예산 내 완전 해소 → 안 B/안 C(Rust scene.rs) 불필요, 2-C 종료.** 정합성: 주입 signature == 내부 계산 → 동일 sceneVersion (buildSceneSnapshot.test.ts 안 A describe 3 test). live: builder 진입 CSS/Skia 정상 렌더 + selection/hit-test 정상 + signature 관련 콘솔 에러 0. type-check PASS(baseline 69).

- **ADR-136 sceneVersion 계약 승계 (canvas-rendering.md §9)**: sceneVersion = layoutVersion + pagePositionsVersion + projection content signature (`scene/buildSceneSnapshot.ts` `buildSceneStructureSnapshot` / sceneVersion hash). signature 계산은 snapshot 빌드 시점만 (pointer hot path 금지), projection-relevant field 추가 시 signature input 동시 갱신 의무 — 안 A/B(useMemo 분리·증분) 후에도, 안 C(Rust 이관) 후에도 동일 보수 의무 유지

<details><summary>폐기된 원안 (2026-07-05 벤치 반증 전)</summary>

- ~~`StoreRenderBridge.detectChangedIds` O(N) → generation counter + dirty bitfield O(1)~~ — 벤치 반증: 예산 0.3%, 이관 무의미
- ~~element registry Rust 관리~~ — 안 A/B 로 병목 해소 시 불필요

</details>

### 2-D. layout → SpatialIndex 직결 (부분 이관 — 경계 횡단 제거)

> **2026-07-05 벤치 재평가로 scope 축소.** 원안(`commands.rs` — command stream 전체 Rust 이관)은 벤치상 정당화가 약하고 이관 표면이 과대함이 드러나, **SpatialIndex 경계 횡단 제거**로 범위를 좁힌다. command stream(JS) 자체는 유지. 폐기 원안은 하단 `<details>` 보존.

**벤치 근거 (신규 `renderCommandStream.bench.ts`, 비용 분리 계측 — mean ms)**:

| 단계                                          |  500  | 1000  | 3000  | 3000 예산비 |
| --------------------------------------------- | :---: | :---: | :---: | :---------: |
| ① buildRenderCommandStream 전체 (zIndex 없음) | 0.262 | 0.511 | 1.574 |    9.4%     |
| ② + z-sort 경로 활성                          | 0.278 | 0.561 | 1.719 |      —      |
| z-sort 기여분 (②−①)                           | 0.016 | 0.050 | 0.145 |    0.9%     |
| ③ syncSpatialIndex JS 재직렬화                | 0.016 | 0.032 | 0.099 |    0.6%     |
| ④ commandChildrenMap 재구성                   | 0.006 | 0.013 | 0.041 |    0.2%     |

**결정적 발견 — 원안 대상 반증 (2-C detectChangedIds 와 동형)**:

- **command stream 전체가 예산 내** (3000 노드 1.57ms = 60fps 16.7ms 의 9.4%) — 현재 병목 아님.
- 원안이 지목한 최적화 대상은 모두 효과 미미: **z-sort 0.145ms(예산 0.9%) / syncSpatialIndex JS 재직렬화 0.099ms(예산 0.6%)**. 2-C 의 `detectChangedIds`(예산 0.3%)처럼 **잘못 짚은 대상**.
- 실제 비용의 축은 **DFS `visitElement` 순회 자체**(①에서 z-sort/childrenMap 제외 시 ~1.39ms) — getSkiaNode 조회 + layout 조회 + sticky 계산 + boundsMap.set + command push 의 노드당 합.

**정당화 축 (병목 아님 전제 — 벤치는 게이트 아닌 정당화 도구)**: 비용이 아니라 **경계 횡단 구조**. 현재 `syncSpatialIndex`(renderCommands.ts:350)는 매 command stream build 마다 JS `boundsMap` → `items` 배열 → `Float32Array` 직렬화 → WASM `batchUpdate` 로 **경계를 1회 횡단**. 원안 표현("복사 제거")이 노린 실체는 이 구조적 이득이지 JS 재직렬화 0.099ms 가 아니다 — 표현이 비용을 잘못 짚었을 뿐 방향은 유효.

**P3 계약 (layout → SpatialIndex 직결)**:

- 이미 Rust 인 layout solve(2-B) 결과에서 **Rust 가 절대좌표 bounds 를 자체 계산해 SpatialIndex 를 내부 갱신**. JS `boundsMap` → `Float32Array` → WASM `batchUpdate` 횡단 **소멸**.
- **command stream(JS) 은 무관** — 사용자 선택 "경계 횡단만 먼저(부분 이관)". `renderCommands.ts` 의 DFS/z-sort/command emit 은 현행 유지.
- `boundsMap` 자체는 JS 에 유지 — TextEditOverlay `getSceneBounds`(renderCommands.ts:130) / AI effects `buildAIBoundsFromStream`(:1067) 소비자가 있어 command build 산출물로 계속 필요. **SpatialIndex 갱신 경로만** layout 직결로 분리.
- **mutation 진입점 단일 확인**: SpatialIndex mutation 은 `renderCommands.ts:369 spatialIndex.batchUpdate` **1곳뿐**(elementRegistry 구 동기화는 이미 위임 완료, 주석 :81/:93/:186). 쿼리 소비자(useViewportCulling / HoverManager / useDragBridge / useCentralCanvasPointerHandlers / BuilderCanvas)는 read-only → mutation 경로 교체가 쿼리 계약 미변경.
- **절대좌표 계약 승계**: SpatialIndex 는 씬 좌표(페이지 오프셋 포함) 기준. Rust 직결 시 layout(부모-상대) → 절대좌표 누적 + pagePositions 오프셋 + scrollOffset 차감(canvas-rendering.md §8) 을 Rust 내부에서 수행해야 JS boundsMap 과 동일 좌표 산출.

**diff oracle (구현 착수 시 검증 계약)**:

- 동일 layout 입력 → (A) 현행 JS boundsMap 기반 `batchUpdate` 후 SpatialIndex 쿼리 결과 vs (B) Rust layout 직결 SpatialIndex 쿼리 결과 → **`query_viewport` / `query_point` / `query_rect` 3종 쿼리 모두 동일 id 집합** (diff 0).
- fixture: 중첩 flex/grid + scrollOffset 있는 컨테이너 + 다중 페이지 오프셋 + sticky/fixed(씬 좌표 보정 경로) 포함 — hit-test/culling 이 실제 소비하는 좌표 경로 전수.
- **cutover 즉시 삭제(no-dormant)**: Rust 직결 land 시 `syncSpatialIndex` + `batchUpdate` JS 경로 **즉시 제거** — dormant 병행 금지. diff 0 확인 후 flip.

**⏸️ 구현 보류 (2026-07-05, 사용자 "먼저 계약/oracle만 설계")**: 본 재정의 + P3 계약 + diff oracle 설계까지만 문서에 추가. Rust 구현(layout→spatial 직결 + JS 경로 삭제)은 **별도 사용자 승인 단위**.

<details><summary>폐기된 원안 (2026-07-05 벤치 반증 전)</summary>

- ~~`commands.rs` — command stream 전체 Rust 이관: `renderCommands.ts` O(N) DFS + z-sort + boundsMap → Rust flat command 배열~~ — 벤치 반증: command stream 전체가 예산 9.4%(병목 아님), SkiaNodeData(Float32Array 색상/effects/clipPath) 경계 전달로 이관 표면이 2-B(순수 flat f32)보다 과대. command stream 은 JS 유지.
- ~~SpatialIndex 갱신을 command 생성과 단일 패스 통합 (`syncSpatialIndex` 복사 제거)~~ — 방향은 유효하나 "command 생성과 통합"이 아니라 **layout 직결(P3)** 로 재정의. command build 무관.
- ~~viewport culling Rust 내부 수행~~ — SpatialIndex 가 Rust 내부 갱신되면 `query_viewport` 는 이미 Rust(spatialIndex.ts:76). 추가 이관 불요.

</details>

### 2-E. 텍스트 측정 — 이관 대상 제외 (CSS 정합 제약)

> **2026-07-05 재평가로 이관 대상에서 제외.** 원안(`text.rs` — 측정 캐시 Rust LRU + Rust batch 측정)은 **CSS 시각 대칭(D3) 제약으로 근본 차단**됨이 실사로 확정. 2-C/2-D 의 "잘못 짚은 대상"(성능 병목이 다른 곳 → 정당화 축 전환으로 이관 유효)과 **질적으로 다름** — 여기서는 **아키텍처 제약이 이관 자체를 막는다**. 폐기 원안은 하단 `<details>` 보존.

**측정 경로 실측 (live)**: 측정은 CanvasKit Paragraph 가 아니라 **Canvas 2D `measureText`**(`canvas2dSegmentCache.ts:33` `USE_CANVAS2D_MEASURE=true`, ADR-051)로 흐른다. CanvasKit 은 `needsFallback()` true(letterSpacing/wordSpacing/whiteSpace≠normal/break-all, ~10% 케이스)에서만. 폭 측정·줄 수·줄바꿈 위치 전부를 Canvas 2D 가 결정하고 CanvasKit 은 이미 결정된 `\n` 을 hard break 로 받아 shaping/렌더만 수행(`nodeRendererText.ts:449-460`).

**근본 차단 근거 (D3 시각 대칭 파괴)**:

- **Canvas 2D = 브라우저 폰트 엔진(Blink/ICU) = CSS Preview 와 동일 엔진** — 이것이 CSS↔Skia 줄바꿈 정합(~98%)의 구조적 근거(ADR-051 `completed/051:28,50,109,118`, canvas-rendering.md §3 "Layout=Canvas 2D=CSS 정합 원칙").
- 측정 계산을 Rust 로 옮기면 **제3의 폰트 엔진**(HarfBuzz/rustybuzz/자체 무엇이든)이 되어 브라우저와 sub-pixel·줄바꿈이 발산 → D3 대칭 파괴. ADR-051 이 정확히 이 이유로 CanvasKit 측정을 기각(`completed/051:118`).
- **결정적 제약**: Rust/WASM 은 `document.fonts`(로드된 웹폰트)·브라우저 fallback chain·시스템 폰트에 **접근 불가**. `canvas2dSegmentCache.ts:314-324` 는 `document.fonts.check()` 로 폰트 로드를 확인 후 측정 — Rust 는 이 폭을 **원리적으로 재현 불가**.

**원안 두 목표의 동시 성립 불가**:

- "Rust batch 측정"(계산 이관) → 위 제약으로 정합 파괴, 근본 차단.
- "Rust LRU 캐시 저장소만 이관" → 계산은 JS 유지라 정합은 보존되나, 캐시 조회/저장마다 JS↔WASM 경계 왕복 증가 → ADR-916 "경계 최소화" 목표(§0-4)와 **역행**. 실익 없음.
- 즉 "정합 유지 + Rust 측정 이관"이 동시에 불가능 → 측정은 브라우저 엔진 전담 유지.

**벤치 근거 (신규 `textMeasure.bench.ts` — 비용도 병목 아님을 확증)**:

| 단계                                     |   mean   | 예산비(16.7ms) |
| ---------------------------------------- | :------: | :------------: |
| ① Canvas 2D 3-Tier 파이프라인(짧은 라벨) | 0.0013ms |     0.008%     |
| ② tokenize 단독(Intl.Segmenter, 긴 본문) | 0.0059ms |     0.035%     |
| ③ segment 캐시 hit(긴 본문 재측정)       | 0.0084ms |     0.05%      |

파이프라인 JS 오버헤드 전부 sub-0.01ms — 이관 정당화가 성능도 아님. (단 2-D 와 달리 정합 제약이 우선하므로 정당화 축 전환 여지 자체가 없음.)

**조상 체인 font 상속은 2-B 흡수 (2-E 별도 대상 아님)**: breakdown 원안이 2-E 로 묶었던 `buildSpecNodeData` O(N×D) 조상 체인 탐색(벤치 ④: 3000노드 0.416ms)은 **text 측정과 무관한 순수 트리 순회**다. `resolveStyle`/`applyImplicitStyles` 상단 style 해석의 일부이므로 **2-B tree.rs 트리 빌드 시 top-down 1패스**로 흡수 — 2-E 별도 이관 항목 아님.

**결정**: 텍스트 측정은 ADR-916 Rust 이관 대상에서 **제외**. Canvas 2D(브라우저 엔진) 전담 유지가 D3 시각 대칭의 필수 요건. `text.rs` 는 crate 목표 다이어그램에서 제거. (측정 원칙 자체를 뒤집으려면 ADR-051/900 을 supersede 하는 별도 상위 D3 재정의 ADR 이 선행돼야 하며, 이는 본 breakdown 범위 밖.)

<details><summary>폐기된 원안 (2026-07-05 재평가 전)</summary>

- ~~`text.rs` — 측정 결과 캐시(`canvaskitTextMeasurer.ts:122-127` `{width,height}` LRU)를 Rust LRU 로 이관~~ — 측정 경로가 CanvasKit 이 아니라 Canvas 2D(브라우저 엔진, ADR-051) live. 캐시만 옮기면 경계 왕복 증가로 목표 역행.
- ~~Rust 측 LRU + batch 측정 요청 (캐시 미스 시 단어당 다중 왕복 → batch 1회)~~ — batch 측정은 계산 이관 = 브라우저 폰트 엔진 이탈 = D3 대칭 파괴. 근본 차단.
- ~~조상 체인 기반 font 상속 해석 (buildSpecNodeData O(N×D) → top-down 1패스)~~ — text 측정과 무관한 style 해석 → 2-B tree.rs 흡수.

</details>

### Phase 2 순서 의존성

2-A(순수 계층 완료) + **2-CAT(catalog 정적 참조 계약)** → 2-B 조상 체인 개방. 2-C / 2-D / 2-E 는 2-B 이후 상호 독립.

> **"2-A → 2-B 순서 필수" 정밀화 (2026-07-05)**: 원 문구는 과대했다. 2-B 조상 체인 propagation 이 소비하는 것은 catalog sizes 층 + 토큰 정적 층(`buttonTextMetrics`/`buttonIconPx`)뿐이지 `resolveStyle` 본체·`implicitStyles`(2,440줄)가 아니다 → 실제 선결은 2-A 잔여 전체가 아니라 **2-CAT 계약**이다(§2-CAT 참조). 2-A 잔여(resolveStyle 조립/implicitStyles/display tag)는 조상 체인과 병행/후행 가능. 조상 체인 흡수(2-E→2-B 편입분)의 실제 이관 phase = **P2-PROP**(2-CAT 완료 후 개방, WASM 주입 배선을 이 phase 착수와 동시 = dormant 회피).

각 모듈 cutover 완료 시 대응 JS 경로 **즉시 삭제** — dormant 병행 금지 (feedback-no-dormant-foundation-ahead-of-flip).

**벤치의 역할 (2-D/2-E, 관점 고정)**: `commands.rs`/`text.rs` 는 ADR-916 통합 엔진의 **이관 후보로 이미 전제**(scene/commands/text 는 layout 과 같은 Rust 경계 = JS↔WASM 경계 최소화 목표의 구조적 대상). 각 착수 전 벤치는 **이관 여부 go/no-go 게이트가 아니라** 이관의 before/after 비용·이득을 정량화하는 **정당화** 도구. "JS 에서도 예산 내" 로 측정돼도 이관 취소가 아니라 다른 정당화 축(단일 엔진 일관성 / SSOT 단일화 / JS main-thread 부하 제거)으로 진행 판단. **2-C 는 예외** — signature 가 순수 함수라 useMemo 분리(안 A)만으로 예산 내 해소돼 Rust 이관이 불필요했던 특수 케이스이며, 이 결과를 2-D/2-E 전제로 자동 승계하지 않는다.

---

## Crate 구조 (목표)

```
packages/composition-engine/        # 신규 통합 crate (composition-layout 승계)
├── Cargo.toml                      # taffy 의존 없음
└── src/
    ├── lib.rs          # WASM 엔트리 — 단일 batch API
    ├── scene.rs        # 2-C (조건부 — 안 C, JS 안 A/B 로 병목 미해소 시에만 신설)
    ├── style.rs        # 2-A (기존 style.rs 승계 확장)
    ├── catalog.rs      # 2-CAT (조회 전용 — thread_local 스냅샷, JS 선해석 숫자 metrics 주입, 조상 체인 propagation 이관 선결)
    ├── tree.rs         # 2-B
    ├── flex.rs         # 1-A
    ├── grid.rs         # 1-B (grid_layout.rs 승계)
    ├── block.rs        # 1-C (block_layout.rs 승계)
    ├── spatial.rs      # 승계 + 2-D(P3: layout→SpatialIndex 직결 흡수 — commands.rs 신설 안 함, command stream 은 JS 유지)
    └── protocol.rs     # binary_protocol.rs 승계
    # text.rs 없음 — 2-E 재평가로 이관 제외 (측정=브라우저 Canvas 2D 엔진 전담, CSS 정합 제약)
```

최종 상태: JS ~15,000줄 (UI 바인딩 + CanvasKit draw 호출) + 단일 WASM batch API.

---

## 검증 매트릭스

| 검증                                   | 도구                                          | 적용 Phase          |
| -------------------------------------- | --------------------------------------------- | ------------------- |
| 회귀 fixture (기존 문서 layout 무변화) | dual-run diff 하네스 (신규)                   | 0, 1, 2 전부        |
| CSS↔Skia 시각 대칭                     | /cross-check + parallel-verify                | 2-A (2-E 이관 제외) |
| 성능 벤치 (1000+ 노드 프레임타임)      | 벤치 하네스 (신규)                            | 각 Phase 전후       |
| WASM 번들 사이즈 (gzip)                | build 리포트                                  | 각 Phase            |
| type-check                             | pnpm type-check                               | 전부                |
| live behavior                          | Chrome MCP 1회 exercise (CLAUDE.md 완료 기준) | 각 Phase cutover    |

---

## 순서 의존성 요약

```
Phase 0-A (seam ✅) ─→ Phase 1 self-impl (1-A/B/C ✅ + 1-D 하네스·golden ✅) ┐
                                                                              │ 배선·1-E 이연 (트리 계약 필요)
Phase 0-B (⏸️ 이연) ─────────────────────────────────────────────────────────┼─→ G5 confirm ─→ Phase 2 (2-A → 2-B → {2-C·종료, 2-D·P3, 2-E·이관제외})
                                                                              │                            │
              WASM 트리 batch 배선 + 1-E Taffy 제거 + 0-B worker offload ─────┴──── 2-B tree.rs 완료 시점 ──┘
```

- **Phase 0 종료** (2026-07-03): 0-A seam 만 land, 0-B 는 2-B 로 이연.
- **Phase 1 부분 마감** (2026-07-04): self-impl 알고리즘(1-A/B/C) + 1-D 하네스·golden land. **배선(WASM 트리 batch) + 1-E Taffy 제거는 미착수** — 배선이 트리 오케스트레이션(2-B) 선행 요구 → Phase 2 로 이연. grid gap 승계 버그는 JS+Rust 동시 수정 완료. 다음 진입점 = **Phase 2 (G5 scope confirm 필수, HIGH — 별도 사용자 승인)**.
