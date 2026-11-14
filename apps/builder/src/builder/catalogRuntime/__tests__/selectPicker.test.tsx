import { catalogRuntimeStateOf } from "../../../../../../packages/shared/src/catalog/runtime/runtimeStateProps";
import { selectItem } from "./support/selectItem";
import { catalogPickerSelectionHidden } from "../../../../../../packages/shared/src/catalog/runtime/pickerSelection";
import { REUSABLE_ORIGIN_TEMPLATES } from "../../../../../../packages/shared/src/catalog/document/generated/reusableOriginLibrary";
import { selectionItemTemplates } from "../../../../../../packages/shared/src/catalog/document/selectionItemTemplates";
import { WorkspaceContext } from "../react.runtime";
import { CATALOG_FIELD_VALUE_SOURCE } from "../../panels/properties/catalog/catalogFieldValueSource";
import { CatalogLayerTreeStore, type CatalogLayerNode } from "../layerTree";
import { catalogPickerSelectionCommands } from "../singleSelection";
import { composeCommands } from "../../../../../../packages/shared/src/catalog/commands";
import { render, cleanup, waitFor, act } from "@testing-library/react";
import { createElement } from "react";
import { I18nProvider } from "react-aria-components/I18nProvider";
import { resolveStaticItemKey } from "../../../../../../packages/shared/src/catalog/slotRoles";
import { catalogCanvasNodeData } from "../canvasBinding";
import { COMPONENT_RULES_TABLE } from "../../../../../../packages/shared/src/catalog/generated/componentRulesTable";
// @vitest-environment jsdom
import "fake-indexeddb/auto";
import { describe, expect, it, afterEach } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { resolveToken } from "@composition/rendering";
import { CatalogGraph } from "../../../../../../packages/shared/src/catalog/document/graph";
import { buildCodeCatalogLibrary } from "../../../../../../packages/shared/src/catalog/document/codeCatalogLibrary";
import {
  setFields,
  setWholeField,
} from "../../../../../../packages/shared/src/catalog/commands";
import type {
  EntryId,
  NodeId,
} from "../../../../../../packages/shared/src/catalog/document/types";
import { catalogBoxModel } from "../../../../../../packages/shared/src/catalog/runtime/boxModel";
import { installThemeMaps } from "../../../../../../packages/shared/src/catalog/runtime/themeMaps";
import { catalogPaletteInsertCommand } from "../paletteInsert";
import { newCatalogProjectDocument } from "../project";
import { CatalogStorage } from "../storage";
import { CatalogWorkspace } from "../workspace";
import { nodeLayoutEngine } from "./support/nodeLayoutEngine";
import { catalogRulePaint } from "../rulePaint";
import { catalogRuleShapes } from "../ruleShapes";
import { renderCatalogDom } from "../domBinding";
import { catalogAuthoredVisual } from "../libraryVisual";
const BODY = "project:node:home-body" as NodeId;
async function fixture(
  type: string,
  props: Record<string, unknown> = {},
  viewport = { width: 1200, height: 900 },
) {
  const library = await buildCodeCatalogLibrary();
  const workspace = new CatalogWorkspace(
    new CatalogGraph(
      newCatalogProjectDocument({
        projectId: "project:project:rac-additions" as EntryId<"project">,
        name: "RAC additions",
      }),
      library,
    ),
    new CatalogStorage(indexedDB, `rac-additions-${Math.random()}`),
    {
      engine: await nodeLayoutEngine(),
      viewport,
      autosaveSchedule: () => {},
    },
  );
  const command = catalogPaletteInsertCommand(
    {
      graph: workspace.runtime.graph,
      records: workspace.root.domInputs,
      selection: () => [],
      itemOfRecord: (id) => workspace.itemOfRecord(id),
      pageContent: () => ({ kind: "node", id: BODY }),
      newId: workspace.newId,
    },
    type,
    props,
  );
  expect(command).toBeDefined();
  const id = workspace.execute(command!).plan.selectAfter![0];
  return { workspace, library, id };
}

