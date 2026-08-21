import type { EditorInvalidationKind } from "../editorPresentationTypes";

export type EditorMutationEffectAxis =
  "descriptor" | "geometry" | "prop" | "style";

export type EditorMutationEffectPropagation = "self" | "inherited-subtree";
export type EditorMutationCacheSignature = "prop" | "style" | null;

interface EditorMutationLegacyViewOrder {
  readonly inheritedLayoutStyle?: number;
  readonly layoutAffectingProp?: number;
  readonly layoutPropCache?: number;
  readonly layoutStyleCache?: number;
  readonly nonLayoutStyle?: number;
}

export interface EditorPropertyEffectRule {
  readonly axis: EditorMutationEffectAxis;
  readonly cacheSignature: EditorMutationCacheSignature;
  readonly continuous: boolean;
  readonly invalidation: EditorInvalidationKind;
  readonly key: string;
  readonly legacyViewOrder: EditorMutationLegacyViewOrder;
  readonly propagation: EditorMutationEffectPropagation;
}

const LAYOUT_AFFECTING_PROP_SOURCE = [
  "style",
  "size",
  "layout",
  "columns",
  "label",
  "title",
  "description",
  "children",
  "text",
  "placeholder",
  "orientation",
  "items",
  "iconName",
  "iconPosition",
  "allowsRemoving",
  "maxRows",
  "value",
  "minValue",
  "maxValue",
  "variant",
  "density",
  "granularity",
  "hourCycle",
  "locale",
  "calendar",
  "calendarSystem",
  "necessityIndicator",
  "isRequired",
  "labelPosition",
  "overflow",
  "formatOptions",
  "showValueLabel",
  "valueLabel",
  "isExpanded",
  "allowsMultipleExpanded",
  "selectionMode",
  "selectionStyle",
  "selectionBehavior",
  "selectedKey",
  "selectedValue",
  "inputValue",
  "padding",
  "paddingTop",
  "paddingRight",
  "paddingBottom",
  "paddingLeft",
  "borderWidth",
  "borderTopWidth",
  "borderRightWidth",
  "borderBottomWidth",
  "borderLeftWidth",
] as const;

const LAYOUT_PROP_CACHE_SOURCE = [
  "children",
  "text",
  "label",
  "title",
  "description",
  "placeholder",
  "selectedKey",
  "selectedValue",
  "inputValue",
  "value",
  "size",
  "density",
  "layout",
  "orientation",
  "items",
  "options",
  "rows",
  "columns",
  "src",
  "allowsRemoving",
  "maxRows",
  "granularity",
  "hourCycle",
  "locale",
  "calendar",
  "calendarSystem",
  "necessityIndicator",
  "isRequired",
  "labelPosition",
  "iconName",
  "iconPosition",
  "minValue",
  "maxValue",
  "formatOptions",
  "showValueLabel",
  "valueLabel",
  "isExpanded",
  "allowsMultipleExpanded",
  "height",
  "heightMode",
  "_projectedRowsContentHeight",
  "_slots",
  "_showSelectionCheckbox",
] as const;

const CONTINUOUS_STYLE_KEYS = new Set([
  "backgroundColor",
  "borderColor",
  "borderRadius",
  "borderWidth",
  "boxShadow",
  "color",
  "fontFamily",
  "fontSize",
  "fontWeight",
  "gap",
  "height",
  "left",
  "letterSpacing",
  "lineHeight",
  "margin",
  "maxHeight",
  "maxWidth",
  "minHeight",
  "minWidth",
  "opacity",
  "padding",
  "position",
  "textShadow",
  "top",
  "transform",
  "width",
]);

const NON_LAYOUT_STYLE_SOURCE = [
  "color",
  "backgroundColor",
  "background",
  "backgroundImage",
  "backgroundSize",
  "backgroundPosition",
  "backgroundRepeat",
  "opacity",
  "visibility",
  "boxShadow",
  "textShadow",
  "filter",
  "backdropFilter",
  "borderColor",
  "borderTopColor",
  "borderRightColor",
  "borderBottomColor",
  "borderLeftColor",
  "borderStyle",
  "borderTopStyle",
  "borderRightStyle",
  "borderBottomStyle",
  "borderLeftStyle",
  "borderRadius",
  "borderTopLeftRadius",
  "borderTopRightRadius",
  "borderBottomLeftRadius",
  "borderBottomRightRadius",
  "outlineColor",
  "outlineStyle",
  "cursor",
  "pointerEvents",
  "userSelect",
  "transition",
  "transitionProperty",
  "transitionDuration",
  "animation",
  "animationName",
  "animationDuration",
  "textDecoration",
  "textDecorationColor",
  "textDecorationStyle",
  "zIndex",
  "objectFit",
  "objectPosition",
  "mixBlendMode",
  "clipPath",
  "mask",
  "maskImage",
  "transformOrigin",
] as const;

