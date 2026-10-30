import {
  resolveToken,
  s2ControlPaddingY,
  type TokenRef,
} from "@composition/rendering";
import { COMPONENT_RULES_TABLE } from "../generated/componentRulesTable";
import type { ComponentRule } from "../../types/catalog-style.types";
import type { CatalogConsumerNode } from "./compositionRoot";

type CatalogRecordLookup = (id: string) => CatalogConsumerNode | undefined;
type CatalogTypeOf = (node: CatalogConsumerNode) => string;

/** A node's parent past the layout frames it sits in (`presence.ts` `catalogPartParent`). */
function partParent(
  node: CatalogConsumerNode,
  get: CatalogRecordLookup,
  typeOf: CatalogTypeOf,
): CatalogConsumerNode | undefined {
  let parent = get(node.parentId);
  while (parent && typeOf(parent) === "frame") parent = get(parent.parentId);
  return parent;
}

/**
 * ADR-259 Phase 2 — S2 `prefix` ("a non-interactive element that appears before the input" —
 * TextField · TextArea · NumberField · ComboBox · ColorField). The prefix is a Text or Icon node
 * (`slot="prefix"`) in the field's control `Group`, before its Input. TextField · TextArea ·
 * ColorField have no Group of their own: adding a prefix wraps their Input in one (S2's
 * `FieldGroup` — `Field.tsx:255, 290-313`).
 *
 * A Group holding a prefix is the field's box (S2 `FieldGroup`): it draws the Input rule's box at
 * the field's size and state — the DOM by the Input rule's sheet (`classAliases` `FieldBox`), the
 * Canvas by running the Input rule in the Group's box — and the Input inside lays its box down
 * (`catalogFieldBoxInputStyle`, read by both consumers).
 */
export const CATALOG_PREFIX_FIELDS: ReadonlySet<string> = new Set([
  "TextField",
  "TextArea",
  "NumberField",
  "ComboBox",
  "ColorField",
]);
/** Prefix fields without a control Group of their own (the prefix command wraps their Input). */
export const CATALOG_PREFIX_WRAP_FIELDS: ReadonlySet<string> = new Set([
  "TextField",
  "TextArea",
  "ColorField",
]);
/**
 * Fields whose control is not named by its prefix: S2's TextArea reads `TextAreaContext`, which
 * its `FieldGroup` does not extend (G0 oracle — "Price", not "Price $").
 */
export const CATALOG_PREFIX_UNNAMED_FIELDS: ReadonlySet<string> = new Set([
  "TextArea",
]);
/** The DOM class the Input rule's sheet also styles (`classAliases`) — the prefix Group's box. */
export const CATALOG_FIELD_BOX_CLASS = "react-aria-FieldBox";

const PREFIX_TYPES: ReadonlySet<string> = new Set(["Text", "Icon"]);

/** Whether a node is a field's prefix (a Text · Icon in the `prefix` slot). */
export function catalogIsFieldPrefix(
  node: CatalogConsumerNode,
  typeOf: CatalogTypeOf,
): boolean {
  return node.props.slot === "prefix" && PREFIX_TYPES.has(typeOf(node));
}

/**
 * A prefix field's box Group and its parts: the field's control Group (layout frames skipped) that
 * holds a shown prefix. Undefined for any other Group.
 */
export function catalogFieldBox(
  group: CatalogConsumerNode,
  get: CatalogRecordLookup,
  typeOf: CatalogTypeOf,
):
  | {
      field: CatalogConsumerNode;
      input: CatalogConsumerNode | undefined;
      prefix: CatalogConsumerNode;
    }
  | undefined {
  if (typeOf(group) !== "Group") return undefined;
  const field = partParent(group, get, typeOf);
  if (!field || !CATALOG_PREFIX_FIELDS.has(typeOf(field))) return undefined;
  const children = group.children.flatMap((id) => {
    const child = get(id);
    return child ? [child] : [];
  });
  const prefix = children.find(
    (child) => !child.hidden && catalogIsFieldPrefix(child, typeOf),
  );
  if (!prefix) return undefined;
  const input = children.find((child) => typeOf(child) === "Input");
  return { field, input, prefix };
}

/** The prefix box Group an Input sits in; undefined when its Group holds no prefix. */
export function catalogFieldBoxOfInput(
  input: CatalogConsumerNode,
  get: CatalogRecordLookup,
  typeOf: CatalogTypeOf,
): CatalogConsumerNode | undefined {
  if (typeOf(input) !== "Input") return undefined;
  const group = get(input.parentId);
  return group && catalogFieldBox(group, get, typeOf) ? group : undefined;
}

const px = (value: unknown, theme: "light" | "dark" = "light"): number => {
  const resolved =
    typeof value === "string" && value.startsWith("{")
      ? resolveToken(value as TokenRef, theme)
      : value;
  return typeof resolved === "number"
    ? resolved
    : Number.parseFloat(String(resolved ?? 0)) || 0;
};

/** The Input rule's box values at a size (its sheet's `.react-aria-FieldBox[data-size]` too). */
function inputBox(size: unknown) {
  const rule = (COMPONENT_RULES_TABLE as Record<string, ComponentRule>).Input;
  const sizes = rule.sizes as Record<string, Record<string, unknown>>;
  const spec = sizes[String(size)] ?? sizes[rule.defaultSize ?? "M"] ?? {};
  const fontSize = px(spec.fontSize);
  const line = px(spec.lineHeight);
  const lineHeight = line > 4 ? line : Math.round(fontSize * line);
  const paddingX = px(spec.paddingX);
  // (ADR-295 Phase 3: the S2 centring padding in the installed control height.)
  const paddingY = s2ControlPaddingY(spec) ?? px(spec.paddingY);
  const borderWidth = px(spec.borderWidth);
  return {
    paddingX,
    paddingY,
    borderWidth,
    /** The one-line box's height: line + padding + border (md 18 + 12 + 2 = 32 — S2 control height). */
    height: lineHeight + 2 * paddingY + 2 * borderWidth,
  };
}

