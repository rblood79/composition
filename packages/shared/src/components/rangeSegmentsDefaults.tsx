import { createElement, type ElementType, type ReactNode } from "react";
import {
  RANGE_SEGMENT_DEFINITIONS,
  RANGE_SEGMENT_TEMPLATES,
} from "../catalog/document/rangeSegmentsOrigins";
import { bindTemplateValue } from "../catalog/document/templateBindingValue";
import type {
  AuthoredValue,
  LibraryDefinition,
  LibraryTemplateNode,
} from "../catalog/document/types";

type Props = Record<string, AuthoredValue>;
const definitions = new Map<string, LibraryDefinition>(
  RANGE_SEGMENT_DEFINITIONS.map((item) => [item.id, item]),
);
const templates = new Map<string, LibraryTemplateNode>(
  RANGE_SEGMENT_TEMPLATES.map((item) => [item.id, item]),
);

/** Only these two adapters' known RAC slots; the catalog keeps the authored default tree. */
export function rangeSegmentsDefaultChildren(
  type: "RangeSlider" | "SegmentedControl" | "SegmentedControlItem",
  components: Readonly<Record<string, ElementType>>,
  overrides: Props = {},
): ReactNode {
  const definition = RANGE_SEGMENT_DEFINITIONS.find(
    (item) => item.name === type,
  )!;
  const bindings: Props = { ...definition.defaults, ...overrides };
  function render(id: string, values: Props): ReactNode {
    const node = templates.get(id)!;
    for (const key of Object.keys(node.visual ?? {}))
      if (
        key !== "width" &&
        key !== "height" &&
        !(
          node.definitionId === "lib:definition:type-frame" &&
          (key === "minWidth" || key === "gap")
        )
      )
        throw new Error(`UNSUPPORTED_RANGE_SEGMENT_DEFAULT_VISUAL:${key}`);
    if (
      Object.keys(node.layout ?? {}).length &&
      node.definitionId !== "lib:definition:type-frame"
    )
      throw new Error("UNSUPPORTED_RANGE_SEGMENT_DEFAULT_LAYOUT");
    if (
      node.showWhen &&
      (node.definitionId !== "lib:definition:type-SelectionIndicator" ||
        JSON.stringify(node.showWhen) !==
          JSON.stringify({ all: ["isSelected"] }))
    )
      throw new Error("UNSUPPORTED_RANGE_SEGMENT_DEFAULT_CONDITION");
    const props = Object.fromEntries(
      Object.entries(node.props).map(([key, value]) => [
        key,
        bindTemplateValue(value, values),
      ]),
    );
    if (
      node.presentWhen === "nonEmptyText" &&
      !String(props.children ?? "").trim()
    )
      return null;
    const nested = definitions.get(node.definitionId);
    if (nested) {
      const root = templates.get(nested.templateRootId!)!;
      return createElement(
        components[nested.name],
        { ...nested.defaults, ...props, key: id },
        root.children.map((child) =>
          render(child, { ...nested.defaults, ...props }),
        ),
      );
    }
    const name =
      node.definitionId === "lib:definition:origin-component-label"
        ? "Label"
        : node.definitionId === "lib:definition:type-frame"
          ? "frame"
          : node.definitionId === "lib:definition:text"
            ? "Text"
            : node.definitionId.slice("lib:definition:type-".length);
    if (name === "Icon" && (!props.iconName || props.iconName === "{icon}"))
      return null;
    const component = components[name];
    if (!component)
      throw new Error(`UNSUPPORTED_RANGE_SEGMENT_DEFAULT_SLOT:${name}`);
    const children = props.children;
    delete props.children;
    return createElement(
      component,
      {
        ...props,
        style: {
          ...node.layout,
          ...(node.visual?.minWidth !== undefined
            ? { minWidth: node.visual.minWidth }
            : {}),
          ...(node.visual?.gap !== undefined ? { gap: node.visual.gap } : {}),
          ...(node.visual?.width !== undefined
            ? { width: node.visual.width }
            : {}),
          ...(node.visual?.height !== undefined
            ? { height: node.visual.height }
            : {}),
        },
        key: id,
      },
      node.children.length
        ? node.children.map((child) => render(child, values))
        : (children as ReactNode),
    );
  }
  return templates
    .get(definition.templateRootId!)!
    .children.map((id) => render(id, bindings));
}
