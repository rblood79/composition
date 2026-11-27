// @vitest-environment jsdom
import "fake-indexeddb/auto";
import { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, describe, expect, it } from "vitest";
import {
  duplicateNodes,
  groupNodes,
  insertNodes,
  moveNodes,
  removeTargets,
  setFields,
} from "../../../../../../packages/shared/src/catalog/commands";
import { buildCodeCatalogLibrary } from "../../../../../../packages/shared/src/catalog/document/codeCatalogLibrary";
import { CatalogGraph } from "../../../../../../packages/shared/src/catalog/document/graph";
import type {
  EntryId,
  NodeId,
} from "../../../../../../packages/shared/src/catalog/document/types";
import { renderCatalogDom } from "../domBinding";
import { catalogItemInsertChoices } from "../itemInsert";
import { catalogPaletteDefinitionId } from "../paletteInsert";
import { newCatalogProjectDocument } from "../project";
import { catalogItemKeyRenameCommands } from "../singleSelection";
import { CatalogStorage } from "../storage";
import { CatalogWorkspace } from "../workspace";
import { nodeLayoutEngine } from "./support/nodeLayoutEngine";
import { getPaletteItems } from "../../panels/components/paletteItems";

/**
 * ADR-321 G3 — a Stepper (사용자 결정 2 「넣는다」 · 자리 「감싸는 새 type」, 2026-11-27) through the real
 * composition root: `Stepper > StepList + StepPanel…`, each panel paired with its Step by key; only
 * the current step's panel is drawn (Canvas `hidden`, DOM element). The pair commands — the Design
 * 「+」, delete, duplicate, reorder, a key rename — keep the pairs, and undo brings each back.
 * Expected values are written out by hand.
 */
const BODY = "project:node:home-body" as NodeId;
const PLACED = "project:node:placed" as NodeId;

async function place(type = "Stepper") {
  const library = await buildCodeCatalogLibrary();
  const workspace = new CatalogWorkspace(
    new CatalogGraph(
      newCatalogProjectDocument({
        projectId: "project:project:adr321-g3" as EntryId<"project">,
        name: "ADR-321 G3",
      }),
      library,
    ),
    new CatalogStorage(indexedDB, `adr321-g3-${Math.random()}`),
    {
      engine: await nodeLayoutEngine(),
      viewport: { width: 1920, height: 1080 },
      autosaveSchedule: () => {},
    },
  );
  workspace.execute(
    insertNodes({
      parent: { kind: "node", id: BODY },
      entries: [
        {
          kind: "node",
          id: PLACED,
          definitionId: catalogPaletteDefinitionId(library, type),
          children: [],
          props: {},
          visual: { width: { kind: "set", value: 600 } } as never,
          sizing: {},
          descendantOverrides: [],
        },
      ],
      rootIds: [PLACED],
      newId: workspace.newId,
    }),
  );
  const root = workspace.root;
  const record = (id: string) => root.canvasInputs.get(id)!;
  const stepper = () =>
    [...root.canvasInputs.values()].find((r) => r.sourceId === PLACED)!;
  const typeOf = (id: string) => root.typeOf(record(id));
  const list = () =>
    type === "Stepper"
      ? record(stepper().children.find((id) => typeOf(id) === "StepList")!)
      : stepper();
  const steps = () => list().children.map(record);
  const panels = () =>
    stepper()
      .children.filter((id) => typeOf(id) === "StepPanel")
      .map(record);
  /** Each panel as `<itemId>` (drawn) or `(<itemId>)` (hidden), in order. */
  const shown = () =>
    panels()
      .map((panel) =>
        panel.hidden
          ? `(${String(panel.props.itemId)})`
          : String(panel.props.itemId),
      )
      .join(" ");
  const stepKeys = () => steps().map((step) => String(step.props.id));
  const target = (id: string) => workspace.itemOfRecord(id)!.target;
  const write = (id: string, props: Record<string, unknown>) =>
    workspace.execute(
      setFields({
        targets: [target(id)],
        props: Object.fromEntries(
          Object.entries(props).map(([k, v]) => [k, { kind: "set", value: v }]),
        ) as never,
      }),
    );
  return {
    workspace,
    root,
    stepper,
    list,
    steps,
    panels,
    shown,
    stepKeys,
    target,
    write,
  };
}

