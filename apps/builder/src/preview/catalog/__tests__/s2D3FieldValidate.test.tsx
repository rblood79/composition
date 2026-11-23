import { act, fireEvent } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type {
  DefinitionId,
  NodeId,
} from "../../../../../../packages/shared/src/catalog/document/types";
import type { CatalogValidationRule } from "../../../../../../packages/shared/src/catalog/document/validationRules";
import {
  catalogSlotCommands,
  catalogSlotInsertOptions,
  catalogSlotTarget,
} from "../../../builder/catalogRuntime/slots";
import { setFields } from "../../../../../../packages/shared/src/catalog/commands";
import {
  catalogCodeViewPlan,
  catalogCodeViewSession,
} from "../../../builder/catalogRuntime/codeViewEdit";
import { openAdr280Preview } from "./support/adr280Harness";
import { HOME, openAdr296 } from "./support/adr296Harness";

/**
 * S2 체크리스트 부록 D.3 2단계 (2026-11-23) — S2 `validate` as condition rules (사용자 결정: 함수가
 * 아니라 데이터 보기의 조건 트리): a field's `validate` prop holds rules; a rule whose condition its
 * committed value does not meet shows its message (S2: after blur · on submit) and a native Form
 * does not submit. A rule may read another field of the same Form (`!form.<name>`).
 */
afterEach(() => {
  vi.restoreAllMocks();
});

const NOT_ADMIN: CatalogValidationRule = {
  id: "r1",
  when: {
    id: "c1",
    fields: [["data:field:$value"]],
    op: "notEquals",
    value: "admin",
  },
  message: "Nice try!",
};

async function form() {
  vi.spyOn(console, "warn").mockImplementation(() => {});
  vi.spyOn(console, "error").mockImplementation(() => {});
  const h = await openAdr280Preview(["Form", "Button"]);
  const [formId, button] = h.ids as [NodeId, NodeId];
  h.rule(formId, "onSubmit", { opcode: "toast", message: "submitted" });
  // (RAC's submit — `requestSubmit`, which runs the constraint validation a browser runs.)
  h.rule(button, "onPress", {
    opcode: "capability",
    target: { nodeId: formId },
    capabilityId: "submit",
  });
  const inputs = () => [
    ...h.view.container.querySelectorAll<HTMLInputElement>("form input"),
  ];
  const fieldIdOf = (input: HTMLInputElement) =>
    (input.closest(".react-aria-TextField") as HTMLElement)
      .getAttribute("data-catalog-id")!
      .split("::")
      .pop() as NodeId;
  const fieldId = fieldIdOf(inputs()[0]!);
  const type = (input: HTMLInputElement, value: string) => {
    act(() => {
      fireEvent.change(input, { target: { value } });
    });
    act(() => {
      fireEvent.blur(input);
    });
  };
  const submit = () => {
    inputs().forEach((input) => input.removeAttribute("required"));
    act(() => {
      fireEvent.click(h.element(button)!);
    });
  };
  const fieldOf = (input: HTMLInputElement) =>
    input.closest(".react-aria-TextField") as HTMLElement;
  return { ...h, formId, inputs, fieldId, fieldIdOf, type, submit, fieldOf };
}

