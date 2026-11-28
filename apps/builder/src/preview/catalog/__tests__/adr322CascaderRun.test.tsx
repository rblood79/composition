import { act, fireEvent } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type {
  EntryId,
  NodeId,
  ProjectEntry,
  StateVariableEntry,
} from "../../../../../../packages/shared/src/catalog/document/types";
import { setFields } from "../../../../../../packages/shared/src/catalog/commands";
import { catalogVariableCommands } from "../../../builder/catalogRuntime/stateVariables";
import { catalogStateSourceValue } from "../../../../../../packages/shared/src/catalog/runtime/delegatedDom.runtime";
import { openAdr280Preview } from "./support/adr280Harness";

/** A row's name — its label part (a branch row also holds its item count, 사용자 결정 2026-11-29). */
const rowName = (row: Element | null | undefined) =>
  row?.querySelector('[slot="label"]')?.textContent ?? row?.textContent;

/**
 * ADR-322 G5 (G4 의 「값 넣기」 이관) — a Cascader in a running Preview: a rule's 「값 넣기」 writes a key
 * the value text · the named state read; a key no single pickable item carries is refused and
 * reported (Decision 4 — a branch while the field picks leaves, a missing key), never matched to the
 * first; 「어느 단계든」 (사용자 결정 2) makes a branch a value; 「지우기」 clears; 「열기」 opens. The
 * expected texts are written out by hand from the origin's sample items.
 */
const HOME = "project:page:home" as EntryId<"page">;

afterEach(() => {
  vi.restoreAllMocks();
});

const reports = () =>
  (console.warn as unknown as { mock: { calls: unknown[][] } }).mock.calls
    .map((call) => String(call[0]))
    .filter((message) => message.startsWith("[interactions]"));

async function open(
  capabilityId: string,
  setTo: unknown,
  declare: Record<string, unknown> = {},
) {
  vi.spyOn(console, "warn").mockImplementation(() => {});
  const h = await openAdr280Preview(["Cascader", "Button", "Text"]);
  const [target, button, text] = h.ids as [NodeId, NodeId, NodeId];
  const { workspace } = h;
  const graph = workspace.runtime.graph;
  // (These cases are the `columns` mode's — the default is `drill`, 사용자 결정 2026-11-29.)
  h.declare(target, { mode: "columns", ...declare } as never);
  const record = workspace.root.domInputs.get(
    workspace.recordsOfNode(target)[0]!,
  )!;
  workspace.execute(
    catalogVariableCommands.nameSource(
      HOME,
      target,
      { prop: "value", type: "string" },
      catalogStateSourceValue(workspace.root, record, "value") as never,
      "picked",
      workspace.newId,
    ),
  );
  const named = (
    (graph.getEntry(graph.projectId) as ProjectEntry).stateVariableIds ?? []
  )
    .map((id) => graph.getEntry(id as never) as StateVariableEntry)
    .find((entry) => entry.name === "picked");
  expect(named).toBeDefined();
  h.rule(button, "onPress", {
    opcode: "capability",
    target: { nodeId: target },
    capabilityId,
    ...(setTo === undefined ? {} : { value: setTo }),
  } as never);
  workspace.execute(
    setFields({
      targets: [{ kind: "node", id: text }],
      props: { children: { kind: "set", value: "picked={{ picked }}" } },
      label: "Edit properties",
    }),
  );
  h.flush();
  const valueText = () =>
    h.element(target)!.querySelector(".react-aria-SelectValue")!.textContent;
  const state = () => h.element(text)!.textContent;
  const press = () =>
    act(() => {
      fireEvent.click(h.element(button)!);
    });
  return { ...h, target, valueText, state, press };
}

describe("ADR-322 G5 — Cascader 의 실행 (Preview)", () => {
  it("Do 「값 넣기」 desktops → 값 글자 = 경로 · 이름 붙인 상태 = key · 보고 0", async () => {
    const h = await open("setValue", "desktops");
    expect(h.valueText()).toBe("Choose an option...");
    h.press();
    expect(h.valueText()).toBe("Electronics / Computers / Desktops");
    expect(h.state()).toBe("picked=desktops");
    expect(reports()).toEqual([]);
    h.view.unmount();
  });

  it("Do 「값 넣기」 가지 computers (끝 항목만) · 없는 key → 거절 + 보고, 값 그대로", async () => {
    for (const [key, why] of [
      ["computers", "가지 항목: computers"],
      ["zz", "없는 key: zz"],
    ] as const) {
      const h = await open("setValue", key, { defaultValue: "books" });
      h.press();
      expect(h.valueText()).toBe("Books");
      expect(h.state()).toBe("picked=books");
      expect(reports().some((message) => message.includes(why))).toBe(true);
      h.view.unmount();
      vi.restoreAllMocks();
    }
  });

  it("「어느 단계든」 이면 가지 computers 가 값이다", async () => {
    const h = await open("setValue", "computers", {
      allowsBranchSelection: true,
    });
    h.press();
    expect(h.valueText()).toBe("Electronics / Computers");
    expect(h.state()).toBe("picked=computers");
    expect(reports()).toEqual([]);
    h.view.unmount();
  });

  it("Do 「지우기」 → placeholder · 상태 비움", async () => {
    const h = await open("clear", undefined, { defaultValue: "books" });
    expect(h.valueText()).toBe("Books");
    h.press();
    expect(h.valueText()).toBe("Choose an option...");
    expect(reports()).toEqual([]);
    h.view.unmount();
  });

  it("Do 「열기」 → 열린 menu (첫 단계 항목)", async () => {
    const h = await open("open", undefined);
    h.press();
    await vi.waitFor(() =>
      expect(document.querySelector('[role="menu"]')).toBeTruthy(),
    );
    expect(
      [...document.querySelectorAll('[role="menu"] [role^="menuitem"]')].map(
        (item) => rowName(item),
      ),
    ).toEqual(["Electronics", "Clothing", "Books"]);
    h.view.unmount();
  });
});
