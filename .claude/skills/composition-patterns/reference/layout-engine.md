# Layout Engine 구현 상세 — composition-engine (자체 Rust WASM) + JS 어댑터

> **정본 분리**: 원칙·금지 패턴 정본은 [.claude/rules/layout-engine.md](../../../rules/layout-engine.md) 와
> [.claude/rules/canvas-rendering.md](../../../rules/canvas-rendering.md). 본 문서는 그 정본이 다루지 않는
> **구현 위치·계약·디버깅 진입점**만 담는다. 규칙이 충돌하면 정본 우선.
>
> **공식 결정**: [ADR-916](../../../../docs/adr/completed/916-unified-rust-engine.md) — 자체 단일 Rust 엔진 통합
> (Implemented 2026-07-06, endgame Taffy 완전 제거 포함). 본 문서 기준일: 2026-07-07.

## 목차

1. 아키텍처 개요 — 계층과 호출 체인
2. WASM 경계 계약 — LayoutEngineAPI / batch 직렬화 / grid track 정규화
3. `calculateFullTreeLayout` 파이프라인 (Step 1~5)
4. DFS 상단 JS 계층 — enrichment / implicit styles / CSS resolve
5. Rust 측 구조 — composition-engine 모듈과 테스트
6. WASM 로드/플래그
7. 디버깅 진입점
8. 역사적 맥락 (Dropflow → Taffy → 자체 엔진)

---

## 1. 아키텍처 개요

레이아웃은 **단일 엔진 + 단일 WASM 호출 흐름**이다. Taffy 는 2026-07-06 에 물리 삭제되었고
(crate 2종 + pkg + JS 13파일), 자체 Rust 엔진 `composition-engine` 이 유일 경로다 — 폴백 없음.

```
useLayoutPublisher (canvas/hooks/)
  └─ getCachedPageLayout (canvas/scene/layoutCache.ts — signature 기반 페이지 캐시)
       └─ calculateFullTreeLayoutFromSceneModel (engines/fullTreeLayout.ts:2887 — ADR-125 canonical entry)
            └─ calculateFullTreeLayout (fullTreeLayout.ts:2236 — DFS + batch 구성)
                 └─ PersistentTaffyTree (engines/persistentTaffyTree.ts:59 — 증분 갱신 + handle 관리)
                      └─ createLayoutEngine() (wasm-bindings/layoutBridge.ts:59 — factory seam)
                           └─ CompositionEngineLayout (wasm-bindings/compositionEngine.ts:67 — 동기 wrapper)
                                └─ wasm.rs LayoutEngine (packages/composition-engine/src/wasm.rs)
                                     └─ tree::LayoutTree (src/tree.rs:217 — flex/block/grid dispatch)
```

| 계층                 | 위치                                                                                      | 역할                                                                                            |
| -------------------- | ----------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------- |
| Rust 커널            | `packages/composition-engine/src/{flex,block,grid}.rs`                                    | CSS 명세 기반 단일 컨테이너 solver (flat f32 계약)                                              |
| Rust 오케스트레이션  | `packages/composition-engine/src/tree.rs`                                                 | batch 트리 빌드 → post-order solve → dirty 증분 재계산                                          |
| WASM wrapper         | `packages/composition-engine/src/wasm.rs`                                                 | `LayoutTree` 를 JS `LayoutEngineAPI` 16 메서드로 노출 (`#[cfg(target_arch = "wasm32")]` 게이트) |
| JS 동기 wrapper      | `apps/builder/src/builder/workspace/canvas/wasm-bindings/compositionEngine.ts`            | raw 반환(Uint32Array/Float32Array) → number[]/Map 변환                                          |
| 엔진 factory         | `wasm-bindings/layoutBridge.ts`                                                           | `createLayoutEngine()` — 자체 엔진 단독 반환 (ADR-916 Phase 0-A seam)                           |
| Persistent 트리      | `layout/engines/persistentTaffyTree.ts`                                                   | elementId↔handle 매핑, JSON 비교 증분 갱신, 페이지 전환 reset                                   |
| Full-tree 파이프라인 | `layout/engines/fullTreeLayout.ts`                                                        | DFS post-order + enrichment + batch 직렬화 + 2-pass 교정                                        |
| DFS 상단 (JS 잔류)   | `layout/engines/{utils,implicitStyles,cssResolver,cssValueParser,taffyDisplayAdapter}.ts` | store/spec/tag 도메인 의존 계층 — Rust 이관 대상 아님 (ADR-916 2-B 실사)                        |

