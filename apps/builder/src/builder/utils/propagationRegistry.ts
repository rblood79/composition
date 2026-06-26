/**
 * ADR-048: Propagation Registry
 *
 * Spec의 propagation 규칙을 정방향/역방향 인덱스로 관리한다.
 * lazy 초기화 — 첫 호출 시 1회만 빌드.
 * 모든 키는 소문자로 정규화.
 */
import type { ComponentSpec, PropagationRule } from "@composition/specs";
// ADR-912 단계5 step4: 아래 컴포넌트들은 모두 catalog cutover spec 삭제로 @composition/specs 의
//   named Spec import 가 전부 제거됨 (전부 createPropagationOnlySpec 인라인 이관). value import 0건이라
//   import 구문 자체 제거 — 이력은 아래 주석으로 보존.
// ADR-912 단계5 step4 date-color (2026-06-17): DatePicker/DateRangePickerSpec import 제거 —
//   DatePicker.spec/DateRangePicker.spec 물리 삭제(catalog cutover). propagation.rules(15+25건,
//   Calendar/RangeCalendar 서브트리)는 createPropagationOnlySpec 인라인 이관(아래). Tabs(6d907be54) 동일 패턴.
// ADR-912 단계5 step4 (2026-06-17): SelectSpec/ComboBoxSpec import 제거 — catalog cutover spec 삭제.
//   propagation.rules(size/label/placeholder → SelectTrigger/SelectValue/SelectIcon/Label)는
//   select/comboBoxPropagationSpec(createPropagationOnlySpec 인라인)로 이관(아래). placeholder childProp
//   이 Select=children / ComboBox=placeholder 로 달라 별도 spec 필수(동형 아님).
// Phase 2: 기존 delegation 컴포넌트
// ADR-912 단계5 step4 small-B (2026-06-16): SearchField/CheckboxGroup/RadioGroup/TextField/TextArea/NumberField/TimeField/ColorField Spec import 제거 — catalog cutover, propagation.rules 는 createPropagationOnlySpec 인라인 이관(Card 선례).
// ADR-912 단계5 step4 toggle-indicator 그룹 (2026-06-16): Checkbox/Radio/Switch Spec import 제거 —
//   catalog cutover, propagation.rules(size/children → Label)는 createPropagationOnlySpec 인라인 이관.
// ADR-912 단계5 step4 (2026-06-17): TagGroupSpec import 제거 — catalog cutover spec 삭제,
//   propagation.rules 11건은 tagGroupPropagationSpec(createPropagationOnlySpec 인라인)로 이관.
// ADR-912 단계5 step4 (2026-06-17): DateFieldSpec import 제거 — DateField.spec 물리 삭제(catalog cutover).
//   propagation.rules 3건(size → Label/DateInput, label → Label children)은 dateFieldPropagationSpec
//   (createPropagationOnlySpec 인라인)로 이관(아래). TimeField(timeFieldPropagationSpec) 동형 형제.
// ADR-912 단계5 step4 (2026-06-17): SliderSpec import 제거 — Slider.spec 물리 삭제(catalog cutover).
//   propagation.rules 8건(size → SliderTrack/SliderOutput/[SliderTrack,SliderThumb]/Label, label →
//   Label children, value/minValue/maxValue → SliderTrack)은 sliderPropagationSpec(createPropagationOnlySpec
//   인라인)로 이관(아래). 손자 childPath 는 배열 ["SliderTrack","SliderThumb"] 보존(string 은 직계만 매칭=DEAD).
// ADR-912 단계5 step4 경량 이관 (2026-06-17): ProgressBarSpec/MeterSpec import 제거 — catalog cutover spec 삭제.
//   propagation.rules(label/size → Label/Track/Value)는 createPropagationOnlySpec 인라인 이관(아래).
// ADR-912 단계5 step4 date-color (2026-06-16): Calendar/RangeCalendarSpec import 제거 —
//   catalog cutover spec 삭제. propagation.rules(variant/size/locale/calendarSystem/defaultToday →
//   CalendarHeader/CalendarGrid)는 createPropagationOnlySpec 인라인 이관(아래).
// ADR-912 단계5 step4 경량 이관 (2026-06-17): GridListSpec import 제거 — catalog cutover spec 삭제.
//   propagation.rules(variant → GridListItem)는 createPropagationOnlySpec 인라인 이관(아래).
// ADR-912 단계5 step4 (2026-06-17): ListBoxSpec import 제거 — ListBox.spec 물리 삭제(catalog cutover).
//   ListBox.spec 은 propagation.rules 부재(정적 모드 shapes 가 부모 variant 직접 참조, ListBox.spec:352)
//   → 기존 registerPropagationSpec("ListBox", ListBoxSpec) 은 no-op → 빈 propagation-only spec 으로 대체.
// ADR-912 단계5 step4 type-augment 그룹 (2026-06-16): ToggleButtonGroupSpec import 제거 —
//   catalog cutover, propagation.rules(isEmphasized/size → ToggleButton)는 createPropagationOnlySpec 인라인 이관.
// ADR-912 단계5 step4 (2026-06-17): TabsSpec import 제거 — Tabs.spec 물리 삭제(catalog cutover).
//   propagation.rules 7건(items/selectedKey/defaultSelectedKey/showIndicator/variant/size/orientation
//   → TabList)은 createPropagationOnlySpec 인라인 이관(아래). Breadcrumbs(a736fedb5) 동일 패턴.

