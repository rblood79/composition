// @vitest-environment jsdom
import "fake-indexeddb/auto";
import { act, render } from "@testing-library/react";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, describe, expect, it } from "vitest";
import {
  insertNodes,
  setFields,
} from "../../../../../../packages/shared/src/catalog/commands";
import { CatalogGraph } from "../../../../../../packages/shared/src/catalog/document/graph";
import { buildCodeCatalogLibrary } from "../../../../../../packages/shared/src/catalog/document/codeCatalogLibrary";
import type {
  EntryId,
  NodeEntry,
  NodeId,
} from "../../../../../../packages/shared/src/catalog/document/types";
import { COMPONENT_RULES_TABLE } from "../../../../../../packages/shared/src/catalog/generated/componentRulesTable";
import { DATE_RANGE_GROUP_PAINT } from "../../../../../../packages/shared/src/catalog/document/manualBoxRules";
import { getSkiaNode } from "../../workspace/canvas/skia/useSkiaNode";
import { bindCatalogCanvas } from "../canvasBinding";
import { renderCatalogDom } from "../domBinding";
import { newCatalogProjectDocument } from "../project";
import { CatalogStorage } from "../storage";
import { CatalogWorkspace } from "../workspace";
import { nodeLayoutEngine } from "./support/nodeLayoutEngine";

/**
 * ADR-256 Phase 6b (G2) — a field's control box is a RAC `Group` node (`NumberField > Group >
 * Button + Input + Button`). Beyond the structure (`adr253FieldPartsDom` · `adr256FieldNodeTree`):
 * a stepper Button in the Group draws the field's state — a mounted Preview repaints it when the
 * field is disabled, as a fresh render does.
 */
const BODY = "project:node:home-body" as NodeId;
const FIELD = "project:node:field" as NodeId;
const cleanups: Array<() => void> = [];
afterEach(() => {
  for (const cleanup of cleanups.splice(0).reverse()) cleanup();
});

async function open(type: string) {
  const workspace = new CatalogWorkspace(
    new CatalogGraph(
      newCatalogProjectDocument({
        projectId: "project:project:adr256-control-group" as EntryId<"project">,
        name: "Control group",
      }),
      await buildCodeCatalogLibrary(),
    ),
    new CatalogStorage(indexedDB, `adr256-control-group-${Math.random()}`),
    {
      engine: await nodeLayoutEngine(),
      viewport: { width: 1200, height: 800 },
      autosaveSchedule: () => {},
    },
  );
  workspace.execute(
    insertNodes({
      parent: { kind: "node", id: BODY },
      entries: [
        {
          kind: "node",
          id: FIELD,
          definitionId: `lib:definition:origin-component-${type}`,
          children: [],
          props: {},
          visual: {},
          sizing: {},
          descendantOverrides: [],
        } as NodeEntry,
      ],
      rootIds: [FIELD],
      newId: workspace.newId,
    }),
  );
  cleanups.push(() => act(() => workspace.dispose()));
  return workspace;
}

describe("ADR-256 Phase 6b — a field's control box is a RAC Group node", () => {
  it("a NumberField's stepper in its Group repaints with the field's disabled state (mounted = fresh)", async () => {
    const workspace = await open("numberfield");
    const root = workspace.root;
    const field = root.recordsOfSource(FIELD)[0]!;
    const group = [...root.domInputs.values()].find(
      (record) => record.parentId === field && root.typeOf(record) === "Group",
    )!;
    expect(group).toBeTruthy();
    const stepper = group.children.find(
      (id) => root.domInputs.get(id)!.bindingId === "button",
    )!;
    const styleIn = (container: ParentNode) =>
      container.querySelector<HTMLElement>(
        `[data-catalog-id="${CSS.escape(stepper)}"]`,
      )
        ?.style.cssText.split(";")
        .map((declaration) => declaration.trim())
        .filter(Boolean)
        .sort()
        .join("; ") ?? "";
    const fresh = () => {
      const element = document.createElement("div");
      element.innerHTML = renderToStaticMarkup(renderCatalogDom(root, field));
      return styleIn(element);
    };
    const view = render(renderCatalogDom(root, field));
    cleanups.push(() => view.unmount());
    const enabled = styleIn(view.container);
    expect(enabled).toBe(fresh());
    act(() => {
      workspace.execute(
        setFields({
          targets: [{ kind: "node", id: FIELD }],
          props: { isDisabled: { kind: "set", value: true } },
        }),
      );
    });
    const disabled = fresh();
    // (The disabled field fades once: its stepper drops its rest paint — the state differs.)
    expect(disabled).not.toBe(enabled);
    expect(styleIn(view.container)).toBe(disabled);
  });

  it("a DateRangePicker's Group paints the box on the Canvas: the range picker binds, fill · border · the size's radius", async () => {
    const workspace = await open("daterangepicker");
    const root = workspace.root;
    const field = root.recordsOfSource(FIELD)[0]!;
    const group = [...root.canvasInputs.values()].find(
      (record) => record.parentId === field && root.typeOf(record) === "Group",
    )!;
    expect(group.visual).toMatchObject({
      fill: DATE_RANGE_GROUP_PAINT.fill,
      borderColor: DATE_RANGE_GROUP_PAINT.borderColor,
      borderWidth: 1,
      radius: 6,
    });
    const canvas = bindCatalogCanvas(root, root.pageRootRecords());
    cleanups.push(() => canvas.dispose());
    const box = getSkiaNode(group.id)?.box;
    // The light theme's inset surface and border (a value the Canvas cannot read paints black).
    const [r, g, b, alpha] = box!.fillColor;
    expect(alpha).toBeGreaterThan(0);
    expect(Math.min(r!, g!, b!)).toBeGreaterThan(0.9);
    expect(box?.strokeWidth).toBe(1);
    expect(Math.max(...box!.strokeColor!.slice(0, 3))).toBeGreaterThan(0.5);
  });

  it("the paint the Canvas states is the range picker rule's Group bridges (one source of the tokens)", () => {
    const delegation = (
      COMPONENT_RULES_TABLE.DateRangePicker as unknown as {
        structure: {
          composition: {
            delegation: Array<{
              childSelector: string;
              bridges?: Record<string, string>;
            }>;
          };
        };
      }
    ).structure.composition.delegation.find(
      (entry) => entry.childSelector === ".react-aria-Group",
    )!;
    expect(delegation.bridges).toMatchObject({
      background: DATE_RANGE_GROUP_PAINT.fill,
      border: `var(--border-width-thin) solid ${DATE_RANGE_GROUP_PAINT.borderColor}`,
      "border-radius": "var(--drp-group-radius)",
    });
  });
});
