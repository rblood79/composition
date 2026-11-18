import { act } from "@testing-library/react";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { NodeId } from "../../../../../../packages/shared/src/catalog/document/types";
import type { CatalogConsumerNode } from "../../../../../../packages/shared/src/catalog/runtime/compositionRoot";
import {
  catalogGridSkeletonCount,
  catalogWaterfallSkeletonCount,
} from "../../../../../../packages/shared/src/catalog/runtime/skeletonRepeat";
import { catalogBindingRef } from "../../../builder/catalogRuntime/dataBinding";
import { catalogBindingCommand } from "../../../builder/catalogRuntime/dataBindingCommand";
import { catalogPaletteInsertPlan } from "../../../builder/catalogRuntime/paletteInsert";
import { openAdr280Preview } from "./support/adr280Harness";

/**
 * ADR-314 Phase 4 (G4) — S2 `SkeletonCollection` in a CardView. The CardView takes its collection's
 * load (`loadingState`, the owner's query — `resolver.ts` `LOADING_STATE_TYPES`), and while it is
 * `loading` or `loadingMore` its SkeletonCollection's Card template is drawn as `skeleton` items
 * after the cards (none after the answer or an error). The repeat counts are RAC's: grid =
 * `GridLayout`, waterfall = `WaterfallLayout` (`react-stately` 3.51.0), each its own oracle.
 * Measurement: jsdom + a `fetch` stub the test answers (a real request, not an injected state).
 */
afterEach(() => {
  vi.restoreAllMocks();
});

const settle = () =>
  act(async () => {
    for (let i = 0; i < 8; i += 1) await new Promise((r) => setTimeout(r, 0));
  });

function pendingServer() {
  const answers: ((body: unknown) => void)[] = [];
  vi.spyOn(globalThis, "fetch").mockImplementation(
    () =>
      new Promise((resolvePromise, reject) => {
        answers.push((body) =>
          body instanceof Error
            ? reject(body)
            : resolvePromise(
                new Response(JSON.stringify(body), {
                  headers: { "content-type": "application/json" },
                }),
              ),
        );
      }),
  );
  return answers;
}

async function cardViewPreview(bind: "owner" | "run" = "owner") {
  vi.spyOn(console, "warn").mockImplementation(() => {});
  vi.spyOn(console, "error").mockImplementation(() => {});
  const h = await openAdr280Preview(["CardView"]);
  const [cardView] = h.ids as [NodeId];
  // The palette puts a SkeletonCollection into the selected CardView (its origin root is a slot).
  const cardViewRecord = () =>
    [...h.workspace.root.domInputs.values()].find(
      (record) => record.sourceId === cardView,
    )!;
  h.workspace.selectRecords([cardViewRecord().id]);
  const plan = catalogPaletteInsertPlan(
    {
      graph: h.workspace.runtime.graph,
      records: h.workspace.root.domInputs,
      selection: () => h.workspace.session.getSnapshot().selection,
      itemOfRecord: (identity) => h.workspace.itemOfRecord(identity),
      pageContent: () => ({
        kind: "node",
        id: "project:node:home-body" as NodeId,
      }),
      newId: h.workspace.newId,
    },
    "SkeletonCollection",
  );
  if (!plan.command || ("relocated" in plan && plan.relocated))
    throw new Error("SkeletonCollection not inside the CardView");
  h.workspace.execute(plan.command);
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
          mockData: [],
          runtimeData: [],
          useMockData: false,
        },
      ],
      variables: [],
      apiEndpoints: [
        {
          id: "list",
          name: "listUsers",
          baseUrl: "https://api.example.test",
          path: "/users",
          method: "GET",
          queryParams: [{ key: "page", value: "{{ cursor }}" }],
          targetCollection: "Users",
          responseMapping: { dataPath: "items", cursorPath: "next" },
        },
      ],
    });
  });
  // (owner = the CardView's own query · run = its first Card repeats its own data — ADR-310 ①, the
  //  CardView unbound: its load is the runs', `runsLoadingState`.)
  const firstCard = [...h.workspace.root.domInputs.values()].find(
    (record) =>
      h.workspace.root.typeOf(record) === "Card" &&
      h.workspace.root.typeOf(
        h.workspace.root.domInputs.get(record.parentId)!,
      ) === "CardView",
  )!;
  h.workspace.execute(
    catalogBindingCommand(
      [
        {
          kind: "node",
          id: bind === "owner" ? cardView : (firstCard.sourceId as NodeId),
        },
      ],
      catalogBindingRef({
        source: "dataTable",
        collectionId: "users",
        name: "Users",
      })!,
    ),
  );
  h.flush();
  await settle();
  const records = () => [...h.session.root!.domInputs.values()];
  const typeOf = (record: CatalogConsumerNode) =>
    h.session.root!.typeOf(record);
  const preview = () =>
    records().find((record) => record.sourceId === cardView)!;
  const template = () =>
    records().find(
      (record) =>
        typeOf(record) === "Card" &&
        typeOf(h.session.root!.domInputs.get(record.parentId)!) ===
          "SkeletonCollection",
    )!;
  const grid = () => h.element(cardView)!;
  const skeletons = () =>
    grid().querySelectorAll(`[data-catalog-id="${CSS.escape(template().id)}"]`)
      .length;
  const shownNames = () =>
    [...grid().querySelectorAll('[role="row"]')]
      .map((row) => /Kim|Park|Lee/.exec(row.textContent ?? "")?.[0])
      .filter(Boolean);
  return { ...h, cardView, preview, template, grid, skeletons, shownNames };
}

