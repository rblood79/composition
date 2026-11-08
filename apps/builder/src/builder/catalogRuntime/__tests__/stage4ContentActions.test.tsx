import { act } from "react";
import { createRoot } from "react-dom/client";
import { expect, it } from "vitest";
import { buildCodeCatalogLibrary } from "../../../../../../packages/shared/src/catalog/document/codeCatalogLibrary";
import {
  catalogLabeledValueFits,
  formatLabeledValue,
  type LabeledValue as StoredLabeledValue,
} from "../../../../../../packages/shared/src/catalog/document/labeledValue";
import { setSiteSettings } from "../../../../../../packages/shared/src/catalog/commands/project";
import { COMPONENT_RULES_TABLE } from "../../../../../../packages/shared/src/catalog/generated/componentRulesTable";
import { LinkButton } from "../../../../../../packages/shared/src/components/LinkButton";
import { LabeledValue } from "../../../../../../packages/shared/src/components/LabeledValue";
import { openAdr296 } from "../../../preview/catalog/__tests__/support/adr296Harness";
import {
  catalogEditContract,
  catalogPropertiesPatchCommand,
} from "../editContract";
import { renderCatalogDom } from "../domBinding";

it("LinkButton shares Button visuals and keeps a separate navigation origin", async () => {
  const library = await buildCodeCatalogLibrary();
  expect(COMPONENT_RULES_TABLE.LinkButton.sizes).toBe(
    COMPONENT_RULES_TABLE.Button.sizes,
  );
  expect(
    COMPONENT_RULES_TABLE.LinkButton.structure?.composition?.rootSelectors,
  ).toMatchObject({ "&": { styles: { "text-decoration": "none" } } });
  const type = library.definitions.get("lib:definition:type-LinkButton");
  expect(type?.bindingId).toBe("linkbutton");
  expect(type?.ruleId).toBe("LinkButton");
  expect(
    library.definitions.get("lib:definition:origin-component-linkbutton")
      ?.accepts.href,
  ).toBe("string");
});

it("LabeledValue formats numbers, lists and ranges through shared locale formatting", () => {
  expect(formatLabeledValue(1200, "en-US")).toBe("1,200");
  expect(formatLabeledValue(["A", "B"], "en-US")).toBe("A and B");
  expect(formatLabeledValue({ start: 1, end: 3 }, "en-US")).toContain("3");
  expect(
    formatLabeledValue({ kind: "date", value: "2026-11-07" }, "en-US"),
  ).toContain("2026");
  expect(catalogLabeledValueFits({ start: 5, end: 2 })).toBe(false);
  expect(catalogLabeledValueFits({ kind: "date", value: "2026-02-30" })).toBe(
    false,
  );
  expect(catalogLabeledValueFits({ kind: "time", value: "12:00:99" })).toBe(
    false,
  );
  expect(
    formatLabeledValue(["A", "B"], "en-US", {
      style: "currency",
      currency: "USD",
    }),
  ).toBe("A and B");
  expect(
    formatLabeledValue(1200, "en-US", { type: "conjunction", style: "long" }),
  ).toBe("1,200");
});

it("LabeledValue owns editable label and value Text parts", async () => {
  const library = await buildCodeCatalogLibrary();
  expect(
    library.templates.get("lib:template:component-labeledvalue")?.children,
  ).toHaveLength(2);
  expect(
    library.definitions.get("lib:definition:type-LabeledValue")?.accepts.value,
  ).toBe("labeledValue");
});

