import { describe, expect, it } from "vitest";
import { catalogPreviewRules } from "../../../../../../packages/shared/src/catalog/runtime/catalogPreviewInteractions";
import { resolveCapabilityTarget } from "../../../../../../packages/shared/src/catalog/runtime/capabilityTarget";
import { CatalogGraph } from "../../../../../../packages/shared/src/catalog/document/graph";
import {
  createComponent,
  detachInstances,
  dissolveComponent,
  duplicateDefinition,
  insertNodes,
  moveNodes,
  removeTargets,
  swapInstance,
} from "../../../../../../packages/shared/src/catalog/commands";
import { planSwapInstance } from "../../../../../../packages/shared/src/catalog/commands/swap";
import type {
  CatalogCapabilityTarget,
  EntryId,
  InteractionEntry,
  NodeEntry,
  NodeId,
} from "../../../../../../packages/shared/src/catalog/document/types";
import {
  catalogCapabilityTargets,
  catalogInteractionsCommand,
} from "../interactions";
import { createCatalogAiWriteHost } from "../aiHost";
import {
  BODY,
  CARD,
  DELETE,
  EDIT,
  ROW_TEXT,
  SAVE,
  TOGGLE,
  openAdr283Fixture,
} from "./support/adr283Fixture";

type Fixture = Awaited<ReturnType<typeof openAdr283Fixture>>;
const capability = (target: CatalogCapabilityTarget) =>
  ({ opcode: "capability", target, capabilityId: "hide" }) as const;
const ruleOf = (h: Fixture, id: string) =>
  h.graph.getEntry(id as never) as InteractionEntry | undefined;
const targetOf = (h: Fixture, id: string) => {
  const action = ruleOf(h, id)?.action;
  return action?.opcode === "capability" ? action.target : undefined;
};
/** The Preview rule's target record for a firing record (the shared conversion). */
const firedTarget = (h: Fixture, ruleId: string, firing: string) => {
  const rule = catalogPreviewRules(h.graph, h.workspace.root).find(
    (item) => item.id === ruleId && item.elementId === firing,
  );
  return rule && "targetId" in rule.action ? rule.action.targetId : undefined;
};
/** The record of `instanceId` (a page instance) a record is drawn under. */
const instanceRecordOf = (
  h: Fixture,
  recordId: string,
  instanceIds: readonly string[],
) => {
  for (
    let at = h.workspace.root.domInputs.get(recordId);
    at;
    at = h.workspace.root.domInputs.get(at.parentId)
  )
    if (instanceIds.includes(at.sourceId)) return at.id;
  return undefined;
};
const rowRecordOf = (h: Fixture, recordId: string) => {
  for (
    let at = h.workspace.root.domInputs.get(recordId);
    at;
    at = h.workspace.root.domInputs.get(at.parentId)
  )
    if (at.rowIndex !== undefined) return at.id;
  return undefined;
};

