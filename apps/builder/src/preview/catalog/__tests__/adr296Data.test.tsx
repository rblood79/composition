import { afterEach, describe, expect, it, vi } from "vitest";
import {
  addCollection,
  setEndpoint,
  setProjectVariable,
} from "../../../../../../packages/shared/src/catalog/commands/data";
import type {
  CollectionEntry,
  EndpointEntry,
  NodeId,
  ProjectEntry,
  ProjectVariableEntry,
} from "../../../../../../packages/shared/src/catalog/document/types";
import { codeViewFileTree } from "../../../../../../packages/shared/src/codeView/files/tree";
import {
  catalogCodeViewFileBaseline,
  catalogCodeViewProjectApply,
  catalogCodeViewProjectSession,
  type CatalogCodeViewProjectSession,
} from "../../../builder/catalogRuntime/codeViewApply";
import {
  editorChanges,
  openAdr296,
  type Adr296Harness,
} from "./support/adr296Harness";

/**
 * ADR-296 Phase 3 (G1 · G2) — the data definition files: `data/<c>.ts` (fields · settings · rows),
 * `api/<e>.ts` (`endpoint({…})`), `state/project.ts` (사용자 결정 5). Each file pasted over itself
 * plans nothing; an edit is the Data panel's command; a page of the same Apply reads what they
 * declare (a new collection bound, a renamed variable's setter) — one step.
 */
afterEach(() => vi.restoreAllMocks());

const HOME_FILE = "src/pages/Home.tsx";
const STATE = "src/state/project.ts";

function session(h: Adr296Harness) {
  const s = catalogCodeViewProjectSession(h.graph());
  for (const file of codeViewFileTree(h.graph()))
    catalogCodeViewFileBaseline(s, h.graph(), file.path);
  return s;
}
const code = (s: CatalogCodeViewProjectSession, path: string) =>
  s.baselines.get(path)?.result.code ?? "";
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
const entry = <T,>(h: Adr296Harness, id: string) => h.graph().getEntry(id) as T;
const history = (h: Adr296Harness) => h.workspace.runtime.historyDepth.undo;

async function open() {
  vi.spyOn(console, "warn").mockImplementation(() => {});
  const h = await openAdr296();
  h.run(
    addCollection({
      entry: {
        kind: "collection",
        id: "data:collection:users",
        name: "users",
        schema: [
          { id: "u-id", key: "id", type: "string" },
          { id: "u-name", key: "name", type: "string", required: true },
        ],
        mockData: [{ id: "u1", name: "Ann" }],
        useMockData: true,
      } as CollectionEntry,
    }),
  );
  h.run(
    setEndpoint({
      entry: {
        kind: "endpoint",
        id: "data:endpoint:saveOrder",
        name: "saveOrder",
        method: "POST",
        baseUrl: "https://api.example.com",
        path: "/orders",
        headers: [],
        queryParams: [],
        bodyType: "json",
        responseMapping: { dataPath: "" },
        executionMode: "client",
      } as EndpointEntry,
    }),
  );
  h.run(
    setProjectVariable({
      entry: {
        kind: "projectVariable",
        id: "data:variable:cart",
        name: "cart",
        valueType: "number",
        defaultValue: 0,
        persist: true,
      } as ProjectVariableEntry,
    }),
  );
  return h;
}

