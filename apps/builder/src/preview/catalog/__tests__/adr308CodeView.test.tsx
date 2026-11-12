import { afterEach, describe, expect, it, vi } from "vitest";
import { openAdr296 } from "./support/adr296Harness";

/**
 * ADR-308 G3 (b) — the Code view writes the selection as the reference does: the group's key prop
 * once (`<Tabs defaultSelectedKey="tab-2">`) and each item's `id` once (`<Tab id="tab-1">` — no
 * second `id=` from an HTML id, R6). An unchanged apply writes nothing; an edited group key reads
 * back into the group's prop.
 */
afterEach(() => vi.restoreAllMocks());

const count = (text: string, find: string) => text.split(find).length - 1;

describe("ADR-308 G3 (b) — the selection in the Code view", () => {
  it("Tabs: the group key and the item ids once each, and back", async () => {
    vi.spyOn(console, "warn").mockImplementation(() => {});
    const h = await openAdr296();
    const tabs = h.add("Tabs");
    h.declare(tabs, { defaultSelectedKey: "tab-2" });
    const code = h.code();
    expect(count(code, 'defaultSelectedKey="tab-2"')).toBe(1);
    expect(count(code, '<Tab id="tab-1"')).toBe(1);
    expect(count(code, '<Tab id="tab-2"')).toBe(1);
    expect(code).not.toContain("isSelected");

    const revision = h.graph().revision;
    expect(h.apply(code).rejected ?? []).toEqual([]);
    expect(h.graph().revision).toBe(revision);

    const edited = code.replace(
      'defaultSelectedKey="tab-2"',
      'defaultSelectedKey="tab-1"',
    );
    expect(h.apply(edited).rejected ?? []).toEqual([]);
    expect(h.node(tabs).props.defaultSelectedKey).toEqual({
      kind: "set",
      value: "tab-1",
    });
    expect(count(h.code(), 'defaultSelectedKey="tab-1"')).toBe(1);
  });

  it("ListBox: the group keys and the item ids, and back", async () => {
    vi.spyOn(console, "warn").mockImplementation(() => {});
    const h = await openAdr296();
    const list = h.add("ListBox", { selectionMode: "multiple" });
    h.declare(list, { defaultSelectedKeys: ["starred"] });
    const code = h.code();
    expect(count(code, "defaultSelectedKeys={['starred']}")).toBe(1);
    for (const key of ["inbox", "starred", "archive"])
      expect(count(code, `<ListBoxItem id="${key}"`)).toBe(1);
    expect(code).not.toContain("isSelected");

    const edited = code.replace(
      "defaultSelectedKeys={['starred']}",
      "defaultSelectedKeys={['archive']}",
    );
    expect(h.apply(edited).rejected ?? []).toEqual([]);
    expect(h.node(list).props.defaultSelectedKeys).toEqual({
      kind: "set",
      value: ["archive"],
    });
  });

  it.each([
    ["CheckboxGroup", "value", "option1", "option2"],
    ["Accordion", "expandedKeys", "section-1", "section-2"],
  ] as const)("%s: its %s list reads back", async (type, prop, from, to) => {
    vi.spyOn(console, "warn").mockImplementation(() => {});
    const h = await openAdr296();
    const group = h.add(type);
    h.declare(group, { [prop]: [from] });
    const code = h.code();
    expect(count(code, `${prop}={['${from}']}`)).toBe(1);
    const edited = code.replace(`${prop}={['${from}']}`, `${prop}={['${to}']}`);
    expect(h.apply(edited).rejected ?? []).toEqual([]);
    expect(h.node(group).props[prop]).toEqual({ kind: "set", value: [to] });
  });
});
