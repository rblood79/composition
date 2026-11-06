/**
 * The specs token maps a resolved theme is installed into (ADR-227 Phase 2 step 1) — Skia paint,
 * layout, text measure and the catalog library token reads (`catalogTokenValue`) read these maps
 * through `resolveToken`.
 *
 * The code catalog's own values are copied at module load (before any install): `null` puts them
 * back (a project without a theme), and every install starts from them so no key of an earlier
 * theme remains.
 */
import {
  borderWidth,
  darkColors,
  darkShadows,
  lightColors,
  lightShadows,
  radius,
  size,
  typography,
} from "@composition/rendering";
import { DEFAULT_BASE_TYPOGRAPHY } from "./fontDefaults";
import type { ResolvedThemeSnapshot } from "./resolveThemeSnapshot";

type TokenMap = Record<string, unknown>;

const MAPS = {
  lightColors: lightColors as unknown as TokenMap,
  darkColors: darkColors as unknown as TokenMap,
  typography: typography as unknown as TokenMap,
  radius: radius as unknown as TokenMap,
  borderWidth: borderWidth as unknown as TokenMap,
  size: size as unknown as TokenMap,
  lightShadows: lightShadows as unknown as TokenMap,
  darkShadows: darkShadows as unknown as TokenMap,
};
type MapName = keyof typeof MAPS;

const CODE_VALUES = Object.fromEntries(
  Object.entries(MAPS).map(([name, map]) => [name, { ...map }]),
) as Record<MapName, Readonly<TokenMap>>;

function replace(name: MapName, source: Readonly<TokenMap> = {}): void {
  const target = MAPS[name];
  for (const key of Object.keys(target))
    if (!(key in CODE_VALUES[name])) delete target[key];
  Object.assign(target, CODE_VALUES[name], source);
}

/**
 * The installed theme's base font family when the theme sets one (`base-font-family`), else
 * undefined (each text consumer keeps its default). The Preview's root inherits the same value.
 */
let baseFontFamily: string | undefined;
export function installedBaseFontFamily(): string | undefined {
  return baseFontFamily;
}

/**
 * The installed theme's base font size and line height (the DOM root's — every box inherits them
 * unless it declares its own), else the code defaults (ADR-056 `DEFAULT_BASE_TYPOGRAPHY`).
 */
let baseText: { fontSize: number; lineHeight: number } = {
  fontSize: DEFAULT_BASE_TYPOGRAPHY.fontSize,
  lineHeight: DEFAULT_BASE_TYPOGRAPHY.lineHeight,
};
export function installedBaseText(): { fontSize: number; lineHeight: number } {
  return baseText;
}

// Canvas의 상태 outline도 DOM에 내보낸 focus 변수와 같은 값을 읽는다.
let focusVars: ResolvedThemeSnapshot["cssVars"] = [];
export function installedFocusRingCss(
  name: string,
  mode: "light" | "dark",
): string {
  const authored = focusVars.find(
    (entry) => entry.name === name && entry.isDark === (mode === "dark"),
  );
  if (authored) return authored.value;
  if (name === "--focus-ring")
    return mode === "dark"
      ? darkColors["focus-ring"]
      : lightColors["focus-ring"];
  return "2px";
}

/** Install a resolved theme into the specs maps, or the code catalog's values for `null`. */
export function installThemeMaps(snapshot: ResolvedThemeSnapshot | null): void {
  focusVars =
    snapshot?.cssVars.filter((entry) =>
      entry.name.startsWith("--focus-ring"),
    ) ?? [];
  baseText = {
    fontSize: snapshot?.base.fontSize ?? DEFAULT_BASE_TYPOGRAPHY.fontSize,
    lineHeight: snapshot?.base.lineHeight ?? DEFAULT_BASE_TYPOGRAPHY.lineHeight,
  };
  const family = snapshot?.typography.sans ?? snapshot?.base.fontFamily;
  baseFontFamily =
    typeof family === "string" && family !== DEFAULT_BASE_TYPOGRAPHY.fontFamily
      ? family
      : undefined;
  replace("lightColors", snapshot?.colors.light);
  replace("darkColors", snapshot?.colors.dark);
  replace("typography", snapshot?.typography);
  replace("radius", snapshot?.radius);
  replace("borderWidth", snapshot?.border);
  replace("size", snapshot?.size);
  replace("lightShadows", snapshot?.shadows.light);
  replace("darkShadows", snapshot?.shadows.dark);
}
