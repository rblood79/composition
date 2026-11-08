import { render } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  addRecord,
  setFields,
} from "../../../../../../packages/shared/src/catalog/commands";
import type { NodeId } from "../../../../../../packages/shared/src/catalog/document/types";
import { codeViewAddressOf } from "../../../../../../packages/shared/src/codeView/files/overrides";
import { codeViewFileTree } from "../../../../../../packages/shared/src/codeView/files/tree";
import {
  catalogCodeViewFileBaseline,
  catalogCodeViewProjectSession,
} from "../../../builder/catalogRuntime/codeViewApply";
import CodeEditor, {
  type CodeEditorProps,
} from "../../../builder/panels/codeView/CodeEditor";
import { openAdr296, type Adr296Harness } from "./support/adr296Harness";

/**
 * ADR-301 Phase 3 (G3 · Decision 6) — a closed overlay's body is folded in the editor (a view
 * state: the code, the document and History do not change). Closed = Canvas's judgement
 * (`catalogOverlayOpen` — the body's own Open, else its trigger's); a variable's Open is closed
 * (사용자 결정 6).
 */
afterEach(() => vi.restoreAllMocks());

const HOME = "src/pages/Home.tsx";
function baseline(h: Adr296Harness) {
  const s = catalogCodeViewProjectSession(h.graph());
  for (const file of codeViewFileTree(h.graph()))
    catalogCodeViewFileBaseline(s, h.graph(), file.path);
  return s.baselines.get(HOME)!.result;
}
async function open() {
  vi.spyOn(console, "warn").mockImplementation(() => {});
  return openAdr296();
}

describe("ADR-301 G3 — the bodies' folds", () => {
  it.each([
    ["Popover", "<Popover"],
    ["Dialog", "<Modal"],
    ["Tooltip", "<Tooltip"],
    ["Menu", "<Popover"],
    ["Sheet", "<SheetOverlay"],
    ["PreviewTrigger", "<Popover"],
  ])(
    "%s — its closed body is one fold (the inside of %s)",
    async (type, tag) => {
      const h = await open();
      h.add(type);
      const result = baseline(h);
      expect(result.folds).toHaveLength(1);
      const [fold] = result.folds!;
      expect(fold!.closed).toBe(true);
      // (The opening tag's line stays, its inside is folded, the closing line stays.)
      const line = result.code.slice(
        result.code.lastIndexOf("\n", fold!.from - 1) + 1,
        fold!.from,
      );
      expect(line.trim().startsWith(tag)).toBe(true);
      expect(
        result.code
          .slice(fold!.to)
          .trim()
          .startsWith(`</${tag.slice(1)}`),
      ).toBe(true);
    },
  );

  it("Open on the trigger (Properties `isOpen`) → open; off → closed — the code changes only by the prop", async () => {
    const h = await open();
    const popover = h.add("Popover");
    h.declare(popover as NodeId, { isOpen: true });
    expect(baseline(h).folds![0]!.closed).toBe(false);
    h.declare(popover as NodeId, { isOpen: false });
    expect(baseline(h).folds![0]!.closed).toBe(true);
    // (`defaultOpen` alone — `isOpen` controlled false would win, as in RAC.)
    const second = await open();
    second.declare(second.add("Popover") as NodeId, { defaultOpen: true });
    expect(baseline(second).folds![0]!.closed).toBe(false);
  });

  it("the body's own Open (a patch on the overlay) wins over its trigger's — as on Canvas", async () => {
    const h = await open();
    const popover = h.add("Popover");
    h.run(
      setFields({
        targets: [
          {
            kind: "descendant",
            ownerId: popover as NodeId,
            address: codeViewAddressOf(
              h.graph() as never,
              popover,
              "popover",
              undefined,
              true,
            )!,
          },
        ],
        props: { isOpen: { kind: "set", value: true } },
        label: "Open",
      }),
    );
    expect(baseline(h).folds![0]!.closed).toBe(false);
  });

  it("a variable's Open (`isOpen={open}`) is closed (사용자 결정 6)", async () => {
    const h = await open();
    const popover = h.add("Popover");
    h.run(
      addRecord({
        entry: {
          kind: "stateVariable",
          id: "project:stateVariable:open",
          ownerId: "project:page:home",
          name: "open",
          valueType: "boolean",
          defaultValue: true,
          source: { nodeId: popover, prop: "isOpen" },
        } as never,
      }),
    );
    const result = baseline(h);
    expect(result.code).toContain("isOpen={open}");
    expect(result.folds?.[0]?.closed).toBe(true);
  });

  it("not an overlay (Tabs · Table) — no fold", async () => {
    const h = await open();
    h.add("Tabs");
    h.add("Table");
    expect(baseline(h).folds).toBeUndefined();
  });
});

describe("ADR-301 G3 — the editor folds them (a view state)", () => {
  const vocabulary = { tags: [], variables: [], collections: [], fields: [] };
  const CODE = "<A>\n  <B>\n    <C />\n  </B>\n</A>\n";
  const fold = { key: "k", from: 9, to: 21 };
  const props = (closed: boolean, code = CODE): CodeEditorProps => ({
    code,
    label: "code",
    vocabulary,
    onChange: vi.fn(),
    folds: [{ ...fold, closed }],
  });
  const folded = async (container: HTMLElement) => {
    const { EditorView } = await import("@codemirror/view");
    const { foldedRanges } = await import("@codemirror/language");
    const view = EditorView.findFromDOM(
      container.querySelector(".cm-content") as HTMLElement,
    )!;
    const out: [number, number][] = [];
    foldedRanges(view.state).between(0, view.state.doc.length, (from, to) => {
      out.push([from, to]);
    });
    return { out, view, text: view.state.doc.toString() };
  };

  it("closed → folded; Open on → unfolded; the text stays", async () => {
    const view = render(<CodeEditor {...props(true)} />);
    expect((await folded(view.container)).out).toEqual([[9, 21]]);
    view.rerender(<CodeEditor {...props(false)} />);
    const after = await folded(view.container);
    expect(after.out).toEqual([]);
    expect(after.text).toBe(CODE);
  });

  it("a fold the user opened stays open while its Open does not change (a new baseline)", async () => {
    const view = render(<CodeEditor {...props(true)} />);
    const { unfoldEffect } = await import("@codemirror/language");
    const first = await folded(view.container);
    first.view.dispatch({ effects: unfoldEffect.of({ from: 9, to: 21 }) });
    // (The document changed elsewhere — the same body still closed.)
    view.rerender(<CodeEditor {...props(true, `${CODE}<D />\n`)} />);
    expect((await folded(view.container)).out).toEqual([]);
  });
});
