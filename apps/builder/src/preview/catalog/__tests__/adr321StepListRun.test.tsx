import { act, fireEvent } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type {
  EntryId,
  NodeId,
  ProjectEntry,
  StateVariableEntry,
} from "../../../../../../packages/shared/src/catalog/document/types";
import { setFields } from "../../../../../../packages/shared/src/catalog/commands";
import {
  catalogInteractionsCommand,
  catalogNewInteraction,
} from "../../../builder/catalogRuntime/interactions";
import { catalogVariableCommands } from "../../../builder/catalogRuntime/stateVariables";
import { openAdr280Preview } from "./support/adr280Harness";

/**
 * ADR-321 G2 — a StepList in a running Preview, the whole path: the palette's StepList (three steps
 * — 완료 · 현재 · 남음), its two named states, its two When rules and four Buttons whose press runs
 * the four Dos. Every expected value is written out by hand from the state rule's text (breakdown
 * §5.2); the DOM read is what RAC `Link` gives (`aria-current` · `aria-disabled`).
 */
const HOME = "project:page:home" as EntryId<"page">;
const DOS = ["nextStep", "previousStep", "completeStep", "goToStep"] as const;

afterEach(() => {
  vi.restoreAllMocks();
});

const reports = () =>
  (console.warn as unknown as { mock: { calls: unknown[][] } }).mock.calls
    .map((call) => String(call[0]))
    .filter((message) => message.startsWith("[interactions]"));

async function open(declare: Record<string, unknown> = {}) {
  vi.spyOn(console, "warn").mockImplementation(() => {});
  const h = await openAdr280Preview([
    "StepList",
    "Button",
    "Button",
    "Button",
    "Button",
    "Text",
  ]);
  const [list, ...rest] = h.ids as NodeId[];
  const buttons = rest.slice(0, 4);
  const text = rest[4]!;
  const { workspace } = h;
  const graph = workspace.runtime.graph;
  if (Object.keys(declare).length) h.declare(list!, declare as never);

  // Two page variables the list's When rules write, two named states that follow the list.
  const variableIds = (): readonly string[] =>
    (graph.getEntry(graph.projectId) as ProjectEntry).stateVariableIds ?? [];
  const before = new Set<string>(variableIds());
  workspace.execute(
    catalogVariableCommands.add(HOME, "moved", workspace.newId),
  );
  workspace.execute(
    catalogVariableCommands.add(HOME, "passed", workspace.newId),
  );
  const start = (prop: string) =>
    h.session.root!.domInputs.get(h.session.root!.recordsOfSource(list!)[0]!)!
      .props[prop];
  workspace.execute(
    catalogVariableCommands.nameSource(
      HOME,
      list!,
      { prop: "selectedKey", type: "string" },
      start("defaultSelectedKey") ?? "",
      "step",
      workspace.newId,
    ),
  );
  workspace.execute(
    catalogVariableCommands.nameSource(
      HOME,
      list!,
      { prop: "lastCompletedStep", type: "string" },
      start("defaultLastCompletedStep") ?? "",
      "done",
      workspace.newId,
    ),
  );
  const variable = (name: string) =>
    variableIds()
      .filter((id) => !before.has(id))
      .map((id) => graph.getEntry(id as never) as StateVariableEntry)
      .find((entry) => entry.name === name)!;

  const owner = { ownerId: list! };
  workspace.execute(
    catalogInteractionsCommand(
      owner,
      [
        catalogNewInteraction(
          owner,
          "onSelectionChange",
          {
            opcode: "setState",
            variableId: variable("moved").id,
            op: "set",
            value: "!event.key",
          } as never,
          workspace.newId,
        ),
        catalogNewInteraction(
          owner,
          "onLastCompletedStepChange",
          {
            opcode: "setState",
            variableId: variable("passed").id,
            op: "set",
            value: "!event.key",
          } as never,
          workspace.newId,
        ),
      ],
      "Rules",
    ),
  );
  DOS.forEach((capabilityId, index) =>
    h.rule(buttons[index]!, "onPress", {
      opcode: "capability",
      target: { nodeId: list! },
      capabilityId,
      ...(capabilityId === "goToStep" ? { value: "step-3" } : {}),
    } as never),
  );
  workspace.execute(
    setFields({
      targets: [{ kind: "node", id: text }],
      props: {
        children: {
          kind: "set",
          value:
            "step={{ step }} done={{ done }} moved={{ moved }} passed={{ passed }}",
        },
      },
      label: "Edit properties",
    }),
  );
  h.flush();

  const links = () =>
    [
      ...h.element(list!)!.querySelectorAll<HTMLElement>(".step-link"),
    ] as HTMLElement[];
  /**
   * Each step as the DOM shows it: its state (the `li`'s — done · now · todo), `*` = RAC Link's
   * `aria-current="step"`, `x` = RAC Link's `aria-disabled` (cannot be gone to).
   */
  const WORD: Record<string, string> = {
    completed: "done",
    current: "now",
    incomplete: "todo",
  };
  const shown = () =>
    links()
      .map(
        (link) =>
          `${WORD[link.closest("li")!.getAttribute("data-step-state")!]}${
            link.getAttribute("aria-current") === "step" ? "*" : ""
          }${link.getAttribute("aria-disabled") === "true" ? "x" : ""}`,
      )
      .join(" ");
  const readout = () => h.element(text)!.textContent;
  const pressStep = (index: number) =>
    act(() => {
      fireEvent.click(links()[index]!);
    });
  const run = (capability: (typeof DOS)[number]) =>
    act(() => {
      fireEvent.click(h.element(buttons[DOS.indexOf(capability)]!)!);
    });
  return { ...h, list: list!, shown, readout, pressStep, run };
}

