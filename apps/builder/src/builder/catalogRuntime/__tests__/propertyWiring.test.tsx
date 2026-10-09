// @vitest-environment jsdom
import "fake-indexeddb/auto";
import { act, type ElementType } from "react";
import { createRoot } from "react-dom/client";
import { describe, expect, it, vi } from "vitest";
import {
  insertNodes,
  setFields,
} from "../../../../../../packages/shared/src/catalog/commands";
import { CatalogGraph } from "../../../../../../packages/shared/src/catalog/document/graph";
import { buildCodeCatalogLibrary } from "../../../../../../packages/shared/src/catalog/document/codeCatalogLibrary";
import type {
  EntryId,
  NodeEntry,
  NodeId,
} from "../../../../../../packages/shared/src/catalog/document/types";
import { catalogStateValue } from "../../../../../../packages/shared/src/catalog/runtime/presence";
import { renderCatalogDom } from "../domBinding";
import { bindCatalogCanvas } from "../canvasBinding";
import { getSkiaNode } from "../../workspace/canvas/skia/useSkiaNode";
import { newCatalogProjectDocument } from "../project";
import { CatalogStorage } from "../storage";
import { CatalogWorkspace } from "../workspace";
import { nodeLayoutEngine } from "./support/nodeLayoutEngine";

/**
 * 2026-10-09 (사용자 「다른 프로퍼티도 레퍼런스와 맞지 않거나 레거시 옵션들이 남아 있는지 검증」 →
 * 「1번 결함 수리」): properties the reference has, that the Design panel edits, but that the
 * Preview never received — each now reaches its RAC / shared component (and a ButtonGroup's
 * `isDisabled` its Buttons on the Canvas too).
 */
const { captured, capture } = vi.hoisted(() => {
  const captured: Record<string, Record<string, unknown>> = {};
  const capture = async (name: string, load: () => Promise<unknown>) => {
    const { createElement, forwardRef } = await import("react");
    const module = (await load()) as Record<string, ElementType>;
    const Component = module[name]!;
    return {
      ...module,
      [name]: forwardRef<unknown, Record<string, unknown>>((props, ref) => {
        captured[name] = props;
        return createElement(Component, { ...props, ref });
      }),
    };
  };
  return { captured, capture };
});
vi.mock(
  "../../../../../../packages/shared/src/components/GridList",
  (original) => capture("GridList", original),
);
vi.mock(
  "../../../../../../packages/shared/src/components/FileUpload",
  (original) => capture("FileUpload", original),
);
vi.mock("react-aria-components/ColorField", (original) =>
  capture("ColorField", original),
);

const BODY = "project:node:home-body" as NodeId;
const ROOT = "project:node:root" as NodeId;
const set = <T,>(value: T) => ({ kind: "set" as const, value });

async function open(origin: string, props: Record<string, unknown>) {
  const library = await buildCodeCatalogLibrary();
  const workspace = new CatalogWorkspace(
    new CatalogGraph(
      newCatalogProjectDocument({
        projectId: "project:project:wiring" as EntryId<"project">,
        name: "Wiring",
      }),
      library,
    ),
    new CatalogStorage(indexedDB, `wiring-${Math.random()}`),
    {
      engine: await nodeLayoutEngine(),
      viewport: { width: 1200, height: 800 },
      autosaveSchedule: () => {},
    },
  );
  workspace.execute(
    insertNodes({
      parent: { kind: "node", id: BODY },
      entries: [
        {
          kind: "node",
          id: ROOT,
          definitionId: `lib:definition:${origin}`,
          children: [],
          props: Object.fromEntries(
            Object.entries(props).map(([key, value]) => [key, set(value)]),
          ),
          visual: {},
          sizing: {},
          descendantOverrides: [],
        } as NodeEntry,
      ],
      rootIds: [ROOT],
      newId: workspace.newId,
    }),
  );
  return workspace;
}

async function mount(workspace: CatalogWorkspace) {
  (
    globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }
  ).IS_REACT_ACT_ENVIRONMENT = true;
  (globalThis as { ResizeObserver?: unknown }).ResizeObserver ??= class {
    observe() {}
    unobserve() {}
    disconnect() {}
  };
  const root = workspace.root;
  const host = document.body.appendChild(document.createElement("div"));
  const reactRoot = createRoot(host);
  const id = [...root.domInputs.values()].find((r) => r.sourceId === ROOT)!.id;
  await act(async () => reactRoot.render(renderCatalogDom(root, id)));
  return {
    host,
    close: async () => {
      await act(async () => reactRoot.unmount());
      host.remove();
    },
  };
}

