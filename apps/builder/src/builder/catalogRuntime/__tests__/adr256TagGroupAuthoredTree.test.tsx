// @vitest-environment jsdom
import "fake-indexeddb/auto";
import { act } from "react";
import { createRoot } from "react-dom/client";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import {
  detachInstances,
  insertNodes,
  moveNodes,
  removeTargets,
} from "../../../../../../packages/shared/src/catalog/commands";
import { CatalogGraph } from "../../../../../../packages/shared/src/catalog/document/graph";
import { buildCodeCatalogLibrary } from "../../../../../../packages/shared/src/catalog/document/codeCatalogLibrary";
import type {
  EntryId,
  NodeEntry,
  NodeId,
} from "../../../../../../packages/shared/src/catalog/document/types";
import type { CatalogTextMeasure } from "../compositionRoot";
import { renderCatalogDom } from "../domBinding";
import { newCatalogProjectDocument } from "../project";
import { CatalogStorage } from "../storage";
import { CatalogWorkspace } from "../workspace";
import { nodeLayoutEngine } from "./support/nodeLayoutEngine";

/**
 * Codex Round 20 H1 · M1: a TagGroup is drawn from its node tree, as the reference composes it
 * (`TagGroup > Label + TagList > Tag… + Text[description] + Text[errorMessage]` and free content in
 * the author's order): a deleted Label stays deleted, a moved Label moves, a free Text renders, and
 * the TagGroup's selection is RAC's (a Preview press selects a Tag).
 */
const BODY = "project:node:home-body" as NodeId;
const GROUP = "project:node:tags" as NodeId;
const set = <T,>(value: T) => ({ kind: "set" as const, value });
const measure: CatalogTextMeasure = (text, font) => ({
  width: text.length * font.fontSize * 0.5,
  exactWidth: text.length * font.fontSize * 0.5,
  minWidth: text.length * font.fontSize * 0.5,
  height: font.fontSize * (font.lineHeight || 1.2),
});

async function open(props: Record<string, string | boolean> = {}) {
  const library = await buildCodeCatalogLibrary();
  const workspace = new CatalogWorkspace(
    new CatalogGraph(
      newCatalogProjectDocument({
        projectId: "project:project:tag-tree" as EntryId<"project">,
        name: "Tags",
      }),
      library,
    ),
    new CatalogStorage(indexedDB, `tag-tree-${Math.random()}`),
    {
      engine: await nodeLayoutEngine(),
      viewport: { width: 1200, height: 800 },
      autosaveSchedule: () => {},
      textMeasure: measure,
    },
  );
  workspace.execute(
    insertNodes({
      parent: { kind: "node", id: BODY },
      entries: [
        {
          kind: "node",
          id: GROUP,
          definitionId: "lib:definition:origin-component-taggroup",
          children: [],
          props: Object.fromEntries(
            Object.entries(props).map(([key, value]) => [key, set(value)]),
          ),
          visual: {},
          sizing: {},
          descendantOverrides: [],
        } as NodeEntry,
      ],
      rootIds: [GROUP],
      newId: workspace.newId,
    }),
  );
  const root = workspace.root;
  const of = (type: string) =>
    [...root.canvasInputs.values()].filter((r) => root.typeOf(r) === type);
  const target = (id: string) => workspace.positionOfRecord(id)!.target;
  const groupId = () =>
    [...root.domInputs.values()].find((r) => r.sourceId === GROUP)!.id;
  const dom = () => {
    const host = document.createElement("div");
    host.innerHTML = renderToStaticMarkup(renderCatalogDom(root, groupId()));
    // (The maxRows measuring mirror is not the list.)
    host.querySelectorAll("[inert]").forEach((mirror) => mirror.remove());
    return host;
  };
  return { workspace, root, of, target, dom, groupId };
}

