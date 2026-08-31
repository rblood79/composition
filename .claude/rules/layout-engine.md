---
description: 레이아웃 엔진 관련 파일 작업 시 적용 — layoutVersion 5-심볼 체인 · 엔진↔TS 경계 · 배치 직렬화 계약. 엔진 CSS 정합 실측 전문은 skill reference 로 분리
paths:
  - "packages/composition-engine/**"
  - "apps/builder/src/builder/workspace/canvas/layout/**"
  - "apps/builder/src/builder/workspace/canvas/scene/layoutCache.ts"
  - "apps/builder/src/builder/stores/utils/layoutInvalidation.ts"
  - "apps/builder/src/builder/stores/utils/elementUpdate.ts"
  - "apps/builder/tests/parity/**"
---

# 레이아웃 엔진 규칙

> 구현 상세: [layout-details.md](../skills/composition-patterns/reference/layout-details.md) · 아키텍처/WASM 경계: [layout-engine.md](../skills/composition-patterns/reference/layout-engine.md) · **엔진 CSS 정합 실측 기록 23절 전문**: [layout-css-parity-ledger.md](../skills/composition-patterns/reference/layout-css-parity-ledger.md)

## layoutVersion 계약 (CRITICAL)

- `fullTreeLayoutMap` useMemo는 `layoutVersion` 카운터에 의존
- 레이아웃 영향 **모든 코드 경로**에서 `layoutVersion + 1` 필수

### 5-심볼 2계층 체인 (신규 layout prop / style 키 추가 시 점검)

두 계층은 **AND 조건**이다 — 계층 A 가 재계산을 트리거하고, 계층 B 가 그 재계산에서 캐시를 무효화한다. **한쪽만 등재하면 무반영**이다. 그리고 **props 축과 style 축은 배열이 서로 다르다** — 추가하려는 키가 `element.props.foo` 인지 `element.props.style.foo` 인지 먼저 판정할 것.

| 계층                        | 심볼                            | 위치                                    | 축    | 방식                                 |
| --------------------------- | ------------------------------- | --------------------------------------- | ----- | ------------------------------------ |
| **A. layoutVersion 트리거** | `LAYOUT_AFFECTING_PROP_KEYS`    | `stores/utils/layoutInvalidation.ts`    | props | **allowlist** (`has(key)`)           |
| A                           | `NON_LAYOUT_PROPS_UPDATE`       | `stores/utils/elementUpdate.ts`         | style | **blacklist** (`!set.has(k)`)        |
| A                           | `INHERITED_LAYOUT_PROPS_UPDATE` | `stores/utils/elementUpdate.ts`         | 상속  | allowlist (fontSize/lineHeight 류만) |
| **B. 페이지 캐시 시그니처** | **`LAYOUT_STYLE_KEYS`**         | `workspace/canvas/scene/layoutCache.ts` | style | allowlist                            |
| B                           | `LAYOUT_PROP_KEYS`              | `workspace/canvas/scene/layoutCache.ts` | props | allowlist                            |

- **계층 A 진입점 2개**: Inspector top-level props 편집은 `inspectorActions.ts` 가 `LAYOUT_AFFECTING_PROP_KEYS.has(key)` 로 판정(`"style"` 키 통째 포함) / style 필드 변경은 `isLayoutAffectingUpdate()` 가 `NON_LAYOUT_PROPS_UPDATE` **제외 방식**으로 판정. **layout 영향 style 키를 `NON_LAYOUT_PROPS_UPDATE` 에 넣지 말 것** (넣으면 layoutVersion 증가 skip).
- **계층 B 는 축이 갈린다**: `createElementLayoutSignature()` 가 `LAYOUT_STYLE_KEYS` → `style[key]`, `LAYOUT_PROP_KEYS` → `props[key]` 를 각각 읽어 시그니처를 만든다. **`LAYOUT_PROP_KEYS` 에는 `style.*` 키가 하나도 없다** (`children`/`text`/`size`/`iconName`/`isExpanded` 등 props 전용. `height`/`heightMode` 는 Table 의 **props**.height 이지 style.height 아님).
- **Why**: 계층 B 누락 → 캐시 히트로 변경 미반영(재계산은 돌지만 같은 시그니처라 이전 결과 재사용). 계층 A 누락 → 재계산 자체를 안 함. **실증**: `isExpanded`/`allowsMultipleExpanded` 가 `LAYOUT_AFFECTING_PROP_KEYS`(A) 와 `LAYOUT_PROP_KEYS`(B) **양쪽에 누락**되어 Disclosure collapse 가 Skia 에 무반영 (CHANGELOG 2026-05-09/07-14). **ADR-156 R6**: `justifySelf`/`justifyItems`/`gridAutoColumns`/`gridAutoRows`/`gridColumnStart`/`gridRowStart`/`overflowX`/`overflowY`/`order` 가 `LAYOUT_STYLE_KEYS`(B) 미등재 — 엔진을 고쳐도 해당 키만 바뀌는 편집은 캐시 히트로 흡수된다.
- **grep 함정**: `gridColumn`/`gridRow` shorthand 는 `LAYOUT_STYLE_KEYS` 에 있으나 `gridColumnStart`/`gridRowStart` 는 **없다** — 본 문서 §"Grid area 이름 해석" 이 factory 에 요구하는 **숫자 line 병기** 형태로 쓰면 캐시 키에 걸리지 않는다. `overflow` 는 등재됐으나 파이프라인은 `overflowX`/`overflowY` 를 송신한다.
- 심볼명 주의: **`LAYOUT_AFFECTING_PROPS`**(뒤에 `_KEYS` 없음)는 과거 심볼로 코드에 **0건**이다. 현행은 **`LAYOUT_AFFECTING_PROP_KEYS`** — 두 이름을 혼동해 "과거 심볼" 로 넘기지 말 것.

