/**
 * ADR-296 Decision 1 · breakdown §4a — the project's code view: one edit session over the file
 * tree (baseline = the project's revision), and an Apply of every drafted file at once — one
 * command, one history step, all or nothing (R4):
 *
 * 1. parse every drafted file (a syntax error refuses the Apply);
 * 2. collect the definition files' declarations (`App.tsx` — routes · new pages; Phase 3 adds the
 *    data · API · state files) and plan them first on a stage of the baseline;
 * 3. plan the use files (`pages/*.tsx`) against that stage — a page the same Apply added, a route
 *    it renamed, is there for them (never the baseline reader);
 * 4. compose every step into one command, run at the baseline's revision;
 * 5. run it on a fresh stage and generate every drafted file again: each must be what was written.
 */
import {
  stageOver,
  type CatalogCommand,
} from "../../../../../packages/shared/src/catalog/commands";
import type { NewId } from "../../../../../packages/shared/src/catalog/commands/materialize";
import type { EntryId } from "../../../../../packages/shared/src/catalog/document/types";
import type { CatalogReader } from "../../../../../packages/shared/src/catalog/transactions/transaction";
import {
  codeViewFileTree,
  generateCodeViewFile,
  type CodeViewFileEntry,
} from "../../../../../packages/shared/src/codeView/files/tree";
import { generateCodeView } from "../../../../../packages/shared/src/codeView/generate";
import type { CodeViewChange } from "../../../../../packages/shared/src/codeView/inverse/identity";
import type { CodeViewResult } from "../../../../../packages/shared/src/codeView/types";
import { catalogCodeViewData } from "./codeView";
import { compareAppFile, planCodeViewApp } from "./codeViewApp";
import {
  compareDefinitionFile,
  planCodeViewCollection,
  planCodeViewEndpoint,
  planCodeViewProjectState,
} from "./codeViewData";
import {
  composeSteps,
  planCodeViewPageEdit,
  rejecter,
  type CatalogCodeViewRejection,
} from "./codeViewEdit";

type Data = ReturnType<typeof catalogCodeViewData>;

/** 「코드 고치기」 over the project: the revision the edit started at, and each opened file's code then. */
export interface CatalogCodeViewProjectSession {
  readonly projectId: string;
  readonly revision: number;
  /** path → the file and its code at `revision` (generated when the file was first opened). */
  readonly baselines: Map<
    string,
    { readonly file: CodeViewFileEntry; readonly result: CodeViewResult }
  >;
}

export function catalogCodeViewProjectSession(
  reader: CatalogReader,
): CatalogCodeViewProjectSession {
  return {
    projectId: reader.projectId,
    revision: reader.revision,
    baselines: new Map(),
  };
}

/**
 * A file's code at the session's revision (generated once — opening the tree generates nothing,
 * R5). Undefined when the document moved on (the session is stale) or the file is not in the tree.
 */
export function catalogCodeViewFileBaseline(
  session: CatalogCodeViewProjectSession,
  reader: CatalogReader,
  path: string,
  data: Data = catalogCodeViewData(reader),
): CodeViewResult | undefined {
  const known = session.baselines.get(path);
  if (known) return known.result;
  if (reader.revision !== session.revision) return undefined;
  const file = codeViewFileTree(reader).find((item) => item.path === path);
  if (!file) return undefined;
  const result = generateCodeViewFile({
    reader: reader as never,
    file,
    ...data,
  });
  session.baselines.set(path, { file, result });
  return result;
}

/** One file's draft: its edited code and the editor's changes since its baseline. */
export interface CatalogCodeViewDraft {
  readonly path: string;
  readonly edited: string;
  readonly changes: readonly CodeViewChange[];
}

export type CatalogCodeViewFileRejection = CatalogCodeViewRejection & {
  readonly path: string;
};

export interface CatalogCodeViewProjectPlan {
  readonly command?: CatalogCommand;
  readonly count?: number;
  readonly rejected: readonly CatalogCodeViewFileRejection[];
}

