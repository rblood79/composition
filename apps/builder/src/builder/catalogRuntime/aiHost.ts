import {
  createComponent,
  insertNodes,
  removeTargets,
  setFields,
  setSlotDeclaration,
  setWholeField,
} from "../../../../../packages/shared/src/catalog/commands";
import { frameClipInputToOperation } from "../../../../../packages/shared/src/catalog/transactions/frameClip";
import {
  composeCommands,
  type CatalogCommand,
} from "../../../../../packages/shared/src/catalog/commands/compose";
import { definitionTypeName } from "../../../../../packages/shared/src/catalog/commands/context";
import type {
  EditTarget,
  NodeEntry,
  NodeId,
  NodeParent,
  Scalar,
} from "../../../../../packages/shared/src/catalog/document/types";
import type { InteractionAction } from "@composition/shared";
import type { CatalogPosition } from "../../../../../packages/shared/src/catalog/resolution/positions";
import type { AiReadHost } from "../../services/ai/aiReadHost";
import { catalogPageContentTarget } from "./pageSettings";
import type {
  AiElementWrite,
  AiWriteHost,
} from "../../services/ai/aiWriteHost";
import type { Element } from "../../types/builder/unified.types";
import { FILL_DERIVED_STYLE_PROPS } from "../panels/styles/utils/fillDerivedStyleProps";
import { catalogFillItems, catalogFillLayers } from "./authoredStyle";
import {
  catalogDefinitionPropKeys,
  catalogEditContract,
  catalogSemanticPatchCommand,
} from "./editContract";
import {
  catalogCreationProps,
  catalogPaletteDefinitionId,
} from "./paletteInsert";
import { catalogPlacementStyle } from "./position";
import { catalogFieldsAt } from "./responsiveFields";
import type { CatalogSelectionItem } from "./session";
import {
  catalogInteractionOwner,
  catalogInteractionsCommand,
  catalogInteractionsOf,
  catalogNewInteraction,
  type CatalogInteractionAction,
} from "./interactions";
import {
  catalogVariableIndex,
  catalogVariableUsageCounter,
} from "./dataVariables";
import { catalogSlotDeclaration, type CatalogSlotReader } from "./slots";
import { catalogStyleView, catalogStyleWritesOf } from "./styleFields";
import type { CatalogWorkspace } from "./workspace";

const typeOf = (workspace: CatalogWorkspace, position: CatalogPosition) => {
  try {
    return definitionTypeName(workspace.runtime.graph, position.definitionId);
  } catch {
    return "";
  }
};

const typeOfDefinition = (
  workspace: CatalogWorkspace,
  definitionId: string,
) => {
  try {
    return definitionTypeName(
      workspace.runtime.graph,
      definitionId as Parameters<typeof definitionTypeName>[1],
    );
  } catch {
    return definitionId;
  }
};

/** The drawn font size of a record (a px line height is a ratio to it). */
function fontSizeOf(workspace: CatalogWorkspace, identity: string) {
  const size = workspace.root.domInputs.get(identity)?.visual.fontSize;
  return typeof size === "number" ? size : undefined;
}

/** The project's element rows as the AI's Element shape (ids = record identities). */
function projectElements(workspace: CatalogWorkspace): Element[] {
  const graph = workspace.runtime.graph;
  const project = graph.getEntry(graph.projectId);
  if (project?.kind !== "project") return [];
  const records = workspace.root.domInputs;
  const { breakpoint } = workspace.session.getSnapshot();
  const out: Element[] = [];
  const visit = (
    position: CatalogPosition,
    parentId: string | null,
    pageId: string,
  ) => {
    const node =
      position.target.kind === "node"
        ? graph.getEntry(position.target.id)
        : undefined;
    const own = workspace.readModel.ownFields(position.target);
    const style = {
      ...catalogStyleView(catalogFieldsAt(own, breakpoint), {
        fontSize: fontSizeOf(workspace, position.identity),
      }),
      ...catalogPlacementStyle(own.placement),
    };
    const fills = catalogFillItems(own.fills);
    out.push({
      id: position.identity,
      type: typeOf(workspace, position),
      props: {
        ...(records.get(position.identity)?.props ?? {}),
        ...(Object.keys(style).length ? { style } : {}),
      },
      ...(fills ? { fills: fills as Element["fills"] } : {}),
      parent_id: parentId,
      page_id: pageId,
      ...(node?.kind === "node" && node.name ? { customId: node.name } : {}),
    });
    for (const child of workspace.readModel.childRows(position))
      visit(child, position.identity, pageId);
  };
  for (const pageId of project.pageIds)
    for (const row of workspace.readModel.pageRows(pageId))
      visit(row, null, pageId);
  return out;
}

