---
description: 레이아웃 엔진 관련 파일 작업 시 적용
globs:
  - "packages/composition-engine/**"
  - "**/layout/**"
  - "**/engines/**"
  - "**/LayoutContainer*"
---

# 레이아웃 엔진 규칙

> 구현 상세는 [layout-details.md](../skills/composition-patterns/reference/layout-details.md) 참조

## 엔진 선택

- flex → TaffyFlexEngine, grid → TaffyGridEngine, block/undefined → TaffyBlockEngine (단일 자체 Rust WASM — `packages/composition-engine`, ADR-916 Implemented 2026-07-06; JS 어댑터 심볼명은 Taffy\* 유지)

## position:absolute / fixed — 엔진 소속 + 의도적 미지원 경계 (ADR-164 Phase 2, 2026-07-25)

- out-of-flow 배치는 **엔진 구현** (`tree.rs::place_absolute_children` + `resolve_abs_axis` — 양측 inset stretch / margin-auto 센터링 / 음수 inset·margin, 2026-07-14 `67ddfe899`). TS 에서 absolute 배치 보정 재도입 금지.
- **의도적 미지원 2건** (ADR-164 Phase 0 실측 — 실사용 0건 확인 후 종결, breakdown §7 0-3):
  - containing block **조상 체인** 탐색 (nearest positioned ancestor) — 직계 부모 고정. 재개 조건 = positioned ancestor 2단 이상 실사용 등장
  - `position:fixed` viewport 기준 — absolute 근사. TS 도 fixed→absolute 로 강제 변환해 송신 (`fullTreeLayout.ts` patch 경로). 렌더 층 sticky/fixed 좌표 보정 (`renderCommands.ts`) 은 별도 경로로 존속. 재개 조건 = 캔버스 viewport(=page frame) 기준 fixed 실사용 등장
- 재개 시 절차: 위 재개 조건 발생 → ADR-164 §4 조건부 규칙에 따라 해당 축만 엔진 구현 + fixture (새 ADR 불요)

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

## automatic minimum size (CSS-FLEXBOX-1 §4.5) — 엔진 소속 (ADR-164 Phase 1 / ADR-165 정밀화, 2026-07-25)

flex item 의 automatic minimum size (min-width/height:auto = content 하한) 는 **엔진 구현** (`flex.rs::parse_item` effective min 해석): 조건 `명시 min 부재 ∧ item 주축 overflow visible ∧ 주축 크기 auto` → floor = **정확 min-content** (`content_min_main`, off 19 — 공급 시) 또는 `content_main` (absent fallback — 단일줄 상한 근사), max clamp 동반. 프로토콜: off 18 = 주축 overflow (0=visible zero-init / 1=clipped), off 19 = `content_min_main` (0=absent zero-init) — `tree.rs::write_flex_item` 이 기록, `FLEX_FIELD_COUNT=20`.

