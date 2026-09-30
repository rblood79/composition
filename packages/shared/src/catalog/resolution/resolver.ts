import type {
  AuthoredValue,
  BreakpointName,
  CatalogFillLayer,
  CatalogLibrary,
  DataBindingRef,
  FillSizing,
  LayoutWrites,
  NodeResponsiveLayer,
  NodeThemeOverride,
  DefinitionId,
  DisplayStateName,
  InstanceAddress,
  LibraryDescendantPatch,
  NodeEntry,
  NodeId,
  NodePlacement,
  PropValue,
  PropWrites,
  Scalar,
  StateName,
  TemplateId,
  VisualWrites,
  WriteValue,
} from "../document/types";
import { CatalogGraph } from "../document/graph";
import { isInOwnCollection } from "../document/collectionItems";
import { CatalogValidationError } from "../document/validation";
import { catalogTokenValue } from "../document/themedToken";
import {
  compileFieldTemplate,
  interpolateFieldTemplate,
} from "../../collections/fieldTemplate";
import { ROW_TEMPLATE_BINDABLE_PROP_KEYS } from "../../collections/rowTemplateBindableProps";

export interface ResolvedCatalogNode {
  sourceId: NodeId | TemplateId;
  instancePath: readonly (NodeId | TemplateId)[];
  definitionId: DefinitionId;
  props: Readonly<Record<string, PropValue>>;
  visual: Readonly<Record<string, Scalar>>;
  /** Typed box layout declarations (definition layout, then matching conditional/part rules). */
  layout: Readonly<Record<string, string>>;
  /**
   * The layout keys an author wrote (node/template layout, library template origin style, an
   * instance position, responsive layers) — not the definition or rule layout, which a DOM
   * consumer already gets from the component stylesheet. Absent when nothing was authored.
   */
  authoredLayout?: Readonly<Record<string, string>>;
  sizing: Readonly<Record<string, number | null>>;
  placement?: NodePlacement;
  /** Authored paint layers (Phase 4a); absent = the definition's fill. */
  fills?: readonly CatalogFillLayer[];
  /** ADR-224 fill intent after the breakpoint cascade. */
  fillSizing?: FillSizing;
  themeOverride?: NodeThemeOverride;
  /** The author's DOM `id` (`metadata.htmlId`). */
  htmlId?: string;
  slot?: { name: string; required: boolean };
  name?: string;
  regions?: readonly { name: string; required: boolean }[];
  placeholder?: boolean;
  /** State-origin display state (outer instance layer wins over its template's). */
  displayState?: DisplayStateName;
  /**
   * A data row's key on every node the row projects (not the first row, which keeps the row
   * template position's identity): the record identity's row segment.
   */
  rowKey?: string;
  children: readonly ResolvedCatalogNode[];
}
/** A data row a bound collection shows (the rows stay in the data store — H1). */
export interface CatalogBoundRow {
  /** Stable row key: the item's collection key and the record identity's row segment. */
  key: string;
  /** What the row template's `{field}` placeholders read (row fields + label/description/icon/value). */
  values: Readonly<Record<string, unknown>>;
}
/** The rows of a binding; `undefined` = unknown (not loaded) — the template items stay. */
export type CatalogRowSource = (
  binding: DataBindingRef,
) => readonly CatalogBoundRow[] | undefined;
/** Item types a bound collection repeats per data row (its first item position is the row template). */
const ROW_ITEM_TYPES: ReadonlySet<string> = new Set([
  "ListBoxItem",
  "GridListItem",
]);
/** A row value: `{field}` templates read the row (a `{{ state }}` template is not a row field). */
function bindRowValue(value: PropValue, row: CatalogBoundRow): PropValue {
  if (typeof value !== "string" || !value.includes("{") || value.includes("{{"))
    return value;
  const compiled = compileFieldTemplate(value);
  return compiled
    ? interpolateFieldTemplate(compiled, row.values as Record<string, unknown>)
    : value;
}
/** Stamp a row's key on a projected row subtree. */
function withRowKey(
  node: ResolvedCatalogNode,
  key: string,
): ResolvedCatalogNode {
  return {
    ...node,
    rowKey: key,
    children: node.children.map((child) => withRowKey(child, key)),
  };
}
export interface CatalogResolutionSelection {
  include(
    sourceId: NodeId | TemplateId,
    instancePath: readonly (NodeId | TemplateId)[],
  ): boolean;
  onVisit?: (sourceId: NodeId | TemplateId) => void;
  /**
   * Owned `children` of an included node that may pass `include` (a subset of `node.children`).
   * `undefined` tests every owned child. Only the owned-children loop reads it; template
   * children, fill-slot children and replacements keep their `include` checks.
   */
  ownedChildren?: (
    sourceId: NodeId,
    instancePath: readonly (NodeId | TemplateId)[],
  ) => readonly NodeId[] | undefined;
}
type Values = Record<string, Scalar>;
/** Resolved props: scalars and structured values (string lists, item lists). */
type Props = Record<string, PropValue>;
/** The resolving node's parent (and its parent: `via` part rules reach through one wrapper). */
type ParentContext = {
  definitionId: DefinitionId;
  props: Props;
  /** The parent's resolution state (its display state, else the context's): its part rules'. */
  state?: StateName;
  parent?: ParentContext;
  /**
   * A composite instance projecting its template root: the root is the instance's own element
   * (the consumer tree collapses the two), so part rules read past it to the structural parent.
   */
  collapsed?: boolean;
};
/** The nearest context that is an element of its own (collapsed composite instances skipped). */
const structuralParent = (
  context: ParentContext | undefined,
): ParentContext | undefined => {
  let current = context;
  while (current?.collapsed) current = current.parent;
  return current;
};
type InstanceRoot = {
  props: Props;
  visual: Values;
  sizing: Record<string, number | null>;
  /** Authored layout of the instance position (template node / patch), over the root's rules. */
  layout: Record<string, string>;
  /** The instance position's display state: it replaces the template root's own. */
  displayState?: DisplayStateName;
};
/**
 * Accepted boolean props a display state sets, the way the old Canvas and Preview read a state
 * origin (`readForcedVariantStates`: RAC `isSelected` / `isDisabled` / `isExpanded`).
 */
