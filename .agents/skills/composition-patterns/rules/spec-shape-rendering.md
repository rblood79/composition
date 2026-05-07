---
title: Shape-based Rendering Pattern
impact: HIGH
impactDescription: React/Skia 공통 렌더링 로직, 일관된 시각적 결과
tags: [spec, shape, rendering, skia]
---

ComponentSpec의 `render.shapes`는 **플랫폼 독립적 도형**을 반환합니다. React와 Skia 렌더러가 이를 각각 해석합니다.

## Incorrect

```tsx
// ❌ 렌더러별 직접 구현
// React
const Button = () => (
  <div style={{ borderRadius: 8, background: "blue" }}>Click</div>
);

// PIXI - 별도 로직
const draw = (g: Graphics) => {
  g.roundRect(0, 0, 100, 40, 8);
  g.fill({ color: 0x0000ff });
};
```

## Correct

```tsx
// ✅ Shape 기반 정의 + props.style 오버라이드 패턴
const ButtonSpec: ComponentSpec<ButtonProps> = {
  render: {
    shapes: (props, variant, size, state = "default") => {
      // props.style 우선, 없으면 state/variant 기본값
      const bgColor =
        props.style?.backgroundColor ??
        (state === "hover"
          ? variant.backgroundHover
          : state === "pressed"
            ? variant.backgroundPressed
            : variant.background);
      const textColor = props.style?.color ?? variant.text;
      const borderRadius = props.style?.borderRadius ?? size.borderRadius;
      const borderWidth = props.style?.borderWidth ?? 1;
      const paddingX =
        props.style?.paddingLeft ?? props.style?.padding ?? size.paddingX;
      const fontSize = props.style?.fontSize ?? size.fontSize;

      return [
        // 배경 (height: 'auto' 필수 -- Yoga 레이아웃 높이 사용)
        {
          id: "bg",
          type: "roundRect",
          x: 0,
          y: 0,
          width: "auto",
          height: "auto", // <- 고정 높이 금지
          radius: borderRadius,
          fill: bgColor,
        },
        // 테두리
        {
          type: "border",
          target: "bg",
          borderWidth,
          color: props.style?.borderColor ?? variant.border,
        },
        // 텍스트
        {
          type: "text",
          x: paddingX, // <- padding 오버라이드 반영
          y: 0,
          text: props.children,
          fill: textColor,
          fontSize,
          fontWeight: props.style?.fontWeight ?? 500,
          fontFamily: props.style?.fontFamily ?? fontFamily.sans,
          align: props.style?.textAlign ?? "center",
          baseline: "middle",
        },
      ];
    },
  },
};

// React 렌더러가 Shape -> JSX 변환
// Skia 렌더러: specShapesToSkia(shapes) -> SkiaNodeData -> nodeRenderers.ts
```

## Shape 타입

| 타입        | 용도                            |
| ----------- | ------------------------------- |
| `rect`      | 사각형                          |
| `roundRect` | 둥근 모서리 사각형              |
| `circle`    | 원                              |
| `text`      | 텍스트                          |
| `line`      | 선분 (체크마크, 구분선 등)      |
| `shadow`    | 그림자 (배경 뒤)                |
| `border`    | 테두리 (배경 위)                |
| `container` | 자식 요소 그룹                  |
| `gradient`  | 그라데이션 배경 (linear/radial) |

## 주의사항

- Shape의 `x`, `y`는 저수준 Graphics API용 (pixi-no-xy-props와 다른 컨텍스트)
- `width: 'auto'`, `height: 'auto'`는 컨테이너 크기에 맞춤
- **배경 roundRect의 `width`와 `height`는 반드시 `'auto'`** -- `props.style?.width` 사용 금지
- `state` 파라미터로 상태별 스타일 분기 (기본값: 'default')
- Spec `shapes()` 함수는 항상 row 레이아웃 좌표를 생성. column 방향에서는 `rearrangeShapesForColumn()`으로 좌표를 변환해야 함

### 배경 roundRect width/height 규칙 (CRITICAL)

`specShapesToSkia`는 첫 번째 roundRect/rect에서 bgBox를 추출할 때 **`shape.width === 'auto' && shape.height === 'auto'`** 조건을 사용합니다. `props.style?.width`를 배경 roundRect에 사용하면 사용자가 px/% 크기를 설정할 때 숫자 값이 되어 bgBox 추출이 실패하고 배경이 렌더링되지 않습니다.

```typescript
// ❌ 배경 roundRect에 props.style?.width 사용 금지
const width = (props.style?.width as number) || "auto";
// → 사용자가 width: 200px 설정 시 width = 200 → bgBox 추출 실패

// ✅ 배경 roundRect는 항상 'auto' 사용
const width = "auto" as const;
// → specShapesToSkia가 containerWidth로 대체하여 bgBox 정상 추출
```

**영향 범위**: Button, Section, ToggleButton, Card, Form, List, FancyButton, ScrollBox, MaskedFrame 등 모든 spec의 배경 roundRect

### Card Spec Shapes 렌더링

Card spec은 **시각적 컨테이너 요소(배경, 테두리, 그림자)만 렌더링**합니다. `title`/`description`/`heading` 같은 텍스트 콘텐츠는 spec shapes에 포함되지 않으며, **Heading/Description 자식 Element**로 분리하여 TextSprite 경로로 별도 렌더링됩니다.

