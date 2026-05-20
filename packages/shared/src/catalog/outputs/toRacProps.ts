import type {
  ButtonFillStyle,
  ButtonVariant,
  ComponentSizeSubset,
  ComponentSize,
  LinkVariant,
  SeparatorVariant,
  StaticColor,
} from "../../types/componentVariants.types";

export const BREADCRUMBS_SIZE_VALUES = ["S", "M", "L"] as const;
export const BUTTON_VARIANT_VALUES = [
  "accent",
  "primary",
  "secondary",
  "negative",
  "premium",
  "genai",
  "ghost",
] as const satisfies readonly ButtonVariant[];

export const BUTTON_FILL_STYLE_VALUES = [
  "fill",
  "outline",
] as const satisfies readonly ButtonFillStyle[];

export const BUTTON_SIZE_VALUES = [
  "xs",
  "sm",
  "md",
  "lg",
  "xl",
] as const satisfies readonly ComponentSize[];

export const BUTTON_TYPE_VALUES = ["button", "submit", "reset"] as const;
export const BUTTON_ICON_POSITION_VALUES = ["start", "end"] as const;
export const TEXT_FIELD_TYPE_VALUES = [
  "text",
  "email",
  "password",
  "search",
  "tel",
  "url",
  "number",
] as const;
export const TEXT_FIELD_LABEL_POSITION_VALUES = ["top", "side"] as const;
export const TEXT_FIELD_NECESSITY_INDICATOR_VALUES = ["icon", "label"] as const;
export const SEARCH_FIELD_TYPE_VALUES = [
  "search",
  "text",
  "url",
  "tel",
  "email",
] as const;
export const SEARCH_FIELD_INPUT_MODE_VALUES = [
  "none",
  "text",
  "tel",
  "url",
  "email",
  "numeric",
  "decimal",
  "search",
] as const;
export const SEARCH_FIELD_ENTER_KEY_HINT_VALUES = [
  "enter",
  "done",
  "go",
  "next",
  "previous",
  "search",
  "send",
] as const;
export const DATE_FIELD_GRANULARITY_VALUES = [
  "day",
  "hour",
  "minute",
  "second",
] as const;
export const DATE_FIELD_HOUR_CYCLE_VALUES = ["12", "24"] as const;
export const TIME_FIELD_GRANULARITY_VALUES = [
  "hour",
  "minute",
  "second",
] as const;
export const TIME_FIELD_HOUR_CYCLE_VALUES = DATE_FIELD_HOUR_CYCLE_VALUES;
export const COLOR_FIELD_CHANNEL_VALUES = [
  "hue",
  "saturation",
  "lightness",
  "brightness",
  "red",
  "green",
  "blue",
  "alpha",
] as const;
export const COLOR_FIELD_COLOR_SPACE_VALUES = ["rgb", "hsl", "hsb"] as const;
export const COLOR_FIELD_LABEL_ALIGN_VALUES = [
  "start",
  "center",
  "end",
] as const;
export const FORM_VARIANT_VALUES = ["default", "outlined"] as const;
export const FORM_METHOD_VALUES = ["get", "post"] as const;
export const FORM_ENCTYPE_VALUES = [
  "application/x-www-form-urlencoded",
  "multipart/form-data",
  "text/plain",
] as const;
export const FORM_TARGET_VALUES = [
  "_self",
  "_blank",
  "_parent",
  "_top",
] as const;
export const FORM_VALIDATION_BEHAVIOR_VALUES = ["native", "aria"] as const;
export const FILE_TRIGGER_DEFAULT_CAMERA_VALUES = [
  "user",
  "environment",
] as const;
export const DATE_FIELD_CALENDAR_VALUES = [
  "gregory",
  "buddhist",
  "japanese",
  "islamic-umalqura",
] as const;
export const NUMBER_FIELD_FORMAT_STYLE_VALUES = [
  "decimal",
  "currency",
  "percent",
  "unit",
] as const;
export const NUMBER_FIELD_NOTATION_VALUES = [
  "standard",
  "scientific",
  "engineering",
  "compact",
] as const;
export const SEPARATOR_ORIENTATION_VALUES = ["horizontal", "vertical"] as const;
export const SEPARATOR_VARIANT_VALUES = [
  "default",
  "solid",
  "dashed",
  "dotted",
] as const satisfies readonly SeparatorVariant[];
export const SEPARATOR_SIZE_VALUES = [
  "sm",
  "md",
  "lg",
] as const satisfies readonly ComponentSizeSubset[];
export const DROP_ZONE_SIZE_VALUES = SEPARATOR_SIZE_VALUES;
export const LINK_VARIANT_VALUES = [
  "primary",
  "secondary",
] as const satisfies readonly LinkVariant[];
export const LINK_SIZE_VALUES = BUTTON_SIZE_VALUES;
export const LINK_STATIC_COLOR_VALUES = [
  "auto",
  "black",
  "white",
] as const satisfies readonly StaticColor[];
export const LINK_TARGET_VALUES = [
  "_self",
  "_blank",
  "_parent",
  "_top",
] as const;
export const TOGGLE_BUTTON_SIZE_VALUES = SEPARATOR_SIZE_VALUES;
export const TOGGLE_BUTTON_GROUP_SIZE_VALUES = TOGGLE_BUTTON_SIZE_VALUES;
export const TOGGLE_BUTTON_GROUP_ORIENTATION_VALUES = [
  "horizontal",
  "vertical",
] as const;
export const TOGGLE_BUTTON_GROUP_SELECTION_MODE_VALUES = [
  "single",
  "multiple",
] as const;
export const TOOLBAR_ORIENTATION_VALUES = SEPARATOR_ORIENTATION_VALUES;
export const TOOLBAR_SIZE_VALUES = SEPARATOR_SIZE_VALUES;
export const TOOLBAR_VARIANT_VALUES = ["default", "accent"] as const;
export const CHECKBOX_SIZE_VALUES = SEPARATOR_SIZE_VALUES;
export const CHECKBOX_GROUP_SIZE_VALUES = SEPARATOR_SIZE_VALUES;
export const CHECKBOX_GROUP_ORIENTATION_VALUES = SEPARATOR_ORIENTATION_VALUES;
export const CHECKBOX_GROUP_LABEL_POSITION_VALUES =
  TEXT_FIELD_LABEL_POSITION_VALUES;
export const CHECKBOX_GROUP_LABEL_ALIGN_VALUES = ["start", "end"] as const;
export const CHECKBOX_GROUP_NECESSITY_INDICATOR_VALUES =
  TEXT_FIELD_NECESSITY_INDICATOR_VALUES;
export const RADIO_VARIANT_VALUES = [
  "default",
  "accent",
  "neutral",
  "negative",
] as const;
export const RADIO_SIZE_VALUES = ["sm", "md", "lg", "xl"] as const;
export const RADIO_GROUP_VARIANT_VALUES = ["default", "accent"] as const;
export const RADIO_GROUP_SIZE_VALUES = RADIO_SIZE_VALUES;
export const RADIO_GROUP_ORIENTATION_VALUES = SEPARATOR_ORIENTATION_VALUES;
export const RADIO_GROUP_LABEL_POSITION_VALUES =
  TEXT_FIELD_LABEL_POSITION_VALUES;
export const RADIO_GROUP_LABEL_ALIGN_VALUES = ["start", "end"] as const;
export const RADIO_GROUP_NECESSITY_INDICATOR_VALUES =
  TEXT_FIELD_NECESSITY_INDICATOR_VALUES;
export const SLIDER_SIZE_VALUES = SEPARATOR_SIZE_VALUES;
export const SLIDER_ORIENTATION_VALUES = SEPARATOR_ORIENTATION_VALUES;
export const SWITCH_SIZE_VALUES = SEPARATOR_SIZE_VALUES;
export const LIST_BOX_VARIANT_VALUES = ["default", "accent"] as const;
const LIST_BOX_LEGACY_VISUAL_VARIANT_VALUES = [
  "primary",
  "secondary",
  "tertiary",
  "error",
  "filled",
] as const;
export const LIST_BOX_ORIENTATION_VALUES = SEPARATOR_ORIENTATION_VALUES;
export const LIST_BOX_SELECTION_MODE_VALUES = [
  "none",
  "single",
  "multiple",
] as const;
export const LIST_BOX_SELECTION_BEHAVIOR_VALUES = [
  "toggle",
  "replace",
] as const;
export const GRID_LIST_VARIANT_VALUES = LIST_BOX_VARIANT_VALUES;
const GRID_LIST_LEGACY_VISUAL_VARIANT_VALUES =
  LIST_BOX_LEGACY_VISUAL_VARIANT_VALUES;
export const GRID_LIST_LAYOUT_VALUES = ["stack", "grid"] as const;
export const GRID_LIST_SELECTION_MODE_VALUES = LIST_BOX_SELECTION_MODE_VALUES;
export const GRID_LIST_SELECTION_BEHAVIOR_VALUES =
  LIST_BOX_SELECTION_BEHAVIOR_VALUES;
export const GRID_LIST_VALIDATION_BEHAVIOR_VALUES = ["native", "aria"] as const;
export const TAG_GROUP_VARIANT_VALUES = [
  "default",
  "accent",
  "neutral",
  "negative",
] as const;
const TAG_GROUP_LEGACY_VISUAL_VARIANT_VALUES = [
  "primary",
  "secondary",
  "tertiary",
  "error",
  "surface",
] as const;
export const TAG_GROUP_SIZE_VALUES = ["sm", "md", "lg"] as const;
export const TAG_GROUP_SELECTION_MODE_VALUES = LIST_BOX_SELECTION_MODE_VALUES;
export const TAG_GROUP_SELECTION_BEHAVIOR_VALUES =
  LIST_BOX_SELECTION_BEHAVIOR_VALUES;
export const TAG_GROUP_LABEL_POSITION_VALUES = TEXT_FIELD_LABEL_POSITION_VALUES;
export const TAG_GROUP_LABEL_ALIGN_VALUES = ["start", "end"] as const;
export const MENU_VARIANT_VALUES = [
  "accent",
  "primary",
  "secondary",
  "negative",
  "premium",
  "genai",
] as const;
export const MENU_SIZE_VALUES = ["sm", "md", "lg", "xl"] as const;
export const MENU_ALIGN_VALUES = ["start", "end"] as const;
export const MENU_DIRECTION_VALUES = [
  "bottom",
  "top",
  "left",
  "right",
] as const;
export const MENU_SELECTION_MODE_VALUES = LIST_BOX_SELECTION_MODE_VALUES;
export const COMBO_BOX_SIZE_VALUES = BUTTON_SIZE_VALUES;
export const COMBO_BOX_LABEL_POSITION_VALUES = TEXT_FIELD_LABEL_POSITION_VALUES;
export const COMBO_BOX_NECESSITY_INDICATOR_VALUES =
  TEXT_FIELD_NECESSITY_INDICATOR_VALUES;
export const COMBO_BOX_MENU_TRIGGER_VALUES = [
  "focus",
  "input",
  "manual",
] as const;
export const COMBO_BOX_VALIDATION_BEHAVIOR_VALUES = ["native", "aria"] as const;
export const SELECT_SIZE_VALUES = BUTTON_SIZE_VALUES;
export const SELECT_LABEL_POSITION_VALUES = TEXT_FIELD_LABEL_POSITION_VALUES;
export const SELECT_LABEL_ALIGN_VALUES = ["start", "end"] as const;
export const SELECT_ALIGN_VALUES = ["start", "end"] as const;
export const SELECT_DIRECTION_VALUES = ["bottom", "top"] as const;
export const SELECT_NECESSITY_INDICATOR_VALUES =
  TEXT_FIELD_NECESSITY_INDICATOR_VALUES;
export const SELECT_VALIDATION_BEHAVIOR_VALUES = ["native", "aria"] as const;
export const TABS_DENSITY_VALUES = ["compact", "regular"] as const;
export const TABS_SIZE_VALUES = ["sm", "md", "lg"] as const;
export const TABS_ORIENTATION_VALUES = ["horizontal", "vertical"] as const;
export const TABS_KEYBOARD_ACTIVATION_VALUES = ["automatic", "manual"] as const;
export const TREE_VARIANT_VALUES = ["default", "accent"] as const;
export const TREE_SELECTION_MODE_VALUES = LIST_BOX_SELECTION_MODE_VALUES;
export const TREE_SELECTION_BEHAVIOR_VALUES =
  LIST_BOX_SELECTION_BEHAVIOR_VALUES;
export const TABLE_DENSITY_VALUES = ["compact", "regular", "spacious"] as const;
export const TABLE_SELECTION_MODE_VALUES = LIST_BOX_SELECTION_MODE_VALUES;
export const TABLE_SELECTION_BEHAVIOR_VALUES =
  LIST_BOX_SELECTION_BEHAVIOR_VALUES;
export const TABLE_SORT_DIRECTION_VALUES = ["ascending", "descending"] as const;

const BUTTON_VARIANTS = new Set<ButtonVariant>(BUTTON_VARIANT_VALUES);
const BUTTON_FILL_STYLES = new Set<ButtonFillStyle>(BUTTON_FILL_STYLE_VALUES);
const BUTTON_SIZES = new Set<ComponentSize>(BUTTON_SIZE_VALUES);
const BUTTON_TYPES = new Set<string>(BUTTON_TYPE_VALUES);
const BUTTON_ICON_POSITIONS = new Set<string>(BUTTON_ICON_POSITION_VALUES);
const TEXT_FIELD_TYPES = new Set<string>(TEXT_FIELD_TYPE_VALUES);
const TEXT_FIELD_LABEL_POSITIONS = new Set<string>(
  TEXT_FIELD_LABEL_POSITION_VALUES,
);
const TEXT_FIELD_NECESSITY_INDICATORS = new Set<string>(
  TEXT_FIELD_NECESSITY_INDICATOR_VALUES,
);
const SEARCH_FIELD_TYPES = new Set<string>(SEARCH_FIELD_TYPE_VALUES);
const SEARCH_FIELD_INPUT_MODES = new Set<string>(
  SEARCH_FIELD_INPUT_MODE_VALUES,
);
const SEARCH_FIELD_ENTER_KEY_HINTS = new Set<string>(
  SEARCH_FIELD_ENTER_KEY_HINT_VALUES,
);
const DATE_FIELD_GRANULARITIES = new Set<string>(DATE_FIELD_GRANULARITY_VALUES);
const DATE_FIELD_HOUR_CYCLES = new Set<string>(DATE_FIELD_HOUR_CYCLE_VALUES);
const TIME_FIELD_GRANULARITIES = new Set<string>(TIME_FIELD_GRANULARITY_VALUES);
const TIME_FIELD_HOUR_CYCLES = new Set<string>(TIME_FIELD_HOUR_CYCLE_VALUES);
const COLOR_FIELD_CHANNELS = new Set<string>(COLOR_FIELD_CHANNEL_VALUES);
const COLOR_FIELD_COLOR_SPACES = new Set<string>(
  COLOR_FIELD_COLOR_SPACE_VALUES,
);
const COLOR_FIELD_LABEL_ALIGNS = new Set<string>(
  COLOR_FIELD_LABEL_ALIGN_VALUES,
);
const FORM_VARIANTS = new Set<string>(FORM_VARIANT_VALUES);
const FORM_METHODS = new Set<string>(FORM_METHOD_VALUES);
const FORM_ENCTYPES = new Set<string>(FORM_ENCTYPE_VALUES);
const FORM_TARGETS = new Set<string>(FORM_TARGET_VALUES);
const FORM_VALIDATION_BEHAVIORS = new Set<string>(
  FORM_VALIDATION_BEHAVIOR_VALUES,
);
const FILE_TRIGGER_DEFAULT_CAMERAS = new Set<string>(
  FILE_TRIGGER_DEFAULT_CAMERA_VALUES,
);
const DATE_FIELD_CALENDARS = new Set<string>(DATE_FIELD_CALENDAR_VALUES);
const NUMBER_FIELD_FORMAT_STYLES = new Set<string>(
  NUMBER_FIELD_FORMAT_STYLE_VALUES,
);
const NUMBER_FIELD_NOTATIONS = new Set<string>(NUMBER_FIELD_NOTATION_VALUES);
const SEPARATOR_ORIENTATIONS = new Set<string>(SEPARATOR_ORIENTATION_VALUES);
const SEPARATOR_VARIANTS = new Set<SeparatorVariant>(SEPARATOR_VARIANT_VALUES);
const SEPARATOR_SIZES = new Set<ComponentSizeSubset>(SEPARATOR_SIZE_VALUES);
const DROP_ZONE_SIZES = SEPARATOR_SIZES;
const LINK_VARIANTS = new Set<LinkVariant>(LINK_VARIANT_VALUES);
const LINK_SIZES = new Set<ComponentSize>(LINK_SIZE_VALUES);
const LINK_STATIC_COLORS = new Set<StaticColor>(LINK_STATIC_COLOR_VALUES);
const LINK_TARGETS = new Set<string>(LINK_TARGET_VALUES);
const TOGGLE_BUTTON_SIZES = new Set<ComponentSizeSubset>(
  TOGGLE_BUTTON_SIZE_VALUES,
);
const TOGGLE_BUTTON_GROUP_SIZES = new Set<ComponentSizeSubset>(
  TOGGLE_BUTTON_GROUP_SIZE_VALUES,
);
const TOGGLE_BUTTON_GROUP_ORIENTATIONS = new Set<string>(
  TOGGLE_BUTTON_GROUP_ORIENTATION_VALUES,
);
const TOGGLE_BUTTON_GROUP_SELECTION_MODES = new Set<string>(
  TOGGLE_BUTTON_GROUP_SELECTION_MODE_VALUES,
);
const TOOLBAR_ORIENTATIONS = new Set<string>(TOOLBAR_ORIENTATION_VALUES);
const TOOLBAR_SIZES = new Set<ComponentSizeSubset>(TOOLBAR_SIZE_VALUES);
const TOOLBAR_VARIANTS = new Set<string>(TOOLBAR_VARIANT_VALUES);
const CHECKBOX_SIZES = new Set<ComponentSizeSubset>(CHECKBOX_SIZE_VALUES);
const CHECKBOX_GROUP_SIZES = new Set<ComponentSizeSubset>(
  CHECKBOX_GROUP_SIZE_VALUES,
);
const CHECKBOX_GROUP_ORIENTATIONS = new Set<string>(
  CHECKBOX_GROUP_ORIENTATION_VALUES,
);
const CHECKBOX_GROUP_LABEL_POSITIONS = new Set<string>(
  CHECKBOX_GROUP_LABEL_POSITION_VALUES,
);
const CHECKBOX_GROUP_LABEL_ALIGNS = new Set<string>(
  CHECKBOX_GROUP_LABEL_ALIGN_VALUES,
);
const CHECKBOX_GROUP_NECESSITY_INDICATORS = new Set<string>(
  CHECKBOX_GROUP_NECESSITY_INDICATOR_VALUES,
);
const RADIO_VARIANTS = new Set<string>(RADIO_VARIANT_VALUES);
const RADIO_SIZES = new Set<string>(RADIO_SIZE_VALUES);
const RADIO_GROUP_VARIANTS = new Set<string>(RADIO_GROUP_VARIANT_VALUES);
const RADIO_GROUP_SIZES = new Set<string>(RADIO_GROUP_SIZE_VALUES);
const RADIO_GROUP_ORIENTATIONS = new Set<string>(
  RADIO_GROUP_ORIENTATION_VALUES,
);
const RADIO_GROUP_LABEL_POSITIONS = new Set<string>(
  RADIO_GROUP_LABEL_POSITION_VALUES,
);
const RADIO_GROUP_LABEL_ALIGNS = new Set<string>(
  RADIO_GROUP_LABEL_ALIGN_VALUES,
);
const RADIO_GROUP_NECESSITY_INDICATORS = new Set<string>(
  RADIO_GROUP_NECESSITY_INDICATOR_VALUES,
);
const SLIDER_SIZES = new Set<ComponentSizeSubset>(SLIDER_SIZE_VALUES);
const SLIDER_ORIENTATIONS = new Set<string>(SLIDER_ORIENTATION_VALUES);
const SWITCH_SIZES = new Set<ComponentSizeSubset>(SWITCH_SIZE_VALUES);
const BREADCRUMBS_SIZES = new Set<string>(BREADCRUMBS_SIZE_VALUES);
const LIST_BOX_VARIANTS = new Set<string>([
  ...LIST_BOX_VARIANT_VALUES,
  ...LIST_BOX_LEGACY_VISUAL_VARIANT_VALUES,
]);
const LIST_BOX_ORIENTATIONS = new Set<string>(LIST_BOX_ORIENTATION_VALUES);
const LIST_BOX_SELECTION_MODES = new Set<string>(
  LIST_BOX_SELECTION_MODE_VALUES,
);
const LIST_BOX_SELECTION_BEHAVIORS = new Set<string>(
  LIST_BOX_SELECTION_BEHAVIOR_VALUES,
);
const GRID_LIST_VARIANTS = new Set<string>([
  ...GRID_LIST_VARIANT_VALUES,
  ...GRID_LIST_LEGACY_VISUAL_VARIANT_VALUES,
]);
const GRID_LIST_LAYOUTS = new Set<string>(GRID_LIST_LAYOUT_VALUES);
const GRID_LIST_SELECTION_MODES = new Set<string>(
  GRID_LIST_SELECTION_MODE_VALUES,
);
const GRID_LIST_SELECTION_BEHAVIORS = new Set<string>(
  GRID_LIST_SELECTION_BEHAVIOR_VALUES,
);
const GRID_LIST_VALIDATION_BEHAVIORS = new Set<string>(
  GRID_LIST_VALIDATION_BEHAVIOR_VALUES,
);
const TAG_GROUP_VARIANTS = new Set<string>([
  ...TAG_GROUP_VARIANT_VALUES,
  ...TAG_GROUP_LEGACY_VISUAL_VARIANT_VALUES,
]);
const TAG_GROUP_SIZES = new Set<string>(TAG_GROUP_SIZE_VALUES);
const TAG_GROUP_SELECTION_MODES = new Set<string>(
  TAG_GROUP_SELECTION_MODE_VALUES,
);
const TAG_GROUP_SELECTION_BEHAVIORS = new Set<string>(
  TAG_GROUP_SELECTION_BEHAVIOR_VALUES,
);
const TAG_GROUP_LABEL_POSITIONS = new Set<string>(
  TAG_GROUP_LABEL_POSITION_VALUES,
);
const TAG_GROUP_LABEL_ALIGNS = new Set<string>(TAG_GROUP_LABEL_ALIGN_VALUES);
const MENU_VARIANTS = new Set<string>(MENU_VARIANT_VALUES);
const MENU_SIZES = new Set<string>(MENU_SIZE_VALUES);
const MENU_ALIGNS = new Set<string>(MENU_ALIGN_VALUES);
const MENU_DIRECTIONS = new Set<string>(MENU_DIRECTION_VALUES);
const MENU_SELECTION_MODES = new Set<string>(MENU_SELECTION_MODE_VALUES);
const COMBO_BOX_SIZES = new Set<ComponentSize>(COMBO_BOX_SIZE_VALUES);
const COMBO_BOX_LABEL_POSITIONS = new Set<string>(
  COMBO_BOX_LABEL_POSITION_VALUES,
);
const COMBO_BOX_NECESSITY_INDICATORS = new Set<string>(
  COMBO_BOX_NECESSITY_INDICATOR_VALUES,
);
const COMBO_BOX_MENU_TRIGGERS = new Set<string>(COMBO_BOX_MENU_TRIGGER_VALUES);
const COMBO_BOX_VALIDATION_BEHAVIORS = new Set<string>(
  COMBO_BOX_VALIDATION_BEHAVIOR_VALUES,
);
const SELECT_SIZES = new Set<ComponentSize>(SELECT_SIZE_VALUES);
const SELECT_LABEL_POSITIONS = new Set<string>(SELECT_LABEL_POSITION_VALUES);
const SELECT_LABEL_ALIGNS = new Set<string>(SELECT_LABEL_ALIGN_VALUES);
const SELECT_ALIGNS = new Set<string>(SELECT_ALIGN_VALUES);
const SELECT_DIRECTIONS = new Set<string>(SELECT_DIRECTION_VALUES);
const SELECT_NECESSITY_INDICATORS = new Set<string>(
  SELECT_NECESSITY_INDICATOR_VALUES,
);
const SELECT_VALIDATION_BEHAVIORS = new Set<string>(
  SELECT_VALIDATION_BEHAVIOR_VALUES,
);
const TABS_DENSITIES = new Set<string>(TABS_DENSITY_VALUES);
const TABS_SIZES = new Set<ComponentSizeSubset>(TABS_SIZE_VALUES);
const TABS_ORIENTATIONS = new Set<string>(TABS_ORIENTATION_VALUES);
const TABS_KEYBOARD_ACTIVATIONS = new Set<string>(
  TABS_KEYBOARD_ACTIVATION_VALUES,
);
const TREE_VARIANTS = new Set<string>(TREE_VARIANT_VALUES);
const TREE_SELECTION_MODES = new Set<string>(TREE_SELECTION_MODE_VALUES);
const TREE_SELECTION_BEHAVIORS = new Set<string>(
  TREE_SELECTION_BEHAVIOR_VALUES,
);
const TABLE_DENSITIES = new Set<string>(TABLE_DENSITY_VALUES);
const TABLE_SELECTION_MODES = new Set<string>(TABLE_SELECTION_MODE_VALUES);
const TABLE_SELECTION_BEHAVIORS = new Set<string>(
  TABLE_SELECTION_BEHAVIOR_VALUES,
);
const TABLE_SORT_DIRECTIONS = new Set<string>(TABLE_SORT_DIRECTION_VALUES);

