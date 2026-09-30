import type {
  AuthoredValue,
  CatalogReader,
  DefinitionId,
  DescendantOverride,
  EditTarget,
  InstanceAddress,
  LibraryTemplateId,
  NodeEntry,
  NodeId,
  TemplateId,
  WriteValue,
} from "../document/types";
import { CatalogValidationError } from "../document/validation";
import { DISPLAY_STATE_PROPS } from "./resolver";

/**
 * ADR-248 Phase 4c — where a prop value an edit target shows comes from, in the resolver's
 * precedence: the target's own write (an owned node's prop, a template position's path patch),
 * the enclosing instance's value for a composite root, a display state (a state origin), the
 * enclosing library template's patch, the template node, then the project and definition
 * defaults. Reads only the records on the way (no document scan).
 *
 * Panels read `value` (authored, before rules and bindings — the effective value is the resolved
 * record's), `own` (what a reset removes) and `inherited` (what shows after a reset).
 */
export type PropSource =
  | "own"
  | "instance"
  | "state"
  | "library-patch"
  | "template"
  | "project-default"
  | "definition-default";
export interface PropLayer {
  source: PropSource;
  /** `undefined` for a mask (the layer hides every value below it). */
  value: AuthoredValue | undefined;
}
export interface PropReading {
  /** The authored value shown (the first layer), `undefined` when none sets it or it is masked. */
  value: AuthoredValue | undefined;
  source?: PropSource;
  /** The target's own write, if any. */
  own?: WriteValue<AuthoredValue>;
  /** What shows without the own write. */
  inherited: { value: AuthoredValue | undefined; source?: PropSource };
  layers: readonly PropLayer[];
}

type TemplateRecord = {
  definitionId: DefinitionId;
  children: readonly TemplateId[];
  props: Readonly<Record<string, unknown>>;
  displayState?: keyof typeof DISPLAY_STATE_PROPS;
  descendantPatches?: readonly {
    templatePath: readonly string[];
    props?: Readonly<Record<string, unknown>>;
  }[];
};

const sameIds = (a: readonly string[], b: readonly string[]) =>
  a.length === b.length && a.every((id, index) => id === b[index]);

function readTemplate(reader: CatalogReader, id: TemplateId): TemplateRecord {
  const template = id.startsWith("lib:")
    ? reader.library.templates.get(id as LibraryTemplateId)
    : reader.getEntry(id);
  if (!template || ("kind" in template && template.kind !== "node"))
    throw new CatalogValidationError("DANGLING_TEMPLATE", id);
  return template as TemplateRecord;
}
function readDefinition(reader: CatalogReader, id: DefinitionId) {
  const definition = id.startsWith("lib:")
    ? reader.library.definitions.get(id as `lib:definition:${string}`)
    : reader.getEntry(id);
  if (!definition || ("kind" in definition && definition.kind !== "definition"))
    throw new CatalogValidationError("DANGLING_DEFINITION", id);
  return definition as {
    mode: string;
    templateRootId?: TemplateId;
    accepts: Readonly<Record<string, unknown>>;
    defaults: Readonly<Record<string, unknown>>;
  };
}
/** A template value: a project template node holds writes, a library template plain values. */
function templateLayer(value: unknown): PropLayer["value"] | typeof ABSENT {
  if (value === undefined) return ABSENT;
  if (value && typeof value === "object" && "kind" in value) {
    const write = value as WriteValue<AuthoredValue>;
    if (write.kind === "set") return write.value;
    if (write.kind === "mask") return undefined;
    return ABSENT;
  }
  return value as AuthoredValue;
}
const ABSENT = Symbol("absent");

/** Project default (a definition override) then the definition default of a prop. */
function defaultLayers(
  reader: CatalogReader,
  definitionId: DefinitionId,
  key: string,
): PropLayer[] {
  const layers: PropLayer[] = [];
  const project = reader.getEntry(reader.projectId);
  if (project?.kind === "project" && definitionId.startsWith("lib:"))
    for (const id of project.overrideIds) {
      const override = reader.getEntry(id);
      if (
        override?.kind === "definitionOverride" &&
        override.targetId === definitionId
      ) {
        const write = override.defaults[key];
        if (write?.kind === "set")
          layers.push({ source: "project-default", value: write.value });
        else if (write?.kind === "mask")
          layers.push({ source: "project-default", value: undefined });
      }
    }
  const own = readDefinition(reader, definitionId).defaults[key];
  if (own !== undefined)
    layers.push({
      source: "definition-default",
      value: own as AuthoredValue,
    });
  return layers;
}

/**
 * Layers of a template node and what it stands on. A leaf template: its display state (outer
 * one first), the enclosing library patch, its own value, its definition's defaults. A composite
 * template (a nested instance): its own values are the instance's for its root — they beat the
 * display state, which passes to the root (an instance position's state replaces the root's).
 */
