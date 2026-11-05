import { act } from "react";
import { createRoot } from "react-dom/client";
import { afterAll, beforeAll, expect, it } from "vitest";
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
  await initEngineWasm();
  library = await buildCodeCatalogLibrary();
  injectPreviewBaseStyles(document);
  css = document.createElement("style");
  css.textContent = bundleCss;
  document.head.append(css);
});
afterAll(() => css.remove());

for (const mode of ["single", "multiple"]) {
  it.each(["S", "M", "L", "XL"])(
    `Select ${mode} %s: 선택값과 요약은 trigger 글자 크기를 따른다`,
    async (size) => {
      const workspace = new CatalogWorkspace(
        new CatalogGraph(
          newCatalogProjectDocument({
            projectId: "project:project:value-size",
            name: "Value size",
          }),
          library,
        ),
        new CatalogStorage(indexedDB, `value-size-${crypto.randomUUID()}`),
        {
          engine: createLayoutEngine(),
          viewport: { width: 800, height: 700 },
          autosaveSchedule: () => {},
        },
      );
      const host = document.createElement("div");
      document.body.append(host);
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
            "Select",
            { size, selectionMode: mode },
          )!,
        );
        const root = workspace.root;
        const owner = [...root.domInputs.values()].find(
          (n) => root.typeOf(n) === "Select",
        )!;
        const items = [...root.domInputs.values()].filter(
          (n) => root.typeOf(n) === "ListBoxItem",
        );
        for (const count of mode === "single" ? [0, 1] : [0, 1, 2]) {
          for (const [index, item] of items.entries())
            workspace.execute(
              setFields({
                targets: [workspace.itemOfRecord(item.id)!.target],
                props: { isSelected: { kind: "set", value: index < count } },
              }),
            );
          await act(async () => {
            reactRoot.unmount();
            reactRoot = createRoot(host);
            reactRoot.render(renderCatalogDom(root, owner.id));
          });
          const value = host.querySelector<HTMLElement>(
            ".react-aria-SelectValue",
          )!;
          const label =
            value.querySelector<HTMLElement>('[slot="label"]') ?? value;
          expect(label.textContent?.length).toBeGreaterThan(0);
          expect(
            getComputedStyle(label).fontSize,
            JSON.stringify({ count, html: value.outerHTML }),
          ).toBe(getComputedStyle(value).fontSize);
          expect(value.hasAttribute("data-placeholder")).toBe(count === 0);
          expect(!!value.querySelector("[data-picker-selected-count]")).toBe(
            count > 1,
          );
          for (const phase of ["resize", "undo"]) {
            if (phase === "resize")
              workspace.execute(
                setFields({
                  targets: [workspace.itemOfRecord(owner.id)!.target],
                  props: {
                    size: { kind: "set", value: size === "XL" ? "S" : "XL" },
                  },
                }),
              );
            else workspace.undo();
            await act(async () =>
              reactRoot.render(renderCatalogDom(root, owner.id)),
            );
            const resized = host.querySelector<HTMLElement>(
              ".react-aria-SelectValue",
            )!;
            const text =
              resized.querySelector<HTMLElement>('[slot="label"]') ?? resized;
            const expected =
              phase === "resize"
                ? size === "XL"
                  ? "12px"
                  : "18px"
                : (
                    { S: "12px", M: "14px", L: "16px", XL: "18px" } as Record<
                      string,
                      string
                    >
                  )[size];
            expect(getComputedStyle(text).fontSize, phase).toBe(expected);
            expect(getComputedStyle(text).lineHeight, phase).toBe(
              getComputedStyle(resized).lineHeight,
            );
            expect(getComputedStyle(text).fontWeight, phase).toBe(
              getComputedStyle(resized).fontWeight,
            );
          }
        }
      } finally {
        await act(async () => reactRoot.unmount());
        host.remove();
        workspace.dispose();
      }
    },
  );
}
