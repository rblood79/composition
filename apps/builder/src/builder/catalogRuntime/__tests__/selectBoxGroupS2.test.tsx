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
import { renderCatalogDom } from "../domBinding";
import { getSkiaNode } from "../../workspace/canvas/skia/useSkiaNode";
import { catalogPaletteDefinitionId } from "../paletteInsert";
import { newCatalogProjectDocument } from "../project";
import { CatalogStorage } from "../storage";
import { CatalogWorkspace } from "../workspace";
import { nodeLayoutEngine } from "./support/nodeLayoutEngine";

/**
 * 2026-11-08 (사용자 「SelectBoxGroup 이 레퍼런스와 display 부터 다르며 boxShadow 등 스타일이 차이가
 * 난다」 — react-spectrum.adobe.com/SelectBoxGroup): S2 `SelectBoxGroup.tsx` lays the boxes on a grid
 * of equal columns (`repeat(auto-fit, minmax(144, 170))` vertical · `minmax(188, 368)` horizontal),
 * centred, the orientation on the ListBox; a box's elevation is its state tree (`emphasized` at rest,
 * `elevated` hovered or selected). The group was a flex wrap with no orientation, and the Canvas drew
 * no box shadow (it read only `containerStyles.boxShadow`).
 */
const GROUP = "project:node:group" as NodeId;

async function open() {
  const library = await buildCodeCatalogLibrary();
  const workspace = new CatalogWorkspace(
    new CatalogGraph(
      newCatalogProjectDocument({
        projectId: "project:project:select-box" as EntryId<"project">,
        name: "Select box",
      }),
      library,
    ),
    new CatalogStorage(indexedDB, `select-box-${Math.random()}`),
    {
      engine: await nodeLayoutEngine(),
      viewport: { width: 1200, height: 800 },
      autosaveSchedule: () => {},
    },
  );
  workspace.execute(
    insertNodes({
      parent: { kind: "node", id: "project:node:home-body" as NodeId },
      entries: [
        {
          kind: "node",
          id: GROUP,
          definitionId: catalogPaletteDefinitionId(library, "SelectBoxGroup"),
          children: [],
          props: {},
          visual: {},
          sizing: {},
          descendantOverrides: [],
        } as NodeEntry,
      ],
      rootIds: [GROUP],
      newId: workspace.newId,
    }),
  );
  const ofType = (type: string) =>
    [...workspace.root.canvasInputs.values()].filter(
      (r) => workspace.root.typeOf(r) === type,
    );
  const rect = (id: string) => workspace.root.getGeometry([id]).get(id)!;
  /** Each SelectBox's first box-shadow layer offset (`dy`) on the Canvas. */
  const shadowDy = () => {
    const binding = bindCatalogCanvas(
      workspace.root,
      workspace.root.pageRootRecords(),
    );
    const out = ofType("SelectBox").map(
      (r) =>
        getSkiaNode(r.id)?.effects?.find(
          (e) => e.type === "drop-shadow" && e.source === "box-shadow",
        ) as { dy: number } | undefined,
    );
    binding.dispose();
    return out.map((e) => e?.dy);
  };
  const domGroup = async () => {
    (
      globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }
    ).IS_REACT_ACT_ENVIRONMENT = true;
    const host = document.body.appendChild(document.createElement("div"));
    const reactRoot = createRoot(host);
    const id = [...workspace.root.domInputs.values()].find(
      (r) => workspace.root.typeOf(r) === "SelectBoxGroup",
    )!.id;
    await act(async () =>
      reactRoot.render(renderCatalogDom(workspace.root, id)),
    );
    const orientation = host
      .querySelector(".react-aria-SelectBoxGroup")
      ?.getAttribute("data-orientation");
    await act(async () => reactRoot.unmount());
    host.remove();
    return orientation;
  };
  return { workspace, ofType, rect, shadowDy, domGroup };
}

describe("SelectBoxGroup — S2 grid and box elevation", () => {
  it("the boxes sit in centred grid columns of S2's vertical width", async () => {
    const scene = await open();
    const group = rect(scene, "SelectBoxGroup")[0];
    const boxes = rect(scene, "SelectBox");
    expect(boxes.map((b) => [b.width, b.height])).toEqual([
      [170, 170],
      [170, 170],
    ]);
    // Two 170 columns and the 24 gap, centred in the group.
    const used = 170 * 2 + 24;
    expect(boxes[0].x - group.x).toBe((group.width - used) / 2);
    expect(boxes[1].x - boxes[0].x).toBe(170 + 24);
    expect(await scene.domGroup()).toBe("vertical");
  });

  it("horizontal: the group's columns and the ListBox orientation follow", async () => {
    const scene = await open();
    scene.workspace.execute(
      setFields({
        targets: [{ kind: "node", id: GROUP }],
        props: { orientation: { kind: "set", value: "horizontal" } },
      }),
    );
    const boxes = rect(scene, "SelectBox");
    expect(boxes.map((b) => b.width)).toEqual([368, 368]);
    expect(boxes[1].x - boxes[0].x).toBe(368 + 24);
    expect(await scene.domGroup()).toBe("horizontal");
  });

  it("the Canvas draws the state-tree elevation: elevated selected, emphasized at rest", async () => {
    const scene = await open();
    // (The origin's first box is selected — S2 `elevated` 0 4px; the second `emphasized` 0 2px.)
    expect(scene.shadowDy()).toEqual([4, 2]);
  });
});

function rect(scene: Awaited<ReturnType<typeof open>>, type: string) {
  return scene.ofType(type).map((r) => scene.rect(r.id));
}