## 엔진 선택

- flex → TaffyFlexEngine, grid → TaffyGridEngine, block/undefined → TaffyBlockEngine (단일 자체 Rust WASM — `packages/composition-engine`, ADR-916 Implemented 2026-07-06; JS 어댑터 심볼명은 Taffy\* 유지)

## position:absolute / fixed — 엔진 소속 + 의도적 미지원 경계 (ADR-164 Phase 2, 2026-07-25)

- out-of-flow 배치는 **엔진 구현** (`tree.rs::place_absolute_children` + `resolve_abs_axis` — 양측 inset stretch / margin-auto 센터링 / 음수 inset·margin, 2026-07-14 `67ddfe899`). TS 에서 absolute 배치 보정 재도입 금지.
- **의도적 미지원 2건** (ADR-164 Phase 0 실측 — 실사용 0건 확인 후 종결, breakdown §7 0-3):
  - containing block **조상 체인** 탐색 (nearest positioned ancestor) — 직계 부모 고정. 재개 조건 = positioned ancestor 2단 이상 실사용 등장
  - `position:fixed` viewport 기준 — absolute 근사. TS 도 fixed→absolute 로 강제 변환해 송신 (`fullTreeLayout.ts` patch 경로). 렌더 층 sticky/fixed 좌표 보정 (`renderCommands.ts`) 은 별도 경로로 존속. 재개 조건 = 캔버스 viewport(=page frame) 기준 fixed 실사용 등장
- 재개 시 절차: 위 재개 조건 발생 → ADR-164 §4 조건부 규칙에 따라 해당 축만 엔진 구현 + fixture (새 ADR 불요)

## CONTAINER_TAGS

- children 렌더링 컴포넌트는 height: `'auto'` + `minHeight`. **Why**: 고정 height → children 겹침

## Parent-delegated props 상속

- Canvas 엔진은 CSS와 달리 명시적 전파 필요 → `effectiveGetChildElements` 래퍼 사용
- `enrichWithIntrinsicSize` 재귀 호출과 DFS `filteredChildren` 양쪽에 적용 필수
- Skia 경로도 동기화: buildSpecNodeData `resolveParentDelegatedSize`. **Why**: Store가 자식 size 미저장

## Label size delegation (CRITICAL)

- DFS 진입 시 조상 탐색으로 `fontSize`/`lineHeight` 인라인 주입
- 주입 조건: `labelStyle.lineHeight == null` 기준. **Why**: fontSize 조건 → factory 기본값과 충돌 → lineHeight 미주입 → 1.5배 fallback
- LABEL_SIZE_STYLE (fullTreeLayout.ts): xs~xl 매핑 단일 소스 (catalog `COMPONENT_RULES_TABLE.Label` 정합). lineHeight는 `"20px"` 문자열 필수 (숫자는 배율 해석)
- LABEL_DELEGATION_PARENT_TAGS: DatePicker/DateRangePicker 포함 필수. **Why**: 누락 → Label 24px 오계산
- batch height override: `Math.ceil(fontSize * 1.5)` 대신 LABEL_SIZE_STYLE lineHeight 역참조

## PersistentTaffyTree display/grid 전환 감지 (CRITICAL)