export interface BreadcrumbCanonicalProps extends Record<string, unknown> {
  children?: unknown;
  label?: unknown;
  title?: unknown;
  href?: unknown;
  isDisabled?: unknown;
  className?: unknown;
  style?: unknown;
}

export interface BreadcrumbRacProps extends Record<string, unknown> {
  children: string;
  href?: string;
  isDisabled?: boolean;
  className?: string;
  style?: Record<string, unknown>;
}

export interface BreadcrumbsCanonicalProps extends Record<string, unknown> {
  "aria-label"?: unknown;
  size?: unknown;
  isDisabled?: unknown;
  showRoot?: unknown;
  isMultiline?: unknown;
  className?: unknown;
  style?: unknown;
}

export interface BreadcrumbsRacProps extends Record<string, unknown> {
  "aria-label": string;
  size: "S" | "M" | "L";
  isDisabled?: boolean;
  showRoot?: boolean;
  isMultiline?: boolean;
  className?: string;
  style?: Record<string, unknown>;
}

export interface ButtonCanonicalProps extends Record<string, unknown> {
  children?: unknown;
  text?: unknown;
  label?: unknown;
  variant?: unknown;
  fillStyle?: unknown;
  size?: unknown;
  type?: unknown;
  iconName?: unknown;
  iconPosition?: unknown;
  iconStrokeWidth?: unknown;
  isDisabled?: unknown;
  isLoading?: unknown;
  className?: unknown;
  style?: unknown;
}

export interface ButtonRacProps extends Record<string, unknown> {
  children: string;
  variant: ButtonVariant;
  fillStyle: ButtonFillStyle;
  size: ComponentSize;
  type: "button" | "submit" | "reset";
  iconName?: string;
  iconPosition: "start" | "end";
  iconStrokeWidth: number;
  isDisabled?: boolean;
  isLoading?: boolean;
  className?: string;
  style?: Record<string, unknown>;
}

export interface SeparatorCanonicalProps extends Record<string, unknown> {
  orientation?: unknown;
  variant?: unknown;
  size?: unknown;
  className?: unknown;
  style?: unknown;
}

export interface SeparatorRacProps extends Record<string, unknown> {
  orientation: "horizontal" | "vertical";
  variant: SeparatorVariant;
  size: ComponentSizeSubset;
  className?: string;
  style?: Record<string, unknown>;
}

export interface TextFieldCanonicalProps extends Record<string, unknown> {
  label?: unknown;
  value?: unknown;
  defaultValue?: unknown;
  placeholder?: unknown;
  description?: unknown;
  errorMessage?: unknown;
  type?: unknown;
  size?: unknown;
  labelPosition?: unknown;
  necessityIndicator?: unknown;
  isRequired?: unknown;
  isDisabled?: unknown;
  isReadOnly?: unknown;
  isInvalid?: unknown;
  isQuiet?: unknown;
  isLoading?: unknown;
  className?: unknown;
  style?: unknown;
}

export interface TextFieldRacProps extends Record<string, unknown> {
  label: string;
  placeholder: string;
  type: (typeof TEXT_FIELD_TYPE_VALUES)[number];
  size: ComponentSize;
  labelPosition: "top" | "side";
  isQuiet: boolean;
  value?: string;
  defaultValue?: string;
  description?: string;
  errorMessage?: string;
  necessityIndicator?: "icon" | "label";
  isRequired?: boolean;
  isDisabled?: boolean;
  isReadOnly?: boolean;
  isInvalid?: boolean;
  isLoading?: boolean;
  className?: string;
  style?: Record<string, unknown>;
}

export interface NumberFieldCanonicalProps extends Record<string, unknown> {
  label?: unknown;
  value?: unknown;
  defaultValue?: unknown;
  placeholder?: unknown;
  description?: unknown;
  errorMessage?: unknown;
  minValue?: unknown;
  maxValue?: unknown;
  step?: unknown;
  locale?: unknown;
  formatOptions?: unknown;
  size?: unknown;
  labelPosition?: unknown;
  necessityIndicator?: unknown;
  isRequired?: unknown;
  isDisabled?: unknown;
  isReadOnly?: unknown;
  isInvalid?: unknown;
  isQuiet?: unknown;
  hideStepper?: unknown;
  className?: unknown;
  style?: unknown;
}

export interface NumberFieldRacProps extends Record<string, unknown> {
  label: string;
  placeholder: string;
  size: ComponentSize;
  labelPosition: "top" | "side";
  isQuiet: boolean;
  hideStepper: boolean;
  value?: number;
  defaultValue?: number;
  description?: string;
  errorMessage?: string;
  minValue?: number;
  maxValue?: number;
  step?: number;
  locale?: string;
  formatOptions?: Intl.NumberFormatOptions;
  necessityIndicator?: "icon" | "label";
  isRequired?: boolean;
  isDisabled?: boolean;
  isReadOnly?: boolean;
  isInvalid?: boolean;
  className?: string;
  style?: Record<string, unknown>;
}

export interface SearchFieldCanonicalProps extends Record<string, unknown> {
  label?: unknown;
  value?: unknown;
  defaultValue?: unknown;
  placeholder?: unknown;
  description?: unknown;
  errorMessage?: unknown;
  type?: unknown;
  inputMode?: unknown;
  pattern?: unknown;
  minLength?: unknown;
  maxLength?: unknown;
  autoCorrect?: unknown;
  spellCheck?: unknown;
  enterKeyHint?: unknown;
  size?: unknown;
  labelPosition?: unknown;
  necessityIndicator?: unknown;
  isRequired?: unknown;
  isDisabled?: unknown;
  isReadOnly?: unknown;
  isInvalid?: unknown;
  isQuiet?: unknown;
  className?: unknown;
  style?: unknown;
}

export interface SearchFieldRacProps extends Record<string, unknown> {
  label: string;
  placeholder: string;
  type: (typeof SEARCH_FIELD_TYPE_VALUES)[number];
  inputMode: (typeof SEARCH_FIELD_INPUT_MODE_VALUES)[number];
  size: ComponentSize;
  labelPosition: "top" | "side";
  isQuiet: boolean;
  value?: string;
  defaultValue?: string;
  description?: string;
  errorMessage?: string;
  pattern?: string;
  minLength?: number;
  maxLength?: number;
  autoCorrect?: "on" | "off";
  spellCheck?: boolean;
  enterKeyHint?: (typeof SEARCH_FIELD_ENTER_KEY_HINT_VALUES)[number];
  necessityIndicator?: "icon" | "label";
  isRequired?: boolean;
  isDisabled?: boolean;
  isReadOnly?: boolean;
  isInvalid?: boolean;
  className?: string;
  style?: Record<string, unknown>;
}

export interface DateFieldCanonicalProps extends Record<string, unknown> {
  label?: unknown;
  value?: unknown;
  defaultValue?: unknown;
  placeholderValue?: unknown;
  description?: unknown;
  errorMessage?: unknown;
  granularity?: unknown;
  hourCycle?: unknown;
  locale?: unknown;
  calendar?: unknown;
  calendarSystem?: unknown;
  timezone?: unknown;
  minValue?: unknown;
  maxValue?: unknown;
  size?: unknown;
  labelPosition?: unknown;
  necessityIndicator?: unknown;
  isRequired?: unknown;
  isDisabled?: unknown;
  isReadOnly?: unknown;
  isInvalid?: unknown;
  isQuiet?: unknown;
  hideTimeZone?: unknown;
  shouldForceLeadingZeros?: unknown;
  className?: unknown;
  style?: unknown;
}

export interface DateFieldRacProps extends Record<string, unknown> {
  label: string;
  placeholderValue: string;
  granularity: (typeof DATE_FIELD_GRANULARITY_VALUES)[number];
  hourCycle: 12 | 24;
  size: ComponentSize;
  labelPosition: "top" | "side";
  isQuiet: boolean;
  value?: string;
  defaultValue?: string;
  description?: string;
  errorMessage?: string;
  locale?: string;
  calendar?: (typeof DATE_FIELD_CALENDAR_VALUES)[number];
  timezone?: string;
  minValue?: string;
  maxValue?: string;
  necessityIndicator?: "icon" | "label";
  isRequired?: boolean;
  isDisabled?: boolean;
  isReadOnly?: boolean;
  isInvalid?: boolean;
  hideTimeZone?: boolean;
  shouldForceLeadingZeros?: boolean;
  className?: string;
  style?: Record<string, unknown>;
}

export interface TimeFieldCanonicalProps extends Record<string, unknown> {
  label?: unknown;
  value?: unknown;
  defaultValue?: unknown;
  placeholderValue?: unknown;
  description?: unknown;
  errorMessage?: unknown;
  granularity?: unknown;
  hourCycle?: unknown;
  locale?: unknown;
  minValue?: unknown;
  maxValue?: unknown;
  size?: unknown;
  labelPosition?: unknown;
  necessityIndicator?: unknown;
  isRequired?: unknown;
  isDisabled?: unknown;
  isReadOnly?: unknown;
  isInvalid?: unknown;
  isQuiet?: unknown;
  hideTimeZone?: unknown;
  shouldForceLeadingZeros?: unknown;
  className?: unknown;
  style?: unknown;
}

export interface TimeFieldRacProps extends Record<string, unknown> {
  label: string;
  placeholderValue: string;
  granularity: (typeof TIME_FIELD_GRANULARITY_VALUES)[number];
  hourCycle: 12 | 24;
  size: ComponentSize;
  labelPosition: "top" | "side";
  isQuiet: boolean;
  value?: string;
  defaultValue?: string;
  description?: string;
  errorMessage?: string;
  locale?: string;
  minValue?: string;
  maxValue?: string;
  necessityIndicator?: "icon" | "label";
  isRequired?: boolean;
  isDisabled?: boolean;
  isReadOnly?: boolean;
  isInvalid?: boolean;
  hideTimeZone?: boolean;
  shouldForceLeadingZeros?: boolean;
  className?: string;
  style?: Record<string, unknown>;
}

export interface ColorFieldCanonicalProps extends Record<string, unknown> {
  label?: unknown;
  value?: unknown;
  defaultValue?: unknown;
  placeholder?: unknown;
  description?: unknown;
  errorMessage?: unknown;
  channel?: unknown;
  colorSpace?: unknown;
  size?: unknown;
  labelPosition?: unknown;
  labelAlign?: unknown;
  necessityIndicator?: unknown;
  isRequired?: unknown;
  isDisabled?: unknown;
  isReadOnly?: unknown;
  isInvalid?: unknown;
  isQuiet?: unknown;
  className?: unknown;
  style?: unknown;
}

export interface ColorFieldRacProps extends Record<string, unknown> {
  label: string;
  placeholder: string;
  size: ComponentSize;
  labelPosition: "top" | "side";
  labelAlign?: "start" | "center" | "end";
  isQuiet: boolean;
  value?: string;
  defaultValue?: string;
  description?: string;
  errorMessage?: string;
  channel?: (typeof COLOR_FIELD_CHANNEL_VALUES)[number];
  colorSpace?: (typeof COLOR_FIELD_COLOR_SPACE_VALUES)[number];
  necessityIndicator?: "icon" | "label";
  isRequired?: boolean;
  isDisabled?: boolean;
  isReadOnly?: boolean;
  isInvalid?: boolean;
  className?: string;
  style?: Record<string, unknown>;
}

export interface FormCanonicalProps extends Record<string, unknown> {
  "aria-label"?: unknown;
  action?: unknown;
  method?: unknown;
  encType?: unknown;
  target?: unknown;
  validationBehavior?: unknown;
  labelPosition?: unknown;
  labelAlign?: unknown;
  necessityIndicator?: unknown;
  size?: unknown;
  variant?: unknown;
  autoFocus?: unknown;
  restoreFocus?: unknown;
  isDisabled?: unknown;
  className?: unknown;
  style?: unknown;
}

export interface FormRacProps extends Record<string, unknown> {
  size: ComponentSize;
  variant: (typeof FORM_VARIANT_VALUES)[number];
  labelPosition: "top" | "side";
  labelAlign: "start" | "center" | "end";
  necessityIndicator: "icon" | "label";
  validationBehavior: (typeof FORM_VALIDATION_BEHAVIOR_VALUES)[number];
  "aria-label"?: string;
  action?: string;
  method?: (typeof FORM_METHOD_VALUES)[number];
  encType?: (typeof FORM_ENCTYPE_VALUES)[number];
  target?: (typeof FORM_TARGET_VALUES)[number];
  autoFocus?: boolean;
  restoreFocus?: boolean;
  isDisabled?: boolean;
  className?: string;
  style?: Record<string, unknown>;
}

export interface FileTriggerCanonicalProps extends Record<string, unknown> {
  acceptedFileTypes?: unknown;
  allowsMultiple?: unknown;
  acceptDirectory?: unknown;
  defaultCamera?: unknown;
}

export interface FileTriggerRacProps extends Record<string, unknown> {
  acceptedFileTypes?: string[];
  allowsMultiple?: boolean;
  acceptDirectory?: boolean;
  defaultCamera?: (typeof FILE_TRIGGER_DEFAULT_CAMERA_VALUES)[number];
}

export interface DropZoneCanonicalProps extends Record<string, unknown> {
  label?: unknown;
  description?: unknown;
  size?: unknown;
  isDropTarget?: unknown;
  isDisabled?: unknown;
  className?: unknown;
  style?: unknown;
}

export interface DropZoneRacProps extends Record<string, unknown> {
  label: string;
  description?: string;
  size: ComponentSizeSubset;
  isDropTarget: boolean;
  isDisabled?: boolean;
  className?: string;
  style?: Record<string, unknown>;
}

export interface LinkCanonicalProps extends Record<string, unknown> {
  children?: unknown;
  text?: unknown;
  label?: unknown;
  href?: unknown;
  target?: unknown;
  rel?: unknown;
  variant?: unknown;
  size?: unknown;
  isQuiet?: unknown;
  staticColor?: unknown;
  isExternal?: unknown;
  showExternalIcon?: unknown;
  isLoading?: unknown;
  isDisabled?: unknown;
  className?: unknown;
  style?: unknown;
}

export interface LinkRacProps extends Record<string, unknown> {
  children: string;
  variant: LinkVariant;
  size: ComponentSize;
  isQuiet: boolean;
  staticColor: StaticColor;
  showExternalIcon: boolean;
  href?: string;
  target?: "_self" | "_blank" | "_parent" | "_top";
  rel?: string;
  isExternal?: boolean;
  isLoading?: boolean;
  isDisabled?: boolean;
  className?: string;
  style?: Record<string, unknown>;
}

