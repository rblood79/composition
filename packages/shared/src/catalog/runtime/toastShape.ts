/**
 * The app's toast shape (user 2026-11-01 — RAC `Toast.tsx` `MyToastRegion`: one shape per app, a
 * `toast` Do passes data; S2 exposes no `<Toast>` element, only `ToastContainer` + `ToastQueue`).
 *
 * The shape is a project component whose root is a Toast (`ProjectEntry.toastShapeId`); the region
 * renders its template for every toast — a composition root in the definition view (`definitionView`),
 * one shape per revision — with the toast's data over the records (`CatalogDomRuntime.overrideOf`):
 * the title in the Toast's first text that is not a Button's, the action label on the first Button
 * (hidden when the toast has none), the variant on the root; the Button's press runs the Do's
 * action and the close button closes the toast (`CatalogToastShapeContext`).
 */
import type {
  CatalogCompositionRoot,
  CatalogConsumerNode,
} from "./compositionRoot";
import type { CatalogDomRuntime } from "./domBinding.runtime";
import { catalogTypeName } from "./delegatedDom.runtime";
import type { ToastRenderInput } from "../../components/Toast";

export { CatalogToastShapeContext } from "./toastShapeContext";

export interface CatalogToastShapeParts {
  /** The Toast root record. */
  toastId: string;
  /** The text the title goes in (the first Text under the Toast that is not a Button's). */
  titleId?: string;
  /** The action Button and the text its label goes in. */
  buttonId?: string;
  buttonTextId?: string;
}

/** The records of the shape the toast's data goes to. */
export function catalogToastShapeParts(
  root: CatalogCompositionRoot,
  toastId: string,
): CatalogToastShapeParts {
  const parts: CatalogToastShapeParts = { toastId };
  const typeOf = (node: CatalogConsumerNode) => catalogTypeName(root, node);
  const walk = (id: string, inButton: boolean): void => {
    const node = root.domInputs.get(id);
    if (!node) return;
    const type = typeOf(node);
    if (id !== toastId) {
      if (type === "Button" && !inButton && !parts.buttonId) {
        parts.buttonId = id;
        for (const child of node.children) walk(child, true);
        return;
      }
      if (type === "Text" || type === "Paragraph") {
        if (inButton) {
          if (!parts.buttonTextId) parts.buttonTextId = id;
          return;
        }
        if (!parts.titleId) {
          parts.titleId = id;
          return;
        }
      }
    }
    for (const child of node.children) walk(child, inButton);
  };
  walk(toastId, false);
  return parts;
}

/**
 * The runtime the shape renders with: the session's (its rules · overrides) plus this toast's data
 * over the shape's records.
 */
export function catalogToastShapeRuntime(
  base: CatalogDomRuntime | undefined,
  parts: CatalogToastShapeParts,
  toast: ToastRenderInput,
): CatalogDomRuntime {
  const overrides = new Map<string, Record<string, unknown>>();
  overrides.set(parts.toastId, { variant: toast.variant });
  if (parts.titleId) overrides.set(parts.titleId, { children: toast.title });
  if (parts.buttonId)
    overrides.set(
      parts.buttonId,
      toast.actionLabel
        ? { label: toast.actionLabel }
        : { style: { display: "none" } },
    );
  if (parts.buttonTextId && toast.actionLabel)
    overrides.set(parts.buttonTextId, { children: toast.actionLabel });
  const handlers = new Map<
    string,
    Readonly<Record<string, (...args: unknown[]) => void>>
  >();
  if (parts.buttonId && toast.actionLabel)
    handlers.set(parts.buttonId, {
      onPress: () => {
        toast.onAction?.();
        if (toast.shouldCloseOnAction) toast.close();
      },
    });
  return {
    revisionOf: (id) => base?.revisionOf(id) ?? 0,
    handlersOf: (id) => ({ ...base?.handlersOf(id), ...handlers.get(id) }),
    overrideOf: (id) => {
      const own = overrides.get(id);
      const under = base?.overrideOf(id);
      return own || under ? { ...under, ...own } : undefined;
    },
    subscribe: (id, notify) => base?.subscribe(id, notify) ?? (() => {}),
  };
}