/** A child record of `parent` by its type. */
const childOfType = (
  workspace: CatalogWorkspace,
  parent: { readonly children: readonly string[] },
  type: string,
) =>
  parent.children
    .map((id) => workspace.root.canvasInputs.get(id)!)
    .find((node) => workspace.root.typeOf(node) === type)!;

/** The Select's Preview DOM. */
const renderSelect = (workspace: CatalogWorkspace) =>
  render(
    renderCatalogDom(
      workspace.root,
      [...workspace.root.domInputs.values()].find(
        (node) => node.ruleId === "Select",
      )!.id,
    ),
  );

/** The Design panel's Selected edit on a picker's selection Checkbox. */
const editSelected = (
  workspace: CatalogWorkspace,
  checkboxId: string,
  selected: boolean,
) =>
  workspace.execute(() =>
    composeCommands(
      workspace.runtime.graph,
      "Edit option selection",
      catalogPickerSelectionCommands(workspace, checkboxId, selected),
    ),
  );

afterEach(() => {
  cleanup();
  installThemeMaps(null);
});

describe("Select의 S2 Picker 토큰과 상태", () => {
  it.each(["light", "dark"] as const)(
    "%s: 기본·hover·open·disabled가 전용 토큰을 사용한다",
    async (theme) => {
      const { workspace } = await fixture("Select");
      const root = workspace.root;
      const button = [...root.canvasInputs.values()].find(
        (n) => n.bindingId === "button",
      )!;
      expect(button.derivedProps?._pickerTrigger).toBe(true);
      const actual = catalogCanvasNodeData(root, button.id);
      expect(Array.from(actual.box?.fillColor ?? []).slice(0, 3)).toEqual(
        [233 / 255, 233 / 255, 233 / 255].map((n) => expect.closeTo(n, 5)),
      );
      const rule = COMPONENT_RULES_TABLE.Button;
      const input = {
        node: button,
        rule,
        type: "Button",
        rect: { width: 200, height: 32 },
        authoredVisual: catalogAuthoredVisual(root, button),
        theme,
      };
      const value = (extra = {}, state?: "hover") => {
        const paint = catalogRulePaint({
          ...input,
          node: {
            ...button,
            derivedProps: { ...button.derivedProps, ...extra },
          },
          state,
        }).paint;
        return {
          bg: resolveToken(paint.backgroundColor as never, theme),
          color: resolveToken(paint.color as never, theme),
        };
      };
      expect(value().bg).toBe(theme === "light" ? "#e9e9e9" : "#2c2c2c");
      expect(value({}, "hover").bg).toBe(
        theme === "light" ? "#e1e1e1" : "#323232",
      );
      expect(value({ _overlayOpen: true }).bg).toBe(value({}, "hover").bg);
      expect(value({ isDisabled: true }, "hover").color).toBe(
        theme === "light" ? "#c6c6c6" : "#444444",
      );
      expect(value({ isQuiet: true }).bg).toBe("transparent");
    },
  );

  it("Quiet·Invalid 변경과 undo가 자식 및 양쪽 소비자에 전달된다", async () => {
    const { workspace, id } = await fixture("Select");
    const parts = () => {
      const nodes = [...workspace.root.canvasInputs.values()];
      return {
        button: nodes.find((n) => n.bindingId === "button")!,
        value: nodes.find((n) => n.bindingId === "selectvalue")!,
        select: nodes.find((n) => n.ruleId === "Select")!,
      };
    };
    workspace.execute(
      setFields({
        targets: [{ kind: "node", id }],
        props: {
          isQuiet: { kind: "set", value: true },
          isInvalid: { kind: "set", value: true },
        },
      }),
    );
    const { button, value, select } = parts();
    expect(button.derivedProps).toMatchObject({
      _pickerTrigger: true,
      _pickerInvalid: true,
      isQuiet: true,
    });
    expect(value.derivedProps).toMatchObject({
      _pickerValue: true,
      _pickerInvalid: true,
    });
    expect(catalogBoxModel(button).padding).toMatchObject({
      left: 0,
      right: 0,
    });
    expect(catalogBoxModel(value).padding?.right).toBeGreaterThan(0);
    const html = renderToStaticMarkup(
      renderCatalogDom(workspace.root, select.id),
    );
    expect(html).toContain('data-picker="true"');
    expect(html).toContain('data-picker-invalid=""');
    const input = {
      node: value,
      type: "SelectValue",
      rule: COMPONENT_RULES_TABLE.SelectValue,
      rect: { width: 160, height: 18 },
      authoredVisual: {},
    };
    expect(
      catalogRuleShapes(input).some(
        (s) => s.type === "icon_font" && s.iconName === "triangle-alert",
      ),
    ).toBe(true);
    workspace.undo();
    expect(parts().value.derivedProps?._pickerInvalid).toBe(false);
    expect(catalogBoxModel(parts().button).padding?.left).toBeGreaterThan(0);
  });

  it("Invalid는 실제 Canvas의 레이아웃을 유지하며 border와 glyph를 그린다", async () => {
    const { workspace } = await fixture("Select", { isInvalid: true });
    const root = workspace.root;
    const button = [...root.canvasInputs.values()].find(
      (n) => n.bindingId === "button",
    )!;
    const value = [...root.canvasInputs.values()].find(
      (n) => n.bindingId === "selectvalue",
    )!;
    expect(catalogBoxModel(button).borderWidth ?? 0).toBe(0);
    expect(catalogCanvasNodeData(root, button.id).box?.strokeWidth).toBe(2);
    expect(
      catalogCanvasNodeData(root, value.id).children?.length,
    ).toBeGreaterThan(1);
    workspace.dispose();
  });

  it("선택된 값도 placeholder 없이 왼쪽에 배치한다", async () => {
    const { workspace } = await fixture("Select");
    const value = [...workspace.root.canvasInputs.values()].find(
      (n) => n.bindingId === "selectvalue",
    )!;
    const shapes = catalogRuleShapes({
      node: {
        ...value,
        props: { children: "Cat", size: "M" },
      },
      type: "SelectValue",
      rule: COMPONENT_RULES_TABLE.SelectValue,
      rect: { width: 180, height: 18 },
      authoredVisual: {},
    });
    const text = shapes.find((s) => s.type === "text");
    expect(text?.type === "text" ? text.align : undefined).toBe("left");
    workspace.dispose();
  });

  it("Disabled는 루트 opacity를 낮추지 않고 자식 색상으로 표현한다", async () => {
    const { workspace } = await fixture("Select", { isDisabled: true });
    const nodes = [...workspace.root.canvasInputs.values()];
    expect(nodes.find((n) => n.ruleId === "Select")!.visual.opacity ?? 1).toBe(
      1,
    );
    expect(
      nodes.find((n) => n.bindingId === "selectvalue")!.derivedProps
        ?.isDisabled,
    ).toBe(true);
  });
});

