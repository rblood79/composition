// @vitest-environment jsdom
import "fake-indexeddb/auto";
import { act } from "react";
import { createRoot } from "react-dom/client";
import { describe, expect, it } from "vitest";
import {
  setFields,
  insertNodes,
} from "../../../../../../packages/shared/src/catalog/commands";
import { CatalogGraph } from "../../../../../../packages/shared/src/catalog/document/graph";
import { buildCodeCatalogLibrary } from "../../../../../../packages/shared/src/catalog/document/codeCatalogLibrary";
import type {
  NodeId,
  NodeEntry,
} from "../../../../../../packages/shared/src/catalog/document/types";
import { newCatalogProjectDocument } from "../project";
import { CatalogWorkspace } from "../workspace";
import { CatalogStorage } from "../storage";
import { nodeLayoutEngine } from "./support/nodeLayoutEngine";
import { renderCatalogDom } from "../domBinding";
import { createThemeDefinition } from "@composition/shared";
import { resolveThemeSnapshot } from "../../../../../../packages/shared/src/catalog/runtime/resolveThemeSnapshot";
import { DEFAULT_BASE_TYPOGRAPHY } from "../../../../../../packages/shared/src/catalog/runtime/fontDefaults";
import { installThemeMaps } from "../../../../../../packages/shared/src/catalog/runtime/themeMaps";
import { catalogRuleNodeData } from "../ruleShapes";
import { COMPONENT_RULES_TABLE } from "../../../../../../packages/shared/src/catalog/generated/componentRulesTable";
import { bindCatalogCanvas } from "../canvasBinding";
import { getSkiaNode } from "../../workspace/canvas/skia/useSkiaNode";

async function open(type = "ActionButtonGroup") {
  const library = await buildCodeCatalogLibrary();
  const storage = new CatalogStorage(indexedDB, `action-${Math.random()}`);
  const workspace = new CatalogWorkspace(
    new CatalogGraph(
      newCatalogProjectDocument({
        projectId: "project:project:actions",
        name: "Actions",
      }),
      library,
    ),
    storage,
    {
      engine: await nodeLayoutEngine(),
      viewport: { width: 1000, height: 800 },
      autosaveSchedule: () => {},
      textMeasure: (text, font) => ({
        width: (text.length * font.fontSize) / 2,
        minWidth: (text.length * font.fontSize) / 2,
        height: font.fontSize * font.lineHeight,
      }),
    },
  );
  const id = "project:node:actions" as NodeId;
  workspace.execute(
    insertNodes({
      parent: { kind: "node", id: "project:node:home-body" as NodeId },
      entries: [
        {
          kind: "node",
          id,
          definitionId: `lib:definition:origin-component-${type.toLowerCase()}`,
          children: [],
          props: {},
          visual: {},
          sizing: {},
          descendantOverrides: [],
        } as NodeEntry,
      ],
      rootIds: [id],
      newId: workspace.newId,
    }),
  );
  const root = workspace.root;
  const of = (type: string) =>
    [...root.domInputs.values()].filter((node) => root.typeOf(node) === type);
  const write = (record: string, props: Record<string, string | boolean>) =>
    workspace.execute(
      setFields({
        targets: [workspace.positionOfRecord(record)!.target],
        props: Object.fromEntries(
          Object.entries(props).map(([key, value]) => [
            key,
            { kind: "set", value },
          ]),
        ),
      }),
    );
  const box = (record: string) => root.getGeometry([record]).get(record)!;
  const group = () => of(type)[0]!;
  const paint = () => {
    const binding = bindCatalogCanvas(root, root.pageRootRecords());
    const result = of(
      type === "ToggleButtonGroup" ? "ToggleButton" : "ActionButton",
    ).map((node) => getSkiaNode(node.id)?.box);
    binding.dispose();
    return result;
  };
  return { workspace, root, of, write, box, group, paint, library, storage };
}

