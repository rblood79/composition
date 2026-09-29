import type {
  AuthoredValue,
  CatalogReader,
  DefinitionEntry,
  DefinitionId,
  DefinitionOverrideEntry,
  EntryId,
  LibraryDefinitionId,
  NodeEntry,
  NodeId,
  Scalar,
  StateName,
  WriteValue,
} from "../document/types";
import type { CatalogCommand } from "./compose";
import {
  childList,
  CommandDraft,
  fail,
  locate,
  setChildList,
  topLevel,
} from "./context";
import {
  createMaterializer,
  type NewId,
  type TemplateBindings,
} from "./materialize";
import { removeWithReferrers, subtree } from "./structure";

/**
 * ADR-248 Phase 4b component commands: detach an instance, write a library definition's project
 * defaults, make a component from a node (its template moves to the Components area and an
 * instance stands in its place — user decision 2026-09-30), and dissolve a component.
 */

type AnyDefinition = Pick<
  DefinitionEntry,
  "name" | "mode" | "accepts" | "defaults" | "templateRootId"
>;
function definitionOf(reader: CatalogReader, id: DefinitionId): AnyDefinition {
  const definition = id.startsWith("lib:")
    ? reader.library.definitions.get(id as LibraryDefinitionId)
    : reader.getEntry(id);
  if (!definition || ("kind" in definition && definition.kind !== "definition"))
    return fail("DANGLING_DEFINITION", id);
  return definition as AnyDefinition;
}
function scalarOf(
  reader: CatalogReader,
  value: AuthoredValue | undefined,
): Scalar | undefined {
  if (value === undefined || Array.isArray(value)) return undefined;
  if (typeof value !== "object") return value;
  const tokenId = (value as { tokenId: string }).tokenId;
  const token = tokenId.startsWith("lib:")
    ? reader.library.tokens.get(tokenId as `lib:token:${string}`)
    : reader.getEntry(tokenId);
  return token && "value" in token ? (token.value as Scalar) : undefined;
}

/**
 * The instance becomes the owned copy of its template root, keeping its ID (references and the
 * selection stay valid). Template values, library patches, the instance's overrides and its own
 * authored root values carry over; `{key}` placeholders take the instance's current values.
 */
function detachInto(draft: CommandDraft, id: NodeId, newId: NewId): void {
  const instance = draft.node(id);
  const definition = definitionOf(draft.reader, instance.definitionId);
  if (definition.mode !== "composite" || !definition.templateRootId)
    fail("NOT_AN_INSTANCE", id);
  const bindings: Record<string, Scalar> = {};
  for (const key of Object.keys(definition.accepts)) {
    const write = instance.props[key];
    const value =
      write?.kind === "set"
        ? scalarOf(draft.reader, write.value)
        : scalarOf(draft.reader, definition.defaults[key]);
    if (value !== undefined) bindings[key] = value;
  }
  const materializer = createMaterializer(
    draft,
    id,
    [id],
    newId,
    bindings as TemplateBindings,
  );
  materializer.node([definition.templateRootId!], id);
  const root = draft.node(id);
  const rootAccepts = definitionOf(draft.reader, root.definitionId).accepts;
  // The instance's authored values are its root's (the resolver's instance root layer).
  const props = { ...root.props };
  for (const [key, write] of Object.entries(instance.props))
    if (key in rootAccepts) props[key] = write;
  const {
    kind: _kind,
    id: _id,
    definitionId: _definitionId,
    children: _children,
    props: _props,
    visual,
    sizing,
    layout,
    descendantOverrides: _overrides,
    ...fields
  } = instance;
  draft.write({
    ...root,
    ...fields,
    props,
    visual: { ...root.visual, ...visual },
    sizing: { ...sizing, ...root.sizing },
    ...(root.layout || layout ? { layout: { ...root.layout, ...layout } } : {}),
  });
  materializer.reanchorInteractions();
}

export const detachInstances =
  (input: {
    ids: readonly NodeId[];
    newId: NewId;
    label?: string;
  }): CatalogCommand =>
  (reader) => {
    const draft = new CommandDraft(reader);
    const ids = topLevel(reader, input.ids);
    for (const id of ids) detachInto(draft, id, input.newId);
    return {
      label: input.label ?? "Detach",
      ops: draft.ops(),
      selectAfter: ids,
    };
  };