describe("Select S2 다중 선택", () => {
  it.each(["S", "M", "L", "XL"])(
    "%s: 실제 Checkbox 슬롯 오른쪽에 label을 배치한다",
    async (size) => {
      const { workspace } = await fixture("Select", {
        selectionMode: "multiple",
        isOpen: true,
        size,
      });
      try {
        const root = workspace.root;
        const items = [...root.canvasInputs.values()].filter(
          (n) => n.ruleId === "ListBoxItem",
        );
        for (const item of items) {
          const children = item.children.map((id) => root.canvasInputs.get(id));
          const label = children.find((n) => n?.props.slot === "label")!;
          const checkbox = children.find(
            (n) => n?.ruleId === "Checkbox" && n.props.slot === "selection",
          )!;
          expect(checkbox).toBeDefined();
          const boxes = root.getGeometry([item.id, label.id, checkbox.id]);
          const itemBox = boxes.get(item.id)!;
          const labelBox = boxes.get(label.id)!;
          const checkboxBox = boxes.get(checkbox.id)!;
          expect(checkboxBox.width).toBeGreaterThan(0);
          expect(
            labelBox.x - checkboxBox.x - checkboxBox.width,
          ).toBeGreaterThanOrEqual(4);
          const shapes = catalogRuleShapes({
            node: item,
            type: "ListBoxItem",
            rule: COMPONENT_RULES_TABLE.ListBoxItem,
            rect: itemBox,
            authoredVisual: {},
          });
          expect(
            shapes.some(
              (shape) => "id" in shape && shape.id === "picker-checkbox",
            ),
          ).toBe(false);
        }
      } finally {
        workspace.dispose();
      }
    },
  );
  it.each(["en-US", "ko-KR"])(
    "%s: 0→1→2→1→0 선택과 목록 checkbox를 양쪽 소비자가 읽는다",
    async (locale) => {
      const { workspace } = await fixture("Select", {
        selectionMode: "multiple",
        isOpen: true,
      });
      const nodes = () => [...workspace.root.canvasInputs.values()];
      const select = nodes().find((n) => n.ruleId === "Select")!;
      const items = nodes().filter((n) => n.ruleId === "ListBoxItem");
      expect(items).toHaveLength(4);
      const keys = ["Cat", "Dog"].map((label) => {
        const n = items.find((item) =>
          item.children.some(
            (id) => workspace.root.domInputs.get(id)?.props.children === label,
          ),
        )!;
        return resolveStaticItemKey(n.props as Record<string, unknown>, n.id);
      });
      for (const [value, expected] of [
        [[], "Choose an option..."],
        [[keys[0]], "Cat"],
        [keys, locale === "ko-KR" ? "2개 항목 선택됨" : "2 items selected"],
        [[keys[1]], "Dog"],
        [[], "Choose an option..."],
      ] as const) {
        const view = render(
          createElement(I18nProvider, {
            locale,
            children: renderCatalogDom(workspace.root, select.id, {
              runtime: {
                revisionOf: () => 0,
                handlersOf: () => ({}),
                subscribe: () => () => {},
                overrideOf: (recordId) =>
                  recordId === select.id ? { value: [...value] } : undefined,
              },
            }),
          }),
        );
        await waitFor(() =>
          expect(
            view.container.querySelector(".react-aria-SelectValue")
              ?.textContent,
          ).toBe(expected),
        );
        const options = [...document.querySelectorAll('[role="option"]')];
        expect(options).toHaveLength(4);
        for (const option of options) {
          expect(
            option
              .querySelector(".react-aria-Checkbox")
              ?.hasAttribute("data-selected"),
          ).toBe(option.getAttribute("aria-selected") === "true");
        }
        expect(
          options.every(
            (option) =>
              !!option.querySelector('.react-aria-Checkbox[slot="selection"]'),
          ),
        ).toBe(true);
        expect(
          view.container.querySelector(
            ".react-aria-SelectValue .react-aria-Checkbox",
          ),
        ).toBeNull();
        for (const item of nodes().filter((n) => n.ruleId === "ListBoxItem")) {
          const shapes = catalogRuleShapes({
            node: item,
            type: "ListBoxItem",
            rule: COMPONENT_RULES_TABLE.ListBoxItem,
            rect: { width: 180, height: 32 },
            authoredVisual: {},
          });
          expect(
            shapes.some(
              (shape) => "id" in shape && shape.id === "picker-checkbox",
            ),
          ).toBe(false);
          expect(
            document.querySelectorAll('[role="option"] input[type="checkbox"]'),
          ).toHaveLength(0);
        }
        view.unmount();
      }
      workspace.dispose();
    },
  );
});