// ─── Collection Item propagation rules ──────────────────────────────────────
// 독립 Spec 파일이 없는 컴포넌트의 label/description → 자식 전파 전용.
// ADR-914 Phase 5 후속 (2026-06-21): shadow ComponentSpec wrapper 제거 — rule 배열 직접
//   등록 (`registerPropagationRules`). GridListItem/ListBoxItem 둘 다 동일 rule (name 무관)
//   이라 함수 대신 단일 상수로 공유.
const collectionItemPropagationRules: PropagationRule[] = [
  {
    parentProp: "label",
    childPath: "Text",
    childProp: "children",
    override: true,
  },
  {
    parentProp: "description",
    childPath: "Description",
    childProp: "children",
    override: true,
  },
];

// ADR-914 Phase 5 후속 (2026-06-21): `createPropagationOnlySpec` shadow ComponentSpec
//   wrapper 정의 제거 — 모든 propagation 등록이 `registerPropagationRules(type, rules)`
//   (rule 배열 직접) 로 전환됨. 구 wrapper 의 propagation 규칙(자식 style 주입 ADR-095 등)은
//   각 `xxxPropagationRules: PropagationRule[]` 상수로 보존 (rule 배열은 byte-identical,
//   §3.3-5 / Phase 5 fixture 가 rule-only ⟺ shadow spec 동치 검증).

// ADR-912 R6 (2026-06-15): Card 본체 catalog cutover → Card.spec 삭제. 구 Card.spec.propagation
//   .rules 5건(ADR-092 HC#7 title/description + HC#4 size×3)을 propagation-only 인라인 spec 으로
//   보존 — catalog 는 propagation 표현 수단 없음(ComponentRule/PrimitiveBinding 에 parentProp 필드
//   부재). title → CardHeader.Heading.children / description → CardContent.Description.children
//   (중첩 childPath) / size → CardHeader·CardContent·CardFooter. CardHeader/CardContent
//   propagation-only spec(자식 style 주입)과 동형 — 본체는 content/size 전파 담당.
const cardPropagationRules: PropagationRule[] = [
  {
    parentProp: "title",
    childPath: ["CardHeader", "Heading"],
    childProp: "children",
    override: true,
  },
  {
    parentProp: "description",
    childPath: ["CardContent", "Description"],
    childProp: "children",
    override: true,
  },
  { parentProp: "size", childPath: "CardHeader", override: true },
  { parentProp: "size", childPath: "CardContent", override: true },
  { parentProp: "size", childPath: "CardFooter", override: true },
];

const cardHeaderPropagationRules: PropagationRule[] = [
  {
    childPath: "Heading",
    childProp: "flex",
    asStyle: true,
    styleValue: 1,
    skipIfSet: ["flex", "flexGrow", "width"],
  },
];

const cardContentPropagationRules: PropagationRule[] = [
  {
    childPath: "Description",
    childProp: "width",
    asStyle: true,
    styleValue: "100%",
    skipIfSet: ["width", "flex"],
  },
];

// ADR-912 단계5 step4 경량 이관 (2026-06-17): GridList.spec 삭제 — propagation.rules 인라인 보존.
//   variant → GridListItem 전파(카드 accent 색). childPath string 이라 spec 객체 의존 0.
const gridListPropagationRules: PropagationRule[] = [
  { parentProp: "variant", childPath: "GridListItem", override: true },
];
// ADR-912 단계5 step4 (2026-06-17): ListBox.spec 물리 삭제 → 빈 propagation-only spec. 구
//   ListBox.spec 은 propagation.rules 부재(ADR-076: 정적 shapes 가 부모 variant 직접 참조)라
//   registerPropagationSpec("ListBox", ListBoxSpec) 가 이미 no-op 이었음 → rules [] 로 동일 보존.
const listBoxPropagationRules: PropagationRule[] = [];

// ADR-912 단계5 step4 경량 이관 (2026-06-17): ProgressBar.spec 삭제 — propagation.rules 인라인 보존.
//   label → Label.children + size → ProgressBarTrack/ProgressBarValue/Label. childPath string 이라 spec 의존 0.
const progressBarPropagationRules: PropagationRule[] = [
  {
    parentProp: "label",
    childPath: "Label",
    childProp: "children",
    override: true,
  },
  { parentProp: "size", childPath: "ProgressBarTrack", override: true },
  { parentProp: "size", childPath: "ProgressBarValue", override: true },
  { parentProp: "size", childPath: "Label", override: true },
];

