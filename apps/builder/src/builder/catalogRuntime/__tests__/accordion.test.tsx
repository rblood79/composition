// @vitest-environment jsdom
import "fake-indexeddb/auto";
import { act, type ReactElement } from "react";
import {
  Button,
  Disclosure,
  DisclosureGroup as RacDisclosureGroup,
  DisclosurePanel,
  Heading,
  Text,
} from "react-aria-components";
import { createRoot } from "react-dom/client";
import { afterEach, describe, expect, it } from "vitest";
import { insertNodes } from "../../../../../../packages/shared/src/catalog/commands";
import { buildCodeCatalogLibrary } from "../../../../../../packages/shared/src/catalog/document/codeCatalogLibrary";
import { CatalogGraph } from "../../../../../../packages/shared/src/catalog/document/graph";
import type {
  EntryId,
  LibraryDefinitionId,
  NodeId,
} from "../../../../../../packages/shared/src/catalog/document/types";
import { catalogChildKind } from "../../../../../../packages/shared/src/catalog/nesting/nestingRules";
import { renderCatalogDom } from "../domBinding";
import { newCatalogProjectDocument } from "../project";
import { CatalogStorage } from "../storage";
import { CatalogWorkspace } from "../workspace";
import { nodeLayoutEngine } from "./support/nodeLayoutEngine";
import { getPaletteItems } from "../../panels/components/paletteItems";
import { catalogStateKeysOf } from "../../../../../../packages/shared/src/catalog/document/stateOwnerRefs";
import { CAPABILITY_REGISTRY } from "../../../../../../packages/shared/src/interactions/capabilityRegistry";
import { generateCodeView } from "../../../../../../packages/shared/src/codeView/generate";
import { LIBRARY_CONTRACT_VERSION } from "../../../../../../packages/shared/src/catalog/document/types";
import {
  catalogCodeViewFileBaseline,
  catalogCodeViewProjectApply,
  catalogCodeViewProjectSession,
} from "../codeViewApply";

/**
 * ADR-256 Phase 8d (G2) — an Accordion takes free content (G0 ② — RAC `DisclosureGroup`
 * renders its children as they are; the reference example's are Disclosures) and draws RAC's
 * Accordion: its expansion (`allowsMultipleExpanded`) is RAC's across its Disclosures.
 */
const BODY = "project:node:home-body" as NodeId;
const PLACED = "project:node:placed" as NodeId;

