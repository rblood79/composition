import "fake-indexeddb/auto";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { CatalogGraph } from "../../../../../../packages/shared/src/catalog/document/graph";
import { buildCodeCatalogLibrary } from "../../../../../../packages/shared/src/catalog/document/codeCatalogLibrary";
import type {
  EntryId,
  LibraryDefinitionId,
  NodeId,
} from "../../../../../../packages/shared/src/catalog/document/types";
import {
  insertNodes,
  setFields,
} from "../../../../../../packages/shared/src/catalog/commands";
import { catalogAuthoredVisual } from "../../../../../../packages/shared/src/catalog/runtime/libraryVisual";
import type { CatalogTextMeasure } from "../compositionRoot";
import { renderCatalogDom } from "../domBinding";
import { catalogRuleShapes } from "../ruleShapes";
import { editContractFixture } from "./support/editContractFixture";
import { newCatalogProjectDocument } from "../project";
import { CatalogStorage } from "../storage";
import { CatalogWorkspace } from "../workspace";
import { nodeLayoutEngine } from "./support/nodeLayoutEngine";

/**
 * A TextArea's text on the Canvas (사용자 2026-10-10 「textarea placeholder 텍스트가 상단이 아니라 가운데
 * 위치한다 css 와 비교해봐」): a `<textarea>` starts its text at its top padding — the Canvas draws its
 * Input's text there too (`verticalAlign: "top"` — the TextArea's Input part rule), not in the
 * middle of its rows box. A one-line field's Input keeps its text in the middle.
 */
const BODY = "project:node:home-body" as NodeId;
const FIELD = "project:node:area" as NodeId;
const set = <T,>(value: T) => ({ kind: "set" as const, value });
const measure: CatalogTextMeasure = (value, font) => ({
  width: value.length * font.fontSize * 0.5,
  exactWidth: value.length * font.fontSize * 0.5,
  minWidth: value.length * font.fontSize * 0.5,
  height: font.fontSize * (font.lineHeight || 1.2),
});

async function place(kind: "textarea" | "textfield") {
  const workspace = new CatalogWorkspace(
    new CatalogGraph(
      newCatalogProjectDocument({
        projectId: "project:project:textarea-text-top" as EntryId<"project">,
        name: "TextArea",
      }),
      await buildCodeCatalogLibrary(),
    ),
    new CatalogStorage(indexedDB, `textarea-text-top-${Math.random()}`),
    {
      engine: await nodeLayoutEngine(),
      viewport: { width: 1920, height: 1080 },
      autosaveSchedule: () => {},
      locale: "en-US",
      textMeasure: measure,
    },
  );
  workspace.execute(
    insertNodes({
      parent: { kind: "node", id: BODY },
      entries: [
        {
          kind: "node",
          id: FIELD,
          definitionId:
            `lib:definition:origin-component-${kind}` as LibraryDefinitionId,
          children: [],
          props: {},
          visual: {},
          sizing: {},
          descendantOverrides: [],
        },
      ],
      rootIds: [FIELD],
      newId: workspace.newId,
    }),
  );
  const root = workspace.root;
  const inputId = () =>
    [...root.canvasInputs.entries()].find(
      ([, record]) => root.typeOf(record) === "Input",
    )![0];
  /** The text the Canvas draws in the Input box (its rule's text shape). */
  const canvasText = () => {
    const id = inputId();
    const record = root.canvasInputs.get(id)!;
    // (as `canvasBinding` gives the rule — the derived values over the props)
    const node = {
      ...record,
      props: { ...record.props, ...record.derivedProps },
    };
    const box = root.getGeometry([id]).get(id) as {
      width: number;
      height: number;
    };
    const text = catalogRuleShapes({
      node,
      rect: { width: box.width, height: box.height },
      rule: workspace.runtime.graph.library.rules.get("Input" as never)!,
      type: "Input",
      authoredVisual: catalogAuthoredVisual(root, record),
    }).find((shape) => shape.type === "text") as unknown as
      { text: string; y: number; baseline: string } | undefined;
    return text;
  };
  const input = () => {
    const html = renderToStaticMarkup(
      renderCatalogDom(root, root.recordsOfSource(FIELD)[0]!),
    );
    const tag = /<input[^>]*>/.exec(html)?.[0] ?? "";
    return {
      value: /\svalue="([^"]*)"/.exec(tag)?.[1] ?? "",
      placeholder: /\splaceholder="([^"]*)"/.exec(tag)?.[1],
    };
  };
  const write = (props: Record<string, string | number>) =>
    workspace.execute(
      setFields({
        targets: [{ kind: "node", id: FIELD }],
        props: Object.fromEntries(
          Object.entries(props).map(([key, value]) => [key, set(value)]),
        ),
      }),
    );
  return { canvasText, input, write };
}

describe("TextArea text on the Canvas", () => {
  it("the placeholder starts at the textarea's top padding (not the middle)", async () => {
    const { canvasText, write } = await place("textarea");
    write({ placeholder: "Write here" });
    expect(canvasText()).toMatchObject({
      text: "Write here",
      baseline: "top",
      // (the Input rule's M padding-top)
      y: 4,
    });
  });

  it("a TextField's placeholder stays in the middle of its one line", async () => {
    const { canvasText, write } = await place("textfield");
    write({ placeholder: "Write here" });
    expect(canvasText()).toMatchObject({ text: "Write here", baseline: "middle" });
  });
});
