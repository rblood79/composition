import { createElement } from "react";
import { fireEvent, render } from "@testing-library/react";
import { expect, it } from "vitest";
import { SelectionKeysField } from "../../panels/properties/generic/SelectionKeysField";
import { AutoFocusField } from "../../panels/properties/generic/AutoFocusField";
import { catalogSelectionKeysFits } from "../../../../../../packages/shared/src/catalog/document/selectionKeysValue";
import { catalogAutoFocusFits } from "../../../../../../packages/shared/src/catalog/document/autoFocusValue";
import {
  createRuntimeState,
  coerceRuntimeValue,
} from "../../../../../../packages/shared/src/state/runtimeState";
import { resolveStateTemplateProps } from "../../../../../../packages/shared/src/state/template";
import {
  IMPLICIT_STATE_SOURCES,
  normalizeImplicitStateValue,
} from "../../../../../../packages/shared/src/state/implicitState";
import { variableDefaultForType } from "../../../../../../packages/shared/src/catalog/runtime/variableTypeChange";
import { openAdr296 } from "../../../preview/catalog/__tests__/support/adr296Harness";
import {
  catalogEditContract,
  catalogPropertiesPatchCommand,
} from "../editContract";

it("selection keys and autofocus editors preserve arrays/all and boolean/strategy shapes", () => {
  let next: unknown;
  const view = render(
    createElement(SelectionKeysField, {
      label: "Selected keys",
      value: ["one"],
      onChange: (value) => {
        next = value;
      },
    }),
  );
  fireEvent.click(view.getByRole("button", { name: "All" }));
  expect(next).toBe("all");
  view.rerender(
    createElement(SelectionKeysField, {
      label: "Selected keys",
      value: "all",
      onChange: (value) => {
        next = value;
      },
    }),
  );
  fireEvent.click(view.getByRole("button", { name: "All" }));
  expect(next).toEqual([]);
  view.rerender(
    createElement(AutoFocusField, {
      label: "Auto Focus",
      value: false,
      onChange: (value) => {
        next = value;
      },
    }),
  );
  fireEvent.click(view.getByRole("button", { name: "First" }));
  expect(next).toBe("first");
  fireEvent.click(view.getByRole("button", { name: "On" }));
  expect(next).toBe(true);
  fireEvent.click(view.getByRole("button", { name: "Off" }));
  expect(next).toBe(false);
  view.unmount();
  expect(catalogSelectionKeysFits(["0", "two"])).toBe(true);
  expect(catalogSelectionKeysFits([0])).toBe(false);
  expect(catalogSelectionKeysFits("one,two")).toBe(false);
  expect(catalogAutoFocusFits("last")).toBe(true);
  expect(catalogAutoFocusFits("true")).toBe(false);
});

it("native state-variable writes and whole templates retain selection/all and focus strategy", () => {
  const runtime = createRuntimeState({
    projectId: "selectbox-audit",
    storage: null,
  });
  runtime.setDefinitions({
    projectVariables: [
      { id: "keys", name: "keys", type: "selectionKeys" },
      { id: "focus", name: "focus", type: "autoFocus" },
    ],
  });
  expect(runtime.read("keys")).toEqual([]);
  expect(runtime.read("focus")).toBe(false);
  expect(
    runtime.write({ variableId: "keys", op: "set", value: "all" }).ok,
  ).toBe(true);
  expect(
    runtime.write({ variableId: "focus", op: "set", value: "last" }).ok,
  ).toBe(true);
  expect(
    resolveStateTemplateProps(
      { selectedKeys: "{{ keys }}", autoFocus: "{{ focus }}" },
      runtime.createEnv({ pageId: null }),
    ),
  ).toEqual({ selectedKeys: "all", autoFocus: "last" });
  expect(
    runtime.write({ variableId: "keys", op: "set", value: ["0", "two"] }).ok,
  ).toBe(true);
  expect(runtime.read("keys")).toEqual(["0", "two"]);
  expect(
    runtime.write({ variableId: "keys", op: "set", value: new Set(["two"]) })
      .ok,
  ).toBe(true);
  expect(runtime.read("keys")).toEqual(["two"]);
  expect(coerceRuntimeValue("selectionKeys", new Set([0])).ok).toBe(false);
  expect(coerceRuntimeValue("selectionKeys", [0]).ok).toBe(false);
  expect(coerceRuntimeValue("array", "all").ok).toBe(false);
  expect(coerceRuntimeValue("boolean", "first").ok).toBe(false);
  expect(variableDefaultForType("selectionKeys", "all", "project")).toBe("all");
  expect(variableDefaultForType("autoFocus", "last", "state")).toBe("last");
  expect(
    IMPLICIT_STATE_SOURCES.SelectBoxGroup.find(
      (source) => source.prop === "selectedKeys",
    )?.type,
  ).toBe("selectionKeys");
  expect(normalizeImplicitStateValue("selectionKeys", "all")).toBe("all");
});