export interface ToggleButtonCanonicalProps extends Record<string, unknown> {
  children?: unknown;
  text?: unknown;
  label?: unknown;
  size?: unknown;
  isSelected?: unknown;
  isEmphasized?: unknown;
  isQuiet?: unknown;
  isDisabled?: unknown;
  className?: unknown;
  style?: unknown;
}

export interface ToggleButtonRacProps extends Record<string, unknown> {
  children: string;
  size: ComponentSizeSubset;
  isEmphasized: boolean;
  isQuiet: boolean;
  isSelected?: boolean;
  isDisabled?: boolean;
  className?: string;
  style?: Record<string, unknown>;
}

export interface SwitchCanonicalProps extends Record<string, unknown> {
  children?: unknown;
  label?: unknown;
  size?: unknown;
  isSelected?: unknown;
  defaultSelected?: unknown;
  isEmphasized?: unknown;
  isDisabled?: unknown;
  isReadOnly?: unknown;
  isLoading?: unknown;
  name?: unknown;
  value?: unknown;
  className?: unknown;
  style?: unknown;
}

export interface SwitchRacProps extends Record<string, unknown> {
  children: string;
  size: ComponentSizeSubset;
  isEmphasized: boolean;
  isSelected?: boolean;
  defaultSelected?: boolean;
  isDisabled?: boolean;
  isReadOnly?: boolean;
  isLoading?: boolean;
  name?: string;
  value?: string;
  className?: string;
  style?: Record<string, unknown>;
}

export interface CheckboxCanonicalProps extends Record<string, unknown> {
  children?: unknown;
  label?: unknown;
  size?: unknown;
  isSelected?: unknown;
  defaultSelected?: unknown;
  isIndeterminate?: unknown;
  isEmphasized?: unknown;
  isDisabled?: unknown;
  isInvalid?: unknown;
  isReadOnly?: unknown;
  isRequired?: unknown;
  isLoading?: unknown;
  name?: unknown;
  value?: unknown;
  form?: unknown;
  className?: unknown;
  style?: unknown;
}

export interface CheckboxRacProps extends Record<string, unknown> {
  children: string;
  size: ComponentSizeSubset;
  isEmphasized: boolean;
  isSelected?: boolean;
  defaultSelected?: boolean;
  isIndeterminate?: boolean;
  isDisabled?: boolean;
  isInvalid?: boolean;
  isReadOnly?: boolean;
  isRequired?: boolean;
  isLoading?: boolean;
  name?: string;
  value?: string;
  form?: string;
  className?: string;
  style?: Record<string, unknown>;
}

export interface CheckboxGroupCanonicalProps extends Record<string, unknown> {
  label?: unknown;
  description?: unknown;
  errorMessage?: unknown;
  value?: unknown;
  defaultValue?: unknown;
  size?: unknown;
  orientation?: unknown;
  labelPosition?: unknown;
  labelAlign?: unknown;
  necessityIndicator?: unknown;
  isEmphasized?: unknown;
  isDisabled?: unknown;
  isInvalid?: unknown;
  isReadOnly?: unknown;
  isRequired?: unknown;
  name?: unknown;
  form?: unknown;
  validationBehavior?: unknown;
  className?: unknown;
  style?: unknown;
}

export interface CheckboxGroupRacProps extends Record<string, unknown> {
  label: string;
  description?: string;
  errorMessage?: string;
  value?: string[];
  defaultValue?: string[];
  size: ComponentSizeSubset;
  orientation: "horizontal" | "vertical";
  labelPosition: "top" | "side";
  labelAlign: "start" | "end";
  necessityIndicator?: "icon" | "label";
  isEmphasized: boolean;
  isDisabled?: boolean;
  isInvalid?: boolean;
  isReadOnly?: boolean;
  isRequired?: boolean;
  name?: string;
  form?: string;
  validationBehavior?: "native" | "aria";
  className?: string;
  style?: Record<string, unknown>;
}

export interface RadioCanonicalProps extends Record<string, unknown> {
  children?: unknown;
  label?: unknown;
  text?: unknown;
  value?: unknown;
  variant?: unknown;
  size?: unknown;
  isSelected?: unknown;
  defaultSelected?: unknown;
  isEmphasized?: unknown;
  isDisabled?: unknown;
  isReadOnly?: unknown;
  autoFocus?: unknown;
  className?: unknown;
  style?: unknown;
}

export interface RadioRacProps extends Record<string, unknown> {
  children: string;
  value?: string;
  variant: (typeof RADIO_VARIANT_VALUES)[number];
  size: (typeof RADIO_SIZE_VALUES)[number];
  isEmphasized: boolean;
  isSelected?: boolean;
  defaultSelected?: boolean;
  isDisabled?: boolean;
  isReadOnly?: boolean;
  autoFocus?: boolean;
  className?: string;
  style?: Record<string, unknown>;
}

export interface RadioGroupCanonicalProps extends Record<string, unknown> {
  label?: unknown;
  description?: unknown;
  errorMessage?: unknown;
  value?: unknown;
  defaultValue?: unknown;
  variant?: unknown;
  size?: unknown;
  orientation?: unknown;
  labelPosition?: unknown;
  labelAlign?: unknown;
  necessityIndicator?: unknown;
  isEmphasized?: unknown;
  isDisabled?: unknown;
  isInvalid?: unknown;
  isReadOnly?: unknown;
  isRequired?: unknown;
  name?: unknown;
  form?: unknown;
  validationBehavior?: unknown;
  className?: unknown;
  style?: unknown;
}

export interface RadioGroupRacProps extends Record<string, unknown> {
  label: string;
  description?: string;
  errorMessage?: string;
  value?: string;
  defaultValue?: string;
  variant: (typeof RADIO_GROUP_VARIANT_VALUES)[number];
  size: (typeof RADIO_GROUP_SIZE_VALUES)[number];
  orientation: "horizontal" | "vertical";
  labelPosition: "top" | "side";
  labelAlign: "start" | "end";
  necessityIndicator?: "icon" | "label";
  isEmphasized: boolean;
  isDisabled?: boolean;
  isInvalid?: boolean;
  isReadOnly?: boolean;
  isRequired?: boolean;
  name?: string;
  form?: string;
  validationBehavior?: "native" | "aria";
  className?: string;
  style?: Record<string, unknown>;
}

export interface SliderCanonicalProps extends Record<string, unknown> {
  label?: unknown;
  value?: unknown;
  defaultValue?: unknown;
  minValue?: unknown;
  maxValue?: unknown;
  step?: unknown;
  size?: unknown;
  orientation?: unknown;
  isEmphasized?: unknown;
  showValueLabel?: unknown;
  isDisabled?: unknown;
  isReadOnly?: unknown;
  isLoading?: unknown;
  locale?: unknown;
  formatOptions?: unknown;
  thumbLabels?: unknown;
  name?: unknown;
  form?: unknown;
  className?: unknown;
  style?: unknown;
}

export interface SliderRacProps extends Record<string, unknown> {
  label: string;
  value?: number | number[];
  defaultValue?: number | number[];
  minValue: number;
  maxValue: number;
  step: number;
  size: ComponentSizeSubset;
  orientation: "horizontal" | "vertical";
  isEmphasized: boolean;
  showValueLabel: boolean;
  isDisabled?: boolean;
  isReadOnly?: boolean;
  isLoading?: boolean;
  locale: string;
  formatOptions?: Intl.NumberFormatOptions;
  thumbLabels?: string[];
  name?: string;
  form?: string;
  className?: string;
  style?: Record<string, unknown>;
}

export interface ListBoxItemDescriptor extends Record<string, unknown> {
  id: string;
  label: string;
  value?: string;
  textValue?: string;
  description?: string;
  isDisabled?: boolean;
  href?: string;
  type?: "item";
}

export interface ListBoxSectionDescriptor extends Record<string, unknown> {
  id: string;
  type: "section";
  header: string;
  ariaLabel?: string;
  items: ListBoxItemDescriptor[];
}

export type ListBoxEntryDescriptor =
  | ListBoxItemDescriptor
  | ListBoxSectionDescriptor;

export interface ListBoxCanonicalProps extends Record<string, unknown> {
  "aria-label"?: unknown;
  variant?: unknown;
  orientation?: unknown;
  selectionMode?: unknown;
  selectionBehavior?: unknown;
  disallowEmptySelection?: unknown;
  autoFocus?: unknown;
  isDisabled?: unknown;
  enableVirtualization?: unknown;
  height?: unknown;
  overscan?: unknown;
  filterText?: unknown;
  filterFields?: unknown;
  selectedKey?: unknown;
  selectedKeys?: unknown;
  defaultSelectedKey?: unknown;
  defaultSelectedKeys?: unknown;
  items?: unknown;
  className?: unknown;
  style?: unknown;
}

export interface ListBoxRacProps extends Record<string, unknown> {
  "aria-label": string;
  variant:
    | (typeof LIST_BOX_VARIANT_VALUES)[number]
    | (typeof LIST_BOX_LEGACY_VISUAL_VARIANT_VALUES)[number];
  orientation: "horizontal" | "vertical";
  selectionMode: (typeof LIST_BOX_SELECTION_MODE_VALUES)[number];
  selectionBehavior: (typeof LIST_BOX_SELECTION_BEHAVIOR_VALUES)[number];
  disallowEmptySelection: boolean;
  autoFocus: boolean;
  isDisabled: boolean;
  enableVirtualization: boolean;
  height: number;
  overscan: number;
  filterText?: string;
  filterFields?: string[];
  selectedKey?: string;
  selectedKeys?: string[];
  defaultSelectedKey?: string;
  defaultSelectedKeys?: string[];
  items?: ListBoxEntryDescriptor[];
  className?: string;
  style?: Record<string, unknown>;
}

export interface GridListItemDescriptor extends Record<string, unknown> {
  id: string;
  label: string;
  textValue?: string;
  description?: string;
  isDisabled?: boolean;
  type?: "item";
}

export interface GridListSectionDescriptor extends Record<string, unknown> {
  id: string;
  type: "section";
  header: string;
  ariaLabel?: string;
  items: GridListItemDescriptor[];
}

export type GridListEntryDescriptor =
  | GridListItemDescriptor
  | GridListSectionDescriptor;

export interface GridListCanonicalProps extends Record<string, unknown> {
  "aria-label"?: unknown;
  variant?: unknown;
  layout?: unknown;
  columns?: unknown;
  selectionMode?: unknown;
  selectionBehavior?: unknown;
  disallowEmptySelection?: unknown;
  autoFocus?: unknown;
  isDisabled?: unknown;
  allowsDragging?: unknown;
  renderEmptyState?: unknown;
  validationBehavior?: unknown;
  filterText?: unknown;
  filterFields?: unknown;
  selectedKey?: unknown;
  selectedKeys?: unknown;
  defaultSelectedKey?: unknown;
  defaultSelectedKeys?: unknown;
  items?: unknown;
  className?: unknown;
  style?: unknown;
}

export interface GridListRacProps extends Record<string, unknown> {
  "aria-label": string;
  variant:
    | (typeof GRID_LIST_VARIANT_VALUES)[number]
    | (typeof GRID_LIST_LEGACY_VISUAL_VARIANT_VALUES)[number];
  layout: (typeof GRID_LIST_LAYOUT_VALUES)[number];
  columns: number;
  selectionMode: (typeof GRID_LIST_SELECTION_MODE_VALUES)[number];
  selectionBehavior: (typeof GRID_LIST_SELECTION_BEHAVIOR_VALUES)[number];
  disallowEmptySelection: boolean;
  autoFocus: boolean;
  isDisabled: boolean;
  allowsDragging: boolean;
  renderEmptyState: boolean;
  validationBehavior: (typeof GRID_LIST_VALIDATION_BEHAVIOR_VALUES)[number];
  filterText?: string;
  filterFields?: string[];
  selectedKey?: string;
  selectedKeys?: string[];
  defaultSelectedKey?: string;
  defaultSelectedKeys?: string[];
  items?: GridListEntryDescriptor[];
  className?: string;
  style?: Record<string, unknown>;
}

export interface TagGroupItemDescriptor extends Record<string, unknown> {
  id: string;
  label: string;
  isDisabled?: boolean;
  allowsRemoving?: boolean;
}

export interface TagGroupCanonicalProps extends Record<string, unknown> {
  label?: unknown;
  description?: unknown;
  errorMessage?: unknown;
  contextualHelp?: unknown;
  variant?: unknown;
  size?: unknown;
  labelPosition?: unknown;
  labelAlign?: unknown;
  maxRows?: unknown;
  isEmphasized?: unknown;
  filterText?: unknown;
  filterFields?: unknown;
  selectionMode?: unknown;
  selectionBehavior?: unknown;
  selectedKey?: unknown;
  selectedKeys?: unknown;
  defaultSelectedKey?: unknown;
  defaultSelectedKeys?: unknown;
  disallowEmptySelection?: unknown;
  isDisabled?: unknown;
  isReadOnly?: unknown;
  isInvalid?: unknown;
  allowsRemoving?: unknown;
  allowsCustomValue?: unknown;
  items?: unknown;
  className?: unknown;
  style?: unknown;
}

export interface TagGroupRacProps extends Record<string, unknown> {
  label?: string;
  description?: string;
  errorMessage?: string;
  contextualHelp?: string;
  variant:
    | (typeof TAG_GROUP_VARIANT_VALUES)[number]
    | (typeof TAG_GROUP_LEGACY_VISUAL_VARIANT_VALUES)[number];
  size: (typeof TAG_GROUP_SIZE_VALUES)[number];
  labelPosition: (typeof TAG_GROUP_LABEL_POSITION_VALUES)[number];
  labelAlign: (typeof TAG_GROUP_LABEL_ALIGN_VALUES)[number];
  maxRows?: number;
  isEmphasized: boolean;
  filterText?: string;
  filterFields?: string[];
  selectionMode: (typeof TAG_GROUP_SELECTION_MODE_VALUES)[number];
  selectionBehavior: (typeof TAG_GROUP_SELECTION_BEHAVIOR_VALUES)[number];
  selectedKey?: string;
  selectedKeys?: string[];
  defaultSelectedKey?: string;
  defaultSelectedKeys?: string[];
  disallowEmptySelection: boolean;
  isDisabled: boolean;
  isReadOnly: boolean;
  isInvalid: boolean;
  allowsRemoving: boolean;
  allowsCustomValue: boolean;
  items?: TagGroupItemDescriptor[];
  className?: string;
  style?: Record<string, unknown>;
}

export interface MenuItemDescriptor extends Record<string, unknown> {
  id: string;
  label: string;
  isDisabled?: boolean;
  icon?: string;
  shortcut?: string;
  description?: string;
  value?: string;
  textValue?: string;
  href?: string;
  children?: MenuItemDescriptor[];
}

export interface MenuCanonicalProps extends Record<string, unknown> {
  label?: unknown;
  children?: unknown;
  variant?: unknown;
  size?: unknown;
  align?: unknown;
  direction?: unknown;
  shouldFlip?: unknown;
  isQuiet?: unknown;
  isDisabled?: unknown;
  selectionMode?: unknown;
  selectedKeys?: unknown;
  defaultSelectedKeys?: unknown;
  items?: unknown;
  className?: unknown;
  style?: unknown;
}

export interface MenuRacProps extends Record<string, unknown> {
  label: string;
  children: string;
  variant: (typeof MENU_VARIANT_VALUES)[number];
  size: (typeof MENU_SIZE_VALUES)[number];
  align: (typeof MENU_ALIGN_VALUES)[number];
  direction: (typeof MENU_DIRECTION_VALUES)[number];
  shouldFlip: boolean;
  isQuiet: boolean;
  isDisabled: boolean;
  selectionMode: (typeof MENU_SELECTION_MODE_VALUES)[number];
  selectedKeys?: string[];
  defaultSelectedKeys?: string[];
  items?: MenuItemDescriptor[];
  className?: string;
  style?: Record<string, unknown>;
}

export interface ComboBoxItemDescriptor extends Record<string, unknown> {
  id: string;
  label: string;
  value?: string;
  textValue?: string;
  isDisabled?: boolean;
  icon?: string;
  description?: string;
}

export interface ComboBoxCanonicalProps extends Record<string, unknown> {
  label?: unknown;
  description?: unknown;
  errorMessage?: unknown;
  contextualHelp?: unknown;
  placeholder?: unknown;
  inputValue?: unknown;
  defaultInputValue?: unknown;
  selectedKey?: unknown;
  defaultSelectedKey?: unknown;
  items?: unknown;
  size?: unknown;
  iconName?: unknown;
  labelPosition?: unknown;
  isQuiet?: unknown;
  allowsCustomValue?: unknown;
  necessityIndicator?: unknown;
  isRequired?: unknown;
  isInvalid?: unknown;
  isDisabled?: unknown;
  isReadOnly?: unknown;
  autoFocus?: unknown;
  menuTrigger?: unknown;
  validationBehavior?: unknown;
  name?: unknown;
  form?: unknown;
  className?: unknown;
  style?: unknown;
}

export interface ComboBoxRacProps extends Record<string, unknown> {
  label?: string;
  description?: string;
  errorMessage?: string;
  contextualHelp?: string;
  placeholder: string;
  inputValue?: string;
  defaultInputValue?: string;
  selectedKey?: string;
  defaultSelectedKey?: string;
  items?: ComboBoxItemDescriptor[];
  size: ComponentSize;
  iconName: string;
  labelPosition: (typeof COMBO_BOX_LABEL_POSITION_VALUES)[number];
  isQuiet: boolean;
  allowsCustomValue: boolean;
  necessityIndicator?: (typeof COMBO_BOX_NECESSITY_INDICATOR_VALUES)[number];
  isRequired: boolean;
  isInvalid: boolean;
  isDisabled: boolean;
  isReadOnly: boolean;
  autoFocus: boolean;
  menuTrigger: (typeof COMBO_BOX_MENU_TRIGGER_VALUES)[number];
  validationBehavior: (typeof COMBO_BOX_VALIDATION_BEHAVIOR_VALUES)[number];
  name?: string;
  form?: string;
  className?: string;
  style?: Record<string, unknown>;
}

export interface SelectItemDescriptor extends Record<string, unknown> {
  id: string;
  label: string;
  value?: string;
  textValue?: string;
  isDisabled?: boolean;
  icon?: string;
  description?: string;
}

export interface SelectCanonicalProps extends Record<string, unknown> {
  label?: unknown;
  description?: unknown;
  errorMessage?: unknown;
  contextualHelp?: unknown;
  placeholder?: unknown;
  selectedKey?: unknown;
  defaultSelectedKey?: unknown;
  value?: unknown;
  items?: unknown;
  size?: unknown;
  iconName?: unknown;
  labelPosition?: unknown;
  labelAlign?: unknown;
  isQuiet?: unknown;
  isLoading?: unknown;
  align?: unknown;
  direction?: unknown;
  shouldFlip?: unknown;
  menuWidth?: unknown;
  disallowEmptySelection?: unknown;
  necessityIndicator?: unknown;
  isRequired?: unknown;
  isInvalid?: unknown;
  isDisabled?: unknown;
  isReadOnly?: unknown;
  autoFocus?: unknown;
  validationBehavior?: unknown;
  name?: unknown;
  form?: unknown;
  className?: unknown;
  style?: unknown;
}

export interface SelectRacProps extends Record<string, unknown> {
  label?: string;
  description?: string;
  errorMessage?: string;
  contextualHelp?: string;
  placeholder: string;
  selectedKey?: string;
  defaultSelectedKey?: string;
  items?: SelectItemDescriptor[];
  size: ComponentSize;
  iconName: string;
  labelPosition: (typeof SELECT_LABEL_POSITION_VALUES)[number];
  labelAlign: (typeof SELECT_LABEL_ALIGN_VALUES)[number];
  isQuiet: boolean;
  isLoading: boolean;
  align: (typeof SELECT_ALIGN_VALUES)[number];
  direction: (typeof SELECT_DIRECTION_VALUES)[number];
  shouldFlip: boolean;
  menuWidth?: string;
  disallowEmptySelection: boolean;
  necessityIndicator?: (typeof SELECT_NECESSITY_INDICATOR_VALUES)[number];
  isRequired: boolean;
  isInvalid: boolean;
  isDisabled: boolean;
  isReadOnly: boolean;
  autoFocus: boolean;
  validationBehavior: (typeof SELECT_VALIDATION_BEHAVIOR_VALUES)[number];
  name?: string;
  form?: string;
  className?: string;
  style?: Record<string, unknown>;
}

