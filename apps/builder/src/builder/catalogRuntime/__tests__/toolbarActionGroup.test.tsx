// @vitest-environment jsdom
/**
 * (2026-11-14, 사용자 「S2 대응 없음 컴포넌트를 S2 패턴으로」 · 「Toolbar 묶음 prop 5개」) A Toolbar is S2's action
 * group (`ActionButtonGroup.tsx` — the styled RAC Toolbar): its origin holds ActionButtons, and its
 * `size` · `density` · `isQuiet` · `staticColor` · `isDisabled` · `isJustified` reach them through the
 * group context, on the Canvas and in the DOM.
 */
import "fake-indexeddb/auto";
import { act } from "react";
import { createRoot } from "react-dom/client";
import { describe, expect, it } from "vitest";
import {
  insertNodes,
  setFields,
} from "../../../../../../packages/shared/src/catalog/commands";
import { toolbarBinding } from "../../../../../../packages/shared/src/catalog/bindings/Toolbar.binding";
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

const TOOLBAR = "project:node:toolbar" as NodeId;

async function open() {
  const library = await buildCodeCatalogLibrary();
  const workspace = new CatalogWorkspace(
    new CatalogGraph(
      newCatalogProjectDocument({
        projectId: "project:project:toolbar",
        name: "Toolbar",
      }),
      library,
    ),
    new CatalogStorage(indexedDB, `toolbar-${Math.random()}`),
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
          id: TOOLBAR,
          definitionId: "lib:definition:origin-component-toolbar",
          children: [],
          props: {},
          visual: {},
          sizing: {},
          descendantOverrides: [],
        } as NodeEntry,
      ],
      rootIds: [TOOLBAR],
      newId: workspace.newId,
    }),
  );
  const root = workspace.root;
  const of = (type: string) =>
    [...root.domInputs.values()].filter((node) => root.typeOf(node) === type);
  const write = (record: string, props: Record<string, string | boolean>) =>
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

describe("Toolbar = S2 action group", () => {
  it("its binding takes the group axes", () => {
    expect(Object.keys(toolbarBinding.props.accepts)).toEqual(
      expect.arrayContaining([
        "size",
        "orientation",
        "density",
        "isQuiet",
        "isJustified",
        "staticColor",
        "isDisabled",
      ]),
    );
  });

  it("its origin holds ActionButtons and an unsized divider", async () => {
    const h = await open();
    try {
      expect(h.of("ActionButton")).toHaveLength(3);
      expect(h.of("Button")).toHaveLength(0);
      const separator = h.of("Separator")[0]!;
      // (S2 Divider in a row: `alignSelf: stretch`, its thickness the rule's — no authored 1 × 20.)
      expect(separator.sizing.width).toBeUndefined();
      expect(separator.sizing.height).toBeUndefined();
    } finally {
      h.workspace.dispose();
    }
  });

  it("its size · density · quiet · color · disabled reach the buttons — Canvas and DOM, with Undo", async () => {
    const h = await open();
    const host = document.body.appendChild(document.createElement("div"));
    const reactRoot = createRoot(host);
    try {
      const toolbar = h.of("Toolbar")[0]!;
      expect(h.box(h.of("ActionButton")[0]!.id).height).toBe(32);
      h.write(toolbar.id, {
        size: "XL",
        density: "compact",
        isQuiet: true,
        staticColor: "white",
        isDisabled: true,
      });
      const buttons = h.of("ActionButton");
      expect(buttons.map((node) => node.props.size)).toEqual([
        "XL",
        "XL",
        "XL",
      ]);
      expect(h.box(buttons[0]!.id).height).toBe(48);
      expect(
        buttons.map((node) => [
          node.derivedProps?._inActionGroup,
          node.derivedProps?.isQuiet,
          node.derivedProps?.staticColor,
          node.derivedProps?.density,
          node.derivedProps?.isDisabled,
        ]),
      ).toEqual(
        Array.from({ length: 3 }, () => [true, true, "white", "compact", true]),
      );
      // (compact: the buttons sit 2 apart — S2 `gap: 2`.)
      const [first, second] = buttons.map((node) => h.box(node.id));
      expect(second!.x - first!.x - first!.width).toBeCloseTo(2);

      await act(async () =>
        reactRoot.render(renderCatalogDom(h.root, toolbar.id)),
      );
      const element = host.querySelector('[role="toolbar"]')!;
      expect(element.classList.contains("react-aria-Toolbar")).toBe(true);
      expect(element.getAttribute("data-density")).toBe("compact");
      const dom = [...host.querySelectorAll("button")];
      expect(dom).toHaveLength(3);
      expect(dom.map((button) => button.disabled)).toEqual([true, true, true]);
      expect(dom[0]!.dataset.quiet).toBe("true");
      expect(dom[0]!.dataset.staticColor).toBe("white");
      expect(dom[0]!.dataset.size).toBe("XL");

      h.workspace.undo();
      expect(h.box(h.of("ActionButton")[0]!.id).height).toBe(32);
      expect(h.of("ActionButton")[0]!.derivedProps?.isQuiet).not.toBe(true);
    } finally {
      await act(async () => reactRoot.unmount());
      host.remove();
      h.workspace.dispose();
    }
  });
});
