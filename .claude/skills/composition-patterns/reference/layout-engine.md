# Layout Engine 구현 상세 — engine (자체 Rust WASM) + JS 어댑터

> **정본 분리**: 원칙·금지 패턴·재계산 경로 정본은 [.claude/rules/layout-engine.md](../../../rules/layout-engine.md) 와
> [.claude/rules/canvas-rendering.md](../../../rules/canvas-rendering.md). 본 문서는 그 정본이 다루지 않는
> **구현 위치·계약·디버깅 진입점**만 담는다. 규칙이 충돌하면 정본 우선.
>
> **공식 결정**: [ADR-916](../../../../docs/adr/completed/916-unified-rust-engine.md) — 자체 단일 Rust 엔진 (Implemented 2026-07-06, Taffy 완전 제거). [ADR-248](../../../../docs/adr/248-unified-catalog-document.md) Phase 4 (2026-10-03) — production 레이아웃을 catalog composition root 가 직접 몬다. 본 문서 기준일: 2026-10-04.

## 목차

1. 아키텍처 개요 — 계층과 호출 체인 (production)
2. WASM 경계 계약 — LayoutEngineAPI / batch 직렬화 / grid track 정규화
3. `calculateFullTreeLayout` — parity 하니스 전용 파이프라인
4. JS 측 측정 · 정규화 모듈
5. Rust 측 구조 — engine 모듈과 테스트
6. WASM 로드/플래그
7. 디버깅 진입점
8. 역사적 맥락

---

## 1. 아키텍처 개요 (production)

레이아웃은 **단일 엔진 + 단일 persistent 트리**다. 자체 Rust 엔진 `engine` 이 유일 경로 — 폴백 없음.

```
CatalogBuilderCore (apps/builder/src/builder/main/CatalogBuilderCore.tsx)
  ├─ await initAllWasm()                     — engine WASM + CanvasKit 병렬 로드
  └─ createLayoutEngine()                    — wasm-bindings/layoutBridge.ts (factory seam)
       → CatalogWorkspace → CatalogCompositionRoot (catalogRuntime/compositionRoot.ts)
            └─ new PersistentLayoutTree(engine) — 단일 root "catalog:root"
                 ├─ bind: buildFull("catalog:root", batch, childIds) → rewrap
                 ├─ 편집: applyRecord → addNode / updateNodeStyle (증분)
                 └─ apply: computeLayout → rewrap (height-for-width 1회 재측정)
                      └─ EngineLayout (wasm-bindings/engine.ts — 동기 wrapper)
                           └─ wasm.rs LayoutEngine → tree::LayoutTree (flex/block/grid dispatch)
```

편집 한 번이 레이아웃까지 가는 6단계 (transaction 판정 → plan → planRecord → 엔진 반영 → 계산·rewrap → Canvas 반영) 는 정본 [layout-engine.md](../../../rules/layout-engine.md) 「레이아웃 재계산 경로」 표.

| 계층                | 위치                                                                | 역할                                                                                                                                        |
| ------------------- | ------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------- |
| Rust 커널           | `packages/engine/src/{flex,block,grid}.rs`                          | CSS 명세 기반 단일 컨테이너 solver (flat f32 계약)                                                                                          |
| Rust 오케스트레이션 | `packages/engine/src/tree.rs`                                       | batch 트리 빌드 → post-order solve → dirty 증분 재계산                                                                                      |
| WASM wrapper        | `packages/engine/src/wasm.rs`                                       | `LayoutTree` 를 JS `LayoutEngineAPI` 로 노출 (`#[cfg(target_arch = "wasm32")]` 게이트)                                                      |
| JS 동기 wrapper     | `apps/builder/src/builder/workspace/canvas/wasm-bindings/engine.ts` | raw 반환 (Uint32Array/Float32Array) → number[]/Map 변환                                                                                     |
| 엔진 factory        | `wasm-bindings/layoutBridge.ts`                                     | `createLayoutEngine()` — 자체 엔진 단독 반환                                                                                                |
| Persistent 트리     | `layout/engines/persistentLayoutTree.ts`                            | elementId↔handle 매핑, JSON 비교 증분 갱신                                                                                                  |
| 엔진 입력 직렬화    | `catalogRuntime/compositionRoot.ts` `styleOf`                       | **production 의 유일한 엔진 입력 직렬화기** — `px()` · `containerTracks` (`parseGridTemplate`) · 텍스트 측정 스칼라 · `inheritedLineHeight` |
| 텍스트 측정         | `catalogRuntime/textMeasure.ts` `catalogTextMeasure`                | CanvasKit paragraph (준비 전 Canvas 2D) — `engines/utils.ts` 의 측정 함수를 fallback 으로 씀                                                |