export interface TabsItemDescriptor extends Record<string, unknown> {
  id: string;
  label: string;
  content?: string;
  textValue?: string;
  isDisabled?: boolean;
}

export interface TabsCanonicalProps extends Record<string, unknown> {
  "aria-label"?: unknown;
  items?: unknown;
  density?: unknown;
  size?: unknown;
  orientation?: unknown;
  showIndicator?: unknown;
  selectedKey?: unknown;
  defaultSelectedKey?: unknown;
  isDisabled?: unknown;
  keyboardActivation?: unknown;
  className?: unknown;
  style?: unknown;
}

export interface TabsRacProps extends Record<string, unknown> {
  "aria-label": string;
  items?: TabsItemDescriptor[];
  density: (typeof TABS_DENSITY_VALUES)[number];
  size: ComponentSizeSubset;
  orientation: (typeof TABS_ORIENTATION_VALUES)[number];
  showIndicator: boolean;
  selectedKey?: string;
  defaultSelectedKey?: string;
  isDisabled: boolean;
  keyboardActivation: (typeof TABS_KEYBOARD_ACTIVATION_VALUES)[number];
  className?: string;
  style?: Record<string, unknown>;
}

export interface TreeItemDescriptor extends Record<string, unknown> {
  id: string;
  label: string;
  textValue?: string;
  description?: string;
  isDisabled?: boolean;
  children?: TreeItemDescriptor[];
}

export interface TreeCanonicalProps extends Record<string, unknown> {
  "aria-label"?: unknown;
  variant?: unknown;
  selectionMode?: unknown;
  selectionBehavior?: unknown;
  disallowEmptySelection?: unknown;
  autoFocus?: unknown;
  isDisabled?: unknown;
  selectedKey?: unknown;
  selectedKeys?: unknown;
  defaultSelectedKey?: unknown;
  defaultSelectedKeys?: unknown;
  expandedKeys?: unknown;
  defaultExpandedKeys?: unknown;
  items?: unknown;
  className?: unknown;
  style?: unknown;
}

export interface TreeRacProps extends Record<string, unknown> {
  "aria-label": string;
  variant: (typeof TREE_VARIANT_VALUES)[number];
  selectionMode: (typeof TREE_SELECTION_MODE_VALUES)[number];
  selectionBehavior: (typeof TREE_SELECTION_BEHAVIOR_VALUES)[number];
  disallowEmptySelection: boolean;
  autoFocus: boolean;
  isDisabled: boolean;
  selectedKey?: string;
  selectedKeys?: string[];
  defaultSelectedKey?: string;
  defaultSelectedKeys?: string[];
  expandedKeys?: string[];
  defaultExpandedKeys?: string[];
  items?: TreeItemDescriptor[];
  className?: string;
  style?: Record<string, unknown>;
}

export interface TableColumnDescriptor extends Record<string, unknown> {
  id: string;
  label: string;
  isRowHeader?: boolean;
  allowsSorting?: boolean;
  allowsResizing?: boolean;
  width?: number;
  minWidth?: number;
  maxWidth?: number;
}

export interface TableRowDescriptor extends Record<string, unknown> {
  id: string;
}

export interface TableCanonicalProps extends Record<string, unknown> {
  "aria-label"?: unknown;
  density?: unknown;
  selectionMode?: unknown;
  selectionBehavior?: unknown;
  disallowEmptySelection?: unknown;
  allowsSorting?: unknown;
  allowsResizingColumns?: unknown;
  isQuiet?: unknown;
  selectedKeys?: unknown;
  defaultSelectedKeys?: unknown;
  sortColumn?: unknown;
  sortDirection?: unknown;
  columns?: unknown;
  rows?: unknown;
  items?: unknown;
  className?: unknown;
  style?: unknown;
}

export interface TableRacProps extends Record<string, unknown> {
  "aria-label": string;
  density: (typeof TABLE_DENSITY_VALUES)[number];
  selectionMode: (typeof TABLE_SELECTION_MODE_VALUES)[number];
  selectionBehavior: (typeof TABLE_SELECTION_BEHAVIOR_VALUES)[number];
  disallowEmptySelection: boolean;
  allowsSorting: boolean;
  allowsResizingColumns: boolean;
  isQuiet: boolean;
  selectedKeys?: string[];
  defaultSelectedKeys?: string[];
  sortColumn?: string;
  sortDirection: (typeof TABLE_SORT_DIRECTION_VALUES)[number];
  columns: TableColumnDescriptor[];
  rows: TableRowDescriptor[];
  className?: string;
  style?: Record<string, unknown>;
}

export interface ToggleButtonGroupCanonicalProps extends Record<
  string,
  unknown
> {
  size?: unknown;
  orientation?: unknown;
  selectionMode?: unknown;
  indicator?: unknown;
  isEmphasized?: unknown;
  isQuiet?: unknown;
  isDisabled?: unknown;
  selectedKeys?: unknown;
  defaultSelectedKeys?: unknown;
  value?: unknown;
  className?: unknown;
  style?: unknown;
}

export interface ToggleButtonGroupRacProps extends Record<string, unknown> {
  size: ComponentSizeSubset;
  orientation: "horizontal" | "vertical";
  selectionMode: "single" | "multiple";
  indicator: boolean;
  isEmphasized: boolean;
  isQuiet: boolean;
  isDisabled?: boolean;
  selectedKeys?: Set<string>;
  defaultSelectedKeys?: Set<string>;
  className?: string;
  style?: Record<string, unknown>;
}

export interface ToolbarCanonicalProps extends Record<string, unknown> {
  "aria-label"?: unknown;
  orientation?: unknown;
  variant?: unknown;
  size?: unknown;
  className?: unknown;
  style?: unknown;
}

export interface ToolbarRacProps extends Record<string, unknown> {
  "aria-label": string;
  orientation: "horizontal" | "vertical";
  variant: "default" | "accent";
  size: ComponentSizeSubset;
  className?: string;
  style?: Record<string, unknown>;
}

export function toBreadcrumbRacProps(
  props: BreadcrumbCanonicalProps,
): BreadcrumbRacProps {
  return {
    children: readBreadcrumbText(props),
    ...(typeof props.href === "string" ? { href: props.href } : {}),
    ...(typeof props.isDisabled === "boolean"
      ? { isDisabled: props.isDisabled }
      : {}),
    ...(typeof props.className === "string"
      ? { className: props.className }
      : {}),
    ...(isRecord(props.style) ? { style: props.style } : {}),
  };
}

export function toBreadcrumbsRacProps(
  props: BreadcrumbsCanonicalProps,
): BreadcrumbsRacProps {
  return {
    "aria-label": readBreadcrumbsLabel(props),
    size: normalizeBreadcrumbsSize(props.size),
    ...(typeof props.isDisabled === "boolean"
      ? { isDisabled: props.isDisabled }
      : {}),
    ...(typeof props.showRoot === "boolean"
      ? { showRoot: props.showRoot }
      : {}),
    ...(typeof props.isMultiline === "boolean"
      ? { isMultiline: props.isMultiline }
      : {}),
    ...(typeof props.className === "string"
      ? { className: props.className }
      : {}),
    ...(isRecord(props.style) ? { style: props.style } : {}),
  };
}

export function toButtonRacProps(props: ButtonCanonicalProps): ButtonRacProps {
  return {
    children: readButtonText(props),
    variant: normalizeButtonVariant(props.variant),
    fillStyle: normalizeButtonFillStyle(props.fillStyle),
    size: normalizeButtonSize(props.size),
    type: normalizeButtonType(props.type),
    iconPosition: normalizeButtonIconPosition(props.iconPosition),
    iconStrokeWidth: normalizeButtonIconStrokeWidth(props.iconStrokeWidth),
    ...(typeof props.iconName === "string" && props.iconName.length > 0
      ? { iconName: props.iconName }
      : {}),
    ...(typeof props.isDisabled === "boolean"
      ? { isDisabled: props.isDisabled }
      : {}),
    ...(typeof props.isLoading === "boolean"
      ? { isLoading: props.isLoading }
      : {}),
    ...(typeof props.className === "string"
      ? { className: props.className }
      : {}),
    ...(isRecord(props.style) ? { style: props.style } : {}),
  };
}

export function toSeparatorRacProps(
  props: SeparatorCanonicalProps,
): SeparatorRacProps {
  return {
    orientation: normalizeSeparatorOrientation(props.orientation),
    variant: normalizeSeparatorVariant(props.variant),
    size: normalizeSeparatorSize(props.size),
    ...(typeof props.className === "string"
      ? { className: props.className }
      : {}),
    ...(isRecord(props.style) ? { style: props.style } : {}),
  };
}

export function toTextFieldRacProps(
  props: TextFieldCanonicalProps,
): TextFieldRacProps {
  return {
    label: readTextFieldLabel(props),
    placeholder: readString(props.placeholder, "Enter text..."),
    type: normalizeTextFieldType(props.type),
    size: normalizeTextFieldSize(props.size),
    labelPosition: normalizeTextFieldLabelPosition(props.labelPosition),
    isQuiet: props.isQuiet === true,
    ...(typeof props.value === "string" ? { value: props.value } : {}),
    ...(typeof props.defaultValue === "string"
      ? { defaultValue: props.defaultValue }
      : {}),
    ...(typeof props.description === "string"
      ? { description: props.description }
      : {}),
    ...(typeof props.errorMessage === "string"
      ? { errorMessage: props.errorMessage }
      : {}),
    ...(normalizeTextFieldNecessityIndicator(props.necessityIndicator)
      ? {
          necessityIndicator: normalizeTextFieldNecessityIndicator(
            props.necessityIndicator,
          ),
        }
      : {}),
    ...(typeof props.isRequired === "boolean"
      ? { isRequired: props.isRequired }
      : {}),
    ...(typeof props.isDisabled === "boolean"
      ? { isDisabled: props.isDisabled }
      : {}),
    ...(typeof props.isReadOnly === "boolean"
      ? { isReadOnly: props.isReadOnly }
      : {}),
    ...(typeof props.isInvalid === "boolean"
      ? { isInvalid: props.isInvalid }
      : {}),
    ...(typeof props.isLoading === "boolean"
      ? { isLoading: props.isLoading }
      : {}),
    ...(typeof props.className === "string"
      ? { className: props.className }
      : {}),
    ...(isRecord(props.style) ? { style: props.style } : {}),
  };
}

export function toNumberFieldRacProps(
  props: NumberFieldCanonicalProps,
): NumberFieldRacProps {
  const formatOptions = normalizeNumberFieldFormatOptions(props.formatOptions);
  return {
    label: readString(props.label, "Number"),
    placeholder: readString(props.placeholder, "0"),
    size: normalizeTextFieldSize(props.size),
    labelPosition: normalizeTextFieldLabelPosition(props.labelPosition),
    isQuiet: props.isQuiet === true,
    hideStepper: props.hideStepper === true,
    ...(readFiniteNumber(props.value) !== undefined
      ? { value: readFiniteNumber(props.value) }
      : {}),
    ...(readFiniteNumber(props.defaultValue) !== undefined
      ? { defaultValue: readFiniteNumber(props.defaultValue) }
      : {}),
    ...(typeof props.description === "string"
      ? { description: props.description }
      : {}),
    ...(typeof props.errorMessage === "string"
      ? { errorMessage: props.errorMessage }
      : {}),
    ...(readFiniteNumber(props.minValue) !== undefined
      ? { minValue: readFiniteNumber(props.minValue) }
      : {}),
    ...(readFiniteNumber(props.maxValue) !== undefined
      ? { maxValue: readFiniteNumber(props.maxValue) }
      : {}),
    ...(readFiniteNumber(props.step) !== undefined
      ? { step: readFiniteNumber(props.step) }
      : {}),
    ...(typeof props.locale === "string" && props.locale.length > 0
      ? { locale: props.locale }
      : {}),
    ...(formatOptions ? { formatOptions } : {}),
    ...(normalizeTextFieldNecessityIndicator(props.necessityIndicator)
      ? {
          necessityIndicator: normalizeTextFieldNecessityIndicator(
            props.necessityIndicator,
          ),
        }
      : {}),
    ...(typeof props.isRequired === "boolean"
      ? { isRequired: props.isRequired }
      : {}),
    ...(typeof props.isDisabled === "boolean"
      ? { isDisabled: props.isDisabled }
      : {}),
    ...(typeof props.isReadOnly === "boolean"
      ? { isReadOnly: props.isReadOnly }
      : {}),
    ...(typeof props.isInvalid === "boolean"
      ? { isInvalid: props.isInvalid }
      : {}),
    ...(typeof props.className === "string"
      ? { className: props.className }
      : {}),
    ...(isRecord(props.style) ? { style: props.style } : {}),
  };
}

export function toSearchFieldRacProps(
  props: SearchFieldCanonicalProps,
): SearchFieldRacProps {
  return {
    label: readString(props.label, "Search"),
    placeholder: readString(props.placeholder, "Search..."),
    type: normalizeSearchFieldType(props.type),
    inputMode: normalizeSearchFieldInputMode(props.inputMode),
    size: normalizeTextFieldSize(props.size),
    labelPosition: normalizeTextFieldLabelPosition(props.labelPosition),
    isQuiet: props.isQuiet === true,
    ...(typeof props.value === "string" ? { value: props.value } : {}),
    ...(typeof props.defaultValue === "string"
      ? { defaultValue: props.defaultValue }
      : {}),
    ...(typeof props.description === "string"
      ? { description: props.description }
      : {}),
    ...(typeof props.errorMessage === "string"
      ? { errorMessage: props.errorMessage }
      : {}),
    ...(typeof props.pattern === "string" ? { pattern: props.pattern } : {}),
    ...(readFiniteNumber(props.minLength) !== undefined
      ? { minLength: readFiniteNumber(props.minLength) }
      : {}),
    ...(readFiniteNumber(props.maxLength) !== undefined
      ? { maxLength: readFiniteNumber(props.maxLength) }
      : {}),
    ...(normalizeSearchFieldAutoCorrect(props.autoCorrect)
      ? { autoCorrect: normalizeSearchFieldAutoCorrect(props.autoCorrect) }
      : {}),
    ...(typeof props.spellCheck === "boolean"
      ? { spellCheck: props.spellCheck }
      : {}),
    ...(normalizeSearchFieldEnterKeyHint(props.enterKeyHint)
      ? { enterKeyHint: normalizeSearchFieldEnterKeyHint(props.enterKeyHint) }
      : {}),
    ...(normalizeTextFieldNecessityIndicator(props.necessityIndicator)
      ? {
          necessityIndicator: normalizeTextFieldNecessityIndicator(
            props.necessityIndicator,
          ),
        }
      : {}),
    ...(typeof props.isRequired === "boolean"
      ? { isRequired: props.isRequired }
      : {}),
    ...(typeof props.isDisabled === "boolean"
      ? { isDisabled: props.isDisabled }
      : {}),
    ...(typeof props.isReadOnly === "boolean"
      ? { isReadOnly: props.isReadOnly }
      : {}),
    ...(typeof props.isInvalid === "boolean"
      ? { isInvalid: props.isInvalid }
      : {}),
    ...(typeof props.className === "string"
      ? { className: props.className }
      : {}),
    ...(isRecord(props.style) ? { style: props.style } : {}),
  };
}

export function toDateFieldRacProps(
  props: DateFieldCanonicalProps,
): DateFieldRacProps {
  return {
    label: readString(props.label, "Date"),
    placeholderValue: readString(props.placeholderValue, "2026-01-01"),
    granularity: normalizeDateFieldGranularity(props.granularity),
    hourCycle: normalizeDateFieldHourCycle(props.hourCycle),
    size: normalizeTextFieldSize(props.size),
    labelPosition: normalizeTextFieldLabelPosition(props.labelPosition),
    isQuiet: props.isQuiet === true,
    ...(typeof props.value === "string" && props.value.length > 0
      ? { value: props.value }
      : {}),
    ...(typeof props.defaultValue === "string" && props.defaultValue.length > 0
      ? { defaultValue: props.defaultValue }
      : {}),
    ...(typeof props.description === "string"
      ? { description: props.description }
      : {}),
    ...(typeof props.errorMessage === "string"
      ? { errorMessage: props.errorMessage }
      : {}),
    ...(typeof props.locale === "string" && props.locale.length > 0
      ? { locale: props.locale }
      : {}),
    ...(normalizeDateFieldCalendar(props.calendar ?? props.calendarSystem)
      ? {
          calendar: normalizeDateFieldCalendar(
            props.calendar ?? props.calendarSystem,
          ),
        }
      : {}),
    ...(typeof props.timezone === "string" && props.timezone.length > 0
      ? { timezone: props.timezone }
      : {}),
    ...(typeof props.minValue === "string" && props.minValue.length > 0
      ? { minValue: props.minValue }
      : {}),
    ...(typeof props.maxValue === "string" && props.maxValue.length > 0
      ? { maxValue: props.maxValue }
      : {}),
    ...(normalizeTextFieldNecessityIndicator(props.necessityIndicator)
      ? {
          necessityIndicator: normalizeTextFieldNecessityIndicator(
            props.necessityIndicator,
          ),
        }
      : {}),
    ...(typeof props.isRequired === "boolean"
      ? { isRequired: props.isRequired }
      : {}),
    ...(typeof props.isDisabled === "boolean"
      ? { isDisabled: props.isDisabled }
      : {}),
    ...(typeof props.isReadOnly === "boolean"
      ? { isReadOnly: props.isReadOnly }
      : {}),
    ...(typeof props.isInvalid === "boolean"
      ? { isInvalid: props.isInvalid }
      : {}),
    ...(typeof props.hideTimeZone === "boolean"
      ? { hideTimeZone: props.hideTimeZone }
      : {}),
    ...(typeof props.shouldForceLeadingZeros === "boolean"
      ? { shouldForceLeadingZeros: props.shouldForceLeadingZeros }
      : {}),
    ...(typeof props.className === "string"
      ? { className: props.className }
      : {}),
    ...(isRecord(props.style) ? { style: props.style } : {}),
  };
}

export function toTimeFieldRacProps(
  props: TimeFieldCanonicalProps,
): TimeFieldRacProps {
  return {
    label: readString(props.label, "Time"),
    placeholderValue: readString(props.placeholderValue, "09:00"),
    granularity: normalizeTimeFieldGranularity(props.granularity),
    hourCycle: normalizeTimeFieldHourCycle(props.hourCycle),
    size: normalizeTextFieldSize(props.size),
    labelPosition: normalizeTextFieldLabelPosition(props.labelPosition),
    isQuiet: props.isQuiet === true,
    ...(typeof props.value === "string" && props.value.length > 0
      ? { value: props.value }
      : {}),
    ...(typeof props.defaultValue === "string" && props.defaultValue.length > 0
      ? { defaultValue: props.defaultValue }
      : {}),
    ...(typeof props.description === "string"
      ? { description: props.description }
      : {}),
    ...(typeof props.errorMessage === "string"
      ? { errorMessage: props.errorMessage }
      : {}),
    ...(typeof props.locale === "string" && props.locale.length > 0
      ? { locale: props.locale }
      : {}),
    ...(typeof props.minValue === "string" && props.minValue.length > 0
      ? { minValue: props.minValue }
      : {}),
    ...(typeof props.maxValue === "string" && props.maxValue.length > 0
      ? { maxValue: props.maxValue }
      : {}),
    ...(normalizeTextFieldNecessityIndicator(props.necessityIndicator)
      ? {
          necessityIndicator: normalizeTextFieldNecessityIndicator(
            props.necessityIndicator,
          ),
        }
      : {}),
    ...(typeof props.isRequired === "boolean"
      ? { isRequired: props.isRequired }
      : {}),
    ...(typeof props.isDisabled === "boolean"
      ? { isDisabled: props.isDisabled }
      : {}),
    ...(typeof props.isReadOnly === "boolean"
      ? { isReadOnly: props.isReadOnly }
      : {}),
    ...(typeof props.isInvalid === "boolean"
      ? { isInvalid: props.isInvalid }
      : {}),
    ...(typeof props.hideTimeZone === "boolean"
      ? { hideTimeZone: props.hideTimeZone }
      : {}),
    ...(typeof props.shouldForceLeadingZeros === "boolean"
      ? { shouldForceLeadingZeros: props.shouldForceLeadingZeros }
      : {}),
    ...(typeof props.className === "string"
      ? { className: props.className }
      : {}),
    ...(isRecord(props.style) ? { style: props.style } : {}),
  };
}

