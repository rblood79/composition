# ToggleButtonGroup Indicator Enhancement

## 개요

ToggleButtonGroup 컴포넌트의 indicator가 선택되지 않은 상태일 때 자동으로 사라지도록 개선하여, mutually exclusive button groups에서 올바르게 동작하도록 수정했습니다.

## 문제

### 증상

Inspector의 Flexbox 컨트롤에서 다음과 같은 문제가 발생:

1. **3x3 Grid Alignment** 버튼 클릭 → `justifyContent: center, alignItems: center` 설정
2. **Spacing** 버튼(`space-evenly`) 클릭 → `justifyContent: space-evenly` 설정
3. **문제**: 3x3 Grid의 indicator가 여전히 표시됨 ❌

### 원인

`selectedKeys`가 빈 배열 `[]`이 되어도 indicator의 CSS가 마지막 위치에 그대로 남아있었습니다:

```typescript
// ToggleButtonGroup.tsx (기존 코드)
if (selectedButton) {
  // indicator 위치 설정
  group.style.setProperty('--indicator-left', `${left}px`);
  group.style.setProperty('--indicator-width', `${width}px`);
} else {
  console.log('No selected button found');
  // ❌ 아무 처리도 하지 않음 → indicator가 마지막 위치에 남음
}
```

## 해결 방법

### 1. opacity 기반 숨김 처리

선택된 버튼이 없을 때 `--indicator-opacity: 0`으로 설정:

**파일**: `src/builder/components/ToggleButtonGroup.tsx`

```typescript
const selectedButton = group.querySelector('[data-selected]') as HTMLElement;

if (selectedButton) {
  // 선택된 버튼이 있을 때: indicator 표시
  const groupRect = group.getBoundingClientRect();
  const buttonRect = selectedButton.getBoundingClientRect();

  const left = buttonRect.left - groupRect.left;
  const top = buttonRect.top - groupRect.top;
  const width = buttonRect.width;
  const height = buttonRect.height;

  group.style.setProperty('--indicator-left', `${left}px`);
  group.style.setProperty('--indicator-top', `${top}px`);
  group.style.setProperty('--indicator-width', `${width}px`);
  group.style.setProperty('--indicator-height', `${height}px`);
  group.style.setProperty('--indicator-opacity', '1'); // ✅ 표시
} else {
  // 선택된 버튼이 없을 때: indicator 숨김
  console.log('No selected button found - hiding indicator');
  group.style.setProperty('--indicator-opacity', '0'); // ✅ 숨김
}
```

### 2. CSS 업데이트

indicator에 opacity transition 추가:

**파일**: `src/builder/components/components.css`

```css
.react-aria-ToggleButtonGroup[data-indicator="true"] {
  --indicator-left: 0px;
  --indicator-width: 0px;
  --indicator-height: 0px;
  --indicator-top: 0px;
  --indicator-opacity: 0; /* ✅ 기본값: 숨김 */

  &::before {
    content: "";
    position: absolute;
    width: var(--indicator-width);
    height: var(--indicator-height);
    transform: translateX(var(--indicator-left)) translateY(var(--indicator-top));
    background: var(--color-primary-600);
    opacity: var(--indicator-opacity); /* ✅ opacity 적용 */
    transition: transform 200ms ease-out,
                width 200ms ease-out,
                height 200ms ease-out,
                opacity 200ms ease-out; /* ✅ opacity transition 추가 */
  }
}
```

## 동작 원리

### MutationObserver

ToggleButtonGroup은 MutationObserver를 사용하여 `data-selected` 속성 변경을 감지:

```typescript
useEffect(() => {
  if (!indicator) return;

  const group = groupRef.current;
  if (!group) return;

  const updateIndicator = () => {
    const selectedButton = group.querySelector('[data-selected]');

    if (selectedButton) {
      // 위치 계산 및 opacity: 1
    } else {
      // opacity: 0
    }
  };

  // 초기 업데이트
  updateIndicator();

  // MutationObserver로 변경 감지
  const observer = new MutationObserver(updateIndicator);
  observer.observe(group, {
    attributes: true,
    subtree: true,
    attributeFilter: ['data-selected']
  });

  return () => observer.disconnect();
}, [indicator, selectedKeys]);
```

### Transition 타이밍

```
Button Click
  ↓
React Aria updates data-selected attribute
  ↓
MutationObserver triggers updateIndicator()
  ↓
CSS custom property --indicator-opacity updated
  ↓
CSS transition (200ms ease-out)
  ↓
Smooth fade in/out
```

## 사용 사례: Mutually Exclusive Groups

