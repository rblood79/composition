import { expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { getCatalogEntry } from "../../../../../../packages/shared/src/catalog/componentCatalog";
import { getPaletteItems } from "../../panels/components/paletteItems";
import { openAdr296 } from "../../../preview/catalog/__tests__/support/adr296Harness";
import { catalogEditContract } from "../editContract";

const TYPES = [
  "ActionBar",
  "LinkButton",
  "LabeledValue",
  "RangeSlider",
  "SegmentedControl",
  "SelectBoxGroup",
] as const;

it("both production CSS bundles load the new component and item sheets", () => {
  for (const bundle of ["index.css", "builder-components.css"]) {
    const css = readFileSync(
      resolve(
        __dirname,
        `../../../../../../packages/shared/src/components/styles/${bundle}`,
      ),
      "utf8",
    );
    for (const type of [...TYPES, "SegmentedControlItem", "SelectBox"])
      expect(css).toContain(`@import "./generated/${type}.css";`);
  }
});

it.each(TYPES)(
  "%s is independently insertable, editable and represented in Code View",
  async (type) => {
    expect(getPaletteItems().some((item) => item.type === type)).toBe(true);
    expect(getCatalogEntry(type)).toBeDefined();
    const h = await openAdr296();
    try {
      const id = h.add(type);
      const target = { kind: "node" as const, id };
      const contract = catalogEditContract(
        h.graph(),
        h.workspace.readModel,
        target,
      );
      expect(contract.fields.length).toBeGreaterThan(0);
      expect(
        [...h.workspace.root.domInputs.values()].some(
          (record) => h.workspace.root.typeOf(record) === type,
        ),
      ).toBe(true);
      const root = [...h.workspace.root.domInputs.values()].find(
        (record) => h.workspace.root.typeOf(record) === type,
      )!;
      expect(root.children.length).toBeGreaterThan(0);
      expect(h.code()).toMatch(new RegExp(`<${type}(?:\\s|>)`));
      h.workspace.undo();
      expect(h.graph().getEntry(id)).toBeUndefined();
      h.workspace.redo();
      expect(h.graph().getEntry(id)).toBeDefined();
      expect(h.code()).toMatch(new RegExp(`<${type}(?:\\s|>)`));
    } finally {
      h.workspace.dispose();
    }
  },
);

it("a RangeSlider capability retains the endpoint object in document and Code View", async () => {
  const h = await openAdr296();
  try {
    const range = h.add("RangeSlider");
    const button = h.add("Button");
    h.rules(button, [
      {
        trigger: "onPress",
        actions: [
          {
            opcode: "capability",
            target: { nodeId: range },
            capabilityId: "setValue",
            value: { start: 15, end: 85 },
          },
        ],
      },
    ]);
    expect(h.rulesOf(button)[0]!.actions[0]).toMatchObject({
      value: { start: 15, end: 85 },
    });
    expect(h.code()).toMatch(/start:\s*15/);
    expect(h.code()).toMatch(/end:\s*85/);
    h.declare(button, { label: "Set range before" });
    const applied = h.apply(
      h.code().replace("Set range before", "Set range after"),
    );
    expect(applied.rejected).toEqual([]);
    expect(h.rulesOf(button)[0]!.actions[0]).toMatchObject({
      value: { start: 15, end: 85 },
    });
  } finally {
    h.workspace.dispose();
  }
});
