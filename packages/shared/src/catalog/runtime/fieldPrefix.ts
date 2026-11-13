import {
  cssVarToTokenRef,
  resolveToken,
  s2ControlPaddingY,
  type TokenRef,
} from "@composition/rendering";
import { COMPONENT_RULES_TABLE } from "../generated/componentRulesTable";
import type { ComponentRule } from "../../types/catalog-style.types";
import type { CatalogConsumerNode } from "./compositionRoot";
import { CATALOG_BOXED_FIELDS } from "../../domain/componentTraits";

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
 * (`slot="prefix"`) in the field's control `Group` (S2's `FieldGroup` — `Field.tsx:255, 290-313`),
 * before its Input. Every prefix field has that Group (2026-11-14).
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
/**
 * Fields whose control is not named by its prefix: S2's TextArea reads `TextAreaContext`, which
 * its `FieldGroup` does not extend (G0 oracle — "Price", not "Price $").
 */
export const CATALOG_PREFIX_UNNAMED_FIELDS: ReadonlySet<string> = new Set([
  "TextArea",
]);
export { CATALOG_BOXED_FIELDS } from "../../domain/componentTraits";
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

/** The box parts a field box lays down: an Input, or a DatePicker's DateInput. */
const BOX_INPUT_TYPES: ReadonlySet<string> = new Set(["Input", "DateInput"]);

/**
 * A field's box Group and its parts: the field's control Group (layout frames skipped) that holds a
 * shown prefix, or the control Group of a field S2 always boxes (`CATALOG_BOXED_FIELDS`). Undefined
 * for any other Group. `buttoned`: a shown Button (a NumberField stepper, a ComboBox · DatePicker
 * field button) follows the input — S2 puts it inside the box, so the box's end padding and the
 * input's end padding are S2's (`catalogFieldBoxStyle` · `catalogFieldBoxInputEnd`).
 */
export function catalogFieldBox(
  group: CatalogConsumerNode,
  get: CatalogRecordLookup,
  typeOf: CatalogTypeOf,
):
  | {
      field: CatalogConsumerNode;
      input: CatalogConsumerNode | undefined;
      prefix: CatalogConsumerNode | undefined;
      buttoned: boolean;
    }
  | undefined {
  if (typeOf(group) !== "Group") return undefined;
  const field = partParent(group, get, typeOf);
  const fieldType = field ? typeOf(field) : "";
  const boxed = CATALOG_BOXED_FIELDS.has(fieldType);
  if (!field || (!boxed && !CATALOG_PREFIX_FIELDS.has(fieldType)))
    return undefined;
  const children = group.children.flatMap((id) => {
    const child = get(id);
    return child ? [child] : [];
  });
  const prefix = children.find(
    (child) => !child.hidden && catalogIsFieldPrefix(child, typeOf),
  );
  if (!prefix && !boxed) return undefined;
  const input = children.find((child) => BOX_INPUT_TYPES.has(typeOf(child)));
  const buttoned = children.some(
    (child) => !child.hidden && typeOf(child) === "Button",
  );
  return { field, input, prefix, buttoned };
}

/** The box Group an Input · DateInput sits in; undefined when its Group is not a field box. */
export function catalogFieldBoxOfInput(
  input: CatalogConsumerNode,
  get: CatalogRecordLookup,
  typeOf: CatalogTypeOf,
): CatalogConsumerNode | undefined {
  if (!BOX_INPUT_TYPES.has(typeOf(input))) return undefined;
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
    fontSize,
    paddingX,
    paddingY,
    borderWidth,
    /** The one-line box's height: line + padding + border (md 18 + 12 + 2 = 32 — S2 control height). */
    height: lineHeight + 2 * paddingY + 2 * borderWidth,
  };
}

