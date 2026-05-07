---
title: Use Correct Display Mode for Hybrid Layout Engine
impact: CRITICAL
impactDescription: 올바른 레이아웃 엔진 선택, CSS 호환 배치
tags: [pixi, layout, canvas, hybrid-engine]
---

하이브리드 레이아웃 엔진은 `display` 값에 따라 자동으로 엔진을 선택합니다.
올바른 display를 지정해야 CSS와 동일한 배치 결과를 얻을 수 있습니다.

### 엔진 선택 규칙

| display 값            | 엔진                         | 설명                                   |
| --------------------- | ---------------------------- | -------------------------------------- |
| `block` (기본값)      | DropflowBlockEngine          | 수직 쌓임, width 100%, margin collapse |
| `inline-block`        | DropflowBlockEngine          | 가로 배치, 줄바꿈, vertical-align      |
| `inline`              | DropflowBlockEngine          | 인라인 포매팅                          |
| `flow-root`           | DropflowBlockEngine          | BFC 생성 (margin collapse 차단)        |
| `flex`, `inline-flex` | TaffyFlexEngine (Taffy WASM) | Flexbox 레이아웃                       |
| `grid`, `inline-grid` | TaffyGridEngine (Taffy WASM) | 2D 그리드 레이아웃                     |

### WASM 활성화 요구사항

Taffy 엔진은 Rust WASM이 로드되어야 활성화됩니다:

- `WASM_FLAGS.LAYOUT_ENGINE`이 `true`여야 `initRustWasm()` 호출
- `isRustWasmReady()`가 `true`일 때만 TaffyFlexEngine/TaffyGridEngine 사용
- WASM 미로드 시 모든 display 모드가 DropflowBlockEngine으로 안전 폴백

```typescript
// engines/index.ts — WASM 폴백 예시
export function selectEngine(display: string | undefined): LayoutEngine {
  const wasmReady = isRustWasmReady();
  switch (display) {
    case "flex":
    case "inline-flex":
      return wasmReady ? taffyFlexEngine : dropflowBlockEngine;
    // ...
  }
}
```

### 지원 CSS 속성

- **Box Model**: `boxSizing`, `minWidth`, `maxWidth`, `minHeight`, `maxHeight`
- **Intrinsic Sizing**: `width: fit-content` (FIT_CONTENT sentinel, Block/Flex 양쪽 지원)
- **Overflow/BFC**: `overflow`, `overflowX`, `overflowY` (applyCommonTaffyStyle에서 Taffy 전달)
- **Typography**: `lineHeight`, `verticalAlign`
- **Visibility**: `visibility: hidden` (공간 유지, 렌더링 안 함)
- **Grid 자식**: `alignSelf`, `justifySelf`
- **Aspect Ratio**: `aspectRatio` (applyCommonTaffyStyle에서 Taffy 전달)
- **Flex Item**: `flex`, `flexGrow`, `flexShrink`, `flexBasis`, `order` (applyFlexItemProperties — 부모가 flex/grid일 때 모든 자식에 적용)

### fit-content 처리 규칙

`width: fit-content`는 두 가지 경로에서 처리됩니다:

| 경로                         | 처리 방식                                                           |
| ---------------------------- | ------------------------------------------------------------------- |
| DropflowBlockEngine          | `FIT_CONTENT = -2` sentinel → `contentWidth` 사용                   |
| TaffyFlexEngine (Taffy WASM) | Taffy가 `width:auto` + Yoga wrapper에서 `flexGrow:0 + flexShrink:0` |
| TaffyGridEngine (Taffy WASM) | Taffy가 `width:auto` 처리                                           |

```typescript
// ✅ parseSize가 'fit-content' → FIT_CONTENT(-2) 반환
// DropflowBlockEngine: contentWidth 기반 크기 계산
// TaffyFlexEngine: auto + flexGrow:0 + flexShrink:0로 에뮬레이션

// ❌ fit-content를 수동으로 auto나 px로 변환하지 말 것
```

### fit-content와 alignSelf 독립성

CSS에서 `width: fit-content`와 `align-self`는 완전히 독립적인 속성입니다.
Yoga 워크어라운드에서 `alignSelf: 'flex-start'`를 강제 설정하면 부모의 `align-items`가 무시됩니다.

```typescript
// ✅ fit-content 워크어라운드: flexGrow/flexShrink만 설정
// alignSelf는 설정하지 않음 → 부모의 align-items가 교차축 정렬 결정
if (width === undefined && !isFitContentWidth) {
  layout.flexGrow = 0;
  layout.flexShrink = 0;
}

// ❌ alignSelf 강제 설정 → 부모의 align-items: center 등이 무시됨
if (width === undefined && !isFitContentWidth) {
  layout.flexGrow = 0;
  layout.flexShrink = 0;
  layout.alignSelf = "flex-start"; // 부모 align-items 덮어씀!
}
```

### CSS Display Level 3: 자식 display vs flex/grid item (2026-03-01 추가, CRITICAL)

**CSS 원칙**: flex/grid 부모의 모든 자식은 자신의 display와 무관하게 flex/grid item으로 참여한다. 자식의 display는 **내부** formatting context만 결정하고, flex item 속성(`flex`, `flexGrow`, `flexShrink`, `flexBasis`, `order`)은 별도로 적용된다.

`fullTreeLayout.ts`의 `buildNodeStyle()`은 `parentDisplay` 파라미터로 부모의 display를 받아, 부모가 flex/grid이면 block/grid 경로 자식에게도 flex item 속성을 주입한다.

```typescript
// fullTreeLayout.ts — buildNodeStyle()
// block 경로에서도 부모가 flex/grid이면 flex item 속성 적용
const record = taffyStyleToRecord(taffyStyle);
if (FLEX_GRID_DISPLAYS.has(parentDisplay)) {
  applyFlexItemProperties(record, style); // utils.ts 공유 함수
}

// ❌ block 자식이라고 flex item 속성 무시 → flex:1이 적용 안 됨
// 예: SelectTrigger(flex) → SelectValue(block, flex:1) → width=0
```

**`applyFlexItemProperties()` (utils.ts)**: flex shorthand 파싱 공유 함수.

- TaffyFlexEngine, fullTreeLayout block 경로, grid 경로에서 모두 사용
- taffyConfig 우선: shorthand가 이미 설정된 값을 덮어쓰지 않음
- 개별 속성(flexGrow 등)은 shorthand/taffyConfig 모두를 덮어씀 (CSS cascade)

