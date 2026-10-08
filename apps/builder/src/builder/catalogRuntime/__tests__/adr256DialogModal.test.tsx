// @vitest-environment jsdom
import "fake-indexeddb/auto";
import { act } from "react";
import { createElement, type ReactElement } from "react";
import { createRoot } from "react-dom/client";
import {
  Button,
  Dialog,
  DialogTrigger,
  Heading,
  Modal,
  Text,
} from "react-aria-components";
import { afterEach, describe, expect, it } from "vitest";
import {
  insertNodes,
  setFields,
} from "../../../../../../packages/shared/src/catalog/commands";
import { getPrimitiveBinding } from "../../../../../../packages/shared/src/catalog/bindings";
import { CatalogGraph } from "../../../../../../packages/shared/src/catalog/document/graph";
import { buildCodeCatalogLibrary } from "../../../../../../packages/shared/src/catalog/document/codeCatalogLibrary";
import { REUSABLE_ORIGIN_TEMPLATES } from "../../../../../../packages/shared/src/catalog/document/generated/reusableOriginLibrary";
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

/**
 * ADR-256 Phase 8b (G2) — a Dialog opens in its Modal node, the reference
 * `DialogTrigger > Button + Modal > Dialog` (react-aria.adobe.com Modal — G0 example 9). RAC's Modal
 * makes its ModalOverlay; the Dialog draws no overlay of its own. Dismissing on an outside press is
 * the Modal's (`isDismissable` — RAC ModalOverlayProps). The Canvas draws the trigger only.
 */
const BODY = "project:node:home-body" as NodeId;
const PLACED = "project:node:placed" as NodeId;

