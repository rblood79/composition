import "fake-indexeddb/auto";
import { describe, expect, it } from "vitest";
import { CatalogGraph } from "../../../../../../packages/shared/src/catalog/document/graph";
import { buildCodeCatalogLibrary } from "../../../../../../packages/shared/src/catalog/document/codeCatalogLibrary";
import type {
  EntryId,
  NodeEntry,
  NodeId,
} from "../../../../../../packages/shared/src/catalog/document/types";
import {
  insertNodes,
  setFields,
} from "../../../../../../packages/shared/src/catalog/commands";
import {
  catalogComponentCommands,
  catalogComponentState,
} from "../componentActions";
import {
  confirmCatalogDetach,
  confirmCatalogDissolve,
  watchCatalogComponentEdits,
  type CatalogComponentConfirm,
} from "../componentConfirm";
import { catalogNewLayoutCommand, catalogDefinitionList } from "../layouts";
import { catalogPageCommands } from "../pageSettings";
import { newCatalogProjectDocument } from "../project";
import { CatalogStorage } from "../storage";
import { CatalogWorkspace } from "../workspace";
import { nodeLayoutEngine } from "./support/nodeLayoutEngine";

/**
 * ADR-248 4e component confirmations (the old EditingSemanticsImpactDialog): detach and dissolve
 * ask first; the first template edit in a component's edit view asks once per component and
 * instance set, and Cancel takes it back.
 */
const BODY = "project:node:home-body" as NodeId;
const id = (name: string) => `project:node:${name}` as NodeId;
const heading = (name: string, text: string): NodeEntry => ({
  kind: "node",
  id: id(name),
  definitionId: "lib:definition:heading",
  children: [],
  props: { children: { kind: "set", value: text } },
  visual: {},
  sizing: {},
  descendantOverrides: [],
});

/** A confirm stub: answers queued in order, requests recorded. */
function stub(...answers: boolean[]) {
  const requests: { kind: string; count?: number; label?: string }[] = [];
  const confirm: CatalogComponentConfirm = {
    detach: (request) => {
      requests.push({ kind: "detach", label: request.instanceLabel });
      return Promise.resolve(answers.shift() ?? false);
    },
    impact: (request) => {
      requests.push({
        kind: "impact",
        count: request.instanceCount,
        label: request.originLabel,
      });
      return Promise.resolve(answers.shift() ?? false);
    },
  };
  return { confirm, requests };
}
const flush = () => new Promise((resolve) => setTimeout(resolve, 0));

async function open() {
  const workspace = new CatalogWorkspace(
    new CatalogGraph(
      newCatalogProjectDocument({
        projectId: "project:project:confirm" as EntryId<"project">,
        name: "Confirm",
      }),
      await buildCodeCatalogLibrary(),
    ),
    new CatalogStorage(indexedDB, `adr248-4e-confirm-${Math.random()}`),
    {
      engine: await nodeLayoutEngine(),
      viewport: { width: 1920, height: 1080 },
      autosaveSchedule: () => {},
    },
  );
  workspace.execute(
    insertNodes({
      parent: { kind: "node", id: BODY },
      entries: [heading("title", "Hello")],
      rootIds: [id("title")],
      newId: workspace.newId,
    }),
  );
  const { plan } = workspace.execute(
    catalogComponentCommands.create(id("title"), "Title", workspace.newId),
  );
  const instance = plan.selectAfter![0] as NodeId;
  const definitionId = catalogComponentState(workspace.runtime.graph, instance)
    .instanceOf!.definitionId as EntryId<"definition">;
  const text = () => {
    const node = workspace.runtime.graph.getEntry(id("title"));
    return node?.kind === "node"
      ? (node.props.children as { value?: unknown } | undefined)?.value
      : undefined;
  };
  const edit = (value: string) =>
    workspace.execute(
      setFields({
        targets: [{ kind: "node", id: id("title") }],
        props: { children: { kind: "set", value } },
      }),
    );
  return { workspace, instance, definitionId, text, edit };
}