it("Select 선택 모드 변경과 undo가 Checkbox 슬롯 배치를 갱신한다", async () => {
  const { workspace, id } = await fixture("Select", {
    selectionMode: "multiple",
    isOpen: true,
  });
  const checkboxes = () =>
    [...workspace.root.canvasInputs.values()].filter(
      (n) => n.ruleId === "Checkbox" && n.props.slot === "selection",
    );
  expect(checkboxes().every((n) => !n.hidden)).toBe(true);
  workspace.execute(
    setFields({
      targets: [{ kind: "node", id }],
      props: { selectionMode: { kind: "set", value: "single" } },
    }),
  );
  expect(checkboxes().every((n) => n.hidden)).toBe(true);
  workspace.undo();
  expect(checkboxes().every((n) => !n.hidden)).toBe(true);
  workspace.dispose();
});

it("옵션의 선택과 disabled가 실제 Checkbox 슬롯으로 전달된다", async () => {
  const { workspace } = await fixture("Select", {
    selectionMode: "multiple",
    isOpen: true,
  });
  try {
    const root = workspace.root;
    const item = [...root.canvasInputs.values()].find(
      (n) => n.ruleId === "ListBoxItem",
    )!;
    workspace.execute(
      setFields({
        targets: [workspace.itemOfRecord(item.id)!.target],
        props: { isDisabled: { kind: "set", value: true } },
      }),
    );
    // (ADR-308: the option's selection is its Select's value.)
    selectItem(workspace, item.id);
    const checkbox = [...root.canvasInputs.values()].find(
      (n) => n.parentId === item.id && n.ruleId === "Checkbox",
    )!;
    expect(checkbox.derivedProps?.isDisabled).toBe(true);
    expect(checkbox.derivedProps?._isSelected).toBe(true);
  } finally {
    workspace.dispose();
  }
});

