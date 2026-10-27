import { describe, expect, it } from "vitest";
import {
  codeViewAnchorOutcomes,
  codeViewMapPos,
  codeViewMatchElements,
  type CodeViewChange,
  type CodeViewIdentityUnit,
} from "../inverse/identity";
import { parseCodeView, type CodeViewElement } from "../inverse/parse";

/**
 * ADR-285 Decision 3 (h1) — identity from the editor's edit operations, the review's probes
 * (round 2 · 3 · 4): a letter typed inside keeps the id, the second of two same lines deleted
 * removes the second, a paste over anchors pairs by equal text first (B · A pasted over A · B is a
 * move), a different-state candidate set is refused, never picked.
 */
const wrap = (lines: string) =>
  `export default function Home() {\n  return (\n    <>\n${lines}    </>\n  );\n}\n`;

/** Units of the baseline's elements: ids `a`, `b` … in order, states given per id. */
function baseline(lines: string, states: Record<string, string> = {}) {
  const code = wrap(lines);
  const parsed = parseCodeView(code);
  const units: Omit<CodeViewIdentityUnit, "outcome">[] = [];
  const spans: { from: number; to: number }[] = [];
  let next = 0;
  const visit = (element: CodeViewElement, parentId?: string) => {
    const id = String.fromCharCode(97 + next++);
    units.push({
      id,
      ...(parentId ? { parentId } : {}),
      type: element.type,
      code: code.slice(element.from, element.to),
      state: states[id] ?? "",
    });
    spans.push({ from: element.from, to: element.to });
    element.children.forEach((child) => visit(child, id));
  };
  parsed.jsx!.roots.forEach((root) => visit(root));
  return { code, units, spans };
}

/** Apply composed changes and match. */
function edit(
  base: ReturnType<typeof baseline>,
  changes: readonly CodeViewChange[],
) {
  let code = base.code;
  for (const change of [...changes].reverse())
    code = code.slice(0, change.fromA) + change.insert + code.slice(change.toA);
  const outcomes = codeViewAnchorOutcomes(base.spans, changes);
  const units = base.units.map((unit, index) => ({
    ...unit,
    outcome: outcomes[index]!,
  }));
  const parsed = parseCodeView(code);
  const identity = codeViewMatchElements(units, parsed.jsx!.roots, code);
  const flat: CodeViewElement[] = [];
  const visit = (element: CodeViewElement) => {
    flat.push(element);
    element.children.forEach(visit);
  };
  parsed.jsx!.roots.forEach(visit);
  return {
    ...identity,
    /** [unit id or "+", the element's text] in order. */
    result: flat.map((element) => [
      identity.matched.get(element) ?? "+",
      code.slice(element.from, element.to),
    ]),
  };
}
const at = (code: string, find: string, offset = 0) => {
  const index = code.indexOf(find);
  if (index < 0) throw new Error(find);
  return index + offset;
};
const line = (text: string) => `      ${text}\n`;

describe("codeViewMapPos", () => {
  it("shifts by changes before, keeps an insert at a start outside the span", () => {
    const changes = [{ fromA: 2, toA: 4, insert: "xyz" }];
    expect(codeViewMapPos(changes, 1, 1)).toBe(1);
    expect(codeViewMapPos(changes, 2, 1)).toBe(2);
    expect(codeViewMapPos(changes, 4, -1)).toBe(5);
    expect(codeViewMapPos(changes, 3, 1)).toBe(5);
    expect(codeViewMapPos(changes, 3, -1)).toBe(2);
    expect(codeViewMapPos([{ fromA: 5, toA: 5, insert: "ab" }], 5, 1)).toBe(7);
    expect(codeViewMapPos([{ fromA: 5, toA: 5, insert: "ab" }], 5, -1)).toBe(5);
  });
});

