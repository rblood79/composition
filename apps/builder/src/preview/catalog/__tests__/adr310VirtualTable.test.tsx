import { act } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { setRowDisplay } from "../../../../../../packages/shared/src/catalog/commands/rowDisplay";
import type { NodeId } from "../../../../../../packages/shared/src/catalog/document/types";
import { catalogBindingRef } from "../../../builder/catalogRuntime/dataBinding";
import { catalogBindingCommand } from "../../../builder/catalogRuntime/dataBindingCommand";
import { openAdr280Preview } from "./support/adr280Harness";

/**
 * ADR-310 Phase 8 — a virtual-scrolled Table holds every loaded row in the Preview (the
 * `Virtualizer` puts the visible ones in the DOM). A fixed-height Table otherwise keeps the rows
 * its height holds (`boundTableRows`) — before, that cut applied to a virtual Table too: live, a
 * 300 px Table bound to 250 rows scrolled to its 11th row only.
 */
afterEach(() => {
  vi.restoreAllMocks();
});

const settle = () =>
  act(async () => {
    for (let i = 0; i < 20; i += 1) await new Promise((r) => setTimeout(r, 0));
  });

describe("ADR-310 Phase 8 — a virtual Table's rows", () => {
  it("a fixed-height Table bound to 250 rows holds all 250 once virtual-scrolled", async () => {
    vi.spyOn(console, "warn").mockImplementation(() => {});
    vi.spyOn(console, "error").mockImplementation(() => {});
    const h = await openAdr280Preview(["Table"]);
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
            mockData: Array.from({ length: 250 }, (_, index) => ({
              id: `p${index + 1}`,
              name: `Person${index + 1}`,
            })),
            useMockData: true,
          },
        ],
        variables: [],
        apiEndpoints: [],
      });
    });
    const id = h.ids[0] as NodeId;
    h.workspace.execute(
      catalogBindingCommand(
        [{ kind: "node", id }],
        catalogBindingRef({
          source: "dataTable",
          collectionId: "users",
          name: "Users",
        })!,
      ),
    );
    h.flush();
    await settle();
    const rows = () => {
      const root = h.session.root!;
      return [...root.domInputs.values()].filter(
        (record) =>
          record.bindingId === "row" &&
          root.domInputs.get(record.parentId)?.bindingId === "tablebody",
      ).length;
    };
    // (Shown as it is, the fixed height holds a few rows.)
    expect(rows()).toBeLessThan(250);
    h.workspace.execute(setRowDisplay(id, { mode: "virtual" }));
    h.flush();
    await settle();
    expect(rows()).toBe(250);
    h.view.unmount();
    // (250 Table rows render past the default 5 s under a loaded suite run.)
  }, 30_000);
});
