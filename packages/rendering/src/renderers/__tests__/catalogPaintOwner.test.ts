// @vitest-environment node

import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

function withoutComments(source: string): string {
  return source.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*$/gm, "");
}

describe("ADR-912 후속 Phase 2 — renderer paint owner collapse", () => {
  it("generic renderer가 authored paint state를 다시 선택하지 않는다", () => {
    const source = readFileSync(
      new URL("../buildCatalogShapes.ts", import.meta.url),
      "utf8",
    );
    const body = withoutComments(
      source.slice(source.indexOf("export function buildCatalogShapes")),
    );

    expect(body).not.toMatch(
      /props\.(?:fillStyle|isQuiet|staticColor|isEmphasized)/,
    );
    expect(body).not.toMatch(/state\s*===\s*["'](?:hover|pressed)["']/);
  });

  it("primitive가 visual에서 root fill/text/border를 직접 읽지 않는다", () => {
    const source = withoutComments(
      readFileSync(new URL("../skiaPrimitives.ts", import.meta.url), "utf8"),
    );

    expect(source).not.toMatch(
      /visual\?\.(?:fill|text|border|selectedText|selectedBorder|outlineText|outlineBorder|subtleText|textHover|borderHover)\b/,
    );
  });
});
