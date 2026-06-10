/**
 * Complex Component Tags
 *
 * Factory가 자식 Element를 생성하는 컴포넌트 태그.
 * 이 태그들은 자식 유무와 관계없이 항상 _hasChildren=true로 처리되어
 * 자식 삭제 시에도 standalone spec 렌더링으로 돌아가지 않음.
 *
 * 사용처:
 * - useElementCreator.ts: Factory 경로 분기
 * - buildSpecNodeData.ts: SYNTHETIC_CHILD_PROP_MERGE_TAGS 포함 태그에는
 *   `_hasChildren` 주입이 차단되며 자식 props가 부모 spec shapes에 통합된다.
 */
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
  "InlineAlert",
  // Date & Color
  "DatePicker",
  "DateRangePicker",
  "Calendar",
  "ColorPicker",
  "ColorSwatchPicker",
  // SYNTHETIC_CHILD_PROP_MERGE_TAGS 포함 태그 (synthetic prop 메커니즘 사용).
  // buildSpecNodeData에서 `_hasChildren` 주입이 차단되므로 standalone 분기가 유지되어 안전.
  // useElementCreator의 Factory 경로 분기용.
  "Tabs",
  "Tree",
  "TagGroup",
  "Table",
  // Feedback (Hybrid)
  "ProgressBar",
  "Meter",
  // Phase 4: Advanced Components (ADR-030)
  "CardView",
  "TableView",
  // S2 확장
  "Nav",
  "Navigation",
  "AvatarGroup",
  "ButtonGroup",
  "Breadcrumbs",
  "IllustratedMessage",
  "RangeCalendar",
]);
