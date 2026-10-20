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
  StateName,
  WriteValue,
} from "../document/types";
import {
  layoutIsAbsolute,
  positionLayout,
  shiftAbsoluteLayout,
  withoutPositionLayout,
} from "../document/absoluteLayout";
import type { CatalogCommand } from "./compose";
import {
  childList,
  CommandDraft,
  fail,
  locate,
  setChildList,
  topLevel,
} from "./context";
import { detachInto, type NewId } from "./materialize";
import { removeWithReferrers, subtree } from "./structure";

/**
 * ADR-248 Phase 4b component commands: detach an instance, write a library definition's project
 * defaults, make a component from a node (it stays in place as the origin — ADR-260, revising the
 * 2026-09-30 decision), restore a deleted origin, and dissolve a component.
 */

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
 * Make a component from an owned node (ADR-260 — pen.dev · Figma): the node stays where it is as
 * the component's origin, and a new definition references it (`originRef`). Instances placed from
 * the Components tab · the palette · a duplicate of the origin show it.
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
    // An owned node in a place it can stand (not a template root or a replacement).
    locate(draft, input.id);
    if (reader.definitionOfTemplateRoot(input.id))
      return fail("ALREADY_COMPONENT_ORIGIN", input.id);
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
      originRef: true,
    };
    draft.create(definition);
    const project = draft.project();
    draft.write({
      ...project,
      definitionIds: [...project.definitionIds, definitionId],
    });
    return {
      label: input.label ?? "Create component",
      ops: draft.ops(),
      selectAfter: [node.id],
    };
  };

/**
 * Dissolve a project component: every instance is detached (it keeps what it showed), then the
 * definition is removed. An origin in place stays as an ordinary node (ADR-260 Decision 5 —
 * Create ↔ Detach component on the same node); an owned template (an older component, or an
 * origin deleted into a hidden template) goes with the definition.
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
    const template =
      definition.templateRootId && definition.originRef !== true
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

/** How far a restored origin sits from the instance it is restored beside (as a duplicate). */
const RESTORE_OFFSET = 10;
/**
 * Restore a deleted origin (ADR-260 Decision 6 — Figma 「Restore main component」): the hidden
 * template of the instance's definition goes back on the canvas beside that instance (the same
 * parent, the next index; an absolutely placed instance's origin sits 10 px off it), and the
 * definition references it again. Nested origins inside it come back with it.
 */
export const restoreOrigin =
  (input: { instanceId: NodeId; label?: string }): CatalogCommand =>
  (reader) => {
    const draft = new CommandDraft(reader);
    const instance = draft.node(input.instanceId);
    const definition = draft.read(instance.definitionId);
    if (
      definition?.kind !== "definition" ||
      definition.originRef !== false ||
      !definition.templateRootId
    )
      return fail("ORIGIN_NOT_HIDDEN", instance.definitionId);
    const { parent, index } = locate(draft, input.instanceId);
    const root = draft.node(definition.templateRootId);
    // ADR-275: the restored origin takes the instance's position (its authored absolute layout
    // keys), shifted; its own position keys go.
    const base = layoutIsAbsolute(root.layout)
      ? withoutPositionLayout(root.layout!)
      : (root.layout ?? {});
    const layout = layoutIsAbsolute(instance.layout)
      ? {
          ...base,
          ...shiftAbsoluteLayout(
            positionLayout(instance.layout!),
            RESTORE_OFFSET,
            RESTORE_OFFSET,
          ),
        }
      : base;
    const { layout: _layout, ...rest } = root;
    draft.write({ ...definition, originRef: true });
    draft.write(Object.keys(layout).length ? { ...rest, layout } : rest);
    const list = [...(childList(draft, parent) ?? [])];
    list.splice(index + 1, 0, root.id);
    setChildList(draft, parent, list);
    return {
      label: input.label ?? "Restore origin",
      ops: draft.ops(),
      selectAfter: [root.id],
    };
  };