export const DISPLAY_STATE_PROPS: Readonly<
  Partial<Record<DisplayStateName, Readonly<Record<string, boolean>>>>
> = {
  selected: { isSelected: true },
  unselected: { isSelected: false },
  disabled: { isDisabled: true },
  collapsed: { isExpanded: false },
};
/** The state rules a display state resolves (`ResolutionContext.state` of that node). */
const DISPLAY_PAINT_STATE: Readonly<
  Partial<Record<DisplayStateName, StateName>>
> = {
  selected: "selected",
  disabled: "disabled",
  hover: "hover",
  pressed: "pressed",
  focusVisible: "focusVisible",
};
/** Descendant patches a library composite template node applies to that composite's template. */
type LibraryPatchScope = {
  instances: readonly (NodeId | TemplateId)[];
  patches: readonly LibraryDescendantPatch[];
};
const sameIds = (left: readonly string[], right: readonly string[]): boolean =>
  left.length === right.length &&
  left.every((id, index) => id === right[index]);
const TEMPLATE_BINDING = /\{([a-zA-Z][a-zA-Z0-9_-]*)\}/g;
const WHOLE_TEMPLATE_BINDING = /^\{([a-zA-Z][a-zA-Z0-9_-]*)\}$/;
/**
 * `{key}` template binding in a composite template prop (ADR-148 `templateBinding.ts` contract):
 * a whole-value reference keeps the bound value's type, an embedded one is replaced by its string.
 * A key without a bound value keeps its placeholder (row-data bindings fill it later).
 */
function bindTemplateValue(value: PropValue, bindings: Props): PropValue {
  if (typeof value !== "string" || !value.includes("{")) return value;
  const whole = WHOLE_TEMPLATE_BINDING.exec(value);
  if (whole)
    return Object.hasOwn(bindings, whole[1]) ? bindings[whole[1]] : value;
  return value.replace(TEMPLATE_BINDING, (placeholder, key: string) =>
    Object.hasOwn(bindings, key) ? String(bindings[key]) : placeholder,
  );
}
const same = (left: InstanceAddress, right: InstanceAddress): boolean =>
  left.instances.length === right.instances.length &&
  left.templatePath.length === right.templatePath.length &&
  left.instances.every((id, index) => id === right.instances[index]) &&
  left.templatePath.every((id, index) => id === right.templatePath[index]);

/** Desktop-first cascade: the layers below desktop that apply at a breakpoint, in order. */
const CASCADE: Readonly<
  Record<BreakpointName, readonly ("tablet" | "mobile")[]>