### Inspector Flexbox Controls

**3x3 Grid vs Spacing Buttons**

```typescript
// 3x3 Grid Alignment
<ToggleButtonGroup
  indicator
  selectionMode="single"
  selectedKeys={getFlexAlignmentKeys(element)} // 배열 or []
  onSelectionChange={(keys) => {
    // justifyContent: flex-start/center/flex-end
    // alignItems: flex-start/center/flex-end
  }}
>

// Spacing Buttons
<ToggleButtonGroup
  indicator
  selectionMode="single"
  selectedKeys={getJustifyContentSpacingKeys(element)} // 배열 or []
  onSelectionChange={(keys) => {
    // justifyContent: space-around/space-between/space-evenly
  }}
>
```

**Helper Functions**

```typescript
// 3x3 Grid: spacing 값일 때 빈 배열 반환
function getFlexAlignmentKeys(element: SelectedElement): string[] {
  const justifyContent = getStyleValue(element, "justifyContent", "");

  const spacingValues = ["space-around", "space-between", "space-evenly"];
  if (spacingValues.includes(justifyContent)) {
    return []; // ✅ indicator 숨김
  }

  // flex-start, center, flex-end 조합 반환
  // ...
}

// Spacing: flex-start/center/flex-end일 때 빈 배열 반환
function getJustifyContentSpacingKeys(element: SelectedElement): string[] {
  const justifyContent = getStyleValue(element, "justifyContent", "");

  if (justifyContent === "space-around") return ["space-around"];
  if (justifyContent === "space-between") return ["space-between"];
  if (justifyContent === "space-evenly") return ["space-evenly"];

  return []; // ✅ indicator 숨김
}
```

## 동작 시나리오

### 시나리오 1: 3x3 Grid → Spacing

```
1. User clicks "centerCenter" button (3x3 grid)
   → selectedKeys: ["centerCenter"]
   → indicator opacity: 1 (표시)
   → justifyContent: center, alignItems: center

2. User clicks "space-evenly" button (spacing)
   → justifyContent: space-evenly
   → getFlexAlignmentKeys() returns [] (spacing 값 감지)
   → selectedKeys: []
   → indicator opacity: 0 (숨김) ✅

3. Spacing button group
   → getJustifyContentSpacingKeys() returns ["space-evenly"]
   → selectedKeys: ["space-evenly"]
   → indicator opacity: 1 (표시) ✅
```

### 시나리오 2: Spacing → 3x3 Grid

```
1. User clicks "space-between" button (spacing)
   → selectedKeys: ["space-between"]
   → indicator opacity: 1 (표시)
   → justifyContent: space-between

2. User clicks "leftTop" button (3x3 grid)
   → justifyContent: flex-start, alignItems: flex-start
   → getJustifyContentSpacingKeys() returns [] (spacing 아님)
   → selectedKeys: []
   → indicator opacity: 0 (숨김) ✅

3. 3x3 Grid button group
   → getFlexAlignmentKeys() returns ["leftTop"]
   → selectedKeys: ["leftTop"]
   → indicator opacity: 1 (표시) ✅
```

## 결과

### ✅ 수정 완료

1. **Opacity-based hiding**
   - `selectedKeys: []`일 때 indicator 자동 숨김
   - CSS transition으로 부드러운 fade out

2. **Mutually exclusive groups 지원**
   - 3x3 Grid ↔ Spacing buttons 완벽 전환
   - 각 그룹의 indicator 독립적으로 표시/숨김

3. **일관된 사용자 경험**
   - 시각적 피드백 명확
   - 어떤 그룹이 활성화되었는지 직관적으로 표시

### 📊 성능

- **MutationObserver**: DOM 변경 감지 (효율적)
- **CSS transitions**: GPU 가속 (부드러운 애니메이션)
- **Minimal re-renders**: selectedKeys 변경 시에만 업데이트

## WebGL Canvas 구현 (2026-02-04)

### Container-only 패턴

ToggleButtonGroup은 **container-only** 패턴으로 구현됩니다:
- `PixiToggleButtonGroup.tsx`는 배경(pixiGraphics)만 렌더링
- 자식 ToggleButton들은 `ElementsLayer`에서 형제(sibling)로 개별 렌더링
- ToggleButtonGroup은 `CONTAINER_TAGS`에 포함되지 않음

### 렌더링 구조

```
LayoutContainer (toggleButtonGroupId, containerLayout from styleToLayout)
  ├─ ElementSprite → PixiToggleButtonGroup → pixiGraphics (배경 + hit area)
  ├─ LayoutContainer (toggleButton1Id) → ElementSprite → PixiToggleButton
  └─ LayoutContainer (toggleButton2Id) → ElementSprite → PixiToggleButton
```

