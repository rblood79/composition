import { describe, expect, it } from "vitest";
import { withoutApiSampleRows } from "../apiSampleRows";
import type { CatalogDocument, CatalogEntry } from "../types";

/**
 * The Publish tab's file: a collection an endpoint fills ships no design sample rows; a collection
 * that uses its own data and one no endpoint fills keep theirs. The input document is not changed
 * (an export of the same project keeps every row).
 */
const collection = (name: string, useMockData: boolean) => ({
  kind: "collection",
  id: `data:collection:${name}`,
  name,
  schema: [{ id: "f-id", key: "id", type: "string" }],
  mockData: [{ id: `${name}-1` }, { id: `${name}-2` }],
  useMockData,
});
const endpoint = (name: string, target?: string) => ({
  kind: "endpoint",
  id: `data:endpoint:${name}`,
  ...(target ? { targetCollectionId: `data:collection:${target}` } : {}),
});
const documentOf = (entries: readonly { id: string }[]) =>
  ({
    entries: Object.fromEntries(entries.map((entry) => [entry.id, entry])),
  }) as unknown as CatalogDocument;
const rows = (document: CatalogDocument, name: string) =>
  (
    document.entries[`data:collection:${name}`] as Extract<
      CatalogEntry,
      { kind: "collection" }
    >
  ).mockData.length;

describe("withoutApiSampleRows", () => {
  it("drops the sample rows of the collections an endpoint fills — only those", () => {
    const source = documentOf([
      collection("api", false),
      endpoint("list-api", "api"),
      collection("static", true),
      endpoint("list-static", "static"),
      collection("unlinked", false),
      endpoint("free"),
    ]);
    const published = withoutApiSampleRows(source);
    expect(rows(published, "api")).toBe(0);
    expect(rows(published, "static")).toBe(2);
    expect(rows(published, "unlinked")).toBe(2);
    // (The Builder's document — and so an export of it — keeps the rows.)
    expect(rows(source, "api")).toBe(2);
    // (Entries not changed are the same objects.)
    expect(published.entries["data:collection:static"]).toBe(
      source.entries["data:collection:static"],
    );
  });

  it("returns the same document when nothing ships sample rows", () => {
    const source = documentOf([collection("static", true), endpoint("free")]);
    expect(withoutApiSampleRows(source)).toBe(source);
  });
});
