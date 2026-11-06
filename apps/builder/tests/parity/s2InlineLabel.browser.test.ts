import { beforeAll, afterAll, expect, it, vi } from "vitest";
import { act, createElement } from "react";
import { createRoot } from "react-dom/client";
import * as Spectrum from "@react-spectrum/s2";
import bundleCss from "@composition/shared/components/styles/index.css?inline";
import { buildCodeCatalogLibrary } from "../../../../packages/shared/src/catalog/document/codeCatalogLibrary";
import { CatalogGraph } from "../../../../packages/shared/src/catalog/document/graph";
import {
  insertNodes,
  setFields,
} from "../../../../packages/shared/src/catalog/commands";
import type { NodeEntry } from "../../../../packages/shared/src/catalog/document/types";
import { catalogPaletteDefinitionId } from "@/builder/catalogRuntime/paletteInsert";
import { newCatalogProjectDocument } from "@/builder/catalogRuntime/project";
import { CatalogWorkspace } from "@/builder/catalogRuntime/workspace";
import { CatalogStorage } from "@/builder/catalogRuntime/storage";
import { catalogTextMeasure } from "@/builder/catalogRuntime/textMeasure";
import { catalogCanvasNodeData } from "@/builder/catalogRuntime/canvasBinding";
import { renderCatalogDom } from "@/builder/catalogRuntime/domBinding";
import { createLayoutEngine } from "@/builder/workspace/canvas/wasm-bindings/layoutBridge";
import { initEngineWasm } from "@/builder/workspace/canvas/wasm-bindings/engineWasm";
import { injectPreviewBaseStyles } from "@/preview/baseStyles";

const fields = [
  "TextField",
  "TextArea",
  "NumberField",
  "SearchField",
  "ColorField",
  "DateField",
  "TimeField",
  "DatePicker",
  "DateRangePicker",
  "CheckboxGroup",
  "RadioGroup",
  "Select",
  "ComboBox",
];
const label = "A longer field label that should wrap onto several lines";
let library: Awaited<ReturnType<typeof buildCodeCatalogLibrary>>;
const style = document.createElement("style");
beforeAll(async () => {
  (
    globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }
  ).IS_REACT_ACT_ENVIRONMENT = true;
  await initEngineWasm();
  library = await buildCodeCatalogLibrary();
  style.textContent = bundleCss;
  document.head.append(style);
  injectPreviewBaseStyles(document);
  // S2 registers CJK faces asynchronously, after an initial fonts.ready can resolve.
  const warmHost = document.body.appendChild(document.createElement("div"));
  const warmRoot = createRoot(warmHost);
  await act(async () =>
    warmRoot.render(
      createElement(Spectrum.Provider, {
        locale: "ko-KR",
        children: createElement(Spectrum.TextField, {
          label,
          isRequired: true,
          necessityIndicator: "label",
        }),
      }),
    ),
  );
  await vi.waitFor(
    () => {
      if (![...document.fonts].some((f) => /korean/.test(f.family)))
        throw Error("S2 Korean font faces are not registered yet");
    },
    { timeout: 20000, interval: 50 },
  );
  const korean = [...document.fonts].find((f) =>
    /korean/.test(f.family),
  )!.family;
  await document.fonts.load(
    `14px "${korean.replaceAll('"', "")}"`,
    label + "(필수 사항)",
  );
  await document.fonts.ready;
  await act(async () => warmRoot.unmount());
  warmHost.remove();
});
afterAll(() => style.remove());

function lines(element: Element, value: string) {
  const walker = document.createTreeWalker(element, NodeFilter.SHOW_TEXT);
  for (let text = walker.nextNode(); text; text = walker.nextNode()) {
    if (text.textContent !== value) continue;
    const range = document.createRange();
    range.selectNodeContents(text);
    return [...range.getClientRects()];
  }
  throw Error("Label source text missing");
}

