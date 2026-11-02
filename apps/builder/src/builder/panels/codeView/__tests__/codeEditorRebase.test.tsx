import { act, render } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import CodeEditor, { type CodeEditorProps } from "../CodeEditor";

/**
 * ADR-285 — the panel shows the editor directly: while nothing is typed a new baseline (the
 * document changed) is written in place — not an edit (no `onChange`) — and an edit after it is
 * counted from the new baseline.
 */
const vocabulary = { tags: [], variables: [], collections: [], fields: [] };

function setup(code: string) {
  const onChange = vi.fn<CodeEditorProps["onChange"]>();
  const props = (next: string): CodeEditorProps => ({
    code: next,
    label: "code",
    vocabulary,
    onChange,
  });
  const view = render(<CodeEditor {...props(code)} />);
  const content = () =>
    view.container.querySelector(".cm-content") as HTMLElement;
  const text = () =>
    [...view.container.querySelectorAll(".cm-line")]
      .map((line) => line.textContent)
      .join("\n");
  return { view, props, onChange, content, text };
}

describe("CodeEditor — a new baseline while nothing is typed", () => {
  it("writes the new code in without an edit", () => {
    const editor = setup("<Text>A</Text>\n");
    editor.view.rerender(
      <CodeEditor {...editor.props("<Text>A</Text>\n<Button />\n")} />,
    );
    expect(editor.text()).toBe("<Text>A</Text>\n<Button />\n");
    expect(editor.onChange).not.toHaveBeenCalled();
  });

  it("counts the next edit from the new baseline", async () => {
    const editor = setup("a\n");
    editor.view.rerender(<CodeEditor {...editor.props("a\nb\n")} />);
    const { EditorView } = await import("@codemirror/view");
    const cm = EditorView.findFromDOM(editor.content())!;
    act(() => {
      cm.dispatch({ changes: { from: 4, insert: "c\n" } });
    });
    const [text, changes] = editor.onChange.mock.calls.at(-1)!;
    expect(text).toBe("a\nb\nc\n");
    // (One insertion at the end of the new baseline — not the rebase's line as well.)
    expect(changes).toEqual([{ fromA: 4, toA: 4, insert: "c\n" }]);
  });

  it("keeps ⌘Z in the editor while it has typed steps, the document's when it has none", async () => {
    const editor = setup("a\n");
    const host = editor.view.container.querySelector(
      ".code-view-editor",
    ) as HTMLElement;
    expect(host.hasAttribute("data-shortcut-local")).toBe(false);
    const { EditorView } = await import("@codemirror/view");
    const { undo } = await import("@codemirror/commands");
    const cm = EditorView.findFromDOM(editor.content())!;
    act(() => {
      cm.dispatch({
        changes: { from: 2, insert: "b\n" },
        userEvent: "input.type",
      });
    });
    expect(host.getAttribute("data-shortcut-local")).toBe("undo");
    act(() => {
      undo(cm);
    });
    // (Nothing left to undo here — ⌘Z goes to the document; ⌘⇧Z still re-types.)
    expect(host.getAttribute("data-shortcut-local")).toBe("redo");
    // A new baseline: the typed steps are gone with the old one.
    editor.view.rerender(<CodeEditor {...editor.props("a\nz\n")} />);
    expect(host.hasAttribute("data-shortcut-local")).toBe(false);
  });
});

describe("CodeEditor — committed configuration changes", () => {
  it("keeps the editor and undo history while label and readOnly change", async () => {
    const editor = setup("a");
    const { EditorView } = await import("@codemirror/view");
    const { undo } = await import("@codemirror/commands");
    const cm = EditorView.findFromDOM(editor.content())!;
    act(() => cm.dispatch({ changes: { from: 1, insert: "b" } }));
    editor.view.rerender(
      <CodeEditor {...editor.props("a")} label="코드" readOnly />,
    );
    expect(EditorView.findFromDOM(editor.content())).toBe(cm);
    expect(editor.text()).toBe("ab");
    expect(editor.content().getAttribute("aria-label")).toBe("코드");
    expect(editor.content().getAttribute("contenteditable")).toBe("false");
    editor.view.rerender(<CodeEditor {...editor.props("a")} />);
    act(() => {
      undo(cm);
    });
    expect(editor.text()).toBe("a");
  });

  it("uses the new row fields for completion without remounting", async () => {
    const { waitFor } = await import("@testing-library/react");
    const { EditorView } = await import("@codemirror/view");
    const { startCompletion, closeCompletion, currentCompletions } =
      await import("@codemirror/autocomplete");
    const rects = Object.getOwnPropertyDescriptor(
      Range.prototype,
      "getClientRects",
    );
    const bounds = Object.getOwnPropertyDescriptor(
      Range.prototype,
      "getBoundingClientRect",
    );
    Object.defineProperty(Range.prototype, "getClientRects", {
      configurable: true,
      value: () => [],
    });
    Object.defineProperty(Range.prototype, "getBoundingClientRect", {
      configurable: true,
      value: () => new DOMRect(),
    });
    const editor = setup("item.");
    const cm = EditorView.findFromDOM(editor.content())!;
    act(() => {
      cm.dispatch({ selection: { anchor: 5 } });
      startCompletion(cm);
    });
    await waitFor(() => expect(currentCompletions(cm.state)).toEqual([]));
    editor.view.rerender(
      <CodeEditor
        {...editor.props("item.")}
        vocabulary={{ ...vocabulary, fields: ["renamed"] }}
      />,
    );
    act(() => {
      closeCompletion(cm);
      startCompletion(cm);
    });
    await waitFor(() =>
      expect(currentCompletions(cm.state).map((item) => item.label)).toContain(
        "renamed",
      ),
    );
    expect(EditorView.findFromDOM(editor.content())).toBe(cm);
    editor.view.unmount();
    if (rects) Object.defineProperty(Range.prototype, "getClientRects", rects);
    else Reflect.deleteProperty(Range.prototype, "getClientRects");
    if (bounds)
      Object.defineProperty(Range.prototype, "getBoundingClientRect", bounds);
    else Reflect.deleteProperty(Range.prototype, "getBoundingClientRect");
  });
});
