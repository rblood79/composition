// @vitest-environment jsdom
import "fake-indexeddb/auto";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { act, createElement } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, describe, expect, it } from "vitest";
import {
  insertNodes,
  setFields,
} from "../../../../../../packages/shared/src/catalog/commands";
import { CatalogGraph } from "../../../../../../packages/shared/src/catalog/document/graph";
import { COMPONENT_RULES_TABLE } from "../../../../../../packages/shared/src/catalog/generated/componentRulesTable";
import { buildCodeCatalogLibrary } from "../../../../../../packages/shared/src/catalog/document/codeCatalogLibrary";
import type {
  EntryId,
  NodeEntry,
  NodeId,
} from "../../../../../../packages/shared/src/catalog/document/types";
import { nodePosition } from "../../../../../../packages/shared/src/catalog/resolution/positions";
import { getSkiaNode } from "../../workspace/canvas/skia/useSkiaNode";
import { bindCatalogCanvas } from "../canvasBinding";
import { renderCatalogDom } from "../domBinding";
import {
  catalogEditContract,
  catalogPropBaseValue,
  catalogPropertiesPatchCommand,
} from "../editContract";
import {
  catalogFieldPrefix,
  catalogFieldPrefixCommand,
  type CatalogFieldPrefixKind,
} from "../fieldPrefixCommand";
import { catalogPaletteDefinitionId } from "../paletteInsert";
import { newCatalogProjectDocument } from "../project";
import { CatalogStorage } from "../storage";
import { CatalogWorkspace } from "../workspace";
import { WorkspaceContext, useCatalogEditContract } from "../react.runtime";
import { nodeLayoutEngine } from "./support/nodeLayoutEngine";

/**
 * ADR-259 Phase 2 (G2) — a field's prefix (S2 `prefix`). One Design command puts a Text or an Icon
 * (`slot="prefix"`) first in the field's control Group — wrapping a TextField's · TextArea's ·
 * ColorField's Input in one — and takes it out again (unwrapping). The DOM is the G0 oracle's
 * (`adr259-s2-oracle.json`): the prefix first in the box, the input named by label + prefix (not a
 * TextArea), a pointer on the prefix focusing the input.
 */
const here = dirname(fileURLToPath(import.meta.url));
const ORACLE = JSON.parse(
  readFileSync(
    join(here, "../../../../tests/fixtures/adr259-s2-oracle.json"),
    "utf8",
  ),
) as {
  prefix: Record<
    string,
    {
      controlTag: string;
      labelledBy: string[];
      name: string;
      prefixFirstInGroup: boolean;
      groupHoldsControl: boolean;
      focusFromPrefixMouse?: boolean;
      focusFromPrefixTouch?: boolean;
    }
  >;
};
const BODY = "project:node:home-body" as NodeId;
const ROOT = "project:node:root" as NodeId;
const FIELDS = [
  "TextField",
  "TextArea",
  "NumberField",
  "ComboBox",
  "ColorField",
] as const;

// jsdom has no observers (RAC collections' load-more sentinel reads one).
class NoopObserver {
  observe() {}
  unobserve() {}
  disconnect() {}
  takeRecords() {
    return [];
  }
}
const observerGlobals = globalThis as Record<string, unknown>;
observerGlobals.IntersectionObserver ??= NoopObserver;
observerGlobals.ResizeObserver ??= NoopObserver;

