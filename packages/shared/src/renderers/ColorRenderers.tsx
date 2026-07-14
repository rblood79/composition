import React from "react";
import type { Color } from "react-aria-components";
import type { PreviewElement, RenderContext } from "../types";
import { ColorField } from "../components/ColorField";
import { resolveInheritedFormFieldProps } from "./FormRenderers";

type ColorFieldChannel =
  | "hue"
  | "saturation"
  | "lightness"
  | "brightness"
  | "red"
  | "green"
  | "blue"
  | "alpha";

/**
 * Color 관련 컴포넌트 렌더러
 * - ColorArea
 * - ColorSlider
 * - ColorWheel
 *
 * Preview에서는 간단한 HTML placeholder로 렌더링.
 * 실제 색상 인터랙션은 React Aria 컴포넌트가 담당.
 */

/**
 * ColorArea 렌더링 — 2D 색상 영역 선택기
 */
export const renderColorArea = (
  element: PreviewElement,
  _context: RenderContext,
): React.ReactNode => {
  return (
    <div
      key={element.id}
      data-element-id={element.id}
      data-custom-id={element.customId}
      style={{
        width: 192,
        height: 192,
        borderRadius: 4,
        background:
          "linear-gradient(to top, black, transparent), linear-gradient(to right, white, hsl(200, 100%, 50%))",
        position: "relative",
        ...element.props.style,
      }}
      className={element.props.className}
    />
  );
};

/**
 * ColorSlider 렌더링 — 단일 채널 색상 슬라이더
 */
export const renderColorSlider = (
  element: PreviewElement,
  _context: RenderContext,
): React.ReactNode => {
  const isVertical = element.props.orientation === "vertical";

  return (
    <div
      key={element.id}
      data-element-id={element.id}
      data-custom-id={element.customId}
      style={{
        width: isVertical ? 24 : 192,
        height: isVertical ? 192 : 24,
        borderRadius: 12,
        background:
          "linear-gradient(to right, red, yellow, lime, aqua, blue, magenta, red)",
        ...element.props.style,
      }}
      className={element.props.className}
    />
  );
};

/**
 * ColorWheel 렌더링 — 원형 색상 선택기
 */
export const renderColorWheel = (
  element: PreviewElement,
  _context: RenderContext,
): React.ReactNode => {
  return (
    <div
      key={element.id}
      data-element-id={element.id}
      data-custom-id={element.customId}
      style={{
        width: 192,
        height: 192,
        borderRadius: "50%",
        background:
          "conic-gradient(red, yellow, lime, aqua, blue, magenta, red)",
        ...element.props.style,
      }}
      className={element.props.className}
    />
  );
};

/**
 * ColorField 렌더링
 */
export const renderColorField = (
  element: PreviewElement,
  context: RenderContext,
): React.ReactNode => {
  const { updateElementProps } = context;
  const inheritedProps = resolveInheritedFormFieldProps(element, context);

  return (
    <ColorField
      key={element.id}
      id={element.customId}
      data-element-id={element.id}
      style={element.props.style}
      className={element.props.className}
      size={(element.props.size as "xs" | "sm" | "md" | "lg" | "xl") || "md"}
      label={element.props.label ? String(element.props.label) : undefined}
      description={
        element.props.description
          ? String(element.props.description)
          : undefined
      }
      errorMessage={
        element.props.errorMessage
          ? String(element.props.errorMessage)
          : undefined
      }
      defaultValue={
        element.props.defaultValue
          ? String(element.props.defaultValue)
          : undefined
      }
      isDisabled={Boolean(element.props.isDisabled)}
      isInvalid={Boolean(element.props.isInvalid)}
      isQuiet={Boolean(element.props.isQuiet || false)}
      isReadOnly={Boolean(element.props.isReadOnly)}
      isRequired={Boolean(element.props.isRequired)}
      autoFocus={Boolean(element.props.autoFocus)}
      name={element.props.name ? String(element.props.name) : undefined}
      form={element.props.form ? String(element.props.form) : undefined}
      channel={element.props.channel as ColorFieldChannel | undefined}
      colorSpace={
        (element.props.colorSpace as "rgb" | "hsl" | "hsb" | undefined) ||
        undefined
      }
      validationBehavior={
        (element.props.validationBehavior as "native" | "aria" | undefined) ||
        undefined
      }
      isWheelDisabled={Boolean(element.props.isWheelDisabled)}
      necessityIndicator={
        (element.props.necessityIndicator as "icon" | "label" | undefined) ??
        inheritedProps.necessityIndicator
      }
      labelPosition={
        (element.props.labelPosition as "top" | "side" | undefined) ??
        inheritedProps.labelPosition ??
        "top"
      }
      labelAlign={
        (element.props.labelAlign as "start" | "center" | "end" | undefined) ??
        inheritedProps.labelAlign
      }
      onChange={(newColor: Color | null) => {
        const updatedProps = {
          ...element.props,
          value: newColor ? newColor.toString("hex") : undefined,
        };
        updateElementProps(element.id, updatedProps);
      }}
    />
  );
};