const PROBE: NodeEntry = {
  kind: "node",
  id: "project:node:__ai_parent_probe__" as NodeId,
  definitionId: "lib:definition:type-frame",
  children: [],
  props: {},
  visual: {},
  sizing: {},
  descendantOverrides: [],
};

const parentOf = (target: EditTarget): NodeParent =>
  target.kind === "node"
    ? { kind: "node", id: target.id }
    : { kind: "descendant", ownerId: target.ownerId, address: target.address };

/** Where a new element goes: the selection, the nearest ancestor that takes a Frame, the body. */
function creationParent(
  workspace: CatalogWorkspace,
): CatalogSelectionItem | undefined {
  const records = workspace.root.domInputs;
  const candidates: CatalogSelectionItem[] = [];
  const [first] = workspace.session.getSnapshot().selection;
  if (first) {
    candidates.push(first);
    for (
      let record = records.get(records.get(first.identity)?.parentId ?? "");
      record;
      record = records.get(record.parentId)
    ) {
      const item = workspace.itemOfRecord(record.id);
      if (!item) break;
      candidates.push(item);
    }
  }
  const { pageId } = workspace.session.getSnapshot();
  const page = pageId && workspace.runtime.graph.getEntry(pageId);
  const body = page && page.kind === "page" ? page.children[0] : undefined;
  const bodyRecord = body && workspace.root.recordsOfSource(body)[0];
  const content =
    body && catalogPageContentTarget(workspace.runtime.graph, body as NodeId);
  if (content && bodyRecord)
    candidates.push({ target: content, identity: bodyRecord });
  return candidates.find((candidate) => {
    try {
      insertNodes({
        parent: parentOf(candidate.target),
        entries: [PROBE],
        rootIds: [PROBE.id],
        newId: workspace.newId,
      })(workspace.runtime.graph);
      return true;
    } catch {
      return false;
    }
  });
}

/**
 * ADR-248 Phase 4e-5: the AI's read host over the open catalog workspace — the element rows of
 * every page (Layers rows; props = the resolved record props), the session page and selection,
 * the Properties edit contract per element, and the creation parent (the selection, or the
 * nearest ancestor that takes a Frame, else the page body — the palette's rule).
 */
export function createCatalogAiReadHost(
  workspace: CatalogWorkspace,
): AiReadHost {
  // One projection per document revision and composition root (a breakpoint switch makes a new
  // root).
  let cache:
    { revision: number; root: object; elements: Element[] } | undefined;
  const documentKey = () =>
    `${workspace.runtime.graph.revision}:${workspace.session.getSnapshot().breakpoint}`;
  const selection = () => workspace.session.getSnapshot().selection;
  return {
    version: () =>
      `${documentKey()}|${workspace.session.getSnapshot().pageId ?? ""}|${selection()
        .map((item) => item.identity)
        .join(",")}`,
    subscribe(listener) {
      const offs = [
        workspace.runtime.subscribeSteps(() => listener()),
        workspace.session.subscribe(listener),
        workspace.subscribeRows(listener),
        workspace.subscribeRoot(listener),
      ];
      return () => offs.forEach((off) => off());
    },
    elements() {
      const revision = workspace.runtime.graph.revision;
      const root = workspace.root;
      if (cache?.revision !== revision || cache.root !== root)
        cache = { revision, root, elements: projectElements(workspace) };
      return cache.elements;
    },
    currentPageId: () => workspace.session.getSnapshot().pageId ?? null,
    selectedIds: () => selection().map((item) => item.identity),
    fields(id) {
      const position = workspace.positionOfRecord(id);
      if (!position) return [];
      try {
        return catalogEditContract(
          workspace.runtime.graph,
          workspace.readModel,
          position.target,
        ).fields;
      } catch {
        return [];
      }
    },
    creationParentId: () => creationParent(workspace)?.identity ?? null,
    pages() {
      const graph = workspace.runtime.graph;
      const project = graph.getEntry(graph.projectId);
      if (project?.kind !== "project") return [];
      return project.pageIds.flatMap((id) => {
        const page = graph.getEntry(id);
        return page?.kind === "page" ? [{ id, title: page.name }] : [];
      });
    },
    interactionRules() {
      const graph = workspace.runtime.graph;
      const project = graph.getEntry(graph.projectId);
      if (project?.kind !== "project") return [];
      return project.interactionIds.flatMap((id) => {
        const rule = graph.getEntry(id);
        if (rule?.kind !== "interaction") return [];
        return [
          {
            id,
            elementId:
              workspace.root.recordsOfSource(rule.ownerId)[0] ?? rule.ownerId,
            trigger: rule.trigger,
            actionKind: rule.action.opcode,
          },
        ];
      });
    },
    variables(projectDefs) {
      const graph = workspace.runtime.graph;
      const usedBy = catalogVariableUsageCounter(graph, projectDefs);
      const pageTitle = (pageId: string) => {
        const page = graph.getEntry(pageId);
        return page?.kind === "page" ? page.name : pageId;
      };
      return [
        ...projectDefs.map((def) => ({
          id: def.id,
          name: def.name,
          type: def.type,
          owner: { kind: "project" as const },
          usedBy: usedBy(def.id),
          ...(def.defaultValue !== undefined
            ? { defaultValue: def.defaultValue }
            : {}),
        })),
        ...catalogVariableIndex(graph).map(
          ({ variable, pageId, ownerLabel }) => {
            const owner = graph.getEntry(variable.ownerId);
            return {
              id: variable.id,
              name: variable.name,
              type: variable.valueType,
              owner:
                ownerLabel === null
                  ? {
                      kind: "page" as const,
                      pageId,
                      pageTitle: pageTitle(pageId),
                    }
                  : {
                      kind: "element" as const,
                      elementId:
                        workspace.root.recordsOfSource(variable.ownerId)[0] ??
                        variable.ownerId,
                      elementType:
                        owner?.kind === "node"
                          ? typeOfDefinition(workspace, owner.definitionId)
                          : variable.ownerId,
                      pageId,
                    },
              usedBy: usedBy(variable.id),
              ...(variable.defaultValue !== undefined
                ? { defaultValue: variable.defaultValue }
                : {}),
            };
          },
        ),
      ];
    },
    projectId: () => workspace.projectId,
  };
}