export function toColorFieldRacProps(
  props: ColorFieldCanonicalProps,
): ColorFieldRacProps {
  return {
    label: readString(props.label, "Color"),
    placeholder: readString(props.placeholder, "#000000"),
    size: normalizeTextFieldSize(props.size),
    labelPosition: normalizeTextFieldLabelPosition(props.labelPosition),
    isQuiet: props.isQuiet === true,
    ...(normalizeColorFieldLabelAlign(props.labelAlign)
      ? { labelAlign: normalizeColorFieldLabelAlign(props.labelAlign) }
      : {}),
    ...(typeof props.value === "string" && props.value.length > 0
      ? { value: props.value }
      : {}),
    ...(typeof props.defaultValue === "string" && props.defaultValue.length > 0
      ? { defaultValue: props.defaultValue }
      : {}),
    ...(typeof props.description === "string"
      ? { description: props.description }
      : {}),
    ...(typeof props.errorMessage === "string"
      ? { errorMessage: props.errorMessage }
      : {}),
    ...(normalizeColorFieldChannel(props.channel)
      ? { channel: normalizeColorFieldChannel(props.channel) }
      : {}),
    ...(normalizeColorFieldColorSpace(props.colorSpace)
      ? { colorSpace: normalizeColorFieldColorSpace(props.colorSpace) }
      : {}),
    ...(normalizeTextFieldNecessityIndicator(props.necessityIndicator)
      ? {
          necessityIndicator: normalizeTextFieldNecessityIndicator(
            props.necessityIndicator,
          ),
        }
      : {}),
    ...(typeof props.isRequired === "boolean"
      ? { isRequired: props.isRequired }
      : {}),
    ...(typeof props.isDisabled === "boolean"
      ? { isDisabled: props.isDisabled }
      : {}),
    ...(typeof props.isReadOnly === "boolean"
      ? { isReadOnly: props.isReadOnly }
      : {}),
    ...(typeof props.isInvalid === "boolean"
      ? { isInvalid: props.isInvalid }
      : {}),
    ...(typeof props.className === "string"
      ? { className: props.className }
      : {}),
    ...(isRecord(props.style) ? { style: props.style } : {}),
  };
}

export function toFormRacProps(props: FormCanonicalProps): FormRacProps {
  return {
    size: normalizeTextFieldSize(props.size),
    variant: normalizeFormVariant(props.variant),
    labelPosition: normalizeTextFieldLabelPosition(props.labelPosition),
    labelAlign: normalizeFormLabelAlign(props.labelAlign),
    necessityIndicator: normalizeFormNecessityIndicator(
      props.necessityIndicator,
    ),
    validationBehavior: normalizeFormValidationBehavior(
      props.validationBehavior,
    ),
    ...(typeof props["aria-label"] === "string"
      ? { "aria-label": props["aria-label"] }
      : {}),
    ...(typeof props.action === "string" && props.action.length > 0
      ? { action: props.action }
      : {}),
    ...(normalizeFormMethod(props.method)
      ? { method: normalizeFormMethod(props.method) }
      : {}),
    ...(normalizeFormEncType(props.encType)
      ? { encType: normalizeFormEncType(props.encType) }
      : {}),
    ...(normalizeFormTarget(props.target)
      ? { target: normalizeFormTarget(props.target) }
      : {}),
    ...(typeof props.autoFocus === "boolean"
      ? { autoFocus: props.autoFocus }
      : {}),
    ...(typeof props.restoreFocus === "boolean"
      ? { restoreFocus: props.restoreFocus }
      : {}),
    ...(typeof props.isDisabled === "boolean"
      ? { isDisabled: props.isDisabled }
      : {}),
    ...(typeof props.className === "string"
      ? { className: props.className }
      : {}),
    ...(isRecord(props.style) ? { style: props.style } : {}),
  };
}

export function toFileTriggerRacProps(
  props: FileTriggerCanonicalProps,
): FileTriggerRacProps {
  const acceptedFileTypes = normalizeAcceptedFileTypes(props.acceptedFileTypes);
  return {
    ...(acceptedFileTypes.length > 0 ? { acceptedFileTypes } : {}),
    ...(typeof props.allowsMultiple === "boolean"
      ? { allowsMultiple: props.allowsMultiple }
      : {}),
    ...(typeof props.acceptDirectory === "boolean"
      ? { acceptDirectory: props.acceptDirectory }
      : {}),
    ...(normalizeFileTriggerDefaultCamera(props.defaultCamera)
      ? {
          defaultCamera: normalizeFileTriggerDefaultCamera(props.defaultCamera),
        }
      : {}),
  };
}

export function toDropZoneRacProps(
  props: DropZoneCanonicalProps,
): DropZoneRacProps {
  const description = readString(props.description, "").trim();
  return {
    label: readString(props.label, "Drop files here"),
    ...(description ? { description } : {}),
    size: normalizeDropZoneSize(props.size),
    isDropTarget: props.isDropTarget === true,
    ...(typeof props.isDisabled === "boolean"
      ? { isDisabled: props.isDisabled }
      : {}),
    ...(typeof props.className === "string"
      ? { className: props.className }
      : {}),
    ...(isRecord(props.style) ? { style: props.style } : {}),
  };
}

export function toLinkRacProps(props: LinkCanonicalProps): LinkRacProps {
  return {
    children: readLinkText(props),
    variant: normalizeLinkVariant(props.variant),
    size: normalizeLinkSize(props.size),
    isQuiet: props.isQuiet === true,
    staticColor: normalizeLinkStaticColor(props.staticColor),
    showExternalIcon: props.showExternalIcon !== false,
    ...(typeof props.href === "string" ? { href: props.href } : {}),
    ...(typeof props.target === "string" && LINK_TARGETS.has(props.target)
      ? { target: props.target as "_self" | "_blank" | "_parent" | "_top" }
      : {}),
    ...(typeof props.rel === "string" ? { rel: props.rel } : {}),
    ...(typeof props.isExternal === "boolean"
      ? { isExternal: props.isExternal }
      : {}),
    ...(typeof props.isLoading === "boolean"
      ? { isLoading: props.isLoading }
      : {}),
    ...(typeof props.isDisabled === "boolean"
      ? { isDisabled: props.isDisabled }
      : {}),
    ...(typeof props.className === "string"
      ? { className: props.className }
      : {}),
    ...(isRecord(props.style) ? { style: props.style } : {}),
  };
}

export function toToggleButtonRacProps(
  props: ToggleButtonCanonicalProps,
): ToggleButtonRacProps {
  return {
    children: readToggleButtonText(props),
    size: normalizeToggleButtonSize(props.size),
    isEmphasized: props.isEmphasized === true,
    isQuiet: props.isQuiet === true,
    ...(typeof props.isSelected === "boolean"
      ? { isSelected: props.isSelected }
      : {}),
    ...(typeof props.isDisabled === "boolean"
      ? { isDisabled: props.isDisabled }
      : {}),
    ...(typeof props.className === "string"
      ? { className: props.className }
      : {}),
    ...(isRecord(props.style) ? { style: props.style } : {}),
  };
}

export function toSwitchRacProps(props: SwitchCanonicalProps): SwitchRacProps {
  return {
    children: readSwitchText(props),
    size: normalizeSwitchSize(props.size),
    isEmphasized: props.isEmphasized === true,
    ...(typeof props.isSelected === "boolean"
      ? { isSelected: props.isSelected }
      : {}),
    ...(typeof props.defaultSelected === "boolean"
      ? { defaultSelected: props.defaultSelected }
      : {}),
    ...(typeof props.isDisabled === "boolean"
      ? { isDisabled: props.isDisabled }
      : {}),
    ...(typeof props.isReadOnly === "boolean"
      ? { isReadOnly: props.isReadOnly }
      : {}),
    ...(typeof props.isLoading === "boolean"
      ? { isLoading: props.isLoading }
      : {}),
    ...(typeof props.name === "string" ? { name: props.name } : {}),
    ...(typeof props.value === "string" ? { value: props.value } : {}),
    ...(typeof props.className === "string"
      ? { className: props.className }
      : {}),
    ...(isRecord(props.style) ? { style: props.style } : {}),
  };
}

export function toCheckboxRacProps(
  props: CheckboxCanonicalProps,
): CheckboxRacProps {
  return {
    children: readCheckboxText(props),
    size: normalizeCheckboxSize(props.size),
    isEmphasized: props.isEmphasized === true,
    ...(typeof props.isSelected === "boolean"
      ? { isSelected: props.isSelected }
      : {}),
    ...(typeof props.defaultSelected === "boolean"
      ? { defaultSelected: props.defaultSelected }
      : {}),
    ...(typeof props.isIndeterminate === "boolean"
      ? { isIndeterminate: props.isIndeterminate }
      : {}),
    ...(typeof props.isDisabled === "boolean"
      ? { isDisabled: props.isDisabled }
      : {}),
    ...(typeof props.isInvalid === "boolean"
      ? { isInvalid: props.isInvalid }
      : {}),
    ...(typeof props.isReadOnly === "boolean"
      ? { isReadOnly: props.isReadOnly }
      : {}),
    ...(typeof props.isRequired === "boolean"
      ? { isRequired: props.isRequired }
      : {}),
    ...(typeof props.isLoading === "boolean"
      ? { isLoading: props.isLoading }
      : {}),
    ...(typeof props.name === "string" ? { name: props.name } : {}),
    ...(typeof props.value === "string" ? { value: props.value } : {}),
    ...(typeof props.form === "string" ? { form: props.form } : {}),
    ...(typeof props.className === "string"
      ? { className: props.className }
      : {}),
    ...(isRecord(props.style) ? { style: props.style } : {}),
  };
}

export function toCheckboxGroupRacProps(
  props: CheckboxGroupCanonicalProps,
): CheckboxGroupRacProps {
  return {
    label: readString(props.label, "Checkbox Group"),
    size: normalizeCheckboxGroupSize(props.size),
    orientation: normalizeCheckboxGroupOrientation(props.orientation),
    labelPosition: normalizeCheckboxGroupLabelPosition(props.labelPosition),
    labelAlign: normalizeCheckboxGroupLabelAlign(props.labelAlign),
    isEmphasized: props.isEmphasized === true,
    ...(typeof props.description === "string"
      ? { description: props.description }
      : {}),
    ...(typeof props.errorMessage === "string"
      ? { errorMessage: props.errorMessage }
      : {}),
    ...(normalizeStringValueArray(props.value)
      ? { value: normalizeStringValueArray(props.value) }
      : {}),
    ...(normalizeStringValueArray(props.defaultValue)
      ? { defaultValue: normalizeStringValueArray(props.defaultValue) }
      : {}),
    ...(normalizeCheckboxGroupNecessityIndicator(props.necessityIndicator)
      ? {
          necessityIndicator: normalizeCheckboxGroupNecessityIndicator(
            props.necessityIndicator,
          ),
        }
      : {}),
    ...(typeof props.isDisabled === "boolean"
      ? { isDisabled: props.isDisabled }
      : {}),
    ...(typeof props.isInvalid === "boolean"
      ? { isInvalid: props.isInvalid }
      : {}),
    ...(typeof props.isReadOnly === "boolean"
      ? { isReadOnly: props.isReadOnly }
      : {}),
    ...(typeof props.isRequired === "boolean"
      ? { isRequired: props.isRequired }
      : {}),
    ...(typeof props.name === "string" ? { name: props.name } : {}),
    ...(typeof props.form === "string" ? { form: props.form } : {}),
    ...(normalizeFormValidationBehavior(props.validationBehavior)
      ? {
          validationBehavior: normalizeFormValidationBehavior(
            props.validationBehavior,
          ),
        }
      : {}),
    ...(typeof props.className === "string"
      ? { className: props.className }
      : {}),
    ...(isRecord(props.style) ? { style: props.style } : {}),
  };
}

export function toRadioRacProps(props: RadioCanonicalProps): RadioRacProps {
  return {
    children: readRadioText(props),
    variant: normalizeRadioVariant(props.variant),
    size: normalizeRadioSize(props.size),
    isEmphasized: props.isEmphasized === true,
    ...(typeof props.value === "string" || typeof props.value === "number"
      ? { value: String(props.value) }
      : {}),
    ...(typeof props.isSelected === "boolean"
      ? { isSelected: props.isSelected }
      : {}),
    ...(typeof props.defaultSelected === "boolean"
      ? { defaultSelected: props.defaultSelected }
      : {}),
    ...(typeof props.isDisabled === "boolean"
      ? { isDisabled: props.isDisabled }
      : {}),
    ...(typeof props.isReadOnly === "boolean"
      ? { isReadOnly: props.isReadOnly }
      : {}),
    ...(typeof props.autoFocus === "boolean"
      ? { autoFocus: props.autoFocus }
      : {}),
    ...(typeof props.className === "string"
      ? { className: props.className }
      : {}),
    ...(isRecord(props.style) ? { style: props.style } : {}),
  };
}

export function toRadioGroupRacProps(
  props: RadioGroupCanonicalProps,
): RadioGroupRacProps {
  return {
    label: readString(props.label, "Radio Group"),
    variant: normalizeRadioGroupVariant(props.variant),
    size: normalizeRadioGroupSize(props.size),
    orientation: normalizeRadioGroupOrientation(props.orientation),
    labelPosition: normalizeRadioGroupLabelPosition(props.labelPosition),
    labelAlign: normalizeRadioGroupLabelAlign(props.labelAlign),
    isEmphasized: props.isEmphasized === true,
    ...(typeof props.description === "string"
      ? { description: props.description }
      : {}),
    ...(typeof props.errorMessage === "string"
      ? { errorMessage: props.errorMessage }
      : {}),
    ...(typeof props.value === "string" || typeof props.value === "number"
      ? { value: String(props.value) }
      : {}),
    ...(typeof props.defaultValue === "string" ||
    typeof props.defaultValue === "number"
      ? { defaultValue: String(props.defaultValue) }
      : {}),
    ...(normalizeRadioGroupNecessityIndicator(props.necessityIndicator)
      ? {
          necessityIndicator: normalizeRadioGroupNecessityIndicator(
            props.necessityIndicator,
          ),
        }
      : {}),
    ...(typeof props.isDisabled === "boolean"
      ? { isDisabled: props.isDisabled }
      : {}),
    ...(typeof props.isInvalid === "boolean"
      ? { isInvalid: props.isInvalid }
      : {}),
    ...(typeof props.isReadOnly === "boolean"
      ? { isReadOnly: props.isReadOnly }
      : {}),
    ...(typeof props.isRequired === "boolean"
      ? { isRequired: props.isRequired }
      : {}),
    ...(typeof props.name === "string" ? { name: props.name } : {}),
    ...(typeof props.form === "string" ? { form: props.form } : {}),
    ...(normalizeFormValidationBehavior(props.validationBehavior)
      ? {
          validationBehavior: normalizeFormValidationBehavior(
            props.validationBehavior,
          ),
        }
      : {}),
    ...(typeof props.className === "string"
      ? { className: props.className }
      : {}),
    ...(isRecord(props.style) ? { style: props.style } : {}),
  };
}

export function toSliderRacProps(props: SliderCanonicalProps): SliderRacProps {
  return {
    label: readString(props.label, "Slider"),
    value: normalizeSliderValue(props.value),
    defaultValue: normalizeSliderValue(props.defaultValue),
    minValue: readFiniteNumber(props.minValue) ?? 0,
    maxValue: readFiniteNumber(props.maxValue) ?? 100,
    step: readFiniteNumber(props.step) ?? 1,
    size: normalizeSliderSize(props.size),
    orientation: normalizeSliderOrientation(props.orientation),
    isEmphasized: props.isEmphasized === true,
    showValueLabel: props.showValueLabel !== false,
    locale: typeof props.locale === "string" ? props.locale : "ko-KR",
    ...(typeof props.isDisabled === "boolean"
      ? { isDisabled: props.isDisabled }
      : {}),
    ...(typeof props.isReadOnly === "boolean"
      ? { isReadOnly: props.isReadOnly }
      : {}),
    ...(typeof props.isLoading === "boolean"
      ? { isLoading: props.isLoading }
      : {}),
    ...(normalizeNumberFieldFormatOptions(props.formatOptions)
      ? {
          formatOptions: normalizeNumberFieldFormatOptions(props.formatOptions),
        }
      : {}),
    ...(normalizeStringArray(props.thumbLabels)
      ? { thumbLabels: normalizeStringArray(props.thumbLabels) }
      : {}),
    ...(typeof props.name === "string" ? { name: props.name } : {}),
    ...(typeof props.form === "string" ? { form: props.form } : {}),
    ...(typeof props.className === "string"
      ? { className: props.className }
      : {}),
    ...(isRecord(props.style) ? { style: props.style } : {}),
  };
}

export function toListBoxRacProps(
  props: ListBoxCanonicalProps,
): ListBoxRacProps {
  const items = normalizeListBoxEntries(props.items);
  return {
    "aria-label": readString(props["aria-label"], "List"),
    variant: normalizeListBoxVariant(props.variant),
    orientation: normalizeListBoxOrientation(props.orientation),
    selectionMode: normalizeListBoxSelectionMode(props.selectionMode),
    selectionBehavior: normalizeListBoxSelectionBehavior(
      props.selectionBehavior,
    ),
    disallowEmptySelection: props.disallowEmptySelection === true,
    autoFocus: props.autoFocus === true,
    isDisabled: props.isDisabled === true,
    enableVirtualization: props.enableVirtualization === true,
    height: readFiniteNumber(props.height) ?? 300,
    overscan: readFiniteNumber(props.overscan) ?? 5,
    ...(typeof props.filterText === "string"
      ? { filterText: props.filterText }
      : {}),
    ...(normalizeStringArray(props.filterFields)
      ? { filterFields: normalizeStringArray(props.filterFields) }
      : {}),
    ...(typeof props.selectedKey === "string"
      ? { selectedKey: props.selectedKey }
      : {}),
    ...(normalizeStringValueArray(props.selectedKeys)
      ? { selectedKeys: normalizeStringValueArray(props.selectedKeys) }
      : {}),
    ...(typeof props.defaultSelectedKey === "string"
      ? { defaultSelectedKey: props.defaultSelectedKey }
      : {}),
    ...(normalizeStringValueArray(props.defaultSelectedKeys)
      ? {
          defaultSelectedKeys: normalizeStringValueArray(
            props.defaultSelectedKeys,
          ),
        }
      : {}),
    ...(items.length > 0 ? { items } : {}),
    ...(typeof props.className === "string"
      ? { className: props.className }
      : {}),
    ...(isRecord(props.style) ? { style: props.style } : {}),
  };
}

export function toGridListRacProps(
  props: GridListCanonicalProps,
): GridListRacProps {
  const items = normalizeGridListEntries(props.items);
  return {
    "aria-label": readString(props["aria-label"], "Grid List"),
    variant: normalizeGridListVariant(props.variant),
    layout: normalizeGridListLayout(props.layout),
    columns: normalizeGridListColumns(props.columns),
    selectionMode: normalizeGridListSelectionMode(props.selectionMode),
    selectionBehavior: normalizeGridListSelectionBehavior(
      props.selectionBehavior,
    ),
    disallowEmptySelection: props.disallowEmptySelection === true,
    autoFocus: props.autoFocus === true,
    isDisabled: props.isDisabled === true,
    allowsDragging: props.allowsDragging === true,
    renderEmptyState: props.renderEmptyState === true,
    validationBehavior: normalizeGridListValidationBehavior(
      props.validationBehavior,
    ),
    ...(typeof props.filterText === "string"
      ? { filterText: props.filterText }
      : {}),
    ...(normalizeStringArray(props.filterFields)
      ? { filterFields: normalizeStringArray(props.filterFields) }
      : {}),
    ...(typeof props.selectedKey === "string"
      ? { selectedKey: props.selectedKey }
      : {}),
    ...(normalizeStringValueArray(props.selectedKeys)
      ? { selectedKeys: normalizeStringValueArray(props.selectedKeys) }
      : {}),
    ...(typeof props.defaultSelectedKey === "string"
      ? { defaultSelectedKey: props.defaultSelectedKey }
      : {}),
    ...(normalizeStringValueArray(props.defaultSelectedKeys)
      ? {
          defaultSelectedKeys: normalizeStringValueArray(
            props.defaultSelectedKeys,
          ),
        }
      : {}),
    ...(items.length > 0 ? { items } : {}),
    ...(typeof props.className === "string"
      ? { className: props.className }
      : {}),
    ...(isRecord(props.style) ? { style: props.style } : {}),
  };
}