describe("ADR-283 G1 — the target as the firing record sees it (Decision 2)", () => {
  it("① rows: each row's Delete hides its own row's sibling Text (another source id)", async () => {
    const h = await openAdr283Fixture();
    const ruleId = h.rule(DELETE, "onPress", capability({ nodeId: ROW_TEXT }));
    const owners = h.recordsOf(DELETE);
    expect(owners.length).toBe(3);
    const targets = owners.map((owner) => firedTarget(h, ruleId, owner.id));
    owners.forEach((owner, index) =>
      expect(targets[index]).toBe(
        h.recordUnder(ROW_TEXT, rowRecordOf(h, owner.id)!)?.id,
      ),
    );
    expect(new Set(targets).size).toBe(3);
  });

  it("② two instances: an origin rule hides the Save of the instance pressed", async () => {
    const h = await openAdr283Fixture();
    const ruleId = h.rule(
      EDIT,
      "onPress",
      capability({ local: { instances: [], templatePath: [CARD, SAVE] } }),
    );
    const instances = [h.first, h.second];
    const owners = h
      .recordsOf(EDIT)
      .filter((owner) => instanceRecordOf(h, owner.id, instances));
    expect(owners.length).toBe(2);
    for (const owner of owners) {
      const target = firedTarget(h, ruleId, owner.id);
      expect(target).toBe(
        h.recordUnder(SAVE, instanceRecordOf(h, owner.id, instances)!)?.id,
      );
    }
    expect(firedTarget(h, ruleId, owners[0]!.id)).not.toBe(
      firedTarget(h, ruleId, owners[1]!.id),
    );
  });

  it("③ a page rule names one instance's Save (`address`) — from anywhere on the page", async () => {
    const h = await openAdr283Fixture();
    const ruleId = h.rule(
      TOGGLE,
      "onPress",
      capability({
        address: { instances: [h.second], templatePath: [CARD, SAVE] },
      }),
    );
    const [toggle] = h.recordsOf(TOGGLE);
    expect(firedTarget(h, ruleId, toggle!.id)).toBe(
      h.recordUnder(SAVE, h.recordsOf(h.second)[0]!.id)?.id,
    );
  });

  it("④ ⑤ an OrderCard instance in the row template ×3: an origin rule (`local`) and a row rule (`address`) take the pressed row's Save (3 candidates → 1)", async () => {
    const h = await openAdr283Fixture();
    const inRow = "project:node:row-card" as NodeId;
    h.workspace.execute(
      insertNodes({
        parent: { kind: "node", id: h.item },
        entries: [
          {
            kind: "node",
            id: inRow,
            definitionId: h.definitionId,
            children: [],
            props: {},
            visual: {},
            sizing: {},
            descendantOverrides: [],
          } as unknown as NodeEntry,
        ],
        rootIds: [inRow],
        newId: h.workspace.newId,
      }),
    );
    const origin = h.rule(
      EDIT,
      "onPress",
      capability({ local: { instances: [], templatePath: [CARD, SAVE] } }),
    );
    const row = h.rule(
      DELETE,
      "onPress",
      capability({
        address: { instances: [inRow], templatePath: [CARD, SAVE] },
      }),
    );
    const rowEdits = h
      .recordsOf(EDIT)
      .filter((owner) => rowRecordOf(h, owner.id));
    expect(rowEdits.length).toBe(3);
    // (The 3 Saves in the rows share the instance path — only the row record tells them apart.)
    const rowSaves = h
      .recordsOf(SAVE)
      .filter((record) => rowRecordOf(h, record.id));
    expect(
      new Set(rowSaves.map((record) => record.instancePath.join("/"))).size,
    ).toBe(1);
    for (const edit of rowEdits) {
      const expected = h.recordUnder(SAVE, rowRecordOf(h, edit.id)!)?.id;
      expect(firedTarget(h, origin, edit.id)).toBe(expected);
    }
    for (const owner of h.recordsOf(DELETE))
      expect(firedTarget(h, row, owner.id)).toBe(
        h.recordUnder(SAVE, rowRecordOf(h, owner.id)!)?.id,
      );
  });

  it("another instance's place names nothing from here (out of context) · unset names nothing", async () => {
    const h = await openAdr283Fixture();
    const [toggle] = h.recordsOf(TOGGLE);
    expect(
      resolveCapabilityTarget(h.workspace.root, toggle!.id, {
        local: { instances: [], templatePath: [CARD, SAVE] },
      }),
    ).toEqual({ error: "TARGET_OUT_OF_CONTEXT" });
    expect(
      resolveCapabilityTarget(h.workspace.root, toggle!.id, { unset: true }),
    ).toEqual({
      error: "TARGET_UNSET",
    });
  });
});

