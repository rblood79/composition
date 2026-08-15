# Child Composition & Spec Patterns

### 자식 조합 패턴 (Child Composition Pattern) (2026-02-24)

Figma, Pencil App, HTML+CSS DOM 구조와 일치하도록 컴포넌트를 자식 조합형으로 전환하는 패턴입니다.
Spec shapes는 배경/테두리/그림자만 담당하고, 자식 Element가 콘텐츠(Label, Input, Description 등)를 렌더링합니다.

#### 핵심 구조

```
Parent Component (spec shapes: 배경/테두리만)
├── Label (자식 Element → TextSprite 렌더링)
├── Input / Content (자식 Element)
└── Description / Footer (자식 Element)
```

#### Child Spec 등록 (2026-02-25 Compositional 전환)

Compositional 전환으로 7개의 독립 child spec이 생성되었습니다:

| Child Spec                 | 파일                           | 용도                                   | 사용 parent                                                       |
| -------------------------- | ------------------------------ | -------------------------------------- | ----------------------------------------------------------------- |
| `LabelSpec`                | `Label.spec.ts`                | 라벨 텍스트                            | TextField, NumberField, SearchField, DateField, TimeField, Slider |
| `FieldErrorSpec`           | `FieldError.spec.ts`           | 에러 메시지                            | TextField, NumberField, SearchField, DateField                    |
| `DescriptionSpec`          | `Description.spec.ts`          | 설명 텍스트                            | Card, Dialog, Popover                                             |
| _(CardPreview)_            | _(투명 div 컨테이너)_          | 이미지/미디어 미리보기                 | Card                                                              |
| _(CardFooter)_             | _(투명 div 컨테이너)_          | 하단 액션/상태 영역                    | Card                                                              |
| `SliderTrackSpec`          | `SliderTrack.spec.ts`          | 트랙 bg + fill + thumb 렌더링          | Slider (Range Mode 포함)                                          |
| `SliderThumbSpec`          | `SliderThumb.spec.ts`          | 이벤트 히트 영역 전용 (shapes 빈 배열) | Slider (Range Mode 포함)                                          |
| `SliderOutputSpec`         | `SliderOutput.spec.ts`         | 값 텍스트 표시                         | Slider (Range Mode 포함)                                          |
| `DateSegmentSpec`          | `DateSegment.spec.ts`          | 날짜/시간 세그먼트                     | DateField, TimeField                                              |
| `CalendarHeaderSpec`       | `CalendarHeader.spec.ts`       | 캘린더 nav (prev/next + month)         | Calendar                                                          |
| `CalendarGridSpec`         | `CalendarGrid.spec.ts`         | 캘린더 날짜 그리드                     | Calendar                                                          |
| `SegmentedControlItemSpec` | `SegmentedControlItem.spec.ts` | 세그먼트 개별 항목                     | SegmentedControl                                                  |
| `SelectBoxItemSpec`        | `SelectBoxItem.spec.ts`        | 카드형 선택 항목                       | SelectBoxGroup                                                    |

**TAG_SPEC_MAP 등록** (`ElementSprite.tsx`):

```typescript
'Label': LabelSpec,
'FieldError': FieldErrorSpec,
'Description': DescriptionSpec,
'SliderTrack': SliderTrackSpec,
'SliderThumb': SliderThumbSpec,
'SliderOutput': SliderOutputSpec,
'DateSegment': DateSegmentSpec,
'TimeSegment': DateSegmentSpec,  // DateSegmentSpec 재사용
'CalendarHeader': CalendarHeaderSpec,
'CalendarGrid': CalendarGridSpec,
```

**SPEC_RENDERS_ALL_TAGS 폐기**: 이전에 9개 compound 컴포넌트의 `childElements=[]`를 강제하던 `SPEC_RENDERS_ALL_TAGS` Set은 **완전 제거**되었습니다. 모든 자식 Element가 정상적으로 canvas에서 렌더링됩니다.

#### `_hasChildren` 주입 방식: 2단계 판단 로직 (2026-02-25 Compositional 전환)

`ElementSprite.tsx`에서 `_hasChildren: true` flag를 spec props에 주입합니다.
아래 2단계를 순서대로 평가하며, **1단계에서 제외되면 2단계는 실행되지 않습니다**.

**1단계 — Opt-out 가드 (CHILD_COMPOSITION_EXCLUDE_TAGS)**: 이 Set에 포함된 태그는 주입 자체를 건너뜁니다. synthetic prop 메커니즘(`_crumbs`, `_tabLabels` 등)을 별도로 사용하거나 다단계 중첩이 필요한 컴포넌트가 여기에 속합니다.

**2단계 — 자식 존재 여부**: 1단계를 통과한 모든 컴포넌트는 자식 Element가 실제로 있을 때만 `_hasChildren: true`를 주입합니다. Compositional 전환으로 자식 Element가 독립 spec으로 렌더링하므로, `COMPLEX_COMPONENT_TAGS` 기반 강제 주입은 불필요해졌습니다.