describe("ADR-314 Phase 4 — a run's load and the Canvas template", () => {
  it("a CardView whose Card repeats its own data takes the run's load (`runsLoadingState`)", async () => {
    const answers = pendingServer();
    const h = await cardViewPreview("run");
    answers.splice(0).forEach((answer) => answer({ items: [] }));
    await settle();
    expect(h.skeletons()).toBe(0);
    let done: Promise<void> | undefined;
    act(() => {
      done = h.session.reload("users");
    });
    await settle();
    expect(h.preview().props.loadingState).toBe("loading");
    expect(h.skeletons()).toBeGreaterThan(0);
    await act(async () => {
      answers.shift()!({ items: [{ id: "u1", name: "Kim" }] });
      await done;
    });
    await settle();
    expect(h.skeletons()).toBe(0);
    h.view.unmount();
  });

  it("the Builder draws the template once, in the loading look (no request — the edit target)", async () => {
    pendingServer();
    const h = await cardViewPreview();
    const root = h.workspace.root;
    const records = [...root.domInputs.values()];
    const templates = records.filter(
      (record) =>
        root.typeOf(record) === "Card" &&
        root.typeOf(root.domInputs.get(record.parentId)!) ===
          "SkeletonCollection",
    );
    expect(templates).toHaveLength(1);
    const below = (record: CatalogConsumerNode): CatalogConsumerNode[] =>
      record.children.flatMap((id) => {
        const child = root.domInputs.get(id)!;
        return [child, ...below(child)];
      });
    // (A Footer Button's words are cut — S2 Button's `[SkeletonContext, null]`.)
    const inButton = (record: CatalogConsumerNode): boolean => {
      for (
        let up = root.domInputs.get(record.parentId);
        up && up !== templates[0];
        up = root.domInputs.get(up.parentId)
      )
        if (/Button$/.test(root.typeOf(up))) return true;
      return false;
    };
    const texts = below(templates[0]!).filter(
      (record) => root.typeOf(record) === "Text" && !inButton(record),
    );
    expect(texts.length).toBeGreaterThan(0);
    for (const text of texts) expect(text.derivedProps?.isSkeleton).toBe(true);
    expect(templates[0]!.derivedProps?.isSkeleton).toBe(true);
    h.view.unmount();
  });
});

