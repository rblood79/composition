// @vitest-environment jsdom
import "fake-indexeddb/auto";
import { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, describe, expect, it } from "vitest";
import { resolveToken, type TokenRef } from "@composition/rendering";
import {
  insertNodes,
  setFields,
} from "../../../../../../packages/shared/src/catalog/commands";
import { buildCodeCatalogLibrary } from "../../../../../../packages/shared/src/catalog/document/codeCatalogLibrary";
import { CatalogGraph } from "../../../../../../packages/shared/src/catalog/document/graph";
import type {
  EntryId,
  NodeId,
} from "../../../../../../packages/shared/src/catalog/document/types";
import { renderCatalogDom } from "../domBinding";
import { catalogPaletteDefinitionId } from "../paletteInsert";
import { newCatalogProjectDocument } from "../project";
import { catalogRatingStarShapes } from "../ruleShapes";
import { CatalogStorage } from "../storage";
import { CatalogWorkspace } from "../workspace";
import { nodeLayoutEngine } from "./support/nodeLayoutEngine";
import { getPaletteItems } from "../../panels/components/paletteItems";

/**
 * ADR-321 G4 — a Rating through the real composition root: its box (the star row × star + vertical
 * padding), the Canvas's stars (S2 star paths — full · half · empty) and the DOM's (`span.rating-star`)
 * at the same start value, size, color. Expected values are written out by hand (design-data
 * `rating` — S 16 · M 18 px stars, 4 apart; padding 4 · 7).
 */
const BODY = "project:node:home-body" as NodeId;
const PLACED = "project:node:placed" as NodeId;

async function place() {
  const library = await buildCodeCatalogLibrary();
  const workspace = new CatalogWorkspace(
    new CatalogGraph(
      newCatalogProjectDocument({
        projectId: "project:project:adr321-g4" as EntryId<"project">,
        name: "ADR-321 G4",
      }),
      library,
    ),
    new CatalogStorage(indexedDB, `adr321-g4-${Math.random()}`),
    {
      engine: await nodeLayoutEngine(),
      viewport: { width: 1920, height: 1080 },
      autosaveSchedule: () => {},
    },
  );
  workspace.execute(
    insertNodes({
      parent: { kind: "node", id: BODY },
      entries: [
        {
          kind: "node",
          id: PLACED,
          definitionId: catalogPaletteDefinitionId(library, "Rating"),
          children: [],
          props: {},
          visual: {},
          sizing: {},
          descendantOverrides: [],
        },
      ],
      rootIds: [PLACED],
      newId: workspace.newId,
    }),
  );
  const root = workspace.root;
  const rating = () =>
    [...root.canvasInputs.values()].find((r) => r.sourceId === PLACED)!;
  const box = () => {
    const id = rating().id;
    const rect = root.getGeometry([id]).get(id)!;
    return [rect.width, rect.height];
  };
  const write = (props: Record<string, unknown>) =>
    workspace.execute(
      setFields({
        targets: [workspace.itemOfRecord(rating().id)!.target],
        props: Object.fromEntries(
          Object.entries(props).map(([k, v]) => [k, { kind: "set", value: v }]),
        ) as never,
      }),
    );
  /** The Canvas's stars: `full` · `half` (outline + a left-half clip) · `empty`, each at its x · y. */
  const canvas = () => {
    const record = rating();
    const id = record.id;
    const rect = root.getGeometry([id]).get(id)!;
    const shapes = catalogRatingStarShapes({
      type: "Rating",
      node: record,
      rect: { x: 0, y: 0, width: rect.width, height: rect.height },
      theme: "light",
    } as never) as unknown as {
      x: number;
      y: number;
      width: number;
      fill: string;
      clip?: { width: number };
    }[];
    const stars: string[] = [];
    for (let i = 0; i < shapes.length; i++) {
      const shape = shapes[i]!;
      const next = shapes[i + 1];
      if (next?.clip && next.x === shape.x) {
        stars.push(`half@${shape.x},${shape.y}/${next.clip.width}`);
        i++;
      } else
        stars.push(`${isFilled(shape) ? "full" : "empty"}@${shape.x},${shape.y}`);
    }
    return { stars, fills: [...new Set(shapes.map((s) => s.fill))] };
  };
  return { workspace, root, rating, box, write, canvas };
}

