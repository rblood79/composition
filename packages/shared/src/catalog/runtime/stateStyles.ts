import {
  Children,
  cloneElement,
  isValidElement,
  type CSSProperties,
  type ReactElement,
  type ReactNode,
} from "react";
import type { StateName } from "../document/types";

/** DOM state predicates, independent of component type. RAC owns its data attributes. */
const STATES: Readonly<Record<StateName, string>> = {
  hover: ":is([data-hovered], :hover):not([data-disabled]):not(:disabled)",
  focusVisible: ":is([data-focus-visible], :focus-visible)",
  pressed: ":is([data-pressed], :active):not([data-disabled]):not(:disabled)",
  selected: "[data-selected]",
  selectedHover:
    "[data-selected]:is([data-hovered], :hover):not([data-disabled]):not(:disabled)",
  selectedPressed:
    "[data-selected]:is([data-pressed], :active):not([data-disabled]):not(:disabled)",
  disabled: ":is([data-disabled], :disabled)",
};

// CSS output capabilities, not visual defaults. Explicit state writes use the same CSS
// conversion as authored rest values; the sheet only selects which write is active.
const PROPERTIES = [
  "aspectRatio",
  "--icon-size",
  "--icon-gap",
  "backgroundColor",
  "color",
  "borderColor",
  "borderRadius",
  "borderWidth",
  "fontSize",
  "fontWeight",
  "width",
  "height",
  "minWidth",
  "minHeight",
  "rowGap",
  "columnGap",
  "paddingTop",
  "paddingRight",
  "paddingBottom",
  "paddingLeft",
  "lineHeight",
  "opacity",
  "overflow",
  "borderStyle",
  "boxShadow",
  "filter",
  "transform",
  "zIndex",
  "backgroundImage",
  "backgroundSize",
  "borderTopLeftRadius",
  "borderTopRightRadius",
  "borderBottomRightRadius",
  "borderBottomLeftRadius",
  "borderTopWidth",
  "borderRightWidth",
  "borderBottomWidth",
  "borderLeftWidth",
  "fontFamily",
  "fontStyle",
  "letterSpacing",
  "textAlign",
  "textTransform",
  "textDecoration",
  "whiteSpace",
  "wordBreak",
  "overflowWrap",
  "textOverflow",
] as const;
const UNITLESS = new Set([
  "fontWeight",
  "lineHeight",
  "opacity",
  "zIndex",
  "aspectRatio",
]);
const cssName = (key: string) =>
  key.replace(/[A-Z]/g, (letter) => `-${letter.toLowerCase()}`);
const SUPPORTED = new Set<string>(PROPERTIES);

/** Generated with the normal catalog CSS build; loaded by Builder, Preview and Publish. */
export function catalogStateStylesheet(): string {
  return (
    "/* Generated from catalog/runtime/stateStyles.ts. Do not edit. */\n" +
    Object.entries(STATES)
      .flatMap(([stateName, predicate]) =>
        PROPERTIES.map((key) => {
          const state = cssName(stateName);
          const property = cssName(key);
          // Authored state wins over authored rest inline styles. No declaration is emitted for
          // an absent key, so rest/theme paint and child inheritance remain untouched.
          return `[data-catalog-${state}~="${property}"]:where(${predicate}) { ${property}: var(--catalog-${state}-${property}) !important; }`;
        }),
      )
      .join("\n") +
    "\n"
  );
}

export type CatalogStateStyles = Partial<Record<StateName, CSSProperties>>;

/** No wrapper and no per-node event listener; native leaves and RAC parts share this channel. */
export function withCatalogStateStyles(
  element: ReactElement | null,
  states: CatalogStateStyles | undefined,
): ReactElement | null {
  if (!element || !states) return element;
  // Orphan collection hosts and marker wrappers have no painted box. Their first child is
  // the actual node (TagGroup → TagList → Tag, RadioGroup → Radio, marker → Table).
  const ownProps = element.props as {
    style?: CSSProperties;
    children?: ReactNode;
  };
  if (ownProps.style?.display === "contents") {
    let applied = false;
    return cloneElement(
      element,
      {},
      Children.map(ownProps.children, (child) => {
        if (applied || !isValidElement(child)) return child;
        applied = true;
        return withCatalogStateStyles(child, states);
      }),
    );
  }
  const variables: Record<string, string> = {};
  const attributes: Record<string, unknown> = {};
  for (const [stateName, styles] of Object.entries(states)) {
    const state = cssName(stateName);
    const keys: string[] = [];
    for (const [key, value] of Object.entries(styles)) {
      if (value === undefined || value === null) continue;
      if (!SUPPORTED.has(key))
        throw new Error(`CATALOG_STATE_CSS_UNSUPPORTED:${key}`);
      const property = cssName(key);
      keys.push(property);
      variables[`--catalog-${state}-${property}`] =
        typeof value === "number" && !UNITLESS.has(key)
          ? `${value}px`
          : String(value);
    }
    if (keys.length) attributes[`data-catalog-${state}`] = keys.join(" ");
  }
  const own = (
    element.props as {
      style?: CSSProperties | ((values: never) => CSSProperties);
    }
  ).style;
  return cloneElement(element, {
    ...attributes,
    style:
      typeof own === "function"
        ? (values: never) => ({ ...own(values), ...variables })
        : { ...own, ...variables },
  } as Partial<unknown>);
}