**텍스트를 spec shapes에 넣지 않는 이유**:

- Card의 텍스트(제목, 설명)는 독립적인 레이아웃 노드로 취급되어야 합니다. spec shapes의 고정 좌표 기반 텍스트 배치로는 동적 줄바꿈, 폰트 크기 상속, 선택/편집 이벤트를 처리할 수 없습니다.
- Heading/Description이 독립 element이면 각자 TEXT_TAGS 경로 → TextSprite를 거쳐 Skia로 렌더링되어 크기 측정과 레이아웃 반영이 가능합니다.
- Properties Panel에서 변경된 `Card.props.heading/description` 값은 `createContainerChildRenderer`가 렌더링 시점에 자식 element에 주입하므로 별도 저장소 없이 동기화됩니다.

```typescript
// ✅ Card.spec.ts — 배경·테두리·그림자만 shapes로 반환
const CardSpec: ComponentSpec<CardProps> = {
  render: {
    shapes: (props, variant, size) => {
      return [
        // 그림자 (배경보다 먼저 렌더링)
        {
          type: 'shadow',
          target: 'bg',
          offsetX: 0,
          offsetY: variant.shadowOffsetY ?? 2,
          blur: variant.shadowBlur ?? 8,
          color: props.style?.boxShadow ?? variant.shadow,
        },
        // 배경
        {
          id: 'bg',
          type: 'roundRect',
          x: 0,
          y: 0,
          width: 'auto',   // ← 반드시 'auto'
          height: 'auto',  // ← 반드시 'auto'
          radius: props.style?.borderRadius ?? size.borderRadius,
          fill: props.style?.backgroundColor ?? variant.background,
        },
        // 테두리
        {
          type: 'border',
          target: 'bg',
          borderWidth: props.style?.borderWidth ?? 1,
          color: props.style?.borderColor ?? variant.border,
        },
        // heading/description/title은 shapes에 포함하지 않음
        // → Heading, Description 자식 Element가 TextSprite 경로로 별도 렌더링
        // → Properties Panel 변경값은 createContainerChildRenderer가 주입
      ];
    },
  },
};

// ❌ Card spec shapes에 텍스트 도형 추가 금지
// 이유 1: 자식 Element 렌더링과 이중으로 표시됨
// 이유 2: 동적 줄바꿈/크기 측정 불가
// 이유 3: Properties Panel 변경이 자동으로 반영되지 않아 별도 동기화 필요
{
  type: 'text',
  text: props.title,  // Heading 자식이 이미 렌더링하므로 중복
  ...
}
```

**Card Spec 구조 요약 (shapes 내부)**:

| shape         | 타입        | 역할                                               |
| ------------- | ----------- | -------------------------------------------------- |
| (선택) shadow | `shadow`    | 박스 그림자                                        |
| bg            | `roundRect` | 카드 배경 (`width: 'auto'`, `height: 'auto'` 필수) |
| (선택) border | `border`    | 카드 테두리                                        |

텍스트 관련 shape은 없음. 텍스트는 자식 Element(Heading, Description)가 담당.

**Description과 TEXT_TAGS**:

- `Description` 태그는 `TEXT_TAGS`에 포함되어 `TextSprite` 경로로 렌더링됩니다.
- `Heading` 태그도 동일하게 `TEXT_TAGS` → `TextSprite` 경로를 사용합니다.
- Card의 `childElements`에 포함된 Heading/Description은 CONTAINER_TAGS 경로에서 `renderChildElement`로 렌더링됩니다.

```typescript
// ElementSprite.tsx — TEXT_TAGS 경로
const TEXT_TAGS = new Set(['text', 'heading', 'description', 'label', 'paragraph', ...]);

// Card 자식 렌더링 흐름
// 1. Card → CONTAINER_TAGS 경로
// 2. childElements = [Heading, Description, ...]
// 3. createContainerChildRenderer → containerTag === 'Card' 분기
//    → Card.props.heading/title → Heading.props.children 주입
//    → Card.props.description   → Description.props.children 주입
// 4. 각 자식 → renderChildElement → ElementSprite
// 5. Heading/Description → TEXT_TAGS 조건 → TextSprite 렌더링
```

**Card Spec 렌더링 책임 분리 요약**:

| 역할                 | 담당                                                |
| -------------------- | --------------------------------------------------- |
| 배경, 테두리, 그림자 | Card spec shapes (specShapesToSkia)                 |
| 제목 텍스트          | Heading 자식 Element (TextSprite)                   |
| 설명 텍스트          | Description 자식 Element (TextSprite)               |
| 레이아웃 크기 결정   | DropflowBlockEngine + childElements 높이 합산       |
| Props 동기화         | createContainerChildRenderer의 Container Props 주입 |

**CSS Preview와의 동기화**:

- CSS Preview(`LayoutRenderers.tsx`)의 Card 렌더러는 `heading`, `subheading`, `footer` props를 명시적으로 전달해야 합니다.
- WebGL Canvas(Container Props 주입)와 CSS Preview(explicit props)가 동일한 데이터 소스(부모 element props)를 사용해야 텍스트가 일치합니다.

