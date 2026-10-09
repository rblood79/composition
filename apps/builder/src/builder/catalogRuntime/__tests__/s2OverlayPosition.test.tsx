import "fake-indexeddb/auto";
import { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, describe, expect, it, vi } from "vitest";
import { CatalogGraph } from "../../../../../../packages/shared/src/catalog/document/graph";
import { buildCodeCatalogLibrary } from "../../../../../../packages/shared/src/catalog/document/codeCatalogLibrary";
import { insertNodes } from "../../../../../../packages/shared/src/catalog/commands";
import type {
  EntryId,
  LibraryDefinitionId,
  NodeEntry,
  NodeId,
} from "../../../../../../packages/shared/src/catalog/document/types";
import { getPrimitiveBinding } from "../../../../../../packages/shared/src/catalog/bindings";
import { renderCatalogDom } from "../domBinding";
import { newCatalogProjectDocument } from "../project";
import { CatalogStorage } from "../storage";
import { CatalogWorkspace } from "../workspace";
import { nodeLayoutEngine } from "./support/nodeLayoutEngine";

/**
 * S2 1.8.0 Picker · ComboBox · MenuTrigger: `direction` + `align` say where the menu opens (S2
 * `placement={`${direction} ${align}`}` — a MenuTrigger's sideways direction takes top for start,
 * bottom for end) and Picker · ComboBox `menuWidth` its width. Ours: the props of the Select ·
 * ComboBox · MenuTrigger node, read by its Popover node in the Preview (the Canvas draws no closed
 * menu).
 */
const BODY = "project:node:home-body" as NodeId;
const OWNER = "project:node:owner" as NodeId;
const set = <T,>(value: T) => ({ kind: "set" as const, value });
const ORIGINS = {
  Select: "select",
  ComboBox: "combobox",
  MenuTrigger: "menu",
} as const;
type Owner = keyof typeof ORIGINS;

/** A trigger at (400, 400), 50 × 30, a 200 × 120 menu, in a 1000 × 800 window. */
function layout(triggerSelector: string) {
  const rect = (x: number, y: number, width: number, height: number) =>
    ({
      x,
      y,
      left: x,
      top: y,
      width,
      height,
      right: x + width,
      bottom: y + height,
      toJSON: () => ({}),
    }) as DOMRect;
  const spies = [
    vi
      .spyOn(Element.prototype, "getBoundingClientRect")
      .mockImplementation(function (this: Element) {
        if (this.matches(triggerSelector)) return rect(400, 400, 50, 30);
        if (this.classList.contains("react-aria-Popover"))
          return rect(0, 0, 200, 120);
        return rect(0, 0, 1000, 800);
      }),
    // (RAC reads an element's size from `offsetWidth` · `offsetHeight` — transforms aside.)
    ...(["offsetWidth", "offsetHeight"] as const).map((key) =>
      vi
        .spyOn(HTMLElement.prototype, key, "get")
        .mockImplementation(function (this: HTMLElement) {
          const box = this.getBoundingClientRect();
          return key === "offsetWidth" ? box.width : box.height;
        }),
    ),
    ...["clientWidth", "clientHeight"].map((key) =>
      vi
        .spyOn(document.documentElement, key as "clientWidth", "get")
        .mockReturnValue(key === "clientWidth" ? 1000 : 800),
    ),
  ];
  return () => spies.forEach((spy) => spy.mockRestore());
}

async function openMenu(owner: Owner, props: Record<string, unknown> = {}) {
  const library = await buildCodeCatalogLibrary();
  const workspace = new CatalogWorkspace(
    new CatalogGraph(
      newCatalogProjectDocument({
        projectId: "project:project:s2-overlay" as EntryId<"project">,
        name: "S2 overlay position",
      }),
      library,
    ),
    new CatalogStorage(indexedDB, `s2-overlay-${Math.random()}`),
    {
      engine: await nodeLayoutEngine(),
      viewport: { width: 1200, height: 800 },
      autosaveSchedule: () => {},
    },
  );
  const node: NodeEntry = {
    kind: "node",
    id: OWNER,
    definitionId:
      `lib:definition:origin-component-${ORIGINS[owner]}` as LibraryDefinitionId,
    children: [],
    props: Object.fromEntries(
      Object.entries(props).map(([key, value]) => [key, set(value)]),
    ) as NodeEntry["props"],
    visual: {},
    sizing: {},
    descendantOverrides: [],
  };
  workspace.execute(
    insertNodes({
      parent: { kind: "node", id: BODY },
      entries: [node],
      rootIds: [OWNER],
      newId: workspace.newId,
    }),
  );
  (
    globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }
  ).IS_REACT_ACT_ENVIRONMENT = true;
  (globalThis as { ResizeObserver?: unknown }).ResizeObserver ??= class {
    observe() {}
    unobserve() {}
    disconnect() {}
  };
  const restore = layout(
    owner === "ComboBox" ? ".react-aria-Group" : ".react-aria-Button",
  );
  const host = document.body.appendChild(document.createElement("div"));
  const reactRoot = createRoot(host);
  const id = workspace.root.recordsOfSource(OWNER)[0]!;
  await act(async () => {
    reactRoot.render(renderCatalogDom(workspace.root, id));
  });
  await act(async () => host.querySelector("button")!.click());
  const popover = document.body.querySelector<HTMLElement>(
    ".react-aria-Popover",
  )!;
  cleanup = async () => {
    await act(async () => reactRoot.unmount());
    host.remove();
    restore();
  };
  return popover;
}

