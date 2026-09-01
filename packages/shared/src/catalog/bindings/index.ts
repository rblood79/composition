/**
 * ADR-142 — leaf RAC primitive `PrimitiveBinding` barrel + type 조회.
 * family cutover(Phase 6) 진행 시 약 35개 binding 이 여기 누적된다.
 */
import type { PrimitiveBinding } from "../types";
import { avatarBinding } from "./Avatar.binding";
import { avatarGroupBinding } from "./AvatarGroup.binding";
import { badgeBinding } from "./Badge.binding";
import { bodyBinding } from "./Body.binding";
import { breadcrumbsBinding } from "./Breadcrumbs.binding";
import { breadcrumbBinding } from "./Breadcrumb.binding";
import { buttonBinding } from "./Button.binding";
import { buttonGroupBinding } from "./ButtonGroup.binding";
import { calendarBinding } from "./Calendar.binding";
import { calendarGridBinding } from "./CalendarGrid.binding";
import { calendarHeaderBinding } from "./CalendarHeader.binding";
import { checkboxBinding } from "./Checkbox.binding";
import { dateInputBinding } from "./DateInput.binding";
import { checkboxGroupBinding } from "./CheckboxGroup.binding";
import { codeBinding } from "./Code.binding";
import { colorAreaBinding } from "./ColorArea.binding";
import { colorFieldBinding } from "./ColorField.binding";
import { colorPickerBinding } from "./ColorPicker.binding";
import { colorSliderBinding } from "./ColorSlider.binding";
import { colorSwatchBinding } from "./ColorSwatch.binding";
import { colorSwatchPickerBinding } from "./ColorSwatchPicker.binding";
import { colorWheelBinding } from "./ColorWheel.binding";
import { comboBoxBinding } from "./ComboBox.binding";
import { dateFieldBinding } from "./DateField.binding";
import { datePickerBinding } from "./DatePicker.binding";
import { dateRangePickerBinding } from "./DateRangePicker.binding";
import { descriptionBinding } from "./Description.binding";
import { dialogBinding } from "./Dialog.binding";
import { dialogFooterBinding } from "./DialogFooter.binding";
import { disclosureBinding } from "./Disclosure.binding";
import { disclosureContentBinding } from "./DisclosureContent.binding";
import { disclosureGroupBinding } from "./DisclosureGroup.binding";
import { disclosureHeaderBinding } from "./DisclosureHeader.binding";
import { dropZoneBinding } from "./DropZone.binding";
import { fieldBinding } from "./Field.binding";
import { fieldErrorBinding } from "./FieldError.binding";
import { fileTriggerBinding } from "./FileTrigger.binding";
import { cardBinding } from "./Card.binding";
import { cardContentBinding } from "./CardContent.binding";
import { cardFooterBinding } from "./CardFooter.binding";
import { cardHeaderBinding } from "./CardHeader.binding";
import { cardPreviewBinding } from "./CardPreview.binding";
import { cardViewBinding } from "./CardView.binding";
import { formBinding } from "./Form.binding";
import { formFieldBinding } from "./FormField.binding";
import { gridListBinding } from "./GridList.binding";
import { gridListItemBinding } from "./GridListItem.binding";
import { headingBinding } from "./Heading.binding";
import { iconBinding } from "./Icon.binding";
import { illustratedMessageBinding } from "./IllustratedMessage.binding";
import { inlineAlertBinding } from "./InlineAlert.binding";
import { inputBinding } from "./Input.binding";
import { kbdBinding } from "./Kbd.binding";
import { labelBinding } from "./Label.binding";
import { linkBinding } from "./Link.binding";
import { listBoxBinding } from "./ListBox.binding";
import { listBoxItemBinding } from "./ListBoxItem.binding";
import { menuBinding } from "./Menu.binding";
import { meterBinding } from "./Meter.binding";
import { meterTrackBinding } from "./MeterTrack.binding";
import { meterValueBinding } from "./MeterValue.binding";
import { modalBinding } from "./Modal.binding";
import { navBinding } from "./Nav.binding";
import { numberFieldBinding } from "./NumberField.binding";
import { paginationBinding } from "./Pagination.binding";
import { paragraphBinding } from "./Paragraph.binding";
import { popoverBinding } from "./Popover.binding";
import { progressBarBinding } from "./ProgressBar.binding";
import { progressBarTrackBinding } from "./ProgressBarTrack.binding";
import { progressBarValueBinding } from "./ProgressBarValue.binding";
import { progressCircleBinding } from "./ProgressCircle.binding";
import { radioBinding } from "./Radio.binding";
import { radioGroupBinding } from "./RadioGroup.binding";
import { rangeCalendarBinding } from "./RangeCalendar.binding";
import { searchFieldBinding } from "./SearchField.binding";
import { sectionBinding } from "./Section.binding";
import { selectBinding } from "./Select.binding";
import { selectTriggerBinding } from "./SelectTrigger.binding";
import { selectValueBinding } from "./SelectValue.binding";
import { selectIconBinding } from "./SelectIcon.binding";
import { separatorBinding } from "./Separator.binding";
import { skeletonBinding } from "./Skeleton.binding";
import { sliderBinding } from "./Slider.binding";
import { sliderOutputBinding } from "./SliderOutput.binding";
import { sliderThumbBinding } from "./SliderThumb.binding";
import { sliderTrackBinding } from "./SliderTrack.binding";
import { statusLightBinding } from "./StatusLight.binding";
import { switchBinding } from "./Switch.binding";
import { tableBinding } from "./Table.binding";
import { tableCellBinding } from "./TableCell.binding";
import { tableRowBinding } from "./TableRow.binding";
import { tableViewBinding } from "./TableView.binding";
// ADR-912 catalog cutover (TableView 자식 트리 Skia 대칭, 2026-06-25):
//   TableView factory 가 생성하는 canonical 자식 5종. catalog 등록으로 isCatalogCutover → Skia
//   buildCatalogShapes box+text. DOM 은 renderTableView self-compose(독립 노드 0). PALETTE 비노출.
import { columnBinding } from "./Column.binding";
import { cellBinding } from "./Cell.binding";
import { rowBinding } from "./Row.binding";
import { tableHeaderBinding } from "./TableHeader.binding";
import { tableBodyBinding } from "./TableBody.binding";
import { tabsBinding } from "./Tabs.binding";
import { tabBinding } from "./Tab.binding";
import { tabListBinding } from "./TabList.binding";
import { tagBinding } from "./Tag.binding";
import { tagListBinding } from "./TagList.binding";
import { tagGroupBinding } from "./TagGroup.binding";
import { tailSwatchBinding } from "./TailSwatch.binding";
import { textAreaBinding } from "./TextArea.binding";
import { textBinding } from "./Text.binding";
import { textFieldBinding } from "./TextField.binding";
import { timeFieldBinding } from "./TimeField.binding";
import { toastBinding } from "./Toast.binding";
import { toggleButtonBinding } from "./ToggleButton.binding";
import { toggleButtonGroupBinding } from "./ToggleButtonGroup.binding";
import { toolbarBinding } from "./Toolbar.binding";
import { tooltipBinding } from "./Tooltip.binding";
import { treeBinding } from "./Tree.binding";
import { treeItemBinding } from "./TreeItem.binding";

