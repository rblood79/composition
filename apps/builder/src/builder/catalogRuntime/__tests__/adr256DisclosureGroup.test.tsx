// @vitest-environment jsdom
import "fake-indexeddb/auto";
import { act } from "react";
import { createElement, type ReactElement } from "react";
import { createRoot } from "react-dom/client";
import {
  Button,
  Disclosure,
  DisclosureGroup,
  DisclosurePanel,
  Heading,
  Text,
} from "react-aria-components";
import { catalogChildKind } from "../../../../../../packages/shared/src/catalog/nesting/nestingRules";
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
 * ADR-256 Phase 8d (G2) — a DisclosureGroup takes free content (G0 ② — RAC `DisclosureGroup`
 * renders its children as they are; the reference example's are Disclosures) and draws RAC's
 * DisclosureGroup: its expansion (`allowsMultipleExpanded`) is RAC's across its Disclosures.
 */
const BODY = "project:node:home-body" as NodeId;
const PLACED = "project:node:placed" as NodeId;

async function place(type: "disclosure" | "disclosuregroup", props: Record<string, unknown> = {}) {
  const workspace = new CatalogWorkspace(
    new CatalogGraph(
      newCatalogProjectDocument({
        projectId: "project:project:adr256-p8d" as EntryId<"project">,
        name: "Phase 8d",
      }),
      await buildCodeCatalogLibrary(),
    ),
    new CatalogStorage(indexedDB, `adr256-p8d-${Math.random()}`),
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

const starter = (title: string, content: string) => (
  <Disclosure id={title}>
    <Heading>
      <Button slot="trigger">
        <svg aria-hidden="true" viewBox="0 0 24 24">
          <path d="m9 18 6-6-6-6" />
        </svg>
        <Text>{title}</Text>
      </Button>
    </Heading>
    <DisclosurePanel>
      <div>
        <Text>{content}</Text>
      </div>
    </DisclosurePanel>
  </Disclosure>
);

describe("ADR-256 Phase 8d — DisclosureGroup takes free content", () => {
  it("its children kind is free (no unconverted-family row)", () => {
    expect(catalogChildKind("DisclosureGroup")).toEqual({ kind: "free" });
  });

  it("the DOM has the reference's structure (RAC DisclosureGroup around the Disclosures)", async () => {
    const { workspace, placed } = await place("disclosuregroup");
    const host = await mount(renderCatalogDom(workspace.root, placed().id));
    const ours = structure(host.querySelector(".react-aria-DisclosureGroup")!);
    await unmount?.();
    document.body.innerHTML = "";
    const reference = await mount(
      // (In a group, RAC's expansion is the group's — the origin's sections are both expanded.)
      <DisclosureGroup
        allowsMultipleExpanded
        defaultExpandedKeys={["Section 1", "Section 2"]}
      >
        {starter("Section 1", "Content 1")}
        {starter("Section 2", "Content 2")}
      </DisclosureGroup>,
    );
    expect(ours).toBe(
      structure(reference.querySelector(".react-aria-DisclosureGroup")!),
    );
  });

  it("a free child (a Text) stands in the group on both consumers", async () => {
    const { workspace, placed, root, all } = await place("disclosuregroup");
    workspace.execute(
      insertNodes({
        parent: workspace.positionOfRecord(placed().id)!.target,
        entries: [
          {
            kind: "node",
            id: "project:node:note",
            definitionId: "lib:definition:text",
            children: [],
            props: { children: { kind: "set", value: "Note" } },
            visual: {},
            sizing: {},
            descendantOverrides: [],
          } as never,
        ],
        rootIds: ["project:node:note" as NodeId],
        newId: workspace.newId,
      }),
    );
    const note = all("Text").find((record) => record.props.children === "Note");
    expect(note).toBeDefined();
    expect(root.getGeometry([note!.id]).get(note!.id)!.height).toBeGreaterThan(0);
    const host = await mount(renderCatalogDom(workspace.root, placed().id));
    expect(
      [...host.querySelector(".react-aria-DisclosureGroup")!.children].some(
        (child) => child.textContent === "Note",
      ),
    ).toBe(true);
  });

  it("allowsMultipleExpanded false: expanding a section collapses the other (RAC)", async () => {
    const { workspace, placed } = await place("disclosuregroup", {
      allowsMultipleExpanded: false,
    });
    const host = await mount(renderCatalogDom(workspace.root, placed().id));
    const sections = () => [...host.querySelectorAll(".react-aria-Disclosure")];
    expect(sections().map((section) => section.hasAttribute("data-expanded"))).toEqual([
      true,
      false,
    ]);
    await press(sections()[1]!.querySelector<HTMLElement>('button[slot="trigger"]')!);
    expect(sections().map((section) => section.hasAttribute("data-expanded"))).toEqual([
      false,
      true,
    ]);
  });
});
