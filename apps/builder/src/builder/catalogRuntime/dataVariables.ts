import { collectPropsStateRefs } from "@composition/shared";
import {
  addRecord,
  setNodeInteractions,
} from "../../../../../packages/shared/src/catalog/commands";
import {
  composeCommands,
  type CatalogCommand,
} from "../../../../../packages/shared/src/catalog/commands/compose";
import { definitionTypeName } from "../../../../../packages/shared/src/catalog/commands/context";
import type { NewId } from "../../../../../packages/shared/src/catalog/commands/materialize";
import type { CatalogGraph } from "../../../../../packages/shared/src/catalog/document/graph";
import type {
  EntryId,
  InteractionEntry,
  NodeId,
  Scalar,
  StateVariableEntry,
} from "../../../../../packages/shared/src/catalog/document/types";
import {
  catalogVariableNameConflict,
  catalogVisibleVariableEntries,
  type CatalogVariableReader,
} from "./stateVariables";

/**
 * ADR-248 Phase 4e-4e: the Data panel's variable views over the catalog document — the page and
 * element variables (`stateVariable` records) by page, how many places use a variable (its setState
 * rules and `{$name}` templates that resolve to it), the page and element names project variables
 * may not take, and moving a legacy page-scoped data-store variable onto its page.
 */

const PROJECT_VARIABLE = "data:variable:";
export const catalogProjectVariableId = (id: string) =>
  `${PROJECT_VARIABLE}${id}` as `data:variable:${string}`;

export interface CatalogVariableIndexEntry {
  variable: StateVariableEntry;
  /** The page the owner is on. */
  pageId: string;
  /** Null for a page's own variable; the owner node's name (or type) otherwise. */
  ownerLabel: string | null;
}

function pageOf(graph: CatalogVariableReader, id: string): string | undefined {
  for (let at: string | undefined = id; at; at = graph.ownerOf(at))
    if (graph.getEntry(at)?.kind === "page") return at;
  return undefined;
}

/** Page and element variables, each with its page (project order). */
export function catalogVariableIndex(
  graph: CatalogVariableReader,
): CatalogVariableIndexEntry[] {
  const project = graph.getEntry(graph.projectId);
  if (project?.kind !== "project") return [];
  return project.stateVariableIds.flatMap((id): CatalogVariableIndexEntry[] => {
    const variable = graph.getEntry(id);
    if (variable?.kind !== "stateVariable") return [];
    const owner = graph.getEntry(variable.ownerId);
    if (owner?.kind === "page")
      return [{ variable, pageId: owner.id, ownerLabel: null }];
    if (owner?.kind !== "node") return [];
    const pageId = pageOf(graph, owner.id);
    if (!pageId) return [];
    let type = "";
    try {
      type = definitionTypeName(graph, owner.definitionId);
    } catch {
      type = owner.id;
    }
    return [{ variable, pageId, ownerLabel: owner.name || type }];
  });
}

/** Every page and element variable name (project variables may not reuse them — ADR-214 HC5). */
export function catalogDocumentVariableNames(
  graph: CatalogVariableReader,
): Set<string> {
  return new Set(
    catalogVariableIndex(graph).map((entry) => entry.variable.name.trim()),
  );
}

/** Every node on the project's pages (owned children and instance fill children). */
function everyNode(graph: CatalogVariableReader): NodeId[] {
  const project = graph.getEntry(graph.projectId);
  if (project?.kind !== "project") return [];
  const out: NodeId[] = [];
  const visit = (id: NodeId) => {
    const node = graph.getEntry(id);
    if (node?.kind !== "node") return;
    out.push(id);
    node.children.forEach(visit);
    for (const item of node.descendantOverrides)
      if (item.kind === "fillSlot") item.childIds.forEach(visit);
  };
  for (const pageId of project.pageIds) {
    const page = graph.getEntry(pageId);
    if (page?.kind === "page") page.children.forEach(visit);
  }
  return out;
}

/**
 * How many places use a variable (a page/element variable id, or a project variable's data-store
 * id): setState rules that set it, and nodes whose `{$name}` templates resolve to it (the nearest
 * visible page/element variable of that name wins over a project variable).
 */
