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
  CatalogPresentWhen,
  CatalogShowWhen,
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
  StateRules,
  TemplateId,
  VisualWrites,
  WriteValue,
} from "../document/types";
import { CatalogGraph } from "../document/graph";
import { catalogCalendarDurationFits } from "../document/valueType";
import { isInOwnCollection, isInOwnGroup } from "../document/collectionItems";
import {
  CATALOG_SIZE_PASS_THROUGH,
  CATALOG_DENSITY_PROPAGATION_OWNER,
  CATALOG_SIZE_PROPAGATION,
  CATALOG_OVERFLOW_MODE_OWNERS,
  CATALOG_SIZE_STEP,
  CATALOG_TOGGLE_GROUP_OF,
} from "../document/sizePropagation";
import {
  CATALOG_BOOLEAN_VARIANTS,
  CATALOG_EMPHASIS_FROM_GROUP,
  CATALOG_VARIANT_FROM_OWNER,
} from "../document/s2PropAlignment";
import { CatalogValidationError } from "../document/validation";
import {
  CATALOG_FORM_CONTEXT_KEYS,
  CATALOG_FORM_FIELDS,
} from "../document/formContext";
import { OWNER_DRAWN_PART_HOSTS } from "../resolvers/resolveDelegatedChildFontSize";
import { catalogTokenValue } from "../document/themedToken";
import {
  compileFieldTemplate,
  interpolateFieldTemplate,
} from "../../collections/fieldTemplate";
import { ROW_TEMPLATE_BINDABLE_PROP_KEYS } from "../../collections/rowTemplateBindableProps";
import {
  resolveTableColumnKey,
} from "../../collections/resolveCollectionItems";
import { classifyTableCellDisplay } from "../../collections/cellValue";
import { tableBinding } from "../bindings/Table.binding";
import {
  catalogTableColumnKey,
  catalogTableSorted,
  type CatalogTableSortSource,
} from "../runtime/tableSort";

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
  /** The author's class names and accessible name (`metadata.className` · `ariaLabel`). */
  className?: string;
  ariaLabel?: string;
  slot?: { name: string; required: boolean };
  name?: string;
  regions?: readonly { name: string; required: boolean }[];
  placeholder?: boolean;
  /** State-origin display state (outer instance layer wins over its template's). */
  displayState?: DisplayStateName;
  /** ADR-256 Decision 7 — the node's value condition (`NodeEntry.presentWhen`). */
  presentWhen?: CatalogPresentWhen;
  /** ADR-256 Decision 7 — the states in which the node is there (`NodeEntry.showWhen`). */
  showWhen?: CatalogShowWhen;
  /**
   * The values each state gives this node (the keys its state rules write, in the rules' order —
   * definition, overrides, the instance's own): a consumer that draws states itself (the DOM, by
   * RAC's render state) reads them; `visual` holds them only when resolved in that state.
   */
  stateVisual?: Readonly<Partial<Record<StateName, Readonly<Values>>>>;
  /**
   * A data row's key on every node the row projects (not the first row, which keeps the row
   * template position's identity): the record identity's row segment.
   */
  rowKey?: string;
  /** A data row's index (the delivered rows' order) on the row's root node. */
  rowIndex?: number;
  /**
   * ADR-256 Phase 9 — a calendar month block copy's month offset (not a data row: the Layers
   * panel projects `rowIndex` nodes as row leaves).
   */
  monthIndex?: number;
  /**
   * On a bound ListBox/GridList, or a bound Table's body, that grows with its rows (no bounded
   * height — ADR-157 sample policy): the collection's row count. The Builder Canvas shows the first
   * rows and marks the rest ("+N more"); the DOM shows every row.
   */
  rowCount?: number;
  children: readonly ResolvedCatalogNode[];
}
/** A data row a bound collection shows (the rows stay in the data store — H1). */
export interface CatalogBoundRow {
  /** Stable row key: the item's collection key and the record identity's row segment. */
  key: string;
  /** What the row template's `{field}` placeholders read (row fields + label/description/icon/value). */
  values: Readonly<Record<string, unknown>>;
}
/**
 * The rows of a binding; `undefined` = unknown (not loaded) — the template items stay. `kind`
 * "items" (default) = the rows a collection repeats (the item reader's label/value fields, the
 * window limit); "records" = the collection's own records (a Chart's data — no window, raw fields).
 */
export type CatalogRowSource = (
  binding: DataBindingRef,
  kind?: "items" | "records",
) => CatalogBoundRows | undefined;
/** A binding's delivered rows; `total` = the collection's row count when it holds more (the window). */
export type CatalogBoundRows = readonly CatalogBoundRow[] & {
  readonly total?: number;
};
/** Bound collections whose rows the Builder samples when they grow with them (ADR-157). */
const SAMPLED_ROW_OWNERS: ReadonlySet<string> = new Set([
  "ListBox",
  "GridList",
]);
/** A box that grows with its content: no bounded height (the old sample policy's `viewportHeight == null`). */
function growsWithRows(
  visual: Readonly<Record<string, Scalar>>,
  sizing: Readonly<Record<string, number | null>>,
): boolean {
  const open = (value: unknown) =>
    value === undefined ||
    value === null ||
    value === "auto" ||
    value === "fit-content" ||
    value === "none";
  return (
    sizing.height == null &&
    sizing.maxHeight == null &&
    open(visual.height) &&
    open(visual.maxHeight)
  );
}
const rowCountOf = (rowSet: readonly CatalogBoundRow[]) =>
  (rowSet as CatalogBoundRows).total ?? rowSet.length;
/**
 * Item types a bound collection repeats per data row (its first item position is the row
 * template; the positions may sit under a list part — TagGroup's TagList).
 */