- display 변경 및 gridTemplateColumns 변경 → **full rebuild 필수**. **Why**: 엔진(composition-engine) 증분 갱신이 처리 불가
- `affectedNodeIds` 필터 시 `undefined` 조건 누락 금지. **Why**: 캐시 미스 시 undefined 전달 가능
- **신규 grid container (`prevJson` 없음) → full rebuild 필수**. **Why**: 엔진 WASM `addNode` 증분 추가로는 gridTemplateColumns/Areas 가 auto-placement 로 degrade — 등록 직후 한 줄 배치, 새로고침(buildFull) 후에만 정상 2행. `!prevJson && (curDisplay === "grid" || "inline-grid")` 에서 needsFullRebuild=true 강제
- **신규 컨테이너(자식 서브트리 보유) → full rebuild 필수** (grid 아니어도). **Why**: `addComplexElement`(부모+자식 트리 일괄 등록, 예 Select/ComboBox) 시 한 batch 에 부모+자식 다수 신규 노드가 들어오면 `addNode` 증분이 자식 layout 을 produce 못 함(layout=undefined) → 자식이 (0,0) 겹침 + 부모 height 가 자식 합산 미만으로 degrade(Select 등록 직후 34, 새로고침 full rebuild 후 54). `!prevJson && filteredChildIdsMap.get(id)?.length > 0` 에서 needsFullRebuild=true 강제 (grid 조건과 동일 게이트). ADR-912 R1 후속 (2026-06-12)
- **기존 grid container 의 layout-영향 20-key 변경 → full rebuild 필수**: gridTemplateColumns/Rows/Areas/AutoColumns/AutoRows/AutoFlow + padding/padding{Top,Right,Bottom,Left} + gap/rowGap/columnGap + **width/height/min{Width,Height}/max{Width,Height}**. **Why**: `updateStyleRaw`(=set_style) 는 grid track/placement 캐시 invalidation 실패 → padding 변경 시 1줄 degrade / gap 변경 미반영 / **width 변경 시 1fr·auto track 이 변경 전 컨테이너 폭 기준으로 stale degrade (1줄로 무너짐) → 새로고침(buildFull) 후에만 정상 2행**. 비-grid 는 증분 유지 (Flex/Block `updateStyleRaw` 정상 동작 — dimension 변경 시 full rebuild 는 `isGridDisplay(curDisplay)` 분기 안에서만). `GRID_REBUILD_TRIGGER_KEYS` (`fullTreeLayout.ts`) 비교 키는 `taffyStyleToRecord` 출력 = camelCase 단일 키 (`width`/`minWidth` 등). `fullTreeLayout.static.test.ts` 가 dimension 6키 누락을 정적 가드. 2026-06-16 추가

## gridTemplate 직렬화 경로 (CRITICAL)

- composition-engine WASM binary_protocol 은 `gridTemplateColumns`/`Rows`/`AutoColumns`/`AutoRows` 를 **track array** (`["1fr", "auto"]`) 로 기대. CSS 표준 string (`"1fr auto"`) 통과 시 `invalid type: string, expected a sequence` parse error → persistent tree 리셋 + 재빌드 루프. **3 직렬화 경로 모두 정규화 필수**:
  - `fullTreeLayout.taffyStyleToRecord` (flex via elementToTaffyStyle)
  - `fullTreeLayout.buildNodeStyle` grid branch (direct partial)
  - `fullTreeLayout.patchBatchStyleFromImplicit` (applyImplicitStyles post-patch)
- 정규화 헬퍼: `parseGridTemplate(template: string)` (`TaffyGridEngine.ts` export). 괄호 depth 기반 토큰화 → `repeat(auto-fill, minmax(...))` 복합 표현 정확 분해
- 이미 array 면 그대로 통과: `Array.isArray(val) ? val : parseGridTemplate(val)`

## Grid area 이름 해석 (CRITICAL)

- `buildNodeStyle` grid branch 는 **gridArea 이름 해석 미지원** (`parseGridAreaShorthand` + templateAreas 매칭 은 `TaffyGridEngine.elementToTaffyGridStyle` 에만 존재)
- 자식에 `gridArea: "label"` 같은 이름만 주입하면 엔진이 string 그대로 받아 auto-placement 로 degrade → 자식이 container 밖으로 흘러나감
- **Factory 패턴**: gridArea 이름과 **gridColumnStart/End + gridRowStart/End 숫자 line 병기**. CSS 경로는 spec `composition.staticSelectors` 의 `grid-area` 이름, Skia 경로는 숫자 line — 시각 대칭 유지 + 배치 정확성

## CSS shorthand ↔ longhand store 정책 (CRITICAL)

- `gap`/`padding`/`margin` shorthand 와 `rowGap`/`columnGap`/`paddingTop`/... longhand 가 element.props.style 에 **공존 시**:
  - React `setValueForStyles` rerender 경고 "Removing a style property during rerender"
  - `applyCommonTaffyStyle` 적용 순서 (`gap → rowGap/columnGap`) 로 longhand 가 shorthand override → Panel 편집 무시
- **정책**: store 는 항상 **longhand 만**. `inspectorActions.updateSelectedStyle` / `updateSelectedStylePreview` 가 shorthand 편집 입력을 longhand 로 분배 (gap → rowGap+columnGap, padding → padding{Top,Right,Bottom,Left}, margin → margin{Top,Right,Bottom,Left}). shorthand 자체는 `delete currentStyle[property]`
- Factory 초기값은 longhand 로 저장 (예: ProgressBar `rowGap: 4, columnGap: 12`). React inline style 은 항상 longhand 만 직렬화 → collision 완전 제거
- `useLayoutValues.gap` 표시는 `firstDefined(s.rowGap ?? s.columnGap ?? s.gap, numToPx(specPreset.gap), "0px")` — longhand 우선, legacy shorthand fallback

## 2-Pass re-enrichment (CRITICAL)

- Step 4.5에서 **`processedElementsMap` 우선 사용**. **Why**: store 원본은 DFS injection/implicit styles 없음 → 잘못된 height 계산
- merge 시 DFS injection 값을 base로 implicit styles merge (덮어쓰기 금지)

## Grid 트랙 폭 + 2-Pass 안전망

- DFS에서 grid 컨테이너 자식 width를 `(contentWidth - totalGap) / numCols`로 사전 조정
- Step 4.5: 실제 width vs enrichment width 비교 → 차이 시 re-enrich + dirty + recompute
- 2-pass에서 `buildFull()` 호출 금지 — `updateNodeStyle` + `markDirty` + `computeLayout`만 사용