> = {
  desktop: [],
  tablet: ["tablet"],
  mobile: ["tablet", "mobile"],
};
const VISIBILITY_FALLBACK: Readonly<
  Record<BreakpointName, readonly BreakpointName[]>
> = {
  desktop: ["desktop"],
  tablet: ["tablet", "desktop"],
  mobile: ["mobile", "tablet", "desktop"],
};
/** A node's display at a breakpoint: its own value, else the next larger breakpoint's. */
export function catalogNodeVisibleAt(
  node: Pick<NodeEntry, "visibility">,
  breakpoint: BreakpointName,
): boolean {
  for (const name of VISIBILITY_FALLBACK[breakpoint]) {
    const shown = node.visibility?.[name];
    if (shown !== undefined) return shown;
  }
  return true;
}
function applyLayoutWrites(
  target: Record<string, string>,
  writes: LayoutWrites | undefined,
): void {
  for (const [key, write] of Object.entries(writes ?? {})) {
    if (!write || write.kind === "remove") continue;
    if (write.kind === "mask") delete target[key];
    else target[key] = write.value;
  }
}
function cascadeFillSizing(
  node: NodeEntry,
  layers: readonly NodeResponsiveLayer[],
): FillSizing | undefined {
  let result: Record<string, { factor: number } | null> | undefined =
    node.fillSizing ? { ...node.fillSizing } : undefined;
  for (const layer of layers)
    if (layer.fillSizing) result = { ...result, ...layer.fillSizing };
  return result;
}

