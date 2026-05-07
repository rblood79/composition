---
title: Non-layout Container Hit Rect for Padded Containers
impact: CRITICAL
impactDescription: 컨테이너 요소 선택 불가 버그 방지, 히트 영역 정확성
tags: [pixi, layout, interaction, container, yoga, hit-area]
---

Yoga 3의 absolute positioning이 부모 padding만큼 자식을 offset하기 때문에, padding이 있는 컨테이너(CONTAINER_TAGS)에서 `position: absolute` BoxSprite의 히트 영역이 컨테이너 실제 bounds와 불일치합니다. **`layout` prop 없는 `pixiGraphics`를 컨테이너 첫 번째 자식으로 추가**하여 해결합니다.

## 문제

CONTAINER_TAGS(TagGroup, TagList, Card, Tabs 등)가 flex/grid 레이아웃을 사용하고 padding이 있을 때:

1. BoxSprite는 `<pixiContainer layout={{ position: 'absolute', ... }}>` 안에 배치됨
2. Yoga 3이 absolute 자식을 부모 padding 안쪽으로 offset함
3. BoxSprite의 히트 영역이 padding 영역을 커버하지 못함
4. 결과: 컨테이너의 padding 영역 클릭 시 요소 선택 불가

```
┌─────────────────────────────┐  ← 컨테이너 실제 bounds (padding 포함)
│  padding                    │
│  ┌─────────────────────┐    │
│  │  BoxSprite 히트 영역  │    │  ← Yoga가 absolute 자식을 padding만큼 offset
│  │                     │    │
│  └─────────────────────┘    │
│         클릭 불가 영역 ↑      │
└─────────────────────────────┘
```

## 핵심 원리

`@pixi/layout`에서 `layout` prop이 없는 자식 노드는 Yoga 레이아웃 계산에서 **완전히 무시**됩니다. 따라서:

- Yoga가 위치를 offset하지 않음 → 컨테이너 로컬 원점 `(0, 0)`에 고정
- `computedW x computedH` (padding 포함된 Yoga 계산 크기)로 rect를 그리면 컨테이너 전체 bounds를 정확히 커버
- 기존 레이아웃에 영향 없음

## Incorrect

```tsx
// ❌ pixiContainer absolute 래퍼만 사용 → padding 영역에 히트 영역 없음
<>
  <pixiContainer layout={{ position: 'absolute', left: 0, top: 0, right: 0, bottom: 0 }}>
    <BoxSprite
      computedW={computedW}
      computedH={computedH}
      eventMode="static"
      cursor="pointer"
      onPointerDown={handleContainerPointerDown}
    />
  </pixiContainer>
  {childElements.map(...)}
</>
```

## Correct

```tsx
// ✅ Non-layout pixiGraphics를 첫 번째 자식으로 추가
// - layout prop 없음 → Yoga 무시 → 컨테이너 원점(0,0) 고정
// - computedW x computedH로 전체 bounds 커버

// Hook (조건부 return 전에 선언 필수):
const drawContainerHitRect = useCallback(
  (g: PixiGraphics) => {
    g.clear();
    const w = computedW ?? 0;
    const h = computedH ?? 0;
    if (w <= 0 || h <= 0) return;
    g.rect(0, 0, w, h);
    const debug = isDebugHitAreas();
    g.fill(debug
      ? { color: DEBUG_HIT_AREA_COLORS.box.color, alpha: DEBUG_HIT_AREA_COLORS.box.alpha }
      : { color: 0xffffff, alpha: 0.001 });
  },
  [computedW, computedH],
);

// JSX (flex/grid/box 컨테이너에서 childElements가 있을 때):
<>
  <pixiGraphics
    draw={drawContainerHitRect}
    eventMode="static"
    cursor="pointer"
    onPointerDown={handleContainerPointerDown}
  />
  <pixiContainer layout={{ position: 'absolute', left: 0, top: 0, right: 0, bottom: 0 }}>
    <BoxSprite ... />
  </pixiContainer>
  {childElements.map(...)}
</>
```

## 적용 위치

- **파일**: `ElementSprite.tsx`의 flex/grid/box 컨테이너 렌더링 케이스
- **조건**: `childElements.length > 0`인 컨테이너 (CONTAINER_TAGS)
- **새 컨테이너 타입 추가 시**: 반드시 이 패턴을 적용해야 padding이 있는 컨테이너에서 클릭이 정상 동작함

