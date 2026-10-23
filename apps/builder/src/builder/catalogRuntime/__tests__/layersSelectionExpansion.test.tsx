import "fake-indexeddb/auto";
import { act, render } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { CatalogGraph } from "../../../../../../packages/shared/src/catalog/document/graph";
import { buildCodeCatalogLibrary } from "../../../../../../packages/shared/src/catalog/document/codeCatalogLibrary";
import type {
  EntryId,
  NodeEntry,
  NodeId,
} from "../../../../../../packages/shared/src/catalog/document/types";
import { insertNodes } from "../../../../../../packages/shared/src/catalog/commands";
import { I18nProvider } from "../../../i18n";
import { CatalogLayersSection } from "../../panels/navigator/catalog/CatalogLayersSection";
import { newCatalogProjectDocument } from "../project";
import { CatalogWorkspaceProvider } from "../react";
import { CatalogStorage } from "../storage";
import { CatalogWorkspace } from "../workspace";
import { nodeLayoutEngine } from "./support/nodeLayoutEngine";

/**
 * 2026-10-24 (사용자 「canvas 의 객체를 선택하면 navigator layer 트리가 깜빡이거나 떨리거나 이전대상과
 * 왔다갔다」): the Layers rows a Canvas selection opened stay open after the selection moves on
 * (Figma) — before, they followed the current selection alone, so every selection closed the last
 * one's ancestors and the rows jumped.
 */
const BODY = "project:node:home-body" as NodeId;
const PAGE = "project:page:home" as EntryId<"page">;

const cleanups: Array<() => void> = [];
afterEach(() => {
  for (const cleanup of cleanups.splice(0).reverse()) cleanup();
});

const frame = (id: string, children: string[]): NodeEntry =>
  ({
    kind: "node",
    id,
    definitionId: "lib:definition:type-frame",
    children,
    props: {},
    visual: {},
    sizing: {},
    descendantOverrides: [],
  }) as NodeEntry;
const text = (id: string, value: string): NodeEntry =>
  ({
    kind: "node",
    id,
    definitionId: "lib:definition:text",
    children: [],
    props: { children: { kind: "set", value } },
    visual: {},
    sizing: {},
    descendantOverrides: [],
  }) as NodeEntry;

async function open() {
  const workspace = new CatalogWorkspace(
    new CatalogGraph(
      newCatalogProjectDocument({
        projectId: "project:project:layers-expansion" as EntryId<"project">,
        name: "Layers",
      }),
      await buildCodeCatalogLibrary(),
    ),
    new CatalogStorage(indexedDB, `layers-expansion-${Math.random()}`),
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
        frame("project:node:a", ["project:node:a-text"]),
        text("project:node:a-text", "Alpha"),
        frame("project:node:b", ["project:node:b-text"]),
        text("project:node:b-text", "Beta"),
      ],
      rootIds: ["project:node:a", "project:node:b"] as NodeId[],
      newId: workspace.newId,
    }),
  );
  cleanups.push(() => act(() => workspace.dispose()));
  const record = (sourceId: string) =>
    [...workspace.root.domInputs.values()].find(
      (item) => item.sourceId === sourceId,
    )!.id;
  const view = render(
    <I18nProvider initialLocale="en-US">
      <CatalogWorkspaceProvider workspace={workspace}>
        <CatalogLayersSection ownerId={PAGE} />
      </CatalogWorkspaceProvider>
    </I18nProvider>,
  );
  cleanups.push(() => view.unmount());
  const select = (sourceId: string) =>
    act(() => workspace.selectRecords([record(sourceId)]));
  const row = (sourceId: string) =>
    document.querySelector<HTMLElement>(
      `.layer-tree [data-key="${CSS.escape(record(sourceId))}"]`,
    );
  return { workspace, select, row };
}

describe("Layers — rows a selection opened stay open", () => {
  it("selecting elsewhere keeps the last selection's ancestors open", async () => {
    const { select, row } = await open();
    select("project:node:a-text");
    expect(row("project:node:a")?.getAttribute("aria-expanded")).toBe("true");
    expect(row("project:node:a-text")).toBeTruthy();

    select("project:node:b-text");
    expect(row("project:node:b")?.getAttribute("aria-expanded")).toBe("true");
    // The first selection's frame stays open: its rows do not jump away.
    expect(row("project:node:a")?.getAttribute("aria-expanded")).toBe("true");
    expect(row("project:node:a-text")).toBeTruthy();
  });

  it("clearing the selection keeps the rows open", async () => {
    const { workspace, select, row } = await open();
    select("project:node:a-text");
    act(() => workspace.session.clearSelection());
    expect(row("project:node:a")?.getAttribute("aria-expanded")).toBe("true");
  });
});