```typescript
// ElementSprite.tsx — 2단계 판단 로직 (2026-02-25 Compositional 전환)

const CHILD_COMPOSITION_EXCLUDE_TAGS = new Set([
  "Tabs", // _tabLabels synthetic prop 사용 (별도 메커니즘)
  "Breadcrumbs", // _crumbs synthetic prop 사용 (별도 메커니즘)
  "TagGroup", // _tagItems synthetic prop 사용 (별도 메커니즘)
  "Table", // 다단계 중첩 구조 (별도 작업)
  "Tree", // 다단계 중첩 구조 (별도 작업)
]);

// 1단계: CHILD_COMPOSITION_EXCLUDE_TAGS → 포함되면 주입 스킵
if (!CHILD_COMPOSITION_EXCLUDE_TAGS.has(tag)) {
  // 2단계: 실제 자식 존재 여부로만 판단
  if (childElements && childElements.length > 0) {
    specProps = { ...specProps, _hasChildren: true };
  }
}
```

**Compositional 전환 이전(버그)**: `COMPLEX_COMPONENT_TAGS.has(tag)` → 항상 \_hasChildren=true → parent monolithic spec이 모든 것을 렌더링, 자식은 ghost element.
**Compositional 전환 이후**: 자식 Element가 독립 spec(LabelSpec, FieldErrorSpec 등)으로 렌더링하므로, \_hasChildren는 실제 childElements.length > 0으로만 판단.

**`CHILD_COMPOSITION_EXCLUDE_TAGS`에 등록되는 이유**:

- **synthetic prop 사용 컴포넌트** (Tabs, Breadcrumbs, TagGroup): 자체 prop 주입 메커니즘이 별도로 있어 `_hasChildren` 방식이 필요 없음
- **다단계 중첩 구조** (Table, Tree): 자식 렌더링이 복잡하여 별도 구현 필요

#### Non-complex 컴포넌트: standalone 복귀는 의도된 동작

아래 컴포넌트들은 자식 Element가 없을 때 standalone spec shapes로 렌더링하는 것이 **설계상 올바른 동작**입니다.

| 컴포넌트       | 이유                                             |
| -------------- | ------------------------------------------------ |
| `Button`       | 자식 없이 단독으로 standalone 텍스트 렌더링 가능 |
| `Badge`        | 자식 없이 단독으로 standalone 텍스트 렌더링 가능 |
| `ToggleButton` | 자식 없이 단독으로 standalone 텍스트 렌더링 가능 |
| `Slot`         | 단일 플레이스홀더 요소                           |
| `Panel`        | Tabs 내부 전용, 자체 렌더링 없음                 |
| `ProgressBar`  | 자식 없이 label+track standalone 렌더링 가능     |
| `Meter`        | 자식 없이 label+bar standalone 렌더링 가능       |
| `DropZone`     | 자식 없이 standalone 렌더링 가능                 |
| `FileTrigger`  | 자식 없이 standalone 렌더링 가능                 |
| `ScrollBox`    | 단순 스크롤 컨테이너                             |
| `MaskedFrame`  | 단순 마스크 컨테이너                             |
| `Section`      | 단순 레이아웃 컨테이너                           |
| `Group`        | 단순 그룹 컨테이너                               |

> **주의**: 위 컴포넌트들도 spec 파일에서 `_hasChildren`을 체크합니다. 이는 미래에 자식을 추가했을 때 동작하도록 설계된 것이며, 현재 자식이 없는 상태에서 standalone 렌더링이 정상입니다.

#### Spec shapes() 패턴 — 3가지 카테고리

| 카테고리                        | TRANSPARENT                     | `_hasChildren` 시 반환                            | 예시                                   |
| ------------------------------- | ------------------------------- | ------------------------------------------------- | -------------------------------------- |
| Input Fields                    | ✅ (TRANSPARENT_CONTAINER_TAGS) | bg + border shapes만                              | TextField, NumberField, SearchField 등 |
| Overlay / Navigation            | ❌                              | bg + shadow + border shapes 유지                  | Dialog, Popover, Menu, Toolbar 등      |
| Groups (transparent)            | ✅                              | 빈 배열 `[]`                                      | CheckboxGroup, RadioGroup              |
| Date Composites (Compositional) | DatePicker: ✅, Calendar: ❌    | DatePicker: `[]` (빈 배열), Calendar: bg shapes만 | DatePicker, Calendar                   |
| Color Composites                | ❌                              | bg shapes 유지, 복합 콘텐츠 스킵                  | ColorPicker 등                         |

**TRANSPARENT 컨테이너 패턴** (Input Fields):

```typescript
// ✅ bg/border 이후 _hasChildren 체크
const shapes: Shape[] = [
  { id: 'bg', type: 'roundRect', ... },  // 배경
  { type: 'border', target: 'bg', ... }, // 테두리
];
const hasChildren = !!(props as Record<string, unknown>)._hasChildren;
if (hasChildren) return shapes; // bg+border만 반환

// 아래부터 standalone 전용 텍스트/콘텐츠 shapes
shapes.push({ type: 'text', ... });
return shapes;
```

**NON-TRANSPARENT 컨테이너 패턴** (Overlay/Navigation):

