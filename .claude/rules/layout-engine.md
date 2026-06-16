---
description: 레이아웃 엔진 관련 파일 작업 시 적용
globs:
  - "packages/layout-flow/**"
  - "**/layout/**"
  - "**/engines/**"
  - "**/LayoutContainer*"
---

# 레이아웃 엔진 규칙

> 구현 상세는 [layout-details.md](.claude/skills/composition-patterns/reference/layout-details.md) 참조

## 엔진 선택

- flex → TaffyFlexEngine, grid → TaffyGridEngine, block/undefined → TaffyBlockEngine (단일 Taffy WASM)

## layoutVersion 계약 (CRITICAL)

- `fullTreeLayoutMap` useMemo는 `layoutVersion` 카운터에 의존
- 레이아웃 영향 **모든 코드 경로**에서 `layoutVersion + 1` 필수
- 새 layout prop 추가 시 **3-심볼 체인 점검**: (1) `LAYOUT_PROP_KEYS` (`layoutCache.ts:100`, 캐시 시그니처 — 추가 필수) / (2) `NON_LAYOUT_PROPS_UPDATE` (`elementUpdate.ts:19`, 블랙리스트 — layout 영향 있는 prop은 **여기 추가 금지**, `isLayoutAffectingUpdate()` 가 `!set.has(k)` 로 판정) / (3) `INHERITED_LAYOUT_PROPS_UPDATE` (`elementUpdate.ts:73`, 부모→자식 상속 — fontSize/lineHeight 류만). **Why**: `LAYOUT_PROP_KEYS` 누락 → 캐시 히트로 변경 미반영. `NON_LAYOUT_PROPS_UPDATE` 오등록 → layoutVersion 증가 skip. (참고: `LAYOUT_AFFECTING_PROPS` 는 과거 심볼 — 현재 코드에 없음)

## CONTAINER_TAGS

- children 렌더링 컴포넌트는 height: `'auto'` + `minHeight`. **Why**: 고정 height → children 겹침

## Parent-delegated props 상속

- Canvas 엔진은 CSS와 달리 명시적 전파 필요 → `effectiveGetChildElements` 래퍼 사용
- `enrichWithIntrinsicSize` 재귀 호출과 DFS `filteredChildren` 양쪽에 적용 필수
- Skia 경로도 동기화: ElementSprite `parentDelegatedSize` selector. **Why**: Store가 자식 size 미저장

## Label size delegation (CRITICAL)

- DFS 진입 시 조상 탐색으로 `fontSize`/`lineHeight` 인라인 주입
- 주입 조건: `labelStyle.lineHeight == null` 기준. **Why**: fontSize 조건 → factory 기본값과 충돌 → lineHeight 미주입 → 1.5배 fallback
- LABEL_SIZE_STYLE: LabelSpec 단일 소스 xs~xl 매핑. lineHeight는 `"20px"` 문자열 필수 (숫자는 배율 해석)
- LABEL_DELEGATION_PARENT_TAGS: DatePicker/DateRangePicker 포함 필수. **Why**: 누락 → Label 24px 오계산
- batch height override: `Math.ceil(fontSize * 1.5)` 대신 LABEL_SIZE_STYLE lineHeight 역참조

## PersistentTaffyTree display/grid 전환 감지 (CRITICAL)