## Layout Prop 변경 → Canvas 반영 (체크리스트)

**0단계 — 축 판정**: 추가하려는 키가 `element.props.foo`(props 축)인가 `element.props.style.foo`(style 축)인가? 축에 따라 봐야 할 배열이 다르다 (§"5-심볼 2계층 체인").

| #   | 항목                              | props 축                                                                | style 축                                                                                 |
| --- | --------------------------------- | ----------------------------------------------------------------------- | ---------------------------------------------------------------------------------------- |
| 1   | **계층 A — layoutVersion 트리거** | `LAYOUT_AFFECTING_PROP_KEYS` (`layoutInvalidation.ts`) 에 **추가 필수** | `NON_LAYOUT_PROPS_UPDATE` (`elementUpdate.ts`) 에 **추가 금지** (blacklist 제외 방식)    |
| 2   | **계층 B — 캐시 시그니처**        | `LAYOUT_PROP_KEYS` (`layoutCache.ts`) 에 **추가 필수**                  | **`LAYOUT_STYLE_KEYS`** (`layoutCache.ts`) 에 **추가 필수**                              |
| 3   | 상속 전파 (해당 시)               | —                                                                       | `INHERITED_LAYOUT_PROPS_UPDATE` (`elementUpdate.ts`, fontSize/lineHeight/textAlign 류만) |

4. `pageLayoutSignature` deps — elementById 포함
5. `patchBatchStyleFromImplicit` — 배열 타입 지원
6. display/grid 전환 감지 — full rebuild 조건 (§"PersistentTaffyTree display/grid 전환 감지")

**계층 A·B 는 AND** — 하나만 등재하면 무반영이며, 증상이 서로 다르다: A 누락 = 재계산 자체를 안 함 / B 누락 = 재계산은 돌지만 시그니처 동일 → 캐시 히트로 이전 결과 재사용. 새로고침 후에만 반영되면 B 를 의심할 것.

## 엔진 CSS 정합 규칙 색인 (2026-07-25 ~ 07-28 실측 — 전문은 reference)

엔진(`packages/composition-engine/**`)·`fullTreeLayout.ts` 의 배치 알고리즘을 바꾸기 전에 [layout-css-parity-ledger.md](../skills/composition-patterns/reference/layout-css-parity-ledger.md) 의 해당 절 — 규칙 · 거처 · Chrome 실측 표 · fixture 민감도 · **금지 패턴** — 을 읽는다. 아래는 절당 한 줄, 규칙과 fixture 만이다.

