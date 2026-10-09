import React from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { commands, page as browserPage } from "vitest/browser";

import bundleCss from "@composition/shared/components/styles/index.css?inline";
import { CatalogGraph } from "../../../../packages/shared/src/catalog/document/graph";
import { createG1Fixture } from "../../../../packages/shared/src/catalog/document/fixture";
import { createPencilFixtureLibrary } from "../../../../packages/shared/src/catalog/document/pencilFixtureLibrary";
import { buildCodeCatalogLibrary } from "../../../../packages/shared/src/catalog/document/codeCatalogLibrary";
import { createCodeCatalogScenarioLibrary } from "../../src/builder/catalogRuntime/__tests__/support/codeCatalogFixtureLibrary";
import { applyCatalogTransaction } from "../../../../packages/shared/src/catalog/transactions/transaction";
import type {
  CatalogEntry,
  NodeEntry,
} from "../../../../packages/shared/src/catalog/document/types";
import { initEngineWasm } from "@/builder/workspace/canvas/wasm-bindings/engineWasm";
import { createLayoutEngine } from "@/builder/workspace/canvas/wasm-bindings/layoutBridge";
import { Canvas2DTextMeasurer } from "@/builder/workspace/canvas/utils/textMeasure";
import { CatalogCompositionRoot } from "@/builder/catalogRuntime/compositionRoot";
import { catalogTextMeasure } from "@/builder/catalogRuntime/textMeasure";
import { CatalogRuntime } from "@/builder/catalogRuntime/controller";
import { CatalogStorage } from "@/builder/catalogRuntime/storage";
import { renderCatalogDom } from "@/builder/catalogRuntime/domBinding";
import { bindCatalogCanvas } from "@/builder/catalogRuntime/canvasBinding";
import slotMatrixExpected from "../../../../docs/adr/design/248-phase3-slot-matrix-dom.json";
import slotDomPaintBounds from "../../../../docs/adr/design/248-phase3-slot-dom-paint-bounds.json";

/** A frozen G0 scenario operation (the fields these tests read). */
interface G0Operation {
  op: string;
  id: string;
  component: string;
  parent: string;
  x: number;
  y: number;
  width?: number;
  height?: number;
  fill?: string;
  border?: string;
  text?: string;
  description?: string;
  orientation?: string;
  size?: string;
  overflow?: string;
}
interface G0Scenario {
  scenario: {
    viewport: { width: number; height: number };
    operations: G0Operation[];
  };
}
/**
 * The frozen G0 scenarios (`docs/adr/design/248-baseline/`) are kept local only (user decision
 * 2026-09-30): an eager glob is empty in a checkout without them, and the tests reading them skip.
 */
/** The frozen baselines record the sizes before they took the S2 names (2026-10-09). */
const S2_SIZE: Record<string, string> = {
  xs: "XS",
  sm: "S",
  md: "M",
  lg: "L",
  xl: "XL",
};
const withS2Size = (scenario: G0Scenario | undefined): G0Scenario | undefined =>
  scenario && {
    ...scenario,
    scenario: {
      ...scenario.scenario,
      operations: scenario.scenario.operations.map((operation) =>
        operation.size
          ? { ...operation, size: S2_SIZE[operation.size] ?? operation.size }
          : operation,
      ),
    },
  };
const baseline = withS2Size(
  Object.values(
    import.meta.glob<G0Scenario>(
      "../../../../docs/adr/design/248-baseline/baseline.json",
      { eager: true, import: "default" },
    ),
  )[0],
);
const nativeBaseline = withS2Size(
  Object.values(
    import.meta.glob<G0Scenario>(
      "../../../../docs/adr/design/248-baseline/native-state-pinned/baseline.json",
      { eager: true, import: "default" },
    ),
  )[0],
);

/**
 * Regenerates the Slot DOM expectations (PNG + JSON) from the product DOM binding:
 * `VITE_ADR248_SLOT_DOM_WRITE=1`. Default runs compare against the stored files.
 */
const WRITE_SLOT_DOM = import.meta.env.VITE_ADR248_SLOT_DOM_WRITE === "1";
const DESIGN_FROM_TEST = "../../docs/adr/design"; // relative to the Vitest root (apps/builder)

let host: HTMLDivElement;
let reactRoot: Root;
let css: HTMLStyleElement;

beforeAll(async () => {
  await initEngineWasm();
  css = document.createElement("style");
  css.textContent = `${bundleCss}\n@font-face { font-family: Pretendard; src: url('/fonts/PretendardVariable.ttf'); font-style: normal; font-weight: 100 900; }`;
  document.head.append(css);
  await document.fonts.load("16px Pretendard");
  host = document.createElement("div");
  host.style.cssText =
    "position:relative;width:1440px;height:900px;font-family:Pretendard,sans-serif";
  document.body.append(host);
  reactRoot = createRoot(host);
});
afterAll(() => {
  reactRoot.unmount();
  host.remove();
  css.remove();
});