it.each(["ActionButtonGroup", "ToggleButtonGroup"])(
  "%s: Justified는 긴 Label을 같은 폭 안에서 한 줄로 줄이고 작성 스타일을 보존한다",
  async (type) => {
    const h = await open(type);
    const host = document.body.appendChild(document.createElement("div"));
    const reactRoot = createRoot(host);
    let canvas: ReturnType<typeof bindCatalogCanvas> | undefined;
    try {
      const itemType =
        type === "ToggleButtonGroup" ? "ToggleButton" : "ActionButton";
      const item = h.of(itemType)[0]!;
      h.write(item.id, {
        label: "아주긴한글레이블LongUnbreakableLabelThatMustTruncate",
      });
      h.write(h.group().id, { isJustified: true });
      h.workspace.execute(
        setFields({
          targets: [h.workspace.positionOfRecord(h.group().id)!.target],
          sizing: { width: { kind: "set", value: 220 } },
        }),
      );
      const label = () =>
        h.of("Text").find((node) => node.parentId === item.id)!;
      expect(label().visual).toMatchObject({
        minWidth: 0,
        whiteSpace: "nowrap",
        textOverflow: "ellipsis",
        overflow: "hidden",
      });
      const boxes = h.of(itemType).map((node) => h.box(node.id));
      expect(boxes.map((box) => box.width)).toEqual([106, 106]);
      expect(boxes.map((box) => box.height)).toEqual([32, 32]);
      expect(h.box(label().id).width).toBeLessThanOrEqual(82);
      canvas = bindCatalogCanvas(h.root, h.root.pageRootRecords());
      expect(getSkiaNode(label().id)?.text).toMatchObject({
        whiteSpace: "nowrap",
        textOverflow: "ellipsis",
        clipText: true,
      });
      await act(async () =>
        reactRoot.render(renderCatalogDom(h.root, h.group().id)),
      );
      const text = host.querySelector<HTMLElement>(
        `[data-catalog-id="${label().id}"]`,
      )!;
      expect(text.style.textOverflow).toBe("ellipsis");
      h.workspace.execute(
        setFields({
          targets: [h.workspace.positionOfRecord(label().id)!.target],
          visual: { textOverflow: { kind: "set", value: "clip" } },
        }),
      );
      expect(label().visual.textOverflow).toBe("clip");
      h.workspace.undo();
      expect(label().visual.textOverflow).toBe("ellipsis");
    } finally {
      canvas?.dispose();
      await act(async () => reactRoot.unmount());
      host.remove();
      h.workspace.dispose();
    }
  },
);