export const CATALOG_ROW_ITEM_TYPES: ReadonlySet<string> = new Set([
  "ListBoxItem",
  "GridListItem",
  "Tag",
  "Breadcrumb",
]);
/**
 * Source of a bound Table's projected rows and cells (`…:row`, `…:cell-<column>`): they show data,
 * not a document position, so no command targets them (picking reaches the TableBody).
 */
export const CATALOG_TABLE_ROW_SOURCE = "lib:template:catalog-table-data";
const TABLE_ROW_DEFINITION = "lib:definition:type-Row" as DefinitionId;
const TABLE_CELL_DEFINITION = "lib:definition:type-Cell" as DefinitionId;
/** The shortest row a Table density gives (compact: line 24 + padding 4 × 2). */
const TABLE_MIN_ROW_HEIGHT = 32;
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
/**
 * ADR-256 Phase 8c — hosts a part rule's `via` reaches through to their owner: a Disclosure's
 * header Heading (the trigger Button's content is styled from the Disclosure's sheet).
 */
const PART_RULE_PASS_HOSTS: Readonly<Record<string, ReadonlySet<string>>> = {
  Heading: new Set(["Disclosure"]),
};
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
  /**
   * The instance position's authored fill layers (and their sizing): the one element the author
   * edits is the instance, so they replace the template root's (ADR-248 4e-12).
   */
  fills?: readonly CatalogFillLayer[];
  fillSizing?: FillSizing;
  /**
   * The composite definition whose template root this is (ADR-253): its project override is the
   * origin's style, so it lands on the root — over the root's own values, under the values the
   * instance position authored.
   */
  origin?: DefinitionId;
  /** State rules the instance position authored (outer layers last): over the origin's. */
  stateRules?: readonly StateRules[];
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
  /**
   * Slot fills of that template node (`LibraryTemplateNode.slotFills`): at the composite's slot
   * position, the node's own children projected in place of the position's default children.
   */
  fills?: readonly {
    templatePath: readonly TemplateId[];
    project: (parent: ParentContext) => ResolvedCatalogNode[];
  }[];
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
  /** ADR-257 Phase 4 — a bound Table's Preview sort (runtime state); absent = the data's order. */
  tableSort?: CatalogTableSortSource,
): ResolvedCatalogNode {
  const library: CatalogLibrary = graph.library;
  const responsiveLayers = (node: NodeEntry): NodeResponsiveLayer[] =>
    CASCADE[breakpoint]
      .map((name) => node.responsive?.[name])
      .filter((layer): layer is NodeResponsiveLayer => !!layer);
  /** A node's authored fill layers and their cascaded sizing (`InstanceRoot` paint). */
  const instancePaint = (
    node: NodeEntry,
    layers: readonly NodeResponsiveLayer[],
  ): Pick<InstanceRoot, "fills" | "fillSizing"> => {
    const fillSizing = cascadeFillSizing(node, layers);
    return {
      ...(node.fills ? { fills: node.fills } : {}),
      ...(fillSizing ? { fillSizing } : {}),
    };
  };
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
      ...(node.metadata?.className
        ? { className: node.metadata.className }
        : {}),
      ...(node.metadata?.ariaLabel
        ? { ariaLabel: node.metadata.ariaLabel }
        : {}),
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
  /**
   * The definition whose part rules a context owns: a composite instance's are its template root's
   * (the consumer tree draws the two as one element — an author's child of a Form instance sits in
   * the Form's element, which its sheet's selectors reach). 2026-10-10: a side Form's label column
   * (Form → field → Label, `via`).
   */
  const ruleDefinitionOf = (definitionId: DefinitionId) => {
    const definition = lookupDefinition(definitionId);
    if (definition.mode !== "composite" || !definition.templateRootId)
      return definition;
    const template = library.templates.get(
      definition.templateRootId as `lib:template:${string}`,
    );
    return template ? lookupDefinition(template.definitionId) : definition;
  };
  const templateTypeName = (templateId: TemplateId): string => {
    const template = templateId.startsWith("lib:")
      ? library.templates.get(templateId as `lib:template:${string}`)
      : graph.getEntry(templateId);
    if (!template || ("kind" in template && template.kind !== "node"))
      return "";
    let definition = graph.getDefinition(template.definitionId);
    for (
      let depth = 0;
      definition?.mode === "composite" && depth < 16;
      depth++
    ) {
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
  /** ADR-256 Phase 9 — a calendar's shown months (the nearest Calendar · RangeCalendar context's). */
  const calendarMonthCount = (context: ParentContext | undefined): number => {
    for (let cursor = context; cursor; cursor = cursor.parent) {
      const name = ruleDefinitionOf(cursor.definitionId).name;
      if (name === "Calendar" || name === "RangeCalendar") {
        const duration = cursor.props.visibleDuration;
        return catalogCalendarDurationFits(duration) && "months" in duration
          ? duration.months
          : 1;
      }
    }
    return 1;
  };
  /**
   * An owned child into its parent's resolved children — every owned-children path (an owned
   * node's children, a filled slot's) goes through here, so a month block repeats wherever it sits.
   */
  const pushOwnedChild = (
    out: ResolvedCatalogNode[],
    child: NodeEntry,
    resolved: ResolvedCatalogNode | undefined,
    context: ParentContext | undefined,
  ): void => {
    if (ruleDefinitionOf(child.definitionId).name === "CalendarMonth")
      pushCalendarMonths(out, resolved, context);
    else push(out, resolved);
  };
  /**
   * ADR-256 Phase 9 — a calendar's month block is a repeat template (the reference starter's
   * `Array.from({length: months}, (_, i) => <div className="month">…)`): one copy per shown month,
   * each its own record (`rowKey`) whose index (`monthIndex`) is the month offset of the heading · grid
   * in it. The copies edit the one template node.
   */
  const pushCalendarMonths = (
    out: ResolvedCatalogNode[],
    month: ResolvedCatalogNode | undefined,
    context: ParentContext | undefined,
  ): void => {
    if (!month) return;
    const count = calendarMonthCount(context);
    for (let index = 0; index < count; index++)
      out.push(
        index === 0
          ? { ...month, monthIndex: 0 }
          : {
              ...withRowKey(
                month,
                month.rowKey !== undefined
                  ? `${month.rowKey}~month${index}`
                  : `month${index}`,
              ),
              monthIndex: index,
            },
      );
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
  /** `ResolvedCatalogNode.stateVisual` of the state rule layers a node takes, lowest first. */
  const stateValues = (
    layers: readonly (StateRules | undefined)[],
  ): ResolvedCatalogNode["stateVisual"] => {
    let out: Partial<Record<StateName, Values>> | undefined;
    for (const rules of layers) {
      if (!rules) continue;
      for (const name in rules) {
        const writes = rules[name as StateName];
        if (writes)
          applyWrites(
            ((out ??= {})[name as StateName] ??= {}) as Record<
              string,
              PropValue | null
            >,
            writes,
          );
      }
    }
    if (!out) return undefined;
    for (const name of Object.keys(out) as StateName[])
      if (Object.keys(out[name]!).length === 0) delete out[name];
    return Object.keys(out).length ? out : undefined;
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
    const near = structuralParent(parent);
    if (!near) return;
    // A toggle's part rules are descendant selectors (`.react-aria-Checkbox .react-aria-CheckboxButton`,
    // `.react-aria-CheckboxButton … .checkbox`): a layout frame the author put inside the toggle
    // passes them through (ADR-256 Phase 3 review m1). So does a TreeItem's chevron rule
    // (`.react-aria-TreeItem .react-aria-Button[slot="chevron"]` — Phase 5 Round 12). Other
    // owners' rules stop at the frame.
    const passHostOwner = (
      context: ParentContext,
    ): ParentContext | undefined => {
      const owners =
        PART_RULE_PASS_HOSTS[lookupDefinition(context.definitionId).name];
      if (!owners) return undefined;
      const above = pastFrames(structuralParent(context.parent));
      return above && owners.has(lookupDefinition(above.definitionId).name)
        ? above
        : undefined;
    };
    const pastFrames = (context: ParentContext | undefined) => {
      let cursor = context;
      while (cursor && lookupDefinition(cursor.definitionId).name === "frame")
        cursor = structuralParent(cursor.parent);
      return cursor;
    };
    // (A Disclosure's sheet is descendant selectors too — `.react-aria-Disclosure .react-aria-Heading`,
    // `… .react-aria-Button[slot='trigger']`: a frame around its Heading passes them, Phase 8 판독 M1.)
    const toggleFamily = (context: ParentContext | undefined) => {
      const name = context && lookupDefinition(context.definitionId).name;
      return (
        !!name &&
        (OWNER_DRAWN_PART_HOSTS[name] !== undefined ||
          Object.values(OWNER_DRAWN_PART_HOSTS).includes(name) ||
          name === "TreeItemContent" ||
          name === "Disclosure")
      );
    };
    const owner = toggleFamily(pastFrames(near)) ? pastFrames(near)! : near;
    const grandNear = structuralParent(owner.parent);
    const grandHost = toggleFamily(pastFrames(grandNear))
      ? pastFrames(grandNear)
      : grandNear;
    // ADR-256 Phase 8c: a Disclosure's header Heading passes its owner's rules to its trigger's
    // content (`.react-aria-Button[slot='trigger'] > .react-aria-Text` — the sheet reaches through
    // the Heading): the grandparent of the trigger's chevron and title is the Disclosure.
    const passedOwner = grandHost && passHostOwner(grandHost);
    const grand = passedOwner ?? grandHost;
    // The parent's own rules, then the grandparent's `via` rules (through this node's parent): a
    // selector reaching through the wrapper from its owner is the more specific one in the sheet.
    // A side Form's label column reaches its fields at any depth (`formFieldLabelPartRules` — the
    // sheet's `--form-label-width` is inherited, as S2's Form context): the nearest Form's `via`
    // rules through the field (2026-10-10).
    let form: ParentContext | undefined;
    if (CATALOG_FORM_FIELDS.has(lookupDefinition(owner.definitionId).name)) {
      form = structuralParent(owner.parent);
      while (form && ruleDefinitionOf(form.definitionId).name !== "Form")
        form = structuralParent(form.parent);
    }
    const owners: Array<{ owner: ParentContext; via?: DefinitionId }> = [
      { owner },
      ...(grand ? [{ owner: grand, via: owner.definitionId }] : []),
      ...(form && form !== grand
        ? [{ owner: form, via: owner.definitionId }]
        : []),
    ];
    for (const { owner: ruleOwner, via } of owners) {
      const ownerDefinition = via
        ? ruleDefinitionOf(ruleOwner.definitionId)
        : lookupDefinition(ruleOwner.definitionId);
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
    paint: Pick<InstanceRoot, "fills" | "fillSizing"> = {},
    from: Pick<InstanceRoot, "origin" | "stateRules"> = {},
  ): InstanceRoot => {
    const root: InstanceRoot = {
      props: {},
      visual: {},
      sizing: { ...sizing },
      layout: { ...layout },
      ...(paint.fills ? { fills: paint.fills } : {}),
      ...(paint.fillSizing ? { fillSizing: paint.fillSizing } : {}),
      ...from,
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
  /**
   * An owner's `size` set on the child it propagates to (`CATALOG_SIZE_PROPAGATION` — RSP context:
   * a group's size reaches its items, an item's its label). The owner wins over the child's own
   * value, like the old `override: true` propagation; a size the child does not offer stays out.
   */
  const applyOwnerSize = (
    definitionId: DefinitionId,
    props: Props,
    parent: ParentContext | undefined,
  ): void => {
    const definition = lookupDefinition(definitionId);
    // (A toggle takes its group's size wherever it sits in the group — the nearest group of its
    // type, as its values do: straight in the group, not only in its items box — Codex Round 21.)
    const groupType = CATALOG_TOGGLE_GROUP_OF[definition.name];
    if (groupType && definition.accepts.size === "string") {
      let cursor = structuralParent(parent);
      while (cursor && lookupDefinition(cursor.definitionId).name !== groupType)
        cursor = structuralParent(cursor.parent);
      const groupSize = cursor?.props.size;
      if (typeof groupSize === "string") {
        const choices =
          "propChoices" in definition
            ? definition.propChoices?.size
            : undefined;
        if (!choices || choices.map(String).includes(groupSize))
          props.size = groupSize;
        return;
      }
    }
    let owner = structuralParent(parent);
    // (A Group · frame between takes no size — the owner's reaches through it, as RAC's context:
    // a field's control Group (ADR-256 Phase 6b), a Group around a group's item (Round 21).)
    while (
      owner &&
      CATALOG_SIZE_PASS_THROUGH.has(lookupDefinition(owner.definitionId).name)
    )
      owner = structuralParent(owner.parent);
    const ownerSize = owner?.props.size;
    if (typeof ownerSize !== "string") return;
    const ownerName = lookupDefinition(owner!.definitionId).name;
    if (
      !CATALOG_SIZE_PROPAGATION[ownerName]?.includes(definition.name) ||
      definition.accepts.size !== "string"
    )
      return;
    // (A child whose rule names the owner's look one step apart — `CATALOG_SIZE_STEP`.)
    const size =
      CATALOG_SIZE_STEP[ownerName]?.[definition.name]?.[ownerSize] ?? ownerSize;
    const choices =
      "propChoices" in definition ? definition.propChoices?.size : undefined;
    if (choices && !choices.map(String).includes(size)) return;
    props.size = size;
  };
  /**
   * S2 density context (2026-10-10): a Table's `density` reaches the Columns · Cells in it
   * (`CATALOG_DENSITY_PROPAGATION_OWNER` — S2 TableView density rows every cell). The owner wins:
   * the parts carry no editable density (`editorHidden`), so nothing authored competes.
   */
  const applyOwnerDensity = (
    definitionId: DefinitionId,
    props: Props,
    parent: ParentContext | undefined,
  ): void => {
    const definition = lookupDefinition(definitionId);
    const ownerType = CATALOG_DENSITY_PROPAGATION_OWNER[definition.name];
    if (!ownerType || definition.accepts.density !== "string") return;
    let owner = structuralParent(parent);
    while (owner && lookupDefinition(owner.definitionId).name !== ownerType)
      owner = structuralParent(owner.parent);
    const density = owner?.props.density;
    if (typeof density === "string") props.density = density;
  };
  /**
   * ADR-257 Phase 3 — S2 `overflowMode`: the nearest Table · TableView's value reaches its
   * Columns · Cells, a GridList's its items (`CATALOG_OVERFLOW_MODE_OWNERS`) — the parts have no
   * editor for it.
   */
  const applyOwnerOverflowMode = (
    definitionId: DefinitionId,
    props: Props,
    parent: ParentContext | undefined,
  ): void => {
    const definition = lookupDefinition(definitionId);
    const owners = CATALOG_OVERFLOW_MODE_OWNERS[definition.name];
    if (!owners || definition.accepts.overflowMode !== "string") return;
    let owner = structuralParent(parent);
    while (
      owner &&
      !owners.includes(lookupDefinition(owner.definitionId).name)
    )
      owner = structuralParent(owner.parent);
    const mode = owner?.props.overflowMode;
    if (typeof mode === "string") props.overflowMode = mode;
  };
  /**
   * S2 Form context (`formContext.ts`): a field takes the nearest Form's value for each context
   * key it did not author — S2 `useFormProps` fills only `undefined` keys. The Form reaches through
   * any element between (React context), the nearest Form wins.
   */
  const applyFormContext = (
    definitionId: DefinitionId,
    props: Props,
    parent: ParentContext | undefined,
    authored: ReadonlySet<string>,
  ): void => {
    const definition = lookupDefinition(definitionId);
    if (!CATALOG_FORM_FIELDS.has(definition.name)) return;
    let form = structuralParent(parent);
    while (form && lookupDefinition(form.definitionId).name !== "Form")
      form = structuralParent(form.parent);
    if (!form) return;
    for (const key of CATALOG_FORM_CONTEXT_KEYS) {
      if (authored.has(key) || !(key in definition.accepts)) continue;
      const value = form.props[key];
      if (value !== undefined) props[key] = value;
    }
  };
  /**
   * S2 toggle 강조 context (`CATALOG_EMPHASIS_FROM_GROUP`, 2026-10-10): 그룹 안의 Checkbox ·
   * Radio 는 가장 가까운 자기 그룹의 `isEmphasized` 를 쓴다 — S2 는 그룹 값이 toggle 자신의
   * prop 을 **이긴다** (`isInCheckboxGroup ? ctx?.isEmphasized : props.isEmphasized`), 그룹이
   * 안 켰으면 toggle 의 것도 꺼진다.
   */
  const applyOwnerEmphasis = (
    definitionId: DefinitionId,
    props: Props,
    parent: ParentContext | undefined,
  ): void => {
    const definition = lookupDefinition(definitionId);
    const groupType = CATALOG_EMPHASIS_FROM_GROUP[definition.name];
    if (!groupType) return;
    let group = structuralParent(parent);
    while (group && lookupDefinition(group.definitionId).name !== groupType)
      group = structuralParent(group.parent);
    if (!group) return;
    if (group.props.isEmphasized === true) props.isEmphasized = true;
    else delete props.isEmphasized;
  };
  /**
   * S2 CardView context (`CATALOG_VARIANT_FROM_OWNER`, 2026-10-10): CardView 의 `variant` 를
   * 안의 Card 중 자기 값을 안 적은 것이 입는다 (S2 `ctx = {size, variant}` — 작성 값이 이긴다).
   */
  const applyOwnerVariant = (
    definitionId: DefinitionId,
    props: Props,
    parent: ParentContext | undefined,
    authored: ReadonlySet<string>,
  ): void => {
    const definition = lookupDefinition(definitionId);
    const ownerType = CATALOG_VARIANT_FROM_OWNER[definition.name];
    if (!ownerType || authored.has("variant")) return;
    let owner = structuralParent(parent);
    while (owner && lookupDefinition(owner.definitionId).name !== ownerType)
      owner = structuralParent(owner.parent);
    const variant = owner?.props.variant;
    if (typeof variant === "string") props.variant = variant;
  };
  /**
   * S2 강조 · quiet boolean 축 (`CATALOG_BOOLEAN_VARIANTS`, 2026-10-10): 공개 prop 은 boolean
   * (`isEmphasized`) 이고 rule 변형은 내부 운반 값 (`editorHidden` variant) 이다 — 여기서
   * 파생하므로 Canvas rule paint 와 DOM 이 종전 record 그대로 읽는다. 작성자 variant 는 이제
   * 패널에 없다 — 남은 값은 옛 문서의 것으로, 로드 전환이 지웠거나 기본값이다.
   */
  const applyBooleanVariant = (
    definitionId: DefinitionId,
    props: Props,
  ): void => {
    const definition = lookupDefinition(definitionId);
    const mapping = CATALOG_BOOLEAN_VARIANTS[definition.name];
    if (!mapping) return;
    if (
      props[mapping.prop] === true &&
      (props.variant === undefined || props.variant === "default")
    )
      props.variant = mapping.variant;
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
    applyFormContext(
      node.definitionId,
      props,
      parent,
      new Set([
        ...Object.keys(inherited?.props ?? {}),
        ...Object.keys(node.props),
      ]),
    );
    applyOwnerSize(node.definitionId, props, parent);
    applyOwnerDensity(node.definitionId, props, parent);
    applyOwnerOverflowMode(node.definitionId, props, parent);
    applyOwnerEmphasis(node.definitionId, props, parent);
    applyOwnerVariant(
      node.definitionId,
      props,
      parent,
      new Set([
        ...Object.keys(inherited?.props ?? {}),
        ...Object.keys(node.props),
      ]),
    );
    applyBooleanVariant(node.definitionId, props);
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
    // A bound Chart reads the records as its data (the old Canvas's `_chartRows`, the DOM
    // Chart's bound rows); the other bound composites repeat their item template per row.
    const charted =
      definition.mode === "composite" &&
      !!definition.templateRootId &&
      templateTypeName(definition.templateRootId) === "Chart";
    const records =
      node.binding && rows && charted
        ? rows(node.binding, "records")
        : undefined;
    const rowSet =
      node.binding && rows && !charted ? rows(node.binding) : undefined;
    if (
      definition.mode === "composite" &&
      definition.templateRootId &&
      (!selection || selection.include(definition.templateRootId, instancePath))
    )
      push(
        children,
        projectTableRows(
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
              // The instance's authored layout and fills reach its template root (the record the
              // author edits): its own layout over the root's rules, its fills over the root's.
              ownLayout,
              instancePaint(node, layers),
              {
                origin: node.definitionId,
                stateRules: node.stateRules ? [node.stateRules] : [],
              },
            ),
            undefined,
            rowSet ? { rowSet } : records ? { records } : undefined,
          ),
          rowSet,
          `${instancePath.join("/")}::${node.id}`,
        ),
      );
    for (const childId of selection?.ownedChildren?.(node.id, instancePath) ??
      node.children) {
      const childPath = [...instancePath, childId];
      if (selection && !selection.include(childId, childPath)) continue;
      const child = graph.getEntry(childId);
      if (child?.kind !== "node")
        throw new CatalogValidationError("DANGLING_CHILD", childId);
      pushOwnedChild(
        children,
        child,
        resolveOwned(child, childPath, undefined, self),
        self,
      );
    }
    for (const rule of stateVisual(node.definitionId))
      applyWrites(visual, rule);
    if (state && node.stateRules?.[state])
      applyWrites(visual, node.stateRules[state]);
    const ownStates = stateValues([
      lookupDefinition(node.definitionId).stateRules,
      findOverride(node.definitionId)?.stateRules,
      node.stateRules,
    ]);
    return {
      sourceId: node.id,
      instancePath,
      definitionId: node.definitionId,
      props,
      visual,
      ...(ownStates ? { stateVisual: ownStates } : {}),
      layout,
      sizing,
      placement: node.placement,
      ...(Object.keys(ownLayout).length ? { authoredLayout: ownLayout } : {}),
      ...authoredExtras(node, layers),
      slot: node.slot ?? inherited?.slot,
      ...(node.presentWhen ? { presentWhen: node.presentWhen } : {}),
      ...(node.showWhen ? { showWhen: node.showWhen } : {}),
      name: node.name,
      regions: node.regions,
      placeholder: node.placeholder,
      children,
    };
  };
  /**
   * A bound Table's data rows (ADR-248 4e — the old Canvas's `appendTableRowProjection`): the DOM
   * Table draws its rows from the data itself (`renderTable` reads only the header's Column
   * children), so its TableBody here shows one `Row` per data row with one `Cell` per header
   * column (`resolveTableColumnKey`, text through the DOM's `classifyTableCellDisplay`) in place of
   * its own children. A fixed-height Table (`heightMode` "fixed", the binding default) shows the
   * rows its height can hold; the other modes grow with every row. Unknown rows (`undefined`) keep
   * the template; the projected nodes have no document position (`CATALOG_TABLE_ROW_SOURCE`).
   */
  const projectTableRows = (
    projected: ResolvedCatalogNode | undefined,
    rowSet: readonly CatalogBoundRow[] | undefined,
    /** The bound node's record identity (the instance — its template root collapses into it). */
    tableId: string,
  ): ResolvedCatalogNode | undefined => {
    if (!projected || !rowSet) return projected;
    const typeOf = (resolved: ResolvedCatalogNode) =>
      lookupDefinition(resolved.definitionId).name;
    if (typeOf(projected) !== "Table") return projected;
    const header = projected.children.find(
      (child) => typeOf(child) === "TableHeader",
    );
    const body = projected.children.find(
      (child) => typeOf(child) === "TableBody",
    );
    if (!body) return projected;
    const columnNodes = (header?.children ?? []).filter(
      (child) => typeOf(child) === "Column",
    );
    // (ADR-257: the columns' widths are the rows' shared grid tracks — `tableTracks.ts`, derived
    // on the header row and every projected Row; a cell is its column's grid area.)
    const columns = columnNodes.map((column, index) => ({
      key: resolveTableColumnKey(column.props, index),
      // (Its RAC key — `catalogTableColumnKey` of its record.)
      id: catalogTableColumnKey({
        id: `${column.instancePath.join("/")}::${column.sourceId}`,
        ...(column.htmlId ? { htmlId: column.htmlId } : {}),
      }),
    }));
    // ADR-257 Phase 4: the Preview's sort orders every data row by the column's field value
    // before the rows its height shows are taken (사용자 결정 4 — the Canvas has no sort).
    const sort = tableSort?.(tableId);
    const sortKey =
      sort && columns.find((column) => column.id === sort.column)?.key;
    const ordered =
      sort && sortKey !== undefined
        ? catalogTableSorted(rowSet, sort.direction, (row) => row.values[sortKey])
        : rowSet;
    const heightMode =
      projected.props.heightMode ??
      tableBinding.props.accepts.heightMode?.default;
    const height =
      typeof projected.props.height === "number"
        ? projected.props.height
        : (tableBinding.props.accepts.height?.default as number | undefined);
    const shown =
      heightMode === "fixed" && typeof height === "number"
        ? ordered.slice(0, Math.ceil(height / TABLE_MIN_ROW_HEIGHT) + 1)
        : ordered;
    const tableContext: ParentContext = {
      definitionId: projected.definitionId,
      props: projected.props as Props,
    };
    const bodyContext: ParentContext = {
      definitionId: body.definitionId,
      props: body.props as Props,
      parent: tableContext,
    };
    const synthesize = (
      definitionId: DefinitionId,
      own: Props,
      sourceId: TemplateId,
      parent: ParentContext,
      rowKey: string,
      children: ResolvedCatalogNode[],
    ): ResolvedCatalogNode => {
      const { props, visual, layout } = base(definitionId);
      Object.assign(props, own);
      applyOwnerSize(definitionId, props, parent);
      applyOwnerDensity(definitionId, props, parent);
      applyOwnerOverflowMode(definitionId, props, parent);
      applyOwnerEmphasis(definitionId, props, parent);
      applyOwnerVariant(definitionId, props, parent, new Set(Object.keys(own)));
      applyBooleanVariant(definitionId, props);
      applyPropVisualRules(definitionId, props, visual);
      applyTypedRules(definitionId, props, visual, layout, parent);
      return {
        sourceId,
        instancePath: body.instancePath,
        definitionId,
        props,
        visual,
        layout,
        sizing: {},
        placement: undefined,
        slot: undefined,
        name: undefined,
        regions: undefined,
        placeholder: undefined,
        rowKey,
        children,
      };
    };
    const rowsOut = shown.map((row, rowIndex) => {
      const rowProps: Props = { id: row.key };
      const rowContext: ParentContext = {
        definitionId: TABLE_ROW_DEFINITION,
        props: rowProps,
        parent: bodyContext,
      };
      const cells = columns.map(({ key }, index) => {
        const display = classifyTableCellDisplay(row.values[key]);
        const text =
          display.kind === "text"
            ? display.text
            : `${display.items.join(", ")}${display.overflow ? ` +${display.overflow}` : ""}`;
        const cell = synthesize(
          TABLE_CELL_DEFINITION,
          { children: text },
          `${CATALOG_TABLE_ROW_SOURCE}:cell-${index}` as TemplateId,
          rowContext,
          row.key,
          [],
        );
        // The text is one line with an ellipsis (the Cell rule's Canvas paint, as Table.css);
        // the box clips it.
        return { ...cell, visual: { ...cell.visual, overflow: "hidden" } };
      });
      return {
        ...synthesize(
          TABLE_ROW_DEFINITION,
          rowProps,
          `${CATALOG_TABLE_ROW_SOURCE}:row` as TemplateId,
          bodyContext,
          row.key,
          cells,
        ),
        rowIndex,
      };
    });
    return {
      ...projected,
      // Table.css clips the outer table (`overflow: hidden`): rows past its height are cut.
      visual: { ...projected.visual, overflow: "hidden" },
      children: projected.children.map((child) =>
        child === body
          ? {
              ...body,
              // The rows past a fixed height are cut (the DOM's virtualizer scrolls them).
              visual: { ...body.visual, overflow: "hidden" },
              // The other modes grow with every row (the Builder samples them).
              ...(shown === ordered ? { rowCount: rowCountOf(rowSet) } : {}),
              children: rowsOut,
            }
          : child,
      ),
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
     * `rowStart` on the row template position itself (its sample content is not the row's);
     * `rowLabel` on a Breadcrumb row's children (its label text is the row's label — the old
     * Canvas crumb's `children: row.label`); `records` = a bound Chart's data.
     */
    rowing?: {
      rowSet?: readonly CatalogBoundRow[];
      row?: CatalogBoundRow;
      rowStart?: boolean;
      rowLabel?: boolean;
      records?: readonly CatalogBoundRow[];
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
    // The origin this root belongs to (ADR-253): its project override is the origin's own style,
    // so every instance draws it — over the root's template values, under the instance's.
    // (Its prop defaults are the origin's accepted keys: they reach the template as bindings.)
    const originOverride = root?.origin ? findOverride(root.origin) : undefined;
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
      if (
        rowing?.rowLabel &&
        props.slot !== "separator" &&
        typeof props.children === "string" &&
        !props.children.includes("{")
      )
        props.children = String(row.values.label ?? "");
    }
    if (rowing?.records)
      props.data = rowing.records.map(
        (record) => record.values,
      ) as unknown as PropValue;
    const shownState =
      root?.displayState ??
      (!("kind" in template) ? template.displayState : undefined);
    // Inside its RAC collection (its keys) or group (its value) an item's selection is the
    // owner's, so a selection display state of the item template (a selected state origin) is not
    // forced there (ADR-256 후속 7 — the groups).
    const itemName = lookupDefinition(template.definitionId).name;
    const offeredState =
      (shownState === "selected" || shownState === "unselected") &&
      (isInOwnCollection(itemName, ancestorTypes(parent)) ||
        isInOwnGroup(itemName, ancestorTypes(parent)))
        ? undefined
        : shownState;
    // A display state replaces the template's own default; a value the instance authored for
    // this position (its root layer or path patch) is more specific and stays.
    const instanceAuthored = new Set([
      ...Object.keys(root?.props ?? {}),
      ...(change?.kind === "patch" ? Object.keys(change.props ?? {}) : []),
    ]);
    // An authored value against the state's own prop (an instance of the selected origin set
    // unselected) ends the state at this position: RAC draws the authored value in the DOM, and the
    // state would keep the Canvas on the origin's paint (2026-10-09 Checkbox).
    const displayState = Object.entries(
      (offeredState && DISPLAY_STATE_PROPS[offeredState]) ?? {},
    ).some(
      ([key, value]) =>
        definition.accepts[key] === "boolean" &&
        instanceAuthored.has(key) &&
        props[key] !== value,
    )
      ? undefined
      : offeredState;
    if (displayState)
      for (const [key, value] of Object.entries(
        DISPLAY_STATE_PROPS[displayState] ?? {},
      ))
        if (definition.accepts[key] === "boolean" && !instanceAuthored.has(key))
          props[key] = value;
    const nodeState = catalogNodeState(displayState, state);
    // (A display state's values stay over the Form context — as the authored ones.)
    applyFormContext(
      template.definitionId,
      props,
      parent,
      new Set([
        ...instanceAuthored,
        ...Object.keys(
          (displayState && DISPLAY_STATE_PROPS[displayState]) ?? {},
        ),
      ]),
    );
    applyOwnerSize(template.definitionId, props, parent);
    // (A palette Table's Columns · Cells are its origin's template nodes — ADR-257 Phase 3: the
    // Table's `density` · `overflowMode` reach them here too.)
    applyOwnerDensity(template.definitionId, props, parent);
    applyOwnerOverflowMode(template.definitionId, props, parent);
    applyOwnerEmphasis(template.definitionId, props, parent);
    applyOwnerVariant(template.definitionId, props, parent, instanceAuthored);
    applyBooleanVariant(template.definitionId, props);
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
    if (originOverride) applyWrites(visual, originOverride.visual);
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
    // This position's fills: a path patch's, else the owning instance's (template root), else the
    // template node's own — the output fields below and a nested instance's root read the same.
    const ownPaint =
      "kind" in template ? instancePaint(template, templateLayers) : {};
    const fills = patch?.fills ?? root?.fills ?? ownPaint.fills;
    const fillSizing = patch?.fillSizing
      ? cascadeFillSizing(
          { fillSizing: patch.fillSizing } as NodeEntry,
          patchLayers,
        )
      : (root?.fillSizing ?? ownPaint.fillSizing);
    const templatePaint: Pick<InstanceRoot, "fills" | "fillSizing"> = {
      ...(fills ? { fills } : {}),
      ...(fillSizing ? { fillSizing } : {}),
    };
    // State rules from above this root (ADR-253), in order: its origin's, the origin's project
    // override, then the ones the instance position authored.
    const receivedStateRules: StateRules[] = root?.origin
      ? [
          lookupDefinition(root.origin).stateRules,
          ...(originOverride ? [originOverride.stateRules] : []),
          ...(root.stateRules ?? []),
        ]
      : [];
    const rowSet = rowing?.rowSet;
    const itemPositions = rowSet
      ? template.children.filter((childId) =>
          CATALOG_ROW_ITEM_TYPES.has(templateTypeName(childId)),
        )
      : [];
    // The rows reach the item positions below a part without them (TagGroup > TagList > Tag).
    const passRows = rowSet && itemPositions.length === 0 ? rowSet : undefined;
    const rowLabel = !!row && templateTypeName(templateId) === "Breadcrumb";
    const childRowing =
      row || passRows
        ? {
            ...(row ? { row } : {}),
            ...(passRows ? { rowSet: passRows } : {}),
            ...(rowLabel ? { rowLabel } : {}),
          }
        : undefined;
    /** This node's template children (`ids`) projected under `childrenParent`, rows repeated. */
    const projectChildren = (
      ids: readonly TemplateId[],
      childrenParent: ParentContext | undefined,
      rowParent: ParentContext | undefined,
    ): ResolvedCatalogNode[] => {
      const out: ResolvedCatalogNode[] = [];
      for (const childId of ids) {
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
              rowParent,
              bindings,
              undefined,
              patches,
              { row: data, rowStart: true },
            );
            if (projected)
              push(out, {
                ...(index === 0 ? projected : withRowKey(projected, data.key)),
                rowIndex: index,
              });
          });
          continue;
        }
        const projected = projectTemplate(
          owner,
          childId,
          instancePath,
          childPath,
          childrenParent,
          bindings,
          undefined,
          patches,
          childRowing,
        );
        if (templateTypeName(childId) === "CalendarMonth")
          pushCalendarMonths(out, projected, childrenParent);
        else push(out, projected);
      }
      return out;
    };
    // Children of this node that fill slot positions of the composite it instantiates
    // (`slotFills`) are projected there, not after the composite's root.
    const slotFills =
      "slotFills" in template && template.slotFills ? template.slotFills : [];
    const filledIds = new Set<TemplateId>(
      slotFills.flatMap((fill) => fill.childIds),
    );
    const ownChildIds = filledIds.size
      ? template.children.filter((childId) => !filledIds.has(childId))
      : template.children;
    const nestedScope = (
      nestedPath: readonly (NodeId | TemplateId)[],
    ): LibraryPatchScope | undefined => {
      const nestedPatches =
        "descendantPatches" in template &&
        template.descendantPatches &&
        !rowing?.rowStart
          ? template.descendantPatches
          : undefined;
      if (!nestedPatches && !slotFills.length) return undefined;
      return {
        instances: nestedPath,
        patches: nestedPatches ?? [],
        ...(slotFills.length
          ? {
              fills: slotFills.map((fill) => ({
                templatePath: fill.templatePath,
                project: (slot: ParentContext) =>
                  projectChildren(fill.childIds, slot, slot),
              })),
            }
          : {}),
      };
    };
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
                  // What this position got from above goes on to the root it collapses into.
                  ...Object.keys(root?.visual ?? {}),
                  ...Object.keys(originOverride?.visual ?? {}),
                  ...Object.keys(template.visual),
                  ...(change?.kind === "patch"
                    ? Object.keys(change.visual ?? {})
                    : []),
                ],
                visual,
                sizing,
                authoredLayout,
                templatePaint,
                {
                  origin: template.definitionId,
                  stateRules: [
                    ...(template.stateRules ? [template.stateRules] : []),
                    ...receivedStateRules,
                    ...(change?.kind === "patch" && change.stateRules
                      ? [change.stateRules]
                      : []),
                  ],
                },
              ),
            ),
            nestedScope(nestedPath),
            row ? { row } : undefined,
          ),
        );
    }
    // A composite position's own children are drawn inside the root it collapses into (ADR-253:
    // a field's stepper is an instance of the Button origin that holds its glyph): that root's
    // rules reach them, as they reach the root's own template children.
    let childParent = self;
    if (definition.mode === "composite" && template.children.length) {
      let inner = children[0];
      while (inner) {
        const innerDefinition = lookupDefinition(
          inner.definitionId as DefinitionId,
        );
        const first = inner.children[0];
        if (
          innerDefinition.mode !== "composite" ||
          first?.sourceId !== innerDefinition.templateRootId
        )
          break;
        inner = first;
      }
      if (inner)
        childParent = {
          definitionId: inner.definitionId as DefinitionId,
          props: inner.props as Props,
          parent,
          ...(nodeState ? { state: nodeState } : {}),
        };
    }
    // The slot position of the composite this node's template sits in, filled by that node
    // (`slotFills`): its default children give way to the fill.
    const libraryFill =
      patches?.fills && sameIds(patches.instances, instancePath)
        ? patches.fills.find((item) => sameIds(item.templatePath, path))
        : undefined;
    if (libraryFill) children.push(...libraryFill.project(self));
    else children.push(...projectChildren(ownChildIds, childParent, self));
    if (change?.kind === "fillSlot") {
      children.length = 0;
      for (const childId of change.childIds) {
        const childPath = [...instancePath, childId];
        if (selection && !selection.include(childId, childPath)) continue;
        const child = graph.getEntry(childId);
        if (child?.kind !== "node")
          throw new CatalogValidationError("DANGLING_CHILD", childId);
        // (A filled slot's owned children repeat like any owned children — a month block put back
        // in its calendar's frame, 판독 R1.)
        pushOwnedChild(
          children,
          child,
          resolveOwned(child, childPath, undefined, self),
          self,
        );
      }
    }
    for (const rule of stateVisual(template.definitionId, nodeState))
      applyWrites(visual, rule);
    if (nodeState && template.stateRules?.[nodeState])
      applyWrites(visual, template.stateRules[nodeState]);
    if (nodeState)
      for (const rules of receivedStateRules)
        if (rules[nodeState]) applyWrites(visual, rules[nodeState]);
    if (nodeState && change?.kind === "patch" && change.stateRules?.[nodeState])
      applyWrites(visual, change.stateRules[nodeState]);
    const templateStates = stateValues([
      lookupDefinition(template.definitionId).stateRules,
      findOverride(template.definitionId)?.stateRules,
      template.stateRules,
      ...receivedStateRules,
      change?.kind === "patch" ? change.stateRules : undefined,
    ]);
    return {
      sourceId: templateId,
      instancePath,
      definitionId: template.definitionId,
      props,
      visual,
      ...(templateStates ? { stateVisual: templateStates } : {}),
      layout,
      sizing,
      placement: "kind" in template ? template.placement : undefined,
      ...(Object.keys(templateAuthored).length
        ? { authoredLayout: templateAuthored }
        : {}),
      ...("kind" in template ? authoredExtras(template, templateLayers) : {}),
      ...(templatePaint.fills ? { fills: templatePaint.fills } : {}),
      ...(templatePaint.fillSizing
        ? { fillSizing: templatePaint.fillSizing }
        : {}),
      slot: template.slot,
      ...(template.presentWhen ? { presentWhen: template.presentWhen } : {}),
      ...(template.showWhen ? { showWhen: template.showWhen } : {}),
      ...(displayState ? { displayState } : {}),
      ...(rowSet &&
      itemPositions.length > 0 &&
      SAMPLED_ROW_OWNERS.has(templateTypeName(templateId)) &&
      growsWithRows(visual, sizing)
        ? { rowCount: rowCountOf(rowSet) }
        : {}),
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