### "Taffy" 네이밍 보존 규약

`TaffyFlexEngine.ts` / `TaffyBlockEngine.ts` / `TaffyGridEngine.ts` / `persistentTaffyTree.ts` /
`TaffyStyle`(layoutTypes.ts) 는 **심볼명만 Taffy 계보 표기로 보존**된 순수 TypeScript 코드다.
엔진 클래스는 삭제되었고 (ADR-916 1-E, commit `f2ac4860c`), 남은 것은 live 소비되는 style 변환 helper 뿐:

| 파일                           | 잔존 심볼                      | 소비처                                       |
| ------------------------------ | ------------------------------ | -------------------------------------------- |
| `TaffyFlexEngine.ts`           | `elementToTaffyStyle()` (:101) | fullTreeLayout.ts:42                         |
| `TaffyBlockEngine.ts`          | `elementToTaffyBlockStyle()`   | fullTreeLayout.ts:41                         |
| `TaffyGridEngine.ts`           | `parseGridTemplate()` (:33)    | fullTreeLayout.ts:43 (`coerceGridTrack`)     |
| `wasm-bindings/layoutTypes.ts` | `TaffyStyle` 등 타입           | 자체 엔진 Rust `NodeStyle` 스키마와 1:1 대응 |

**Why**: 이름까지 rename 하면 소비처 diff 표면만 커진다 — layoutTypes.ts 헤더가 "스타일 스키마 계보 표기로 유지"를 명문화.

---

## 2. WASM 경계 계약

### LayoutEngineAPI (layoutBridge.ts:28)

`PersistentTaffyTree` 가 실제 호출하는 **batch 계약** 기준으로 인터페이스가 정의된다 (per-node API 아님):

- batch 구축: `buildTreeBatch(nodesJson)` / `buildTreeBatchBinary(data)` / `hasBinaryProtocol()`
- 증분 갱신: `createNodeRaw` / `updateStyleRaw` / `setChildren` / `markDirty` / `removeNode`
- 계산/수집: `computeLayout(root, availW, availH)` / `getLayoutsBatch(handles)`
- 상태: `isAvailable()` / `clear()` / `nodeCount()`

`getLayoutsBatch` 는 WASM 이 flat `[x0,y0,w0,h0, x1,...]` Float32Array 를 반환하면
`flatToLayoutMap()`(compositionEngine.ts:46) 이 handle 순서로 4개씩 슬라이스해 `Map<handle, LayoutResult>` 로 재구성한다.

### batch JSON 계약

- **post-order 배열** (리프 먼저, 루트 마지막). `children` 은 같은 배열 내 **인덱스** (forward-reference 는 Rust 측에서 Err).
- 루트 handle = `handles[handles.length - 1]` (persistentTaffyTree.ts:178).
- style 은 `taffyStyleToRecord()`(fullTreeLayout.ts:621) 로 **이미 정규화된 Record** 여야 한다
  (숫자 dimension → `"Npx"` 문자열). `updateStyleRaw`/`createNodeRaw` 는 이중 변환을 피하려 raw 경로 사용.
- Rust 측 스키마 = `NodeStyle`(tree.rs:99) — serde `camelCase` rename 으로 JS record 와 1:1.
  `gridTemplateAreas` 필드는 **없음** — grid area 이름은 JS factory 가 숫자 line 으로 병기한다
  (정본 rules/layout-engine.md §Grid area 이름 해석).

### binary protocol — 현재 휴면 경로

`binaryProtocol.ts`(`encodeBatchBinary`, :569, magic `"TAFF"`) 는 보존되어 있고
`PersistentTaffyTree.buildFull`(:137) 이 `hasBinaryProtocol()` 로 분기하지만, **자체 엔진은 false 를
반환**(wasm.rs `has_binary_protocol` → false) 하므로 현행 live 경로는 항상 JSON `buildTreeBatch` 다.
`buildTreeBatchBinary` 는 계약 충족용 stub (호출 시 Err). binary 최적화는 별도 착수 대상.

### grid track / dimension 정규화 — 3 진입점 + grid branch 전용 px 화

