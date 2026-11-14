// @vitest-environment jsdom
/**
 * (2026-11-14, 사용자 「S2 대응 없음 컴포넌트를 S2 패턴으로」 · 「Pagination 현재 page」) S2 · RAC have no Pagination —
 * its nearest S2 assembly: a quiet ActionButton each side (S2's own «step» buttons — `Calendar.tsx`) around a
 * single-selection ToggleButtonGroup of the page numbers. The current page is the group's selection
 * (ADR-308 — the group stores it), and the Pagination's size is its buttons'.
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

describe("Pagination = quiet ActionButtons around a ToggleButtonGroup of pages", () => {
  it("its origin: previous · pages · next — no Button", async () => {
    const h = await open();
    try {
      const pagination = h.of("Pagination")[0]!;
      expect(
        pagination.children.map((id) =>
          h.root.typeOf(h.root.domInputs.get(id)!),
        ),
      ).toEqual(["ActionButton", "ToggleButtonGroup", "ActionButton"]);
      expect(h.of("Button")).toHaveLength(0);
      expect(h.of("ActionButton").map((node) => node.props.isQuiet)).toEqual([
        true,
        true,
      ]);
      const group = h.of("ToggleButtonGroup")[0]!;
      expect(group.props).toMatchObject({
        selectionMode: "single",
        disallowEmptySelection: true,
      });
      expect(h.of("ToggleButton").map((node) => node.props.id)).toEqual([
        "1",
        "2",
        "3",
      ]);
    } finally {
      h.workspace.dispose();
    }
  });

  it("the current page is the group's selection — Canvas and DOM, moved by a write, with Undo", async () => {
    const h = await open();
    const host = document.body.appendChild(document.createElement("div"));
    const reactRoot = createRoot(host);
    const selected = () =>
      h
        .of("ToggleButton")
        .map((node) => node.derivedProps?._isSelected === true);
    try {
      expect(selected()).toEqual([true, false, false]);
      const group = h.of("ToggleButtonGroup")[0]!;
      h.write(group.id, { defaultSelectedKeys: ["2"] });
      expect(selected()).toEqual([false, true, false]);
      await act(async () =>
        reactRoot.render(renderCatalogDom(h.root, h.of("Pagination")[0]!.id)),
      );
      const nav = host.querySelector("nav")!;
      expect(nav.getAttribute("aria-label")).toBe("Pagination");
      const pages = [...host.querySelectorAll("button")].filter((button) =>
        /^\d+$/.test(button.textContent ?? ""),
      );
      expect(
        pages.map((button) => [
          button.textContent,
          button.hasAttribute("data-selected"),
        ]),
      ).toEqual([
        ["1", false],
        ["2", true],
        ["3", false],
      ]);
      h.workspace.undo();
      expect(selected()).toEqual([true, false, false]);
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
        [...h.of("ActionButton"), ...h.of("ToggleButton")].map(
          (node) => h.box(node.id).height,
        );
      expect(heights()).toEqual(Array(5).fill(32));
      h.write(h.of("Pagination")[0]!.id, { size: "XL" });
      expect(heights()).toEqual(Array(5).fill(48));
      expect(h.of("ToggleButton").map((node) => node.props.size)).toEqual([
        "XL",
        "XL",
        "XL",
      ]);
    } finally {
      h.workspace.dispose();
    }
  });
});
