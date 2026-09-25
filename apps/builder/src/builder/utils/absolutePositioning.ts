import { isBodyType } from "@composition/shared";
interface PositioningNode {
  type: string;
  props?: {
    style?: unknown;
  };
}

export function resolveAbsoluteFlowReparentProps(
  element: PositioningNode,
  targetContainer: PositioningNode,
): { style: Record<string, unknown> } | null {
  const style = element.props?.style;
  if (
    !style ||
    typeof style !== "object" ||
    Array.isArray(style) ||
    (style as Record<string, unknown>).position !== "absolute" ||
    isBodyType(targetContainer.type)
  ) {
    return null;
  }

  const nextStyle = { ...(style as Record<string, unknown>) };
  delete nextStyle.position;
  return { style: nextStyle };
}
