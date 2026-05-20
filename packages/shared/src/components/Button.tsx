import { forwardRef } from "react";
import {
  composeRenderProps,
  Button as RACButton,
  ButtonProps as RACButtonProps,
} from "react-aria-components";
import { useFocusRing } from "@react-aria/focus";
import { mergeProps } from "@react-aria/utils";
import {
  toButtonRacProps,
  type ButtonCanonicalProps,
} from "../catalog/outputs/toRacProps";
import type { ButtonFillStyle, ButtonVariant, ComponentSize } from "../types";
import { Skeleton } from "./Skeleton";
import "./styles/Button.css";

/**
 * Size별 border-radius 매핑 (CSS 변수 값 기준)
 * --radius-sm: 0.25rem = 4px
 * --radius-md: 0.375rem = 6px
 * --radius-lg: 0.5rem = 8px
 */
const SIZE_BORDER_RADIUS: Record<ComponentSize, number> = {
  xs: 4, // --radius-sm
  sm: 4, // --radius-sm
  md: 6, // --radius-md
  lg: 8, // --radius-lg
  xl: 8, // --radius-lg
};

export interface ButtonProps extends RACButtonProps {
  variant?: ButtonVariant;
  /** Fill style: fill (solid) or outline (S2) */
  fillStyle?: ButtonFillStyle;
  size?: ComponentSize;
  /** Show loading skeleton instead of content */
  isLoading?: boolean;
  /** Accessible label shown during loading */
  loadingLabel?: string;
}

/** ADR-142 primitive wrapper: canonical props are projected through catalog toRacProps. */
export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  function Button(props, ref) {
    const projectedProps = toButtonRacProps(props as ButtonCanonicalProps);
    const {
      isLoading: inputIsLoading,
      loadingLabel = "Loading...",
      children,
      variant: _variant,
      fillStyle: _fillStyle,
      size: _size,
      type: _type,
      isDisabled: _isDisabled,
      className,
      style,
      ...restProps
    } = props;
    const { focusProps, isFocusVisible } = useFocusRing();
    const {
      fillStyle,
      isDisabled: projectedIsDisabled,
      isLoading: projectedIsLoading,
      size,
      type,
      variant,
    } = projectedProps;
    const isLoading = inputIsLoading ?? projectedIsLoading ?? false;
    const buttonChildren = children ?? projectedProps.children;

    // Size에 따른 border-radius 인라인 스타일 적용
    const borderRadius = SIZE_BORDER_RADIUS[size];

    return (
      <RACButton
        ref={ref}
        {...mergeProps(restProps, focusProps)}
        type={type}
        isDisabled={isLoading || projectedIsDisabled}
        data-variant={variant}
        data-fill-style={fillStyle}
        data-size={size}
        data-focus-visible={isFocusVisible || undefined}
        data-loading={isLoading || undefined}
        aria-busy={isLoading || undefined}
        className={composeRenderProps(className, (cls) =>
          cls
            ? `react-aria-Button button-base ${cls}`
            : "react-aria-Button button-base",
        )}
        style={composeRenderProps(style, (baseStyle) => ({
          ...baseStyle,
          borderRadius: baseStyle?.borderRadius ?? borderRadius,
        }))}
      >
        {isLoading ? (
          <>
            <Skeleton
              componentVariant="button"
              size={size}
              aria-label={loadingLabel}
            />
            <span className="sr-only">{loadingLabel}</span>
          </>
        ) : (
          buttonChildren
        )}
      </RACButton>
    );
  },
);

export { Slider } from "./Slider";
