/**
 * ADR-285 Decision 7 — the code view's snippets: one authoring action = one piece of code. A
 * snippet is the Data panel's own action (「검색 추가」 · 「라디오로 거르기」 · 「정렬 따라가기」 ·
 * 「결과 수 표시」 · an endpoint list's search = its request parameter) run on the edit's document
 * (the session's baseline with the draft's plan staged) and generated again as code: the editor
 * takes that code, and applying it makes the document the action makes (the same commands — the
 * equivalence test). Nothing runs on the document here; a draft that does not apply has no snippet.
 * The actions come from `codeViewActions` (their module registers them — importing it from this
 * lazy chunk split it out of the Builder's main chunk, +2.5 KB initial).
 */
import { stageOver } from "../../../../../packages/shared/src/catalog/commands";
import type { NewId } from "../../../../../packages/shared/src/catalog/commands/materialize";
import { definitionTypeName } from "../../../../../packages/shared/src/catalog/commands/context";
import type { CatalogReader } from "../../../../../packages/shared/src/catalog/transactions/transaction";
import type {
  EntryId,
  NodeEntry,
  NodeId,
} from "../../../../../packages/shared/src/catalog/document/types";
import { generateCodeView } from "../../../../../packages/shared/src/codeView/generate";
import type { CodeViewChange } from "../../../../../packages/shared/src/codeView/inverse/identity";
import type { catalogCodeViewData } from "./codeView";
import {
  catalogCodeViewPlan,
  type CatalogCodeViewSession,
} from "./codeViewEdit";
import { codeViewActions } from "./codeViewActions";
import type { CatalogFilterField } from "./viewAuthoring";

type Data = ReturnType<typeof catalogCodeViewData>;

export type CatalogCodeViewSnippetKind =
  "search" | "radio" | "sortFollow" | "resultCount" | "requestParam";

export interface CatalogCodeViewSnippet {
  readonly id: string;
  readonly kind: CatalogCodeViewSnippetKind;
  readonly listId: NodeId;
  /** The list's data (its code name) · the field the action reads. */
  readonly collection: string;
  readonly field?: CatalogFilterField;
}

/** A data table as the Data panel reads it (rows for a radio's values). */
export interface CatalogCodeViewTable {
  readonly id: string;
  readonly name: string;
  readonly schema?: readonly {
    id?: string;
    key: string;
    type?: string;
  }[];
  readonly mockData?: readonly unknown[];
  readonly runtimeData?: readonly unknown[];
  readonly useMockData?: boolean;
}

/** The words the actions write (the Data panel's — its language). */
export interface CatalogCodeViewSnippetText {
  readonly allLabel: string;
  readonly countText: string;
  readonly viewName: (list: string) => string;
}

const COLLECTION = "data:collection:";
const TEXT_TYPES = new Set(["string", "text", undefined]);

/** The snippets a page offers: per bound list, its actions (one per text field for a filter). */
export function catalogCodeViewSnippets(
  reader: CatalogReader,
  pageId: EntryId<"page">,
  tables: readonly CatalogCodeViewTable[],
  data: Data,
): CatalogCodeViewSnippet[] {
  const page = reader.getEntry(pageId);
  if (page?.kind !== "page") return [];
  const out: CatalogCodeViewSnippet[] = [];
  const visit = (id: string) => {
    const node = reader.getEntry(id) as NodeEntry | undefined;
    if (node?.kind !== "node") return;
    node.children.forEach(visit);
    const binding = node.binding;
    if (!binding || binding.key !== undefined) return;
    const type = definitionTypeName(reader, node.definitionId);
    if (type === "Text") return;
    const bare = binding.collectionId.replace(COLLECTION, "");
    const table = tables.find((item) => item.id === bare);
    const collection = data.collections.find((item) => item.id === bare);
    if (!table || !collection) return;
    const served =
      !!collection.endpoint?.querySerialization &&
      collection.endpoint.querySerialization.kind !== "none";
    // (The table's own text fields — as the Data panel lists them.)
    const fields: CatalogFilterField[] = (table.schema ?? [])
      .filter(
        (field) =>
          !!field.id && TEXT_TYPES.has(field.type) && field.key !== "id",
      )
      .map((field) => ({
        id: field.id!,
        key: field.key,
        ...(field.type ? { type: field.type } : {}),
      }));
    const base = { listId: node.id as NodeId, collection: collection.name };
    for (const field of fields) {
      out.push({
        ...base,
        id: `${served ? "requestParam" : "search"}:${node.id}:${field.id}`,
        kind: served ? "requestParam" : "search",
        field,
      });
      if (!served)
        out.push({
          ...base,
          id: `radio:${node.id}:${field.id}`,
          kind: "radio",
          field,
        });
    }
    if (type === "Table")
      out.push({ ...base, id: `sortFollow:${node.id}`, kind: "sortFollow" });
    out.push({ ...base, id: `resultCount:${node.id}`, kind: "resultCount" });
  };
  page.children.forEach(visit);
  return out;
}

