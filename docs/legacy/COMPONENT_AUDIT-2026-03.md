# composition 컴포넌트 전수 조사 보고서

> **폐기 (2026-09-09)**: 2026-03-07 에 ADR-030 착수 전 수행한 1회성 전수 조사다 (`docs/audit/` 에서 이동 — 해당 디렉토리는 이 파일 하나만 두고 2026-04 이후 갱신이 없었다). 컴포넌트 현황의 현행 정본은 catalog `COMPONENT_RULES_TABLE` 이다. 기록 보존용.

> **작성일**: 2026-03-07
> **목적**: ADR-030 (S2 Spectrum 전용 컴포넌트) 실행 전 기존 컴포넌트 완성도 점검
> **결론**: 기존 컴포넌트의 완성도를 높인 후 ADR-030을 진행해야 함

---

## 1. 요약 (Executive Summary)

### 감사 범위

| 영역                                    |    파일 수    | 검토 결과                                                    |
| --------------------------------------- | :-----------: | ------------------------------------------------------------ |
| Spec 정의 (`packages/specs/`)           |     76개      | 구조적으로 완성. defaultProps/shapes/presets 모두 존재       |
| Factory 정의 (`factories/definitions/`) | 9파일, 43함수 | **주요 컴포넌트 누락** (Button, Badge, Link, ProgressBar 등) |
| TAG_SPEC_MAP 등록                       |  ~95 entries  | 완전 (alias 포함)                                            |
| Component Metadata (이벤트)             |    65 타입    | 이벤트 정의 존재하나 **React Aria 이벤트 미구현 다수**       |
| S2 프로퍼티 정합성                      |   14개 비교   | **평균 ~50% 커버리지**                                       |

### 핵심 발견 사항

|    심각도    | 발견 사항                                           | 영향                                   |
| :----------: | --------------------------------------------------- | -------------------------------------- |
| **CRITICAL** | Button/Badge/Link/ProgressBar에 Factory 정의 없음   | 빌더에서 독립 컴포넌트로 생성 불가     |
|   **HIGH**   | S2 대비 프로퍼티 커버리지 ~50%                      | variant/validation/form 지원 미흡      |
|   **HIGH**   | 이벤트 패널의 React Aria 이벤트 미연동              | onPress/onSelectionChange 등 실행 불가 |
|   **HIGH**   | Preview 렌더러 일부 누락 (FileTrigger, DropZone 등) | 5+ 컴포넌트 Preview 렌더링 불가        |
|  **MEDIUM**  | Select ID 변환 취약성 (react-aria-\* 내부 ID 파싱)  | React Aria 업데이트 시 깨질 수 있음    |
|  **MEDIUM**  | Compositional 전환 불완전                           | 일부 컴포넌트 자식 구성 미지원         |

---

## 2. Spec 전수 조사 (76개)

### 2.1 전체 Spec 목록