export * from "./Avatar.binding";
export * from "./AvatarGroup.binding";
export * from "./Badge.binding";
export * from "./Body.binding";
export * from "./Breadcrumbs.binding";
export * from "./Breadcrumb.binding";
export * from "./Button.binding";
export * from "./ButtonGroup.binding";
export * from "./Calendar.binding";
export * from "./CalendarGrid.binding";
export * from "./CalendarHeader.binding";
export * from "./DateInput.binding";
export * from "./Checkbox.binding";
export * from "./CheckboxGroup.binding";
export * from "./Code.binding";
export * from "./ColorArea.binding";
export * from "./ColorField.binding";
export * from "./ColorPicker.binding";
export * from "./ColorSlider.binding";
export * from "./ColorSwatch.binding";
export * from "./ColorSwatchPicker.binding";
export * from "./ColorWheel.binding";
export * from "./ComboBox.binding";
export * from "./DateField.binding";
export * from "./DatePicker.binding";
export * from "./DateRangePicker.binding";
export * from "./Description.binding";
export * from "./Dialog.binding";
export * from "./DialogFooter.binding";
export * from "./DisclosureContent.binding";
export * from "./DisclosureGroup.binding";
export * from "./DisclosureHeader.binding";
export * from "./DropZone.binding";
export * from "./FieldError.binding";
export * from "./FileTrigger.binding";
export * from "./Card.binding";
export * from "./CardContent.binding";
export * from "./CardFooter.binding";
export * from "./CardHeader.binding";
export * from "./CardPreview.binding";
export * from "./CardView.binding";
export * from "./Form.binding";
export * from "./FormField.binding";
export * from "./GridList.binding";
export * from "./GridListItem.binding";
export * from "./Heading.binding";
export * from "./Icon.binding";
export * from "./IllustratedMessage.binding";
export * from "./InlineAlert.binding";
export * from "./Kbd.binding";
export * from "./Label.binding";
export * from "./Link.binding";
export * from "./ListBox.binding";
export * from "./ListBoxItem.binding";
export * from "./Menu.binding";
export * from "./Meter.binding";
export * from "./MeterTrack.binding";
export * from "./Modal.binding";
export * from "./Nav.binding";
export * from "./NumberField.binding";
export * from "./Pagination.binding";
export * from "./Paragraph.binding";
export * from "./Popover.binding";
export * from "./ProgressBar.binding";
export * from "./ProgressBarTrack.binding";
export * from "./ProgressCircle.binding";
export * from "./Radio.binding";
export * from "./RadioGroup.binding";
export * from "./RangeCalendar.binding";
export * from "./SearchField.binding";
export * from "./Section.binding";
export * from "./Select.binding";
export * from "./SelectTrigger.binding";
export * from "./SelectValue.binding";
export * from "./SelectIcon.binding";
export * from "./Separator.binding";
export * from "./Skeleton.binding";
export * from "./Slider.binding";
export * from "./SliderTrack.binding";
export * from "./StatusLight.binding";
export * from "./Switch.binding";
export * from "./Table.binding";
export * from "./TableCell.binding";
export * from "./TableRow.binding";
export * from "./TableView.binding";
export * from "./Column.binding";
export * from "./Cell.binding";
export * from "./Row.binding";
export * from "./TableHeader.binding";
export * from "./TableBody.binding";
export * from "./Tabs.binding";
export * from "./Tab.binding";
export * from "./TabList.binding";
export * from "./Tag.binding";
export * from "./TagGroup.binding";
export * from "./TailSwatch.binding";
export * from "./TextArea.binding";
export * from "./Text.binding";
export * from "./TextField.binding";
export * from "./Tree.binding";
export * from "./TreeItem.binding";
export * from "./TimeField.binding";
export * from "./Toast.binding";
export * from "./ToggleButton.binding";
export * from "./ToggleButtonGroup.binding";
export * from "./Toolbar.binding";
export * from "./Tooltip.binding";