export function toTagGroupRacProps(
  props: TagGroupCanonicalProps,
): TagGroupRacProps {
  const items = normalizeTagGroupItems(props.items);
  const maxRows = normalizeTagGroupMaxRows(props.maxRows);
  return {
    ...(readString(props.label, "").trim()
      ? { label: readString(props.label, "") }
      : {}),
    ...(readString(props.description, "").trim()
      ? { description: readString(props.description, "") }
      : {}),
    ...(readString(props.errorMessage, "").trim()
      ? { errorMessage: readString(props.errorMessage, "") }
      : {}),
    ...(readString(props.contextualHelp, "").trim()
      ? { contextualHelp: readString(props.contextualHelp, "") }
      : {}),
    variant: normalizeTagGroupVariant(props.variant),
    size: normalizeTagGroupSize(props.size),
    labelPosition: normalizeTagGroupLabelPosition(props.labelPosition),
    labelAlign: normalizeTagGroupLabelAlign(props.labelAlign),
    ...(maxRows !== undefined ? { maxRows } : {}),
    isEmphasized: props.isEmphasized === true,
    ...(typeof props.filterText === "string"
      ? { filterText: props.filterText }
      : {}),
    ...(normalizeStringArray(props.filterFields)
      ? { filterFields: normalizeStringArray(props.filterFields) }
      : {}),
    selectionMode: normalizeTagGroupSelectionMode(props.selectionMode),
    selectionBehavior: normalizeTagGroupSelectionBehavior(
      props.selectionBehavior,
    ),
    ...(typeof props.selectedKey === "string"
      ? { selectedKey: props.selectedKey }
      : {}),
    ...(normalizeStringValueArray(props.selectedKeys)
      ? { selectedKeys: normalizeStringValueArray(props.selectedKeys) }
      : {}),
    ...(typeof props.defaultSelectedKey === "string"
      ? { defaultSelectedKey: props.defaultSelectedKey }
      : {}),
    ...(normalizeStringValueArray(props.defaultSelectedKeys)
      ? {
          defaultSelectedKeys: normalizeStringValueArray(
            props.defaultSelectedKeys,
          ),
        }
      : {}),
    disallowEmptySelection: props.disallowEmptySelection === true,
    isDisabled: props.isDisabled === true,
    isReadOnly: props.isReadOnly === true,
    isInvalid: props.isInvalid === true,
    allowsRemoving: props.allowsRemoving === true,
    allowsCustomValue: props.allowsCustomValue === true,
    ...(items.length > 0 ? { items } : {}),
    ...(typeof props.className === "string"
      ? { className: props.className }
      : {}),
    ...(isRecord(props.style) ? { style: props.style } : {}),
  };
}

export function toMenuRacProps(props: MenuCanonicalProps): MenuRacProps {
  const items = normalizeMenuItems(props.items);
  const label = readString(props.label ?? props.children, "Menu");
  return {
    label,
    children: readString(props.children ?? props.label, label),
    variant: normalizeMenuVariant(props.variant),
    size: normalizeMenuSize(props.size),
    align: normalizeMenuAlign(props.align),
    direction: normalizeMenuDirection(props.direction),
    shouldFlip: props.shouldFlip !== false,
    isQuiet: props.isQuiet === true,
    isDisabled: props.isDisabled === true,
    selectionMode: normalizeMenuSelectionMode(props.selectionMode),
    ...(normalizeStringValueArray(props.selectedKeys)
      ? { selectedKeys: normalizeStringValueArray(props.selectedKeys) }
      : {}),
    ...(normalizeStringValueArray(props.defaultSelectedKeys)
      ? {
          defaultSelectedKeys: normalizeStringValueArray(
            props.defaultSelectedKeys,
          ),
        }
      : {}),
    ...(items.length > 0 ? { items } : {}),
    ...(typeof props.className === "string"
      ? { className: props.className }
      : {}),
    ...(isRecord(props.style) ? { style: props.style } : {}),
  };
}

export function toComboBoxRacProps(
  props: ComboBoxCanonicalProps,
): ComboBoxRacProps {
  const items = normalizeComboBoxItems(props.items);
  return {
    ...(readString(props.label, "").trim()
      ? { label: readString(props.label, "") }
      : {}),
    ...(readString(props.description, "").trim()
      ? { description: readString(props.description, "") }
      : {}),
    ...(readString(props.errorMessage, "").trim()
      ? { errorMessage: readString(props.errorMessage, "") }
      : {}),
    ...(readString(props.contextualHelp, "").trim()
      ? { contextualHelp: readString(props.contextualHelp, "") }
      : {}),
    placeholder: readString(props.placeholder, "Type or select..."),
    ...(typeof props.inputValue === "string"
      ? { inputValue: props.inputValue }
      : {}),
    ...(typeof props.defaultInputValue === "string"
      ? { defaultInputValue: props.defaultInputValue }
      : {}),
    ...(typeof props.selectedKey === "string"
      ? { selectedKey: props.selectedKey }
      : {}),
    ...(typeof props.defaultSelectedKey === "string"
      ? { defaultSelectedKey: props.defaultSelectedKey }
      : {}),
    ...(items.length > 0 ? { items } : {}),
    size: normalizeComboBoxSize(props.size),
    iconName: readString(props.iconName, "chevron-down"),
    labelPosition: normalizeComboBoxLabelPosition(props.labelPosition),
    isQuiet: props.isQuiet === true,
    allowsCustomValue: props.allowsCustomValue === true,
    ...(normalizeComboBoxNecessityIndicator(props.necessityIndicator)
      ? {
          necessityIndicator: normalizeComboBoxNecessityIndicator(
            props.necessityIndicator,
          ),
        }
      : {}),
    isRequired: props.isRequired === true,
    isInvalid: props.isInvalid === true,
    isDisabled: props.isDisabled === true,
    isReadOnly: props.isReadOnly === true,
    autoFocus: props.autoFocus === true,
    menuTrigger: normalizeComboBoxMenuTrigger(props.menuTrigger),
    validationBehavior: normalizeComboBoxValidationBehavior(
      props.validationBehavior,
    ),
    ...(typeof props.name === "string" ? { name: props.name } : {}),
    ...(typeof props.form === "string" ? { form: props.form } : {}),
    ...(typeof props.className === "string"
      ? { className: props.className }
      : {}),
    ...(isRecord(props.style) ? { style: props.style } : {}),
  };
}

export function toSelectRacProps(props: SelectCanonicalProps): SelectRacProps {
  const items = normalizeSelectItems(props.items);
  return {
    ...(readString(props.label, "").trim()
      ? { label: readString(props.label, "") }
      : {}),
    ...(readString(props.description, "").trim()
      ? { description: readString(props.description, "") }
      : {}),
    ...(readString(props.errorMessage, "").trim()
      ? { errorMessage: readString(props.errorMessage, "") }
      : {}),
    ...(readString(props.contextualHelp, "").trim()
      ? { contextualHelp: readString(props.contextualHelp, "") }
      : {}),
    placeholder: readString(props.placeholder, "Choose an option..."),
    ...(typeof props.selectedKey === "string"
      ? { selectedKey: props.selectedKey }
      : {}),
    ...(typeof props.defaultSelectedKey === "string"
      ? { defaultSelectedKey: props.defaultSelectedKey }
      : {}),
    ...(items.length > 0 ? { items } : {}),
    size: normalizeSelectSize(props.size),
    iconName: readString(props.iconName, "chevron-down"),
    labelPosition: normalizeSelectLabelPosition(props.labelPosition),
    labelAlign: normalizeSelectLabelAlign(props.labelAlign),
    isQuiet: props.isQuiet === true,
    isLoading: props.isLoading === true,
    align: normalizeSelectAlign(props.align),
    direction: normalizeSelectDirection(props.direction),
    shouldFlip: props.shouldFlip !== false,
    ...(typeof props.menuWidth === "string"
      ? { menuWidth: props.menuWidth }
      : {}),
    disallowEmptySelection: props.disallowEmptySelection === true,
    ...(normalizeSelectNecessityIndicator(props.necessityIndicator)
      ? {
          necessityIndicator: normalizeSelectNecessityIndicator(
            props.necessityIndicator,
          ),
        }
      : {}),
    isRequired: props.isRequired === true,
    isInvalid: props.isInvalid === true,
    isDisabled: props.isDisabled === true,
    isReadOnly: props.isReadOnly === true,
    autoFocus: props.autoFocus === true,
    validationBehavior: normalizeSelectValidationBehavior(
      props.validationBehavior,
    ),
    ...(typeof props.name === "string" ? { name: props.name } : {}),
    ...(typeof props.form === "string" ? { form: props.form } : {}),
    ...(typeof props.className === "string"
      ? { className: props.className }
      : {}),
    ...(isRecord(props.style) ? { style: props.style } : {}),
  };
}

export function toTabsRacProps(props: TabsCanonicalProps): TabsRacProps {
  const items = normalizeTabsItems(props.items);
  return {
    "aria-label": readString(props["aria-label"], "Tabs"),
    ...(items.length > 0 ? { items } : {}),
    density: normalizeTabsDensity(props.density),
    size: normalizeTabsSize(props.size),
    orientation: normalizeTabsOrientation(props.orientation),
    showIndicator: props.showIndicator !== false,
    ...(typeof props.selectedKey === "string"
      ? { selectedKey: props.selectedKey }
      : {}),
    ...(typeof props.defaultSelectedKey === "string"
      ? { defaultSelectedKey: props.defaultSelectedKey }
      : {}),
    isDisabled: props.isDisabled === true,
    keyboardActivation: normalizeTabsKeyboardActivation(
      props.keyboardActivation,
    ),
    ...(typeof props.className === "string"
      ? { className: props.className }
      : {}),
    ...(isRecord(props.style) ? { style: props.style } : {}),
  };
}

export function toTreeRacProps(props: TreeCanonicalProps): TreeRacProps {
  const items = normalizeTreeItems(props.items);
  return {
    "aria-label": readString(props["aria-label"], "Tree"),
    variant: normalizeTreeVariant(props.variant),
    selectionMode: normalizeTreeSelectionMode(props.selectionMode),
    selectionBehavior: normalizeTreeSelectionBehavior(props.selectionBehavior),
    disallowEmptySelection: props.disallowEmptySelection === true,
    autoFocus: props.autoFocus === true,
    isDisabled: props.isDisabled === true,
    ...(typeof props.selectedKey === "string"
      ? { selectedKey: props.selectedKey }
      : {}),
    ...(normalizeStringValueArray(props.selectedKeys)
      ? { selectedKeys: normalizeStringValueArray(props.selectedKeys) }
      : {}),
    ...(typeof props.defaultSelectedKey === "string"
      ? { defaultSelectedKey: props.defaultSelectedKey }
      : {}),
    ...(normalizeStringValueArray(props.defaultSelectedKeys)
      ? {
          defaultSelectedKeys: normalizeStringValueArray(
            props.defaultSelectedKeys,
          ),
        }
      : {}),
    ...(normalizeStringValueArray(props.expandedKeys)
      ? { expandedKeys: normalizeStringValueArray(props.expandedKeys) }
      : {}),
    ...(normalizeStringValueArray(props.defaultExpandedKeys)
      ? {
          defaultExpandedKeys: normalizeStringValueArray(
            props.defaultExpandedKeys,
          ),
        }
      : {}),
    ...(items.length > 0 ? { items } : {}),
    ...(typeof props.className === "string"
      ? { className: props.className }
      : {}),
    ...(isRecord(props.style) ? { style: props.style } : {}),
  };
}

export function toTableRacProps(props: TableCanonicalProps): TableRacProps {
  const columns = normalizeTableColumns(props.columns);
  const rows = normalizeTableRows(props.rows ?? props.items, columns);
  return {
    "aria-label": readString(props["aria-label"], "Table"),
    density: normalizeTableDensity(props.density),
    selectionMode: normalizeTableSelectionMode(props.selectionMode),
    selectionBehavior: normalizeTableSelectionBehavior(props.selectionBehavior),
    disallowEmptySelection: props.disallowEmptySelection === true,
    allowsSorting: props.allowsSorting === true,
    allowsResizingColumns: props.allowsResizingColumns === true,
    isQuiet: props.isQuiet === true,
    ...(normalizeStringValueArray(props.selectedKeys)
      ? { selectedKeys: normalizeStringValueArray(props.selectedKeys) }
      : {}),
    ...(normalizeStringValueArray(props.defaultSelectedKeys)
      ? {
          defaultSelectedKeys: normalizeStringValueArray(
            props.defaultSelectedKeys,
          ),
        }
      : {}),
    ...(typeof props.sortColumn === "string"
      ? { sortColumn: props.sortColumn }
      : {}),
    sortDirection: normalizeTableSortDirection(props.sortDirection),
    columns,
    rows,
    ...(typeof props.className === "string"
      ? { className: props.className }
      : {}),
    ...(isRecord(props.style) ? { style: props.style } : {}),
  };
}

export function toToggleButtonGroupRacProps(
  props: ToggleButtonGroupCanonicalProps,
): ToggleButtonGroupRacProps {
  return {
    size: normalizeToggleButtonGroupSize(props.size),
    orientation: normalizeToggleButtonGroupOrientation(props.orientation),
    selectionMode: normalizeToggleButtonGroupSelectionMode(props.selectionMode),
    indicator: props.indicator === true,
    isEmphasized: props.isEmphasized === true,
    isQuiet: props.isQuiet === true,
    ...(typeof props.isDisabled === "boolean"
      ? { isDisabled: props.isDisabled }
      : {}),
    ...(normalizeKeySet(props.selectedKeys ?? props.value)
      ? { selectedKeys: normalizeKeySet(props.selectedKeys ?? props.value) }
      : {}),
    ...(normalizeKeySet(props.defaultSelectedKeys)
      ? { defaultSelectedKeys: normalizeKeySet(props.defaultSelectedKeys) }
      : {}),
    ...(typeof props.className === "string"
      ? { className: props.className }
      : {}),
    ...(isRecord(props.style) ? { style: props.style } : {}),
  };
}

export function toToolbarRacProps(
  props: ToolbarCanonicalProps,
): ToolbarRacProps {
  return {
    "aria-label": readToolbarLabel(props),
    orientation: normalizeToolbarOrientation(props.orientation),
    variant: normalizeToolbarVariant(props.variant),
    size: normalizeToolbarSize(props.size),
    ...(typeof props.className === "string"
      ? { className: props.className }
      : {}),
    ...(isRecord(props.style) ? { style: props.style } : {}),
  };
}

function readButtonText(props: ButtonCanonicalProps): string {
  const value = props.children ?? props.text ?? props.label;
  if (typeof value === "string") return value;
  if (typeof value === "number") return String(value);
  return "Button";
}

function readBreadcrumbText(props: BreadcrumbCanonicalProps): string {
  const value = props.children ?? props.label ?? props.title;
  if (typeof value === "string") return value;
  if (typeof value === "number") return String(value);
  return "Breadcrumb";
}

function readBreadcrumbsLabel(props: BreadcrumbsCanonicalProps): string {
  return typeof props["aria-label"] === "string"
    ? props["aria-label"]
    : "Breadcrumbs";
}

function readLinkText(props: LinkCanonicalProps): string {
  const value = props.children ?? props.text ?? props.label;
  if (typeof value === "string") return value;
  if (typeof value === "number") return String(value);
  return "Link";
}

function readTextFieldLabel(props: TextFieldCanonicalProps): string {
  return readString(props.label, "Text Field");
}

function readString(value: unknown, fallback: string): string {
  if (typeof value === "string") return value;
  if (typeof value === "number") return String(value);
  return fallback;
}

function readFiniteNumber(value: unknown): number | undefined {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim().length > 0) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : undefined;
  }
  return undefined;
}

function normalizeStringArray(value: unknown): string[] | undefined {
  if (!Array.isArray(value)) return undefined;
  const strings = value.filter(
    (item): item is string => typeof item === "string",
  );
  return strings.length > 0 ? strings : undefined;
}

function normalizeStringValueArray(value: unknown): string[] | undefined {
  if (!Array.isArray(value)) return undefined;
  const strings = value
    .filter(
      (item): item is string | number =>
        typeof item === "string" || typeof item === "number",
    )
    .map((item) => String(item));
  return strings.length > 0 ? strings : undefined;
}

function normalizeSliderValue(value: unknown): number | number[] | undefined {
  if (Array.isArray(value)) {
    const numbers = value
      .map((item) => readFiniteNumber(item))
      .filter((item): item is number => typeof item === "number");
    return numbers.length > 0 ? numbers : undefined;
  }
  return readFiniteNumber(value);
}

function readToggleButtonText(props: ToggleButtonCanonicalProps): string {
  const value = props.children ?? props.text ?? props.label;
  if (typeof value === "string") return value;
  if (typeof value === "number") return String(value);
  return "Toggle";
}

function readSwitchText(props: SwitchCanonicalProps): string {
  const value = props.children ?? props.label;
  if (typeof value === "string") return value;
  if (typeof value === "number") return String(value);
  return "Switch";
}

function readCheckboxText(props: CheckboxCanonicalProps): string {
  const value = props.children ?? props.label;
  if (typeof value === "string") return value;
  if (typeof value === "number") return String(value);
  return "Checkbox";
}

function readRadioText(props: RadioCanonicalProps): string {
  const value = props.children ?? props.label ?? props.text;
  if (typeof value === "string") return value;
  if (typeof value === "number") return String(value);
  return "Radio";
}

function normalizeButtonVariant(value: unknown): ButtonVariant {
  return typeof value === "string" &&
    BUTTON_VARIANTS.has(value as ButtonVariant)
    ? (value as ButtonVariant)
    : "primary";
}

function normalizeButtonFillStyle(value: unknown): ButtonFillStyle {
  return typeof value === "string" &&
    BUTTON_FILL_STYLES.has(value as ButtonFillStyle)
    ? (value as ButtonFillStyle)
    : "fill";
}

function normalizeButtonSize(value: unknown): ComponentSize {
  return typeof value === "string" && BUTTON_SIZES.has(value as ComponentSize)
    ? (value as ComponentSize)
    : "md";
}

function normalizeButtonType(value: unknown): "button" | "submit" | "reset" {
  return typeof value === "string" && BUTTON_TYPES.has(value)
    ? (value as "button" | "submit" | "reset")
    : "button";
}

function normalizeTextFieldType(
  value: unknown,
): (typeof TEXT_FIELD_TYPE_VALUES)[number] {
  return typeof value === "string" && TEXT_FIELD_TYPES.has(value)
    ? (value as (typeof TEXT_FIELD_TYPE_VALUES)[number])
    : "text";
}

function normalizeSearchFieldType(
  value: unknown,
): (typeof SEARCH_FIELD_TYPE_VALUES)[number] {
  return typeof value === "string" && SEARCH_FIELD_TYPES.has(value)
    ? (value as (typeof SEARCH_FIELD_TYPE_VALUES)[number])
    : "search";
}

function normalizeSearchFieldInputMode(
  value: unknown,
): (typeof SEARCH_FIELD_INPUT_MODE_VALUES)[number] {
  return typeof value === "string" && SEARCH_FIELD_INPUT_MODES.has(value)
    ? (value as (typeof SEARCH_FIELD_INPUT_MODE_VALUES)[number])
    : "search";
}

function normalizeDateFieldGranularity(
  value: unknown,
): (typeof DATE_FIELD_GRANULARITY_VALUES)[number] {
  return typeof value === "string" && DATE_FIELD_GRANULARITIES.has(value)
    ? (value as (typeof DATE_FIELD_GRANULARITY_VALUES)[number])
    : "day";
}