| §   | 규칙 (한 줄)                                                                                                                                        | 거처                                                    | Chrome 실측 fixture                                     |
| --- | --------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------- | ------------------------------------------------------- |
| 1   | 컨테이너 used size 는 min/max clamp **뒤** 값 — flex main·cross / grid block / 인라인 네 축 모두 clamp 값으로 재분배. aspect-ratio 는 clamp 뒤 파생 + content 하한 | `solve_flex` 3.6/3.7 · `solve_grid` 재진입 · `solve_node` | bodyViewportBox · basicAxisContainerSize                |
| 2   | body 는 뷰포트가 아니다 — 주입은 `width=pageW` + `min-height=pageH` 하나, 보고 높이는 뷰포트 상자(Step 5), 프레임 슬롯 블록 축 주입 제거           | `fullTreeLayout` Step 1.5/5 · `resolvePageSlotStyle`    | bodyViewportBox · pageSlotStyle                         |
| 3   | 늘어날 available 이 없으면 기여는 **content** — `INDEFINITE_AVAIL` 에서 auto 폭은 fit-content, `width:%` 텍스트 leaf 도 스칼라 공급                   | `solve_block` · `enrichWithIntrinsicSize`               | containerAlign                                          |
| 4   | shrink-to-fit 은 크기 확정 **뒤** 한 번 더 — 컨테이너 상자는 1차 값 유지, grid 는 원본 토큰 재계산(암묵 열만 freeze), `inline_intrinsic` definite 게이트 | `shrink_to_fit_settled` + 세 `solve_*` 말미             | shrinkToFitInline                                       |
| 5   | automatic minimum size §4.5 는 엔진 소속 — 구 Step 5.7 제거·재도입 금지, 텍스트 leaf 는 스칼라 2종(`contentMinWidth`/`contentMaxWidth`) 계약        | `flex.rs::parse_item` · `resolve_leaf_intrinsic_width`  | autoMin · intrinsicSizing                               |
| 6   | 컨테이너 intrinsic 은 측정 모드 센티넬 `-2`/`-3` 재실행 — 캐시 키는 `mutation_gen`(dirty 아님), grid 축 포함, `is_row` 밖 확장 금지                  | `measure_intrinsic_width`                               | containerIntrinsic                                      |
| 7   | 증분 skip 키는 dirty **와** `last_avail` 둘, 반환은 `last_solved` — 재부모화 stale / padded auto 컨테이너 `2×(pad+border)` 누적 성장                 | `TreeNode::last_avail/last_solved`                      | tree.rs `reparent_*` · `incremental_skip_*`             |
| 8   | 컨테이너 `width: min/max/fit-content` 는 엔진이 측정으로 해소(clamp 앞) — TS 선해석 제거(합성 leaf 만 예외), grid 제외                              | `solve_node` + `width_intrinsic_keyword`                | basicAxisContainerSize                                  |
| 9   | 그리드 자신의 min/max-content — `inline_intrinsic` 한 곳에서 트랙을 자식 기여로 px 확정, `%`=`auto`, min-content 모드에서 `fr` 안 폄, 폭은 트랙 extent | `solve_grid::inline_intrinsic`                          | gridContainerIntrinsic                                  |
| 10  | 그리드 블록 크기 = **행 트랙 extent**(셀 bbox 아님) — 암묵 행은 `grid-auto-rows`, 매핑은 `resolve_child_cells`, 반환은 content-box                   | `solve_grid` · `grid::resolve_child_cells`              | gridContainerBlockSize                                  |
| 11  | 교차축 라인 cross 는 컨테이너 cross **대입**(`max` 아님)                                                                                            | `flex.rs::flex_layout`                                  | flexSweep(음수 여유 축)                                 |
| 12  | 넘칠 때의 정렬 — 위치 정렬은 음수 offset(`*_raw`), 분배 정렬은 `.max(0)` 유지; 미결정 main 센티넬 가드 4곳; grid `align-content` 는 `explicit_h>0` 판정 | `place_line_*_axis` · `solve_grid`                      | crossAxisOverflow · gridAlignContent                    |
| 13  | 백분율 — 인라인 축은 상속 available 로 확정, 블록 축은 `explicit_h>0` 만; `%` ctx 와 자식 재귀 available **두 게이트** 모두                          | `solve_flex`/`solve_block` ctx + `child_containing_h`   | percentSize                                             |
| 14  | flex item 재-solve 는 **자기가 푼 available** 기준 — fallback=content, override 는 auto 아닌 모든 main, `cross_definite`=`cross_definite_self`         | `solve_flex` 3.5                                        | basicAxisContainerSize                                  |
| 15  | `margin:auto` 는 커널이 **라인 단위**로 흡수 — `margin_auto_mask` off 20, stretch·align-self 억제 동반, tree.rs 후처리 재도입 금지                   | `flex.rs::place_line_*` · `write_flex_item`             | autoMargin                                              |
| 16  | `*-reverse` 는 위치만 반사 — 반전 축의 물리 margin 쌍 **+ auto 마스크**를 `MarginAxisReverse` 로 스왑해 커널에 정방향 전달                           | `tree.rs::write_flex_item`                              | reverseMargin                                           |
| 17  | 그리드 영역은 containing block — `place_grid_axis` 단일 함수, 명시 크기·margin·min/max 존중, 넘침은 자르지 않음                                     | `place_grid_axis`                                       | gridItemBox                                             |
| 18  | `auto` 트랙 §12.8 stretch — 측정 후 `*_auto_idx` 인덱스로 판정, `normal`/`stretch` 게이트, definite 는 `explicit_*`(가로는 `inline_intrinsic.is_none()` 포함) | `tree.rs::stretch_auto_tracks`                          | gridAutoTrackStretch                                    |
| 19  | `minmax()` §12.6 는 상한까지 — 게이트 없음, 균등+freeze+재분배, `fr` 여유는 성장분 뺀 `container - Σsize`                                            | `grid.rs::maximize_tracks`                              | gridMinmaxTracks                                        |
| 20  | 트랙 크기는 자식 **content 기여** §12.5 — min·max 두 값, §6.6 clamp 는 아이템 단위(선호 크기 auto 일 때만), `minmax` 안 `%` 는 파싱 시 해소            | `tree.rs::resolve_track_with_contribution`              | gridTrackContribution                                   |
| 21  | 단독 `fr` = `minmax(auto, fr)` — §12.7.1 freeze-restart, 기여는 margin-box(`%` margin 은 0)                                                          | `split_track_sizing` · `col_contribution`               | basicAxisContainerSize/ChildSize                        |
| 22  | grid 자식 TS 공급 3결함 — 스칼라 게이트 `isGridChild`(`isFlexChild` 확장 금지) / 트랙 수 `coerceGridTrack` / Step 4.5 가정 폭 `enrichAvailWidth`      | `utils.ts` · `fullTreeLayout.ts`                        | gridTrackContribution pipeline                          |
| 23  | grid item 의 크기 키워드도 stretch 를 이김 — `explicit` 판정에 `size_is_intrinsic_keyword` OR                                                       | `place_grid_axis`                                       | gridTrackContribution I                                 |

## 배치 직렬화 계약 — 숫자 하나가 페이지 레이아웃을 끈다 (CRITICAL)

엔진 `NodeStyle` 의 길이 필드는 전부 `Option<String>` 이라 숫자가 들어오면 `build_tree_batch` 가 **배치 전체**를 거부한다 (`invalid type: integer, expected a string`) → `calculateFullTreeLayout` 이 `null` → **그 페이지 레이아웃이 통째로 사라진다**. 요소 하나의 값 하나가 페이지 전체를 끄는 구조다.

