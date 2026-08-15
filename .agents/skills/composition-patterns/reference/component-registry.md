# Component Registry & Tag Sets

### 컴포넌트 등급 현황 (Wave 4 완료, 2026-02-19 / Breadcrumbs 승격 2026-02-23)

모든 Canvas 컴포넌트가 A 또는 B+ 등급으로 전환 완료됐습니다.

| 등급 | 의미                                     | 예시                                              |
| ---- | ---------------------------------------- | ------------------------------------------------- |
| A    | Taffy/Dropflow 레이아웃 위임 + 자식 분리 | Button, Badge, ProgressBar, TagGroup, Breadcrumbs |
| B+   | Context 우선 + fallback, 일부 자체 계산  | Checkbox, Radio, Switch, Input                    |
| B    | 엔진 위임하나 자체 텍스트 배치           | Card, Meter                                       |
| D    | 캔버스 상호작용 불필요 (프리뷰 전용)     | Calendar, DatePicker, ColorPicker                 |

> C등급 (자체 렌더링 + 수동 배치)은 Wave 4에서 전부 제거됐습니다.
> `SELF_PADDING_TAGS` 등 구 패턴도 삭제 완료.

### Complex Component 목록 및 `COMPLEX_COMPONENT_TAGS` 공유 상수

자식 DOM 구조를 factory로 생성하는 복합 컴포넌트입니다.

**`COMPLEX_COMPONENT_TAGS`** (`apps/builder/src/builder/factories/constants.ts`): 두 곳에서 공유하는 Set 상수입니다.

- **`useElementCreator.ts`**: `COMPLEX_COMPONENT_TAGS.has(tag)`로 Factory 경로 분기 — 복합 컴포넌트면 `ComponentFactory.createComplexComponent()` 호출
- **`ElementSprite.tsx`**: `COMPLEX_COMPONENT_TAGS.has(tag)`로 `_hasChildren=true` 강제 주입 — 자식 삭제 후에도 standalone spec shapes로 되돌아가지 않도록 보장

```typescript
// apps/builder/src/builder/factories/constants.ts
export const COMPLEX_COMPONENT_TAGS = new Set([
  // Form Input
  "TextField",
  "TextArea",
  "NumberField",
  "SearchField",
  "DateField",
  "TimeField",
  "ColorField",
  // Selection
  "Select",
  "ComboBox",
  "ListBox",
  "GridList",
  "List",
  // Control
  "Checkbox",
  "Radio",
  "Switch",
  "Slider",
  "ToggleButtonGroup",
  "Switcher",
  // Group
  "CheckboxGroup",
  "RadioGroup",
  // Layout
  "Card",
  // Navigation
  "Menu",
  "Disclosure",
  "DisclosureGroup",
  "Pagination",
  // Overlay
  "Dialog",
  "Popover",
  "Tooltip",
  // Feedback
  "Form",
  "Toast",
  "Toolbar",
  // Date & Color
  "DatePicker",
  "DateRangePicker",
  "Calendar",
  "ColorPicker",
  "ColorSwatchPicker",
  // Phase 4 (ADR-030)
  "SegmentedControl",
  "CardView",
  "TableView",
  "SelectBoxGroup",
  // CHILD_COMPOSITION_EXCLUDE_TAGS 소속 (synthetic prop 메커니즘 사용)
  // ElementSprite에서 EXCLUDE 가드가 먼저 평가되므로 _hasChildren 주입 차단 — 안전
  // useElementCreator의 Factory 경로 분기 목적으로만 등록
  "Tabs",
  "Tree",
  "TagGroup",
  "Table",
]);
```

**버그 수정 맥락 (2026-02-24)**: 이전에는 `useElementCreator.ts`에 로컬 `complexComponents` 배열이 있었고, `ElementSprite.tsx`는 `childElements.length > 0`만 체크했습니다. TextField 등에서 자식을 모두 삭제하면 `_hasChildren=false`가 되어 standalone label+input spec shapes가 재활성화되는 버그가 있었습니다. `COMPLEX_COMPONENT_TAGS` 공유 상수 도입으로 두 파일이 동일한 목록을 참조하고, `ElementSprite.tsx`는 complex component에 항상 `_hasChildren=true`를 주입하여 버그를 수정했습니다.

| 컴포넌트   | DOM 구조                                                           | factory 정의 파일                              |
| ---------- | ------------------------------------------------------------------ | ---------------------------------------------- |
| `Select`   | Select > Label, SelectTrigger > SelectValue, SelectIcon            | `FormComponents.ts`                            |
| `ComboBox` | ComboBox > Label, ComboBoxWrapper > ComboBoxInput, ComboBoxTrigger | `FormComponents.ts`                            |
| `Slider`   | Slider > Label, SliderOutput, SliderTrack > SliderThumb            | `FormComponents.ts → createSliderDefinition()` |