describe("ADR-248 4e component confirmations", () => {
  it("the first template edit in a component view asks; Cancel undoes it, Continue keeps later edits quiet", async () => {
    const { workspace, definitionId, text, edit } = await open();
    const { confirm, requests } = stub(false, true);
    const stop = watchCatalogComponentEdits(workspace, confirm);
    // On the page: no question.
    edit("On page");
    await flush();
    expect(requests).toEqual([]);

    workspace.showDefinition(definitionId);
    // An edit outside the template (the page body) asks nothing.
    workspace.execute(
      setFields({
        targets: [{ kind: "node", id: BODY }],
        visual: { opacity: { kind: "set", value: 0.9 } },
      }),
    );
    await flush();
    expect(requests).toEqual([]);
    const depth = workspace.runtime.historyDepth.undo;
    edit("Cancelled");
    await flush();
    expect(requests).toEqual([{ kind: "impact", count: 1, label: "Title" }]);
    expect(text()).toBe("On page");
    expect(workspace.runtime.historyDepth.undo).toBe(depth);
    // Still in the view.
    expect(workspace.session.getSnapshot().definitionView).toBe(definitionId);

    edit("Kept");
    await flush();
    expect(requests).toHaveLength(2);
    expect(text()).toBe("Kept");
    edit("Again");
    await flush();
    expect(requests).toHaveLength(2);
    expect(text()).toBe("Again");
    stop();
    workspace.dispose();
  });

  // 2026-10-05 감사 L10 — 대화상자가 열린 동안 바깥 효과만 있는 항목 (데이터 편집) 이 끼어도
  // Cancel 은 그 아래의 템플릿 편집까지 되돌린다 (undo 반환값이 없다고 멈추지 않는다).
  it("Cancel undoes past an outside-only entry recorded while the dialog was open", async () => {
    const { workspace, definitionId, text, edit } = await open();
    let answer: (ok: boolean) => void = () => {};
    const confirm: CatalogComponentConfirm = {
      detach: () => Promise.resolve(false),
      impact: () =>
        new Promise<boolean>((resolve) => {
          answer = resolve;
        }),
    };
    const stop = watchCatalogComponentEdits(workspace, confirm);
    workspace.showDefinition(definitionId);
    const depth = workspace.runtime.historyDepth.undo;
    edit("Cancelled");
    let undone = 0;
    workspace.recordExternal("Edit data", {
      undo: () => {
        undone += 1;
      },
      redo: () => {},
    });
    answer(false);
    await flush();
    expect(undone).toBe(1);
    expect(text()).toBe("Hello");
    expect(workspace.runtime.historyDepth.undo).toBe(depth);
    stop();
    workspace.dispose();
  });

  it("a component without instances and a layout view do not ask", async () => {
    const { workspace, definitionId, instance, edit } = await open();
    const { confirm, requests } = stub(true);
    const stop = watchCatalogComponentEdits(workspace, confirm);
    workspace.execute(catalogNewLayoutCommand("Shell", workspace.newId));
    const layout = catalogDefinitionList(workspace.runtime.graph, "layout")[0]!;
    // The layout has an instance: a page uses it.
    const project = workspace.runtime.graph.getEntry(
      workspace.runtime.graph.projectId,
    );
    const pageId = project?.kind === "project" ? project.pageIds[0]! : "";
    workspace.execute(
      catalogPageCommands.layout(pageId as never, layout.id, workspace.newId),
    );
    expect(workspace.runtime.graph.instancesOf(layout.id).size).toBe(1);
    workspace.showDefinition(layout.id);
    const definition = workspace.runtime.graph.getEntry(layout.id);
    const root =
      definition?.kind === "definition" ? definition.templateRootId! : "";
    workspace.execute(
      setFields({
        targets: [{ kind: "node", id: root as NodeId }],
        visual: { opacity: { kind: "set", value: 0.5 } },
      }),
    );
    await flush();
    expect(requests).toEqual([]);
    // Detach the only instance: the component's view asks no more.
    workspace.showDefinition(undefined);
    workspace.execute(
      catalogComponentCommands.detach(instance, workspace.newId),
    );
    workspace.showDefinition(definitionId);
    edit("No instances");
    await flush();
    expect(requests).toEqual([]);
    stop();
    workspace.dispose();
  });

  it("detach and dissolve run only after the user confirms", async () => {
    const { workspace, instance, definitionId } = await open();
    const graph = workspace.runtime.graph;
    const { confirm, requests } = stub(false, true, false);
    const detach = () =>
      workspace.execute(
        catalogComponentCommands.detach(instance, workspace.newId),
      );
    expect(await confirmCatalogDetach(graph, instance, detach, confirm)).toBe(
      false,
    );
    expect(catalogComponentState(graph, instance).instanceOf).toBeDefined();
    expect(
      await confirmCatalogDissolve(
        graph,
        definitionId,
        () => {
          workspace.execute(
            catalogComponentCommands.dissolve(definitionId, workspace.newId),
          );
        },
        confirm,
      ),
    ).toBe(true);
    expect(graph.getEntry(definitionId)).toBeUndefined();
    expect(requests).toEqual([
      { kind: "detach", label: "Title" },
      { kind: "impact", count: 1, label: "Title" },
    ]);
    workspace.dispose();
  });
});