describe("ActionButton family catalog consumers", () => {
  it("propagates group size and spacing on initial load, edits, Undo and reload", async () => {
    const h = await open();
    expect(h.of("ActionButton")).toHaveLength(2);
    expect(h.box(h.of("ActionButton")[0]!.id).height).toBe(32);
    h.write(h.group().id, {
      size: "XL",
      density: "compact",
      orientation: "vertical",
    });
    expect(h.of("ActionButton").map((n) => n.props.size)).toEqual(["XL", "XL"]);
    const [first, second] = h.of("ActionButton").map((n) => h.box(n.id));
    expect(first!.height).toBe(48);
    expect(second!.y - first!.y - first!.height).toBeCloseTo(2);
    expect(h.paint().map((box) => box?.borderRadius)).toEqual([
      [10, 10, 0, 0],
      [0, 0, 10, 10],
    ]);
    const document = h.workspace.runtime.graph.exportDocument();
    expect(new CatalogGraph(document, h.library).exportDocument()).toEqual(
      document,
    );
    h.workspace.undo();
    expect(h.box(h.of("ActionButton")[0]!.id).height).toBe(32);
    h.workspace.dispose();
  });

  it("divides an authored group width equally when justified", async () => {
    const h = await open();
    h.write(h.group().id, { isJustified: true });
    h.workspace.execute(
      setFields({
        targets: [h.workspace.positionOfRecord(h.group().id)!.target],
        sizing: { width: { kind: "set", value: 300 } },
      }),
    );
    const [first, second] = h.of("ActionButton").map((n) => h.box(n.id));
    expect(first!.width).toBe(146);
    expect(second!.width).toBe(146);
    expect(second!.x - first!.x - first!.width).toBe(8);
    h.workspace.dispose();
  });

  it("keeps icon-only controls square and draws the pending indicator on Canvas", async () => {
    const h = await open();
    const first = h.of("ActionButton")[0]!;
    h.write(first.id, { label: "" });
    expect(h.box(first.id).width).toBe(32);
    expect(h.box(first.id).height).toBe(32);
    h.write(first.id, { isPending: true });
    const binding = bindCatalogCanvas(h.root, h.root.pageRootRecords());
    expect(getSkiaNode(first.id)?.children?.some((child) => child.arc)).toBe(
      true,
    );
    binding.dispose();
    h.workspace.dispose();
  });

  it("renders a toolbar and actual buttons, group quiet/color/disabled and child explicit false", async () => {
    const h = await open();
    const before = h.paint();
    h.write(h.group().id, {
      isQuiet: true,
      staticColor: "white",
      isDisabled: true,
    });
    expect(
      h.of("ActionButton").every((n) => n.derivedProps?.isDisabled === true),
    ).toBe(true);
    expect(h.paint()).not.toEqual(before);
    const first = h.of("ActionButton")[0]!;
    h.write(first.id, { isDisabled: false });
    const host = document.createElement("div");
    document.body.append(host);
    const reactRoot = createRoot(host);
    try {
      await act(async () =>
        reactRoot.render(renderCatalogDom(h.root, h.group().id)),
      );
      expect(host.querySelector('[role="toolbar"]')).not.toBeNull();
      const buttons = host.querySelectorAll("button");
      expect(buttons).toHaveLength(2);
      expect(buttons[0]!.disabled).toBe(false);
      expect(buttons[1]!.disabled).toBe(true);
      expect(buttons[0]!.dataset.quiet).toBe("true");
      expect(buttons[0]!.dataset.staticColor).toBe("white");
      expect(buttons[0]!.textContent).toBe("Copy");
    } finally {
      await act(async () => reactRoot.unmount());
      host.remove();
      h.workspace.dispose();
    }
  });
});

// 순수 paint resolver 외에 실제 catalog 명령 → native Skia binding을 확인한다.
it.each(["ActionButton", "ToggleButton"])(
  "%s: static/disabled 편집과 Undo가 실제 Canvas 칠에 반영",
  async (type) => {
    const h = await open(type);
    const node = h.of(type)[0]!;
    const inspect = () => {
      const binding = bindCatalogCanvas(h.root, h.root.pageRootRecords());
      const data = getSkiaNode(node.id)!;
      const text = h
        .of("Text")
        .map((item) => getSkiaNode(item.id)?.text)
        .find(Boolean);
      const result = {
        box: data.box,
        textColor: text ? Array.from(text.color) : [],
      };
      binding.dispose();
      return result;
    };
    try {
      if (type === "ToggleButton") {
        expect(node.props.isSelected ?? false).toBe(false);
      }
      h.write(node.id, {
        staticColor: "white",
        ...(type === "ToggleButton" ? { isSelected: true } : {}),
      });
      const initial = inspect();
      expect(initial.box?.strokeWidth ?? 0).toBe(0);
      expect(initial.box?.fillColor?.[3]).toBeCloseTo(
        type === "ToggleButton" ? 0.85 : 0.11,
      );
      expect(initial.textColor).toEqual(
        type === "ToggleButton" ? [0, 0, 0, 1] : [1, 1, 1, 1],
      );
      h.write(node.id, { isDisabled: true });
      const disabled = inspect();
      expect(disabled.box?.fillColor?.[3]).toBeCloseTo(0.11);
      expect(disabled.textColor.slice(0, 3)).toEqual([1, 1, 1]);
      expect(disabled.textColor[3]).toBeCloseTo(0.21);
      h.write(node.id, { isQuiet: true });
      expect(inspect().box?.fillColor?.[3] ?? 0).toBe(0);
      h.workspace.undo();
      expect(inspect().box?.fillColor?.[3]).toBeCloseTo(0.11);
      h.workspace.undo();
      expect(inspect().box?.fillColor?.[3]).toBeCloseTo(
        type === "ToggleButton" ? 0.85 : 0.11,
      );
    } finally {
      h.workspace.dispose();
    }
  },
);

