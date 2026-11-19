// @vitest-environment jsdom
/**
 * (2026-11-14, 사용자 「S2 대응 없음 컴포넌트를 S2 패턴으로」) S2 · RAC have no Pagination — its nearest S2
 * assembly: quiet ActionButtons. 2026-11-19 (사용자 「3번까지 진행」 — shadcn aria Pagination): page navigation,
 * not a choice — the numbers are ActionButtons in an ActionButtonGroup (no radio group), the shown page
 * `aria-current="page"` and not quiet; Previous · Next carry a chevron and the word; the first · last page
 * buttons and the gaps (an ellipsis Icon) show around the page window. The Pagination's size is its buttons'.
 */
import "fake-indexeddb/auto";
import { act } from "react";
import { createRoot } from "react-dom/client";
import { describe, expect, it } from "vitest";
import {
  insertNodes,
  setFields,
} from "../../../../../../packages/shared/src/catalog/commands";
import { buildCodeCatalogLibrary } from "../../../../../../packages/shared/src/catalog/document/codeCatalogLibrary";
import { CatalogGraph } from "../../../../../../packages/shared/src/catalog/document/graph";
import type {
  NodeEntry,
  NodeId,
} from "../../../../../../packages/shared/src/catalog/document/types";
import { renderCatalogDom } from "../domBinding";
import { newCatalogProjectDocument } from "../project";
import { CatalogStorage } from "../storage";
import { CatalogWorkspace } from "../workspace";
import { nodeLayoutEngine } from "./support/nodeLayoutEngine";

const OWNER = "project:node:pagination" as NodeId;

async function open() {
  const library = await buildCodeCatalogLibrary();
  const workspace = new CatalogWorkspace(
    new CatalogGraph(
      newCatalogProjectDocument({
        projectId: "project:project:pagination",
        name: "Pagination",
      }),
      library,
    ),
    new CatalogStorage(indexedDB, `pagination-${Math.random()}`),
    {
      engine: await nodeLayoutEngine(),
      viewport: { width: 1000, height: 800 },
      autosaveSchedule: () => {},
      textMeasure: (text, font) => ({
        width: (text.length * font.fontSize) / 2,
        minWidth: (text.length * font.fontSize) / 2,
        height: font.fontSize * font.lineHeight,
      }),
    },
  );
  workspace.execute(
    insertNodes({
      parent: { kind: "node", id: "project:node:home-body" as NodeId },
      entries: [
        {
          kind: "node",
          id: OWNER,
          definitionId: "lib:definition:origin-component-pagination",
          children: [],
          props: {},
          visual: {},
          sizing: {},
          descendantOverrides: [],
        } as NodeEntry,
      ],
      rootIds: [OWNER],
      newId: workspace.newId,
    }),
  );
  const root = workspace.root;
  const of = (type: string) =>
    [...root.domInputs.values()].filter((node) => root.typeOf(node) === type);
  const write = (
    record: string,
    props: Record<string, string | boolean | string[]>,
  ) =>
    workspace.execute(
      setFields({
        targets: [workspace.positionOfRecord(record)!.target],
        props: Object.fromEntries(
          Object.entries(props).map(([key, value]) => [
            key,
            { kind: "set", value },
          ]),
        ),
      }),
    );
  const box = (record: string) => root.getGeometry([record]).get(record)!;
  return { workspace, root, of, write, box };
}