it.each(["LinkButton", "LabeledValue"])(
  "%s palette instance edits real parts and generates executable imports",
  async (type) => {
    const h = await openAdr296();
    h.add(type);
    const root = h.workspace.root;
    const owner = [...root.domInputs.values()].find(
      (node) => root.typeOf(node) === type,
    )!;
    expect(owner).toBeDefined();
    if (type === "LinkButton") {
      expect(owner.props.target).toBeUndefined();
      expect(owner.props.rel).toBeUndefined();
    }
    const target = h.workspace.positionOfRecord(owner.id)!.target;
    const fields = catalogEditContract(
      h.graph(),
      h.workspace.readModel,
      target,
    ).fields;
    const patch =
      type === "LinkButton"
        ? { label: "Open details", href: "#details" }
        : {
            label: "Total",
            value: 1200,
            formatOptions: { style: "currency", currency: "USD" },
          };
    const command = catalogPropertiesPatchCommand(
      h.graph(),
      [target],
      patch,
      (key) => fields.find((field) => field.key === key)?.currentValue,
      new Set(),
    );
    expect(command).toBeDefined();
    h.run(command!);
    const code = h.code();
    expect(code).toContain(type);
    expect(code).toContain("@composition/shared/components");
    const host = document.createElement("div");
    document.body.append(host);
    const renderer = createRoot(host);
    try {
      await act(async () => renderer.render(renderCatalogDom(root, owner.id)));
      if (type === "LinkButton") {
        expect(host.querySelector("a")?.getAttribute("href")).toBe("#details");
        expect(host.textContent).toBe("Open details");
      } else {
        expect(host.textContent).toContain("Total");
        expect(host.textContent).toContain("1,200.00");
      }
      h.workspace.undo();
      await act(async () => renderer.render(renderCatalogDom(root, owner.id)));
      expect(host.textContent).not.toContain(
        type === "LinkButton" ? "Open details" : "1,200.00",
      );
    } finally {
      await act(async () => renderer.unmount());
      host.remove();
      h.workspace.dispose();
    }
  },
);

it("exported Code View components run outside a catalog runtime", async () => {
  const host = document.createElement("div");
  document.body.append(host);
  const root = createRoot(host);
  try {
    await act(async () =>
      root.render(
        <>
          <LinkButton href="#target">Open</LinkButton>
          <LabeledValue label="Total" value={1234} />
        </>,
      ),
    );
    expect(host.querySelector("a")?.getAttribute("href")).toBe("#target");
    expect(host.textContent).toContain("1,234");
    await act(async () =>
      root.render(
        <LabeledValue label="Ignore" value="Ignore">
          <span>Authored custom value</span>
        </LabeledValue>,
      ),
    );
    expect(host.textContent).toBe("Authored custom value");
  } finally {
    await act(async () => root.unmount());
    host.remove();
  }
});

it("structured values survive document commands and resolve into authored Text", async () => {
  const h = await openAdr296();
  // The formatted Text follows the site's language (else the machine's — `Intl` with no locale);
  // pin it so the expectation below does not read the test machine's locale.
  h.workspace.execute(setSiteSettings({ patch: { lang: "en-US" } }));
  const id = h.add("LabeledValue");
  const samples: StoredLabeledValue[] = [
    1234,
    ["Alpha", "Beta"],
    { start: 2, end: 5 },
    { kind: "date", value: "2026-11-07" },
    { kind: "time", value: "12:30" },
    {
      start: { kind: "date", value: "2026-11-07" },
      end: { kind: "date", value: "2026-11-09" },
    },
  ];
  try {
    for (const value of samples) {
      h.declare(id, { value });
      const root = h.workspace.root;
      const owner = [...root.domInputs.values()].find(
        (node) => root.typeOf(node) === "LabeledValue",
      )!;
      const text = owner.children
        .map((id) => root.domInputs.get(id)!)
        .find((node) => node.props.slot === "value")!;
      expect(text.derivedProps?.children).toBe(
        formatLabeledValue(value, "en-US"),
      );
      expect(String(text.derivedProps?.children)).not.toContain(
        "[object Object]",
      );
      expect(h.code()).not.toContain("[object Object]");
    }
  } finally {
    h.workspace.dispose();
  }
});

it("Code View label edits preserve a structured date value", async () => {
  const h = await openAdr296();
  const id = h.add("LabeledValue");
  try {
    h.declare(id, {
      label: "Roundtrip before",
      value: { kind: "date", value: "2026-11-07" },
    });
    const before = h.code();
    expect(before).toContain("Roundtrip before");
    const applied = h.apply(
      before.replace("Roundtrip before", "Roundtrip after"),
    );
    expect(applied.rejected).toEqual([]);
    const owner = [...h.workspace.root.domInputs.values()].find(
      (node) => h.workspace.root.typeOf(node) === "LabeledValue",
    )!;
    expect(owner.props.label).toBe("Roundtrip after");
    expect(owner.props.value).toEqual({ kind: "date", value: "2026-11-07" });
  } finally {
    h.workspace.dispose();
  }
});
