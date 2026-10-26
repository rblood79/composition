import { describe, expect, it } from "vitest";
import { validateCatalogEntry } from "../../document/validation";
import { catalogPropValueFits } from "../../document/valueType";
import { catalogPropWhenValue } from "../stateTemplate";
import { createRuntimeState } from "../../../state/runtimeState";

/**
 * ADR-284 Phase 6 — the acceptance set's ios-list in the format: a boolean prop's value condition
 * (`PropWhen`), a text variable's toggle between its default and a value, and a single selection's
 * key written into a text variable (the photos sidebar).
 */
const env = (values: Record<string, unknown>) => ({
  byId: (id: string) => (id in values ? { value: values[id] } : undefined),
});

describe("ADR-284 Phase 6 — a prop's value condition", () => {
  it("is a boolean prop's value only; its subject is a variable; its value follows the comparison", () => {
    const when = {
      kind: "when",
      subject: "!var.project:stateVariable:sel",
      op: "notExists",
    };
    expect(catalogPropValueFits(when, "boolean")).toBe(true);
    expect(catalogPropValueFits(when, "string")).toBe(false);
    const node = (isDisabled: unknown) => ({
      kind: "node",
      id: "project:node:n",
      definitionId: "lib:definition:button",
      children: [],
      props: { isDisabled: { kind: "set", value: isDisabled } },
      visual: {},
      sizing: {},
      descendantOverrides: [],
    });
    expect(() => validateCatalogEntry(node(when))).not.toThrow();
    expect(() =>
      validateCatalogEntry(node({ ...when, subject: "!event.keys" })),
    ).toThrow(/subject/);
    expect(() => validateCatalogEntry(node({ ...when, value: 0 }))).toThrow(
      /value/,
    );
    expect(() => validateCatalogEntry(node({ ...when, op: "equals" }))).toThrow(
      /value/,
    );
    expect(() =>
      validateCatalogEntry(node({ ...when, op: "equals", value: 0 })),
    ).not.toThrow();
  });

  it('verdict: a selection empty · its count · "all" · an unknown variable is false', () => {
    const empty = {
      kind: "when" as const,
      subject: "!var.sel",
      op: "notExists" as const,
    };
    expect(catalogPropWhenValue(empty, env({ sel: [] }))).toBe(true);
    expect(catalogPropWhenValue(empty, env({ sel: ["m1"] }))).toBe(false);
    const none = {
      kind: "when" as const,
      subject: "!var.sel.size",
      op: "equals" as const,
      value: 0,
    };
    expect(catalogPropWhenValue(none, env({ sel: [] }))).toBe(true);
    expect(catalogPropWhenValue(none, env({ sel: ["m1", "m2"] }))).toBe(false);
    // (`'all'` is not an empty selection — the reference's `selectedKeys !== 'all' && …`.)
    expect(catalogPropWhenValue(none, env({ sel: "all" }))).toBe(false);
    expect(catalogPropWhenValue(empty, env({ sel: "all" }))).toBe(false);
    expect(catalogPropWhenValue(empty, env({}))).toBe(false);
    // (A text variable against another variable.)
    expect(
      catalogPropWhenValue(
        {
          kind: "when",
          subject: "!var.mode",
          op: "equals",
          value: "!var.edit",
        },
        env({ mode: "multiple", edit: "multiple" }),
      ),
    ).toBe(true);
  });
});

describe("ADR-284 Phase 6 — a text variable's toggle · a single selection's key", () => {
  it("toggles between its default and the value; a one-key selection writes its key", () => {
    const rt = createRuntimeState({ projectId: "p1", storage: null });
    rt.setDefinitions({
      projectVariables: [
        {
          id: "mode",
          name: "selectionMode",
          type: "string",
          defaultValue: "none",
        },
        { id: "album", name: "album", type: "string", defaultValue: "library" },
      ],
      variables: [],
    });
    expect(
      rt.write({ variableId: "mode", op: "toggle", value: "multiple" }),
    ).toMatchObject({
      ok: true,
      value: "multiple",
    });
    expect(
      rt.write({ variableId: "mode", op: "toggle", value: "multiple" }),
    ).toMatchObject({
      ok: true,
      value: "none",
    });
    expect(rt.write({ variableId: "mode", op: "toggle" })).toMatchObject({
      ok: false,
      reason: "toggle-requires-boolean",
    });
    expect(
      rt.write({ variableId: "album", op: "set", value: ["travel"] }),
    ).toMatchObject({
      value: "travel",
    });
    expect(
      rt.write({ variableId: "album", op: "set", value: [] }),
    ).toMatchObject({
      value: "",
    });
    expect(
      rt.write({ variableId: "album", op: "set", value: ["a", "b"] }),
    ).toMatchObject({
      value: '["a","b"]',
    });
  });
});
