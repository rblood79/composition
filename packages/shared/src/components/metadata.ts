/**
 * 컴포넌트 메타데이터
 * Inspector 자동화를 위한 설정 정보
 */

export interface ComponentMeta {
  type: string;
  label: string;
  category: string;
  icon?: string;

  inspector: {
    // PropertiesSection - 전용 에디터 설정
    hasCustomEditor: boolean;
    editorName?: string;

    // DataSection - 데이터 바인딩 타입
    dataBindingType: "collection" | "value" | null;

    // EventSection - 지원 이벤트 목록
    supportedEvents: string[];
  };
}

/**
 * 컴포넌트 메타데이터 레지스트리
 */
export const componentMetadata: ComponentMeta[] = [
  // Buttons
  {
    type: "Button",
    label: "Button",
    category: "Buttons",
    icon: "🔘",
    inspector: {
      hasCustomEditor: false,
      dataBindingType: null,
      // React Aria: onPress, onClick, onFocus, onBlur, onFocusChange, onKeyDown, onKeyUp, onHoverStart, onHoverEnd
      supportedEvents: [
        "onPress",
        "onClick",
        "onMouseEnter",
        "onMouseLeave",
        "onFocus",
        "onBlur",
        "onKeyDown",
        "onKeyUp",
      ],
    },
  },
  {
    type: "ToggleButton",
    label: "Toggle Button",
    category: "Buttons",
    icon: "🔘",
    inspector: {
      hasCustomEditor: false,
      dataBindingType: null,
      // React Aria: onChange, onPress, onClick, onFocus, onBlur, onFocusChange, onKeyDown, onKeyUp, onHoverStart, onHoverEnd
      supportedEvents: [
        "onChange",
        "onPress",
        "onClick",
        "onMouseEnter",
        "onMouseLeave",
        "onFocus",
        "onBlur",
        "onKeyDown",
        "onKeyUp",
      ],
    },
  },
  {
    type: "ToggleButtonGroup",
    label: "Toggle Button Group",
    category: "Buttons",
    icon: "🔘",
    inspector: {
      hasCustomEditor: false,
      dataBindingType: "collection",
      // React Aria: onChange, onSelectionChange, onFocus, onBlur
      supportedEvents: ["onChange", "onSelectionChange", "onFocus", "onBlur"],
    },
  },
  {
    type: "Menu",
    label: "Menu",
    category: "Collections",
    icon: "📋",
    inspector: {
      hasCustomEditor: false,
      dataBindingType: "collection",
      // React Aria: onAction, onSelectionChange, onClose, onOpenChange
      supportedEvents: [
        "onAction",
        "onSelectionChange",
        "onOpenChange",
        "onFocus",
        "onBlur",
      ],
    },
  },
  {
    type: "Toolbar",
    label: "Toolbar",
    category: "Buttons",
    icon: "🛠️",
    inspector: {
      hasCustomEditor: false,
      dataBindingType: null,
      // React Aria: onFocus, onBlur
      supportedEvents: ["onFocus", "onBlur"],
    },
  },
  {
    type: "Link",
    label: "Link",
    category: "Layout",
    icon: "🔗",
    inspector: {
      hasCustomEditor: false,
      dataBindingType: null,
      // React Aria: onPress, onClick, onFocus, onBlur, onFocusChange, onKeyDown, onKeyUp, onHoverStart, onHoverEnd
      supportedEvents: [
        "onPress",
        "onClick",
        "onMouseEnter",
        "onMouseLeave",
        "onFocus",
        "onBlur",
        "onKeyDown",
        "onKeyUp",
      ],
    },
  },

  // Forms
  {
    type: "TextField",
    label: "Text Field",
    category: "Forms",
    icon: "📝",
    inspector: {
      hasCustomEditor: false,
      dataBindingType: "value",
      // React Aria: onChange, onFocus, onBlur, onFocusChange, onKeyDown, onKeyUp
      supportedEvents: [
        "onChange",
        "onFocus",
        "onBlur",
        "onKeyDown",
        "onKeyUp",
      ],
    },
  },
  {
    type: "NumberField",
    label: "Number Field",
    category: "Forms",
    icon: "#️⃣",
    inspector: {
      hasCustomEditor: false,
      dataBindingType: "value",
      // React Aria: onChange, onFocus, onBlur, onFocusChange, onKeyDown, onKeyUp
      supportedEvents: [
        "onChange",
        "onFocus",
        "onBlur",
        "onKeyDown",
        "onKeyUp",
      ],
    },
  },
  {
    type: "SearchField",
    label: "Search Field",
    category: "Forms",
    icon: "🔍",
    inspector: {
      hasCustomEditor: false,
      dataBindingType: "value",
      // React Aria: onChange, onSubmit, onClear, onFocus, onBlur, onFocusChange, onKeyDown, onKeyUp
      supportedEvents: [
        "onChange",
        "onSubmit",
        "onFocus",
        "onBlur",
        "onKeyDown",
        "onKeyUp",
      ],
    },
  },
  {
    type: "TextArea",
    label: "Text Area",
    category: "Forms",
    icon: "📝",
    inspector: {
      hasCustomEditor: false,
      dataBindingType: "value",
      // React Aria: onChange, onFocus, onBlur, onFocusChange, onKeyDown, onKeyUp
      supportedEvents: [
        "onChange",
        "onFocus",
        "onBlur",
        "onKeyDown",
        "onKeyUp",
      ],
    },
  },
  {
    type: "Checkbox",
    label: "Checkbox",
    category: "Forms",
    icon: "☑️",
    inspector: {
      hasCustomEditor: false,
      dataBindingType: "value",
      // React Aria: onChange, onPress, onFocus, onBlur, onFocusChange, onKeyDown, onKeyUp, onHoverStart, onHoverEnd
      supportedEvents: [
        "onChange",
        "onFocus",
        "onBlur",
        "onKeyDown",
        "onKeyUp",
        "onMouseEnter",
        "onMouseLeave",
      ],
    },
  },
  {
    type: "CheckboxGroup",
    label: "Checkbox Group",
    category: "Forms",
    icon: "☑️",
    inspector: {
      hasCustomEditor: false,
      dataBindingType: "collection",
      // React Aria: onChange, onFocus, onBlur, onFocusChange
      supportedEvents: ["onChange", "onFocus", "onBlur"],
    },
  },
  {
    type: "Radio",
    label: "Radio",
    category: "Forms",
    icon: "🔘",
    inspector: {
      hasCustomEditor: false,
      dataBindingType: "value",
      // React Aria: onPress, onFocus, onBlur, onFocusChange, onKeyDown, onKeyUp, onHoverStart, onHoverEnd
      supportedEvents: [
        "onFocus",
        "onBlur",
        "onKeyDown",
        "onKeyUp",
        "onMouseEnter",
        "onMouseLeave",
      ],
    },
  },
  {
    type: "RadioGroup",
    label: "Radio Group",
    category: "Forms",
    icon: "🔘",
    inspector: {
      hasCustomEditor: false,
      dataBindingType: "collection",
      // React Aria: onChange, onFocus, onBlur, onFocusChange
      supportedEvents: ["onChange", "onFocus", "onBlur"],
    },
  },
  {
    type: "Select",
    label: "Select",
    category: "Forms",
    icon: "🔽",
    inspector: {
      hasCustomEditor: false,
      dataBindingType: "collection",
      // React Aria: onSelectionChange, onOpenChange, onFocus, onBlur, onFocusChange, onKeyDown, onKeyUp
      supportedEvents: [
        "onSelectionChange",
        "onOpenChange",
        "onFocus",
        "onBlur",
        "onKeyDown",
        "onKeyUp",
      ],
    },
  },
  {
    type: "ComboBox",
    label: "Combo Box",
    category: "Forms",
    icon: "🔽",
    inspector: {
      hasCustomEditor: false,
      dataBindingType: "collection",
      // React Aria: onSelectionChange, onInputChange, onOpenChange, onFocus, onBlur, onFocusChange, onKeyDown, onKeyUp
      supportedEvents: [
        "onSelectionChange",
        "onOpenChange",
        "onFocus",
        "onBlur",
        "onKeyDown",
        "onKeyUp",
      ],
    },
  },
  {
    type: "Switch",
    label: "Switch",
    category: "Forms",
    icon: "🎚️",
    inspector: {
      hasCustomEditor: false,
      dataBindingType: "value",
      // React Aria: onChange, onFocus, onBlur, onFocusChange, onKeyDown, onKeyUp, onHoverStart, onHoverEnd
      supportedEvents: [
        "onChange",
        "onFocus",
        "onBlur",
        "onKeyDown",
        "onKeyUp",
        "onMouseEnter",
        "onMouseLeave",
      ],
    },
  },
  {
    type: "Slider",
    label: "Slider",
    category: "Forms",
    icon: "🎚️",
    inspector: {
      hasCustomEditor: false,
      dataBindingType: "value",
      // React Aria: onChange, onChangeEnd, onFocus, onBlur, onFocusChange, onKeyDown, onKeyUp, onHoverStart, onHoverEnd
      supportedEvents: [
        "onChange",
        "onChangeEnd",
        "onFocus",
        "onBlur",
        "onKeyDown",
        "onKeyUp",
        "onMouseEnter",
        "onMouseLeave",
      ],
    },
  },
  {
    type: "TailSwatch",
    label: "Color Picker",
    category: "Forms",
    icon: "🎨",
    inspector: {
      hasCustomEditor: false,
      dataBindingType: "value",
      // Custom component: onChange, onFocus, onBlur
      supportedEvents: ["onChange", "onFocus", "onBlur"],
    },
  },
  {
    type: "FileTrigger",
    label: "File Trigger",
    category: "Forms",
    icon: "📁",
    inspector: {
      hasCustomEditor: false,
      dataBindingType: null,
      // React Aria: onSelect
      supportedEvents: ["onSelect"],
    },
  },
  {
    type: "DropZone",
    label: "Drop Zone",
    category: "Forms",
    icon: "📥",
    inspector: {
      hasCustomEditor: false,
      dataBindingType: null,
      // React Aria: onDrop, onDropEnter, onDropExit
      supportedEvents: ["onDrop", "onDropEnter", "onDropExit"],
    },
  },
  {
    type: "ColorPicker",
    label: "Color Picker",
    category: "Color",
    icon: "🎨",
    inspector: {
      hasCustomEditor: false,
      dataBindingType: "value",
      // React Aria: onChange, onFocus, onBlur
      supportedEvents: ["onChange", "onFocus", "onBlur"],
    },
  },
  {
    type: "ColorField",
    label: "Color Field",
    category: "Color",
    icon: "🎨",
    inspector: {
      hasCustomEditor: false,
      dataBindingType: "value",
      // React Aria: onChange, onFocus, onBlur
      supportedEvents: ["onChange", "onFocus", "onBlur"],
    },
  },
  {
    type: "ColorArea",
    label: "Color Area",
    category: "Color",
    icon: "🎨",
    inspector: {
      hasCustomEditor: false,
      dataBindingType: "value",
      // React Aria: onChange, onChangeEnd, onFocus, onBlur
      supportedEvents: ["onChange", "onChangeEnd", "onFocus", "onBlur"],
    },
  },
  {
    type: "ColorSlider",
    label: "Color Slider",
    category: "Color",
    icon: "🎨",
    inspector: {
      hasCustomEditor: false,
      dataBindingType: "value",
      // React Aria: onChange, onChangeEnd, onFocus, onBlur
      supportedEvents: ["onChange", "onChangeEnd", "onFocus", "onBlur"],
    },
  },
  {
    type: "ColorWheel",
    label: "Color Wheel",
    category: "Color",
    icon: "🎨",
    inspector: {
      hasCustomEditor: false,
      dataBindingType: "value",
      // React Aria: onChange, onChangeEnd, onFocus, onBlur
      supportedEvents: ["onChange", "onChangeEnd", "onFocus", "onBlur"],
    },
  },
  {
    type: "ColorSwatch",
    label: "Color Swatch",
    category: "Color",
    icon: "🎨",
    inspector: {
      hasCustomEditor: false,
      dataBindingType: null,
      supportedEvents: [],
    },
  },
  {
    type: "ColorSwatchPicker",
    label: "Color Swatch Picker",
    category: "Color",
    icon: "🎨",
    inspector: {
      hasCustomEditor: false,
      dataBindingType: "collection",
      // React Aria: onChange, onFocus, onBlur
      supportedEvents: ["onChange", "onFocus", "onBlur"],
    },
  },

  // Collections
  {
    type: "Table",
    label: "Table",
    category: "Collections",
    icon: "📊",
    inspector: {
      hasCustomEditor: true,
      editorName: "TableEditor",
      dataBindingType: "collection",
      // React Aria: onRowAction, onSelectionChange, onSortChange, onFocus, onBlur
      supportedEvents: ["onSelectionChange", "onAction", "onFocus", "onBlur"],
    },
  },
  {
    type: "ListBox",
    label: "List Box",
    category: "Collections",
    icon: "📋",
    inspector: {
      // ADR-076 P6: 실제 로드 경로는 `registry.ts.getCustomPreEditor("ListBox")`
      // pre-generic hook. 본 필드는 보조적 일관성 기록 — `hasCustomEditor: true` 는
      // spec-first early return 우회를 의미하지 않으므로 그대로 false 유지.
      hasCustomEditor: false,
      editorName: "ListBoxPropertyEditor",
      dataBindingType: "collection",
      // React Aria: onSelectionChange, onAction, onFocus, onBlur, onFocusChange
      supportedEvents: ["onSelectionChange", "onAction", "onFocus", "onBlur"],
    },
  },
  {
    type: "GridList",
    label: "Grid List",
    category: "Collections",
    icon: "🎛️",
    inspector: {
      hasCustomEditor: false,
      dataBindingType: "collection",
      // React Aria: onSelectionChange, onAction, onFocus, onBlur
      supportedEvents: ["onSelectionChange", "onAction", "onFocus", "onBlur"],
    },
  },
  {
    type: "Tree",
    label: "Tree",
    category: "Collections",
    icon: "🌳",
    inspector: {
      hasCustomEditor: false,
      dataBindingType: "collection",
      // React Aria: onSelectionChange, onExpandedChange, onFocus, onBlur
      supportedEvents: [
        "onSelectionChange",
        "onExpandedChange",
        "onFocus",
        "onBlur",
      ],
    },
  },
  {
    type: "TagGroup",
    label: "Tag Group",
    category: "Collections",
    icon: "🏷️",
    inspector: {
      hasCustomEditor: false,
      dataBindingType: "collection",
      // React Aria: onRemove, onSelectionChange, onFocus, onBlur
      supportedEvents: ["onSelectionChange", "onRemove", "onFocus", "onBlur"],
    },
  },

  // Content
  {
    type: "Tooltip",
    label: "Tooltip",
    category: "Overlays",
    icon: "💬",
    inspector: {
      hasCustomEditor: false,
      dataBindingType: null,
      // React Aria: onOpenChange (tooltip trigger)
      supportedEvents: ["onOpenChange", "onMouseEnter", "onMouseLeave"],
    },
  },
  {
    type: "ProgressBar",
    label: "Progress Bar",
    category: "Content",
    icon: "📊",
    inspector: {
      hasCustomEditor: false,
      dataBindingType: "value",
      supportedEvents: [],
    },
  },
  {
    type: "Meter",
    label: "Meter",
    category: "Content",
    icon: "📏",
    inspector: {
      hasCustomEditor: false,
      dataBindingType: "value",
      supportedEvents: [],
    },
  },
  {
    type: "Badge",
    label: "Badge",
    category: "Content",
    icon: "🏷️",
    inspector: {
      hasCustomEditor: false,
      dataBindingType: null,
      supportedEvents: [],
    },
  },
  {
    type: "Icon",
    label: "Icon",
    category: "Content",
    icon: "🎨",
    inspector: {
      hasCustomEditor: false,
      dataBindingType: null,
      supportedEvents: [],
    },
  },
  {
    type: "Toast",
    label: "Toast",
    category: "Content",
    icon: "🔔",
    inspector: {
      hasCustomEditor: false,
      dataBindingType: null,
      // React Aria: onClose
      supportedEvents: ["onClose"],
    },
  },

  // Layout
  {
    type: "Card",
    label: "Card",
    category: "Layout",
    icon: "🃏",
    inspector: {
      hasCustomEditor: false,
      dataBindingType: null,
      // Custom container - supports basic mouse events
      supportedEvents: [
        "onClick",
        "onMouseEnter",
        "onMouseLeave",
        "onFocus",
        "onBlur",
      ],
    },
  },
  {
    type: "Tabs",
    label: "Tabs",
    category: "Layout",
    icon: "📑",
    inspector: {
      hasCustomEditor: true,
      editorName: "TabsEditor",
      dataBindingType: null,
      // React Aria: onSelectionChange
      supportedEvents: ["onSelectionChange", "onFocus", "onBlur"],
    },
  },
  {
    type: "Breadcrumbs",
    label: "Breadcrumbs",
    category: "Layout",
    icon: "🗂️",
    inspector: {
      hasCustomEditor: false,
      dataBindingType: null,
      // React Aria: onAction, onFocus, onBlur
      supportedEvents: ["onAction", "onFocus", "onBlur"],
    },
  },
  {
    type: "Separator",
    label: "Separator",
    category: "Content",
    icon: "➖",
    inspector: {
      hasCustomEditor: false,
      dataBindingType: null,
      // Static element - no events
      supportedEvents: [],
    },
  },
  {
    type: "Group",
    label: "Group",
    category: "Layout",
    icon: "📦",
    inspector: {
      hasCustomEditor: false,
      dataBindingType: null,
      // React Aria: onFocus, onBlur (for keyboard navigation)
      supportedEvents: ["onFocus", "onBlur"],
    },
  },
  {
    type: "Form",
    label: "Form",
    category: "Forms",
    icon: "📝",
    inspector: {
      hasCustomEditor: false,
      dataBindingType: null,
      // React Aria: onSubmit, onReset, onInvalid
      supportedEvents: ["onSubmit", "onReset", "onInvalid"],
    },
  },
  {
    type: "Disclosure",
    label: "Disclosure",
    category: "Layout",
    icon: "📂",
    inspector: {
      hasCustomEditor: false,
      dataBindingType: null,
      // React Aria: onExpandedChange, onFocus, onBlur
      supportedEvents: ["onExpandedChange", "onFocus", "onBlur"],
    },
  },
  {
    type: "DisclosureGroup",
    label: "Disclosure Group",
    category: "Layout",
    icon: "📂",
    inspector: {
      hasCustomEditor: false,
      dataBindingType: null,
      // React Aria: onExpandedChange
      supportedEvents: ["onExpandedChange"],
    },
  },
  {
    type: "body",
    label: "Body",
    category: "Layout",
    icon: "📄",
    inspector: {
      hasCustomEditor: true,
      // ⭐ Phase 6: editorName은 registry.ts에서 context 기반으로 결정
      // - Page body → PageBodyEditor
      // - Layout body → LayoutBodyEditor
      editorName: undefined,
      dataBindingType: null,
      supportedEvents: [],
    },
  },
  {
    type: "Nav",
    label: "Nav",
    category: "Layout",
    icon: "🧭",
    inspector: {
      hasCustomEditor: false,
      dataBindingType: null,
      // nav 태그: 내비게이션 링크 컨테이너 (접근성 landmark)
      supportedEvents: [
        "onClick",
        "onMouseEnter",
        "onMouseLeave",
        "onFocus",
        "onBlur",
      ],
    },
  },
  {
    type: "Slot",
    label: "Slot",
    category: "Layout",
    icon: "🔲",
    inspector: {
      hasCustomEditor: false,
      dataBindingType: null,
      supportedEvents: [],
    },
  },

  // Overlays
  {
    type: "Dialog",
    label: "Dialog",
    category: "Overlays",
    icon: "💬",
    inspector: {
      hasCustomEditor: false,
      dataBindingType: null,
      // React Aria: onOpenChange, onFocus, onBlur
      supportedEvents: ["onOpenChange", "onFocus", "onBlur"],
    },
  },
  {
    type: "Modal",
    label: "Modal",
    category: "Overlays",
    icon: "🪟",
    inspector: {
      hasCustomEditor: false,
      dataBindingType: null,
      // React Aria: onOpenChange
      supportedEvents: ["onOpenChange"],
    },
  },
  {
    type: "Popover",
    label: "Popover",
    category: "Overlays",
    icon: "💭",
    inspector: {
      hasCustomEditor: false,
      dataBindingType: null,
      // React Aria: onOpenChange
      supportedEvents: ["onOpenChange"],
    },
  },

  // Date & Time
  {
    type: "Calendar",
    label: "Calendar",
    category: "Date & Time",
    icon: "📅",
    inspector: {
      hasCustomEditor: false,
      dataBindingType: "value",
      // React Aria: onChange, onFocusChange, onFocus, onBlur
      supportedEvents: ["onChange", "onFocus", "onBlur"],
    },
  },
  {
    type: "DatePicker",
    label: "Date Picker",
    category: "Date & Time",
    icon: "📅",
    inspector: {
      hasCustomEditor: false,
      dataBindingType: "value",
      // React Aria: onChange, onOpenChange, onFocus, onBlur
      supportedEvents: ["onChange", "onOpenChange", "onFocus", "onBlur"],
    },
  },
  {
    type: "DateRangePicker",
    label: "Date Range Picker",
    category: "Date & Time",
    icon: "📅",
    inspector: {
      hasCustomEditor: false,
      dataBindingType: "value",
      // React Aria: onChange, onOpenChange, onFocus, onBlur
      supportedEvents: ["onChange", "onOpenChange", "onFocus", "onBlur"],
    },
  },
  {
    type: "TimeField",
    label: "Time Field",
    category: "Date & Time",
    icon: "🕐",
    inspector: {
      hasCustomEditor: false,
      dataBindingType: "value",
      // React Aria: onChange, onFocus, onBlur, onFocusChange
      supportedEvents: ["onChange", "onFocus", "onBlur"],
    },
  },
  {
    type: "DateField",
    label: "Date Field",
    category: "Date & Time",
    icon: "📅",
    inspector: {
      hasCustomEditor: false,
      dataBindingType: "value",
      // React Aria: onChange, onFocus, onBlur, onFocusChange
      supportedEvents: ["onChange", "onFocus", "onBlur"],
    },
  },
  {
    type: "RangeCalendar",
    label: "Range Calendar",
    category: "Date & Time",
    icon: "📅",
    inspector: {
      hasCustomEditor: false,
      dataBindingType: "value",
      // React Aria: onChange, onFocusChange, onFocus, onBlur
      supportedEvents: ["onChange", "onFocus", "onBlur"],
    },
  },

  // Item Components (Collection children)
  {
    type: "MenuItem",
    label: "Menu Item",
    category: "Items",
    icon: "•",
    inspector: {
      // ADR-068 P6: MenuItem는 이제 Menu.spec.ts items-manager 필드로 관리됨
      // MenuItemEditor 폐기 — 개별 요소 inspector 불필요
      hasCustomEditor: false,
      dataBindingType: null,
      // React Aria: onAction, onHoverStart, onHoverEnd, onPress
      supportedEvents: ["onAction", "onMouseEnter", "onMouseLeave"],
    },
  },
  // ADR-073 P6: SelectItem/ComboBoxItem entry 제거 — Select/ComboBox.props.items SSOT로 이관.
  // 개별 요소 inspector 불필요 (ItemsManager가 items[] 편집 담당).
  {
    type: "ListBoxItem",
    label: "ListBox Item",
    category: "Items",
    icon: "",
    inspector: {
      hasCustomEditor: true,
      editorName: "ListBoxItemEditor",
      dataBindingType: null,
      // React Aria: onAction, onHoverStart, onHoverEnd, onPress
      supportedEvents: ["onAction", "onMouseEnter", "onMouseLeave"],
    },
  },
  {
    type: "GridListItem",
    label: "GridList Item",
    category: "Items",
    icon: "",
    inspector: {
      hasCustomEditor: true,
      editorName: "GridListItemEditor",
      dataBindingType: null,
      // React Aria: onAction, onHoverStart, onHoverEnd, onPress
      supportedEvents: ["onAction", "onMouseEnter", "onMouseLeave"],
    },
  },
  {
    type: "TreeItem",
    label: "Tree Item",
    category: "Items",
    icon: "",
    inspector: {
      hasCustomEditor: true,
      editorName: "TreeItemEditor",
      dataBindingType: null,
      // React Aria: onAction, onHoverStart, onHoverEnd
      supportedEvents: ["onAction", "onMouseEnter", "onMouseLeave"],
    },
  },
  {
    type: "Tag",
    label: "Tag",
    category: "Items",
    icon: "",
    inspector: {
      hasCustomEditor: true,
      editorName: "TagEditor",
      dataBindingType: null,
      // React Aria: onHoverStart, onHoverEnd
      supportedEvents: ["onMouseEnter", "onMouseLeave"],
    },
  },
  {
    type: "Breadcrumb",
    label: "Breadcrumb",
    category: "Items",
    icon: "•",
    inspector: {
      hasCustomEditor: true,
      editorName: "BreadcrumbEditor",
      dataBindingType: null,
      // React Aria: onPress, onHoverStart, onHoverEnd
      supportedEvents: ["onClick", "onMouseEnter", "onMouseLeave"],
    },
  },

  // Table Components
  {
    type: "TableHeader",
    label: "Table Header",
    category: "Table Parts",
    icon: "",
    inspector: {
      hasCustomEditor: true,
      editorName: "TableHeaderEditor",
      dataBindingType: null,
      supportedEvents: [],
    },
  },
  {
    type: "TableBody",
    label: "Table Body",
    category: "Table Parts",
    icon: "",
    inspector: {
      hasCustomEditor: true,
      editorName: "TableBodyEditor",
      dataBindingType: null,
      supportedEvents: [],
    },
  },
  {
    type: "Column",
    label: "Column",
    category: "Table Parts",
    icon: "",
    inspector: {
      hasCustomEditor: true,
      editorName: "ColumnEditor",
      dataBindingType: null,
      supportedEvents: [],
    },
  },
  {
    type: "ColumnGroup",
    label: "Column Group",
    category: "Table Parts",
    icon: "",
    inspector: {
      hasCustomEditor: true,
      editorName: "ColumnGroupEditor",
      dataBindingType: null,
      supportedEvents: [],
    },
  },
  {
    type: "Row",
    label: "Row",
    category: "Table Parts",
    icon: "",
    inspector: {
      hasCustomEditor: true,
      editorName: "RowEditor",
      dataBindingType: null,
      // React Aria: onAction, onHoverStart, onHoverEnd, onPress
      supportedEvents: ["onAction", "onMouseEnter", "onMouseLeave"],
    },
  },
  {
    type: "Cell",
    label: "Cell",
    category: "Table Parts",
    icon: "",
    inspector: {
      hasCustomEditor: true,
      editorName: "CellEditor",
      dataBindingType: null,
      supportedEvents: [],
    },
  },
  {
    type: "Field",
    label: "Field",
    category: "Collections",
    icon: "",
    inspector: {
      hasCustomEditor: false,
      dataBindingType: null,
      supportedEvents: [],
    },
  },

  // Phase 1: Display/Feedback (ADR-030)
  {
    type: "Avatar",
    label: "Avatar",
    category: "Content",
    icon: "",
    inspector: {
      hasCustomEditor: false,
      dataBindingType: null,
      supportedEvents: [],
    },
  },
  {
    type: "AvatarGroup",
    label: "Avatar Group",
    category: "Content",
    icon: "",
    inspector: {
      hasCustomEditor: false,
      dataBindingType: null,
      supportedEvents: [],
    },
  },
  {
    type: "StatusLight",
    label: "Status Light",
    category: "Content",
    icon: "",
    inspector: {
      hasCustomEditor: false,
      dataBindingType: null,
      supportedEvents: [],
    },
  },
  {
    type: "InlineAlert",
    label: "Inline Alert",
    category: "Content",
    icon: "",
    inspector: {
      hasCustomEditor: false,
      dataBindingType: null,
      supportedEvents: [],
    },
  },

  // Phase 2: Action/Group (ADR-030)
  {
    type: "ButtonGroup",
    label: "Button Group",
    category: "Buttons",
    icon: "",
    inspector: {
      hasCustomEditor: false,
      dataBindingType: null,
      supportedEvents: [],
    },
  },
  {
    type: "Accordion",
    label: "Accordion",
    category: "Layout",
    icon: "",
    inspector: {
      hasCustomEditor: false,
      dataBindingType: null,
      // React Aria: onExpandedChange
      supportedEvents: ["onExpandedChange"],
    },
  },

  // Phase 3: Extended Controls (ADR-030)
  {
    type: "ProgressCircle",
    label: "Progress Circle",
    category: "Content",
    icon: "",
    inspector: {
      hasCustomEditor: false,
      dataBindingType: null,
      supportedEvents: [],
    },
  },
  {
    type: "Image",
    label: "Image",
    category: "Content",
    icon: "",
    inspector: {
      hasCustomEditor: false,
      dataBindingType: null,
      supportedEvents: ["onLoad", "onError"],
    },
  },

  // Phase 4: Advanced Components (ADR-030)
  {
    type: "IllustratedMessage",
    label: "Illustrated Message",
    category: "Content",
    icon: "",
    inspector: {
      hasCustomEditor: false,
      dataBindingType: null,
      supportedEvents: [],
    },
  },
  {
    type: "CardView",
    label: "Card View",
    category: "Collections",
    icon: "",
    inspector: {
      hasCustomEditor: false,
      dataBindingType: null,
      supportedEvents: ["onSelectionChange", "onAction"],
    },
  },
  {
    type: "TableView",
    label: "Table View",
    category: "Collections",
    icon: "",
    inspector: {
      hasCustomEditor: false,
      dataBindingType: null,
      supportedEvents: ["onSelectionChange", "onSortChange", "onAction"],
    },
  },

  // Collections (Data)
  {
    type: "DataTable",
    label: "DataTable",
    category: "Collections",
    icon: "📊",
    inspector: {
      hasCustomEditor: true,
      editorName: "DataTableEditor",
      dataBindingType: "collection",
      supportedEvents: ["onLoad", "onError", "onRefresh"],
    },
  },
];

/**
 * 컴포넌트 메타데이터 조회
 */
export function getComponentMeta(type: string): ComponentMeta | undefined {
  return componentMetadata.find((c) => c.type === type);
}

/**
 * 카테고리별 컴포넌트 목록
 */
export function getComponentsByCategory(category: string): ComponentMeta[] {
  return componentMetadata.filter((c) => c.category === category);
}

/**
 * 모든 카테고리 목록
 */
export function getAllCategories(): string[] {
  const categories = new Set(componentMetadata.map((c) => c.category));
  return Array.from(categories);
}
