# Compositional Architecture Patterns

#### CheckboxGroup/RadioGroup Compositional 전환 패턴 (2026-03-02)

CheckboxGroup/RadioGroup은 Card/Select와 동일한 Compositional 패턴을 적용합니다.

**트리 구조**:

```
CheckboxGroup (flex column, gap:12) → Checkbox (flex row, gap:8) → Label
RadioGroup (flex column, gap:12) → Radio (flex row, gap:8) → Label
```

**Checkbox/Radio indicator 공간 확보 — marginLeft 방식**:

Indicator는 spec shapes(Taffy 트리 밖)로 렌더링됩니다. Label 자식에 `marginLeft`를 주입하여 indicator와 겹치지 않도록 합니다.

```typescript
// implicitStyles.ts — Checkbox/Radio 섹션
const parsedGap = parseFloat(String(parentStyle.gap ?? ""));
const userGap = !isNaN(parsedGap) ? parsedGap : indicator.gap;
const indicatorOffset = indicator.box + userGap;

// Label 자식에 marginLeft 주입 (사용자 값 우선)
filteredChildren = filteredChildren.map((child) => ({
  ...child,
  props: {
    ...child.props,
    style: { ...cs, marginLeft: cs.marginLeft ?? indicatorOffset },
  },
}));
```

**CRITICAL — paddingLeft가 아닌 marginLeft을 사용하는 이유**:

| 방식               | fullTreeLayout                                           | per-level | 결론 |
| ------------------ | -------------------------------------------------------- | --------- | ---- |
| 부모 `paddingLeft` | Taffy width 팽창 + BuilderCanvas cachedPadding 이중 적용 | 정상      | ❌   |
| 자식 `marginLeft`  | Taffy가 단일 경로로 위치/크기 계산                       | 정상      | ✅   |

**INDICATOR_SIZES** (spec shapes 기준):

| size | box  | gap  | indicatorOffset |
| ---- | ---- | ---- | --------------- |
| sm   | 16px | 6px  | 22px            |
| md   | 20px | 8px  | 28px            |
| lg   | 24px | 10px | 34px            |

**gap 반응성**: `parentStyle.gap`을 `parseFloat()`로 파싱하여 사용자 스타일 패널 변경이 실시간 반영됩니다. 스타일 패널은 값을 `string`으로 저장하므로 `typeof === 'number'` 체크 대신 `parseFloat()` 필수.

**Synthetic Label**: 기존 DB 요소(Label 자식 없음)를 위해 `applyImplicitStyles`에서 합성 Label 생성 + fullTreeLayout step 3.5에서 Taffy leaf 노드로 추가하여 하위 호환성 보장.

---

#### ComboBox Compositional 전환 패턴 (2026-02-27)

ComboBox는 Select와 동일한 시각적 구조를 가지므로 **기존 Select Spec을 재사용**합니다.

**자식 Element - Spec 재사용 매핑**

| ComboBox 자식 태그 | 재사용 Spec         | 이유                              |
| ------------------ | ------------------- | --------------------------------- |
| `ComboBoxWrapper`  | `SelectTriggerSpec` | 동일한 roundRect 배경 + 보더 구조 |
| `ComboBoxInput`    | `SelectValueSpec`   | 동일한 텍스트 렌더링              |
| `ComboBoxTrigger`  | `SelectIconSpec`    | 동일한 chevron 아이콘 + 배경      |

```typescript
// ElementSprite.tsx — TAG_SPEC_MAP 등록
const TAG_SPEC_MAP: Record<string, SpecClass> = {
  // Select 자식
  SelectTrigger: SelectTriggerSpec,
  SelectValue: SelectValueSpec,
  SelectIcon: SelectIconSpec,
  // ComboBox 자식 — Select Spec 재사용
  ComboBoxWrapper: SelectTriggerSpec,
  ComboBoxInput: SelectValueSpec,
  ComboBoxTrigger: SelectIconSpec,
};
```

**UI_SELECT_CHILD_TAGS 등록 (CRITICAL)**

`getSpriteType()`은 이 Set에 포함된 태그를 `'selectChild'`로 분류합니다.
`spriteType === 'selectChild'`일 때만 `isUIComponent = true` → spec shapes 렌더링 경로 진입.

