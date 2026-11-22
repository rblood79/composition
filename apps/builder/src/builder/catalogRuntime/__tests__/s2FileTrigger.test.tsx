// @vitest-environment jsdom
/**
 * S2 체크리스트 §4.1 FileTrigger (2026-11-22) — S2 는 RAC FileTrigger 를 다시 내보낼 뿐이고 (S2
 * 고유 구조 · 스타일 없음) 그 안에 S2 Button 을 둔다: `<FileTrigger><Button>Select files</Button></FileTrigger>`.
 *   - the origin is `FileTrigger > Button` — the Button node carries the label, size and disabled
 *     state (RAC `FileTriggerProps` have none of them);
 *   - FileTrigger has no box (RAC gives it no element — `display: contents`, no paint), in both
 *     consumers, with or without children;
 *   - a FileUpload's trigger is the same origin, so the same tree.
 */
import "fake-indexeddb/auto";
import { act } from "react";
import { createRoot } from "react-dom/client";
import { describe, expect, it } from "vitest";
import { fileTriggerBinding } from "../../../../../../packages/shared/src/catalog/bindings/FileTrigger.binding";
import { COMPONENT_RULES_TABLE } from "../../../../../../packages/shared/src/catalog/generated/componentRulesTable";
import { buildCodeCatalogLibrary } from "../../../../../../packages/shared/src/catalog/document/codeCatalogLibrary";
import { CatalogGraph } from "../../../../../../packages/shared/src/catalog/document/graph";
import type {
  EntryId,
  NodeId,
} from "../../../../../../packages/shared/src/catalog/document/types";
import { renderCatalogDom } from "../domBinding";
import { catalogPaletteInsertCommand } from "../paletteInsert";
import { newCatalogProjectDocument } from "../project";
import { CatalogStorage } from "../storage";
import { CatalogWorkspace } from "../workspace";
import { nodeLayoutEngine } from "./support/nodeLayoutEngine";

const BODY = "project:node:home-body" as NodeId;

async function open(type: string) {
  const library = await buildCodeCatalogLibrary();
  const workspace = new CatalogWorkspace(
    new CatalogGraph(
      newCatalogProjectDocument({
        projectId: "project:project:s2-filetrigger" as EntryId<"project">,
        name: "S2 file trigger",
      }),
      library,
    ),
    new CatalogStorage(indexedDB, `s2-filetrigger-${Math.random()}`),
    {
      engine: await nodeLayoutEngine(),
      viewport: { width: 1200, height: 800 },
      autosaveSchedule: () => {},
    },
  );
  workspace.execute(
    catalogPaletteInsertCommand(
      {
        graph: workspace.runtime.graph,
        records: workspace.root.domInputs,
        selection: () => [],
        itemOfRecord: (id) => workspace.itemOfRecord(id),
        pageContent: () => ({ kind: "node", id: BODY }),
        newId: workspace.newId,
      },
      type,
    )!,
  );
  const root = workspace.root;
  const all = () => [...root.canvasInputs.values()];
  const of = (t: string) => all().find((r) => root.typeOf(r) === t)!;
  return { workspace, root, all, of };
}

describe("S2 FileTrigger — RAC FileTrigger around an S2 Button", () => {
  it("the origin is FileTrigger > Button; the Button carries the label", async () => {
    const { root, of } = await open("FileTrigger");
    const trigger = of("FileTrigger");
    const kids = trigger.children.map((id) => root.canvasInputs.get(id)!);
    expect(kids.map((kid) => root.typeOf(kid))).toEqual(["Button"]);
    // (The Button origin binds its `label` to its Text child — ADR-276.)
    const text = kids[0]!.children
      .map((id) => root.canvasInputs.get(id)!)
      .find((part) => root.typeOf(part) === "Text" && !part.hidden);
    expect(text?.props.children).toBe("Select files");
  });

  it("FileTrigger takes RAC's props only — no label, size or disabled of its own", () => {
    const accepts = Object.keys(fileTriggerBinding.props.accepts);
    for (const key of ["children", "size", "isDisabled"])
      expect(accepts).not.toContain(key);
    expect(accepts).toEqual(
      expect.arrayContaining([
        "acceptedFileTypes",
        "allowsMultiple",
        "acceptDirectory",
        "defaultCamera",
      ]),
    );
  });

  it("FileTrigger has no box: its rule is `display: contents` with no paint", () => {
    const rule = COMPONENT_RULES_TABLE.FileTrigger!;
    expect(rule.structure?.containerStyles?.display).toBe("contents");
    expect(Object.keys(rule.variants ?? {})).toEqual([]);
  });

  it("Canvas: the Button stands in the trigger's place — the trigger's box is the Button's", async () => {
    const { root, of } = await open("FileTrigger");
    const trigger = of("FileTrigger");
    const button = root.canvasInputs.get(trigger.children[0]!)!;
    const geo = (id: string) => root.getGeometry([id]).get(id)!;
    expect(geo(button.id).height).toBe(32);
    expect(geo(trigger.id).height).toBe(geo(button.id).height);
    expect(geo(trigger.id).width).toBe(geo(button.id).width);
  });

  it("DOM: RAC FileTrigger renders no element of its own — the S2 Button with its file input", async () => {
    const { root, of } = await open("FileTrigger");
    (
      globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }
    ).IS_REACT_ACT_ENVIRONMENT = true;
    const host = document.body.appendChild(document.createElement("div"));
    const reactRoot = createRoot(host);
    await act(async () =>
      reactRoot.render(renderCatalogDom(root, of("FileTrigger").id)),
    );
    expect(host.querySelector(".react-aria-FileTrigger")).toBeNull();
    const button = host.querySelector("button.react-aria-Button")!;
    expect(button.textContent?.trim()).toBe("Select files");
    expect(host.querySelector('input[type="file"]')).not.toBeNull();
    await act(async () => reactRoot.unmount());
    host.remove();
  });

  it("a FileUpload's trigger is the same tree", async () => {
    const { root, of } = await open("FileUpload");
    const trigger = of("FileTrigger");
    expect(
      trigger.children.map((id) => root.typeOf(root.canvasInputs.get(id)!)),
    ).toEqual(["Button"]);
  });
});
