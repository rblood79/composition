import { catalogTypeDefinitionId } from "../../../../../packages/shared/src/catalog/document/codeCatalogLibrary";
import {
  catalogFieldBox,
  catalogFieldBoxOfInput,
} from "../../../../../packages/shared/src/catalog/runtime/fieldPrefix";
import {
  catalogAuthoredVisual,
  catalogLibraryVisual,
} from "../../../../../packages/shared/src/catalog/runtime/libraryVisual";
import { catalogBoxModel, type CatalogBoxModel } from "./boxModel";
import type {
  CatalogCompositionRoot,
  CatalogConsumerNode,
} from "./compositionRoot";

const pxOf = (value: unknown): number | undefined =>
  typeof value === "number"
    ? value
    : typeof value === "string" && /^-?\d+(?:\.\d+)?px$/.test(value.trim())
      ? Number.parseFloat(value)
      : undefined;
const same = (a: unknown, b: unknown) => {
  const A = pxOf(a);
  const B = pxOf(b);
  return A !== undefined && B !== undefined ? Math.abs(A - B) < 0.01 : a === b;
};

/**
 * A record's box model as it is drawn: its own (`catalogBoxModel` — the authored and rule values)
 * where the layout input says the same, else the layout input's px. The Canvas layout lays more over
 * a record than its box model holds — a field's box Group's padding · gap · border (S2
 * `FieldGroup`), the Input laid into it, a rule's gap longhand, a part rule's border, a component's
 * placement (`compositionRoot.ts` `recordStyle`). The Styles panel's values, the Canvas spacing
 * handles and their drags read this one model, so their numbers are the drawn ones (2026-11-13,
 * 사용자 「hover 한 gap · padding 손잡이가 0 — 전체적인 버그」 — 13 component families differed).
 * Undefined from `catalogDrawnBoxDelta` where nothing differs.
 */
export function catalogDrawnBoxModel(
  root: CatalogCompositionRoot,
  record: CatalogConsumerNode,
): CatalogBoxModel {
  return catalogDrawnBoxDelta(root, record) ?? catalogBoxModel(record);
}

/** The drawn box model where it differs from the record's own; undefined where it does not. */
export function catalogDrawnBoxDelta(
  root: CatalogCompositionRoot,
  record: CatalogConsumerNode,
): CatalogBoxModel | undefined {
  const input = root.getDrawnLayoutStyle(record.id);
  if (!input) return undefined;
  const model = catalogBoxModel(record);
  const own = model.padding;
  const side = (key: string, value: CatalogBoxModel["borderWidth"]) =>
    pxOf(input[key]) ?? value ?? 0;
  const padding = {
    top: side("paddingTop", own?.top),
    right: side("paddingRight", own?.right),
    bottom: side("paddingBottom", own?.bottom),
    left: side("paddingLeft", own?.left),
  };
  const borderWidth =
    pxOf(input.borderTop) ?? pxOf(input.borderWidth) ?? model.borderWidth;
  const display =
    typeof input.display === "string" ? input.display : model.display;
  const flexDirection =
    typeof input.flexDirection === "string"
      ? input.flexDirection
      : model.flexDirection;
  // (The gap a flex row draws is its column gap — a column flex its row gap.)
  const mainGap = (flexDirection ?? "row").startsWith("column")
    ? input.rowGap
    : input.columnGap;
  const gap = pxOf(mainGap) ?? model.gap;
  const drawn: CatalogBoxModel = {
    ...model,
    display,
    ...(flexDirection !== undefined ? { flexDirection } : {}),
    ...(typeof input.alignItems === "string"
      ? { alignItems: input.alignItems }
      : {}),
    padding,
    ...(borderWidth !== undefined ? { borderWidth } : {}),
    ...(gap !== undefined ? { gap } : {}),
    // (A field's box Group's height is the box's — S2 control height — not its record's.)
    ...(catalogFieldBox(
      record,
      (id) => root.domInputs.get(id),
      (entry) => root.typeOf(entry),
    ) && pxOf(input.height) !== undefined
      ? { height: pxOf(input.height) }
      : {}),
  };
  const differs =
    !same(drawn.padding!.top, own?.top ?? 0) ||
    !same(drawn.padding!.right, own?.right ?? 0) ||
    !same(drawn.padding!.bottom, own?.bottom ?? 0) ||
    !same(drawn.padding!.left, own?.left ?? 0) ||
    !same(drawn.borderWidth ?? 0, model.borderWidth ?? 0) ||
    !same(drawn.gap ?? 0, model.gap ?? 0) ||
    drawn.display !== model.display ||
    drawn.height !== model.height;
  return differs ? drawn : undefined;
}

/**
 * What a field box draws where its record says otherwise (the Canvas `fieldBoxShapeInput` ·
 * `fieldBoxLayout`, the DOM `.react-aria-FieldBox` sheet · `CATALOG_FIELD_BOX_INPUT_STYLE`): a boxed
 * field's control Group (S2 `FieldGroup` — NumberField · ComboBox · DatePicker · SearchField, and a
 * prefix box) draws the Input rule's box at the field's size — its corner is the Input's there; the
 * Input (DateInput) laid into it draws none — no corner, no minimum height (the box holds the control
 * height). An authored value on either wins, as on the Canvas. Empty for any other record. The Styles
 * panel reads it (2026-11-13, 사용자 「combobox-group border-radius 가 디자인 패널에 나타나지 않고 이전의
 * input 의 radius 가 나타난다」 · 「border-color 도 input 에 들어 있다, 다 옮겨지지 않았다」).
 */
export function catalogDrawnFieldBoxVisual(
  root: CatalogCompositionRoot,
  record: CatalogConsumerNode,
): { radius?: unknown; minHeight?: unknown } {
  const role = catalogFieldBoxRole(root, record);
  if (!role) return {};
  const authored = catalogAuthoredVisual(root, record);
  const unwritten = (values: Record<string, unknown>) =>
    Object.fromEntries(
      Object.entries(values).filter(
        ([key, value]) => value !== undefined && authored[key] === undefined,
      ),
    );
  if (role === "laid") return unwritten({ radius: 0, minHeight: 0 });
  return unwritten({
    radius: catalogLibraryVisual(root, {
      ...record,
      definitionId: catalogTypeDefinitionId("Input"),
      props: { size: role.size },
    } as CatalogConsumerNode).radius,
  });
}

/**
 * A record's part in a field box: the box (the control Group — it draws the Input rule at `size`
 * with `props`, as `fieldBoxShapeInput` does), the Input laid into it (`"laid"` — no paint of its
 * own: transparent, no border), or neither.
 */
export function catalogFieldBoxRole(
  root: CatalogCompositionRoot,
  record: CatalogConsumerNode,
):
  | { size: string; props: Readonly<Record<string, unknown>> }
  | "laid"
  | undefined {
  const get = (id: string) => root.domInputs.get(id);
  const typeOf = (entry: CatalogConsumerNode) => root.typeOf(entry);
  const box = catalogFieldBox(record, get, typeOf);
  if (box) {
    const size = String(box.field.props.size ?? "M");
    return {
      size,
      props: {
        ...record.props,
        ...record.derivedProps,
        size,
        variant: "default",
      },
    };
  }
  return catalogFieldBoxOfInput(record, get, typeOf) ? "laid" : undefined;
}