```typescript
// ElementSprite.tsx (또는 constants.ts)
const UI_SELECT_CHILD_TAGS = new Set([
  // Select 자식 (기존)
  "SelectTrigger",
  "SelectValue",
  "SelectIcon",
  // ComboBox 자식 (신규 등록 필수)
  "ComboBoxWrapper",
  "ComboBoxInput",
  "ComboBoxTrigger",
]);
```

**selectChild 호버 전파 패턴 (2026-02-27)**

Leaf selectChild 요소(SelectValue, SelectIcon, ComboBoxInput, ComboBoxTrigger)는
자신의 ID 대신 **부모 wrapper(SelectTrigger/ComboBoxWrapper)의 ID**로 hover state를 설정합니다.
이렇게 하지 않으면 leaf 영역 hover 시 부모 wrapper의 hover overlay(spec shapes hover variant)가 사라집니다.

```typescript
// ElementSprite.tsx — selectChild leaf 전용 hover 핸들러
const handleSelectChildLeafPointerOver = useCallback(() => {
  if (parentElement) {
    setPreviewState({ elementId: parentElement.id, state: 'hover' });
  } else {
    setPreviewState({ elementId: element.id, state: 'hover' });
  }
}, [element.id, parentElement, setPreviewState]);

// selectChild leaf case에서 사용
case 'selectChild':
  // container (with children) → handlePointerOver (자신의 ID 사용)
  // leaf (no children) → handleSelectChildLeafPointerOver (부모 ID 사용)
```

**selectChild cursor 동적 설정 (2026-02-27)**

selectChild 케이스의 하드코딩 `cursor="pointer"`가 제거되고,
`containerCursor` (element의 CSS cursor 속성 또는 `'default'`)를 사용합니다.
flex/grid 케이스와 동일한 패턴입니다.

```typescript
// ✅ CSS cursor 속성 반영 (ComboBox: spec에서 cursor='text' 정의)
cursor = { containerCursor };

// ❌ 하드코딩 (모든 selectChild에 pointer — ComboBox input에 부적절)
cursor = "pointer";
```

**BuilderCanvas ComboBoxWrapper padding 주입**

Select 패턴과 동일하게 `createContainerChildRenderer`에서 `ComboBoxWrapper`의 내부 자식(`ComboBoxInput`, `ComboBoxTrigger`)에 padding을 주입합니다.

```typescript
// BuilderCanvas.tsx — createContainerChildRenderer
if (tag === "ComboBoxWrapper" || tag === "SelectTrigger") {
  injected.paddingLeft = cs.paddingLeft ?? specDefault;
  injected.paddingRight = cs.paddingRight ?? specDefault;
}
```

**calculateContentHeight isCompositional 플래그**

동적 자식 순회 시 `isCompositional` 플래그로 ComboBox를 Compositional 경로로 분기합니다.

```typescript
// calculateContentHeight 내부
const isCompositional =
  tag === 'combobox' || tag === 'select' || tag === 'card' || /* ... */;

if (isCompositional) {
  // 실제 childElements를 순회하여 높이 합산
  return childElements.reduce((sum, child) => sum + getChildHeight(child), 0)
    + gap * Math.max(childElements.length - 1, 0);
}
```

**ComboBox.spec.ts 방어 패턴**

`_hasChildren` 게이팅으로 자식이 있을 때는 배경 shapes만 렌더링합니다.
`'transparent'` 방어 패턴은 `SelectTriggerSpec`과 동일하게 적용합니다.

```typescript
// ComboBox.spec.ts
shapes(props, variant) {
  const hasChildren = !!(props as Record<string, unknown>)._hasChildren;
  const userBg = props.style?.backgroundColor;
  // 'transparent' 방어: DB에 저장된 기존 값이 spec variant를 덮어쓰지 않도록
  const bgColor = (userBg != null && userBg !== 'transparent')
                ? userBg : variant.background;

  const backgroundShapes: Shape[] = [
    { id: 'bg', type: 'roundRect', fill: bgColor, ... },
  ];

  // 자식이 있으면 배경만 렌더링 (자식 Spec이 나머지 처리)
  if (hasChildren) return backgroundShapes;

  // Monolithic 폴백: 자식 없을 때 전체 렌더링
  return [
    ...backgroundShapes,
    { id: 'input', ... },
    { id: 'trigger', ... },
  ];
},
```

