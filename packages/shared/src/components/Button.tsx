import { forwardRef } from "react";
import {
  composeRenderProps,
  Button as RACButton,
  ButtonProps as RACButtonProps,
} from "react-aria-components";
import { useFocusRing } from "@react-aria/focus";
import { mergeProps } from "@react-aria/utils";
import type { ButtonVariant, ComponentSize } from "../types";
import { Skeleton } from "./Skeleton";
import "./styles/Button.css";

export interface ButtonProps extends RACButtonProps {
  variant?: ButtonVariant;
  /** Fill style: fill (solid) or outline (S2) */
  fillStyle?: "fill" | "outline";
  size?: ComponentSize;
  /** Show loading skeleton instead of content */
  isLoading?: boolean;
  /** Accessible label shown during loading */
  loadingLabel?: string;
}

/**
 * 🚀 Phase 4: data-* 패턴 전환
 * - tailwind-variants 제거
 * - data-variant, data-size 속성으로 스타일 적용
 */
export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  function Button(props, ref) {
    const {
      isLoading,
      loadingLabel = "Loading...",
      children,
      variant = "primary",
      fillStyle = "fill",
      size = "md",
      className,
      style,
      ...restProps
    } = props;
    const { focusProps, isFocusVisible } = useFocusRing();

    return (
      <RACButton
        ref={ref}
        {...mergeProps(restProps, focusProps)}
        type={props.type}
        isDisabled={isLoading || props.isDisabled}
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
        style={style}
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
          children
        )}
      </RACButton>
    );
  },
);

export { Slider } from "./Slider";