### 어댑터 명명 (ADR-923 Phase 6 개명, 2026-09-03)

`flexStyleAdapter.ts` / `blockStyleAdapter.ts` / `gridStyleAdapter.ts` / `persistentLayoutTree.ts` / `EngineStyle` (layoutTypes.ts) 는 값 변환·정규화만 하는 TypeScript 코드다 — 계산은 Rust 엔진이 한다. 남아 있던 `Taffy*` 식별자는 ADR-923 Phase 6 (`7f1cf963d`) 에서 `Engine*` 로 개명됐다 ("Taffy 가 계산한다" 로 읽혀 분석을 잘못 이끌었기 때문, ADR-923 R10). 개명 지도: `docs/adr/evidence/923-phase6-naming-capability-seed.md` §1.

production 이 쓰는 어댑터는 `gridStyleAdapter.ts` `parseGridTemplate` (compositionRoot `containerTracks`) 와 `persistentLayoutTree.ts` 뿐이다. `flexStyleAdapter.ts` `elementToEngineStyle` · `blockStyleAdapter.ts` `elementToEngineBlockStyle` 는 `fullTreeLayout.ts` (parity) 소비.

---

## 2. WASM 경계 계약

### LayoutEngineAPI (`layoutBridge.ts:28`)

`PersistentLayoutTree` 가 실제 호출하는 **batch 계약** 기준 (per-node API 아님):

- batch 구축: `buildTreeBatch(nodesJson)` / `buildTreeBatchBinary(data)` / `hasBinaryProtocol()`
- 증분 갱신: `createNodeRaw` / `updateStyleRaw` / `setChildren` / `markDirty` / `removeNode`
- 계산/수집: `computeLayout(root, availW, availH)` / `getLayoutsBatch(handles)`
- 상태: `isAvailable()` / `clear()` / `nodeCount()`

`getLayoutsBatch` 는 WASM 이 flat `[x0,y0,w0,h0, x1,...]` Float32Array 를 반환하면 `flatToLayoutMap()` (engine.ts:113) 이 handle 순서로 4개씩 잘라 `Map<handle, LayoutResult>` 로 재구성한다. `EngineLayout` 클래스는 engine.ts:135. `wasm.rs` 의 `js_name` 노출은 20개 (2026-10-04).

### batch JSON 계약

- **post-order 배열** (리프 먼저, 루트 마지막). `children` 은 같은 배열 내 **인덱스** (forward-reference 는 Rust 측 Err).
- 루트 handle = `handles[handles.length - 1]` (persistentLayoutTree.ts:213).
- style 은 **이미 정규화된 Record** — 숫자 dimension → `"Npx"` 문자열. production 은 `styleOf` 의 `px()`, parity 는 `engineStyleToRecord()`. `updateStyleRaw` / `createNodeRaw` 는 이중 변환을 피하려 raw 경로.
- Rust 측 스키마 = `NodeStyle` (tree.rs:185) — serde `camelCase` rename 으로 JS record 와 1:1. `gridTemplateAreas` 필드는 **없음** — grid area 이름은 숫자 line 으로 병기 (정본 rules/layout-engine.md §Grid area 이름 해석).

