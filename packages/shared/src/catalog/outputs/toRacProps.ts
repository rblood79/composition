import type {
  ButtonFillStyle,
  ButtonVariant,
  ComponentSize,
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

const BUTTON_VARIANTS = new Set<ButtonVariant>(BUTTON_VARIANT_VALUES);
const BUTTON_FILL_STYLES = new Set<ButtonFillStyle>(BUTTON_FILL_STYLE_VALUES);
const BUTTON_SIZES = new Set<ComponentSize>(BUTTON_SIZE_VALUES);
const BUTTON_TYPES = new Set<string>(BUTTON_TYPE_VALUES);

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

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}