describe("properties the Preview did not receive", () => {
  it("FileTrigger: Accepted File Types limits the file input (RAC `acceptedFileTypes`)", async () => {
    const workspace = await open("origin-component-filetrigger", {
      acceptedFileTypes: "image/png, .pdf",
    });
    const dom = await mount(workspace);
    expect(
      dom.host.querySelector('input[type="file"]')?.getAttribute("accept"),
    ).toBe("image/png,.pdf");
    await dom.close();
  });

  it("FileUpload: Retry Delays reach the upload", async () => {
    const workspace = await open("origin-component-fileupload", {
      retryDelays: ["0", "500"],
    });
    const dom = await mount(workspace);
    expect(captured.FileUpload?.retryDelays).toEqual(["0", "500"]);
    await dom.close();
  });

  it("ColorField: Wheel Disabled reaches RAC ColorField", async () => {
    const workspace = await open("origin-component-colorfield", {
      isWheelDisabled: true,
    });
    const dom = await mount(workspace);
    expect(captured.ColorField?.isWheelDisabled).toBe(true);
    await dom.close();
  });

  it("GridList: Selection Style · Disallow Empty Selection reach the list", async () => {
    const workspace = await open("origin-component-gridlist", {
      selectionMode: "single",
      selectionStyle: "highlight",
      disallowEmptySelection: true,
    });
    const dom = await mount(workspace);
    expect(captured.GridList).toMatchObject({
      selectionStyle: "highlight",
      disallowEmptySelection: true,
    });
    await dom.close();
  });

  it("InlineAlert: the alert role (binding `staticAttrs`) reaches the DOM", async () => {
    const workspace = await open("origin-component-inline-alert", {});
    const dom = await mount(workspace);
    const alert = dom.host.querySelector(".react-aria-InlineAlert");
    expect(alert?.getAttribute("role")).toBe("alert");
    expect(alert?.getAttribute("aria-live")).toBe("polite");
    await dom.close();
  });
});

describe("ButtonGroup Disabled — its Buttons (S2: all the Buttons are disabled)", () => {
  it("Canvas and Preview disable every Button; turning it off enables them", async () => {
    const workspace = await open("origin-component-buttongroup", {
      isDisabled: true,
    });
    const root = workspace.root;
    const buttons = () =>
      [...root.canvasInputs.values()].filter(
        (record) => root.typeOf(record) === "Button",
      );
    const canvas = () =>
      buttons().map((button) =>
        catalogStateValue(
          button,
          "isDisabled",
          (id) => root.canvasInputs.get(id),
          (record) => root.typeOf(record),
        ),
      );
    expect(buttons().length).toBeGreaterThan(0);
    expect(canvas().every(Boolean)).toBe(true);
    // The Canvas dims them as the DOM's `[data-disabled]` does (the rule's disabled opacity).
    const dimmed = () => {
      const binding = bindCatalogCanvas(root, root.pageRootRecords());
      const out = buttons().map(
        (button) =>
          getSkiaNode(button.id)?.effects?.find(
            (effect) => effect.type === "opacity",
          )?.value,
      );
      binding.dispose();
      return out;
    };
    expect(dimmed().every((value) => typeof value === "number" && value < 1)).toBe(true);
    const dom = await mount(workspace);
    const disabled = () =>
      [...dom.host.querySelectorAll("button")].map((button) =>
        button.hasAttribute("disabled"),
      );
    expect(disabled().length).toBe(buttons().length);
    expect(disabled().every(Boolean)).toBe(true);
    await act(async () =>
      workspace.execute(
        setFields({
          targets: [
            workspace.positionOfRecord(
              [...root.canvasInputs.values()].find(
                (record) => root.typeOf(record) === "ButtonGroup",
              )!.id,
            )!.target,
          ],
          props: { isDisabled: set(false) },
        }),
      ),
    );
    expect(canvas().some(Boolean)).toBe(false);
    expect(disabled().some(Boolean)).toBe(false);
    expect(dimmed().every((value) => value === undefined)).toBe(true);
    await dom.close();
  });
});