```typescript
// ✅ shadow + bg + border 이후 _hasChildren 체크
const shapes: Shape[] = [
  { type: 'shadow', target: 'bg', ... },  // 그림자
  { id: 'bg', type: 'roundRect', ... },   // 배경
  { type: 'border', target: 'bg', ... },  // 테두리
];
if (hasChildren) return shapes; // shell만 반환

// 아래부터 standalone 전용 container/text shapes
shapes.push({ type: 'container', ... });
return shapes;
```

**❌ 잘못된 패턴** — 배경 shapes 없이 빈 배열 반환:

```typescript
// ❌ NON-TRANSPARENT 컴포넌트가 빈 배열 반환 → 배경 미렌더링
const shapes: Shape[] = [];
if (hasChildren) return shapes; // 배경도 없음!
```

#### Standalone shapes에서의 label 렌더링 패턴

`_hasChildren: false`일 때(standalone 모드) spec shapes에서 label을 직접 렌더링하는 표준 패턴입니다.
label이 있으면 y=0에 배치하고, 이후 모든 shapes는 `labelOffset`만큼 y를 이동시킵니다.

```typescript
import { resolveToken } from '../renderers/utils/tokenResolver';

// shapes 함수 내부 — resolveToken으로 fontSize 해결 후 label 계산
const rawFontSize = props.style?.fontSize ?? size.fontSize;
const resolvedFs = typeof rawFontSize === 'number'
  ? rawFontSize
  : (typeof rawFontSize === 'string' && rawFontSize.startsWith('{')
      ? resolveToken(rawFontSize as TokenRef)
      : rawFontSize);
const fontSize = typeof resolvedFs === 'number' ? resolvedFs : 16;

// ✅ label 높이 및 offset 계산
const labelFontSize = fontSize - 2;
const labelHeight = Math.ceil(labelFontSize * 1.2);
const labelGap = size.gap ?? 8;
const labelOffset = props.label ? labelHeight + labelGap : 0;

// ✅ label shape — 항상 y=0에 배치
if (props.label) {
  shapes.push({
    type: 'text' as const,
    x: 0,
    y: 0,
    text: props.label,
    fontSize: labelFontSize,
    fontFamily: ff,
    fontWeight,
    fill: variant.text,
    align: textAlign,
    baseline: 'top' as const,
  });
}

// ✅ 이후 모든 shapes는 y에 labelOffset 추가
shapes.push({
  id: 'bg',
  type: 'roundRect' as const,
  x: 0,
  y: labelOffset,  // label이 없으면 0, 있으면 labelHeight + labelGap
  width,
  height,
  ...
});

// ✅ 내부 콘텐츠도 labelOffset 기준으로 배치
shapes.push({
  type: 'text' as const,
  x: paddingX,
  y: labelOffset + height / 2,  // 입력 필드 세로 중앙
  ...
});

// ❌ labelOffset 미적용 — label과 입력 필드가 겹침
shapes.push({
  id: 'bg',
  type: 'roundRect' as const,
  x: 0,
  y: 0,  // label 아래로 내려가지 않음
  ...
});
```

**적용 컴포넌트**: `NumberField.spec.ts`, `SearchField.spec.ts` 등 label prop을 직접 standalone shapes에서 렌더링하는 모든 Input Field 계열.

**주의**: `_hasChildren: true`이면 이 패턴은 실행되지 않습니다. `_hasChildren` 체크 이후의 standalone 전용 경로에 배치해야 합니다.

#### Container Props 주입 확장 (`BuilderCanvas.tsx`)

```typescript
// Input Field 계열: props.label → Label.children
if (
  [
    "TextField",
    "NumberField",
    "SearchField",
    "DateField",
    "TimeField",
    "ColorField",
  ].includes(containerTag)
) {
  if (childEl.tag === "Label") {
    const labelText = fieldProps?.label;
    if (labelText != null) {
      effectiveChildEl = {
        ...childEl,
        props: { ...childEl.props, children: String(labelText) },
      };
    }
  }
}

// Overlay 계열: props.heading/description → Heading/Description.children
if (["Dialog", "Popover", "Tooltip", "Toast"].includes(containerTag)) {
  if (childEl.tag === "Heading") {
    const headingText = overlayProps?.heading ?? overlayProps?.title;
    // ... 주입
  } else if (childEl.tag === "Description") {
    const descText = overlayProps?.description ?? overlayProps?.message;
    // ... 주입
  }
}
```

확장된 주입 규칙 테이블:

| 컨테이너           | 부모 props 키                | 대상 자식 tag | 주입 대상 prop |
| ------------------ | ---------------------------- | ------------- | -------------- |
| `Tabs`             | `_tabLabels`                 | `Tab`         | `_tabLabels`   |
| `Card`             | `heading` 또는 `title`       | `Heading`     | `children`     |
| `Card`             | `description`                | `Description` | `children`     |
| Input Fields (6종) | `label`                      | `Label`       | `children`     |
| Overlay (4종)      | `heading` 또는 `title`       | `Heading`     | `children`     |
| Overlay (4종)      | `description` 또는 `message` | `Description` | `children`     |

#### border-box 높이 계산 수정 (`engines/utils.ts`)