const INHERITED_LAYOUT_STYLE_SOURCE = [
  "fontSize",
  "fontFamily",
  "fontWeight",
  "fontStyle",
  "lineHeight",
  "letterSpacing",
  "wordSpacing",
  "whiteSpace",
  "wordBreak",
  "overflowWrap",
  "textAlign",
  "direction",
  "writingMode",
] as const;

const LAYOUT_STYLE_CACHE_SOURCE = [
  "display",
  "position",
  "width",
  "height",
  "minWidth",
  "minHeight",
  "maxWidth",
  "maxHeight",
  "margin",
  "marginTop",
  "marginRight",
  "marginBottom",
  "marginLeft",
  "padding",
  "paddingTop",
  "paddingRight",
  "paddingBottom",
  "paddingLeft",
  "border",
  "borderWidth",
  "borderTopWidth",
  "borderRightWidth",
  "borderBottomWidth",
  "borderLeftWidth",
  "boxSizing",
  "flex",
  "flexBasis",
  "flexGrow",
  "flexShrink",
  "flexDirection",
  "flexWrap",
  "justifyContent",
  "alignItems",
  "alignContent",
  "alignSelf",
  "justifySelf",
  "gap",
  "rowGap",
  "columnGap",
  "gridTemplateColumns",
  "gridTemplateRows",
  "gridAutoFlow",
  "justifyItems",
  "gridAutoColumns",
  "gridAutoRows",
  "gridColumn",
  "gridColumnStart",
  "gridRow",
  "gridRowStart",
  "gridColumnEnd",
  "gridRowEnd",
  "gridTemplateAreas",
  "overflow",
  "overflowX",
  "overflowY",
  "whiteSpace",
  "wordBreak",
  "fontFamily",
  "fontSize",
  "fontWeight",
  "fontStyle",
  "lineHeight",
  "letterSpacing",
  "textTransform",
  "aspectRatio",
  "objectFit",
  "top",
  "right",
  "bottom",
  "left",
  "transform",
] as const;

interface MutableEditorPropertyEffectRule {
  axis: EditorMutationEffectAxis;
  cacheSignature: EditorMutationCacheSignature;
  continuous: boolean;
  invalidation: EditorInvalidationKind;
  key: string;
  legacyViewOrder: {
    inheritedLayoutStyle?: number;
    layoutAffectingProp?: number;
    layoutPropCache?: number;
    layoutStyleCache?: number;
    nonLayoutStyle?: number;
  };
  propagation: EditorMutationEffectPropagation;
}

function toRegistryKey(axis: EditorMutationEffectAxis, key: string): string {
  return `${axis}:${key}`;
}

const mutableRegistry = new Map<string, MutableEditorPropertyEffectRule>();

function mergeRule(input: {
  axis: EditorMutationEffectAxis;
  cacheSignature?: Exclude<EditorMutationCacheSignature, null>;
  invalidation: EditorInvalidationKind;
  key: string;
  propagation?: EditorMutationEffectPropagation;
  viewOrder?: Partial<MutableEditorPropertyEffectRule["legacyViewOrder"]>;
}): void {
  const registryKey = toRegistryKey(input.axis, input.key);
  const current = mutableRegistry.get(registryKey);
  if (current) {
    if (input.cacheSignature) current.cacheSignature = input.cacheSignature;
    if (input.propagation === "inherited-subtree") {
      current.propagation = input.propagation;
    }
    Object.assign(current.legacyViewOrder, input.viewOrder);
    return;
  }

  mutableRegistry.set(registryKey, {
    axis: input.axis,
    cacheSignature: input.cacheSignature ?? null,
    continuous: false,
    invalidation: input.invalidation,
    key: input.key,
    legacyViewOrder: { ...input.viewOrder },
    propagation: input.propagation ?? "self",
  });
}

function registerOrderedView(
  keys: readonly string[],
  createInput: (key: string, order: number) => Parameters<typeof mergeRule>[0],
): void {
  keys.forEach((key, order) => mergeRule(createInput(key, order)));
}