it("옵션의 저작 Layout 변경과 undo가 실제 배치에 반영된다", async () => {
  const { workspace } = await fixture("Select", {
    selectionMode: "multiple",
    isOpen: true,
  });
  try {
    const root = workspace.root;
    const item = [...root.canvasInputs.values()].find(
      (n) => n.ruleId === "ListBoxItem",
    )!;
    const checkbox = item.children.find(
      (id) => root.canvasInputs.get(id)?.ruleId === "Checkbox",
    )!;
    expect(item.layout.display).toBe("grid");
    const original = root.getGeometry([checkbox]).get(checkbox)!;
    workspace.execute(
      setFields({
        targets: [workspace.itemOfRecord(item.id)!.target],
        layout: {
          display: { kind: "set", value: "flex" },
          flexDirection: { kind: "set", value: "row" },
          // (The item rule centres its row; the label Text is `fit-content`, so the row starts here.)
          justifyContent: { kind: "set", value: "flex-start" },
        },
        visual: { paddingLeft: { kind: "set", value: 40 } },
      }),
    );
    expect(root.canvasInputs.get(item.id)!.layout.display).toBe("flex");
    expect(root.getGeometry([checkbox]).get(checkbox)!.x).toBe(40);
    workspace.undo();
    expect(root.canvasInputs.get(item.id)!.layout.display).toBe("grid");
    expect(root.getGeometry([checkbox]).get(checkbox)).toEqual(original);
  } finally {
    workspace.dispose();
  }
});

it("single/multiple의 Layers 부품과 undo가 표시 모드를 따른다", async () => {
  const { workspace, id } = await fixture("Select", { isOpen: true });
  const tree = new CatalogLayerTreeStore(
    {
      readModel: workspace.readModel,
      graph: workspace.runtime.graph,
      subscribeSteps: (listener) => workspace.runtime.subscribeSteps(listener),
      absentByValue: (position) => workspace.rowAbsentByValue(position),
    },
    "project:page:home" as EntryId<"page">,
  );
  tree.connect();
  tree.setExpanded(new Set(workspace.root.domInputs.keys()));
  const parts = () => {
    const all: CatalogLayerNode[] = [];
    const visit = (rows: readonly CatalogLayerNode[]) => {
      for (const row of rows) {
        all.push(row);
        visit(row.children ?? []);
      }
    };
    visit(tree.getSnapshot());
    return all
      .filter((row) => row.typeName === "ListBoxItem")
      .map((row) => row.children?.map((child) => child.typeName));
  };
  expect(parts()).toEqual(Array(4).fill(["Icon", "Text"]));
  workspace.execute(
    setFields({
      targets: [{ kind: "node", id }],
      props: { selectionMode: { kind: "set", value: "multiple" } },
    }),
  );
  expect(parts()).toEqual(Array(4).fill(["Checkbox", "Text"]));
  workspace.undo();
  expect(parts()).toEqual(Array(4).fill(["Icon", "Text"]));
  tree.dispose();
  workspace.dispose();
});

