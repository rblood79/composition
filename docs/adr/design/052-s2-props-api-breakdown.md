# ADR-052 구현 분해: S2 Props API 정합성 마이그레이션

> 상위 결정: [ADR-052](../completed/052-s2-props-api-alignment.md)

## 변경 패턴 분류

| 패턴               | 설명                        |   Phase   |
| ------------------ | --------------------------- | :-------: |
| A. 이름만 변경     | 기능 동일, S2 네이밍 통일   |     1     |
| B. 기능 통합       | 여러 props → 하나의 S2 prop |     2     |
| C. 기능 변경       | S2에서 의미/타입이 바뀜     |     3     |
| ~~D. 구조 재설계~~ | ~~TableView 이벤트 모델~~   | 범위 제외 |

## Phase 1: 패턴 A — 이름만 변경 (4건)

### 대상

| 컴포넌트        | 현재            | S2                 | 변경 유형           |
| --------------- | --------------- | ------------------ | ------------------- |
| Dialog          | `isDismissable` | `isDismissible`    | 철자 수정           |
| DatePicker      | `visibleMonths` | `maxVisibleMonths` | 이름 변경           |
| DateRangePicker | `visibleMonths` | `maxVisibleMonths` | 이름 변경           |
| Popover         | `showArrow`     | `hideArrow`        | 이름 + boolean 반전 |

### 실제 참조 범위 (Codex 리뷰 반영)

**Dialog.isDismissable → isDismissible**:

- `packages/specs/src/components/Dialog.spec.ts` — interface + field + shapes
- `packages/shared/src/components/Dialog.tsx:39,45,61` — prop 정의 + 사용
- `packages/shared/src/renderers/LayoutRenderers.tsx:773` — `element.props.isDismissable`
- `apps/builder/src/builder/factories/definitions/OverlayComponents.ts:33` — **이미 `isDismissible` 저장** (불일치 선행 존재)

> **주의**: factory는 이미 S2 철자(`isDismissible`)를 사용하나, 나머지는 구 철자(`isDismissable`). 이 불일치를 Phase 1에서 `isDismissible`로 통일.

**DatePicker.visibleMonths → maxVisibleMonths**:

- `packages/specs/src/components/DatePicker.spec.ts` — interface + field + propagation
- `packages/shared/src/components/DatePicker.tsx:88,122,242,243,261` — prop 정의 + Calendar 전달
- `packages/shared/src/renderers/DateRenderers.tsx:83,108` — `element.props.visibleMonths`
- `packages/shared/src/components/Calendar.tsx:48,64,111,123` — 내부 prop (Calendar 자체도 변경 필요)
- `packages/shared/src/components/RangeCalendar.tsx:35,50,90,102` — 동일

**DateRangePicker.visibleMonths → maxVisibleMonths**:

- `packages/specs/src/components/DateRangePicker.spec.ts` — interface + field + propagation
- `packages/shared/src/components/DateRangePicker.tsx:74,108,228,229,247` — prop 정의 + Calendar 전달
- `packages/shared/src/renderers/DateRenderers.tsx:207-209` — `element.props.visibleMonths`

**Popover.showArrow → hideArrow**:

- `packages/specs/src/components/Popover.spec.ts` — interface (field 없음)
- `packages/shared/src/components/Popover.tsx:24,75,87` — prop 정의 + 조건부 렌더링
- boolean 반전: `showArrow={true}` → `hideArrow={false}` (기본값 변경)

### 변경 체크리스트 (prop별)

1. Spec Props 인터페이스 필드명 변경
2. Spec `properties.sections.fields` key 변경
3. Spec `render.shapes()` 내부 `props.X` 참조 변경
4. Spec propagation rules `parentProp`/`childProp` 변경
5. shared 컴포넌트 prop 정의 + 사용처 변경
6. renderer `element.props.X` 참조 변경
7. factory 초기값 키 변경
8. preview 컴포넌트 (해당 시)
9. canvas layout utils (해당 시)
10. defaultValue 확인
11. type-check + build 통과

### 데이터 normalization

기존 저장 데이터에 `isDismissable`, `visibleMonths`, `showArrow`가 있을 수 있으므로:

```typescript
// 런타임 normalization (로드 시 1회)
if ("isDismissable" in props && !("isDismissible" in props)) {
  props.isDismissible = props.isDismissable;
  delete props.isDismissable;
}
if ("visibleMonths" in props && !("maxVisibleMonths" in props)) {
  props.maxVisibleMonths = props.visibleMonths;
  delete props.visibleMonths;
}
if ("showArrow" in props && !("hideArrow" in props)) {
  props.hideArrow = !props.showArrow;
  delete props.showArrow;
}
```

## Phase 2: 패턴 B — 기능 통합 (4컴포넌트, -7 props)

### 대상

| 컴포넌트    | 제거 props                                                                                                        | 통합 대상                                 |
| ----------- | ----------------------------------------------------------------------------------------------------------------- | ----------------------------------------- |
| NumberField | formatStyle, currency, notation, decimals, minimumFractionDigits, maximumFractionDigits, showGroupSeparator (7개) | `formatOptions: Intl.NumberFormatOptions` |
| Meter       | valueFormat (1개)                                                                                                 | `formatOptions`                           |
| ProgressBar | valueFormat (1개)                                                                                                 | `formatOptions`                           |
| Slider      | valueFormat, unit (2개)                                                                                           | `formatOptions`                           |

### 현재 상태 (Codex 리뷰 반영)

NumberField.tsx는 **이미 formatOptions를 내부 지원** 중:

```typescript
// packages/shared/src/components/NumberField.tsx:81
formatOptions?: Intl.NumberFormatOptions;

// 내부에서 개별 props → formatOptions 합성
const formatOptions = { style: formatStyle, ... };
Object.assign(formatOptions, formatOptionsOverride);
```

따라서 Phase 2는 **"신규 도입"이 아니라 "이중 계약 정리"**:

1. Spec Props에서 개별 props 제거, `formatOptions`만 유지
2. Spec properties.fields에서 개별 field 제거, formatOptions 서브필드 에디터로 대체
3. shared 컴포넌트에서 개별 props 인터페이스 제거 (내부 합성 로직도 제거)
4. 기존 데이터 normalization: 개별 props → formatOptions 변환

### 참조 범위

**NumberField**:

- `packages/specs/src/components/NumberField.spec.ts` — interface + 7개 field
- `packages/shared/src/components/NumberField.tsx:49-81` — 개별 props + formatOptions
- `packages/shared/src/renderers/FormRenderers.tsx:206` — element.props 전달
- `apps/builder/src/types/builder/unified.types.ts:855` — 타입 정의

**Meter/ProgressBar/Slider**:

- 각 Spec의 `valueFormat` field + Props
- `render.shapes()` 내부에서 `props.valueFormat` 참조 (Meter, ProgressBar)
- shared 컴포넌트 내부 formatOptions 전달

### 프로퍼티 패널 UI

`FormatOptionsEditor` 커스텀 필드 컴포넌트:

```
[Style    ▾ decimal ]
[Currency ▾ KRW     ]  ← style="currency" 일 때만 표시
[Unit     ___       ]  ← style="unit" 일 때만 표시
[Notation ▾ standard]
[Min Digits  ___    ]
[Max Digits  ___    ]
[Group Sep   ☐     ]
```

### 데이터 normalization

```typescript
function normalizeFormatProps(props) {
  if (props.formatStyle && !props.formatOptions) {
    props.formatOptions = {
      style: props.formatStyle,
      currency: props.currency,
      notation: props.notation,
      minimumFractionDigits: props.decimals ?? props.minimumFractionDigits,
      maximumFractionDigits: props.decimals ?? props.maximumFractionDigits,
      useGrouping: props.showGroupSeparator,
    };
    delete props.formatStyle;
    delete props.currency;
    // ... 개별 props 정리
  }
  if (props.valueFormat && !props.formatOptions) {
    props.formatOptions = { style: props.valueFormat };
    if (props.unit) {
      props.formatOptions.unit = props.unit;
    }
    delete props.valueFormat;
    delete props.unit;
  }
}
```

## Phase 3: 패턴 C — 기능 변경

### 3-A. Meter/ProgressBar: `showValue` → `valueLabel` + `showValueLabel` (S2 기준)

**S2 실제 Props** (레퍼런스 확인):

- `valueLabel: ReactNode` — 커스텀 값 레이블 (비어있으면 value에서 자동 생성)
- `showValueLabel: boolean` — 값 레이블 표시 여부

**composition 적용**:

- **`showValue` 제거** — S2에 없는 prop
- **`valueLabel: string` 추가** — 커스텀 값 텍스트 (S2 ReactNode의 빌더 축소). 비어있으면 value + formatOptions로 자동 생성
- **`showValueLabel: boolean` 추가** — 값 레이블 표시/숨김 토글 (S2와 동일)
- 프로퍼티 패널: valueLabel = string input, showValueLabel = boolean switch

**기존 데이터 마이그레이션**: `showValue` → `showValueLabel`로 직접 매핑 (동일 의미)

### 3-B. Slider: `showValue` 제거 (S2 완전 따르기)

**S2 실제 동작**: Slider에 `showValue`/`valueLabel` prop 모두 없음. `SliderOutput`이 **항상 렌더링**됨 (숨기기 옵션 없음):

```tsx
// S2 Slider 내부 — outputValue는 항상 렌더링
let outputValue = (
  <SliderOutput>
    {({ state }) =>
      state.values.map((_, i) => state.getThumbValueLabel(i)).join(" – ")
    }
  </SliderOutput>
);
{
  labelPosition === "top" && outputValue;
} // 항상 표시
{
  labelPosition === "side" && outputValue;
} // 항상 표시
```

**composition 적용**:

- `showValue` prop 제거 — S2에 없는 prop
- SliderOutput은 항상 표시 (S2 동작과 일치)
- 기존 `showValue=false` 데이터: 마이그레이션 시 prop 삭제만 (SliderOutput은 항상 표시됨으로 변경)

### 참조 범위 — showValue (전체 경로)

`showValue` 제거 시 영향받는 모든 경로:

**Meter/ProgressBar 경로**:

- `packages/specs/src/components/Meter.spec.ts` — Props interface + field + shapes
- `packages/specs/src/components/ProgressBar.spec.ts` — 동일
- `packages/shared/src/renderers/LayoutRenderers.tsx:879,933` — `element.props.showValue`
- `apps/builder/src/builder/workspace/canvas/layout/engines/utils.ts:1688-1690` — 높이 계산

**Slider 경로**:

- `packages/specs/src/components/Slider.spec.ts:348` — shapes
- `packages/shared/src/components/Slider.tsx:60,88,135` — prop 정의 + 조건부 렌더링
- `packages/shared/src/renderers/LayoutRenderers.tsx:879` — element.props.showValue
- `packages/shared/src/renderers/SelectionRenderers.tsx:1265` — element.props.showValue
- `apps/builder/src/builder/workspace/canvas/layout/engines/implicitStyles.ts:1243-1323` — Label/Output 필터링 (6곳+)
- `apps/builder/src/builder/workspace/canvas/layout/engines/utils.ts:1672` — 높이 계산

### 3-C. TextField: `autoCorrect` 타입 변경

- 현재: `autoCorrect: boolean` (true/false)
- S2: `autoCorrect: string` (HTML 표준 "on"/"off")
- 프로퍼티 패널: boolean field → enum field ("on"/"off")

> **S2 divergence 명시**: S2는 `autoCorrect?: string` (제한 없는 string). composition는 `"on" | "off"` 유니온으로 유효 값만 허용. 실질적으로 호환되나 정확한 타입 일치는 아님.

### 데이터 normalization

```typescript
// Meter/ProgressBar: showValue → showValueLabel (S2 네이밍)
if ("showValue" in props && !("showValueLabel" in props)) {
  props.showValueLabel = props.showValue;
  delete props.showValue;
}

// Slider: showValue 제거 (S2는 SliderOutput 항상 표시)
if ("showValue" in props) {
  delete props.showValue;
}

// autoCorrect boolean → string
if (typeof props.autoCorrect === "boolean") {
  props.autoCorrect = props.autoCorrect ? "on" : "off";
}
```

## 범위 제외: TableView 구조 재설계

다음 항목은 이 ADR 범위에서 제외:

| 현재                              | S2                       | 제외 사유                                                                                                       |
| --------------------------------- | ------------------------ | --------------------------------------------------------------------------------------------------------------- |
| `TableView.allowsSorting`         | `Column.allowsSorting`   | Column Spec 레벨 이동. shared Table은 이미 Column `enableResizing`을 사용 중이므로 Spec↔shared 정합성 별도 작업 |
| `TableView.allowsResizingColumns` | `onResize`/`onResizeEnd` | 이벤트 모델 재설계. `TableEditor.tsx`가 column props를 직접 읽는 구조를 함께 변경해야 함                        |

별도 ADR 또는 작업 단위로 분리.