#### Calendar Compositional 전환 패턴 (2026-02-27)

Calendar는 Compositional Architecture로 전환되어 CalendarHeader + CalendarGrid 자식을 가집니다.

**자식 Element 구조**

| Calendar 자식 태그 | 용도                                | 독립 Spec          |
| ------------------ | ----------------------------------- | ------------------ |
| `CalendarHeader`   | nav (prev/next 화살표 + month text) | CalendarHeaderSpec |
| `CalendarGrid`     | weekday labels + date cells         | CalendarGridSpec   |

**Calendar.spec.ts 동작**:

- `_hasChildren=true` → bg shapes만 반환 (standalone 날짜 그리드 shapes 스킵)
- `_hasChildren=false` → 전체 렌더링 (monolithic 폴백)

#### DatePicker Compositional 전환 패턴 (2026-02-27)

DatePicker는 ComboBox 패턴을 따라 **투명 컨테이너**로 전환됩니다.

**자식 Element 구조**

```
DatePicker (투명 컨테이너, shapes 없음)
├── DateField (trigger: bg + border + date text)
└── Calendar (Compositional)
    ├── CalendarHeader
    └── CalendarGrid
```

**DatePicker.spec.ts 동작**:

- `_hasChildren=true` → `return []` (빈 배열, ComboBox 동일 패턴)
- TRANSPARENT_CONTAINER_TAGS에 'DatePicker' 추가

**Factory (DateColorComponents.ts)**:

- DatePicker 부모: `flex column, gap:8px, width:284px` (Calendar intrinsic width)
- DateField 자식: `display:block, width:100%`
- Calendar 자식: nested children (CalendarHeader + CalendarGrid)
- `ChildDefinition` 재귀적 `children?: ChildDefinition[]` 활용

**calculateContentHeight (utils.ts)**:

- `datepicker`: Card 패턴 (자식 높이 합산 + gap)
- `datefield`: intrinsic height (sm=32, md=40, lg=48)
- `treatAsBorderBox`: `isDatePickerElement` 추가

**width parseFloat 수정 (DatePicker.spec.ts)**:

```typescript
// ✅ CSS 문자열 width도 올바르게 파싱
const rawWidth = props.style?.width;
const width =
  typeof rawWidth === "number"
    ? rawWidth
    : typeof rawWidth === "string"
      ? parseFloat(rawWidth) || 220
      : 220;

// ❌ 문자열 width → NaN 또는 0
const width = (props.style?.width as number) || 220;
```

#### CSS 값 일관성 규칙

```typescript
// ✅ 0 값이 유효한 CSS 속성 파싱
const gapParsed =
  typeof gapRaw === "number" ? gapRaw : parseFloat(String(gapRaw ?? ""));
const gap = isNaN(gapParsed) ? defaultGap : gapParsed; // 0은 유효

// ❌ falsy 체크로 0이 기본값으로 대체
const gap = parseFloat(gapRaw) || 8; // gap:0 → 8 (버그!)

// ✅ shorthand + longhand 통합 파싱
const hasUserPadding =
  cs.padding !== undefined ||
  cs.paddingTop !== undefined ||
  cs.paddingBottom !== undefined ||
  cs.paddingLeft !== undefined ||
  cs.paddingRight !== undefined;
const pad = hasUserPadding ? parsePadding(cs) : null;

// ❌ longhand만 체크 (shorthand padding 무시)
const padTop = cs.paddingTop ?? specDefault;
```

#### DEFAULT_ELEMENT_HEIGHTS 주의사항

`DEFAULT_ELEMENT_HEIGHTS`의 하드코딩 값은 Tailwind CSS v4 `line-height: 1.5`와 불일치할 수 있습니다.
TEXT_LEAF_TAGS (label, description 등)는 step 7의 동적 계산(`fontSize * 1.5`)을 사용해야 합니다.

