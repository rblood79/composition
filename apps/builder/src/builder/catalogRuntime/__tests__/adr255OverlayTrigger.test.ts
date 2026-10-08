import "fake-indexeddb/auto";
import { act } from "react";
import { createRoot } from "react-dom/client";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, describe, expect, it } from "vitest";
import { renderCatalogDom } from "../domBinding";
import { CatalogGraph } from "../../../../../../packages/shared/src/catalog/document/graph";
import { buildCodeCatalogLibrary } from "../../../../../../packages/shared/src/catalog/document/codeCatalogLibrary";
import type {
  EntryId,
  LibraryDefinitionId,
  NodeId,
} from "../../../../../../packages/shared/src/catalog/document/types";
import {
  insertNodes,
  setFields,
  setLibraryDefault,
} from "../../../../../../packages/shared/src/catalog/commands";
import { editContractFixture } from "./support/editContractFixture";
import type { CatalogConsumerNode } from "../compositionRoot";
import { newCatalogProjectDocument } from "../project";
import { CatalogStorage } from "../storage";
import { CatalogWorkspace } from "../workspace";
import { nodeLayoutEngine } from "./support/nodeLayoutEngine";

/**
 * ADR-255: the Popover origin is `DialogTrigger > Button + Popover` and the Tooltip origin
 * `TooltipTrigger > Button + Tooltip` (the reference's structure). Both consumers show the trigger
 * and not the closed overlay; the Preview opens it the RAC way — the Popover on the trigger's
 * press, the Tooltip on its focus — with the overlay's title and description.
 */
const BODY = "project:node:home-body" as NodeId;
const PLACED = "project:node:placed" as NodeId;
const set = <T>(value: T) => ({ kind: "set" as const, value });

async function place(type: "popover" | "tooltip") {
  const workspace = new CatalogWorkspace(
    new CatalogGraph(
      newCatalogProjectDocument({
        projectId: "project:project:adr255" as EntryId<"project">,
        name: "ADR-255",
      }),
      await buildCodeCatalogLibrary(),
    ),
    new CatalogStorage(indexedDB, `adr255-${Math.random()}`),
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
  const canvas = workspace.root.canvasInputs;
  const root = () =>
    [...canvas.values()].find((record) => record.sourceId === PLACED)!;
  const child = (record: CatalogConsumerNode, index: number) =>
    canvas.get(record.children[index]!)!;
  return { workspace, canvas, root, child };
}

let unmount: (() => Promise<void>) | undefined;
afterEach(async () => {
  await unmount?.();
  unmount = undefined;
  document.body.innerHTML = "";
});
/** Mounts the placed origin's DOM (the Preview's renderer) in the document. */
async function mount(workspace: CatalogWorkspace, id: string) {
  const host = document.createElement("div");
  document.body.append(host);
  const root = createRoot(host);
  await act(async () => root.render(renderCatalogDom(workspace.root, id)));
  unmount = async () => act(async () => root.unmount());
  return host;
}
const settle = () =>
  act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 30));
  });