- display 변경 및 gridTemplateColumns 변경 → **full rebuild 필수**. **Why**: Taffy 증분 갱신이 처리 불가
- `affectedNodeIds` 필터 시 `undefined` 조건 누락 금지. **Why**: 캐시 미스 시 undefined 전달 가능
- **신규 grid container (`prevJson` 없음) → full rebuild 필수**. **Why**: Taffy WASM `addNode` 증분 추가로는 gridTemplateColumns/Areas 가 auto-placement 로 degrade — 등록 직후 한 줄 배치, 새로고침(buildFull) 후에만 정상 2행. `!prevJson && (curDisplay === "grid" || "inline-grid")` 에서 needsFullRebuild=true 강제
- **신규 컨테이너(자식 서브트리 보유) → full rebuild 필수** (grid 아니어도). **Why**: `addComplexElement`(부모+자식 트리 일괄 등록, 예 Select/ComboBox) 시 한 batch 에 부모+자식 다수 신규 노드가 들어오면 `addNode` 증분이 자식 layout 을 produce 못 함(layout=undefined) → 자식이 (0,0) 겹침 + 부모 height 가 자식 합산 미만으로 degrade(Select 등록 직후 34, 새로고침 full rebuild 후 54). `!prevJson && filteredChildIdsMap.get(id)?.length > 0` 에서 needsFullRebuild=true 강제 (grid 조건과 동일 게이트). ADR-912 R1 후속 (2026-06-12)
- **기존 grid container 의 layout-영향 20-key 변경 → full rebuild 필수**: gridTemplateColumns/Rows/Areas/AutoColumns/AutoRows/AutoFlow + padding/padding{Top,Right,Bottom,Left} + gap/rowGap/columnGap + **width/height/min{Width,Height}/max{Width,Height}**. **Why**: `updateStyleRaw`(=set_style) 는 grid track/placement 캐시 invalidation 실패 → padding 변경 시 1줄 degrade / gap 변경 미반영 / **width 변경 시 1fr·auto track 이 변경 전 컨테이너 폭 기준으로 stale degrade (1줄로 무너짐) → 새로고침(buildFull) 후에만 정상 2행**. 비-grid 는 증분 유지 (Flex/Block `updateStyleRaw` 정상 동작 — dimension 변경 시 full rebuild 는 `isGridDisplay(curDisplay)` 분기 안에서만). `GRID_REBUILD_TRIGGER_KEYS` (`fullTreeLayout.ts`) 비교 키는 `taffyStyleToRecord` 출력 = camelCase 단일 키 (`width`/`minWidth` 등). `fullTreeLayout.static.test.ts` 가 dimension 6키 누락을 정적 가드. 2026-06-16 추가

## Taffy gridTemplate 직렬화 경로 (CRITICAL)

- Taffy WASM binary_protocol 은 `gridTemplateColumns`/`Rows`/`AutoColumns`/`AutoRows` 를 **track array** (`["1fr", "auto"]`) 로 기대. CSS 표준 string (`"1fr auto"`) 통과 시 `invalid type: string, expected a sequence` parse error → persistent tree 리셋 + 재빌드 루프. **3 직렬화 경로 모두 정규화 필수**:
  - `fullTreeLayout.taffyStyleToRecord` (flex via elementToTaffyStyle)
  - `fullTreeLayout.buildNodeStyle` grid branch (direct partial)
  - `fullTreeLayout.patchBatchStyleFromImplicit` (applyImplicitStyles post-patch)
- 정규화 헬퍼: `parseGridTemplate(template: string)` (`TaffyGridEngine.ts` export). 괄호 depth 기반 토큰화 → `repeat(auto-fill, minmax(...))` 복합 표현 정확 분해
- 이미 array 면 그대로 통과: `Array.isArray(val) ? val : parseGridTemplate(val)`

## Grid area 이름 해석 (CRITICAL)

- `buildNodeStyle` grid branch 는 **gridArea 이름 해석 미지원** (`parseGridAreaShorthand` + templateAreas 매칭 은 `TaffyGridEngine.elementToTaffyGridStyle` 에만 존재)
- 자식에 `gridArea: "label"` 같은 이름만 주입하면 Taffy 가 string 그대로 받아 auto-placement 로 degrade → 자식이 container 밖으로 흘러나감
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

## Layout Prop 변경 → Canvas 반영 (7곳 체크리스트)

1. `LAYOUT_PROP_KEYS` (`layoutCache.ts:100`) — 캐시 시그니처 (layout-relevant prop이면 **추가 필수**)
2. `NON_LAYOUT_PROPS_UPDATE` (`elementUpdate.ts:19`) — layoutVersion 트리거 판정 블랙리스트 (layout 영향 prop은 **여기 추가 금지** — `isLayoutAffectingUpdate` 가 블랙리스트 제외 방식으로 판정)
3. `INHERITED_LAYOUT_PROPS_UPDATE` (`elementUpdate.ts:73`) — 부모→자식 상속 전파 (fontSize/lineHeight/textAlign 등 상속성 prop만)
4. `pageLayoutSignature` deps — elementById 포함
5. `patchBatchStyleFromImplicit` — 배열 타입 지원
6. display/grid 전환 감지 — full rebuild 조건
7. `LAYOUT_AFFECTING_PROPS` — **과거 심볼, 현재 코드 없음** (stale 참조 제거)

