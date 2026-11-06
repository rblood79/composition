import { createElement, type ElementType, type ReactNode } from "react";
import {
  SELECTION_COMPOSITE_DEFINITIONS,
  SELECTION_COMPOSITE_TEMPLATES,
} from "../catalog/document/selectionCompositesOrigins";
import { bindTemplateValue } from "../catalog/document/templateBindingValue";
import type {
  LibraryDefinition,
  LibraryTemplateNode,
  PropValue,
  PropValues,
} from "../catalog/document/types";

type Props = Record<string, PropValue>;
const definitions = new Map<string, LibraryDefinition>(
  SELECTION_COMPOSITE_DEFINITIONS.map((item) => [item.id, item]),
);
const templates = new Map<string, LibraryTemplateNode>(
  SELECTION_COMPOSITE_TEMPLATES.map((item) => [item.id, item]),
);

function literalProps(values: PropValues): Props {
  const result: Props = {};
  for (const [key, value] of Object.entries(values)) {
    if (
      value &&
      typeof value === "object" &&
      "kind" in value &&
      value.kind === "token"
    ) {
      throw new Error(`TOKEN_REQUIRES_CATALOG_RESOLUTION:${key}`);
    }
    result[key] = value;
  }
  return result;
}

/** The public adapter renders this family's actual authored defaults, including nested origins. */
export function selectionCompositesDefaultChildren(
  type: "ActionBar" | "SelectBoxGroup" | "SelectBox",
  components: Readonly<Record<string, ElementType>>,
  overrides: Props = {},
): ReactNode {
  const definition = SELECTION_COMPOSITE_DEFINITIONS.find(
    (item) => item.name === type,
  )!;
  const bindings = { ...literalProps(definition.defaults), ...overrides };
  function render(id: string, values: Props): ReactNode {
    const node = templates.get(id)!;
    const props = Object.fromEntries(
      Object.entries(literalProps(node.props)).map(([key, value]) => [
        key,
        bindTemplateValue(value, values),
      ]),
    );
    if (node.presentWhen === "nonEmptyText" && !props.children) return null;
    const style = Object.fromEntries(
      Object.entries({ ...node.layout, ...node.visual }).map(([key, value]) => [
        (
          {
            insetTop: "top",
            insetLeft: "left",
            insetBottom: "bottom",
            insetRight: "right",
          } as Record<string, string>
        )[key] ?? key,
        value,
      ]),
    );
    const nested = definitions.get(node.definitionId);
    if (nested) {
      const root = templates.get(nested.templateRootId!)!;
      const nestedValues = { ...literalProps(nested.defaults), ...props };
      return createElement(
        components[nested.name],
        { ...nestedValues, style, key: id },
        root.children.map((child) => render(child, nestedValues)),
      );
    }
    const name =
      node.definitionId === "lib:definition:text"
        ? "Text"
        : node.definitionId.replace(
            /^lib:definition:(type-|origin-component-)/,
            "",
          );
    if (name === "Icon" && (!props.iconName || props.iconName === "{icon}"))
      return null;
    const component = components[name];
    if (!component)
      throw new Error(`UNSUPPORTED_SELECTION_COMPOSITE_DEFAULT_SLOT:${name}`);
    const content = props.children;
    delete props.children;
    return createElement(
      component,
      { ...props, style, key: id },
      node.children.length
        ? node.children.map((child) => render(child, values))
        : (content as ReactNode),
    );
  }
  return templates
    .get(definition.templateRootId!)!
    .children.map((id) => render(id, bindings));
}
