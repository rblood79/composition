// @vitest-environment jsdom
import "fake-indexeddb/auto";
import { act, fireEvent } from "@testing-library/react";
import { createRoot } from "react-dom/client";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  detachInstances,
  groupNodes,
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
import { renderCatalogDom } from "../domBinding";
import { newCatalogProjectDocument } from "../project";
import { CatalogStorage } from "../storage";
import { CatalogWorkspace } from "../workspace";
import { nodeLayoutEngine } from "./support/nodeLayoutEngine";

/**
 * ADR-256 Phase 6 판독 (Round 14) — picker 노드 트리의 편집 4건:
 * m1 frame 안 달력이 picker 의 RAC 달력 context 를 잃음 · m2 field 의 control Group 이 RAC
 * 상태 frame · 작성 role 을 넘기지 않음 · m3 frame 안 닫힌 Popover 가 Canvas 에 보임 ·
 * m4 picker 안 Popover 의 작성 placement 를 지움.
 */
const BODY = "project:node:home-body" as NodeId;
const FIELD = "project:node:field" as NodeId;
const set = <T,>(value: T) => ({ kind: "set" as const, value });
const node = (
  id: string,
  definitionId: string,
  extra: Partial<NodeEntry> = {},
): NodeEntry =>
  ({
    kind: "node",
    id,
    definitionId,
    children: [],
    props: {},
    visual: {},
    sizing: {},
    descendantOverrides: [],
    ...extra,
  }) as NodeEntry;

const cleanups: Array<() => Promise<void> | void> = [];
afterEach(async () => {
  for (const cleanup of cleanups.splice(0).reverse()) await cleanup();
});

/** A palette picker on the page, detached (its parts are the author's own nodes). */
async function open(type: string) {
  const library = await buildCodeCatalogLibrary();
  const workspace = new CatalogWorkspace(
    new CatalogGraph(
      newCatalogProjectDocument({
        projectId: "project:project:adr256-p6-review" as EntryId<"project">,
        name: "Phase 6 review",
      }),
      library,
    ),
    new CatalogStorage(indexedDB, `adr256-p6-review-${Math.random()}`),
    {
      engine: await nodeLayoutEngine(),
      viewport: { width: 1200, height: 800 },
      autosaveSchedule: () => {},
    },
  );
  workspace.execute(
    insertNodes({
      parent: { kind: "node", id: BODY },
      entries: [node(FIELD, `lib:definition:origin-component-${type}`)],
      rootIds: [FIELD],
      newId: workspace.newId,
    }),
  );
  workspace.execute(detachInstances({ ids: [FIELD], newId: workspace.newId }));
  const root = workspace.root;
  const ofType = (name: string) =>
    [...root.domInputs.values()].find(
      (record) => root.typeOf(record) === name,
    )!;
  const field = () =>
    [...root.domInputs.values()].find((record) => record.sourceId === FIELD)!;
  const sourceOf = (name: string) => ofType(name).sourceId as NodeId;
  const edit = (target: NodeId, props: Record<string, unknown>) =>
    workspace.execute(
      setFields({
        targets: [{ kind: "node", id: target }],
        props: Object.fromEntries(
          Object.entries(props).map(([key, value]) => [key, set(value)]),
        ) as never,
      }),
    );
  /** The part in a new layout frame (Group selection — the frame takes its place). */
  const frame = (name: string) =>
    workspace.execute(
      groupNodes({
        ids: [sourceOf(name)],
        group: node(
          workspace.newId("node") as string,
          "lib:definition:type-frame",
        ),
        newId: workspace.newId,
      }),
    );
  const mount = async () => {
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
    await act(async () => {
      reactRoot.render(renderCatalogDom(root, field().id));
    });
    cleanups.push(async () => {
      await act(async () => reactRoot.unmount());
      host.remove();
    });
    return host;
  };
  return { workspace, root, ofType, sourceOf, edit, frame, mount };
}

