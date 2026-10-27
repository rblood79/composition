// @vitest-environment jsdom
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { expect, it } from "vitest";
import { buildCodeCatalogLibrary } from "../../../../packages/shared/src/catalog/document/codeCatalogLibrary";
import { loadCatalogProjectText } from "../catalogProject";
import { createPublishedSession } from "../catalogSession";

/**
 * ADR-286 G3 — publish reads the data definitions from the document (no `extras` data parts): the
 * sample CRUD file's collections · endpoints · variables reach the session, the list collection
 * with the file's seed rows (the oracle: 3 rows — the Builder Preview's start, README).
 */
it("publish 세션이 문서의 collection · endpoint · 변수를 읽는다 (Users seed 3행)", async () => {
  const library = await buildCodeCatalogLibrary();
  const text = readFileSync(
    resolve(
      __dirname,
      "../../../../docs/how-to/samples/collection-crud.composition.json",
    ),
    "utf8",
  );
  const loaded = await loadCatalogProjectText(text, library);
  expect(Object.keys(loaded.extras)).not.toContain("collections");
  const session = createPublishedSession(loaded, library);
  const endpoints = session.dataServices.apiEndpointService?.getApiEndpoints();
  expect(endpoints).toHaveLength(5);
  const graph = session.graph!;
  const { catalogRuntimeData } = await import(
    "../../../../packages/shared/src/catalog/runtime/catalogData"
  );
  const data = catalogRuntimeData(graph);
  expect(data.collections.map((item) => item.name)).toEqual([
    "Users",
    "UserDetail",
  ]);
  expect(data.collections[0]!.mockData).toHaveLength(3);
  expect(data.variables.map((item) => item.name).sort()).toEqual([
    "lastAction",
    "opCount",
  ]);
  loaded.dispose();
});