/**
 * S2 NumberField's stepper container (`NumberField.tsx` `stepperContainerStyles`): the gap between
 * the steppers and the end margin after them, per field size (S2 has no XS — it takes S's). Here
 * they are the box Group's own layout — its `gap` and end padding — so the Group's Layout tab shows
 * and edits them (2026-11-13, 사용자 「group 의 right padding · gap 이 적용 · 일치하지 않음」).
 */
const STEPPER_GAP_PX: Readonly<Record<string, number>> = {
  XS: 8,
  S: 8,
  M: 4,
  L: 8,
  XL: 8,
};
/** S2 NumberField's stepper end margin — and S2 DatePicker's `FieldGroup` `paddingEnd` (same set). */
const STEPPER_END_PX: Readonly<Record<string, number>> = {
  XS: 2,
  S: 2,
  M: 4,
  L: 6,
  XL: 6,
};
/** The fields S2 boxes around one input — no button in the box. */
const PLAIN_BOXED_FIELDS: ReadonlySet<string> = new Set([
  "TextField",
  "TextArea",
  "ColorField",
  "DateField",
  "TimeField",
]);
/** A ComboBox box's gap between its Input and button (사용자 2026-11-13 — every size). */
const COMBO_BOX_GAP_PX = 4;
/** A SearchField box's gap between its glyph, Input and clear button (사용자 2026-11-13 — every size). */
const SEARCH_BOX_GAP_PX = 8;
const sizeKey = (size: unknown) =>
  typeof size === "string" && size in STEPPER_GAP_PX ? size : "M";

/**
 * A date picker's box gap — the room between its DateInput(s), the range dash and the calendar button
 * (the range picker's former `--drp-group-gap`: XS 2xs · S ~ L xs · XL sm; a DatePicker is the range
 * picker's box with one DateInput, 사용자 2026-11-13). The inputs have no end padding.
 */
const DATE_BOX_GAP: Readonly<Record<string, string>> = {
  XS: "var(--spacing-2xs)",
  S: "var(--spacing-xs)",
  M: "var(--spacing-xs)",
  L: "var(--spacing-xs)",
  XL: "var(--spacing-sm)",
};
function dateBoxGap(size: unknown): number {
  const ref = cssVarToTokenRef(DATE_BOX_GAP[sizeKey(size)]!);
  const resolved = ref ? resolveToken(ref as TokenRef) : undefined;
  return typeof resolved === "number" ? resolved : 4;
}
/** S2 DateRangePicker's `FieldGroup` `paddingEnd: 4` (every size). */
const DATE_RANGE_BOX_END_PX = 4;

/**
 * The box Group's end padding and gap, S2's per field (`buttoned`: a shown Button is in the box):
 * - NumberField — the stepper container's end margin and gap (above).
 * - ComboBox — `FieldGroup` `paddingEnd: height × 3/16 − border` (`ComboBox.tsx`); gap 4 (사용자) —
 *   the rest of the button's `text-to-control` start room is the Input's end padding.
 * - DatePicker — `FieldGroup` `paddingEnd` S 2 · M 4 · L 6 · XL 6 (`DatePicker.tsx`), the date gap.
 * - DateRangePicker — `FieldGroup` `paddingEnd: 4` (`DateRangePicker.tsx`), the date gap.
 * - a prefix box of any other field — none: its Input keeps its own end padding.
 */
