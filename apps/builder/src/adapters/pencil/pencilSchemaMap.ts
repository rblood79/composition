import type { CanonicalNode, PencilNodeType } from "@composition/shared";

export const PENCIL_DOCUMENT_FIELDS = [
  "version",
  "imports",
  "children",
] as const;

export const PENCIL_DIRECT_NODE_FIELDS = [
  "id",
  "type",
  "children",
  "metadata",
  "reusable",
  "ref",
  "descendants",
  "slot",
  "name",
  "clip",
  "placeholder",
  // ADR-154 — responsive breakpoint override (shared PENCIL_NODE_FIELDS 미러)
  "responsive",
] as const;

export const PENCIL_TO_CANONICAL_TYPE = {
  rectangle: "frame",
  ellipse: "frame",
  line: "frame",
  polygon: "frame",
  path: "frame",
  text: "Text",
  note: "Text",
  prompt: "Text",
  context: "Text",
  icon_font: "Icon",
  ref: "ref",
  frame: "frame",
  group: "frame",
} as const satisfies Record<PencilNodeType, CanonicalNode["type"]>;

export const CANONICAL_TO_PENCIL_HINTS = {
  frame: "frame",
  ref: "ref",
  group: "group",
  Text: "text",
  Icon: "icon_font",
} as const satisfies Partial<Record<CanonicalNode["type"], PencilNodeType>>;