function normalizeTimeFieldGranularity(
  value: unknown,
): (typeof TIME_FIELD_GRANULARITY_VALUES)[number] {
  return typeof value === "string" && TIME_FIELD_GRANULARITIES.has(value)
    ? (value as (typeof TIME_FIELD_GRANULARITY_VALUES)[number])
    : "minute";
}

function normalizeDateFieldHourCycle(value: unknown): 12 | 24 {
  if (value === 12 || value === "12") return 12;
  if (
    value === 24 ||
    value === "24" ||
    (typeof value === "string" && DATE_FIELD_HOUR_CYCLES.has(value))
  ) {
    return 24;
  }
  return 24;
}

function normalizeTimeFieldHourCycle(value: unknown): 12 | 24 {
  if (value === 12 || value === "12") return 12;
  if (
    value === 24 ||
    value === "24" ||
    (typeof value === "string" && TIME_FIELD_HOUR_CYCLES.has(value))
  ) {
    return 24;
  }
  return 24;
}

function normalizeDateFieldCalendar(
  value: unknown,
): (typeof DATE_FIELD_CALENDAR_VALUES)[number] | undefined {
  return typeof value === "string" && DATE_FIELD_CALENDARS.has(value)
    ? (value as (typeof DATE_FIELD_CALENDAR_VALUES)[number])
    : undefined;
}

function normalizeTextFieldSize(value: unknown): ComponentSize {
  return normalizeButtonSize(value);
}

function normalizeDropZoneSize(value: unknown): ComponentSizeSubset {
  return typeof value === "string" &&
    DROP_ZONE_SIZES.has(value as ComponentSizeSubset)
    ? (value as ComponentSizeSubset)
    : "md";
}

function normalizeTextFieldLabelPosition(value: unknown): "top" | "side" {
  return typeof value === "string" && TEXT_FIELD_LABEL_POSITIONS.has(value)
    ? (value as "top" | "side")
    : "top";
}

function normalizeTextFieldNecessityIndicator(
  value: unknown,
): "icon" | "label" | undefined {
  return typeof value === "string" && TEXT_FIELD_NECESSITY_INDICATORS.has(value)
    ? (value as "icon" | "label")
    : undefined;
}

function normalizeColorFieldChannel(
  value: unknown,
): (typeof COLOR_FIELD_CHANNEL_VALUES)[number] | undefined {
  return typeof value === "string" && COLOR_FIELD_CHANNELS.has(value)
    ? (value as (typeof COLOR_FIELD_CHANNEL_VALUES)[number])
    : undefined;
}

function normalizeColorFieldColorSpace(
  value: unknown,
): (typeof COLOR_FIELD_COLOR_SPACE_VALUES)[number] | undefined {
  return typeof value === "string" && COLOR_FIELD_COLOR_SPACES.has(value)
    ? (value as (typeof COLOR_FIELD_COLOR_SPACE_VALUES)[number])
    : undefined;
}

function normalizeColorFieldLabelAlign(
  value: unknown,
): "start" | "center" | "end" | undefined {
  return typeof value === "string" && COLOR_FIELD_LABEL_ALIGNS.has(value)
    ? (value as "start" | "center" | "end")
    : undefined;
}

function normalizeFormLabelAlign(value: unknown): "start" | "center" | "end" {
  return normalizeColorFieldLabelAlign(value) ?? "start";
}

function normalizeFormNecessityIndicator(value: unknown): "icon" | "label" {
  return normalizeTextFieldNecessityIndicator(value) ?? "icon";
}

function normalizeFormVariant(
  value: unknown,
): (typeof FORM_VARIANT_VALUES)[number] {
  return typeof value === "string" && FORM_VARIANTS.has(value)
    ? (value as (typeof FORM_VARIANT_VALUES)[number])
    : "default";
}

function normalizeFormMethod(
  value: unknown,
): (typeof FORM_METHOD_VALUES)[number] | undefined {
  return typeof value === "string" && FORM_METHODS.has(value)
    ? (value as (typeof FORM_METHOD_VALUES)[number])
    : undefined;
}

function normalizeFormEncType(
  value: unknown,
): (typeof FORM_ENCTYPE_VALUES)[number] | undefined {
  return typeof value === "string" && FORM_ENCTYPES.has(value)
    ? (value as (typeof FORM_ENCTYPE_VALUES)[number])
    : undefined;
}

function normalizeFormTarget(
  value: unknown,
): (typeof FORM_TARGET_VALUES)[number] | undefined {
  return typeof value === "string" && FORM_TARGETS.has(value)
    ? (value as (typeof FORM_TARGET_VALUES)[number])
    : undefined;
}

function normalizeFormValidationBehavior(
  value: unknown,
): (typeof FORM_VALIDATION_BEHAVIOR_VALUES)[number] {
  return typeof value === "string" && FORM_VALIDATION_BEHAVIORS.has(value)
    ? (value as (typeof FORM_VALIDATION_BEHAVIOR_VALUES)[number])
    : "native";
}

function normalizeAcceptedFileTypes(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter((item): item is string => typeof item === "string");
}

function normalizeFileTriggerDefaultCamera(
  value: unknown,
): (typeof FILE_TRIGGER_DEFAULT_CAMERA_VALUES)[number] | undefined {
  return typeof value === "string" && FILE_TRIGGER_DEFAULT_CAMERAS.has(value)
    ? (value as (typeof FILE_TRIGGER_DEFAULT_CAMERA_VALUES)[number])
    : undefined;
}

function normalizeNumberFieldFormatOptions(
  value: unknown,
): Intl.NumberFormatOptions | undefined {
  if (!isRecord(value)) return undefined;

  const options: Intl.NumberFormatOptions = {};
  if (
    typeof value.style === "string" &&
    NUMBER_FIELD_FORMAT_STYLES.has(value.style)
  ) {
    options.style = value.style as Intl.NumberFormatOptions["style"];
  }
  if (
    typeof value.notation === "string" &&
    NUMBER_FIELD_NOTATIONS.has(value.notation)
  ) {
    options.notation = value.notation as Intl.NumberFormatOptions["notation"];
  }
  if (typeof value.currency === "string" && value.currency.length > 0) {
    options.currency = value.currency;
  }
  if (typeof value.unit === "string" && value.unit.length > 0) {
    options.unit = value.unit;
  }
  if (typeof value.currencyDisplay === "string") {
    options.currencyDisplay =
      value.currencyDisplay as Intl.NumberFormatOptions["currencyDisplay"];
  }
  if (typeof value.unitDisplay === "string") {
    options.unitDisplay =
      value.unitDisplay as Intl.NumberFormatOptions["unitDisplay"];
  }

  return Object.keys(options).length > 0 ? options : undefined;
}

function normalizeSearchFieldAutoCorrect(
  value: unknown,
): "on" | "off" | undefined {
  return value === "on" || value === "off" ? value : undefined;
}

function normalizeSearchFieldEnterKeyHint(
  value: unknown,
): (typeof SEARCH_FIELD_ENTER_KEY_HINT_VALUES)[number] | undefined {
  return typeof value === "string" && SEARCH_FIELD_ENTER_KEY_HINTS.has(value)
    ? (value as (typeof SEARCH_FIELD_ENTER_KEY_HINT_VALUES)[number])
    : undefined;
}

function normalizeButtonIconPosition(value: unknown): "start" | "end" {
  return typeof value === "string" && BUTTON_ICON_POSITIONS.has(value)
    ? (value as "start" | "end")
    : "start";
}

function normalizeButtonIconStrokeWidth(value: unknown): number {
  return typeof value === "number" && value >= 0.5 && value <= 4 ? value : 2;
}

function normalizeSeparatorOrientation(
  value: unknown,
): "horizontal" | "vertical" {
  return typeof value === "string" && SEPARATOR_ORIENTATIONS.has(value)
    ? (value as "horizontal" | "vertical")
    : "horizontal";
}

function normalizeSeparatorVariant(value: unknown): SeparatorVariant {
  return typeof value === "string" &&
    SEPARATOR_VARIANTS.has(value as SeparatorVariant)
    ? (value as SeparatorVariant)
    : "default";
}

function normalizeSeparatorSize(value: unknown): ComponentSizeSubset {
  return typeof value === "string" &&
    SEPARATOR_SIZES.has(value as ComponentSizeSubset)
    ? (value as ComponentSizeSubset)
    : "md";
}

function normalizeLinkVariant(value: unknown): LinkVariant {
  return typeof value === "string" && LINK_VARIANTS.has(value as LinkVariant)
    ? (value as LinkVariant)
    : "primary";
}

function normalizeLinkSize(value: unknown): ComponentSize {
  return typeof value === "string" && LINK_SIZES.has(value as ComponentSize)
    ? (value as ComponentSize)
    : "md";
}

function normalizeLinkStaticColor(value: unknown): StaticColor {
  return typeof value === "string" &&
    LINK_STATIC_COLORS.has(value as StaticColor)
    ? (value as StaticColor)
    : "auto";
}

function normalizeToggleButtonSize(value: unknown): ComponentSizeSubset {
  return typeof value === "string" &&
    TOGGLE_BUTTON_SIZES.has(value as ComponentSizeSubset)
    ? (value as ComponentSizeSubset)
    : "md";
}

function normalizeBreadcrumbsSize(value: unknown): "S" | "M" | "L" {
  return typeof value === "string" && BREADCRUMBS_SIZES.has(value)
    ? (value as "S" | "M" | "L")
    : "M";
}

function normalizeToggleButtonGroupSize(value: unknown): ComponentSizeSubset {
  return typeof value === "string" &&
    TOGGLE_BUTTON_GROUP_SIZES.has(value as ComponentSizeSubset)
    ? (value as ComponentSizeSubset)
    : "md";
}

function normalizeToggleButtonGroupOrientation(
  value: unknown,
): "horizontal" | "vertical" {
  return typeof value === "string" &&
    TOGGLE_BUTTON_GROUP_ORIENTATIONS.has(value)
    ? (value as "horizontal" | "vertical")
    : "horizontal";
}

function normalizeToggleButtonGroupSelectionMode(
  value: unknown,
): "single" | "multiple" {
  return typeof value === "string" &&
    TOGGLE_BUTTON_GROUP_SELECTION_MODES.has(value)
    ? (value as "single" | "multiple")
    : "single";
}

function normalizeKeySet(value: unknown): Set<string> | undefined {
  if (Array.isArray(value)) {
    return new Set(value.map((item) => String(item)));
  }
  if (value instanceof Set) {
    return new Set(Array.from(value).map((item) => String(item)));
  }
  return undefined;
}

function readToolbarLabel(props: ToolbarCanonicalProps): string {
  return typeof props["aria-label"] === "string"
    ? props["aria-label"]
    : "Toolbar";
}

function normalizeToolbarOrientation(
  value: unknown,
): "horizontal" | "vertical" {
  return typeof value === "string" && TOOLBAR_ORIENTATIONS.has(value)
    ? (value as "horizontal" | "vertical")
    : "horizontal";
}

function normalizeToolbarSize(value: unknown): ComponentSizeSubset {
  return typeof value === "string" &&
    TOOLBAR_SIZES.has(value as ComponentSizeSubset)
    ? (value as ComponentSizeSubset)
    : "md";
}

function normalizeToolbarVariant(value: unknown): "default" | "accent" {
  return typeof value === "string" && TOOLBAR_VARIANTS.has(value)
    ? (value as "default" | "accent")
    : "default";
}

function normalizeSwitchSize(value: unknown): ComponentSizeSubset {
  return typeof value === "string" &&
    SWITCH_SIZES.has(value as ComponentSizeSubset)
    ? (value as ComponentSizeSubset)
    : "md";
}

function normalizeCheckboxSize(value: unknown): ComponentSizeSubset {
  return typeof value === "string" &&
    CHECKBOX_SIZES.has(value as ComponentSizeSubset)
    ? (value as ComponentSizeSubset)
    : "md";
}

function normalizeCheckboxGroupSize(value: unknown): ComponentSizeSubset {
  return typeof value === "string" &&
    CHECKBOX_GROUP_SIZES.has(value as ComponentSizeSubset)
    ? (value as ComponentSizeSubset)
    : "md";
}

function normalizeCheckboxGroupOrientation(
  value: unknown,
): "horizontal" | "vertical" {
  return typeof value === "string" && CHECKBOX_GROUP_ORIENTATIONS.has(value)
    ? (value as "horizontal" | "vertical")
    : "vertical";
}

function normalizeCheckboxGroupLabelPosition(value: unknown): "top" | "side" {
  return typeof value === "string" && CHECKBOX_GROUP_LABEL_POSITIONS.has(value)
    ? (value as "top" | "side")
    : "top";
}

function normalizeCheckboxGroupLabelAlign(value: unknown): "start" | "end" {
  return typeof value === "string" && CHECKBOX_GROUP_LABEL_ALIGNS.has(value)
    ? (value as "start" | "end")
    : "start";
}

function normalizeCheckboxGroupNecessityIndicator(
  value: unknown,
): "icon" | "label" | undefined {
  return typeof value === "string" &&
    CHECKBOX_GROUP_NECESSITY_INDICATORS.has(value)
    ? (value as "icon" | "label")
    : undefined;
}

function normalizeRadioVariant(
  value: unknown,
): (typeof RADIO_VARIANT_VALUES)[number] {
  return typeof value === "string" && RADIO_VARIANTS.has(value)
    ? (value as (typeof RADIO_VARIANT_VALUES)[number])
    : "default";
}

function normalizeRadioSize(
  value: unknown,
): (typeof RADIO_SIZE_VALUES)[number] {
  return typeof value === "string" && RADIO_SIZES.has(value)
    ? (value as (typeof RADIO_SIZE_VALUES)[number])
    : "md";
}

function normalizeRadioGroupVariant(
  value: unknown,
): (typeof RADIO_GROUP_VARIANT_VALUES)[number] {
  return typeof value === "string" && RADIO_GROUP_VARIANTS.has(value)
    ? (value as (typeof RADIO_GROUP_VARIANT_VALUES)[number])
    : "default";
}

function normalizeRadioGroupSize(
  value: unknown,
): (typeof RADIO_GROUP_SIZE_VALUES)[number] {
  return typeof value === "string" && RADIO_GROUP_SIZES.has(value)
    ? (value as (typeof RADIO_GROUP_SIZE_VALUES)[number])
    : "md";
}

function normalizeRadioGroupOrientation(
  value: unknown,
): "horizontal" | "vertical" {
  return typeof value === "string" && RADIO_GROUP_ORIENTATIONS.has(value)
    ? (value as "horizontal" | "vertical")
    : "vertical";
}

function normalizeRadioGroupLabelPosition(value: unknown): "top" | "side" {
  return typeof value === "string" && RADIO_GROUP_LABEL_POSITIONS.has(value)
    ? (value as "top" | "side")
    : "top";
}

function normalizeRadioGroupLabelAlign(value: unknown): "start" | "end" {
  return typeof value === "string" && RADIO_GROUP_LABEL_ALIGNS.has(value)
    ? (value as "start" | "end")
    : "start";
}

function normalizeRadioGroupNecessityIndicator(
  value: unknown,
): "icon" | "label" | undefined {
  return typeof value === "string" &&
    RADIO_GROUP_NECESSITY_INDICATORS.has(value)
    ? (value as "icon" | "label")
    : undefined;
}

function normalizeSliderSize(value: unknown): ComponentSizeSubset {
  return typeof value === "string" &&
    SLIDER_SIZES.has(value as ComponentSizeSubset)
    ? (value as ComponentSizeSubset)
    : "md";
}

function normalizeSliderOrientation(value: unknown): "horizontal" | "vertical" {
  return typeof value === "string" && SLIDER_ORIENTATIONS.has(value)
    ? (value as "horizontal" | "vertical")
    : "horizontal";
}

function normalizeListBoxVariant(value: unknown): ListBoxRacProps["variant"] {
  return typeof value === "string" && LIST_BOX_VARIANTS.has(value)
    ? (value as ListBoxRacProps["variant"])
    : "default";
}

function normalizeListBoxOrientation(
  value: unknown,
): "horizontal" | "vertical" {
  return typeof value === "string" && LIST_BOX_ORIENTATIONS.has(value)
    ? (value as "horizontal" | "vertical")
    : "vertical";
}

function normalizeListBoxSelectionMode(
  value: unknown,
): (typeof LIST_BOX_SELECTION_MODE_VALUES)[number] {
  return typeof value === "string" && LIST_BOX_SELECTION_MODES.has(value)
    ? (value as (typeof LIST_BOX_SELECTION_MODE_VALUES)[number])
    : "single";
}

function normalizeListBoxSelectionBehavior(
  value: unknown,
): (typeof LIST_BOX_SELECTION_BEHAVIOR_VALUES)[number] {
  return typeof value === "string" && LIST_BOX_SELECTION_BEHAVIORS.has(value)
    ? (value as (typeof LIST_BOX_SELECTION_BEHAVIOR_VALUES)[number])
    : "toggle";
}

function normalizeListBoxEntries(value: unknown): ListBoxEntryDescriptor[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((entry) => normalizeListBoxEntry(entry))
    .filter((entry): entry is ListBoxEntryDescriptor => entry !== undefined);
}

function normalizeListBoxEntry(
  value: unknown,
): ListBoxEntryDescriptor | undefined {
  if (!isRecord(value)) return undefined;

  if (value.type === "section") {
    const items = normalizeListBoxEntries(value.items).filter(
      (entry): entry is ListBoxItemDescriptor => entry.type !== "section",
    );
    if (items.length === 0) return undefined;
    return {
      id: readString(value.id, `section-${items[0].id}`),
      type: "section",
      header: readString(value.header, "Section"),
      ...(typeof value.ariaLabel === "string"
        ? { ariaLabel: value.ariaLabel }
        : {}),
      items,
    };
  }

  const label = readString(value.label, "");
  if (!label) return undefined;
  const id = readString(value.id ?? value.value, label);
  return {
    id,
    label,
    ...(typeof value.value === "string" || typeof value.value === "number"
      ? { value: String(value.value) }
      : {}),
    ...(typeof value.textValue === "string"
      ? { textValue: value.textValue }
      : {}),
    ...(typeof value.description === "string"
      ? { description: value.description }
      : {}),
    ...(typeof value.isDisabled === "boolean"
      ? { isDisabled: value.isDisabled }
      : {}),
    ...(typeof value.href === "string" ? { href: value.href } : {}),
    ...(value.type === "item" ? { type: "item" as const } : {}),
  };
}

function normalizeGridListVariant(value: unknown): GridListRacProps["variant"] {
  return typeof value === "string" && GRID_LIST_VARIANTS.has(value)
    ? (value as GridListRacProps["variant"])
    : "default";
}

function normalizeGridListLayout(
  value: unknown,
): (typeof GRID_LIST_LAYOUT_VALUES)[number] {
  return typeof value === "string" && GRID_LIST_LAYOUTS.has(value)
    ? (value as (typeof GRID_LIST_LAYOUT_VALUES)[number])
    : "stack";
}

function normalizeGridListColumns(value: unknown): number {
  const columns = readFiniteNumber(value);
  if (columns === undefined) return 2;
  return Math.min(12, Math.max(1, Math.round(columns)));
}

function normalizeGridListSelectionMode(
  value: unknown,
): (typeof GRID_LIST_SELECTION_MODE_VALUES)[number] {
  return typeof value === "string" && GRID_LIST_SELECTION_MODES.has(value)
    ? (value as (typeof GRID_LIST_SELECTION_MODE_VALUES)[number])
    : "none";
}

function normalizeGridListSelectionBehavior(
  value: unknown,
): (typeof GRID_LIST_SELECTION_BEHAVIOR_VALUES)[number] {
  return typeof value === "string" && GRID_LIST_SELECTION_BEHAVIORS.has(value)
    ? (value as (typeof GRID_LIST_SELECTION_BEHAVIOR_VALUES)[number])
    : "toggle";
}

function normalizeGridListValidationBehavior(
  value: unknown,
): (typeof GRID_LIST_VALIDATION_BEHAVIOR_VALUES)[number] {
  return typeof value === "string" && GRID_LIST_VALIDATION_BEHAVIORS.has(value)
    ? (value as (typeof GRID_LIST_VALIDATION_BEHAVIOR_VALUES)[number])
    : "native";
}