```typescript
// ✅ 동적 계산 (step 7) — DEFAULT_ELEMENT_HEIGHTS에서 제외
// label: fontSize 14 → 14 * 1.5 = 21
const fs = fontSize ?? 16;
return estimateTextHeight(fs, fs * 1.5);

// ❌ 하드코딩 (step 6) — Tailwind line-height:1.5와 불일치
DEFAULT_ELEMENT_HEIGHTS["label"] = 20; // 실제 CSS: 21
```

#### Spec Shapes 배경색 규칙 (CRITICAL)

Compositional Architecture에서 spec shapes가 배경/보더를 렌더링합니다.
Factory 기본값과 토큰 정의가 spec 렌더링을 방해하지 않도록 주의해야 합니다.

**규칙 1: Factory에 `backgroundColor: 'transparent'` 금지**

```typescript
// ❌ factory에서 transparent 주입 → spec variant.background를 override
{ tag: "SelectTrigger", props: { style: { backgroundColor: 'transparent' } } }

// ✅ backgroundColor 미설정 → spec variant가 배경 렌더링
{ tag: "SelectTrigger", props: { style: { display: 'flex', width: '100%' } } }
```

**원인**: spec shapes의 `props.style?.backgroundColor ?? variant.background` 에서
`'transparent'`는 nullish가 아니므로 `??`가 variant로 폴스루하지 않음.

**규칙 2: Spec에서 'transparent' 방어 패턴 필수**

기존 DB 요소에 `backgroundColor: 'transparent'`가 있을 수 있으므로 방어 처리 필수.

```typescript
// ✅ 'transparent'를 미설정으로 처리
const userBg = props.style?.backgroundColor;
const bgColor =
  userBg != null && userBg !== "transparent" ? userBg : variant.background;

// ❌ nullish coalescing만 사용 → 'transparent'가 variant를 override
const bgColor = props.style?.backgroundColor ?? variant.background;
```

**규칙 3: 토큰 이름은 colors.ts 정의와 1:1 매칭 필수**

미정의 토큰은 `resolveToken()` → `undefined` → `colorValueToFloat32()` → **검은색(0,0,0,1)** silent 렌더링.

```typescript
// ✅ colors.ts에 정의된 토큰 사용
background: '{color.surface-container-high}' as TokenRef,

// ❌ 존재하지 않는 토큰 → undefined → 검은색
background: '{color.accent-container}' as TokenRef,  // colors.ts에 미정의!
```

**규칙 4: CSS 배경이 있는 컴포넌트는 spec shapes에 배경 shape 필수**

```typescript
// ✅ CSS에 background가 있으면 spec에도 배경 roundRect 추가
const shapes: Shape[] = [
  { id: 'icon-bg', type: 'roundRect', x: 0, y: 0, width, height, fill: bgColor },
  { type: 'icon_font', iconName: 'chevron-down', ... },
];
```

### Breadcrumbs 컴포넌트 높이 계산 (2026-02-23)

Breadcrumbs는 `display: flex; align-items: center`로 렌더링되며, 높이는 lineHeight와 동일합니다.
`calculateContentHeight`에서 tag 분기를 통해 size별 고정 높이를 반환합니다.

```typescript
// ✅ Breadcrumbs: display:flex, align-items:center — 높이 = lineHeight
if (tag === "breadcrumbs") {
  const BREADCRUMBS_HEIGHTS: Record<string, number> = {
    sm: 16,
    md: 24,
    lg: 24,
  };
  return BREADCRUMBS_HEIGHTS[sizeName] ?? 24;
}

// ❌ 일반 텍스트 높이 계산 경로 사용 — props.children 기반 측정
// → Breadcrumbs는 _crumbs 배열로 렌더링하므로 props.children이 빈 문자열 → 높이 0
```

| size | height |
| ---- | ------ |
| sm   | 16px   |
| md   | 24px   |
| lg   | 24px   |

### Card 컴포넌트 높이 계산 (2026-02-21)

Card는 Heading + Description을 자식 Element로 생성하는 복합 컴포넌트입니다.
아래 3가지 패치가 적용되어야 Card의 높이가 CSS Preview와 일치합니다.

#### TEXT_TAGS에 'Description' 추가 (`ElementSprite.tsx:187`)

`Description`이 `TEXT_TAGS`에 포함되지 않으면 `BoxSprite`로 렌더링되어 텍스트가 표시되지 않습니다.
`Description`은 Card, Dialog, Popover, Tooltip, Form 등 5개 컴포넌트에서 공통으로 사용됩니다.