```typescript
// LayoutRenderers.tsx — CSS Preview Card 렌더러 (올바른 예)
// ✅ heading, subheading, footer를 명시적으로 전달
<CardComponent
  heading={element.props.heading ?? element.props.title}
  description={element.props.description}
  subheading={element.props.subheading}
  footer={element.props.footer}
  style={element.props.style}
/>

// ❌ props spread에만 의존 — CardComponent가 특정 prop 이름을 기대하면 누락됨
<CardComponent {...element.props} />
```

### 자식 Element 중복 렌더링 금지 원칙 (CRITICAL)

CONTAINER_TAGS에 속하는 컴포넌트의 spec shapes에서 **자식 Element가 렌더링하는 텍스트를 중복으로 포함하지 않습니다.**

이 원칙은 Card, TagGroup처럼 텍스트 콘텐츠를 독립 자식 Element로 분리한 모든 컴포넌트에 적용됩니다.

**중복 렌더링이 발생하는 패턴**:

| 컴포넌트   | 자식 Element (올바른 담당) | spec shapes에 추가하면 안 되는 shape |
| ---------- | -------------------------- | ------------------------------------ |
| `Card`     | `Heading`, `Description`   | `type: 'text', text: props.title`    |
| `TagGroup` | `Label`                    | `type: 'text', text: props.label`    |

```typescript
// ❌ CONTAINER_TAGS 컴포넌트의 spec shapes에 자식 텍스트 중복 정의 — 항상 금지
const TagGroupSpec = {
  render: {
    shapes: (props, variant, size) => [
      { id: 'bg', type: 'roundRect', ... },
      // 아래 텍스트 shape는 Label 자식 Element와 중복 렌더링됨
      { type: 'text', text: props.label, fontSize: 12, ... }, // ← 금지
    ],
  },
};

// ✅ spec shapes에는 배경/테두리/그림자 등 시각 컨테이너 요소만 포함
const TagGroupSpec = {
  render: {
    shapes: (props, variant, size) => [
      { id: 'bg', type: 'roundRect', width: 'auto', height: 'auto', ... },
      // label 텍스트 없음 — Label 자식 Element가 TextSprite 경로로 독립 렌더링
    ],
  },
};
```

**확인 방법**: 컴포넌트가 CONTAINER_TAGS에 등록되어 있다면, 해당 컴포넌트의 어떤 props가 자식 Element의 `props.children`에 매핑되는지 확인하고, 그 텍스트를 spec shapes에서 제거합니다.

**실제 버그 사례 (2026-02-22)**: TagGroup.spec.ts에서 label 텍스트를 fontSize 12px로 spec shapes에 렌더링하면서, Label 자식 Element가 fontSize 14px로 동일 위치에 렌더링됨 → 두 텍스트가 겹쳐 두 줄처럼 보이는 버그 발생. label shape 제거로 해결.

### Slider Spec Shapes 렌더링 (2026-02-22 추가)

Slider spec은 Complex Component로 전환된 후에도 spec shapes가 track/thumb 시각 렌더링을 담당합니다.
자식 Element(Label, SliderOutput, SliderTrack > SliderThumb)는 **투명** 배경으로 렌더링되며 히트 영역과 텍스트를 담당합니다.

**TokenRef offsetY 버그 — resolveToken() 사용 필수 (CRITICAL)**:

```typescript
// ❌ BAD: size.fontSize가 TokenRef 문자열인데 숫자 덧셈에 직접 사용
const offsetY = (size.fontSize as unknown as number) + gap;
// '{typography.text-sm}' + 10 = '{typography.text-sm}10' → NaN 좌표 → track/thumb 미렌더링

// ✅ GOOD: resolveToken()으로 숫자 변환 후 사용
import { resolveToken } from "../renderers/utils/tokenResolver";
const rawFontSize = size.fontSize;
const resolved =
  typeof rawFontSize === "number"
    ? rawFontSize
    : resolveToken(rawFontSize as TokenRef);
const numericFontSize = typeof resolved === "number" ? resolved : 14;
const offsetY = numericFontSize + gap; // 14 + 10 = 24 (정상)
```

**근본 원인**: `size.fontSize`는 `number | TokenRef` 유니온 타입이므로 `as unknown as number`로 캐스팅하면 TokenRef 문자열이 그대로 사용되어 문자열 연결이 발생합니다. `resolveToken()`은 TokenRef를 실제 숫자로 변환합니다.

**height 기반 fallback 대안** (resolveToken import가 어려운 경우):

```typescript
// ✅ size 키 기반 fallback — resolveToken 없이도 안전
const rawFontSize = size.fontSize;
const numericFontSize =
  typeof rawFontSize === "number"
    ? rawFontSize
    : ({ sm: 12, md: 14, lg: 16 }[sizeName] ?? 14);
```

**SliderOutput 우측 정렬 패턴**:

```typescript
// ❌ BAD: x: containerWidth 사용 — paddingLeft가 컨테이너 밖으로 나감
{
  type: 'text',
  x: containerWidth,  // 컨테이너 밖 → 화면에서 보이지 않음
  text: String(props.value ?? 0),
  align: 'right',
}

// ✅ GOOD: x: 0 + maxWidth: containerWidth + align: 'right'
{
  type: 'text',
  x: 0,
  maxWidth: containerWidth,  // 컨테이너 전체를 텍스트 영역으로 사용
  text: String(props.value ?? 0),
  align: 'right',            // 영역 내 우측 정렬
}
```