it("Checkbox Selected 편집은 Canvas 체크 선과 Preview를 갱신한다", async () => {
  const { workspace } = await fixture("Select", {
    isOpen: true,
    selectionMode: "multiple",
  });
  const checkbox = [...workspace.root.canvasInputs.values()].find(
    (n) => n.ruleId === "Checkbox",
  )!;
  const indicator = [...workspace.root.canvasInputs.values()].find(
    (n) => workspace.root.typeOf(n) === "CheckboxIndicator",
  )!;
  for (const selected of [true, false, true]) {
    editSelected(workspace, checkbox.id, selected);
    expect(
      workspace.root.canvasInputs.get(checkbox.id)?.derivedProps?._isSelected,
    ).toBe(selected);
    const data = catalogCanvasNodeData(workspace.root, indicator.id);
    expect(data.children?.filter((n) => n.type === "line").length ?? 0).toBe(
      selected ? 2 : 0,
    );
    const view = renderSelect(workspace);
    await waitFor(() =>
      expect(
        document
          .querySelector('[role="option"] .react-aria-CheckboxButton')
          ?.hasAttribute("data-selected"),
      ).toBe(selected),
    );
    view.unmount();
  }
  workspace.undo();
  expect(
    workspace.root.canvasInputs.get(checkbox.id)?.derivedProps?._isSelected,
  ).toBe(false);
  workspace.dispose();
});

it("Selected 필드의 단일 값과 chip 구독은 Checkbox가 아닌 옵션의 선택을 읽는다", async () => {
  const { workspace } = await fixture("Select", { selectionMode: "multiple" });
  const checkbox = [...workspace.root.canvasInputs.values()].find(
    (node) => node.ruleId === "Checkbox",
  )!;
  function Probe() {
    const value = CATALOG_FIELD_VALUE_SOURCE.useValue(
      checkbox.id,
      "semantic",
      "isSelected",
      false,
    );
    const snapshot = CATALOG_FIELD_VALUE_SOURCE.useValuesSnapshot(
      checkbox.id,
      "semantic",
      ["isSelected", "isIndeterminate"],
      [false, false],
    );
    return createElement("output", {}, `${value}:${snapshot}`);
  }
  const view = render(
    createElement(WorkspaceContext.Provider, {
      value: workspace,
      children: createElement(Probe),
    }),
  );
  for (const selected of [true, false, true]) {
    act(() => {
      editSelected(workspace, checkbox.id, selected);
    });
    await waitFor(() =>
      expect(view.container.textContent).toBe(
        `${selected}:[${selected},false]`,
      ),
    );
  }
  view.unmount();
  workspace.dispose();
});

