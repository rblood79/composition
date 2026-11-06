import { parseColor } from "react-aria-components/ColorPicker";
import { ACTION_BAR_RULE } from "../rule/selectionComposites";
import { evaluatePaint } from "../rule/rulePaintTree";
import type { CatalogConsumerNode } from "./compositionRoot";

export function actionBarPaint(foreground: string, background: string) {
  const rgb = parseColor(background)?.toFormat("rgb");
  if (!rgb || !parseColor(foreground))
    throw new Error("ACTION_BAR_RESOLVED_COLOR_REQUIRED");
  const linear = (channel: "red" | "green" | "blue") => {
    const value = rgb.getChannelValue(channel) / 255;
    return value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
  };
  const luminance =
    0.2126 * linear("red") + 0.7152 * linear("green") + 0.0722 * linear("blue");
  const staticColor: "white" | "black" =
    1.05 / (luminance + 0.05) > (luminance + 0.05) / 0.05 ? "white" : "black";
  return { foreground, background, staticColor };
}

export function catalogActionBarForeground(
  node: CatalogConsumerNode,
  get: (id: string) => CatalogConsumerNode | undefined,
  typeOf: (node: CatalogConsumerNode) => string,
  readColor: (
    node: CatalogConsumerNode,
    ref: string,
    field: "color" | "fill",
  ) => unknown,
): { staticColor?: "white" | "black"; color?: string } | undefined {
  const type = typeOf(node);
  if (!["ActionButton", "ActionButtonGroup", "Text"].includes(type))
    return undefined;
  for (let parent = get(node.parentId); parent; parent = get(parent.parentId)) {
    const parentType = typeOf(parent);
    if (
      type === "Text" &&
      ["ActionButton", "ActionButtonGroup", "Button", "ToggleButton"].includes(
        parentType,
      )
    )
      return undefined;
    if (parentType !== "ActionBar") continue;
    if (parent.props.isEmphasized !== true) return undefined;
    const paintRule = ACTION_BAR_RULE.variants.default.paint;
    const conditions = { isEmphasized: true };
    const foregroundRef = evaluatePaint(paintRule.color, conditions);
    const backgroundRef = evaluatePaint(paintRule.backgroundColor, conditions);
    if (!foregroundRef || !backgroundRef)
      throw new Error("ACTION_BAR_PAINT_REQUIRED");
    const foreground = readColor(parent, foregroundRef, "color");
    const background = readColor(parent, backgroundRef, "fill");
    if (typeof foreground !== "string" || typeof background !== "string")
      throw new Error("ACTION_BAR_RESOLVED_PAINT_REQUIRED");
    const paint = actionBarPaint(foreground, background);
    return type === "Text"
      ? { color: paint.foreground }
      : { staticColor: paint.staticColor };
  }
  return undefined;
}