### CSS height:auto 처리 (2026-03-01 추가)

`fullTreeLayout.ts`에서 컨테이너와 리프의 높이를 다르게 처리합니다:

```typescript
// 컨테이너 (hasTaffyChildren): enrichment가 주입한 height를 제거 → Taffy가 자식 기반 auto 계산
if (hasTaffyChildren && (!originalHeight || originalHeight === 'auto')) {
  // enrichedStyle에서 height만 제거, width 등은 유지
  const { height: _, ...restStyle } = enrichedStyle;
}

// 리프 (!hasTaffyChildren): calculateContentHeight로 intrinsic height 보완
if (!enrichedStyle.height && (!elementStyle.height || elementStyle.height === 'auto')) {
  const intrinsicHeight = calculateContentHeight(element, ...);
  // border-box 높이로 변환하여 주입
}
```

**핵심**: `hasTaffyChildren`은 `childIds.length > 0`으로 판단. 컨테이너는 Taffy가 자식 기반으로 높이를 자동 계산하므로 enrichment 높이를 제거해야 한다.

### flex shorthand 파싱 (2026-02-22 추가, 2026-03-01 일반화)

`applyFlexItemProperties()` (utils.ts) 공유 함수에서 CSS `flex` shorthand를 `flexGrow`, `flexShrink`, `flexBasis`로 분해합니다. TaffyFlexEngine과 fullTreeLayout 양쪽에서 사용됩니다.

| flex 값             | flexGrow | flexShrink | flexBasis |
| ------------------- | -------- | ---------- | --------- |
| `flex: 1` (number)  | 1        | 1          | 0%        |
| `flex: "auto"`      | 1        | 1          | auto      |
| `flex: "none"`      | 0        | 0          | auto      |
| `flex: "2 0 100px"` | 2        | 0          | 100px     |

**우선순위**: 개별 속성(`flexGrow`, `flexShrink`, `flexBasis`)이 명시되어 있으면 shorthand보다 우선.

```typescript
// ✅ flex shorthand는 개별 속성의 fallback으로 동작
style: { flex: 1 }  // → flexGrow:1, flexShrink:1, flexBasis:0%
style: { flex: 1, flexGrow: 2 }  // → flexGrow:2 (개별 속성 우선)

// ❌ flex shorthand 없이 개별 속성 미지정 → flexGrow 기본값 0
style: { fontSize: 14 }  // → flexGrow:0 (Taffy 기본값)
```

## Incorrect

```tsx
// ❌ block 의도인데 flex로 워크어라운드
<Container style={{
  display: 'flex',
  flexDirection: 'column',
}}>
  <Container style={{ height: 100, marginBottom: 20 }} />
  <Container style={{ height: 100, marginTop: 30 }} />
  {/* flex에서는 margin collapse 안 됨 → 간격 50px */}
</Container>

// ❌ grid 자식에 flex용 alignSelf 사용
<Container style={{ display: 'grid', gridTemplateColumns: '1fr 1fr' }}>
  <Container style={{ alignSelf: 'flex-end' }} />
</Container>

// ❌ blockification 무시 (flex 부모의 inline-block 자식)
<Container style={{ display: 'flex' }}>
  <Container style={{ display: 'inline-block', width: 100 }} />
  {/* flex/grid 부모의 자식은 자동 blockify → inline-block이 block으로 변환됨 */}
</Container>
```

## Correct

```tsx
// ✅ block 레이아웃: 수직 쌓임 + margin collapse
<Container style={{ display: 'block' }}>
  <Container style={{ height: 100, marginBottom: 20 }} />
  <Container style={{ height: 100, marginTop: 30 }} />
  {/* margin collapse → 간격 30px (큰 값) */}
</Container>

// ✅ inline-block: 가로 배치 + 줄바꿈
<Container style={{ display: 'block' }}>
  <Container style={{ display: 'inline-block', width: 150, height: 50 }} />
  <Container style={{ display: 'inline-block', width: 150, height: 80 }} />
  {/* 부모 너비에 따라 자동 줄바꿈, vertical-align 적용 */}
</Container>

// ✅ grid 자식에 올바른 self 정렬
<Container style={{ display: 'grid', gridTemplateColumns: '1fr 1fr' }}>
  <Container style={{ justifySelf: 'center', alignSelf: 'end' }} />
</Container>

// ✅ BFC로 margin collapse 차단
<Container style={{ display: 'block' }}>
  <Container style={{ height: 100, marginBottom: 20 }} />
  <Container style={{ overflow: 'hidden', height: 100, marginTop: 30 }} />
  {/* BFC 요소는 margin collapse 안 함 → 간격 50px */}
</Container>

// ✅ box-sizing: border-box
<Container style={{
  width: 200,
  padding: 20,
  boxSizing: 'border-box',
  // content width = 200 - 40 = 160px
}} />
```

## Box Model 처리

### availableWidth 계산: padding + border 차감

`renderWithCustomEngine`에서 부모의 content-box 크기를 계산할 때 **padding과 border 모두 차감** 필수:

```typescript
// ✅ availableWidth = 부모 크기 - padding - border
const parentPadding = parsePadding(parentStyle);
const parentBorder = parseBorder(parentStyle);
const availableWidth =
  pageWidth -
  parentPadding.left -
  parentPadding.right -
  parentBorder.left -
  parentBorder.right;
```

### 자식 offset: padding만 적용 (border 제외)

⚠️ Yoga(@pixi/layout)가 `position: absolute` 자식을 padding box 내에 자동 배치하므로, **border offset을 추가하면 이중 적용**:

```typescript
// ✅ padding만 적용 (Yoga가 border offset 자동 처리)
left: layout.x + parentPadding.left,
top: layout.y + parentPadding.top,

// ❌ border 추가 → 이중 적용 (borderWidth만큼 여백 발생)
left: layout.x + parentPadding.left + parentBorder.left,
```

### Flex parent passthrough (center/alignment)

부모가 명시적 `display: flex`일 때, Yoga wrapper에 부모의 flex 속성을 전달하여 center/alignment가 올바르게 동작합니다:

```typescript
// ✅ isParentExplicitFlex일 때 부모 flex 속성을 wrapper에 전달
const parentFlexProps = isParentExplicitFlex
  ? {
      flexDirection: parentStyle?.flexDirection ?? "row",
      justifyContent: parentStyle?.justifyContent,
      alignItems: parentStyle?.alignItems,
      gap: parentStyle?.gap,
    }
  : {};

// ❌ 항상 flexDirection: column, alignItems: flex-start 강제
// → 부모의 justify-content: center, align-items: center가 무시됨
```

