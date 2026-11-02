import { describe, expect, it } from "vitest";
import {
  applyTextRunMarks,
  clearTextRunMarks,
  isNormalRichText,
  normalizeRichText,
  richTextPlain,
  textRunMarksIn,
  widenToTokens,
} from "../textRuns";
import type { NodeEntry, RichText, StateVariableEntry } from "../types";
import { resolveStateTemplateProps } from "../../../state/template";
import { collectPropsStateRefs } from "../../../state/stateDependencies";
import { resolveCatalogNode } from "../../resolution/resolver";
import { setFields } from "../../commands/fields";
import { renameVariable } from "../../commands/variables";
import {
  code,
  graphOf,
  node,
  run,
  snapshot,
  undo,
} from "../../commands/__tests__/fixture";
import { validateCatalogDocument } from "../validation";

/**
 * ADR-299 G3 — the range-formatted text value (`RichText`): normal form, template tokens as atoms,
 * the shared template functions over runs, validation, the contract.
 */
const rich = (...runs: RichText["runs"]): RichText => ({ kind: "text", runs });
const BOLD = { fontWeight: 700 } as const;
const env = (values: Record<string, unknown>) => ({
  get: (name: string) => values[name],
});

describe("ADR-299 normal form", () => {
  it("drops empty runs and empty marks, merges equal neighbours, keys in order", () => {
    expect(
      normalizeRichText(
        rich(
          { text: "", marks: BOLD },
          { text: "a", marks: { color: "#f00", fontWeight: 700 } },
          { text: "b", marks: { fontWeight: 700, color: "#f00" } },
          { text: "c", marks: {} },
        ),
      ),
    ).toEqual(
      rich(
        { text: "ab", marks: { fontWeight: 700, color: "#f00" } },
        { text: "c" },
      ),
    );
  });

  it("a text with no marked run is its string (storage shape unchanged)", () => {
    expect(
      normalizeRichText(rich({ text: "a" }, { text: "b", marks: {} })),
    ).toBe("ab");
    expect(normalizeRichText("plain")).toBe("plain");
    expect(clearTextRunMarks(rich({ text: "x", marks: BOLD }), 0, 1)).toBe("x");
  });

  it("is idempotent, and only normal values pass `isNormalRichText`", () => {
    const value = applyTextRunMarks("Hello world", 6, 11, BOLD) as RichText;
    expect(normalizeRichText(value)).toEqual(value);
    expect(isNormalRichText(value)).toBe(true);
    expect(
      isNormalRichText(
        rich({ text: "a", marks: BOLD }, { text: "b", marks: BOLD }),
      ),
    ).toBe(false);
    expect(isNormalRichText(rich({ text: "a" }))).toBe(false);
    expect(
      isNormalRichText(
        rich({ text: "a", marks: {} }, { text: "b", marks: BOLD }),
      ),
    ).toBe(false);
  });

  it("round-trips line breaks and keeps UTF-16 offsets", () => {
    const value = applyTextRunMarks("한글\n세상", 3, 5, { color: "#00f" });
    expect(value).toEqual(
      rich({ text: "한글\n" }, { text: "세상", marks: { color: "#00f" } }),
    );
    expect(richTextPlain(value as RichText)).toBe("한글\n세상");
  });

  it("reads a range's marks — one value, `mixed`, or absent", () => {
    const value = rich(
      { text: "ab", marks: BOLD },
      { text: "cd", marks: { fontWeight: 700, color: "#f00" } },
      { text: "ef" },
    );
    expect(textRunMarksIn(value, 0, 4)).toEqual({
      fontWeight: 700,
      color: "mixed",
    });
    expect(textRunMarksIn(value, 0, 6)).toEqual({
      fontWeight: "mixed",
      color: "mixed",
    });
    expect(textRunMarksIn(value, 4, 6)).toEqual({});
  });
});

describe("ADR-299 template tokens are atoms (리뷰 h1)", () => {
  const SOURCE = "Hello {{ userName }}!";
  // Bold the name only — a range inside the token.
  const from = SOURCE.indexOf("userName");
  const to = from + "userName".length;

  it("a write widens to the whole token", () => {
    expect(widenToTokens(SOURCE, from, to)).toEqual([6, 20]);
    const value = applyTextRunMarks(SOURCE, from, to, BOLD);
    expect(value).toEqual(
      rich(
        { text: "Hello " },
        { text: "{{ userName }}", marks: BOLD },
        { text: "!" },
      ),
    );
  });

  it("resolves, collects refs and renames exactly like the same string value", () => {
    const value = applyTextRunMarks(SOURCE, from, to, BOLD) as RichText;
    const resolved = resolveStateTemplateProps(
      { children: value },
      env({ userName: "guest" }),
    ).children as RichText;
    expect(richTextPlain(resolved)).toBe("Hello guest!");
    expect(richTextPlain(resolved)).toBe(
      resolveStateTemplateProps(
        { children: SOURCE },
        env({ userName: "guest" }),
      ).children,
    );
    // The mark covers the whole substituted value.
    expect(resolved.runs[1]).toEqual({ text: "guest", marks: BOLD });
    expect(collectPropsStateRefs({ children: value })).toEqual(["userName"]);
  });

  it("a typed boundary inside a token takes the token's first character's marks", () => {
    expect(
      normalizeRichText(
        rich({ text: "Hi {{ us" }, { text: "er }} there", marks: BOLD }),
      ),
    ).toEqual(rich({ text: "Hi {{ user }}" }, { text: " there", marks: BOLD }));
    // escape · row field tokens too
    expect(widenToTokens("a \\{{ b", 3, 4)).toEqual([2, 5]);
    expect(widenToTokens("x {name} y", 4, 5)).toEqual([2, 8]);
  });
});

