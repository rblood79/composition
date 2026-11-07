import { act } from "react";
import { createRoot } from "react-dom/client";
import { beforeAll, expect, it } from "vitest";
import { commands, userEvent } from "vitest/browser";
import bundleCss from "@composition/shared/components/styles/index.css?inline";
import { injectPreviewBaseStyles } from "@/preview/baseStyles";
import { initEngineWasm } from "@/builder/workspace/canvas/wasm-bindings/engineWasm";
import { createLayoutEngine } from "@/builder/workspace/canvas/wasm-bindings/layoutBridge";
import { CatalogWorkspace } from "@/builder/catalogRuntime/workspace";
import { CatalogCompositionRoot } from "@/builder/catalogRuntime/compositionRoot";
import { CatalogStorage } from "@/builder/catalogRuntime/storage";
import { newCatalogProjectDocument } from "@/builder/catalogRuntime/project";
import { catalogPaletteDefinitionId } from "@/builder/catalogRuntime/paletteInsert";
import { renderCatalogDom } from "@/builder/catalogRuntime/domBinding";
import { bindCatalogCanvas } from "@/builder/catalogRuntime/canvasBinding";
import { getSkiaNode } from "@/builder/workspace/canvas/skia/useSkiaNode";
import { CatalogGraph } from "../../../../packages/shared/src/catalog/document/graph";
import { buildCodeCatalogLibrary } from "../../../../packages/shared/src/catalog/document/codeCatalogLibrary";
import {
  insertNodes,
  setFields,
} from "../../../../packages/shared/src/catalog/commands";
import type { StateName } from "../../../../packages/shared/src/catalog/document/types";

beforeAll(async () => {
  (
    globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }
  ).IS_REACT_ACT_ENVIRONMENT = true;
  await initEngineWasm();
});

// Background paint only: focus rings and glyph raster belong to the full visual matrix.
const rows: unknown[] = [];
const colorProbe = new OffscreenCanvas(1, 1).getContext("2d", {
  willReadFrequently: true,
})!;
function cssColor(value: string) {
  colorProbe.clearRect(0, 0, 1, 1);
  colorProbe.fillStyle = value;
  colorProbe.fillRect(0, 0, 1, 1);
  const bytes = [...colorProbe.getImageData(0, 0, 1, 1).data];
  return bytes[3] === 0 ? [0, 0, 0, 0] : bytes;
}