const popover = () =>
  document.body.querySelector<HTMLElement>(".react-aria-Popover");

describe("ADR-256 Phase 6 판독 — picker 노드 트리 편집", () => {
  it("m1: a Calendar in a frame inside the picker's Popover keeps the picker's calendar context (size · visible months)", async () => {
    const picker = await open("datepicker");
    picker.frame("Calendar");
    picker.edit(FIELD, { size: "lg", maxVisibleMonths: 2 });
    const host = await picker.mount();
    await act(async () =>
      host.querySelector<HTMLElement>(".react-aria-Group button")!.click(),
    );
    const calendar = popover()!.querySelector(".react-aria-Calendar")!;
    expect(calendar.querySelectorAll("table")).toHaveLength(2);
    expect(calendar.getAttribute("data-size")).toBe("lg");
  });

  it("m2: a field's control Group passes RAC's state to its `showWhen` nodes and the author's role", async () => {
    const field = await open("numberfield");
    const group = field.sourceOf("Group");
    const mark = field.workspace.newId("node") as NodeId;
    field.workspace.execute(
      insertNodes({
        parent: { kind: "node", id: group },
        entries: [
          node(mark, "lib:definition:text", {
            props: { children: set("focus") },
            showWhen: { all: ["isFocusVisible"] },
          } as Partial<NodeEntry>),
        ],
        rootIds: [mark],
        newId: field.workspace.newId,
      }),
    );
    field.edit(group, { role: "presentation" });
    const host = await field.mount();
    const box = host.querySelector<HTMLElement>(".react-aria-Group")!;
    expect(box.getAttribute("role")).toBe("presentation");
    expect(host.textContent).not.toContain("focus");
    await act(async () => {
      fireEvent.keyDown(document.body, { key: "Tab" });
      host.querySelector<HTMLInputElement>("input")!.focus();
    });
    expect(box.hasAttribute("data-focus-visible")).toBe(true);
    expect(host.textContent).toContain("focus");
  });

  it.each(["select", "combobox"])(
    "m3: %s — its closed Popover in a frame is not drawn on the Canvas (as in the Preview)",
    async (type) => {
      const picker = await open(type);
      picker.frame("Popover");
      const record = [...picker.root.canvasInputs.values()].find(
        (entry) => picker.root.typeOf(entry) === "Popover",
      )!;
      expect(
        picker.root.typeOf(picker.root.canvasInputs.get(record.parentId)!),
      ).toBe("frame");
      expect(record.hidden).toBe(true);
    },
  );

  it.each(["select", "combobox", "datepicker", "daterangepicker"])(
    "m4: %s — the author's Popover placement wins over the picker's place",
    async (type) => {
      // (A trigger low on the page: room above for `top`.)
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
      const rects = vi
        .spyOn(Element.prototype, "getBoundingClientRect")
        .mockImplementation(function (this: Element) {
          if (this.classList.contains("react-aria-Popover"))
            return rect(0, 0, 200, 100);
          if (this.closest(".react-aria-Popover") || this === document.body)
            return rect(0, 0, 1000, 800);
          return rect(100, 500, 200, 30);
        });
      const sizes = ["clientWidth", "clientHeight"].map((key) =>
        vi
          .spyOn(document.documentElement, key as "clientWidth", "get")
          .mockReturnValue(key === "clientWidth" ? 1000 : 800),
      );
      cleanups.push(() => {
        rects.mockRestore();
        for (const size of sizes) size.mockRestore();
      });
      const picker = await open(type);
      picker.edit(picker.sourceOf("Popover"), {
        placement: "top",
        shouldFlip: false,
      });
      const host = await picker.mount();
      await act(async () =>
        host
          .querySelector<HTMLElement>(
            type === "select" ? "button" : ".react-aria-Group button",
          )!
          .click(),
      );
      expect(popover()?.getAttribute("data-placement")).toBe("top");
    },
  );
});
