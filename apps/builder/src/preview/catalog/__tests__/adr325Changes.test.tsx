import { act } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { setRowDisplay } from "../../../../../../packages/shared/src/catalog/commands/rowDisplay";
import { removeTargets } from "../../../../../../packages/shared/src/catalog/commands";
import type { NodeId } from "../../../../../../packages/shared/src/catalog/document/types";
import { catalogBindingRef } from "../../../builder/catalogRuntime/dataBinding";
import { catalogBindingCommand } from "../../../builder/catalogRuntime/dataBindingCommand";
import { openAdr280Preview } from "./support/adr280Harness";

/**
 * ADR-325 G2 — an unsaved change stays over whatever a load brings: a search · a sort (another
 * query of the collection), another page of a paged list. A row without a key is of its answer
 * (사용자 결정 1): two lists of other requests do not share it, and loading its list again drops
 * its change. Expected values are written by hand; the requests are counted at a `fetch` stub
 * (rows `Row 1` … `Row 6`, `?q=` filters by label, `?dir=descending` reverses, `?page=` · `?size=`
 * page them).
 */
afterEach(() => {
  vi.restoreAllMocks();
});

const settle = () =>
  act(async () => {
    for (let i = 0; i < 30; i += 1) await new Promise((r) => setTimeout(r, 0));
  });

function serve(keyed: boolean) {
  const urls: string[] = [];
  const rows = Array.from({ length: 6 }, (_, index) => ({
    ...(keyed ? { id: `r${index + 1}` } : {}),
    label: `Row ${index + 1}`,
  }));
  vi.spyOn(globalThis, "fetch").mockImplementation(async (input) => {
    const url = new URL(String(input));
    urls.push(`${url.pathname}${url.search}`);
    const q = url.searchParams.get("q");
    let list = q ? rows.filter((row) => row.label.includes(q)) : [...rows];
    if (url.searchParams.get("dir") === "descending") list = list.reverse();
    const size = Number(url.searchParams.get("size")) || list.length;
    const page = Number(url.searchParams.get("page")) || 1;
    return new Response(
      JSON.stringify({
        items: list.slice((page - 1) * size, page * size),
        total: list.length,
      }),
      { headers: { "content-type": "application/json" } },
    );
  });
  return urls;
}

async function open(keyed: boolean, types: string[]) {
  vi.spyOn(console, "warn").mockImplementation(() => {});
  vi.spyOn(console, "error").mockImplementation(() => {});
  const urls = serve(keyed);
  const h = await openAdr280Preview(types);
  act(() => {
    h.session.receive({
      type: "CATALOG_DATA",
      version: 1,
      collections: [
        {
          id: "people",
          name: "People",
          schema: [
            ...(keyed ? [{ id: "f-id", key: "id", type: "string" }] : []),
            { id: "f-label", key: "label", type: "string" },
          ],
          mockData: [],
          runtimeData: [],
          useMockData: false,
        },
      ],
      variables: [],
      apiEndpoints: [
        {
          id: "list",
          name: "listPeople",
          baseUrl: "https://api.example.test",
          method: "GET",
          path: "/people",
          queryParams: [
            { key: "q", value: "{{ filterText }}" },
            { key: "dir", value: "{{ sortDescriptor.direction }}" },
            { key: "page", value: "{{ page }}" },
            { key: "size", value: "{{ pageSize }}" },
          ],
          targetCollection: "People",
          responseMapping: { dataPath: "items", totalPath: "total" },
        },
      ],
    });
  });
  for (const id of h.ids as NodeId[])
    h.workspace.execute(
      catalogBindingCommand(
        [{ kind: "node", id }],
        catalogBindingRef({
          source: "dataTable",
          collectionId: "people",
          name: "People",
        })!,
      ),
    );
  h.flush();
  await settle();
  const labels = (id: NodeId) =>
    [...(h.element(id)?.querySelectorAll('[role="option"]') ?? [])].map(
      (option) => /Row \d+\w*|Edited/.exec(option.textContent ?? "")?.[0],
    );
  return { ...h, urls, labels };
}