describe("ADR-283 G1 — validation · index (Decisions 1 · 3)", () => {
  it("validates the three shapes and unset; refuses a template node by id and `local` outside a template", async () => {
    const h = await openAdr283Fixture();
    const run = (ownerId: NodeId, target: CatalogCapabilityTarget) => () =>
      h.rule(ownerId, "onPress", capability(target));
    expect(run(TOGGLE, { nodeId: ROW_TEXT })).not.toThrow();
    expect(
      run(TOGGLE, {
        address: { instances: [h.first], templatePath: [CARD, SAVE] },
      }),
    ).not.toThrow();
    expect(run(TOGGLE, { unset: true })).not.toThrow();
    expect(
      run(EDIT, { local: { instances: [], templatePath: [CARD, SAVE] } }),
    ).not.toThrow();
    expect(run(TOGGLE, { nodeId: SAVE })).toThrow(
      expect.objectContaining({ code: "TARGET_IN_TEMPLATE" }),
    );
    expect(
      run(TOGGLE, { local: { instances: [], templatePath: [CARD, SAVE] } }),
    ).toThrow(
      expect.objectContaining({ code: "TARGET_LOCAL_OUTSIDE_TEMPLATE" }),
    );
    expect(
      run(TOGGLE, { address: { instances: [h.first], templatePath: [SAVE] } }),
    ).toThrow(expect.objectContaining({ code: "TEMPLATE_ROOT_MISMATCH" }));
  });

  it("indexes every project id of an address and a local position (a middle step finds the rule)", async () => {
    const h = await openAdr283Fixture();
    const page = h.rule(
      TOGGLE,
      "onPress",
      capability({
        address: { instances: [h.first], templatePath: [CARD, SAVE] },
      }),
    );
    const origin = h.rule(
      EDIT,
      "onPress",
      capability({ local: { instances: [], templatePath: [CARD, SAVE] } }),
    );
    for (const id of [h.first, CARD, SAVE])
      expect(h.graph.referrersOf(id).has(page)).toBe(true);
    for (const id of [CARD, SAVE])
      expect(h.graph.referrersOf(id).has(origin)).toBe(true);
  });
});

