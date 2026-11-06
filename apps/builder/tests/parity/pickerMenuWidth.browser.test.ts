import { act } from "react";
import { createRoot } from "react-dom/client";
import { afterAll, beforeAll, expect, it } from "vitest";
import { page as browserPage } from "vitest/browser";
import bundleCss from "@composition/shared/components/styles/index.css?inline";
import { injectPreviewBaseStyles } from "@/preview/baseStyles";
import { initEngineWasm } from "@/builder/workspace/canvas/wasm-bindings/engineWasm";
import { createLayoutEngine } from "@/builder/workspace/canvas/wasm-bindings/layoutBridge";
import { CatalogWorkspace } from "@/builder/catalogRuntime/workspace";
import { CatalogStorage } from "@/builder/catalogRuntime/storage";
import { newCatalogProjectDocument } from "@/builder/catalogRuntime/project";
import { catalogPaletteInsertCommand } from "@/builder/catalogRuntime/paletteInsert";
import { renderCatalogDom } from "@/builder/catalogRuntime/domBinding";
import { CatalogGraph } from "../../../../packages/shared/src/catalog/document/graph";
import { buildCodeCatalogLibrary } from "../../../../packages/shared/src/catalog/document/codeCatalogLibrary";
import { setFields } from "../../../../packages/shared/src/catalog/commands";
import type { CatalogLibrary } from "../../../../packages/shared/src/catalog/document/types";

let library: CatalogLibrary;
let css: HTMLStyleElement;
beforeAll(async () => {
  await browserPage.viewport(800, 700);
  (
    globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }
  ).IS_REACT_ACT_ENVIRONMENT = true;
  await initEngineWasm();
  library = await buildCodeCatalogLibrary();
  injectPreviewBaseStyles(document);
  css = document.createElement("style");
  css.textContent = bundleCss;
  document.head.append(css);
});
afterAll(() => css.remove());

for (const type of ["Select", "ComboBox"]) {
  it.each([
    { name: "default", props: {}, width: 240 },
    { name: "menuWidth", props: { menuWidth: 320 }, width: 320 },
    ...(type === "Select"
      ? [
          {
            name: "quiet",
            props: { isQuiet: true, menuWidth: 320 },
            width: 216,
          },
        ]
      : []),
  ])(
    `${type} $name: 기본 폭과 저작 폭·복원이 Canvas/DOM에 일치한다`,
    async ({ props, width }) => {
      const workspace = new CatalogWorkspace(
        new CatalogGraph(
          newCatalogProjectDocument({
            projectId: "project:project:picker-width",
            name: "Picker width",
          }),
          library,
        ),
        new CatalogStorage(indexedDB, `picker-width-${crypto.randomUUID()}`),
        {
          engine: createLayoutEngine(),
          viewport: { width: 800, height: 700 },
          autosaveSchedule: () => {},
        },
      );
      const host = document.body.appendChild(document.createElement("div"));
      host.style.width = "600px";
      let reactRoot = createRoot(host);
      try {
        workspace.execute(
          catalogPaletteInsertCommand(
            {
              graph: workspace.runtime.graph,
              records: workspace.root.domInputs,
              selection: () => [],
              itemOfRecord: (id) => workspace.itemOfRecord(id),
              pageContent: () => ({
                kind: "node",
                id: "project:node:home-body",
              }),
              newId: workspace.newId,
            },
            type,
            { ...props, isOpen: true },
          )!,
        );
        const root = workspace.root;
        const of = (name: string) =>
          [...root.domInputs.values()].find((n) => root.typeOf(n) === name)!;
        const owner = of(type);
        const popover = of("Popover");
        // 트리거 폭을 고정해 글꼴·문구 측정과 메뉴 폭 계약을 분리한다.
        const trigger = type === "Select" ? of("Button") : of("Group");
        workspace.execute(
          setFields({
            targets: [workspace.itemOfRecord(trigger.id)!.target],
            visual: { width: { kind: "set", value: 240 } },
          }),
        );
        const target = workspace.itemOfRecord(popover.id)!.target;
        for (const phase of ["default", "authored", "undo", "redo", "reset"]) {
          if (phase !== "default") {
            await act(async () => reactRoot.unmount());
            reactRoot = createRoot(host);
          }
          if (phase === "authored")
            workspace.execute(
              setFields({
                targets: [target],
                visual: { width: { kind: "set", value: 340 } },
              }),
            );
          if (phase === "undo") workspace.undo();
          if (phase === "redo") workspace.redo();
          if (phase === "reset")
            workspace.execute(
              setFields({
                targets: [target],
                visual: { width: { kind: "remove" } },
              }),
            );
          await act(async () =>
            reactRoot.render(renderCatalogDom(root, owner.id)),
          );
          await expect
            .poll(() => document.querySelector(".react-aria-Popover"))
            .not.toBeNull();
          const expected =
            phase === "authored" || phase === "redo" ? 340 : width;
          await expect
            .poll(
              () =>
                document
                  .querySelector(".react-aria-Popover")!
                  .getBoundingClientRect().width,
              { message: `${phase} DOM` },
            )
            .toBeCloseTo(expected, 0);
          expect(
            root.getGeometry([popover.id]).get(popover.id)!.width,
            `${phase} Canvas`,
          ).toBeCloseTo(expected, 0);
        }
      } finally {
        await act(async () => reactRoot.unmount());
        host.remove();
      }
    },
  );
}