const TEXT = "lib:definition:text" as NodeEntry["definitionId"];
const PICKER = "lib:definition:picker" as NodeEntry["definitionId"];
const richNode = (id: string, value: RichText | string) =>
  node(id, TEXT, { props: { children: { kind: "set", value } } });

describe("ADR-299 document", () => {
  it("a text node holds runs; resolution keeps runs (marks) and resolves each run's text", () => {
    const value = applyTextRunMarks("Hello world", 6, 11, BOLD) as RichText;
    const graph = graphOf([richNode("t", value)], ["t"]);
    const resolved = resolveCatalogNode(graph, "project:node:t");
    expect(resolved.props.children).toEqual(value);
  });

  it("validation refuses a non-normal, an unknown mark and a split token", () => {
    const valid = (value: unknown) =>
      code(() => graphOf([richNode("t", value as RichText)], ["t"]));
    expect(valid(applyTextRunMarks("ab", 0, 1, BOLD))).toBe("ACCEPTED");
    expect(valid(rich({ text: "a" }))).toBe("RICH_TEXT_NOT_NORMAL");
    expect(
      valid(rich({ text: "a", marks: { letterSpacing: 2 } as never })),
    ).toBe("UNKNOWN_FIELD");
    expect(valid(rich({ text: "", marks: BOLD }))).toBe("RICH_TEXT_EMPTY_RUN");
    expect(valid(rich({ text: "{{ a" }, { text: " }}", marks: BOLD }))).toBe(
      "RICH_TEXT_NOT_NORMAL",
    );
    expect(
      valid(rich({ text: "a", marks: { fontWeight: true as never } })),
    ).not.toBe("ACCEPTED");
  });

  it("only a text node's own `children` takes runs (a parent prop's text stays a string)", () => {
    const value = applyTextRunMarks("ab", 0, 1, BOLD);
    expect(
      code(() =>
        graphOf(
          [node("p", PICKER, { props: { label: { kind: "set", value } } })],
          ["p"],
        ),
      ),
    ).toBe("RICH_TEXT_NOT_ALLOWED");
  });

  it("renaming a variable rewrites the token inside its run; one undo restores", () => {
    const value = applyTextRunMarks(
      "Hello {{ userName }}!",
      8,
      12,
      BOLD,
    ) as RichText;
    const variable: StateVariableEntry = {
      kind: "stateVariable",
      id: "project:stateVariable:v" as StateVariableEntry["id"],
      ownerId: "project:page:main" as StateVariableEntry["ownerId"],
      name: "userName",
      valueType: "string",
      defaultValue: "guest",
    };
    const graph = graphOf([richNode("t", value)], ["t"], [variable]);
    const before = snapshot(graph);
    const { result } = run(
      graph,
      renameVariable({ variableId: variable.id, name: "displayName" }),
    );
    const written = (graph.getEntry("project:node:t") as NodeEntry).props
      .children;
    expect(written).toEqual({
      kind: "set",
      value: rich(
        { text: "Hello " },
        { text: "{{ displayName }}", marks: BOLD },
        { text: "!" },
      ),
    });
    undo(graph, result.inverse);
    expect(snapshot(graph)).toBe(before);
  });

  it("a plain string write replaces the runs (서식 초기화 — Decision 6)", () => {
    const graph = graphOf(
      [richNode("t", applyTextRunMarks("ab", 0, 1, BOLD))],
      ["t"],
    );
    run(
      graph,
      setFields({
        targets: [{ kind: "node", id: "project:node:t" as never }],
        props: { children: { kind: "set", value: "plain" } },
      }),
    );
    expect(
      (graph.getEntry("project:node:t") as NodeEntry).props.children,
    ).toEqual({ kind: "set", value: "plain" });
  });

  it("a contract 52 document is refused (변환 0)", () => {
    const graph = graphOf([richNode("t", "a")], ["t"]);
    const document = graph.exportDocument();
    expect(
      code(() =>
        validateCatalogDocument({
          ...document,
          libraryContractVersion: 52 as never,
        }),
      ),
    ).not.toBe("ACCEPTED");
  });
});