### 퍼센트 크기 해석 (resolveLayoutSize)

`width: '100%'` 등 퍼센트 문자열은 `resolveLayoutSize()` 헬퍼로 부모 크기 기준 해석:

```typescript
// ✅ resolveLayoutSize로 퍼센트 값 해석
resolveLayoutSize(containerLayout.width, parentWidth);
// '100%' + parentWidth=800 → 800

// ❌ typeof 체크로 0 폴백
typeof containerLayout.width === "number" ? containerLayout.width : 0;
// '100%' → 0 (문자열이므로)
```

### content-box 기준 높이 계산

`calculateContentHeight`는 **순수 텍스트 높이만 반환**, padding/border는 호출 측(DropflowBlockEngine)에서 합산:

```typescript
// ✅ contentHeight = 텍스트 높이만
// MIN_BUTTON_HEIGHT는 border-box → content-box 변환 후 비교
const minContentHeight = Math.max(
  0,
  MIN_BUTTON_HEIGHT - paddingY * 2 - borderWidth * 2,
);
return Math.max(textHeight, minContentHeight);

// ❌ padding 포함 → DropflowBlockEngine에서 이중 계산
return Math.max(paddingY * 2 + textHeight, MIN_BUTTON_HEIGHT);
```

### 폼 요소 자동 border-box (`treatAsBorderBox`)

`button`, `input`, `select`에 명시적 `width`/`height` 설정 시 **border-box로 취급** — `parseBoxModel`이 padding+border를 자동 차감:

```typescript
// ✅ parseBoxModel 내부 — 폼 요소는 명시적 크기를 border-box로 해석
const treatAsBorderBox =
  boxSizing === "border-box" ||
  (isFormElement && (width !== undefined || height !== undefined));

if (treatAsBorderBox && width !== undefined) {
  width = Math.max(0, width - paddingH - borderH); // content-box로 변환
}
```

### Card/Box/Section border-box 처리

`Card`, `Box`, `Section`은 CONTAINER_TAGS이면서 동시에 border-box로 취급됩니다. 사용자가 명시적 높이를 지정할 때 padding과 border를 포함한 값을 입력하므로, `enrichWithIntrinsicSize`에서 주입하는 높이에도 동일한 방식이 적용되어야 합니다.

```typescript
// ✅ parseBoxModel 내부 — Card/Box/Section 명시적 크기를 border-box로 해석
const isTreatedAsBorderBox =
  boxSizing === "border-box" ||
  (isFormElement && (width !== undefined || height !== undefined)) ||
  ((type === "card" || type === "box" || type === "section") &&
    boxSizing !== "content-box");

if (isTreatedAsBorderBox && width !== undefined) {
  width = Math.max(0, width - paddingH - borderH); // content-box로 변환
}

// ✅ enrichWithIntrinsicSize — Card 주입 높이에 padding+border 포함
// calculateContentHeight가 content-box 기준 값을 반환하므로
// border-box 변환은 호출 측에서 합산
const contentH = calculateContentHeight(element, availableWidth);
const intrinsicH = contentH + paddingY * 2 + borderWidth * 2; // border-box 높이
```

**CONTAINER_TAGS 중 border-box 대상**:

| 태그      | 이유                                    |
| --------- | --------------------------------------- |
| `card`    | 사용자 정의 높이가 항상 border-box 기준 |
| `box`     | card와 동일 구조                        |
| `section` | 페이지 섹션 컨테이너, border-box 기준   |

```typescript
// ❌ Card에 content-box 기준 높이 주입 → 실제 크기보다 padding+border만큼 커짐
const intrinsicH = calculateContentHeight(element, availableWidth); // content-box만
```

### CONTAINER_TAGS의 Card 자식 처리 방식

Card는 CONTAINER_TAGS에 등록된 복합 컨테이너로, `title`/`description` 같은 시각적 텍스트를 spec shapes로 직접 렌더링하지 않고 **Heading/Description 자식 Element**로 분리하여 렌더링합니다.

이 구조에서 `calculateContentHeight`가 자식 요소의 높이를 합산할 때 childElements를 우선 사용해야 합니다:

```typescript
// ✅ Card: childElements 기반 높이 계산 우선
// LayoutContext.getChildElements로 실제 자식 Element 목록 조회
const children = context.getChildElements?.(element.id) ?? [];
if (type === "card" && children.length > 0) {
  // 각 자식(Heading, Description 등)의 높이를 합산하여 Card 전체 높이 결정
  const childrenTotalHeight = sumChildHeights(
    children,
    availableWidth,
    context,
  );
  return Math.max(childrenTotalHeight, minHeight);
}

// ❌ Card에서 childElements 무시 → 자식 내용에 따른 높이 자동 확장 안 됨
return calculateTextHeight(element, availableWidth);
```

**핵심 규칙**:

- Card의 `enrichWithIntrinsicSize`는 `context.getChildElements`로 자식 목록을 받아 높이를 계산
- Heading/Description은 TEXT_TAGS에 포함되어 각자 TextSprite 경로로 크기가 결정됨
- Card 자체의 spec shapes는 배경/테두리/그림자만 담당 (텍스트 미포함)

### Container Props 주입 패턴 (CONTAINER_PROPS_INJECTION)

복합 컨테이너 컴포넌트에서 **부모 element의 props 값을 자식 Element의 props에 주입**하는 패턴입니다.
Editor(Properties Panel)가 업데이트하는 부모 props와 TextSprite가 읽는 자식 `props.children`을 동기화합니다.

**배경**: CardEditor는 `Card.props.heading`/`description`을 업데이트하지만, WebGL TextSprite는 자식 Heading/Description Element의 `props.children`을 읽습니다. factory 생성 시점의 초기값이 자식 element에 고정되므로, `createContainerChildRenderer`에서 렌더링 시점에 부모 props를 주입해야 합니다.

