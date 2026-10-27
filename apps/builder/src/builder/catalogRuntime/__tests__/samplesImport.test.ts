import "fake-indexeddb/auto";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { buildCodeCatalogLibrary } from "../../../../../../packages/shared/src/catalog/document/codeCatalogLibrary";
import { CatalogGraph } from "../../../../../../packages/shared/src/catalog/document/graph";
import type {
  EntryId,
  InteractionEntry,
} from "../../../../../../packages/shared/src/catalog/document/types";
import { catalogRuntimeData } from "../../../../../../packages/shared/src/catalog/runtime/catalogData";
import {
  importCatalogProjectContent,
  readCatalogProjectJson,
} from "../exchange";
import { newCatalogProjectDocument } from "../project";
import { CatalogStorage } from "../storage";

/**
 * The sample project files (`docs/how-to/samples/*.composition.json`) open in another project by
 * the header's import: the document validates at this contract, and every rule's data reference —
 * a Form's `callEndpoint` (the endpoint gets a new id there), a `setState` variable — names a data
 * part the import put in the store.
 */
const SAMPLES = resolve(__dirname, "../../../../../../docs/how-to/samples");
const TARGET = "project:project:imported" as EntryId<"project">;

async function importSample(file: string) {
  const library = await buildCodeCatalogLibrary();
  const storage = new CatalogStorage(indexedDB, `samples-${Math.random()}`);
  await storage.create(
    newCatalogProjectDocument({ projectId: TARGET, name: "Imported" }),
    library,
  );
  const { content } = await readCatalogProjectJson(
    readFileSync(resolve(SAMPLES, file), "utf8"),
  );
  await importCatalogProjectContent({
    content,
    projectId: TARGET,
    name: "Imported",
    library,
    replace: (document) => storage.replace(document, library),
  });
  const document = await storage.load(TARGET, library);
  const graph = new CatalogGraph(document, library);
  const rules = Object.values(document.entries).filter(
    (entry): entry is InteractionEntry => entry.kind === "interaction",
  );
  // ADR-286: the data definitions travel inside the document.
  const data = catalogRuntimeData(graph);
  return { graph, rules, data };
}

describe("sample project files import into another project (ADR-286 — data in the document)", () => {
  it("ADR-281 G6 check: both Forms' callEndpoint name the file's endpoints", async () => {
    const { graph, rules, data } = await importSample(
      "adr281-g6-check.composition.json",
    );
    expect(graph.getEntry(TARGET)?.kind).toBe("project");
    const endpoints = rules
      .map((rule) => rule.actions[0])
      .filter((action) => action.opcode === "callEndpoint")
      .map((action) => action.endpointId);
    expect(endpoints).toHaveLength(2);
    expect(new Set(endpoints)).toEqual(
      new Set(data.apiEndpoints.map((endpoint) => `data:endpoint:${endpoint.id}`)),
    );
  });

  it("global variable CRUD: every setState names a variable the document defines", async () => {
    const { rules, data } = await importSample(
      "global-variable-crud.composition.json",
    );
    const defined = new Set(
      data.variables.map((def) => `data:variable:${def.id}`),
    );
    expect(defined.size).toBe(3);
    const written = rules
      .map((rule) => rule.actions[0])
      .filter((action) => action.opcode === "setState")
      .map((action) => action.variableId);
    expect(written.length).toBeGreaterThan(0);
    for (const id of written) expect(defined).toContain(id);
  });

  it("collection CRUD: list · detail — every submit reloads the list, the detail loads one item (GET /users/{{ params.id }}) and binds it", async () => {
    const { graph, rules, data } = await importSample(
      "collection-crud.composition.json",
    );
    const table = data.collections.find((item) => item.name === "Users")!;
    const detailTable = data.collections.find(
      (item) => item.name === "UserDetail",
    )!;
    const endpoints = data.apiEndpoints;
    const entries = Object.values(graph.exportDocument().entries);
    const collection = `data:collection:${table.id}`;
    const detail = `data:collection:${detailTable.id}`;
    // Table · ListBox read every item; the detail frame the one item its endpoint loaded.
    const bindings = entries.flatMap((entry) =>
      entry.kind === "node" && entry.binding ? [entry.binding] : [],
    );
    expect(
      bindings.map((binding) => [binding.collectionId, binding.key]),
    ).toEqual(
      expect.arrayContaining([
        [collection, undefined],
        [detail, "{{ params.id }}"],
      ]),
    );
    expect(bindings).toHaveLength(3);
    expect(
      new Set(
        entries.flatMap((entry) => (entry.kind === "page" ? [entry.route] : [])),
      ),
    ).toEqual(new Set(["/", "/detail/:id"]));
    const submits = rules.filter(
      (rule) => rule.actions[0].opcode === "callEndpoint",
    );
    expect(submits.map((rule) => rule.actions[0])).toEqual(
      Array(3).fill(expect.objectContaining({ body: "!event.formData" })),
    );
    // Each submit reloads the collection (`useAsyncList.reload` — after the submit settles).
    for (const submit of submits)
      expect(
        rules.some(
          (rule) =>
            rule.ownerId === submit.ownerId &&
            rule.trigger === "onSubmit" &&
            rule.actions[0].opcode === "reload" &&
            rule.actions[0].collectionId === collection,
        ),
      ).toBe(true);
    const byId = new Map(endpoints.map((endpoint) => [endpoint.id, endpoint]));
    expect(
      new Set(
        submits.map((rule) =>
          rule.actions[0].opcode === "callEndpoint"
            ? byId.get(rule.actions[0].endpointId.slice("data:endpoint:".length))
                ?.method
            : undefined,
        ),
      ),
    ).toEqual(new Set(["POST", "PUT", "DELETE"]));
    expect(
      endpoints
        .filter((endpoint) => endpoint.method === "GET")
        .map((endpoint) => [endpoint.path, endpoint.targetCollectionId]),
    ).toEqual([
      ["/users", table.id],
      ["/users/{{ params.id }}", detailTable.id],
    ]);
    // The update reloads the detail too.
    const update = submits.find(
      (rule) =>
        rule.actions[0].opcode === "callEndpoint" &&
        byId.get(rule.actions[0].endpointId.slice("data:endpoint:".length))
          ?.method === "PUT",
    )!;
    expect(
      rules.some(
        (rule) =>
          rule.ownerId === update.ownerId &&
          rule.actions[0].opcode === "reload" &&
          rule.actions[0].collectionId === detail,
      ),
    ).toBe(true);
    // The execution policy travels with the collection entry.
    expect(
      graph.getEntry(collection)?.kind === "collection" &&
        (graph.getEntry(collection) as { executionPolicy?: unknown })
          .executionPolicy,
    ).toEqual({ mode: "auto" });
    const defined = new Set(
      data.variables.map((def) => `data:variable:${def.id}`),
    );
    for (const action of rules.map((rule) => rule.actions[0]))
      if (action.opcode === "setState") expect(defined).toContain(action.variableId);
  });
});