### PersistentLayoutTree 변경 감지 2중 구조 (persistentLayoutTree.ts)

- `PersistentLayoutTree` 클래스 :94.
- `_lastJsonMap` (:116): style JSON 문자열 비교 — 같으면 WASM 호출 스킵 (`updateNodeStyle` :248).
- `childrenHashMap` (:122): `childIds.join(',')` 비교 → 같으면 `setChildren` 스킵 (`updateChildren` :303).
- `buildFull` :165.
- 이 JSON 비교는 WASM 호출 최소화 계층이다. "다시 계산할지" 판정은 그 위의 composition root (`plan` · `planRecord` 의 `styleFor` 전체 비교) 가 한다.

### binary protocol — 휴면 경로

`binaryProtocol.ts` (`encodeBatchBinary` :590, magic `"TAFF"`) 는 보존돼 있고 `buildFull` 이 `hasBinaryProtocol()` 로 분기하지만, **자체 엔진은 false 를 반환** (wasm.rs `has_binary_protocol`) 하므로 live 경로는 항상 JSON `buildTreeBatch` 다. `buildTreeBatchBinary` 는 계약 충족용 stub (호출 시 Err).

### grid track / dimension 정규화

- production: `compositionRoot.ts` `containerTracks` 가 `gridTemplateColumns/Rows` 문자열을 `parseGridTemplate` (gridStyleAdapter.ts:33, 괄호 depth 토큰화) 로 배열화. 길이는 `px()` 가 `"Npx"` 로.
- parity: `fullTreeLayout.ts` 의 `coerceGridTrack` (:806) · `normalizeGridDimFields` + `GRID_DIM_FIELDS`. **Why (2026-07-06)**: 숫자 값 (`rowGap: 4`) 이 문자열화되지 않으면 `build_tree_batch: invalid type integer 4, expected string` parse error → layout null.

---

## 3. `calculateFullTreeLayout` — parity 하니스 전용 파이프라인

> production 호출자 0 — `apps/builder/tests/parity/**` 와 일부 테스트만 부른다 (rules/layout-engine.md §`fullTreeLayout.ts` 파이프라인). 여기를 고쳐도 Builder 화면은 바뀌지 않는다. 진입점 `calculateFullTreeLayout` (fullTreeLayout.ts:2951) · `calculateFullTreeLayoutFromSceneModel` (:3893).

| Step   | 내용                                                                                                                                               |
| ------ | -------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1      | `traversePostOrder` DFS — implicit style / enrichment / CSS resolve 를 수행하며 `batch[]` + `indexMap` 구성. 최대 깊이 `MAX_TREE_DEPTH=100` (:140) |
| 1.5    | body 루트에 breakpoint 페이지 크기 명시 주입 (자식 `100%` 기준 보장)                                                                               |
| 2      | `filteredChildIdsMap` 구성 · `publishFilteredChildrenMap`                                                                                          |
| 3      | full rebuild vs 증분 판정 → `buildFull` / `incrementalUpdate`                                                                                      |
| 4      | `computeLayout(availableWidth, availableHeight)`                                                                                                   |
| 4.5    | 2-pass width 교정 — 실제 할당 width 가 1차와 다르면 re-enrich → 재계산 (`WIDTH_TOLERANCE=2`)                                                       |
| 4.5b/c | TagGroup maxRows chip 접힘 · RowsGroup 실측 height → TagList                                                                                       |
| 5      | `getLayoutsBatch()` → `Map<elementId, ComputedLayout>` + `sanitizeLayoutValue`                                                                     |