function templateChain(
  reader: CatalogReader,
  templateId: TemplateId,
  key: string,
  libraryPatch: PropLayer | undefined,
  seen: ReadonlySet<string> = new Set(),
  outerState?: TemplateRecord["displayState"],
): PropLayer[] {
  const template = readTemplate(reader, templateId);
  const state = outerState ?? template.displayState;
  const layers: PropLayer[] = [];
  const own = templateLayer(template.props[key]);
  // The state sets the node's own accepted boolean props (a composite accepts its schema; its
  // root's props take the state below its instance values).
  const forced =
    state &&
    readDefinition(reader, template.definitionId).accepts[key] === "boolean"
      ? DISPLAY_STATE_PROPS[state]?.[key]
      : undefined;
  if (forced !== undefined) layers.push({ source: "state", value: forced });
  if (libraryPatch) layers.push(libraryPatch);
  if (own !== ABSENT) layers.push({ source: "template", value: own });
  layers.push(
    ...definitionChain(reader, template.definitionId, key, seen, state),
  );
  return layers;
}
/** A definition's defaults; a composite continues into its root template for other keys. */
function definitionChain(
  reader: CatalogReader,
  definitionId: DefinitionId,
  key: string,
  seen: ReadonlySet<string> = new Set(),
  outerState?: TemplateRecord["displayState"],
): PropLayer[] {
  const definition = readDefinition(reader, definitionId);
  const composite =
    definition.mode === "composite" && definition.templateRootId
      ? definition.templateRootId
      : undefined;
  // A composite's own defaults are its schema's (template bindings); other keys are its root's.
  const layers =
    !composite || key in definition.accepts
      ? defaultLayers(reader, definitionId, key)
      : [];
  if (composite && !seen.has(definitionId))
    layers.push(
      ...templateChain(
        reader,
        composite,
        key,
        undefined,
        new Set([...seen, definitionId]),
        outerState,
      ),
    );
  return layers;
}

function overrideAt(
  owner: NodeEntry,
  address: InstanceAddress,
): DescendantOverride | undefined {
  return owner.descendantOverrides.find(
    (item) =>
      sameIds(item.address.instances, address.instances) &&
      sameIds(item.address.templatePath, address.templatePath),
  );
}
/** The path from a template root to one of its nodes (a walk inside one template). */
function pathInside(
  reader: CatalogReader,
  rootId: TemplateId,
  sought: TemplateId,
): TemplateId[] | undefined {
  if (rootId === sought) return [rootId];
  for (const child of readTemplate(reader, rootId).children) {
    const rest = pathInside(reader, child, sought);
    if (rest) return [rootId, ...rest];
  }
  return undefined;
}
/**
 * The position a nested instance root stands in: the address of the template position that is
 * the nested instance (its instances without the last, its path inside the enclosing template).
 */
function enclosingAddress(
  reader: CatalogReader,
  owner: NodeEntry,
  instances: readonly (NodeId | TemplateId)[],
): InstanceAddress {
  const outer = instances.slice(0, -1);
  const position = instances[instances.length - 1] as TemplateId;
  const scopeDefinition =
    outer.length === 1
      ? owner.definitionId
      : readTemplate(reader, outer[outer.length - 1] as TemplateId)
          .definitionId;
  const root = readDefinition(reader, scopeDefinition).templateRootId;
  const templatePath = root && pathInside(reader, root, position);
  if (!templatePath)
    throw new CatalogValidationError("INSTANCE_POSITION_NOT_FOUND", position);
  return { instances: outer, templatePath };
}

function propLayers(
  reader: CatalogReader,
  target: EditTarget,
  key: string,
): PropLayer[] {
  if (target.kind === "node") {
    const node = reader.getEntry(target.id);
    if (node?.kind !== "node")
      throw new CatalogValidationError("NODE_REQUIRED", target.id);
    const own = node.props[key];
    return [
      ...(own?.kind === "set"
        ? [{ source: "own" as const, value: own.value }]
        : own?.kind === "mask"
          ? [{ source: "own" as const, value: undefined }]
          : []),
      ...definitionChain(reader, node.definitionId, key),
    ];
  }
  const owner = reader.getEntry(target.ownerId);
  if (owner?.kind !== "node")
    throw new CatalogValidationError("NODE_REQUIRED", target.ownerId);
  const { instances, templatePath } = target.address;
  const layers: PropLayer[] = [];
  const patch = overrideAt(owner, target.address);
  const patched = patch?.kind === "patch" ? patch.props?.[key] : undefined;
  if (patched?.kind === "set")
    layers.push({ source: "own", value: patched.value });
  else if (patched?.kind === "mask")
    layers.push({ source: "own", value: undefined });
  // A composite root: the instance's value for it (the owner node, or the enclosing position's
  // own patch and template value) and the enclosing position's display state.
  let enclosingState: TemplateRecord["displayState"];
  if (templatePath.length === 1) {
    if (instances.length === 1) {
      const write = owner.props[key];
      if (write?.kind === "set")
        layers.push({ source: "instance", value: write.value });
    } else {
      const enclosing = enclosingAddress(reader, owner, instances);
      const change = overrideAt(owner, enclosing);
      const write = change?.kind === "patch" ? change.props?.[key] : undefined;
      const position = readTemplate(
        reader,
        enclosing.templatePath[enclosing.templatePath.length - 1],
      );
      enclosingState = position.displayState;
      const value =
        write?.kind === "set"
          ? write.value
          : templateLayer(position.props[key]);
      if (value !== ABSENT && value !== undefined)
        layers.push({ source: "instance", value });
    }
  }
  // The enclosing library template's patch at this path (a nested library instance).
  let libraryPatch: PropLayer | undefined;
  if (instances.length > 1) {
    const step = instances[instances.length - 1];
    if (step.startsWith("lib:")) {
      const value = readTemplate(
        reader,
        step as TemplateId,
      ).descendantPatches?.find((item) =>
        sameIds(item.templatePath, templatePath),
      )?.props?.[key];
      if (value !== undefined)
        libraryPatch = {
          source: "library-patch",
          value: value as AuthoredValue,
        };
    }
  }
  layers.push(
    ...templateChain(
      reader,
      templatePath[templatePath.length - 1],
      key,
      libraryPatch,
      new Set(),
      enclosingState,
    ),
  );
  return layers;
}