```typescript
// ✅ TEXT_TAGS에 'Description' 포함 — TextSprite로 렌더링
const TEXT_TAGS = new Set([
  "Heading",
  "Text",
  "Description", // Card, Dialog, Popover, Tooltip, Form에서 사용
  // ...기타 태그
]);

// ❌ TEXT_TAGS 미포함 — BoxSprite로 폴백되어 텍스트 미표시
// Description 엘리먼트가 빈 박스로만 렌더링됨
```

#### `calculateContentHeight` — Card Nested Tree 높이 계산

Card는 3단계 트리 구조로 높이를 재귀 계산합니다:

1. **Card**: childElements(CardHeader, CardContent) 기반 flex column 높이 합산
2. **CardHeader/CardContent**: childElements(Heading/Description/Button 등) 기반 높이 계산 — `flexDirection`에 따라 column=합산, row=max
3. **Heading/Description**: TEXT_LEAF_TAGS로 lineHeight 기반 텍스트 높이

```typescript
// ✅ CardHeader/CardContent: flexDirection에 따라 column=합산+gap, row=max
// 자식의 border-box 높이 사용 (content-box + padding + border)
if (tag === 'cardheader' || tag === 'cardcontent') {
  const isColumn = flexDir === 'column' || flexDir === 'column-reverse';
  const childHeights = childElements.map(child => {
    const contentH = calculateContentHeight(child, ...);
    const childBox = parseBoxModel(child, 0, -1);
    return contentH + childBox.padding.top + childBox.padding.bottom
      + childBox.border.top + childBox.border.bottom;
  });
  return isColumn
    ? childHeights.reduce((sum, h) => sum + h, 0) + gap * (n - 1)  // column: 합산
    : Math.max(...childHeights, 0);  // row: max
}

// ❌ 항상 합산(column 가정) — row 변경 시 높이 초과
// ❌ content-box만 합산 — Button의 padding+border 누락
```

#### `enrichWithIntrinsicSize` — padding/border 주입 규칙 (`utils.ts`)

`enrichWithIntrinsicSize`는 **content-box 높이**를 기본으로 주입합니다.
padding/border 추가 여부는 **CSS에 해당 속성이 정의되어 있는지**와 **태그 유형**으로 결정합니다.

```typescript
// ✅ CSS에 padding이 없으면 spec 기본값을 포함 (레이아웃 엔진이 추가하지 않으므로)
// ✅ INLINE_BLOCK_TAGS는 항상 padding+border 포함 (layoutInlineRun이 border-box로 직접 사용)
if (!isSpecShapesInput && (!hasCSSVerticalPadding || isInlineBlockTag)) {
  injectHeight += box.padding.top + box.padding.bottom;
}
if (!isSpecShapesInput && (!hasCSSVerticalBorder || isInlineBlockTag)) {
  injectHeight += box.border.top + box.border.bottom;
}

// ❌ isTreatedAsBorderBox로 Card/Box/Section에 항상 padding 추가 (제거됨)
// → Dropflow/Taffy가 CSS padding을 또 추가 → 이중 계산
// const isTreatedAsBorderBox = (isCardLike || isSectionLike) && boxSizing !== 'content-box';
// if (isTreatedAsBorderBox || !hasCSSVerticalPadding || isInlineBlockTag) { ... }
```

> **핵심 원칙**: CSS에 padding/border가 있으면 레이아웃 엔진(Dropflow/Taffy)이 처리. enrichment에서 중복 추가 금지.

### convertToFillStyle 기본 배경 투명 패턴 (2026-02-27)

CSS 기본 동작(`background: transparent`)과 일치하도록, `backgroundColor`와 `background` 둘 다 미설정이면
`convertToFillStyle()`은 alpha `0`을 반환합니다.