## Tabs 컨테이너 히트 영역

Tabs는 CONTAINER_TAGS에 등록된 복합 컨테이너입니다. tab bar 영역은 spec shapes로 렌더링되고, 활성 Panel 자식은 컨테이너 내부에서 직접 렌더링됩니다.

### PixiTabs 구조

```tsx
// PixiTabs 컴포넌트: 투명 히트 영역 + 활성 Panel 자식 렌더링
<>
  {/* Non-layout 히트 영역: 전체 Tabs bounds 커버 */}
  <pixiGraphics
    draw={drawContainerHitRect}
    eventMode="static"
    cursor="pointer"
    onPointerDown={handleContainerPointerDown}
  />
  {/* spec shapes로 tab bar 렌더링 (BoxSprite 경유) */}
  <pixiContainer layout={{ position: 'absolute', left: 0, top: 0, right: 0, bottom: 0 }}>
    <BoxSprite ... />
  </pixiContainer>
  {/* 활성 Panel 자식만 렌더링 */}
  {activePanelChildren.map(renderChildElement)}
</>
```

### CONTAINER_TAGS 등록

`BuilderCanvas.tsx`의 CONTAINER_TAGS Set에 `'Tabs'`를 추가해야 `childElements`와 `renderChildElement` props를 수신합니다:

```typescript
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
      "TagList",
      "Tabs", // <- childElements/renderChildElement props 수신
    ]),
  [],
);
```

### Panel 필터링 및 탭 클릭 처리

```typescript
// PixiTabs 내부: 첫 번째 Panel 자식만 렌더링
const activePanelChildren = childElements
  .filter((c) => c.type === "Panel")
  .slice(0, 1); // 현재는 첫 번째 Panel만 표시 (activeTab 연동 시 확장)

// 탭 클릭: 개별 탭 영역이 아닌 전체 Tabs 컨테이너 히트 영역에서 처리
// → tab bar 내 탭 구분은 X 좌표 기반으로 계산
const handleTabBarPointerDown = (e: FederatedPointerEvent) => {
  const localX = e.getLocalPosition(tabBarContainer).x;
  // tabWidths 배열로 클릭된 탭 인덱스 계산
  const clickedIndex = resolveTabIndex(localX, tabWidths);
  setActiveTab(clickedIndex);
};
```

### 핵심 규칙 요약

- Tabs는 CONTAINER_TAGS에 등록 → `childElements`/`renderChildElement` props 수신
- Panel 필터링: `childElements.filter(c => c.type === 'Panel').slice(0, 1)`
- 탭 클릭 히트 영역: 전체 Tabs 영역 단일 히트 (개별 탭 영역 별도 등록 불필요)
- `drawContainerHitRect`는 조건부 return 전에 선언 필수 (React Hooks 규칙)

## Card 컨테이너 히트 영역

Card는 CONTAINER_TAGS에 등록된 복합 컨테이너입니다. 배경/테두리/그림자는 spec shapes로 렌더링되고, `title`/`description`에 해당하는 Heading/Description은 `childElements`로 분리되어 별도 렌더링됩니다.

### PixiCard 구조

```tsx
// PixiCard 컴포넌트: 투명 히트 영역 + spec shapes(배경·테두리·그림자) + 자식 렌더링
<>
  {/* Non-layout 히트 영역: 전체 Card bounds 커버 */}
  <pixiGraphics
    draw={drawContainerHitRect}
    eventMode="static"
    cursor="pointer"
    onPointerDown={handleContainerPointerDown}
  />
  {/* spec shapes로 배경·테두리·그림자 렌더링 (BoxSprite 경유) */}
  <pixiContainer
    layout={{ position: "absolute", left: 0, top: 0, right: 0, bottom: 0 }}
  >
    <BoxSprite
      computedW={computedW}
      computedH={computedH}
      /* Card spec은 title/description 텍스트 shapes를 포함하지 않음 */
    />
  </pixiContainer>
  {/* Heading, Description 등 자식 Element 렌더링 */}
  {childElements.map(renderChildElement)}
</>
```

### CONTAINER_TAGS 등록 및 childElements 구성

```typescript
// BuilderCanvas.tsx — CONTAINER_TAGS에 Card 포함
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
      // ... 기타 컨테이너
    ]),
  [],
);

// Card의 childElements 예시
// Card
// ├── Heading      (TEXT_TAGS → TextSprite 경로)
// └── Description  (TEXT_TAGS → TextSprite 경로)
```

