import type { CatalogConsumerNode } from "./compositionRoot";

export interface SlotChromeMeasure {
  (
    text: string,
    fontSize: number,
    maxWidth: number,
    lineHeight: number,
  ): {
    width: number;
    height: number;
  };
}

export interface SlotChromeContext {
  editMode: boolean;
  requiredLabel: string;
  measureText: SlotChromeMeasure;
}

export interface SlotChromeInput {
  id: string;
  slotId: string;
  iconId: string;
  infoId: string;
  nameId: string;
  requiredId?: string;
  descriptionId: string;
  name: string;
  requiredLabel?: string;
  description?: string;
  descriptionLines: readonly string[];
  iconSize: number;
  iconGap: number;
  fontSize: number;
  lineHeight: number;
  contentWidth: number;
  textWidth: number;
  nameHeight: number;
  nameWidth: number;
  descriptionHeight: number;
  height: number;
}

/** Edit-only measured input. No chrome ID is a catalog document entry. */
export function deriveSlotChromeInput(
  node: CatalogConsumerNode,
  context: SlotChromeContext | undefined,
): SlotChromeInput | undefined {
  if (!context?.editMode || node.bindingId !== "slot" || node.children.length)
    return undefined;
  const width = node.sizing.width ?? node.visual.width;
  if (typeof width !== "number" || !Number.isFinite(width) || width <= 0)
    throw new Error(`SLOT_CHROME_WIDTH_REQUIRED:${node.id}`);
  const padding = Number(node.visual.padding ?? 0);
  const border = Number(node.visual.borderWidth ?? 0);
  const iconSize = Number(node.visual.iconSize);
  const iconGap = Number(node.visual.iconGap);
  const fontSize = Number(node.visual.fontSize);
  const lineHeight = Number(node.visual.lineHeight);
  if (
    [padding, border, iconSize, iconGap, fontSize, lineHeight].some(
      (value) => !Number.isFinite(value) || value < 0,
    ) ||
    iconSize <= 0 ||
    fontSize <= 0 ||
    lineHeight <= 0
  )
    throw new Error(`SLOT_CHROME_METRIC_REQUIRED:${node.id}`);
  const contentWidth = width - 2 * (padding + border);
  const textWidth = contentWidth - iconSize - iconGap;
  if (textWidth <= 0) throw new Error(`SLOT_CHROME_TEXT_WIDTH:${node.id}`);
  const name = node.name || node.slot?.name || "Slot";
  const requiredLabel = node.slot?.required ? context.requiredLabel : undefined;
  const description =
    typeof node.props.description === "string"
      ? node.props.description
      : undefined;
  const measure = (text: string) =>
    context.measureText(text, fontSize, textWidth, lineHeight).width;
  const nameHeight = fontSize * lineHeight;
  const nameWidth = context.measureText(
    name,
    fontSize,
    textWidth,
    lineHeight,
  ).width;
  const descriptionLines: string[] = [];
  if (description)
    for (const word of description.trim().split(/\s+/)) {
      const last = descriptionLines.length - 1;
      const candidate = last < 0 ? word : `${descriptionLines[last]} ${word}`;
      if (last < 0 || measure(candidate) > textWidth)
        descriptionLines.push(word);
      else descriptionLines[last] = candidate;
    }
  const descriptionHeight = descriptionLines.length * fontSize * lineHeight;
  if (
    !Number.isFinite(nameHeight) ||
    !Number.isFinite(descriptionHeight) ||
    nameHeight <= 0 ||
    !Number.isFinite(nameWidth) ||
    nameWidth < 0 ||
    descriptionHeight < 0
  )
    throw new Error(`SLOT_CHROME_TEXT_MEASURE:${node.id}`);
  return {
    id: `${node.id}::editor-placeholder`,
    slotId: node.id,
    iconId: `${node.id}::editor-icon`,
    infoId: `${node.id}::editor-info`,
    nameId: `${node.id}::editor-name`,
    ...(requiredLabel ? { requiredId: `${node.id}::editor-required` } : {}),
    descriptionId: `${node.id}::editor-description`,
    name,
    requiredLabel,
    description,
    descriptionLines,
    iconSize,
    iconGap,
    fontSize,
    lineHeight,
    contentWidth,
    textWidth,
    nameHeight,
    nameWidth,
    descriptionHeight,
    height: Math.max(iconSize, nameHeight + descriptionHeight),
  };
}

export function slotChromeLayoutNodes(input: SlotChromeInput): readonly {
  id: string;
  style: Record<string, unknown>;
  children: readonly string[];
}[] {
  const text = (height: number) => ({
    display: "block",
    width: `${input.textWidth}px`,
    height: `${height}px`,
  });
  return [
    { id: input.nameId, style: text(input.nameHeight), children: [] },
    {
      id: input.descriptionId,
      style: text(input.descriptionHeight),
      children: [],
    },
    {
      id: input.infoId,
      style: {
        display: "flex",
        flexDirection: "column",
        width: `${input.textWidth}px`,
      },
      children: [input.nameId, input.descriptionId],
    },
    {
      id: input.iconId,
      style: {
        display: "block",
        width: `${input.iconSize}px`,
        height: `${input.iconSize}px`,
      },
      children: [],
    },
    {
      id: input.id,
      style: {
        display: "flex",
        flexDirection: "row",
        alignItems: "center",
        columnGap: `${input.iconGap}px`,
        width: `${input.contentWidth}px`,
      },
      children: [input.iconId, input.infoId],
    },
  ];
}
