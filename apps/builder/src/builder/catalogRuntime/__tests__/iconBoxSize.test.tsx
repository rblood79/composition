// @vitest-environment jsdom
import "fake-indexeddb/auto";
import { act } from "react";
import { createRoot } from "react-dom/client";
import { describe, expect, it } from "vitest";
import {
  insertNodes,
  setFields,
} from "../../../../../../packages/shared/src/catalog/commands";
import { CatalogGraph } from "../../../../../../packages/shared/src/catalog/document/graph";
import { buildCodeCatalogLibrary } from "../../../../../../packages/shared/src/catalog/document/codeCatalogLibrary";
import type {
  EntryId,
  NodeEntry,
  NodeId,
} from "../../../../../../packages/shared/src/catalog/document/types";
import { bindCatalogCanvas } from "../canvasBinding";
import { catalogEffectiveStyle } from "../effectiveStyle";
import {
  catalogGlyphBoxClearCommand,
  catalogGlyphSizeCommand,
  catalogGlyphSizeIsCustom,
  catalogGlyphStepClearCommand,
} from "../glyphSize";
import { renderCatalogDom } from "../domBinding";
import { getSkiaNode } from "../../workspace/canvas/skia/useSkiaNode";
import { catalogPaletteDefinitionId } from "../paletteInsert";
import { newCatalogProjectDocument } from "../project";
import { CatalogStorage } from "../storage";
import { CatalogWorkspace } from "../workspace";
import { nodeLayoutEngine } from "./support/nodeLayoutEngine";

/**
 * 2026-11-07 (사용자 「icon 은 Appearance size 로만 조절되고 Layout 탭의 width · height 로는 변경되지
 * 않는다」): the Layout tab's px width · height (`sizing`) is the Icon's box, and the glyph fills that
 * box — the smaller authored axis, less padding and border — on all three consumers (the layout input,
 * the Canvas glyph, the Preview svg). Without an authored box the authored font size, then the size
 * scale's S2 icon step, as before.
 */
const BODY = "project:node:home-body" as NodeId;
const ICON = "project:node:icon" as NodeId;

async function open() {
  const library = await buildCodeCatalogLibrary();
  const workspace = new CatalogWorkspace(
    new CatalogGraph(
      newCatalogProjectDocument({
        projectId: "project:project:icon-box" as EntryId<"project">,
        name: "Icon box",
      }),
      library,
    ),
    new CatalogStorage(indexedDB, `icon-box-${Math.random()}`),
    {
      engine: await nodeLayoutEngine(),
      viewport: { width: 1200, height: 800 },
      autosaveSchedule: () => {},
    },
  );
  workspace.execute(
    insertNodes({
      parent: { kind: "node", id: BODY },
      entries: [
        {
          kind: "node",
          id: ICON,
          definitionId: catalogPaletteDefinitionId(library, "Icon"),
          children: [],
          props: {},
          visual: {},
          sizing: {},
          descendantOverrides: [],
        } as NodeEntry,
      ],
      rootIds: [ICON],
      newId: workspace.newId,
    }),
  );
  const icon = () =>
    [...workspace.root.canvasInputs.values()].find((r) => workspace.root.typeOf(r) === "Icon")!;
  const write = (fields: Parameters<typeof setFields>[0]) =>
    workspace.execute(setFields(fields));
  const target = [{ kind: "node" as const, id: ICON }];
  const rect = () => workspace.root.getGeometry([icon().id]).get(icon().id)!;
  const canvasGlyph = () => {
    const binding = bindCatalogCanvas(workspace.root, workspace.root.pageRootRecords());
    const node = getSkiaNode(icon().id);
    binding.dispose();
    return node?.iconPath?.size;
  };
  const domSvg = async () => {
    (
      globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }
    ).IS_REACT_ACT_ENVIRONMENT = true;
    const host = document.body.appendChild(document.createElement("div"));
    const reactRoot = createRoot(host);
    const id = [...workspace.root.domInputs.values()].find(
      (r) => workspace.root.typeOf(r) === "Icon",
    )!.id;
    await act(async () => reactRoot.render(renderCatalogDom(workspace.root, id)));
    const el = host.querySelector<HTMLElement>(`[data-catalog-id="${id}"]`)!;
    const svg = el.querySelector("svg")!;
    const out = {
      width: el.style.width,
      height: el.style.height,
      svg: svg.getAttribute("width"),
    };
    await act(async () => reactRoot.unmount());
    host.remove();
    return out;
  };
  const effective = () => catalogEffectiveStyle(icon());
  const run = (command: Parameters<typeof workspace.execute>[0]) =>
    workspace.execute(command);
  const setBreakpoint = (bp: "desktop" | "tablet" | "mobile") =>
    workspace.setBreakpoint(bp);
  return {
    write,
    target,
    rect,
    canvasGlyph,
    domSvg,
    effective,
    icon,
    run,
    setBreakpoint,
  };
}

