import { afterEach, describe, expect, it, vi } from "vitest";
import {
  createPage,
  setFields,
} from "../../../../../../packages/shared/src/catalog/commands";
import type {
  EntryId,
  NodeId,
  PageEntry,
  ProjectEntry,
} from "../../../../../../packages/shared/src/catalog/document/types";
import { codeViewFileTree } from "../../../../../../packages/shared/src/codeView/files/tree";
import {
  catalogCodeViewFileBaseline,
  catalogCodeViewProjectApply,
  catalogCodeViewProjectSession,
  type CatalogCodeViewProjectSession,
} from "../../../builder/catalogRuntime/codeViewApply";
import { catalogPaletteDefinitionId } from "../../../builder/catalogRuntime/paletteInsert";
import {
  BODY,
  editorChanges,
  openAdr296,
  type Adr296Harness,
} from "./support/adr296Harness";

/**
 * ADR-296 G2 (R4 · h3) — the project's Apply: several files at once in one step. A file reads what
 * another file of the same Apply declares (a new page's route, navigated to from a page); one file
 * refused = nothing applied; a document changed since the session = nothing applied, drafts kept.
 * `App.tsx` edits are the page commands (add · remove · path · parent · name · order · toast ·
 * theme).
 */
afterEach(() => vi.restoreAllMocks());

const APP = "src/App.tsx";
const HOME_FILE = "src/pages/Home.tsx";

async function open() {
  vi.spyOn(console, "warn").mockImplementation(() => {});
  const h = await openAdr296();
  const button = h.add("Button");
  return { h, button };
}

function session(h: Adr296Harness) {
  const s = catalogCodeViewProjectSession(h.graph());
  for (const file of codeViewFileTree(h.graph()))
    catalogCodeViewFileBaseline(s, h.graph(), file.path);
  return s;
}
const code = (s: CatalogCodeViewProjectSession, path: string) =>
  s.baselines.get(path)!.result.code;
function apply(
  h: Adr296Harness,
  s: CatalogCodeViewProjectSession,
  edits: Record<string, (code: string) => string>,
) {
  return catalogCodeViewProjectApply(
    h.workspace,
    s,
    Object.entries(edits).map(([path, edit]) => {
      const before = code(s, path);
      const edited = edit(before);
      return { path, edited, changes: editorChanges(before, edited) };
    }),
  );
}
const project = (h: Adr296Harness) =>
  h.graph().getEntry(h.graph().projectId) as ProjectEntry;
const pages = (h: Adr296Harness) =>
  project(h).pageIds.map((id) => h.graph().getEntry(id) as PageEntry);
const history = (h: Adr296Harness) => h.workspace.runtime.historyDepth.undo;

function addPage(
  h: Adr296Harness,
  name: string,
  route: string,
  parentId?: string,
) {
  const id = `project:page:${name.toLowerCase()}` as EntryId<"page">;
  const body = `project:node:${name.toLowerCase()}-body` as NodeId;
  h.run(
    createPage({
      page: {
        kind: "page",
        id,
        route,
        name,
        children: [body],
        ...(parentId ? { parentId: parentId as EntryId<"page"> } : {}),
      },
      entries: [
        {
          kind: "node",
          id: body,
          definitionId: "lib:definition:type-body",
          children: [],
          props: {},
          visual: {},
          sizing: {},
          descendantOverrides: [],
        },
      ],
    }),
  );
  return id;
}

