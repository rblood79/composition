// @vitest-environment jsdom
import "fake-indexeddb/auto";
import { createElement, type ReactNode } from "react";
import { act, renderHook } from "@testing-library/react";
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
import { createCatalogStylesHost } from "../../panels/styles/catalog/catalogStylesHost";
import { useAppearanceValues } from "../../panels/styles/hooks/useAppearanceValues";
import { useLayoutValues } from "../../panels/styles/hooks/useLayoutValues";
import {
  StylesHostContext,
  type StylesHost,
} from "../../panels/styles/stylesHost";
import { newCatalogProjectDocument } from "../project";
import { CatalogWorkspaceProvider } from "../react";
import { CatalogStorage } from "../storage";
import { CatalogWorkspace } from "../workspace";
import { nodeLayoutEngine } from "./support/nodeLayoutEngine";

/**
 * A field box in the Design panel (2026-11-13, 사용자 「combobox-group border-radius · border-color 가
 * 이전의 input 에 들어 있다 — group 로 다 옮겨지지 않았다」): the control Group of a boxed field shows
 * the box it draws — the Input rule's corner · border · background at the field's size (the same as a
 * TextField's Input) — and the Input laid into it shows none of them and no minimum height.
 */
const BODY = "project:node:home-body" as NodeId;
const NODE = "project:node:field" as NodeId;
const cleanups: Array<() => void> = [];
afterEach(() => {
  for (const cleanup of cleanups.splice(0).reverse()) cleanup();
});

async function open(origin: string, size: string) {
  const workspace = new CatalogWorkspace(
    new CatalogGraph(
      newCatalogProjectDocument({
        projectId: "project:project:field-box-panel" as EntryId<"project">,
        name: "Field box panel",
      }),
      await buildCodeCatalogLibrary(),
    ),
    new CatalogStorage(indexedDB, `field-box-panel-${Math.random()}`),
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
          id: NODE,
          definitionId: `lib:definition:origin-component-${origin}`,
          children: [],
          props: {},
          visual: {},
          sizing: {},
          descendantOverrides: [],
        } as NodeEntry,
      ],
      rootIds: [NODE],
      newId: workspace.newId,
    }),
  );
  workspace.execute(
    setFields({
      targets: [{ kind: "node", id: NODE }],
      props: { size: { kind: "set", value: size } },
    }),
  );
  cleanups.push(() => act(() => workspace.dispose()));
  const host = createCatalogStylesHost(workspace);
  const wrapper = ({ children }: { children: ReactNode }) =>
    createElement(CatalogWorkspaceProvider, {
      workspace,
      children: createElement(StylesHostContext.Provider, {
        value: host as StylesHost,
        children,
      }),
    });
  const recordOf = (type: string) =>
    [...workspace.root.domInputs.values()].find(
      (record) => workspace.root.typeOf(record) === type,
    )!;
  const panel = (type: string) => {
    const id = recordOf(type).id;
    const appearance = renderHook(() => useAppearanceValues(id), { wrapper })
      .result.current!;
    const context = renderHook(() => host.useElementStyleContext(id), {
      wrapper,
    }).result.current;
    const layout = renderHook(() => useLayoutValues(id), { wrapper }).result
      .current!;
    return {
      display: layout.display,
      flexDirection: layout.flexDirection,
      alignItems: layout.alignItems,
      radius: appearance.borderRadius,
      borderWidth: appearance.borderWidth,
      borderColor: appearance.borderColor,
      backgroundColor: appearance.backgroundColor,
      minHeight: context.effective?.minHeight,
    };
  };
  return { workspace, host, recordOf, panel };
}

describe("a field box in the Design panel — the Group holds the box, the Input none", () => {
  for (const size of ["S", "M", "XL"])
    for (const [origin, input, groupRadius] of [
      ["numberfield", "Input", undefined],
      ["combobox", "Input", undefined],
      ["datepicker", "DateInput", undefined],
      ["daterangepicker", "DateInput", undefined],
      ["searchfield", "Input", "9999px"],
      ["textfield", "Input", undefined],
      ["textarea", "Input", undefined],
      ["colorfield", "Input", undefined],
      ["datefield", "DateInput", undefined],
      ["timefield", "DateInput", undefined],
    ] as const)
      it(`${origin} ${size}`, async () => {
        // The Input rule's box at this size (S 7 · M 8 · XL 10, border 2) — the same on every field's box
        // Group, a TextField's included (S2 `FieldGroup`, 2026-11-14).
        const plain = (await open("textfield", size)).panel("Group");
        expect(plain).toMatchObject({
          radius: { S: "7px", M: "8px", XL: "10px" }[size],
          borderWidth: "2px",
        });
        expect(plain.backgroundColor).not.toBe("#00000000");
        expect(plain.borderColor).not.toBe("#00000000");
        const field = await open(origin, size);
        expect(field.panel("Group")).toMatchObject({
          // The box lays its row out (`catalogFieldBoxStyle` — the template holds no layout since the
          // 2026-11-13 cleanup; 사용자 「DatePicker 의 group 는 flex 도 되어 있지 않다」).
          display: "flex",
          flexDirection: "row",
          alignItems: origin === "textarea" ? "flex-start" : "center",
          radius: groupRadius ?? plain.radius,
          borderWidth: plain.borderWidth,
          borderColor: plain.borderColor,
          backgroundColor: plain.backgroundColor,
        });
        const laid = field.panel(input);
        expect(laid).toMatchObject({ radius: "0px", borderWidth: "0px", minHeight: "0px" });
        expect(laid.borderColor).toBe("#00000000");
        expect(laid.backgroundColor).toBe("#00000000");
        // The Input in the box no longer stands taller than the box's inner height (border 2 a side).
        const rect = (id: string) =>
          field.workspace.root.getGeometry([id]).get(id)!;
        expect(rect(field.recordOf(input).id).height).toBeLessThanOrEqual(
          rect(field.recordOf("Group").id).height - 4,
        );
      });
  it("what the author wrote on the Group wins (border color, radius)", async () => {
    const field = await open("combobox", "M");
    field.workspace.selectRecords([field.recordOf("Group").id]);
    act(() => {
      field.host.updateStyle("borderColor", "#ff0000");
      field.host.updateStyle("borderRadius", "3px");
    });
    expect(field.panel("Group")).toMatchObject({
      borderColor: "#ff0000",
      radius: "3px",
    });
  });
});
