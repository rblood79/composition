# ADR-053 구현 분해: S2 Props 커버리지 확장

> 상위 결정: [ADR-053](../completed/053-s2-props-coverage-expansion.md)

## 변경 패턴 분류

| 패턴                            | 설명                                          | Phase |
| ------------------------------- | --------------------------------------------- | :---: |
| A. 일괄 추가 — size XL          | 17개 컴포넌트에 XL 사이즈 추가                |   1   |
| B. 일괄 추가 — 공통 field props | contextualHelp, labelAlign, isEmphasized      |   2   |
| C. 일괄 추가 — staticColor auto | 4개 컴포넌트에 "auto" 옵션 추가               |   3   |
| D. 개별 컴포넌트 S2 신규 props  | 컴포넌트별 S2 전용 props 추가                 |   4   |
| E. variant 값 확장              | Badge/StatusLight named color, Toast 리네이밍 |   5   |

## Phase 1: size XL 일괄 추가 (17개 컴포넌트)

S2는 `'S'|'M'|'L'|'XL'` 4단계, composition는 `'sm'|'md'|'lg'` 3단계만 정의.

### 대상

DateField, DatePicker, DateRangePicker, Dialog, Form, Meter, NumberField, ProgressBar, Radio, RadioGroup, SearchField, Slider, StatusLight, Switch, TextArea, TextField, TimeField

### 변경 사항 (컴포넌트별)

1. Props 인터페이스: size 유니온에 `'xl'` 추가
2. Spec `sizes` 객체: `xl` 키 추가 (fontSize, padding, borderRadius 등)
3. Spec `properties.sections.fields`: size field options에 XL 추가
4. SyntheticComputedStyle: `computeFromTag` 에 xl 프리셋 추가
5. CSS 자동 생성: xl 사이즈 CSS 변수 생성

### 참고

- composition는 내부적으로 소문자(`sm/md/lg/xl`), S2는 대문자(`S/M/L/XL`). casing 차이는 의도적 (ADR-036 Spec 네이밍 규칙).
- 일부 컴포넌트는 이미 `xs`도 정의됨 (Button, NumberField, Select 등). S2에 `XS`는 없으나 빌더 확장으로 유지.

## Phase 2: 공통 field props 일괄 추가

### 2-A. contextualHelp (15개 컴포넌트)

S2의 `SpectrumLabelableProps`를 상속하는 모든 field 컴포넌트에 `contextualHelp` prop이 존재.

**대상**: CheckboxGroup, ColorField, ComboBox, DateField, DatePicker, DateRangePicker, NumberField, RadioGroup, SearchField, Select, Slider, TagGroup, TextArea, TextField, TimeField

**composition 적용**: `contextualHelp?: string` (S2는 ReactNode이나 빌더에서 string으로 축소)

### 2-B. labelAlign (10개 컴포넌트)

**대상**: Meter, NumberField, RadioGroup, SearchField, Select, Slider, TagGroup, TextArea, TextField, TimeField

**composition 적용**: `labelAlign?: 'start' | 'end'`

### 2-C. isEmphasized (4개 컴포넌트)

**대상**: Form, Radio, Slider, TagGroup

**composition 적용**: `isEmphasized?: boolean`

## Phase 3: staticColor 'auto' 추가 (4개 컴포넌트)

S2는 `staticColor: 'white' | 'black' | 'auto'`, composition는 `'white' | 'black'`만.

**대상**: Button, Meter, ProgressBar, ProgressCircle

**변경**: Props 인터페이스 + properties field options에 `'auto'` 추가

## Phase 4: 개별 컴포넌트 S2 신규 props

| 컴포넌트          | S2 prop                                                                         | 타입                        | 비고            |
| ----------------- | ------------------------------------------------------------------------------- | --------------------------- | --------------- |
| Accordion         | `expandedKeys`, `defaultExpandedKeys`                                           | `Iterable<Key>`             | React Aria 상속 |
| CardView          | `loadingState`                                                                  | `LoadingState`              | 비동기 로딩     |
| ColorSwatch       | `rounding`                                                                      | `'default'\|'none'\|'full'` | S2 신규         |
| ColorSwatchPicker | `density`, `rounding`                                                           | enum                        | S2 신규         |
| Disclosure        | `density`, `isQuiet`                                                            | enum, boolean               | S2 신규         |
| DropZone          | `isFilled`, `replaceMessage`                                                    | boolean, string             | S2 신규         |
| Link              | `isStandalone`                                                                  | boolean                     | S2 신규         |
| Menu              | `hideLinkOutIcon`                                                               | boolean                     | S2 신규         |
| Popover           | `offset`, `padding`                                                             | number, enum                | S2 신규         |
| Select            | `isQuiet`, `direction`, `align`, `menuWidth`, `shouldFlip`                      | 다양                        | S2 다수         |
| Slider            | `isEmphasized`, `trackStyle`, `thumbStyle`, `fillOffset`                        | 다양                        | S2 신규         |
| Tabs              | `labelBehavior`                                                                 | `'show'\|'hide'`            | S2 신규         |
| TagGroup          | `isEmphasized`, `groupActionLabel`                                              | boolean, string             | S2 신규         |
| TimeField         | `description`, `errorMessage`, `isRequired`, `isReadOnly`, `necessityIndicator` | 다양                        | 대폭 누락       |
| ToggleButtonGroup | `density`, `isJustified`, `staticColor`                                         | 다양                        | S2 신규         |

## Phase 5: variant 값 확장

### 5-A. Badge named colors (+6)

S2 추가: `chartreuse`, `celery`, `seafoam`, `brown`, `cinnamon`, `silver`

### 5-B. StatusLight named colors (+7)

S2 추가: `seafoam`, `pink`, `turquoise`, `cinnamon`, `brown`, `silver`, `yellow`

### 5-C. Toast variant 리네이밍

| composition 현재 | S2         | 변경     |
| ---------------- | ---------- | -------- |
| `success`        | `positive` | 리네이밍 |
| `warning`        | `notice`   | 리네이밍 |
| `error`          | `negative` | 리네이밍 |
| `info`           | `info`     | 유지     |

### 5-D. Toast position 값 변경

| composition 현재 | S2             |
| ---------------- | -------------- |
| `top-right`      | `top end`      |
| `top-left`       | `top start`    |
| `top-center`     | `top`          |
| `bottom-right`   | `bottom end`   |
| `bottom-left`    | `bottom start` |
| `bottom-center`  | `bottom`       |

## Phase별 변경 체크리스트

각 prop 추가/변경 시:

1. Props 인터페이스 필드 추가
2. `properties.sections.fields` field 추가 (defaultValue 포함)
3. Spec `sizes` 객체 확장 (size XL의 경우)
4. shared 컴포넌트 prop 추가 (해당 시)
5. renderer 전달 (해당 시)
6. type-check + build 통과