/** A write's commands on existing (or staged) targets: semantic props, CSS, fills. */
function writeCommands(
  workspace: CatalogWorkspace,
  targets: readonly EditTarget[],
  input: AiElementWrite,
  accepted: ReadonlySet<string>,
  fontSize: number | undefined,
): CatalogCommand[] {
  const commands: CatalogCommand[] = [];
  const props = input.props ?? {};
  const refused = Object.keys(props).filter((key) => !accepted.has(key));
  if (refused.length)
    throw new Error(`PROP_NOT_ACCEPTED: ${refused.join(", ")}`);
  const first = targets[0];
  const propCommand =
    first &&
    catalogSemanticPatchCommand(
      targets,
      props,
      (key) => workspace.readModel.propSource(first, key).value,
    );
  if (propCommand) commands.push(propCommand);
  const styles = Object.fromEntries(
    Object.entries(input.styles ?? {}).filter(
      ([, value]) => typeof value === "string" || typeof value === "number",
    ),
  ) as Record<string, string | number>;
  if (Object.keys(styles).length) {
    const { breakpoint } = workspace.session.getSnapshot();
    commands.push(
      setFields({
        targets,
        ...(breakpoint === "desktop" ? {} : { breakpoint }),
        ...catalogStyleWritesOf(styles, { fontSize }),
        label: "AI: style",
      } as Parameters<typeof setFields>[0]),
    );
  }
  if (input.fills) {
    commands.push(
      setWholeField({
        targets,
        field: "fills",
        value: input.fills.length ? catalogFillLayers(input.fills) : [],
        label: "AI: fill",
      }),
      setFields({
        targets,
        visual: Object.fromEntries(
          FILL_DERIVED_STYLE_PROPS.map((key) => [key, { kind: "remove" }]),
        ),
      }),
    );
  }
  return commands;
}

const acceptedKeys = (workspace: CatalogWorkspace, target: EditTarget) =>
  new Set(
    catalogEditContract(workspace.runtime.graph, workspace.readModel, target)
      .fields.filter((field) => field.kind !== "binding")
      .map((field) => field.key),
  );

/**
 * The canonical first-class fields as commands on an owned node (after its other writes): clip =
 * the Frame's overflow (`frameClipInputToOperation`), slot / placeholder = its slot declaration
 * (a slot only inside a component template — the old recommended component ids have no place in
 * the declaration), reusable = make a component of it (last: an instance takes the node's place;
 * `instance` names it). `reusable: false` is refused (dissolving a component is the Component
 * section's, it detaches every instance).
 */
