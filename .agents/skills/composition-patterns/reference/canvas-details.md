# Canvas 렌더링 구현 상세

> 이 파일은 `.agents/rules/canvas-rendering.md`의 diet version에서 이동된 구현 세부사항입니다.
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

## Label size delegation 상세 (LabelSpec 단일 소스, 3경로 동기화)

**LabelSpec sizes 매핑**:

| size | fontSize | CSS 토큰  | lineHeight |
| ---- | -------- | --------- | ---------- |
| xs   | 10       | text-2xs  | (비례)     |
| sm   | 12       | text-xs   | (비례)     |
| md   | 14       | text-sm   | 20px       |
| lg   | 16       | text-base | (비례)     |
| xl   | 18       | text-lg   | (비례)     |

CSS 근거: `--text-sm` = 14px, `--text-sm--line-height` = calc(1.25/0.875) = 1.42857 → 14 × 1.42857 = 20px

**3경로 동기화**:

- **CSS**: 부모가 `--label-font-size` 변수 설정 → Label이 `var(--label-font-size)` 상속. `base.css`에 `font-size: var(--label-font-size)`, `line-height: var(--label-line-height)`
- **Layout DFS**: `fullTreeLayout.ts` — Label DFS 진입 시 조상 탐색으로 `fontSize`/`lineHeight` 인라인 주입
  - 주입 조건: `labelStyle.lineHeight == null` 기준 (`fontSize == null` 금지)
  - lineHeight 미주입 시 `fontSize * 1.5` fallback → CSS Preview(20px)와 불일치
  - batch height override: `Math.ceil(childFs * 1.5)` 대신 LABEL_SIZE_STYLE lineHeight 역참조
- **Skia**: `ElementSprite.tsx` — `parentDelegatedSize` → `specProps.size` 주입 → LabelSpec shapes

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
- **Skia**: `isLabelInNowrapParent` primitive selector → useMemo deps 포함 필수
  - `parentElement`를 useMemo 내에서 직접 참조 금지 (deps에 없으므로 stale closure)

## CalendarGrid/CalendarHeader 다중 줄 보정 스킵

ElementSprite의 다중 줄 텍스트 paddingTop 보정 로직은 `baseline: "middle" + y > 0` (절대 좌표 배치) 텍스트에 간섭하여 Y 위치를 이탈시킨다.

- `isCalendarText` 체크로 CalendarGrid/CalendarHeader 태그를 다중 줄 보정 블록에서 스킵
- `isNowrapTag`에 추가 금지: `child.text.whiteSpace = "nowrap"` 설정 시 `align: "center"` 정렬 깨짐
- CalendarGrid/CalendarHeader의 `skipCSSGeneration: true` 필수 — Generated CSS의 `display: grid` + `border`가 Taffy 레이아웃 방해

```typescript
// ElementSprite.tsx — 다중 줄 보정 블록
const isCalendarText =
  element.tag === "CalendarGrid" || element.tag === "CalendarHeader";
if (!isCalendarText && ws !== "nowrap" && ws !== "pre") {
  /* 보정 로직 */
}
```

## Size Delegation 상세 (Compositional Component)

**대상 태그**:

- PARENT_SIZE_DELEGATION_TAGS (자식): SelectTrigger, ComboBoxWrapper, SelectValue, SelectIcon, ComboBoxInput, ComboBoxTrigger
- SIZE_DELEGATION_PARENT_TAGS (부모): Select, ComboBox

**구현**:

- ElementSprite.tsx `parentDelegatedSize` selector: 부모/조부모 2단계 탐색으로 size 읽기
- useMemo deps에 `parentDelegatedSize` 포함 필수 (누락 시 size 변경이 Skia 트리에 전파 안 됨)
- size 우선순위: `props.size || parentDelegatedSize || tagGroupAncestorSize || "md"`
- Layout 경로(`fullTreeLayout.ts`)의 `effectiveGetChildElements`도 동일하게 size 주입