- `coerceGridTrack()`(fullTreeLayout.ts:416): CSS string `"1fr auto"` → track array `["1fr","auto"]`.
  이미 array 면 통과. `parseGridTemplate`(TaffyGridEngine.ts:33, 괄호 depth 토큰화) 위임.
  공유 진입점 3곳 — `taffyStyleToRecord`(:657-665) / `buildNodeStyle` grid branch(:800-807) /
  `patchBatchStyleFromImplicit`(:593).
- `normalizeGridDimFields()`(fullTreeLayout.ts:466) + `GRID_DIM_FIELDS`(:435, 25 keys):
  grid branch 는 `taffyStyleToRecord.dim()` 정규화를 우회하는 partial 직접 반환 경로라
  숫자 값(`rowGap: 4` 등)을 자체적으로 `"4px"` 문자열화해야 한다.
  **Why**: 누락 시 `build_tree_batch: invalid type integer 4, expected string` parse error →
  layout null → persistent tree 리셋 무한 재시도 (2026-07-06 전수조사, fullTreeLayout.ts:430 주석).

---

## 3. `calculateFullTreeLayout` 파이프라인 (fullTreeLayout.ts:2236)

진입 가드: `isCompositionEngineReady()` false 면 즉시 null (부트스트랩 폴링이 재시도 담당).

**멀티페이지/Frame 격리**: persistent tree 는 `rootKey = page_id ?? frameMirrorId ?? rootElementId`
별로 분리 저장 (`persistentTrees` Map, :144). **Why**: Frame body 는 page_id 가 null — 분리하지 않으면
여러 reusable Frame 이 같은 트리를 공유해 root state 가 섞인다.

| Step | 위치  | 내용                                                                                                                                                                                          |
| ---- | ----- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1    | :2264 | `traversePostOrder` DFS — implicit style / enrichment / CSS resolve 를 항상 수행하며 `batch[]` + `indexMap` + `processedElementsMap` 구성. 최대 깊이 `MAX_TREE_DEPTH=100`(:81)                |
| 1.5  | :2292 | body 루트에 breakpoint 페이지 크기 명시 주입 (content-box available + padding/border → border-box). **Why**: 자식 `100%` 기준 보장                                                            |
| 2    | :2313 | `filteredChildIdsMap` 구성 → `publishFilteredChildrenMap` + synthetic elements publish                                                                                                        |
| 3    | :2329 | **full rebuild vs 증분** 판정 (아래) → Path A `buildFull` / Path B `incrementalUpdate`                                                                                                        |
| 4    | :2399 | `persistentTree.computeLayout(availableWidth, availableHeight)`                                                                                                                               |
| 4.5  | :2402 | 2-pass width 교정 — 1차 enrichment 는 부모 availableWidth 기준이라 실제 할당 width(grid 1fr / flex-grow) 와 다르면 re-enrich → `updateNodeStyle` + `markDirty` → 재계산 (`WIDTH_TOLERANCE=2`) |
| 4.5b | :2467 | TagGroup maxRows chip 접힘 — Taffy 실측 행 번호 기반                                                                                                                                          |
| 4.5c | :2662 | RowsGroup 실측 height → TagList height 강제 (실측이 SSOT)                                                                                                                                     |
| 5    | :2780 | `getLayoutsBatch()` → `Map<elementId, ComputedLayout>` + `sanitizeLayoutValue`(NaN/Infinity 방어) + overflow scroll `maxScroll` 갱신 (`queueMicrotask` 로 setState 격리)                      |

에러 시(:2856): `resetPersistentTree(rootKey)` 후 null 반환 → 다음 프레임 Path A 재빌드.

### Step 3 — full rebuild 판정 조건 (모두 fullTreeLayout.ts:2333-2388)

1. `!persistentTree.isInitialized` — 최초.
2. **신규 노드(prevJson 없음)가 grid container** — `addNode` 증분으로는 grid track 이 auto-placement 로 degrade.
3. **신규 노드가 자식 서브트리 보유** — `addComplexElement` 일괄 등록 시 자식 layout=undefined 겹침 (ADR-912 R1 후속).
4. **display 전환** (`prevParsed.display !== curDisplay`).
5. **기존 grid container 의 `GRID_REBUILD_TRIGGER_KEYS`(:482, 20 keys) 변경** — `updateStyleRaw` 가
   track/placement 캐시 invalidation 에 실패 (dimension 6키 포함, 2026-06-16 추가).
   정적 가드: `fullTreeLayout.static.test.ts`.

