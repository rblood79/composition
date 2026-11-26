import {
  Columns2,
  Keyboard,
  RectangleEllipsis,
  Rows2,
  SeparatorHorizontal,
  SeparatorVertical,
} from "lucide-react";
import { useMemo, type ReactElement } from "react";
import { getPanelMeta, getReusableEntry } from "@composition/shared";
import { getChartDescriptor } from "@composition/rendering";
import { ACTION_ICONS } from "../../../config/actionIcons";
import type { CatalogLayerNode } from "../../../catalogRuntime/layerTree";
import {
  useCatalogPropSource,
  useCatalogWorkspace,
} from "../../../catalogRuntime/react";
import {
  RESIZABLE_GROUP_TYPE,
  RESIZABLE_HANDLE_TYPE,
  RESIZABLE_PANEL_TYPE,
} from "../../../../../../../packages/shared/src/catalog/runtime/resizablePanels";
import { getPaletteItems, ICON_MAP } from "../../components/paletteItems";
import { ICON_EDIT_PROPS } from "../tree/helpers";

// Reuse the actual palette, including palette-only entries such as Image.
const paletteIcons = new Map(
  getPaletteItems().map((item) => [item.type, item.icon]),
);

export function layerComponentIcon(node: CatalogLayerNode) {
  if (node.body) return undefined;
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
  return (panel && ICON_MAP[panel.icon]) ?? ACTION_ICONS.component;
}

type NodeGlyph =
  | "frame"
  | "group"
  | "text"
  | "input"
  | "vector"
  | "image"
  | "line"
  | "line-vertical"
  | "panel-column"
  | "panel-row"
  | "shape";

export function layerNodeGlyph(typeName: string): NodeGlyph {
  switch (typeName) {
    case "Body":
    case "body":
    case "Frame":
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
    case "TableFooter":
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
  "line-vertical": "M8 2v12",
  // (A Resizable Panel: one part of its Group — a tall column side by side, a wide row stacked.)
  "panel-column": "M5 2h6v12H5Z",
  "panel-row": "M2 5h12v6H2Z",
  shape: "M3 4h10v8H3Z",
};

const iconProps = {
  width: ICON_EDIT_PROPS.size,
  height: ICON_EDIT_PROPS.size,
  strokeWidth: ICON_EDIT_PROPS.stroke,
  "aria-hidden": true as const,
};

type EditTarget = CatalogLayerNode["position"]["target"];
type LayerLucideIcon = (typeof ICON_MAP)[string];

/**
 * ADR-318 후속 (사용자 2026-11-26 「orientation 에 따라 layers 트리 icon 이 columns, rows」): a
 * Resizable Group's row shows its axis — side by side (horizontal, the palette's) two columns,
 * stacked (vertical) two rows (사용자 2026-11-26 「columns-2, rows-2」).
 */
export function layerResizableGroupIcon(orientation: unknown) {
  return orientation === "vertical" ? Rows2 : Columns2;
}

/**
 * ADR-318 후속 (사용자 2026-11-26 「방향에 맞추기 — Handle · Panel · Separator 셋 다」): the line and
 * part glyphs follow the axis the Canvas draws — a Separator its own `orientation`, a Resizable
 * Handle the line between its Group's Panels (a horizontal Group's is vertical), a Panel its share
 * (a column side by side, a row stacked).
 */
export function layerOrientedGlyph(
  typeName:
    "Separator" | typeof RESIZABLE_HANDLE_TYPE | typeof RESIZABLE_PANEL_TYPE,
  orientation: unknown,
): NodeGlyph {
  const vertical = orientation === "vertical";
  if (typeName === RESIZABLE_PANEL_TYPE)
    return vertical ? "panel-row" : "panel-column";
  // (A Handle is the line across its Group's axis; a Separator lies on its own.)
  return vertical === (typeName === "Separator") ? "line-vertical" : "line";
}

/** A top-level Separator's palette icon, on its axis. */
export function layerSeparatorIcon(orientation: unknown) {
  return orientation === "vertical" ? SeparatorVertical : SeparatorHorizontal;
}

function LucideLayerIcon({ Icon }: { Icon: LayerLucideIcon }) {
  return <Icon {...iconProps} data-layer-icon="component" />;
}

function GlyphIcon({ glyph }: { glyph: NodeGlyph }) {
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

/**
 * A row's icon from one prop of `target` (Chart `chartType` · a Resizable Group's or a Separator's
 * `orientation`): it subscribes to that prop only, so a change redraws the row without rebuilding
 * the tree.
 */
function PropLayerIcon({
  target,
  prop,
  draw,
}: {
  target: EditTarget;
  prop: string;
  draw: (value: unknown) => ReactElement;
}) {
  return draw(useCatalogPropSource(target, prop).value);
}

/** A Resizable Panel · Handle row: its Group's (the parent row's) orientation. */
function ResizablePartLayerIcon({
  node,
  part,
}: {
  node: CatalogLayerNode;
  part: typeof RESIZABLE_HANDLE_TYPE | typeof RESIZABLE_PANEL_TYPE;
}) {
  const workspace = useCatalogWorkspace();
  const group = useMemo(
    () =>
      node.parentId
        ? workspace.positionOfRecord(node.parentId)?.target
        : undefined,
    [workspace, node.parentId],
  );
  const draw = (orientation: unknown) => (
    <GlyphIcon glyph={layerOrientedGlyph(part, orientation)} />
  );
  return group ? (
    <PropLayerIcon target={group} prop="orientation" draw={draw} />
  ) : (
    draw(undefined)
  );
}

export function CatalogLayerIcon({ node }: { node: CatalogLayerNode }) {
  if (node.typeName === "Input") {
    return <Keyboard {...iconProps} data-layer-icon="keyboard" />;
  }
  if (node.typeName === "Description" || node.typeName === "FieldError") {
    return (
      <RectangleEllipsis {...iconProps} data-layer-icon="rectangle-ellipsis" />
    );
  }
  if (
    node.typeName === RESIZABLE_PANEL_TYPE ||
    node.typeName === RESIZABLE_HANDLE_TYPE
  )
    return <ResizablePartLayerIcon node={node} part={node.typeName} />;
  const Icon = layerComponentIcon(node);
  if (node.typeName === "Separator")
    // (A placed Separator draws its palette icon, one inside a component the line glyph.)
    return (
      <PropLayerIcon
        target={node.position.target}
        prop="orientation"
        draw={(orientation) =>
          Icon ? (
            <LucideLayerIcon Icon={layerSeparatorIcon(orientation)} />
          ) : (
            <GlyphIcon glyph={layerOrientedGlyph("Separator", orientation)} />
          )
        }
      />
    );
  if (Icon && node.typeName === "Chart")
    // (All seven palette variants are stored as Chart.)
    return (
      <PropLayerIcon
        target={node.position.target}
        prop="chartType"
        draw={(chartType) => (
          <LucideLayerIcon
            Icon={ICON_MAP[getChartDescriptor(chartType).icon]}
          />
        )}
      />
    );
  if (Icon && node.typeName === RESIZABLE_GROUP_TYPE)
    return (
      <PropLayerIcon
        target={node.position.target}
        prop="orientation"
        draw={(orientation) => (
          <LucideLayerIcon Icon={layerResizableGroupIcon(orientation)} />
        )}
      />
    );
  if (Icon) return <LucideLayerIcon Icon={Icon} />;
  return <GlyphIcon glyph={layerNodeGlyph(node.typeName)} />;
}