describe("ToggleButtonGroup S2 layout", () => {
  it("propagates group size and spacing on initial load, edits, Undo and reload", async () => {
    const h = await open("ToggleButtonGroup");
    expect(h.of("ToggleButton")).toHaveLength(2);
    expect(h.box(h.of("ToggleButton")[0]!.id).height).toBe(32);
    h.write(h.group().id, {
      size: "XL",
      density: "compact",
      orientation: "vertical",
    });
    expect(h.of("ToggleButton").map((n) => n.props.size)).toEqual(["XL", "XL"]);
    const [first, second] = h.of("ToggleButton").map((n) => h.box(n.id));
    expect(first!.height).toBe(48);
    expect(second!.y - first!.y - first!.height).toBeCloseTo(2);
    expect(h.paint().map((box) => box?.borderRadius)).toEqual([
      [10, 10, 0, 0],
      [0, 0, 10, 10],
    ]);
    const document = h.workspace.runtime.graph.exportDocument();
    expect(new CatalogGraph(document, h.library).exportDocument()).toEqual(
      document,
    );
    h.workspace.undo();
    expect(h.box(h.of("ToggleButton")[0]!.id).height).toBe(32);
    h.workspace.dispose();
  });

  it("divides an authored group width equally when justified", async () => {
    const h = await open("ToggleButtonGroup");
    h.write(h.group().id, { isJustified: true });
    h.workspace.execute(
      setFields({
        targets: [h.workspace.positionOfRecord(h.group().id)!.target],
        sizing: { width: { kind: "set", value: 300 } },
      }),
    );
    const [first, second] = h.of("ToggleButton").map((n) => h.box(n.id));
    expect(first!.width).toBe(146);
    expect(second!.width).toBe(146);
    expect(second!.x - first!.x - first!.width).toBe(8);
    h.workspace.dispose();
  });
});

it("ToggleButtonGroup quiet/color/emphasis edits reach Canvas and DOM and survive serialization", async () => {
  const h = await open("ToggleButtonGroup");
  const host = document.body.appendChild(document.createElement("div"));
  const reactRoot = createRoot(host);
  try {
    const first = h.of("ToggleButton")[0]!;
    h.write(first.id, { staticColor: "black", isEmphasized: true });
    h.write(h.group().id, {
      isQuiet: true,
      isEmphasized: false,
      staticColor: "white",
      size: "S",
    });
    expect(h.of("ToggleButton").map((n) => n.derivedProps?.isQuiet)).toEqual([
      true,
      true,
    ]);
    expect(
      h.of("ToggleButton").map((n) => n.derivedProps?.isEmphasized),
    ).toEqual([false, false]);
    const [a, b] = h.of("ToggleButton").map((n) => h.box(n.id));
    expect(b!.x - a!.x - a!.width).toBe(4);
    expect(h.paint().map((box) => box?.fillColor?.[3] ?? 0)).toEqual([0, 0]);
    await act(async () =>
      reactRoot.render(renderCatalogDom(h.root, h.group().id)),
    );
    const buttons = [...host.querySelectorAll("button")];
    expect(buttons).toHaveLength(2);
    for (const button of buttons) {
      expect(button.dataset.staticColor).toBe("white");
      expect(button.dataset.quiet).toBe("true");
      expect(button.dataset.emphasized).toBeUndefined();
      expect(button.dataset.size).toBe("S");
    }
    const saved = h.workspace.runtime.graph.exportDocument();
    expect(new CatalogGraph(saved, h.library).exportDocument()).toEqual(saved);
    h.workspace.undo();
    expect(h.of("ToggleButton")[0]!.derivedProps?.isQuiet ?? false).toBe(false);
    h.workspace.redo();
    expect(h.of("ToggleButton")[0]!.derivedProps?.isQuiet).toBe(true);
  } finally {
    await act(async () => reactRoot.unmount());
    host.remove();
    h.workspace.dispose();
  }
});

