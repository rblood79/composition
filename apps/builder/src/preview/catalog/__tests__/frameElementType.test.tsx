import { expect, it } from "vitest";
import type {
  EntryId,
  NodeId,
} from "../../../../../../packages/shared/src/catalog/document/types";
import { catalogCodeView } from "../../../builder/catalogRuntime/codeView";
import {
  catalogDefinitionList,
  catalogNewLayoutCommand,
} from "../../../builder/catalogRuntime/layouts";
import { catalogPageCommands } from "../../../builder/catalogRuntime/pageSettings";
import { openAdr280Preview } from "./support/adr280Harness";

/**
 * A frame's `elementType` is the element the Preview · Publish DOM writes (사용자 결정 2026-11-24): the
 * box is the frame's either way — only the tag changes, and a value outside the list is a `div`.
 */
it("a frame is drawn as the HTML element its elementType names", async () => {
  const h = await openAdr280Preview(["frame"]);
  try {
    const id = h.ids[0] as NodeId;
    const tag = () => h.element(id)?.tagName;
    expect(tag()).toBe("DIV");
    for (const value of [
      "main",
      "section",
      "header",
      "footer",
      "nav",
      "article",
      "aside",
    ]) {
      h.declare(id, { elementType: value });
      expect(tag()).toBe(value.toUpperCase());
      // (No role of its own — the element is the meaning, ADR-130.)
      expect(h.element(id)?.hasAttribute("role")).toBe(false);
      expect(h.element(id)?.hasAttribute("elementtype")).toBe(false);
    }
    h.declare(id, { elementType: "script" });
    expect(tag()).toBe("DIV");
    h.declare(id, { elementType: "div" });
    expect(tag()).toBe("DIV");
  } finally {
    h.view.unmount();
    h.workspace.dispose();
  }
});

it("the code view writes a frame as its element — no elementType attribute, no import", async () => {
  const h = await openAdr280Preview(["frame"]);
  try {
    const id = h.ids[0] as NodeId;
    const page = h.workspace.session.getSnapshot().pageId as EntryId<"page">;
    const code = () =>
      catalogCodeView(h.workspace.runtime.graph, page, {
        collections: [],
        endpoints: [],
      })!.code;
    expect(code()).toMatch(/<div[\s/>]/);
    h.declare(id, { elementType: "nav" });
    const written = code();
    expect(written).toMatch(/<nav[\s/>]/);
    expect(written).not.toContain("elementType");
    expect(written).not.toMatch(/import \{[^}]*\bnav\b[^}]*\} from 'react-aria-components'/);
  } finally {
    h.view.unmount();
    h.workspace.dispose();
  }
});

/**
 * The page's main content (사용자 결정 2026-11-24 「페이지 본문 = main」): a page without a layout
 * draws its body as `<main>`; a frame the author made the `main` takes that role (the body is a
 * `div` then — never a `main` inside a `main`); a page with a layout keeps a `div` body (its content
 * slot is the layout's — ADR-304).
 */
it("the page body is <main> — it gives way to a frame set as main, and to a layout", async () => {
  const h = await openAdr280Preview(["frame"]);
  try {
    const id = h.ids[0] as NodeId;
    const body = () =>
      h.view.container.querySelector<HTMLElement>(".react-aria-Body");
    const mains = () => h.view.container.querySelectorAll("main").length;
    expect(body()?.tagName).toBe("MAIN");
    expect(mains()).toBe(1);
    // (An explicit main: the frame is the page's main, the body steps back.)
    h.declare(id, { elementType: "main" });
    expect(h.element(id)?.tagName).toBe("MAIN");
    expect(body()?.tagName).toBe("DIV");
    expect(mains()).toBe(1);
    h.declare(id, { elementType: "section" });
    expect(h.element(id)?.tagName).toBe("SECTION");
    expect(body()?.tagName).toBe("MAIN");
    expect(mains()).toBe(1);
    // (A layout: the body is the layout's instance — no main of its own.)
    const page = h.workspace.session.getSnapshot().pageId as EntryId<"page">;
    h.workspace.execute(catalogNewLayoutCommand("Shell", h.workspace.newId));
    const [layout] = catalogDefinitionList(h.workspace.runtime.graph, "layout");
    h.workspace.execute(
      catalogPageCommands.layout(page, layout!.id, h.workspace.newId),
    );
    h.flush();
    expect(body()?.tagName).toBe("DIV");
    expect(mains()).toBe(0);
  } finally {
    h.view.unmount();
    h.workspace.dispose();
  }
});