/** Project entry lookup and immutable code library are kept in separate ID spaces. */
export function resolveCatalogNode(
  graph: CatalogGraph,
  id: NodeId,
  state?: StateName,
  selection?: CatalogResolutionSelection,
  breakpoint: BreakpointName = "desktop",
  /** Color mode library tokens read their theme token in (`catalogTokenValue`); absent = build-time values. */
  tokenMode?: "light" | "dark",
  /** Data rows of bound collections (ADR-248 4e-4e); absent = bound collections show their template items. */
  rows?: CatalogRowSource,
): ResolvedCatalogNode {
  const library: CatalogLibrary = graph.library;
  const responsiveLayers = (node: NodeEntry): NodeResponsiveLayer[] =>
    CASCADE[breakpoint]
      .map((name) => node.responsive?.[name])
      .filter((layer): layer is NodeResponsiveLayer => !!layer);
  /** Authored node output fields that only exist when the node declares them. */
  const authoredExtras = (
    node: NodeEntry,
    layers: readonly NodeResponsiveLayer[],
  ) => {
    const fillSizing = cascadeFillSizing(node, layers);
    return {
      ...(node.fills ? { fills: node.fills } : {}),
      ...(fillSizing ? { fillSizing } : {}),
      ...(node.themeOverride ? { themeOverride: node.themeOverride } : {}),
      ...(node.metadata?.htmlId ? { htmlId: node.metadata.htmlId } : {}),
    };
  };
  const source = graph.getEntry(id);
  if (source?.kind !== "node")
    throw new CatalogValidationError("NODE_REQUIRED", id);
  const lookupDefinition = (definitionId: DefinitionId) => {
    const definition = graph.getDefinition(definitionId);
    if (!definition)
      throw new CatalogValidationError("DANGLING_DEFINITION", definitionId);
    return definition;
  };
  /** The type a template position shows (its definition, through composite template roots). */
  const templateTypeName = (templateId: TemplateId): string => {
    const template = templateId.startsWith("lib:")
      ? library.templates.get(templateId as `lib:template:${string}`)
      : graph.getEntry(templateId);
    if (!template || ("kind" in template && template.kind !== "node"))
      return "";
    let definition = graph.getDefinition(template.definitionId);
    for (let depth = 0; definition?.mode === "composite" && depth < 16; depth++) {
      const rootId = definition.templateRootId;
      const root = rootId?.startsWith("lib:")
        ? library.templates.get(rootId as `lib:template:${string}`)
        : rootId
          ? graph.getEntry(rootId)
          : undefined;
      if (!root || ("kind" in root && root.kind !== "node")) break;
      definition = graph.getDefinition(root.definitionId);
    }
    return definition?.name ?? "";
  };
  const tokenValue = (value: AuthoredValue): PropValue => {
    if (typeof value !== "object" || !("kind" in value)) return value;
    const token = graph.getToken(value.tokenId);
    if (!token)
      throw new CatalogValidationError("DANGLING_TOKEN", value.tokenId);
    return catalogTokenValue(token, tokenMode);
  };
  const applyValues = (
    target: Props,
    values: Readonly<Record<string, AuthoredValue>>,
  ): void => {
    for (const [key, value] of Object.entries(values))
      target[key] = tokenValue(value);
  };
  const applyWrites = (
    target: Record<string, PropValue | null>,
    writes: Readonly<Record<string, WriteValue<AuthoredValue | number | null>>>,
  ): void => {
    for (const [key, write] of Object.entries(writes)) {
      if (write.kind === "mask") delete target[key];
      else if (write.kind === "set")
        target[key] = write.value === null ? null : tokenValue(write.value);
      // remove resets this local layer; the inherited value remains visible.
    }
  };
  /** Structural ancestor type names, nearest first (collapsed composite layers skipped). */
  function* ancestorTypes(
    context: ParentContext | undefined,
  ): Generator<string> {
    for (
      let cursor = structuralParent(context);
      cursor;
      cursor = structuralParent(cursor.parent)
    )
      yield lookupDefinition(cursor.definitionId).name;
  }
  const base = (definitionId: DefinitionId) => {
    const definition = lookupDefinition(definitionId);
    const props: Props = {};
    const visual: Values = {};
    const layout: Record<string, string> = {
      ...("layout" in definition ? definition.layout : undefined),
    };
    applyValues(props, definition.defaults);
    applyValues(visual, definition.visual);
    return { definition, props, visual, layout };
  };
  const matches = (
    condition: Readonly<Record<string, Scalar>> | undefined,
    values: Props,
  ): boolean =>
    !condition ||
    Object.entries(condition).every(([key, value]) => values[key] === value);
  /** Conditional rules of the node's own definition, then part rules of its parent definition. */
  const applyTypedRules = (
    definitionId: DefinitionId,
    props: Props,
    visual: Values,
    layout: Record<string, string>,
    parent: ParentContext | undefined,
    nodeState: StateName | undefined = state,
  ): void => {
    const definition = lookupDefinition(definitionId);
    if ("conditionalRules" in definition)
      for (const rule of definition.conditionalRules ?? [])
        if (
          matches(rule.when, props) &&
          (rule.state === undefined || rule.state === nodeState)
        ) {
          if (rule.visual) applyValues(visual, rule.visual);
          if (rule.layout) Object.assign(layout, rule.layout);
        }
    const owner = structuralParent(parent);
    if (!owner) return;
    const grand = structuralParent(owner.parent);
    // The parent's own rules, then the grandparent's `via` rules (through this node's parent): a
    // selector reaching through the wrapper from its owner is the more specific one in the sheet.
    const owners: Array<{ owner: ParentContext; via?: DefinitionId }> = [
      { owner },
      ...(grand ? [{ owner: grand, via: owner.definitionId }] : []),
    ];
    for (const { owner: ruleOwner, via } of owners) {
      const ownerDefinition = lookupDefinition(ruleOwner.definitionId);
      if (!("partRules" in ownerDefinition)) continue;
      for (const rule of ownerDefinition.partRules ?? [])
        if (
          rule.child.definitionId === definitionId &&
          rule.child.via === via &&
          matches(rule.child.props, props) &&
          (!via || matches(rule.child.viaProps, owner.props)) &&
          matches(rule.when, ruleOwner.props) &&
          (rule.state === undefined ||
            rule.state === (ruleOwner.state ?? state))
        ) {
          if (rule.visual) applyValues(visual, rule.visual);
          if (rule.layout) Object.assign(layout, rule.layout);
        }
    }
  };
  const findOverride = (definitionId: DefinitionId) => {
    if (!definitionId.startsWith("lib:")) return undefined;
    return graph.getDefinitionOverride(definitionId);
  };
  /** Resolved values of the keys a composite instance authored (not its definition defaults). */
  const instanceRoot = (
    propKeys: readonly string[],
    props: Props,
    visualKeys: readonly string[],
    visual: Values,
    sizing: Readonly<Record<string, number | null>>,
    layout: Readonly<Record<string, string>> = {},
  ): InstanceRoot => {
    const root: InstanceRoot = {
      props: {},
      visual: {},
      sizing: { ...sizing },
      layout: { ...layout },
    };
    for (const key of propKeys) if (key in props) root.props[key] = props[key];
    for (const key of visualKeys)
      if (key in visual) root.visual[key] = visual[key];
    return root;
  };
  /**
   * Bindings a composite offers its own template: its accepted keys (the declared edit schema),
   * valued from the resolved props, then the declared default. Nested composites bind their own
   * template; an outer binding never reaches an inner composite's placeholders.
   */
  const templateBindings = (
    definitionId: DefinitionId,
    props: Props,
  ): Props | undefined => {
    const definition = lookupDefinition(definitionId);
    if (definition.mode !== "composite") return undefined;
    const bindings: Props = {};
    for (const key of Object.keys(definition.accepts)) {
      const value =
        props[key] ??
        (definition.defaults[key] === undefined
          ? undefined
          : tokenValue(definition.defaults[key]));
      if (value !== undefined) bindings[key] = value;
    }
    return bindings;
  };
  const applyPropVisualRules = (
    definitionId: DefinitionId,
    props: Props,
    visual: Values,
  ): void => {
    const definition = lookupDefinition(definitionId);
    if (!("propVisualRules" in definition) || !definition.propVisualRules)
      return;
    for (const [prop, choices] of Object.entries(definition.propVisualRules)) {
      const choice = props[prop];
      if (typeof choice !== "string") continue;
      const selected = choices[choice];
      if (selected) applyValues(visual, selected);
    }
  };
  const stateVisual = (
    definitionId: DefinitionId,
    nodeState: StateName | undefined = state,
  ): VisualWrites[] => {
    if (!nodeState) return [];
    const definition = lookupDefinition(definitionId);
    const rule = definition.stateRules[nodeState];
    const override = findOverride(definitionId)?.stateRules[nodeState];
    return [rule, override].filter((item): item is VisualWrites => !!item);
  };
  const resolveOwned = (
    node: NodeEntry,
    instancePath: readonly (NodeId | TemplateId)[],
    inherited?: {
      props: Props;
      visual: Values;
      slot?: { name: string; required: boolean };
    },
    parent?: ParentContext,
  ): ResolvedCatalogNode | undefined => {
    selection?.onVisit?.(node.id);
    if (node.enabled === false) return undefined;
    if (!catalogNodeVisibleAt(node, breakpoint)) return undefined;
    const layers = responsiveLayers(node);
    const { definition, props, visual, layout } = base(node.definitionId);
    const override = findOverride(node.definitionId);
    if (override) {
      applyWrites(props, override.defaults as PropWrites);
      applyWrites(visual, override.visual);
    }
    if (inherited) {
      Object.assign(props, inherited.props);
      Object.assign(visual, inherited.visual);
    }
    applyWrites(props, node.props);
    applyPropVisualRules(node.definitionId, props, visual);
    applyTypedRules(node.definitionId, props, visual, layout, parent);
    applyWrites(visual, node.visual);
    applyLayoutWrites(layout, node.layout);
    const ownLayout: Record<string, string> = {};
    applyLayoutWrites(ownLayout, node.layout);
    for (const layer of layers) {
      if (layer.visual) applyWrites(visual, layer.visual);
      applyLayoutWrites(layout, layer.layout);
      applyLayoutWrites(ownLayout, layer.layout);
    }
    const self: ParentContext = {
      definitionId: node.definitionId,
      props,
      parent,
    };
    const sizing: Record<string, number | null> = {};
    applyWrites(sizing, node.sizing);
    for (const layer of layers)
      if (layer.sizing) applyWrites(sizing, layer.sizing);
    const children: ResolvedCatalogNode[] = [];
    if (
      definition.mode === "composite" &&
      definition.templateRootId &&
      (!selection || selection.include(definition.templateRootId, instancePath))
    )
      push(
        children,
        projectTemplate(
          node,
          definition.templateRootId,
          instancePath,
          [definition.templateRootId],
          { ...self, collapsed: true },
          templateBindings(node.definitionId, props),
          instanceRoot(
            Object.keys(node.props),
            props,
            [
              ...Object.keys(node.visual),
              ...layers.flatMap((layer) => Object.keys(layer.visual ?? {})),
            ],
            visual,
            sizing,
          ),
          undefined,
          node.binding && rows
            ? { rowSet: rows(node.binding) }
            : undefined,
        ),
      );
    for (const childId of selection?.ownedChildren?.(node.id, instancePath) ??
      node.children) {
      const childPath = [...instancePath, childId];
      if (selection && !selection.include(childId, childPath)) continue;
      const child = graph.getEntry(childId);
      if (child?.kind !== "node")
        throw new CatalogValidationError("DANGLING_CHILD", childId);
      push(children, resolveOwned(child, childPath, undefined, self));
    }
    for (const rule of stateVisual(node.definitionId))
      applyWrites(visual, rule);
    if (state && node.stateRules?.[state])
      applyWrites(visual, node.stateRules[state]);
    return {
      sourceId: node.id,
      instancePath,
      definitionId: node.definitionId,
      props,
      visual,
      layout,
      sizing,
      placement: node.placement,
      ...(Object.keys(ownLayout).length ? { authoredLayout: ownLayout } : {}),
      ...authoredExtras(node, layers),
      slot: node.slot ?? inherited?.slot,
      name: node.name,
      regions: node.regions,
      placeholder: node.placeholder,
      children,
    };
  };
  const projectTemplate = (
    owner: NodeEntry,
    templateId: TemplateId,
    instancePath: readonly (NodeId | TemplateId)[],
    path: readonly TemplateId[],
    parent?: ParentContext,
    bindings?: Props,
    /**
     * Instance root values: the owning composite instance's authored props, visual and sizing,
     * applied on its template root after the template's own values and before path overrides.
     */
    root?: InstanceRoot,
    /** Descendant patches of the library composite template node whose template this is. */
    patches?: LibraryPatchScope,
    /**
     * Data rows: `rowSet` = the bound instance's rows (its template root repeats its first item
     * position per row and drops the other item positions); `row` = the row this subtree projects,
     * `rowStart` on the row template position itself (its sample content is not the row's).
     */
    rowing?: {
      rowSet?: readonly CatalogBoundRow[];
      row?: CatalogBoundRow;
      rowStart?: boolean;
    },
  ): ResolvedCatalogNode | undefined => {
    const row = rowing?.row;
    selection?.onVisit?.(templateId);
    const template = templateId.startsWith("lib:")
      ? library.templates.get(templateId as `lib:template:${string}`)
      : graph.getEntry(templateId);
    if (!template || ("kind" in template && template.kind !== "node"))
      throw new CatalogValidationError("DANGLING_TEMPLATE", templateId);
    // An override address starts at its owner instance (`validateInstanceAddress`); the
    // resolution path also carries the ancestors above the owner when resolving from one of them.
    const address = {
      instances: instancePath.slice(instancePath.lastIndexOf(owner.id)),
      templatePath: path,
    };
    const change = owner.descendantOverrides.find((item) =>
      same(item.address, address),
    );
    if (change?.kind === "replace") {
      const replacement = graph.getEntry(change.replacementId);
      if (replacement?.kind !== "node")
        throw new CatalogValidationError(
          "DANGLING_CHILD",
          change.replacementId,
        );
      return resolveOwned(
        replacement,
        [...instancePath, replacement.id],
        undefined,
        parent,
      );
    }
    const libraryPatch =
      patches && sameIds(patches.instances, instancePath)
        ? patches.patches.find((item) => sameIds(item.templatePath, path))
        : undefined;
    const enabled =
      (change?.kind === "patch" ? change.enabled : undefined) ??
      libraryPatch?.enabled ??
      template.enabled ??
      true;
    if (!enabled) return undefined;
    // A path patch's authoring fields (Phase 4b) layer over the template node's own.
    const patch = change?.kind === "patch" ? change : undefined;
    const visibleBy = patch?.visibility
      ? patch
      : "kind" in template
        ? template
        : undefined;
    if (visibleBy && !catalogNodeVisibleAt(visibleBy, breakpoint))
      return undefined;
    const templateLayers = "kind" in template ? responsiveLayers(template) : [];
    const patchLayers = patch
      ? responsiveLayers(patch as unknown as NodeEntry)
      : [];
    const { definition, props, visual, layout } = base(template.definitionId);
    const override = findOverride(template.definitionId);
    if (override) {
      applyWrites(props, override.defaults);
      applyWrites(visual, override.visual);
    }
    if ("kind" in template) applyWrites(props, template.props);
    else applyValues(props, template.props);
    if (libraryPatch?.props) applyValues(props, libraryPatch.props);
    if (bindings)
      for (const key of Object.keys(template.props))
        if (key in props) props[key] = bindTemplateValue(props[key], bindings);
    if (root)
      for (const [key, value] of Object.entries(root.props))
        if (key in definition.accepts) props[key] = value;
    const sizing: Record<string, number | null> = { ...root?.sizing };
    if ("kind" in template) {
      applyWrites(sizing, template.sizing);
      for (const layer of templateLayers)
        if (layer.sizing) applyWrites(sizing, layer.sizing);
    }
    if (change?.kind === "patch") {
      if (change.props) applyWrites(props, change.props);
      if (change.sizing) applyWrites(sizing, change.sizing);
      for (const layer of patchLayers)
        if (layer.sizing) applyWrites(sizing, layer.sizing);
    }
    if (row) {
      // Only content props read the row (ADR-162 allowlist): a user's `{…}` text elsewhere stays.
      for (const key of ROW_TEMPLATE_BINDABLE_PROP_KEYS)
        if (key in props) props[key] = bindRowValue(props[key], row);
      // The row is the item: its collection key is the row's.
      if (rowing?.rowStart) props.id = row.key;
    }
    const shownState =
      root?.displayState ??
      (!("kind" in template) ? template.displayState : undefined);
    // Inside its RAC collection an item's selection is the collection's (its keys), so a
    // selection display state of the item template (a selected state origin) is not forced there.
    const displayState =
      (shownState === "selected" || shownState === "unselected") &&
      isInOwnCollection(
        lookupDefinition(template.definitionId).name,
        ancestorTypes(parent),
      )
        ? undefined
        : shownState;
    // A display state replaces the template's own default; a value the instance authored for
    // this position (its root layer or path patch) is more specific and stays.
    const instanceAuthored = new Set([
      ...Object.keys(root?.props ?? {}),
      ...(change?.kind === "patch" ? Object.keys(change.props ?? {}) : []),
    ]);
    if (displayState)
      for (const [key, value] of Object.entries(
        DISPLAY_STATE_PROPS[displayState] ?? {},
      ))
        if (definition.accepts[key] === "boolean" && !instanceAuthored.has(key))
          props[key] = value;
    const nodeState = catalogNodeState(displayState, state);
    applyPropVisualRules(template.definitionId, props, visual);
    applyTypedRules(
      template.definitionId,
      props,
      visual,
      layout,
      parent,
      nodeState,
    );
    // Authored template layout (origin style) is the node's own declaration, like inline style
    // over the rule and parent delegation; an instance position's layout reaches its root.
    const authoredLayout: Record<string, string> = {
      ...(!("kind" in template) ? template.layout : undefined),
      ...libraryPatch?.layout,
    };
    if ("kind" in template) {
      applyLayoutWrites(authoredLayout, template.layout);
      for (const layer of templateLayers)
        applyLayoutWrites(authoredLayout, layer.layout);
    }
    Object.assign(layout, authoredLayout);
    if (root) Object.assign(layout, root.layout);
    const templateAuthored: Record<string, string> = {
      ...authoredLayout,
      ...root?.layout,
    };
    if (patch) {
      for (const target of [layout, templateAuthored]) {
        applyLayoutWrites(target, patch.layout);
        for (const layer of patchLayers)
          applyLayoutWrites(target, layer.layout);
      }
    }
    // Authored template visual is the node's own value: it wins over definition rules, the same
    // order as an authored node's visual writes in resolveOwned.
    if ("kind" in template) {
      applyWrites(visual, template.visual);
      for (const layer of templateLayers)
        if (layer.visual) applyWrites(visual, layer.visual);
    } else applyValues(visual, template.visual);
    if (libraryPatch?.visual) applyValues(visual, libraryPatch.visual);
    if (root) Object.assign(visual, root.visual);
    const self: ParentContext = {
      definitionId: template.definitionId,
      props,
      parent,
      ...(nodeState ? { state: nodeState } : {}),
    };
    if (change?.kind === "patch" && change.visual)
      applyWrites(visual, change.visual);
    for (const layer of patchLayers)
      if (layer.visual) applyWrites(visual, layer.visual);
    const children: ResolvedCatalogNode[] = [];
    if (definition.mode === "composite" && definition.templateRootId) {
      const nestedPath = [...instancePath, templateId];
      if (
        !selection ||
        selection.include(definition.templateRootId, nestedPath)
      )
        push(
          children,
          projectTemplate(
            owner,
            definition.templateRootId,
            nestedPath,
            [definition.templateRootId],
            { ...self, collapsed: true },
            templateBindings(template.definitionId, props),
            withDisplayState(
              displayState,
              instanceRoot(
                [
                  ...Object.keys(template.props),
                  ...(change?.kind === "patch"
                    ? Object.keys(change.props ?? {})
                    : []),
                  ...(rowing?.rowStart ? ["id"] : []),
                ],
                props,
                [
                  ...Object.keys(template.visual),
                  ...(change?.kind === "patch"
                    ? Object.keys(change.visual ?? {})
                    : []),
                ],
                visual,
                sizing,
                authoredLayout,
              ),
            ),
            "descendantPatches" in template &&
              template.descendantPatches &&
              !rowing?.rowStart
              ? { instances: nestedPath, patches: template.descendantPatches }
              : undefined,
            row ? { row } : undefined,
          ),
        );
    }
    const rowSet = rowing?.rowSet;
    const itemPositions = rowSet
      ? template.children.filter((childId) =>
          ROW_ITEM_TYPES.has(templateTypeName(childId)),
        )
      : [];
    for (const childId of template.children) {
      if (selection && !selection.include(childId, instancePath)) continue;
      const childPath = [...path, childId];
      if (rowSet && itemPositions.includes(childId)) {
        // The first item position is the row template; the rest are sample items.
        if (childId !== itemPositions[0]) continue;
        rowSet.forEach((data, index) => {
          const projected = projectTemplate(
            owner,
            childId,
            instancePath,
            childPath,
            self,
            bindings,
            undefined,
            patches,
            { row: data, rowStart: true },
          );
          if (projected)
            push(
              children,
              index === 0 ? projected : withRowKey(projected, data.key),
            );
        });
        continue;
      }
      push(
        children,
        projectTemplate(
          owner,
          childId,
          instancePath,
          childPath,
          self,
          bindings,
          undefined,
          patches,
          row ? { row } : undefined,
        ),
      );
    }
    if (change?.kind === "fillSlot") {
      children.length = 0;
      for (const childId of change.childIds) {
        const childPath = [...instancePath, childId];
        if (selection && !selection.include(childId, childPath)) continue;
        const child = graph.getEntry(childId);
        if (child?.kind !== "node")
          throw new CatalogValidationError("DANGLING_CHILD", childId);
        push(children, resolveOwned(child, childPath, undefined, self));
      }
    }
    for (const rule of stateVisual(template.definitionId, nodeState))
      applyWrites(visual, rule);
    if (nodeState && template.stateRules?.[nodeState])
      applyWrites(visual, template.stateRules[nodeState]);
    if (nodeState && change?.kind === "patch" && change.stateRules?.[nodeState])
      applyWrites(visual, change.stateRules[nodeState]);
    return {
      sourceId: templateId,
      instancePath,
      definitionId: template.definitionId,
      props,
      visual,
      layout,
      sizing,
      placement: "kind" in template ? template.placement : undefined,
      ...(Object.keys(templateAuthored).length
        ? { authoredLayout: templateAuthored }
        : {}),
      ...("kind" in template ? authoredExtras(template, templateLayers) : {}),
      ...(patch?.fills ? { fills: patch.fills } : {}),
      ...(patch?.fillSizing
        ? {
            fillSizing: cascadeFillSizing(
              { fillSizing: patch.fillSizing } as NodeEntry,
              patchLayers,
            ),
          }
        : {}),
      slot: template.slot,
      ...(displayState ? { displayState } : {}),
      children,
    };
  };
  const resolved = resolveOwned(source, [source.id]);
  if (!resolved) throw new CatalogValidationError("NODE_DISABLED", id);
  return resolved;
}

/** A node's resolution state: its display state's state rules, else the context state. */
export function catalogNodeState(
  displayState: DisplayStateName | undefined,
  state?: StateName,
): StateName | undefined {
  return (displayState && DISPLAY_PAINT_STATE[displayState]) ?? state;
}

function withDisplayState(
  displayState: DisplayStateName | undefined,
  root: InstanceRoot,
): InstanceRoot {
  return displayState ? { ...root, displayState } : root;
}

function push(
  children: ResolvedCatalogNode[],
  child: ResolvedCatalogNode | undefined,
): void {
  if (child) children.push(child);
}
