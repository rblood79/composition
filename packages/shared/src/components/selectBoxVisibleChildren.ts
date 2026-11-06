import { Children, cloneElement, isValidElement, type ReactNode } from "react";
import { selectBoxDescriptionHidden } from "../catalog/runtime/selectBoxPresence";

/** The public adapter applies the same presence decision before authored inline display styles. */
export function selectBoxVisibleChildren(
  children: ReactNode,
  orientation: unknown,
): ReactNode {
  return Children.map(children, (child) => {
    if (!isValidElement<{ slot?: string; children?: ReactNode }>(child))
      return child;
    if (selectBoxDescriptionHidden(child.props.slot, orientation)) return null;
    if (child.props.children === undefined) return child;
    return cloneElement(
      child,
      undefined,
      selectBoxVisibleChildren(child.props.children, orientation),
    );
  });
}