describe("codeViewMatchElements — the review's probes", () => {
  it("a tag typed over inside a kept span is another element (removed + added — live 2026-10-27)", () => {
    const base = baseline(line("<Text>Text</Text>"));
    // (CodeMirror's minimal change: `<` and `>` stay, the middle is replaced.)
    const from = at(base.code, "<Text>Text</Text>", 1);
    const to = at(base.code, "<Text>Text</Text>", "<Text>Text</Text".length);
    const out = edit(base, [
      { fromA: from, toA: to, insert: "ListBox items={users}></ListBox" },
    ]);
    expect(out.removed).toEqual(["a"]);
    expect(out.result).toEqual([["+", "<ListBox items={users}></ListBox>"]]);
  });

  it("a letter typed inside one line keeps the id (round 2)", () => {
    const base = baseline(line("<Text>A</Text>"), { a: "red" });
    const from = at(base.code, "<Text>A", 6);
    const out = edit(base, [{ fromA: from, toA: from + 1, insert: "B" }]);
    expect(out.result).toEqual([["a", "<Text>B</Text>"]]);
    expect(out.removed).toEqual([]);
  });

  it("the second of two same lines deleted removes the second (round 2 — no tie-break)", () => {
    const base = baseline(
      line("<Text>Text</Text>") + line("<Text>Text</Text>"),
      {
        a: "red",
        b: "blue",
      },
    );
    const second =
      at(base.code, line("<Text>Text</Text>")) +
      line("<Text>Text</Text>").length;
    const out = edit(base, [
      {
        fromA: second,
        toA: second + line("<Text>Text</Text>").length,
        insert: "",
      },
    ]);
    expect(out.result).toEqual([["a", "<Text>Text</Text>"]]);
    expect(out.removed).toEqual(["b"]);
  });

  it("two same lines with different states pasted over as one are ambiguous", () => {
    const two = line("<Text>Text</Text>") + line("<Text>Text</Text>");
    const base = baseline(two, { a: "red", b: "blue" });
    const from = at(base.code, two);
    const out = edit(base, [
      {
        fromA: from,
        toA: from + two.length,
        insert: line("<Text>Text</Text>"),
      },
    ]);
    expect(out.ambiguous).toHaveLength(1);
  });

  it("…with the same state they pair in order (the second removed)", () => {
    const two = line("<Text>Text</Text>") + line("<Text>Text</Text>");
    const base = baseline(two, { a: "x", b: "x" });
    const from = at(base.code, two);
    const out = edit(base, [
      {
        fromA: from,
        toA: from + two.length,
        insert: line("<Text>Text</Text>"),
      },
    ]);
    expect(out.ambiguous).toEqual([]);
    expect(out.result).toEqual([["a", "<Text>Text</Text>"]]);
    expect(out.removed).toEqual(["b"]);
  });

  it("A · B pasted over as B · A is a move — blue B, red A (round 3)", () => {
    const ab = line("<Text>A</Text>") + line("<Text>B</Text>");
    const base = baseline(ab, { a: "red", b: "blue" });
    const from = at(base.code, ab);
    const out = edit(base, [
      {
        fromA: from,
        toA: from + ab.length,
        insert: line("<Text>B</Text>") + line("<Text>A</Text>"),
      },
    ]);
    expect(out.result).toEqual([
      ["b", "<Text>B</Text>"],
      ["a", "<Text>A</Text>"],
    ]);
    expect(out.removed).toEqual([]);
  });

  it("a reorder with one letter changed: the equal one moves, the other is an edit (round 4)", () => {
    const ab = line("<Text>A</Text>") + line("<Text>B</Text>");
    const base = baseline(ab, { a: "red", b: "blue" });
    const from = at(base.code, ab);
    const out = edit(base, [
      {
        fromA: from,
        toA: from + ab.length,
        insert: line("<Text>B</Text>") + line("<Text>C</Text>"),
      },
    ]);
    expect(out.result).toEqual([
      ["b", "<Text>B</Text>"],
      ["a", "<Text>C</Text>"],
    ]);
  });

  it("one line replaced by two is ambiguous (round 4 — one anchor, two elements)", () => {
    const base = baseline(line("<Text>A</Text>"), { a: "red" });
    const from = at(base.code, line("<Text>A</Text>"));
    const out = edit(base, [
      {
        fromA: from,
        toA: from + line("<Text>A</Text>").length,
        insert: line("<Text>NEW</Text>") + line("<Text>A2</Text>"),
      },
    ]);
    expect(out.ambiguous).toHaveLength(2);
  });

  it("a replaced line with the kept sibling's text does not take the kept id (round 4)", () => {
    const base = baseline(line("<Text>A</Text>") + line("<Text>B</Text>"), {
      a: "red",
      b: "blue",
    });
    const from = at(base.code, line("<Text>A</Text>"));
    const out = edit(base, [
      {
        fromA: from,
        toA: from + line("<Text>A</Text>").length,
        insert: line("<Text>B</Text>"),
      },
    ]);
    expect(out.result).toEqual([
      ["a", "<Text>B</Text>"],
      ["b", "<Text>B</Text>"],
    ]);
  });

  it("text typed with no anchor deleted is new, even when it equals a kept one", () => {
    const base = baseline(line("<Text>A</Text>"));
    const end =
      at(base.code, line("<Text>A</Text>")) + line("<Text>A</Text>").length;
    const out = edit(base, [
      { fromA: end, toA: end, insert: line("<Text>A</Text>") },
    ]);
    expect(out.result).toEqual([
      ["a", "<Text>A</Text>"],
      ["+", "<Text>A</Text>"],
    ]);
  });

  it("a line cut and pasted into another parent moves it (across parents)", () => {
    const base = baseline(
      line("<Text>A</Text>") +
        line("<div>") +
        line("  <Text>B</Text>") +
        line("</div>"),
      { a: "red" },
    );
    const cut = at(base.code, line("<Text>A</Text>"));
    const into = at(base.code, line("  <Text>B</Text>"));
    const out = edit(base, [
      { fromA: cut, toA: cut + line("<Text>A</Text>").length, insert: "" },
      { fromA: into, toA: into, insert: line("  <Text>A</Text>") },
    ]);
    expect(out.result).toEqual([
      ["b", expect.stringMatching(/^<div>/)],
      ["a", "<Text>A</Text>"],
      ["c", "<Text>B</Text>"],
    ]);
    expect(out.removed).toEqual([]);
  });

  it("a parent deleted removes it (its children go with it)", () => {
    const block = line("<div>") + line("  <Text>B</Text>") + line("</div>");
    const base = baseline(line("<Text>A</Text>") + block);
    const from = at(base.code, block);
    const out = edit(base, [
      { fromA: from, toA: from + block.length, insert: "" },
    ]);
    expect(out.removed).toEqual(["b"]);
  });
});
