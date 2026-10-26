import { act, fireEvent } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import {
  createComponent,
  insertNodes,
} from "../../../../../../packages/shared/src/catalog/commands";
import { buildCodeCatalogLibrary } from "../../../../../../packages/shared/src/catalog/document/codeCatalogLibrary";
import type {
  NodeEntry,
  NodeId,
} from "../../../../../../packages/shared/src/catalog/document/types";
import { catalogPaletteDefinitionId } from "../../../builder/catalogRuntime/paletteInsert";
import { openAdr280Preview } from "./support/adr280Harness";

/**
 * ADR-283 G1 ② — in the Preview (RAC): an origin's rule (Edit → hide Save, `local`) placed twice
 * hides the Save of the instance pressed only (before: the first instance's, `recordsOfSource[0]`).
 */
const BODY = "project:node:home-body" as NodeId;
const CARD = "project:node:card" as NodeId;
const SAVE = "project:node:save" as NodeId;
const EDIT = "project:node:edit" as NodeId;
const SECOND = "project:node:second" as NodeId;

describe("ADR-283 G1 ② — Preview: the pressed instance's Save", () => {
  it("Edit in each instance hides its own Save", async () => {
    const h = await openAdr280Preview([]);
    const library = await buildCodeCatalogLibrary();
    const node = (id: string, type: string, name?: string) =>
      ({
        kind: "node",
        id,
        definitionId: catalogPaletteDefinitionId(library, type),
        children: [],
        props: {},
        visual: {},
        sizing: {},
        descendantOverrides: [],
        ...(name ? { name } : {}),
      }) as unknown as NodeEntry;
    const run = (command: Parameters<typeof h.workspace.execute>[0]) => {
      act(() => {
        h.workspace.execute(command);
      });
      h.flush();
    };
    run(
      insertNodes({
        parent: { kind: "node", id: BODY },
        entries: [node(CARD, "frame")],
        rootIds: [CARD],
        newId: h.workspace.newId,
      }),
    );
    run(
      insertNodes({
        parent: { kind: "node", id: CARD },
        entries: [node(SAVE, "Button", "Save"), node(EDIT, "Button", "Edit")],
        rootIds: [SAVE, EDIT],
        newId: h.workspace.newId,
      }),
    );
    run(
      createComponent({ id: CARD, name: "OrderCard", newId: h.workspace.newId }),
    );
    const graph = h.workspace.runtime.graph;
    const project = graph.getEntry(graph.projectId);
    const definitionId =
      project?.kind === "project" ? project.definitionIds.at(-1)! : "";
    run(
      insertNodes({
        parent: { kind: "node", id: BODY },
        entries: [
          {
            kind: "node",
            id: SECOND,
            definitionId,
            children: [],
            props: {},
            visual: {},
            sizing: {},
            descendantOverrides: [],
          } as unknown as NodeEntry,
        ],
        rootIds: [SECOND],
        newId: h.workspace.newId,
      }),
    );
    const body = graph.getEntry(BODY) as NodeEntry;
    const first = body.children.find(
      (id) =>
        id !== SECOND &&
        (graph.getEntry(id) as NodeEntry).definitionId === definitionId,
    )!;
    h.rule(EDIT, "onPress", {
      opcode: "capability",
      target: { local: { instances: [], templatePath: [CARD, SAVE] } },
      capabilityId: "hide",
    });
    const session = h.session;
    const saveOf = (instance: string) =>
      session.root!.recordsOfSource(SAVE).find((id) => id.includes(instance))!;
    const hidden = (instance: string) =>
      (h.runtime.overrideOf(saveOf(instance))?.style as { display?: string } | undefined)
        ?.display === "none";
    const press = (instance: string) => {
      const edit = session.root!.recordsOfSource(EDIT).find((id) => id.includes(instance))!;
      act(() => {
        fireEvent.click(
          h.view.container.querySelector(`[data-catalog-id="${edit}"]`)!,
        );
      });
    };
    expect(hidden(first) || hidden(SECOND)).toBe(false);
    press(SECOND);
    expect(hidden(SECOND)).toBe(true);
    expect(hidden(first)).toBe(false);
    press(first);
    expect(hidden(first)).toBe(true);
    h.view.unmount();
  });
});