`calculateContentHeight` flex column 분기에서 border-box 이중 계산 방지:

```typescript
// ✅ 자식의 explicit height가 border-box이면 padding+border 미추가
const childIsBorderBox =
  childBoxSizing === "border-box" ||
  (childIsFormEl && childExplicitH !== undefined);

if (childExplicitH !== undefined && childIsBorderBox) {
  return childExplicitH; // border-box: explicit height가 이미 padding+border 포함
}
// content-box: padding + border 추가
return (
  contentH +
  childBox.padding.top +
  childBox.padding.bottom +
  childBox.border.top +
  childBox.border.bottom
);
```

#### Dropflow fallback flex 처리 (`engines/index.ts`)

Taffy WASM 초기화 실패 시 (`isRustWasmReady() === false`) Dropflow 결과를 flex row/column + gap으로 후처리 (안전 폴백):

```typescript
// ✅ Dropflow fallback: flex-direction + gap 수동 처리
if (!(engine instanceof TaffyFlexEngine) && results.length > 0) {
  if (isRow) {
    let xOffset = 0;
    for (let i = 0; i < results.length; i++) {
      if (i > 0) xOffset += gapVal;
      results[i] = { ...results[i], x: xOffset, y: 0 };
      xOffset += results[i].width;
    }
  } else if (isColumn && gapVal > 0) {
    // column gap 처리...
  }
}
```

#### 하위호환

`_hasChildren`가 `false`이면 (구 데이터, 자식 없음) → spec shapes 전체 렌더링. 신규 데이터 (factory 자식 생성) → `_hasChildren: true` → 자식이 렌더링.

#### 신규 컴포넌트 등록 체크리스트

1. **Spec 파일** (`packages/specs/src/components/XXX.spec.ts`):
   - shapes() 내 배경/테두리/그림자 shapes를 먼저 정의
   - `_hasChildren` 체크 → 배경 shapes만 반환 (TRANSPARENT) 또는 shell shapes만 반환 (NON-TRANSPARENT)
   - standalone 텍스트/콘텐츠 shapes는 체크 이후에 추가
   - **CRITICAL**: `size.fontSize` 또는 `props.style?.fontSize`를 숫자 연산에 사용하기 전 반드시 `resolveToken()` 패턴 적용 (`as unknown as number` 캐스팅 금지 → NaN 발생)
   - label이 있는 standalone shapes는 반드시 `labelOffset` 계산 후 y 좌표 오프셋 적용

2. **`COMPLEX_COMPONENT_TAGS` 등록** (`apps/builder/src/builder/factories/constants.ts`):
   - factory가 자식 Element를 생성하는 복합 컴포넌트라면 Factory 경로 분기 목적으로 이 Set에 추가 (`useElementCreator.ts`가 참조)
   - **Compositional 전환 이후**: `_hasChildren` 주입은 실제 childElements.length > 0으로만 결정되므로, 이 Set 등록이 `_hasChildren`에 영향을 주지 않음
   - `CHILD_COMPOSITION_EXCLUDE_TAGS` 소속 태그(Tabs, TagGroup 등)도 Factory 경로 분기용으로 등록

3. **ElementSprite.tsx**:
   - Child Spec을 독립 렌더링하려면 `TAG_SPEC_MAP`에 해당 태그의 Spec 클래스 등록 (필수)
   - synthetic prop 메커니즘을 별도로 사용하거나 다단계 중첩 구조라면 `CHILD_COMPOSITION_EXCLUDE_TAGS`에 추가
   - 배경/테두리를 spec이 담당하면 `TRANSPARENT_CONTAINER_TAGS`에도 추가
   - spec shapes가 `labelOffset` 기반으로 세로 레이아웃을 자체 계산하면 `SPEC_RENDERS_ALL_TAGS_SET`에도 추가 (`rearrangeShapesForColumn` 이중 변환 방지)

4. **BuilderCanvas.tsx**:
   - 기본적으로 모든 컴포넌트가 컨테이너로 처리됨 — 추가 작업 불필요
   - 단, TEXT_TAGS / void 요소 / Color Sub 컴포넌트처럼 자식 내부 렌더링이 불필요하면 `NON_CONTAINER_TAGS`에 추가
   - `createContainerChildRenderer` 내 props sync 분기 추가 (label, heading, description 등)

5. **레이아웃 엔진** (`apps/builder/src/builder/workspace/canvas/layout/engines/utils.ts`):
   - spec shapes 기반의 자체 높이를 가진 컴포넌트는 `SPEC_SHAPES_INPUT_TAGS`에 추가 (`enrichWithIntrinsicSize`의 contentHeight ≤ 0 early return 우회)

6. **Factory 정의** (`apps/builder/src/builder/factories/definitions/`):
   - ComponentDefinition에 자식 Element 정의 (Label, Input, Description 등)
   - `ComponentFactory.ts`에 creator 등록