/**
 * The code after a snippet: the draft planned (its edits staged — a draft that does not apply has
 * no snippet), the action run on that document, and the page's code generated from it.
 */
export async function catalogCodeViewSnippetCode(input: {
  /** The document graph (its stage reads the library forks); commands read `commandReader`. */
  readonly graph: CatalogReader & { readonly commandReader: CatalogReader };
  readonly session: CatalogCodeViewSession;
  readonly edited: string;
  readonly changes: readonly CodeViewChange[];
  readonly data: Data;
  readonly tables: readonly CatalogCodeViewTable[];
  readonly newId: NewId;
  readonly snippet: CatalogCodeViewSnippet;
  readonly text: CatalogCodeViewSnippetText;
}): Promise<string | undefined> {
  const actions = codeViewActions();
  if (!actions) return undefined;
  const {
    catalogFieldValues,
    catalogFilterCommand,
    catalogResultCountCommand,
    catalogSortFollowCommand,
  } = actions;
  const { session, snippet } = input;
  const reader = input.graph.commandReader;
  const plan = catalogCodeViewPlan({
    reader,
    session,
    edited: input.edited,
    changes: input.changes,
    data: input.data,
    newId: input.newId,
  });
  if (plan.rejected.length) return undefined;
  const stage = stageOver(input.graph);
  if (plan.command) stage.apply(plan.command(reader).ops);
  if (stage.getEntry(snippet.listId)?.kind !== "node") return undefined;
  const graph = stage as never;
  try {
    const command = (() => {
      switch (snippet.kind) {
        case "search":
        case "requestParam":
        case "radio": {
          const field = snippet.field!;
          const bare = (
            stage.getEntry(snippet.listId) as NodeEntry
          ).binding!.collectionId.replace(COLLECTION, "");
          const table = input.tables.find((item) => item.id === bare);
          const rows =
            (table?.useMockData ? table.mockData : table?.runtimeData) ?? [];
          return catalogFilterCommand(
            graph,
            {
              listId: snippet.listId,
              field,
              kind: (snippet.kind === "radio"
                ? "RadioGroup"
                : "SearchField") as never,
              control: { insert: true },
              values: catalogFieldValues(rows, field),
              allLabel: input.text.allLabel,
            },
            input.newId,
          ).command;
        }
        case "sortFollow":
          return catalogSortFollowCommand(
            graph,
            { tableId: snippet.listId, followerIds: [] },
            input.newId,
          ).command;
        case "resultCount":
          return catalogResultCountCommand(
            graph,
            {
              listId: snippet.listId,
              viewName: input.text.viewName(snippet.collection),
              text: input.text.countText,
            },
            input.newId,
          ).command;
      }
    })();
    stage.apply(command(stage).ops);
  } catch {
    return undefined;
  }
  return generateCodeView({
    reader: stage,
    pageId: session.pageId,
    ...input.data,
  }).code;
}