| #   | Spec 이름         | 분류                 | Shapes | Variants | Sizes | Presets | 완성도 |
| --- | ----------------- | -------------------- | :----: | :------: | :---: | :-----: | :----: |
| 1   | Badge             | Feedback             |   O    |  O (17)  | O (5) |    O    |  100%  |
| 2   | Breadcrumbs       | Navigation           |   O    |  O (2)   | O (3) |    O    |  100%  |
| 3   | Button            | Actions              |   O    |  O (6)   | O (5) |    O    |  100%  |
| 4   | Calendar          | Date/Time            |   O    |  O (2)   | O (3) |    O    |  100%  |
| 5   | CalendarGrid      | Date/Time (child)    |   O    |    O     |   O   |    O    |  100%  |
| 6   | CalendarHeader    | Date/Time (child)    |   O    |    O     |   O   |    O    |  100%  |
| 7   | Card              | Layout               |   O    |  O (4)   | O (5) |    O    |  100%  |
| 8   | Checkbox          | Inputs               |   O    |  O (2)   | O (3) |    O    |  100%  |
| 9   | CheckboxGroup     | Inputs               |   O    |  O (2)   | O (3) |    O    |  100%  |
| 10  | ColorArea         | Color                |   O    |    O     |   O   |    O    |  100%  |
| 11  | ColorField        | Color                |   O    |    O     |   O   |    O    |  100%  |
| 12  | ColorPicker       | Color                |   O    |    O     |   O   |    O    |  100%  |
| 13  | ColorSlider       | Color                |   O    |    O     |   O   |    O    |  100%  |
| 14  | ColorSwatch       | Color                |   O    |    O     |   O   |    O    |  100%  |
| 15  | ColorSwatchPicker | Color                |   O    |    O     |   O   |    O    |  100%  |
| 16  | ColorWheel        | Color                |   O    |    O     |   O   |    O    |  100%  |
| 17  | ComboBox          | Selection            |   O    |    O     |   O   |    O    |  100%  |
| 18  | DateField         | Date/Time            |   O    |    O     |   O   |    O    |  100%  |
| 19  | DatePicker        | Date/Time            |   O    |    O     |   O   |    O    |  100%  |
| 20  | DateRangePicker   | Date/Time            |   O    |    O     |   O   |    O    |  100%  |
| 21  | DateSegment       | Date/Time (child)    |   O    |    O     |   O   |    O    |  100%  |
| 22  | Description       | Typography (child)   |   O    |    O     |   O   |    O    |  100%  |
| 23  | Dialog            | Overlays             |   O    |  O (2)   | O (3) |    O    |  100%  |
| 24  | Disclosure        | Layout               |   O    |  O (3)   | O (3) |    O    |  100%  |
| 25  | DisclosureGroup   | Layout               |   O    |    O     |   O   |    O    |  100%  |
| 26  | DropZone          | Inputs               |   O    |    O     |   O   |    O    |  100%  |
| 27  | FieldError        | Typography (child)   |   O    |    O     |   O   |    O    |  100%  |
| 28  | FileTrigger       | Inputs               |   O    |    O     |   O   |    O    |  100%  |
| 29  | Form              | Layout               |   O    |    O     |   O   |    O    |  100%  |
| 30  | GridList          | Data Display         |   O    |    O     |   O   |    O    |  100%  |
| 31  | Group             | Layout               |   O    |    O     |   O   |    O    |  100%  |
| 32  | Input             | Inputs (child)       |   O    |  O (3)   | O (3) |    O    |  100%  |
| 33  | Label             | Typography (child)   |   O    |    O     |   O   |    O    |  100%  |
| 34  | Link              | Actions              |   O    |    O     |   O   |    O    |  100%  |
| 35  | List              | Data Display         |   O    |    O     |   O   |    O    |  100%  |
| 36  | ListBox           | Data Display         |   O    |    O     |   O   |    O    |  100%  |
| 37  | MaskedFrame       | Display              |   O    |    O     |   O   |    O    |  100%  |
| 38  | Menu              | Actions              |   O    |    O     |   O   |    O    |  100%  |
| 39  | Meter             | Feedback             |   O    |  O (4)   | O (3) |    O    |  100%  |
| 40  | Nav               | Layout               |   O    |    O     |   O   |    O    |  100%  |
| 41  | NumberField       | Inputs               |   O    |  O (3)   | O (3) |    O    |  100%  |
| 42  | Pagination        | Navigation           |   O    |    O     |   O   |    O    |  100%  |
| 43  | Panel             | Layout               |   O    |    O     |   O   |    O    |  100%  |
| 44  | Popover           | Overlays             |   O    |    O     |   O   |    O    |  100%  |
| 45  | ProgressBar       | Feedback             |   O    |    O     | O (3) |    O    |  100%  |
| 46  | Radio             | Inputs               |   O    |  O (4)   | O (3) |    O    |  100%  |
| 47  | RadioGroup        | Inputs               |   O    |  O (2)   | O (3) |    O    |  100%  |
| 48  | ScrollBox         | Layout               |   O    |    O     |   O   |    O    |  100%  |
| 49  | SearchField       | Inputs               |   O    |  O (2)   | O (3) |    O    |  100%  |
| 50  | Section           | Layout (child)       |   O    |    O     |   O   |    O    |  100%  |
| 51  | Select            | Selection            |   O    |  O (3)   | O (3) |    O    |  100%  |
| 52  | SelectIcon        | Selection (child)    |   O    |    O     |   O   |    O    |  100%  |
| 53  | SelectTrigger     | Selection (child)    |   O    |    O     |   O   |    O    |  100%  |
| 54  | SelectValue       | Selection (child)    |   O    |    O     |   O   |    O    |  100%  |
| 55  | Separator         | Layout               |   O    |    O     |   O   |    O    |  100%  |
| 56  | Skeleton          | Feedback             |   O    |    O     |   O   |    O    |  100%  |
| 57  | Slider            | Inputs               |   O    |  O (3)   | O (3) |    O    |  100%  |
| 58  | SliderOutput      | Inputs (child)       |   O    |    O     |   O   |    O    |  100%  |
| 59  | SliderThumb       | Inputs (child)       |   O    |    O     |   O   |    O    |  100%  |
| 60  | SliderTrack       | Inputs (child)       |   O    |    O     |   O   |    O    |  100%  |
| 61  | Slot              | Layout               |   O    |    O     |   O   |    O    |  100%  |
| 62  | Switch            | Inputs               |   O    |  O (2)   | O (3) |    O    |  100%  |
| 63  | Switcher          | Navigation           |   O    |    O     |   O   |    O    |  100%  |
| 64  | Table             | Data Display         |   O    |  O (3)   | O (3) |    O    |  100%  |
| 65  | Tabs              | Layout               |   O    |    O     |   O   |    O    |  100%  |
| 66  | Tag               | Data Display (child) |   O    |  O (2)   | O (5) |    O    |  100%  |
| 67  | TagGroup          | Data Display         |   O    |    O     |   O   |    O    |  100%  |
| 68  | TextArea          | Inputs               |   O    |  O (3)   | O (3) |    O    |  100%  |
| 69  | TextField         | Inputs               |   O    |  O (6)   | O (3) |    O    |  100%  |
| 70  | TimeField         | Date/Time            |   O    |    O     |   O   |    O    |  100%  |
| 71  | Toast             | Feedback             |   O    |    O     |   O   |    O    |  100%  |
| 72  | ToggleButton      | Actions              |   O    |    O     | O (5) |    O    |  100%  |
| 73  | ToggleButtonGroup | Actions              |   O    |    O     |   O   |    O    |  100%  |
| 74  | Toolbar           | Actions              |   O    |    O     |   O   |    O    |  100%  |
| 75  | Tooltip           | Overlays             |   O    |  O (2)   | O (3) |    O    |  100%  |
| 76  | Tree              | Data Display         |   O    |    O     |   O   |    O    |  100%  |