```typescript
// BuilderCanvas.tsx — createContainerChildRenderer 내부

// ✅ Tabs: _tabLabels 주입 (기존 패턴)
// Tabs element의 _tabLabels prop을 각 Tab 자식에 전달
if (containerType === "Tabs") {
  effectiveChildEl = {
    ...childEl,
    props: { ...childEl.props, _tabLabels: tabsElement.props._tabLabels },
  };
}

// ✅ Card: heading/description → Heading/Description 자식에 주입 (2026-02-21 추가)
// CardEditor가 Card.props를 변경해도 자식 element는 그대로이므로
// renderring 시점에 부모 props를 자식에 반영
if (containerType === "Card") {
  const cardProps = containerElement.props;
  if (childEl.type === "Heading") {
    const headingText = cardProps?.heading ?? cardProps?.title;
    if (headingText != null) {
      effectiveChildEl = {
        ...childEl,
        props: { ...childEl.props, children: String(headingText) },
      };
    }
  } else if (childEl.type === "Description") {
    const descText = cardProps?.description;
    if (descText != null) {
      effectiveChildEl = {
        ...childEl,
        props: { ...childEl.props, children: String(descText) },
      };
    }
  }
}

// ❌ 주입 없이 자식 element의 factory 초기값만 사용
// → Properties Panel에서 Card 텍스트를 변경해도 WebGL Canvas에 미반영
```

**컨테이너별 주입 규칙 요약**:

| 컨테이너 | 부모 props 키          | 대상 자식 type | 주입 대상 prop | 비고                              |
| -------- | ---------------------- | -------------- | -------------- | --------------------------------- |
| `Tabs`   | `_tabLabels`           | `Tab`          | `_tabLabels`   | 동적 탭 레이블 배열               |
| `Card`   | `heading` 또는 `title` | `Heading`      | `children`     | `heading` 우선, 없으면 `title`    |
| `Card`   | `description`          | `Description`  | `children`     | null/undefined면 자식 초기값 유지 |

**새 컨테이너에 이 패턴을 적용할 때 체크리스트**:

1. Editor가 업데이트하는 부모 element props 키 확인
2. TextSprite가 읽는 자식 Element의 prop 확인 (대부분 `children`)
3. `createContainerChildRenderer` 내 `containerType === 'XXX'` 분기 추가
4. `effectiveChildEl`을 spread 방식으로 생성 (원본 immutability 유지)
5. 부모 props 값이 `null`/`undefined`이면 주입하지 않아 자식 초기값 유지

**CSS Preview 동기화**: `LayoutRenderers.tsx`의 CSS Preview 렌더러에도 동일한 props 전달이 필요합니다. WebGL Canvas와 CSS Preview가 같은 소스(부모 props)를 사용해야 동일한 텍스트가 표시됩니다.

```typescript
// LayoutRenderers.tsx — CSS Preview Card 렌더러
// ✅ heading, subheading, footer props를 명시적으로 전달
<CardComponent
  heading={element.props.heading ?? element.props.title}
  description={element.props.description}
  subheading={element.props.subheading}
  footer={element.props.footer}
  {...otherProps}
/>

// ❌ props spread만 사용 — heading 등이 CSS Preview에서 누락됨
<CardComponent {...element.props} />
// → CardComponent가 특정 prop 이름을 기대할 때 mapping 없이는 미전달
```

### Select/ComboBox 자식 implicit styles 주입 (2026-02-22 추가)

Select/ComboBox의 CONTAINER_TAGS 자식(SelectTrigger, ComboBoxWrapper) 내부 요소에는
레이아웃 계산 전에 implicit styles를 주입해야 합니다.

**이유**: DB에 저장된 기존 요소에 `width`, `height`, `flex` 속성이 없을 수 있으며,
`calculateChildrenLayout` 호출 시 원본 DB 스타일이 사용되므로 implicit styles가 없으면
레이아웃 크기가 0으로 계산 → BoxSprite가 100×100 기본값으로 fallback.

**주입 위치 2곳** (BuilderCanvas.tsx `createContainerChildRenderer`):

1. **레이아웃 계산 전**: `filteredContainerChildren`에 implicit styles 합성
2. **렌더링 시**: `effectiveChildEl` 투명 배경 override 블록에서 tag별 implicitStyle spread

```typescript
// ✅ SelectTrigger 내부 자식 implicit styles (레이아웃 계산 전)
if (containerType === 'selecttrigger') {
  filteredContainerChildren = filteredContainerChildren.map(child => {
    const cs = (child.props?.style || {}) as Record<string, unknown>;
    if (child.type === 'SelectValue') {
      return { ...child, props: { ...child.props, style: { ...cs, flex: cs.flex ?? 1 } } };
    }
    if (child.type === 'SelectIcon') {
      return { ...child, props: { ...child.props, style: { ...cs, width: cs.width ?? 18, height: cs.height ?? 18, flexShrink: cs.flexShrink ?? 0 } } };
    }
    return child;
  });
}

// ✅ 렌더링 시 implicit styles + 투명 배경 (spec shapes가 시각 렌더링 담당)
const implicitStyle =
  (type === 'SelectIcon' || type === 'ComboBoxTrigger')
    ? { width: 18, height: 18, flexShrink: 0 }
    : (type === 'SelectValue' || type === 'ComboBoxInput')
      ? { flex: 1 }
      : {};
style: { ...implicitStyle, ...existingStyle, backgroundColor: 'transparent' }
```

**적용 대상**:

| 컨테이너        | 자식 태그       | implicit styles                        |
| --------------- | --------------- | -------------------------------------- |
| SelectTrigger   | SelectValue     | `flex: 1`                              |
| SelectTrigger   | SelectIcon      | `width: 18, height: 18, flexShrink: 0` |
| ComboBoxWrapper | ComboBoxInput   | `flex: 1`                              |
| ComboBoxWrapper | ComboBoxTrigger | `width: 18, height: 18, flexShrink: 0` |

### CONTAINER_TAGS + inline-block 컴포넌트 Selection 크기

CONTAINER_TAGS(Card, Panel, ToggleButtonGroup, Tabs 등)는 `renderWithCustomEngine`에서 `containerLayout.width = layout.width`로 Yoga LayoutContainer에 DropflowBlockEngine 계산 결과를 전달합니다.

**문제**: inline-block인 CONTAINER_TAG 컴포넌트의 `contentWidth`가 정확하지 않으면 selection bounds가 잘못됨.

```typescript
// ✅ ToggleButtonGroup: 명시적 width 설정 여부에 따라 분기
// - 명시적 width (100%, 200px 등): DropflowBlockEngine이 계산한 layout.width 사용
// - 기본값 (fit-content/미지정): Yoga가 자식 크기에 맞춰 자동 계산
const hasExplicitWidth =
  isToggleButtonGroup &&
  childStyle?.width !== undefined &&
  childStyle.width !== "fit-content";
const toggleGroupWidthOverride = isToggleButtonGroup
  ? hasExplicitWidth
    ? { width: layout.width }
    : { width: "auto", flexGrow: 0, flexShrink: 0 }
  : { width: layout.width };

// ❌ 무조건 'auto' 오버라이드 → width: 100% 등 명시적 설정이 무시됨
const toggleGroupWidthOverride = isToggleButtonGroup
  ? { width: "auto", flexGrow: 0, flexShrink: 0 }
  : { width: layout.width };
```