**`_hasLabelChild` 패턴 — label/output 텍스트 shapes 스킵**:

Select, ComboBox, Slider처럼 Label 자식 Element를 가지는 Complex Component에서 spec shapes의 label/output 텍스트를 스킵하는 패턴입니다.

```typescript
// ElementSprite.tsx — _hasLabelChild 체크
// 자식 Label/SliderOutput이 TextSprite로 렌더링하므로
// spec shapes의 텍스트 shape을 중복 렌더링하지 않도록 스킵
const hasLabelChild = element._hasLabelChild;
const shapesToRender =
  (type === "Slider" || type === "Select" || type === "ComboBox") &&
  hasLabelChild
    ? shapes.filter((s) => s.id !== "label" && s.id !== "output")
    : shapes;
```

**이 패턴이 필요한 이유**:

- Complex Component 전환 전 Slider는 spec shapes에서 label 텍스트를 직접 렌더링했습니다.
- 전환 후 자식 Label/SliderOutput이 TextSprite 경로로 렌더링하므로, spec shapes에서 동시에 렌더링하면 이중 표시 버그가 발생합니다.
- `_hasLabelChild` 플래그는 실제로 자식 Label Element가 있는 경우에만 `true`이므로, 구버전 데이터(자식 없음)와 하위 호환됩니다.

**Slider Spec 구조 요약 (shapes 내부)**:

| shape         | 타입                        | 역할                                                                        |
| ------------- | --------------------------- | --------------------------------------------------------------------------- |
| (선택) label  | `text`                      | label 텍스트 — `_hasLabelChild` 시 스킵                                     |
| (선택) output | `text`                      | 현재 값 텍스트 — `_hasLabelChild` 시 스킵, `x:0`+`maxWidth`+`align:'right'` |
| track         | `roundRect`                 | 슬라이더 트랙 막대                                                          |
| thumb         | `circle` (또는 `roundRect`) | 슬라이더 thumb 핸들                                                         |

### Select/ComboBox 구조적 자식 렌더링 (2026-02-22 추가)

Select/ComboBox는 CONTAINER_TAGS로 등록되어 자식 요소(Label, SelectTrigger/ComboBoxWrapper)를
레이아웃 엔진으로 배치합니다. spec shapes가 시각 렌더링(trigger rect, placeholder text, chevron)을
담당하므로, 구조적 자식의 BoxSprite는 투명해야 합니다.

**문제**: `convertToFillStyle()`이 backgroundColor 미지정 시 흰색 불투명(0xffffff, alpha=1) 반환
→ 구조적 자식의 BoxSprite가 spec shapes를 가림.

**해결 패턴** (BuilderCanvas.tsx `createContainerChildRenderer`):

```typescript
// ✅ 구조적 자식: 투명 배경 + 텍스트 비우기 + implicit styles
if (
  type === "SelectTrigger" ||
  type === "SelectValue" ||
  type === "SelectIcon" ||
  type === "ComboBoxWrapper" ||
  type === "ComboBoxInput" ||
  type === "ComboBoxTrigger"
) {
  const implicitStyle =
    type === "SelectIcon" || type === "ComboBoxTrigger"
      ? { width: 18, height: 18, flexShrink: 0 }
      : type === "SelectValue" || type === "ComboBoxInput"
        ? { flex: 1 }
        : {};
  effectiveChildEl = {
    ...effectiveChildEl,
    props: {
      ...existingProps,
      children: "", // spec shapes가 텍스트 렌더링 담당
      style: {
        ...implicitStyle,
        ...existingStyle,
        backgroundColor: "transparent",
      },
    },
  };
}

// ❌ 구조적 자식에 backgroundColor 미설정 → 흰색 불투명 BoxSprite가 spec shapes 가림
// ❌ children 텍스트 유지 → spec shapes 텍스트와 이중 렌더링
```

**CONTAINER_TAGS 계층 구조**:

```
Select (CONTAINER_TAGS)
├─ Label (TextSprite — 레이아웃 엔진 배치)
├─ SelectTrigger (CONTAINER_TAGS — 투명 BoxSprite)
│  ├─ SelectValue (투명 BoxSprite, flex:1 — 히트 영역)
│  └─ SelectIcon (투명 BoxSprite, 18×18 — 히트 영역)
└─ SelectItem (spec shapes 드롭다운에서 처리 — 컨테이너 자식에서 필터링)

ComboBox (CONTAINER_TAGS)
├─ Label (TextSprite — 레이아웃 엔진 배치)
├─ ComboBoxWrapper (CONTAINER_TAGS — 투명 BoxSprite)
│  ├─ ComboBoxInput (투명 BoxSprite, flex:1 — 히트 영역)
│  └─ ComboBoxTrigger (투명 BoxSprite, 18×18 — 히트 영역)
└─ ComboBoxItem (spec shapes 드롭다운에서 처리)
```

**implicit styles 주입 이유**: DB에 저장된 기존 요소에 `width`, `height`, `flex` 속성이 없을 수 있음.
레이아웃 계산 전 `filteredContainerChildren`에 `??` 연산자로 implicit styles 주입하여
Taffy 엔진이 올바른 크기를 계산하도록 보장.