describe("ADR-255 — Popover · Tooltip origins with their trigger", () => {
  it("Popover: DialogTrigger > Button + Popover; the Canvas draws the trigger only", async () => {
    const { root, child } = await place("popover");
    expect(root().bindingId).toBe("dialogtrigger");
    const [trigger, overlay] = [child(root(), 0), child(root(), 1)];
    expect(trigger.bindingId).toBe("button");
    expect(trigger.props.children).toBe("Open Popover");
    expect(overlay.bindingId).toBe("popover");
    expect(overlay.hidden).toBe(true);
    expect(
      overlay.children.map(
        (id) => child(overlay, overlay.children.indexOf(id)).bindingId,
      ),
    ).toEqual(["overlayarrow", "heading", "description"]);
  });

  it("Tooltip: TooltipTrigger > Button + Tooltip; the Canvas draws the trigger only", async () => {
    const { root, child } = await place("tooltip");
    expect(root().bindingId).toBe("tooltiptrigger");
    const [trigger, overlay] = [child(root(), 0), child(root(), 1)];
    expect(trigger.bindingId).toBe("button");
    expect(trigger.props.children).toBe("Hover me");
    expect(overlay.bindingId).toBe("tooltip");
    expect(overlay.hidden).toBe(true);
    expect(child(overlay, 0).bindingId).toBe("overlayarrow");
    expect(child(overlay, 1).bindingId).toBe("description");
  });

  it("the Preview shows the trigger and no closed overlay", async () => {
    for (const type of ["popover", "tooltip"] as const) {
      const { workspace, root } = await place(type);
      const html = renderToStaticMarkup(
        renderCatalogDom(workspace.root, root().id),
      );
      expect(html).toContain(type === "popover" ? "Open Popover" : "Hover me");
      expect(html).toMatch(
        type === "popover"
          ? /class="react-aria-DialogTrigger"/
          : /class="react-aria-TooltipTrigger"/,
      );
      expect(html).not.toContain("react-aria-Popover");
      expect(html).not.toContain('react-aria-Tooltip"');
    }
  });

  it("the Preview's Popover opens on the trigger's press, with its title and description", async () => {
    const { workspace, root } = await place("popover");
    const host = await mount(workspace, root().id);
    const button = host.querySelector("button")!;
    expect(button.getAttribute("aria-expanded")).toBe("false");
    await act(async () => {
      button.dispatchEvent(
        new PointerEvent("pointerdown", {
          bubbles: true,
          pointerId: 1,
          pointerType: "mouse",
        }),
      );
      button.dispatchEvent(
        new PointerEvent("pointerup", {
          bubbles: true,
          pointerId: 1,
          pointerType: "mouse",
        }),
      );
      button.click();
    });
    await settle();
    expect(button.getAttribute("aria-expanded")).toBe("true");
    const popover = document.querySelector(".react-aria-Popover")!;
    expect(popover).not.toBeNull();
    expect(popover.querySelector(".react-aria-Heading")?.textContent).toBe(
      "Popover Title",
    );
    expect(popover.textContent).toContain("Popover content goes here.");
  });

  it("the Preview's Tooltip opens on the trigger's keyboard focus, and follows the Description origin", async () => {
    const { workspace, root } = await place("tooltip");
    workspace.execute(
      setLibraryDefault({
        definitionId:
          "lib:definition:origin-component-description" as LibraryDefinitionId,
        scope: "visual",
        key: "color",
        write: set("#00aa00"),
        newId: workspace.newId,
      }),
    );
    const host = await mount(workspace, root().id);
    const button = host.querySelector("button")!;
    await act(async () => {
      // (RAC opens a tooltip on focus when the focus is a keyboard's.)
      document.dispatchEvent(
        new KeyboardEvent("keydown", { key: "Tab", bubbles: true }),
      );
      button.focus();
    });
    await settle();
    const tooltip = document.querySelector('[role="tooltip"]')!;
    expect(tooltip).not.toBeNull();
    expect(tooltip.textContent).toContain("Tooltip text");
    expect(button.getAttribute("aria-describedby")).toBe(tooltip.id);
    expect(
      (tooltip.querySelector('[slot="description"]') as HTMLElement).style
        .color,
    ).toBe("rgb(0, 170, 0)");
  });

  /**
   * The placed overlay edits its overlay's props from its own Properties: the origin takes them and
   * binds them to the overlay node (`{placement}` …), next to the trigger's — RAC's defaults when
   * the instance writes none.
   */
  it("the placed Popover · Tooltip edit their overlay's props", async () => {
    expect(
      editContractFixture("Popover").fields.map((field) => field.key),
    ).toEqual([
      "size",
      "placement",
      "offset",
      "crossOffset",
      "shouldFlip",
      "containerPadding",
      "isOpen",
      "defaultOpen",
    ]);
    expect(
      editContractFixture("Tooltip")
        .fields.filter(
          (field) => field.key === "variant" || field.key === "size",
        )
        .map((field) => [
          field.key,
          field.options?.map((option) => option.value),
        ]),
    ).toEqual([
      ["variant", ["neutral", "info", "positive", "negative"]],
      ["size", ["sm", "md", "lg"]],
    ]);
    for (const [type, placement] of [
      ["popover", "bottom"],
      ["tooltip", "top"],
    ] as const) {
      const { workspace, root, child } = await place(type);
      const overlay = () => child(root(), 1);
      expect(overlay().props.placement).toBe(placement);
      expect(overlay().props.offset).toBe(type === "popover" ? 8 : 0);
      workspace.execute(
        setFields({
          targets: [{ kind: "node", id: PLACED }],
          props: { placement: set("right"), size: set("lg") },
        }),
      );
      expect(overlay().props.placement).toBe("right");
      expect(overlay().props.size).toBe("lg");
    }
  });
});
