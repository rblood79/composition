import { createElement } from "react";
import { render, waitFor } from "@testing-library/react";
import { expect, it } from "vitest";
import { openAdr296 } from "../../../preview/catalog/__tests__/support/adr296Harness";
import { openAdr280Preview } from "../../../preview/catalog/__tests__/support/adr280Harness";
import { CatalogPreviewView } from "../../../preview/catalog/catalogPreviewApp";
import {
  catalogEditContract,
  catalogSemanticPatchCommand,
} from "../editContract";
import { catalogSubpartOwnerType } from "../subpart";
import { CatalogPropertiesBody } from "../../panels/properties/catalog/CatalogPropertiesPanel.components";
import { I18nProvider } from "../../../i18n";
import {
  catalogRacSlotConsumer,
  catalogRacSlotProvider,
} from "../../../../../../packages/shared/src/catalog/runtime/racSlot";
import type { NodeId } from "../../../../../../packages/shared/src/catalog/document/types";

it.each([
  ["LinkButton", "Link"],
  ["Link", "Link"],
  ["ActionButton", "Button"],
  ["RangeSlider", "Slider"],
  ["Slider", "Slider"],
  ["ActionBar", "ActionBar"],
])(
  "%s uses its real consumer and preserves slot names/detach through Code",
  async (type, consumer) => {
    const h = await openAdr296();
    try {
      const id = h.add(type);
      const contract = catalogEditContract(h.graph(), h.workspace.readModel, {
        kind: "node",
        id,
      });
      expect(
        contract.fields.find((field) => field.key === "slot")?.editorHidden,
      ).toBe(true);
      expect(catalogRacSlotConsumer(type)).toBe(consumer);
      h.declare(id, { slot: false });
      expect(h.code()).toContain("slot={null}");
      h.apply(h.code().replace("slot={null}", 'slot="provided"'));
      expect(h.node(id).props.slot).toEqual({ kind: "set", value: "provided" });
      h.apply(h.code().replace('slot="provided"', "slot={null}"));
      expect(h.node(id).props.slot).toEqual({ kind: "set", value: false });
    } finally {
      h.workspace.dispose();
    }
  },
);

it("SelectBox exposes the ListBoxItem Text slots and ActionBar exposes its clear Button slot", () => {
  expect(
    catalogRacSlotProvider("Text", ["frame", "SelectBox", "SelectBoxGroup"])
      ?.provision,
  ).toEqual({
    slots: ["label", "description"],
    hasDefault: true,
  });
  expect(
    catalogRacSlotProvider("ActionButton", ["frame", "ActionBar"])?.provision,
  ).toEqual({
    slots: ["clear"],
    hasDefault: true,
  });
});

it.each([
  ["SelectBoxGroup", "SelectBox", "Text", "ListBoxItem"],
  ["ActionBar", undefined, "ActionButton", "ActionBar"],
])(
  "%s newly inserted children retain their named slot provider",
  async (parentType, itemType, type, provider) => {
    const h = await openAdr296();
    try {
      const parent = h.add(parentType!);
      const owner = itemType ? h.add(itemType, {}, parent) : parent;
      const id = h.add(type!, {}, owner);
      const record = [...h.workspace.root.canvasInputs.values()].find(
        (node) =>
          node.sourceId === id && h.workspace.root.typeOf(node) === type,
      )!;
      expect(record).toBeTruthy();
      const ancestors = itemType ? [itemType, parentType!] : [parentType!];
      expect(catalogRacSlotProvider(type!, ancestors)?.provider).toBe(provider);
    } finally {
      h.workspace.dispose();
    }
  },
);

it.each(["LinkButton", "RangeSlider", "SelectBoxGroup"])(
  "%s receives body disabled in Canvas and Preview",
  async (type) => {
    const h = await openAdr280Preview([type]);
    try {
      h.declare("project:node:home-body" as NodeId, { isDisabled: true });
      const node = [...h.workspace.root.canvasInputs.values()].find(
        (entry) =>
          entry.sourceId === h.ids[0] &&
          h.workspace.root.typeOf(entry) === type,
      )!;
      expect(node.derivedProps?.isDisabled).toBe(true);
      const element = h.element(h.ids[0])!;
      expect(
        element.matches("[disabled],[data-disabled],[aria-disabled=true]") ||
          !!element.querySelector(
            "[disabled],[data-disabled],[aria-disabled=true]",
          ),
      ).toBe(true);
      if (type === "SelectBoxGroup") {
        const items = [...h.workspace.root.canvasInputs.values()].filter(
          (entry) => h.workspace.root.typeOf(entry) === "SelectBox",
        );
        expect(items.length).toBeGreaterThan(0);
        expect(
          items.every((entry) => entry.derivedProps?.isDisabled === true),
        ).toBe(true);
      }
      h.declare("project:node:home-body" as NodeId, { isDisabled: false });
      expect(
        h
          .element(h.ids[0])!
          .matches("[disabled],[data-disabled],[aria-disabled=true]"),
      ).toBe(false);
      expect(
        h
          .element(h.ids[0])!
          .querySelector("[disabled],[data-disabled],[aria-disabled=true]"),
      ).toBeNull();
    } finally {
      h.view.unmount();
      h.workspace.dispose();
    }
  },
);

