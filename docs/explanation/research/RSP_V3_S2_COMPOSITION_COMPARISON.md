# `@adobe/react-spectrum` (v3) vs `@react-spectrum/s2` vs composition 비교 분석

> 작성일: 2026-06-25
> 목적: Adobe 의 두 React Spectrum 라이브러리 세대(v3 / S2) 차이와, composition 이 어떤 컴포넌트를 어떤 전략으로 채택했는지 3자 비교
> 출처: 두 패키지 GitHub `src` 디렉터리 + 공식 [Migrating to Spectrum 2](https://react-spectrum.adobe.com/migrating) (2026-06 기준) + composition `packages/shared/src/catalog/generated/componentRulesTable.ts`
>
> **관련 문서**: [REACT_SPECTRUM_COMPARISON.md](./REACT_SPECTRUM_COMPARISON.md) — 2025-12-20 작성, **RAC vs S2** 관점(조합 제작 가능 여부 중심). 본 문서는 **v3 vs S2 세대 차이 + composition 채택 전략** 관점으로 주제가 다름.

---

## 1. 라이브러리 정체성 — v3 vs S2

두 패키지 모두 Adobe 가 만든 **React Spectrum 디자인 시스템**의 React 구현이지만, **디자인 세대**와 **스타일링 방식**이 근본적으로 다르다.

| 구분            | `@adobe/react-spectrum` (v3)                                             | `@react-spectrum/s2` (S2)                               |
| --------------- | ------------------------------------------------------------------------ | ------------------------------------------------------- |
| **디자인 세대** | Spectrum 1 (기존 디자인 언어)                                            | **Spectrum 2** (Adobe 신규 디자인 언어)                 |
| **스타일링**    | `Provider` + theme 객체, **style props** (`UNSAFE_className`, prop 기반) | **style macro** (`style({...})` — 빌드타임 CSS 생성)    |
| **테마 적용**   | 런타임 theme provider 로 색상/스케일 주입                                | 빌드타임에 Spectrum 2 디자인 토큰을 클래스로 emit       |
| **내부 기반**   | 자체 styled 컴포넌트 계층                                                | **React Aria Components 위에 Spectrum 2 스타일 입힘**   |
| **타입 안전성** | prop 단위                                                                | style macro 가 TS 타입 + 조건부 스타일(state 기반) 지원 |
| **성능**        | 런타임 스타일 처리                                                       | 빌드타임 CSS → 런타임 오버헤드 최소                     |

### 1.1 스타일링 방식 차이 (본질)

**v3** — 런타임 theme provider + prop 기반:

```tsx
import { Provider, defaultTheme, Button } from "@adobe/react-spectrum";

<Provider theme={defaultTheme}>
  <Button variant="accent">Click</Button>
</Provider>;
```

**S2** — 빌드타임 style macro (Parcel macro):

```tsx
import { Button } from "@react-spectrum/s2";
import { style } from "@react-spectrum/s2/style" with { type: "macro" };

<div className={style({ backgroundColor: "red-400", color: "white" })}>
  ...
</div>;
```

style macro 는 빌드 시점에 JS 스타일 객체를 최적화된 CSS 클래스로 변환한다. 런타임 스타일 계산이 사라져 성능이 좋고, Spectrum 2 디자인 토큰(색상/간격/타이포)을 타입 안전하게 강제한다.

### 1.2 3 라이브러리 계층 관계

```
react-aria-components (RAC)   ← unstyled, 접근성 primitive (D1)
        │
        ├── @adobe/react-spectrum (v3)   ← Spectrum 1 스타일 입힘 (런타임 theme)
        │
        └── @react-spectrum/s2 (S2)      ← Spectrum 2 스타일 입힘 (style macro)
```

- **RAC** = 스타일 없는 접근성 골격 (headless)
- **v3 / S2** = 그 위에 각각 Spectrum 1 / Spectrum 2 디자인을 얹은 styled 버전

---

## 2. composition 의 위치 — RAC + S2 방향 + 빌더 확장

composition 은 v3/S2 컴포넌트를 **직접 사용하지 않는다.** 3-Domain SSOT 분할([ssot-hierarchy.md](../../../.claude/rules/ssot-hierarchy.md))에 따라:

- **D1 (DOM/접근성)** → **RAC 채택** (절대 권위). v3/S2 의 styled 버전이 아니라 unstyled primitive 를 쓰는 이유 = 스타일 자유도 확보. 디자인은 composition Spec(D3)이 결정하므로, Adobe styled 결과물(v3/S2)을 그대로 쓰면 D3 정본을 침범한다.
- **D2 (Props/API)** → **RSP(React Spectrum) 참조**. `isQuiet` 같은 prop 을 RSP 참조 기반으로 선별 채택.
- **D3 (시각 스타일)** → **Spec/catalog 가 SSOT**. 토큰 체계는 `--accent`, `--negative` 등 **S2 시맨틱 네이밍**(ADR-022)을 따름.

즉 composition 의 실제 컴포넌트 정본은 spec 이 아니라 **catalog `COMPONENT_RULES_TABLE`** 다 (ADR-912 catalog 전환으로 spec 파일은 Frame/Group/Slot 3개만 영구 잔존).

---

## 3. v3 / S2 / composition 컴포넌트 비교표

> composition 열은 catalog `COMPONENT_RULES_TABLE`(121 키, sub-part 포함) 기준 실제 구현 여부. "있음 = composition 에 동일 역할 컴포넌트가 catalog 에 등록됨"을 뜻함 (RAC 위에 재구현).
> 범례: ✅ 있음 / ❌ 없음 / (...) 명칭·구조 차이 부연

### 3.1 세 곳 모두 존재 (코어)

| 컴포넌트                                                   |       v3       |      S2      | composition | 비고                                        |
| ---------------------------------------------------------- | :------------: | :----------: | :---------: | ------------------------------------------- |
| Button                                                     |       ✅       |      ✅      |     ✅      |                                             |
| ToggleButton / ToggleButtonGroup                           |       ✅       |      ✅      |     ✅      |                                             |
| ButtonGroup                                                |       ✅       |      ✅      |     ✅      |                                             |
| Checkbox / CheckboxGroup                                   |       ✅       |      ✅      |     ✅      |                                             |
| Radio / RadioGroup                                         |       ✅       |      ✅      |     ✅      |                                             |
| Switch                                                     |       ✅       |      ✅      |     ✅      |                                             |
| TextField / TextArea                                       |       ✅       |      ✅      |     ✅      |                                             |
| NumberField                                                |       ✅       |      ✅      |     ✅      |                                             |
| SearchField                                                |       ✅       |      ✅      |     ✅      |                                             |
| Form / Field / FieldError                                  |       ✅       |      ✅      |     ✅      | composition 에 FormField/Label/Input 분리   |
| Slider (Track/Thumb/Output)                                |       ✅       |      ✅      |     ✅      |                                             |
| Meter (Track/Value)                                        |       ✅       |      ✅      |     ✅      |                                             |
| ComboBox                                                   |       ✅       |      ✅      |     ✅      |                                             |
| Select (v3=Picker)                                         |       ✅       |      ✅      |     ✅      | composition=Select+SelectTrigger/Value/Icon |
| Menu / MenuItem                                            |       ✅       |      ✅      |     ✅      |                                             |
| ListBox / ListBoxItem                                      |       ✅       |      ✅      |     ✅      |                                             |
| GridList / GridListItem                                    |       ✅       |      ✅      |     ✅      | RAC 명칭                                    |
| Table / TableView                                          |       ✅       |      ✅      |     ✅      | 둘 다 (TableView + Table/Row/Cell)          |
| Tree                                                       |       ✅       | ✅(TreeView) |     ✅      |                                             |
| TagGroup / Tag / TagList                                   |       ✅       |      ✅      |     ✅      |                                             |
| Breadcrumbs / Breadcrumb                                   |       ✅       |      ✅      |     ✅      |                                             |
| Tabs (TabList/Tab/TabPanel)                                |       ✅       |      ✅      |     ✅      | composition 에 TabPanels 보존               |
| Calendar / RangeCalendar                                   |       ✅       |      ✅      |     ✅      | Grid/Header sub-part 포함                   |
| DateField / TimeField                                      |       ✅       |      ✅      |     ✅      | DateInput sub-part                          |
| DatePicker / DateRangePicker                               |       ✅       |      ✅      |     ✅      |                                             |
| Dialog                                                     |       ✅       |      ✅      |     ✅      | DialogFooter sub-part                       |
| Modal                                                      |   (Overlays)   |      ✅      |     ✅      |                                             |
| Popover                                                    |       ✅       |      ✅      |     ✅      |                                             |
| Tooltip                                                    |       ✅       |      ✅      |     ✅      |                                             |
| Color (Area/Field/Slider/Swatch/Wheel/SwatchPicker/Picker) |       ✅       |      ✅      |     ✅      | composition 풀세트                          |
| Avatar                                                     |       ✅       |      ✅      |     ✅      |                                             |
| AvatarGroup                                                |       ❌       |      ✅      |     ✅      | S2 신규 → composition 채택                  |
| Badge                                                      |       ✅       |      ✅      |     ✅      |                                             |
| StatusLight                                                |       ✅       |      ✅      |     ✅      |                                             |
| Divider (composition=Separator)                            |       ✅       |      ✅      |     ✅      |                                             |
| Link                                                       |       ✅       |      ✅      |     ✅      |                                             |
| Image                                                      |       ✅       |      ✅      |     ✅      |                                             |
| Icon                                                       |       ✅       |      ✅      |     ✅      |                                             |
| IllustratedMessage                                         |       ✅       |      ✅      |     ✅      |                                             |
| InlineAlert                                                |       ✅       |      ✅      |     ✅      |                                             |
| ProgressBar (Track/Value)                                  |       ✅       |      ✅      |     ✅      |                                             |
| ProgressCircle                                             |       ✅       |      ✅      |     ✅      |                                             |
| DropZone                                                   |       ✅       |      ✅      |     ✅      |                                             |
| Toast                                                      |       ✅       |      ✅      |     ✅      |                                             |
| Card (Header/Content/Footer/Preview)                       |       ✅       |      ✅      |     ✅      | composition 풀 sub-part                     |
| CardView                                                   |       ❌       |      ✅      |     ✅      | S2 신규 → composition 채택                  |
| Disclosure / DisclosureGroup                               | (v3=Accordion) |      ✅      |     ✅      | composition=S2 구조 채택                    |
| Skeleton                                                   |       ❌       |      ✅      |     ✅      | S2 신규 → composition 채택                  |
| Toolbar                                                    |       ❌       |      ✅      |     ✅      | S2 신규 → composition 채택                  |
| FileTrigger                                                |     (RAC)      |      —       |     ✅      | RAC 직접                                    |
| Group                                                      |       ✅       |    (내부)    |     ✅      | composition=D1 ARIA Group                   |

### 3.2 composition 에만 / composition 이 별도 도입

| 컴포넌트                                 |     v3      |    S2     | composition | 비고                                              |
| ---------------------------------------- | :---------: | :-------: | :---------: | ------------------------------------------------- |
| **Frame**                                |     ❌      |    ❌     |     ✅      | composition canonical 레이아웃 컨테이너 (ADR-130) |
| **Slot**                                 |     ❌      |    ❌     |     ✅      | Frame projection slot (ADR-135)                   |
| **Pagination**                           |     ❌      |    ❌     |     ✅      | composition 자체 도입                             |
| **Nav**                                  |     ❌      |    ❌     |     ✅      | 시맨틱 네비게이션 컨테이너                        |
| Text / Heading / Paragraph / Description | (Text 묶음) | (Content) |     ✅      | composition 텍스트 leaf 분리                      |
| Code / Kbd                               |     ❌      |    ❌     |     ✅      | 인라인 텍스트 leaf                                |
| Header / Section / Separator             |   (부분)    |  (부분)   |     ✅      | 시맨틱 컨테이너 leaf                              |

### 3.3 v3/S2 에 있으나 composition 미채택

| 컴포넌트                                                    | v3  |    S2     | composition | 비고                                     |
| ----------------------------------------------------------- | :-: | :-------: | :---------: | ---------------------------------------- |
| Flex / Grid / View / Well                                   | ✅  | ❌(macro) |     ❌      | composition 은 **Frame + style** 로 대체 |
| ActionButton / ActionGroup / ActionMenu / ActionBar         | ✅  |    ✅     |     ❌      | composition 미도입 (Button 으로 흡수)    |
| SegmentedControl                                            | ❌  |    ✅     |     ❌      | composition=ToggleButtonGroup 로 대체    |
| CoachMark / NotificationBadge / SelectBoxGroup / TabsPicker | ❌  |    ✅     |     ❌      | S2 신규, composition 미채택              |
| ContextualHelp                                              | ✅  |    ✅     |     ❌      | composition 미도입                       |
| StepList                                                    | ✅  |    ❌     |     ❌      | 어느 쪽도 안 씀                          |
| LabeledValue                                                | ✅  |    ✅     |     ❌      | composition 미도입                       |

---

## 4. v3 → S2 마이그레이션 맵 (참고)

공식 [Migrating to Spectrum 2](https://react-spectrum.adobe.com/migrating) 기준 주요 변경.

### 4.1 이름 변경 / 구조 재편

| v3                    | S2 대체                                          | 변경 내용                                                  |
| --------------------- | ------------------------------------------------ | ---------------------------------------------------------- |
| Accordion             | **Disclosure / DisclosureGroup**                 | DisclosureTitle/Panel/Header 로 재구성                     |
| ActionGroup           | **ActionButtonGroup** 또는 **ToggleButtonGroup** | 선택 동작 여부로 분기                                      |
| ActionBarContainer    | (제거)                                           | `TableView`/`CardView` 의 `renderActionBar` prop 으로 흡수 |
| ContextualHelpTrigger | **UnavailableMenuItemTrigger**                   |                                                            |
| TabPanels (wrapper)   | (제거)                                           | `TabPanel` 직접 사용                                       |

### 4.2 레이아웃 컴포넌트 제거 (style macro 로 대체)

| v3 전용 (제거됨) | S2 대체 방식                                     |
| ---------------- | ------------------------------------------------ |
| Flex             | `<div className={style({display:'flex', ...})}>` |
| Grid             | `<div className={style({display:'grid', ...})}>` |
| View             | `<div className={style({...})}>`                 |
| Well             | `<div className={style({...})}>`                 |

### 4.3 S2 신규 컴포넌트

CardView, SegmentedControl, AvatarGroup, CoachMark, NotificationBadge, Skeleton/SkeletonCollection, SelectBoxGroup, Toolbar, TabsPicker, FullscreenDialog/CustomDialog, ClearButton/CloseButton, ImageCoordinator, Field/Content/CenterBaseline.

### 4.4 S2 미완성 prop (2026-06 기준)

`icon`(TextField/TextArea/SearchField), `orientation`/`getValueLabel`(Slider/RangeSlider), `density`/DnD(ListView), `type="tray"`(DialogTrigger), `isDisabled`(Avatar), `showRoot`/`isMultiline`(Breadcrumbs), `labelPosition`/`showValueLabel`(ProgressBar) 등.

---

## 5. 핵심 정리

1. **v3 vs S2 의 본질은 스타일링 방식**: v3 = Spectrum 1 + 런타임 theme/prop, S2 = Spectrum 2 + 빌드타임 style macro. S2 가 신규 세대이며 RAC 위에 Spectrum 2 스타일을 얹은 구조.
2. **컴포넌트 커버리지는 S2 가 더 넓음** (신규 ~13종 추가). 다만 일부 prop 은 S2 가 아직 미완성.
3. **레이아웃 철학 전환**: v3 의 Flex/Grid/View/Well 컴포넌트가 S2 에서 사라지고 style macro div 로 대체 — v3→S2 의 가장 큰 구조적 차이.
4. **composition 의 채택 전략**:
   - v3 레이아웃 컴포넌트(Flex/Grid/View/Well)·액션 계열(ActionButton/ActionGroup) → **버림**
   - S2 신규(AvatarGroup/CardView/Skeleton/Toolbar/Disclosure 재편) → **선별 채택**
   - 빌더 전용 확장(Frame/Slot/Pagination/Nav + 텍스트 leaf 세분화) → **자체 도입**
5. 전반적으로 composition 은 **"RAC(D1) 골격 + S2 디자인 방향(D3) + 빌더 전용 확장"** 의 하이브리드.

---

## 6. sub-part 단위 상세표 (composition 122 키 전수)

> §3 의 비교표는 top-level 단위로 묶은 것이고, 본 섹션은 composition catalog 의 **122 키 전체**(top-level + sub-part)를 부모-자식 트리로 펼친 것이다.
> 부모-자식 관계는 catalog 의 명시 필드가 아니라 **factory definitions**(`apps/builder/src/builder/factories/definitions/*.ts`)의 자식 자동 생성 코드 + 명명 규약으로 실측 추출.
> v3/S2 열은 해당 라이브러리가 그 sub-part 를 **독립 컴포넌트로 export 하는지** 기준 (✅ export / 〜 prop·내부구현으로 흡수 / ❌ 없음).

### 6.1 Forms & Inputs

| top-level     | composition sub-part                       | v3  |    S2    | 비고                                |
| ------------- | ------------------------------------------ | :-: | :------: | ----------------------------------- |
| TextField     | Label, Input, FieldError                   | 〜  |    〜    | v3/S2 는 단일 컴포넌트에 흡수       |
| TextArea      | Label, Input, FieldError                   | 〜  |    〜    |                                     |
| NumberField   | Label, Input, FieldError                   | 〜  |    〜    |                                     |
| SearchField   | Label, Input, FieldError                   | 〜  |    〜    |                                     |
| ColorField    | Label, Input, FieldError                   | 〜  |    〜    |                                     |
| Form          | FormField, Field, Label, FieldError        | 〜  | ✅ Field | composition 은 FormField/Field 분리 |
| Slider        | **SliderTrack, SliderThumb, SliderOutput** | ✅  |    ✅    | RAC sub-part 노출 (3자 공통)        |
| Checkbox      | (leaf)                                     | ✅  |    ✅    |                                     |
| CheckboxGroup | Checkbox, Label                            | ✅  |    ✅    |                                     |
| Radio         | (leaf)                                     | ✅  |    ✅    |                                     |
| RadioGroup    | Radio, Label                               | ✅  |    ✅    |                                     |
| Switch        | (leaf)                                     | ✅  |    ✅    |                                     |

### 6.2 Buttons & Toggle

| top-level         | composition sub-part | v3  | S2  | 비고 |
| ----------------- | -------------------- | :-: | :-: | ---- |
| Button            | (leaf)               | ✅  | ✅  |      |
| ButtonGroup       | Button               | ✅  | 〜  |      |
| ToggleButton      | (leaf)               | ✅  | ✅  |      |
| ToggleButtonGroup | ToggleButton         | ✅  | ✅  |      |

### 6.3 Selection & Collection

| top-level          | composition sub-part                              | v3  |      S2      | 비고                         |
| ------------------ | ------------------------------------------------- | :-: | :----------: | ---------------------------- |
| Select (v3=Picker) | **SelectTrigger, SelectValue, SelectIcon**, Label | 〜  |      〜      | composition 은 trigger 3분할 |
| ComboBox           | Input, Label, ListBox                             | 〜  |      〜      |                              |
| ListBox            | **ListBoxItem**                                   | ✅  |      ✅      | item RAC 노출                |
| GridList           | **GridListItem**                                  | ✅  |      ✅      |                              |
| Menu               | **MenuItem**                                      | ✅  |      ✅      |                              |
| TagGroup           | **TagList, Tag**, Label                           | ✅  |      ✅      | composition 에 TagList 분리  |
| Tree               | **TreeItem**                                      | ✅  | ✅(TreeView) |                              |
| Breadcrumbs        | **Breadcrumb**                                    | ✅  |      ✅      |                              |

### 6.4 Table (가장 깊은 sub-part 트리)

| top-level       | composition sub-part                                    | v3  | S2  | 비고                                              |
| --------------- | ------------------------------------------------------- | :-: | :-: | ------------------------------------------------- |
| Table           | **TableHeader, TableBody, TableRow, TableCell, Column** | ✅  | ✅  | RAC Table 계열                                    |
| TableView       | TableHeader, Column, TableBody, Row, Cell               | 〜  | ✅  | S2 전용 styled 변형                               |
| (공통 cell/row) | Row, Cell, Column                                       | ✅  | ✅  | composition 에 Row/Cell + TableRow/TableCell 양립 |

### 6.5 Date & Time

| top-level       | composition sub-part                                  | v3  | S2  | 비고                  |
| --------------- | ----------------------------------------------------- | :-: | :-: | --------------------- |
| DateField       | **DateInput**, Label, FieldError                      | 〜  | 〜  | DateInput RAC 노출    |
| TimeField       | DateInput, Label, FieldError                          | 〜  | 〜  |                       |
| DatePicker      | SelectTrigger, SelectIcon, DateInput, Calendar, Label | 〜  | 〜  | trigger+calendar 조합 |
| DateRangePicker | DateField, Calendar 계열                              | 〜  | 〜  |                       |
| Calendar        | **CalendarGrid, CalendarHeader**                      | ✅  | ✅  | RAC sub-part          |
| RangeCalendar   | CalendarGrid, CalendarHeader                          | ✅  | ✅  |                       |

### 6.6 Color

| top-level                            | composition sub-part                            | v3  | S2  | 비고                        |
| ------------------------------------ | ----------------------------------------------- | :-: | :-: | --------------------------- |
| ColorPicker                          | ColorArea, ColorSlider, ColorSwatch, ColorField | ✅  | ✅  | composition 풀세트          |
| ColorSwatchPicker                    | **ColorSwatch, TailSwatch**                     | ✅  | ✅  | TailSwatch=composition 고유 |
| ColorArea / ColorSlider / ColorWheel | (leaf)                                          | ✅  | ✅  |                             |

### 6.7 Display & Feedback

| top-level           | composition sub-part                   | v3  | S2  | 비고                                 |
| ------------------- | -------------------------------------- | :-: | :-: | ------------------------------------ |
| ProgressBar         | **ProgressBarTrack, ProgressBarValue** | 〜  | 〜  | composition 은 track/value 분리 노출 |
| Meter               | **MeterTrack, MeterValue**             | 〜  | 〜  | 동일 패턴                            |
| ProgressCircle      | (leaf)                                 | ✅  | ✅  |                                      |
| Avatar              | (leaf)                                 | ✅  | ✅  |                                      |
| AvatarGroup         | Avatar                                 | ❌  | ✅  | S2 신규                              |
| Badge / StatusLight | (leaf)                                 | ✅  | ✅  |                                      |
| InlineAlert         | Heading, Description                   | ✅  | ✅  | composition 에 내부 텍스트 leaf      |
| IllustratedMessage  | Heading, Description, Image            | ✅  | ✅  |                                      |
| Image / Icon        | (leaf)                                 | ✅  | ✅  |                                      |
| Toast               | Heading, Description                   | ✅  | ✅  |                                      |
| Skeleton            | (leaf)                                 | ❌  | ✅  | S2 신규                              |

### 6.8 Card

| top-level | composition sub-part                                 | v3  | S2  | 비고                       |
| --------- | ---------------------------------------------------- | :-: | :-: | -------------------------- |
| Card      | **CardHeader, CardContent, CardFooter, CardPreview** | 〜  | 〜  | composition 4분할 sub-part |
| CardView  | Card                                                 | ❌  | ✅  | S2 신규 컬렉션             |

### 6.9 Tabs / Disclosure

| top-level       | composition sub-part                  |       v3       | S2  | 비고                                              |
| --------------- | ------------------------------------- | :------------: | :-: | ------------------------------------------------- |
| Tabs            | **TabList, Tab, TabPanels, TabPanel** |       ✅       | ✅  | S2 는 TabPanels wrapper 제거, composition 은 보존 |
| Disclosure      | DisclosureHeader, DisclosureContent   | (v3=Accordion) | ✅  | composition=S2 구조                               |
| DisclosureGroup | Disclosure                            |       ❌       | ✅  |                                                   |

### 6.10 Overlay

| top-level | composition sub-part                   | v3  | S2  | 비고                              |
| --------- | -------------------------------------- | :-: | :-: | --------------------------------- |
| Dialog    | Heading, Description, **DialogFooter** | ✅  | ✅  | DialogFooter=composition sub-part |
| Modal     | (shell)                                | 〜  | ✅  |                                   |
| Popover   | (shell)                                | ✅  | ✅  |                                   |
| Tooltip   | (leaf)                                 | ✅  | ✅  |                                   |

### 6.11 Layout & Text (composition 고유 비중 높음)

| top-level                                | composition sub-part | v3  |      S2      | 비고                                     |
| ---------------------------------------- | -------------------- | :-: | :----------: | ---------------------------------------- |
| **Frame**                                | (자유 컨테이너)      | ❌  |      ❌      | composition canonical 레이아웃 (ADR-130) |
| **Slot**                                 | (projection)         | ❌  |      ❌      | Frame projection (ADR-135)               |
| Group                                    | (ARIA group)         | ✅  |      〜      | D1 ARIA 전용                             |
| **Nav / Pagination**                     | Link, Button         | ❌  |      ❌      | composition 자체                         |
| Header / Section / Separator             | (leaf)               | 〜  |      〜      | 시맨틱 컨테이너 leaf                     |
| Heading / Paragraph / Text / Description | (leaf)               | 〜  |      〜      | composition 텍스트 leaf 세분화           |
| **Code / Kbd**                           | (leaf)               | ❌  |      ❌      | composition 인라인 텍스트                |
| Link                                     | (leaf)               | ✅  |      ✅      |                                          |
| Label                                    | (leaf)               | ✅  |      〜      |                                          |
| DropZone / FileTrigger                   | (leaf)               | ✅  | ✅(DropZone) | FileTrigger=RAC 직접                     |

### 6.12 composition 고유 sub-part 요약 (v3/S2 양쪽 없음)

명시적으로 composition 만 별도 키로 가진 sub-part / 컴포넌트:

- **Frame, Slot** — 빌더 레이아웃·projection 전용
- **Nav, Pagination** — 네비게이션 전용
- **Code, Kbd** — 인라인 텍스트 leaf
- **TailSwatch** — ColorSwatchPicker 의 "추가" swatch
- **FormField** — Form 내부 필드 래퍼 (v3/S2 는 Field 만)
- **SelectTrigger / SelectValue / SelectIcon** 3분할 — v3/S2 는 Select(Picker) 단일 흡수
- **ProgressBarTrack/Value, MeterTrack/Value** 분리 — v3/S2 는 prop 으로 흡수
- **Card 4-sub-part (Header/Content/Footer/Preview)** — v3/S2 는 자유 children

> **합계**: catalog 122 키 = top-level ~55 + sub-part ~67. sub-part 의 상당수는 RAC 가 이미 노출하는 표준 sub-part(SliderTrack/ListBoxItem/CalendarGrid 등)이고, 나머지는 composition 이 빌더 편집 단위로 쪼갠 고유 sub-part(SelectTrigger 3분할/ProgressBar track·value/Card 4분할 등)다.

---

## 출처

- [Migrating to Spectrum 2 | React Spectrum](https://react-spectrum.adobe.com/migrating)
- [adobe/react-spectrum — `@react-spectrum/s2/src` (GitHub)](https://github.com/adobe/react-spectrum/tree/main/packages/%40react-spectrum/s2/src)
- [adobe/react-spectrum (GitHub)](https://github.com/adobe/react-spectrum)
- [S2 Style Macro System | DeepWiki](https://deepwiki.com/adobe/react-spectrum/10.2-s2-style-macro-system)
- composition catalog: `packages/shared/src/catalog/generated/componentRulesTable.ts` (121 키)
- composition spec 잔존: `packages/specs/src/components/` (Frame/Group/Slot)
