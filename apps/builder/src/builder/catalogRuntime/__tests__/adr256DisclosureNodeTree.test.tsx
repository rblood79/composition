// @vitest-environment jsdom
import "fake-indexeddb/auto";
import { act } from "react";
import { createElement, type ReactElement } from "react";
import { createRoot } from "react-dom/client";
import {
  Button,
  Disclosure,
  DisclosurePanel,
  Heading,
  Text,
} from "react-aria-components";
import { afterEach, describe, expect, it } from "vitest";
import {
  insertNodes,
  removeTargets,
  setFields,
} from "../../../../../../packages/shared/src/catalog/commands";
import { getPrimitiveBinding } from "../../../../../../packages/shared/src/catalog/bindings";
import { CatalogGraph } from "../../../../../../packages/shared/src/catalog/document/graph";
import { buildCodeCatalogLibrary } from "../../../../../../packages/shared/src/catalog/document/codeCatalogLibrary";
import { REUSABLE_ORIGIN_TEMPLATES } from "../../../../../../packages/shared/src/catalog/document/generated/reusableOriginLibrary";
import type {
  EntryId,
  LibraryDefinitionId,
  NodeId,
} from "../../../../../../packages/shared/src/catalog/document/types";
import { renderCatalogDom } from "../domBinding";
import { newCatalogProjectDocument } from "../project";
import { CatalogStorage } from "../storage";
import { CatalogWorkspace } from "../workspace";
import { nodeLayoutEngine } from "./support/nodeLayoutEngine";

/**
 * ADR-256 Phase 8c (G2) — a Disclosure draws its node tree, the reference
 * `Disclosure > Heading > Button[slot=trigger] > (chevron + title) + DisclosurePanel > content`
 * (react-aria.adobe.com Disclosure — the starter's `DisclosureHeader` · `DisclosurePanel`). The
 * chevron is an Icon node (the Tree chevron's way, Phase 5h): RAC's expansion turns it. The Canvas
 * keeps the old trigger geometry (padding 8 · 12, gap 4, chevron 18, title at x 34 — the DOM
 * sheet's) and draws the panel only while expanded.
 */
const BODY = "project:node:home-body" as NodeId;
const PLACED = "project:node:placed" as NodeId;

async function place(type: "disclosure" | "disclosuregroup", props: Record<string, unknown> = {}) {
  const workspace = new CatalogWorkspace(
    new CatalogGraph(
      newCatalogProjectDocument({
        projectId: "project:project:adr256-p8c" as EntryId<"project">,
        name: "Phase 8c",
      }),
      await buildCodeCatalogLibrary(),
    ),
    new CatalogStorage(indexedDB, `adr256-p8c-${Math.random()}`),
    {
      engine: await nodeLayoutEngine(),
      viewport: { width: 1920, height: 1080 },
      autosaveSchedule: () => {},
      // (A fixed text measure — the line box is the font's line height, as the old chevron test's.)
      textMeasure: (text: string, font: { fontSize: number; lineHeight?: number }) => ({
        width: text.length * font.fontSize * 0.5,
        exactWidth: text.length * font.fontSize * 0.5,
        minWidth: text.length * font.fontSize * 0.5,
        height: font.fontSize * (font.lineHeight || 1.2),
      }),
    },
  );
  workspace.execute(
    insertNodes({
      parent: { kind: "node", id: BODY },
      entries: [
        {
          kind: "node",
          id: PLACED,
          definitionId:
            `lib:definition:origin-component-${type}` as LibraryDefinitionId,
          children: [],
          props: Object.fromEntries(
            Object.entries(props).map(([key, value]) => [key, { kind: "set", value }]),
          ) as never,
          visual: {},
          sizing: {},
          descendantOverrides: [],
        },
      ],
      rootIds: [PLACED],
      newId: workspace.newId,
    }),
  );
  const root = workspace.root;
  const placed = () =>
    [...root.canvasInputs.values()].find(
      (record) => record.sourceId === PLACED,
    )!;
  const part = (name: string) =>
    [...root.canvasInputs.values()].find(
      (record) => root.typeOf(record) === name,
    );
  const all = (name: string) =>
    [...root.canvasInputs.values()].filter(
      (record) => root.typeOf(record) === name,
    );
  const kids = (id: string) =>
    root.canvasInputs.get(id)!.children.map((child) => root.canvasInputs.get(child)!);
  return { workspace, root, placed, part, all, kids };
}