async function place(
  type: "disclosure" | "accordion",
  props: Record<string, unknown> = {},
) {
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
      textMeasure: (
        text: string,
        font: { fontSize: number; lineHeight?: number },
      ) => ({
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
            Object.entries(props).map(([key, value]) => [
              key,
              { kind: "set", value },
            ]),
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
    root.canvasInputs
      .get(id)!
      .children.map((child) => root.canvasInputs.get(child)!);
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

describe("ADR-256 Phase 8d — Accordion takes free content", () => {
  it("RAC import 별칭을 유지하면서 Code View 편집이 Accordion 원본에 반영된다", async () => {
    const { workspace, placed } = await place("accordion", {
      allowsMultipleExpanded: false,
    });
    const graph = workspace.runtime.graph;
    const session = catalogCodeViewProjectSession(graph);
    const path = "src/pages/Home.tsx";
    catalogCodeViewFileBaseline(session, graph, path);
    const before = session.baselines.get(path)!.result.code;
    expect(before).toContain("DisclosureGroup as Accordion");
    const fromA = before.indexOf("allowsMultipleExpanded={false}");
    expect(fromA).toBeGreaterThan(-1);
    const start = fromA + "allowsMultipleExpanded={".length;
    const edited = before.slice(0, start) + "true" + before.slice(start + 5);
    const result = catalogCodeViewProjectApply(workspace, session, [
      {
        path,
        edited,
        changes: [{ fromA: start, toA: start + 5, insert: "true" }],
      },
    ]);
    expect(result.rejected).toEqual([]);
    expect(workspace.root.typeOf(placed())).toBe("Accordion");
    expect(placed().props.allowsMultipleExpanded).toBe(true);
    expect(graph.getEntry(PLACED)).toMatchObject({
      definitionId: "lib:definition:origin-component-accordion",
    });
  });

  it("Accordion 식별자가 팔레트·상태·Interactions·Code View·저장 재로드에 이어진다", async () => {
    const { workspace, placed } = await place("accordion", {
      allowsMultipleExpanded: false,
    });
    const palette = getPaletteItems();
    expect(palette.find((item) => item.type === "Accordion")?.label).toBe(
      "accordion",
    );
    expect(palette.some((item) => item.type === "DisclosureGroup")).toBe(false);
    expect(catalogStateKeysOf("Accordion")).toContain("isDisabled");
    expect(CAPABILITY_REGISTRY.Accordion.capabilities.collapse).toBeDefined();
    expect(CAPABILITY_REGISTRY.DisclosureGroup).toBeUndefined();
    expect(workspace.root.typeOf(placed())).toBe("Accordion");
    const graph = workspace.runtime.graph;
    const code = generateCodeView({
      reader: graph,
      pageId: "project:page:home" as EntryId<"page">,
      collections: [],
    });
    expect(code.code).toContain("<Accordion");
    expect(code.code).toMatch(
      /import \{[^}]*DisclosureGroup as Accordion[^}]*\} from 'react-aria-components'/,
    );
    expect(code.code).not.toContain("<DisclosureGroup");
    const document = graph.exportDocument();
    expect(document.entries[PLACED]).toMatchObject({
      definitionId: "lib:definition:origin-component-accordion",
    });
    const storage = new CatalogStorage(
      indexedDB,
      `accordion-roundtrip-${Math.random()}`,
    );
    await storage.create(document, graph.library);
    const loaded = await storage.load(document.projectId, graph.library);
    expect(loaded).toEqual(document);
    expect(loaded.libraryContractVersion).toBe(LIBRARY_CONTRACT_VERSION);
    expect(new CatalogGraph(loaded, graph.library).getEntry(PLACED)).toEqual(
      document.entries[PLACED],
    );
    expect(
      () =>
        new CatalogGraph(
          {
            ...loaded,
            libraryContractVersion: LIBRARY_CONTRACT_VERSION - 1,
          } as typeof loaded,
          graph.library,
        ),
    ).toThrow();
  });

  it("its children kind is free (no unconverted-family row)", () => {
    expect(catalogChildKind("Accordion")).toEqual({ kind: "free" });
  });

  it("the DOM has the reference's structure (RAC DisclosureGroup around the Disclosures)", async () => {
    const { workspace, placed } = await place("accordion");
    const host = await mount(renderCatalogDom(workspace.root, placed().id));
    const ours = structure(host.querySelector(".react-aria-Accordion")!);
    await unmount?.();
    document.body.innerHTML = "";
    const reference = await mount(
      // The group defaults to a single expanded section, matching S2.
      <RacDisclosureGroup defaultExpandedKeys={["Section 1"]}>
        {starter("Section 1", "Content 1")}
        {starter("Section 2", "Content 2")}
      </RacDisclosureGroup>,
    );
    expect(ours).toBe(
      structure(reference.querySelector(".react-aria-DisclosureGroup")!),
    );
  });

  it("a free child (a Text) stands in the group on both consumers", async () => {
    const { workspace, placed, root, all } = await place("accordion");
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
    expect(root.getGeometry([note!.id]).get(note!.id)!.height).toBeGreaterThan(
      0,
    );
    const host = await mount(renderCatalogDom(workspace.root, placed().id));
    expect(
      [...host.querySelector(".react-aria-Accordion")!.children].some(
        (child) => child.textContent === "Note",
      ),
    ).toBe(true);
  });

  it("allowsMultipleExpanded false: expanding a section collapses the other (RAC)", async () => {
    const { workspace, placed } = await place("accordion", {
      allowsMultipleExpanded: false,
    });
    const host = await mount(renderCatalogDom(workspace.root, placed().id));
    const sections = () => [...host.querySelectorAll(".react-aria-Disclosure")];
    expect(
      sections().map((section) => section.hasAttribute("data-expanded")),
    ).toEqual([true, false]);
    await press(
      sections()[1]!.querySelector<HTMLElement>('button[slot="trigger"]')!,
    );
    expect(
      sections().map((section) => section.hasAttribute("data-expanded")),
    ).toEqual([false, true]);
  });
});