### 2.2 Spec 구조 평가

**결론: Spec 레이어는 구조적으로 완성 상태**

- 모든 76개 Spec에 `defaultVariant`, `defaultSize`, `variants`, `sizes`, `states`, `render.shapes` 존재
- TokenRef 사용 일관성 양호
- `_hasChildren` 체크 패턴 적용 완료
- TODO/FIXME 없음

---

## 3. Factory 정의 전수 조사

### 3.1 Factory 파일별 컴포넌트 매핑

| Factory 파일                | 컴포넌트 정의 함수                  | 태그              |
| --------------------------- | ----------------------------------- | ----------------- |
| **FormComponents.ts**       | `createTextFieldDefinition`         | TextField         |
|                             | `createTextAreaDefinition`          | TextArea          |
|                             | `createFormDefinition`              | Form              |
|                             | `createToastDefinition`             | Toast             |
|                             | `createNumberFieldDefinition`       | NumberField       |
|                             | `createSearchFieldDefinition`       | SearchField       |
|                             | `createSliderDefinition`            | Slider            |
|                             | `createToolbarDefinition`           | Toolbar           |
| **GroupComponents.ts**      | `createGroupDefinition`             | Group             |
|                             | `createToggleButtonGroupDefinition` | ToggleButtonGroup |
|                             | `createSwitcherDefinition`          | Switcher          |
|                             | `createCheckboxGroupDefinition`     | CheckboxGroup     |
|                             | `createRadioGroupDefinition`        | RadioGroup        |
|                             | `createTagGroupDefinition`          | TagGroup          |
|                             | `createBreadcrumbsDefinition`       | Breadcrumbs       |
|                             | `createCheckboxDefinition`          | Checkbox          |
|                             | `createRadioDefinition`             | Radio             |
|                             | `createSwitchDefinition`            | Switch            |
| **SelectionComponents.ts**  | `createSelectDefinition`            | Select            |
|                             | `createComboBoxDefinition`          | ComboBox          |
|                             | `createListBoxDefinition`           | ListBox           |
|                             | `createGridListDefinition`          | GridList          |
|                             | `createListDefinition`              | List              |
| **LayoutComponents.ts**     | `createTabsDefinition`              | Tabs              |
|                             | `createCardDefinition`              | Card              |
|                             | `createTreeDefinition`              | Tree              |
| **NavigationComponents.ts** | `createMenuDefinition`              | Menu              |
|                             | `createPaginationDefinition`        | Pagination        |
|                             | `createDisclosureDefinition`        | Disclosure        |
|                             | `createDisclosureGroupDefinition`   | DisclosureGroup   |
| **OverlayComponents.ts**    | `createDialogDefinition`            | Dialog            |
|                             | `createPopoverDefinition`           | Popover           |
|                             | `createTooltipDefinition`           | Tooltip           |
| **DateColorComponents.ts**  | `createDatePickerDefinition`        | DatePicker        |
|                             | `createDateRangePickerDefinition`   | DateRangePicker   |
|                             | `createCalendarDefinition`          | Calendar          |
|                             | `createDateFieldDefinition`         | DateField         |
|                             | `createTimeFieldDefinition`         | TimeField         |
|                             | `createColorFieldDefinition`        | ColorField        |
|                             | `createColorPickerDefinition`       | ColorPicker       |
|                             | `createColorSwatchPickerDefinition` | ColorSwatchPicker |
| **DataComponents.ts**       | `createDataTableDefinition`         | DataTable         |
|                             | `createSlotDefinition`              | Slot              |
| **TableComponents.ts**      | (Table child components)            | Table parts       |

