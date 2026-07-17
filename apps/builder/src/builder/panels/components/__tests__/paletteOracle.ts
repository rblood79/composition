// AUTO-CAPTURED palette oracle — ADR-912 6 registry collapse / ComponentList 파생 proof
// 현 ComponentList 정적 배열(contentComp/layoutComp/buttonsComp/formsComp/collectionsComp/dateTimeComp/overlaysComp)이
// 노출하는 palette 항목의 1:1 보존 스냅샷. getPaletteItems() 파생 결과가 이 oracle 과 같아야 회귀 0.
// 순서 = palette UI 표시 순서(category 7 + 항목). 캡처: 2026-06-11.
//
// ⚠️ 이 파일을 손으로 수정하지 말 것 — palette 표시가 의도적으로 바뀔 때만 재캡처.
export interface PaletteOracleItem {
  type: string;
  category: string;
  label: string;
  icon: string;
  layoutOnly?: boolean;
}

export const PALETTE_ORACLE: readonly PaletteOracleItem[] = [
  {
    type: "Text",
    category: "content",
    label: "text",
    icon: "Text",
  },
  {
    type: "Icon",
    category: "content",
    label: "icon",
    icon: "Smile",
  },
  {
    type: "Separator",
    category: "content",
    label: "separator",
    icon: "SeparatorHorizontal",
  },
  {
    type: "Badge",
    category: "content",
    label: "badge",
    icon: "Star",
  },
  {
    type: "ProgressBar",
    category: "content",
    label: "progress bar",
    icon: "BarChart3",
  },
  {
    type: "Skeleton",
    category: "content",
    label: "skeleton",
    icon: "Loader",
  },
  {
    type: "Avatar",
    category: "content",
    label: "avatar",
    icon: "CircleUser",
  },
  {
    type: "AvatarGroup",
    category: "content",
    label: "avatar group",
    icon: "Users",
  },
  {
    type: "StatusLight",
    category: "content",
    label: "status light",
    icon: "CircleDot",
  },
  {
    type: "InlineAlert",
    category: "content",
    label: "inline alert",
    icon: "AlertTriangle",
  },
  {
    type: "ProgressCircle",
    category: "content",
    label: "progress circle",
    icon: "CircleDashed",
  },
  {
    type: "Image",
    category: "content",
    label: "image",
    icon: "ImageIcon",
  },
  {
    type: "IllustratedMessage",
    category: "content",
    label: "illustrated message",
    icon: "ImageIcon",
  },
  {
    type: "Card",
    category: "layout",
    label: "card",
    icon: "AppWindowMac",
  },
  {
    type: "frame",
    category: "layout",
    label: "frame",
    icon: "GroupIcon",
  },
  {
    type: "Tabs",
    category: "layout",
    label: "tabs",
    icon: "AppWindow",
  },
  {
    type: "Breadcrumbs",
    category: "layout",
    label: "breadcrumbs",
    icon: "ChevronRight",
  },
  {
    type: "Link",
    category: "layout",
    label: "link",
    icon: "Link",
  },
  {
    type: "Nav",
    category: "layout",
    label: "navigation",
    icon: "Menu",
  },
  {
    type: "DisclosureGroup",
    category: "layout",
    label: "disclosure group",
    icon: "ChevronDown",
  },
  {
    type: "Disclosure",
    category: "layout",
    label: "disclosure",
    icon: "ChevronDown",
  },
  {
    type: "CardView",
    category: "layout",
    label: "card view",
    icon: "Grid",
  },
  {
    type: "Slot",
    category: "layout",
    label: "slot",
    icon: "Layers",
    layoutOnly: true,
  },
  {
    type: "Button",
    category: "buttons",
    label: "button",
    icon: "MousePointer",
  },
  // ADR-148 Phase 2 — 첫 신규 reusable (의도적 palette 추가).
  {
    type: "IconButton",
    category: "buttons",
    label: "icon button",
    icon: "SquarePlus",
  },
  {
    type: "ToggleButton",
    category: "buttons",
    label: "toggle button",
    icon: "ToggleLeft",
  },
  {
    type: "ToggleButtonGroup",
    category: "buttons",
    label: "toggle button group",
    icon: "GroupIcon",
  },
  {
    type: "Toolbar",
    category: "buttons",
    label: "toolbar",
    icon: "Settings",
  },
  {
    type: "ButtonGroup",
    category: "buttons",
    label: "button group",
    icon: "GroupIcon",
  },
  {
    type: "Menu",
    category: "buttons",
    label: "menu",
    icon: "Menu",
  },
  {
    type: "TextField",
    category: "forms",
    label: "text field",
    icon: "RectangleEllipsis",
  },
  {
    type: "NumberField",
    category: "forms",
    label: "number field",
    icon: "Hash",
  },
  {
    type: "SearchField",
    category: "forms",
    label: "search field",
    icon: "Search",
  },
  {
    type: "Checkbox",
    category: "forms",
    label: "checkbox",
    icon: "SquareCheck",
  },
  {
    type: "CheckboxGroup",
    category: "forms",
    label: "checkbox group",
    icon: "GroupIcon",
  },
  {
    type: "RadioGroup",
    category: "forms",
    label: "radio group",
    icon: "GroupIcon",
  },
  {
    type: "Select",
    category: "forms",
    label: "select",
    icon: "ChevronDown",
  },
  {
    type: "ComboBox",
    category: "forms",
    label: "combo box",
    icon: "ChevronDown",
  },
  {
    type: "Switch",
    category: "forms",
    label: "switch",
    icon: "ToggleRight",
  },
  {
    type: "Slider",
    category: "forms",
    label: "slider",
    icon: "SlidersHorizontal",
  },
  {
    type: "TailSwatch",
    category: "forms",
    label: "color picker",
    icon: "Paintbrush",
  },
  {
    type: "DropZone",
    category: "forms",
    label: "drop zone",
    icon: "Upload",
  },
  {
    type: "FileTrigger",
    category: "forms",
    label: "file trigger",
    icon: "FileUp",
  },
  {
    type: "Form",
    category: "forms",
    label: "form",
    icon: "GroupIcon",
  },
  {
    type: "Table",
    category: "collections",
    label: "table",
    icon: "TableProperties",
  },
  {
    type: "ListBox",
    category: "collections",
    label: "list box",
    icon: "ListIcon",
  },
  {
    type: "GridList",
    category: "collections",
    label: "grid list",
    icon: "Grid",
  },
  {
    type: "Tree",
    category: "collections",
    label: "tree",
    icon: "ListTree",
  },
  {
    type: "TagGroup",
    category: "collections",
    label: "tag group",
    icon: "Tag",
  },
  {
    type: "Section",
    category: "collections",
    label: "section",
    icon: "Square",
  },
  {
    type: "TableView",
    category: "collections",
    label: "table view",
    icon: "TableProperties",
  },
  {
    type: "Calendar",
    category: "dateTime",
    label: "calendar",
    icon: "Calendar",
  },
  {
    type: "DatePicker",
    category: "dateTime",
    label: "date picker",
    icon: "CalendarCheck",
  },
  {
    type: "DateRangePicker",
    category: "dateTime",
    label: "date range picker",
    icon: "CalendarDays",
  },
  {
    type: "DateField",
    category: "dateTime",
    label: "date field",
    icon: "CalendarCheck",
  },
  {
    type: "TimeField",
    category: "dateTime",
    label: "time field",
    icon: "ChevronDown",
  },
  {
    type: "RangeCalendar",
    category: "dateTime",
    label: "range calendar",
    icon: "CalendarDays",
  },
  {
    type: "Dialog",
    category: "overlays",
    label: "dialog",
    icon: "AppWindowMac",
  },
  {
    type: "Modal",
    category: "overlays",
    label: "modal",
    icon: "InspectionPanel",
  },
  {
    type: "Popover",
    category: "overlays",
    label: "popover",
    icon: "AppWindowMac",
  },
  {
    type: "Tooltip",
    category: "overlays",
    label: "tooltip",
    icon: "MessageSquare",
  },
] as const;