for (const mode of ["light", "dark"] as const) {
  it(`Menu ${mode}: actual keyboard/pointer focus and rest match bound Canvas paint`, async () => {
    document.documentElement.setAttribute("data-theme", mode);
    const css = document.head.appendChild(document.createElement("style"));
    css.textContent = bundleCss;
    injectPreviewBaseStyles(document);
    const library = await buildCodeCatalogLibrary();
    const workspace = new CatalogWorkspace(
      new CatalogGraph(
        newCatalogProjectDocument({
          projectId: "project:project:menu-focus",
          name: "Menu focus",
        }),
        library,
      ),
      new CatalogStorage(indexedDB, `menu-focus-${crypto.randomUUID()}`),
      {
        engine: createLayoutEngine(),
        viewport: { width: 800, height: 600 },
        autosaveSchedule: () => {},
      },
    );
    const owner = "project:node:menu" as const;
    workspace.execute(
      insertNodes({
        parent: { kind: "node", id: "project:node:home-body" },
        entries: [
          {
            kind: "node",
            id: owner,
            definitionId: catalogPaletteDefinitionId(library, "Menu"),
            children: [],
            props: { isOpen: { kind: "set", value: true } },
            visual: {},
            sizing: {},
            descendantOverrides: [],
          },
        ],
        rootIds: [owner],
        newId: workspace.newId,
      }),
    );
    const domRoot = workspace.root;
    const host = document.body.appendChild(document.createElement("div"));
    const reactRoot = createRoot(host);
    const paintRoots = new Map<string, CatalogCompositionRoot>();
    try {
      await act(async () =>
        reactRoot.render(
          renderCatalogDom(domRoot, domRoot.recordsOfSource(owner)[0]!),
        ),
      );
      await expect
        .poll(() => document.querySelectorAll('[role^="menuitem"]').length)
        .toBeGreaterThanOrEqual(2);
      const items = () => [
        ...document.querySelectorAll<HTMLElement>('[role^="menuitem"]'),
      ];
      const first = items()[0]!;
      await act(async () => first.focus());
      await act(async () => userEvent.keyboard("{End}{Home}"));
      await expect.poll(() => first.hasAttribute("data-focused")).toBe(true);
      await expect
        .poll(() => first.hasAttribute("data-focus-visible"))
        .toBe(true);
      const compare = async (
        element: HTMLElement,
        state: StateName | undefined,
        scenario: string,
      ) => {
        const key = state ?? "rest";
        let root = paintRoots.get(key);
        if (!root) {
          root = new CatalogCompositionRoot(
            workspace.runtime,
            createLayoutEngine(),
            { width: 800, height: 600 },
            state,
            undefined,
            undefined,
            "en-US",
            { colorMode: mode },
          );
          paintRoots.set(key, root);
        }
        const id = element.getAttribute("data-catalog-id")!;
        expect(root.canvasInputs.has(id)).toBe(true);
        const binding = bindCatalogCanvas(root, [id]);
        try {
          const node = getSkiaNode(id);
          expect(node, scenario).toBeDefined();
          expect(node!.box, scenario).toBeDefined();
          const color = node!.box!.fillColor;
          const canvas =
            color && color[3]! > 0
              ? [...color].map((v) => Math.round(v * 255))
              : [0, 0, 0, 0];
          const dom = cssColor(getComputedStyle(element).backgroundColor);
          const flags = {
            focused: element.hasAttribute("data-focused"),
            focusVisible: element.hasAttribute("data-focus-visible"),
            hovered: element.hasAttribute("data-hovered"),
            selected: element.hasAttribute("data-selected"),
            active: document.activeElement === element,
          };
          rows.push({ mode, scenario, state: key, flags, canvas, dom });
          expect(flags.focused, scenario).toBe(state !== undefined);
          expect(flags.focusVisible, scenario).toBe(state === "focusVisible");
          expect(canvas, JSON.stringify(rows.at(-1))).toEqual(dom);
        } finally {
          binding.dispose();
        }
      };
      await compare(first, "focusVisible", "keyboard first");
      await compare(items()[1]!, undefined, "unfocused sibling");
      await act(async () => userEvent.keyboard("{End}"));
      const last = items().at(-1)!;
      await expect.poll(() => last.hasAttribute("data-focused")).toBe(true);
      await compare(last, "focusVisible", "keyboard last");
      await compare(first, undefined, "previous keyboard item rests");
      await act(async () =>
        userEvent.click(document.querySelector<HTMLElement>('[role="menu"]')!, {
          position: { x: 1, y: 1 },
        }),
      );
      await act(async () => userEvent.hover(first));
      await expect.poll(() => first.hasAttribute("data-focused")).toBe(true);
      await compare(first, "hover", "pointer focus");
      await compare(last, undefined, "previous pointer item rests");
      const menu = [...domRoot.domInputs.values()].find(
        (n) => domRoot.typeOf(n) === "Menu",
      )!;
      await act(async () =>
        workspace.execute(
          setFields({
            targets: [workspace.positionOfRecord(menu.id)!.target],
            props: { selectionMode: { kind: "set", value: "multiple" } },
            label: "Select menu item",
          }),
        ),
      );
      paintRoots.clear();
      await act(async () => userEvent.click(items()[0]!));
      await expect
        .poll(() => items()[0]?.hasAttribute("data-selected"))
        .toBe(true);
      const selected = items()[0]!;
      await act(async () => selected.focus());
      await act(async () => userEvent.keyboard("{End}{Home}"));
      // Selection here is local RAC interaction state. It is not shared with
      // the independent Canvas root, so this is a DOM smoke check, not a pair.
      await expect
        .poll(() => selected.hasAttribute("data-focus-visible"))
        .toBe(true);
      expect(selected.hasAttribute("data-selected")).toBe(true);
    } finally {
      await commands.writeFile(
        "../../.agent/runs/menu-focus-paint.json",
        JSON.stringify(rows, null, 2),
      );
      await act(async () => reactRoot.unmount());
      host.remove();
      css.remove();
      workspace.dispose();
      document.documentElement.removeAttribute("data-theme");
    }
  });
}