/**
 * A project default for a library definition (its `definitionOverride`, created on first use):
 * every instance of the definition shows it unless the instance overrides the key.
 */
export const setLibraryDefault =
  (input: {
    definitionId: LibraryDefinitionId;
    scope: "defaults" | "visual" | "stateRules";
    key: string;
    state?: StateName;
    write: WriteValue<AuthoredValue>;
    newId: NewId;
    label?: string;
  }): CatalogCommand =>
  (reader) => {
    if (!reader.library.definitions.has(input.definitionId))
      fail("DANGLING_DEFINITION", input.definitionId);
    const draft = new CommandDraft(reader);
    const project = draft.project();
    let overrideId = project.overrideIds.find((id) => {
      const entry = draft.read(id);
      return (
        entry?.kind === "definitionOverride" &&
        entry.targetId === input.definitionId
      );
    });
    if (!overrideId) {
      overrideId = input.newId("definitionOverride");
      const entry: DefinitionOverrideEntry = {
        kind: "definitionOverride",
        id: overrideId,
        targetId: input.definitionId,
        defaults: {},
        visual: {},
        stateRules: {},
      };
      draft.create(entry);
      draft.write({
        ...project,
        overrideIds: [...project.overrideIds, overrideId],
      });
    }
    return {
      label: input.label ?? "Edit component default",
      ops: [
        ...draft.ops(),
        {
          kind: "patchDefinitionOverride",
          id: overrideId,
          scope: input.scope,
          key: input.key,
          ...(input.state ? { state: input.state } : {}),
          write: input.write,
        },
      ],
    };
  };

/**
 * Make a component from an owned node: a new definition takes the node as its template root
 * (the Components area shows it), and an instance of it takes the node's place. The node's
 * position in its parent (`placement`) stays with the instance.
 */
export const createComponent =
  (input: {
    id: NodeId;
    name: string;
    newId: NewId;
    label?: string;
  }): CatalogCommand =>
  (reader) => {
    const draft = new CommandDraft(reader);
    const node = draft.node(input.id);
    const { parent } = locate(draft, input.id);
    const definitionId = input.newId("definition");
    const definition: DefinitionEntry = {
      kind: "definition",
      id: definitionId,
      name: input.name.trim() || fail("NAME_REQUIRED", input.id),
      mode: "composite",
      accepts: {},
      defaults: {},
      visual: {},
      stateRules: {},
      templateRootId: node.id,
      usage: "component",
    };
    const instance: NodeEntry = {
      kind: "node",
      id: input.newId("node"),
      definitionId,
      children: [],
      props: {},
      visual: {},
      sizing: {},
      descendantOverrides: [],
      ...(node.placement ? { placement: node.placement } : {}),
    };
    const { placement: _placement, ...template } = node;
    draft.create(definition);
    draft.create(instance);
    draft.write(template);
    const project = draft.project();
    draft.write({
      ...project,
      definitionIds: [...project.definitionIds, definitionId],
    });
    setChildList(
      draft,
      parent,
      (childList(draft, parent) ?? []).map((id) =>
        id === input.id ? instance.id : id,
      ),
    );
    return {
      label: input.label ?? "Create component",
      ops: draft.ops(),
      selectAfter: [instance.id],
    };
  };

/**
 * Dissolve a project component: every instance is detached (it keeps what it showed), then the
 * definition and its template are removed.
 */
export const dissolveComponent =
  (input: {
    definitionId: EntryId<"definition">;
    newId: NewId;
    label?: string;
  }): CatalogCommand =>
  (reader) => {
    const draft = new CommandDraft(reader);
    const definition = draft.read(input.definitionId);
    if (definition?.kind !== "definition")
      return fail("DANGLING_DEFINITION", input.definitionId);
    for (const id of reader.instancesOf(input.definitionId))
      detachInto(draft, id as NodeId, input.newId);
    const template = definition.templateRootId
      ? subtree(draft, definition.templateRootId)
      : [];
    removeWithReferrers(draft, [input.definitionId, ...template]);
    const project = draft.project();
    draft.write({
      ...project,
      definitionIds: project.definitionIds.filter(
        (id) => id !== input.definitionId,
      ),
    });
    return { label: input.label ?? "Dissolve component", ops: draft.ops() };
  };
