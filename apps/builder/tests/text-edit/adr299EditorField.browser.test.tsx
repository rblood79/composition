/**
 * ADR-299 G4 — the inline editor (ProseMirror, `EditorField`) in Chrome and WebKit: keys and presses
 * the user makes (Playwright input through `userEvent`), not synthetic calls.
 *
 * - ⌘B · ⌘I · ⌘U over a selection write range marks; over part of a `{{ }}` token the whole token.
 * - The edit scope (리뷰 h3): a press in the Typography section (`[data-section-id="typography"]`)
 *   or its popover keeps the edit and its selection (drawn while the focus is away); a press or a
 *   focus move outside commits. The panel writes through the handle (selected range only).
 * - ⌘Z inside the edit undoes the editor's own step.
 */
import { createElement, type CSSProperties } from "react";
import { createRoot, type Root } from "react-dom/client";
import { flushSync } from "react-dom";
import { afterEach, describe, expect, it } from "vitest";
import { page, server, userEvent } from "vitest/browser";
import EditorField from "@/builder/workspace/canvas/catalog/textEditor/EditorField";
import { getTextEditorHandle } from "@/builder/catalogRuntime/textEditorHandle";
import { applyTextRunMarks } from "../../../../packages/shared/src/catalog/document/textRuns";
import type { RichText } from "../../../../packages/shared/src/catalog/document/types";

const MOD = /Mac|iPhone|iPad/.test(navigator.platform) ? "Meta" : "Control";
const browser = server.browser;

interface Mounted {
  field: () => HTMLElement;
  editable: () => HTMLElement;
  values: (string | RichText)[];
  commits: number;
  panel: HTMLElement;
  panelInput: HTMLInputElement;
  outside: HTMLButtonElement;
  root: Root;
  host: HTMLElement;
}

let current: Mounted | undefined;
afterEach(() => {
  current?.root.unmount();
  current?.host.remove();
  current?.panel.remove();
  current?.outside.remove();
  current = undefined;
});

const settle = () =>
  new Promise<void>((done) =>
    requestAnimationFrame(() => requestAnimationFrame(() => done())),
  );

async function mount(
  initial: string | RichText,
  rich = true,
  selection?: { from: number; to: number },
): Promise<Mounted> {
  const host = document.createElement("div");
  document.body.append(host);
  // The Design panel's Typography section (the scope) with an input, and a control outside it.
  const panel = document.createElement("section");
  panel.setAttribute("data-section-id", "typography");
  const panelInput = document.createElement("input");
  panelInput.setAttribute("aria-label", "Font Size");
  panel.append(panelInput);
  const outside = document.createElement("button");
  outside.textContent = "Outside";
  document.body.append(panel, outside);
  const mounted = {
    values: [] as (string | RichText)[],
    commits: 0,
    panel,
    panelInput,
    outside,
    host,
  } as unknown as Mounted;
  const style: CSSProperties = {
    position: "absolute",
    left: 40,
    top: 40,
    width: 400,
    minHeight: 24,
    font: "16px/1.5 sans-serif",
    whiteSpace: "pre-wrap",
  };
  mounted.root = createRoot(host);
  flushSync(() =>
    mounted.root.render(
      createElement(EditorField, {
        identity: "text-1",
        initial,
        rich,
        selection,
        nodeValues: {
          fontWeight: 400,
          fontStyle: "normal",
          textDecoration: "none",
          color: "#1a1a1aff",
          fontSize: 16,
        },
        markCss: (_key, value) =>
          _key === "fontSize" && typeof value === "number"
            ? `${value}px`
            : String(value),
        className: "catalog-text-editor",
        style,
        onChange: (value) => mounted.values.push(value),
        onCommit: () => {
          mounted.commits++;
        },
        onMount: () => undefined,
      }),
    ),
  );
  mounted.field = () =>
    host.querySelector<HTMLElement>("[data-testid=catalog-text-editor]")!;
  mounted.editable = () =>
    host.querySelector<HTMLElement>(".catalog-text-editor-input")!;
  await settle();
  current = mounted;
  return mounted;
}

const last = (m: Mounted) => m.values.at(-1);