**calculateContentWidth에 컴포넌트별 분기 필요**:
`engines/utils.ts`의 `calculateContentWidth()`에서 `props.items` 등 컴포넌트 고유 데이터를 기반으로 실제 콘텐츠 폭을 계산해야 합니다.

### Canvas 2D ↔ CanvasKit 폭 측정 오차 보정 (CRITICAL)

`calculateContentWidth`(utils.ts)는 내부적으로 Canvas 2D `measureText` API를 사용합니다.
CanvasKit paragraph API는 내부 레이아웃 방식이 달라 동일한 텍스트를 표시하는 데 더 넓은 폭이 필요합니다.
보정 없이 Canvas 2D 측정값을 그대로 사용하면 CanvasKit 렌더링 시 텍스트가 의도치 않게 wrapping됩니다.

**규칙**: 모든 텍스트 폭 계산 경로에 `Math.ceil() + 2` 보정을 적용합니다.

```typescript
// engines/utils.ts — calculateContentWidth

// ✅ INLINE_FORM 경로 (line 718-719): 이미 보정 적용됨
const textWidth =
  Math.ceil(calculateTextWidth(labelText, fontSize, fontFamily)) + 2;

// ✅ 일반 텍스트 경로 (line 759-760): 동일하게 보정 적용 (2026-02-22 추가)
// TagGroup label, Button 등 단일 텍스트 측정 경로
const textWidth = Math.ceil(calculateTextWidth(text, fontSize, fontFamily)) + 2;

// ❌ 보정 없이 Canvas 2D 원시 측정값 사용
const textWidth = calculateTextWidth(text, fontSize, fontFamily);
// → CanvasKit paragraph API가 더 넓은 폭을 요구하여 텍스트 wrapping 발생
```

**두 경로는 반드시 동일한 보정 패턴을 사용해야 합니다.**
새 텍스트 폭 계산 경로를 추가할 때 이 보정을 빠뜨리면 Canvas 2D에서는 정상인데 CanvasKit에서만 줄바꿈이 발생하는 버그가 생깁니다.

| 경로             | 위치                  | 보정 적용 여부         |
| ---------------- | --------------------- | ---------------------- |
| INLINE_FORM 경로 | utils.ts line 718-719 | 적용 (기존)            |
| 일반 텍스트 경로 | utils.ts line 759-760 | 적용 (2026-02-22 추가) |

### 스타일 패널 display 기본값 (styleAtoms)

`styleAtoms.ts`의 layout atoms는 `getLayoutDefault()` 4단계 우선순위를 따릅니다:

1. inline style → 2. computed style → 3. `DEFAULT_CSS_VALUES[type]` → 4. global default

```typescript
// ✅ DEFAULT_CSS_VALUES에 컴포넌트별 CSS 기본값 등록
ToggleButtonGroup: { width: 'fit-content', display: 'flex', flexDirection: 'row', alignItems: 'center' }

// ❌ atom에서 하드코딩된 'block' 폴백만 사용
// → 런타임 기본값이 스타일 패널에 반영되지 않음
```

### Factory 정의와 getDefaultProps style 동기화

복합 컴포넌트(children 포함)는 `ComponentFactory` → `factories/definitions/*.ts`로 생성됩니다.
**factory 정의의 `props.style`은 `unified.types.ts`의 `createDefaultXxxProps()` style과 반드시 일치**해야 합니다.

```typescript
// ✅ factory 정의에 CSS 기본값 style 포함
// GroupComponents.ts
{
  type: "ToggleButtonGroup",
  props: {
    style: { display: "flex", flexDirection: "row", alignItems: "center", width: "fit-content" },
    // ...
  }
}

// ❌ factory 정의에 style 누락 → 생성 시 기본값 미적용
// → 리셋 버튼 클릭 후에만 기본값이 적용되는 버그 발생
{
  type: "ToggleButtonGroup",
  props: {
    variant: "default",
    // style이 없음!
  }
}
```

**검증 방법**: `unified.types.ts`에서 style이 있는 `createDefaultXxxProps`와 대응하는 factory 정의의 style이 일치하는지 확인.

### 인라인 폼 컨트롤 크기 계산

Checkbox, Radio, Switch, Toggle은 DropflowBlockEngine에서 `inline-block`으로 처리됩니다.
`calculateContentHeight`/`calculateContentWidth`에 Spec 기반 크기 테이블이 내장되어 있습니다:

```typescript
// engines/utils.ts
const INLINE_FORM_HEIGHTS: Record<string, Record<string, number>> = {
  checkbox: { sm: 20, md: 24, lg: 28 },
  radio: { sm: 20, md: 24, lg: 28 },
  switch: { sm: 20, md: 24, lg: 28 },
  toggle: { sm: 20, md: 24, lg: 28 },
};
```

#### INLINE_FORM_INDICATOR_WIDTHS — Spec trackWidth와 반드시 일치 (CRITICAL)

`INLINE_FORM_INDICATOR_WIDTHS`는 인디케이터(체크박스 박스, 라디오 원, 스위치 트랙)의 너비를 정의합니다.
**이 값은 각 컴포넌트 spec 파일의 `trackWidth` / `indicatorWidth`와 정확히 일치해야 합니다.**

값이 spec보다 작으면 `specShapeConverter`의 `maxWidth` 자동 축소 로직(`shape.x > 0`일 때 `containerWidth - shape.x`)과 맞물려 텍스트 렌더링 영역이 부족해져 **라벨이 불필요하게 줄바꿈**됩니다.

