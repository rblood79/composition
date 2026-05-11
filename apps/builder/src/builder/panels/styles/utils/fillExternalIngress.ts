import type { FillItem } from "../../../../types/builder/fill.types";
import { migrateBackgroundColor } from "./fillMigration";
import { parseCssBackgroundToFills } from "./fillCssIngressParser";

type ExternalFillIngressNode = {
  fills?: unknown;
  props?: {
    style?: unknown;
    [key: string]: unknown;
  };
};

type ElementStyleLike = {
  backgroundColor?: string;
  backgroundImage?: string;
  backgroundSize?: string;
};

function stripDerivedBackground(
  style: Record<string, unknown>,
): Record<string, unknown> {
  const nextStyle = { ...style };
  delete nextStyle.backgroundColor;
  delete nextStyle.backgroundImage;
  delete nextStyle.backgroundSize;
  return nextStyle;
}

export function normalizeExternalFillIngress<T extends ExternalFillIngressNode>(
  element: T,
): T {
  const currentStyle = (element.props?.style ?? {}) as Record<string, unknown>;
  const currentFills = Array.isArray(element.fills)
    ? (element.fills as FillItem[])
    : undefined;

  const hasDerivedBackground =
    "backgroundColor" in currentStyle ||
    "backgroundImage" in currentStyle ||
    "backgroundSize" in currentStyle;

  if (!hasDerivedBackground) {
    return element;
  }

  let nextFills = currentFills;
  if (!nextFills || nextFills.length === 0) {
    const parsedFills = parseCssBackgroundToFills(
      currentStyle as ElementStyleLike,
    );
    nextFills =
      parsedFills.length > 0
        ? parsedFills
        : migrateBackgroundColor(
            (currentStyle as ElementStyleLike).backgroundColor,
          );
  }

  if ((!nextFills || nextFills.length === 0) && !currentFills?.length) {
    return element;
  }

  const nextStyle = stripDerivedBackground(currentStyle);
  return {
    ...element,
    ...(nextFills && nextFills.length > 0 ? { fills: nextFills } : {}),
    props: {
      ...element.props,
      style: nextStyle,
    },
  };
}

export function normalizeExternalFillIngressBatch<T extends ExternalFillIngressNode>(
  elements: T[],
): T[] {
  if (elements.length === 0) {
    return elements;
  }

  return elements.map((element) => normalizeExternalFillIngress(element));
}
