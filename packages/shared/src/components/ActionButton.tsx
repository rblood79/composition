import { forwardRef, useContext } from "react";
import { Button, type ButtonProps } from "react-aria-components/Button";
import { composeRenderProps } from "react-aria-components/composeRenderProps";
import type { ComponentSize, StaticColor } from "../types";
import { ActionButtonGroupContext } from "./ActionButtonGroup";
import { usePendingState } from "./Button";
import { ProgressCircle } from "./ProgressCircle";
import {
  catalogButtonPendingIndicator,
  CATALOG_BUTTON_PENDING_LABELS,
} from "../catalog/document/buttonPending";

export interface ActionButtonProps extends ButtonProps {
  size?: ComponentSize;
  staticColor?: StaticColor;
  isQuiet?: boolean;
}

/** 선택 상태 없이 명령을 실행한다. 동작·접근성은 RAC Button이 담당한다. */
export const ActionButton = forwardRef<HTMLButtonElement, ActionButtonProps>(
  function ActionButton(
    {
      size: ownSize,
      staticColor: ownColor,
      isQuiet: ownQuiet,
      children,
      className,
      ...props
    },
    ref,
  ) {
    const group = useContext(ActionButtonGroupContext);
    // S2: 공통 시각 값은 그룹이 우선, disabled는 자식의 명시값이 우선한다.
    const size = group?.size ?? ownSize ?? "M";
    const staticColor = group?.staticColor ?? ownColor ?? "auto";
    const isQuiet = group?.isQuiet ?? ownQuiet;
    const isProgressVisible = usePendingState(props.isPending === true);
    const indicator = catalogButtonPendingIndicator(size);
    return (
      <Button
        {...props}
        ref={ref}
        isDisabled={props.isDisabled ?? group?.isDisabled}
        data-variant="default"
        data-size={size}
        data-static-color={staticColor}
        data-quiet={isQuiet || undefined}
        data-density={group?.density}
        data-orientation={group?.orientation}
        data-justified={group?.isJustified || undefined}
        data-in-group={!!group || undefined}
        className={composeRenderProps(
          className,
          (cls) => `react-aria-ActionButton${cls ? ` ${cls}` : ""}`,
        )}
      >
        {(renderProps) => (
          <>
            <span
              style={{
                display: "contents",
                visibility: isProgressVisible ? "hidden" : undefined,
              }}
            >
              {typeof children === "function"
                ? children(renderProps)
                : children}
            </span>
            {props.isPending && (
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
                  diameter={indicator.diameter}
                  strokeWidth={indicator.strokeWidth}
                  indicatorColor="currentColor"
                  trackColor={`color-mix(in srgb, currentColor ${Math.round(indicator.trackAlpha * 100)}%, transparent)`}
                />
              </span>
            )}
          </>
        )}
      </Button>
    );
  },
);
