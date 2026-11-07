import { act, fireEvent } from "@testing-library/react";
import { expect, it } from "vitest";
import {
  insertNodes,
  moveNodes,
} from "../../../../../../packages/shared/src/catalog/commands";
import type {
  LibraryDefinitionId,
  NodeId,
} from "../../../../../../packages/shared/src/catalog/document/types";
import { openAdr280Preview } from "./support/adr280Harness";

it.each(["body", "frame"])(
  "%s disabled reaches the group/items in Canvas, Preview and interaction guards",
  async (host) => {
    const h = await openAdr280Preview(["SegmentedControl"]);
    try {
      const id = h.ids[0];
      const body = "project:node:home-body" as NodeId;
      const frame = "project:node:disabled-host" as NodeId;
      if (host === "frame") {
        h.workspace.execute(
          insertNodes({
            parent: { kind: "node", id: body },
            entries: [
              {
                kind: "node",
                id: frame,
                definitionId:
                  "lib:definition:type-frame" as LibraryDefinitionId,
                children: [],
                props: {},
                visual: {},
                sizing: {},
                descendantOverrides: [],
              },
            ],
            rootIds: [frame],
            newId: h.workspace.newId,
          }),
        );
        h.workspace.execute(
          moveNodes({
            ids: [id],
            parent: { kind: "node", id: frame },
            newId: h.workspace.newId,
          }),
        );
        h.flush();
      }
      const hostId = host === "body" ? body : frame;
      h.rule(id, "onSelectionChange", { opcode: "toast", message: "changed" });
      const records = () =>
        [...h.workspace.root.canvasInputs.values()].filter((node) =>
          ["SegmentedControl", "SegmentedControlItem"].includes(
            h.workspace.root.typeOf(node),
          ),
        );
      h.declare(hostId, { isDisabled: true });
      expect(
        records()
          .map((node) => [
            h.workspace.root.typeOf(node),
            node.derivedProps?.isDisabled,
          ])
          .sort(([a], [b]) => String(a).localeCompare(String(b))),
      ).toEqual([
        ["SegmentedControl", true],
        ["SegmentedControlItem", true],
        ["SegmentedControlItem", true],
      ]);
      const buttons = () => [
        ...h.element(id)!.querySelectorAll<HTMLButtonElement>("button"),
      ];
      expect(buttons().every((button) => button.disabled)).toBe(true);
      act(() => {
        fireEvent.click(buttons()[1]);
      });
      expect(h.toasts).toEqual([]);
      h.declare(hostId, { isDisabled: false });
      expect(
        records().every((node) => node.derivedProps?.isDisabled !== true),
      ).toBe(true);
      expect(buttons().every((button) => !button.disabled)).toBe(true);
      act(() => {
        fireEvent.click(buttons()[1]);
      });
      expect(h.toasts).toEqual(["changed"]);
    } finally {
      h.view.unmount();
      h.workspace.dispose();
    }
  },
);
