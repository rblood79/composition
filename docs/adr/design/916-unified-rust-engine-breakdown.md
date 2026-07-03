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

### 0-B. LayoutScheduler 소비 배선 + `LAYOUT_WORKER=true`

- **flag 단독 전환 무효**: `init.ts:41-48` 은 worker **초기화만** 수행. `getLayoutScheduler`(`wasm-worker/index.ts:32`)는 export 만 존재하고 caller 0건 — block/grid 계산을 scheduler 로 보내는 소비 경로 미배선. "SWR 캐시" 는 인프라 코드로만 존재 (`LayoutScheduler.ts`), 소비자 없음
- **실제 작업**: block/grid 가속 경로에서 LayoutScheduler 호출 배선 + 결과 소비 (SWR 적용) + flag 전환
- **커버리지 한정**: worker 는 `BLOCK_LAYOUT` / `GRID_LAYOUT` 가속기 요청만 처리 (`layoutWorker.ts:33-38`, Float32Array 전처리 입력) — **Taffy full-tree solve 는 main thread 잔류**. 전체 layout worker 이관은 Phase 2-B (tree.rs batch API) 이후 범위
- 산출물: 소비 배선 + flag 전환 + 1000노드 main thread blocking 측정 before/after (block/grid 경로 한정 효과로 해석)

0-A / 0-B 는 상호 독립 — 개별 검증 가능. 단 양쪽 모두 배선 코드 작업이 선행되므로 "코드 변경 최소" 가 아니라 **소규모 통합 작업** 으로 분류한다.

---

## Phase 1: Taffy 제거 — 자체 레이아웃 엔진

> **실질 출발점 (2026-07-03 실사)**: flex 자체 구현 0% (Taffy 전담). block/grid 자체 모듈은 runtime 미가동 (0-1 표 참조) — 승계 가능 자산은 margin collapse·inline-block line box·track 파싱 **산술 커널**이며, 스타일 해석 계층·grid track sizing(§11)·flex 전체는 신규. 자체 구현의 실전 가동 이력이 0이므로 **G2 dual-run 이 사실상 첫 실전 검증**이다.

### 1-A. `flex.rs` 신규 (~2,000줄 추정)

- CSS Flexbox spec (CSS-FLEXBOX-1) 자체 구현
- 테스트: Taffy 의 gentest 방식 (Chrome 실측 → fixture 자동 생성) 포팅 — WPT-파생 fixture 자산 확보
- 위치: `packages/composition-engine/src/flex.rs` (신규 crate — 아래 §Crate 구조)

### 1-B. grid 확장 (`grid.rs`)

- `repeat(auto-fill/auto-fit, minmax(...))` 복합 표현 Rust 파싱 (현재 JS `parseGridTemplate` — `TaffyGridEngine.ts` export — 의존)
- named grid areas 해석 (`parseGridAreaShorthand` 상당 로직)
- track sizing algorithm (CSS-GRID-1 §11)
- 기존 `grid_layout.rs` (279줄) 승계 확장

### 1-C. block 보강 (`block.rs`)

- margin collapse 잔여 케이스 / BFC / inline-block coverage 확대
- 기존 `block_layout.rs` (625줄) 승계

### 1-D. Dual-run 게이트 (G2)

- 동일 입력 → Taffy 결과 vs 자체 엔진 결과 diff 리포트 하네스
- 기준: 픽셀 diff ≤ 1px (f32 tolerance), 회귀 fixture 전수
- 통과 전 Taffy fallback 경로 유지 (flag)

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
Phase 0-A ─┐
           ├─ (병렬 가능) ─→ Phase 1 (1-A/B/C → 1-D 게이트 → 1-E) ─→ G5 confirm ─→ Phase 2 (2-A → 2-B → {2-C, 2-D, 2-E})
Phase 0-B ─┘
```