- 구 **Step 5.7** (부모 overflow≠visible 기준 flexShrink:0 전면 주입, `fullTreeLayout.ts`) 은 **제거됨** — coarse 근사가 min-content 이상의 정당한 shrink 까지 막아 CSS 와 발산했다. TS 에서 overflow 기준 flexShrink 주입 보정 재도입 금지 (해당 위치 tombstone 주석 참조).
- **floor 공급 주체는 두 갈래 (ADR-169)**: 텍스트 leaf 는 TS 스칼라(`content_min_width`), **컨테이너 item 은 엔진의 측정 모드 재실행**(`measure_intrinsic_width` → off 19)이다. absent fallback(`content_main` = 상한 근사)이 남는 경우는 두 채널 모두 비었을 때뿐 — grid 서브트리(§컨테이너 intrinsic)와 leaf 아닌 비측정 형태가 여기에 해당한다.
- **측정 스칼라 계약 (ADR-165 — 구 minWidth 채널 흡수)**: 텍스트 leaf 의 intrinsic 은 `enrichWithIntrinsicSize` 가 `contentMinWidth`(최장 단어 폭)/`contentMaxWidth`(단일줄 폭) 스칼라 2종 (content-box, `Math.ceil`) 을 NodeStyle 로 공급하고, 엔진이 CSS-SIZING-3 §5 공식을 소유한다 — `tree.rs::resolve_leaf_intrinsic_width` (auto→max-content 제안 / fit-content→clamp(min-content, stretch-fit, max-content) / min·max-content 키워드) + §4.5 floor 의 정확 min-content. **Why**: 엔진은 텍스트 측정 부재로 leaf content 를 모른다 (CanvasKit/Canvas 2D = 측정 oracle 불변 — 측정 주체는 TS, 소비 알고리즘만 엔진). 구 width(단일줄 ceil)+minWidth(상한 근사) 주입 채널은 텍스트 leaf 에서 제거됨 — 재도입 금지 (스칼라와 이중 적용). INLINE_BLOCK/CIRCLE/IMAGE 합성 leaf 주입과 컨테이너 numeric 선해석은 잔존.
- **CSS base width 채널**: 텍스트 leaf 의 폭 주입 제거로 generated CSS base 규칙은 별도 채널이 담당 — `width:100%` 계열(text/heading/paragraph/description)은 B22, `width:fit-content`(label)는 ADR-165 신설 선주입 (`implicitStyles.ts` — catalog Label 은 containerStyles 부재라 CSS 실측 근거 직접 주입). 신규 텍스트 leaf 계열 추가 시 CSS base width 규칙의 엔진 채널 존재를 확인할 것.
- Chrome 실측 fixture: `apps/builder/tests/parity/autoMin.browser.test.ts` (8케이스) + `intrinsicSizing.browser.test.ts` (engine 6 — DOM 원자/스칼라 격리 + pipeline 4 — 실텍스트 end-to-end) — floor/스칼라 동작 변경 시 여기부터 갱신

## 컨테이너 intrinsic — 측정 모드 센티넬 + grid 이연 (ADR-169, 2026-07-27)

컨테이너 flex item 의 intrinsic 은 **엔진이 자기 알고리즘을 측정 모드로 재실행**해 얻는다 (Taffy `AvailableSpace::{MinContent,MaxContent}` / Yoga `MeasureMode` / Blink `ComputeMinMaxSizes` 와 같은 형태). `INDEFINITE_AVAIL(-1)` 옆에 `MIN_CONTENT_AVAIL(-2)` / `MAX_CONTENT_AVAIL(-3)` 센티넬을 두어 `solve_node` 시그니처는 그대로다.

- **소비 지점**: `solve_flex` 의 `is_row` 분기가 **auto-main + 자식 보유 + 스칼라 미공급** item 에 대해 `measure_intrinsic_width` 를 호출해 off 13(`content_main` = max-content)과 off 19(`content_min_main` = 정확 min-content)를 **함께** 채운다. 한쪽만 채우면 긴 텍스트 초과가 악화된다 (ADR-169 G3).
- **캐시**: 노드당 `(mutation_gen, min, max)`. 무효화 기준은 `dirty` 가 아니라 **트리 단위 세대 카운터**다 — `propagate_dirty` 는 이미 dirty 인 조상에서 조기 종료하므로 "dirty ⟹ 캐시 없음" 이 성립하지 않는다. 측정 전후로 서브트리 `layout`/`dirty` 를 스냅샷·복구해 부작용 0 을 유지한다.
- **grid 는 이연** — `measure_intrinsic_width` 가 grid 서브트리(자기 또는 자손)에 `None` 을 돌려 **측정 자체를 하지 않는다**. `grid.rs::resolve_grid_tracks` 2단계가 `remaining = (container - fixed - gap).max(0.0)` 이라 음수 available 에서 `fr_size = 0` → fr·auto 트랙이 전부 0 이 되고, 그 0 을 `content_main` 으로 소비하면 grid item 이 **통째로 붕괴**한다 (실측: 직접·중첩 형태 모두 1920 → 0). 이연 상태의 잔존 발산은 `containerIntrinsic.browser.test.ts` I/J 스냅샷 (DOM 400 / engine 1920).
  - **재개 조건**: grid 축 intrinsic 을 열려면 CSS-GRID-1 §12 track sizing 의 min/max-content 기여 산출이 먼저다 (fr 트랙의 §12.7.1 포함). 그 전에 `subtree_has_grid` 가드만 풀면 붕괴가 되살아난다 — 가드 제거는 `grid_flex_item_does_not_collapse` (Rust) + I/J 스냅샷이 동시에 green 인 상태에서만.
