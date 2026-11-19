import { act } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { setRowDisplay } from "../../../../../../packages/shared/src/catalog/commands/rowDisplay";
import { docCounters } from "../../../../../../packages/shared/src/catalog/docCounters";
import type { NodeId } from "../../../../../../packages/shared/src/catalog/document/types";
import { catalogBindingRef } from "../../../builder/catalogRuntime/dataBinding";
import { catalogBindingCommand } from "../../../builder/catalogRuntime/dataBindingCommand";
import { openAdr280Preview } from "./support/adr280Harness";

/**
 * A bound list's rows are records of the same template node — one source, N records. The root's
 * rollback journal saved that source's whole record set before each one it added
 * (`compositionRoot.keep` copies a Set value), so showing N rows copied 1 + 2 + … + N entries per
 * template node. Live (2026-11-19): a virtual-scrolled Table of 6 columns bound to 1,000 remote rows
 * allocated ~1 GB of Set copies while loading (1,500 rows 2.4 GB) and the Preview · Publish tab
 * crashed at 2,000 rows. The copies counted (`docCounters.rootMembersCopied`) grow with the rows,
 * not their square.
 */
afterEach(() => {
  vi.restoreAllMocks();
});

const settle = () =>
  act(async () => {
    for (let i = 0; i < 20; i += 1) await new Promise((r) => setTimeout(r, 0));
  });

async function copiedFor(rows: number) {
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
          mockData: Array.from({ length: rows }, (_, index) => ({
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
  const env = process.env.NODE_ENV;
  // (The counter counts in development builds only.)
  process.env.NODE_ENV = "development";
  docCounters.rootMembersCopied = 0;
  try {
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
    // (Every row a record: one page of `rows` — a virtual-scrolled Table's records are its row
    //  window since 2026-11-19, `adr310VirtualTable.test.tsx`.)
    h.workspace.execute(setRowDisplay(id, { mode: "pages", size: rows }));
    h.flush();
    await settle();
    const root = h.session.root!;
    const shown = [...root.domInputs.values()].filter(
      (record) =>
        record.bindingId === "row" &&
        root.domInputs.get(record.parentId)?.bindingId === "tablebody",
    ).length;
    return { copied: docCounters.rootMembersCopied, shown };
  } finally {
    process.env.NODE_ENV = env;
    h.view.unmount();
  }
}

describe("a bound list's rows — the rollback journal grows with the rows", () => {
  it("doubling a bound Table's rows doubles the journal's Set copies (not ×4)", async () => {
    vi.spyOn(console, "warn").mockImplementation(() => {});
    vi.spyOn(console, "error").mockImplementation(() => {});
    const small = await copiedFor(200);
    const large = await copiedFor(400);
    expect([small.shown, large.shown]).toEqual([200, 400]);
    // Before: 663,702 → 2,647,402 (×3.99). Linear: ×2 (the roots' member sets, once a step).
    expect(large.copied / small.copied).toBeLessThan(2.5);
  }, 60_000);
});