it.each(["Select", "ComboBox", "Menu"])(
  "%s single: 체크 공간은 미선택에도 유지하고 설명 위 라벨 행에 정렬한다",
  async (type) => {
    const { workspace } = await fixture(type, {
      isOpen: true,
      ...(type === "ComboBox" ? {} : { selectionMode: "single" }),
    });
    try {
      const root = workspace.root;
      const item = [...root.canvasInputs.values()].find((n) =>
        ["ListBoxItem", "MenuItem"].includes(root.typeOf(n)),
      )!;
      const check = item.children
        .map((id) => root.canvasInputs.get(id)!)
        .find(
          (n) => n.props.slot === "selection" && root.typeOf(n) === "Icon",
        )!;
      const label = item.children
        .map((id) => root.canvasInputs.get(id)!)
        .find((n) => n.props.slot === "label")!;
      const labelTarget = workspace.itemOfRecord(label.id)!.target;
      if (labelTarget.kind !== "descendant")
        throw new Error("template label expected");
      const descriptionTarget = {
        ...labelTarget,
        address: {
          ...labelTarget.address,
          templatePath: labelTarget.address.templatePath.map(
            (id) => id.replace(/__label$/, "__description") as typeof id,
          ),
        },
      };
      workspace.execute(
        setWholeField({
          targets: [descriptionTarget],
          field: "enabled",
          value: true,
        }),
      );
      workspace.execute(
        setFields({
          targets: [descriptionTarget],
          props: { children: { kind: "set", value: "설명 두 번째 행" } },
        }),
      );
      const description = root.canvasInputs
        .get(item.id)!
        .children.map((id) => root.canvasInputs.get(id)!)
        .find((n) => n.props.slot === "description")!;
      const positions = [];
      for (const selected of [false, true, false]) {
        selectItem(workspace, item.id, selected);
        const boxes = root.getGeometry([check.id, label.id, description.id]);
        const mark = boxes.get(check.id)!;
        const text = boxes.get(label.id)!;
        expect(mark.width).toBeGreaterThan(0);
        expect(mark.y + mark.height / 2).toBeCloseTo(text.y + text.height / 2);
        expect(boxes.get(description.id)!.y).toBeGreaterThan(text.y);
        expect(
          root.canvasInputs.get(check.id)?.derivedProps?._selectionMarkHidden,
        ).toBe(!selected);
        positions.push([mark.x, mark.y, text.x, text.y]);
      }
      expect(positions[0]).toEqual(positions[1]);
      expect(positions[1]).toEqual(positions[2]);
      const host = [...root.domInputs.values()].find(
        (n) => root.typeOf(n) === (type === "Menu" ? "MenuTrigger" : type),
      )!;
      const view = render(renderCatalogDom(root, host.id));
      await waitFor(() =>
        expect(
          document.querySelector('[role="option"], [role="menuitemradio"]'),
        ).not.toBeNull(),
      );
      const mark = document.querySelector<HTMLElement>(
        '[slot="selection"][data-icon="check"]',
      );
      expect(mark).not.toBeNull();
      expect(mark?.style.gridRowStart).toBe("1");
      expect(mark?.style.position).not.toBe("absolute");
      expect(mark?.style.visibility).toBe("hidden");
      view.unmount();
    } finally {
      workspace.dispose();
    }
  },
);

it.each(["Select", "Menu"])(
  "%s multiple: Checkbox는 첫 라벨 행에 배치한다",
  async (type) => {
    const { workspace } = await fixture(type, {
      selectionMode: "multiple",
      isOpen: true,
    });
    try {
      const root = workspace.root;
      const item = [...root.canvasInputs.values()].find((n) =>
        ["ListBoxItem", "MenuItem"].includes(root.typeOf(n)),
      )!;
      const checkbox = childOfType(workspace, item, "Checkbox");
      const label = item.children
        .map((id) => root.canvasInputs.get(id)!)
        .find((n) => n.props.slot === "label")!;
      expect(checkbox.layout.gridRowEnd).toBe("auto");
      const boxes = root.getGeometry([checkbox.id, label.id]);
      const a = boxes.get(checkbox.id)!;
      const b = boxes.get(label.id)!;
      expect(a.y + a.height / 2).toBeCloseTo(b.y + b.height / 2);
    } finally {
      workspace.dispose();
    }
  },
);

it("일반 ListBox의 icon/label/description 배치는 보존한다", () => {
  const templates = selectionItemTemplates(REUSABLE_ORIGIN_TEMPLATES);
  for (const suffix of ["__icon", "__label", "__description", "__selection"]) {
    const id = "lib:template:component-listbox-item-default" + suffix;
    expect(templates.find((node) => node.id === id)).toEqual(
      REUSABLE_ORIGIN_TEMPLATES.find((node) => node.id === id),
    );
  }
});

