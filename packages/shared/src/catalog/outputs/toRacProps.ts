import type {
  ButtonFillStyle,
  ButtonVariant,
  ComponentSizeSubset,
  ComponentSize,
  SeparatorVariant,
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

const BUTTON_VARIANTS = new Set<ButtonVariant>(BUTTON_VARIANT_VALUES);
const BUTTON_FILL_STYLES = new Set<ButtonFillStyle>(BUTTON_FILL_STYLE_VALUES);
const BUTTON_SIZES = new Set<ComponentSize>(BUTTON_SIZE_VALUES);
const BUTTON_TYPES = new Set<string>(BUTTON_TYPE_VALUES);
const SEPARATOR_ORIENTATIONS = new Set<string>(SEPARATOR_ORIENTATION_VALUES);
const SEPARATOR_VARIANTS = new Set<SeparatorVariant>(SEPARATOR_VARIANT_VALUES);
const SEPARATOR_SIZES = new Set<ComponentSizeSubset>(SEPARATOR_SIZE_VALUES);

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

function readButtonText(props: ButtonCanonicalProps): string {
  const value = props.children ?? props.text ?? props.label;
  if (typeof value === "string") return value;
  if (typeof value === "number") return String(value);
  return "Button";
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

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}