it.each(["RangeSlider", "LabeledValue"])(
  "%s consumes Form label layout like existing fields",
  async (type) => {
    const h = await openAdr296();
    try {
      const form = h.add("Form", { labelPosition: "side", labelAlign: "end" });
      const id = h.add(type, {}, form);
      const record = () =>
        [...h.workspace.root.canvasInputs.values()].find(
          (node) =>
            node.sourceId === id && h.workspace.root.typeOf(node) === type,
        )!;
      expect(record().props).toMatchObject({
        labelPosition: "side",
        labelAlign: "end",
      });
      h.declare(id, { labelPosition: "top", labelAlign: "start" });
      expect(record().props).toMatchObject({
        labelPosition: "top",
        labelAlign: "start",
      });
    } finally {
      h.workspace.dispose();
    }
  },
);

it("LinkButton authored autoFocus reaches the Preview DOM", async () => {
  const h = await openAdr280Preview(["LinkButton"]);
  let view: ReturnType<typeof render> | undefined;
  try {
    h.declare(h.ids[0], { autoFocus: true });
    h.view.unmount();
    view = render(
      createElement(CatalogPreviewView, {
        session: h.session,
        runtime: h.runtime,
      }),
    );
    const element = view.container.querySelector(
      `[data-catalog-id$="::${h.ids[0]}"]`,
    );
    expect(element).not.toBeNull();
    await waitFor(() => expect(document.activeElement).toBe(element));
  } finally {
    view?.unmount();
    h.workspace.dispose();
  }
});

it.each(["Link", "LinkButton"])(
  "%s navigation and ARIA fields reach DOM and Code",
  async (type) => {
    const h = await openAdr280Preview([type]);
    try {
      h.declare(h.ids[0], {
        href: "/download",
        download: "report.pdf",
        hrefLang: "ko",
        referrerPolicy: "no-referrer",
        "aria-label": "Download report",
        "aria-current": "page",
        "aria-describedby": "report-help",
      });
      expect(h.element(h.ids[0])?.getAttribute("download")).toBe("report.pdf");
      expect(h.element(h.ids[0])?.getAttribute("hreflang")).toBe("ko");
      expect(h.element(h.ids[0])?.getAttribute("referrerpolicy")).toBe(
        "no-referrer",
      );
      expect(h.element(h.ids[0])?.getAttribute("aria-label")).toBe(
        "Download report",
      );
      expect(h.element(h.ids[0])?.getAttribute("aria-current")).toBe("page");
      expect(h.element(h.ids[0])?.getAttribute("aria-describedby")).toContain(
        "report-help",
      );
    } finally {
      h.view.unmount();
      h.workspace.dispose();
    }
    const code = await openAdr296();
    try {
      const id = code.add(type, {
        download: "report.pdf",
        "aria-label": "Download report",
      });
      expect(code.code()).toContain("@composition/shared/components");
      code.apply(
        code.code().replace('download="report.pdf"', 'download="updated.pdf"'),
      );
      expect(code.node(id).props.download).toEqual({
        kind: "set",
        value: "updated.pdf",
      });
    } finally {
      code.workspace.dispose();
    }
  },
);

it.each([
  ["ActionBar", "ActionButton", "clear"],
  ["SelectBoxGroup", "Text", "label"],
])(
  "%s default child Slot detach supports the semantic command and Undo/Redo",
  async (type, childType, slot) => {
    const h = await openAdr296();
    try {
      h.add(type);
      const child = () =>
        [...h.workspace.root.domInputs.values()].find(
          (node) =>
            h.workspace.root.typeOf(node) === childType &&
            node.props.slot === slot,
        )!;
      const record = child();
      const position = h.workspace.positionOfRecord(record.id)!;
      const command = catalogSemanticPatchCommand(
        [position.target],
        { slot: false },
        () => slot,
      )!;
      h.run(command);
      expect(h.workspace.root.domInputs.get(record.id)?.props.slot).toBe(false);
      h.workspace.undo();
      expect(h.workspace.root.domInputs.get(record.id)?.props.slot).toBe(slot);
      h.workspace.redo();
      expect(h.workspace.root.domInputs.get(record.id)?.props.slot).toBe(false);
    } finally {
      h.workspace.dispose();
    }
  },
);

it("a default bound SelectBox Text keeps its role without a RAC slot editor in Property", async () => {
  const h = await openAdr296();
  let ui: ReturnType<typeof render> | undefined;
  try {
    h.add("SelectBoxGroup");
    const root = h.workspace.root;
    const record = [...root.domInputs.values()].find(
      (node) => root.typeOf(node) === "Text" && node.props.slot === "label",
    )!;
    const position = h.workspace.positionOfRecord(record.id)!;
    const subpartOwner = catalogSubpartOwnerType(
      h.graph(),
      root.domInputs,
      record.id,
      "all",
    );
    expect(subpartOwner).toBe("SelectBox");
    const contract = catalogEditContract(
      h.graph(),
      h.workspace.readModel,
      position.target,
    );
    const body = createElement(CatalogPropertiesBody, {
      selection: {
        first: { identity: record.id, target: position.target },
        contract,
        targets: [position.target],
        title: "Text",
        subpartOwner,
        graph: h.graph(),
        workspace: h.workspace,
        root,
      },
    });
    ui = render(
      createElement(I18nProvider, { initialLocale: "en-US", children: body }),
    );
    expect(ui.queryByRole("group", { name: "Slot of ListBoxItem" })).toBeNull();
    expect(ui.queryByText("RAC slot")).toBeNull();
    expect(root.domInputs.get(record.id)?.props.slot).toBe("label");
  } finally {
    ui?.unmount();
    h.workspace.dispose();
  }
});
