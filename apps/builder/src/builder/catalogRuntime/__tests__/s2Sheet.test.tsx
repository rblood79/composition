// @vitest-environment jsdom
/**
 * S2 체크리스트 §4.1 Sheet (2026-11-22, 사용자 결정 「S2 값 그대로」) — S2 에는 Sheet 가 없어 같은 계열의
 * Modal + Dialog (`Modal.tsx` · `Dialog.tsx`) 값을 따른다:
 *   - 폭 480 (Modal `size` M — S 400 · M 480);
 *   - 안쪽 여백 32 (Dialog header · content · footer 의 `paddingX` · `paddingTop` · `paddingBottom` 32);
 *   - 닫기 버튼은 끝 정렬 ButtonGroup 안 (Dialog footer `ButtonGroupContext` `align: 'end'`), 본문과 32
 *     (footer `paddingTop` 32);
 *   - backdrop fade 250 · 닫힐 때 130 (ModalOverlay `transitionDuration`).
 */
import "fake-indexeddb/auto";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { act } from "react";
import { createRoot } from "react-dom/client";
import { describe, expect, it } from "vitest";
import { buildCodeCatalogLibrary } from "../../../../../../packages/shared/src/catalog/document/codeCatalogLibrary";
import { CatalogGraph } from "../../../../../../packages/shared/src/catalog/document/graph";
import type {
  EntryId,
  NodeId,
} from "../../../../../../packages/shared/src/catalog/document/types";
import { renderCatalogDom } from "../domBinding";
import { catalogPaletteInsertCommand } from "../paletteInsert";
import { newCatalogProjectDocument } from "../project";
import { CatalogStorage } from "../storage";
import { CatalogWorkspace } from "../workspace";
import { nodeLayoutEngine } from "./support/nodeLayoutEngine";

const BODY = "project:node:home-body" as NodeId;

class NoopObserver {
  observe() {}
  unobserve() {}
  disconnect() {}
  takeRecords() {
    return [];
  }
}
(globalThis as Record<string, unknown>).IntersectionObserver ??= NoopObserver;

async function open() {
  const library = await buildCodeCatalogLibrary();
  const workspace = new CatalogWorkspace(
    new CatalogGraph(
      newCatalogProjectDocument({
        projectId: "project:project:s2-sheet" as EntryId<"project">,
        name: "S2 sheet",
      }),
      library,
    ),
    new CatalogStorage(indexedDB, `s2-sheet-${Math.random()}`),
    {
      engine: await nodeLayoutEngine(),
      viewport: { width: 1200, height: 900 },
      autosaveSchedule: () => {},
    },
  );
  workspace.execute(
    catalogPaletteInsertCommand(
      {
        graph: workspace.runtime.graph,
        records: workspace.root.domInputs,
        selection: () => [],
        itemOfRecord: (id) => workspace.itemOfRecord(id),
        pageContent: () => ({ kind: "node", id: BODY }),
        newId: workspace.newId,
      },
      "Sheet",
      { isOpen: true },
    )!,
  );
  const root = workspace.root;
  const of = (type: string) =>
    [...root.canvasInputs.values()].find((r) => root.typeOf(r) === type)!;
  // (A record's box in its Sheet's space — the geometry is parent-relative.)
  const box = (id: string) => {
    const own = root.getGeometry([id]).get(id)!;
    let { x, y } = own;
    for (
      let parent = root.canvasInputs.get(root.canvasInputs.get(id)!.parentId!);
      parent && root.typeOf(parent) !== "Sheet";
      parent = root.canvasInputs.get(parent.parentId!)
    ) {
      const at = root.getGeometry([parent.id]).get(parent.id)!;
      x += at.x;
      y += at.y;
    }
    return { ...own, x, y };
  };
  return { root, of, box };
}

const generated = (file: string) =>
  readFileSync(
    resolve(
      __dirname,
      "../../../../../../packages/shared/src/components/styles/generated",
      file,
    ),
    "utf8",
  );

describe("S2 Sheet — Modal M width, Dialog inset 32, close in an end ButtonGroup, backdrop fade", () => {
  it("Canvas: 480 wide, its title 32 in, the close button in a ButtonGroup at the end corner 32 in, 32 below the body", async () => {
    const { root, of, box } = await open();
    const sheet = { ...box(of("Sheet").id), x: 0, y: 0 };
    expect(sheet.width).toBe(480);
    const title = box(of("Heading").id);
    expect([title.x - sheet.x, title.y - sheet.y]).toEqual([32, 32]);
    const close = [...root.canvasInputs.values()].find(
      (r) => root.typeOf(r) === "Button" && r.props.slot === "close",
    )!;
    expect(root.typeOf(root.canvasInputs.get(close.parentId!)!)).toBe(
      "ButtonGroup",
    );
    const button = box(close.id);
    expect(sheet.x + sheet.width - (button.x + button.width)).toBe(32);
    expect(sheet.y + sheet.height - (button.y + button.height)).toBe(32);
    const body = box(
      [...root.canvasInputs.values()].find(
        (r) => root.typeOf(r) === "frame" && r.parentId === of("SheetContent").id,
      )!.id,
    );
    const group = box(close.parentId!);
    expect(group.y - (body.y + body.height)).toBe(32);
  });

  it("sheets: Sheet 480 · content 32 · the backdrop fades in 250, the overlay out 130", () => {
    expect(generated("Sheet.css")).toMatch(/width:\s*480px/);
    expect(generated("SheetContent.css")).toMatch(/padding:\s*32px\s+32px/);
    const backdrop = generated("SheetBackdrop.css");
    expect(backdrop).toMatch(/transition:\s*opacity 250ms/);
    expect(backdrop).toMatch(/\[data-entering\][^{]*\{[^}]*opacity:\s*0/);
    // (RAC waits for the overlay's own exit animation only — `useExitAnimation` — so the 130 fade is
    //  the overlay's: backdrop and sheet together, as S2's ModalOverlay and Modal.)
    const overlay = generated("SheetOverlay.css");
    expect(overlay).toMatch(/transition:\s*opacity 130ms/);
    expect(overlay).toMatch(/\[data-exiting\][^{]*\{[^}]*opacity:\s*0/);
  });

  it("DOM: the close button sits in the end-aligned ButtonGroup inside the RAC SheetContent", async () => {
    const { root, of } = await open();
    (
      globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }
    ).IS_REACT_ACT_ENVIRONMENT = true;
    const host = document.body.appendChild(document.createElement("div"));
    const reactRoot = createRoot(host);
    await act(async () =>
      reactRoot.render(renderCatalogDom(root, of("SheetTrigger").id)),
    );
    const close = [...document.querySelectorAll("button")].find(
      (button) => button.textContent?.trim() === "Close",
    )!;
    // (S2 ButtonGroup — a `role="group"` div, `delegatedDom` `buttongroup`.)
    expect(close.parentElement!.getAttribute("role")).toBe("group");
    expect(close.parentElement!.style.justifyContent).toBe("flex-end");
    expect(close.closest(".react-aria-SheetContent")).not.toBeNull();
    await act(async () => reactRoot.unmount());
    host.remove();
    document.body.innerHTML = "";
  });
});
