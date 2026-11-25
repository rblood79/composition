import { act } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { setFields } from "../../../../../../packages/shared/src/catalog/commands";
import type { NodeId } from "../../../../../../packages/shared/src/catalog/document/types";
import { catalogPaletteInsertPlan } from "../../../builder/catalogRuntime/paletteInsert";
import { openAdr280Preview } from "./support/adr280Harness";

/**
 * S2 체크리스트 부록 D.1 대조 (2026-11-24) — S2 `DisclosureHeader` gives the ActionButtons beside the
 * title one size below the Disclosure's and its `isQuiet` (`ActionButtonContext`); an ActionButton in
 * the panel keeps its own.
 */
afterEach(() => {
  vi.restoreAllMocks();
});

it("an ActionButton beside the title is one size below the Disclosure and quiet with it; one in the panel is not", async () => {
  vi.spyOn(console, "warn").mockImplementation(() => {});
  const h = await openAdr280Preview(["Disclosure"]);
  const disclosure = h.ids[0] as NodeId;
  const root = h.workspace.root;
  const recordOf = (type: string) =>
    [...root.domInputs.values()].find((item) => root.typeOf(item) === type)!;
  const placeIn = (type: string): NodeId => {
    const before = new Set(
      [...root.domInputs.values()]
        .filter((item) => root.typeOf(item) === "ActionButton")
        .map((item) => item.sourceId),
    );
    h.workspace.selectRecords([recordOf(type).id]);
    const plan = catalogPaletteInsertPlan(
      {
        graph: h.workspace.runtime.graph,
        records: root.domInputs,
        selection: () => h.workspace.session.getSnapshot().selection,
        itemOfRecord: (identity) => h.workspace.itemOfRecord(identity),
        pageContent: () => ({
          kind: "node",
          id: "project:node:home-body" as NodeId,
        }),
        newId: h.workspace.newId,
      },
      "ActionButton",
    );
    expect(plan.command).toBeDefined();
    act(() => {
      h.workspace.execute(plan.command!);
    });
    h.flush();
    return [...root.domInputs.values()].find(
      (item) =>
        root.typeOf(item) === "ActionButton" && !before.has(item.sourceId),
    )!.sourceId as NodeId;
  };
  const header = placeIn("DisclosureHeader");
  const inPanel = placeIn("DisclosurePanel");
  const props = (id: NodeId) =>
    h.workspace.root.recordsOfSource(id).map((record) => {
      const item = h.workspace.root.canvasInputs.get(record)!;
      return { size: item.props.size, isQuiet: item.props.isQuiet };
    })[0];
  expect(props(header)).toMatchObject({ size: "S" });
  expect(props(header)?.isQuiet).not.toBe(true);
  expect(props(inPanel)).toMatchObject({ size: "M" });
  act(() => {
    h.workspace.execute(
      setFields({
        targets: [{ kind: "node", id: disclosure }],
        props: {
          size: { kind: "set", value: "L" },
          isQuiet: { kind: "set", value: true },
        },
      }),
    );
  });
  h.flush();
  expect(props(header)).toEqual({ size: "M", isQuiet: true });
  expect(props(inPanel)?.size).toBe("M");
  expect(props(inPanel)?.isQuiet).not.toBe(true);
  // (The Preview's RAC button carries the same.)
  const button = h.element(header);
  expect(button?.getAttribute("data-size")).toBe("M");
  // S2 `Disclosure.tsx:273` — compact shifts the title row's buttons two sizes down (L → S, M → XS).
  act(() => {
    h.workspace.execute(
      setFields({
        targets: [{ kind: "node", id: disclosure }],
        props: { density: { kind: "set", value: "compact" } },
      }),
    );
  });
  h.flush();
  expect(props(header)?.size).toBe("S");
  expect(props(inPanel)?.size).toBe("M");
  expect(h.element(header)?.getAttribute("data-size")).toBe("S");
  act(() => {
    h.workspace.execute(
      setFields({
        targets: [{ kind: "node", id: disclosure }],
        props: { size: { kind: "set", value: "M" } },
      }),
    );
  });
  h.flush();
  expect(props(header)?.size).toBe("XS");
  h.view.unmount();
});
