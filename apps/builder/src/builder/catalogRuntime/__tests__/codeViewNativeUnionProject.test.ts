import { expect, it } from "vitest";
import { openAdr296 } from "../../../preview/catalog/__tests__/support/adr296Harness";
import { setProjectVariable } from "../../../../../../packages/shared/src/catalog/commands/data";
import { generateProjectStateFile } from "../../../../../../packages/shared/src/codeView/files/definitions";
import type {
  ProjectVariableEntry,
  StateVariableEntry,
} from "../../../../../../packages/shared/src/catalog/document/types";
import { planCodeViewProjectState } from "../codeViewData";

it("project native unions retain their TS types and values through editable Code", async () => {
  const h = await openAdr296();
  try {
    for (const [name, valueType, defaultValue] of [
      ["keys", "selectionKeys", "all"],
      ["focus", "autoFocus", "last"],
      ["emptyKeys", "selectionKeys", undefined],
      ["emptyFocus", "autoFocus", undefined],
    ] as const) {
      h.run(
        setProjectVariable({
          entry: {
            kind: "projectVariable",
            id: `data:variable:${name}`,
            name,
            valueType,
            ...(defaultValue === undefined ? {} : { defaultValue }),
            persist: false,
          },
        }),
      );
    }
    const baseline = generateProjectStateFile({ reader: h.graph() });
    expect(baseline.code).toContain("keys: 'all' as string[] | 'all'");
    expect(baseline.code).toContain(
      "focus: 'last' as boolean | 'first' | 'last'",
    );
    expect(baseline.code).toContain("emptyKeys: [] as string[] | 'all'");
    expect(baseline.code).toContain(
      "emptyFocus: false as boolean | 'first' | 'last'",
    );
    const rejected: unknown[] = [];
    const plan = (edited: string) =>
      planCodeViewProjectState({
        reader: h.graph(),
        baselineNames: baseline.symbols.variables,
        edited,
        reject: (...problem) => {
          rejected.push(problem);
        },
      });
    expect(plan(baseline.code)).toEqual([]);
    const edited = baseline.code
      .replace("keys: 'all' as", "keys: ['two'] as")
      .replace("focus: 'last' as", "focus: false as");
    for (const step of plan(edited)) h.run(step);
    expect(rejected).toEqual([]);
    const keys = h
      .graph()
      .getEntry("data:variable:keys") as ProjectVariableEntry;
    const focus = h
      .graph()
      .getEntry("data:variable:focus") as ProjectVariableEntry;
    expect([keys.valueType, keys.defaultValue]).toEqual([
      "selectionKeys",
      ["two"],
    ]);
    expect([focus.valueType, focus.defaultValue]).toEqual(["autoFocus", false]);
    plan(edited.replace("focus: false as", "focus: 'invalid' as"));
    expect(rejected.length).toBeGreaterThan(0);
  } finally {
    h.workspace.dispose();
  }
});

it("page native union state remains editable without changing its declared type", async () => {
  const h = await openAdr296();
  try {
    const group = h.add("SelectBoxGroup");
    const keys = h.variable("nativeKeys", "selectionKeys", "all");
    const focus = h.variable("nativeFocus", "autoFocus", "last");
    h.declare(group, {
      selectedKeys: { kind: "var", ref: `!var.${keys}` },
      autoFocus: { kind: "var", ref: `!var.${focus}` },
    });
    const code = h.code();
    const edited = code
      .replace(
        "useState<string[] | 'all'>('all')",
        "useState<string[] | 'all'>(['two'])",
      )
      .replace(
        "useState<boolean | 'first' | 'last'>('last')",
        "useState<boolean | 'first' | 'last'>(false)",
      );
    expect(edited).not.toBe(code);
    const result = h.apply(edited);
    expect(result.rejected).toEqual([]);
    expect(result.applied).toBe(true);
    const keyEntry = h.graph().getEntry(keys) as StateVariableEntry;
    const focusEntry = h.graph().getEntry(focus) as StateVariableEntry;
    expect([keyEntry.valueType, keyEntry.defaultValue]).toEqual([
      "selectionKeys",
      ["two"],
    ]);
    expect([focusEntry.valueType, focusEntry.defaultValue]).toEqual([
      "autoFocus",
      false,
    ]);
  } finally {
    h.workspace.dispose();
  }
});