- persistent tree 는 `rootKey` 별로 분리 (`persistentTrees` Map, :318).
- Step 3 full rebuild 조건: 최초 · 신규 grid container · 자식 서브트리를 가진 신규 노드 · display 전환 · grid container 의 `GRID_REBUILD_TRIGGER_KEYS` (:876) 변경. **production (catalog) 경로에는 이 가드가 없다** — 증상이 재현되면 엔진 `update_style` · `add_node` 부터 본다 (rules/layout-engine.md 「재확인 필요」).
- DFS post-order 와 implicit style 순서 문제: 부모의 `applyImplicitStyles` 가 자식 style 을 고쳐도 자식 batch entry 는 이미 생성됨 → `patchBatchStyleFromImplicit()` (:932) 가 변경 속성만 패치 (`IMPLICIT_DIM_PROPS` :906).
- Label DFS 주입: `LABEL_SIZE_STYLE` · `LABEL_DELEGATION_PARENT_TAGS` · `LABEL_WRAPPER_TAGS` (Checkbox/Radio).
- 옛 store 레벨 `layoutVersion` · 5-심볼 2계층 체인은 삭제됐다. 같은 이름 상수는 `presentation/invalidation/editorMutationEffectRegistry.ts` 에 테스트용 파생 view 로만 남는다. production 판정은 `PAINT_ONLY_VISUAL_KEYS` / `operationAffectsLayout` (`packages/shared/src/catalog/transactions/transaction.ts`) + `styleOf` diff.

---

## 4. JS 측 측정 · 정규화 모듈

| 모듈                        | production 사용                                                                                                                         | 내용                                                                                                                                                                          |
| --------------------------- | --------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `engines/utils.ts`          | 측정 함수만 (`calculateMaxContentWidth` · `calculateMinContentWidth` · `measureTextWidth` — `catalogTextMeasure` 의 Canvas 2D fallback) | intrinsic 측정·box model·태그별 크기. `enrichWithIntrinsicSize` · `calculateContentWidth/Height` · `parseBoxModel` · `applyCommonEngineStyle` · `readGapValue` 는 parity 경로 |
| `engines/cssResolver.ts`    | `DEFAULT_FONT_FEATURES` (textMeasure)                                                                                                   | inherit/initial/unset/revert + currentColor cascade (`resolveStyle` 은 parity)                                                                                                |
| `engines/implicitStyles.ts` | 없음 (parity)                                                                                                                           | 태그별 implicit style — `POPOVER_CHILDREN_TAGS` · `FIELD_VISIBLE_CHILD_TAGS` · `injectCollectionItemFontStyles`                                                               |
| `engines/cssValueParser.ts` | —                                                                                                                                       | px/%/vw/em/calc()/clamp()/var() 해석. `packages/specs/src/primitives/cssValueParser.ts` (ADR-907 Layer A) 와 별개 파일                                                        |
| `engines/displayAdapter.ts` | —                                                                                                                                       | CSS display 값을 그대로 엔진 경계로 운반 (ADR-923 Phase 5) — outer/inner 해석·blockify·line box 는 엔진 `display.rs` · `tree.rs` · `block.rs`                                 |

production 에서 이 계층이 하던 일 (상속 텍스트 키, box model, 컨테이너 기본값, indicator 여백) 은 `compositionRoot.ts` (`CATALOG_INHERITED_TEXT_KEYS` · `styleOf`) · `catalogRuntime/boxModel.ts` · `document/rulePartRules.ts` 로 옮겨졌다.

---

## 5. Rust 측 구조 — `packages/engine`

Cargo.toml 에 **taffy dependency 부재가 crate 존재 이유** — 추가 금지 (Cargo.toml 헤더 주석). 의존성: wasm-bindgen / js-sys / serde / serde_json 뿐.