// (The outline path has two subpaths — 「M5.506 … M9.979」; the filled one has one.)
const isFilled = (shape: unknown) =>
  ((shape as { d: string }).d.match(/M/g) ?? []).length === 1;

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
  await act(async () => react.render(renderCatalogDom(t.root, t.rating().id)));
  unmount = async () => act(async () => react.unmount());
  const element = host.querySelector<HTMLElement>(".react-aria-Rating")!;
  const stars = [...element.querySelectorAll<HTMLElement>(".rating-star")];
  return {
    element,
    stars: stars.map((star) => {
      const svgs = star.querySelectorAll("svg");
      const half = star.querySelector(".rating-star-half");
      const subpaths = (
        svgs[0]!.querySelector("path")!.getAttribute("d")!.match(/M/g) ?? []
      ).length;
      return half ? "half" : subpaths === 1 ? "full" : "empty";
    }),
    size: stars.map((star) => `${star.style.width} ${star.style.height}`),
    colors: [...new Set(stars.map((star) => star.style.color))],
  };
}

const color = (ref: string) => resolveToken(ref as TokenRef, "light");

describe("ADR-321 G4 — Rating 등록 · 정지 모양", () => {
  it("the palette offers the Rating beside the Slider", () => {
    const types = getPaletteItems().map((item) => item.type);
    expect(types.indexOf("Rating")).toBe(types.indexOf("Slider") + 1);
  });

  it("box = star row × (star + vertical padding): M 106 × 32, S 96 × 24", async () => {
    const t = await place();
    expect(t.box()).toEqual([106, 32]);
    t.write({ size: "S" });
    expect(t.box()).toEqual([96, 24]);
    t.workspace.undo();
    expect(t.box()).toEqual([106, 32]);
    t.workspace.dispose();
  });

  it("the start value's stars — Canvas = DOM: none placed (0), then 3, then display-only 2.5", async () => {
    const t = await place();
    // M: stars 18 apart 22 (18 + 4), top 7.
    expect(t.canvas().stars).toEqual([
      "empty@0,7",
      "empty@22,7",
      "empty@44,7",
      "empty@66,7",
      "empty@88,7",
    ]);
    expect((await dom(t)).stars).toEqual(Array(5).fill("empty"));
    t.write({ defaultValue: 3 });
    expect(t.canvas().stars).toEqual([
      "full@0,7",
      "full@22,7",
      "full@44,7",
      "empty@66,7",
      "empty@88,7",
    ]);
    expect((await dom(t)).stars).toEqual([
      "full",
      "full",
      "full",
      "empty",
      "empty",
    ]);
    // Input mode rounds to a whole star (2.5 → 3); display only keeps the half (decision 8).
    t.write({ defaultValue: 2.5 });
    expect((await dom(t)).stars).toEqual([
      "full",
      "full",
      "full",
      "empty",
      "empty",
    ]);
    t.write({ isReadOnly: true });
    expect(t.canvas().stars).toEqual([
      "full@0,7",
      "full@22,7",
      "half@44,7/9",
      "empty@66,7",
      "empty@88,7",
    ]);
    expect((await dom(t)).stars).toEqual([
      "full",
      "full",
      "half",
      "empty",
      "empty",
    ]);
    // `value` (the controlled twin) wins over the start value.
    t.write({ value: 5 });
    expect((await dom(t)).stars).toEqual(Array(5).fill("full"));
    t.workspace.dispose();
  });

  it("size S: 16 px stars 20 apart, top 4 — both consumers", async () => {
    const t = await place();
    t.write({ size: "S", defaultValue: 1 });
    expect(t.canvas().stars).toEqual([
      "full@0,4",
      "empty@20,4",
      "empty@40,4",
      "empty@60,4",
      "empty@80,4",
    ]);
    const d = await dom(t);
    expect(d.size).toEqual(Array(5).fill("16px 16px"));
    expect(d.stars[0]).toBe("full");
    t.workspace.dispose();
  });

  it("color: neutral content · emphasized accent content · disabled wins (Canvas fill = DOM color variable)", async () => {
    const t = await place();
    t.write({ defaultValue: 2 });
    expect(t.canvas().fills).toEqual([color("{color.neutral-content}")]);
    expect((await dom(t)).colors).toEqual(["var(--neutral-content)"]);
    t.write({ isEmphasized: true });
    expect(t.canvas().fills).toEqual([color("{color.accent-content}")]);
    expect((await dom(t)).colors).toEqual(["var(--accent-content)"]);
    t.write({ isDisabled: true });
    expect(t.canvas().fills).toEqual([color("{color.disabled-content}")]);
    expect((await dom(t)).colors).toEqual(["var(--fg-disabled)"]);
    t.workspace.dispose();
  });
});
