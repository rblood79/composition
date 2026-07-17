# Canvas 렌더링 구현 상세

> 이 파일은 `.claude/rules/canvas-rendering.md`의 diet version에서 이동된 구현 세부사항입니다.
> 규칙 원칙은 canvas-rendering.md를 참조하세요.

## Label Factory 패턴 (field 컴포넌트 자식)

모든 field 컴포넌트의 Label 자식 factory 정의 표준:

```typescript
{
  tag: "Label",
  props: {
    children: "Label Text",
    variant: "default",
    style: { width: "fit-content", height: "fit-content", fontWeight: 500 },
  },
}
```

- `width/height: "fit-content"` 필수 — Taffy에서 auto 대신 텍스트 크기에 맞춤 (누락 시 height 이상)
- `fontWeight: 500` — Label 기본 굵기
- `fontSize` — DFS Label size delegation이 주입하므로 factory에서는 선택적
- `flexShrink: 0` — implicitStyles에서 공통 주입 (flex-direction: row 시 축소 방지)
- `createDefaultLabelProps()`: 독립 생성 시 기본값 함수

## BUTTON_SIZE_CONFIG ↔ CSS 높이 정합성

`BUTTON_SIZE_CONFIG` / `TOGGLEBUTTON_SIZE_CONFIG` (engines/utils.ts)는 `lineHeight` 필드를 필수로 포함해야 함.
CSS Button은 명시적 `line-height: var(--text-*--line-height)`를 사용하므로, `lineHeight` 누락 시
`estimateTextHeight()`가 font metrics 기반 `line-height: normal`로 계산 → CSS와 높이 불일치.

- CSS height = lineHeight + paddingY × 2 + borderWidth × 2
- `calculateContentHeight()`에서 inline lineHeight가 없으면 `sizeConfig.lineHeight` 사용
- 값 변경 시 반드시 `spec-value-sync.md` 레퍼런스 테이블과 대조

## Label size delegation 상세 (LABEL_SIZE_STYLE 단일 소스, 3경로 동기화)

**LABEL_SIZE_STYLE 매핑** (`fullTreeLayout.ts` 정의 — `packages/specs/src/primitives/typography.ts` 의 `FONT_SIZE_TO_LINE_HEIGHT`/`getLabelLineHeight` 와 동일 소스. Label 시각 정본은 catalog `COMPONENT_RULES_TABLE.Label`):

| size | fontSize | CSS 토큰  | lineHeight |
| ---- | -------- | --------- | ---------- |
| xs   | 10       | text-2xs  | 16px       |
| sm   | 12       | text-xs   | 16px       |
| md   | 14       | text-sm   | 20px       |
| lg   | 16       | text-base | 24px       |
| xl   | 18       | text-lg   | 28px       |

CSS 근거: `--text-sm` = 14px, `--text-sm--line-height` = calc(1.25/0.875) = 1.42857 → 14 × 1.42857 = 20px

**3경로 동기화**:

- **CSS**: 부모가 `--label-font-size` 변수 설정 → Label이 `var(--label-font-size)` 상속. `base.css`에 `font-size: var(--label-font-size)`, `line-height: var(--label-line-height)`
- **Layout DFS**: `fullTreeLayout.ts` — Label DFS 진입 시 조상 탐색으로 `fontSize`/`lineHeight` 인라인 주입
  - 주입 조건: `labelStyle.lineHeight == null` 기준 (`fontSize == null` 금지)
  - lineHeight 미주입 시 `fontSize * 1.5` fallback → CSS Preview(20px)와 불일치
  - batch height override: `Math.ceil(childFs * 1.5)` 대신 LABEL_SIZE_STYLE lineHeight 역참조
- **Skia**: `buildSpecNodeData.ts` — `resolveParentDelegatedSize()` (propagationRegistry `getParentTagsForChild` 기반 0-3 level 조상 탐색) → `specProps.size` 주입 → catalog Label rule shapes

