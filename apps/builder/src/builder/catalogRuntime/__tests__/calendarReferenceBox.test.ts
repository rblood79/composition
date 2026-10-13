import "fake-indexeddb/auto";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { insertNodes } from "../../../../../../packages/shared/src/catalog/commands";
import { CatalogGraph } from "../../../../../../packages/shared/src/catalog/document/graph";
import { buildCodeCatalogLibrary } from "../../../../../../packages/shared/src/catalog/document/codeCatalogLibrary";
import type {
  NodeEntry,
  NodeId,
} from "../../../../../../packages/shared/src/catalog/document/types";
import { catalogPaletteDefinitionId } from "../paletteInsert";
import { newCatalogProjectDocument } from "../project";
import { catalogRuleShapes } from "../ruleShapes";
import { CatalogStorage } from "../storage";
import { CatalogWorkspace } from "../workspace";
import { nodeLayoutEngine } from "./support/nodeLayoutEngine";

/**
 * Calendar · RangeCalendar box (사용자 2026-10-13 「RAC, RSC 레퍼런스 모두 border 가 존재하지 않고
 * padding 도 없다」 · 「같이 지워」 — 배경 · hover · pressed 배경도): the RAC starter's
 * `.react-aria-Calendar` and S2 `calendarStyles` draw no border, no padding and no background — a picker's room around its calendar is its Popover's padding (S2
 * `CalendarPopover` · our Popover rule). Both consumers: the Canvas paints no border and places
 * the months at the box's origin; the generated sheet declares neither.
 */
const OWNER = "project:node:calendar" as NodeId;
const TYPES = ["Calendar", "RangeCalendar"] as const;

async function open(type: (typeof TYPES)[number]) {
  const library = await buildCodeCatalogLibrary();
  const workspace = new CatalogWorkspace(
    new CatalogGraph(
      newCatalogProjectDocument({
        projectId: "project:project:calendar-box" as const,
        name: "Calendar box",
      }),
      library,
    ),
    new CatalogStorage(indexedDB, `calendar-box-${Math.random()}`),
    {
      engine: await nodeLayoutEngine(),
      viewport: { width: 1200, height: 900 },
      autosaveSchedule: () => {},
      locale: "en-US",
    },
  );
  workspace.execute(
    insertNodes({
      parent: { kind: "node", id: "project:node:home-body" as NodeId },
      entries: [
        {
          kind: "node",
          id: OWNER,
          definitionId: catalogPaletteDefinitionId(library, type),
          children: [],
          props: {},
          visual: {},
          sizing: {},
          descendantOverrides: [],
        } as NodeEntry,
      ],
      rootIds: [OWNER],
      newId: workspace.newId,
    }),
  );
  const root = workspace.root;
  const record = [...root.canvasInputs.values()].find(
    (item) => item.sourceId === OWNER,
  )!;
  const children = [...record.children];
  const geometry = root.getGeometry([record.id, ...children]);
  const box = geometry.get(record.id)!;
  const shapesIn = (state?: "hover" | "pressed") =>
    catalogRuleShapes({
      node: record,
      rect: { width: box.width, height: box.height },
      rule: workspace.runtime.graph.library.rules.get(type as never)!,
      type,
      authoredVisual: {},
      ...(state ? { state } : {}),
    });
  return {
    box,
    children: children.map((id) => geometry.get(id)!),
    shapes: shapesIn(),
    shapesIn,
  };
}

describe("Calendar · RangeCalendar box = the references' (no border, no padding)", () => {
  for (const type of TYPES)
    it(`${type}: the Canvas paints no border and places its content at the origin`, async () => {
      const { box, children, shapes } = await open(type);
      expect(shapes.filter((shape) => shape.type === "border")).toEqual([]);
      expect(children.length).toBeGreaterThan(0);
      const left = Math.min(...children.map((child) => child.x));
      const top = Math.min(...children.map((child) => child.y));
      const right = Math.max(...children.map((child) => child.x + child.width));
      const bottom = Math.max(
        ...children.map((child) => child.y + child.height),
      );
      expect({ left, top, right, bottom }).toEqual({
        left: 0,
        top: 0,
        right: box.width,
        bottom: box.height,
      });
    });

  for (const type of TYPES)
    it(`${type}: the Canvas fills nothing — at rest, hovered or pressed`, async () => {
      const { shapesIn } = await open(type);
      for (const state of [undefined, "hover", "pressed"] as const) {
        const fills = shapesIn(state)
          .filter((shape) => shape.type === "roundRect")
          .map((shape) => (shape as { fill?: unknown }).fill);
        expect(
          fills.filter(
            (fill) => fill !== "{color.transparent}" && fill !== "transparent",
          ),
          String(state),
        ).toEqual([]);
      }
    });

  for (const type of TYPES)
    it(`${type}: the generated sheet declares no border, no padding and no background`, () => {
      const css = readFileSync(
        join(
          dirname(fileURLToPath(import.meta.url)),
          `../../../../../../packages/shared/src/components/styles/generated/${type}.css`,
        ),
        "utf8",
      );
      const own = css
        .split("\n}")
        .filter((block) =>
          new RegExp(`\\.react-aria-${type}(\\[[^\\]]*\\])*\\s*\\{`).test(
            block.split("\n").find((line) => line.includes("{")) ?? "",
          ),
        )
        .join("\n");
      expect(own).toContain(`.react-aria-${type}`);
      expect(own).not.toMatch(/^\s*border(-width)?:(?!\s*none;)/m);
      expect(own).not.toMatch(/^\s*padding:(?!\s*0px 0px;)/m);
      expect(own).not.toMatch(/^\s*background:(?!\s*transparent;)/m);
    });
});