| 모듈               | 줄 수 (2026-10-04) | 담당                                                                                                                                               | 계약                                         |
| ------------------ | ------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------- |
| `flex.rs`          | 2,266              | CSS-FLEXBOX-1 — §9.7 grow/shrink 반복 동결, §9.3 wrap, align-content, intrinsic sentinel, auto margin (`margin_auto_mask`), baseline, aspect-ratio | flat f32, `FLEX_FIELD_COUNT=23`/노드, 논리축 |
| `block.rs`         | 1,059              | CSS 2.1 §8 — margin collapse (through-collapse chain), inline-block line box, fit-content                                                          | flat f32, `FIELD_COUNT=21`/노드, 물리축      |
| `grid.rs`          | 1,978              | CSS-GRID-1 §7 track sizing / §8 placement — repeat(auto-fill/fit)/minmax/named areas/span                                                          | 문자열 template + placement_spec             |
| `tree.rs`          | 11,981             | 오케스트레이션 — `LayoutTree` (:585) handle 관리, `build_tree_batch` (:952), post-order solve, dirty 조상 전파, grid `fit-content()` 트랙          | `NodeStyle` (:185) camelCase JSON            |
| `style.rs`         | 1,042              | CSS 값 산술 커널 — 단위/calc/clamp/min/max/env + font/border shorthand. var()/토큰은 JS 잔류                                                       | intrinsic → 센티넬 f32                       |
| `cascade.rs`       | 1,176              | 상속/초기값/cascade 키워드/currentColor/논리→물리                                                                                                  | —                                            |
| `display.rs`       | 320                | display parse/blockify/classify                                                                                                                    | —                                            |
| `trace.rs`         | 276                | 레이아웃 trace (`tests/layout_trace.rs`)                                                                                                           | —                                            |
| `spatial_index.rs` | 394                | hit-test/viewport culling 그리드 셀 인덱스                                                                                                         | `#[wasm_bindgen]` 직접 export                |
| `wasm.rs`          | 255                | `LayoutEngine` wrapper — `js_name` camelCase, JSON 역직렬화 + flat f32 직렬화 + Err→JsValue                                                        | `#[cfg(target_arch = "wasm32")]`             |

핵심 좌표 계약: `tree.rs::compute_layout` 은 자식 좌표를 **부모 content-box 상대**로 산출한다. 절대 좌표 누적은 소비처 책임 — 이를 tree.rs 버그로 오인해 고치면 live 렌더가 깨진다 (tree_golden 하네스가 조상 offset 누적으로 정합 확인, 2026-07-06 교훈).

### 구현 범위

- 각 모듈 헤더의 "미구현" 목록은 낡았다 — flex 의 aspect-ratio (슬롯 22) · auto margin (슬롯 20) · baseline (슬롯 21), tree.rs 의 grid `fit-content()` 트랙은 구현돼 있다. 판정은 헤더가 아니라 코드 · golden 테스트로 한다.
- 헤더 기준 미대상으로 남은 것 (코드 확인 전 가정 금지): block float/clear · writing-mode, grid subgrid · dense 역채움.
- implicit auto row/column intrinsic 은 **tree.rs `solve_grid` 가 자식 선-solve 로 보완** (grid.rs 단독은 미측정).

### 테스트 자산

| 테스트                  | 성격                                                                                                                        |
| ----------------------- | --------------------------------------------------------------------------------------------------------------------------- |
| lib unit                | `src/*.rs` `#[cfg(test)]` — 모듈별 명세 단위                                                                                |
| `tests/golden.rs`       | 세 완결 엔트리 (`flex_layout`/`grid_layout`/`block_layout`) 를 **CSS 명세 계산값**으로 회귀 고정 (`#[test]` 15, 2026-10-04) |
| `tests/tree_golden.rs`  | **Chrome 실측 독립 oracle** — tree.rs 회귀를 감시하는 외부 권위 (`#[test]` 15, 2026-10-04)                                  |
| `tests/layout_trace.rs` | `trace.rs` 회귀                                                                                                             |

실행: `cargo test` (engine 디렉토리, native). **주의**: 소스를 고쳤다 되돌리면 mtime 때문에 cargo 가 stale binary 를 재사용할 수 있다 — 의심 시 `cargo clean -p engine`.

---

## 6. WASM 로드/플래그