async function open(
  type: string,
  label: string,
  extra: Record<string, unknown> = {},
  measure = false,
) {
  const library = await buildCodeCatalogLibrary();
  const workspace = new CatalogWorkspace(
    new CatalogGraph(
      newCatalogProjectDocument({
        projectId: `project:project:adr259p-${label}` as EntryId<"project">,
        name: "ADR-259",
      }),
      library,
    ),
    new CatalogStorage(indexedDB, `adr259p-${label}-${Math.random()}`),
    {
      engine: await nodeLayoutEngine(),
      viewport: { width: 1200, height: 800 },
      autosaveSchedule: () => {},
      ...(measure
        ? {
            textMeasure: (text: string) => ({
              width: text.length * 8,
              minWidth: text.length * 8,
              height: 20,
            }),
          }
        : {}),
    },
  );
  workspace.execute(
    insertNodes({
      parent: { kind: "node", id: BODY },
      entries: [
        {
          kind: "node",
          id: ROOT,
          definitionId: catalogPaletteDefinitionId(library, type),
          children: [],
          props: Object.fromEntries(
            Object.entries({ label: "Price", ...extra }).map(([key, value]) => [
              key,
              { kind: "set", value },
            ]),
          ) as NodeEntry["props"],
          visual: {},
          sizing: {},
          descendantOverrides: [],
        } as NodeEntry,
      ],
      rootIds: [ROOT],
      newId: workspace.newId,
    }),
  );
  const graph = workspace.runtime.graph;
  const field = () => nodePosition(graph, ROOT);
  const state = () => catalogFieldPrefix(graph, field())!;
  const setPrefix = (kind: CatalogFieldPrefixKind) =>
    workspace.execute(
      catalogFieldPrefixCommand({
        field: field(),
        kind,
        newId: workspace.newId,
      }),
    );
  const root = workspace.root;
  const recordOf = (type: string) =>
    [...root.canvasInputs.values()].filter((r) => root.typeOf(r) === type);
  const render = async () => {
    (
      globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }
    ).IS_REACT_ACT_ENVIRONMENT = true;
    const host = document.body.appendChild(document.createElement("div"));
    const reactRoot = createRoot(host);
    const fieldRecord = recordOf(type).find((r) => r.parentId !== undefined)!;
    await act(async () =>
      reactRoot.render(renderCatalogDom(root, fieldRecord.id)),
    );
    return {
      host,
      done: async () => {
        await act(async () => reactRoot.unmount());
        host.remove();
      },
    };
  };
  return { workspace, graph, state, setPrefix, root, recordOf, render };
}

function textOf(node: Node): string {
  if (node.nodeType === Node.TEXT_NODE) return node.textContent ?? "";
  if (!(node instanceof Element)) return "";
  if (node.getAttribute("aria-hidden") === "true") return "";
  const label = node.getAttribute("aria-label");
  if (label) return label;
  return [...node.childNodes].map(textOf).join("");
}
function nameOf(el: Element): string {
  const ids = el.getAttribute("aria-labelledby");
  if (!ids) return el.getAttribute("aria-label") ?? "";
  return ids
    .split(/\s+/)
    .map((id) => {
      const ref = el.ownerDocument.getElementById(id);
      return ref
        ? textOf(ref)
            .replace(/\u00a0/g, " ")
            .trim()
        : "";
    })
    .filter(Boolean)
    .join(" ");
}
function labelledByShape(el: Element, roles: Record<string, Element | null>) {
  const ids = el.getAttribute("aria-labelledby")?.split(/\s+/) ?? [];
  return ids.map((id) => {
    const ref = el.ownerDocument.getElementById(id);
    for (const [role, node] of Object.entries(roles))
      if (node && ref === node) return role;
    return ref ? `other:${ref.tagName.toLowerCase()}` : "missing";
  });
}

function paintOf(root: Awaited<ReturnType<typeof open>>["root"], id: string) {
  const canvas = bindCatalogCanvas(root, root.pageRootRecords());
  const box = (
    getSkiaNode(id) as unknown as {
      box?: {
        fillColor?: Float32Array;
        strokeColor?: Float32Array;
        strokeWidth?: number;
        borderRadius?: unknown;
      };
    }
  )?.box;
  canvas.dispose();
  const color = (value?: Float32Array) =>
    value && value[3] > 0 ? [...value].map((n) => +n.toFixed(4)) : null;
  return {
    fill: color(box?.fillColor),
    stroke: (box?.strokeWidth ?? 0) > 0 ? color(box?.strokeColor) : null,
    strokeWidth: (box?.strokeWidth ?? 0) > 0 ? box?.strokeWidth : 0,
    radius: JSON.stringify(box?.borderRadius ?? 0),
  };
}