원칙·금지 패턴은 정본 §PersistentTaffyTree display/grid 전환 감지 참조 — 여기는 코드 위치만.

### PersistentTaffyTree 변경 감지 2중 구조 (persistentTaffyTree.ts)

- `_lastJsonMap`(:81): style JSON 문자열 비교 — 부모/형제 변경이 enrichment/display adapter 결과를
  바꾸는 **간접 의존성**까지 포착. 동일하면 WASM 호출 스킵 (`updateNodeStyle`:213).
- `childrenHashMap`(:87): `childIds.join(',')` 비교 → 동일하면 `setChildren` 스킵 (`updateChildren`:268).
- store 레벨 `layoutVersion` 과는 **독립 계층** — layoutVersion 은 useMemo 재실행 트리거,
  JSON 비교는 WASM 호출 최소화 (정본 §layoutVersion 계약).

### layoutVersion 5-심볼 2계층 체인 — 현행 코드 위치

2026-07-17 실측 (이전 표는 심볼 3개만 담고 라인도 drift 했다 — **라인은 또 drift 하므로 심볼명 grep 을 1차 수단으로 쓸 것**):

| 계층                     | 심볼                             | 실제 위치                              | 축    | 방식                  |
| ------------------------ | -------------------------------- | -------------------------------------- | ----- | --------------------- |
| A (layoutVersion 트리거) | `LAYOUT_AFFECTING_PROP_KEYS`     | `stores/utils/layoutInvalidation.ts:6` | props | allowlist             |
| A                        | `NON_LAYOUT_PROPS_UPDATE`        | `stores/utils/elementUpdate.ts:49`     | style | **blacklist**         |
| A                        | `INHERITED_LAYOUT_PROPS_UPDATE`  | `stores/utils/elementUpdate.ts:103`    | 상속  | allowlist             |
| B (캐시 시그니처)        | **`LAYOUT_STYLE_KEYS`**          | `canvas/scene/layoutCache.ts:49`       | style | allowlist             |
| B                        | `LAYOUT_PROP_KEYS`               | `canvas/scene/layoutCache.ts:112`      | props | allowlist             |
| —                        | `isLayoutAffectingUpdate()`      | `stores/utils/elementUpdate.ts:166`    | —     | A-style 판정 진입점   |
| —                        | `createElementLayoutSignature()` | `canvas/scene/layoutCache.ts:183`      | —     | B 진입점 (두 축 결합) |

A·B 는 **AND 조건**이며 축(props/style)에 따라 배열이 갈린다. 정본: `.claude/rules/layout-engine.md` §"5-심볼 2계층 체인". 주의: `LAYOUT_AFFECTING_PROPS`(`_KEYS` 없음)는 코드에 0건인 과거 심볼이나, **`LAYOUT_AFFECTING_PROP_KEYS` 는 활성**이다 — 혼동 금지.

---

## 4. DFS 상단 JS 계층 (Rust 이관 제외 영역)

ADR-916 2-B 착수 전 실사로 확정: DFS 상단 3-step (`resolveStyle` = store 의존 /
`applyImplicitStyles` = tag/spec 의존 / `enrichWithIntrinsicSize` = specs·propagationRegistry 의존) 은
**JS 잔류**. Rust 는 상단이 순수화한 TaffyStyle record 만 받는다.

| 모듈                                  | 역할                                                                                                                              | 핵심 심볼                                                                                                                                                                                                                                                             |
| ------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `engines/utils.ts` (4,872줄)          | intrinsic 측정·box model·태그별 크기                                                                                              | `enrichWithIntrinsicSize`(:3959), `calculateContentWidth`(:1213), `calculateContentHeight`(:2036), `parseBoxModel`(:3651), `applyCommonTaffyStyle`(:4653), `applyFlexItemProperties`(:4747), `readGapValue`(:310 — longhand 우선 gap 읽기), `measureTextWidth`(:1094) |
| `engines/implicitStyles.ts` (2,448줄) | 태그별 implicit style 주입 (순수 함수)                                                                                            | `applyImplicitStyles`, `resolveContainerStylesFallback`, `POPOVER_CHILDREN_TAGS`(:430), `FIELD_VISIBLE_CHILD_TAGS`(:453)                                                                                                                                              |
| `engines/cssResolver.ts`              | inherit/initial/unset/revert + currentColor cascade                                                                               | `resolveStyle`, `getRootComputedStyle`(themeConfigStore 의존 — Rust 미이관 사유)                                                                                                                                                                                      |
| `engines/cssValueParser.ts`           | px/%/vw/em/calc()/clamp()/var() 해석                                                                                              | `CSSVariableScope`, `createVariableScopeWithDOMFallback` — **주의**: `packages/specs/src/primitives/cssValueParser.ts`(ADR-907 Layer A) 와 별개 파일                                                                                                                  |
| `engines/taffyDisplayAdapter.ts`      | CSS Display Level 3 이원 구조(outer/inner) → 엔진 display 매핑, blockification, inline-block 자식 부모 → flex row wrap 시뮬레이션 | `toTaffyDisplay`, `blockifyDisplay`, `getElementDisplay`, `needsBlockChildFullWidth`, `VERTICAL_ALIGN_MIDDLE_TAGS`(:152)                                                                                                                                              |