**조상 탐색 패턴 (lastDelegationAncestor)**:

- Label → Checkbox(래퍼) → CheckboxItems(래퍼) → CheckboxGroup(size 소유자) 순으로 탐색
- `lastDelegationAncestor` 패턴으로 size 없는 standalone 부모도 기본값 "md" 적용
- LABEL_WRAPPER_TAGS: `Checkbox, Radio, CheckboxItems, RadioItems` — size 없이 상위로 통과
- LABEL_DELEGATION_PARENT_TAGS: 모든 size-delegation 컨테이너. **DatePicker, DateRangePicker 포함 필수** (누락 시 Label height 24px 오계산)

**주의사항**:

- `--text-md` CSS 변수 없음 → `var(--text-base)` 사용 (`tokenToCSSVar()`에서 `text-md` → `text-base` 자동 매핑)
- lineHeight는 반드시 `"20px"` 문자열 전달 (숫자는 `parseLineHeight`가 배율로 해석)

## Checkbox/Radio/Switch 내부 Label nowrap (3경로 동기화)

- **CSS**: `Checkbox.css`에 `white-space: nowrap`
- **Taffy**: `implicitStyles.ts` — 자식 Label + Synthetic Label에 `whiteSpace: "nowrap"` 주입
- **Skia**: `buildSpecNodeData.ts` 의 `isLabelInNowrapParent()` — text style override 블록에서 Label 자식 text 에 `whiteSpace: "nowrap"` 주입

## Calendar 계열 현행 렌더 경로 (catalog 기반)

구 ElementSprite 시절의 다중 줄 보정 스킵(`isCalendarText`)과 spec `skipCSSGeneration` 서술은 폐기됨 — Calendar 계열 spec 은 삭제되고 catalog 로 전환.

- 시각 정본: `COMPONENT_RULES_TABLE` (`packages/shared/src/catalog/generated/componentRulesTable.ts`) + `Calendar/RangeCalendar/CalendarGrid/CalendarHeader.binding.ts` (`packages/shared/src/catalog/bindings/`)
- `CalendarHeader` 는 `CONTAINER_DIMENSION_TAGS` 등록 (`buildSpecNodeData.ts`) — 우측 chevron/center text 좌표가 컨테이너 폭 의존 (`_containerWidth` 주입)
- `Calendar`/`RangeCalendar` 는 `SHELL_ONLY_CONTAINER_TAGS` (`buildSpecNodeData.ts`) — 자식 수 무관 `_hasChildren=true` (ADR-072)
- `isNowrapTag` 는 현행 코드에서 Tag/Badge 기본 nowrap 판정 용도 (`buildSpecNodeData.ts` text style override 블록) — Calendar 와 무관

## Size Delegation 상세 (Compositional Component)

**구현** (registry 기반 — 구 `PARENT_SIZE_DELEGATION_TAGS`/`SIZE_DELEGATION_PARENT_TAGS` Set 과 ElementSprite selector 는 폐기):

- Skia: `buildSpecNodeData.ts` 의 `resolveParentDelegatedSize()` — `getParentTagsForChild(element.type)` (`propagationRegistry.ts`) 로 delegation 부모 태그 집합을 얻어 0-3 level 조상 탐색으로 size 읽기 (Breadcrumb→Breadcrumbs 특수 분기 포함)
- size 우선순위: `props.size ?? delegatedSize ?? defaultSize` — `props.size` 미명시 + delegatedSize 존재 시 `specProps.size` 로 주입
- Layout 경로(`fullTreeLayout.ts`)의 `effectiveGetChildElements` 래퍼도 동일하게 size 주입

## Necessity Indicator 3경로 상세

S2 패턴의 필수 필드 표시. 3경로 동기화 필수.