let unmount: (() => Promise<void>) | undefined;
afterEach(async () => {
  await unmount?.();
  unmount = undefined;
  document.body.innerHTML = "";
});
async function mount(element: ReactElement) {
  const host = document.createElement("div");
  document.body.append(host);
  const root = createRoot(host);
  await act(async () => root.render(element));
  unmount = async () => act(async () => root.unmount());
  return host;
}
const settle = () =>
  act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 30));
  });
async function press(button: HTMLElement) {
  await act(async () => {
    for (const type of ["pointerdown", "pointerup"])
      button.dispatchEvent(
        new PointerEvent(type, {
          bubbles: true,
          pointerId: 1,
          pointerType: "mouse",
        }),
      );
    button.click();
  });
  await settle();
}
/**
 * Decision 11 structure: tag · role · slot · aria (ids dropped) · text. Hidden elements are left out
 * — the shared Popover's focus scope sentinels (`ContentFocusScope` — `span[hidden]`, its focus
 * containment and restore without a Dialog).
 */
function structure(element: Element): string {
  const walk = (node: Element): string => {
    // (An Icon node is `div.react-aria-Icon > svg` — the reference's glyph is the svg alone.)
    if (node.classList.contains("react-aria-Icon") && node.firstElementChild)
      return walk(node.firstElementChild);
    const attributes = [...node.attributes]
      .filter((attribute) =>
        /^(role|slot|aria-(?!labelledby|describedby|controls))/.test(
          attribute.name,
        ),
      )
      .map((attribute) => `${attribute.name}=${attribute.value}`)
      .sort();
    const content = [...node.childNodes]
      .filter((child) => !(child as Element).hasAttribute?.("hidden"))
      .map((child) =>
      child.nodeType === 1
        ? walk(child as Element)
        : (child.textContent ?? "").trim(),
    );
    return `<${node.tagName.toLowerCase()} ${attributes.join(" ")}>${content.join("")}</>`;
  };
  return walk(element);
}

const node = (id: string) =>
  REUSABLE_ORIGIN_TEMPLATES.find((entry) => entry.id === id)!;
const shape = (id: string): unknown => [
  node(id).definitionId.replace(/^lib:definition:(type-)?/, ""),
  ...node(id).children.map(shape),
];