// ADR-912 단계5 step4 경량 이관 (2026-06-17): Meter.spec 삭제 — propagation.rules 인라인 보존.
//   label → Label.children + size → MeterTrack/MeterValue/Label. childPath string 이라 spec 의존 0.
const meterPropagationRules: PropagationRule[] = [
  {
    parentProp: "label",
    childPath: "Label",
    childProp: "children",
    override: true,
  },
  { parentProp: "size", childPath: "MeterTrack", override: true },
  { parentProp: "size", childPath: "MeterValue", override: true },
  { parentProp: "size", childPath: "Label", override: true },
];

// ADR-912 단계5 step4 (2026-06-17): Slider.spec 물리 삭제 — propagation.rules 8건 인라인 보존.
//   Slider.spec.ts:176-197 verbatim. rule #3 childPath 는 손자(Slider → SliderTrack → SliderThumb)라
//   배열 ["SliderTrack","SliderThumb"] 필수(string 은 직계 자식만 매칭 → DEAD). prop 명은 정확히
//   value/minValue/maxValue (min/max 아님).
const sliderPropagationRules: PropagationRule[] = [
  { parentProp: "size", childPath: "SliderTrack", override: true },
  { parentProp: "size", childPath: "SliderOutput", override: true },
  {
    parentProp: "size",
    childPath: ["SliderTrack", "SliderThumb"],
    override: true,
  },
  { parentProp: "size", childPath: "Label", override: true },
  {
    parentProp: "label",
    childPath: "Label",
    childProp: "children",
    override: true,
  },
  { parentProp: "value", childPath: "SliderTrack", override: true },
  { parentProp: "minValue", childPath: "SliderTrack", override: true },
  { parentProp: "maxValue", childPath: "SliderTrack", override: true },
];

// ADR-912 단계5 step4 small-B (2026-06-16): TextField.spec 삭제 — propagation.rules 인라인 보존.
const textFieldPropagationRules: PropagationRule[] = [
  { parentProp: "size", childPath: "Label", override: true },
  { parentProp: "size", childPath: "Input", override: true },
  {
    parentProp: "label",
    childPath: "Label",
    childProp: "children",
    override: true,
  },
  {
    parentProp: "placeholder",
    childPath: "Input",
    childProp: "placeholder",
    override: true,
  },
];

// ADR-912 단계5 step4 small-B (2026-06-16): SearchField.spec 삭제 — propagation.rules 인라인 보존.
const searchFieldPropagationRules: PropagationRule[] = [
  { parentProp: "size", childPath: "SelectTrigger", override: true },
  { parentProp: "size", childPath: "SelectValue", override: true },
  { parentProp: "size", childPath: "SelectIcon", override: true },
  { parentProp: "size", childPath: "Label", override: true },
  {
    parentProp: "label",
    childPath: "Label",
    childProp: "children",
    override: true,
  },
  {
    parentProp: "placeholder",
    childPath: ["SelectTrigger", "SelectValue"],
    childProp: "placeholder",
    override: true,
  },
];

// ADR-912 단계5 step4 small-B (2026-06-16): TextArea.spec 삭제 — propagation.rules 인라인 보존.
const textAreaPropagationRules: PropagationRule[] = [
  { parentProp: "size", childPath: "Label", override: true },
];

// ADR-912 단계5 step4 small-B (2026-06-16): NumberField.spec 삭제 — propagation.rules 인라인 보존.
const numberFieldPropagationRules: PropagationRule[] = [
  { parentProp: "size", childPath: "Label", override: true },
  { parentProp: "size", childPath: "SelectTrigger", override: true },
  {
    parentProp: "label",
    childPath: "Label",
    childProp: "children",
    override: true,
  },
  {
    parentProp: "placeholder",
    childPath: ["SelectTrigger", "SelectValue"],
    childProp: "placeholder",
    override: true,
  },
];

// ADR-912 단계5 step4 (2026-06-17): DateField.spec 삭제 — propagation.rules 인라인 보존 (TimeField 동형).
const dateFieldPropagationRules: PropagationRule[] = [
  { parentProp: "size", childPath: "Label", override: true },
  { parentProp: "size", childPath: "DateInput", override: true },
  {
    parentProp: "label",
    childPath: "Label",
    childProp: "children",
    override: true,
  },
];

// ADR-912 단계5 step4 small-B (2026-06-16): TimeField.spec 삭제 — propagation.rules 인라인 보존.
const timeFieldPropagationRules: PropagationRule[] = [
  { parentProp: "size", childPath: "Label", override: true },
  { parentProp: "size", childPath: "DateInput", override: true },
  {
    parentProp: "label",
    childPath: "Label",
    childProp: "children",
    override: true,
  },
];

// ADR-912 단계5 step4 small-B (2026-06-16): ColorField.spec 삭제 — propagation.rules 인라인 보존.
const colorFieldPropagationRules: PropagationRule[] = [
  { parentProp: "size", childPath: "Label", override: true },
];