export function catalogCanonicalCommands(
  workspace: CatalogWorkspace,
  target: EditTarget,
  canonical: AiElementWrite["canonical"],
  name: () => string,
): { commands: CatalogCommand[]; instance: () => NodeId | undefined } {
  let instance: NodeId | undefined;
  const commands: CatalogCommand[] = [];
  const fields = canonical ?? {};
  if (!Object.keys(fields).length)
    return { commands, instance: () => instance };
  if (target.kind !== "node") throw new Error("CANONICAL_NODE_REQUIRED");
  const id = target.id;
  if (fields.reusable === false)
    throw new Error("REUSABLE_FALSE_NOT_SUPPORTED");
  if (fields.clip !== undefined)
    commands.push(() => ({
      label: "AI: clip",
      ops: [frameClipInputToOperation(id, { clip: fields.clip })],
    }));
  if (fields.slot !== undefined || fields.placeholder !== undefined)
    commands.push((reader) => {
      const node = reader.getEntry(id);
      if (node?.kind !== "node") throw new Error(`NODE_REQUIRED: ${id}`);
      let slot = node.slot;
      if (fields.slot === false) slot = undefined;
      else if (fields.slot) {
        if (!catalogSlotDeclaration(reader as CatalogSlotReader, id))
          throw new Error(`SLOT_NOT_DECLARABLE: ${id}`);
        slot = {
          name: node.slot?.name ?? "content",
          required: node.slot?.required ?? false,
        };
      }
      return setSlotDeclaration({
        id,
        slot,
        regions: node.regions,
        placeholder: fields.placeholder ?? node.placeholder,
        label: "AI: slot",
      })(reader);
    });
  if (fields.reusable)
    commands.push(
      createComponent({
        id,
        name: name(),
        newId: (kind) => {
          const next = workspace.newId(kind);
          if (kind === "node" && !instance) instance = next as NodeId;
          return next;
        },
        label: "AI: component",
      }),
    );
  return { commands, instance: () => instance };
}

/** One step of several commands, without moving the user's selection. */
function runSteps(
  workspace: CatalogWorkspace,
  label: string,
  commands: readonly CatalogCommand[],
): void {
  if (!commands.length) return;
  workspace.execute(() => {
    const plan = composeCommands(workspace.runtime.graph, label, commands);
    return { label: plan.label, ops: plan.ops };
  });
}

const failure = (error: unknown) => ({
  ok: false as const,
  error: error instanceof Error ? error.message : String(error),
});

/**
 * ADR-248 Phase 4e-5: the AI's write host over the open catalog workspace — create = the palette
 * definition of the type with its initial props, CSS and fills in one step (under the given
 * element, else where a new element goes); update = the element's props (only the keys its
 * contract offers), CSS at the open breakpoint and fills in one step; remove = one step; a batch
 * joins its steps into one history entry. The user's selection does not move.
 */