/** Where a target's prop value comes from (see the module comment). */
export function readPropSource(
  reader: CatalogReader,
  target: EditTarget,
  key: string,
): PropReading {
  const layers = propLayers(reader, target, key);
  const [first] = layers;
  const ownLayer = first?.source === "own" ? first : undefined;
  const below = ownLayer ? layers[1] : first;
  return {
    value: first?.value,
    ...(first ? { source: first.source } : {}),
    ...(ownLayer
      ? {
          own:
            ownLayer.value === undefined
              ? { kind: "mask" as const }
              : { kind: "set" as const, value: ownLayer.value },
        }
      : {}),
    inherited: {
      value: below?.value,
      ...(below ? { source: below.source } : {}),
    },
    layers,
  };
}

/** A prop value a target shows now (authored, before rules): `readPropSource(...).value`. */
export function readTargetProp(
  reader: CatalogReader,
  target: EditTarget,
  key: string,
): AuthoredValue | undefined {
  return readPropSource(reader, target, key).value;
}

/**
 * The same prop over several targets (multi-selection): one value, or `mixed` with the distinct
 * values in target order.
 */
export function readCommonProp(
  reader: CatalogReader,
  targets: readonly EditTarget[],
  key: string,
):
  | { mixed: false; value: AuthoredValue | undefined }
  | { mixed: true; values: readonly (AuthoredValue | undefined)[] } {
  const values: (AuthoredValue | undefined)[] = [];
  for (const target of targets) {
    const value = readTargetProp(reader, target, key);
    if (!values.some((seen) => JSON.stringify(seen) === JSON.stringify(value)))
      values.push(value);
  }
  return values.length <= 1
    ? { mixed: false, value: values[0] }
    : { mixed: true, values };
}

/**
 * What a target authors itself (a reset removes it): an owned node's own fields, or a template
 * position's path patch. Style panels read it for their "modified" marks; values stay authored
 * writes (the effective value is the resolved record's).
 */
export interface OwnFields {
  props: NodeEntry["props"];
  visual: NodeEntry["visual"];
  layout: NonNullable<NodeEntry["layout"]>;
  sizing: NodeEntry["sizing"];
  fills?: NodeEntry["fills"];
  fillSizing?: NodeEntry["fillSizing"];
  responsive?: NodeEntry["responsive"];
  visibility?: NodeEntry["visibility"];
  enabled?: boolean;
}
export function readOwnFields(
  reader: CatalogReader,
  target: EditTarget,
): OwnFields {
  if (target.kind === "node") {
    const node = reader.getEntry(target.id);
    if (node?.kind !== "node")
      throw new CatalogValidationError("NODE_REQUIRED", target.id);
    return {
      props: node.props,
      visual: node.visual,
      layout: node.layout ?? {},
      sizing: node.sizing,
      ...(node.fills ? { fills: node.fills } : {}),
      ...(node.fillSizing ? { fillSizing: node.fillSizing } : {}),
      ...(node.responsive ? { responsive: node.responsive } : {}),
      ...(node.visibility ? { visibility: node.visibility } : {}),
      ...(node.enabled !== undefined ? { enabled: node.enabled } : {}),
    };
  }
  const owner = reader.getEntry(target.ownerId);
  if (owner?.kind !== "node")
    throw new CatalogValidationError("NODE_REQUIRED", target.ownerId);
  const patch = overrideAt(owner, target.address);
  if (patch?.kind !== "patch")
    return { props: {}, visual: {}, layout: {}, sizing: {} };
  return {
    props: patch.props ?? {},
    visual: patch.visual ?? {},
    layout: patch.layout ?? {},
    sizing: patch.sizing ?? {},
    ...(patch.fills ? { fills: patch.fills } : {}),
    ...(patch.fillSizing ? { fillSizing: patch.fillSizing } : {}),
    ...(patch.responsive ? { responsive: patch.responsive } : {}),
    ...(patch.visibility ? { visibility: patch.visibility } : {}),
    ...(patch.enabled !== undefined ? { enabled: patch.enabled } : {}),
  };
}
