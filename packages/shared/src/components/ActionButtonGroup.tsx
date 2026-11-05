import { createContext, forwardRef } from "react";
import { Toolbar, type ToolbarProps } from "react-aria-components/Toolbar";
import type { ComponentSizeSubset, StaticColor } from "../types";

export interface ActionButtonGroupProps extends ToolbarProps {
  size?: ComponentSizeSubset;
  density?: "regular" | "compact";
  isQuiet?: boolean;
  isJustified?: boolean;
  staticColor?: StaticColor;
  isDisabled?: boolean;
}

export const ActionButtonGroupContext =
  createContext<ActionButtonGroupProps | null>(null);

/** 공통 스타일과 Toolbar의 방향키 이동을 제공하는 작업 버튼 묶음. */
export const ActionButtonGroup = forwardRef<
  HTMLDivElement,
  ActionButtonGroupProps
>(function ActionButtonGroup(
  {
    size,
    density = "regular",
    isQuiet,
    isJustified,
    staticColor,
    isDisabled,
    orientation = "horizontal",
    className,
    children,
    ...props
  },
  ref,
) {
  return (
    <ActionButtonGroupContext.Provider
      value={{
        size,
        density,
        isQuiet,
        isJustified,
        staticColor,
        isDisabled,
        orientation,
      }}
    >
      <Toolbar
        {...props}
        ref={ref}
        orientation={orientation}
        aria-disabled={isDisabled || undefined}
        data-size={size ?? "M"}
        data-density={density}
        data-quiet={isQuiet || undefined}
        data-justified={isJustified || undefined}
        data-static-color={staticColor ?? "auto"}
        className={`react-aria-ActionButtonGroup${className ? ` ${className}` : ""}`}
      >
        {children}
      </Toolbar>
    </ActionButtonGroupContext.Provider>
  );
});