```typescript
// styleConverter.ts — convertToFillStyle
export function convertToFillStyle(
  style: CSSStyle | undefined,
  resolvedColor?: string,
): RenderFillStyle {
  const bg =
    style?.backgroundColor ??
    ((style as Record<string, unknown> | undefined)?.background as
      | string
      | undefined);
  const color = cssColorToHex(bg, 0xffffff, resolvedColor);
  const alpha =
    style?.opacity !== undefined
      ? parseCSSSize(style.opacity, undefined, 1)
      : bg
        ? cssColorToAlpha(bg, resolvedColor)
        : 0; // ← background 미설정 = transparent (alpha 0)

  return { color, alpha };
}

// ✅ background 미설정 → alpha 0 (CSS 기본 background: transparent)
// ✅ background shorthand도 인식 (style.background)
// ✅ backgroundColor 우선, fallback으로 background shorthand

// ❌ 이전: background 미설정 → alpha 1 (불투명 흰색)
// → CardHeader/CardContent 등 투명 래퍼가 흰색 배경으로 렌더링
```

**영향 범위**: `BoxSprite`, `TextSprite`(renderBox 경로) 등 `convertToFillStyle`을 사용하는 모든 렌더러.
배경을 원하는 요소는 반드시 `backgroundColor` 또는 `background`를 명시적으로 설정해야 합니다.

### TextSprite 렌더링 패턴 (2026-02-26)

TextSprite는 Text, Heading, Description, Label, Paragraph, Link 등 **TEXT_TAGS에 포함된 모든 텍스트 요소**의 Canvas 렌더링을 담당합니다.

#### CSS half-leading 재현 (`nodeRenderers.ts`)

CSS `line-height`는 extra leading을 텍스트 **상하 균등 분배** (half-leading)하여 세로 중앙 정렬합니다.
CanvasKit의 `heightMultiplier`는 기본적으로 extra leading을 **하단에만** 추가하므로, 반드시 `halfLeading: true`를 함께 설정해야 합니다.

```typescript
// ✅ halfLeading: true → CSS line-height와 동일한 상하 균등 분배
{ heightMultiplier: heightMultiplierOpt, halfLeading: true }

// ❌ halfLeading 없음 → extra leading이 하단에만 추가, 텍스트가 위로 치우침
{ heightMultiplier: heightMultiplierOpt }
```

#### 문자열 lineHeight 배수 값 파싱 (`styleConverter.ts`)

CSS `line-height`는 단위 없는 숫자일 때 배수 값입니다 (예: `"1.4"` = fontSize의 1.4배).
`convertToTextStyle()`에서 문자열 배수 값을 픽셀 값으로 오인하면 `leading = 0`이 되어 halfLeading이 적용되지 않습니다.

```typescript
// ✅ 문자열 배수 값도 올바르게 판별 ("1.4", "1.5" 등)
const isMultiplier =
  lh < 10 &&
  (typeof style.lineHeight === "number" ||
    (typeof style.lineHeight === "string" &&
      /^\d*\.?\d+$/.test(style.lineHeight.trim())));
if (isMultiplier) {
  leading = (lh - 1) * fontSize; // 배수: (1.4 - 1) * 16 = 6.4
}

// ❌ typeof === 'number' 만 체크 → 문자열 "1.4"가 픽셀로 처리
// leading = max(0, 1.4 - 16) = 0 → lineHeight 미전달 → halfLeading 미적용
```

**영향 범위**: 이 설정은 `renderText()` 함수에 위치하며, TextSprite 경로와 Spec shapes 텍스트 경로 **모두**에 적용됩니다:

- TextSprite → `useSkiaNode` → `renderText()` (Text, Heading, Description 등)
- Spec shapes → `specShapeConverter` → `renderText()` (Button, Badge, Input 등)

#### Text 요소의 display:flex 처리 (`ElementSprite.tsx`, `TextSprite.tsx`)

Text는 leaf 요소이므로 `display: flex`를 적용해도 항상 **TextSprite**로 렌더링해야 합니다.
`getSpriteType()`에서 TEXT_TAGS/IMAGE_TAGS 체크는 flex/grid 체크보다 **위에** 배치합니다.

```typescript
// ✅ TEXT/IMAGE 우선 → leaf 요소는 display 값과 무관하게 전용 Sprite
if (TEXT_TAGS.has(tag)) return "text";
if (IMAGE_TAGS.has(tag)) return "image";
if (isFlexContainer(element)) return "flex"; // 컨테이너만 도달

// ❌ flex/grid 먼저 → Text+display:flex가 BoxSprite로 렌더링, 텍스트 사라짐
if (isFlexContainer(element)) return "flex";
if (TEXT_TAGS.has(tag)) return "text";
```

