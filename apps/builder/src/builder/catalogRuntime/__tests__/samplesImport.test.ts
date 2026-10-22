import "fake-indexeddb/auto";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it, vi } from "vitest";
import { buildCodeCatalogLibrary } from "../../../../../../packages/shared/src/catalog/document/codeCatalogLibrary";
import { CatalogGraph } from "../../../../../../packages/shared/src/catalog/document/graph";
import type {
  EntryId,
  InteractionEntry,
} from "../../../../../../packages/shared/src/catalog/document/types";
import { importDataParts } from "../../utils/importCollectionEnvelope";
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
  let next = 0;
  const store = {
    collections: new Map(),
    apiEndpoints: new Map(),
    variables: new Map(),
    createDataTable: vi.fn(async (config: { name: string }) => ({
      ...config,
      id: `table-${(next += 1)}`,
    })),
    updateCollection: vi.fn(),
    setRuntimeData: vi.fn(),
    // (Another PC: the store gives each endpoint its own id.)
    createApiEndpoint: vi.fn(async (config: { name: string }) => ({
      ...config,
      id: `local-${(next += 1)}`,
    })),
    updateApiEndpoint: vi.fn(),
    applyDataChange: vi.fn(async () => ({})),
  };
  const { content } = await readCatalogProjectJson(
    readFileSync(resolve(SAMPLES, file), "utf8"),
  );
  await importCatalogProjectContent({
    content,
    projectId: TARGET,
    name: "Imported",
    library,
    replace: (document) => storage.replace(document, library),
    importData: (extras) =>
      importDataParts(
        "imported",
        extras as Parameters<typeof importDataParts>[1],
        store as unknown as Parameters<typeof importDataParts>[2],
      ),
  });
  const document = await storage.load(TARGET, library);
  const graph = new CatalogGraph(document, library);
  const rules = Object.values(document.entries).filter(
    (entry): entry is InteractionEntry => entry.kind === "interaction",
  );
  return { graph, rules, store, content };
}

describe("sample project files import into another project", () => {
  it("ADR-281 G6 check: both Forms' callEndpoint name the endpoints the import created", async () => {
    const { graph, rules, store } = await importSample(
      "adr281-g6-check.composition.json",
    );
    expect(graph.getEntry(TARGET)?.kind).toBe("project");
    const created = await Promise.all(
      store.createApiEndpoint.mock.results.map((result) => result.value),
    );
    const endpoints = rules
      .map((rule) => rule.action)
      .filter((action) => action.opcode === "callEndpoint")
      .map((action) => action.endpointId);
    expect(endpoints).toHaveLength(2);
    expect(new Set(endpoints)).toEqual(
      new Set(created.map((endpoint) => `data:endpoint:${endpoint.id}`)),
    );
  });

  it("global variable CRUD: every setState names a variable the file defines", async () => {
    const { rules, content } = await importSample(
      "global-variable-crud.composition.json",
    );
    const defined = new Set(
      ((content.variables ?? []) as { id: string }[]).map(
        (def) => `data:variable:${def.id}`,
      ),
    );
    const written = rules
      .map((rule) => rule.action)
      .filter((action) => action.opcode === "setState")
      .map((action) => action.variableId);
    expect(written.length).toBeGreaterThan(0);
    for (const id of written) expect(defined).toContain(id);
  });

  it("collection CRUD: Table · GridList · ListBox read the imported collection; each Form submits to an imported endpoint; the list endpoint fills that collection on its interval", async () => {
    const { graph, rules, store, content } = await importSample(
      "collection-crud.composition.json",
    );
    const [table] = await Promise.all(
      store.createDataTable.mock.results.map((result) => result.value),
    );
    const endpoints = await Promise.all(
      store.createApiEndpoint.mock.results.map((result) => result.value),
    );
    const bound = Object.values(graph.exportDocument().entries)
      .filter((entry) => entry.kind === "node" && entry.binding)
      .map((entry) =>
        entry.kind === "node" ? entry.binding!.collectionId : undefined,
      );
    expect(bound).toEqual(Array(3).fill(`data:collection:${table.id}`));
    const submits = rules
      .map((rule) => rule.action)
      .filter((action) => action.opcode === "callEndpoint");
    expect(submits.map((action) => action.body)).toEqual(
      Array(3).fill("!event.formData"),
    );
    // Each Form clears itself after its submit (its own `reset` — the body was read at the event).
    for (const owner of rules
      .filter((rule) => rule.action.opcode === "callEndpoint")
      .map((rule) => rule.ownerId))
      expect(
        rules.some(
          (rule) =>
            rule.ownerId === owner &&
            rule.trigger === "onSubmit" &&
            rule.action.opcode === "capability" &&
            rule.action.capabilityId === "reset" &&
            rule.action.targetId === owner,
        ),
      ).toBe(true);
    const byId = new Map(endpoints.map((endpoint) => [endpoint.id, endpoint]));
    expect(
      new Set(
        submits.map(
          (action) =>
            byId.get(action.endpointId.slice("data:endpoint:".length))?.method,
        ),
      ),
    ).toEqual(new Set(["POST", "PUT", "DELETE"]));
    expect(endpoints.find((endpoint) => endpoint.method === "GET")).toMatchObject(
      { targetCollectionId: table.id },
    );
    expect(store.applyDataChange).toHaveBeenCalledWith(
      expect.objectContaining({
        ops: [
          {
            op: "set_execution_policy",
            collectionId: table.id,
            policy: { mode: "interval", intervalSec: 2 },
          },
        ],
      }),
      { projectId: "imported" },
    );
    const defined = new Set(
      ((content.variables ?? []) as { id: string }[]).map(
        (def) => `data:variable:${def.id}`,
      ),
    );
    for (const action of rules.map((rule) => rule.action))
      if (action.opcode === "setState") expect(defined).toContain(action.variableId);
  });
});