## Overflow Scroll + Flex Shrink 보정

- `overflow !== "visible"` 부모(hidden/clip/scroll/auto)의 flex 자식에 명시적 `flexShrink`가 없으면 `flexShrink: 0` 자동 주입. **Why**: CSS에서 overflow clipped 컨테이너의 자식은 shrink하지 않고 overflow 허용하지만, Taffy는 이 상호작용 미지원 → 기본 `flexShrink: 1`로 자식이 축소됨
- 보정 위치: `fullTreeLayout.ts` DFS post-order (Step 5.7) + `TaffyFlexEngine.ts` `_runTaffyPassRaw`. **Why**: WebGL은 fullTreeLayout, 레거시 경로는 TaffyFlexEngine — 양쪽 모두 필요
- flex-direction과 overflow 축 매칭 필수: `row` → `overflowX`, `column` → `overflowY`. **Why**: 교차축 overflow는 shrink와 무관

## CSS min-width:auto 에뮬레이션 (CRITICAL)

- `enrichWithIntrinsicSize`에서 flex 자식에 `width` 주입 시 `minWidth`도 동일 값으로 동시 설정. **Why**: CSS flex item의 기본 `min-width: auto` = min-content 크기. Taffy는 이를 0으로 처리 → 자식이 0px까지 축소 가능. `overflow: visible`에서도 Preview와 동일하게 자연 너비 유지 필요
- 사용자 명시적 `minWidth` 설정 시 보존 (덮어쓰기 금지)
- `isFlexChild` 파라미터가 true일 때만 적용. **Why**: block 자식은 min-width:auto가 0이므로 주입 불필요

## Container style pipeline 연계 (ADR-907 Implemented)

collection/self-render 컨테이너의 `calculateContentHeight()` 분기는 **Layer D Spec metric SSOT** 원칙에 따라 `render.shapes()` 와 **동일 resolver 심볼**을 호출해야 한다. 상세 계약은 [canvas-rendering.md §2.6](canvas-rendering.md) 참조.

- **GridList**: `resolveGridListSpacingMetric()` (packages/specs/src/components/GridList.spec.ts) 를 utils.ts GridList 분기에서 import 하여 `render.shapes` 와 공유. 기존 `parseNumericValue(style.gap) ?? 12` ad-hoc 파싱 금지
- **paddingY \* 2 패턴 금지**: 4-way padding 수용 → `paddingTop + paddingBottom` (ADR-907 Wave B)
- **신규 자체 분기 추가 시**: (1) spec 에 `resolve{Component}SpacingMetric` 또는 `resolveContainerSpacing` 직접 호출 / (2) utils.ts 분기가 같은 resolver import / (3) `{Component}.spacing.test.ts` 에 Layer D contract 검증 추가

## 기타 규칙

- calculateContentHeight: content-box만 반환 (padding 제외)
- Block-child normalization: 이미 numeric/px 폭 있으면 100% 주입 스킵
- Taffy f32 보정: enrichWithIntrinsicSize에서 `Math.ceil` 적용. **Why**: f32/f64 정밀도 차이 → 불필요한 wrap
- Checkbox/Radio DFS: 부모 탐색으로 size 주입 (implicitStyles indicator 계산용)
- Collection Item font: CSS + implicitStyles + ElementSprite 3경로 동기화
- order_num 재정렬: `batchUpdateElementOrders()` 단일 set(). setTimeout 내 `get()` 필수 (stale closure)

## 금지 패턴

- flex 자식 width 주입 시 minWidth 미설정 금지 → `enrichWithIntrinsicSize`에서 동시 주입 필수
- overflow flexShrink 보정에서 `scroll/auto`만 체크 금지 → `!== "visible"` 필수
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