describe("ADR-296 Phase 3 — data · api · state files", () => {
  it("the files are in the tree and each pasted over itself plans nothing", async () => {
    const h = await open();
    const s = session(h);
    expect(codeViewFileTree(h.graph()).map((file) => file.path)).toEqual([
      "src/App.tsx",
      HOME_FILE,
      "src/data/users.ts",
      "src/api/saveOrder.ts",
      STATE,
    ]);
    expect(code(s, "src/data/users.ts")).toMatch(
      /export default \[\n {2}\{id: 'u1', name: 'Ann'\},\n\] satisfies UsersRow\[\];/,
    );
    expect(code(s, "src/api/saveOrder.ts")).toMatch(
      /export default endpoint\(\{/,
    );
    expect(code(s, STATE)).toMatch(/ {2}cart: 0, \/\/ persist/);
    const before = h.graph().revision;
    const result = catalogCodeViewProjectApply(
      h.workspace,
      s,
      ["src/data/users.ts", "src/api/saveOrder.ts", STATE].map((path) => ({
        path,
        edited: code(s, path),
        changes: [],
      })),
    );
    expect(result.rejected).toEqual([]);
    expect(h.graph().revision).toBe(before);
  });

  it("edits: a row and a field (data), a timeout (api), a start · persist (state) — the Data panel's commands", async () => {
    const h = await open();
    let s = session(h);
    let result = apply(h, s, {
      "src/data/users.ts": (text) =>
        text
          .replace(
            "  {id: 'u1', name: 'Ann'},\n",
            "  {id: 'u1', name: 'Ann'},\n  {id: 'u2', name: 'Bo'},\n",
          )
          .replace(
            "{key: 'name', type: 'string', required: true}",
            "{key: 'name', type: 'string', required: true, label: 'Name'}",
          ),
      "src/api/saveOrder.ts": (text) =>
        text.replace(
          "executionMode: 'client'",
          "executionMode: 'client', timeout: 5000",
        ),
      [STATE]: (text) => text.replace("cart: 0, // persist", "cart: 3,"),
    });
    expect(result.rejected).toEqual([]);
    const users = entry<CollectionEntry>(h, "data:collection:users");
    expect(users.mockData).toHaveLength(2);
    expect(users.schema[1]).toEqual({
      id: "u-name",
      key: "name",
      type: "string",
      required: true,
      label: "Name",
    });
    expect(entry<EndpointEntry>(h, "data:endpoint:saveOrder").timeout).toBe(
      5000,
    );
    expect(entry<ProjectVariableEntry>(h, "data:variable:cart")).toMatchObject({
      defaultValue: 3,
      persist: false,
    });
    // A variable added, the other removed.
    s = session(h);
    result = apply(h, s, {
      [STATE]: (text) => text.replace("  cart: 3,", "  theme: 'light',"),
    });
    expect(result.rejected).toEqual([]);
    const project = h.graph().getEntry(h.graph().projectId) as ProjectEntry;
    expect(
      project.projectVariableIds?.map(
        (id) => entry<ProjectVariableEntry>(h, id).name,
      ),
    ).toEqual(["theme"]);
  });

  it("E8 · E11 — a page's project variable is `useProjectState()`, an endpoint called by name", async () => {
    const h = await open();
    const button = h.add("Button");
    h.rules(button, [
      {
        trigger: "onPress",
        actions: [
          {
            opcode: "setState",
            variableId: "data:variable:cart" as never,
            op: "increment",
            value: 1,
          },
          {
            opcode: "callEndpoint",
            endpointId: "data:endpoint:saveOrder" as never,
          },
        ],
      },
    ]);
    const text = h.code();
    expect(text).toMatch(/let \{cart, setCart\} = useProjectState\(\);/);
    expect(text).toMatch(/setCart\(v => v \+ 1\);/);
    expect(text).toMatch(/await saveOrder\(\);/);
    expect(text).toMatch(/import saveOrder from '\.\/api\/saveOrder';/);
    const result = h.apply(text.replace("v + 1", "v + 2"));
    expect(result.rejected).toEqual([]);
    expect(h.rulesOf(button)[0]!.actions).toEqual([
      {
        opcode: "setState",
        variableId: "data:variable:cart",
        op: "increment",
        value: 2,
      },
      { opcode: "callEndpoint", endpointId: "data:endpoint:saveOrder" },
    ]);
  });

  it("one Apply: a new data file + a list that shows it (the page reads the stage)", async () => {
    const h = await open();
    const s = session(h);
    const before = history(h);
    const teams =
      "export type TeamsRow = {id?: string};\n\nexport const fields = [{key: 'id', type: 'string'}];\n\nexport const settings = {useMockData: true};\n\nexport default [{id: 't1'}] satisfies TeamsRow[];\n";
    const result = catalogCodeViewProjectApply(h.workspace, s, [
      { path: "src/data/teams.ts", edited: teams, changes: [] },
      {
        path: HOME_FILE,
        edited: code(s, HOME_FILE)
          .replace("import {} from", "import {} from")
          .replace(
            "    <>\n    </>",
            "    <>\n      <ListBox items={teams}>\n        {item => <ListBoxItem id={item.id} textValue={String(item.id)}>{item.id}</ListBoxItem>}\n      </ListBox>\n    </>",
          )
          .replace(
            "export default function Home() {",
            "import {ListBox, ListBoxItem} from 'react-aria-components';\nimport teams from './data/teams';\n\nexport default function Home() {",
          ),
        changes: [],
      },
    ]);
    expect(result.rejected).toEqual([]);
    expect(history(h)).toBe(before + 1);
    expect(entry<CollectionEntry>(h, "data:collection:teams").mockData).toEqual(
      [{ id: "t1" }],
    );
    const list = h.node(
      h.node("project:node:home-body" as NodeId).children[0]!,
    );
    expect(list.binding?.collectionId).toBe("data:collection:teams");
  });

  it("one Apply: a project variable renamed in state/project.ts and its setter on a page", async () => {
    const h = await open();
    const button = h.add("Button");
    h.rules(button, [
      {
        trigger: "onPress",
        actions: [
          {
            opcode: "setState",
            variableId: "data:variable:cart" as never,
            op: "set",
            value: 1,
          },
        ],
      },
    ]);
    const s = session(h);
    const result = apply(h, s, {
      [STATE]: (text) => text.replace("cart: 0,", "basket: 0,"),
      [HOME_FILE]: (text) =>
        text
          .replace("let {cart, setCart}", "let {basket, setBasket}")
          .replace("setCart(1)", "setBasket(1)"),
    });
    expect(result.rejected).toEqual([]);
    expect(entry<ProjectVariableEntry>(h, "data:variable:cart").name).toBe(
      "basket",
    );
    expect(h.rulesOf(button)[0]!.actions[0]).toMatchObject({
      variableId: "data:variable:cart",
    });
  });
});