- 정규화 진입점은 `taffyStyleToRecord` 내부 `dim()` 하나가 아니다. **`dim()` 을 우회하거나 그 뒤에 값을 덧쓰는 경로**는 `normalizeDimFields`(`fullTreeLayout.ts`)를 직접 불러야 한다:
  - grid branch — `applyCommonTaffyStyle` 결과를 partial 로 직접 반환 (dim 미경유)
  - block branch 의 flex item 주입 — `taffyStyleToRecord` **뒤에** `applyFlexItemProperties` 가 덧쓴다
- `parseCSSPropWithContext` 는 **절대 길이를 숫자로** 돌려준다 (`"0px"` → `0`). 백분율·`auto` 는 문자열로 남으므로 **절대 길이만** 터진다 — 그래서 증상이 드물고 늦게 발견된다.
- 타입별 계약: 길이 = 문자열 / `flexGrow`·`flexShrink`·`aspectRatio`·측정 스칼라 = 숫자(f32) / grid track = 배열. `order` 는 `NodeStyle` 미선언이라 무시된다(파이프라인이 TS 에서 자식을 재정렬해 보정 — 엔진 직접 호출자는 `order` 를 못 얻는다).
- **전례 2건**: `rowGap: 4` + `display:grid`(2026-07-06, ProgressBar/Meter/Slider) · `flexBasis:"0px"` block 자식(2026-07-27). 같은 병인인데 처방이 한쪽 branch 에만 있었다.
- 감시: `flexItemDimContract.browser.test.ts` (정규화를 빼면 pipeline leg 가 좌표 비교 전에 throw).

### 금지 패턴

- ❌ `taffyStyleToRecord` 뒤에 style 을 덧쓰고 정규화 생략 → 절대 길이에서 배치 파싱 실패
- ❌ 새 dim 성 필드를 `DIM_FIELDS` 미등재로 추가 → 같은 크래시가 새 축으로 재발
- ❌ 엔진에 길이를 숫자로 전달 (`flexBasis: 0`) — 숫자→문자열 변환은 **파이프라인 책임**

## 기본 축은 격자가 잠갔다 — 그 격자가 **못 여는 축** (ADR-170, 2026-07-28)

`basicAxis{ContainerSize,ChildSize,Nesting}.browser.test.ts` 가 display × width × height × min/max × leaf 종류 × 부모 컨텍스트를 **직교**로 훑는다 — 2,702 조합, 도입 시점 727 발산이 wave 1~7 로 **0**. 기본 축의 "미지 규모" 는 여기서 닫혔고, 반응형 발견 사이클은 이 축에 한해 종료다.

닫힌 것은 **열거한 축뿐**이다. 아래는 격자가 못 여는 축이고, 여기서 나온 발산에 격자 green 을 반증으로 들이대면 안 된다:

| 사각                                                 | 담당 / 사유                                                                                                               |
| ---------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------- |
| 텍스트 실측정 sub-pixel                              | 격자는 스칼라 leaf 로 대체 — CanvasKit↔DOM 폰트 차이는 렌더 층 교정 경로. `intrinsicSizing` pipeline leg 이 실텍스트 담당 |
| `position:absolute` 조상 체인 / `fixed`              | 기본형은 `phase4_5` E11. ADR-164 Phase 0 의 **의도적 미지원 2건** 만 사각 — 재개 조건 기정의 (§position:absolute)         |
| overflow / scroll 상호작용                           | 렌더·히트 축 (canvas-rendering.md §8) — 레이아웃 격자 대상 아님                                                           |
| flex wrap 다중 라인                                  | `flexSweep` (WRAPS × LINE_COUNTS) — 격자는 nowrap 고정                                                                    |
| 정렬 속성 (`justify-*`/`align-*`)                    | `flexSweep` + `crossAxisOverflow` + `gridAlignContent` — 격자는 부모 컨텍스트 신호로만 사용                               |
| 중첩 2단 이상                                        | 격자 3 은 1단 전파만 — 조합 폭발. 1단 정합이면 귀납 가정                                                                  |
| `writing-mode` / `direction` / `float` / inline flow | 엔진 미지원 표면 (`NodeStyle` 부재)                                                                                       |
| grid `auto-flow: column` 의 행 extent                | 기존 명시 잔존 (`shrinkToFitInline` `[잔존]`) — 격자는 row-flow 고정                                                      |
| `gap` / `padding` / `border` 조합                    | 기본 축 밖 — 격자는 0 리셋 고정 (`gridTrackContribution`/`gridMinmaxTracks` 가 부분 커버)                                 |
| 내용 leaf 의 `height:auto`                           | **오라클 쪽 사각** — engine leg 에 높이 스칼라 채널이 없다 (아래)                                                         |

