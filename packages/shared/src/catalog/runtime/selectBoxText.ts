import type { CatalogConsumerNode } from "./compositionRoot";
import { Children, isValidElement, type ReactNode } from "react";

/** The authored label slot supplies RAC's typeahead name through layout wrappers. */
export function catalogSelectBoxText(
  node: CatalogConsumerNode,
  get: (id: string) => CatalogConsumerNode | undefined,
): string {
  if (typeof node.props.textValue === "string" && node.props.textValue) {
    return node.props.textValue;
  }
  const visit = (current: CatalogConsumerNode): string | undefined => {
    if (
      current.props.slot === "label" &&
      typeof current.props.children === "string"
    ) {
      return current.props.children;
    }
    for (const id of current.children) {
      const child = get(id);
      const text = child && visit(child);
      if (text !== undefined) return text;
    }
    return undefined;
  };
  return visit(node) ?? "";
}

/** Public Code View components carry the same authored label slot in React children. */
export function selectBoxChildrenText(children: ReactNode): string {
  for (const child of Children.toArray(children)) {
    if (!isValidElement<{ slot?: string; children?: ReactNode }>(child))
      continue;
    if (child.props.slot === "label") {
      return Children.toArray(child.props.children)
        .filter(
          (value) => typeof value === "string" || typeof value === "number",
        )
        .join("");
    }
    const text = selectBoxChildrenText(child.props.children);
    if (text) return text;
  }
  return "";
}
