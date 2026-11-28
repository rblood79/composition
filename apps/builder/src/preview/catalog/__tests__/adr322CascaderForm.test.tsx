import { act, fireEvent } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import type {
  NodeEntry,
  NodeId,
} from "../../../../../../packages/shared/src/catalog/document/types";
import { insertNodes } from "../../../../../../packages/shared/src/catalog/commands";
import { catalogPaletteDefinitionId } from "../../../builder/catalogRuntime/paletteInsert";
import { openAdr280Preview } from "./support/adr280Harness";

/** A row's name — its label part (a branch row also holds its item count, 사용자 결정 2026-11-29). */
const rowName = (row: Element | null | undefined) =>
  row?.querySelector('[slot="label"]')?.textContent ?? row?.textContent;

/**
 * ADR-322 G6 — a Cascader's form value and required check (breakdown §3.1 — the closed D1
 * exception): the value input (RAC `HiddenSelect`'s) carries the keys under the field's `name`; a
 * native Form's required empty field blocks the submit, shows the error and focuses the open Button;
 * a disabled field neither blocks nor carries; an unnamed required field checks without carrying;
 * an aria Form submits. The expected entries are written out from the origin's sample items.
 */
afterEach(() => {
  vi.restoreAllMocks();
});

const settle = () => act(async () => new Promise((r) => setTimeout(r, 40)));
// (The form run is a lazy chunk — its first import outlasts a few frames.)
beforeAll(async () => {
  await import("../../../../../../packages/shared/src/catalog/runtime/cascaderForm.components");
  await import("../../../../../../packages/shared/src/catalog/runtime/cascaderMenu.components");
});

async function form(
  cascader: Record<string, unknown>,
  formProps: Record<string, unknown> = {},
) {
  vi.spyOn(console, "warn").mockImplementation(() => {});
  vi.spyOn(console, "error").mockImplementation(() => {});
  const h = await openAdr280Preview(["Form", "Button"]);
  const [formId, button] = h.ids as [NodeId, NodeId];
  const fieldId = "project:node:cascader-in-form" as NodeId;
  const library = h.workspace.runtime.graph.library;
  h.workspace.execute(
    insertNodes({
      parent: { kind: "node", id: formId },
      entries: [
        {
          kind: "node",
          id: fieldId,
          definitionId: catalogPaletteDefinitionId(library, "Cascader"),
          children: [],
          props: {},
          visual: {},
          sizing: {},
          descendantOverrides: [],
        } as NodeEntry,
      ],
      rootIds: [fieldId],
      newId: h.workspace.newId,
    }),
  );
  // (These cases are the `columns` mode's — the default is `drill`, 사용자 결정 2026-11-29.)
  h.declare(fieldId, { mode: "columns", ...cascader } as never);
  if (Object.keys(formProps).length) h.declare(formId, formProps as never);
  h.rule(formId, "onSubmit", { opcode: "toast", message: "submitted" });
  h.rule(button, "onPress", {
    opcode: "capability",
    target: { nodeId: formId },
    capabilityId: "submit",
  });
  h.flush();
  await act(async () => new Promise((r) => setTimeout(r, 200)));
  const formEl = () => h.element(formId)!.closest("form") ?? h.element(formId)!;
  let entries: [string, string][] | undefined;
  formEl().addEventListener("submit", (event) => {
    entries = [...new FormData(event.target as HTMLFormElement).entries()]
      .filter(([key]) => key === "region")
      .map(([key, value]) => [key, String(value)]);
  });
  const field = () => h.element(fieldId)!;
  const opener = () =>
    field().querySelector("button[aria-haspopup]") as HTMLButtonElement;
  const submit = () => {
    entries = undefined;
    // (The Form origin's own TextField is required — only the Cascader's check is under test.)
    formEl()
      .querySelectorAll("input")
      .forEach((input) => {
        if (!field().contains(input)) input.removeAttribute("required");
      });
    act(() => {
      fireEvent.click(h.element(button)!);
    });
    h.flush();
  };
  return {
    ...h,
    field,
    opener,
    submit,
    entries: () => entries,
    inputs: () => [...field().querySelectorAll("input")],
  };
}