describe("ADR-259 Phase 2 — field prefix", () => {
  for (const size of ["S", "M", "L", "XL"])
    for (const labelPosition of ["top", "side"])
      it(`TextArea ${size} ${labelPosition}: prefix follows the first input line as rows change`, async () => {
        const { workspace, setPrefix, root, recordOf, render } = await open(
          "TextArea",
          `first-line-${size}-${labelPosition}`,
          { size, labelPosition, rows: 3 },
          true,
        );
        setPrefix("text");
        const canvas = bindCatalogCanvas(root, root.pageRootRecords());
        for (const rows of [3, 6, 2]) {
          workspace.execute(
            setFields({
              targets: [{ kind: "node", id: ROOT }],
              props: { rows: { kind: "set", value: rows } },
            }),
          );
          const input = recordOf("Input")[0]!;
          const prefix = recordOf("Text").find(
            (r) => r.props.slot === "prefix",
          )!;
          const boxes = root.getGeometry([input.id, prefix.id]);
          expect(boxes.get(prefix.id)!.y).toBe(boxes.get(input.id)!.y);
          const data = getSkiaNode(input.id)!;
          const text =
            data.text ?? data.children?.find((child) => child.text)?.text;
          expect(text).toBeDefined();
          expect(text!.paddingTop ?? 0).toBe(0);
        }
        canvas.dispose();
        const { host, done } = await render();
        const prefix = host.querySelector('[slot="prefix"]')!;
        expect((prefix.parentElement as HTMLElement).style.alignItems).toBe(
          "flex-start",
        );
        await done();
      });

  for (const kind of ["none", "text", "icon"] as const)
    it(`TextArea ${kind}: the side-label CSS selector reaches the actual control structure`, async () => {
      const { setPrefix, root, recordOf, render } = await open(
        "TextArea",
        `side-css-${kind}`,
        { labelPosition: "side" },
        true,
      );
      if (kind === "none") setPrefix("text");
      setPrefix(kind);
      const label = recordOf("Label")[0]!;
      const input = recordOf("Input")[0]!;
      const group =
        kind === "none" ? undefined : root.canvasInputs.get(input.parentId!);
      const boxes = root.getGeometry([
        label.id,
        input.id,
        ...(group ? [group.id] : []),
      ]);
      const inputY =
        // (no group: the Input's border + top padding — ADR-295 Phase 3, the S2 centring padding 6 + 1)
        boxes.get(input.id)!.y + (group ? boxes.get(group.id)!.y : 7);
      expect(boxes.get(label.id)!.y).toBe(inputY);
      const { host, done } = await render();
      const variants = COMPONENT_RULES_TABLE.TextField.structure!.composition!
        .containerVariants as {
        "label-position": {
          side: {
            nested: Array<{ selector: string; styles: Record<string, string> }>;
          };
        };
      };
      const rule = variants["label-position"].side.nested.find(
        (entry) => entry.styles["margin-top"],
      )!;
      expect(
        host
          .querySelector("label")!
          .matches(rule.selector.replace(/^>\s*/, "")),
      ).toBe(true);
      await done();
    });

  for (const type of ["TextField", "TextArea"]) {
    it(`${type}: the inspector follows edits and undo of the materialized label`, async () => {
      const { workspace, setPrefix, recordOf } = await open(
        type,
        `${type}-inspector`,
      );
      setPrefix("text");
      const target = { kind: "node" as const, id: ROOT };
      function Probe() {
        const contract = useCatalogEditContract(target);
        return createElement(
          "output",
          null,
          String(contract.fields.find((f) => f.key === "label")?.currentValue),
        );
      }
      (
        globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }
      ).IS_REACT_ACT_ENVIRONMENT = true;
      const host = document.body.appendChild(document.createElement("div"));
      const reactRoot = createRoot(host);
      await act(async () =>
        reactRoot.render(
          createElement(
            WorkspaceContext.Provider,
            { value: workspace },
            createElement(Probe),
          ),
        ),
      );
      expect(host.textContent).toBe("Price");
      await act(async () => {
        workspace.execute(
          setFields({
            targets: [workspace.itemOfRecord(recordOf("Label")[0]!.id)!.target],
            props: { children: { kind: "set", value: "Direct part edit" } },
          }),
        );
      });
      expect(host.textContent).toBe("Direct part edit");
      await act(async () => {
        workspace.undo();
      });
      expect(host.textContent).toBe("Price");
      await act(async () => reactRoot.unmount());
      host.remove();
    });
  }
  for (const type of FIELDS) {
    it(`${type}: editing prefix text immediately moves the input`, async () => {
      const { workspace, setPrefix, root, recordOf } = await open(
        type,
        `${type}-edit-prefix`,
        {},
        true,
      );
      setPrefix("text");
      const prefix = recordOf("Text").find((r) => r.props.slot === "prefix")!;
      const input = recordOf("Input")[0]!;
      const canvas = bindCatalogCanvas(root, root.pageRootRecords());
      for (const text of ["USD amount", "$"]) {
        workspace.execute(
          setFields({
            targets: [workspace.itemOfRecord(prefix.id)!.target],
            props: { children: { kind: "set", value: text } },
          }),
        );
        const geometry = root.getGeometry([prefix.id, input.id]);
        const prefixBox = geometry.get(prefix.id)!;
        expect(geometry.get(input.id)!.x).toBeGreaterThanOrEqual(
          prefixBox.x + prefixBox.width,
        );
        canvas.update();
        const paintedInput = canvas.stream.boundsMap.get(input.id)!;
        const paintedPrefix = canvas.stream.boundsMap.get(prefix.id)!;
        expect(paintedInput.x - paintedPrefix.x).toBeCloseTo(
          geometry.get(input.id)!.x - prefixBox.x,
          5,
        );
        expect(paintedInput.width).toBeCloseTo(
          geometry.get(input.id)!.width,
          5,
        );
      }
      canvas.dispose();
    });

    it(`${type}: field property edits still reach materialized parts after prefix insertion`, async () => {
      const { workspace, setPrefix, recordOf, render } = await open(
        type,
        `${type}-edit-parts`,
      );
      setPrefix("text");
      const before = {
        label: recordOf("Label")[0]!.props.children,
        placeholder: recordOf("Input")[0]!.props.placeholder,
      };
      const command = catalogPropertiesPatchCommand(
        workspace.runtime.graph,
        [{ kind: "node", id: ROOT }],
        { label: "Updated label", placeholder: "Updated placeholder" },
        (key) => recordOf(type)[0]!.props[key],
        new Set(),
      );
      workspace.execute(command!);
      expect(recordOf("Label")[0]!.props.children).toBe("Updated label");
      expect(recordOf("Input")[0]!.props.placeholder).toBe(
        "Updated placeholder",
      );
      const { host, done } = await render();
      expect(host.querySelector("label")!.textContent).toContain(
        "Updated label",
      );
      expect(
        host.querySelector("input, textarea")!.getAttribute("placeholder"),
      ).toBe("Updated placeholder");
      await done();
      workspace.undo();
      expect(recordOf("Label")[0]!.props.children).toBe(before.label);
      expect(recordOf("Input")[0]!.props.placeholder).toBe(before.placeholder);
      workspace.redo();
      expect(recordOf("Label")[0]!.props.children).toBe("Updated label");
      expect(recordOf("Input")[0]!.props.placeholder).toBe(
        "Updated placeholder",
      );
      const target = { kind: "node" as const, id: ROOT };
      workspace.execute(
        catalogPropertiesPatchCommand(
          workspace.runtime.graph,
          [target],
          { label: undefined, placeholder: undefined },
          () => true,
          new Set(),
        )!,
      );
      expect(recordOf("Label")[0]!.props.children).toBe(
        catalogPropBaseValue(workspace.runtime.graph, target, "label"),
      );
      expect(recordOf("Input")[0]!.props.placeholder).toBe(
        catalogPropBaseValue(workspace.runtime.graph, target, "placeholder"),
      );
      workspace.undo();
      setPrefix("none");
      expect(recordOf("Input")[0]!.props.placeholder).toBe(
        "Updated placeholder",
      );
      setPrefix("icon");
      const reloaded = new CatalogWorkspace(
        new CatalogGraph(
          workspace.runtime.graph.exportDocument(),
          workspace.runtime.graph.library,
        ),
        new CatalogStorage(
          indexedDB,
          `field-content-reload-${type}-${Math.random()}`,
        ),
        {
          engine: await nodeLayoutEngine(),
          viewport: { width: 1200, height: 800 },
          autosaveSchedule: () => {},
        },
      );
      const parts = [...reloaded.root.canvasInputs.values()];
      expect(
        parts.find((r) => reloaded.root.typeOf(r) === "Label")!.props.children,
      ).toBe("Updated label");
      expect(
        parts.find((r) => reloaded.root.typeOf(r) === "Input")!.props
          .placeholder,
      ).toBe("Updated placeholder");
      const contract = catalogEditContract(
        reloaded.runtime.graph,
        reloaded.readModel,
        target,
      );
      expect(
        contract.fields.find((field) => field.key === "label")!.currentValue,
      ).toBe("Updated label");
      expect(
        contract.fields.find((field) => field.key === "placeholder")!
          .currentValue,
      ).toBe("Updated placeholder");
    });
  }
  // (A failed DOM case leaves its host behind — its ids would answer the next case's lookups.)
  afterEach(() => {
    document.body.innerHTML = "";
  });

  for (const type of FIELDS)
    for (const kind of ["text", "icon"] as const)
      it(`${type} ${kind}: one step in · the DOM is the oracle's · one undo out`, async () => {
        const { workspace, state, setPrefix, root, recordOf, render } =
          await open(type, `${type}-${kind}`);
        const before = state();
        expect(before.kind).toBe("none");
        const recordsBefore = root.canvasInputs.size;

        setPrefix(kind);
        const after = state();
        expect(after.kind).toBe(kind);
        expect(after.group, "a control Group").toBeDefined();
        // The prefix record sits first in the Group, before the Input.
        const prefix = recordOf(kind === "text" ? "Text" : "Icon").find(
          (r) => r.props.slot === "prefix",
        )!;
        expect(prefix).toBeDefined();
        const group = root.canvasInputs.get(prefix.parentId!)!;
        expect(root.typeOf(group)).toBe("Group");
        expect(root.typeOf(root.canvasInputs.get(group.children[0])!)).toBe(
          kind === "text" ? "Text" : "Icon",
        );
        expect(
          group.children.some(
            (id) => root.typeOf(root.canvasInputs.get(id)!) === "Input",
          ),
        ).toBe(true);

        const oracle = ORACLE.prefix[`${type}:${kind}`];
        const { host, done } = await render();
        const control = host.querySelector(oracle.controlTag)!;
        expect(control, "control").not.toBeNull();
        const label = host.querySelector("label");
        const prefixEl = host.querySelector<HTMLElement>(
          `[data-catalog-id="${prefix.id}"]`,
        )!;
        expect(prefixEl, "prefix element").not.toBeNull();
        const box = prefixEl.parentElement!;
        if (process.env.ADR259_DUMP)
          console.log(
            "DOM",
            prefixEl.getAttribute("style"),
            "|BOX|",
            box.getAttribute("style"),
            box.className,
          );
        expect({
          labelledBy: labelledByShape(control, { label, prefix: prefixEl }),
          prefixFirstInGroup: box.firstElementChild === prefixEl,
          groupHoldsControl: box.contains(control),
        }).toEqual({
          labelledBy: oracle.labelledBy,
          prefixFirstInGroup: oracle.prefixFirstInGroup,
          groupHoldsControl: oracle.groupHoldsControl,
        });
        if (kind === "text") expect(nameOf(control)).toBe(oracle.name);
        expect(prefixEl.getAttribute("slot")).toBe("prefix");
        expect(
          (control as HTMLElement).style.maxWidth,
          "in-box input max",
        ).toBe("none");
        if (type === "NumberField")
          for (const stepper of box.querySelectorAll<HTMLElement>(
            ":scope > button",
          ))
            expect({
              borderWidth: stepper.style.borderWidth,
              corners: [
                stepper.style.borderTopLeftRadius,
                stepper.style.borderTopRightRadius,
                stepper.style.borderBottomRightRadius,
                stepper.style.borderBottomLeftRadius,
              ],
              height: stepper.style.height,
            }).toEqual({
              borderWidth: "0px",
              corners: ["0px", "0px", "0px", "0px"],
              // (the box's 32 less its borders — ADR-295 Phase 3, the S2 control height)
              height: "30px",
            });
        if (oracle.focusFromPrefixMouse !== undefined) {
          (document.activeElement as HTMLElement | null)?.blur?.();
          await act(async () => {
            prefixEl.dispatchEvent(
              new PointerEvent("pointerdown", {
                bubbles: true,
                cancelable: true,
                pointerType: "mouse",
              }),
            );
          });
          expect(document.activeElement === control, "mouse focus").toBe(
            oracle.focusFromPrefixMouse,
          );
          (document.activeElement as HTMLElement | null)?.blur?.();
          await act(async () => {
            prefixEl.dispatchEvent(
              new Event("touchend", { bubbles: true, cancelable: true }),
            );
          });
          expect(document.activeElement === control, "touch focus").toBe(
            oracle.focusFromPrefixTouch,
          );
        }
        await done();

        // One step: one undo restores the field as it was.
        workspace.undo();
        expect(state().kind).toBe("none");
        expect(root.canvasInputs.size).toBe(recordsBefore);
      });

  for (const type of FIELDS)
    it(`${type}: removing the prefix takes out what adding put in (a wrapped Input is unwrapped)`, async () => {
      const { state, setPrefix, root, recordOf } = await open(
        type,
        `${type}-remove`,
      );
      const groupsBefore = recordOf("Group").length;
      // What each part draws and lays out before (by type, in order).
      const look = () =>
        ["Input", "Button", "Icon", "Group"].flatMap((partType) =>
          recordOf(partType)
            .filter((r) => root.getGeometry([r.id]).get(r.id)!.width > 0)
            .map((r) => {
              const g = root.getGeometry([r.id]).get(r.id)!;
              return [partType, g.width, g.height, paintOf(root, r.id)];
            }),
        );
      const lookBefore = look();
      setPrefix("text");
      setPrefix("icon");
      expect(state().kind).toBe("icon");
      expect(recordOf("Text").filter((r) => r.props.slot === "prefix")).toEqual(
        [],
      );
      setPrefix("none");
      expect(state().kind).toBe("none");
      expect(recordOf("Group").length).toBe(groupsBefore);
      const input = recordOf("Input")[0];
      const parentType = root.typeOf(root.canvasInputs.get(input.parentId!)!);
      expect(parentType).toBe(
        type === "NumberField" || type === "ComboBox" ? "Group" : type,
      );
      // (The parts are owned copies now — they draw and lay out as the template's did.)
      expect(look()).toEqual(lookBefore);
    });

  for (const type of FIELDS)
    for (const [state, extra] of [
      ["default", {}],
      ["quiet", { isQuiet: true }],
      ["invalid", { isInvalid: true }],
      ["disabled", { isDisabled: true }],
    ] as const) {
      if (state === "quiet" && type === "ColorField") continue;
      it(`${type} ${state}: the prefix box paints and sizes as the Input box did (Canvas)`, async () => {
        const { setPrefix, root, recordOf } = await open(
          type,
          `${type}-${state}-paint`,
          extra,
        );
        const inputBefore = recordOf("Input")[0];
        const before = paintOf(root, inputBefore.id);
        const beforeBox = root
          .getGeometry([inputBefore.id])
          .get(inputBefore.id)!;
        setPrefix("text");
        const prefix = recordOf("Text").find((r) => r.props.slot === "prefix")!;
        const group = root.canvasInputs.get(prefix.parentId!)!;
        const input = recordOf("Input")[0];
        expect(input.parentId).toBe(group.id);
        // The Group draws the Input rule's box at the field's state; the Input lays its own down.
        // (A NumberField's Input drew only the start of its box — its steppers the end; the box
        // rounds every corner.)
        expect(paintOf(root, group.id)).toEqual(
          type === "NumberField"
            ? { ...before, radius: state === "quiet" ? "0" : "8" }
            : before,
        );
        expect(paintOf(root, input.id)).toMatchObject({
          fill: null,
          stroke: null,
        });
        if (state === "invalid") {
          // The invalid border (the Input rule's `&[data-invalid]` — `--negative`), with or
          // without a prefix.
          const [r, g] = paintOf(root, group.id).stroke ?? [0, 0];
          expect(r).toBeGreaterThan(0.9);
          expect(g).toBeLessThan(0.3);
        }
        const groupBox = root.getGeometry([group.id]).get(group.id)!;
        if (process.env.ADR259_DUMP)
          for (const r of [group, prefix, input, inputBefore])
            console.log(
              root.typeOf(r),
              JSON.stringify(root.getGeometry([r.id]).get(r.id)),
              JSON.stringify(root.getLayoutInput(r.id)),
              JSON.stringify(r.visual),
            );
        expect(groupBox.height).toBeCloseTo(beforeBox.height, 1);
        if (type !== "NumberField" && type !== "ComboBox")
          expect(groupBox.width).toBeCloseTo(beforeBox.width, 1);
        // The prefix sits inside the box's padding, before the Input.
        const prefixBox = root.getGeometry([prefix.id]).get(prefix.id)!;
        const inputBox = root.getGeometry([input.id]).get(input.id)!;
        expect(prefixBox.x).toBeGreaterThan(0);
        expect(inputBox.x).toBeGreaterThanOrEqual(
          prefixBox.x + prefixBox.width,
        );
        if (type === "NumberField")
          // Its steppers lay their border down, the box's inner height, at its end.
          for (const [index, stepper] of recordOf("Button").entries()) {
            expect(stepper.parentId).toBe(group.id);
            expect(paintOf(root, stepper.id)).toMatchObject({
              stroke: null,
              radius: "0",
            });
            const stepperBox = root.getGeometry([stepper.id]).get(stepper.id)!;
            expect(stepperBox.height).toBe(groupBox.height - 2);
            if (index === 1)
              expect(stepperBox.x + stepperBox.width).toBe(groupBox.width - 1);
          }
        if (type === "ComboBox") {
          // Its button keeps its place over the Input's end room, inside the box.
          const button = recordOf("Button")[0];
          const buttonBox = root.getGeometry([button.id]).get(button.id)!;
          expect(button.parentId).toBe(group.id);
          expect(buttonBox.x + buttonBox.width).toBeLessThan(
            groupBox.width - 1,
          );
        } else if (type !== "NumberField")
          // The Input fills the row to the box's border (a ColorField's keeps no maximum there).
          expect(inputBox.x + inputBox.width).toBe(groupBox.width - 1);
      });
    }

  for (const size of ["S", "M", "L"] as const)
    it(`the prefix paints as S2's (gray-600 · an icon of the text's line height) — size ${size}, Canvas = DOM`, async () => {
      const { setPrefix, recordOf, root, render } = await open(
        "TextField",
        `prefix-paint-${size}`,
        { size },
      );
      setPrefix("icon");
      const icon = recordOf("Icon").find((r) => r.props.slot === "prefix")!;
      // (ADR-295 Phase 3: the S2 line-height formula.)
      const line = { S: 16, M: 18, L: 20 }[size];
      expect(icon.visual).toMatchObject({
        width: line,
        height: line,
        iconSize: line,
      });
      const iconBox = root.getGeometry([icon.id]).get(icon.id)!;
      expect([iconBox.width, iconBox.height]).toEqual([line, line]);
      const { host, done } = await render();
      const el = host.querySelector<HTMLElement>(
        `[data-catalog-id="${icon.id}"]`,
      )!;
      expect(el.querySelector("svg")?.getAttribute("width")).toBe(String(line));
      const iconColor = el.style.color;
      await done();
      setPrefix("text");
      const text = recordOf("Text").find((r) => r.props.slot === "prefix")!;
      // The muted color (S2 `gray-600` — `--fg-muted`), the same on both consumers.
      expect(text.visual.color).toBe(icon.visual.color);
      expect(text.visual.color).not.toBe(recordOf("Input")[0].visual.color);
      const second = await render();
      const textEl = second.host.querySelector<HTMLElement>(
        `[data-catalog-id="${text.id}"]`,
      )!;
      expect(textEl.style.color).toBe(iconColor);
      expect(textEl.style.width).toBe("auto");
      await second.done();
    });

  it("a field's quiet · invalid edits after the prefix reach its box (Canvas)", async () => {
    const { workspace, setPrefix, root, recordOf } = await open(
      "TextField",
      "box-state-edit",
    );
    setPrefix("text");
    const field = recordOf("TextField")[0];
    const group = () =>
      root.canvasInputs.get(
        recordOf("Text").find((r) => r.props.slot === "prefix")!.parentId!,
      )!;
    const edit = (props: Record<string, boolean>) =>
      workspace.execute(
        setFields({
          targets: [workspace.positionOfRecord(field.id)!.target],
          props: Object.fromEntries(
            Object.entries(props).map(([k, v]) => [
              k,
              { kind: "set", value: v },
            ]),
          ),
        }),
      );
    edit({ isInvalid: true });
    expect(group().derivedProps?._fieldInvalid).toBe(true);
    expect(paintOf(root, group().id).stroke?.[0]).toBeGreaterThan(0.9);
    edit({ isInvalid: false, isQuiet: true });
    expect(group().derivedProps?.isQuiet).toBe(true);
    expect(paintOf(root, group().id)).toMatchObject({
      fill: null,
      radius: "0",
    });
  });

  it("a field without a prefix keeps its Input box (no FieldBox style)", async () => {
    for (const type of FIELDS) {
      const { root, recordOf } = await open(type, `${type}-none-style`);
      const input = recordOf("Input")[0];
      const groups = recordOf("Group");
      for (const group of groups)
        expect(
          root.getGeometry([group.id]).get(group.id),
          `${type} Group`,
        ).toBeDefined();
      expect(
        paintOf(root, input.id).stroke,
        `${type} Input stroke`,
      ).not.toBeNull();
    }
  });
});
