import { Component } from "lucide-react";
import { getPanelMeta, getReusableEntry } from "@composition/shared";
import { getChartDescriptor } from "@composition/rendering";
import type { CatalogLayerNode } from "../../../catalogRuntime/layerTree";
import { useCatalogPropSource } from "../../../catalogRuntime/react";
import { getPaletteItems, ICON_MAP } from "../../components/paletteItems";
import { ICON_EDIT_PROPS } from "../tree/helpers";

// Reuse the actual palette, including palette-only entries such as Image.
const paletteIcons = new Map(
  getPaletteItems().map((item) => [item.type, item.icon]),
);

export function layerComponentIcon(node: CatalogLayerNode) {
  if (node.body || node.projection) return undefined;
  // Nested component instances retain their component identity. Plain parts, including
  // materialized slot content, never borrow the palette's component illustrations.
  if (!node.role && node.insideComponent) return undefined;
  const icon = paletteIcons.get(node.typeName);
  if (icon) return icon;
  if (node.typeName === "Chart")
    return ICON_MAP[getChartDescriptor(undefined).icon];
  if (!node.role) return undefined;
  const panel =
    getReusableEntry(node.typeName)?.panel ?? getPanelMeta(node.typeName);
  return (panel && ICON_MAP[panel.icon]) ?? Component;
}

type NodeGlyph =
  "frame" | "group" | "text" | "input" | "vector" | "image" | "line" | "shape";

export function layerNodeGlyph(typeName: string): NodeGlyph {
  switch (typeName) {
    case "Body":
    case "body":
    case "Frame":
    case "Section":
      return "frame";
    case "Text":
    case "Label":
    case "Heading":
    case "Description":
    case "FieldError":
    case "TextFieldError":
    case "Link":
    case "Breadcrumb":
    case "SliderOutput":
    case "ProgressBarValue":
    case "MeterValue":
      return "text";
    case "Input":
    case "TextArea":
    case "DateSegment":
      return "input";
    case "Icon":
    case "Path":
      return "vector";
    case "Image":
      return "image";
    case "Separator":
      return "line";
    case "Group":
    case "Content":
    case "Header":
    case "Footer":
    case "CardPreview":
    case "Slot":
    case "Collection":
    case "Row":
    case "Column":
    case "Cell":
    case "TableHeader":
    case "TableBody":
      return "group";
    default:
      return "shape";
  }
}

// Figma-style structural glyphs: a small, separate vocabulary, not palette artwork.
// A 16-unit grid keeps these visibly simpler than the 24-unit component illustrations.
const NODE_PATHS: Record<NodeGlyph, string> = {
  frame: "M5 2v12M11 2v12M2 5h12M2 11h12",
  group: "M6 3H3v3m7-3h3v3M3 10v3h3m7-3v3h-3",
  text: "M3 4V3h10v1M8 3v10m-3 0h6",
  input: "M6 2h4M8 2v12m-2 0h4M5 5H2v6h3m6-6h3v6h-3",
  vector: "M8 3l5 5-5 5-5-5Z M7 1h2v2H7ZM13 7h2v2h-2ZM7 13h2v2H7ZM1 7h2v2H1Z",
  image: "M2 3h12v10H2ZM2 11l4-4 3 3 2-2 3 3M10 5h.01",
  line: "M2 8h12",
  shape: "M3 4h10v8H3Z",
};

const iconProps = {
  width: ICON_EDIT_PROPS.size,
  height: ICON_EDIT_PROPS.size,
  strokeWidth: ICON_EDIT_PROPS.stroke,
  "aria-hidden": true as const,
};

function ChartLayerIcon({ node }: { node: CatalogLayerNode }) {
  // All seven palette variants are stored as Chart. Subscribe only to this row's
  // chartType so changing its kind updates the icon without rebuilding the tree.
  const chartType = useCatalogPropSource(node.position.target, "chartType");
  const Icon = ICON_MAP[getChartDescriptor(chartType.value).icon];
  return <Icon {...iconProps} data-layer-icon="component" />;
}

export function CatalogLayerIcon({ node }: { node: CatalogLayerNode }) {
  const Icon = layerComponentIcon(node);
  if (Icon && node.typeName === "Chart") return <ChartLayerIcon node={node} />;
  if (Icon) return <Icon {...iconProps} data-layer-icon="component" />;
  const glyph = layerNodeGlyph(node.typeName);
  return (
    <svg
      {...iconProps}
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeWidth={1}
      strokeLinecap="round"
      strokeLinejoin="round"
      data-layer-icon={glyph}
    >
      <path d={NODE_PATHS[glyph]} />
    </svg>
  );
}