/**
 * Select `[from, to)` of the editable's text (a DOM selection — PM reads it as the user's; the
 * caret keys differ per platform, Home does not move a Mac caret).
 */
async function selectRange(m: Mounted, from: number, to: number) {
  const editable = m.editable();
  editable.focus();
  const point = (offset: number): [Node, number] => {
    const walker = document.createTreeWalker(
      editable,
      NodeFilter.SHOW_TEXT | NodeFilter.SHOW_ELEMENT,
    );
    let left = offset;
    let node = walker.nextNode();
    let lastNode: Node | null = null;
    while (node) {
      if (node.nodeType === Node.ELEMENT_NODE) {
        if (node.nodeName === "BR") {
          if (left === 0) {
            const parent = node.parentNode!;
            return [parent, Array.from(parent.childNodes).indexOf(node as ChildNode)];
          }
          left--;
        }
        node = walker.nextNode();
        continue;
      }
      const length = node.textContent!.length;
      if (left <= length) return [node, left];
      left -= length;
      lastNode = node;
      node = walker.nextNode();
    }
    return lastNode
      ? [lastNode, lastNode.textContent!.length]
      : [editable, 0];
  };
  const range = document.createRange();
  range.setStart(...point(from));
  range.setEnd(...point(to));
  const selection = document.getSelection()!;
  selection.removeAllRanges();
  selection.addRange(range);
  await settle();
}