- **격자 green ≠ 종결** 의 실증: `flexSweep` 1152 조합은 컨테이너 main 을 항상 확정으로 줘서 미결정 main 센티넬 결함을 **전부 green 으로 통과**시켰다 — 유일 감시자가 `crossAxisOverflow` 의 `INDEFINITE_MAIN_CASES` 였다.
- **사각은 오라클 쪽에도 생긴다**: ADR-165 스칼라 계약이 폭만이라 engine leg 은 내용을 가진 leaf 의 `height:auto` 를 잴 수 없다(DOM 은 원자 높이, 엔진은 0). 격자 2 초안 발산 165건 중 **135건이 이 산출물**이었고, 확정 폭 대조군이 없었으면 엔진 결함으로 **잘못 귀속**될 뻔했다. 높이 축 정합은 `pipelineLeg` 담당이다.
- 신규 발산을 만나면 이 표부터 본다 — 표 안이면 담당 fixture 로, 표 밖이면 격자 축에 편입한다.

## TS 잔존 계약 (ADR-164 Phase 3 — 엔진↔TS 경계 규칙, CRITICAL)

다음은 **의도적으로 TS 에 남는** 것들이다. 엔진 gap 처럼 보여도 아래 사유가 유효한 한 엔진 이관·중복 구현 양쪽 모두 금지 — 변경은 해당 사유를 뒤집는 ADR 로만:

| 잔존                                                                          | 사유                                                                                                                                                                                                                                                                                                 |
| ----------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 측정 스칼라 공급 (`contentMinWidth`/`contentMaxWidth` — **텍스트 leaf 한정**) | CanvasKit/Canvas 2D = 측정 oracle ("Layout = Canvas 2D = CSS 정합"). 엔진 자체 텍스트 측정 도입 금지. **경계 = 폰트 측정은 TS / 구조 집계는 엔진** (ADR-169) — 컨테이너 intrinsic 은 자식 값의 집계·재실행이라 TS 가 공급하면 레이아웃 재구현이 된다. TS 에서 컨테이너 intrinsic 을 계산해 주입 금지 |
| 비텍스트 leaf 폭·height 주입 (INLINE_BLOCK/CIRCLE/IMAGE/SPEC_SHAPES_INPUT)    | display 의미론 에뮬레이션 + 합성 leaf content — 스칼라 채널 확대는 후속 판정 (구 텍스트 leaf width/minWidth 주입은 ADR-165 로 스칼라 계약에 흡수 — 재도입 금지)                                                                                                                                      |
| `implicitStyles.ts` 컴포넌트별 주입 (indicator/collection font 등)            | catalog/spec 의미론 (D3 SSOT 파생) — CSS 표준 의미론 아님. CSS base width 채널 (B22 100% / label fit-content) 포함                                                                                                                                                                                   |
| Step 4.5 — **height-for-width 1회 재측정** (축소 계약, ADR-165 Phase 2)       | 폭 확정 후 높이 재줄바꿈 재측정만 담당 — 폭 재보정 확장 재도입 금지 (폭 축은 엔진 소유). measure callback 이관은 별도 ADR (재개 조건: 2-pass 비용의 프레임 예산 압박)                                                                                                                                |
| f32 `Math.ceil` 보정                                                          | 엔진 f32 ↔ JS f64 정밀도 경계 — 흡수 대상 아님 (스칼라 2종도 ceil 대상)                                                                                                                                                                                                                              |
| layoutCache 시그니처/무효화 (5-심볼 2계층)                                    | store 결합 — 마샬링 비용 > 계산 비용. 측정 스칼라는 store 키가 아닌 enrichment 파생값 — 체인 등재 불요 (`children`/`text`/`fontSize` 가 이미 등재)                                                                                                                                                   |

역방향(재침식)도 같은 강도로 금지: **CSS 표준 의미론의 새 gap 을 발견하면 TS 보정이 아니라 엔진 구현이 기본 경로** (ADR-164 Decision — Step 5.7 형 coarse 근사 재생산 금지).

**2026-07-28 제거 (ADR-170)**: 컨테이너의 **intrinsic 키워드** 선해석은 잔존 목록에서 빠졌다 — 엔진이 측정으로 정확값을 소유한다 (§컨테이너의 `width: min/max/fit-content`). 자식 없는 합성 leaf 주입과 컨테이너의 **numeric** 폭 선해석은 잔존.

## Container style pipeline 연계 (ADR-907 Implemented)

collection/self-render 컨테이너의 `calculateContentHeight()` 분기는 **Layer D Spec metric SSOT** 원칙에 따라 `render.shapes()` 와 **동일 resolver 심볼**을 호출해야 한다. 상세 계약은 [canvas-rendering.md §2.6](canvas-rendering.md) 참조.

- **GridList**: `resolveGridListSpacingMetric()` (packages/specs/src/renderers/utils/collectionItemMetrics.ts) 를 utils.ts GridList 분기에서 import 하여 Skia shape 경로와 공유. 기존 `parseNumericValue(style.gap) ?? 12` ad-hoc 파싱 금지
- **paddingY \* 2 패턴 금지**: 4-way padding 수용 → `paddingTop + paddingBottom` (ADR-907 Wave B)
- **신규 자체 분기 추가 시**: (1) spec 에 `resolve{Component}SpacingMetric` 또는 `resolveContainerSpacing` 직접 호출 / (2) utils.ts 분기가 같은 resolver import / (3) `{Component}.spacing.test.ts` 에 Layer D contract 검증 추가

## 기타 규칙