```typescript
// ✅ 현행 값 (Switch.spec.ts trackWidth 기준)
const INLINE_FORM_INDICATOR_WIDTHS: Record<string, Record<string, number>> = {
  checkbox: { sm: 16, md: 20, lg: 24 }, // Checkbox.spec.ts indicatorSize 기준
  radio: { sm: 16, md: 20, lg: 24 }, // Radio.spec.ts indicatorSize 기준
  switch: { sm: 36, md: 44, lg: 52 }, // Switch.spec.ts trackWidth 기준
  toggle: { sm: 36, md: 44, lg: 52 }, // Toggle.spec.ts trackWidth 기준
};

// ❌ 수정 전 잘못된 값 (Switch trackWidth보다 10px 작았음)
const INLINE_FORM_INDICATOR_WIDTHS = {
  switch: { sm: 26, md: 34, lg: 42 }, // spec(36/44/52)보다 10px 부족 → 라벨 줄바꿈
  toggle: { sm: 26, md: 34, lg: 42 },
};
```

**버그 발생 메커니즘**:

1. `INLINE_FORM_INDICATOR_WIDTHS`가 spec보다 10px 작음 → 레이아웃 엔진이 계산한 컴포넌트 전체 너비가 10px 작음
2. `specShapeConverter`가 실제 렌더링 시 spec 기준 `trackWidth`(36/44/52)로 인디케이터를 배치 → `shape.x = trackWidth`
3. 텍스트 shape의 `maxWidth`가 `containerWidth - shape.x`로 자동 축소됨
4. `containerWidth`(레이아웃 계산값)가 이미 10px 부족하므로 텍스트 영역이 10px 추가 손실 → 줄바꿈 발생

#### INLINE_FORM_GAPS — 컴포넌트 유형별 gap 테이블 (신규)

인디케이터와 라벨 사이의 gap은 컴포넌트 유형에 따라 다릅니다.
각 컴포넌트 spec의 `gap` / `labelGap` 값과 동기화하세요.

```typescript
// ✅ 현행 값 (컴포넌트 spec sizes 기준)
const INLINE_FORM_GAPS: Record<string, Record<string, number>> = {
  checkbox: { sm: 6, md: 8, lg: 10 }, // Checkbox.spec.ts gap 기준
  radio: { sm: 6, md: 8, lg: 10 }, // Radio.spec.ts gap 기준
  switch: { sm: 8, md: 10, lg: 12 }, // Switch.spec.ts gap 기준
  toggle: { sm: 8, md: 10, lg: 12 }, // Toggle.spec.ts gap 기준
};

// ✅ 실제 사용: INLINE_FORM_GAPS 우선, 없으면 크기 기반 폴백
const gap =
  INLINE_FORM_GAPS[type]?.[sizeName] ??
  (sizeName === "sm" ? 6 : sizeName === "lg" ? 10 : 8);
```

Switch/Toggle은 Checkbox/Radio보다 gap이 2px 더 큽니다.
gap을 잘못 설정하면 row 방향 전체 너비 계산(`indicatorWidth + gap + textWidth`)이 틀어집니다.

#### column 방향 gap 계산

`flexDirection: 'column'`일 때는 column 방향 gap도 `INLINE_FORM_GAPS`를 통해 컴포넌트별 값을 사용합니다:

```typescript
// ✅ column 방향: INLINE_FORM_GAPS로 switch/toggle 전용 gap 적용
const columnGap = INLINE_FORM_GAPS[type]?.[sizeName] ?? defaultGap;
// height = indicatorHeight + columnGap + textLineHeight

// ❌ 모든 폼 요소에 동일한 고정 gap 사용
const columnGap = 8; // switch(10/12)와 다를 수 있음
```

#### flexDirection 지원

`element.props.style.flexDirection`이 `'column'`이면 크기 계산이 변경됩니다:

| 방향       | width                       | height                            |
| ---------- | --------------------------- | --------------------------------- |
| row (기본) | indicator + gap + textWidth | `INLINE_FORM_HEIGHTS[type][size]` |
| column     | max(indicator, textWidth)   | indicator + gap + textLineHeight  |

이 분기는 `engines/utils.ts`의 `enrichWithIntrinsicSize()`에 통합되어 있으며, DropflowBlockEngine + TaffyFlexEngine **양쪽**에서 공유됩니다.

### Spec shapes border-radius 그룹 위치 처리

ToggleButtonGroup 내 ToggleButton은 CSS에서 그룹 내 위치(first/middle/last)에 따라 모서리별 다른 border-radius를 적용합니다.
Spec 기반 Skia 렌더링에서도 동일한 결과를 얻으려면 `_groupPosition` props를 통해 위치 정보를 전달해야 합니다.

```typescript
// ✅ ElementSprite.tsx: toggleGroupPosition을 _groupPosition으로 주입
const specProps = toggleGroupPosition
  ? { ...(props || {}), _groupPosition: toggleGroupPosition }
  : props || {};

const shapes = spec.render.shapes(specProps, variantSpec, sizeSpec, "default");

// ✅ ToggleButton.spec.ts shapes(): per-corner border-radius
// horizontal: first → [r,0,0,r], last → [0,r,r,0], middle → [0,0,0,0]
// vertical:   first → [r,r,0,0], last → [0,0,r,r], middle → [0,0,0,0]
const gp = props._groupPosition;
let borderRadius = baseBorderRadius;
if (gp && !gp.isOnly) {
  const r = baseBorderRadius;
  if (gp.orientation === "horizontal") {
    if (gp.isFirst) borderRadius = [r, 0, 0, r];
    else if (gp.isLast) borderRadius = [0, r, r, 0];
    else borderRadius = [0, 0, 0, 0];
  }
  // vertical도 동일 패턴
}

// ❌ 그룹 위치 무시 → 모든 버튼에 동일한 단일 borderRadius 적용
const borderRadius = size.borderRadius; // [r,0,0,r] 대신 항상 r
```

**필수 조건**: `specShapeConverter.ts`의 `resolveRadius()`가 `number | [number, number, number, number]` 양쪽 타입을 지원해야 함 (현재 지원 확인됨).

## 개선 이력 (2026-02-21)

### fontBoundingBox line-height 통일

`measureWrappedTextHeight`, `measureTextWithWhiteSpace`, `estimateTextHeight` 세 함수 모두 `measureFontMetrics().lineHeight` 사용으로 통일.

- **이전**: 일부 함수가 `fontSize * 1.2` 근사값 사용
- **이후**: Canvas 2D `fontBoundingBoxAscent + fontBoundingBoxDescent` 기반 실측값
- **효과**: CSS `line-height: normal`과 동일한 결과, 세 함수 간 불일치로 인한 텍스트 클리핑 버그 해결

### INLINE_BLOCK_TAGS border-box 수정

`enrichWithIntrinsicSize`가 `INLINE_BLOCK_TAGS`(button, badge, togglebutton, togglebuttongroup 등)에 항상 padding+border 포함 border-box 높이를 반환하도록 수정.