- **height 축(column main)은 결함 부재** — 빈도가 아니라 **구조상**이다. 인라인 방향은 블록 박스의 초기 동작이 stretch 라 auto 폭 자식이 available 을 채우지만, 블록 방향은 `height:auto` 가 내용 크기다. "늘어나기만 하는 내용을 고유 크기로 오인" 하는 형태가 세로에서는 성립하지 않는다 (K 케이스 실측 — 컨테이너·형제 정합). K 에 남는 `height:100%` 발산은 flex 분배 후 백분율 재해소 부재로, 별개 영역이다.

### 금지 패턴

- ❌ `measure_intrinsic_width` 의 `None` 을 `0` 이나 `unwrap_or_default()` 로 흡수 — grid item 붕괴가 그대로 재발한다 (측정 불가를 값으로 위장 금지)
- ❌ 캐시 무효화를 `dirty` 플래그에 종속 → `propagate_dirty` 조기 종료로 구멍이 생긴다 (`mutation_gen` 비교가 정본)
- ❌ 측정 후 `mark_subtree_dirty` 로 복구 갈음 → 자손 캐시까지 날아가 중첩 깊이에 지수적
- ❌ 측정 배선을 `is_row` 밖으로 확장 → 세로 축은 결함 부재이며, 확장 시 height-for-width 2-pass 계약(ADR-165)과 충돌

## 교차축 라인 cross 는 컨테이너 cross **대입** (CSS-FLEXBOX §9.4 step 8, 2026-07-27)

single-line(`flex-wrap:nowrap`) + definite cross 컨테이너에서 flex 라인의 outer cross size 는 컨테이너의 inner cross size **그 자체**다 — "**is** the flex container's inner cross size". `flex.rs::flex_layout` 의 라인 승격은 `max` 가 아니라 대입이어야 한다.

- `max` 로 라인을 아이템에 맞춰 키우면 `align-items:stretch` 가 그 커진 라인을 채워 **auto-cross 아이템이 내용까지 자란다**. CSS 는 컨테이너에서 자르고 내용이 라인 밖으로 흘러넘친다. 실측: 확정 높이 100 밴드 + `height:auto` 자식 + 내용 300 → DOM 100 / 구 엔진 300 (row·column 동형, 파이프라인까지 전파).
- `align-items:flex-start` 는 아이템이 자기 크기를 유지하므로 **종전에도 정합**이었다 — 증상이 stretch 에서만 나오는 이유. 확정 밴드 + auto 자식은 프리셋 row 레이아웃의 기본 형태라 라이브 도달 가능.
- **사각지대였다가 닫혔다**: `flexSweep` 가 오래 definite cross 를 줄 합보다 **크게**만 잡아 양수 free space 조합만 훑었고, 정렬 결함 3건이 전부 거기 있었다. 2026-07-27 에 음수 free space 축을 더해 1152 조합(교차축 576 + main 576)으로 확장했다 — `CROSS_SIZE`에 `definite-overflow`, main 축에 `MAIN_SPACE`.

## 넘칠 때의 정렬 — 위치 정렬은 음수 offset, 분배 정렬은 fallback (CSS-ALIGN-3 §4.2/§4.4, 2026-07-27)

여유 공간이 **음수**(내용이 컨테이너보다 큼)일 때 정렬은 두 계열로 갈린다. 3축(`justify-content` / `align-items` / `align-content`) 모두 동형이고, 한 계열의 값만으로 처리하면 반대쪽이 깨진다.

| 계열                                     | 음수 여유에서                      | 엔진 표현                                   |
| ---------------------------------------- | ---------------------------------- | ------------------------------------------- |
| **위치** (`center` / `flex-end`)         | 그대로 음수 offset (기본 `unsafe`) | `*_raw` (클램프 없는 값)                    |
| **분배** (`space-between/around/evenly`) | fallback → start 처럼 배치         | `*_free` (`.max(0.0)` 유지)                 |
| **`align-content: stretch`**             | 라인 부풀리기 없음                 | `.max(0.0)` 유지 (`stretch_extra > 0` 조건) |