export function createCatalogAiWriteHost(
  workspace: CatalogWorkspace,
): AiWriteHost {
  const graph = workspace.runtime.graph;
  const targetOf = (id: string) => workspace.positionOfRecord(id)?.target;
  return {
    create(input) {
      try {
        const parent = input.parentId
          ? workspace.itemOfRecord(input.parentId)
          : creationParent(workspace);
        if (!parent)
          return {
            ok: false,
            error: input.parentId
              ? `PARENT_NOT_FOUND: ${input.parentId}`
              : "NO_PARENT",
          };
        const definitionId = catalogPaletteDefinitionId(
          graph.library,
          input.type,
        );
        const nodeId = workspace.newId("node") as NodeId;
        const entry: NodeEntry = {
          kind: "node",
          id: nodeId,
          definitionId,
          children: [],
          props: {},
          visual: {},
          sizing: {},
          descendantOverrides: [],
        };
        const target: EditTarget = { kind: "node", id: nodeId };
        const accepted = catalogDefinitionPropKeys(graph, definitionId);
        const props = input.props ?? {};
        const refused = Object.keys(props).filter((key) => !accepted.has(key));
        if (refused.length)
          return {
            ok: false,
            error: `PROP_NOT_ACCEPTED: ${refused.join(", ")}`,
          };
        const commands: CatalogCommand[] = [
          insertNodes({
            parent: parentOf(parent.target),
            entries: [
              {
                ...entry,
                props: catalogCreationProps(
                  graph.library,
                  definitionId,
                  input.type,
                  props,
                ),
              },
            ],
            rootIds: [nodeId],
            newId: workspace.newId,
            label: `AI: add ${input.type}`,
          }),
          ...writeCommands(
            workspace,
            [target],
            { styles: input.styles, fills: input.fills },
            accepted,
            undefined,
          ),
        ];
        const canonical = catalogCanonicalCommands(
          workspace,
          target,
          input.canonical,
          () => input.type,
        );
        commands.push(...canonical.commands);
        runSteps(workspace, `AI: add ${input.type}`, commands);
        const elementId = workspace.root.recordsOfSource(
          canonical.instance() ?? nodeId,
        )[0];
        if (!elementId) return { ok: false, error: `NOT_DRAWN: ${nodeId}` };
        return { ok: true, elementId, parentId: parent.identity };
      } catch (error) {
        return failure(error);
      }
    },
    update(id, input) {
      try {
        const target = targetOf(id);
        if (!target) return { ok: false, error: `ELEMENT_NOT_FOUND: ${id}` };
        const fontSize = workspace.root.domInputs.get(id)?.visual.fontSize;
        const canonical = catalogCanonicalCommands(
          workspace,
          target,
          input.canonical,
          () => {
            const node =
              target.kind === "node" ? graph.getEntry(target.id) : undefined;
            return (
              (node?.kind === "node" && node.name) ||
              typeOf(workspace, workspace.positionOfRecord(id)!) ||
              "Component"
            );
          },
        );
        runSteps(workspace, "AI: edit", [
          ...writeCommands(
            workspace,
            [target],
            input,
            acceptedKeys(workspace, target),
            typeof fontSize === "number" ? fontSize : undefined,
          ),
          ...canonical.commands,
        ]);
        const instance = canonical.instance();
        const elementId = instance
          ? workspace.root.recordsOfSource(instance)[0]
          : id;
        if (!elementId) return { ok: false, error: `NOT_DRAWN: ${instance}` };
        return { ok: true, elementId };
      } catch (error) {
        return failure(error);
      }
    },
    remove(id) {
      try {
        const target = targetOf(id);
        if (!target) return { ok: false, error: `ELEMENT_NOT_FOUND: ${id}` };
        runSteps(workspace, "AI: delete", [
          removeTargets({ targets: [target] }),
        ]);
        return { ok: true };
      } catch (error) {
        return failure(error);
      }
    },
    addInteraction(elementId, trigger, action) {
      try {
        const target = targetOf(elementId);
        if (!target)
          return { ok: false, error: `ELEMENT_NOT_FOUND: ${elementId}` };
        const catalogAction = catalogRuleAction(workspace, action);
        if ("error" in catalogAction)
          return { ok: false, error: catalogAction.error };
        const owner = catalogInteractionOwner(target);
        const entry = catalogNewInteraction(
          owner,
          trigger,
          catalogAction.action,
          workspace.newId,
        );
        runSteps(workspace, "AI: interaction", [
          catalogInteractionsCommand(
            owner,
            [...catalogInteractionsOf(graph, owner), entry],
            "AI: interaction",
          ),
        ]);
        return { ok: true, ruleId: entry.id };
      } catch (error) {
        return failure(error);
      }
    },
    async batch(label, run) {
      const before = workspace.runtime.historyDepth.undo;
      try {
        return await run();
      } finally {
        const added = workspace.runtime.historyDepth.undo - before;
        if (added > 1) workspace.mergeHistory(added, label);
      }
    },
  };
}

/** An old rule action (the AI tool's shape) as the catalog interaction action. */
function catalogRuleAction(
  workspace: CatalogWorkspace,
  action: InteractionAction,
): { action: CatalogInteractionAction } | { error: string } {
  const graph = workspace.runtime.graph;
  if (action.kind === "toast")
    return {
      action: {
        opcode: "toast",
        message: String(
          (action.params as { message?: unknown })?.message ?? "",
        ),
      },
    };
  if (action.kind === "navigate") {
    const path = String((action.params as { path?: unknown })?.path ?? "");
    const project = graph.getEntry(graph.projectId);
    const pageId =
      project?.kind === "project"
        ? project.pageIds.find((id) => {
            const page = graph.getEntry(id);
            return page?.kind === "page" && page.route === path;
          })
        : undefined;
    return pageId
      ? { action: { opcode: "navigate", pageId } }
      : { error: `PAGE_NOT_FOUND: ${path}` };
  }
  if (action.kind === "capability") {
    const target = workspace.positionOfRecord(action.targetId)?.target;
    if (target?.kind !== "node")
      return { error: `CAPABILITY_TARGET_NOT_A_NODE: ${action.targetId}` };
    const value = (action.params as { value?: unknown } | undefined)?.value;
    return {
      action: {
        opcode: "capability",
        targetId: target.id,
        capabilityId: action.capability,
        ...(value !== undefined ? { value: value as Scalar } : {}),
      },
    };
  }
  return { error: `UNSUPPORTED_ACTION: ${(action as { kind: string }).kind}` };
}
