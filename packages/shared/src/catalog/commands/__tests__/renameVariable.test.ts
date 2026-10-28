import { describe, expect, it } from "vitest";
import type {
  CollectionEntry,
  DataCollectionId,
  EndpointEntry,
  NodeEntry,
  ProjectVariableEntry,
  StateVariableEntry,
} from "../../document/types";
import { setDataEntries } from "../data";
import { setFields, setWholeField } from "../fields";
import { renameVariable } from "../variables";
import {
  variableReferenceCount,
  variableReferenceSites,
} from "../../runtime/variableReferences";
import { PAGE, code, graphOf, node, run, snapshot, undo } from "./fixture";

/**
 * ADR-288 G1 — `renameVariable` renames the entry and rewrites the `{{ old }}` the runtime
 * resolved to it, per field: a prop reads the element chain (node → ancestors → page → project),
 * a `binding.key` the page and the project, an endpoint the project only. Other variables' readers,
 * `\{{` literals, `{{ env.x }}` and a route-only `{{ params.x }}` stay. A taken or capturing name
 * is refused and the document does not change. One step — one undo.
 */
const TEXT = "lib:definition:text" as NodeEntry["definitionId"];
const SECTION = "lib:definition:section" as NodeEntry["definitionId"];
const text = (id: string, value: string, patch: Partial<NodeEntry> = {}) =>
  node(id, TEXT, { props: { children: { kind: "set", value } }, ...patch });
const stateVariable = (
  id: string,
  ownerId: string,
  name: string,
  defaultValue = "",
): StateVariableEntry => ({
  kind: "stateVariable",
  id: `project:stateVariable:${id}` as StateVariableEntry["id"],
  ownerId: ownerId as StateVariableEntry["ownerId"],
  name,
  valueType: "string",
  defaultValue,
});
const projectVariable = (
  id: string,
  name: string,
  valueType: ProjectVariableEntry["valueType"] = "string",
  defaultValue: unknown = "",
): ProjectVariableEntry => ({
  kind: "projectVariable",
  id: `data:variable:${id}` as ProjectVariableEntry["id"],
  name,
  valueType,
  defaultValue,
  persist: false,
});
const COLLECTION = "data:collection:c1" as DataCollectionId;
const collection: CollectionEntry = {
  kind: "collection",
  id: COLLECTION,
  name: "Users",
  schema: [],
  mockData: [],
  useMockData: true,
};
const endpoint = (path: string, query = "{{ a }}"): EndpointEntry => ({
  kind: "endpoint",
  id: "data:endpoint:e1" as EndpointEntry["id"],
  name: "users",
  method: "GET",
  baseUrl: "https://api.example.com",
  path,
  headers: [{ key: "X-Token", value: "{{ a }}", enabled: true }],
  queryParams: [{ key: "q", value: query, type: "string", required: false }],
  bodyType: "none",
  responseMapping: { dataPath: "" },
  executionMode: "client",
});
const propOf = (graph: ReturnType<typeof graphOf>, id: string) => {
  const entry = graph.getEntry(`project:node:${id}`) as NodeEntry;
  const write = entry.props.children;
  return write?.kind === "set" ? write.value : write;
};
const nodeOf = (graph: ReturnType<typeof graphOf>, id: string) =>
  graph.getEntry(`project:node:${id}`) as NodeEntry;