### 3.2 Factory 누락 컴포넌트 (CRITICAL)

Spec은 존재하지만 Factory 정의가 **없는** 컴포넌트:

| 컴포넌트        | Spec 존재 | TAG_SPEC_MAP | Factory | 영향                            |
| --------------- | :-------: | :----------: | :-----: | ------------------------------- |
| **Button**      |     O     |      O       |  **X**  | 독립 생성 불가 (child로만 사용) |
| **Badge**       |     O     |      O       |  **X**  | 독립 생성 불가                  |
| **Link**        |     O     |      O       |  **X**  | 독립 생성 불가                  |
| **ProgressBar** |     O     |      O       |  **X**  | 독립 생성 불가                  |
| **Meter**       |     O     |      O       |  **X**  | 독립 생성 불가                  |
| **Separator**   |     O     |      O       |  **X**  | 독립 생성 불가                  |
| **Skeleton**    |     O     |      O       |  **X**  | 독립 생성 불가                  |
| **MaskedFrame** |     O     |      O       |  **X**  | 독립 생성 불가                  |
| **ScrollBox**   |     O     |      O       |  **X**  | 독립 생성 불가                  |
| **Nav**         |     O     |      O       |  **X**  | 독립 생성 불가                  |
| **Panel**       |     O     |      O       |  **X**  | 독립 생성 불가                  |
| **DropZone**    |     O     |      O       |  **X**  | 독립 생성 불가                  |
| **FileTrigger** |     O     |      O       |  **X**  | 독립 생성 불가                  |