// ADR-912 단계5 step4 small-B (2026-06-16): CheckboxGroup.spec 삭제 — propagation.rules 인라인 보존.
const checkboxGroupPropagationRules: PropagationRule[] = [
  { parentProp: "size", childPath: ["Checkbox"], override: true },
  { parentProp: "size", childPath: ["Checkbox", "Label"], override: true },
  { parentProp: "size", childPath: "Label", override: true },
];

// ADR-912 단계5 step4 small-B (2026-06-16): RadioGroup.spec 삭제 — propagation.rules 인라인 보존.
const radioGroupPropagationRules: PropagationRule[] = [
  { parentProp: "size", childPath: ["Radio"], override: true },
  { parentProp: "size", childPath: ["Radio", "Label"], override: true },
  { parentProp: "size", childPath: "Label", override: true },
];

// ADR-912 단계5 step4 type-augment 그룹 (2026-06-16): ToggleButtonGroup.spec 삭제 —
//   propagation.rules(ADR-048/059 B5: isEmphasized/size → ToggleButton, RadioGroup/CheckboxGroup 동형
//   override:true) 인라인 보존.
const toggleButtonGroupPropagationRules: PropagationRule[] = [
  { parentProp: "isEmphasized", childPath: "ToggleButton", override: true },
  { parentProp: "size", childPath: "ToggleButton", override: true },
];

// icon Button label = RSP 공식 `<Button><Icon/><Text>label</Text></Button>` 의 `<Text>` 자식
//   element(ButtonChildSection 이 생성). Button.size 변경 시 자식 Text.size 도 같이 변경되어야
//   부모-자식 글자 크기가 일관(사용자 요청 2026-06-27). Button/Text size 범위는 둘 다 xs~xl 포함
//   (Text 는 2xl/3xl 추가 보유, Button 범위 안에 항상 들어감) → 무손실 전파. ToggleButtonGroup →
//   ToggleButton(size override:true) 동형. childProp 생략 → buildPropagationUpdates 가 parentProp
//   (size)을 자식 prop 명으로 사용(propagationEngine.ts:146). 생성 시점 초기 size 는 전파 rule 이
//   *변경* 시점에만 작동하므로 ButtonChildSection.buildButtonChild 에서 부모 size 를 직접 주입.
const buttonPropagationRules: PropagationRule[] = [
  { parentProp: "size", childPath: "Text", override: true },
];

// ADR-912 단계5 step4 (2026-06-17): Tabs.spec 물리 삭제 → propagation.rules 7건 인라인 보존.
//   chip projection(appendTabRowProjection)이 owner=TabList scene node 에 붙고,
//   resolveDataBoundTabProjection 이 TabList.props.items 를 읽어 tab-row 노드 전개하므로
//   items/selectedKey/defaultSelectedKey/showIndicator/variant/size/orientation 을 TabList 로 전파.
//   selectedKey 는 단일 선택(Tab) — TagList 의 selectedKeys(복수)와 prop 명칭 다름.
//   catalog 는 propagation 표현 수단 없음(ComponentRule/PrimitiveBinding 에 parentProp 부재) →
//   시각/CSS 는 STRUCTURE_META virtual 이 담당하고 이 propagation 만 builder runtime 에서 유지.
const tabsPropagationRules: PropagationRule[] = [
  { parentProp: "items", childPath: "TabList", override: true },
  { parentProp: "selectedKey", childPath: "TabList", override: true },
  { parentProp: "defaultSelectedKey", childPath: "TabList", override: true },
  { parentProp: "showIndicator", childPath: "TabList", override: true },
  { parentProp: "variant", childPath: "TabList", override: true },
  { parentProp: "size", childPath: "TabList", override: true },
  { parentProp: "orientation", childPath: "TabList", override: true },
];

// ADR-912 단계5 step4 toggle-indicator 그룹 (2026-06-16): Switch/Checkbox/Radio.spec 삭제 —
//   propagation.rules(size → Label / children → Label.children) 인라인 보존. 시각은 catalog rule +
//   generate-css virtual 이 담당, builder runtime 의 자식 Label 전파만 여기서 유지.
// ADR-914 Phase 5 (2026-06-21): Switch = proof family. shadow ComponentSpec wrapper
//   (createPropagationOnlySpec) 제거 → rule 배열만 보유, registerPropagationRules 로 직접 등록.
//   Checkbox/Radio 등 나머지 27 family 의 wrapper 제거는 후속 slice (R7: 한 phase 한 family).
const switchPropagationRules: PropagationRule[] = [
  { parentProp: "size", childPath: "Label", override: true },
  {
    parentProp: "children",
    childPath: "Label",
    childProp: "children",
    override: true,
  },
];

const checkboxPropagationRules: PropagationRule[] = [
  { parentProp: "size", childPath: "Label", override: true },
  {
    parentProp: "children",
    childPath: "Label",
    childProp: "children",
    override: true,
  },
];

const radioPropagationRules: PropagationRule[] = [
  { parentProp: "size", childPath: "Label", override: true },
  {
    parentProp: "children",
    childPath: "Label",
    childProp: "children",
    override: true,
  },
];