- 분배값의 `.max(0.0)` 은 **결함이 아니라 정답**이다 — Chrome 실측에서 `space-between/around/evenly` 는 음수 여유에서 셋 다 start(0). 지우면 라인/아이템이 역방향으로 겹친다.
- `align-items` 에는 분배값이 없어 `place_line_cross_axis` 의 `cross_free` 는 클램프 없이 쓴다.
- Chrome 실측 기준값 — 컨테이너 100 / 아이템 300: `center` −100, `flex-end` −200. 컨테이너 cross 60 / 두 줄 합 100: `align-content:center` 줄 y = −20·30, `flex-end` = −40·10.
- Chrome 실측 fixture 2종 — **역할이 다르니 둘 다 갱신할 것**:
  - `crossAxisOverflow.browser.test.ts` — 규칙별 **기대 좌표를 명시**로 잠근다 (교차축 13 · main 6 · align-content 6 · 미결정 main 6 × engine·pipeline 2 leg). "무엇이 몇으로 틀렸나" 를 읽는 쪽.
  - `flexSweep.browser.test.ts` — 파라미터 격자를 **넓게** 훑는다 (1152 조합). "어딘가 틀렸다" 를 잡는 쪽. 음수 여유 조합의 민감도 실측: 라인 cross 승격을 `max` 로 되돌리면 교차축 48/576 red, 정렬 클램프를 되살리면 교차축 80/576 + main 32/576 red.

### 여유가 **없는 것**과 음수인 것은 다르다 — 미결정 main 센티넬 (2026-07-27)

여유 공간은 **definite main size 에서만** 산출된다 (CSS §9.7). `flex-direction:column` + `height:auto` 처럼 main 축 크기가 미결정이면 컨테이너가 내용으로 축소되므로 여유라는 개념 자체가 없고, `justify-content` 6종은 **전부 no-op** 이다. 위의 "음수 여유" 규칙과 **다른 상황**이다.

- 엔진은 미결정 main 을 **음수 센티넬**(`INDEFINITE_AVAIL = -1`)로 받는다. 그대로 빼면 `-1 − 내용합` 이라는 **가짜 음수 여유**가 생겨 위치 정렬이 자식을 컨테이너 **위로** 밀어내고, auto height 는 밀려난 만큼 줄어든다.
- 센티넬 가드는 main 축 소비 지점 **전부**에 있어야 한다: `resolve_flexible_lengths` / `collect_lines` / `place_line_main_axis` / main 축 auto margin 흡수(`tree.rs`). 셋은 원래 있었고 `place_line_main_axis` 만 없었는데, 분배값의 `.max(0.0)` 이 **결과적으로** 가려주고 있었다 — 위치 정렬에서 클램프를 걷어내자 드러났다.
- **실측(ListBoxItem origin)**: catalog `containerStyles.justifyContent:center` + `height:auto` 행에서 자식이 `(−1 − 76)/2 = −38.5` 만큼 위로 밀려 아이콘/라벨/설명이 행 밖으로 나가고 높이가 84 → 45.5 로 축소. `justifyContent` 가 없는 GridListItem 은 무증상이라 **비대칭**으로 나타났다.
- **`flexSweep` 는 이 축을 못 잡는다** — 컨테이너 main 을 항상 확정으로 주기 때문에 결함이 있어도 1152 조합 전부 green (실측). 미결정 main 은 `crossAxisOverflow.browser.test.ts` 의 `INDEFINITE_MAIN_CASES` 가 유일한 감시자다(되돌리면 center/end × 2 leg = 4 red).
- cross 축에는 같은 함정이 없다 — `place_line_cross_axis` 가 받는 `this_line_cross` 는 definite 면 컨테이너 cross, 아니면 라인 내용 max 라 **항상 실값**이다. `align_content` 는 `cross_is_definite` 로 이미 분기한다.

**grid 도 같은 규칙이되 표현이 다르다** — `solve_grid` 는 `height:auto` 일 때 트랙 sizing 을 위해 **상속 available 을 `container_h` 로 대입**한다(센티넬이 아니다). 그래서 `align-content` 여유를 `container_h − 트랙합` 으로 잡으면 없는 공간을 나눠 넣는다. 판정 기준은 `explicit_h > 0.0`(자기 height 가 definite) 이고, 그렇지 않으면 `align_content` 를 빈 문자열로 눌러 전달한다.