> **참고**: Button/Badge/Link 등은 다른 compositional 컴포넌트의 child로는 사용되지만,
> 빌더 팔레트에서 사용자가 직접 드래그하여 생성하는 Factory 정의가 누락됨.
> metadata.ts에는 등록되어 있어 Inspector에서 인식은 하지만, 초기 생성 시 기본값/자식 구성이 없음.

---

## 4. S2 프로퍼티 정합성 비교

### 4.1 컴포넌트별 S2 커버리지

| 컴포넌트        | Factory | S2 커버리지 | 주요 누락 프로퍼티                                               |
| --------------- | :-----: | :---------: | ---------------------------------------------------------------- |
| **Button**      |    X    |    ~20%     | isPending, form props, staticColor, fillStyle (outline)          |
| **TextField**   |    O    |    ~70%     | autoComplete, inputMode, contextualHelp, labelPosition, validate |
| **Checkbox**    |    O    |    ~50%     | isEmphasized, isInvalid, isReadOnly, form (name/value)           |
| **Switch**      |    O    |    ~40%     | isEmphasized, isReadOnly, form (name/value)                      |
| **Badge**       |    X    |     ~0%     | variant system, fillStyle (bold/subtle/outline)                  |
| **Tabs**        |    O    |    ~60%     | density, disabledKeys, keyboardActivation, labelBehavior         |
| **Dialog**      |    O    |    ~40%     | isDismissible, AlertDialog, FullscreenDialog, DialogTrigger      |
| **Select**      |    O    |    ~50%     | onSelectionChange, validation, form (name), dynamic items        |
| **RadioGroup**  |    O    |    ~50%     | size, isEmphasized, validation, form (name), description         |
| **Slider**      |    O    |    ~60%     | size, isEmphasized, thumbStyle, trackStyle, fillOffset           |
| **ProgressBar** |    X    |    ~20%     | isIndeterminate, valueLabel, size, staticColor                   |
| **Card**        |    O    |    ~60%     | CardPreview, Content slots, Footer, card type variants           |
| **Link**        |    X    |     ~0%     | href, variant, isQuiet, isStandalone, staticColor                |
| **Tooltip**     |    O    |    ~40%     | TooltipTrigger, delay, positioning, isDisabled                   |

### 4.2 공통 누락 패턴

| 누락 패턴                                      | 해당 컴포넌트                                      | 우선순위 |
| ---------------------------------------------- | -------------------------------------------------- | :------: |
| **Form 제출 (name/value)**                     | Checkbox, Switch, Radio, Select, Slider, TextField |   HIGH   |
| **Validation (isInvalid/isRequired/validate)** | Checkbox, RadioGroup, Select, ComboBox             |   HIGH   |
| **isEmphasized**                               | Checkbox, Switch, Radio, Slider                    |  MEDIUM  |
| **isReadOnly**                                 | Checkbox, Switch, RadioGroup                       |  MEDIUM  |
| **staticColor**                                | Button, ProgressBar, Link, Badge                   |  MEDIUM  |
| **isPending/isLoading**                        | Button, Select (Picker)                            |  MEDIUM  |
| **contextualHelp**                             | TextField, NumberField, SearchField                |   LOW    |
| **density**                                    | Tabs, TagGroup                                     |   LOW    |

### 4.3 불필요한 프로퍼티 (S2에 없는 옵션)