describe("ADR-321 G2 — StepList 의 실행 (Preview 전 경로)", () => {
  it("시작: 완료 · 현재 · 남음 — 이름 붙인 상태는 시작 값, 규칙 변수는 비어 있다", async () => {
    const h = await open();
    expect(h.shown()).toBe("done now* todox");
    expect(h.readout()).toBe("step=step-2 done=step-1 moved= passed=");
    // RAC Group names the list (the language's default).
    expect(h.element(h.list)!.getAttribute("role")).toBe("group");
    expect(h.element(h.list)!.getAttribute("aria-label")).toBe("Steps");
    h.view.unmount();
  });

  it("단계 누르기 (선형): 완료된 단계로 간다 · 남은 단계는 못 간다 · When 「단계 변경」 은 사용자의 이동만", async () => {
    const h = await open();
    h.pressStep(0);
    expect(h.shown()).toBe("now* todo todox");
    expect(h.readout()).toBe("step=step-1 done=step-1 moved=step-1 passed=");
    // The third step's previous step is not completed — a press of it changes nothing.
    h.pressStep(2);
    expect(h.shown()).toBe("now* todo todox");
    expect(h.readout()).toBe("step=step-1 done=step-1 moved=step-1 passed=");
    expect(reports()).toEqual([]);
    h.view.unmount();
  });

  it("Do 넷: 다음 · 이전 · 완료 · 단계로 이동 — 이름 붙인 상태가 따르고 When 은 실행되지 않는다", async () => {
    const h = await open();
    h.run("nextStep"); // step-2 → step-3, step-2 완료
    expect(h.shown()).toBe("done done now*");
    expect(h.readout()).toBe("step=step-3 done=step-2 moved= passed=");
    h.run("nextStep"); // 마지막 단계 — 머문다 (실패가 아니다)
    expect(h.readout()).toBe("step=step-3 done=step-2 moved= passed=");
    h.run("completeStep"); // step-3 까지 완료
    expect(h.shown()).toBe("done done now*");
    expect(h.readout()).toBe("step=step-3 done=step-3 moved= passed=");
    h.run("previousStep");
    expect(h.shown()).toBe("done now* done");
    expect(h.readout()).toBe("step=step-2 done=step-3 moved= passed=");
    h.run("goToStep"); // 규칙의 값 step-3
    expect(h.shown()).toBe("done done now*");
    expect(reports()).toEqual([]);
    h.view.unmount();
  });

  it("「단계 완료」 뒤에는 다음 단계를 누를 수 있다", async () => {
    const h = await open();
    expect(h.shown()).toBe("done now* todox");
    h.run("completeStep");
    expect(h.shown()).toBe("done now* todo");
    expect(h.readout()).toBe("step=step-2 done=step-2 moved= passed=");
    h.pressStep(2);
    expect(h.shown()).toBe("done done now*");
    expect(h.readout()).toBe("step=step-3 done=step-2 moved=step-3 passed=");
    h.view.unmount();
  });

  it("자유 이동: 남은 단계도 누를 수 있고, 건너뛴 단계가 완료되며 When 「완료 단계 변경」 이 실행된다", async () => {
    const h = await open({
      allowsFreeNavigation: true,
      defaultSelectedKey: "step-1",
      defaultLastCompletedStep: "",
    });
    expect(h.shown()).toBe("now* todo todo");
    h.pressStep(2);
    expect(h.shown()).toBe("done done now*");
    expect(h.readout()).toBe(
      "step=step-3 done=step-2 moved=step-3 passed=step-2",
    );
    // 뒤로 가도 완료 (2 번째까지) 는 줄지 않는다 — 3 번째는 완료한 적이 없어 남음이다. 「완료 단계
    // 변경」 은 다시 실행되지 않는다.
    h.pressStep(0);
    expect(h.shown()).toBe("now* done todo");
    expect(h.readout()).toBe(
      "step=step-1 done=step-2 moved=step-1 passed=step-2",
    );
    h.view.unmount();
  });

  it("작성한 시작 값이 그대로 시작 상태다 — 완료보다 뒤에 있지 않은 지금 단계도", async () => {
    // 지금 단계 1 번째 · 완료 2 번째까지: 규칙이 고르는 단계 (3 번째) 가 아니라 작성한 단계가 현재다.
    const h = await open({
      defaultSelectedKey: "step-1",
      defaultLastCompletedStep: "step-2",
    });
    expect(h.shown()).toBe("now* done todo");
    expect(h.readout()).toBe("step=step-1 done=step-2 moved= passed=");
    h.run("nextStep");
    expect(h.shown()).toBe("done now* todo");
    expect(h.readout()).toBe("step=step-2 done=step-2 moved= passed=");
    h.view.unmount();
  });

  it("읽기 전용: 누르기는 막고 Do 는 받는다", async () => {
    const h = await open({ isReadOnly: true });
    expect(h.shown()).toBe("donex now*x todox");
    h.pressStep(0);
    expect(h.shown()).toBe("donex now*x todox");
    h.run("nextStep");
    expect(h.shown()).toBe("donex donex now*x");
    expect(h.readout()).toBe("step=step-3 done=step-2 moved= passed=");
    expect(reports()).toEqual([]);
    h.view.unmount();
  });

  it("비활성 목록: 누르기도 Do 도 받지 않고, Do 는 이유를 보고한다", async () => {
    const h = await open({ isDisabled: true });
    expect(h.shown()).toBe("donex now*x todox");
    h.run("nextStep");
    expect(h.shown()).toBe("donex now*x todox");
    expect(h.readout()).toBe("step=step-2 done=step-1 moved= passed=");
    expect(reports()).toEqual([expect.stringContaining("isDisabled")]);
    h.view.unmount();
  });

  it("비활성 단계 (`disabledKeys`): 그 단계로 가는 Do 는 쓰지 않는다", async () => {
    const h = await open({ disabledKeys: ["step-3"] });
    expect(h.shown()).toBe("done now* todox");
    h.run("goToStep");
    expect(h.shown()).toBe("done now* todox");
    expect(reports()).toEqual([expect.stringContaining("disabledKeys")]);
    h.view.unmount();
  });
});
