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
import {
  setFields,
  setWholeField,
} from "../../../../packages/shared/src/catalog/commands";
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

// 행 가장자리를 기준으로 비교한다. 체크↔라벨 간격만 비교하면 두 부품을 함께
// 밀어내는 부모 CSS의 옛 24px gutter를 놓친다.
for (const [type, mode] of [
  ["Select", "single"],
  ["Select", "multiple"],
  ["ComboBox", "single"],
]) {
  it.each([
    ["S", 9],
    ["M", 12],
    ["L", 15],
    ["XL", 18],
  ] as const)(
    `${type} ${mode} %s: 항목 바깥 여백은 Canvas/DOM에서 한 번만 적용된다`,
    async (size, edge) => {
      const workspace = new CatalogWorkspace(
        new CatalogGraph(
          newCatalogProjectDocument({
            projectId: "project:project:picker-inset",
            name: "Picker inset",
          }),
          library,
        ),
        new CatalogStorage(indexedDB, `picker-inset-${crypto.randomUUID()}`),
        {
          engine: createLayoutEngine(),
          viewport: { width: 800, height: 700 },
          autosaveSchedule: () => {},
        },
      );
      const host = document.createElement("div");
      host.style.width = "600px";
      document.body.append(host);
      let reactRoot = createRoot(host);
      try {
        const command = catalogPaletteInsertCommand(
          {
            graph: workspace.runtime.graph,
            records: workspace.root.domInputs,
            selection: () => [],
            itemOfRecord: (id) => workspace.itemOfRecord(id),
            pageContent: () => ({ kind: "node", id: "project:node:home-body" }),
            newId: workspace.newId,
          },
          type,
          {
            size,
            isOpen: true,
            ...(type === "Select" ? { selectionMode: mode } : {}),
          },
        );
        workspace.execute(command!);
        const root = workspace.root;
        const owner = [...root.domInputs.values()].find(
          (n) => root.typeOf(n) === type,
        )!;
        const item = [...root.canvasInputs.values()].find(
          (n) => root.typeOf(n) === "ListBoxItem",
        )!;
        const mark = item.children
          .map((id) => root.canvasInputs.get(id)!)
          .find(
            (n) =>
              n.props.slot === "selection" &&
              root.typeOf(n) === (mode === "multiple" ? "Checkbox" : "Icon"),
          )!;
        const label = item.children
          .map((id) => root.canvasInputs.get(id)!)
          .find((n) => n.props.slot === "label")!;
        const labelTarget = workspace.itemOfRecord(label.id)!.target;
        if (labelTarget.kind !== "descendant")
          throw new Error("template label expected");
        const iconTarget = {
          ...labelTarget,
          address: {
            ...labelTarget.address,
            templatePath: labelTarget.address.templatePath.map(
              (id) => id.replace(/__label$/, "__icon") as typeof id,
            ),
          },
        };
        for (const phase of ["default", "icon", "authored", "undo"]) {
          if (phase !== "default") {
            await act(async () => reactRoot.unmount());
            reactRoot = createRoot(host);
          }
          if (phase === "icon") {
            workspace.execute(
              setWholeField({
                targets: [iconTarget],
                field: "enabled",
                value: true,
              }),
            );
            workspace.execute(
              setFields({
                targets: [iconTarget],
                props: { iconName: { kind: "set", value: "star" } },
              }),
            );
          } else if (phase === "authored")
            workspace.execute(
              setFields({
                targets: [workspace.itemOfRecord(item.id)!.target],
                visual: { paddingLeft: { kind: "set", value: 40 } },
              }),
            );
          else if (phase === "undo") workspace.undo();
          await act(async () =>
            reactRoot.render(renderCatalogDom(root, owner.id)),
          );
          await expect
            .poll(() => document.querySelector('[role="option"]'))
            .not.toBeNull();
          const row = document.querySelector<HTMLElement>('[role="option"]')!;
          const domMark = row.querySelector<HTMLElement>('[slot="selection"]')!;
          const domLabel = row.querySelector<HTMLElement>('[slot="label"]')!;
          const box = row.getBoundingClientRect();
          const geometry = root.getGeometry([mark.id, label.id]);
          const expected = phase === "authored" ? 40 : edge;
          expect(
            parseFloat(getComputedStyle(row).paddingLeft),
            phase,
          ).toBeCloseTo(expected);
          expect(geometry.get(mark.id)!.x, phase).toBeCloseTo(expected);
          expect(domMark.getBoundingClientRect().x - box.x, phase).toBeCloseTo(
            geometry.get(mark.id)!.x,
            1,
          );
          expect(domLabel.getBoundingClientRect().x - box.x, phase).toBeCloseTo(
            geometry.get(label.id)!.x,
            1,
          );
        }
      } finally {
        await act(async () => reactRoot.unmount());
        host.remove();
        workspace.dispose();
      }
    },
  );
}