// ADR-912 단계5 step4 date-color (2026-06-16): Calendar.spec 삭제 → propagation.rules 9건
//   (variant/size/locale/calendarSystem → CalendarHeader+CalendarGrid + defaultToday → CalendarGrid)을
//   propagation-only 인라인 spec 으로 보존. catalog 는 propagation 표현 수단 없음(ComponentRule/
//   PrimitiveBinding 에 parentProp 부재). 시각/CSS 는 STRUCTURE_META virtual override 가 담당.
const calendarPropagationRules: PropagationRule[] = [
  { parentProp: "variant", childPath: "CalendarHeader" },
  { parentProp: "variant", childPath: "CalendarGrid" },
  { parentProp: "size", childPath: "CalendarHeader", override: true },
  { parentProp: "size", childPath: "CalendarGrid", override: true },
  { parentProp: "locale", childPath: "CalendarHeader" },
  { parentProp: "locale", childPath: "CalendarGrid" },
  { parentProp: "calendarSystem", childPath: "CalendarHeader" },
  { parentProp: "calendarSystem", childPath: "CalendarGrid" },
  { parentProp: "defaultToday", childPath: "CalendarGrid" },
];

// ADR-912 단계5 step4 date-color (2026-06-16): RangeCalendar.spec(=...CalendarSpec spread) 삭제 →
//   propagation.rules 8건(Calendar 와 동일하나 defaultToday 제외). 시각/CSS 는 STRUCTURE_META virtual.
const rangeCalendarPropagationRules: PropagationRule[] = [
  { parentProp: "variant", childPath: "CalendarHeader" },
  { parentProp: "variant", childPath: "CalendarGrid" },
  { parentProp: "size", childPath: "CalendarHeader", override: true },
  { parentProp: "size", childPath: "CalendarGrid", override: true },
  { parentProp: "locale", childPath: "CalendarHeader" },
  { parentProp: "locale", childPath: "CalendarGrid" },
  { parentProp: "calendarSystem", childPath: "CalendarHeader" },
  { parentProp: "calendarSystem", childPath: "CalendarGrid" },
];

// ADR-912 단계5 step4 date-color (2026-06-17): DatePicker.spec 삭제 → propagation.rules 15건
//   (label/granularity/size/maxVisibleMonths/locale/calendarSystem/defaultToday → Calendar 서브트리)
//   propagation-only 인라인 spec 으로 보존. 시각/CSS 는 STRUCTURE_META virtual. spec verbatim.
const datePickerPropagationRules: PropagationRule[] = [
  {
    parentProp: "label",
    childPath: "Label",
    childProp: "children",
    override: true,
  },
  {
    parentProp: "granularity",
    childPath: "DateInput",
    childProp: "_granularity",
    override: true,
  },
  { parentProp: "size", childPath: "DateInput", override: true },
  { parentProp: "size", childPath: "Calendar", override: true },
  { parentProp: "size", childPath: "Label", override: true },
  {
    parentProp: "size",
    childPath: ["Calendar", "CalendarHeader"],
    override: true,
  },
  {
    parentProp: "size",
    childPath: ["Calendar", "CalendarGrid"],
    override: true,
  },
  {
    parentProp: "maxVisibleMonths",
    childPath: "Calendar",
    childProp: "maxVisibleMonths",
    override: true,
  },
  { parentProp: "locale", childPath: "Calendar" },
  { parentProp: "locale", childPath: ["Calendar", "CalendarHeader"] },
  { parentProp: "locale", childPath: ["Calendar", "CalendarGrid"] },
  { parentProp: "calendarSystem", childPath: "Calendar" },
  { parentProp: "calendarSystem", childPath: ["Calendar", "CalendarHeader"] },
  { parentProp: "calendarSystem", childPath: ["Calendar", "CalendarGrid"] },
  { parentProp: "defaultToday", childPath: ["Calendar", "CalendarGrid"] },
];