describe("ADR-296 G2 — App.tsx and the project Apply", () => {
  it("App.tsx is the routes in order, the toast region and the theme", async () => {
    const { h } = await open();
    addPage(h, "About", "/about");
    const s = session(h);
    expect(code(s, APP)).toMatch(
      /const router = createBrowserRouter\(\[\n {2}\{path: '\/', element: <Home \/>\},\n {2}\{path: '\/about', element: <About \/>\},\n\]\);/,
    );
    expect(code(s, APP)).toMatch(/<ToastContainer \/>/);
    // (The tree names the files without generating them — R5.)
    expect(codeViewFileTree(h.graph()).map((file) => file.path)).toEqual([
      APP,
      HOME_FILE,
      "src/pages/About.tsx",
      "src/state/project.ts",
    ]);
  });

  it("a new route + a page that navigates to it, in one Apply (h3: the page reads the stage)", async () => {
    const { h, button } = await open();
    const s = session(h);
    const before = history(h);
    const result = apply(h, s, {
      [APP]: (text) =>
        text
          .replace(
            "import Home from './pages/Home';",
            "import Home from './pages/Home';\nimport Contact from './pages/Contact';",
          )
          .replace(
            "  {path: '/', element: <Home />},",
            "  {path: '/', element: <Home />},\n  {path: '/contact', element: <Contact />},",
          ),
      [HOME_FILE]: (text) =>
        text
          .replace(
            "<Button />",
            "<Button onPress={() => {\n        navigate('/contact');\n      }} />",
          )
          .replace(
            "export default function Home() {",
            "export default function Home() {\n  let navigate = useNavigate();",
          )
          .replace(
            "import {Button} from 'react-aria-components';",
            "import {Button} from 'react-aria-components';\nimport {useNavigate} from 'react-router';",
          ),
    });
    expect(result.rejected).toEqual([]);
    expect(history(h)).toBe(before + 1);
    const contact = pages(h).find((page) => page.route === "/contact")!;
    expect(contact.name).toBe("Contact");
    expect(h.rulesOf(button)[0]!.actions).toEqual([
      { opcode: "navigate", pageId: contact.id },
    ]);
  });

  it("remove · rename · path · parent · order · toast placement — each one Apply, one history step", async () => {
    const { h } = await open();
    addPage(h, "About", "/about");
    addPage(h, "Team", "/team");
    let s = session(h);
    let before = history(h);
    // Path + parent: Team under About at /about/team.
    let result = apply(h, s, {
      [APP]: (text) =>
        text.replace(
          "  {path: '/about', element: <About />},\n  {path: '/team', element: <Team />},",
          "  {path: '/about', element: <About />, children: [\n    {path: '/about/team', element: <Team />},\n  ]},",
        ),
    });
    expect(result.rejected).toEqual([]);
    expect(history(h)).toBe(before + 1);
    const team = pages(h).find((page) => page.name === "Team")!;
    expect(team).toMatchObject({
      route: "/about/team",
      parentId: "project:page:about",
    });
    // Order: About before Home.
    s = session(h);
    before = history(h);
    result = apply(h, s, {
      [APP]: (text) => {
        const home = "  {path: '/', element: <Home />},\n";
        return text.replace(home, "").replace("  ]},\n", `  ]},\n${home}`);
      },
    });
    expect(result.rejected).toEqual([]);
    expect(pages(h).map((page) => page.name)).toEqual([
      "About",
      "Team",
      "Home",
    ]);
    expect(history(h)).toBe(before + 1);
    // Rename (a new element name at the same path) + toast placement.
    s = session(h);
    result = apply(h, s, {
      [APP]: (text) =>
        text
          .replace(
            "import About from './pages/About';",
            "import Company from './pages/Company';",
          )
          .replace("element: <About />", "element: <Company />")
          .replace("<ToastContainer />", '<ToastContainer placement="top" />'),
    });
    expect(result.rejected).toEqual([]);
    expect(pages(h).map((page) => page.name)).toEqual([
      "Company",
      "Team",
      "Home",
    ]);
    expect(project(h).toastPlacement).toBe("top");
    // Remove a route: the page goes.
    s = session(h);
    result = apply(h, s, {
      [APP]: (text) =>
        text
          .replace("import Team from './pages/Team';\n", "")
          .replace(
            ", children: [\n    {path: '/about/team', element: <Team />},\n  ]",
            "",
          ),
    });
    expect(result.rejected).toEqual([]);
    expect(pages(h).map((page) => page.name)).toEqual(["Company", "Home"]);
  });

  it("all or nothing: one refused file applies nothing; a document changed since the session applies nothing", async () => {
    const { h } = await open();
    addPage(h, "About", "/about");
    const s = session(h);
    const revision = h.graph().revision;
    const result = apply(h, s, {
      [APP]: (text) => text.replace("path: '/about'", "path: '/company'"),
      [HOME_FILE]: (text) =>
        text.replace("<Button />", "<Button onPress={whatever} />"),
    });
    expect(result.applied).toBe(false);
    expect(result.rejected.map((line) => line.path)).toContain(HOME_FILE);
    expect(h.graph().revision).toBe(revision);
    expect(pages(h).map((page) => page.route)).toEqual(["/", "/about"]);
    // Another change (the Properties panel) after the session: the Apply is stale.
    h.run(
      setFields({
        targets: [{ kind: "node", id: h.node(BODY).children[0]! as NodeId }],
        props: { isDisabled: { kind: "set", value: true } },
        label: "Panel",
      }),
    );
    const stale = apply(h, s, {
      [APP]: (text) => text.replace("path: '/about'", "path: '/company'"),
    });
    expect(stale.rejected.map((line) => line.reason)).toEqual([
      "staleBaseline",
    ]);
    expect(pages(h).map((page) => page.route)).toEqual(["/", "/about"]);
  });

  it("strict: every file pasted over itself plans nothing", async () => {
    const { h } = await open();
    addPage(h, "About", "/about");
    addPage(h, "Team", "/about/team", "project:page:about");
    const s = session(h);
    const before = h.graph().revision;
    const result = apply(h, s, {
      [APP]: (text) => text,
      [HOME_FILE]: (text) => text,
    });
    expect(result.rejected).toEqual([]);
    expect(h.graph().revision).toBe(before);
    void catalogPaletteDefinitionId;
  });
});