| 컴포넌트  | composition 전용 프로퍼티                            | S2 해당 없음 이유                        | 조치               |
| --------- | ---------------------------------------------------- | ---------------------------------------- | ------------------ |
| TextField | variant: "accent", "neutral", "purple", "positive"   | S2는 default만 존재                      | 유지 (커스텀 확장) |
| Button    | variant: "premium", "genai"                          | S2는 accent/primary/secondary/negative만 | 유지 (커스텀 확장) |
| Badge     | variant: 17개 named colors                           | S2도 유사하게 많은 named colors 보유     | 유지               |
| Card      | variant: "primary", "secondary", "tertiary", "quiet" | S2와 이름 다름                           | 검토 필요          |

> **결론**: composition 커스텀 확장 variant는 유지하되, S2 표준 variant는 반드시 포함해야 함.

---

## 5. 이벤트 패널 연동 현황

### 5.1 이벤트 시스템 구조

```
metadata.ts (supportedEvents 정의)
    ↓
EventsPanel.tsx (이벤트 선택 UI)
    ↓
useEventHandlers.ts (핸들러 관리)
    ↓
eventExecutor.ts (런타임 실행)
    ↓
Preview iframe (postMessage)
```

### 5.2 이벤트 등록 현황

| 카테고리     | 컴포넌트 수 | 이벤트 정의됨 |          이벤트 없음          |
| ------------ | :---------: | :-----------: | :---------------------------: |
| Actions      |      6      |       6       |               0               |
| Inputs       |     12      |      12       |               0               |
| Color        |      7      |       6       |        1 (ColorSwatch)        |
| Data Display |      6      |       6       |               0               |
| Feedback     |      5      |       2       | 3 (ProgressBar, Meter, Badge) |
| Layout       |     12      |      10       |        2 (body, Slot)         |
| Overlays     |      3      |       3       |               0               |
| Date & Time  |      6      |       6       |               0               |
| Items        |      9      |       9       |               0               |
| Table Parts  |      5      |       1       |               4               |
| **합계**     |   **65**    |    **55**     |            **10**             |

### 5.3 이벤트 연동 미비 사항

| 이슈                             | 설명                                                                                                            |        영향도         |
| -------------------------------- | --------------------------------------------------------------------------------------------------------------- | :-------------------: |
| **React Aria 이벤트 미구현**     | onPress, onSelectionChange, onAction 등은 metadata에 정의되어 있으나 실제 Preview 런타임에서 실행 매핑이 불완전 |         HIGH          |
| **DOM ↔ React Aria 이벤트 혼용** | onClick(DOM) vs onPress(React Aria) 양쪽 모두 등록                                                              |        MEDIUM         |
| **이벤트 실행 검증 부재**        | eventExecutor.ts가 모든 이벤트 타입을 실행할 수 있는지 테스트 없음                                              |         HIGH          |
| **정적 컴포넌트 이벤트 누락**    | ProgressBar, Meter, Badge에 supportedEvents: []                                                                 | LOW (정적 디스플레이) |

---

## 6. Preview 렌더러 현황

### 6.1 렌더러 파일 구조

Preview 컴포넌트는 `packages/shared/src/renderers/`에 7개 파일로 구현:

| 렌더러 파일             | 컴포넌트 수 | 주요 컴포넌트                                               |
| ----------------------- | :---------: | ----------------------------------------------------------- |
| FormRenderers.tsx       |     13      | TextField, NumberField, Checkbox, Radio, Switch             |
| SelectionRenderers.tsx  |      8      | ListBox, GridList, Select, ComboBox, Slider                 |
| LayoutRenderers.tsx     |     20      | Tabs, Card, Button, Badge, Link, ProgressBar, Meter         |
| DateRenderers.tsx       |      5      | Calendar, DatePicker, DateRangePicker, DateField, TimeField |
| CollectionRenderers.tsx |      9      | Tree, TagGroup, ToggleButtonGroup, Menu, Toolbar            |
| TableRenderer.tsx       |      6      | Table, Column, Row, Cell                                    |
| DataRenderers.tsx       |      1      | DataTable (비시각적)                                        |
| **합계**                |   **46**    | `rendererMap` 등록                                          |

### 6.2 누락 렌더러

