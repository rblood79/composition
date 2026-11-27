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

/**
 * ADR-321 G5 — a Rating in a running Preview: its effective value (Decision 8 — input = whole stars,
 * display only = half stars) is the one number the stars, the range input (the form value — 사용자
 * 결정 5 `name`), the named state and the announced value read, whichever way it comes — the
 * authored start, a variable's value in the start (`{{ }}` — a data value), a rule's 「값 넣기」, RAC's
 * own change (an arrow key). Display only is a RAC Meter announcing 「N of 5 stars」 (사용자 결정 7).
 * The expected values are written out by hand from Decision 8's table. A press on a star (the track
 * geometry) is the browser's — `adr321-g5-live.mjs`.
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
  type: "Rating" | "Slider",
  setTo: unknown,
  declare: Record<string, unknown> = {},
  variables: Record<string, string> = {},
) {
  vi.spyOn(console, "warn").mockImplementation(() => {});
  const h = await openAdr280Preview([type, "Button", "Text"]);
  const [target, button, text] = h.ids as [NodeId, NodeId, NodeId];
  const { workspace } = h;
  const graph = workspace.runtime.graph;
  const variableIds = (): readonly string[] =>
    (graph.getEntry(graph.projectId) as ProjectEntry).stateVariableIds ?? [];
  if (Object.keys(declare).length) h.declare(target, declare as never);
  const variable = (name: string) =>
    variableIds()
      .map((id) => graph.getEntry(id as never) as StateVariableEntry)
      .find((entry) => entry.name === name)!;
  for (const [name, value] of Object.entries(variables)) {
    workspace.execute(catalogVariableCommands.add(HOME, name, workspace.newId));
    workspace.execute(
      catalogVariableCommands.setDefault(variable(name), value),
    );
  }
  // (The Properties panel's 「이름 붙이기」: the state starts at the component's start state.)
  const record = workspace.root.domInputs.get(
    workspace.recordsOfNode(target)[0]!,
  )!;
  workspace.execute(
    catalogVariableCommands.nameSource(
      HOME,
      target,
      { prop: "value", type: "number" },
      catalogStateSourceValue(workspace.root, record, "value") as never,
      "stars",
      workspace.newId,
    ),
  );
  const named = variableIds()
    .map((id) => graph.getEntry(id as never) as StateVariableEntry)
    .find((entry) => entry.name === "stars")!;
  expect(named).toBeDefined();
  h.rule(button, "onPress", {
    opcode: "capability",
    target: { nodeId: target },
    capabilityId: "setValue",
    value:
      typeof setTo === "string" && setTo.startsWith("$")
        ? `!var.${variable(setTo.slice(1)).id}`
        : setTo,
  } as never);
  workspace.execute(
    setFields({
      targets: [{ kind: "node", id: text }],
      props: { children: { kind: "set", value: "stars={{ stars }}" } },
      label: "Edit properties",
    }),
  );
  h.flush();

  const box = () => h.element(target)!;
  /** Waits for the lazy RAC Slider · Meter (the stars stand in a plain box until it loads). */
  const loaded = () =>
    vi.waitFor(() =>
      expect(
        box().matches('[role="group"], [role="meter"]') ||
          box().querySelector('[role="group"]'),
      ).toBeTruthy(),
    );
  const stars = () =>
    [...box().querySelectorAll<HTMLElement>(".rating-star")].map(
      (star) => star.dataset.fill,
    );
  const input = () => box().querySelector<HTMLInputElement>("input")!;
  const state = () => h.element(text)!.textContent;
  const press = () =>
    act(() => {
      fireEvent.click(h.element(button)!);
    });
  return { ...h, target, box, loaded, stars, input, state, press, named };
}

const FILLS = {
  2: ["full", "full", "empty", "empty", "empty"],
  3: ["full", "full", "full", "empty", "empty"],
  4: ["full", "full", "full", "full", "empty"],
  "2.5": ["full", "full", "half", "empty", "empty"],
  "3.5": ["full", "full", "full", "half", "empty"],
} as const;

