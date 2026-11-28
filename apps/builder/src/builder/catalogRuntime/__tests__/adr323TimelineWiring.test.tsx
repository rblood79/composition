// @vitest-environment jsdom
import "fake-indexeddb/auto";
import { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, describe, expect, it } from "vitest";
import { resolveToken, type TokenRef } from "@composition/rendering";
import {
  insertNodes,
  removeTargets,
  setFields,
} from "../../../../../../packages/shared/src/catalog/commands";
import { buildCodeCatalogLibrary } from "../../../../../../packages/shared/src/catalog/document/codeCatalogLibrary";
import { CatalogGraph } from "../../../../../../packages/shared/src/catalog/document/graph";
import type {
  DataBindingRef,
  EntryId,
  NodeId,
} from "../../../../../../packages/shared/src/catalog/document/types";
import type { CatalogBoundRow } from "../../../../../../packages/shared/src/catalog/resolution/resolver";
import { catalogBindingCommand } from "../dataBindingCommand";
import { renderCatalogDom } from "../domBinding";
import { catalogPaletteDefinitionId } from "../paletteInsert";
import { newCatalogProjectDocument } from "../project";
import { catalogTimelineChromeShapes } from "../ruleShapes";
import { CatalogStorage } from "../storage";
import { CatalogWorkspace } from "../workspace";
import { nodeLayoutEngine } from "./support/nodeLayoutEngine";
import { getPaletteItems } from "../../panels/components/paletteItems";

/**
 * ADR-323 G2 — Timeline through the real composition root: the palette origin (three items — one
 * per status, 사용자 결정 1), each item's derived status · place · side, its date · description
 * Texts' color, the Canvas chrome shapes and the DOM's `ol > li` (the date a `time`) — after edits of
 * the list's orientation · position and an item's status, undo, and a bound list (one item per row,
 * its date · title · status from the rows' date-axis roles). Expected values are written by hand.
 */
const BODY = "project:node:home-body" as NodeId;
const PLACED = "project:node:placed" as NodeId;
const BINDING = {
  collectionId: "data:collection:history",
  fieldMap: {},
} as DataBindingRef;
const ROWS: CatalogBoundRow[] = [
  {
    key: "h1",
    values: { id: "h1", label: "Ignored label", when: "2026-11-20" },
    dateAxis: { start: "2026-11-20", title: "Received", color: "completed" },
  },
  {
    key: "h2",
    values: { id: "h2", label: "Packing" },
    dateAxis: { start: "2026-11-21T09:30", color: "CURRENT" },
  },
  {
    key: "h3",
    values: { id: "h3", label: "Shipping" },
    dateAxis: { start: "", title: "Ship", color: "upcoming" },
  },
];

async function place(rows?: readonly CatalogBoundRow[]) {
  const library = await buildCodeCatalogLibrary();
  const workspace = new CatalogWorkspace(
    new CatalogGraph(
      newCatalogProjectDocument({
        projectId: "project:project:adr323-g2" as EntryId<"project">,
        name: "ADR-323 G2",
      }),
      library,
    ),
    new CatalogStorage(indexedDB, `adr323-g2-${Math.random()}`),
    {
      engine: await nodeLayoutEngine(),
      viewport: { width: 1920, height: 1080 },
      autosaveSchedule: () => {},
      ...(rows
        ? {
            root: {
              rows: (binding: { collectionId: string }) =>
                binding.collectionId === BINDING.collectionId
                  ? (rows as CatalogBoundRow[])
                  : undefined,
            },
          }
        : {}),
    },
  );
  workspace.execute(
    insertNodes({
      parent: { kind: "node", id: BODY },
      entries: [
        {
          kind: "node",
          id: PLACED,
          definitionId: catalogPaletteDefinitionId(library, "Timeline"),
          children: [],
          props: {},
          visual: { width: { kind: "set", value: 400 } } as never,
          sizing: {},
          descendantOverrides: [],
        },
      ],
      rootIds: [PLACED],
      newId: workspace.newId,
    }),
  );
  const root = workspace.root;
  const list = () =>
    [...root.canvasInputs.values()].find((r) => r.sourceId === PLACED)!;
  const items = () => list().children.map((id) => root.canvasInputs.get(id)!);
  // (The Texts drawn — an empty date · description is a hidden record, `presentWhen`.)
  const texts = (item: { children: readonly string[] }) =>
    item.children
      .map((id) => root.canvasInputs.get(id)!)
      .filter((text) => !text.hidden);
  const places = () =>
    items().map((item) => [
      item.derivedProps?._timelineItemStatus,
      item.derivedProps?._timelineItemSide,
      item.derivedProps?._timelineItemLast,
    ]);
  const write = (target: "list" | number, props: Record<string, unknown>) =>
    workspace.execute(
      setFields({
        targets: [
          workspace.itemOfRecord(
            target === "list" ? list().id : items()[target]!.id,
          )!.target,
        ],
        props: Object.fromEntries(
          Object.entries(props).map(([k, v]) => [k, { kind: "set", value: v }]),
        ) as never,
      }),
    );
  return { workspace, root, list, items, texts, places, write };
}