- **이유**: `layoutInlineRun`이 `style.height`를 border-box 값으로 직접 사용
- **효과**: block 경로의 `treatAsBorderBox` 변환이 이중 계산 방지, INLINE_BLOCK_TAGS 높이 축소 버그 해결

### Card/Box/Section border-box 처리 추가

`treatAsBorderBox` 조건에 `card`, `box`, `section` 태그를 추가하여 CONTAINER_TAGS이면서 border-box로 동작하는 컴포넌트를 올바르게 처리.

- **이유**: Card 등은 사용자가 입력하는 높이 값이 항상 border-box(padding+border 포함) 기준이며, 이를 content-box로 잘못 해석하면 실제 크기가 padding+border만큼 커지는 버그 발생
- **효과**: Card 명시적 height 설정 시 레이아웃 엔진이 정확한 content-box 크기를 계산

### LayoutContext.getChildElements 추가

`LayoutContext` 인터페이스에 `getChildElements?: (elementId: string) => Element[]` 선택적 메서드 추가.

- **주입**: `BuilderCanvas.tsx`에서 `pageChildrenMap` 기반으로 context에 주입
- **사용처**: `enrichWithIntrinsicSize`에서 ToggleButtonGroup, Card 등 자식 수·크기 기반 intrinsic 너비/높이 계산

### border shorthand 레이아웃 지원

`parseBorder()`가 `border: "1px solid red"` shorthand에서 `borderWidth` 추출 지원.

- **연동**: `parseBorderShorthand()` (`cssValueParser.ts`)
- **효과**: `border` shorthand 사용 시 레이아웃 엔진이 borderWidth를 인식하지 못하던 문제 해결

### Switch/Toggle INLINE_FORM_INDICATOR_WIDTHS 수정 (2026-02-21)

`INLINE_FORM_INDICATOR_WIDTHS`의 switch/toggle 값을 spec `trackWidth`와 일치하도록 수정.

- **이전**: `{ sm: 26, md: 34, lg: 42 }` (spec trackWidth보다 10px 작음)
- **이후**: `{ sm: 36, md: 44, lg: 52 }` (Switch.spec.ts trackWidth와 동일)
- **원인**: 값이 spec보다 작으면 `specShapeConverter`의 `shape.x > 0` maxWidth 자동 축소와 맞물려 텍스트 영역이 부족해짐
- **효과**: WebGL Canvas에서 Switch/Toggle 라벨 줄바꿈 버그 해결

### INLINE_FORM_GAPS 테이블 신규 추가 (2026-02-21)

인디케이터-라벨 gap을 컴포넌트 유형별로 분리하는 `INLINE_FORM_GAPS` 테이블 추가.

- **이전**: 크기(sm/md/lg)만 기준으로 gap 계산 (모든 폼 요소 동일)
- **이후**: checkbox/radio는 6/8/10, switch/toggle은 8/10/12로 컴포넌트별 분리
- **효과**: row/column 방향 모두에서 각 컴포넌트 spec gap 값과 정확히 일치

### Card 텍스트 변경 미반영 버그 수정 (2026-02-21)

Properties Panel에서 Card의 `heading`/`description`을 변경해도 WebGL Canvas에 반영되지 않던 버그 수정.

- **근본 원인**: CardEditor는 `Card.props.heading/description`을 업데이트하지만, WebGL TextSprite는 자식 Heading/Description Element의 `props.children`을 읽음. Card.props → 자식 element props 동기화가 없었음.
- **수정 1 — `BuilderCanvas.tsx`**: `createContainerChildRenderer`에 `containerType === 'Card'` 분기 추가. `cardProps.heading ?? cardProps.title`을 Heading 자식의 `props.children`에, `cardProps.description`을 Description 자식의 `props.children`에 주입.
- **수정 2 — `LayoutRenderers.tsx`**: CSS Preview Card 렌더러에 `heading`, `subheading`, `footer` props 전달 추가. WebGL Canvas와 CSS Preview가 동일한 텍스트를 표시하도록 동기화.
- **패턴**: Tabs `_tabLabels`와 동일한 Container Props 주입 방식 (CONTAINER_PROPS_INJECTION)

### TagGroup label 두 줄 렌더링 버그 수정 (2026-02-22)

WebGL Canvas에서 TagGroup의 label("Tag Group")이 두 줄로 렌더링되던 버그 수정.

- **근본 원인 1 — Spec shapes 중복 렌더링**: `TagGroupSpec.render.shapes`에서 label 텍스트를 fontSize 12px로 렌더링하고, 자식 Label 엘리먼트가 fontSize 14px로 별도 렌더링 → 두 텍스트가 겹쳐 두 줄처럼 보임. Label은 자식 Element(TEXT_TAGS → TextSprite 경로)가 담당하므로 spec shapes에서 중복 렌더링하면 안 됨.
- **근본 원인 2 — Canvas 2D ↔ CanvasKit 폭 측정 오차**: `calculateContentWidth`의 일반 텍스트 경로(line 759-760)에 `Math.ceil() + 2` 보정이 누락됨. INLINE_FORM 경로(line 718-719)에는 적용됐으나 일반 텍스트 경로에는 없었음. 보정 미적용 시 CanvasKit paragraph API가 더 넓은 폭을 요구하여 텍스트가 wrapping됨.
- **수정 파일 1**: `packages/specs/src/components/TagGroup.spec.ts` — shapes()에서 label 텍스트 shape 제거. Tag chip shapes만 반환.
- **수정 파일 2**: `apps/builder/src/builder/workspace/canvas/layout/engines/utils.ts` (line 759-760) — 일반 텍스트 경로에 `Math.ceil(calculateTextWidth(...)) + 2` 보정 추가.
- **교훈**: Canvas 2D measureText ↔ CanvasKit paragraph API 간 폭 오차 보정은 모든 텍스트 측정 경로에 일관 적용 필요. 자식 Element가 렌더링하는 텍스트를 spec shapes에 중복 정의하지 말 것.

### flex shorthand 파싱 추가 (2026-02-22) + flex item 일반화 (2026-03-01)

CSS `flex` shorthand 파싱을 `applyFlexItemProperties()` (utils.ts) 공유 함수로 추출.

