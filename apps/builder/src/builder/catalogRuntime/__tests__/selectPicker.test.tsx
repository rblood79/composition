import { render, cleanup, waitFor } from "@testing-library/react";
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
import { setFields } from "../../../../../../packages/shared/src/catalog/commands";
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
  const items = () =>
    [...workspace.root.canvasInputs.values()].filter(
      (n) => n.ruleId === "ListBoxItem",
    );
  expect(items().every((n) => n.derivedProps?._pickerMultiple === true)).toBe(
    true,
  );
  workspace.execute(
    setFields({
      targets: [{ kind: "node", id }],
      props: { selectionMode: { kind: "set", value: "single" } },
    }),
  );
  expect(items().every((n) => n.derivedProps?._pickerMultiple === false)).toBe(
    true,
  );
  const checkboxes = () =>
    [...workspace.root.canvasInputs.values()].filter(
      (n) => n.ruleId === "Checkbox" && n.props.slot === "selection",
    );
  expect(checkboxes().every((n) => n.hidden)).toBe(true);
  workspace.undo();
  expect(checkboxes().every((n) => !n.hidden)).toBe(true);
  expect(items().every((n) => n.derivedProps?._pickerMultiple === true)).toBe(
    true,
  );
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
        props: {
          isDisabled: { kind: "set", value: true },
          isSelected: { kind: "set", value: true },
        },
      }),
    );
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