// ADR-912 단계5 step4 date-color (2026-06-17): DateRangePicker.spec 삭제 → propagation.rules 25건
//   (Calendar + RangeCalendar 이중 분기). propagation-only 인라인 spec. spec verbatim.
const dateRangePickerPropagationRules: PropagationRule[] = [
  {
    parentProp: "label",
    childPath: "Label",
    childProp: "children",
    override: true,
  },
  {
    parentProp: "granularity",
    childPath: "DateInput",
    childProp: "_granularity",
    override: true,
  },
  { parentProp: "size", childPath: "DateInput", override: true },
  { parentProp: "size", childPath: "Calendar", override: true },
  { parentProp: "size", childPath: "RangeCalendar", override: true },
  { parentProp: "size", childPath: "Label", override: true },
  {
    parentProp: "size",
    childPath: ["Calendar", "CalendarHeader"],
    override: true,
  },
  {
    parentProp: "size",
    childPath: ["Calendar", "CalendarGrid"],
    override: true,
  },
  {
    parentProp: "size",
    childPath: ["RangeCalendar", "CalendarHeader"],
    override: true,
  },
  {
    parentProp: "size",
    childPath: ["RangeCalendar", "CalendarGrid"],
    override: true,
  },
  {
    parentProp: "maxVisibleMonths",
    childPath: "RangeCalendar",
    childProp: "maxVisibleMonths",
    override: true,
  },
  { parentProp: "locale", childPath: "Calendar" },
  { parentProp: "locale", childPath: ["Calendar", "CalendarHeader"] },
  { parentProp: "locale", childPath: ["Calendar", "CalendarGrid"] },
  { parentProp: "locale", childPath: "RangeCalendar" },
  { parentProp: "locale", childPath: ["RangeCalendar", "CalendarHeader"] },
  { parentProp: "locale", childPath: ["RangeCalendar", "CalendarGrid"] },
  { parentProp: "calendarSystem", childPath: "Calendar" },
  { parentProp: "calendarSystem", childPath: ["Calendar", "CalendarHeader"] },
  { parentProp: "calendarSystem", childPath: ["Calendar", "CalendarGrid"] },
  { parentProp: "calendarSystem", childPath: "RangeCalendar" },
  {
    parentProp: "calendarSystem",
    childPath: ["RangeCalendar", "CalendarHeader"],
  },
  {
    parentProp: "calendarSystem",
    childPath: ["RangeCalendar", "CalendarGrid"],
  },
  { parentProp: "defaultToday", childPath: ["Calendar", "CalendarGrid"] },
  {
    parentProp: "defaultToday",
    childPath: ["RangeCalendar", "CalendarGrid"],
  },
];

// ─── Lazy Index ─────────────────────────────────────────────────────────────

/** 정방향: parentTag(소문자) → PropagationRule[] */
let forwardIndex: Map<string, PropagationRule[]> | null = null;

/** 역방향: childTag(소문자) → Set<parentTag(소문자)> — 직접 자식 규칙만 */
let reverseIndex: Map<string, Set<string>> | null = null;

/** 등록된 모든 spec (registerPropagationSpec으로 추가) */
const specEntries: Array<[string, ComponentSpec<Record<string, unknown>>]> = [];

/**
 * ADR-914 Phase 5: rule-only 등록 (shadow ComponentSpec wrapper 없이).
 *
 * `registerPropagationRules` 로 등록된 [type, rules] tuple. `ensureBuilt` 가
 * `specEntries` 와 함께 순회하여 동일 forwardIndex/reverseIndex 를 빌드한다.
 */
const ruleEntries: Array<[string, PropagationRule[]]> = [];

// ─── Registration ───────────────────────────────────────────────────────────

/**
 * Propagation 규칙이 있는 Spec을 등록한다.
 * 앱 초기화 시 또는 Spec 정의 시점에 호출.
 * 등록 후 인덱스가 이미 빌드된 상태면 재빌드를 예약한다.
 */
export function registerPropagationSpec<P = Record<string, unknown>>(
  type: string,
  spec: ComponentSpec<P>,
): void {
  if (!spec.propagation) return;
  specEntries.push([type, spec as ComponentSpec<Record<string, unknown>>]);
  // 이미 빌드된 인덱스가 있으면 무효화하여 다음 조회 시 재빌드
  if (forwardIndex) {
    forwardIndex = null;
    reverseIndex = null;
  }
}

/**
 * ADR-914 Phase 5: propagation rules 를 shadow ComponentSpec wrapper 없이 직접 등록.
 *
 * `registerPropagationSpec(type, createPropagationOnlySpec(name, rules))` 와 **동일
 * 결과** (forwardIndex/reverseIndex byte-identical) 를 만들되, dummy spec field
 * (element/variants/sizes/states/render) 없이 rule 배열만 등록한다. 모든 consumer 는
 * `getPropagationRules` / `getParentTagsForChild` / `getRegisteredPropagationTags` 3
 * API 만 사용하고 ComponentSpec object 자체를 읽지 않으므로 (registerPropagationSpec 도
 * 내부에서 `spec.propagation.rules` 만 추출), shadow wrapper 는 dead weight 다.
 *
 * Phase 5 proof family (Switch) 가 본 adapter 로 전환됐고, 나머지 27 family 의
 * `createPropagationOnlySpec` 제거는 후속 slice (R7: 한 phase 한 facet 한 family).
 */
export function registerPropagationRules(
  type: string,
  rules: PropagationRule[],
): void {
  ruleEntries.push([type, rules]);
  if (forwardIndex) {
    forwardIndex = null;
    reverseIndex = null;
  }
}

// ─── Index Build ────────────────────────────────────────────────────────────

/**
 * forwardIndex/reverseIndex 에 단일 [type, rules] entry 를 반영한다.
 * specEntries(shadow spec) 와 ruleEntries(rule-only, Phase 5) 가 동일 로직을 공유한다.
 */