7. **검증**:
   - `pnpm build` (specs 빌드)
   - `pnpm type-check` 통과
   - Canvas에서 드래그 앤 드롭 → 배경 + 자식 정상 렌더링
   - Layer 트리에서 자식 선택 → 스타일 편집 → Canvas 반영
   - 구 데이터 (자식 없음) → standalone 렌더링 유지
   - **자식을 모두 삭제해도 빈 shell 유지** (standalone spec shapes로 되돌아가지 않음)
   - fontSize가 TokenRef인 경우 NaN 없이 정상 렌더링 확인

#### Property Editor 자식 동기화 패턴 (2026-02-25)

**왜 필요한가**: 부모 컴포넌트의 spec shapes()는 `_hasChildren: true`일 때 빈 배열(또는 shell만)을 반환합니다. 실제 label, placeholder 등의 텍스트 렌더링은 자식 Element(Label, Input 등)가 담당합니다. 따라서 Properties Panel에서 부모 prop을 변경할 때, 부모 Element의 props 업데이트만으로는 Canvas에 텍스트가 반영되지 않습니다. **자식 Element의 대응 prop도 함께 업데이트해야** 합니다.

**`useSyncChildProp` 훅** (`apps/builder/src/builder/hooks/useSyncChildProp.ts`):

```typescript
interface ChildPropSync {
  childTag: string; // 자식 Element의 tag (예: 'Label', 'Input')
  propKey: string; // 자식 Element에서 업데이트할 prop 키
  value: string; // 적용할 값
}

export function useSyncChildProp(elementId: string) {
  const buildChildUpdates = useCallback(
    (syncs: ChildPropSync[]): BatchPropsUpdate[] => {
      // childrenMap O(1) 탐색으로 직계 자식의 props 업데이트 목록 생성
    },
    [elementId],
  );
  return { buildChildUpdates };
}
```

**`useSyncGrandchildProp` 훅** (`apps/builder/src/builder/hooks/useSyncGrandchildProp.ts`):

Select, ComboBox처럼 직계 자식이 아닌 손자(grandchild)에 prop을 동기화해야 하는 경우에 사용합니다.
2단계 childrenMap 탐색을 수행합니다.

```typescript
// Select: SelectTrigger → SelectValue.children
// ComboBox: ComboBoxWrapper → ComboBoxInput.placeholder
export function useSyncGrandchildProp(elementId: string) {
  const buildGrandchildUpdates = useCallback(
    (syncs: GrandchildPropSync[]): BatchPropsUpdate[] => { ... },
    [elementId],
  );
  return { buildGrandchildUpdates };
}
```

**`updateSelectedPropertiesWithChildren` store 메서드** (`inspectorActions.ts`):

부모 props와 자식 props를 **단일 batch 히스토리 엔트리**로 원자적으로 업데이트합니다.

```typescript
// ✅ 부모 + 자식을 atomic batch로 업데이트 — Undo 1회로 전체 원복
const handleLabelChange = useCallback(
  (value: string) => {
    const updatedProps = { ...currentProps, label: value };
    const childUpdates = buildChildUpdates([
      { childTag: "Label", propKey: "children", value },
    ]);
    useStore
      .getState()
      .updateSelectedPropertiesWithChildren(updatedProps, childUpdates);
  },
  [currentProps, buildChildUpdates],
);

// ❌ 구 패턴 — 2회 호출로 히스토리 엔트리 2개 생성 (Undo 2회 필요)
onUpdate({ label: value });
syncChildProp("Label", "children", value);
```

**CRITICAL**: 새로운 Complex 컴포넌트의 Property Editor를 만들 때는 반드시 `useSyncChildProp` 훅을 사용하여 자식 동기화를 구현할 것. 인라인 syncChildProp 코드 작성 금지.

#### 에디터별 자식 동기화 매핑

| 에디터              | 부모 prop     | 자식 Tag                            | 자식 propKey  | 패턴       |
| ------------------- | ------------- | ----------------------------------- | ------------- | ---------- |
| `TextFieldEditor`   | `label`       | `Label`                             | `children`    | child      |
| `TextFieldEditor`   | `placeholder` | `Input`                             | `placeholder` | child      |
| `NumberFieldEditor` | `label`       | `Label`                             | `children`    | child      |
| `NumberFieldEditor` | `placeholder` | `Input`                             | `placeholder` | child      |
| `SearchFieldEditor` | `label`       | `Label`                             | `children`    | child      |
| `SearchFieldEditor` | `placeholder` | `Input`                             | `placeholder` | child      |
| `CheckboxEditor`    | `children`    | `Label`                             | `children`    | child      |
| `RadioEditor`       | `children`    | `Label`                             | `children`    | child      |
| `SwitchEditor`      | `children`    | `Label`                             | `children`    | child      |
| `CardEditor`        | `heading`     | `Heading`                           | `children`    | child      |
| `CardEditor`        | `description` | `Description`                       | `children`    | child      |
| `SliderEditor`      | `label`       | `Label`                             | `children`    | child      |
| `SelectEditor`      | `label`       | `Label`                             | `children`    | child      |
| `SelectEditor`      | `placeholder` | `SelectTrigger` → `SelectValue`     | `children`    | grandchild |
| `ComboBoxEditor`    | `label`       | `Label`                             | `children`    | child      |
| `ComboBoxEditor`    | `placeholder` | `ComboBoxWrapper` → `ComboBoxInput` | `placeholder` | grandchild |