describe("ADR-248 test-entry isolated RAC DOM consumer", () => {
  // (A Select · ComboBox draws its node tree — the trigger · control Group is its own element,
  // ADR-256 Phase 6c · 6d.)
  it("draws the ComboBox control Group as its own RAC Group element, as tall as the Canvas box", async () => {
    await browserPage.viewport(1440, 900);
    const library = await buildCodeCatalogLibrary();
    const { document } = createG1Fixture();
    const page = document.entries["project:page:main"] as Extract<
      CatalogEntry,
      { kind: "page" }
    >;
    const ids = { combo: "project:node:combo" } as const;
    const node = (
      id: NodeEntry["id"],
      definitionId: NodeEntry["definitionId"],
      children: readonly NodeEntry["id"][] = [],
      props: NodeEntry["props"] = {},
      visual: NodeEntry["visual"] = {},
      sizing: NodeEntry["sizing"] = {},
    ): NodeEntry => ({
      kind: "node",
      id,
      definitionId,
      children,
      props,
      visual,
      sizing,
      descendantOverrides: [],
    });
    const graph = new CatalogGraph(
      {
        ...document,
        entries: {
          [document.projectId]: document.entries[document.projectId],
          [page.id]: { ...page, children: [ids.combo] },
          // The ComboBox origin: `Label + Group(Input + Button) + … + Popover > ListBox`.
          [ids.combo]: node(
            ids.combo,
            "lib:definition:origin-component-combobox",
            [],
            {},
            {},
            { width: { kind: "set", value: 240 } },
          ),
        },
      },
      library,
    );
    const root = new CatalogCompositionRoot(
      new CatalogRuntime(
        graph,
        new CatalogStorage(indexedDB, "adr248-dom-select-ownership"),
      ),
      createLayoutEngine(),
      { width: 1440, height: 900 },
      undefined,
      undefined,
      // The trigger is as tall as its measured value line (no fixed rule height): the product
      // text measurer, as in the Builder composition root.
      catalogTextMeasure,
    );
    const owners = [...root.domInputs.values()].filter(
      (input) => input.bindingId === "combobox",
    );
    expect(owners).toHaveLength(1);
    const triggerInputs = [...root.domInputs.values()].filter(
      (input) =>
        input.bindingId === "group" &&
        owners.some((owner) => owner.id === input.parentId),
    );
    expect(triggerInputs).toHaveLength(1);
    reactRoot.render(
      React.createElement(
        "div",
        null,
        ...[ids.combo].map((id) => {
          const owner = [...root.domInputs.values()].find(
            (input) => input.sourceId === id,
          )!;
          return renderCatalogDom(root, owner.id);
        }),
      ),
    );
    await new Promise<void>((done) =>
      requestAnimationFrame(() => requestAnimationFrame(() => done())),
    );
    for (const trigger of triggerInputs) {
      // The Group node's own element: RAC's Group with the ComboBox rule's container class.
      const domRegion = host.querySelector<HTMLElement>(
        `[data-catalog-id="${trigger.id}"]`,
      )!;
      const bound = bindCatalogCanvas(root, [trigger.id]);
      try {
        const geometry = root.getGeometry([trigger.id]).get(trigger.id)!;
        const domRect = domRegion.getBoundingClientRect();
        expect(domRegion).not.toBeNull();
        expect(domRegion.className).toBe("react-aria-Group combobox-container");
        expect(domRegion.getAttribute("role")).toBe("group");
        expect(geometry.height).toBe(30);
        expect(Math.abs(domRect.height - geometry.height)).toBeLessThanOrEqual(
          1,
        );
        expect(bound.stream.hitBoundsMap.has(trigger.id)).toBe(true);
        // (The Group paints no box of its own on the Canvas — a ComboBox's box is its Input
        // instance, ADR-253 · ADR-256 Phase 6b.)
        // (The box border is the Input's — the container only places the parts.)
        const input = domRegion.querySelector("input")!;
        expect(getComputedStyle(input).borderTopWidth).toBe("1px");
        expect(getComputedStyle(input).borderTopStyle).toBe("solid");
        expect(domRegion.querySelector("input")?.getAttribute("role")).toBe(
          "combobox",
        );
      } finally {
        bound.dispose();
      }
    }
  });
  it("renders the shared button, glyph and field error product bindings", async () => {
    await browserPage.viewport(1440, 900);
    const library = await createCodeCatalogScenarioLibrary("light");
    const { document } = createG1Fixture();
    const page = document.entries["project:page:main"] as Extract<
      CatalogEntry,
      { kind: "page" }
    >;
    const ids = {
      group: "project:node:bindingGroup",
      button: "project:node:bindingButton",
      icon: "project:node:bindingIcon",
      error: "project:node:bindingError",
    } as const;
    const node = (
      id: NodeEntry["id"],
      definitionId: NodeEntry["definitionId"],
      props: NodeEntry["props"],
    ): NodeEntry => ({
      kind: "node",
      id,
      definitionId,
      children: [],
      props,
      visual: {},
      sizing: {},
      descendantOverrides: [],
    });
    const graph = new CatalogGraph(
      {
        ...document,
        entries: {
          [document.projectId]: document.entries[document.projectId],
          [page.id]: { ...page, children: [ids.group] },
          [ids.group]: {
            ...node(ids.group, "lib:definition:group", {}),
            children: [ids.button, ids.icon, ids.error],
          },
          [ids.button]: node(ids.button, "lib:definition:type-Button", {
            children: { kind: "set", value: "Save" },
          }),
          [ids.icon]: node(ids.icon, "lib:definition:type-Icon", {
            iconName: { kind: "set", value: "star" },
          }),
          [ids.error]: node(ids.error, "lib:definition:type-FieldError", {
            children: { kind: "set", value: "Required" },
          }),
        },
      },
      library,
    );
    const root = new CatalogCompositionRoot(
      new CatalogRuntime(
        graph,
        new CatalogStorage(indexedDB, "adr248-dom-common-bindings"),
      ),
      createLayoutEngine(),
      { width: 1440, height: 900 },
    );
    const group = [...root.domInputs.values()].find(
      (value) => value.sourceId === ids.group,
    )!;
    reactRoot.render(renderCatalogDom(root, group.id));
    await new Promise<void>((done) =>
      requestAnimationFrame(() => requestAnimationFrame(() => done())),
    );
    const resolvedId = (sourceId: string) =>
      [...root.domInputs.values()].find((value) => value.sourceId === sourceId)!
        .id;
    const button = host.querySelector<HTMLButtonElement>(
      `[data-catalog-id="${resolvedId(ids.button)}"]`,
    )!;
    const icon = host.querySelector<HTMLElement>(
      `[data-catalog-id="${resolvedId(ids.icon)}"]`,
    )!;
    const error = host.querySelector<HTMLElement>(
      `[data-catalog-id="${resolvedId(ids.error)}"]`,
    )!;
    expect(button.tagName).toBe("BUTTON");
    expect(button.textContent).toBe("Save");
    expect(button.getAttribute("data-variant")).toBe("primary");
    expect(icon.querySelector("svg path")).not.toBeNull();
    expect(icon.querySelector("svg")?.getAttribute("width")).toBe("24");
    expect(error.getAttribute("role")).toBe("alert");
    expect(error.textContent).toBe("Required");
  });
  it("renders source-derived Text inside existing RAC Group at the frozen 1x viewport", async () => {
    await browserPage.viewport(1440, 900);
    const library = await createCodeCatalogScenarioLibrary("light");
    const { document } = createG1Fixture();
    const page = document.entries["project:page:main"] as Extract<
      CatalogEntry,
      { kind: "page" }
    >;
    const graph = new CatalogGraph(
      {
        ...document,
        entries: {
          [document.projectId]: document.entries[document.projectId],
          [page.id]: { ...page, children: [] },
        },
      },
      library,
    );
    const group: NodeEntry = {
      kind: "node",
      id: "project:node:sourceGroup",
      definitionId: "lib:definition:group",
      children: ["project:node:sourceText"],
      props: {
        orientation: { kind: "set", value: "horizontal" },
        "aria-label": { kind: "set", value: "Source Group" },
      },
      visual: {},
      sizing: {},
      descendantOverrides: [],
    };
    const text: NodeEntry = {
      kind: "node",
      id: "project:node:sourceText",
      definitionId: "lib:definition:text",
      children: [],
      props: { children: { kind: "set", value: "저장" } },
      visual: {},
      sizing: {},
      descendantOverrides: [],
    };
    applyCatalogTransaction(graph, {
      projectId: graph.projectId,
      expectedRevision: graph.revision,
      history: { kind: "record", label: "public insert" },
      ops: [
        { kind: "put", entry: group },
        { kind: "put", entry: text },
        { kind: "put", entry: { ...page, children: [group.id] } },
      ],
    });
    // Same graph through the composition root and the product-path DOM binding.
    const root = new CatalogCompositionRoot(
      new CatalogRuntime(
        graph,
        new CatalogStorage(indexedDB, "adr248-dom-source-text"),
      ),
      createLayoutEngine(),
      { width: 1440, height: 900 },
    );
    const groupInput = [...root.domInputs.values()].find(
      (node) => node.sourceId === group.id,
    )!;
    const textInput = [...root.domInputs.values()].find(
      (node) => node.sourceId === text.id,
    )!;
    reactRoot.render(renderCatalogDom(root, groupInput.id));
    await new Promise<void>((done) =>
      requestAnimationFrame(() => requestAnimationFrame(() => done())),
    );
    const groupElement = host.querySelector<HTMLElement>(
      '[role="group"][aria-label="Source Group"]',
    )!;
    const textElement = host.querySelector<HTMLElement>(
      `[data-catalog-id="${textInput.id}"]`,
    )!;
    expect(groupElement.getAttribute("role")).toBe("group");
    expect(groupElement.getAttribute("aria-label")).toBe("Source Group");
    expect(getComputedStyle(groupElement).flexDirection).toBe("row");
    expect(getComputedStyle(groupElement).gap).toBe("8px");
    expect(textElement.textContent).toBe("저장");
    expect(getComputedStyle(textElement).fontSize).toBe("16px");
    expect(getComputedStyle(textElement).lineHeight).toBe("24px");
    expect(getComputedStyle(textElement).fontWeight).toBe("400");
    expect(getComputedStyle(textElement).color).toBe("rgb(23, 23, 23)");
    expect(textElement.getBoundingClientRect().width).toBeGreaterThan(0);
    const png = await browserPage
      .getByRole("group", { name: "Source Group" })
      .screenshot({ base64: true });
    expect(png.base64.length).toBeGreaterThan(100);
  });
  it("renders the shared Label, Description and Paragraph leaf bindings in isolated DOM", async () => {
    await browserPage.viewport(1440, 900);
    const library = await createCodeCatalogScenarioLibrary("light");
    const { document } = createG1Fixture();
    const page = document.entries["project:page:main"] as Extract<
      CatalogEntry,
      { kind: "page" }
    >;
    const groupId = "project:node:textFamily" as const;
    const labelId = "project:node:label" as const;
    const descriptionId = "project:node:description" as const;
    const paragraphId = "project:node:paragraph" as const;
    const graph = new CatalogGraph(
      {
        ...document,
        entries: {
          [document.projectId]: document.entries[document.projectId],
          [page.id]: { ...page, children: [groupId] },
          [groupId]: {
            kind: "node",
            id: groupId,
            definitionId: "lib:definition:group",
            children: [labelId, descriptionId, paragraphId],
            props: { "aria-label": { kind: "set", value: "Text family" } },
            visual: {},
            sizing: {},
            descendantOverrides: [],
          },
          [labelId]: {
            kind: "node",
            id: labelId,
            definitionId: "lib:definition:type-Label",
            children: [],
            props: { children: { kind: "set", value: "Name" } },
            visual: {},
            sizing: {},
            descendantOverrides: [],
          },
          [descriptionId]: {
            kind: "node",
            id: descriptionId,
            definitionId: "lib:definition:type-Description",
            children: [],
            props: { children: { kind: "set", value: "Helpful text" } },
            visual: {},
            sizing: {},
            descendantOverrides: [],
          },
          [paragraphId]: {
            kind: "node",
            id: paragraphId,
            definitionId: "lib:definition:type-Paragraph",
            children: [],
            props: { children: { kind: "set", value: "Body copy" } },
            visual: {},
            sizing: {},
            descendantOverrides: [],
          },
        },
      },
      library,
    );
    const root = new CatalogCompositionRoot(
      new CatalogRuntime(
        graph,
        new CatalogStorage(indexedDB, "adr248-dom-text-family"),
      ),
      createLayoutEngine(),
      { width: 1440, height: 900 },
    );
    const group = [...root.domInputs.values()].find(
      (node) => node.sourceId === groupId,
    )!;
    reactRoot.render(renderCatalogDom(root, group.id));
    await new Promise<void>((done) =>
      requestAnimationFrame(() => requestAnimationFrame(() => done())),
    );
    const labelInput = [...root.domInputs.values()].find(
      (node) => node.sourceId === labelId,
    )!;
    const descriptionInput = [...root.domInputs.values()].find(
      (node) => node.sourceId === descriptionId,
    )!;
    const paragraphInput = [...root.domInputs.values()].find(
      (node) => node.sourceId === paragraphId,
    )!;
    const label = host.querySelector<HTMLElement>(
      `[data-catalog-id="${labelInput.id}"]`,
    )!;
    const description = host.querySelector<HTMLElement>(
      `[data-catalog-id="${descriptionInput.id}"]`,
    )!;
    const paragraph = host.querySelector<HTMLElement>(
      `[data-catalog-id="${paragraphInput.id}"]`,
    )!;
    expect(label.tagName).toBe("LABEL");
    expect(label.textContent).toBe("Name");
    expect(description.getAttribute("slot")).toBe("description");
    expect(description.textContent).toBe("Helpful text");
    expect(paragraph.tagName).toBe("P");
    expect(paragraph.textContent).toBe("Body copy");
    expect(getComputedStyle(label).fontSize).toBe(
      `${labelInput.visual.fontSize}px`,
    );
    expect(getComputedStyle(description).fontSize).toBe(
      `${descriptionInput.visual.fontSize}px`,
    );
    expect(getComputedStyle(paragraph).fontSize).toBe(
      `${paragraphInput.visual.fontSize}px`,
    );
  });
  it("measures Slot sm/md/lg empty, filled and two-line description against CanvasKit PNG", async () => {
    await browserPage.viewport(1440, 900);
    const canvasPngs = import.meta.glob(
      "../../../../docs/adr/design/248-phase3-slot-matrix-*.png",
      { eager: true, query: "?url", import: "default" },
    ) as Record<string, string>;
    const domPngs = import.meta.glob(
      "../../../../docs/adr/design/248-phase3-slot-matrix-dom/*.png",
      { eager: true, query: "?url", import: "default" },
    ) as Record<string, string>;
    const library = createPencilFixtureLibrary();
    const { document: seed } = createG1Fixture();
    const page = seed.entries["project:page:main"] as Extract<
      CatalogEntry,
      { kind: "page" }
    >;
    // The stored expectations name the sizes as recorded (sm · md · lg); the node takes the S2
    //   names (2026-10-09).
    const sizes = ["sm", "md", "lg"] as const;
    const states = ["empty", "filled", "description"] as const;
    const scenario = {
      id: "adr248-slot-typed-matrix-v1",
      sizes,
      states,
      description: "Two line note here",
      width: 160,
      placement: { x: 10, y: 10 },
      required: true,
      filledText: "Filled",
    };
    const scenarioHash = Array.from(
      new Uint8Array(
        await crypto.subtle.digest(
          "SHA-256",
          new TextEncoder().encode(JSON.stringify(scenario)),
        ),
      ),
    )
      .map((byte) => byte.toString(16).padStart(2, "0"))
      .join("");
    expect(scenarioHash).toBe(slotMatrixExpected.scenarioHash);
    const fontHash = Array.from(
      new Uint8Array(
        await crypto.subtle.digest(
          "SHA-256",
          await (await fetch("/fonts/PretendardVariable.ttf")).arrayBuffer(),
        ),
      ),
    )
      .map((byte) => byte.toString(16).padStart(2, "0"))
      .join("");
    expect(fontHash).toBe(slotDomPaintBounds.fontSha256);
    const expectedMin = { sm: 40, md: 60, lg: 80 };
    const expectedPadding = { sm: 8, md: 12, lg: 16 };
    const textMeasurer = new Canvas2DTextMeasurer();
    const rows: Array<Record<string, unknown>> = [];
    const pixelsOf = async (imageUrl: string) => {
      const image = await createImageBitmap(
        await (await fetch(imageUrl)).blob(),
      );
      const canvas = document.createElement("canvas");
      canvas.width = image.width;
      canvas.height = image.height;
      const context = canvas.getContext("2d")!;
      context.drawImage(image, 0, 0);
      const pixels = context.getImageData(0, 0, image.width, image.height).data;
      image.close();
      return { width: canvas.width, height: canvas.height, pixels };
    };
    for (const size of sizes)
      for (const state of states) {
        const slotId = `project:node:domslot${size}${state}` as NodeEntry["id"];
        const textId = `project:node:domtext${size}${state}` as NodeEntry["id"];
        const filled = state === "filled";
        const slot: NodeEntry = {
          kind: "node",
          id: slotId,
          definitionId: "lib:definition:slot",
          name: "content",
          slot: { name: "content", required: true },
          children: filled ? [textId] : [],
          props: {
            size: { kind: "set", value: S2_SIZE[size] },
            ...(state === "description"
              ? {
                  description: {
                    kind: "set" as const,
                    value: scenario.description,
                  },
                }
              : {}),
          },
          visual: {},
          sizing: { width: { kind: "set", value: scenario.width } },
          placement: { kind: "absolute", ...scenario.placement },
          descendantOverrides: [],
        };
        const text: NodeEntry = {
          kind: "node",
          id: textId,
          definitionId: "lib:definition:text",
          children: [],
          props: { children: { kind: "set", value: "Filled" } },
          visual: {},
          sizing: {
            width: { kind: "set", value: 120 },
            height: { kind: "set", value: 20 },
          },
          descendantOverrides: [],
        };
        const graph = new CatalogGraph(
          {
            ...seed,
            entries: {
              [seed.projectId]: seed.entries[seed.projectId],
              [page.id]: { ...page, children: [slotId] },
              [slotId]: slot,
              ...(filled ? { [textId]: text } : {}),
            },
          },
          library,
        );
        const root = new CatalogCompositionRoot(
          new CatalogRuntime(
            graph,
            new CatalogStorage(indexedDB, `adr248-dom-slot-${size}-${state}`),
          ),
          createLayoutEngine(),
          { width: 1440, height: 900 },
          undefined,
          {
            editMode: true,
            requiredLabel: "Required",
            measureText: (text, fontSize, _maxWidth, lineHeight) => {
              const style = {
                fontFamily: "Pretendard",
                fontSize,
                lineHeight: fontSize * lineHeight,
              };
              return {
                width: textMeasurer.measureWidth(text, style),
                height: fontSize * lineHeight,
              };
            },
          },
        );
        const resolved = [...root.domInputs.values()].find(
          (node) => node.sourceId === slotId,
        )!;
        const rustRect = root.getGeometry([resolved.id]).get(resolved.id)!;
        // Product-path DOM binding: same resolved Slot (placement, width, paint, text metric).
        reactRoot.render(renderCatalogDom(root, resolved.id));
        await new Promise<void>((done) =>
          requestAnimationFrame(() => requestAnimationFrame(() => done())),
        );
        const element = host.querySelector<HTMLElement>(
          `[data-catalog-id="${resolved.id}"]`,
        )!;
        const domRect = element.getBoundingClientRect();
        const domStyle = getComputedStyle(element);
        const relativeBounds = (selector: string) => {
          const target = element.querySelector<HTMLElement>(selector);
          if (!target) return null;
          const bounds = target.getBoundingClientRect();
          const computed = getComputedStyle(target);
          return {
            x: bounds.x - domRect.x,
            y: bounds.y - domRect.y,
            width: bounds.width,
            height: bounds.height,
            fontFamily: computed.fontFamily,
            fontSize: computed.fontSize,
            lineHeight: computed.lineHeight,
            fontWeight: computed.fontWeight,
            color: computed.color,
          };
        };
        expect(domRect.height).toBeGreaterThanOrEqual(expectedMin[size]);
        expect(domStyle.paddingTop).toBe(`${expectedPadding[size]}px`);
        expect(domStyle.minHeight).toBe(`${expectedMin[size]}px`);
        expect(domStyle.borderTopStyle).toBe("dashed");
        expect(element.getAttribute("data-required")).toBe("true");
        expect(element.getAttribute("role")).toBeNull();
        const placeholder = element.querySelector(
          ".react-aria-Slot-placeholder",
        );
        expect(Boolean(placeholder)).toBe(!filled);
        const icon = element.querySelector(".react-aria-Slot-icon svg");
        const required = element.querySelector(
          ".react-aria-Slot-required-badge",
        );
        expect(Boolean(icon)).toBe(!filled);
        expect(Boolean(required)).toBe(!filled);
        if (!filled) expect(required?.textContent).toBe("Required");
        const description = element.querySelector<HTMLElement>(
          ".react-aria-Slot-description",
        );
        expect(Boolean(description)).toBe(state === "description");
        const descriptionHeight =
          description?.getBoundingClientRect().height ?? 0;
        const canvasUrl = Object.entries(canvasPngs).find(([path]) =>
          path.endsWith(`-${size}-${state}-scene.png`),
        )?.[1];
        if (!canvasUrl)
          throw new Error(`SLOT_CANVAS_PNG_REQUIRED:${size}:${state}`);
        const canvasImage = await pixelsOf(canvasUrl);
        const screenshot = await (async () => {
          const frameHost = window.frameElement
            ?.parentElement as HTMLElement | null;
          if (!frameHost) throw new Error("SLOT_CAPTURE_FRAME_HOST_REQUIRED");
          const priorTransform = frameHost.style.transform;
          frameHost.style.transform = "none";
          try {
            return await browserPage
              .elementLocator(element)
              .screenshot({ base64: true });
          } finally {
            frameHost.style.transform = priorTransform;
          }
        })();
        const domImage = await pixelsOf(
          `data:image/png;base64,${screenshot.base64}`,
        );
        if (WRITE_SLOT_DOM)
          await commands.writeFile(
            `${DESIGN_FROM_TEST}/248-phase3-slot-matrix-dom/${size}-${state}.png`,
            screenshot.base64,
            "base64",
          );
        else {
          const frozenDomUrl = Object.entries(domPngs).find(([path]) =>
            path.endsWith(`/${size}-${state}.png`),
          )?.[1];
          if (!frozenDomUrl)
            throw new Error(`SLOT_DOM_PNG_REQUIRED:${size}:${state}`);
          const frozenDom = await pixelsOf(frozenDomUrl);
          expect([domImage.width, domImage.height]).toEqual([
            frozenDom.width,
            frozenDom.height,
          ]);
          expect(
            domImage.pixels.every(
              (value, index) => value === frozenDom.pixels[index],
            ),
          ).toBe(true);
        }
        expect(canvasImage.width).toBe(220);
        const pixelComparable =
          domImage.width === domRect.width && window.devicePixelRatio === 1;
        let different: number | null = null;
        if (pixelComparable) {
          different = 0;
          const width = Math.min(domImage.width, 160);
          const height = Math.min(domImage.height, canvasImage.height - 10);
          for (let y = 0; y < height; y++)
            for (let x = 0; x < width; x++) {
              const domIndex = (y * domImage.width + x) * 4;
              const canvasIndex = ((y + 10) * canvasImage.width + x + 10) * 4;
              if (
                domImage.pixels[domIndex] !== canvasImage.pixels[canvasIndex] ||
                domImage.pixels[domIndex + 1] !==
                  canvasImage.pixels[canvasIndex + 1] ||
                domImage.pixels[domIndex + 2] !==
                  canvasImage.pixels[canvasIndex + 2]
              )
                different++;
            }
          expect(different).toBeGreaterThan(0);
        }
        rows.push({
          size,
          state,
          rustHeight: rustRect.height,
          domHeight: domRect.height,
          domWidth: domRect.width,
          screenshotWidth: domImage.width,
          dpr: window.devicePixelRatio,
          viewport: [window.innerWidth, window.innerHeight],
          geometryDiff: domRect.height - rustRect.height,
          descriptionHeight,
          requiredText: required?.textContent,
          paintBounds: {
            icon: relativeBounds(".react-aria-Slot-icon svg"),
            name: relativeBounds(".react-aria-Slot-name"),
            required: relativeBounds(".react-aria-Slot-required-badge"),
            description: relativeBounds(".react-aria-Slot-description"),
            filled: relativeBounds(":scope > span"),
          },
          computedPaint: {
            backgroundColor: domStyle.backgroundColor,
            borderColor: domStyle.borderColor,
            borderStyle: domStyle.borderStyle,
            borderWidth: domStyle.borderWidth,
            borderRadius: domStyle.borderRadius,
            fontFamily: domStyle.fontFamily,
            fontSize: domStyle.fontSize,
            lineHeight: domStyle.lineHeight,
            fontWeight: domStyle.fontWeight,
          },
          canvasDomDifferentPixels: different,
          pixelVerdict: pixelComparable
            ? "FAIL_ACTUAL_PIXEL_DIFFERENCE"
            : "UNVERIFIED_SCALED_SCREENSHOT",
          screenshotPath: screenshot.path,
        });
        if (filled) {
          // Page mode through the same product binding: the Slot shell is not rendered.
          reactRoot.render(
            renderCatalogDom(root, resolved.id, { slotMode: "page" }),
          );
          await new Promise<void>((done) =>
            requestAnimationFrame(() => requestAnimationFrame(() => done())),
          );
          const pageChild = [...root.domInputs.values()].find(
            (node) => node.sourceId === textId,
          )!;
          expect(host.querySelector(".react-aria-Slot")).toBeNull();
          expect(
            host.querySelector(`[data-catalog-id="${pageChild.id}"]`)
              ?.textContent,
          ).toBe("Filled");
        }
      }
    if (WRITE_SLOT_DOM) {
      await commands.writeFile(
        `${DESIGN_FROM_TEST}/248-phase3-slot-dom-paint-bounds.json`,
        `${JSON.stringify(
          {
            ...slotDomPaintBounds,
            rows: rows.map(({ size, state, paintBounds, computedPaint }) => ({
              size,
              state,
              paintBounds,
              computedPaint,
            })),
          },
          null,
          2,
        )}\n`,
      );
      await commands.writeFile(
        `${DESIGN_FROM_TEST}/248-phase3-slot-matrix-dom.json`,
        `${JSON.stringify(
          {
            ...slotMatrixExpected,
            rows: rows.map((row) => ({
              size: row.size,
              state: row.state,
              rustHeight: row.rustHeight,
              domHeight: row.domHeight,
              descriptionHeight: row.descriptionHeight,
              canvasDomDifferentPixels: row.canvasDomDifferentPixels,
              pixelRatio:
                Number(row.canvasDomDifferentPixels) /
                (160 * Number(row.domHeight)),
              pixelVerdict: row.pixelVerdict,
              screenshot: `248-phase3-slot-matrix-dom/${row.size}-${row.state}.png`,
            })),
          },
          null,
          2,
        )}\n`,
      );
      return;
    }
    expect(
      rows.map(({ size, state, paintBounds, computedPaint }) => ({
        size,
        state,
        paintBounds,
        computedPaint,
      })),
    ).toEqual(slotDomPaintBounds.rows);
    expect(
      rows.map(({ size, state, rustHeight, domHeight, descriptionHeight }) => ({
        size,
        state,
        rustHeight,
        domHeight,
        descriptionHeight,
      })),
    ).toEqual(
      slotMatrixExpected.rows.map(
        ({ size, state, rustHeight, domHeight, descriptionHeight }) => ({
          size,
          state,
          rustHeight,
          domHeight,
          descriptionHeight,
        }),
      ),
    );
    expect(rows.every((row) => row.screenshotWidth === row.domWidth)).toBe(
      true,
    );
    expect(rows.map((row) => row.canvasDomDifferentPixels)).toEqual(
      slotMatrixExpected.rows.map((row) => row.canvasDomDifferentPixels),
    );
    expect(
      rows.every((row) => row.pixelVerdict === "FAIL_ACTUAL_PIXEL_DIFFERENCE"),
    ).toBe(true);
  });
  it.skipIf(!nativeBaseline)(
    "clips the three pinned Frame overflow inputs in the real DOM hit surface",
    async () => {
      const { document: seed } = createG1Fixture();
      const page = seed.entries["project:page:main"] as Extract<
        CatalogEntry,
        { kind: "page" }
      >;
      const graph = new CatalogGraph(
        {
          ...seed,
          entries: {
            [seed.projectId]: seed.entries[seed.projectId],
            [page.id]: { ...page, children: [] },
          },
        },
        createPencilFixtureLibrary(),
      );
      const root = new CatalogCompositionRoot(
        new CatalogRuntime(
          graph,
          new CatalogStorage(indexedDB, "adr248-browser-frame-clip"),
        ),
        createLayoutEngine(),
        nativeBaseline!.scenario.viewport,
      );
      const operations = nativeBaseline!.scenario.operations.filter(
        (operation) => operation.op === "insertFrameWithOverflowChild",
      );
      const nodes: NodeEntry[] = operations.flatMap(
        (operation): NodeEntry[] => {
          const id = `project:node:${operation.id}` as NodeEntry["id"];
          const childId =
            `project:node:${operation.id}-child-0` as NodeEntry["id"];
          return [
            {
              kind: "node",
              id,
              definitionId: "lib:definition:frame",
              children: [childId],
              props: {},
              visual: {
                overflow: { kind: "set", value: operation.overflow! },
                // G0 Frame input border; the DOM and Canvas bindings both require its color.
                borderColor: { kind: "set", value: "#3851a4" },
                borderWidth: { kind: "set", value: 2 },
              },
              sizing: {
                width: { kind: "set", value: 130 },
                height: { kind: "set", value: 100 },
              },
              placement: { kind: "absolute", x: operation.x, y: operation.y },
              descendantOverrides: [],
            },
            {
              kind: "node",
              id: childId,
              definitionId: "lib:definition:text",
              children: [],
              props: { children: { kind: "set", value: "child" } },
              visual: { fill: { kind: "set", value: "#e04747" } },
              sizing: {
                width: { kind: "set", value: 100 },
                height: { kind: "set", value: 40 },
              },
              placement: { kind: "absolute", x: 90, y: 30 },
              descendantOverrides: [],
            },
          ];
        },
      );
      root.dispatch("G0 Frame clip insert", [
        ...nodes.map((entry) => ({ kind: "put" as const, entry })),
        {
          kind: "put",
          entry: {
            ...page,
            children: operations.map(
              (operation) => `project:node:${operation.id}` as NodeEntry["id"],
            ),
          },
        },
      ]);
      const bySource = new Map(
        [...root.domInputs.values()].map((node) => [node.sourceId, node]),
      );
      // Product-path DOM binding for the same resolved Frame/child inputs.
      const frameIds = operations.map(
        (operation) => bySource.get(`project:node:${operation.id}`)!.id,
      );
      reactRoot.render(
        React.createElement(
          React.Fragment,
          null,
          ...frameIds.map((id) => renderCatalogDom(root, id)),
        ),
      );
      await new Promise<void>((done) =>
        requestAnimationFrame(() => requestAnimationFrame(() => done())),
      );
      for (const operation of operations) {
        const frameInput = bySource.get(`project:node:${operation.id}`)!;
        const frame = host.querySelector<HTMLElement>(
          `[data-catalog-id="${frameInput.id}"]`,
        )!;
        const child = host.querySelector<HTMLElement>(
          `[data-catalog-id="${frameInput.children[0]}"]`,
        )!;
        const parentRect = frame.getBoundingClientRect();
        const childRect = child.getBoundingClientRect();
        expect(getComputedStyle(frame).overflow).toBe(operation.overflow);
        expect([
          childRect.x - parentRect.x,
          childRect.y - parentRect.y,
        ]).toEqual([92, 32]);
        const outsideHit = document.elementFromPoint(
          parentRect.x + 150,
          parentRect.y + 55,
        );
        expect(outsideHit === child).toBe(operation.overflow === "visible");
      }
    },
  );
  it.skipIf(!nativeBaseline)(
    "consumes Group orientation and size gap from the same resolved graph as Rust",
    async () => {
      const { document: seed } = createG1Fixture();
      const page = seed.entries["project:page:main"] as Extract<
        CatalogEntry,
        { kind: "page" }
      >;
      const graph = new CatalogGraph(
        {
          ...seed,
          entries: {
            [seed.projectId]: seed.entries[seed.projectId],
            [page.id]: { ...page, children: [] },
          },
        },
        createPencilFixtureLibrary(),
      );
      const root = new CatalogCompositionRoot(
        new CatalogRuntime(
          graph,
          new CatalogStorage(indexedDB, "adr248-browser-group-size"),
        ),
        createLayoutEngine(),
        nativeBaseline!.scenario.viewport,
      );
      const operations = nativeBaseline!.scenario.operations.filter(
        (operation) => operation.op === "insertGroupWithChildren",
      );
      const nodes: NodeEntry[] = operations.flatMap((operation) => {
        const id = `project:node:${operation.id}` as NodeEntry["id"];
        const children = [0, 1].map(
          (index) =>
            `project:node:${operation.id}-child-${index}` as NodeEntry["id"],
        );
        return [
          {
            kind: "node",
            id,
            name: operation.id,
            definitionId: "lib:definition:group",
            children,
            props: {
              orientation: { kind: "set", value: operation.orientation! },
              size: { kind: "set", value: operation.size! },
            },
            visual: {
              fill: { kind: "set", value: "#edf7ec" },
              borderColor: { kind: "set", value: "#3851a4" },
              borderWidth: { kind: "set", value: 2 },
            },
            sizing: {
              width: { kind: "set", value: 170 },
              height: { kind: "set", value: 110 },
            },
            placement: { kind: "absolute", x: operation.x, y: operation.y },
            descendantOverrides: [],
          },
          ...children.map((childId, index): NodeEntry => ({
            kind: "node",
            id: childId,
            definitionId: "lib:definition:text",
            children: [],
            props: { children: { kind: "set", value: String(index + 1) } },
            visual: {},
            sizing: {
              width: { kind: "set", value: 50 },
              height: { kind: "set", value: 40 },
            },
            descendantOverrides: [],
          })),
        ];
      });
      root.dispatch("G0 Group insert", [
        ...nodes.map((entry) => ({ kind: "put" as const, entry })),
        {
          kind: "put",
          entry: {
            ...page,
            children: operations.map(
              (operation) => `project:node:${operation.id}` as NodeEntry["id"],
            ),
          },
        },
      ]);
      const bySource = new Map(
        [...root.domInputs.values()].map((node) => [node.sourceId, node]),
      );
      // Product-path DOM binding for the same resolved Group/Text inputs.
      reactRoot.render(
        React.createElement(
          React.Fragment,
          null,
          ...operations.map((operation) =>
            renderCatalogDom(
              root,
              bySource.get(`project:node:${operation.id}`)!.id,
            ),
          ),
        ),
      );
      await new Promise<void>((done) =>
        requestAnimationFrame(() => requestAnimationFrame(() => done())),
      );
      for (const operation of operations) {
        const node = bySource.get(`project:node:${operation.id}`)!;
        const group = host.querySelector<HTMLElement>(
          `[data-catalog-id="${node.id}"]`,
        )!;
        const second = host.querySelector<HTMLElement>(
          `[data-catalog-id="${node.children[1]}"]`,
        )!;
        const actual = second.getBoundingClientRect();
        const parent = group.getBoundingClientRect();
        const expectedGap = operation.size === "S" ? 6 : 12;
        expect(node.visual.gap).toBe(expectedGap);
        expect(getComputedStyle(group).gap).toBe(`${expectedGap}px`);
        expect(getComputedStyle(group).backgroundColor).toBe(
          "rgb(237, 247, 236)",
        );
        expect(getComputedStyle(group).borderTopColor).toBe("rgb(56, 81, 164)");
        expect(getComputedStyle(group).flexDirection).toBe(
          operation.orientation === "horizontal" ? "row" : "column",
        );
        expect(group.getAttribute("aria-orientation")).toBe(
          operation.orientation,
        );
        expect(group.getAttribute("role")).toBe("group");
        expect([actual.x - parent.x, actual.y - parent.y]).toEqual(
          operation.orientation === "horizontal" ? [58, 2] : [2, 54],
        );
      }
    },
  );
  it.skipIf(!baseline)(
    "uses the pinned insert commands and typed placement for actual DOM geometry and ARIA",
    async () => {
      const { document: seed } = createG1Fixture();
      const page = seed.entries["project:page:main"] as Extract<
        CatalogEntry,
        { kind: "page" }
      >;
      const graph = new CatalogGraph(
        {
          ...seed,
          entries: {
            [seed.projectId]: seed.entries[seed.projectId],
            [page.id]: { ...page, children: [] },
          },
        },
        createPencilFixtureLibrary(),
      );
      const root = new CatalogCompositionRoot(
        new CatalogRuntime(
          graph,
          new CatalogStorage(indexedDB, "adr248-browser-dom"),
        ),
        createLayoutEngine(),
        baseline!.scenario.viewport,
      );
      const operations = baseline!.scenario.operations;
      const nodes: NodeEntry[] = operations.map((operation) => ({
        kind: "node",
        id: `project:node:${operation.id}`,
        name: operation.id,
        definitionId: `lib:definition:${operation.component.toLowerCase()}`,
        children: operations
          .filter((child) => child.parent === operation.id)
          .map((child) => `project:node:${child.id}` as NodeEntry["id"]),
        props: {
          ...(operation.orientation
            ? { orientation: { kind: "set", value: operation.orientation } }
            : {}),
          ...(operation.size
            ? { size: { kind: "set", value: operation.size } }
            : {}),
          ...(operation.description
            ? { description: { kind: "set", value: operation.description } }
            : {}),
          ...(operation.text
            ? { children: { kind: "set", value: operation.text } }
            : {}),
        },
        visual: {
          ...(operation.fill
            ? { fill: { kind: "set", value: operation.fill } }
            : {}),
          ...(operation.border
            ? {
                borderColor: { kind: "set", value: operation.border },
                borderWidth: { kind: "set", value: 2 },
              }
            : {}),
        },
        sizing: {
          width: { kind: "set", value: operation.width! },
          height: { kind: "set", value: operation.height! },
        },
        placement: { kind: "absolute", x: operation.x, y: operation.y },
        descendantOverrides: [],
      }));
      root.dispatch("G0 insert", [
        ...nodes.map((entry) => ({ kind: "put" as const, entry })),
        { kind: "put", entry: { ...page, children: [nodes[0].id] } },
      ]);
      let inputs = new Map(
        [...root.domInputs.values()].map((node) => [node.id, node]),
      );
      let frame = [...inputs.values()].find(
        (node) => node.sourceId === "project:node:frame",
      )!;
      let slotEditMode = true;
      reactRoot.render(
        renderCatalogDom(root, frame.id, {
          slotMode: slotEditMode ? "edit" : "page",
        }),
      );
      await new Promise<void>((done) =>
        requestAnimationFrame(() => requestAnimationFrame(() => done())),
      );
      // Product binding marks each element with its resolved record id (instance path + source).
      const selector = (id: string) =>
        `[data-catalog-id="${
          [...root.domInputs.values()].find(
            (node) => node.sourceId === `project:node:${id}`,
          )!.id
        }"]`;
      const dom = (id: string) =>
        host.querySelector<HTMLElement>(selector(id))!;
      const frameRect = dom("frame").getBoundingClientRect();
      const groupRect = dom("group").getBoundingClientRect();
      const textRect = dom("text").getBoundingClientRect();
      expect(frameRect.x - host.getBoundingClientRect().x).toBe(40);
      expect(frameRect.y - host.getBoundingClientRect().y).toBe(40);
      expect(frameRect.width).toBe(440);
      expect(dom("frame").getAttribute("role")).toBeNull();
      expect(getComputedStyle(dom("frame")).display).toBe("block");
      expect(getComputedStyle(dom("frame")).borderTopWidth).toBe("2px");
      expect(getComputedStyle(dom("frame")).borderTopColor).toBe(
        "rgb(56, 81, 164)",
      );
      expect(groupRect.x - frameRect.x).toBe(22);
      expect(groupRect.y - frameRect.y).toBe(22);
      expect(groupRect.width).toBe(380);
      expect(textRect.x - groupRect.x).toBe(180);
      expect(textRect.y - groupRect.y).toBe(0);
      expect(dom("group").getAttribute("role")).toBe("group");
      expect(getComputedStyle(dom("group")).backgroundColor).toBe(
        "rgba(0, 0, 0, 0)",
      );
      expect(dom("group").getAttribute("aria-orientation")).toBe("horizontal");
      expect(getComputedStyle(dom("group")).flexDirection).toBe("row");
      expect(getComputedStyle(dom("group")).gap).toBe("8px");
      expect(
        dom("slot").querySelector(".react-aria-Slot-description")?.textContent,
      ).toBe("내용");
      expect(dom("slot").getAttribute("data-empty")).toBe("true");
      root.dispatch("supplemental RAC Group properties", [
        {
          kind: "patchNodeProp",
          id: "project:node:group",
          key: "label",
          write: { kind: "set", value: "Toolbar" },
        },
        {
          kind: "patchNodeProp",
          id: "project:node:group",
          key: "aria-label",
          write: { kind: "set", value: "Actions" },
        },
        {
          kind: "patchNodeProp",
          id: "project:node:group",
          key: "role",
          write: { kind: "set", value: "region" },
        },
        {
          kind: "patchNodeProp",
          id: "project:node:group",
          key: "isDisabled",
          write: { kind: "set", value: true },
        },
      ]);
      inputs = new Map(
        [...root.domInputs.values()].map((node) => [node.id, node]),
      );
      frame = [...inputs.values()].find(
        (node) => node.sourceId === "project:node:frame",
      )!;
      reactRoot.render(
        renderCatalogDom(root, frame.id, {
          slotMode: slotEditMode ? "edit" : "page",
        }),
      );
      await new Promise<void>((done) =>
        requestAnimationFrame(() => requestAnimationFrame(() => done())),
      );
      expect(dom("group").getAttribute("role")).toBe("region");
      expect(dom("group").getAttribute("aria-label")).toBe("Actions");
      expect(dom("group").getAttribute("data-group-label")).toBe("Toolbar");
      expect(dom("group").getAttribute("data-disabled")).not.toBeNull();
      // (A disabled RAC Group does not fade in the Preview — the Canvas does not either, ADR-256
      // Phase 6a removed the layout group's opacity.)
      expect(getComputedStyle(dom("group")).opacity).toBe("1");
      const slotEntry = graph.getEntry("project:node:slot") as NodeEntry;
      const fillId = "project:node:slotFill" as NodeEntry["id"];
      root.dispatch("fill Slot", [
        {
          kind: "put",
          entry: {
            kind: "node",
            id: fillId,
            definitionId: "lib:definition:text",
            children: [],
            props: { children: { kind: "set", value: "Filled" } },
            visual: {},
            sizing: {},
            descendantOverrides: [],
          },
        },
        { kind: "put", entry: { ...slotEntry, children: [fillId] } },
      ]);
      inputs = new Map(
        [...root.domInputs.values()].map((node) => [node.id, node]),
      );
      frame = [...inputs.values()].find(
        (node) => node.sourceId === "project:node:frame",
      )!;
      reactRoot.render(
        renderCatalogDom(root, frame.id, {
          slotMode: slotEditMode ? "edit" : "page",
        }),
      );
      await new Promise<void>((done) =>
        requestAnimationFrame(() => requestAnimationFrame(() => done())),
      );
      expect(dom("slot").getAttribute("data-empty")).toBeNull();
      expect(dom("slot").textContent).toContain("Filled");
      slotEditMode = false;
      reactRoot.render(
        renderCatalogDom(root, frame.id, {
          slotMode: slotEditMode ? "edit" : "page",
        }),
      );
      await new Promise<void>((done) =>
        requestAnimationFrame(() => requestAnimationFrame(() => done())),
      );
      expect(host.querySelector(selector("slot"))).toBeNull();
      expect(host.querySelector(selector("slotFill"))?.textContent).toBe(
        "Filled",
      );
    },
  );
});