describe("ADR-325 G2 — a change stays over a load", () => {
  it("a search and a sort (other queries) keep the edited value and its unsaved count", async () => {
    const h = await open(true, ["ListBox"]);
    const [list] = h.ids as [NodeId];
    expect(h.labels(list)).toEqual([
      "Row 1",
      "Row 2",
      "Row 3",
      "Row 4",
      "Row 5",
      "Row 6",
    ]);
    act(() => {
      h.session.update("people", "r2", { label: "Edited" });
    });
    await act(() => h.session.setFilterText("people", "2"));
    await settle();
    expect(h.urls.at(-1)).toBe("/people?q=2");
    expect(h.labels(list)).toEqual(["Edited"]);
    await act(() =>
      h.session.sortCollection("people", {
        column: "label",
        direction: "descending",
      }),
    );
    await settle();
    expect(h.urls.at(-1)).toBe("/people?q=2&dir=descending");
    await act(() => h.session.setFilterText("people", ""));
    await settle();
    expect(h.labels(list)).toEqual([
      "Row 6",
      "Row 5",
      "Row 4",
      "Row 3",
      "Edited",
      "Row 1",
    ]);
    expect(h.session.unsavedCount("people")).toBe(1);
    expect(Object.fromEntries(h.session.editMarks("people") ?? [])).toEqual({
      r2: { status: "dirty", fields: ["label"] },
    });
    h.view.unmount();
  });

  it("a paged list: an edit on page 1 stays after going to page 2 and back", async () => {
    const h = await open(true, ["ListBox"]);
    const [list] = h.ids as [NodeId];
    h.workspace.execute(setRowDisplay(list, { mode: "pages", size: 2 }));
    h.flush();
    await settle();
    expect(h.labels(list)).toEqual(["Row 1", "Row 2"]);
    act(() => {
      h.session.update("people", "r1", { label: "Edited" });
    });
    await settle();
    expect(h.labels(list)).toEqual(["Edited", "Row 2"]);
    await act(() => h.session.goToPage(list, 2));
    await settle();
    expect(h.labels(list)).toEqual(["Row 3", "Row 4"]);
    // (A row only the page list shows is edited by its key too.)
    act(() => {
      h.session.update("people", "r4", { label: "Row 4b" });
    });
    await settle();
    expect(h.labels(list)).toEqual(["Row 3", "Row 4b"]);
    await act(() => h.session.goToPage(list, 1));
    await settle();
    expect(h.labels(list)).toEqual(["Edited", "Row 2"]);
    expect(h.session.unsavedCount("people")).toBe(2);
    h.view.unmount();
  });

  it("rows without a key: two lists of other requests do not share a row; loading one again drops only its change (사용자 결정 1)", async () => {
    const h = await open(false, ["ListBox", "ListBox"]);
    const [whole, paged] = h.ids as [NodeId, NodeId];
    h.workspace.execute(setRowDisplay(paged, { mode: "pages", size: 2 }));
    h.flush();
    await settle();
    expect(h.labels(whole)[0]).toBe("Row 1");
    expect(h.labels(paged)).toEqual(["Row 1", "Row 2"]);
    // (The collection's own list keys its rows by place — `row-1` is its first row.)
    act(() => {
      h.session.update("people", "row-1", { label: "Edited" });
    });
    await settle();
    expect(h.labels(whole)[0]).toBe("Edited");
    expect(h.labels(paged)).toEqual(["Row 1", "Row 2"]);
    await act(() => h.session.reload("people"));
    await settle();
    expect(h.labels(whole)[0]).toBe("Row 1");
    expect(h.session.unsavedCount("people")).toBe(0);
    h.view.unmount();
  });

  it("a paged list removed: its list goes from the store (G4 — no reader, no result)", async () => {
    const h = await open(true, ["ListBox", "ListBox"]);
    const [, paged] = h.ids as [NodeId, NodeId];
    h.workspace.execute(setRowDisplay(paged, { mode: "pages", size: 2 }));
    h.flush();
    await settle();
    const store = () =>
      (
        h.session as unknown as {
          stores: Map<string, { lists: Map<string, unknown> }>;
        }
      ).stores.get("people")!;
    const units = () =>
      [...store().lists.keys()].filter((key) => key.startsWith("unit"));
    expect(units()).toHaveLength(1);
    h.workspace.execute(removeTargets({ targets: [{ kind: "node", id: paged }] }));
    h.flush();
    await settle();
    expect(units()).toEqual([]);
    h.view.unmount();
  });
});
