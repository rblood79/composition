// AUTO-CAPTURED palette oracle — ADR-912 6 registry collapse / ComponentList 파생 proof
// 현 ComponentList 정적 배열(contentComp/layoutComp/buttonsComp/formsComp/collectionsComp/dateTimeComp/overlaysComp)이
// 노출하는 palette 항목의 1:1 보존 스냅샷. getPaletteItems() 파생 결과가 이 oracle 과 같아야 회귀 0.
// 순서 = palette UI 표시 순서(category 8 + 항목). 캡처: 2026-06-11 · 재캡처 2026-10-21 (Library 감사 —
// Meter · Menu · Section · AvatarGroup category, CardView 아이콘, overlay 3종 → catalog).
//
// ⚠️ 이 파일을 손으로 수정하지 말 것 — palette 표시가 의도적으로 바뀔 때만 재캡처.
export interface PaletteOracleItem {
  type: string;
  category: string;
  label: string;
  icon: string;
  layoutOnly?: boolean;
  libraryOnly?: boolean;
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
    type: "Keyboard",
    category: "content",
    label: "keyboard shortcut",
    icon: "Keyboard",
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
    type: "Meter",
    category: "content",
    label: "meter",
    icon: "Gauge",
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
  // 295 후속 C9 (사용자 「Toast 컴포넌트가 컴포넌트 패널에 없다」): S2 Toast — InlineAlert 뒤.
  // 2026-11-01: the Library card only (the app's toast shape) — the panel does not insert it.
  {
    type: "Toast",
    category: "content",
    label: "toast",
    icon: "Bell",
    libraryOnly: true,
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
    type: "Section",
    category: "layout",
    label: "section",
    icon: "Square",
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
    type: "Pagination",
    category: "layout",
    label: "pagination",
    icon: "ChevronsLeftRight",
  },
  {
    type: "Menu",
    category: "layout",
    label: "menu",
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
    type: "TextField",
    category: "forms",
    label: "text field",
    icon: "RectangleEllipsis",
  },
  {
    type: "TextArea",
    category: "forms",
    label: "text area",
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
    type: "Autocomplete",
    category: "forms",
    label: "autocomplete",
    icon: "TextSearch",
  },
  {
    type: "ColorField",
    category: "forms",
    label: "color field",
    icon: "Palette",
  },
  {
    type: "ColorArea",
    category: "forms",
    label: "color area",
    icon: "Blend",
  },
  {
    type: "ColorSlider",
    category: "forms",
    label: "color slider",
    icon: "Rainbow",
  },
  {
    type: "ColorWheel",
    category: "forms",
    label: "color wheel",
    icon: "Disc3",
  },
  {
    type: "ColorSwatch",
    category: "forms",
    label: "color swatch",
    icon: "Palette",
  },
  {
    type: "ColorSwatchPicker",
    category: "forms",
    label: "color swatch picker",
    icon: "LayoutGrid",
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
    type: "FileUpload",
    category: "forms",
    label: "file upload",
    icon: "CloudUpload",
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
    type: "chart-area",
    category: "charts",
    label: "Area Chart",
    icon: "ChartArea",
  },
  {
    type: "chart-bar",
    category: "charts",
    label: "Bar Chart",
    icon: "BarChart3",
  },
  {
    type: "chart-line",
    category: "charts",
    label: "Line Chart",
    icon: "ChartLine",
  },
  {
    type: "chart-pie",
    category: "charts",
    label: "Pie Chart",
    icon: "ChartPie",
  },
  {
    type: "chart-radar",
    category: "charts",
    label: "Radar Chart",
    icon: "Radar",
  },
  {
    type: "chart-radial",
    category: "charts",
    label: "Radial Chart",
    icon: "Gauge",
  },
  {
    type: "chart-scatter",
    category: "charts",
    label: "Scatter Chart",
    icon: "ScatterChart",
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
    type: "Popover",
    category: "overlays",
    label: "popover",
    icon: "AppWindowMac",
  },
  {
    type: "ContextualHelp",
    category: "overlays",
    label: "contextual help",
    icon: "CircleHelp",
  },
  {
    type: "Tooltip",
    category: "overlays",
    label: "tooltip",
    icon: "MessageSquare",
  },
];