function normalizeGridListEntries(value: unknown): GridListEntryDescriptor[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((entry) => normalizeGridListEntry(entry))
    .filter((entry): entry is GridListEntryDescriptor => entry !== undefined);
}

function normalizeGridListEntry(
  value: unknown,
): GridListEntryDescriptor | undefined {
  if (!isRecord(value)) return undefined;

  if (value.type === "section") {
    const items = normalizeGridListEntries(value.items).filter(
      (entry): entry is GridListItemDescriptor => entry.type !== "section",
    );
    if (items.length === 0) return undefined;
    return {
      id: readString(value.id, `section-${items[0].id}`),
      type: "section",
      header: readString(value.header, "Section"),
      ...(typeof value.ariaLabel === "string"
        ? { ariaLabel: value.ariaLabel }
        : {}),
      items,
    };
  }

  const label = readString(value.label, "");
  if (!label) return undefined;
  const id = readString(value.id, label);
  return {
    id,
    label,
    ...(typeof value.textValue === "string"
      ? { textValue: value.textValue }
      : {}),
    ...(typeof value.description === "string"
      ? { description: value.description }
      : {}),
    ...(typeof value.isDisabled === "boolean"
      ? { isDisabled: value.isDisabled }
      : {}),
    ...(value.type === "item" ? { type: "item" as const } : {}),
  };
}

function normalizeTagGroupVariant(value: unknown): TagGroupRacProps["variant"] {
  return typeof value === "string" && TAG_GROUP_VARIANTS.has(value)
    ? (value as TagGroupRacProps["variant"])
    : "default";
}

function normalizeTagGroupSize(
  value: unknown,
): (typeof TAG_GROUP_SIZE_VALUES)[number] {
  return typeof value === "string" && TAG_GROUP_SIZES.has(value)
    ? (value as (typeof TAG_GROUP_SIZE_VALUES)[number])
    : "md";
}

function normalizeTagGroupLabelPosition(
  value: unknown,
): (typeof TAG_GROUP_LABEL_POSITION_VALUES)[number] {
  return typeof value === "string" && TAG_GROUP_LABEL_POSITIONS.has(value)
    ? (value as (typeof TAG_GROUP_LABEL_POSITION_VALUES)[number])
    : "top";
}

function normalizeTagGroupLabelAlign(
  value: unknown,
): (typeof TAG_GROUP_LABEL_ALIGN_VALUES)[number] {
  return typeof value === "string" && TAG_GROUP_LABEL_ALIGNS.has(value)
    ? (value as (typeof TAG_GROUP_LABEL_ALIGN_VALUES)[number])
    : "start";
}

function normalizeTagGroupMaxRows(value: unknown): number | undefined {
  const maxRows = readFiniteNumber(value);
  if (maxRows === undefined || maxRows <= 0) return undefined;
  return Math.max(1, Math.round(maxRows));
}

function normalizeTagGroupSelectionMode(
  value: unknown,
): (typeof TAG_GROUP_SELECTION_MODE_VALUES)[number] {
  return typeof value === "string" && TAG_GROUP_SELECTION_MODES.has(value)
    ? (value as (typeof TAG_GROUP_SELECTION_MODE_VALUES)[number])
    : "none";
}

function normalizeTagGroupSelectionBehavior(
  value: unknown,
): (typeof TAG_GROUP_SELECTION_BEHAVIOR_VALUES)[number] {
  return typeof value === "string" && TAG_GROUP_SELECTION_BEHAVIORS.has(value)
    ? (value as (typeof TAG_GROUP_SELECTION_BEHAVIOR_VALUES)[number])
    : "toggle";
}

function normalizeTagGroupItems(value: unknown): TagGroupItemDescriptor[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((entry) => normalizeTagGroupItem(entry))
    .filter((entry): entry is TagGroupItemDescriptor => entry !== undefined);
}

function normalizeTagGroupItem(
  value: unknown,
): TagGroupItemDescriptor | undefined {
  if (!isRecord(value)) return undefined;
  const label = readString(value.label, "").trim();
  if (!label) return undefined;
  const id = readString(value.id, label);
  return {
    id,
    label,
    ...(typeof value.isDisabled === "boolean"
      ? { isDisabled: value.isDisabled }
      : {}),
    ...(typeof value.allowsRemoving === "boolean"
      ? { allowsRemoving: value.allowsRemoving }
      : {}),
  };
}

function normalizeMenuVariant(
  value: unknown,
): (typeof MENU_VARIANT_VALUES)[number] {
  return typeof value === "string" && MENU_VARIANTS.has(value)
    ? (value as (typeof MENU_VARIANT_VALUES)[number])
    : "primary";
}

function normalizeMenuSize(value: unknown): (typeof MENU_SIZE_VALUES)[number] {
  return typeof value === "string" && MENU_SIZES.has(value)
    ? (value as (typeof MENU_SIZE_VALUES)[number])
    : "md";
}

function normalizeMenuAlign(
  value: unknown,
): (typeof MENU_ALIGN_VALUES)[number] {
  return typeof value === "string" && MENU_ALIGNS.has(value)
    ? (value as (typeof MENU_ALIGN_VALUES)[number])
    : "start";
}

function normalizeMenuDirection(
  value: unknown,
): (typeof MENU_DIRECTION_VALUES)[number] {
  return typeof value === "string" && MENU_DIRECTIONS.has(value)
    ? (value as (typeof MENU_DIRECTION_VALUES)[number])
    : "bottom";
}

function normalizeMenuSelectionMode(
  value: unknown,
): (typeof MENU_SELECTION_MODE_VALUES)[number] {
  return typeof value === "string" && MENU_SELECTION_MODES.has(value)
    ? (value as (typeof MENU_SELECTION_MODE_VALUES)[number])
    : "none";
}

function normalizeMenuItems(value: unknown): MenuItemDescriptor[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((entry) => normalizeMenuItem(entry))
    .filter((entry): entry is MenuItemDescriptor => entry !== undefined);
}

function normalizeMenuItem(value: unknown): MenuItemDescriptor | undefined {
  if (!isRecord(value)) return undefined;
  if (value.type === "section" || value.type === "separator") {
    return undefined;
  }

  const label = readString(value.label, "").trim();
  if (!label) return undefined;
  const id = readString(value.id ?? value.value, label);
  const children = normalizeMenuItems(value.children);

  return {
    id,
    label,
    ...(typeof value.isDisabled === "boolean"
      ? { isDisabled: value.isDisabled }
      : {}),
    ...(typeof value.icon === "string" ? { icon: value.icon } : {}),
    ...(typeof value.shortcut === "string" ? { shortcut: value.shortcut } : {}),
    ...(typeof value.description === "string"
      ? { description: value.description }
      : {}),
    ...(typeof value.value === "string" || typeof value.value === "number"
      ? { value: String(value.value) }
      : {}),
    ...(typeof value.textValue === "string"
      ? { textValue: value.textValue }
      : {}),
    ...(typeof value.href === "string" ? { href: value.href } : {}),
    ...(children.length > 0 ? { children } : {}),
  };
}

function normalizeComboBoxSize(value: unknown): ComponentSize {
  return typeof value === "string" &&
    COMBO_BOX_SIZES.has(value as ComponentSize)
    ? (value as ComponentSize)
    : "md";
}

function normalizeComboBoxLabelPosition(
  value: unknown,
): (typeof COMBO_BOX_LABEL_POSITION_VALUES)[number] {
  return typeof value === "string" && COMBO_BOX_LABEL_POSITIONS.has(value)
    ? (value as (typeof COMBO_BOX_LABEL_POSITION_VALUES)[number])
    : "top";
}

function normalizeComboBoxNecessityIndicator(
  value: unknown,
): (typeof COMBO_BOX_NECESSITY_INDICATOR_VALUES)[number] | undefined {
  return typeof value === "string" && COMBO_BOX_NECESSITY_INDICATORS.has(value)
    ? (value as (typeof COMBO_BOX_NECESSITY_INDICATOR_VALUES)[number])
    : undefined;
}

function normalizeComboBoxMenuTrigger(
  value: unknown,
): (typeof COMBO_BOX_MENU_TRIGGER_VALUES)[number] {
  return typeof value === "string" && COMBO_BOX_MENU_TRIGGERS.has(value)
    ? (value as (typeof COMBO_BOX_MENU_TRIGGER_VALUES)[number])
    : "focus";
}

function normalizeComboBoxValidationBehavior(
  value: unknown,
): (typeof COMBO_BOX_VALIDATION_BEHAVIOR_VALUES)[number] {
  return typeof value === "string" && COMBO_BOX_VALIDATION_BEHAVIORS.has(value)
    ? (value as (typeof COMBO_BOX_VALIDATION_BEHAVIOR_VALUES)[number])
    : "native";
}

function normalizeComboBoxItems(value: unknown): ComboBoxItemDescriptor[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((entry) => normalizeComboBoxItem(entry))
    .filter((entry): entry is ComboBoxItemDescriptor => entry !== undefined);
}

function normalizeComboBoxItem(
  value: unknown,
): ComboBoxItemDescriptor | undefined {
  if (!isRecord(value)) return undefined;
  const label = readString(value.label, "").trim();
  if (!label) return undefined;
  const id = readString(value.id ?? value.value, label);
  return {
    id,
    label,
    ...(typeof value.value === "string" || typeof value.value === "number"
      ? { value: String(value.value) }
      : {}),
    ...(typeof value.textValue === "string"
      ? { textValue: value.textValue }
      : {}),
    ...(typeof value.isDisabled === "boolean"
      ? { isDisabled: value.isDisabled }
      : {}),
    ...(typeof value.icon === "string" ? { icon: value.icon } : {}),
    ...(typeof value.description === "string"
      ? { description: value.description }
      : {}),
  };
}

function normalizeSelectSize(value: unknown): ComponentSize {
  return typeof value === "string" && SELECT_SIZES.has(value as ComponentSize)
    ? (value as ComponentSize)
    : "md";
}

function normalizeSelectLabelPosition(
  value: unknown,
): (typeof SELECT_LABEL_POSITION_VALUES)[number] {
  return typeof value === "string" && SELECT_LABEL_POSITIONS.has(value)
    ? (value as (typeof SELECT_LABEL_POSITION_VALUES)[number])
    : "top";
}

function normalizeSelectLabelAlign(
  value: unknown,
): (typeof SELECT_LABEL_ALIGN_VALUES)[number] {
  return typeof value === "string" && SELECT_LABEL_ALIGNS.has(value)
    ? (value as (typeof SELECT_LABEL_ALIGN_VALUES)[number])
    : "start";
}

function normalizeSelectAlign(
  value: unknown,
): (typeof SELECT_ALIGN_VALUES)[number] {
  return typeof value === "string" && SELECT_ALIGNS.has(value)
    ? (value as (typeof SELECT_ALIGN_VALUES)[number])
    : "start";
}

function normalizeSelectDirection(
  value: unknown,
): (typeof SELECT_DIRECTION_VALUES)[number] {
  return typeof value === "string" && SELECT_DIRECTIONS.has(value)
    ? (value as (typeof SELECT_DIRECTION_VALUES)[number])
    : "bottom";
}

function normalizeSelectNecessityIndicator(
  value: unknown,
): (typeof SELECT_NECESSITY_INDICATOR_VALUES)[number] | undefined {
  return typeof value === "string" && SELECT_NECESSITY_INDICATORS.has(value)
    ? (value as (typeof SELECT_NECESSITY_INDICATOR_VALUES)[number])
    : undefined;
}

function normalizeSelectValidationBehavior(
  value: unknown,
): (typeof SELECT_VALIDATION_BEHAVIOR_VALUES)[number] {
  return typeof value === "string" && SELECT_VALIDATION_BEHAVIORS.has(value)
    ? (value as (typeof SELECT_VALIDATION_BEHAVIOR_VALUES)[number])
    : "native";
}

function normalizeSelectItems(value: unknown): SelectItemDescriptor[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((entry) => normalizeSelectItem(entry))
    .filter((entry): entry is SelectItemDescriptor => entry !== undefined);
}

function normalizeSelectItem(value: unknown): SelectItemDescriptor | undefined {
  if (!isRecord(value)) return undefined;
  const label = readString(value.label, "").trim();
  if (!label) return undefined;
  const id = readString(value.id ?? value.value, label);
  return {
    id,
    label,
    ...(typeof value.value === "string" || typeof value.value === "number"
      ? { value: String(value.value) }
      : {}),
    ...(typeof value.textValue === "string"
      ? { textValue: value.textValue }
      : {}),
    ...(typeof value.isDisabled === "boolean"
      ? { isDisabled: value.isDisabled }
      : {}),
    ...(typeof value.icon === "string" ? { icon: value.icon } : {}),
    ...(typeof value.description === "string"
      ? { description: value.description }
      : {}),
  };
}

function normalizeTabsDensity(
  value: unknown,
): (typeof TABS_DENSITY_VALUES)[number] {
  return typeof value === "string" && TABS_DENSITIES.has(value)
    ? (value as (typeof TABS_DENSITY_VALUES)[number])
    : "regular";
}

function normalizeTabsSize(value: unknown): ComponentSizeSubset {
  return typeof value === "string" &&
    TABS_SIZES.has(value as ComponentSizeSubset)
    ? (value as ComponentSizeSubset)
    : "md";
}

function normalizeTabsOrientation(
  value: unknown,
): (typeof TABS_ORIENTATION_VALUES)[number] {
  return typeof value === "string" && TABS_ORIENTATIONS.has(value)
    ? (value as (typeof TABS_ORIENTATION_VALUES)[number])
    : "horizontal";
}

function normalizeTabsKeyboardActivation(
  value: unknown,
): (typeof TABS_KEYBOARD_ACTIVATION_VALUES)[number] {
  return typeof value === "string" && TABS_KEYBOARD_ACTIVATIONS.has(value)
    ? (value as (typeof TABS_KEYBOARD_ACTIVATION_VALUES)[number])
    : "automatic";
}

function normalizeTabsItems(value: unknown): TabsItemDescriptor[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((entry) => normalizeTabsItem(entry))
    .filter((entry): entry is TabsItemDescriptor => entry !== undefined);
}

function normalizeTabsItem(value: unknown): TabsItemDescriptor | undefined {
  if (!isRecord(value)) return undefined;
  const label = readString(value.label ?? value.title ?? value.name, "").trim();
  if (!label) return undefined;
  const id = readString(value.id ?? value.value, label);
  const content = readString(
    value.content ?? value.description ?? value.body,
    "",
  ).trim();
  return {
    id,
    label,
    ...(content ? { content } : {}),
    ...(typeof value.textValue === "string"
      ? { textValue: value.textValue }
      : {}),
    ...(typeof value.isDisabled === "boolean"
      ? { isDisabled: value.isDisabled }
      : {}),
  };
}

function normalizeTreeVariant(
  value: unknown,
): (typeof TREE_VARIANT_VALUES)[number] {
  return typeof value === "string" && TREE_VARIANTS.has(value)
    ? (value as (typeof TREE_VARIANT_VALUES)[number])
    : "default";
}

function normalizeTreeSelectionMode(
  value: unknown,
): (typeof TREE_SELECTION_MODE_VALUES)[number] {
  return typeof value === "string" && TREE_SELECTION_MODES.has(value)
    ? (value as (typeof TREE_SELECTION_MODE_VALUES)[number])
    : "single";
}

function normalizeTreeSelectionBehavior(
  value: unknown,
): (typeof TREE_SELECTION_BEHAVIOR_VALUES)[number] {
  return typeof value === "string" && TREE_SELECTION_BEHAVIORS.has(value)
    ? (value as (typeof TREE_SELECTION_BEHAVIOR_VALUES)[number])
    : "toggle";
}

function normalizeTreeItems(value: unknown): TreeItemDescriptor[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((entry) => normalizeTreeItem(entry))
    .filter((entry): entry is TreeItemDescriptor => entry !== undefined);
}

function normalizeTreeItem(value: unknown): TreeItemDescriptor | undefined {
  if (!isRecord(value)) return undefined;
  const label = readString(value.label ?? value.title ?? value.name, "").trim();
  if (!label) return undefined;
  const id = readString(value.id ?? value.value, label);
  const children = normalizeTreeItems(value.children);
  return {
    id,
    label,
    ...(typeof value.textValue === "string"
      ? { textValue: value.textValue }
      : {}),
    ...(typeof value.description === "string"
      ? { description: value.description }
      : {}),
    ...(typeof value.isDisabled === "boolean"
      ? { isDisabled: value.isDisabled }
      : {}),
    ...(children.length > 0 ? { children } : {}),
  };
}

function normalizeTableDensity(
  value: unknown,
): (typeof TABLE_DENSITY_VALUES)[number] {
  return typeof value === "string" && TABLE_DENSITIES.has(value)
    ? (value as (typeof TABLE_DENSITY_VALUES)[number])
    : "regular";
}

function normalizeTableSelectionMode(
  value: unknown,
): (typeof TABLE_SELECTION_MODE_VALUES)[number] {
  return typeof value === "string" && TABLE_SELECTION_MODES.has(value)
    ? (value as (typeof TABLE_SELECTION_MODE_VALUES)[number])
    : "none";
}

function normalizeTableSelectionBehavior(
  value: unknown,
): (typeof TABLE_SELECTION_BEHAVIOR_VALUES)[number] {
  return typeof value === "string" && TABLE_SELECTION_BEHAVIORS.has(value)
    ? (value as (typeof TABLE_SELECTION_BEHAVIOR_VALUES)[number])
    : "toggle";
}

function normalizeTableSortDirection(
  value: unknown,
): (typeof TABLE_SORT_DIRECTION_VALUES)[number] {
  return typeof value === "string" && TABLE_SORT_DIRECTIONS.has(value)
    ? (value as (typeof TABLE_SORT_DIRECTION_VALUES)[number])
    : "ascending";
}

function normalizeTableColumns(value: unknown): TableColumnDescriptor[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((entry) => normalizeTableColumn(entry))
    .filter((entry): entry is TableColumnDescriptor => entry !== undefined);
}

function normalizeTableColumn(
  value: unknown,
): TableColumnDescriptor | undefined {
  if (!isRecord(value)) return undefined;
  const id = readString(value.id ?? value.key, "").trim();
  if (!id) return undefined;
  return {
    id,
    label: readString(value.label ?? value.children ?? value.title, id),
    ...(typeof value.isRowHeader === "boolean"
      ? { isRowHeader: value.isRowHeader }
      : {}),
    ...(typeof value.allowsSorting === "boolean"
      ? { allowsSorting: value.allowsSorting }
      : {}),
    ...(typeof value.allowsResizing === "boolean"
      ? { allowsResizing: value.allowsResizing }
      : {}),
    ...(readFiniteNumber(value.width) !== undefined
      ? { width: readFiniteNumber(value.width) }
      : {}),
    ...(readFiniteNumber(value.minWidth) !== undefined
      ? { minWidth: readFiniteNumber(value.minWidth) }
      : {}),
    ...(readFiniteNumber(value.maxWidth) !== undefined
      ? { maxWidth: readFiniteNumber(value.maxWidth) }
      : {}),
  };
}

function normalizeTableRows(
  value: unknown,
  columns: TableColumnDescriptor[],
): TableRowDescriptor[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((entry, index) => normalizeTableRow(entry, columns, index))
    .filter((entry): entry is TableRowDescriptor => entry !== undefined);
}

function normalizeTableRow(
  value: unknown,
  columns: TableColumnDescriptor[],
  index: number,
): TableRowDescriptor | undefined {
  if (!isRecord(value)) return undefined;
  const id = readString(value.id, `row-${index + 1}`);
  const row: TableRowDescriptor = { id };
  for (const [key, cellValue] of Object.entries(value)) {
    if (key === "id") continue;
    row[key] = normalizeTableCellValue(cellValue);
  }
  for (const column of columns) {
    if (row[column.id] === undefined) row[column.id] = "";
  }
  return row;
}

function normalizeTableCellValue(value: unknown): string {
  if (typeof value === "string") return value;
  if (typeof value === "number" || typeof value === "boolean") {
    return String(value);
  }
  if (value == null) return "";
  return JSON.stringify(value);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}
