// @vitest-environment jsdom
import "fake-indexeddb/auto";
import { act, type ReactElement } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, describe, expect, it } from "vitest";
import { getPrimitiveBinding } from "../../../../../../packages/shared/src/catalog/bindings";
import {
  insertNodes,
  setFields,
} from "../../../../../../packages/shared/src/catalog/commands";
import { buildCodeCatalogLibrary } from "../../../../../../packages/shared/src/catalog/document/codeCatalogLibrary";
import { CatalogGraph } from "../../../../../../packages/shared/src/catalog/document/graph";
import type {
  EntryId,
  LibraryDefinitionId,
  NodeId,
} from "../../../../../../packages/shared/src/catalog/document/types";
import { renderCatalogDom } from "../domBinding";
import { newCatalogProjectDocument } from "../project";
import { CatalogStorage } from "../storage";
import { CatalogWorkspace } from "../workspace";
import { nodeLayoutEngine } from "./support/nodeLayoutEngine";
import { catalogDialogChromeShapes } from "../ruleShapes";

/**
 * S2 Dialog `isDismissible` (2026-11-18 사용자 결정 「Dialog 에 isDismissible 추가」): one Dialog prop
 * draws S2's `CloseButton` (the cross at the header's end — `slot="close"`, named 「Dismiss」),
 * makes its Modal close on an outside press (S2 passes `isDismissable` to its Modal) and hides its
 * ButtonGroup ("Dismissible dialogs replace their ButtonGroup with a close button").
 */
const BODY = "project:node:home-body" as NodeId;
const PLACED = "project:node:placed" as NodeId;

async function place() {
  const workspace = new CatalogWorkspace(
    new CatalogGraph(
      newCatalogProjectDocument({
        projectId: "project:project:dismissible" as EntryId<"project">,
        name: "Dismissible",
      }),
      await buildCodeCatalogLibrary(),
    ),
    new CatalogStorage(indexedDB, `dismissible-${Math.random()}`),
    {
      engine: await nodeLayoutEngine(),
      viewport: { width: 1920, height: 1080 },
      autosaveSchedule: () => {},
    },
  );
  workspace.execute(
    insertNodes({
      parent: { kind: "node", id: BODY },
      entries: [
        {
          kind: "node",
          id: PLACED,
          definitionId:
            "lib:definition:origin-component-dialog" as LibraryDefinitionId,
          children: [],
          props: {},
          visual: {},
          sizing: {},
          descendantOverrides: [],
        },
      ],
      rootIds: [PLACED],
      newId: workspace.newId,
    }),
  );
  const root = workspace.root;
  const part = (name: string) =>
    [...root.canvasInputs.values()].find(
      (record) => root.typeOf(record) === name,
    );
  const setDismissible = (value: boolean) =>
    workspace.execute(
      setFields({
        targets: [workspace.positionOfRecord(part("Dialog")!.id)!.target],
        props: { isDismissible: { kind: "set", value } },
      }),
    );
  const placed = () =>
    [...root.canvasInputs.values()].find(
      (record) => record.sourceId === PLACED,
    )!;
  const setKeyboardLocked = (value: boolean) =>
    workspace.execute(
      setFields({
        targets: [workspace.positionOfRecord(part("Dialog")!.id)!.target],
        props: { isKeyboardDismissDisabled: { kind: "set", value } },
      }),
    );
  return { workspace, root, part, placed, setDismissible, setKeyboardLocked };
}

let unmount: (() => Promise<void>) | undefined;
afterEach(async () => {
  await unmount?.();
  unmount = undefined;
  document.body.innerHTML = "";
});
async function mount(element: ReactElement) {
  const host = document.createElement("div");
  document.body.append(host);
  const root = createRoot(host);
  await act(async () => root.render(element));
  unmount = async () => act(async () => root.unmount());
  return host;
}
const settle = () =>
  act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 30));
  });
async function press(element: Element) {
  await act(async () => {
    for (const type of ["pointerdown", "pointerup"])
      element.dispatchEvent(
        new PointerEvent(type, {
          bubbles: true,
          pointerId: 1,
          pointerType: "mouse",
          button: 0,
        }),
      );
    (element as HTMLElement).click?.();
    if (!(element as HTMLElement).click)
      element.dispatchEvent(new MouseEvent("click", { bubbles: true }));
  });
  await settle();
}