function indexEntry(type: string, rules: PropagationRule[]): void {
  const key = type.toLowerCase();
  forwardIndex!.set(key, rules);

  for (const rule of rules) {
    // 역방향 인덱스: childPath가 단일 문자열인 규칙만 포함
    // 중첩 경로(배열)는 Inspector의 buildPropagationUpdates에서만 해석
    if (typeof rule.childPath === "string") {
      const childKey = rule.childPath.toLowerCase();
      let parents = reverseIndex!.get(childKey);
      if (!parents) {
        parents = new Set();
        reverseIndex!.set(childKey, parents);
      }
      parents.add(key);
    }
  }
}

function ensureBuilt(): void {
  if (forwardIndex) return;

  forwardIndex = new Map();
  reverseIndex = new Map();

  for (const [type, spec] of specEntries) {
    if (!spec.propagation) continue;
    indexEntry(type, spec.propagation.rules);
  }
  // ADR-914 Phase 5: rule-only 등록 (shadow spec 없이). 동일 인덱스 로직.
  for (const [type, rules] of ruleEntries) {
    indexEntry(type, rules);
  }
}

// ─── Public API ─────────────────────────────────────────────────────────────

/** 정방향: parentTag → PropagationRule[] */
export function getPropagationRules(
  parentTag: string,
): PropagationRule[] | undefined {
  ensureBuilt();
  return forwardIndex!.get(parentTag.toLowerCase());
}

/** 역방향: childTag → Set<parentTag> (ElementSprite 역탐색용) */
export function getParentTagsForChild(
  childTag: string,
): Set<string> | undefined {
  ensureBuilt();
  return reverseIndex!.get(childTag.toLowerCase());
}

/**
 * ADR-914 Phase 1: 등록된 모든 propagation parent tag 를 enumerate.
 *
 * `entryUniverseContract` 가 entry propagation facet 과 registered rule set 의
 * extra/missing 정합을 검증하는 read-only 진입점. forwardIndex key 는 lowercase
 * parentTag (`registerPropagationSpec` 등록 시 정규화) 이므로 lowercase set 을
 * 반환한다. no-op (rules:[]) 등록도 forwardIndex 에 entry 가 있으므로 포함된다.
 */
export function getRegisteredPropagationTags(): ReadonlySet<string> {
  ensureBuilt();
  return new Set(forwardIndex!.keys());
}

/** 테스트용: 인덱스 초기화 */
export function _resetPropagationRegistry(): void {
  forwardIndex = null;
  reverseIndex = null;
  specEntries.length = 0;
  ruleEntries.length = 0; // ADR-914 Phase 5: rule-only 등록도 초기화
}

// ADR-912 단계5 step4 (2026-06-17): TagGroup.spec.propagation.rules 11건 인라인 이관 —
//   catalog cutover spec 삭제(Card/SearchField 선례). childPath 가 모두 string(spec 객체 미참조)
//   이라 분리 무손실. size/allowsRemoving → Tag/TagList, label → Label.children, size → Label,
//   items/variant/maxRows/selectedKeys/selectionMode → TagList(chip projection 좌표계 전파).
//   override:true 필수 — allowsRemoving 토글 시 부모 최신값 덮어쓰기(자식 stale true 방지).
const tagGroupPropagationRules: PropagationRule[] = [
  { parentProp: "size", childPath: "Tag", override: true },
  { parentProp: "size", childPath: "TagList", override: true },
  { parentProp: "allowsRemoving", childPath: "Tag", override: true },
  { parentProp: "allowsRemoving", childPath: "TagList", override: true },
  { parentProp: "size", childPath: "Label", override: true },
  {
    parentProp: "label",
    childPath: "Label",
    childProp: "children",
    override: true,
  },
  { parentProp: "items", childPath: "TagList", override: true },
  { parentProp: "variant", childPath: "TagList", override: true },
  { parentProp: "maxRows", childPath: "TagList", override: true },
  { parentProp: "selectedKeys", childPath: "TagList", override: true },
  { parentProp: "selectionMode", childPath: "TagList", override: true },
];

// ADR-912 단계5 step4 (2026-06-17): Select.spec 삭제 — propagation.rules 6건 인라인 보존.
//   시각/CSS 는 STRUCTURE_META virtual 이 담당, builder runtime 의 size/label/placeholder → 자식 전파만
//   여기서 유지. placeholder → SelectValue.children (Select 고유, ComboBox 와 다름).
const selectPropagationRules: PropagationRule[] = [
  { parentProp: "size", childPath: "SelectTrigger", override: true },
  {
    parentProp: "size",
    childPath: ["SelectTrigger", "SelectValue"],
    override: true,
  },
  {
    parentProp: "size",
    childPath: ["SelectTrigger", "SelectIcon"],
    override: true,
  },
  { parentProp: "size", childPath: "Label", override: true },
  {
    parentProp: "label",
    childPath: "Label",
    childProp: "children",
    override: true,
  },
  {
    parentProp: "placeholder",
    childPath: ["SelectTrigger", "SelectValue"],
    childProp: "children",
    override: true,
  },
];

