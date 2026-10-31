import "fake-indexeddb/auto";
import { CatalogGraph } from "../../../../../../../packages/shared/src/catalog/document/graph";
import { buildCodeCatalogLibrary } from "../../../../../../../packages/shared/src/catalog/document/codeCatalogLibrary";
import type {
  AuthoredValue,
  CatalogLibrary,
  EntryId,
  InteractionEntry,
  NodeEntry,
  NodeId,
  StateVariableEntry,
} from "../../../../../../../packages/shared/src/catalog/document/types";
import {
  addRecord,
  insertNodes,
  setFields,
  type CatalogCommand,
} from "../../../../../../../packages/shared/src/catalog/commands";
import { setNodeInteractions } from "../../../../../../../packages/shared/src/catalog/commands/project";
import { NullLayoutEngine } from "../../../../builder/catalogRuntime/nullLayoutEngine";
import { newCatalogProjectDocument } from "../../../../builder/catalogRuntime/project";
import { CatalogStorage } from "../../../../builder/catalogRuntime/storage";
import { catalogThemeState } from "../../../../builder/catalogRuntime/theme";
import { CatalogWorkspace } from "../../../../builder/catalogRuntime/workspace";
import {
  catalogCreationProps,
  catalogPaletteDefinitionId,
} from "../../../../builder/catalogRuntime/paletteInsert";
import {
  catalogCodeView,
  catalogCodeViewData,
} from "../../../../builder/catalogRuntime/codeView";
import {
  catalogCodeViewApply,
  catalogCodeViewSession,
} from "../../../../builder/catalogRuntime/codeViewEdit";
import type {
  CodeViewCollection,
  CodeViewEndpoint,
} from "../../../../../../../packages/shared/src/codeView/types";

/**
 * ADR-296 — a Builder workspace (no Preview) for the code view: nodes from the palette, rules and
 * variables through the panels' commands, the page's code, and an edit applied as the panel does
 * (a session at the current revision, the whole text replaced).
 */
export const HOME = "project:page:home" as EntryId<"page">;
export const BODY = "project:node:home-body" as NodeId;

let library: CatalogLibrary | undefined;

export async function openAdr296(
  data: {
    collections?: readonly CodeViewCollection[];
    endpoints?: readonly CodeViewEndpoint[];
  } = {},
) {
  library ??= await buildCodeCatalogLibrary();
  const workspace = new CatalogWorkspace(
    new CatalogGraph(
      newCatalogProjectDocument({
        projectId: "project:project:adr296" as EntryId<"project">,
        name: "ADR-296",
      }),
      library,
    ),
    new CatalogStorage(indexedDB, `adr296-${Math.random()}`),
    {
      engine: new NullLayoutEngine(),
      viewport: { width: 1000, height: 800 },
      autosaveSchedule: () => {},
      theme: catalogThemeState,
    },
  );
  const graph = () => workspace.runtime.graph;
  const run = (command: CatalogCommand) => workspace.execute(command);
  /** The data the code reads: given, else the document's (ADR-286 — the data is the document's). */
  const given =
    data.collections || data.endpoints
      ? {
          collections: [...(data.collections ?? [])],
          endpoints: [...(data.endpoints ?? [])],
        }
      : undefined;
  const dataOf = () => given ?? catalogCodeViewData(graph());
  let count = 0;
  /** A palette item (with its creation props) under `parent` (the page body by default). */
  const add = (
    type: string,
    props: Record<string, AuthoredValue> = {},
    parent: NodeId = BODY,
    name?: string,
  ) => {
    const definitionId = catalogPaletteDefinitionId(library!, type);
    const id = `project:node:${type.toLowerCase()}-${(count += 1)}` as NodeId;
    run(
      insertNodes({
        parent: { kind: "node", id: parent },
        entries: [
          {
            kind: "node",
            id,
            definitionId,
            ...(name ? { name } : {}),
            children: [],
            props: catalogCreationProps(library!, definitionId, type, props),
            visual: {},
            sizing: {},
            descendantOverrides: [],
          } as NodeEntry,
        ],
        rootIds: [id],
        newId: workspace.newId,
      }),
    );
    return id;
  };
  const declare = (id: NodeId, props: Record<string, AuthoredValue>) =>
    run(
      setFields({
        targets: [{ kind: "node", id }],
        props: Object.fromEntries(
          Object.entries(props).map(([key, value]) => [
            key,
            { kind: "set" as const, value },
          ]),
        ),
        label: "Edit properties",
      }),
    );
  /** The rules on an owner (`address` — an instance position), replaced by `rules`. */
  const rules = (
    ownerId: NodeId,
    list: readonly {
      trigger: string;
      actions: InteractionEntry["actions"];
      id?: string;
    }[],
    address?: InteractionEntry["address"],
  ) => {
    const entries = list.map(
      (item) =>
        ({
          kind: "interaction",
          id: (item.id ??
            workspace.newId("interaction")) as EntryId<"interaction">,
          ownerId,
          ...(address ? { address } : {}),
          trigger: item.trigger,
          actions: item.actions,
        }) as InteractionEntry,
    );
    run(
      setNodeInteractions({
        ownerId,
        ...(address ? { address } : {}),
        entries,
        label: "Rules",
      }),
    );
    return entries.map((entry) => entry.id);
  };
  const variable = (
    name: string,
    valueType: StateVariableEntry["valueType"],
    defaultValue: StateVariableEntry["defaultValue"],
    ownerId: StateVariableEntry["ownerId"] = HOME,
  ) => {
    const entry = {
      kind: "stateVariable",
      id: `project:stateVariable:${name}`,
      ownerId,
      name,
      valueType,
      defaultValue,
    } as StateVariableEntry;
    run(addRecord({ entry }));
    return entry.id;
  };
  const code = () => catalogCodeView(graph(), HOME, dataOf())!.code;
  /** The panel's Apply: a session now, the whole text replaced by `edited`. */
  const apply = (edited: string) => {
    const codeData = dataOf();
    const session = catalogCodeViewSession(graph(), HOME, codeData)!;
    const before = session.baseline.code;
    return catalogCodeViewApply(
      workspace,
      session,
      edited,
      editorChanges(before, edited),
      codeData,
    );
  };
  const rulesOf = (ownerId: string) => {
    const project = graph().getEntry(graph().projectId);
    return project?.kind === "project"
      ? project.interactionIds
          .map((id) => graph().getEntry(id) as InteractionEntry)
          .filter((rule) => rule.ownerId === ownerId)
      : [];
  };
  const node = (id: string) => graph().getEntry(id) as NodeEntry;
  return {
    workspace,
    library: library!,
    graph,
    run,
    add,
    declare,
    rules,
    variable,
    code,
    apply,
    rulesOf,
    node,
    dataOf,
  };
}