### 텍스트 줄바꿈 시 높이 자동 확장 (v1.15, 2026-02-15)

Button 등 SELF_PADDING_TAGS 컴포넌트에 고정 width를 설정하고 긴 텍스트를 입력하면 CSS에서는 height가 자동 확장되지만, Skia에서는 Yoga가 텍스트 measure 함수를 갖고 있지 않아 높이가 변하지 않았습니다.

**해결**: `measureSpecTextMinHeight()` 헬퍼가 spec shapes 내 텍스트의 word-wrap 높이를 측정하고, `contentMinHeight` 패턴(Card와 동일)으로 Skia 높이를 확장합니다.

```typescript
// ElementSprite.tsx — spec shapes 경로
let specHeight = finalHeight;
const hasExplicitHeight =
  style?.height !== undefined && style?.height !== "auto";
if (!hasExplicitHeight && finalWidth > 0) {
  const textMinHeight = measureSpecTextMinHeight(shapes, finalWidth, sizeSpec);
  if (textMinHeight !== undefined && textMinHeight > specHeight) {
    specHeight = textMinHeight;
    cardCalculatedHeight = textMinHeight; // → contentMinHeight
  }
}
const specNode = specShapesToSkia(shapes, "light", finalWidth, specHeight);
```

**핵심 규칙**:

- `measureSpecTextMinHeight`: TokenRef fontSize를 `resolveToken`으로 해석, `measureWrappedTextHeight`로 줄바꿈 높이 측정
- 한 줄이면 `undefined` 반환 → 기존 동작 유지
- 다중 줄이면 `paddingY * 2 + wrappedHeight` 반환
- 명시적 height 설정 시 auto-grow 비활성화 (`hasExplicitHeight` 체크)
- `updateTextChildren`이 box 자식도 재귀 처리하여 specNode 내부 텍스트 크기 갱신

### BlockEngine 경로 텍스트 줄바꿈 높이 (v1.15.1, 2026-02-15)

부모가 implicit block(display 미지정)일 때 **BlockEngine 경로**를 사용하며, `parseBoxModel` → `calculateContentHeight`로 높이를 계산합니다.

**문제**: `parseBoxModel`이 부모의 `availableWidth`를 `calculateContentHeight`에 전달하여, Button(width:80px)인데 부모 너비(400px)로 텍스트 줄바꿈을 판단 → 줄바꿈 미발생으로 계산 → 높이 미확장 → 아래 요소 겹침

**해결**: `parseBoxModel`에서 요소 자체의 border-box width를 `calculateContentHeight`에 전달

```typescript
// engines/utils.ts — parseBoxModel
const originalBorderBoxWidth = width; // border-box 변환 전 저장

if (treatAsBorderBox) {
  width = Math.max(0, width - paddingH - borderH); // content-box 변환
}

// 요소 자체 width 우선 사용 (부모 availableWidth 대신)
const elementAvailableWidth =
  originalBorderBoxWidth !== undefined && originalBorderBoxWidth !== FIT_CONTENT
    ? originalBorderBoxWidth
    : availableWidth;
const contentHeight = calculateContentHeight(element, elementAvailableWidth);
```

**두 경로 비교**:

| 경로             | 부모 조건             | 높이 반영                                   | 파일                                      |
| ---------------- | --------------------- | ------------------------------------------- | ----------------------------------------- |
| Flex 경로        | `display:flex` 명시적 | `enrichWithIntrinsicSize` → TaffyFlexEngine | `engines/utils.ts` + `TaffyFlexEngine.ts` |
| BlockEngine 경로 | display 미지정        | `parseBoxModel` → `calculateContentHeight`  | `engines/utils.ts`                        |

### Button padding:0 높이 축소 (v1.15.2, 2026-02-15)

Button에 `paddingTop: 0, paddingBottom: 0`을 설정해도 높이가 변하지 않는 문제를 수정합니다.

**원인 1 — (레거시, 해결됨)** Flex 경로 `height: 'auto'` 자기 강화:
Yoga 시절 `styleToLayout.ts`에서 Button `layout.height`를 명시적으로 계산하여 해결했으나, 현재는 `enrichWithIntrinsicSize()` (`engines/utils.ts`)에서 통합 처리됩니다. `styleToLayout.ts`는 W3-6에서 삭제 완료.

**원인 2 — BlockEngine `MIN_BUTTON_HEIGHT`가 인라인 padding 무시**:
`MIN_BUTTON_HEIGHT = 24`의 content-box 변환에서 `sizeConfig.paddingY`(기본값)만 사용하여 인라인 padding=0 미반영.

**해결**: 인라인 padding 설정 시 `MIN_BUTTON_HEIGHT` 미적용:

```typescript
// engines/utils.ts — calculateContentHeight
const hasInlinePadding =
  style?.padding !== undefined ||
  style?.paddingTop !== undefined ||
  style?.paddingBottom !== undefined;
const minContentHeight = hasInlinePadding
  ? 0 // 사용자가 padding 제어 → 최소 높이 제거
  : Math.max(
      0,
      MIN_BUTTON_HEIGHT - sizeConfig.paddingY * 2 - sizeConfig.borderWidth * 2,
    );
```