let unmount: (() => Promise<void>) | undefined;
afterEach(async () => {
  await unmount?.();
  unmount = undefined;
  document.body.innerHTML = "";
});

async function dom(t: Awaited<ReturnType<typeof place>>) {
  await unmount?.();
  const host = document.createElement("div");
  document.body.append(host);
  const react = createRoot(host);
  await act(async () => react.render(renderCatalogDom(t.root, t.stepper().id)));
  unmount = async () => act(async () => react.unmount());
  return host;
}

describe("ADR-321 G3 — Stepper · StepPanel (결정 2)", () => {
  it("the palette offers the Stepper beside the StepList", () => {
    const types = getPaletteItems().map((item) => item.type);
    expect(types.indexOf("Stepper")).toBe(types.indexOf("StepList") + 1);
  });

  it("the origin: Stepper > StepList (three Steps) + three StepPanels keyed step-1 · 2 · 3 — only the current one's drawn", async () => {
    const t = await place();
    expect(t.stepKeys()).toEqual(["step-1", "step-2", "step-3"]);
    expect(t.shown()).toBe("step-1 (step-2) (step-3)");
    // (The panel's content Text is its own node.)
    const content = t.root.canvasInputs.get(t.panels()[0]!.children[0]!)!;
    expect(content.props.children).toBe("Step 1 content");
  });

  it("the list's current step decides the drawn panel — and undo brings the earlier one back", async () => {
    const t = await place();
    t.write(t.list().id, { defaultSelectedKey: "step-3" });
    expect(t.shown()).toBe("(step-1) (step-2) step-3");
    // A completed list past the chosen step (the state rule) — the current is still the key given.
    t.write(t.list().id, { defaultLastCompletedStep: "step-1" });
    expect(t.shown()).toBe("(step-1) (step-2) step-3");
    t.workspace.undo();
    t.workspace.undo();
    expect(t.shown()).toBe("step-1 (step-2) (step-3)");
  });

  it("a Step's own edit is judged again: without a key, the first enabled step is current — its panel is drawn", async () => {
    const t = await place();
    t.write(t.list().id, { defaultSelectedKey: "" });
    expect(t.shown()).toBe("step-1 (step-2) (step-3)");
    t.write(t.steps()[0]!.id, { isDisabled: true });
    expect(t.shown()).toBe("(step-1) step-2 (step-3)");
    t.workspace.undo();
    expect(t.shown()).toBe("step-1 (step-2) (step-3)");
  });

  it("the Design 「+」 on the list adds a Step and its StepPanel with one key, in one step", async () => {
    const t = await place();
    const choices = catalogItemInsertChoices(
      {
        graph: t.workspace.runtime.graph,
        readModel: t.workspace.readModel,
        newId: t.workspace.newId,
      },
      t.workspace.positionOfRecord(t.list().id)!,
    );
    expect(choices.map((choice) => choice.type)).toEqual(["Step"]);
    t.workspace.execute(choices[0]!.build());
    const key = t.stepKeys()[3]!;
    expect(t.stepKeys()).toHaveLength(4);
    expect(t.panels().map((panel) => panel.props.itemId)).toEqual([
      "step-1",
      "step-2",
      "step-3",
      key,
    ]);
    expect(t.shown()).toBe(`step-1 (step-2) (step-3) (${key})`);
    t.write(t.list().id, { defaultSelectedKey: key });
    expect(t.shown()).toBe(`(step-1) (step-2) (step-3) ${key}`);
    t.workspace.undo();
    t.workspace.undo();
    expect(t.stepKeys()).toEqual(["step-1", "step-2", "step-3"]);
    expect(t.panels()).toHaveLength(3);
  });

  it("a StepList outside a Stepper still takes a Step from 「+」 (no panel)", async () => {
    const t = await place("StepList");
    const choices = catalogItemInsertChoices(
      {
        graph: t.workspace.runtime.graph,
        readModel: t.workspace.readModel,
        newId: t.workspace.newId,
      },
      t.workspace.positionOfRecord(t.list().id)!,
    );
    t.workspace.execute(choices[0]!.build());
    expect(t.stepKeys()).toHaveLength(4);
    expect(t.panels()).toEqual([]);
  });

  it("deleting a Step deletes its StepPanel (one step, one undo)", async () => {
    const t = await place();
    t.workspace.execute(
      removeTargets({ targets: [t.target(t.steps()[1]!.id)] }),
    );
    expect(t.stepKeys()).toEqual(["step-1", "step-3"]);
    expect(t.panels().map((panel) => panel.props.itemId)).toEqual([
      "step-1",
      "step-3",
    ]);
    t.workspace.undo();
    expect(t.stepKeys()).toEqual(["step-1", "step-2", "step-3"]);
    expect(t.panels().map((panel) => panel.props.itemId)).toEqual([
      "step-1",
      "step-2",
      "step-3",
    ]);
  });

  it("duplicating a Step copies its StepPanel with the copy's new key", async () => {
    const t = await place();
    const source = t.workspace.itemOfRecord(t.steps()[0]!.id)!.target;
    expect(source.kind).toBe("node");
    t.workspace.execute(
      duplicateNodes({
        ids: [(source as { id: NodeId }).id],
        newId: t.workspace.newId,
      }),
    );
    const keys = t.stepKeys();
    expect(keys).toHaveLength(4);
    expect(keys[1]).not.toBe("step-1");
    expect(t.panels().map((panel) => panel.props.itemId)).toEqual([
      "step-1",
      keys[1],
      "step-2",
      "step-3",
    ]);
    // (The copy's panel takes the source panel's content.)
    const copyPanel = t.panels()[1]!;
    expect(
      t.root.canvasInputs.get(copyPanel.children[0]!)!.props.children,
    ).toBe("Step 1 content");
    t.workspace.undo();
    expect(t.stepKeys()).toEqual(["step-1", "step-2", "step-3"]);
    expect(t.panels()).toHaveLength(3);
  });

  it("reordering the Steps keeps each panel with its Step (the pairing is the key)", async () => {
    const t = await place();
    const last = t.workspace.itemOfRecord(t.steps()[2]!.id)!.target as {
      id: NodeId;
    };
    const listNode = t.workspace.itemOfRecord(t.list().id)!.target as {
      id: NodeId;
    };
    t.workspace.execute(
      moveNodes({
        ids: [last.id],
        parent: { kind: "node", id: listNode.id },
        index: 0,
        newId: t.workspace.newId,
      }),
    );
    expect(t.stepKeys()).toEqual(["step-3", "step-1", "step-2"]);
    // The current step is still step-1 (its key) — its panel is the one drawn.
    expect(t.shown()).toBe("step-1 (step-2) (step-3)");
    t.write(t.list().id, { defaultSelectedKey: "step-3" });
    expect(t.shown()).toBe("(step-1) (step-2) step-3");
    t.workspace.undo();
    t.workspace.undo();
    expect(t.stepKeys()).toEqual(["step-1", "step-2", "step-3"]);
  });

  it("renaming a Step's key renames its panel's `itemId` in the same step", async () => {
    const t = await place();
    // (The Properties panel's edit: the item's own key, then the keys that name it — one edit.)
    const follow = catalogItemKeyRenameCommands(
      t.workspace,
      t.steps()[0]!.id,
      "intro",
    );
    t.write(t.steps()[0]!.id, { id: "intro" });
    for (const command of follow) t.workspace.execute(command);
    expect(t.stepKeys()).toEqual(["intro", "step-2", "step-3"]);
    expect(t.panels().map((panel) => panel.props.itemId)).toEqual([
      "intro",
      "step-2",
      "step-3",
    ]);
    // The list's current key followed too — the renamed step's panel is still the drawn one.
    expect(t.list().props.defaultSelectedKey).toBe("intro");
    expect(t.shown()).toBe("intro (step-2) (step-3)");
  });

  it("the DOM: a role-less Stepper box — the list's RAC Group, then the current step's panel only (outside the group)", async () => {
    const t = await place();
    const host = await dom(t);
    const box = host.firstElementChild as HTMLElement;
    expect(box.tagName).toBe("DIV");
    expect(box.getAttribute("role")).toBeNull();
    const kids = [...box.children] as HTMLElement[];
    expect(kids.map((kid) => kid.getAttribute("role"))).toEqual([
      "group",
      null,
    ]);
    expect(kids[1]!.textContent).toBe("Step 1 content");
    expect(kids[0]!.contains(kids[1]!)).toBe(false);
    t.write(t.list().id, { defaultSelectedKey: "step-2" });
    const again = await dom(t);
    expect(
      [...again.firstElementChild!.children].map((kid) => kid.textContent),
    ).toContain("Step 2 content");
    expect(again.textContent).not.toContain("Step 1 content");
  });

  it.each(["panel", "stepper"] as const)(
    "별도 목록(%s)의 step-2를 삭제하면 바깥 세 패널이 보존된다",
    async (parent) => {
      const t = await place();
      const id = t.workspace.newId("node");
      t.workspace.execute(
        insertNodes({
          parent: t.target(
            parent === "panel" ? t.panels()[0]!.id : t.stepper().id,
          ),
          entries: [
            {
              kind: "node",
              id,
              definitionId: catalogPaletteDefinitionId(
                t.workspace.runtime.graph.library,
                "StepList",
              ),
              children: [],
              props: {},
              visual: {},
              sizing: {},
              descendantOverrides: [],
            },
          ],
          rootIds: [id],
          newId: t.workspace.newId,
        }),
      );
      const inner = [...t.root.canvasInputs.values()].find(
        (r) => r.sourceId === id,
      )!;
      const second = t.root.canvasInputs.get(inner.children[1]!)!;
      expect(second.props.id).toBe("step-2");
      t.workspace.execute(removeTargets({ targets: [t.target(second.id)] }));
      expect(t.stepKeys()).toEqual(["step-1", "step-2", "step-3"]);
      const outerKeys = ["step-1", "step-2", "step-3"];
      expect(t.panels().map((panel) => panel.props.itemId)).toEqual(outerKeys);
      t.workspace.undo();
      expect(t.root.canvasInputs.get(inner.id)!.children).toHaveLength(3);
      t.workspace.redo();
      expect(t.root.canvasInputs.get(inner.id)!.children).toHaveLength(2);
      expect(t.panels().map((panel) => panel.props.itemId)).toEqual(outerKeys);
    },
  );

  it("목록을 Frame으로 묶은 뒤 +로 단계 추가", async () => {
    const t = await place();
    const listId = (t.target(t.list().id) as { id: NodeId }).id;
    const frame = t.workspace.newId("node");
    t.workspace.execute(
      groupNodes({
        ids: [listId],
        group: {
          kind: "node",
          id: frame,
          definitionId: "lib:definition:type-frame",
          children: [],
          props: {},
          visual: {},
          sizing: {},
          descendantOverrides: [],
        },
        newId: t.workspace.newId,
      }),
    );
    const list = () =>
      [...t.root.canvasInputs.values()].find((r) => r.sourceId === listId)!;
    expect(t.root.typeOf(t.root.canvasInputs.get(list().parentId)!)).toBe(
      "frame",
    );
    const choices = catalogItemInsertChoices(
      {
        graph: t.workspace.runtime.graph,
        readModel: t.workspace.readModel,
        newId: t.workspace.newId,
      },
      t.workspace.positionOfRecord(list().id)!,
    );
    t.workspace.execute(choices[0]!.build());
    expect(list().children).toHaveLength(4);
    const added = t.root.canvasInputs.get(list().children[3]!)!;
    expect(t.panels().map((panel) => panel.props.itemId)).toEqual([
      "step-1",
      "step-2",
      "step-3",
      added.props.id,
    ]);
    t.write(list().id, { defaultSelectedKey: added.props.id });
    expect(
      t
        .panels()
        .filter((panel) => !panel.hidden)
        .map((panel) => panel.props.itemId),
    ).toEqual([added.props.id]);
    t.workspace.undo();
    t.workspace.undo();
    expect(list().children).toHaveLength(3);
    expect(t.panels()).toHaveLength(3);

    const first = list().children[0]!;
    const rename = catalogItemKeyRenameCommands(t.workspace, first, "intro");
    t.write(first, { id: "intro" });
    for (const command of rename) t.workspace.execute(command);
    expect(t.shown()).toBe("intro (step-2) (step-3)");
  });
});
