import type {
  ButtonFillStyle,
  ButtonVariant,
  ComponentSizeSubset,
  ComponentSize,
  LinkVariant,
  SeparatorVariant,
  StaticColor,
} from "../../types/componentVariants.types";

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

const BUTTON_VARIANTS = new Set<ButtonVariant>(BUTTON_VARIANT_VALUES);
const BUTTON_FILL_STYLES = new Set<ButtonFillStyle>(BUTTON_FILL_STYLE_VALUES);
const BUTTON_SIZES = new Set<ComponentSize>(BUTTON_SIZE_VALUES);
const BUTTON_TYPES = new Set<string>(BUTTON_TYPE_VALUES);
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

export interface ButtonCanonicalProps extends Record<string, unknown> {
  children?: unknown;
  text?: unknown;
  label?: unknown;
  variant?: unknown;
  fillStyle?: unknown;
  size?: unknown;
  type?: unknown;
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

export function toButtonRacProps(props: ButtonCanonicalProps): ButtonRacProps {
  return {
    children: readButtonText(props),
    variant: normalizeButtonVariant(props.variant),
    fillStyle: normalizeButtonFillStyle(props.fillStyle),
    size: normalizeButtonSize(props.size),
    type: normalizeButtonType(props.type),
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

function readButtonText(props: ButtonCanonicalProps): string {
  const value = props.children ?? props.text ?? props.label;
  if (typeof value === "string") return value;
  if (typeof value === "number") return String(value);
  return "Button";
}

function readLinkText(props: LinkCanonicalProps): string {
  const value = props.children ?? props.text ?? props.label;
  if (typeof value === "string") return value;
  if (typeof value === "number") return String(value);
  return "Link";
}

function readToggleButtonText(props: ToggleButtonCanonicalProps): string {
  const value = props.children ?? props.text ?? props.label;
  if (typeof value === "string") return value;
  if (typeof value === "number") return String(value);
  return "Toggle";
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

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}
