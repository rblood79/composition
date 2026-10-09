// @vitest-environment jsdom
import "fake-indexeddb/auto";
import { act } from "react";
import { createRoot } from "react-dom/client";
import { describe, expect, it } from "vitest";
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
import { newCatalogProjectDocument } from "../project";
import { CatalogStorage } from "../storage";
import { CatalogWorkspace } from "../workspace";
import { nodeLayoutEngine } from "./support/nodeLayoutEngine";

/**
 * 2026-10-09 (사용자 「tags 레퍼런스 확인해봐 Variant 옵션이 별도로 존재하지는 않는듯」 → 「선택으로
 * 대체」): RAC · S2 Tag has no `variant` — a selected Tag is its TagGroup's selection
 * (`defaultSelectedKeys`). The Tag carries the selection axis every item has (`isSelected` — the
 * Design panel's Selected), the TagGroup hands RAC the keys of its selected Tags, and the Canvas
 * paints a Tag selected exactly when RAC does (its group selects: `selectionMode` not `none`).
 */
const BODY = "project:node:home-body" as NodeId;
const GROUP = "project:node:tags" as NodeId;
const set = <T,>(value: T) => ({ kind: "set" as const, value });

async function open(groupProps: Record<string, string> = {}) {
  const library = await buildCodeCatalogLibrary();
  const workspace = new CatalogWorkspace(
    new CatalogGraph(
      newCatalogProjectDocument({
        projectId: "project:project:tag-selection" as EntryId<"project">,
        name: "Tag selection",
      }),
      library,
    ),
    new CatalogStorage(indexedDB, `tag-selection-${Math.random()}`),
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
          id: GROUP,
          definitionId: "lib:definition:origin-component-taggroup",
          children: [],
          props: Object.fromEntries(
            Object.entries(groupProps).map(([key, value]) => [key, set(value)]),
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
  const select = (index: number, value: boolean) =>
    workspace.execute(
      setFields({
        targets: [target(of("Tag")[index]!.id)],
        props: { isSelected: set(value) },
      }),
    );
  const canvasSelected = () =>
    of("Tag").map((tag) =>
      catalogStateValue(
        tag,
        "isSelected",
        (id) => root.canvasInputs.get(id),
        (record) => root.typeOf(record),
      ),
    );
  return { workspace, root, of, target, select, canvasSelected };
}

async function mount(root: Awaited<ReturnType<typeof open>>["root"]) {
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
  const groupId = [...root.domInputs.values()].find(
    (r) => r.sourceId === GROUP,
  )!.id;
  const render = () =>
    act(async () => reactRoot.render(renderCatalogDom(root, groupId)));
  await render();
  const domSelected = () =>
    [...host.querySelectorAll('[role="row"]')].map(
      (row) => row.getAttribute("aria-selected") === "true",
    );
  const close = async () => {
    await act(async () => reactRoot.unmount());
    host.remove();
  };
  return { render, domSelected, close };
}

describe("Tag selection — the TagGroup's (no Tag variant)", () => {
  it("a Tag takes Selected (isSelected), not a variant", async () => {
    const { workspace, of, target, select } = await open();
    let code: string | undefined;
    try {
      workspace.execute(
        setFields({
          targets: [target(of("Tag")[0]!.id)],
          props: { variant: set("selected") },
        }),
      );
    } catch (error) {
      code = (error as { code?: string }).code;
    }
    expect(code).toBe("PROP_NOT_ACCEPTED");
    expect(() => select(0, true)).not.toThrow();
  });

  it("selected Tags are the group's selection: Canvas = Preview (multiple)", async () => {
    const { root, select, canvasSelected } = await open({
      selectionMode: "multiple",
    });
    select(0, true);
    select(2, true);
    expect(canvasSelected()).toEqual([true, false, true, false]);
    const dom = await mount(root);
    expect(dom.domSelected()).toEqual([true, false, true, false]);
    await dom.close();
  });

  it("a group that does not select shows no selected Tag (RAC), on the Canvas too", async () => {
    const { root, select, canvasSelected } = await open({
      selectionMode: "none",
    });
    select(0, true);
    expect(canvasSelected()).toEqual([false, false, false, false]);
    const dom = await mount(root);
    expect(dom.domSelected()).toEqual([false, false, false, false]);
    await dom.close();
  });

  it("an open Preview follows a Tag's Selected and the group's selection mode", async () => {
    const { workspace, root, of, target, select, canvasSelected } = await open({
      selectionMode: "multiple",
    });
    const dom = await mount(root);
    expect(dom.domSelected()).toEqual([false, false, false, false]);
    // (No re-render: the mounted DOM follows the step through its subscriptions.)
    await act(async () => select(1, true));
    expect(dom.domSelected()).toEqual([false, true, false, false]);
    await act(async () =>
      workspace.execute(
        setFields({
          targets: [target(of("TagGroup")[0]!.id)],
          props: { selectionMode: set("none") },
        }),
      ),
    );
    expect(canvasSelected()).toEqual([false, false, false, false]);
    expect(dom.domSelected()).toEqual([false, false, false, false]);
    await dom.close();
  });
});

describe("Tag selection — a Tag's label and remove X follow the Preview's selection", () => {
  it("their colour is the Tag's (sheet `color: inherit`), not the authored selection inline", async () => {
    const { workspace, root, of, target, select } = await open({
      selectionMode: "multiple",
    });
    workspace.execute(
      setFields({
        targets: [target(of("TagGroup")[0]!.id)],
        props: { allowsRemoving: set(true) },
      }),
    );
    select(0, true);
    const dom = await mount(root);
    const inline = () =>
      [...document.querySelectorAll('[role="row"]')].map((row) => ({
        label: (row.querySelector(".react-aria-Text") as HTMLElement | null)
          ?.style.color,
        glyph: (
          row.querySelector(
            '[slot="remove"] .react-aria-Icon',
          ) as HTMLElement | null
        )?.style.color,
      }));
    // (The Canvas still paints them the item's colour — the derived value stays.)
    const label = of("Text").find(
      (text) => root.typeOf(root.canvasInputs.get(text.parentId)!) === "Tag",
    )!;
    expect(label.derivedProps?.color).toBeDefined();
    for (const row of inline()) expect(row).toEqual({ label: "", glyph: "" });
    await dom.close();
  });
});

describe("TagGroup — an open Preview shows a Tag added with '+'", () => {
  it.each(["TagGroup", "TagList"])(
    "the %s '+': the new Tag renders in the mounted Preview",
    async (host) => {
      const { workspace, root, of } = await open({ selectionMode: "none" });
      const dom = await mount(root);
      const { catalogItemInsertChoices } = await import("../itemInsert");
      const choice = catalogItemInsertChoices(
        {
          graph: workspace.runtime.graph,
          readModel: workspace.readModel,
          newId: workspace.newId,
        },
        workspace.positionOfRecord(of(host)[0]!.id)!,
      ).find((item) => item.type === "Tag")!;
      await act(async () => workspace.execute(choice.build()));
      expect(of("Tag")).toHaveLength(5);
      expect(dom.domSelected()).toHaveLength(5);
      await dom.close();
    },
  );
});