Text에 flex 속성(justify-content, align-items)이 있으면 TextSprite의 `flexAlignment` memo에서 텍스트 수평/수직 정렬로 매핑합니다.

#### width:fit-content 텍스트 측정 (`utils.ts`, `TextSprite.tsx`)

- `calculateContentWidth()`: 실제 fontFamily, fontWeight, letterSpacing을 사용하여 측정 (기본값 사용 금지)
- TextSprite `wordWrapWidth`: 항상 `transform.width` 사용 (FIT_CONTENT sentinel `-2`가 누출되지 않도록)

### Container Props 주입 패턴 (CONTAINER_PROPS_INJECTION)

복합 컨테이너 컴포넌트에서 **부모 element의 props 값을 자식 Element의 `props.children`에 주입**하는 패턴입니다.
Tabs의 `_tabLabels`와 Card의 `heading/description`이 이 패턴을 따릅니다.

**패턴이 필요한 이유**: Editor(Properties Panel)는 부모 컨테이너의 props를 업데이트하지만, WebGL TextSprite는 자식 Element의 `props.children`을 읽어 렌더링합니다. 두 데이터 소스가 분리되어 있으므로, `createContainerChildRenderer` 내부에서 부모 props를 자식 props에 주입해야 동기화됩니다.

```typescript
// BuilderCanvas.tsx — createContainerChildRenderer 내부
// 패턴: containerTag 확인 → 부모 props 추출 → 자식 effectiveChildEl 생성

// ✅ Tabs: _tabLabels 주입 (기존 패턴)
if (containerTag === "Tabs") {
  effectiveChildEl = {
    ...childEl,
    props: { ...childEl.props, _tabLabels: tabsElement.props._tabLabels },
  };
}

// ✅ Card: title/description → Heading/Description 자식에 주입 (2026-02-26 heading 제거)
if (containerTag === "Card") {
  const cardProps = containerElement.props;
  if (childEl.tag === "Heading") {
    const headingText = cardProps?.title;
    if (headingText != null) {
      effectiveChildEl = {
        ...childEl,
        props: { ...childEl.props, children: String(headingText) },
      };
    }
  } else if (childEl.tag === "Description") {
    const descText = cardProps?.description;
    if (descText != null) {
      effectiveChildEl = {
        ...childEl,
        props: { ...childEl.props, children: String(descText) },
      };
    }
  }
}

// ❌ 주입 없이 자식 element의 초기값(factory 생성 시점 값)만 사용
// → CardEditor에서 heading/description을 변경해도 WebGL Canvas에 반영되지 않음
```

**주입 규칙 요약**:

| 컨테이너                                                                                         | 부모 props 키                | 대상 자식 tag | 주입 대상 prop |
| ------------------------------------------------------------------------------------------------ | ---------------------------- | ------------- | -------------- |
| `Tabs`                                                                                           | `_tabLabels`                 | `Tab`         | `_tabLabels`   |
| `Card`                                                                                           | `title`                      | `Heading`     | `children`     |
| `Card`                                                                                           | `description`                | `Description` | `children`     |
| Input Fields (`TextField`, `NumberField`, `SearchField`, `DateField`, `TimeField`, `ColorField`) | `label`                      | `Label`       | `children`     |
| Overlay (`Dialog`, `Popover`, `Tooltip`, `Toast`)                                                | `heading` 또는 `title`       | `Heading`     | `children`     |
| Overlay (`Dialog`, `Popover`, `Tooltip`, `Toast`)                                                | `description` 또는 `message` | `Description` | `children`     |

**새 컨테이너 컴포넌트에 이 패턴을 적용할 때 체크리스트**:

1. Editor가 업데이트하는 부모 props 키 확인
2. TextSprite가 읽는 자식 Element의 prop 확인 (보통 `children`)
3. `createContainerChildRenderer` 내 `containerTag === 'XXX'` 분기 추가
4. fallback: 부모 props 값이 `null`/`undefined`이면 자식 초기값 유지

상세 내용: [layout details](../reference/layout-details.md)