**원인 3 — `toNum` 함수 '0' 버그**:
`parseFloat('0') || undefined` → 0은 falsy → undefined 반환. `isNaN` 체크로 수정.

### props.style 오버라이드 (2026-02-12)

모든 49개 spec의 `render.shapes()`는 시각 속성에서 `props.style` 인라인 스타일을 우선 참조합니다:

- **우선순위**: `props.style > state variant color > variant default > spec size default`
- **텍스트 padding**: `props.style?.paddingLeft ?? props.style?.padding ?? size.paddingX`
- **maxWidth 자동 감소**: `shape.x > 0`이고 `maxWidth` 미지정 시, center -> `containerWidth - x*2`, left/right -> `containerWidth - x`
- **safety clamp**: `maxWidth < 1`이면 `containerWidth`로 폴백 (padding=0 안전 처리)

### specShapeConverter maxWidth 자동 축소와 레이아웃 너비 정합성 (CRITICAL)

`specShapeConverter.ts`는 텍스트 shape의 `x > 0`이고 `maxWidth`가 명시되지 않은 경우, 텍스트 오버플로를 방지하기 위해 `maxWidth`를 자동으로 축소합니다.

```typescript
// specShapeConverter.ts — text shape 처리
let maxWidth = shape.maxWidth ?? containerWidth;

// shape.x > 0이고 maxWidth 미지정 시 자동 축소
if (shape.x > 0 && shape.maxWidth == null) {
  if (shape.align === "center") {
    maxWidth = containerWidth - shape.x * 2; // 양쪽 대칭 여백
  } else {
    maxWidth = containerWidth - shape.x; // 왼쪽 여백만 제외
  }
  if (maxWidth < 1) maxWidth = containerWidth; // 안전 클램프
}
```

**이 로직이 Switch/Toggle 라벨 줄바꿈 버그와 연계되는 방식**:

Switch spec의 텍스트 shape `x` 좌표는 `trackWidth + gap` 값으로 설정됩니다 (예: md 크기 = 44 + 10 = 54px).
`specShapeConverter`는 `containerWidth - shape.x`로 텍스트 영역을 계산하므로,
**`containerWidth`(레이아웃 엔진 계산값)가 정확하지 않으면 텍스트 영역도 정확하지 않습니다.**

```
// ❌ 버그 시나리오 (수정 전)
// Switch.spec.ts: trackWidth = 44 (md)
// INLINE_FORM_INDICATOR_WIDTHS.switch.md = 34 (10px 부족)
// 레이아웃 엔진이 계산한 컴포넌트 너비: 34 + 10(gap) + textWidth = N px (10px 작음)
//
// specShapeConverter 처리:
//   containerWidth = N (10px 작은 값)
//   shape.x = 44 + 10 = 54 (spec 실제값)
//   maxWidth = N - 54 → 이미 부족한 N에서 또 54를 빼므로 텍스트 영역 심각하게 부족
//   → 라벨 줄바꿈 발생

// ✅ 수정 후
// INLINE_FORM_INDICATOR_WIDTHS.switch.md = 44 (spec trackWidth와 일치)
// 레이아웃 엔진이 계산한 컴포넌트 너비: 44 + 10(gap) + textWidth = M px (정확)
//
// specShapeConverter 처리:
//   containerWidth = M (정확한 값)
//   shape.x = 44 + 10 = 54
//   maxWidth = M - 54 → 텍스트 영역 정확히 textWidth만큼 확보
//   → 라벨 줄바꿈 없음
```

**핵심 규칙**: spec shapes의 `shape.x`(인디케이터 너비 + gap)는 레이아웃 엔진의 `INLINE_FORM_INDICATOR_WIDTHS + INLINE_FORM_GAPS`와 반드시 같은 값을 사용해야 합니다. 두 값이 어긋나면 `maxWidth` 자동 축소 로직이 잘못된 기준으로 동작합니다.

**Switch/Toggle spec shapes 텍스트 x 좌표 확인 방법**:

```typescript
// Switch.spec.ts (예시)
const sizes = {
  sm: { trackWidth: 36, trackHeight: 20, gap: 8,  ... },
  md: { trackWidth: 44, trackHeight: 24, gap: 10, ... },
  lg: { trackWidth: 52, trackHeight: 28, gap: 12, ... },
};

shapes: (props, variant, size, state) => {
  const s = sizes[props.size ?? 'md'];
  return [
    // 트랙 인디케이터 — x=0에서 trackWidth만큼
    { type: 'roundRect', x: 0, width: s.trackWidth, height: s.trackHeight, ... },
    // 라벨 텍스트 — x = trackWidth + gap
    { type: 'text', x: s.trackWidth + s.gap, ... },
    //                   ↑ 이 값이 INLINE_FORM_INDICATOR_WIDTHS + INLINE_FORM_GAPS와 일치해야 함
  ];
};
```

### Tabs Spec Shapes 렌더링

Tabs는 spec shapes 기반으로 tab bar 영역을 렌더링합니다. 콘텐츠 영역(Panel)은 CONTAINER_TAGS로 등록된 자식이 직접 렌더링합니다.

```
Tab bar 구성 도형:
  rect        — 탭 바 배경
  text x N    — 각 탭 레이블 (N = 탭 수)
  line        — 활성 탭 하단 선택 인디케이터
  line        — 탭 바 하단 구분선 (전체 너비)
```

