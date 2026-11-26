import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * ADR-325 G1 (R1) — the rows a collection shows are read in one place: the session's `shownRows`
 * (its store's list with the changes laid over it — `overlayRows`). Every reader (bound rows · a
 * rule's item reads · edit marks · selection · a page list · pinned rows · a group's rows) goes
 * through it; nothing holds rows of its own beside the store, and nothing reads a store's rows past
 * it. A new direct read · a row cache of its own fails here.
 */
const repo = resolve(__dirname, "../../../../../..");
const read = (path: string) =>
  readFileSync(
    resolve(repo, "packages/shared/src/catalog/runtime", path),
    "utf8",
  )
    // (Comments may name what is gone.)
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/\/\/.*$/gm, "");
const session = read("catalogPreviewSession.ts");
const controller = read("catalogTableController.ts");
const count = (source: string, pattern: RegExp) =>
  (source.match(pattern) ?? []).length;

describe("ADR-325 G1 — one read of a collection's rows", () => {
  it("the session lays the changes over a list in `shownRows` only", () => {
    expect(count(session, /\boverlayRows\(/g)).toBe(1);
    expect(count(session, /\.listRows\(/g)).toBe(1);
    const at = session.indexOf("private shownRows(");
    const body = session.slice(at, session.indexOf("\n  }\n", at));
    expect(body).toContain("overlayRows(");
    expect(body).toContain(".listRows(");
  });

  it("no reader takes a store's rows · results · lists past it", () => {
    for (const source of [session, controller]) {
      expect(source).not.toMatch(/\.resultRows\(/);
      expect(source).not.toMatch(/\.rows\.(get|values|entries)\(/);
      expect(source).not.toMatch(/\.results\.(get|values|entries)\(/);
      expect(source).not.toMatch(/\.lists\.(get|values|entries)\(/);
    }
  });

  it("the places that held rows of their own are gone (ADR-325 Context 「행을 든 자리가 다섯」)", () => {
    for (const gone of [
      /\breloadedItems\b/,
      /\bitemEdits\b/,
      /\bsavedEdits\b/,
      /\breplayItemEdits\b/,
      /\bmarkEditsSaved\b/,
      /\bunit\.items\b/,
    ])
      expect(session).not.toMatch(gone);
    // (A pinned rows' answer · a group's last level hold a store list, not rows.)
    const pins = session.slice(
      session.indexOf("private readonly pinAnswers"),
      session.indexOf(">();", session.indexOf("private readonly pinAnswers")),
    );
    expect(pins).toContain("list?: ListKey");
    expect(pins).not.toMatch(/\bitems\b/);
  });

  it("the Table controller reads rows through the session only", () => {
    expect(controller).not.toMatch(/\bcollectionStore\b|\bCollectionStore\b/);
    expect(controller).not.toMatch(/\boverlayRows\b|\blistRows\b/);
  });
});
