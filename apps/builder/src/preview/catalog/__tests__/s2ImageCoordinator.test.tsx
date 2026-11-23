import { act, fireEvent, waitFor } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { insertNodes } from "../../../../../../packages/shared/src/catalog/commands";
import type {
  NodeEntry,
  NodeId,
} from "../../../../../../packages/shared/src/catalog/document/types";
import { catalogPaletteInsertPlan } from "../../../builder/catalogRuntime/paletteInsert";
import { openAdr280Preview } from "./support/adr280Harness";

/**
 * S2 체크리스트 부록 D.2 (사용자 결정 2026-11-24 「S2 레퍼런스 대로」) — S2 `ImageCoordinator`: a placed
 * ImageCoordinator has no element of its own; the Images in it are revealed together once all have
 * loaded. An Image of another `group` name is not held. A Card coordinates its own pictures (S2 `Card.tsx`).
 */
afterEach(() => {
  vi.restoreAllMocks();
});

const settle = () =>
  act(async () => {
    for (let i = 0; i < 20; i += 1) await new Promise((r) => setTimeout(r, 0));
  });

const blank = { visual: {}, sizing: {}, descendantOverrides: [] };
const imageNode = (id: string, src: string, group?: string): NodeEntry =>
  ({
    kind: "node",
    id,
    definitionId: "lib:definition:type-Image",
    children: [],
    props: {
      src: { kind: "set", value: src },
      alt: { kind: "set", value: id },
      ...(group ? { group: { kind: "set", value: group } } : {}),
    },
    ...blank,
  }) as NodeEntry;

it("an ImageCoordinator reveals its Images together — another group's Image is not held", async () => {
  vi.spyOn(console, "warn").mockImplementation(() => {});
  const h = await openAdr280Preview(["ImageCoordinator"]);
  const coordinator = h.ids[0] as NodeId;
  const root = h.workspace.root;
  // (The palette puts an Image inside the selected ImageCoordinator — its origin root is a slot.)
  const placed: NodeId[] = [];
  for (const alt of ["a", "b", "c"]) {
    const record = [...root.domInputs.values()].find(
      (item) => item.sourceId === coordinator,
    )!;
    h.workspace.selectRecords([record.id]);
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
      "Image",
    );
    expect(plan.command).toBeDefined();
    h.workspace.execute(plan.command!);
    const image = [...h.workspace.root.domInputs.values()].find(
      (item) =>
        h.workspace.root.typeOf(item) === "Image" &&
        !placed.includes(item.sourceId as NodeId),
    )!;
    placed.push(image.sourceId as NodeId);
    h.declare(image.sourceId as NodeId, {
      src: `https://img.example.test/${alt}.png`,
      alt,
      ...(alt === "c" ? { group: "other" } : {}),
    });
  }
  await settle();
  const img = (alt: string) =>
    document.querySelector(`img[alt="${alt}"]`) as HTMLElement;
  const state = (alt: string) =>
    img(alt).parentElement!.getAttribute("data-image-state");
  await waitFor(() => expect(img("c")).toBeTruthy());
  // (no element of its own)
  expect(
    document.querySelector(`[data-catalog-id="${coordinator}"]`),
  ).toBeNull();
  act(() => {
    fireEvent.load(img("a"));
    fireEvent.load(img("c"));
  });
  expect(state("a")).toBe("loaded");
  expect(state("c")).toBe("shown");
  act(() => {
    fireEvent.load(img("b"));
  });
  expect(state("a")).toBe("shown");
  expect(state("b")).toBe("shown");
  h.view.unmount();
});

it("a Card coordinates the pictures in it (S2 Card's ImageCoordinator)", async () => {
  vi.spyOn(console, "warn").mockImplementation(() => {});
  const h = await openAdr280Preview(["Card"]);
  const card = h.ids[0] as NodeId;
  h.workspace.execute(
    insertNodes({
      parent: { kind: "node", id: card },
      entries: [
        imageNode("project:node:img-a", "https://img.example.test/a.png"),
        imageNode("project:node:img-b", "https://img.example.test/b.png"),
      ],
      rootIds: ["project:node:img-a" as NodeId, "project:node:img-b" as NodeId],
      newId: h.workspace.newId,
    }),
  );
  h.flush();
  await settle();
  const img = (alt: string) =>
    document.querySelector(`img[alt="project:node:img-${alt}"]`) as HTMLElement;
  await waitFor(() => expect(img("b")).toBeTruthy());
  act(() => {
    fireEvent.load(img("a"));
  });
  expect(img("a").parentElement!.getAttribute("data-image-state")).toBe(
    "loaded",
  );
  act(() => {
    fireEvent.load(img("b"));
  });
  expect(img("a").parentElement!.getAttribute("data-image-state")).toBe(
    "shown",
  );
  h.view.unmount();
});

it("a CardView reveals the pictures of all its cards together (S2 CardView's ImageCoordinator)", async () => {
  vi.spyOn(console, "warn").mockImplementation(() => {});
  const h = await openAdr280Preview(["CardView"]);
  const root = h.workspace.root;
  const cards = [
    ...new Set(
      [...root.domInputs.values()]
        .filter(
          (item) =>
            root.typeOf(item) === "Card" &&
            String(item.sourceId).startsWith("project:node:"),
        )
        .map((item) => item.sourceId as NodeId),
    ),
  ];
  expect(cards.length).toBeGreaterThanOrEqual(2);
  for (const [index, card] of cards.slice(0, 2).entries()) {
    const id = `project:node:card-img-${index}`;
    h.workspace.execute(
      insertNodes({
        parent: { kind: "node", id: card },
        entries: [imageNode(id, `https://img.example.test/card-${index}.png`)],
        rootIds: [id as NodeId],
        newId: h.workspace.newId,
      }),
    );
  }
  h.flush();
  await settle();
  const img = (index: number) =>
    document.querySelector(
      `img[alt="project:node:card-img-${index}"]`,
    ) as HTMLElement;
  await waitFor(() => expect(img(1)).toBeTruthy());
  act(() => {
    fireEvent.load(img(0));
  });
  // (card 0's picture waits for card 1's — one coordinator around the whole view)
  expect(img(0).parentElement!.getAttribute("data-image-state")).toBe("loaded");
  act(() => {
    fireEvent.load(img(1));
  });
  expect(img(0).parentElement!.getAttribute("data-image-state")).toBe("shown");
  h.view.unmount();
});