| 컴포넌트    | Spec 존재 | Factory 존재 | 렌더러 | 영향                            |
| ----------- | :-------: | :----------: | :----: | ------------------------------- |
| FileTrigger |     O     |      X       | **X**  | Preview에서 파일 업로드 불가    |
| DropZone    |     O     |      X       | **X**  | Preview에서 드래그앤드롭 불가   |
| Pagination  |     O     |      O       | **X**  | Preview에서 페이지네이션 불가   |
| Toast       |     O     |      O       | **X**  | Preview에서 토스트 알림 불가    |
| ColorArea   |     O     |      X       | **X**  | Preview에서 색상 영역 선택 불가 |
| ColorSlider |     O     |      X       | **X**  | Preview에서 색상 슬라이더 불가  |
| ColorWheel  |     O     |      X       | **X**  | Preview에서 색상 휠 불가        |
| Skeleton    |     O     |      X       | **X**  | Preview에서 스켈레톤 로딩 불가  |

### 6.3 Preview 이슈

|   심각도   | 이슈                         | 설명                                                      |
| :--------: | ---------------------------- | --------------------------------------------------------- |
|  **HIGH**  | Select react-aria-\* ID 파싱 | 내부 ID를 수동 변환 — React Aria 업데이트 시 깨질 수 있음 |
| **MEDIUM** | DataBinding 감지 중복        | PropertyDataBinding 로직이 여러 렌더러에 반복             |
|  **LOW**   | 에러 silent catch            | DataTable/Select DB 에러 시 사용자 알림 없음              |

---

## 7. Compositional 전환 상태

### 7.1 Compositional 아키텍처 적용 현황

|    상태    | 컴포넌트                                                                                                                                | 설명                                       |
| :--------: | --------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------ |
|  **완전**  | TextField, TextArea, NumberField, SearchField, Select, ComboBox, Slider, DatePicker, DateRangePicker, DateField, TimeField, ColorPicker | 부모 → 자식 구성 완전                      |
|  **완전**  | CheckboxGroup, RadioGroup, ToggleButtonGroup, TagGroup, Table, Tabs, Card, Dialog, Disclosure, DisclosureGroup                          | 컨테이너 + 자식 패턴 완전                  |
|  **완전**  | Menu, Breadcrumbs, Tree, GridList, ListBox, List, Form, Toolbar                                                                         | 컬렉션 패턴 완전                           |
|  **부분**  | Calendar, ColorArea, ColorSlider, ColorWheel, ColorSwatchPicker                                                                         | 자식은 Spec 내부 생성 (사용자 커스텀 불가) |
| **미적용** | Button, Badge, Link, Separator, MaskedFrame, Skeleton                                                                                   | 단일 컴포넌트 (자식 불필요)                |
| **미적용** | ProgressBar, Meter, Popover, Tooltip                                                                                                    | 단일/오버레이 (자식은 텍스트만)            |

> **결론**: Compositional 전환은 대부분 완료. 미적용은 단일 컴포넌트라 전환 불필요.

---

## 8. 우선 조치 사항 (ADR-030 선행 작업)

### Priority 1: CRITICAL — Factory 누락 보완

| #   | 작업              | 대상 컴포넌트                                | 난이도 |
| --- | ----------------- | -------------------------------------------- | :----: |
| 1   | Factory 정의 추가 | Button                                       |  낮음  |
| 2   | Factory 정의 추가 | Badge                                        |  낮음  |
| 3   | Factory 정의 추가 | Link                                         |  낮음  |
| 4   | Factory 정의 추가 | ProgressBar                                  |  낮음  |
| 5   | Factory 정의 추가 | Separator                                    |  낮음  |
| 6   | Factory 정의 추가 | Meter                                        |  낮음  |
| 7   | Factory 정의 추가 | Nav, Panel, ScrollBox                        |  중간  |
| 8   | Factory 정의 추가 | MaskedFrame, Skeleton, DropZone, FileTrigger |  중간  |

