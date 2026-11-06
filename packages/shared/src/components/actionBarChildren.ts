import {
  Children,
  cloneElement,
  isValidElement,
  type CSSProperties,
  type ReactNode,
} from "react";
import { Text } from "react-aria-components/Text";
import { isValidTokenRef, tokenToCSSVar } from "@composition/rendering";
import { evaluatePaint } from "../catalog/rule/rulePaintTree";
import { ACTION_BAR_RULE } from "../catalog/rule/selectionComposites";
import { ActionButton } from "./ActionButton";
import { ActionButtonGroup } from "./ActionButtonGroup";
import { Icon } from "./Icon";

/** Slot typography inherits the owning button's state; the count alone takes the bar foreground. */
export function actionBarChildren(
  children: ReactNode,
  emphasized: boolean,
  inButton = false,
): ReactNode {
  if (!emphasized) return children;
  const foreground = evaluatePaint(
    ACTION_BAR_RULE.variants.default.paint.color,
    { isEmphasized: true },
  );
  if (!foreground || !isValidTokenRef(foreground))
    throw new Error("ACTION_BAR_FOREGROUND_REQUIRED");
  return Children.map(children, (child) => {
    if (
      !isValidElement<{
        children?: ReactNode;
        style?: CSSProperties;
        slot?: string;
      }>(child)
    )
      return child;
    const button =
      inButton ||
      child.type === ActionButton ||
      child.type === ActionButtonGroup;
    const text = child.type === Text || child.type === Icon;
    const style =
      text && child.props.style?.color === undefined
        ? {
            ...child.props.style,
            color: button ? "inherit" : tokenToCSSVar(foreground),
          }
        : child.props.style;
    return cloneElement(
      child,
      { style },
      child.props.children === undefined
        ? undefined
        : actionBarChildren(child.props.children, true, button),
    );
  });
}