- **실측(2026-07-27)**: `height:auto` + `align-content:center` 그리드에서 트랙이 `(600−70)/2 = 265` 아래로 밀리고 컨테이너 높이가 `70 → 335`. `space-between` 은 `560 / 600`.
- 인라인 축(`justify-content`)은 대상 아님 — block 레벨 stretch 로 폭이 늘 definite 이다. shrink-to-fit 그리드가 생기면 그때 같은 판정을 붙인다.
- **잔존**: definite 높이 + auto 행에서 `align-content: normal`(= grid 에선 `stretch`)의 **auto 트랙 균등 분배**는 미구현. 실측 차이는 `gridAlignContent.browser.test.ts` 의 스냅샷(DOM 95 / engine 30)이 고정한다.

### 금지 패턴

- ❌ 라인 cross 승격을 `this_line_cross.max(available_cross)` 로 재도입 (§9.4 step 8 은 대입)
- ❌ 넘치는 아이템을 라인/컨테이너 크기로 **자르는** 보정 — 넘침은 흘러넘치는 것이 정상이고, 자르는 것은 `overflow` 소관
- ❌ 위치 정렬(center/end)에 클램프된 여유(`.max(0.0)`) 사용 → overflow 에서 조용히 start 로 무너진다
- ❌ 분배 정렬·`align-content:stretch` 에 클램프 없는 여유 사용 → 음수 분배로 역방향 겹침
- ❌ 두 계열을 한 변수로 통일 (`free_main`/`free_main_raw`, `cross_free`/`cross_free_raw` 쌍이 정본)
- ❌ main 축 available 을 **센티넬 가드 없이** 소비 (`available_main - total` 직접 사용) → 미결정 main 에서 가짜 음수 여유
- ❌ grid `align-content` 여유를 `container_h` 로 산출 (`height:auto` 면 상속값이라 가짜 여유) → `explicit_h > 0.0` 판정 필수
- ❌ 미결정 main 결함을 `flexSweep` 로 검증했다고 판단 — 그 격자는 main 을 항상 확정으로 준다

## 백분율 크기 — 두 축의 "definite" 조건이 다르다 (2026-07-27)

`%` 크기는 containing block 의 해당 축이 definite 일 때만 해소되고, 아니면 `auto` 다. **성립 조건이 축마다 다르다**:

| 축             | 부모가 definite available 을 내려주면 | 근거                                           |
| -------------- | ------------------------------------- | ---------------------------------------------- |
| 인라인 (width) | **확정**                              | block 레벨 자식은 부모 폭으로 stretch          |
| 블록 (height)  | **미확정**                            | `height:auto` 는 내용 크기 — 세로 stretch 없음 |

- 판정은 `explicit_h > 0.0` **하나**다. 상속 available(`avail_h >= 0`)은 높이를 확정하지 않는다 (CSS §10.5).
- **게이트는 두 경로에 다 있어야 한다** — `%` 를 푸는 ctx (`cross_ctx`/`main_ctx`) 와 **자식 재귀 solve 에 내려주는 available** (`child_containing_h`). 한쪽만 막으면 자식이 자기 `solve_node` 에서 상속 available 로 다시 해소한다. `solve_block` 은 원래 두 곳 다 있었고 `solve_flex` 는 둘 다 없었다.
  - 민감도 실측: ctx 게이트만 되돌리면 8 red(row 만), 재귀 available 게이트만 되돌리면 16 red(row+column).
- 폭 축의 `avail_w >= 0` 조항은 **유지**한다 — 지우면 stretch 부모 안의 `width:100%` 손자가 다시 수축한다 (DatePicker 2026-07-14). `percentSize.browser.test.ts` 의 `SHRINK_WRAP_CASES` 가 양쪽(stretch/shrink-wrap)을 같이 잠근다.
- **실측(2026-07-27)**: `flex(row, width:300, height 미지정)` 안의 `height:50%` 자식이 상속 600 의 절반인 300 (DOM 0). 컨테이너도 그만큼 부풀었다.

### 금지 패턴

- ❌ 두 축을 한 규칙으로 묶어 `explicit || avail >= 0` 판정 → 블록 축에서 가짜 확정
- ❌ `%` ctx 만 막고 자식 재귀 available 은 그대로 전달 (또는 그 반대) → 한 경로로 새어 나간다
- ❌ 폭 축에서 `avail_w >= 0` 제거 → stretch 부모의 `width:100%` 수축 회귀