const DEFINITION_KINDS = new Set<CodeViewFileEntry["kind"]>([
  "app",
  "collection",
  "endpoint",
  "state",
]);

/** Plan an Apply of every draft (nothing runs here). */
export function catalogCodeViewProjectPlan(input: {
  reader: CatalogReader;
  session: CatalogCodeViewProjectSession;
  drafts: readonly CatalogCodeViewDraft[];
  newId: NewId;
  /** Read every unit again (the round-trip gate). */
  strict?: boolean;
}): CatalogCodeViewProjectPlan {
  const { reader, session } = input;
  const rejected: CatalogCodeViewFileRejection[] = [];
  /** Each file's refusals (its lines) — a check after planning still reports into its file. */
  const lists = new Map<string, CatalogCodeViewRejection[]>();
  const rejectIn = (path: string, edited: string) => {
    const list = lists.get(path) ?? [];
    lists.set(path, list);
    return { reject: rejecter(edited, list), flush: () => undefined };
  };
  const collected = () => [
    ...rejected,
    ...[...lists].flatMap(([path, list]) =>
      list.map((item) => ({ ...item, path })),
    ),
  ];
  if (reader.revision !== session.revision)
    return {
      rejected: [{ path: "", line: 1, reason: "staleBaseline", text: "" }],
    };
  // (A new data · API file — a path the tree does not have — is a new definition.)
  const created = new Map<string, CodeViewFileEntry>();
  const drafts = input.drafts.filter((draft) => {
    const baseline = session.baselines.get(draft.path);
    const fresh = /^src\/(data|api)\/([A-Za-z_$][\w$]*)\.ts$/.exec(draft.path);
    if (!baseline && fresh) {
      created.set(draft.path, {
        path: draft.path,
        kind: fresh[1] === "data" ? "collection" : "endpoint",
      });
      return true;
    }
    if (!baseline) {
      rejected.push({
        path: draft.path,
        line: 1,
        reason: "staleBaseline",
        text: "",
      });
      return false;
    }
    return input.strict || draft.edited !== baseline.result.code;
  });
  if (rejected.length) return { rejected };
  if (!drafts.length) return { rejected: [] };
  const kindOf = (draft: CatalogCodeViewDraft) =>
    session.baselines.get(draft.path)?.file ?? created.get(draft.path)!;

  // 2 · 3 — definition files first, on a stage; the use files read that stage.
  const stage = stageOver(reader);
  const steps: CatalogCommand[] = [];
  const checks: ((final: CatalogReader) => void)[] = [];
  const ordered = [
    ...drafts.filter((draft) => DEFINITION_KINDS.has(kindOf(draft).kind)),
    ...drafts.filter((draft) => !DEFINITION_KINDS.has(kindOf(draft).kind)),
  ];
  for (const draft of ordered) {
    const file = kindOf(draft);
    const result = session.baselines.get(draft.path)?.result;
    const { reject, flush } = rejectIn(draft.path, draft.edited);
    let planned: readonly CatalogCommand[] = [];
    const fileName =
      /([A-Za-z_$][\w$]*)\.tsx?$/.exec(draft.path)?.[1] ?? "file";
    if (file.kind === "collection" || file.kind === "endpoint") {
      const plan =
        file.kind === "collection"
          ? planCodeViewCollection
          : planCodeViewEndpoint;
      planned = plan({
        reader: stage,
        ...(file.id ? { id: file.id } : {}),
        name: fileName,
        edited: draft.edited,
        reject,
      });
      const id =
        file.id ??
        (file.kind === "collection"
          ? `data:collection:${fileName}`
          : `data:endpoint:${fileName}`);
      const kind = file.kind;
      checks.push((final) =>
        final.getEntry(id)
          ? compareDefinitionFile(final, { kind, id }, draft.edited, reject)
          : reject(0, "notInCode", draft.path),
      );
    } else if (file.kind === "state") {
      planned = planCodeViewProjectState({
        reader: stage,
        baselineNames: result?.symbols.variables ?? {},
        edited: draft.edited,
        reject,
      });
      checks.push((final) =>
        compareDefinitionFile(final, { kind: "state" }, draft.edited, reject),
      );
    } else if (file.kind === "app") {
      planned = planCodeViewApp({
        reader: stage,
        baseline: result!,
        edited: draft.edited,
        newId: input.newId,
        reject,
      }).steps;
      checks.push((final) => compareAppFile(final, draft.edited, reject));
    } else if (file.kind === "page") {
      if (stage.getEntry(file.id!)?.kind !== "page") {
        reject(0, "notInCode", "page removed in App.tsx");
      } else {
        const page = planCodeViewPageEdit(
          {
            reader: stage,
            session: {
              projectId: session.projectId,
              pageId: file.id as EntryId<"page">,
              revision: stage.revision,
              baseline: result!,
            },
            edited: draft.edited,
            changes: draft.changes,
            data: catalogCodeViewData(stage),
            newId: input.newId,
            ...(input.strict ? { strict: true } : {}),
          },
          reject,
        );
        if (page) {
          planned = page.steps;
          checks.push((final) =>
            page.compare(
              generateCodeView({
                reader: final as never,
                pageId: file.id as EntryId<"page">,
                ...catalogCodeViewData(final),
              }).code,
            ),
          );
        }
      }
    } else reject(0, "outsideVocabulary", file.kind);
    // The stage takes this file's commands before the next file plans.
    try {
      for (const step of planned) stage.apply(step(stage).ops);
    } catch (error) {
      reject(
        0,
        "commandRefused",
        error instanceof Error ? error.message : String(error),
      );
    }
    steps.push(...planned);
    flush();
  }
  if (collected().length) return { rejected: collected() };

  // 4 · 5 — one command; run on a fresh stage, every drafted file generated again.
  const command = composeSteps(steps);
  let final: ReturnType<typeof stageOver>;
  try {
    final = stageOver(reader);
    final.apply(command(reader).ops);
  } catch (error) {
    return {
      rejected: [
        {
          path: drafts[0]!.path,
          line: 1,
          reason: "commandRefused",
          text: "",
          detail: error instanceof Error ? error.message : String(error),
        },
      ],
    };
  }
  for (const check of checks) check(final);
  if (collected().length) return { rejected: collected() };
  return steps.length
    ? { command, count: steps.length, rejected: [] }
    : { rejected: [] };
}