it.each(["ActionButton", "ToggleButton"])(
  "%s: focus ring은 catalog의 static 색상을 사용한다",
  async (type) => {
    const h = await open(type);
    try {
      for (const [staticColor, expected] of [
        ["black", [0, 0, 0, 1]],
        ["white", [1, 1, 1, 1]],
        ["auto", [75 / 255, 117 / 255, 1, 1]],
      ] as const) {
        h.write(h.of(type)[0]!.id, { staticColor });
        const node = h.of(type)[0]!;
        const box = catalogRuleNodeData({
          type,
          node,
          rect: h.box(node.id),
          rule: COMPONENT_RULES_TABLE[type]!,
          authoredVisual: {},
          state: "focusVisible",
        }).box!;
        expect(box.outlineWidth).toBe(2);
        expect(box.outlineOffset).toBe(2);
        for (const [index, channel] of expected.entries())
          expect(box.outlineColor?.[index]).toBeCloseTo(channel);
      }
      const custom = resolveThemeSnapshot(
        createThemeDefinition("focus", "Focus", undefined, {
          "focus.ring-width": {
            type: "number",
            value: 3,
            source: "spec-token",
          },
          "focus.ring-offset": {
            type: "number",
            value: 4,
            source: "spec-token",
          },
          "focus.ring-color": {
            type: "color",
            value: "#ff0000",
            source: "spec-token",
          },
        }),
        { baseTypographySeed: DEFAULT_BASE_TYPOGRAPHY },
      );
      installThemeMaps(custom);
      const node = h.of(type)[0]!;
      const box = catalogRuleNodeData({
        type,
        node,
        rect: h.box(node.id),
        rule: COMPONENT_RULES_TABLE[type]!,
        authoredVisual: {},
        state: "focusVisible",
      }).box!;
      expect(box.outlineWidth).toBe(3);
      expect(box.outlineOffset).toBe(4);
      expect(Array.from(box.outlineColor!)).toEqual([1, 0, 0, 1]);
    } finally {
      installThemeMaps(null);
      h.workspace.dispose();
    }
  },
);

it("ToggleButtonGroup의 명시 disabled false가 자식 true보다 우선하고 Undo로 복원된다", async () => {
  const h = await open("ToggleButtonGroup");
  const host = document.body.appendChild(document.createElement("div"));
  const reactRoot = createRoot(host);
  try {
    h.write(h.of("ToggleButton")[0]!.id, { isDisabled: true });
    expect(h.of("ToggleButton")[0]!.props.isDisabled).toBe(true);
    h.write(h.group().id, { isDisabled: false });
    expect(h.of("ToggleButton")[0]!.props.isDisabled).toBe(false);
    await act(async () =>
      reactRoot.render(renderCatalogDom(h.root, h.group().id)),
    );
    expect(host.querySelector("button")!.disabled).toBe(false);
    h.workspace.undo();
    expect(h.of("ToggleButton")[0]!.props.isDisabled).toBe(true);
  } finally {
    await act(async () => reactRoot.unmount());
    host.remove();
    h.workspace.dispose();
  }
});