async function fixture(
  type: string,
  mode: string,
  size = "M",
  width: number | null = 208,
) {
  const workspace = new CatalogWorkspace(
    new CatalogGraph(
      newCatalogProjectDocument({
        projectId: "project:project:inline-label",
        name: "Inline label",
      }),
      library,
    ),
    new CatalogStorage(indexedDB, `inline-label-${Math.random()}`),
    {
      engine: createLayoutEngine(),
      locale: "ko-KR",
      viewport: { width: 1000, height: 800 },
      autosaveSchedule: () => {},
      textMeasure: catalogTextMeasure,
    },
  );
  workspace.execute(
    insertNodes({
      parent: { kind: "node", id: "project:node:home-body" },
      entries: [
        {
          kind: "node",
          id: "project:node:inline-label",
          definitionId: catalogPaletteDefinitionId(library, type),
          children: [],
          props: {
            label: { kind: "set", value: label },
            size: { kind: "set", value: size },
            isRequired: { kind: "set", value: true },
            necessityIndicator: { kind: "set", value: mode },
          },
          visual:
            width === null ? {} : { width: { kind: "set", value: width } },
          sizing: {},
          descendantOverrides: [],
        } as NodeEntry,
      ],
      rootIds: ["project:node:inline-label"],
      newId: workspace.newId,
    }),
  );
  const root = workspace.root;
  const field = [...root.domInputs.values()].find(
    (n) => n.sourceId === "project:node:inline-label",
  )!;
  const labelNode = [...root.domInputs.values()].find(
    (n) => root.typeOf(n) === "Label",
  )!;
  const body = [...root.domInputs.values()].find(
    (n) => n.props.slot === "label-content",
  )!;
  const indicator = [...root.domInputs.values()].find(
    (n) => n.props.slot === `necessity-${mode}`,
  )!;
  const source = document.body.appendChild(document.createElement("div"));
  source.lang = "ko-KR";
  source.style.width = "1920px"; // Same containing block as the catalog page body.
  const reference = document.body.appendChild(document.createElement("div"));
  reference.lang = "ko-KR";
  reference.style.cssText = "width:1920px;--s2-scale:1;--s2-font-size-base:14";
  const render = createRoot(source),
    oracle = createRoot(reference);
  const component = (
    Spectrum as unknown as Record<
      string,
      React.ComponentType<Record<string, unknown>>
    >
  )[type === "Select" ? "Picker" : type];
  await act(async () => {
    render.render(renderCatalogDom(root, field.id));
    oracle.render(
      createElement(Spectrum.Provider, {
        locale: "ko-KR",
        colorScheme: "light",
        children: createElement(component, {
          label,
          size,
          isRequired: true,
          necessityIndicator: mode,
          UNSAFE_style: width === null ? undefined : { width },
          UNSAFE_className: "inline-label-oracle",
        }),
      }),
    );
  });
  await document.fonts.ready;
  return {
    workspace,
    root,
    field,
    labelNode,
    body,
    indicator,
    source,
    reference,
    async rerender() {
      await act(async () => render.render(renderCatalogDom(root, field.id)));
    },
    async dispose() {
      await act(async () => {
        render.unmount();
        oracle.unmount();
      });
      source.remove();
      reference.remove();
      workspace.dispose();
    },
  };
}