### 선택(Selection) 처리

```tsx
// pixiGraphics 직접 반환 (BoxSprite 패턴)
// - layout 속성 없음 → Yoga flex에 미참여 (자식 ToggleButton과 경쟁 없음)
// - eventMode="static" → 배경 영역 클릭 시 그룹 선택
// - LayoutComputedSizeContext → Yoga computed size로 hit area 크기 결정
return (
  <pixiGraphics
    draw={drawGroupBackground}
    eventMode="static"
    cursor="pointer"
    onPointerDown={handleGroupClick}
  />
);
```

**주의사항:**
- `computedSize.height`가 0일 수 있음 → `??` 대신 `> 0` 명시적 체크 필요
- 자식 ToggleButton이 z-order 위에 있으므로, 버튼 영역 클릭 시 자식이 선택됨
- 배경 영역(자식 버튼 외 영역) 클릭 시 ToggleButtonGroup이 선택됨

### width/height 스타일 적용

- 외부 `LayoutContainer`가 `styleToLayout`을 통해 width/height 처리
- 내부 `PixiToggleButtonGroup`은 배경 크기를 `LayoutComputedSizeContext`에서 가져옴
- `@pixi/layout`의 `formatStyles` 캐싱 때문에 `styleToLayout.ts`에서 `width: 'auto'` 명시적 설정 필요 **(Phase 11에서 @pixi/layout 제거됨 — 이 이슈는 더 이상 발생하지 않음)**

### 수정된 파일

- `apps/builder/src/builder/workspace/canvas/ui/PixiToggleButtonGroup.tsx` - 선택, 크기 적용
- `apps/builder/src/builder/workspace/canvas/layout/styleToLayout.ts` - auto 기본값 명시
- `src/builder/components/property/PropertyUnitInput.tsx` - 키워드 유닛 버그 수정

## 캔버스 SelectionIndicator 구현 계획

> **상태**: 📋 Planning
> **우선순위**: P2
> **작성일**: 2026-02-19
> **선행 참조**: PixiTabs.tsx `drawIndicator()` 패턴

### 현재 상태

| 영역 | Indicator 지원 | 비고 |
|------|---------------|------|
| **CSS 웹 (Preview)** | ✅ | React Aria 1.13.0 `SelectionIndicator` + CSS transition |
| **캔버스 (CanvasKit/Skia)** | ❌ | `PixiToggleButtonGroup.tsx`에 배경만 렌더링, indicator 미구현 |

### 문제

`indicator={true}` prop이 설정된 ToggleButtonGroup은 웹 Preview에서 선택된 버튼 뒤에 하이라이트 배경 박스가 슬라이드 이동하지만, 캔버스에서는 해당 시각 피드백이 없음.

### CSS 웹 동작 (참조)

```css
/* ToggleButtonGroup.css — indicator 활성 시 */
&[data-indicator="true"] {
  .react-aria-ToggleButton .react-aria-SelectionIndicator {
    position: absolute;
    inset: 0;
    z-index: -1;
    border-radius: var(--radius-sm);
    background: var(--surface-container-high);
    box-shadow: var(--shadow-sm);
    transition: translate 200ms cubic-bezier(0.16, 1, 0.3, 1),
                width 200ms cubic-bezier(0.16, 1, 0.3, 1),
                height 200ms cubic-bezier(0.16, 1, 0.3, 1);
  }
}
```

### 구현 방안

#### 참조 패턴: PixiTabs.tsx drawIndicator()

```typescript
// PixiTabs.tsx:229-239 (이미 구현됨)
const drawIndicator = useCallback(
  (g: PixiGraphics, tab: TabData, isSelected: boolean) => {
    g.clear();
    if (!isSelected) return;
    const width = isVertical ? sizePreset.indicatorHeight : tab.width;
    const height = isVertical ? tab.height : sizePreset.indicatorHeight;
    g.rect(0, 0, width, height);
    g.fill({ color: colorPreset.indicatorColor });
  },
  [isVertical, sizePreset.indicatorHeight, colorPreset.indicatorColor]
);
```

#### 대상 파일 및 변경사항

| # | 파일 | 변경 내용 | 난이도 |
|---|------|----------|--------|
| 1 | `PixiToggleButtonGroup.tsx` | `drawIndicator` 로직 추가: 선택된 버튼 위치/크기 계산 → roundRect 렌더링 | 🟡 |
| 2 | `cssVariableReader.ts` | ToggleButtonGroup indicator 색상 프리셋 추가 (`indicatorColor`, `indicatorRadius`) | 🟢 |
| 3 | `unified.types.ts` 또는 spec | `indicator?: boolean` prop 캔버스 전달 경로 확보 | 🟢 |