### Priority 2: HIGH — S2 프로퍼티 정합성

| #   | 작업                                                  | 대상                                               | 난이도 |
| --- | ----------------------------------------------------- | -------------------------------------------------- | :----: |
| 1   | Form 제출 props 추가 (name/value)                     | Checkbox, Switch, Radio, Select, Slider, TextField |  중간  |
| 2   | Validation props 추가 (isInvalid/isRequired/validate) | Checkbox, RadioGroup, Select, ComboBox             |  중간  |
| 3   | isEmphasized variant 추가                             | Checkbox, Switch, RadioGroup, Slider               |  낮음  |
| 4   | isReadOnly 상태 추가                                  | Checkbox, Switch, RadioGroup                       |  낮음  |
| 5   | Button isPending 상태 추가                            | Button                                             |  중간  |
| 6   | Dialog 기능 보완                                      | isDismissible, AlertDialog variant                 |  중간  |

### Priority 3: HIGH — 이벤트 패널 연동

| #   | 작업                             | 설명                                     | 난이도 |
| --- | -------------------------------- | ---------------------------------------- | :----: |
| 1   | React Aria 이벤트 실행 매핑 검증 | onPress, onSelectionChange, onAction 등  |  높음  |
| 2   | 이벤트 타입 표준화               | DOM 이벤트 ↔ React Aria 이벤트 통합 전략 |  높음  |
| 3   | 이벤트 실행 테스트               | 주요 컴포넌트별 이벤트 동작 검증         |  중간  |

### Priority 4: MEDIUM — 불필요한 옵션 정리

| #   | 작업                             | 설명                                      | 난이도 |
| --- | -------------------------------- | ----------------------------------------- | :----: |
| 1   | Card variant 이름 S2 정합성 검토 | primary/secondary/tertiary → S2 명칭 대조 |  낮음  |
| 2   | TextField 비표준 variant 검토    | accent/neutral/purple/positive 유지 여부  |  낮음  |
| 3   | Size 표기법 통일                 | sm/md/lg vs S/M/L 혼용 정리               |  낮음  |

---

## 9. ADR-030 진행 조건 (Gate)

ADR-030 Phase 1 착수 전 아래 조건 충족 필요:

| Gate | 조건                                               | 현재 상태 | 목표                  |
| :--: | -------------------------------------------------- | :-------: | --------------------- |
| G0-1 | Button/Badge/Link Factory 정의 완료                |     X     | Phase 1 전            |
| G0-2 | S2 프로퍼티 커버리지 70% 이상 (핵심 14개 컴포넌트) |   ~50%    | 70%+                  |
| G0-3 | 이벤트 패널 React Aria 이벤트 실행 검증            |  미검증   | 주요 이벤트 동작 확인 |
| G0-4 | Form 제출 props (name/value) 추가 완료             |     X     | 폼 컴포넌트 전체      |
| G0-5 | `pnpm type-check` 통과                             |     O     | 유지                  |

---

## 10. 참조

| 문서                     | 경로                                                                      |
| ------------------------ | ------------------------------------------------------------------------- |
| ADR-030 S2 전용 컴포넌트 | `docs/adr/030-s2-spectrum-only-components.md`                             |
| 컴포넌트 메타데이터      | `packages/shared/src/components/metadata.ts`                              |
| Factory 정의             | `apps/builder/src/builder/factories/definitions/`                         |
| TAG_SPEC_MAP             | `apps/builder/src/builder/workspace/canvas/sprites/ElementSprite.tsx:663` |
| 이벤트 패널              | `apps/builder/src/builder/panels/events/EventsPanel.tsx`                  |
| 이벤트 패널 문서         | `docs/reference/components/EVENTS_PANEL.md`                               |
| S2 Skill 참조            | `.agents/skills/react-spectrum-s2/references/components/`                 |
| React Aria Skill 참조    | `.agents/skills/react-aria/references/components/`                        |
