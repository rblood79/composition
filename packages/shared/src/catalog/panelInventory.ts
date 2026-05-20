import type { ComponentTag } from "../types/composition-vocabulary";

export type ComponentPanelCategory =
  | "content"
  | "layout"
  | "buttons"
  | "forms"
  | "collections"
  | "dateTime"
  | "overlays";

export interface ComponentPanelCategoryMeta {
  label: string;
  description: string;
}

export interface ComponentPanelInventoryEntry {
  type: ComponentTag;
  label: string;
  icon: string;
  category: ComponentPanelCategory;
  layoutOnly?: boolean;
}

export const componentPanelCategoryConfig = {
  content: { label: "Content", description: "Display and indicators" },
  layout: { label: "Layout", description: "Containers and navigation" },
  buttons: { label: "Buttons", description: "Actions and triggers" },
  forms: { label: "Forms", description: "Inputs and controls" },
  collections: { label: "Collections", description: "Lists and data display" },
  dateTime: { label: "Date & Time", description: "Date and time pickers" },
  overlays: { label: "Overlays", description: "Dialogs and popups" },
} as const satisfies Record<ComponentPanelCategory, ComponentPanelCategoryMeta>;

export const componentPanelInventory = [
  { type: "Text", label: "text", icon: "Text", category: "content" },
  { type: "Icon", label: "icon", icon: "Smile", category: "content" },
  {
    type: "Separator",
    label: "separator",
    icon: "SeparatorHorizontal",
    category: "content",
  },
  { type: "Badge", label: "badge", icon: "Star", category: "content" },
  {
    type: "ProgressBar",
    label: "progress bar",
    icon: "BarChart3",
    category: "content",
  },
  { type: "Skeleton", label: "skeleton", icon: "Loader", category: "content" },
  {
    type: "Avatar",
    label: "avatar",
    icon: "CircleUser",
    category: "content",
  },
  {
    type: "AvatarGroup",
    label: "avatar group",
    icon: "Users",
    category: "content",
  },
  {
    type: "StatusLight",
    label: "status light",
    icon: "CircleDot",
    category: "content",
  },
  {
    type: "InlineAlert",
    label: "inline alert",
    icon: "AlertTriangle",
    category: "content",
  },
  {
    type: "ProgressCircle",
    label: "progress circle",
    icon: "CircleDashed",
    category: "content",
  },
  { type: "Image", label: "image", icon: "ImageIcon", category: "content" },
  {
    type: "IllustratedMessage",
    label: "illustrated message",
    icon: "ImageIcon",
    category: "content",
  },
  { type: "Card", label: "card", icon: "AppWindowMac", category: "layout" },
  { type: "frame", label: "frame", icon: "GroupIcon", category: "layout" },
  { type: "Tabs", label: "tabs", icon: "AppWindow", category: "layout" },
  {
    type: "Breadcrumbs",
    label: "breadcrumbs",
    icon: "ChevronRight",
    category: "layout",
  },
  { type: "Link", label: "link", icon: "Link", category: "layout" },
  { type: "Nav", label: "navigation", icon: "Menu", category: "layout" },
  {
    type: "MaskedFrame",
    label: "masked frame",
    icon: "Frame",
    category: "layout",
  },
  {
    type: "Accordion",
    label: "accordion",
    icon: "ChevronDown",
    category: "layout",
  },
  {
    type: "Disclosure",
    label: "disclosure",
    icon: "ChevronDown",
    category: "layout",
  },
  { type: "CardView", label: "card view", icon: "Grid", category: "layout" },
  {
    type: "Slot",
    label: "slot",
    icon: "Layers",
    category: "layout",
    layoutOnly: true,
  },
  {
    type: "Button",
    label: "button",
    icon: "MousePointer",
    category: "buttons",
  },
  {
    type: "ToggleButton",
    label: "toggle button",
    icon: "ToggleLeft",
    category: "buttons",
  },
  {
    type: "ToggleButtonGroup",
    label: "toggle button group",
    icon: "GroupIcon",
    category: "buttons",
  },
  {
    type: "Toolbar",
    label: "toolbar",
    icon: "Settings",
    category: "buttons",
  },
  {
    type: "ButtonGroup",
    label: "button group",
    icon: "GroupIcon",
    category: "buttons",
  },
  { type: "Menu", label: "menu", icon: "Menu", category: "buttons" },
  {
    type: "TextField",
    label: "text field",
    icon: "RectangleEllipsis",
    category: "forms",
  },
  {
    type: "NumberField",
    label: "number field",
    icon: "Hash",
    category: "forms",
  },
  {
    type: "SearchField",
    label: "search field",
    icon: "Search",
    category: "forms",
  },
  {
    type: "Checkbox",
    label: "checkbox",
    icon: "SquareCheck",
    category: "forms",
  },
  {
    type: "CheckboxGroup",
    label: "checkbox group",
    icon: "GroupIcon",
    category: "forms",
  },
  {
    type: "RadioGroup",
    label: "radio group",
    icon: "GroupIcon",
    category: "forms",
  },
  { type: "Select", label: "select", icon: "ChevronDown", category: "forms" },
  {
    type: "ComboBox",
    label: "combo box",
    icon: "ChevronDown",
    category: "forms",
  },
  { type: "Switch", label: "switch", icon: "ToggleRight", category: "forms" },
  {
    type: "Slider",
    label: "slider",
    icon: "SlidersHorizontal",
    category: "forms",
  },
  {
    type: "TailSwatch",
    label: "color picker",
    icon: "Paintbrush",
    category: "forms",
  },
  { type: "DropZone", label: "drop zone", icon: "Upload", category: "forms" },
  {
    type: "FileTrigger",
    label: "file trigger",
    icon: "FileUp",
    category: "forms",
  },
  { type: "Form", label: "form", icon: "GroupIcon", category: "forms" },
  {
    type: "Table",
    label: "table",
    icon: "TableProperties",
    category: "collections",
  },
  {
    type: "ListBox",
    label: "list box",
    icon: "ListIcon",
    category: "collections",
  },
  {
    type: "GridList",
    label: "grid list",
    icon: "Grid",
    category: "collections",
  },
  {
    type: "Tree",
    label: "tree",
    icon: "ListTree",
    category: "collections",
  },
  {
    type: "TagGroup",
    label: "type group",
    icon: "Tag",
    category: "collections",
  },
  {
    type: "Section",
    label: "section",
    icon: "Square",
    category: "collections",
  },
  {
    type: "TableView",
    label: "table view",
    icon: "TableProperties",
    category: "collections",
  },
  {
    type: "Calendar",
    label: "calendar",
    icon: "Calendar",
    category: "dateTime",
  },
  {
    type: "DatePicker",
    label: "date picker",
    icon: "CalendarCheck",
    category: "dateTime",
  },
  {
    type: "DateRangePicker",
    label: "date range picker",
    icon: "CalendarDays",
    category: "dateTime",
  },
  {
    type: "DateField",
    label: "date field",
    icon: "CalendarCheck",
    category: "dateTime",
  },
  {
    type: "TimeField",
    label: "time field",
    icon: "ChevronDown",
    category: "dateTime",
  },
  {
    type: "RangeCalendar",
    label: "range calendar",
    icon: "CalendarDays",
    category: "dateTime",
  },
  {
    type: "Dialog",
    label: "dialog",
    icon: "AppWindowMac",
    category: "overlays",
  },
  {
    type: "Modal",
    label: "modal",
    icon: "InspectionPanel",
    category: "overlays",
  },
  {
    type: "Popover",
    label: "popover",
    icon: "AppWindowMac",
    category: "overlays",
  },
  {
    type: "Tooltip",
    label: "tooltip",
    icon: "MessageSquare",
    category: "overlays",
  },
] as const satisfies readonly ComponentPanelInventoryEntry[];

export function listComponentPanelInventoryEntries({
  includeLayoutOnly = false,
}: {
  includeLayoutOnly?: boolean;
} = {}): ComponentPanelInventoryEntry[] {
  return componentPanelInventory.filter(
    (entry) =>
      includeLayoutOnly || !("layoutOnly" in entry && entry.layoutOnly),
  );
}
