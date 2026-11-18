// @vitest-environment jsdom
import "fake-indexeddb/auto";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, describe, expect, it } from "vitest";
import {
  insertNodes,
  setFields,
} from "../../../../../../packages/shared/src/catalog/commands";
import { CatalogGraph } from "../../../../../../packages/shared/src/catalog/document/graph";
import { buildCodeCatalogLibrary } from "../../../../../../packages/shared/src/catalog/document/codeCatalogLibrary";
import type { NodeEntry } from "../../../../../../packages/shared/src/catalog/document/types";
import { renderCatalogDom } from "../domBinding";
import { catalogPaletteDefinitionId } from "../paletteInsert";
import { newCatalogProjectDocument } from "../project";
import { CatalogStorage } from "../storage";
import { CatalogWorkspace } from "../workspace";
import { nodeLayoutEngine } from "./support/nodeLayoutEngine";

/**
 * S2 마이그레이션 (2026-11-18) — S2 `DropZone.tsx`: the zone's content is an S2 IllustratedMessage
 * (`DropZone > IllustratedMessage > Illustration + Heading + Content`, the reference example) that
 * takes the zone's `size` (`IllustratedMessageContext`) and colors its picture accent while a drag
 * is over the zone (`isDropTarget` → `--iconPrimary`). The DropZone's `label` · `description` are
 * the message's heading and words (template binding); an empty description is no Text.
 */
const GENERATED = join(
  dirname(fileURLToPath(import.meta.url)),
  "../../../../../../packages/shared/src/components/styles/generated",
);

const cleanups: Array<() => Promise<void> | void> = [];
afterEach(async () => {
  while (cleanups.length) await cleanups.pop()!();
});

async function open(props: Record<string, unknown>) {
  const library = await buildCodeCatalogLibrary();
  const measure = (text: string, font: { fontSize: number }) => ({
    width: (text.length * font.fontSize) / 2,
    height: font.fontSize * 1.5,
  });
  const workspace = new CatalogWorkspace(
    new CatalogGraph(
      newCatalogProjectDocument({
        projectId: "project:project:dropzone-message" as const,
        name: "DropZone message",
      }),
      library,
    ),
    new CatalogStorage(indexedDB, `s2-dropzone-${Math.random()}`),
    {
      engine: await nodeLayoutEngine(),
      viewport: { width: 1000, height: 800 },
      autosaveSchedule: () => {},
      textMeasure: measure as never,
    },
  );
  cleanups.push(() => workspace.dispose());
  const id = "project:node:zone";
  workspace.execute(
    insertNodes({
      parent: { kind: "node", id: "project:node:home-body" },
      entries: [
        {
          kind: "node",
          id,
          definitionId: catalogPaletteDefinitionId(library, "DropZone"),
          children: [],
          props: Object.fromEntries(
            Object.entries(props).map(([k, v]) => [
              k,
              { kind: "set", value: v },
            ]),
          ),
          visual: {},
          sizing: {},
          descendantOverrides: [],
        } as NodeEntry,
      ],
      rootIds: [id as never],
      newId: workspace.newId,
    }),
  );
  const root = workspace.root;
  const records = () => [...root.canvasInputs.values()];
  const zone = () => records().find((r) => root.typeOf(r) === "DropZone")!;
  const childOf = (parentId: string, type: string) =>
    records().find((r) => r.parentId === parentId && root.typeOf(r) === type);
  const tree = () => {
    const z = zone();
    const message = childOf(z.id, "IllustratedMessage")!;
    const content = childOf(message.id, "Content")!;
    return {
      zone: z,
      message,
      illustration: childOf(message.id, "Illustration")!,
      heading: childOf(message.id, "Heading")!,
      text: childOf(content.id, "Text")!,
    };
  };
  const render = async () => {
    (
      globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }
    ).IS_REACT_ACT_ENVIRONMENT = true;
    const host = document.body.appendChild(document.createElement("div"));
    const reactRoot = createRoot(host);
    await act(async () => reactRoot.render(renderCatalogDom(root, zone().id)));
    cleanups.push(async () => {
      await act(async () => reactRoot.unmount());
      host.remove();
    });
    return host.querySelector<HTMLElement>(".react-aria-DropZone")!;
  };
  const set = (props: Record<string, string>) =>
    workspace.execute(
      setFields({
        targets: [{ kind: "node", id }],
        props: Object.fromEntries(
          Object.entries(props).map(([k, v]) => [k, { kind: "set", value: v }]),
        ),
      }),
    );
  return { workspace, root, tree, render, set };
}

describe("S2 DropZone — its content is an S2 IllustratedMessage", () => {
  it("the palette DropZone holds the message: the upload picture, the label as its heading, no words without a description", async () => {
    const { tree, root } = await open({});
    const { zone, message, illustration, heading, text } = tree();
    expect(illustration.props.iconName).toBe("upload");
    expect(heading.props.children).toBe("Drop files here");
    expect(text.hidden).toBe(true);
    const zoneBox = root.getGeometry([zone.id]).get(zone.id)!;
    const box = root.getGeometry([message.id]).get(message.id)!;
    // S2 `padding: 24` · `borderWidth: 2` around the message, which sits centered.
    expect(box.x).toBe(26);
    expect(box.x + box.width / 2).toBeCloseTo(zoneBox.width / 2, 1);
    expect(zoneBox.height).toBeCloseTo(box.height + 52, 1);
  });

  it("description: the message's words; the label edit is its heading (one step each)", async () => {
    const { tree, set } = await open({ description: "or select a file" });
    expect(tree().text.hidden).not.toBe(true);
    expect(tree().text.props.children).toBe("or select a file");
    set({ label: "Drop images" });
    expect(tree().heading.props.children).toBe("Drop images");
    set({ description: "" });
    expect(tree().text.hidden).toBe(true);
  });

  it.each([
    ["S", 96],
    ["M", 96],
    ["L", 160],
  ] as const)(
    "size %s reaches the message (S2 `IllustratedMessageContext`) — a %ipx picture, the DOM's data-size",
    async (size, picture) => {
      const { tree, root, render } = await open({ size });
      const { message, illustration } = tree();
      expect(message.props.size).toBe(size);
      const box = root.getGeometry([illustration.id]).get(illustration.id)!;
      expect([box.width, box.height]).toEqual([picture, picture]);
      const el = await render();
      expect(el.getAttribute("data-size")).toBe(size);
    },
  );

  it("the picture's color is the sheet's (rest `--fg` · accent while a drag is over the zone)", async () => {
    const { render } = await open({});
    const el = await render();
    const picture = el.querySelector<HTMLElement>(".react-aria-Illustration")!;
    expect(picture.style.color).toBe("");
    const css = readFileSync(`${GENERATED}/DropZone.css`, "utf8");
    expect(css).toMatch(
      /\.react-aria-DropZone\[data-drop-target\] \.react-aria-Illustration \{\s*color: var\(--accent-content\);/,
    );
    // S2 `borderStyle: {default: 'dashed', isDropTarget: 'solid'}` — the Canvas draws the rule's
    // dashed line too (the sheet wrote `solid` for every rule before 2026-11-18).
    expect(css).toMatch(
      /border: var\(--border-width-thick\) dashed var\(--border\);/,
    );
    expect(css).toMatch(
      /\.react-aria-DropZone\.react-aria-DropZone:where\(\[data-drop-target\]\) \{[^}]*border-style: solid;/,
    );
    // (The zone composes no words of its own — no content rules for them, 2026-11-18.)
    expect(css).not.toContain("dropzone-icon");
    expect(css).not.toContain('[slot="label"]');
  });
});