it.each(
  fields.flatMap((type) =>
    ["S", "M", "L", "XL"].flatMap((size) =>
      ["icon", "label"].map((mode) => ({ type, mode, size })),
    ),
  ),
)(
  "$type/$size/$mode: real inline children wrap with the necessity on the last line",
  async ({ type, mode, size }) => {
    const h = await fixture(type, mode, size);
    try {
      const body = h.source.querySelector('[slot="label-content"]')!;
      const sourceLines = lines(body, label);
      const refTexts = document.createTreeWalker(
        h.reference,
        NodeFilter.SHOW_TEXT,
      );
      let referenceLabel: Element | undefined;
      for (let text = refTexts.nextNode(); text; text = refTexts.nextNode())
        if (
          text.textContent === label &&
          text.parentElement!.getBoundingClientRect().height > 0
        ) {
          referenceLabel = text.parentElement!;
          break;
        }
      if (!referenceLabel) throw Error(`S2 ${type} Label missing`);
      const referenceLines = lines(referenceLabel, label);
      const target = h.source.querySelector(
        `[data-catalog-id="${h.indicator.id}"]`,
      )!;
      if (mode === "icon")
        expect(getComputedStyle(target).verticalAlign).toBe(
          h.indicator.layout.verticalAlign,
        );
      expect(getComputedStyle(target).display).toBe(h.indicator.layout.display);
      const targetRect = (
        mode === "icon" ? target.querySelector("svg")! : target
      ).getBoundingClientRect();
      const refTarget =
        mode === "icon"
          ? referenceLabel.querySelector("svg")!
          : referenceLabel.querySelector(":scope > span > span")!;
      const refRect = refTarget.getBoundingClientRect();
      const last = sourceLines.at(-1)!,
        refLast = referenceLines.at(-1)!;
      expect(sourceLines.length).toBeGreaterThan(1);
      expect(sourceLines.length).toBe(referenceLines.length);
      expect(
        Math.abs(targetRect.x - last.right - (refRect.x - refLast.right)),
      ).toBeLessThanOrEqual(0.75);
      expect(
        Math.abs(targetRect.y - last.top - (refRect.y - refLast.top)),
      ).toBeLessThanOrEqual(0.75);
      const geo = h.root.getGeometry([
        h.body.id,
        h.indicator.id,
        h.labelNode.id,
      ]);
      const fragments = geo.get(h.body.id)!.inlineFragments!;
      expect(fragments.length).toBe(sourceLines.length);
      expect(fragments.at(-1)!.end).toBe(label.length);
      const fieldRect = h.source
        .querySelector(`[data-catalog-id="${h.field.id}"]`)!
        .getBoundingClientRect();
      if (mode === "label") {
        const marker = target.appendChild(document.createElement("span"));
        marker.style.cssText = "display:inline-block;width:0;height:0";
        const baseline = marker.getBoundingClientRect().top - fieldRect.y;
        marker.remove();
        expect(
          Math.abs(
            geo.get(h.labelNode.id)!.y +
              geo.get(h.indicator.id)!.y +
              geo.get(h.indicator.id)!.baseline! -
              baseline,
          ),
        ).toBeLessThanOrEqual(0.75);
      } else {
        expect(
          Math.abs(
            geo.get(h.labelNode.id)!.y +
              geo.get(h.indicator.id)!.y -
              (targetRect.y - fieldRect.y),
          ),
        ).toBeLessThanOrEqual(0.75);
      }
      const paint = catalogCanvasNodeData(h.root, h.body.id);
      expect(paint.text?.content).toBe(label);
      expect(paint.text?.maxWidth).toBeLessThanOrEqual(208);
      expect(paint.text?.whiteSpace).toBe("normal");
      expect(paint.children?.map((node) => node.text?.content)).toEqual(
        fragments.map((f) => label.slice(f.start, f.end)),
      );
      expect(
        paint.children?.every((node) => node.text?.autoCenter === false),
      ).toBe(true);
      expect(paint.children?.map((node) => node.text?.baseline)).toEqual(
        fragments.map((fragment) => fragment.baseline),
      );
      expect(paint.children?.map((node) => node.text?.maxWidth)).toEqual(
        fragments.map((fragment) => fragment.width),
      );
      // Keep the source child identity across a width edit and history restoration.
      const before = fragments.map((f) => [f.start, f.end]);
      await act(async () =>
        h.workspace.execute(
          setFields({
            targets: [h.workspace.positionOfRecord(h.field.id)!.target],
            visual: { width: { kind: "set", value: 96 } },
          }),
        ),
      );
      await h.rerender();
      expect(
        h.root.getGeometry([h.body.id]).get(h.body.id)!.inlineFragments!.length,
      ).toBeGreaterThan(fragments.length);
      await act(async () => h.workspace.undo());
      await h.rerender();
      expect(
        h.root
          .getGeometry([h.body.id])
          .get(h.body.id)!
          .inlineFragments!.map((f) => [f.start, f.end]),
      ).toEqual(before);
    } finally {
      await h.dispose();
    }
  },
);

it("TextField: long Label preserves S2 default field width", async () => {
  const h = await fixture("TextField", "icon", "M", null);
  try {
    const own = h.source
      .querySelector(`[data-catalog-id="${h.field.id}"]`)!
      .getBoundingClientRect();
    const reference = h.reference
      .querySelector(".inline-label-oracle")!
      .getBoundingClientRect();
    expect(own.width).toBe(reference.width);
    expect(h.root.getGeometry([h.field.id]).get(h.field.id)!.width).toBe(
      own.width,
    );
  } finally {
    await h.dispose();
  }
});