상세 내용: [domain-history-integration](rules/domain-history-integration.md#child-composition-pattern-batch-히스토리)

### Canvas 2D ↔ CanvasKit 폭 측정 오차 보정 (CRITICAL)

`calculateContentWidth`(utils.ts)는 Canvas 2D `measureText` API로 텍스트 폭을 측정합니다.
그러나 CanvasKit paragraph API는 내부 레이아웃 방식이 달라 동일한 텍스트에 대해 더 넓은 폭이 필요합니다.
보정 없이 Canvas 2D 측정값을 그대로 사용하면 CanvasKit 렌더링 시 텍스트가 wrapping됩니다.

**보정 규칙**: 모든 텍스트 폭 계산 경로에 `Math.ceil() + 2` 보정을 적용합니다.

```typescript
// engines/utils.ts — calculateContentWidth

// ✅ INLINE_FORM 경로: 이미 보정 적용 (line 718-719)
const textWidth =
  Math.ceil(calculateTextWidth(labelText, fontSize, fontFamily)) + 2;

// ✅ 일반 텍스트 경로: 동일하게 보정 적용 (line 759-760)
// TagGroup label, Button 등 단일 텍스트 측정 경로
const textWidth = Math.ceil(calculateTextWidth(text, fontSize, fontFamily)) + 2;

// ❌ 보정 없이 Canvas 2D 원시 측정값 사용
const textWidth = calculateTextWidth(text, fontSize, fontFamily);
// → CanvasKit paragraph API에서 동일한 폭이 부족 → 텍스트 wrapping 발생
```

**적용 범위**: INLINE_FORM 경로와 일반 텍스트 경로 **모두** 동일한 `Math.ceil() + 2` 보정 패턴을 사용합니다.
새로운 텍스트 폭 계산 경로를 추가할 때 이 보정을 빠뜨리면 CanvasKit에서 줄바꿈이 발생합니다.

**수정 이력 (2026-02-22)**: TagGroup label 두 줄 렌더링 버그 수정 시 일반 텍스트 경로에 보정 누락이 근본 원인 중 하나로 확인됨. INLINE_FORM 경로(line 718-719)에는 이미 적용되어 있었으나 일반 텍스트 경로(line 759-760)에 누락됐었음.

### TokenRef fontSize 해석 (Spec Shapes)

spec의 `size.fontSize`가 TokenRef 문자열(`'{typography.text-md}'`)로 지정될 수 있습니다.
이를 `as unknown as number`로 캐스팅하면 NaN이 발생하므로 반드시 안전한 변환 패턴을 사용해야 합니다.
두 가지 패턴이 존재하며, **spec shapes 내부에서는 `resolveToken()` 직접 호출 패턴을 사용합니다**.

#### 패턴 A: `resolveToken()` 직접 호출 (Spec shapes 내부 — 권장)

spec shapes 함수 내에서 `props.style?.fontSize` 또는 `size.fontSize`를 처리할 때 사용합니다.
`resolveToken()`은 TokenRef 문자열을 실제 숫자값으로 변환합니다.

```typescript
import { resolveToken } from "../renderers/utils/tokenResolver";

// ✅ Correct: resolveToken()으로 TokenRef 해결 (NumberField.spec.ts, SearchField.spec.ts 패턴)
const rawFontSize = props.style?.fontSize ?? size.fontSize;
const resolvedFs =
  typeof rawFontSize === "number"
    ? rawFontSize
    : typeof rawFontSize === "string" && rawFontSize.startsWith("{")
      ? resolveToken(rawFontSize as TokenRef)
      : rawFontSize;
const fontSize = typeof resolvedFs === "number" ? resolvedFs : 16;

// ❌ Incorrect: as unknown as number 캐스팅 (NaN 발생)
const fontSize = size.fontSize as unknown as number;

// ❌ Incorrect: TokenRef 문자열로 산술 연산 (NaN)
const labelFontSize = (size.fontSize as unknown as number) - 2;
// → '{typography.text-md}' - 2 = NaN → 텍스트 shape y 좌표 NaN → 렌더링 실패
```

**로직 흐름**:

1. `props.style?.fontSize`가 있으면 우선 사용 (인라인 스타일 오버라이드)
2. 없으면 `size.fontSize` 사용
3. 숫자이면 그대로 사용
4. `{...}` 형식의 TokenRef 문자열이면 `resolveToken()`으로 실제 값 추출
5. 변환 결과가 숫자가 아니면 기본값 `16` 사용

#### 패턴 B: height 기반 매핑 fallback (외부 유틸리티 코드)

spec 외부(레이아웃 엔진 등)에서 TokenRef를 받을 수 없는 경우, size 이름 기반으로 매핑합니다.

```typescript
// ✅ TokenRef 여부 확인 후 height 매핑으로 fallback
const rawFontSize = spec.size?.fontSize;
const fontSize =
  typeof rawFontSize === "number"
    ? rawFontSize
    : ({ sm: 12, md: 14, lg: 16 }[size] ?? 14); // height 기반 매핑
```

| size | fallback fontSize |
| ---- | ----------------- |
| sm   | 12px              |
| md   | 14px              |
| lg   | 16px              |

### Breadcrumbs spec shapes 패턴 (2026-02-23)

Breadcrumbs는 자식 Breadcrumb 요소의 텍스트를 `_crumbs` 배열로 주입받아 spec shapes에서 렌더링합니다.
두 가지 패턴을 반드시 함께 적용해야 합니다.

#### TokenRef fontSize 해석 (`Breadcrumbs.spec.ts`)

`size.fontSize`가 TokenRef 문자열로 지정된 경우 `resolveToken()`으로 변환합니다.

```typescript
// ✅ Breadcrumbs.spec.ts — TokenRef fontSize 해석 (NaN 방지)
const resolvedFontSize =
  typeof size.fontSize === "number"
    ? size.fontSize
    : ((resolveToken(size.fontSize as TokenRef) as number) ?? 14);
// → size.fontSize가 TokenRef 문자열이면 resolveToken()으로 실제 숫자값 추출
// → 추출 실패 시 14px fallback

// ❌ as unknown as number 캐스팅 — NaN 발생
const fontSize = size.fontSize as unknown as number;
// → TokenRef 문자열이 NaN으로 변환 → 텍스트 shape 좌표 전체 NaN
```

#### `_crumbs` prop injection 패턴 (`ElementSprite.tsx`)

자식 Breadcrumb 요소의 텍스트를 추출하여 spec shapes에 `_crumbs` prop으로 주입합니다.

```typescript
// ✅ ElementSprite.tsx — 자식 Breadcrumb 텍스트 추출 → _crumbs 주입
if (tag === "breadcrumbs" && childElements?.length > 0) {
  const crumbs = childElements
    .filter((c) => c.tag === "Breadcrumb")
    .map((c) => String(c.props?.children || "Page"));
  specProps = { ...specProps, _crumbs: crumbs };
}
// → Breadcrumbs.spec.ts shapes()가 _crumbs 배열로 구분자 포함 텍스트 shape 생성

// ❌ _crumbs 미주입 — spec shapes가 빈 배열 기준으로 렌더링
// → Breadcrumbs 텍스트 미표시
```

**Breadcrumbs 전체 렌더링 흐름**:

1. `ElementSprite.tsx`: 자식 Breadcrumb 요소 텍스트 수집 → `_crumbs` prop 주입
2. `Breadcrumbs.spec.ts`: `_crumbs` 배열 기반으로 구분자(`/`) 포함 텍스트 shape 생성
3. `enrichWithIntrinsicSize`: SPEC_SHAPES_INPUT_TAGS 분기 → size별 고정 높이 주입
4. `calculateContentHeight`: `tag === 'breadcrumbs'` 분기 → BREADCRUMBS_HEIGHTS 반환

### INLINE_FORM dimensions는 반드시 Spec과 일치 (CRITICAL, 2026-02-21)

Checkbox/Radio/Switch 인라인 폼 컴포넌트의 레이아웃 크기 테이블은 해당 컴포넌트 spec 파일의 실제 치수와 **반드시 일치**해야 합니다.

> **Note**: `toggle` 태그는 spec/factory/types 어디에도 정의되지 않은 dead code였으므로 2026-02-26에 레이아웃 엔진 전체에서 제거됨. ToggleButton(tag: `togglebutton`)은 버튼이므로 phantom indicator 불필요. ToggleButtonGroup의 `indicator` prop은 CSS SelectionIndicator(absolute 배치)로 레이아웃 무관.

**핵심 규칙**: `INLINE_FORM_INDICATOR_WIDTHS`(indicator/track 너비)와 `INLINE_FORM_GAPS`(라벨 간격)가 spec과 다르면 `specShapeConverter`의 `maxWidth` 자동 축소 로직(`shape.x > 0`일 때 `containerWidth - shape.x`)에 의해 텍스트 영역이 줄어들어 **라벨이 불필요하게 줄바꿈**됩니다.

```typescript
// engines/utils.ts — 현행 올바른 값 (2026-02-26: toggle 제거)
const INLINE_FORM_INDICATOR_WIDTHS = {
  checkbox: { sm: 16, md: 20, lg: 24 }, // Checkbox.spec.ts indicatorSize
  radio: { sm: 16, md: 20, lg: 24 }, // Radio.spec.ts indicatorSize
  switch: { sm: 36, md: 44, lg: 52 }, // Switch.spec.ts trackWidth
};

const INLINE_FORM_GAPS = {
  checkbox: { sm: 6, md: 8, lg: 10 },
  radio: { sm: 6, md: 8, lg: 10 },
  switch: { sm: 8, md: 10, lg: 12 }, // Switch.spec.ts gap (checkbox보다 2px 큼)
};
```

**수정 이력**:

- switch `INLINE_FORM_INDICATOR_WIDTHS`: `{ sm: 26, md: 34, lg: 42 }` → `{ sm: 36, md: 44, lg: 52 }` (spec trackWidth보다 10px 작았던 값 정정)
- `INLINE_FORM_GAPS` 테이블 신규 추가: 이전에는 크기(sm/md/lg) 기반 고정값만 사용
- `toggle` dead code 제거 (2026-02-26): 레이아웃 엔진 4개 파일에서 삭제

**새 인라인 폼 컴포넌트 추가 시 체크리스트**:

1. 해당 컴포넌트 spec 파일에서 `trackWidth` / `indicatorSize` / `gap` 값 확인
2. `INLINE_FORM_INDICATOR_WIDTHS`에 spec 값과 동일하게 등록
3. `INLINE_FORM_GAPS`에 spec gap과 동일하게 등록
4. spec shapes의 텍스트 `x` 좌표(`indicatorWidth + gap`)와 합산값이 일치하는지 검증

상세 내용: [layout details](../reference/layout-details.md), [spec-shape-rendering](../rules/spec-shape-rendering.md#specshapeconverter-maxwidth-자동-축소와-레이아웃-너비-정합성-critical)

### Phantom Indicator + Compositional Architecture 너비 정합성 (CRITICAL, 2026-02-26)

Checkbox/Radio/Switch의 indicator는 element tree에 존재하지 않지만 spec shapes(Skia)가 시각적으로 그립니다. Compositional Architecture 전환 후 Label이 독립 Element로 분리되면서 `calculateContentWidth`에 **두 가지 누락**이 발생했습니다.

**문제 A — 부모 intrinsic width에 phantom indicator 누락**:
`calculateContentWidth` Section 2(Flex 컨테이너 + childElements 경로)가 자식 width 합산 시 phantom indicator 공간을 누락. Checkbox의 fit-content 너비가 Label 텍스트만큼만 잡혀, TaffyFlexEngine에서 phantom indicator(28px)를 차감하면 Label 공간이 부족.

**문제 B — TEXT_LEAF_TAGS flex 자식 width 미주입**:
`enrichWithIntrinsicSize`가 `INLINE_BLOCK_TAGS`에만 intrinsic width를 주입. Label은 `TEXT_LEAF_TAGS`에만 속해 Flex 자식일 때 Taffy가 content size=0 → width=0 배정.

**해결**:

```typescript
// ✅ Section 2: phantom indicator 공간을 flex 자식 합산에 반영
const phantomW = getPhantomIndicatorSpace(); // indicatorSize + gap (checkbox: 20+8=28)
if (isRow) {
  return childWidths.reduce((sum, w) => sum + w, 0)
    + gap * Math.max(0, childElements.length - 1)
    + phantomW; // ← 추가
}

// ✅ enrichWithIntrinsicSize: isFlexChild 플래그로 TEXT_LEAF_TAGS도 width 주입
const needsWidth = hasExplicitIntrinsicWidthKeyword ||
  (INLINE_BLOCK_TAGS.has(tag) && (!rawWidth || ...)) ||
  (isFlexChild && TEXT_LEAF_TAGS.has(tag) && (!rawWidth || ...)); // ← 추가

// ❌ Section 2에서 phantom 누락 → Checkbox width = Label만 → 텍스트 잘림
// ❌ TEXT_LEAF_TAGS width 미주입 → Taffy flex에서 Label width=0 → 세로 한 글자씩
```

**영향 범위**: Checkbox, Radio, Switch, Toggle — Compositional Architecture(Label 자식 Element)와 legacy(props.children) 모두 정상 동작. Block layout(Dropflow)은 `isFlexChild` 기본값 `false`로 영향 없음.

### TextMeasurer 스타일 정합성 (CRITICAL, 2026-02-26)

**문제**: 레이아웃 측정용 Paragraph와 Skia 렌더링용 Paragraph의 ParagraphStyle이 불일치하면
fit-content 텍스트에서 마지막 글자 줄바꿈 + height 초과 렌더링 발생.

**원칙**: `CanvasKitTextMeasurer`의 ParagraphStyle은 `nodeRenderers.ts` renderText()와
**동일한 속성**을 사용해야 함.

**정합 대상 속성 (폭에 영향):**

- fontSize, fontFamilies, fontWeight
- fontStyle (slant: italic/oblique)
- fontStretch (width: condensed/expanded)
- letterSpacing, wordSpacing
- fontVariant → fontFeatures (small-caps 등)

**정합 대상 속성 (높이에 영향):**

- 위 속성 전부 (줄바꿈 위치 변경 → 줄 수 변경)
- heightMultiplier + halfLeading: true

**3곳 동시 유지:**

1. `canvaskitTextMeasurer.ts` — 측정용 ParagraphStyle
2. `nodeRenderers.ts` renderText() — 렌더링용 ParagraphStyle
3. `TextMeasureStyle` 인터페이스 — 두 ParagraphStyle에 전달할 스타일 필드

**금지:**

- `calculateTextWidth()`에서 `Math.round`/`Math.ceil` 사용 금지 — float 정밀도 유지 필수
- `estimateTextHeight()`에서 `Math.round` 사용 금지 — 동일 이유
- `calculateContentHeight()`에서 fontWeight 하드코딩 금지 — 실제 element style 사용
- `measureTextWidth()` 호출 시 letterSpacing 수동 가산 금지 — 측정기 내부에서 처리