### calculateContentHeight: childElements 우선 높이 계산

Card의 높이는 자식 Element(Heading, Description 등)의 실제 높이 합산을 우선 사용합니다. `LayoutContext.getChildElements`로 자식 목록을 조회하여 각 Element의 높이를 합산합니다.

```typescript
// engines/utils.ts — calculateContentHeight
if (type === "card" && context?.getChildElements) {
  const children = context.getChildElements(element.id);
  if (children.length > 0) {
    // 자식 각각의 높이 합산 (padding/gap 포함)
    const childrenTotalHeight = sumChildHeights(
      children,
      availableWidth,
      context,
    );
    return Math.max(childrenTotalHeight, 0);
  }
}
// 자식이 없으면 기본 최소 높이 반환
return MIN_CARD_HEIGHT;

// ❌ Card에서 childElements 무시 → 내용에 따른 높이 자동 확장 안 됨
return calculateTextHeight(element, availableWidth);
```

**높이 계산 우선순위**:

| 조건                 | 높이 결정 방식                              |
| -------------------- | ------------------------------------------- |
| 명시적 `height` 지정 | 사용자 지정값 (border-box 기준)             |
| `childElements` 존재 | 자식 Element 높이 합산 (padding + gap 포함) |
| 자식 없음            | `MIN_CARD_HEIGHT` 기본값                    |

### 핵심 규칙 요약

- Card는 CONTAINER_TAGS에 등록 → `childElements`/`renderChildElement` props 수신
- `childElements` 필터링 없음 (Heading, Description 모두 렌더링)
- spec shapes는 배경·테두리·그림자만 담당, 텍스트는 자식 Element가 담당
- `drawContainerHitRect`는 전체 Card bounds(`computedW x computedH`)를 커버
- Card 높이는 `calculateContentHeight`에서 `childElements` 높이 합산 우선 사용

## Select/ComboBox 컨테이너 히트 영역 (2026-02-22 추가)

Select와 ComboBox는 CONTAINER_TAGS에 등록된 Form 복합 컨테이너입니다. 구조적 자식(SelectValue, SelectIcon, ComboBoxInput, ComboBoxTrigger)은 **투명 BoxSprite로 렌더링되어 히트 영역만 담당**하며, spec shapes가 시각 렌더링(테두리, 배경, 아이콘 등)을 처리합니다.

### 레이아웃 구조

| 태그              | 배치 방식               | 기본 크기                                 |
| ----------------- | ----------------------- | ----------------------------------------- |
| `Select`          | flex column, gap: 8     | Label + SelectTrigger 세로 배치           |
| `SelectTrigger`   | flex row, h: 34, px: 14 | SelectValue + SelectIcon 가로 배치        |
| `ComboBox`        | flex column, gap: 8     | Label + ComboBoxWrapper 세로 배치         |
| `ComboBoxWrapper` | flex row, h: 30, px: 14 | ComboBoxInput + ComboBoxTrigger 가로 배치 |

### 자식 히트 영역 크기

| 태그              | 크기                  | 역할                    |
| ----------------- | --------------------- | ----------------------- |
| `SelectValue`     | flex: 1 (나머지 공간) | placeholder 텍스트 영역 |
| `SelectIcon`      | 18×18                 | chevron 아이콘 영역     |
| `ComboBoxInput`   | flex: 1 (나머지 공간) | input 영역              |
| `ComboBoxTrigger` | 18×18                 | dropdown 버튼 영역      |

### PixiSelect 구조

```tsx
// PixiSelect 컴포넌트: 투명 히트 영역 + Label + SelectTrigger 자식 렌더링
<>
  {/* Non-layout 히트 영역: 전체 Select bounds 커버 */}
  <pixiGraphics
    draw={drawContainerHitRect}
    eventMode="static"
    cursor="pointer"
    onPointerDown={handleContainerPointerDown}
  />
  {/* spec shapes로 외곽선·배경 렌더링 (BoxSprite 경유) */}
  <pixiContainer layout={{ position: 'absolute', left: 0, top: 0, right: 0, bottom: 0 }}>
    <BoxSprite computedW={computedW} computedH={computedH} />
  </pixiContainer>
  {/* Label, SelectTrigger 자식 렌더링 */}
  {childElements.map(renderChildElement)}
</>

// PixiSelectTrigger: SelectValue(flex:1) + SelectIcon(18×18) 투명 히트 영역
<>
  <pixiGraphics
    draw={drawContainerHitRect}
    eventMode="static"
    cursor="pointer"
    onPointerDown={handleContainerPointerDown}
  />
  <pixiContainer layout={{ position: 'absolute', left: 0, top: 0, right: 0, bottom: 0 }}>
    <BoxSprite computedW={computedW} computedH={computedH} />
  </pixiContainer>
  {childElements.map(renderChildElement)}  {/* SelectValue, SelectIcon */}
</>
```