it("the real Property command exposes SelectBox props and Code preserves native shapes", async () => {
  const h = await openAdr296();
  h.add("SelectBoxGroup");
  const owner = [...h.workspace.root.domInputs.values()].find(
    (node) => h.workspace.root.typeOf(node) === "SelectBoxGroup",
  )!;
  const target = h.workspace.positionOfRecord(owner.id)!.target;
  const fields = catalogEditContract(
    h.graph(),
    h.workspace.readModel,
    target,
  ).fields;
  for (const key of [
    "selectedKeys",
    "defaultSelectedKeys",
    "disabledKeys",
    "autoFocus",
    "escapeKeyBehavior",
    "slot",
    "aria-labelledby",
    "aria-describedby",
    "aria-details",
  ])
    expect(fields.find((field) => field.key === key)).toBeDefined();
  const command = catalogPropertiesPatchCommand(
    h.graph(),
    [target],
    {
      selectionMode: "multiple",
      selectedKeys: "all",
      defaultSelectedKeys: ["one"],
      disabledKeys: ["two"],
      autoFocus: "last",
      escapeKeyBehavior: "none",
      slot: false,
      "aria-labelledby": "heading",
      "aria-describedby": "help",
      "aria-details": "details",
    },
    (key) => fields.find((field) => field.key === key)?.currentValue,
    new Set(),
  );
  expect(command).toBeDefined();
  h.run(command!);
  const code = h.code();
  expect(code).toContain("@composition/shared/components");
  expect(code).toContain('selectedKeys="all"');
  expect(code).toMatch(/disabledKeys=\{\[['"]two['"]\]\}/);
  expect(code).toContain('autoFocus="last"');
  expect(code).toContain("slot={null}");
  h.workspace.dispose();
});

it("native selection variables emit direct all/array props and normalize RAC event Sets", async () => {
  const h = await openAdr296();
  const id = h.add("SelectBoxGroup");
  const keys = h.variable("nativeKeys", "selectionKeys", "all");
  const focus = h.variable("nativeFocus", "autoFocus", "last");
  h.declare(id, {
    selectedKeys: { kind: "var", ref: `!var.${keys}` },
    autoFocus: { kind: "var", ref: `!var.${focus}` },
  });
  h.rules(id, [
    {
      trigger: "onSelectionChange",
      actions: [
        {
          opcode: "setState",
          variableId: keys,
          op: "set",
          value: "!event.keys",
        },
      ],
    },
  ]);
  const code = h.code();
  expect(code).toContain("useState<string[] | 'all'>");
  expect(code).toContain("useState<boolean | 'first' | 'last'>");
  expect(code).toContain("selectedKeys={nativeKeys}");
  expect(code).not.toContain("selectedKeys={[nativeKeys]}");
  expect(code).toContain("autoFocus={nativeFocus}");
  expect(code).toMatch(/=== 'all' \? 'all' : \[\.\.\./);
  expect(code).not.toContain("new Set('all')");
  h.workspace.dispose();
});
