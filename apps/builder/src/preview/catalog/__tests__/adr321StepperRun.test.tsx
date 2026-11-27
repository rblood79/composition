import { act, fireEvent } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { NodeId } from "../../../../../../packages/shared/src/catalog/document/types";
import { openAdr280Preview } from "./support/adr280Harness";

/**
 * ADR-321 G3 — a Stepper in a running Preview (사용자 결정 2): only the current step's panel is in the
 * DOM, and it follows the list's runtime step — a press of a step, a rule's Do, and the breakdown's
 * case 「Form Submit → 다음 단계」 (a Form's onSubmit rule runs the list's 「다음 단계」). Expected panels
 * are written out by hand from the state rule (breakdown §5.2).
 */
afterEach(() => {
  vi.restoreAllMocks();
});

const reports = () =>
  (console.warn as unknown as { mock: { calls: unknown[][] } }).mock.calls
    .map((call) => String(call[0]))
    .filter((message) => message.startsWith("[interactions]"));

async function open() {
  vi.spyOn(console, "warn").mockImplementation(() => {});
  // (jsdom reports a submission it cannot navigate as "not implemented" — not under test.)
  vi.spyOn(console, "error").mockImplementation(() => {});
  const h = await openAdr280Preview(["Stepper", "Form", "Button"]);
  const [stepper, form, button] = h.ids as [NodeId, NodeId, NodeId];
  const graph = h.workspace.runtime.graph;
  // The placed Stepper owns its StepList (its root slot's node).
  const owned = (id: NodeId): NodeId[] => {
    const entry = graph.getEntry(id) as unknown as {
      children: NodeId[];
      descendantOverrides: { kind: string; childIds?: NodeId[] }[];
    };
    return [
      ...entry.children,
      ...entry.descendantOverrides.flatMap((item) =>
        item.kind === "fillSlot" ? (item.childIds ?? []) : [],
      ),
    ];
  };
  const typeName = (id: NodeId) =>
    h.workspace.root.typeOf(
      h.workspace.root.canvasInputs.get(
        h.workspace.root.recordsOfSource(id)[0]!,
      )!,
    );
  const list = owned(stepper).find((id) => typeName(id) === "StepList")!;
  expect(list).toBeDefined();
  h.rule(form, "onSubmit", {
    opcode: "capability",
    target: { nodeId: list },
    capabilityId: "nextStep",
  } as never);
  h.rule(button, "onPress", {
    opcode: "capability",
    target: { nodeId: form },
    capabilityId: "submit",
  } as never);
  // (The Form's own fields are left optional — RAC would hold the submit on an empty required one.)
  for (const input of h.view.container.querySelectorAll("form input"))
    input.removeAttribute("required");

  const box = () => h.element(stepper)!;
  /** The panels the DOM draws, by their text (the Stepper's children after the list's group). */
  const panels = () =>
    [...box().children]
      .filter((child) => child.getAttribute("role") !== "group")
      .map((child) => child.textContent);
  const links = () => [...box().querySelectorAll<HTMLElement>(".step-link")];
  const pressStep = (index: number) =>
    act(() => {
      fireEvent.click(links()[index]!);
    });
  const submit = () =>
    act(() => {
      fireEvent.click(h.element(button)!);
    });
  return { ...h, panels, pressStep, submit };
}

describe("ADR-321 G3 — Stepper 의 실행 (Preview)", () => {
  it("시작: 첫 단계의 패널만 DOM 에 있다", async () => {
    const h = await open();
    expect(h.panels()).toEqual(["Step 1 content"]);
    h.view.unmount();
  });

  it("Form 제출 → 「다음 단계」: 패널이 단계를 따라간다 · 마지막 단계에서는 머문다", async () => {
    const h = await open();
    h.submit();
    expect(h.panels()).toEqual(["Step 2 content"]);
    h.submit();
    expect(h.panels()).toEqual(["Step 3 content"]);
    h.submit();
    expect(h.panels()).toEqual(["Step 3 content"]);
    expect(reports()).toEqual([]);
    h.view.unmount();
  });

  it("단계 누르기: 완료된 단계로 돌아가면 그 패널, 남은 단계는 누를 수 없어 그대로", async () => {
    const h = await open();
    h.submit(); // step-1 완료 · step-2 현재
    h.pressStep(0);
    expect(h.panels()).toEqual(["Step 1 content"]);
    // step-3 is not reachable (its previous step is not completed) — nothing changes.
    h.pressStep(2);
    expect(h.panels()).toEqual(["Step 1 content"]);
    h.pressStep(1);
    expect(h.panels()).toEqual(["Step 2 content"]);
    h.view.unmount();
  });
});