describe("S2 Dialog isDismissible (2026-11-18)", () => {
  it("is a Dialog prop (S2's spelling — the Modal keeps RAC's isDismissable)", () => {
    expect(getPrimitiveBinding("Dialog")!.props.accepts.isDismissible).toEqual(
      expect.objectContaining({ kind: "boolean" }),
    );
  });

  it("the Canvas: the ButtonGroup gives way, the Modal dismisses; off again, both return", async () => {
    const { part, setDismissible } = await place();
    expect(part("ButtonGroup")!.hidden).toBeFalsy();
    setDismissible(true);
    expect(part("ButtonGroup")!.hidden).toBe(true);
    expect(part("Modal")!.derivedProps?._dialogDismissible).toBe(true);
    setDismissible(false);
    expect(part("ButtonGroup")!.hidden).toBeFalsy();
    expect(part("Modal")!.derivedProps?._dialogDismissible).toBeUndefined();
  });

  it("the Canvas draws the cross at the header's end (S2 CloseButton: control M at 12 · 12)", () => {
    const shapes = catalogDialogChromeShapes({
      type: "Dialog",
      node: { props: { isDismissible: true } } as never,
      rect: { width: 310, height: 200 } as never,
      theme: "light",
    });
    expect(shapes).toEqual([
      expect.objectContaining({
        type: "icon_font",
        iconName: "x",
        x: 310 - 12 - 16,
        y: 12 + 16,
        fontSize: 12,
      }),
    ]);
    expect(
      catalogDialogChromeShapes({
        type: "Dialog",
        node: { props: {} } as never,
        rect: { width: 310, height: 200 } as never,
        theme: "light",
      }),
    ).toEqual([]);
  });

  it("the Preview: a Dismiss cross closes it, no ButtonGroup, an outside press closes it", async () => {
    for (const how of ["cross", "outside"]) {
      const { workspace, placed, setDismissible } = await place();
      setDismissible(true);
      const host = await mount(renderCatalogDom(workspace.root, placed().id));
      await press(host.querySelector("button")!);
      const dialog = document.querySelector(".react-aria-Dialog")!;
      expect(dialog.querySelector('[role="group"]')).toBeNull();
      const cross = dialog.querySelector('button[slot="close"]')!;
      expect(cross.getAttribute("aria-label")).toBe("Dismiss");
      await press(
        how === "cross"
          ? cross
          : document.querySelector(".react-aria-ModalOverlay")!,
      );
      expect(
        document.querySelector(".react-aria-ModalOverlay"),
        how,
      ).toBeNull();
      await unmount?.();
      unmount = undefined;
      document.body.innerHTML = "";
    }
  });
});

// S2 Dialog `isKeyboardDismissDisabled` (S2 체크리스트 부록 D.3 2단계, 2026-11-23): Escape does not close
// it — its Modal's RAC `isKeyboardDismissDisabled` (derived `_dialogKeyboardDismissDisabled`).
describe("S2 Dialog isKeyboardDismissDisabled (2026-11-23)", () => {
  it.each([
    [false, false],
    [true, true],
  ] as const)(
    "isKeyboardDismissDisabled %s: the Modal's derived value, and after Escape the dialog is open = %s",
    async (locked, stillOpen) => {
      const { workspace, part, placed, setKeyboardLocked } = await place();
      setKeyboardLocked(locked);
      expect(
        part("Modal")!.derivedProps?._dialogKeyboardDismissDisabled === true,
      ).toBe(locked);
      const host = await mount(renderCatalogDom(workspace.root, placed().id));
      await press(host.querySelector("button")!);
      const dialog = document.querySelector(
        ".react-aria-Dialog",
      ) as HTMLElement;
      expect(dialog).not.toBeNull();
      await act(async () => {
        dialog.dispatchEvent(
          new KeyboardEvent("keydown", { key: "Escape", bubbles: true }),
        );
      });
      await settle();
      expect(!!document.querySelector(".react-aria-ModalOverlay")).toBe(
        stillOpen,
      );
    },
  );
});
