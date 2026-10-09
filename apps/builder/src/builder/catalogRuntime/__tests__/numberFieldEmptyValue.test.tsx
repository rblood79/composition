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
 * S2 NumberField (2026-10-10 사용자 「2번 NumberField 빈 값 S2 처럼 진행해」): without a value the
 * input is empty and shows the field's `placeholder` (S2 `Pick<InputProps, 'placeholder'>` — no
 * default); with a value both sides draw RAC's text — the value snapped to the range and step
 * (`useNumberFieldState` `snapValue`) in the locale's number format. Before, the DOM always started
 * RAC at 0 (`Number(props.value || 0)`) and the Canvas drew the Input's fixed placeholder "0".
 */
const BODY = "project:node:home-body" as NodeId;
const FIELD = "project:node:number" as NodeId;
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
        projectId: "project:project:numberfield-empty" as EntryId<"project">,
        name: "NumberField",
      }),
      await buildCodeCatalogLibrary(),
    ),
    new CatalogStorage(indexedDB, `numberfield-empty-${Math.random()}`),
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
            "lib:definition:origin-component-numberfield" as LibraryDefinitionId,
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
  const inputHeight = () => {
    const id = inputId();
    return (root.getGeometry([id]).get(id) as { height: number }).height;
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
  return { canvasText, inputHeight, input, write };
}

describe("S2 NumberField — an empty value is an empty input", () => {
  it("the Design panel offers Placeholder", () => {
    const keys = editContractFixture("NumberField").fields.map(
      (field) => field.key,
    );
    expect(keys).toContain("placeholder");
  });

  it("a new NumberField starts empty on both sides (no 0)", async () => {
    const { canvasText, input } = await place();
    expect(input().value).toBe("");
    expect(canvasText()).toBe("");
  });

  it("the placeholder shows on both sides while the value is empty", async () => {
    const { canvasText, input, write } = await place();
    write({ placeholder: "Amount" });
    expect(input()).toEqual({ value: "", placeholder: "Amount" });
    expect(canvasText()).toBe("Amount");
  });

  it("a value is drawn as RAC formats it — snapped to the range and step", async () => {
    const { canvasText, input, write } = await place();
    write({ placeholder: "Amount", value: "42" });
    expect(input().value).toBe("42");
    expect(canvasText()).toBe("42");
    // (the origin's range is 0–100, step 1)
    write({ value: "150" });
    expect(input().value).toBe("100");
    expect(canvasText()).toBe("100");
    write({ value: "2.6" });
    expect(input().value).toBe("3");
    expect(canvasText()).toBe("3");
    write({ maxValue: 100000, step: 0.5, value: "1234.5" });
    expect(input().value).toBe("1,234.5");
    expect(canvasText()).toBe("1,234.5");
    // Cleared: the placeholder again.
    write({ value: "" });
    expect(input().value).toBe("");
    expect(canvasText()).toBe("Amount");
  });

  it("the empty Input keeps its box height", async () => {
    const { inputHeight, write } = await place();
    const empty = inputHeight();
    write({ value: "7" });
    expect(empty).toBeGreaterThan(0);
    expect(inputHeight()).toBe(empty);
  });
});
