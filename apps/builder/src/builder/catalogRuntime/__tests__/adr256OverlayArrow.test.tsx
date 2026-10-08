// @vitest-environment jsdom
import "fake-indexeddb/auto";
import { act } from "react";
import { createElement, type ReactElement } from "react";
import { createRoot } from "react-dom/client";
import {
  Button,
  DialogTrigger,
  Heading,
  OverlayArrow,
  Popover,
  Text,
  Tooltip,
  TooltipTrigger,
} from "react-aria-components";
import { afterEach, describe, expect, it } from "vitest";
import {
  insertNodes,
  removeTargets,
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
 * ADR-256 Phase 8a (G2) — a Popover's · Tooltip's arrow is a node, the reference's
 * `Popover > OverlayArrow + children` · `Tooltip > OverlayArrow + children` (react-aria.adobe.com
 * Popover · Tooltip — the starter's arrow svg, 12 · 8). The author adds or removes the node (G0 ④
 * `trigger` row); the overlay draws no arrow of its own. RAC places the arrow from the trigger: the
 * Canvas, which draws no open overlay, has no box for it.
 */
const BODY = "project:node:home-body" as NodeId;
const PLACED = "project:node:placed" as NodeId;

async function place(type: "popover" | "tooltip") {
  const workspace = new CatalogWorkspace(
    new CatalogGraph(
      newCatalogProjectDocument({
        projectId: "project:project:adr256-p8a" as EntryId<"project">,
        name: "Phase 8a",
      }),
      await buildCodeCatalogLibrary(),
    ),
    new CatalogStorage(indexedDB, `adr256-p8a-${Math.random()}`),
    {
      engine: await nodeLayoutEngine(),
      viewport: { width: 1920, height: 1080 },
      autosaveSchedule: () => {},
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
          props: {},
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
  return { workspace, root, placed, part };
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
async function keyboardFocus(button: HTMLElement) {
  await act(async () => {
    // (RAC opens a tooltip on focus when the focus is a keyboard's.)
    document.dispatchEvent(
      new KeyboardEvent("keydown", { key: "Tab", bubbles: true }),
    );
    button.focus();
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

const arrowSvg = (size: number) =>
  createElement(
    "svg",
    { width: size, height: size, viewBox: `0 0 ${size} ${size}` },
    createElement("path", {
      d: `M0 0 L${size / 2} ${size / 2} L${size} 0`,
    }),
  );

describe("ADR-256 Phase 8a — OverlayArrow node", () => {
  it("the origins hold the arrow node first in the overlay", () => {
    const children = (id: string) =>
      REUSABLE_ORIGIN_TEMPLATES.find((node) => node.id === id)!.children.map(
        (child) =>
          REUSABLE_ORIGIN_TEMPLATES.find((node) => node.id === child)!
            .definitionId,
      );
    const overlay = (root: string) =>
      REUSABLE_ORIGIN_TEMPLATES.find((node) => node.id === root)!.children[1]!;
    expect(children(overlay("lib:template:component-popover"))).toEqual([
      "lib:definition:type-OverlayArrow",
      "lib:definition:origin-component-heading",
      "lib:definition:origin-component-description",
    ]);
    expect(children(overlay("lib:template:component-tooltip"))).toEqual([
      "lib:definition:type-OverlayArrow",
      "lib:definition:origin-component-description",
    ]);
  });

  it("the arrow's presence is the node's: no hideArrow prop, no arrow primitive", () => {
    expect(
      getPrimitiveBinding("Popover")!.props.accepts.hideArrow,
    ).toBeUndefined();
    expect(getPrimitiveBinding("Popover")!.skiaPrimitive).toBeUndefined();
    expect(getPrimitiveBinding("Tooltip")!.skiaPrimitive).toBeUndefined();
    expect(
      REUSABLE_ORIGIN_TEMPLATES.some((node) => "hideArrow" in node.props),
    ).toBe(false);
  });

  it("Popover: the open overlay has the reference's structure (arrow svg 12)", async () => {
    const { workspace, placed } = await place("popover");
    const host = await mount(renderCatalogDom(workspace.root, placed().id));
    await press(host.querySelector("button")!);
    const actual = document.querySelector(".react-aria-Popover")!;
    expect(actual).not.toBeNull();
    const arrow = actual.querySelector(".react-aria-OverlayArrow svg")!;
    expect(arrow.getAttribute("width")).toBe("12");
    expect(arrow.querySelector("path")!.getAttribute("d")).toBe(
      "M0 0 L6 6 L12 0",
    );
    const ours = structure(actual);
    await unmount?.();
    document.body.innerHTML = "";
    await mount(
      <DialogTrigger defaultOpen>
        <Button>Open Popover</Button>
        <Popover>
          <OverlayArrow>{arrowSvg(12)}</OverlayArrow>
          <Heading>Popover Title</Heading>
          <Text slot="description">Popover content goes here.</Text>
        </Popover>
      </DialogTrigger>,
    );
    await settle();
    expect(ours).toBe(
      structure(document.querySelector(".react-aria-Popover")!),
    );
  });

  it("Tooltip: the open overlay has the reference's structure (arrow svg 8)", async () => {
    const { workspace, placed } = await place("tooltip");
    const host = await mount(renderCatalogDom(workspace.root, placed().id));
    await keyboardFocus(host.querySelector("button")!);
    const actual = document.querySelector(".react-aria-Tooltip")!;
    expect(actual).not.toBeNull();
    expect(actual.querySelectorAll(".react-aria-OverlayArrow")).toHaveLength(1);
    expect(
      actual
        .querySelector(".react-aria-OverlayArrow svg")!
        .getAttribute("width"),
    ).toBe("8");
    const ours = structure(actual);
    await unmount?.();
    document.body.innerHTML = "";
    await mount(
      <TooltipTrigger defaultOpen>
        <Button>Hover me</Button>
        <Tooltip>
          <OverlayArrow>{arrowSvg(8)}</OverlayArrow>
          <Text slot="description">Tooltip text</Text>
        </Tooltip>
      </TooltipTrigger>,
    );
    await settle();
    expect(ours).toBe(
      structure(document.querySelector(".react-aria-Tooltip")!),
    );
  });

  it("removing the arrow node removes the arrow (the overlay draws none of its own)", async () => {
    for (const type of ["popover", "tooltip"] as const) {
      const { workspace, placed, part } = await place(type);
      workspace.execute(
        removeTargets({
          targets: [
            workspace.positionOfRecord(part("OverlayArrow")!.id)!.target,
          ],
        }),
      );
      expect(part("OverlayArrow")).toBeUndefined();
      const host = await mount(renderCatalogDom(workspace.root, placed().id));
      const button = host.querySelector("button")!;
      if (type === "popover") await press(button);
      else await keyboardFocus(button);
      const overlay = document.querySelector(
        type === "popover" ? ".react-aria-Popover" : ".react-aria-Tooltip",
      )!;
      expect(overlay).not.toBeNull();
      expect(overlay.querySelector(".react-aria-OverlayArrow")).toBeNull();
      await unmount?.();
      unmount = undefined;
      document.body.innerHTML = "";
    }
  });

  it("the Canvas draws no arrow box (RAC places it from the trigger)", async () => {
    for (const type of ["popover", "tooltip"] as const) {
      const { part } = await place(type);
      expect(part("OverlayArrow")!.hidden).toBe(true);
    }
  });
});
