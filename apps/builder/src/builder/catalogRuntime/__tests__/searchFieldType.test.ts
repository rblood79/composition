import "fake-indexeddb/auto";
import { act, render } from "@testing-library/react";
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
import type { CatalogTextMeasure } from "../compositionRoot";
import { renderCatalogDom } from "../domBinding";
import { editContractFixture } from "./support/editContractFixture";
import { newCatalogProjectDocument } from "../project";
import { CatalogStorage } from "../storage";
import { CatalogWorkspace } from "../workspace";
import { nodeLayoutEngine } from "./support/nodeLayoutEngine";

/**
 * S2 SearchField `type` (text · search · url · tel · email · password — RAC passes it to the input;
 * unset = `search`). A password SearchField's value is masked on both sides: the DOM input's dots,
 * the Canvas the same count of `•` in the Input's text.
 */
const BODY = "project:node:home-body" as NodeId;
const FIELD = "project:node:field" as NodeId;
const set = <T>(value: T) => ({ kind: "set" as const, value });
const measure: CatalogTextMeasure = (value, font) => ({
  width: value.length * font.fontSize * 0.5,
  exactWidth: value.length * font.fontSize * 0.5,
  minWidth: value.length * font.fontSize * 0.5,
  height: font.fontSize * (font.lineHeight || 1.2),
});

async function place(type: string) {
  const workspace = new CatalogWorkspace(
    new CatalogGraph(
      newCatalogProjectDocument({
        projectId: "project:project:searchfield-type" as EntryId<"project">,
        name: "Date locale",
      }),
      await buildCodeCatalogLibrary(),
    ),
    new CatalogStorage(indexedDB, `searchfield-type-${Math.random()}`),
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
            `lib:definition:origin-component-${type}` as LibraryDefinitionId,
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
  const part = (typeName: string) =>
    [...root.canvasInputs.values()].find(
      (record) => root.typeOf(record) === typeName,
    )!;
  const html = () =>
    renderToStaticMarkup(
      renderCatalogDom(root, root.recordsOfSource(FIELD)[0]!),
    );
  const write = (props: Record<string, string>) =>
    workspace.execute(
      setFields({
        targets: [{ kind: "node", id: FIELD }],
        props: Object.fromEntries(
          Object.entries(props).map(([key, value]) => [key, set(value)]),
        ),
      }),
    );
  return { root, part, html, write };
}

describe("S2 SearchField type", () => {
  it("the Design panel offers it, default search", () => {
    const field = editContractFixture("SearchField").fields.find(
      (candidate) => candidate.key === "type",
    );
    expect(field?.options?.map((option) => option.value)).toEqual([
      "search",
      "text",
      "url",
      "tel",
      "email",
      "password",
    ]);
  });

  it("the DOM input takes the SearchField's type", async () => {
    const { html, write } = await place("searchfield");
    const type = () => /<input[^>]* type="([^"]+)"/.exec(html())?.[1];
    expect(type()).toBe("search");
    write({ type: "email" });
    expect(type()).toBe("email");
  });

  it("a password SearchField's value is masked on the Canvas as in the DOM", async () => {
    const { html, part, write } = await place("searchfield");
    write({ value: "secret" });
    expect(part("Input").derivedProps?.placeholder).toBe("secret");
    write({ type: "password" });
    expect(/<input[^>]* type="password"/.test(html())).toBe(true);
    expect(part("Input").derivedProps?.placeholder).toBe("••••••");
  });

  // RAC's input value is its run state (`defaultValue`): a document edit of the Value reached a
  // mounted Preview input only on the next mount — the Canvas showed it at once. It starts again,
  // as the Slider's does (2026-10-09 live).
  for (const type of ["searchfield", "textfield", "numberfield"])
    it(`${type}: a Value edit reaches the mounted DOM input`, async () => {
      const { root, write } = await place(type);
      const view = render(
        renderCatalogDom(root, root.recordsOfSource(FIELD)[0]!),
      );
      const input = () => view.container.querySelector("input")!;
      act(() => write({ value: "12" }));
      expect(input().value).toBe("12");
      act(() => write({ value: "34" }));
      expect(input().value).toBe("34");
      view.unmount();
    });
});