function boxEnd(
  fieldType: string | undefined,
  size: unknown,
  buttoned: boolean,
): { end: number; gap?: number; start?: number } {
  const key = sizeKey(size);
  if (fieldType === "NumberField")
    return buttoned
      ? { end: STEPPER_END_PX[key]!, gap: STEPPER_GAP_PX[key]! }
      : { end: 0 };
  if (fieldType === "ComboBox") {
    const box = inputBox(size);
    return {
      end: Math.round(((box.height * 3) / 16 - box.borderWidth) * 100) / 100,
      // (사용자 2026-11-13 「combobox-group 에 gap 4px」 — the Input's end padding is the rest of
      //  `text-to-control`.)
      gap: COMBO_BOX_GAP_PX,
    };
  }
  if (fieldType === "DatePicker")
    return { end: STEPPER_END_PX[key]!, gap: dateBoxGap(size) };
  if (fieldType === "DateRangePicker")
    return { end: DATE_RANGE_BOX_END_PX, gap: dateBoxGap(size) };
  // SearchField: the box's start and end padding are the other fields' start (`edge-to-text` — md 12,
  //   사용자 2026-11-13 「searchfield-group 에 padding-left 12px」 · 「padding-right 12」; S2's `pill`
  //   less the glyph's `fontRelative(-2)` was md 14, and S2's `paddingEnd: 0` let the clear button end it).
  // (사용자 2026-11-13 「searchfield-group 에 gap 8px」 — the glyph · Input · clear button room.)
  if (fieldType === "SearchField")
    return { end: inputBox(size).paddingX, gap: SEARCH_BOX_GAP_PX };
  // A plain text · date field: S2 `FieldGroup` `control()` — `edge-to-text` both sides, the input in it
  //   none (2026-11-14 사용자 「TextField · TextArea · ColorField · DateField · TimeField 도 S2 구조」).
  if (PLAIN_BOXED_FIELDS.has(fieldType ?? ""))
    return { end: inputBox(size).paddingX };
  return { end: 0 };
}

/**
 * A field box Group's box at the field's size (S2 `FieldGroup`, `centerBaseline` — items centred):
 * the Input rule's start padding and border, S2's end padding and gap (`boxEnd`), and — one-line
 * fields — the Input box's height with the row centred in it. A TextArea keeps the vertical padding
 * (its `<textarea>` is the rows box less it), with the prefix at the first line.
 */
