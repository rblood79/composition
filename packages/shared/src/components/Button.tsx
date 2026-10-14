import { forwardRef, useEffect, useState } from "react";
import { composeRenderProps } from "react-aria-components/composeRenderProps";
import {
  Button as RACButton,
  ButtonProps as RACButtonProps,
} from "react-aria-components/Button";
import { useFocusRing } from "@react-aria/focus";
import { mergeProps } from "@react-aria/utils";
import type { ButtonVariant, ComponentSize, StaticColor } from "../types";
import { Skeleton } from "./Skeleton";
import { ProgressCircle } from "./ProgressCircle";
import {
  CATALOG_BUTTON_PENDING_DELAY_MS,
  CATALOG_BUTTON_PENDING_LABELS,
  catalogButtonPendingIndicator,
} from "../catalog/document/buttonPending";

/**
 * S2 `usePendingState` (`Button.tsx`): the pending circle shows a second after `isPending` turns on
 * — a short pending state does not flash it — and goes at once when it turns off.
 */
export function usePendingState(isPending: boolean): boolean {
  const [isProgressVisible, setIsProgressVisible] = useState(false);
  useEffect(() => {
    if (!isPending) {
      setIsProgressVisible(false);
      return;
    }
    const timeout = setTimeout(
      () => setIsProgressVisible(true),
      CATALOG_BUTTON_PENDING_DELAY_MS,
    );
    return () => clearTimeout(timeout);
  }, [isPending]);
  return isProgressVisible;
}

/** RAC Button's render-function argument (its render props with `defaultChildren`). */
type PendingRenderProps = Parameters<
  Extract<RACButtonProps["children"], (...args: never[]) => unknown>
>[0];

export interface ButtonProps extends RACButtonProps {
  variant?: ButtonVariant;
  /** Fill style: fill (solid) or outline (S2) */
  fillStyle?: "fill" | "outline";
  size?: ComponentSize;
  /** Static color for colored/image backgrounds (S2) — fixed black/white scheme */
  staticColor?: StaticColor;
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
      size = "M",
      staticColor = "auto",
      className,
      style,
      ...restProps
    } = props;
    const { focusProps, isFocusVisible } = useFocusRing();
    const quiet =
      (restProps as Record<string, unknown>)["data-quiet"] === "true";
    // S2 Button `isPending` (`buttonPending.ts`): the content stays laid out but hidden, the
    // indeterminate circle sits at the centre in the button's text color — after S2's delay. RAC
    // marks the element (`data-pending` · `aria-disabled`) and blocks the press.
    const isPending = props.isPending === true;
    const isProgressVisible = usePendingState(isPending);
    const pendingIndicator = isPending
      ? catalogButtonPendingIndicator(size)
      : undefined;

    return (
      <RACButton
        ref={ref}
        {...mergeProps(restProps, focusProps)}
        type={props.type}
        isDisabled={isLoading || props.isDisabled}
        data-variant={variant}
        data-fill-style={fillStyle}
        data-size={size}
        data-static-color={staticColor}
        data-focus-visible={isFocusVisible || undefined}
        data-loading={isLoading || undefined}
        aria-busy={isLoading || undefined}
        className={composeRenderProps(className, (cls) => {
          // A quiet field's box (a quiet Select's trigger, `data-quiet`): the field sheet draws it
          // (no fill, an underline) — the filled `.button-base` paint (a later layer) stays off.
          const base = quiet
            ? "react-aria-Button"
            : "react-aria-Button button-base";
          return cls ? `${base} ${cls}` : base;
        })}
        style={pendingIndicator ? { position: "relative", ...style } : style}
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
        ) : pendingIndicator ? (
          // (RAC children may be a render function — called with RAC's render props, as RAC does.)
          (renderProps: PendingRenderProps) => (
            <>
              <span
                data-pending-content=""
                style={{
                  display: "contents",
                  visibility: isProgressVisible ? "hidden" : undefined,
                }}
              >
                {typeof children === "function"
                  ? children(renderProps)
                  : children}
              </span>
            <span
              data-pending-indicator=""
              style={{
                position: "absolute",
                inset: 0,
                display: "grid",
                placeItems: "center",
                visibility: isProgressVisible ? "visible" : "hidden",
              }}
            >
              <ProgressCircle
                isIndeterminate
                aria-label={CATALOG_BUTTON_PENDING_LABELS.en}
                diameter={pendingIndicator.diameter}
                strokeWidth={pendingIndicator.strokeWidth}
                indicatorColor="currentColor"
                trackColor={`color-mix(in srgb, currentColor ${Math.round(pendingIndicator.trackAlpha * 100)}%, transparent)`}
              />
            </span>
            </>
          )
        ) : (
          children
        )}
      </RACButton>
    );
  },
);

export { Slider } from "./Slider";