describe("ADR-283 G1 — the commands through a target (Decision 3)", () => {
  it("createComponent: a page rule's node target becomes the instance's position · a rule inside becomes `local`", async () => {
    const ids: string[] = [];
    const h = await openAdr283Fixture({
      beforeComponent: (rule) => {
        ids.push(rule(TOGGLE, "onPress", capability({ nodeId: SAVE })));
        ids.push(rule(EDIT, "onPress", capability({ nodeId: SAVE })));
      },
    });
    expect(targetOf(h, ids[0]!)).toEqual({
      address: { instances: [h.first], templatePath: [CARD, SAVE] },
    });
    expect(targetOf(h, ids[1]!)).toEqual({
      local: { instances: [], templatePath: [CARD, SAVE] },
    });
  });

  it("duplicateDefinition: the copy's origin rule targets the copy's Save", async () => {
    const h = await openAdr283Fixture();
    const origin = h.rule(
      EDIT,
      "onPress",
      capability({ local: { instances: [], templatePath: [CARD, SAVE] } }),
    );
    h.workspace.execute(
      duplicateDefinition({
        definitionId: h.definitionId,
        newId: h.workspace.newId,
      }),
    );
    const project = h.graph.getEntry(h.graph.projectId);
    const copyId =
      project?.kind === "project" ? project.definitionIds.at(-1)! : "";
    const copy = h.graph.getEntry(copyId) as { templateRootId: NodeId };
    const root = h.graph.getEntry(copy.templateRootId) as NodeEntry;
    const [copySave, copyEdit] = root.children;
    const copied = [...h.graph.referrersOf(copyEdit!)]
      .map((id) => ruleOf(h, id))
      .find((entry) => entry?.kind === "interaction" && entry.id !== origin);
    expect(copied?.action).toMatchObject({
      target: {
        local: { instances: [], templatePath: [copy.templateRootId, copySave] },
      },
    });
    expect(targetOf(h, origin)).toEqual({
      local: { instances: [], templatePath: [CARD, SAVE] },
    });
  });

  it("detach: a target at the instance's position names the copy · dissolve does the same for every instance", async () => {
    const h = await openAdr283Fixture();
    const page = h.rule(
      TOGGLE,
      "onPress",
      capability({
        address: { instances: [h.first], templatePath: [CARD, SAVE] },
      }),
    );
    const second = h.rule(
      TOGGLE,
      "onFocus",
      capability({
        address: { instances: [h.second], templatePath: [CARD, SAVE] },
      }),
    );
    h.workspace.execute(
      detachInstances({ ids: [h.first], newId: h.workspace.newId }),
    );
    const copy = (targetOf(h, page) as { nodeId: NodeId }).nodeId;
    expect((h.graph.getEntry(copy) as NodeEntry).name).toBe("Save");
    expect(h.graph.getEntry(h.first)).toBeDefined();
    h.workspace.execute(
      dissolveComponent({
        definitionId: h.definitionId,
        newId: h.workspace.newId,
      }),
    );
    const copy2 = targetOf(h, second) as { nodeId: NodeId };
    expect((h.graph.getEntry(copy2.nodeId) as NodeEntry).name).toBe("Save");
  });

  it("delete: removing a step of the target's chain removes the rule (the node delete path)", async () => {
    const h = await openAdr283Fixture();
    const page = h.rule(
      TOGGLE,
      "onPress",
      capability({
        address: { instances: [h.first], templatePath: [CARD, SAVE] },
      }),
    );
    h.workspace.execute(
      removeTargets({
        targets: [{ kind: "node", id: h.first }],
        newId: h.workspace.newId,
      }),
    );
    expect(ruleOf(h, page)).toBeUndefined();
  });

  it("swap to a copy: the target moves by name path · swap to a component without the place: the rule stays unset (saved · reloaded · pointed again · undo/redo)", async () => {
    const h = await openAdr283Fixture();
    const page = h.rule(
      TOGGLE,
      "onPress",
      capability({
        address: { instances: [h.first], templatePath: [CARD, SAVE] },
      }),
    );
    h.workspace.execute(
      duplicateDefinition({
        definitionId: h.definitionId,
        newId: h.workspace.newId,
      }),
    );
    const project = () =>
      h.graph.getEntry(h.graph.projectId) as unknown as {
        definitionIds: EntryId<"definition">[];
      };
    const copyId = project().definitionIds.at(-1)!;
    const copyRoot = (h.graph.getEntry(copyId) as { templateRootId: NodeId })
      .templateRootId;
    const copySave = (h.graph.getEntry(copyRoot) as NodeEntry).children[0]!;
    h.workspace.execute(swapInstance({ id: h.first, definitionId: copyId }));
    expect(targetOf(h, page)).toEqual({
      address: { instances: [h.first], templatePath: [copyRoot, copySave] },
    });
    // A component without a Save.
    const other = "project:node:other" as NodeId;
    h.workspace.execute(
      insertNodes({
        parent: { kind: "node", id: BODY },
        entries: [
          {
            kind: "node",
            id: other,
            definitionId: (h.graph.getEntry(TOGGLE) as NodeEntry).definitionId,
            children: [],
            props: {},
            visual: {},
            sizing: {},
            descendantOverrides: [],
            name: "Lone",
          } as unknown as NodeEntry,
        ],
        rootIds: [other],
        newId: h.workspace.newId,
      }),
    );
    h.workspace.execute(
      createComponent({ id: other, name: "Lone", newId: h.workspace.newId }),
    );
    const loneId = project().definitionIds.at(-1)!;
    const planned = planSwapInstance(h.graph, {
      id: h.first,
      definitionId: loneId,
    });
    expect(planned.report.targetsUnset).toBe(1);
    h.workspace.execute(swapInstance({ id: h.first, definitionId: loneId }));
    expect(targetOf(h, page)).toEqual({ unset: true });
    const reopened = new CatalogGraph(
      structuredClone(h.graph.exportDocument()),
      h.library,
    );
    expect((reopened.getEntry(page) as InteractionEntry).action).toMatchObject({
      target: { unset: true },
    });
    const rule = ruleOf(h, page)!;
    h.workspace.execute(
      catalogInteractionsCommand(
        { ownerId: TOGGLE },
        [{ ...rule, action: capability({ nodeId: ROW_TEXT }) }],
        "Set interaction target",
      ),
    );
    expect(targetOf(h, page)).toEqual({ nodeId: ROW_TEXT });
    h.workspace.undo();
    expect(targetOf(h, page)).toEqual({ unset: true });
    h.workspace.redo();
    expect(targetOf(h, page)).toEqual({ nodeId: ROW_TEXT });
  });

  it("the AI makes a rule whose target is inside an instance (`address`)", async () => {
    const h = await openAdr283Fixture();
    const host = createCatalogAiWriteHost(h.workspace);
    const save = h.recordUnder(SAVE, h.recordsOf(h.first)[0]!.id)!;
    const result = host.addInteraction(h.recordsOf(TOGGLE)[0]!.id, "onPress", {
      kind: "capability",
      targetId: save.id,
      capability: "hide",
    } as never);
    expect(result).toMatchObject({ ok: true });
    expect(targetOf(h, (result as { ruleId: string }).ruleId)).toEqual({
      address: { instances: [h.first], templatePath: [CARD, SAVE] },
    });
  });
});