- **Preview (CSS)**: `renderNecessityIndicator()` — Label 내 `<span class="necessity-indicator">` 렌더링
  - `icon` 모드: `*` (빨간색 `--negative`)
  - `label` 모드: `(required)` 또는 `(optional)` (회색 `--fg-muted`)
- **Layout (Taffy)**: `fullTreeLayout.ts` Label DFS + `implicitStyles.ts` — Label `children` 텍스트에 indicator 추가
- **Skia**: `buildSpecNodeData.ts` — `_necessityIndicator` specProps 주입
- **에디터**: 통합 Required select (None / Icon / Label) — `isRequired` + `necessityIndicator` 동시 설정
- **공유 유틸**: `packages/shared/src/components/FieldNecessityIndicator` 의 `renderNecessityIndicator()`, `NecessityIndicator` 타입
- layout prop **5-심볼 2계층 체인** 점검 필수. `necessityIndicator`/`isRequired` 는 **props 축**이라 계층 A `LAYOUT_AFFECTING_PROP_KEYS`(`stores/utils/layoutInvalidation.ts`) + 계층 B `LAYOUT_PROP_KEYS`(`scene/layoutCache.ts`) **양쪽 등록됨** (정상 사례). style 축 키라면 계층 B 는 **`LAYOUT_STYLE_KEYS`** 를 써야 한다 — 정본: `.claude/rules/layout-engine.md` §"5-심볼 2계층 체인"

## Collection Item Font 주입 상세 (ListBoxItem/GridListItem)

현행 경로는 [layout-details.md](layout-details.md) "Collection Item font 주입 상세" 참조 — 구 ElementSprite `collectionItemFontStyle` selector 는 폐기됨 (심볼 소멸). Taffy 높이 계산은 `implicitStyles.ts` 의 `injectCollectionItemFontStyles()`, 시각은 catalog `COMPONENT_RULES_TABLE` rule 기반.

## Pointer → Move 상세

`startMove`에 전달하는 요소 ID는 반드시 store의 `selectedElementIds`에서 읽어야 한다.

**흐름**: `handleElementClick` → `resolveClickTarget()` → 올바른 선택 대상 결정 → store 갱신 → rAF 내에서 `useStore.getState().selectedElementIds[0]`로 읽어 `startMove` 전달

- Zustand `set()`은 `startTransition` 내에서도 동기 갱신 → rAF 시점에 정확한 값 보장
- 위반 시: 컴포넌트 반복 선택/해제/더블클릭 시 내부 자식이 의도치 않게 이동됨
- 위치: `useCentralCanvasPointerHandlers.ts`

## Arc Shape 렌더링 상세 (ProgressCircle 등)

Spec `arc` shape → specShapeConverter에서 `type: "box"` + `arc` 데이터로 변환. 별도 `type: "arc"` 사용 금지 (`React.lazy()` import 체인으로 `renderNodeInternal` switch 미도달, HMR 이슈).

- `renderBox`에서 `node.arc` 감지 시 `CanvasKit.Path.addArc()`로 부분 원호 렌더링
- 트랙 링에 `circle` + stroke 사용 금지: `renderSolidBorder`는 `inset = sw/2` 적용 → 스트로크 중심 반지름이 `sw/2` 만큼 안쪽으로 밀림. `addArc`는 정확한 반지름에 그림 → 어긋남. 해결: 트랙도 `arc(sweepAngle=360°)`로 동일 렌더링 경로 사용
- Spec text 중앙 배치: `x: 0, y: 0` + `align: "center"` + `baseline: "middle"` 사용
  - `x: cx, y: cy` 사용 시 specShapeConverter가 paddingLeft/maxWidth를 오계산하여 텍스트 치우침

## Spec Container Dimension Injection 상세

Spec shapes가 레이아웃 엔진(Taffy) 결과(containerWidth/Height)를 필요로 할 때:

- `_containerWidth`/`_containerHeight` props 주입: `buildSpecNodeData.ts` 에서 레이아웃 결과 w/h 를 specProps에 전달
- `CONTAINER_DIMENSION_TAGS` Set (`buildSpecNodeData.ts` 모듈 상수): 주입 대상 태그 O(1) 조회. 컨테이너 폭 의존 shapes 추가 시 이 Set에 등록 필수
- 2-pass height 교정: 모든 컨테이너에서 자식 width 제약 → 텍스트 줄바꿈 → height 재계산이 자동 동작 (fullTreeLayout Step 4.5)
- 우측 역산 배치: `containerWidth - border - paddingRight - pad - iconSize/2` (텍스트 폭 추정 금지)
- 정확한 세로 중앙: `containerHeight / 2` (`size.height / 2` 사용 금지 — border 미포함)
- 파이프라인 타이밍 수정 금지: `publishLayoutMap` 동기화, `notifyLayoutChange()` 강제 호출 등 해킹 금지
- 부모 delegation prop 변경 시: `updateSelectedPropertiesWithChildren`으로 부모+자식 atomic batch update
- 상세: `.claude/skills/composition-patterns/rules/spec-container-dimension-injection.md`

## Popover 자식 레이아웃 엔진 제외

DatePicker/DateRangePicker 내부의 Calendar/RangeCalendar은 Preview에서 Popover로 표시되므로 Skia 레이아웃 엔진 계산에 참여하면 안 됨.

- `POPOVER_CHILDREN_TAGS` (모듈 스코프 상수): `Set(["Calendar", "RangeCalendar"])`
- `implicitStyles.ts`에서 `filteredChildren`에서 제외하여 `labelPosition: "side"` 시 Label + DateInput만 row 배치

## TextMeasurer ↔ nodeRenderers fontFamilies 상세

측정기와 렌더러가 완전히 동일한 `fontFamilies` 배열을 사용해야 함:

- 측정기(`canvaskitTextMeasurer.ts`의 `buildFontFamilies()`): CSS 체인 전체를 `split(",")` → `resolveFamily()` 매핑
- 렌더러(`specShapeConverter.ts`): `shape.fontFamily.split(",")` → `resolveFamily()` 매핑
- CSS fontFamily 문자열을 단일 배열 요소로 전달 금지 (CanvasKit이 매칭 실패 → fallback 폰트 → 폭 차이)
- 측정기에서 첫 번째 폰트만 추출 (`split(",")[0]`) 금지 — fallback chain이 다르면 동일 텍스트도 shaping 결과 다름
- 참조: `docs/bug/skia-button-text-linebreak.md`

**FontMgr 교체 시 캐시 clear**: 렌더러의 Paragraph LRU 캐시(nodeRenderers.ts)와 측정기 캐시(canvaskitTextMeasurer.ts)는 별도 관리 (목적이 다름: 렌더 vs 측정)

## Canvas 2D↔CanvasKit 텍스트 오차 처리 원칙

Layout = Canvas 2D = CSS 정합이 원칙. Canvas 2D 측정값에 보정(+2/+4px) 추가 금지.

- **Layout 경로** (`calculateContentWidth`, `enrichWithIntrinsicSize`, `fullTreeLayout Step 3.6`): Canvas 2D `measureTextWidth()` 결과를 그대로 사용. `isCanvasKitMeasurer()` 기반 보정 금지.
- **렌더링 경로** (`nodeRendererText.ts`): post-layout 교정 — `paragraph.layout(effectiveLayoutWidth)` 후, `\n` 없는 단일줄 텍스트가 줄바꿈되면 `getMaxIntrinsicWidth() + 1`로 재layout. CanvasKit 자체 측정 기반이므로 경험적 tolerance 불필요.
- **Break Hint** (`nodeRendererText.ts:324`): Canvas 2D가 줄바꿈 결정 → hintedText `\n` 주입 → CanvasKit 강제.
- **`getMaxIntrinsicWidth()` 호출 시점**: 반드시 `layout()` 이후. layout 전 호출 시 0 반환.