describe("S2 D.3 validate — a field's condition rules", () => {
  it("a value the rule refuses shows its message after blur and blocks submit; a value it takes clears it", async () => {
    const h = await form();
    h.declare(h.fieldId, { validate: [NOT_ADMIN], isRequired: false });
    const input = () => h.inputs()[0]!;
    h.type(input(), "admin");
    h.submit();
    expect(h.fieldOf(input()).textContent).toContain("Nice try!");
    expect(input().getAttribute("aria-invalid")).toBe("true");
    expect(h.toasts).toEqual([]);
    h.type(input(), "alice");
    expect(h.fieldOf(input()).textContent).not.toContain("Nice try!");
    h.submit();
    expect(h.toasts).toEqual(["submitted"]);
    h.view.unmount();
  });

  it("several failing rules give every message (S2's list)", async () => {
    const h = await form();
    h.declare(h.fieldId, {
      isRequired: false,
      validate: [
        NOT_ADMIN,
        {
          id: "r2",
          when: {
            id: "c2",
            fields: [["data:field:$value"]],
            op: "contains",
            value: "@",
          },
          message: "Needs an @",
        },
      ],
    });
    h.type(h.inputs()[0]!, "admin");
    h.submit();
    const text = h.fieldOf(h.inputs()[0]!).textContent ?? "";
    expect(text).toContain("Nice try!");
    expect(text).toContain("Needs an @");
    h.view.unmount();
  });

  it("an 「or」 group: either condition passes it", async () => {
    const h = await form();
    h.declare(h.fieldId, {
      isRequired: false,
      validate: [
        {
          id: "r",
          when: {
            id: "g",
            op: "or",
            items: [
              { id: "a", fields: [["data:field:$value"]], op: "startsWith", value: "a" },
              { id: "b", fields: [["data:field:$value"]], op: "startsWith", value: "b" },
            ],
          },
          message: "Starts with a or b",
        },
      ],
    });
    h.type(h.inputs()[0]!, "carol");
    h.submit();
    expect(h.fieldOf(h.inputs()[0]!).textContent).toContain("Starts with a or b");
    h.type(h.inputs()[0]!, "bob");
    expect(h.fieldOf(h.inputs()[0]!).textContent).not.toContain("Starts with a or b");
    h.view.unmount();
  });

  it("a rule reading another field of the Form (!form.password) — a confirmation", async () => {
    const h = await form();
    // (A second TextField of the Form's own, named `password`.)
    const graph = h.workspace.runtime.graph;
    const slot = catalogSlotTarget(graph, { kind: "node", id: h.formId });
    const target = slot ?? ({ kind: "node", id: h.formId } as const);
    const option = catalogSlotInsertOptions(graph, target).find(
      (choice) => choice.label === "TextField",
    );
    expect(option, "the Form takes a TextField").toBeDefined();
    h.workspace.execute(
      slot
        ? catalogSlotCommands.fill(slot, option!.definitionId as DefinitionId, h.workspace.newId)
        : catalogSlotCommands.insert(target, option!.definitionId as DefinitionId, h.workspace.newId),
    );
    h.flush();
    const password = h.inputs().at(-1)!;
    const passwordId = h.fieldIdOf(password);
    expect(passwordId).not.toBe(h.fieldId);
    h.declare(passwordId, { name: "password", isRequired: false });
    h.declare(h.fieldId, {
      name: "confirm",
      isRequired: false,
      validate: [
        {
          id: "same",
          when: {
            id: "c",
            fields: [["data:field:$value"]],
            op: "equals",
            value: "!form.password",
          },
          message: "Passwords differ",
        },
      ],
    });
    h.type(h.inputs().at(-1)!, "secret1");
    h.type(h.inputs()[0]!, "secret2");
    h.submit();
    expect(h.fieldOf(h.inputs()[0]!).textContent).toContain("Passwords differ");
    expect(h.toasts).toEqual([]);
    // (The other field changes to match — the confirmation judges again with its new value: its
    //  native validity is clear and the Form submits. RAC native mode keeps the shown message until
    //  that field commits again, D1.)
    h.type(h.inputs().at(-1)!, "secret2");
    expect(h.inputs()[0]!.validationMessage).toBe("");
    h.submit();
    expect(h.toasts).toEqual(["submitted"]);
    h.view.unmount();
  });

  it("the document refuses a validate value that is not rules", async () => {
    const h = await form();
    expect(() =>
      h.declare(h.fieldId, { validate: [{ id: "x", message: "m" }] as never }),
    ).toThrow();
    expect(() =>
      h.declare(h.fieldId, {
        validate: [{ ...NOT_ADMIN, when: { ...NOT_ADMIN.when, op: "nope" } }] as never,
      }),
    ).toThrow();
    h.view.unmount();
  });
});

describe("S2 D.3 validate — the code view", () => {
  it("writes the rules as validationRules([...]) and reads them back unchanged (strict)", async () => {
    vi.spyOn(console, "warn").mockImplementation(() => {});
    const h = await openAdr296();
    const field = h.add("TextField") as NodeId;
    h.workspace.execute(
      setFields({
        targets: [{ kind: "node", id: field }],
        props: { validate: { kind: "set", value: [NOT_ADMIN] } } as never,
        label: "Rules",
      }),
    );
    const code = h.code();
    expect(code).toContain("validate={validationRules([");
    expect(code).toContain("Nice try!");
    expect(code).toMatch(/import \{[^}]*validationRules[^}]*\} from '@composition\/code';/);
    const data = h.dataOf();
    const session = catalogCodeViewSession(h.graph(), HOME, data)!;
    expect(
      catalogCodeViewPlan({
        reader: h.workspace.runtime.graph.commandReader,
        session,
        edited: session.baseline.code,
        changes: [],
        data,
        newId: h.workspace.newId,
        strict: true,
      }).rejected,
    ).toEqual([]);
  });
});