describe("ADR-283 G2 — the panel's targets (Decision 4)", () => {
  it("lists page nodes and every position inside the page's instances (path labels) · a rule inside a template lists its own places only", async () => {
    const h = await openAdr283Fixture();
    const options = catalogCapabilityTargets(
      h.graph,
      "project:page:home" as never,
      undefined,
      { ownerId: TOGGLE },
    );
    const save = options.find(
      (option) =>
        JSON.stringify(option.ref) ===
        JSON.stringify({
          address: { instances: [h.first], templatePath: [CARD, SAVE] },
        }),
    );
    expect(save?.group).toBe("component");
    expect(save?.path).toEqual(["OrderCard", "Save"]);
    // (`#` in the label = the DOM id: a place inside an instance shows its instance's.)
    const instance = h.graph.getEntry(h.first);
    const instanceHtmlId =
      instance?.kind === "node" ? instance.metadata?.htmlId : undefined;
    expect(instanceHtmlId).toBeTruthy();
    expect(save?.htmlId).toBe(instanceHtmlId);
    expect(
      options.find(
        (option) =>
          JSON.stringify(option.ref) === JSON.stringify({ nodeId: h.first }),
      )?.htmlId,
    ).toBe(instanceHtmlId);
    expect(
      options.some(
        (option) =>
          JSON.stringify(option.ref) === JSON.stringify({ nodeId: TOGGLE }),
      ),
    ).toBe(false);
    const inside = catalogCapabilityTargets(
      h.graph,
      "project:page:home" as never,
      undefined,
      { ownerId: EDIT },
    );
    expect(inside.length).toBeGreaterThan(0);
    expect(inside.every((option) => "local" in option.ref)).toBe(true);
    // (An origin's place renders in every instance: no DOM id of its own.)
    expect(inside.every((option) => option.htmlId === undefined)).toBe(true);
    expect(inside.map((option) => option.ref)).toContainEqual({
      local: { instances: [], templatePath: [CARD, SAVE] },
    });
  });
});