describe("ADR-256 Phase 8c — Disclosure draws its node tree", () => {
  it("the origin is Disclosure > Heading > Button[trigger] > Icon + title Text, + DisclosurePanel > Text", () => {
    expect(shape("lib:template:component-disclosure")).toEqual([
      "Disclosure",
      ["heading", ["Button", ["Icon"], ["text"]]],
      ["DisclosurePanel", ["text"]],
    ]);
    const trigger = node("lib:template:component-disclosure__trigger");
    expect(trigger.props).toMatchObject({ slot: "trigger" });
    expect(node("lib:template:component-disclosure__chevron").props).toMatchObject({
      iconName: "chevron-right",
    });
    expect(node("lib:template:component-disclosure__title").props.children).toBe("{title}");
  });

  it("the expanded DOM has the reference's structure", async () => {
    const { workspace, placed } = await place("disclosure");
    const host = await mount(renderCatalogDom(workspace.root, placed().id));
    const ours = structure(host.querySelector(".react-aria-Disclosure")!);
    expect(host.querySelector(".react-aria-Disclosure")!.hasAttribute("data-expanded")).toBe(true);
    await unmount?.();
    document.body.innerHTML = "";
    const reference = await mount(
      <Disclosure defaultExpanded>
        <Heading>
          <Button slot="trigger">
            {/* (lucide's ChevronRight — the starter's glyph.) */}
            <svg aria-hidden="true" viewBox="0 0 24 24">
              <path d="m9 18 6-6-6-6" />
            </svg>
            <Text>Section Title</Text>
          </Button>
        </Heading>
        <DisclosurePanel>
          <div>
            <Text>Section content goes here.</Text>
          </div>
        </DisclosurePanel>
      </Disclosure>,
    );
    expect(ours).toBe(structure(reference.querySelector(".react-aria-Disclosure")!));
  });

  it("the trigger Button is RAC's plain button in the sheet's box; its glyph and title take its color", async () => {
    const { workspace, placed, part } = await place("disclosure");
    const host = await mount(renderCatalogDom(workspace.root, placed().id));
    const trigger = host.querySelector<HTMLElement>('button[slot="trigger"]')!;
    expect(trigger.classList.contains("button-base")).toBe(false);
    expect(trigger.getAttribute("style") ?? "", "trigger inline").not.toMatch(
      /background|padding|height|gap/,
    );
    const glyph = trigger.querySelector<HTMLElement>(".react-aria-Icon")!;
    expect(glyph.style.color).toBe("");
    expect(trigger.querySelector<HTMLElement>(".react-aria-Text")!.style.color).toBe("");
    expect(part("Heading")!.props.children ?? "").toBe("");
  });

  it.each([
    ["sm", 12],
    ["md", 14],
    ["lg", 16],
  ])("Canvas %s: the trigger's old geometry — chevron 18 at x 12, title at x 34 in the size font", async (size, fontSize) => {
    const { root, part } = await place("disclosure", { size });
    const trigger = part("Button")!;
    const chevron = part("Icon")!;
    const title = root.canvasInputs.get(trigger.children[1]!)!;
    const geometry = root.getGeometry([trigger.id, chevron.id, title.id]);
    const box = geometry.get(chevron.id)!;
    expect(box.x).toBe(12);
    expect([box.width, box.height]).toEqual([18, 18]);
    expect(box.y).toBeCloseTo((geometry.get(trigger.id)!.height - 18) / 2, 1);
    expect(geometry.get(title.id)!.x).toBe(34);
    expect(title.visual).toMatchObject({ fontSize, fontWeight: 600 });
    // (The old header's — the chevron 18 or the line, plus the 8px padding.)
    expect(geometry.get(trigger.id)!.height).toBeCloseTo(
      { sm: 34, md: 36, lg: 38.857 }[size]!,
      2,
    );
    // The panel content takes the Disclosure's size font (the old DisclosureContent's).
    const content = root.canvasInputs.get(part("DisclosurePanel")!.children[0]!)!;
    expect(content.visual).toMatchObject({ fontSize, fontWeight: 400 });
    // The panel's box is the sheet's content div (`.react-aria-DisclosurePanel > div` padding 8 · 16).
    const inPanel = root.getGeometry([content.id]).get(content.id)!;
    expect([inPanel.x, inPanel.y]).toEqual([16, 8]);
  });

  it("the expansion: Canvas panel only while expanded, the chevron turned; the Preview trigger toggles it", async () => {
    const { workspace, placed, part } = await place("disclosure");
    expect(part("DisclosurePanel")!.hidden).toBeFalsy();
    expect(part("Icon")!.derivedProps?.iconName).toBe("chevron-down");
    workspace.execute(
      setFields({
        targets: [{ kind: "node", id: PLACED }],
        props: { isExpanded: { kind: "set", value: false } },
      }),
    );
    expect(part("DisclosurePanel")!.hidden).toBe(true);
    expect(part("Icon")!.derivedProps?.iconName).toBeUndefined();
    expect(part("Heading")!.hidden).toBeFalsy();
    const host = await mount(renderCatalogDom(workspace.root, placed().id));
    const disclosure = host.querySelector(".react-aria-Disclosure")!;
    expect(disclosure.hasAttribute("data-expanded")).toBe(false);
    await press(host.querySelector<HTMLElement>('button[slot="trigger"]')!);
    expect(disclosure.hasAttribute("data-expanded")).toBe(true);
  });

  it("the title is the Disclosure's `title` (Canvas and DOM)", async () => {
    const { workspace, placed, part, root } = await place("disclosure", { title: "Specs" });
    const trigger = part("Button")!;
    expect(root.canvasInputs.get(trigger.children[1]!)!.props.children).toBe("Specs");
    const host = await mount(renderCatalogDom(workspace.root, placed().id));
    expect(host.querySelector('button[slot="trigger"]')!.textContent).toBe("Specs");
  });

  it("a DisclosureGroup's sections keep their own titles and contents", async () => {
    const { all, kids } = await place("disclosuregroup");
    expect(
      all("Button").map((button) => kids(button.id)[1]!.props.children),
    ).toEqual(["Section 1", "Section 2"]);
    expect(
      all("DisclosurePanel").map((panel) => kids(panel.id)[0]!.props.children),
    ).toEqual(["Content 1", "Content 2"]);
  });

  it("the trigger Button is a required part (G0 ⑨)", async () => {
    const { workspace, part } = await place("disclosure");
    expect(() =>
      workspace.execute(
        removeTargets({
          targets: [workspace.positionOfRecord(part("Button")!.id)!.target],
        }),
      ),
    ).toThrow();
    expect(part("Button")).toBeDefined();
  });
});
