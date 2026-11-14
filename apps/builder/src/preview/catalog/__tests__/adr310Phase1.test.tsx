import { act } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { NodeId } from "../../../../../../packages/shared/src/catalog/document/types";
import { catalogBindingRef } from "../../../builder/catalogRuntime/dataBinding";
import { catalogBindingCommand } from "../../../builder/catalogRuntime/dataBindingCommand";
import { catalogEditContract } from "../../../builder/catalogRuntime/editContract";
import { openAdr280Preview } from "./support/adr280Harness";

/**
 * ADR-310 Phase 1 (G1) — every collection family in the item type table repeats its row template
 * per data row: a bound Menu · CardView · SelectBoxGroup drew their template items as they were
 * (Phase 0 reproduction — `CATALOG_ROW_ITEM_TYPES` lacked MenuItem · Card · SelectBox).
 */
afterEach(() => {
  vi.restoreAllMocks();
});

const NAMES = ["Alpha", "Bravo", "Charlie", "Delta", "Echo"];
const data = (count = NAMES.length) => ({
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
      mockData: Array.from({ length: count }, (_, index) => ({
        id: `u${index}`,
        name: NAMES[index] ?? `Person${index + 1}`,
      })),
      useMockData: true,
    },
  ],
  variables: [],
  apiEndpoints: [],
});

async function bound(type: string, count?: number) {
  vi.spyOn(console, "warn").mockImplementation(() => {});
  vi.spyOn(console, "error").mockImplementation(() => {});
  const h = await openAdr280Preview([type]);
  act(() => {
    h.session.receive(data(count));
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
  /** Records of `itemType` under the bound node (Canvas: the workspace's · DOM: the session's). */
  const records = (
    inputs: ReadonlyMap<string, { definitionId: string }> | undefined,
    itemType: string,
  ) =>
    [...(inputs ?? new Map<string, { definitionId: string }>())].filter(
      ([recordId, record]) =>
        recordId.includes(id) &&
        String(record.definitionId).endsWith(`type-${itemType}`),
    );
  return {
    ...h,
    id,
    canvas: (itemType: string) =>
      records(h.workspace.root.canvasInputs as never, itemType),
    dom: (itemType: string) =>
      records(h.session.root?.domInputs as never, itemType),
  };
}

describe("ADR-310 Phase 1 — bound families repeat their item per row", () => {
  it.each([
    ["Menu", "MenuItem"],
    ["CardView", "Card"],
    ["SelectBoxGroup", "SelectBox"],
  ])(
    "a bound %s draws one %s per data row (DOM) and the rows' sample (Canvas)",
    async (type, itemType) => {
      const h = await bound(type);
      expect(h.dom(itemType)).toHaveLength(NAMES.length);
      expect(h.canvas(itemType).length).toBeGreaterThan(0);
      expect(h.canvas(itemType).length).toBeLessThanOrEqual(NAMES.length);
    },
  );

  it.each(["CardView", "SelectBoxGroup"])(
    "a bound %s shows the rows' names in the Preview",
    async (type) => {
      const h = await bound(type);
      const text = h.element(h.id)?.textContent ?? "";
      for (const name of NAMES) expect(text).toContain(name);
    },
  );

  it.each(["Menu", "CardView", "SelectBoxGroup", "ListBox"])(
    "the palette %s offers the data source field (the connect UI)",
    async (type) => {
      vi.spyOn(console, "warn").mockImplementation(() => {});
      const h = await openAdr280Preview([type]);
      const contract = catalogEditContract(
        h.workspace.runtime.graph,
        h.workspace.readModel,
        { kind: "node", id: h.ids[0] as NodeId },
      );
      const field = contract.fields.find((item) => item.kind === "binding");
      expect(field).toBeDefined();
      expect(field!.editorHidden).toBeFalsy();
    },
  );
});