describe("ADR-322 G6 — a Cascader's form value · required check (breakdown §3.1)", () => {
  it("native · required · empty: no submit, the error shows, focus on the open Button; one `required` input", async () => {
    const h = await form({ name: "region", isRequired: true });
    expect(
      h.inputs().map((i) => [i.name, i.value, i.type, i.required]),
    ).toEqual([["region", "", "text", true]]);
    expect(h.inputs()[0]!.style.display).toBe("none");
    h.submit();
    expect(h.toasts).toEqual([]);
    expect(h.field().getAttribute("data-invalid")).toBe("true");
    expect(document.activeElement).toBe(h.opener());
    h.view.unmount();
  });

  it("native · required · a value: submits with the key; several keys = the name's values", async () => {
    const one = await form({
      name: "region",
      isRequired: true,
      defaultValue: "desktops",
    });
    one.submit();
    expect(one.toasts).toEqual(["submitted"]);
    expect(one.entries()).toEqual([["region", "desktops"]]);
    one.view.unmount();
    vi.restoreAllMocks();
    // (Several keys — picked: Books, then Electronics › Computers › Desktops; the menu stays open.)
    const many = await form({ name: "region", selectionMode: "multiple" });
    const user = userEvent.setup();
    const item = (name: string) =>
      [...document.querySelectorAll('[role^="menuitem"]')].find(
        (el) => rowName(el) === name,
      ) as HTMLElement;
    many.opener().focus();
    await user.keyboard("{Enter}");
    for (let i = 0; i < 20 && !item("Books"); i++) await settle();
    // (The search field holds focus — always there, 2026-11-28 사용자 결정 — so the items are pressed:
    //  a multiple menu stays open after a press, a branch press opens its submenu — RAC's.)
    await user.click(item("Books"));
    await settle();
    for (const branch of ["Electronics", "Computers"]) {
      for (let i = 0; i < 20 && !item(branch); i++) await settle();
      await user.click(item(branch));
      await settle();
      await settle();
    }
    for (let i = 0; i < 20 && !item("Desktops"); i++) await settle();
    await user.click(item("Desktops"));
    await settle();
    await user.keyboard("{Escape}{Escape}{Escape}");
    await settle();
    expect(many.inputs().map((i) => i.value)).toEqual(["books", "desktops"]);
    many.submit();
    expect(many.entries()).toEqual([
      ["region", "books"],
      ["region", "desktops"],
    ]);
    many.view.unmount();
  });

  it("disabled: empty and required does not block; a value is not carried", async () => {
    const empty = await form({
      name: "region",
      isRequired: true,
      isDisabled: true,
    });
    empty.submit();
    expect(empty.toasts).toEqual(["submitted"]);
    expect(empty.entries()).toEqual([]);
    empty.view.unmount();
    vi.restoreAllMocks();
    const full = await form({
      name: "region",
      isDisabled: true,
      defaultValue: "books",
    });
    full.submit();
    expect(full.entries()).toEqual([]);
    full.view.unmount();
  });

  it("not required, empty: submits one empty value", async () => {
    const h = await form({ name: "region" });
    h.submit();
    expect(h.toasts).toEqual(["submitted"]);
    expect(h.entries()).toEqual([["region", ""]]);
    h.view.unmount();
  });

  it("no name: required checks (no submit while empty) and carries nothing; not required draws no input", async () => {
    const empty = await form({ isRequired: true });
    expect(empty.inputs().map((i) => [i.name, i.required])).toEqual([
      ["", true],
    ]);
    empty.submit();
    expect(empty.toasts).toEqual([]);
    expect(document.activeElement).toBe(empty.opener());
    empty.view.unmount();
    vi.restoreAllMocks();
    const full = await form({ isRequired: true, defaultValue: "books" });
    full.submit();
    expect(full.toasts).toEqual(["submitted"]);
    full.view.unmount();
    vi.restoreAllMocks();
    const none = await form({});
    expect(none.inputs()).toEqual([]);
    none.view.unmount();
  });

  it("aria Form: a required empty field submits (the input is `hidden`, no `required`)", async () => {
    const h = await form(
      { name: "region", isRequired: true },
      { validationBehavior: "aria" },
    );
    expect(h.inputs().map((i) => [i.type, i.required])).toEqual([
      ["hidden", false],
    ]);
    h.submit();
    expect(h.toasts).toEqual(["submitted"]);
    expect(h.entries()).toEqual([["region", ""]]);
    h.view.unmount();
  });
});