export function catalogVariableUsageCounter(
  graph: CatalogVariableReader,
  projectVariables: readonly { id: string; name: string }[],
): (variableId: string) => number {
  const project = graph.getEntry(graph.projectId);
  const interactions =
    project?.kind === "project"
      ? project.interactionIds.flatMap((id) => {
          const entry = graph.getEntry(id);
          return entry?.kind === "interaction" ? [entry] : [];
        })
      : [];
  // The template names each node reads, found once.
  const refs = everyNode(graph).flatMap((id) => {
    const node = graph.getEntry(id);
    if (node?.kind !== "node") return [];
    const props: Record<string, unknown> = {};
    for (const [key, write] of Object.entries(node.props))
      if (write.kind === "set") props[key] = write.value;
    const names = collectPropsStateRefs(props);
    return names.length ? [{ id, names }] : [];
  });
  const counts = new Map<string, number>();
  return (variableId) => {
    const cached = counts.get(variableId);
    if (cached !== undefined) return cached;
    const variable = graph.getEntry(variableId);
    const projectVariable = projectVariables.find(
      (item) => item.id === variableId,
    );
    const name =
      variable?.kind === "stateVariable"
        ? variable.name
        : projectVariable?.name;
    const ids = new Set([variableId, catalogProjectVariableId(variableId)]);
    let count = interactions.filter(
      (entry: InteractionEntry) =>
        entry.action.opcode === "setState" && ids.has(entry.action.variableId),
    ).length;
    if (name)
      for (const ref of refs) {
        if (!ref.names.includes(name)) continue;
        const nearest = catalogVisibleVariableEntries(graph, ref.id).find(
          (entry) => entry.name === name,
        );
        const resolved = nearest?.id ?? projectVariable?.id;
        if (resolved === variableId) count++;
      }
    counts.set(variableId, count);
    return count;
  };
}

export interface LegacyPageVariable {
  id: string;
  name: string;
  type: string;
  defaultValue?: unknown;
  pageId: string;
}

/**
 * Move a legacy page-scoped data-store variable onto its page (the document part of one history
 * entry — the caller removes the data-store definition as its outside effect): a page variable of
 * the same name and value, and the setState rules that set the old id now set the page variable.
 * Refused when the name is taken on the page's chain or the type has no page variable form.
 */
export function catalogLegacyVariableMove(
  graph: CatalogGraph,
  variable: LegacyPageVariable,
  newId: NewId,
):
  | { command: CatalogCommand; variableId: EntryId<"stateVariable"> }
  | { refused: "conflict" | "type" | "page" } {
  const page = graph.getEntry(variable.pageId);
  if (page?.kind !== "page") return { refused: "page" };
  if (!["string", "number", "boolean"].includes(variable.type))
    return { refused: "type" };
  if (catalogVariableNameConflict(graph, page.id, variable.name))
    return { refused: "conflict" };
  const type = variable.type as StateVariableEntry["valueType"];
  const empty: Scalar = type === "number" ? 0 : type === "boolean" ? false : "";
  const id = newId("stateVariable") as EntryId<"stateVariable">;
  const entry: StateVariableEntry = {
    kind: "stateVariable",
    id,
    ownerId: page.id,
    name: variable.name,
    valueType: type,
    defaultValue:
      typeof variable.defaultValue === type
        ? (variable.defaultValue as Scalar)
        : empty,
  };
  const oldId = catalogProjectVariableId(variable.id);
  const project = graph.getEntry(graph.projectId);
  const rules =
    project?.kind === "project"
      ? project.interactionIds.flatMap((ruleId) => {
          const rule = graph.getEntry(ruleId);
          return rule?.kind === "interaction" &&
            rule.action.opcode === "setState" &&
            rule.action.variableId === oldId
            ? [rule]
            : [];
        })
      : [];
  const owners = new Map<string, InteractionEntry[]>();
  for (const rule of rules) {
    const key = `${rule.ownerId}|${JSON.stringify(rule.address ?? null)}`;
    owners.set(key, [...(owners.get(key) ?? []), rule]);
  }
  const commands: CatalogCommand[] = [
    addRecord({ entry, label: "Move variable to page" }),
  ];
  for (const group of owners.values()) {
    const first = group[0]!;
    const all = [...graph.referrersOf(first.ownerId)].flatMap((ruleId) => {
      const rule = graph.getEntry(ruleId);
      return rule?.kind === "interaction" &&
        rule.ownerId === first.ownerId &&
        JSON.stringify(rule.address ?? null) ===
          JSON.stringify(first.address ?? null)
        ? [rule]
        : [];
    });
    commands.push(
      setNodeInteractions({
        ownerId: first.ownerId,
        ...(first.address ? { address: first.address } : {}),
        entries: all.map((rule) =>
          rule.action.opcode === "setState" && rule.action.variableId === oldId
            ? { ...rule, action: { ...rule.action, variableId: id } }
            : rule,
        ),
      }),
    );
  }
  return {
    variableId: id,
    command:
      commands.length > 1
        ? () => composeCommands(graph, "Move variable to page", commands)
        : commands[0]!,
  };
}
