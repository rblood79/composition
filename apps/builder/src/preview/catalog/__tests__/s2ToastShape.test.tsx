// @vitest-environment jsdom
import "fake-indexeddb/auto";
import { act, fireEvent, render, waitFor } from "@testing-library/react";
import { useEffect } from "react";
import { afterEach, describe, expect, it } from "vitest";
import { useToast, type ToastOptions } from "@composition/shared/components";
import {
  createComponent,
  dissolveComponent,
  setToastShape,
} from "../../../../../../packages/shared/src/catalog/commands";
import type {
  EntryId,
  NodeId,
  ProjectEntry,
} from "../../../../../../packages/shared/src/catalog/document/types";
import { CatalogToastProvider } from "../../../../../../packages/shared/src/catalog/runtime/domView";
import { openAdr280Preview } from "./support/adr280Harness";

/**
 * User 2026-11-01 — Toast is the app's one toast shape (RAC `Toast.tsx` `MyToastRegion`), not a page
 * element: the project chooses a component whose root is a Toast (`setToastShape` — the Site panel's
 * 「Toast shape」), and the region renders every queued toast as that component with the Do's data
 * over it — the title in its text, the action label on its Button (hidden without one), the variant
 * on its root; its close button closes the toast, its Button runs the action. S2 exposes no `<Toast>`
 * element, so a `toast` Do stays data only.
 */
afterEach(() => {});

function Toasts({ toasts }: { toasts: ToastOptions[] }) {
  const { addToast } = useToast();
  useEffect(() => {
    for (const toast of toasts) addToast(toast);
  }, [addToast, toasts]);
  return null;
}

async function openShaped() {
  const h = await openAdr280Preview(["Toast", "Button"]);
  const [toastNode] = h.ids as [NodeId, NodeId];
  const graph = h.workspace.runtime.graph;
  const project = () => graph.getEntry(graph.projectId) as ProjectEntry;
  h.workspace.execute(
    createComponent({
      id: toastNode,
      name: "ToastTest",
      newId: h.workspace.newId,
    }),
  );
  const [definitionId] = project().definitionIds as [EntryId<"definition">];
  h.workspace.execute(setToastShape({ id: definitionId }));
  h.flush();
  expect(project().toastShapeId).toBe(definitionId);
  const region = (toasts: ToastOptions[]) => {
    const view = render(
      <CatalogToastProvider session={h.session} runtime={h.runtime}>
        <Toasts toasts={toasts} />
      </CatalogToastProvider>,
    );
    const doc = view.container.ownerDocument;
    return {
      view,
      shaped: () => [
        ...doc.querySelectorAll<HTMLElement>(".catalog-toast-shaped"),
      ],
      boxes: () => [
        ...doc.querySelectorAll<HTMLElement>(
          ".catalog-toast-shaped > .react-aria-Toast",
        ),
      ],
      button: (text: string) =>
        [...doc.querySelectorAll<HTMLElement>("button")].find(
          (b) => b.textContent === text,
        ),
    };
  };
  return { h, graph, project, definitionId, region };
}

describe("the app's toast shape — a project component whose root is a Toast", () => {
  it("renders a queued toast as the component: title in its text, variant on its root, no page alert role inside RAC's alertdialog", async () => {
    const { h, region } = await openShaped();
    const r = region([{ title: "Saved", variant: "positive" }]);
    await waitFor(() => expect(r.boxes()).toHaveLength(1));
    const [box] = r.boxes();
    expect(box!.getAttribute("data-variant")).toBe("positive");
    expect(box!.textContent).toContain("Saved");
    expect(box!.textContent).not.toContain("Toast message");
    expect(box!.getAttribute("role")).toBeNull();
    expect(box!.closest("[role=alertdialog]")).not.toBeNull();
    // (No action label — the shape's Button is hidden.)
    const button = box!.querySelector<HTMLElement>(".react-aria-Button");
    expect(button?.style.display).toBe("none");
    // Its close button closes the toast (not hides the box as a placed Toast's would).
    act(() => {
      fireEvent.click(box!.querySelector(".toast-close-button")!);
    });
    await waitFor(() => expect(r.boxes()).toHaveLength(0));
    r.view.unmount();
    h.view.unmount();
  });

  it("an action label goes on its Button; pressing runs the Do's action and closes when asked", async () => {
    const { h, region } = await openShaped();
    let pressed = 0;
    const r = region([
      {
        title: "Deleted",
        variant: "neutral",
        actionLabel: "Undo",
        onAction: () => {
          pressed += 1;
        },
        shouldCloseOnAction: true,
      },
    ]);
    await waitFor(() => expect(r.boxes()).toHaveLength(1));
    const undo = r.button("Undo");
    expect(undo).toBeDefined();
    expect(undo!.style.display).not.toBe("none");
    act(() => {
      fireEvent.click(undo!);
    });
    expect(pressed).toBe(1);
    await waitFor(() => expect(r.boxes()).toHaveLength(0));
    r.view.unmount();
    h.view.unmount();
  });

  it("only a Toast-rooted component is a shape; a deleted shape component leaves the project (the Library's Toast again)", async () => {
    const { h, project, definitionId } = await openShaped();
    const [, buttonNode] = h.ids as [NodeId, NodeId];
    h.workspace.execute(
      createComponent({
        id: buttonNode,
        name: "ButtonTest",
        newId: h.workspace.newId,
      }),
    );
    const other = project().definitionIds.find((id) => id !== definitionId)!;
    let refused: unknown;
    try {
      h.workspace.execute(setToastShape({ id: other }));
    } catch (error) {
      refused = (error as { code?: unknown }).code;
    }
    expect(refused).toBe("TOAST_SHAPE_NOT_TOAST");
    expect(project().toastShapeId).toBe(definitionId);
    h.workspace.execute(
      dissolveComponent({ definitionId, newId: h.workspace.newId }),
    );
    expect(project().toastShapeId).toBeUndefined();
    expect(h.workspace.history.getSnapshot().labels.at(-1)).toBe(
      "Delete component",
    );
    h.workspace.undo();
    expect(project().toastShapeId).toBe(definitionId);
    h.workspace.execute(setToastShape({ id: undefined }));
    expect(project().toastShapeId).toBeUndefined();
    h.view.unmount();
  });
});