describe("Codex Round 20 H1 — a TagGroup drawn from its node tree", () => {
  it("a free Text inside the TagGroup is accepted and rendered after the list", async () => {
    const { workspace, of, target, dom } = await open();
    const text = {
      kind: "node",
      id: workspace.newId("node"),
      definitionId: "lib:definition:text",
      children: [],
      props: { children: set("Extra") },
      visual: {},
      sizing: {},
      descendantOverrides: [],
    } as NodeEntry;
    workspace.execute(
      insertNodes({
        parent: target(of("TagGroup")[0]!.id),
        entries: [text],
        rootIds: [text.id],
        newId: workspace.newId,
      }),
    );
    const group = dom().querySelector(".react-aria-TagGroup")!;
    const texts = [...group.children].map((child) => child.textContent);
    expect(texts.at(-1)).toBe("Extra");
  });

  it("a deleted Label is not drawn again from the label prop (the group keeps a name)", async () => {
    const { workspace, of, target, dom } = await open({ label: "Tags" });
    expect(dom().querySelector(".react-aria-Label")?.textContent).toBe("Tags");
    workspace.execute(removeTargets({ targets: [target(of("Label")[0]!.id)] }));
    const host = dom();
    expect(of("Label")).toHaveLength(0);
    expect(host.querySelector(".react-aria-Label")).toBeNull();
    expect(
      host.querySelector('[role="grid"]')?.getAttribute("aria-label"),
    ).toBe("Tags");
  });

  it("a Label moved after the TagList is drawn after it", async () => {
    const { workspace, root, of, target, dom } = await open({ label: "Tags" });
    workspace.execute(
      detachInstances({ ids: [GROUP], newId: workspace.newId }),
    );
    const label = target(of("Label")[0]!.id) as { id: NodeId };
    workspace.execute(
      moveNodes({
        ids: [label.id],
        parent: { kind: "node", id: GROUP },
        newId: workspace.newId,
      }),
    );
    const order = of("TagGroup")[0]!.children.map((id) =>
      root.typeOf(root.canvasInputs.get(id)!),
    );
    expect(order.at(-1)).toBe("Label");
    const group = dom().querySelector(".react-aria-TagGroup")!;
    const list = group.querySelector(".tag-list-wrapper")!;
    const labelElement = group.querySelector(".react-aria-Label")!;
    expect(
      list.compareDocumentPosition(labelElement) &
        Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
  });

  it("the TagList node's element is the chip wrapper (its marker)", async () => {
    const { of, dom } = await open();
    const list = of("TagList")[0]!;
    expect(
      dom()
        .querySelector(`[data-catalog-id="${list.id}"]`)
        ?.classList.contains("tag-list-wrapper"),
    ).toBe(true);
  });
});

describe("Codex Round 20 M1 — a TagGroup's selection is RAC's", () => {
  it("single: a press selects the Tag", async () => {
    const { root, groupId } = await open({ selectionMode: "single" });
    (
      globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }
    ).IS_REACT_ACT_ENVIRONMENT = true;
    (globalThis as { ResizeObserver?: unknown }).ResizeObserver ??= class {
      observe() {}
      unobserve() {}
      disconnect() {}
    };
    const host = document.body.appendChild(document.createElement("div"));
    const reactRoot = createRoot(host);
    await act(async () => reactRoot.render(renderCatalogDom(root, groupId())));
    const tag = host.querySelector<HTMLElement>('[role="row"]')!;
    await act(async () => tag.click());
    expect(tag.getAttribute("aria-selected")).toBe("true");
    await act(async () => reactRoot.unmount());
    host.remove();
  });
});

/**
 * maxRows: RAC builds the TagGroup's collection from a hidden `<template>` copy of its children —
 * the TagList's collapse state is the TagGroup's (one for both copies), so the collection holds only
 * the tags the visible list's mirror counted in its rows (the copy has no layout and does not measure).
 */
describe("Codex Round 20 H1 — maxRows collapses the list", () => {
  it("two rows of the four tags: two tags and Show all; Show all shows four", async () => {
    const { root, groupId } = await open();
    (
      globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }
    ).IS_REACT_ACT_ENVIRONMENT = true;
    const originalObserver = (globalThis as { ResizeObserver?: unknown })
      .ResizeObserver;
    // (A browser's ResizeObserver reports each observed box once.)
    (globalThis as { ResizeObserver?: unknown }).ResizeObserver = class {
      constructor(private callback: () => void) {}
      observe() {
        setTimeout(() => this.callback(), 0);
      }
      unobserve() {}
      disconnect() {}
    };
    const originalRect = Element.prototype.getBoundingClientRect;
    // The mirror's chips: one per row (a narrow list). Inside RAC's `<template>` copy nothing has
    // layout (every box at 0).
    Element.prototype.getBoundingClientRect = function (this: Element) {
      const mirror =
        this.parentElement?.hasAttribute("inert") && !this.closest("template");
      const index = mirror
        ? [...this.parentElement!.children].indexOf(this)
        : 0;
      return {
        x: 0,
        y: index * 30,
        width: 0,
        height: 0,
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        toJSON() {},
      } as DOMRect;
    };
    const host = document.body.appendChild(document.createElement("div"));
    const reactRoot = createRoot(host);
    try {
      await act(async () =>
        reactRoot.render(renderCatalogDom(root, groupId())),
      );
      await act(async () => {
        await new Promise((resolve) => setTimeout(resolve, 20));
      });
      const chips = () => host.querySelectorAll('[role="row"]').length;
      const button = () =>
        host.querySelector<HTMLButtonElement>(".tag-show-all-btn");
      expect([chips(), button()?.textContent]).toEqual([2, "Show all (4)"]);
      await act(async () => button()!.click());
      expect([chips(), button()?.textContent]).toEqual([4, "Show less"]);
      await act(async () => reactRoot.unmount());
    } finally {
      Element.prototype.getBoundingClientRect = originalRect;
      (globalThis as { ResizeObserver?: unknown }).ResizeObserver =
        originalObserver;
      host.remove();
    }
  });
});