async function place(type: "dialog") {
  const workspace = new CatalogWorkspace(
    new CatalogGraph(
      newCatalogProjectDocument({
        projectId: "project:project:adr256-p8b" as EntryId<"project">,
        name: "Phase 8b",
      }),
      await buildCodeCatalogLibrary(),
    ),
    new CatalogStorage(indexedDB, `adr256-p8b-${Math.random()}`),
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
            `lib:definition:origin-component-${type}` as LibraryDefinitionId,
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
  const placed = () =>
    [...root.canvasInputs.values()].find(
      (record) => record.sourceId === PLACED,
    )!;
  const part = (name: string) =>
    [...root.canvasInputs.values()].find(
      (record) => root.typeOf(record) === name,
    );
  return { workspace, root, placed, part };
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
async function press(button: HTMLElement) {
  await act(async () => {
    for (const type of ["pointerdown", "pointerup"])
      button.dispatchEvent(
        new PointerEvent(type, {
          bubbles: true,
          pointerId: 1,
          pointerType: "mouse",
        }),
      );
    button.click();
  });
  await settle();
}
/**
 * Decision 11 structure: tag · role · slot · aria (ids dropped) · text. Hidden elements are left out
 * — the shared Popover's focus scope sentinels (`ContentFocusScope` — `span[hidden]`, its focus
 * containment and restore without a Dialog).
 */
function structure(element: Element): string {
  const walk = (node: Element): string => {
    const attributes = [...node.attributes]
      .filter((attribute) =>
        /^(role|slot|aria-(?!labelledby|describedby|controls))/.test(
          attribute.name,
        ),
      )
      .map((attribute) => `${attribute.name}=${attribute.value}`)
      .sort();
    const content = [...node.childNodes]
      .filter((child) => !(child as Element).hasAttribute?.("hidden"))
      .map((child) =>
      child.nodeType === 1
        ? walk(child as Element)
        : (child.textContent ?? "").trim(),
    );
    return `<${node.tagName.toLowerCase()} ${attributes.join(" ")}>${content.join("")}</>`;
  };
  return walk(element);
}

describe("ADR-256 Phase 8b — Dialog in its Modal node", () => {
  it("the origin is DialogTrigger > Button + Modal > Dialog (title · content · footer)", () => {
    const node = (id: string) =>
      REUSABLE_ORIGIN_TEMPLATES.find((entry) => entry.id === id)!;
    const types = (id: string) =>
      node(id).children.map((child) => node(child).definitionId);
    const root = "lib:template:component-dialog";
    expect(types(root)).toEqual([
      "lib:definition:origin-component-button",
      "lib:definition:type-Modal",
    ]);
    const modal = node(root).children[1]!;
    expect(types(modal)).toEqual(["lib:definition:type-Dialog"]);
    expect(types(node(modal).children[0]!)).toEqual([
      "lib:definition:origin-component-heading",
      "lib:definition:type-frame",
      "lib:definition:type-DialogFooter",
    ]);
  });

  it("dismissing on an outside press is the Modal's prop, not the Dialog's", () => {
    expect(getPrimitiveBinding("Modal")!.props.accepts.isDismissable).toBeDefined();
    expect(getPrimitiveBinding("Dialog")!.props.accepts.isDismissable).toBeUndefined();
  });

  it("the open overlay has the reference's structure — one ModalOverlay > Modal > Dialog", async () => {
    const { workspace, placed } = await place("dialog");
    const host = await mount(renderCatalogDom(workspace.root, placed().id));
    await press(host.querySelector("button")!);
    expect(document.querySelectorAll(".react-aria-ModalOverlay")).toHaveLength(1);
    expect(document.querySelectorAll(".react-aria-Modal")).toHaveLength(1);
    const ours = structure(document.querySelector(".react-aria-ModalOverlay")!);
    await unmount?.();
    document.body.innerHTML = "";
    await mount(
      <DialogTrigger defaultOpen>
        <Button>Open Dialog</Button>
        <Modal>
          <Dialog>
            <Heading slot="title">Dialog Title</Heading>
            <div>
              <Text slot="description">Dialog content goes here.</Text>
            </div>
            <div>
              <div />
              <Button slot="close">Close</Button>
            </div>
          </Dialog>
        </Modal>
      </DialogTrigger>,
    );
    await settle();
    expect(ours).toBe(
      structure(document.querySelector(".react-aria-ModalOverlay")!),
    );
  });

  it("the close Button closes it; an outside press closes it only when the Modal is dismissable", async () => {
    for (const dismissable of [false, true]) {
      const { workspace, placed, part } = await place("dialog");
      if (dismissable)
        workspace.execute(
          setFields({
            targets: [
              workspace.positionOfRecord(part("Modal")!.id)!.target,
            ],
            props: { isDismissable: { kind: "set", value: true } },
          }),
        );
      const host = await mount(renderCatalogDom(workspace.root, placed().id));
      await press(host.querySelector("button")!);
      const overlay = document.querySelector(".react-aria-ModalOverlay")!;
      await act(async () => {
        for (const type of ["pointerdown", "pointerup"])
          overlay.dispatchEvent(
            new PointerEvent(type, {
              bubbles: true,
              pointerId: 2,
              pointerType: "mouse",
              button: 0,
            }),
          );
        overlay.dispatchEvent(new MouseEvent("click", { bubbles: true }));
      });
      await settle();
      expect(
        document.querySelector(".react-aria-ModalOverlay") === null,
        `dismissable ${dismissable}`,
      ).toBe(dismissable);
      if (!dismissable) {
        await press(
          document.querySelector('.react-aria-Dialog button[slot="close"]')!,
        );
        expect(document.querySelector(".react-aria-ModalOverlay")).toBeNull();
      }
      await unmount?.();
      unmount = undefined;
      document.body.innerHTML = "";
    }
  });

  it("the Canvas draws the trigger only (the Modal is hidden at rest)", async () => {
    const { part } = await place("dialog");
    expect(part("Modal")!.hidden).toBe(true);
    expect(part("Button")!.hidden).toBeFalsy();
  });
});
