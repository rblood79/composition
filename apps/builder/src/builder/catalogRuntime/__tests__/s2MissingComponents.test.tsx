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

it("SegmentedControl and Item expose the audited S2/RAC props and retain them in Code", async () => {
  const h = await openAdr296();
  try {
    const group = h.add("SegmentedControl", {
      slot: "view",
      orientation: "vertical",
      defaultSelectedKey: "second",
      "aria-describedby": "help",
    });
    const item = h.add(
      "SegmentedControlItem",
      {
        id: "extra",
        slot: "option",
        autoFocus: true,
        "aria-label": "Extra mode",
      },
      group,
    );
    for (const [id, keys] of [
      [
        group,
        [
          "orientation",
          "defaultSelectedKey",
          "aria-labelledby",
          "aria-describedby",
          "aria-details",
        ],
      ],
      [
        item,
        ["autoFocus", "aria-labelledby", "aria-describedby", "aria-details"],
      ],
    ] as const) {
      const contract = catalogEditContract(h.graph(), h.workspace.readModel, {
        kind: "node",
        id,
      });
      expect(
        contract.fields.find((field) => field.key === "slot")?.editorHidden,
      ).toBe(true);
      // (`aria-label` is edited in the Properties Accessibility section — every type's axis; a Content
      //  field would show it twice, 2026-09-15 · `contractFieldDuplicates`. Code keeps it.)
      expect(
        contract.fields.find((field) => field.key === "aria-label")
          ?.editorHidden,
      ).toBe(true);
      expect(
        contract.fields
          .filter((field) => !field.editorHidden)
          .map((field) => field.key),
      ).toEqual(expect.arrayContaining([...keys]));
    }
    expect(h.code()).toContain('orientation="vertical"');
    expect(h.code()).toContain('slot="view"');
    expect(h.code()).toContain('defaultSelectedKey="second"');
    expect(h.code()).toContain('slot="option"');
    expect(h.code()).toContain("autoFocus");
    h.declare(group, { slot: false });
    expect(h.code()).toContain("slot={null}");
    const applied = h.apply(h.code().replace("Extra mode", "Edited mode"));
    expect(applied.rejected).toEqual([]);
    expect(applied.applied).toBe(true);
    expect(h.graph().getEntry(group)).toMatchObject({
      props: { slot: { kind: "set", value: false } },
    });
  } finally {
    h.workspace.dispose();
  }
});

// ADR-305 — 빌더 문서는 사용자 컴포넌트 시트를 싣지 않는다 (빌더 위젯은 styles/widgets/ 사본). 사용자 번들만.
it("the user component CSS bundle loads the new component and item sheets", () => {
  for (const bundle of ["index.css"]) {
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