- calculateContentHeight: content-box만 반환 (padding 제외)
- Block-child normalization: 이미 numeric/px 폭 있으면 100% 주입 스킵
- 엔진 f32 보정: enrichWithIntrinsicSize에서 `Math.ceil` 적용. **Why**: f32/f64 정밀도 차이 → 불필요한 wrap
- Checkbox/Radio DFS: 부모 탐색으로 size 주입 (implicitStyles indicator 계산용)
- Collection Item font: CSS + implicitStyles(`injectCollectionItemFontStyles`) + Skia catalog rule 3경로 동기화
- 요소 순서: canonical `children[]` 배열 순서가 order SSOT (ADR-118) — `order_num` 은 export mirror 로만 파생 (legacy `batchUpdateElementOrders()` 심볼 소멸)

## 금지 패턴

- **style 키를 `LAYOUT_PROP_KEYS` 에 추가 금지** → `LAYOUT_STYLE_KEYS` 가 style 축이다 (`LAYOUT_PROP_KEYS` 는 `props[key]` 만 읽으므로 `style.foo` 를 넣어도 항상 `undefined` = 시그니처 불변 = 무반영)
- **계층 A(layoutVersion 트리거) 단독 등재 금지** → 계층 B(캐시 시그니처) 동반 필수. 역도 같음 (§"5-심볼 2계층 체인")
- 텍스트 leaf 에 width/minWidth 주입 재도입 금지 → 측정 스칼라 계약 (`contentMinWidth`/`contentMaxWidth`) 이 대체 (ADR-165 — 재도입 시 스칼라와 이중 적용). 비텍스트 leaf (INLINE_BLOCK/CIRCLE) 의 width 주입 시 minWidth 동시 주입은 잔존 계약 유지
- 자식 보유 컨테이너의 intrinsic 키워드(`min/max/fit-content`) 를 TS 에서 선해석해 주입 금지 → 엔진 소유 (ADR-170 — `measure_intrinsic_width` + `solve_node` 키워드 해소). 자식 없는 합성 leaf 만 예외
- used size clamp 를 부모 intake 에만 걸기 금지 → 인라인 축도 `solve_node` 가 dispatch 전에 clamp (ADR-170 — 상자만 clamp 되고 자식은 clamp 이전 폭으로 배치됨)
- Step 4.5 를 폭 재보정 용도로 확장 금지 → height-for-width 1회 재측정 계약 (ADR-165 Phase 2 — 폭 축은 엔진 소유)
- overflow 기준 flexShrink 주입 보정 (구 Step 5.7) 재도입 금지 → automatic minimum size 는 엔진 소속 (`flex.rs` §4.5, ADR-164 + ADR-165 정확 min-content)
- DFS 조건에 `fontSize == null` 사용 금지 → `lineHeight == null` 필수
- Label height에 `Math.ceil(fontSize * 1.5)` 금지 → LABEL_SIZE_STYLE 역참조
- Label lineHeight를 숫자로 전달 금지 → `"20px"` 문자열 필수
- 2-pass에서 `buildFull(batch)` 호출 금지 → updateNodeStyle + markDirty + computeLayout
- Step 4.5에서 processedElementsMap 대신 elementsMap 직접 사용 금지
- CONTAINER_TAGS에 고정 height 사용 금지
- 신규 grid container 를 incrementalUpdate 의 `addNode` 로만 추가 금지 → 등록 직후 배치 degrade. `!prevJson && curDisplay==="grid"` 분기에서 needsFullRebuild=true 강제
- 신규 컨테이너(자식 서브트리 보유)를 `addNode` 증분으로만 추가 금지 → 자식 layout undefined + 겹침. `!prevJson && filteredChildIdsMap.get(id)?.length > 0` 분기에서 needsFullRebuild=true 강제 (grid 아니어도)
- 기존 grid container 의 padding/gap/gridTemplate/**width/height/min·max** 변경을 `updateStyleRaw` 만으로 반영 시도 금지 → 20-key 변경 감지 후 full rebuild (dimension 키 누락 시 grid track stale degrade — 새로고침 후에만 정상)
- `gridTemplateColumns: "1fr auto"` string 을 WASM 에 그대로 전달 금지 → `parseGridTemplate` 로 track array 정규화 (3 직렬화 경로 전부)
- `buildNodeStyle` grid branch 에서 자식 gridArea 이름만 주입 금지 → gridColumnStart/End + gridRowStart/End 숫자 line 병기 필수
- element.props.style 에 shorthand (`gap`/`padding`/`margin`) + longhand 동시 저장 금지 → `inspectorActions` 에서 shorthand → longhand 분배, store 는 longhand only
- `firstDefined(inline, specPx, fallback)` 에 4+ 인자 전달 금지 → 3-arg 고정 시그니처. 우선순위 체인은 nullish coalescing (`??`) 으로 inline 자리에 압축
- Select/ComboBox 높이에 `Math.ceil(fontSize * 1.5)` 금지 → parseLineHeight 우선

## paths 관리

- `paths` 는 2026-08-31 협소화 — 구 `**/layout/**` 가 `builder/layout`(패널)·`styles/layout` 까지 매칭해 패널 작업에 본 규칙 전량(116KB)이 주입됐다. 새 레이아웃 파이프라인 경로가 생기면 여기 등재.
