// @vitest-environment jsdom
import "fake-indexeddb/auto";
import { act, type ReactElement } from "react";
import {
  Button,
  DialogTrigger as RACDialogTrigger,
} from "react-aria-components";
import { createRoot } from "react-dom/client";
import { afterEach, describe, expect, it } from "vitest";
import { insertNodes } from "../../../../../../packages/shared/src/catalog/commands";
import { buildCodeCatalogLibrary } from "../../../../../../packages/shared/src/catalog/document/codeCatalogLibrary";
import { CatalogGraph } from "../../../../../../packages/shared/src/catalog/document/graph";
import type {
  EntryId,
  LibraryDefinitionId,
  NodeId,
} from "../../../../../../packages/shared/src/catalog/document/types";
import { Dialog } from "../../../../../../packages/shared/src/components/Dialog";
import { DialogTriggerScope } from "../../../../../../packages/shared/src/components/DialogTrigger";
import { renderCatalogDom } from "../domBinding";
import { newCatalogProjectDocument } from "../project";
import { CatalogStorage } from "../storage";
import { CatalogWorkspace } from "../workspace";
import { nodeLayoutEngine } from "./support/nodeLayoutEngine";

/**
 * A modal's underlay (the scrim under it) is the Modal rule's value — S2 `Modal.tsx`
 * `modalOverlayStyles.bg` — not a fixed color of either consumer: the Canvas backdrop and the DOM
 * `ModalOverlay` read the same derived value (`_modalUnderlay`).
 */
const BODY = "project:node:home-body" as NodeId;
const PLACED = "project:node:placed" as NodeId;

async function placeDialog() {
  const library = await buildCodeCatalogLibrary();
  const workspace = new CatalogWorkspace(
    new CatalogGraph(
      newCatalogProjectDocument({
        projectId: "project:project:modal-underlay" as EntryId<"project">,
        name: "Modal underlay",
      }),
      library,
    ),
    new CatalogStorage(indexedDB, `modal-underlay-${Math.random()}`),
    {
      engine: await nodeLayoutEngine(),
      viewport: { width: 1200, height: 900 },
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
  const record = (match: (id: string) => boolean) =>
    [...root.canvasInputs.values()].find((r) => match(r.id))!;
  return {
    library,
    root,
    placed: record((id) => root.canvasInputs.get(id)!.sourceId === PLACED),
    modal: record((id) => root.typeOf(root.canvasInputs.get(id)!) === "Modal"),
  };
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

describe("modal underlay = the Modal rule's value", () => {
  it("the Modal rule owns S2's underlay token, and the open Modal's record carries it", async () => {
    const { library, modal } = await placeDialog();
    expect(library.rules.get("Modal")?.underlay).toBe(
      "{color.overlay-backdrop}",
    );
    expect(modal.derivedProps?._modalUnderlay).toBe("{color.overlay-backdrop}");
  });

  it("the DOM ModalOverlay paints it (its variable), as the Canvas backdrop does", async () => {
    const { root, placed } = await placeDialog();
    const host = await mount(renderCatalogDom(root, placed.id));
    await act(async () => {
      for (const type of ["pointerdown", "pointerup"])
        host.querySelector("button")!.dispatchEvent(
          new PointerEvent(type, {
            bubbles: true,
            pointerId: 1,
            pointerType: "mouse",
          }),
        );
      host.querySelector("button")!.click();
    });
    await settle();
    const overlays = document.querySelectorAll<HTMLElement>(
      ".react-aria-ModalOverlay",
    );
    expect(overlays).toHaveLength(1);
    expect(overlays[0]!.style.backgroundColor).toBe("var(--overlay-backdrop)");
    // (RAC still writes its viewport variables on the same element.)
    expect(
      overlays[0]!.style.getPropertyValue("--visual-viewport-height"),
    ).not.toBe("");
  });

  it("a Dialog that opens its own modal (no Modal node) paints the underlay it is given", async () => {
    await mount(
      <RACDialogTrigger defaultOpen>
        <Button>Open</Button>
        <DialogTriggerScope.Provider value={true}>
          <Dialog underlay="var(--overlay-backdrop)">Body</Dialog>
        </DialogTriggerScope.Provider>
      </RACDialogTrigger>,
    );
    await settle();
    const overlay = document.querySelector<HTMLElement>(
      ".react-aria-ModalOverlay",
    )!;
    expect(overlay.style.backgroundColor).toBe("var(--overlay-backdrop)");
  });
});