- `wasm-bindings/init.ts::initAllWasm()` — engine WASM (+SpatialIndex) 과 CanvasKit 을 병렬 로드. `CatalogBuilderCore.tsx` 가 이를 **await 한 뒤** `createLayoutEngine()` (동기 factory — 전역 캐시 `engineWasm.ts` 를 읽음) 으로 workspace 를 만든다. 옛 부트스트랩 폴링 (`useCanvasRuntimeBootstrap`) 은 없다.
- pkg 산출물: `wasm-bindings/engine-pkg/` (wasm-pack `--target bundler`). 빌드: `pnpm wasm:build:engine`. gitignore.
- `featureFlags.ts` — `UNIFIED_ENGINE_FLAGS.USE_RUST_LAYOUT_ENGINE: true` (상수), `WASM_FLAGS.SPATIAL_INDEX: true`.

---

## 7. 디버깅 진입점

| 증상/신호                                                     | 보는 곳                                                                                                                                                   |
| ------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `engine WASM initialized` 로그 부재                           | `engineWasm.ts` — WASM 로드 실패. init.ts 경로/flag 확인                                                                                                  |
| `build_tree_batch: invalid type ... expected string/sequence` | 엔진 입력 미정규화 — production 은 `styleOf` 의 `px()` / `containerTracks`, parity 는 `coerceGridTrack` / `GRID_DIM_FIELDS`                               |
| 특정 노드 엔진 입력 확인                                      | `root.getLayoutInput(id)` (compositionRoot) — `styleOf` 가 엔진에 넘긴 값                                                                                 |
| 특정 노드 계산 결과 확인                                      | `root.getGeometry(ids)` — Canvas 가 읽는 rect                                                                                                             |
| 편집이 Canvas 상자에 미반영                                   | ① 새 키가 `styleOf` 엔진 입력에 없음 ② `PAINT_ONLY_VISUAL_KEYS` 에 잘못 등재 (transaction 이 layout 영향 0 으로 판정) — rules/layout-engine.md 체크리스트 |
| 등록 직후 겹침/1줄 degrade, 새로고침 후 정상                  | 증분 경로 엔진 결함 후보 (catalog 에는 full rebuild 가드 없음) — 엔진 `update_style` · `add_node`                                                         |
| Rust 커널 회귀 의심                                           | `cargo test` → `tests/tree_golden.rs` (Chrome 실측 대조) — 좌표는 부모 content-box 상대 계약 전제                                                         |

레이어 판정 순서: **Canvas 좌표 이상 → `getGeometry` 값 확인** → 정상이면 렌더 경로 (canvas-rendering.md), 이상이면 `getLayoutInput` (엔진 입력) → `styleOf` · `catalogBoxModel` 순. 옛 `getSharedLayoutMap` 은 production 에서 비어 있다 (`publishLayoutMap(null, …)` 만 호출).

---

## 8. 역사적 맥락

| 시기          | 구성                                                                                                                                       | 근거                             |
| ------------- | ------------------------------------------------------------------------------------------------------------------------------------------ | -------------------------------- |
| 2026-01~02    | display 별 이종 엔진 — DropflowBlockEngine(JS) + Taffy WASM, per-level 호출 + @pixi/layout                                                 | ADR-005 이전                     |
| 2026-02~03    | Full-Tree 단일 WASM 호출 (DFS post-order batch) + PersistentLayoutTree 증분, Taffy 단일 엔진                                               | ADR-005 / ADR-009                |
| 2026-07-03~06 | 자체 Rust 엔진 `engine` — dual-run diff 0 → live 전환 → Taffy 물리 삭제 (tree_golden 이 독립 oracle 승계)                                  | ADR-916 (Implemented 2026-07-06) |
| 2026-10-03    | production 레이아웃을 catalog composition root 가 직접 구동 — `fullTreeLayout.ts` · store `layoutVersion` 체인 은퇴 (parity 하니스만 잔존) | ADR-248 Phase 4                  |

과거 결정 경위는 ADR-916 Status log 와 `docs/adr/design/916-unified-rust-engine-breakdown.md` 참조.
