import { act, fireEvent } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { exposedCapabilities } from "@composition/shared";
import {
  createComponent,
  insertNodes,
} from "../../../../../../packages/shared/src/catalog/commands";
import type {
  DataEndpointId,
  NodeEntry,
  NodeId,
} from "../../../../../../packages/shared/src/catalog/document/types";
import { catalogPreviewRules } from "../../../../../../packages/shared/src/catalog/runtime/catalogPreviewInteractions";
import { catalogInheritedInteractionsOf } from "../../../builder/catalogRuntime/interactions";
import { openAdr280Preview } from "./support/adr280Harness";

/**
 * ADR-281 Phase 0 (G0) — the defects the ADR fixes, reproduced on the whole Preview path before
 * any fix. Each `it.fails` states the behavior a later Phase must reach: it fails today and turns
 * into a failing test the moment the defect is fixed, so that Phase flips it to `it`.
 * Measurement: jsdom + the Builder workspace → channel → Preview session (synthetic fixture —
 * "does the rule reach RAC" only).
 */
const BODY = "project:node:home-body" as NodeId;

afterEach(() => {
  vi.restoreAllMocks();
});

const press = (element: Element | null | undefined) =>
  act(() => {
    fireEvent.click(element!);
  });

describe("ADR-281 Phase 0 — RED 1: an origin's rule runs in instances the panel shows nothing for", () => {
  it("each instance shows the rule it runs", async () => {
    const h = await openAdr280Preview(["Button"]);
    const [button] = h.ids as [NodeId];
    h.rule(button, "onPress", { opcode: "toast", message: "origin" });
    act(() => {
      h.workspace.execute(
        createComponent({
          id: button,
          name: "Pressable",
          newId: h.workspace.newId,
        }),
      );
    });
    const graph = h.workspace.runtime.graph;
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
    const instances =
      body?.kind === "node"
        ? body.children.filter(
            (id) => graph.getEntry(id)?.kind === "node" && id !== button,
          )
        : [];
    expect(instances).toHaveLength(2);
    for (const element of h.view.container.querySelectorAll("button"))
      press(element);
    // Today: both instances run the origin's rule …
    expect(h.toasts).toEqual(["origin", "origin"]);
    // … and the panel, selecting either instance, shows it (Phase 3 fixed it — inherited rows).
    for (const instance of instances)
      expect(
        catalogInheritedInteractionsOf(graph, { ownerId: instance }),
      ).toHaveLength(1);
    h.view.unmount();
  });
});

describe("ADR-281 Phase 0 — RED 2: the Do choices offer what RAC refuses", () => {
  // Phase 1 fixed it — the panel's Do choices are `exposedCapabilities` (now `it`).
  it("a ListBox with selectionMode none does not offer selectItem", () => {
    const offered = (selectionMode: string) =>
      Object.keys(exposedCapabilities("ListBox", { props: { selectionMode } }));
    expect(offered("none")).not.toContain("selectItem");
    // (The control: a single-selection ListBox does.)
    expect(offered("single")).toContain("selectItem");
    // A rule already using it keeps it listed (hiding never deletes a rule).
    expect(
      Object.keys(
        exposedCapabilities("ListBox", { props: { selectionMode: "none" } }, "selectItem"),
      ),
    ).toContain("selectItem");
  });
});

describe("ADR-281 Phase 0 — RED 3: a callEndpoint rule has no Preview rule", () => {
  // Phase 4 fixed it — the vocabulary takes callEndpoint and `ruleOf` converts it (now `it`).
  it("the Preview indexes the Form's callEndpoint rule", async () => {
    const h = await openAdr280Preview(["Form"]);
    const [form] = h.ids as [NodeId];
    h.rule(form, "onSubmit", {
      opcode: "callEndpoint",
      endpointId: "data:endpoint:signup" as DataEndpointId,
    });
    const rules = catalogPreviewRules(h.session.graph!, h.session.root!);
    expect(
      rules.filter((rule) => (rule.action.kind as string) === "callEndpoint"),
    ).toHaveLength(1);
    h.view.unmount();
  });
});

describe("ADR-281 Phase 0 — RED 4: a page root's isDisabled does not reach its descendants", () => {
  // Phase 2 fixed it — the page root draws a RAC Provider (now `it`).
  it(
    "a Button under a disabled page root does not run its onPress rule",
    async () => {
      const h = await openAdr280Preview(["Button"]);
      const [button] = h.ids as [NodeId];
      h.rule(button, "onPress", { opcode: "toast", message: "pressed" });
      h.declare(BODY, { isDisabled: true });
      press(h.element(button));
      expect(h.toasts).toEqual([]);
      h.view.unmount();
    },
  );
});