describe("ADR-321 G5 — Rating 의 실행 (Preview)", () => {
  it("작성 값 2.6 → 입력 모드 3 (반쪽 별이 아니다): 별 · range input (폼 값 · name) · 이름 붙인 상태 = 3", async () => {
    const h = await open("Rating", 2.5, { defaultValue: 2.6, name: "score" });
    await h.loaded();
    expect(h.stars()).toEqual(FILLS[3]);
    expect(h.input().type).toBe("range");
    expect(h.input().name).toBe("score");
    expect(h.input().value).toBe("3");
    expect(h.state()).toBe("stars=3");
    h.view.unmount();
  });

  it("Do 「값 넣기」 2.5 → 입력 모드는 3 을 쓴다: 별 · range input · 상태 = 3", async () => {
    const h = await open("Rating", 2.5, { defaultValue: 1 });
    await h.loaded();
    h.press();
    expect(h.stars()).toEqual(FILLS[3]);
    expect(h.input().value).toBe("3");
    expect(h.state()).toBe("stars=3");
    expect(reports()).toEqual([]);
    h.view.unmount();
  });

  it("RAC 의 변경 (화살표): 3 → 4 → 0 까지 줄이면 지워진다 · 5 위로 가지 않는다", async () => {
    const h = await open("Rating", 3);
    await h.loaded();
    h.press();
    const key = (name: string, times = 1) => {
      for (let i = 0; i < times; i += 1)
        act(() => {
          fireEvent.keyDown(h.input(), { key: name });
          fireEvent.keyUp(h.input(), { key: name });
        });
    };
    key("ArrowRight");
    expect(h.stars()).toEqual(FILLS[4]);
    expect(h.input().value).toBe("4");
    expect(h.state()).toBe("stars=4");
    key("ArrowRight", 3);
    expect(h.input().value).toBe("5");
    key("ArrowLeft", 6);
    expect(h.input().value).toBe("0");
    expect(h.stars()).toEqual(Array(5).fill("empty"));
    expect(h.state()).toBe("stars=0");
    h.view.unmount();
  });

  it("데이터 값 — Do 의 값이 변수 (`!var`) 3.6: 입력 모드 4 · 표시 전용 3.5", async () => {
    const h = await open("Rating", "$score", {}, { score: "3.6" });
    await h.loaded();
    h.press();
    expect(h.stars()).toEqual(FILLS[4]);
    expect(h.input().value).toBe("4");
    expect(h.state()).toBe("stars=4");
    h.declare(h.target, { isReadOnly: true } as never);
    await vi.waitFor(() => expect(h.box().getAttribute("role")).toBe("meter"));
    h.press();
    expect(h.stars()).toEqual(FILLS["3.5"]);
    expect(h.box().getAttribute("aria-valuenow")).toBe("3.5");
    expect(h.state()).toBe("stars=3.5");
    // Back to the input with the running 3.5: the stars and the range input read whole stars (4).
    h.declare(h.target, { isReadOnly: false } as never);
    await vi.waitFor(() => expect(h.box().getAttribute("role")).toBe("group"));
    expect(h.stars()).toEqual(FILLS[4]);
    expect(h.input().value).toBe("4");
    h.view.unmount();
  });

  it("표시 전용 = RAC Meter — 낭독 값은 백분율이 아니라 「N of 5 stars」 이고 N = 반쪽 별 채움", async () => {
    const h = await open("Rating", 2.3, { defaultValue: 4, isReadOnly: true });
    await h.loaded();
    expect(h.box().getAttribute("role")).toBe("meter");
    expect(h.box().getAttribute("aria-valuetext")).toBe("4 of 5 stars");
    expect(h.box().querySelector("input")).toBeNull();
    // A rule's 「값 넣기 2.3」 on display only is 2.5 (half stars).
    h.press();
    expect(h.stars()).toEqual(FILLS["2.5"]);
    expect(h.box().getAttribute("aria-valuetext")).toBe("2.5 of 5 stars");
    expect(h.state()).toBe("stars=2.5");
    h.view.unmount();
  });

  it("Slider 회귀 — 단계 사이 값 「값 넣기 2.5」 (step 1): 상태 = range input 값 = 3", async () => {
    const h = await open("Slider", 2.5);
    h.press();
    await vi.waitFor(() => expect(h.input().value).toBe("3"));
    expect(h.state()).toBe("stars=3");
    h.view.unmount();
  });
});