/**
 * component type → leaf PrimitiveBinding 조회.
 * Phase 2/4 의 `componentCatalog` 등록 전까지의 primitive lookup seed —
 * generic 렌더러가 "이 type 이 catalog primitive 인가" 를 판정하는 단일 진입점.
 */
const PRIMITIVE_BINDINGS: Readonly<Record<string, PrimitiveBinding>> = {
  // family ① primitives/actions
  Badge: badgeBinding,
  Breadcrumbs: breadcrumbsBinding,
  // ADR-912 projection 3 cutover (2026-06-15): Breadcrumb projection sub-part (Pattern B —
  //   canonical element 부재, projection 전용 SceneNode). internal source, Skia=breadcrumb_crumb
  //   (replace, label+separator). DOM=부모 Breadcrumbs self-compose(독립 노드 0). DELEGATING 불요.
  Breadcrumb: breadcrumbBinding,
  Button: buttonBinding,
  Icon: iconBinding,
  IllustratedMessage: illustratedMessageBinding,
  Link: linkBinding,
  Separator: separatorBinding,
  // ADR-912 위험군 해소(선행-3/4): TEXT_LEAF 순수 텍스트 leaf (internal source, DOM generic, Skia box+text)
  Text: textBinding,
  Heading: headingBinding,
  Paragraph: paragraphBinding,
  // ADR-912 위험군 해소: TEXT_LEAF box형 mono (fontFamily generic 보강 후 등록)
  Code: codeBinding,
  Kbd: kbdBinding,
  // ADR-912 위험군 해소(선행-6): field/form 라벨 leaf (부모 의존 4단계 변형은 dispatch 직교)
  Label: labelBinding,
  // ADR-912 위험군 해소(선행-6): compound 보조 설명 leaf (TEXT_LEAF 동형, 부모 변형 0, weight 400)
  Description: descriptionBinding,
  // ADR-912 (B+icon): Disclosure 헤더 leaf (leading chevron + title, leading_icon append escape).
  //   DOM 은 부모 Disclosure self-compose(독립 노드 0), Skia generic box+text + leading_icon.
  DisclosureHeader: disclosureHeaderBinding,
  // ADR-912 box+text 변환 군 (2026-06-10): Disclosure 패널 콘텐츠 leaf (internal source, renderer=
  //   "disclosurecontent"). inline text(rule height:0, paddingX 미정의=0) → buildCatalogShapes
  //   box+text generic parity. spec sizes.paddingX(12) 가 Skia 에만 적용되던 "padding Skia-only" 비대칭
  //   해소 — padding 단일 source = element.props.style(DOM renderDisclosureContent ↔ Skia buildCatalogShapes).
  //   DOM=renderDisclosureContent 위임(부모 renderDisclosure contentChildren 재귀, 독립 노드 유지).
  DisclosureContent: disclosureContentBinding,
  ToggleButton: toggleButtonBinding,
  ToggleButtonGroup: toggleButtonGroupBinding,
  Toolbar: toolbarBinding,
  // ADR-912 단계 5 선행-1: button-like RAC leaf (box+text generic)
  FileTrigger: fileTriggerBinding,
  // ADR-912 단계 5 선행-1: loading placeholder internal leaf (box generic, skeletonVariant 빌더 미노출)
  Skeleton: skeletonBinding,
  // ADR-912 진로 1번: 상태 표시 dot+label internal leaf (status_light escape, replace)
  StatusLight: statusLightBinding,
  // ADR-912 진로 1번: 사용자 아바타 circle+image internal leaf (avatar escape, replace — image 미generic)
  Avatar: avatarBinding,
  // ADR-912 R7 G1-a/b: container shell catalog cutover (internal/div, generic box shell + 자식
  //   Avatar/Card/Table self-draw). spec.render.shapes Skia fallback 제거 → buildCatalogShapes.
  AvatarGroup: avatarGroupBinding,
  // ADR-912 container shell 3 (2026-06-04): box형 시맨틱 컨테이너 leaf (internal source, generic
  //   box 시각). spec.render.shapes Skia fallback 제거. SHELL_ONLY(Body/Section) 또는 자식 무관
  //   bg(Nav) → buildCatalogShapes box 만으로 spec parity. List 는 샘플 text 때문에 별도 보류.
  body: bodyBinding,
  Section: sectionBinding,
  Nav: navBinding,
  // ADR-912 R7 G1-c (2026-06-15): 페이지네이션 컨테이너 (internal source, generic box shell). factory
  //   가 자식 Button×5 자동 생성 → 런타임 항상 _hasChildren=true → standalone 버튼군 dead, 컨테이너
  //   box(flex row)만 live (AvatarGroup/CardView/TableView 동형). staticSelectors 7개는 generate-css
  //   TEXT_LEAF_META.composition 으로 전달(Link rootSelectors 선례). variant/size/totalPages/currentPage accepts.
  Pagination: paginationBinding,
  // ADR-912 R7 G1-c (2026-06-15): 버튼 묶음 컨테이너 (internal source, 투명 generic shell). factory
  //   가 자식 Button×2(Cancel/Save) 자동 생성 → 런타임 항상 _hasChildren=true → standalone box 분기
  //   dead, 자식 Button self-draw (AvatarGroup/Pagination 동형). variant default 전부 transparent →
  //   투명 box shell. layout(flex/gap)은 factory props.style SSOT. size/orientation/align/isDisabled accepts.
  ButtonGroup: buttonGroupBinding,
  // ADR-912 internal 4 slice (2026-06-04): 인라인 알림 box leaf (internal source, generic box+border
  //   시각, staticAttrs role="alert"). render.shapes shell-only → buildCatalogShapes box+border parity.
  InlineAlert: inlineAlertBinding,
  // ADR-912 §2-5 collapse proof (2026-06-10): Disclosure 컨테이너 (internal source, renderer=
  //   "disclosure"). SHELL_ONLY → spec.render.shapes `[]` → Skia generic 빈 shell parity (variant
  //   없음, hasVisibleBg=false). DOM=rendererMap.renderDisclosure 위임(DELEGATING_INTERNAL_RENDERERS,
  //   self-compose title 추출 + expand/collapse 보존). ProgressBar/Tabs 동형 위임 패턴.
  Disclosure: disclosureBinding,
  // ADR-912 Disclosure 군 일괄 cutover (2026-06-10): 디스클로저 그룹 컨테이너 (사용자 "Accordion"
  //   통칭, Accordion type 은 중복으로 제거됨 2026-06-10). SHELL_ONLY → buildCatalogShapes generic
  //   box+border(rule COMPONENT_RULES_TABLE.DisclosureGroup). DOM=renderDisclosureGroup generic
  //   자식 재귀(DELEGATING 불필요). allowsMultipleExpanded/variant/size 는 accepts → toRacProps.
  DisclosureGroup: disclosureGroupBinding,
  // family ② fields
  TextField: textFieldBinding,
  // ADR-912 단계 5 선행-1: multi-line field RAC leaf (box+text generic, _hasChildren shell)
  TextArea: textAreaBinding,
  NumberField: numberFieldBinding,
  SearchField: searchFieldBinding,
  DateField: dateFieldBinding,
  TimeField: timeFieldBinding,
  ColorField: colorFieldBinding,
  // ADR-912 Color cutover: leaf 5종은 box-only, container 2종은 factory child UI 를 보존하는
  //   shell-only container 로 catalog 등록. ColorPicker/ColorSwatchPicker DOM 은 rendererMap 위임.
  ColorPicker: colorPickerBinding,
  ColorSwatch: colorSwatchBinding,
  ColorArea: colorAreaBinding,
  ColorWheel: colorWheelBinding,
  ColorSlider: colorSliderBinding,
  ColorSwatchPicker: colorSwatchPickerBinding,
  TailSwatch: tailSwatchBinding,
  Form: formBinding,
  // ADR-912 childSpec→catalog cutover (2026-06-15): Form 필드 그룹 슬롯 컨테이너 sub-part
  //   (DialogFooter 동형 — 두 번째 childSpec 제거). internal/div shell, layout 은 factory props.style.
  FormField: formFieldBinding,
  // ADR-912 R6 (2026-06-15): Card 본체 S2 재설계 catalog cutover. variant=primary/secondary/
  //   tertiary/quiet(구 cardType/isQuiet 흡수). internal/div shell + variant 별 배경/테두리.
  Card: cardBinding,
  // ADR-912 childSpec→catalog cutover (2026-06-15): Card 4 자식 슬롯 컨테이너 sub-part 일괄
  //   (FormField/DialogFooter 동형 — Card.spec.childSpecs 제거). internal/div shell, layout 은 factory
  //   props.style(ADR-092 가 spec containerStyles 로 이관했던 것을 catalog cutover 로 factory 복귀).
  CardHeader: cardHeaderBinding,
  CardContent: cardContentBinding,
  CardFooter: cardFooterBinding,
  CardPreview: cardPreviewBinding,
  // ADR-912 R7 G1-b (2026-06-15): Card 그리드/워터폴 컬렉션 컨테이너 (AvatarGroup 동형 — 빈 셸,
  //   자식 Card self-draw). internal/div shell, layout(flex/wrap/gap)은 factory props.style.
  CardView: cardViewBinding,
  // ADR-912 위험군 해소(선행-6): field/form validation 에러 메시지 leaf (TEXT_LEAF 동형, 부모 데이터
  //   의존 0, weight 400 negative 색, measure 는 부모 height 분기로 catalog 직교)
  FieldError: fieldErrorBinding,
  // ADR-912 위험군 해소(선행-6): field 입력 영역 자식 leaf (rac source — RAC <Input> 이 부모 TextField
  //   controller slot 소비, generic box+text 시각). createInput 단독 factory 없음(자식 sub-part 전용).
  Input: inputBinding,
  // ADR-912 6 registry collapse T1 (2026-06-11): 데이터 매핑 internal leaf (render.shapes []→Skia 0).
  //   palette 미노출(데이터 매핑, PALETTE_ORDER 비포함). DOM=rendererMap.Field=renderDataField 위임
  //   (DELEGATING_INTERNAL_RENDERERS — self-compose: 부모 value lookup + childrenByParent). Skia 는
  //   catalog 게이트 통과 후 빈 노드(shapes []). escape 불필요(특수 shape 0).
  Field: fieldBinding,
  // family ③ selection
  Checkbox: checkboxBinding,
  CheckboxGroup: checkboxGroupBinding,
  Radio: radioBinding,
  RadioGroup: radioGroupBinding,
  Switch: switchBinding,
  Slider: sliderBinding,
  // ADR-912 SliderTrack: Slider compound 의 트랙 (배경 + value 막대 + thumb, Skia-전용 sub-part,
  //   slider_fill_bar escape, replace — thumb 컨테이너 box). DOM=RAC Slider self-compose (DOM no-op).
  SliderTrack: sliderTrackBinding,
  // ADR-912 SliderThumb (2026-06-16): Slider compound 의 핸들 (circle + border, Skia-전용 sub-part,
  //   slider_thumb escape, replace — circle 전체 외형). DOM=RAC Slider self-compose (DOM no-op).
  SliderThumb: sliderThumbBinding,
  // ADR-912 선행-2: ProgressBar compound 의 value 채움 막대 (Skia-전용 sub-part, value_fill_bar escape)
  ProgressBarTrack: progressBarTrackBinding,
  // ADR-912 선행-2: Meter compound 의 value 채움 막대 (Skia-전용 sub-part, value_fill_bar escape, variant 4색)
  MeterTrack: meterTrackBinding,
  // ADR-912 value-label (2026-06-11): 부모 compound 의 현재 값 텍스트 leaf (buildCatalogShapes text,
  //   value_fill_* escape 없음). DOM=부모 RAC self-compose 흡수. binding 필수 — 누락 시
  //   resolveEditContract value 선택 크래시(entry.binding.props.accepts).
  MeterValue: meterValueBinding,
  ProgressBarValue: progressBarValueBinding,
  SliderOutput: sliderOutputBinding,
  // ADR-912 진로 1번: 원형 진행률 internal leaf (value_fill_arc escape, replace — arc 미generic).
  //   leaf(children:[]) + value/size props → DOM=INTERNAL_RENDERERS["progresscircle"](SVG ring).
  ProgressCircle: progressCircleBinding,
  // ADR-912 진로 1번: 진행률 compound (factory 3자식) — DOM=rendererMap.renderProgressBar 위임
  //   (DELEGATING_INTERNAL_RENDERERS, Tabs 선례). Skia=shell-only + 자식 ProgressBarTrack value_fill_bar.
  ProgressBar: progressBarBinding,
  // ADR-912 진로 1번: 측정값 compound (factory 3자식, ProgressBar 동형) — DOM=rendererMap.renderMeter
  //   위임. Skia=shell-only + 자식 MeterTrack value_fill_bar(variant 4색). isIndeterminate 부재.
  Meter: meterBinding,
  // family ④ collections (internal source — composition wrapper + useCollectionData)
  ListBox: listBoxBinding,
  ListBoxItem: listBoxItemBinding,
  Menu: menuBinding,
  Select: selectBinding,
  // ADR-912 R1 Select family rebuild (2026-06-12): field-trigger 공용 sub-part 3종.
  //   ComboBoxWrapper/Input/Trigger + Search* synthetic 7 alias 를 factory retype 으로 합류 →
  //   BUILDER_ALIAS_MAP 해체. DOM=부모 RAC self-compose(독립 노드 0), Skia=generic box/text +
  //   icon_font escape (MeterValue 동형 비대칭).
  SelectTrigger: selectTriggerBinding,
  SelectValue: selectValueBinding,
  SelectIcon: selectIconBinding,
  ComboBox: comboBoxBinding,
  Tabs: tabsBinding,
  // ADR-912 projection 3 cutover (2026-06-15): Tab/TabList projection sub-part (TableCell/TableRow
  //   Pattern B 동형 — canonical element 부재, projection 전용 SceneNode). internal source,
  //   Skia=generic box+text + tab_indicator(append) / tablist_divider(append). DOM=부모 Tabs
  //   self-compose(독립 노드 0). DELEGATING 불요.
  Tab: tabBinding,
  TabList: tabListBinding,
  Tag: tagBinding,
  TagList: tagListBinding,
  TagGroup: tagGroupBinding,
  GridList: gridListBinding,
  GridListItem: gridListItemBinding,
  // family ⑤ Tree·Table (internal source — composition wrapper + useCollectionData, 재귀/2D)
  Tree: treeBinding,
  TreeItem: treeItemBinding,
  Table: tableBinding,
  TableCell: tableCellBinding,
  TableRow: tableRowBinding,
  // ADR-912 R7 G1-b (2026-06-15): 강화 Table 컨테이너 (S2 variant default/quiet — 구 isQuiet
  //   boolean 흡수). internal/div shell + variant 별 border, layout 은 factory props.style.
  TableView: tableViewBinding,
  // ADR-912 catalog cutover (TableView 자식 트리 Skia 대칭, 2026-06-25): TableView factory 가
  //   생성하는 canonical 자식 5종(Column/Cell=text leaf, TableHeader/TableBody/Row=container shell).
  //   catalog 등록으로 isCatalogCutover → Skia buildCatalogShapes box+text(이전엔 buildSpecNodeData:994
  //   !spec && !isCatalogCutover → null 로 버려져 Skia 미렌더). DOM=renderTableView self-compose
  //   (독립 노드 0). PALETTE_ORDER 미포함(TableCell/TableRow 동형 — 단독 배치 불가).
  TableHeader: tableHeaderBinding,
  TableBody: tableBodyBinding,
  Column: columnBinding,
  Row: rowBinding,
  Cell: cellBinding,
  // family ⑥ overlays (internal source — composition wrapper, portal/overlay, skiaLegacy)
  Dialog: dialogBinding,
  // ADR-912 childSpec→catalog cutover (2026-06-15): Dialog 액션 영역 슬롯 컨테이너 sub-part
  //   (palette 미노출, factory 자동 생성). spec(render.shapes []) childSpecs 경로 → catalog generic
  //   box shell. footer layout=factory props.style SSOT. DOM=generic(KNOWN_HTML footer), Skia=shell.
  DialogFooter: dialogFooterBinding,
  Modal: modalBinding,
  Popover: popoverBinding,
  Tooltip: tooltipBinding,
  // ADR-912 R7 G1-c: Toast box-shell catalog cutover (좌측 accent bar = toast_accent_bar escape).
  Toast: toastBinding,
  DropZone: dropZoneBinding,
  // family ⑦ date/color (internal source — composition wrapper, 날짜 grid/portal + color shells).
  Calendar: calendarBinding,
  // ADR-912 (B+icon): CalendarHeader leaf (inline_icon_text replace — 좌 chevron + center text + 우 chevron).
  //   DOM 은 부모 Calendar self-compose(독립 노드 0), Skia 만 자기 노드 발효.
  CalendarHeader: calendarHeaderBinding,
  // ADR-912 (A/2D): CalendarGrid leaf (calendar_month_grid replace — 요일 헤더 + 날짜 셀 + today circle).
  //   DOM 은 부모 Calendar self-compose(독립 노드 0), Skia 만 자기 노드 발효. nav 는 CalendarHeader 담당.
  CalendarGrid: calendarGridBinding,
  // ADR-912 deletion-risk(date): DateInput leaf (datefield_segments replace — input box + border +
  //   세그먼트 placeholder text + picker icon). DOM 은 부모 DateField/TimeField/DatePicker self-compose
  //   (독립 노드 0, INTERNAL_RENDERERS 미등록 → cutover generic skip), Skia 만 자기 노드 발효.
  DateInput: dateInputBinding,
  RangeCalendar: rangeCalendarBinding,
  DatePicker: datePickerBinding,
  DateRangePicker: dateRangePickerBinding,
};