/**
 * The prefix box Group's box at the field's size (S2 `FieldGroup`, `centerBaseline` — items
 * centred): the Input rule's start padding and border, its end padding left to the Input (so the
 * Input's text stops where it did and a ComboBox's button keeps its place over that room —
 * `buttonOverlayInset`), and —
 * one-line fields — the Input box's height with the row centred in it. A TextArea keeps the
 * vertical padding (its `<textarea>` is the rows box less it), with the prefix at the first line.
 */
/**
 * A ComboBox's button sits over its Input's end room by a negative start margin past its own width
 * (`--combo-btn-offset` − `--combo-btn-size`, md 26 − 22 = 4): in a prefix box the Input fills
 * that overlap, so the box keeps it as end padding — the button stays inset as without a prefix.
 */
function buttonOverlayInset(
  fieldType: string | undefined,
  size: unknown,
): number {
  if (fieldType !== "ComboBox") return 0;
  const rule = (COMPONENT_RULES_TABLE as Record<string, ComponentRule>)
    .ComboBox;
  const delegation = (
    rule.structure?.composition as
      | {
          delegation?: Array<{
            childSelector?: string;
            variables?: Record<string, Record<string, string>>;
          }>;
        }
      | undefined
  )?.delegation?.find((entry) => entry.childSelector === ".react-aria-Button");
  const vars =
    delegation?.variables?.[String(size)] ??
    delegation?.variables?.[rule.defaultSize ?? "M"];
  const offset = px(vars?.["--combo-btn-offset"]);
  const width = px(vars?.["--combo-btn-size"]);
  return Math.max(0, -offset - width);
}

export function catalogFieldBoxStyle(
  size: unknown,
  fieldType?: string,
): {
  display: "flex";
  flexDirection: "row";
  alignItems: "center" | "flex-start";
  width: "100%";
  height?: number;
  paddingTop: number;
  paddingRight: number;
  paddingBottom: number;
  paddingLeft: number;
  borderWidth: number;
} {
  const box = inputBox(size);
  const multiline = fieldType === "TextArea";
  return {
    display: "flex",
    flexDirection: "row",
    alignItems: multiline ? "flex-start" : "center",
    width: "100%",
    ...(multiline ? {} : { height: box.height }),
    paddingTop: multiline ? box.paddingY : 0,
    paddingRight: buttonOverlayInset(fieldType, size),
    paddingBottom: multiline ? box.paddingY : 0,
    paddingLeft: box.paddingX,
    borderWidth: box.borderWidth,
  };
}

/**
 * The Input in a prefix box: its box laid down (the Group draws it) — no start or vertical
 * padding, border, fill, corner or focus outline — filling the row after the prefix (S2's input in
 * `FieldGroup`). Its end padding stays its own.
 */
export const CATALOG_FIELD_BOX_INPUT_STYLE = {
  paddingTop: 0,
  paddingBottom: 0,
  paddingLeft: 0,
  borderWidth: 0,
  width: "auto",
  flexGrow: 1,
  flexShrink: 1,
  flexBasis: 0,
  minWidth: 0,
  // (An Input in a prefix box keeps no maximum — the Group is the box. A ColorField's own
  // per-size maximum is gone too, user 2026-10-25.)
  maxWidth: "none",
} as const;

/** A NumberField's stepper Button in its prefix box (it lays its border down, the box's height). */
export function catalogFieldBoxStepper(
  node: CatalogConsumerNode,
  get: CatalogRecordLookup,
  typeOf: CatalogTypeOf,
): CatalogConsumerNode | undefined {
  if (typeOf(node) !== "Button") return undefined;
  const group = get(node.parentId);
  const box = group && catalogFieldBox(group, get, typeOf);
  return box && typeOf(box.field) === "NumberField" ? box.field : undefined;
}

/** A stepper's box in a prefix box: the box's inner height, no border, square corners. */
export function catalogFieldBoxStepperStyle(size: unknown): {
  height: number;
  borderWidth: 0;
  radius: 0;
} {
  const box = inputBox(size);
  return {
    height: box.height - 2 * box.borderWidth,
    borderWidth: 0,
    radius: 0,
  };
}

/**
 * A stepper record as both consumers draw it in a prefix box: its border and corners laid down, the
 * box's inner height (Canvas `paintedNodeData` · DOM `catalogDomStyle` read the same record).
 */
export function catalogFieldBoxStepperNode(
  node: CatalogConsumerNode,
  get: CatalogRecordLookup,
  typeOf: CatalogTypeOf,
): CatalogConsumerNode {
  const field = catalogFieldBoxStepper(node, get, typeOf);
  if (!field) return node;
  const style = catalogFieldBoxStepperStyle(field.props.size);
  return {
    ...node,
    visual: {
      ...node.visual,
      height: style.height,
      borderWidth: style.borderWidth,
      radius: style.radius,
      radiusTopLeft: 0,
      radiusTopRight: 0,
      radiusBottomRight: 0,
      radiusBottomLeft: 0,
    },
  };
}