### DFS post-order 와 implicit style 의 순서 문제

`traversePostOrder` 는 자식을 먼저 batch 에 넣는다 → 부모의 `applyImplicitStyles` 가 자식 style 을
수정해도 자식 batch entry 는 이미 생성된 후. 해결: `patchBatchStyleFromImplicit()`(fullTreeLayout.ts:540)
가 변경된 속성만 찾아 이미 생성된 entry 를 패치 (`IMPLICIT_DIM_PROPS`:512 는 number→`"Npx"` 변환 대상).

### Label DFS 주입 (ADR-048)

- `LABEL_SIZE_STYLE`(fullTreeLayout.ts:84): size → `{fontSize, lineHeight("Npx" 문자열)}` — LabelSpec 단일 소스 미러.
- `LABEL_DELEGATION_PARENT_TAGS`(:96, 20 태그) / `LABEL_WRAPPER_TAGS`(:122 — Checkbox/Radio).
- 주입 조건 (`lineHeight == null`)·금지 패턴은 정본 §Label size delegation 참조.

---

## 5. Rust 측 구조 — `packages/composition-engine`

Cargo.toml 에 **taffy dependency 부재가 crate 존재 이유** — 추가 금지 (Cargo.toml:5 주석).
의존성: wasm-bindgen / js-sys / serde / serde_json 뿐.

| 모듈               | 라인  | 담당                                                                                                                                                                                                                  | 계약                                                        |
| ------------------ | ----- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------- |
| `flex.rs`          | 1,228 | CSS-FLEXBOX-1 — §9.7 grow/shrink 반복 동결, §9.3 wrap, align-content, main 음수 sentinel(intrinsic) 처리, `ALIGN_STRETCH` cross_is_auto 가드                                                                          | flat f32, `FLEX_FIELD_COUNT=17`/노드, 논리축                |
| `block.rs`         | 712   | CSS 2.1 §8 — margin collapse(§8.3.1 through-collapse chain 포함), inline-block line box, fit-content                                                                                                                  | flat f32, `FIELD_COUNT=19`/노드, 물리축                     |
| `grid.rs`          | 1,050 | CSS-GRID-1 §7 track sizing / §8 placement — repeat(auto-fill/fit)/minmax/named areas/span. 구 `grid_layout.rs` 산술 + `GridLayout.utils.ts` 알고리즘 통합 승계                                                        | 문자열 template + placement_spec (자식 flat 없음)           |
| `tree.rs`          | 2,600 | 오케스트레이션 — `LayoutTree`(:217) handle 관리(free_list 재활용), `build_tree_batch`(:368), post-order `solve_node` → flex/block/grid dispatch, dirty 조상 전파 + clean 서브트리 skip, available 변경 시 전면 무효화 | `NodeStyle`(:99) camelCase JSON                             |
| `style.rs`         | 1,042 | CSS 값 산술 커널 (cssValueParser 순수 계층 이식) — 단위/calc/clamp/min/max/env + font/border shorthand. var()/토큰은 JS 잔류 (선치환 입력)                                                                            | intrinsic → 센티넬 f32 (FIT/MIN/MAX_CONTENT)                |
| `cascade.rs`       | 1,176 | cssResolver 자기완결 계층 — 상속 19종/초기값/cascade 키워드/currentColor/논리→물리                                                                                                                                    | `getRootComputedStyle` 은 미이식 (store 의존)               |
| `display.rs`       | 283   | taffyDisplayAdapter 순수 문자열 계층 — parse/blockify/classify                                                                                                                                                        | tag 의존 함수는 미이식                                      |
| `spatial_index.rs` | 394   | hit-test/viewport culling 그리드 셀 인덱스 — 구 composition_wasm(Taffy) crate 에서 분리 편입 (endgame kill criteria ②)                                                                                                | `#[wasm_bindgen]` 직접 export                               |
| `wasm.rs`          | 175   | `LayoutEngine` wrapper — 16 메서드 `js_name` camelCase, JSON 역직렬화 + flat f32 직렬화 + Err→JsValue 만 담당                                                                                                         | `#[cfg(target_arch = "wasm32")]` — native cargo test 무영향 |