export function getPrimitiveBinding(
  type: string,
): PrimitiveBinding | undefined {
  return PRIMITIVE_BINDINGS[type];
}

/** lowercase type → PascalCase binding key 역인덱스 (layout 은 `element.type.toLowerCase()` 를 쓴다). */
const LOWERCASE_BINDING_KEY: ReadonlyMap<string, string> = (() => {
  const m = new Map<string, string>();
  for (const k of Object.keys(PRIMITIVE_BINDINGS)) m.set(k.toLowerCase(), k);
  return m;
})();

/**
 * ADR-923 r22m1 — **prop 부재 기본값의 단일 원천**. `toRacProps` 는 `props` 에 키가 없으면
 * `accepts[key].default` 를 채워 컴포넌트에 넘긴다 (`outputs/toRacProps.ts`). 그러므로 같은
 * canonical 입력에서 Preview 가 실제로 쓰는 값은 이 default 이며, layout(Skia) 이 자기 리터럴
 * fallback 을 따로 들고 있으면 prop 없는 요소에서만 두 표면이 갈린다 — round 21 이 Table 에
 * `heightMode`/`height` 다리를 놓으면서 layout 의 기존 300 fallback 을 정렬하지 않아
 * DOM 402 / layout 302 로 발산했다 (factory 는 항상 `height: 400` 을 기록해 생성 경로에서는
 * 가려졌고, canonical/import 입력만 prop 부재를 표현한다).
 *
 * Pascal("Table") · lowercase("table") 둘 다 받는다.
 */