// ADR-912 단계5 step4 (2026-06-17): ComboBox.spec 삭제 — propagation.rules 6건 인라인 보존.
//   Select 동형이나 placeholder → SelectValue.placeholder (HTML input attribute, Select 의 children 과
//   다름) → 별도 spec 필수. R1(2026-06-12)에서 ComboBox 자식이 Select family 공용 type(SelectTrigger/
//   Value/Icon)으로 retype 됐으므로 childPath 는 Select 와 동일 type 명 사용.
const comboBoxPropagationRules: PropagationRule[] = [
  { parentProp: "size", childPath: "SelectTrigger", override: true },
  {
    parentProp: "size",
    childPath: ["SelectTrigger", "SelectValue"],
    override: true,
  },
  {
    parentProp: "size",
    childPath: ["SelectTrigger", "SelectIcon"],
    override: true,
  },
  { parentProp: "size", childPath: "Label", override: true },
  {
    parentProp: "label",
    childPath: "Label",
    childProp: "children",
    override: true,
  },
  {
    parentProp: "placeholder",
    childPath: ["SelectTrigger", "SelectValue"],
    childProp: "placeholder",
    override: true,
  },
];

// ─── Auto-register specs with propagation rules ────────────────────────────
registerPropagationRules("DatePicker", datePickerPropagationRules);
registerPropagationRules("DateRangePicker", dateRangePickerPropagationRules);
registerPropagationRules("Select", selectPropagationRules);
registerPropagationRules("ComboBox", comboBoxPropagationRules);
registerPropagationRules("SearchField", searchFieldPropagationRules);
registerPropagationRules("CheckboxGroup", checkboxGroupPropagationRules);
registerPropagationRules("RadioGroup", radioGroupPropagationRules);
registerPropagationRules("TagGroup", tagGroupPropagationRules);
registerPropagationRules("Checkbox", checkboxPropagationRules);
registerPropagationRules("Radio", radioPropagationRules);
// ADR-914 Phase 5 (2026-06-21): Switch = proof family — shadow spec 없이 rule 배열 직접 등록.
registerPropagationRules("Switch", switchPropagationRules);
registerPropagationRules("TextField", textFieldPropagationRules);
registerPropagationRules("TextArea", textAreaPropagationRules);
registerPropagationRules("NumberField", numberFieldPropagationRules);
registerPropagationRules("DateField", dateFieldPropagationRules);
registerPropagationRules("TimeField", timeFieldPropagationRules);
registerPropagationRules("ColorField", colorFieldPropagationRules);
registerPropagationRules("Slider", sliderPropagationRules);
// ADR-912 단계5 step4 경량 이관 (2026-06-17): ProgressBar/Meter spec 삭제 → propagation-only 인라인 spec.
registerPropagationRules("ProgressBar", progressBarPropagationRules);
registerPropagationRules("Meter", meterPropagationRules);
registerPropagationRules("Calendar", calendarPropagationRules);
registerPropagationRules("RangeCalendar", rangeCalendarPropagationRules);
// ADR-912 R6 (2026-06-15): Card 본체 spec 삭제 → propagation-only 인라인 spec(cardPropagationSpec).
registerPropagationRules("Card", cardPropagationRules);
// ADR-095: CardHeader → Heading flex:1 / CardContent → Description width:100% 주입 rule.
//   ADR-912 (2026-06-15): CardHeader/CardContent spec 삭제 → propagation-only 인라인 spec 으로 보존.
registerPropagationRules("CardHeader", cardHeaderPropagationRules);
registerPropagationRules("CardContent", cardContentPropagationRules);
registerPropagationRules("GridList", gridListPropagationRules);
// ADR-912 단계5 step4 (2026-06-17): ListBox.spec 삭제 → 빈 propagation-only spec(rules 부재 = 구
//   no-op 동작 동일). 정적 모드 shapes 가 부모 variant 직접 참조라 자식 전파 불필요(ListBox.spec:352).
registerPropagationRules("ListBox", listBoxPropagationRules);
registerPropagationRules(
  "ToggleButtonGroup",
  toggleButtonGroupPropagationRules,
);
// Button/ToggleButton → 자식 Text(icon Button label) size 전파. 둘 다 동일 rule(size → Text).
registerPropagationRules("Button", buttonPropagationRules);
registerPropagationRules("ToggleButton", buttonPropagationRules);
// ADR-912 영역 B (A): Tabs → TabList items/selectedKey/variant/size/showIndicator 전파.
//   chip projection(appendTabRowProjection)이 TabList.props.items 를 읽는 invariant 충족.
//   ADR-912 단계5 step4 (2026-06-17): Tabs.spec 삭제 → propagation-only 인라인 spec(tabsPropagationSpec).
registerPropagationRules("Tabs", tabsPropagationRules);
// Collection Item → 자식 Text/Description 전파
registerPropagationRules("GridListItem", collectionItemPropagationRules);
registerPropagationRules("ListBoxItem", collectionItemPropagationRules);