핵심 좌표 계약: `tree.rs::compute_layout` 은 자식 좌표를 **부모 content-box 상대**로 산출한다
(구 taffy_bridge 와 동일). 절대 좌표 누적은 소비처 책임 — 이를 tree.rs 버그로 오인해 수정하면
live 렌더가 깨진다 (tree_golden 하네스가 조상 offset 누적으로 정합 확인, 2026-07-06 교훈).

### 알려진 미구현 (dual-run FAIL 이 다음 fixture)

- flex: `flex-basis: content` intrinsic 자동측정, aspect-ratio, align-self, auto margin 흡수, nested BFC
- block: float/clear, writing-mode, BFC 내부 다단
- grid: subgrid, 명시 track 의 min/max-content intrinsic (→0 폴백), dense 역채움, baseline, `fit-content()`
- 참고: implicit auto row/column intrinsic 은 **tree.rs `solve_grid` 가 자식 선-solve 로 보완** (grid.rs 단독은 미측정)

### 테스트 자산

| 테스트                 | 위치                      | 성격                                                                                                                                                                                             |
| ---------------------- | ------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| lib unit               | `src/*.rs` `#[cfg(test)]` | 모듈별 명세 단위 (2026-07-06 기준 211)                                                                                                                                                           |
| `tests/golden.rs`      | 15 케이스                 | 세 완결 엔트리(`flex_layout`/`grid_layout`/`block_layout`) 를 **CSS 명세 계산값**으로 회귀 고정, TOL=1px                                                                                         |
| `tests/tree_golden.rs` | 6 케이스 (N1~N5 + N6)     | **Chrome 실측 독립 oracle** — Taffy 소멸 후 tree.rs 회귀를 감시하는 유일한 외부 권위. N1~N5 = 중첩/혼합 실전 형상 (Chrome `getBoundingClientRect` root-상대), N6 = box-sizing 손계산 (padding≠0) |

실행: `cargo test` (composition-engine 디렉토리, native). wasm.rs 는 게이트로 native 무영향.
**주의**: 소스 수정 후 되돌리면 mtime 때문에 cargo 가 stale binary 를 재사용할 수 있다 — 의심 시 `cargo clean -p composition-engine`.

---

## 6. WASM 로드/플래그

- `wasm-bindings/init.ts::initAllWasm()` — startup 에서 composition-engine WASM(+SpatialIndex) 과
  CanvasKit 을 병렬 로드. `createLayoutEngine()` 이 **동기** factory 라 전역 캐시
  (`compositionEngineWasm.ts`) 를 먼저 채워야 한다. 미준비 시 `CompositionEngineLayout.isAvailable()`
  의 lazy re-init + 부트스트랩(useCanvasRuntimeBootstrap) 15초 폴링이 보상 — 폴백 코드 없음.
- pkg 산출물: `wasm-bindings/composition-engine-pkg/` (wasm-pack `--target bundler`, out-dir 를
  apps/builder 내부로 지정 — dev 서버 root 밖 절대 URL fetch 실패 회피). 빌드: `pnpm wasm:build:engine`.
  pkg 는 gitignore (빌드 산출물).
- `featureFlags.ts` — `UNIFIED_ENGINE_FLAGS.USE_RUST_LAYOUT_ENGINE: true` (상수. key 제거 시
  `isUnifiedFlag` union 컴파일 에러라 유지), `UNIFIED_ENGINE: true` 가 `isUnifiedFlag()` 를 전역 true 로.
  `WASM_FLAGS.SPATIAL_INDEX: true`.

---

## 7. 디버깅 진입점

