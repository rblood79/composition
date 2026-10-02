import { catalogDropZoneContentStyle } from "../../../../../packages/shared/src/catalog/document/rulePartRules";
import type {
  CatalogConsumerNode,
  CatalogTextFont,
  CatalogTextMeasure,
} from "./compositionRoot";

/**
 * ADR-248 4e-10 (사용자 결정 A 2026-10-02): the DropZone's composed content — DropZone.tsx renders
 * the upload icon, the label and the description as the DropZone column's own flex items (no typed
 * nodes). The layout measures it (the DropZone's content box, CSS `min-height: auto`) and the
 * Canvas paints it from the same parts; sizes come from the rule delegation
 * (`catalogDropZoneContentStyle`) and the node's resolved `iconSize` · `fontSize` · `gap`.
 */
export interface CatalogDropZonePart {
  readonly kind: "icon" | "label" | "description";
  readonly width: number;
  readonly height: number;
  readonly text?: string;
  readonly font?: CatalogTextFont;
  /** The text breaks onto more than one line at the available width. */
  readonly wraps?: boolean;
}

export interface CatalogDropZoneContent {
  readonly parts: readonly CatalogDropZonePart[];
  readonly gap: number;
  /** Max-content width (the widest part on one line). */
  readonly width: number;
  /** Min-content width (the icon or the longest word). */
  readonly minWidth: number;
  /** Stacked height at the available width (or unconstrained). */
  readonly height: number;
}

/** The DropZone content at `availableWidth` (content-box px; absent = max-content). */
export function catalogDropZoneContent(
  node: CatalogConsumerNode,
  measure: CatalogTextMeasure,
  availableWidth?: number,
): CatalogDropZoneContent | undefined {
  if (node.bindingId !== "dropzone" || node.children.length > 0)
    return undefined;
  const style = catalogDropZoneContentStyle();
  const ownSize = Number(node.visual.fontSize);
  const fontWeight = Number(node.visual.fontWeight ?? 400);
  const parts: CatalogDropZonePart[] = [];
  let width = 0;
  let minWidth = 0;
  const iconSize = Number(node.visual.iconSize ?? 0);
  if (iconSize > 0) {
    parts.push({ kind: "icon", width: iconSize, height: iconSize });
    width = minWidth = iconSize;
  }
  for (const kind of ["label", "description"] as const) {
    const value = node.props[kind];
    if (typeof value !== "string" || value === "") continue;
    const declared = style[kind];
    const fontSize = declared.fontSize ?? ownSize;
    if (!(fontSize > 0)) continue;
    const font: CatalogTextFont = {
      fontSize,
      fontWeight,
      lineHeight: declared.lineHeight,
    };
    const single = measure(value, font);
    const exact = single.exactWidth ?? single.width;
    const min = Math.min(single.minWidth ?? exact, exact);
    width = Math.max(width, exact);
    minWidth = Math.max(minWidth, min);
    // A block in the centered column: its max-content, or the available width once the text
    // breaks (never below its longest word — CSS overflows a lone word instead of splitting it).
    const wraps =
      availableWidth !== undefined && availableWidth + 0.5 < exact;
    const boxWidth = wraps ? Math.max(availableWidth!, min) : exact;
    parts.push({
      kind,
      text: value,
      font,
      wraps,
      width: boxWidth,
      height: wraps ? measure(value, font, boxWidth).height : single.height,
    });
  }
  if (parts.length === 0) return undefined;
  const gap = Number(node.visual.gap ?? 0);
  const height =
    parts.reduce((sum, part) => sum + part.height, 0) +
    gap * (parts.length - 1);
  return { parts, gap, width, minWidth, height };
}