export type Adr296Harness = Awaited<ReturnType<typeof openAdr296>>;

/** The edit as the editor hands it: the changed middle (common prefix · suffix kept). */
export function minimalChange(before: string, after: string) {
  let start = 0;
  while (
    start < before.length &&
    start < after.length &&
    before[start] === after[start]
  )
    start += 1;
  let end = 0;
  while (
    end < before.length - start &&
    end < after.length - start &&
    before[before.length - 1 - end] === after[after.length - 1 - end]
  )
    end += 1;
  return {
    fromA: start,
    toA: before.length - end,
    insert: after.slice(start, after.length - end),
  };
}

/**
 * The edit as an editor makes it: one change per changed line run (a line diff — LCS over lines),
 * each narrowed to its changed middle. Typing in two places is two changes, not one wide one.
 */
export function editorChanges(before: string, after: string) {
  const a = before.split("\n");
  const b = after.split("\n");
  const n = a.length;
  const m = b.length;
  const lcs: number[][] = Array.from({ length: n + 1 }, () =>
    new Array<number>(m + 1).fill(0),
  );
  for (let i = n - 1; i >= 0; i -= 1)
    for (let j = m - 1; j >= 0; j -= 1)
      lcs[i]![j] =
        a[i] === b[j]
          ? lcs[i + 1]![j + 1]! + 1
          : Math.max(lcs[i + 1]![j]!, lcs[i]![j + 1]!);
  const offsetA: number[] = [0];
  for (const line of a) offsetA.push(offsetA.at(-1)! + line.length + 1);
  const changes: { fromA: number; toA: number; insert: string }[] = [];
  let i = 0;
  let j = 0;
  while (i < n || j < m) {
    if (i < n && j < m && a[i] === b[j]) {
      i += 1;
      j += 1;
      continue;
    }
    const startI = i;
    const startJ = j;
    while (
      (i < n || j < m) &&
      !(
        i < n &&
        j < m &&
        a[i] === b[j] &&
        lcs[i]![j] === lcs[i + 1]![j + 1]! + 1
      )
    ) {
      if (j < m && (i >= n || lcs[i]![j + 1]! >= lcs[i + 1]![j]!)) j += 1;
      else i += 1;
    }
    const fromA = offsetA[startI]!;
    const toA = Math.min(offsetA[i]!, before.length);
    const insert = b
      .slice(startJ, j)
      .map((line) => `${line}\n`)
      .join("");
    const old = before.slice(fromA, toA);
    const fixed =
      toA === before.length && !before.endsWith("\n") && insert.endsWith("\n")
        ? insert.slice(0, -1)
        : insert;
    const narrow = minimalChange(old, fixed);
    changes.push({
      fromA: fromA + narrow.fromA,
      toA: fromA + narrow.toA,
      insert: narrow.insert,
    });
  }
  return changes;
}

/** Replace the first `from` in `code` (throws when it is not there — the case is wrong then). */
export function edit(code: string, from: string, to: string): string {
  if (!code.includes(from))
    throw new Error(`not in the code: ${from}\n${code}`);
  return code.replace(from, to);
}