**`_tabLabels` prop 동적 주입**:

- `effectiveElementWithTabs` 헬퍼가 Tabs 요소에 `_tabLabels: string[]` prop을 주입
- `shapes()` 함수는 `props._tabLabels ?? ['Tab 1', 'Tab 2', 'Tab 3']` 패턴으로 동적 레이블 처리

**fontSize TokenRef 해석**:
Tabs spec 내부에서 `props.style?.fontSize`가 TokenRef(`{ token: 'fontSize.sm' }` 형태)일 수 있으므로, `typeof fontSize === 'number'` 체크 후 height 기반 fallback 사용:

```typescript
// ✅ TokenRef 방어 처리 + height 기반 fallback
const rawFontSize = props.style?.fontSize ?? size.fontSize;
const fontSize =
  typeof rawFontSize === "number"
    ? rawFontSize
    : height <= 25
      ? 12 // sm
      : height <= 30
        ? 14 // md
        : 16; // lg (height >= 35)
```

**콘텐츠 기반 탭 너비 계산**:

```typescript
// ✅ 레이블 길이에 비례한 탭 너비 (최소 48px)
const charWidth = fontSize * 0.55; // Pretendard 평균 자폭 추정
const paddingX = size.paddingX ?? 12;
const tabWidth = Math.max(48, charWidth * label.length + paddingX * 2);
```

**size 기준 height**:

| size | height | fontSize fallback |
| ---- | ------ | ----------------- |
| `sm` | 25     | 12                |
| `md` | 30     | 14                |
| `lg` | 35     | 16                |

### TagGroup Spec Shapes 렌더링

TagGroup spec은 **시각적 컨테이너 요소만 렌더링**합니다. `label` prop에 해당하는 텍스트 콘텐츠는 spec shapes에 포함되지 않으며, **Label 자식 Element**가 TEXT_TAGS 경로 → TextSprite를 통해 별도 렌더링합니다.

**텍스트를 spec shapes에 넣지 않는 이유**:

- TagGroup은 CONTAINER_TAGS로 등록되어 Label, TagList 등 자식 Element를 Yoga 레이아웃 엔진이 직접 배치합니다.
- spec shapes의 고정 좌표 기반 텍스트와 자식 Label Element 렌더링이 동시에 존재하면 두 텍스트가 겹쳐 두 줄처럼 보이는 버그가 발생합니다 (2026-02-22 수정).
- Label Element는 TEXT_TAGS 경로로 독립 크기 측정과 레이아웃 반영이 가능하므로 spec shapes 중복이 불필요합니다.

```typescript
// ✅ TagGroup.spec.ts — 배경/테두리 등 시각 컨테이너 요소만 shapes로 반환
const TagGroupSpec: ComponentSpec<TagGroupProps> = {
  render: {
    shapes: (props, variant, size) => {
      return [
        // 배경 (필요 시)
        {
          id: 'bg',
          type: 'roundRect',
          x: 0,
          y: 0,
          width: 'auto',   // ← 반드시 'auto'
          height: 'auto',  // ← 반드시 'auto'
          radius: props.style?.borderRadius ?? size.borderRadius,
          fill: props.style?.backgroundColor ?? 'transparent',
        },
        // label 텍스트 shape은 포함하지 않음
        // → Label 자식 Element가 TEXT_TAGS → TextSprite 경로로 별도 렌더링
        // → spec shapes에 label을 추가하면 두 번 렌더링되어 두 줄처럼 보임
      ];
    },
  },
};

// ❌ TagGroup spec shapes에 label 텍스트 도형 추가 금지
// 이유 1: Label 자식 Element와 이중으로 표시됨 → 두 줄 렌더링 버그
// 이유 2: fontSize 불일치 시 시각적 불일치 (spec 12px vs 자식 Element 14px)
{
  type: 'text',
  text: props.label,  // Label 자식 Element가 이미 렌더링하므로 중복
  fontSize: 12,
  ...
}
```

**TagGroup Spec 구조 요약 (shapes 내부)**:

| shape     | 타입        | 역할                                                   |
| --------- | ----------- | ------------------------------------------------------ |
| (선택) bg | `roundRect` | 컨테이너 배경 (`width: 'auto'`, `height: 'auto'` 필수) |

텍스트 관련 shape은 없음. 텍스트는 자식 Element(Label)가 담당.

**자식 Element 렌더링 흐름**:

```typescript
// TagGroup 자식 렌더링 흐름
// 1. TagGroup → CONTAINER_TAGS 경로
// 2. childElements = [Label, TagList, ...]
// 3. Label → TEXT_TAGS 조건 → TextSprite 렌더링
// 4. TagList → CONTAINER_TAGS 경로 → Tag 칩들을 row wrap으로 배치
```

**TagGroup Spec 렌더링 책임 분리 요약**:

| 역할               | 담당                                                    |
| ------------------ | ------------------------------------------------------- |
| 배경, 테두리       | TagGroup spec shapes (specShapesToSkia)                 |
| label 텍스트       | Label 자식 Element (TextSprite)                         |
| Tag 칩 배치        | TagList 자식 Element (CONTAINER_TAGS, row wrap)         |
| 레이아웃 크기 결정 | isYogaSizedContainer — Yoga가 Label + TagList 높이 합산 |