describe("ADR-314 Phase 4 — SkeletonCollection follows the CardView's load", () => {
  it("loading: the template's skeleton items only · after the answer: the cards, no skeleton", async () => {
    const answers = pendingServer();
    const h = await cardViewPreview();
    answers.splice(0).forEach((answer) => answer({ items: [] }));
    await settle();
    expect(h.skeletons()).toBe(0);
    let done: Promise<void> | undefined;
    act(() => {
      done = h.session.reload("users");
    });
    await settle();
    expect(h.preview().props.loadingState).toBe("loading");
    expect(h.skeletons()).toBeGreaterThan(0);
    expect(h.shownNames()).toEqual([]);
    // S2: a skeleton item is not a GridList row (keyboard · selection skip it).
    expect(
      h
        .grid()
        .querySelector(
          `[role="row"] [data-catalog-id="${CSS.escape(h.template().id)}"]`,
        ),
    ).toBeNull();
    await act(async () => {
      answers.shift()!({ items: [{ id: "u1", name: "Kim" }], next: "2" });
      await done;
    });
    await settle();
    expect(h.preview().props.loadingState).toBe("idle");
    expect(h.skeletons()).toBe(0);
    expect(h.shownNames()).toEqual(["Kim"]);
    h.view.unmount();
  });

  it("loadingMore: the cards stay and the skeleton items follow them · the sentinel shows no spinner", async () => {
    const answers = pendingServer();
    const h = await cardViewPreview();
    answers
      .splice(0)
      .forEach((answer) =>
        answer({ items: [{ id: "u1", name: "Kim" }], next: "2" }),
      );
    await settle();
    expect(h.shownNames()).toEqual(["Kim"]);
    let done: Promise<void> | undefined;
    act(() => {
      done = h.session.loadMore("users");
    });
    await settle();
    expect(h.preview().props.loadingState).toBe("loadingMore");
    expect(h.shownNames()).toEqual(["Kim"]);
    expect(h.skeletons()).toBeGreaterThan(0);
    // (Order: the card row, then the skeleton items.)
    const row = h.grid().querySelector('[role="row"]')!;
    const skeleton = h
      .grid()
      .querySelector(`[data-catalog-id="${CSS.escape(h.template().id)}"]`)!;
    expect(
      row.compareDocumentPosition(skeleton) & Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
    expect(h.grid().querySelector('[role="progressbar"]')).toBeNull();
    await act(async () => {
      answers.shift()!({ items: [{ id: "u2", name: "Park" }] });
      await done;
    });
    await settle();
    expect(h.skeletons()).toBe(0);
    expect(h.shownNames()).toEqual(["Kim", "Park"]);
    h.view.unmount();
  });

  it("a failed load leaves no skeleton item (S2 `error`)", async () => {
    const answers = pendingServer();
    const h = await cardViewPreview();
    answers.splice(0).forEach((answer) => answer({ items: [] }));
    await settle();
    let done: Promise<void> | undefined;
    act(() => {
      done = h.session.reload("users");
    });
    await settle();
    expect(h.skeletons()).toBeGreaterThan(0);
    await act(async () => {
      answers.shift()!(new Error("offline"));
      await done?.catch(() => {});
    });
    await settle();
    expect(h.preview().props.loadingState).toBe("error");
    expect(h.skeletons()).toBe(0);
    h.view.unmount();
  });
});

/** The installed RAC layouts, given a collection of cards + one `skeleton` node + a loader. */
async function racSkeletons(
  kind: "grid" | "waterfall",
  input: {
    width: number;
    height: number;
    item: [number, number];
    gap: number;
    existing: number;
  },
) {
  const root = resolve(__dirname, "../../../../../../node_modules/.pnpm");
  const { readdirSync } = await import("node:fs");
  const dir = (prefix: string) =>
    readdirSync(root).find((name) => name.startsWith(prefix))!;
  const stately = `${root}/${dir("react-stately@3.51.0")}/node_modules/react-stately/dist/private/`;
  const aria = `${root}/${dir("react-aria@3.53.1")}/node_modules/react-aria/dist/private/`;
  const load = (path: string) =>
    import(/* @vite-ignore */ pathToFileURL(path).href);
  const { GridLayout } = await load(`${stately}layout/GridLayout.mjs`);
  const { WaterfallLayout } = await load(
    `${stately}layout/WaterfallLayout.mjs`,
  );
  const { Size } = await load(`${stately}virtualizer/Size.mjs`);
  const { Rect } = await load(`${stately}virtualizer/Rect.mjs`);
  const { BaseCollection } = await load(
    `${aria}collections/BaseCollection.mjs`,
  );
  const nodes = [
    ...Array.from({ length: input.existing }, (_, i) => ({
      key: `c${i}`,
      type: "item",
    })),
    { key: "s", type: "skeleton" },
    { key: "l", type: "loader", props: { isLoading: true } },
  ];
  const collection = new BaseCollection();
  nodes.forEach((node, i) =>
    collection.addNode({
      ...node,
      prevKey: nodes[i - 1]?.key ?? null,
      nextKey: nodes[i + 1]?.key ?? null,
      parentKey: null,
    }),
  );
  collection.commit(nodes[0]!.key, "l");
  const Layout = kind === "grid" ? GridLayout : WaterfallLayout;
  const layout = new Layout();
  layout.virtualizer = {
    size: new Size(input.width, input.height),
    visibleRect: new Rect(0, 0, input.width, input.height),
    collection,
  };
  layout.update({
    sizeChanged: true,
    layoutOptionsChanged: true,
    layoutOptions: {
      minItemSize: new Size(...input.item),
      maxItemSize: new Size(...input.item),
      minSpace: new Size(input.gap, input.gap),
    },
  });
  return {
    count: [...layout.layoutInfos.values()].filter(
      (info: { type: string }) => info.type === "skeleton",
    ).length,
    columns: layout.numColumns as number,
  };
}

describe("ADR-314 Phase 4 — the repeat counts are RAC's", () => {
  const cases = [
    { width: 420, height: 100, item: [200, 200], gap: 10, existing: 1 },
    { width: 420, height: 900, item: [200, 200], gap: 10, existing: 0 },
    { width: 1000, height: 700, item: [220, 160], gap: 16, existing: 5 },
    { width: 640, height: 480, item: [300, 120], gap: 8, existing: 3 },
  ] as const;

  it.each(cases)("grid = GridLayout (%o)", async (input) => {
    const rac = await racSkeletons("grid", { ...input, item: [...input.item] });
    expect(
      catalogGridSkeletonCount({
        columns: rac.columns,
        existing: input.existing,
        itemHeight: input.item[1],
        gap: input.gap,
        viewportHeight: input.height,
      }),
    ).toBe(rac.count);
  });

  it.each(cases)("waterfall = WaterfallLayout (%o)", async (input) => {
    const rac = await racSkeletons("waterfall", {
      ...input,
      item: [...input.item],
    });
    // (Columns after the cards — each card in the shortest column, as both place them.)
    const heights = new Array<number>(rac.columns).fill(input.gap);
    for (let i = 0; i < input.existing; i += 1) {
      const shortest = heights.indexOf(Math.min(...heights));
      heights[shortest] += input.item[1] + input.gap;
    }
    expect(
      catalogWaterfallSkeletonCount({
        columnHeights: heights,
        itemHeight: input.item[1],
        gap: input.gap,
        viewportHeight: input.height,
      }),
    ).toBe(rac.count);
  });

  it("a CardView as tall as its content: the row's end and one more row · one per column", () => {
    expect(
      catalogGridSkeletonCount({
        columns: 3,
        existing: 4,
        itemHeight: 100,
        gap: 8,
      }),
    ).toBe(2 + 3);
    expect(
      catalogGridSkeletonCount({
        columns: 3,
        existing: 0,
        itemHeight: 100,
        gap: 8,
      }),
    ).toBe(3 + 3);
    expect(
      catalogWaterfallSkeletonCount({
        columnHeights: [8, 300, 120],
        itemHeight: 100,
        gap: 8,
      }),
    ).toBe(6); // (shortest first until every column has one — RAC's loop with nothing to fill: 8 → 108 → 216 · 120 → 228 · 216 → 324 · 228 → 336 · 300 → 408)
  });
});
