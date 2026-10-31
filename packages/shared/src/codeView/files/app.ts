/**
 * ADR-296 Phase 2 (Decision 6) — `src/App.tsx`: the project's routes as the reference apps write
 * them (`createBrowserRouter([{path, element, children}])`) — the pages in their order, a child page
 * under its parent, the pages of a layout under a layout route (`element: <Layout />`, no path) —
 * the app's toast region (`<ToastContainer placement>`, S2) and its active theme (`<Theme name>`).
 *
 * The routes are the pages' order in a depth-first walk: the generator writes `pageIds` so (a child
 * after its parent; a layout's run of pages together), and the reader reorders the pages only when
 * the code's walk differs from the one the document gives.
 */
import type {
  CatalogReader,
  EntryId,
  PageEntry,
  ProjectEntry,
  ThemeEntry,
} from "../../catalog/document/types";
import { CODE_VIEW_HELPERS_MODULE } from "../generate";
import type { CodeViewResult } from "../types";
import { CodeWriter } from "../writer";
import { codeViewPageLayout, codeViewProjectNames } from "./names";

type Reader = Pick<CatalogReader, "projectId" | "getEntry">;

/** The S2 module the App's toast region comes from (text in the code — never imported here). */
const S2_MODULE = "@react-spectrum/s2";

const literal = (value: string) =>
  `'${value.replace(/\\/g, "\\\\").replace(/'/g, "\\'")}'`;

/** The route tree the App writes (pages in `pageIds` order, children under their parent). */
export interface CodeViewRoute {
  /** A page route; absent = a layout route (`element` only). */
  readonly pageId?: EntryId<"page">;
  readonly layoutId?: EntryId<"definition">;
  readonly children: CodeViewRoute[];
}

/** The routes of the document (the shape `App.tsx` shows). */
export function codeViewRoutes(reader: Reader): CodeViewRoute[] {
  const project = reader.getEntry(reader.projectId) as ProjectEntry;
  const pages = project.pageIds
    .map((id) => reader.getEntry(id) as PageEntry | undefined)
    .filter((page): page is PageEntry => page?.kind === "page");
  const ids = new Set(pages.map((page) => page.id));
  /** A level's pages as routes: a layout's consecutive run under its layout route. */
  const level = (members: readonly PageEntry[]): CodeViewRoute[] => {
    const out: CodeViewRoute[] = [];
    for (const page of members) {
      const layoutId = codeViewPageLayout(reader, page);
      const route: CodeViewRoute = {
        pageId: page.id,
        children: level(pages.filter((child) => child.parentId === page.id)),
      };
      const last = out.at(-1);
      if (layoutId && last && !last.pageId && last.layoutId === layoutId)
        last.children.push(route);
      else if (layoutId) out.push({ layoutId, children: [route] });
      else out.push(route);
    }
    return out;
  };
  return level(
    pages.filter((page) => !page.parentId || !ids.has(page.parentId)),
  );
}

/** The page ids in the routes' depth-first order. */
export function codeViewRouteOrder(routes: readonly CodeViewRoute[]): string[] {
  return routes.flatMap((route) => [
    ...(route.pageId ? [route.pageId] : []),
    ...codeViewRouteOrder(route.children),
  ]);
}

export function generateAppFile(input: { reader: Reader }): CodeViewResult {
  const { reader } = input;
  const project = reader.getEntry(reader.projectId) as ProjectEntry;
  const names = codeViewProjectNames(reader);
  const routes = codeViewRoutes(reader);
  const theme = project.activeThemeId
    ? (reader.getEntry(project.activeThemeId) as ThemeEntry | undefined)
    : undefined;
  const out = new CodeWriter();
  out.anchorLine(
    "import {createBrowserRouter, RouterProvider} from 'react-router';",
    { kind: "derived", key: "import:react-router" },
  );
  out.anchorLine(`import {ToastContainer} from '${S2_MODULE}';`, {
    kind: "derived",
    key: "import:@react-spectrum/s2",
  });
  if (theme)
    out.anchorLine(`import {Theme} from '${CODE_VIEW_HELPERS_MODULE}';`, {
      kind: "derived",
      key: `import:${CODE_VIEW_HELPERS_MODULE}`,
    });
  for (const [layoutId, name] of names.layouts)
    if (JSON.stringify(routes).includes(`"layoutId":"${layoutId}"`))
      out.anchorLine(`import ${name} from './components/${name}';`, {
        kind: "derived",
        key: `import:layout:${layoutId}`,
      });
  for (const [pageId, name] of names.pages)
    out.anchorLine(`import ${name} from './pages/${name}';`, {
      kind: "derived",
      key: `import:page:${pageId}`,
    });
  out.line();
  out.line("const router = createBrowserRouter([");
  out.in();
  const write = (route: CodeViewRoute) => {
    out.start();
    const from = out.length;
    if (route.pageId) {
      const page = reader.getEntry(route.pageId) as PageEntry;
      out.write(
        `{path: ${literal(page.route)}, element: <${names.pages.get(route.pageId)} />`,
      );
    } else out.write(`{element: <${names.layouts.get(route.layoutId!)} />`);
    if (route.children.length) {
      out.write(", children: [").end().in();
      route.children.forEach(write);
      out.out().start().write("]");
    }
    out.write("},");
    if (route.pageId) out.anchor(from, { kind: "route", pageId: route.pageId });
    else
      out.anchor(from, {
        kind: "derived",
        key: `layoutRoute:${route.layoutId}`,
      });
    out.end();
  };
  routes.forEach(write);
  out.out();
  out.line("]);");
  out.line();
  out.line("export default function App() {");
  out.in().line("return (").in();
  if (theme) {
    out.start();
    const from = out.length;
    out.write(`<Theme name=${JSON.stringify(theme.name)}>`);
    out.anchor(from, { kind: "derived", key: "theme" }).end().in();
  } else out.line("<>").in();
  out.start();
  const toastFrom = out.length;
  out.write(
    project.toastPlacement
      ? `<ToastContainer placement=${JSON.stringify(project.toastPlacement)} />`
      : "<ToastContainer />",
  );
  out.anchor(toastFrom, { kind: "derived", key: "toasts" }).end();
  out.line("<RouterProvider router={router} />");
  out.out().line(theme ? "</Theme>" : "</>");
  out.out().line(");").out().line("}");
  const themes: Record<string, string> = {};
  for (const id of project.themeIds) {
    const entry = reader.getEntry(id) as ThemeEntry | undefined;
    if (entry?.kind === "theme") themes[entry.name] = id;
  }
  return {
    ...out.done(),
    symbols: {
      variables: {},
      fields: {},
      pages: Object.fromEntries(
        [...names.pages].map(([id, name]) => [name, id]),
      ),
      layouts: Object.fromEntries(
        [...names.layouts].map(([id, name]) => [name, id]),
      ),
      themes,
    },
  };
}
