import "fake-indexeddb/auto";
import { afterEach, expect, it } from "vitest";
import { CatalogGraph } from "../../../../../../packages/shared/src/catalog/document/graph";
import { buildCodeCatalogLibrary } from "../../../../../../packages/shared/src/catalog/document/codeCatalogLibrary";
import type { EntryId } from "../../../../../../packages/shared/src/catalog/document/types";
import { installThemeMaps } from "../../../../../../packages/shared/src/catalog/runtime/themeMaps";
import { createCatalogThemesHost } from "../../panels/themes/catalog/catalogThemesHost";
import { getSkiaNode } from "../../workspace/canvas/skia/useSkiaNode";
import type { SkiaNodeData } from "../../workspace/canvas/skia/nodeRendererTypes";
import { bindCatalogCanvas } from "../canvasBinding";
import { COMPONENTS_VIEW } from "../originView";
import { newCatalogProjectDocument } from "../project";
import { CatalogStorage } from "../storage";
import { catalogThemeState } from "../theme";
import { CatalogWorkspace } from "../workspace";
import { nodeLayoutEngine } from "./support/nodeLayoutEngine";

afterEach(() => installThemeMaps(null));

const textOf = (data: SkiaNodeData | undefined): SkiaNodeData["text"] =>
  data?.text ??
  (data?.children ?? []).map(textOf).find((text) => text !== undefined);

it.each(["light", "dark"] as const)(
  "Library 전체를 %s Canvas에 바인딩하고 진행률 값의 nowrap을 보존한다",
  async (darkMode) => {
    const workspace = new CatalogWorkspace(
      new CatalogGraph(
        newCatalogProjectDocument({
          projectId: "project:project:library-canvas" as EntryId<"project">,
          name: "Library Canvas",
        }),
        await buildCodeCatalogLibrary(),
      ),
      new CatalogStorage(indexedDB, `library-canvas-${Math.random()}`),
      {
        engine: await nodeLayoutEngine(),
        viewport: { width: 1920, height: 1080 },
        autosaveSchedule: () => {},
        theme: catalogThemeState,
      },
    );
    try {
      const host = createCatalogThemesHost(workspace);
      host.setActiveThemeBaseTypography({ fontFamily: "Noto Serif KR, serif" });
      host.setActiveThemePreset({ darkMode });
      for (const opening of ["first", "reopen"]) {
        if (opening === "reopen") workspace.showDefinition(undefined);
        workspace.showDefinition(COMPONENTS_VIEW);
        const root = workspace.root;
        const canvas = bindCatalogCanvas(root, root.pageRootRecords());
        try {
          for (const type of ["ProgressBarValue", "MeterValue"]) {
            const values = [...root.canvasInputs.values()].filter(
              (node) => root.typeOf(node) === type && !node.hidden,
            );
            expect(values.length).toBeGreaterThan(0);
            for (const node of values) {
              expect(node.visual.whiteSpace).toBe("nowrap");
              expect(textOf(getSkiaNode(node.id))?.whiteSpace).toBe("nowrap");
            }
          }
        } finally {
          canvas.dispose();
        }
      }
    } finally {
      workspace.dispose();
    }
  },
);