describe(`ADR-299 G4 — EditorField (${browser})`, () => {
  it("opens with the text selected and focused; typing replaces it", async () => {
    const m = await mount("Hello");
    expect(document.activeElement).toBe(m.editable());
    await userEvent.keyboard("Hi");
    await settle();
    expect(last(m)).toBe("Hi");
  });

  it("keys typed before the editor arrived stay: it opens with the textarea's caret", async () => {
    // (The fallback textarea took "H" while the chunk loaded — the editor must not select it.)
    const m = await mount("H", true, { from: 1, to: 1 });
    await userEvent.keyboard("ello");
    await settle();
    expect(last(m)).toBe("Hello");
  });

  it("⌘B · ⌘I · ⌘U write range marks over the selection", async () => {
    const m = await mount("Hello world");
    await selectRange(m, 6, 11);
    await userEvent.keyboard(`{${MOD}>}b{/${MOD}}`);
    await userEvent.keyboard(`{${MOD}>}i{/${MOD}}`);
    await userEvent.keyboard(`{${MOD}>}u{/${MOD}}`);
    await settle();
    expect(last(m)).toEqual({
      kind: "text",
      runs: [
        { text: "Hello " },
        {
          text: "world",
          marks: {
            fontWeight: 700,
            fontStyle: "italic",
            textDecoration: "underline",
          },
        },
      ],
    });
    // ⌘B again over the bold range takes it off (back to the string when nothing is marked).
    await userEvent.keyboard(`{${MOD}>}b{/${MOD}}`);
    await userEvent.keyboard(`{${MOD}>}i{/${MOD}}`);
    await userEvent.keyboard(`{${MOD}>}u{/${MOD}}`);
    await settle();
    expect(last(m)).toBe("Hello world");
  });

  it("a mark over part of a `{{ }}` token covers the whole token (리뷰 h1)", async () => {
    const m = await mount("Hello {{ userName }}!");
    await selectRange(m, 9, 13); // "user"
    await userEvent.keyboard(`{${MOD}>}b{/${MOD}}`);
    await settle();
    expect(last(m)).toEqual({
      kind: "text",
      runs: [
        { text: "Hello " },
        { text: "{{ userName }}", marks: { fontWeight: 700 } },
        { text: "!" },
      ],
    });
  });

  it("Enter is a line break; ⌘Z undoes the editor's step", async () => {
    const m = await mount("ab");
    await selectRange(m, 1, 1);
    await userEvent.keyboard("{Enter}");
    await settle();
    expect(last(m)).toBe("a\nb");
    await userEvent.keyboard(`{${MOD}>}z{/${MOD}}`);
    await settle();
    expect(last(m)).toBe("ab");
    expect(m.commits).toBe(0);
  });

  it("a press in the Typography section keeps the edit and its selection; the panel writes the range", async () => {
    const m = await mount(
      applyTextRunMarks("Hello world", 0, 5, { fontWeight: 700 }),
    );
    await selectRange(m, 0, 11);
    expect(getTextEditorHandle()?.marks()).toEqual({ fontWeight: "mixed" });
    await userEvent.click(page.elementLocator(m.panelInput));
    await settle();
    expect(m.commits).toBe(0);
    expect(document.activeElement).toBe(m.panelInput);
    // The selection is drawn while the focus is in the panel.
    expect(m.field().querySelector(".text-edit-held-selection")).not.toBeNull();
    // The panel's write (Font Size 24 on the selected range) — the range only.
    await selectRange(m, 6, 11);
    await userEvent.click(page.elementLocator(m.panelInput));
    getTextEditorHandle()!.apply("fontSize", 24);
    await settle();
    expect(last(m)).toEqual({
      kind: "text",
      runs: [
        { text: "Hello", marks: { fontWeight: 700 } },
        { text: " " },
        { text: "world", marks: { fontSize: 24 } },
      ],
    });
    expect(m.commits).toBe(0);
  });

  it("a range set back to the node's own value carries no mark (the text is plain again)", async () => {
    const m = await mount(
      applyTextRunMarks("Hello world", 6, 11, { color: "#ff0000", fontSize: 24 }),
    );
    await selectRange(m, 6, 11);
    getTextEditorHandle()!.apply("color", "#1A1A1A");
    getTextEditorHandle()!.apply("fontSize", 16);
    await settle();
    expect(last(m)).toBe("Hello world");
  });

  it("a press outside the scope commits once", async () => {
    const m = await mount("Hello");
    await userEvent.click(page.elementLocator(m.outside));
    await settle();
    expect(m.commits).toBe(1);
  });

  it("the focus leaving to outside the scope commits (keyboard)", async () => {
    const m = await mount("Hello");
    m.outside.focus();
    await settle();
    expect(m.commits).toBe(1);
  });

  it.each(["typography", "portal"])("Tab leaving %s commits once", async (scope) => {
    const m = await mount("Hello");
    if (scope === "portal") {
      m.panel.removeAttribute("data-section-id");
      m.panel.setAttribute("data-text-edit-scope", "");
    }
    const outside = document.createElement("input");
    m.panel.after(outside);
    try {
      await userEvent.click(page.elementLocator(m.panelInput));
      expect(m.commits).toBe(0);
      await userEvent.keyboard("{Tab}");
      await settle();
      expect(document.activeElement).toBe(outside);
      expect(m.commits).toBe(1);
      await userEvent.click(page.elementLocator(m.outside));
      expect(m.commits).toBe(1);
    } finally {
      outside.remove();
    }
  });

  it("Enter lines with different sizes grow independently without overlapping", async () => {
    const m = await mount("text");
    await userEvent.keyboard("first{Enter}BIG{Enter}small");
    await selectRange(m, 6, 9);
    getTextEditorHandle()!.apply("fontSize", 64);
    await selectRange(m, 10, 15);
    getTextEditorHandle()!.apply("fontSize", 24);
    await settle();
    const spans = m.editable().querySelectorAll<HTMLElement>("[data-run-mark=fontSize]");
    expect(spans.length).toBe(2);
    const big = spans[0]!.getBoundingClientRect();
    const small = spans[1]!.getBoundingClientRect();
    expect(small.top).toBeGreaterThanOrEqual(big.bottom);
    expect(parseFloat(getComputedStyle(spans[0]!).lineHeight)).toBe(96);
    expect(parseFloat(getComputedStyle(spans[1]!).lineHeight)).toBe(36);
    expect(m.commits).toBe(0);
  });

  it("a plain field (a bound text) takes no marks", async () => {
    const m = await mount("Hello", false);
    await selectRange(m, 0, 5);
    await userEvent.keyboard(`{${MOD}>}b{/${MOD}}`);
    await settle();
    expect(m.values.every((value) => typeof value === "string")).toBe(true);
  });
});
