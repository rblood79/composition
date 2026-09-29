import type {
  AuthoredValue,
  CatalogLibrary,
  DefinitionId,
  DisplayStateName,
  InstanceAddress,
  LibraryDescendantPatch,
  NodeEntry,
  NodeId,
  NodePlacement,
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

export interface ResolvedCatalogNode {
  sourceId: NodeId | TemplateId;
  instancePath: readonly (NodeId | TemplateId)[];
  definitionId: DefinitionId;
  props: Readonly<Record<string, Scalar>>;
  visual: Readonly<Record<string, Scalar>>;
  /** Typed box layout declarations (definition layout, then matching conditional/part rules). */
  layout: Readonly<Record<string, string>>;
  sizing: Readonly<Record<string, number | null>>;
  placement?: NodePlacement;
  slot?: { name: string; required: boolean };
  name?: string;
  regions?: readonly { name: string; required: boolean }[];
  placeholder?: boolean;
  /** State-origin display state (outer instance layer wins over its template's). */
  displayState?: DisplayStateName;
  children: readonly ResolvedCatalogNode[];
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
/** The resolving node's parent (and its parent: `via` part rules reach through one wrapper). */
type ParentContext = {
  definitionId: DefinitionId;
  props: Values;
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
  props: Values;
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
const DISPLAY_STATE_PROPS: Readonly<
  Partial<Record<DisplayStateName, Readonly<Record<string, boolean>>>>
> = {
  selected: { isSelected: true },
  unselected: { isSelected: false },
  disabled: { isDisabled: true },
  collapsed: { isExpanded: false },
};
/** The state rules a display state resolves (`ResolutionContext.state` of that node). */
const DISPLAY_PAINT_STATE: Readonly<Partial<Record<DisplayStateName, StateName>>> = {
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
const sameIds = (
  left: readonly string[],
  right: readonly string[],
): boolean =>
  left.length === right.length && left.every((id, index) => id === right[index]);
const TEMPLATE_BINDING = /\{([a-zA-Z][a-zA-Z0-9_-]*)\}/g;
const WHOLE_TEMPLATE_BINDING = /^\{([a-zA-Z][a-zA-Z0-9_-]*)\}$/;
/**
 * `{key}` template binding in a composite template prop (ADR-148 `templateBinding.ts` contract):
 * a whole-value reference keeps the bound value's type, an embedded one is replaced by its string.
 * A key without a bound value keeps its placeholder (row-data bindings fill it later).
 */
function bindTemplateValue(value: Scalar, bindings: Values): Scalar {
  if (typeof value !== "string" || !value.includes("{")) return value;
  const whole = WHOLE_TEMPLATE_BINDING.exec(value);
  if (whole) return Object.hasOwn(bindings, whole[1]) ? bindings[whole[1]] : value;
  return value.replace(TEMPLATE_BINDING, (placeholder, key: string) =>
    Object.hasOwn(bindings, key) ? String(bindings[key]) : placeholder,
  );
}
const same = (left: InstanceAddress, right: InstanceAddress): boolean =>
  left.instances.length === right.instances.length &&
  left.templatePath.length === right.templatePath.length &&
  left.instances.every((id, index) => id === right.instances[index]) &&
  left.templatePath.every((id, index) => id === right.templatePath[index]);

/** Project entry lookup and immutable code library are kept in separate ID spaces. */
export function resolveCatalogNode(
  graph: CatalogGraph,
  id: NodeId,
  state?: StateName,
  selection?: CatalogResolutionSelection,
): ResolvedCatalogNode {
  const library: CatalogLibrary = graph.library;
  const source = graph.getEntry(id);
  if (source?.kind !== "node")
    throw new CatalogValidationError("NODE_REQUIRED", id);
  const lookupDefinition = (definitionId: DefinitionId) => {
    const definition = graph.getDefinition(definitionId);
    if (!definition)
      throw new CatalogValidationError("DANGLING_DEFINITION", definitionId);
    return definition;
  };
  const tokenValue = (value: AuthoredValue): Scalar => {
    if (typeof value !== "object") return value;
    const token = graph.getToken(value.tokenId);
    if (!token)
      throw new CatalogValidationError("DANGLING_TOKEN", value.tokenId);
    return token.value;
  };
  const applyValues = (
    target: Values,
    values: Readonly<Record<string, AuthoredValue>>,
  ): void => {
    for (const [key, value] of Object.entries(values))
      target[key] = tokenValue(value);
  };
  const applyWrites = (
    target: Record<string, Scalar | number | null>,
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
  function* ancestorTypes(context: ParentContext | undefined): Generator<string> {
    for (
      let cursor = structuralParent(context);
      cursor;
      cursor = structuralParent(cursor.parent)
    )
      yield lookupDefinition(cursor.definitionId).name;
  }
  const base = (definitionId: DefinitionId) => {
    const definition = lookupDefinition(definitionId);
    const props: Values = {};
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
    values: Values,
  ): boolean =>
    !condition ||
    Object.entries(condition).every(([key, value]) => values[key] === value);
  /** Conditional rules of the node's own definition, then part rules of its parent definition. */
  const applyTypedRules = (
    definitionId: DefinitionId,
    props: Values,
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
          (rule.state === undefined || rule.state === (ruleOwner.state ?? state))
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
    props: Values,
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
    props: Values,
  ): Values | undefined => {
    const definition = lookupDefinition(definitionId);
    if (definition.mode !== "composite") return undefined;
    const bindings: Values = {};
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
    props: Values,
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
      props: Values;
      visual: Values;
      slot?: { name: string; required: boolean };
    },
    parent?: ParentContext,
  ): ResolvedCatalogNode | undefined => {
    selection?.onVisit?.(node.id);
    if (node.enabled === false) return undefined;
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
    const self: ParentContext = {
      definitionId: node.definitionId,
      props,
      parent,
    };
    const sizing: Record<string, number | null> = {};
    applyWrites(sizing, node.sizing);
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
            Object.keys(node.visual),
            visual,
            sizing,
          ),
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
    bindings?: Values,
    /**
     * Instance root values: the owning composite instance's authored props, visual and sizing,
     * applied on its template root after the template's own values and before path overrides.
     */
    root?: InstanceRoot,
    /** Descendant patches of the library composite template node whose template this is. */
    patches?: LibraryPatchScope,
  ): ResolvedCatalogNode | undefined => {
    selection?.onVisit?.(templateId);
    const template = templateId.startsWith("lib:")
      ? library.templates.get(templateId as `lib:template:${string}`)
      : graph.getEntry(templateId);
    if (!template || ("kind" in template && template.kind !== "node"))
      throw new CatalogValidationError("DANGLING_TEMPLATE", templateId);
    const address = { instances: instancePath, templatePath: path };
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
    if (change?.kind === "patch") {
      if (change.props) applyWrites(props, change.props);
      if (change.sizing) applyWrites(sizing, change.sizing);
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
    if (displayState)
      for (const [key, value] of Object.entries(
        DISPLAY_STATE_PROPS[displayState] ?? {},
      ))
        if (definition.accepts[key] === "boolean") props[key] = value;
    const nodeState = catalogNodeState(displayState, state);
    applyPropVisualRules(template.definitionId, props, visual);
    applyTypedRules(template.definitionId, props, visual, layout, parent, nodeState);
    // Authored template layout (origin style) is the node's own declaration, like inline style
    // over the rule and parent delegation; an instance position's layout reaches its root.
    const authoredLayout: Record<string, string> = {
      ...(!("kind" in template) ? template.layout : undefined),
      ...libraryPatch?.layout,
    };
    Object.assign(layout, authoredLayout);
    if (root) Object.assign(layout, root.layout);
    // Authored template visual is the node's own value: it wins over definition rules, the same
    // order as an authored node's visual writes in resolveOwned.
    if ("kind" in template) applyWrites(visual, template.visual);
    else applyValues(visual, template.visual);
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
            withDisplayState(displayState, instanceRoot(
              [
                ...Object.keys(template.props),
                ...(change?.kind === "patch"
                  ? Object.keys(change.props ?? {})
                  : []),
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
            )),
            "descendantPatches" in template && template.descendantPatches
              ? { instances: nestedPath, patches: template.descendantPatches }
              : undefined,
          ),
        );
    }
    for (const childId of template.children)
      if (!selection || selection.include(childId, instancePath))
        push(
          children,
          projectTemplate(
            owner,
            childId,
            instancePath,
            [...path, childId],
            self,
            bindings,
            undefined,
            patches,
          ),
        );
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