const color = (ref: string) => String(resolveToken(ref as TokenRef, "light"));

let unmount: (() => Promise<void>) | undefined;
afterEach(async () => {
  await unmount?.();
  unmount = undefined;
  document.body.innerHTML = "";
});

async function dom(t: Awaited<ReturnType<typeof place>>) {
  await unmount?.();
  const host = document.createElement("div");
  document.body.append(host);
  const react = createRoot(host);
  await act(async () => react.render(renderCatalogDom(t.root, t.list().id)));
  unmount = async () => act(async () => react.unmount());
  return host;
}

describe("ADR-323 G2 — Timeline", () => {
  it("is on the palette (collections) with its origin", () => {
    const item = getPaletteItems().find((entry) => entry.type === "Timeline");
    expect(item?.category).toBe("collections");
  });

  it("the palette origin: three items, one per status, the last without a connector", async () => {
    const t = await place();
    expect(t.list().derivedProps).toMatchObject({
      _timelineOrientation: "vertical",
      _timelinePlacement: "end",
    });
    expect(t.places()).toEqual([
      ["completed", "end", false],
      ["current", "end", false],
      ["upcoming", "end", true],
    ]);
    // The upcoming sample has no date: its date Text is not there (title only).
    expect(t.texts(t.items()[0]!).map((r) => r.props.children)).toEqual([
      "Order placed",
      "2026-11-24",
    ]);
    expect(t.texts(t.items()[2]!).map((r) => r.props.children)).toEqual([
      "Delivered",
    ]);
    // The date Text is subdued and a `time` value; the title keeps the document's color.
    const [title, date] = t.texts(t.items()[0]!);
    expect(date!.derivedProps).toMatchObject({
      _timeDateTime: "2026-11-24",
      color: color("{color.neutral-subdued}"),
    });
    expect(title!.derivedProps?.color).toBeUndefined();
    // The item keeps room for its marker (M: 12 + 12) and the spacing to the next (16).
    expect(t.items()[0]!.derivedProps).toMatchObject({
      _timelinePadLeft: 24,
      _timelinePadBottom: 16,
      _timelinePadRight: 0,
    });
  });

  it("the Canvas chrome: a filled · ring marker and a connector to the next item", async () => {
    const t = await place();
    const shapes = (index: number) =>
      catalogTimelineChromeShapes({
        type: "TimelineItem",
        node: t.items()[index]! as never,
        rect: { width: 400, height: 60 },
        theme: "light",
      }) as unknown as Record<string, unknown>[];
    const lineHeight = Number(
      resolveToken("{typography.text-sm--line-height}" as TokenRef),
    );
    const markerTop = (lineHeight - 12) / 2;
    const [connector, marker] = shapes(0);
    expect(connector).toMatchObject({
      type: "rect",
      x: 5,
      y: markerTop + 16,
      width: 2,
      height: 60 - (markerTop + 16) - (4 - markerTop),
      fill: color("{color.gray}"),
    });
    expect(marker).toMatchObject({
      type: "circle",
      x: 6,
      y: markerTop + 6,
      radius: 6,
      fill: color("{color.gray}"),
    });
    // In progress: accent fill, the connector after it the rest color.
    expect(shapes(1)).toMatchObject([
      { fill: color("{color.field-placeholder}") },
      { fill: color("{color.accent}") },
    ]);
    // Upcoming (last): a ring only.
    const last = shapes(2);
    expect(last).toHaveLength(1);
    expect(last[0]).toMatchObject({
      type: "circle",
      stroke: color("{color.field-placeholder}"),
    });
    expect(last[0]!.fill).toBeUndefined();
  });

  it("the DOM: ol > li, the date a time element, the chrome spans at the Canvas's places", async () => {
    const t = await place();
    const host = await dom(t);
    const ol = host.querySelector("ol.react-aria-Timeline")!;
    expect(ol).not.toBeNull();
    const lis = [...ol.children].filter((el) => el.tagName === "LI");
    expect(lis.map((li) => li.getAttribute("data-status"))).toEqual([
      "completed",
      "current",
      "upcoming",
    ]);
    const time = lis[0]!.querySelector("time")!;
    expect(time.getAttribute("datetime")).toBe("2026-11-24");
    expect(time.textContent).toBe("2026-11-24");
    const first = lis[0] as HTMLElement;
    expect(first.style.paddingLeft).toBe("24px");
    const marker = first.querySelector(".timeline-marker") as HTMLElement;
    expect(marker.style.left).toBe("0px");
    expect(marker.style.width).toBe("12px");
    expect(lis[2]!.querySelector(".timeline-connector")).toBeNull();
    // (The status a screen reader reads — the marker says it with color only: 판독 F7.)
    expect(lis.map((li) => li.textContent)).toEqual([
      "Order placed2026-11-24Completed",
      "Shipped2026-11-26In progress",
      "DeliveredUpcoming",
    ]);
    // No role, no aria attribute: an ordered list (D1 exception 0).
    expect(host.querySelector("[role]")).toBeNull();
    expect(
      [...host.querySelectorAll("*")].some((el) =>
        [...el.attributes].some((attr) => attr.name.startsWith("aria-")),
      ),
    ).toBe(false);
  });

  it("orientation · position · status edits re-derive every item, and undo restores them", async () => {
    const t = await place();
    t.write("list", { position: "alternate" });
    expect(t.places().map((p) => p[1])).toEqual(["end", "start", "end"]);
    expect(t.items()[1]!.derivedProps).toMatchObject({
      _timelinePadRight: 6 + 12,
      _timelinePadLeft: 0,
    });
    t.write("list", { orientation: "horizontal" });
    expect(t.list().derivedProps?._timelineOrientation).toBe("horizontal");
    // (Horizontal draws `alternate` as `end`.)
    expect(t.places().map((p) => p[1])).toEqual(["end", "end", "end"]);
    expect(t.items()[0]!.derivedProps).toMatchObject({
      _timelinePadTop: 24,
      _timelinePadRight: 16,
    });
    t.write(2, { status: "completed" });
    expect(t.places().map((p) => p[0])).toEqual([
      "completed",
      "current",
      "completed",
    ]);
    t.workspace.undo();
    t.workspace.undo();
    t.workspace.undo();
    expect(t.places()).toEqual([
      ["completed", "end", false],
      ["current", "end", false],
      ["upcoming", "end", true],
    ]);
  });

  it("an authored padding wins over the item's derived room on the Canvas, as in the DOM (판독 F6)", async () => {
    const t = await place();
    const first = () => t.items()[0]!;
    expect(t.root.getLayoutInput(first().id)).toMatchObject({
      paddingLeft: "24px",
    });
    t.workspace.execute(
      setFields({
        targets: [t.workspace.itemOfRecord(first().id)!.target],
        visual: { padding: { kind: "set", value: 40 } },
      } as never),
    );
    expect(t.root.getLayoutInput(first().id)).toMatchObject({
      paddingTop: "40px",
      paddingRight: "40px",
      paddingBottom: "40px",
      paddingLeft: "40px",
    });
    const host = await dom(t);
    const li = host.querySelector("ol > li") as HTMLElement;
    expect(li.style.padding).toBe("40px");
    // (Another item keeps its derived room.)
    expect(t.root.getLayoutInput(t.items()[1]!.id)).toMatchObject({
      paddingLeft: "24px",
    });
  });

  it("an item with display none is not an item: sides · the last connector skip it (판독 F5)", async () => {
    const t = await place();
    const hide = (index: number) =>
      t.workspace.execute(
        setFields({
          targets: [t.workspace.itemOfRecord(t.items()[index]!.id)!.target],
          layout: { display: { kind: "set", value: "none" } },
        } as never),
      );
    t.write("list", { position: "alternate" });
    hide(1);
    const shown = () =>
      t.items().filter((item) => item.layout.display !== "none");
    expect(shown().map((item) => item.derivedProps?._timelineItemSide)).toEqual(
      ["end", "start"],
    );
    t.workspace.undo();
    hide(2);
    expect(
      shown().map((item) => [
        item.derivedProps?._timelineItemSide,
        item.derivedProps?._timelineItemLast,
      ]),
    ).toEqual([
      ["end", false],
      ["start", true],
    ]);
    // (The last shown item draws its marker only — no connector.)
    expect(
      catalogTimelineChromeShapes({
        type: "TimelineItem",
        node: shown()[1]! as never,
        rect: { width: 400, height: 60 },
        theme: "light",
      }),
    ).toHaveLength(1);
  });

  it("bound: one item per row — date · title · status from the date-axis roles", async () => {
    const t = await place(ROWS);
    t.workspace.execute(
      catalogBindingCommand(
        [{ kind: "node", id: PLACED }],
        BINDING,
        t.workspace.newId,
      ),
    );
    expect(t.items().map((item) => item.props.id)).toEqual(["h1", "h2", "h3"]);
    expect(t.places()).toEqual([
      ["completed", "end", false],
      // (The status field's value is read case-blind.)
      ["current", "end", false],
      ["upcoming", "end", true],
    ]);
    expect(
      t.items().map((item) => t.texts(item).map((r) => r.props.children)),
    ).toEqual([
      // The title role wins over the row's label.
      ["Received", "2026-11-20"],
      // No title role: the row's label; a day and time is the `time` value with `T`.
      ["Packing", "2026-11-21T09:30"],
      // An empty start: no date Text.
      ["Ship"],
    ]);
    expect(t.texts(t.items()[1]!)[1]!.derivedProps?._timeDateTime).toBe(
      "2026-11-21T09:30",
    );
  });

  it("bound without a date role: no row draws the template's sample date (판독 F2)", async () => {
    const t = await place([
      { key: "a", values: { id: "a", label: "Alpha" } },
      { key: "b", values: { id: "b", label: "Beta" } },
    ]);
    t.workspace.execute(
      catalogBindingCommand(
        [{ kind: "node", id: PLACED }],
        BINDING,
        t.workspace.newId,
      ),
    );
    expect(
      t.items().map((item) => t.texts(item).map((r) => r.props.children)),
    ).toEqual([["Alpha"], ["Beta"]]);
    const host = await dom(t);
    expect(host.querySelector("time")).toBeNull();
  });

  it("an emptied Timeline gets its row template when bound (판독 F4)", async () => {
    const t = await place(ROWS);
    t.workspace.root.execute(
      removeTargets({
        targets: t
          .items()
          .map((item) => t.workspace.positionOfRecord(item.id)!.target),
      }),
    );
    expect(t.items()).toEqual([]);
    t.workspace.execute(
      catalogBindingCommand(
        [{ kind: "node", id: PLACED }],
        BINDING,
        t.workspace.newId,
      ),
    );
    expect(t.items().map((item) => item.props.id)).toEqual(["h1", "h2", "h3"]);
  });
});
