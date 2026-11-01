import {
  borderWidth,
  lightColors,
  lightShadows,
  radius,
  spacing,
  typography,
} from "@composition/rendering";
import { readThemeTokenValue } from "./themedToken";
import type { LibraryToken, LibraryTokenId, TokenType } from "./types";

/**
 * ADR-298 D2 — the library's theme-agnostic token scale: every step of the theme axes a node value can
 * reference (spacing · radius · border width · shadow · typography with its line heights · color), as
 * `lib:token:<ref>` (no theme suffix), whether a rule references the step or not. The value is the
 * build-time read; a rendering environment reads `ref` again in its color mode and installed theme
 * (`catalogTokenValue`), as for the rule tokens. The rule tokens (`lib:token:<ref>_light`) stay as they
 * are — documents, the validator and the code view look them up by id.
 */
export function libraryTokenId(ref: `{${string}}`): LibraryTokenId {
  return `lib:token:${ref.slice(1, -1).replace(/[^A-Za-z0-9_-]/g, "_")}` as LibraryTokenId;
}

/** The scale's refs and token types, in a stable order (axis, then the map's step order). */
export function libraryTokenScaleRefs(): readonly {
  ref: `{${string}}`;
  tokenType: TokenType;
}[] {
  const steps = (
    category: string,
    keys: readonly string[],
    tokenType: TokenType,
  ) =>
    keys.map((key) => ({
      ref: `{${category}.${key}}` as `{${string}}`,
      tokenType,
    }));
  return [
    ...steps("spacing", Object.keys(spacing), "number"),
    ...steps("radius", Object.keys(radius), "number"),
    ...steps(
      "border",
      Object.keys(borderWidth).map((key) => `width.${key}`),
      "number",
    ),
    ...steps(
      "shadow",
      Object.keys(lightShadows).filter((key) => key !== "none"),
      "string",
    ),
    ...steps("typography", Object.keys(typography), "number"),
    ...steps(
      "color",
      Object.entries(lightColors)
        .filter(([, value]) => typeof value === "string")
        .map(([key]) => key),
      "color",
    ),
  ];
}

let scaleByTokenId: Map<string, `{${string}}`> | undefined;

/**
 * ADR-298 Phase 2 — the ref of a library token id: a scale id (`lib:token:spacing_md`) or a rule token's
 * (`lib:token:radius_md_light` — the theme suffix is the mode it was built in, not part of the step). A
 * project token or an unknown id is undefined.
 */
export function libraryTokenRef(tokenId: string): `{${string}}` | undefined {
  scaleByTokenId ??= new Map(
    libraryTokenScaleRefs().map(({ ref }) => [libraryTokenId(ref), ref]),
  );
  return (
    scaleByTokenId.get(tokenId) ??
    scaleByTokenId.get(tokenId.replace(/_(?:light|dark)$/, ""))
  );
}

/** Adds the scale to a library token map (a rule token is never replaced — its id has a suffix). */
export function addLibraryTokenScale(
  tokens: Map<LibraryTokenId, LibraryToken>,
  theme: "light" | "dark",
): void {
  for (const { ref, tokenType } of libraryTokenScaleRefs()) {
    const value = readThemeTokenValue(ref, tokenType, theme);
    if (value === undefined) continue;
    const id = libraryTokenId(ref);
    tokens.set(id, { id, tokenType, value, source: "spec-token", ref });
  }
}