export function catalogFieldBoxStyle(
  size: unknown,
  fieldType?: string,
  /** A shown Button is in the box (`catalogFieldBox(...).buttoned`). */
  buttoned = false,
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
  gap?: number;
} {
  const box = inputBox(size);
  const multiline = fieldType === "TextArea";
  const { end, gap, start } = boxEnd(fieldType, size, buttoned);
  return {
    display: "flex",
    flexDirection: "row",
    alignItems: multiline ? "flex-start" : "center",
    width: "100%",
    ...(multiline ? {} : { height: box.height }),
    paddingTop: multiline ? box.paddingY : 0,
    paddingRight: end,
    paddingBottom: multiline ? box.paddingY : 0,
    paddingLeft: start ?? box.paddingX,
    borderWidth: box.borderWidth,
    ...(gap !== undefined ? { gap } : {}),
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
  // (The box holds the control height — S2 `FieldGroup`; the Input in it keeps no minimum of its own,
  //  사용자 2026-11-13 「group 로 다 옮겨지지 않았다」 — it was 32 in the 28 inner box.)
  minHeight: 0,
  width: "auto",
  flexGrow: 1,
  flexShrink: 1,
  flexBasis: 0,
  minWidth: 0,
  // (An Input in a prefix box keeps no maximum — the Group is the box. A ColorField's own
  // per-size maximum is gone too, user 2026-10-25.)
  maxWidth: "none",
} as const;

/**
 * The laid-down defaults of an Input (DateInput) in its box (`CATALOG_FIELD_BOX_INPUT_STYLE`): it fills
 * the row — except a DateRangePicker's start DateInput, which keeps its content width so the dash and the
 * end DateInput follow it (S2 `DateInputContainer` — the end one takes the rest, the button at the end).
 */
export function catalogFieldBoxInputStyle(
  input: CatalogConsumerNode,
  get: CatalogRecordLookup,
  typeOf: CatalogTypeOf,
): typeof CATALOG_FIELD_BOX_INPUT_STYLE | CatalogFieldBoxInputContentStyle {
  const group = get(input.parentId);
  const box = group && catalogFieldBox(group, get, typeOf);
  return box &&
    typeOf(box.field) === "DateRangePicker" &&
    input.props.slot === "start"
    ? { ...CATALOG_FIELD_BOX_INPUT_STYLE, flexGrow: 0, flexBasis: "auto" }
    : CATALOG_FIELD_BOX_INPUT_STYLE;
}
type CatalogFieldBoxInputContentStyle = Omit<
  typeof CATALOG_FIELD_BOX_INPUT_STYLE,
  "flexGrow" | "flexBasis"
> & { flexGrow: 0; flexBasis: "auto" };

/**
 * The Input's end padding in its box: none (0) before a button — the box's gap is the room between
 * them (사용자 2026-11-13 「numberfield · combobox-group-input 의 padding-right 제거」) — and none in a
 * SearchField (its clear button ends the box). Undefined: its own rule's end padding (no button shown
 * in a NumberField · ComboBox, a prefix box of another field, or a DatePicker's DateInput — its
 * template lays its padding down).
 */
export function catalogFieldBoxInputEnd(
  input: CatalogConsumerNode,
  get: CatalogRecordLookup,
  typeOf: CatalogTypeOf,
): number | undefined {
  if (!BOX_INPUT_TYPES.has(typeOf(input))) return undefined;
  const group = get(input.parentId);
  const box = group && catalogFieldBox(group, get, typeOf);
  if (!box) return undefined;
  const fieldType = typeOf(box.field);
  // (A DatePicker's DateInput: no end padding — the box's gap is the room before its button,
  //  사용자 2026-11-13 「DatePicker 입력의 오른쪽 padding 도 0」. A DateRangePicker's two the same —
  //  the gap is the room around the dash and before the button, 2026-11-14.)
  if (
    fieldType === "SearchField" ||
    fieldType === "DatePicker" ||
    fieldType === "DateRangePicker" ||
    PLAIN_BOXED_FIELDS.has(fieldType)
  )
    return 0;
  return box.buttoned &&
    (fieldType === "NumberField" || fieldType === "ComboBox")
    ? 0
    : undefined;
}

/**
 * The room after a field's prefix (S2 `FieldGroup` prefix `marginEnd: 'text-to-visual'`), per field size —
 * the Input's start padding, not the prefix's margin (2026-11-13 사용자 「prefix 의 margin-inline-end 도
 * padding · gap 으로」).
 */
const PREFIX_GAP_PX: Readonly<Record<string, number>> = {
  XS: 4,
  S: 5,
  M: 6,
  L: 7,
  XL: 8,
};

/**
 * The Input's start padding after what precedes it in its box — the Input's own (its Layout tab edits
 * it), not a margin of the part before it:
 * a shown prefix — the prefix room above, less the box's gap. Undefined: the laid-down 0.
 */
export function catalogFieldBoxInputStart(
  input: CatalogConsumerNode,
  get: CatalogRecordLookup,
  typeOf: CatalogTypeOf,
): number | undefined {
  if (typeOf(input) !== "Input") return undefined;
  const group = get(input.parentId);
  const box = group && catalogFieldBox(group, get, typeOf);
  if (!box) return undefined;
  const at = group.children.indexOf(input.id);
  const before = group.children
    .slice(0, at)
    .flatMap((id) => {
      const child = get(id);
      return child && !child.hidden ? [child] : [];
    });
  const size = box.field.props.size;
  // (The box's own gap — a NumberField's stepper gap — lies between them too: the padding is the rest.)
  if (before.some((child) => catalogIsFieldPrefix(child, typeOf)))
    return Math.max(
      0,
      PREFIX_GAP_PX[sizeKey(size)]! -
        (boxEnd(typeOf(box.field), size, box.buttoned).gap ?? 0),
    );
  // (A SearchField's glyph → text room is the box's gap — 사용자 2026-11-13 「searchfield-group-input 의
  //  padding-left 제거」.)
  return undefined;
}
