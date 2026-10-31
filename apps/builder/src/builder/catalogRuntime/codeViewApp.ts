/**
 * ADR-296 Phase 2 (Decision 6) — an edit of `src/App.tsx` as the document's commands: a route added
 * (a new page — `createPage`, its body), removed (`removePage`), its path · parent changed
 * (`updatePage`), renamed (an element of a new name at a removed page's path — `updatePage` name),
 * the routes' walk reordered (`reorderPages`), a page moved into · out of a layout route
 * (`applyLayout`), the toast region's placement (`setToastPlacement`) and the theme
 * (`setActiveTheme`). No new command. The planner reads the stage it is given (definition files
 * plan first — Decision 1); the check is the regenerated file, which must be what was written.
 */
import {
  applyLayout,
  createPage,
  removePage,
  reorderPages,
  setActiveTheme,
  setToastPlacement,
  stageOver,
  updatePage,
  type CatalogCommand,
} from "../../../../../packages/shared/src/catalog/commands";
import type {
  CatalogToastPlacement,
  EntryId,
  NodeEntry,
  NodeId,
  PageEntry,
  ProjectEntry,
} from "../../../../../packages/shared/src/catalog/document/types";
import { CATALOG_TOAST_PLACEMENTS } from "../../../../../packages/shared/src/catalog/document/types";
import type { NewId } from "../../../../../packages/shared/src/catalog/commands/materialize";
import type { CatalogReader } from "../../../../../packages/shared/src/catalog/transactions/transaction";
import {
  codeViewRouteOrder,
  codeViewRoutes,
  generateAppFile,
} from "../../../../../packages/shared/src/codeView/files/app";
import { codeViewPageLayout } from "../../../../../packages/shared/src/codeView/files/names";
import {
  parseAppFile,
  type CodeViewAppRoute,
} from "../../../../../packages/shared/src/codeView/inverse/app";
import {
  codeViewLineAt,
  codeViewNormalized,
} from "../../../../../packages/shared/src/codeView/inverse/parse";
import type { CodeViewResult } from "../../../../../packages/shared/src/codeView/types";

type Reason =
  "unparsable" | "outsideVocabulary" | "unknownReference" | "notInCode";
type Reject = (from: number, reason: Reason, detail?: string) => void;

const BODY_DEFINITION = "lib:definition:type-body";

export interface CodeViewAppPlan {
  /** The commands, in order (each plans against the stage the previous ones made). */
  readonly steps: readonly CatalogCommand[];
  /** The new pages' code names → ids (the pages files of this Apply can name them). */
  readonly pages: ReadonlyMap<string, string>;
}