**Slider factory 참조**: `FormComponents.ts`의 `createSliderDefinition()`

- `ElementSprite.tsx`의 `_hasLabelChild` 체크에 `'Slider'` 포함
- `Slider.css`는 class selector 대신 `[data-size="sm"]`, `[data-variant="primary"]` data-attribute selector 사용
- SLIDER_DIMENSIONS 기준: `{ sm: { trackHeight: 4, thumbSize: 14 }, md: { trackHeight: 6, thumbSize: 18 }, lg: { trackHeight: 8, thumbSize: 22 } }`

### `_hasChildren` 주입 제외 대상: `CHILD_COMPOSITION_EXCLUDE_TAGS`

자식 조합 패턴에서 `_hasChildren` 주입을 건너뛰는 예외 컴포넌트 목록입니다.
`ElementSprite.tsx`의 `CHILD_COMPOSITION_EXCLUDE_TAGS` Set에 등록됩니다.

**기본 원칙**: 모든 컴포넌트에 자식이 있으면(또는 `COMPLEX_COMPONENT_TAGS`에 속하면) `_hasChildren: true`가 주입됩니다.
아래 컴포넌트만 예외적으로 주입을 건너뜁니다.

| 컴포넌트      | 제외 이유                        | 대체 메커니즘                                     |
| ------------- | -------------------------------- | ------------------------------------------------- |
| `Tabs`        | `_tabLabels` synthetic prop 사용 | `effectiveElementWithTabs`로 탭 레이블 주입       |
| `Breadcrumbs` | `_crumbs` synthetic prop 사용    | 자식 Breadcrumb 텍스트 수집 → `_crumbs` 배열 주입 |
| `TagGroup`    | `_tagItems` synthetic prop 사용  | 자식 Tag 정보 수집 → `_tagItems` 배열 주입        |
| `Table`       | 다단계 중첩 구조                 | 별도 구현 예정                                    |
| `Tree`        | 다단계 중첩 구조                 | 별도 구현 예정                                    |

**새 컴포넌트를 `CHILD_COMPOSITION_EXCLUDE_TAGS`에 추가하는 경우**:

- synthetic prop 메커니즘(`_crumbs`, `_tabLabels` 등)을 별도로 사용하는 경우
- 자식 조합이 아닌 복잡한 다단계 중첩이 필요한 경우

### 자식 내부 렌더링 제외 대상: `NON_CONTAINER_TAGS`

`BuilderCanvas.tsx`에서 자식 Element를 내부에 렌더링하지 않는 태그 목록입니다.
**기본 원칙**: 모든 컴포넌트가 컨테이너로 처리됩니다. 아래 카테고리만 제외됩니다.

| 카테고리           | 설명                                | 예시                                                                                                        |
| ------------------ | ----------------------------------- | ----------------------------------------------------------------------------------------------------------- |
| TEXT_TAGS          | TextSprite로 렌더링, 자식 배치 불가 | `Text`, `Heading`, `Description`, `Label`, `Paragraph`, `Link`, `Strong`, `Em`, `Code`, `Pre`, `Blockquote` |
| Void 요소          | 자식이 없는 단일 요소               | `Input`, `Textarea`, `Hr`, `Br`, `Img` 등                                                                   |
| Color Sub 컴포넌트 | 상위 컨테이너가 렌더링 담당         | `ColorSwatch`, `ColorThumb`, `ColorSlider` 등                                                               |

**이전 컨테이너 태그 목록 (구 opt-in 방식)**:
구 아키텍처에서는 `CONTAINER_TAGS`(화이트리스트)에 등록된 컴포넌트만 자식을 내부에 렌더링했습니다.
현재는 opt-out 방식으로 전환되어, `NON_CONTAINER_TAGS`에 없으면 자동으로 컨테이너로 처리됩니다.

특별 처리가 필요한 컨테이너:

- **Tabs**: Tab bar(spec shapes) + 활성 Panel(container) 렌더링
  - Tab 요소는 spec shapes가 렌더링 (`isSkippedChild` 처리)
  - Panel 요소는 컨테이너 시스템으로 내부 렌더링
  - `effectiveElementWithTabs`: `_tabLabels` prop 주입으로 동적 탭 레이블 지원
  - Panel은 element tree에 자식이 없으므로 Tabs 높이 계산은 childElements 블록 **밖**에서 처리
- **Card**: Heading + Description 자식 Element를 내부에서 렌더링
  - `createContainerChildRenderer`에서 `Card.props.heading/title/description`을 자식에 주입
  - 자식 Heading/Description은 TEXT_TAGS 경로 → TextSprite 렌더링
  - Card spec shapes는 배경/테두리/그림자만 담당 (텍스트 미포함)