describe("ADR-283 판독 수리 — instance 단계가 있는 `local` · 중첩 instance 의 detach · 추출 · 같은 template 의 id", () => {
  /** OrderCard's template holds an instance of another component 「Inner」 (a Button 「BSave」). */
  async function nested() {
    const h = await openAdr283Fixture();
    const library = h.library;
    const inner = "project:node:inner" as NodeId;
    const bsave = "project:node:bsave" as NodeId;
    const button = (id: string, name: string) =>
      ({
        kind: "node",
        id,
        definitionId: (h.graph.getEntry(TOGGLE) as NodeEntry).definitionId,
        children: [],
        props: {},
        visual: {},
        sizing: {},
        descendantOverrides: [],
        name,
      }) as unknown as NodeEntry;
    h.workspace.execute(
      insertNodes({
        parent: { kind: "node", id: BODY },
        entries: [
          {
            ...button(inner, "Inner"),
            definitionId: (h.graph.getEntry(CARD) as NodeEntry).definitionId,
          } as NodeEntry,
        ],
        rootIds: [inner],
        newId: h.workspace.newId,
      }),
    );
    h.workspace.execute(
      insertNodes({
        parent: { kind: "node", id: inner },
        entries: [button(bsave, "BSave")],
        rootIds: [bsave],
        newId: h.workspace.newId,
      }),
    );
    h.workspace.execute(
      createComponent({ id: inner, name: "Inner", newId: h.workspace.newId }),
    );
    const project = h.graph.getEntry(h.graph.projectId) as unknown as {
      definitionIds: string[];
    };
    const innerDef = project.definitionIds.at(-1)!;
    // The nested instance N inside OrderCard's template.
    const n = "project:node:nested" as NodeId;
    h.workspace.execute(
      insertNodes({
        parent: { kind: "node", id: CARD },
        entries: [{ ...button(n, "N"), definitionId: innerDef } as NodeEntry],
        rootIds: [n],
        newId: h.workspace.newId,
      }),
    );
    void library;
    return { ...h, inner, bsave, n };
  }

  it("HIGH-1: an origin rule's `local` through a nested instance takes the pressed instance's place", async () => {
    const h = await nested();
    const ruleId = h.rule(
      EDIT,
      "onPress",
      capability({
        local: { instances: [h.n], templatePath: [h.inner, h.bsave] },
      }),
    );
    const instances = [h.first, h.second];
    const owners = h
      .recordsOf(EDIT)
      .filter((owner) => instanceRecordOf(h, owner.id, instances));
    expect(owners.length).toBe(2);
    for (const owner of owners)
      expect(firedTarget(h, ruleId, owner.id)).toBe(
        h.recordUnder(h.bsave, instanceRecordOf(h, owner.id, instances)!)?.id,
      );
    // (The panel offers it.)
    expect(
      catalogCapabilityTargets(
        h.graph,
        "project:page:home" as never,
        undefined,
        { ownerId: EDIT },
      ).map((option) => JSON.stringify(option.ref)),
    ).toContain(
      JSON.stringify({
        local: { instances: [h.n], templatePath: [h.inner, h.bsave] },
      }),
    );
  });

  it("MEDIUM-1: detaching the nested instance moves the `local` onto its copy (still the pressed instance's)", async () => {
    const h = await nested();
    const ruleId = h.rule(
      EDIT,
      "onPress",
      capability({
        local: { instances: [h.n], templatePath: [h.inner, h.bsave] },
      }),
    );
    h.workspace.execute(
      detachInstances({ ids: [h.n], newId: h.workspace.newId }),
    );
    const target = targetOf(h, ruleId) as {
      local: { instances: string[]; templatePath: string[] };
    };
    expect(target.local.instances).toEqual([]);
    expect(target.local.templatePath.slice(0, 2)).toEqual([CARD, h.n]);
    const copy = target.local.templatePath.at(-1)!;
    expect((h.graph.getEntry(copy) as NodeEntry).name).toBe("BSave");
    const instances = [h.first, h.second];
    for (const owner of h
      .recordsOf(EDIT)
      .filter((item) => instanceRecordOf(h, item.id, instances)))
      expect(firedTarget(h, ruleId, owner.id)).toBe(
        h.recordUnder(copy, instanceRecordOf(h, owner.id, instances)!)?.id,
      );
  });

  it("MEDIUM-2: making a component of a node with a nested instance step keeps the targets (page and origin rules)", async () => {
    const h = await openAdr283Fixture();
    const buttonDef = (h.graph.getEntry(SAVE) as NodeEntry).definitionId;
    const lib = h.library.definitions.get(buttonDef as never) as {
      templateRootId: string;
    };
    const root = lib.templateRootId;
    const icon = (
      h.library.templates.get(root as never) as unknown as {
        children: string[];
      }
    ).children[0]!;
    const page = h.rule(
      TOGGLE,
      "onPress",
      capability({
        address: {
          instances: [h.first, SAVE],
          templatePath: [root, icon],
        } as never,
      }),
    );
    const origin = h.rule(
      EDIT,
      "onPress",
      capability({
        local: { instances: [SAVE], templatePath: [root, icon] } as never,
      }),
    );
    // Save (inside OrderCard's template) made a component: J stands where it stood.
    h.workspace.execute(
      createComponent({ id: SAVE, name: "SaveBox", newId: h.workspace.newId }),
    );
    const card = h.graph.getEntry(CARD) as NodeEntry;
    const j = card.children.find((id) => id !== EDIT)!;
    expect(targetOf(h, page)).toEqual({
      address: { instances: [h.first, j, SAVE], templatePath: [root, icon] },
    });
    expect(targetOf(h, origin)).toEqual({
      local: { instances: [j, SAVE], templatePath: [root, icon] },
    });
  });

  it("MEDIUM-2 (page): a frame holding a Button instance made a component — rules into the Button's part follow", async () => {
    const ids: string[] = [];
    let path: string[] = [];
    const h = await openAdr283Fixture({
      beforeComponent: (rule, library) => {
        const buttonDef = [...library.definitions.values()].find(
          (definition) =>
            definition.id === "lib:definition:origin-component-button",
        ) as unknown as { templateRootId: string } | undefined;
        const root = buttonDef!.templateRootId;
        const icon = (
          library.templates.get(root as never) as unknown as {
            children: string[];
          }
        ).children[0]!;
        path = [root, icon];
        ids.push(
          rule(
            TOGGLE,
            "onPress",
            capability({
              address: { instances: [SAVE], templatePath: path } as never,
            }),
          ),
        );
        ids.push(
          rule(
            EDIT,
            "onPress",
            capability({
              address: { instances: [SAVE], templatePath: path } as never,
            }),
          ),
        );
      },
    });
    expect(targetOf(h, ids[0]!)).toEqual({
      address: { instances: [h.first, SAVE], templatePath: path },
    });
    expect(targetOf(h, ids[1]!)).toEqual({
      local: { instances: [SAVE], templatePath: path },
    });
  });

  it("MEDIUM-3: a subtree whose rule names its own node by id moves into a template — the rule targets the pressed instance's node", async () => {
    const h = await openAdr283Fixture();
    const frame = "project:node:pasted" as NodeId;
    const p = "project:node:p" as NodeId;
    const q = "project:node:q" as NodeId;
    const node = (id: NodeId, from: NodeId, name: string) =>
      ({
        kind: "node",
        id,
        definitionId: (h.graph.getEntry(from) as NodeEntry).definitionId,
        children: [],
        props: {},
        visual: {},
        sizing: {},
        descendantOverrides: [],
        name,
      }) as unknown as NodeEntry;
    h.workspace.execute(
      insertNodes({
        parent: { kind: "node", id: BODY },
        entries: [node(frame, BODY, "Box")],
        rootIds: [frame],
        newId: h.workspace.newId,
      }),
    );
    h.workspace.execute(
      insertNodes({
        parent: { kind: "node", id: frame },
        entries: [node(p, TOGGLE, "P"), node(q, TOGGLE, "Q")],
        rootIds: [p, q],
        newId: h.workspace.newId,
      }),
    );
    const ruleId = h.rule(p, "onPress", capability({ nodeId: q }));
    h.workspace.execute(
      moveNodes({
        ids: [frame],
        parent: { kind: "node", id: CARD },
        newId: h.workspace.newId,
      }),
    );
    expect(targetOf(h, ruleId)).toEqual({ nodeId: q });
    const instances = [h.first, h.second];
    const owners = h
      .recordsOf(p)
      .filter((owner) => instanceRecordOf(h, owner.id, instances));
    expect(owners.length).toBe(2);
    for (const owner of owners)
      expect(firedTarget(h, ruleId, owner.id)).toBe(
        h.recordUnder(q, instanceRecordOf(h, owner.id, instances)!)?.id,
      );
  });
});