it("Menu none/single/multiple과 undo는 선택 부품 표시를 갱신한다", async () => {
  const { workspace } = await fixture("Menu", { isOpen: true });
  try {
    const root = workspace.root;
    const menu = [...root.canvasInputs.values()].find(
      (n) => root.typeOf(n) === "Menu",
    )!;
    const item = [...root.canvasInputs.values()].find(
      (n) => root.typeOf(n) === "MenuItem",
    )!;
    const parts = item.children
      .map((id) => root.canvasInputs.get(id)!)
      .filter((n) => n.props.slot === "selection");
    const visible = () =>
      parts
        .filter(
          (part) =>
            !catalogPickerSelectionHidden(
              root.canvasInputs.get(part.id)!,
              (id) => root.canvasInputs.get(id),
              root.typeOf,
            ),
        )
        .map((n) => root.typeOf(n));
    expect(visible()).toEqual([]);
    for (const mode of ["single", "multiple"]) {
      workspace.execute(
        setFields({
          targets: [workspace.itemOfRecord(menu.id)!.target],
          props: { selectionMode: { kind: "set", value: mode } },
        }),
      );
      expect(visible()).toEqual([mode === "single" ? "Icon" : "Checkbox"]);
    }
    const checkbox = parts.find((n) => root.typeOf(n) === "Checkbox")!;
    for (const selected of [true, false]) {
      selectItem(workspace, item.id, selected);
      expect(
        root.canvasInputs.get(checkbox.id)?.derivedProps?._isSelected,
      ).toBe(selected);
    }
    workspace.undo();
    workspace.undo();
    workspace.undo();
    expect(visible()).toEqual(["Icon"]);
    workspace.undo();
    expect(visible()).toEqual([]);
    const host = [...root.domInputs.values()].find(
      (n) => root.typeOf(n) === "MenuTrigger",
    )!;
    const view = render(renderCatalogDom(root, host.id));
    await waitFor(() =>
      expect(document.querySelector('[role="menuitem"]')).not.toBeNull(),
    );
    expect(
      document.querySelector('[role="menuitem"] [slot="selection"]'),
    ).toBeNull();
    view.unmount();
  } finally {
    workspace.dispose();
  }
});

it("ComboBox는 저장한 항목의 Selected로 초기 선택을 복원하고 runtime 해제를 우선한다", async () => {
  const { workspace } = await fixture("ComboBox", { isOpen: true });
  try {
    const root = workspace.root;
    const item = [...root.canvasInputs.values()].find(
      (n) => root.typeOf(n) === "ListBoxItem",
    )!;
    selectItem(workspace, item.id, true);
    const owner = [...root.domInputs.values()].find(
      (n) => root.typeOf(n) === "ComboBox",
    )!;
    const key = resolveStaticItemKey(
      item.props as Record<string, unknown>,
      item.id,
    );
    expect(catalogRuntimeStateOf(root, owner, undefined, "selectedKey")).toBe(
      key,
    );
    expect(
      catalogRuntimeStateOf(root, owner, { selectedKey: null }, "selectedKey"),
    ).toBeNull();
    const view = render(renderCatalogDom(root, owner.id));
    await waitFor(() =>
      expect(
        document.querySelector(
          '[role="option"][aria-selected="true"] [slot="selection"]',
        ),
      ).not.toBeNull(),
    );
    expect(
      document.querySelector<HTMLInputElement>('input[role="combobox"]')?.value,
    ).toBe("Aardvark");
    view.unmount();
    workspace.undo();
    expect(
      catalogRuntimeStateOf(
        root,
        root.domInputs.get(owner.id)!,
        undefined,
        "selectedKey",
      ),
    ).toBeNull();
  } finally {
    workspace.dispose();
  }
});