## Necessity Indicator 3경로 상세

S2 패턴의 필수 필드 표시. 3경로 동기화 필수.

- **Preview (CSS)**: `renderNecessityIndicator()` — Label 내 `<span class="necessity-indicator">` 렌더링
  - `icon` 모드: `*` (빨간색 `--negative`)
  - `label` 모드: `(required)` 또는 `(optional)` (회색 `--fg-muted`)
- **WebGL (Taffy)**: `fullTreeLayout.ts` Label DFS + `implicitStyles.ts` — Label `children` 텍스트에 indicator 추가
- **WebGL (Skia)**: `ElementSprite.tsx` — `specProps.children`에 indicator 추가
- **에디터**: 통합 Required select (None / Icon / Label) — `isRequired` + `necessityIndicator` 동시 설정
- **공유 유틸**: `Field.tsx`의 `renderNecessityIndicator()`, `NecessityIndicator` 타입
- `LAYOUT_AFFECTING_PROP_KEYS`(계층 A, `stores/utils/layoutInvalidation.ts`) + `LAYOUT_PROP_KEYS`(계층 B, `scene/layoutCache.ts`)에 `necessityIndicator`, `isRequired` 등록 필수 — 둘 다 **props 축**이며 A·B 는 AND (한쪽만 넣으면 무반영). style 축 키라면 계층 B 는 **`LAYOUT_STYLE_KEYS`** 를 쓴다. 심볼명 주의: `LAYOUT_AFFECTING_PROPS`(`_KEYS` 없음)는 코드에 없는 과거 이름. 정본: `.claude/rules/layout-engine.md` §"5-심볼 2계층 체인"

## Collection Item Font 주입 상세 (ListBoxItem/GridListItem)

TextSprite는 store의 원본 `element.props.style`을 직접 읽으므로, implicitStyles(Taffy 전용) 주입만으로는 렌더링에 반영되지 않음.

- ElementSprite `collectionItemFontStyle` selector: 부모가 ListBoxItem/GridListItem이면 Text→"14:600", Description→"12:400" 반환
- `effectiveElementForText` useMemo: `inlineAlertFontStyle` 또는 `collectionItemFontStyle`로 style override
- 기존 InlineAlert 패턴(`inlineAlertFontStyle`)과 동일 구조
- 새 collection 컴포넌트 추가 시 selector 조건에 부모 태그 추가

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

- `_containerWidth`/`_containerHeight` props 주입: ElementSprite에서 `finalWidth`/`finalHeight`를 specProps에 전달
- `CONTAINER_DIMENSION_TAGS` Set (모듈 상수): 주입 대상 태그 O(1) 조회. 새 Spec 추가 시 이 Set에 등록 필수
- 2-pass height 교정: 모든 컨테이너에서 자식 width 제약 → 텍스트 줄바꿈 → height 재계산이 자동 동작 (fullTreeLayout Step 4.5)
- 우측 역산 배치: `containerWidth - border - paddingRight - pad - iconSize/2` (텍스트 폭 추정 금지)
- 정확한 세로 중앙: `containerHeight / 2` (`size.height / 2` 사용 금지 — border 미포함)
- 파이프라인 타이밍 수정 금지: `publishLayoutMap` 동기화, `notifyLayoutChange()` 강제 호출 등 해킹 금지
- 부모 delegation prop 변경 시: `updateSelectedPropertiesWithChildren`으로 부모+자식 atomic batch update
- 상세: [`../rules/spec-container-dimension-injection.md`](../rules/spec-container-dimension-injection.md)

## registryVersion 캐싱

LayoutContainer 'layout' 이벤트에서 `notifyLayoutChange()` 무조건 호출.

## Popover 자식 Taffy 레이아웃 제외

DatePicker/DateRangePicker 내부의 Calendar/RangeCalendar은 Preview에서 Popover로 표시되므로 WebGL Taffy 레이아웃에 참여하면 안 됨.

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