#### 렌더링 구조 (변경 후)

```
LayoutContainer (toggleButtonGroupId)
  ├─ ElementSprite → PixiToggleButtonGroup
  │   ├─ pixiGraphics (배경 + border)
  │   └─ pixiGraphics (indicator roundRect)  ← NEW: 선택된 버튼 위치에 렌더링
  ├─ LayoutContainer (toggleButton1Id) → ElementSprite → PixiToggleButton
  └─ LayoutContainer (toggleButton2Id) → ElementSprite → PixiToggleButton
```

#### indicator 위치 계산 로직

```typescript
// 의사코드 — PixiToggleButtonGroup.tsx에 추가 예정
const drawIndicator = useCallback(
  (g: PixiGraphics) => {
    g.clear();
    if (!indicator || selectedIndex < 0) return;

    // 선택된 버튼의 위치/크기를 자식 레이아웃 결과에서 계산
    const selectedChild = childElements[selectedIndex];
    const childLayout = layoutPositions.get(selectedChild.id);
    if (!childLayout) return;

    // indicator roundRect 렌더링 (선택된 버튼 영역)
    g.roundRect(
      childLayout.x,
      childLayout.y,
      childLayout.width,
      childLayout.height,
      indicatorRadius
    );
    g.fill({ color: indicatorColor });
  },
  [indicator, selectedIndex, childElements, layoutPositions, indicatorColor, indicatorRadius]
);
```

#### variant별 indicator 색상

| Variant | CSS 변수 | 캔버스 Hex 폴백 |
|---------|----------|-----------------|
| `default` | `--surface-container-high` | `0xe8e0d8` |
| `primary` | `--primary` | `0x3b82f6` |
| `secondary` | `--secondary` | `0x6366f1` |
| `tertiary` | `--tertiary` | `0xec4899` |
| `error` | `--error` | `0xef4444` |
| `surface` | `--surface-container-highest` | `0xf0e8e0` |

#### 애니메이션 처리

- **CSS 웹**: `translate` + `width` + `height` 200ms transition
- **캔버스**: 정적 렌더링 (트랜지션 ❌ — `CSS_SUPPORT_MATRIX.md` §13 참조)
- 빌더는 디자인 도구이므로 정적 indicator 위치 표시만으로 충분

### 의존성

- `PixiToggleButtonGroup.tsx`의 container-only 패턴 유지
- 자식 ToggleButton의 레이아웃 결과(`layoutPositions`)에 접근 필요
- `selectedKeys` prop에서 선택 상태 판별

### 관련 구현 사례

| 컴포넌트 | Indicator 타입 | 캔버스 구현 | 참조 파일 |
|----------|---------------|------------|----------|
| **Tabs** | 하단/측면 bar | ✅ 구현됨 | `PixiTabs.tsx:229-239` |
| **Switch** | 토글 dot | ✅ Spec shapes | `ElementSprite.tsx` |
| **Checkbox** | 체크마크 | ✅ Spec shapes | `ElementSprite.tsx` |
| **Radio** | 내부 dot | ✅ Spec shapes | `ElementSprite.tsx` |
| **ToggleButtonGroup** | 배경 하이라이트 | ❌ 미구현 | 본 계획 |

---

## 관련 파일

- `src/builder/components/ToggleButtonGroup.tsx` - Indicator 로직 (line 47-68)
- `src/builder/components/components.css` - Indicator CSS (line 390-411)
- `src/builder/inspector/sections/StyleSection.tsx` - Flexbox controls 사용 예시
- `apps/builder/src/builder/workspace/canvas/ui/PixiToggleButtonGroup.tsx` - 캔버스 구현
- `apps/builder/src/builder/workspace/canvas/ui/PixiTabs.tsx` - drawIndicator 참조 패턴

## 참고 자료

- [CLAUDE.md - ToggleButtonGroup with Indicator](../../../CLAUDE.md#togglebuttongroup-with-indicator)
- [React Aria: ToggleButton](https://react-spectrum.adobe.com/react-aria/ToggleButton.html)
- [MDN: MutationObserver](https://developer.mozilla.org/en-US/docs/Web/API/MutationObserver)
- [CSS Transitions](https://developer.mozilla.org/en-US/docs/Web/CSS/CSS_Transitions/Using_CSS_transitions)