/** Plan an edit of `App.tsx` against `reader` (the Apply's stage). */
export function planCodeViewApp(input: {
  reader: CatalogReader;
  baseline: CodeViewResult;
  edited: string;
  newId: NewId;
  reject: Reject;
}): CodeViewAppPlan {
  const { reader, baseline, edited, reject } = input;
  const steps: CatalogCommand[] = [];
  const created = new Map<string, string>();
  const parsed = parseAppFile(edited);
  for (const problem of parsed.problems)
    reject(problem.from, problem.reason as Reason);
  if (parsed.problems.length || !parsed.routes) {
    if (!parsed.routes) reject(0, "outsideVocabulary", "createBrowserRouter");
    return { steps, pages: created };
  }
  const symbols = baseline.symbols;
  const pageIdOf = new Map(Object.entries(symbols.pages ?? {}));
  const layoutIdOf = new Map(Object.entries(symbols.layouts ?? {}));
  const imported = new Set(
    parsed.imports
      .filter((item) => item.name && item.module === `./pages/${item.name}`)
      .map((item) => item.name!),
  );
  const project = reader.getEntry(reader.projectId) as ProjectEntry;
  const pageOf = (id: string) => reader.getEntry(id) as PageEntry | undefined;

  // The routes, flattened with their parent page and layout.
  interface Read {
    route: CodeViewAppRoute;
    path: string;
    parentId?: string;
    layoutId?: string;
  }
  const reads: Read[] = [];
  const walk = (
    routes: readonly CodeViewAppRoute[],
    parentId: string | undefined,
    layoutId: string | undefined,
  ) => {
    for (const route of routes) {
      if (route.path === undefined) {
        const layout = layoutIdOf.get(route.element);
        if (!layout || layoutId) {
          reject(
            route.from,
            layout ? "outsideVocabulary" : "unknownReference",
            route.element,
          );
          continue;
        }
        walk(route.children, parentId, layout);
        continue;
      }
      reads.push({ route, path: route.path, parentId: undefined, layoutId });
      const index = reads.length - 1;
      reads[index]!.parentId = parentId;
      walk(route.children, `@${index}`, undefined);
    }
  };
  walk(parsed.routes, undefined, undefined);

  // Identity: the element's name; an unknown name at a removed page's path is that page renamed.
  const ids: (string | undefined)[] = reads.map((read) =>
    pageIdOf.get(read.route.element),
  );
  const kept = new Set(ids.filter(Boolean));
  const removed = project.pageIds.filter((id) => !kept.has(id));
  ids.forEach((id, index) => {
    if (id) return;
    const read = reads[index]!;
    const same = removed.find((pageId) => pageOf(pageId)?.route === read.path);
    if (same) {
      ids[index] = same;
      removed.splice(removed.indexOf(same), 1);
    }
  });
  const seen = new Set<string>();
  ids.forEach((id, index) => {
    if (!id) return;
    if (seen.has(id))
      reject(
        reads[index]!.route.from,
        "outsideVocabulary",
        reads[index]!.route.element,
      );
    seen.add(id);
  });
  // New pages (an element of a new name with its import).
  ids.forEach((id, index) => {
    if (id) return;
    const read = reads[index]!;
    if (!imported.has(read.route.element)) {
      reject(read.route.from, "unknownReference", read.route.element);
      return;
    }
    const pageId = input.newId("page");
    ids[index] = pageId;
    created.set(read.route.element, pageId);
    const bodyId = input.newId("node") as NodeId;
    steps.push(
      createPage({
        page: {
          kind: "page",
          id: pageId as EntryId<"page">,
          route: read.path,
          name: read.route.element,
          children: [bodyId],
        },
        entries: [
          {
            kind: "node",
            id: bodyId,
            definitionId: BODY_DEFINITION,
            children: [],
            props: {},
            visual: {},
            sizing: {},
            descendantOverrides: [],
          } as NodeEntry,
        ],
        label: "Add page",
      }),
    );
  });
  if (ids.some((id) => !id)) return { steps, pages: created };
  const parentOf = (read: Read) =>
    read.parentId?.startsWith("@")
      ? ids[Number(read.parentId.slice(1))]
      : read.parentId;
  // Removed pages.
  for (const id of removed)
    steps.push(removePage({ id: id as EntryId<"page"> }));
  // Path · parent · name of the pages that stay.
  reads.forEach((read, index) => {
    const id = ids[index]!;
    if (
      created.has(read.route.element) &&
      created.get(read.route.element) === id
    ) {
      const parentId = parentOf(read);
      if (parentId)
        steps.push(
          updatePage({
            id: id as EntryId<"page">,
            fields: { parentId: parentId as EntryId<"page"> },
          }),
        );
      return;
    }
    const page = pageOf(id)!;
    const fields: Parameters<typeof updatePage>[0]["fields"] = {};
    if (page.route !== read.path) fields.route = read.path;
    const parentId = parentOf(read);
    if ((page.parentId ?? undefined) !== parentId)
      fields.parentId = parentId as EntryId<"page"> | undefined;
    if (pageIdOf.get(read.route.element) !== id)
      fields.name = read.route.element;
    if (Object.keys(fields).length)
      steps.push(updatePage({ id: id as EntryId<"page">, fields }));
  });
  // Layouts, then the walk's order (planned on the stage the steps above make).
  steps.push((stageReader) => {
    const stage = stageOver(stageReader);
    const ops: ReturnType<CatalogCommand>["ops"][number][] = [];
    reads.forEach((read, index) => {
      const id = ids[index]! as EntryId<"page">;
      const page = stage.getEntry(id) as PageEntry;
      const now = codeViewPageLayout(stage, page);
      if (now === read.layoutId) return;
      const plan = applyLayout({
        pageId: id,
        definitionId: read.layoutId as EntryId<"definition"> | undefined,
        newId: input.newId,
      })(stage);
      stage.apply(plan.ops);
      ops.push(...plan.ops);
    });
    const order = ids as string[];
    if (
      JSON.stringify(codeViewRouteOrder(codeViewRoutes(stage))) !==
      JSON.stringify(order)
    ) {
      const plan = reorderPages({ ids: order as EntryId<"page">[] })(stage);
      stage.apply(plan.ops);
      ops.push(...plan.ops);
    }
    return { label: "Routes", ops };
  });
  // The toast region · the theme.
  const placement = parsed.toast?.placement;
  if (!parsed.toast)
    reject(parsed.routesFrom, "outsideVocabulary", "ToastContainer");
  else if (
    placement !== undefined &&
    !CATALOG_TOAST_PLACEMENTS.includes(placement as CatalogToastPlacement)
  )
    reject(parsed.toast.from, "outsideVocabulary", placement);
  else if (placement !== project.toastPlacement)
    steps.push(
      setToastPlacement({
        placement: placement as CatalogToastPlacement | undefined,
      }),
    );
  if (parsed.theme) {
    const themeId = symbols.themes?.[parsed.theme.name];
    if (!themeId)
      reject(parsed.theme.from, "unknownReference", parsed.theme.name);
    else if (themeId !== project.activeThemeId)
      steps.push(setActiveTheme({ id: themeId as EntryId<"theme"> }));
  } else if (project.activeThemeId)
    reject(parsed.routesFrom, "notInCode", "Theme");
  return { steps, pages: created };
}