- **이전 (2026-02-22)**: `flex` shorthand 미지원 → DB에 `flex: 1`만 저장된 요소의 `flexGrow`가 0으로 계산
- **중간**: TaffyFlexEngine.elementToTaffyStyle()에만 shorthand 파싱 추가
- **이후 (2026-03-01)**: `applyFlexItemProperties()` 공유 함수로 추출. block/grid 자식도 flex 부모 안에서 flex item 속성 적용
- **근본 원인**: `elementToTaffyBlockStyle`은 flex item 속성을 파싱하지 않음. CSS Display Level 3에 따르면 부모 display가 자식의 item 참여를 결정
- **효과**: SelectValue(block, flex:1)가 SelectTrigger(flex) 내에서 올바르게 남은 공간을 채움

### overflow/aspectRatio Taffy 전달 추가 (2026-03-01)

`applyCommonTaffyStyle()` (utils.ts)에 overflow/overflowX/overflowY 및 aspectRatio 추가.

- **이전**: overflow는 BFC baseline 계산에만 사용, Taffy에 미전달. aspectRatio 미지원
- **이후**: 모든 레이아웃 경로(flex/grid/block)에서 Taffy에 직접 전달
- **효과**: overflow:hidden 컨테이너의 내용 클리핑, aspectRatio 기반 크기 계산 정상 동작

### Grid 경로 position/inset 추가 (2026-03-01)

`fullTreeLayout.ts` Grid 경로에 position(absolute/relative) 및 inset(top/right/bottom/left) 처리 추가.

- **이전**: Grid 경로는 position/inset 미처리 → absolute 자식이 정상 배치 안 됨
- **이후**: flex/block 경로와 동일하게 position + inset 속성 Taffy 전달
- **효과**: Grid 컨테이너 내 absolute positioned 자식 정상 배치

### Slider Complex Component 전환 및 specHeight 보정 (2026-02-22)

Slider는 Simple → Complex Component로 전환된 후에도 `ElementSprite.tsx`에서 SLIDER_DIMENSIONS 기반 specHeight 보정이 여전히 필요합니다.

#### SLIDER_DIMENSIONS 기반 specHeight 보정

```typescript
// ElementSprite.tsx — Slider specHeight 보정 로직
// SLIDER_DIMENSIONS 기준 치수
const SLIDER_DIMENSIONS = {
  sm: { trackHeight: 4, thumbSize: 14 },
  md: { trackHeight: 6, thumbSize: 18 },
  lg: { trackHeight: 8, thumbSize: 22 },
};

// Slider specHeight = label(lineHeight) + gap + thumbSize
// (thumbSize가 track보다 크므로 thumbSize를 기준으로 계산)
const sliderDims = SLIDER_DIMENSIONS[size ?? "md"];
const labelHeight = resolvedFontSize * 1.2; // lineHeight 근사값
const specHeight = labelHeight + gap + sliderDims.thumbSize;
```

**보정이 여전히 필요한 이유**:

- Slider는 Complex Component로 전환되어 자식 Element(Label, SliderOutput, SliderTrack > SliderThumb)를 가집니다.
- 그러나 자식들은 **투명(transparent) 배경**으로 렌더링되며, 시각적 렌더링(track 막대, thumb 원)은 **부모 Slider의 spec shapes**가 담당합니다.
- 레이아웃 엔진은 자식 Element의 크기로 전체 높이를 결정하지만, 자식들이 투명이므로 자동 크기 계산이 올바르지 않을 수 있습니다.
- `specHeight` 보정으로 spec shapes가 올바른 영역 안에 렌더링되도록 보장합니다.

**Simple → Complex 전환 후 Slider 렌더링 구조**:

```
Slider (부모)
├─ spec shapes: track 막대(roundRect) + thumb 원(circle) 시각 렌더링 담당
├─ Label (자식, TextSprite — 투명 배경)
├─ SliderOutput (자식, TextSprite — 투명 배경, x:0 + maxWidth:width + align:right)
└─ SliderTrack (자식, CONTAINER_TAGS — 투명 박스)
   └─ SliderThumb (자식, 투명 박스 — 히트 영역)
```

**SliderOutput 위치 주의**:

- SliderOutput은 우측 정렬 텍스트로, `x: containerWidth` 대신 `x: 0` + `maxWidth: containerWidth` + `align: 'right'`를 사용합니다.
- `x: containerWidth`로 설정하면 `paddingLeft`가 컨테이너 밖에 위치하여 화면 밖으로 나가는 문제가 발생합니다.

#### `_hasLabelChild` 패턴

Select, ComboBox, Slider처럼 Label 자식 Element를 포함하는 Complex Component에서 spec shapes의 label 텍스트 중복 렌더링을 방지하는 패턴입니다.

```typescript
// ElementSprite.tsx — _hasLabelChild 체크
const COMPLEX_WITH_LABEL_CHILD = new Set(["Select", "ComboBox", "Slider"]);

// shapes 처리 시 label/output 텍스트 shapes 스킵
if (COMPLEX_WITH_LABEL_CHILD.has(type) && element._hasLabelChild) {
  // label, output 텍스트 shape 제외 — 자식 Element(TextSprite)가 담당
  filteredShapes = shapes.filter((s) => s.id !== "label" && s.id !== "output");
}
```

**이 체크가 필요한 이유**:

- Complex Component 전환 전에는 spec shapes에서 label 텍스트를 직접 렌더링했습니다.
- 전환 후 Label/SliderOutput 자식이 TextSprite 경로로 렌더링하므로, spec shapes에서 label/output 텍스트를 함께 렌더링하면 이중 표시가 발생합니다.
- `_hasLabelChild` 플래그로 자식 Label이 있는 경우만 스킵하여 구버전 데이터 하위 호환성을 유지합니다.

### Select/ComboBox implicit styles 주입 추가 (2026-02-22)

`BuilderCanvas.tsx createContainerChildRenderer`에서 SelectTrigger/ComboBoxWrapper 자식에 implicit styles 주입 추가.

- **이전**: DB 저장 요소에 `width`/`height`/`flex` 미설정 시 레이아웃 크기 0 계산 → BoxSprite 100×100 fallback
- **이후**: 레이아웃 계산 전 `filteredContainerChildren`에 implicit styles 합성, 렌더링 시 tag별 implicitStyle spread
- **적용**: SelectValue(`flex: 1`), SelectIcon(`18×18, flexShrink: 0`), ComboBoxInput(`flex: 1`), ComboBoxTrigger(`18×18, flexShrink: 0`)

> **참고**: 레이아웃 엔진 전략 결정은 [ENGINE.md](../../../../docs/adr/008-layout-engine.md) 참조.
