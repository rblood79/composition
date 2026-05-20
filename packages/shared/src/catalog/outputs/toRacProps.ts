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
export const SLIDER_SIZE_VALUES = SEPARATOR_SIZE_VALUES;
export const SLIDER_ORIENTATION_VALUES = SEPARATOR_ORIENTATION_VALUES;
export const SWITCH_SIZE_VALUES = SEPARATOR_SIZE_VALUES;

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
const SLIDER_SIZES = new Set<ComponentSizeSubset>(SLIDER_SIZE_VALUES);
const SLIDER_ORIENTATIONS = new Set<string>(SLIDER_ORIENTATION_VALUES);
const SWITCH_SIZES = new Set<ComponentSizeSubset>(SWITCH_SIZE_VALUES);
const BREADCRUMBS_SIZES = new Set<string>(BREADCRUMBS_SIZE_VALUES);

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

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}