- **TagGroup**: Label + TagList를 column 방향으로 배치하는 컨테이너
  - spec shapes 렌더링 없이 자식 Element를 직접 배치
  - Label은 자식 Element(TEXT_TAGS 경로 → TextSprite)가 렌더링 — spec shapes에서 중복 렌더링 금지
  - TagGroup.spec.ts의 shapes()는 배경/테두리 등 시각 컨테이너 요소만 반환 (label 텍스트 미포함)
  - isYogaSizedContainer로 분류: Yoga가 Label + TagList 높이 합산으로 컨테이너 크기 자동 결정
- **Breadcrumbs**: `filteredContainerChildren = []` — 자식 Breadcrumb 텍스트를 `_crumbs` 배열로 주입하여 spec shapes에서 렌더링
  - 자식 Breadcrumb 요소를 element tree에서 직접 배치하지 않음
  - `ElementSprite.tsx`에서 `tag === 'breadcrumbs'` 분기: 자식 중 `tag === 'Breadcrumb'`인 요소의 `props.children` 수집 → `_crumbs` prop 주입
  - `Breadcrumbs.spec.ts`의 shapes()가 `_crumbs` 배열 기반으로 구분자 포함 텍스트 shape 렌더링
  - SPEC_SHAPES_INPUT_TAGS에 `'breadcrumbs'` 포함 → `enrichWithIntrinsicSize`의 contentHeight ≤ 0 early return 우회

### rearrangeShapesForColumn 가드: SPEC_RENDERS_ALL_TAGS_SET (2026-02-25)

`ElementSprite.tsx`에서 spec shapes를 column 방향으로 재배치하는 `rearrangeShapesForColumn()` 호출 시,
일부 컴포넌트는 이 재배치를 건너뛰어야 합니다.

**왜 필요한가**: `rearrangeShapesForColumn()`은 shapes의 y 좌표를 위에서부터 순서대로 쌓이도록 재배치합니다.
그런데 `NumberField`, `SearchField` 등은 spec shapes 내부에서 이미 `labelOffset`을 통해 세로 레이아웃을
직접 계산합니다. 이 컴포넌트들에 `rearrangeShapesForColumn()`을 적용하면 좌표가 이중으로 변환되어 렌더링이 깨집니다.

```typescript
// ElementSprite.tsx — spec shapes 호출 후 column 재배치 로직

// SPEC_RENDERS_ALL_TAGS_SET: spec shapes가 자체 세로 레이아웃을 포함하는 컴포넌트
// 이 컴포넌트들은 rearrangeShapesForColumn 재배치를 스킵
const SPEC_RENDERS_ALL_TAGS_SET = new Set([
  "TextField",
  "NumberField",
  "SearchField",
  "DateField",
  "TimeField",
  "ColorField",
  "TextArea",
  "Slider",
]);

// ✅ SPEC_RENDERS_ALL_TAGS_SET 가드 적용
if (isColumn && !SPEC_RENDERS_ALL_TAGS_SET.has(tag)) {
  rearrangeShapesForColumn(shapes, finalWidth, sizeSpec.gap ?? 8);
}

// ❌ 가드 없이 모든 컴포넌트에 rearrangeShapesForColumn 적용
if (isColumn) {
  rearrangeShapesForColumn(shapes, finalWidth, sizeSpec.gap ?? 8);
}
// → NumberField: spec이 이미 y=labelOffset으로 배치한 shapes를
//   rearrangeShapesForColumn이 다시 y=0 기준으로 재배치
//   → label과 입력 필드가 겹치거나 잘못된 위치에 렌더링
```

**등록 기준**: 다음 조건 중 하나라도 해당하면 `SPEC_RENDERS_ALL_TAGS_SET`에 추가:

- spec shapes 내부에서 `labelOffset`을 계산하여 y 좌표를 직접 배치하는 컴포넌트
- spec shapes 내부에서 복수의 서브 컴포넌트(label + input + button 등)를 세로로 직접 배치하는 컴포넌트

**연관 Set 비교**:

| Set 이름                    | 위치                       | 목적                                                            |
| --------------------------- | -------------------------- | --------------------------------------------------------------- |
| `SPEC_RENDERS_ALL_TAGS_SET` | `ElementSprite.tsx` (로컬) | `rearrangeShapesForColumn` 재배치 스킵                          |
| `SPEC_RENDERS_ALL_TAGS`     | `BuilderCanvas.tsx` (로컬) | 자식 이중 렌더링 억제 (자식 sprite 렌더링 건너뜀)               |
| `SPEC_SHAPES_INPUT_TAGS`    | `engines/utils.ts`         | `enrichWithIntrinsicSize`의 contentHeight ≤ 0 early return 우회 |

> 세 Set은 비슷한 컴포넌트 목록을 가지지만 목적이 다릅니다. 새 컴포넌트 추가 시 세 곳 모두 확인해야 합니다.
