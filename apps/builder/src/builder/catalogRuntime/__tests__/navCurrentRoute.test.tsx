// @vitest-environment jsdom
/**
 * (2026-11-14, 사용자 「S2 대응 없음 컴포넌트를 S2 패턴으로」 · 「Nav 현재 경로 표시」) A Nav is an unpainted row of
 * S2 standalone Links. Its `selectedRoute` (S2 SideNav's prop — unset: the shown page's route) marks the Link
 * whose `href` it is: RAC `aria-current="page"` in the DOM, the Link rule's current weight on both consumers.
 * Its `size` is its Links'.
 */
import "fake-indexeddb/auto";
import { act } from "react";
import { createRoot } from "react-dom/client";
import { describe, expect, it } from "vitest";
import {
  insertNodes,
  setFields,
} from "../../../../../../packages/shared/src/catalog/commands";
import { navBinding } from "../../../../../../packages/shared/src/catalog/bindings/Nav.binding";
import { buildCodeCatalogLibrary } from "../../../../../../packages/shared/src/catalog/document/codeCatalogLibrary";
import { CatalogGraph } from "../../../../../../packages/shared/src/catalog/document/graph";
import type {
  NodeEntry,
  NodeId,
} from "../../../../../../packages/shared/src/catalog/document/types";
import { COMPONENT_RULES_TABLE } from "../../../../../../packages/shared/src/catalog/generated/componentRulesTable";
import { evaluateConditionTree } from "../../../../../../packages/shared/src/catalog/rule/conditionTree";
import { getSkiaNode } from "../../workspace/canvas/skia/useSkiaNode";
import { bindCatalogCanvas } from "../canvasBinding";
import { renderCatalogDom } from "../domBinding";
import { newCatalogProjectDocument } from "../project";
import { CatalogStorage } from "../storage";
import { CatalogWorkspace } from "../workspace";
import { nodeLayoutEngine } from "./support/nodeLayoutEngine";

const NAV = "project:node:nav" as NodeId;

async function open() {
  const library = await buildCodeCatalogLibrary();
  const workspace = new CatalogWorkspace(
    new CatalogGraph(
      newCatalogProjectDocument({
        projectId: "project:project:nav",
        name: "Nav",
      }),
      library,
    ),
    new CatalogStorage(indexedDB, `nav-${Math.random()}`),
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
          id: NAV,
          definitionId: "lib:definition:origin-component-nav",
          children: [],
          props: {},
          visual: {},
          sizing: {},
          descendantOverrides: [],
        } as NodeEntry,
      ],
      rootIds: [NAV],
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
  return { workspace, root, of, write };
}

const currentOf = (links: ReturnType<Awaited<ReturnType<typeof open>>["of"]>) =>
  links.map((link) => [
    link.props.href,
    link.derivedProps?._navCurrent === true,
    link.derivedProps?.fontWeight,
  ]);

describe("Nav = an unpainted row of S2 standalone Links", () => {
  it("takes `selectedRoute` (S2 SideNav's prop)", () => {
    expect(navBinding.props.accepts.selectedRoute).toMatchObject({
      kind: "string",
      section: "value",
    });
  });

  it("its origin's Links are standalone · quiet · secondary", async () => {
    const h = await open();
    try {
      expect(
        h
          .of("Link")
          .map((link) => [
            link.props.isStandalone,
            link.props.isQuiet,
            link.props.variant,
          ]),
      ).toEqual(Array.from({ length: 3 }, () => [true, true, "secondary"]));
    } finally {
      h.workspace.dispose();
    }
  });

  it("its size is its Links'", async () => {
    const h = await open();
    try {
      h.write(h.of("Nav")[0]!.id, { size: "L" });
      expect(h.of("Link").map((link) => link.props.size)).toEqual([
        "L",
        "L",
        "L",
      ]);
    } finally {
      h.workspace.dispose();
    }
  });

  it("marks the Link of its route — Canvas weight and DOM `aria-current`, with Undo", async () => {
    const h = await open();
    const host = document.body.appendChild(document.createElement("div"));
    const reactRoot = createRoot(host);
    const weight = Number(
      evaluateConditionTree(
        COMPONENT_RULES_TABLE.Link.structure?.stateStyles?.fontWeight as never,
        { isCurrent: true },
      ),
    );
    try {
      expect(weight).toBe(700);
      const nav = h.of("Nav")[0]!;
      h.write(nav.id, { selectedRoute: "/about" });
      expect(currentOf(h.of("Link"))).toEqual([
        ["/", false, undefined],
        ["/about", true, weight],
        ["/contact", false, undefined],
      ]);
      // (What the Canvas paints — the standalone 500 at rest, the current Link's weight.)
      const binding = bindCatalogCanvas(h.root, h.root.pageRootRecords());
      const painted = h.of("Link").map(
        (link) =>
          (
            getSkiaNode(link.id) as unknown as {
              presentationTextMetricTargets?: {
                text: { fontWeight: number };
              }[];
            }
          )?.presentationTextMetricTargets?.[0]?.text.fontWeight,
      );
      binding.dispose();
      expect(painted).toEqual([500, weight, 500]);
      await act(async () => reactRoot.render(renderCatalogDom(h.root, nav.id)));
      const anchors = [...host.querySelectorAll("a")];
      expect(
        anchors.map((anchor) => [
          anchor.getAttribute("href"),
          anchor.getAttribute("aria-current"),
          anchor.hasAttribute("data-current"),
        ]),
      ).toEqual([
        ["/", null, false],
        ["/about", "page", true],
        ["/contact", null, false],
      ]);
      // (Another route moves the mark — an incremental step.)
      h.write(nav.id, { selectedRoute: "/contact" });
      expect(currentOf(h.of("Link")).map(([, current]) => current)).toEqual([
        false,
        false,
        true,
      ]);
      h.workspace.undo();
      expect(currentOf(h.of("Link")).map(([, current]) => current)).toEqual([
        false,
        true,
        false,
      ]);
    } finally {
      await act(async () => reactRoot.unmount());
      host.remove();
      h.workspace.dispose();
    }
  });
});
