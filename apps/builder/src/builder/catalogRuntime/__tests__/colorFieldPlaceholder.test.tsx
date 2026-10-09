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
 * S2 ColorField `placeholder` (2026-10-10, 조사 문서 6 「다」 — `Pick<InputProps, 'placeholder'>`, no
 * default): the origin binds it to its Input (`{placeholder}`) as TextField · NumberField do, so the
 * Preview's input and the Canvas's Input box show the same text. Before, the Input had a fixed
 * placeholder "#000000" the author could not change.
 */
const BODY = "project:node:home-body" as NodeId;
const FIELD = "project:node:color" as NodeId;
const set = <T,>(value: T) => ({ kind: "set" as const, value });
const measure: CatalogTextMeasure = (value, font) => ({
  width: value.length * font.fontSize * 0.5,
  exactWidth: value.length * font.fontSize * 0.5,
  minWidth: value.length * font.fontSize * 0.5,
  height: font.fontSize * (font.lineHeight || 1.2),
});

async function place() {
  const workspace = new CatalogWorkspace(
    new CatalogGraph(
      newCatalogProjectDocument({
        projectId: "project:project:colorfield-placeholder" as EntryId<"project">,
        name: "ColorField",
      }),
      await buildCodeCatalogLibrary(),
    ),
    new CatalogStorage(indexedDB, `colorfield-placeholder-${Math.random()}`),
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
            "lib:definition:origin-component-colorfield" as LibraryDefinitionId,
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
      { text: string } | undefined;
    return text?.text ?? "";
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

describe("S2 ColorField placeholder", () => {
  it("the Design panel offers Placeholder", () => {
    const keys = editContractFixture("ColorField").fields.map(
      (field) => field.key,
    );
    expect(keys).toContain("placeholder");
  });

  it("a new ColorField has no placeholder on either side (S2 — no default)", async () => {
    const { canvasText, input } = await place();
    expect(input()).toEqual({ value: "", placeholder: undefined });
    expect(canvasText()).toBe("");
  });

  it("the written placeholder shows on both sides", async () => {
    const { canvasText, input, write } = await place();
    write({ placeholder: "#FF0000" });
    expect(input()).toEqual({ value: "", placeholder: "#FF0000" });
    expect(canvasText()).toBe("#FF0000");
    write({ placeholder: "" });
    expect(input().placeholder).toBeUndefined();
    expect(canvasText()).toBe("");
  });
});
