import { act, fireEvent } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  createComponent,
  insertNodes,
  pushInstanceOverrides,
  resetInstance,
} from "../../../../../../packages/shared/src/catalog/commands";
import type {
  NodeEntry,
  NodeId,
} from "../../../../../../packages/shared/src/catalog/document/types";
import {
  catalogInheritedInteractionsOf,
  catalogInheritedRuleEnabledCommand,
  catalogInteractionsCommand,
  catalogInteractionsOf,
  catalogReplaceInheritedRuleCommand,
} from "../../../builder/catalogRuntime/interactions";
import { openAdr280Preview } from "./support/adr280Harness";
import { CatalogGraph } from "../../../../../../packages/shared/src/catalog/document/graph";
import { buildCodeCatalogLibrary } from "../../../../../../packages/shared/src/catalog/document/codeCatalogLibrary";

/**
 * ADR-281 G3 — an origin's rule in its instances (Decision 4, user decision 2 — the patch field
 * `interactions`): an instance turns it off or replaces it at its position, the panel
 * (`catalogInheritedInteractionsOf`) and the Preview (`recordsOfOwner`) read the same
 * `effectiveInteractionsOf`; ADR-262 push makes a replacement the origin's, Reset all drops both.
 */
const BODY = "project:node:home-body" as NodeId;

afterEach(() => {
  vi.restoreAllMocks();
});

async function twoInstances() {
  const h = await openAdr280Preview(["Button"]);
  const [button] = h.ids as [NodeId];
  h.rule(button, "onPress", { opcode: "toast", message: "origin" });
  const graph = h.workspace.runtime.graph;
  act(() => {
    h.workspace.execute(
      createComponent({
        id: button,
        name: "Pressable",
        newId: h.workspace.newId,
      }),
    );
  });
  const project = graph.getEntry(graph.projectId);
  const definitionId =
    project?.kind === "project" ? project.definitionIds.at(-1)! : "";
  const second = "project:node:second" as NodeId;
  act(() => {
    h.workspace.execute(
      insertNodes({
        parent: { kind: "node", id: BODY },
        entries: [
          {
            kind: "node",
            id: second,
            definitionId,
            children: [],
            props: {},
            visual: {},
            sizing: {},
            descendantOverrides: [],
          } as unknown as NodeEntry,
        ],
        rootIds: [second],
        newId: h.workspace.newId,
      }),
    );
  });
  h.flush();
  const body = graph.getEntry(BODY);
  const [first] =
    body?.kind === "node"
      ? body.children.filter((id) => id !== second && id !== button)
      : [];
  const run = (command: Parameters<typeof h.workspace.execute>[0]) => {
    act(() => {
      h.workspace.execute(command);
    });
    h.flush();
  };
  /** Press the Button an instance draws. */
  const press = (instance: NodeId) => {
    const element = h.view.container.querySelector(
      `button[data-catalog-id*="${instance}"]`,
    );
    act(() => {
      fireEvent.click(element!);
    });
  };
  const toasts = () => h.toasts.splice(0);
  return {
    ...h,
    graph,
    origin: button,
    a: first as NodeId,
    b: second,
    run,
    press,
    toasts,
  };
}

describe("ADR-281 G3 — an instance turns an origin's rule off or replaces it", () => {
  it("the panel shows each instance the rule it runs (RED 1 fixed)", async () => {
    const h = await twoInstances();
    for (const instance of [h.a, h.b])
      expect(
        catalogInheritedInteractionsOf(h.graph, { ownerId: instance }).map(
          (item) => item.status,
        ),
      ).toEqual(["on"]);
    h.view.unmount();
  });

  it("off in one instance: it runs 0 there, the other instance still runs it", async () => {
    const h = await twoInstances();
    const [{ rule }] = catalogInheritedInteractionsOf(h.graph, {
      ownerId: h.a,
    });
    h.run(
      catalogInheritedRuleEnabledCommand({ ownerId: h.a }, rule!.id, false),
    );
    expect(
      catalogInheritedInteractionsOf(h.graph, { ownerId: h.a })[0]?.status,
    ).toBe("off");
    h.press(h.a);
    expect(h.toasts()).toEqual([]);
    h.press(h.b);
    expect(h.toasts()).toEqual(["origin"]);
    // (Turning it back on drops the entry — the instance runs the origin's again.)
    h.run(catalogInheritedRuleEnabledCommand({ ownerId: h.a }, rule!.id, true));
    h.press(h.a);
    expect(h.toasts()).toEqual(["origin"]);
    h.view.unmount();
  });

  it("replaced in one instance: that instance runs its own action, the other the origin's", async () => {
    const h = await twoInstances();
    const owner = { ownerId: h.a };
    const [{ rule }] = catalogInheritedInteractionsOf(h.graph, owner);
    h.run(catalogReplaceInheritedRuleCommand(owner, rule!, h.workspace.newId));
    const [copy] = catalogInteractionsOf(h.graph, owner);
    h.run(
      catalogInteractionsCommand(
        owner,
        [{ ...copy!, actions: [{ opcode: "toast", message: "mine" }] }],
        "Edit",
      ),
    );
    expect(
      typeof catalogInheritedInteractionsOf(h.graph, owner)[0]?.status,
    ).toBe("object");
    h.press(h.a);
    expect(h.toasts()).toEqual(["mine"]);
    h.press(h.b);
    expect(h.toasts()).toEqual(["origin"]);
    h.view.unmount();
  });
});