mergeRule({
  axis: "descriptor",
  invalidation: "paint",
  key: "fills.replace",
});
mergeRule({
  axis: "descriptor",
  invalidation: "structure",
  key: "structure.patch",
});
for (const key of ["x", "y", "width", "height"]) {
  mergeRule({ axis: "geometry", invalidation: "layout", key });
}

registerOrderedView(LAYOUT_AFFECTING_PROP_SOURCE, (key, order) => ({
  axis: "prop",
  invalidation: "layout",
  key,
  viewOrder: { layoutAffectingProp: order },
}));
registerOrderedView(LAYOUT_PROP_CACHE_SOURCE, (key, order) => ({
  axis: "prop",
  cacheSignature: "prop",
  invalidation: "layout",
  key,
  viewOrder: { layoutPropCache: order },
}));
registerOrderedView(NON_LAYOUT_STYLE_SOURCE, (key, order) => ({
  axis: "style",
  invalidation: "paint",
  key,
  viewOrder: { nonLayoutStyle: order },
}));
registerOrderedView(INHERITED_LAYOUT_STYLE_SOURCE, (key, order) => ({
  axis: "style",
  invalidation: "layout",
  key,
  propagation: "inherited-subtree",
  viewOrder: { inheritedLayoutStyle: order },
}));
registerOrderedView(LAYOUT_STYLE_CACHE_SOURCE, (key, order) => ({
  axis: "style",
  cacheSignature: "style",
  invalidation: "layout",
  key,
  viewOrder: { layoutStyleCache: order },
}));

mutableRegistry.get(toRegistryKey("descriptor", "fills.replace"))!.continuous =
  true;
for (const key of ["x", "y", "width", "height"]) {
  mutableRegistry.get(toRegistryKey("geometry", key))!.continuous = true;
}
for (const key of CONTINUOUS_STYLE_KEYS) {
  const rule = mutableRegistry.get(toRegistryKey("style", key));
  if (!rule) {
    throw new Error(`Missing continuous style registry rule: ${key}`);
  }
  rule.continuous = true;
}

function freezeRule(
  rule: MutableEditorPropertyEffectRule,
): EditorPropertyEffectRule {
  return Object.freeze({
    ...rule,
    legacyViewOrder: Object.freeze({ ...rule.legacyViewOrder }),
  });
}

export const EDITOR_MUTATION_EFFECT_REGISTRY: readonly EditorPropertyEffectRule[] =
  Object.freeze([...mutableRegistry.values()].map(freezeRule));

const registryByKey: ReadonlyMap<string, EditorPropertyEffectRule> = new Map(
  EDITOR_MUTATION_EFFECT_REGISTRY.map((rule) => [
    toRegistryKey(rule.axis, rule.key),
    rule,
  ]),
);

export function getEditorMutationEffectRule(
  axis: EditorMutationEffectAxis,
  key: string,
): EditorPropertyEffectRule | undefined {
  return registryByKey.get(toRegistryKey(axis, key));
}

function deriveOrderedView(
  readOrder: (rule: EditorPropertyEffectRule) => number | undefined,
): readonly string[] {
  return Object.freeze(
    EDITOR_MUTATION_EFFECT_REGISTRY.map((rule) => ({
      key: rule.key,
      order: readOrder(rule),
    }))
      .filter(
        (entry): entry is { key: string; order: number } =>
          entry.order !== undefined,
      )
      .sort((left, right) => left.order - right.order)
      .map((entry) => entry.key),
  );
}

const layoutAffectingPropKeys = deriveOrderedView(
  (rule) => rule.legacyViewOrder.layoutAffectingProp,
);
const nonLayoutPropsUpdate = deriveOrderedView(
  (rule) => rule.legacyViewOrder.nonLayoutStyle,
);
const inheritedLayoutPropsUpdate = deriveOrderedView(
  (rule) => rule.legacyViewOrder.inheritedLayoutStyle,
);

export const LAYOUT_AFFECTING_PROP_KEYS: ReadonlySet<string> = new Set(
  layoutAffectingPropKeys,
);
export const NON_LAYOUT_PROPS_UPDATE: ReadonlySet<string> = new Set(
  nonLayoutPropsUpdate,
);
export const INHERITED_LAYOUT_PROPS_UPDATE: ReadonlySet<string> = new Set(
  inheritedLayoutPropsUpdate,
);
export const LAYOUT_STYLE_KEYS = deriveOrderedView(
  (rule) => rule.legacyViewOrder.layoutStyleCache,
);
export const LAYOUT_PROP_KEYS = deriveOrderedView(
  (rule) => rule.legacyViewOrder.layoutPropCache,
);
