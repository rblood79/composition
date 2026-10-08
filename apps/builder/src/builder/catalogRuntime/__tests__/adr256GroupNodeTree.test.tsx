// @vitest-environment jsdom
import "fake-indexeddb/auto";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { act, render } from "@testing-library/react";
import { createElement } from "react";
import { Button, Group } from "react-aria-components";
import { afterEach, describe, expect, it } from "vitest";
import { insertNodes } from "../../../../../../packages/shared/src/catalog/commands";
import { CatalogGraph } from "../../../../../../packages/shared/src/catalog/document/graph";
import { buildCodeCatalogLibrary } from "../../../../../../packages/shared/src/catalog/document/codeCatalogLibrary";
import type {
  EntryId,
  NodeEntry,
  NodeId,
} from "../../../../../../packages/shared/src/catalog/document/types";
import { getSkiaNode } from "../../workspace/canvas/skia/useSkiaNode";
import { bindCatalogCanvas } from "../canvasBinding";
import { renderCatalogDom } from "../domBinding";
import { newCatalogProjectDocument } from "../project";
import { CatalogStorage } from "../storage";
import { CatalogWorkspace } from "../workspace";
import { nodeLayoutEngine } from "./support/nodeLayoutEngine";

/**
 * ADR-256 Phase 6a (G2) — RAC `Group` is a catalog type (Decision 8): the reference's
 * `div.react-aria-Group[role=group]` with its children in order, RAC's state on it, its render
 * props a state frame for `showWhen` nodes inside. No paint of its own (a neutral container).
 */
const BODY = "project:node:home-body" as NodeId;
const GROUP = "project:node:group" as NodeId;
const set = <T,>(value: T) => ({ kind: "set" as const, value });
const cleanups: Array<() => void> = [];
afterEach(() => {
  for (const cleanup of cleanups.splice(0).reverse()) cleanup();
});

const node = (
  id: string,
  definitionId: string,
  props: Record<string, unknown> = {},
  children: string[] = [],
  extra: Partial<NodeEntry> = {},
): NodeEntry =>
  ({
    kind: "node",
    id,
    definitionId,
    children,
    props: Object.fromEntries(
      Object.entries(props).map(([key, value]) => [key, set(value)]),
    ),
    visual: {},
    sizing: {},
    descendantOverrides: [],
    ...extra,
  }) as NodeEntry;

async function open(groupProps: Record<string, unknown> = {}) {
  const workspace = new CatalogWorkspace(
    new CatalogGraph(
      newCatalogProjectDocument({
        projectId: "project:project:adr256-group" as EntryId<"project">,
        name: "Group",
      }),
      await buildCodeCatalogLibrary(),
    ),
    new CatalogStorage(indexedDB, `adr256-group-${Math.random()}`),
    {
      engine: await nodeLayoutEngine(),
      viewport: { width: 1200, height: 800 },
      autosaveSchedule: () => {},
    },
  );
  workspace.root.execute(
    insertNodes({
      parent: { kind: "node", id: BODY },
      entries: [
        node(GROUP, "lib:definition:type-Group", groupProps, [
          "project:node:a",
          "project:node:b",
          "project:node:when-disabled",
        ]),
        node("project:node:a", "lib:definition:type-Button", {
          children: "A",
        }),
        node("project:node:b", "lib:definition:type-Button", {
          children: "B",
        }),
        node(
          "project:node:when-disabled",
          "lib:definition:text",
          { children: "off" },
          [],
          { showWhen: { all: ["isDisabled"] } } as Partial<NodeEntry>,
        ),
      ],
      rootIds: [GROUP],
      newId: workspace.newId,
    }),
  );
  cleanups.push(() => act(() => workspace.dispose()));
  const root = workspace.root;
  const record = (sourceId: string) =>
    [...root.domInputs.values()].find((r) => r.sourceId === sourceId)!;
  const draw = () => {
    const view = render(renderCatalogDom(root, record(GROUP).id));
    cleanups.push(() => view.unmount());
    return view.container.firstElementChild as HTMLElement;
  };
  return { workspace, root, record, draw };
}

/** tag · role · aria · RAC data state · text. */
function structure(element: Element): string {
  const attributes = [...element.attributes]
    .filter((a) => /^(role|aria-.*|data-disabled|data-invalid)$/.test(a.name))
    .map((a) => `${a.name}=${a.value}`)
    .sort();
  const content = [...element.childNodes].map((child) =>
    child.nodeType === 1
      ? structure(child as Element)
      : (child.textContent ?? "").trim(),
  );
  return `<${element.tagName.toLowerCase()} ${attributes.join(" ")}>${content.join("")}</>`;
}

describe("ADR-256 Phase 6a — RAC Group is a catalog type", () => {
  it("the reference structure: div.react-aria-Group[role=group] with its children in order", async () => {
    const { draw } = await open();
    const group = draw();
    const reference = render(
      createElement(
        Group,
        null,
        createElement(Button, null, "A"),
        createElement(Button, null, "B"),
      ),
    );
    cleanups.push(() => reference.unmount());
    expect(group.className).toContain("react-aria-Group");
    expect(structure(group)).toBe(
      structure(reference.container.firstElementChild!),
    );
  });

  it("RAC's state: disabled reaches the group and its showWhen nodes (the group's render props)", async () => {
    const { draw } = await open({ isDisabled: true, role: "region" });
    const group = draw();
    expect(group.getAttribute("role")).toBe("region");
    expect(group.hasAttribute("data-disabled")).toBe(true);
    expect(group.textContent).toContain("off");
  });

  it("no paint of its own: the Canvas box has no fill, the DOM no background", async () => {
    const { root, record, draw } = await open();
    const group = record(GROUP);
    // The Canvas draws the rule's fill on the record's box: none, or fully transparent.
    const canvas = bindCatalogCanvas(root, root.pageRootRecords());
    cleanups.push(() => canvas.dispose());
    const fill = getSkiaNode(group.id)?.box?.fillColor;
    expect(fill === undefined || fill[3] === 0).toBe(true);
    expect(draw().style.backgroundColor).toBe("");
    // The Preview stylesheet adds none either (the Canvas draws no outline, badge or disabled
    // dimming for a Group — the old layout group's builder indicators are gone).
    const css = readFileSync(
      resolve(
        __dirname,
        "../../../../../../packages/shared/src/components/styles/Group.css",
      ),
      "utf8",
    ).replace(/\/\*[\s\S]*?\*\//g, "");
    expect(css).not.toMatch(/opacity|outline|background|border|::before/);
    // (Its box holds its children — a container.)
    const rect = root.getGeometry([group.id]).get(group.id)!;
    expect(rect.width).toBeGreaterThan(0);
    expect(rect.height).toBeGreaterThan(0);
  });
});