describe("ADR-281 G3 — ADR-262 push and Reset all cover the rules", () => {
  async function replacedAndOff() {
    const h = await twoInstances();
    const owner = { ownerId: h.a };
    const [{ rule }] = catalogInheritedInteractionsOf(h.graph, owner);
    h.run(catalogReplaceInheritedRuleCommand(owner, rule!, h.workspace.newId));
    const [copy] = catalogInteractionsOf(h.graph, owner);
    h.run(
      catalogInteractionsCommand(
        owner,
        [{ ...copy!, actions: [{ opcode: "toast", message: "mine" }] }],
        "Edit",
      ),
    );
    return { ...h, owner, rule: rule! };
  }

  it("push: the replacement becomes the origin's rule — every instance runs it once", async () => {
    const h = await replacedAndOff();
    h.run(pushInstanceOverrides({ id: h.a, newId: h.workspace.newId }));
    expect(catalogInteractionsOf(h.graph, h.owner)).toEqual([]);
    const origin = h.graph.getEntry(h.rule.id);
    expect(origin?.kind === "interaction" && origin.actions[0]).toEqual({
      opcode: "toast",
      message: "mine",
    });
    h.press(h.a);
    expect(h.toasts()).toEqual(["mine"]);
    h.press(h.b);
    expect(h.toasts()).toEqual(["mine"]);
    h.view.unmount();
  });

  it("push keeps a rule turned off in the instance (not pushed)", async () => {
    const h = await twoInstances();
    const [{ rule }] = catalogInheritedInteractionsOf(h.graph, {
      ownerId: h.a,
    });
    h.run(
      catalogInheritedRuleEnabledCommand({ ownerId: h.a }, rule!.id, false),
    );
    h.run(pushInstanceOverrides({ id: h.a, newId: h.workspace.newId }));
    h.press(h.a);
    expect(h.toasts()).toEqual([]);
    h.press(h.b);
    expect(h.toasts()).toEqual(["origin"]);
    h.view.unmount();
  });

  it("Reset all: the map and the replacement go — the instance runs the origin's rule once", async () => {
    const h = await replacedAndOff();
    h.run(resetInstance({ id: h.a }));
    expect(catalogInteractionsOf(h.graph, h.owner)).toEqual([]);
    expect(catalogInheritedInteractionsOf(h.graph, h.owner)[0]?.status).toBe(
      "on",
    );
    h.press(h.a);
    expect(h.toasts()).toEqual(["origin"]);
    h.view.unmount();
  });
});

describe("ADR-281 G3 — storage (contract 47)", () => {
  it("the map is validated, saved and read back; another value is refused", async () => {
    const h = await twoInstances();
    const [{ rule }] = catalogInheritedInteractionsOf(h.graph, { ownerId: h.a });
    h.run(catalogInheritedRuleEnabledCommand({ ownerId: h.a }, rule!.id, false));
    const library = await buildCodeCatalogLibrary();
    const exported = h.graph.exportDocument();
    expect(exported.libraryContractVersion).toBe(51);
    const reopened = new CatalogGraph(structuredClone(exported), library);
    expect(
      catalogInheritedInteractionsOf(reopened, { ownerId: h.a })[0]?.status,
    ).toBe("off");
    const broken = structuredClone(exported);
    const node = broken.entries[h.a] as NodeEntry;
    (node.descendantOverrides[0] as unknown as Record<string, unknown>).interactions =
      { [rule!.id]: "maybe" };
    expect(() => new CatalogGraph(broken, library)).toThrow();
    h.view.unmount();
  });
});