## TagGroup/TagList: TAG_SPEC_MAP 제거 -> CONTAINER_TAGS 전환 (2026-02-13)

TagGroup과 TagList는 기존에 TAG_SPEC_MAP에 등록되어 spec shapes로 렌더링되었으나, 이제 **CONTAINER_TAGS로 전환**되어 자식 요소를 내부에서 직접 렌더링하는 컨테이너 방식으로 변경되었습니다.

### 변경 이유

TagGroup/TagList는 웹 CSS의 flex container 구조와 동일하게 동작해야 합니다:

- **TagGroup**: `flexDirection: column` -- Label과 TagList를 세로로 배치
- **TagList**: `flexDirection: row, flexWrap: wrap` -- Tag 칩들을 가로로 배치하되 줄바꿈 허용

spec shapes는 고정된 시각 도형을 반환하므로 자식 요소의 동적 배치(wrap, 줄바꿈)를 처리할 수 없습니다. CONTAINER_TAGS로 등록하면 Yoga 레이아웃 엔진이 자식 요소를 실제 flex 규칙에 따라 배치합니다.

### 코드 변경

```typescript
// apps/builder/src/builder/workspace/canvas/BuilderCanvas.tsx

// CONTAINER_TAGS에 추가 (자식을 내부에서 렌더링하는 컨테이너 태그)
const CONTAINER_TAGS = useMemo(
  () =>
    new Set([
      "Card",
      "Box",
      "Panel",
      "Form",
      "Group",
      "Dialog",
      "Modal",
      "Disclosure",
      "DisclosureGroup",
      "Accordion",
      "ToggleButtonGroup",
      "TagGroup",
      "TagList", // <- 웹 CSS 구조 동일: TagGroup (column) -> Label + TagList (row wrap) -> Tags
      "Tabs", // <- tab bar는 spec shapes, Panel 자식은 CONTAINER_TAGS 경로
    ]),
  [],
);

// TAG_SPEC_MAP에서는 TagGroup, TagList 항목이 제거됨
// (ElementSprite.tsx의 TAG_SPEC_MAP에 해당 태그 없음)
```

## isYogaSizedContainer 패턴 (2026-02-13)

ToggleButtonGroup, TagGroup, TagList는 `isYogaSizedContainer`로 분류되어, Yoga가 자식 크기에 맞춰 컨테이너 크기를 자동 계산합니다.

### 대상 태그

| 태그                | 레이아웃 | 설명                          |
| ------------------- | -------- | ----------------------------- |
| `ToggleButtonGroup` | row      | 자식 ToggleButton 너비 합산   |
| `TagGroup`          | column   | Label + TagList 높이 합산     |
| `TagList`           | row wrap | Tag 칩들의 가로 배치 + 줄바꿈 |

### 동작 방식

```typescript
// apps/builder/src/builder/workspace/canvas/BuilderCanvas.tsx

const isToggleButtonGroup = child.type === "ToggleButtonGroup";
const isFlexContainerTag =
  child.type === "TagGroup" || child.type === "TagList";
const isYogaSizedContainer = isToggleButtonGroup || isFlexContainerTag;

// Yoga 크기 결정 컨테이너: 명시적 width 설정 여부에 따라 분기
const hasExplicitWidth =
  isYogaSizedContainer &&
  childStyle?.width !== undefined &&
  childStyle.width !== "fit-content";

const containerWidthOverride = isYogaSizedContainer
  ? hasExplicitWidth
    ? { width: layout.width } // 명시적 width -> BlockEngine 계산값
    : { width: "auto", flexGrow: 0, flexShrink: 0 } // 기본 -> Yoga 자동 계산
  : { width: layout.width };
```

**핵심 규칙**:

- `width: 'auto'` + `flexGrow: 0` + `flexShrink: 0` = Yoga가 자식 요소의 intrinsic 크기를 기반으로 컨테이너 크기를 결정
- `flexGrow: 0`은 남은 공간을 차지하지 않도록 방지
- `flexShrink: 0`은 부모 공간이 부족해도 자식 크기를 축소하지 않도록 방지
- `height: 'auto'`로 항상 설정되며, `minHeight`도 적용하지 않음 (`isYogaSizedContainer ? {} : { minHeight: layout.height }`)
- 사용자가 명시적으로 `width: '100%'` 등을 설정한 경우에는 BlockEngine이 계산한 `layout.width`를 사용

## 참조

- `docs/COMPONENT_SPEC.md` - Shape 타입 정의
- `apps/builder/src/.../skia/specShapeConverter.ts` - Shape[] -> SkiaNodeData 변환
- `apps/builder/src/.../sprites/ElementSprite.tsx` - getSpecForTag(), spec shapes 통합, TAG_SPEC_MAP
- `apps/builder/src/.../skia/nodeRenderers.ts` - renderLine() 포함 Skia 렌더
- `apps/builder/src/.../canvas/BuilderCanvas.tsx` - CONTAINER_TAGS, isYogaSizedContainer 정의
- [pixi-hybrid-layout-engine](pixi-hybrid-layout-engine.md#container-props-주입-패턴-container_props_injection) - Container Props 주입 패턴 상세
