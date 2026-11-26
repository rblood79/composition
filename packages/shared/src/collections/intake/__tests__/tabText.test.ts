import { describe, expect, it } from "vitest";
import { splitTabText } from "../tabText";

/**
 * ADR-317 Phase 2 — clipboard text as cells (breakdown §5.2). The texts are what Excel · Google
 * Sheets · the Table's own copy put on the clipboard; the cells are written by hand.
 */
describe("splitTabText", () => {
  it("reads lines and tabs — the Table's own copy", () => {
    expect(splitTabText("1:1\t1:2\n2:1\t2:2")).toEqual([
      ["1:1", "1:2"],
      ["2:1", "2:2"],
    ]);
  });

  it("drops the line break Excel ends with, reads \\r\\n · \\r", () => {
    expect(splitTabText("a\tb\r\nc\td\r\n")).toEqual([
      ["a", "b"],
      ["c", "d"],
    ]);
    expect(splitTabText("a\rb")).toEqual([["a"], ["b"]]);
  });

  it("keeps a quoted cell's tab · line break · doubled quote (Excel's copy)", () => {
    expect(splitTabText('a\t"b\tc"\n"multi\nline"\t"say ""hi"""\n')).toEqual([
      ["a", "b\tc"],
      ["multi\nline", 'say "hi"'],
    ]);
  });

  it("keeps empty cells and a single value", () => {
    expect(splitTabText("\t\tx")).toEqual([["", "", "x"]]);
    expect(splitTabText("42")).toEqual([["42"]]);
    expect(splitTabText("")).toEqual([[""]]);
    expect(splitTabText('""')).toEqual([[""]]);
  });

  it("a quote inside a cell is text; an unclosed quote reads plain", () => {
    expect(splitTabText('5" disk\tx')).toEqual([['5" disk', "x"]]);
    expect(splitTabText('"open\tx\ny')).toEqual([['"open', "x"], ["y"]]);
  });
});