| 증상/신호                                                     | 보는 곳                                                                                                                                                         |
| ------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `[ADR-916] composition-engine WASM initialized` 로그 부재     | `compositionEngineWasm.ts:113` — WASM 로드 실패. init.ts 경로/flag 확인                                                                                         |
| `[fullTreeLayout] WASM failed:` 에러                          | fullTreeLayout.ts catch(:2856) — batch payload parse error 가능성 (숫자 dimension 미정규화 → §2 grid branch px 화 확인)                                         |
| `build_tree_batch: invalid type ... expected string/sequence` | grid track 미정규화(`coerceGridTrack`) 또는 `GRID_DIM_FIELDS` 누락                                                                                              |
| `Sanitized non-finite values` 경고                            | Step 5 sanitize — 상류 enrichment 의 NaN 전파 (TokenRef 미해석 등)                                                                                              |
| `[PersistentTaffyTree] buildFull: handles 길이 불일치`        | WASM 반환 handle ≠ batch 길이 — Rust 파싱 실패 후 부분 성공 여부 확인                                                                                           |
| 등록 직후 겹침/1줄 degrade, 새로고침 후 정상                  | Step 3 full rebuild 조건 누락 (정본 §PersistentTaffyTree 금지 패턴)                                                                                             |
| 편집이 캔버스에 미반영, 새로고침 후 반영                      | 계층 B(캐시 시그니처) 누락 — style 키면 **`LAYOUT_STYLE_KEYS`**, props 키면 `LAYOUT_PROP_KEYS` (§ 5-심볼 2계층 체인 실측 위치)                                  |
| 편집이 캔버스에 미반영, 새로고침 해도 그대로                  | 계층 A(layoutVersion 트리거) 누락 — props 키면 `LAYOUT_AFFECTING_PROP_KEYS` 미등재, style 키면 `NON_LAYOUT_PROPS_UPDATE` 에 잘못 등재                           |
| 특정 요소 layout 값 검사                                      | `getSharedLayoutMap()` / `onLayoutPublished()` (fullTreeLayout.ts:235/:188), persistent tree 의 `getLastJson(elementId)` 로 WASM 에 전달된 최종 style JSON 확인 |
| 페이지/Frame 간 layout 오염                                   | `persistentTrees` rootKey 분리(:144) — frame mirror id fallback 체인 확인                                                                                       |
| Rust 커널 회귀 의심                                           | `cargo test` → `tests/tree_golden.rs` (Chrome 실측 대조) — 좌표는 부모 content-box 상대 계약임을 전제                                                           |

레이어 판정 순서: **Skia 렌더 좌표 이상 → 먼저 layout map 값 확인** (`getSharedLayoutMap`) →
정상이면 렌더 경로 (canvas-rendering.md), 이상이면 batch style (`getLastJson`) → 상류 enrichment 순.

---

## 8. 역사적 맥락

| 시기          | 구성                                                                                                                                                                                                               | 근거                             |
| ------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | -------------------------------- |
| 2026-01~02    | display 별 이종 엔진 — DropflowBlockEngine(JS) + TaffyFlexEngine/TaffyGridEngine(Taffy WASM), per-level 호출 + @pixi/layout                                                                                        | ADR-005 이전                     |
| 2026-02~03    | Full-Tree 단일 WASM 호출 (DFS post-order batch) + PersistentTaffyTree 증분, Dropflow 제거 → Taffy 단일 엔진                                                                                                        | ADR-005 / ADR-009                |
| 2026-07-03~06 | 자체 Rust 엔진 `composition-engine` — flex/block/grid/tree self-impl → dual-run diff 0 → live 전환 → **Taffy 물리 삭제** (crate 2종 + pkg + JS 13파일, dual-run 하네스 동반 소멸, tree_golden 이 독립 oracle 승계) | ADR-916 (Implemented 2026-07-06) |

구 문서가 인용하던 `DropflowBlockEngine` / `NON_CONTAINER_TAGS` / `SPEC_RENDERS_ALL_TAGS` /
`UI_SELECT_CHILD_TAGS` / `LAYOUT_AFFECTING_PROPS` 는 현재 코드에 존재하지 않는다 (2026-07-07 grep 0건 — 단 **`LAYOUT_AFFECTING_PROP_KEYS`(`_KEYS` 접미)는 활성 심볼**이므로 혼동 금지. 위 §"layoutVersion 5-심볼 2계층 체인" 참조).
과거 결정 경위는 ADR-916 Status log 와 `docs/adr/design/916-unified-rust-engine-breakdown.md` 참조.