describe("ADR-288 renameVariable", () => {
  it("a project variable: prop · binding.key · endpoint follow; literals · env · other names stay; one undo", () => {
    const graph = graphOf(
      [
        text("t1", "Hi {{ a }} and {{ a.first }}"),
        text("t2", "\\{{ a }} {{ env.a }} {{ b }}"),
        node("list", SECTION),
      ],
      ["t1", "t2", "list"],
    );
    run(
      graph,
      setDataEntries({
        puts: [
          projectVariable("a", "a"),
          collection,
          endpoint("/users/{{ a }}"),
        ],
      }),
    );
    run(
      graph,
      setWholeField({
        targets: [{ kind: "node", id: nodeOf(graph, "list").id }],
        field: "binding",
        value: { collectionId: COLLECTION, fieldMap: {}, key: "{{ a }}" },
      }),
    );
    const before = snapshot(graph);
    expect(variableReferenceCount(graph, "data:variable:a")).toBe(5);
    expect(
      variableReferenceSites(graph, "data:variable:a").map((s) => s.field),
    ).toEqual(["prop", "bindingKey", "endpoint", "endpoint", "endpoint"]);

    const { result } = run(
      graph,
      renameVariable({ variableId: "data:variable:a", name: "user" }),
    );
    expect(propOf(graph, "t1")).toBe("Hi {{ user }} and {{ user.first }}");
    expect(propOf(graph, "t2")).toBe("\\{{ a }} {{ env.a }} {{ b }}");
    expect(nodeOf(graph, "list").binding?.key).toBe("{{ user }}");
    const api = graph.getEntry("data:endpoint:e1") as EndpointEntry;
    expect(api.path).toBe("/users/{{ user }}");
    expect(api.headers[0]!.value).toBe("{{ user }}");
    expect(api.queryParams[0]!.value).toBe("{{ user }}");
    expect(
      (graph.getEntry("data:variable:a") as ProjectVariableEntry).name,
    ).toBe("user");
    expect(variableReferenceCount(graph, "data:variable:a")).toBe(5);

    undo(graph, result.inverse);
    expect(snapshot(graph)).toBe(before);
  });

  it("an element variable: only readers below its owner follow — a sibling keeps reading the project's `a` (shadowed name)", () => {
    const own = stateVariable("x", "project:node:box", "a", "LOCAL");
    const graph = graphOf(
      [
        node("box", SECTION, { children: ["project:node:inner" as never] }),
        text("inner", "{{ a }}"),
        text("side", "{{ a }}"),
      ],
      ["box", "side"],
      [own],
    );
    run(graph, setDataEntries({ puts: [projectVariable("a", "a")] }));
    expect(variableReferenceCount(graph, own.id)).toBe(1);
    expect(variableReferenceCount(graph, "data:variable:a")).toBe(1);

    run(graph, renameVariable({ variableId: own.id, name: "count" }));
    expect(propOf(graph, "inner")).toBe("{{ count }}");
    expect(propOf(graph, "side")).toBe("{{ a }}");

    // The project's rename reaches the sibling only.
    run(
      graph,
      renameVariable({ variableId: "data:variable:a", name: "total" }),
    );
    expect(propOf(graph, "side")).toBe("{{ total }}");
    expect(propOf(graph, "inner")).toBe("{{ count }}");
  });

  it("prop ≠ key on one node: the element's `a` is the prop's, the project's `a` is the key's", () => {
    const own = stateVariable("x", "project:node:item", "a", "LOCAL");
    const graph = graphOf([text("item", "{{ a }}")], ["item"], [own]);
    run(
      graph,
      setDataEntries({ puts: [projectVariable("a", "a"), collection] }),
    );
    run(
      graph,
      setWholeField({
        targets: [{ kind: "node", id: nodeOf(graph, "item").id }],
        field: "binding",
        value: { collectionId: COLLECTION, fieldMap: {}, key: "{{ a }}" },
      }),
    );
    run(graph, renameVariable({ variableId: own.id, name: "b" }));
    expect(propOf(graph, "item")).toBe("{{ b }}");
    expect(nodeOf(graph, "item").binding?.key).toBe("{{ a }}");
    run(graph, renameVariable({ variableId: "data:variable:a", name: "c" }));
    expect(propOf(graph, "item")).toBe("{{ b }}");
    expect(nodeOf(graph, "item").binding?.key).toBe("{{ c }}");
  });

  it("an instance's patch prop at a template position reads the page's variable", () => {
    const page = stateVariable("p", PAGE, "a");
    const graph = graphOf(
      [
        node("badge", "lib:definition:badge" as NodeEntry["definitionId"], {
          descendantOverrides: [
            {
              kind: "patch",
              address: {
                instances: ["project:node:badge" as never],
                templatePath: [
                  "lib:template:badgeRoot" as never,
                  "lib:template:badgeText" as never,
                ],
              },
              props: { children: { kind: "set", value: "{{ a }}!" } },
            },
          ],
        }),
      ],
      ["badge"],
      [page],
    );
    run(graph, renameVariable({ variableId: page.id, name: "label" }));
    const override = nodeOf(graph, "badge").descendantOverrides[0]!;
    const write =
      override.kind === "patch" ? override.props?.children : undefined;
    expect(write?.kind === "set" ? write.value : write).toBe("{{ label }}!");
  });

  it("params: a variable named `params` is a variable; a route-only `{{ params.id }}` is not and may not be captured", () => {
    const graph = graphOf([text("t", "{{ params.id }}")], ["t"]);
    run(graph, setDataEntries({ puts: [projectVariable("p", "route")] }));
    // No variable `params`: the Text reads the route — renaming `route` → `params` would capture it.
    expect(
      code(() =>
        run(
          graph,
          renameVariable({ variableId: "data:variable:p", name: "params" }),
        ),
      ),
    ).toBe("VARIABLE_NAME_SHADOWS");
    expect(propOf(graph, "t")).toBe("{{ params.id }}");
    // A variable `params` wins over the route: its rename rewrites the reader.
    run(graph, setDataEntries({ puts: [projectVariable("q", "params")] }));
    run(
      graph,
      renameVariable({ variableId: "data:variable:q", name: "route2" }),
    );
    expect(propOf(graph, "t")).toBe("{{ route2.id }}");
  });

  it("refusals leave the document as it was: a captured reader (SHADOWS), a taken name (CONFLICT), a blank name", () => {
    const x = stateVariable("x", PAGE, "x", "LOCAL");
    const y = stateVariable("y", "project:node:deep", "y");
    const graph = graphOf(
      [text("t", "{{ a }}"), node("deep", SECTION)],
      ["t", "deep"],
      [x, y],
    );
    run(
      graph,
      setDataEntries({ puts: [projectVariable("a", "a", "string", "GLOBAL")] }),
    );
    const before = snapshot(graph);
    // The page reads the project's `a`; a page `a` would capture it.
    expect(
      code(() => run(graph, renameVariable({ variableId: x.id, name: "a" }))),
    ).toBe("VARIABLE_NAME_SHADOWS");
    // A descendant's name is taken on the chain (no reader involved).
    expect(
      code(() => run(graph, renameVariable({ variableId: x.id, name: "y" }))),
    ).toBe("VARIABLE_NAME_CONFLICT");
    // The project variable may not take a page variable's name.
    expect(
      code(() =>
        run(
          graph,
          renameVariable({ variableId: "data:variable:a", name: "x" }),
        ),
      ),
    ).toBe("VARIABLE_NAME_CONFLICT");
    expect(
      code(() => run(graph, renameVariable({ variableId: x.id, name: "  " }))),
    ).toBe("VARIABLE_NAME_EMPTY");
    expect(snapshot(graph)).toBe(before);
    // A project `a` with no page reader: the page variable's `x → a` is a plain conflict.
    run(
      graph,
      setFields({
        targets: [{ kind: "node", id: nodeOf(graph, "t").id }],
        props: { children: { kind: "set", value: "plain" } },
      }),
    );
    expect(
      code(() => run(graph, renameVariable({ variableId: x.id, name: "a" }))),
    ).toBe("VARIABLE_NAME_CONFLICT");
  });
});