/** Apply every draft as one step at the session's revision (a document changed meanwhile refuses it). */
export function catalogCodeViewProjectApply(
  workspace: {
    readonly runtime: {
      readonly graph: CatalogReader & { commandReader: CatalogReader };
    };
    readonly newId: NewId;
    execute(
      command: CatalogCommand,
      options?: { expectedRevision?: number },
    ): unknown;
  },
  session: CatalogCodeViewProjectSession,
  drafts: readonly CatalogCodeViewDraft[],
): {
  applied: boolean;
  count: number;
  rejected: readonly CatalogCodeViewFileRejection[];
} {
  const plan = catalogCodeViewProjectPlan({
    reader: workspace.runtime.graph.commandReader,
    session,
    drafts,
    newId: workspace.newId,
  });
  if (plan.rejected.length)
    return { applied: false, count: 0, rejected: plan.rejected };
  if (!plan.command) return { applied: true, count: 0, rejected: [] };
  try {
    workspace.execute(plan.command, { expectedRevision: session.revision });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return {
      applied: false,
      count: 0,
      rejected: [
        {
          path: drafts[0]?.path ?? "",
          line: 1,
          reason: /REVISION_CONFLICT/.test(message)
            ? "staleBaseline"
            : "commandRefused",
          text: "",
          detail: message,
        },
      ],
    };
  }
  return { applied: true, count: plan.count ?? 0, rejected: [] };
}