## `margin: auto` 는 정렬보다 먼저 여유를 가져간다 — 흡수 단위는 **라인** (CSS-FLEXBOX-1 §8.1, 2026-07-27)

auto margin 은 해당 축의 양의 여유를 흡수하고, 그 결과 그 축의 정렬 속성은 **무효**가 된다. 세 규칙이 한 묶음이라 하나만 넣으면 나머지가 어긋난다:

| 규칙         | 내용                                                                      |
| ------------ | ------------------------------------------------------------------------- |
| §9.6 step 13 | cross auto margin 이 **라인** cross 여유를 균등 흡수 (음수 여유면 0)      |
| §9.6 step 14 | cross margin 중 하나라도 auto 면 `align-self` 무효                        |
| §9.4 step 11 | `stretch` 는 cross margin 이 **둘 다 auto 가 아닐 때만** 적용 (크기 유지) |
| §8.1 (main)  | main auto margin 흡수 시 `justify-content` 무효                           |

- **거처는 flex 커널** (`flex.rs::place_line_main_axis` / `place_line_cross_axis`) — 흡수량이 그 라인의 여유와 라인 cross 에 달려 있어 라인을 소유한 층이 아니면 계산할 수 없다. 구 구현은 tree.rs 후처리(step 3.8)로 main 축만, 그것도 **단일 라인 근사**여서 (a) cross 축은 통째로 미구현, (b) wrap 컨테이너는 main 축 흡수조차 없었다. tree.rs 에 auto margin 후처리를 재도입하면 커널 흡수와 **이중 적용**된다.
- **채널이 따로 있어야 한다**: `resolve_signed` 가 `auto` 를 0 으로 주므로 값만으로는 `margin: 0` 과 구분되지 않는다. flex 입력 off 20 `margin_auto_mask`(물리 4비트, 0=없음 zero-init)가 그 채널이고, 기록(`tree.rs::write_flex_item`)과 해석(`parse_item`)이 **같은 상수**(`flex::MARGIN_AUTO_*`)를 쓴다.
- 크기 계산(라인 cross, outer main 합)은 auto 를 **0 으로 본 값이 정답**이다 — 흡수는 배치 단계에서만 일어난다.
- **실측(2026-07-27)**: `align-items` 무엇이든 `marginTop:auto` 아이템이 y=0 (DOM 160) / `height:auto`+cross auto margin 이 라인 높이로 stretch (DOM 은 내용 0) / wrap 2줄에서 `marginLeft:auto` x=100 (DOM 150). 민감도 — cross 분기 무력화 38 red, main 흡수 무력화 20 red (`autoMargin.browser.test.ts` 79건 기준).
- **패널에서는 아직 authoring 불가**: Inspector margin 입력(`FourWayGrid.commitValue`)이 `replace(/[^0-9.-]/g, "")` 로 숫자만 남겨 `auto` 가 빈 값이 된다. catalog `containerStyles` 에도 auto margin 0건 — 그래서 이 발산이 오래 안 보였다. 반대로 preview/publish DOM 쪽 CSS 는 `margin-left:auto` 를 4곳(GridList/Tree/Toast/ChatMessage) 쓰고 있어, 그 offset 은 Skia 축에 대응물이 없다(D3 비대칭, 본 변경과 별개).
- **잔존**: grid item 의 auto margin 미구현. 단 그 케이스는 **선행 결함에 가려져 있다** — 명시 width 를 가진 grid item 이 트랙 폭으로 stretch 되는 ADR-156 §Residual 이 먼저 걸린다. 두 결함의 선후는 `autoMargin.browser.test.ts` 의 스냅샷이 고정한다.

### 금지 패턴

- ❌ tree.rs 후처리로 auto margin 재도입 → 커널 흡수와 이중 적용
- ❌ auto 판정을 margin **값이 0 인가**로 대체 → `margin: 0` 과 구분 불가
- ❌ 흡수량을 컨테이너 여유로 산출 → multi-line 에서 라인마다 여유가 다르다
- ❌ cross auto margin 을 넣으면서 stretch·align-self 억제를 빼기 (§9.4 step 11 / §9.6 step 14 는 같은 묶음)
- ❌ 음수 여유에서 auto margin 에 음수 분배 → 0 흡수 = 아이템이 라인 시작에 붙고 넘치는 것이 정답

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