let cleanup: (() => Promise<void>) | undefined;
afterEach(async () => {
  await cleanup?.();
  cleanup = undefined;
});

const OWNERS: readonly Owner[] = ["Select", "ComboBox", "MenuTrigger"];

describe("S2 menu direction · align", () => {
  it.each(OWNERS)(
    "%s: the Design panel offers Direction and Align (defaults bottom · start)",
    (owner) => {
      const accepts = getPrimitiveBinding(owner)!.props.accepts;
      expect(accepts.direction?.default).toBe("bottom");
      expect(accepts.align?.default).toBe("start");
      expect(accepts.align?.options?.map((option) => option.value)).toEqual([
        "start",
        "end",
      ]);
      expect(accepts.direction?.options?.map((option) => option.value)).toEqual(
        owner === "MenuTrigger"
          ? ["bottom", "top", "left", "right", "start", "end"]
          : ["bottom", "top"],
      );
    },
  );

  it.each(OWNERS)(
    "%s: by default the menu opens below the trigger, at its start edge",
    async (owner) => {
      const popover = await openMenu(owner);
      expect(popover.getAttribute("data-placement")).toBe("bottom");
      expect(popover.style.left).toBe("400px");
    },
  );

  it.each(OWNERS)(
    "%s: direction top · align end — above the trigger, at its end edge",
    async (owner) => {
      const popover = await openMenu(owner, { direction: "top", align: "end" });
      expect(popover.getAttribute("data-placement")).toBe("top");
      // (the menu's right edge at the trigger's: 450 − 200)
      expect(popover.style.left).toBe("250px");
    },
  );

  it("MenuTrigger: a sideways direction takes top for start, bottom for end", async () => {
    const start = await openMenu("MenuTrigger", { direction: "end" });
    expect(start.getAttribute("data-placement")).toBe("right");
    // (the menu's top at the trigger's)
    expect(start.style.top).toBe("400px");
    await cleanup?.();
    const end = await openMenu("MenuTrigger", {
      direction: "left",
      align: "end",
    });
    expect(end.getAttribute("data-placement")).toBe("left");
    // (the menu's bottom at the trigger's: 430 − 120)
    expect(end.style.top).toBe("310px");
  });
});

describe("S2 menuWidth", () => {
  it.each(["Select", "ComboBox"] as const)(
    "%s: the Design panel offers Menu Width (unset — the trigger's width)",
    (owner) => {
      const accepts = getPrimitiveBinding(owner)!.props.accepts;
      expect(accepts.menuWidth?.kind).toBe("number");
      expect(accepts.menuWidth?.default).toBeUndefined();
    },
  );

  it("Select: the menu is menuWidth wide (its minimum stays the trigger's width)", async () => {
    const popover = await openMenu("Select", { menuWidth: 320 });
    expect(popover.style.width).toBe("320px");
    // (the Popover sheet's size cap — 250 at M — gives way: S2's stops only at the window)
    expect(popover.style.maxWidth).toBe("none");
    expect(popover.style.getPropertyValue("--trigger-width")).toBe("50px");
  });

  it("Select: a quiet Select keeps the trigger's width (S2)", async () => {
    const popover = await openMenu("Select", { menuWidth: 320, isQuiet: true });
    expect(popover.style.width).toBe("");
  });

  it("ComboBox: menuWidth is the menu's trigger width (its width and minimum)", async () => {
    const popover = await openMenu("ComboBox", { menuWidth: 320 });
    expect(popover.style.getPropertyValue("--trigger-width")).toBe("320px");
  });

  it.each(["Select", "ComboBox"] as const)(
    "%s: unset — the menu takes the trigger's width",
    async (owner) => {
      const popover = await openMenu(owner);
      expect(popover.style.width).toBe("");
      expect(popover.style.getPropertyValue("--trigger-width")).toBe("50px");
    },
  );
});