describe("Pagination = page navigation in quiet ActionButtons (shadcn aria Pagination)", () => {
  it("its origin: Previous · the number group (first · gap · 1 2 3 · gap · last) · Next — no Button, no radio", async () => {
    const h = await open();
    try {
      const pagination = h.of("Pagination")[0]!;
      const typesOf = (ids: readonly string[]) =>
        ids.map((id) => h.root.typeOf(h.root.domInputs.get(id)!));
      // (A 「Rows per page」 Select leads — hidden until asked for — beside the navigation's frame:
      //  shadcn's `Field` + `nav` pair, 사용자 「rows per page 와 pagination 이 그룹화」 2026-11-19.)
      expect(typesOf(pagination.children)).toEqual(["Select", "frame"]);
      expect(h.root.domInputs.get(pagination.children[0]!)!.hidden).toBe(true);
      expect(
        typesOf(h.root.domInputs.get(pagination.children[1]!)!.children),
      ).toEqual(["ActionButton", "ActionButtonGroup", "ActionButton"]);
      // (The one Button is the Select's trigger — the page and step buttons are ActionButtons.)
      expect(
        h
          .of("Button")
          .map((button) => h.root.typeOf(h.root.domInputs.get(button.parentId!)!)),
      ).toEqual(["Select"]);
      expect(h.of("ToggleButtonGroup")).toHaveLength(0);
      expect(h.of("ToggleButton")).toHaveLength(0);
      const group = h.of("ActionButtonGroup")[0]!;
      expect(typesOf(group.children)).toEqual([
        "ActionButton",
        "Icon",
        "ActionButton",
        "ActionButton",
        "ActionButton",
        "Icon",
        "ActionButton",
      ]);
      const kids = group.children.map((id) => h.root.domInputs.get(id)!);
      expect(kids.map((kid) => kid.props.id ?? kid.props.iconName)).toEqual([
        "first",
        "ellipsis",
        "1",
        "2",
        "3",
        "ellipsis",
        "last",
      ]);
      // (No page window on the Canvas: the sample's end shows — 1 2 3 … 10 — the start's do not.)
      expect(kids.map((kid) => !!kid.hidden)).toEqual([
        true,
        true,
        false,
        false,
        false,
        false,
        false,
      ]);
      // (Only the shown page is not quiet — shadcn's outline among ghosts.)
      expect(
        h.of("ActionButton").map((node) => node.props.isQuiet === true),
      ).toEqual([true, true, false, true, true, true, true]);
    } finally {
      h.workspace.dispose();
    }
  });

  it("the DOM: a nav of buttons — the shown page aria-current, Previous · Next named by their words", async () => {
    const h = await open();
    const host = document.body.appendChild(document.createElement("div"));
    const reactRoot = createRoot(host);
    try {
      await act(async () =>
        reactRoot.render(renderCatalogDom(h.root, h.of("Pagination")[0]!.id)),
      );
      const nav = host.querySelector("nav")!;
      expect(nav.getAttribute("aria-label")).toBe("Pagination");
      expect(host.querySelectorAll('[role="radio"], [role="radiogroup"]')).toHaveLength(0);
      const buttons = [...host.querySelectorAll("button")];
      expect(
        buttons.map((button) => [
          button.textContent?.trim(),
          button.getAttribute("aria-current"),
        ]),
      ).toEqual([
        ["Previous", null],
        ["1", "page"],
        ["2", null],
        ["3", null],
        ["10", null],
        ["Next", null],
      ]);
      // (One gap — before the last page; a chevron on each step button.)
      expect(host.querySelectorAll('[data-icon="ellipsis"]')).toHaveLength(1);
      expect(buttons[0]!.querySelector('[data-icon="chevron-left"]')).not.toBeNull();
      expect(buttons.at(-1)!.querySelector('[data-icon="chevron-right"]')).not.toBeNull();
    } finally {
      await act(async () => reactRoot.unmount());
      host.remove();
      h.workspace.dispose();
    }
  });

  // 2026-11-19 사용자 「shadcn 은 rows per page · pagination 이 그룹화 — 좌 rows per page, 우 pagination」.
  it("Rows per page at the start, the navigation at the end of a wide Pagination (space-between)", async () => {
    const h = await open();
    try {
      const pagination = h.of("Pagination")[0]!;
      h.write(pagination.id, { showRowsPerPage: true });
      h.workspace.execute(
        setFields({
          targets: [h.workspace.positionOfRecord(pagination.id)!.target],
          visual: { width: { kind: "set", value: 900 } },
        }),
      );
      const [selectId, navId] = h.of("Pagination")[0]!.children;
      const outer = h.box(pagination.id);
      const select = h.box(selectId!);
      const nav = h.box(navId!);
      expect(outer.width).toBe(900);
      expect(select.x).toBeCloseTo(outer.x, 0);
      expect(nav.x + nav.width).toBeCloseTo(outer.x + outer.width, 0);
      expect(nav.x).toBeGreaterThan(select.x + select.width + 16);
    } finally {
      h.workspace.dispose();
    }
  });

  // 2026-11-19 사용자 「simple, icons only 기능도 추가」 — shadcn's two examples as one prop.
  it("Controls: Simple = the numbers only, Icons only = the two chevrons named by their words — Canvas and DOM, with Undo", async () => {
    const h = await open();
    const host = document.body.appendChild(document.createElement("div"));
    const reactRoot = createRoot(host);
    const pagination = () => h.of("Pagination")[0]!;
    // (Drawn = itself and its ancestors not hidden.)
    const drawn = (node: { hidden?: boolean; parentId?: string }): boolean =>
      !node.hidden &&
      (!node.parentId ||
        !h.root.domInputs.get(node.parentId) ||
        drawn(h.root.domInputs.get(node.parentId)!));
    const shownOnCanvas = () =>
      h
        .of("ActionButton")
        .filter(drawn)
        .map((node) => String(node.props.id ?? node.props["aria-label"] ?? "step"));
    const dom = async () => {
      await act(async () =>
        reactRoot.render(renderCatalogDom(h.root, pagination().id)),
      );
      return [...host.querySelectorAll("button")].map((button) => [
        button.textContent?.trim() ?? "",
        button.getAttribute("aria-label"),
      ]);
    };
    try {
      h.write(pagination().id, { controls: "simple" });
      expect(shownOnCanvas()).toEqual(["1", "2", "3"]);
      expect(await dom()).toEqual([
        ["1", null],
        ["2", null],
        ["3", null],
      ]);
      expect(host.querySelectorAll('[data-icon="ellipsis"]')).toHaveLength(0);

      h.write(pagination().id, { controls: "iconsOnly" });
      expect(shownOnCanvas()).toEqual(["Previous", "Next"]);
      // (Square icon buttons — no word drawn, the word is the name.)
      expect(
        h
          .of("ActionButton")
          .filter(drawn)
          .map((node) => node.derivedProps?._actionIconOnly),
      ).toEqual([true, true]);
      expect(await dom()).toEqual([
        ["", "Previous"],
        ["", "Next"],
      ]);
      expect(host.querySelectorAll('[data-icon="ellipsis"]')).toHaveLength(0);

      h.workspace.undo();
      h.workspace.undo();
      expect(shownOnCanvas()).toEqual(["step", "1", "2", "3", "last", "step"]);
    } finally {
      await act(async () => reactRoot.unmount());
      host.remove();
      h.workspace.dispose();
    }
  });

  // 2026-11-19 사용자 「rows per page [select] 기능도 추가」 — shadcn's 「Rows per page」 Select, off by default.
  it("Rows per page: the Select origin shows when asked for — its side label, the trigger reads 10, Canvas and DOM", async () => {
    const h = await open();
    const host = document.body.appendChild(document.createElement("div"));
    const reactRoot = createRoot(host);
    const select = () => h.of("Select")[0]!;
    try {
      expect(select().hidden).toBe(true);
      h.write(h.of("Pagination")[0]!.id, { showRowsPerPage: true });
      expect(select().hidden).toBeFalsy();
      expect(select().props).toMatchObject({
        label: "Rows per page",
        labelPosition: "side",
      });
      // (The Select origin itself — 사용자 「기존의 컴퍼넌트를 사용」: its items are the origin's sample
      //  until the Pagination pages a list, then one item repeats per size.)
      const entry = h.workspace.runtime.graph.getEntry(select().sourceId as never) as {
        definitionId?: string;
      };
      expect(entry.definitionId).toBe("lib:definition:origin-component-select");
      // (The Canvas trigger draws `{placeholder}` — 10 unconnected.)
      expect(h.of("SelectValue").map((value) => value.props.children)).toEqual(
        ["10"],
      );
      await act(async () =>
        reactRoot.render(renderCatalogDom(h.root, h.of("Pagination")[0]!.id)),
      );
      expect(host.querySelector(".react-aria-Select")?.textContent).toContain(
        "Rows per page",
      );
      h.workspace.undo();
      expect(select().hidden).toBe(true);
    } finally {
      await act(async () => reactRoot.unmount());
      host.remove();
      h.workspace.dispose();
    }
  });

  it("its size is its buttons' (S2 action group context)", async () => {
    const h = await open();
    try {
      const heights = () =>
        h
          .of("ActionButton")
          .filter((node) => !node.hidden)
          .map((node) => h.box(node.id).height);
      // (Previous · 1 2 3 · 10 · Next — the first page button is hidden.)
      expect(heights()).toEqual(Array(6).fill(32));
      h.write(h.of("Pagination")[0]!.id, { size: "XL" });
      expect(heights()).toEqual(Array(6).fill(48));
    } finally {
      h.workspace.dispose();
    }
  });
});