/** The check: `App.tsx` of the staged document is what the edit wrote (the first differing line). */
export function compareAppFile(
  reader: CatalogReader,
  edited: string,
  reject: Reject,
): void {
  const regenerated = generateAppFile({ reader }).code;
  if (codeViewNormalized(regenerated) === codeViewNormalized(edited)) return;
  // (The imports are derived — a set: the pages' order moves them.)
  const imports = (code: string) =>
    code
      .split("\n")
      .filter((line) => line.startsWith("import "))
      .map((line) => codeViewNormalized(line))
      .sort();
  const body = (code: string) =>
    code.split("\n").filter((line) => !line.startsWith("import "));
  const sameImports =
    JSON.stringify(imports(edited)) === JSON.stringify(imports(regenerated));
  if (
    sameImports &&
    codeViewNormalized(body(edited).join("\n")) ===
      codeViewNormalized(body(regenerated).join("\n"))
  )
    return;
  const a = sameImports ? body(edited) : edited.split("\n");
  const b = sameImports ? body(regenerated) : regenerated.split("\n");
  const index = a.findIndex(
    (line, i) => codeViewNormalized(line) !== codeViewNormalized(b[i] ?? ""),
  );
  const line = index < 0 ? a.length : index + 1;
  // (Back to the edited file's own line — the body lines skip the imports.)
  const full = edited.split("\n");
  const at = Math.max(
    0,
    full.indexOf(a[line - 1] ?? "", sameImports ? 0 : line - 1),
  );
  let offset = 0;
  for (let i = 0; i < at; i += 1) offset += full[i]!.length + 1;
  reject(offset, "notInCode", b[line - 1]?.trim());
  void codeViewLineAt;
}
