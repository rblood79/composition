/**
 * ADR-296 Phase 4 — `src/theme.css`: the project's themes, one block each
 * (`[data-theme="<name>"] {…}`). A theme's preset is four declarations (`color-scheme` = its dark
 * mode, `--theme-tint` · `--theme-neutral` · `--theme-radius`), its tokens one custom property each
 * (`--<name>: <value>` — a length's number in px). A spec token (read from the library) is read only
 * (`/* spec token *\/`). The device values (ADR-295 — S2 `scale` 1.25 · touch type) are the
 * resolver's, not the document's: the file does not write them. The active theme is `App.tsx`'s
 * `<Theme name>`.
 */
import type {
  CatalogReader,
  ProjectEntry,
  ThemeEntry,
  ThemePreset,
  TokenEntry,
} from "../../catalog/document/types";
import type { CodeViewReader, CodeViewResult } from "../types";
import { CodeWriter } from "../writer";
import { codeViewKebab } from "./styles";

export const CODE_VIEW_THEME_PATH = "src/theme.css";
export const CODE_VIEW_SPEC_TOKEN_MARKER = "/* spec token */";

/** The preset's declarations (`darkMode` = `color-scheme`; `system` = both). */
export const CODE_VIEW_PRESET_CSS = {
  tint: "--theme-tint",
  neutral: "--theme-neutral",
  radius: "--theme-radius",
} as const satisfies Partial<Record<keyof ThemePreset, string>>;

export const codeViewColorScheme = (mode: ThemePreset["darkMode"]) =>
  mode === "system" ? "light dark" : mode;

/** A token's value as CSS text (a length's number in px). */
export function codeViewTokenValue(
  token: Pick<TokenEntry, "tokenType" | "value">,
): string {
  const { value } = token;
  if (typeof value === "number")
    return token.tokenType === "length" && value !== 0
      ? `${value}px`
      : String(value);
  return String(value);
}

/** A token's custom property name (`--<name>` — its name kebab-cased). */
export const codeViewTokenProperty = (name: string) =>
  `--${codeViewKebab(name, "token")}`;

/** A theme's selector (`[data-theme="Dark"]`). */
export const codeViewThemeSelector = (name: string) =>
  `[data-theme="${name.replace(/(["\\])/g, "\\$1")}"]`;

export function generateThemeFile(input: {
  reader: CodeViewReader;
}): CodeViewResult {
  const reader = input.reader as unknown as Pick<
    CatalogReader,
    "projectId" | "getEntry"
  >;
  const project = reader.getEntry(reader.projectId) as ProjectEntry;
  const out = new CodeWriter();
  const themes: Record<string, string> = {};
  const tokens: Record<string, string> = {};
  let first = true;
  for (const id of project.themeIds) {
    const theme = reader.getEntry(id) as ThemeEntry | undefined;
    if (theme?.kind !== "theme") continue;
    if (!first) out.line();
    first = false;
    themes[theme.name] = theme.id;
    out.start();
    const from = out.length;
    out
      .write(`${codeViewThemeSelector(theme.name)} {`)
      .end()
      .in();
    out.line(`color-scheme: ${codeViewColorScheme(theme.preset.darkMode)};`);
    for (const [key, property] of Object.entries(CODE_VIEW_PRESET_CSS))
      out.line(
        `${property}: ${theme.preset[key as keyof typeof CODE_VIEW_PRESET_CSS]};`,
      );
    for (const tokenId of theme.tokenIds) {
      const token = reader.getEntry(tokenId) as TokenEntry | undefined;
      if (token?.kind !== "token") continue;
      const property = codeViewTokenProperty(token.name);
      tokens[`${theme.id}\u0000${property}`] = token.id;
      out.line(
        `${property}: ${codeViewTokenValue(token)};${
          token.source === "spec-token" ? ` ${CODE_VIEW_SPEC_TOKEN_MARKER}` : ""
        }`,
      );
    }
    out.out().start().write("}");
    out.anchor(from, { kind: "theme", themeId: theme.id });
    out.end();
  }
  return {
    ...out.done(),
    symbols: { variables: {}, fields: {}, themes, tokens },
  };
}