### CONTAINER_TAGS 등록

`BuilderCanvas.tsx`의 CONTAINER_TAGS Set에 4개 태그를 추가해야 `childElements`와 `renderChildElement` props를 수신합니다:

```typescript
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
      "TagList",
      "Tabs",
      "Select",
      "SelectTrigger", // <- 2026-02-22 추가
      "ComboBox",
      "ComboBoxWrapper", // <- 2026-02-22 추가
    ]),
  [],
);
```

### 자식 구조 예시

```
Select
├── Label           (TEXT_TAGS → TextSprite 경로)
└── SelectTrigger   (CONTAINER_TAGS → 투명 히트 영역 + 자식 렌더링)
    ├── SelectValue (TEXT_TAGS → TextSprite, flex:1)
    └── SelectIcon  (ICON_TAGS → IconSprite, 18×18)

ComboBox
├── Label             (TEXT_TAGS → TextSprite 경로)
└── ComboBoxWrapper   (CONTAINER_TAGS → 투명 히트 영역 + 자식 렌더링)
    ├── ComboBoxInput   (INPUT_TAGS → InputSprite, flex:1)
    └── ComboBoxTrigger (ICON_TAGS → IconSprite, 18×18)
```

### 핵심 규칙 요약

- `Select`, `SelectTrigger`, `ComboBox`, `ComboBoxWrapper` 모두 CONTAINER_TAGS에 등록
- 구조적 자식(SelectValue, SelectIcon, ComboBoxInput, ComboBoxTrigger)은 투명 BoxSprite → 히트 영역 전담
- spec shapes가 시각 렌더링(테두리, 배경, chevron 아이콘 등) 담당 → 중복 렌더링 방지
- `drawContainerHitRect`는 조건부 return 전에 선언 필수 (React Hooks 규칙)

## 디버그

`VITE_DEBUG_HIT_AREAS=true` 환경변수로 히트 영역을 시각적으로 확인할 수 있습니다. 활성화 시 `DEBUG_HIT_AREA_COLORS`에 정의된 색상으로 히트 영역이 반투명하게 표시됩니다.

```bash
# .env.local
VITE_DEBUG_HIT_AREAS=true
```

## 체크리스트

새 CONTAINER_TAG 추가 시 확인사항:

- [ ] `drawContainerHitRect` hook이 조건부 return 전에 선언되어 있는가?
- [ ] `<pixiGraphics>`에 `layout` prop이 **없는가**? (있으면 Yoga가 offset 적용)
- [ ] `eventMode="static"`이 설정되어 있는가?
- [ ] `onPointerDown` 핸들러가 연결되어 있는가?
- [ ] `computedW`, `computedH`가 Yoga 계산 크기(padding 포함)를 사용하는가?
- [ ] 디버그 모드에서 히트 영역이 컨테이너 전체를 커버하는지 확인했는가?
- [ ] (Tabs 한정) `CONTAINER_TAGS`에 `'Tabs'`가 등록되어 있는가?
- [ ] (Tabs 한정) Panel 자식 필터링이 `type === 'Panel'` 조건을 사용하는가?
- [ ] (Card 한정) spec shapes에 텍스트 도형이 포함되지 않았는가? (중복 렌더링 방지)
- [ ] (Card 한정) `calculateContentHeight`가 `childElements` 높이 합산을 우선 사용하는가?
- [ ] (Select/ComboBox 한정) `Select`, `SelectTrigger`, `ComboBox`, `ComboBoxWrapper` 4개 모두 CONTAINER_TAGS에 등록되어 있는가?
- [ ] (Select/ComboBox 한정) 구조적 자식(SelectValue, SelectIcon, ComboBoxInput, ComboBoxTrigger)이 투명 BoxSprite로 렌더링되는가? (spec shapes와 중복 렌더링 방지)
