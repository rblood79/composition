import { act, fireEvent } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type {
  EntryId,
  NodeEntry,
  NodeId,
} from "../../../../../../packages/shared/src/catalog/document/types";
import {
  createPage,
  setFields,
} from "../../../../../../packages/shared/src/catalog/commands";
import { catalogBindingRef } from "../../../builder/catalogRuntime/dataBinding";
import { catalogBindingCommand } from "../../../builder/catalogRuntime/dataBindingCommand";
import { openAdr280Preview } from "./support/adr280Harness";

/**
 * List → detail as the reference does it: an item's `href` (`/detail/{id}` — each row its own) goes
 * through RAC's `RouterProvider` to the session's router, the detail page's route `/detail/:id`
 * gives `{{ params.id }}` (the router's `useParams`). The Canvas has no path: it shows the
 * template as written.
 */
afterEach(() => {
  vi.restoreAllMocks();
});

const DETAIL = "project:page:detail" as EntryId<"page">;
const DETAIL_BODY = "project:node:detail-body" as NodeId;
const DETAIL_TEXT = "project:node:detail-text" as NodeId;

const node = (
  id: NodeId,
  definitionId: string,
  props: NodeEntry["props"] = {},
  children: NodeId[] = [],
): NodeEntry => ({
  kind: "node",
  id,
  definitionId: definitionId as NodeEntry["definitionId"],
  children,
  props,
  visual: {},
  sizing: {},
  descendantOverrides: [],
});

async function routedPreview() {
  vi.spyOn(console, "warn").mockImplementation(() => {});
  vi.spyOn(console, "error").mockImplementation(() => {});
  const h = await openAdr280Preview(["ListBox"]);
  const [list] = h.ids as [NodeId];
  act(() => {
    h.session.receive({
      type: "CATALOG_DATA",
      version: 1,
      collections: [
        {
          id: "users",
          name: "Users",
          schema: [
            { id: "f-id", key: "id", type: "string" },
            { id: "f-name", key: "name", type: "string" },
          ],
          mockData: [
            { id: "u1", name: "Kim" },
            { id: "u2", name: "Park" },
          ],
          useMockData: true,
        },
      ],
      variables: [],
      apiEndpoints: [],
    });
  });
  h.workspace.execute(
    catalogBindingCommand(
      [{ kind: "node", id: list }],
      catalogBindingRef({
        source: "dataTable",
        collectionId: "users",
        name: "Users",
      })!,
    ),
  );
  // The row template (the list's first owned item) links each row to its detail.
  const owner = h.workspace.runtime.graph.getEntry(list) as NodeEntry;
  const fill = owner.descendantOverrides.find(
    (item) => item.kind === "fillSlot",
  ) as { childIds: readonly NodeId[] };
  h.workspace.execute(
    setFields({
      targets: [{ kind: "node", id: fill.childIds[0]! }],
      props: { href: { kind: "set", value: "/detail/{id}" } },
      label: "Edit properties",
    }),
  );
  h.workspace.execute(
    createPage({
      page: {
        kind: "page",
        id: DETAIL,
        route: "/detail/:id",
        name: "Detail",
        children: [DETAIL_BODY],
      },
      entries: [
        node(DETAIL_BODY, "lib:definition:type-body", {}, [DETAIL_TEXT]),
        node(DETAIL_TEXT, "lib:definition:text", {
          children: { kind: "set", value: "Detail {{ params.id }}" },
        }),
      ],
    }),
  );
  h.flush();
  const detailText = () => h.element(DETAIL_TEXT)?.textContent ?? "";
  return { ...h, list, detailText };
}

describe("route params — {{ params.<name> }}", () => {
  it("a :id route's value reads in the page's templates, and follows the path on the same page", async () => {
    const h = await routedPreview();
    act(() => {
      h.session.navigateTo("/detail/u2");
    });
    expect(h.session.pageId).toBe(DETAIL);
    expect(h.session.params).toEqual({ id: "u2" });
    expect(h.detailText()).toBe("Detail u2");
    act(() => {
      h.session.navigateTo("/detail/u1");
    });
    expect(h.detailText()).toBe("Detail u1");
    // (The Canvas shows the template as written — it has no path.)
    const canvas = h.workspace.root.recordsOfSource(DETAIL_TEXT)[0]!;
    expect(h.workspace.root.domInputs.get(canvas)?.props.children).toBe(
      "Detail {{ params.id }}",
    );
    h.view.unmount();
  });
});

describe("item links — RouterProvider", () => {
  it("each bound row links to its own detail; pressing one goes there through the session's router", async () => {
    const h = await routedPreview();
    const links = [
      ...(h.element(h.list)?.querySelectorAll<HTMLElement>("[href]") ?? []),
    ];
    expect(links.map((link) => link.getAttribute("href"))).toEqual([
      "/detail/u1",
      "/detail/u2",
    ]);
    act(() => {
      fireEvent.click(links[1]!);
    });
    expect(h.session.pageId).toBe(DETAIL);
    expect(h.session.path).toBe("/detail/u2");
    expect(h.detailText()).toBe("Detail u2");
    h.view.unmount();
  });
});