export function resolveBindingPropDefault(
  typeOrTag: string,
  key: string,
): unknown {
  const bindingKey =
    PRIMITIVE_BINDINGS[typeOrTag] !== undefined
      ? typeOrTag
      : LOWERCASE_BINDING_KEY.get(typeOrTag.toLowerCase());
  if (bindingKey === undefined) return undefined;
  return PRIMITIVE_BINDINGS[bindingKey]?.props.accepts[key]?.default;
}

/**
 * ADR-923 r23m1 sweep — collection 의 `selectionMode` 기본값. cutover 경로의 Preview 는
 * `toRacProps` 가 채운 binding default 를 받으므로 (렌더러 destructure 기본값에 도달하지
 * 않는다) layout·scene 의 판정 기본값도 같은 값이어야 한다. binding 이 선언하지 않은
 * 타입만 호출자의 컴포넌트 기본값(`fallback`)을 쓴다.
 *
 * GridList 는 binding `single` 인데 layout·scene 이 `none` 을 들고 있었다 — 두 값 모두
 * `checkboxModes: ["multiple"]` 밖이라 시각 결과는 같았지만, 기본값 원천이 둘이라 binding
 * 쪽만 바뀌면 조용히 갈린다 (round 22 Table 높이와 같은 형태).
 */
export function resolveBindingSelectionMode(
  type: string,
  fallback: "none" | "single" | "multiple",
): "none" | "single" | "multiple" {
  const value = resolveBindingPropDefault(type, "selectionMode");
  return value === "none" || value === "single" || value === "multiple"
    ? value
    : fallback;
}