describe("Icon — the Layout width · height sizes the glyph", () => {
  it("a px width alone: a square box that size, the glyph fills it (layout · Canvas · Preview)", async () => {
    const scene = await open();
    scene.write({
      targets: scene.target,
      sizing: { width: { kind: "set", value: 48 } },
    });
    expect([scene.rect().width, scene.rect().height]).toEqual([48, 48]);
    expect(scene.canvasGlyph()).toBe(48);
    expect(await scene.domSvg()).toEqual({
      width: "48px",
      height: "48px",
      svg: "48",
    });
  });

  it("width and height: the glyph is the smaller axis, centred in the box", async () => {
    const scene = await open();
    scene.write({
      targets: scene.target,
      sizing: {
        width: { kind: "set", value: 64 },
        height: { kind: "set", value: 40 },
      },
    });
    expect([scene.rect().width, scene.rect().height]).toEqual([64, 40]);
    expect(scene.canvasGlyph()).toBe(40);
    expect((await scene.domSvg()).svg).toBe("40");
  });

  it("the box wins over an authored font size; padding comes off the glyph", async () => {
    const scene = await open();
    scene.write({
      targets: scene.target,
      visual: {
        fontSize: { kind: "set", value: 30 },
        padding: { kind: "set", value: 4 },
      },
      sizing: { height: { kind: "set", value: 56 } },
    });
    expect(scene.canvasGlyph()).toBe(48);
    expect((await scene.domSvg()).svg).toBe("48");
  });

  it("no authored box: the authored font size, then the size scale (unchanged)", async () => {
    const scene = await open();
    expect(scene.canvasGlyph()).toBe(18);
    scene.write({
      targets: scene.target,
      visual: { fontSize: { kind: "set", value: 30 } },
    });
    expect(scene.canvasGlyph()).toBe(30);
    expect((await scene.domSvg()).svg).toBe("30");
  });

  it("every panel shows the one size: Text Font Size and Layout Width · Height are the drawn square", async () => {
    const scene = await open();
    expect(scene.effective()).toMatchObject({
      fontSize: "18px",
      width: "18px",
      height: "18px",
    });
    scene.write({
      targets: scene.target,
      sizing: {
        width: { kind: "set", value: 64 },
        height: { kind: "set", value: 40 },
      },
    });
    expect(scene.effective()).toMatchObject({
      fontSize: "40px",
      width: "64px",
      height: "40px",
    });
    expect(catalogGlyphSizeIsCustom(scene.icon())).toBe(true);
  });

  it("the Size number (and a Text Font Size write) sets the font size and lets the box go", async () => {
    const scene = await open();
    scene.write({
      targets: scene.target,
      sizing: {
        width: { kind: "set", value: 64 },
        height: { kind: "set", value: 40 },
      },
    });
    scene.run(
      catalogGlyphSizeCommand({
        targets: scene.target,
        breakpoint: "desktop",
        px: 30,
      }),
    );
    expect([scene.rect().width, scene.rect().height]).toEqual([30, 30]);
    expect(scene.canvasGlyph()).toBe(30);
    expect(scene.effective()).toMatchObject({ fontSize: "30px" });
    // (The Text tab's path: its font-size write plus the box clear.)
    scene.write({
      targets: scene.target,
      sizing: { width: { kind: "set", value: 50 } },
    });
    scene.write({
      targets: scene.target,
      visual: { fontSize: { kind: "set", value: 24 } },
    });
    scene.run(
      catalogGlyphBoxClearCommand({
        targets: scene.target,
        breakpoint: "desktop",
      }),
    );
    expect(scene.canvasGlyph()).toBe(24);
    expect((await scene.domSvg()).svg).toBe("24");
  });

  it("a Size step pick clears the font size and box so the step is drawn", async () => {
    const scene = await open();
    scene.write({
      targets: scene.target,
      visual: { fontSize: { kind: "set", value: 30 } },
      sizing: { width: { kind: "set", value: 64 } },
    });
    scene.write({
      targets: scene.target,
      props: { size: { kind: "set", value: "XL" } },
    });
    scene.run(
      catalogGlyphStepClearCommand({
        targets: scene.target,
        breakpoint: "desktop",
      }),
    );
    expect(scene.canvasGlyph()).toBe(22);
    expect(catalogGlyphSizeIsCustom(scene.icon())).toBe(false);
  });

  it("at a breakpoint the clear masks the base layer's box", async () => {
    const scene = await open();
    scene.write({
      targets: scene.target,
      sizing: { width: { kind: "set", value: 64 } },
    });
    scene.run(
      catalogGlyphSizeCommand({
        targets: scene.target,
        breakpoint: "mobile",
        px: 30,
      }),
    );
    // Desktop keeps its box; mobile draws the number (its layer's `null` size covers the box).
    expect(scene.canvasGlyph()).toBe(64);
    scene.setBreakpoint("mobile");
    expect(scene.canvasGlyph()).toBe(30);
    expect([scene.rect().width, scene.rect().height]).toEqual([30, 30]);
    // A step pick there masks the mobile font size too.
    scene.write({
      targets: scene.target,
      props: { size: { kind: "set", value: "L" } },
    });
    scene.run(
      catalogGlyphStepClearCommand({
        targets: scene.target,
        breakpoint: "mobile",
      }),
    );
    expect(scene.canvasGlyph()).toBe(20);
    scene.setBreakpoint("desktop");
    expect(scene.canvasGlyph()).toBe(64);
  });
});
